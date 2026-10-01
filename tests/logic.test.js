const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateProfile,
  selectRecommendations,
  selectPersonalizedLooks,
  filterCardsByAudience,
  selectProductRecommendations,
  selectShopRecommendations
} = require("../logic.js");

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
