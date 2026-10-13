const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = require('../brand-directory.js');

const output = path.join(__dirname, '..', 'assets', 'brand-photos.json');
const diagnosisOutput = path.join(__dirname, '..', 'assets', 'brand-diagnosis-catalog.json');
const { packCatalog } = require('../brand-diagnosis.js');
const MAX_PHOTOS = 40;
const decode = (value) => String(value || '').replace(/&#x3D;|&#61;/gi, '=').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#39;|&#x27;/gi, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const absolute = (value, base) => {
  try {
    const url = new URL(decode(value), base);
    return url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
  .map((match) => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4])]));
const imageUrl = (value, base) => {
  if (value && typeof value === 'object') value = value.url || value.contentUrl;
  const url = absolute(Array.isArray(value) ? value[0] : value, base);
  return !/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url) &&
    !/^https:\/\/dtcralphlauren\.scene7\.com\/is\/image\/PoloGSI\//i.test(url) ||
    /(?:logo|icon|sprite|placeholder|pixel|checkout|footer|pagetop|flink_|\/og(?:_|\.)|loading\.png|item_thumb\.jpg)/i.test(url) ? '' : url;
};
const apparelTerms = /shirt|tee|top|blouse|knit|sweater|cardigan|jacket|coat|outer|pants|trouser|denim|jeans|skirt|dress|vest|hoodie|sweat|parka|fleece|salopette|suit|blazer|wear|シャツ|トップス|ブラウス|ニット|セーター|カーディガン|ジャケット|コート|アウター|パンツ|デニム|スカート|ワンピース|ベスト|パーカー|スウェット|セットアップ|カットソー|トレーナー|サロペット|ブルゾン|ジレ|フリース|トレンチ|Tシャツ|ロンT/i;
const nonApparelTerms = /sock|scarf|hat|cap|bag|pouch|shoe|boot|sneaker|wallet|jewel|bracelet|necklace|earring|candle|vase|chair|home|gift|food|sardine|baby|kids|children|accessor|マフラー|スカーフ|帽子|キャップ|バッグ|ポーチ|シューズ|ブーツ|スニーカー|財布|アクセサリー|ピアス|ネックレス|ソックス|靴下|雑貨|家具|食品|ギフト|キッズ|ベビー/i;
const isApparel = (title, category = '') => {
  const text = `${title} ${category}`;
  return apparelTerms.test(text) && !nonApparelTerms.test(text);
};
const normalizedName = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/g, '');
const idFor = (brand, image) => crypto.createHash('sha1').update(`${brand}\0${image}`).digest('hex').slice(0, 16);

function parsePage(html, pageUrl, brand) {
  const photos = [];
  const seen = new Set();
  function add(image, title, productUrl, sourceType) {
    const url = imageUrl(image, pageUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    photos.push({ id: idFor(brand, url), image: url, title: String(title || brand).trim().slice(0, 150),
      url: absolute(productUrl, pageUrl) || pageUrl, sourceType });
  }
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((type) => /^(?:Product|ProductGroup)$/i.test(type || ''))) {
      const images = Array.isArray(node.image) ? node.image : [node.image];
      if (isApparel(node.name || '', node.category || ''))
        for (const image of images.slice(0, 3)) add(image, node.name, node.url, 'product');
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'image' && key !== 'offers') walk(value);
    }
  }
  for (const match of html.matchAll(/<script\b([^>]*\btype=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(match[2])); } catch { /* Malformed metadata is common. */ }
  }
  let ogImage = '';
  let ogTitle = '';
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attr = attributes(match[0]);
    const key = attr.property || attr.name;
    if (key === 'og:image' || key === 'twitter:image') ogImage ||= attr.content;
    if (key === 'og:title') ogTitle = attr.content || ogTitle;
  }
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (photos.length >= MAX_PHOTOS) break;
    const attr = attributes(match[0]);
    const image = imageUrl(attr['data-original'], pageUrl) ||
      imageUrl(attr['data-src'], pageUrl) || imageUrl(attr.src, pageUrl);
    if (!image || !isApparel(attr.alt || '', '') || !/\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(image)) continue;
    if (brand === 'Yohji Yamamoto POUR HOMME' && !/POUR HOMME/i.test(attr.alt || '') &&
      !/\/shop\/g\//i.test(pageUrl)) continue;
    add(image, attr.alt, pageUrl, 'editorial');
  }
  if (!photos.length && ogImage && !/(?:logo|ogp|og[_-]?image|social|share|brand-site|musinsa\.png)/i.test(ogImage))
    add(ogImage, ogTitle || brand, pageUrl, 'editorial');
  return photos.slice(0, MAX_PHOTOS);
}

