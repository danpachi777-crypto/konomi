const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../assets/brand-photos.json');
const directory = require('../brand-directory.js');
const { rankPhotos } = require('../brand-feed.js');
const { parsePage, parseBaycrewsListing, parseRalphLaurenListing, parseUnitedArrowsListing,
  parseVanListing, sourcesFromDirectory } = require('../scripts/build-brand-photo-catalog.cjs');

test('94 brand photo sources retain their official URLs and diagnosis style IDs', () => {
  const sources = sourcesFromDirectory();
  assert.equal(sources.length, 94);
  assert.deepEqual(catalog.sources.map((source) => source.brand), sources.map((source) => source.brand));
  for (let i = 0; i < sources.length; i++) {
    assert.equal(catalog.sources[i].sourceUrl, sources[i].sourceUrl);
    assert.deepEqual(catalog.sources[i].styleIds, sources[i].styleIds);
    assert.ok(catalog.sources[i].photos.every((photo) => photo.image.startsWith('https://') &&
      photo.url.startsWith('https://') && ['product', 'editorial'].includes(photo.sourceType)));
  }
  assert.equal(directory.countBrands(), 94);
  assert.ok(catalog.sources.every((source) => source.photos.length >= 5), 'all 94 brands have at least five photos');
  for (const group of directory.groups) {
    assert.ok(catalog.sources.some((source) => source.styleIds.includes(group.styleId) && source.photos.length),
      `${group.styleId} has no brand photos`);
    const ranked = rankPhotos(catalog,
      [{ id: group.styleId, name: group.style, audience: group.audience, score: 1 }], group.audience);
    assert.ok(ranked.length > 0, `${group.styleId} shows no photos in the app feed`);
  }
});

test('shared retail listings select the named brand and skip loading images', () => {
  const bayItem = (brand, image, title) => `<li class="item"><a class="g-itemlist-list-itemphoto" href="/item/${image}"><img src="/loading.png" data-original="https://img.example/${image}.jpg"></a><a class="brand">${brand}</a><div class="itemName">${title}</div></li>`;
  const bay = bayItem('EDIFICE', 'jacket', 'Wool Jacket') + bayItem('OTHER', 'other', 'Wool Jacket');
  assert.deepEqual(parseBaycrewsListing(bay, 'https://baycrews.jp/', 'EDIFICE').map((photo) => photo.image),
    ['https://img.example/jacket.jpg']);
  const ralphItem = (brand, id) => `<div class="grid-tile js-category-grid-product"><a class="thumb-link sample-link js-pdp-link" href="/item/${id}" title="Wool Jacket"></a><source srcset="https://dtcralphlauren.scene7.com/is/image/PoloGSI/${id}?size=500"><div class="brand-name clearfix">${brand}</div></div>`;
  const ralph = ralphItem('RRL', 'rrl') + ralphItem('Polo Ralph Lauren', 'polo');
  assert.deepEqual(parseRalphLaurenListing(ralph, 'https://www.ralphlauren.co.jp/', 'RRL')
    .map((photo) => photo.title), ['Wool Jacket']);
});

test('brand photos follow liked diagnosis styles and interleave brands', () => {
  const photo = (id) => ({ id, image: `https://brand.example/${id}.jpg`, url: `https://brand.example/${id}`,
    title: id, sourceType: 'product' });
  const sample = { sources: [
    { brand: 'A', sourceUrl: 'https://a.example', styleIds: ['men_trad'], photos: [photo('a1'), photo('a2')] },
    { brand: 'B', sourceUrl: 'https://b.example', styleIds: ['men_trad'], photos: [photo('b1'), photo('b2')] },
    { brand: 'C', sourceUrl: 'https://c.example', styleIds: ['women_mode'], photos: [photo('c1')] }
  ] };
  const ranked = rankPhotos(sample, [{ id: 'men_trad', name: 'トラッド', audience: 'men', score: 3 }], 'men');
  assert.deepEqual(ranked.map((item) => item.id), ['a1', 'b1', 'a2', 'b2']);
  assert.ok(ranked.every((item) => item.style === 'トラッド'));
  assert.deepEqual(rankPhotos(sample, [], 'men'), []);
});

test('collector ignores metadata logos and non-clothing products', () => {
  const html = '<meta property="og:image" content="https://shop.example/logo.png">' +
    '<script type="application/ld+json">' + JSON.stringify({ '@graph': [
      { '@type': 'Product', name: 'Canvas Bag', image: 'https://shop.example/bag.jpg', url: '/products/bag' },
      { '@type': 'Product', name: 'Wool Jacket', image: 'https://shop.example/jacket.jpg', url: '/products/jacket' }
    ] }) + '</script>';
  assert.deepEqual(parsePage(html, 'https://shop.example/', 'Shop').map((item) => item.title), ['Wool Jacket']);
});

test('shared retailer listing keeps only clothing from the selected label', () => {
  const item = (category, label, id) => `<li class="itemAll labelSortuam-${category}"><a class="imgA" href="/item/${id}/"><img class="number0" src="/images/${id}.jpg"></a><p class="itemThumbListLabel">${label}</p></li>`;
  const html = `<div id="itemThumbList"><ul>${item('outerwear', 'UNITED ARROWS', 'jacket')}${item('bags', 'UNITED ARROWS', 'bag')}${item('tops', 'Other Brand', 'other')}</ul></div>`;
  assert.deepEqual(parseUnitedArrowsListing(html, 'https://store.united-arrows.co.jp/', 'UNITED ARROWS')
    .map((photo) => photo.url), ['https://store.united-arrows.co.jp/item/jacket/']);
});

test('VAN listing links distinct clothing photos to their own products', () => {
  const item = (title, id) => `<article class="fs-c-productList__list__item fs-c-productListItem"><div class="fs-c-productListItem__image"><a href="/c/shirt/${id}"><img data-layzr="https://vanstore.itembox.cloud/product/${id}.jpg?size&#x3D;l&amp;w&#x3D;1000"></a></div><span class="fs-c-productName__name">${title}</span></article>`;
  const photos = parseVanListing(item('BDシャツ', 'shirt') + item('帽子', 'hat'),
    'https://www.van.co.jp/c/shirt', 'VAN');
  assert.equal(photos.length, 1);
  assert.equal(photos[0].url, 'https://www.van.co.jp/c/shirt/shirt');
  assert.equal(photos[0].image, 'https://vanstore.itembox.cloud/product/shirt.jpg?size=l&w=1000');
});
