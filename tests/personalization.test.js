const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPreference, selectProductRecommendations, selectShopRecommendations } = require("../logic.js");
const { extractReviewSignals, discoverShops } = require("../places.js");
const cards = [
  { id: "black", category: "同じカテゴリー", tags: ["カジュアル"], features: ["黒・モノトーン"] },
  { id: "pattern", category: "同じカテゴリー", tags: ["カジュアル"], features: ["柄・チェック"] }
];
const products = [
  { id: "black-brand", brand: "A", audiences: ["all"], tags: ["カジュアル"], features: ["黒・モノトーン"] },
  { id: "pattern-brand", brand: "B", audiences: ["all"], tags: ["カジュアル"], features: ["柄・チェック"] }
];
test("同じカテゴリーでも選んだ服の特徴でブランド順位が逆転する", () => {
  assert.equal(selectProductRecommendations(products, cards, ["black"])[0].id, "black-brand");
  assert.equal(selectProductRecommendations(products, cards, ["pattern"])[0].id, "pattern-brand");
});
test("選ばなかった特徴を減点し、好きなしでは好みを捏造しない", () => {
  const profile = buildPreference(cards, ["black"]);
  assert.ok(profile.features["黒・モノトーン"] > 0);
  assert.ok(profile.features["柄・チェック"] < 0);
  assert.deepEqual(buildPreference(cards, []).signals, []);
});
test("店舗の地域を確認し、別の地域の個人店を近所扱いしない", () => {
  const shops = [
    { id: "tokyo", tags: ["カジュアル"], areas: ["渋谷"] },
    { id: "osaka", tags: ["カジュアル"], areas: ["大阪"] }
  ];
  assert.deepEqual(selectShopRecommendations(shops, cards, ["black"], 4, "大阪市").map((shop) => shop.id), ["osaka"]);
});
test("口コミの服に関する言及を抽出し、否定や過去の情報は根拠にしない", () => {
  assert.deepEqual(extractReviewSignals([{ text: { text: "デニムと柄シャツが豊富。黒い服はなかった。以前はジャケットがあった。" } }]),
    ["デニム素材", "柄・チェック", "シャツ"]);
});
test("API未設定時は外部通信せず未接続を返す", async () => {
  const result = await discoverShops({ area: "渋谷" }, { fetchImpl: () => { throw new Error("Must not call"); } });
  assert.equal(result.status, "unconfigured");
});
test("好きなブランド・系統で地域の服屋を探し、Googleの店舗情報と出典付き口コミを表示用に返す", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => url.includes("searchText")
      ? { places: [{ id: "open", businessStatus: "OPERATIONAL" }, { id: "closed", businessStatus: "CLOSED_PERMANENTLY" }] }
      : { id: "open", displayName: { text: "地域の服屋" }, formattedAddress: "渋谷区", googleMapsUri: "https://maps.google.com/example",
        nationalPhoneNumber: "03-0000-0000", currentOpeningHours: { weekdayDescriptions: ["月曜日: 11:00～20:00"] },
        reviews: [{ text: { text: "デニムが豊富です。" }, authorAttribution: { displayName: "投稿者", uri: "https://maps.google.com/author" } }] } };
  };
  const result = await discoverShops({ area: "渋谷", signals: ["デニム素材"], brands: ["BEAMS"], styles: ["シティーボーイ"] }, { apiKey: "test-key", fetchImpl });
  assert.equal(result.shops.length, 1);
  assert.equal(result.shops[0].name, "地域の服屋");
  assert.ok(result.shops[0].features.includes("デニム素材"));
  assert.equal(result.shops[0].reviews[0].author, "投稿者");
  assert.equal(result.shops[0].phone, "03-0000-0000");
  assert.equal(result.shops[0].hours[0], "月曜日: 11:00～20:00");
  assert.ok(calls.some((call) => JSON.parse(call.options.body || '{}').textQuery?.includes('BEAMS')));
  assert.ok(calls.some((call) => JSON.parse(call.options.body || '{}').textQuery?.includes('シティーボーイ')));
  assert.ok(calls.every((call) => call.url.startsWith("https://places.googleapis.com/")));
});

test("一部の検索が失敗しても取得できた店舗を残す", async () => {
  const fetchImpl = async (url, options) => {
    if (url.includes('searchText') && JSON.parse(options.body).textQuery.includes('古着屋')) throw new Error('temporary');
    return { ok: true, json: async () => url.includes('searchText')
      ? { places: [{ id: 'open', businessStatus: 'OPERATIONAL' }] }
      : { id: 'open', displayName: { text: '服屋' }, formattedAddress: '渋谷', googleMapsUri: 'https://maps.google.com/example' } };
  };
  const result = await discoverShops({ area: '渋谷' }, { apiKey: 'test-key', fetchImpl });
  assert.equal(result.status, 'ready');
  assert.equal(result.shops.length, 1);
  assert.equal(result.partial, true);
});
