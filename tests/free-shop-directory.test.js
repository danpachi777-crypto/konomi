const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('無料の調査済み店舗は地域・系統・出典を持ち、重複IDがない', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'free-shop-directory.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'shop-review-audit.js'), 'utf8'), context);
  const shops = context.window.KONOMI_FREE_SHOPS;
  assert.equal(shops.length, 276);
  assert.deepEqual(Object.fromEntries(['下北沢', '高円寺', '原宿', '吉祥寺']
    .map((area) => [area, shops.filter((shop) => shop.area === area).length])),
    { 下北沢: 163, 高円寺: 35, 原宿: 38, 吉祥寺: 40 });
  assert.equal(new Set(shops.map((shop) => shop.id)).size, shops.length);
  assert.ok(shops.every((shop) => shop.name && shop.query && shop.sourceUrl.startsWith('https://') && shop.checkedAt));
  assert.ok(shops.every((shop) => Array.isArray(shop.tags) && shop.tags.length <= 6));
  assert.ok(shops.some((shop) => shop.tags.includes('ミリタリー')));
  assert.ok(shops.some((shop) => shop.tags.includes('ガーリー')));
  assert.ok(shops.some((shop) => shop.tags.length === 0)); // insufficient evidence stays unclassified
  const reviewed = shops.filter((shop) => shop.reviewNote);
  assert.equal(reviewed.length, 5);
  assert.ok(reviewed.every((shop) => shop.reviewSourceUrl.startsWith('https://') && shop.reviewCheckedAt));
  assert.ok(reviewed.find((shop) => shop.id === 'shimo-08-a').reviewNote.includes('再確認'));
});
