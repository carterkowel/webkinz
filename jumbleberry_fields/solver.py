"""Exact optimal play for Jumbleberry Fields via dynamic programming.

Two solvers:

* ``ExpectedScoreSolver`` maximises the average final score.
  Because there is no bonus, the only thing about the scorecard that matters for
  the future is *which* boxes are used (a 9-bit mask), so the state space is tiny:
  512 masks x 3 roll stages x 126 hands.

* ``ThresholdSolver`` maximises P(final score >= target).  Here the points still
  needed matter, so the state adds ``need`` (0..237).  One solve covers every
  target at once: the best action depends only on (mask, need, rolls left, hand).

Within a round (for a fixed mask) the backward recursion is

    E3[h] = max_{open c} score[h, c] + V[mask | c]      (after 3rd roll: must score)
    K2[k] = sum_h T[k, h] * E3[h]                        (keep k, 1 re-roll left)
    E2[h] = max_{k subset of h} K2[k]                    (after 2nd roll; k = h means stop)
    K1[k] = sum_h T[k, h] * E2[h]
    E1[h] = max_{k subset of h} K1[k]                    (after 1st roll)
    V[mask] = sum_h FIRST_ROLL[h] * E1[h]
"""
from __future__ import annotations

import os
import time

import numpy as np

from engine import (CATEGORIES, FIRST_ROLL, FULL_MASK, HAND_TO_KEEP, KEEPS, MAX_SCORE,
                    N_CATS, N_HANDS, N_MASKS, OPEN, POPCOUNT, SCORES, SUBKEEPS,
                    TRANSITION)

_MASKS_BY_FILL = sorted(range(N_MASKS), key=lambda m: -POPCOUNT[m])  # full first
_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')


class ExpectedScoreSolver:
    """Optimal policy for maximising the average score.

    With ``plan_ahead=False`` it becomes the *turn-greedy* player: perfect tactics for
    maximising this round's points (minus an optional per-box ``par``), but no thought
    for future rounds.  That isolates how much long-term planning is worth.
    """

    def __init__(self, plan_ahead: bool = True, par=None):
        self.plan_ahead = plan_ahead
        self.par = np.zeros(N_CATS) if par is None else np.asarray(par, dtype=float)
        t0 = time.time()
        self.V = np.zeros(N_MASKS)                          # value at round start
        self.E3 = np.zeros((N_MASKS, N_HANDS))              # value of hand after roll 3
        self.K2 = np.zeros((N_MASKS, len(KEEPS)))           # value of keep with 1 re-roll left
        self.E2 = np.zeros((N_MASKS, N_HANDS))
        self.K1 = np.zeros((N_MASKS, len(KEEPS)))           # value of keep with 2 re-rolls left
        self.E1 = np.zeros((N_MASKS, N_HANDS))
        self.cat = np.full((N_MASKS, N_HANDS), -1, dtype=np.int64)
        self.keep2 = np.zeros((N_MASKS, N_HANDS), dtype=np.int64)  # decision after roll 2
        self.keep1 = np.zeros((N_MASKS, N_HANDS), dtype=np.int64)  # decision after roll 1

        for m in _MASKS_BY_FILL:
            if m == FULL_MASK:
                continue
            opens = np.nonzero(OPEN[m])[0]
            future = self.V[m | (1 << opens)] if plan_ahead else 0.0
            cand = SCORES[:, opens] + future - self.par[opens]       # (126, n_open)
            best = cand.argmax(1)
            self.cat[m] = opens[best]
            self.E3[m] = cand[np.arange(N_HANDS), best]
            self.K2[m] = TRANSITION @ self.E3[m]
            sub = self.K2[m][SUBKEEPS]
            self.keep2[m] = SUBKEEPS[np.arange(N_HANDS), self._argmax_prefer_stop(sub, m, self.K2)]
            self.E2[m] = sub.max(1)
            self.K1[m] = TRANSITION @ self.E2[m]
            sub = self.K1[m][SUBKEEPS]
            self.keep1[m] = SUBKEEPS[np.arange(N_HANDS), self._argmax_prefer_stop(sub, m, self.K1)]
            self.E1[m] = sub.max(1)
            self.V[m] = FIRST_ROLL @ self.E1[m]
        self.solve_seconds = time.time() - t0

    @staticmethod
    def _argmax_prefer_stop(sub, m, K):
        """argmax over sub-keeps; on (near) ties prefer keeping everything (= stop rolling)."""
        best = sub.argmax(1)
        stop_val = K[m][HAND_TO_KEEP]
        stop_pos = (np.array(SUBKEEPS) == HAND_TO_KEEP[:, None]).argmax(1)
        tie = sub.max(1) - stop_val < 1e-9
        best[tie] = stop_pos[tie]
        return best

    @property
    def expected_score(self) -> float:
        return float(self.V[0])

    # -- batch policy interface (see strategies.py) --------------------------------
    def keep(self, mask, score, rolls_left, hand, rng=None):
        return (self.keep1 if rolls_left == 2 else self.keep2)[mask, hand]

    def choose(self, mask, score, hand, rng=None):
        return self.cat[mask, hand]


