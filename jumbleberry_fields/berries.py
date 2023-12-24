import random

class Berries:
    def __init__(self):
        self.berry_types = ['jumble', 'sugar', 'pickle', 'moon', 'fly']
        self.berry_values = {'jumble': 2, 'sugar': 2, 'pickle': 4, 'moon': 7, 'fly': 0}
        self.berry_probabilities = {'jumble': 0.3, 'sugar': 0.3, 'pickle': 0.2, 'moon': 0.1, 'fly': 0.1}
        self.berries_list = []
        self.num_of_berries = 5

    def calculate_total_berry_score(self):
        total_score = 0
        for berry_type in set(self.berries_list):
            total_score += self.calculate_berry_score(berry_type) * self.berries_list.count(berry_type)
        return total_score

    def calculate_berry_score(self, berry_type):
        berry_count = self.berries_list.count(berry_type)
        berry_value = self.berry_values.get(berry_type, 0)
        return berry_count * berry_value

    def roll_all(self):
            self.berries_list = [random.choices(self.berry_types, weights=self.berry_probabilities)[0] for _ in range(self.num_of_berries)]



    def roll_unlocked(self, locked):
        self.values = [random.randint(1, 6) for _ in range(5)]  # Roll all five dice

    def lock_berries(self, locked):
        self.values = [random.randint(1, 6) for _ in range(5)]  # Roll all five dice


