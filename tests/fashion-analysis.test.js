const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const preference = require('../fashion-preference.js');
const { readLocalCatalog } = require('../local-catalog.js');
const cards = require('../data.js');
const recommendations = require('../recommendations.js');
const logic = require('../logic.js');
const catalog = readLocalCatalog();
const realTest = (name, fn) => test(name, { skip: !catalog.available || catalog.items.length < 80 }, fn);

function harness(values = new Map(), withCatalog = false) {
  const elements = new Map();
  const node = () => ({ innerHTML: '', dataset: {}, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return node(); } });
  const document = { body: { dataset: {} }, addEventListener() {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); },
    querySelectorAll() { return []; }, querySelector: node };
  const context = vm.createContext({ window: { KONOMI_CARDS: cards, KONOMI_RECOMMENDATIONS: recommendations,
    KONOMI_PRODUCTS: [], KONOMI_SHOPS: [], KonomiLogic: logic, KonomiDiagnosisPool: require('../diagnosis-pool.js'), KonomiFashionPreference: preference, setTimeout() {} },
    document, location: { search: '', protocol: 'http:' }, navigator: {}, URL, URLSearchParams, Date,
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    setTimeout() {}, clearTimeout() {}, realCatalog: catalog,
    fetch() { throw new Error('No model/network requests allowed in this test'); } });
  const source = fs.readFileSync(require.resolve('../app.js'), 'utf8').replace(/initializeFashionPreference\(\);\s*render\(\);\s*$/, '');
  vm.runInContext(source, context);
  const run = expression => vm.runInContext(expression, context);
  if (withCatalog) run('fashionPreference = window.KonomiFashionPreference.createController(realCatalog, window.KonomiFashionPreference.createLocalStorageAdapter(localStorage)); fashionPreference.update(state);');
  return { run, values, html: () => elements.get('app')?.innerHTML || '' };
}

test('STYLE SCORE変換はcosineの-1/0/1を0/50/100にし、無効値を表示しない', () => {
  assert.deepEqual([-1, 0, 1].map(preference.similarityToStyleScore), [0, 50, 100]);
  for (const value of [null, undefined, NaN, Infinity, '0.5']) assert.equal(preference.similarityToStyleScore(value), null);
  assert.equal(preference.similarityToStyleScore(-1.01), 0);
  assert.equal(preference.similarityToStyleScore(1.01), 100);
});

test('履歴なし／カタログなしでも分析へ遷移でき、0件と案内を出してスコアを捏造しない', () => {
  const app = harness();
  app.run("setRoute('analysis')");
  assert.equal(app.run('state.route'), 'analysis');
  assert.ok(app.html().includes('まだ回答はありません'));
  assert.ok(app.html().includes('<dt>like</dt><dd>0'));
  assert.ok(app.html().includes('<dt>dislike</dt><dd>0'));
  assert.ok(app.html().includes('<dt>skip</dt><dd>0'));
  const score = app.run("styleScoreHTML('men-clean-01')");
  assert.ok(score.includes('服を選ぶと、あなたの好みが見えてきます'));
  assert.equal(score.includes('data-style-score='), false);
  assert.equal(app.html().includes('%'), false);
});

test('実履歴の最新回答を数え、タグ・カテゴリは実在するlike写真だけから集計する', () => {
  const [a, b, c] = cards;
  const state = { history: [{ id: a.id, choice: 'like' }, { id: b.id, choice: 'no' }, { id: c.id, choice: 'skip' }],
    recommendationHistory: [{ id: 'r-' + a.id, choice: 'no' }, { id: 'r-' + b.id, choice: 'like' }] };
  const analysis = preference.analyzeHistory(state, cards);
  assert.deepEqual(analysis.counts, { like: 1, dislike: 1, skip: 1 });
  assert.deepEqual(analysis.liked.map(item => item.id), [b.id]);
  assert.deepEqual(analysis.categories, [{ label: b.category, count: 1 }]);
  assert.deepEqual(new Set(analysis.tags.map(item => item.label)), new Set(b.tags));
  assert.ok(analysis.tags.every(item => item.count === 1));
  const withoutMetadata = preference.analyzeHistory({ history: [{ id: a.id, choice: 'like' }] }, [{ id: a.id }]);
  assert.deepEqual(withoutMetadata.categories, []); assert.deepEqual(withoutMetadata.tags, []);
});

realTest('実embeddingのSTYLE SCOREは決定的で、like/dislike更新で変化し、同じモデル以外では出ない', () => {
  const [a, b] = catalog.items;
  const before = preference.calculate(catalog, [{ id: a.id, action: 'like' }]);
  const after = preference.calculate(catalog, [{ id: a.id, action: 'like' }, { id: b.id, action: 'dislike' }]);
  const scores = catalog.items.map(item => preference.styleScore(catalog, before, item.id));
  assert.ok(scores.every(value => Number.isInteger(value) && value >= 0 && value <= 100));
  assert.deepEqual(scores, catalog.items.map(item => preference.styleScore(catalog, before, 'r-' + item.id)));
  assert.ok(catalog.items.some((item, i) => preference.styleScore(catalog, after, item.id) !== scores[i]));
  for (const item of catalog.items) assert.equal(preference.styleScore(catalog, before, item.id),
    Math.round(50 * (preference.cosine(before.vector, item.embedding) + 1)));
  assert.equal(preference.styleScore(catalog, { ...before, modelVersion: 'wrong-version' }, a.id), null);
  assert.equal(preference.styleScore(catalog, before, 'missing'), null);
  assert.equal(preference.styleScore(catalog, preference.calculate(catalog, []), a.id), null);
});

