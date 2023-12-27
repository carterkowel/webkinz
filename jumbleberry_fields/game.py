from player import Player
from berries import Berries

class Game:
    def __init__(self):
        self.player = Player()
        self.berries = Berries()


    # def calculate_avaliable_category_scores(self):
    #     potential_categories_scores = {key: None for key, value in self.player.scorecard.items() if value is None}
    #     print(potential_categories_scores)

    #     potential_categories_scores['Jumbleberry'] = self.berries.calculate_berry_score('Jumbleberry')
    #     potential_categories_scores['Sugarberry'] = self.berries.calculate_berry_score('Sugarberry')
    #     potential_categories_scores['Pickleberry'] = self.berries.calculate_berry_score('Pickleberry')
    #     potential_categories_scores['Moonberry'] = self.berries.calculate_berry_score('Moonberry')
    #     potential_categories_scores['Basket of 3'] = self.berries.calculate_basket_of_3_score()
    #     potential_categories_scores['Basket of 4'] = self.berries.calculate_basket_of_4_score()
    #     potential_categories_scores['Basket of 5'] = self.berries.calculate_basket_of_5_score()
    #     potential_categories_scores['Mixed Basket'] = self.berries.calculate_mixed_basket_score()
    #     potential_categories_scores['Free Roll'] = self.berries.calculate_total_berry_score()
        
    #     return potential_categories_scores
    

    def calculate_remaining_category_scores(self):
        remaining_potential_categories_scores = {key: None for key, value in self.player.scorecard.items() if value is None}

        score_methods = {
            'Jumbleberry': self.berries.calculate_berry_score('Jumbleberry'),
            'Sugarberry': self.berries.calculate_berry_score('Sugarberry'),
            'Pickleberry': self.berries.calculate_berry_score('Pickleberry'),
            'Moonberry': self.berries.calculate_berry_score('Moonberry'),
            'Basket of 3': self.berries.calculate_basket_of_3_score(),
            'Basket of 4': self.berries.calculate_basket_of_4_score(),
            'Basket of 5': self.berries.calculate_basket_of_5_score(),
            'Mixed Basket': self.berries.calculate_mixed_basket_score(),
            'Free Roll': self.berries.calculate_total_berry_score()
        }

        for category, method in score_methods.items():
            if category in remaining_potential_categories_scores:
                remaining_potential_categories_scores[category] = method

        return remaining_potential_categories_scores

    

    def start(self):
        print("\nWelcome to jumbleberry fields!\n")

        rounds = 9


        for round_number in range (1,rounds):
            print(f"Round {round_number}\n")

            self.berries.roll_all()
            self.berries.print_berries_in_color()

            selected_berries = self.player.select_berries(self.berries)
            self.berries.roll_unselected(selected_berries)
            self.berries.print_berries_in_color()

            selected_berries = self.player.select_berries(self.berries)
            self.berries.roll_unselected(selected_berries)
            self.berries.print_berries_in_color()

            remaining_potential_categories_scores = self.calculate_remaining_category_scores()
            print(" ")
            for category, potential_score in remaining_potential_categories_scores.items():
                print(f"{category}: {potential_score}")

            selected_category, selected_category_score = self.player.select_category(remaining_potential_categories_scores)
            self.player.update_scorecard(selected_category, selected_category_score)

            print(" ")
            for category, score in self.player.scorecard.items():
                print(f"{category}: {score}")            

        pass
