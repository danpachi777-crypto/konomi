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

test("診断カード30枚が一意のIDと4つのタグを持つ", () => {
  const cards = loadCards();
  assert.equal(cards.length, 30);
  assert.equal(new Set(cards.map((card) => card.id)).size, 30);
  cards.forEach((card) => assert.equal(card.tags.length, 4));
});

test("診断画像がすべてプロジェクト内に存在する", () => {
  const cards = loadCards();
  cards.forEach((card) => {
    assert.equal(card.image.startsWith("assets/outfits/"), true);
    assert.equal(fs.existsSync(path.join(__dirname, "..", card.image)), true, card.image);
  });
});
