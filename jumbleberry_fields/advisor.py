"""Jumbleberry Fields advisor: tell it your board, it tells you the optimal move.

Interactive:
    python advisor.py

One-shot:
    python advisor.py --berries "M M P J F" --roll 1 --used "Jumbleberry,Basket5" --score 14
    python advisor.py --berries "M M P J F" --roll 2 --goal 121 --used "..." --score 60

Berries can be full names or letters: J=Jumbleberry S=Sugarberry P=Pickleberry M=Moonberry F=Fly.
--roll is which roll you are looking at (1, 2 or 3).
--goal is 'avg' (maximise average score, default) or a target score such as 121 or 141.
"""
from __future__ import annotations

import argparse

import numpy as np

from engine import (BERRIES, CATEGORIES, CATEGORY_LABELS, KEEPS, MAX_SCORE, OPEN, SCORES,
                    SUBKEEPS, counts_from_names, hand_index, mask_from_used, names_from_counts)
from solver import ExpectedScoreSolver, ThresholdSolver

_EV = None
_TH = None


def _solvers(goal):
    global _EV, _TH
    if _EV is None:
        _EV = ExpectedScoreSolver()
    if goal != 'avg' and _TH is None:
        _TH = ThresholdSolver(_EV)
    return _EV, _TH


def rank_options(berries, roll: int, used=(), score: int = 0, goal='avg'):
    """Return a list of (value, description, kind) best-first for the given position."""
    ev, th = _solvers(goal)
    mask = mask_from_used(used)
    if mask == 511:
        raise ValueError('All boxes are already used - the game is over.')
    hand_counts = counts_from_names(berries) if not isinstance(berries, np.ndarray) else berries
    if hand_counts.sum() != 5:
        raise ValueError('Enter exactly 5 berries.')
    h = hand_index(hand_counts)
    opts = []
    if goal == 'avg':
        for c in np.nonzero(OPEN[mask])[0]:
            opts.append((SCORES[h, c] + ev.V[mask | (1 << c)],
                         f'Score {SCORES[h, c]} in {CATEGORY_LABELS[c]}', 'score'))
        K = {1: ev.K1[mask], 2: ev.K2[mask]}.get(roll)
    else:
        need = int(np.clip(int(goal) - score, 0, MAX_SCORE))
        for c in np.nonzero(OPEN[mask])[0]:
            opts.append((th.W[mask | (1 << c), max(need - SCORES[h, c], 0)],
                         f'Score {SCORES[h, c]} in {CATEGORY_LABELS[c]}', 'score'))
        E3, K2, E2, K1 = th.stage_values(mask, need)
        K = {1: K1, 2: K2}.get(roll)
    if K is not None:
        for k in sorted(set(SUBKEEPS[h].tolist())):
            kc = KEEPS[k]
            if kc.sum() == 5:
                continue                     # keeping everything == scoring now
            kept = names_from_counts(kc)
            desc = (f"Lock {', '.join(kept)} and re-roll {5 - len(kept)}" if kept
                    else 'Re-roll all 5 jars')
            opts.append((K[k], desc, 'keep'))
    opts.sort(key=lambda o: -o[0])
    return opts


def _fmt(v, goal, base=None):
    if goal == 'avg':
        return f'expected final total +{v:6.2f}' if base is None else f'{v:6.2f}'
    return f'{100 * v:5.1f}% chance to reach {goal}'


def advise(berries, roll, used=(), score=0, goal='avg', top=5) -> str:
    opts = rank_options(berries, roll, used, score, goal)
    best = opts[0]
    lines = [f'BEST MOVE: {best[1]}']
    if goal == 'avg':
        lines.append(f'  (expected points from here to the end of the game: {best[0]:.2f})')
        for v, d, _ in opts[1:top]:
            lines.append(f'  - {d:<55} costs {best[0] - v:5.2f} pts on average')
    else:
        lines.append(f'  ({100 * best[0]:.1f}% chance to finish with {goal}+)')
        for v, d, _ in opts[1:top]:
            lines.append(f'  - {d:<55} {100 * v:5.1f}%')
    return '\n'.join(lines)


def _interactive():
    print('Jumbleberry Fields advisor  (Ctrl+C to quit)')
    print('Berries: J=Jumbleberry S=Sugarberry P=Pickleberry M=Moonberry F=Fly\n')
    goal = input("Goal: 'avg' for best average, or a target like 121 / 141 [avg]: ").strip() or 'avg'
    while True:
        used = input('Boxes already used (comma separated, blank if none): ').strip()
        used = [u.strip() for u in used.split(',') if u.strip()]
        used = [CATEGORIES[[l.lower() for l in CATEGORY_LABELS].index(u.lower())]
                if u.lower() in [l.lower() for l in CATEGORY_LABELS] else u for u in used]
        score = int(input('Current score [0]: ').strip() or 0) if goal != 'avg' else 0
        roll = int(input('Which roll is this (1/2/3)? ').strip())
        berries = input('Your 5 berries (e.g. M M P J F): ').replace(',', ' ').split()
        try:
            print('\n' + advise(berries, roll, used, score, goal) + '\n')
        except ValueError as e:
            print(f'  ! {e}\n')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--berries')
    ap.add_argument('--roll', type=int, default=1)
    ap.add_argument('--used', default='')
    ap.add_argument('--score', type=int, default=0)
    ap.add_argument('--goal', default='avg')
    a = ap.parse_args()
    if a.berries:
        used = [u.strip() for u in a.used.split(',') if u.strip()]
        print(advise(a.berries.replace(',', ' ').split(), a.roll, used, a.score, a.goal))
    else:
        _interactive()
