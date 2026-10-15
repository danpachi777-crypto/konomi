(async function () {
  try {
    let catalog;
    try {
      const response = await fetch('assets/brand-diagnosis-catalog.json');
      if (!response.ok) throw new Error(`Photo catalog HTTP ${response.status}`);
      catalog = window.KonomiBrandDiagnosis.unpackCatalog(await response.json());
      if (!catalog.sources.length) throw new Error('Photo catalog version is outdated');
    } catch {
      // An older offline installation may have the full catalog but not the
      // compact one yet. Keep diagnosis usable while the new shell updates.
      const response = await fetch('assets/brand-photos.json');
      if (!response.ok) throw new Error(`Photo catalog HTTP ${response.status}`);
      catalog = await response.json();
    }
    window.KONOMI_BRAND_DIAGNOSIS_CARDS = window.KonomiBrandDiagnosis.cards(
      catalog, window.KONOMI_BRAND_DIRECTORY, window.KONOMI_CARDS);
  } catch (error) {
    console.warn('Brand photos are unavailable.', error);
    window.KONOMI_BRAND_DIAGNOSIS_CARDS = [];
  }
  // Every public photo surface uses the same 94-brand collection. The older
  // card data is read only above for style tags and is never shown as an image.
  window.KONOMI_BRAND_ONLY = true;
  window.KONOMI_CARDS = window.KONOMI_BRAND_DIAGNOSIS_CARDS;
  window.KONOMI_RECOMMENDATIONS = window.KONOMI_CARDS.map((card) => ({
    ...card, id: `r-${card.id}`,
    summary: `${card.brand}の服の写真から、好みをもう少し比べられます。`
  }));
  const script = document.createElement('script');
  script.src = 'app.js?v=61';
  document.body.append(script);
})();
