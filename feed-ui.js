(() => {
  const { rankFreshFeed, shopLinksForLook } = window.KonomiFreshFeed;
  const wardrobe = window.KonomiWardrobe;
  let observer = null;
  let viewObserver = null;
  let imageUrls = [];
  const owner = () => window.konomiCloudSync?.getUserId?.() || 'local';
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  function clearResources() {
    observer?.disconnect();
    viewObserver?.disconnect();
    observer = null;
    viewObserver = null;
    imageUrls.forEach(url => URL.revokeObjectURL(url));
    imageUrls = [];
  }
  function validUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
    catch { return null; }
  }
  function feedback(context, card, choice, button) {
    const { state, persist } = context;
    const id = 'r-' + card.id;
    state.recommendationHistory = (state.recommendationHistory || []).filter(entry => entry.id !== id);
    state.recommendationHistory.push({ id, choice, details: {}, createdAt: new Date().toISOString() });
    state.savedRecommendationIds ||= [];
    state.savedRecommendationIds = state.savedRecommendationIds.filter(value => value !== id);
    if (choice === 'like') state.savedRecommendationIds.push(id);
    window.konomiCloudSync?.record(id, choice);
    persist();
    if (choice === 'no') button.closest('article')?.remove();
    else button.textContent = '保存済み';
  }
  async function renderFeed(context) {
    clearResources();
    const { state, app, setRoute, persist } = context;
    app.innerHTML = '';
    const screen = element('section', 'saved-screen fresh-feed-screen');
    const heading = element('div', 'page-heading');
    heading.append(element('p', 'eyebrow', 'FOR YOU'), element('h1', '', 'あなたが好きな服'));
    screen.append(heading);
    const toolbar = element('div', 'fresh-feed-toolbar');
    const closetButton = element('button', 'secondary-button', '手持ち服を登録・見る');
    closetButton.type = 'button';
    closetButton.onclick = () => setRoute('wardrobe');
    const filter = element('select', 'fresh-wardrobe-filter');
    filter.setAttribute('aria-label', '手持ち服に合わせる');
    filter.append(new Option('すべてのおすすめ', ''));
    toolbar.append(closetButton, filter);
    screen.append(toolbar);
    const grid = element('div', 'fresh-feed-grid');
    const status = element('p', 'muted-copy fresh-feed-status', '新しい写真を読み込んでいます…');
    status.setAttribute('role', 'status');
    const more = element('button', 'secondary-button fresh-feed-more', 'さらに表示');
    more.type = 'button';
    const refresh = element('button', 'text-button fresh-feed-refresh', '新着を確認');
    refresh.type = 'button';
    refresh.onclick = () => location.reload();
    const note = element('p', 'shop-note', '写真はコーデの参考です。購入先は似た服を探せる公式サイトで、写真と同じ商品の在庫や価格は示していません。');
    screen.append(grid, status, more, refresh, note);
    app.append(screen);
    let owned = [];
    try { owned = await wardrobe.list(owner()); }
    catch { status.textContent = '手持ち服の保存を利用できません。写真は続けて見られます。'; }
    if (state.route !== 'saved' || !app.contains(screen)) return;
    for (const item of owned) filter.append(new Option(item.name, item.id));
    if (owned.some(item => item.id === state.activeWardrobeId)) filter.value = state.activeWardrobeId;
    else state.activeWardrobeId = '';
    let loading = false;
    const renderedIds = new Set();
    if ('IntersectionObserver' in window) {
      viewObserver = new IntersectionObserver(entries => {
        let changed = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target.dataset.cardId;
          if (!(state.feedSeenIds || []).includes(id)) { state.feedSeenIds ||= []; state.feedSeenIds.push(id); changed = true; }
          viewObserver.unobserve(entry.target);
        }
        if (changed) persist();
      }, { threshold: .25 });
    }
    function appendBatch() {
      if (loading || state.route !== 'saved') return;
      loading = true;
      const selected = owned.find(item => item.id === filter.value);
      const remaining = rankFreshFeed(window.KONOMI_CARDS, {
        audience: state.profile.gender || 'all',
        diagnosisIds: state.diagnosisIds || [],
        history: state.history || [],
        likedIds: state.likedIds || [],
        recommendationHistory: state.recommendationHistory || [],
        seenIds: [...(state.feedSeenIds || []), ...renderedIds, ...(state.recommendationQueue || []).map(id => String(id).replace(/^r-/, ''))],
        wardrobeStyleId: selected?.styleId || ''
      });
      const batch = remaining.slice(0, 12);
      for (const card of batch) {
        const article = element('article', 'fresh-feed-card');
        article.dataset.cardId = card.id;
        renderedIds.add(card.id);
        const img = element('img');
        img.src = card.image;
        img.alt = card.label + 'のコーデ';
        img.loading = 'lazy';
        article.append(img);
        const content = element('div', 'fresh-feed-card-content');
        content.append(element('span', 'fresh-feed-style', card.category));
        const actions = element('div', 'fresh-feed-actions');
        const save = element('button', 'secondary-button', '保存');
        save.type = 'button';
        save.onclick = () => feedback(context, card, 'like', save);
        const skip = element('button', 'text-button', '好みと違う');
        skip.type = 'button';
        skip.onclick = () => feedback(context, card, 'no', skip);
        actions.append(save, skip);
        content.append(actions);
        const links = shopLinksForLook(window.KONOMI_PRODUCTS, card, state.profile.gender || 'all',
          state.profile.budget || 'standard', selected?.category || '', 2);
        if (links.length) {
          const shops = element('div', 'fresh-feed-shops');
          shops.append(element('small', '', selected ? 'この服と合わせて探す' : '似た服を公式で探す'));
          for (const product of links) {
            const url = validUrl(product.url);
            if (!url) continue;
            const anchor = element('a', '', product.brand + ' ↗');
            anchor.href = url;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            shops.append(anchor);
          }
          content.append(shops);
        }
        article.append(content);
        grid.append(article);
        viewObserver?.observe(article);
      }
      if (!viewObserver && batch.length) {
        state.feedSeenIds = [...new Set([...(state.feedSeenIds || []), ...batch.map(card => card.id)])];
        persist();
      }
      const left = Math.max(0, remaining.length - batch.length);
      status.textContent = left ? '下に進むと、新しい写真を表示します。' :
        (selected ? 'この服の系統で未表示の写真は、いまはありません。' : '未表示の写真は、いまはありません。新しい写真が追加されたら表示できます。');
      more.hidden = left === 0;
      refresh.hidden = left > 0;
      loading = false;
    }
    filter.onchange = () => {
      state.activeWardrobeId = filter.value;
      persist();
      viewObserver?.disconnect();
      grid.replaceChildren();
      renderedIds.clear();
      appendBatch();
    };
    more.onclick = appendBatch;
    appendBatch();
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && !more.hidden) appendBatch();
      }, { rootMargin: '700px' });
      observer.observe(more);
    }
  }
  async function renderWardrobe(context) {
    clearResources();
    const { app, state, setRoute } = context;
    app.innerHTML = '';
    const screen = element('section', 'saved-screen wardrobe-screen');
    const heading = element('div', 'page-heading');
    heading.append(element('p', 'eyebrow', 'MY WARDROBE'), element('h1', '', '手持ち服'));
    screen.append(heading);
    const back = element('button', 'text-button', '← おすすめに戻る');
    back.type = 'button';
    back.onclick = () => setRoute('saved');
    screen.append(back);
    const form = element('form', 'wardrobe-form');
    const name = element('input');
    name.name = 'name'; name.placeholder = '例：黒のワイドパンツ'; name.maxLength = 50; name.required = true;
    const photo = element('input');
    photo.type = 'file'; photo.accept = 'image/*'; photo.required = true;
    const category = element('select');
    for (const [value, label] of [['top','トップス'],['bottom','ボトムス'],['outer','アウター'],['shoes','靴']])
      category.append(new Option(label, value));
    const style = element('select');
    const styles = new Map(window.KONOMI_CARDS.filter(card => card.styleId && card.id === 'style-' + card.styleId &&
      (state.profile.gender === 'all' || card.audience === state.profile.gender))
      .map(card => [card.styleId, card.category]));
    for (const [id, label] of styles) style.append(new Option(label, id));
    const submit = element('button', 'primary-button', '登録する');
    submit.type = 'submit';
    for (const [label, input] of [['服の名前', name], ['写真', photo], ['種類', category], ['系統', style]]) {
      const field = element('label', 'wardrobe-field', label);
      field.append(input); form.append(field);
    }
    const formStatus = element('p', 'muted-copy');
    formStatus.setAttribute('role', 'status');
    form.append(submit, formStatus);
    screen.append(form);
    screen.append(element('h2', '', '登録した服'));
    const list = element('div', 'wardrobe-grid');
    screen.append(list);
    app.append(screen);
    async function refresh() {
      imageUrls.forEach(url => URL.revokeObjectURL(url)); imageUrls = [];
      list.replaceChildren();
      try {
        const items = await wardrobe.list(owner());
        if (state.route !== 'wardrobe' || !app.contains(screen)) return;
        if (!items.length) list.append(element('p', 'muted-copy', '服の写真を登録すると、同じ系統の新しいコーデを探せます。'));
        for (const item of items) {
          const card = element('article', 'wardrobe-card');
          const image = element('img');
          const url = URL.createObjectURL(item.image);
          imageUrls.push(url); image.src = url; image.alt = item.name;
          card.append(image, element('b', '', item.name), element('small', '', styles.get(item.styleId) || ''));
          const use = element('button', 'secondary-button', 'この服に合わせる');
          use.type = 'button';
          use.onclick = () => { state.activeWardrobeId = item.id; context.persist(); setRoute('saved'); };
          const remove = element('button', 'text-button', '削除');
          remove.type = 'button';
          remove.onclick = async () => {
            await wardrobe.remove(owner(), item.id);
            if (state.activeWardrobeId === item.id) state.activeWardrobeId = '';
            context.persist(); await refresh();
          };
          card.append(use, remove); list.append(card);
        }
      } catch { list.append(element('p', 'muted-copy', 'この端末では服を保存できませんでした。')); }
    }
    form.onsubmit = async event => {
      event.preventDefault();
      const file = photo.files?.[0];
      if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        formStatus.textContent = '10MB以下の画像を選んでください。'; return;
      }
      submit.disabled = true;
      try {
        const image = await wardrobe.resize(file);
        await wardrobe.add(owner(), { name: name.value.trim(), category: category.value, styleId: style.value, image });
        form.reset();
        formStatus.textContent = '登録しました。';
        await refresh();
      } catch { formStatus.textContent = '保存できませんでした。画像と端末の空き容量を確認してください。'; }
      finally { submit.disabled = false; }
    };
    await refresh();
  }
  window.KonomiFeedUI = { renderFeed, renderWardrobe, clearResources };
})();
