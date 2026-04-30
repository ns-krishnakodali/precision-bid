import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';

import {
  BID_WHIST_VARIANT,
  BIDDING,
  BOT_NAME_LIMIT,
  BOT_NAME_PREFIX,
  BOT_PIN,
  GAME_CONFIG,
  GAME_ROUNDS,
  GAME_TYPE,
  LOBBY_STATUS,
  MAX_ATTEMPTS,
  MAX_CARDS,
} from '../constants';
import { db } from '../firebase';
import { generateUniqueCode } from '../utils';
import { gameService } from './game-service';

// Private Methods

const isReservedBotName = (playerName) => {
  for (let botIdx = 1; botIdx <= BOT_NAME_LIMIT; botIdx++) {
    if (String(playerName ?? '').trim() === `${BOT_NAME_PREFIX} ${botIdx}`) return true;
  }

  return false;
};

const getRoundNumber = (lobbyData, variant) => {
  if (lobbyData?.gameType !== GAME_TYPE.BID_WHIST || variant !== BID_WHIST_VARIANT.NO_TRUMP) {
    return GAME_ROUNDS[variant];
  }

  const playersCount = Object.keys(lobbyData?.players ?? {}).length;
  return playersCount > 0 ? Math.floor(MAX_CARDS / playersCount) : GAME_ROUNDS[variant];
};

// Public methods

const getLobbyIdByCode = async (gameCode) => {
  const normalizedCode = String(gameCode ?? '')
    .trim()
    .toUpperCase();
  if (!normalizedCode) return '';

  const snapshot = await get(ref(db, `lobbyCodes/${normalizedCode}`));
  return snapshot.exists() ? String(snapshot.val()) : '';
};

const createGameSession = async (playerName, playerPin, gameType) => {
  if (isReservedBotName(playerName))
    throw new Error(
      `${BOT_NAME_PREFIX} 1 through ${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT} are reserved names`
    );

  const lobbyId = push(ref(db, 'lobby')).key;
  if (!lobbyId) throw new Error('Failed to allocate lobby id');

  let gameCode = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidateCode = generateUniqueCode();
    const existingSnapshot = await get(ref(db, `lobbyCodes/${candidateCode}`));

    if (!existingSnapshot.exists()) {
      gameCode = candidateCode;
      break;
    }
  }

  if (!gameCode) throw new Error('Failed to allocate a unique game code');

  await set(ref(db, `lobby/${lobbyId}`), {
    gameCode,
    host: playerName,
    players: {
      [playerName]: {
        isHost: true,
        name: playerName,
        pin: playerPin,
        joinedAt: Date.now(),
      },
    },
    status: LOBBY_STATUS.WAITING,
    gameType,
    createdAt: serverTimestamp(),
  });

  await set(ref(db, `lobbyCodes/${gameCode}`), lobbyId);

  return { gameCode, lobbyId };
};

const joinGameSession = async (gameCode, playerName, playerPin) => {
  if (isReservedBotName(playerName))
    return {
      error: `${BOT_NAME_PREFIX} 1 through ${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT} are reserved names`,
      lobbyId: '',
    };

  const normalizedCode = String(gameCode ?? '')
    .trim()
    .toUpperCase();
  const lobbyId = await getLobbyIdByCode(normalizedCode);
  if (!lobbyId) return { error: 'Game not found', lobbyId: '' };

  const snapshot = await get(ref(db, `lobby/${lobbyId}`));
  if (!snapshot.exists()) return { error: 'Game not found', lobbyId: '' };

  const lobbyData = snapshot.val();

  const players = lobbyData.players ?? {};
  const playerObj = players[playerName];

  if (!playerObj) {
    if (Object.keys(players).length >= (GAME_CONFIG[lobbyData.gameType]?.maxPlayers ?? 4)) {
      return { error: 'Lobby is full', lobbyId: '' };
    }
    if (lobbyData.status === LOBBY_STATUS.IN_GAME) {
      return { error: 'Game has already started', lobbyId: '' };
    }
    if (lobbyData.status === LOBBY_STATUS.CANCELLED) {
      return { error: 'Game has been cancelled', lobbyId: '' };
    }

    await update(ref(db, `lobby/${lobbyId}/players`), {
      [playerName]: {
        isHost: false,
        name: playerName,
        pin: playerPin,
        joinedAt: Date.now(),
      },
    });
  } else if (String(playerObj.pin ?? '') !== String(playerPin ?? '')) {
    return { error: 'Invalid details, try again', lobbyId: '' };
  }

  return { error: '', lobbyId };
};

