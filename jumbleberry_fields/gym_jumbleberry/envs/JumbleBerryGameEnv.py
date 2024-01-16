import gym
from gym import spaces
import numpy as np
from berries import Berries
from player import Player
from game import Game

class JumbleBerryEnv(gym.Env):
    def __init__(self):
        self.player = Player()
        self.berries = Berries()
        self.game = Game()
        self.num_of_rounds = len(self.player.scorecard_categories)
        # self.num_of_rolls = 1 # First implementing no keeping

        # 9 possible actions: 0=Jumbleberry, 1=Sugarberry, 2=Pickleberry, 3=Moonberry, 4=Basket of 3, 5=Basket of 4, 6=Basket of 5, 7=Mixed Basket, 8=Free Roll
        self.action_space = spaces.Discrete(self.num_of_rounds)  

        self.observation_space = spaces.Tuple((
            spaces.Discrete(9),  # round
            # spaces.Discrete(4),  # rolls
            spaces.MultiDiscrete([4] * 5),  # Representing 5 berries with 5 possible types each
            #An alternative to the above is (Where I assign values 0, 2, 3, 4, 7):
            # spaces.Box(low=-0, high=10, shape=(1,), dtype=np.uint8),  # Jumbleberry
            # spaces.Box(low=2, high=7, shape=(1,), dtype=np.uint8),  # Berry 1
            # spaces.Box(low=2, high=7, shape=(1,), dtype=np.uint8),  # Berry 2
            # spaces.Box(low=2, high=7, shape=(1,), dtype=np.uint8),  # Berry 3
            # spaces.Box(low=2, high=7, shape=(1,), dtype=np.uint8),  # Berry 4
            # spaces.Box(low=2, high=7, shape=(1,), dtype=np.uint8),  # Berry 5
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
            self.berries.berries_list, # Need to convert this to MultiDiscrete form
            np.array([self.player.scorecard_categories['Jumbleberry']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Sugarberry']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Pickleberry']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Moonberry']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Basket of 3']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Basket of 4']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Basket of 5']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Mixed Basket']], dtype=np.uint8),
            np.array([self.player.scorecard_categories['Free Roll']], dtype=np.uint8)
        )

    def step(self, action: int):
        finsihed = False

        # Get action cateogry and score
        selected_category = action
        selected_category_score = self.game.calculate_category_score(selected_category)

        # Get list of avaliable categories that have not been picked yet
        remaining_potential_categories = list(self.game.calculate_remaining_category_scores().keys)

        if selected_category in remaining_potential_categories:
            self.player.update_scorecard(selected_category, selected_category_score)
            reward = self.player.scorecard['Score']
            if self.game.round_number == self.game.num_of_rounds:
                finished = True
            else:
                self.berries.roll_all()
                self.game.round_number += 1

        else:
            reward = -100
            finished = True

        return self.get_observation_space(), reward, finished

    def reset(self):
        self.player = Player()
        self.berries = Berries()
        self.game = Game()
        self.num_of_rounds = len(self.player.scorecard_categories)

    def render(self, mode='human', close=False):
        dice = self.pyhtzee.dice
        outfile = sys.stdout
        outfile.write(f'Dice: {dice[0]} {dice[1]} {dice[2]} {dice[3]} {dice[4]} '
                      f'Round: {self.pyhtzee.round}.{self.pyhtzee.sub_round} '
                      f'Score: {self.pyhtzee.get_total_score()}\n')





    def reset(self):
        self.current_pos = self.start_pos
        return self.current_pos

    def step(self, action):
        # Move the agent based on the selected action
        new_pos = np.array(self.current_pos)
        if action == 0:  # Up
            new_pos[0] -= 1
        elif action == 1:  # Down
            new_pos[0] += 1
        elif action == 2:  # Left
            new_pos[1] -= 1
        elif action == 3:  # Right
            new_pos[1] += 1

        # Check if the new position is valid
        if self._is_valid_position(new_pos):
            self.current_pos = new_pos

        # Reward function
        if np.array_equal(self.current_pos, self.goal_pos):
            reward = 1.0
            done = True
        else:
            reward = 0.0
            done = False

        return self.current_pos, reward, done, {}