// BAYCREW'S hosts several of the directory's own labels. Its listings also
// contain selected third-party products, so match the label on each item.
function parseBaycrewsListing(html, pageUrl, brand) {
  const photos = [];
  const seen = new Set();
  for (const match of html.matchAll(/<li class="item">([\s\S]*?)<\/li>/gi)) {
    const body = match[1];
    const label = decode(/<a class="brand"[^>]*>([^<]*)<\/a>/i.exec(body)?.[1] || '');
    if (normalizedName(label) !== normalizedName(brand)) continue;
    const title = decode(/<div class="itemName">([\s\S]*?)<\/div>/i.exec(body)?.[1] || '').replace(/<[^>]+>/g, '').trim();
    if (!isApparel(title, '')) continue;
    const anchor = /<a\b[^>]*class="g-itemlist-list-itemphoto"[^>]*>/i.exec(body)?.[0] || '';
    const img = /<img\b[^>]*>/i.exec(body)?.[0] || '';
    const url = absolute(attributes(anchor).href, pageUrl);
    const attr = attributes(img);
    const image = imageUrl(attr['data-original'], pageUrl) ||
      imageUrl(attr['data-src'], pageUrl) || imageUrl(attr.src, pageUrl);
    if (!url || !image || seen.has(image)) continue;
    seen.add(image);
    photos.push({ id: idFor(brand, image), image, title, url, sourceType: 'product' });
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

function parseRalphLaurenListing(html, pageUrl, brand) {
  const photos = [];
  const label = brand === 'RRL' ? 'RRL' : 'Polo Ralph Lauren';
  const seen = new Set();
  for (const match of html.matchAll(/<div\s+class="\s*grid-tile\s+js-category-grid-product[^>]*>([\s\S]*?)(?=<div\s+class="\s*grid-tile\s+js-category-grid-product|$)/gi)) {
    const body = match[1];
    const itemBrand = decode(/<div class="brand-name clearfix">\s*([^<]+)<\/div>/i.exec(body)?.[1] || '').trim();
    if (itemBrand !== label) continue;
    const anchor = /<a class="thumb-link sample-link js-pdp-link"[^>]*>/i.exec(body)?.[0] || '';
    const attr = attributes(anchor);
    if (!isApparel(attr.title || '', '')) continue;
    const image = imageUrl(/<source\b[^>]*srcset="([^"]+)/i.exec(body)?.[1], pageUrl);
    const url = absolute(attr.href, pageUrl);
    if (!image || !url || seen.has(image)) continue;
    seen.add(image);
    photos.push({ id: idFor(brand, image), image, title: attr.title, url, sourceType: 'product' });
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

function parseOfficialGallery(html, pageUrl, brand, imagePath) {
  const photos = [];
  const seen = new Set();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const attr = attributes(match[0]);
    const image = imageUrl(attr['data-original'], pageUrl) ||
      imageUrl(attr['data-src'], pageUrl) || imageUrl(attr.src, pageUrl) ||
      imageUrl(attr.title, pageUrl);
    if (!image || !imagePath.test(new URL(image).pathname) || seen.has(image)) continue;
    seen.add(image);
    photos.push({ id: idFor(brand, image), image, title: `${brand} collection`,
      url: pageUrl, sourceType: 'editorial' });
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

function parseHypebeastGallery(html, pageUrl, brand, imagePath) {
  const photos = [];
  const seen = new Set();
  for (const match of html.matchAll(/https%3A%2F%2F(?:hk\.)?hypebeast\.com%2F(?:image|files)%2F[^\s"'&<>]+?\.jpe?g/gi)) {
    const image = imageUrl(decodeURIComponent(match[0]), pageUrl);
    if (!image || !imagePath.test(new URL(image).pathname) || seen.has(image)) continue;
    seen.add(image);
    photos.push({ id: idFor(brand, image), image, title: `${brand} lookbook`,
      url: pageUrl, sourceType: 'editorial' });
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

function parseVanListing(html, pageUrl, brand) {
  const photos = [];
  for (const match of html.matchAll(/<article class="[^"]*fs-c-productListItem[^"]*"[^>]*>([\s\S]*?)<\/article>/gi)) {
    const body = match[1];
    const title = decode(/class="fs-c-productName__name"[^>]*>([\s\S]*?)<\/span>/i.exec(body)?.[1] || '')
      .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!isApparel(title)) continue;
    const anchor = /<div class="fs-c-productListItem__image[^>]*>[\s\S]*?<a\b[^>]*>/i.exec(body)?.[0] || '';
    const img = /<img\b[^>]*data-layzr=["'][^>]*>/i.exec(body)?.[0] || '';
    const url = absolute(attributes(anchor.slice(anchor.lastIndexOf('<a'))).href, pageUrl);
    const image = imageUrl(attributes(img)['data-layzr'], pageUrl);
    if (!url || !image || photos.some((photo) => photo.image === image)) continue;
    photos.push({ id: idFor(brand, image), image, title, url, sourceType: 'product' });
    if (photos.length >= MAX_PHOTOS) break;
  }
  return photos;
}

const alternateSources = {
  'VAN': [{ url: 'https://www.van.co.jp/c/shirt' }, { url: 'https://www.van.co.jp/c/jacket' }],
  'GANT': [{ url: 'https://gant.com/c/mens/clothing/shirts' }],
  'SHIPS': [{ url: 'https://wear.jp/item/?brand_id=1213&type_category_id=101' }],
  'nano・universe': [{ url: 'https://wear.jp/item/?brand_id=1095&type_category_id=101' }],
  'J.PRESS': [{ url: 'https://www.jpress.jp/pages/j-press-originals-26ss-products',
    gallery: /\/files\/250524_JPRESS_/i }],
  'Polo Ralph Lauren': [{ url: 'https://www.ralphlauren.co.jp/men/clothing/r/polo-ralph-lauren' }],
  'EDIFICE': [{ url: 'https://baycrews.jp/item/list?qPage=1&q_mcate=220&q_mccate=211&q_mshop=0394&q_mtype=0&q_sps=1' }],
  'Theory': [{ url: 'https://www.theory.co.jp/shop/item/026104002?shopCode=02' },
    { url: 'https://www.theory.co.jp/shop/item/026204001?colorCode=035&shopCode=02' }],
  'A.P.C.': [{ url: 'https://wear.jp/item/?brand_id=2477&type_category_id=101' }],
  'MACKINTOSH PHILOSOPHY': [{ url: 'https://wear.jp/item/?brand_id=12915&type_category_id=101' },
    { url: 'https://www.mackintosh-philosophy.com/contents/look/detail.php?date=20260216&gender=MEN&number=1&vol=1', gallery: /\/upload\/save_image\/look\/MEN\//i }],
  'Engineered Garments': [{ url: 'https://wear.jp/item/?brand_id=2163&type_category_id=101' }],
  'Nike': [{ url: 'https://wear.jp/item/?brand_id=1101&type_category_id=101' }],
  'Stüssy': [{ url: 'https://wear.jp/item/?brand_id=1244&type_category_id=101' }],
  'Nigel Cabourn': [{ url: 'https://wear.jp/item/?brand_id=9378&type_category_id=101' },
    { url: 'https://www.outerlimits.co.jp/pages/nigel-cabourn' }],
  'RRL': [{ url: 'https://www.ralphlauren.co.jp/men/clothing/r/double-rl' }],
  'The Real McCoy’s': [{ url: 'https://therealmccoys.com/collections/the-real-mccoys' }],
  'Buzz Rickson’s': [{ url: 'https://wear.jp/men-item/?brand_id=5791&category_id=2218&type_category_id=108' },
    { url: 'https://store.toyo-enterprise.co.jp/buzzricksons' }],
  'SAINT JAMES': [{ url: 'https://st-james.jp/collections/shirts' }],
  'adidas Originals': [{ url: 'https://wear.jp/item/?brand_id=2033&type_category_id=101' }],
  'Y-3': [{ url: 'https://wear.jp/item/?brand_id=2694&type_category_id=101' }],
  'PUMA': [{ url: 'https://wear.jp/item/?brand_id=1152&type_category_id=101' }],
  'Patagonia': [{ url: 'https://wear.jp/item/?brand_id=2726&type_category_id=108' }],
  'Snow Peak Apparel': [{ url: 'https://wear.jp/item/?brand_id=20883&type_category_id=108' }],
  'Goldwin': [{ url: 'https://www.goldwin.co.jp/ap/item/i/m/GL26331' }],
  'Supreme': [{ url: 'https://wear.jp/item/?brand_id=2664&type_category_id=101' },
    { url: 'https://hypebeast.com/2026/8/supreme-fall-winter-2026-collection',
      hypebeastGallery: /\/supreme-fall-winter-2026-collection-\d+\.jpg/i }],
  'XLARGE': [{ url: 'https://wear.jp/item/?brand_id=1346&type_category_id=101' }],
  'Yohji Yamamoto POUR HOMME': [{ url: 'https://theshopyohjiyamamoto.jp/shop/g/gHW-J11-834-1-02/',
    photoPath: /\/img\/goods\/HW-J11-834\//i },
    { url: 'https://theshopyohjiyamamoto.com/collections/outerwear/men' }],
  'COMME des GARÇONS HOMME PLUS': [
    { url: 'https://ginza.doverstreetmarket.com/pages/comme-des-garcons-homme-plus' },
    { url: 'https://www.vogue.com/fashion-shows/spring-2026-menswear/comme-des-garcons-homme-plus/slideshow/collection' },
    { url: 'https://www.farfetch.com/uk/shopping/men/comme-des-garcons-homme-plus-single-breasted-jacket-item-32068212.aspx' },
    { url: 'https://www.endclothing.com/jp/comme-des-garcons-homme-plus-stripe-shirt-with-lace-inlay-pr-b006-051-1.html' },
    { url: 'https://www.endclothing.com/jp/comme-des-garcons-homme-pluss-cotton-shirt-with-overlay-pr-b013-051-1.html' },
    { url: 'https://www.endclothing.com/jp/comme-des-garcons-homme-plus-dobby-cloth-asymetric-blazer-pr-j014-051-1.html' },
    { url: 'https://www.endclothing.com/jp/comme-des-garcons-homme-pluss-wool-gabardine-pleated-pant-pr-p044-051-1.html' },
    { url: 'https://www.endclothing.com/jp/comme-des-garcons-homme-plus-garment-dyed-blazer-pz-j008-051-1.html' }
  ],
  'COS': [{ url: 'https://wear.jp/item/?brand_id=20691&type_category_id=101' }],
  'MUSINSA STANDARD': [{ url: 'https://wear.jp/item/?brand_id=36897&type_category_id=101' }],
  'Uniqlo U': [{ url: 'https://www.uniqlo.com/jp/ja/products/E486816-000/00' },
    { url: 'https://www.uniqlo.com/jp/ja/contents/collaboration/uniqlo-u/24fw/lookbook/',
      gallery: /\/lookbookItems-jp\/lookbook-[0-9]+\.jpg/i }],
  'green label relaxing': [{ url: 'https://wear.jp/item/?brand_id=924&type_category_id=101' }],
  'coen': [{ url: 'https://wear.jp/item/?brand_id=12061&type_category_id=101' }],
  'INSILENCE': [{ url: 'https://wear.jp/item/?brand_id=30141&type_category_id=101' }],
  'LIFUL': [{ url: 'https://www.musinsa.com/products/852156' },
    { url: 'https://www.musinsa.com/products/1010410' },
    { url: 'https://www.musinsa.com/products/1861080' },
    { url: 'https://www.musinsa.com/products/1148949' },
    { url: 'https://hypebeast.com/2020/5/liful-minimal-garments-summer-2020-collection-liful-summer-2020-life-is-beautiful-lookbook',
      hypebeastGallery: /\/liful-minimal-garments-summer-2020-life-beautiful-collection\d+\.jpg/i },
    { url: 'https://hypebeast.com/zh/2020/2/liful-minimal-garments-spring-summer-2020-lookbook',
      hypebeastGallery: /\/liful-spring-summer-2020-collection-lookbook-\d+\.jpg/i }],
  'niko and ...': [{ url: 'https://wear.jp/item/?brand_id=17094&type_category_id=101' }],
  'GAP': [{ url: 'https://wear.jp/item/?brand_id=2579&type_category_id=101' }],
  'UNIQLO': [{ url: 'https://www.uniqlo.com/jp/ja/products/E476018-000/00' },
    { url: 'https://www.uniqlo.com/jp/ja/products/E448034-000/00' },
    { url: 'https://www.uniqlo.com/jp/ja/contents/feature/lifewear-collection/bottoms/' }],
  'Traditional Weatherwear': [{ url: 'https://wear.jp/item/?brand_id=11387&type_category_id=101' }],
  'MAJESTIC LEGON': [{ url: 'https://wear.jp/item/?brand_id=12741&type_category_id=101' }],
  'X-girl': [{ url: 'https://wear.jp/item/?brand_id=1344&type_category_id=101' }],
  'IÉNA': [{ url: 'https://baycrews.jp/item/list/ladys?qPage=1' }],
  'NOBLE': [{ url: 'https://baycrews.jp/item/list/noble/ladys?q_minout=1' }],
  'J.PRESS LADIES': [{ url: 'https://www.jpress.jp/pages/pre-fall-j-press-ladies', gallery: /\/t\/3\/assets\/pf-/i }],
  'MARGARET HOWELL': [{ url: 'https://www.margarethowell.jp/lookbook-archive/lookbook-summer2026.html', gallery: /\/images\/lookbook/i }],
  'MHL.': [{ url: 'https://www.margarethowell.jp/spring-shirts-mhl.html', gallery: /\/images\/column\/springshirts2025\//i }],
  'ENFÖLD': [{ url: 'https://enfold.jp/', gallery: /\/lookbook\/2026_fall_winter\/img\/index\//i }],
  'MM6 Maison Margiela': [{ url: 'https://wear.jp/women-item/?brand_id=33668&type_category_id=108' }],
  'SNIDEL': [{ url: 'https://wear.jp/item/?brand_id=3823&type_category_id=101' }],
  'FURFUR': [{ url: 'https://usagi-online.com/brand/furfur/' }],
  'jouetie': [{ url: 'https://wear.jp/item/?brand_id=12093&type_category_id=101' },
    { url: 'https://jouetie.com/lookbook/2026-may-look/', gallery: /\/wp-content\/uploads\//i }],
  'CHUMS': [{ url: 'https://wear.jp/item/?brand_id=2117&type_category_id=101' }],
  'HYSTERIC GLAMOUR': [{ url: 'https://wear.jp/item/?brand_id=947&type_category_id=101' }],
  'Zadig & Voltaire': [{ url: 'https://wear.jp/item/?brand_id=14646&type_category_id=101' }],
  'GYDA': [{ url: 'https://wear.jp/item/?brand_id=12594&type_category_id=101' }],
  'SLY': [{ url: 'https://wear.jp/item/?brand_id=2656&type_category_id=101' }],
  'AVIREX': [{ url: 'https://wear.jp/item/?brand_id=2075&type_category_id=101' }],
  'RNA-N': [{ url: 'https://wear.jp/item/?brand_id=3169&type_category_id=101' }],
  'and wander': [{ url: 'https://www.andwander.com/catalog-2026ss.html', gallery: /\/assets\/images\/catalog\/26ss\//i }]
};

// These listings are constrained by WEAR's brand ID. They supplement sparse
// first-party pages without mixing similarly named labels or retailers.
const wearBrandIds = {
  'Brooks Brothers': 5721,
  'BEAMS PLUS': 770,
  'Polo Ralph Lauren': 2714,
  'UNITED ARROWS': 1301,
  'EDIFICE': 862,
  'RRL': 10365,
  'agnès b.': 3674,
  'Goldwin': 29315,
  'Dickies': 2974,
  'GLOBAL WORK': 12347,
  'BEAMS BOY': 767,
  'J.PRESS LADIES': 12657,
  'MARGARET HOWELL': 2643,
  'CLANE': 23542,
  'Yohji Yamamoto': 11950,
  'FURFUR': 902,
  'LILY BROWN': 12469,
  'IÉNA': 951,
  'Demi-Luxe BEAMS': 1004,
  'MHL.': 4247,
  'Vivienne Westwood': 2689,
  'AllSaints': 14590,
  'Columbia': 2531,
  'VAN': 3282,
  'Theory': 2672,
  'Armor-lux': 5184,
  'Yohji Yamamoto POUR HOMME': 14077,
  'COMME des GARÇONS HOMME PLUS': 3604,
  'UNIQLO': 14127
};

function parseUnitedArrowsListing(html, pageUrl, brand) {
  const photos = [];
  const section = html.split('id="itemThumbList"')[1] || '';
  for (const match of section.matchAll(/<li\b([^>]*\bitemAll\b[^>]*)>([\s\S]*?)<\/li>/gi)) {
    if (photos.length >= MAX_PHOTOS) break;
    const category = match[1];
    if (!/(?:tops|outerwear|bottoms|suits)/i.test(category)) continue;
    const body = match[2];
    const label = decode(/class="itemThumbListLabel"[^>]*>([^<]*)/i.exec(body)?.[1] || '');
    if (!normalizedName(label).includes(normalizedName(brand))) continue;
    const anchor = /<a\b[^>]*class="imgA"[^>]*>/i.exec(body)?.[0] || '';
    const image = /<img\b[^>]*class="number0"[^>]*>/i.exec(body)?.[0] || '';
    const url = absolute(attributes(anchor).href, pageUrl);
    const src = imageUrl(attributes(image).src, pageUrl);
    if (url && src) photos.push({ id: idFor(brand, src), image: src, title: `${brand}の服`,
      url, sourceType: 'product' });
  }
  return photos;
}

async function fetchText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KONOMI-catalog/1.0)', Accept: 'text/html,application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > 8_000_000) throw new Error('Response too large');
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error('Response too large');
  return { body, url: response.url || url };
}

async function collectSource(source, fetchImpl = fetch, tryAlternates = true) {
  const record = { brand: source.brand, sourceUrl: source.sourceUrl, styleIds: source.styleIds,
    photos: [], status: 'unavailable' };
  try {
    const page = await fetchText(source.sourceUrl, fetchImpl);
    record.photos = page.url.includes('baycrews.jp/item/list')
      ? parseBaycrewsListing(page.body, page.url, source.brand)
      : page.url.includes('ralphlauren.co.jp/men/clothing/r/')
        ? parseRalphLaurenListing(page.body, page.url, source.brand)
        : page.url.includes('van.co.jp/c/')
          ? parseVanListing(page.body, page.url, source.brand)
        : parsePage(page.body, page.url, source.brand);
    if (source.gallery) {
      const gallery = parseOfficialGallery(page.body, page.url, source.brand, source.gallery);
      if (gallery.length) record.photos = gallery;
    }
    if (source.hypebeastGallery) record.photos = parseHypebeastGallery(page.body, page.url, source.brand, source.hypebeastGallery);
    if (source.photoPath)
      record.photos = record.photos.filter((photo) => source.photoPath.test(new URL(photo.image).pathname));
    // Shopify's published storefront catalog supplies individual product images.
    // Use it only on a brand's own storefront, so a shared retailer cannot leak other brands.
    const brandStore = !/\/brand\/|\/brands[-/]|\/beams(?:plus|boy)|\/demiluxebeams|\/campaign\//i.test(new URL(source.sourceUrl).pathname);
    if (brandStore && /cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(page.body)) {
      try {
        const storefront = await fetchText(new URL('/products.json?limit=250', page.url).href, fetchImpl);
        const products = JSON.parse(storefront.body).products;
        if (Array.isArray(products)) {
          const seen = new Set(record.photos.map((photo) => photo.image));
          const productPhotos = [];
          for (const product of products) {
            if (!isApparel(product.title || '', product.product_type || '')) continue;
            const brandName = normalizedName(source.brand);
            const vendor = normalizedName(product.vendor);
            if (vendor && source.brand !== 'YAECA' && !vendor.includes(brandName) && !brandName.includes(vendor)) continue;
            const image = imageUrl(product.image?.src || product.images?.[0]?.src, page.url);
            if (!image || seen.has(image)) continue;
            seen.add(image);
            productPhotos.push({ id: idFor(source.brand, image), image, title: String(product.title || source.brand).slice(0, 150),
              url: new URL(`/products/${encodeURIComponent(product.handle)}`, page.url).href, sourceType: 'product' });
            if (productPhotos.length >= MAX_PHOTOS) break;
          }
          if (productPhotos.length) record.photos = productPhotos;
        }
      } catch { /* Keep first-party page metadata when the catalog endpoint is disabled. */ }
    }
    if (!record.photos.length && ['UNITED ARROWS', 'green label relaxing'].includes(source.brand)) {
      try {
        const now = new Date();
        const season = `${now.getUTCFullYear()}${now.getUTCMonth() >= 6 ? 'autumn' : 'spring'}`;
        const code = source.brand === 'UNITED ARROWS' ? 'uam' : 'glm';
        const listing = await fetchText(`https://store.united-arrows.co.jp/s/all/preview/${season}/men/${code}/`, fetchImpl);
        record.photos = parseUnitedArrowsListing(listing.body, listing.url, source.brand);
      } catch { /* An empty source remains visible in the acquisition record. */ }
    }
    if (page.url.includes('wear.jp/') && record.photos.length < MAX_PHOTOS) {
      const seen = new Set(record.photos.map((photo) => photo.image));
      for (let pageNumber = 2; pageNumber <= 4 && record.photos.length < MAX_PHOTOS; pageNumber++) {
        try {
          const nextUrl = new URL(page.url);
          nextUrl.searchParams.set('pageno', String(pageNumber));
          const next = await fetchText(nextUrl.href, fetchImpl);
          const more = parsePage(next.body, next.url, source.brand);
          if (!more.length) break;
          for (const photo of more) if (!seen.has(photo.image) && record.photos.length < MAX_PHOTOS) {
            seen.add(photo.image);
            record.photos.push(photo);
          }
        } catch { break; }
      }
    }
    record.status = record.photos.length ? 'available' : 'no-photo';
  } catch (error) { record.error = String(error.message).slice(0, 120); }
  if (record.photos.length < MAX_PHOTOS && tryAlternates) {
    const wear = wearBrandIds[source.brand];
    const alternatives = [...(alternateSources[source.brand] || []),
      ...(source.brand === '無印良品' ? [{ url: 'https://www.muji.com/jp/ja/store/cmdty/section/S10001' },
        { url: 'https://www.muji.com/jp/ja/store/cmdty/section/S10002' }] : []),
      ...(wear ? [{ url: `https://wear.jp/item/?brand_id=${wear}&type_category_id=101` },
        { url: `https://wear.jp/item/?brand_id=${wear}&type_category_id=108` },
        { url: `https://wear.jp/item/?brand_id=${wear}&type_category_id=112` }] : [])];
    for (const alternative of alternatives) {
      const alternate = await collectSource({ ...source, sourceUrl: alternative.url,
        gallery: alternative.gallery, photoPath: alternative.photoPath,
        hypebeastGallery: alternative.hypebeastGallery }, fetchImpl, false);
      if (!alternate.photos.length) continue;
      const seen = new Set(record.photos.map((photo) => photo.image));
      const combined = [...record.photos, ...alternate.photos.filter((photo) => !seen.has(photo.image))];
      record.photos = combined.slice(0, MAX_PHOTOS);
      record.status = 'available';
      record.alternateSourceUrl = alternative.url;
      delete record.error;
      if (record.photos.length >= MAX_PHOTOS) break;
    }
  }
  if (source.brand === 'Theory' && record.photos.length < MAX_PHOTOS && tryAlternates) {
    const productIds = new Set();
    for (const shopCode of ['02', '01']) for (const category of ['JK', 'PT', 'NT', 'CD', 'ST', 'CS', 'OP']) {
      if (productIds.size >= 20) break;
      try {
        const listing = await fetchText(`https://www.theory.co.jp/shop/itemList?shopCode=${shopCode}&largeCategoryCode=${category}`, fetchImpl);
        for (const match of listing.body.matchAll(/gtmProductIdList\.push\(["'](0[12]_[0-9]{7})["']\)/g))
          productIds.add(match[1]);
      } catch { /* Keep independently verified photos. */ }
    }
    const seen = new Set(record.photos.map((photo) => photo.image));
    for (const id of productIds) {
      if (record.photos.length >= MAX_PHOTOS) break;
      const [shopCode, productCode] = id.split('_');
      const productUrl = `https://www.theory.co.jp/shop/item/${shopCode}${productCode}?shopCode=${shopCode}`;
      try {
        const page = await fetchText(productUrl, fetchImpl);
        for (const photo of parsePage(page.body, page.url, source.brand)) {
          if (seen.has(photo.image)) continue;
          seen.add(photo.image);
          record.photos.push(photo);
          if (record.photos.length >= MAX_PHOTOS) break;
        }
      } catch { /* A retired product does not invalidate the others. */ }
    }
    if (record.photos.length) record.status = 'available';
  }
  return record;
}

function sourcesFromDirectory() {
  const byName = new Map();
  for (const group of directory.groups) for (const brand of group.brands) {
    const item = byName.get(brand.name) || { brand: brand.name, sourceUrl: brand.url, styleIds: [] };
    item.styleIds.push(group.styleId);
    byName.set(brand.name, item);
  }
  return [...byName.values()];
}

async function buildCatalog({ fetchImpl = fetch, concurrency = 3, log = console.log,
  previous = null, start = 0, end = Infinity, onlyBelow = 0, onRecord = () => {} } = {}) {
  const sources = sourcesFromDirectory();
  const priorByBrand = new Map((previous?.sources || []).map((source) => [source.brand, source]));
  const records = sources.map((source) => priorByBrand.has(source.brand)
    ? { ...priorByBrand.get(source.brand), sourceUrl: source.sourceUrl, styleIds: source.styleIds }
    : { ...source, photos: [], status: 'unavailable' });
  const selected = sources.map((source, index) => ({ source, index }))
    .filter(({ index }) => index >= start && index < end &&
      (!onlyBelow || (records[index].photos?.length || 0) < onlyBelow));
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (cursor < selected.length) {
      const { source, index } = selected[cursor++];
      const fresh = await collectSource(source, fetchImpl);
      records[index] = fresh.photos.length >= (records[index].photos?.length || 0) ? fresh : records[index];
      onRecord(records[index], index);
      log(`${index + 1}/${sources.length} ${source.brand}: ${records[index].photos.length} photos (${records[index].status})`);
    }
  }));
  // A refreshed listing may reuse previously reviewed image URLs. Preserve
  // only those exact approvals; every new URL must be reviewed separately.
  const reviewed = new Set((previous?.sources || []).flatMap((source) =>
    (source.photos || []).filter((photo) => photo.personVerified === true).map((photo) => photo.image)));
  for (const record of records) for (const photo of record.photos || []) {
    if (reviewed.has(photo.image)) photo.personVerified = true;
    else delete photo.personVerified;
  }
  return { generatedAt: new Date().toISOString(), sources: records };
}

if (require.main === module) {
  const start = Number(process.argv[2] || 0);
  const end = Number(process.argv[3] || Infinity);
  const onlyBelow = Number(process.argv[4] || 0);
  const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : null;
  buildCatalog({ previous, start, end, onlyBelow }).then((catalog) => {
    fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n');
    fs.writeFileSync(diagnosisOutput, JSON.stringify(packCatalog(catalog)) + '\n');
    console.log(`Saved ${catalog.sources.length} sources and ${catalog.sources.reduce((n, source) => n + source.photos.length, 0)} photos to ${output}`);
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}

module.exports = { parsePage, parseBaycrewsListing, parseRalphLaurenListing, parseOfficialGallery, parseHypebeastGallery, parseUnitedArrowsListing, parseVanListing,
  collectSource, sourcesFromDirectory, buildCatalog };
