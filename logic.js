(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KonomiLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ARCHETYPES = [
    {
      name: "静かなミニマル",
      tags: ["ミニマル", "モノトーン", "シンプル", "落ち着き", "直線的"],
      description: "余白のあるデザインと落ち着いた配色を選ぶタイプ。形や素材の違いを静かに楽しめます。",
      recipe: ["無地のトップス", "直線的なパンツ", "色数を抑えたアウター", "装飾の少ないシューズ"]
    },
    {
      name: "都会のストリート",
      tags: ["ストリート", "オーバーサイズ", "都会的", "レイヤード", "スポーティ"],
      description: "ゆとりのあるシルエットと、街に映えるバランスが好きなタイプ。重ね着がよいアクセントになります。",
      recipe: ["存在感のあるアウター", "ゆったりしたトップス", "ワイドボトム", "ボリュームのあるスニーカー"]
    },
    {
      name: "自然体のリラックス",
      tags: ["ナチュラル", "アースカラー", "リラックス", "やわらかい", "ベーシック"],
      description: "肌になじむ色と、力の抜けた着心地を好むタイプ。自然な素材感が魅力を引き立てます。",
      recipe: ["生成りのトップス", "落ち感のあるボトム", "自然素材の羽織り", "軽いフラットシューズ"]
    },
    {
      name: "端正なクラシック",
      tags: ["クラシック", "きれいめ", "上品", "落ち着き", "ベーシック"],
      description: "長く使える形と、整った印象を大切にするタイプ。小物で品よく個性を加えられます。",
      recipe: ["襟のあるトップス", "センタープレスのボトム", "端正なジャケット", "革の小物"]
    },
    {
      name: "自由なカラーミックス",
      tags: ["カラフル", "個性的", "コントラスト", "暖色", "軽快"],
      description: "色や柄からエネルギーを受け取るタイプ。主役を一つ決めると、日常でも取り入れやすくなります。",
      recipe: ["主役になる色のトップス", "無地のボトム", "色を拾う小物", "シンプルなシューズ"]
    },
    {
      name: "柔らかなフェミニン",
      tags: ["フェミニン", "淡色", "やわらかい", "上品", "クラシック"],
      description: "柔らかな輪郭と穏やかな色合わせが好きなタイプ。素材の動きや繊細なディテールが似合います。",
      recipe: ["柔らかな素材のトップス", "動きのあるボトム", "淡色の羽織り", "小ぶりなアクセサリー"]
    },
    {
      name: "エッジのあるモード",
      tags: ["モード", "モノトーン", "直線的", "個性的", "都会的"],
      description: "シャープな形と意外性のある組み合わせを好むタイプ。色を絞るほど輪郭が際立ちます。",
      recipe: ["構築的なトップス", "黒のワイドボトム", "形の強いアウター", "一点だけ印象的な小物"]
    }
  ];

  function countTags(cards, likedIds) {
    const liked = new Set(likedIds);
    return cards.reduce((scores, card) => {
      if (!liked.has(card.id)) return scores;
      card.tags.forEach((tag) => { scores[tag] = (scores[tag] || 0) + 1; });
      return scores;
    }, {});
  }

  function rankTags(scores) {
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([tag, count]) => ({ tag, count }));
  }

  function getArchetype(scores) {
    return ARCHETYPES
      .map((archetype) => ({
        ...archetype,
        match: archetype.tags.reduce((sum, tag) => sum + (scores[tag] || 0), 0)
      }))
      .sort((a, b) => b.match - a.match)[0];
  }

  function calculateProfile(cards, likedIds) {
    const scores = countTags(cards, likedIds);
    const ranked = rankTags(scores);
    const fallback = ARCHETYPES[2];
    const archetype = ranked.length ? getArchetype(scores) : fallback;
    const max = Math.max(1, ...ranked.map((item) => item.count));
    return {
      scores,
      topTags: ranked.slice(0, 5).map((item) => ({ ...item, percent: Math.round((item.count / max) * 100) })),
      archetype,
      likedCount: likedIds.length
    };
  }

  function selectRecommendations(cards, likedIds, limit = 6) {
    const liked = new Set(likedIds);
    const profile = calculateProfile(cards, likedIds);
    return cards
      .filter((card) => !liked.has(card.id))
      .map((card) => ({
        ...card,
        affinity: card.tags.reduce((sum, tag) => sum + (profile.scores[tag] || 0), 0)
      }))
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, limit);
  }

  return { ARCHETYPES, countTags, rankTags, getArchetype, calculateProfile, selectRecommendations };
});
