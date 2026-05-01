import { ref, runTransaction } from 'firebase/database';

import {
  BID_WHIST_VARIANT,
  BIDDING,
  BIG_JOKER,
  CARD_SUITS,
  CARD_VALUES,
  CARDS_ORDER,
  FINALIZING_RESULTS_MESSAGE,
  GAME_OVER_STATUS,
  GAME_STATUS,
  GAME_TYPE,
  JOKER,
  MAX_ACCUMULATED,
  MAX_CARDS,
  MAX_ORDER,
  MAX_ROUNDS,
  NEW_ROUND_STATUS,
  NEW_TURN_STATUS,
  POINTS,
  ROUND_START_MESSAGE,
  SELECT_TRUMP_STATUS,
  SMALL_JOKER,
  SPADE,
  TURN_START_MESSAGE,
} from '../constants';
import { db } from '../firebase';
import { dealCards, getSpadesTeamScore } from '../utils';

// Private Methods

const getBidWinner = (currentRound, lobbyPlayers) => {
  let bidWinner = '';
  let highestBid = 0;

  const orderedPlayerNames = Object.keys(currentRound.players ?? {}).sort(
    (playerName1, playerName2) =>
      Number(lobbyPlayers[playerName1]?.orderIdx) - Number(lobbyPlayers[playerName2]?.orderIdx)
  );
  const firstBidderIdx = orderedPlayerNames.findIndex(
    (playerName) =>
      Number(lobbyPlayers[playerName]?.orderIdx) === Number(currentRound?.startPlayerIdx ?? 0)
  );
  const biddingOrderPlayerNames =
    firstBidderIdx === -1
      ? orderedPlayerNames
      : [
          ...orderedPlayerNames.slice(firstBidderIdx),
          ...orderedPlayerNames.slice(0, firstBidderIdx),
        ];

  for (const playerName of biddingOrderPlayerNames) {
    const playerBid = Number(currentRound.players[playerName].bids ?? 0);
    if (!bidWinner || playerBid > highestBid) {
      bidWinner = playerName;
      highestBid = playerBid;
    }
  }

  return bidWinner;
};

const getCardSuit = (card) => card?.suit ?? card?.type ?? '';

const getEffectiveSuit = (card, currentRound) =>
  getCardSuit(card) === JOKER ? currentRound.trumpSuit : getCardSuit(card);

const getSpadesTeams = (players = {}, rounds = []) => {
  const orderedPlayers = Object.entries(players).sort(
    ([, playerDetails1], [, playerDetails2]) =>
      Number(playerDetails1?.orderIdx ?? 0) - Number(playerDetails2?.orderIdx ?? 0)
  );
  const halfPlayersCount = orderedPlayers.length / 2;
  if (!Number.isInteger(halfPlayersCount) || halfPlayersCount === 0) return [];

  return orderedPlayers.slice(0, halfPlayersCount).map(([playerName, playerDetails], idx) => {
    const [partnerName, partnerDetails] = orderedPlayers[idx + halfPlayersCount];

    return {
      highestPlayerScore: Math.max(playerDetails?.score ?? 0, partnerDetails?.score ?? 0),
      playerNames: [playerName, partnerName],
      score: getSpadesTeamScore({ playerNames: [playerName, partnerName], rounds }),
      accumulatedValues: [playerDetails?.accumulated ?? 0, partnerDetails?.accumulated ?? 0].sort(
        (value1, value2) => value1 - value2
      ),
    };
  });
};

const compareAccumulatedValues = (values1 = [], values2 = []) => {
  for (let idx = 0; idx < Math.max(values1.length, values2.length); idx++) {
    const value1 = values1[idx] ?? Number.POSITIVE_INFINITY;
    const value2 = values2[idx] ?? Number.POSITIVE_INFINITY;
    if (value1 !== value2) return value1 - value2;
  }

  return 0;
};

const getIndividualWinnerNames = (players = {}) => {
  let winnerNames = [];
  let winningScore = Number.NEGATIVE_INFINITY;
  let winningAccumulated = Number.POSITIVE_INFINITY;

  for (const [playerName, playerDetails] of Object.entries(players)) {
    const playerScore = playerDetails.score ?? 0;
    const playerAccumulated = playerDetails.accumulated ?? 0;

    if (
      playerScore > winningScore ||
      (playerScore === winningScore && playerAccumulated < winningAccumulated)
    ) {
      winningScore = playerScore;
      winningAccumulated = playerAccumulated;
      winnerNames = [playerName];
      continue;
    }

    if (playerScore === winningScore && playerAccumulated === winningAccumulated) {
      winnerNames.push(playerName);
    }
  }

  return winnerNames;
};

