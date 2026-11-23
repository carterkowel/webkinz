from gym.envs.registration import register

register(
    id='gym_game/Jumblegame-v1',
    entry_point='gym_game.envs:CustomEnv',
)