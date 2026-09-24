import { db, handleOptions, json, requireAdmin } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    await requireAdmin(request);
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/stock-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': Deno.env.get('CRON_SECRET') || '' },
      body: '{}'
    });
    return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 403);
  }
});
