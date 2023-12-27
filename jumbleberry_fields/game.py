from player import Player
from berries import Berries

class Game:
    def __init__(self):
        self.player = Player()
        self.berries = Berries()


    def calculate_category_scores(self):
        potential_categories_scores = self.player.scorecard_categories

        potential_categories_scores['Jumbleberry'] = self.berries.calculate_berry_score('Jumbleberry')
        potential_categories_scores['Sugarberry'] = self.berries.calculate_berry_score('Sugarberry')
        potential_categories_scores['Pickleberry'] = self.berries.calculate_berry_score('Pickleberry')
        potential_categories_scores['Moonberry'] = self.berries.calculate_berry_score('Moonberry')
        potential_categories_scores['Basket of 3'] = self.berries.calculate_basket_of_3_score()
        potential_categories_scores['Basket of 4'] = self.berries.calculate_basket_of_4_score()
        potential_categories_scores['Basket of 5'] = self.berries.calculate_basket_of_5_score()
        potential_categories_scores['Mixed Basket'] = self.berries.calculate_mixed_basket_score()
        potential_categories_scores['Free Roll'] = self.berries.calculate_total_berry_score()
        return 
    

    def start(self):
        print("Welcome to jumbleberry fields!")

        rounds = 9


        for round_number in range (1,rounds):
            print(f"Round {round_number}:")

            self.berries.roll_all()
            print(f"Berries rolled: {self.berries_list}")

            selected_berries = self.player.select_berries(self.berries)
            self.berries.roll_selected(selected_berries)

            selected_berries = self.player.select_berries(self.berries)
            self.berries.roll_selected(selected_berries)

            selected_category = self.player.select_category()


        pass
