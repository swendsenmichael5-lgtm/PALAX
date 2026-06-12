/* ============================================================
   PALAX — main game logic.
   ============================================================ */

/* ---------------- pack catalogue ---------------- */
const PACKS = {
  palax: {
    id: 'palax', name: 'PALAX PACK', cost: 0, cards: 1,
    colors: ['#f6e3b0', '#e8b54d', '#a87b24', '#4a3812'],
    odds: { common: 44, uncommon: 28, rare: 17, epic: 8, legendary: 3 },
  },
};
const PACK_LIST = Object.values(PACKS);

const PITY_RARE = 5;                       // guaranteed rare+ every N packs
const PITY_LEGENDARY = 25;                 // guaranteed legendary every N packs

/* ---------------- state ---------------- */
/* localStorage can throw on file:// or private browsing — never let
   that kill the game; fall back to in-memory saves */
const store = (() => {
  try {
    localStorage.setItem('__plx', '1');
    localStorage.removeItem('__plx');
    return localStorage;
  } catch (e) {
    const m = {};
    return { getItem: k => m[k] ?? null, setItem(k, v) { m[k] = v; }, removeItem(k) { delete m[k]; } };
  }
})();

const SAVE_KEY = 'palax-save-v1';
let state = {
  coins: 75,
  opened: 0,
  sinceRare: 0,
  sinceLegendary: 0,
  lastFreePack: 0,
  bestStreak: 0,
  muted: false,
  collection: [],   // [{seed, rarity, name, count}]
};

function save() { store.setItem(SAVE_KEY, JSON.stringify(state)); }
function load() {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* fresh start */ }
}

const $ = id => document.getElementById(id);

/* ---------------- coins: you are infinitely rich ---------------- */
function setCoins() {
  $('coinCount').textContent = '∞';
  const pill = $('coinsPill');
  pill.classList.remove('bump');
  void pill.offsetWidth;
  pill.classList.add('bump');
  save();
}

/* ---------------- collection helpers ---------------- */
function addCard(card) {
  const found = state.collection.find(c => c.seed === card.seed && c.rarity === card.rarity);
  if (found) found.count++;
  else state.collection.push({ seed: card.seed, rarity: card.rarity, name: card.name, count: 1 });
  save();
}

function removeCard(entry) {
  entry.count--;
  if (entry.count <= 0) state.collection = state.collection.filter(c => c !== entry);
  save();
}

/* ---------------- rarity rolls (with pity) ---------------- */
function rollRarity(odds) {
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const k of RARITY_ORDER) {
    r -= odds[k];
    if (r < 0) return k;
  }
  return 'common';
}

function rollPack(pack) {
  const cards = [];
  for (let i = 0; i < pack.cards; i++)
    cards.push(cardFromSeed((Math.random() * 0xffffffff) >>> 0, rollRarity(pack.odds)));

  // pity: best card of the pack gets upgraded if streaks run dry
  state.opened++; state.sinceRare++; state.sinceLegendary++;
  const rank = c => RARITY_ORDER.indexOf(c.rarity);
  const best = cards.reduce((a, b) => rank(a) >= rank(b) ? a : b);
  if (state.sinceLegendary >= PITY_LEGENDARY && best.rarity !== 'legendary')
    best.rarity = 'legendary';
  else if (state.sinceRare >= PITY_RARE && rank(best) < 2)
    best.rarity = 'rare';
  if (cards.some(c => rank(c) >= 2)) state.sinceRare = 0;
  if (cards.some(c => c.rarity === 'legendary')) state.sinceLegendary = 0;
  save();
  return cards;
}

/* ============================================================
   FX layer — particles, confetti, screen shake, flash
   ============================================================ */
