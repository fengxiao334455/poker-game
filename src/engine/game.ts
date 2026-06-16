import { Card, GameState, Player, PlayerAction, ActionType, GamePhase, PlayerStatus } from '../types';
import { createDeck, shuffleDeck } from './card';
import { evaluateHand, compareHands, getHandCategoryName } from './evaluator';
import { makeAIDecision } from './ai';

export function createInitialState(numPlayers: number): GameState {
  const players: Player[] = [];

  // 0 = human, rest are AI
  const names = ['You', 'AI-Alpha', 'AI-Beta', 'AI-Gamma', 'AI-Delta', 'AI-Epsilon'];

  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: i,
      name: names[i] || `AI-${i}`,
      chips: 1000,
      holeCards: null,
      status: 'active',
      currentBet: 0,
      totalBet: 0,
      isHuman: i === 0,
      isDealer: false,
      position: i,
    });
  }

  return {
    players,
    communityCards: [],
    deck: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: 0,
    dealerIndex: 0,
    phase: 'idle',
    lastAction: null,
    actionHistory: [],
    minRaise: 10,
    currentBet: 0,
    smallBlind: 5,
    bigBlind: 10,
    handCount: 0,
    winner: null,
    message: '',
  };
}

export function startNewHand(state: GameState): GameState {
  // Remove busted players
  let players = state.players.filter(p => p.chips > 0);
  if (players.length < 2) {
    return { ...state, message: 'Game over - not enough players!', phase: 'idle' };
  }

  // Reset players for new hand
  players = players.map((p, i) => ({
    ...p,
    holeCards: null,
    status: 'active' as PlayerStatus,
    currentBet: 0,
    totalBet: 0,
    isDealer: false,
  }));

  // Rotate dealer
  const newDealerIndex = state.handCount === 0
    ? 0
    : (state.dealerIndex + 1) % players.length;

  players[newDealerIndex].isDealer = true;

  const deck = shuffleDeck(createDeck());
  let deckIdx = 0;

  // Deal hole cards
  players = players.map(p => ({
    ...p,
    holeCards: [deck[deckIdx++], deck[deckIdx++]] as [Card, Card],
  }));

  // Determine blind positions
  const numPlayers = players.length;
  const sbIdx = (newDealerIndex + 1) % numPlayers;
  const bbIdx = (newDealerIndex + 2) % numPlayers;

  // Post blinds
  const sbAmount = Math.min(state.smallBlind, players[sbIdx].chips);
  const bbAmount = Math.min(state.bigBlind, players[bbIdx].chips);

  players[sbIdx].chips -= sbAmount;
  players[sbIdx].currentBet = sbAmount;
  players[sbIdx].totalBet = sbAmount;
  if (players[sbIdx].chips === 0) players[sbIdx].status = 'all_in';

  players[bbIdx].chips -= bbAmount;
  players[bbIdx].currentBet = bbAmount;
  players[bbIdx].totalBet = bbAmount;
  if (players[bbIdx].chips === 0) players[bbIdx].status = 'all_in';

  // Determine who acts first pre-flop (UTG = dealer + 3, or HU = dealer)
  let firstToAct: number;
  if (numPlayers === 2) {
    firstToAct = newDealerIndex; // Dealer acts first pre-flop in HU
  } else {
    firstToAct = (newDealerIndex + 3) % numPlayers;
  }

  while (players[firstToAct].status !== 'active') {
    firstToAct = (firstToAct + 1) % numPlayers;
  }

  return {
    ...state,
    players,
    deck: deck.slice(deckIdx),
    communityCards: [],
    pot: sbAmount + bbAmount,
    sidePots: [],
    currentPlayerIndex: firstToAct,
    dealerIndex: newDealerIndex,
    phase: 'preflop',
    lastAction: null,
    actionHistory: [],
    minRaise: state.bigBlind,
    currentBet: bbAmount,
    winner: null,
    message: `New hand - ${players[sbIdx].name} SB ${sbAmount}, ${players[bbIdx].name} BB ${bbAmount}`,
    handCount: state.handCount + 1,
  };
}

