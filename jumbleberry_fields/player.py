from berries import Berries
import random


from InquirerPy import inquirer


class Player:
    def __init__(self):
        self.scorecard_categories = {
            'Jumbleberry': None,
            'Sugarberry': None,
            'Pickleberry': None,
            'Moonberry': None,
            'Basket3': None,
            'Basket4': None,
            'Basket5': None,
            'MixedBasket': None,
            'FreeRoll': None
        }
        self.scorecard = self.scorecard_categories
        self.scorecard['Score'] = 0


    def update_scorecard(self, selected_category, selected_category_score):
        self.scorecard[selected_category] = selected_category_score
        self.scorecard['Score'] += int(selected_category_score)


    def select_category(self, remaining_potential_categories_scores):
        category_scores_list = [f"{key}: {value}" for key, value in remaining_potential_categories_scores.items()]
        selected_category_and_score = inquirer.select(
            message="Select a category:",
            choices=category_scores_list,
            multiselect=False
        ).execute()
        selected_category, selected_category_score = selected_category_and_score.split(": ")
        return selected_category, selected_category_score


    # NOT BEING USED
    def select_berries(self, berries):
        choices = list(berries.berries_list)
        choices.append("Roll Em All ;)")

        selected_berries = inquirer.select(
            message="Press SPACE to select berries to lock-in and then press ENTER to roll again:",
            choices=choices,
            multiselect=True
        ).execute()
        return selected_berries
    

    def select_choice(self, berries, remaining_potential_categories_scores):
        choices = []
        choices.extend(berries.berries_list)
        choices.append("Roll Em All ;)")
        choices.extend([f"{key}: {value}" for key, value in remaining_potential_categories_scores.items()])

        valid_selection = False

        while not valid_selection:
            selected_choice = inquirer.select(
                message="Press SPACE to select berries to lock-in OR pick ONE category, press ENTER to submit:",
                choices=choices,
                multiselect=True
            ).execute()

            if "Roll Em All ;)" in selected_choice and len(selected_choice) == 1:
                selected_berries = selected_choice
                selected_category = 'NA'
                selected_category_score = 0
                valid_selection = True
            elif all(berry in berries.berries_list for berry in selected_choice):
                selected_berries = selected_choice
                selected_category = 'NA'
                selected_category_score = 0
                valid_selection = True
            elif len(selected_choice) == 1:
                selected_category, selected_category_score = selected_choice[0].split(": ")
                selected_berries = []
                valid_selection = True
            else:
                print("Please make a valid selection")

        return selected_berries, selected_category, selected_category_score
    

    def randomly_select_berries(self, berries):
        berries_to_select_from = list(berries.berries_list)
        num_selected = random.randint(0, min(5, len(berries_to_select_from)))
        randomly_selected_berries = random.sample(berries_to_select_from, k=num_selected)
        return randomly_selected_berries
    

    def randomly_select_category(self, remaining_potential_categories_scores):
        category_scores_list = [f"{key}: {value}" for key, value in remaining_potential_categories_scores.items()]
        randomly_selected_category_and_score = random.choice(category_scores_list)
        randomly_selected_category, randomly_selected_category_score = randomly_selected_category_and_score.split(": ")

        return randomly_selected_category, randomly_selected_category_score
    

    def select_highest_category(self, remaining_potential_categories_scores):
        max_score = max(remaining_potential_categories_scores.values())
        max_indices = [i for i, v in enumerate(remaining_potential_categories_scores.values()) if v == max_score]
        max_index = random.choice(max_indices)
        
        keys = list(remaining_potential_categories_scores.keys())
        highest_selected_category = keys[max_index]
        highest_selected_category_score = max_score

        return highest_selected_category, highest_selected_category_score
    