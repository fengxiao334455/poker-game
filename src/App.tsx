import React, { useState, useCallback } from 'react';
import { GameConfig, ActionType } from './types';
import { SetupScreen } from './components/SetupScreen';
import { GameTable } from './components/GameTable';
import { useGame } from './hooks/useGame';
import './App.css';

export default function App() {
  const [config, setConfig] = useState<GameConfig>({
    numPlayers: 4,
    showEquity: true,
    showAdvisor: true,
  });
  const [gameStarted, setGameStarted] = useState(false);

  const game = useGame(config);

  const handleStart = useCallback(() => {
    setGameStarted(true);
    game.startGame();
  }, [game]);

  const handleBackToMenu = useCallback(() => {
    setGameStarted(false);
  }, []);

  if (!gameStarted) {
    return (
      <SetupScreen
        config={config}
        onConfigChange={setConfig}
        onStart={handleStart}
      />
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="app-header">
        <button className="menu-btn" onClick={handleBackToMenu}>
          ← Menu
        </button>
        <span className="app-title">♠ Texas Hold'em ♥</span>
        <div className="config-indicators">
          {config.showEquity && <span className="indicator">Equity</span>}
          {config.showAdvisor && <span className="indicator">Advisor</span>}
        </div>
      </div>

      {/* Game */}
      <GameTable
        gameState={game.gameState}
        validActions={game.validActions}
        onAct={game.act}
        isHumanTurn={game.isHumanTurn}
        onNewHand={game.startNewHand}
        advisorRec={game.advisorRec}
        equityResult={game.equityResult}
        showEquity={config.showEquity}
        showAdvisor={config.showAdvisor}
      />
    </div>
  );
}
