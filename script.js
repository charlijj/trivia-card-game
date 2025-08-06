class CardGame {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.currentRound = 1;
        this.maxRounds = 4;
        this.cardsPerPlayerPerRound = 2;
        this.roundProgress = {};
        this.decks = {
            1: [],
            2: [],
            3: [],
            4: []
        };
        this.currentDeck = [];
        this.gameState = 'menu'; // menu, playing, gameOver
        
        this.init();
    }

    init() {
        this.loadDecks();
        this.setupEventListeners();
        this.showScreen('start-menu');
    }

    async loadDecks() {
        try {
            this.showLoading(true);
            
            // Load all deck files
            const deckFiles = ['deck1.json', 'deck2.json', 'deck3.json', 'deck4.json'];
            
            for (let i = 0; i < deckFiles.length; i++) {
                try {
                    const response = await fetch(deckFiles[i]);
                    if (response.ok) {
                        const deck = await response.json();
                        this.decks[i + 1] = deck.cards || [];
                    } else {
                        console.warn(`Could not load ${deckFiles[i]}, using fallback cards`);
                        this.decks[i + 1] = this.getFallbackCards(i + 1);
                    }
                } catch (error) {
                    console.warn(`Error loading ${deckFiles[i]}, using fallback:`, error);
                    this.decks[i + 1] = this.getFallbackCards(i + 1);
                }
            }
            
            this.showLoading(false);
        } catch (error) {
            console.error('Error loading decks:', error);
            this.loadFallbackDecks();
            this.showLoading(false);
        }
    }

    getFallbackCards(round) {
        const themes = [
            'Challenge', 'Skill Test', 'Knowledge', 'Creative Task'
        ];
        
        const cards = [];
        for (let i = 1; i <= 20; i++) {
            cards.push({
                id: `fallback-r${round}-${i}`,
                title: `${themes[round - 1]} Card ${i}`,
                category: themes[round - 1],
                description: `This is a ${themes[round - 1].toLowerCase()} card for round ${round}. Complete the task described below.`,
                challenge: `Sample challenge ${i} for round ${round}. This would contain the specific task or question for the player.`
            });
        }
        return cards;
    }

    loadFallbackDecks() {
        for (let round = 1; round <= 4; round++) {
            this.decks[round] = this.getFallbackCards(round);
        }
    }

    setupEventListeners() {
        // Start game
        document.getElementById('start-game').addEventListener('click', () => {
            this.startGame();
        });

        // Draw card
        document.getElementById('deck').addEventListener('click', () => {
            if (this.gameState === 'playing') {
                this.drawCard();
            }
        });

        // Card actions
        document.getElementById('pass-btn').addEventListener('click', () => {
            this.handleCardResult(true);
        });

        document.getElementById('fail-btn').addEventListener('click', () => {
            this.handleCardResult(false);
        });

        // Toggle scores
        document.getElementById('toggle-scores').addEventListener('click', () => {
            this.toggleScores();
        });

        // New game
        document.getElementById('new-game').addEventListener('click', () => {
            this.resetGame();
        });

        // Close scores panel when clicking outside
        document.getElementById('scores-panel').addEventListener('click', (e) => {
            if (e.target.id === 'scores-panel') {
                this.toggleScores();
            }
        });
    }

    startGame() {
        const playerCount = parseInt(document.getElementById('player-count').value);
        
        // Initialize players
        this.players = [];
        for (let i = 1; i <= playerCount; i++) {
            this.players.push({
                id: i,
                name: `Player ${i}`,
                score: 0,
                cardsDrawn: 0
            });
        }

        // Initialize round progress
        this.roundProgress = {};
        this.players.forEach(player => {
            this.roundProgress[player.id] = 0;
        });

        this.currentPlayerIndex = 0;
        this.currentRound = 1;
        this.gameState = 'playing';
        
        this.setupRound();
        this.showScreen('game-screen');
        this.updateUI();
    }

    setupRound() {
        // Shuffle the deck for current round
        this.currentDeck = [...this.decks[this.currentRound]];
        this.shuffleDeck();
        
        // Reset round progress
        this.players.forEach(player => {
            this.roundProgress[player.id] = 0;
            player.cardsDrawn = 0;
        });
        
        this.updateRoundInfo();
        this.updateProgressDisplay();
    }

    shuffleDeck() {
        for (let i = this.currentDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.currentDeck[i], this.currentDeck[j]] = [this.currentDeck[j], this.currentDeck[i]];
        }
    }

    drawCard() {
        if (this.currentDeck.length === 0) {
            alert('No more cards in deck!');
            return;
        }

        const card = this.currentDeck.pop();
        this.displayCard(card);
        
        // Hide deck temporarily
        document.getElementById('deck').style.visibility = 'hidden';
    }

    displayCard(card) {
        const cardElement = document.getElementById('drawn-card');
        
        document.getElementById('card-title').textContent = card.title;
        document.getElementById('card-category').textContent = card.category || 'Challenge';
        document.getElementById('card-description').textContent = card.description;
        document.getElementById('card-challenge').textContent = card.challenge || '';
        
        cardElement.classList.remove('hidden');
    }

    handleCardResult(passed) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        if (passed) {
            currentPlayer.score++;
        }
        
        currentPlayer.cardsDrawn++;
        this.roundProgress[currentPlayer.id]++;
        
        // Hide card and show deck
        document.getElementById('drawn-card').classList.add('hidden');
        document.getElementById('deck').style.visibility = 'visible';
        
        this.nextTurn();
    }

    nextTurn() {
        // Check if current player has drawn enough cards
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        if (currentPlayer.cardsDrawn >= this.cardsPerPlayerPerRound) {
            // Move to next player
            this.currentPlayerIndex++;
        }
        
        // Check if round is complete
        if (this.currentPlayerIndex >= this.players.length) {
            this.nextRound();
            return;
        }
        
        // Check if current player still needs to draw cards
        const nextPlayer = this.players[this.currentPlayerIndex];
        if (nextPlayer.cardsDrawn >= this.cardsPerPlayerPerRound) {
            this.nextTurn();
            return;
        }
        
        this.updateUI();
    }

    nextRound() {
        this.currentRound++;
        this.currentPlayerIndex = 0;
        
        if (this.currentRound > this.maxRounds) {
            this.endGame();
            return;
        }
        
        this.setupRound();
        this.updateUI();
    }

    endGame() {
        this.gameState = 'gameOver';
        this.displayFinalScores();
        this.showScreen('game-over-screen');
    }

    displayFinalScores() {
        const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);
        const finalScoresDiv = document.getElementById('final-scores');
        const winnerDiv = document.getElementById('winner-announcement');
        
        finalScoresDiv.innerHTML = '';
        sortedPlayers.forEach((player, index) => {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            scoreItem.innerHTML = `
                <h4>#${index + 1} ${player.name}</h4>
                <p>${player.score} points</p>
            `;
            finalScoresDiv.appendChild(scoreItem);
        });
        
        const winner = sortedPlayers[0];
        const winners = sortedPlayers.filter(p => p.score === winner.score);
        
        if (winners.length > 1) {
            winnerDiv.textContent = `It's a tie! ${winners.map(p => p.name).join(' and ')} win!`;
        } else {
            winnerDiv.textContent = `🎉 ${winner.name} wins with ${winner.score} points! 🎉`;
        }
    }

    updateUI() {
        // Update current player
        const currentPlayer = this.players[this.currentPlayerIndex];
        document.getElementById('current-player-name').textContent = currentPlayer.name;
        
        // Update scores
        this.updateScoresDisplay();
        
        // Update progress
        this.updateProgressDisplay();
    }

    updateRoundInfo() {
        document.getElementById('current-round').textContent = this.currentRound;
        
        const descriptions = {
            1: 'Challenge Round',
            2: 'Skill Test Round',
            3: 'Knowledge Round',
            4: 'Final Challenge Round'
        };
        
        document.getElementById('round-description').textContent = 
            descriptions[this.currentRound] || `Round ${this.currentRound}`;
    }

    updateScoresDisplay() {
        const scoresList = document.getElementById('scores-list');
        scoresList.innerHTML = '';
        
        this.players.forEach(player => {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            scoreItem.innerHTML = `
                <h4>${player.name}</h4>
                <p>${player.score} pts</p>
            `;
            scoresList.appendChild(scoreItem);
        });
    }

    updateProgressDisplay() {
        const progressList = document.getElementById('progress-list');
        progressList.innerHTML = '';
        
        this.players.forEach(player => {
            const progressItem = document.createElement('div');
            progressItem.className = `progress-item ${
                player.cardsDrawn >= this.cardsPerPlayerPerRound ? 'completed' : ''
            }`;
            progressItem.textContent = 
                `${player.name}: ${player.cardsDrawn}/${this.cardsPerPlayerPerRound} cards`;
            progressList.appendChild(progressItem);
        });
    }

    toggleScores() {
        const panel = document.getElementById('scores-panel');
        panel.classList.toggle('active');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    resetGame() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.currentRound = 1;
        this.roundProgress = {};
        this.gameState = 'menu';
        
        document.getElementById('drawn-card').classList.add('hidden');
        document.getElementById('deck').style.visibility = 'visible';
        document.getElementById('scores-panel').classList.remove('active');
        
        this.showScreen('start-menu');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CardGame();
});