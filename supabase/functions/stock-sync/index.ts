import { db, handleOptions, json } from '../_shared/cj.ts';
import { getSupplierAdapter } from '../_shared/cj-adapter.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const THROTTLE_MS = 300;

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Internal function' }, 401);

  const started = new Date().toISOString();
  const { data: run, error: runError } = await db.from('supplier_sync_runs').insert({ supplier: 'cj', sync_type: 'stock', status: 'running' }).select().single();
  if (runError) return json({ success: false, error: runError.message }, 500);
  let checked = 0;
  let changed = 0;
  try {
    const supplier = getSupplierAdapter('cj');
    const { data: products, error } = await db.from('products').select('id,supplier_variant_id,supplier_product_id,supplier_cost,price').eq('supplier', 'cj').not('supplier_variant_id', 'is', null);
    if (error) throw error;
    let first = true;
    for (const product of products || []) {
      if (!first) await sleep(THROTTLE_MS);
      first = false;
      const stockResult = await supplier.getStock(product.supplier_variant_id);
      const supplierCost = product.supplier_product_id ? await supplier.getPrice(product.supplier_product_id) : Number(product.supplier_cost || 0);
      const stock = stockResult.quantity;
      const available = stock > 0;
      const { data: settings } = await db.from('integration_settings').select('value').eq('key', 'cj').maybeSingle();
      const markupPercent = Number(settings?.value?.markup_percent ?? 30);
      const { error: updateError } = await db.from('products').update({
        stock_quantity: stock,
        supplier_cost: supplierCost,
        price: Number((supplierCost * (1 + markupPercent / 100)).toFixed(2)),
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        is_published: available
      }).eq('id', product.id);
      if (updateError) throw updateError;
      checked += 1;
      changed += 1;
    }
    await db.from('supplier_sync_runs').update({ status: 'success', finished_at: new Date().toISOString(), products_checked: checked, products_changed: changed }).eq('id', run.id);
    return json({ success: true, started, checked, changed });
  } catch (error) {
    await db.from('supplier_sync_runs').update({ status: 'failed', finished_at: new Date().toISOString(), products_checked: checked, products_changed: changed, error: (error as Error).message }).eq('id', run.id);
    return json({ success: false, error: (error as Error).message, checked }, 502);
  }
});