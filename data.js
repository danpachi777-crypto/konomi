(function (root, factory) {
  const analysis = typeof module === "object" && module.exports
    ? require("./photo-analysis.js") : (root.window || root).KONOMI_PHOTO_ANALYSIS;
  const cards = factory(analysis);
  if (typeof module === "object" && module.exports) module.exports = cards;
  else (root.window || root).KONOMI_CARDS = cards;
})(typeof globalThis !== "undefined" ? globalThis : this, function (analysis) {
  const TAGS = {
    clean: ["きれいめ", "上品", "クラシック", "直線的"],
    casual: ["カジュアル", "ベーシック", "デニム", "リラックス"],
    street: ["ストリート", "オーバーサイズ", "都会的", "レイヤード"],
    korean: ["韓国系", "モノトーン", "淡色", "オーバーサイズ"],
    mode: ["モード", "モノトーン", "直線的", "個性的"],
    vintage: ["古着", "ヴィンテージ", "レイヤード", "暖色"],
    amekaji: ["アメカジ", "デニム", "ワーク", "カジュアル"],
    cityboy: ["シティーボーイ", "プレッピー", "ワイド", "きれいめ"],
    sporty: ["スポーティ", "軽快", "機能的", "ストリート"],
    outdoor: ["アウトドア", "ゴープコア", "機能的", "アースカラー"],
    y2k: ["Y2K", "デニム", "ワイド", "個性的"],
    minimal: ["ミニマル", "モノトーン", "落ち着き", "直線的"],
    natural: ["ナチュラル", "アースカラー", "リラックス", "やわらかい"]
  };

  const make = (key, audience, category, label, tags) => ({
    id: key,
    image: `assets/outfits/${key}.jpg`,
    audience,
    category,
    label,
    tags,
    features: outfitFeatures(label),
    imageAnalysis: analysis?.items?.[key] || null
  });

  // 写真ごとの服の説明から抽出。カテゴリー共通タグとは別に扱う。
  function outfitFeatures(label) {
    const rules = [
      [/ブラック|黒|モノトーン/, "黒・モノトーン"], [/白|ホワイト|クリーム|生成り/, "白・生成り"],
      [/ベージュ|ブラウン|アースカラー/, "ベージュ・茶"], [/ブルー|ネイビー/, "青・ネイビー"],
      [/赤|カラー|グリーン/, "アクセントカラー"], [/淡色|アイス|ライト/, "淡色"],
      [/ワイド|ルーズ|バギー|ビッグ|ゆったり/, "ゆったりした形"], [/細身|テーパード/, "細身・テーパード"],
      [/コンパクト|クロップド|タンク/, "短丈・コンパクト"], [/ロング|ドレス|ワンピース/, "ロング丈"],
      [/デニム/, "デニム素材"], [/リネン|生成り/, "リネン・自然素材"],
      [/シェル|パーカ|ウインド|山装備/, "機能アウター"], [/柄|チェック/, "柄・チェック"],
      [/ジャケット|スーツ|ブレザー/, "ジャケット"], [/シャツ|ブラウス/, "シャツ"],
      [/白T|グレーT|Tシャツ|トップス|トップ|ビッグT|フーディー/, "カットソー"], [/ショート|ショーツ/, "ショートパンツ"],
      [/コート/, "コート"],
      [/スカート|ドレス|ワンピース/, "スカート・ワンピース"], [/パンツ|デニム|カーゴ|ジョガー/, "パンツ"],
      [/厚底|ブーツ/, "厚底・ブーツ"], [/スニーカー/, "スニーカー"],
      [/レイヤード|ミックス|オン・デニム/, "重ね着"], [/ワントーン|セットアップ|セット$/, "統一感のある配色"]
    ];
    return rules.filter(([pattern]) => pattern.test(label)).map(([, feature]) => feature);
  }

  const cards = [
    make("men-clean-01", "men", "洗練きれいめ", "クリームスーツとスニーカー", TAGS.clean),
    make("women-clean-01", "women", "洗練きれいめ", "柄ブラウスと細身デニム", TAGS.clean),
    make("men-clean-02", "men", "洗練きれいめ", "ブラックシャツのセットアップ", TAGS.clean),
    make("women-clean-02", "women", "洗練きれいめ", "ネイビーブレザーのセットアップ", TAGS.clean),

    make("men-casual-01", "men", "デイリーカジュアル", "デニムジャケットの街着", TAGS.casual),
    make("women-casual-01", "women", "デイリーカジュアル", "黒トップスとフレアデニム", TAGS.casual),
    make("men-casual-02", "men", "デイリーカジュアル", "柄シャツとブルーデニム", TAGS.casual),
    make("women-casual-02", "women", "デイリーカジュアル", "赤トップスとルーズデニム", TAGS.casual),

    make("men-street-01", "men", "都会派ストリート", "ビッグTとショートパンツ", TAGS.street),
    make("women-street-01", "women", "都会派ストリート", "コンパクトトップとロングスカート", TAGS.street),
    make("men-street-02", "men", "都会派ストリート", "白Tとブラックパンツ", TAGS.street),
    make("women-street-02", "women", "都会派ストリート", "赤トップスとワイドデニム", TAGS.street),

    make("men-korean-01", "men", "ソウル・韓国系", "黒シャツと白ワイドパンツ", TAGS.korean),
    make("women-korean-03", "women", "ソウル・韓国系", "アイスブルーのジャケットセット", TAGS.korean),
    make("men-korean-02", "men", "ソウル・韓国系", "白Tとルーズカラーパンツ", TAGS.korean),
    make("women-korean-02", "women", "ソウル・韓国系", "ベージュのワントーン", TAGS.korean),

    make("men-mode-03", "men", "エッジ・モード系", "ブラックレイヤードと厚底", TAGS.mode),
    make("women-mode-01", "women", "エッジ・モード系", "ブラックワンピースの直線コーデ", TAGS.mode),
    make("men-mode-02", "men", "エッジ・モード系", "黒トップスと立体ワイドパンツ", TAGS.mode),
    make("women-mode-02", "women", "エッジ・モード系", "黒ジャケットとロングブーツ", TAGS.mode),

    make("men-vintage-01", "men", "古着・ヴィンテージ", "ハンチングとクラシックスーツ", TAGS.vintage),
    make("women-vintage-01", "women", "古着・ヴィンテージ", "ブラウンのレトロレイヤード", TAGS.vintage),
    make("men-vintage-02", "men", "古着・ヴィンテージ", "ウェスタン調ブラックコーデ", TAGS.vintage),
    make("women-vintage-02", "women", "古着・ヴィンテージ", "ブルードレスとハット", TAGS.vintage),

    make("men-amekaji-01", "men", "王道アメカジ", "白Tと濃色デニム", TAGS.amekaji),
    make("women-amekaji-01", "women", "王道アメカジ", "白Tとブラックオーバーオール", TAGS.amekaji),
    make("men-amekaji-02", "men", "王道アメカジ", "デニム・オン・デニム", TAGS.amekaji),
    make("women-amekaji-02", "women", "王道アメカジ", "チェックシャツとデニムオーバーオール", TAGS.amekaji),

    make("men-cityboy-01", "men", "シティーボーイ系", "柄シャツのプレッピーミックス", TAGS.cityboy),
    make("women-cityboy-01", "women", "シティーボーイ系", "ライトグレーのブレザースタイル", TAGS.cityboy),
    make("men-cityboy-02", "men", "シティーボーイ系", "ブラックシャツと白パンツ", TAGS.cityboy),
    make("women-cityboy-02", "women", "シティーボーイ系", "白T・デニム・ベージュブレザー", TAGS.cityboy),

    make("men-sporty-01", "men", "アクティブ・スポーティ", "ネイビーアウターとスウェット", TAGS.sporty),
    make("women-sporty-01", "women", "アクティブ・スポーティ", "ホワイトフーディーのセットアップ", TAGS.sporty),
    make("men-sporty-02", "men", "アクティブ・スポーティ", "ウインドブレーカーとジョガー", TAGS.sporty),
    make("women-sporty-02", "women", "アクティブ・スポーティ", "白Tとブルーショーツ", TAGS.sporty),

    make("men-outdoor-01", "men", "アウトドア・ゴープコア", "シェルとバックパックの山歩き", TAGS.outdoor),
    make("women-outdoor-01", "women", "アウトドア・ゴープコア", "グリーンパーカの冬コーデ", TAGS.outdoor),
    make("men-outdoor-03", "men", "アウトドア・ゴープコア", "シェルとカラーパンツの山装備", TAGS.outdoor),
    make("women-outdoor-02", "women", "アウトドア・ゴープコア", "赤シェルとグレーパンツ", TAGS.outdoor),

    make("men-y2k-01", "men", "Y2Kリバイバル", "タンクトップとバギーデニム", TAGS.y2k),
    make("women-y2k-01", "women", "Y2Kリバイバル", "クロップドトップとデニム", TAGS.y2k),
    make("men-y2k-02", "men", "Y2Kリバイバル", "ビーニーとバギーカーゴ", TAGS.y2k),
    make("women-y2k-02", "women", "Y2Kリバイバル", "コンパクトトップとルーズデニム", TAGS.y2k),

    make("men-minimal-01", "men", "静かなミニマル", "ホワイトのワントーン", TAGS.minimal),
    make("women-minimal-01", "women", "静かなミニマル", "白トップスと黒ボトム", TAGS.minimal),
    make("men-minimal-02", "men", "静かなミニマル", "淡色ジャケットとテーパードパンツ", TAGS.minimal),
    make("women-minimal-02", "women", "静かなミニマル", "モノトーンのジャンプスーツ", TAGS.minimal),

    make("men-natural-01", "men", "自然体ナチュラル", "生成りリネンのレイヤード", TAGS.natural),
    make("women-natural-01", "women", "自然体ナチュラル", "黒トップスとベージュワイドパンツ", TAGS.natural),
    make("men-natural-02", "men", "自然体ナチュラル", "アースカラーのジャケットコーデ", TAGS.natural),
    make("women-natural-02", "women", "自然体ナチュラル", "柄ローブのボヘミアンレイヤード", TAGS.natural),
    // additional-outfits:start
    make("men-clean-04", "men", "洗練きれいめ", "ブレザーとパンツの街着", TAGS.clean),
    make("men-casual-04", "men", "デイリーカジュアル", "デニムジャケットとデニムパンツ", TAGS.casual),
    make("men-street-04", "men", "都会派ストリート", "デニムの都会的セットアップ", TAGS.street),
    make("men-korean-04", "men", "ソウル・韓国系", "ブラックのシャツとパンツ", TAGS.korean),
    make("men-mode-04", "men", "エッジ・モード系", "背中のデザインが特徴のブラックコーデ", TAGS.mode),
    make("men-vintage-04", "men", "古着・ヴィンテージ", "白シャツとブラウンパンツ・サスペンダー", TAGS.vintage),
    make("men-amekaji-04", "men", "王道アメカジ", "ブルーデニムのセットアップ", TAGS.amekaji),
    make("men-cityboy-04", "men", "シティーボーイ系", "ジャケットとパンツの端正な街着", TAGS.cityboy),
    make("men-sporty-04", "men", "アクティブ・スポーティ", "ブルージャケットとスポーツショーツ", TAGS.sporty),
    make("men-outdoor-04", "men", "アウトドア・ゴープコア", "赤ベストとバックパックの山装備", TAGS.outdoor),
    make("men-y2k-04", "men", "Y2Kリバイバル", "ルーズデニムセットと白スニーカー", TAGS.y2k),
    make("men-minimal-04", "men", "静かなミニマル", "ブラックシャツと細身パンツ", TAGS.minimal),
    make("men-natural-04", "men", "自然体ナチュラル", "白シャツとベスト・リネンパンツ", TAGS.natural),
    make("women-clean-04", "women", "洗練きれいめ", "ベージュブレザーとパンツのセットアップ", TAGS.clean),
    make("women-casual-04", "women", "デイリーカジュアル", "ノースリーブとブルーデニム", TAGS.casual),
    make("women-street-04", "women", "都会派ストリート", "白クロップドトップとパープルデニムセット", TAGS.street),
    make("women-korean-04", "women", "ソウル・韓国系", "ベージュの淡色レイヤード", TAGS.korean),
    make("women-mode-04", "women", "エッジ・モード系", "ブラックドレスの立体シルエット", TAGS.mode),
    make("women-vintage-04", "women", "古着・ヴィンテージ", "レトロトップスとデニムパンツ", TAGS.vintage),
    make("women-amekaji-04", "women", "王道アメカジ", "デニムセットとブラックブーツ", TAGS.amekaji),
    make("women-cityboy-04", "women", "シティーボーイ系", "ブレザーとデニムの街着", TAGS.cityboy),
    make("women-sporty-04", "women", "アクティブ・スポーティ", "グレーフーディーのアクティブコーデ", TAGS.sporty),
    make("women-outdoor-04", "women", "アウトドア・ゴープコア", "グリーンジャケットとベージュワイドパンツ", TAGS.outdoor),
    make("women-y2k-04", "women", "Y2Kリバイバル", "クロップドトップとデニム・厚底スニーカー", TAGS.y2k),
    make("women-minimal-04", "women", "静かなミニマル", "ベージュワンピースのミニマルコーデ", TAGS.minimal),
    make("women-natural-04", "women", "自然体ナチュラル", "ブルーのリラックスジャンプスーツ", TAGS.natural),
    make("men-clean-05", "men", "洗練きれいめ", "ベージュスーツと黒い革靴", TAGS.clean),
    make("men-street-05", "men", "都会派ストリート", "グラフィックTとチェックシャツの重ね着", TAGS.street),
    make("men-sporty-05", "men", "アクティブ・スポーティ", "ブルーフーディーと黒ベスト・ルーズパンツ", TAGS.sporty),
    make("men-street-06", "men", "都会派ストリート", "柄の黒デニムジャケットとワイドパンツ", TAGS.street),
    make("men-vintage-05", "men", "古着・ヴィンテージ", "ブラウンロングコートとスーツ・ハット", TAGS.vintage),
    make("men-sporty-06", "men", "アクティブ・スポーティ", "白フーディーと白パンツのセットアップ", TAGS.sporty),
    make("men-casual-05", "men", "デイリーカジュアル", "カラーストライプシャツとベージュパンツ", TAGS.casual),
    make("men-minimal-05", "men", "静かなミニマル", "白ポロシャツと黒テーパードパンツ", TAGS.minimal),
    make("men-natural-05", "men", "自然体ナチュラル", "グリーンシャツと白パンツ", TAGS.natural),
    make("men-cityboy-05", "men", "シティーボーイ系", "柄の開襟シャツとグレーテーパードパンツ", TAGS.cityboy),
    make("men-amekaji-05", "men", "王道アメカジ", "赤チェックシャツとブルーデニム", TAGS.amekaji),
    make("men-casual-06", "men", "デイリーカジュアル", "グレーTシャツと黒パンツ・白スニーカー", TAGS.casual),
    make("men-vintage-06", "men", "古着・ヴィンテージ", "ブラウンシャツとゆったりブルーデニム", TAGS.vintage),
    make("women-clean-05", "women", "洗練きれいめ", "黒ジャケットとプリーツスカート", TAGS.clean),
    make("women-mode-05", "women", "エッジ・モード系", "黒クロップドトップとワイドパンツ・ジャケット", TAGS.mode),
    make("women-vintage-05", "women", "古着・ヴィンテージ", "ブラウンロングドレスと黒ブーツ", TAGS.vintage),
    make("women-vintage-06", "women", "古着・ヴィンテージ", "柄トップスと赤ロングスカート", TAGS.vintage),
    make("women-cityboy-05", "women", "シティーボーイ系", "グレーの短丈ジャケットと白ワイドパンツ", TAGS.cityboy),
    make("women-clean-06", "women", "洗練きれいめ", "ブルーワンピースとベージュジャケット", TAGS.clean),
    make("women-street-05", "women", "都会派ストリート", "黒ジャケットとダメージデニム・ブーツ", TAGS.street),
    make("women-korean-05", "women", "ソウル・韓国系", "ピンクジャケットと黒クロップドトップ・パンツ", TAGS.korean),
    make("women-y2k-05", "women", "Y2Kリバイバル", "白レーストップスとデニムオーバーオール・厚底", TAGS.y2k),
    make("women-casual-05", "women", "デイリーカジュアル", "白タンクトップとデニムショートパンツ", TAGS.casual),
    make("women-korean-06", "women", "ソウル・韓国系", "黒クロップドトップとブルーデニム", TAGS.korean),
    make("women-natural-05", "women", "自然体ナチュラル", "ベージュロングコートと白パンツ", TAGS.natural),
    make("women-vintage-07", "women", "古着・ヴィンテージ", "ベージュコートと柄スカート・ブラウンブーツ", TAGS.vintage),
    // additional-outfits:end
  ];
  const groups = new Set();
  return cards.map((card) => {
    const group = card.audience + ":" + card.category;
    const phase = groups.has(group) ? "refinement" : "initial";
    groups.add(group);
    return { ...card, phase };
  });
});