const fx = (() => {
  const canvas = $('fxCanvas');
  const ctx = canvas.getContext('2d');
  let parts = [];

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  addEventListener('resize', resize);
  resize();

  function burst(x, y, colors, n = 24, power = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random()) * power;
      parts.push({
        x, y, px: x, py: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
        life: 1, decay: 0.012 + Math.random() * 0.02,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: (Math.random() - 0.5) * 0.3, rot: Math.random() * Math.PI,
        trail: power >= 6,                       // fast sparks leave streaks
      });
    }
  }

  function confetti() {
    for (let i = 0; i < 110; i++) {
      parts.push({
        x: Math.random() * canvas.width, y: -10 - Math.random() * 150,
        px: 0, py: 0,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
        life: 1, decay: 0.004 + Math.random() * 0.004,
        size: 4 + Math.random() * 5,
        color: ['#f5b83d', '#fe5f55', '#4f9dde', '#56c271', '#b06ae8', '#ffffff'][i % 6],
        spin: (Math.random() - 0.5) * 0.4, rot: Math.random() * Math.PI,
        conf: true,                              // flutters side to side
      });
    }
  }

  /* torn foil shreds that flutter down like confetti scraps */
  function shred(x, y, colors, n = 4) {
    for (let i = 0; i < n; i++) {
      parts.push({
        x: x + (Math.random() - 0.5) * 10, y, px: x, py: y,
        vx: (Math.random() - 0.5) * 1.4, vy: 0.4 + Math.random() * 1.2,
        life: 1, decay: 0.011 + Math.random() * 0.012,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: (Math.random() - 0.5) * 0.5, rot: Math.random() * Math.PI,
        conf: true,                              // flutter like paper
      });
    }
  }

  /* expanding impact ring at any point on screen */
  function ring(x, y, color = '#f6e3b0') {
    const d = document.createElement('div');
    d.className = 'fx-ring';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.borderColor = color;
    document.body.appendChild(d);
    setTimeout(() => d.remove?.(), 700);
  }

  // gentle rising sparkles while a scene is "live" (e.g. pack opening)
  let ambient = null;   // {rectFn, colors}
  function setAmbient(a) { ambient = a; }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ambient && Math.random() < 0.22) {
      const r = ambient.rectFn();
      parts.push({
        x: r.left + Math.random() * r.width,
        y: r.top + r.height * (0.3 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 0.4, vy: -(0.4 + Math.random() * 0.8),
        life: 1, decay: 0.007 + Math.random() * 0.008,
        size: 2 + Math.random() * 3,
        color: ambient.colors[Math.floor(Math.random() * ambient.colors.length)],
        spin: 0, rot: Math.PI / 4, float: true, twinkle: true,
      });
    }
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.px = p.x; p.py = p.y;
      p.x += p.vx; p.y += p.vy;
      if (!p.float) { p.vy += 0.16; p.vx *= 0.985; p.vy *= 0.995; }   // drag = smoother arcs
      if (p.conf) p.vx += Math.sin(p.rot * 3) * 0.12;                  // confetti flutter
      p.life -= p.decay; p.rot += p.spin;
      ctx.save();
      const a = p.twinkle ? p.life * (0.55 + 0.45 * Math.sin(p.life * 40)) : p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      if (p.trail) {   // motion-blur streak behind fast sparks
        ctx.globalAlpha *= 0.4;
        ctx.fillRect(-p.size / 2 + (p.px - p.x) * 0.6, -p.size / 2 + (p.py - p.y) * 0.6,
                     p.size * 0.8, p.size * 0.8);
      }
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }
  tick();

  function shake() {
    document.body.classList.remove('screenshake');
    void document.body.offsetWidth;
    document.body.classList.add('screenshake');
  }
  function flash() {
    document.body.classList.add('flashwhite');
    setTimeout(() => document.body.classList.remove('flashwhite'), 180);
  }

  return { burst, confetti, shred, ring, shake, flash, setAmbient };
})();

/* ============================================================
   Shop
   ============================================================ */

/* 3D tilt that follows the pointer; holo foils shift with the tilt
   like catching the light on a real card */
/* spring-physics tilt: the card leans toward your finger and
   glides back when you let go — no snapping */
function addTilt(el, max = 14) {
  const foil = () => (el.querySelector ? el.querySelector('.foil-canvas') : null);
  const st = { rx: 0, ry: 0, s: 1, tx: 0, ty: 0, ts: 1, raf: 0, active: false };

  function tick() {
    st.rx += (st.tx - st.rx) * 0.16;
    st.ry += (st.ty - st.ry) * 0.16;
    st.s  += (st.ts - st.s) * 0.16;
    el.style.transform =
      `perspective(600px) rotateY(${st.ry.toFixed(2)}deg) rotateX(${st.rx.toFixed(2)}deg) scale(${st.s.toFixed(3)})`;
    const f = foil();
    if (f) f._sx = Math.round(st.ry * 1.8);   // foil bands chase the lean
    if (!st.active && Math.abs(st.rx) < 0.05 && Math.abs(st.ry) < 0.05 && Math.abs(st.s - 1) < 0.002) {
      el.style.transform = '';
      el.style.animation = '';
      st.raf = 0;
      return;
    }
    st.raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!st.raf) st.raf = requestAnimationFrame(tick); };

  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    el.style.animation = 'none';
    st.active = true;
    st.ty = dx * max * 2;
    st.tx = -dy * max * 2;
    st.ts = 1.08;
    wake();
  });
  el.addEventListener('pointerleave', () => {
    st.active = false;
    st.tx = st.ty = 0;
    st.ts = 1;
    wake();
  });
}

