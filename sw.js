const cacheName = "konomi-shell-v69";
const shell = ["./", "./index.html", "./local-preview.js", "./preview.html", "./preview.js", "./preview.css", "./styles.css", "./ui-refresh.css", "./minimal-theme.css", "./brand-directory.css", "./brand-feed.css", "./photo-audience.js", "./brand-diagnosis.js", "./app-bootstrap.js", "./typography.css", "./assets/fonts/NotoSansJP-Variable.ttf", "./assets/fonts/Manrope-Variable.ttf", "./photo-analysis.js", "./assets/photo-analysis.json", "./assets/brand-diagnosis-catalog.json", "./assets/vintage-brand-photos.json", "./generated-outfits.js", "./diagnosis-pool.js", "./data.js", "./specialist-brands.js", "./products.js", "./brand-directory.js", "./brand-feed.js", "./shops.js", "./recommendations.js", "./logic.js", "./fresh-feed.js", "./wardrobe.js", "./feed-ui.js", "./app.js", "./credits.html", "./credits.css", "./credits.js", "./icon.svg", "./manifest.webmanifest"];
shell.push("./cloud-sync.js");
shell.push("./free-shop-directory.js");
shell.push("./shop-review-audit.js");
shell.push("./fashion-preference.js");
shell.push("./fashion-analysis.css");

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(shell)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
