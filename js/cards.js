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

/* Draw a card's pixel art onto a canvas (logical 48x48 art panel). */
function drawCardArt(canvas, card) {
  const S = 48;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  const pal = RARITIES[card.rarity].palette;
  const rnd = mulberry32(card.seed ^ 0x9E3779B9);

  // backdrop: dithered gradient in rarity tones
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = y / S + (rnd() - 0.5) * 0.25;
      ctx.fillStyle = t < 0.45 ? pal[3] : (t < 0.8 ? '#1b2026' : '#11151b');
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // sparkle field for epic+
  if (card.rarity === 'epic' || card.rarity === 'legendary') {
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rnd() < 0.5 ? pal[0] : '#ffffff';
      ctx.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1, 1);
    }
  }

  // mirrored creature sprite, 14x14 cells at 2x scale, centered
  const G = 14, scale = 2;
  const off = Math.floor((S - G * scale) / 2);
  const srnd = mulberry32(card.seed);
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

  // frame
  ctx.fillStyle = pal[2];
  ctx.fillRect(0, 0, S, 1); ctx.fillRect(0, S - 1, S, 1);
  ctx.fillRect(0, 0, 1, S); ctx.fillRect(S - 1, 0, 1, S);
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

/* full wrapper art on an offscreen canvas */
function drawPackArt(pack) {
  const c = document.createElement('canvas');
  c.width = PACK_W; c.height = PACK_H;
  const ctx = c.getContext('2d');
  const [c0, c1, c2, c3] = pack.colors;

  // body with vertical foil shading bands
  for (let x = 0; x < PACK_W; x++) {
    const t = x / PACK_W;
    ctx.fillStyle = t < 0.14 ? c0 : (t < 0.55 ? c1 : (t < 0.85 ? c2 : c3));
    ctx.fillRect(x, 0, 1, PACK_H);
  }
  // bright sheen stripes
  ctx.fillStyle = c0;
  for (let x = 0; x < PACK_W; x++) {
    if (x % 13 < 2) ctx.fillRect(x, 0, 1, PACK_H);
  }
  // diamond foil texture
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = c0;
  for (let y = 0; y < PACK_H; y += 4) {
    for (let x = (y % 8 === 0 ? 0 : 2); x < PACK_W; x += 4) ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  // diagonal zigzag band with shadow
  for (let x = 0; x < PACK_W; x++) {
    const y = 34 + Math.floor(5 * Math.abs(((x / 6) % 2) - 1));
    ctx.fillStyle = c3; ctx.fillRect(x, y + 7, 1, 2);
    ctx.fillStyle = c2; ctx.fillRect(x, y, 1, 7);
    ctx.fillStyle = c0; ctx.fillRect(x, y, 1, 1);
  }
  // crimp tops and bottoms
  ctx.fillStyle = c3;
  for (let x = 0; x < PACK_W; x += 2) {
    ctx.fillRect(x, 0, 1, 4);
    ctx.fillRect(x + 1, PACK_H - 4, 1, 4);
  }
  ctx.fillRect(0, 4, PACK_W, 1);
  ctx.fillRect(0, PACK_H - 5, PACK_W, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, 5, PACK_W, 1);

  // label plate with bevel
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(5, 17, PACK_W - 10, 15);
  ctx.fillStyle = '#14181f';
  ctx.fillRect(6, 18, PACK_W - 12, 12);
  ctx.fillStyle = c0;
  ctx.fillRect(6, 18, PACK_W - 12, 1);
  ctx.fillStyle = c3;
  ctx.fillRect(6, 29, PACK_W - 12, 1);
  // tiny pixel "PALAX" mark (abstract glyph row)
  ctx.fillStyle = '#f4f1e8';
  for (let i = 0; i < 5; i++) ctx.fillRect(10 + i * 6, 21, 4, 6);
  ctx.fillStyle = c2;
  for (let i = 0; i < 5; i++) ctx.fillRect(11 + i * 6, 23, 2, 2);

  // glowing star burst under label
  ctx.fillStyle = c3;
  ctx.fillRect(21, 47, 6, 6);
  ctx.fillStyle = c0;
  ctx.fillRect(22, 48, 4, 4);
  ctx.fillRect(23, 45, 2, 10);
  ctx.fillRect(19, 49, 10, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(23, 48, 2, 2);

  // sparkle glints
  ctx.fillStyle = '#ffffff';
  [[9, 10], [39, 14], [14, 56], [36, 52], [42, 38]].forEach(([x, y]) => {
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1);
    ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
    ctx.globalAlpha = 1;
  });

  // edge shading + rim light
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, 2, PACK_H);
  ctx.fillRect(PACK_W - 2, 0, 2, PACK_H);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(2, 0, 1, PACK_H);
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
