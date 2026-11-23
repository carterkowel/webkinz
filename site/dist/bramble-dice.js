/*!
 * <bramble-dice>: a self-contained berry dice game (5 dice, 3 rolls, 9 boxes).
 * Needs jbf-engine.js loaded first (for the coach and the end-of-game review).
 *
 *   <script src="jbf-engine.js"></script>
 *   <script src="leaderboard-config.js"></script>   optional: shared leaderboard (see site/README.md)
 *   <script src="bramble-dice.js"></script>
 *   <bramble-dice></bramble-dice>            optional attribute: theme="light" | "dark"
 */
(function () {
  'use strict';
  const FRUIT = [
    { name: 'Redcurrant', pts: 2, tok: 'red' },
    { name: 'Cloudberry', pts: 2, tok: 'yellow' },
    { name: 'Gooseberry', pts: 4, tok: 'green' },
    { name: 'Mulberry', pts: 7, tok: 'purple' },
    { name: 'Beetle', pts: 0, tok: 'beetle' },
  ];
  const BOXES = [
    { name: 'Redcurrants', rule: '2 per Redcurrant' }, { name: 'Cloudberries', rule: '2 per Cloudberry' },
    { name: 'Gooseberries', rule: '4 per Gooseberry' }, { name: 'Mulberries', rule: '7 per Mulberry' },
    { name: 'Three alike', rule: '3 matching dice: total of all' }, { name: 'Four alike', rule: '4 matching dice: total of all' },
    { name: 'Five alike', rule: 'All 5 match: total of all' }, { name: 'Medley', rule: 'One of each fruit: total of all' },
    { name: 'Free pick', rule: 'Total of all dice' },
  ];
  const STAR1 = 121, STAR2 = 141, STORE = 'bramble-dice-stats-v1', NAME_KEY = 'bramble-dice-name';

  const GLYPH = [
    // redcurrant: a little cluster on a stem
    '<path d="M20 4 C20 9 17 11 14 14 M20 4 C22 9 25 11 27 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/><circle cx="13" cy="21" r="7.5" fill="currentColor"/><circle cx="27" cy="21" r="7.5" fill="currentColor"/><circle cx="20" cy="31" r="7.5" fill="currentColor"/><circle cx="10.5" cy="18.5" r="2" fill="#fff" opacity=".55"/><circle cx="24.5" cy="18.5" r="2" fill="#fff" opacity=".55"/><circle cx="17.5" cy="28.5" r="2" fill="#fff" opacity=".55"/>',
    // cloudberry: a round cluster of drupelets
    '<g fill="currentColor"><circle cx="20" cy="12" r="5.2"/><circle cx="13" cy="17" r="5.2"/><circle cx="27" cy="17" r="5.2"/><circle cx="20" cy="21" r="5.2"/><circle cx="13" cy="26" r="5.2"/><circle cx="27" cy="26" r="5.2"/><circle cx="20" cy="31" r="5.2"/></g><g fill="#fff" opacity=".45"><circle cx="18.5" cy="10.5" r="1.4"/><circle cx="11.5" cy="15.5" r="1.4"/><circle cx="18.5" cy="19.5" r="1.4"/></g>',
    // gooseberry: striped oval
    '<ellipse cx="20" cy="21" rx="12" ry="15" fill="currentColor"/><path d="M20 6 V36 M14 8 Q11 21 14 34 M26 8 Q29 21 26 34" stroke="#fff" stroke-width="1.4" fill="none" opacity=".5"/><path d="M20 6 l-2 -3 M20 6 l2 -3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    // mulberry: a long cluster with a stalk
    '<path d="M20 2 V8" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/><g fill="currentColor"><circle cx="16" cy="11" r="4.2"/><circle cx="24" cy="11" r="4.2"/><circle cx="13" cy="17" r="4.2"/><circle cx="20" cy="17" r="4.2"/><circle cx="27" cy="17" r="4.2"/><circle cx="13" cy="23" r="4.2"/><circle cx="20" cy="23" r="4.2"/><circle cx="27" cy="23" r="4.2"/><circle cx="14" cy="29" r="4.2"/><circle cx="21" cy="29" r="4.2"/><circle cx="26" cy="29" r="4.2"/><circle cx="20" cy="35" r="4.2"/></g><g fill="#fff" opacity=".4"><circle cx="14.5" cy="9.5" r="1.2"/><circle cx="11.5" cy="15.5" r="1.2"/><circle cx="18.5" cy="15.5" r="1.2"/></g>',
    // beetle
    '<g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 15 L6 12 M11 22 L5 22 M12 29 L6 33 M28 15 L34 12 M29 22 L35 22 M28 29 L34 33 M17 8 L14 4 M23 8 L26 4"/></g><circle cx="20" cy="11" r="4.5" fill="currentColor"/><ellipse cx="20" cy="24" rx="9" ry="12" fill="currentColor"/><path d="M20 13 V36" stroke="#fff" stroke-width="1.2" opacity=".35"/>',
  ];

  const DARK = `--bg:#121814; --card:#1b231e; --ink:#e8efe9; --ink2:#b4c2b8; --muted:#7f8c84; --line:#2c3830; --accent:#6cc196; --accent-ink:#0f1a14;
    --hold:#e8efe9; --hold-ink:#121814; --coach:#b49bff; --bad:#ff8a7a;
    --red:#f05d57; --yellow:#f2c33a; --green:#67b74f; --purple:#a68af2; --beetle:#b3aebd;`;
  const CSS = `
  :host { --bg:#f1f5f2; --card:#ffffff; --ink:#1d2722; --ink2:#4c5a52; --muted:#82908a; --line:#d6e0da;
    --accent:#2e6b4c; --accent-ink:#ffffff; --hold:#1d2722; --hold-ink:#ffffff; --coach:#7a4fd0; --bad:#c0392b;
    --red:#d23a3a; --yellow:#e2a80f; --green:#4f9e3a; --purple:#7446c8; --beetle:#2b2830;
    display:block; color:var(--ink); background:var(--bg); border-radius:18px; padding:clamp(12px,3vw,22px); container-type:inline-size; }
  @media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${DARK} } }
  :host([theme="dark"]) { ${DARK} }
  * { box-sizing:border-box; }
  button, input { font:inherit; color:inherit; }
  :focus-visible { outline:3px solid var(--coach); outline-offset:2px; }
  .top { display:flex; flex-wrap:wrap; gap:8px 16px; align-items:baseline; justify-content:space-between; }
  .title { font-weight:800; font-size:1.25rem; letter-spacing:.01em; }
  .meta { display:flex; gap:14px; flex-wrap:wrap; color:var(--ink2); font-size:.95rem; }
  .meta b { color:var(--ink); font-variant-numeric:tabular-nums; }
  .stars { color:var(--muted); font-size:.85rem; }
  .table { margin-top:14px; display:grid; gap:14px; }
  .dice { display:flex; gap:clamp(6px,2vw,12px); justify-content:center; flex-wrap:nowrap; }
  .die { width:clamp(52px,15cqi,84px); aspect-ratio:1; border-radius:22%; border:2px solid var(--line); background:var(--card);
    display:grid; place-items:center; position:relative; cursor:pointer; padding:0; transition:transform .12s ease; }
  .die svg { width:62%; height:62%; }
  .die .pt { position:absolute; right:6%; bottom:4%; font-size:.72rem; font-weight:800; color:var(--muted); }
  .die.empty { border-style:dashed; cursor:default; }
  .die.held { border-color:var(--hold); border-width:3px; }
  .die.held::after { content:"HOLD"; position:absolute; top:-9px; left:50%; transform:translateX(-50%); background:var(--hold);
    color:var(--hold-ink); font-size:.62rem; font-weight:800; letter-spacing:.06em; padding:1px 6px; border-radius:6px; }
  .die.coach { box-shadow:0 0 0 3px var(--coach); }
  .die:disabled { cursor:default; }
  .f-red{color:var(--red)} .f-yellow{color:var(--yellow)} .f-green{color:var(--green)} .f-purple{color:var(--purple)} .f-beetle{color:var(--beetle)}
  @media (prefers-reduced-motion: no-preference) { .die.rolling { animation: wob .35s ease-out; } }
  @keyframes wob { 0%{transform:rotate(-14deg) scale(.9)} 50%{transform:rotate(10deg) scale(1.04)} 100%{transform:none} }
  .controls { display:flex; gap:10px; align-items:center; justify-content:center; flex-wrap:wrap; }
  .roll { background:var(--accent); color:var(--accent-ink); border:0; border-radius:12px; padding:10px 26px; font-weight:800; font-size:1.05rem; cursor:pointer; }
  .roll:disabled { opacity:.45; cursor:default; }
  .pips { display:flex; gap:5px; } .pip { width:10px; height:10px; border-radius:50%; background:var(--accent); } .pip.used { background:var(--line); }
  .ghost { background:transparent; border:1.5px solid var(--line); border-radius:10px; padding:7px 12px; cursor:pointer; color:var(--ink2); font-size:.9rem; }
  .ghost[aria-pressed="true"] { border-color:var(--coach); color:var(--coach); }
  .hint { text-align:center; min-height:1.4em; color:var(--ink2); font-size:.92rem; }
  .hint b { color:var(--coach); }
  .card { display:grid; grid-template-columns:1fr; gap:14px; }
  @container (min-width: 560px) { .card { grid-template-columns:1fr 1fr; } }
  .col { display:grid; gap:6px; align-content:start; }
  .colhead { font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:700; }
  .box { display:grid; grid-template-columns:1fr auto; gap:2px 10px; align-items:center; text-align:left; background:var(--card);
    border:1.5px solid var(--line); border-radius:12px; padding:8px 12px; cursor:pointer; min-height:52px; }
  .box .n { font-weight:700; display:flex; align-items:center; gap:6px; } .box .r { grid-column:1; font-size:.78rem; color:var(--muted); }
  .box .n i { width:10px; height:10px; border-radius:50%; display:inline-block; }
  .box .v { grid-row:1 / span 2; grid-column:2; font-size:1.15rem; font-weight:800; font-variant-numeric:tabular-nums; }
  .box.preview .v { color:var(--accent); } .box.preview.zero .v { color:var(--muted); }
  .box.filled { cursor:default; background:transparent; } .box.filled .v { color:var(--ink); }
  .box.coach { border-color:var(--coach); box-shadow:0 0 0 2px var(--coach); }
  .box:disabled { cursor:default; }
  .foot { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center; font-size:.88rem; color:var(--ink2); }
  .foot .btns { display:flex; gap:8px; flex-wrap:wrap; }
  .panel { background:var(--card); border:1.5px solid var(--line); border-radius:14px; padding:14px 16px; display:grid; gap:10px; }
  .big { font-size:2.2rem; font-weight:800; line-height:1; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:8px; }
  .stat { display:grid; gap:2px; } .stat b { font-size:1.2rem; font-variant-numeric:tabular-nums; } .stat span { font-size:.78rem; color:var(--muted); }
  ul.rev { margin:0; padding-left:18px; display:grid; gap:6px; font-size:.9rem; color:var(--ink2); }
  select { font:inherit; background:var(--card); color:var(--ink); border:1.5px solid var(--line); border-radius:8px; padding:4px 6px; }
  .submit { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .submit input { border:1.5px solid var(--line); background:var(--bg); border-radius:10px; padding:8px 10px; width:12rem; max-width:100%; }
  .msg { font-size:.88rem; color:var(--ink2); } .msg.err { color:var(--bad); }
  .tabs { display:flex; gap:6px; flex-wrap:wrap; }
  .tabs button { border:1.5px solid var(--line); background:transparent; border-radius:9px; padding:5px 10px; cursor:pointer; font-size:.88rem; }
  .tabs button[aria-pressed="true"] { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }
  ol.board { margin:0; padding:0; list-style:none; display:grid; gap:2px; counter-reset:r; }
  ol.board li { display:grid; grid-template-columns:2rem 1fr auto; gap:8px; align-items:baseline; padding:5px 4px; border-bottom:1px solid var(--line); font-size:.95rem; }
  ol.board li::before { counter-increment:r; content:counter(r); color:var(--muted); font-variant-numeric:tabular-nums; text-align:right; }
  ol.board li.me { font-weight:800; }
  ol.board .val { font-variant-numeric:tabular-nums; font-weight:700; }
  ol.board .sub { grid-column:2 / span 2; font-size:.75rem; color:var(--muted); font-weight:400; }
  .modes { display:inline-flex; border:1.5px solid var(--line); border-radius:10px; overflow:hidden; }
  .modes button { border:0; background:transparent; padding:4px 12px; cursor:pointer; font-size:.88rem; color:var(--ink2); }
  .modes button[aria-pressed="true"] { background:var(--accent); color:var(--accent-ink); }
  .q { font-size:.98rem; text-align:center; }
  .fb { display:grid; gap:6px; }
  .fb .verdict { font-weight:800; font-size:1.05rem; } .fb .verdict.ok { color:var(--accent); } .fb .verdict.miss { color:var(--bad); }
  .fb ol { margin:0; padding-left:20px; display:grid; gap:3px; font-size:.9rem; color:var(--ink2); }
  .fb li.mine { color:var(--ink); font-weight:700; } .fb li.best { color:var(--accent); font-weight:800; }
  .box.mine { border-color:var(--bad); }
  `;

  const counts = (faces) => { const c = [0, 0, 0, 0, 0]; faces.forEach((f) => c[f]++); return c; };
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || { games: [] }; } catch (e) { return { games: [] }; } };
  const save = (s) => { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* storage unavailable */ } };
  const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } };
  const setName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch (e) { /* ignore */ } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const NAME_OK = /^[A-Za-z0-9 _.\-]{1,20}$/;
  // The board is public and many players are kids, so rude names are turned away. firestore.rules
  // repeats this list (keep the two in step); here we also undo look-alike digits and separators.
  // Words that hide inside ordinary names (Peacock, Grapes, Thorny, Booboo) are left out on purpose.
  const BLOCKED = ['fuck', 'fuk', 'fck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'penis', 'vagina', 'porn', 'slut',
    'whore', 'nigg', 'fag', 'retard', 'nazi', 'hitler', 'kkk', 'twat', 'wank', 'bastard', 'tits', 'sexy'];
  const nameBlocked = (n) => {
    const s = n.toLowerCase().replace(/[0134578]/g, (d) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' })[d]).replace(/[^a-z]/g, '');
    return BLOCKED.some((w) => s.includes(w) || s.replace(/i/g, 'l').includes(w));
  };

  // ------------------------------------------------------------------ shared leaderboard (Firestore REST)
  function leaderboard() {
    const cfg = window.BRAMBLE_LEADERBOARD;
    if (!cfg || !cfg.projectId || !cfg.apiKey) return null;
    const root = `${cfg.endpoint || 'https://firestore.googleapis.com'}/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents`;
    const coll = cfg.collection || 'scores', key = `key=${encodeURIComponent(cfg.apiKey)}`;
    const call = async (url, body) => {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
        if (!r.ok) throw new Error(`server said ${r.status}`);
        return await r.json();
      } finally { clearTimeout(t); }
    };
    const val = (v) => (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue !== undefined ? Number(v.doubleValue)
      : v.stringValue !== undefined ? v.stringValue : v.timestampValue !== undefined ? v.timestampValue : null);
    return {
      add: (e) => call(`${root}/${coll}?${key}`, { fields: {
        name: { stringValue: e.name }, score: { integerValue: String(e.score) }, lost: { doubleValue: e.lost },
        ts: { timestampValue: new Date().toISOString() }, v: { integerValue: '1' } } }),
      top: async (field, dir, n = 15) => {
        const rows = await call(`${root}:runQuery?${key}`, { structuredQuery: {
          from: [{ collectionId: coll }], orderBy: [{ field: { fieldPath: field }, direction: dir }], limit: n } });
        return (rows || []).filter((r) => r.document).map((r) => {
          const o = {}; for (const [k, v] of Object.entries(r.document.fields || {})) o[k] = val(v); return o;
        });
      },
    };
  }

  class BrambleDice extends HTMLElement {
    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
      this.coachOn = false;
      this.coachGoal = 'avg';
      this.lb = leaderboard();
      this.board = { open: false, tab: 'score', rows: null, err: null, loading: false };
      this.mode = 'play';
      this.newGame();
    }
    connectedCallback() { this.render(); }

    newGame() {
      this.g = { round: 1, roll: 0, dice: [null, null, null, null, null], held: [false, false, false, false, false],
        boxes: Array(9).fill(null), score: 0, decisions: [], undo: null, over: false, review: null, submitted: null };
      this.rolling = [];
    }
    get mask() { return this.g.boxes.reduce((m, v, i) => (v === null ? m : m | (1 << i)), 0); }
    state() { return { mask: this.mask, score: this.g.score, roll: this.g.roll, hand: counts(this.g.dice) }; }

    doRoll() {
      const g = this.g;
      if (g.over || g.roll >= 3) return;
      if (g.roll > 0) {
        if (g.held.every(Boolean)) return;
        g.decisions.push({ st: this.state(), move: { type: 'keep', keep: counts(g.dice.filter((_, i) => g.held[i])) }, coached: this.coachOn });
      }
      this.rolling = [];
      g.dice = g.dice.map((d, i) => { if (g.roll > 0 && g.held[i]) return d; this.rolling.push(i); return BerryEngine.rollDie(); });
      g.roll += 1;
      g.undo = null;
      this.render();
    }
    toggleHold(i) {
      const g = this.g;
      if (g.over || g.roll === 0 || g.roll >= 3) return;
      g.held[i] = !g.held[i];
      this.rolling = [];
      this.render();
    }
    scoreBox(c) {
      const g = this.g;
      if (g.over || g.roll === 0 || g.boxes[c] !== null) return;
      const st = this.state();
      g.undo = JSON.parse(JSON.stringify({ ...g, undo: null }));
      g.decisions.push({ st, move: { type: 'score', box: c }, coached: this.coachOn });
      const pts = BerryEngine.scoreBox(st.hand, c);
      g.boxes[c] = pts; g.score += pts;
      g.round += 1; g.roll = 0; g.dice = [null, null, null, null, null]; g.held = [false, false, false, false, false];
      this.rolling = [];
      if (g.round > 9) this.finish();
      this.render();
    }
    undoScore() {
      if (!this.g.undo) return;
      this.g = this.g.undo; this.g.undo = null; this.rolling = [];
      this.render();
    }
    finish() {
      const g = this.g;
      g.over = true;
      BerryEngine.solveEV();
      let round = 1;
      const graded = g.decisions.map((d) => {
        const out = { ...d, round, ...BerryEngine.pointsLost(d.st, d.move) };
        if (d.move.type === 'score') round++;
        return out;
      });
      const lost = graded.reduce((a, d) => a + d.lost, 0);
      const worst = graded.filter((d) => d.lost > 0.05).sort((a, b) => b.lost - a.lost).slice(0, 3);
      const coached = g.decisions.filter((d) => d.coached).length;
      g.review = { lost, worst, coached };
      const stats = load();
      stats.games.push({ s: g.score, l: Math.round(lost * 10) / 10, c: coached > 0 ? 1 : 0, t: Date.now() });
      stats.games = stats.games.slice(-500);
      save(stats);
    }

    // ---- leaderboard
    async loadBoard(tab = this.board.tab) {
      if (!this.lb) return;
      Object.assign(this.board, { tab, loading: true, err: null });
      this.render();
      try {
        this.board.rows = tab === 'score' ? await this.lb.top('score', 'DESCENDING') : await this.lb.top('lost', 'ASCENDING');
      } catch (e) {
        this.board.rows = null;
        this.board.err = "Couldn't reach the leaderboard. Check your connection and try again.";
      }
      this.board.loading = false;
      this.render();
    }
    async submit(name) {
      const g = this.g;
      name = name.trim();
      if (!NAME_OK.test(name)) { g.submitted = { err: 'Use 1–20 letters, numbers, spaces, dots, dashes or underscores.' }; this.render(); return; }
      if (nameBlocked(name)) { g.submitted = { err: 'Please pick a different nickname.' }; this.render(); return; }
      setName(name);
      g.submitted = { sending: true }; this.render();
      try {
        await this.lb.add({ name, score: g.score, lost: Math.min(150, Math.round(g.review.lost * 10) / 10) });
        g.submitted = { ok: true, name };
        this.board.open = true;
        await this.loadBoard('score');
      } catch (e) {
        g.submitted = { err: "Couldn't save your score. Check your connection and try again." };
        this.render();
      }
    }

    coachAdvice() {
      const g = this.g;
      if (!this.coachOn || g.over || g.roll === 0) return null;
      if (!BerryEngine.isReady(this.coachGoal)) {
        if (!this.preparing) {
          this.preparing = true;
          BerryEngine.prepare(this.coachGoal).then(() => { this.preparing = false; this.render(); });
        }
        return { wait: true };
      }
      const best = BerryEngine.rankOptions(this.coachGoal, this.state())[0];
      if (best.type === 'score') return { box: best.box, text: `score <b>${best.points}</b> in <b>${BOXES[best.box].name}</b>` };
      const need = best.keep.slice(), hold = [false, false, false, false, false];
      [true, false].forEach((pref) => g.dice.forEach((d, i) => { if (!hold[i] && g.held[i] === pref && need[d] > 0) { hold[i] = true; need[d]--; } }));
      const names = g.dice.filter((_, i) => hold[i]).map((d) => FRUIT[d].name);
      return { hold, text: names.length ? `hold <b>${names.join(', ')}</b> and roll` : '<b>roll all five</b>' };
    }

    describeMove(d) {
      if (d.move.type === 'score') return `${BerryEngine.scoreBox(d.st.hand, d.move.box)} in ${BOXES[d.move.box].name}`;
      const names = []; d.move.keep.forEach((n, f) => { for (let i = 0; i < n; i++) names.push(FRUIT[f].name); });
      return names.length ? `hold ${names.join(', ')}` : 'roll all five';
    }
    describeBest(o) {
      if (o.type === 'score') return `${o.points} in ${BOXES[o.box].name}`;
      const names = []; o.keep.forEach((n, f) => { for (let i = 0; i < n; i++) names.push(FRUIT[f].name); });
      return names.length ? `hold ${names.join(', ')}` : 'roll all five';
    }

    render() {
      if (this.mode === 'train') return this.renderTrainer();
      const typed = this.root.querySelector('#bd-name');
      if (typed) this.typedName = typed.value;          // keep a half-typed name across re-renders
      const g = this.g, adv = this.coachAdvice();
      const hand = g.roll > 0 ? counts(g.dice) : null;
      const die = (d, i) => {
        if (d === null) return `<button class="die empty" disabled aria-label="Die ${i + 1}, not rolled"></button>`;
        const f = FRUIT[d], cls = ['die', g.held[i] ? 'held' : '', adv && adv.hold && adv.hold[i] ? 'coach' : '', this.rolling.includes(i) ? 'rolling' : ''].join(' ');
        const canHold = g.roll > 0 && g.roll < 3 && !g.over;
        return `<button class="${cls}" data-die="${i}" ${canHold ? '' : 'disabled'} aria-pressed="${g.held[i]}" aria-label="${f.name}, ${f.pts} points${g.held[i] ? ', held' : ''}">
          <svg viewBox="0 0 40 40" class="f-${f.tok}" aria-hidden="true">${GLYPH[d]}</svg><span class="pt">${f.pts}</span></button>`;
      };
      const box = (c) => {
        const filled = g.boxes[c] !== null, pv = !filled && hand ? BerryEngine.scoreBox(hand, c) : null;
        const cls = ['box', filled ? 'filled' : '', pv !== null ? 'preview' : '', pv === 0 ? 'zero' : '', adv && adv.box === c ? 'coach' : ''].join(' ');
        const val = filled ? g.boxes[c] : pv !== null ? pv : '';
        const dot = c < 4 ? `<i style="background:var(--${FRUIT[c].tok})"></i>` : '';
        return `<button class="${cls}" data-box="${c}" ${filled || !hand || g.over ? 'disabled' : ''} aria-label="${BOXES[c].name}: ${filled ? 'scored ' + g.boxes[c] : pv !== null ? 'score ' + pv + ' here' : 'open'}">
          <span class="n">${dot}${BOXES[c].name}</span><span class="r">${BOXES[c].rule}</span><span class="v">${val}</span></button>`;
      };
      const pips = [0, 1, 2].map((i) => `<span class="pip ${i < g.roll ? 'used' : ''}"></span>`).join('');
      const rollLabel = g.over ? 'Game over' : g.roll === 0 ? 'Roll' : g.roll >= 3 ? 'Pick a box' : 'Roll again';
      let hint = '';
      if (adv && adv.wait) hint = 'Coach is working out the odds…';
      else if (adv) hint = `Coach: ${adv.text}`;
      else if (!g.over && g.roll === 0) hint = g.round === 1 ? 'Roll to start. Tap dice to hold them between rolls.' : 'Roll for the next round.';
      else if (!g.over && g.roll < 3) hint = 'Hold dice and roll again, or tap a box to score now.';
      else if (!g.over) hint = 'Last roll: tap a box to score it.';

      this.root.innerHTML = `<style>${CSS}</style>
        <div class="top">
          <div class="title">Bramble Dice ${this.modeTabs()}</div>
          <div class="meta"><span>Round <b>${Math.min(g.round, 9)}</b>/9</span><span>Score <b>${g.score}</b></span><span class="stars">★ at ${STAR1} · ★★ at ${STAR2}</span></div>
        </div>
        <div class="table">
          ${g.over ? this.endPanel() : `
          <div class="dice" role="group" aria-label="Dice">${g.dice.map(die).join('')}</div>
          <div class="controls">
            <button class="roll" data-act="roll" ${g.over || g.roll >= 3 || (g.roll > 0 && g.held.every(Boolean)) ? 'disabled' : ''}>${rollLabel}</button>
            <span class="pips" aria-label="${3 - g.roll} rolls left this round">${pips}</span>
            <button class="ghost" data-act="coach" aria-pressed="${this.coachOn}">Coach ${this.coachOn ? 'on' : 'off'}</button>
            ${g.undo ? '<button class="ghost" data-act="undo">Undo last box</button>' : ''}
          </div>
          <div class="hint" aria-live="polite">${hint}</div>`}
          ${this.board.open ? this.boardPanel() : ''}
          <div class="card">
            <div class="col"><div class="colhead">Fruit boxes</div>${[0, 1, 2, 3].map(box).join('')}</div>
            <div class="col"><div class="colhead">Combos</div>${[4, 5, 6, 7, 8].map(box).join('')}</div>
          </div>
          <div class="foot">
            <label>Coach plays for <select data-act="goal" aria-label="Coach goal">
              <option value="avg" ${this.coachGoal === 'avg' ? 'selected' : ''}>highest score</option>
              <option value="moon" ${this.coachGoal === 'moon' ? 'selected' : ''}>most stars</option></select></label>
            <span class="btns">${this.lb ? `<button class="ghost" data-act="board" aria-pressed="${this.board.open}">Leaderboard</button>` : ''}<button class="ghost" data-act="new">New game</button></span>
          </div>
        </div>`;
      const q = (s) => this.root.querySelectorAll(s);
      q('[data-die]').forEach((b) => b.addEventListener('click', () => this.toggleHold(+b.dataset.die)));
      q('[data-box]').forEach((b) => b.addEventListener('click', () => this.scoreBox(+b.dataset.box)));
      const on = (act, ev, fn) => q(`[data-act="${act}"]`).forEach((el) => el.addEventListener(ev, fn));
      this.bindModes();
      on('roll', 'click', () => this.doRoll());
      on('coach', 'click', () => { this.coachOn = !this.coachOn; this.render(); });
      on('undo', 'click', () => this.undoScore());
      on('new', 'click', () => { this.newGame(); this.render(); });
      on('again', 'click', () => { this.newGame(); this.render(); });
      on('reset', 'click', () => { save({ games: [] }); this.render(); });
      on('goal', 'change', (e) => { this.coachGoal = e.target.value; this.render(); });
      on('board', 'click', () => { this.board.open = !this.board.open; if (this.board.open) this.loadBoard(); else this.render(); });
      q('[data-tab]').forEach((b) => b.addEventListener('click', () => this.loadBoard(b.dataset.tab)));
      const form = this.root.querySelector('form.submit');
      if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.submit(form.querySelector('input').value); });
    }

    boardPanel() {
      const b = this.board, me = (this.g.submitted && this.g.submitted.name) || getName();
      let body;
      if (b.loading) body = '<div class="msg">Loading…</div>';
      else if (b.err) body = `<div class="msg err">${b.err}</div>`;
      else if (!b.rows || !b.rows.length) body = '<div class="msg">No scores yet. Finish a game with the coach off to be first.</div>';
      else body = `<ol class="board">${b.rows.map((r) => `<li class="${r.name === me ? 'me' : ''}"><span>${esc(r.name)}</span>
          <span class="val">${b.tab === 'score' ? r.score : Number(r.lost).toFixed(1)}</span>
          <span class="sub">${b.tab === 'score' ? `gave away ${Number(r.lost).toFixed(1)} points` : `scored ${r.score}`}${r.ts ? ' · ' + new Date(r.ts).toLocaleDateString() : ''}</span></li>`).join('')}</ol>`;
      return `<div class="panel" aria-live="polite">
        <div class="tabs" role="group" aria-label="Leaderboard">
          <button data-tab="score" aria-pressed="${b.tab === 'score'}">Top scores</button>
          <button data-tab="lost" aria-pressed="${b.tab === 'lost'}">Sharpest games</button></div>
        <div class="msg">${b.tab === 'score' ? 'Highest single-game scores.' : 'Fewest points given away compared with perfect play: the skill board, with luck taken out.'} Coach-off games only.</div>
        ${body}</div>`;
    }

    // ================================================================ trainer mode
    modeTabs() {
      return `<span class="modes" role="group" aria-label="Mode"><button data-mode="play" aria-pressed="${this.mode === 'play'}">Play</button><button data-mode="train" aria-pressed="${this.mode === 'train'}">Trainer</button></span>`;
    }
    bindModes() {
      this.root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
        this.mode = b.dataset.mode;
        if (this.mode === 'train' && !this.t) this.newQuestion();
        this.render();
      }));
    }
    trainStats() { try { return JSON.parse(localStorage.getItem('bramble-dice-trainer-v1')) || { n: 0, perfect: 0, lost: 0 }; } catch (e) { return { n: 0, perfect: 0, lost: 0 }; } }
    saveTrainStats(x) { try { localStorage.setItem('bramble-dice-trainer-v1', JSON.stringify(x)); } catch (e) { /* ignore */ } }

    // Play a game with perfect moves up to a random decision, and keep it only if it's a real test:
    // no near-tie for the best move, and at least one tempting alternative that costs something.
    newQuestion() {
      BerryEngine.solveEV();
      for (let attempt = 0; attempt < 60; attempt++) {
        const stopRound = 1 + Math.floor(Math.random() * 9), stopRoll = 1 + Math.floor(Math.random() * 3);
        let boxes = Array(9).fill(null), score = 0, found = null;
        for (let round = 1; round <= stopRound && !found; round++) {
          let dice = [0, 1, 2, 3, 4].map(() => BerryEngine.rollDie());
          for (let r = 1; r <= 3; r++) {
            const mask = boxes.reduce((m, v, i) => (v === null ? m : m | (1 << i)), 0);
            const st = { mask, score, roll: r, hand: counts(dice) };
            const opts = BerryEngine.rankOptions('avg', st);
            if (round === stopRound && r === stopRoll) {
              const gap = opts.length > 1 ? opts[0].ev - opts[1].ev : 0;
              const tempting = opts.slice(1, 6).some((o) => opts[0].ev - o.ev >= 0.4 && opts[0].ev - o.ev <= 6);
              if (gap >= 0.1 && tempting) found = { st, dice, boxes: boxes.slice(), round };
              break;
            }
            const best = opts[0];
            if (best.type === 'score') { boxes[best.box] = best.points; score += best.points; break; }
            const need = best.keep.slice();
            dice = dice.map((d) => (need[d] > 0 ? (need[d]--, d) : BerryEngine.rollDie()));
          }
        }
        if (found) { this.t = { ...found, held: [false, false, false, false, false], answer: null }; return; }
      }
    }
    trainerAnswer(move) {
      const t = this.t;
      if (t.answer) return;
      const res = BerryEngine.pointsLost(t.st, move);
      const opts = BerryEngine.rankOptions('avg', t.st);
      t.answer = { move, lost: res.lost, opts };
      const x = this.trainStats();
      x.n += 1; x.perfect += res.lost <= 0.05 ? 1 : 0; x.lost += res.lost;
      this.saveTrainStats(x);
      this.render();
    }
    sameMove(a, b) {
      return a.type === b.type && (a.type === 'score' ? a.box === b.box : a.keep.every((x, i) => x === b.keep[i]));
    }
    renderTrainer() {
      const t = this.t, ans = t.answer, st = t.st, x = this.trainStats();
      const best = ans ? ans.opts[0] : null;
      let bestHold = null;
      if (best && best.type === 'keep') {
        const need = best.keep.slice(); bestHold = t.dice.map((d) => (need[d] > 0 ? (need[d]--, true) : false));
      }
      const die = (d, i) => {
        const f = FRUIT[d], canHold = st.roll < 3 && !ans;
        const cls = ['die', t.held[i] ? 'held' : '', bestHold && bestHold[i] ? 'coach' : ''].join(' ');
        return `<button class="${cls}" data-tdie="${i}" ${canHold ? '' : 'disabled'} aria-pressed="${t.held[i]}" aria-label="${f.name}, ${f.pts} points${t.held[i] ? ', held' : ''}">
          <svg viewBox="0 0 40 40" class="f-${f.tok}" aria-hidden="true">${GLYPH[d]}</svg><span class="pt">${f.pts}</span></button>`;
      };
      const box = (c) => {
        const filled = t.boxes[c] !== null, pv = filled ? null : BerryEngine.scoreBox(st.hand, c);
        const isBest = best && best.type === 'score' && best.box === c;
        const isMine = ans && ans.move.type === 'score' && ans.move.box === c && !isBest;
        const cls = ['box', filled ? 'filled' : 'preview', pv === 0 ? 'zero' : '', isBest ? 'coach' : '', isMine ? 'mine' : ''].join(' ');
        const dot = c < 4 ? `<i style="background:var(--${FRUIT[c].tok})"></i>` : '';
        return `<button class="${cls}" data-tbox="${c}" ${filled || ans ? 'disabled' : ''} aria-label="${BOXES[c].name}: ${filled ? 'scored ' + t.boxes[c] : 'score ' + pv + ' here'}">
          <span class="n">${dot}${BOXES[c].name}</span><span class="r">${BOXES[c].rule}</span><span class="v">${filled ? t.boxes[c] : pv}</span></button>`;
      };
      let fb = '';
      if (ans) {
        const ok = ans.lost <= 0.05;
        const list = ans.opts.slice(0, 5).map((o, i) => {
          const mine = this.sameMove(o, ans.move);
          return `<li class="${i === 0 ? 'best' : mine ? 'mine' : ''}">${this.describeBest(o)}${i === 0 ? ' · best' : ` · −${(ans.opts[0].ev - o.ev).toFixed(1)}`}${mine && i > 0 ? ' (yours)' : ''}</li>`;
        }).join('');
        const mineInTop = ans.opts.slice(0, 5).some((o) => this.sameMove(o, ans.move));
        fb = `<div class="panel fb" aria-live="polite">
          <div class="verdict ${ok ? 'ok' : 'miss'}">${ok ? 'Perfect move.' : `That cost ${ans.lost.toFixed(1)} points on average.`}</div>
          <div>Best: <b>${this.describeBest(best)}</b>${best.type === 'keep' ? ' (highlighted)' : ''}.</div>
          <ol>${list}</ol>
          ${mineInTop ? '' : `<div class="msg">Your move, ${this.describeMove({ st, move: ans.move })}, wasn't in the top five.</div>`}
          <div class="controls"><button class="roll" data-act="next">Next situation</button></div></div>`;
      }
      const rate = x.n ? (100 * x.perfect / x.n).toFixed(0) + '%' : '—', avg = x.n ? (x.lost / x.n).toFixed(2) : '—';
      this.root.innerHTML = `<style>${CSS}</style>
        <div class="top">
          <div class="title">Bramble Dice ${this.modeTabs()}</div>
          <div class="meta"><span>Answered <b>${x.n}</b></span><span>Perfect <b>${rate}</b></span><span>Avg cost <b>${avg}</b></span></div>
        </div>
        <div class="table">
          <div class="q">Round <b>${t.round}</b>, roll <b>${st.roll}</b> of 3 · score so far <b>${st.score}</b>. ${st.roll < 3 ? 'Hold dice and roll, or tap a box to score now.' : 'Last roll: which box?'}</div>
          <div class="dice" role="group" aria-label="Dice">${t.dice.map(die).join('')}</div>
          ${ans ? '' : `<div class="controls">${st.roll < 3 ? `<button class="roll" data-act="tsubmit">Roll with these held</button>` : ''}</div>`}
          ${fb}
          <div class="card">
            <div class="col"><div class="colhead">Fruit boxes</div>${[0, 1, 2, 3].map(box).join('')}</div>
            <div class="col"><div class="colhead">Combos</div>${[4, 5, 6, 7, 8].map(box).join('')}</div>
          </div>
          <div class="foot"><span>Situations come from games played perfectly up to a random point. Moves are graded on expected final score.</span>
            <span class="btns"><button class="ghost" data-act="skip">Skip</button><button class="ghost" data-act="treset">Reset trainer stats</button></span></div>
        </div>`;
      this.bindModes();
      const q = (s) => this.root.querySelectorAll(s);
      q('[data-tdie]').forEach((b) => b.addEventListener('click', () => { t.held[+b.dataset.tdie] = !t.held[+b.dataset.tdie]; this.render(); }));
      q('[data-tbox]').forEach((b) => b.addEventListener('click', () => this.trainerAnswer({ type: 'score', box: +b.dataset.tbox })));
      const on = (act, fn) => q(`[data-act="${act}"]`).forEach((el) => el.addEventListener('click', fn));
      on('tsubmit', () => {
        if (t.held.every(Boolean)) return;            // holding everything isn't a re-roll; score instead
        this.trainerAnswer({ type: 'keep', keep: counts(t.dice.filter((_, i) => t.held[i])) });
      });
      on('next', () => { this.newQuestion(); this.render(); });
      on('skip', () => { this.newQuestion(); this.render(); });
      on('treset', () => { this.saveTrainStats({ n: 0, perfect: 0, lost: 0 }); this.render(); });
    }

    endPanel() {
      const g = this.g, r = g.review, stars = g.score >= STAR2 ? '★★' : g.score >= STAR1 ? '★' : 'no stars';
      const all = load().games, n = all.length;
      const avg = n ? all.reduce((a, x) => a + x.s, 0) / n : 0;
      const best = n ? Math.max(...all.map((x) => x.s)) : 0;
      const starRate = n ? all.reduce((a, x) => a + (x.s >= STAR2 ? 2 : x.s >= STAR1 ? 1 : 0), 0) / n : 0;
      const solo = all.filter((x) => !x.c), skill = solo.length ? solo.reduce((a, x) => a + x.l, 0) / solo.length : null;
      let submitHtml = '';
      if (this.lb) {
        const s = g.submitted;
        if (r.coached) submitHtml = '<div class="msg">Games played with the coach on can\'t go on the leaderboard.</div>';
        else if (s && s.ok) submitHtml = `<div class="msg">Added to the leaderboard as <b>${esc(s.name)}</b>.</div>`;
        else submitHtml = `<div class="msg">Everyone can see the leaderboard, so use a nickname, not your real name.</div>
          <form class="submit"><input id="bd-name" maxlength="20" placeholder="Nickname" value="${esc(this.typedName !== undefined ? this.typedName : getName())}" aria-label="Nickname for the leaderboard">
          <button class="roll" type="submit" ${s && s.sending ? 'disabled' : ''}>${s && s.sending ? 'Saving…' : 'Add to leaderboard'}</button></form>
          ${s && s.err ? `<div class="msg err">${s.err}</div>` : ''}`;
      }
      return `<div class="panel" aria-live="polite">
        <div><span class="big">${g.score}</span> &nbsp;${stars}</div>
        <div>You gave away <b>${r.lost.toFixed(1)} points</b> compared with perfect play this game${r.coached ? ` (coach was on for ${r.coached} moves)` : ''}.
          Perfect play averages 121.8, so dice luck accounts for the rest.</div>
        ${r.worst.length ? `<div><b>Costliest moves</b><ul class="rev">${r.worst.map((d) =>
          `<li>Round ${d.round}, roll ${d.st.roll}: you chose ${this.describeMove(d)}; best was ${this.describeBest(d.best)} (−${d.lost.toFixed(1)})</li>`).join('')}</ul></div>` : '<div><b>Every move was optimal.</b></div>'}
        ${submitHtml}
        <div class="stats">
          <div class="stat"><b>${n}</b><span>games on this device</span></div>
          <div class="stat"><b>${avg.toFixed(1)}</b><span>average score</span></div>
          <div class="stat"><b>${best}</b><span>best score</span></div>
          <div class="stat"><b>${starRate.toFixed(2)}</b><span>stars per game</span></div>
          <div class="stat"><b>${skill === null ? '—' : skill.toFixed(1)}</b><span>points given away per game (coach off)</span></div>
        </div>
        <div class="controls"><button class="roll" data-act="again">Play again</button><button class="ghost" data-act="reset">Reset my stats</button></div>
      </div>`;
    }
  }
  if (!customElements.get('bramble-dice')) customElements.define('bramble-dice', BrambleDice);
})();
