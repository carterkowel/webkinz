import random

# Function to roll a number of dice
def roll_dice(num_dice):
    return [random.randint(1, 6) for _ in range(num_dice)]

# Function to display dice
def display_dice(dice):
    print("Dice:", dice)

# Function to score the dice for a category
def score_dice(dice, category):
    # Implement logic to score for different categories
    # For example:
    if category == "Ones":
        return dice.count(1) * 1
    elif category == "Twos":
        return dice.count(2) * 2
    # Add more categories here

# Function to play a turn
def play_turn():
    num_dice = 5
    dice = roll_dice(num_dice)
    rolls_left = 2  # Total rolls allowed per turn
    for _ in range(rolls_left):
        display_dice(dice)
        if _ < rolls_left - 1:  # Allow re-rolling dice except on the last roll
            keep = input("Enter dice indices to keep (e.g., 1 3 5), or 'none' to reroll all: ")
            if keep.strip().lower() != "none":
                keep_indices = [int(index) - 1 for index in keep.split()]
                for i in range(num_dice):
                    if i not in keep_indices:
                        dice[i] = random.randint(1, 6)
        else:
            print("Last roll for this turn.")
        print("-------------------")
    category = input("Enter category (Ones, Twos, etc.): ")
    score = score_dice(dice, category)
    print(f"Score for {category}: {score}")

# Main game loop
def yahtzee_game():
    print("Welcome to Yahtzee!")
    turns = 3
    for _ in range(turns):
        print(f"Turn {turns - _} / {turns}")
        play_turn()
        print("-------------------")
    print("Game Over")

# Start the game
yahtzee_game()
