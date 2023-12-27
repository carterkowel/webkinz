import random
from color import Color

class Berries:
    def __init__(self):
        self.berry_attributes = {
            'Jumbleberry': {'value': 2, 'probability': 0.3, 'color': Color.RED},
            'Sugarberry': {'value': 2, 'probability': 0.3, 'color': Color.YELLOW},
            'Pickleberry': {'value': 4, 'probability': 0.2, 'color': Color.GREEN},
            'Moonberry': {'value': 7, 'probability': 0.1, 'color': Color.PURPLE},
            'Fly': {'value': 0, 'probability': 0.1, 'color': Color.BLACK}
        }
        self.berries_list = []
        self.num_of_berries = 5


    def print_berries_in_color(self):
        for berry_name in self.berries_list:
            berry_info = self.berry_attributes.get(berry_name)
            color = berry_info['color']
            print(f"{color}{berry_name}{Color.ENDC}")
        print("\n")


    def calculate_total_berry_score(self):
        total_score = 0
        for berry_type in set(self.berries_list):
            total_score += self.calculate_berry_score(berry_type)
        return total_score
    

    def calculate_berry_score(self, berry_type):
        berry_count = self.berries_list.count(berry_type)
        berry_value = self.berry_attributes[berry_type]['value']
        score = berry_count * berry_value
        return score


    def calculate_basket_of_x_score(self, x):
        max_number_of_duplicates = 0
        for berry in self.berries_list:
            if self.berries_list.count(berry) > max_number_of_duplicates:
                max_number_of_duplicates = self.berries_list.count(berry)
        if max_number_of_duplicates >= x:
            return self.calculate_total_berry_score()
        else:
            return 0


    def calculate_basket_of_3_score(self):
        return self.calculate_basket_of_x_score(3)
    

    def calculate_basket_of_4_score(self):
        return self.calculate_basket_of_x_score(4)
    

    def calculate_basket_of_5_score(self):
        return self.calculate_basket_of_x_score(5)


    def calculate_mixed_basket_score(self):
        required_berries = ['Jumbleberry', 'Sugarberry', 'Pickleberry', 'Moonberry']
        for berry_type in required_berries:
            if berry_type not in self.berries_list:
                return 0
        return self.calculate_total_berry_score()
    

    def roll_all(self):
        print("Rolling Berries!\n")
        berry_types = list(self.berry_attributes.keys())
        probabilities = [v['probability'] for v in self.berry_attributes.values()]
        self.berries_list = random.choices(berry_types, weights=probabilities, k=self.num_of_berries)

 
    def roll_unselected(self, selected):
        print("Rolling Berries!")
        unselected_indices = [index for index in range(len(self.berries_list)) if self.berries_list[index] not in selected]
        for index in unselected_indices:
            self.berries_list[index] = random.choices(list(self.berry_attributes.keys()), weights=[v['probability'] for v in self.berry_attributes.values()])[0]