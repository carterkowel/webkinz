# import gym
# from gym import spaces
# import gym_game
# import numpy as np

# class QLearningAgent:
#     def __init__(self, state_size, action_size, learning_rate=0.1, discount_factor=0.9, exploration_prob=1.0, exploration_decay=0.995, exploration_min=0.01):
#         self.state_size = state_size
#         self.action_size = action_size
#         self.learning_rate = learning_rate
#         self.discount_factor = discount_factor
#         self.exploration_prob = exploration_prob
#         self.exploration_decay = exploration_decay
#         self.exploration_min = exploration_min
#         self.q_table = np.zeros([state_size, action_size])



#     def choose_action(self, state):
#         if np.random.rand() < self.exploration_prob:
#             return np.random.choice(self.action_size)
#         else:
#             return np.argmax(self.q_table[state])

#     def update_q_table(self, state, action, reward, next_state, done):
#         if done:
#             target = reward
#         else:
#             target = reward + self.discount_factor * np.max(self.q_table[next_state, action])

#         current_value = self.q_table[state, action]
#         self.q_table[state + (action,)] += self.learning_rate * (target - current_value)

#         if self.exploration_prob > self.exploration_min:
#             self.exploration_prob *= self.exploration_decay

# def train_q_learning(env, agent, episodes=1000):
#     for episode in range(episodes):
#         state = env.reset()
#         state = tuple(state)

#         total_reward = 0
#         done = False

#         while not done:
#             action = agent.choose_action(state)
#             next_state, reward, done, _ = env.step(action)
#             next_state = tuple(next_state)

#             agent.update_q_table(state, action, reward, next_state, done)

#             state = next_state
#             total_reward += reward

#         print(f"Episode: {episode + 1}, Total Reward: {total_reward}")

# # Assuming JumbleBerryEnv is your custom environment
# env = gym.make('gym_game/Jumblegame-v1')


# # state_space = tuple(space.n if isinstance(space, spaces.Discrete) else space.shape[0] for space in env.observation_space.spaces)
# state_space = len(tuple(space.n if isinstance(space, gym.spaces.Discrete) else space.shape[0] for space in env.observation_space.spaces))
# action_space = env.action_space.n

# agent = QLearningAgent(state_space, action_space)

# train_q_learning(env, agent, episodes=3)


# # After training, you can use the learned Q-table to make decisions or evaluate the agent.


import gym
from gym import spaces
import gym_game
import numpy as np

class QLearningAgent:
    def __init__(self, state_size, action_size, learning_rate=0.1, discount_factor=0.9, exploration_prob=1.0, exploration_decay=0.995, exploration_min=0.01):
        self.state_size = state_size
        self.action_size = action_size
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.exploration_prob = exploration_prob
        self.exploration_decay = exploration_decay
        self.exploration_min = exploration_min
        self.q_table = np.zeros((state_size, action_size))

    def state_to_index(self, state):
        # Convert the tuple state to a single index using a hash function
        return hash(state) % self.state_size

    def choose_action(self, state):
        if np.random.rand() < self.exploration_prob:
            return np.random.choice(self.action_size)
        else:
            index = self.state_to_index(state)
            return np.argmax(self.q_table[index])

    def update_q_table(self, state, action, reward, next_state, done):
        index = self.state_to_index(state)
        next_index = self.state_to_index(next_state)

        if done:
            target = reward
        else:
            target = reward + self.discount_factor * np.max(self.q_table[next_index])

        current_value = self.q_table[index, action]
        self.q_table[state, action] += self.learning_rate * (target - current_value)

        if self.exploration_prob > self.exploration_min:
            self.exploration_prob *= self.exploration_decay

def train_q_learning(env, agent, episodes=1000):
    for episode in range(episodes):
        state = env.reset()
        state = tuple(state)

        total_reward = 0
        done = False

        while not done:
            action = agent.choose_action(state)
            next_state, reward, done, _ = env.step(action)
            next_state = tuple(next_state)

            agent.update_q_table(state, action, reward, next_state, done)

            state = next_state
            total_reward += reward

        print(f"Episode: {episode + 1}, Total Reward: {total_reward}")

# Assuming JumbleBerryEnv is your custom environment
env = gym.make('gym_game/Jumblegame-v1')

state_space = len(tuple(space.n if isinstance(space, gym.spaces.Discrete) else space.shape[0] for space in env.observation_space.spaces))
action_space = env.action_space.n

agent = QLearningAgent(state_space, action_space)

train_q_learning(env, agent, episodes=3)
