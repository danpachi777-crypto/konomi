(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KonomiLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ARCHETYPES = [
    {
      name: "洗練きれいめ",
      tags: ["きれいめ", "上品", "クラシック", "直線的", "ミニマル"],
      description: "清潔感のある形と整った配色を軸にするタイプ。端正なジャケットや落ち感のあるパンツが得意です。",
      recipe: ["清潔感のあるトップス", "センタープレスのボトム", "端正なジャケット", "革のシューズ"]
    },
    {
      name: "デイリーカジュアル",
      tags: ["カジュアル", "ベーシック", "リラックス", "デニム", "軽快"],
      description: "気負わず着られるベーシックを自分らしく組み合わせるタイプ。素材感とサイズ選びが印象を決めます。",
      recipe: ["着心地のよいトップス", "デニムかチノ", "軽い羽織り", "歩きやすいシューズ"]
    },
    {
      name: "都会派ストリート",
      tags: ["ストリート", "オーバーサイズ", "都会的", "レイヤード", "スポーティ"],
      description: "ゆとりのあるシルエットと、街に映えるバランスが好きなタイプ。重ね着がよいアクセントになります。",
      recipe: ["存在感のあるアウター", "ゆったりしたトップス", "ワイドボトム", "ボリュームのあるスニーカー"]
    },
    {
      name: "ソウル・韓国系",
      tags: ["韓国系", "モノトーン", "淡色", "コンパクト", "オーバーサイズ"],
      description: "韓国ファッションらしいメリハリと、ニュートラルな配色が好きなタイプ。上下のシルエット差が鍵です。",
      recipe: ["輪郭のきれいなトップス", "ワイドなボトム", "短丈かオーバーサイズの羽織り", "厚底シューズ"]
    },
    {
      name: "エッジ・モード系",
      tags: ["モード", "モノトーン", "直線的", "個性的", "都会的"],
      description: "シャープな形と意外性のある組み合わせを好むタイプ。色を絞るほど輪郭が際立ちます。",
      recipe: ["構築的なトップス", "黒のワイドボトム", "形の強いアウター", "一点だけ印象的な小物"]
    },
    {
      name: "古着・ヴィンテージ",
      tags: ["古着", "ヴィンテージ", "レイヤード", "暖色", "個性的"],
      description: "年代や素材の表情がある服に惹かれるタイプ。新品にはない色落ちや柄を主役にできます。",
      recipe: ["風合いのあるトップス", "色落ちしたボトム", "年代感のある羽織り", "レザーかキャンバスの小物"]
    },
    {
      name: "王道アメカジ",
      tags: ["アメカジ", "デニム", "ワーク", "カジュアル", "古着"],
      description: "デニムやワークウェア、カレッジ要素が好きなタイプ。丈夫な素材を自然体で着るほど魅力が出ます。",
      recipe: ["Tシャツかスウェット", "ストレートデニム", "ワーク系の羽織り", "クラシックなスニーカー"]
    },
    {
      name: "シティーボーイ系",
      tags: ["シティーボーイ", "プレッピー", "ベーシック", "ワイド", "きれいめ"],
      description: "トラッドを少し崩した、知的で余裕のある街着が好きなタイプ。シャツと太めパンツがよく似合います。",
      recipe: ["オックスフォードシャツ", "ゆるいチノパン", "ネイビー系の羽織り", "ローテクスニーカー"]
    },
    {
      name: "アクティブ・スポーティ",
      tags: ["スポーティ", "軽快", "機能的", "ストリート", "都会的"],
      description: "動きやすさと軽快な見た目を両立したいタイプ。スポーツ要素を一つだけ効かせると街着にまとまります。",
      recipe: ["機能素材のトップス", "動きやすいボトム", "トラック系の羽織り", "ランニング系スニーカー"]
    },
    {
      name: "アウトドア・ゴープコア",
      tags: ["アウトドア", "ゴープコア", "機能的", "アースカラー", "レイヤード"],
      description: "アウトドア由来の機能美を街でも楽しむタイプ。シェルやフリースを落ち着いた色でまとめるのが得意です。",
      recipe: ["速乾性のあるトップス", "ユーティリティパンツ", "シェルかフリース", "トレイルシューズ"]
    },
    {
      name: "Y2Kリバイバル",
      tags: ["Y2K", "コンパクト", "光沢", "デニム", "個性的"],
      description: "2000年代らしい大胆なバランスと遊び心が好きなタイプ。コンパクトとルーズの対比がポイントです。",
      recipe: ["コンパクトなトップス", "バギーなボトム", "光沢感のある羽織り", "存在感のあるシューズ"]
    },
    {
      name: "静かなミニマル",
      tags: ["ミニマル", "モノトーン", "落ち着き", "直線的", "淡色"],
      description: "余白のあるデザインと静かな配色を選ぶタイプ。形や素材の違いを丁寧に楽しめます。",
      recipe: ["無地のトップス", "直線的なパンツ", "色数を抑えたアウター", "装飾の少ないシューズ"]
    },
    {
      name: "自然体ナチュラル",
      tags: ["ナチュラル", "アースカラー", "リラックス", "やわらかい", "ベーシック"],
      description: "肌になじむ色と力の抜けた着心地を好むタイプ。自然な素材感が魅力を引き立てます。",
      recipe: ["生成りのトップス", "落ち感のあるボトム", "自然素材の羽織り", "軽いフラットシューズ"]
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
    return rankArchetypes(scores)[0];
  }

  function rankArchetypes(scores) {
    return ARCHETYPES
      .map((archetype) => ({
        ...archetype,
        match: archetype.tags.reduce((sum, tag) => sum + (scores[tag] || 0), 0)
      }))
      .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name, "ja"));
  }

  function calculateProfile(cards, likedIds) {
    const scores = countTags(cards, likedIds);
    const ranked = rankTags(scores);
    const fallback = ARCHETYPES[12];
    const archetype = ranked.length ? getArchetype(scores) : fallback;
    const rankedArchetypes = ranked.length ? rankArchetypes(scores) : [{ ...fallback, match: 1 }];
    const maxArchetypeMatch = Math.max(1, ...rankedArchetypes.map((item) => item.match));
    const max = Math.max(1, ...ranked.map((item) => item.count));
    return {
      scores,
      topTags: ranked.slice(0, 5).map((item) => ({ ...item, percent: Math.round((item.count / max) * 100) })),
      archetype,
      topArchetypes: rankedArchetypes.slice(0, 4).map((item) => ({
        name: item.name,
        match: item.match,
        percent: Math.round((item.match / maxArchetypeMatch) * 100)
      })),
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

  function selectPersonalizedLooks(recommendations, cards, likedIds, audience = "all", limit = 20) {
    const profile = calculateProfile(cards, likedIds);
    const topTagOrder = new Map(profile.topTags.map((item, index) => [item.tag, index]));
    return recommendations
      .filter((look) => audience === "all" || look.audience === audience || look.audience === "all")
      .map((look) => {
        const directScore = look.tags.reduce((score, tag) => score + (profile.scores[tag] || 0) * 4, 0);
        const archetypeScore = look.tags.reduce((score, tag) => score + (profile.archetype.tags.includes(tag) ? 2 : 0), 0);
        const topTagBonus = look.tags.reduce((score, tag) => {
          const position = topTagOrder.get(tag);
          return score + (position === undefined ? 0 : Math.max(1, 5 - position));
        }, 0);
        return {
          ...look,
          affinity: directScore + archetypeScore + topTagBonus,
          matches: look.tags.filter((tag) => profile.scores[tag] || profile.archetype.tags.includes(tag)).slice(0, 3)
        };
      })
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  function filterCardsByAudience(cards, audience = "all") {
    if (!audience || audience === "all") return [...cards];
    return cards.filter((card) => card.audience === audience || card.audience === "all");
  }

  function selectProductRecommendations(products, cards, likedIds, audience = "all", budget = "standard", limit = 6) {
    const profile = calculateProfile(cards, likedIds);
    return products
      .filter((product) => audience === "all" || product.audiences.includes(audience) || product.audiences.includes("all"))
      .map((product) => {
        const matches = product.tags.filter((tag) => profile.scores[tag] || profile.archetype.tags.includes(tag));
        const tagAffinity = product.tags.reduce((score, tag) => {
          return score + (profile.scores[tag] || 0) * 3 + (profile.archetype.tags.includes(tag) ? 1 : 0);
        }, 0);
        const affinity = tagAffinity + (product.priceBand === budget ? 2 : 0);
        return { ...product, affinity, matches: matches.slice(0, 3) };
      })
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  function selectShopRecommendations(shops, cards, likedIds, limit = 4) {
    const profile = calculateProfile(cards, likedIds);
    return shops
      .map((shop) => ({
        ...shop,
        matches: shop.tags.filter((tag) => profile.scores[tag] || profile.archetype.tags.includes(tag)).slice(0, 3),
        affinity: shop.tags.reduce((score, tag) => {
          return score + (profile.scores[tag] || 0) * 3 + (profile.archetype.tags.includes(tag) ? 2 : 0);
        }, 0)
      }))
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  return {
    ARCHETYPES,
    countTags,
    rankTags,
    getArchetype,
    rankArchetypes,
    calculateProfile,
    selectRecommendations,
    selectPersonalizedLooks,
    filterCardsByAudience,
    selectProductRecommendations,
    selectShopRecommendations
  };
});
