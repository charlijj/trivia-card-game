<?php
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    // Handle preflight OPTIONS request
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        exit(0);
    }

    // Game state file path
    $gameStateFile = '/tmp/card_game_state.json';

    // Initialize default game state
    function getDefaultGameState() {
        return [
            'gameId' => uniqid(),
            'players' => [],
            'currentPlayerIndex' => 0,
            'currentRound' => 1,
            'maxRounds' => 4,
            'gameState' => 'waiting', // waiting, playing, finished
            'roundProgress' => [],
            'lastActivity' => time()
        ];
    }

    // Load game state
    function loadGameState() {
        global $gameStateFile;
        if (file_exists($gameStateFile)) {
            $content = file_get_contents($gameStateFile);
            $state = json_decode($content, true);
            
            // Check if game is too old (1 hour timeout)
            if (time() - $state['lastActivity'] > 3600) {
                return getDefaultGameState();
            }
            
            return $state;
        }
        return getDefaultGameState();
    }

    // Save game state
    function saveGameState($state) {
        global $gameStateFile;
        $state['lastActivity'] = time();
        file_put_contents($gameStateFile, json_encode($state, JSON_PRETTY_PRINT));
    }

    // Handle different actions
    $action = $_GET['action'] ?? $_POST['action'] ?? 'status';

    switch ($action) {
        case 'status':
            echo json_encode(['success' => true, 'state' => loadGameState()]);
            break;
            
        case 'start':
            $input = json_decode(file_get_contents('php://input'), true);
            $playerCount = (int)($input['playerCount'] ?? 4);
            
            $state = getDefaultGameState();
            $state['gameState'] = 'playing';
            
            // Initialize players
            for ($i = 1; $i <= $playerCount; $i++) {
                $state['players'][] = [
                    'id' => $i,
                    'name' => "Player $i",
                    'score' => 0,
                    'cardsDrawn' => 0
                ];
            }
            
            // Initialize round progress
            for ($i = 1; $i <= $playerCount; $i++) {
                $state['roundProgress'][$i] = 0;
            }
            
            saveGameState($state);
            echo json_encode(['success' => true, 'state' => $state]);
            break;
            
        case 'draw_card':
            $state = loadGameState();
            
            if ($state['gameState'] !== 'playing') {
                echo json_encode(['success' => false, 'error' => 'Game not in playing state']);
                break;
            }
            
            // Load the appropriate deck
            $deckFile = "deck{$state['currentRound']}.json";
            if (!file_exists($deckFile)) {
                echo json_encode(['success' => false, 'error' => 'Deck file not found']);
                break;
            }
            
            $deck = json_decode(file_get_contents($deckFile), true);
            if (!$deck || !isset($deck['cards'])) {
                echo json_encode(['success' => false, 'error' => 'Invalid deck format']);
                break;
            }
            
            // Get a random card
            $cards = $deck['cards'];
            $randomCard = $cards[array_rand($cards)];
            
            echo json_encode(['success' => true, 'card' => $randomCard, 'state' => $state]);
            break;
            
        case 'card_result':
            $input = json_decode(file_get_contents('php://input'), true);
            $passed = $input['passed'] ?? false;
            
            $state = loadGameState();
            
            if ($state['gameState'] !== 'playing') {
                echo json_encode(['success' => false, 'error' => 'Game not in playing state']);
                break;
            }
            
            $currentPlayer = &$state['players'][$state['currentPlayerIndex']];
            
            // Update player stats
            if ($passed) {
                $currentPlayer['score']++;
            }
            $currentPlayer['cardsDrawn']++;
            $state['roundProgress'][$currentPlayer['id']]++;
            
            // Check if current player has drawn enough cards (2 per round)
            $cardsPerPlayerPerRound = 2;
            $allPlayersComplete = true;
            
            foreach ($state['players'] as $player) {
                if ($player['cardsDrawn'] < $cardsPerPlayerPerRound) {
                    $allPlayersComplete = false;
                    break;
                }
            }
            
            if ($allPlayersComplete) {
                // Move to next round
                $state['currentRound']++;
                $state['currentPlayerIndex'] = 0;
                
                // Reset cards drawn for all players
                foreach ($state['players'] as &$player) {
                    $player['cardsDrawn'] = 0;
                }
                
                // Reset round progress
                foreach ($state['roundProgress'] as $playerId => &$progress) {
                    $progress = 0;
                }
                
                // Check if game is over
                if ($state['currentRound'] > $state['maxRounds']) {
                    $state['gameState'] = 'finished';
                }
            } else {
                // Find next player who still needs to draw cards
                do {
                    $state['currentPlayerIndex'] = ($state['currentPlayerIndex'] + 1) % count($state['players']);
                } while ($state['players'][$state['currentPlayerIndex']]['cardsDrawn'] >= $cardsPerPlayerPerRound);
            }
            
            saveGameState($state);
            echo json_encode(['success' => true, 'state' => $state]);
            break;
            
        case 'reset':
            $state = getDefaultGameState();
            saveGameState($state);
            echo json_encode(['success' => true, 'state' => $state]);
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Unknown action']);
            break;
    }
?>