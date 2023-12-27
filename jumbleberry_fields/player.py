from berries import Berries


from InquirerPy import prompt
from InquirerPy import inquirer
from InquirerPy.base.control import Choice
from InquirerPy.separator import Separator


from InquirerPy import inquirer
from InquirerPy.base.control import Choice


# You can keep the Player class definition for potential future use or extensions.
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


    def select_berries(self, berries):
        choices = list(berries.berries_list)
        choices.append("Roll Em All ;)")

        selected_berries = inquirer.select(
            message="Press SPACE to select berries to lock-in and then press ENTER to roll again:",
            choices=choices,
            multiselect=True
        ).execute()
        return selected_berries