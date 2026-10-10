(function (root, factory) {
  const sourceCards = typeof module === "object" && module.exports
    ? require("./data.js")
    : (root.window || root).KONOMI_CARDS;
  const recommendations = factory(sourceCards);
  if (typeof module === "object" && module.exports) module.exports = recommendations;
  else (root.window || root).KONOMI_RECOMMENDATIONS = recommendations;
})(typeof globalThis !== "undefined" ? globalThis : this, function (cards) {
  return cards.map((card) => ({
    ...card,
    id: `r-${card.id}`,
    summary: `${card.label}。${card.generated ? "生成したスタイル写真" : "服全体の組み合わせが確認できる実写"}から、${card.category}の好みとディテールを比較できます。`
  }));
});