function buildShop() {
  const pack = PACK_LIST[0];
  const stage = $('packStage');
  stage.innerHTML = '';
  const holo = document.createElement('div');
  holo.className = 'pack-holo';
  holo.style.setProperty('--packglow', pack.colors[1] + '99');
  holo.appendChild(drawPackArt(pack));
  addTilt(holo);
  holo.addEventListener('click', ripCurrent);
  stage.appendChild(holo);

  const oddChips = RARITY_ORDER.map(r =>
    `<span class="odd"><i style="background:${RARITIES[r].color}"></i>${RARITIES[r].label}<b style="color:${RARITIES[r].color}">${pack.odds[r]}%</b></span>`).join('');
  $('packInfo').innerHTML =
    `<div class="p-name">${pack.name}</div>` +
    `<div class="p-meta">ONE MYSTERY CARD INSIDE</div>` +
    `<div class="odds-plaque">${oddChips}</div>`;

  // last pull + run stats fill the hero row
  const lpHolder = $('lastPull');
  lpHolder.innerHTML = '';
  const lp = state.lastPull;
  const lpCard = buildCardEl(lp || cardFromSeed(7, 'common'), { faceUp: !!lp });
  if (lp) addTilt(lpCard, 9);
  lpHolder.appendChild(lpCard);
  const owned = state.collection.reduce((a, c) => a + c.count, 0);
  $('shopStats').innerHTML =
    `<span class="chip">RIPPED <b>${state.opened}</b></span>` +
    `<span class="chip">OWNED <b>${owned}</b></span>` +
    `<span class="chip">STREAK <b>${state.bestStreak}</b></span>`;

  const pips = Array.from({ length: PITY_RARE }, (_, i) =>
    `<span class="pip${i < state.sinceRare ? ' on' : ''}"></span>`).join('');
  const legendPct = Math.min(100, state.sinceLegendary / PITY_LEGENDARY * 100);
  $('pityHint').innerHTML =
    `<div class="pity-board">` +
    `<div class="pity-row"><label>RARE CHARM</label><div class="pips">${pips}</div></div>` +
    `<div class="pity-row"><label>LEGEND CHARM</label><div class="charm-bar"><div class="charm-fill" style="width:${legendPct}%"></div></div></div>` +
    `<div class="opened-line">PACKS RIPPED &middot; ${state.opened}</div>` +
    `</div>`;
}

function ripCurrent() {
  AudioEngine.resume();
  AudioEngine.sfx.buy();
  startOpening(PACK_LIST[0]);
}

$('buyBtn').addEventListener('click', ripCurrent);

/* ============================================================
   Pack opening — the rip
   ============================================================ */
let opening = null;   // {pack, tearLine, progress, cards, revealed}

function startOpening(pack) {
  const tearLine = makeTearLine(mulberry32((Math.random() * 1e9) >>> 0));
  opening = { pack, tearLine, progress: 0, torn: false, cards: rollPack(pack), revealed: 0, lastRipSfx: 0 };

  renderPackCanvases(pack, $('packFlap'), $('packBody'), tearLine);
  currentPop?.remove?.();
  currentPop = null;
  const flap = $('packFlap'), body = $('packBody');
  flap.classList.remove('flying');
  flap.style.transition = 'none';
  flap.style.transform = '';
  body.classList.remove('dropping');
  body.style.transition = 'none';
  body.style.transform = '';
  body.style.filter = `drop-shadow(0 0 10px ${pack.colors[1]}66)`;
  $('packWrap').classList.add('idle');
  $('packWrap').style.display = '';
  $('ripHint').style.display = '';
  $('ripHint').innerHTML = '&#9756; SWIPE ACROSS THE TOP TO RIP &#9758;';
  $('stageRays').classList.remove('on');
  $('shockwave').classList.remove('boom');
  $('cardRow').innerHTML = '';
  $('doneBtn').classList.add('hidden');
  $('doneBtn').classList.remove('rise');
  $('openOverlay').classList.remove('hidden');
  fx.setAmbient({
    rectFn: () => $('openStage').getBoundingClientRect(),
    colors: [...pack.colors.slice(0, 2), '#ffffff'],
  });
  buildShop(); // refresh pity counter text behind the overlay
}

/* --- rip gesture: grab either side of the top and tear across.
       The flap hinges from the untorn side, the body stretches
       toward your pull, and letting go early snaps it back. --- */
