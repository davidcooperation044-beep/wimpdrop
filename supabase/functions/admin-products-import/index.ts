import { cjRequest, db, handleOptions, json, readJson, requireAdmin } from '../_shared/cj.ts';

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
    const products = Array.isArray(result.data) ? result.data : (result.data?.list || result.data?.content || []);
    const { data: settings } = await db.from('integration_settings').select('value').eq('key', 'cj').maybeSingle();
    const markupPercent = Number(settings?.value?.markup_percent ?? 30);
    const rows = products.flatMap((product: any) => {
      const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : [product];
      return variants.map((variant: any) => {
        const supplierCost = Number(variant.sellPrice || variant.price || product.sellPrice || product.price || 0);
        return {
          name: product.productName || product.name || product.title || 'CJ product',
          description: product.description || '',
          category: product.categoryName || body.category || 'CJ Import',
          price: Number((supplierCost * (1 + markupPercent / 100)).toFixed(2)),
          supplier: 'cj',
          supplier_product_id: product.pid || product.productId || null,
          supplier_variant_id: variant.vid || variant.variantId || null,
          supplier_sku: variant.variantSku || variant.sku || product.productSku || product.sku || null,
          supplier_cost: supplierCost,
          stock_quantity: Number(variant.stock || product.stock || product.inventory || 0),
          image_url: variant.variantImage || product.productImage || product.image || product.thumbnail || null,
          is_published: false,
          sync_status: 'draft'
        };
      });
    });
    if (rows.length) {
      const { error } = await db.from('products').upsert(rows, { onConflict: 'supplier,supplier_variant_id' });
      if (error) throw error;
    }
    return json({ success: true, imported: rows.length, requiresReview: true, source: result });
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