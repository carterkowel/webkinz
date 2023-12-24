from player import Player
from berries import Berries

class Game:
    def __init__(self):
        self.player = Player()
        self.berries = Berries()


    def calculate_category_scores(self):
        potential_categories_scores = self.player.scorecard_categories

        potential_categories_scores['Jumbleberry'] = self.berries.calculate_berry_score('jumble')
        potential_categories_scores['Sugarberry'] = self.berries.calculate_berry_score('sugar')
        potential_categories_scores['Pickleberry'] = self.berries.calculate_berry_score('pickle')
        potential_categories_scores['Moonberry'] = self.berries.calculate_berry_score('moon')



        return total_score

    def start(self):
        print("Welcome to jumbleberry fields!")

        rounds = 9


        for round_number in range (1,rounds):
            print(f"Round {round_number}:")
                        
            # Roll all berries at the beginning of each round
            self.berries.roll_all()
            print(f"Berries rolled: {self.berries.values}")
            self.player.pick_category()



        # Game flow implementation
        pass
