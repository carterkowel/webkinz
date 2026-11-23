"""Deep Q-Network (Double DQN with action masking) for Jumbleberry Fields.

Instead of a giant table, a small neural network maps a 28-number description of the
board (open boxes, rolls used, berry counts, points each open box would give now, ...)
to a Q-value for each of the 41 actions.  Illegal actions are masked out.  The network
generalises between similar situations, which is how this approach scales to games far
too big for a table.

    python rl_dqn.py --minutes 30
"""
from __future__ import annotations

import argparse
import json
import os
import time

# Must be set before torch loads: otherwise torch's idle threads spin and slow numpy 5-10x.
os.environ.setdefault('OMP_WAIT_POLICY', 'PASSIVE')

import numpy as np
import torch
import torch.nn as nn

from rl_env import N_ACTIONS, OBS_DIM, BatchEnv, evaluate

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, 'models')
REWARD_SCALE = 0.1   # keep Q-values ~O(10) for stable training


class QNet(nn.Module):
    def __init__(self, hidden: int = 128):
        super().__init__()
        self.body = nn.Sequential(
            nn.Linear(OBS_DIM, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden), nn.ReLU(),
            nn.Linear(hidden, N_ACTIONS))

    def forward(self, x):
        return self.body(x)


class Replay:
    def __init__(self, size: int):
        self.size, self.i, self.full = size, 0, False
        self.o = np.zeros((size, OBS_DIM), np.float32)
        self.o2 = np.zeros((size, OBS_DIM), np.float32)
        self.a = np.zeros(size, np.int64)
        self.r = np.zeros(size, np.float32)
        self.d = np.zeros(size, np.float32)
        self.v2 = np.zeros((size, N_ACTIONS), bool)

    def add(self, o, a, r, o2, v2, d):
        n = len(a)
        idx = (self.i + np.arange(n)) % self.size
        self.o[idx], self.a[idx], self.r[idx], self.o2[idx], self.v2[idx], self.d[idx] = o, a, r, o2, v2, d
        self.full |= self.i + n >= self.size
        self.i = (self.i + n) % self.size

    def sample(self, n, rng):
        idx = rng.integers(0, self.size if self.full else self.i, n)
        t = torch.from_numpy
        return (t(self.o[idx]), t(self.a[idx]), t(self.r[idx]), t(self.o2[idx]),
                t(self.v2[idx]), t(self.d[idx]))


class DQNAgent:
    def __init__(self, hidden=128, lr=3e-4, seed=0):
        torch.manual_seed(seed)
        self.net, self.target = QNet(hidden), QNet(hidden)
        self.target.load_state_dict(self.net.state_dict())
        self.opt = torch.optim.Adam(self.net.parameters(), lr=lr)
        self.rng = np.random.default_rng(seed)

    @torch.no_grad()
    def q_values(self, env: BatchEnv) -> np.ndarray:
        q = self.net(torch.from_numpy(env.features())).numpy()
        return np.where(env.valid_actions(), q, -np.inf)

    def greedy(self, env: BatchEnv) -> np.ndarray:
        return self.q_values(env).argmax(1)

    def act(self, env: BatchEnv, eps: float) -> np.ndarray:
        a = self.greedy(env)
        explore = self.rng.random(env.n) < eps
        if explore.any():
            valid = env.valid_actions()[explore]
            a[explore] = np.where(valid, self.rng.random(valid.shape), -1).argmax(1)
        return a

    def learn(self, batch):
        o, a, r, o2, v2, d = batch
        with torch.no_grad():                                   # Double DQN target
            q_online = self.net(o2).masked_fill(~v2, -1e9)
            a2 = q_online.argmax(1, keepdim=True)
            q_next = self.target(o2).gather(1, a2).squeeze(1)
            y = r + (1 - d) * q_next
        q = self.net(o).gather(1, a.unsqueeze(1)).squeeze(1)
        loss = nn.functional.smooth_l1_loss(q, y)
        self.opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(self.net.parameters(), 10.0)
        self.opt.step()
        return loss.item()

    def save(self, path):
        torch.save(self.net.state_dict(), path)

    @classmethod
    def load(cls, path, hidden=128):
        a = cls(hidden)
        a.net.load_state_dict(torch.load(path))
        a.net.eval()
        return a


def train(minutes: float = 30, n_envs: int = 1024, batch: int = 512, updates_per_step: int = 1,
          buffer: int = 1_000_000, target_every: int = 2000, eps_start=1.0, eps_end=0.02,
          lr=3e-4, eval_every_s: float = 60, seed=0, solver=None):
    torch.set_num_threads(4)
    agent = DQNAgent(lr=lr, seed=seed)
    env = BatchEnv(n_envs, seed)
    rb = Replay(buffer)
    budget = minutes * 60
    t0, played, steps, updates = time.time(), 0, 0, 0
    curve, next_eval = [], 0.0
    while True:
        el = time.time() - t0
        frac = min(el / (0.7 * budget), 1.0)
        eps = eps_start * (eps_end / eps_start) ** frac
        o = env.features()
        a = agent.act(env, eps)
        r, done, _ = env.step(a)
        rb.add(o, a, r * REWARD_SCALE, env.features(), env.valid_actions(), done)
        played += int(done.sum())
        steps += 1
        if steps * n_envs > 20 * batch:
            for _ in range(updates_per_step):
                agent.learn(rb.sample(batch, agent.rng))
                updates += 1
                if updates % target_every == 0:
                    agent.target.load_state_dict(agent.net.state_dict())
            # anneal learning rate over the final 30% of training
            for g in agent.opt.param_groups:
                g['lr'] = lr * (1.0 if el < 0.7 * budget else max(0.1, 1 - (el - 0.7 * budget) / (0.3 * budget)))
        if el >= next_eval or el >= budget:
            res = evaluate(agent.greedy, 20_000, solver=solver)
            res.update(games_trained=played, epsilon=eps, seconds=el, updates=updates)
            curve.append(res)
            print(f"[DQN] {played:>10,} games | eps {eps:.3f} | greedy avg {res['mean']:6.2f} | "
                  f"P121 {res['P(>=121)']:.3f}" + (f" | regret {res['regret_per_game']:.2f}" if solver else '')
                  + f" | {el:5.0f}s", flush=True)
            next_eval += eval_every_s
            if el >= budget:
                break
    return agent, curve


if __name__ == '__main__':
    from solver import ExpectedScoreSolver
    ap = argparse.ArgumentParser()
    ap.add_argument('--minutes', type=float, default=30)
    ap.add_argument('--envs', type=int, default=1024)
    ap.add_argument('--batch', type=int, default=512)
    ap.add_argument('--updates-per-step', type=int, default=1)
    ap.add_argument('--lr', type=float, default=3e-4)
    ap.add_argument('--seed', type=int, default=0)
    args = ap.parse_args()
    sol = ExpectedScoreSolver()
    agent, curve = train(args.minutes, args.envs, args.batch, args.updates_per_step, lr=args.lr,
                         seed=args.seed, solver=sol)
    os.makedirs(MODELS, exist_ok=True)
    agent.save(os.path.join(MODELS, 'dqn.pt'))
    final = evaluate(agent.greedy, 200_000, solver=sol)
    with open(os.path.join(MODELS, 'dqn_curve.json'), 'w') as f:
        json.dump({'curve': curve, 'final': final, 'args': vars(args)}, f, indent=1)
    print('final:', final)