const getOrderedPlayerNames = (players = {}) =>
  Object.entries(players)
    .sort(
      ([, playerDetails1], [, playerDetails2]) =>
        Number(playerDetails1?.orderIdx ?? 0) - Number(playerDetails2?.orderIdx ?? 0)
    )
    .map(([playerName]) => playerName);

const getPlayerNameByOrderIdx = (players = {}, orderIdx = 0) =>
  Object.entries(players).find(
    ([, playerDetails]) => Number(playerDetails?.orderIdx ?? -1) === Number(orderIdx)
  )?.[0] ?? '';

const getCurrentPlayerName = (lobbyData) =>
  getPlayerNameByOrderIdx(lobbyData?.players, lobbyData?.currentPlayerIdx);

const BOT_RECOVERABLE_ROUND_STATUSES = [NEW_TURN_STATUS, NEW_ROUND_STATUS, GAME_OVER_STATUS];
const TURN_RESOLUTION_DELAY = 1200;

const isLastActionInCycle = (lobbyData, currentRound) => {
  const playersCount = getOrderedPlayerNames(lobbyData?.players).length;
  return (
    playersCount > 0 &&
    (Number(lobbyData?.currentPlayerIdx ?? 0) + 1) % playersCount ===
      Number(currentRound?.startPlayerIdx ?? 0)
  );
};

const getNextPlayerIdx = (lobbyData) => {
  const playersCount = getOrderedPlayerNames(lobbyData?.players).length;
  return playersCount > 0 ? (Number(lobbyData.currentPlayerIdx ?? 0) + 1) % playersCount : 0;
};

const isBidWhistTrumpVariant = (lobbyData) =>
  lobbyData?.gameType === GAME_TYPE.BID_WHIST && lobbyData?.variant !== BID_WHIST_VARIANT.NO_TRUMP;

const getMaxRounds = (lobbyData) => {
  if (lobbyData?.gameType !== GAME_TYPE.BID_WHIST) return MAX_ROUNDS;

  const playersCount = Object.keys(lobbyData?.players ?? {}).length;
  if (playersCount <= 0) return MAX_ROUNDS;

  const totalCards = MAX_CARDS + (isBidWhistTrumpVariant(lobbyData) ? 2 : 0);
  return Math.floor(totalCards / playersCount) || MAX_ROUNDS;
};

const getComparableCardRank = (card, variant) => {
  let cardRank = CARDS_ORDER[card?.value] ?? 0;
  if (variant === BID_WHIST_VARIANT.DOWNTOWN && cardRank < MAX_ORDER) {
    cardRank = MAX_ORDER - cardRank;
  }

  return cardRank;
};

const doesCardBeat = (card, winnerCard, currentRound, variant) => {
  if (!winnerCard) return true;

  const cardSuit = getEffectiveSuit(card, currentRound);
  const winnerSuit = getEffectiveSuit(winnerCard, currentRound);

  return (
    (currentRound.trumpSuit &&
      cardSuit === currentRound.trumpSuit &&
      winnerSuit !== currentRound.trumpSuit) ||
    (cardSuit === winnerSuit &&
      getComparableCardRank(card, variant) > getComparableCardRank(winnerCard, variant))
  );
};

const getCardPower = (card, currentRound, variant) =>
  getComparableCardRank(card, variant) +
  (currentRound.trumpSuit && getEffectiveSuit(card, currentRound) === currentRound.trumpSuit
    ? MAX_ORDER * 2
    : 0);

const sortCardsByPower = (cards = [], currentRound, variant, direction = 'asc') => {
  const multiplier = direction === 'desc' ? -1 : 1;

  return [...cards].sort(
    (card1, card2) =>
      (getCardPower(card1, currentRound, variant) - getCardPower(card2, currentRound, variant)) *
        multiplier ||
      getCardSuit(card1).localeCompare(getCardSuit(card2)) ||
      String(card1?.value ?? '').localeCompare(String(card2?.value ?? ''))
  );
};

