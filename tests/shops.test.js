const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadShops() {
  const source = fs.readFileSync(path.join(__dirname, "..", "shops.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.KONOMI_SHOPS;
}

test("店舗候補が地図検索語と診断タグを持つ", () => {
  const shops = loadShops();
  assert.equal(shops.length >= 8, true);
  shops.forEach((shop) => {
    assert.equal(shop.query.length > 0, true);
    assert.equal(shop.tags.length >= 3, true);
    assert.equal(shop.officialUrl === "" || shop.officialUrl.startsWith("https://"), true);
  });
});
