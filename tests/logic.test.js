const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateProfile,
  rankStylePreferences,
  rankAnsweredStyles,
  selectStyleWeightedLooks,
  selectRecommendations,
  selectPersonalizedLooks,
  filterCardsByAudience,
  selectProductRecommendations,
  selectShopRecommendations
} = require("../logic.js");

test('結果の割合は実際に判断した写真だけを分母にする', () => {
  const photos = ['a', 'b', 'c', 'd'].map((id) => ({ id, audience: 'men',
    styleId: 'men_trad', category: 'トラッド' }));
  const ranked = rankAnsweredStyles(photos, [
    { id: 'a', choice: 'like' }, { id: 'b', choice: 'like' },
    { id: 'c', choice: 'no' }, { id: 'd', choice: 'skip' }
  ], 'men');
  assert.equal(ranked[0].likes, 2);
  assert.equal(ranked[0].answered, 3);
  assert.equal(ranked[0].percentage, 67);
});

test('系統の候補配分は割合と回答数を使い、再表示した写真を二重に数えない', () => {
  const photos = [...Array.from({ length: 10 }, (_, index) => ({ id: `a${index}`,
    audience: 'men', styleId: 'a', category: 'A' })),
  { id: 'b0', audience: 'men', styleId: 'b', category: 'B' }];
  const history = photos.map((photo, index) => ({ id: photo.id, choice: index < 8 || index === 10 ? 'like' : 'no' }));
  history.push({ id: 'r-a0', choice: 'skip' });
  const styles = rankAnsweredStyles(photos, history, 'men');
  assert.equal(styles[0].id, 'a');
  assert.equal(styles[0].percentage, 80);
  assert.equal(styles[0].answered, 10);
  assert.equal(styles[1].percentage, 100);
  assert.equal(styles[1].answered, 1);
  assert.ok(styles[0].weight > styles[1].weight);
  const candidates = [...Array.from({ length: 8 }, (_, index) => ({ id: `look-a${index}`, styleId: 'a' })),
    ...Array.from({ length: 8 }, (_, index) => ({ id: `look-b${index}`, styleId: 'b' }))];
  const selected = selectStyleWeightedLooks(candidates, styles, [], 6);
  assert.equal(selected.length, 6);
  assert.ok(selected.filter((look) => look.styleId === 'a').length >
    selected.filter((look) => look.styleId === 'b').length);
  assert.equal(new Set(selected.map((look) => look.id)).size, 6);
});

const cards = [
  { id: "a", tags: ["ミニマル", "モノトーン"] },
  { id: "b", tags: ["ミニマル", "落ち着き"] },
  { id: "c", tags: ["カラフル", "個性的"] },
  { id: "d", tags: ["モノトーン", "都会的"] }
];

test("好きに選んだカードだけから上位タグを計算する", () => {
  const profile = calculateProfile(cards, ["a", "b"]);
  assert.equal(profile.topTags[0].tag, "ミニマル");
  assert.equal(profile.topTags[0].count, 2);
  assert.equal(profile.likedCount, 2);
});

test("未選択カードのうち好みと共通タグが多いものを先に提案する", () => {
  const recommendations = selectRecommendations(cards, ["a"], 2);
  assert.equal(recommendations[0].id, "b");
  assert.equal(recommendations[1].id, "d");
});

test("共通タグだけでなく服カテゴリーの選択数を優先して診断する", () => {
  const categorizedCards = [
    { id: "s1", category: "都会派ストリート", tags: ["ストリート", "モノトーン"] },
    { id: "s2", category: "都会派ストリート", tags: ["ストリート", "カラフル"] },
    { id: "m1", category: "静かなミニマル", tags: ["ミニマル", "モノトーン"] }
  ];
  const profile = calculateProfile(categorizedCards, ["s1", "s2", "m1"]);
  assert.equal(profile.categoryScores["都会派ストリート"], 2);
  assert.equal(profile.archetype.name, "都会派ストリート");
});