const getPlayedCards = (currentRound) =>
  Object.values(currentRound?.players ?? {}).flatMap((playerDetails) => playerDetails.played ?? []);

const getCardKey = (card) => `${card?.value ?? ''}-${getCardSuit(card)}`;

const getUnseenBetterCardsCount = (card, lobbyData, currentRound, playerName) => {
  if (!card || getCardSuit(card) === JOKER) return 0;

  const ownCards = lobbyData.players?.[playerName]?.cards ?? [];
  const seenCardKeys = new Set([...getPlayedCards(currentRound), ...ownCards].map(getCardKey));
  const cardSuit = getCardSuit(card);
  const possibleBetterCards = CARD_VALUES.map((value) => ({ suit: cardSuit, value }));

  if (currentRound.trumpSuit && cardSuit !== currentRound.trumpSuit) {
    possibleBetterCards.push(
      ...CARD_VALUES.map((value) => ({ suit: currentRound.trumpSuit, value }))
    );
  }
  if (isBidWhistTrumpVariant(lobbyData) && currentRound.trumpSuit) {
    possibleBetterCards.push(
      { suit: JOKER, value: SMALL_JOKER },
      { suit: JOKER, value: BIG_JOKER }
    );
  }

  return possibleBetterCards.filter(
    (possibleCard) =>
      !seenCardKeys.has(getCardKey(possibleCard)) &&
      doesCardBeat(possibleCard, card, currentRound, lobbyData.variant)
  ).length;
};

const getCurrentTrickEntries = (lobbyData, currentRound) => {
  const orderedPlayerNames = getOrderedPlayerNames(lobbyData?.players);
  const turnIdx = Number(currentRound?.currentTurn ?? 1) - 1;

  return orderedPlayerNames
    .map((_, idx) => {
      const orderIdx =
        (Number(currentRound?.startPlayerIdx ?? 0) + idx) % orderedPlayerNames.length;
      const playerName = getPlayerNameByOrderIdx(lobbyData.players, orderIdx);
      const card = currentRound?.players?.[playerName]?.played?.[turnIdx];
      return card ? { card, orderIdx, playerName } : null;
    })
    .filter(Boolean);
};

const getCurrentTrickWinner = (lobbyData, currentRound) =>
  getCurrentTrickEntries(lobbyData, currentRound).reduce(
    (winnerDetails, trickEntry) =>
      !winnerDetails ||
      doesCardBeat(trickEntry.card, winnerDetails.card, currentRound, lobbyData.variant)
        ? trickEntry
        : winnerDetails,
    null
  );

const getLegalCards = (hand = [], lobbyData, currentRound) => {
  const [leadEntry] = getCurrentTrickEntries(lobbyData, currentRound);
  const leadSuit = getEffectiveSuit(leadEntry?.card, currentRound);
  if (!leadSuit) return hand;

  const followSuitCards = hand.filter((card) => getEffectiveSuit(card, currentRound) === leadSuit);
  return followSuitCards.length > 0 ? followSuitCards : hand;
};

const getSpadesTeammateName = (lobbyData, playerName) => {
  if (lobbyData?.gameType !== GAME_TYPE.SPADES) return '';

  const orderedPlayerNames = getOrderedPlayerNames(lobbyData.players);
  const playerIdx = orderedPlayerNames.indexOf(playerName);
  const halfPlayersCount = orderedPlayerNames.length / 2;
  if (playerIdx === -1 || !Number.isInteger(halfPlayersCount)) return '';

  return orderedPlayerNames[(playerIdx + halfPlayersCount) % orderedPlayerNames.length];
};

const chooseBotTrump = (lobbyData, playerName) => {
  const hand = lobbyData.players?.[playerName]?.cards ?? [];
  let trumpSuit = CARD_SUITS[0];
  let trumpScore = Number.NEGATIVE_INFINITY;
  const jokerCount = hand.filter((card) => getCardSuit(card) === JOKER).length;

  for (const suit of CARD_SUITS) {
    const suitedCards = hand.filter((card) => getCardSuit(card) === suit);
    const suitScore =
      suitedCards.length * 1.8 +
      suitedCards.reduce(
        (score, card) => score + (getComparableCardRank(card, lobbyData.variant) / MAX_ORDER) * 2,
        0
      ) +
      jokerCount * 2.25 +
      (suitedCards.length >= Math.ceil(hand.length / 3) ? 1 : 0);

    if (suitScore > trumpScore) {
      trumpSuit = suit;
      trumpScore = suitScore;
    }
  }

  return trumpSuit;
};

