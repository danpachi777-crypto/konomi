const cards = window.KONOMI_CARDS;
const products = window.KONOMI_PRODUCTS;
const shops = window.KONOMI_SHOPS;
const recommendations = window.KONOMI_RECOMMENDATIONS;
const { diagnosisQueue, newFavoriteLooks, styleOf } = window.KonomiDiagnosisPool;
const {
  calculateProfile,
  rankStylePreferences,
  buildPreference,
  analyzeDiagnosis,
  selectDiscoveryRecommendations,
  selectPersonalizedLooks,
  selectAdaptiveRound,
  selectNovelLooks,
  filterCardsByAudience,
  selectProductRecommendations,
  selectShopRecommendations
} = window.KonomiLogic;
const storageKey = "konomi-state-v5";
// Replace the adapter for a future authenticated Supabase store; UI logic stays unchanged.
const authUserId = () => window.konomiCloudSync?.getUserId?.() || null;
const stateStorage = {
  key() {
    if (!window.KONOMI_AUTH_REQUIRED) return storageKey;
    const userId = authUserId();
    return userId ? `${storageKey}:${userId}` : null;
  },
  load() { const key = this.key(); return key ? JSON.parse(localStorage.getItem(key) || '{}') : {}; },
  save(value) { const key = this.key(); if (key) localStorage.setItem(key, JSON.stringify(value)); }
};

const defaultProfile = {
  nickname: "",
  ageRange: "",
  gender: "",
  shoppingArea: "",
  occasion: "休日",
  budget: "standard"
};

const defaultState = {
  route: "home",
  current: 0,
  history: [],
  likedIds: [],
  sessionCompleted: false,
  recommendationCurrent: 0,
  recommendationHistory: [],
  savedRecommendationIds: [],
  feedSeenIds: [],
  activeWardrobeId: '',
  recommendationCompleted: false,
  recommendationQueue: [],
  recommendationReasons: {},
  recommendationRound: 0,
  diagnosisIds: [],
  diagnosisVersion: 2,
  productFeedback: {},
  brandDiscovery: "all",
  occasion: "休日",
  profileCompleted: false,
  profile: { ...defaultProfile }
};

let state = loadState();
let fashionPreference = null;
let toastTimer;
let localShops = { key: "", status: "idle", shops: [], error: "" };

const app = document.getElementById("app");
const nav = document.getElementById("bottomNav");
const aboutDialog = document.getElementById("aboutDialog");
document.body.dataset.demo = new URLSearchParams(location.search).get("demo") || "";

function loadState() {
  const demo = new URLSearchParams(location.search).get("demo");
  const demoProfile = {
    nickname: "Konomi",
    ageRange: "20s",
    gender: "men",
    shoppingArea: "渋谷",
    occasion: "休日",
    budget: "standard"
  };
  if (demo === "profile") return { ...defaultState, route: "profile" };
  if (demo === "swipe") return { ...defaultState, route: "swipe", current: 8, profileCompleted: true, profile: demoProfile };
  if (demo === "result") {
    return {
      ...defaultState,
      route: "result",
      current: cards.length,
      sessionCompleted: true,
      profileCompleted: true,
      profile: demoProfile,
      likedIds: [
        "style-men_clean_casual",
        "style-men_amekaji",
        "style-men_preppy",
        "men-clean-06",
        "men-casual-07",
        "men-amekaji-06",
        "men-cityboy-06",
        "men-clean-01",
        "men-casual-02",
        "men-street-01",
        "men-street-02",
        "men-korean-02",
        "men-mode-03",
        "men-cityboy-01",
        "men-minimal-02"
      ]
    };
  }
  if (demo === "gallery") {
    return {
      ...defaultState,
      route: "saved",
      current: cards.length,
      sessionCompleted: true,
      profileCompleted: true,
      profile: demoProfile,
      likedIds: cards.map((card) => card.id)
    };
  }
  try {
    const stored = stateStorage.load();
    if (stored.profileCompleted && stored.diagnosisVersion !== 2) {
      const profile = { ...defaultProfile, ...(stored.profile || {}) };
      return { ...defaultState, profile, profileCompleted: true, route: "swipe",
        diagnosisIds: diagnosisQueue(cards, profile.gender || "all"),
        brandDiscovery: stored.brandDiscovery || "all", occasion: stored.occasion || profile.occasion };
    }
    return {
      ...defaultState,
      ...stored,
      diagnosisIds: stored.diagnosisIds || (stored.profileCompleted
        ? diagnosisQueue(cards, stored.profile?.gender || "all") : []),
      profile: { ...defaultProfile, ...(stored.profile || {}) }
    };
  } catch {
    return { ...defaultState, profile: { ...defaultProfile } };
  }
}

function persist(options = {}) {
  if (new URLSearchParams(location.search).has("demo")) return;
  if (fashionPreference) {
    fashionPreference.update(state);
    refreshFashionQueue(!!options.keepVisible);
  }
  try { stateStorage.save(state); }
  catch { console.warn('Local state could not be saved; this session remains usable.'); }
}

// Storage boundary: replace this adapter (and the preference adapter) for future Auth/Supabase.

function fashionSelection(candidateList, count, prefix = [], revisit = false) {
  if (!fashionPreference || revisit) return null;
  const history = window.KonomiFashionPreference.historyFromState(state);
  const canonical = window.KonomiFashionPreference.canonicalId;
  const byId = new Map(candidateList.map(item => [canonical(item.id), item]));
  // Reserve the visible/past queue without altering the real swipe history.
  const reserved = new Set(history.map(entry => entry.id));
  for (const id of prefix) {
    reserved.add(canonical(id));
  }
  const selected = [];
  for (let slot = 0; slot < count; slot++) {
    const result = fashionPreference.select(state, [...byId.keys()], { index: history.length + slot, reserved: [...reserved] });
    let item = result.item && byId.get(result.item.id);
    let mode = result.item ? result.mode : 'unembedded-fallback';
    // Show ranked new looks in the result feed without inventing similarity scores.
    if (state.route === 'discover' && (prefix.length + slot) % 3 === 0) {
      const fresh = candidateList.find(entry => entry.generatedPhoto && !reserved.has(canonical(entry.id)));
      if (fresh) { item = fresh; mode = 'unembedded-fallback'; }
    }
    // An incomplete catalog can offer unseen unembedded photos, but never fabricated scores.
    if (!item) {
      const embedded = new Set(fashionPreference.catalog.items.map(entry => entry.id));
      item = candidateList.find(entry => !reserved.has(canonical(entry.id)) && !embedded.has(canonical(entry.id)));
    }
    if (!item) break; // exhausted: shorter round / existing completed UI; no implicit recycling
    const reason = { near: '回答した写真との画像特徴が近い候補です。', middle: '少し違う方向も比較するための候補です。',
      far: 'いつもと異なる方向を試すための候補です。', diversity: '似た写真が続かないよう、画像特徴の異なる候補を選びました。',
      'unembedded-fallback': '未回答の写真です。FashionCLIPの事前分析はまだ完了していません。' }[mode];
    selected.push({ ...item, reason, roundReason: reason,
      fashionSimilarity: mode === 'unembedded-fallback' ? null : result.item?.score ?? null, fashionMode: mode });
    reserved.add(canonical(item.id));
  }
  return selected;
}

function refreshFashionQueue(keepVisible = false) {
  if (!fashionPreference) return;
  if (state.route === 'discover' && !state.recommendationRevisit) {
    const prefix = state.recommendationQueue.slice(0, state.recommendationCurrent + (keepVisible ? 1 : 0));
    const ranked = fashionRankedLooks();
    const next = fashionSelection(ranked, Math.max(0, 6 - prefix.length), prefix);
    state.recommendationQueue = [...prefix, ...next.map(item => item.id)];
  }
}

function fashionRankedLooks() {
  const inputs = recommendationInputs();
  return selectPersonalizedLooks(recommendations, inputs.cards, inputs.likedIds, state.profile.gender || 'all', recommendations.length);
}

