(function () {
  window.KONOMI_SHOPS = [
    {
      id: "s01",
      name: "UNITED ARROWS",
      type: "セレクトショップ",
      query: "UNITED ARROWS",
      tags: ["きれいめ", "モード", "クラシック", "ミニマル", "上品"],
      description: "端正な日常着からモード寄りのセレクトまで。きれいめ派が比較しやすいショップです。",
      officialUrl: "https://store.united-arrows.co.jp/stores/map.html"
    },
    {
      id: "s02",
      name: "BEAMS",
      type: "セレクトショップ",
      query: "BEAMS",
      tags: ["シティーボーイ", "アメカジ", "カジュアル", "古着", "きれいめ"],
      description: "トラッド、アメカジ、シティーボーイを横断して見比べたい人に向いています。",
      officialUrl: "https://www.beams.co.jp/shop/"
    },
    {
      id: "s03",
      name: "RAGTAG",
      type: "ブランド古着店",
      query: "RAGTAG ブランド古着",
      tags: ["古着", "ヴィンテージ", "モード", "ストリート", "個性的"],
      description: "ブランド古着を中心に、モードやデザイナーズの一点物を探しやすい候補です。",
      officialUrl: "https://www.ragtag.jp/shop/"
    },
    {
      id: "s04",
      name: "2nd STREET",
      type: "古着・リユース",
      query: "セカンドストリート 古着",
      tags: ["古着", "アメカジ", "カジュアル", "Y2K", "デニム"],
      description: "価格帯とジャンルが広く、古着やアメカジを気軽に試したいときに便利です。",
      officialUrl: "https://www.2ndstreet.jp/shop/list/1000"
    },
    {
      id: "s05",
      name: "WEGO",
      type: "トレンドショップ",
      query: "WEGO",
      tags: ["Y2K", "韓国系", "ストリート", "カジュアル", "カラフル"],
      description: "Y2Kや韓国系など、その時々のトレンドを手頃に試しやすいショップです。",
      officialUrl: "https://wego.jp/a/shops"
    },
    {
      id: "s06",
      name: "atmos",
      type: "スニーカー・ストリート",
      query: "atmos スニーカー",
      tags: ["ストリート", "スポーティ", "Y2K", "都会的", "軽快"],
      description: "スニーカーを軸に、ストリートやスポーティな着こなしを組み立てたい人向けです。",
      officialUrl: "https://www.atmos-tokyo.com/shop/store/shoplist"
    },
    {
      id: "s07",
      name: "Goldwin / THE NORTH FACE",
      type: "アウトドア・機能服",
      query: "Goldwin THE NORTH FACE",
      tags: ["アウトドア", "ゴープコア", "スポーティ", "機能的", "モード"],
      description: "街とフィールドをつなぐ機能服や、ゴープコアの実物を比較しやすい候補です。",
      officialUrl: "https://www.goldwin.co.jp/store/shoplist/"
    },
    {
      id: "local-1ldk", name: "1LDK nakameguro", type: "独立系セレクトショップ",
      query: "1LDK nakameguro 中目黒", areas: ["東京", "渋谷", "中目黒", "目黒", "恵比寿"],
      tags: ["シティーボーイ", "ミニマル", "ベーシック"],
      features: ["シャツ", "ゆったりした形", "白・生成り"],
      description: "公式でUNIVERSAL PRODUCTS.・EVCON・MY___等を確認。日常着のシルエットや重ね着を比較する候補。",
      officialUrl: "https://1ldkshop.com/", sourceLabel: "公式の取り扱い・店舗情報", checkedAt: "2026-10-06"
    },
    {
      id: "local-nubian", name: "NUBIAN HARAJUKU", type: "独立系セレクトショップ",
      query: "NUBIAN HARAJUKU 原宿", areas: ["東京", "渋谷", "原宿", "表参道", "新宿"],
      tags: ["モード", "ストリート", "個性的"],
      features: ["黒・モノトーン", "重ね着", "厚底・ブーツ"],
      description: "公式のデザイナーズ・ストリートの取り扱いを確認。店頭在庫はオンラインと異なる場合があります。",
      officialUrl: "https://nubiantokyo.com/pages/stores", sourceLabel: "公式の取り扱い・店舗情報", checkedAt: "2026-10-06"
    },
    {
      id: "local-flamingo", name: "FLAMINGO 下北沢店", type: "古着専門店",
      query: "フラミンゴ 下北沢店", areas: ["東京", "下北沢", "世田谷", "渋谷"],
      tags: ["古着", "ヴィンテージ", "アメカジ", "カジュアル"],
      features: ["柄・チェック", "デニム素材", "ベージュ・茶"],
      description: "公式の店舗一覧と古着の取り扱いを確認。掲載商品がこの店舗にあるとは限りません。",
      officialUrl: "https://www.flamingo-online.jp/f/shoplist", sourceLabel: "公式の取り扱い・店舗情報", checkedAt: "2026-10-06"
    }
  ];
  window.KONOMI_SHOPS.push(...(window.KONOMI_FREE_SHOPS || []));
  window.KONOMI_SHOPS.forEach((shop) => {
    shop.sourceLabel ||= "公式サイトを案内するブランド候補";
    shop.reviewStatus = "not-fetched";
  });
})();
