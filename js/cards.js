/* ============================================================
   PALAX cards — rarities, procedural names and pixel art.
   Every card is generated from a seed, so trade codes can
   reconstruct the exact same card on another device.
   ============================================================ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RARITIES = {
  common:    { label: 'COMMON',    weight: 0,  sell: 5,   color: '#9aa5b1',
               palette: ['#cfd6dd', '#9aa5b1', '#6c7686', '#414a57'] },
  uncommon:  { label: 'UNCOMMON',  weight: 0,  sell: 15,  color: '#56c271',
               palette: ['#b8f0c4', '#56c271', '#2e8c4a', '#1b5230'] },
  rare:      { label: 'RARE',      weight: 0,  sell: 40,  color: '#4f9dde',
               palette: ['#bfe0ff', '#4f9dde', '#2c6da3', '#1a3f63'] },
  epic:      { label: 'EPIC',      weight: 0,  sell: 100, color: '#b06ae8',
               palette: ['#e8c8ff', '#b06ae8', '#7d3cb5', '#4a1d73'] },
  legendary: { label: 'LEGENDARY', weight: 0,  sell: 300, color: '#f5b83d',
               palette: ['#ffe9a8', '#f5b83d', '#d4881f', '#8a4d0f'] },
};
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const NAME_A = ['NEON', 'GLITCH', 'COSMIC', 'WILD', 'LUCKY', 'ROYAL', 'CURSED', 'TURBO',
                'GOLDEN', 'SHADOW', 'PIXEL', 'ARCANE', 'STATIC', 'MIDNIGHT', 'BLAZING', 'FROZEN'];
const NAME_B = ['JOKER', 'JESTER', 'WIZARD', 'GHOST', 'BANDIT', 'ORACLE', 'KNIGHT', 'IMP',
                'SPHINX', 'GAMBLER', 'PHANTOM', 'DEALER', 'TRICKSTER', 'BARON', 'WITCH', 'FOOL'];

function cardFromSeed(seed, rarity) {
  const rnd = mulberry32(seed);
  const name = NAME_A[Math.floor(rnd() * NAME_A.length)] + ' ' +
               NAME_B[Math.floor(rnd() * NAME_B.length)];
  return { seed, rarity, name };
}

/* Draw a card's pixel art onto a canvas (logical 48x48 art panel).
   Each card is a tiny synthwave scene: night sky, rarity-colored
   sun on the horizon, perspective grid, creature in silhouette-glow. */
function drawCardArt(canvas, card) {
  const S = 48, HORIZON = 30;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const pal = RARITIES[card.rarity].palette;
  const rnd = mulberry32(card.seed ^ 0x9E3779B9);

  // night sky gradient
  for (let y = 0; y < S; y++) {
    ctx.fillStyle = y < 10 ? '#07050f' : (y < 20 ? '#0d0a1f' : (y < HORIZON ? pal[3] : '#0a0714'));
    ctx.fillRect(0, y, S, 1);
  }
  // stars
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = rnd() < 0.6 ? '#ffffff' : pal[0];
    ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * (HORIZON - 4)), 1, 1);
  }
  // striped sun rising behind the horizon
  const cx = 24, r = 10;
  for (let dy = -r; dy <= 0; dy++) {
    const y = HORIZON + dy;
    if ((dy > -5) && (dy % 2 === 0)) continue;   // synth-sun gap stripes
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillStyle = dy < -6 ? pal[0] : pal[1];
    ctx.fillRect(cx - half, y, half * 2, 1);
  }
  // glowing horizon line
  ctx.fillStyle = pal[0];
  ctx.fillRect(0, HORIZON, S, 1);
  // perspective grid floor
  ctx.fillStyle = pal[2];
  [33, 37, 42].forEach(y => ctx.fillRect(0, y, S, 1));
  for (let i = -2; i <= 2; i++) {
    for (let y = HORIZON + 1; y < S; y++) {
      const x = 24 + i * (y - HORIZON);
      if (x >= 0 && x < S) ctx.fillRect(x, y, 1, 1);
    }
  }
  // sparkle field for epic+
  if (card.rarity === 'epic' || card.rarity === 'legendary') {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = rnd() < 0.5 ? pal[0] : '#ffffff';
      ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1);
    }
  }

  // mirrored creature sprite, 14x14 cells at 2x scale, centered
  const G = 14, scale = 2;
  const off = Math.floor((S - G * scale) / 2);
  const srnd = mulberry32(card.seed);
  // dark halo behind the creature so it pops off the scene
  ctx.fillStyle = 'rgba(5,3,12,0.75)';
  ctx.fillRect(off - 2, off - 2, G * scale + 4, G * scale + 4);
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < Math.ceil(G / 2); x++) {
      if (srnd() < 0.46) {
        ctx.fillStyle = pal[Math.floor(srnd() * 3)];
        ctx.fillRect(off + x * scale, off + y * scale, scale, scale);
        ctx.fillRect(off + (G - 1 - x) * scale, off + y * scale, scale, scale);
      }
    }
  }
  // eyes — always symmetric, always glowing
  const ey = off + 8, ex = off + 8;
  ctx.fillStyle = card.rarity === 'legendary' ? '#fff7d6' : '#ffffff';
  ctx.fillRect(ex, ey, 2, 2);
  ctx.fillRect(S - ex - 2, ey, 2, 2);

  // neon corner brackets instead of a full frame
  ctx.fillStyle = pal[1];
  const B = 6;
  ctx.fillRect(0, 0, B, 1);         ctx.fillRect(S - B, 0, B, 1);
  ctx.fillRect(0, S - 1, B, 1);     ctx.fillRect(S - B, S - 1, B, 1);
  ctx.fillRect(0, 0, 1, B);         ctx.fillRect(S - 1, 0, 1, B);
  ctx.fillRect(0, S - B, 1, B);     ctx.fillRect(S - 1, S - B, 1, B);
}