async function initializeFashionPreference() {
  if (!window.KonomiFashionPreference || new URLSearchParams(location.search).has('demo') ||
      (window.KONOMI_AUTH_REQUIRED && !authUserId())) return;
  const owner = authUserId();
  try {
    const response = await fetch('/api/fashionclip/catalog', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const catalog = await response.json();
    if (!response.ok || !catalog.available || !catalog.items.length) throw new Error('Local embeddings unavailable');
    if (window.KONOMI_AUTH_REQUIRED && owner !== authUserId()) return;
    fashionPreference = window.KonomiFashionPreference.createController(catalog,
      window.KonomiFashionPreference.createLocalStorageAdapter(localStorage,
        window.KONOMI_AUTH_REQUIRED ? `konomi-fashion-preference-v1:${owner}` : undefined));
    // Preserve a card already visible while asynchronous catalog loading completes.
    refreshFashionQueue(true);
    fashionPreference.update(state);
    stateStorage.save(state);
    window.konomiFashionDebug = () => {
      const snapshot = fashionPreference.snapshot();
      const next = fashionPreference.select(state, filterCardsByAudience(cards, state.profile.gender || 'all').map(item => item.id));
      return { counts: snapshot.counts, vectorGenerated: !!snapshot.vector, dimension: snapshot.vector?.length || 0,
        personalization: snapshot.personalization, nextId: next.item?.id || null, nextMode: next.mode,
        modelVersion: snapshot.modelVersion, storageError: !!snapshot.storageError };
    };
    console.info('[FashionCLIP local]', window.konomiFashionDebug());
    render();
  } catch {
    console.info('[FashionCLIP local] Catalog unavailable; existing UI continues without fabricated embeddings.');
  }
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function diagnosisCards() {
  const audience = filterCardsByAudience(cards, state.profile.gender || "all");
  const byId = new Map(audience.map(card => [card.id, card]));
  if (!state.diagnosisIds?.length) {
    state.diagnosisIds = diagnosisQueue(cards, state.profile.gender || 'all');
    try { stateStorage.save(state); } catch {}
  }
  return state.diagnosisIds.map(id => byId.get(id)).filter(Boolean);
}

function initialDiagnosisCards(audience) {
  const byId = new Map(cards.map(card => [card.id, card]));
  return diagnosisQueue(cards, audience).map(id => byId.get(id)).filter(Boolean);
}

function personalizedLooks() {
  if (fashionPreference) return fashionSelection(fashionRankedLooks(), 20);
  const inputs = recommendationInputs();
  const seen = [...diagnosisCards().map((card) => "r-" + card.id), ...state.recommendationHistory.map((entry) => entry.id)];
  const ranked = selectNovelLooks(recommendations, inputs.cards, inputs.likedIds,
    state.profile.gender || "all", seen, recommendations.length);
  const fresh = ranked.filter(look => look.generatedPhoto);
  const established = ranked.filter(look => !look.generatedPhoto);
  const mixed = [];
  for (let index = 0; mixed.length < 20 && (fresh.length || established.length); index++) {
    const next = index % 3 === 0 ? fresh.shift() || established.shift() : established.shift() || fresh.shift();
    if (next) mixed.push(next);
  }
  return mixed;
}

function recommendationInputs() {
  const inputs = { cards: diagnosisCards().map((card) => ({ ...card,
    neutral: state.history.some((entry) => entry.id === card.id && entry.choice === "skip") })), likedIds: [...state.likedIds] };
  const feedback = [
    ...state.recommendationHistory.map((entry) => ({ entry, candidate: recommendations.find((look) => look.id === entry.id) })),
    ...Object.entries(state.productFeedback || {}).map(([id, choice]) => ({ entry: { id, choice }, candidate: products.find((product) => product.id === id) }))
  ];
  feedback.forEach(({ entry, candidate }) => {
    if (!candidate || entry.choice === "skip") return;
    const id = `feedback-${entry.id}`;
    const previous = inputs.cards.find((card) => card.id === candidate.id.replace(/^r-/, ""));
    if (previous) previous.neutral = true;
    inputs.cards.push({ ...candidate, id, neutral: ["neutral", "skip"].includes(entry.choice), label: candidate.label || candidate.name });
    if (entry.choice === "like") inputs.likedIds.push(id);
    for (const [feature, preference] of Object.entries(entry.details || {})) {
      if (!(candidate.features || []).includes(feature) || !["like", "no"].includes(preference)) continue;
      const detailId = id + ":" + feature;
      inputs.cards.push({ id: detailId, label: candidate.label || candidate.name, tags: [], features: [feature], signalOnly: true });
      if (preference === "like") inputs.likedIds.push(detailId);
    }
  });
  return inputs;
}

function setRoute(route) {
  if (route === "swipe" && !state.profileCompleted) route = "profile";
  if (route === "result" && !state.sessionCompleted) route = state.current ? "swipe" : state.profileCompleted ? "profile" : "home";
  if ((route === "discover" || route === "saved" || route === "wardrobe") && !state.sessionCompleted) route = state.current ? "swipe" : state.profileCompleted ? "profile" : "home";
  if (state.route !== route && ["saved", "wardrobe"].includes(state.route)) window.KonomiFeedUI?.clearResources();
  state.route = route;
  persist();
  render();
}

function resetDiagnosis() {
  state.current = 0;
  state.history = [];
  state.likedIds = [];
  state.sessionCompleted = false;
  state.recommendationCurrent = 0;
  state.recommendationHistory = [];
  state.recommendationCompleted = false;
  state.recommendationQueue = [];
  state.recommendationReasons = {};
  state.recommendationRound = 0;
  state.diagnosisIds = state.profileCompleted
    ? diagnosisQueue(cards, state.profile.gender || "all") : [];
  state.productFeedback = {};
  state.savedRecommendationIds = [];
  state.route = state.profileCompleted ? "swipe" : "profile";
  persist();
  render();
}

function editProfile() {
  state.route = "profile";
  persist();
  render();
}

function render() {
  nav.hidden = ["home", "profile", "swipe"].includes(state.route);
  document.body.dataset.route = state.route;
  [...nav.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("is-active", button.dataset.route === state.route);
  });

  if (state.route === "home") renderHome();
  if (state.route === "profile") renderProfile();
  if (state.route === "swipe") renderSwipe();
  if (state.route === "result") renderResult();
  if (state.route === "discover") renderDiscover();
  if (state.route === "saved") renderSaved();
  if (state.route === "wardrobe") renderWardrobe();
  if (state.route === "analysis") renderTasteAnalysis();
}

function renderHome() {
  const hasProgress = state.current > 0 && !state.sessionCompleted;
  const hasResult = state.sessionCompleted;
  const collageCards = ["gen-men-01-01", "gen-women-01-02", "gen-women-05-01"]
    .map(id => cards.find(card => card.id === id)).filter(Boolean);
  app.innerHTML = `
    <section class="home-screen">
      <div class="home-copy">
        <p class="home-status"><span aria-hidden="true"></span> YOUR STYLE, DISCOVERED.</p>
        <h1>「好き」が、<br>あなたの<br><em>スタイルになる。</em></h1>
        <p class="lead">Tシャツ、シャツ、ワイドパンツ。街で着たい服から、直感で選ぶだけ。<br>あなたらしい着こなしと、次のブランドに出会おう。</p>
        <div class="home-actions">
          <button class="primary-button" type="button" id="startButton">
            ${hasProgress ? "診断を続ける" : hasResult ? "もう一度診断する" : "自分の好みを見つける"}
            <span aria-hidden="true">↗</span>
          </button>
          ${hasResult ? '<button class="secondary-button" type="button" data-route="result">前回の結果を見る</button>' : ""}
          <button class="text-button" type="button" data-route="analysis">今の好みを振り返る</button>
        </div>
        <p class="home-footnote">メンズ14系統・ウィメンズ12系統から、好みを見つける。</p>
        <div class="home-tastes" aria-label="診断できるスタイル"><span>MINIMAL</span><span>STREET</span><span>CASUAL</span><span>+ MORE</span></div>
      </div>
      <div class="home-collage" aria-hidden="true">
        ${collageCards.map((card, index) => `<img class="collage-${index + 1}" src="${card.image}" alt="" loading="eager">`).join("")}
        <span class="collage-label label-one">01 / THE EVERYDAY LOOK</span>
        <span class="collage-label label-two">A LITTLE MORE YOU.</span>
        <span class="floating-like"><b>♡</b> GOOD FINDS</span>
      </div>
      <div class="home-steps">
        <article><span>01</span><div><h2>直感で、選ぶ。</h2><p>好きも、ちょっと違うも。あなたの感覚がヒント。</p></div><b aria-hidden="true">↗</b></article>
        <article><span>02</span><div><h2>好みが、見えてくる。</h2><p>形・色・素材。選んだ服から共通点を探します。</p></div><b aria-hidden="true">↗</b></article>
        <article><span>03</span><div><h2>次の一着に、出会う。</h2><p>コーデやブランド、服屋へ。発見を買い物につなげよう。</p></div><b aria-hidden="true">↗</b></article>
      </div>
    </section>
  `;

  document.getElementById("startButton").addEventListener("click", () => {
    if (hasProgress) setRoute("swipe");
    else if (hasResult) resetDiagnosis();
    else setRoute("profile");
  });
  bindRouteButtons();
}

function selected(value, expected) {
  return value === expected ? "selected" : "";
}

function checked(value, expected) {
  return value === expected ? "checked" : "";
}

function renderProfile() {
  const profile = state.profile;
  app.innerHTML = `
    <section class="profile-screen">
      <div class="profile-intro">
        <p class="eyebrow">YOUR PROFILE</p>
        <span class="step-number">01</span>
        <h1>あなたに合う服を<br>選ぶ準備。</h1>
        <p>年代や性別、よく服を着るシーンと買い物エリアを教えてください。回答はこの端末にだけ保存され、あとから変更できます。</p>
        <div class="profile-preview" aria-hidden="true">
          ${["gen-women-02-01", "gen-men-05-02", "gen-women-07-03"].map(id => cards.find(card => card.id === id))
            .filter(Boolean).map((card, index) => `<img style="--i:${index}" src="${card.image}" alt="">`).join("")}
        </div>
      </div>
      <form class="profile-form" id="profileForm">
        <div class="field-group">
          <label for="nickname">ニックネーム <span>必須</span></label>
          <input id="nickname" name="nickname" type="text" maxlength="20" autocomplete="off" inputmode="text" required placeholder="例：このみ" value="${escapeHTML(profile.nickname)}">
        </div>

        <div class="field-group">
          <label for="ageRange">年代 <span>必須</span></label>
          <select id="ageRange" name="ageRange" required>
            <option value="">選択してください</option>
            <option value="teens" ${selected(profile.ageRange, "teens")}>10代</option>
            <option value="20s" ${selected(profile.ageRange, "20s")}>20代</option>
            <option value="30s" ${selected(profile.ageRange, "30s")}>30代</option>
            <option value="40s" ${selected(profile.ageRange, "40s")}>40代</option>
            <option value="50s" ${selected(profile.ageRange, "50s")}>50代</option>
            <option value="60plus" ${selected(profile.ageRange, "60plus")}>60代以上</option>
          </select>
        </div>

        <fieldset class="field-group">
          <legend>診断する服 <span>診断写真と結果の両方に反映します</span></legend>
          <div class="choice-grid gender-grid">
            <label><input type="radio" name="gender" value="women" required ${checked(profile.gender, "women")}><span><b>ウィメンズ</b><small>診断・結果・商品を統一</small></span></label>
            <label><input type="radio" name="gender" value="men" required ${checked(profile.gender, "men")}><span><b>メンズ</b><small>診断・結果・商品を統一</small></span></label>
            <label><input type="radio" name="gender" value="all" required ${checked(profile.gender, "all")}><span><b>両方見る</b><small>すべての服を比較</small></span></label>
          </div>
          <p class="selection-note" id="selectionNote">選んだ方向の全身コーデだけを診断と結果に表示します。</p>
        </fieldset>

        <div class="field-group">
          <label for="shoppingArea">よく買い物するエリア <span>店舗・Googleマップの表示に使用します</span></label>
          <input id="shoppingArea" name="shoppingArea" type="text" maxlength="40" inputmode="text" required placeholder="例：渋谷、新宿、大阪市" value="${escapeHTML(profile.shoppingArea)}">
        </div>

        <div class="profile-form-row">
          <div class="field-group">
            <label for="occasion">よく着るシーン</label>
            <select id="occasion" name="occasion">
              ${["休日", "通勤・通学", "デート"].map((item) => `<option value="${item}" ${selected(profile.occasion, item)}>${item}</option>`).join("")}
            </select>
          </div>
          <div class="field-group">
            <label for="budget">1着の予算感</label>
            <select id="budget" name="budget">
              <option value="value" ${selected(profile.budget, "value")}>〜5,000円</option>
              <option value="standard" ${selected(profile.budget, "standard")}>5,000〜15,000円</option>
              <option value="premium" ${selected(profile.budget, "premium")}>15,000円〜</option>
            </select>
          </div>
        </div>

        <button class="primary-button profile-submit" type="submit">この設定で服を選ぶ <span aria-hidden="true">→</span></button>
      </form>
    </section>
  `;

  const updateSelectionNote = () => {
    const gender = document.querySelector('input[name="gender"]:checked')?.value;
    const note = document.getElementById("selectionNote");
    if (!gender) return;
    const count = initialDiagnosisCards(gender).length;
    const label = gender === "women" ? "ウィメンズ" : gender === "men" ? "メンズ" : "両方";
    note.textContent = `${label}の初回診断${count}枚。回答後に別の候補を最大6枚ずつ追加診断し、結果を更新します。写真は現在全体で${cards.length}枚です。`;
  };
  document.querySelectorAll('input[name="gender"]').forEach((input) => input.addEventListener("change", updateSelectionNote));
  updateSelectionNote();

  document.getElementById("profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.profile = {
      nickname: String(form.get("nickname") || "").trim(),
      ageRange: String(form.get("ageRange") || ""),
      gender: String(form.get("gender") || ""),
      shoppingArea: String(form.get("shoppingArea") || "").trim(),
      occasion: String(form.get("occasion") || "休日"),
      budget: String(form.get("budget") || "standard")
    };
    state.profileCompleted = true;
    state.current = 0;
    state.history = [];
    state.likedIds = [];
    state.sessionCompleted = false;
    state.recommendationCurrent = 0;
    state.recommendationHistory = [];
    state.recommendationCompleted = false;
    state.recommendationQueue = [];
    state.recommendationRound = 0;
    state.diagnosisIds = diagnosisQueue(cards, state.profile.gender);
    state.productFeedback = {};
    state.occasion = state.profile.occasion;
    state.route = "swipe";
    persist();
    render();
  });
}

