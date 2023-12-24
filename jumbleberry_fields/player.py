from InquirerPy import prompt
from InquirerPy import inquirer
from InquirerPy.base.control import Choice
from InquirerPy.separator import Separator


from InquirerPy import inquirer
from InquirerPy.base.control import Choice


# You can keep the Player class definition for potential future use or extensions.
class Player:
    def __init__(self):
        self.scorecard_categories = [
            'Jumbleberry', 
            'Sugarberry', 
            'Pickleberry', 
            'Moonberry',
            'Basket of 3', 
            'Basket of 4', 
            'Basket of 5', 
            'Mixed Basket',
            'Free Roll'
        ]

        self.scorecard = {category: None for category in self.scorecard_categories}
        self.scorecard['Score'] = 0


    def select_category(self):
        # Create a list of scorecard elements that are None
        avaliable_categories = [key for key, value in self.scorecard.items() if value is None]

        selected_category = inquirer.select(
            message="Select a category:",
            choices=avaliable_categories,
            multiselect=False
        ).execute()

        # Perform actions based on selected categories if needed
        return selected_category


    def pick_category(self):
        choices = [
                    Choice(1, enabled=True),
                    Choice(2, enabled=True),
                    3,
                    4,
                    ]

        result = inquirer.select(
            message="Selct one:", choices=choices, multiselect=True
        ).execute()


        self.scorecard = ...