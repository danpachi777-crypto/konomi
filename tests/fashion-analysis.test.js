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

test('好きそうな系統と好みの分析は好みタブにまとめ、結果から移動できる', () => {
  const app = harness();
  const item = cards.find(card => card.audience === 'men' && card.styleId);
  app.run(`state.profileCompleted = true; state.sessionCompleted = true; state.profile.gender = 'men';
    state.history = [{ id: ${JSON.stringify(item.id)}, choice: 'like' }];
    state.likedIds = [${JSON.stringify(item.id)}]; renderResult();`);
  assert.ok(app.html().includes('data-route="analysis"'));
  assert.equal(app.html().includes('class="style-feed"'), false);
  assert.equal(app.html().includes('id="tasteAnalysis"'), false);
  app.run("setRoute('analysis')");
  assert.ok(app.html().includes('<h2>あなたが好きそうな系統</h2>'));
  assert.ok(app.html().includes('class="style-feed-card"'));
  assert.ok(app.html().includes('id="tasteAnalysis"'));
});

test('診断後はマップ画面で店と地図を表示し、結果画面には地図の導線を置く', () => {
  const app = harness();
  const item = cards.find(card => card.styleId === 'men_amekaji');
  app.run(`shops.push({ id: 'local-test', name: 'テスト服屋', type: '古着店', area: '下北沢', query: 'テスト服屋 下北沢',
    tags: ['アメカジ'], features: [], description: '店舗候補', sourceLabel: '公開情報', checkedAt: '2026-10-13', sourceUrl: 'https://example.com/shop' });
    state.profileCompleted = true; state.sessionCompleted = true; state.profile.gender = 'men'; state.profile.shoppingArea = '下北沢';
    state.history = [{ id: ${JSON.stringify(item.id)}, choice: 'like' }];
    state.likedIds = [${JSON.stringify(item.id)}]; renderResult();`);
  assert.equal(app.html().includes('id="shopMap"'), false);
  assert.ok(app.html().includes('data-route="map"'));
  app.run("setRoute('map')");
  assert.ok(app.html().includes('class="explore-switch"'));
  assert.ok(app.html().includes('Picture'));
  assert.ok(app.html().includes('Shop'));
  assert.ok(app.html().includes('data-route="saved"'));
  assert.ok(app.html().includes('id="shopMap"'));
  assert.ok(app.html().includes('テスト服屋'));
  assert.ok(app.html().includes('data-shop-style="あなた向け" aria-pressed="true"'));
  assert.ok(app.html().includes('好きと答えた「王道アメカジ」'));
  assert.ok(app.html().includes('data-shop-style="アメカジ"'));
  assert.ok(app.html().includes('地図・口コミを見る'));
  assert.equal(app.html().includes('Googleマップの店舗情報を更新'), false);
  app.run("shopStyleFilter = 'モード'; renderMap()");
  assert.ok(app.html().includes('この地域・条件の店舗候補はまだありません'));
});

test('探すの切り替えは写真と地図の二画面で、下部メニューは三項目にする', () => {
  const navigation = fs.readFileSync(require.resolve('../index.html'), 'utf8');
  const bottomNav = navigation.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal((bottomNav.match(/data-route=/g) || []).length, 3);
  assert.equal(bottomNav.includes('data-route="map"'), false);
  const app = harness();
  assert.ok(app.run("exploreSwitchHTML('saved')").includes('aria-pressed="true"'));
  assert.ok(app.run("exploreSwitchHTML('map')").includes('data-route="map"'));
  assert.equal(app.run("exploreSwitchHTML('saved')").includes('01'), false);
  assert.equal(app.run("exploreSwipeRoute('saved', 240, 100, 150, 108)"), 'map');
  assert.equal(app.run("exploreSwipeRoute('map', 100, 100, 190, 108)"), 'saved');
  assert.equal(app.run("exploreSwipeRoute('saved', 240, 100, 150, 190)"), null);
  const swipeResult = app.run(`(() => {
    state.profileCompleted = true; state.sessionCompleted = true;
    const listeners = {};
    bindExploreSwipe({ addEventListener(type, handler) { listeners[type] = handler; } }, 'saved');
    listeners.touchstart({ touches: [{ clientX: 240, clientY: 100 }], target: { closest() { return null; } } });
    let prevented = false;
    listeners.touchend({ changedTouches: [{ clientX: 150, clientY: 108 }], preventDefault() { prevented = true; } });
    return { route: state.route, prevented };
  })()`);
  assert.equal(swipeResult.route, 'map');
  assert.equal(swipeResult.prevented, true);
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

realTest('好み画面でスコアを表示し、架空の系統％や履歴なしの固定値を出さない', () => {
  const app = harness(new Map(), true);
  const item = cards.find(item => item.audience === 'men');
  app.run(`state.profileCompleted = true; state.profile.gender = 'men'; state.sessionCompleted = true;
    state.history = [{ id: ${JSON.stringify(item.id)}, choice: 'like' }]; state.likedIds = [${JSON.stringify(item.id)}]; persist(); renderResult();`);
  app.run("setRoute('analysis')");
  assert.ok(app.html().includes('好みの分析'));
  assert.ok(app.html().includes('あなたの選択をもとにした、好みとの近さ'));
  assert.equal(/<em>\d+%<\/em>/.test(app.html()), false);
  app.run('state.history = []; state.likedIds = []; persist(); renderTasteAnalysis();');
  assert.equal(app.html().includes('data-style-score='), false);
  assert.equal(app.html().includes('ニュートラル'), false);
  assert.ok(app.html().includes('まだ回答はありません'));
});
