
document.getElementById('create-game').addEventListener('click', () => {
  const gameCode = Math.random().toString(36).substr(2, 6).toUpperCase();
  document.getElementById('game-code').textContent = gameCode;
  document.getElementById('game-area').classList.remove('hidden');

  const gameRef = db.ref('games/' + gameCode);
  gameRef.set({
    state: 'waiting',
    players: {},
    currentQuestion: {},
    createdAt: Date.now()
  });

  // Placeholder: simulate first question
  const question = {
    questionId: "q1",
    questionText: "What is the capital of France?",
    options: ["Berlin", "Paris", "Rome", "Madrid"],
    correctOption: "Paris",
    isRevealed: false
  };
  gameRef.child("currentQuestion").set(question);

  document.getElementById('question-text').textContent = question.questionText;
  document.getElementById('options-list').innerHTML = question.options.map(opt => 
    `<div class='btn btn-secondary'>${opt}</div>`).join("");
});

// Show player answers live
db.ref("games").on("value", snapshot => {
  const gameCode = document.getElementById('game-code').textContent;
  const game = snapshot.val()[gameCode];
  if (game && game.players) {
    const responses = Object.values(game.players).map(player =>
      `<div class="progress-item">${player.name}: ${player.answer || "No answer"}</div>`
    ).join("");
    document.getElementById("player-answers").innerHTML = responses;
  }
});
