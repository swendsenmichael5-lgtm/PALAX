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

/* ============================================================
   3x5 pixel font — lets the whole card be true pixel art,
   name and stats included. Each glyph: 5 rows x 3 bits.
   ============================================================ */
const FONT3X5 = {
  A:0b010101111101101, B:0b110101110101110, C:0b011100100100011, D:0b110101101101110,
  E:0b111100110100111, F:0b111100110100100, G:0b011100101101011, H:0b101101111101101,
  I:0b111010010010111, J:0b001001001101010, K:0b101101110101101, L:0b100100100100111,
  M:0b101111111101101, N:0b110101101101101, O:0b010101101101010, P:0b110101110100100,
  Q:0b010101101110011, R:0b110101110101101, S:0b011100010001110, T:0b111010010010010,
  U:0b101101101101111, V:0b101101101101010, W:0b101101111111101, X:0b101101010101101,
  Y:0b101101010010010, Z:0b111001010100111,
  '0':0b111101101101111, '1':0b010110010010111, '2':0b111001111100111, '3':0b111001011001111,
  '4':0b101101111001001, '5':0b111100111001111, '6':0b111100111101111, '7':0b111001010010010,
  '8':0b111101111101111, '9':0b111101111001111,
  '?':0b111001011000010, '-':0b000000111000000, '%':0b101001010100101, ' ':0,
};

function drawText(ctx, str, x, y, color) {
  ctx.fillStyle = color;
  for (const ch of String(str).toUpperCase()) {
    const bits = FONT3X5[ch] ?? FONT3X5['?'];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++)
        if (bits >> ((4 - r) * 3 + (2 - c)) & 1) ctx.fillRect(x + c, y + r, 1, 1);
    x += 4;
  }
  return x;
}
const textW = str => String(str).length * 4 - 1;

/* per-rarity card frame metals */
const FRAMES = {
  common:    ['#aab4c2', '#5d6878', '#2a3242'],
  uncommon:  ['#9fe7b2', '#3a9c58', '#1b5230'],
  rare:      ['#a8d4ff', '#3d7fc1', '#1a3f63'],
  epic:      ['#dcb8ff', '#8a4cc4', '#4a1d73'],
  legendary: ['#fff3c4', '#e8a81c', '#8a4d0f'],
};

/* card geometry (logical pixels) — CSS holo masks must match */
const CARD_W = 64, CARD_H = 90;
const ART = { x: 4, y: 17, w: 56, h: 44 };   // art window

/* Draw the ENTIRE card face as pixel art: frame, name plate,
   synthwave art window, stats bar, rarity gems. */
