import { ref, runTransaction } from 'firebase/database';

import {
  BID_WHIST_VARIANT,
  BIDDING,
  BIG_JOKER,
  CARDS_ORDER,
  GAME_STATUS,
  GAME_TYPE,
  JOKER,
  MAX_ACCUMULATED,
  MAX_ROUNDS,
  NEW_ROUND_STATUS,
  ROUND_START_STATUS,
  SELECT_TRUMP,
  SMALL_JOKER,
} from '../constants';
import { db } from '../firebase';
import { dealCards } from '../utils';

const getBidWinner = (currentRound, lobbyPlayers) => {
  let bidWinner = '';
  let highestBid = 0;

  const orderedPlayerNames = Object.keys(currentRound.players ?? {}).sort(
    (playerName1, playerName2) =>
      Number(lobbyPlayers[playerName1]?.orderIdx) - Number(lobbyPlayers[playerName2]?.orderIdx)
  );
  for (const playerName of orderedPlayerNames) {
    const playerBid = Number(currentRound.players[playerName].bids ?? 0);
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

    const playersNames = Object.keys(lobbyData.players ?? {}).sort(
      (playerName1, playerName2) =>
        Number(lobbyData.players[playerName1].orderIdx) -
        Number(lobbyData.players[playerName2].orderIdx)
    );

    const roundPlayers = playersNames.reduce((acc, playerName) => {
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
    const { dealtCards } = dealCards(
      playersNames.length,
      lobbyData.roundNumber + 1,
      lobbyData.gameType === GAME_TYPE.BID_WHIST && lobbyData.variant !== BID_WHIST_VARIANT.NO_TRUMP
    );

    playersNames.forEach((playerName, idx) => {
      lobbyData.players[playerName].cards = dealtCards[idx];
    });

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

  let startNewRound = false;

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const valueLowCard = lobbyData.variant === BID_WHIST_VARIANT.DOWNTOWN;
    const currentRound = lobbyData.rounds.at(-1);
    const currentTurn = currentRound.currentTurn - 1;
    const trumpSuit = currentRound.trumpSuit;

    const startPlayerName = Object.entries(lobbyData.players ?? {}).find(
      ([, playerDetails]) => Number(playerDetails.orderIdx) === currentRound.startPlayerIdx
    )?.[0];
    const startPlayerCard = startPlayerName
      ? currentRound.players?.[startPlayerName]?.played?.[currentTurn]
      : null;

    let winnerDetails = startPlayerCard
      ? {
          playerName: startPlayerName,
          value: startPlayerCard.value,
          suit: startPlayerCard.suit,
        }
      : null;
    for (const [playerName, playerDetails] of Object.entries(currentRound.players)) {
      const cardDetails = playerDetails.played[currentTurn];
      if (!cardDetails) continue;

      const cardRank = CARDS_ORDER[cardDetails.value] ?? 0;
      const winnerRank = winnerDetails ? (CARDS_ORDER[winnerDetails.value] ?? 0) : 0;

      const cardWins =
        !winnerDetails ||
        (cardDetails.suit === trumpSuit && winnerDetails.suit !== trumpSuit) ||
        (cardDetails.suit === winnerDetails.suit &&
          ((valueLowCard && cardRank < winnerRank) || (!valueLowCard && cardRank > winnerRank)));

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
      currentRound.startPlayerIdx = Number(lobbyData.players[winnerDetails.playerName].orderIdx);
    }

    startNewRound = currentRound.currentTurn === lobbyData?.roundNumber;

    currentRound.currentTurn += 1;
    lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;
    if (startNewRound) {
      lobbyData.roundStatus = NEW_ROUND_STATUS;
      lobbyData.statusText = ROUND_START_STATUS;
    }

    return lobbyData;
  });

  if (startNewRound) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await updateRoundWinnner(lobbyId);
  }
};

const updateRoundTrump = async (lobbyId, trumpSuit) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    const bidWinner = getBidWinner(currentRound, lobbyData.players);

    currentRound.startPlayerIdx = Number(lobbyData.players[bidWinner].orderIdx);

    lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;

    if (trumpSuit === undefined) {
      lobbyData.roundStatus = SELECT_TRUMP;
      return lobbyData;
    }

    if (trumpSuit === null) throw new Error('Invalid trump suit.');

    currentRound.trumpSuit = String(trumpSuit);
    currentRound.currentTurn = 1;
    lobbyData.roundStatus = GAME_STATUS;

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
    const currentPlayer = currentRound.players[playerName];

    if (cardDetails && Object.keys(cardDetails).length > 0) {
      currentPlayer.played ??= [];
      currentPlayer.played.push(cardDetails);

      const cards = lobbyData.players[playerName].cards;
      const cardIdx = cards.findIndex(
        (card) =>
          card.value === cardDetails.value &&
          (card.suit ?? card.type) === (cardDetails.suit ?? cardDetails.type)
      );
      if (cardIdx !== -1) cards.splice(cardIdx, 1);
    }
    if (typeof bids !== 'undefined') {
      currentPlayer.bids = Number(bids);
    }
    if (updatePlayerPosition) {
      lobbyData.currentPlayerIdx =
        (lobbyData.currentPlayerIdx + 1) % Object.keys(lobbyData.players).length;
    }

    return lobbyData;
  });
};

const updateRoundWinnner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  let roundNumber = null;

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

      let totalAccumulated = lobbyData.players[playerName]?.accumulated ?? 0;
      if (accumulated + totalAccumulated > MAX_ACCUMULATED) {
        score -= Math.floor(totalAccumulated / MAX_ACCUMULATED) * MAX_ACCUMULATED * 100;
        totalAccumulated %= MAX_ACCUMULATED;
      }

      lobbyData.statusText = '';
      lobbyData.players[playerName].score += score;
      lobbyData.players[playerName].accumulated += totalAccumulated;
    }

    roundNumber = lobbyData.roundNumber;
    if (roundNumber >= MAX_ROUNDS) {
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

  if (roundNumber !== null && roundNumber < MAX_ROUNDS) {
    await addNewRound(lobbyId);
  }
};

export const gameService = {
  addNewRound,
  updateCurrentPlayerIdx,
  updateTurnWinner,
  updateRoundTrump,
  updateRoundState,
  updateRoundWinnner,
};
