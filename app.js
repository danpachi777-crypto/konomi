const cards = window.KONOMI_CARDS;
const products = window.KONOMI_PRODUCTS;
const shops = window.KONOMI_SHOPS;
const recommendations = window.KONOMI_RECOMMENDATIONS;
const {
  calculateProfile,
  selectPersonalizedLooks,
  filterCardsByAudience,
  selectProductRecommendations,
  selectShopRecommendations
} = window.KonomiLogic;
const storageKey = "konomi-state-v4";

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
  recommendationCompleted: false,
  occasion: "休日",
  profileCompleted: false,
  profile: { ...defaultProfile }
};

let state = loadState();
let toastTimer;

const app = document.getElementById("app");
const nav = document.getElementById("bottomNav");
const aboutDialog = document.getElementById("aboutDialog");
document.body.dataset.demo = new URLSearchParams(location.search).get("demo") || "";

function loadState() {
  const demo = new URLSearchParams(location.search).get("demo");
  const demoProfile = {
    nickname: "Konomi",
    ageRange: "20s",
    gender: "all",
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
      likedIds: ["f01", "f02", "f04", "f08", "f12", "f15", "f18", "f21", "f23", "f28"]
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
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return {
      ...defaultState,
      ...stored,
      profile: { ...defaultProfile, ...(stored.profile || {}) }
    };
  } catch {
    return { ...defaultState, profile: { ...defaultProfile } };
  }
}

function persist() {
  if (new URLSearchParams(location.search).has("demo")) return;
  localStorage.setItem(storageKey, JSON.stringify(state));
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
  return filterCardsByAudience(cards, state.profile.gender || "all");
}

function personalizedLooks() {
  return selectPersonalizedLooks(recommendations, diagnosisCards(), state.likedIds, state.profile.gender || "all", 20);
}

function setRoute(route) {
  if (route === "swipe" && !state.profileCompleted) route = "profile";
  if (route === "result" && !state.sessionCompleted) route = state.current ? "swipe" : state.profileCompleted ? "profile" : "home";
  if ((route === "discover" || route === "saved") && !state.sessionCompleted) route = state.current ? "swipe" : state.profileCompleted ? "profile" : "home";
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
}

function renderHome() {
  const hasProgress = state.current > 0 && !state.sessionCompleted;
  const hasResult = state.sessionCompleted;
  const collageCards = state.profileCompleted ? diagnosisCards().slice(0, 3) : cards.slice(0, 3);
  app.innerHTML = `
    <section class="home-screen">
      <div class="home-copy">
        <p class="eyebrow">FIND YOUR STYLE</p>
        <h1>好きから、<br><em>似合う</em>へ。</h1>
        <p class="lead">プロフィールを設定して、54ルックからあなた向けのコーデを直感で選ぶだけ。診断の先に、実際に買える服と近くのお店まで提案します。</p>
        <div class="home-actions">
          <button class="primary-button" type="button" id="startButton">
            ${hasProgress ? "診断を続ける" : hasResult ? "もう一度診断する" : "初期設定をはじめる"}
            <span aria-hidden="true">→</span>
          </button>
          ${hasResult ? '<button class="secondary-button" type="button" data-route="result">前回の結果を見る</button>' : ""}
        </div>
        <div class="quick-facts" aria-label="診断について">
          <span><strong>01</strong> profile</span>
          <span><strong>02</strong> choice</span>
          <span><strong>03</strong> shop</span>
        </div>
      </div>
      <div class="home-collage" aria-hidden="true">
        ${collageCards.map((card, index) => `<img class="collage-${index + 1}" src="${card.image}" alt="" loading="eager">`).join("")}
        <span class="floating-like">LIKE <b>♡</b></span>
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
          ${cards.slice(0, 3).map((card, index) => `<img style="--i:${index}" src="${card.image}" alt="">`).join("")}
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
          <legend>性別 <span>表示するコーデに反映します</span></legend>
          <div class="choice-grid gender-grid">
            <label><input type="radio" name="gender" value="women" required ${checked(profile.gender, "women")}><span><b>女性</b><small>女性モデルの服</small></span></label>
            <label><input type="radio" name="gender" value="men" required ${checked(profile.gender, "men")}><span><b>男性</b><small>男性モデルの服</small></span></label>
            <label><input type="radio" name="gender" value="all" required ${checked(profile.gender, "all")}><span><b>回答しない</b><small>すべての服</small></span></label>
          </div>
          <p class="selection-note" id="selectionNote">性別を選ぶと、表示するルック数がここに出ます。</p>
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
    const count = filterCardsByAudience(cards, gender).length;
    const label = gender === "women" ? "女性向け" : gender === "men" ? "男性向け" : "すべて";
    note.textContent = `${label}の${count}ルックを表示します。`;
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
    <section class="swipe-screen">
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
            <h2>${card.label}</h2>
          </div>
        </article>
      </div>
      <p class="swipe-hint"><span>← 興味なし</span><span>好き →</span></p>
      <div class="swipe-actions">
        <button class="undo-button" type="button" id="undoButton" aria-label="一つ戻る" ${state.history.length ? "" : "disabled"}>↶</button>
        <button class="choice-button no-button" type="button" data-choice="no" aria-label="興味なし">×</button>
        <button class="choice-button like-button" type="button" data-choice="like" aria-label="好き">♡</button>
        <span class="action-spacer" aria-hidden="true"></span>
      </div>
    </section>
  `;

  setupSwipeGesture();
  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => animateChoice(button.dataset.choice));
  });
  document.getElementById("undoButton").addEventListener("click", undoChoice);
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
  state.history.push({ id: card.id, choice });
  if (choice === "like" && !state.likedIds.includes(card.id)) state.likedIds.push(card.id);
  state.current += 1;
  persist();
  renderSwipe();
}

