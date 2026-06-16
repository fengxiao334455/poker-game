import React from 'react';
import { Card } from '../types';
import { cardToString, cardColor, rankValue, getRankName, getSuitName } from '../engine/card';
import './CardView.css';

export function CardView({ card, faceDown }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <div className="card card-back">
        <div className="card-back-pattern">🎴</div>
      </div>
    );
  }

  const suitSymbol: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
  const color = cardColor(card);
  const symbol = suitSymbol[card.suit];
  const rank = card.rank === 'T' ? '10' : card.rank;

  return (
    <div className="card card-front" style={{ color }}>
      <div className="card-rank-top">{rank}</div>
      <div className="card-suit-center">{symbol}</div>
      <div className="card-rank-bottom">{rank}</div>
    </div>
  );
}