(() => {
  const wrap = $('packWrap');
  let ripping = false;
  let startX = 0, maxTravel = 0;

  function pointerPos(e) {
    const r = wrap.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  wrap.addEventListener('pointerdown', e => {
    if (!opening || opening.torn) return;
    const p = pointerPos(e);
    if (p.y > 0.38) return;            // must grab near the top
    ripping = true;
    startX = p.x;
    maxTravel = 0;
    opening.dir = p.x < 0.5 ? 1 : -1;  // tear away from the grabbed side
    const flap = $('packFlap');
    flap.style.transition = 'none';
    flap.style.transformOrigin = opening.dir === 1 ? '100% 60%' : '0% 60%';
    $('packBody').style.transition = 'none';
    wrap.classList.remove('idle');
    wrap.classList.add('shaking');
    wrap.setPointerCapture(e.pointerId);
    AudioEngine.resume();
  });

  wrap.addEventListener('pointermove', e => {
    if (!ripping || !opening || opening.torn) return;
    const p = pointerPos(e);
    maxTravel = Math.max(maxTravel, Math.abs(p.x - startX));
    const progress = Math.min(1, maxTravel / 0.72);
    if (progress > opening.progress) {
      const d = opening.dir;
      opening.progress = progress;
      drawTearProgress(opening.pack, $('packBody'), opening.tearLine, progress, d);
      // flap peels up from its hinge; body leans into the pull
      $('packFlap').style.transform =
        `translate(${d * progress * 10}px, ${-progress * 16}px) rotate(${d * progress * 16}deg)`;
      $('packBody').style.transform =
        `translateX(${d * progress * 5}px) skewX(${d * progress * 2.5}deg)`;
      $('packBody').style.filter =
        `drop-shadow(0 0 ${10 + progress * 30}px ${opening.pack.colors[1]}) brightness(${1 + progress * 0.25})`;
      const now = performance.now();
      if (now - opening.lastRipSfx > 55) {
        opening.lastRipSfx = now;
        AudioEngine.sfx.rip(progress);
        if (navigator.vibrate) navigator.vibrate(progress > 0.7 ? 14 : 8);
        // sparks + falling foil shreds at the tear tip
        const r = wrap.getBoundingClientRect();
        const tipX = r.left + r.width * (d === 1 ? progress : 1 - progress);
        fx.burst(tipX, r.top + r.height * 0.2, ['#ffffff', opening.pack.colors[0]], 3, 3);
        fx.shred(tipX, r.top + r.height * 0.22,
                 [opening.pack.colors[1], opening.pack.colors[2], '#1f2734'], 3);
      }
      if (progress >= 1) finishRip();
    }
  });

  function release() {
    if (!ripping) return;
    ripping = false;
    if (opening && !opening.torn) {
      wrap.classList.remove('shaking');
      wrap.classList.add('idle');
      if (opening.progress > 0.04) {
        // the half-torn flap snaps back elastically
        const flap = $('packFlap'), body = $('packBody');
        flap.style.transition = 'transform 0.4s cubic-bezier(0.3, 2.2, 0.5, 1)';
        body.style.transition = 'transform 0.4s cubic-bezier(0.3, 2.2, 0.5, 1)';
        flap.style.transform = `translate(${opening.dir * 2}px, -2px) rotate(${opening.dir * 2}deg)`;
        body.style.transform = '';
        AudioEngine.sfx.snapBack();
        if (navigator.vibrate) navigator.vibrate(12);
      }
    }
  }
  wrap.addEventListener('pointerup', release);
  wrap.addEventListener('pointercancel', release);
})();

function finishRip() {
  const o = opening;
  o.torn = true;
  const wrap = $('packWrap');
  wrap.classList.remove('shaking', 'idle');

  AudioEngine.sfx.burst();
  fx.shake();
  fx.flash();
  if (navigator.vibrate) navigator.vibrate([30, 20, 60]);

  // foil flap launches away from the tear direction
  const flap = $('packFlap');
  flap.classList.add('flying');
  flap.style.transform =
    `translate(${o.dir * 240}px, -340px) rotate(${o.dir * 90}deg) scale(1.1)`;
  $('packBody').style.transform = '';

  const r = wrap.getBoundingClientRect();
  const stage = $('openStage').getBoundingClientRect();

  // shockwave ring from the tear
  const shock = $('shockwave');
  shock.style.left = (r.left - stage.left + r.width / 2) + 'px';
  shock.style.top = (r.top - stage.top + r.height * 0.2) + 'px';
  shock.classList.remove('boom');
  void shock.offsetWidth;
  shock.classList.add('boom');

  // foil confetti + sparks erupt from the opening
  fx.burst(r.left + r.width / 2, r.top + r.height * 0.2, o.pack.colors, 44, 10);
  fx.burst(r.left + r.width / 2, r.top + r.height * 0.2, ['#ffffff'], 14, 5);
  fx.shred(r.left + r.width / 2, r.top + r.height * 0.2,
           [o.pack.colors[1], o.pack.colors[2], '#1f2734'], 14);

  // the pack stays in hand — the card slides out of the torn opening
  setTimeout(() => {
    $('ripHint').style.display = 'none';
    spinReveal(o.cards[0]);
  }, 500);
}

/* The big moment, in real stages: the card slides up out of the
   torn pack, the empty wrapper tumbles to the floor, then the card
   spins as a white-hot mystery and SLAMS into its rarity. */
let currentPop = null;
function spinReveal(card) {
  const host = $('packWrap');
  currentPop?.remove?.();
  const wrap = document.createElement('div');
  wrap.className = 'pop-wrap in-pack';
  currentPop = wrap;
  const el = buildCardEl(card);
  el.classList.add('big-reveal');
  el.style.transition = 'none';   // JS drives the spin, not the flip transition
  const cover = document.createElement('div');
  cover.className = 'mystery-cover';
  const coverBack = document.createElement('div');
  coverBack.className = 'mystery-cover back';
  el.append(cover, coverBack);
  wrap.appendChild(el);
  host.appendChild(wrap);

  // white rays while fate is undecided
  $('stageRays').style.setProperty('--raycolor', '#ffffff');
  $('stageRays').classList.add('on');

  // phase 1: the card rises out of the torn opening
  wrap.style.transition = 'none';
  wrap.style.transform = 'translateY(46px)';
  AudioEngine.sfx.cardDraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrap.style.transition = 'transform 1s cubic-bezier(0.3, 1, 0.4, 1)';
    wrap.style.transform = 'translateY(-150px)';
  }));

  // phase 2: the empty wrapper tumbles to the floor
  setTimeout(() => {
    const body = $('packBody');
    body.classList.add('dropping');
    AudioEngine.sfx.bodyDrop();
    const r = host.getBoundingClientRect();
    fx.shred(r.left + r.width / 2, r.top + r.height * 0.5,
             [opening.pack.colors[1], '#1f2734'], 6);
  }, 1000);

  // phase 3: card settles center and starts its mystery spin
  setTimeout(() => {
    wrap.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.4, 0.64, 1)';
    wrap.style.transform = 'translateY(-60px)';
    AudioEngine.sfx.riser(2.4);
    requestAnimationFrame(spin);
  }, 1280);

  const SPIN_MS = 2300;
  let start = 0;
  let rot = 0, lastSpark = 0;

  function spin(now) {
    if (!start) start = now;
    const t = Math.min(1, (now - start) / SPIN_MS);
    // wind up, peak mid-spin, glide down — no jarring start or stop
    const vel = 4 + 30 * Math.sin(Math.min(1, t * 1.12) * Math.PI);
    rot += vel;
    el.style.transform = `rotateY(${rot}deg)`;
    if (now - lastSpark > 130) {
      lastSpark = now;
      const r = el.getBoundingClientRect();
      fx.burst(r.left + r.width * Math.random(), r.top + r.height * Math.random(),
               ['#ffffff', '#f6e3b0'], 3, 2 + t * 3);
    }
    if (t < 1) requestAnimationFrame(spin);
    else settle();
  }

  function settle() {
    // glide to face-front with a springy overshoot, then reveal
    const target = Math.ceil(rot / 360) * 360;
    el.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.45, 0.64, 1)';
    el.style.transform = `rotateY(${target}deg)`;
    setTimeout(reveal, 640);
  }

  function reveal() {
    cover.classList.add('off');
    coverBack.classList.add('off');
    el.classList.add('flipped');             // triggers the rarity jolt animation
    fx.flash();
    fx.shake();
    AudioEngine.sfx.reveal(card.rarity);
    $('stageRays').style.setProperty('--raycolor', RARITIES[card.rarity].color);

    // rarity stamp slams in over the card
    const stamp = document.createElement('div');
    stamp.className = 'rarity-stamp';
    stamp.textContent = RARITIES[card.rarity].label + '!';
    stamp.style.color = RARITIES[card.rarity].color;
    $('openStage').appendChild(stamp);
    setTimeout(() => stamp.remove?.(), 1500);

    const r = el.getBoundingClientRect();
    const pal = RARITIES[card.rarity].palette;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    fx.burst(cx, cy, ['#ffffff'], 20, 6);
    if (card.rarity === 'rare') { fx.burst(cx, cy, pal, 24, 6); fx.ring(cx, cy, pal[1]); }
    if (card.rarity === 'epic') { fx.burst(cx, cy, pal, 44, 8); fx.ring(cx, cy, pal[1]); }
    if (card.rarity === 'legendary') {
      fx.confetti();
      fx.burst(cx, cy, pal, 70, 11);
      fx.ring(cx, cy, pal[0]);
      setTimeout(() => fx.ring(cx, cy, pal[1]), 140);
      if (navigator.vibrate) navigator.vibrate([40, 30, 40, 30, 120]);
    }
    addCard(card);
    state.lastPull = { seed: card.seed, rarity: card.rarity, name: card.name };
    save();
    addTilt(el, 12);   // tilt the fresh pull to play with its foil
    const done = $('doneBtn');
    setTimeout(() => { done.classList.remove('hidden'); done.classList.add('rise'); }, 750);
  }
}

