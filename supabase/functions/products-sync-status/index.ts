import { db, handleOptions, json, requireAdmin } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    await requireAdmin(request);
    const [{ data: run }, { count: outOfSync, error: countError }] = await Promise.all([
      db.from('supplier_sync_runs').select('*').eq('supplier', 'cj').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('products').select('id', { count: 'exact', head: true }).eq('supplier', 'cj').neq('sync_status', 'success')
    ]);
    if (countError) throw countError;
    return json({ success: true, lastRun: run, outOfSync: outOfSync || 0 });
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 403);
  }
});
