const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { discoverShops } = require("./places.js");
const { createCloudApi, fashionclipStatus } = require("./cloud-api.js");
const cloud = createCloudApi();
const { readLocalCatalog } = require('./local-catalog.js');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {
  ".ttf": "font/ttf",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const sendJson = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
};
let placesBusy = false;
let lastSearchAt = 0;
let cloudRequests = 0;
let cloudWindowStart = Date.now();
http.createServer(async (request, response) => {
  const apiPath = (request.url || '').split('?')[0];
  if (apiPath === '/api/fashionclip/catalog' && request.method === 'GET') {
    if (request.headers['sec-fetch-site'] === 'cross-site' || request.headers.origin &&
      !['http://127.0.0.1:' + port, 'http://localhost:' + port].includes(request.headers.origin))
      return sendJson(response, 403, { error: 'Origin not allowed' });
    return sendJson(response, 200, readLocalCatalog());
  }
  if (apiPath === '/api/fashionclip/status' && request.method === 'GET') {
    return sendJson(response, 200, await fashionclipStatus());
  }
  if (apiPath.startsWith('/api/cloud/') || apiPath === '/api/swipes') {
    if (request.headers.origin && !['http://127.0.0.1:' + port, 'http://localhost:' + port].includes(request.headers.origin)) {
      return sendJson(response, 403, { error: 'Origin not allowed' });
    }
    if (request.headers['sec-fetch-site'] === 'cross-site') return sendJson(response, 403, { error: 'Cross-site request blocked' });
    if (Date.now() - cloudWindowStart > 60000) { cloudWindowStart = Date.now(); cloudRequests = 0; }
    if (++cloudRequests > 120) return sendJson(response, 429, { error: 'Too many cloud requests; retry later' });
    try {
      let input = {};
      if (['POST', 'DELETE'].includes(request.method)) {
        if ((request.headers['content-type'] || '').split(';')[0] !== 'application/json')
          return sendJson(response, 415, { error: 'Use application/json' });
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > 8192) return sendJson(response, 413, { error: 'Request too large' });
        }
        input = JSON.parse(body);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SyntaxError('Invalid input');
      }
      const result = await cloud.handle(apiPath, request.method, input, request.headers.authorization);
      return sendJson(response, result.status, result.body);
    } catch {
      return sendJson(response, 400, { error: 'Invalid request' });
    }
  }
  if (request.url === "/api/shops/status" && request.method === "GET") {
    return sendJson(response, 200, { configured: Boolean(process.env.GOOGLE_PLACES_API_KEY) });
  }
  if (request.url === "/api/shops/search" && request.method === "POST") {
    if (request.headers.origin && !["http://127.0.0.1:" + port, "http://localhost:" + port].includes(request.headers.origin)) {
      return sendJson(response, 403, { error: "Origin not allowed" });
    }
    if (!process.env.GOOGLE_PLACES_API_KEY) return sendJson(response, 200, { status: "unconfigured", shops: [] });
    if (placesBusy || Date.now() - lastSearchAt < 10000) {
      return sendJson(response, 429, { error: "少し待ってから検索してください。" });
    }
    placesBusy = true;
    lastSearchAt = Date.now();
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) throw new Error("検索条件が長すぎます。");
      }
      const input = JSON.parse(body);
      return sendJson(response, 200, await discoverShops(input, { apiKey: process.env.GOOGLE_PLACES_API_KEY }));
    } catch (error) {
      return sendJson(response, 502, { error: error instanceof SyntaxError ? "検索条件が不正です。" : error.message });
    } finally {
      placesBusy = false;
    }
  }
  if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" });
  let rawPath;
  try { rawPath = decodeURIComponent((request.url || "/").split("?")[0]); }
  catch { return sendJson(response, 400, { error: "Invalid path" }); }
  const requested = rawPath === "/" ? "/index.html" : rawPath;
  const filePath = path.normalize(path.join(root, requested));

  const relativePath = path.relative(root, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).some((part) => part.startsWith(".")) ||
      ['fashionclip_service', 'supabase', 'scripts', 'python_tests', 'tests', 'node_modules'].includes(relativePath.split(/[\\/]/)[0]) ||
      ['server.js', 'cloud-api.js', 'local-catalog.js'].includes(relativePath) || /\.(sqlite3?|db|env|py)$/i.test(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`KONOMI is running at http://127.0.0.1:${port}`);
});
