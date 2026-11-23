// Shared leaderboard for Bramble Dice (Firebase Firestore, free Spark plan).
// Fill in the two values from your Firebase project (see site/README.md, "Leaderboard setup").
// Leave them empty and the game simply hides the leaderboard.
// The apiKey is safe to publish: Firebase keys identify the project; the rules in
// site/firestore.rules decide what visitors may read and write.
window.BRAMBLE_LEADERBOARD = {
  projectId: 'bramble-dice',
  apiKey: 'AIzaSyAWQhV0j36GLznXw41kaBLHg-dYu6AWt7U',
};
