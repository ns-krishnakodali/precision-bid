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
  MAX_ORDER,
  MAX_ROUNDS,
  NEW_ROUND_STATUS,
  ROUND_START_STATUS,
  SELECT_TRUMP_STATUS,
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

const getEffectiveSuit = (card, currentRound) =>
  card?.suit === JOKER ? currentRound.trumpSuit : card?.suit;

const addNewRound = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const playersNames = Object.keys(lobbyData.players ?? {});

    const roundPlayers = playersNames.reduce((acc, playerName) => {
      acc[playerName] = {
        bids: 0,
        wins: 0,
        played: [],
      };
      return acc;
    }, {});

    const startPlayerIdx = (lobbyData.roundNumber ?? 0) % Object.keys(lobbyData.players).length;
    const nextRound = {
      players: roundPlayers,
      currentTurn: 0,
      trumpSuit: '',
      startPlayerIdx,
    };

    if (!lobbyData.rounds || !Array.isArray(lobbyData.rounds)) lobbyData.rounds = [];
    lobbyData.roundNumber += 1;

    const { dealtCards } = dealCards(
      playersNames.length,
      lobbyData.roundNumber,
      lobbyData.gameType === GAME_TYPE.BID_WHIST && lobbyData.variant !== BID_WHIST_VARIANT.NO_TRUMP
    );

    playersNames.forEach((playerName, idx) => {
      lobbyData.players[playerName].cards = dealtCards[idx];
    });

    lobbyData.currentPlayerIdx = startPlayerIdx;
    lobbyData.rounds.push(nextRound);
    lobbyData.roundStatus = BIDDING;
    lobbyData.statusText = '';

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

const updateRoundTrump = async (lobbyId, trumpSuit) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);

    if (
      lobbyData.gameType === GAME_TYPE.BID_WHIST ||
      lobbyData.variant !== BID_WHIST_VARIANT.NO_TRUMP
    ) {
      const bidWinner = getBidWinner(currentRound, lobbyData.players);
      currentRound.startPlayerIdx = Number(lobbyData.players[bidWinner].orderIdx);
    }
    lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;

    if (trumpSuit === undefined) {
      lobbyData.roundStatus = SELECT_TRUMP_STATUS;
      return lobbyData;
    }
    if (trumpSuit === null) throw new Error('Invalid trump suit.');

    currentRound.trumpSuit = String(trumpSuit);
    currentRound.currentTurn = 1;
    lobbyData.roundStatus = GAME_STATUS;

    return lobbyData;
  });
};

const updateTurnWinner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  let startNewRound = false;
  let roundNumber = null;

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    const currentTurn = currentRound.currentTurn - 1;

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

      let cardRank = CARDS_ORDER[cardDetails.value] ?? 0;
      let winnerRank = winnerDetails ? (CARDS_ORDER[winnerDetails.value] ?? 0) : 0;
      if (lobbyData.variant === BID_WHIST_VARIANT.DOWNTOWN) {
        cardRank = cardRank < MAX_ORDER ? MAX_ORDER - cardRank : cardRank;
        winnerRank = winnerRank < MAX_ORDER ? MAX_ORDER - winnerRank : winnerRank;
      }
      const cardSuit = getEffectiveSuit(cardDetails, currentRound);
      const winnerSuit = getEffectiveSuit(winnerDetails, currentRound);

      if (
        !winnerDetails ||
        (cardSuit === currentRound.trumpSuit && winnerSuit !== currentRound.trumpSuit) ||
        (cardSuit === winnerSuit && cardRank > winnerRank)
      ) {
        winnerDetails = {
          playerName,
          value: cardDetails.value,
          suit: cardDetails.suit,
        };
      }
    }

    roundNumber = lobbyData?.roundNumber;
    startNewRound = currentRound.currentTurn === roundNumber;

    if (startNewRound && roundNumber < MAX_ROUNDS) {
      lobbyData.roundStatus = NEW_ROUND_STATUS;
      lobbyData.statusText = ROUND_START_STATUS;
    } else {
      lobbyData.statusText = '';
    }

    if (winnerDetails) {
      currentRound.players[winnerDetails.playerName].wins += 1;
      if (!startNewRound) {
        currentRound.startPlayerIdx = Number(lobbyData.players[winnerDetails.playerName].orderIdx);
        lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;
      }
    }
    currentRound.currentTurn += 1;

    return lobbyData;
  });

  if (startNewRound) {
    if ((roundNumber ?? MAX_ROUNDS) < MAX_ROUNDS) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    await updateRoundWinnner(lobbyId);
  }
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
      const playerObj = lobbyData.players[playerName];

      let score = 0;
      let accumulated = 0;
      if (wins < bids) {
        score = (bids - wins) * -100;
      } else {
        score = bids * 100;
        accumulated = wins - bids;
      }

      let totalAccumulated = (playerObj?.accumulated ?? 0) + accumulated;
      if (totalAccumulated > MAX_ACCUMULATED) {
        score -= Math.floor(totalAccumulated / MAX_ACCUMULATED) * MAX_ACCUMULATED * 100;
        totalAccumulated %= MAX_ACCUMULATED;
      }

      playerObj.score += score;
      playerObj.accumulated = totalAccumulated;
    }

    roundNumber = lobbyData.roundNumber;
    if (roundNumber >= MAX_ROUNDS) {
      let winnerNames = [];
      let winningScore = Number.NEGATIVE_INFINITY;
      let winningAccumulated = Number.NEGATIVE_INFINITY;

      for (const [playerName, playerDetails] of Object.entries(lobbyData.players)) {
        if (
          playerDetails.score > winningScore ||
          (playerDetails.score === winningScore && playerDetails.accumulated > winningAccumulated)
        ) {
          winningScore = playerDetails.score;
          winningAccumulated = playerDetails.accumulated;
          winnerNames = [playerName];
          continue;
        }

        if (
          playerDetails.score === winningScore &&
          playerDetails.accumulated === winningAccumulated
        ) {
          winnerNames.push(playerName);
        }
      }

      lobbyData.winnerNames = winnerNames;
    }

    return lobbyData;
  });

  if ((roundNumber ?? MAX_ROUNDS) < MAX_ROUNDS) {
    await addNewRound(lobbyId);
  }
};

export const gameService = {
  addNewRound,
  updateRoundState,
  updateRoundTrump,
  updateTurnWinner,
  updateRoundWinnner,
};
