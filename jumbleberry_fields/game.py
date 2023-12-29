from player import Player
from berries import Berries
import time
import json

class Game:
    def __init__(self):
        self.player = Player()
        self.berries = Berries()
        self.num_of_rounds = len(self.player.scorecard_categories)
        self.num_of_rolls = 3

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
        print('''
        __          __  _                            _______           _                 _     _      _                            ______ _      _     _     
        \ \        / / | |                          |__   __|         | |               | |   | |    | |                          |  ____(_)    | |   | |    
         \ \  /\  / /__| | ___ ___  _ __ ___   ___     | | ___        | |_   _ _ __ ___ | |__ | | ___| |__   ___ _ __ _ __ _   _  | |__   _  ___| | __| |___ 
          \ \/  \/ / _ \ |/ __/ _ \| '_ ` _ \ / _ \    | |/ _ \   _   | | | | | '_ ` _ \| '_ \| |/ _ \ '_ \ / _ \ '__| '__| | | | |  __| | |/ _ \ |/ _` / __|
           \  /\  /  __/ | (_| (_) | | | | | |  __/    | | (_) | | |__| | |_| | | | | | | |_) | |  __/ |_) |  __/ |  | |  | |_| | | |    | |  __/ | (_| \__ \\
            \/  \/ \___|_|\___\___/|_| |_| |_|\___|    |_|\___/   \____/ \__,_|_| |_| |_|_.__/|_|\___|_.__/ \___|_|  |_|   \__, | |_|    |_|\___|_|\__,_|___/
                                                                                                                            __/ |                            
                                                                                                                           |___/                             
        ''')
        time.sleep(2)

        for round_number in range (1,self.num_of_rounds):
            print(f"Round {round_number}\n")
            time.sleep(0.5)

            print(f"Roll 1\n")
            time.sleep(0.5)

            self.berries.roll_all()
            time.sleep(1.5)
            self.berries.print_berries_in_color()
            time.sleep(1)

            remaining_potential_categories_scores = self.calculate_remaining_category_scores()
            selected_berries, selected_category, selected_category_score = self.player.select_choice(self.berries, remaining_potential_categories_scores)

            if len(selected_berries) == 0:
                self.player.update_scorecard(selected_category, selected_category_score)

                print(" ")
                for category, score in self.player.scorecard.items():
                    print(f"{category}: {score}")  

                print(" ")
                time.sleep(1.5)
                continue

            

            print(f"Roll 2\n")
            time.sleep(0.5)

            if 'Roll Em All ;)' in selected_berries:
                self.berries.roll_all()
            else:
                self.berries.roll_unselected(selected_berries)
            time.sleep(1.5)
            self.berries.print_berries_in_color()
            time.sleep(1)

            

            remaining_potential_categories_scores = self.calculate_remaining_category_scores()
            selected_berries, selected_category, selected_category_score = self.player.select_choice(self.berries, remaining_potential_categories_scores)

            if len(selected_berries) == 0:
                self.player.update_scorecard(selected_category, selected_category_score)

                print(" ")
                for category, score in self.player.scorecard.items():
                    print(f"{category}: {score}")  

                print(" ")
                time.sleep(1.5)
                continue


            print(f"Roll 3\n")
            time.sleep(0.5)

            if 'Roll Em All ;)' in selected_berries:
                self.berries.roll_all()
            else:
                self.berries.roll_unselected(selected_berries)
            time.sleep(1.5)
            self.berries.print_berries_in_color()
            time.sleep(1)


            remaining_potential_categories_scores = self.calculate_remaining_category_scores()
            selected_category, selected_category_score = self.player.select_category(remaining_potential_categories_scores)
            self.player.update_scorecard(selected_category, selected_category_score)

            print(" ")
            for category, score in self.player.scorecard.items():
                print(f"{category}: {score}")  

            print(" ")
            time.sleep(1.5)


        existing_data = []
        path = 'jumbleberry_fields/game_results.json'
        try:
            with open(path, 'r') as file:
                existing_data = json.load(file)
        except FileNotFoundError:
            pass

        existing_data.append(self.player.scorecard)

        with open(path, 'w') as file:
            json.dump(existing_data, file, indent=2)