/* Build a DOM element for a card (used in reveal + collection). */
function buildCardEl(card, { faceUp = false } = {}) {
  const el = document.createElement('div');
  el.className = `game-card r-${card.rarity}` + (faceUp ? ' flipped' : '');
  const front = document.createElement('div');
  front.className = 'card-face card-front';
  const art = document.createElement('canvas');
  art.className = 'card-art';
  drawCardArt(art, card);
  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = card.name;
  const rar = document.createElement('div');
  rar.className = 'card-rarity';
  rar.textContent = RARITIES[card.rarity].label;
  front.append(art, name, rar);
  if (RARITY_ORDER.indexOf(card.rarity) >= 2) {
    const holo = document.createElement('div');
    holo.className = 'holo-overlay';
    front.appendChild(holo);
  }
  const back = document.createElement('div');
  back.className = 'card-face card-back-face';
  el.append(front, back);
  return el;
}

/* ============================================================
   Pack art — drawn at 48x64 logical pixels, split into a flap
   (top, torn off) and body so the rip can separate them.
   ============================================================ */

const PACK_W = 48, PACK_H = 64, TEAR_Y = 12;

/* jagged tear line, one y-offset per column */
function makeTearLine(seedRnd) {
  const line = [];
  for (let x = 0; x < PACK_W; x++)
    line.push(TEAR_Y + Math.floor(seedRnd() * 4) - 2);
  return line;
}

/* Full wrapper art on an offscreen canvas.
   New design: matte-black cyber foil with a neon frame, a glowing
   emblem window, circuit traces, chevrons and a glyph label strip. */
