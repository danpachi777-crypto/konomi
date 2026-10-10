const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const recommendations = require("../recommendations.js");

test("結果候補も男女別に十分な件数を用意している", () => {
  assert.ok(recommendations.length >= 52);
  assert.equal(new Set(recommendations.map((look) => look.id)).size, recommendations.length);
  assert.equal(recommendations.filter((look) => look.generated && look.phase === "initial" && look.audience === "men").length, 14);
  assert.equal(recommendations.filter((look) => look.generated && look.phase === "initial" && look.audience === "women").length, 12);
});

test("すべての結果候補に説明・カテゴリー・全身コーデ画像がある", () => {
  for (const look of recommendations) {
    assert.ok(look.summary.length >= 20, `${look.id}の説明が短すぎます`);
    assert.equal(look.tags.length, 4);
    assert.ok(look.category.length > 0);
    assert.match(look.image, /^assets\/(outfits|styles|generated)\//);
    assert.equal(fs.existsSync(path.join(__dirname, "..", look.image)), true, `${look.image}がありません`);
  }
});
