import { Card, Player, GameState, ActionType, PlayerAction, AIAdvisorRecommendation, HandStrength, Suit, Rank } from '../types';
import { evaluateHand, compareHands, getHandCategoryName } from './evaluator';
import { rankValue, RANK_VALUES, createDeck } from './card';
import { calculateEquity } from './equity';

// ============================================================
// PRE-FLOP HAND RANGES (position-based, professional-level)
// ============================================================

type Position = 'UTG' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

function getPosition(numPlayers: number, playerIndex: number, dealerIndex: number): Position {
  const totalPlayers = numPlayers;
  const seatsFromDealer = (playerIndex - dealerIndex + totalPlayers) % totalPlayers;

  if (seatsFromDealer === 0) return 'BTN';   // Dealer
  if (seatsFromDealer === 1) return 'SB';    // Small Blind
  if (seatsFromDealer === 2) return 'BB';    // Big Blind

  if (totalPlayers === 2) {
    // HU: Dealer is SB, other is BB
    return seatsFromDealer === 0 ? 'BTN' : 'BB';
  }

  if (totalPlayers === 4) {
    if (seatsFromDealer === 3) return 'UTG'; // UTG in 4-max
    if (seatsFromDealer === 4 % totalPlayers) return 'MP';
  }

  if (totalPlayers === 6) {
    if (seatsFromDealer === 3) return 'UTG';
    if (seatsFromDealer === 4) return 'MP';
    if (seatsFromDealer === 5) return 'CO';
  }

  // Fallback
  if (seatsFromDealer <= 3) return 'UTG';
  if (seatsFromDealer <= Math.floor(totalPlayers / 2)) return 'MP';
  return 'CO';
}

// Hand range thresholds by position (minimum hand value to open)
const OPEN_RANGES: Record<Position, { pairs: number; suited: number; offsuit: number }> = {
  UTG: { pairs: 77, suited: RANK_VALUES['A'] * 10 + RANK_VALUES['T'], offsuit: RANK_VALUES['A'] * 10 + RANK_VALUES['Q'] },
  MP: { pairs: 55, suited: RANK_VALUES['A'] * 10 + RANK_VALUES['9'], offsuit: RANK_VALUES['A'] * 10 + RANK_VALUES['J'] },
  CO: { pairs: 22, suited: RANK_VALUES['A'] * 10 + RANK_VALUES['2'], offsuit: RANK_VALUES['A'] * 10 + RANK_VALUES['9'] },
  BTN: { pairs: 22, suited: 0, offsuit: RANK_VALUES['A'] * 10 + RANK_VALUES['2'] },
  SB: { pairs: 22, suited: 0, offsuit: RANK_VALUES['A'] * 10 + RANK_VALUES['5'] },
  BB: { pairs: 22, suited: 0, offsuit: RANK_VALUES['A'] * 10 + RANK_VALUES['2'] },
};

type HandValue = { primary: number; secondary: number; suited: boolean };

function getHandValue(cards: [Card, Card]): HandValue {
  const v1 = RANK_VALUES[cards[0].rank];
  const v2 = RANK_VALUES[cards[1].rank];
  const isSuited = cards[0].suit === cards[1].suit;
  const isPair = cards[0].rank === cards[1].rank;

  if (isPair) {
    return { primary: v1 * 100, secondary: 0, suited: true };
  }

  const high = Math.max(v1, v2);
  const low = Math.min(v1, v2);
  // Premium: AK = 1413, AQ = 1412, KQ = 1312, etc.
  return { primary: high * 10 + low, secondary: high - low, suited: isSuited };
}

function isPlayableHand(cards: [Card, Card], position: Position, isOpen: boolean): boolean {
  const hv = getHandValue(cards);

  // Always play premium hands
  if (hv.primary >= RANK_VALUES['A'] * 10 + RANK_VALUES['J']) return true;
  if (cards[0].rank === cards[1].rank && RANK_VALUES[cards[0].rank] >= RANK_VALUES['T']) return true;

  // Pairs
  if (cards[0].rank === cards[1].rank) {
    const pairValue = RANK_VALUES[cards[0].rank];
    const range = OPEN_RANGES[position];
    if (pairValue >= range.pairs) return true;
    // Small pairs can call raises if deep (set mining)
    if (!isOpen && pairValue >= 22) return true;
    return false;
  }

  const range = OPEN_RANGES[position];
  const rawValue = hv.primary;
  const gap = hv.secondary;

  if (hv.suited && rawValue >= range.suited) return true;
  if (!hv.suited && rawValue >= range.offsuit) return true;

  // Suited connectors / one-gappers (speculative hands)
  if (hv.suited && gap <= 2 && rawValue >= RANK_VALUES['T'] * 10 + RANK_VALUES['7']) return true;

  return false;
}

