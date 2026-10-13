const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../assets/brand-photos.json');
const directory = require('../brand-directory.js');
const baseline = require('../data.js');
const { cards, discoveryPhotos, packCatalog, unpackCatalog } = require('../brand-diagnosis.js');
const compact = require('../assets/brand-diagnosis-catalog.json');
const fs = require('node:fs');
const path = require('node:path');
const { diagnosisQueue } = require('../diagnosis-pool.js');
const { rankPhotos } = require('../brand-feed.js');
const { audienceFor, explicitAudience } = require('../photo-audience.js');

test('diagnosis cards use only photos matching the selected audience in every style', () => {
  const pool = cards(catalog, directory, baseline);
  assert.ok(pool.length >= 300);
  assert.equal(new Set(pool.map((card) => card.styleId)).size, 26);
  assert.ok(pool.every((card) => card.image.startsWith('https://') && card.brand));
  const reviewed = new Set(catalog.sources.flatMap((source) => source.photos.slice(0, 30)
    .filter((photo) => photo.personVerified === true).map((photo) => photo.image)));
  assert.ok(pool.every((card) => reviewed.has(card.image)));
  const sources = new Map(catalog.sources.map((source) => [source.brand, source]));
  for (const card of pool) {
    const source = sources.get(card.brand);
    const photo = source.photos.find((item) => `brand-${item.id}` === card.id);
    assert.equal(audienceFor(photo, source), card.audience, card.label);
    assert.notEqual(explicitAudience(photo, source), card.audience === 'men' ? 'women' : 'men', card.label);
  }
  for (const audience of ['men', 'women']) {
    const queue = diagnosisQueue(pool, audience);
    const byId = new Map(pool.map((card) => [card.id, card]));
    assert.equal(queue.length, 150);
    assert.ok(queue.every((id) => byId.get(id).audience === audience));
    assert.equal(new Set(queue.map((id) => byId.get(id).styleId)).size, audience === 'men' ? 14 : 12);
  }
});

test('unreviewed product photos never enter diagnosis or the compact catalog', () => {
  const source = { brand: 'A', styleIds: ['men_trad'], photos: [
    { id: 'flat', image: 'https://example.com/flat.jpg', url: 'https://example.com/flat' },
    { id: 'person', image: 'https://example.com/person.jpg', url: 'https://example.com/person', personVerified: true }
  ] };
  const sample = { generatedAt: 'test', sources: [source] };
  const groups = { groups: [{ styleId: 'men_trad', audience: 'men', style: 'トラッド' }] };
  assert.deepEqual(cards(sample, groups).map((card) => card.id), ['brand-person']);
  assert.deepEqual(packCatalog(sample).sources[0][2].map((photo) => photo[0]), ['person']);
  assert.deepEqual(cards(unpackCatalog(packCatalog(sample)), groups).map((card) => card.id), ['brand-person']);
  assert.deepEqual(unpackCatalog({ sources: [[source.brand, source.styleIds, source.photos]] }).sources, []);
});

test('compact startup catalog preserves every diagnosis candidate and avoids the full photo feed payload', () => {
  assert.equal(compact.generatedAt, catalog.generatedAt);
  assert.deepEqual(compact.sources, packCatalog(catalog).sources);
  assert.deepEqual(cards(unpackCatalog(compact), directory, baseline), cards(catalog, directory, baseline));
  const assets = path.join(__dirname, '..', 'assets');
  assert.ok(fs.statSync(path.join(assets, 'brand-diagnosis-catalog.json')).size <
    fs.statSync(path.join(assets, 'brand-photos.json')).size * .6);
});

test('mixed brand and retailer photos are not assigned by brand alone', () => {
  const source = { brand: 'Theory', styleIds: ['men_business', 'women_adult'], photos: [
    { id: 'm', image: 'https://example.com/m.jpg', url: 'https://www.theory.co.jp/shop/item/1?shopCode=02', title: 'jacket', personVerified: true },
    { id: 'w', image: 'https://example.com/w.jpg', url: 'https://www.theory.co.jp/shop/item/2?shopCode=01', title: 'jacket', personVerified: true },
    { id: 'unknown', image: 'https://example.com/u.jpg', url: 'https://example.com/u', title: 'jacket', personVerified: true }
  ] };
  assert.deepEqual(cards({ sources: [source] }, directory, baseline).map((card) => [card.id, card.audience]),
    [['brand-m', 'men'], ['brand-w', 'women']]);
  const nike = catalog.sources.find((item) => item.brand === 'Nike');
  const womenPhoto = nike.photos.find((photo) => /Women&apos;s/.test(photo.title));
  assert.equal(audienceFor(womenPhoto, nike), null);
  assert.equal(audienceFor({ ...womenPhoto, audience: 'women' }, nike), 'women');
  const nanga = catalog.sources.find((item) => item.brand === 'NANGA');
  const menPhoto = nanga.photos.find((photo) => /-mens/.test(photo.url));
  assert.equal(audienceFor(menPhoto, nanga), null);
  assert.equal(audienceFor({ ...menPhoto, audience: 'men' }, nanga), 'men');
});

test('discovery reserves ten different images after the first thirty per brand', () => {
  const photo = (n) => ({ id: String(n), image: `https://example.com/${n}.jpg`,
    url: `https://example.com/${n}`, title: String(n), sourceType: 'product' });
  const source = { brand: 'A', styleIds: ['men_trad'], photos: Array.from({ length: 40 }, (_, n) => photo(n)) };
  assert.deepEqual(discoveryPhotos(source).map((item) => item.id), Array.from({ length: 10 }, (_, n) => String(n + 30)));
  const ranked = rankPhotos({ sources: [source] },
    [{ id: 'men_trad', name: 'トラッド', audience: 'men', score: 1 }], 'men', source.photos.slice(0, 30).map((item) => item.image));
  assert.deepEqual(ranked.map((item) => item.id), Array.from({ length: 10 }, (_, n) => String(n + 30)));
});

test('every registered brand has thirty diagnosis photos and ten separate discovery photos', () => {
  assert.equal(catalog.sources.length, 94);
  const allImages = [];
  for (const source of catalog.sources) {
    assert.equal(source.photos.length, 40, source.brand);
    assert.equal(new Set(source.photos.map((photo) => photo.image)).size, 40, source.brand);
    assert.equal(discoveryPhotos(source).length, 10, source.brand);
    assert.ok(source.photos.every((photo) => photo.image.startsWith('https://') &&
      photo.url.startsWith('https://') && ['product', 'editorial'].includes(photo.sourceType)), source.brand);
    allImages.push(...source.photos.map((photo) => photo.image));
  }
  assert.equal(new Set(allImages).size, 3760);
});
