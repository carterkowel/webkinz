// Replays three real games through the live camera helper and checks it kept up with them.
//   node site/test_replay.js            (add "v" to print each game's timeline)
// test_data/*.jsonl.gz are the camera readings (jbf-camera.js output, 6 a second) of three screen recordings of the
// helper in use: two held sideways, one upright. Only the numbers are kept, no pictures. What the game actually showed
// comes from the same readings, looking at the whole game at once (which the live helper can't): a box was scored
// from the first moment it reads filled most of the time from then on.
const fs = require('fs'), path = require('path'), zlib = require('zlib');

let T = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => T }, configurable: true });
globalThis.HTMLElement = class { attachShadow() { return { innerHTML: '', querySelector: () => null }; } };
let Advisor = null;
globalThis.customElements = { get: () => undefined, define: (n, c) => { Advisor = c; } };
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
globalThis.window = globalThis;
globalThis.BerryEngine = require(path.join(__dirname, 'src', 'jbf-engine.js'));
require(process.env.ADVISOR || path.join(__dirname, 'src', 'jbf-advisor.js'));
Object.assign(Advisor.prototype, { render() {}, renderLive() {}, renderProgress() {} });
const BOX = ['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry', 'Basket of 3', 'Basket of 4', 'Basket of 5', 'Mixed Basket', 'Free Roll'];

const GAMES = [
  { file: 'sideways-1', boxes: 8 },
  // upright, the camera rarely sees Jumbleberry's and Sugarberry's numbers; the SCORE shows when they were scored (36->40, 40->44)
  { file: 'upright', boxes: 8, fix: { 0: 68.5, 1: 94 } },
  { file: 'sideways-2', boxes: 8 },
];
const verbose = process.argv[2] === 'v';
let failed = false;

for (const game of GAMES) {
  const rows = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'test_data', game.file + '.jsonl.gz'))).toString().trim().split('\n').map((l) => JSON.parse(l));
  const n = rows.length, cellAt = (i, c) => (rows[i].r.board ? rows[i].r.board.cells[c] : null);
  // when each box was scored: it reads filled then, mostly filled over the next 10 s, and at least half the time from then on
  const filledFrom = Array(9).fill(Infinity);
  for (let c = 0; c < 9; c++) {
    let tr = 0, all = 0;
    const after = Array(n), trAfter = Array(n);
    for (let i = n - 1; i >= 0; i--) { const v = cellAt(i, c); if (v !== null) { all++; if (v) tr++; } after[i] = all >= 6 ? tr / all : null; trAfter[i] = tr; }
    const soon = (i) => { let t = 0, a = 0; for (let k = i; k < n && rows[k].t < rows[i].t + 10; k++) { const v = cellAt(k, c); if (v !== null) { a++; if (v) t++; } } return a >= 6 ? t / a : 0; };
    for (let i = 0; i < n; i++) if (cellAt(i, c) === true && after[i] !== null && after[i] >= 0.5 && trAfter[i] >= 10 && soon(i) >= 0.6) { filledFrom[c] = rows[i].t; break; }
  }
  Object.entries(game.fix || {}).forEach(([c, t]) => { filledFrom[+c] = t; });
  const truthMask = (t) => filledFrom.reduce((m, f, c) => (f <= t ? m | (1 << c) : m), 0);

  for (const k in store) delete store[k];
  const a = new Advisor();
  a.s.goal = 'avg'; a.liveOn = true; a.liveReset();
  let judged = 0, wrong = 0, run = 0, longest = 0, lastChange = -99, prevTruth = 0;
  const log = [];
  let pm = -1;
  rows.forEach((x) => {
    T = 1000 + x.t * 1000;
    a.liveFrame(x.r, false);
    const tm = truthMask(x.t);
    if (tm !== prevTruth) { lastChange = x.t; prevTruth = tm; }
    if (a.mask !== pm) { log.push(`  ${x.t.toFixed(1).padStart(6)} s  round ${a.round}  ${a.L.note || ''}`); pm = a.mask; }
    // judged while the game is in view, from 3 s after its scorecard changed (time to see the click)
    if (x.r.status === 'ok' && x.t - lastChange >= 3) {
      judged++;
      if (a.mask !== tm) { wrong++; run += 1 / 6; longest = Math.max(longest, run); } else run = 0;
    }
  });
  // every box the game showed scored, the helper has too, each recorded once (the last click ends the game)
  const missed = filledFrom.map((f, c) => (f < Infinity && a.s.boxes[c] === null ? BOX[c] : null)).filter(Boolean);
  const scoredByGame = filledFrom.filter((f) => f < Infinity).length;
  const ok = wrong / judged < 0.03 && longest < 3 && !missed.length && scoredByGame >= game.boxes;
  if (verbose) console.log(log.join('\n'));
  console.log(`${game.file.padEnd(11)} scorecard wrong ${(100 * wrong / judged).toFixed(1)}% of the time (longest ${longest.toFixed(1)} s), ` +
    `${missed.length ? 'MISSED ' + missed.join(', ') : 'no box missed'}${ok ? '' : '  <- FAILED'}`);
  if (!ok) failed = true;
}
if (failed) { console.error('FAILED'); process.exit(1); }