$('doneBtn').addEventListener('click', () => {
  $('openOverlay').classList.add('hidden');
  $('stageRays').classList.remove('on');
  fx.setAmbient(null);
  opening = null;
  buildShop();
  renderCollection();
  renderTrade();
  AudioEngine.sfx.coin();
});

/* ============================================================
   Minigame — Double or Nothing
   ============================================================ */
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
let duel = null;   // {pot, streak}

function drawDuelCard(el, rank, suit) {
  el.classList.remove('back', 'pop');
  void el.offsetWidth;
  el.classList.add('pop');
  el.classList.toggle('red-suit', suit === '♥' || suit === '♦');
  el.textContent = RANKS[rank] + suit;
}

function resetDuelTable(msg = '') {
  $('dealerCard').className = 'duel-card back';
  $('playerCard').className = 'duel-card back';
  $('dealerCard').textContent = '';
  $('playerCard').textContent = '';
  $('potAmount').textContent = duel ? duel.pot : 0;
  $('streakBadge').textContent = duel && duel.streak ? `x${duel.streak} STREAK!` : '';
  $('duelMsg').textContent = msg;
  $('betControls').classList.toggle('hidden', !!duel);
  $('duelControls').classList.toggle('hidden', !duel);
  $('bestStreak').textContent = state.bestStreak;
}

