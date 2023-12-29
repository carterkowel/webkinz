from berries import Berries

from InquirerPy import inquirer


class Player:
    def __init__(self):
        self.scorecard_categories = {
            'Jumbleberry': None,
            'Sugarberry': None,
            'Pickleberry': None,
            'Moonberry': None,
            'Basket of 3': None,
            'Basket of 4': None,
            'Basket of 5': None,
            'Mixed Basket': None,
            'Free Roll': None
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