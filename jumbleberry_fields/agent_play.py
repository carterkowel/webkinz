"""Turn-by-turn, non-interactive Jumbleberry Fields for agents (or scripts) to play.

Every call reads/writes the game state in a JSON file, so a game can be played one
command at a time:

    python agent_play.py new --player claude      # start a game (rolls the first hand)
    python agent_play.py keep 1 3 4               # lock jars 1, 3, 4 and re-roll the others
    python agent_play.py keep                     # lock nothing: re-roll all five jars
    python agent_play.py score Moonberry          # write the current hand in a box
    python agent_play.py status                   # show the board again

Several games can run side by side with --slot (each slot has its own save file):
    python agent_play.py --slot 3 new --player claude-opus-5.5

Finished games (with every decision) are appended to data/agent_games.jsonl so the
decisions can be compared with optimal play afterwards.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys

from engine import BERRIES, CATEGORIES, CATEGORY_LABELS, PROBS, SCORES, counts_from_names, hand_index

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
STATE = os.path.join(DATA, 'agent_current_game.json')
LOG = os.path.join(DATA, 'agent_games.jsonl')
SLOT = None
ALIASES = {c.lower(): c for c in CATEGORIES}
ALIASES.update({l.lower(): c for l, c in zip(CATEGORY_LABELS, CATEGORIES)})


def _roll_one(rng):
    return rng.choices(BERRIES, weights=PROBS)[0]


def _potentials(g):
    h = hand_index(counts_from_names(g['jars']))
    return {c: int(SCORES[h, i]) for i, c in enumerate(CATEGORIES) if g['scorecard'][c] is None}


def _show(g):
    used = sum(v is not None for v in g['scorecard'].values())
    lines = []
    if g['finished']:
        lines.append(f"GAME OVER - final score {g['score']}")
    else:
        lines.append(f"Round {g['round']} of 9 | roll {g['roll']} of 3 | "
                     f"re-rolls left: {3 - g['roll']} | score so far: {g['score']}")
        lines.append('Jars: ' + '  '.join(f"[{i + 1}] {b}" for i, b in enumerate(g['jars'])))
        pot = _potentials(g)
        lines.append('Open boxes (points if you score this hand there now):')
        for c, p in pot.items():
            lines.append(f'    {c:<12} {p:>3}')
    lines.append('Scorecard: ' + ', '.join(f"{c}={v}" for c, v in g['scorecard'].items()
                                           if v is not None) + (f' ({used}/9 used)' if used else '(empty)'))
    print('\n'.join(lines))


def _state_path():
    return STATE if SLOT is None else os.path.join(DATA, f'agent_current_game_{SLOT}.json')


def _load():
    STATE = _state_path()
    if not os.path.exists(STATE):
        sys.exit('No game in progress. Run: python agent_play.py new')
    with open(STATE) as f:
        return json.load(f)


def _save(g):
    os.makedirs(DATA, exist_ok=True)
    with open(_state_path(), 'w') as f:
        json.dump(g, f, indent=1)


def cmd_new(args):
    rng = random.Random()
    g = {'player': args.player, 'round': 1, 'roll': 1, 'score': 0, 'finished': False,
         'jars': [_roll_one(rng) for _ in range(5)],
         'scorecard': {c: None for c in CATEGORIES}, 'decisions': []}
    _save(g)
    _show(g)


def cmd_keep(args):
    g = _load()
    if g['finished']:
        sys.exit('Game is over. Start a new one with: python agent_play.py new')
    if g['roll'] >= 3:
        sys.exit('No re-rolls left this round - you must score: python agent_play.py score <Box>')
    jars = sorted(set(args.jars))
    if any(j < 1 or j > 5 for j in jars):
        sys.exit('Jar numbers must be 1-5.')
    rng = random.Random()
    g['decisions'].append({'round': g['round'], 'roll': g['roll'], 'mask_used':
                           [c for c, v in g['scorecard'].items() if v is not None],
                           'score_before': g['score'], 'jars': list(g['jars']),
                           'action': 'keep', 'kept': [g['jars'][j - 1] for j in jars]})
    g['jars'] = [b if (i + 1) in jars else _roll_one(rng) for i, b in enumerate(g['jars'])]
    g['roll'] += 1
    _save(g)
    _show(g)


def cmd_score(args):
    g = _load()
    if g['finished']:
        sys.exit('Game is over. Start a new one with: python agent_play.py new')
    box = ALIASES.get(' '.join(args.box).lower())
    if box is None:
        sys.exit(f"Unknown box. Choose one of: {', '.join(CATEGORIES)}")
    if g['scorecard'][box] is not None:
        sys.exit(f'{box} is already used.')
    pts = _potentials(g)[box]
    g['decisions'].append({'round': g['round'], 'roll': g['roll'], 'mask_used':
                           [c for c, v in g['scorecard'].items() if v is not None],
                           'score_before': g['score'], 'jars': list(g['jars']),
                           'action': 'score', 'box': box, 'points': pts})
    g['scorecard'][box] = pts
    g['score'] += pts
    if g['round'] == 9:
        g['finished'] = True
        os.makedirs(DATA, exist_ok=True)
        with open(LOG, 'a') as f:
            f.write(json.dumps({'player': g['player'], 'score': g['score'],
                                'scorecard': g['scorecard'], 'decisions': g['decisions']}) + '\n')
    else:
        rng = random.Random()
        g['round'] += 1
        g['roll'] = 1
        g['jars'] = [_roll_one(rng) for _ in range(5)]
    _save(g)
    print(f'Scored {pts} in {box}.')
    _show(g)


def main():
    global SLOT
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--slot', help='save slot, so several games can be played in parallel')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('new'); p.add_argument('--player', default='anonymous'); p.set_defaults(fn=cmd_new)
    p = sub.add_parser('keep'); p.add_argument('jars', nargs='*', type=int); p.set_defaults(fn=cmd_keep)
    p = sub.add_parser('score'); p.add_argument('box', nargs='+'); p.set_defaults(fn=cmd_score)
    p = sub.add_parser('status'); p.set_defaults(fn=lambda a: _show(_load()))
    args = ap.parse_args()
    SLOT = args.slot
    args.fn(args)


if __name__ == '__main__':
    main()
