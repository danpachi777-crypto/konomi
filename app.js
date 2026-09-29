const cards = window.KONOMI_CARDS;
const { calculateProfile, selectRecommendations } = window.KonomiLogic;
const storageKey = "konomi-state-v1";

const defaultState = {
  route: "home",
  current: 0,
  history: [],
  likedIds: [],
  sessionCompleted: false,
  occasion: "休日"
};

let state = loadState();
let toastTimer;

const app = document.getElementById("app");
const nav = document.getElementById("bottomNav");
const aboutDialog = document.getElementById("aboutDialog");
document.body.dataset.demo = new URLSearchParams(location.search).get("demo") || "";

function loadState() {
  const demo = new URLSearchParams(location.search).get("demo");
  if (demo === "swipe") return { ...defaultState, route: "swipe", current: 8 };
  if (demo === "result") {
    return {
      ...defaultState,
      route: "result",
      current: cards.length,
      sessionCompleted: true,
      likedIds: ["f01", "f02", "f04", "f08", "f12", "f15", "f18", "f21", "f23", "f28"]
    };
  }
  if (demo === "gallery") {
    return { ...defaultState, route: "saved", current: cards.length, sessionCompleted: true, likedIds: cards.map((card) => card.id) };
  }
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  } catch {
    return { ...defaultState };
  }
}

function persist() {
  if (new URLSearchParams(location.search).has("demo")) return;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function setRoute(route) {
  if (route === "result" && !state.sessionCompleted) route = state.current ? "swipe" : "home";
  state.route = route;
  persist();
  render();
  requestAnimationFrame(() => app.focus({ preventScroll: true }));
}

function resetDiagnosis() {
  state = { ...defaultState, route: "swipe" };
  persist();
  render();
}

function render() {
  nav.hidden = state.route === "home" || state.route === "swipe";
  document.body.dataset.route = state.route;
  [...nav.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("is-active", button.dataset.route === state.route);
  });

  if (state.route === "home") renderHome();
  if (state.route === "swipe") renderSwipe();
  if (state.route === "result") renderResult();
  if (state.route === "saved") renderSaved();
}

function renderHome() {
  const hasProgress = state.current > 0 && !state.sessionCompleted;
  const hasResult = state.sessionCompleted;
  app.innerHTML = `
    <section class="home-screen">
      <div class="home-copy">
        <p class="eyebrow">FIND YOUR STYLE</p>
        <h1>好きから、<br><em>似合う</em>へ。</h1>
        <p class="lead">30枚のコーデを直感で選ぶだけ。あなたの好きな雰囲気を、明日使える着こなしに変えます。</p>
        <div class="home-actions">
          <button class="primary-button" type="button" id="startButton">
            ${hasProgress ? "診断を続ける" : hasResult ? "もう一度診断する" : "診断をはじめる"}
            <span aria-hidden="true">→</span>
          </button>
          ${hasResult ? '<button class="secondary-button" type="button" data-route="result">前回の結果を見る</button>' : ""}
        </div>
        <div class="quick-facts" aria-label="診断について">
          <span><strong>30</strong> looks</span>
          <span><strong>2</strong> choices</span>
          <span><strong>3</strong> min</span>
        </div>
      </div>
      <div class="home-collage" aria-hidden="true">
        ${cards.slice(0, 3).map((card, index) => `<img class="collage-${index + 1}" src="${card.image}" alt="" loading="eager">`).join("")}
        <span class="floating-like">LIKE <b>♡</b></span>
      </div>
    </section>
  `;

  document.getElementById("startButton").addEventListener("click", () => {
    if (hasResult) resetDiagnosis();
    else setRoute("swipe");
  });
  bindRouteButtons();
}

