# PALAX — Pixel Pack Ripper

A Balatro-inspired, pixel-art pack-opening game. Rip packs open with your finger,
collect procedurally-generated cards across 5 rarities, gamble for coins, and
trade cards with friends via gift codes.

## Play it

No build step, no dependencies — it's a pure HTML/CSS/JS web app:

```bash
npx http-server .        # or: python3 -m http.server
```

Then open `http://localhost:8080` (works great on a phone — the rip gesture is
touch-native).

## How it works

- **Rip a pack**: buy a pack in the shop, then drag your finger/mouse across the
  *top* of the pack. The foil tears along a jagged pixel line, the flap blows
  off with particles and screen shake, and the cards pour out. Tap each card to
  flip it.
- **Rarities**: Common → Uncommon → Rare → Epic → Legendary, each with its own
  palette, glow, foil shimmer and escalating reveal animation (legendaries get a
  screen flash, gold rays of confetti, and a shimmering audio stinger).
- **Earning packs**: a free pack every 3 minutes, a *Double or Nothing*
  card-flip gamble (push your streak or cash out), and selling duplicate cards.
  Pity timers guarantee a Rare+ every 5 packs and a Legendary every 40.
- **Trading**: every card is generated from a seed, so a card can be serialized
  into a short gift code (`PLX-XXXX.N-CCCC`). Gifting removes the card from your
  collection; your friend pastes the code in their Trading Post to receive the
  exact same card. (No server needed — codes are self-contained and checksummed.)
- **Audio**: the theme song and every sound effect are synthesized live with the
  Web Audio API — a swung chiptune loop in A minor, rip noise that rises in
  pitch as your finger travels, and rarity-tiered reveal arpeggios. Zero audio
  files.
- **Art**: all pack wrappers and card art are procedural pixel art drawn on
  canvases at 48px and upscaled with `image-rendering: pixelated`, layered with
  high-quality CSS effects (foil shimmer, glows, 3D card flips) for that
  "pixelated but premium" Balatro feel.

Progress saves automatically to `localStorage`.
