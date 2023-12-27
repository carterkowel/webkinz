import unittest
from unittest.mock import patch
from berries import Berries

class TestBerries(unittest.TestCase):
    def setUp(self):
        self.berry = Berries()

    def test_1_jumbleberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Sugarberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Jumbleberry')
        self.assertEqual(score, 2)  # Expected score based on the provided berries_list

    def test_2_jumbleberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Jumbleberry')
        self.assertEqual(score, 4)  # Expected score based on the provided berries_list

    def test_1_sugarberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Sugarberry')
        self.assertEqual(score, 2)  # Expected score based on the provided berries_list


    def test_1_pickleberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Pickleberry')
        self.assertEqual(score, 4)  # Expected score based on the provided berries_list

    def test_1_moonberry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_berry_score('Moonberry')
        self.assertEqual(score, 7)  # Expected score based on the provided berries_list


    def test_calculate_total_berry_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_total_berry_score()
        self.assertEqual(score, 17)  # Expected score based on the provided berries_list

    def test_calculate_basket_of_3_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Jumbleberry', 'Jumbleberry', 'Pickleberry', 'Moonberry']
        score = self.berry.calculate_basket_of_3_score()
        self.assertEqual(score, 17)  # Expected score for Basket of 3

    def test_calculate_mixed_basket_score(self):
        self.berry.berries_list = ['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry', 'Fly']
        score = self.berry.calculate_mixed_basket_score()
        self.assertEqual(score, 15)  # Expected score for a mixed basket

if __name__ == '__main__':
    unittest.main()
