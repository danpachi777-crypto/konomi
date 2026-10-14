(function (root, factory) {
  const audience = typeof module === 'object' && module.exports
    ? require('./photo-audience.js') : (root.window || root).KonomiPhotoAudience;
  const feed = factory(audience);
  if (typeof module === 'object' && module.exports) module.exports = feed;
  else (root.window || root).KonomiBrandFeed = feed;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (photoAudience) {
  let catalogPromise;
  function loadCatalog() {
    if (typeof window !== 'undefined' && window.KONOMI_BRAND_CATALOG)
      return Promise.resolve(window.KONOMI_BRAND_CATALOG);
    if (!catalogPromise) catalogPromise = Promise.all([
      fetch('assets/brand-photos.json'), fetch('assets/vintage-brand-photos.json').catch(() => null)
    ]).then(async ([mainResponse, vintageResponse]) => {
      if (!mainResponse.ok) throw new Error('catalog unavailable');
      const [catalog, vintage] = await Promise.all([mainResponse.json(),
        vintageResponse?.ok ? vintageResponse.json() : Promise.resolve({ sources: [] })]);
      const byBrand = new Map((vintage.sources || []).map((source) => [source.brand, source.photos || []]));
      return { ...catalog, sources: (catalog.sources || []).map((source) => ({ ...source,
        photos: [...(source.photos || []), ...(byBrand.get(source.brand) || [])] })) };
    }).catch((error) => {
      catalogPromise = null;
      throw error;
    });
    return catalogPromise;
  }

  function rankPhotos(catalog, styles, audience = 'all', seenImages = []) {
    const scores = new Map(styles.filter((style) => style.score > 0).map((style) => [style.id, style]));
    const alreadyShown = new Set(seenImages);
    const buckets = [];
    for (const source of catalog.sources || []) {
      const matching = (source.styleIds || []).map((id) => scores.get(id)).filter(Boolean)
        .filter((style) => audience === 'all' || style.audience === audience)
        .sort((a, b) => b.score - a.score);
      if (!matching.length || !source.photos?.length) continue;
      const available = [...source.photos.slice(30), ...source.photos.slice(0, 30)];
      const photos = available.filter((photo) => photo.image?.startsWith('https://') &&
        photo.url?.startsWith('https://') && ['product', 'editorial'].includes(photo.sourceType) &&
        !alreadyShown.has(photo.image)).map((photo) => {
          const photoGender = photoAudience.audienceFor(photo, source);
          return { photo, audience: photoGender,
            style: matching.find((style) => style.audience === photoGender) };
        })
        .filter((item) => item.style).slice(0, Math.max(10, source.photos.length - 30));
      if (photos.length) buckets.push({ source, score: photos[0].style.score, photos });
    }
    buckets.sort((a, b) => b.score - a.score || a.source.brand.localeCompare(b.source.brand, 'ja'));
    const ranked = [];
    const seen = new Set();
    const maxPhotos = Math.max(0, ...buckets.map((bucket) => bucket.photos.length));
    for (let index = 0; index < maxPhotos; index++) for (const bucket of buckets) {
      const item = bucket.photos[index];
      if (!item || seen.has(item.photo.image)) continue;
      seen.add(item.photo.image);
      ranked.push({ ...item.photo, audience: item.audience, brand: bucket.source.brand,
        style: item.style.name, styleId: item.style.id,
        sourceUrl: bucket.source.sourceUrl });
    }
    const groups = new Map([...scores.keys()].map((id) => [id, []]));
    for (const photo of ranked) groups.get(photo.styleId)?.push(photo);
    const counts = new Map([...groups.keys()].map((id) => [id, 0]));
    const ordered = [];
    while (ordered.length < ranked.length) {
      const next = [...scores.values()].filter((style) => groups.get(style.id).length)
        .sort((a, b) => (counts.get(a.id) + 1) / a.score -
          (counts.get(b.id) + 1) / b.score || b.score - a.score)[0];
      if (!next) break;
      ordered.push(groups.get(next.id).shift());
      counts.set(next.id, counts.get(next.id) + 1);
    }
    return ordered;
  }

  function render({ app, state, styles, seenImages = [], setRoute, exploreSwitcherHTML = '' }) {
    app.innerHTML = '';
    const screen = document.createElement('section');
    screen.className = 'brand-feed-screen';
    screen.innerHTML = '<div class="page-heading"><h1>LOOKS</h1></div>' + exploreSwitcherHTML;
    screen.querySelectorAll('.explore-switch [data-route]').forEach((button) => {
      button.addEventListener('click', () => setRoute(button.dataset.route));
    });
    const matchedStyles = styles.filter((style) => style.score > 0);
    const count = document.createElement('p');
    count.className = 'brand-feed-count'; count.setAttribute('role', 'status');
    count.textContent = '写真を読み込み中…';
    screen.append(count);
    const grid = document.createElement('div');
    grid.className = 'brand-feed-grid';
    const more = document.createElement('button');
    more.type = 'button'; more.className = 'secondary-button brand-feed-more'; more.textContent = 'さらに見る';
    more.hidden = true;
    screen.append(grid, more);
    app.append(screen);

    if (!matchedStyles.length) {
      count.textContent = '診断で好きな服を選ぶと写真が並びます。';
      return;
    }
    loadCatalog().then((catalog) => {
      if (state.route !== 'saved' || !app.contains(screen)) return;
      const photos = rankPhotos(catalog, styles, state.profile.gender || 'all', seenImages);
      count.textContent = photos.length ? '' : '写真はまだありません。';
      let displayed = 0;
      function append() {
        const fragment = document.createDocumentFragment();
        for (const photo of photos.slice(displayed, displayed + 24)) {
          const card = document.createElement('article');
          card.className = 'brand-photo-card';
          const link = document.createElement('a');
          link.href = photo.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
          const img = document.createElement('img');
          img.src = photo.image; img.alt = `${photo.brand}の${photo.sourceType === 'product' ? '服' : '掲載写真'}`;
          img.loading = 'lazy'; img.decoding = 'async';
          img.addEventListener('error', () => card.remove(), { once: true });
          const body = document.createElement('div'); body.className = 'brand-photo-copy';
          const brand = document.createElement('strong'); brand.textContent = photo.brand;
          const title = document.createElement('span');
          title.textContent = photo.sourceType === 'product' ? photo.title : `${photo.style}に合うブランド写真`;
          body.append(brand, title); link.append(img, body); card.append(link); fragment.append(card);
        }
        grid.append(fragment);
        displayed = Math.min(displayed + 24, photos.length);
        more.hidden = displayed >= photos.length;
      }
      more.addEventListener('click', append);
      append();
    }).catch(() => {
      if (state.route === 'saved' && app.contains(screen)) count.textContent = '写真を読み込めませんでした。再読み込みしてください。';
    });
  }
  return { loadCatalog, rankPhotos, render };
});