function undoChoice() {
  const last = state.history.pop();
  if (!last) return;
  state.current = Math.max(0, state.current - 1);
  if (last.choice === "like") state.likedIds = state.likedIds.filter((id) => id !== last.id);
  state.sessionCompleted = false;
  persist();
  renderSwipe();
  showToast("ひとつ前に戻りました");
}

function renderResult() {
  const activeCards = diagnosisCards();
  const tasteProfile = calculateProfile(activeCards, state.likedIds);
  const analyzedLooks = personalizedLooks();
  const productRecommendations = selectProductRecommendations(products, activeCards, state.likedIds, state.profile.gender, state.profile.budget, 6);
  const shopRecommendations = selectShopRecommendations(shops, activeCards, state.likedIds, 4);
  const tags = tasteProfile.topTags.length ? tasteProfile.topTags : [
    { tag: "これから発見", percent: 35 },
    { tag: "ニュートラル", percent: 24 },
    { tag: "自由", percent: 18 }
  ];

  app.innerHTML = `
    <section class="result-screen">
      <div class="result-hero">
        <div class="result-copy">
          <p class="eyebrow">${escapeHTML(state.profile.nickname)}'S STYLE DNA</p>
          <p class="result-kicker">${escapeHTML(state.profile.nickname)}さんのスタイルは</p>
          <h1>${tasteProfile.archetype.name}</h1>
          <p>${tasteProfile.archetype.description}</p>
          <div class="tag-row">${tags.slice(0, 3).map((item) => `<span># ${item.tag}</span>`).join("")}</div>
          <div class="style-type-row">
            ${tasteProfile.topArchetypes.slice(0, 3).map((item, index) => `<div><span>0${index + 1}</span><b>${item.name}</b><em>${item.percent}%</em></div>`).join("")}
          </div>
        </div>
        <div class="result-photo-stack" aria-label="診断から分析したおすすめコーデ">
          ${analyzedLooks.slice(0, 3).map((look, index) => `<img style="--i:${index}" src="${look.image}" alt="${look.label}">`).join("")}
          <span>分析から選んだコーデ例</span>
        </div>
      </div>

      <section class="discover-invite">
        <div>
          <p class="eyebrow">20 PERSONALIZED LOOKS</p>
          <h2>診断結果から、新しいコーデを20通り選びました。</h2>
          <p>診断で見た写真の使い回しではありません。「${tasteProfile.archetype.name}」と選んだタグを分析し、別のコーデ写真を一致度順に並べています。</p>
        </div>
        <button class="primary-button" type="button" data-route="discover">おすすめをスワイプ <span>→</span></button>
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
            <span>${tasteProfile.likedCount} / ${activeCards.length} LIKE</span>
          </div>
          <div class="meter-list">
            ${tags.slice(0, 4).map((item) => `
              <div class="meter-item">
                <div><span>${item.tag}</span><b>${item.percent}</b></div>
                <div class="meter"><i style="width:${item.percent}%"></i></div>
              </div>`).join("")}
          </div>
        </section>

        <section class="result-panel recipe-panel">
          <div class="section-title">
            <div><p class="eyebrow">MAKE THE LOOK</p><h2>${state.occasion}の基本コーデ</h2></div>
          </div>
          <div class="occasion-tabs" role="group" aria-label="利用シーン">
            ${["休日", "通勤・通学", "デート"].map((item) => `<button type="button" data-occasion="${item}" class="${item === state.occasion ? "is-selected" : ""}">${item}</button>`).join("")}
          </div>
          <ol class="recipe-list">
            ${tasteProfile.archetype.recipe.map((item, index) => `<li><span>0${index + 1}</span><b>${adjustRecipe(item, state.occasion)}</b></li>`).join("")}
          </ol>
          <button class="dark-button" type="button" id="saveRecipeButton">この組み合わせを保存 <span>＋</span></button>
        </section>
      </div>

      <section class="shop-section">
        <div class="shop-heading">
          <div>
            <p class="eyebrow">REAL ITEMS FOR YOU</p>
            <h2>このスタイルを、実際の服で。</h2>
            <p>「${tasteProfile.archetype.name}」と選んだ好みから、公式ストアで確認できる実在商品を選びました。</p>
          </div>
          <span class="verified-badge">2026.10 確認</span>
        </div>
        <div class="product-grid">
          ${productRecommendations.map((product, index) => `
            <article class="product-card">
              <div class="product-index">${String(index + 1).padStart(2, "0")}</div>
              <div class="product-meta"><span>${product.brand}</span><span>${product.category}</span></div>
              <h3>${product.name}</h3>
              <p>${productReason(product, tasteProfile.archetype.name)}</p>
              <div class="product-tags">${(product.matches.length ? product.matches : product.tags.slice(0, 2)).map((tag) => `<span>#${tag}</span>`).join("")}</div>
              <a href="${product.url}" target="_blank" rel="noopener noreferrer">公式ストアで見る <span aria-hidden="true">↗</span></a>
            </article>`).join("")}
        </div>
        <p class="shop-note">商品名・在庫・価格は変更されることがあります。購入前に公式ストアで最新情報をご確認ください。</p>
      </section>

      <section class="store-section">
        <div class="store-heading">
          <div>
            <p class="eyebrow">SHOPS NEAR YOU</p>
            <h2>${escapeHTML(state.profile.shoppingArea)}で、実物を見に行く。</h2>
            <p>診断タイプと選んだ「好き」に合う服屋・古着店を選びました。店舗を切り替えると地図も更新されます。</p>
          </div>
        </div>
        <div class="store-layout">
          <div class="store-list">
            ${shopRecommendations.map((shop, index) => `
              <article class="store-card ${index === 0 ? "is-selected" : ""}" data-store-card="${shop.id}">
                <button type="button" data-map-shop="${shop.id}">
                  <span class="store-number">${String(index + 1).padStart(2, "0")}</span>
                  <span class="store-copy"><small>${shop.type}</small><b>${shop.name}</b><em>${shop.description}</em></span>
                  <span aria-hidden="true">→</span>
                </button>
                <div class="store-links">
                  <a href="${googleMapsSearchUrl(shop, state.profile.shoppingArea)}" target="_blank" rel="noopener noreferrer">Googleマップで開く ↗</a>
                  ${shop.officialUrl ? `<a href="${shop.officialUrl}" target="_blank" rel="noopener noreferrer">公式店舗一覧 ↗</a>` : ""}
                </div>
              </article>`).join("")}
          </div>
          <div class="map-panel">
            <div><span>GOOGLE MAP</span><b id="mapStoreName">${shopRecommendations[0].name}</b></div>
            <iframe id="shopMap" title="${escapeHTML(state.profile.shoppingArea)}周辺の${shopRecommendations[0].name}" src="${googleMapsEmbedUrl(shopRecommendations[0], state.profile.shoppingArea)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
          </div>
        </div>
        <p class="shop-note">地図と営業情報はGoogleマップの検索結果を利用します。来店前に各店舗の公式情報で営業時間・在庫をご確認ください。</p>
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
  document.getElementById("saveRecipeButton").addEventListener("click", () => showToast("基本コーデを保存しました"));
  document.getElementById("restartButton").addEventListener("click", resetDiagnosis);
  document.getElementById("editProfileButton").addEventListener("click", resetDiagnosis);
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
}

function renderDiscover() {
  const looks = personalizedLooks();
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
      <div class="swipe-heading">
        <div>
          <p class="eyebrow">FOR ${escapeHTML(state.profile.nickname)} · ${tasteProfile.archetype.name}</p>
          <h1>着てみたいを保存</h1>
        </div>
        <span class="counter"><b>${String(state.recommendationCurrent + 1).padStart(2, "0")}</b> / ${looks.length}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="おすすめコーデの進捗" aria-valuenow="${state.recommendationCurrent}" aria-valuemin="0" aria-valuemax="${looks.length}">
        <span style="width:${progress}%"></span>
      </div>
      <p class="analysis-note">診断タグとの一致：${reasons.map((tag) => `#${tag}`).join(" · ")}</p>
      <div class="card-stage recommendation-stage">
        ${nextLook ? `<article class="fashion-card card-behind"><img src="${nextLook.image}" alt="" draggable="false"></article>` : ""}
        <article class="fashion-card card-active recommendation-card-active" id="recommendationCard" aria-label="${look.label}">
          <img src="${look.image}" alt="${look.label}のコーディネート" draggable="false">
          <div class="card-shade"></div>
          <div class="choice-stamp stamp-no" aria-hidden="true">SKIP</div>
          <div class="choice-stamp stamp-like" aria-hidden="true">SAVE</div>
          <div class="card-caption recommendation-caption">
            <span>ANALYZED LOOK ${String(state.recommendationCurrent + 1).padStart(2, "0")}</span>
            <h2>${look.label}</h2>
            <p>${look.summary}</p>
          </div>
        </article>
      </div>
      <p class="swipe-hint"><span>← スキップ</span><span>お気に入り →</span></p>
      <div class="swipe-actions">
        <button class="undo-button" type="button" id="recommendationUndo" aria-label="一つ戻る" ${state.recommendationHistory.length ? "" : "disabled"}>↶</button>
        <button class="choice-button no-button" type="button" data-recommendation-choice="no" aria-label="スキップ">×</button>
        <button class="choice-button like-button" type="button" data-recommendation-choice="like" aria-label="お気に入りに保存">♡</button>
        <span class="action-spacer" aria-hidden="true"></span>
      </div>
    </section>
  `;

  setupRecommendationGesture();
  document.querySelectorAll("[data-recommendation-choice]").forEach((button) => {
    button.addEventListener("click", () => animateRecommendationChoice(button.dataset.recommendationChoice));
  });
  document.getElementById("recommendationUndo").addEventListener("click", undoRecommendationChoice);
}

function renderDiscoverComplete(looks, tasteProfile) {
  const saved = recommendations.filter((look) => state.savedRecommendationIds.includes(look.id));
  app.innerHTML = `
    <section class="discover-complete">
      <div class="complete-copy">
        <p class="eyebrow">YOUR LOOK BOOK IS READY</p>
        <h1>${saved.length}件のコーデを<br>お気に入りに保存しました。</h1>
        <p>「${tasteProfile.archetype.name}」を軸に選んだ${looks.length}通りを見終わりました。保存したコーデはいつでも見返せます。</p>
        <div class="complete-actions">
          <button class="primary-button" type="button" data-route="saved">お気に入りを見る <span>→</span></button>
          <button class="secondary-button" type="button" id="replayRecommendations">もう一度見る</button>
          <button class="text-button" type="button" data-route="result">診断結果に戻る</button>
        </div>
      </div>
      <div class="complete-collage" aria-label="保存したおすすめコーデ">
        ${(saved.length ? saved : looks.slice(0, 4)).slice(0, 4).map((look, index) => `<img style="--i:${index}" src="${look.image}" alt="${look.label}">`).join("")}
      </div>
    </section>
  `;
  document.getElementById("replayRecommendations").addEventListener("click", () => {
    state.recommendationCurrent = 0;
    state.recommendationHistory = [];
    state.recommendationCompleted = false;
    persist();
    renderDiscover();
  });
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
  const look = personalizedLooks()[state.recommendationCurrent];
  if (!look) return;
  state.recommendationHistory.push({ id: look.id, choice });
  if (choice === "like" && !state.savedRecommendationIds.includes(look.id)) state.savedRecommendationIds.push(look.id);
  state.recommendationCurrent += 1;
  persist();
  renderDiscover();
}

function undoRecommendationChoice() {
  const last = state.recommendationHistory.pop();
  if (!last) return;
  state.recommendationCurrent = Math.max(0, state.recommendationCurrent - 1);
  if (last.choice === "like") state.savedRecommendationIds = state.savedRecommendationIds.filter((id) => id !== last.id);
  state.recommendationCompleted = false;
  persist();
  renderDiscover();
  showToast("ひとつ前のおすすめに戻りました");
}

function googleMapsQuery(shop, area) {
  return `${shop.query} ${area}`.trim();
}

function googleMapsEmbedUrl(shop, area) {
  return `https://www.google.com/maps?q=${encodeURIComponent(googleMapsQuery(shop, area))}&output=embed`;
}

function googleMapsSearchUrl(shop, area) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery(shop, area))}`;
}

function ageLabel(value) {
  return ({ teens: "10代", "20s": "20代", "30s": "30代", "40s": "40代", "50s": "50代", "60plus": "60代以上" })[value] || "年代未設定";
}

function genderLabel(value) {
  return ({ women: "女性向け", men: "男性向け", all: "すべての服" })[value] || "性別未設定";
}

function productReason(product, archetypeName) {
  const match = product.matches[0] || product.tags[0];
  return `${archetypeName}の「${match}」を取り入れやすい一着。手持ちのベーシック服にも合わせやすい候補です。`;
}

function adjustRecipe(item, occasion) {
  if (occasion === "通勤・通学") return item.replace("シューズ", "きれいめシューズ").replace("トップス", "清潔感のあるトップス");
  if (occasion === "デート") return item.replace("小物", "印象に残る小物").replace("トップス", "表情のあるトップス");
  return item;
}

function renderSaved() {
  const savedLooks = recommendations.filter((look) => state.savedRecommendationIds.includes(look.id));
  const diagnosisLikes = cards.filter((card) => state.likedIds.includes(card.id));
  app.innerHTML = `
    <section class="saved-screen">
      <div class="page-heading">
        <p class="eyebrow">MY COLLECTION</p>
        <h1>お気に入りコーデ</h1>
        <p>${savedLooks.length ? `分析後のおすすめから${savedLooks.length}件を保存しています。` : "おすすめコーデを右にスワイプすると、ここに残ります。"}</p>
      </div>
      ${savedLooks.length ? `
        <div class="saved-grid saved-recommendation-grid">
          ${savedLooks.map((look) => `
            <article class="saved-card saved-look-card">
              <img src="${look.image}" alt="${look.label}" loading="lazy">
              <div><h2>${look.label}</h2><p>${look.summary}</p><small>${look.tags.slice(0, 3).map((tag) => `#${tag}`).join(" · ")}</small></div>
              <button type="button" data-remove-recommendation-id="${look.id}" aria-label="${look.label}を削除">×</button>
            </article>`).join("")}
        </div>
        <div class="collection-actions">
          <button class="primary-button" type="button" data-route="discover">おすすめを続ける <span>→</span></button>
          <button class="secondary-button" type="button" data-route="result">診断結果を見る</button>
        </div>
      ` : `
        <div class="empty-state">
          <span>♡</span><h2>まだお気に入りがありません</h2>
          <p>診断結果から選んだ新しいコーデを、右にスワイプして保存してみましょう。</p>
          <button class="primary-button" type="button" data-route="discover">おすすめを見る <span>→</span></button>
        </div>`}

      <section class="diagnosis-likes">
        <div class="section-title">
          <div><p class="eyebrow">DIAGNOSIS INPUT</p><h2>診断で「好き」と答えた写真</h2></div>
          <span>${diagnosisLikes.length} LIKE</span>
        </div>
        ${diagnosisLikes.length ? `<div class="saved-grid compact-saved-grid">
          ${diagnosisLikes.map((card) => `
            <article class="saved-card">
              <img src="${card.image}" alt="${card.label}" loading="lazy">
              <div><h2>${card.label}</h2><p>${card.tags.slice(0, 3).join(" · ")}</p></div>
            </article>`).join("")}
        </div>` : '<p class="muted-copy">診断で右にスワイプした写真はありません。</p>'}
      </section>
    </section>
  `;
  document.querySelectorAll("[data-remove-recommendation-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedRecommendationIds = state.savedRecommendationIds.filter((id) => id !== button.dataset.removeRecommendationId);
      persist();
      renderSaved();
    });
  });
  bindRouteButtons();
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

render();
