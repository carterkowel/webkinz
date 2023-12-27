import random

class Berries:
    def __init__(self):
        self.berry_attributes = {
            'Jumbleberry': {'value': 2, 'probability': 0.3},
            'Sugarberry': {'value': 2, 'probability': 0.3},
            'Pickleberry': {'value': 4, 'probability': 0.2},
            'Moonberry': {'value': 7, 'probability': 0.1},
            'Fly': {'value': 0, 'probability': 0.1}
        }
        self.berries_list = []
        self.num_of_berries = 5

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
        socre = self.calculate_basket_of_x_score(3)
        print(socre)
        return self.calculate_basket_of_x_score(3)
    
    def calculate_basket_of_4_score(self):
        return self.calculate_basket_of_x_score(4)
    
    def calculate_basket_of_5_score(self):
        return self.calculate_basket_of_x_score(5)

    def calculate_mixed_basket_score(self):
            for berry_type in self.berry_attributes:
                if berry_type not in self.berries_list:
                    return 0
            
            return self.calculate_total_berry_score()  # Assuming this method exists and calculates the total score
    

    def roll_all(self):
        self.berries_list = [random.choices(self.berry_attributes, weights=self.berry_probabilities)[0] for _ in range(self.num_of_berries)]

    def roll_selected(self, locked):
       self.berries_list = [random.randint(1, 6) for _ in range(5)]  # Roll all five dice