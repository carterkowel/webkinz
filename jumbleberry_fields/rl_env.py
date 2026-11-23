"""Reinforcement-learning environments for Jumbleberry Fields.

Unlike the earlier WIP gym env (which only chose a box for a single roll), these model the
full game: up to 3 rolls per round, locking any jars in between, and 9 rounds.

Action space (41 discrete actions)
    0-31  lock jars and re-roll the rest.  Bit j of the action = keep jar j, where the jars
          are the current berries sorted J,S,P,M,F.  Only one action per distinct multiset is
          valid (no duplicate "keep the first vs second Jumbleberry"), and 31 (keep all) is
          invalid because that is the same as scoring now.
    32-40 write the current hand in box (action - 32).

``BatchEnv`` runs thousands of games in lock-step with numpy (fast training).
``JumbleberryEnv`` is a standard single-game gymnasium.Env wrapper around it.
"""
from __future__ import annotations

import numpy as np

from engine import (EMPTY_KEEP, HANDS, MAX_SCORE, N_CATS, N_HANDS, OPEN, POPCOUNT, SCORES,
                    SORTED_JARS, keep_from_jar_mask, roll)

N_KEEP_ACTIONS = 32
N_ACTIONS = N_KEEP_ACTIONS + N_CATS

# KEEP_OF_ACTION[hand, a] -> keep index ; VALID_KEEP[hand, a] -> canonical & not keep-all
KEEP_OF_ACTION = keep_from_jar_mask(np.repeat(np.arange(N_HANDS), 32), np.tile(np.arange(32), N_HANDS)
                                    ).reshape(N_HANDS, 32)
VALID_KEEP = np.zeros((N_HANDS, 32), dtype=bool)
for _h in range(N_HANDS):
    _seen = set()
    for _a in range(31):
        _k = int(KEEP_OF_ACTION[_h, _a])
        if _k not in _seen:
            _seen.add(_k)
            VALID_KEEP[_h, _a] = True

N_STATES = 512 * 3 * N_HANDS          # tabular state: (mask, rolls used - 1, hand)
OBS_DIM = 9 + 3 + 5 + 9 + 2


class BatchEnv:
    """``n`` independent games stepped together.  Finished games auto-reset.

    reward_mode='points'      reward = points written each round (maximise average score)
    reward_mode='threshold'   reward = 1 at game end if total >= target, else 0
    """

    def __init__(self, n: int, seed: int = 0, reward_mode: str = 'points', target: int = 121):
        self.n, self.reward_mode, self.target = n, reward_mode, target
        self.rng = np.random.default_rng(seed)
        self.mask = np.zeros(n, dtype=np.int64)
        self.rolls = np.ones(n, dtype=np.int64)    # rolls used this round (1-3)
        self.score = np.zeros(n, dtype=np.int64)
        self.hand = roll(np.full(n, EMPTY_KEEP), self.rng)

    # ------------------------------------------------------------------ observations
    def valid_actions(self) -> np.ndarray:
        v = np.zeros((self.n, N_ACTIONS), dtype=bool)
        can_roll = self.rolls < 3
        v[:, :32] = VALID_KEEP[self.hand] & can_roll[:, None]
        v[:, 32:] = OPEN[self.mask]
        return v

    def state_index(self) -> np.ndarray:
        return (self.mask * 3 + (self.rolls - 1)) * N_HANDS + self.hand

    def features(self) -> np.ndarray:
        n = self.n
        f = np.zeros((n, OBS_DIM), dtype=np.float32)
        open_ = OPEN[self.mask]
        f[:, 0:9] = open_
        f[np.arange(n), 9 + self.rolls - 1] = 1
        f[:, 12:17] = HANDS[self.hand] / 5.0
        f[:, 17:26] = SCORES[self.hand] * open_ / 35.0
        f[:, 26] = POPCOUNT[self.mask] / 9.0
        f[:, 27] = self.score / MAX_SCORE
        return f

    # ------------------------------------------------------------------ dynamics
    def step(self, actions: np.ndarray):
        """Returns (reward, done, final_scores) where final_scores is -1 for unfinished games."""
        actions = np.asarray(actions)
        n = self.n
        reward = np.zeros(n, dtype=np.float32)
        done = np.zeros(n, dtype=bool)
        final = np.full(n, -1, dtype=np.int64)

        is_keep = actions < 32
        if is_keep.any():
            i = np.nonzero(is_keep)[0]
            k = KEEP_OF_ACTION[self.hand[i], actions[i]]
            self.hand[i] = roll(k, self.rng)
            self.rolls[i] += 1

        i = np.nonzero(~is_keep)[0]
        if len(i):
            c = actions[i] - 32
            pts = SCORES[self.hand[i], c]
            self.score[i] += pts
            self.mask[i] |= 1 << c
            fin = self.mask[i] == 511
            if self.reward_mode == 'points':
                reward[i] = pts
            else:
                reward[i] = (fin & (self.score[i] >= self.target)).astype(np.float32)
            d = i[fin]
            done[d] = True
            final[d] = self.score[d]
            self.mask[d] = 0
            self.score[d] = 0
            self.rolls[i] = 1
            self.hand[i] = roll(np.full(len(i), EMPTY_KEEP), self.rng)
        return reward, done, final


