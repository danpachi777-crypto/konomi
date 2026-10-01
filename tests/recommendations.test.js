const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const recommendations = require("../recommendations.js");

test("おすすめ専用コーデを40件用意している", () => {
  assert.equal(recommendations.length, 40);
  assert.equal(new Set(recommendations.map((look) => look.id)).size, 40);
  assert.equal(recommendations.filter((look) => look.audience === "women").length, 20);
  assert.equal(recommendations.filter((look) => look.audience === "men").length, 20);
});

test("すべてのおすすめに説明・分析タグ・別画像がある", () => {
  for (const look of recommendations) {
    assert.ok(look.summary.length >= 20, `${look.id}の説明が短すぎます`);
    assert.equal(look.tags.length, 4);
    assert.match(look.image, /^assets\/recommendations\/recommend-\d{2}\.png$/);
    assert.equal(fs.existsSync(path.join(__dirname, "..", look.image)), true, `${look.image}がありません`);
  }
});
