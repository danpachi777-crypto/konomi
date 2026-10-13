const fs = require('node:fs');
const path = require('node:path');
const directory = require('../brand-directory.js');
const { parseKindal, TARGET_PHOTOS } = require('./build-vintage-photo-catalog.cjs');

const output = path.join(__dirname, '..', 'assets', 'vintage-brand-photos.json');
const ragtagInput = path.join(__dirname, '..', 'assets', 'vintage-ragtag-candidates.json');
const WOMEN_TARGET = require('../data.js').filter((card) => card.audience === 'women').length;
const MEN_TARGET = TARGET_PHOTOS - WOMEN_TARGET;
const priority = ['HYKE', 'SNIDEL', 'MARGARET HOWELL', 'Vivienne Westwood', 'MM6 Maison Margiela',
  'CLANE', 'Shinzone', 'BEAMS BOY', 'FURFUR', 'IÉNA', 'ENFÖLD', 'X-girl', 'SLY', 'MHL.',
  'LILY BROWN', 'Yohji Yamamoto', 'Traditional Weatherwear', 'PERVERZE', 'jouetie', 'GYDA',
  'EGOIST', 'NOBLE', 'Demi-Luxe BEAMS', 'J.PRESS LADIES', 'MAJESTIC LEGON', 'HYSTERIC GLAMOUR',
  'AllSaints', 'Zadig & Voltaire', 'RNA-N', 'ANAP', 'GAP', 'niko and ...', 'coen', 'GLOBAL WORK'];

function slug(brand) {
  return brand.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function womenSources() {
  const brands = new Map();
  for (const group of directory.groups.filter((group) => group.audience === 'women'))
    for (const brand of group.brands) {
      const item = brands.get(brand.name) || { brand: brand.name, styleIds: [] };
      item.styleIds.push(group.styleId);
      brands.set(brand.name, item);
    }
  return priority.map((brand) => brands.get(brand)).filter(Boolean);
}

async function fetchKindal(source, page = 1, fetchImpl = fetch) {
  const sourceUrl = `https://shop.kind.co.jp/collections/${slug(source.brand)}?page=${page}`;
  const response = await fetchImpl(sourceUrl, { signal: AbortSignal.timeout(15000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KONOMI-catalog/1.0)', Accept: 'text/html' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  if (html.length > 6_000_000) throw new Error('Response too large');
  return { ...source, sourceUrl, candidates: parseKindal(html, sourceUrl, source.brand) };
}

function selectRoundRobin(sources, target) {
  const selected = sources.map((source) => ({ ...source, photos: [] }));
  const seen = new Set();
  for (let round = 0; round < 100 && seen.size < target; round++) for (const source of selected) {
    if (seen.size >= target) break;
    const photo = source.candidates?.[round];
    if (!photo || seen.has(photo.image)) continue;
    seen.add(photo.image);
    source.photos.push(photo);
  }
  return selected.map(({ candidates, ...source }) => source).filter((source) => source.photos.length);
}

async function buildBalancedCatalog({ fetchImpl = fetch, log = console.log } = {}) {
  const previous = JSON.parse(fs.readFileSync(fs.existsSync(ragtagInput) ? ragtagInput : output, 'utf8'));
  const men = previous.sources.filter((source) => source.photos.length &&
    source.styleIds.some((id) => id.startsWith('men_')) &&
    !source.styleIds.some((id) => id.startsWith('women_')))
    .map((source) => ({ ...source, candidates: source.photos,
      styleIds: source.styleIds.filter((id) => id.startsWith('men_')) }));
  const women = [];
  for (const [index, source] of womenSources().entries()) {
    try {
      const record = await fetchKindal(source, 1, fetchImpl);
      women.push(record);
      log(`${index + 1} ${source.brand}: ${record.candidates.length} women's vintage candidates`);
    } catch (error) { log(`${index + 1} ${source.brand}: ${error.message}`); }
    if (women.reduce((n, record) => n + record.candidates.length, 0) >= WOMEN_TARGET * 1.5) break;
  }
  const selectedMen = selectRoundRobin(men, MEN_TARGET);
  const selectedWomen = selectRoundRobin(women, WOMEN_TARGET);
  const catalog = { generatedAt: new Date().toISOString(), targetPhotos: TARGET_PHOTOS,
    sources: [...selectedMen, ...selectedWomen] };
  return catalog;
}

if (require.main === module) buildBalancedCatalog().then((catalog) => {
  const men = catalog.sources.filter((source) => source.styleIds.some((id) => id.startsWith('men_')))
    .reduce((n, source) => n + source.photos.length, 0);
  const women = catalog.sources.filter((source) => source.styleIds.some((id) => id.startsWith('women_')))
    .reduce((n, source) => n + source.photos.length, 0);
  if (men !== MEN_TARGET || women !== WOMEN_TARGET) {
    console.error(`Insufficient vintage photos: men ${men}/${MEN_TARGET}, women ${women}/${WOMEN_TARGET}`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Saved ${men + women} photos (${men} men, ${women} women) to ${output}`);
}).catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { buildBalancedCatalog, selectRoundRobin, WOMEN_TARGET, MEN_TARGET };
