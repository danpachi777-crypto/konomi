const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createCloudApi, fashionclipStatus } = require('../cloud-api.js');
const { createSync } = require('../cloud-sync.js');
const { precompute, loadRegisteredItems, validateVector } = require('../scripts/precompute-fashionclip.cjs');
const env = { SUPABASE_URL: 'https://db.example.com', SUPABASE_ANON_KEY: 'public-test-key', SUPABASE_SERVICE_ROLE_KEY: 'admin-test-key' };
const respond = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body,
  text: async () => body == null ? '' : JSON.stringify(body) });
const storage = () => { const values = new Map(); return { getItem: (key) => values.get(key) || null,
  setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }; };

test('未設定・FashionCLIP停止中でもエラーを局所化し、外部AIへフォールバックしない', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Offline'); };
  const api = createCloudApi({ env: {}, fetchImpl });
  assert.equal((await api.handle('/api/cloud/config', 'GET')).body.configured, false);
  assert.equal((await api.handle('/api/swipes', 'POST', {})).status, 503);
  assert.equal(calls, 0);
  assert.equal((await fashionclipStatus({ env: { FASHIONCLIP_BASE_URL: 'http://127.0.0.1:8001' }, fetchImpl })).ready, false);
});

test('スワイプは検証済みAuthユーザーのJWTでupsertし、service-roleを使用しない', async () => {
  const calls = [];
  const api = createCloudApi({ env, fetchImpl: async (url, options) => {
    calls.push({ url, ...options });
    return respond(url.endsWith('/auth/v1/user') ? { id: 'user-a' } : null);
  } });
  assert.equal((await api.handle('/api/swipes', 'POST', { fashionItemId: 'men-clean-01', action: 'skip' }, 'Bearer user.jwt')).status, 200);
  const write = calls.at(-1);
  assert.deepEqual(JSON.parse(write.body), { user_id: 'user-a', fashion_item_id: 'men-clean-01', action: 'skip' });
  assert.equal(write.headers.Authorization, 'Bearer user.jwt');
  assert.equal(write.headers.apikey, 'public-test-key');
  assert.ok(write.url.includes('on_conflict=user_id,fashion_item_id'));
  assert.equal((await api.handle('/api/swipes', 'POST', { fashionItemId: 'men-clean-01', action: 'like', user_id: 'user-b' }, 'Bearer user.jwt')).status, 400);
  assert.equal((await api.handle('/api/swipes', 'POST', { fashionItemId: 'men-clean-01', action: 'no' }, 'Bearer user.jwt')).status, 400);
  assert.equal((await api.handle('/api/swipes', 'POST', {}, '')).status, 401);
  assert.equal((await api.handle('/api/swipes', 'DELETE', { fashionItemId: 'men-clean-01' }, 'Bearer user.jwt')).status, 200);
  assert.ok(calls.at(-1).url.includes('user_id=eq.user-a'));
});

test('認証に失敗したトークンではDBへの書き込みを行わない', async () => {
  const calls = [];
  const api = createCloudApi({ env, fetchImpl: async (url) => { calls.push(url); return respond({ error: 'invalid' }, 401); } });
  assert.equal((await api.handle('/api/swipes', 'POST', { fashionItemId: 'men-clean-01', action: 'like' }, 'Bearer invalid')).status, 401);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('/auth/v1/user'));
});

test('クラウド同期はskipを保持し、失敗した回答・undoをユーザー別に再送できる', async () => {
  const local = storage(), sessionStore = storage();
  const statuses = [], writes = [];
  let fail = true;
  const sync = createSync({ storage: local, sessionStorage: sessionStore, onStatus: (value) => statuses.push(value),
    fetchImpl: async (url, options) => {
      if (url === '/api/cloud/config') return respond({ configured: true });
      if (url === '/api/cloud/login') return respond({ user: { id: 'user-a' }, access_token: 'user.jwt', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 300 });
      if (url === '/api/swipes') { if (fail) throw new Error('Offline'); writes.push({ ...options, body: JSON.parse(options.body) }); }
      return respond({ saved: true });
    } });
  await sync.initialize();
  sync.record('men-clean-01', 'like'); // Logged-out history must not be silently uploaded.
  await sync.login('test@example.com', 'password-fixture');
  sync.record('r-men-clean-01', 'skip');
  await new Promise(setImmediate);
  assert.equal(writes.length, 0);
  assert.ok(statuses.at(-1).message.includes('未保存'));
  assert.ok(local.getItem('konomi-cloud-pending-v1:user-a').includes('skip'));
  fail = false;
  await sync.flush();
  assert.equal(writes[0].body.action, 'skip');
  sync.record('men-clean-01', null);
  await new Promise(setImmediate);
  assert.equal(writes.at(-1).method, 'DELETE');
  await sync.logout();
  sync.record('men-clean-02', 'no');
  await new Promise(setImmediate);
  assert.equal(writes.length, 2);
});

test('送信中に回答が変わっても最新回答を消さず、順番に保存する', async () => {
  const writes = [];
  let release;
  const sync = createSync({ storage: storage(), sessionStorage: storage(), fetchImpl: async (url, options) => {
    if (url === '/api/cloud/config') return respond({ configured: true });
    if (url === '/api/cloud/login') return respond({ user: { id: 'user-a' }, access_token: 'jwt', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 300 });
    const body = JSON.parse(options.body);
    writes.push(body.action);
    if (writes.length === 1) await new Promise((resolve) => { release = resolve; });
    return respond({ saved: true });
  } });
  await sync.initialize(); await sync.login('a@example.com', 'fixture');
  sync.record('men-clean-01', 'like');
  await new Promise(setImmediate);
  sync.record('men-clean-01', 'no');
  release();
  await new Promise(setImmediate);
  assert.deepEqual(writes, ['like', 'dislike']);
});

