/*!
 * Berry dice engine: exact optimal play for the 5-dice, 3-roll, 9-box berry game.
 * Port of jumbleberry_fields/solver.py. No dependencies; runs in browsers and Node.
 *
 * Faces (index): 0 = common A (2 pts, 30%), 1 = common B (2 pts, 30%), 2 = uncommon (4 pts, 20%),
 *                3 = rare (7 pts, 10%), 4 = pest (0 pts, 10%).
 * Boxes (index): 0-3 = per-face boxes (A, B, uncommon, rare), 4 = three alike, 5 = four alike,
 *                6 = five alike, 7 = one of each fruit (mixed), 8 = free.
 * A hand / keep is a count vector [a, b, u, r, pest].  A mask is a 9-bit set of used boxes.
 *
 * Goals:  'avg'  maximise average score
 *         'moon' maximise expected prizes for {121: 1, 141: 1}  (most prizes over time)
 *         't121' maximise P(score >= 121)      't141' maximise P(score >= 141)
 */
(function (root) {
  'use strict';
  const VALUES = [2, 2, 4, 7, 0];
  const PROBS = [0.3, 0.3, 0.2, 0.1, 0.1];
  const NC = 9, NM = 512, FULL = 511;
  const GOALS = {
    avg: null,
    moon: [[121, 1], [141, 1]],
    t121: [[121, 1]],
    t141: [[141, 1]],
  };

  // ------------------------------------------------------------------ enumeration
  function multisets(total) {
    const out = [];
    for (let a = 0; a <= total; a++) for (let b = 0; a + b <= total; b++)
      for (let c = 0; a + b + c <= total; c++) for (let d = 0; a + b + c + d <= total; d++)
        out.push([a, b, c, d, total - a - b - c - d]);
    return out;
  }
  const code = (v) => v[0] * 1296 + v[1] * 216 + v[2] * 36 + v[3] * 6 + v[4];
  const HANDS = multisets(5);
  const KEEPS = [];
  for (let n = 0; n <= 5; n++) KEEPS.push(...multisets(n));
  const NH = HANDS.length, NK = KEEPS.length;
  const HAND_INDEX = new Int16Array(7776).fill(-1);
  const KEEP_INDEX = new Int16Array(7776).fill(-1);
  HANDS.forEach((h, i) => (HAND_INDEX[code(h)] = i));
  KEEPS.forEach((k, i) => (KEEP_INDEX[code(k)] = i));
  const HAND_TO_KEEP = HANDS.map((h) => KEEP_INDEX[code(h)]);

  // scores[h * 9 + c]
  const SCORES = new Int16Array(NH * NC);
  HANDS.forEach((c, h) => {
    const total = c[0] * 2 + c[1] * 2 + c[2] * 4 + c[3] * 7;
    const big = Math.max(...c);
    const row = [2 * c[0], 2 * c[1], 4 * c[2], 7 * c[3], big >= 3 ? total : 0, big >= 4 ? total : 0,
      big >= 5 ? total : 0, c[0] && c[1] && c[2] && c[3] ? total : 0, total];
    row.forEach((v, j) => (SCORES[h * NC + j] = v));
  });

  // sparse transition (CSR): keep k -> (hand h, probability)
  const fact = [1, 1, 2, 6, 24, 120];
  const T_ptr = new Int32Array(NK + 1), T_h = [], T_p = [];
  KEEPS.forEach((k, ki) => {
    const n = 5 - k.reduce((a, b) => a + b, 0);
    multisets(n).forEach((d) => {
      let p = fact[n];
      for (let i = 0; i < 5; i++) p = p / fact[d[i]] * Math.pow(PROBS[i], d[i]);
      T_h.push(HAND_INDEX[code(k.map((x, i) => x + d[i]))]);
      T_p.push(p);
    });
    T_ptr[ki + 1] = T_h.length;
  });
  const TH = Int16Array.from(T_h), TP = Float64Array.from(T_p);
  const EMPTY = KEEP_INDEX[0];
  const FIRST = new Float64Array(NH);
  for (let j = T_ptr[EMPTY]; j < T_ptr[EMPTY + 1]; j++) FIRST[TH[j]] = TP[j];

  // every distinct keep you can make from hand h (CSR)
  const S_ptr = new Int32Array(NH + 1), S_k = [];
  HANDS.forEach((h, hi) => {
    for (let a = 0; a <= h[0]; a++) for (let b = 0; b <= h[1]; b++) for (let c = 0; c <= h[2]; c++)
      for (let d = 0; d <= h[3]; d++) for (let e = 0; e <= h[4]; e++) S_k.push(KEEP_INDEX[code([a, b, c, d, e])]);
    S_ptr[hi + 1] = S_k.length;
  });
  const SK = Int16Array.from(S_k);

  const popcount = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
  const MASK_ORDER = Array.from({ length: NM }, (_, m) => m).sort((a, b) => popcount(b) - popcount(a));
  const openBoxes = (m) => { const o = []; for (let c = 0; c < NC; c++) if (!((m >> c) & 1)) o.push(c); return o; };

  // ------------------------------------------------------------------ stage helpers (N columns)
  // K = T*E and Emax[h] = max over sub-keeps of K.  Optional output buffers avoid GC churn.
  // Only the first `cols` columns (of stride N) are computed.
  function stage(E, N, K, Em, cols = N) {
    K = K ? K.fill(0) : new Float64Array(NK * N);
    Em = Em || new Float64Array(NH * N);
    for (let k = 0; k < NK; k++) {
      const ko = k * N;
      for (let j = T_ptr[k]; j < T_ptr[k + 1]; j++) {
        const p = TP[j], ho = TH[j] * N;
        for (let s = 0; s < cols; s++) K[ko + s] += p * E[ho + s];
      }
    }
    for (let h = 0; h < NH; h++) {
      const ho = h * N;
      for (let s = 0; s < cols; s++) Em[ho + s] = -Infinity;
      for (let j = S_ptr[h]; j < S_ptr[h + 1]; j++) {
        const ko = SK[j] * N;
        for (let s = 0; s < cols; s++) if (K[ko + s] > Em[ho + s]) Em[ho + s] = K[ko + s];
      }
    }
    return [K, Em];
  }
  // Most points the used boxes can hold: no reachable state has more banked than this.
  const BOX_MAX = [10, 10, 20, 35, 35, 35, 35, 22, 35];
  const maxBanked = (m) => { let t = 0; for (let c = 0; c < NC; c++) if ((m >> c) & 1) t += BOX_MAX[c]; return t; };

  // ------------------------------------------------------------------ average-score solver
  let EV = null;
  function evMaskStages(m, V) {
    const opens = openBoxes(m), E3 = new Float64Array(NH);
    for (let h = 0; h < NH; h++) {
      let best = -Infinity;
      for (const c of opens) { const v = SCORES[h * NC + c] + V[m | (1 << c)]; if (v > best) best = v; }
      E3[h] = best;
    }
    const [K2, E2] = stage(E3, 1);
    const [K1, E1] = stage(E2, 1);
    return { E3, K2, E2, K1, E1 };
  }
  function solveEV() {
    if (EV) return EV;
    const V = new Float64Array(NM);
    for (const m of MASK_ORDER) {
      if (m === FULL) continue;
      const { E1 } = evMaskStages(m, V);
      let v = 0; for (let h = 0; h < NH; h++) v += FIRST[h] * E1[h];
      V[m] = v;
    }
    EV = { V, cache: new Map() };
    return EV;
  }
  function evStages(m) {
    const ev = solveEV();
    if (!ev.cache.has(m)) ev.cache.set(m, evMaskStages(m, ev.V));
    return ev.cache.get(m);
  }

  // ------------------------------------------------------------------ prize solvers
  const PRIZE = {};
  function prizeE3(m, W, N, cap, s0, s1, out) {     // E3 for score columns s0..s1-1
    const opens = openBoxes(m), n = s1 - s0;
    const E3 = out ? out.fill(-Infinity) : new Float64Array(NH * n).fill(-Infinity);
    for (const c of opens) {
      const base = (m | (1 << c)) * N;
      for (let h = 0; h < NH; h++) {
        const pts = SCORES[h * NC + c], ho = h * n - s0;
        for (let s = s0; s < s1; s++) {
          const v = W[base + (s + pts < cap ? s + pts : cap)];
          if (v > E3[ho + s]) E3[ho + s] = v;
        }
      }
    }
    return E3;
  }
  async function solvePrize(goal, onProgress) {
    if (PRIZE[goal]) return PRIZE[goal];
    const prizes = GOALS[goal];
    const cap = Math.max(...prizes.map((p) => p[0])), N = cap + 1;
    const W = new Float64Array(NM * N);
    for (let s = 0; s < N; s++) W[FULL * N + s] = prizes.reduce((a, [t, amt]) => a + (s >= t ? amt : 0), 0);
    const bE3 = new Float64Array(NH * N), bK = new Float64Array(NK * N);
    const bE2 = new Float64Array(NH * N), bE1 = new Float64Array(NH * N);
    let done = 0, last = Date.now();
    for (const m of MASK_ORDER) {
      if (m === FULL) continue;
      const cols = Math.min(cap, maxBanked(m)) + 1;   // W[m, s] is only ever read for s < cols
      const E3 = prizeE3(m, W, N, cap, 0, cols, bE3);
      const [, E2] = stage(E3, cols, bK, bE2);
      const [, E1] = stage(E2, cols, bK, bE1);
      for (let s = 0; s < cols; s++) {
        let v = 0; for (let h = 0; h < NH; h++) v += FIRST[h] * E1[h * cols + s];
        W[m * N + s] = v;
      }
      done++;
      if (Date.now() - last > 30) {                 // keep the page responsive
        last = Date.now();
        if (onProgress) onProgress(done / (NM - 1));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (onProgress) onProgress(1);
    PRIZE[goal] = { W, N, cap };
    return PRIZE[goal];
  }

  // ------------------------------------------------------------------ recommendations
  /**
   * Rank every legal move.  state = { mask, score, roll (1-3), hand: [a,b,u,r,pest] }.
   * Returns options sorted best-first: { type: 'keep'|'score', keep?, box?, points?, value, ev }
   * value is in the goal's units (points for 'avg', expected prizes / probability otherwise);
   * ev is always the expected final score, so any move can be graded in points.
   */
  function rankOptions(goal, state) {
    const { mask, score = 0, roll } = state;
    const h = HAND_INDEX[code(state.hand)];
    if (h < 0) throw new Error('A hand needs exactly 5 berries');
    if (mask === FULL) throw new Error('Every box is already used');
    const ev = solveEV(), evs = evStages(mask);
    let P = null, K1p = null, K2p = null;
    if (goal !== 'avg') {
      P = PRIZE[goal];
      if (!P) throw new Error(`Call prepare('${goal}') first`);
      const s = Math.min(score, P.cap, maxBanked(mask));   // only reachable columns were solved
      const E3 = prizeE3(mask, P.W, P.N, P.cap, s, s + 1);
      const [K2, E2] = stage(E3, 1);
      const [K1] = stage(E2, 1);
      K1p = K1; K2p = K2;
    }
    const opts = [];
    for (const c of openBoxes(mask)) {
      const pts = SCORES[h * NC + c];
      const evv = score + pts + ev.V[mask | (1 << c)];
      const value = goal === 'avg' ? evv : P.W[(mask | (1 << c)) * P.N + Math.min(score + pts, P.cap)];
      opts.push({ type: 'score', box: c, points: pts, value, ev: evv });
    }
    if (roll < 3) {
      for (let j = S_ptr[h]; j < S_ptr[h + 1]; j++) {
        const k = SK[j];
        if (k === HAND_TO_KEEP[h]) continue;       // keeping everything = scoring now
        const evv = score + (roll === 1 ? evs.K1[k] : evs.K2[k]);
        const value = goal === 'avg' ? evv : (roll === 1 ? K1p[k] : K2p[k]);
        opts.push({ type: 'keep', keep: KEEPS[k].slice(), value, ev: evv });
      }
    }
    opts.sort((a, b) => (b.value - a.value) || (b.ev - a.ev));
    return opts;
  }

  /** Expected points a move gives away versus the best move (for game reviews). */
  function pointsLost(state, move) {
    const opts = rankOptions('avg', state);
    const best = opts[0].ev;
    const same = (o) => (move.type === 'score' ? o.type === 'score' && o.box === move.box
      : o.type === 'keep' && o.keep.every((x, i) => x === move.keep[i]));
    const mine = opts.find(same);
    return { lost: mine ? Math.max(0, best - mine.ev) : 0, best: opts[0] };
  }

  function scoreBox(hand, box) { return SCORES[HAND_INDEX[code(hand)] * NC + box]; }
  function rollDie(rng = Math.random) {
    const u = rng(); let acc = 0;
    for (let i = 0; i < 5; i++) { acc += PROBS[i]; if (u < acc) return i; }
    return 4;
  }

  const API = {
    VALUES, PROBS, GOALS: Object.keys(GOALS), NC, FULL,
    prepare: (goal, onProgress) => (goal === 'avg' ? Promise.resolve(solveEV()) : solvePrize(goal, onProgress)),
    isReady: (goal) => (goal === 'avg' ? (solveEV(), true) : !!PRIZE[goal]),   // the average solver takes ~50 ms
    expectedFromStart: (goal) => (goal === 'avg' ? solveEV().V[0] : PRIZE[goal].W[0]),
    /** Value at the start of a round (before rolling): expected final score for 'avg',
     *  otherwise the best achievable P(target) / expected prizes from this scorecard. */
    roundStartValue: (goal, mask, score = 0) => {
      if (goal === 'avg') return score + solveEV().V[mask];
      const P = PRIZE[goal];
      return P.W[mask * P.N + Math.min(score, P.cap, maxBanked(mask))];
    },
    rankOptions, pointsLost, scoreBox, rollDie, solveEV,
    counts: (faces) => { const c = [0, 0, 0, 0, 0]; faces.forEach((f) => c[f]++); return c; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.BerryEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
