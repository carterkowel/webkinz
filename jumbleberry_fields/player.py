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


    def select_berries(self, berries):
        choices = berries.berries_list.append("Roll Again")

        result = inquirer.select(
            message="Select berries to lock-in (SPACE) and roll again (ENTER):",
            choices=choices,
            multiselect=True
        ).execute()

        selected_berries = [choice.value for choice in result][:-1] #[:-1] removes the "Roll Again"

        return selected_berries