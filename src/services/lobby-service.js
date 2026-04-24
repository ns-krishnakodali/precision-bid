import { get, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';

import {
  BID_WHIST_VARIANT,
  GAME_CONFIG,
  GAME_ROUND,
  GAME_TYPE,
  LOBBY_STATUS,
  MAX_ATTEMPTS,
  MAX_ROUNDS,
} from '../constants';
import { db } from '../firebase';
import { generateUniqueCode } from '../utils';

import { dealCards } from './game-service';

const getLobbyIdByCode = async (gameCode) => {
  const normalizedCode = String(gameCode ?? '')
    .trim()
    .toUpperCase();
  if (!normalizedCode) return '';

  const snapshot = await get(ref(db, `lobbyCodes/${normalizedCode}`));
  return snapshot.exists() ? String(snapshot.val()) : '';
};

const createGameSession = async (playerName, playerPin, gameType) => {
  const lobbyId = push(ref(db, 'lobby')).key;
  if (!lobbyId) throw new Error('Failed to allocate lobby id.');

  let gameCode = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidateCode = generateUniqueCode();
    const existingSnapshot = await get(ref(db, `lobbyCodes/${candidateCode}`));

    if (!existingSnapshot.exists()) {
      gameCode = candidateCode;
      break;
    }
  }

  if (!gameCode) throw new Error('Failed to allocate a unique game code.');

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
  const normalizedCode = String(gameCode ?? '')
    .trim()
    .toUpperCase();
  const lobbyId = await getLobbyIdByCode(normalizedCode);
  if (!lobbyId) return { error: 'Game not found.', lobbyId: '' };

  const snapshot = await get(ref(db, `lobby/${lobbyId}`));
  if (!snapshot.exists()) return { error: 'Game not found.', lobbyId: '' };

  const lobbyData = snapshot.val();

  const players = lobbyData.players ?? {};
  const playerObj = players[playerName];

  if (!playerObj) {
    if (Object.keys(players).length >= (GAME_CONFIG[lobbyData.gameType]?.maxPlayers ?? 4)) {
      return { error: 'Lobby is full.', lobbyId: '' };
    }
    if (lobbyData.status !== LOBBY_STATUS.WAITING) {
      return { error: 'Game has already started.', lobbyId: '' };
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
    return { error: 'Invalid details, try again.', lobbyId: '' };
  }

  return { error: '', lobbyId };
};

const updateVariant = async (lobbyId, variant) => {
  await update(ref(db, `lobby/${lobbyId}`), { variant });
};

const startGame = async (lobbyId, variant) => {
  const snapshot = await get(ref(db, `lobby/${lobbyId}`));
  if (!snapshot.exists()) throw new Error('Game session not found.');

  const lobbyData = snapshot.val();
  const playerNames = Object.keys(lobbyData?.players ?? {});

  if (!playerNames.length) throw new Error('No players found in lobby.');

  const currentRound = GAME_ROUND[variant];
  if (!currentRound) {
    throw new Error('Invalid variant. Please select a valid game variant before starting.');
  }

  const includeJokers =
    lobbyData?.gameType === GAME_TYPE.BID_WHIST && variant !== BID_WHIST_VARIANT.NO_TRUMP;

  const { players: dealtHands, remainingCards } = dealCards(playerNames.length, includeJokers);

  const updates = {
    [`lobby/${lobbyId}/status`]: LOBBY_STATUS.IN_GAME,
    [`lobby/${lobbyId}/rounds`]: [],
    [`lobby/${lobbyId}/currentRound`]: currentRound,
    [`lobby/${lobbyId}/totalRounds`]: MAX_ROUNDS,
    [`lobby/${lobbyId}/variant`]: variant,
    [`lobby/${lobbyId}/remainingCards`]: remainingCards,
  };

  playerNames.forEach((name, idx) => {
    updates[`lobby/${lobbyId}/players/${name}/cards`] = dealtHands[idx] ?? [];
  });

  await update(ref(db), updates);
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
  createGameSession,
  getLobbyIdByCode,
  joinGameSession,
  startGame,
  subscribeToLobby,
  updateVariant,
};
