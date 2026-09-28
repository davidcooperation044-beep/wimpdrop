// supabase/functions/shipping-quote/index.ts
//
// Calls CJdropshipping's freight-calculation endpoint to get a REAL shipping
// cost for the shopper's actual cart + destination country, instead of the
// flat ₦5,000 / ₦10,000 placeholder that was hardcoded in checkout.html.
//
// IMPORTANT — I could not test this against a live CJ account (no network
// access in the environment I wrote this in). The request/response shape
// below matches CJ's documented v2 freight-calculate endpoint and follows
// the same calling pattern already used elsewhere in this repo
// (_shared/cj-adapter.ts), but CJ's API has changed shape before. Before
// trusting this in production:
//   1. Deploy it, then call it once from the browser console or curl with
//      a real cart item and watch the Supabase function logs.
//   2. Confirm the field names in the CJ response (logisticPrice,
//      logisticAging, logisticName) still match what's parsed below —
//      log `result` and compare against what CJ actually sends back.
//   3. If CJ renamed or restructured the response, adjust parseCjOptions()
//      only — everything else (auth, caching, fallback) stays the same.
//
// Safety net: if the CJ call fails for ANY reason (bad vid, unsupported
// country, CJ is down, the shape changed), this returns success:true with
// a `live:false` flag and flat fallback rates — checkout.html always gets
// something usable and a sale is never blocked by this.

import { cjRequest, db, handleOptions, json, readJson } from '../_shared/cj.ts';

const FALLBACK_RATES = {
  standard: { name: 'Standard Shipping', price: 5000, days: '7-14', currency: 'NGN' },
  express: { name: 'Express Shipping', price: 10000, days: '3-5', currency: 'NGN' }
};

// Quotes are per (destination country + exact cart contents). Caching for
// a few hours avoids hitting CJ's rate limit if a shopper reloads checkout
// or flips between the shipping options a few times in one sitting.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cacheKeyFor(countryCode: string, items: { supplierVariantId: string; quantity: number }[]): string {
  const sorted = items
    .map((i) => `${i.supplierVariantId}:${i.quantity}`)
    .sort()
    .join('|');
  return `${countryCode}::${sorted}`;
}

