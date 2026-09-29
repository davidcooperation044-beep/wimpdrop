// supabase/functions/estimate-shipping-cost/index.ts
//
// One-time (well — repeatable) backfill: for each product that hasn't been
// done yet, asks CJ what it actually costs to ship ONE unit of THAT
// specific product to Nigeria, and adds that amount (converted to naira)
// straight into the product's own price. Once every product has this baked
// in, checkout can show "Free Shipping" instead of a live/flat courier fee,
// without silently eating the real freight cost.
//
// This is deliberately per-product (not a flat guess) because real shipping
// cost varies hugely by weight/restrictions — a $1 earring and a 5kg
// ultrasonic cleaner should NOT get the same amount folded in.
//
// Safe to re-run: any product with shipping_folded_into_price = true is
// skipped, so calling this repeatedly (it only processes a `limit`-sized
// batch per call, to stay well inside the function's execution time limit)
// will not double-charge shipping into a price that already has it.
//
// CJ enforces roughly 1 request/second on this endpoint (see
// shipping-quote/index.ts), so this processes products one at a time with a
// pause between each — a full catalog backfill means calling this endpoint
// repeatedly until it reports remaining: 0.
//
// IMPORTANT — same caveat as shipping-quote: this was written without a way
// to test it against a live CJ account. Run it once with a small `limit`
// (e.g. 3) first and check the response/log before running it across your
// whole catalog.

import { db, handleOptions, json, requireAdmin, cjRequest } from '../_shared/cj.ts';

const RETRY_DELAY_MS = 1100; // CJ's observed rate limit is ~1 request/second
const MAX_RETRIES_PER_PRODUCT = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function cheapestPrice(raw: any): number | null {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : null;
  if (!list || !list.length) return null;
  const prices = list
    .map((o: any) => Number(o.logisticPrice ?? o.price ?? o.freight ?? NaN))
    .filter((n: number) => Number.isFinite(n));
  if (!prices.length) return null;
  return Math.min(...prices);
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 20, 100);
    const countryCode = String(body.countryCode || 'NG').toUpperCase();
    const fxRate = Number(body.fxRate) || 1325; // NGN per USD — pass the current rate

    // Your products table has one ROW PER VARIANT (colour/size), not one row
    // per product — a single product can have dozens of rows sharing the
    // same supplier_product_id. Pricing every row individually would mean
    // one CJ call per variant, multiplying both the runtime and the number
    // of (rate-limited) CJ calls by however many colours/sizes a product
    // has, for a shipping cost that's realistically the same regardless of
    // colour. So instead: find distinct products first, price EACH PRODUCT
    // ONCE using one representative variant, then apply that same shipping
    // amount to every row of that product (each row keeps its own existing
    // price and just has the same ₦ shipping amount added on top, so
    // variants that are already priced differently stay that way).
    //
    // Fetch a wide window of not-yet-folded rows (order by product id so
    // duplicates of the same product land together) — wide enough to
    // reliably surface `limit` distinct products even if some have many
    // variants.
    const { data: rows, error: selectError } = await db
      .from('products')
      .select('supplier_product_id, supplier_variant_id')
      .eq('shipping_folded_into_price', false)
      .not('supplier_variant_id', 'is', null)
      .order('supplier_product_id')
      .limit(Math.max(limit * 30, 500));

    if (selectError) throw selectError;

    const representativeVid = new Map<string, string>(); // supplier_product_id -> one variant id to price with
    for (const r of rows || []) {
      if (!representativeVid.has(r.supplier_product_id)) {
        representativeVid.set(r.supplier_product_id, r.supplier_variant_id);
      }
    }
    const productIds = Array.from(representativeVid.keys()).slice(0, limit);

    if (!productIds.length) {
      return json({ success: true, processed: 0, remaining: 0, message: 'Nothing left to backfill.' });
    }

    const results: any[] = [];

    for (const productId of productIds) {
      const vid = representativeVid.get(productId)!;
      let shippingNgn: number | null = null;
      let lastErrorMessage = '';

      for (let attempt = 0; attempt < MAX_RETRIES_PER_PRODUCT && shippingNgn == null; attempt++) {
        try {
          const raw = await cjRequest('/logistic/freightCalculate', {
            method: 'POST',
            body: JSON.stringify({
              startCountryCode: 'CN',
              endCountryCode: countryCode,
              products: [{ vid, quantity: 1 }]
            })
          });

          const shippingUsd = cheapestPrice(raw);
          if (shippingUsd == null) {
            lastErrorMessage = 'no_cj_options';
            break; // not a rate-limit issue — retrying won't help
          }
          shippingNgn = Math.round(shippingUsd * fxRate);
        } catch (err) {
          lastErrorMessage = (err as Error).message;
          if ((err as any).rateLimited && attempt < MAX_RETRIES_PER_PRODUCT - 1) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          break; // a real error (bad vid, CJ down, etc.) — no point retrying this one right now
        }
      }

      if (shippingNgn != null) {
        // Apply this product's shipping amount to EVERY variant row that
        // shares its supplier_product_id — each row keeps its own current
        // price and just has this same ₦ amount added on top.
        const { data: variantRows, error: variantsError } = await db
          .from('products')
          .select('id, price')
          .eq('supplier_product_id', productId);
        if (variantsError) throw variantsError;

        const nowIso = new Date().toISOString();
        for (const row of variantRows || []) {
          const newPrice = Number(row.price || 0) + shippingNgn;
          const { error: updateError } = await db
            .from('products')
            .update({
              price: newPrice,
              shipping_cost_ngn: shippingNgn,
              shipping_folded_into_price: true,
              shipping_estimated_at: nowIso
            })
            .eq('id', row.id);
          if (updateError) throw updateError;
        }

        results.push({ supplierProductId: productId, variantRowsUpdated: (variantRows || []).length, shippingNgn, status: 'ok' });
      } else {
        results.push({ supplierProductId: productId, status: 'failed', reason: lastErrorMessage });
      }

      // Pace every PRODUCT (not every row) one second apart, since only one
      // CJ call happens per product regardless of how many variant rows it has.
      await sleep(RETRY_DELAY_MS);
    }

    // Count remaining DISTINCT products, not remaining rows, so this number
    // matches what `limit` actually consumes per call.
    const { data: remainingRows } = await db
      .from('products')
      .select('supplier_product_id')
      .eq('shipping_folded_into_price', false)
      .not('supplier_variant_id', 'is', null)
      .limit(5000);
    const remaining = new Set((remainingRows || []).map((r: any) => r.supplier_product_id)).size;

    return json({
      success: true,
      processedProducts: results.length,
      succeeded: results.filter((r) => r.status === 'ok').length,
      failed: results.filter((r) => r.status === 'failed'),
      remaining,
      results
    });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 403);
  }
});