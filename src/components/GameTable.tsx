import React, { useMemo } from 'react';
import { GameState, AIAdvisorRecommendation, EquityResult, Card as CardType, ActionType } from '../types';
import { PlayerSeat } from './PlayerSeat';
import { PotDisplay } from './PotDisplay';
import { ActionPanel } from './ActionPanel';
import { CardView } from './CardView';
import './GameTable.css';

interface GameTableProps {
  gameState: GameState;
  validActions: ActionType[];
  onAct: (action: ActionType, amount?: number) => void;
  isHumanTurn: boolean;
  onNewHand: () => void;
  advisorRec: AIAdvisorRecommendation | null;
  equityResult: EquityResult | null;
  showEquity: boolean;
  showAdvisor: boolean;
}

function getSeatPositions(numPlayers: number, totalPlayers: number): { top: string; left: string }[] {
  const positions: { top: string; left: string }[] = [];

  if (totalPlayers === 2) {
    positions.push({ top: '85%', left: '50%' });  // Hero (bottom)
    positions.push({ top: '15%', left: '50%' });  // AI (top)
  } else if (totalPlayers === 4) {
    positions.push({ top: '85%', left: '50%' });  // Hero (bottom)
    positions.push({ top: '15%', left: '50%' });  // AI top
    positions.push({ top: '50%', left: '5%' });   // AI left
    positions.push({ top: '50%', left: '95%' });  // AI right
  } else if (totalPlayers === 6) {
    positions.push({ top: '85%', left: '50%' });  // Hero (bottom)
    positions.push({ top: '15%', left: '50%' });  // AI top
    positions.push({ top: '45%', left: '3%' });   // AI left
    positions.push({ top: '45%', left: '97%' });  // AI right
    positions.push({ top: '5%', left: '20%' });   // AI top-left
    positions.push({ top: '5%', left: '80%' });   // AI top-right
  }

  return positions;
}

export function GameTable({
  gameState,
  validActions,
  onAct,
  isHumanTurn,
  onNewHand,
  advisorRec,
  equityResult,
  showEquity,
  showAdvisor,
}: GameTableProps) {
  const { players, communityCards, pot, phase, message, dealerIndex, currentPlayerIndex } = gameState;

  const seatPositions = useMemo(
    () => getSeatPositions(players.length, players.length),
    [players.length]
  );

  const isShowdown = phase === 'showdown';
  const isIdle = phase === 'idle';

  return (
    <div className="game-table-wrapper">
      <div className="game-table">
        {/* Felt */}
        <div className="table-felt">
          {/* Inner ring */}
          <div className="table-inner">
            {/* Community cards */}
            <div className="board-cards">
              {communityCards.length === 0 && !isIdle && (
                <div className="board-empty">Deal pending...</div>
              )}
              {[0, 1, 2, 3, 4].map(i => (
                <CardView key={i} card={communityCards[i]} />
              ))}
            </div>

            {/* Pot */}
            <PotDisplay pot={pot} phase={phase} message={message} />

            {/* New hand button */}
            {(isShowdown || isIdle) && (
              <button className="new-hand-btn" onClick={onNewHand}>
                {isIdle ? 'Start Game' : 'Next Hand'}
              </button>
            )}
          </div>
        </div>

        {/* Player seats */}
        {players.map((player, i) => (
          <PlayerSeat
            key={player.id}
            player={player}
            position={seatPositions[i] || { top: '50%', left: '50%' }}
            isCurrentTurn={currentPlayerIndex === i && !isShowdown && !isIdle}
            phase={phase}
            isWinner={gameState.winner?.playerId === player.id || false}
            communityCards={communityCards}
          />
        ))}
      </div>

      {/* Action panel */}
      {!isIdle && (
        <ActionPanel
          validActions={validActions}
          onAct={onAct}
          chips={players[0]?.chips || 0}
          currentBet={currentPlayerIndex === 0 && players[0] ? players[0].currentBet : 0}
          bigBlind={gameState.bigBlind}
          minRaise={gameState.minRaise}
          isHumanTurn={isHumanTurn && !isShowdown}
          phase={phase}
          advisorRec={advisorRec}
          equityResult={equityResult}
          showEquity={showEquity}
          showAdvisor={showAdvisor}
          pot={pot}
        />
      )}
    </div>
  );
}
