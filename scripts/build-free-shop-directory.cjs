const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = require(path.join(root, 'assets', 'shimofuru-research.json'));
const checkedAt = source.researchedAt;
const decode = (value) => value.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const clean = (value) => decode(value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
const rules = [
  ['アメカジ', /アメカジ|アメリカ|アメリカンヴィンテージ|US古着|米国古着|ラルフローレン|Levi.s|リーバイス/i],
  ['ヨーロッパ古着', /ヨーロッパ|ユーロ|欧州|英国|フランス古着|イギリス古着/i],
  ['ミリタリー', /ミリタリー|軍物|軍モノ|軍服/i],
  ['ワーク', /ワークウェア|ワーク|カーハート/i],
  ['デニム', /デニム|ジーンズ|ジーパン/i],
  ['Y2K', /Y2K/i],
  ['レトロ', /レトロ|昭和|アンティーク|60.s|70.s|1950|1960|1970/i],
  ['アウトドア', /アウトドア|ゴープコア/i],
  ['スポーティ', /スポーツ|スポーティ|ユニフォーム/i],
  ['ロック', /ロック|パンク|バンドT|レザージャケット/i],
  ['ガーリー', /ガーリー|ファンシー|レース|フリル/i],
  ['ストリート', /ストリート|スケート|スケボー|ヒップホップ/i],
  ['モード', /モード|デザイナーズ|アーカイブ|ドメスティック/i],
  ['きれいめ', /きれいめ|トラッド|アイビー|セットアップ/i],
  ['個性的', /個性派|変わり種|柄物|一点物/i],
  ['ブランド古着', /ブランド古着|ハイブランド|ラグジュアリー/i],
  ['ヴィンテージ', /ヴィンテージ|ビンテージ|vintage/i],
  ['カジュアル', /カジュアル|レギュラー|日常着/i],
];
const categoryTag = { '個性派': '個性的', 'シンプル': 'ミニマル', 'フェミニン': 'フェミニン', 'ガーリー': 'ガーリー', 'ストリート': 'ストリート', 'モード': 'モード', 'カジュアル': 'カジュアル', 'ヴィンテージ': 'ヴィンテージ', 'ブランド古着': 'ブランド古着' };
function tagsFor(text, categories = [], genres = []) {
  const specific = rules.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag);
  const broad = [...categories, ...genres].map((tag) => categoryTag[tag]).filter(Boolean);
  return [...new Set([...specific, ...broad])].slice(0, 6);
}
function summary(tags) {
  return tags.length ? `公開されている店舗情報では${tags.slice(0, 3).join('・')}系の取り扱いが見られます。` : '公開情報だけでは服の系統を判断できません。';
}
const shops = source.shops.filter((item) => item.title && item.area.length).map((item) => {
  const text = item.description;
  const tags = tagsFor(text, item.categories, item.genres);
  const id = item.url.match(/\/shoplist\/([^/]+)\/$/)?.[1];
  const audiences = item.audience.includes('メンズ') && item.audience.includes('レディース') ? ['all']
    : item.audience.includes('メンズ') ? ['men'] : item.audience.includes('レディース') ? ['women'] : ['all'];
  return { id: `shimo-${id}`, name: item.title, type: item.goods.includes('洋服') ? '古着店' : '服飾・古着店',
    area: '下北沢', district: item.area[0].replace('エリア', ''), query: `${item.title} 下北沢`, address: item.address,
    audiences, tags, description: summary(tags), sourceUrl: item.url,
    sourceLabel: 'シモフル掲載情報', checkedAt, evidenceLevel: 'directory' };
});

async function addGuide(area, slug, expected) {
  const url = `https://avend.co.jp/column/${slug}_recommend/`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const html = await response.text();
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => match[1]);
  const rows = tables.filter((table) => table.includes('店名') && table.includes('主なジャンル'))
    .flatMap((table) => [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].slice(1)
      .map((match) => [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => clean(cell[1]))))
    .filter((row) => row.length >= 3 && row[0] !== '営業時間' && row[0] !== '主なジャンル')
    .slice(0, expected);
  if (rows.length !== expected) throw new Error(`${area}: expected ${expected}, got ${rows.length}`);
  rows.forEach((row, index) => {
    const name = row[0];
    const genre = area === '原宿' ? row[2] : row[1];
    const district = area === '原宿' ? row[1] : '';
    const extra = area === '原宿' ? row[3] || '' : '';
    const tags = tagsFor(`${genre} ${extra}`);
    shops.push({ id: `${slug}-${String(index + 1).padStart(2, '0')}`, name, type: '古着店', area, district,
      query: `${name} ${area}`, audiences: /レディース|女性/.test(`${genre} ${extra}`) && !/メンズ/.test(`${genre} ${extra}`) ? ['women'] : ['all'],
      tags, description: summary(tags), sourceUrl: url, sourceLabel: '店舗ガイド掲載情報', checkedAt, evidenceLevel: 'guide' });
  });
}

(async () => {
  await addGuide('高円寺', 'kouennji', 35);
  await addGuide('原宿', 'harajuku', 38);
  await addGuide('吉祥寺', 'kichijyouji', 40);
  fs.writeFileSync(path.join(root, 'free-shop-directory.js'),
    `// Curated style leads from public shop profiles; stock and operating status need reconfirmation.\n(function () {\n  window.KONOMI_FREE_SHOPS = ${JSON.stringify(shops, null, 2)};\n})();\n`);
  process.stdout.write(`${shops.length} shops: ${Object.entries(Object.groupBy(shops, (shop) => shop.area)).map(([area, list]) => `${area} ${list.length}`).join(', ')}\n`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
