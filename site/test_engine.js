// Checks that the browser engine matches the Python solver.   Run:  node site/test_engine.js
const assert = require('assert');
const E = require('./src/jbf-engine.js');

const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) < tol, `${what}: got ${a}, expected ${b}`);
const lockOf = (o) => o.keep.map((n, i) => 'JSPMF'[i].repeat(n)).join('');

(async () => {
  near(E.expectedFromStart('avg'), 121.8025, 1e-3, 'optimal average');
  for (const [goal, v] of [['t121', 0.5795], ['t141', 0.1098], ['moon', 0.6676]]) {
    await E.prepare(goal);
    near(E.expectedFromStart(goal), v, 1e-3, goal);
  }
  // J S P M F on the first roll of the game: lock just P M
  let best = E.rankOptions('avg', { mask: 0, score: 0, roll: 1, hand: [1, 1, 1, 1, 1] })[0];
  assert.strictEqual(lockOf(best), 'PM', 'opening J S P M F');
  // M M M J J with Moonberry and Basket of 3 open: Moonberry (21) beats Basket of 3 (25)
  best = E.rankOptions('avg', { mask: 0b000100111, score: 30, roll: 3, hand: [2, 0, 0, 3, 0] })[0];
  assert.strictEqual(best.box, 3, 'three Moonberries go in Moonberry');
  // scoring table spot checks
  assert.strictEqual(E.scoreBox([1, 1, 1, 2, 0], 7), 22, 'Mixed Basket max');
  assert.strictEqual(E.scoreBox([0, 0, 0, 0, 5], 6), 0, 'five Flies');
  assert.strictEqual(E.scoreBox([3, 0, 0, 0, 2], 4), 6, 'three Jumbleberries in Basket of 3');
  console.log('engine OK');
})().catch((e) => { console.error(e.message); process.exit(1); });
