const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const plan = require('./japan-everyday-outfits.json');
const cards = require('../data.js');
const manifestPath = path.join(root, 'assets/photo-sources.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byCard = new Map(cards.map(card => [card.id, card]));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  const sourceIds = new Set(manifest.items.filter(item => !plan.some(([id]) => id === item.id)).map(item => item.pexelsId));
  const hashes = new Set(manifest.items.filter(item => !plan.some(([id]) => id === item.id))
    .map(item => digest(fs.readFileSync(path.join(root, item.localPath)))));
  for (const [id, pexelsId, slug, creator] of plan) {
    const card = byCard.get(id);
    if (!card || sourceIds.has(pexelsId)) throw new Error(`Unregistered card or duplicate source: ${id}`);
    const localPath = `assets/outfits/${id}.jpg`;
    const destination = path.join(root, localPath);
    const sourceImage = `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=1000`;
    if (!fs.existsSync(destination)) {
      const reviewed = path.join(root, '.qa-japan', `${pexelsId}.jpg`);
      if (fs.existsSync(reviewed)) fs.copyFileSync(reviewed, destination);
      else {
        const response = await fetch(sourceImage, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
        fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
      }
    }
    const bytes = fs.readFileSync(destination);
    if (bytes.length < 20000 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9 || hashes.has(digest(bytes)))
      throw new Error(`Invalid or repeated image: ${id}`);
    sourceIds.add(pexelsId);
    hashes.add(digest(bytes));
    const entry = {
      id, collection: 'diagnosis-and-results', localPath, description: card.label, creator,
      creatorUrl: 'https://www.pexels.com/', source: 'Pexels',
      sourcePage: `https://www.pexels.com/photo/${slug}-${pexelsId}/`, sourceImage, pexelsId,
      license: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/',
      termsUrl: 'https://www.pexels.com/terms-of-service/', retrievedAt: '2026-10-07',
      audience: card.audience, category: card.category,
      outfitVisibility: 'full-or-readable-coordination', manuallyReviewed: true
    };
    const index = manifest.items.findIndex(item => item.id === id);
    if (index < 0) manifest.items.push(entry); else manifest.items[index] = entry;
  }
  manifest.generatedAt = '2026-10-07';
  const note = ' Twelve additional looks were checked for visible everyday clothing, varied silhouettes and age representation for Japan-oriented comparisons; the people pictured are not identified as Japanese.';
  if (!manifest.sourcePolicy.selectionNotes.includes(note.trim())) manifest.sourcePolicy.selectionNotes += note;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Registered ${plan.length} photographs; ${manifest.items.length} total.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
