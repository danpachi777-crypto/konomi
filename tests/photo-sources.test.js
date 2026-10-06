const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets", "photo-sources.json"), "utf8"));

test("表示写真すべてに一意のPexels出典記録がある", () => {
  assert.equal(manifest.schemaVersion, 2);
  assert.ok(manifest.items.length >= 52);
  assert.equal(new Set(manifest.items.map((item) => item.pexelsId)).size, manifest.items.length);
  assert.equal(new Set(manifest.items.map((item) => item.localPath)).size, manifest.items.length);
});

test("写真はPexelsライセンスで対象方向とカテゴリーを明記している", () => {
  for (const item of manifest.items) {
    assert.equal(item.source, "Pexels");
    assert.equal(item.license, "Pexels License");
    assert.match(item.sourcePage, /^https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+-\d+\/$/);
    assert.equal(item.description.length > 3, true, item.id);
    assert.equal(["men", "women"].includes(item.audience), true, item.id);
    assert.equal(item.category.length > 0, true, item.id);
    assert.equal(item.outfitVisibility, "full-or-readable-coordination");
    assert.equal(item.manuallyReviewed, true);
  }
  assert.equal(manifest.items.filter((item) => item.audience === "men").length, manifest.items.length / 2);
  assert.equal(manifest.items.filter((item) => item.audience === "women").length, manifest.items.length / 2);
});

test("出典台帳のJPEGがローカルに完全な形で存在する", () => {
  for (const item of manifest.items) {
    assert.match(item.localPath, /^assets\/outfits\/(men|women)-[a-z0-9-]+\.jpg$/);
    const bytes = fs.readFileSync(path.join(root, item.localPath));
    assert.equal(bytes.length > 20_000, true, item.localPath);
    assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], `${item.localPath}のJPEG開始マーカー`);
    assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9], `${item.localPath}のJPEG終了マーカー`);
  }
});

test("表示用ディレクトリに旧生成PNGが残っていない", () => {
  for (const directory of ["outfits", "recommendations"]) {
    const pngFiles = fs.readdirSync(path.join(root, "assets", directory)).filter((name) => name.endsWith(".png"));
    assert.deepEqual(pngFiles, []);
  }
  assert.equal(fs.existsSync(path.join(root, "assets", "sheets")), false);
});

test("診断データで参照する写真と出典台帳が一致する", () => {
  const cards = require("../data.js");
  assert.deepEqual(
    new Set(cards.map((card) => card.image)),
    new Set(manifest.items.map((item) => item.localPath))
  );
});
