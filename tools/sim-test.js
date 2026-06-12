/* Headless integration test: boots the real game scripts against a
   minimal DOM stub and plays a full round — buy, rip gesture, card
   pop-out, spin, reveal, collect. Run: node tools/sim-test.js */

const fs = require('fs');
const path = require('path');

/* ---------- minimal DOM ---------- */
function makeCtx() {
  return new Proxy({ fillStyle: '', globalAlpha: 1 }, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'getImageData' || k === 'createImageData')
        return (a, b, w, h) => ({ data: new Uint8ClampedArray((w || 48) * (h || 64) * 4) });
      return () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

function makeEl(tag = 'div') {
  const el = {
    tag, children: [], _handlers: {}, dataset: {}, disabled: false,
    textContent: '', value: '', width: 0, height: 0, offsetWidth: 0,
    style: new Proxy({ setProperty() {} }, { get: (t, k) => t[k] ?? '', set: (t, k, v) => { t[k] = v; return true; } }),
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { (f === undefined ? !this._s.has(c) : f) ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    getContext: makeCtx,
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { cs.forEach(c => this.children.push(c)); },
    addEventListener(type, fn) { (this._handlers[type] ??= []).push(fn); },
    removeEventListener() {},
    fire(type, ev = {}) { (this._handlers[type] || []).forEach(fn => fn(ev)); },
    setPointerCapture() {}, animate() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 240, height: 320 }; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html || ''; },
    set(v) { this._html = v; this.children = []; },
  });
  Object.defineProperty(el, 'className', {
    get() { return [...this.classList._s].join(' '); },
    set(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return el;
}

const byId = {};
const ids = ['coinCount', 'coinsPill', 'muteBtn', 'packStage', 'packInfo', 'buyBtn', 'pityHint',
  'openOverlay', 'openStage', 'stageRays', 'shockwave', 'ripHint', 'packWrap', 'packFlap',
  'packBody', 'cardRow', 'doneBtn', 'dealerCard', 'playerCard', 'potAmount', 'streakBadge',
  'duelMsg', 'betControls', 'duelControls', 'bestStreak', 'flipAgainBtn', 'cashOutBtn',
  'collectionGrid', 'collectionStats', 'tradeGrid', 'tradeMsg', 'redeemInput', 'redeemBtn',
  'codeModal', 'codeText', 'copyCodeBtn', 'closeCodeBtn', 'fxCanvas',
  'screen-shop', 'screen-game', 'screen-collection', 'screen-trade'];
ids.forEach(id => { byId[id] = makeEl(); byId[id].id = id; });

const navBtns = ['shop', 'game', 'collection', 'trade'].map(s => {
  const b = makeEl('button'); b.dataset.screen = s; return b;
});
const betBtns = ['10', '25', '50'].map(v => { const b = makeEl('button'); b.dataset.bet = v; return b; });
const screens = ['shop', 'game', 'collection', 'trade'].map(s => byId['screen-' + s]);

global.document = {
  getElementById: id => byId[id] || (byId[id] = makeEl()),
  createElement: tag => makeEl(tag),
  querySelectorAll: sel =>
    sel === '.nav-btn' ? navBtns : sel === '.bet-btn' ? betBtns : sel === '.screen' ? screens : [],
  body: makeEl('body'),
};
global.window = global;
const savedData = {};
global.localStorage = {
  getItem: k => savedData[k] ?? null,
  setItem(k, v) { savedData[k] = v; },
  removeItem(k) { delete savedData[k]; },
};
const readSave = () => JSON.parse(savedData['palax-save-v1'] || '{}');
global.navigator = { vibrate: () => {}, clipboard: { writeText() {} } };
global.innerWidth = 400; global.innerHeight = 800;
global.addEventListener = () => {};
global.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);

/* stub audio engine (real one needs WebAudio) */
global.AudioEngine = {
  resume() {}, setMuted() {}, muted: false,
  sfx: new Proxy({}, { get: () => () => {} }),
};

/* ---------- load the real game code ---------- */
const root = path.join(__dirname, '..');
// concatenated like sequential <script> tags sharing one scope
eval(fs.readFileSync(path.join(root, 'js/cards.js'), 'utf8') + '\n;\n' +
     fs.readFileSync(path.join(root, 'js/main.js'), 'utf8'));

const assert = (cond, msg) => {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('ok –', msg);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  assert(byId.coinCount.textContent === '∞', 'coins display infinity');
  assert(byId.packStage.children.length === 1, 'shop shows exactly one pack');
  assert(byId.packInfo.innerHTML.includes('PALAX PACK'), 'pack is the PALAX PACK');

  // buy / rip
  byId.buyBtn.fire('click');
  assert(!byId.openOverlay.classList.contains('hidden'), 'opening overlay appears');

  // rip gesture: drag across the top (y must be < 38% of 320 = 121px)
  byId.packWrap.fire('pointerdown', { clientX: 24, clientY: 60, pointerId: 1 });
  for (let x = 24; x <= 230; x += 10)
    byId.packWrap.fire('pointermove', { clientX: x, clientY: 60, pointerId: 1 });
  byId.packWrap.fire('pointerup', {});
  assert(byId.packFlap.classList.contains('flying'), 'flap flies off after full swipe');

  await sleep(600);   // pack body drops (420ms), spinReveal starts
  assert(byId.cardRow.children.length === 1, 'ONE card pops out');
  const popWrap = byId.cardRow.children[0];
  assert(popWrap.classList.contains('pop-wrap'), 'card is wrapped in pop-out animator');
  const card = popWrap.children[0];
  assert(card.classList.contains('big-reveal'), 'card is the big reveal card');
  const cover = card.children[card.children.length - 1];
  assert(cover.classList.contains('mystery-cover'), 'card spins under a white mystery cover');
  assert(byId.stageRays.classList.contains('on'), 'white suspense rays are on');

  await sleep(800);
  assert(/rotateY/.test(card.style.transform), 'card is actively spinning');
  assert(!cover.classList.contains('off'), 'rarity still hidden mid-spin');

  await sleep(2700);  // spin (2300) + settle (580) + margin
  assert(cover.classList.contains('off'), 'cover lifts — rarity revealed');
  assert(card.classList.contains('flipped'), 'reveal jolt triggered');
  const coll = readSave().collection || [];
  assert(coll.length === 1, 'card added to collection');
  console.log('   pulled:', coll[0].name, '—', coll[0].rarity.toUpperCase());

  await sleep(900);
  assert(!byId.doneBtn.classList.contains('hidden'), 'COLLECT button appears');
  byId.doneBtn.fire('click');
  assert(byId.openOverlay.classList.contains('hidden'), 'overlay closes on collect');

  console.log('\nALL CHECKS PASSED — full rip→spin→reveal loop works.');
  process.exit(0);
})().catch(e => { console.error('FAIL (exception):', e); process.exit(1); });
