import { db, handleOptions, json } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  const secret = Deno.env.get('CRON_SECRET') || '';
  if (!secret || request.headers.get('x-cron-secret') !== secret) return json({ error: 'Internal function' }, 401);
  const { data: orders, error } = await db.from('orders').select('id').in('fulfillment_status', ['pending', 'retry_pending']).lte('fulfillment_next_retry_at', new Date().toISOString()).limit(50);
  if (error) return json({ success: false, error: error.message }, 500);
  let attempted = 0;
  for (const order of orders || []) {
    attempted += 1;
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/order-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify({ orderId: order.id })
    });
  }
  return json({ success: true, attempted });
});
