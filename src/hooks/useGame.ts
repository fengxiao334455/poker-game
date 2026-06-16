import { useState, useCallback, useRef, useEffect } from 'react';
import { GameState, PlayerAction, ActionType, GameConfig } from '../types';
import { createInitialState, startNewHand, processAction, runAllAITurns, getValidActions } from '../engine/game';
import { getAdvisorRecommendation } from '../engine/ai';
import { calculateEquity } from '../engine/equity';
import { AIAdvisorRecommendation, EquityResult } from '../types';

export function useGame(config: GameConfig) {
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(config.numPlayers)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const [advisorRec, setAdvisorRec] = useState<AIAdvisorRecommendation | null>(null);
  const [equityResult, setEquityResult] = useState<EquityResult | null>(null);

  const startGame = useCallback(() => {
    const state = createInitialState(config.numPlayers);
    const newState = startNewHand(state);
    setGameState(newState);

    // Run AI pre-flop if human is not first
    setTimeout(() => {
      const afterAI = runAllAITurns(newState);
      setGameState(afterAI);
    }, 300);
  }, [config.numPlayers]);

  const act = useCallback((actionType: ActionType, amount?: number) => {
    setGameState(prev => {
      const player = prev.players[prev.currentPlayerIndex];
      if (!player?.isHuman || player.status !== 'active') return prev;

      let action: PlayerAction;
      const currentBet = prev.currentBet;
      const toCall = currentBet - player.currentBet;

      switch (actionType) {
        case 'fold':
          action = { playerId: player.id, action: 'fold', amount: 0 };
          break;
        case 'check':
          action = { playerId: player.id, action: 'check', amount: 0 };
          break;
        case 'call':
          action = { playerId: player.id, action: 'call', amount: toCall };
          break;
        case 'bet':
          action = { playerId: player.id, action: 'bet', amount: amount || prev.bigBlind };
          break;
        case 'raise':
          action = { playerId: player.id, action: 'raise', amount: amount || toCall + prev.minRaise };
          break;
        case 'all_in':
          action = { playerId: player.id, action: 'all_in', amount: player.chips };
          break;
        default:
          return prev;
      }

      let newState = processAction(prev, action);

      if (newState.phase !== 'showdown' && newState.phase !== 'idle') {
        // Run AI turns
        newState = runAllAITurns(newState);
      }

      return newState;
    });
  }, []);

  const startNewHand_ = useCallback(() => {
    setGameState(prev => {
      const newState = startNewHand(prev);
      // Schedule AI turns
      setTimeout(() => {
        setGameState(prev2 => {
          const afterAI = runAllAITurns(newState);
          return afterAI;
        });
      }, 300);
      return newState;
    });
    setAdvisorRec(null);
    setEquityResult(null);
  }, []);

  const validActions = getValidActions(gameState);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn = currentPlayer?.isHuman && currentPlayer?.status === 'active';
  const isGameOver = gameState.phase === 'idle';

  // Update advisor/equity when it's the human's turn
  useEffect(() => {
    if (isHumanTurn && gameState.phase !== 'idle' && gameState.phase !== 'showdown') {
      const humanPlayer = gameState.players[0];
      if (humanPlayer && humanPlayer.holeCards) {
        if (config.showAdvisor) {
          const rec = getAdvisorRecommendation(humanPlayer, gameState);
          setAdvisorRec(rec);
        } else {
          setAdvisorRec(null);
        }

        if (config.showEquity) {
          const activeCount = gameState.players.filter(
            p => p.status !== 'folded' && p.status !== 'out'
          ).length;
          const eq = calculateEquity(
            humanPlayer.holeCards,
            gameState.communityCards,
            activeCount - 1,
            500
          );
          setEquityResult(eq);
        } else {
          setEquityResult(null);
        }
      }
    }
  }, [gameState.currentPlayerIndex, gameState.phase, gameState.players, gameState.communityCards, config.showAdvisor, config.showEquity, isHumanTurn]);

  return {
    gameState,
    validActions,
    isHumanTurn,
    isGameOver,
    startGame,
    act,
    startNewHand: startNewHand_,
    advisorRec,
    equityResult,
  };
}
