# 🧠 Custom Trivia Card Game

![Game Preview Banner](assets/game-banner-placeholder.png)

A dynamic, browser-based multiplayer trivia and challenge card game built with **HTML**, **CSS**, and **JavaScript**. Designed for 2–6 players, the game includes interactive rounds, animated card flips, engaging category challenges, and stylish transitions to keep users immersed.

---

## 🎮 Demo

![Gameplay Demo](assets/gameplay-gif-placeholder.gif)

> 🚀 Coming Soon: Live demo or link to hosted version (e.g. GitHub Pages, Vercel, Netlify)

---

## 🧩 Features

- 🎲 Supports 2 to 6 players
- 🧠 15+ unique challenge cards (JSON deck)
- 🕹️ 4 customizable rounds per game
- 🧾 Dynamic scoring and winner announcement
- 🧙‍♂️ Interactive animations and transitions
- 🔄 Responsive design for mobile and desktop
- 📦 Modular card deck system (`deck1.json`, `deck2.json`, …)

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5      | Markup structure |
| CSS3       | Game styling, transitions, UI/UX |
| JavaScript | Game logic, DOM manipulation |
| JSON       | Card deck data (expandable format) |
| PHP        | Optional backend logic (game.php placeholder) |

---

## 📁 Project Structure

```text
.
├── index.html         # Main game structure
├── script.js          # All core game logic
├── style.css          # Responsive visual design
├── deck1.json         # Sample trivia deck (modular format)
├── game.php           # Placeholder for future backend logic (optional)
└── assets/            # (Add assets here e.g. icons, images, fonts, etc.)
```

---

## 🚦 How to Play

1. 🔢 Select number of players (2–6).
2. 🎬 Click **Start Game**.
3. 🃏 Players take turns drawing cards.
4. ✅ Mark Pass or ✗ Fail based on challenge completion.
5. 📈 View scores any time.
6. 🏁 After 4 rounds, the winner is announced!

---

## 🧠 Sample Card Format (JSON)

```json
{
  "id": "challenge-1",
  "title": "The Memory Palace",
  "category": "Memory Challenge",
  "description": "Test your ability to memorize and recall information under pressure.",
  "challenge": "Look around the room for 30 seconds, then close your eyes and name 10 specific objects you saw."
}
```

✅ New decks can be added easily by extending the `deckFiles` array in `script.js`.

---

## 📸 Screenshots

> *(Replace the placeholders below with real images)*

### 🎴 Start Menu
![Start Menu](assets/screenshot-start-menu.png)

### 🕹️ Game In Progress
![Game Screen](assets/screenshot-game-screen.png)

### 🏆 Final Scores
![Game Over Screen](assets/screenshot-game-over.png)

---

## 🧪 Future Enhancements

- 🔄 Add timer-based challenges
- 🗂️ Category filtering or round themes
- 🌐 Multiplayer over network (using WebSockets or Firebase)
- 🎵 Background music and sound effects
- 💾 LocalStorage-based game state saving

---

## 📦 Installation (Local Development)

```bash
git clone https://github.com/your-username/custom-card-game.git
cd custom-card-game
# Open index.html in your browser
```

Alternatively, run a simple dev server:

```bash
# Python 3.x
python -m http.server
# or
# Node.js with live-server
npx live-server
```

---

## 🛠️ Developer Notes

- All UI transitions are CSS-based.
- DOM updates and game logic are written in **vanilla JS** (no frameworks).
- The game is structured in screens: `start-menu`, `game-screen`, and `game-over-screen`.
- Utility classes like `.hidden` manage visibility transitions cleanly.

---

## 👨‍💻 Contributing

Pull requests and improvements are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push to your fork and submit a PR

---