const estimateBotBid = (lobbyData, playerName) => {
  const currentRound = lobbyData.rounds?.at(-1);
  const hand = lobbyData.players?.[playerName]?.cards ?? [];
  if (hand.length === 0) return 0;

  const trumpSuit =
    lobbyData.gameType === GAME_TYPE.SPADES
      ? SPADE
      : isBidWhistTrumpVariant(lobbyData)
        ? chooseBotTrump(lobbyData, playerName)
        : '';
  const suitCounts = CARD_SUITS.reduce((counts, suit) => {
    counts[suit] = hand.filter((card) => getCardSuit(card) === suit).length;
    return counts;
  }, {});
  const jokerCount = hand.filter((card) => getCardSuit(card) === JOKER).length;

  let expectedTricks = hand.reduce((total, card) => {
    if (getCardSuit(card) === JOKER) return total + 0.95;

    const rankRatio = getComparableCardRank(card, lobbyData.variant) / MAX_ORDER;
    if (trumpSuit && getCardSuit(card) === trumpSuit) return total + 0.3 + rankRatio * 0.85;
    if (rankRatio >= 0.9) return total + 0.95;
    if (rankRatio >= 0.78) return total + 0.55;
    if (rankRatio >= 0.65) return total + 0.25;
    return total;
  }, 0);

  if (trumpSuit) {
    expectedTricks +=
      Math.max(0, (suitCounts[trumpSuit] ?? 0) + jokerCount - Math.ceil(hand.length / 4)) * 0.35;
    CARD_SUITS.filter((suit) => suit !== trumpSuit).forEach((suit) => {
      if ((suitCounts[suit] ?? 0) === 0) expectedTricks += 0.3;
      if ((suitCounts[suit] ?? 0) === 1) expectedTricks += 0.15;
    });
  } else {
    CARD_SUITS.forEach((suit) => {
      if ((suitCounts[suit] ?? 0) >= 4) expectedTricks += 0.2;
    });
  }

  expectedTricks *= Math.min(1, 4 / Math.max(getOrderedPlayerNames(lobbyData.players).length, 4));

  if (lobbyData.gameType === GAME_TYPE.SPADES) {
    const teammateName = getSpadesTeammateName(lobbyData, playerName);
    const teammateBid = Number(currentRound?.players?.[teammateName]?.bids ?? 0);
    if (
      currentRound?.players?.[teammateName]?.hasBid &&
      teammateBid >= Math.ceil(hand.length / 2)
    ) {
      expectedTricks -= 0.75;
    }
    if (
      currentRound?.players?.[teammateName]?.hasBid &&
      teammateBid + expectedTricks > hand.length
    ) {
      expectedTricks = Math.max(0, hand.length - teammateBid);
    }
  }

  if (lobbyData.gameType === GAME_TYPE.BID_WHIST && isBidWhistTrumpVariant(lobbyData)) {
    const highestBid = Object.values(currentRound?.players ?? {}).reduce(
      (highest, playerDetails) =>
        playerDetails.hasBid ? Math.max(highest, Number(playerDetails.bids ?? 0)) : highest,
      0
    );
    if (expectedTricks > highestBid + 0.4) {
      expectedTricks = Math.max(expectedTricks, highestBid + 1);
    }
  }

  return Math.max(0, Math.min(hand.length, Math.round(expectedTricks)));
};

const getBotTrickNeed = (lobbyData, playerName) => {
  const currentRound = lobbyData.rounds?.at(-1);
  const playerRound = currentRound?.players?.[playerName] ?? {};
  const ownNeed = Math.max(0, Number(playerRound.bids ?? 0) - Number(playerRound.wins ?? 0));

  if (lobbyData.gameType !== GAME_TYPE.SPADES) return ownNeed;

  const teammateName = getSpadesTeammateName(lobbyData, playerName);
  const teammateRound = currentRound?.players?.[teammateName] ?? {};
  const teamNeed = Math.max(
    0,
    Number(playerRound.bids ?? 0) +
      Number(teammateRound.bids ?? 0) -
      Number(playerRound.wins ?? 0) -
      Number(teammateRound.wins ?? 0)
  );

  return Math.max(ownNeed, teamNeed);
};

