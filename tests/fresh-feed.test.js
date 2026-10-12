const test = require('node:test');
const assert = require('node:assert/strict');
const cards = require('../data.js');
const { diagnosisQueue } = require('../diagnosis-pool.js');
const { rankFreshFeed, shopLinksForLook } = require('../fresh-feed.js');

test('フィードは診断済みと表示済みの写真を再表示しない', () => {
  const diagnosisIds = diagnosisQueue(cards, 'men', 150, () => 0.5);
  const first = rankFreshFeed(cards, { audience: 'men', diagnosisIds });
  assert.ok(first.length > 12);
  assert.ok(first.every(card => !diagnosisIds.includes(card.id) && card.audience === 'men'));
  const second = rankFreshFeed(cards, { audience: 'men', diagnosisIds, seenIds: first.slice(0, 12).map(card => card.id) });
  assert.deepEqual(second.map(card => card.id), first.slice(12).map(card => card.id));
});

test('手持ち服の系統で絞り込み、回答を次の順序に反映する', () => {
  const diagnosisIds = diagnosisQueue(cards, 'women', 150, () => 0.5);
  const first = rankFreshFeed(cards, { audience: 'women', diagnosisIds });
  const styleId = first[0].styleId;
  const narrowed = rankFreshFeed(cards, { audience: 'women', diagnosisIds, wardrobeStyleId: styleId });
  assert.ok(narrowed.length > 0);
  assert.ok(narrowed.every(card => card.styleId === styleId));
  const disliked = first[0];
  const reranked = rankFreshFeed(cards, { audience: 'women', diagnosisIds,
    recommendationHistory: [{ id: 'r-' + disliked.id, choice: 'no' }] });
  assert.ok(!reranked.some(card => card.id === disliked.id));
});

test('購入リンクは公式HTTPSの既存カタログから対象に合う候補を返す', () => {
  const products = [
    { id: 'a', url: 'https://example.com/a', audiences: ['men'], tags: ['ストリート'], features: [], category: 'パンツ', priceBand: 'standard' },
    { id: 'b', url: 'https://example.com/b', audiences: ['women'], tags: ['ストリート'], features: [], category: 'パンツ', priceBand: 'standard' }
  ];
  const result = shopLinksForLook(products, { tags: ['ストリート'], features: [] }, 'men', 'standard', 'top');
  assert.deepEqual(result.map(item => item.id), ['a']);
});
