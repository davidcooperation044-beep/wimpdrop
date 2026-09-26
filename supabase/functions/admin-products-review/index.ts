import { db, handleOptions, json, readJson, requireAdmin } from '../_shared/cj.ts';

const VALID_ACTIONS = new Set(['publish', 'unpublish', 'delete', 'update']);

function asIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function orderReferencesProduct(order: any, productId: string): boolean {
  const lines = [
    ...(Array.isArray(order.items) ? order.items : []),
    ...(Array.isArray(order.order_items) ? order.order_items : [])
  ];
  return lines.some((line: any) => [
    line?.id,
    line?.product_id,
    line?.productId,
    line?.supplier_product_id,
    line?.supplierProductId,
    line?.supplier_variant_id,
    line?.supplierVariantId
  ].some((value) => String(value || '') === productId));
}

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;

  try {
    await requireAdmin(request);
    const body = await readJson(request);
    const action = String(body.action || '').toLowerCase();
    const productIds = asIds(body.productId ?? body.productIds);

    if (!VALID_ACTIONS.has(action)) {
      return json({ success: false, error: 'Invalid action. Use publish, unpublish, delete, or update.' }, 400);
    }
    if (!productIds.length) {
      return json({ success: false, error: 'productId or productIds is required.' }, 400);
    }

    if (action === 'update') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const price = Number(body.price);
      if (!name || !Number.isFinite(price) || price < 0) {
        return json({ success: false, error: 'Update requires a non-empty name and non-negative numeric price.' }, 400);
      }

      // The caller (admin UI) already resolves which rows belong together —
      // e.g. every variant row sharing one supplier_product_id — and passes
      // that full set of ids here, so this just applies the same name/price
      // to all of them directly, in one call, instead of us re-deriving
      // sibling rows from a single id.
      const { data: updated, error: updateError } = await db
        .from('products')
        .update({ name, title: name, price })
        .in('id', productIds)
        .select();
      if (updateError) throw updateError;

      return json({ success: true, action, updatedCount: updated?.length || 0, products: updated || [] });
    }

    if (action === 'delete') {
      const { data: orders, error: orderError } = await db.from('orders').select('id,items,order_items');
      if (orderError) throw orderError;
      const blocked = productIds.filter((productId) => (orders || []).some((order) => orderReferencesProduct(order, productId)));
      const deletable = productIds.filter((productId) => !blocked.includes(productId));
      if (deletable.length) {
        const { error } = await db.from('products').delete().in('id', deletable);
        if (error) throw error;
      }
      return json({
        success: blocked.length === 0,
        action,
        deleted: deletable,
        blocked,
        error: blocked.length ? `Cannot delete products referenced by existing orders: ${blocked.join(', ')}. Unpublish them instead.` : undefined
      }, blocked.length ? 409 : 200);
    }

    const values = action === 'publish'
      ? { is_published: true, sync_status: 'active' }
      : { is_published: false, sync_status: 'draft' };
    const { data, error } = await db.from('products').update(values).in('id', productIds).select('id,is_published,sync_status');
    if (error) throw error;
    return json({ success: true, action, products: data || [] });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 403);
  }
});