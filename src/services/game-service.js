import { ref, runTransaction } from 'firebase/database';

import {
  BID_WHIST_VARIANT,
  BIDDING,
  BIG_JOKER,
  CARD_VALUES,
  IN_PLAY,
  JOKER,
  MAX_ACCUMULATED,
  MAX_ROUNDS,
  SELECT_TRUMP,
  SMALL_JOKER,
} from '../constants';
import { db } from '../firebase';

const getBidWinner = (currentRound) => {
  let bidWinner = '';
  let highestBid = 0;

  for (const [playerName, playerDetails] of Object.entries(currentRound.players)) {
    const playerBid = Number(playerDetails.bids ?? 0);
    if (!bidWinner || playerBid > highestBid) {
      bidWinner = playerName;
      highestBid = playerBid;
    }
  }

  return bidWinner;
};

const addNewRound = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const lobbyPlayers = lobbyData.players ?? {};
    const roundPlayers = Object.keys(lobbyPlayers).reduce((acc, playerName) => {
      acc[playerName] = {
        bids: 0,
        wins: 0,
        played: [],
      };
      return acc;
    }, {});

    const nextRound = {
      players: roundPlayers,
      currentTurn: 0,
      trumpSuit: '',
    };

    if (!lobbyData.rounds || !Array.isArray(lobbyData.rounds)) lobbyData.rounds = [];
    lobbyData.rounds.push(nextRound);
    lobbyData.roundNumber += 1;
    lobbyData.roundStatus = BIDDING;

    return lobbyData;
  });
};

const updateCurrentPlayerIdx = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    lobbyData.currentPlayerIdx =
      (lobbyData.currentPlayerIdx + 1) % Object.keys(lobbyData.players).length;

    return lobbyData;
  });
};

const updateTurnWinner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const valueLowCard = lobbyData.variant === BID_WHIST_VARIANT.DOWNTOWN;
    const currentRound = lobbyData.rounds.at(-1);
    const currentTurn = currentRound.currentTurn - 1;
    const trumpSuit = currentRound.trumpSuit;

    let winnerDetails = null;
    for (let [playerName, playerDetails] of Object.entries(currentRound.players)) {
      const cardDetails = playerDetails.played[currentTurn];
      if (!cardDetails) {
        continue;
      }

      const cardWins =
        !winnerDetails ||
        (cardDetails.suit === trumpSuit && winnerDetails.suit !== trumpSuit) ||
        (cardDetails.suit === winnerDetails.suit &&
          ((valueLowCard && cardDetails.value < winnerDetails.value) ||
            (!valueLowCard && cardDetails.value > winnerDetails.value)));

      if (cardWins) {
        winnerDetails = {
          playerName,
          value: cardDetails.value,
          suit: cardDetails.suit,
        };
      }
    }

    if (winnerDetails) {
      currentRound.players[winnerDetails.playerName].wins += 1;
    }
    currentRound.startPlayerIdx =
      (currentRound.startPlayerIdx + 1) % Object.keys(lobbyData.players).length;
    lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;

    return lobbyData;
  });
};

const updateRoundTrump = async (lobbyId, trumpSuit) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    const bidWinner = getBidWinner(currentRound);

    currentRound.startPlayerIdx = Number(lobbyData.players[bidWinner].order) - 1;

    lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;

    if (trumpSuit === undefined) {
      lobbyData.roundStatus = SELECT_TRUMP;
      return lobbyData;
    }

    if (trumpSuit === null) throw new Error('Invalid trump suit.');

    currentRound.trumpSuit = String(trumpSuit);
    currentRound.currentTurn = 1;
    lobbyData.roundStatus = IN_PLAY;

    return lobbyData;
  });
};

const updateRoundState = async (
  lobbyId,
  playerName,
  cardDetails,
  bids,
  updatePlayerPosition = false
) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    if (cardDetails && Object.keys(cardDetails).length > 0) {
      currentRound.players[playerName].played.push(cardDetails);
    }
    if (typeof bids !== 'undefined') currentRound.players[playerName].bids = Number(bids);
    if (updatePlayerPosition) {
      lobbyData.currentPlayerIdx =
        (lobbyData.currentPlayerIdx + 1) % Object.keys(lobbyData.players).length;
    }

    return lobbyData;
  });
};

const updateRoundWinnner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);

    for (let [playerName, playerDetails] of Object.entries(currentRound.players)) {
      if (typeof playerDetails.wins === 'undefined' || typeof playerDetails.bids === 'undefined') {
        continue;
      }
      const bids = playerDetails.bids;
      const wins = playerDetails.wins;

      let score = 0;
      let accumulated = 0;
      if (wins < bids) {
        score = wins * -100;
        continue;
      } else {
        score = bids * 100;
        accumulated = wins - bids;
      }

      let totalAccumulated = lobbyData.players[playerName]?.accumulated;
      if (accumulated + totalAccumulated > MAX_ACCUMULATED) {
        score -= Math.floor(totalAccumulated / MAX_ACCUMULATED) * MAX_ACCUMULATED * 100;
        totalAccumulated %= MAX_ACCUMULATED;
      }

      lobbyData.players[playerName].score += score;
      lobbyData.players[playerName].accumulated += totalAccumulated;
    }

    if (lobbyData.roundNumber < MAX_ROUNDS) {
      addNewRound(lobbyId);
    } else {
      let winnerName = '';
      for (const [playerName, playerDetails] of Object.entries(lobbyData.players)) {
        if (!winnerName || playerDetails.score > lobbyData.players[winnerName].score) {
          winnerName = playerName;
        }
      }

      lobbyData.winnerName = winnerName;
    }

    return lobbyData;
  });
};

export const gameService = {
  addNewRound,
  updateCurrentPlayerIdx,
  updateTurnWinner,
  updateRoundTrump,
  updateRoundState,
  updateRoundWinnner,
};