function renderSwipe() {
  if (state.current >= cards.length) {
    state.sessionCompleted = true;
    state.route = "result";
    persist();
    renderResult();
    return;
  }

  const card = cards[state.current];
  const nextCard = cards[state.current + 1];
  const progress = Math.round((state.current / cards.length) * 100);

  app.innerHTML = `
    <section class="swipe-screen">
      <div class="swipe-heading">
        <div>
          <p class="eyebrow">QUICK TASTE</p>
          <h1>直感で選んで</h1>
        </div>
        <span class="counter"><b>${String(state.current + 1).padStart(2, "0")}</b> / ${cards.length}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-label="診断の進捗" aria-valuenow="${state.current}" aria-valuemin="0" aria-valuemax="${cards.length}">
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
    const rotate = deltaX / 22;
    card.style.transform = `translateX(${deltaX}px) rotate(${rotate}deg)`;
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
  const card = cards[state.current];
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
  const profile = calculateProfile(cards, state.likedIds);
  const recommendations = selectRecommendations(cards, state.likedIds, 4);
  const likedPhotos = cards.filter((card) => state.likedIds.includes(card.id)).slice(0, 3);
  const tags = profile.topTags.length ? profile.topTags : [
    { tag: "これから発見", percent: 35 },
    { tag: "ニュートラル", percent: 24 },
    { tag: "自由", percent: 18 }
  ];

  app.innerHTML = `
    <section class="result-screen">
      <div class="result-hero">
        <div class="result-copy">
          <p class="eyebrow">YOUR STYLE DNA</p>
          <p class="result-kicker">あなたのスタイルは</p>
          <h1>${profile.archetype.name}</h1>
          <p>${profile.archetype.description}</p>
          <div class="tag-row">${tags.slice(0, 3).map((item) => `<span># ${item.tag}</span>`).join("")}</div>
        </div>
        <div class="result-photo-stack" aria-label="好きに選んだコーデ">
          ${likedPhotos.length ? likedPhotos.map((card, index) => `<img style="--i:${index}" src="${card.image}" alt="${card.label}">`).join("") : `<div class="empty-photo">次の診断で<br>好きを見つけよう</div>`}
        </div>
      </div>

      <div class="result-grid">
        <section class="result-panel taste-panel">
          <div class="section-title">
            <div><p class="eyebrow">TASTE BALANCE</p><h2>選んだ雰囲気</h2></div>
            <span>${profile.likedCount} / ${cards.length} LIKE</span>
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
            ${profile.archetype.recipe.map((item, index) => `<li><span>0${index + 1}</span><b>${adjustRecipe(item, state.occasion)}</b></li>`).join("")}
          </ol>
          <button class="dark-button" type="button" id="saveRecipeButton">この組み合わせを保存 <span>＋</span></button>
        </section>
      </div>

      <section class="recommend-section">
        <div class="section-title">
          <div><p class="eyebrow">NEXT LOOKS</p><h2>次に好きそうなコーデ</h2></div>
          <button class="text-button" type="button" id="restartButton">診断し直す</button>
        </div>
        <div class="recommend-grid">
          ${recommendations.map((card) => `
            <button type="button" class="recommend-card" data-save-id="${card.id}">
              <img src="${card.image}" alt="${card.label}" loading="lazy">
              <span>${card.label}<b>♡</b></span>
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
  document.querySelectorAll("[data-save-id]").forEach((button) => {
    button.addEventListener("click", () => saveRecommendation(button.dataset.saveId));
  });
  document.getElementById("saveRecipeButton").addEventListener("click", () => showToast("基本コーデを保存しました"));
  document.getElementById("restartButton").addEventListener("click", resetDiagnosis);
}

function adjustRecipe(item, occasion) {
  if (occasion === "通勤・通学") return item.replace("シューズ", "きれいめシューズ").replace("トップス", "清潔感のあるトップス");
  if (occasion === "デート") return item.replace("小物", "印象に残る小物").replace("トップス", "表情のあるトップス");
  return item;
}

function saveRecommendation(id) {
  if (!state.likedIds.includes(id)) state.likedIds.push(id);
  persist();
  showToast("好きなコーデに追加しました");
  renderResult();
}

function renderSaved() {
  const saved = cards.filter((card) => state.likedIds.includes(card.id));
  app.innerHTML = `
    <section class="saved-screen">
      <div class="page-heading">
        <p class="eyebrow">MY COLLECTION</p>
        <h1>好きなコーデ</h1>
        <p>${saved.length ? `${saved.length}件の「好き」から、あなたの雰囲気を育てています。` : "右にスワイプしたコーデがここに残ります。"}</p>
      </div>
      ${saved.length ? `
        <div class="saved-grid">
          ${saved.map((card) => `
            <article class="saved-card">
              <img src="${card.image}" alt="${card.label}" loading="lazy">
              <div><h2>${card.label}</h2><p>${card.tags.slice(0, 3).join(" · ")}</p></div>
              <button type="button" data-remove-id="${card.id}" aria-label="${card.label}を削除">×</button>
            </article>`).join("")}
        </div>
        <button class="primary-button collection-result" type="button" data-route="result">この好みからコーデを作る <span>→</span></button>
      ` : `
        <div class="empty-state">
          <span>♡</span><h2>まだ「好き」がありません</h2>
          <p>気になるコーデを右にスワイプしてみましょう。</p>
          <button class="primary-button" type="button" data-route="swipe">診断をはじめる <span>→</span></button>
        </div>`}
    </section>
  `;
  document.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.likedIds = state.likedIds.filter((id) => id !== button.dataset.removeId);
      persist();
      renderSaved();
    });
  });
  bindRouteButtons();
}

function bindRouteButtons() {
  document.querySelectorAll("[data-route]").forEach((button) => {
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
  if (state.route !== "swipe" || event.repeat) return;
  if (event.key === "ArrowLeft") animateChoice("no");
  if (event.key === "ArrowRight") animateChoice("like");
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

render();