const chooseBotLeadCard = (legalCards, lobbyData, currentRound, playerName, wantsTrick) => {
  if (!wantsTrick) return sortCardsByPower(legalCards, currentRound, lobbyData.variant)[0];

  return [...legalCards].sort(
    (card1, card2) =>
      getUnseenBetterCardsCount(card1, lobbyData, currentRound, playerName) -
        getUnseenBetterCardsCount(card2, lobbyData, currentRound, playerName) ||
      getCardPower(card2, currentRound, lobbyData.variant) -
        getCardPower(card1, currentRound, lobbyData.variant)
  )[0];
};

const chooseBotCard = (lobbyData, playerName) => {
  const currentRound = lobbyData.rounds?.at(-1);
  const hand = lobbyData.players?.[playerName]?.cards ?? [];
  const legalCards = getLegalCards(hand, lobbyData, currentRound);
  if (legalCards.length === 0) return null;

  const currentWinner = getCurrentTrickWinner(lobbyData, currentRound);
  const teammateName = getSpadesTeammateName(lobbyData, playerName);
  const teammateWinning = Boolean(teammateName && currentWinner?.playerName === teammateName);
  const wantsTrick = getBotTrickNeed(lobbyData, playerName) > 0;

  if (!currentWinner) {
    return chooseBotLeadCard(legalCards, lobbyData, currentRound, playerName, wantsTrick);
  }

  if (teammateWinning) {
    return sortCardsByPower(legalCards, currentRound, lobbyData.variant)[0];
  }

  const winningCards = legalCards.filter((card) =>
    doesCardBeat(card, currentWinner.card, currentRound, lobbyData.variant)
  );
  const losingCards = legalCards.filter(
    (card) => !doesCardBeat(card, currentWinner.card, currentRound, lobbyData.variant)
  );

  if (wantsTrick && winningCards.length > 0) {
    return sortCardsByPower(winningCards, currentRound, lobbyData.variant)[0];
  }
  if (!wantsTrick && losingCards.length > 0) {
    return sortCardsByPower(losingCards, currentRound, lobbyData.variant)[0];
  }

  return sortCardsByPower(
    winningCards.length > 0 ? winningCards : legalCards,
    currentRound,
    lobbyData.variant
  )[0];
};

// Public Methods

