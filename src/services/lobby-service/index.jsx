import { get, onValue, push, ref, serverTimestamp, set, update } from 'firebase/database';

import { db } from '../../firebase';
import { generateUniqueCode } from '../../utils';

const normalizeGameCode = (gameCode) =>
  String(gameCode ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

const getLobbyIdByCode = async ({ gameCode }) => {
  const normalizedCode = normalizeGameCode(gameCode);
  if (!normalizedCode) return '';

  const snapshot = await get(ref(db, `lobbyCodes/${normalizedCode}`));
  return snapshot.exists() ? String(snapshot.val()) : '';
};

const createGameSession = async ({ playerId, playerName, playerPin, type }) => {
  const lobbyId = push(ref(db, 'lobby')).key;
  if (!lobbyId) throw new Error('Failed to allocate lobby id.');

  let gameCode = '';

  for (let attempt = 0; attempt < 10; attempt += 1) {
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
    hostId: playerId,
    maxPlayers: type === 'spades' ? 4 : 7,
    minPlayers: type === 'spades' ? 4 : 4,
    players: {
      [playerId]: {
        id: playerId,
        isHost: true,
        name: playerName,
        pin: playerPin,
      },
    },
    status: 'lobby',
    type,
    variant: type === 'spades' ? 'classic' : 'uptown',
    createdAt: serverTimestamp(),
  });

  await set(ref(db, `lobbyCodes/${gameCode}`), lobbyId);

  return { gameCode, lobbyId };
};

const joinGameSession = async ({ gameCode, playerId, playerName, playerPin }) => {
  const lobbyId = await getLobbyIdByCode({ gameCode });
  if (!lobbyId) return { error: 'Game not found.', lobbyId: '' };

  const snapshot = await get(ref(db, `lobby/${lobbyId}`));
  if (!snapshot.exists()) return { error: 'Game not found.', lobbyId: '' };

  const lobbyData = snapshot.val();
  if (lobbyData.status !== 'lobby') return { error: 'Game has already started.', lobbyId: '' };

  const players = lobbyData.players ?? {};
  if (Object.keys(players).length >= lobbyData.maxPlayers)
    return { error: 'Game is full.', lobbyId: '' };

  if (!players[playerId]) {
    await update(ref(db, `lobby/${lobbyId}/players`), {
      [playerId]: {
        id: playerId,
        isHost: false,
        name: playerName,
        pin: playerPin,
      },
    });
  }

  return { error: '', lobbyId };
};

const updateVariant = async ({ lobbyId, variant }) => {
  await update(ref(db, `lobby/${lobbyId}`), { variant });
};

const startGame = async ({ lobbyId }) => {
  await update(ref(db, `lobby/${lobbyId}`), { status: 'playing' });
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
  normalizeGameCode,
  startGame,
  subscribeToLobby,
  updateVariant,
};
