from game import Game

# if __name__ == "__main__":
#     num_of_sims = 1000
#     for sim in range(1,num_of_sims):
#         jumbleberry_game = Game()
#         jumbleberry_game.simulate_random_play_highest_cat()

# if __name__ == "__main__":
#     num_of_sims = 1000
#     for sim in range(1,num_of_sims):
#         jumbleberry_game = Game()
#         jumbleberry_game.simulate_random_play()

# if __name__ == "__main__":
#     jumbleberry_game = Game()
#     jumbleberry_game.start()


import gym
import gym_game
import time

print(gym.__version__)


# Assuming JumbleBerryEnv is your custom environment
env = gym.make('gym_game/Jumblegame-v1')

# Test 1: Initialize the environment
observation = env.reset()
print("Initial Observation:", observation)


# Test 2: Perform some steps and render the environment
for _ in range(1):  # You can adjust the number of steps as needed
    action = env.action_space.sample()  # Sample a random action for testing
    # action = 8
    observation, reward, done, _ = env.step(action)

    # Render the environment to visually inspect the state
    env.render()
    time.sleep(1)  # Add a delay for better visualization (optional)

    print("Action:", action)
    print("Observation:", observation)
    print("Reward:", reward)
    print("Done:", done)

    if done:
        print("Episode finished. Resetting the environment.")
        observation = env.reset()

# Close the environment after testing
env.close()

