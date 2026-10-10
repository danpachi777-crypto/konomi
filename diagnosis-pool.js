(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.window || root).KonomiDiagnosisPool = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const fallbackStyles = {
    men: { '古着・ヴィンテージ': 'men_work', 'Y2Kリバイバル': 'men_street', '静かなミニマル': 'men_normcore', '自然体ナチュラル': 'men_normcore' },
    women: { 'ソウル・韓国系': 'women_adult', '古着・ヴィンテージ': 'women_rock', '王道アメカジ': 'women_casual', 'シティーボーイ系': 'women_trad', 'アクティブ・スポーティ': 'women_outdoor', 'Y2Kリバイバル': 'women_gyaru', '自然体ナチュラル': 'women_casual' }
  };
  function styleOf(card) { return card.styleId || fallbackStyles[card.audience]?.[card.category] || null; }
  function shuffle(items, random = Math.random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function diagnosisQueue(cards, audience, limit = 150, random = Math.random) {
    const groups = new Map();
    for (const card of cards) {
      if (audience !== 'all' && card.audience !== audience) continue;
      const style = styleOf(card);
      if (!style) continue;
      if (!groups.has(style)) groups.set(style, []);
      groups.get(style).push(card);
    }
    for (const [style, items] of groups) groups.set(style, shuffle(items, random));
    const order = shuffle([...groups.keys()], random);
    const total = [...groups.values()].reduce((sum, items) => sum + items.length, 0);
    let reserveBudget = Math.max(0, total - limit);
    // Keep unseen looks in every style so the result can show genuinely new photos.
    while (reserveBudget > 0) {
      let reservedThisPass = 0;
      for (const style of order) {
        const items = groups.get(style);
        if (items.length > 1 && reserveBudget > 0) { items.pop(); reserveBudget--; reservedThisPass++; }
      }
      if (!reservedThisPass) break;
    }
    const picked = [];
    while (picked.length < limit && order.some(style => groups.get(style).length)) {
      for (const style of order) {
        const card = groups.get(style).pop();
        if (card) picked.push(card.id);
        if (picked.length === limit) break;
      }
    }
    return picked;
  }
  function newFavoriteLooks(cards, history, likedIds, diagnosisIds, audience, limit = 40) {
    const seen = new Set(diagnosisIds);
    const likes = new Set(likedIds);
    const scores = new Map();
    for (const entry of history) {
      const card = cards.find(item => item.id === entry.id);
      const style = card && styleOf(card);
      if (!style) continue;
      scores.set(style, (scores.get(style) || 0) + (entry.choice === 'like' ? 2 : entry.choice === 'no' ? -1 : 0));
    }
    for (const id of likes) {
      if (history.some(entry => entry.id === id)) continue;
      const card = cards.find(item => item.id === id);
      const style = card && styleOf(card);
      if (style) scores.set(style, (scores.get(style) || 0) + 2);
    }
    return cards.filter(card => (audience === 'all' || card.audience === audience) && styleOf(card) && !seen.has(card.id))
      .map((card, index) => ({ card, index, score: scores.get(styleOf(card)) || 0 }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit).map(item => item.card);
  }
  return { styleOf, diagnosisQueue, newFavoriteLooks };
});
