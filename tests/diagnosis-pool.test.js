const test = require('node:test');
const assert = require('node:assert/strict');
const cards = require('../data.js');
const { diagnosisQueue, newFavoriteLooks, styleOf } = require('../diagnosis-pool.js');

test('150枚の診断は系統を幅広く含み、順序は抽選ごとに変わる', () => {
  for (const audience of ['men', 'women']) {
    const queue = diagnosisQueue(cards, audience, 150, Math.random);
    assert.equal(queue.length, 150);
    assert.equal(new Set(queue).size, 150);
    const byId = new Map(cards.map(card => [card.id, card]));
    assert.ok(queue.every(id => byId.get(id)?.audience === audience));
    assert.equal(new Set(queue.map(id => styleOf(byId.get(id)))).size, audience === 'men' ? 14 : 12);
    const another = diagnosisQueue(cards, audience, 150, Math.random);
    assert.notDeepEqual(queue, another);
  }
});

test('「あなたが好きな服」は診断で見た画像を再利用せず、好きな系統を先に出す', () => {
  const audience = 'men';
  const diagnosisIds = diagnosisQueue(cards, audience);
  const byId = new Map(cards.map(card => [card.id, card]));
  const preferred = diagnosisIds.filter(id => styleOf(byId.get(id)) === 'men_trad').slice(0, 3);
  const history = preferred.map(id => ({ id, choice: 'like' }));
  const fresh = newFavoriteLooks(cards, history, preferred, diagnosisIds, audience, 60);
  assert.ok(fresh.length >= 20);
  assert.ok(fresh.every(card => !diagnosisIds.includes(card.id)));
  assert.ok(fresh.every(card => card.audience === audience));
  assert.equal(styleOf(fresh[0]), 'men_trad');
  const usedImages = new Set(diagnosisIds.map(id => byId.get(id).image));
  assert.ok(fresh.every(card => !usedImages.has(card.image)));
});
