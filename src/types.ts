export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type GamePhase = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in';
export type PlayerStatus = 'active' | 'folded' | 'all_in' | 'out';

export interface Player {
  id: number;
  name: string;
  chips: number;
  holeCards: [Card, Card] | null;
  status: PlayerStatus;
  currentBet: number;
  totalBet: number;
  isHuman: boolean;
  isDealer: boolean;
  position: number;
}

export interface PlayerAction {
  playerId: number;
  action: ActionType;
  amount: number;
}

export interface GameState {
  players: Player[];
  communityCards: Card[];
  deck: Card[];
  pot: number;
  sidePots: { amount: number; eligiblePlayers: number[] }[];
  currentPlayerIndex: number;
  dealerIndex: number;
  phase: GamePhase;
  lastAction: PlayerAction | null;
  actionHistory: PlayerAction[];
  minRaise: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  handCount: number;
  winner: { playerId: number; hand: string; handRank: number } | null;
  message: string;
}

export type HandCategory =
  | 'high_card'
  | 'pair'
  | 'two_pair'
  | 'three_of_a_kind'
  | 'straight'
  | 'flush'
  | 'full_house'
  | 'four_of_a_kind'
  | 'straight_flush'
  | 'royal_flush';

export interface HandStrength {
  rank: number;
  category: HandCategory;
  kickers: number[];
  description: string;
}

export interface AIAdvisorRecommendation {
  action: ActionType;
  amount: number | null;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EquityResult {
  win: number;
  tie: number;
  lose: number;
  equity: number;
}

export type GameConfig = {
  numPlayers: 2 | 4 | 6;
  showEquity: boolean;
  showAdvisor: boolean;
};
