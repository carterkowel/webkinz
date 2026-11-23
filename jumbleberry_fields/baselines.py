"""Simulate every strategy in strategies.py and cache the results for the notebook.

    python baselines.py              # 200k games per strategy -> data/strategy_sims.npz
"""
from __future__ import annotations

import argparse
import os
import time

import numpy as np

from solver import ExpectedScoreSolver, ThresholdSolver
from strategies import Results, all_strategies, simulate

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'data', 'strategy_sims.npz')


def run(n_games: int = 200_000, seed: int = 7, verbose: bool = True) -> dict[str, Results]:
    ev = ExpectedScoreSolver()
    th = ThresholdSolver(ev)
    out = {}
    for s in all_strategies(ev, th):
        t0 = time.time()
        r = simulate(s, n_games, seed=seed, solver=ev)
        out[r.name] = r
        if verbose:
            d = r.summary()
            print(f"{r.name:<38} mean {d['mean']:6.2f}  P121 {d['P(>=121)']:.3f}  "
                  f"P141 {d['P(>=141)']:.3f}  lost/game {d['pts lost/game']:5.2f}  "
                  f"({time.time() - t0:.0f}s)", flush=True)
    save(out)
    return out


def save(results: dict[str, Results], path: str = CACHE):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    names = list(results)
    np.savez_compressed(
        path, names=np.array(names),
        cat_scores=np.stack([results[n].cat_scores.astype(np.int8) for n in names]),
        fill_round=np.stack([results[n].fill_round.astype(np.int8) for n in names]),
        rolls_used=np.stack([results[n].rolls_used.astype(np.int8) for n in names]),
        regret=np.stack([results[n].regret.astype(np.float32) for n in names]))


def load(path: str = CACHE) -> dict[str, Results]:
    d = np.load(path)
    return {str(n): Results(str(n), d['cat_scores'][i].astype(np.int64),
                            d['fill_round'][i].astype(np.int64),
                            d['rolls_used'][i].astype(np.int64), d['regret'][i].astype(float))
            for i, n in enumerate(d['names'])}


def load_or_run(n_games: int = 200_000) -> dict[str, Results]:
    return load() if os.path.exists(CACHE) else run(n_games)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--games', type=int, default=200_000)
    run(ap.parse_args().games)