// ============================================================
// POST-FLOP HAND STRENGTH ASSESSMENT
// ============================================================

function assessHandStrength(holeCards: [Card, Card], communityCards: Card[]): number {
  if (communityCards.length === 0) return 0;
  const hand = evaluateHand(holeCards, communityCards);
  // Normalize to 0-1
  return hand.rank / 10;
}

function countOuts(holeCards: [Card, Card], communityCards: Card[]): number {
  if (communityCards.length < 3) return 0;

  let outs = 0;
  const hand = evaluateHand(holeCards, communityCards);
  const currentRank = hand.rank;

  const deck = createDeckWithout(holeCards, communityCards);

  for (const card of deck) {
    const testCards = [...communityCards, card];
    const testHand = evaluateHand(holeCards, testCards);
    if (testHand.rank > currentRank) {
      outs++;
    }
  }

  return outs;
}

function createDeckWithout(holeCards: Card[], communityCards: Card[]): Card[] {
  const deck = createDeck();
  const used = [...holeCards, ...communityCards];
  return deck.filter(c => !used.some(u => u.rank === c.rank && u.suit === c.suit));
}

function hasDraw(holeCards: [Card, Card], communityCards: Card[]): { flushDraw: boolean; straightDraw: boolean; openEnded: boolean } {
  if (communityCards.length < 3) return { flushDraw: false, straightDraw: false, openEnded: false };

  const allCards = [...holeCards, ...communityCards];

  // Flush draw: 4 of same suit
  const suitCounts: Record<string, number> = {};
  for (const c of allCards) {
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  }
  const flushDraw = Object.values(suitCounts).some(c => c === 4);

  // Straight draw
  const values = allCards.map(c => RANK_VALUES[c.rank]).sort((a, b) => a - b);
  const unique = [...new Set(values)];
  let straightDraw = false;
  let openEnded = false;

  // Check for open-ended or gutshot
  for (let i = 0; i <= unique.length - 4; i++) {
    const slice = unique.slice(i, i + 4);
    if (slice[3] - slice[0] === 3) {
      openEnded = true;
      straightDraw = true;
      break;
    }
    if (slice[3] - slice[0] === 4 || slice[3] - slice[0] === 5) {
      // Check if a single card completes it
      for (let gap = slice[0] + 1; gap < slice[3]; gap++) {
        if (!slice.includes(gap)) {
          straightDraw = true;
          break;
        }
      }
    }
  }

  return { flushDraw, straightDraw, openEnded };
}

// ============================================================
// MAIN AI DECISION MAKER
// ============================================================

export function makeAIDecision(
  player: Player,
  gameState: GameState
): PlayerAction {
  const { communityCards, currentBet, pot, bigBlind, players } = gameState;
  const holeCards = player.holeCards!;
  const activePlayers = players.filter(p => p.status === 'active' || p.status === 'all_in').length;
  const toCall = currentBet - player.currentBet;

  const position = getPosition(players.length, player.id, players[gameState.dealerIndex].id);
  const handStrength = assessHandStrength(holeCards, communityCards);
  const draws = hasDraw(holeCards, communityCards);
  const outs = countOuts(holeCards, communityCards);

  return getAction(player, toCall, pot, handStrength, draws, outs, position, communityCards, bigBlind, activePlayers, gameState, holeCards);
}

function getAction(
  player: Player,
  toCall: number,
  pot: number,
  handStrength: number,
  draws: { flushDraw: boolean; straightDraw: boolean; openEnded: boolean },
  outs: number,
  position: Position,
  communityCards: Card[],
  bigBlind: number,
  activePlayers: number,
  gameState: GameState,
  holeCards: [Card, Card]
): PlayerAction {
  const isPreFlop = communityCards.length === 0;
  const isPostFlop = communityCards.length >= 3;
  const effStack = player.chips;
  const SPR = effStack / Math.max(pot, 1); // Stack-to-Pot ratio

  // ===== PRE-FLOP STRATEGY =====
  if (isPreFlop) {
    return preFlopDecision(player, toCall, pot, position, bigBlind, holeCards, gameState);
  }

  // ===== POST-FLOP STRATEGY =====
  return postFlopDecision(player, toCall, pot, handStrength, draws, outs, position, communityCards, bigBlind, activePlayers, SPR, holeCards, gameState);
}