class ThresholdSolver:
    """Optimal policy for maximising P(final score >= target), for every target at once.

    W[mask, need] = best achievable probability of scoring at least ``need`` more points
    from a round start with boxes ``mask`` used.  need = 0 means already there (prob 1).
    """

    def __init__(self, ev: ExpectedScoreSolver | None = None, cache: bool = True):
        path = os.path.join(_CACHE_DIR, 'threshold_solver.npz')
        if cache and os.path.exists(path):
            d = np.load(path)
            self.W, self.cat, self.keep1, self.keep2 = d['W'], d['cat'], d['keep1'], d['keep2']
            self.solve_seconds = float(d['solve_seconds'])
            return
        ev = ev or ExpectedScoreSolver()
        t0 = time.time()
        N = MAX_SCORE + 1
        need = np.arange(N)
        self.W = np.zeros((N_MASKS, N))
        self.W[:, 0] = 1.0
        # Policy tables indexed [mask, need, hand]; ties broken toward the higher-EV action.
        self.cat = np.zeros((N_MASKS, N, N_HANDS), dtype=np.int8)
        self.keep1 = np.zeros((N_MASKS, N, N_HANDS), dtype=np.int16)
        self.keep2 = np.zeros((N_MASKS, N, N_HANDS), dtype=np.int16)
        eps = 1e-9 / MAX_SCORE
        rows = np.arange(N_HANDS)[:, None]

        for m in _MASKS_BY_FILL:
            if m == FULL_MASK:
                continue
            opens = np.nonzero(OPEN[m])[0]
            # cand[h, n, j] = P(success | score box opens[j] with hand h, need n)
            pts = SCORES[:, opens]                                            # (126, o)
            rem = np.maximum(need[None, :, None] - pts[:, None, :], 0)        # (126, N, o)
            cand = self.W[m | (1 << opens)][np.arange(len(opens))[None, None, :], rem]
            tieb = (SCORES[:, opens] + ev.V[m | (1 << opens)])[:, None, :] * eps
            best = (cand + tieb).argmax(2)                                    # (126, N)
            self.cat[m] = opens[best].T
            E3 = np.take_along_axis(cand, best[..., None], 2)[..., 0]         # (126, N)

            K2 = TRANSITION @ E3                                              # (252, N)
            sub = K2[SUBKEEPS]                                                # (126, MAXSUB, N)
            subt = sub + (ev.K2[m][SUBKEEPS] * eps)[..., None]
            b = subt.argmax(1)                                                # (126, N)
            self.keep2[m] = SUBKEEPS[rows, b].T
            E2 = np.take_along_axis(sub, b[:, None, :], 1)[:, 0, :]

            K1 = TRANSITION @ E2
            sub = K1[SUBKEEPS]
            subt = sub + (ev.K1[m][SUBKEEPS] * eps)[..., None]
            b = subt.argmax(1)
            self.keep1[m] = SUBKEEPS[rows, b].T
            E1 = np.take_along_axis(sub, b[:, None, :], 1)[:, 0, :]

            self.W[m] = FIRST_ROLL @ E1
            self.W[m, 0] = 1.0
        self.solve_seconds = time.time() - t0
        if cache:
            os.makedirs(_CACHE_DIR, exist_ok=True)
            np.savez_compressed(path, W=self.W, cat=self.cat, keep1=self.keep1,
                                keep2=self.keep2, solve_seconds=self.solve_seconds)

    def prob(self, target: int, mask: int = 0, score: int = 0) -> float:
        n = int(np.clip(target - score, 0, MAX_SCORE))
        return float(self.W[mask, n])

    def policy(self, target: int, name: str | None = None) -> 'ThresholdPolicy':
        return ThresholdPolicy(self, target, name)

    def stage_values(self, mask: int, need: int):
        """(E3, K2, E2, K1) success probabilities for one round with boxes ``mask`` used."""
        opens = np.nonzero(OPEN[mask])[0]
        rem = np.maximum(need - SCORES[:, opens], 0)                       # (126, o)
        E3 = self.W[mask | (1 << opens)][np.arange(len(opens))[None, :], rem].max(1)
        K2 = TRANSITION @ E3
        E2 = K2[SUBKEEPS].max(1)
        K1 = TRANSITION @ E2
        return E3, K2, E2, K1


class ThresholdPolicy:
    """Batch policy that plays to maximise P(score >= target)."""

    def __init__(self, solver: ThresholdSolver, target: int, name: str | None = None):
        self.s, self.target = solver, target
        self.name = name or f'Optimal for >= {target}'

    def _need(self, score):
        return np.clip(self.target - np.asarray(score), 0, MAX_SCORE)

    def keep(self, mask, score, rolls_left, hand, rng=None):
        tab = self.s.keep1 if rolls_left == 2 else self.s.keep2
        return tab[mask, self._need(score), hand].astype(np.int64)

    def choose(self, mask, score, hand, rng=None):
        return self.s.cat[mask, self._need(score), hand].astype(np.int64)