function duelFlip() {
  const pRank = Math.floor(Math.random() * 13);
  let dRank = Math.floor(Math.random() * 13);
  // ties go to the dealer's reroll — keeps it brutal but fair-feeling
  while (dRank === pRank) dRank = Math.floor(Math.random() * 13);
  drawDuelCard($('playerCard'), pRank, SUITS[Math.floor(Math.random() * 4)]);
  AudioEngine.sfx.flip();
  setTimeout(() => {
    drawDuelCard($('dealerCard'), dRank, SUITS[Math.floor(Math.random() * 4)]);
    AudioEngine.sfx.flip();
    setTimeout(() => {
      if (pRank > dRank) {
        duel.pot *= 2;
        duel.streak++;
        state.bestStreak = Math.max(state.bestStreak, duel.streak);
        save();
        AudioEngine.sfx.win();
        const r = $('playerCard').getBoundingClientRect();
        fx.burst(r.left + r.width / 2, r.top + r.height / 2, ['#f5b83d', '#fff'], 18, 5);
        $('potAmount').textContent = duel.pot;
        $('streakBadge').textContent = `x${duel.streak} STREAK!`;
        $('duelMsg').textContent = 'YOU WIN! DOUBLE UP OR CASH OUT?';
        $('bestStreak').textContent = state.bestStreak;
      } else {
        AudioEngine.sfx.lose();
        fx.shake();
        $('duelMsg').textContent = `BUSTED! LOST ${duel.pot} COINS.`;
        duel = null;
        setTimeout(() => resetDuelTable('DEALER TAKES IT. GO AGAIN?'), 1400);
        $('betControls').classList.remove('hidden');
        $('duelControls').classList.add('hidden');
        $('potAmount').textContent = 0;
        $('streakBadge').textContent = '';
      }
    }, 500);
  }, 450);
}

document.querySelectorAll('.bet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const bet = +btn.dataset.bet;
    AudioEngine.resume();
    if (duel) return;
    if (state.coins < bet) { AudioEngine.sfx.deny(); $('duelMsg').textContent = 'NOT ENOUGH COINS!'; return; }
    setCoins(state.coins - bet);
    duel = { pot: bet, streak: 0 };
    resetDuelTable('FLIPPING...');
    duelFlip();
  });
});

$('flipAgainBtn').addEventListener('click', () => {
  if (!duel) return;
  $('dealerCard').className = 'duel-card back';
  $('playerCard').className = 'duel-card back';
  $('duelMsg').textContent = 'FLIPPING...';
  setTimeout(duelFlip, 250);
});

$('cashOutBtn').addEventListener('click', () => {
  if (!duel) return;
  setCoins(state.coins + duel.pot);
  AudioEngine.sfx.coin();
  fx.confetti();
  $('duelMsg').textContent = `CASHED OUT ${duel.pot} COINS!`;
  duel = null;
  resetDuelTable(`NICE! COINS BANKED.`);
});

/* ============================================================
   Collection
   ============================================================ */
function renderCollection() {
  const grid = $('collectionGrid');
  grid.innerHTML = '';
  const total = state.collection.reduce((a, c) => a + c.count, 0);
  const byRarity = RARITY_ORDER.map(r =>
    `<span style="color:${RARITIES[r].color}">${state.collection.filter(c => c.rarity === r).reduce((a, c) => a + c.count, 0)} ${RARITIES[r].label}</span>`
  ).join(' · ');
  $('collectionStats').innerHTML = `${total} CARDS OWNED<br>${byRarity}`;

  if (!state.collection.length) {
    grid.innerHTML = '<div class="empty-note">NO CARDS YET.<br>GO RIP SOME PACKS!</div>';
    return;
  }
  // group by rarity with section dividers, best first
  let i = 0;
  for (const r of [...RARITY_ORDER].reverse()) {
    const entries = state.collection
      .filter(c => c.rarity === r)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!entries.length) continue;
    const div = document.createElement('div');
    div.className = 'rarity-divider';
    div.style.color = RARITIES[r].color;
    div.textContent = `◆ ${RARITIES[r].label} · ${entries.reduce((a, c) => a + c.count, 0)}`;
    grid.appendChild(div);
    for (const entry of entries) {
      const holder = document.createElement('div');
      holder.className = 'coll-card';
      holder.style.animationDelay = (i++ * 35) + 'ms';
      const cardEl = buildCardEl(entry, { faceUp: true });
      addTilt(cardEl, 10);
      holder.appendChild(cardEl);
      if (entry.count > 1) {
        const badge = document.createElement('div');
        badge.className = 'coll-count';
        badge.textContent = 'x' + entry.count;
        holder.appendChild(badge);
      }
      grid.appendChild(holder);
    }
  }
}

