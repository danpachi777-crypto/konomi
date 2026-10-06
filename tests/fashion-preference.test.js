const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logic = require('../logic.js');
const cards = require('../data.js');
const recommendations = require('../recommendations.js');
const preference = require('../fashion-preference.js');
const { readLocalCatalog } = require('../local-catalog.js');
const catalog = readLocalCatalog();
// No generated/synthetic embeddings, even in tests. Explicitly skip only real-data tests when absent.
const realTest = (name, fn) => test(name, { skip: !catalog.available || catalog.items.length < 30 }, fn);

test('70/20/10探索と最近の50/150スワイプの重みを定数で管理する', () => {
  const counts = { near: 0, middle: 0, far: 0 };
  for (let i = 0; i < 1000; i++) counts[preference.explorationBucket(i)]++;
  assert.deepEqual(counts, { near: 700, middle: 200, far: 100 });
  const changed = { near: 0.5, middle: 0.3, far: 0.2 };
  const second = { near: 0, middle: 0, far: 0 };
  for (let i = 0; i < 100; i++) second[preference.explorationBucket(i, changed)]++;
  assert.deepEqual(second, { near: 50, middle: 30, far: 20 });
  assert.throws(() => preference.explorationBucket(0, { near: 2, middle: 0, far: 0 }));
  assert.deepEqual([1, 50, 51, 150, 151].map(preference.recencyWeight), [1, 1, 0.7, 0.7, 0.4]);
});
test('r-IDを同じ写真に統合し、最新回答だけ採用してskipと部分評価は否定にしない', () => {
  const history = preference.historyFromState({ history: [{ id: 'a', choice: 'like' }, { id: 'b', choice: 'no' }],
    likedIds: ['a', 'legacy'], recommendationHistory: [{ id: 'r-a', choice: 'skip' }, { id: 'r-b', choice: 'neutral', details: { white: 'like' } }] });
  assert.deepEqual(history.map(entry => [entry.id, entry.action]), [['legacy', 'like'], ['a', 'skip'], ['b', 'skip']]);
});
test('保存アダプターを置き換えられ、壊れたローカルJSONは無視する', () => {
  const values = new Map();
  const adapter = preference.createLocalStorageAdapter({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) });
  assert.equal(adapter.load(), null);
  adapter.save({ version: 1 }); assert.deepEqual(adapter.load(), { version: 1 });
  values.set('konomi-fashion-preference-v1', '{'); assert.equal(adapter.load(), null);
});

realTest('実写真embeddingから指定式を計算し、skip・likeなし・欠損・異なるモデルを安全に扱う', () => {
  const [a, b, c] = catalog.items;
  const history = [{ id: a.id, action: 'like' }, { id: b.id, action: 'dislike' }];
  const actual = preference.calculate(catalog, history);
  const raw = a.embedding.map((value, i) => value - 0.2 * b.embedding[i]);
  const length = Math.hypot(...raw);
  actual.vector.forEach((value, i) => assert.ok(Math.abs(value - raw[i] / length) < 1e-12));
  assert.deepEqual(preference.calculate(catalog, [...history, { id: c.id, action: 'skip' }]).vector, actual.vector);
  assert.equal(preference.calculate(catalog, [{ id: b.id, action: 'dislike' }]).vector, null);
  assert.equal(preference.calculate(catalog, [{ id: 'missing', action: 'like' }]).counts.missing, 1);
  assert.throws(() => preference.calculate({ ...catalog, modelVersion: 'unverified' }, history));
  const bad = { ...catalog, items: [{ ...a, embedding: a.embedding.slice(1) }] };
  assert.throws(() => preference.calculate(bad, history));
});
realTest('実embeddingの加重平均を分母込みで計算し、10〜20有効評価で徐々に個別化する', () => {
  const history = catalog.items.slice(0, 60).map((item, index) => ({ id: item.id, action: index % 3 === 0 ? 'dislike' : 'like' }));
  const actual = preference.calculate(catalog, history);
  const means = { like: Array(512).fill(0), dislike: Array(512).fill(0) }, weights = { like: 0, dislike: 0 };
  history.forEach((entry, index) => {
    const weight = index < 10 ? 0.7 : 1;
    weights[entry.action] += weight;
    catalog.items[index].embedding.forEach((value, i) => { means[entry.action][i] += value * weight; });
  });
  const raw = means.like.map((value, i) => value / weights.like - 0.2 * means.dislike[i] / weights.dislike);
  const length = Math.hypot(...raw);
  actual.vector.forEach((value, i) => assert.ok(Math.abs(value - raw[i] / length) < 1e-12));
  assert.deepEqual([0, 10, 15, 20].map(count => preference.calculate(catalog, history.slice(0, count)).personalization), [0, 0, 0.5, 1]);
});
realTest('コールドスタートは実embeddingの最大最小距離で多様化し、全候補終了でも再利用しない', () => {
  const history = [], ids = catalog.items.map(item => item.id), seen = new Set();
  for (let i = 0; i < ids.length; i++) {
    const chosen = preference.chooseNext(catalog, history, ids);
    assert.ok(chosen.item); assert.equal(seen.has(chosen.item.imageSha256), false);
    if (i < 10) assert.equal(chosen.mode, 'diversity');
    if (i === 1) {
      const first = catalog.items.find(item => item.id === history[0].id);
      const distance = item => 1 - preference.cosine(item.embedding, first.embedding);
      const maximum = Math.max(...catalog.items.filter(item => item.id !== first.id).map(distance));
      assert.ok(Math.abs(chosen.item.diversity - maximum) < 1e-12);
    }
    seen.add(chosen.item.imageSha256);
    history.push({ id: chosen.item.id, action: i % 4 === 3 ? 'skip' : i % 3 ? 'like' : 'dislike' });
  }
  assert.equal(preference.chooseNext(catalog, history, ids).mode, 'exhausted');
  const one = preference.chooseNext(catalog, [], [ids[0]]); assert.equal(one.item.id, ids[0]);
  assert.equal(preference.chooseNext(catalog, [{ id: ids[0], action: 'skip' }], [ids[0]]).item, null);
});
realTest('実画像で成熟した好みの探索を70/20/10で行い、保存障害でもスワイプを止めない', () => {
  const history = catalog.items.slice(0, 20).map(item => ({ id: item.id, action: 'like' }));
  const ids = catalog.items.map(item => item.id), counts = { near: 0, middle: 0, far: 0 };
  for (let index = 0; index < 100; index++) counts[preference.chooseNext(catalog, history, ids, { index }).mode]++;
  assert.deepEqual(counts, { near: 70, middle: 20, far: 10 });
  const controller = preference.createController(catalog, { save() { throw new Error('Full'); } });
  assert.equal(controller.update({ history }).storageError, true);
  assert.ok(controller.snapshot().vector);
});

