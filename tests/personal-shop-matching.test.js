const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { selectPersonalShopRecommendations } = require('../logic.js');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'free-shop-directory.js'), 'utf8'), context);
const shimokitazawa = context.window.KONOMI_FREE_SHOPS.filter((shop) => shop.area === '下北沢');

test('好きと答えた系統ごとに、根拠のある別の店を自動で選ぶ', () => {
  const amekaji = selectPersonalShopRecommendations(shimokitazawa,
    [{ id: 'men_amekaji', name: 'アメカジ', likes: 1, score: 2 }], 'men', 8);
  const girly = selectPersonalShopRecommendations(shimokitazawa,
    [{ id: 'women_girly', name: 'ガーリー系', likes: 1, score: 2 }], 'women', 8);
  assert.ok(amekaji.length > 0);
  assert.ok(girly.length > 0);
  assert.ok(amekaji.every((shop) => shop.tags.some((tag) => ['アメカジ', 'デニム'].includes(tag))));
  assert.ok(girly.every((shop) => shop.tags.some((tag) => ['ガーリー', 'フェミニン', 'レトロ'].includes(tag))));
  assert.ok(amekaji.every((shop) => !shop.audiences.includes('women')));
  assert.ok(girly.every((shop) => !shop.audiences.includes('men')));
  assert.notEqual(amekaji[0].id, girly[0].id);
  assert.ok(amekaji[0].personalReason.includes('アメカジ'));
});

test('好みの根拠がない場合や弱い場合は個別推薦を作らない', () => {
  assert.deepEqual(selectPersonalShopRecommendations(shimokitazawa, [], 'men'), []);
  assert.deepEqual(selectPersonalShopRecommendations(shimokitazawa,
    [{ id: 'men_amekaji', name: 'アメカジ', likes: 1, score: 0 }], 'men'), []);
});

test('Shop の個別推薦は更新後の系統の重みで並び替わる', () => {
  const shops = [
    { id: 'trad', name: 'Trad', tags: ['きれいめ'], audiences: ['men'] },
    { id: 'street', name: 'Street', tags: ['ストリート'], audiences: ['men'] }
  ];
  const styles = (trad, street) => [
    { id: 'men_trad', name: 'トラッド', likes: 2, score: 3, weight: trad },
    { id: 'men_street', name: 'ストリート', likes: 2, score: 3, weight: street }
  ];
  assert.equal(selectPersonalShopRecommendations(shops, styles(0.3, 0.1), 'men')[0].id, 'trad');
  assert.equal(selectPersonalShopRecommendations(shops, styles(0.1, 0.3), 'men')[0].id, 'street');
});