def evaluate(policy_fn, n_games: int = 20_000, seed: int = 12345, n_envs: int = 5_000, solver=None):
    """Play ``n_games`` greedily with ``policy_fn(env) -> actions`` and report score stats.

    If an ``ExpectedScoreSolver`` is given, also reports *regret*: the expected points the
    policy gives away per game compared with perfect play (0 = optimal decisions).
    """
    # Every parallel slot plays exactly `quota` games (taking "the first n games to finish"
    # would bias the sample toward games that stopped rolling early).
    n_envs = min(n_envs, n_games)
    quota = -(-n_games // n_envs)
    env = BatchEnv(n_envs, seed)
    played = np.zeros(n_envs, dtype=np.int64)
    finals, regret, decisions, mistakes = [], 0.0, 0, 0
    while (played < quota).any():
        a = np.asarray(policy_fn(env))
        if solver is not None:
            live = played < quota
            loss = action_regret(solver, env.mask, env.rolls, env.hand, a)[live]
            regret += loss.sum()
            decisions += len(loss)
            mistakes += (loss > 1e-6).sum()
        _, done, final = env.step(a)
        keep = done & (played < quota)
        finals.extend(final[keep].tolist())
        played += done
    f = np.array(finals)
    out = {'games': len(f), 'mean': float(f.mean()), 'sd': float(f.std()),
           'P(>=121)': float((f >= 121).mean()), 'P(>=141)': float((f >= 141).mean())}
    if solver is not None:
        out['regret_per_game'] = regret / len(finals)
        out['optimal_decision_rate'] = 1 - mistakes / decisions
    return out


def action_regret(solver, mask, rolls_used, hand, actions):
    """Expected points lost by each action vs the optimal action (ExpectedScoreSolver tables)."""
    mask, rolls_used, hand, actions = map(np.asarray, (mask, rolls_used, hand, actions))
    best = np.select([rolls_used == 1, rolls_used == 2],
                     [solver.E1[mask, hand], solver.E2[mask, hand]], solver.E3[mask, hand])
    value = np.zeros(len(actions))
    keep = actions < 32
    k = KEEP_OF_ACTION[hand, np.minimum(actions, 31)]
    value[keep & (rolls_used == 1)] = solver.K1[mask, k][keep & (rolls_used == 1)]
    value[keep & (rolls_used == 2)] = solver.K2[mask, k][keep & (rolls_used == 2)]
    c = np.maximum(actions - 32, 0)
    sc = SCORES[hand, c] + solver.V[mask | (1 << c)]
    value[~keep] = sc[~keep]
    return np.maximum(best - value, 0.0)


try:
    import gymnasium as gym
    from gymnasium import spaces

    class JumbleberryEnv(gym.Env):
        """Single-game gymnasium environment.  ``info['action_mask']`` lists legal actions."""
        metadata = {'render_modes': ['ansi']}

        def __init__(self, reward_mode='points', target=121):
            self.reward_mode, self.target = reward_mode, target
            self.observation_space = spaces.Box(0, 1, (OBS_DIM,), np.float32)
            self.action_space = spaces.Discrete(N_ACTIONS)
            self._env = None

        def reset(self, *, seed=None, options=None):
            super().reset(seed=seed)
            self._env = BatchEnv(1, int(self.np_random.integers(2**31)), self.reward_mode, self.target)
            return self._env.features()[0], {'action_mask': self._env.valid_actions()[0]}

        def step(self, action):
            if not self._env.valid_actions()[0, action]:
                raise ValueError(f'Illegal action {action}')
            r, done, final = self._env.step(np.array([action]))
            info = {'action_mask': self._env.valid_actions()[0]}
            if done[0]:
                info['final_score'] = int(final[0])
            return self._env.features()[0], float(r[0]), bool(done[0]), False, info

        def render(self):
            e = self._env
            from engine import BERRIES, CATEGORIES
            jars = [BERRIES[t] for t in SORTED_JARS[e.hand[0]]]
            used = [c for i, c in enumerate(CATEGORIES) if (e.mask[0] >> i) & 1]
            return f'roll {e.rolls[0]}/3 jars={jars} used={used} score={e.score[0]}'
except ImportError:  # gymnasium is optional
    pass