realTest('既存UIの実スワイプ・戻る・追加ラウンドを実embeddingとローカル保存で統合する', () => {
  const values = new Map();
  const node = () => ({ innerHTML: '', dataset: {}, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return node(); } });
  const document = { body: { dataset: {} }, addEventListener() {}, getElementById: node, querySelectorAll() { return []; }, querySelector: node };
  const context = vm.createContext({ window: { KONOMI_CARDS: cards, KONOMI_RECOMMENDATIONS: recommendations,
    KONOMI_PRODUCTS: [], KONOMI_SHOPS: [], KonomiLogic: logic, KonomiFashionPreference: preference, setTimeout() {} },
    document, location: { search: '', protocol: 'http:' }, navigator: {}, URL, URLSearchParams, Date,
    localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    setTimeout() {}, clearTimeout() {}, realCatalog: catalog });
  const source = fs.readFileSync(require.resolve('../app.js'), 'utf8').replace(/initializeFashionPreference\(\);\s*render\(\);\s*$/, '');
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  run("fashionPreference = window.KonomiFashionPreference.createController(realCatalog, window.KonomiFashionPreference.createLocalStorageAdapter(localStorage)); state.profileCompleted = true; state.profile.gender = 'men'; state.route = 'swipe'; persist();");
  assert.equal(run('diagnosisCards().length'), 20);
  const seen = new Set();
  for (let index = 0; index < 20; index++) {
    const id = run('diagnosisCards()[state.current].id');
    assert.equal(seen.has(id), false); seen.add(id);
    run(`recordChoice('${index % 5 === 4 ? 'skip' : index % 3 ? 'like' : 'no'}')`);
    if (index === 3) {
      run('undoChoice()');
      assert.equal(run('diagnosisCards()[state.current].id'), id);
      run("recordChoice('no')");
    }
    const snapshot = JSON.parse(values.get('konomi-fashion-preference-v1'));
    assert.equal(snapshot.history.length, index + 1);
  }
  assert.equal(run('state.sessionCompleted'), true);
  run('startRefinementRound(false, false)');
  for (let index = 0; index < 6; index++) {
    const id = run('currentRoundLooks()[state.recommendationCurrent].id').replace(/^r-/, '');
    assert.equal(seen.has(id), false); seen.add(id);
    run("recordRecommendationChoice('like')");
    if (index === 2) {
      run('undoRecommendationChoice()');
      assert.equal(run('currentRoundLooks()[state.recommendationCurrent].id').replace(/^r-/, ''), id);
      run("recordRecommendationChoice('like')");
    }
  }
  assert.equal(run('state.recommendationCompleted'), true);
  assert.ok(JSON.parse(values.get('konomi-fashion-preference-v1')).vector);
  assert.equal(seen.size, 26);
});
