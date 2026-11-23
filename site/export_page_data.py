"""Export the data the report page needs. Run from jumbleberry_fields/:
    python ../site/export_page_data.py ../site/page_data.json
    python ../site/build.py
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.getcwd())
from engine import CATEGORY_LABELS, FIRST_ROLL, HANDS, KEEPS, MAX_SCORE, names_from_counts
from solver import ExpectedScoreSolver, PrizeSolver, ThresholdSolver, score_distribution
from strategies import simulate
from strategies import TUNED_PAR
import baselines
from review import load_games, grade_game

ev = ExpectedScoreSolver(); th = ThresholdSolver(ev); sims = baselines.load()
s = np.arange(MAX_SCORE + 1)
p_opt = score_distribution(ev.cat, ev.keep1, ev.keep2)
r4 = lambda x: round(float(x), 4)

def pmf(t):
    return [r4(v) for v in np.bincount(t, minlength=MAX_SCORE + 1)[:MAX_SCORE + 1] / len(t)]

human = json.load(open('game_results.json'))
hk = ['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry', 'Basket of 3', 'Basket of 4', 'Basket of 5', 'Mixed Basket', 'Free Roll']
hb = np.array([[int(g[k]) for k in hk] for g in human]); ht = hb.sum(1)
CLAUDE_PLAYER = 'claude-opus-5.5'   # games played by Claude Opus 5.5 via agent_play.py
claude = load_games(player=CLAUDE_PLAYER)
c_tot = np.array([g['score'] for g in claude])
c_graded = [grade_game(g, ev) for g in claude]
c_lost_each = np.array([sum(d['regret'] for d in gr) for gr in c_graded])
c_lost = float(c_lost_each.mean())
c_decisions = [d for gr in c_graded for d in gr]
c_se = c_tot.std(ddof=1) / np.sqrt(len(c_tot))
claude_stats = {'n': len(c_tot), 'mean': r4(c_tot.mean()), 'lo': r4(c_tot.mean() - 1.96 * c_se), 'hi': r4(c_tot.mean() + 1.96 * c_se),
                'p121': r4((c_tot >= 121).mean()), 'p141': r4((c_tot >= 141).mean()), 'lost': r4(c_lost),
                'opt_rate': r4(np.mean([d['regret'] <= 0.05 for d in c_decisions])), 'scores': c_tot.tolist(),
                'model': 'Claude Opus 5.5'}

# Most Moonberries over time: prize = 1 at 121+, 2 at 141+
ps = PrizeSolver({121: 1, 141: 1}, ev)
moon_sim = simulate(ps.policy(), 200_000, seed=7).total
moon_rows = []
def moon_row(name, t, recommended=False):
    return {'name': name, 'per_game': r4((t >= 121).mean() + (t >= 141).mean()), 'p121': r4((t >= 121).mean()),
            'p141': r4((t >= 141).mean()), 'mean': r4(t.mean()), 'recommended': recommended}
moon_rows.append(moon_row('Most Moonberries', moon_sim, True) | {'per_game': r4(ps.expected_prize)})
moon_rows.append(moon_row('1 Moonberry (121+)', sims['Optimal for >= 121 (1 Moonberry)'].total))
moon_rows.append(moon_row('Highest score', sims['Optimal (max average)'].total))
moon_rows.append(moon_row('2 Moonberries (141+)', sims['Optimal for >= 141 (2 Moonberries)'].total))
moon_rows.append(moon_row('Par sheet (this guide)', sims['Target box + par sheet'].total))
moon_pmf = pmf(simulate(ps.policy(), 1_000_000, seed=11).total)   # smooth score distribution for the top chart

# Par-sheet worked examples. Each situation was chosen so the par sheet's move is also the
# exact solver's move (asserted below), and most of them go against instinct.
from engine import OPEN, SCORES, CATEGORIES, counts_from_names, hand_index, mask_from_used
from strategies import _single_box_chase_tables
CE1, _, CK1, _ = _single_box_chase_tables()
EXAMPLES = [
    dict(id='obvious', used=['Jumbleberry', 'Sugarberry', 'Basket5'], hand='P P P P M', kind='score', answer='Basket4'),
    dict(id='threem', used=['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Basket4'], hand='M M M J J', kind='score', answer='Moonberry'),
    dict(id='chase', used=['FreeRoll'], hand='J J J S M', kind='chase', answer='Moonberry'),
    dict(id='dump', used=['Jumbleberry', 'Sugarberry', 'Basket3', 'MixedBasket', 'FreeRoll'], hand='S J F J P', kind='score', answer='Basket5'),
]
par_examples = []
for ex in EXAMPLES:
    m = mask_from_used(ex['used'])
    h = hand_index(counts_from_names(ex['hand'].split()))
    opens = [c for c in range(9) if OPEN[m, c]]
    if ex['kind'] == 'score':
        opts = [{'box': CATEGORY_LABELS[c], 'pts': int(SCORES[h, c]), 'par': int(TUNED_PAR[c]),
                 'diff': int(SCORES[h, c] - TUNED_PAR[c])} for c in opens]
        assert CATEGORIES[int(ev.cat[m, h])] == ex['answer'], ex
    else:
        opts = [{'box': CATEGORY_LABELS[c], 'expect': round(float(CE1[c, h]), 1), 'par': int(TUNED_PAR[c]),
                 'diff': round(float(CE1[c, h] - TUNED_PAR[c]), 1),
                 'lock': names_from_counts(KEEPS[CK1[c, h]], short=True)} for c in opens]
        assert names_from_counts(KEEPS[ev.keep1[m, h]], short=True) == ['M'], ex
    opts.sort(key=lambda o: -o['diff'])
    assert opts[0]['box'] == CATEGORY_LABELS[CATEGORIES.index(ex['answer'])], ex
    par_examples.append({'id': ex['id'], 'kind': ex['kind'], 'hand': ex['hand'].split(),
                         'used': [CATEGORY_LABELS[CATEGORIES.index(u)] for u in ex['used']],
                         'round': len(ex['used']) + 1, 'options': opts})

names = {'Random': 'Random clicking', 'Random locks, best box': 'Random locks, biggest box',
         'One roll, best box': 'Never re-roll, biggest box', 'Keep most common, best box': 'Lock the biggest group',
         'High-roller (J/S as throw-aways)': 'High-roller (Jumble/Sugar as throw-aways)',
         'Best single round (no planning)': 'Best single round, no planning',
         'Target box + par sheet': 'Par sheet (this guide)', 'Optimal (max average)': 'Perfect play',
         'Optimal for >= 121 (1 Moonberry)': 'Perfect play for 121+', 'Optimal for >= 141 (2 Moonberries)': 'Perfect play for 141+'}
ladder = []
for k, r in sims.items():
    t = r.total
    ladder.append({'name': names[k], 'mean': r4(t.mean()), 'p121': r4((t >= 121).mean()), 'p141': r4((t >= 141).mean()),
                   'lost': r4(r.regret.mean()), 'games': len(t), 'group': 'solver' if k.startswith('Optimal') else 'sim'})
ladder.append({'name': "A real player's 21 games", 'mean': r4(ht.mean()), 'p121': r4((ht >= 121).mean()),
               'p141': r4((ht >= 141).mean()), 'lost': None, 'games': 21, 'group': 'real'})
ladder.append({'name': f'Claude Opus 5.5, {len(c_tot)} games', 'mean': r4(c_tot.mean()), 'p121': r4((c_tot >= 121).mean()),
               'p141': r4((c_tot >= 141).mean()), 'lost': r4(c_lost), 'games': len(c_tot), 'group': 'real'})

T = list(range(60, 181))
par_t = sims['Target box + par sheet'].total
frontier = {'t': T, 'best': [r4(th.prob(t)) for t in T], 'ev': [r4(p_opt[t:].sum()) for t in T],
            'par': [r4((par_t >= t).mean()) for t in T]}

opening = []
for h in np.argsort(-FIRST_ROLL)[:14]:
    opening.append({'roll': names_from_counts(HANDS[h], short=True), 'p': r4(FIRST_ROLL[h]),
                    'lock': names_from_counts(KEEPS[ev.keep1[0, h]], short=True)})

opt = sims['Optimal (max average)']
boxes = [{'box': CATEGORY_LABELS[i], 'par': int(TUNED_PAR[i]), 'avg': r4(opt.cat_scores[:, i].mean()),
          'zero': r4((opt.cat_scores[:, i] == 0).mean()), 'round': r4(opt.fill_round[:, i].mean()),
          'human': r4(hb[:, i].mean())} for i in range(9)]


# Endgame table: chasing one box for a whole round (expected points, chance it scores anything)
from engine import FIRST_ROLL as _FR, TRANSITION as _T, SUBKEEPS as _SK
def _qual(c):
    e = (SCORES[:, c] > 0).astype(float)
    for _ in range(2):
        e = (_T @ e)[_SK].max(1)
    return float(_FR @ e)
chase_table = [{'box': CATEGORY_LABELS[c], 'avg': r4(CE1[c] @ _FR), 'qualify': r4(_qual(c))} for c in range(9)]
# Value of a box if it is still open at the start of round n (perfect play), and how often it is
open_value = [{'box': CATEGORY_LABELS[c],
               'value': [r4(opt.cat_scores[opt.fill_round[:, c] >= n, c].mean()) for n in range(1, 10)],
               'open': [r4((opt.fill_round[:, c] >= n).mean()) for n in range(1, 10)]} for c in range(9)]
# Cost of throwing round 1 away as a zero in each box
zero_cost = [{'box': CATEGORY_LABELS[c], 'cost': r4(ev.V[0] - ev.V[1 << c])} for c in range(9)]
counts = {'hands': int(len(HANDS)), 'keeps': int(len(KEEPS)), 'masks': 512, 'situations': 512 * 3 * int(len(HANDS)),
          'raw_outcomes': 10 ** 5}

ai = {}
for key, f in [('q', 'models/q_learning_curve.json'), ('dqn', 'models/dqn_curve.json')]:
    if os.path.exists(f):
        d = json.load(open(f))
        ai[key] = {'curve': [[c['games_trained'], r4(c['mean'])] for c in d['curve'] if c['games_trained'] > 0],
                   'final': {k: r4(v) for k, v in d['final'].items()},
                   'minutes': r4(d['curve'][-1]['seconds'] / 60), 'games': d['curve'][-1]['games_trained']}

data = {'p_opt': [r4(v) for v in p_opt], 'p_par': pmf(par_t), 'p_greedy': pmf(sims['Best single round (no planning)'].total),
        'mean_opt': r4((p_opt * s).sum()), 'p121_ev': r4(p_opt[121:].sum()), 'p141_ev': r4(p_opt[141:].sum()),
        'p121_best': r4(th.prob(121)), 'p141_best': r4(th.prob(141)), 'ladder': ladder, 'frontier': frontier,
        'opening': opening, 'boxes': boxes, 'human_scores': ht.tolist(), 'claude_scores': c_tot.tolist(),
        'claude_lost': r4(c_lost), 'claude': claude_stats, 'moon': moon_rows, 'p_moon': moon_pmf, 'moon_per_game': r4(ps.expected_prize), 'par_examples': par_examples, 'chase_table': chase_table, 'open_value': open_value, 'zero_cost': zero_cost, 'counts': counts, 'ai': ai}
out = sys.argv[1]
json.dump(data, open(out, 'w'), separators=(',', ':'))
print('wrote', out, os.path.getsize(out), 'bytes; ai keys:', list(ai))
