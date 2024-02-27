from game import Game

def play_single_game():
    jumbleberry_game = Game()
    jumbleberry_game.start()

def simulate_1000_random_games():
    num_sims = 1000
    for sim in range(num_sims):
        jumbleberry_game = Game()
        jumbleberry_game.simulate_random_play()

def simulate_1000_semi_random_games():
    num_sims = 1000
    for sim in range(num_sims):
        jumbleberry_game = Game()
        jumbleberry_game.simulate_semi_random_play()

if __name__ == "__main__":
    # Select one of the 3 options below by uncommenting the code and commenting out the others

    play_single_game()
    # simulate_1000_random_games()
    # simulate_1000_semi_random_games()