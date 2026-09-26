import { cjRequest, db, handleOptions, json, readJson, requireAdmin } from '../_shared/cj.ts';

function parsePrice(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const str = String(raw ?? '').trim();
  if (!str) return 0;
  const first = str.split('--')[0].trim();
  const num = Number(first);
  return Number.isFinite(num) ? num : 0;
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

    // CJ nests the real product list inside data.content[].productList,
    // with one or more category-grouped wrappers per page.
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

    const rows = products.map((product: any) => {
      const supplierCost = parsePrice(product.sellPrice ?? product.nowPrice ?? 0);
      const productId = product.id ?? product.pid ?? null;
      return {
        name: product.nameEn || product.name || 'CJ product',
        description: product.description || '',
        category: product.__categoryName || body.category || 'CJ Import',
        price: Number((supplierCost * (1 + markupPercent / 100)).toFixed(2)),
        supplier: 'cj',
        supplier_product_id: productId,
        supplier_variant_id: productId,
        supplier_sku: product.sku || null,
        supplier_cost: supplierCost,
        stock_quantity: Number(product.warehouseInventoryNum || 0),
        image_url: product.bigImage || null,
        is_published: false,
        sync_status: 'draft'
      };
    }).filter((row) => row.supplier_variant_id);

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