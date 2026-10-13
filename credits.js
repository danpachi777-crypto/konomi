(async function () {
  const grid = document.getElementById('creditsGrid');
  const count = document.getElementById('photoCount');
  const error = document.getElementById('creditsError');
  try {
    const responses = await Promise.all([
      fetch('assets/brand-photos.json'), fetch('assets/vintage-brand-photos.json')
    ]);
    if (responses.some((response) => !response.ok)) throw new Error('写真の掲載元を読み込めません');
    const catalogs = await Promise.all(responses.map((response) => response.json()));
    const total = catalogs.reduce((sum, catalog) => sum + catalog.sources.reduce((n, source) =>
      n + (source.photos?.length || 0), 0), 0);
    count.textContent = `${total.toLocaleString('ja-JP')}枚 · 94ブランド`;
    for (const [index, catalog] of catalogs.entries()) for (const source of catalog.sources) {
      if (!source.photos?.length) continue;
      const photo = source.photos[0];
      const card = document.createElement('article');
      card.className = 'credit-card';
      const image = document.createElement('img');
      image.src = photo.image;
      image.alt = `${source.brand}の服`;
      image.loading = 'lazy';
      const copy = document.createElement('div');
      copy.className = 'credit-copy';
      const kind = document.createElement('p');
      kind.className = 'credit-kind';
      kind.textContent = index === 0 ? 'ブランド・取扱店' : 'ブランド古着店';
      const title = document.createElement('p');
      title.className = 'credit-description';
      title.textContent = source.brand;
      const meta = document.createElement('p');
      meta.className = 'credit-meta';
      meta.textContent = `${source.photos.length}枚 · ${index === 0 ? '登録済み写真' : photo.seller}`;
      const links = document.createElement('div');
      links.className = 'credit-links';
      const link = document.createElement('a');
      link.href = photo.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '掲載ページを見る ↗';
      links.append(link);
      copy.append(kind, title, meta, links);
      card.append(image, copy);
      grid.append(card);
    }
  } catch (cause) {
    console.error(cause);
    count.textContent = '読み込み失敗';
    error.hidden = false;
  }
})();