export function processAction(state: GameState, action: PlayerAction): GameState {
  if (state.phase === 'showdown' || state.phase === 'idle') return state;

  const player = state.players[action.playerId];
  if (!player || player.status !== 'active') return state;

  let players = [...state.players];
  let pot = state.pot;
  let currentBet = state.currentBet;
  let minRaise = state.minRaise;
  let message = state.message;
  const actionHistory = [...state.actionHistory, action];

  switch (action.action) {
    case 'fold': {
      players[action.playerId] = { ...players[action.playerId], status: 'folded' };
      message = `${player.name} folds`;
      break;
    }
    case 'check': {
      players[action.playerId] = { ...players[action.playerId], currentBet: currentBet };
      message = `${player.name} checks`;
      break;
    }
    case 'call': {
      const callAmount = Math.min(action.amount, players[action.playerId].chips);
      players[action.playerId] = {
        ...players[action.playerId],
        chips: players[action.playerId].chips - callAmount,
        currentBet: players[action.playerId].currentBet + callAmount,
        totalBet: players[action.playerId].totalBet + callAmount,
        status: players[action.playerId].chips - callAmount === 0 ? 'all_in' : 'active',
      };
      pot += callAmount;
      message = `${player.name} calls (${callAmount})`;
      break;
    }
    case 'bet':
    case 'raise': {
      const totalBetAmount = action.amount;
      const additionalAmount = totalBetAmount - (player.currentBet);
      const actualAmount = Math.min(additionalAmount, players[action.playerId].chips);

      players[action.playerId] = {
        ...players[action.playerId],
        chips: players[action.playerId].chips - actualAmount,
        currentBet: player.currentBet + actualAmount,
        totalBet: players[action.playerId].totalBet + actualAmount,
        status: players[action.playerId].chips - actualAmount === 0 ? 'all_in' : 'active',
      };
      pot += actualAmount;
      currentBet = players[action.playerId].currentBet;

      if (action.action === 'bet') {
        minRaise = action.amount;
        message = `${player.name} bets ${action.amount}`;
      } else {
        minRaise = action.amount - state.currentBet;
        message = `${player.name} raises to ${action.amount}`;
      }
      break;
    }
    case 'all_in': {
      const allInAmount = players[action.playerId].chips;
      players[action.playerId] = {
        ...players[action.playerId],
        chips: 0,
        currentBet: player.currentBet + allInAmount,
        totalBet: players[action.playerId].totalBet + allInAmount,
        status: 'all_in',
      };
      pot += allInAmount;
      if (player.currentBet + allInAmount > currentBet) {
        currentBet = player.currentBet + allInAmount;
      }
      message = `${player.name} goes ALL-IN (${allInAmount})`;
      break;
    }
  }

  const newState: GameState = {
    ...state,
    players,
    pot,
    currentBet,
    minRaise,
    lastAction: action,
    actionHistory,
    message,
  };

  // Check if round is over
  return checkRoundEnd(newState);
}

function checkRoundEnd(state: GameState): GameState {
  const activePlayers = state.players.filter(
    p => p.status === 'active'
  );
  const allInPlayers = state.players.filter(
    p => p.status === 'all_in'
  );
  const nonFoldedPlayers = state.players.filter(
    p => p.status !== 'folded' && p.status !== 'out'
  );

  // Only one player left = win
  if (nonFoldedPlayers.length === 1) {
    return awardPot(state, [nonFoldedPlayers[0].id]);
  }

  // All remaining players are either all-in or only one active
  // Check if we should advance phase
  const allActed = checkAllActionsComplete(state);

  if (allActed) {
    // Everyone who's active has matched the current bet
    return advancePhase(state);
  }

  // Find next active player
  return advanceToNextPlayer(state);
}

function checkAllActionsComplete(state: GameState): boolean {
  const activePlayers = state.players.filter(p => p.status === 'active');

  if (activePlayers.length === 0) {
    // All remaining are all-in or folded
    return true;
  }

  // All active players must have acted and matched the current bet
  for (const p of activePlayers) {
    if (p.currentBet < state.currentBet) return false;
  }

  // Need at least one action after the last raise
  // Simplified: if we've gone around the table and everyone has matched
  return true;
}

