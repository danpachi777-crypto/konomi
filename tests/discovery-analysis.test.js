const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeDiagnosis, selectDiscoveryRecommendations } = require('../logic.js');
const cards = [
  { id: 'a', label: '黒いワイドパンツ', tags: ['ミニマル'], features: ['黒', 'ワイド'] },
  { id: 'b', label: '黒いシャツ', tags: ['ミニマル'], features: ['黒', 'シャツ'] },
  { id: 'c', label: 'チェックシャツ', tags: ['カジュアル'], features: ['チェック', 'シャツ'] },
  { id: 'skip', label: '保留した服', tags: [], features: ['光沢'], neutral: true }
];
const products = [
  { id: 'big', brand: '大手', audiences: ['all'], tags: ['ミニマル'], features: ['黒', 'ワイド'], name: 'パンツを比較' },
  { id: 'small', brand: '専門', specialist: true, audiences: ['men'], tags: ['ミニマル'], features: ['黒', 'リネン'], name: 'リネンの服を比較' },
  { id: 'other', brand: '別方向', specialist: true, audiences: ['all'], tags: ['スポーツ'], features: ['蛍光色'], name: 'スポーツ服を比較' },
  { id: 'women', brand: '女性向け', specialist: true, audiences: ['women'], tags: ['ミニマル'], features: ['黒'], name: 'トップスを比較' }
];
test('今回の回答と累積の好みを区別し、保留や嫌いを好きの根拠にしない', () => {
  const report = analyzeDiagnosis(cards, ['a', 'b'], ['b', 'c', 'skip']);
  assert.equal(report.roundAnswered, 2);
  assert.equal(report.roundLiked, 1);
  assert.ok(report.latestSignals.includes('黒'));
  assert.ok(!report.signals.some((item) => item.feature === '光沢' || item.feature === 'チェック'));
  assert.deepEqual(report.signals.find((item) => item.feature === '黒').evidence.map((item) => item.id), ['a', 'b']);
});
test('好みの根拠がある専門候補を優先し、新しい要素と具体的な探し方を提示する', () => {
  const result = selectDiscoveryRecommendations(products, cards, ['a', 'b'], 'men');
  assert.equal(result[0].id, 'small');
  assert.deepEqual(result[0].anchor, ['黒']);
  assert.deepEqual(result[0].explore, ['リネン']);
  assert.match(result[0].discoveryReason, /黒.*リネンの服を比較/);
  assert.ok(!result.some((item) => ['other', 'women'].includes(item.id)));
});
test('好みと違う候補を除外し、好きがない場合はおすすめを捏造しない', () => {
  assert.ok(!selectDiscoveryRecommendations(products, cards, ['a'], 'men', 'standard', { small: 'no' }).some((item) => item.id === 'small'));
  assert.deepEqual(selectDiscoveryRecommendations(products, cards, [], 'men'), []);
});
