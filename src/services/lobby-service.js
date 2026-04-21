import { get, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';

import { GAME_CONFIG, LOBBY_STATUS, MAX_ATTEMPTS } from '../constants';
import { db } from '../firebase';
import { generateUniqueCode } from '../utils';

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
  await update(ref(db, `lobby/${lobbyId}`), { status: LOBBY_STATUS.IN_GAME, variant });
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
