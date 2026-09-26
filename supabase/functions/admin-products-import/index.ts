import { cjRequest, db, handleOptions, json, readJson, requireAdmin } from '../_shared/cj.ts';

function parsePrice(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const str = String(raw ?? '').trim();
  if (!str) return 0;
  const first = str.split('--')[0].trim();
  const num = Number(first);
  return Number.isFinite(num) ? num : 0;
}

// CJ's variantKey is usually something like "Black-XL" or "Red,S", matching
// the order of the product's variant property names (e.g. "Color-Size").
// Since the exact delimiter and order vary by product, we parse defensively:
// split on common separators, then classify each piece as size or color
// using keyword lists rather than trusting position.
const SIZE_TOKENS = new Set([
  'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl', '5xl',
  'small', 'medium', 'large', 'extra large', 'extra small'
]);

function looksLikeSize(token: string): boolean {
  const clean = token.trim().toLowerCase();
  if (SIZE_TOKENS.has(clean)) return true;
  // numeric sizes like "38", "40", "9.5", or "eu 42"
  if (/^\d+(\.\d+)?$/.test(clean)) return true;
  if (/^(eu|us|uk)\s?\d+(\.\d+)?$/.test(clean)) return true;
  return false;
}

function parseVariantAttributes(variantKey: string | null | undefined, variantNameEn: string | null | undefined): { color: string | null; size: string | null } {
  const source = (variantKey || variantNameEn || '').trim();
  if (!source) return { color: null, size: null };

  // Try common delimiters CJ uses between attribute values.
  const parts = source.split(/[-,;/]+/).map((p) => p.trim()).filter(Boolean);

  let color: string | null = null;
  let size: string | null = null;

  for (const part of parts) {
    if (looksLikeSize(part)) {
      if (!size) size = part;
    } else if (!color) {
      color = part;
    }
  }

  // If we only found one token and couldn't classify it, treat it as color
  // by default (color is the more common single-attribute case).
  if (parts.length === 1 && !size && !color) {
    color = parts[0];
  }

  return { color, size };
}

async function fetchVariants(productId: string): Promise<any[]> {
  try {
    const detail = await cjRequest(`/product/query?pid=${encodeURIComponent(productId)}`);
    const variants = Array.isArray(detail.data?.variants) ? detail.data.variants : [];
    return variants;
  } catch (error) {
    console.error(`Failed to fetch variants for product ${productId}:`, (error as Error).message);
    return [];
  }
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    const params = new URLSearchParams({
      page: String(body.page || 1),
      size: String(Math.min(Number(body.size || 20), 100))
    });
    if (body.keyword) params.set('keyWord', String(body.keyword));
    if (body.categoryId) params.set('categoryId', String(body.categoryId));
    if (body.countryCode) params.set('countryCode', String(body.countryCode));

    const result = await cjRequest(`/product/listV2?${params.toString()}`);

    const contentGroups = Array.isArray(result.data?.content) ? result.data.content : [];
    const products = contentGroups.flatMap((group: any) => {
      const list = Array.isArray(group.productList) ? group.productList : [];
      const categoryLookup = new Map(
        (Array.isArray(group.relatedCategoryList) ? group.relatedCategoryList : []).map((c: any) => [c.id, c.name])
      );
      return list.map((product: any) => ({ ...product, __categoryName: categoryLookup.get(product.categoryId) }));
    });

    const { data: settings } = await db.from('integration_settings').select('value').eq('key', 'cj').maybeSingle();
    const markupPercent = Number(settings?.value?.markup_percent ?? 30);

    const rows: any[] = [];
    // Track the sell price already assigned to each (product, size) pair,
    // so every color sharing that size gets the identical price.
    const sizePriceMap = new Map<string, number>();

    for (const product of products) {
      const productId = product.id ?? product.pid ?? null;
      if (!productId) continue;

      const category = product.__categoryName || body.category || 'CJ Import';
      const baseName = product.nameEn || product.name || 'CJ product';
      const fallbackCost = parsePrice(product.sellPrice ?? product.nowPrice ?? 0);

      const variants = await fetchVariants(productId);

      if (!variants.length) {
        // No variant breakdown available — import as a single row, same
        // behavior as before.
        const supplierCost = fallbackCost;
        rows.push({
          name: baseName,
          title: baseName,
          description: product.description || '',
          category,
          price: Number((supplierCost * (1 + markupPercent / 100)).toFixed(2)),
          supplier: 'cj',
          supplier_product_id: productId,
          supplier_variant_id: productId,
          supplier_sku: product.sku || null,
          supplier_cost: supplierCost,
          stock_quantity: Number(product.warehouseInventoryNum || 0),
          image_url: product.bigImage || null,
          variant_color: null,
          variant_size: null,
          is_published: false,
          sync_status: 'draft'
        });
        continue;
      }

      for (const variant of variants) {
        const vid = variant.vid ?? variant.variantId ?? null;
        if (!vid) continue;

        const { color, size } = parseVariantAttributes(variant.variantKey, variant.variantNameEn);
        const supplierCost = parsePrice(variant.variantSellPrice ?? fallbackCost);

        // Determine price: if another variant of this product with the
        // same size already got a price, reuse it. Otherwise calculate
        // fresh from this variant's cost.
        const sizeKey = `${productId}::${size ?? '__no_size__'}`;
        let price: number;
        if (sizePriceMap.has(sizeKey)) {
          price = sizePriceMap.get(sizeKey)!;
        } else {
          price = Number((supplierCost * (1 + markupPercent / 100)).toFixed(2));
          sizePriceMap.set(sizeKey, price);
        }

        rows.push({
          name: baseName,
          title: baseName,
          description: product.description || '',
          category,
          price,
          supplier: 'cj',
          supplier_product_id: productId,
          supplier_variant_id: vid,
          supplier_sku: variant.variantSku || null,
          supplier_cost: supplierCost,
          stock_quantity: Number(variant.variantStock || product.warehouseInventoryNum || 0),
          image_url: variant.variantImage || product.bigImage || null,
          variant_color: color,
          variant_size: size,
          is_published: false,
          sync_status: 'draft'
        });
      }
    }

    if (rows.length) {
      const { error } = await db.from('products').upsert(rows, { onConflict: 'supplier,supplier_variant_id' });
      if (error) throw error;
    }
    return json({ success: true, imported: rows.length, requiresReview: true, totalMatches: result.data?.totalRecords ?? rows.length });
  } catch (error) {
    const err = error as any;
    if (err?.rateLimited) {
      return json({
        success: false,
        error: 'CJ is rate-limiting this account right now. Please wait a few seconds and try again.',
        retryable: true
      }, 429);
    }
    return json({ success: false, error: err?.message || String(error) }, 400);
  }
});