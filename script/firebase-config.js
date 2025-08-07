
  // firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

  
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {

    apiKey: "AIzaSyB2R492H_Z-TH3Z1lglDahsXKE1vdL2MgI",
    authDomain: "trivia-card-game.firebaseapp.com",
    databaseURL: "https://trivia-card-game-default-rtdb.firebaseio.com",
    projectId: "trivia-card-game",
    storageBucket: "trivia-card-game.firebasestorage.app",
    messagingSenderId: "788568769612",
    appId: "1:788568769612:web:489fe7aa37b6d60102e0e9",
    measurementId: "G-VYR4SWEJSF"
  };

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
export { db };