/* ============================================================
   PALAX — main game logic.
   ============================================================ */

/* ---------------- pack catalogue ---------------- */
const PACKS = {
  standard: {
    id: 'standard', name: 'ARCANA PACK', cost: 25, cards: 3,
    colors: ['#ff9d76', '#fe5f55', '#c33d35', '#7e201b'],
    odds: { common: 62, uncommon: 25, rare: 10, epic: 2.5, legendary: 0.5 },
  },
  jumbo: {
    id: 'jumbo', name: 'JUMBO PACK', cost: 60, cards: 5,
    colors: ['#9ad8ff', '#4f9dde', '#2c6da3', '#173d5e'],
    odds: { common: 50, uncommon: 28, rare: 15, epic: 5.5, legendary: 1.5 },
  },
  mega: {
    id: 'mega', name: 'MEGA HOLO PACK', cost: 120, cards: 5,
    colors: ['#ffe9a8', '#f5b83d', '#b8821e', '#6e4a0c'],
    odds: { common: 30, uncommon: 30, rare: 24, epic: 12, legendary: 4 },
  },
};

const FREE_PACK_COOLDOWN = 180_000;        // 3 minutes
const PITY_RARE = 5;                       // guaranteed rare+ every N packs
const PITY_LEGENDARY = 40;                 // guaranteed legendary every N packs

/* ---------------- state ---------------- */
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

function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* fresh start */ }
}

const $ = id => document.getElementById(id);

/* ---------------- coins ---------------- */
function setCoins(n) {
  state.coins = Math.max(0, n);
  $('coinCount').textContent = state.coins;
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
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
        life: 1, decay: 0.012 + Math.random() * 0.02,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        spin: (Math.random() - 0.5) * 0.3, rot: Math.random() * Math.PI,
      });
    }
  }

  function confetti() {
    for (let i = 0; i < 80; i++) {
      parts.push({
        x: Math.random() * canvas.width, y: -10 - Math.random() * 150,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
        life: 1, decay: 0.004 + Math.random() * 0.004,
        size: 4 + Math.random() * 5,
        color: ['#f5b83d', '#fe5f55', '#4f9dde', '#56c271', '#b06ae8', '#ffffff'][i % 6],
        spin: (Math.random() - 0.5) * 0.4, rot: Math.random() * Math.PI,
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.18; p.life -= p.decay; p.rot += p.spin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
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

  return { burst, confetti, shake, flash };
})();

/* ============================================================
   Shop
   ============================================================ */
function buildShop() {
  const shelf = $('packShelf');
  shelf.innerHTML = '';
  for (const pack of Object.values(PACKS)) {
    const item = document.createElement('div');
    item.className = 'shelf-item';
    const art = drawPackArt(pack);
    art.className = 'shelf-pack';
    const name = document.createElement('div');
    name.className = 'shelf-name';
    name.textContent = `${pack.name} · ${pack.cards} CARDS`;
    const buy = document.createElement('button');
    buy.className = 'big-btn buy-btn';
    buy.textContent = `BUY ${pack.cost}`;
    const tryBuy = () => {
      AudioEngine.resume();
      if (state.coins < pack.cost) {
        AudioEngine.sfx.deny();
        buy.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
                     { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 200 });
        return;
      }
      setCoins(state.coins - pack.cost);
      AudioEngine.sfx.buy();
      startOpening(pack);
    };
    buy.addEventListener('click', tryBuy);
    art.addEventListener('click', tryBuy);
    item.append(art, name, buy);
    shelf.appendChild(item);
  }
  $('pityHint').innerHTML =
    `PITY: RARE+ GUARANTEED EVERY ${PITY_RARE} PACKS &middot; LEGENDARY EVERY ${PITY_LEGENDARY}<br>` +
    `PACKS OPENED: ${state.opened}`;
}

/* ---------------- free pack timer ---------------- */
function updateFreePack() {
  const btn = $('freePackBtn');
  const left = state.lastFreePack + FREE_PACK_COOLDOWN - Date.now();
  if (left <= 0) {
    btn.disabled = false;
    btn.classList.add('ready');
    btn.innerHTML = 'FREE PACK — RIP IT!';
  } else {
    btn.disabled = true;
    btn.classList.remove('ready');
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    btn.innerHTML = `FREE PACK IN ${m}:${String(s).padStart(2, '0')}`;
  }
}
setInterval(updateFreePack, 1000);

$('freePackBtn').addEventListener('click', () => {
  if (state.lastFreePack + FREE_PACK_COOLDOWN - Date.now() > 0) return;
  state.lastFreePack = Date.now();
  save();
  updateFreePack();
  AudioEngine.sfx.buy();
  startOpening(PACKS.standard);
});

/* ============================================================
   Pack opening — the rip
   ============================================================ */
let opening = null;   // {pack, tearLine, progress, cards, revealed}

function startOpening(pack) {
  const tearLine = makeTearLine(mulberry32((Math.random() * 1e9) >>> 0));
  opening = { pack, tearLine, progress: 0, torn: false, cards: rollPack(pack), revealed: 0, lastRipSfx: 0 };

  renderPackCanvases(pack, $('packFlap'), $('packBody'), tearLine);
  $('packFlap').classList.remove('flying');
  $('packFlap').style.transform = '';
  $('packWrap').classList.add('idle');
  $('packWrap').style.display = '';
  $('ripHint').style.display = '';
  $('cardRow').innerHTML = '';
  $('doneBtn').classList.add('hidden');
  $('openOverlay').classList.remove('hidden');
  buildShop(); // refresh pity counter text behind the overlay
}

/* --- rip gesture: pointer drag across the top of the pack --- */
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
      opening.progress = progress;
      drawTearProgress(opening.pack, $('packBody'), opening.tearLine, progress);
      // flap peels as you rip
      $('packFlap').style.transform =
        `translate(${-progress * 10}px, ${-progress * 14}px) rotate(${-progress * 8}deg)`;
      const now = performance.now();
      if (now - opening.lastRipSfx > 55) {
        opening.lastRipSfx = now;
        AudioEngine.sfx.rip(progress);
        if (navigator.vibrate) navigator.vibrate(8);
      }
      if (progress >= 1) finishRip();
    }
  });

  function release() {
    ripping = false;
    if (opening && !opening.torn) {
      wrap.classList.remove('shaking');
      wrap.classList.add('idle');
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
  if (navigator.vibrate) navigator.vibrate([30, 20, 60]);

  // foil flap flies off
  $('packFlap').classList.add('flying');

  // particle burst from the tear
  const r = wrap.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height * 0.2, o.pack.colors, 36, 8);

  // pack body drops away, cards pour out
  setTimeout(() => {
    wrap.style.display = 'none';
    $('ripHint').style.display = 'none';
    spawnCards(o.cards);
  }, 420);
}