/* ============================================================
   Trading — gift codes
   ============================================================ */
function checksum(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().slice(0, 4).padStart(4, '0');
}

function makeGiftCode(entry) {
  const payload = `${entry.seed.toString(36)}.${RARITY_ORDER.indexOf(entry.rarity)}`;
  return `PLX-${payload.toUpperCase()}-${checksum(payload)}`;
}

function parseGiftCode(code) {
  const m = code.trim().toUpperCase().match(/^PLX-([0-9A-Z]+)\.(\d)-([0-9A-Z]{4})$/);
  if (!m) return null;
  const payload = `${m[1].toLowerCase()}.${m[2]}`;
  if (checksum(payload) !== m[3]) return null;
  const seed = parseInt(m[1].toLowerCase(), 36) >>> 0;
  const rarity = RARITY_ORDER[+m[2]];
  if (!rarity) return null;
  return cardFromSeed(seed, rarity);
}

function renderTrade() {
  const grid = $('tradeGrid');
  grid.innerHTML = '';
  if (!state.collection.length) {
    grid.innerHTML = '<div class="empty-note">NOTHING TO TRADE YET.</div>';
    return;
  }
  const sorted = [...state.collection].sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  sorted.forEach((entry, i) => {
    const holder = document.createElement('div');
    holder.className = 'coll-card';
    holder.style.animationDelay = (i * 35) + 'ms';
    const cardEl = buildCardEl(entry, { faceUp: true });
    addTilt(cardEl, 10);
    holder.appendChild(cardEl);
    if (entry.count > 1) {
      const badge = document.createElement('div');
      badge.className = 'coll-count';
      badge.textContent = 'x' + entry.count;
      holder.appendChild(badge);
    }
    const actions = document.createElement('div');
    actions.className = 'coll-actions';
    const gift = document.createElement('button');
    gift.className = 'mini-btn';
    gift.textContent = 'GIFT';
    gift.addEventListener('click', () => {
      const code = makeGiftCode(entry);
      removeCard(entry);
      renderTrade();
      renderCollection();
      $('codeText').textContent = code;
      $('codeModal').classList.remove('hidden');
      AudioEngine.sfx.buy();
    });
    actions.appendChild(gift);
    holder.appendChild(actions);
    grid.appendChild(holder);
  });
}

$('redeemBtn').addEventListener('click', () => {
  const card = parseGiftCode($('redeemInput').value);
  if (!card) {
    AudioEngine.sfx.deny();
    $('tradeMsg').textContent = 'INVALID CODE!';
    return;
  }
  addCard(card);
  $('redeemInput').value = '';
  $('tradeMsg').textContent = `RECEIVED: ${card.name} (${RARITIES[card.rarity].label})!`;
  AudioEngine.sfx.reveal(card.rarity);
  if (card.rarity === 'legendary') { fx.confetti(); fx.flash(); }
  renderTrade();
  renderCollection();
});

$('copyCodeBtn').addEventListener('click', () => {
  navigator.clipboard?.writeText($('codeText').textContent);
  $('copyCodeBtn').textContent = 'COPIED!';
  setTimeout(() => { $('copyCodeBtn').textContent = 'COPY CODE'; }, 1200);
});
$('closeCodeBtn').addEventListener('click', () => $('codeModal').classList.add('hidden'));

/* ============================================================
   Navigation + boot
   ============================================================ */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    AudioEngine.resume();
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    $('screen-' + btn.dataset.screen).classList.add('active');
    drawNavIcons();
    AudioEngine.sfx.flip();
    if (btn.dataset.screen === 'collection') renderCollection();
    if (btn.dataset.screen === 'trade') renderTrade();
  });
});

$('muteBtn').addEventListener('click', () => {
  state.muted = !state.muted;
  AudioEngine.setMuted(state.muted);
  $('muteBtn').classList.toggle('muted', state.muted);
  drawMuteIcon();
  save();
});

// audio can only start after a user gesture
document.body.addEventListener('pointerdown', () => AudioEngine.resume(), { once: true });

$('jsWarn').classList.add('hidden');   // JS is alive — clear the warning
load();
state.coins = 999999999;   // unlimited money mode
AudioEngine.setMuted(state.muted);
$('muteBtn').classList.toggle('muted', state.muted);
setCoins();
buildShop();
renderCollection();
renderTrade();
resetDuelTable();

/* ============================================================
   Hand-drawn pixel nav icons ('#' main, 'o' accent per map)
   ============================================================ */
