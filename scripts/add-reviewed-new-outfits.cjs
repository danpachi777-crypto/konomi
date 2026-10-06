const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const candidates = require('./new-outfits-candidates.json');
const reviewed = require('./new-outfits-reviewed.json');
const manifest = require('../assets/photo-sources.json');
const planPath = path.join(__dirname, 'additional-outfits.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const hashes = new Set(manifest.items.filter(item => !reviewed.some(([id]) => id === item.id))
  .map(item => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, item.localPath))).digest('hex')));
for (const [id, photoId, label, style] of reviewed) {
  const candidate = candidates.find(item => item[1] === photoId);
  if (!candidate) throw new Error(`Missing source: ${photoId}`);
  const previous = manifest.items.find(item => item.pexelsId === photoId);
  if (previous && previous.id !== id) throw new Error(`Photo already in use: ${photoId}`);
  const bytes = fs.readFileSync(path.join(root, '.qa-new-photos', `${photoId}.jpg`));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hashes.has(hash)) throw new Error(`Duplicate photograph: ${photoId}`);
  hashes.add(hash);
  const destination = path.join(root, 'assets/outfits', `${id}.jpg`);
  fs.writeFileSync(destination, bytes);
  const entry = [id, photoId, candidate[2], candidate[3], label, style];
  const index = plan.findIndex(item => item[0] === id);
  if (index < 0) plan.push(entry); else plan[index] = entry;
}
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
console.log(`Registered ${reviewed.length} distinct new photographs.`);
