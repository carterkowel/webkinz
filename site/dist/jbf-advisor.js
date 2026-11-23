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
  .live { position:fixed; inset:0; z-index:2147483000; background:#000; color:#fff; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
  .live[hidden] { display:none; }
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
  .live .ask { display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:.9rem; flex-basis:100%; }
  .live .ask input { width:5.5em; padding:7px 8px; border-radius:8px; border:0; font:inherit; color:#15131c; }
  .live .lb.on { outline:3px solid #ffd23f; }
  .total { font-size:.88rem; color:var(--ink2); } .total input { width:5em; margin-left:4px; border:1px solid var(--line); border-radius:6px; padding:2px 4px; background:var(--bg); }
  .live .lbl { fill:#fff; font:800 17px system-ui,sans-serif; text-anchor:middle; paint-order:stroke; stroke:#000; stroke-width:4px; }
  .live .lk { fill:#ffd23f; }
  .ltop { position:absolute; top:0; left:0; right:0; display:flex; justify-content:space-between; align-items:center; gap:8px;
    padding:max(10px, env(safe-area-inset-top)) 12px 18px; background:linear-gradient(rgba(0,0,0,.75), transparent); font-size:.85rem; }
  .lclose, .lb { background:rgba(255,255,255,.95); color:#15131c; border:0; border-radius:10px; padding:9px 14px; font-weight:800; cursor:pointer; }
  .lbot { position:absolute; left:0; right:0; bottom:0; padding:28px 16px max(16px, env(safe-area-inset-bottom)); display:grid; gap:6px;
    background:linear-gradient(transparent, rgba(0,0,0,.85) 30%); }
  .lwhat { font-size:1.45rem; font-weight:800; line-height:1.25; }
  .lwhy { font-size:.9rem; opacity:.85; }
  .lbtns { display:flex; gap:8px; flex-wrap:wrap; }
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
  const liveState = () => ({ last: null, count: 0, cur: null, stable: null, note: '', startup: true, adoptPending: true, sawEmpty: false, prov: [], askRoll: false, lockedOK: null,
    frame: 0, sc: { v: null, n: 0 }, needN: 0, typeTotal: false, autoTotal: null, autoAt: -99, misN: 0 });

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
        ${window.JBFCamera ? `<div class="cam">${liveOK ? '<button class="camlabel" data-act="live">Live camera</button>' : ''}<label class="camlabel">Read jars from a photo<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
          <span class="cammsg ${this.cam && this.cam.err ? 'err' : ''}" aria-live="polite">${this.cam ? this.cam.msg : 'Point your phone at the game once the dice stop. The photo stays on your device.'}</span></div>` : ''}
        <div class="palette" role="group" aria-label="Add a berry">${BERRY.map((b, i) => `<button class="pal" data-berry="${i}" aria-label="Add ${b.name}"><span class="chip c-${b.tok}">${b.k}</span><small>${b.name}</small></button>`).join('')}</div>
        ${adviceHtml}
        <div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="lab">Scorecard</span>
          <span class="row"><button class="ghost" data-act="edit">${s.edit ? 'Done editing' : 'Edit scores'}</button><button class="ghost" data-act="new">New game</button></span></div>
          ${this.needTotal ? `<form class="row total" data-total><label>Joined mid-game: what's the SCORE in the game? <input type="number" min="0" max="300" inputmode="numeric" required></label><button class="ghost">Set</button></form>` : ''}
          <div class="card9">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(bx).join('')}</div>
          <div class="note">Joining mid-game? Use “Edit scores” to fill in the boxes you've used. Unofficial fan tool, not affiliated with Webkinz or Ganz.</div>
        </div>
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

    // ---- live camera: watch the game screen and show what to do next, right on top of it
    async startLive() {
      if (!window.isSecureContext) {
        this.cam = { msg: 'The live camera only works when the helper is opened from an https:// address. Use "Read jars from a photo" for now.', err: true };
        this.render(); return;
      }
      const live = this.root.querySelector('.live');
      live.innerHTML = `<video playsinline muted autoplay></video><svg class="ov" aria-hidden="true"></svg>
        <div class="ltop"><span class="lstat">Starting the camera…</span><button class="lclose">Close</button></div>
        <div class="lbot"><div class="lwhat">Starting the camera…</div></div>`;
      live.hidden = false; this.liveOn = true; this.L = null;
      live.querySelector('.lclose').addEventListener('click', () => this.stopLive());
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
      // startup: nothing about this game has been seen through the camera yet
      this.L = liveState();
      const tick = () => {
        if (!this.liveOn) return;
        if (video.readyState >= 2 && video.videoWidth) {
          try { this.liveFrame(JBFCamera.readFrame(video)); } catch (e) { /* skip a bad frame */ }
        }
        this.timer = setTimeout(tick, 250);
      };
      tick();
    }
    stopLive() {
      this.liveOn = false; clearTimeout(this.timer);
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      if (this.wake) { this.wake.release().catch(() => {}); this.wake = null; }
      const live = this.root && this.root.querySelector('.live');
      if (live) { live.hidden = true; live.innerHTML = ''; }
    }
    liveFrame(r) {
      const L = this.L, b = r.board;
      // everything we read must hold for 3 frames in a row (about 3/4 of a second) before we act on it
      const key = [r.status, (r.jars || []).join(''), (r.locked || []).map(Number).join(''),
        b ? b.cells.map((c) => (c === null ? '?' : c ? 1 : 0)).join('') + (b.rollActive === false ? 'g' : '') : 'nb'].join('|');
      if (key === L.last) L.count++; else { L.last = key; L.count = 1; }
      L.cur = r; L.frame++;
      if (L.count === 3) { L.stable = r; this.liveStep(r); }
      // the SCORE number counts once the same reading holds for 4 frames (about a second)
      const sv = b && b.score ? b.score.value : null;
      if (sv !== null) { if (sv === L.sc.v) L.sc.n++; else L.sc = { v: sv, n: 1 }; L.sc.at = L.frame; }
      this.liveScore(L.sc.n >= 4 && L.frame - L.sc.at <= 4 ? L.sc.v : null);
      this.renderLive();
    }
    // the game's SCORE, read from the screen (null if not readable right now)
    liveScore(v) {
      const L = this.L, s = this.s, st = L.stable;
      if (this.needTotal) {
        // joined mid-game: the SCORE fills in the points of the boxes used before the camera started
        L.needN++; L.misN = 0;
        if (v === null || L.typeTotal) return;
        const known = s.boxes.reduce((a, x) => a + (x || 0), 0), mx = maxPoints();
        const room = s.unk.reduce((a, u, c) => a + (u && s.boxes[c] !== null ? mx[c] : 0), 0);
        if (v >= known && v <= known + room) { this.setTotal(v); L.autoTotal = v; L.autoAt = L.frame; }
        return;
      }
      L.needN = 0;
      // the jars cleared but the scorecard hasn't shown which box was clicked (glare, or out of view):
      // if only one open box scores exactly what the SCORE went up by, it was that one
      const pending = st && st.status === 'empty' && s.jars.every((j) => j !== null);
      if (v !== null && pending && v > this.score) {
        const hand = this.hand(), fits = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => s.boxes[c] === null && BerryEngine.scoreBox(hand, c) === v - this.score);
        if (fits.length === 1) { L.note = this.recordScore(fits[0]); L.misN = 0; return; }
      }
      // otherwise a SCORE that stays different from the helper's total means the two have drifted apart
      L.misN = v !== null && !pending && v !== this.score && v <= 300 ? L.misN + 1 : 0;
    }
    // boxes that show a number on screen but not in our scorecard
    newOnScreen(screen) { return screen ? [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => screen[c] === true && this.s.boxes[c] === null) : []; }
    adopt(cells) {
      const s = this.s;
      cells.forEach((c) => { s.boxes[c] = 0; s.unk[c] = true; });
      s.adj = null;   // ask for the game's SCORE so the total is right
    }
    recordScore(c) {
      const pts = BerryEngine.scoreBox(this.hand(), c);
      this.scored(c);
      return `Recorded ${pts} in ${BOX[c]}.`;
    }
    autoScore(adv) {
      const box = adv.best.box, pts = adv.best.points;
      this.scored(box);
      return `Recorded ${pts} in ${BOX[box]}. Scored a different box? Fix it in Edit scores.`;
    }
    // a new steady reading: bring the helper's game in line with the screen
    liveStep(r) {
      const L = this.L, b = r.board, screen = b ? b.cells : null;
      if (r.status !== 'ok' && r.status !== 'empty') return;
      const hasHand = this.s.jars.every((j) => j !== null), wasStartup = L.startup;
      if (r.status === 'empty') {
        L.sawEmpty = true; L.askRoll = false;
        const fresh_ = this.newOnScreen(screen);
        if (screen && !screen.includes(null) && screen.every((c) => c === false) && this.mask !== 0) {
          // the scorecard is blank again: a new game
          this.s = fresh(this.s.goal); L.note = 'New game.';
        } else if (hasHand && fresh_.length === 1) {
          L.note = this.recordScore(fresh_[0]);          // the box they clicked now shows its points
        } else if (fresh_.length) {
          this.adopt(fresh_);
        } else if (hasHand && !screen) {
          const adv = this.advice();                     // scorecard out of view: assume the recommended box
          if (adv && adv.best.type === 'score') L.note = this.autoScore(adv);
        }
        L.prov = []; L.adoptPending = !screen && L.adoptPending;
        const s = this.s;
        // keep the hand for a moment if the scorecard hasn't shown the scored box yet
        if (s.jars.some((j) => j !== null) && !(hasHand && fresh_.length === 0 && screen && !wasStartup)) {
          s.jars = [null, null, null, null, null]; s.locked = [false, false, false, false, false]; s.roll = 1;
        }
      } else {
        const jars = r.jars.map((x) => 'JSPMF'.indexOf(x));
        if (screen) {
          if (L.adoptPending) {
            // joining mid-game: take the used boxes from the screen. One might only be the mouse hovering
            // over a box; if it goes blank later we drop it again.
            const add = this.newOnScreen(screen);
            if (add.length) { this.adopt(add); L.prov = add; }
            L.adoptPending = false;
          } else if (L.prov.length) {
            const gone = L.prov.filter((c) => screen[c] === false);
            gone.forEach((c) => { this.s.boxes[c] = null; this.s.unk[c] = false; });
            L.prov = L.prov.filter((c) => !gone.includes(c));
          }
        }
        const s = this.s, same = hasHand && jars.every((j, i) => j === s.jars[i]);
        if (!hasHand || (wasStartup && !same)) {
          s.jars = jars; L.lockedOK = null;
          if (!L.sawEmpty && !(b && b.rollActive === false)) L.askRoll = true;   // joined mid-round: which roll is it?
        } else if (!same) {
          const adv = this.advice();
          if (adv && adv.best.type === 'keep' && s.roll < 3) {
            s.locked = adv.lockMap.slice(); s.roll += 1; s.jars = jars;
          } else {
            // they scored and rolled again before the camera saw the empty jars
            const fresh_ = this.newOnScreen(screen);
            if (fresh_.length === 1) L.note = this.recordScore(fresh_[0]);
            else if (adv && adv.best.type === 'score') L.note = this.autoScore(adv);
            this.s.jars = jars; this.s.roll = 1;
          }
          L.lockedOK = null; L.askRoll = false;
        }
        if (b && b.rollActive === false && this.s.roll !== 3) { this.s.roll = 3; L.askRoll = false; }   // ROLL greyed out: no rolls left
      }
      L.startup = false;
      this.s.sel = null; this.save(); this.render();
    }
    renderLive() {
      const live = this.root.querySelector('.live'), L = this.L;
      if (!live || live.hidden || !L) return;
      const video = live.querySelector('video'), svg = live.querySelector('.ov');
      const W = live.clientWidth, H = live.clientHeight, vw = video.videoWidth || 1, vh = video.videoHeight || 1;
      const s = this.s, adv = this.advice(), r = L.cur, st = L.stable, done = this.mask === 511;
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
      const view = r && (r.status === 'ok' || r.status === 'empty') ? r : null;   // this frame, if the jars are still
      const steady = view && L.count >= 3;
      const hasHand = s.jars.every((j) => j !== null);
      let marks = '', what = 'Point the camera at your game', why = 'Fit the jars, the SCORE and the scorecard on screen.', btns = '';
      if (r && r.status === 'partial') { what = 'Waiting for the dice to stop…'; why = ''; }
      if (view) view.boxes.forEach((bx) => { marks += poly(boxQ(bx), 'mk'); });
      if (done) {
        what = `Game over: ${this.score} points${this.score >= 141 ? ' — 2 Moonberries!' : this.score >= 121 ? ' — 1 Moonberry!' : ''}`; why = '';
      } else if (steady && st.status === 'empty') {
        what = 'Press ROLL';
        why = hasHand ? 'Checking which box you scored…' : L.note || (this.mask ? `Round ${this.round} of 9.` : 'New game: good luck!');
        if (view.board) marks += poly(view.board.quads.roll, 'go') + label(view.board.quads.roll, 'PRESS', 'gol');
      } else if (steady && hasHand && adv) {
        const best = adv.best;
        if (best.type === 'keep' && s.roll < 3) {
          const lockedNow = st.locked || [false, false, false, false, false];
          const need = [], extra = [];
          adv.lockMap.forEach((want, i) => { if (want && !lockedNow[i]) need.push(i); if (!want && lockedNow[i]) extra.push(i); });
          const ready = (need.length === 0 && extra.length === 0) || L.lockedOK === s.jars.join('');
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
            why = `Keep ${keepNames}, then press ROLL. Don't roll yet.`;
            btns += '<button class="lb" data-l="locked">They are locked</button>';
          }
          btns += '<button class="lb" data-l="same">Same berries came up again</button>';
        } else {
          const box = best.box, pts = best.points;
          what = `Click ${BOX[box]} for ${pts} point${pts === 1 ? '' : 's'}`;
          why = L.note && L.note.startsWith('Recorded') ? L.note : this.metric(adv.goal, best);
          const q = view.board && view.board.quads.cells[box];
          if (q) marks += poly(q, 'go') + label(q, `+${pts}`, 'gol', false, true);
          btns += '<button class="lb" data-l="scored">I scored it</button>';
        }
      } else if (steady && hasHand && !adv) {
        what = 'Reading your game…'; why = '';
      }
      // questions go above the buttons, one line each
      let asks = '';
      if (this.needTotal && !done) {
        // read it from the screen; if that hasn't worked after about 4 seconds, ask
        asks += L.typeTotal || L.needN > 16
          ? '<form class="ask" data-t>Joined mid-game: type the SCORE shown in the game <input type="number" min="0" max="300" inputmode="numeric" required aria-label="SCORE"><button class="lb">Set</button></form>'
          : '<div class="ask">Joined mid-game: reading your SCORE… <button class="lb" data-l="type">Type it</button></div>';
      } else if (L.autoTotal !== null && L.frame - L.autoAt < 40) {
        asks += `<div class="ask">Read your SCORE from the game: ${L.autoTotal}. <button class="lb" data-l="retype">Not ${L.autoTotal}?</button></div>`;
      } else if (L.misN >= 12) {
        asks += `<div class="ask">The game shows SCORE ${L.sc.v}, the helper has ${this.score}. <button class="lb" data-l="usescore">Use ${L.sc.v}</button></div>`;
      }
      if (L.askRoll && !done) {
        asks += `<div class="ask">Which roll is this? ${[1, 2, 3].map((n) => `<button class="lb ${s.roll === n ? 'on' : ''}" data-r="${n}">Roll ${n}</button>`).join('')}</div>`;
      }
      btns = asks + btns;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = marks;
      const stat = !r ? 'Starting…' : view ? (steady ? 'Reading' : 'Hold steady…') : 'Looking for the game…';
      live.querySelector('.lstat').textContent = `Round ${this.round} · Roll ${s.roll} · Score ${this.score}${this.needTotal ? '+?' : ''} · ${stat}`;
      const bot = live.querySelector('.lbot');
      const html = `<div class="lwhat">${what}</div><div class="lwhy">${why}</div><div class="lbtns">${btns}</div>`;
      if (bot.dataset.h === html) return;
      if (bot.contains(this.root.activeElement) && this.root.activeElement.tagName === 'INPUT') return;   // don't wipe what they're typing
      bot.dataset.h = html; bot.innerHTML = html;
      bot.querySelectorAll('[data-l]').forEach((el) => el.addEventListener('click', () => {
        const a = el.dataset.l, s2 = this.s;
        if (a === 'type') { L.typeTotal = true; this.renderLive(); return; }
        if (a === 'retype') { s2.adj = null; L.typeTotal = true; L.autoTotal = null; this.save(); this.render(); return; }
        if (a === 'usescore') { s2.adj = (s2.adj || 0) + (L.sc.v - this.score); L.misN = 0; this.save(); this.render(); return; }
        const adv2 = this.advice();
        if (!adv2) return;
        if (a === 'same') { const keep = this.s.jars.slice(); this.rolled(adv2.lockMap); this.s.jars = keep; this.save(); this.render(); }
        else if (a === 'locked') { L.lockedOK = this.s.jars.join(''); this.renderLive(); }
        else if (a === 'scored') { L.note = this.autoScore(adv2); this.render(); }
      }));
      bot.querySelectorAll('[data-r]').forEach((el) => el.addEventListener('click', () => {
        this.s.roll = +el.dataset.r; L.askRoll = false; this.save(); this.render();
      }));
      bot.querySelectorAll('[data-t]').forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); this.setTotal(+f.querySelector('input').value); }));
    }
  }
  if (!customElements.get('jbf-advisor')) customElements.define('jbf-advisor', JbfAdvisor);
})();
