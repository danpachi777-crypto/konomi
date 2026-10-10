const cards = require('../data.js');
const { styleOf } = require('../diagnosis-pool.js');
const styles = cards.filter(card => card.id.startsWith('style-') && card.phase === 'initial');
let missing = 0;
for (const style of styles) {
  const count = cards.filter(card => styleOf(card) === style.styleId).length;
  const gap = Math.max(0, 201 - count);
  missing += gap;
  console.log(style.audience + '\t' + style.category + '\t' + count + '/201\t不足 ' + gap);
}
console.log('合計 ' + cards.length + ' 枚 / 目標 ' + styles.length * 201 + ' 枚、追加必要 ' + missing + ' 枚');
if (missing) process.exitCode = 1;
