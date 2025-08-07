import { db } from './firebase-config.js';
import {
  ref,
  set,
  update,
  get,
  onValue,
  child,
  off,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

class TriviaGameHost {
  constructor() {
    this.gameCode = null;
    this.gameRef = null;
    this.deck = [];
    this.currentQuestionIndex = 0;
    this.timerInterval = null;
    this.timerSeconds = 30;
    this.gameState = 'lobby';
    this.players = {};
    this.listeners = [];
    this.questionStartTime = null;
    this.gameSettings = {
      questionTime: 30,
      totalQuestions: 10,
      pointsForCorrect: 100,
      pointsForSpeed: 50 // bonus points for quick answers
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadDeck();
  }

  bindEvents() {
    document.getElementById('create-game').addEventListener('click', () => this.createGame());
    document.getElementById('start-game').addEventListener('click', () => this.startGame());
    document.getElementById('next-question').addEventListener('click', () => this.nextQuestion());
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' && this.gameState === 'question') {
        e.preventDefault();
        this.nextQuestion();
      }
    });
  }

  async loadDeck() {
    try {
      const deckFiles = ['deck1.json'];
      const allCards = [];
      
      for (const file of deckFiles) {
        try {
          const response = await fetch(`../cards/round1/${file}`);
          if (response.ok) {
            const data = await response.json();
            allCards.push(...data.cards);
          }
        } catch (err) {
          console.warn(`Failed to load ${file}:`, err);
        }
      }
      
      if (allCards.length === 0) {
        // Fallback deck if files don't load
        allCards.push(...this.getFallbackDeck());
      }
      
      this.deck = this.shuffleArray(allCards).slice(0, this.gameSettings.totalQuestions);
      console.log(`Loaded ${this.deck.length} questions`);
    } catch (error) {
      console.error('Error loading deck:', error);
      this.deck = this.getFallbackDeck();
    }
  }

  getFallbackDeck() {
    return [
      {
        id: 'fallback-1',
        challenge: 'What is the capital of France?',
        correctAnswer: 'Paris',
        options: ['Paris', 'London', 'Berlin', 'Madrid']
      },
      {
        id: 'fallback-2',
        challenge: 'What is 2 + 2?',
        correctAnswer: '4',
        options: ['3', '4', '5', '6']
      }
    ];
  }

  async createGame() {
    try {
      this.gameCode = this.generateGameCode();
      document.getElementById('game-code').textContent = this.gameCode;
      this.gameRef = ref(db, 'games/' + this.gameCode);
      
      const gameData = {
        state: 'lobby',
        players: {},
        currentQuestion: null,
        questionHistory: [],
        createdAt: serverTimestamp(),
        hostId: this.generatePlayerId(),
        settings: this.gameSettings,
        totalQuestions: this.gameSettings.totalQuestions
      };

      await set(this.gameRef, gameData);
      
      // Set up real-time listeners
      this.setupListeners();
      
      // Show start button and hide create button
      document.getElementById('start-game').classList.remove('hidden');
      document.getElementById('create-game').disabled = true;
      document.getElementById('create-game').textContent = 'Game Created';
      
      this.showNotification('Game created successfully!', 'success');
    } catch (error) {
      console.error('Error creating game:', error);
      this.showNotification('Failed to create game. Please try again.', 'error');
    }
  }

  setupListeners() {
    // Listen for players joining/leaving
    const playersRef = ref(db, `games/${this.gameCode}/players`);
    const playersListener = onValue(playersRef, (snapshot) => {
      this.players = snapshot.val() || {};
      this.updatePlayerList();
      this.checkAllPlayersAnswered();
    });
    this.listeners.push({ ref: playersRef, listener: playersListener });

    // Listen for game state changes
    const gameStateRef = ref(db, `games/${this.gameCode}/state`);
    const stateListener = onValue(gameStateRef, (snapshot) => {
      this.gameState = snapshot.val();
    });
    this.listeners.push({ ref: gameStateRef, listener: stateListener });
  }

  updatePlayerList() {
    const playerCount = Object.keys(this.players).length;
    const playerList = Object.values(this.players)
      .map(player => `
        <div class="player-item">
          <span class="player-name">${this.escapeHtml(player.name)}</span>
          <span class="player-score">Score: ${player.score || 0}</span>
          ${this.gameState === 'question' ? this.getPlayerStatus(player) : ''}
        </div>
      `).join('');
    
    document.getElementById('lobby-player-list').innerHTML = `
      <div class="player-count">Players: ${playerCount}/8</div>
      ${playerList}
    `;

    // Enable/disable start button based on player count
    const startBtn = document.getElementById('start-game');
    if (playerCount >= 1 && this.gameState === 'lobby') {
      startBtn.disabled = false;
      startBtn.textContent = `Start Game (${playerCount} players)`;
    } else if (this.gameState === 'lobby') {
      startBtn.disabled = true;
      startBtn.textContent = 'Waiting for players...';
    }
  }

  getPlayerStatus(player) {
    if (player.answer !== null) {
      return '<span class="status answered">✓ Answered</span>';
    }
    return '<span class="status waiting">⏳ Thinking...</span>';
  }

  async startGame() {
    if (Object.keys(this.players).length === 0) {
      this.showNotification('Need at least 1 player to start!', 'error');
      return;
    }

    try {
      await update(this.gameRef, { state: 'starting' });
      
      // Hide lobby, show game
      document.getElementById('lobby-menu').classList.add('hidden');
      document.getElementById('game-area').classList.remove('hidden');
      
      // Start countdown
      this.showStartCountdown();
    } catch (error) {
      console.error('Error starting game:', error);
      this.showNotification('Failed to start game', 'error');
    }
  }

  showStartCountdown() {
    let countdown = 3;
    const countdownEl = document.createElement('div');
    countdownEl.className = 'countdown-overlay';
    countdownEl.innerHTML = `<div class="countdown-number">${countdown}</div>`;
    document.body.appendChild(countdownEl);

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        countdownEl.querySelector('.countdown-number').textContent = countdown;
      } else if (countdown === 0) {
        countdownEl.querySelector('.countdown-number').textContent = 'GO!';
      } else {
        clearInterval(countdownInterval);
        document.body.removeChild(countdownEl);
        this.loadNextQuestion();
      }
    }, 1000);
  }

  async loadNextQuestion() {
    if (this.currentQuestionIndex >= this.deck.length) {
      this.endGame();
      return;
    }

    const question = this.deck[this.currentQuestionIndex];
    this.questionStartTime = Date.now();

    // Generate options if not provided
    const options = question.options || this.generateOptions(question);
    const correctAnswer = question.correctAnswer || options[0];

    const questionData = {
      questionId: question.id,
      questionText: question.challenge,
      options: this.shuffleArray([...options]),
      correctAnswer: correctAnswer,
      isRevealed: false,
      startTime: this.questionStartTime,
      questionNumber: this.currentQuestionIndex + 1
    };

    try {
      // Update question and reset player answers
      await set(ref(db, `games/${this.gameCode}/currentQuestion`), questionData);
      await update(this.gameRef, { state: 'question' });
      
      // Reset all player answers
      const playerUpdates = {};
      Object.keys(this.players).forEach(playerId => {
        playerUpdates[`players/${playerId}/answer`] = null;
        playerUpdates[`players/${playerId}/answerTime`] = null;
      });
      await update(this.gameRef, playerUpdates);

      // Update UI
      this.updateQuestionUI(questionData);
      this.startTimer();

    } catch (error) {
      console.error('Error loading question:', error);
      this.showNotification('Error loading question', 'error');
    }
  }

  updateQuestionUI(questionData) {
    document.getElementById('question-text').textContent = questionData.questionText;
    document.getElementById('question-number').textContent = 
      `${questionData.questionNumber} / ${this.deck.length}`;
    
    const optionsHtml = questionData.options.map((option, index) => 
      `<div class="option-display" data-option="${this.escapeHtml(option)}">
        <span class="option-letter">${String.fromCharCode(65 + index)}</span>
        <span class="option-text">${this.escapeHtml(option)}</span>
      </div>`
    ).join('');
    
    document.getElementById('options-list').innerHTML = optionsHtml;
    
    // Reset player answers display
    document.getElementById('player-answers').innerHTML = 
      '<div class="waiting-for-answers">Waiting for player responses...</div>';
  }

  startTimer() {
    this.timerSeconds = this.gameSettings.questionTime;
    document.getElementById('question-timer').textContent = this.timerSeconds;
    
    this.timerInterval = setInterval(() => {
      this.timerSeconds--;
      const timerEl = document.getElementById('question-timer');
      timerEl.textContent = this.timerSeconds;
      
      // Add urgency styling
      if (this.timerSeconds <= 10) {
        timerEl.classList.add('urgent');
      } else {
        timerEl.classList.remove('urgent');
      }
      
      if (this.timerSeconds <= 0) {
        this.timeUp();
      }
    }, 1000);
  }

  timeUp() {
    clearInterval(this.timerInterval);
    this.revealAnswers();
  }

  checkAllPlayersAnswered() {
    if (this.gameState !== 'question') return;
    
    const playerList = Object.values(this.players);
    const allAnswered = playerList.length > 0 && 
      playerList.every(player => player.answer !== null);
    
    if (allAnswered && this.timerInterval) {
      clearInterval(this.timerInterval);
      setTimeout(() => this.revealAnswers(), 1000); // Short delay before revealing
    }
  }

  async revealAnswers() {
    try {
      const currentQuestion = await get(ref(db, `games/${this.gameCode}/currentQuestion`));
      const questionData = currentQuestion.val();
      
      if (!questionData) return;

      // Calculate scores and update players
      const scoreUpdates = {};
      const playerAnswers = [];

      Object.entries(this.players).forEach(([playerId, player]) => {
        const isCorrect = player.answer === questionData.correctAnswer;
        let pointsEarned = 0;

        if (isCorrect) {
          pointsEarned = this.gameSettings.pointsForCorrect;
          
          // Speed bonus
          if (player.answerTime && questionData.startTime) {
            const responseTime = (player.answerTime - questionData.startTime) / 1000;
            if (responseTime <= 10) { // Quick response bonus
              pointsEarned += Math.floor(this.gameSettings.pointsForSpeed * (1 - responseTime / 10));
            }
          }
        }

        const newScore = (player.score || 0) + pointsEarned;
        scoreUpdates[`players/${playerId}/score`] = newScore;
        
        playerAnswers.push({
          name: player.name,
          answer: player.answer || 'No answer',
          isCorrect,
          pointsEarned,
          totalScore: newScore
        });
      });

      // Update scores
      await update(this.gameRef, scoreUpdates);
      
      // Mark question as revealed
      await update(ref(db, `games/${this.gameCode}/currentQuestion`), { 
        isRevealed: true,
        correctAnswer: questionData.correctAnswer 
      });

      // Update UI
      this.displayResults(playerAnswers, questionData);
      
      this.currentQuestionIndex++;
      
      // Auto-advance after showing results
      setTimeout(() => {
        if (this.currentQuestionIndex < this.deck.length) {
          this.loadNextQuestion();
        } else {
          this.endGame();
        }
      }, 5000);

    } catch (error) {
      console.error('Error revealing answers:', error);
    }
  }

  displayResults(playerAnswers, questionData) {
    // Highlight correct answer
    document.querySelectorAll('.option-display').forEach(option => {
      if (option.dataset.option === questionData.correctAnswer) {
        option.classList.add('correct-answer');
      }
    });

    // Show player results
    const resultsHtml = playerAnswers
      .sort((a, b) => b.totalScore - a.totalScore)
      .map(player => `
        <div class="player-result ${player.isCorrect ? 'correct' : 'incorrect'}">
          <span class="player-name">${this.escapeHtml(player.name)}</span>
          <span class="player-answer">${this.escapeHtml(player.answer)}</span>
          <span class="points-earned">${player.isCorrect ? '✓' : '✗'} 
            ${player.pointsEarned > 0 ? `+${player.pointsEarned}` : '0'}</span>
          <span class="total-score">${player.totalScore}</span>
        </div>
      `).join('');

    document.getElementById('player-answers').innerHTML = `
      <h4>Results:</h4>
      <div class="correct-answer-display">
        Correct Answer: <strong>${this.escapeHtml(questionData.correctAnswer)}</strong>
      </div>
      ${resultsHtml}
    `;
  }

  nextQuestion() {
    clearInterval(this.timerInterval);
    if (this.currentQuestionIndex < this.deck.length) {
      this.loadNextQuestion();
    } else {
      this.endGame();
    }
  }

  async endGame() {
    try {
      await update(this.gameRef, { state: 'gameover', endTime: serverTimestamp() });
      
      const finalScores = Object.values(this.players)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      
      const winner = finalScores[0];
      
      // Update UI
      document.getElementById('question-text').textContent = 'Game Complete!';
      document.getElementById('options-list').innerHTML = `
        <div class="game-over-summary">
          <h3>🏆 Winner: ${this.escapeHtml(winner?.name || 'No one')}</h3>
          <div class="final-scores">
            ${finalScores.map((player, index) => `
              <div class="final-score-item">
                <span class="rank">#${index + 1}</span>
                <span class="name">${this.escapeHtml(player.name)}</span>
                <span class="score">${player.score || 0} points</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary" onclick="location.reload()">New Game</button>
        </div>
      `;
      
      document.getElementById('player-answers').innerHTML = '';
      clearInterval(this.timerInterval);
      
      // Clean up listeners
      this.cleanup();
      
    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  // Utility methods
  generateGameCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  generatePlayerId() {
    return Math.random().toString(36).substr(2, 8);
  }

  generateOptions(question) {
    // Simple option generation - can be enhanced based on question type
    if (question.challenge.toLowerCase().includes('capital')) {
      return ['Paris', 'London', 'Berlin', 'Madrid'];
    }
    return ['Option A', 'Option B', 'Option C', 'Option D'];
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  cleanup() {
    // Remove all Firebase listeners
    this.listeners.forEach(({ ref, listener }) => {
      off(ref, listener);
    });
    this.listeners = [];
    
    // Clear intervals
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TriviaGameHost();
});