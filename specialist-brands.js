(function (root, factory) {
  const entries = factory();
  if (typeof module === "object" && module.exports) module.exports = entries;
  else (root.window || root).KONOMI_SPECIALIST_BRANDS = entries;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const entry = (id, brand, name, audiences, tags, features, sourceUrl, sourceSummary) => ({
    id: "specialist-" + id, brand, name, audiences, tags, features, sourceUrl, url: sourceUrl,
    category: "公式の取り扱いから比較", priceBand: "premium", kind: "collection",
    specialist: true, checkedAt: "2026-10-06", sourceSummary
  });
  return [
    entry("graphpaper", "Graphpaper", "オーバーサイズのシャツ・ワイドパンツを比較", ["all"],
      ["ミニマル", "シティーボーイ", "ワイド"], ["シャツ", "ゆったりした形", "パンツ"],
      "https://graphpaper-tokyo.com/", "公式一覧でオーバーサイズシャツとイージーワイドパンツを確認。"),
    entry("yaeca", "YAECA", "コンフォートシャツ・ワイドシャツを比較", ["all"],
      ["ベーシック", "ナチュラル", "シティーボーイ"], ["シャツ", "ゆったりした形"],
      "https://yaecaya.yaeca.com/collections/shirts", "公式のシャツ一覧にメンズ・ウィメンズ・ユニセックスの掲載を確認。"),
    entry("comoli", "COMOLI", "黒・白のカットソーとパンツを比較", ["men"],
      ["ミニマル", "リラックス", "モノトーン"], ["カットソー", "黒・モノトーン", "白・生成り", "パンツ"],
      "https://www.comoli.jp/mailorder", "公式MAIL ORDERで黒・白のコットンジャージートップス、パンツ等を確認。"),
    entry("freshservice", "FreshService", "機能服・シャツ・カーゴパンツを比較", ["all"],
      ["機能的", "シティーボーイ", "ワーク"], ["機能アウター", "シャツ", "パンツ"],
      "https://freshservice.jp/", "公式一覧でテックシャツ、機能ジャケット、カーゴパンツ等を確認。"),
    entry("unfil", "UNFIL", "素材の表情があるニットとカットソーを比較", ["all"],
      ["ナチュラル", "リラックス", "やわらかい"], ["ニット", "カットソー", "自然素材"],
      "https://unfil-inc.com/", "公式一覧でウール・コットン・シルクのニットとコットンジャージーを確認。"),
    entry("clane", "CLANE", "ジャケット・コーデュロイパンツを比較", ["women"],
      ["モード", "きれいめ", "個性的"], ["ジャケット", "パンツ"],
      "https://clane-design.com/jp", "公式の新着一覧でジャケットとコーデュロイパンツの掲載を確認。"),
    entry("todayful", "TODAYFUL", "シャツ・デニム・ジャケットを比較", ["women"],
      ["ナチュラル", "カジュアル", "きれいめ"], ["シャツ", "デニム素材", "ジャケット"],
      "https://lifes-203.com/", "公式でシャツ／ブラウス、デニム、ジャケット等のカテゴリーを確認。"),
    entry("meyame", "MEYAME", "花柄・短丈ニット・ワイドパンツを比較", ["women"],
      ["個性的", "カジュアル", "リラックス"], ["柄・チェック", "短丈・コンパクト", "ゆったりした形"],
      "https://meyame.jp/collections/all", "公式一覧で花柄の羽織り・パンツ、短丈ニット、ワイドパンツを確認。"),
    entry("pheeny", "PHEENY", "プリントやタイダイのTシャツを比較", ["women"],
      ["カジュアル", "個性的", "リラックス"], ["カットソー", "柄・チェック"],
      "https://www.pheeny-store.com/", "ブランド公式から案内されるショップでプリント／タイダイTシャツを確認。"),
    entry("mizuiroind", "mizuiro ind", "コクーン型トップス・ワイドパンツを比較", ["women"],
      ["ミニマル", "ナチュラル", "リラックス"], ["ゆったりした形", "パンツ", "カットソー"],
      "https://mizuiroind.jp/", "公式の新着一覧でコクーン型プルオーバーとワイドイージーパンツを確認。"),
    entry("andwander", "and wander", "機能アウターと街で着るアウトドア服を比較", ["all"],
      ["アウトドア", "ゴープコア", "機能的"], ["機能アウター"],
      "https://www.andwander.com/about-us.html", "公式のブランド説明で軽さ・撥水性・防風性を備えた服づくりを確認。")
  ];
});
