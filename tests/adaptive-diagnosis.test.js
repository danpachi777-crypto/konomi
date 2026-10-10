const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const cards = require("../data.js");
const recommendations = require("../recommendations.js");
const brands = require("../specialist-brands.js");
const logic = require("../logic.js");

test("初回と追加診断の画像を男女別に分離し、初回で26系統を網羅する", () => {
  for (const audience of ["men", "women"]) {
    const initial = cards.filter((card) => card.audience === audience && card.phase === "initial");
    const extra = cards.filter((card) => card.audience === audience && card.phase === "refinement");
    assert.equal(initial.length, audience === "men" ? 14 : 12);
    assert.ok(extra.length >= 13);
    assert.equal(new Set(initial.map((card) => card.category)).size, initial.length);
    assert.equal(initial.some((card) => extra.some((item) => item.image === card.image)), false);
  }
});

test("追加診断を6枚ずつ続けても回答済み写真と対象外の方向を出さない", () => {
  const initial = cards.filter((card) => card.audience === "men" && card.phase === "initial");
  const answered = initial.map((card) => "r-" + card.id);
  const selected = [];
  const available = cards.filter((card) => card.audience === "men" && card.phase === "refinement").length;
  for (let round = 0; round < Math.ceil(available / 6); round++) {
    const batch = logic.selectAdaptiveRound(recommendations, initial, [initial[0].id], "men", answered);
    assert.ok(batch.length <= 6);
    batch.forEach((card) => { assert.equal(card.audience, "men"); assert.equal(answered.includes(card.id), false); });
    selected.push(...batch);
    answered.push(...batch.map((card) => card.id));
  }
  assert.equal(selected.length, available);
  assert.equal(new Set(selected.map((card) => card.image)).size, available);
});

test("判断できない回答は否定に数えない", () => {
  const known = [{ id: "yes", tags: [], features: ["白"] }];
  const before = logic.buildPreference(known, ["yes"]);
  const after = logic.buildPreference([...known, { id: "unknown", tags: [], features: ["白"], neutral: true }], ["yes"]);
  assert.deepEqual(after.features, before.features);
});

test("初回診断の保留をクラウドにskipで渡し、好みの否定にしない。戻ると記録を取り消す", () => {
  const app = appHarness();
  app.evaluate("state.current = 0; state.likedIds = []; state.history = []; state.sessionCompleted = false;");
  app.evaluate("window.konomiCloudSync = { records: [], record(...args) { this.records.push(args); } }");
  app.evaluate("recordChoice('skip')");
  assert.equal(app.evaluate("state.history[0].choice"), "skip");
  assert.equal(app.evaluate("window.konomiCloudSync.records[0][1]"), "skip");
  assert.equal(app.evaluate("recommendationInputs().cards[0].neutral"), true);
  app.evaluate("undoChoice()");
  assert.equal(app.evaluate("window.konomiCloudSync.records[1][1]"), null);
});