// Converts CJ's freight-calculate response into { standard, express }.
// CJ typically returns an array of logistics options sorted by price; we
// treat the cheapest as "standard" and the fastest (lowest max transit
// days) as "express". If CJ only returns one option, both point at it.
function parseCjOptions(raw: any): { standard: any; express: any } | null {
  const list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : null;
  if (!list || !list.length) return null;

  const parsed = list
    .map((o: any) => {
      const price = Number(o.logisticPrice ?? o.price ?? o.freight ?? NaN);
      if (!Number.isFinite(price)) return null;
      const agingRaw = String(o.logisticAging ?? o.aging ?? o.days ?? '').trim();
      // "logisticAging" is usually a string like "15-22" (days); take the
      // upper bound for sorting "fastest", but keep the original string
      // for display.
      const maxDays = Number((agingRaw.split(/[-~]/).pop() || '999').trim()) || 999;
      return {
        name: o.logisticName || o.name || 'Shipping',
        price,
        days: agingRaw || 'Unknown',
        maxDays,
        currency: (o.logisticPriceCurrency || o.currency || 'USD').toUpperCase()
      };
    })
    .filter(Boolean) as any[];

  if (!parsed.length) return null;

  const cheapest = parsed.slice().sort((a, b) => a.price - b.price)[0];
  const fastest = parsed.slice().sort((a, b) => a.maxDays - b.maxDays)[0];

  return {
    standard: cheapest,
    express: fastest.name === cheapest.name && fastest.price === cheapest.price ? cheapest : fastest
  };
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    // Checkout already requires a logged-in shopper, so require that here
    // too rather than leaving this open to anonymous callers.
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ success: false, error: 'Authentication required' }, 401);
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ success: false, error: 'Authentication required' }, 401);

    const body = await readJson(request);
    const items = Array.isArray(body.items) ? body.items : [];
    const countryCode = String(body.countryCode || '').toUpperCase();

    if (!countryCode) return json({ success: false, error: 'countryCode is required' }, 400);
    if (!items.length) return json({ success: false, error: 'At least one cart item is required' }, 400);

    // Items with no supplierVariantId (e.g. a product added before your
    // supplier_variant_id column was backfilled) can't be priced by CJ —
    // drop them from the CJ call rather than failing the whole quote, but
    // note it in the response so it's visible while you're testing this.
    const priceable = items.filter((i: any) => i && i.supplierVariantId && Number(i.quantity) > 0);
    const skipped = items.length - priceable.length;

    if (!priceable.length) {
      return json({ success: true, live: false, reason: 'no_priceable_items', skipped, ...FALLBACK_RATES });
    }

    const cacheKey = cacheKeyFor(countryCode, priceable);
    const cached = await db.from('shipping_quote_cache').select('*').eq('cache_key', cacheKey).maybeSingle();
    if (cached.data && Date.now() - new Date(cached.data.updated_at).getTime() < CACHE_TTL_MS) {
      return json({ success: true, live: true, cached: true, skipped, ...cached.data.quote });
    }

    // CJ prices the whole batch of products together in one call, but if a
    // single vid in that batch is invalid (delisted, mistyped, imported from
    // an old catalog snapshot), CJ rejects the ENTIRE request rather than
    // pricing the rest — which would otherwise mean one bad product in a
    // customer's cart kills the live quote for everything else in it too.
    //
    // So: try the full batch first. If CJ complains about a specific vid
    // ("...vid: 123..."), drop that one item and retry with what's left,
    // repeating until either CJ accepts the batch or we run out of items.
    //
    // CJ also enforces a strict rate limit (observed: 1 request/second) on
    // this endpoint. A dropped-item retry fired immediately after the first
    // call can itself get rejected for being "too many requests" rather than
    // for the vid — so every retry (whether dropping a bad vid or just
    // backing off from a rate limit) waits briefly first. Capped at a fixed
    // number of attempts so one troublesome cart can't hang the request.
    const RETRY_DELAY_MS = 1100;
    const MAX_ATTEMPTS = 8;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    let working = priceable.slice();
    const droppedVids: string[] = [];
    let raw: any = null;
    let lastError: Error | null = null;
    let attempts = 0;

    while (working.length && attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        raw = await cjRequest('/logistic/freightCalculate', {
          method: 'POST',
          body: JSON.stringify({
            startCountryCode: 'CN',
            endCountryCode: countryCode,
            products: working.map((i: any) => ({ vid: i.supplierVariantId, quantity: Number(i.quantity) }))
          })
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err as Error;

        if ((err as any).rateLimited) {
          // Not a bad item — CJ just wants us to slow down. Retry the same
          // batch after backing off, rather than dropping anything.
          if (attempts < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
          continue;
        }

        const badVid = /vid[:\s]+([0-9A-Za-z-]+)/i.exec(lastError.message)?.[1];
        // Only retry-by-dropping when the error names a specific bad vid we
        // can remove — for any other kind of failure (CJ down, auth expired,
        // unsupported country) removing an item wouldn't help, so stop and
        // fall through to the flat-rate fallback below.
        if (!badVid || !working.some((i: any) => i.supplierVariantId === badVid)) break;
        droppedVids.push(badVid);
        working = working.filter((i: any) => i.supplierVariantId !== badVid);
        if (working.length && attempts < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
      }
    }

    if (lastError || !raw) {
      // Either CJ failed for a reason unrelated to a specific bad vid, or
      // every item in the cart turned out to be unrecognised by CJ.
      console.error('shipping-quote: CJ call failed', lastError?.message, 'dropped:', droppedVids);
      return json({
        success: true,
        live: false,
        reason: lastError?.message || 'no_priceable_items_after_removal',
        skipped,
        droppedVids,
        ...FALLBACK_RATES
      });
    }

    const options2 = parseCjOptions(raw);
    if (!options2) {
      // CJ answered but had nothing shippable to this country (or the
      // response shape didn't match what parseCjOptions expects) — fall
      // back rather than blocking checkout.
      return json({ success: true, live: false, reason: 'no_cj_options', skipped, droppedVids, ...FALLBACK_RATES });
    }

    // Best-effort cache write — checkout must not fail if this insert fails.
    // Cached under the ORIGINAL cart contents (before any drops), since the
    // same cart will hit the same dropped items again until they're fixed.
    try {
      await db.from('shipping_quote_cache').upsert({
        cache_key: cacheKey,
        quote: options2,
        updated_at: new Date().toISOString()
      });
    } catch (_e) { /* non-fatal */ }

    // droppedVids.length > 0 here means: real, live shipping price for the
    // rest of the cart, but one or more items couldn't be priced by CJ and
    // weren't included in this total — surfaced so you can decide whether
    // to fix those products' variant IDs or leave the flat rate absorbing them.
    return json({ success: true, live: true, cached: false, skipped, droppedVids, ...options2 });
  } catch (error) {
    console.error('shipping-quote error:', error);
    // Any failure (CJ down, rate-limited, bad vid, auth expired on CJ's
    // side) — never block checkout. Report the flat fallback instead.
    return json({ success: true, live: false, reason: (error as Error).message, ...FALLBACK_RATES });
  }
});