const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCards() {
  const source = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.KONOMI_CARDS;
}

test("診断カード54枚が一意のIDと4つのタグを持つ", () => {
  const cards = loadCards();
  assert.equal(cards.length, 54);
  assert.equal(new Set(cards.map((card) => card.id)).size, 54);
  cards.forEach((card) => {
    assert.equal(card.tags.length, 4);
    assert.equal(["women", "men", "all"].includes(card.audience), true);
  });
});

test("細分化した主要テイストを診断カードがカバーする", () => {
  const tags = new Set(loadCards().flatMap((card) => card.tags));
  ["きれいめ", "カジュアル", "ストリート", "韓国系", "モード", "古着", "アメカジ", "シティーボーイ", "スポーティ", "アウトドア", "Y2K"].forEach((tag) => {
    assert.equal(tags.has(tag), true, tag);
  });
});

test("診断画像がすべてプロジェクト内に存在する", () => {
  const cards = loadCards();
  cards.forEach((card) => {
    assert.equal(card.image.startsWith("assets/outfits/"), true);
    assert.equal(fs.existsSync(path.join(__dirname, "..", card.image)), true, card.image);
  });
});