function preFlopDecision(
  player: Player,
  toCall: number,
  pot: number,
  position: Position,
  bigBlind: number,
  holeCards: [Card, Card],
  gameState: GameState
): PlayerAction {
  const hv = getHandValue(holeCards);
  const isPremium = hv.primary >= RANK_VALUES['A'] * 10 + RANK_VALUES['Q'] ||
    (holeCards[0].rank === holeCards[1].rank && RANK_VALUES[holeCards[0].rank] >= RANK_VALUES['J']);
  const isStrong = hv.primary >= RANK_VALUES['A'] * 10 + RANK_VALUES['T'] ||
    (holeCards[0].rank === holeCards[1].rank && RANK_VALUES[holeCards[0].rank] >= RANK_VALUES['T']);
  const isPair = holeCards[0].rank === holeCards[1].rank;

  const isOpenAction = toCall === 0;

  if (isOpenAction) {
    if (!isPlayableHand(holeCards, position, true)) {
      return { playerId: player.id, action: 'fold', amount: 0 };
    }

    // Raise with playable hands
    let raiseSize: number;
    if (isPremium) {
      raiseSize = Math.min(bigBlind * 3 + Math.floor(pot * 0.15), player.chips);
    } else {
      raiseSize = Math.min(bigBlind * 2.5, player.chips);
    }

    // Mix in some limps
    if (!isPair && !isPremium && Math.random() < 0.3) {
      return { playerId: player.id, action: 'check', amount: 0 };
    }

    return { playerId: player.id, action: 'bet', amount: raiseSize };
  }

  // Facing a raise
  const potOdds = toCall / (pot + toCall);

  if (isPremium) {
    // 3-bet with premiums
    const threeBetSize = Math.min(toCall * 3 + bigBlind, player.chips);
    return { playerId: player.id, action: 'raise', amount: threeBetSize };
  }

  if (isStrong && potOdds < 0.4) {
    return { playerId: player.id, action: 'call', amount: toCall };
  }

  // Call with pairs (set mining)
  if (isPair && toCall <= bigBlind * 3 && (player.chips / bigBlind) >= 20) {
    if (RANK_VALUES[holeCards[0].rank] >= RANK_VALUES['5']) {
      return { playerId: player.id, action: 'call', amount: toCall };
    }
  }

  // Call with suited connectors if good price
  if (hv.suited && hv.secondary <= 2 && potOdds < 0.25 && hv.primary >= RANK_VALUES['T'] * 10 + RANK_VALUES['8']) {
    return { playerId: player.id, action: 'call', amount: toCall };
  }

  // Fold everything else
  return { playerId: player.id, action: 'fold', amount: 0 };
}

