const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'additional-outfits.json'), 'utf8').replace(/^\uFEFF/, ''));
const correctedLabels = {
  'men-sporty-04': 'ブルージャケットとスポーツショーツ',
  'men-natural-04': '白シャツとベスト・リネンパンツ',
  'women-street-04': '白クロップドトップとパープルデニムセット'
};
plan.forEach(item => { if (correctedLabels[item[0]]) item[4] = correctedLabels[item[0]]; });
fs.writeFileSync(path.join(__dirname, 'additional-outfits.json'), JSON.stringify(plan, null, 2) + '\n');
const cards = require('../data.js');
const manifestPath = path.join(root, 'assets/photo-sources.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const categories = Object.fromEntries(cards.map(card => [card.id.split('-')[1], card.category]));
async function main() {
  for (const [id, pexelsId, slug, creator, label, style] of plan) {
    const localPath = `assets/outfits/${id}.jpg`;
    const destination = path.join(root, localPath);
    const sourceImage = `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=1000`;
    if (!fs.existsSync(destination)) {
      const response = await fetch(sourceImage);
      if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
      fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
    }
    const bytes = fs.readFileSync(destination);
    if (bytes.length < 20000 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new Error(`Invalid JPEG: ${id}`);
    const entry = {
      id, collection: 'diagnosis-and-results', localPath, description: label, creator,
      creatorUrl: 'https://www.pexels.com/', source: 'Pexels',
      sourcePage: `https://www.pexels.com/photo/${slug}-${pexelsId}/`, sourceImage, pexelsId,
      license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/',
      termsUrl: 'https://www.pexels.com/terms-of-service/', retrievedAt: '2026-10-06',
      audience: id.split('-')[0], category: categories[style],
      outfitVisibility: 'full-or-readable-coordination', manuallyReviewed: true
    };
    const index = manifest.items.findIndex(item => item.id === id);
    if (index < 0) manifest.items.push(entry); else manifest.items[index] = entry;
  }
  manifest.generatedAt = '2026-10-06';
  manifest.sourcePolicy.selectionNotes = 'Reviewed outfit photographs covering 13 categories for each audience, with an initial collection and separate additional diagnosis photographs. New photographs were reviewed from local contact sheets and checked for duplicate source IDs and file hashes. Audience labels describe shopping directions. Depicted people and photographers do not endorse KONOMI.';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const dataPath = path.join(root, 'data.js');
  let data = fs.readFileSync(dataPath, 'utf8');
  data = data.replace(/\s*\/\/ additional-outfits:start[\s\S]*?\/\/ additional-outfits:end\s*/, '\n');
  const additions = plan.map(([id, , , , label, style]) => `    make(${JSON.stringify(id)}, ${JSON.stringify(id.split('-')[0])}, ${JSON.stringify(categories[style])}, ${JSON.stringify(label)}, TAGS.${style}),`).join('\n');
  // Append after the existing cards to preserve initial diagnosis and saved IDs.
  data = data.replace(/,?\s*\];\s*const groups/, `,\n    // additional-outfits:start\n${additions}\n    // additional-outfits:end\n  ];\n  const groups`);
  fs.writeFileSync(dataPath, data);
  console.log(`Imported ${plan.length} additional photographs; ${manifest.items.length} total.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