const addNewRound = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const playersNames = Object.keys(lobbyData.players ?? {});
    const maxRounds = getMaxRounds(lobbyData);

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
      Math.min(lobbyData.roundNumber, maxRounds),
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
      currentPlayer.hasBid = true;
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

    if (lobbyData.gameType === GAME_TYPE.BID_WHIST) {
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

const processBotAction = async (lobbyId, hostPlayerName) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  let actionTaken = false;
  let resolveTurnWinner = false;
  let resumeTurnResolution = false;

  const transactionResult = await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    actionTaken = false;
    resolveTurnWinner = false;
    resumeTurnResolution = false;

    if (!lobbyData || lobbyData.host !== hostPlayerName) return lobbyData;

    const currentRound = lobbyData.rounds?.at(-1);
    const playerName = getCurrentPlayerName(lobbyData);
    const playerDetails = lobbyData.players?.[playerName];
    const roundPlayer = currentRound?.players?.[playerName];
    if (!currentRound || !playerDetails?.isBot || !roundPlayer) return lobbyData;

    if (BOT_RECOVERABLE_ROUND_STATUSES.includes(lobbyData.roundStatus)) {
      resumeTurnResolution = true;
      return lobbyData;
    }

    const botActionKey = [
      lobbyData.roundNumber,
      currentRound.currentTurn,
      lobbyData.roundStatus,
      lobbyData.currentPlayerIdx,
      playerName,
    ].join(':');

    if (currentRound.lastBotActionKey === botActionKey) return lobbyData;

    if (lobbyData.roundStatus === BIDDING) {
      if (roundPlayer.hasBid) return lobbyData;

      roundPlayer.bids = estimateBotBid(lobbyData, playerName);
      roundPlayer.hasBid = true;
      currentRound.lastBotActionKey = botActionKey;

      if (isLastActionInCycle(lobbyData, currentRound)) {
        if (lobbyData.gameType === GAME_TYPE.BID_WHIST) {
          const bidWinner = getBidWinner(currentRound, lobbyData.players);
          currentRound.startPlayerIdx = Number(lobbyData.players[bidWinner].orderIdx);
        }

        lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;
        if (isBidWhistTrumpVariant(lobbyData)) {
          lobbyData.roundStatus = SELECT_TRUMP_STATUS;
        } else {
          currentRound.trumpSuit = lobbyData.gameType === GAME_TYPE.SPADES ? SPADE : '';
          currentRound.currentTurn = 1;
          lobbyData.roundStatus = GAME_STATUS;
        }
      } else {
        lobbyData.currentPlayerIdx = getNextPlayerIdx(lobbyData);
      }

      lobbyData.statusText = '';
      actionTaken = true;
      return lobbyData;
    }

    if (lobbyData.roundStatus === SELECT_TRUMP_STATUS) {
      if (!isBidWhistTrumpVariant(lobbyData) || currentRound.trumpSuit) return lobbyData;

      currentRound.trumpSuit = chooseBotTrump(lobbyData, playerName);
      currentRound.currentTurn = 1;
      currentRound.lastBotActionKey = botActionKey;
      lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;
      lobbyData.roundStatus = GAME_STATUS;
      lobbyData.statusText = '';
      actionTaken = true;
      return lobbyData;
    }

    if (lobbyData.roundStatus === GAME_STATUS) {
      const turnIdx = Number(currentRound.currentTurn ?? 0) - 1;
      if (turnIdx < 0 || roundPlayer.played?.[turnIdx]) return lobbyData;

      const cardDetails = chooseBotCard(lobbyData, playerName);
      if (!cardDetails) return lobbyData;

      roundPlayer.played ??= [];
      roundPlayer.played.push(cardDetails);

      const cardIdx = (playerDetails.cards ?? []).findIndex(
        (card) => getCardKey(card) === getCardKey(cardDetails)
      );
      if (cardIdx !== -1) playerDetails.cards.splice(cardIdx, 1);

      currentRound.lastBotActionKey = botActionKey;
      resolveTurnWinner = isLastActionInCycle(lobbyData, currentRound);
      if (!resolveTurnWinner) {
        lobbyData.currentPlayerIdx = getNextPlayerIdx(lobbyData);
      }

      lobbyData.statusText = '';
      actionTaken = true;
    }

    return lobbyData;
  });

  if (resumeTurnResolution) {
    await updateTurnWinner(lobbyId);
    return true;
  }

  if (actionTaken && transactionResult?.committed !== false && resolveTurnWinner) {
    await updateTurnWinner(lobbyId);
  }

  return actionTaken && transactionResult?.committed !== false;
};

const updateTurnWinner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  let pendingTurn = 0;
  let pendingTurnStartedAt = 0;
  let roundNumber = null;
  let resolvedTurn = false;
  let startNewRound = false;

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    if (!currentRound) return lobbyData;

    const maxRounds = getMaxRounds(lobbyData);
    roundNumber = lobbyData?.roundNumber;
    pendingTurn = Number(currentRound.pendingTurnWinnerTurn ?? currentRound.currentTurn ?? 0);
    if (pendingTurn <= 0) return lobbyData;

    if (Number(currentRound.pendingTurnWinnerTurn ?? 0) !== pendingTurn) {
      currentRound.pendingTurnWinnerTurn = pendingTurn;
      currentRound.pendingTurnWinnerAt = Date.now();
    } else if (typeof currentRound.pendingTurnWinnerAt === 'undefined') {
      currentRound.pendingTurnWinnerAt = Date.now();
    }

    pendingTurnStartedAt = Number(currentRound.pendingTurnWinnerAt ?? Date.now());
    startNewRound = pendingTurn === roundNumber;

    if (startNewRound) {
      if (roundNumber < maxRounds) {
        lobbyData.roundStatus = NEW_ROUND_STATUS;
        lobbyData.statusText = ROUND_START_MESSAGE;
      } else {
        lobbyData.roundStatus = GAME_OVER_STATUS;
        lobbyData.statusText = FINALIZING_RESULTS_MESSAGE;
      }
    } else if (!startNewRound) {
      lobbyData.roundStatus = NEW_TURN_STATUS;
      lobbyData.statusText = TURN_START_MESSAGE;
    }

    return lobbyData;
  });

  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(0, TURN_RESOLUTION_DELAY - (Date.now() - pendingTurnStartedAt)))
  );

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    if (!currentRound || Number(currentRound.pendingTurnWinnerTurn ?? 0) !== pendingTurn) {
      return lobbyData;
    }

    const currentTurn = pendingTurn - 1;

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

    if (winnerDetails) {
      currentRound.players[winnerDetails.playerName].wins += 1;
      if (!startNewRound) {
        currentRound.startPlayerIdx = Number(lobbyData.players[winnerDetails.playerName].orderIdx);
        lobbyData.currentPlayerIdx = currentRound.startPlayerIdx;
      }
    }

    if (!startNewRound) {
      lobbyData.roundStatus = GAME_STATUS;
      currentRound.currentTurn = pendingTurn + 1;
    }
    delete currentRound.pendingTurnWinnerTurn;
    delete currentRound.pendingTurnWinnerAt;
    lobbyData.statusText = '';
    resolvedTurn = true;

    return lobbyData;
  });

  if (resolvedTurn && startNewRound) {
    await updateRoundWinnner(lobbyId);
  }
};

