const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const cards = require('../data.js');
const looks = require('../recommendations.js');
const generated = require('../generated-outfits.js');
const manifest = require('../assets/generated-photo-sources.json');

test('diagnosis and result pools each more than double for both audiences', () => {
  assert.ok(generated.length >= 216);
  assert.ok(cards.length >= 368);
  assert.ok(looks.length >= 368);
  for (const audience of ['men', 'women']) {
    assert.ok(cards.filter(card => card.audience === audience).length > 152);
    assert.ok(looks.filter(look => look.audience === audience).length > 152);
  }
  assert.equal(new Set(cards.map(card => card.image)).size, cards.length);
  assert.equal(new Set(looks.map(look => look.image)).size, looks.length);
});

test('every generated look has one packaged photograph and disclosed source sheet', () => {
  assert.equal(manifest.items.length, generated.length);
  assert.deepEqual(new Set(manifest.items.map(item => item.id)), new Set(generated.map(item => item.id)));
  for (const item of manifest.items) {
    assert.equal(item.generated, true);
    assert.equal(item.manuallyReviewed, true);
    assert.match(item.localPath, /^assets\/generated\/(?:men|women|mix)[\w-]*\.jpg$/);
    const image = fs.readFileSync(path.join(root, item.localPath));
    assert.ok(image.length > 20_000, item.id);
    assert.deepEqual([...image.subarray(0, 2)], [0xff, 0xd8]);
    assert.equal(fs.existsSync(path.join(root, item.sourceSheet)), true);
  }
});
