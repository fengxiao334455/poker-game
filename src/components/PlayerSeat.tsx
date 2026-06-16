import React from 'react';
import { Player, GamePhase, Card as CardType } from '../types';
import { CardView } from './CardView';
import './PlayerSeat.css';

interface PlayerSeatProps {
  player: Player;
  position: { top: string; left: string };
  isCurrentTurn: boolean;
  phase: GamePhase;
  isWinner: boolean;
  communityCards: CardType[];
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = { h: '#e74c3c', d: '#e74c3c', c: '#2c3e50', s: '#2c3e50' };

function cardToStr(c: CardType): string {
  const rank = c.rank === 'T' ? '10' : c.rank;
  return `${rank}${SUIT_SYMBOLS[c.suit]}`;
}

export function PlayerSeat({ player, position, isCurrentTurn, phase, isWinner, communityCards }: PlayerSeatProps) {
  const isActive = player.status === 'active' || player.status === 'all_in';
  const showCards = (player.isHuman || phase === 'showdown' || player.status === 'folded') && player.holeCards;
  const showCardsFaceDown = !player.isHuman && phase !== 'showdown' && player.status !== 'folded' && player.holeCards;

  return (
    <div
      className={`player-seat ${isCurrentTurn ? 'active-turn' : ''} ${isWinner ? 'winner' : ''} ${player.isHuman ? 'human' : ''}`}
      style={{ top: position.top, left: position.left }}
    >
      <div className="seat-avatar">
        <span className="avatar-text">{player.isHuman ? '😎' : '🤖'}</span>
      </div>
      <div className="seat-info">
        <div className="seat-name">
          {player.name}
          {player.isDealer && <span className="dealer-chip">D</span>}
        </div>
        <div className="seat-chips">${player.chips}</div>
        <div className={`seat-status ${player.status}`}>
          {player.status === 'folded' ? 'FOLDED' : player.status === 'all_in' ? 'ALL-IN' : ''}
        </div>
      </div>

      {phase !== 'idle' && player.holeCards && (
        <div className="seat-cards">
          {showCards ? (
            <>
              <CardView card={player.holeCards[0]} />
              <CardView card={player.holeCards[1]} />
            </>
          ) : showCardsFaceDown ? (
            <>
              <CardView faceDown />
              <CardView faceDown />
            </>
          ) : null}
        </div>
      )}

      {player.currentBet > 0 && phase !== 'idle' && phase !== 'showdown' && (
        <div className="seat-bet">${player.currentBet}</div>
      )}
    </div>
  );
}
