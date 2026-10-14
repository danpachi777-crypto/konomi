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

  function countCategories(cards, likedIds) {
    const liked = new Set(likedIds);
    return cards.reduce((scores, card) => {
      if (!liked.has(card.id) || !card.category) return scores;
      scores[card.category] = (scores[card.category] || 0) + 1;
      return scores;
    }, {});
  }

  function rankStylePreferences(cards, likedIds, audience = "all") {
    const liked = new Set(likedIds);
    const scores = new Map();
    for (const card of cards) {
      if (!card.styleId || (audience !== "all" && card.audience !== audience)) continue;
      const entry = scores.get(card.styleId) || { id: card.styleId, name: card.category, audience: card.audience, likes: 0, dislikes: 0 };
      if (liked.has(card.id)) entry.likes++;
      else if (!card.neutral) entry.dislikes++;
      scores.set(card.styleId, entry);
    }
    return [...scores.values()].filter((entry) => entry.likes > 0)
      .map((entry) => ({ ...entry, score: entry.likes * 2 - entry.dislikes })).filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.likes - a.likes || a.name.localeCompare(b.name, "ja"));
  }

  function rankAnsweredStyles(cards, history, audience = "all") {
    const canonicalId = (id) => String(id || '').replace(/^r-/, '');
    const byId = new Map(cards.map((card) => [canonicalId(card.id), card]));
    const latest = new Map();
    for (const entry of history) {
      // A later skip leaves the last actual opinion intact. The r- alias is
      // the same photo when it reappears in a recommendation round.
      if (entry.choice === 'like' || entry.choice === 'no')
        latest.set(canonicalId(entry.id), entry.choice);
    }
    const counts = new Map();
    for (const [id, choice] of latest) {
      const card = byId.get(id);
      if (!card?.styleId || (audience !== 'all' && card.audience !== audience)) continue;
      const entry = counts.get(card.styleId) || { id: card.styleId, name: card.category, audience: card.audience,
        likes: 0, dislikes: 0 };
      entry[choice === 'like' ? 'likes' : 'dislikes']++;
      counts.set(card.styleId, entry);
    }
    return [...counts.values()].filter((entry) => entry.likes > 0)
      .map((entry) => {
        const answered = entry.likes + entry.dislikes;
        const adjustedRate = (entry.likes + 1) / (answered + 2);
        return { ...entry, answered,
          percentage: Math.round(entry.likes / answered * 100),
          // Favour a supported positive signal without treating 1/1 as certainty.
          weight: (Math.max(0, adjustedRate - 0.5) + 0.04) * answered / (answered + 2),
          score: entry.likes * 2 - entry.dislikes };
      })
      .sort((a, b) => b.weight - a.weight || b.likes - a.likes || a.name.localeCompare(b.name, 'ja'));
  }

  function selectStyleWeightedLooks(candidates, styles, shownStyleIds = [], limit = 6) {
    const active = styles.filter((style) => style.score > 0 && style.weight > 0);
    const groups = new Map(active.map((style) => [style.id, []]));
    for (const candidate of candidates) groups.get(candidate.styleId)?.push(candidate);
    const shown = new Map(active.map((style) => [style.id,
      shownStyleIds.filter((id) => id === style.id).length]));
    const selected = [];
    while (selected.length < limit) {
      const nextStyle = active.filter((style) => groups.get(style.id).length)
        .sort((a, b) => (shown.get(a.id) + 1) / a.weight -
          (shown.get(b.id) + 1) / b.weight || b.weight - a.weight)[0];
      if (!nextStyle) break;
      selected.push(groups.get(nextStyle.id).shift());
      shown.set(nextStyle.id, shown.get(nextStyle.id) + 1);
    }
    return selected;
  }

  function rankTags(scores) {
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .map(([tag, count]) => ({ tag, count }));
  }

  function getArchetype(scores, categoryScores = {}) {
    return rankArchetypes(scores, categoryScores)[0];
  }

  function rankArchetypes(scores, categoryScores = {}) {
    return ARCHETYPES
      .map((archetype) => ({
        ...archetype,
        categoryMatch: categoryScores[archetype.name] || 0,
        match: (categoryScores[archetype.name] || 0) * 8 +
          archetype.tags.reduce((sum, tag) => sum + (scores[tag] || 0), 0)
      }))
      .sort((a, b) => b.match - a.match || a.name.localeCompare(b.name, "ja"));
  }

  function calculateProfile(cards, likedIds) {
    cards = cards.filter((card) => !card.neutral && !card.signalOnly);
    const scores = countTags(cards, likedIds);
    const categoryScores = countCategories(cards, likedIds);
    const ranked = rankTags(scores);
    const fallback = ARCHETYPES[12];
    const archetype = ranked.length ? getArchetype(scores, categoryScores) : fallback;
    const rankedArchetypes = ranked.length ? rankArchetypes(scores, categoryScores) : [{ ...fallback, categoryMatch: 0, match: 1 }];
    const maxArchetypeMatch = Math.max(1, ...rankedArchetypes.map((item) => item.match));
    const max = Math.max(1, ...ranked.map((item) => item.count));
    return {
      scores,
      categoryScores,
      topTags: ranked.slice(0, 5).map((item) => ({ ...item, percent: Math.round((item.count / max) * 100) })),
      archetype,
      topArchetypes: rankedArchetypes.slice(0, 4).map((item) => ({
        name: item.name,
        match: item.match,
        percent: Math.round((item.match / maxArchetypeMatch) * 100)
      })),
      likedCount: cards.filter((card) => likedIds.includes(card.id)).length
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
    const preference = buildPreference(cards, likedIds);
    return recommendations
      .filter((look) => audience === "all" || look.audience === audience || look.audience === "all")
      .map((look) => {
        return { ...look, ...scoreCandidate(look, preference) };
      })
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  function filterCardsByAudience(cards, audience = "all") {
    if (!audience || audience === "all") return [...cards];
    return cards.filter((card) => card.audience === audience || card.audience === "all");
  }

  function selectProductRecommendations(products, cards, likedIds, audience = "all", budget = "standard", limit = 6) {
    const preference = buildPreference(cards, likedIds);
    const ranked = products
      .filter((product) => audience === "all" || product.audiences.includes(audience) || product.audiences.includes("all"))
      .map((product) => {
        const scored = scoreCandidate(product, preference);
        const budgetMismatch = product.priceBand && product.priceBand !== budget;
        return { ...product, ...scored, budgetMismatch,
          affinity: scored.affinity + (product.priceBand === budget ? 1 : 0) };
      })
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      ;
    return diversify(ranked, limit, "brand");
  }

  function analyzeDiagnosis(cards, likedIds, roundIds = []) {
    const preference = buildPreference(cards, likedIds);
    const liked = new Set(likedIds);
    const round = cards.filter((card) => roundIds.includes(card.id) && !card.neutral);
    const latest = buildPreference(round, likedIds);
    const signals = preference.signals.map((feature) => ({ feature,
      evidence: preference.likedCards.filter((card) => (card.features || []).includes(feature))
        .map((card) => ({ id: card.id, label: card.label || card.name || feature })).slice(0, 3) }));
    return { signals, latestSignals: latest.signals.slice(0, 3),
      roundLiked: round.filter((card) => liked.has(card.id) && !card.signalOnly).length,
      roundAnswered: round.filter((card) => !card.signalOnly).length,
      cautious: preference.likedCards.filter((card) => !card.signalOnly).length < 3 };
  }

  function selectDiscoveryRecommendations(products, cards, likedIds, audience = "all", budget = "standard", feedback = {}, limit = 6) {
    const preference = buildPreference(cards, likedIds);
    if (!preference.likedCards.length) return [];
    const ranked = selectProductRecommendations(products.filter((product) => feedback[product.id] !== "no"),
      cards, likedIds, audience, budget, products.length)
      .filter((product) => product.affinity > 0 && product.evidenceIds.length && product.matches.length)
      .map((product) => {
        const anchor = (product.features || []).filter((feature) => preference.features[feature] > 0).slice(0, 2);
        const explore = (product.features || []).filter((feature) => preference.features[feature] === undefined).slice(0, 1);
        return { ...product, anchor, explore,
          discoveryReason: `${anchor.length ? `好きだった「${anchor.join("・")}」を手がかりに` : `選んだ「${product.matches.slice(0, 2).join("・")}」の雰囲気を手がかりに`}、${product.name}。`,
          experiment: explore.length ? `次は「${explore[0]}」も気になるか、見比べてみましょう。` : "色・丈・素材を一つ変えた服も、見比べてみましょう。" };
      })
      .sort((a, b) => Number(b.specialist === true) - Number(a.specialist === true) ||
        Number(feedback[a.id] === "like") - Number(feedback[b.id] === "like") || b.affinity - a.affinity || a.id.localeCompare(b.id));
    return diversify(ranked.filter((item) => item.specialist), limit, "brand")
      .concat(diversify(ranked.filter((item) => !item.specialist), limit, "brand")).slice(0, limit);
  }

  function selectShopRecommendations(shops, cards, likedIds, limit = 4, area = "", audience = "all") {
    const preference = buildPreference(cards, likedIds);
    return shops
      .filter((shop) => !shop.areas || shop.areas.some((region) => area.includes(region)))
      .filter((shop) => audience === "all" || !shop.audiences || shop.audiences.includes(audience) || shop.audiences.includes("all"))
      .map((shop) => ({ ...shop, ...scoreCandidate(shop, preference) }))
      .sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  // Match diagnosis style IDs to shop descriptions that were actually confirmed in the directory.
  // The final, broad tag is a tie breaker; a shop needs a stronger tag to qualify.
  const SHOP_STYLE_TAGS = {
    men_trad: { きれいめ: 5, ヨーロッパ古着: 3, ミニマル: 1 },
    men_preppy: { きれいめ: 5, アメカジ: 3, カジュアル: 1 },
    men_clean_casual: { きれいめ: 5, ミニマル: 3, カジュアル: 1 },
    men_business: { きれいめ: 5, ブランド古着: 3 },
    men_amekaji: { アメカジ: 5, デニム: 4, ヴィンテージ: 1 },
    men_french: { ヨーロッパ古着: 5, ミニマル: 3, カジュアル: 1 },
    men_military: { ミリタリー: 5, ワーク: 3, ヴィンテージ: 1 },
    men_sportmix: { スポーティ: 5, ストリート: 3, カジュアル: 1 },
    men_outdoor: { アウトドア: 5, スポーティ: 3, カジュアル: 1 },
    men_street: { ストリート: 5, スポーティ: 3, カジュアル: 1 },
    men_work: { ワーク: 5, デニム: 4, アメカジ: 3 },
    men_mode: { モード: 5, ブランド古着: 3, 個性的: 1 },
    men_normcore: { ミニマル: 5, カジュアル: 3 },
    men_korean: { きれいめ: 5, モード: 3, ストリート: 1 },
    women_casual: { カジュアル: 5, デニム: 3 },
    women_basic: { ミニマル: 5, きれいめ: 3, カジュアル: 1 },
    women_trad: { きれいめ: 5, ヨーロッパ古着: 3, ミニマル: 1 },
    women_mode: { モード: 5, ブランド古着: 3, 個性的: 1 },
    women_girly: { ガーリー: 5, フェミニン: 4, レトロ: 3 },
    women_adult: { きれいめ: 5, フェミニン: 3, ミニマル: 1 },
    women_menslike: { ワーク: 5, アメカジ: 3, ストリート: 1 },
    women_street: { ストリート: 5, スポーティ: 3, カジュアル: 1 },
    women_rock: { ロック: 5, 個性的: 1 },
    women_gyaru: { "Y2K": 5, 個性的: 1 },
    women_outdoor: { アウトドア: 5, スポーティ: 3, カジュアル: 1 },
    women_military: { ミリタリー: 5, ワーク: 3, カジュアル: 1 }
  };

  function selectPersonalShopRecommendations(shops, answeredStyles, audience = "all", limit = 24) {
    const likedStyles = answeredStyles.filter((style) => style.likes > 0 && style.score > 0).slice(0, 3);
    if (!likedStyles.length) return [];
    return shops
      .filter((shop) => audience === "all" || !shop.audiences || shop.audiences.includes("all") || shop.audiences.includes(audience))
      .map((shop) => {
        const styleMatches = likedStyles.flatMap((style, index) => {
          const weights = SHOP_STYLE_TAGS[style.id] || {};
          const tags = (shop.tags || []).filter((tag) => (weights[tag] || 0) >= 3);
          if (!tags.length) return [];
          const score = tags.reduce((sum, tag) => sum + weights[tag], 0) *
            (style.weight ?? (3 - index));
          return [{ style: style.name, tags, score }];
        });
        const matchScore = styleMatches.reduce((sum, match) => sum + match.score, 0);
        return { ...shop, matchScore, styleMatches,
          personalReason: styleMatches.length
            ? `好きと答えた「${styleMatches.map((match) => match.style).join("・")}」に対し、掲載情報の「${[...new Set(styleMatches.flatMap((match) => match.tags))].slice(0, 3).join("・")}」が近い店です。`
            : "" };
      })
      .filter((shop) => shop.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  function buildPreference(cards, likedIds) {
    const liked = new Set(likedIds);
    const weights = {};
    const features = {};
    const photoColors = {};
    for (const card of cards.filter((item) => !item.neutral && !item.signalOnly)) {
      for (const color of card.imageAnalysis?.palette || []) {
        const entry = photoColors[color.name] ||= { yes: 0, no: 0 };
        entry[liked.has(card.id) ? "yes" : "no"] += color.share;
      }
    }
    const colorWeights = Object.fromEntries(Object.entries(photoColors).map(([name, count]) =>
      [name, (count.yes - count.no * 0.35) / (count.yes + count.no + 1)]));
    for (const field of ["tags", "features"]) {
      const counts = {};
      for (const card of cards.filter((item) => !item.neutral)) for (const value of card[field] || []) {
        const entry = counts[value] ||= { yes: 0, no: 0 };
        entry[liked.has(card.id) ? "yes" : "no"]++;
      }
      const destination = field === "features" ? features : weights;
      for (const [value, count] of Object.entries(counts)) {
        // 多数のカードに付くタグが有利にならないよう、選択率と証拠数で補正。
        destination[value] = (count.yes - count.no * 0.35) / (count.yes + count.no + 1);
      }
    }
    const rankedStyles = rankStylePreferences(cards, likedIds);
    const styleWeights = Object.fromEntries(rankedStyles.map((style) => [style.id, style.score]));
    const styleNames = Object.fromEntries(rankedStyles.map((style) => [style.id, style.name]));
    return { weights, features, colorWeights, styleWeights, styleNames,
      photoColorSummary: Object.entries(colorWeights).filter(([, weight]) => weight > 0)
        .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
      likedCards: cards.filter((card) => liked.has(card.id) && !card.neutral),
      signals: Object.entries(features).filter(([, weight]) => weight > 0)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name) };
  }

  function scoreCandidate(candidate, preference) {
    const matches = [...(candidate.features || []), ...(candidate.tags || [])]
      .filter((value) => (preference.features[value] ?? preference.weights[value] ?? 0) > 0)
      .sort((a, b) => (preference.features[b] ?? preference.weights[b]) - (preference.features[a] ?? preference.weights[a]));
    const affinity = (candidate.tags || []).reduce((sum, tag) => sum + (preference.weights[tag] || 0) * 3, 0)
      + (candidate.features || []).reduce((sum, feature) => sum + (preference.features[feature] || 0) * 6, 0)
      + (candidate.styleId ? Math.max(0, preference.styleWeights?.[candidate.styleId] || 0) * 8 : 0)
      // Image colors include background/skin, so use only a small tie-breaker.
      + (candidate.imageAnalysis?.palette || []).reduce((sum, color) =>
        sum + color.share * (preference.colorWeights?.[color.name] || 0), 0);
    const evidence = preference.likedCards.filter((card) =>
      (candidate.styleId && card.styleId === candidate.styleId) ||
      (card.features || []).some((feature) => (candidate.features || []).includes(feature)) ||
      card.tags.some((tag) => (candidate.tags || []).includes(tag))).slice(0, 2);
    const styleMatch = candidate.styleId && (preference.styleWeights?.[candidate.styleId] || 0) > 0;
    const styleName = styleMatch ? preference.styleNames[candidate.styleId] : null;
    return { affinity, matches: [...new Set(styleMatch ? [styleName, ...matches] : matches)].slice(0, 3), evidenceIds: evidence.map((card) => card.id),
      reason: styleMatch ? `好きと答えた${styleName}の服です。`
        : matches.length ? `選んだ服の「${[...new Set(matches)].slice(0, 3).join("・")}」と共通する候補。`
        : "選択との共通点はまだ少なめ。比較用の候補です。" };
  }

  function diversify(ranked, limit, field) {
    const selected = [];
    const remaining = [...ranked];
    while (remaining.length && selected.length < limit) {
      remaining.sort((a, b) => {
        const score = (candidate) => candidate.affinity - selected.filter((item) => item[field] === candidate[field]).length * 4;
        return score(b) - score(a) || a.id.localeCompare(b.id);
      });
      selected.push(remaining.shift());
    }
    return selected;
  }

  function selectAdaptiveRound(candidates, cards, likedIds, audience, answeredIds = [], limit = 6) {
    const answered = new Set(answeredIds);
    const preference = buildPreference(cards, likedIds);
    const remaining = candidates.filter((candidate) =>
      (audience === "all" || candidate.audience === audience || candidate.audience === "all") &&
      !answered.has(candidate.id)).map((candidate) => {
        const scored = scoreCandidate(candidate, preference);
        const uncertain = (candidate.features || []).filter((feature) => Math.abs(preference.features[feature] || 0) < 0.3);
        return { ...candidate, ...scored, uncertain,
          roundReason: uncertain.length ? `「${uncertain.slice(0, 2).join("・")}」も好きか確かめたい候補です。` : scored.reason };
      });
    const selected = [];
    while (remaining.length && selected.length < limit) {
      // 最初は好みに近い候補、3枚目ごとには未確認の特徴を含む候補も比較する。
      const explore = selected.length % 3 === 2;
      remaining.sort((a, b) => {
        const score = (item) => item.affinity + (explore ? item.uncertain.length * 4 : 0)
          - selected.filter((choice) => choice.category === item.category).length * 5;
        return score(b) - score(a) || a.id.localeCompare(b.id);
      });
      selected.push(remaining.shift());
    }
    return selected;
  }

  // 診断済みの服を「新しいおすすめ」として再表示しない。
  // 分類の代表例ではなく、好きと答えた実際の服との共通点がある候補だけを提案する。
  function selectNovelLooks(candidates, cards, likedIds, audience = "all", seenIds = [], limit = 6) {
    const preference = buildPreference(cards, likedIds);
    if (!preference.likedCards.length) return [];
    const seen = new Set(seenIds);
    const seenImages = new Set(cards.map((card) => card.image).filter(Boolean));
    const usedImages = new Set();
    return selectPersonalizedLooks(candidates, cards, likedIds, audience, candidates.length)
      .filter((look) => {
        if (seen.has(look.id) || seenImages.has(look.image) || usedImages.has(look.image) ||
            look.affinity <= 0 || !look.matches.length || !look.evidenceIds.length) return false;
        usedImages.add(look.image);
        return true;
      })
      .slice(0, limit)
      .map((look) => ({ ...look, roundReason: look.reason }));
  }

  return {
    ARCHETYPES,
    analyzeDiagnosis,
    selectDiscoveryRecommendations,
    buildPreference,
    scoreCandidate,
    selectAdaptiveRound,
    selectNovelLooks,
    countTags,
    countCategories,
    rankStylePreferences,
    rankAnsweredStyles,
    selectStyleWeightedLooks,
    rankTags,
    getArchetype,
    rankArchetypes,
    calculateProfile,
    selectRecommendations,
    selectPersonalizedLooks,
    filterCardsByAudience,
    selectProductRecommendations,
    selectShopRecommendations,
    selectPersonalShopRecommendations
  };
});
