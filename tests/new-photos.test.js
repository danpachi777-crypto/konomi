const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const reviewed = require('../scripts/new-outfits-reviewed.json');
const cards = require('../data.js');
const manifest = require('../assets/photo-sources.json');
const recommendations = require('../recommendations.js');
const { selectNovelLooks } = require('../logic.js');
test('新しい26枚は従来写真と出典IDもファイル内容も異なり、追加診断に入る', () => {
  assert.equal(reviewed.length, 26);
  const ids = new Set(reviewed.map(([id]) => id));
  const old = manifest.items.filter(item => !ids.has(item.id));
  const oldSourceIds = new Set(old.map(item => item.pexelsId));
  const digest = item => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', item.localPath))).digest('hex');
  const oldHashes = new Set(old.map(digest));
  const newHashes = new Set();
  for (const [id, photoId] of reviewed) {
    assert.ok(!oldSourceIds.has(photoId));
    const source = manifest.items.find(item => item.id === id);
    assert.equal(source.pexelsId, photoId);
    const hash = digest(source);
    assert.ok(!oldHashes.has(hash));
    newHashes.add(hash);
    assert.equal(cards.find(card => card.id === id).phase, 'refinement');
  }
  assert.equal(newHashes.size, 26);
  for (const audience of ['men', 'women']) assert.equal(reviewed.filter(([id]) => id.startsWith(audience + '-')).length, 13);
});
test('従来の写真をすべて回答した人にも、新しい写真を提案できる', () => {
  const newIds = new Set(reviewed.map(([id]) => id));
  const old = cards.filter(card => card.audience === 'men' && !newIds.has(card.id));
  const liked = old.filter(card => card.features.includes('シャツ')).map(card => card.id);
  const result = selectNovelLooks(recommendations, old, liked, 'men', old.map(card => 'r-' + card.id));
  assert.ok(result.length > 0);
  assert.ok(result.every(look => newIds.has(look.id.replace(/^r-/, ''))));
});
