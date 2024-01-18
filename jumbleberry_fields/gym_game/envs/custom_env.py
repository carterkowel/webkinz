# import gymnasium as gym
import gym
from gym import spaces
import numpy as np
from berries import Berries
from player import Player   
from game import Game
from enum import Enum

class CustomEnv(gym.Env):
    def __init__(self):
        self.player = Player()
        self.berries = Berries()
        self.game = Game()
        self.num_of_rounds = len(self.player.scorecard_categories)
        # self.num_of_rolls = 1 # First implementing no keeping
        self.berry_mapping = {
            'Jumbleberry': 0,
            'Sugarberry': 1,
            'Pickleberry': 2,
            'Moonberry': 3,
            'Fly': 4
        }

        # 9 possible actions: 0=Jumbleberry, 1=Sugarberry, 2=Pickleberry, 3=Moonberry, 4=Basket of 3, 5=Basket of 4, 6=Basket of 5, 7=Mixed Basket, 8=Free Roll
        self.action_space = spaces.Discrete(self.num_of_rounds - 1)  

        self.observation_space = spaces.Tuple((
            spaces.Discrete(9),  # round
            # spaces.Discrete(4),  # rolls
            spaces.MultiDiscrete([4] * 5),  # Representing 5 berries with 5 possible types each
            spaces.Box(low=-0, high=10, shape=(1,), dtype=np.uint8),  # Jumbleberry
            spaces.Box(low=-0, high=10, shape=(1,), dtype=np.uint8),  # Sugarberry
            spaces.Box(low=-0, high=20, shape=(1,), dtype=np.uint8),  # Pickleberry
            spaces.Box(low=-0, high=35, shape=(1,), dtype=np.uint8),  # Moonberry
            spaces.Box(low=-0, high=35, shape=(1,), dtype=np.uint8),  # Basket3
            spaces.Box(low=-0, high=35, shape=(1,), dtype=np.uint8),  # Basket4
            spaces.Box(low=-0, high=35, shape=(1,), dtype=np.uint8),  # Basket5
            spaces.Box(low=-0, high=22, shape=(1,), dtype=np.uint8),  # Mixed Basket
            spaces.Box(low=-0, high=35, shape=(1,), dtype=np.uint8),  # Free Roll
            # spaces.Box(low=-0, high=237, shape=(1,), dtype=np.uint8),  # Score NOT SURE IF I SHOULD INCLUDE
        ))


    def get_observation_space(self):
        return (
            self.game.round_number,
            tuple(self.berry_mapping[berry] for berry in self.berries.berries_list),
            np.array([self.player.scorecard_categories['Jumbleberry'] if self.player.scorecard_categories['Jumbleberry'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Sugarberry'] if self.player.scorecard_categories['Sugarberry'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Pickleberry'] if self.player.scorecard_categories['Pickleberry'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Moonberry'] if self.player.scorecard_categories['Moonberry'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Basket3'] if self.player.scorecard_categories['Basket3'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Basket4'] if self.player.scorecard_categories['Basket4'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Basket5'] if self.player.scorecard_categories['Basket5'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['MixedBasket'] if self.player.scorecard_categories['MixedBasket'] is not None else 0], dtype=np.uint8),
            np.array([self.player.scorecard_categories['FreeRoll'] if self.player.scorecard_categories['FreeRoll'] is not None else 0], dtype=np.uint8)
        )

    def step(self, action: int):
        self.game.round_number += 1
        finished = False

        self.berries.roll_all()

        # Get action cateogry and score
        selected_category = ActionType(action).name
        selected_category_score = self.game.calculate_category_score(self.berries, selected_category)

        # Get list of avaliable categories that have not been picked yet
        remaining_potential_categories = list(self.game.calculate_remaining_category_scores().keys())

        if selected_category in remaining_potential_categories:
            self.player.update_scorecard(selected_category, selected_category_score)
            reward = self.player.scorecard['Score']
            if self.game.round_number == self.game.num_of_rounds:
                finished = True
            # else:
            #     self.game.round_number += 1

        else:
            reward = -1000
            finished = True

        info = {}

        return self.get_observation_space(), reward, finished, info


    def reset(self):
        self.player = Player()
        self.berries = Berries()
        self.game = Game()
        self.num_of_rounds = len(self.player.scorecard_categories)

    def render(self, mode='human'):
        print(f"Round: {self.game.round_number}")
        print(f"Berries: {self.berries.berries_list}")
        print(f"Scorecard: {self.player.scorecard}")

class ActionType(Enum):
    Jumbleberry = 0
    Sugarberry = 1
    Pickleberry = 2
    Moonberry = 3
    Basket3 = 4
    Basket4 = 5
    Basket5 = 6
    MixedBasket = 7
    FreeRoll = 8