function renderSwipe() {
  const activeCards = diagnosisCards();
  if (!state.profileCompleted) {
    setRoute("profile");
    return;
  }
  if (state.current >= activeCards.length) {
    state.sessionCompleted = true;
    state.route = "result";
    persist();
    renderResult();
    return;
  }

  const card = activeCards[state.current];
  const nextCard = activeCards[state.current + 1];
  const progress = Math.round((state.current / activeCards.length) * 100);

  app.innerHTML = `
    <section class="swipe-screen diagnosis-screen">
      <button class="restart-diagnosis" type="button" id="restartDiagnosis">最初から</button>
      <div class="swipe-heading">
        <div>
          <p class="eyebrow">QUICK TASTE · ${escapeHTML(state.profile.nickname)}</p>
          <h1>直感で選んで</h1>
        </div>
        <span class="counter"><b>${String(state.current + 1).padStart(2, "0")}</b> / ${activeCards.length}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="診断の進捗" aria-valuenow="${state.current}" aria-valuemin="0" aria-valuemax="${activeCards.length}">
        <span style="width:${progress}%"></span>
      </div>
      <div class="card-stage" id="cardStage">
        ${nextCard ? `<article class="fashion-card card-behind"><img src="${nextCard.image}" alt="" draggable="false"></article>` : ""}
        <article class="fashion-card card-active" id="activeCard" aria-label="${card.label}">
          <img src="${card.image}" alt="${card.label}のコーディネート" draggable="false">
          <div class="card-shade"></div>
          <div class="choice-stamp stamp-no" aria-hidden="true">NOT<br>FOR ME</div>
          <div class="choice-stamp stamp-like" aria-hidden="true">LIKE<br>THIS</div>
          <div class="card-caption">
            <span>LOOK ${String(state.current + 1).padStart(2, "0")}</span>
            <h2>${escapeHTML(card.category)}</h2>
            <p>${escapeHTML(card.label)}</p>
          </div>
        </article>
      </div>
      ${styleScoreHTML(card.id)}
      <p class="swipe-hint"><span>← 興味なし</span><span>好き →</span></p>
      <div class="swipe-actions">
        <button class="undo-button" type="button" id="undoButton" aria-label="一つ戻る" ${state.history.length ? "" : "disabled"}>↶</button>
        <button class="choice-button no-button" type="button" data-choice="no" aria-label="興味なし">×</button>
        <button class="choice-button like-button" type="button" data-choice="like" aria-label="好き">♡</button>
        <button class="text-button" type="button" data-choice="skip">保留</button>
      </div>
    </section>
  `;

  app.querySelectorAll(".diagnosis-screen .swipe-heading > div, .diagnosis-screen .card-shade, .diagnosis-screen .card-caption, .diagnosis-screen .style-score, .diagnosis-screen .swipe-hint")
    .forEach((element) => element.remove());
  app.querySelector('[data-choice="no"]').textContent = "Dislike";
  app.querySelector('[data-choice="like"]').textContent = "Like";
  setupSwipeGesture();
  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => animateChoice(button.dataset.choice));
  });
  document.getElementById("undoButton").addEventListener("click", undoChoice);
  document.getElementById("restartDiagnosis").addEventListener("click", resetDiagnosis);
}

function setupSwipeGesture() {
  const card = document.getElementById("activeCard");
  let startX = 0;
  let deltaX = 0;
  let dragging = false;

  card.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    card.setPointerCapture(event.pointerId);
    card.classList.add("is-dragging");
  });

  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    card.style.transform = `translateX(${deltaX}px) rotate(${deltaX / 22}deg)`;
    card.style.setProperty("--drag", Math.min(1, Math.abs(deltaX) / 110));
    card.dataset.direction = deltaX > 0 ? "right" : "left";
  });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("is-dragging");
    if (Math.abs(deltaX) > 95) animateChoice(deltaX > 0 ? "like" : "no");
    else {
      card.style.transform = "";
      card.style.removeProperty("--drag");
      delete card.dataset.direction;
    }
  };

  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", finish);
}

