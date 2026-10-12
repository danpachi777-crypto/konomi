(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KonomiCloud = api;
})(globalThis, function () {
  // Optional persistence only: never computes preferences, embeddings or rankings.
  function createSync({ fetchImpl, storage, sessionStorage, onStatus = () => {}, demo = false }) {
    let configured = false, session = null, pending = {}, running = false;
    const sessionKey = 'konomi-cloud-session-v1';
    const prefix = 'konomi-cloud-pending-v1:';
    const status = (message) => onStatus({ configured, signedIn: Boolean(session), userId: session?.user.id || null, pending: Object.keys(pending).length, message });
    function validSession(value) {
      return Boolean(value?.user?.id && value.access_token && value.refresh_token && Number.isFinite(value.expires_at));
    }
    function storeSession() {
      if (session) storage.setItem(sessionKey, JSON.stringify(session));
      else storage.removeItem(sessionKey);
      sessionStorage.removeItem(sessionKey); // Remove the old tab-only session after migration or logout.
    }
    function storePending(user = session?.user.id) {
      if (user) storage.setItem(prefix + user, JSON.stringify(pending));
    }
    async function request(route, { method = 'GET', body, token } = {}) {
      const response = await fetchImpl(route, { method, cache: 'no-store', signal: AbortSignal.timeout(15000),
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json();
      if (!response.ok) { const error = new Error(result.error || 'クラウド保存に失敗しました。'); error.status = response.status; throw error; }
      return result;
    }
    function loadPending() {
      try { pending = JSON.parse(storage.getItem(prefix + session.user.id) || '{}'); }
      catch { pending = {}; }
      if (!pending || Array.isArray(pending) || typeof pending !== 'object') pending = {};
      for (const [id, entry] of Object.entries(pending)) {
        if (!entry || !['like', 'dislike', 'skip', null].includes(entry.action) || typeof entry.version !== 'string') delete pending[id];
      }
    }
    async function accessToken() {
      if (!session) throw new Error('ログインしてください。');
      if (session.expires_at < Date.now() / 1000 + 30) {
        const oldUser = session.user.id;
        const refreshed = await request('/api/cloud/refresh', { method: 'POST', body: { refresh_token: session.refresh_token } });
        if (!session || session.user.id !== oldUser || refreshed.user?.id !== oldUser || !validSession(refreshed)) throw new Error('認証が変わりました。');
        session = refreshed;
        storeSession();
      }
      return session.access_token;
    }
    async function flush() {
      if (demo || !configured || !session || running || !Object.keys(pending).length) return;
      running = true;
      const owner = session.user.id;
      try {
        while (session?.user.id === owner && Object.keys(pending).length) {
          const [id, entry] = Object.entries(pending)[0];
          const token = await accessToken();
          if (session?.user.id !== owner) break;
          await request('/api/swipes', { method: entry.action === null ? 'DELETE' : 'POST', token,
            body: { fashionItemId: id, ...(entry.action === null ? {} : { action: entry.action }) } });
          // A newer answer while this request was in flight must not be lost.
          if (session?.user.id !== owner) break;
          if (pending[id]?.version === entry.version) delete pending[id];
          storePending(owner);
        }
        status(session ? 'スワイプ履歴をSupabaseに保存しました。' : 'ブラウザ内のみ保存しています。');
      } catch {
        status('クラウド未保存の回答があります。ローカルに保持しています。「再送信」で再試行できます。');
      } finally { running = false; }
    }
    async function initialize() {
      if (demo) return status('デモではクラウドに送信しません。');
      try {
        try { session = JSON.parse(storage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || 'null'); } catch { session = null; }
        if (!validSession(session)) session = null;
        if (session) loadPending();
        configured = (await request('/api/cloud/config')).configured === true;
        if (!configured) { session = null; return status('認証サービスが未設定です。アプリ版の利用には設定が必要です。'); }
        storeSession();
        if (session) {
          loadPending();
          try { await accessToken(); }
          catch (error) {
            if ([401, 403].includes(error.status)) {
              session = null; pending = {}; storeSession();
              return status('ログインの有効期限が切れました。もう一度ログインしてください。');
            }
            return status('クラウド接続を確認できません。ログイン情報と回答はこの端末に保持しています。');
          }
          status('ログイン済み。新しい回答をクラウド保存します。');
          await flush();
        }
        else status('クラウド保存にはログインが必要です。ログイン前の回答は自動送信しません。');
      } catch (error) {
        if (error.status) session = null;
        status(session ? 'オフラインです。ログイン状態と回答はこの端末に保持しています。'
          : '認証サービスに接続できません。接続を確認して再試行してください。');
      }
    }
    async function login(email, password) {
      if (demo || !configured || running) throw new Error('接続設定と送信状況を確認してください。');
      const next = await request('/api/cloud/login', { method: 'POST', body: { email, password } });
      if (!validSession(next)) throw new Error('Invalid session');
      session = next;
      storeSession();
      loadPending();
      status('ログインしました。ここからのスワイプをクラウド保存します。');
      await flush();
    }
    async function signup(email, password) {
      if (demo || !configured || running) throw new Error('接続設定と送信状況を確認してください。');
      const result = await request('/api/cloud/signup', { method: 'POST', body: { email, password } });
      if (result.confirmationRequired) return { confirmationRequired: true };
      if (!validSession(result)) throw new Error('Invalid session');
      session = result;
      storeSession();
      loadPending();
      status('登録しました。ログイン状態をこの端末に保持します。');
      await flush();
      return { confirmationRequired: false };
    }
    async function logout() {
      const old = session;
      session = null;
      pending = {};
      storeSession();
      status('ログアウトしました。これからの回答はブラウザ内のみ保存します。');
      if (old) { try { await request('/api/cloud/logout', { method: 'POST', body: {}, token: old.access_token }); } catch { /* Local session remains cleared. */ } }
    }
    function record(id, choice) {
      if (demo || !session) return;
      const action = ({ like: 'like', no: 'dislike', dislike: 'dislike', skip: 'skip', neutral: 'skip' })[choice];
      if (choice !== null && !action) return;
      const itemId = id.replace(/^r-/, '');
      pending[itemId] = { action: choice === null ? null : action, version: String(Date.now()) + ':' + Math.random() };
      try { storePending(); } catch { status('未送信履歴をブラウザに保持できません。'); }
      void flush();
    }
    return { initialize, login, signup, logout, record, flush, getUserId: () => session?.user.id || null };
  }
  return { createSync };
});

if (typeof window !== 'undefined' && window.KonomiCloud) {
  const panel = document.getElementById('cloudPanel');
  const form = document.getElementById('cloudLogin');
  const logoutButton = document.getElementById('cloudLogout');
  const appAuthForm = document.getElementById('appAuthForm');
  window.konomiCloudSync = window.KonomiCloud.createSync({
    fetchImpl: window.fetch.bind(window), storage: window.localStorage, sessionStorage: window.sessionStorage,
    demo: new URLSearchParams(window.location.search).has('demo'),
    onStatus({ configured, signedIn, userId, message }) {
      if (window.KONOMI_AUTH_REQUIRED) {
        document.documentElement.classList.toggle('auth-unlocked', signedIn);
        appAuthForm.hidden = !configured;
        document.getElementById('appAuthStatus').textContent = message;
      }
      window.dispatchEvent(new CustomEvent('konomi:auth-change', { detail: { userId } }));
      panel.hidden = !configured;
      form.hidden = signedIn;
      logoutButton.hidden = !signedIn;
      document.getElementById('cloudStatus').textContent = message;
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('cloudPassword');
    const submit = document.getElementById('cloudLoginButton');
    submit.disabled = true;
    try { await window.konomiCloudSync.login(document.getElementById('cloudEmail').value, password.value); }
    catch (error) { document.getElementById('cloudStatus').textContent = error.message; }
    finally { password.value = ''; submit.disabled = false; }
  });
  appAuthForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('appAuthEmail').value;
    const password = document.getElementById('appAuthPassword');
    const buttons = appAuthForm.querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      if (event.submitter?.value === 'signup') {
        const result = await window.konomiCloudSync.signup(email, password.value);
        if (result.confirmationRequired) document.getElementById('appAuthStatus').textContent =
          '確認メールを送信しました。メール内のリンクを開いた後、ここでログインしてください。';
      } else await window.konomiCloudSync.login(email, password.value);
    } catch (error) { document.getElementById('appAuthStatus').textContent = error.message; }
    finally { password.value = ''; buttons.forEach((button) => { button.disabled = false; }); }
  });
  logoutButton.addEventListener('click', () => void window.konomiCloudSync.logout());
  document.getElementById('cloudRetry').addEventListener('click', () => void window.konomiCloudSync.flush());
  window.addEventListener('online', () => void window.konomiCloudSync.initialize());
  void window.konomiCloudSync.initialize();
}
