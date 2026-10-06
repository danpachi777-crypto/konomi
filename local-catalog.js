const fs = require('node:fs');
const path = require('node:path');
const { loadRegisteredItems, validateVector } = require('./scripts/precompute-fashionclip.cjs');
function readLocalCatalog(root = __dirname) {
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, '.fashionclip/catalog.json'), 'utf8'));
    if (catalog.schemaVersion !== 1 || catalog.dimension !== 512 ||
        !/^patrickjohncyh\/fashion-clip@[a-f0-9]{40}:clipimageprocessor-exif-rgb-l2-v1$/.test(catalog.modelVersion) ||
        !Array.isArray(catalog.items)) throw new Error('Invalid catalog');
    const registered = new Map(loadRegisteredItems(root).map(item => [item.id, item]));
    const ids = new Set();
    for (const item of catalog.items) {
      if (ids.has(item.id) || registered.get(item.id)?.image_sha256 !== item.imageSha256) throw new Error('Stale catalog');
      ids.add(item.id);
      validateVector(item.embedding);
    }
    return { available: true, ...catalog, registeredCount: registered.size };
  } catch {
    return { available: false, items: [], reason: 'Local catalog missing, invalid or stale; run fashionclip:precompute:local' };
  }
}
module.exports = { readLocalCatalog };
