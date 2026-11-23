import unittest
from unittest.mock import patch
from berries import Berries

class TestBerries(unittest.TestCase):
    def setUp(self):
        self.berry = Berries()

    # calculate_berry_score
    def test_1_jumbleberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Sugarberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Jumbleberry')
        self.assertEqual(score, 2)

    def test_2_jumbleberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Jumbleberry')
        self.assertEqual(score, 4)

    def test_1_sugarberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Sugarberry')
        self.assertEqual(score, 2)

    def test_1_pickleberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Pickleberry')
        self.assertEqual(score, 4)

    def test_1_moonberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Moonberry')
        self.assertEqual(score, 7)


    # calculate_total_berry_score
    def test_calculate_total_berry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_total_berry_score()
        self.assertEqual(score, 17)


    # calculate_basket_of_3_score
    def test_three_jumbleberry(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_basket_of_3_score()
        self.assertEqual(score, 17)

    def test_no_basket_of_three(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_basket_of_3_score()
        self.assertEqual(score, 0)

    def test_three_flys(self):
        self.berry.berries_list = ['Fly', 'Fly', 'Fly', 'Moonberry', 'Moonberry']
        score = self.berry.calculate_basket_of_3_score()
        self.assertEqual(score, 14)


    # calculate_basket_of_4_score
    def test_four_jumbleberry(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Moonberry']
        score = self.berry.calculate_basket_of_4_score()
        self.assertEqual(score, 15)

    def test_no_basket_of_four(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_basket_of_4_score()
        self.assertEqual(score, 0)


    # calculate_basket_of_5_score
    def test_five_jumbleberry(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Jumbleberry']
        score = self.berry.calculate_basket_of_5_score()
        self.assertEqual(score, 10)

    def test_no_basket_of_five(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_basket_of_5_score()
        self.assertEqual(score, 0)


    # calculate_mixed_basket_score
    def test_calculate_mixed_basket_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry', 'Fly']
        score = self.berry.calculate_mixed_basket_score()
        self.assertEqual(score, 15)

    def test_calculate_mixed_basket_score_2(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Moonberry', 'Sugarberry']
        score = self.berry.calculate_mixed_basket_score()
        self.assertEqual(score, 17)

    def test_calculate_mixed_basket_score_none(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Moonberry', 'Fly']
        score = self.berry.calculate_mixed_basket_score()
        self.assertEqual(score, 0)

    # roll_unselected locks individual jars, not whole berry types
    def test_roll_unselected_keeps_only_selected_count(self):
        for _ in range(200):
            self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Moonberry']
            self.berry.roll_unselected(['Jumbleberry', 'Moonberry'])
            # the first Jumbleberry jar and the Moonberry jar are locked
            self.assertEqual(self.berry.berries_list[0], 'Jumbleberry')
            self.assertEqual(self.berry.berries_list[4], 'Moonberry')
        # the two unlocked Jumbleberry jars must sometimes change
        changed = 0
        for _ in range(200):
            self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Moonberry']
            self.berry.roll_unselected(['Jumbleberry', 'Moonberry'])
            changed += self.berry.berries_list[1:3] != ['Jumbleberry', 'Jumbleberry']
        self.assertGreater(changed, 50)


class TestEngine(unittest.TestCase):
    """The fast engine used by the solver must score exactly like Berries."""

    def test_engine_matches_berries_scoring(self):
        import itertools
        import numpy as np
        from engine import BERRIES, HANDS, SCORES, names_from_counts
        b = Berries()
        for h, counts in enumerate(HANDS):
            b.berries_list = names_from_counts(counts)
            expected = [b.calculate_berry_score('Jumbleberry'), b.calculate_berry_score('Sugarberry'),
                        b.calculate_berry_score('Pickleberry'), b.calculate_berry_score('Moonberry'),
                        b.calculate_basket_of_3_score(), b.calculate_basket_of_4_score(),
                        b.calculate_basket_of_5_score(), b.calculate_mixed_basket_score(),
                        b.calculate_total_berry_score()]
            self.assertEqual(list(SCORES[h]), expected, msg=str(b.berries_list))

    def test_transition_rows_sum_to_one(self):
        import numpy as np
        from engine import TRANSITION
        self.assertTrue(np.allclose(TRANSITION.sum(1), 1))

    def test_optimal_expected_score(self):
        from solver import ExpectedScoreSolver
        self.assertAlmostEqual(ExpectedScoreSolver().expected_score, 121.8025, places=3)


if __name__ == '__main__':
    unittest.main()
