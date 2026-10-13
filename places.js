// Google Places公式API。口コミは取得した分のみ分析し、在庫情報とは扱わない。
const KEYWORDS = [
  ["デニム素材", /デニム|ジーンズ|denim|jeans/i], ["柄・チェック", /柄シャツ|チェック|checked|pattern/i],
  ["ゆったりした形", /ワイド|オーバーサイズ|バギー|wide|oversized/i],
  ["黒・モノトーン", /モノトーン|黒い服|ブラック|black|monochrome/i],
  ["ジャケット", /ジャケット|ブレザー|jacket|blazer/i], ["シャツ", /シャツ|shirt/i],
  ["リネン・自然素材", /リネン|麻素材|linen/i], ["機能アウター", /シェル|アウトドア|登山|outdoor/i],
  ["古着", /古着|ヴィンテージ|ビンテージ|vintage|used clothing/i],
  ["モード", /モード|デザイナーズ|designer/i], ["ストリート", /ストリート|streetwear/i],
  ["スニーカー", /スニーカー|sneaker/i], ["短丈・コンパクト", /クロップド|短丈|cropped/i]
];

function extractReviewSignals(reviews = []) {
  // 否定・以前の取り扱いなどの文は、品ぞろえの肯定的根拠にしない。
  const signals = new Set();
  for (const review of reviews) {
    const sentences = (review.text?.text || "").split(/[。.!！?？\n]/);
    for (const sentence of sentences) {
      if (/ない|なかった|なく|無し|閉店|以前|昔|no\b|not\b|used to/i.test(sentence)) continue;
      for (const [signal, pattern] of KEYWORDS) if (pattern.test(sentence)) signals.add(signal);
    }
  }
  return [...signals];
}

async function discoverShops({ area, signals, brands, styles }, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) return { status: "unconfigured", shops: [] };
  const safeArea = String(area || "").trim().slice(0, 60);
  if (!safeArea) throw new Error("買い物エリアを設定してください");
  const terms = Array.isArray(signals) ? signals.filter((s) => typeof s === "string").slice(0, 3) : [];
  const cleanTerms = (values) => Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === "string")
    .map((value) => value.trim().slice(0, 40)).filter(Boolean))].slice(0, 2) : [];
  const likedBrands = cleanTerms(brands);
  const likedStyles = cleanTerms(styles);
  const request = async (url, body, mask) => {
    const response = await fetchImpl(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": mask },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error("Google Placesの取得に失敗しました。API設定・利用制限をご確認ください。");
    return response.json();
  };
  const queries = [
    ...likedBrands.map((brand) => `${safeArea} ${brand} 取扱店 服`),
    ...(likedStyles.length ? [`${safeArea} ${likedStyles[0]} 服屋`] : []),
    `${safeArea} セレクトショップ ${terms.join(" ")}`,
    `${safeArea} 古着屋 洋服`
  ].slice(0, 5);
  const searchResults = await Promise.allSettled(queries.map((textQuery) => request("https://places.googleapis.com/v1/places:searchText",
    { textQuery, languageCode: "ja", pageSize: 8, includedType: "clothing_store", strictTypeFiltering: true },
    "places.id,places.businessStatus")));
  if (searchResults.every((result) => result.status === "rejected")) {
    throw new Error("Google Placesの店舗検索に失敗しました。API設定・利用制限をご確認ください。");
  }
  const searches = searchResults.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const ids = [...new Set(searches.flatMap((result) => result.places || [])
    .filter((place) => place.businessStatus === "OPERATIONAL").map((place) => place.id))].slice(0, 12);
  const results = await Promise.allSettled(ids.map((id) => request(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=ja`, null,
    "id,displayName,formattedAddress,googleMapsUri,websiteUri,nationalPhoneNumber,currentOpeningHours,rating,userRatingCount,reviews,businessStatus,attributions")));
  if (ids.length && results.every((result) => result.status === "rejected")) {
    throw new Error("店舗の詳細と口コミを取得できませんでした。Google Placesの設定をご確認ください。");
  }
  const shops = results.filter((result) => result.status === "fulfilled" &&
    !["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"].includes(result.value.businessStatus)).map(({ value: place }) => {
    const reviews = place.reviews || [];
    const signals = extractReviewSignals(reviews);
    return {
      id: `places-${place.id}`, name: place.displayName?.text || "名称未取得",
      type: "Google Mapsで見つかった衣料品店", query: place.formattedAddress + " " + place.displayName?.text,
      address: place.formattedAddress, mapsUrl: place.googleMapsUri, officialUrl: place.websiteUri || "",
      phone: place.nationalPhoneNumber || "", hours: place.currentOpeningHours?.weekdayDescriptions || [],
      attribution: (place.attributions || []).map((item) => ({ name: item.provider || "", url: item.providerUri || "" })),
      tags: signals.filter((signal) => ["古着", "モード", "ストリート"].includes(signal)),
      features: signals.filter((signal) => !["古着", "モード", "ストリート"].includes(signal)),
      description: signals.length ? `取得できた口コミに「${signals.join("・")}」の言及があります。取り扱いの参考で、現在の在庫は未確認です。`
        : "取得できた口コミでは服の特徴を確認できませんでした。",
      rating: place.rating, reviewCount: place.userRatingCount, reviewStatus: "fetched",
      sourceLabel: "Google Maps / 取得できた口コミ", fetchedAt: new Date().toISOString(),
      reviews: reviews.map((review) => ({ text: review.text?.text || "", author: review.authorAttribution?.displayName || "Google Mapsユーザー",
        authorPhoto: review.authorAttribution?.photoUri || "",
        authorUri: review.authorAttribution?.uri || place.googleMapsUri, url: review.googleMapsUri || place.googleMapsUri,
        publishedAt: review.publishTime }))
    };
  });
  return { status: shops.length ? "ready" : "empty", shops,
    partial: [...searchResults, ...results].some((result) => result.status === "rejected") };
}
module.exports = { extractReviewSignals, discoverShops };
