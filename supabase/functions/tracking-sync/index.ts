import { db, handleOptions, json } from '../_shared/cj.ts';
import { getSupplierAdapter } from '../_shared/cj-adapter.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const secret = Deno.env.get('CRON_SECRET') || '';
  if (!secret || request.headers.get('x-cron-secret') !== secret) return json({ error: 'Internal function' }, 401);
  const { data: orders, error } = await db.from('orders').select('id,supplier_order_id').eq('supplier', 'cj').not('supplier_order_id', 'is', null).not('fulfillment_status', 'in', '(delivered,cancelled)').limit(100);
  if (error) return json({ success: false, error: error.message }, 500);
  let updated = 0;
  const supplier = getSupplierAdapter('cj');
  for (const order of orders || []) {
    try {
      const tracking = await supplier.getTracking(order.supplier_order_id);
      await db.from('orders').update({ tracking_number: tracking.trackingNumber, carrier: tracking.carrier, status: tracking.status, fulfillment_updated_at: new Date().toISOString() }).eq('id', order.id);
      updated += 1;
    } catch {
      // A single CJ order should not prevent other tracking records from syncing.
    }
  }
  return json({ success: true, updated });
});
