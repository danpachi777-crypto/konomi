const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const cards = require('../data.js');
const logic = require('../logic.js');

test('全診断写真に現在のJPEGから計算したPythonの解析結果が付く', () => {
  for (const card of cards) {
    assert.equal(card.imageAnalysis.method, 'central-region-colors-v1');
    const source = fs.readFileSync(path.join(__dirname, '..', card.image));
    assert.equal(card.imageAnalysis.sha256, crypto.createHash('sha256').update(source).digest('hex'));
    assert.ok(Math.abs(card.imageAnalysis.palette.reduce((sum, color) => sum + color.share, 0) - 1) < 0.001);
  }
});

test('写真の色は回答を基に候補の補助点となり、保留は色の好みに含めない', () => {
  const make = (id, name) => ({ id, tags: [], features: [], imageAnalysis: { palette: [{ name, share: 1 }] } });
  const blue = make('blue', '青');
  const red = make('red', '赤');
  const preference = logic.buildPreference([blue, red], ['blue']);
  assert.ok(logic.scoreCandidate(blue, preference).affinity > logic.scoreCandidate(red, preference).affinity);
  assert.deepEqual(preference.photoColorSummary, ['青']);
  assert.deepEqual(logic.buildPreference([{ ...blue, neutral: true }], ['blue']).photoColorSummary, []);
});
