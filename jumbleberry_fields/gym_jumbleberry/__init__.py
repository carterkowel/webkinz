from gym.envs.registration import register

register(
    id='jumbleberry_fields-v0',
    entry_point='jumbleberry_fields.gym_jumbleberry.envs:JumbleBerryEnv', #Maybe dont need jumbleberry_fields?
    max_episode_steps=2000 #This shold be pre determined based on rolls and rounds
)