function advancePhase(state: GameState): GameState {
  const allInPlayers = state.players.filter(p => p.status === 'all_in');
  const activePlayers = state.players.filter(p => p.status === 'active');
  const remainingPlayers = state.players.filter(p => p.status !== 'folded' && p.status !== 'out');

  // Check for showdown (all remaining players in or more than 1 active)
  const shouldDeal = remainingPlayers.length > 1;

  if (!shouldDeal) {
    return state;
  }

  let newPhase: GamePhase;
  let communityCards = [...state.communityCards];
  let deck = [...state.deck];

  switch (state.phase) {
    case 'preflop': {
      newPhase = 'flop';
      communityCards = [deck[0], deck[1], deck[2]];
      deck = deck.slice(3);
      break;
    }
    case 'flop': {
      // If everyone is all-in pre-flop, deal all cards at once
      if (allInPlayers.length > 0 && activePlayers.length === 0) {
        communityCards = [...communityCards, deck[0], deck[1], deck[2]];
        deck = deck.slice(3);
      }
      newPhase = 'turn';
      communityCards = [...communityCards, deck[0]];
      deck = deck.slice(1);
      break;
    }
    case 'turn': {
      newPhase = 'river';
      communityCards = [...communityCards, deck[0]];
      deck = deck.slice(1);
      break;
    }
    case 'river': {
      return showdown(state);
    }
    default: {
      return state;
    }
  }

  // Reset bets for new round
  const players = state.players.map(p => ({
    ...p,
    currentBet: 0,
  }));

  // Determine who goes first post-flop: first active player after dealer
  let firstIndex = -1;
  if (state.phase === 'preflop') {
    firstIndex = findFirstToActPostFlop(players, state.dealerIndex);
  } else {
    firstIndex = findFirstToActPostFlop(players, state.dealerIndex);
  }

  return {
    ...state,
    players,
    communityCards,
    deck,
    phase: newPhase,
    currentPlayerIndex: firstIndex >= 0 ? firstIndex : state.currentPlayerIndex,
    currentBet: 0,
    minRaise: state.bigBlind,
    message: `-- ${newPhase.toUpperCase()} --`,
  };
}

function findFirstToActPostFlop(players: Player[], dealerIndex: number): number {
  const numPlayers = players.length;
  for (let i = 1; i <= numPlayers; i++) {
    const idx = (dealerIndex + i) % numPlayers;
    if (players[idx].status === 'active') return idx;
  }
  // If no active, find all_in
  for (let i = 1; i <= numPlayers; i++) {
    const idx = (dealerIndex + i) % numPlayers;
    if (players[idx].status === 'all_in') return idx;
  }
  return 0;
}

function advanceToNextPlayer(state: GameState): GameState {
  const numPlayers = state.players.length;
  let nextIdx = (state.currentPlayerIndex + 1) % numPlayers;

  let attempts = 0;
  while (state.players[nextIdx].status !== 'active' && attempts < numPlayers) {
    // Also skip all-in players who can't act
    nextIdx = (nextIdx + 1) % numPlayers;
    attempts++;
  }

  if (attempts >= numPlayers || state.players[nextIdx].status !== 'active') {
    // Check if round needs to end
    const allActed = checkAllActionsComplete(state);
    if (allActed) {
      return advancePhase(state);
    }
    return state;
  }

  return { ...state, currentPlayerIndex: nextIdx };
}

function showdown(state: GameState): GameState {
  const remainingPlayers = state.players.filter(
    p => p.status !== 'folded' && p.status !== 'out'
  );

  if (remainingPlayers.length === 1) {
    return awardPot(state, [remainingPlayers[0].id]);
  }

  // Evaluate all hands
  let bestPlayerId = remainingPlayers[0].id;
  let bestHand = evaluateHand(remainingPlayers[0].holeCards!, state.communityCards);

  const winners: number[] = [bestPlayerId];

  for (let i = 1; i < remainingPlayers.length; i++) {
    const p = remainingPlayers[i];
    const hand = evaluateHand(p.holeCards!, state.communityCards);
    const comparison = compareHands(hand, bestHand);

    if (comparison > 0) {
      bestHand = hand;
      bestPlayerId = p.id;
      winners.length = 0;
      winners.push(p.id);
    } else if (comparison === 0) {
      winners.push(p.id);
    }
  }

  if (winners.length === 0) {
    winners.push(bestPlayerId);
  }

  return {
    ...state,
    phase: 'showdown',
    winner: {
      playerId: winners.length === 1 ? winners[0] : -1,
      hand: getHandCategoryName(bestHand.category),
      handRank: bestHand.rank,
    },
    message: winners.length === 1
      ? `${state.players[winners[0]].name} wins with ${getHandCategoryName(bestHand.category)}!`
      : `Split pot between ${winners.map(id => state.players[id].name).join(', ')}`,
  };
}

