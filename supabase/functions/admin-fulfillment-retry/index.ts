import { db, handleOptions, json, readJson, requireAdmin } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    if (body.orderId) {
      const { error } = await db.from('orders').update({ fulfillment_status: 'retry_pending', fulfillment_next_retry_at: new Date().toISOString(), fulfillment_last_error: null }).eq('id', body.orderId).eq('fulfillment_status', 'fulfillment_failed');
      if (error) throw error;
    }
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fulfillment-retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': Deno.env.get('CRON_SECRET') || '' },
      body: '{}'
    });
    return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 403);
  }
});
