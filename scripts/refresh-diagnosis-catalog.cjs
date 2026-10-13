const fs = require('node:fs');
const path = require('node:path');
const { sourcesFromDirectory } = require('./build-brand-photo-catalog.cjs');
const { packCatalog } = require('../brand-diagnosis.js');

const assets = path.join(__dirname, '..', 'assets');
const fullPath = path.join(assets, 'brand-photos.json');
const compactPath = path.join(assets, 'brand-diagnosis-catalog.json');
const catalog = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
const sources = sourcesFromDirectory();
const byBrand = new Map(catalog.sources.map((source) => [source.brand, source]));
if (sources.length !== catalog.sources.length ||
    sources.some((source) => !byBrand.has(source.brand))) {
  throw new Error('The brand directory and photo catalog are out of sync');
}
catalog.sources = sources.map((source) => ({ ...byBrand.get(source.brand),
  sourceUrl: source.sourceUrl, styleIds: source.styleIds }));
fs.writeFileSync(fullPath, JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync(compactPath, JSON.stringify(packCatalog(catalog)) + '\n');
console.log(`Packed ${catalog.sources.reduce((sum, source) =>
  sum + source.photos.slice(0, 30).filter((photo) => photo.personVerified === true).length, 0)} reviewed photos`);
