"""Tabular Q-learning for Jumbleberry Fields.

The whole game state fits in a table: (boxes used: 512) x (rolls used: 3) x (hand: 126)
= 193,536 states, each with up to 41 actions.  Q-learning learns Q[state, action] purely
from experience (it is never told the berry probabilities), using the classic update

    Q[s, a] += alpha * (reward + max_a' Q[s', a'] - Q[s, a])

Thousands of games run in parallel (BatchEnv) so millions of games train in minutes.

    python rl_qlearning.py --games 20000000
"""
from __future__ import annotations

import argparse
import json
import os
import time

import numpy as np

from rl_env import N_ACTIONS, N_STATES, BatchEnv, evaluate

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, 'models')


class QLearningAgent:
    def __init__(self, seed: int = 0):
        self.Q = np.zeros((N_STATES, N_ACTIONS), dtype=np.float32)
        self.N = np.zeros((N_STATES, N_ACTIONS), dtype=np.uint32)   # visit counts
        self.rng = np.random.default_rng(seed)

    def greedy(self, env: BatchEnv) -> np.ndarray:
        q = np.where(env.valid_actions(), self.Q[env.state_index()], -np.inf)
        return q.argmax(1)

    def act(self, env: BatchEnv, eps: float) -> np.ndarray:
        valid = env.valid_actions()
        q = np.where(valid, self.Q[env.state_index()], -np.inf)
        a = q.argmax(1)
        explore = self.rng.random(env.n) < eps
        if explore.any():
            r = np.where(valid[explore], self.rng.random((explore.sum(), N_ACTIONS)), -1)
            a[explore] = r.argmax(1)
        return a

    def update(self, s, a, r, s2, valid2, done, alpha_min: float):
        self.N[s, a] += 1
        alpha = np.maximum(1.0 / self.N[s, a], alpha_min)     # sample-average, then constant
        nxt = np.where(valid2, self.Q[s2], -np.inf).max(1)
        target = r + np.where(done, 0.0, nxt)
        self.Q[s, a] += alpha * (target - self.Q[s, a])

    def save(self, path):
        np.savez_compressed(path, Q=self.Q)

    @classmethod
    def load(cls, path):
        a = cls()
        a.Q = np.load(path)['Q']
        return a


def train(games: int, n_envs: int = 4096, eps_start: float = 1.0, eps_end: float = 0.02,
          alpha_min: float = 0.01, eval_points: int = 25, seed: int = 0, solver=None):
    agent = QLearningAgent(seed)
    env = BatchEnv(n_envs, seed)
    curve, played, t0 = [], 0, time.time()
    next_eval = 0
    while played < games:
        frac = min(played / (0.8 * games), 1.0)
        eps = eps_start * (eps_end / eps_start) ** frac        # exponential decay
        s = env.state_index()
        a = agent.act(env, eps)
        r, done, _ = env.step(a)
        agent.update(s, a, r, env.state_index(), env.valid_actions(), done, alpha_min)
        played += int(done.sum())
        if played >= next_eval:
            res = evaluate(agent.greedy, 20_000, solver=solver)
            res.update(games_trained=played, epsilon=eps, seconds=time.time() - t0)
            curve.append(res)
            print(f"[Q] {played:>11,} games | eps {eps:.3f} | greedy avg {res['mean']:6.2f} | "
                  f"P121 {res['P(>=121)']:.3f}" + (f" | regret {res['regret_per_game']:.2f}" if solver else '')
                  + f" | {time.time() - t0:5.0f}s", flush=True)
            next_eval += games // eval_points
    return agent, curve


if __name__ == '__main__':
    from solver import ExpectedScoreSolver
    ap = argparse.ArgumentParser()
    ap.add_argument('--games', type=int, default=20_000_000)
    ap.add_argument('--envs', type=int, default=4096)
    ap.add_argument('--seed', type=int, default=0)
    args = ap.parse_args()
    agent, curve = train(args.games, args.envs, seed=args.seed, solver=ExpectedScoreSolver())
    os.makedirs(MODELS, exist_ok=True)
    agent.save(os.path.join(MODELS, 'q_learning.npz'))
    final = evaluate(agent.greedy, 200_000, solver=ExpectedScoreSolver())
    with open(os.path.join(MODELS, 'q_learning_curve.json'), 'w') as f:
        json.dump({'curve': curve, 'final': final, 'args': vars(args)}, f, indent=1)
    print('final:', final)
