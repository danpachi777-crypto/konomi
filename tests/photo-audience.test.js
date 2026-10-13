const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../assets/brand-photos.json');
const { audienceFor } = require('../photo-audience.js');

test('visually mixed photo sources require a reviewed per-photo audience', () => {
  for (const brand of ['Nike', 'LIFUL', 'MHL.', 'ANAP', 'MUSINSA STANDARD',
    'Yohji Yamamoto', 'MARGARET HOWELL', 'Goldwin', 'agnès b.', 'NANGA']) {
    const source = catalog.sources.find((item) => item.brand === brand);
    assert.ok(source, brand);
    assert.ok(source.photos.every((photo) => audienceFor(photo, source) === null), brand);
    assert.equal(audienceFor({ ...source.photos[0], audience: 'women' }, source), 'women');
  }
});
