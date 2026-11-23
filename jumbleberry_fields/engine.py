"""Fast, vectorised core of Jumbleberry Fields.

Used by the exact solver, the strategy simulations and the RL environment.
The interactive CLI game (game.py / berries.py / player.py) is separate and unchanged.

Representation
--------------
Jar order never matters for scoring, so a hand of 5 jars is stored as *counts*
per berry type in the fixed order

    (Jumbleberry, Sugarberry, Pickleberry, Moonberry, Fly)

e.g. (2, 0, 1, 1, 1) = two Jumbleberries, a Pickleberry, a Moonberry and a Fly.
There are only 126 distinct hands.

A *keep* is the multiset of berries you lock before re-rolling: 252 possibilities
(0 to 5 berries). Keeping all 5 is the same as stopping early and scoring now.

A *mask* is a 9-bit integer of the scorecard boxes already used (bit i = CATEGORIES[i]).
"""
from __future__ import annotations

import itertools
from math import factorial

import numpy as np

# --------------------------------------------------------------------------- rules
BERRIES = ('Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry', 'Fly')
BERRY_SHORT = ('J', 'S', 'P', 'M', 'F')
VALUES = np.array([2, 2, 4, 7, 0])
# Each jar is a 10-sided die: 3 Jumble, 3 Sugar, 2 Pickle, 1 Moon, 1 Fly (pest).
PROBS = np.array([0.3, 0.3, 0.2, 0.1, 0.1])

CATEGORIES = ('Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry',
              'Basket3', 'Basket4', 'Basket5', 'MixedBasket', 'FreeRoll')
CATEGORY_LABELS = ('Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry',
                   'Basket of 3', 'Basket of 4', 'Basket of 5', 'Mixed Basket', 'Free Roll')
N_CATS = len(CATEGORIES)
N_JARS = 5
N_MASKS = 1 << N_CATS
FULL_MASK = N_MASKS - 1
MAX_SCORE = 237  # 10 + 10 + 20 + 35 + 35 + 35 + 35 + 22 + 35

# Prize thresholds (webkinzguide.com): 121 -> 1 Moonberry prize, 141 -> 2 Moonberries.
# 140 also earns the "Berry Farmer" badge.
PRIZE_THRESHOLDS = {121: '1 Moonberry', 141: '2 Moonberries'}


# --------------------------------------------------------------------------- enumeration
def _multisets(total: int) -> list[tuple[int, ...]]:
    return [c for c in itertools.product(range(total + 1), repeat=5) if sum(c) == total]


HANDS = np.array(_multisets(N_JARS), dtype=np.int64)                         # (126, 5)
KEEPS = np.array([c for n in range(N_JARS + 1) for c in _multisets(n)],
                 dtype=np.int64)                                             # (252, 5)
N_HANDS, N_KEEPS = len(HANDS), len(KEEPS)


def _code(counts: np.ndarray) -> np.ndarray:
    counts = np.asarray(counts)
    return counts @ np.array([1296, 216, 36, 6, 1])


HAND_INDEX = np.full(6 ** 5, -1, dtype=np.int64)
HAND_INDEX[_code(HANDS)] = np.arange(N_HANDS)
KEEP_INDEX = np.full(6 ** 5, -1, dtype=np.int64)
KEEP_INDEX[_code(KEEPS)] = np.arange(N_KEEPS)

EMPTY_KEEP = int(KEEP_INDEX[0])
HAND_TO_KEEP = KEEP_INDEX[_code(HANDS)]          # keeping the whole hand == stop and score


# --------------------------------------------------------------------------- scoring
def _score_counts(c: np.ndarray) -> np.ndarray:
    """Score of every category for a single count vector (length 5)."""
    total = int(c @ VALUES)
    biggest = int(c.max())  # flies count toward baskets of 3/4 (they just score 0)
    return np.array([
        2 * c[0], 2 * c[1], 4 * c[2], 7 * c[3],
        total if biggest >= 3 else 0,
        total if biggest >= 4 else 0,
        total if biggest >= 5 else 0,
        total if (c[:4] >= 1).all() else 0,
        total,
    ], dtype=np.int64)


