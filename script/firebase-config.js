
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // Replace with actual key
  authDomain: "trivia-card-game.firebaseapp.com",
  databaseURL: "https://trivia-card-game-default-rtdb.firebaseio.com/",
  projectId: "trivia-card-game",
  storageBucket: "trivia-card-game.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID", // Replace
  appId: "YOUR_APP_ID" // Replace
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