function appHarness() {
  const elements = new Map();
  const node = () => ({ innerHTML: "", dataset: {}, style: { setProperty() {}, removeProperty() {} },
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return node(); } });
  const selectedDetails = [];
  const document = { body: { dataset: {} }, addEventListener() {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, node()); return elements.get(id); },
    querySelectorAll(selector) { return selector.includes("input[data-feature]:checked") ? selectedDetails : []; },
    querySelector() { return node(); } };
  const context = vm.createContext({
    window: { KONOMI_CARDS: cards, KONOMI_RECOMMENDATIONS: recommendations, KONOMI_PRODUCTS: brands,
      KONOMI_SHOPS: [], KonomiLogic: logic, KonomiDiagnosisPool: require('../diagnosis-pool.js'), setTimeout() {} },
    document, location: { search: "?demo=result", protocol: "http:" }, navigator: {},
    localStorage: { getItem() { return null; }, setItem() {} }, URLSearchParams, URL, setTimeout() {}, clearTimeout() {}
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8").replace(/\nrender\(\);\s*$/, "");
  vm.runInContext(source, context);
  const evaluate = (expression) => vm.runInContext(expression, context);
  evaluate("state.diagnosisIds = cards.filter(card => card.audience === 'men' && card.phase === 'initial').map(card => card.id)");
  return { evaluate, selectedDetails, elements };
}

test("診断をやり直すと保存した対象設定のまま1枚目から再開する", () => {
  const app = appHarness();
  app.evaluate("state.current = 7; state.history = [{ id: 'style-men_trad', choice: 'like' }]; state.likedIds = ['style-men_trad']; state.profileCompleted = true; state.profile.gender = 'men'; state.sessionCompleted = true; state.savedRecommendationIds = ['r-men-clean-01'];");
  app.evaluate("resetDiagnosis()");
  assert.equal(app.evaluate("state.route"), "swipe");
  assert.equal(app.evaluate("state.current"), 0);
  assert.equal(app.evaluate("state.history.length"), 0);
  assert.equal(app.evaluate("state.likedIds.length"), 0);
  assert.equal(app.evaluate("state.savedRecommendationIds.length"), 0);
  assert.equal(app.evaluate("state.diagnosisIds.length"), 150);
  assert.equal(app.evaluate("state.profile.gender"), "men");
});

test("追加診断の順序を固定し、回答で順位が変わっても飛ばしや重複を起こさない", () => {
  const app = appHarness();
  app.evaluate("startRefinementRound(false, false)");
  const queue = Array.from(app.evaluate("state.recommendationQueue"));
  for (let index = 0; index < 6; index++) {
    assert.equal(app.evaluate("currentRoundLooks()[state.recommendationCurrent].id"), queue[index]);
    app.evaluate("recordRecommendationChoice('like')");
  }
  assert.equal(app.evaluate("state.recommendationHistory.length"), 6);
  assert.equal(app.evaluate("state.recommendationCompleted"), true);
  app.evaluate("startRefinementRound(false, false)");
  assert.equal(app.evaluate("state.recommendationRound"), 2);
  assert.ok(Array.from(app.evaluate("state.recommendationQueue")).every((id) => !queue.includes(id)));
});

test("一部だけ好きな回答を特徴に反映し、元の写真データを変更しない", () => {
  const app = appHarness();
  app.evaluate("startRefinementRound(false, false)");
  const feature = app.evaluate("currentRoundLooks()[0].features[0]");
  app.selectedDetails.push({ dataset: { feature }, value: "like" });
  app.evaluate("recordRecommendationChoice('neutral')");
  assert.equal(app.evaluate("state.recommendationHistory[0].details")[feature], "like");
  const signals = app.evaluate("recommendationInputs().cards");
  assert.ok(signals.some((card) => card.signalOnly && card.features.includes(feature)));
  assert.equal(cards.some((card) => card.neutral), false);
  app.evaluate("undoRecommendationChoice()");
  assert.equal(app.evaluate("state.recommendationHistory.length"), 0);
});

test("専門ブランドの候補には確認した公式ページと取り扱いの根拠を付ける", () => {
  assert.equal(brands.length, 11);
  assert.equal(new Set(brands.map((brand) => brand.brand)).size, 11);
  for (const brand of brands) {
    assert.ok(brand.sourceUrl.startsWith("https://"));
    assert.ok(brand.sourceSummary.length > 10);
    assert.equal(brand.specialist, true);
  }
});

test("新しい服の提案は好きな服を根拠にし、既出のID・同じ写真・無関係な候補を除外する", () => {
  const answers = [{ id: "liked", image: "seen.jpg", label: "白のワイドパンツ", tags: [], features: ["白", "ワイド"] }];
  const pool = [
    { id: "alias", image: "seen.jpg", audience: "men", tags: [], features: ["白", "ワイド"] },
    { id: "answered", image: "old.jpg", audience: "men", tags: [], features: ["白"] },
    { id: "new", image: "new.jpg", audience: "men", tags: [], features: ["白", "ワイド"] },
    { id: "duplicate", image: "new.jpg", audience: "men", tags: [], features: ["白"] },
    { id: "unrelated", image: "other.jpg", audience: "men", tags: [], features: ["黒"] },
    { id: "wrong-audience", image: "women.jpg", audience: "women", tags: [], features: ["白"] }
  ];
  const result = logic.selectNovelLooks(pool, answers, ["liked"], "men", ["answered"]);
  assert.deepEqual(result.map((look) => look.id), ["new"]);
  assert.deepEqual(result[0].evidenceIds, ["liked"]);
  assert.ok(result[0].reason.includes("白"));
  assert.deepEqual(logic.selectNovelLooks(pool, answers, [], "men"), []);
});

test("好きな服の選択が変わると、新しい服の推薦順位も変わる", () => {
  const answers = [
    { id: "white", tags: [], features: ["白", "ワイド"] },
    { id: "black", tags: [], features: ["黒", "コンパクト"] }
  ];
  const pool = answers.map((card) => ({ ...card, id: "new-" + card.id, image: card.id + ".jpg", audience: "men" }));
  assert.equal(logic.selectNovelLooks(pool, answers, ["white"], "men")[0].id, "new-white");
  assert.equal(logic.selectNovelLooks(pool, answers, ["black"], "men")[0].id, "new-black");
});

test("結果画面の提案への回答を分析に加え、別の候補に更新する", () => {
  const app = appHarness();
  const first = app.evaluate("personalizedLooks()[0].id");
  assert.ok(first);
  app.evaluate(`recordSuggestedLook(${JSON.stringify(first)}, 'like')`);
  assert.equal(app.evaluate("state.recommendationHistory[0].choice"), "like");
  assert.ok(app.evaluate("state.savedRecommendationIds").includes(first));
  assert.ok(Array.from(app.evaluate("personalizedLooks()")).every((look) => look.id !== first));
  assert.ok(app.elements.get("app").innerHTML.includes("こういう服は、どうですか？"));
  app.evaluate(`recordSuggestedLook(${JSON.stringify(first)}, 'like')`);
  assert.equal(app.evaluate("state.recommendationHistory.length"), 1);
});

test("追加診断の終了画面で今回の分析と専門ブランドの具体的な発見を提示する", () => {
  const app = appHarness();
  app.evaluate("startRefinementRound(false, false)");
  for (let index = 0; index < 6; index++) app.evaluate("recordRecommendationChoice('like')");
  const html = app.elements.get('app').innerHTML;
  assert.ok(html.includes('今回の回答から、見えてきたこと。'));
  assert.ok(html.includes('今回の判断できた6着のうち、6着が好き。'));
  assert.ok(html.includes('この診断から、新しく見てほしい服。'));
  assert.ok(html.includes('data-round-product='));
});