SCORES = np.stack([_score_counts(h) for h in HANDS])                         # (126, 9)
HAND_TOTAL = HANDS @ VALUES


# --------------------------------------------------------------------------- dynamics
def _multinomial_prob(d: np.ndarray) -> float:
    n = int(d.sum())
    coef = factorial(n)
    for x in d:
        coef //= factorial(int(x))
    return coef * float(np.prod(PROBS ** d))


# TRANSITION[k, h] = P(final hand h | keep k, re-roll the other 5-|k| jars)
TRANSITION = np.zeros((N_KEEPS, N_HANDS))
for _ki, _k in enumerate(KEEPS):
    for _hi, _h in enumerate(HANDS):
        _d = _h - _k
        if (_d >= 0).all():
            TRANSITION[_ki, _hi] = _multinomial_prob(_d)
assert np.allclose(TRANSITION.sum(1), 1.0)
FIRST_ROLL = TRANSITION[EMPTY_KEEP]

# SUBKEEPS[h] = indices of every keep you could make from hand h (padded by repetition)
_subs = []
for _h in HANDS:
    _ks = [int(KEEP_INDEX[_code(np.array(k))])
           for k in itertools.product(*(range(int(x) + 1) for x in _h))]
    _subs.append(_ks)
MAX_SUB = max(len(s) for s in _subs)
SUBKEEPS = np.array([s + [s[0]] * (MAX_SUB - len(s)) for s in _subs], dtype=np.int64)
N_SUBKEEPS = np.array([len(s) for s in _subs])

_CDF = np.cumsum(TRANSITION, axis=1)
_LAST_VALID = np.array([np.nonzero(row)[0].max() for row in TRANSITION])

# popcount helpers
POPCOUNT = np.array([bin(m).count('1') for m in range(N_MASKS)])
OPEN = np.array([[not (m >> c) & 1 for c in range(N_CATS)] for m in range(N_MASKS)])  # (512, 9)


# --------------------------------------------------------------------------- helpers
def hand_index(counts) -> int:
    return int(HAND_INDEX[_code(np.asarray(counts))])


def keep_index(counts) -> int:
    return int(KEEP_INDEX[_code(np.asarray(counts))])


def counts_from_names(names) -> np.ndarray:
    """['Moonberry', 'Fly', ...] or ['M', 'F', ...] -> count vector."""
    c = np.zeros(5, dtype=np.int64)
    for n in names:
        key = n.strip()
        if key in BERRIES:
            c[BERRIES.index(key)] += 1
        elif key.upper() in BERRY_SHORT:
            c[BERRY_SHORT.index(key.upper())] += 1
        elif key.lower() == 'pest':
            c[4] += 1
        else:
            raise ValueError(f'Unknown berry: {n!r}')
    return c


def names_from_counts(counts, short: bool = False) -> list[str]:
    labels = BERRY_SHORT if short else BERRIES
    return [labels[i] for i, n in enumerate(counts) for _ in range(int(n))]


def mask_from_used(used) -> int:
    m = 0
    for c in used:
        m |= 1 << (c if isinstance(c, (int, np.integer)) else CATEGORIES.index(c))
    return m


def roll(keep_idx: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Vectorised re-roll: for each keep index, sample the resulting hand index."""
    keep_idx = np.asarray(keep_idx)
    u = rng.random(keep_idx.shape)
    h = (u[..., None] > _CDF[keep_idx]).sum(-1)
    return np.minimum(h, _LAST_VALID[keep_idx])


def keep_from_jar_mask(hand_idx: np.ndarray, jar_mask: np.ndarray) -> np.ndarray:
    """Jars are the hand's berries sorted by type (J,S,P,M,F). Bit j of jar_mask = keep jar j."""
    jars = SORTED_JARS[hand_idx]                                         # (..., 5)
    bits = (np.asarray(jar_mask)[..., None] >> np.arange(5)) & 1
    kept = np.stack([((jars == t) & (bits == 1)).sum(-1) for t in range(5)], -1)
    return KEEP_INDEX[_code(kept)]


SORTED_JARS = np.array([[t for t in range(5) for _ in range(int(h[t]))] for h in HANDS])  # (126, 5)