function drawCardFace(canvas, card) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const pal = RARITIES[card.rarity].palette;
  const [fLight, fMid, fDark] = FRAMES[card.rarity];
  const rnd = mulberry32(card.seed ^ 0x9E3779B9);
  const idx = RARITY_ORDER.indexOf(card.rarity);

  // base + tinted dither
  ctx.fillStyle = '#14101d';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = fDark;
  for (let y = 0; y < CARD_H; y += 2)
    for (let x = (y % 4 === 0 ? 0 : 2); x < CARD_W; x += 4) ctx.fillRect(x, y, 1, 1);

  // metal frame: outer dark, mid band, inner light edge
  ctx.fillStyle = '#07050f';
  ctx.fillRect(0, 0, CARD_W, 1); ctx.fillRect(0, CARD_H - 1, CARD_W, 1);
  ctx.fillRect(0, 0, 1, CARD_H); ctx.fillRect(CARD_W - 1, 0, 1, CARD_H);
  ctx.fillStyle = fMid;
  ctx.fillRect(1, 1, CARD_W - 2, 1); ctx.fillRect(1, CARD_H - 2, CARD_W - 2, 1);
  ctx.fillRect(1, 1, 1, CARD_H - 2); ctx.fillRect(CARD_W - 2, 1, 1, CARD_H - 2);
  ctx.fillStyle = fLight;
  ctx.fillRect(1, 1, CARD_W - 2, 1);
  ctx.fillRect(1, 1, 1, 12);
  // frame corner studs
  ctx.fillStyle = fLight;
  [[2, 2], [CARD_W - 4, 2], [2, CARD_H - 4], [CARD_W - 4, CARD_H - 4]].forEach(([x, y]) =>
    ctx.fillRect(x, y, 2, 2));

  // name plate (two lines)
  ctx.fillStyle = '#0a0714';
  ctx.fillRect(3, 3, CARD_W - 6, 13);
  ctx.fillStyle = fMid;
  ctx.fillRect(3, 15, CARD_W - 6, 1);
  const [n1, n2] = card.name.split(' ');
  drawText(ctx, n1, Math.floor((CARD_W - textW(n1)) / 2), 4, '#eef2ff');
  drawText(ctx, n2 || '', Math.floor((CARD_W - textW(n2 || '')) / 2), 10, pal[0]);

  // ---- art window: moonlit night scene ----
  const BASE = ART.y + ART.h;            // bottom of window
  for (let y = ART.y; y < BASE; y++) {   // night-sky gradient, tinted by rarity
    const t = (y - ART.y) / ART.h;
    ctx.fillStyle = t < 0.25 ? '#0a0d14' : (t < 0.55 ? '#11161f' : pal[3]);
    ctx.fillRect(ART.x, y, ART.w, 1);
  }
  for (let i = 0; i < 14; i++) {  // stars
    ctx.fillStyle = rnd() < 0.7 ? '#f1e9d6' : pal[0];
    ctx.fillRect(ART.x + Math.floor(rnd() * ART.w), ART.y + Math.floor(rnd() * 20), 1, 1);
  }
  // crescent moon, upper right
  const mx = ART.x + ART.w - 11, my = ART.y + 9, mr = 5;
  for (let dy = -mr; dy <= mr; dy++) {
    const half = Math.floor(Math.sqrt(mr * mr - dy * dy));
    ctx.fillStyle = '#f6e9c8';
    ctx.fillRect(mx - half, my + dy, half * 2 || 1, 1);
  }
  for (let dy = -mr; dy <= mr; dy++) {   // carve the shadow side
    const half = Math.floor(Math.sqrt(mr * mr - dy * dy));
    ctx.fillStyle = '#11161f';
    ctx.fillRect(mx + 2 - half, my + dy, half * 2 || 1, 1);
  }
  // mountain silhouettes along the base
  const p1 = ART.x + Math.floor(ART.w * 0.28), p2 = ART.x + Math.floor(ART.w * 0.74);
  for (let x = ART.x; x < ART.x + ART.w; x++) {
    const h = Math.max(0, 13 - Math.abs(x - p1), 17 - Math.floor(Math.abs(x - p2) * 0.8));
    if (h > 0) {
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(x, BASE - h, 1, h);
      ctx.fillStyle = pal[2];               // rarity-tinted ridge light
      ctx.fillRect(x, BASE - h, 1, 1);
    }
  }
  // low mist bands
  ctx.fillStyle = 'rgba(241,233,214,0.14)';
  ctx.fillRect(ART.x + 3, BASE - 5, ART.w - 9, 1);
  ctx.fillRect(ART.x + 9, BASE - 3, ART.w - 15, 1);

  // creature sprite, 14x14 mirrored at 3x — big and chunky
  const G = 14, sc = 3;
  const ox = ART.x + Math.floor((ART.w - G * sc) / 2);
  const oy = ART.y + Math.floor((ART.h - G * sc) / 2) + 1;
  const srnd = mulberry32(card.seed);
  ctx.fillStyle = 'rgba(5,3,12,0.7)';
  ctx.fillRect(ox - 2, oy - 2, G * sc + 4, G * sc + 4);
  for (let y = 0; y < G; y++)
    for (let x = 0; x < Math.ceil(G / 2); x++)
      if (srnd() < 0.46) {
        ctx.fillStyle = pal[Math.floor(srnd() * 3)];
        ctx.fillRect(ox + x * sc, oy + y * sc, sc, sc);
        ctx.fillRect(ox + (G - 1 - x) * sc, oy + y * sc, sc, sc);
      }
  ctx.fillStyle = card.rarity === 'legendary' ? '#fff7d6' : '#ffffff';
  ctx.fillRect(ox + 12, oy + 12, sc, sc);
  ctx.fillRect(ox + G * sc - 12 - sc, oy + 12, sc, sc);

  // art window frame
  ctx.fillStyle = fMid;
  ctx.fillRect(ART.x - 1, ART.y - 1, ART.w + 2, 1);
  ctx.fillRect(ART.x - 1, ART.y + ART.h, ART.w + 2, 1);
  ctx.fillRect(ART.x - 1, ART.y - 1, 1, ART.h + 2);
  ctx.fillRect(ART.x + ART.w, ART.y - 1, 1, ART.h + 2);

  // ---- stats bar ----
  const PWR = 10 + Math.floor(mulberry32(card.seed ^ 0xBEEF)() * 29) * 10;
  // rarity gems
  for (let g = 0; g <= idx; g++) {
    const gx = 6 + g * 6, gy = 65;
    ctx.fillStyle = pal[1];
    ctx.fillRect(gx + 1, gy, 1, 1); ctx.fillRect(gx, gy + 1, 3, 1); ctx.fillRect(gx + 1, gy + 2, 1, 1);
    ctx.fillStyle = pal[0];
    ctx.fillRect(gx + 1, gy + 1, 1, 1);
  }
  const pwrTxt = `PWR ${PWR}`;
  drawText(ctx, pwrTxt, CARD_W - 5 - textW(pwrTxt), 64, '#eef2ff');
  ctx.fillStyle = fMid;
  ctx.fillRect(4, 71, CARD_W - 8, 1);
  drawText(ctx, RARITIES[card.rarity].label, 6, 75, pal[1]);
  drawText(ctx, 'PLX', CARD_W - 5 - textW('PLX'), 75, fMid);
  drawText(ctx, '2086', 6, 82, '#3d4458');
  // set gem
  ctx.fillStyle = fLight;
  ctx.fillRect(CARD_W - 9, 82, 4, 4);
  ctx.fillStyle = fDark;
  ctx.fillRect(CARD_W - 8, 83, 2, 2);

  // baked glitter on epic+
  if (idx >= 3) {
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rnd() < 0.5 ? '#ffffff' : pal[0];
      ctx.fillRect(1 + Math.floor(rnd() * (CARD_W - 2)), 1 + Math.floor(rnd() * (CARD_H - 2)), 1, 1);
    }
  }
}

