import { ref, runTransaction } from 'firebase/database';

import {
  BID_WHIST_VARIANT,
  BIDDING,
  BIG_JOKER,
  CARD_VALUES,
  JOKER,
  MAX_ACCUMULATED,
  MAX_ROUNDS,
  SMALL_JOKER,
} from '../constants';
import { db } from '../firebase';

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
      trumpType: '',
    };

    if (!lobbyData.rounds || !Array.isArray(lobbyData.rounds)) lobbyData.rounds = [];
    lobbyData.rounds.push(nextRound);
    lobbyData.currentRound += 1;
    lobbyData.roundStatus = BIDDING;

    return lobbyData;
  });
};

const updateRoundTrump = async (lobbyId, trumpType) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');
  if (!trumpType) throw new Error('Invalid trump type.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds[lobbyData.currentRound - 1];

    currentRound.trumpType = String(trumpType);
    currentRound.currentTurn = 1;

    return lobbyData;
  });
};

const updateRoundState = async (lobbyId, playerName, cardDetails, bids) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds[lobbyData.currentRound - 1];

    if (cardDetails && Object.keys(cardDetails).length > 0) {
      currentRound.players[playerName].played.push(cardDetails);
    }
    if (typeof bids !== 'undefined') currentRound.players[playerName].bids = Number(bids);

    return lobbyData;
  });
};

const updateTurnWinner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const valueLowCard = lobbyData.variant === BID_WHIST_VARIANT.DOWNTOWN;
    const currentRound = lobbyData.rounds[lobbyData.currentRound - 1];
    const currentTurn = currentRound.currentTurn - 1;
    const trumpType = currentRound.trumpType;

    let winnerDetails = null;
    for (let [playerName, playerDetails] of Object.entries(currentRound.players)) {
      const cardDetails = playerDetails.played[currentTurn];
      if (!cardDetails) {
        continue;
      }

      const cardWins =
        !winnerDetails ||
        (cardDetails.type === trumpType && winnerDetails.type !== trumpType) ||
        (cardDetails.type === winnerDetails.type &&
          ((valueLowCard && cardDetails.value < winnerDetails.value) ||
            (!valueLowCard && cardDetails.value > winnerDetails.value)));

      if (cardWins) {
        winnerDetails = {
          playerName,
          type: cardDetails.type,
          value: cardDetails.value,
        };
      }
    }

    if (winnerDetails === null) {
      return lobbyData;
    }

    currentRound.players[winnerDetails.playerName].wins += 1;

    return lobbyData;
  });
};

const updateRoundWinnner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds[lobbyData.currentRound - 1];

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

    if (lobbyData.currentRound < MAX_ROUNDS) {
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
  updateRoundTrump,
  updateRoundState,
  updateTurnWinner,
  updateRoundWinnner,
};
