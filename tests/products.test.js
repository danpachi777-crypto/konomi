const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadProducts() {
  const source = fs.readFileSync(path.join(__dirname, "..", "products.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.KONOMI_PRODUCTS;
}

test("実在商品データが公式HTTPSリンクと推薦タグを持つ", () => {
  const products = loadProducts();
  assert.equal(products.length >= 8, true);
  products.forEach((product) => {
    assert.equal(product.url.startsWith("https://"), true);
    assert.equal(product.tags.length >= 2, true);
    assert.equal(product.audiences.length >= 1, true);
    assert.equal(["value", "standard", "premium"].includes(product.priceBand), true);
  });
});
