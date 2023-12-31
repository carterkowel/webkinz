from game import Game

if __name__ == "__main__":
    num_of_sims = 1000
    for sim in range(1,num_of_sims):
        jumbleberry_game = Game()
        jumbleberry_game.simulate_random_play_highest_cat()

# if __name__ == "__main__":
#     num_of_sims = 1000
#     for sim in range(1,num_of_sims):
#         jumbleberry_game = Game()
#         jumbleberry_game.simulate_random_play()

# if __name__ == "__main__":
#     jumbleberry_game = Game()
#     jumbleberry_game.start()