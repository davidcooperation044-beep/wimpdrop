import { authenticateWithApiKey, handleOptions, json, requireAdmin } from '../_shared/cj.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request);
  if (options) return options;
  try {
    await requireAdmin(request);
    return json({ success: true, data: await authenticateWithApiKey() });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});
