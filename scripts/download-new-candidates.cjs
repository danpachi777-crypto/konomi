const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const plan = require('./new-outfits-candidates.json');
const existing = new Set(require('../assets/photo-sources.json').items.map(item => item.pexelsId));
const directory = path.join(root, '.qa-new-photos');
fs.mkdirSync(directory, { recursive: true });
async function main() {
  const queue = plan.filter(item => !existing.has(item[1]));
  const results = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const item = queue.shift();
      const file = path.join(directory, `${item[1]}.jpg`);
      try {
        if (!fs.existsSync(file)) {
          const response = await fetch(`https://images.pexels.com/photos/${item[1]}/pexels-photo-${item[1]}.jpeg?auto=compress&cs=tinysrgb&w=1000`, { signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length < 20000 || bytes.readUInt16BE(0) !== 0xffd8 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) throw new Error('Incomplete JPEG');
          fs.writeFileSync(file, bytes);
        }
        results.push(item);
      } catch (error) { console.error(item[1], error.message); }
    }
  }));
  fs.writeFileSync(path.join(directory, 'downloaded.json'), JSON.stringify(results, null, 2));
  console.log(`Downloaded ${results.length} new photographs; excluded ${plan.length - results.length} existing or failed candidates.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