function drawPackArt(pack) {
  const c = document.createElement('canvas');
  c.width = PACK_W; c.height = PACK_H;
  const ctx = c.getContext('2d');
  const [c0, c1, c2, c3] = pack.colors;

  // matte dark body
  ctx.fillStyle = '#15101f';
  ctx.fillRect(0, 0, PACK_W, PACK_H);
  // subtle vertical shading
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(3, 0, 8, PACK_H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(PACK_W - 10, 0, 10, PACK_H);

  // crimp zigzag top + bottom
  for (let x = 0; x < PACK_W; x += 2) {
    ctx.fillStyle = c3; ctx.fillRect(x, 0, 1, 4);
    ctx.fillStyle = '#0a0714'; ctx.fillRect(x + 1, 0, 1, 4);
    ctx.fillStyle = c3; ctx.fillRect(x + 1, PACK_H - 4, 1, 4);
    ctx.fillStyle = '#0a0714'; ctx.fillRect(x, PACK_H - 4, 1, 4);
  }
  ctx.fillStyle = c1;
  ctx.fillRect(0, 4, PACK_W, 1);
  ctx.fillRect(0, PACK_H - 5, PACK_W, 1);

  // neon frame inset
  ctx.fillStyle = c1;
  ctx.fillRect(2, 7, PACK_W - 4, 1);
  ctx.fillRect(2, PACK_H - 8, PACK_W - 4, 1);
  ctx.fillRect(2, 7, 1, PACK_H - 15);
  ctx.fillRect(PACK_W - 3, 7, 1, PACK_H - 15);
  // bright frame corners
  ctx.fillStyle = c0;
  [[2, 7], [PACK_W - 4, 7], [2, PACK_H - 9], [PACK_W - 4, PACK_H - 9]].forEach(([x, y]) =>
    ctx.fillRect(x, y, 2, 2));

  // emblem window — glowing diamond core
  ctx.fillStyle = '#0a0714';
  ctx.fillRect(14, 12, 20, 20);
  ctx.fillStyle = c2;
  ctx.fillRect(14, 12, 20, 1); ctx.fillRect(14, 31, 20, 1);
  ctx.fillRect(14, 12, 1, 20); ctx.fillRect(33, 12, 1, 20);
  // diamond
  for (let dy = -6; dy <= 6; dy++) {
    const half = 6 - Math.abs(dy);
    ctx.fillStyle = c1;
    ctx.fillRect(24 - half, 22 + dy, half * 2 || 1, 1);
  }
  for (let dy = -3; dy <= 3; dy++) {
    const half = 3 - Math.abs(dy);
    ctx.fillStyle = c0;
    ctx.fillRect(24 - half, 22 + dy, half * 2 || 1, 1);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(23, 21, 2, 2);

  // circuit traces from the window to the frame
  ctx.fillStyle = c2;
  ctx.fillRect(4, 21, 10, 1); ctx.fillRect(34, 21, 10, 1);
  ctx.fillRect(4, 25, 6, 1);  ctx.fillRect(38, 25, 6, 1);
  ctx.fillStyle = c0;
  [[4, 21], [43, 21], [4, 25], [43, 25]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

  // chevron band
  for (let x = 4; x < PACK_W - 4; x++) {
    const y = 40 + Math.floor(3 * Math.abs(((x - 4) / 5) % 2 - 1));
    ctx.fillStyle = c1; ctx.fillRect(x, y, 1, 2);
    ctx.fillStyle = c3; ctx.fillRect(x, y + 2, 1, 1);
  }

  // glyph label strip
  ctx.fillStyle = '#0a0714';
  ctx.fillRect(7, 49, PACK_W - 14, 9);
  ctx.fillStyle = c2;
  ctx.fillRect(7, 49, PACK_W - 14, 1);
  ctx.fillStyle = '#eef2ff';
  for (let i = 0; i < 5; i++) ctx.fillRect(11 + i * 6, 51, 4, 5);
  ctx.fillStyle = c1;
  for (let i = 0; i < 5; i++) ctx.fillRect(12 + i * 6, 53, 2, 2);

  // scanline texture over everything
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < PACK_H; y += 3) ctx.fillRect(0, y, PACK_W, 1);

  // glints
  ctx.fillStyle = '#ffffff';
  [[8, 10], [40, 15], [11, 44], [37, 57]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

  return c;
}

/* split the art into flap + body canvases along a jagged tear line */
function renderPackCanvases(pack, flapCanvas, bodyCanvas, tearLine) {
  const art = drawPackArt(pack);
  const actx = art.getContext('2d');
  const fctx = flapCanvas.getContext('2d');
  const bctx = bodyCanvas.getContext('2d');
  fctx.clearRect(0, 0, flapCanvas.width, flapCanvas.height);
  bctx.clearRect(0, 0, bodyCanvas.width, bodyCanvas.height);
  const img = actx.getImageData(0, 0, PACK_W, PACK_H);
  const flapImg = fctx.createImageData(PACK_W, flapCanvas.height);
  const bodyImg = bctx.createImageData(PACK_W, PACK_H);
  for (let x = 0; x < PACK_W; x++) {
    const cut = tearLine[x];
    for (let y = 0; y < PACK_H; y++) {
      const si = (y * PACK_W + x) * 4;
      const target = y <= cut ? flapImg : bodyImg;
      if (y <= cut && y >= flapCanvas.height) continue;
      const di = (y * PACK_W + x) * 4;
      target.data[di] = img.data[si];
      target.data[di + 1] = img.data[si + 1];
      target.data[di + 2] = img.data[si + 2];
      target.data[di + 3] = img.data[si + 3];
    }
  }
  fctx.putImageData(flapImg, 0, 0);
  bctx.putImageData(bodyImg, 0, 0);
}

/* draw the bright torn-foil edge as the rip progresses (0..1) */
function drawTearProgress(pack, bodyCanvas, tearLine, progress) {
  const bctx = bodyCanvas.getContext('2d');
  const upto = Math.floor(progress * PACK_W);
  for (let x = 0; x < upto; x++) {
    bctx.fillStyle = '#ffffff';
    bctx.fillRect(x, tearLine[x] + 1, 1, 1);
    bctx.fillStyle = pack.colors[0];
    if (x % 3 === 0) bctx.fillRect(x, tearLine[x] + 2, 1, 1);
  }
}
