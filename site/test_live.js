// Simulates whole games through the live camera helper, frame by frame, with realistic misreads.
//   node site/test_live.js            (add a number to change how many games per scenario)
// A scripted player plays perfect Jumbleberry Fields; each frame the helper gets what the camera
// would report (jars, lids, x3 sign, ROLL button, scorecard, SCORE), with bursts of misreads mixed in.
// It checks the helper's scorecard against the real game: the round must never run ahead.
const path = require('path');

// ---- just enough browser for jbf-advisor.js
let T = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => T }, configurable: true });
globalThis.HTMLElement = class { attachShadow() { return { innerHTML: '', querySelector: () => null }; } };
let Advisor = null;
globalThis.customElements = { get: () => undefined, define: (n, c) => { Advisor = c; } };
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
globalThis.window = globalThis;
globalThis.BerryEngine = require(path.join(__dirname, 'src', 'jbf-engine.js'));
require(process.env.ADVISOR || path.join(__dirname, 'src', 'jbf-advisor.js'));   // ADVISOR=path tests another copy
Object.assign(Advisor.prototype, { render() {}, renderLive() {}, renderProgress() {} });
const E = globalThis.BerryEngine;

// ---- seeded random numbers
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const LET = 'JSPMF', FACES = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4];   // 3 J, 3 S, 2 P, 1 M, 1 Fly
const roll1 = () => FACES[Math.floor(rnd() * 10)];
const FRAME = 150;

// ---- the real game, as a list of screens with how long each lasts
function playGame() {
  const g = { boxes: Array(9).fill(null), score: 0 };
  const screens = [];
  const show = (ms, scr) => screens.push({ ms, ...JSON.parse(JSON.stringify(scr)) });
  let jars = [null, null, null, null, null], locked = [false, false, false, false, false];
  const base = () => ({ jars, locked, cells: g.boxes.map((v) => v !== null), score: g.score, round: g.boxes.filter((v) => v !== null).length + 1, mask: g.boxes.reduce((m, v, i) => (v === null ? m : m | (1 << i)), 0) });
  show(1500, { ...base(), status: 'empty', left: 3, rollOn: true });
  for (let round = 1; round <= 9; round++) {
    for (let r = 1; r <= 3; r++) {
      // press ROLL: the unlocked jars spin, then stop
      const spin = jars.map((j, i) => (locked[i] ? j : null));
      show(600, { ...base(), jars: spin, status: 'partial', left: 3 - r + 1, rollOn: true });
      jars = jars.map((j, i) => (locked[i] ? j : roll1()));
      const hand = [0, 0, 0, 0, 0]; jars.forEach((j) => hand[j]++);
      const mask = base().mask;
      const best = E.rankOptions('avg', { mask, score: g.score, roll: r, hand })[0];
      const st = { status: 'ok', left: 3 - r, rollOn: r < 3 };
      show(1200 + rnd() * 1500, { ...base(), ...st });
      if (best.type === 'keep') {
        const need = best.keep.slice(), want = jars.map((j) => (need[j] > 0 ? (need[j]--, true) : false));
        for (let i = 0; i < 5; i++) if (locked[i] !== want[i]) { locked[i] = want[i]; show(300 + rnd() * 500, { ...base(), ...st }); }
        show(400 + rnd() * 800, { ...base(), ...st });
        continue;
      }
      // hover over the box (the game previews its points), then click it
      show(500 + rnd() * 900, { ...base(), ...st, hover: best.box });
      g.boxes[best.box] = E.scoreBox(hand, best.box); g.score += g.boxes[best.box];
      locked = [false, false, false, false, false];
      if (round === 9) { show(5000, { ...base(), status: 'nojars', left: null, rollOn: null }); return { screens, g }; }
      show(800 + rnd() * 1500, { ...base(), status: 'ok', left: 3, rollOn: true });
      break;
    }
  }
  return { screens, g };
}

// ---- bursts of misreads: each signal goes wrong now and then, for 0.3 to 2.5 seconds
function noiseTrack(rate, totalMs) {
  const out = []; let t = 0;
  while (t < totalMs) { t += -Math.log(1 - rnd()) / rate * 1000; out.push([t, t + 300 + rnd() * 2200, rnd()]); }
  return (now) => { for (const [a, b, v] of out) if (now >= a && now < b) return v; return null; };
}