function animateChoice(choice) {
  const card = document.getElementById("activeCard");
  if (!card || card.classList.contains("is-leaving")) return;
  card.classList.add("is-leaving", choice === "like" ? "leave-right" : "leave-left");
  window.setTimeout(() => recordChoice(choice), 260);
}

function recordChoice(choice) {
  const card = diagnosisCards()[state.current];
  if (!card || !["like", "no", "skip"].includes(choice)) return;
  state.history.push({ id: card.id, choice, createdAt: new Date().toISOString() });
  window.konomiCloudSync?.record(card.id, choice);
  if (choice === "like" && !state.likedIds.includes(card.id)) state.likedIds.push(card.id);
  state.current += 1;
  persist();
  renderSwipe();
}

function undoChoice() {
  const last = state.history.pop();
  if (!last) return;
  window.konomiCloudSync?.record(last.id, null);
  state.current = Math.max(0, state.current - 1);
  if (last.choice === "like") state.likedIds = state.likedIds.filter((id) => id !== last.id);
  state.sessionCompleted = false;
  persist({ keepVisible: true });
  renderSwipe();
  showToast("ひとつ前に戻りました");
}

function diagnosisAnalysisHTML(inputs) {
  const roundIds = state.recommendationRound
    ? (state.recommendationQueue || []).flatMap((id) => inputs.cards.filter((card) => card.id === `feedback-${id}` || card.id.startsWith(`feedback-${id}:`)).map((card) => card.id))
    : diagnosisCards().map((card) => card.id);
  const analysis = analyzeDiagnosis(inputs.cards, inputs.likedIds, roundIds);
  return `<section class="diagnosis-analysis" aria-label="今回の診断の分析">
    <p class="eyebrow">AFTER YOUR DIAGNOSIS</p><h2>今回の回答から、見えてきたこと。</h2>
    <p>${analysis.roundAnswered ? `今回の判断できた${analysis.roundAnswered}着のうち、${analysis.roundLiked}着が好き。` : "まだ今回の回答がありません。"}${analysis.latestSignals.length ? `今回の好きには「${escapeHTML(analysis.latestSignals.join("・"))}」がありました。` : "好みがまだ定まらないので、気になる部分だけ選んでも大丈夫です。"}</p>
    <div class="analysis-insights">${analysis.signals.slice(0, 3).map((signal) => `<article><h3>${escapeHTML(signal.feature)}</h3><p>好きと答えた「${signal.evidence.map((item) => escapeHTML(item.label)).join("」「")}」に見られる共通点。</p></article>`).join("")}</div>
    <p class="shop-note">${analysis.cautious ? "まだ回答の根拠が少ないので、好みは仮説です。" : "ここまでの回答を合わせた、今の好みの仮説です。"}次は好きな形や色を残して、素材や丈を一つ変えて見比べてみましょう。</p>
  </section>`;
}

function currentTasteAnalysis() {
  return window.KonomiFashionPreference?.analyzeHistory(state, cards) || null;
}

function styleScoreHTML(itemId) {
  const api = window.KonomiFashionPreference;
  const snapshot = fashionPreference?.snapshot();
  const score = api?.styleScore(fashionPreference?.catalog, snapshot, itemId) ?? null;
  const message = snapshot?.vector && score === null ? 'このコーデの特徴データは準備中です' : '服を選ぶと、あなたの好みが見えてきます';
  return `<div class="style-score" data-style-score-item="${escapeHTML(itemId)}" aria-label="STYLE SCORE">
    <div class="style-score-heading"><span>STYLE SCORE</span>${score === null ? '' : `<strong data-style-score="${score}">${score}<small>/100</small></strong>`}</div>
    <p>${score === null ? message : 'あなたの選択をもとにした、好みとの近さ'}</p>
  </div>`;
}

function tasteAnalysisHTML() {
  const analysis = currentTasteAnalysis();
  if (!analysis) return '';
  const countHTML = entries => entries.map(item => `<li><span>${escapeHTML(item.label)}</span><b>${item.count}件</b></li>`).join('');
  return `<section class="diagnosis-analysis taste-history" id="tasteAnalysis" aria-label="好みの分析">
    <p class="eyebrow">YOUR CHOICES</p><h2>好みの分析</h2>
    ${new URLSearchParams(location.search).has('demo') ? '<p class="shop-note">デモのサンプル回答です。実際の履歴やSTYLE SCOREではありません。</p>' : ''}
    <p>${!analysis.total ? 'まだ回答はありません。服を選ぶと、あなたの好みが見えてきます。' :
      analysis.evaluated < 10 ? `現在は${analysis.evaluated}件の評価です。少ない回答から見える、仮の傾向としてご覧ください。` : 'これまでの選択から、今の好みを振り返れます。'}</p>
    <dl class="taste-counts" aria-label="最新の回答件数">
      <div><dt>like</dt><dd>${analysis.counts.like}<small>好き</small></dd></div>
      <div><dt>dislike</dt><dd>${analysis.counts.dislike}<small>好みと違う</small></dd></div>
      <div><dt>skip</dt><dd>${analysis.counts.skip}<small>評価なし</small></dd></div>
    </dl>
    <p class="shop-note">同じ写真は最新の回答を1件として数えます。skipは好みの計算に含めません。</p>
    <p class="shop-note">過去に評価した写真をskipで見送った場合も、以前の好みの評価は消しません。</p>
    ${analysis.categories.length || analysis.tags.length ? `<div class="taste-trends">
      ${analysis.categories.length ? `<div><h3>好きと答えた服のカテゴリ</h3><ul>${countHTML(analysis.categories)}</ul></div>` : ''}
      ${analysis.tags.length ? `<div><h3>写真に付けられた特徴タグ</h3><ul>${countHTML(analysis.tags.slice(0, 8))}</ul></div>` : ''}
    </div><p class="shop-note">いいねした写真に付いている分類・タグの件数です。あなたが各系統に属する割合ではありません。</p>` : ''}
    <h3>いいねしたコーデ</h3>
    ${analysis.liked.length ? `<div class="taste-liked-grid">${analysis.liked.map(item => `<article class="taste-liked-card">
      <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.label)}のコーディネート" loading="lazy">
      <div><h4>${escapeHTML(item.label)}</h4>${item.category ? `<p>${escapeHTML(item.category)}</p>` : ''}${styleScoreHTML(item.id)}</div>
    </article>`).join('')}</div>` : '<p class="muted-copy">まだいいねしたコーデはありません。気になる服に出会ったら、右にスワイプしてみてください。</p>'}
    ${analysis.missingLiked ? `<p class="shop-note">${analysis.missingLiked}件のいいねは、対応する写真が現在のカタログにありません。</p>` : ''}
    <details class="style-score-explanation"><summary>STYLE SCOREについて</summary>
      <p>あなたの選択をもとにした、好みとの近さです。ファッションセンスの優劣や、好きになる確率ではありません。</p>
      <p>保存済みFashionCLIP画像特徴と好みベクトルのcosine similarityを、round(50 × (similarity + 1))で0〜100へ変換しています。背景・人物の影響も含む目安です。</p>
    </details>
    <button class="secondary-button" type="button" data-route="${state.sessionCompleted ? 'discover' : state.profileCompleted ? 'swipe' : 'profile'}">服を選んで、好みを更新する</button>
  </section>`;
}

function renderTasteAnalysis() {
  app.innerHTML = `<section class="result-screen taste-analysis-screen">
    <div class="page-heading"><p class="eyebrow">MY TASTE</p><h1>選んだ服から、好みを知る。</h1></div>
    ${tasteAnalysisHTML()}
    <button class="text-button" type="button" data-route="${state.sessionCompleted ? 'result' : 'home'}">${state.sessionCompleted ? '診断結果へ戻る' : 'ホームへ戻る'}</button>
  </section>`;
  bindRouteButtons();
}

