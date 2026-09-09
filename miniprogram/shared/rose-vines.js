/* Shared by the mini-program and web preview. Stable shuffled bags keep each
   album varied without changing its ornaments when a guest returns to it. */
(function () {
  const styles = [
    {id: '01', name: '月弧相拥', file: 'rose-vines/vine-01.png'},
    {id: '02', name: '双环心结', file: 'rose-vines/vine-02.png'},
    {id: '03', name: '斜枝寄语', file: 'rose-vines/vine-03.png'},
    {id: '04', name: '花瀑轻垂', file: 'rose-vines/vine-04.png'},
    {id: '05', name: '心形花笺', file: 'rose-vines/vine-05.png'},
    {id: '06', name: '回旋圆舞', file: 'rose-vines/vine-06.png'},
    {id: '07', name: '并蒂相依', file: 'rose-vines/vine-07.png'},
    {id: '08', name: '疏影留白', file: 'rose-vines/vine-08.png'},
    {id: '09', name: '花束长卷', file: 'rose-vines/vine-09.png'},
    {id: '10', name: '蝶吻玫瑰', file: 'rose-vines/vine-10.png'}
  ];
  function randomFor(key) {
    let state = 2166136261;
    const text = String(key);
    for (let i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619);
    return function () {
      let value = state += 0x6D2B79F5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function plan(key, count) {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('Vine count must be a nonnegative integer');
    const random = randomFor(key);
    const result = [];
    while (result.length < count) {
      const bag = styles.map(style => style.file);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        const swap = bag[i]; bag[i] = bag[j]; bag[j] = swap;
      }
      if (bag[0] === result[result.length - 1]) {
        const j = 1 + Math.floor(random() * (bag.length - 1));
        const swap = bag[0]; bag[0] = bag[j]; bag[j] = swap;
      }
      result.push(...bag.slice(0, count - result.length));
    }
    return result;
  }
  const api = {styles, plan};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.WEDDING_VINES = api;
})();
