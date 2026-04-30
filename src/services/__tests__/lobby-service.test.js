import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { gameService } from '../game-service';
import { lobbyService } from '../lobby-service';

import {
  BID_WHIST_VARIANT,
  BOT_NAME_LIMIT,
  BOT_NAME_PREFIX,
  BOT_PIN,
  GAME_TYPE,
  LOBBY_STATUS,
  MAX_ATTEMPTS,
  MAX_CARDS,
  SPADES_VARIANT,
} from '../../constants';
import { db } from '../../firebase';
import { generateUniqueCode } from '../../utils';

vi.mock('firebase/database', () => ({
  get: vi.fn(),
  onValue: vi.fn(),
  push: vi.fn(),
  ref: vi.fn((database, path = '') => ({ database, path })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  set: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: { mockDb: true },
}));

vi.mock('../../utils', () => ({
  generateUniqueCode: vi.fn(),
}));

vi.mock('../game-service', () => ({
  gameService: {
    addNewRound: vi.fn(),
  },
}));

const snapshot = (value, exists = value !== undefined && value !== null) => ({
  exists: vi.fn(() => exists),
  val: vi.fn(() => value),
});

const deepClone = (value) =>
  typeof value === 'undefined' ? undefined : JSON.parse(JSON.stringify(value));

const createLobby = (overrides = {}) => ({
  gameCode: 'PLAY01',
  gameType: GAME_TYPE.SPADES,
  host: 'Player1',
  players: {
    Player1: { isHost: true, joinedAt: 1000, name: 'Player1', pin: '1111' },
    Player2: { isHost: false, joinedAt: 1001, name: 'Player2', pin: '2222' },
  },
  status: LOBBY_STATUS.WAITING,
  ...overrides,
});

const createLobbyPlayersByCount = (playersCount) =>
  Object.fromEntries(
    Array.from({ length: playersCount }, (_, idx) => [
      `Player${idx + 1}`,
      {
        isHost: idx === 0,
        joinedAt: 1000 + idx,
        name: `Player${idx + 1}`,
        pin: String(1111 + idx),
      },
    ])
  );

const useTransactionData = (initialData) => {
  let data = deepClone(initialData);

  runTransaction.mockImplementation(async (pathRef, updater) => {
    data = updater(data);
    return { committed: true, snapshot: { val: () => data } };
  });

  return {
    getData: () => data,
  };
};

describe('lobbyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    push.mockReturnValue({ key: 'lobby-1' });
    generateUniqueCode.mockReturnValue('GAME01');
  });

  describe('getLobbyIdByCode', () => {
    it('normalizes a game code and returns the mapped lobby id', async () => {
      get.mockResolvedValue(snapshot('lobby-123'));

      await expect(lobbyService.getLobbyIdByCode(' abc123 ')).resolves.toBe('lobby-123');
      expect(ref).toHaveBeenCalledWith(db, 'lobbyCodes/ABC123');
      expect(get).toHaveBeenCalledWith({ database: db, path: 'lobbyCodes/ABC123' });
    });

    it('returns an empty string for missing or blank game codes', async () => {
      await expect(lobbyService.getLobbyIdByCode('   ')).resolves.toBe('');
      await expect(lobbyService.getLobbyIdByCode(null)).resolves.toBe('');
      expect(get).not.toHaveBeenCalled();
    });

    it('returns an empty string when the code mapping is not found', async () => {
      get.mockResolvedValue(snapshot(null, false));

      await expect(lobbyService.getLobbyIdByCode('MISS01')).resolves.toBe('');
    });

    it('propagates Firebase lookup failures', async () => {
      get.mockRejectedValue(new Error('firebase get failed'));

      await expect(lobbyService.getLobbyIdByCode('ERR001')).rejects.toThrow('firebase get failed');
    });
  });

  describe('createGameSession', () => {
    it('creates a lobby and game-code mapping', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(2000);
      get.mockResolvedValue(snapshot(null, false));

      await expect(
        lobbyService.createGameSession('Player1', '1111', GAME_TYPE.SPADES)
      ).resolves.toEqual({
        gameCode: 'GAME01',
        lobbyId: 'lobby-1',
      });

      expect(push).toHaveBeenCalledWith({ database: db, path: 'lobby' });
      expect(set).toHaveBeenNthCalledWith(
        1,
        { database: db, path: 'lobby/lobby-1' },
        {
          createdAt: 'SERVER_TIMESTAMP',
          gameCode: 'GAME01',
          gameType: GAME_TYPE.SPADES,
          host: 'Player1',
          players: {
            Player1: {
              isHost: true,
              joinedAt: 2000,
              name: 'Player1',
              pin: '1111',
            },
          },
          status: LOBBY_STATUS.WAITING,
        }
      );
      expect(set).toHaveBeenNthCalledWith(
        2,
        { database: db, path: 'lobbyCodes/GAME01' },
        'lobby-1'
      );
      expect(serverTimestamp).toHaveBeenCalledTimes(1);
    });

    it('rejects reserved bot names before allocating a lobby', async () => {
      await expect(
        lobbyService.createGameSession(
          ` ${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT} `,
          '1111',
          GAME_TYPE.SPADES
        )
      ).rejects.toThrow(
        `${BOT_NAME_PREFIX} 1 through ${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT} are reserved names`
      );

      expect(push).not.toHaveBeenCalled();
      expect(set).not.toHaveBeenCalled();
    });

    it('allows player names outside the reserved bot range', async () => {
      get.mockResolvedValue(snapshot(null, false));

      await expect(
        lobbyService.createGameSession(
          `${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT + 1}`,
          '1111',
          GAME_TYPE.SPADES
        )
      ).resolves.toEqual({
        gameCode: 'GAME01',
        lobbyId: 'lobby-1',
      });
    });

    it('skips duplicate generated game codes before creating a lobby', async () => {
      generateUniqueCode.mockReturnValueOnce('USED01').mockReturnValueOnce('FREE02');
      get
        .mockResolvedValueOnce(snapshot('existing-lobby'))
        .mockResolvedValueOnce(snapshot(null, false));

      await expect(
        lobbyService.createGameSession('Player1', '1111', GAME_TYPE.SPADES)
      ).resolves.toEqual({
        gameCode: 'FREE02',
        lobbyId: 'lobby-1',
      });
      expect(ref).toHaveBeenCalledWith(db, 'lobbyCodes/USED01');
      expect(ref).toHaveBeenCalledWith(db, 'lobbyCodes/FREE02');
    });

    it('throws when Firebase cannot allocate a lobby id', async () => {
      push.mockReturnValue({ key: '' });

      await expect(
        lobbyService.createGameSession('Player1', '1111', GAME_TYPE.SPADES)
      ).rejects.toThrow('Failed to allocate lobby id');
      expect(set).not.toHaveBeenCalled();
    });

    it('throws when all generated game codes already exist', async () => {
      get.mockResolvedValue(snapshot('taken-lobby'));

      await expect(
        lobbyService.createGameSession('Player1', '1111', GAME_TYPE.SPADES)
      ).rejects.toThrow('Failed to allocate a unique game code');
      expect(generateUniqueCode).toHaveBeenCalledTimes(MAX_ATTEMPTS);
      expect(set).not.toHaveBeenCalled();
    });

    it('propagates Firebase write failures', async () => {
      get.mockResolvedValue(snapshot(null, false));
      set.mockRejectedValueOnce(new Error('set failed'));

      await expect(
        lobbyService.createGameSession('Player1', '1111', GAME_TYPE.SPADES)
      ).rejects.toThrow('set failed');
    });
  });

  describe('joinGameSession', () => {
    it('adds a new player to a waiting lobby', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(3000);
      get.mockResolvedValueOnce(snapshot('lobby-1')).mockResolvedValueOnce(snapshot(createLobby()));

      await expect(lobbyService.joinGameSession(' play01 ', 'Player3', '3333')).resolves.toEqual({
        error: '',
        lobbyId: 'lobby-1',
      });
      expect(update).toHaveBeenCalledWith(
        { database: db, path: 'lobby/lobby-1/players' },
        {
          Player3: {
            isHost: false,
            joinedAt: 3000,
            name: 'Player3',
            pin: '3333',
          },
        }
      );
    });

    it('rejects reserved bot names before looking up a lobby', async () => {
      await expect(
        lobbyService.joinGameSession('PLAY01', ` ${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT} `, '3333')
      ).resolves.toEqual({
        error: `${BOT_NAME_PREFIX} 1 through ${BOT_NAME_PREFIX} ${BOT_NAME_LIMIT} are reserved names`,
        lobbyId: '',
      });

      expect(get).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('allows an existing player to rejoin with the matching pin', async () => {
      get.mockResolvedValueOnce(snapshot('lobby-1')).mockResolvedValueOnce(snapshot(createLobby()));

      await expect(lobbyService.joinGameSession('PLAY01', 'Player1', '1111')).resolves.toEqual({
        error: '',
        lobbyId: 'lobby-1',
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('returns game-not-found when the code mapping is missing or blank', async () => {
      get.mockResolvedValue(snapshot(null, false));

      await expect(lobbyService.joinGameSession('MISS01', 'Player3', '3333')).resolves.toEqual({
        error: 'Game not found',
        lobbyId: '',
      });
      await expect(lobbyService.joinGameSession('', 'Player3', '3333')).resolves.toEqual({
        error: 'Game not found',
        lobbyId: '',
      });
    });

    it('returns game-not-found when the lobby record is missing', async () => {
      get.mockResolvedValueOnce(snapshot('lobby-1')).mockResolvedValueOnce(snapshot(null, false));

      await expect(lobbyService.joinGameSession('PLAY01', 'Player3', '3333')).resolves.toEqual({
        error: 'Game not found',
        lobbyId: '',
      });
    });

    it('blocks new players when the lobby is full', async () => {
      get.mockResolvedValueOnce(snapshot('lobby-1')).mockResolvedValueOnce(
        snapshot(
          createLobby({
            players: {
              Player1: { pin: '1111' },
              Player2: { pin: '2222' },
              Player3: { pin: '3333' },
              Player4: { pin: '4444' },
            },
          })
        )
      );

      await expect(lobbyService.joinGameSession('PLAY01', 'Player5', '5555')).resolves.toEqual({
        error: 'Lobby is full',
        lobbyId: '',
      });
      expect(update).not.toHaveBeenCalled();
    });

    it('blocks new players after the game has started', async () => {
      get
        .mockResolvedValueOnce(snapshot('lobby-1'))
        .mockResolvedValueOnce(snapshot(createLobby({ status: LOBBY_STATUS.IN_GAME })));

      await expect(lobbyService.joinGameSession('PLAY01', 'Player3', '3333')).resolves.toEqual({
        error: 'Game has already started',
        lobbyId: '',
      });
    });

    it('rejects duplicate player names with the wrong pin', async () => {
      get.mockResolvedValueOnce(snapshot('lobby-1')).mockResolvedValueOnce(snapshot(createLobby()));

      await expect(lobbyService.joinGameSession('PLAY01', 'Player1', '9999')).resolves.toEqual({
        error: 'Invalid details, try again',
        lobbyId: '',
      });
    });

    it('propagates Firebase update failures when adding a player', async () => {
      get.mockResolvedValueOnce(snapshot('lobby-1')).mockResolvedValueOnce(snapshot(createLobby()));
      update.mockRejectedValueOnce(new Error('join update failed'));

      await expect(lobbyService.joinGameSession('PLAY01', 'Player3', '3333')).rejects.toThrow(
        'join update failed'
      );
    });
  });

  describe('updateVariant', () => {
    it('updates the selected variant path and payload', async () => {
      await lobbyService.updateVariant('lobby-1', SPADES_VARIANT.CLASSIC);

      expect(update).toHaveBeenCalledWith(
        { database: db, path: 'lobby/lobby-1' },
        { variant: SPADES_VARIANT.CLASSIC }
      );
    });

    it('propagates Firebase transaction failures', async () => {
      update.mockRejectedValueOnce(new Error('variant update failed'));

      await expect(lobbyService.updateVariant('lobby-1', SPADES_VARIANT.CLASSIC)).rejects.toThrow(
        'variant update failed'
      );
    });
  });

  describe('removePlayer', () => {
    it('removes a non-host player while preserving the current host', async () => {
      const transaction = useTransactionData(createLobby());

      await lobbyService.removePlayer('lobby-1', 'Player2');

      const data = transaction.getData();
      expect(ref).toHaveBeenCalledWith(db, 'lobby/lobby-1');
      expect(data.host).toBe('Player1');
      expect(data.players.Player1.isHost).toBe(true);
      expect(data.players.Player2).toBeUndefined();
      expect(update).not.toHaveBeenCalled();
    });

    it('assigns host ownership to the next joined human player when the host leaves', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { isHost: true, joinedAt: 1000, name: 'Player1', pin: '1111' },
            [`${BOT_NAME_PREFIX} 1`]: {
              isBot: true,
              isHost: false,
              joinedAt: 1001,
              name: `${BOT_NAME_PREFIX} 1`,
              pin: BOT_PIN,
            },
            Player3: { isHost: false, joinedAt: 1002, name: 'Player3', pin: '3333' },
            Player2: { isHost: false, joinedAt: 1003, name: 'Player2', pin: '2222' },
          },
        })
      );

      await lobbyService.removePlayer('lobby-1', 'Player1');

      const data = transaction.getData();
      expect(data.host).toBe('Player3');
      expect(data.players.Player1).toBeUndefined();
      expect(data.players.Player3.isHost).toBe(true);
      expect(data.players.Player2.isHost).toBe(false);
      expect(data.players[`${BOT_NAME_PREFIX} 1`].isHost).toBe(false);
    });

    it('clears host ownership when no human players remain', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { isHost: true, joinedAt: 1000, name: 'Player1', pin: '1111' },
            [`${BOT_NAME_PREFIX} 1`]: {
              isBot: true,
              isHost: false,
              joinedAt: 1001,
              name: `${BOT_NAME_PREFIX} 1`,
              pin: BOT_PIN,
            },
          },
        })
      );

      await lobbyService.removePlayer('lobby-1', 'Player1');

      const data = transaction.getData();
      expect(data.host).toBe('');
      expect(data.players.Player1).toBeUndefined();
      expect(data.players[`${BOT_NAME_PREFIX} 1`].isHost).toBe(false);
    });

    it('marks the lobby cancelled when the last player leaves', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { isHost: true, joinedAt: 1000, name: 'Player1', pin: '1111' },
          },
        })
      );

      await lobbyService.removePlayer('lobby-1', 'Player1');

      const data = transaction.getData();
      expect(data.host).toBe('');
      expect(data.players).toEqual({});
      expect(data.status).toBe(LOBBY_STATUS.CANCELLED);
    });

    it('handles missing lobby data and missing players without changing state', async () => {
      const missingLobbyTransaction = useTransactionData(null);
      await lobbyService.removePlayer('lobby-1', 'Player1');
      expect(missingLobbyTransaction.getData()).toBeNull();

      const missingPlayerTransaction = useTransactionData(createLobby());
      await lobbyService.removePlayer('lobby-1', 'MissingPlayer');
      expect(missingPlayerTransaction.getData()).toEqual(createLobby());
    });

    it('propagates Firebase update failures', async () => {
      runTransaction.mockRejectedValueOnce(new Error('remove failed'));

      await expect(lobbyService.removePlayer('lobby-1', 'Player2')).rejects.toThrow(
        'remove failed'
      );
    });
  });

  describe('addBot', () => {
    it('adds the next available bot player in a waiting lobby', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(4000);
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { isHost: true, joinedAt: 1000, name: 'Player1', pin: '1111' },
            [`${BOT_NAME_PREFIX} 1`]: {
              isBot: true,
              isHost: false,
              joinedAt: 3000,
              name: `${BOT_NAME_PREFIX} 1`,
              pin: BOT_PIN,
            },
          },
        })
      );

      await expect(lobbyService.addBot('lobby-1')).resolves.toBe(`${BOT_NAME_PREFIX} 2`);

      expect(ref).toHaveBeenCalledWith(db, 'lobby/lobby-1');
      expect(transaction.getData().players[`${BOT_NAME_PREFIX} 2`]).toEqual({
        isBot: true,
        isHost: false,
        joinedAt: 4000,
        name: `${BOT_NAME_PREFIX} 2`,
        pin: BOT_PIN,
      });
    });

    it('does not add bots after start, at capacity, or for missing lobbies', async () => {
      const inGameTransaction = useTransactionData(createLobby({ status: LOBBY_STATUS.IN_GAME }));
      await expect(lobbyService.addBot('lobby-1')).resolves.toBe('');
      expect(Object.keys(inGameTransaction.getData().players)).toHaveLength(2);

      const fullTransaction = useTransactionData(
        createLobby({
          players: {
            Player1: { pin: '1111' },
            Player2: { pin: '2222' },
            Player3: { pin: '3333' },
            Player4: { pin: '4444' },
          },
        })
      );
      await expect(lobbyService.addBot('lobby-1')).resolves.toBe('');
      expect(Object.keys(fullTransaction.getData().players)).toHaveLength(4);

      const missingTransaction = useTransactionData(null);
      await expect(lobbyService.addBot('lobby-1')).resolves.toBe('');
      expect(missingTransaction.getData()).toBeNull();
    });

    it('throws for missing ids and propagates Firebase failures', async () => {
      await expect(lobbyService.addBot('')).rejects.toThrow('Missing lobbyId');

      runTransaction.mockRejectedValueOnce(new Error('bot add failed'));
      await expect(lobbyService.addBot('lobby-1')).rejects.toThrow('bot add failed');
    });
  });

  describe('startGame', () => {
    it('starts the game, initializes player fields, and creates the first round', async () => {
      const lobbyData = createLobby({
        players: {
          Player1: { name: 'Player1', pin: '1111' },
          Player2: { name: 'Player2', pin: '2222' },
          Player3: { name: 'Player3', pin: '3333' },
          Player4: { name: 'Player4', pin: '4444' },
        },
      });
      const lobbyBefore = JSON.parse(JSON.stringify(lobbyData));
      get.mockResolvedValue(snapshot(lobbyData));
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await lobbyService.startGame('lobby-1', SPADES_VARIANT.CLASSIC);

      const updates = update.mock.calls[0][1];
      expect(update).toHaveBeenCalledWith({ database: db, path: '' }, expect.any(Object));
      expect(updates['lobby/lobby-1/status']).toBe(LOBBY_STATUS.IN_GAME);
      expect(updates['lobby/lobby-1/roundNumber']).toBe(12);
      expect(updates['lobby/lobby-1/variant']).toBe(SPADES_VARIANT.CLASSIC);
      expect(updates['lobby/lobby-1/currentPlayerIdx']).toBe(0);
      expect(
        ['Player1', 'Player2', 'Player3', 'Player4'].map(
          (name) => updates[`lobby/lobby-1/players/${name}/score`]
        )
      ).toEqual([0, 0, 0, 0]);
      expect(
        new Set(
          ['Player1', 'Player2', 'Player3', 'Player4'].map(
            (name) => updates[`lobby/lobby-1/players/${name}/orderIdx`]
          )
        )
      ).toEqual(new Set([0, 1, 2, 3]));
      expect(gameService.addNewRound).toHaveBeenCalledWith('lobby-1');
      expect(lobbyData).toEqual(lobbyBefore);
    });

    it('uses the computed Bid Whist No Trump cap when seeding the first round', async () => {
      const lobbyData = createLobby({
        gameType: GAME_TYPE.BID_WHIST,
        players: createLobbyPlayersByCount(7),
      });
      get.mockResolvedValue(snapshot(lobbyData));
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await lobbyService.startGame('lobby-1', BID_WHIST_VARIANT.NO_TRUMP);

      const updates = update.mock.calls[0][1];
      expect(updates['lobby/lobby-1/roundNumber']).toBe(Math.floor(MAX_CARDS / 7) - 1);
      expect(updates['lobby/lobby-1/variant']).toBe(BID_WHIST_VARIANT.NO_TRUMP);
      expect(gameService.addNewRound).toHaveBeenCalledWith('lobby-1');
    });

    it('throws when the lobby is not found', async () => {
      get.mockResolvedValue(snapshot(null, false));

      await expect(lobbyService.startGame('lobby-1', SPADES_VARIANT.CLASSIC)).rejects.toThrow(
        'Game session not found'
      );
    });

    it('throws when the lobby has no players', async () => {
      get.mockResolvedValue(snapshot(createLobby({ players: {} })));

      await expect(lobbyService.startGame('lobby-1', SPADES_VARIANT.CLASSIC)).rejects.toThrow(
        'No players found in lobby'
      );
    });

    it('throws when the variant has no configured round count', async () => {
      get.mockResolvedValue(snapshot(createLobby()));

      await expect(lobbyService.startGame('lobby-1', 'Broken Variant')).rejects.toThrow(
        'Invalid variant. Please select a valid game variant before starting'
      );
    });

    it('propagates Firebase update and add-round failures', async () => {
      get.mockResolvedValue(snapshot(createLobby()));
      update.mockRejectedValueOnce(new Error('start update failed'));

      await expect(lobbyService.startGame('lobby-1', SPADES_VARIANT.CLASSIC)).rejects.toThrow(
        'start update failed'
      );

      update.mockResolvedValueOnce();
      gameService.addNewRound.mockRejectedValueOnce(new Error('round failed'));

      await expect(lobbyService.startGame('lobby-1', SPADES_VARIANT.CLASSIC)).rejects.toThrow(
        'round failed'
      );
    });
  });

  describe('subscribeToLobby', () => {
    it('returns a noop unsubscribe for missing lobby ids', () => {
      const unsubscribe = lobbyService.subscribeToLobby({ lobbyId: '', onChange: vi.fn() });

      expect(unsubscribe()).toBeUndefined();
      expect(onValue).not.toHaveBeenCalled();
    });

    it('subscribes to lobby changes and forwards snapshot values', () => {
      const unsubscribe = vi.fn();
      const onChange = vi.fn();
      onValue.mockImplementation((pathRef, handleChange) => {
        handleChange(snapshot({ status: LOBBY_STATUS.WAITING }));
        return unsubscribe;
      });

      expect(lobbyService.subscribeToLobby({ lobbyId: 'lobby-1', onChange })).toBe(unsubscribe);
      expect(onValue).toHaveBeenCalledWith(
        { database: db, path: 'lobby/lobby-1' },
        expect.any(Function),
        expect.any(Function)
      );
      expect(onChange).toHaveBeenCalledWith({ status: LOBBY_STATUS.WAITING });
    });

    it('forwards null snapshot values and subscription errors when callbacks are provided', () => {
      const onChange = vi.fn();
      const onError = vi.fn();
      const err = new Error('subscribe failed');
      onValue.mockImplementation((pathRef, handleChange, handleError) => {
        handleChange(snapshot(null, false));
        handleError(err);
        return vi.fn();
      });

      lobbyService.subscribeToLobby({ lobbyId: 'lobby-1', onChange, onError });

      expect(onChange).toHaveBeenCalledWith(null);
      expect(onError).toHaveBeenCalledWith(err);
    });
  });
});
