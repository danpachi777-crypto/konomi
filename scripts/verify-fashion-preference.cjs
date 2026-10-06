// Requires real precomputed embeddings. No mocks, inference, Supabase or user-state writes.
const assert = require('node:assert/strict');
const { readLocalCatalog } = require('../local-catalog.js');
const preference = require('../fashion-preference.js');
const cards = require('../data.js');
const catalog = readLocalCatalog();
assert.equal(catalog.available, true, 'Run npm run fashionclip:precompute:local first; dummy vectors are not permitted');
assert.equal(catalog.items.length, catalog.registeredCount, 'Complete the real image batch before this verification');
const ids = cards.filter(item => item.audience === 'men').map(item => item.id);
const history = [];
const selected = new Set();
let firstCandidate;
const modes = {};
for (let index = 0; index < ids.length; index++) {
  const next = preference.chooseNext(catalog, history, ids);
  assert.ok(next.item, 'Unseen candidates must remain');
  assert.equal(selected.has(next.item.id), false);
  selected.add(next.item.id);
  modes[next.mode] = (modes[next.mode] || 0) + 1;
  history.push({ id: next.item.id, action: index % 5 === 4 ? 'skip' : index % 3 === 0 ? 'dislike' : 'like' });
  if (index === 9) firstCandidate = preference.chooseNext(catalog, history, ids).item?.id;
  if (index === 29) {
    const snapshot = preference.calculate(catalog, history);
    assert.ok(preference.validEmbedding(snapshot.vector));
    const later = preference.chooseNext(catalog, history, ids);
    assert.notEqual(later.item?.id, firstCandidate);
    console.log('After 30 real-image swipes:', JSON.stringify({ ...snapshot.counts,
      vectorGenerated: !!snapshot.vector, dimension: snapshot.vector.length, personalization: snapshot.personalization,
      candidatesChanged: later.item?.id !== firstCandidate, duplicate: false }));
  }
}
assert.equal(preference.chooseNext(catalog, history, ids).mode, 'exhausted');
const full = ids.slice(0, 20).map(id => ({ id, action: 'like' }));
const buckets = { near: 0, middle: 0, far: 0 };
for (let index = 0; index < 100; index++) buckets[preference.chooseNext(catalog, full, ids, { index }).mode]++;
assert.deepEqual(buckets, { near: 70, middle: 20, far: 10 });
const changed = full.map((entry, index) => ({ ...entry, action: index ? 'dislike' : 'like' }));
const before = preference.chooseNext(catalog, full, ids, { index: 0 });
// Force the personalization branch so ranking differences are isolated from cold-start diversity.
const after = preference.chooseNext(catalog, changed, ids, { index: 0, random: () => 0 });
assert.notDeepEqual(before.preference.vector, after.preference.vector);
const remaining = catalog.items.filter(item => ids.includes(item.id) && !full.some(entry => entry.id === item.id));
const score = (vector, item) => vector.reduce((sum, value, i) => sum + value * item.embedding[i], 0);
const ranking = vector => [...remaining].sort((a, b) => score(vector, b) - score(vector, a)).map(item => item.id);
assert.notDeepEqual(ranking(before.preference.vector), ranking(after.preference.vector));
console.log('REAL FashionCLIP preference verified:', JSON.stringify({ catalogImages: catalog.items.length,
  modelVersion: catalog.modelVersion, uniqueMenImages: selected.size, modes,
  exploration100Decisions: buckets, preferenceChangesRanking: true, exhaustedWithoutRepeats: true,
  inferenceRequestsDuringVerification: 0, supabaseRequests: 0 }));