function renderResult() {
  const historyAnalysis = currentTasteAnalysis();
  const activeCards = diagnosisCards();
  const inputs = recommendationInputs();
  const tasteProfile = calculateProfile(inputs.cards, inputs.likedIds);
  const preferredStyles = rankStylePreferences(inputs.cards, inputs.likedIds, state.profile.gender);
  const preference = buildPreference(inputs.cards, inputs.likedIds);
  const personalSummary = preferredStyles.length ? preferredStyles[0].name : "好みをもう少し探そう";
  const personalDescription = preferredStyles.length
    ? `好きと答えた写真から、${preferredStyles.slice(0, 2).map((style) => style.name).join("・")}が好みに近いと分かりました。この系統の服を優先して提案します。`
    : "好きと答えた服がまだ少ないため、提案は比較用の候補です。診断をやり直して気になる服を選んでみてください。";
  const analyzedLooks = personalizedLooks();
  const productPool = products.filter((product) => state.productFeedback?.[product.id] !== "no" &&
    (state.brandDiscovery !== "specialist" || product.specialist));
  const productRecommendations = selectDiscoveryRecommendations(productPool, inputs.cards, inputs.likedIds, state.profile.gender, state.profile.budget, state.productFeedback, 6);
  const shopKey = JSON.stringify([state.profile.shoppingArea, state.profile.gender, state.likedIds]);
  if (localShops.key !== shopKey) localShops = { key: shopKey, status: "idle", shops: [], error: "" };
  const shopPool = localShops.shops.length ? [...shops.filter((shop) => shop.areas), ...localShops.shops] : shops;
  const shopRecommendations = selectShopRecommendations(shopPool, inputs.cards, inputs.likedIds, 6, state.profile.shoppingArea, state.profile.gender);
  const tags = historyAnalysis ? historyAnalysis.tags.map(item => ({ tag: item.label, count: item.count })) : tasteProfile.topTags;
  const categoryCounts = preferredStyles.map((style) => ({ label: style.name, count: style.likes }));
  const styleFeed = preferredStyles.slice(0, 3).map((style) => ({ ...style,
    card: cards.find((card) => card.id === `style-${style.id}`) }));

  app.innerHTML = `
    <section class="result-screen">
      <div class="result-quick-actions"><button type="button" id="quickRestartButton">最初から診断する</button></div>
      <div class="result-hero">
        <div class="result-copy">
          <p class="eyebrow">${escapeHTML(state.profile.nickname)}'S STYLE DNA</p>
          <p class="result-kicker">${escapeHTML(state.profile.nickname)}さんが選んだ服の共通点</p>
          <h1 class="personal-title">${personalSummary.split(" × ").map((part) => `<span>${escapeHTML(part)}</span>`).join(' <span class="title-cross">×</span> ')}</h1>
          <p>${personalDescription}</p>
          ${preference.photoColorSummary.length ? `<p class="shop-note">選んだ写真に多い色：${escapeHTML(preference.photoColorSummary.join("・"))}。写真中央の色を比較して提案の参考にしています。背景や肌の色も含む目安です。</p>` : ""}
          <div class="tag-row">${tags.slice(0, 3).map((item) => `<span># ${item.tag}</span>`).join("")}</div>
          <div class="style-type-row">
            ${categoryCounts.slice(0, 3).map((item, index) => `<div><span>0${index + 1}</span><b>${escapeHTML(item.label)}</b><em>${item.count}件のlike</em></div>`).join("")}
          </div>
        </div>
        <div class="result-photo-stack" aria-label="診断から分析したおすすめコーデ">
          ${analyzedLooks.slice(0, 3).map((look, index) => `<img style="--i:${index}" src="${look.image}" alt="${look.label}">`).join("")}
          <span>${analyzedLooks.length ? "好きな服に近い、未回答の服" : "新しい写真候補が必要です"}</span>
        </div>
      </div>

      ${diagnosisAnalysisHTML(inputs)}
      ${tasteAnalysisHTML()}
      ${styleFeed.length ? `<section class="style-feed"><div class="section-title"><div><p class="eyebrow">YOUR STYLE</p><h2>あなたが好きそうな系統</h2></div></div><div class="style-feed-grid">${styleFeed.map((style) => `<article class="style-feed-card"><img src="${style.card.image}" alt="${escapeHTML(style.card.label)}" loading="lazy"><div><b>${escapeHTML(style.name)}</b><small>好き ${style.likes}件</small></div></article>`).join("")}</div></section>` : ""}
      <section class="discover-invite">
        <div>
          <p class="eyebrow">CATEGORY MATCHED LOOKS</p>
          <h2>好きな系統の写真を、次々に見る。</h2>
          <p>まだ見ていない写真を順に表示します。保存した服は次のおすすめに反映されます。</p>
        </div>
        <button class="primary-button" type="button" data-route="saved">新しい写真を見る <span>→</span></button>
      </section>

      <section class="novel-looks-section">
        <div class="section-title"><div><p class="eyebrow">BECAUSE YOU LIKED</p><h2>こういう服は、どうですか？</h2></div></div>
        <p class="shop-note">未回答の写真から、好みに近い服と新しい方向を比較できます。STYLE SCOREは保存済み画像特徴との近さで、センスや確率を示す点数ではありません。</p>
        <div class="novel-looks-grid">
          ${analyzedLooks.slice(0, 6).map((look) => {
            const evidence = look.evidenceIds.map((id) => inputs.cards.find((card) => card.id === id)).filter(Boolean);
            return `<article class="novel-look-card">
              <img class="novel-look-photo" src="${look.image}" alt="${escapeHTML(look.label)}" loading="lazy">
              <div class="novel-look-copy"><h3>${escapeHTML(look.label)}</h3><p>${escapeHTML(look.reason)}</p>
                ${styleScoreHTML(look.id)}
                <div class="liked-evidence">${evidence.map((card) => `<span>${card.image ? `<img src="${card.image}" alt="" loading="lazy">` : ""}<small>好きと答えた：${escapeHTML(card.label || card.name || card.features.join("・"))}</small></span>`).join("")}</div>
                <div class="recommendation-feedback"><button type="button" data-look-id="${look.id}" data-look-choice="like">着てみたい</button><button type="button" data-look-id="${look.id}" data-look-choice="no">好みと違う</button></div>
              </div></article>`;
          }).join("")}
        </div>
        ${!analyzedLooks.length ? `<p class="shop-note">${preference.likedCards.length ? "好みとの共通点がある未回答の写真候補がなくなりました。同じ服を新しい提案として出すことはしません。下の公式ブランド一覧から別の服を探せますが、写真候補の拡充が必要です。" : "まだ好みの根拠がないため、おすすめを決めつけません。初回診断で好きな服を選ぶか、服の好きな部分を教えてください。"}</p>` : ""}
      </section>

      <div class="profile-summary">
        <span>${ageLabel(state.profile.ageRange)}</span>
        <span>${genderLabel(state.profile.gender)}</span>
        <span>${escapeHTML(state.profile.occasion)}</span>
        <span>${escapeHTML(state.profile.shoppingArea)}</span>
        <button type="button" id="editProfileButton">設定を変更</button>
      </div>

      <div class="result-grid">
        <section class="result-panel taste-panel">
          <div class="section-title">
            <div><p class="eyebrow">TASTE BALANCE</p><h2>選んだ雰囲気</h2></div>
            <span>初回 ${activeCards.length}枚 · 追加 ${state.recommendationHistory.length}枚</span>
          </div>
          <div class="meter-list">
            ${tags.slice(0, 4).map((item) => `
              <div class="meter-item">
                <div><span>${escapeHTML(item.tag)}</span><b>${item.count}件のlike</b></div>
              </div>`).join("")}
            ${!tags.length ? '<p class="muted-copy">いいねした服の特徴は、選択が増えるとここに表示されます。</p>' : ''}
          </div>
        </section>

        <section class="result-panel recipe-panel">
          <div class="section-title">
            <div><p class="eyebrow">YOUR NEXT CHOICE</p><h2>次に見比べたい服</h2></div>
          </div>
          <p class="shop-note">診断とおすすめへの回答から選んでいます。組み合わせが合うかは、実物の色・サイズも見比べてください。</p>
          <ol class="recipe-list">
            ${productRecommendations.slice(0, 4).map((item, index) => `<li><span>0${index + 1}</span><b>${escapeHTML(item.name)}<small class="recipe-detail">${escapeHTML(item.experiment)}</small></b></li>`).join("")}
          </ol>
          <button class="dark-button" type="button" data-route="discover">服を見て好みを絞る <span>→</span></button>
        </section>
      </div>

      <section class="shop-section">
        <div class="shop-heading">
          <div>
            <p class="eyebrow">REAL ITEMS FOR YOU</p>
            <h2>次に興味が広がりそうな服。</h2>
            <p>好きだった特徴を手がかりに、専門ブランドを優先して選びました。何を見るとよさそうか、どこを変えると新しい発見があるかまで提案します。</p>
          </div>
          <span class="verified-badge">公式情報へのリンク</span>
        </div>
        <div class="brand-discovery-control"><label for="brandDiscovery">ブランドの探し方</label><select id="brandDiscovery"><option value="all" ${selected(state.brandDiscovery, "all")}>すべてのブランドから</option><option value="specialist" ${selected(state.brandDiscovery, "specialist")}>今回調べた専門ブランドを中心に</option></select></div>
        <div class="product-grid">
          ${!productRecommendations.length ? '<p class="shop-note">今の回答と条件から、根拠を持っておすすめできる候補がありません。追加診断で気になる服や部分を教えるか、ブランドの探し方を広げてみてください。</p>' : ""}
          ${productRecommendations.map((product, index) => `
            <article class="product-card">
              <div class="product-index">${String(index + 1).padStart(2, "0")}</div>
              <div class="product-meta"><span>${product.brand}</span><span>${product.category}</span></div>
              <h3>${product.name}</h3>
              <p>${escapeHTML(product.discoveryReason)}</p>
              <p class="discovery-experiment">${escapeHTML(product.experiment)}</p>
              ${product.sourceSummary ? `<small class="brand-source">公式で確認：${escapeHTML(product.sourceSummary)}<br>確認日 ${product.checkedAt} · 相性は回答からの推定</small>` : ""}
              <small class="recommendation-evidence">${product.evidenceIds.map((id) => inputs.cards.find((card) => card.id === id)?.label).filter(Boolean).map(escapeHTML).join(" / ")}</small>
              ${product.budgetMismatch ? '<small class="budget-note">目安の価格帯は設定予算と異なります。古着・セールも比較してください。</small>' : ""}
              <div class="product-tags">${(product.matches.length ? product.matches : product.tags.slice(0, 2)).map((tag) => `<span>#${tag}</span>`).join("")}</div>
              <a href="${product.url}" target="_blank" rel="noopener noreferrer">公式で取り扱いを見る <span aria-hidden="true">↗</span></a>
              <div class="recommendation-feedback"><button type="button" data-product-id="${product.id}" data-product-choice="like" aria-pressed="${state.productFeedback?.[product.id] === "like"}">気になる</button><button type="button" data-product-id="${product.id}" data-product-choice="no">好みと違う</button></div>
            </article>`).join("")}
        </div>
        <p class="shop-note">ブランド／取り扱い一覧への案内です。写真の服と同じ商品であることや、在庫・価格を保証するものではありません。</p>
      </section>

      <section class="store-section">
        <div class="store-heading">
          <div>
            <p class="eyebrow">SHOPS NEAR YOU</p>
            <h2>${escapeHTML(state.profile.shoppingArea)}で、服を探す。</h2>
            <p>公式の取り扱いを参考にした店舗・ブランド候補です。地域の服屋を口コミから調べることもできます。</p>
            <button class="secondary-button" type="button" id="searchLocalShops" ${localShops.status === "loading" ? "disabled" : ""}>${localShops.status === "loading" ? "近くの服屋を調べています…" : "近くの服屋を口コミから調べる"}</button>
            <p class="shop-note" role="status">${localShopStatusText()}</p>
          </div>
        </div>
        <div class="store-layout">
          <div class="store-list">
            ${shopRecommendations.map((shop, index) => `
              <article class="store-card ${index === 0 ? "is-selected" : ""}" data-store-card="${shop.id}">
                <button type="button" data-map-shop="${shop.id}">
                  <span class="store-number">${String(index + 1).padStart(2, "0")}</span>
                  <span class="store-copy"><small>${escapeHTML(shop.type)}</small><b>${escapeHTML(shop.name)}</b><em>${escapeHTML(shop.description)}</em></span>
                  <span aria-hidden="true">→</span>
                </button>
                <p class="store-evidence">${escapeHTML(shop.reason)}<br>${escapeHTML(shop.sourceLabel)}${shop.reviewStatus === "fetched" ? ` · Google Maps ${shop.rating ?? "評価なし"} / ${shop.reviewCount ?? 0}件（分析は取得できた${shop.reviews.length}件）` : " · 口コミ未取得"}</p>
                ${shop.reviews?.length ? `<details class="store-reviews"><summary>判断に使える口コミの原文・出典</summary>${shop.reviews.map((review) => `<blockquote><p>${escapeHTML(review.text)}</p><a href="${safeExternalUrl(review.authorUri)}" target="_blank" rel="noopener noreferrer">${escapeHTML(review.author)}</a> · <a href="${safeExternalUrl(review.url)}" target="_blank" rel="noopener noreferrer">Google Mapsで読む</a></blockquote>`).join("")}</details>` : ""}
                <div class="store-links">
                  <a href="${googleMapsSearchUrl(shop, state.profile.shoppingArea)}" target="_blank" rel="noopener noreferrer">Googleマップで開く ↗</a>
                  ${shop.officialUrl ? `<a href="${safeExternalUrl(shop.officialUrl)}" target="_blank" rel="noopener noreferrer">公式の取り扱い・店舗情報 ↗</a>` : ""}
                </div>
              </article>`).join("")}
          </div>
          <div class="map-panel">
            ${shopRecommendations.length ? `
            <div><span>GOOGLE MAP</span><b id="mapStoreName">${escapeHTML(shopRecommendations[0].name)}</b></div>
            <iframe id="shopMap" title="${escapeHTML(state.profile.shoppingArea)}周辺の${escapeHTML(shopRecommendations[0].name)}" src="${googleMapsEmbedUrl(shopRecommendations[0], state.profile.shoppingArea)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
            ` : '<p class="shop-note">この地域・条件の店舗候補はまだありません。</p>'}
          </div>
        </div>
        <p class="shop-note">店舗名のないブランド候補は地図で最寄りの店舗を探すための案内です。口コミの言及は現在の店頭在庫と異なる場合があります。来店前に公式情報でご確認ください。</p>
      </section>

      <section class="recommend-section">
        <div class="section-title">
          <div><p class="eyebrow">ANALYZED LOOKS</p><h2>あなた向けコーデの一部</h2></div>
          <button class="text-button" type="button" id="restartButton">診断し直す</button>
        </div>
        <div class="recommend-grid">
          ${analyzedLooks.slice(0, 4).map((look) => `
            <button type="button" class="recommend-card" data-route="discover">
              <img src="${look.image}" alt="${look.label}" loading="lazy">
              <span>${look.label}<b>→</b></span>
            </button>`).join("")}
        </div>
      </section>
    </section>
  `;

  document.querySelectorAll("[data-occasion]").forEach((button) => {
    button.addEventListener("click", () => {
      state.occasion = button.dataset.occasion;
      persist();
      renderResult();
    });
  });
  bindRouteButtons();
  document.getElementById("searchLocalShops").addEventListener("click", searchLocalShops);
  document.getElementById("brandDiscovery").addEventListener("change", (event) => {
    state.brandDiscovery = event.target.value;
    persist();
    renderResult();
  });
  document.querySelectorAll("[data-product-choice]").forEach((button) => button.addEventListener("click", () => {
    state.productFeedback ||= {};
    state.productFeedback[button.dataset.productId] = button.dataset.productChoice;
    persist();
    renderResult();
    showToast("回答を次のおすすめに反映しました");
  }));
  document.querySelectorAll("[data-look-choice]").forEach((button) => button.addEventListener("click", () => {
    recordSuggestedLook(button.dataset.lookId, button.dataset.lookChoice);
  }));
  document.getElementById("restartButton").addEventListener("click", resetDiagnosis);
  document.getElementById("quickRestartButton").addEventListener("click", resetDiagnosis);
  document.getElementById("editProfileButton").addEventListener("click", editProfile);
  document.querySelectorAll("[data-map-shop]").forEach((button) => {
    button.addEventListener("click", () => {
      const shop = shopRecommendations.find((item) => item.id === button.dataset.mapShop);
      if (!shop) return;
      document.getElementById("shopMap").src = googleMapsEmbedUrl(shop, state.profile.shoppingArea);
      document.getElementById("shopMap").title = `${state.profile.shoppingArea}周辺の${shop.name}`;
      document.getElementById("mapStoreName").textContent = shop.name;
      document.querySelectorAll("[data-store-card]").forEach((card) => card.classList.toggle("is-selected", card.dataset.storeCard === shop.id));
    });
  });
  app.querySelectorAll([
    ".result-hero .result-copy > p:not(.eyebrow)", ".result-hero .tag-row",
    ".result-hero .style-type-row", ".result-photo-stack > span",
    ".result-screen > .diagnosis-analysis", ".discover-invite p",
    ".novel-looks-section > .shop-note", ".novel-look-copy > h3",
    ".novel-look-copy > p", ".novel-look-copy .style-score",
    ".novel-look-copy .liked-evidence", ".profile-summary > span"
  ].join(",")).forEach((element) => element.remove());
  const moreLooksHeading = app.querySelector(".discover-invite h2");
  if (moreLooksHeading) moreLooksHeading.textContent = "もっと写真を見る";
}

function recordSuggestedLook(id, choice) {
  if (!["like", "no"].includes(choice) || !personalizedLooks().some((look) => look.id === id)) return;
  state.recommendationHistory.push({ id, choice, details: {}, wasSaved: false, createdAt: new Date().toISOString() });
  window.konomiCloudSync?.record(id, choice);
  if (choice === "like" && !state.savedRecommendationIds.includes(id)) state.savedRecommendationIds.push(id);
  // 結果画面で新しい回答が来たら、次のバッチも新しい好みで選び直す。
  state.recommendationQueue = [];
  state.recommendationCurrent = 0;
  state.recommendationRound = 0;
  state.recommendationCompleted = false;
  persist();
  renderResult();
  showToast("この回答を分析して、別のおすすめに更新しました");
}

function renderDiscover() {
  if (!state.recommendationRound) startRefinementRound(false, false);
  const looks = currentRoundLooks();
  const tasteProfile = calculateProfile(diagnosisCards(), state.likedIds);
  if (!state.sessionCompleted) {
    setRoute("swipe");
    return;
  }
  if (state.recommendationCurrent >= looks.length) {
    state.recommendationCompleted = true;
    persist();
    renderDiscoverComplete(looks, tasteProfile);
    return;
  }

  const look = looks[state.recommendationCurrent];
  const nextLook = looks[state.recommendationCurrent + 1];
  const progress = Math.round((state.recommendationCurrent / looks.length) * 100);
  const reasons = look.matches.length ? look.matches : look.tags.slice(0, 3);

  app.innerHTML = `
    <section class="swipe-screen discover-screen">
      <div class="swipe-shortcuts"><button class="restart-diagnosis" type="button" id="restartDiagnosisFromDiscover">最初から</button><button class="restart-diagnosis" type="button" data-route="result">結果を見る</button></div>
      <div class="swipe-heading">
        <div>
          <p class="eyebrow">あなたへの提案 ROUND ${state.recommendationRound} · ${escapeHTML(state.profile.nickname)}</p>
          <h1>こういう服は、どう？</h1>
        </div>
        <span class="counter"><b>${String(state.recommendationCurrent + 1).padStart(2, "0")}</b> / ${looks.length}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="おすすめコーデの進捗" aria-valuenow="${state.recommendationCurrent}" aria-valuemin="0" aria-valuemax="${looks.length}">
        <span style="width:${progress}%"></span>
      </div>
      <p class="analysis-note">${escapeHTML(state.recommendationReasons?.[look.id] || look.reason)}<br>共通する特徴：${reasons.map((tag) => `#${tag}`).join(" · ")}</p>
      <div class="card-stage recommendation-stage">
        ${nextLook ? `<article class="fashion-card card-behind"><img src="${nextLook.image}" alt="" draggable="false"></article>` : ""}
        <article class="fashion-card card-active recommendation-card-active" id="recommendationCard" aria-label="${look.label}">
          <img src="${look.image}" alt="${look.label}のコーディネート" draggable="false">
          <div class="card-shade"></div>
          <div class="choice-stamp stamp-no" aria-hidden="true">SKIP</div>
          <div class="choice-stamp stamp-like" aria-hidden="true">SAVE</div>
          <div class="card-caption recommendation-caption">
            <span>追加診断 ${String(state.recommendationCurrent + 1).padStart(2, "0")}</span>
            <h2>${look.label}</h2>
            <p>${look.summary}</p>
          </div>
        </article>
      </div>
      ${styleScoreHTML(look.id)}
      <p class="swipe-hint"><span>← 好みと違う</span><span>着てみたい →</span></p>
      <div class="swipe-actions">
        <button class="undo-button" type="button" id="recommendationUndo" aria-label="一つ戻る" ${state.recommendationCurrent > 0 ? "" : "disabled"}>↶</button>
        <button class="choice-button no-button" type="button" data-recommendation-choice="no" aria-label="好みと違う">×</button>
        <button class="choice-button like-button" type="button" data-recommendation-choice="like" aria-label="お気に入りに保存">♡</button>
        <span class="action-spacer" aria-hidden="true"></span>
      </div>
      <div class="refinement-details">
        <details><summary>どの部分が好き？ 苦手？（任意）</summary>
          ${(look.features || []).map((feature, index) => `<fieldset><legend>${escapeHTML(feature)}</legend><label><input type="radio" name="detail-${index}" data-feature="${escapeHTML(feature)}" value="like">好き</label><label><input type="radio" name="detail-${index}" data-feature="${escapeHTML(feature)}" value="no">苦手</label><label><input type="radio" name="detail-${index}" value="neutral" checked>判断しない</label></fieldset>`).join("")}
        </details>
        <div class="refinement-extra-actions"><button type="button" class="secondary-button" data-recommendation-choice="neutral">一部だけ好き</button><button type="button" class="text-button" data-recommendation-choice="skip">まだ判断できない</button><button type="button" class="text-button" data-route="result">今の結果を見る</button></div>
        <p class="shop-note">「一部だけ好き」では選んだ部分だけを反映します。「まだ判断できない」は苦手として数えません。</p>
      </div>
    </section>
  `;

  app.querySelectorAll(".discover-screen .swipe-heading > div, .discover-screen .analysis-note, .discover-screen .card-shade, .discover-screen .card-caption, .discover-screen .style-score, .discover-screen .swipe-hint, .discover-screen .refinement-details")
    .forEach((element) => element.remove());
  app.querySelector('[data-recommendation-choice="no"]').textContent = "Dislike";
  app.querySelector('[data-recommendation-choice="like"]').textContent = "Like";
  setupRecommendationGesture();
  document.querySelectorAll("[data-recommendation-choice]").forEach((button) => {
    button.addEventListener("click", () => animateRecommendationChoice(button.dataset.recommendationChoice));
  });
  document.getElementById("recommendationUndo").addEventListener("click", undoRecommendationChoice);
  document.getElementById("restartDiagnosisFromDiscover").addEventListener("click", resetDiagnosis);
  bindRouteButtons();
}

function currentRoundLooks() {
  const inputs = recommendationInputs();
  const ranked = selectPersonalizedLooks(recommendations, inputs.cards, inputs.likedIds, state.profile.gender || "all", recommendations.length);
  return (state.recommendationQueue || []).map((id) => ranked.find((look) => look.id === id)).filter(Boolean);
}

function nextRefinementCandidates(revisit = false) {
  if (fashionPreference && !revisit) return fashionSelection(fashionRankedLooks(), 6);
  const inputs = recommendationInputs();
  const answered = revisit ? [] : [...diagnosisCards().map((card) => "r-" + card.id), ...state.recommendationHistory.map((entry) => entry.id)];
  if (revisit) return selectAdaptiveRound(recommendations, inputs.cards, inputs.likedIds, state.profile.gender || "all", [], 6);
  return selectNovelLooks(recommendations, inputs.cards, inputs.likedIds, state.profile.gender || "all", answered, 6);
}

function startRefinementRound(revisit = false, shouldRender = true) {
  state.recommendationRevisit = revisit;
  const next = nextRefinementCandidates(revisit);
  state.recommendationQueue = next.map((look) => look.id);
  state.recommendationReasons = Object.fromEntries(next.map((look) => [look.id, look.roundReason]));
  state.recommendationRound = (state.recommendationRound || 0) + 1;
  state.recommendationCurrent = 0;
  state.recommendationCompleted = false;
  state.route = "discover";
  persist();
  if (shouldRender) render();
}

function renderDiscoverComplete(looks, tasteProfile) {
  const saved = recommendations.filter((look) => state.savedRecommendationIds.includes(look.id));
  const inputs = recommendationInputs();
  const signals = buildPreference(inputs.cards, inputs.likedIds).signals;
  const remaining = nextRefinementCandidates().length;
  app.innerHTML = `
    <section class="discover-complete">
      <div class="complete-copy">
        <p class="eyebrow">${looks.length ? `追加診断 ROUND ${state.recommendationRound} 完了` : "現在の未回答写真はありません"}</p>
        <h1>回答から、<br>好みを更新しました。</h1>
        <p>これまで追加で${state.recommendationHistory.length}枚に回答。今の共通点は「${signals.join("・") || "もう少し比較したい"}」。${remaining ? "次はこの好みをもとに、別の服を提案します。" : "今の好みに近い未回答の写真候補がありません。新しい提案を増やすには写真候補の拡充が必要です。比較し直す場合は、過去の写真も含まれます。"} </p>
        <div class="complete-actions">
          <button class="primary-button" type="button" id="nextRefinementRound">${remaining ? "分析した好みで、別の服を提案" : "過去の写真を比較し直す"} <span>→</span></button>
          <button class="secondary-button" type="button" data-route="result">更新した結果・ブランドを見る</button>
          <button class="text-button" type="button" data-route="saved">お気に入りを見る</button>
        </div>
      </div>
      <div class="complete-collage" aria-label="保存したおすすめコーデ">
        ${(saved.length ? saved : looks.slice(0, 4)).slice(0, 4).map((look, index) => `<img style="--i:${index}" src="${look.image}" alt="${look.label}">`).join("")}
      </div>
    </section>
    ${diagnosisAnalysisHTML(inputs)}
    <section class="round-discoveries"><h2>この診断から、新しく見てほしい服。</h2><div class="product-grid">
      ${selectDiscoveryRecommendations(products, inputs.cards, inputs.likedIds, state.profile.gender, state.profile.budget, state.productFeedback, 3).map((product) => `<article class="product-card"><div class="product-meta">${escapeHTML(product.brand)}</div><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.discoveryReason)}</p><p class="discovery-experiment">${escapeHTML(product.experiment)}</p><a href="${safeExternalUrl(product.url)}" target="_blank" rel="noopener noreferrer">この服の方向を公式で見比べる ↗</a><div class="recommendation-feedback"><button type="button" data-round-product="${product.id}" data-choice="like">気になる</button><button type="button" data-round-product="${product.id}" data-choice="no">好みと違う</button></div></article>`).join("") || '<p class="shop-note">好みとの共通点が確認できる候補はまだありません。気になる部分を回答すると、提案を絞れます。</p>'}
    </div><p class="shop-note">公式の取り扱い一覧への案内です。写真と同じ服や在庫・価格の確認ではありません。</p></section>
  `;
  document.querySelectorAll("[data-round-product]").forEach((button) => button.addEventListener("click", () => {
    state.productFeedback ||= {};
    state.productFeedback[button.dataset.roundProduct] = button.dataset.choice;
    persist();
    renderDiscover();
    showToast("興味のある方向を次の提案に反映しました");
  }));
  document.getElementById("nextRefinementRound").addEventListener("click", () => startRefinementRound(!remaining));
  bindRouteButtons();
}

function setupRecommendationGesture() {
  const card = document.getElementById("recommendationCard");
  let startX = 0;
  let deltaX = 0;
  let dragging = false;

  card.addEventListener("pointerdown", (event) => {
    dragging = true;
    startX = event.clientX;
    card.setPointerCapture(event.pointerId);
    card.classList.add("is-dragging");
  });
  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    card.style.transform = `translateX(${deltaX}px) rotate(${deltaX / 22}deg)`;
    card.style.setProperty("--drag", Math.min(1, Math.abs(deltaX) / 110));
    card.dataset.direction = deltaX > 0 ? "right" : "left";
  });
  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("is-dragging");
    if (Math.abs(deltaX) > 95) animateRecommendationChoice(deltaX > 0 ? "like" : "no");
    else {
      card.style.transform = "";
      card.style.removeProperty("--drag");
      delete card.dataset.direction;
    }
  };
  card.addEventListener("pointerup", finish);
  card.addEventListener("pointercancel", finish);
}

function animateRecommendationChoice(choice) {
  const card = document.getElementById("recommendationCard");
  if (!card || card.classList.contains("is-leaving")) return;
  card.classList.add("is-leaving", choice === "like" ? "leave-right" : "leave-left");
  window.setTimeout(() => recordRecommendationChoice(choice), 260);
}

function recordRecommendationChoice(choice) {
  const look = currentRoundLooks()[state.recommendationCurrent];
  if (!look) return;
  const details = Object.fromEntries([...document.querySelectorAll(".refinement-details input[data-feature]:checked")].map((input) => [input.dataset.feature, input.value]));
  if (choice === "neutral" && !Object.keys(details).length) {
    const card = document.getElementById("recommendationCard");
    card.className = "fashion-card card-active recommendation-card-active";
    document.querySelector(".refinement-details details").open = true;
    showToast("好き・苦手な部分を選んでください");
    return;
  }
  const previousAnswer = state.recommendationHistory.find((entry) => entry.id === look.id);
  state.recommendationHistory = state.recommendationHistory.filter((entry) => entry.id !== look.id);
  state.recommendationHistory.push({ id: look.id, choice, details, previousAnswer, wasSaved: state.savedRecommendationIds.includes(look.id), createdAt: new Date().toISOString() });
  window.konomiCloudSync?.record(look.id, choice);
  if (choice === "like" && !state.savedRecommendationIds.includes(look.id)) state.savedRecommendationIds.push(look.id);
  if (choice === "no") state.savedRecommendationIds = state.savedRecommendationIds.filter((id) => id !== look.id);
  state.recommendationCurrent += 1;
  persist();
  renderDiscover();
}

function undoRecommendationChoice() {
  if (!state.recommendationCurrent) return;
  const last = state.recommendationHistory.pop();
  if (!last) return;
  state.recommendationCurrent = Math.max(0, state.recommendationCurrent - 1);
  if (last.previousAnswer) state.recommendationHistory.push(last.previousAnswer);
  const originalAnswer = state.history.find((entry) => entry.id === last.id.replace(/^r-/, ""));
  window.konomiCloudSync?.record(last.id, last.previousAnswer?.choice ?? originalAnswer?.choice ?? null);
  state.savedRecommendationIds = state.savedRecommendationIds.filter((id) => id !== last.id);
  if (last.wasSaved) state.savedRecommendationIds.push(last.id);
  state.recommendationCompleted = false;
  persist({ keepVisible: true });
  renderDiscover();
  showToast("ひとつ前のおすすめに戻りました");
}

function googleMapsQuery(shop, area) {
  return shop.address || shop.areas ? shop.query : `${shop.query} ${area}`.trim();
}

function googleMapsEmbedUrl(shop, area) {
  return `https://www.google.com/maps?q=${encodeURIComponent(googleMapsQuery(shop, area))}&output=embed`;
}

function googleMapsSearchUrl(shop, area) {
  return shop.mapsUrl ? safeExternalUrl(shop.mapsUrl) : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery(shop, area))}`;
}

function safeExternalUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:" ? escapeHTML(url.href) : "#"; }
  catch { return "#"; }
}

function localShopStatusText() {
  const messages = {
    idle: "現在は公式情報からの候補です。地域の店舗・口コミは検索後に表示します。",
    loading: "Google Mapsの店舗情報と取得できた口コミを確認しています。",
    unconfigured: "口コミ検索は未接続です。現在の候補は公式情報を参考にしています。",
    ready: "Google Mapsの取得できた口コミから服の特徴を調べ、選んだ服との共通点で並べています。",
    empty: "地域の店舗を取得できませんでした。エリア名を具体的にして再検索してください。",
    error: localShops.error
  };
  return escapeHTML(messages[localShops.status] || messages.idle);
}

async function searchLocalShops() {
  const key = localShops.key;
  localShops.status = "loading";
  renderResult();
  try {
    const inputs = recommendationInputs();
    const signals = buildPreference(inputs.cards, inputs.likedIds).signals;
    const response = await fetch("/api/shops/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: state.profile.shoppingArea, signals }),
      signal: AbortSignal.timeout(30000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "店舗情報を取得できませんでした。");
    if (localShops.key !== key) return;
    localShops = { key, status: result.status, shops: result.shops || [], error: "" };
  } catch (error) {
    if (localShops.key !== key) return;
    localShops.status = "error";
    localShops.error = error.name === "TimeoutError" ? "検索が時間切れになりました。もう一度お試しください。" : error.message;
  }
  if (state.route === "result") renderResult();
}

function ageLabel(value) {
  return ({ teens: "10代", "20s": "20代", "30s": "30代", "40s": "40代", "50s": "50代", "60plus": "60代以上" })[value] || "年代未設定";
}

function genderLabel(value) {
  return ({ women: "ウィメンズ", men: "メンズ", all: "ウィメンズ・メンズ両方" })[value] || "方向未設定";
}

function renderSaved() {
  void window.KonomiFeedUI.renderFeed({ app, state, setRoute, persist });
}

function renderWardrobe() {
  void window.KonomiFeedUI.renderWardrobe({ app, state, setRoute, persist });
}

function bindRouteButtons() {
  app.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route));
  });
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1900);
}

let activeAuthUserId = window.KONOMI_AUTH_REQUIRED ? authUserId() : null;
window.addEventListener?.('konomi:auth-change', (event) => {
  if (!window.KONOMI_AUTH_REQUIRED || event.detail.userId === activeAuthUserId) return;
  activeAuthUserId = event.detail.userId;
  fashionPreference = null;
  localShops = { key: '', status: 'idle', shops: [], error: '' };
  state = loadState();
  if (activeAuthUserId) void initializeFashionPreference();
  render();
});

document.querySelectorAll("header [data-route], nav [data-route]").forEach((button) => {
  button.addEventListener("click", () => setRoute(button.dataset.route));
});
document.getElementById("aboutButton").addEventListener("click", () => aboutDialog.showModal());
aboutDialog.querySelector(".dialog-close").addEventListener("click", () => aboutDialog.close());
aboutDialog.addEventListener("click", (event) => {
  if (event.target === aboutDialog) aboutDialog.close();
});

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (state.route === "swipe") {
    if (event.key === "ArrowLeft") animateChoice("no");
    if (event.key === "ArrowRight") animateChoice("like");
  }
  if (state.route === "discover") {
    if (event.key === "ArrowLeft") animateRecommendationChoice("no");
    if (event.key === "ArrowRight") animateRecommendationChoice("like");
  }
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

initializeFashionPreference();
render();
