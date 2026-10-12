const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('インストール版はログイン前に診断データを保存せず、アカウントごとに分離する', () => {
  const values = new Map();
  let userId = null;
  const node = () => ({ innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return node(); } });
  const document = { body: { dataset: {} }, addEventListener() {}, getElementById: node,
    querySelectorAll() { return []; } };
  const window = { KONOMI_AUTH_REQUIRED: true, konomiCloudSync: { getUserId: () => userId },
    KONOMI_CARDS: require('../data.js'), KONOMI_RECOMMENDATIONS: require('../recommendations.js'),
    KONOMI_PRODUCTS: [], KONOMI_SHOPS: [], KonomiLogic: require('../logic.js'),
    KonomiDiagnosisPool: require('../diagnosis-pool.js'), addEventListener() {} };
  const context = vm.createContext({ window, document, location: { search: '', protocol: 'http:' },
    navigator: {}, URL, URLSearchParams, Date,
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    setTimeout() {}, clearTimeout() {} });
  const source = fs.readFileSync(require.resolve('../app.js'), 'utf8').replace(/initializeFashionPreference\(\);\s*render\(\);\s*$/, '');
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  run("state.profile.nickname = 'before-login'; persist();");
  assert.equal(values.size, 0);
  userId = 'user-a';
  run("state = loadState(); state.profile.nickname = 'Alice'; persist();");
  assert.equal(JSON.parse(values.get('konomi-state-v5:user-a')).profile.nickname, 'Alice');
  userId = 'user-b';
  run('state = loadState()');
  assert.equal(run('state.profile.nickname'), '');
  run("state.profile.nickname = 'Bob'; persist();");
  assert.equal(JSON.parse(values.get('konomi-state-v5:user-b')).profile.nickname, 'Bob');
  assert.equal(JSON.parse(values.get('konomi-state-v5:user-a')).profile.nickname, 'Alice');
});

test('インストール版にログイン・新規登録の入口があり、診断画面は認証まで隠れる', () => {
  const html = fs.readFileSync(require.resolve('../app.js').replace('app.js', 'index.html'), 'utf8');
  const css = fs.readFileSync(require.resolve('../app.js').replace('app.js', 'minimal-theme.css'), 'utf8');
  assert.match(html, /display-mode: standalone/);
  assert.match(html, /id="appAuthForm"/);
  assert.match(html, /id="appSignupButton"/);
  assert.match(css, /\.auth-required:not\(\.auth-unlocked\) \.app-shell/);
});
