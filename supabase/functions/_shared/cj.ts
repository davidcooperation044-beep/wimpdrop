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
  const metadata = data.user.app_metadata || {};
  const userMetadata = data.user.user_metadata || {};
  if (metadata.is_admin !== true && userMetadata.is_admin !== true && userMetadata.role !== 'admin') {
    throw new Error('Admin access required');
  }
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
    const error = new Error(body?.message || `CJ request failed (${response.status})`);
    (error as any).status = response.status;
    (error as any).response = body;
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

export async function getCjAccessToken(forceRefresh = false): Promise<string> {
  const { data, error } = await db.from('cj_token_cache').select('*').eq('id', true).maybeSingle();
  if (error) throw error;
  const refreshWindow = Date.now() + 5 * 60 * 1000;
  if (!forceRefresh && data && new Date(data.access_token_expires_at).getTime() > refreshWindow) {
    return data.access_token;
  }
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
  } catch (error) {
    const response = (error as any).response;
    if ((error as any).status === 401 || response?.code === 1600001 || /refresh token/i.test((error as Error).message)) {
      const authenticated = await authenticateWithApiKey();
      return authenticated.data.accessToken;
    }
    throw error;
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