test("診断結果と性別に合わせて別ライブラリのコーデを並べる", () => {
  const diagnosis = [
    { id: "d1", audience: "women", tags: ["韓国系", "きれいめ"] },
    { id: "d2", audience: "women", tags: ["ストリート"] }
  ];
  const looks = [
    { id: "r1", audience: "women", tags: ["韓国系", "きれいめ"] },
    { id: "r2", audience: "women", tags: ["ストリート"] },
    { id: "r3", audience: "men", tags: ["韓国系", "きれいめ"] }
  ];
  const selected = selectPersonalizedLooks(looks, diagnosis, ["d1"], "women", 3);
  assert.deepEqual(selected.map((look) => look.id), ["r1", "r2"]);
  assert.ok(selected[0].affinity > selected[1].affinity);
  assert.deepEqual(selected[0].matches, ["韓国系", "きれいめ"]);
});

test("選択した性別に合う診断カードだけを表示する", () => {
  const audienceCards = [
    { id: "w", audience: "women" },
    { id: "m", audience: "men" },
    { id: "a", audience: "all" }
  ];
  assert.deepEqual(filterCardsByAudience(audienceCards, "women").map((card) => card.id), ["w", "a"]);
  assert.deepEqual(filterCardsByAudience(audienceCards, "men").map((card) => card.id), ["m", "a"]);
  assert.equal(filterCardsByAudience(audienceCards, "all").length, 3);
});

test("診断で好きと答えた系統を結果に出し、同じ系統の服を先に流す", () => {
  const diagnosis = [
    { id: "military", audience: "men", styleId: "men_military", category: "ミリタリー", tags: ["ミリタリー", "カーゴ"], features: [] },
    { id: "street", audience: "men", styleId: "men_street", category: "ストリート", tags: ["ストリート", "カーゴ"], features: [] }
  ];
  assert.equal(rankStylePreferences(diagnosis, ["military"], "men")[0].name, "ミリタリー");
  const looks = [
    { id: "other", audience: "men", styleId: "men_street", category: "ストリート", tags: ["カーゴ"], features: [] },
    { id: "match", audience: "men", styleId: "men_military", category: "ミリタリー", tags: ["カーゴ"], features: [] }
  ];
  assert.equal(selectPersonalizedLooks(looks, diagnosis, ["military"], "men")[0].id, "match");
});

test("実在商品を性別と好みの一致度で絞り込む", () => {
  const taggedCards = [
    { id: "a", tags: ["ミニマル"], audience: "women" },
    { id: "b", tags: ["ストリート"], audience: "women" }
  ];
  const sampleProducts = [
    { id: "p1", audiences: ["women"], tags: ["ミニマル"] },
    { id: "p2", audiences: ["women"], tags: ["ストリート"] },
    { id: "p3", audiences: ["men"], tags: ["ミニマル"] }
  ];
  const recommendations = selectProductRecommendations(sampleProducts, taggedCards, ["a"], "women", "standard", 3);
  assert.deepEqual(recommendations.map((product) => product.id), ["p1", "p2"]);
});

test("店舗を診断テイストとの一致度で並べる", () => {
  const taggedCards = [
    { id: "a", tags: ["Y2K", "韓国系"] },
    { id: "b", tags: ["アウトドア"] }
  ];
  const sampleShops = [
    { id: "trend", tags: ["Y2K", "韓国系"] },
    { id: "outdoor", tags: ["アウトドア"] }
  ];
  const recommendations = selectShopRecommendations(sampleShops, taggedCards, ["a"], 2);
  assert.equal(recommendations[0].id, "trend");
});

test("Y2Kの選択を細分化した診断タイプとして返す", () => {
  const y2kCards = [
    { id: "y1", tags: ["Y2K", "コンパクト", "デニム"] },
    { id: "y2", tags: ["Y2K", "光沢", "個性的"] }
  ];
  const profile = calculateProfile(y2kCards, ["y1", "y2"]);
  assert.equal(profile.archetype.name, "Y2Kリバイバル");
  assert.equal(profile.topArchetypes[0].name, "Y2Kリバイバル");
});
