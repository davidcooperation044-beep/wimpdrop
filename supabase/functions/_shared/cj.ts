import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const CJ_BASE_URL = Deno.env.get('CJ_API_BASE_URL') || 'https://developers.cjdropshipping.com/api2.0/v1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }
  });
}

export function handleOptions(request: Request): Response | null {
  return request.method === 'OPTIONS' ? new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }
  }) : null;
}

export async function requireAdmin(request: Request): Promise<void> {
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Authentication required');

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error('Authentication required');

  const { data: profile, error: profileError } = await db
    .from('user_profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new Error('Admin access required');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cjFetch(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${CJ_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
  if (!response.ok || body?.result === false || body?.success === false) {
    const message = body?.message || `CJ request failed (${response.status})`;
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).response = body;
    (error as any).rateLimited = response.status === 429 || /too many requests|ip limit/i.test(message);
    throw error;
  }
  return body;
}

async function saveTokens(data: any): Promise<void> {
  if (!data?.accessToken || !data?.refreshToken || !data?.openId) {
    throw new Error('CJ authentication response did not include the complete token set');
  }
  const accessExpiry = data.accessTokenExpiryDate || new Date(Date.now() + 180 * 86400000).toISOString();
  const refreshExpiry = data.refreshTokenExpiryDate || new Date(Date.now() + 180 * 86400000).toISOString();
  const { error } = await db.from('cj_token_cache').upsert({
    id: true,
    open_id: String(data.openId),
    access_token: data.accessToken,
    refresh_token: data.refreshToken,
    access_token_expires_at: accessExpiry,
    refresh_token_expires_at: refreshExpiry,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

// --- Auth lock: prevents concurrent requests from each firing their own
// CJ getAccessToken call, which is what trips CJ's "N users per IP" cap. ---

const LOCK_TTL_MS = 20000;
const LOCK_POLL_INTERVAL_MS = 500;
const LOCK_WAIT_TIMEOUT_MS = 15000;

async function acquireAuthLock(): Promise<boolean> {
  const cutoff = new Date(Date.now() - LOCK_TTL_MS).toISOString();
  const { data, error } = await db
    .from('cj_auth_lock')
    .update({ locked_at: new Date().toISOString() })
    .eq('id', true)
    .or(`locked_at.is.null,locked_at.lt.${cutoff}`)
    .select('id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function releaseAuthLock(): Promise<void> {
  await db.from('cj_auth_lock').update({ locked_at: null }).eq('id', true);
}

async function waitForFreshToken(since: number): Promise<string | null> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(LOCK_POLL_INTERVAL_MS);
    const { data } = await db.from('cj_token_cache').select('*').eq('id', true).maybeSingle();
    if (data && new Date(data.updated_at).getTime() >= since && new Date(data.access_token_expires_at).getTime() > Date.now()) {
      return data.access_token;
    }
  }
  return null;
}

export async function getCjAccessToken(forceRefresh = false): Promise<string> {
  const { data, error } = await db.from('cj_token_cache').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  const refreshWindow = Date.now() + 5 * 60 * 1000;
  if (!forceRefresh && data && new Date(data.access_token_expires_at).getTime() > refreshWindow) {
    return data.access_token;
  }

  const requestStart = Date.now();
  const gotLock = await acquireAuthLock();
  if (!gotLock) {
    // Another invocation is already authenticating/refreshing. Wait for it
    // instead of also calling CJ, to avoid tripping the per-IP session cap.
    const token = await waitForFreshToken(requestStart);
    if (token) return token;
    // Fell through: the other invocation didn't finish in time or failed.
    // Try to acquire the lock ourselves before giving up.
    const gotLockRetry = await acquireAuthLock();
    if (!gotLockRetry) {
      throw new Error('CJ authentication is already in progress. Please try again in a few seconds.');
    }
  }

  try {
    if (!data?.refresh_token || new Date(data.refresh_token_expires_at).getTime() <= Date.now()) {
      const authenticated = await authenticateWithApiKey();
      return authenticated.data.accessToken;
    }
    try {
      const refreshed = await cjFetch('/authentication/refreshAccessToken', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: data.refresh_token })
      });
      await saveTokens(refreshed.data);
      return refreshed.data.accessToken;
    } catch (err) {
      const response = (err as any).response;
      if ((err as any).status === 401 || response?.code === 1600001 || /refresh token/i.test((err as Error).message)) {
        const authenticated = await authenticateWithApiKey();
        return authenticated.data.accessToken;
      }
      throw err;
    }
  } finally {
    await releaseAuthLock();
  }
}

export async function authenticateWithApiKey(): Promise<any> {
  const apiKey = Deno.env.get('CJ_API_KEY');
  if (!apiKey) throw new Error('CJ_API_KEY secret is not configured');
  const result = await cjFetch('/authentication/getAccessToken', {
    method: 'POST',
    body: JSON.stringify({ apiKey })
  });
  await saveTokens(result.data);
  return result;
}

export async function cjRequest(path: string, init: RequestInit = {}): Promise<any> {
  let token = await getCjAccessToken();
  try {
    return await cjFetch(path, {
      ...init,
      headers: { ...(init.headers || {}), 'CJ-Access-Token': token }
    });
  } catch (error) {
    if ((error as any).status === 401 || (error as any).response?.code === 1600001) {
      token = await getCjAccessToken(true);
      return cjFetch(path, {
        ...init,
        headers: { ...(init.headers || {}), 'CJ-Access-Token': token }
      });
    }
    throw error;
  }
}

export async function readJson(request: Request): Promise<any> {
  try { return await request.json(); } catch { return {}; }
}