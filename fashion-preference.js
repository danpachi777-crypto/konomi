(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KonomiFashionPreference = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const CONFIG = Object.freeze({ dimension: 512, dislikeWeight: 0.2, coldStart: 20, personalizeFrom: 10,
    exploration: Object.freeze({ near: 0.7, middle: 0.2, far: 0.1 }),
    recency: Object.freeze([{ through: 50, weight: 1 }, { through: 150, weight: 0.7 }, { through: Infinity, weight: 0.4 }].map(Object.freeze)) });
  const canonicalId = id => String(id || '').replace(/^r-/, '');
  const action = choice => choice === 'like' ? 'like' : ['no', 'dislike'].includes(choice) ? 'dislike' : ['skip', 'neutral'].includes(choice) ? 'skip' : null;
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  const cosine = (a, b) => Math.max(-1, Math.min(1, dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b))));
  const recencyWeight = age => CONFIG.recency.find(tier => age <= tier.through).weight;
  function normalized(vector) {
    const length = Math.sqrt(dot(vector, vector));
    return length > 1e-12 && Number.isFinite(length) ? vector.map(value => value / length) : null;
  }
  function validEmbedding(vector) {
    return Array.isArray(vector) && vector.length === CONFIG.dimension && vector.every(value => typeof value === 'number' && Number.isFinite(value)) &&
      Math.abs(Math.sqrt(dot(vector, vector)) - 1) <= 0.001;
  }
  function validateCatalog(catalog) {
    if (catalog?.dimension !== CONFIG.dimension || !/^patrickjohncyh\/fashion-clip@[a-f0-9]{40}:clipimageprocessor-exif-rgb-l2-v1$/.test(catalog.modelVersion) ||
      !Array.isArray(catalog.items)) throw new Error('No valid FashionCLIP catalog');
    const ids = new Set();
    for (const item of catalog.items) {
      if (!item.id || ids.has(item.id) || !/^[a-f0-9]{64}$/.test(item.imageSha256) || !validEmbedding(item.embedding)) throw new Error('Invalid embedding');
      ids.add(item.id);
    }
    return catalog;
  }
  // Latest answer per underlying photograph wins, matching the existing cloud upsert.
  function historyFromState(state, { preserveRatingsOnSkip = false } = {}) {
    const unfold = entry => {
      const chain = [], visited = new Set();
      for (let value = entry; value && !visited.has(value); value = value.previousAnswer) { chain.unshift(value); visited.add(value); }
      return chain;
    };
    const records = [...(state.history || []), ...(state.recommendationHistory || []).flatMap(entry => preserveRatingsOnSkip ? unfold(entry) : [entry])];
    // Migrate legacy saved likes only when no recorded answer exists for that image.
    const known = new Set(records.filter(entry => !preserveRatingsOnSkip || action(entry.action || entry.choice) !== 'skip').map(entry => canonicalId(entry.id)));
    const legacy = (state.likedIds || []).filter(id => !known.has(canonicalId(id))).map(id => ({ id, choice: 'like' }));
    const latest = new Map();
    for (const entry of [...legacy, ...records]) {
      const id = canonicalId(entry.id), value = action(entry.action || entry.choice);
      if (!id || !value) continue;
      // A neutral re-evaluation is not a new opinion and does not erase an earlier rating.
      if (preserveRatingsOnSkip && value === 'skip' && latest.has(id) && latest.get(id).action !== 'skip') continue;
      latest.delete(id);
      latest.set(id, { id, action: value, createdAt: entry.createdAt || null });
    }
    return [...latest.values()];
  }
  function calculate(catalog, history) {
    validateCatalog(catalog);
    const byId = new Map(catalog.items.map(item => [item.id, item]));
    const positive = Array(CONFIG.dimension).fill(0), negative = Array(CONFIG.dimension).fill(0);
    let likeWeight = 0, dislikeWeight = 0;
    const counts = { like: 0, dislike: 0, skip: 0, missing: 0, embeddedLike: 0, embeddedDislike: 0 };
    // Neutral swipes must not age rated answers or change the preference/STYLE SCORE.
    const rated = history.filter(entry => ['like', 'dislike'].includes(action(entry.action || entry.choice)));
    const ages = new Map(rated.map((entry, index) => [entry, rated.length - index]));
    history.forEach((entry, index) => {
      const value = action(entry.action || entry.choice);
      if (!value) return;
      counts[value]++;
      if (value === 'skip') return;
      const item = byId.get(canonicalId(entry.id));
      if (!item) { counts.missing++; return; }
      const age = ages.get(entry);
      const weight = recencyWeight(age);
      const target = value === 'like' ? positive : negative;
      item.embedding.forEach((v, i) => { target[i] += weight * v; });
      if (value === 'like') { likeWeight += weight; counts.embeddedLike++; }
      else { dislikeWeight += weight; counts.embeddedDislike++; }
    });
    const vector = likeWeight ? normalized(positive.map((v, i) => v / likeWeight - CONFIG.dislikeWeight * (dislikeWeight ? negative[i] / dislikeWeight : 0))) : null;
    const evaluated = counts.embeddedLike + counts.embeddedDislike;
    return { schemaVersion: 1, dimension: CONFIG.dimension, modelVersion: catalog.modelVersion, vector, counts,
      personalization: vector ? Math.max(0, Math.min(1, (evaluated - CONFIG.personalizeFrom) / (CONFIG.coldStart - CONFIG.personalizeFrom))) : 0,
      status: vector ? 'ready' : likeWeight ? 'degenerate' : 'needs-like' };
  }
  // Low discrepancy schedule: in each complete 10-slot cycle, exactly 7/2/1.
  function explorationBucket(index, ratios = CONFIG.exploration) {
    const keys = Object.keys(ratios);
    if (keys.length !== 3 || !keys.every(key => ['near', 'middle', 'far'].includes(key)) ||
      keys.some(key => !Number.isFinite(ratios[key]) || ratios[key] < 0) || Math.abs(Object.values(ratios).reduce((a, b) => a + b, 0) - 1) > 1e-9)
      throw new Error('Exploration ratios must sum to one');
    const used = Object.fromEntries(keys.map(key => [key, 0]));
    let chosen;
    // Bounded cycle for production; deterministic and independent of UI re-renders.
    const cycle = 100;
    for (let slot = 0; slot <= ((index % cycle) + cycle) % cycle; slot++) {
      chosen = keys.reduce((best, key) => (slot + 1) * ratios[key] - used[key] > (slot + 1) * ratios[best] - used[best] + 1e-12 ? key : best, keys[0]);
      used[chosen]++;
    }
    return chosen;
  }
  function chooseNext(catalog, history, candidateIds, options = {}) {
    const preference = calculate(catalog, history);
    const seen = new Set([...history.map(entry => canonicalId(entry.id)), ...(options.reserved || []).map(canonicalId)]);
    const hashes = new Set(catalog.items.filter(item => seen.has(item.id)).map(item => item.imageSha256));
    const allowed = new Set(candidateIds.map(canonicalId));
    const pool = catalog.items.filter(item => allowed.has(item.id) && !seen.has(item.id) && !hashes.has(item.imageSha256));
    if (!pool.length) return { item: null, preference, mode: 'exhausted', reason: 'No unseen embedded images; never recycle implicitly' };
    const references = catalog.items.filter(item => seen.has(item.id)).map(item => item.embedding);
    const centroid = normalized(pool[0].embedding.map((_, i) => pool.reduce((sum, item) => sum + item.embedding[i], 0) / pool.length));
    const diversity = item => references.length ? 1 - Math.max(...references.map(vector => cosine(item.embedding, vector))) : 1 - (centroid ? cosine(item.embedding, centroid) : 0);
    const scored = pool.map(item => ({ ...item, score: preference.vector ? cosine(preference.vector, item.embedding) : null, diversity: diversity(item) }));
    const index = options.index ?? history.length;
    const random = options.random || (() => { const n = Math.sin((index + 1) * 127.1) * 43758.5453; return n - Math.floor(n); });
    if (!preference.vector || preference.personalization < 1 && random() >= preference.personalization) {
      scored.sort((a, b) => b.diversity - a.diversity || a.id.localeCompare(b.id));
      return { item: scored[0], preference, mode: 'diversity', candidateCount: pool.length };
    }
    scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const bucket = explorationBucket(index, options.ratios);
    const nearEnd = Math.max(1, Math.ceil(scored.length * 0.3));
    const middleEnd = Math.max(nearEnd, Math.ceil(scored.length * 0.7));
    const bands = { near: scored.slice(0, nearEnd), middle: scored.slice(nearEnd, middleEnd), far: scored.slice(middleEnd) };
    const selected = bands[bucket];
    // Too few candidates: safest available band, never relax the seen exclusion.
    const band = selected.length ? selected : scored;
    const item = bucket === 'near' || !selected.length ? band[0] : [...band].sort((a, b) => b.diversity - a.diversity || a.id.localeCompare(b.id))[0];
    return { item, preference, mode: bucket, fallback: !selected.length, candidateCount: pool.length };
  }
  function createLocalStorageAdapter(storage, key = 'konomi-fashion-preference-v1') {
    return { load() { try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; } },
      save(snapshot) { storage.setItem(key, JSON.stringify(snapshot)); } };
  }
  // A deterministic similarity scale, NOT taste quality or a probability.
  function similarityToStyleScore(similarity) {
    if (typeof similarity !== 'number' || !Number.isFinite(similarity)) return null;
    return Math.round(50 * (Math.max(-1, Math.min(1, similarity)) + 1));
  }
  function styleScore(catalog, snapshot, itemId) {
    if (!catalog || !snapshot || snapshot.modelVersion !== catalog.modelVersion || !validEmbedding(snapshot.vector)) return null;
    const item = catalog.items?.find(entry => entry.id === canonicalId(itemId));
    if (!item || !validEmbedding(item.embedding)) return null;
    return similarityToStyleScore(cosine(snapshot.vector, item.embedding));
  }
  function analyzeHistory(state, items) {
    const history = historyFromState(state);
    const byId = new Map(items.map(item => [canonicalId(item.id), item]));
    const counts = { like: 0, dislike: 0, skip: 0 };
    const liked = [], categories = new Map(), tags = new Map();
    let missingLiked = 0;
    for (const entry of history) {
      counts[entry.action]++;
      if (entry.action !== 'like') continue;
      const item = byId.get(entry.id);
      if (!item) { missingLiked++; continue; }
      liked.push(item);
      if (typeof item.category === 'string' && item.category.trim()) categories.set(item.category, (categories.get(item.category) || 0) + 1);
      for (const tag of new Set(item.tags || [])) {
        if (typeof tag === 'string' && tag.trim()) tags.set(tag, (tags.get(tag) || 0) + 1);
      }
    }
    const rank = entries => [...entries].map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'));
    return { history, counts, liked, missingLiked, categories: rank(categories), tags: rank(tags),
      evaluated: counts.like + counts.dislike, total: history.length };
  }
  function createController(catalog, adapter) {
    validateCatalog(catalog);
    let snapshot;
    return { update(state) {
      const history = historyFromState(state);
      const preferenceHistory = historyFromState(state, { preserveRatingsOnSkip: true });
      const ratings = calculate(catalog, preferenceHistory);
      snapshot = { ...calculate(catalog, history), vector: ratings.vector, status: ratings.status, personalization: ratings.personalization,
        ratingCounts: ratings.counts, history, preferenceHistory, updatedAt: new Date().toISOString() };
      try { adapter.save(snapshot); } catch { snapshot.storageError = true; }
      return snapshot;
    }, select(state, ids, options) { return chooseNext(catalog, historyFromState(state, { preserveRatingsOnSkip: true }), ids, options); },
    snapshot() { return snapshot; }, catalog };
  }
  return { CONFIG, canonicalId, cosine, validEmbedding, validateCatalog, historyFromState, calculate, explorationBucket,
    chooseNext, recencyWeight, createLocalStorageAdapter, createController, similarityToStyleScore, styleScore, analyzeHistory };
});
