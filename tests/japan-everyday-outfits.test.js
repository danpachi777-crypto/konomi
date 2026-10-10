const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cards = require('../data.js');
const plan = require('../scripts/japan-everyday-outfits.json');
const manifest = require('../assets/photo-sources.json');

test('日本向けに追加した12種類の実写を初回と追加診断で使える', () => {
  assert.equal(plan.length, 12);
  assert.equal(new Set(plan.map(([, pexelsId]) => pexelsId)).size, 12);
  const byId = new Map(cards.map(card => [card.id, card]));
  const bySource = new Map(manifest.items.map(item => [item.id, item]));
  for (const [id, pexelsId] of plan) {
    const card = byId.get(id), source = bySource.get(id);
    assert.ok(card && source, id);
    assert.equal(source.pexelsId, pexelsId);
    assert.equal(source.category, card.category);
    assert.equal(source.audience, card.audience);
    assert.ok(fs.statSync(path.join(__dirname, '..', source.localPath)).size > 20000);
  }
  for (const audience of ['men', 'women']) {
    assert.equal(cards.filter(card => card.audience === audience && !card.generated).length, 58);
    assert.equal(cards.filter(card => card.audience === audience && card.phase === 'initial').length, audience === 'men' ? 14 : 12);
    assert.ok(cards.some(card => card.audience === audience && card.phase === 'refinement' && card.jpDailyLook));
  }
});
