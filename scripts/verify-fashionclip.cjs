// Real running-service smoke test. No fixture/model substitution and no DB writes.
const { validateBase } = require('../cloud-api.js');
const { loadRegisteredItems, validateVector } = require('./precompute-fashionclip.cjs');
async function main() {
  if (!process.env.FASHIONCLIP_BASE_URL || !process.env.FASHIONCLIP_API_TOKEN) throw new Error('Set FashionCLIP service URL and token');
  const base = validateBase(process.env.FASHIONCLIP_BASE_URL, true);
  const item = loadRegisteredItems()[0];
  const outputs = [];
  for (let count = 0; count < 2; count++) {
    const response = await fetch(base + '/embed', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.FASHIONCLIP_API_TOKEN },
      body: JSON.stringify({ itemId: item.id }) });
    if (!response.ok) throw new Error('Real inference failed: HTTP ' + response.status);
    const output = await response.json();
    validateVector(output.embedding);
    if (output.model !== 'patrickjohncyh/fashion-clip' || output.imageSha256 !== item.image_sha256 || output.dimension !== 512)
      throw new Error('Unexpected model/content');
    outputs.push(output);
  }
  if (!outputs[1].cached || JSON.stringify(outputs[0].embedding) !== JSON.stringify(outputs[1].embedding) ||
      outputs[0].modelVersion !== outputs[1].modelVersion) throw new Error('Cache validation failed');
  console.log('REAL FashionCLIP verified: 512 finite L2-normalized values, content hash verified, second request cached.');
  console.log('Model version: ' + outputs[0].modelVersion);
}
main().catch((error) => { console.error('NOT verified: ' + error.message); process.exitCode = 1; });
