# ANSI color codes
class Color:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'

# Sample list
my_list = ["Red", "Green", "Blue", "Yellow"]

# Print the list with different colors
for color, item in zip([Color.FAIL, Color.OKGREEN, Color.OKBLUE, Color.WARNING], my_list):
    print(f"{color}{item}{Color.ENDC}")
