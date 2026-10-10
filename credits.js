(async function () {
  const grid = document.getElementById('creditsGrid');
  const count = document.getElementById('photoCount');
  const error = document.getElementById('creditsError');
  try {
    const [stockResponse, generatedResponse] = await Promise.all([
      fetch('assets/photo-sources.json', { cache: 'no-cache' }),
      fetch('assets/generated-photo-sources.json', { cache: 'no-cache' })
    ]);
    if (!stockResponse.ok || !generatedResponse.ok) throw new Error('写真台帳を読み込めません');
    const [stock, generated] = await Promise.all([stockResponse.json(), generatedResponse.json()]);
    count.textContent = `${stock.items.length + generated.items.length}枚（実写${stock.items.length}枚・AI生成${generated.items.length}枚）`;
    for (const item of [...stock.items, ...generated.items]) {
      const card = document.createElement('article');
      card.className = 'credit-card';
      const image = document.createElement('img');
      image.src = item.localPath;
      image.alt = item.description;
      image.loading = 'lazy';
      const copy = document.createElement('div');
      copy.className = 'credit-copy';
      const kind = document.createElement('p');
      kind.className = 'credit-kind';
      kind.textContent = `診断・結果候補 · ${item.audience === 'men' ? 'メンズ' : 'ウィメンズ'} · ${item.generated ? 'AI生成' : '実写'}`;
      const description = document.createElement('p');
      description.className = 'credit-description';
      description.textContent = item.description;
      const meta = document.createElement('p');
      meta.className = 'credit-meta';
      meta.textContent = item.generated ? 'OpenAI imagegen · 架空の人物・場所' : `Photo: ${item.creator} · ${item.category}`;
      copy.append(kind, description, meta);
      if (item.generated) {
        const source = document.createElement('p');
        source.className = 'credit-meta';
        source.textContent = `元画像: ${item.sourceSheet} / ${item.tile}番目`;
        copy.append(source);
      } else {
        const links = document.createElement('div');
        links.className = 'credit-links';
        for (const [label, href] of [['原典を見る', item.sourcePage], [item.license, item.licenseUrl]]) {
          const link = document.createElement('a');
          link.textContent = label;
          link.href = href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          links.append(link);
        }
        copy.append(links);
      }
      card.append(image, copy);
      grid.append(card);
    }
  } catch (cause) {
    console.error(cause);
    count.textContent = '読み込み失敗';
    error.hidden = false;
  }
})();
