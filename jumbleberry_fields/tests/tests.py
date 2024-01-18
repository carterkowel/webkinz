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

if __name__ == '__main__':
    unittest.main()
