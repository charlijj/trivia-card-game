import { db } from './firebase-config.js';
import {
  ref,
  set,
  update,
  get,
  onValue,
  off,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

class TriviaGamePlayer {
  constructor() {
    this.playerId = null;
    this.playerRef = null;
    this.gameCode = null;
    this.gameRef = null;
    this.playerName = '';
    this.currentScore = 0;
    this.gameState = 'lobby';
    this.listeners = [];
    this.hasAnswered = false;
    this.connectionLost = false;
    this.currentQuestion = null; // Track current question

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupConnectionMonitoring();
  }

  bindEvents() {
    document.getElementById('join-btn').addEventListener('click', () => this.joinGame());
    
    // Allow enter key to join
    document.getElementById('player-name').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });
    
    document.getElementById('game-code').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });

    // Auto-uppercase game code as user types
    document.getElementById('game-code').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });

    // Validate inputs in real-time
    this.setupInputValidation();
  }

  setupInputValidation() {
    const nameInput = document.getElementById('player-name');
    const codeInput = document.getElementById('game-code');
    const joinBtn = document.getElementById('join-btn');

    const validateInputs = () => {
      const name = nameInput.value.trim();
      const code = codeInput.value.trim();
      
      const isValidName = name.length >= 2 && name.length <= 20;
      const isValidCode = code.length === 6 && /^[A-Z0-9]+$/.test(code);
      
      joinBtn.disabled = !(isValidName && isValidCode);
      
      // Visual feedback
      nameInput.classList.toggle('invalid', name.length > 0 && !isValidName);
      codeInput.classList.toggle('invalid', code.length > 0 && !isValidCode);
    };

    nameInput.addEventListener('input', validateInputs);
    codeInput.addEventListener('input', validateInputs);
    
    // Initial validation
    validateInputs();
  }

  setupConnectionMonitoring() {
    // Monitor connection status
    window.addEventListener('online', () => {
      if (this.connectionLost) {
        this.connectionLost = false;
        this.showNotification('Connection restored', 'success');
        this.reconnectToGame();
      }
    });

    window.addEventListener('offline', () => {
      this.connectionLost = true;
      this.showNotification('Connection lost - trying to reconnect...', 'warning');
    });
  }

  async joinGame() {
    const playerName = document.getElementById('player-name').value.trim();
    const gameCode = document.getElementById('game-code').value.toUpperCase().trim();
    
    if (!this.validateInputs(playerName, gameCode)) {
      return;
    }

    this.setJoinButtonLoading(true);

    try {
      // Check if game exists and is joinable
      const gameSnapshot = await get(ref(db, `games/${gameCode}`));
      
      if (!gameSnapshot.exists()) {
        this.showNotification('Game not found. Check the game code.', 'error');
        this.setJoinButtonLoading(false);
        return;
      }

      const gameData = gameSnapshot.val();
      
      if (gameData.state !== 'lobby') {
        this.showNotification('Game has already started or ended.', 'error');
        this.setJoinButtonLoading(false);
        return;
      }

      // Check if name is already taken
      const players = gameData.players || {};
      const nameTaken = Object.values(players).some(player => 
        player.name.toLowerCase() === playerName.toLowerCase()
      );

      if (nameTaken) {
        this.showNotification('Name already taken. Please choose another.', 'error');
        this.setJoinButtonLoading(false);
        return;
      }

      // Check player limit
      const playerCount = Object.keys(players).length;
      if (playerCount >= 8) {
        this.showNotification('Game is full (maximum 8 players).', 'error');
        this.setJoinButtonLoading(false);
        return;
      }

      // Join the game
      await this.performJoin(playerName, gameCode);

    } catch (error) {
      console.error('Error joining game:', error);
      this.showNotification('Failed to join game. Please try again.', 'error');
      this.setJoinButtonLoading(false);
    }
  }

  async performJoin(playerName, gameCode) {
    this.playerId = this.generatePlayerId();
    this.gameCode = gameCode;
    this.playerName = playerName;
    this.gameRef = ref(db, `games/${gameCode}`);
    this.playerRef = ref(db, `games/${gameCode}/players/${this.playerId}`);

    const playerData = {
      name: playerName,
      answer: null,
      answerTime: null,
      score: 0,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      isConnected: true
    };

    await set(this.playerRef, playerData);

    // Set up heartbeat to show player is still connected
    this.startHeartbeat();

    // Setup game listeners
    this.setupGameListeners();

    // Switch to player area
    document.getElementById('join-screen').classList.add('hidden');
    document.getElementById('player-area').classList.remove('hidden');

    this.showNotification(`Welcome, ${playerName}!`, 'success');
    this.setJoinButtonLoading(false);
  }

  validateInputs(name, code) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      this.showNotification('Please enter a name (at least 2 characters).', 'error');
      return false;
    }

    if (name.trim().length > 20) {
      this.showNotification('Name must be 20 characters or less.', 'error');
      return false;
    }

    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      this.showNotification('Please enter a valid 6-character game code.', 'error');
      return false;
    }

    if (!/^[A-Z0-9]+$/.test(code.trim())) {
      this.showNotification('Game code can only contain letters and numbers.', 'error');
      return false;
    }

    return true;
  }

  startHeartbeat() {
    // Update last seen every 30 seconds to show player is still connected
    this.heartbeatInterval = setInterval(() => {
      if (!this.connectionLost && this.playerRef) {
        update(this.playerRef, { 
          lastSeen: serverTimestamp(),
          isConnected: true 
        }).catch(err => {
          console.warn('Heartbeat failed:', err);
        });
      }
    }, 30000);
  }

  setupGameListeners() {
    // Clear any existing listeners first
    this.cleanup();
    
    try {
      // CRITICAL FIX: Listen for game state changes
      const gameStateRef = ref(db, `games/${this.gameCode}/state`);
      const stateListener = onValue(gameStateRef, (snapshot) => {
        const newState = snapshot.val();
        console.log('Game state changed to:', newState);
        
        if (newState && newState !== this.gameState) {
          this.gameState = newState;
          this.handleGameStateChange();
        }
      }, (error) => {
        console.error('Game state listener error:', error);
        this.showNotification('Connection error. Trying to reconnect...', 'warning');
      });
      this.listeners.push({ ref: gameStateRef, listener: stateListener });

      // CRITICAL FIX: Listen for current question changes
      const questionRef = ref(db, `games/${this.gameCode}/currentQuestion`);
      const questionListener = onValue(questionRef, (snapshot) => {
        const question = snapshot.val();
        console.log('Question data received:', question);
        
        if (question && this.gameState === 'question') {
          this.currentQuestion = question;
          this.handleNewQuestion(question);
        }
      }, (error) => {
        console.error('Question listener error:', error);
      });
      this.listeners.push({ ref: questionRef, listener: questionListener });

      // Listen for players changes (for lobby display)
      const playersRef = ref(db, `games/${this.gameCode}/players`);
      const playersListener = onValue(playersRef, (snapshot) => {
        const players = snapshot.val() || {};
        
        if (this.gameState === 'lobby') {
          this.updateLobbyDisplay(players);
        }
        
        // Update current player's score
        if (players[this.playerId]) {
          this.currentScore = players[this.playerId].score || 0;
          this.updateScoreDisplay();
        }
      }, (error) => {
        console.error('Players listener error:', error);
      });
      this.listeners.push({ ref: playersRef, listener: playersListener });

    } catch (error) {
      console.error('Error setting up listeners:', error);
      this.showNotification('Failed to connect to game.', 'error');
    }
  }

  handleGameStateChange() {
    console.log('Handling game state change to:', this.gameState);
    const statusEl = document.getElementById('answer-feedback');
    
    switch(this.gameState) {
      case 'lobby':
        if (statusEl) {
          statusEl.textContent = 'Waiting for host to start the game...';
          statusEl.className = 'status-waiting';
        }
        break;
        
      case 'starting':
        if (statusEl) {
          statusEl.textContent = 'Game starting soon!';
          statusEl.className = 'status-starting';
        }
        this.showStartingAnimation();
        break;
        
      case 'question':
        if (statusEl) {
          statusEl.textContent = '';
          statusEl.className = '';
        }
        // If we have current question data, display it immediately
        if (this.currentQuestion) {
          this.handleNewQuestion(this.currentQuestion);
        }
        break;
        
      case 'gameover':
        this.handleGameOver();
        break;
    }
  }

  showStartingAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'starting-overlay';
    overlay.innerHTML = `
      <div class="starting-message">
        <h2>Get Ready!</h2>
        <div class="loading-spinner"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
    }, 3000);
  }

  handleNewQuestion(question) {
    console.log('Handling new question:', question);
    this.hasAnswered = false;
    
    // Reset UI
    document.getElementById('player-question-text').textContent = question.questionText;
    document.getElementById('player-question-number').textContent = question.questionNumber || '?';
    
    const feedbackEl = document.getElementById('answer-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = '';
      feedbackEl.className = '';
    }

    // Create answer options
    const optionsHtml = question.options.map(option => 
      `<button class="btn btn-secondary option-btn" 
              data-answer="${this.escapeHtml(option)}"
              ${question.isRevealed ? 'disabled' : ''}>
        ${this.escapeHtml(option)}
      </button>`
    ).join('');

    document.getElementById('player-options-list').innerHTML = optionsHtml;

    // If question is already revealed (player joined mid-question)
    if (question.isRevealed) {
      this.showQuestionResults(question);
      return;
    }

    // Bind click events to new buttons
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => this.submitAnswer(btn));
    });

    // Add visual timer if question has start time
    if (question.startTime) {
      this.startVisualTimer(question.startTime, question.timeLimit || 30);
    }
  }

  async submitAnswer(selectedBtn) {
    if (this.hasAnswered || this.gameState !== 'question') {
      console.log('Cannot submit answer:', { hasAnswered: this.hasAnswered, gameState: this.gameState });
      return;
    }

    const selectedAnswer = selectedBtn.dataset.answer;
    const answerTime = Date.now();

    // Set flag immediately to prevent double submission
    this.hasAnswered = true;
    selectedBtn.disabled = true;

    try {
      // Update player's answer in database
      await update(this.playerRef, { 
        answer: selectedAnswer,
        answerTime: answerTime
      });

      console.log('Answer submitted successfully:', selectedAnswer);

      // Update UI only after successful submission
      selectedBtn.classList.add('selected');
      
      // Disable all other buttons
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        if (btn !== selectedBtn) {
          btn.classList.add('disabled');
        }
      });

      // Show feedback
      const feedbackEl = document.getElementById('answer-feedback');
      if (feedbackEl) {
        feedbackEl.textContent = `✅ Answer submitted: ${selectedAnswer}`;
        feedbackEl.className = 'status-submitted';
      }

      selectedBtn.classList.add('submitted');

    } catch (error) {
      console.error('Error submitting answer:', error);
      this.hasAnswered = false; // Reset flag on error
      selectedBtn.disabled = false;
      this.showNotification('Failed to submit answer. Please try again.', 'error');
    }
  }

  startVisualTimer(startTime, timeLimit = 30) {
    const timerEl = document.getElementById('player-question-number');
    let timeLeft = timeLimit - Math.floor((Date.now() - startTime) / 1000);
    
    if (timeLeft <= 0) {
      if (timerEl) {
        timerEl.textContent = '⏰ Time\'s up!';
        timerEl.classList.add('times-up');
      }
      return;
    }

    // Clear any existing timer
    if (this.visualTimerInterval) {
      clearInterval(this.visualTimerInterval);
    }

    this.visualTimerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        if (timerEl) {
          timerEl.textContent = `⏱️ ${timeLeft}s`;
          
          // Add urgency styling
          if (timeLeft <= 10) {
            timerEl.classList.add('urgent');
          }
        }
      } else {
        clearInterval(this.visualTimerInterval);
        if (timerEl) {
          timerEl.textContent = '⏰ Time\'s up!';
          timerEl.classList.add('times-up');
        }
        
        // Disable all buttons if player hasn't answered
        if (!this.hasAnswered) {
          document.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = true;
          });
        }
      }
    }, 1000);
  }

  showQuestionResults(question) {
    // Highlight correct answer
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      
      if (btn.dataset.answer === question.correctAnswer) {
        btn.classList.add('correct-answer');
      }
    });

    // Show result feedback
    const feedbackEl = document.getElementById('answer-feedback');
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <div class="question-result">
          <strong>Correct Answer:</strong> ${this.escapeHtml(question.correctAnswer)}
        </div>
      `;
      feedbackEl.className = 'status-revealed';
    }
  }

  updateLobbyDisplay(players) {
    const playerList = Object.values(players);
    const lobbyInfo = document.getElementById('answer-feedback');
    
    if (lobbyInfo) {
      lobbyInfo.innerHTML = `
        <div class="lobby-info">
          <h3>Players in Lobby (${playerList.length}/8):</h3>
          <div class="player-list">
            ${playerList.map(player => `
              <div class="lobby-player ${player.name === this.playerName ? 'self' : ''}">
                ${this.escapeHtml(player.name)}
                ${player.name === this.playerName ? ' (You)' : ''}
              </div>
            `).join('')}
          </div>
          <p class="lobby-status">Waiting for host to start the game...</p>
        </div>
      `;
    }
  }

  updateScoreDisplay() {
    // Update score in the header or create a score display
    let scoreDisplay = document.getElementById('player-score');
    if (!scoreDisplay) {
      scoreDisplay = document.createElement('div');
      scoreDisplay.id = 'player-score';
      scoreDisplay.className = 'player-score-display';
      
      // Try to find game header to append to
      const gameHeader = document.querySelector('.game-header');
      if (gameHeader) {
        gameHeader.appendChild(scoreDisplay);
      }
    }
    
    scoreDisplay.innerHTML = `
      <span class="score-label">Your Score:</span>
      <span class="score-value">${this.currentScore}</span>
    `;
  }

  async handleGameOver() {
    try {
      // Get final scores
      const playersSnapshot = await get(ref(db, `games/${this.gameCode}/players`));
      const players = playersSnapshot.val() || {};
      
      const sortedPlayers = Object.values(players)
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      
      const playerRank = sortedPlayers.findIndex(p => p.name === this.playerName) + 1;
      const winner = sortedPlayers[0];
      
      // Show game over screen
      document.getElementById('player-question-text').textContent = 'Game Complete!';
      document.getElementById('player-options-list').innerHTML = `
        <div class="game-over-display">
          <h2>🏁 Final Results</h2>
          
          <div class="player-final-result">
            <h3>Your Performance</h3>
            <div class="final-rank">Rank: #${playerRank} of ${sortedPlayers.length}</div>
            <div class="final-score">Final Score: ${this.currentScore} points</div>
          </div>
          
          <div class="winner-announcement">
            🏆 Winner: <strong>${this.escapeHtml(winner?.name || 'No one')}</strong>
            <br>Score: ${winner?.score || 0} points
          </div>
          
          <div class="final-rankings">
            <h4>Final Rankings:</h4>
            ${sortedPlayers.slice(0, 5).map((player, index) => `
              <div class="ranking-item ${player.name === this.playerName ? 'self' : ''}">
                <span class="rank">#${index + 1}</span>
                <span class="name">${this.escapeHtml(player.name)}</span>
                <span class="score">${player.score || 0}</span>
              </div>
            `).join('')}
            ${sortedPlayers.length > 5 ? '<div class="more-players">...</div>' : ''}
          </div>
          
          <button class="btn btn-primary" onclick="location.reload()">
            Join Another Game
          </button>
        </div>
      `;
      
      const feedbackEl = document.getElementById('answer-feedback');
      if (feedbackEl) {
        feedbackEl.innerHTML = `
          <div class="game-complete-message">
            Thanks for playing! 🎉
          </div>
        `;
      }

      // Show celebration animation if player won
      if (playerRank === 1) {
        this.showWinnerAnimation();
      }

    } catch (error) {
      console.error('Error handling game over:', error);
      document.getElementById('player-question-text').textContent = 'Game ended';
      const feedbackEl = document.getElementById('answer-feedback');
      if (feedbackEl) {
        feedbackEl.textContent = 'Game completed!';
      }
    }
  }

  showWinnerAnimation() {
    const celebration = document.createElement('div');
    celebration.className = 'celebration-overlay';
    celebration.innerHTML = `
      <div class="celebration-content">
        <h1>🎉 CONGRATULATIONS! 🎉</h1>
        <h2>You Won!</h2>
        <div class="confetti"></div>
      </div>
    `;
    document.body.appendChild(celebration);

    // Create confetti effect
    this.createConfetti();

    setTimeout(() => {
      if (document.body.contains(celebration)) {
        document.body.removeChild(celebration);
      }
    }, 5000);
  }

  createConfetti() {
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 3 + 's';
      confetti.style.backgroundColor = this.getRandomColor();
      document.querySelector('.celebration-overlay').appendChild(confetti);
    }
  }

  getRandomColor() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  async reconnectToGame() {
    if (!this.gameCode || !this.playerId) return;

    try {
      // Update connection status
      await update(this.playerRef, {
        lastSeen: serverTimestamp(),
        isConnected: true
      });

      // Re-setup listeners if they were lost
      if (this.listeners.length === 0) {
        this.setupGameListeners();
      }

    } catch (error) {
      console.error('Error reconnecting:', error);
    }
  }

  setJoinButtonLoading(loading) {
    const btn = document.getElementById('join-btn');
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<span class="loading-spinner"></span> Joining...';
    } else {
      btn.disabled = false;
      btn.innerHTML = 'Join';
    }
  }

  // Utility methods
  generatePlayerId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${this.escapeHtml(message)}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  cleanup() {
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear visual timer
    if (this.visualTimerInterval) {
      clearInterval(this.visualTimerInterval);
      this.visualTimerInterval = null;
    }

    // Remove all Firebase listeners with error handling
    this.listeners.forEach(({ ref, listener }) => {
      try {
        off(ref, listener);
      } catch (error) {
        console.warn('Error removing listener:', error);
      }
    });
    this.listeners = [];

    // Update player status to disconnected
    if (this.playerRef) {
      update(this.playerRef, { 
        isConnected: false,
        lastSeen: serverTimestamp()
      }).catch(err => console.warn('Error updating disconnect status:', err));
    }
  }
  
  // Handle page unload
  beforeUnload() {
    this.cleanup();
  }
}

// Initialize the player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const player = new TriviaGamePlayer();
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    player.beforeUnload();
  });
  
  // Handle visibility change (mobile apps backgrounding)
  document.addEventListener('visibilitychange', () => {
    if (player.playerRef) {
      update(player.playerRef, {
        isConnected: !document.hidden,
        lastSeen: serverTimestamp()
      }).catch(err => console.warn('Error updating visibility status:', err));
    }
  });
});