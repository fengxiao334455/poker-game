import { Card, HandStrength, HandCategory, Rank } from '../types';
import { RANK_VALUES, rankValue } from './card';

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandStrength {
  const allCards = [...holeCards, ...communityCards];
  const best = getBestHand(allCards);
  return best;
}

type RankCount = { rank: Rank; count: number; value: number };

function getBestHand(cards: Card[]): HandStrength {
  const combinations = getCombinations(cards, 5);
  let bestHand: HandStrength | null = null;

  for (const combo of combinations) {
    const hand = evaluate5Cards(combo);
    if (!bestHand || hand.rank > bestHand.rank) {
      bestHand = hand;
    }
  }

  return bestHand!;
}

function getCombinations(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];

  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);

  return [...withFirst, ...withoutFirst];
}

function evaluate5Cards(cards: Card[]): HandStrength {
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);

  const rankCounts = getRankCounts(values);
  const sortedByCount = [...rankCounts].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.value - a.value;
  });

  const counts = sortedByCount.map(r => r.count);
  const sortedValues = sortedByCount.map(r => r.value);

  // Royal Flush
  if (isFlush && isStraight && values[0] === 14 && values[1] === 13) {
    return { rank: 10, category: 'royal_flush', kickers: [], description: 'Royal Flush' };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    const highCard = isStraight === 14 && values[1] === 5 ? 5 : values[0];
    return {
      rank: 9,
      category: 'straight_flush',
      kickers: [highCard],
      description: `Straight Flush (${highCard} high)`
    };
  }

  // Four of a Kind
  if (counts[0] === 4) {
    return {
      rank: 8,
      category: 'four_of_a_kind',
      kickers: [sortedValues[0], sortedValues[1]],
      description: `Four of a Kind (${sortedValues[0]})`
    };
  }

  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return {
      rank: 7,
      category: 'full_house',
      kickers: [sortedValues[0], sortedValues[1]],
      description: `Full House (${sortedValues[0]} over ${sortedValues[1]})`
    };
  }

  // Flush
  if (isFlush) {
    return {
      rank: 6,
      category: 'flush',
      kickers: values,
      description: `Flush (${values[0]} high)`
    };
  }

  // Straight
  if (isStraight) {
    const highCard = isStraight === 14 && values[1] === 5 ? 5 : values[0];
    return {
      rank: 5,
      category: 'straight',
      kickers: [highCard],
      description: `Straight (${highCard} high)`
    };
  }

  // Three of a Kind
  if (counts[0] === 3) {
    return {
      rank: 4,
      category: 'three_of_a_kind',
      kickers: [sortedValues[0], ...sortedValues.slice(1)],
      description: `Three of a Kind (${sortedValues[0]})`
    };
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    return {
      rank: 3,
      category: 'two_pair',
      kickers: [sortedValues[0], sortedValues[1], sortedValues[2]],
      description: `Two Pair (${sortedValues[0]} and ${sortedValues[1]})`
    };
  }

  // One Pair
  if (counts[0] === 2) {
    return {
      rank: 2,
      category: 'pair',
      kickers: [sortedValues[0], ...sortedValues.slice(1)],
      description: `Pair (${sortedValues[0]})`
    };
  }

  // High Card
  return {
    rank: 1,
    category: 'high_card',
    kickers: values,
    description: `High Card (${values[0]})`
  };
}

function checkStraight(values: number[]): number | false {
  const unique = [...new Set(values)].sort((a, b) => b - a);

  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) return unique[0];
    // A-2-3-4-5 (wheel)
    if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      return 14; // Ace-high (but 5 high straight)
    }
  }
  return false;
}

function getRankCounts(values: number[]): { rank: Rank; count: number; value: number }[] {
  const countMap = new Map<number, number>();
  for (const v of values) {
    countMap.set(v, (countMap.get(v) || 0) + 1);
  }

  const rankByValue: Record<number, Rank> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
    8: '8', 9: '9', 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };

  return Array.from(countMap.entries()).map(([value, count]) => ({
    rank: rankByValue[value],
    count,
    value
  }));
}

export function compareHands(a: HandStrength, b: HandStrength): number {
  if (a.rank !== b.rank) return a.rank - b.rank;

  const maxLen = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < maxLen; i++) {
    const aKicker = a.kickers[i] || 0;
    const bKicker = b.kickers[i] || 0;
    if (aKicker !== bKicker) return aKicker - bKicker;
  }

  return 0;
}

export function getHandCategoryName(category: HandCategory): string {
  const names: Record<HandCategory, string> = {
    high_card: 'High Card',
    pair: 'Pair',
    two_pair: 'Two Pair',
    three_of_a_kind: 'Three of a Kind',
    straight: 'Straight',
    flush: 'Flush',
    full_house: 'Full House',
    four_of_a_kind: 'Four of a Kind',
    straight_flush: 'Straight Flush',
    royal_flush: 'Royal Flush'
  };
  return names[category];
}
