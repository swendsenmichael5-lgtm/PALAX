/* ============================================================
   PALAX audio engine — 100% procedural Web Audio.
   Chiptune theme song + pack rip / card reveal sound design.
   ============================================================ */

const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let themeTimer = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(master);
    startTheme();
  }

  function resume() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  /* ---------- generic voice ---------- */
  function tone({ type = 'square', freq = 440, time = 0, dur = 0.15, vol = 0.2,
                  attack = 0.005, slide = 0, dest = null }) {
    const t = ctx.currentTime + time;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest || master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise({ time = 0, dur = 0.2, vol = 0.2, freq = 1500, q = 1, slide = 0, dest = null }) {
    const t = ctx.currentTime + time;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest || master);
    src.start(t);
  }

  /* ---------- sound effects ---------- */
  const sfx = {
    // progressive tearing — pitch rises as the rip travels
    rip(progress) {
      resume();
      noise({ dur: 0.07, vol: 0.32, freq: 900 + progress * 2600, q: 2.5, slide: 600 });
    },
    // the flap blows off — noise blast + sub boom + sparkle tail
    burst() {
      resume();
      noise({ dur: 0.5, vol: 0.55, freq: 3800, q: 0.7, slide: -3400 });
      tone({ type: 'square', freq: 180, dur: 0.3, vol: 0.25, slide: -120 });
      tone({ type: 'sawtooth', freq: 90, dur: 0.45, vol: 0.32, slide: -60 });
      tone({ type: 'sine', freq: 55, dur: 0.55, vol: 0.55, slide: -25 });
      for (let i = 0; i < 5; i++)
        tone({ type: 'sine', freq: midi(96 + (i * 5) % 12), time: 0.12 + i * 0.05, dur: 0.18, vol: 0.07 });
    },
    // suspense build while the mystery card spins
    riser(dur = 2.4) {
      resume();
      tone({ type: 'sawtooth', freq: 70, dur, vol: 0.13, slide: 580 });
      noise({ dur, vol: 0.13, freq: 500, q: 1.3, slide: 3800 });
      let at = 0, gap = 0.24;
      for (let i = 0; i < 16 && at < dur - 0.15; i++) {
        tone({ type: 'square', freq: midi(70 + i), time: at, dur: 0.05, vol: 0.09 });
        at += gap; gap *= 0.87;
      }
    },
    cardSlide(i) {
      resume();
      tone({ type: 'triangle', freq: 500 + i * 90, dur: 0.1, vol: 0.18, slide: 220 });
      noise({ time: 0.01, dur: 0.06, vol: 0.1, freq: 4000 });
    },
    flip() {
      resume();
      noise({ dur: 0.08, vol: 0.18, freq: 2800, q: 1.5, slide: 1500 });
    },
    coin() {
      resume();
      tone({ type: 'square', freq: midi(88), dur: 0.07, vol: 0.16 });
      tone({ type: 'square', freq: midi(93), time: 0.07, dur: 0.18, vol: 0.16 });
    },
    buy() {
      resume();
      tone({ type: 'square', freq: midi(72), dur: 0.08, vol: 0.18 });
      tone({ type: 'square', freq: midi(79), time: 0.08, dur: 0.12, vol: 0.18 });
    },
    deny() {
      resume();
      tone({ type: 'square', freq: midi(46), dur: 0.15, vol: 0.2 });
      tone({ type: 'square', freq: midi(44), time: 0.13, dur: 0.25, vol: 0.2 });
    },
    win() {
      resume();
      [72, 76, 79, 84].forEach((n, i) =>
        tone({ type: 'square', freq: midi(n), time: i * 0.07, dur: 0.14, vol: 0.18 }));
    },
    lose() {
      resume();
      [64, 60, 55, 48].forEach((n, i) =>
        tone({ type: 'sawtooth', freq: midi(n), time: i * 0.1, dur: 0.2, vol: 0.16 }));
    },
    // rarity reveal stingers — escalate hard
    reveal(rarity) {
      resume();
      const runs = {
        common:    [[60, 64]],
        uncommon:  [[62, 66, 69]],
        rare:      [[64, 68, 71, 76]],
        epic:      [[65, 69, 72, 77, 81]],
        legendary: [[67, 71, 74, 79, 83, 86, 91]],
      };
      const notes = runs[rarity][0];
      notes.forEach((n, i) => {
        tone({ type: 'square', freq: midi(n), time: i * 0.07, dur: 0.16, vol: 0.2 });
        if (rarity === 'epic' || rarity === 'legendary')
          tone({ type: 'triangle', freq: midi(n - 12), time: i * 0.07, dur: 0.2, vol: 0.16 });
      });
      if (rarity === 'legendary') {
        noise({ dur: 0.8, vol: 0.25, freq: 6000, q: 0.5, slide: -4500 });
        tone({ type: 'sawtooth', freq: midi(43), time: 0.1, dur: 0.9, vol: 0.22 });
        // shimmering tail
        for (let i = 0; i < 6; i++)
          tone({ type: 'sine', freq: midi(91 + (i % 3) * 4), time: 0.5 + i * 0.09, dur: 0.25, vol: 0.08 });
      }
    },
  };

  /* ---------- theme song ----------
     A mellow, swung lounge loop — soft kick, brushed hats, walking
     bass and a lazy sine lead over Am7 / Dm7 / G7 / Cmaj7.       */
  const BPM = 84;
  const STEP = 60 / BPM / 4;          // 16th note
  const BARS = 4;
  const N = BARS * 16;

  // lazy lead (midi or 0 = rest)
  const lead = [
    76,0,0,0, 0,0,74,0, 72,0,0,0, 0,0,69,0,
    74,0,0,0, 0,0,72,0, 69,0,0,0, 0,0,65,0,
    71,0,0,0, 0,0,69,0, 67,0,0,0, 62,0,64,0,
    72,0,0,0, 0,0,76,0, 79,0,0,0, 0,0,74,0,
  ];
  const bassWalk = [
    [45, 52, 57, 52],   // Am7:  A  E  a  E
    [38, 45, 50, 48],   // Dm7:  D  A  d  C
    [43, 50, 53, 47],   // G7:   G  D  F  B
    [36, 43, 48, 43],   // Cmaj7:C  G  c  G
  ];
  const padChords = [[57, 60, 64, 67], [53, 57, 62, 65], [55, 59, 62, 65], [48, 52, 55, 59]];

  let step = 0, nextTime = 0;

  function scheduleStep(s, t) {
    const when = t - ctx.currentTime;
    const bar = Math.floor(s / 16);
    const swing = (s % 4 === 2) ? STEP * 0.45 : 0;   // lazy swung off-beats
    // walking bass on the quarter notes
    if (s % 4 === 0) {
      tone({ type: 'triangle', freq: midi(bassWalk[bar][(s % 16) / 4]), time: when, dur: STEP * 3.6, vol: 0.3, attack: 0.02, dest: musicGain });
    }
    // warm pad once a bar
    if (s % 16 === 0) {
      padChords[bar].forEach(n =>
        tone({ type: 'triangle', freq: midi(n), time: when, dur: STEP * 15, vol: 0.028, attack: 0.5, dest: musicGain }));
    }
    // lazy sine lead with a quiet echo
    if (lead[s]) {
      tone({ type: 'sine', freq: midi(lead[s]), time: when + swing, dur: STEP * 4.5, vol: 0.15, attack: 0.03, dest: musicGain });
      tone({ type: 'sine', freq: midi(lead[s]), time: when + swing + STEP * 4, dur: STEP * 3, vol: 0.05, attack: 0.03, dest: musicGain });
    }
    if (s % 16 === 0) tone({ type: 'sine', freq: 85, time: when, dur: 0.12, vol: 0.3, slide: -45, dest: musicGain });  // soft kick
    if (s % 16 === 8) noise({ time: when, dur: 0.2, vol: 0.06, freq: 2600, q: 0.6, dest: musicGain });                 // brushed snare
    if (s % 4 === 2) noise({ time: when + swing, dur: 0.05, vol: 0.035, freq: 9000, dest: musicGain });                // swung hat
  }

  function startTheme() {
    if (themeTimer) return;
    nextTime = ctx.currentTime + 0.1;
    themeTimer = setInterval(() => {
      while (nextTime < ctx.currentTime + 0.15) {
        scheduleStep(step, nextTime);
        step = (step + 1) % N;
        nextTime += STEP;
      }
    }, 30);
  }

  return { resume, setMuted, sfx, get muted() { return muted; } };
})();
