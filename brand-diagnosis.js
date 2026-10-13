(function (root, factory) {
  const audience = typeof module === 'object' && module.exports
    ? require('./photo-audience.js') : (root.window || root).KonomiPhotoAudience;
  const api = factory(audience);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.window || root).KonomiBrandDiagnosis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (photoAudience) {
  const DIAGNOSIS_PHOTOS_PER_BRAND = 30;
  const DISCOVERY_PHOTOS_PER_BRAND = 10;

  // Diagnosis uses only photos reviewed for a visible person. An unreviewed
  // catalog entry must never be promoted to a diagnosis card.
  const diagnosisPhotos = (source) => (source.photos || [])
    .slice(0, DIAGNOSIS_PHOTOS_PER_BRAND).filter((photo) => photo.personVerified === true);

  // Keep the first-screen payload focused on diagnosis. The complete photo
  // catalog is loaded only when the user opens the brand photo feed.
  function packCatalog(catalog) {
    return { generatedAt: catalog.generatedAt, personReviewVersion: 3, sources: (catalog.sources || []).map((source) => [
      source.brand, source.styleIds,
      diagnosisPhotos(source)
        .map((photo, index) => ({ photo, index, audience: photoAudience.audienceFor(photo, source) }))
        .filter(({ audience }) => audience === 'men' || audience === 'women')
        .map(({ photo, audience, index }) => [photo.id, photo.image, photo.title, photo.url, audience, index])
    ]) };
  }

  function unpackCatalog(packed) {
    if (packed?.personReviewVersion !== 3) return { sources: [] };
    return { sources: (packed.sources || []).map(([brand, styleIds, photos]) => ({
      brand, styleIds,
      photos: (photos || []).map(([id, image, title, url, audience, catalogIndex]) =>
        ({ id, image, title, url, audience, catalogIndex, personVerified: true }))
    })) };
  }

  function cards(catalog, directory, baseline = []) {
    const groups = new Map((directory?.groups || []).map((group) => [group.styleId, group]));
    const templates = new Map(baseline.filter((card) => card.styleId)
      .map((card) => [card.styleId, card]));
    const result = [];
    for (const source of catalog?.sources || []) {
      const styleIds = (source.styleIds || []).filter((id) => groups.has(id));
      if (!styleIds.length) continue;
      for (const [index, photo] of diagnosisPhotos(source).entries()) {
        if (!photo.id || !photo.image?.startsWith('https://') || !photo.url?.startsWith('https://')) continue;
        const audience = photoAudience.audienceFor(photo, source);
        const matchingStyles = styleIds.filter((id) => groups.get(id).audience === audience);
        if (!matchingStyles.length) continue;
        const styleId = matchingStyles[(photo.catalogIndex ?? index) % matchingStyles.length];
        const group = groups.get(styleId);
        const template = templates.get(styleId);
        result.push({
          id: `brand-${photo.id}`,
          image: photo.image,
          audience: group.audience,
          category: group.style,
          styleId,
          label: `${source.brand} · ${photo.title || group.style}`,
          brand: source.brand,
          sourceUrl: photo.url,
          tags: template?.tags || [group.style],
          features: [],
          imageAnalysis: null,
          phase: 'initial'
        });
      }
    }
    return result;
  }

  function discoveryPhotos(source) {
    return (source.photos || []).slice(DIAGNOSIS_PHOTOS_PER_BRAND,
      DIAGNOSIS_PHOTOS_PER_BRAND + DISCOVERY_PHOTOS_PER_BRAND);
  }

  return { cards, discoveryPhotos, packCatalog, unpackCatalog,
    DIAGNOSIS_PHOTOS_PER_BRAND, DISCOVERY_PHOTOS_PER_BRAND };
});
