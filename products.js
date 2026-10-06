(function () {
  // 公式一覧を案内し、未確認のSKU・在庫・価格を断定しない。
  const make = (id, brand, name, category, audiences, priceBand, tags, features, url) => ({
    id, brand, name, category, audiences, priceBand, tags, features, url,
    kind: "collection", sourceUrl: url, checkedAt: "2026-10-06"
  });
  window.KONOMI_PRODUCTS = [
    make("cos-m", "COS", "無地シャツ・テーパードパンツを探す", "シャツ・ボトムス", ["men"], "premium", ["ミニマル", "モード", "直線的"], ["シャツ", "細身・テーパード", "黒・モノトーン"], "https://www.cos.com/ja-jp/"),
    make("cos-w", "COS", "構築的なトップス・ロング丈を探す", "トップス・ワンピース", ["women"], "premium", ["ミニマル", "モード", "直線的"], ["ロング丈", "スカート・ワンピース", "黒・モノトーン"], "https://www.cos.com/ja-jp/"),
    make("ua", "UNITED ARROWS", "ジャケット・セットアップを探す", "ジャケット", ["all"], "premium", ["きれいめ", "上品", "クラシック"], ["ジャケット", "統一感のある配色", "青・ネイビー"], "https://store.united-arrows.co.jp/"),
    make("beams", "BEAMS", "柄シャツ・ゆったりした街着を探す", "シャツ・ボトムス", ["all"], "standard", ["シティーボーイ", "プレッピー", "カジュアル"], ["柄・チェック", "シャツ", "ゆったりした形"], "https://www.beams.co.jp/"),
    make("ur", "URBAN RESEARCH", "淡色のシャツ・軽いジャケットを探す", "シャツ・ジャケット", ["all"], "standard", ["ナチュラル", "きれいめ", "リラックス"], ["淡色", "シャツ", "ジャケット"], "https://www.urban-research.jp/"),
    make("freaks", "FREAK'S STORE", "ビッグT・ワークパンツを探す", "トップス・ボトムス", ["all"], "standard", ["ストリート", "アメカジ", "オーバーサイズ", "ワーク"], ["カットソー", "ゆったりした形", "パンツ"], "https://www.daytona-park.com/"),
    make("carhartt", "Carhartt WIP", "ワークジャケット・ゆったりしたパンツを探す", "アウター・ボトムス", ["all"], "premium", ["ワーク", "ストリート", "アメカジ"], ["ジャケット", "ゆったりした形", "ベージュ・茶"], "https://carhartt-wip.jp/collections/all"),
    make("levis", "Levi's", "ストレート・バギーデニムを探す", "デニム", ["all"], "standard", ["デニム", "アメカジ", "ヴィンテージ", "Y2K"], ["デニム素材", "ゆったりした形", "パンツ"], "https://levi.jp/"),
    make("adidas", "adidas", "トラックウェア・スニーカーを探す", "スポーツウェア", ["all"], "standard", ["スポーティ", "ストリート", "軽快"], ["スニーカー", "機能アウター", "パンツ"], "https://www.adidas.jp/"),
    make("patagonia", "patagonia", "シェル・アウトドアウェアを探す", "機能アウター", ["all"], "premium", ["アウトドア", "ゴープコア", "機能的", "アースカラー"], ["機能アウター", "アクセントカラー"], "https://www.patagonia.jp/"),
    make("1ldk", "1LDK / UNIVERSAL PRODUCTS.・MY___", "シャツ・余裕のあるシルエットを探す", "シャツ・ボトムス", ["all"], "premium", ["シティーボーイ", "ミニマル", "ベーシック"], ["シャツ", "ゆったりした形", "白・生成り"], "https://onlinestore.1ldkshop.com/"),
    make("nubian", "NUBIANの取り扱いブランド", "デザイナーズの黒い服・重ね着を探す", "セレクト", ["all"], "premium", ["モード", "ストリート", "個性的"], ["黒・モノトーン", "重ね着", "厚底・ブーツ"], "https://nubiantokyo.com/collections/all"),
    make("snidel", "SNIDEL", "短丈トップス・ロングスカートを探す", "トップス・スカート", ["women"], "standard", ["きれいめ", "コンパクト", "上品"], ["短丈・コンパクト", "ロング丈", "スカート・ワンピース"], "https://snidel.com/"),
    make("andst", "niko and ...", "自然な配色・リラックスした服を探す", "日常着", ["all"], "value", ["ナチュラル", "カジュアル", "リラックス"], ["ベージュ・茶", "ゆったりした形", "シャツ"], "https://www.nikoand.jp/brands/niko-and/"),
    make("hare", "HARE", "モノトーン・形に特徴のある服を探す", "モードウェア", ["all"], "standard", ["モード", "モノトーン", "直線的", "個性的"], ["黒・モノトーン", "ジャケット", "ゆったりした形"], "https://www.dot-st.com/hare/feature/?dispNo=012001001"),
    make("emoda", "EMODA", "短丈トップス・厚底ブーツを探す", "トップス・シューズ", ["women"], "standard", ["Y2K", "モード", "コンパクト"], ["短丈・コンパクト", "厚底・ブーツ", "黒・モノトーン"], "https://emoda-japan.com/"),
    make("musinsa", "MUSINSAの韓国ブランド", "韓国ブランドのシャツ・ワイドパンツを探す", "ブランド横断", ["all"], "standard", ["韓国系", "オーバーサイズ", "きれいめ"], ["シャツ", "ゆったりした形", "淡色"], "https://global.musinsa.com/jp"),
    make("baycrews", "BAYCREW'Sの取り扱いブランド", "ジャケット・デニム・重ね着を探す", "セレクト", ["all"], "premium", ["きれいめ", "カジュアル", "シティーボーイ"], ["ジャケット", "デニム素材", "重ね着"], "https://baycrews.jp/"),
    make("strato", "Stratoの取り扱いブランド", "自然素材のシャツ・日常着を探す", "セレクト", ["all"], "premium", ["ナチュラル", "カジュアル", "ベーシック"], ["シャツ", "白・生成り", "リネン・自然素材"], "https://www.strato.co.jp/"),
    make("ragtag", "RAGTAGのブランド古着", "デザイナーズ・一点物を探す", "ブランド古着", ["all"], "standard", ["古着", "ヴィンテージ", "モード", "個性的"], ["黒・モノトーン", "ジャケット", "重ね着"], "https://www.ragtag.jp/"),
    make("flamingo", "FLAMINGOの古着", "柄・デニム・レトロな服を探す", "古着", ["all"], "standard", ["古着", "ヴィンテージ", "アメカジ", "暖色"], ["柄・チェック", "デニム素材", "ベージュ・茶"], "https://www.flamingo-online.jp/"),
    make("uniqlo", "UNIQLO", "無地T・ベーシックなパンツを探す", "日常着", ["all"], "value", ["ベーシック", "ミニマル", "カジュアル"], ["カットソー", "パンツ", "白・生成り"], "https://www.uniqlo.com/jp/ja/"),
    make("wego", "WEGO", "短丈トップス・ルーズデニムを探す", "トレンドウェア", ["all"], "value", ["Y2K", "韓国系", "ストリート", "デニム"], ["短丈・コンパクト", "デニム素材", "ゆったりした形"], "https://wego.jp/")
  ];
  window.KONOMI_PRODUCTS.push(...(window.KONOMI_SPECIALIST_BRANDS || []));
})();
