// One-off research aid: collect public shop profile facts from Shimofuru.
// Do not fetch Google Maps pages or reviews here.
const fs = require('node:fs');
const path = require('node:path');

const base = 'https://shimofuru.jp';
const decode = (value) => value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const clean = (value) => decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
const section = (html, heading) => {
  const at = html.indexOf(`<h3>${heading}</h3>`);
  if (at < 0) return [];
  const end = html.indexOf('</div>', at);
  return [...html.slice(at, end).matchAll(/<a\b[^>]*>(.*?)<\/a>/gs)].map((match) => clean(match[1]));
};
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'KonomiResearch/1.0 (public shop profile audit)' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}
async function main() {
  const index = await get(`${base}/shoplist/`);
  const urls = [...new Set([...index.matchAll(/href="(https:\/\/shimofuru\.jp\/shoplist\/[^"#?]+\/?)"/g)]
    .map((match) => match[1]).filter((url) => url !== `${base}/shoplist/`))];
  const shops = [];
  for (let i = 0; i < urls.length; i += 3) {
    const batch = await Promise.allSettled(urls.slice(i, i + 3).map(async (url) => {
      const html = await get(url);
      const title = clean(html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1] || '');
      const entry = html.match(/<div class="entry-content[^>]*>([\s\S]*?)<!-- staffコメント -->/)?.[1] || '';
      const description = clean(entry).slice(0, 550);
      const address = clean(html.match(/東京都世田谷区[^<\r\n]+/)?.[0] || '');
      return { title, url, description, address,
        area: section(html, 'エリア'), audience: section(html, '店舗ジャンル'),
        goods: section(html, '取扱商品'), categories: section(html, '商品カテゴリー'),
        genres: section(html, '商品ジャンル'), countries: section(html, '古着の国'),
        decades: section(html, '古着の主な年代') };
    }));
    batch.forEach((result, offset) => {
      if (result.status === 'fulfilled') shops.push(result.value);
      else process.stderr.write(`${urls[i + offset]}: ${result.reason}\n`);
    });
    if (i + 3 < urls.length) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'shimofuru-research.json'),
    JSON.stringify({ source: `${base}/shoplist/`, researchedAt: new Date().toISOString().slice(0, 10), shops }, null, 2) + '\n');
  process.stdout.write(`Found ${urls.length}; saved ${shops.length}\n`);
}
main().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
