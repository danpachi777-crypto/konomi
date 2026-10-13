(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.window || root).KonomiPhotoAudience = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // These labels sell clothing for both audiences. Their brand directory entry
  // alone cannot establish the audience of an individual photograph.
  const mixedBrands = new Set([
    'Theory', 'Alpha Industries', 'Stüssy', '無印良品', 'COS', 'YAECA',
    'adidas Originals', 'Nike', 'Y-3', 'PUMA', 'Uniqlo U', 'UNIQLO',
    'GAP', 'GLOBAL WORK', 'Columbia', 'and wander', 'NANGA', 'CHUMS',
    'AllSaints', 'Vivienne Westwood', 'HYSTERIC GLAMOUR', 'AVIREX'
  ]);
  // Product section labels alone were misleading for these sources: sampled
  // photos include models from another audience or children. Only a photo
  // with its own reviewed audience label may enter diagnosis or discovery.
  const needsPhotoAudienceReview = new Set([
    'Nike', 'LIFUL', 'MHL.', 'ANAP', 'MUSINSA STANDARD',
    'Yohji Yamamoto', 'MARGARET HOWELL', 'Goldwin', 'agnès b.', 'NANGA'
  ]);
  // Visually checked on the saved Uniqlo U / COS contact sheet. These IDs
  // identify the specific model photographs, not an entire mixed brand.
  const reviewedMenPhotoIds = new Set([
    'bb0681cc0e858083', '39c6430f31136f7f', 'a61f4a86fc14b2b7',
    '19d4cf58bfde5888', '025b309579f93f43', 'adad770161fcf810',
    '2923fd368b361613', 'aeee613d9fa05126', '7292a72d9d8fb335',
    '6ab56b0fc4283313', '192d428884079a90',
    'b13961b2cb30f9be', 'e648327434702159', 'ddd3e1dbace1e670',
    'c69f0d64a9d48a26', '1d9537850067497a', 'e1a19f534172d7e4',
    '0355c23337b47590', '374649b802160c84', '7083aa1d932162bb',
    '350993e554a2b854'
  ]);
  const reviewedWomenPhotoIds = new Set([
    '3d1290a729dc119a', 'b863d85ebea41138', '558d3c60648b871f',
    '03e9d80a14c28159', 'af2b9b35e6e78aa5', '0856cdd70f69d3b0',
    'b89c28c632039570', '6d92edbfaea50673', '5a3439f9421a7839',
    '136fa1367594d6f9', '0ced49ae2e1e43f3', 'aa79b87efee1eb79',
    'c7966a0cb7ddd18a', 'b45503b686fa318e', '80e5bc8adfb32e60',
    '62f94aff879cb583', '5b5b8c0fb6284e04', 'a36b0c2125c187aa'
  ]);
  const women = /\b(?:women|womens|woman|ladies|lady|female|femme|girls?)\b|ウィメンズ|ウイメンズ|レディース|婦人|女性|女子|スカート|ワンピース|ブラウス|キャミソール|チュニック|\b(?:skirt|dress|blouse|camisole)\b/i;
  const men = /\b(?:men|mens|man|male|homme)\b|(?<!ウィ|ウイ)メンズ|紳士|男性|男子/i;
  const kids = /\b(?:kids?|children|baby|toddler)\b|キッズ|ボーイズ|ガールズ|ベビー|子供|子ども|[0-9]{3}[-～][0-9]{3}cm/i;

  function explicitAudience(photo, source) {
    if (photo.audience === 'men' || photo.audience === 'women') return photo.audience;
    if (reviewedMenPhotoIds.has(photo.id)) return 'men';
    if (reviewedWomenPhotoIds.has(photo.id)) return 'women';
    if (photo.seller === 'Kindal') return 'women'; // Collector requires the Women product tag.
    if (photo.seller === 'RAGTAG') return null; // Product gender was not checked.
    const title = String(photo.title || '').replace(/&apos;|&#39;/gi, "'");
    const path = `${photo.url || ''} ${photo.image || ''}`;
    if (kids.test(title)) return null;
    let isWomen = women.test(title) || /(?:^|[/_.-])(?:women|womens|ladies|female)(?=[/_.-]|\s|$)/i.test(path);
    let isMen = men.test(title) || /(?:^|[/_.-])(?:men|mens|homme)(?=[/_.-]|\s|$)/i.test(path);
    if (source.brand === 'Theory') {
      if (/[?&]shopCode=01(?:&|$)/.test(photo.url || '')) isWomen = true;
      if (/[?&]shopCode=02(?:&|$)/.test(photo.url || '')) isMen = true;
    }
    if (source.brand === 'Alpha Industries') {
      const code = /\/products\/([mw])[a-z]{2}[0-9]/i.exec(photo.url || '')?.[1]?.toLowerCase();
      if (code === 'w') isWomen = true;
      if (code === 'm') isMen = true;
    }
    if (source.brand === 'GLOBAL WORK') {
      if (/^Ws[:：]/i.test(title)) isWomen = true;
      if (/^Ms[:：]/i.test(title)) isMen = true;
      if (/^Ks[:：]/i.test(title)) return null;
    }
    if (source.brand === 'CHUMS') {
      if (/\bCH11[-_][0-9]/i.test(title)) isWomen = true;
      if (/\bCH01[-_][0-9]/i.test(title)) isMen = true;
    }
    return isWomen === isMen ? null : isWomen ? 'women' : 'men';
  }

  function audienceFor(photo, source) {
    if (photo.seller === 'RAGTAG') return null;
    if (photo.seller === 'Kindal') return 'women';
    if (needsPhotoAudienceReview.has(source.brand))
      return photo.audience === 'men' || photo.audience === 'women' ? photo.audience : null;
    const explicit = explicitAudience(photo, source);
    if (explicit) return explicit;
    // Explicit evidence for both audiences within one source means its
    // unlabelled photos cannot safely inherit a source-wide audience.
    const audiences = new Set((source.styleIds || []).map((id) => id.split('_')[0]));
    if (audiences.size !== 1 || mixedBrands.has(source.brand)) return null;
    const signs = new Set((source.photos || []).slice(0, 30)
      .map((item) => explicitAudience(item, source)).filter(Boolean));
    if (signs.size > 1 || (signs.size === 1 && !signs.has([...audiences][0]))) return null;
    return [...audiences][0];
  }

  return { audienceFor, explicitAudience };
});