function spawnCards(cards) {
  const row = $('cardRow');
  cards.forEach((card, i) => {
    setTimeout(() => {
      const el = buildCardEl(card);
      el.classList.add('spawn');
      el.style.animationDelay = '0s';
      row.appendChild(el);
      AudioEngine.sfx.cardSlide(i);
      el.addEventListener('click', () => revealCard(el, card), { once: true });
    }, i * 140);
  });
  // hint: tap to flip
  setTimeout(() => { $('ripHint').style.display = ''; $('ripHint').textContent = 'TAP CARDS TO FLIP'; }, cards.length * 140 + 200);
}

function revealCard(el, card) {
  el.classList.add('flipped');
  AudioEngine.sfx.flip();
  setTimeout(() => {
    AudioEngine.sfx.reveal(card.rarity);
    const r = el.getBoundingClientRect();
    const pal = RARITIES[card.rarity].palette;
    if (card.rarity === 'rare') fx.burst(r.left + r.width / 2, r.top + r.height / 2, pal, 14, 4);
    if (card.rarity === 'epic') { fx.burst(r.left + r.width / 2, r.top + r.height / 2, pal, 30, 6); fx.shake(); }
    if (card.rarity === 'legendary') {
      fx.flash(); fx.shake(); fx.confetti();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, pal, 50, 9);
      if (navigator.vibrate) navigator.vibrate([40, 30, 40, 30, 100]);
    }
  }, 220);
  addCard(card);
  opening.revealed++;
  if (opening.revealed >= opening.cards.length) {
    setTimeout(() => $('doneBtn').classList.remove('hidden'), 700);
  }
}

$('doneBtn').addEventListener('click', () => {
  $('openOverlay').classList.add('hidden');
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
  const sorted = [...state.collection].sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.name.localeCompare(b.name));
  for (const entry of sorted) {
    const holder = document.createElement('div');
    holder.className = 'coll-card';
    holder.appendChild(buildCardEl(entry, { faceUp: true }));
    if (entry.count > 1) {
      const badge = document.createElement('div');
      badge.className = 'coll-count';
      badge.textContent = 'x' + entry.count;
      holder.appendChild(badge);
    }
    const actions = document.createElement('div');
    actions.className = 'coll-actions';
    if (entry.count > 1) {
      const sell = document.createElement('button');
      sell.className = 'mini-btn sell';
      sell.textContent = `SELL DUPE +${RARITIES[entry.rarity].sell}`;
      sell.addEventListener('click', () => {
        removeCard(entry);
        setCoins(state.coins + RARITIES[entry.rarity].sell);
        AudioEngine.sfx.coin();
        renderCollection();
        renderTrade();
      });
      actions.appendChild(sell);
    }
    holder.appendChild(actions);
    grid.appendChild(holder);
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
  for (const entry of sorted) {
    const holder = document.createElement('div');
    holder.className = 'coll-card';
    holder.appendChild(buildCardEl(entry, { faceUp: true }));
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
  }
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
    AudioEngine.sfx.flip();
    if (btn.dataset.screen === 'collection') renderCollection();
    if (btn.dataset.screen === 'trade') renderTrade();
  });
});

$('muteBtn').addEventListener('click', () => {
  state.muted = !state.muted;
  AudioEngine.setMuted(state.muted);
  $('muteBtn').classList.toggle('muted', state.muted);
  save();
});

// audio can only start after a user gesture
document.body.addEventListener('pointerdown', () => AudioEngine.resume(), { once: true });

load();
AudioEngine.setMuted(state.muted);
$('muteBtn').classList.toggle('muted', state.muted);
setCoins(state.coins);
buildShop();
updateFreePack();
renderCollection();
renderTrade();
resetDuelTable();
