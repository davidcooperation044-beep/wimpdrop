import { completeCjAuthorization, handleOptions, json, requireAdmin, readJson, startCjAuthorization } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    if (body.action === 'start') return json(await startCjAuthorization());
    if (body.action === 'complete' && body.oauthCode) return json(await completeCjAuthorization(body.oauthCode));
    return json({ error: 'action must be start or complete' }, 400);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});
