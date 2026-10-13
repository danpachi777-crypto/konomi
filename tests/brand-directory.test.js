const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const directory = require("../brand-directory.js");

function diagnosisStyles() {
  const context = { window: {} };
  for (const file of ["generated-outfits.js", "data.js"]) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
  }
  return context.window.KONOMI_CARDS.filter((card) => card.generated && card.phase === "initial");
}

test("ブランド一覧が診断の26系統と94ブランドをすべてカバーする", () => {
  const styles = diagnosisStyles();
  assert.equal(directory.groups.length, 26);
  assert.equal(directory.countBrands(), 94);
  assert.deepEqual(
    new Set(directory.groups.map((group) => group.styleId)),
    new Set(styles.map((style) => style.styleId))
  );
  for (const group of directory.groups) {
    assert.equal(group.styleId.startsWith(`${group.audience}_`), true);
    assert.ok(group.brands.length >= 3);
    assert.equal(new Set(group.brands.map((brand) => brand.name)).size, group.brands.length);
    for (const brand of group.brands) {
      assert.ok(brand.reason);
      assert.equal(new URL(brand.url).protocol, "https:");
    }
  }
});

test("男女・系統・キーワードを組み合わせて絞り込める", () => {
  const men = directory.filter({ audience: "men" });
  assert.equal(men.length, 14);
  assert.ok(men.every((group) => group.audience === "men"));
  const women = directory.filter({ audience: "women" });
  assert.equal(women.length, 12);
  const cos = directory.filter({ query: "cos" });
  assert.deepEqual(cos.map((group) => group.styleId), ["men_normcore", "women_basic"]);
  const narrow = directory.filter({ audience: "women", styleId: "women_military", query: "AVIREX" });
  assert.deepEqual(narrow.flatMap((group) => group.brands.map((brand) => brand.name)), ["AVIREX"]);
  assert.equal(directory.countBrands(narrow), 1);
  assert.equal(directory.filter({ audience: "men", styleId: "women_military" }).length, 0);
});

test("一覧はホームと結果から開け、常設ナビには置かず、オフラインキャッシュに登録する", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
  assert.doesNotMatch(html, /data-route="brands"/);
  assert.match(html, /brand-directory\.js\?v=/);
  assert.match(app, /function renderBrands\(\)/);
  assert.match(app, /94ブランドを系統から探す/);
  assert.match(app, /brand-directory-entry/);
  assert.match(sw, /\.\/brand-directory\.js/);
  assert.match(sw, /\.\/brand-directory\.css/);
});