function awardPot(state: GameState, winnerIds: number[]): GameState {
  const players = [...state.players];

  // Handle side pot logic
  const allInAmounts = players
    .filter(p => p.status === 'all_in')
    .map(p => p.totalBet)
    .sort((a, b) => a - b);

  let remainingPot = state.pot;
  let processedAmount = 0;

  for (const amount of allInAmounts) {
    const contribution = amount - processedAmount;
    if (contribution <= 0) continue;

    // Players who bet at least this amount are eligible
    const eligible = players.filter(p => p.totalBet >= amount);
    const share = Math.floor((contribution * state.pot) / state.pot); // simplified

    const potShare = Math.floor(remainingPot / eligible.length);

    for (const p of eligible) {
      if (winnerIds.includes(p.id)) {
        const idx = players.findIndex(pl => pl.id === p.id);
        players[idx].chips += potShare;
        players[idx].totalBet = 0;
        remainingPot -= potShare;
      }
    }
    processedAmount += contribution;
  }

  // Main pot
  if (remainingPot > 0) {
    const share = Math.floor(remainingPot / winnerIds.length);
    for (const id of winnerIds) {
      const idx = players.findIndex(p => p.id === id);
      players[idx].chips += share;
      players[idx].totalBet = 0;
    }
  }

  const winnerHand = winnerIds.length === 1 && state.winner
    ? `${state.players[winnerIds[0]].name} wins with ${state.winner.hand}!`
    : `Split pot!`;

  return {
    ...state,
    players,
    pot: 0,
    phase: 'showdown',
    message: winnerHand,
    winner: winnerIds.length === 1
      ? { playerId: winnerIds[0], hand: state.winner?.hand || '', handRank: state.winner?.handRank || 0 }
      : { playerId: -1, hand: 'Split pot', handRank: 0 },
  };
}

function isHumanTurn(state: GameState): boolean {
  const currentPlayer = state.players[state.currentPlayerIndex];
  return currentPlayer?.isHuman && currentPlayer?.status === 'active';
}

export function getValidActions(state: GameState): ActionType[] {
  const player = state.players[state.currentPlayerIndex];
  if (!player || player.status !== 'active') return [];

  const actions: ActionType[] = ['fold'];

  if (state.currentBet === 0 || state.currentBet === player.currentBet) {
    actions.push('check');
  }

  if (state.currentBet > player.currentBet) {
    actions.push('call');
  } else {
    actions.push('bet');
  }

  if (state.currentBet > player.currentBet) {
    actions.push('raise');
  } else if (state.currentBet === player.currentBet) {
    actions.push('raise');
  }

  if (player.chips > 0) {
    actions.push('all_in');
  }

  return actions;
}

export function runAITurn(state: GameState): GameState {
  if (state.phase === 'idle' || state.phase === 'showdown') return state;
  if (isHumanTurn(state)) return state;

  const player = state.players[state.currentPlayerIndex];
  if (!player || player.status !== 'active') return state;

  const action = makeAIDecision(player, state);
  return processAction(state, action);
}

export function runAllAITurns(state: GameState): GameState {
  let currentState = state;

  while (
    currentState.phase !== 'idle' &&
    currentState.phase !== 'showdown' &&
    !isHumanTurn(currentState)
  ) {
    const currentPlayer = currentState.players[currentState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.status !== 'active') {
      // Move to next player
      currentState = advanceToNextPlayer(currentState);
      if (currentState.phase === 'showdown' || currentState.phase === 'idle') break;
      continue;
    }
    currentState = runAITurn(currentState);
  }

  return currentState;
}

export function resetGameState(state: GameState): GameState {
  return createInitialState(state.players.length);
}
