
document.getElementById("join-btn").addEventListener("click", () => {
  const playerName = document.getElementById("player-name").value;
  const gameCode = document.getElementById("game-code").value.toUpperCase();
  if (!playerName || !gameCode) return alert("Enter name and game code.");

  const playerId = Math.random().toString(36).substr(2, 8);
  const playerRef = db.ref("games/" + gameCode + "/players/" + playerId);
  playerRef.set({
    name: playerName,
    answer: null,
    score: 0
  });

  document.getElementById("join-screen").classList.add("hidden");
  document.getElementById("player-area").classList.remove("hidden");

  db.ref("games/" + gameCode + "/currentQuestion").on("value", snapshot => {
    const q = snapshot.val();
    if (!q) return;

    document.getElementById("player-question-text").textContent = q.questionText;
    document.getElementById("player-options-list").innerHTML = q.options.map(opt => 
      `<button class="btn btn-secondary option-btn" data-answer="${opt}">${opt}</button>`
    ).join("");

    document.querySelectorAll(".option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        playerRef.update({ answer: btn.dataset.answer });
        document.getElementById("answer-feedback").textContent = "Answer submitted: " + btn.dataset.answer;
      });
    });
  });
});
