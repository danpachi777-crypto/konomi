const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = require('../brand-directory.js');
const legacyCards = require('../data.js');

const output = path.join(__dirname, '..', 'assets', 'vintage-ragtag-candidates.json');
const TARGET_PHOTOS = legacyCards.length;
const clothing = /Tシャツ|カットソー|シャツ|ブラウス|パーカー|スウェット|ニット|セーター|カーディガン|ジャケット|コート|パンツ|スカート|ワンピース|オールインワン|ベスト|ブルゾン|デニム|セットアップ|サロペット|チュニック|トップス|アウター|ボトムス/i;

function decode(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function normalizeBrand(value) {
  return decode(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function attribute(tag, name) {
  return decode(tag?.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1]);
}

function parseRagtag(html, pageUrl, brand) {
  const results = [];
  const seen = new Set();
  const chunks = html.split(/<div class="search-result__item\b[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const item = chunk.split(/<div class="search-result__item\b|<\/div><\/div><\/div><\/div>/i)[0];
    const foundBrand = decode(item.match(/<span class="search-result__name-brand">([^<]+)<\/span>/i)?.[1]);
    if (normalizeBrand(foundBrand) !== normalizeBrand(brand)) continue;
    const category = decode(item.match(/<p class="item-detail-info__name-brand">([^<]+)<\/p>/i)?.[1]);
    if (!clothing.test(category)) continue;
    const link = item.match(/<a\b[^>]*class="search-result__item-link"[^>]*>/i)?.[0];
    const img = item.match(/<img\b[^>]*class="search-result__item-photo-img"[^>]*>/i)?.[0] ||
      item.match(/<img\b[^>]*search-result__item-photo-img[^>]*>/i)?.[0];
    if (!link || !img) continue;
    let image, url;
    try {
      image = new URL(attribute(img, 'src'), pageUrl).href;
      url = new URL(attribute(link, 'href'), pageUrl).href;
    } catch { continue; }
    if (!image.startsWith('https://') || !url.startsWith('https://') || seen.has(image)) continue;
    seen.add(image);
    results.push({ id: `vintage-${crypto.createHash('sha1').update(`${brand}\n${image}`).digest('hex').slice(0, 16)}`,
      image, title: `${brand} ${category}`, url, sourceType: 'product', seller: 'RAGTAG' });
  }
  return results;
}

function embeddedProducts(html) {
  const marker = 'products: [';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const offset = start + marker.length - 1;
  let depth = 0, quoted = false, escaped = false;
  for (let index = offset; index < html.length; index++) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[') depth++;
    else if (char === ']' && --depth === 0) {
      try { return JSON.parse(html.slice(offset, index + 1)); }
      catch { return []; }
    }
  }
  return [];
}

function parseKindal(html, pageUrl, brand) {
  const photos = [];
  const seen = new Set();
  for (const product of embeddedProducts(html)) {
    if (normalizeBrand(product.vendor) !== normalizeBrand(brand) ||
      !(product.tags || []).includes('Women') ||
      !clothing.test(`${product.type} ${(product.tags || []).join(' ')} ${product.title}`)) continue;
    const rawImage = product.featured_image || product.images?.[0];
    if (!rawImage || !product.handle) continue;
    let image, url;
    try {
      image = new URL(rawImage, pageUrl).href;
      url = new URL(`/products/${encodeURIComponent(product.handle)}`, pageUrl).href;
    } catch { continue; }
    if (!image.startsWith('https://') || !url.startsWith('https://') || seen.has(image)) continue;
    seen.add(image);
    photos.push({ id: `vintage-${crypto.createHash('sha1').update(`${brand}\n${image}`).digest('hex').slice(0, 16)}`,
      image, title: `${brand} ${product.title}`, url, sourceType: 'product', seller: 'Kindal' });
  }
  return photos;
}

function sourcesFromDirectory() {
  const byName = new Map();
  for (const group of directory.groups) for (const brand of group.brands) {
    const item = byName.get(brand.name) || { brand: brand.name, styleIds: [] };
    item.styleIds.push(group.styleId);
    byName.set(brand.name, item);
  }
  return [...byName.values()];
}

async function fetchBrand(source, fetchImpl = fetch) {
  const sourceUrl = `https://www.ragtag.jp/search?fr=${encodeURIComponent(source.brand)}&limit=100&st=1`;
  const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KONOMI-catalog/1.0)', Accept: 'text/html' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error('Response too large');
  return { ...source, sourceUrl, candidates: parseRagtag(html, sourceUrl, source.brand) };
}

async function buildVintageCatalog({ fetchImpl = fetch, log = console.log, concurrency = 4 } = {}) {
  const sources = sourcesFromDirectory();
  const fetched = Array(sources.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < sources.length) {
      const index = cursor++;
      try { fetched[index] = await fetchBrand(sources[index], fetchImpl); }
      catch (error) { fetched[index] = { ...sources[index], candidates: [], error: String(error.message) }; }
      log(`${index + 1}/${sources.length} ${sources[index].brand}: ${fetched[index].candidates.length} vintage candidates`);
    }
  }));
  const records = fetched.map(({ candidates, ...source }) => ({ ...source, photos: [] , candidates }));
  const used = new Set();
  for (let round = 0; round < 100 && used.size < TARGET_PHOTOS; round++) {
    for (const record of records) {
      if (used.size >= TARGET_PHOTOS) break;
      const photo = record.candidates[round];
      if (photo && !used.has(photo.image)) {
        used.add(photo.image);
        record.photos.push(photo);
      }
    }
  }
  const catalog = { generatedAt: new Date().toISOString(), targetPhotos: TARGET_PHOTOS,
    sources: records.map(({ candidates, ...record }) => record) };
  return catalog;
}

if (require.main === module) buildVintageCatalog().then((catalog) => {
  const count = catalog.sources.reduce((n, source) => n + source.photos.length, 0);
  if (count < TARGET_PHOTOS) {
    console.error(`Only ${count}/${TARGET_PHOTOS} RAGTAG photos found; preserving the previous catalog.`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Saved ${count}/${TARGET_PHOTOS} RAGTAG candidates to ${output}`);
}).catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { parseRagtag, parseKindal, buildVintageCatalog, TARGET_PHOTOS };