test('デモモードは認証・履歴の外部送信を一切しない', async () => {
  const sync = createSync({ demo: true, storage: storage(), sessionStorage: storage(), fetchImpl: async () => { throw new Error('Must not request'); } });
  await sync.initialize(); sync.record('men-clean-01', 'like'); await sync.flush();
});

test('116枚の既存写真の出典・権利台帳を事前登録に使う', () => {
  const items = loadRegisteredItems();
  assert.equal(items.length, 116);
  assert.ok(items.every((item) => item.source_url.startsWith('https://') && item.license_url && /^[a-f0-9]{64}$/.test(item.image_sha256)));
  assert.throws(() => validateVector(Array(512).fill(0)));
});

test('バッチは同じ内容・モデル版の保存済みembeddingを再利用し、推論しない', async () => {
  // Explicit transport-only fixture. This is NOT a real FashionCLIP success test.
  const fixture = [1, ...Array(511).fill(0)];
  const items = loadRegisteredItems();
  const version = 'patrickjohncyh/fashion-clip@test-unit-fixture';
  let inferCalls = 0, writes = 0;
  const result = await precompute({ env: { ...env, FASHIONCLIP_BASE_URL: 'http://127.0.0.1:8001', FASHIONCLIP_API_TOKEN: 'test-token' }, log() {},
    fetchImpl: async (url, options) => {
      if (url.endsWith('/health')) return respond({ ready: true, dimension: 512, model: 'patrickjohncyh/fashion-clip', modelVersion: version });
      if (url.includes('/embed')) { inferCalls++; throw new Error('Should reuse existing data'); }
      if (options.method === 'GET') return respond(items.map((item) => ({ ...item, embedding: JSON.stringify(fixture),
        embedding_model: 'patrickjohncyh/fashion-clip', embedding_model_version: version, embedded_at: '2026-01-01T00:00:00Z' })));
      writes++; return respond(null, 201);
    } });
  assert.equal(inferCalls, 0); assert.equal(writes, items.length); assert.equal(result.reused, items.length);
});

test('実推論失敗時はembeddingを保存せずバッチを失敗として終了する', async () => {
  let writes = 0;
  await assert.rejects(precompute({ env: { ...env, FASHIONCLIP_BASE_URL: 'http://127.0.0.1:8001', FASHIONCLIP_API_TOKEN: 'fixture' }, log() {},
    fetchImpl: async (url, options) => {
      if (url.endsWith('/health')) return respond({ ready: true, model: 'patrickjohncyh/fashion-clip', dimension: 512, modelVersion: 'patrickjohncyh/fashion-clip@fixture' });
      if (url.endsWith('/embed')) return respond({ error: 'Inference failed' }, 503);
      if (options.method === 'GET') return respond([]);
      writes++; return respond(null);
    } }), /no dummy embedding/);
  assert.equal(writes, 0);
});

test('台帳のみの登録では推論を呼ばず、変更のない保存済みembeddingを保持する', async () => {
  const items = loadRegisteredItems();
  const fixture = [1, ...Array(511).fill(0)]; // Transport-only fixture, not real inference.
  let calls = 0;
  await precompute({ env, registerOnly: true, log() {}, fetchImpl: async (url, options) => {
    assert.ok(url.startsWith(env.SUPABASE_URL));
    if (options.method === 'GET') return respond([{ ...items[0], embedding: JSON.stringify(fixture),
      embedding_model: 'patrickjohncyh/fashion-clip', embedding_model_version: 'test-existing-fixture', embedded_at: '2026-01-01T00:00:00Z' }]);
    const row = JSON.parse(options.body);
    if (calls++ === 0) { assert.deepEqual(row.embedding, fixture); assert.equal(row.embedding_model_version, 'test-existing-fixture'); }
    else assert.equal(row.embedding, null);
    return respond(null);
  } });
  assert.equal(calls, items.length);
});

test('SQLは既存テーブルを上書きせず、RLSとユニーク制約を備える（静的検査）', () => {
  const sql = fs.readFileSync('supabase/migrations/202610060001_fashionclip_ingestion.sql', 'utf8');
  assert.ok(sql.includes("raise exception 'Existing fashion_items/swipes detected"));
  assert.ok(sql.includes('primary key (user_id, fashion_item_id)'));
  assert.equal((sql.match(/alter table .* enable row level security/g) || []).length, 2);
  assert.ok(sql.includes("action in ('like', 'dislike', 'skip')"));
  assert.ok(sql.includes('with check ((select auth.uid()) = user_id'));
});

test('新形式Supabase secretキーをJWTとしてAuthorizationに送らない', async () => {
  let writes = 0;
  await precompute({ env: { ...env, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_unit_fixture' }, registerOnly: true, log() {},
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.apikey, 'sb_secret_unit_fixture');
      assert.equal(options.headers.Authorization, undefined);
      if (options.method === 'GET') return respond([]);
      writes++; return respond(null);
    } });
  assert.equal(writes, loadRegisteredItems().length);
});
