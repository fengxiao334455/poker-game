import { Card, EquityResult } from '../types';
import { createDeck, shuffleDeck, cardsInclude } from './card';
import { evaluateHand, compareHands } from './evaluator';

export function calculateEquity(
  holeCards: [Card, Card],
  communityCards: Card[],
  numOpponents: number,
  iterations: number = 1000
): EquityResult {
  let wins = 0;
  let ties = 0;
  let total = 0;

  const knownCards = [...holeCards, ...communityCards];

  for (let i = 0; i < iterations; i++) {
    // Create deck excluding known cards
    const deck = shuffleDeck(createDeck()).filter(
      card => !knownCards.some(kc => kc.rank === card.rank && kc.suit === card.suit)
    );

    let deckIdx = 0;

    // Deal random hands to opponents
    const opponentHands: Card[][] = [];
    for (let o = 0; o < numOpponents; o++) {
      opponentHands.push([deck[deckIdx++], deck[deckIdx++]]);
    }

    // Deal remaining community cards
    const remainingBoard = [...communityCards];
    const neededCards = 5 - communityCards.length;
    for (let c = 0; c < neededCards && deckIdx < deck.length; c++) {
      remainingBoard.push(deck[deckIdx++]);
    }

    if (remainingBoard.length < 5) continue;

    // Evaluate
    const heroHand = evaluateHand(holeCards, remainingBoard);

    let bestOpponentRank = -1;
    let bestOpponentHand = null;
    for (const oppCards of opponentHands) {
      const oppHand = evaluateHand(oppCards, remainingBoard);
      if (oppHand.rank > bestOpponentRank) {
        bestOpponentRank = oppHand.rank;
        bestOpponentHand = oppHand;
      }
    }

    if (bestOpponentHand) {
      const result = compareHands(heroHand, bestOpponentHand);
      if (result > 0) wins++;
      else if (result === 0) ties++;
    } else {
      wins++;
    }

    total++;
  }

  return {
    win: wins / total,
    tie: ties / total,
    lose: 1 - (wins + ties) / total,
    equity: (wins + ties / numOpponents) / total
  };
}

export function getHandDescription(holeCards: [Card, Card]): string {
  const [c1, c2] = holeCards;
  const values = [c1.rank, c2.rank].sort((a, b) => {
    const order = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    return order.indexOf(b) - order.indexOf(a);
  });

  const suited = c1.suit === c2.suit ? 's' : 'o';
  const pair = c1.rank === c2.rank;

  if (pair) return `${values[0]}${values[0]}`;
  return `${values[0]}${values[1]}${suited}`;
}