const updateVariant = async (lobbyId, variant) => {
  await update(ref(db, `lobby/${lobbyId}`), { variant });
};

const removePlayer = async (lobbyId, playerName) => {
  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData?.players?.[playerName]) return lobbyData;

    const wasHost = lobbyData.host === playerName || lobbyData.players[playerName].isHost;
    const remainingPlayerEntries = Object.entries(lobbyData.players)
      .filter(([name]) => name !== playerName)
      .sort(
        ([name1, playerDetails1], [name2, playerDetails2]) =>
          Number(playerDetails1?.joinedAt ?? 0) - Number(playerDetails2?.joinedAt ?? 0) ||
          name1.localeCompare(name2)
      );

    delete lobbyData.players[playerName];

    if (Object.keys(lobbyData.players).length === 0) {
      lobbyData.host = '';
      lobbyData.status = LOBBY_STATUS.CANCELLED;
      return lobbyData;
    }

    if (wasHost) {
      const [nextHostName] =
        remainingPlayerEntries.find(([, playerDetails]) => !playerDetails?.isBot) ?? [];

      lobbyData.host = nextHostName ?? '';
      remainingPlayerEntries.forEach(([name]) => {
        lobbyData.players[name].isHost = name === nextHostName;
      });
    }

    return lobbyData;
  });
};

const addBot = async (lobbyId) => {
  if (!lobbyId) throw new Error('Missing lobbyId');

  let botName = '';
  const joinedAt = Date.now();

  await runTransaction(ref(db, `lobby/${lobbyId}`), (lobbyData) => {
    if (!lobbyData) return lobbyData;
    if (lobbyData.status !== LOBBY_STATUS.WAITING) return lobbyData;

    const players = lobbyData.players ?? {};
    const maxPlayers = GAME_CONFIG[lobbyData.gameType]?.maxPlayers ?? 4;
    if (Object.keys(players).length >= maxPlayers) return lobbyData;

    let botIdx = 1;
    while (players[`${BOT_NAME_PREFIX} ${botIdx}`]) botIdx += 1;

    botName = `${BOT_NAME_PREFIX} ${botIdx}`;
    lobbyData.players = {
      ...players,
      [botName]: {
        isBot: true,
        isHost: false,
        joinedAt,
        name: botName,
        pin: BOT_PIN,
      },
    };

    return lobbyData;
  });

  return botName;
};

const startGame = async (lobbyId, variant) => {
  const snapshot = await get(ref(db, `lobby/${lobbyId}`));
  if (!snapshot.exists()) throw new Error('Game session not found');

  const lobbyData = snapshot.val();
  const playerNames = Object.keys(lobbyData?.players ?? {});

  if (!playerNames.length) throw new Error('No players found in lobby');

  const roundNumber = getRoundNumber(lobbyData, variant);
  if (!roundNumber) {
    throw new Error('Invalid variant. Please select a valid game variant before starting');
  }

  const shuffledPlayerNames = [...playerNames];
  for (let idx = shuffledPlayerNames.length - 1; idx > 0; idx--) {
    const randIdx = Math.floor(Math.random() * (idx + 1));
    [shuffledPlayerNames[idx], shuffledPlayerNames[randIdx]] = [
      shuffledPlayerNames[randIdx],
      shuffledPlayerNames[idx],
    ];
  }

  const updates = {
    [`lobby/${lobbyId}/status`]: LOBBY_STATUS.IN_GAME,
    [`lobby/${lobbyId}/roundNumber`]: roundNumber - 1,
    [`lobby/${lobbyId}/variant`]: variant,
    [`lobby/${lobbyId}/currentPlayerIdx`]: 0,
  };

  shuffledPlayerNames.forEach((name, idx) => {
    updates[`lobby/${lobbyId}/players/${name}/orderIdx`] = idx;
    updates[`lobby/${lobbyId}/players/${name}/score`] = 0;
    updates[`lobby/${lobbyId}/players/${name}/accumulated`] = 0;
  });

  await update(ref(db), updates);
  await gameService.addNewRound(lobbyId);
};

const subscribeToLobby = ({ lobbyId, onChange, onError }) => {
  if (!lobbyId) return () => {};

  return onValue(
    ref(db, `lobby/${lobbyId}`),
    (snapshot) => {
      onChange?.(snapshot.val());
    },
    (err) => {
      onError?.(err);
    }
  );
};

export const lobbyService = {
  addBot,
  createGameSession,
  getLobbyIdByCode,
  joinGameSession,
  removePlayer,
  startGame,
  subscribeToLobby,
  updateVariant,
};
