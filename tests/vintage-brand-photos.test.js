const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const legacy = require('../data.js');
const directory = require('../brand-directory.js');
const main = require('../assets/brand-photos.json');
const compact = require('../assets/brand-diagnosis-catalog.json');
const vintage = require('../assets/vintage-brand-photos.json');
const diagnosis = require('../brand-diagnosis.js');
const { rankPhotos } = require('../brand-feed.js');
const { parseRagtag, parseKindal } = require('../scripts/build-vintage-photo-catalog.cjs');

test('vintage shops replace all 392 earlier app photos with distinct brand photos', () => {
  const photos = vintage.sources.flatMap((source) => source.photos.map((photo) => ({ ...photo,
    brand: source.brand, styleIds: source.styleIds })));
  const brands = new Set(main.sources.map((source) => source.brand));
  const existing = new Set([...main.sources.flatMap((source) => source.photos.map((photo) => photo.image)),
    ...legacy.map((card) => card.image)]);
  assert.equal(photos.length, legacy.length);
  assert.equal(new Set(photos.map((photo) => photo.image)).size, photos.length);
  assert.ok(photos.every((photo) => brands.has(photo.brand) && !existing.has(photo.image) &&
    photo.image.startsWith('https://') && photo.url.startsWith('https://')));
  assert.equal(photos.filter((photo) => photo.styleIds.some((id) => id.startsWith('men_'))).length, 193);
  assert.equal(photos.filter((photo) => photo.styleIds.some((id) => id.startsWith('women_'))).length, 199);
  assert.deepEqual(Object.fromEntries(['RAGTAG', 'Kindal'].map((seller) =>
    [seller, photos.filter((photo) => photo.seller === seller).length])), { RAGTAG: 193, Kindal: 199 });
});

test('vintage collectors keep only exact named clothing brands', () => {
  const ragtag = `<div class="search-result__item"><a href="/brand/1/item/a" class="search-result__item-link"><img src="/img/a.jpg" class="search-result__item-photo-img"></a><span class="search-result__name-brand">Supreme</span><p class="item-detail-info__name-brand">パーカー</p></div>
    <div class="search-result__item"><a href="/brand/2/item/b" class="search-result__item-link"><img src="/img/b.jpg" class="search-result__item-photo-img"></a><span class="search-result__name-brand">Supreme Kids</span><p class="item-detail-info__name-brand">パーカー</p></div>`;
  assert.deepEqual(parseRagtag(ragtag, 'https://www.ragtag.jp/search', 'Supreme').map((photo) => photo.image),
    ['https://www.ragtag.jp/img/a.jpg']);
  const products = [{ vendor: 'HYKE', type: 'アウター', tags: ['Women'], title: 'ジャケット',
    featured_image: '//shop.kind.co.jp/a.jpg', handle: 'a' },
  { vendor: 'HYKE×adidas', type: 'アウター', tags: ['Women'], title: 'ジャケット',
    featured_image: '//shop.kind.co.jp/b.jpg', handle: 'b' },
  { vendor: 'HYKE', type: 'バッグ', tags: ['Women'], title: 'バッグ',
    featured_image: '//shop.kind.co.jp/c.jpg', handle: 'c' }];
  assert.deepEqual(parseKindal(`products: ${JSON.stringify(products)}`, 'https://shop.kind.co.jp/collections/hyke', 'HYKE')
    .map((photo) => photo.image), ['https://shop.kind.co.jp/a.jpg']);
});

test('browser bootstrap publishes only brand and vintage photos for diagnosis and suggestions', async () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'app-bootstrap.js'), 'utf8');
  const appended = [];
  const window = { KonomiBrandDiagnosis: diagnosis, KONOMI_BRAND_DIRECTORY: directory,
    KONOMI_CARDS: legacy, KONOMI_RECOMMENDATIONS: legacy };
  const files = { 'assets/brand-diagnosis-catalog.json': compact, 'assets/vintage-brand-photos.json': vintage };
  await vm.runInNewContext(script, { window,
    fetch: async (url) => ({ ok: !!files[url.split('?')[0]], json: async () => files[url.split('?')[0]] }),
    document: { createElement: () => ({}), body: { append: (node) => appended.push(node) } },
    console: { warn: () => {} } });
  assert.equal(window.KONOMI_BRAND_ONLY, true);
  assert.ok(window.KONOMI_CARDS.length >= 300);
  assert.equal(window.KONOMI_CARDS.filter((card) => card.id.startsWith('brand-vintage-')).length, 0);
  assert.ok(window.KONOMI_CARDS.every((card) => card.image.startsWith('https://')));
  assert.equal(new Set(window.KONOMI_CARDS.map((card) => card.image)).size, window.KONOMI_CARDS.length);
  assert.deepEqual(window.KONOMI_RECOMMENDATIONS.map((card) => card.image), window.KONOMI_CARDS.map((card) => card.image));
  assert.match(appended[0].src, /^app\.js\?/);
});

test('result feed excludes unverified vintage gender and respects the selected audience', () => {
  const vintageByBrand = new Map(vintage.sources.map((source) => [source.brand, source.photos]));
  const merged = { sources: main.sources.map((source) => ({ ...source,
    photos: [...source.photos, ...(vintageByBrand.get(source.brand) || [])] })) };
  const styles = directory.groups.map((group) => ({ id: group.styleId, audience: group.audience,
    name: group.style, score: 1 }));
  const seenImages = main.sources.flatMap((source) => source.photos.slice(0, 30).map((photo) => photo.image));
  const result = rankPhotos(merged, styles, 'all', seenImages);
  assert.ok(result.length >= 500);
  assert.equal(result.filter((photo) => photo.id.startsWith('vintage-')).length, 199);
  assert.ok(result.every((photo) => photo.seller !== 'RAGTAG'));
  for (const audience of ['men', 'women']) {
    const selected = rankPhotos(merged, styles, audience, seenImages);
    assert.ok(selected.length > 0);
    assert.ok(selected.every((photo) => photo.audience === audience));
  }
});
