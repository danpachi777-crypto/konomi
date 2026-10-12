// Optional Supabase REST adapter. User writes always use the user's bearer token,
// NEVER the service-role key, so Postgres RLS remains the security boundary.
const knownIds = new Set(require('./assets/photo-sources.json').items.map((item) => item.id));

function validateBase(value, allowLocal = false) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(allowLocal && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) {
    throw new Error('Use a trusted HTTPS origin or an explicit loopback HTTP origin');
  }
  return url.origin;
}

function createCloudApi({ env = process.env, fetchImpl = fetch } = {}) {
  let configured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
  let base = '';
  try { if (configured) base = validateBase(env.SUPABASE_URL, true); }
  catch { configured = false; }
  async function call(route, { token, method = 'GET', body, prefer } = {}) {
    const result = await fetchImpl(base + route, {
      method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(prefer ? { Prefer: prefer } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!result.ok) {
      const error = new Error('Supabase request failed');
      error.status = [401, 403].includes(result.status) || (route.startsWith('/auth/v1/token?') && result.status === 400) ? 401
        : route === '/auth/v1/signup' && result.status === 400 ? 400 : 502;
      throw error;
    }
    const text = await result.text();
    return text ? JSON.parse(text) : null;
  }
  async function handle(route, method, input = {}, authorization = '') {
    if (route === '/api/cloud/config' && method === 'GET') return { status: 200, body: { configured } };
    if (!configured) return { status: 503, body: { error: 'Supabase未設定です。ブラウザ内の保存は継続できます。' } };
    try {
      if (route === '/api/cloud/login' && method === 'POST') {
        if (typeof input.email !== 'string' || input.email.length > 254 || typeof input.password !== 'string' ||
            !input.password || input.password.length > 1024 || Object.keys(input).some((key) => !['email', 'password'].includes(key))) {
          return { status: 400, body: { error: 'メールアドレスとパスワードを確認してください。' } };
        }
        const session = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: input });
        return { status: 200, body: sessionFields(session) };
      }
      if (route === '/api/cloud/signup' && method === 'POST') {
        if (typeof input.email !== 'string' || input.email.length > 254 || typeof input.password !== 'string' ||
            input.password.length < 6 || input.password.length > 1024 || Object.keys(input).some((key) => !['email', 'password'].includes(key))) {
          return { status: 400, body: { error: 'メールアドレスと6文字以上のパスワードを確認してください。' } };
        }
        const result = await call('/auth/v1/signup', { method: 'POST', body: input });
        return { status: 200, body: result?.access_token && result?.refresh_token
          ? sessionFields(result) : { confirmationRequired: true } };
      }
      if (route === '/api/cloud/refresh' && method === 'POST') {
        if (typeof input.refresh_token !== 'string' || !input.refresh_token || input.refresh_token.length > 4096)
          return { status: 400, body: { error: 'Invalid refresh token' } };
        return { status: 200, body: sessionFields(await call('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', body: { refresh_token: input.refresh_token } })) };
      }
      const token = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorization)?.[1];
      if (!token || token.length > 8192) return { status: 401, body: { error: 'ログインが必要です。' } };
      // Do not trust a client-supplied user_id or merely decode an unverified JWT.
      const user = await call('/auth/v1/user', { token });
      if (!user?.id) return { status: 401, body: { error: 'Invalid session' } };
      if (route === '/api/cloud/logout' && method === 'POST') {
        await call('/auth/v1/logout?scope=local', { method: 'POST', token });
        return { status: 200, body: { ok: true } };
      }
      if (route !== '/api/swipes') return { status: 404, body: { error: 'Not found' } };
      if (method === 'GET') {
        return { status: 200, body: { swipes: await call('/rest/v1/swipes?select=fashion_item_id,action,created_at,updated_at&user_id=eq.' +
          encodeURIComponent(user.id) + '&order=updated_at.desc&limit=1000', { token }) } };
      }
      if (!knownIds.has(input.fashionItemId) || Object.keys(input).some((key) => !['fashionItemId', 'action'].includes(key)))
        return { status: 400, body: { error: 'Invalid registered fashion item' } };
      if (method === 'POST') {
        if (!['like', 'dislike', 'skip'].includes(input.action)) return { status: 400, body: { error: 'Invalid swipe action' } };
        await call('/rest/v1/swipes?on_conflict=user_id,fashion_item_id', { token, method: 'POST',
          body: { user_id: user.id, fashion_item_id: input.fashionItemId, action: input.action },
          prefer: 'resolution=merge-duplicates,return=minimal' });
        return { status: 200, body: { saved: true } };
      }
      if (method === 'DELETE') {
        await call('/rest/v1/swipes?user_id=eq.' + encodeURIComponent(user.id) + '&fashion_item_id=eq.' +
          encodeURIComponent(input.fashionItemId), { token, method: 'DELETE', prefer: 'return=minimal' });
        return { status: 200, body: { deleted: true } };
      }
      return { status: 405, body: { error: 'Method not allowed' } };
    } catch (error) {
      return { status: error.status || 503, body: { error: 'クラウド保存／認証に失敗しました。ローカルの回答は保持しています。' } };
    }
  }
  return { handle, configured };
}

function sessionFields(session) {
  if (!session?.access_token || !session.refresh_token || !session.user?.id) throw new Error('Invalid Supabase session');
  return { access_token: session.access_token, refresh_token: session.refresh_token,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in,
    user: { id: session.user.id } };
}

async function fashionclipStatus({ env = process.env, fetchImpl = fetch } = {}) {
  if (!env.FASHIONCLIP_BASE_URL) return { configured: false, ready: false };
  try {
    const base = validateBase(env.FASHIONCLIP_BASE_URL, true);
    const response = await fetchImpl(base + '/health', { redirect: 'error', signal: AbortSignal.timeout(2000) });
    const result = await response.json();
    if (!response.ok || result.ready !== true || result.model !== 'patrickjohncyh/fashion-clip' || result.dimension !== 512 ||
        typeof result.modelVersion !== 'string') throw new Error('Invalid health');
    return { configured: true, ready: true, model: result.model, modelVersion: result.modelVersion };
  } catch {
    return { configured: true, ready: false, error: 'FashionCLIPは停止中または準備未完了です。既存アプリは継続できます。' };
  }
}
module.exports = { createCloudApi, fashionclipStatus, validateBase };