const NAV_ICONS = {
  shop: [
    '.o.o.o.o.o.',
    '.#########.',
    '.#########.',
    '.##..#..##.',
    '.#..###..#.',
    '.##..#..##.',
    '.#########.',
    '.#..ooo..#.',
    '.#########.',
    '.o.o.o.o.o.',
  ],
  game: [
    '...........',
    '.#########.',
    '.#o.....o#.',
    '.#.......#.',
    '.#...o...#.',
    '.#.......#.',
    '.#o.....o#.',
    '.#########.',
    '...........',
    '...........',
  ],
  collection: [
    '..#######..',
    '..#.....#..',
    '..#..o..#..',
    '..#.ooo.#..',
    '..#..o..#..',
    '..#.....#..',
    '..#.....#..',
    '..#######..',
    '...........',
    '...........',
  ],
  trade: [
    '...........',
    '...#.......',
    '..#########',
    '...#.......',
    '...........',
    '.......#...',
    '#########..',
    '.......#...',
    '...........',
    '...........',
  ],
};

function drawNavIcons() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (!btn.querySelector) return;
    const slot = btn.querySelector('.nav-ico');
    if (!slot) return;
    const active = btn.classList.contains('active');
    let cv = slot.querySelector('canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      slot.textContent = '';
      slot.appendChild(cv);
    }
    const map = NAV_ICONS[btn.dataset.screen];
    cv.width = 11; cv.height = 10;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 11, 10);
    map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.') continue;
        ctx.fillStyle = row[x] === '#'
          ? (active ? '#2a2008' : '#9aa3b5')
          : (active ? '#7a5a14' : '#e8b54d');
        ctx.fillRect(x, y, 1, 1);
      }
    });
  });
}
drawNavIcons();

/* ============================================================
   Drawn wordmark + pixel speaker icon + news ticker
   ============================================================ */
(function drawLogo() {
  if (!document.querySelector) return;
  const el = document.querySelector('.logo');
  if (!el) return;
  const cv = document.createElement('canvas');
  cv.width = 33; cv.height = 9;
  const ctx = cv.getContext('2d');
  // crescent crest
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.floor(Math.sqrt(12 - dy * dy));
    ctx.fillStyle = '#e8b54d';
    ctx.fillRect(4 - half, 4 + dy, half * 2 || 1, 1);
  }
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.floor(Math.sqrt(12 - dy * dy));
    ctx.fillStyle = '#11151c';
    ctx.fillRect(5 - half + 1, 4 + dy, half * 2 || 1, 1);
  }
  ctx.fillStyle = '#f6e3b0';
  ctx.fillRect(6, 2, 1, 1);
  drawText(ctx, 'PALA', 10, 2, '#e8b54d');
  drawText(ctx, 'X', 26, 2, '#e9dfc8');
  el.textContent = '';
  el.classList.add('logo-px');
  el.appendChild(cv);
})();

const MUTE_ICON = [
  '..#....',
  '.##.o..',
  '###..o.',
  '###..o.',
  '.##.o..',
  '..#....',
];
function drawMuteIcon() {
  const btn = $('muteBtn');
  let cv = btn._iconCv;
  if (!cv) {
    cv = document.createElement('canvas');
    btn.textContent = '';
    btn.appendChild(cv);
    btn._iconCv = cv;
  }
  cv.width = 7; cv.height = 6;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 7, 6);
  MUTE_ICON.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '.') continue;
      if (row[x] === 'o' && state.muted) continue;     // waves vanish when muted
      ctx.fillStyle = state.muted ? '#525b6b' : '#e8b54d';
      ctx.fillRect(x, y, 1, 1);
    }
  });
  if (state.muted) {       // slash
    ctx.fillStyle = '#d4574e';
    for (let i = 0; i < 6; i++) ctx.fillRect(i + 1, 5 - i, 1, 1);
  }
}
drawMuteIcon();

(function fillTicker() {
  const msg = 'EVERY RIP FILLS YOUR CHARMS ◆ LEGENDARY GUARANTEED BY PACK 25 ◆ ' +
              'TILT A FOIL CARD TO CATCH THE LIGHT ◆ GIFT CODES TRADE REAL CARDS ◆ ' +
              'DOUBLE OR NOTHING PAYS THE BOLD ◆ ';
  $('tickerTrack').textContent = msg + msg;   // doubled for a seamless loop
})();

/* the idle pack shivers with anticipation every few seconds */
setInterval(() => {
  if (!document.querySelector) return;
  if (!$('screen-shop').classList.contains('active') || opening) return;
  const holo = document.querySelector('.pack-holo');
  if (!holo) return;
  holo.classList.add('tease');
  const r = holo.getBoundingClientRect();
  fx.burst(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * 0.25,
           ['#f6e3b0', '#fffaf0'], 5, 3);
  setTimeout(() => holo.classList.remove('tease'), 650);
}, 6500);