realTest('50件の境界を越えても新しいskipは重み・好みベクトル・全コーデのスコアを変えない', () => {
  const history = catalog.items.slice(0, 60).map((item, index) => ({ id: item.id, action: index % 4 ? 'like' : 'dislike' }));
  const before = preference.calculate(catalog, history);
  const after = preference.calculate(catalog, [...history.slice(0, 10),
    ...catalog.items.slice(60, 80).map(item => ({ id: item.id, action: 'skip' })), ...history.slice(10)]);
  assert.deepEqual(before.vector, after.vector);
  assert.equal(after.counts.skip, 20);
  assert.deepEqual(catalog.items.map(item => preference.styleScore(catalog, before, item.id)),
    catalog.items.map(item => preference.styleScore(catalog, after, item.id)));
  assert.equal(before.personalization, after.personalization);
});

realTest('評価済み写真の再比較をskipしても、前回評価を再利用してスコアを維持・復元する', () => {
  const [a, b] = catalog.items;
  const controller = preference.createController(catalog, { save() {} });
  const state = { history: [{ id: a.id, choice: 'like' }], recommendationHistory: [{ id: 'r-' + b.id, choice: 'no' }] };
  const before = controller.update(state);
  state.recommendationHistory = [{ id: 'r-' + b.id, choice: 'skip', previousAnswer: state.recommendationHistory[0] }, { id: 'r-' + a.id, choice: 'skip' }];
  const after = controller.update(state);
  assert.deepEqual(after.vector, before.vector);
  assert.equal(after.counts.skip, 2);
  assert.equal(after.ratingCounts.embeddedLike, 1);
  assert.equal(after.ratingCounts.embeddedDislike, 1);
  const restored = preference.createController(catalog, { save() {} }).update(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.vector, before.vector);
  assert.deepEqual(catalog.items.map(item => preference.styleScore(catalog, before, item.id)),
    catalog.items.map(item => preference.styleScore(catalog, restored, item.id)));
  const legacy = { likedIds: [a.id], recommendationHistory: [{ id: 'r-' + a.id, choice: 'skip' }] };
  assert.deepEqual(controller.update(legacy).vector, preference.calculate(catalog, [{ id: a.id, action: 'like' }]).vector);
});

realTest('新しい系統写真にembeddingがない間はスコアを捏造せず回答を復元する', () => {
  const app = harness(new Map(), true);
  app.run("state.profileCompleted = true; state.profile.gender = 'men'; state.route = 'swipe'; state.diagnosisIds = window.KONOMI_CARDS.filter(card => card.audience === 'men' && card.generatedPhoto).slice(0, 3).map(card => card.id); persist(); renderSwipe();");
  assert.equal(app.html().includes('data-style-score='), false);
  const first = app.run('diagnosisCards()[state.current].id');
  app.run("recordChoice('like')");
  assert.equal(app.html().includes('data-style-score='), false);
  const before = app.run('JSON.stringify(fashionPreference.snapshot().vector)');
  app.run("recordChoice('no')");
  assert.equal(app.run('JSON.stringify(fashionPreference.snapshot().vector)'), before);
  const priorSkip = app.run('JSON.stringify(fashionPreference.snapshot().vector)');
  const firstScore = app.run(`styleScoreHTML(${JSON.stringify(first)})`);
  app.run("recordChoice('skip')");
  assert.equal(app.run('JSON.stringify(fashionPreference.snapshot().vector)'), priorSkip);
  assert.equal(app.run(`styleScoreHTML(${JSON.stringify(first)})`), firstScore);
  app.run("setRoute('analysis')");
  assert.ok(app.html().includes('<dt>like</dt><dd>1'));
  assert.ok(app.html().includes('<dt>dislike</dt><dd>1'));
  assert.ok(app.html().includes('<dt>skip</dt><dd>1'));
  assert.ok(app.html().includes('少ない回答'));
  assert.ok(app.html().includes('診断'));
  const restored = harness(app.values, true);
  restored.run('render()');
  assert.equal(restored.run('state.route'), 'analysis');
  assert.equal(restored.html(), app.html());
  assert.equal(restored.run('JSON.stringify(fashionPreference.snapshot().vector)'), priorSkip);
  const state = JSON.parse(app.values.get('konomi-state-v5'));
  assert.equal(state.history.length, 3);
  assert.equal(JSON.parse(app.values.get('konomi-fashion-preference-v1')).counts.skip, 1);
});

realTest('結果・保存画面でもスコアを表示し、架空の系統％や履歴なしの固定値を出さない', () => {
  const app = harness(new Map(), true);
  const item = cards.find(item => item.audience === 'men');
  app.run(`state.profileCompleted = true; state.profile.gender = 'men'; state.sessionCompleted = true;
    state.history = [{ id: ${JSON.stringify(item.id)}, choice: 'like' }]; state.likedIds = [${JSON.stringify(item.id)}]; persist(); renderResult();`);
  assert.ok(app.html().includes('好みの分析'));
  assert.ok(app.html().includes('あなたの選択をもとにした、好みとの近さ'));
  assert.equal(/<em>\d+%<\/em>/.test(app.html()), false);
  app.run('renderSaved()');
  assert.ok(app.html().includes('あなたが好きな服'));
  assert.equal(app.html().includes('診断で「好き」と答えた写真'), false);
  app.run('state.history = []; state.likedIds = []; persist(); renderResult();');
  assert.equal(app.html().includes('data-style-score='), false);
  assert.equal(app.html().includes('ニュートラル'), false);
  assert.ok(app.html().includes('まだ回答はありません'));
});
