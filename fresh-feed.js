function rankFreshFeed(cards, options = {}) {
  const { audience = 'all', diagnosisIds = [], history = [], likedIds = [],
    recommendationHistory = [], seenIds = [], wardrobeStyleId = '' } = options;
  const excluded = new Set([...diagnosisIds, ...seenIds,
    ...recommendationHistory.map(entry => String(entry.id).replace(/^r-/, ''))]);
  const byId = new Map(cards.map(card => [card.id, card]));
  const styleScores = new Map(), tagScores = new Map(), voted = new Set();
  function vote(card, value) {
    if (!card || voted.has(card.id)) return;
    voted.add(card.id);
    if (card.styleId) styleScores.set(card.styleId, (styleScores.get(card.styleId) || 0) + value * 3);
    for (const tag of card.tags || []) tagScores.set(tag, (tagScores.get(tag) || 0) + value);
  }
  for (const entry of history) vote(byId.get(entry.id), entry.choice === 'like' ? 1 : entry.choice === 'no' ? -1 : 0);
  for (const id of likedIds) vote(byId.get(id), 1);
  for (const entry of recommendationHistory) {
    const card = byId.get(String(entry.id).replace(/^r-/, ''));
    if (card) { voted.delete(card.id); vote(card, entry.choice === 'like' ? 1 : entry.choice === 'no' ? -1 : 0); }
  }
  const usedImages = new Set();
  return cards.map((card, index) => ({ card, index }))
    .filter(({ card }) => card.image && card.styleId && !excluded.has(card.id) &&
      (audience === 'all' || card.audience === audience))
    .map(({ card, index }) => ({ card, index,
      score: (styleScores.get(card.styleId) || 0) +
        (card.tags || []).reduce((sum, tag) => sum + (tagScores.get(tag) || 0), 0) +
        (wardrobeStyleId && card.styleId === wardrobeStyleId ? 20 : 0) }))
    .filter(({ card }) => !wardrobeStyleId || card.styleId === wardrobeStyleId)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .filter(({ card }) => { if (usedImages.has(card.image)) return false; usedImages.add(card.image); return true; })
    .map(({ card }) => card);
}
function shopLinksForLook(products, card, audience = 'all', budget = 'standard', ownedCategory = '', limit = 2) {
  const complement = { top: /ボトムス|パンツ|スカート|デニム/, bottom: /トップス|シャツ|アウター|ジャケット/,
    outer: /トップス|ボトムス|パンツ|スカート/, shoes: /トップス|ボトムス|パンツ|スカート/ }[ownedCategory];
  return products.filter(product => product.url && (audience === 'all' ||
    product.audiences?.includes(audience) || product.audiences?.includes('all')))
    .map(product => ({ product, score:
      (product.tags || []).filter(tag => (card.tags || []).includes(tag)).length * 3 +
      (product.features || []).filter(feature => (card.features || []).includes(feature)).length * 2 +
      (product.priceBand === budget ? 1 : 0) + (complement?.test(product.category) ? 2 : 0) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .slice(0, limit).map(entry => entry.product);
}
if (typeof module === 'object' && module.exports) module.exports = { rankFreshFeed, shopLinksForLook };
else window.KonomiFreshFeed = { rankFreshFeed, shopLinksForLook };