function runGame(sc) {
  const { screens, g } = playGame();
  const total = screens.reduce((a, s) => a + s.ms, 0) + 2000;
  const n = (k) => noiseTrack(sc.rates[k] || 1e-9, total);
  const N = { ctrNull: n('ctrNull'), ctrWrong: n('ctrWrong'), roll: n('roll'), lock: n('lock'), jar: n('jar'), cell: n('cell'), cellNull: n('cellNull'), scNull: n('scNull'), scWrong: n('scWrong'), lost: n('lost') };
  for (const k in store) delete store[k];   // each game starts with a fresh helper
  const a = new Advisor();
  a.s.goal = 'avg';
  a.liveOn = true; a.liveReset();
  T = 1000;
  let i = 0, left = screens[0].ms, ahead = 0, frames = 0, maxAhead = 0, wrongAdvice = 0, adviceFrames = 0, run = 0, longest = 0, settled = 0, lastKey = '';
  const scr0 = () => screens[Math.min(i, screens.length - 1)];
  for (let t = 0; t < total; t += FRAME) {
    T += FRAME; left -= FRAME;
    while (left <= 0 && i < screens.length - 1) { i++; left += screens[i].ms; }
    const s = scr0();
    // what the camera reports this frame
    let r;
    const lost = N.lost(t);
    if (s.status === 'nojars' || lost !== null) r = { status: 'nojars', jars: [null, null, null, null, null], locked: [false, false, false, false, false], board: null, view: null };
    else {
      const jars = s.jars.map((j) => (j === null ? null : LET[j]));
      const jw = N.jar(t); if (jw !== null && s.status === 'ok') { const k = Math.floor(jw * 5); jars[k] = LET[(LET.indexOf(jars[k]) + 1 + Math.floor(jw * 40) % 4) % 5]; }
      const locked = s.locked.slice(); const lw = N.lock(t); if (lw !== null) { const k = Math.floor(lw * 5); locked[k] = !locked[k]; }
      const cells = s.cells.slice(); if (s.hover !== undefined) cells[s.hover] = true;
      const cw = N.cell(t); if (cw !== null) { const k = Math.floor(cw * 9); cells[k] = !cells[k]; }
      const cn = N.cellNull(t); if (cn !== null) { for (let k = Math.floor(cn * 3) * 3; k < Math.floor(cn * 3) * 3 + 3; k++) cells[k] = null; }
      let left = sc.noCounter || N.ctrNull(t) !== null ? null : s.left;
      const cwr = N.ctrWrong(t); if (cwr !== null && left !== null) left = [0, 1, 2, 3].filter((x) => x !== s.left)[Math.floor(cwr * 3)];
      let rollOn = s.rollOn; if (N.roll(t) !== null) rollOn = rollOn === null ? null : !rollOn;
      let score = N.scNull(t) !== null ? null : s.score;
      const sw = N.scWrong(t); if (sw !== null && score !== null) score = score + [1, -1, 10, 3, 5][Math.floor(sw * 5)];
      r = { status: s.status, jars, locked, view: { size: 120, out: {} }, boxes: [],
        board: { cells, rollActive: rollOn, counter: left === null ? null : { left }, score: score === null ? null : { value: score } } };
    }
    a.liveFrame(r, false);
    // compare with the real game, once the helper has had a moment to catch up
    frames++;
    const helperMask = a.mask, trueMask = s.mask;
    const hr = a.round, tr = s.round;
    if (hr > tr) { ahead++; maxAhead = Math.max(maxAhead, hr - tr); }
    // advice while berries are in the jars, from 2.5 s after they settle (a fair time to catch up after a roll or click)
    const key = s.status + s.jars.join() + s.mask;
    if (key !== lastKey) { lastKey = key; settled = t; }
    if (s.status === 'ok' && s.jars.every((j) => j !== null) && s.left !== 3 && t - settled >= 2500) {
      adviceFrames++;
      if (helperMask !== trueMask) { wrongAdvice++; run += FRAME; longest = Math.max(longest, run); } else run = 0;
    }
  }
  // the end: every box used, and the total matches the game's (what the prize lines go by)
  return { ahead, frames, maxAhead, finalOk: a.mask === 511 && a.score === g.score, wrongAdvice, adviceFrames, longest };
}

const SCENARIOS = [
  { name: 'clean camera', rates: {}, check: (r) => r.gamesAhead === 0 && r.wrong === 0 && r.finalOk === GAMES },
  { name: 'everyday wobble', check: (r) => r.maxAhead <= 1 && r.wrong < 0.03 && r.finalOk >= 0.9 * GAMES, rates: { ctrNull: 0.15, ctrWrong: 0.03, roll: 0.03, lock: 0.04, jar: 0.04, cell: 0.02, cellNull: 0.05, scNull: 0.15, scWrong: 0.02, lost: 0.05 } },
  { name: 'shaky, lots of misreads', rates: { ctrNull: 0.3, ctrWrong: 0.08, roll: 0.08, lock: 0.1, jar: 0.1, cell: 0.05, cellNull: 0.1, scNull: 0.3, scWrong: 0.05, lost: 0.1 } },
  { name: 'upright phone: x3 sign never in view', noCounter: true, rates: { roll: 0.03, lock: 0.04, jar: 0.04, cell: 0.02, cellNull: 0.05, scNull: 0.15, scWrong: 0.02, lost: 0.05 } },
];

const GAMES = +process.argv[2] || 60;
let failed = false;
for (const sc of SCENARIOS) {
  seed = +process.env.SEED || 12345;   // SEED=n for another set of games
  let ahead = 0, frames = 0, finalOk = 0, maxAhead = 0, gamesAhead = 0, wrong = 0, adv = 0, longest = 0;
  for (let k = 0; k < GAMES; k++) {
    const r = runGame(sc);
    ahead += r.ahead; frames += r.frames; finalOk += r.finalOk ? 1 : 0; maxAhead = Math.max(maxAhead, r.maxAhead);
    if (r.maxAhead > 0) gamesAhead++;
    wrong += r.wrongAdvice; adv += r.adviceFrames; longest = Math.max(longest, r.longest);
  }
  const p = (x, y) => (100 * x / Math.max(1, y)).toFixed(1) + '%';
  console.log(`${sc.name}
   round ahead of the game: ${p(ahead, frames)} of the time, in ${gamesAhead}/${GAMES} games (at most +${maxAhead})` +
    `
   advice from the wrong scorecard: ${p(wrong, adv)} of the time (longest stretch ${(longest / 1000).toFixed(1)} s)` +
    `
   final total right: ${finalOk}/${GAMES} games`);
  if (sc.check && !sc.check({ gamesAhead, maxAhead, wrong: wrong / Math.max(1, adv), finalOk })) { failed = true; console.error('   ^ FAILED'); }
}
if (failed) { console.error('FAILED'); process.exit(1); }
