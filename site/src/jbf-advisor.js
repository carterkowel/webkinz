/*!
 * <jbf-advisor>: an unofficial helper for playing Jumbleberry Fields in Webkinz.
 * Enter the berries you rolled; it tells you which jars to lock or which box to fill.
 * Needs jbf-engine.js loaded first.
 *
 *   <script src="jbf-engine.js"></script>
 *   <script src="jbf-advisor.js"></script>
 *   <jbf-advisor></jbf-advisor>                 optional attribute: theme="light" | "dark"
 */
(function () {
  'use strict';
  const BERRY = [
    { k: 'J', name: 'Jumbleberry', tok: 'j' }, { k: 'S', name: 'Sugarberry', tok: 's' },
    { k: 'P', name: 'Pickleberry', tok: 'p' }, { k: 'M', name: 'Moonberry', tok: 'm' }, { k: 'F', name: 'Fly', tok: 'f' },
  ];
  const BOX = ['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry', 'Basket of 3', 'Basket of 4', 'Basket of 5', 'Mixed Basket', 'Free Roll'];
  // Moonberries per game for each goal, from 200,000 simulated games per strategy.
  const GOALS = [
    { id: 'moon', label: 'Most Moonberries', sub: '0.67 Moonberries a game', tag: 'Best long-run' },
    { id: 't121', label: '1 Moonberry (121+)', sub: '0.64 a game · 58% reach 121' },
    { id: 't141', label: '2 Moonberries (141+)', sub: '0.46 a game · 11% reach 141' },
    { id: 'avg', label: 'Highest score', sub: '0.62 a game · avg 121.8' },
  ];
  const STORE = 'jbf-advisor-v1';

  const CSS = `
  :host { --bg:#f6f4fb; --card:#ffffff; --ink:#221d33; --ink2:#575069; --muted:#8a8499; --line:#dedae8; --accent:#5b3aa8; --accent-ink:#fff;
    --soft:#ece6f8; --lock:#c98a00; --j:#d8433b; --s:#e2a60f; --p:#4b9a39; --m:#6f45c6; --f:#46434f;
    display:block; color:var(--ink); background:var(--bg); border-radius:18px; padding:clamp(12px,3vw,20px); max-width:560px; margin-inline:auto; }
  @media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { --bg:#15131c; --card:#1e1b27; --ink:#f0edf6; --ink2:#c4bfd2; --muted:#8f8a9e;
    --line:#322e3f; --accent:#b39af0; --accent-ink:#15131c; --soft:#2a2340; --lock:#f0c24e; --j:#e5534a; --s:#e9b52c; --p:#5aab47; --m:#9a7cf0; --f:#77737f; } }
  :host([theme="dark"]) { --bg:#15131c; --card:#1e1b27; --ink:#f0edf6; --ink2:#c4bfd2; --muted:#8f8a9e;
    --line:#322e3f; --accent:#b39af0; --accent-ink:#15131c; --soft:#2a2340; --lock:#f0c24e; --j:#e5534a; --s:#e9b52c; --p:#5aab47; --m:#9a7cf0; --f:#77737f; }
  * { box-sizing:border-box; } button, input { font:inherit; color:inherit; }
  :focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
  .stack { display:grid; gap:14px; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .lab { font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:700; }
  .goals { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:8px; }
  .goal { text-align:left; border:1.5px solid var(--line); background:var(--card); border-radius:12px; padding:8px 10px; cursor:pointer; display:grid; gap:1px; position:relative; }
  .goal b { font-size:.92rem; } .goal span { font-size:.76rem; color:var(--ink2); }
  .goal[aria-pressed="true"] { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent); }
  .goal i { position:absolute; top:-8px; right:8px; font-style:normal; font-size:.65rem; font-weight:800; background:var(--accent); color:var(--accent-ink); padding:1px 6px; border-radius:6px; }
  .status { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px 14px; font-size:.95rem; color:var(--ink2); }
  .status > span { white-space:nowrap; }
  .status b { color:var(--ink); font-variant-numeric:tabular-nums; }
  .rolls { display:flex; gap:6px; } .rolls button { border:1.5px solid var(--line); background:var(--card); border-radius:9px; padding:4px 10px; cursor:pointer; font-size:.85rem; }
  .rolls button[aria-pressed="true"] { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
  .jars { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:6px; }
  .jar { aspect-ratio:3/4; border:2px dashed var(--line); border-radius:14px; background:var(--card); display:grid; place-items:center; align-content:center; gap:4px; cursor:pointer; position:relative; padding:4px; }
  .jar.full { border-style:solid; }
  .jar.next { border-color:var(--accent); }
  .jar.lock { border-color:var(--lock); border-width:3px; }
  .jar.lock::before { content:"LOCK"; position:absolute; top:-9px; background:var(--lock); color:#1d1608; font-size:.6rem; font-weight:800; letter-spacing:.06em; padding:1px 6px; border-radius:6px; }
  .jar small { font-size:.62rem; color:var(--ink2); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chip { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:800; font-size:.85rem; }
  .c-j{background:var(--j)} .c-s{background:var(--s); color:#231d33} .c-p{background:var(--p)} .c-m{background:var(--m)} .c-f{background:var(--f)}
  .palette { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:6px; }
  .pal { border:1.5px solid var(--line); background:var(--card); border-radius:12px; padding:8px 2px; cursor:pointer; display:grid; place-items:center; gap:4px; min-height:64px; }
  .pal small { font-size:.66rem; color:var(--ink2); }
  .advice { background:var(--soft); border-radius:14px; padding:14px; display:grid; gap:8px; }
  .advice .what { font-size:1.2rem; font-weight:800; line-height:1.3; }
  .advice .why { font-size:.9rem; color:var(--ink2); }
  .btn { background:var(--accent); color:var(--accent-ink); border:0; border-radius:12px; padding:10px 16px; font-weight:800; cursor:pointer; }
  .ghost { background:transparent; border:1.5px solid var(--line); border-radius:10px; padding:7px 12px; cursor:pointer; color:var(--ink2); font-size:.88rem; }
  details { font-size:.88rem; color:var(--ink2); } summary { cursor:pointer; }
  ol.alts { margin:6px 0 0; padding-left:20px; display:grid; gap:3px; }
  .card9 { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:6px; }
  .bx { border:1.5px solid var(--line); background:var(--card); border-radius:10px; padding:6px 8px; display:grid; gap:0; text-align:left; cursor:pointer; min-width:0; }
  .bx span { font-size:.74rem; color:var(--ink2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .bx b { font-size:1rem; font-variant-numeric:tabular-nums; min-height:1.3em; }
  .bx.used { background:transparent; } .bx.used b { color:var(--ink); } .bx.open b { color:var(--muted); font-weight:500; }
  .bx.rec { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent); }
  .bx input { width:100%; border:1px solid var(--line); border-radius:6px; padding:2px 4px; background:var(--bg); }
  .note { font-size:.78rem; color:var(--muted); }
  .cam { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .camlabel { display:inline-flex; align-items:center; gap:6px; border:1.5px solid var(--accent); color:var(--accent); border-radius:10px; padding:7px 12px; cursor:pointer; font-weight:800; font-size:.9rem; }
  .camlabel:focus-within { outline:3px solid var(--accent); outline-offset:2px; }
  .cammsg { font-size:.82rem; color:var(--ink2); flex:1 1 12rem; min-width:0; } .cammsg.err { color:#c0392b; }
  .camtools { border-top:1px solid var(--line); padding-top:10px; }
  .camtools summary { font-weight:700; color:var(--ink2); }
  .camtools .cam { margin-top:10px; }
  .live { position:fixed; inset:0; z-index:2147483000; background:#000; color:#fff; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
  .live[hidden] { display:none; }
  .live .stage { position:absolute; inset:0; overflow:hidden; }
  .live video { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
  .live .ov { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
  .live .mk { fill:none; stroke:rgba(255,255,255,.7); stroke-width:2; }
  .live .lockmk { stroke:#ffd23f; stroke-width:6; }
  .live .ok { stroke:#3ddc84; stroke-width:5; } .live .bad { stroke:#ff5a5a; stroke-width:6; }
  .live .halo { fill:none; stroke:rgba(10,8,20,.85); stroke-width:10; stroke-linejoin:round; }
  .live .go { fill:rgba(255,255,255,.18); stroke:#fff; stroke-width:4; stroke-linejoin:round; animation:pulse 0.9s ease-in-out infinite alternate; }
  @keyframes pulse { from { stroke-opacity:1; fill-opacity:1; } to { stroke-opacity:.35; fill-opacity:.3; } }
  @media (prefers-reduced-motion: reduce) { .live .go { animation:none; } }
  .live .okl { fill:#3ddc84; } .live .badl { fill:#ff5a5a; } .live .gol { fill:#fff; font-size:24px; stroke-width:5px; }
  .total { font-size:.88rem; color:var(--ink2); } .total input { width:5em; margin-left:4px; border:1px solid var(--line); border-radius:6px; padding:2px 4px; background:var(--bg); }
  .live .lbl { fill:#fff; font:800 17px system-ui,sans-serif; text-anchor:middle; paint-order:stroke; stroke:#000; stroke-width:4px; }
  .live .lk { fill:#ffd23f; }
  .ltop { position:absolute; top:0; left:0; right:0; display:flex; justify-content:space-between; align-items:flex-start; gap:8px;
    padding:max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 18px max(12px, env(safe-area-inset-left));
    background:linear-gradient(rgba(0,0,0,.75), transparent); font-size:.85rem; }
  .lstat { line-height:1.6; padding-top:4px; }
  .lstat button { background:none; border:0; padding:0; color:inherit; font:inherit; cursor:pointer; text-decoration:underline dotted; text-underline-offset:3px; }
  .lclose { background:rgba(255,255,255,.95); color:#15131c; border:0; border-radius:10px; padding:9px 14px; font-weight:800; cursor:pointer; flex:none; }
  .lbot { position:absolute; left:0; right:0; bottom:0; display:grid; gap:6px;
    padding:28px max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    background:linear-gradient(transparent, rgba(0,0,0,.85) 30%); }
  .lwhat { font-size:1.45rem; font-weight:800; line-height:1.25; }
  .lwhy { font-size:.9rem; opacity:.85; } .lwhy:empty { display:none; }
  /* sideways: the camera picture on the left, what to do in a panel on the right, so nothing covers the game */
  @media (orientation: landscape) {
    .live { display:grid; grid-template-columns:minmax(0,1fr) clamp(190px, 30vw, 360px); grid-template-rows:auto minmax(0,1fr); }
    .live .stage { position:relative; inset:auto; grid-column:1; grid-row:1 / span 2; }
    .ltop { position:static; grid-column:2; grid-row:1; background:none; flex-wrap:wrap-reverse; justify-content:flex-end;
      padding:max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 4px 12px; }
    .lstat { flex:1 1 100%; }
    .lbot { position:static; grid-column:2; grid-row:2; background:none; align-content:start; overflow-y:auto;
      padding:8px max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) 12px; }
    .lwhat { font-size:1.25rem; }
  }
  .meter { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:6px; }
  .meter div { background:var(--card); border:1.5px solid var(--line); border-radius:10px; padding:6px 8px; display:grid; gap:0; }
  .meter b { font-size:1.15rem; font-variant-numeric:tabular-nums; } .meter span { font-size:.7rem; color:var(--ink2); line-height:1.25; }
  .meter .hi b { color:var(--accent); }
  .bar { height:4px; background:var(--line); border-radius:2px; overflow:hidden; } .bar > div { height:100%; background:var(--accent); }
  `;

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } };
  const persist = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* ignore */ } };
  const fresh = (goal = 'moon') => ({ goal, boxes: Array(9).fill(null), roll: 1, jars: [null, null, null, null, null], locked: [false, false, false, false, false], edit: false, sel: null,
    unk: Array(9).fill(false), adj: null });   // unk: box seen used on the camera, points unknown; adj: correction so the total matches the game
  const pct = (x) => (100 * x).toFixed(1) + '%';
  let MAXP = null;   // the most each box can score, over every possible hand
  const maxPoints = () => {
    if (MAXP) return MAXP;
    MAXP = Array(9).fill(0);
    for (let j = 0; j <= 5; j++) for (let s = 0; s <= 5 - j; s++) for (let p = 0; p <= 5 - j - s; p++) for (let m = 0; m <= 5 - j - s - p; m++) {
      const hand = [j, s, p, m, 5 - j - s - p - m];
      for (let c = 0; c < 9; c++) MAXP[c] = Math.max(MAXP[c], BerryEngine.scoreBox(hand, c));
    }
    return MAXP;
  };
  // what the live camera has seen so far (times are performance.now() milliseconds)
  const liveState = () => ({
    frame: 0, cur: null,                       // the latest frame read
    good: null, goodAt: -1e9, lost: 0,         // the latest frame showing the game, and since when it's been out of view (0 = in view)
    key: null, keyN: 0, keyAt: 0, st: null,    // the jars must read the same twice in a row; st = that steady reading
    win: [], B: null, ctrAt: 0,                // recent scorecard / ROLL / roll counter readings, their vote, when the counter last changed
    sc: { v: null, n: 0, at: -99, since: 0 }, drift: { v: null, at: 0 },  // the SCORE number, and since when it has disagreed with the helper
    hint: '', hintN: 0, hintShown: '',         // camera-position tip, shown once it holds for a few frames
    stale: null,                               // berries left in the jars after a box was clicked, until the next roll
    startup: true, adoptPending: true, prov: [], unsure: false, rollOff: false, lockSeen: false,
    guess: null, ended: null, note: '', noteAt: -1e9, pend: 0,   // pend: when a click was first noticed, while working out which box
    firstAt: 0, extraKey: '', extraAt: 0,      // when the game was first seen; boxes the game shows filled that we have open, and since when
    blankSince: Array(9).fill(0),              // per box: since when the game has shown it blank while we have it used (0 = not)
    litSince: Array(9).fill(0),                // per box: since when the scorecard has shown it with points (0 = not)
    handCtr: null,                             // the x-sign's rolls left, last seen with this hand (before any click)
    handSc: null,                              // the game's SCORE as first read with this hand: SCORE jumps are measured from it
    x3Seen: false,                             // the x3 sign has shown since the last click or roll
    missed: null,                              // new berries came before we could tell if a box was clicked: { hand, sc, at, rec }
    undo: null,                                // a click we recorded but the game hasn't confirmed yet: the game as it was before it
    distrust: false,                           // a recorded click turned out wrong: don't guess another one for this hand
  });
  const same = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);
  const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  class JbfAdvisor extends HTMLElement {
    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
      this.root.innerHTML = `<style>${CSS}</style><div class="app"></div><div class="live" hidden></div>`;
      this.s = load() || fresh();
      if (!this.s.unk) this.s.unk = Array(9).fill(false);
      if (this.s.adj === undefined) this.s.adj = null;
      this.progress = null;
    }
    connectedCallback() { this.ensure(); this.render(); }
    disconnectedCallback() { this.stopLive(); }
    ensure() {
      const goal = this.s.goal;
      if (goal !== 'avg' && !BerryEngine.isReady(goal) && this.progress === null) {
        this.progress = 0;
        BerryEngine.prepare(goal, (p) => { this.progress = p; this.renderProgress(); })
          .then(() => { this.progress = null; this.render(); this.prepareMeter(); });
      } else this.prepareMeter();
    }
    // the odds meter needs the 121 and 141 solvers too; build them quietly in the background
    async prepareMeter() {
      if (this.meterBusy) return;
      this.meterBusy = true;
      for (const g of ['t121', 't141']) if (!BerryEngine.isReady(g)) { await BerryEngine.prepare(g); this.render(); }
      this.meterBusy = false;
    }
    meter() {
      const s = this.s, mask = this.mask, score = this.score;
      if (mask === 511) return '';
      const full = s.jars.every((j) => j !== null);
      const val = (goal) => {
        if (!BerryEngine.isReady(goal)) return null;
        return full ? BerryEngine.rankOptions(goal, { mask, score, roll: s.roll, hand: this.hand() })[0][goal === 'avg' ? 'ev' : 'value']
          : BerryEngine.roundStartValue(goal, mask, score);
      };
      const p121 = val('t121'), p141 = val('t141'), ev = val('avg');
      const cell = (v, label, fmt, hi) => `<div class="${hi ? 'hi' : ''}"><b>${v === null ? '…' : fmt(v)}</b><span>${label}</span></div>`;
      return `<div class="stack" style="gap:4px"><div class="lab">Your odds with perfect play from here</div>
        <div class="meter" aria-live="polite">${cell(p121, 'chance of 121+', pct, s.goal === 't121' || s.goal === 'moon')}
        ${cell(p141, 'chance of 141+', pct, s.goal === 't141' || s.goal === 'moon')}
        ${cell(ev, 'expected final score', (x) => x.toFixed(0), s.goal === 'avg')}</div></div>`;
    }
    save() { persist(this.s); }
    get mask() { return this.s.boxes.reduce((m, v, i) => (v === null ? m : m | (1 << i)), 0); }
    get score() { return this.s.boxes.reduce((a, v) => a + (v || 0), 0) + (this.s.adj || 0); }
    get needTotal() { return this.s.unk.some((u, c) => u && this.s.boxes[c] !== null) && this.s.adj === null; }
    // the player typed the SCORE shown in the game: make our total match it
    setTotal(t) {
      const s = this.s, known = s.boxes.reduce((a, v) => a + (v || 0), 0);
      if (!(t >= 0)) return;
      s.adj = Math.round(t) - known; this.save(); this.render();
    }
    get round() { return Math.min(9, this.s.boxes.filter((v) => v !== null).length + 1); }
    hand() { const c = [0, 0, 0, 0, 0]; this.s.jars.forEach((j) => c[j]++); return c; }

    advice() {
      const s = this.s;
      if (s.jars.some((j) => j === null) || this.mask === 511) return null;
      const goal = BerryEngine.isReady(s.goal) ? s.goal : 'avg';
      const opts = BerryEngine.rankOptions(goal, { mask: this.mask, score: this.score, roll: s.roll, hand: this.hand() });
      const best = opts[0];
      let lockMap = null;
      if (best.type === 'keep') {
        const need = best.keep.slice(); lockMap = [false, false, false, false, false];
        s.jars.forEach((j, i) => { if (need[j] > 0) { lockMap[i] = true; need[j]--; } });
      }
      return { goal, opts, best, lockMap, fallback: goal !== s.goal };
    }
    metric(goal, o) {
      if (goal === 'avg') return `expected final score ${o.ev.toFixed(1)}`;
      if (goal === 'moon') return `${o.value.toFixed(2)} Moonberries expected · final score ≈${o.ev.toFixed(0)}`;
      return `${pct(o.value)} chance of ${goal === 't121' ? '121' : '141'}+`;
    }
    describe(o) {
      if (o.type === 'score') return `Score ${o.points} in ${BOX[o.box]}`;
      const names = []; o.keep.forEach((n, b) => { for (let i = 0; i < n; i++) names.push(BERRY[b].name); });
      return names.length ? `Lock ${names.join(', ')} and roll` : 'Roll all five jars';
    }

    // ---- actions
    tapBerry(b) {
      const s = this.s;
      let i = s.sel !== null ? s.sel : s.jars.findIndex((j) => j === null);
      if (i < 0) return;
      s.jars[i] = b; s.sel = null;
      this.save(); this.render();
    }
    tapJar(i) { const s = this.s; s.jars[i] = null; s.sel = i; this.save(); this.render(); }
    async readPhoto(file) {
      if (!file) return;
      this.cam = { msg: 'Reading your photo…' }; this.render();
      try {
        const r = await JBFCamera.read(file);
        if (r.status === 'ok') {
          const s = this.s;
          s.jars = r.jars.map((b) => 'JSPMF'.indexOf(b)); s.sel = null; this.save();
          this.cam = { msg: `Read ${r.jars.join(' ')} from your photo. Check it matches the game; tap a jar to fix it.` };
        } else if (r.status === 'empty') {
          this.cam = { msg: 'The jars are empty. Press Roll in the game first, then take the photo.', err: true };
        } else {
          this.cam = { msg: "Couldn't read all five jars. Wait for the dice to stop, keep the whole row of jars in the photo, and try again.", err: true };
        }
      } catch (e) {
        this.cam = { msg: "Couldn't open that photo. Try again, or tap the berries in by hand.", err: true };
      }
      this.render();
    }
    rolled(lockMap) {
      const s = this.s;
      if (s.roll >= 3) return;
      s.locked = lockMap ? lockMap.slice() : [false, false, false, false, false];
      s.jars = s.jars.map((j, i) => (s.locked[i] ? j : null));
      s.roll += 1; s.sel = null;
      this.save(); this.render();
    }
    scored(box) {
      const s = this.s;
      if (s.boxes[box] !== null || s.jars.some((j) => j === null)) return;
      s.boxes[box] = BerryEngine.scoreBox(this.hand(), box);
      s.roll = 1; s.jars = [null, null, null, null, null]; s.locked = [false, false, false, false, false]; s.sel = null;
      this.save(); this.render();
    }

    renderProgress() {
      const el = this.root.querySelector('.bar > div');
      if (el && this.progress !== null) el.style.width = (100 * this.progress).toFixed(0) + '%';
    }

    render() {
      const s = this.s, adv = this.advice(), done = this.mask === 511;
      const liveOK = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      // the camera tools are for a phone pointed at the game; on a computer they sit folded away at the bottom
      const phone = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
      const camRow = window.JBFCamera ? `<div class="cam">${liveOK ? '<button class="camlabel" data-act="live">Live camera</button>' : ''}<label class="camlabel">Read jars from a photo<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
          <span class="cammsg ${this.cam && this.cam.err ? 'err' : ''}" aria-live="polite">${this.cam ? this.cam.msg : phone ? 'Point your phone at the game once the dice stop. The photo stays on your device.' : 'These read the game through a phone camera. On a computer, scan the QR code to open the helper on your phone.'}</span></div>` : '';
      const next = s.sel !== null ? s.sel : s.jars.findIndex((j) => j === null);
      const jar = (j, i) => {
        const lock = adv && adv.lockMap && adv.lockMap[i];
        const cls = ['jar', j !== null ? 'full' : '', i === next ? 'next' : '', lock ? 'lock' : ''].join(' ');
        return `<button class="${cls}" data-jar="${i}" aria-label="Jar ${i + 1}: ${j === null ? 'empty' : BERRY[j].name}${lock ? ', lock it' : ''}">
          ${j === null ? `<small>${i === next ? 'next' : i + 1}</small>` : `<span class="chip c-${BERRY[j].tok}">${BERRY[j].k}</span><small>${BERRY[j].name}</small>`}</button>`;
      };
      const bx = (c) => {
        const v = s.boxes[c], rec = adv && adv.best.type === 'score' && adv.best.box === c;
        const unk = v !== null && s.unk[c];
        if (s.edit) return `<label class="bx"><span>${BOX[c]}</span><input type="number" min="0" max="35" inputmode="numeric" data-edit="${c}" value="${v === null || unk ? '' : v}" placeholder="${unk ? 'used' : ''}" aria-label="${BOX[c]} score, blank if open"></label>`;
        const pv = v === null && adv ? BerryEngine.scoreBox(this.hand(), c) : null;
        return `<button class="bx ${v === null ? 'open' : 'used'} ${rec ? 'rec' : ''}" data-box="${c}" ${v !== null || !adv ? 'disabled' : ''}
          aria-label="${BOX[c]}: ${v === null ? (pv === null ? 'open' : 'would score ' + pv) : 'scored ' + v}"><span>${BOX[c]}</span><b>${v === null ? (pv === null ? '·' : '+' + pv) : unk ? '✓' : v}</b></button>`;
      };
      let adviceHtml = '';
      if (done) {
        adviceHtml = `<div class="advice"><div class="what">Game over: ${this.score} points${this.score >= 141 ? ' — 2 Moonberries!' : this.score >= 121 ? ' — 1 Moonberry!' : ''}</div><button class="btn" data-act="new">Start a new game</button></div>`;
      } else if (adv) {
        const b = adv.best;
        const alts = adv.opts.slice(1, 5).map((o) => `<li>${this.describe(o)} — ${this.metric(adv.goal, o)}</li>`).join('');
        adviceHtml = `<div class="advice" aria-live="polite">
          <div class="what">${this.describe(b)}</div>
          <div class="why">${this.metric(adv.goal, b)}${adv.fallback ? ' · showing best-score advice while the Moonberry odds finish loading' : ''}</div>
          <div class="row">${b.type === 'keep'
            ? `<button class="btn" data-act="rolled">I locked them and rolled</button>`
            : `<button class="btn" data-act="scored">I scored it</button>`}</div>
          ${alts ? `<details><summary>Other options</summary><ol class="alts">${alts}</ol></details>` : ''}
          ${b.type === 'keep' ? '<div class="note">Did something else? Tap the box you scored, or just enter the new berries.</div>' : ''}
        </div>`;
      } else {
        adviceHtml = `<div class="advice"><div class="why">Tap the berries in your jars, left to right. ${s.roll > 1 ? 'Locked jars are already filled in.' : ''}</div></div>`;
      }
      this.root.querySelector('.app').innerHTML = `
      <div class="stack">
        <div class="stack" style="gap:6px"><div class="lab">Goal</div>
          <div class="goals" role="group" aria-label="Goal">${GOALS.map((g) => `<button class="goal" data-goal="${g.id}" aria-pressed="${s.goal === g.id}">
            ${g.tag ? `<i>${g.tag}</i>` : ''}<b>${g.label}</b><span>${g.sub}</span></button>`).join('')}</div>
          ${this.progress !== null ? '<div class="note">Working out the Moonberry odds…</div><div class="bar"><div style="width:0%"></div></div>' : ''}
        </div>
        <div class="status"><span>Round <b>${this.round}</b> of 9</span><span>Score <b>${this.score}</b></span>
          <span class="rolls" role="group" aria-label="Which roll">${[1, 2, 3].map((r) => `<button data-roll="${r}" aria-pressed="${s.roll === r}">Roll ${r}</button>`).join('')}</span></div>
        ${this.meter()}
        <div class="jars">${s.jars.map(jar).join('')}</div>
        ${phone ? camRow : ''}
        <div class="palette" role="group" aria-label="Add a berry">${BERRY.map((b, i) => `<button class="pal" data-berry="${i}" aria-label="Add ${b.name}"><span class="chip c-${b.tok}">${b.k}</span><small>${b.name}</small></button>`).join('')}</div>
        ${adviceHtml}
        <div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="lab">Scorecard</span>
          <span class="row"><button class="ghost" data-act="edit">${s.edit ? 'Done editing' : 'Edit scores'}</button><button class="ghost" data-act="new">New game</button></span></div>
          ${this.needTotal ? `<form class="row total" data-total><label>Joined mid-game: what's the SCORE in the game? <input type="number" min="0" max="300" inputmode="numeric" required></label><button class="ghost">Set</button></form>` : ''}
          <div class="card9">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(bx).join('')}</div>
          <div class="note">Joining mid-game? Use “Edit scores” to fill in the boxes you've used. Unofficial fan tool, not affiliated with Webkinz or Ganz.</div>
        </div>
        ${!phone && camRow ? `<details class="camtools" ${this.cam ? 'open' : ''}><summary>Camera options (for phones)</summary>${camRow}</details>` : ''}
      </div>`;
      this.renderProgress();
      const q = (sel) => this.root.querySelectorAll(sel);
      q('[data-berry]').forEach((b) => b.addEventListener('click', () => this.tapBerry(+b.dataset.berry)));
      q('[data-jar]').forEach((b) => b.addEventListener('click', () => this.tapJar(+b.dataset.jar)));
      q('[data-box]').forEach((b) => b.addEventListener('click', () => this.scored(+b.dataset.box)));
      q('[data-roll]').forEach((b) => b.addEventListener('click', () => { s.roll = +b.dataset.roll; this.save(); this.render(); }));
      q('[data-goal]').forEach((b) => b.addEventListener('click', () => { s.goal = b.dataset.goal; this.save(); this.ensure(); this.render(); }));
      q('[data-edit]').forEach((inp) => inp.addEventListener('change', () => {
        const c = +inp.dataset.edit, v = inp.value.trim();
        if (v === '' && s.unk[c]) return;   // left blank: still used, points unknown
        s.boxes[c] = v === '' ? null : Math.max(0, Math.min(35, Math.round(+v))); s.unk[c] = false; this.save();
      }));
      const on = (act, fn) => q(`[data-act="${act}"]`).forEach((el) => el.addEventListener('click', fn));
      on('rolled', () => this.rolled(adv && adv.lockMap));
      on('scored', () => this.scored(adv.best.box));
      on('edit', () => { s.edit = !s.edit; this.save(); this.render(); });
      q('[data-photo]').forEach((inp) => inp.addEventListener('change', () => { this.readPhoto(inp.files && inp.files[0]); inp.value = ''; }));
      on('new', () => { this.s = fresh(s.goal); this.save(); this.render(); });
      on('live', () => this.startLive());
      q('[data-total]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); this.setTotal(+f.querySelector('input').value); }));
      if (this.liveOn) this.renderLive();
    }

    // ---- live camera: watch the game screen and show what to do next, right on top of it.
    // Nothing needs confirming: the camera reads the jars, the lids, the ROLL button, the roll
    // counter (x3, x2, x1), the scorecard and the SCORE, and the helper follows the game from those.
    async startLive() {
      if (!window.isSecureContext) {
        this.cam = { msg: 'The live camera only works when the helper is opened from an https:// address. Use "Read jars from a photo" for now.', err: true };
        this.render(); return;
      }
      const live = this.root.querySelector('.live');
      live.innerHTML = `<div class="stage"><video playsinline muted autoplay></video><svg class="ov" aria-hidden="true"></svg></div>
        <div class="ltop"><span class="lstat">Starting the camera…</span><button class="lclose">Close</button></div>
        <div class="lbot" aria-live="polite"><div class="lwhat">Starting the camera…</div><div class="lwhy"></div></div>`;
      live.hidden = false; this.liveOn = true; this.L = null;
      // full screen where the browser allows it (Android); iPhones keep the browser bars
      try { if (live.requestFullscreen && !document.fullscreenElement) live.requestFullscreen().catch(() => {}); } catch (e) { /* optional */ }
      live.querySelector('.lclose').addEventListener('click', () => this.stopLive());
      // the status line's roll and score can be tapped, for the rare time the camera can't tell
      live.querySelector('.ltop').addEventListener('click', (e) => {
        const b = e.target.closest('[data-l]');
        if (!b || !this.L) return;
        if (b.dataset.l === 'roll') { this.s.roll = this.s.roll % 3 + 1; this.L.unsure = false; this.liveCommit(); }
        if (b.dataset.l === 'score') {
          const t = window.prompt('Type the SCORE shown in the game');
          if (t !== null && t.trim() !== '' && +t >= 0) this.setTotal(+t);
        }
      });
      this.onResize = () => this.renderLive();
      addEventListener('resize', this.onResize);
      const video = live.querySelector('video');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      } catch (e) {
        this.stopLive();
        this.cam = { msg: 'The camera was blocked. Allow camera access for this page in your browser settings, or use "Read jars from a photo".', err: true };
        this.render(); return;
      }
      if (!this.liveOn) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; return; }
      video.srcObject = this.stream;
      try { await video.play(); } catch (e) { /* muted autoplay is allowed */ }
      try { this.wake = await navigator.wakeLock.request('screen'); } catch (e) { /* optional: keeps the phone screen on */ }
      this.liveReset();
      const tick = () => {
        if (!this.liveOn) return;
        const t0 = performance.now();
        if (video.readyState >= 2 && video.videoWidth) {
          try { this.liveFrame(JBFCamera.readFrame(video), video.videoHeight > video.videoWidth); } catch (e) { /* skip a bad frame */ }
        }
        this.timer = setTimeout(tick, Math.max(40, 150 - (performance.now() - t0)));   // about 4 to 6 frames a second on a phone
      };
      tick();
    }
    stopLive() {
      this.liveOn = false; clearTimeout(this.timer);
      if (this.onResize) { removeEventListener('resize', this.onResize); this.onResize = null; }
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      if (this.wake) { this.wake.release().catch(() => {}); this.wake = null; }
      try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* not full screen */ }
      const live = this.root && this.root.querySelector('.live');
      if (live) { live.hidden = true; live.innerHTML = ''; }
    }
    liveReset() { this.L = liveState(); }       // startup: nothing about this game has been seen through the camera yet
    liveCommit() { this.s.sel = null; this.save(); this.render(); }
    // a new hand: forget scorecard / ROLL / counter readings from before it, so they can't be mistaken for news
    liveFreshVotes() { Object.assign(this.L, { win: [], B: null, handCtr: null, handSc: null }); }
    // the SCORE once the same number has been read 3 frames running (null if not readable right now)
    liveScoreNow() { const L = this.L; return L.sc.n >= 3 && L.frame - L.sc.at <= 4 ? L.sc.v : null; }
    // the SCORE once it has held for a second: what decisions about clicks go by (a misread rarely holds that long)
    liveScoreFirm() { const v = this.liveScoreNow(); return v !== null && performance.now() - this.L.sc.since >= 1000 ? v : null; }
    // open boxes that would add exactly what the SCORE went up by
    // (measured from the SCORE as read earlier with this hand, so an error in our own total can't fake a click)
    fitsJump(v) {
      const s = this.s, base = this.L && this.L.handSc !== null ? this.L.handSc : null, hand = this.hand();
      if (base === null) return [];
      const d = v - base;
      return d > 0 && s.jars.every((j) => j !== null) ? NINE.filter((c) => s.boxes[c] === null && BerryEngine.scoreBox(hand, c) === d) : [];
    }
    // boxes that show a number on screen but are open in our scorecard
    newOnScreen(screen) { return screen ? NINE.filter((c) => screen[c] === true && this.s.boxes[c] === null) : []; }
    // vote the last few readings of the scorecard, ROLL button and roll counter, so one odd frame changes nothing
    liveVote() {
      const win = this.L.win;
      if (!win.length) return null;
      const pick = (vals, need) => {
        const n = new Map(); let seen = 0;
        vals.forEach((v) => { if (v !== null && v !== undefined) { seen++; n.set(v, (n.get(v) || 0) + 1); } });
        let best = null, bn = 0;
        n.forEach((cnt, v) => { if (cnt > bn) { bn = cnt; best = v; } });
        return bn >= need && bn >= 0.6 * seen ? best : null;
      };
      return {
        cells: NINE.map((c) => pick(win.map((f) => f.cells[c]), 2)),
        roll: pick(win.map((f) => f.roll), 2),
        ctr: pick(win.slice(-3).map((f) => f.ctr), 2),
      };
    }
    // a tip for aiming the camera, from where the game sits in the frame
    liveHint(r, portrait) {
      if (!r) return '';
      if (r.status === 'nojars') {
        const aim = { top: 'Aim a little higher', bottom: 'Aim a little lower', left: 'Aim a little to the left', right: 'Aim a little to the right' }[r.cut];
        return aim ? aim + ': the jars are cut off.' : '';
      }
      const v = r.view;
      if (!v) return '';
      const o = v.out;
      // upright, the game only just fits across the frame: sideways gives it far more room
      if (portrait && (o.left || o.right)) return 'Turn your phone sideways to fit the whole game.';
      if ((o.left && o.right) || (o.top && o.bottom)) return 'Move back a little to fit the whole game.';
      if (o.bottom) return 'Aim a little lower to fit the scorecard.';
      if (o.top) return 'Aim a little higher.';
      if (o.right) return 'Aim a little to the right.';
      if (o.left) return 'Aim a little to the left.';
      if (v.size < 80) return 'Move a little closer.';
      return '';
    }
    liveFrame(r, portrait) {
      const L = this.L, now = performance.now();
      L.frame++; L.cur = r;
      const seen = r.status === 'ok' || r.status === 'empty';
      if (seen) { L.good = r; L.goodAt = now; L.lost = 0; if (!L.firstAt) L.firstAt = now; } else if (!L.lost) L.lost = now;
      if (r.board) L.win.push({ t: now, cells: r.board.cells, roll: r.board.rollActive, ctr: r.board.counter ? r.board.counter.left : null });
      L.win = L.win.filter((f) => now - f.t < 2500).slice(-5);
      const ctr0 = L.B ? L.B.ctr : null;
      L.B = this.liveVote();
      if (L.B && L.B.ctr !== null && L.B.ctr !== ctr0) L.ctrAt = now;
      if (L.B && L.B.ctr !== null && L.B.ctr < 3 && this.s.jars.every((j) => j !== null)) L.handCtr = L.B.ctr;
      if (L.B && L.B.ctr === 3) L.x3Seen = true;
      if (r.board) r.board.cells.forEach((v, c) => { if (v === true) { if (!L.litSince[c]) L.litSince[c] = now; } else if (v === false) L.litSince[c] = 0; });
      const h = this.liveHint(r, portrait);
      if (h === L.hint) L.hintN++; else { L.hint = h; L.hintN = 1; }
      if (L.hintN >= 3) L.hintShown = h;
      // the jars: act once the same reading holds for 2 frames in a row
      if (seen) {
        const key = r.status + r.jars.join('') + r.locked.map(Number).join('');
        if (key === L.key && now - L.keyAt < 1500) L.keyN++; else { L.key = key; L.keyN = 1; }
        L.keyAt = now;
        // one jar different from what we have is usually a misread (a roll changes most jars): it must hold longer
        const ref = this.s.jars.every((j) => j !== null) ? this.s.jars : L.stale;
        const J = r.status === 'ok' ? r.jars.map((x) => 'JSPMF'.indexOf(x)) : null;
        const oneOff = !!(J && ref && J.filter((j, i) => j !== ref[i]).length === 1);
        if (L.keyN === (oneOff ? 6 : 2)) {
          L.st = { status: r.status, jars: r.status === 'ok' ? r.jars.map((x) => 'JSPMF'.indexOf(x)) : null, locked: r.locked.slice(), at: now };
          this.liveStep(now);
        } else if (L.keyN > (oneOff ? 6 : 2) && L.st) L.st.at = now;
      }
      // the SCORE: the same number a few frames running
      const sv = r.board && r.board.score ? r.board.score.value : null;
      if (sv !== null) { if (sv === L.sc.v) L.sc.n++; else L.sc = { v: sv, n: 1, since: now }; L.sc.at = L.frame; }
      if (L.handSc === null) L.handSc = this.liveScoreFirm();
      this.liveWatch(now);
      this.renderLive();
    }
    // joining mid-game: take the boxes already used from the scorecard on screen
    liveAdopt(now) {
      const L = this.L, B = L.B;
      if (!B) return;                                  // scorecard not in view yet: try again when it is
      // boxes we have filled show blank in the game: what we saved is probably an older game. The SCORE
      // decides (a misaligned reading can make every box look blank); without it, wait up to 4 seconds
      const blankOurs = NINE.filter((c) => this.s.boxes[c] !== null && B.cells[c] === false);
      if (blankOurs.length) {
        const sc = this.liveScoreNow(), ours = NINE.filter((c) => this.s.boxes[c] !== null).length;
        if (sc === null && now - L.firstAt < 4000) return;
        if (sc !== null ? sc !== this.score : 2 * blankOurs.length > ours) {
          const { jars, locked, roll } = this.s;          // the berries on screen stay the same
          this.s = Object.assign(fresh(this.s.goal), { jars, locked, roll });
        }
      }
      const add = this.newOnScreen(B.cells);
      // one of these might only be the mouse hovering over a box; if it goes blank later it's dropped again
      if (add.length) { add.forEach((c) => { this.s.boxes[c] = 0; this.s.unk[c] = true; }); this.s.adj = null; L.prov = add.slice(); }
      L.adoptPending = false;
      this.liveCommit();
    }
    liveNewGame(now) {
      const L = this.L;
      this.s = fresh(this.s.goal);
      Object.assign(L, { stale: null, ended: null, guess: null, prov: [], adoptPending: false, unsure: false, rollOff: false, lockSeen: false, undo: null, distrust: false, missed: null, blankSince: Array(9).fill(0), note: 'New game: good luck!', noteAt: now });
      this.liveCommit();
    }
    // A box was clicked. Which one: the box whose points match the SCORE's jump, or the one that now
    // shows a number on screen, or else the one we recommended (a guess, checked against the scorecard later).
    // mode 'need': only if the SCORE or the scorecard shows it; returns false otherwise.
    // which box was clicked, from the SCORE's jump and the scorecard: { box, sure }, or null if neither shows it yet
    liveWhich() {
      const s = this.s, B = this.L.B, v = this.liveScoreFirm();
      const open = NINE.filter((c) => s.boxes[c] === null);
      // a box showing points for 1.5 s (hovering the mouse, or a misread, shows them only briefly)
      const onScreen = B ? open.filter((c) => B.cells[c] === true && this.L.litSince[c] && performance.now() - this.L.litSince[c] >= 1500) : [];
      const fits = v !== null ? this.fitsJump(v) : [];
      const both = fits.filter((c) => onScreen.includes(c));
      if (both.length === 1) return { box: both[0], sure: true };
      if (fits.length === 1) return { box: fits[0], sure: true };
      if (onScreen.length === 1 && !fits.length) return { box: onScreen[0], sure: true };
      if (fits.length) {                               // several boxes give the same points: the total is right either way
        const adv = this.advice(), rec = adv && adv.best.type === 'score' ? adv.best.box : null;
        return { box: fits.includes(rec) ? rec : fits[0], sure: false };
      }
      return null;
    }
    liveScored(now, mode, forceBox) {
      const L = this.L, s = this.s, hand = this.hand();
      let box = forceBox !== undefined ? forceBox : null, sure = box !== null;
      if (box === null) {
        const w = this.liveWhich();
        if (w) { box = w.box; sure = w.sure; }
        else if (mode === 'need') return false;
        else {
          const adv = this.advice(), o = adv && (adv.best.type === 'score' ? adv.best : adv.opts.find((x) => x.type === 'score'));
          box = o ? o.box : s.boxes.findIndex((x) => x === null);
        }
      }
      const pts = BerryEngine.scoreBox(hand, box);
      // until the game confirms the click (SCORE, x3 sign, the next round's roll), keep the game as it
      // was, so the click can be taken back if the camera was wrong. Not for the end screen (L.ended does that)
      const before = JSON.parse(JSON.stringify(s));
      L.undo = forceBox !== undefined ? null
        : { s: before, box, pts, ctr: L.handCtr, oldSc: L.handSc, at: now, x3: 0, t: { ctr: 0, score: 0, cell: 0 } };
      L.stale = s.jars.slice();                        // these berries stay in the jars until the next roll
      L.guess = sure ? null : { box, hand: hand.slice(), at: now };
      Object.assign(L, { rollOff: false, lockSeen: false, unsure: false, prov: [], pend: 0, distrust: false, x3Seen: false });
      this.liveFreshVotes();
      this.scored(box);
      L.note = this.mask === 511 ? '' : `Recorded ${pts} in ${BOX[box]}.`; L.noteAt = now;
      return true;
    }
    // a new steady reading of the jars: bring the helper's game in line with the screen
    liveStep(now) {
      const L = this.L, st = L.st, B = L.B;
      const sc = this.liveScoreNow();
      const blank = !!B && B.cells.filter((c) => c === false).length >= 8 && !B.cells.includes(true);
      const newGame = blank && (st.status === 'empty' || sc === 0);   // a blank scorecard alone could be a bad reading
      if (this.mask === 511) {
        // game over: wait for the next game, or carry on if the game wasn't actually over
        if (newGame) this.liveNewGame(now);
        else if (L.ended && st.status === 'ok' && B && B.cells[L.ended.box] === false && same(st.jars, L.ended.s.jars)) { this.s = L.ended.s; L.ended = null; this.liveCommit(); }
        if (!newGame || st.status === 'empty') return;
      } else if (newGame && this.mask !== 0) {
        this.liveNewGame(now);
        if (st.status === 'empty') return;
      }
      const s = this.s, hasHand = s.jars.every((j) => j !== null);
      if (st.status === 'empty') {                     // the jars are empty at the start of a game
        if (L.startup) { L.startup = false; this.liveAdopt(now); }
        else if (hasHand) this.liveScored(now, 'guess');
        const s2 = this.s;
        L.stale = null; s2.jars = [null, null, null, null, null]; s2.locked = [false, false, false, false, false]; s2.roll = 1;
        this.liveCommit(); return;
      }
      const J = st.jars, ctr = B ? B.ctr : null, rollNo = ctr !== null && ctr < 3 ? 3 - ctr : null;
      if (L.startup) {
        // joined mid-game. x3 on the counter means these are last round's berries: ROLL comes next
        L.startup = false; this.liveAdopt(now);
        const s2 = this.s;
        if (ctr === 3) L.stale = J;
        else {
          s2.jars = J; s2.locked = st.locked.slice(); s2.roll = rollNo || (B && B.roll === false ? 3 : 1);
          L.unsure = rollNo === null && !(B && B.roll === false);    // no counter in view: the roll is a guess
          L.lockSeen = st.locked.some(Boolean);
        }
        this.liveCommit(); return;
      }
      if (!hasHand) {
        if (L.stale && same(J, L.stale)) return;       // still last round's berries
        if (L.stale && ctr === 3) return;              // x3: nobody has rolled yet, so this is last round's berries misread
        const u = L.undo;
        if (u) {
          // new berries after a click we weren't sure of. The x-sign says whether it's the next round:
          // x2 is a round's first roll; fewer rolls left than before the click means the same round
          if (ctr !== null && u.ctr !== null && ctr < u.ctr) { this.liveUndo(now); return; }
          if (ctr === 2 || (ctr === null && u.ctr === 0)) L.undo = null;
        }
        Object.assign(L, { stale: null, rollOff: false, lockSeen: st.locked.some(Boolean) });
        s.jars = J; s.locked = st.locked.slice(); s.roll = rollNo || 1;
        this.liveFreshVotes(); this.liveCommit(); return;
      }
      if (same(J, s.jars)) {
        if (!same(st.locked, s.locked)) { s.locked = st.locked.slice(); this.save(); }
        if (st.locked.some(Boolean)) L.lockSeen = true;
        return;
      }
      // the berries changed. A locked jar can't change, so that means an earlier misread: just fix it
      if (st.locked.some((k, i) => k && s.locked[i] && J[i] !== s.jars[i])) { s.jars = J; s.locked = st.locked.slice(); this.liveCommit(); return; }
      const adv = this.advice();
      let sameRound, mode = 'guess';
      if (rollNo !== null) {
        if (rollNo > s.roll) sameRound = true;
        // x2 again: a new round, if a box was clicked. A click puts up x3 first; without seeing it, it takes the SCORE or the scorecard
        else if (rollNo === 1 && s.roll === 1 && !L.x3Seen) sameRound = null;   // still x2 and no x3 since: nobody rolled
        else if (rollNo === 1) { sameRound = false; if (s.roll === 1 || !L.x3Seen) mode = 'need'; }
        else sameRound = null;                          // the counter says no roll happened
      } else if (J.filter((j, i) => j !== s.jars[i]).length === 1 && st.locked.filter((k) => !k).length >= 4) {
        sameRound = null;                              // a roll of 4 or 5 jars almost never changes just one: a misread
      } else {
        sameRound = !!(adv && adv.best.type === 'keep' && s.roll < 3);
        // without the x-sign, only the SCORE or the scorecard can show a click (else liveMissed decides later)
        mode = 'need';
      }
      // the SCORE hasn't moved, though the box we'd guess scores points: no click unless something shows one
      const rec = adv && (adv.best.type === 'score' ? adv.best : adv.opts.find((x) => x.type === 'score'));
      if (!sameRound && rec && rec.points > 0 && L.handSc !== null && this.liveScoreFirm() === L.handSc) mode = 'need';
      if (sameRound === null) { s.jars = J; s.locked = st.locked.slice(); this.liveCommit(); return; }
      if (sameRound) {
        s.jars = J; s.locked = st.locked.slice(); s.roll = rollNo || s.roll + 1;
        Object.assign(L, { rollOff: false, unsure: false, x3Seen: false }); if (st.locked.some(Boolean)) L.lockSeen = true;
        this.liveFreshVotes(); this.liveCommit(); return;
      }
      // a box was clicked and the next round rolled before the camera saw the click
      if (!this.liveScored(now, mode)) {
        // no sign of a click yet: take the berries as read, and let the SCORE decide once it can be read
        if (rollNo === null) L.missed = { hand: this.hand(), sc: L.handSc, at: now, rec: rec ? rec.box : null };
        s.jars = J; s.locked = st.locked.slice(); s.roll = rollNo || s.roll;
        this.liveFreshVotes(); this.liveCommit(); return;
      }
      if (L.undo && rollNo === 1 && L.x3Seen) L.undo = null;   // x3 then x2 with new berries: certainly the next round
      const s2 = this.s;
      s2.jars = J; s2.locked = st.locked.slice(); s2.roll = rollNo || 1;
      Object.assign(L, { stale: null, unsure: false, rollOff: false, lockSeen: st.locked.some(Boolean) });
      this.liveFreshVotes(); this.liveCommit();
    }
    // every frame: what the scorecard, ROLL button, roll counter and SCORE show while the berries stay put
    liveWatch(now) {
      const L = this.L, st = L.st, B = L.B, s = this.s;
      if (!st || L.startup) return;
      if (L.adoptPending && B) this.liveAdopt(now);
      if (L.prov.length && B) {
        const gone = L.prov.filter((c) => B.cells[c] === false);   // it was only the mouse hovering over it
        if (gone.length) { gone.forEach((c) => { s.boxes[c] = null; s.unk[c] = false; }); L.prov = L.prov.filter((c) => !gone.includes(c)); this.liveCommit(); }
      }
      if (this.liveCheckUndo(now)) return;
      this.liveReconcile(now);
      if (this.liveBlankCheck(now)) return;
      const sc = this.liveScoreNow();
      // the camera missed some rounds: boxes show points in the game that are open here, for 3 seconds,
      // and the game's SCORE is ahead of ours by more than this hand could add. Take them as used, points from the SCORE
      const extra = B && !L.adoptPending ? this.newOnScreen(B.cells) : [];
      if (extra.join() !== L.extraKey) { L.extraKey = extra.join(); L.extraAt = now; }
      if (extra.length && now - L.extraAt > 3000 && !this.needTotal && sc !== null && sc > this.score && !this.fitsJump(sc).length) {
        extra.forEach((c) => { s.boxes[c] = 0; s.unk[c] = true; });
        s.adj = null; L.extraKey = ''; this.liveCommit();
      } else if (extra.length && now - L.extraAt > 5000 && !this.needTotal && sc !== null && sc === this.score) {
        // a box scored 0 that we missed: it shows "0" but the SCORE didn't move (5 s, longer than a hover)
        extra.forEach((c) => { s.boxes[c] = 0; s.unk[c] = false; });
        L.extraKey = ''; L.note = `Recorded 0 in ${extra.map((c) => BOX[c]).join(' and ')}.`; L.noteAt = now; this.liveCommit();
      }
      if (this.needTotal && sc !== null) {
        // joined mid-game: the SCORE fills in the points of the boxes used before the camera started
        const known = s.boxes.reduce((a, x) => a + (x || 0), 0), mx = maxPoints();
        const room = s.unk.reduce((a, u, c) => a + (u && s.boxes[c] !== null ? mx[c] : 0), 0);
        if (sc >= known && sc <= known + room) this.setTotal(sc);
      }
      const v = this.needTotal ? null : sc;
      if (this.mask === 511) return;
      const hasHand = s.jars.every((j) => j !== null);
      // game over: in round 9 the end screen replaces the board as soon as the last box is clicked
      if (hasHand && this.round === 9 && L.lost && now - L.lost > 2000 && st.status === 'ok' && same(st.jars, s.jars)) {
        const adv = this.advice();
        if (adv && (adv.best.type === 'score' || s.roll === 3)) {
          const box = s.boxes.findIndex((x) => x === null);
          L.ended = { s: JSON.parse(JSON.stringify(s)), box };
          this.liveScored(now, 'guess', box);
        }
        return;
      }
      if (!B || st.status !== 'ok') return;
      if (!hasHand) {
        // last round's berries came up again on the first roll (rare): the counter shows the roll
        // (not while the click is unconfirmed: then the sign not moving means there was no click, see liveCheckUndo)
        if (!L.undo && L.x3Seen && L.stale && same(st.jars, L.stale) && B.ctr !== null && B.ctr < 3 && now - L.ctrAt > 3000 && st.at > L.ctrAt) {
          s.jars = L.stale; L.stale = null; s.locked = st.locked.slice(); s.roll = 3 - B.ctr; this.liveCommit();
        }
        this.liveDrift(v, now); return;
      }
      if (!same(st.jars, s.jars)) return;             // a new roll is being read; liveStep deals with it
      if (this.liveMissed(now)) return;
      if (B.roll === false && (s.roll === 3 || B.ctr === 0)) L.rollOff = true;   // greyed out is only real after the last roll
      if (st.locked.some(Boolean)) L.lockSeen = true;
      const adv = this.advice();
      // a box was clicked: the berries stay in the jars, but the counter goes back to x3, a greyed-out
      // ROLL lights up again, the lids unlock and the SCORE goes up
      const firm = this.liveScoreFirm(), fits = firm !== null ? this.fitsJump(firm) : [];
      // the signs of a click. Each can be misread for a moment, so it takes two that agree, or one that holds
      // (a box showing points doesn't count: hovering the mouse over it before clicking shows them too)
      const signs = [B.ctr === 3, L.rollOff && B.roll === true, fits.length > 0,
        !!(adv && adv.best.type === 'score' && L.lockSeen && st.locked.every((k) => !k))].filter(Boolean).length;
      const strong = B.ctr === 3 || (L.rollOff && B.roll === true) || fits.length > 0;
      if (strong || signs >= 2) {
        // give the SCORE and the scorecard a moment to show which box it was
        if (!L.pend) L.pend = now;
        const w = this.liveWhich();
        if (!(w && w.sure) && now - L.pend < 1500) return;
        if (signs < 2 && !(w && w.sure && fits.includes(w.box)) && now - L.pend < 4000) return;
        // a click changes several things at once; if another sign on screen says nothing happened, wait
        // (unless the SCORE itself jumped by what a box scores)
        const rec = adv && (adv.best.type === 'score' ? adv.best : adv.opts.find((x) => x.type === 'score'));
        if (!(w && w.sure && fits.includes(w.box)) && this.liveNoClick(w ? w.box : rec ? rec.box : null)) return;
        L.pend = 0;
        if (!this.liveScored(now, L.unsure || L.distrust ? 'need' : 'guess')) {
          s.jars = [null, null, null, null, null]; s.locked = [false, false, false, false, false]; s.roll = 1;   // they were last round's berries
          L.stale = st.jars.slice(); L.unsure = false; this.liveCommit();
        }
        return;
      }
      L.pend = 0;
      // a re-roll that came up with the same berries: the counter (or a greyed-out ROLL) shows it
      const rollNo = B.ctr !== null && B.ctr < 3 ? 3 - B.ctr : null;
      if (rollNo !== null && rollNo > s.roll && now - L.ctrAt > 1500 && st.at > L.ctrAt) { s.roll = rollNo; s.locked = st.locked.slice(); L.unsure = false; this.liveCommit(); }
      else if (B.roll === false && s.roll < 3) { s.roll = 3; L.unsure = false; this.liveCommit(); }
      else if (rollNo === null && B.roll === true && s.roll === 3 && L.unsure) { s.roll = 2; this.liveCommit(); }   // ROLL still lit: not the last roll
      this.liveDrift(v, now);
    }
    // the game's SCORE has shown a different total for about 5 seconds: use the game's
    liveDrift(v, now) {
      const L = this.L;
      // while the scorecard and the helper disagree about which boxes are used, or a click is unconfirmed,
      // those checks fix the total; an adjustment here would only hide the mistake
      if (v === null) return;                          // can't read it right now: keep waiting
      if (v === this.score || L.undo || this.liveBlankOurs().length || (L.B && this.newOnScreen(L.B.cells).length)) { L.drift = { v: null, at: 0 }; return; }
      if (v !== L.drift.v) L.drift = { v, at: now };
      if (now - L.drift.at >= 4000) {
        this.s.adj = (this.s.adj || 0) + (v - this.score); L.drift = { v: null, at: 0 };
        L.note = `Matched the game's SCORE: ${v}.`; L.noteAt = now; this.liveCommit();
      }
    }
    // A click we recorded but the game hasn't confirmed. Confirmed: the SCORE shows the new total, or the
    // x3 sign holds. Taken back if, with the same berries still in the jars, the sign still shows the rolls
    // left from before the click, or the SCORE hasn't moved, or the box stays blank on the scorecard.
    // Returns true if it was taken back.
    liveCheckUndo(now) {
      const L = this.L, u = L.undo, B = L.B, st = L.st;
      if (!u) return false;
      if (this.s.boxes[u.box] === null || now - u.at > 60000) { L.undo = null; return false; }
      const sc = this.liveScoreFirm();
      if (u.oldSc !== null && sc !== null && sc > u.oldSc) {
        // the SCORE went up: the click was real. Its jump is the box's points (a misread berry can make ours wrong)
        const d = sc - u.oldSc;
        if (d !== this.s.boxes[u.box] && d <= maxPoints()[u.box] && !this.s.unk[u.box]) { this.s.boxes[u.box] = d; this.liveCommit(); }
        L.undo = null; return false;
      }
      if (B && B.ctr === 3) { if (!u.x3) u.x3 = now; else if (now - u.x3 > 2000) { L.undo = null; return false; } } else u.x3 = 0;
      const hold = (k, on, ms) => { if (!on) { u.t[k] = 0; return false; } if (!u.t[k]) u.t[k] = now; return now - u.t[k] >= ms; };
      const still = !!(st && st.status === 'ok' && L.stale && same(st.jars, L.stale));
      const byCtr = hold('ctr', still && !!B && B.ctr !== null && B.ctr < 3 && B.ctr === u.ctr, 1500);
      const byScore = hold('score', u.pts > 0 && u.oldSc !== null && sc !== null && sc === u.oldSc, 2500);
      const byCell = hold('cell', !!B && B.cells[u.box] === false, 2500);   // the game shows a scored box's points, even 0
      if (!(byCtr || byScore || byCell)) return false;
      this.liveUndo(now);
      return true;
    }
    // signs on screen that no box was clicked (the berries still in the jars): the x-sign still shows rolls
    // left, ROLL is still greyed out, or the SCORE hasn't moved although the box would score points
    liveNoClick(box) {
      const L = this.L, B = L.B, sc = this.liveScoreFirm();
      if (B && B.ctr !== null && B.ctr < 3) return true;
      if (B && B.roll === false) return true;
      return box !== null && L.handSc !== null && sc !== null && sc === L.handSc && BerryEngine.scoreBox(this.hand(), box) > 0;
    }
    // new berries came while we couldn't tell whether a box was clicked first (x-sign not in view): once the
    // SCORE can be read, a jump means a click with the old berries; no jump means there wasn't one
    liveMissed(now) {
      const L = this.L, m = L.missed, s = this.s, sc = this.liveScoreFirm();
      if (!m) return false;
      if (now - m.at > 10000 || m.sc === null) { L.missed = null; return false; }
      if (sc === null) return false;
      const d = sc - m.sc;
      L.missed = null;
      if (d <= 0) return false;
      const open = NINE.filter((c) => s.boxes[c] === null && BerryEngine.scoreBox(m.hand, c) === d);
      const shown = L.B ? open.filter((c) => L.B.cells[c] === true) : [];
      const box = shown.length === 1 ? shown[0] : open.includes(m.rec) ? m.rec : open.length ? open[0] : null;
      if (box === null) return false;                  // the jump fits no box: the SCORE checks deal with it
      s.boxes[box] = d; s.unk[box] = false; s.roll = 1; L.handSc = sc;
      L.note = `Recorded ${d} in ${BOX[box]}.`; L.noteAt = now;
      this.liveCommit();
      return true;
    }
    liveUndo(now) {
      const L = this.L;
      this.s = L.undo.s;
      Object.assign(L, { undo: null, stale: null, guess: null, pend: 0, distrust: true, note: 'No box was clicked yet.', noteAt: now });
      // berries already rolled again in the same round: let the roll logic take them
      if (L.st && L.st.status === 'ok' && !same(L.st.jars, this.s.jars)) this.liveStep(now); else this.liveCommit();
    }
    // boxes we have as used that the game's scorecard shows blank (a box scored 0 shows "0", so any used box counts)
    liveBlankOurs() {
      const L = this.L, B = L && L.B, s = this.s, u = L && L.undo;
      if (!B) return [];
      return NINE.filter((c) => s.boxes[c] !== null && B.cells[c] === false && !(u && u.box === c) && !L.prov.includes(c));
    }
    // the scorecard shows boxes blank that we have as used, for a few seconds: they weren't scored, so open them again
    liveBlankCheck(now) {
      const L = this.L, s = this.s;
      if (L.adoptPending || this.mask === 511) return false;
      // each box's timer starts when it's first seen blank and stops only when it's seen filled (an unreadable frame doesn't count)
      const B = L.B, nowBlank = this.liveBlankOurs();
      NINE.forEach((c) => {
        if (s.boxes[c] === null || (B && B.cells[c] === true)) L.blankSince[c] = 0;
        else if (nowBlank.includes(c) && !L.blankSince[c]) L.blankSince[c] = now;
      });
      const sc = this.needTotal ? null : this.liveScoreFirm();
      const wait = (c) => {
        const agrees = sc !== null && !s.unk[c] && sc === this.score - s.boxes[c];
        // quicker when the SCORE agrees; slower when the SCORE matches our scorecard as it is (then a misread is likelier)
        return agrees ? 2000 : sc !== null && sc === this.score ? 6000 : 4000;
      };
      const blank = NINE.filter((c) => L.blankSince[c] && nowBlank.includes(c) && now - L.blankSince[c] >= wait(c));
      if (!blank.length) return false;
      blank.forEach((c) => { s.boxes[c] = null; s.unk[c] = false; });
      s.adj = null; L.guess = null; blank.forEach((c) => { L.blankSince[c] = 0; });
      L.note = `Fixed the scorecard: ${blank.map((c) => BOX[c]).join(' and ')} ${blank.length > 1 ? "weren't" : "wasn't"} scored yet.`; L.noteAt = now;
      this.liveCommit();
      return true;
    }
    // a box we had to guess: if the scorecard shows it blank and exactly one other box newly filled, move it there
    liveReconcile(now) {
      const L = this.L, B = L.B, s = this.s, g = L.guess;
      if (!g || !B || L.undo) return;                  // an unconfirmed click is settled by liveCheckUndo first
      if (now - g.at > 30000 || B.cells[g.box] === true || s.boxes[g.box] === null) { L.guess = null; return; }
      if (B.cells[g.box] !== false) return;
      const other = NINE.filter((c) => s.boxes[c] === null && B.cells[c] === true);
      if (other.length !== 1) return;
      const c = other[0];
      // a box can light up only because the mouse is over it: if the SCORE can be read it must agree
      const sc = this.liveScoreFirm();
      if (sc !== null && sc !== this.score - s.boxes[g.box] + BerryEngine.scoreBox(g.hand, c)) return;
      s.boxes[c] = BerryEngine.scoreBox(g.hand, c); s.boxes[g.box] = null; s.unk[c] = false;
      L.guess = null; L.note = `Moved that score to ${BOX[c]}: ${s.boxes[c]}.`; L.noteAt = now;
      this.liveCommit();
    }
    renderLive() {
      const live = this.root.querySelector('.live'), L = this.L;
      if (!live || live.hidden || !L) return;
      const stage = live.querySelector('.stage'), video = live.querySelector('video'), svg = live.querySelector('.ov');
      if (!stage) return;
      const W = stage.clientWidth, H = stage.clientHeight, vw = video.videoWidth || 1, vh = video.videoHeight || 1;
      const now = performance.now(), s = this.s, adv = this.advice(), done = this.mask === 511;
      // the whole camera frame is shown (object-fit: contain), so nothing the reader sees is cut off
      const k = Math.min(W / vw, H / vh), ox = (W - vw * k) / 2, oy = (H - vh * k) / 2;
      const pt = (fx, fy) => [ox + fx * vw * k, oy + fy * vh * k];
      const ptsOf = (q) => q.map(([x, y]) => pt(x, y).map((n) => n.toFixed(1)).join(',')).join(' ');
      const poly = (q, cls) => cls === 'go'
        ? `<polygon points="${ptsOf(q)}" class="halo"/><polygon points="${ptsOf(q)}" class="go"/>`
        : `<polygon points="${ptsOf(q)}" class="${cls}"/>`;
      const label = (q, text, cls, below, inside) => {
        const xs = q.map((p) => pt(p[0], p[1])[0]), ys = q.map((p) => pt(p[0], p[1])[1]);
        const x = inside ? Math.min(...xs) + 0.8 * (Math.max(...xs) - Math.min(...xs)) : (Math.min(...xs) + Math.max(...xs)) / 2;
        const y = inside ? (Math.min(...ys) + Math.max(...ys)) / 2 + 8 : below ? Math.max(...ys) + 24 : Math.min(...ys) - 10;
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="lbl ${cls}">${text}</text>`;
      };
      const boxQ = (bx) => [[bx.x, bx.y], [bx.x + bx.w, bx.y], [bx.x + bx.w, bx.y + bx.h], [bx.x, bx.y + bx.h]];
      // the game was seen a moment ago: keep showing what to do while the camera wobbles or blurs
      const view = L.good && now - L.goodAt < 2500 ? L.good : null;
      const portrait = vh > vw, hasHand = s.jars.every((j) => j !== null);
      const note = now - L.noteAt < 6000 ? L.note : '';
      const fix = note.startsWith('Recorded') ? '' : note;   // "Recorded 21 in Moonberry" belongs under Press ROLL only
      let marks = '', what = 'Point the camera at your game';
      let why = L.hintShown || (portrait ? 'Turn your phone sideways, then fit the jars, the SCORE and the scorecard on screen.' : 'Fit the jars, the SCORE and the scorecard on screen.');
      if (view) view.boxes.forEach((bx) => { marks += poly(boxQ(bx), 'mk'); });
      const prize = this.score >= 141 ? ': 2 Moonberries!' : this.score >= 121 ? ': 1 Moonberry!' : '.';
      if (done) {
        what = `Game over: ${this.score} points${prize}`;
        why = 'Start another game in Webkinz whenever you like. The helper will pick it up.';
      } else if (view && L.st) {
        if (!hasHand) {
          what = 'Press ROLL';
          why = note || (this.mask ? `Round ${this.round} of 9.` : 'New game: good luck!');
          if (view.board) marks += poly(view.board.quads.roll, 'go') + label(view.board.quads.roll, 'PRESS', 'gol');
        } else if (adv) {
          const best = adv.best;
          if (best.type === 'keep' && s.roll < 3) {
            const lockedNow = view.locked || [false, false, false, false, false];
            const need = [], extra = [];
            adv.lockMap.forEach((want, i) => { if (want && !lockedNow[i]) need.push(i); if (!want && lockedNow[i]) extra.push(i); });
            const ready = need.length === 0 && extra.length === 0;
            view.boxes.forEach((bx, i) => {
              const q = boxQ(bx), want = adv.lockMap[i];
              if (ready) { if (want) marks += poly(q, 'mk ok') + label(q, 'KEEP', 'okl', true); }
              else if (want && lockedNow[i]) marks += poly(q, 'mk ok') + label(q, 'LOCKED ✓', 'okl', true);
              else if (want) marks += poly(q, 'mk lockmk') + label(q, 'LOCK', 'lk', true);
              else if (lockedNow[i]) marks += poly(q, 'mk bad') + label(q, 'UNLOCK', 'badl', true);
            });
            const PLURAL = ['Jumbleberries', 'Sugarberries', 'Pickleberries', 'Moonberries', 'Flies'];
            const keepNames = best.keep.map((n, i) => (n === 0 ? '' : n === 1 ? BERRY[i].name : `${n} ${PLURAL[i]}`)).filter(Boolean).join(', ');
            if (ready) {
              what = best.keep.some((n) => n > 0) ? 'Jars locked. Now press ROLL' : 'Press ROLL to re-roll all five';
              why = best.keep.some((n) => n > 0) ? `Keeping ${keepNames}. ${this.metric(adv.goal, best)}` : this.metric(adv.goal, best);
              if (view.board) marks += poly(view.board.quads.roll, 'go') + label(view.board.quads.roll, 'PRESS', 'gol');
            } else {
              const parts = [];
              if (need.length) parts.push(`Lock the ${need.length === 1 ? 'jar' : need.length + ' jars'} marked LOCK`);
              if (extra.length) parts.push(`${parts.length ? 'unlock' : 'Unlock'} the ${extra.length === 1 ? 'jar' : extra.length + ' jars'} marked UNLOCK`);
              what = parts.join(' and ');
              why = `Keep ${keepNames}, then press ROLL.`;
            }
          } else {
            const box = best.box, pts = best.points;
            what = `Click ${BOX[box]} for ${pts} point${pts === 1 ? '' : 's'}`;
            why = fix || this.metric(adv.goal, best);
            const q = view.board && view.board.quads.cells[box];
            if (q) marks += poly(q, 'go') + label(q, `+${pts}`, 'gol', false, true);
          }
        } else { what = 'Reading your game…'; why = ''; }
      } else if (L.cur && L.cur.status === 'partial') { what = 'Waiting for the dice to stop…'; why = ''; }
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = marks;
      // status line: the roll and the score can be tapped to correct them
      const tail = !L.cur ? ' · Starting…' : view ? (L.hintShown && (L.st || done) ? ' · ' + L.hintShown : '') : ' · Looking for the game…';
      const stat = `Round ${this.round} · <button data-l="roll" aria-label="Roll ${s.roll}. Tap to change">Roll ${s.roll}</button> · `
        + `<button data-l="score" aria-label="Score ${this.score}. Tap to type the game's SCORE">Score ${this.score}${this.needTotal ? '+?' : ''}</button>${tail}`;
      const st = live.querySelector('.lstat');
      if (st.dataset.h !== stat) { st.dataset.h = stat; st.innerHTML = stat; }
      const bot = live.querySelector('.lbot');
      const html = `<div class="lwhat">${what}</div><div class="lwhy">${why}</div>`;
      if (bot.dataset.h !== html) { bot.dataset.h = html; bot.innerHTML = html; }
    }
  }
  if (!customElements.get('jbf-advisor')) customElements.define('jbf-advisor', JbfAdvisor);
})();
