import { Card, Rank, Suit } from '../types';

const SUITS: Suit[] = ['h', 'd', 'c', 's'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const SUIT_SYMBOLS: Record<Suit, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠'
};

const SUIT_COLORS: Record<Suit, string> = {
  h: '#e74c3c', d: '#e74c3c', c: '#2c3e50', s: '#2c3e50'
};

export function createCard(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createCard(suit, rank));
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function rankValue(rank: Rank): number {
  return RANK_VALUES[rank];
}

export function cardRankValue(card: Card): number {
  return RANK_VALUES[card.rank];
}

export function cardToString(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardToShortString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardColor(card: Card): string {
  return SUIT_COLORS[card.suit];
}

export function isSuited(cards: [Card, Card]): boolean {
  return cards[0].suit === cards[1].suit;
}

export function isPair(cards: [Card, Card]): boolean {
  return cards[0].rank === cards[1].rank;
}

export function isConnected(cards: [Card, Card]): boolean {
  const diff = Math.abs(RANK_VALUES[cards[0].rank] - RANK_VALUES[cards[1].rank]);
  return diff === 1;
}

export function isOneGap(cards: [Card, Card]): boolean {
  const diff = Math.abs(RANK_VALUES[cards[0].rank] - RANK_VALUES[cards[1].rank]);
  return diff === 2;
}

export function getHighCard(cards: [Card, Card]): Card {
  return RANK_VALUES[cards[0].rank] >= RANK_VALUES[cards[1].rank] ? cards[0] : cards[1];
}

export function getLowCard(cards: [Card, Card]): Card {
  return RANK_VALUES[cards[0].rank] <= RANK_VALUES[cards[1].rank] ? cards[0] : cards[1];
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function cardsInclude(cards: Card[], card: Card): boolean {
  return cards.some(c => cardEquals(c, card));
}

export function getSuitName(suit: Suit): string {
  const names: Record<Suit, string> = {
    h: 'Hearts', d: 'Diamonds', c: 'Clubs', s: 'Spades'
  };
  return names[suit];
}

export function getRankName(rank: Rank): string {
  const names: Record<Rank, string> = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    '8': '8', '9': '9', 'T': '10', 'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
  };
  return names[rank];
}