function postFlopDecision(
  player: Player,
  toCall: number,
  pot: number,
  handStrength: number,
  draws: { flushDraw: boolean; straightDraw: boolean; openEnded: boolean },
  outs: number,
  position: Position,
  communityCards: Card[],
  bigBlind: number,
  activePlayers: number,
  SPR: number,
  holeCards: [Card, Card],
  gameState: GameState
): PlayerAction {
  const isOpenAction = toCall === 0;
  const isInPosition = position === 'BTN' || position === 'CO';
  const hasDrawHand = draws.flushDraw || draws.openEnded;
  const isWeakDraw = draws.straightDraw && !draws.openEnded;

  // Hand category
  const hand = evaluateHand(holeCards, communityCards);
  const isTopPair = hand.category === 'pair' && hand.kickers[0] >= RANK_VALUES['T'] && hand.kickers.length >= 2 &&
    hand.kickers[0] === Math.max(...communityCards.map(c => RANK_VALUES[c.rank]));
  const isOverPair = hand.category === 'pair' && hand.kickers[0] > Math.max(...communityCards.map(c => RANK_VALUES[c.rank]));
  const isTripsPlus = hand.rank >= 4; // Three of a kind or better
  const isSecondPair = hand.category === 'pair';

  // Equity calculation for close decisions
  let equity = 0;
  if (isOpenAction && (hasDrawHand || isWeakDraw)) {
    // Rough equity based on outs
    const approxOuts = outs || (draws.flushDraw ? 9 : draws.openEnded ? 8 : 4);
    const cardsToCome = communityCards.length === 3 ? 2 : 1;
    equity = approxOuts * 2 * cardsToCome / 100;
  }

  // ====== BETTING / RAISING DECISIONS ======

  if (isOpenAction) {
    // Strong hands - value bet
    if (isTripsPlus || isOverPair || isTopPair) {
      let betSize: number;
      if (isTripsPlus) {
        // Value bet with strong hands
        if (SPR > 10) betSize = Math.min(pot * 0.75, player.chips);
        else if (SPR > 3) betSize = Math.min(pot * 0.66, player.chips);
        else betSize = Math.min(pot * 0.5, player.chips);
      } else if (isOverPair) {
        betSize = Math.min(pot * 0.75, player.chips);
      } else {
        betSize = Math.min(pot * 0.66, player.chips);
      }
      return { playerId: player.id, action: 'bet', amount: Math.max(betSize, bigBlind) };
    }

    // Strong draws - semi-bluff
    if (hasDrawHand && (equity > 0.3 || draws.flushDraw)) {
      // Semi-bluff with strong draws
      if (Math.random() < 0.5) {
        const betSize = Math.min(pot * 0.66, player.chips);
        return { playerId: player.id, action: 'bet', amount: Math.max(betSize, bigBlind) };
      }
    }

    // Marginal hand - check for pot control
    if (isSecondPair || hand.category === 'two_pair') {
      // Check most of the time
      if (Math.random() < 0.7) {
        return { playerId: player.id, action: 'check', amount: 0 };
      }
      // Sometimes bet for protection
      const betSize = Math.min(pot * 0.5, player.chips);
      return { playerId: player.id, action: 'bet', amount: Math.max(betSize, bigBlind) };
    }

    // Bluff on scary boards
    if (!hasDrawHand && hand.rank <= 2) {
      // Check if board is scary for opponents
      const bluffFrequency = isInPosition ? 0.25 : 0.15;
      if (Math.random() < bluffFrequency && activePlayers <= 2) {
        const betSize = Math.min(pot * 0.5, player.chips);
        return { playerId: player.id, action: 'bet', amount: Math.max(betSize, bigBlind) };
      }
    }

    // Continuation bet on dry boards
    if (communityCards.length === 3) {
      const isDryBoard = communityCards.every(c => {
        const v = RANK_VALUES[c.rank];
        return v < RANK_VALUES['J'] && v > RANK_VALUES['6'];
      });
      if (isDryBoard && Math.random() < 0.4) {
        const betSize = Math.min(pot * 0.33, player.chips);
        return { playerId: player.id, action: 'bet', amount: Math.max(betSize, bigBlind) };
      }
    }

    return { playerId: player.id, action: 'check', amount: 0 };
  }

  // ====== FACING A BET ======

  const potOdds = toCall / (pot + toCall);

  // Nut hands - raise
  if (isTripsPlus) {
    const raiseSize = Math.min(pot * (isTripsPlus ? 0.8 : 0.6) + toCall, player.chips);
    return { playerId: player.id, action: 'raise', amount: Math.max(raiseSize, toCall * 2) };
  }

  // Top pair / overpair - call most of the time, raise sometimes
  if (isOverPair || isTopPair) {
    if (potOdds < 0.5) {
      if (Math.random() < 0.2) {
        const raiseSize = Math.min(pot * 0.7 + toCall, player.chips);
        return { playerId: player.id, action: 'raise', amount: Math.max(raiseSize, toCall * 2) };
      }
      return { playerId: player.id, action: 'call', amount: toCall };
    }
    // Facing large bet, call cautiously
    return { playerId: player.id, action: 'call', amount: toCall };
  }

  // Strong draws - call or raise
  if (hasDrawHand) {
    if (potOdds < equity + 0.05 || potOdds < 0.3) {
      if (draws.flushDraw && Math.random() < 0.3) {
        // Check-raise semi-bluff
        const raiseSize = Math.min(pot * 0.75 + toCall, player.chips);
        return { playerId: player.id, action: 'raise', amount: Math.max(raiseSize, toCall * 2) };
      }
      return { playerId: player.id, action: 'call', amount: toCall };
    }
    // Fold if pot odds don't justify
    return { playerId: player.id, action: 'fold', amount: 0 };
  }

  // Marginal hand - call if good price
  if (isSecondPair || hand.category === 'two_pair') {
    if (potOdds < 0.25) {
      return { playerId: player.id, action: 'call', amount: toCall };
    }
    return { playerId: player.id, action: 'fold', amount: 0 };
  }

  // High card / weak hand
  // Bluff raise occasionally
  if (Math.random() < 0.08 && activePlayers <= 2) {
    const raiseSize = Math.min(pot * 0.6 + toCall, player.chips);
    return { playerId: player.id, action: 'raise', amount: Math.max(raiseSize, toCall * 2) };
  }

  // Fold if no hand, no draw, bad pot odds
  return { playerId: player.id, action: 'fold', amount: 0 };
}

