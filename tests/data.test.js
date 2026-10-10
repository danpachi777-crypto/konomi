const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadCards() {
  const source = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");
  const generated = fs.readFileSync(path.join(__dirname, "..", "generated-outfits.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(generated, context);
  vm.runInNewContext(source, context);
  return context.window.KONOMI_CARDS;
}

test("診断カードが一意のID・対象方向・4つのタグを持つ", () => {
  const cards = loadCards();
  assert.ok(cards.length >= 52);
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
  assert.equal(cards.filter((card) => card.generated && card.phase === "initial" && card.audience === "men").length, 14);
  assert.equal(cards.filter((card) => card.generated && card.phase === "initial" && card.audience === "women").length, 12);
  cards.forEach((card) => {
    assert.equal(card.tags.length, 4);
    assert.equal(["women", "men"].includes(card.audience), true);
    assert.equal(typeof card.category, "string");
  });
});

test("従来写真の13カテゴリーを追加候補として保持する", () => {
  const cards = loadCards();
  for (const audience of ["men", "women"]) {
    const counts = cards.filter((card) => card.audience === audience && !card.generated).reduce((result, card) => {
      result[card.category] = (result[card.category] || 0) + 1;
      return result;
    }, {});
    assert.equal(Object.keys(counts).length, 13);
    assert.ok(Object.values(counts).every((count) => count >= 2));
  }
});

test("指定された26系統を初回の生成写真で一度ずつ診断する", () => {
  const cards = loadCards();
  const initial = cards.filter((card) => card.phase === "initial");
  assert.equal(initial.length, 26);
  assert.equal(new Set(initial.map((card) => card.category)).size, 26);
  assert.ok(initial.every((card) => card.generated && card.styleId));
  for (const card of initial) {
    assert.ok(cards.some((candidate) => candidate.phase === "refinement" && candidate.styleId === card.styleId && candidate.audience === card.audience), card.styleId);
  }
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
    assert.equal(card.image.startsWith(card.generatedPhoto ? "assets/generated/" : card.generated ? "assets/styles/" : "assets/outfits/"), true);
    assert.equal(fs.existsSync(path.join(__dirname, "..", card.image)), true, card.image);
  });
});
