"""Strategy library + a vectorised simulator.

Every strategy implements the same *batch* interface (all arguments are arrays with one
entry per simultaneous game):

    keep(mask, score, rolls_left, hand, rng) -> keep index   (rolls_left is 2 or 1)
    choose(mask, score, hand, rng)          -> category index (must be an open box)

Keeping the whole hand (``HAND_TO_KEEP[hand]``) means "stop rolling and score now".
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from engine import (BERRIES, CATEGORIES, EMPTY_KEEP, HAND_TO_KEEP, HANDS, KEEP_INDEX,
                    N_CATS, N_HANDS, N_MASKS, OPEN, SCORES, SORTED_JARS, VALUES, _code, roll)

J, S, P, M, F = range(5)
JB, SB, PB, MB, B3, B4, B5, MIX, FREE = range(9)


# =========================================================================== simulator
@dataclass
class Results:
    name: str
    cat_scores: np.ndarray            # (N, 9) points written in each box
    fill_round: np.ndarray            # (N, 9) round (1-9) each box was filled
    rolls_used: np.ndarray            # (N, 9) rolls used in each round (by round)
    regret: np.ndarray | None = None  # (N,) expected points given away vs perfect play
    total: np.ndarray = field(init=False)

    def __post_init__(self):
        self.total = self.cat_scores.sum(1)

    def summary(self) -> dict:
        t = self.total
        out = {
            'strategy': self.name, 'games': len(t), 'mean': t.mean(), 'sd': t.std(),
            'p10': np.percentile(t, 10), 'median': np.median(t), 'p90': np.percentile(t, 90),
            'max': t.max(), 'P(>=121)': (t >= 121).mean(), 'P(>=141)': (t >= 141).mean(),
        }
        if self.regret is not None:
            out['pts lost/game'] = self.regret.mean()
        return out


def simulate(strategy, n_games: int = 100_000, seed: int = 0, batch: int = 50_000,
             solver=None) -> Results:
    """Play ``n_games`` with ``strategy``.  Pass an ExpectedScoreSolver to also measure regret
    (expected points each decision gives away compared with the optimal decision)."""
    rng = np.random.default_rng(seed)
    parts = []
    for start in range(0, n_games, batch):
        n = min(batch, n_games - start)
        parts.append(_simulate_batch(strategy, n, rng, solver))
    cs, fr, ru, rg = (np.concatenate(x) for x in zip(*parts))
    return Results(getattr(strategy, 'name', type(strategy).__name__), cs, fr, ru,
                   rg if solver is not None else None)


def _simulate_batch(strategy, n, rng, solver=None):
    mask = np.zeros(n, dtype=np.int64)
    score = np.zeros(n, dtype=np.int64)
    cat_scores = np.zeros((n, N_CATS), dtype=np.int64)
    fill_round = np.zeros((n, N_CATS), dtype=np.int64)
    rolls_used = np.zeros((n, N_CATS), dtype=np.int64)
    regret = np.zeros(n)
    idx = np.arange(n)
    for rnd in range(N_CATS):
        hand = roll(np.full(n, EMPTY_KEEP), rng)
        used = np.ones(n, dtype=np.int64)
        for rolls_left in (2, 1):
            k = np.asarray(strategy.keep(mask, score, rolls_left, hand, rng))
            if solver is not None:
                best = (solver.E1 if rolls_left == 2 else solver.E2)[mask, hand]
                got = (solver.K1 if rolls_left == 2 else solver.K2)[mask, k]
                regret += best - got
            stop = k == HAND_TO_KEEP[hand]           # locking every jar = no re-roll
            used += ~stop
            hand = np.where(stop, hand, roll(k, rng))
        c = np.asarray(strategy.choose(mask, score, hand, rng))
        assert OPEN[mask, c].all(), f'{strategy} chose a used box'
        pts = SCORES[hand, c]
        if solver is not None:
            regret += solver.E3[mask, hand] - (pts + solver.V[mask | (1 << c)])
        cat_scores[idx, c] = pts
        fill_round[idx, c] = rnd + 1
        rolls_used[:, rnd] = used
        score += pts
        mask |= 1 << c
    return cat_scores, fill_round, rolls_used, np.maximum(regret, 0)


# =========================================================================== helpers
def _keep_counts(counts: np.ndarray) -> np.ndarray:
    return KEEP_INDEX[_code(counts)]


def _best_box(mask, hand, rng, tiebreak_random=True):
    """Open box with the most points right now (ties broken randomly)."""
    pts = np.where(OPEN[mask], SCORES[hand], -1).astype(float)
    if tiebreak_random:
        pts = pts + rng.random(pts.shape) * 1e-3
    return pts.argmax(1)


class TableStrategy:
    """A deterministic strategy stored as lookup tables over (mask, hand)."""

    def __init__(self, name, keep1, keep2, cat):
        self.name, self.keep1, self.keep2, self.cat = name, keep1, keep2, cat

    def keep(self, mask, score, rolls_left, hand, rng=None):
        return (self.keep1 if rolls_left == 2 else self.keep2)[mask, hand]

    def choose(self, mask, score, hand, rng=None):
        return self.cat[mask, hand]

    @classmethod
    def from_functions(cls, name, keep_fn, choose_fn):
        """Build tables by calling scalar rule functions on every (mask, hand)."""
        k1 = np.zeros((N_MASKS, N_HANDS), dtype=np.int64)
        k2 = np.zeros_like(k1)
        cat = np.zeros_like(k1)
        for m in range(N_MASKS - 1):
            opens = [c for c in range(N_CATS) if OPEN[m, c]]
            for h in range(N_HANDS):
                cnt = HANDS[h]
                k1[m, h] = _keep_counts(np.asarray(keep_fn(cnt, opens, 2)))
                k2[m, h] = _keep_counts(np.asarray(keep_fn(cnt, opens, 1)))
                cat[m, h] = choose_fn(cnt, opens)
        return cls(name, k1, k2, cat)


# =========================================================================== baselines
class RandomPlay:
    """Lock a random number (0-5) of random jars each roll, then pick a random open box.
    (Same idea as the original simulate_random_play, with the keep-by-type bug fixed.)"""
    name = 'Random'

    def keep(self, mask, score, rolls_left, hand, rng):
        n = len(hand)
        jars = SORTED_JARS[hand]
        nkeep = rng.integers(0, 6, n)
        order = rng.random((n, 5)).argsort(1)
        chosen = np.zeros((n, 5), dtype=bool)
        chosen[np.arange(n)[:, None], order] = np.arange(5)[None, :] < nkeep[:, None]
        counts = np.stack([((jars == t) & chosen).sum(1) for t in range(5)], 1)
        return _keep_counts(counts)

    def choose(self, mask, score, hand, rng):
        r = np.where(OPEN[mask], rng.random((len(mask), N_CATS)), -1)
        return r.argmax(1)


class RandomKeepsBestBox(RandomPlay):
    """Random locks, but always write the hand in the box worth the most points
    (the original semi-random simulation)."""
    name = 'Random locks, best box'

    def choose(self, mask, score, hand, rng):
        return _best_box(mask, hand, rng)


class OneRollBestBox:
    """Never re-roll: take the first roll and put it in the box worth the most."""
    name = 'One roll, best box'

    def keep(self, mask, score, rolls_left, hand, rng=None):
        return HAND_TO_KEEP[hand]

    def choose(self, mask, score, hand, rng):
        return _best_box(mask, hand, rng)


# =========================================================================== rule-based players
def _most_common_keep(cnt, opens, rolls_left):
    """Keep every copy of the most common berry (ties -> more valuable berry). Never keeps flies."""
    berries = cnt[:4]
    best = max(range(4), key=lambda t: (berries[t], VALUES[t]))
    k = np.zeros(5, dtype=int)
    k[best] = berries[best]
    return k


def _best_box_scalar(cnt, opens):
    sc = SCORES[_hand_idx(cnt)]
    return max(opens, key=lambda c: (sc[c], -c))


def _hand_idx(cnt):
    from engine import HAND_INDEX
    return int(HAND_INDEX[_code(np.asarray(cnt))])


def most_common_berry() -> TableStrategy:
    """Classic 'Yahtzee instinct': keep the biggest group of matching berries, take the best box."""
    return TableStrategy.from_functions('Keep most common, best box', _most_common_keep, _best_box_scalar)


# "Par" = what a decent result in each box looks like.  Writing a hand into a box costs
# you (par - score) relative to normal, so you dump bad hands where they hurt least.
# Jumbleberry/Sugarberry have low par: they are the throw-away boxes.
HIGH_ROLLER_PAR = np.array([4, 4, 12, 14, 20, 17, 12, 17, 20])


def _high_roller_keep(cnt, opens, rolls_left):
    k = np.zeros(5, dtype=int)
    big = max(range(4), key=lambda t: (cnt[t], VALUES[t]))
    if cnt[big] >= 3 and ({B3, B4, B5} & set(opens)):
        k[big] = cnt[big]                     # chasing a basket
        k[M] = cnt[M]
        return k
    distinct = [t for t in range(4) if cnt[t] >= 1]
    if MIX in opens and len(distinct) >= 3:
        for t in distinct:
            k[t] = 1
        k[M] = cnt[M]                         # extra Moonberries are free points
        return k
    k[M] = cnt[M]                             # always hang on to the big berries
    k[P] = cnt[P]
    return k


def _par_box(par):
    def choose(cnt, opens):
        sc = SCORES[_hand_idx(cnt)]
        return max(opens, key=lambda c: (sc[c] - par[c], -c))
    return choose


def high_roller() -> TableStrategy:
    """The 'go big' plan: chase baskets, Mixed Baskets and Moonberries, and use the
    Jumbleberry / Sugarberry boxes as throw-aways for bad rounds."""
    return TableStrategy.from_functions('High-roller (J/S as throw-aways)',
                                        _high_roller_keep, _par_box(HIGH_ROLLER_PAR))


# =========================================================================== par-sheet player
# Tuned by tune_par() (coordinate search on the exact average).  Read it as "what an open
# box is worth to you": write a hand where (points - par) is highest.
TUNED_PAR = np.array([10, 10, 13, 13, 18, 14, 6, 14, 21], dtype=float)


def _single_box_chase_tables():
    """For each box c: best keeps and expected points when you chase only that box."""
    from engine import SUBKEEPS, TRANSITION
    E1, E2 = np.zeros((N_CATS, N_HANDS)), np.zeros((N_CATS, N_HANDS))
    K1, K2 = np.zeros((N_CATS, N_HANDS), int), np.zeros((N_CATS, N_HANDS), int)
    rows = np.arange(N_HANDS)
    for c in range(N_CATS):
        sub = (TRANSITION @ SCORES[:, c].astype(float))[SUBKEEPS]
        K2[c], E2[c] = SUBKEEPS[rows, sub.argmax(1)], sub.max(1)
        sub = (TRANSITION @ E2[c])[SUBKEEPS]
        K1[c], E1[c] = SUBKEEPS[rows, sub.argmax(1)], sub.max(1)
    return E1, E2, K1, K2


def par_sheet(par=TUNED_PAR, name='Target box + par sheet') -> TableStrategy:
    """Human-style play: each roll pick ONE open box to chase (the one whose expected result
    beats its par by the most), lock the berries that help it, and at the end write the hand
    in the box where (points - par) is highest."""
    par = np.asarray(par, dtype=float)
    E1, E2, K1, K2 = _single_box_chase_tables()
    k1 = np.zeros((N_MASKS, N_HANDS), dtype=np.int64)
    k2, cat = np.zeros_like(k1), np.zeros_like(k1)
    rows = np.arange(N_HANDS)
    for m in range(N_MASKS - 1):
        o = np.nonzero(OPEN[m])[0]
        k1[m] = K1[o[(E1[o] - par[o, None]).argmax(0)], rows]
        k2[m] = K2[o[(E2[o] - par[o, None]).argmax(0)], rows]
        cat[m] = o[(SCORES[:, o] - par[o]).argmax(1)]
    return TableStrategy(name, k1, k2, cat)


def exact_mean(strategy: TableStrategy) -> float:
    from engine import MAX_SCORE
    from solver import score_distribution
    p = score_distribution(strategy.cat, strategy.keep1, strategy.keep2)
    return float((p * np.arange(MAX_SCORE + 1)).sum())


def tune_par(start=(7, 7, 11, 15, 21, 16, 6, 18, 21), sweeps: int = 6, verbose=True):
    """Coordinate search over integer par values to maximise the exact average score."""
    par = np.array(start, dtype=float)
    best = exact_mean(par_sheet(par))
    for sweep in range(sweeps):
        improved = False
        for c in range(N_CATS):
            for d in (-3, -2, -1, 1, 2, 3):
                trial = par.copy()
                trial[c] += d
                v = exact_mean(par_sheet(trial))
                if v > best + 1e-9:
                    best, par, improved = v, trial, True
        if verbose:
            print(f'sweep {sweep}: par={par.astype(int).tolist()} mean={best:.3f}', flush=True)
        if not improved:
            break
    return par, best


def all_strategies(ev_solver=None, threshold_solver=None, extra=()):
    """Every baseline in increasing order of sophistication."""
    from solver import ExpectedScoreSolver, ThresholdSolver
    ev = ev_solver or ExpectedScoreSolver()
    th = threshold_solver or ThresholdSolver(ev)
    greedy = ExpectedScoreSolver(plan_ahead=False)
    greedy.name = 'Best single round (no planning)'
    ev.name = 'Optimal (max average)'
    out = [RandomPlay(), RandomKeepsBestBox(), OneRollBestBox(), most_common_berry(),
           high_roller(), greedy, *extra, par_sheet(), ev,
           th.policy(121, 'Optimal for >= 121 (1 Moonberry)'),
           th.policy(141, 'Optimal for >= 141 (2 Moonberries)')]
    return out
