"""Grade every decision of a logged game against perfect play.

Works on games recorded by agent_play.py (data/agent_games.jsonl).  For each decision it
reports the expected final points of the move that was made vs the best move, so a game
can be reviewed like a chess engine review ("this lock cost you 2.3 points on average").

    python review.py                       # summary of every logged game
    python review.py --player claude -v    # plus every costly decision
"""
from __future__ import annotations

import argparse
import json
import os

import numpy as np

from engine import CATEGORIES, CATEGORY_LABELS, SCORES, counts_from_names, hand_index, keep_index, mask_from_used
from solver import ExpectedScoreSolver

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, 'data', 'agent_games.jsonl')


def load_games(path: str = LOG, player: str | None = None) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path) as f:
        games = [json.loads(line) for line in f if line.strip()]
    return [g for g in games if player is None or g['player'] == player]


def grade_decision(d: dict, ev: ExpectedScoreSolver) -> dict:
    mask = mask_from_used(d['mask_used'])
    h = hand_index(counts_from_names(d['jars']))
    roll = d['roll']
    best = (ev.E1, ev.E2, ev.E3)[roll - 1][mask, h]
    if d['action'] == 'keep':
        k = keep_index(counts_from_names(d['kept']))
        got = (ev.K1 if roll == 1 else ev.K2)[mask, k]
        move = 'lock ' + (' '.join(d['kept']) if d['kept'] else 'nothing')
    else:
        c = CATEGORIES.index(d['box'])
        got = SCORES[h, c] + ev.V[mask | (1 << c)]
        move = f"score {SCORES[h, c]} in {CATEGORY_LABELS[c]}"
    return {**d, 'move': move, 'expected_after': float(got), 'expected_best': float(best),
            'regret': max(float(best - got), 0.0)}


def grade_game(game: dict, ev: ExpectedScoreSolver | None = None) -> list[dict]:
    ev = ev or ExpectedScoreSolver()
    return [grade_decision(d, ev) for d in game['decisions']]


def best_move_text(d: dict) -> str:
    from advisor import rank_options
    return rank_options(d['jars'], d['roll'], d['mask_used'])[0][1]


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--player')
    ap.add_argument('-v', '--verbose', action='store_true')
    a = ap.parse_args()
    ev = ExpectedScoreSolver()
    for i, g in enumerate(load_games(player=a.player)):
        graded = grade_game(g, ev)
        lost = sum(x['regret'] for x in graded)
        bad = [x for x in graded if x['regret'] > 0.05]
        print(f"game {i + 1} ({g['player']}): score {g['score']:>3} | {len(graded)} decisions, "
              f"{len(bad)} sub-optimal, {lost:.2f} expected points given away")
        if a.verbose:
            for x in sorted(bad, key=lambda x: -x['regret']):
                print(f"   round {x['round']} roll {x['roll']}: jars {' '.join(x['jars'])}\n"
                      f"      you: {x['move']:<45} best: {best_move_text(x):<45} cost {x['regret']:.2f}")
