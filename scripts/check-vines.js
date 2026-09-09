const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const vines = require('../miniprogram/shared/rose-vines');
const wedding = require('../miniprogram/wedding');
const gallery = require('../miniprogram/shared/gallery');
const root = path.join(__dirname, '../miniprogram');

assert.equal(vines.styles.length, 10);
assert.equal(new Set(vines.styles.map(s => s.file)).size, 10);
for (const style of vines.styles) assert(fs.existsSync(path.join(root, 'assets', style.file)));
for (let seed = 0; seed < 100; seed++) {
  const sequence = vines.plan('album-' + seed, 113);
  assert.deepEqual(sequence, vines.plan('album-' + seed, 113));
  assert.equal(sequence.length, 113);
  assert(sequence.every((value, i) => i === 0 || value !== sequence[i - 1]));
  for (let i = 0; i < sequence.length; i += 10) {
    const bag = sequence.slice(i, i + 10);
    assert.equal(new Set(bag).size, bag.length);
  }
}
assert.deepEqual(vines.plan('empty', 0), []);
assert.equal(vines.plan('one', 1).length, 1);
assert.throws(() => vines.plan('invalid', -1), RangeError);
assert(new Set(Array.from({length: 20}, (_, i) => vines.plan(i, 10).join())).size > 15);
console.log('PASS 十款素材、每轮不重复、跨轮不连号、稳定洗牌与不同相册分配');

const web = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'shared/rose-vines.js'), 'utf8'), web);
for (const album of wedding.albums) {
  const count = wedding.photos.filter(p => p.group === album.id).length - 1;
  assert.deepEqual(Array.from(web.window.WEDDING_VINES.plan(album.id, count)), vines.plan(album.id, count));
}
console.log('PASS Web 与小程序使用相同相册装饰顺序');

global.wx = {setNavigationBarTitle() {}, showShareMenu() {}};
try {
  for (const album of wedding.albums) {
    const page = gallery(album.package);
    page.setData = patch => Object.assign(page.data, patch);
    page.onLoad({group: album.id});
    const photos = wedding.photos.filter(p => p.group === album.id);
    assert.equal(page.data.photos.length, photos.length);
    assert.equal(page.data.photos.filter(p => p.vine).length, Math.max(0, photos.length - 1));
    assert.equal(page.data.photos.at(-1).vine, '');
    page.data.photos.forEach((photo, index) => {
      assert.equal(photo.file, photos[index].file);
      assert(!photo.url.includes('rose-vines/'));
      if (photo.vine) assert(fs.existsSync(path.join(root, 'assets', photo.vine)));
    });
  }
} finally {delete global.wx;}
console.log('PASS 所有相册照片间有装饰、最后一张无装饰、原照片顺序与预览路径不变');
