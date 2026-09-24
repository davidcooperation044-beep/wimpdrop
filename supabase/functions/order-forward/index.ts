import { db, handleOptions, json } from '../_shared/cj.ts';
import { getSupplierAdapter } from '../_shared/cj-adapter.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'Internal function' }, 401);
  const { orderId } = await request.json().catch(() => ({}));
  if (!orderId) return json({ success: false, error: 'orderId is required' }, 400);

  const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) return json({ success: false, error: 'Order not found' }, 404);
  const attempt = Number(order.fulfillment_attempts || 0) + 1;
  await db.from('orders').update({ fulfillment_status: 'processing', fulfillment_attempts: attempt, fulfillment_updated_at: new Date().toISOString() }).eq('id', orderId);

  try {
    const supplier = getSupplierAdapter(order.supplier || 'cj');
    const items = Array.isArray(order.items) ? order.items : (Array.isArray(order.order_items) ? order.order_items : []);
    const resolvedItems = await Promise.all(items.map(async (item: any) => {
      if (item.supplier_variant_id) return item;
      const { data: product } = await db.from('products').select('supplier_variant_id,supplier_product_id').eq('id', item.id).maybeSingle();
      return { ...item, ...product };
    }));
    const address = order.shipping_address || {};
    const result = await supplier.createOrder({
      orderNumber: order.order_number || order.id,
      address: {
        name: `${address.firstName || address.first_name || ''} ${address.lastName || address.last_name || ''}`.trim(),
        email: address.email || '', phone: address.phone || '', street: address.street || '',
        city: address.city || '', state: address.state || address.province || '',
        postal: address.postal || '', country: address.country || 'NG'
      },
      items: resolvedItems.map((item: any) => ({ id: String(item.id), supplierVariantId: item.supplier_variant_id, quantity: item.quantity }))
    });
    const supplierOrderId = result.supplierOrderId;
    await db.from('orders').update({ supplier: 'cj', supplier_order_id: supplierOrderId, fulfillment_status: 'submitted', fulfillment_updated_at: new Date().toISOString(), fulfillment_last_error: null }).eq('id', orderId);
    await db.from('fulfillment_events').insert({ order_id: orderId, event_type: 'order_forward', attempt, status: 'success', response: result });
    return json({ success: true, supplierOrderId });
  } catch (error) {
    const maxed = attempt >= 3;
    const nextRetry = new Date(Date.now() + Math.min(60, 2 ** attempt * 5) * 60 * 1000).toISOString();
    await db.from('orders').update({ fulfillment_status: maxed ? 'fulfillment_failed' : 'retry_pending', fulfillment_next_retry_at: maxed ? null : nextRetry, fulfillment_last_error: (error as Error).message, fulfillment_updated_at: new Date().toISOString() }).eq('id', orderId);
    await db.from('fulfillment_events').insert({ order_id: orderId, event_type: 'order_forward', attempt, status: 'failed', error: (error as Error).message });
    if (maxed) {
      await db.from('admin_alerts').insert({
        alert_type: 'fulfillment_failed',
        order_id: orderId,
        message: `CJ fulfillment failed after ${attempt} attempts: ${(error as Error).message}`
      });
    }
    return json({ success: false, retryScheduled: !maxed, error: (error as Error).message }, 502);
  }
});