class PrizeSolver:
    """Maximise the expected prize for a schedule like {121: 1, 141: 1}
    (1 Moonberry at 121+, a 2nd at 141+), i.e. the most Moonberries won over many games.

    The state adds the points scored so far, clipped at the top threshold (beyond it nothing
    changes).  W[mask, s] = best expected prize from a round start with boxes ``mask`` used
    and ``s`` points banked.  Ties are broken toward the higher-average-score move.
    """

    def __init__(self, prizes=None, ev: ExpectedScoreSolver | None = None):
        self.prizes = prizes or {121: 1, 141: 1}
        ev = ev or ExpectedScoreSolver()
        t0 = time.time()
        self.cap = cap = max(self.prizes)
        N = cap + 1
        s = np.arange(N)
        u = sum(amount * (s >= t) for t, amount in self.prizes.items()).astype(float)
        self.W = np.zeros((N_MASKS, N))
        self.W[FULL_MASK] = u
        self.cat = np.zeros((N_MASKS, N, N_HANDS), dtype=np.int8)
        self.keep1 = np.zeros((N_MASKS, N, N_HANDS), dtype=np.int16)
        self.keep2 = np.zeros((N_MASKS, N, N_HANDS), dtype=np.int16)
        eps = 1e-9 / MAX_SCORE
        rows = np.arange(N_HANDS)[:, None]
        for m in _MASKS_BY_FILL:
            if m == FULL_MASK:
                continue
            opens = np.nonzero(OPEN[m])[0]
            pts = SCORES[:, opens]                                            # (126, o)
            nxt = np.minimum(s[None, :, None] + pts[:, None, :], cap)         # (126, N, o)
            cand = self.W[m | (1 << opens)][np.arange(len(opens))[None, None, :], nxt]
            tieb = (pts + ev.V[m | (1 << opens)])[:, None, :] * eps
            best = (cand + tieb).argmax(2)
            self.cat[m] = opens[best].T
            E3 = np.take_along_axis(cand, best[..., None], 2)[..., 0]
            sub = (TRANSITION @ E3)[SUBKEEPS]
            b = (sub + (ev.K2[m][SUBKEEPS] * eps)[..., None]).argmax(1)
            self.keep2[m] = SUBKEEPS[rows, b].T
            E2 = np.take_along_axis(sub, b[:, None, :], 1)[:, 0, :]
            sub = (TRANSITION @ E2)[SUBKEEPS]
            b = (sub + (ev.K1[m][SUBKEEPS] * eps)[..., None]).argmax(1)
            self.keep1[m] = SUBKEEPS[rows, b].T
            E1 = np.take_along_axis(sub, b[:, None, :], 1)[:, 0, :]
            self.W[m] = FIRST_ROLL @ E1
        self.solve_seconds = time.time() - t0

    @property
    def expected_prize(self) -> float:
        return float(self.W[0, 0])

    def policy(self, name: str = 'Most Moonberries') -> 'PrizePolicy':
        return PrizePolicy(self, name)


class PrizePolicy:
    def __init__(self, solver: PrizeSolver, name: str):
        self.s, self.name = solver, name

    def _s(self, score):
        return np.minimum(np.asarray(score), self.s.cap)

    def keep(self, mask, score, rolls_left, hand, rng=None):
        tab = self.s.keep1 if rolls_left == 2 else self.s.keep2
        return tab[mask, self._s(score), hand].astype(np.int64)

    def choose(self, mask, score, hand, rng=None):
        return self.s.cat[mask, self._s(score), hand].astype(np.int64)


def score_distribution(policy_cat, policy_keep1, policy_keep2) -> np.ndarray:
    """Exact final-score distribution for a policy that depends only on (mask, hand).

    Returns p[s] = P(final score == s), s = 0..237.
    """
    dist = np.zeros((N_MASKS, MAX_SCORE + 1))
    dist[0, 0] = 1.0
    for m in sorted(range(N_MASKS), key=lambda x: POPCOUNT[x]):
        if m == FULL_MASK or not dist[m].any():
            continue
        d = FIRST_ROLL
        d = d @ TRANSITION[policy_keep1[m]]
        d = d @ TRANSITION[policy_keep2[m]]
        for h in np.nonzero(d)[0]:
            c = policy_cat[m, h]
            pts = SCORES[h, c]
            dist[m | (1 << c), pts:] += d[h] * dist[m, :MAX_SCORE + 1 - pts]
    return dist[FULL_MASK]


if __name__ == '__main__':
    ev = ExpectedScoreSolver()
    print(f'Optimal expected score: {ev.expected_score:.4f}  (solved in {ev.solve_seconds:.2f}s)')
    p = score_distribution(ev.cat, ev.keep1, ev.keep2)
    s = np.arange(MAX_SCORE + 1)
    print(f'  exact mean from distribution: {(p * s).sum():.4f}, sd {np.sqrt((p * s**2).sum() - ((p*s).sum())**2):.2f}')
    for t in (121, 141):
        print(f'  EV-optimal P(score >= {t}) = {p[t:].sum():.4f}')
    th = ThresholdSolver(ev)
    print(f'Threshold solver ready ({th.solve_seconds:.1f}s)')
    for t in (100, 121, 141, 160):
        print(f'  best possible P(score >= {t}) = {th.prob(t):.4f}')