/* Build a DOM element for a card (used in reveal + collection).
   Pokemon-style holo layers by rarity:
   - rare:      holo ART WINDOW (classic holo rare)
   - epic:      galaxy foil over the whole card (reverse-holo vibes)
   - legendary: full rainbow foil + sweeping light beam + sparkles */
function buildCardEl(card, { faceUp = false } = {}) {
  const el = document.createElement('div');
  el.className = `game-card r-${card.rarity}` + (faceUp ? ' flipped' : '');
  const front = document.createElement('div');
  front.className = 'card-face card-front';
  const art = document.createElement('canvas');
  art.className = 'card-art';
  drawCardFace(art, card);
  front.appendChild(art);

  const addLayer = cls => {
    const d = document.createElement('div');
    d.className = 'holo ' + cls;
    front.appendChild(d);
  };
  if (card.rarity === 'rare') addLayer('holo-art');
  if (card.rarity === 'epic') { addLayer('holo-galaxy'); addLayer('sparkles'); }
  if (card.rarity === 'legendary') { addLayer('holo-full'); addLayer('beam'); addLayer('sparkles'); }

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
   Premium pouch: deep navy foil, gold pinstripe trim, crest
   medallion with a crescent moon, ivory label plate. */
function drawPackArt(pack) {
  const c = document.createElement('canvas');
  c.width = PACK_W; c.height = PACK_H;
  const ctx = c.getContext('2d');
  const [c0, c1, c2, c3] = pack.colors;   // gold ramp: light → dark

  // navy foil body with soft vertical shading
  for (let x = 0; x < PACK_W; x++) {
    ctx.fillStyle = x < 8 ? '#27303f' : (x < 34 ? '#1f2734' : '#181f2a');
    ctx.fillRect(x, 0, 1, PACK_H);
  }
  // faint diagonal weave
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < PACK_H; y++)
    for (let x = (y % 4); x < PACK_W; x += 4) ctx.fillRect(x, y, 1, 1);

  // crimp zigzag top + bottom
  for (let x = 0; x < PACK_W; x += 2) {
    ctx.fillStyle = '#101620'; ctx.fillRect(x, 0, 1, 4);
    ctx.fillStyle = '#2c3644'; ctx.fillRect(x + 1, 0, 1, 4);
    ctx.fillStyle = '#2c3644'; ctx.fillRect(x, PACK_H - 4, 1, 4);
    ctx.fillStyle = '#101620'; ctx.fillRect(x + 1, PACK_H - 4, 1, 4);
  }
  ctx.fillStyle = c1;
  ctx.fillRect(0, 4, PACK_W, 1);
  ctx.fillRect(0, PACK_H - 5, PACK_W, 1);

  // double gold pinstripe frame
  ctx.fillStyle = c1;
  ctx.fillRect(2, 7, PACK_W - 4, 1);
  ctx.fillRect(2, PACK_H - 8, PACK_W - 4, 1);
  ctx.fillRect(2, 7, 1, PACK_H - 15);
  ctx.fillRect(PACK_W - 3, 7, 1, PACK_H - 15);
  ctx.fillStyle = c2;
  ctx.fillRect(4, 9, PACK_W - 8, 1);
  ctx.fillRect(4, PACK_H - 10, PACK_W - 8, 1);
  ctx.fillRect(4, 9, 1, PACK_H - 19);
  ctx.fillRect(PACK_W - 5, 9, 1, PACK_H - 19);

  // crest medallion: gold ring with crescent moon
  const cx = 24, cy = 25, R = 11;
  for (let dy = -R; dy <= R; dy++) {
    const half = Math.floor(Math.sqrt(R * R - dy * dy));
    ctx.fillStyle = c2;
    ctx.fillRect(cx - half, cy + dy, half * 2 || 1, 1);
  }
  for (let dy = -(R - 2); dy <= R - 2; dy++) {
    const half = Math.floor(Math.sqrt((R - 2) * (R - 2) - dy * dy));
    ctx.fillStyle = '#141a24';
    ctx.fillRect(cx - half, cy + dy, half * 2 || 1, 1);
  }
  ctx.fillStyle = c0;   // ring highlight
  ctx.fillRect(cx - 4, cy - R, 8, 1);
  // crescent inside
  for (let dy = -5; dy <= 5; dy++) {
    const half = Math.floor(Math.sqrt(25 - dy * dy));
    ctx.fillStyle = c1;
    ctx.fillRect(cx - half, cy + dy, half * 2 || 1, 1);
  }
  for (let dy = -5; dy <= 5; dy++) {
    const half = Math.floor(Math.sqrt(25 - dy * dy));
    ctx.fillStyle = '#141a24';
    ctx.fillRect(cx + 2 - half, cy + dy, half * 2 || 1, 1);
  }
  // tiny star by the moon
  ctx.fillStyle = c0;
  ctx.fillRect(cx + 3, cy - 2, 1, 3);
  ctx.fillRect(cx + 2, cy - 1, 3, 1);

  // gold chevron divider
  for (let x = 6; x < PACK_W - 6; x++) {
    const y = 42 + Math.floor(2 * Math.abs(((x - 6) / 6) % 2 - 1));
    ctx.fillStyle = c1; ctx.fillRect(x, y, 1, 1);
  }

  // ivory label plate with glyph marks
  ctx.fillStyle = '#e9dfc8';
  ctx.fillRect(8, 48, PACK_W - 16, 11);
  ctx.fillStyle = '#b3a786';
  ctx.fillRect(8, 58, PACK_W - 16, 1);
  ctx.fillStyle = '#2a2415';
  for (let i = 0; i < 5; i++) ctx.fillRect(12 + i * 5, 51, 3, 5);
  ctx.fillStyle = '#e9dfc8';
  for (let i = 0; i < 5; i++) ctx.fillRect(13 + i * 5, 53, 1, 1);

  // sparkle glints
  ctx.fillStyle = '#fffaf0';
  [[9, 13], [38, 18], [13, 38], [40, 62]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 1));

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
