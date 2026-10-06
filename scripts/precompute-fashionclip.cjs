// Explicit admin batch, never called by app startup or a user's swipe.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateBase } = require('../cloud-api.js');
const root = path.resolve(__dirname, '..');
const model = 'patrickjohncyh/fashion-clip';

function validateVector(value) {
  const vector = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(vector) || vector.length !== 512 || vector.some((v) => typeof v !== 'number' || !Number.isFinite(v)) ||
      Math.abs(Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) - 1) > 0.001) throw new Error('Invalid real embedding');
  return vector;
}

function loadRegisteredItems(projectRoot = root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'assets/photo-sources.json'), 'utf8'));
  const ids = new Set();
  return manifest.items.map((entry) => {
    if (ids.has(entry.id)) throw new Error('Duplicate registered item ID');
    ids.add(entry.id);
    if (!entry.sourcePage || !entry.source || !entry.license || !entry.licenseUrl || entry.manuallyReviewed !== true)
      throw new Error('Missing reviewed source/license: ' + entry.id);
    for (const url of [entry.sourcePage, entry.licenseUrl]) if (new URL(url).protocol !== 'https:') throw new Error('Invalid provenance URL');
    const file = fs.realpathSync(path.resolve(projectRoot, entry.localPath));
    const outfitRoot = fs.realpathSync(path.join(projectRoot, 'assets/outfits'));
    const relative = path.relative(outfitRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Image outside outfit directory');
    const data = fs.readFileSync(file);
    if (!data.length || data.length > 10 * 1024 * 1024) throw new Error('Image size invalid');
    return { id: entry.id, image_url: entry.localPath, source_url: entry.sourcePage, source_name: entry.source,
      creator: entry.creator || null, creator_url: entry.creatorUrl || null, license_name: entry.license,
      license_url: entry.licenseUrl, rights_reviewed: true, image_sha256: crypto.createHash('sha256').update(data).digest('hex'),
      rights_metadata: { sourceImage: entry.sourceImage, retrievedAt: entry.retrievedAt, termsUrl: entry.termsUrl,
        manuallyReviewed: entry.manuallyReviewed, audience: entry.audience, category: entry.category,
        notice: 'FashionCLIP does not grant image or portrait rights; review provenance before publishing.' } };
  });
}

async function precompute({ env = process.env, fetchImpl = fetch, projectRoot = root, dryRun = false, registerOnly = false,
  log = console.log } = {}) {
  const items = loadRegisteredItems(projectRoot);
  if (dryRun) { log('Dry run: ' + items.length + ' reviewed images; no inference, network or database writes.'); return { registered: items.length }; }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for admin batch only');
  const base = validateBase(env.SUPABASE_URL, true);
  async function db(route, body) {
    const result = await fetchImpl(base + '/rest/v1/' + route, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        // New Supabase secret keys are opaque, not JWTs. Send them in apikey only.
        ...(!env.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_') ? { Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY } : {}),
        'Content-Type': 'application/json', ...(body ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    if (!result.ok) throw new Error('Supabase catalog operation failed (HTTP ' + result.status + '); check schema/RLS/configuration');
    const text = await result.text();
    return text ? JSON.parse(text) : null;
  }
  let version;
  let aiBase;
  if (!registerOnly) {
    if (!env.FASHIONCLIP_BASE_URL || !env.FASHIONCLIP_API_TOKEN) throw new Error('Configure and start real FashionCLIP before precompute');
    aiBase = validateBase(env.FASHIONCLIP_BASE_URL, true);
    const health = await fetchImpl(aiBase + '/health', { redirect: 'error', signal: AbortSignal.timeout(5000) });
    const info = await health.json();
    if (!health.ok || info.ready !== true || info.model !== model || info.dimension !== 512 ||
        typeof info.modelVersion !== 'string' || !info.modelVersion.startsWith(model + '@')) throw new Error('Real FashionCLIP is not ready');
    version = info.modelVersion;
  }
  const existing = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await db('fashion_items?select=id,image_sha256,embedding,embedding_model,embedding_model_version,embedded_at&order=id&limit=1000&offset=' + offset);
    if (!Array.isArray(page)) throw new Error('Catalog schema missing');
    existing.push(...page);
    if (page.length < 1000) break;
  }
  const byId = new Map(existing.map((item) => [item.id, item]));
  const reusable = new Map(existing.filter((item) => item.embedding && item.embedding_model === model &&
    item.embedding_model_version === version && item.embedded_at).map((item) => [item.image_sha256, item]));
  let inferred = 0, reused = 0;
  for (const item of items) {
    const old = byId.get(item.id);
    let embedded;
    if (!registerOnly) {
      const cached = reusable.get(item.image_sha256);
      if (cached) {
        embedded = { embedding: validateVector(cached.embedding), embedding_model: model,
          embedding_model_version: version, embedded_at: cached.embedded_at };
        reused++;
      } else {
        const response = await fetchImpl(aiBase + '/embed', { method: 'POST', redirect: 'error',
          signal: AbortSignal.timeout(120000), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.FASHIONCLIP_API_TOKEN },
          body: JSON.stringify({ itemId: item.id }) });
        if (!response.ok) throw new Error('FashionCLIP failed for ' + item.id + '; no dummy embedding or success written');
        const output = await response.json();
        if (output.model !== model || output.modelVersion !== version || output.imageSha256 !== item.image_sha256 || output.dimension !== 512)
          throw new Error('Model/version/content mismatch: ' + item.id);
        embedded = { embedding: validateVector(output.embedding), embedding_model: model, embedding_model_version: version,
          embedded_at: new Date().toISOString() };
        reusable.set(item.image_sha256, { ...embedded });
        inferred++;
      }
    } else if (old?.image_sha256 === item.image_sha256 && old.embedding) {
      if (old.embedding_model !== model || !old.embedding_model_version || !old.embedded_at)
        throw new Error('Stored embedding provenance is invalid: ' + item.id);
      embedded = { embedding: validateVector(old.embedding), embedding_model: old.embedding_model,
        embedding_model_version: old.embedding_model_version, embedded_at: old.embedded_at };
    } else {
      embedded = { embedding: null, embedding_model: null, embedding_model_version: null, embedded_at: null };
    }
    // Explicitly retain unchanged real embeddings; do not rely on partial-upsert defaults.
    await db('fashion_items?on_conflict=id', { ...item, ...embedded, updated_at: new Date().toISOString() });
    log(item.id + ': ' + (registerOnly ? 'metadata registered' : 'real embedding stored'));
  }
  return { registered: items.length, inferred, reused };
}

if (require.main === module) {
  const flags = process.argv.slice(2);
  if (flags.some((flag) => !['--dry-run', '--register-only'].includes(flag))) {
    console.error('Use --dry-run or --register-only'); process.exitCode = 1;
  } else precompute({ dryRun: flags.includes('--dry-run'), registerOnly: flags.includes('--register-only') })
    .then((result) => console.log(result)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { precompute, loadRegisteredItems, validateVector };
