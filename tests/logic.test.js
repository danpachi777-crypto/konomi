const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateProfile, selectRecommendations } = require("../logic.js");

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