// ============================================================
// AI ADVISOR - for the player to see recommendations
// ============================================================

export function getAdvisorRecommendation(
  player: Player,
  gameState: GameState
): AIAdvisorRecommendation {
  const { communityCards, currentBet, pot, bigBlind, players, dealerIndex } = gameState;
  const holeCards = player.holeCards!;
  const toCall = currentBet - player.currentBet;
  const activePlayers = players.filter(p => p.status === 'active' || p.status === 'all_in').length;

  const position = getPosition(players.length, player.id, dealerIndex);
  const hand = evaluateHand(holeCards, communityCards);
  const draws = hasDraw(holeCards, communityCards);
  const outs = countOuts(holeCards, communityCards);

  // Equity for advice
  const equityResult = calculateEquity(holeCards, communityCards, activePlayers - 1, 500);
  const equityPct = Math.round(equityResult.equity * 100);

  const isPreFlop = communityCards.length === 0;
  const isOpenAction = toCall === 0;

  const potOdds = !isOpenAction ? toCall / (pot + toCall) : 0;
  const potOddsPct = Math.round(potOdds * 100);

  const positionNames: Record<Position, string> = {
    UTG: 'UTG (early)',
    MP: 'MP (middle)',
    CO: 'Cutoff (late)',
    BTN: 'Button (late)',
    SB: 'Small Blind',
    BB: 'Big Blind'
  };

  // Build reasoning and recommendation
  const handDesc = getHandCategoryName(hand.category);
  const handDetail = hand.kickers.length > 0
    ? `${handDesc} (kickers: ${hand.kickers.join(', ')})`
    : handDesc;

  let action: ActionType;
  let amount: number | null = null;
  let reasoning: string;
  let confidence: 'high' | 'medium' | 'low';

  if (isPreFlop) {
    const hv = getHandValue(holeCards);
    const isPremium = hv.primary >= RANK_VALUES['A'] * 10 + RANK_VALUES['Q'] ||
      (holeCards[0].rank === holeCards[1].rank && RANK_VALUES[holeCards[0].rank] >= RANK_VALUES['J']);
    const isPlayable = isPlayableHand(holeCards, position, isOpenAction);

    if (isOpenAction) {
      if (isPremium) {
        action = 'raise';
        amount = Math.min(bigBlind * 3, player.chips);
        confidence = 'high';
        reasoning = `Premium hand [${handDesc}] in ${positionNames[position]}. Standard raise to ${amount} (3x BB).`;
      } else if (isPlayable) {
        action = 'raise';
        amount = Math.min(bigBlind * 2.5, player.chips);
        confidence = 'medium';
        reasoning = `Playable hand in ${positionNames[position]}. Open raise to ${amount}.`;
      } else {
        action = 'fold';
        confidence = 'high';
        reasoning = `Weak hand in ${positionNames[position]}. Fold pre-flop.`;
      }
    } else {
      if (isPremium) {
        action = 'raise';
        amount = Math.min(toCall * 3 + bigBlind, player.chips);
        confidence = 'high';
        reasoning = `Premium hand facing a raise. 3-bet to ${amount}.`;
      } else if (isPlayable && potOdds < 0.3) {
        action = 'call';
        amount = toCall;
        confidence = 'medium';
        reasoning = `${handDesc} with good pot odds (${potOddsPct}%). Call the raise. Position: ${positionNames[position]}.`;
      } else {
        action = 'fold';
        confidence = 'high';
        reasoning = `Hand too weak to continue facing a raise in ${positionNames[position]} (pot odds: ${potOddsPct}%).`;
      }
    }
  } else {
    // Post-flop
    const isStrong = hand.rank >= 5; // Straight or better
    const isTopPair = hand.category === 'pair' && hand.kickers[0] >= RANK_VALUES['T'];
    const isOverPair = hand.category === 'pair' && hand.kickers[0] > Math.max(...communityCards.map(c => RANK_VALUES[c.rank]));
    const isValueHand = isStrong || isOverPair || isTopPair || hand.category === 'two_pair' || hand.category === 'three_of_a_kind';
    const hasDrawHand = draws.flushDraw || draws.openEnded;

    if (isOpenAction) {
      if (isValueHand) {
        const betSize = Math.min(pot * 0.7, player.chips);
        action = 'bet';
        amount = Math.max(betSize, bigBlind);
        confidence = 'high';
        reasoning = `Value hand: ${handDetail}. Equity ~${equityPct}%. Bet ~70% pot for value. Position: ${positionNames[position]}.`;
      } else if (hasDrawHand) {
        const betSize = Math.min(pot * 0.5, player.chips);
        action = 'bet';
        amount = Math.max(betSize, bigBlind);
        confidence = 'medium';
        const drawType = draws.flushDraw ? 'flush draw' : 'open-ended straight draw';
        reasoning = `Semi-bluff with ${drawType} (~${outs} outs, equity ~${equityPct}%). Bet ~½ pot. Position: ${positionNames[position]}.`;
      } else if (hand.rank <= 2) {
        // Weak hand, consider bluff
        if (Math.random() < 0.3 && activePlayers <= 2) {
          const betSize = Math.min(pot * 0.5, player.chips);
          action = 'bet';
          amount = Math.max(betSize, bigBlind);
          confidence = 'low';
          reasoning = `Bluff: weak hand but board may miss opponents. Bet ~½ pot. Position: ${positionNames[position]}. Confidence: LOW.`;
        } else {
          action = 'check';
          confidence = 'high';
          reasoning = `Weak hand (${handDetail}, equity ~${equityPct}%). Check and see free card. Position: ${positionNames[position]}.`;
        }
      } else {
        action = 'check';
        confidence = 'medium';
        reasoning = `Marginal hand (${handDetail}). Check for pot control. Equity ~${equityPct}%. Position: ${positionNames[position]}.`;
      }
    } else {
      // Facing a bet
      if (isValueHand) {
        if (potOdds < 0.5) {
          action = 'call';
          amount = toCall;
          confidence = 'high';
          reasoning = `Strong hand (${handDetail}). Pot odds: ${potOddsPct}%, equity ~${equityPct}%. Call is profitable. Position: ${positionNames[position]}.`;
        } else {
          action = 'call';
          amount = toCall;
          confidence = 'medium';
          reasoning = `Value hand but facing large bet (${potOddsPct}% pot odds). Call cautiously.`;
        }
      } else if (hasDrawHand) {
        if (potOdds < equityPct / 100 + 0.05) {
          action = 'call';
          amount = toCall;
          confidence = 'medium';
          const drawType = draws.flushDraw ? 'flush draw' : draws.openEnded ? 'open-ended straight draw' : 'draw';
          reasoning = `Drawing hand (${drawType}, ${outs} outs, equity ~${equityPct}%). Pot odds: ${potOddsPct}% — profitable call.`;
        } else {
          action = 'fold';
          confidence = 'high';
          reasoning = `Draw doesn't justify price (${potOddsPct}% > equity ${equityPct}%). Fold.`;
        }
      } else {
        if (potOdds < 0.2 && hand.rank >= 2) {
          action = 'call';
          amount = toCall;
          confidence = 'low';
          reasoning = `Weak hand but getting good price (${potOddsPct}% pot odds). Marginal call. Equity ~${equityPct}%.`;
        } else {
          action = 'fold';
          confidence = 'high';
          reasoning = `Weak hand (${handDetail}), no draw, pot odds unfavorable (${potOddsPct}% > equity ${equityPct}%). Fold. Position: ${positionNames[position]}.`;
        }
      }
    }
  }

  return { action, amount, reasoning, confidence };
}
