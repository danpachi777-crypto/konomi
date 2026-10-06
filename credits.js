(async function () {
  const grid = document.getElementById("creditsGrid");
  const count = document.getElementById("photoCount");
  const error = document.getElementById("creditsError");

  function addLink(container, label, href) {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    container.append(link);
  }

  try {
    const response = await fetch("assets/photo-sources.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();

    count.textContent = `${manifest.items.length}枚・取得確認 ${manifest.generatedAt}`;
    manifest.items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "credit-card";

      const image = document.createElement("img");
      image.src = item.localPath;
      image.alt = item.description;
      image.loading = "lazy";

      const copy = document.createElement("div");
      copy.className = "credit-copy";

      const kind = document.createElement("p");
      kind.className = "credit-kind";
      kind.textContent = `診断・結果写真 · ${item.audience === "men" ? "メンズ" : "ウィメンズ"}`;

      const description = document.createElement("p");
      description.className = "credit-description";
      description.textContent = item.description;

      const meta = document.createElement("p");
      meta.className = "credit-meta";
      meta.textContent = `Photo: ${item.creator} · ${item.category}`;

      const links = document.createElement("div");
      links.className = "credit-links";
      addLink(links, "原典を見る", item.sourcePage);
      addLink(links, item.license, item.licenseUrl);

      copy.append(kind, description, meta, links);
      card.append(image, copy);
      grid.append(card);
    });
  } catch (cause) {
    console.error(cause);
    count.textContent = "読み込み失敗";
    error.hidden = false;
  }
})();
