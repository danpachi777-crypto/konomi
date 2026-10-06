// Explicit local admin batch. Never invoked by a swipe or app startup.
const fs = require('node:fs');
const path = require('node:path');
const { loadRegisteredItems, validateVector } = require('./precompute-fashionclip.cjs');
const { validateBase } = require('../cloud-api.js');
const root = path.resolve(__dirname, '..');
const file = path.join(root, '.fashionclip/catalog.json');
async function main() {
  const base = validateBase(process.env.FASHIONCLIP_BASE_URL, true);
  if (!process.env.FASHIONCLIP_API_TOKEN) throw new Error('FashionCLIP token is not configured');
  const response = await fetch(base + '/health', { redirect: 'error', signal: AbortSignal.timeout(5000) });
  const health = await response.json();
  if (!response.ok || !health.ready || health.dimension !== 512 || health.model !== 'patrickjohncyh/fashion-clip')
    throw new Error('Real FashionCLIP is not ready');
  const catalog = { schemaVersion: 1, dimension: 512, modelVersion: health.modelVersion, items: [] };
  let previous;
  try { previous = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* first batch */ }
  const reusable = new Map((previous?.modelVersion === health.modelVersion ? previous.items : []).map(item => [item.id, item]));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const item of loadRegisteredItems(root)) {
    let output = reusable.get(item.id);
    let reused = false;
    if (output?.imageSha256 === item.image_sha256) {
      try { validateVector(output.embedding); reused = true; } catch { output = null; }
    } else output = null;
    if (!output) {
      const result = await fetch(base + '/embed', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.FASHIONCLIP_API_TOKEN },
        body: JSON.stringify({ itemId: item.id }) });
      if (!result.ok) throw new Error('Real inference failed: ' + item.id + ' (no dummy vector written)');
      output = await result.json();
      if (output.model !== health.model || output.modelVersion !== health.modelVersion || output.imageSha256 !== item.image_sha256 || output.dimension !== 512)
        throw new Error('Model/content mismatch: ' + item.id);
      validateVector(output.embedding);
      reused = output.cached;
    }
    catalog.items.push({ id: item.id, imageSha256: item.image_sha256, embedding: output.embedding,
      sourceUrl: item.source_url, sourceName: item.source_name });
    catalog.generatedAt = new Date().toISOString();
    fs.writeFileSync(file + '.tmp', JSON.stringify(catalog));
    fs.renameSync(file + '.tmp', file);
    console.log(`${catalog.items.length}: ${item.id} (${reused ? 'cached' : 'real inference'})`);
  }
  console.log('Local real catalog complete: ' + catalog.items.length + ' images; no Supabase writes');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