const updateRoundWinnner = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId.');

  let roundNumber = null;
  let maxRounds = MAX_ROUNDS;

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;

    const currentRound = lobbyData.rounds.at(-1);
    maxRounds = getMaxRounds(lobbyData);

    for (let [playerName, playerDetails] of Object.entries(currentRound.players)) {
      if (typeof playerDetails.wins === 'undefined' || typeof playerDetails.bids === 'undefined') {
        continue;
      }
      const bids = playerDetails.bids;
      const wins = playerDetails.wins;
      const playerObj = lobbyData.players[playerName];

      let score = (wins < bids ? wins - bids : bids) * POINTS;
      let totalAccumulated = (playerObj?.accumulated ?? 0) + (wins > bids ? wins - bids : 0);

      if (totalAccumulated >= MAX_ACCUMULATED) {
        playerDetails.accumulatedPenalty =
          Math.floor(totalAccumulated / MAX_ACCUMULATED) * MAX_ACCUMULATED * POINTS;
        score -= playerDetails.accumulatedPenalty;
        totalAccumulated %= MAX_ACCUMULATED;
      }

      playerObj.score += score;
      playerObj.accumulated = totalAccumulated;
    }

    roundNumber = lobbyData.roundNumber;
    if (roundNumber >= maxRounds) {
      if (lobbyData.gameType === GAME_TYPE.SPADES) {
        const teams = getSpadesTeams(lobbyData.players, lobbyData.rounds);
        let winnerTeams = [];
        let winningHighestPlayerScore = Number.NEGATIVE_INFINITY;
        let winningScore = Number.NEGATIVE_INFINITY;
        let winningAccumulatedValues = [];

        for (const teamDetails of teams) {
          const highestPlayerScoreComparison =
            teamDetails.highestPlayerScore - winningHighestPlayerScore;
          const scoreComparison = teamDetails.score - winningScore;
          const accumulatedComparison = compareAccumulatedValues(
            teamDetails.accumulatedValues,
            winningAccumulatedValues
          );

          if (
            scoreComparison > 0 ||
            (scoreComparison === 0 && highestPlayerScoreComparison > 0) ||
            (scoreComparison === 0 &&
              highestPlayerScoreComparison === 0 &&
              accumulatedComparison < 0) ||
            winnerTeams.length === 0
          ) {
            winningHighestPlayerScore = teamDetails.highestPlayerScore;
            winningScore = teamDetails.score;
            winningAccumulatedValues = teamDetails.accumulatedValues;
            winnerTeams = [teamDetails];
            continue;
          }

          if (
            scoreComparison === 0 &&
            highestPlayerScoreComparison === 0 &&
            accumulatedComparison === 0
          ) {
            winnerTeams.push(teamDetails);
          }
        }

        lobbyData.winnerNames =
          winnerTeams.length > 0
            ? winnerTeams.flatMap((teamDetails) => teamDetails.playerNames)
            : getIndividualWinnerNames(lobbyData.players);
      } else {
        lobbyData.winnerNames = getIndividualWinnerNames(lobbyData.players);
      }
    }

    return lobbyData;
  });

  if ((roundNumber ?? MAX_ROUNDS) < maxRounds) {
    await addNewRound(lobbyId);
  }
};

export const gameService = {
  addNewRound,
  processBotAction,
  updateRoundState,
  updateRoundTrump,
  updateTurnWinner,
  updateRoundWinnner,
};
