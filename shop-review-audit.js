// Manual spot checks of publicly mirrored Google-origin reviews, 2026-10-13.
// These are paraphrases and links, not copied review text or a live review feed.
(function () {
  const notes = {
    'shimo-02': {
      reviewNote: '公開口コミには米国のアウトドア古着への言及があります。2026年の取材記事とも一致します。',
      reviewSourceUrl: 'https://wanderlog.com/place/details/4998497/hickory',
      additionalSourceUrl: 'https://san-tatsu.jp/articles/538894/'
    },
    'shimo-08-a': {
      reviewNote: '欧州古着の紹介がありますが、2025年の口コミには品ぞろえが変わったとの指摘もあります。来店前に再確認してください。',
      reviewSourceUrl: 'https://wanderlog.com/place/details/5961970/ruby-tuesday'
    },
    'harajuku-13': {
      reviewNote: '公開口コミではヴィンテージデニムや米国古着が繰り返し言及されています。',
      reviewSourceUrl: 'https://wanderlog.com/place/details/1128055/berberjin'
    },
    'harajuku-01': {
      reviewNote: '公開口コミでは女性向けの古着やアクセサリーへの言及があります。',
      reviewSourceUrl: 'https://wanderlog.com/place/details/2061018/flamingo'
    },
    'kichijyouji-16': {
      reviewNote: '公開口コミではデザイナーズ古着と服飾小物への言及があります。',
      reviewSourceUrl: 'https://wanderlog.com/place/details/839191/ragtag-kichij%C5%8Dji'
    }
  };
  (window.KONOMI_FREE_SHOPS || []).forEach((shop) => {
    if (notes[shop.id]) Object.assign(shop, notes[shop.id], { reviewCheckedAt: '2026-10-13' });
  });
})();
