import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref, runTransaction } from 'firebase/database';

import { gameService } from '../game-service';

import {
  BIDDING,
  BID_WHIST_VARIANT,
  CLUB,
  DIAMOND,
  FINALIZING_RESULTS_MESSAGE,
  GAME_OVER_STATUS,
  GAME_STATUS,
  GAME_TYPE,
  HEART,
  JOKER,
  MAX_ACCUMULATED,
  MAX_CARDS,
  MAX_ROUNDS,
  NEW_ROUND_STATUS,
  NEW_TURN_STATUS,
  ROUND_START_MESSAGE,
  SELECT_TRUMP_STATUS,
  SPADE,
  TURN_START_MESSAGE,
} from '../../constants';
import { db } from '../../firebase';
import { dealCards } from '../../utils';

vi.mock('firebase/database', () => ({
  ref: vi.fn((database, path = '') => ({ database, path })),
  runTransaction: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  db: { mockDb: true },
}));

vi.mock('../../utils', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    dealCards: vi.fn(),
  };
});

const deepClone = (value) =>
  typeof value === 'undefined' ? undefined : JSON.parse(JSON.stringify(value));

const card = (value, suit) => ({ value, suit });

const createPlayers = () => ({
  Player1: { accumulated: 0, cards: [card('A', SPADE), card('10', HEART)], orderIdx: 0, score: 0 },
  Player2: { accumulated: 0, cards: [card('K', SPADE), card('9', HEART)], orderIdx: 1, score: 0 },
  Player3: { accumulated: 0, cards: [card('Q', SPADE), card('8', HEART)], orderIdx: 2, score: 0 },
  Player4: { accumulated: 0, cards: [card('J', SPADE), card('7', HEART)], orderIdx: 3, score: 0 },
});

const createRoundPlayers = (overrides = {}) => ({
  Player1: { bids: 1, played: [], wins: 0, ...overrides.Player1 },
  Player2: { bids: 1, played: [], wins: 0, ...overrides.Player2 },
  Player3: { bids: 1, played: [], wins: 0, ...overrides.Player3 },
  Player4: { bids: 1, played: [], wins: 0, ...overrides.Player4 },
});

const createNewRoundPlayers = () => ({
  Player1: { bids: 0, played: [], wins: 0 },
  Player2: { bids: 0, played: [], wins: 0 },
  Player3: { bids: 0, played: [], wins: 0 },
  Player4: { bids: 0, played: [], wins: 0 },
});

const createPlayersByCount = (playersCount) =>
  Object.fromEntries(
    Array.from({ length: playersCount }, (_, idx) => [
      `Player${idx + 1}`,
      { accumulated: 0, cards: [], orderIdx: idx, score: 0 },
    ])
  );

const createRoundPlayersByCount = (playersCount, overrides = {}) =>
  Object.fromEntries(
    Array.from({ length: playersCount }, (_, idx) => {
      const playerName = `Player${idx + 1}`;
      return [playerName, { bids: 0, played: [], wins: 0, ...overrides[playerName] }];
    })
  );

const playedOnTurn = (turnCount, cardDetails) =>
  Array(turnCount - 1)
    .fill(null)
    .concat(cardDetails);

const playedOnLastTurn = (cardDetails) => playedOnTurn(MAX_ROUNDS, cardDetails);

const createLobby = (overrides = {}) => ({
  currentPlayerIdx: 0,
  gameType: GAME_TYPE.SPADES,
  host: 'Player1',
  players: createPlayers(),
  roundNumber: 1,
  roundStatus: GAME_STATUS,
  rounds: [
    {
      currentTurn: 1,
      players: createRoundPlayers(),
      startPlayerIdx: 0,
      trumpSuit: SPADE,
    },
  ],
  statusText: '',
  variant: 'Classic',
  ...overrides,
});

const useTransactionData = (initialData) => {
  let data = deepClone(initialData);
  const states = [];

  runTransaction.mockImplementation(async (pathRef, updater) => {
    data = updater(data);
    states.push(deepClone(data));
    return { committed: true, snapshot: { val: () => data } };
  });

  return {
    getData: () => data,
    states,
  };
};

const expectLobbyRef = (lobbyId = 'lobby-1') => {
  expect(ref).toHaveBeenCalledWith(db, `lobby/${lobbyId}`);
};

describe('gameService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dealCards.mockReturnValue({
      dealtCards: [[card('A', SPADE)], [card('K', HEART)], [card('Q', CLUB)], [card('J', DIAMOND)]],
      remainingCards: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getEffectiveSuit', () => {
    it('maps jokers to trump and leaves other suits unchanged', () => {
      expect(gameService.getEffectiveSuit(card('SJ', JOKER), { trumpSuit: HEART })).toBe(HEART);
      expect(gameService.getEffectiveSuit(card('A', SPADE), { trumpSuit: HEART })).toBe(SPADE);
      expect(gameService.getEffectiveSuit(card('SJ', JOKER), {})).toBe(JOKER);
    });
  });

  describe('addNewRound', () => {
    it('adds a BIDDING round, deals cards, and positions the starting player', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          roundNumber: 0,
          rounds: [],
          variant: BID_WHIST_VARIANT.UPTOWN,
        })
      );

      await gameService.addNewRound('lobby-1');

      const data = transaction.getData();
      expectLobbyRef();
      expect(dealCards).toHaveBeenCalledWith(4, 1, true);
      expect(data.roundNumber).toBe(1);
      expect(data.roundStatus).toBe(BIDDING);
      expect(data.statusText).toBe('');
      expect(data.currentPlayerIdx).toBe(0);
      expect(data.rounds).toEqual([
        {
          currentTurn: 0,
          players: createNewRoundPlayers(),
          startPlayerIdx: 0,
          trumpSuit: '',
        },
      ]);
      expect(data.players.Player1.cards).toEqual([card('A', SPADE)]);
      expect(data.players.Player4.cards).toEqual([card('J', DIAMOND)]);
    });

    it('rotates the starting player by round number and recreates an invalid rounds collection', async () => {
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 2,
          rounds: {},
        })
      );

      await gameService.addNewRound('lobby-1');

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(2);
      expect(data.roundNumber).toBe(3);
      expect(data.rounds).toEqual([
        {
          currentTurn: 0,
          players: createNewRoundPlayers(),
          startPlayerIdx: 2,
          trumpSuit: '',
        },
      ]);
    });

    it('caps Bid Whist Uptown rounds using 54 cards across the player count', async () => {
      const players = createPlayersByCount(5);
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players,
          roundNumber: Math.floor((MAX_CARDS + 2) / 5) - 1,
          rounds: [],
          variant: BID_WHIST_VARIANT.UPTOWN,
        })
      );

      await gameService.addNewRound('lobby-1');

      expect(dealCards).toHaveBeenCalledWith(5, Math.floor((MAX_CARDS + 2) / 5), true);
      expect(transaction.getData().roundNumber).toBe(Math.floor((MAX_CARDS + 2) / 5));
    });

    it('caps Bid Whist No Trump rounds using 52 cards across the player count', async () => {
      const players = createPlayersByCount(7);
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players,
          roundNumber: Math.floor(MAX_CARDS / 7) - 1,
          rounds: [],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await gameService.addNewRound('lobby-1');

      expect(dealCards).toHaveBeenCalledWith(7, Math.floor(MAX_CARDS / 7), false);
      expect(transaction.getData().roundNumber).toBe(Math.floor(MAX_CARDS / 7));
    });

    it('throws for a missing lobby id before touching Firebase', async () => {
      await expect(gameService.addNewRound('')).rejects.toThrow('Missing lobbyId.');
      expect(runTransaction).not.toHaveBeenCalled();
    });

    it('returns null transaction data without dealing when the lobby is missing', async () => {
      const transaction = useTransactionData(null);

      await gameService.addNewRound('lobby-1');

      expect(transaction.getData()).toBeNull();
      expect(dealCards).not.toHaveBeenCalled();
    });

    it('propagates missing player data and Firebase transaction failures', async () => {
      useTransactionData(createLobby({ players: {} }));
      dealCards.mockImplementationOnce(() => {
        throw new Error('numPlayers must be a positive integer.');
      });
      await expect(gameService.addNewRound('lobby-1')).rejects.toThrow(
        'numPlayers must be a positive integer.'
      );

      runTransaction.mockRejectedValueOnce(new Error('transaction failed'));
      await expect(gameService.addNewRound('lobby-1')).rejects.toThrow('transaction failed');
    });
  });

  describe('updateRoundState', () => {
    it('records a played card, removes it from the player hand, and advances turn order', async () => {
      const playedCard = card('A', SPADE);
      const transaction = useTransactionData(createLobby());
      const originalCard = deepClone(playedCard);

      await gameService.updateRoundState('lobby-1', 'Player1', playedCard, undefined, true);

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player1.played).toEqual([playedCard]);
      expect(data.players.Player1.cards).toEqual([card('10', HEART)]);
      expect(data.currentPlayerIdx).toBe(1);
      expect(playedCard).toEqual(originalCard);
    });

    it('updates bids without changing player position when not requested', async () => {
      const transaction = useTransactionData(createLobby());

      await gameService.updateRoundState('lobby-1', 'Player2', {}, '3', false);

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player2.bids).toBe(3);
      expect(data.rounds.at(-1).players.Player2.played).toEqual([]);
      expect(data.currentPlayerIdx).toBe(0);
    });

    it('records card details even when the card is not found in hand', async () => {
      const transaction = useTransactionData(createLobby());

      await gameService.updateRoundState('lobby-1', 'Player1', card('2', CLUB), undefined, false);

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player1.played).toEqual([card('2', CLUB)]);
      expect(data.players.Player1.cards).toEqual([card('A', SPADE), card('10', HEART)]);
    });

    it('matches cards by type when suit is absent', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            ...createPlayers(),
            Player1: {
              accumulated: 0,
              cards: [{ type: JOKER, value: 'SJ' }, card('10', HEART)],
              orderIdx: 0,
              score: 0,
            },
          },
        })
      );

      await gameService.updateRoundState(
        'lobby-1',
        'Player1',
        { type: JOKER, value: 'SJ' },
        undefined,
        false
      );

      expect(transaction.getData().players.Player1.cards).toEqual([card('10', HEART)]);
    });

    it('throws for missing lobby ids and propagates Firebase failures', async () => {
      await expect(gameService.updateRoundState('', 'Player1', {}, undefined)).rejects.toThrow(
        'Missing lobbyId.'
      );

      runTransaction.mockRejectedValueOnce(new Error('state transaction failed'));
      await expect(
        gameService.updateRoundState('lobby-1', 'Player1', {}, undefined)
      ).rejects.toThrow('state transaction failed');
    });

    it('returns null transaction data when the lobby is missing', async () => {
      const transaction = useTransactionData(null);

      await gameService.updateRoundState('lobby-1', 'Player1', card('A', SPADE), 2, true);

      expect(transaction.getData()).toBeNull();
    });
  });

  describe('updateRoundTrump', () => {
    it('sets trump, starts turn one, and moves to game status', async () => {
      const transaction = useTransactionData(createLobby());

      await gameService.updateRoundTrump('lobby-1', HEART);

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(0);
      expect(data.roundStatus).toBe(GAME_STATUS);
      expect(data.rounds.at(-1).currentTurn).toBe(1);
      expect(data.rounds.at(-1).trumpSuit).toBe(HEART);
    });

    it('moves Bid Whist control to the highest bidder before selecting trump', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players: {
            ...createPlayers(),
            Player2: { ...createPlayers().Player2, orderIdx: 1 },
            Player3: { ...createPlayers().Player3, orderIdx: 2 },
          },
          rounds: [
            {
              currentTurn: 0,
              players: createRoundPlayers({
                Player1: { bids: 1 },
                Player2: { bids: 3 },
                Player3: { bids: 3 },
                Player4: { bids: 2 },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.UPTOWN,
        })
      );

      await gameService.updateRoundTrump('lobby-1', undefined);

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(1);
      expect(data.roundStatus).toBe(SELECT_TRUMP_STATUS);
      expect(data.rounds.at(-1).startPlayerIdx).toBe(1);
      expect(data.rounds.at(-1).trumpSuit).toBe('');
    });

    it('moves Bid Whist no-trump control to the highest bidder before play starts', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          rounds: [
            {
              currentTurn: 0,
              players: createRoundPlayers({
                Player1: { bids: 1 },
                Player2: { bids: 4 },
                Player3: { bids: 2 },
                Player4: { bids: 3 },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await gameService.updateRoundTrump('lobby-1', '');

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(1);
      expect(data.roundStatus).toBe(GAME_STATUS);
      expect(data.rounds.at(-1).currentTurn).toBe(1);
      expect(data.rounds.at(-1).startPlayerIdx).toBe(1);
      expect(data.rounds.at(-1).trumpSuit).toBe('');
    });

    it('breaks tied bids by round start order before trump selection', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          rounds: [
            {
              currentTurn: 0,
              players: createRoundPlayers({
                Player1: { bids: 2 },
                Player2: { bids: 2 },
                Player3: { bids: 2 },
                Player4: { bids: 2 },
              }),
              startPlayerIdx: 2,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.UPTOWN,
        })
      );

      await gameService.updateRoundTrump('lobby-1', undefined);

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(2);
      expect(data.roundStatus).toBe(SELECT_TRUMP_STATUS);
      expect(data.rounds.at(-1).startPlayerIdx).toBe(2);
    });

    it('keeps tied no-trump bids with the first bidder in round order', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          rounds: [
            {
              currentTurn: 0,
              players: createRoundPlayers({
                Player1: { bids: 2 },
                Player2: { bids: 2 },
                Player3: { bids: 2 },
                Player4: { bids: 2 },
              }),
              startPlayerIdx: 3,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await gameService.updateRoundTrump('lobby-1', '');

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(3);
      expect(data.roundStatus).toBe(GAME_STATUS);
      expect(data.rounds.at(-1).currentTurn).toBe(1);
      expect(data.rounds.at(-1).startPlayerIdx).toBe(3);
    });

    it('rejects null trump values while preserving Firebase error propagation', async () => {
      useTransactionData(createLobby());
      await expect(gameService.updateRoundTrump('lobby-1', null)).rejects.toThrow(
        'Invalid trump suit.'
      );

      runTransaction.mockRejectedValueOnce(new Error('trump transaction failed'));
      await expect(gameService.updateRoundTrump('lobby-1', HEART)).rejects.toThrow(
        'trump transaction failed'
      );
    });

    it('throws for missing lobby ids and returns null transaction data for missing lobbies', async () => {
      await expect(gameService.updateRoundTrump('', HEART)).rejects.toThrow('Missing lobbyId.');

      const transaction = useTransactionData(null);
      await gameService.updateRoundTrump('lobby-1', HEART);
      expect(transaction.getData()).toBeNull();
    });
  });

  describe('processBotAction', () => {
    it('does nothing when the caller is not the host', async () => {
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 1,
          players: {
            ...createPlayers(),
            Player2: { ...createPlayers().Player2, isBot: true },
          },
          roundStatus: BIDDING,
          rounds: [
            {
              currentTurn: 0,
              players: createNewRoundPlayers(),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player2')).resolves.toBe(false);

      const data = transaction.getData();
      expect(data.currentPlayerIdx).toBe(1);
      expect(data.rounds.at(-1).players.Player2.hasBid).toBeUndefined();
    });

    it('bids for consecutive bots from the host machine only', async () => {
      const players = createPlayers();
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 1,
          players: {
            ...players,
            Player2: {
              ...players.Player2,
              cards: [card('A', SPADE), card('K', SPADE), card('A', HEART)],
              isBot: true,
            },
            Player3: {
              ...players.Player3,
              cards: [card('2', CLUB), card('3', DIAMOND), card('4', HEART)],
              isBot: true,
            },
          },
          roundNumber: 3,
          roundStatus: BIDDING,
          rounds: [
            {
              currentTurn: 0,
              players: createNewRoundPlayers(),
              startPlayerIdx: 1,
              trumpSuit: '',
            },
          ],
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(true);
      expect(transaction.getData().rounds.at(-1).players.Player2).toMatchObject({
        bids: 3,
        hasBid: true,
      });
      expect(transaction.getData().currentPlayerIdx).toBe(2);

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(true);
      expect(transaction.getData().rounds.at(-1).players.Player3.hasBid).toBe(true);
      expect(transaction.getData().currentPlayerIdx).toBe(3);
    });

    it('chooses trump from low-card strength for Bid Whist Downtown', async () => {
      const players = createPlayers();
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 1,
          gameType: GAME_TYPE.BID_WHIST,
          players: {
            ...players,
            Player2: {
              ...players.Player2,
              cards: [card('2', CLUB), card('3', CLUB), card('4', CLUB), card('A', HEART)],
              isBot: true,
            },
          },
          roundStatus: SELECT_TRUMP_STATUS,
          rounds: [
            {
              currentTurn: 0,
              players: createRoundPlayers({
                Player2: { bids: 3, hasBid: true },
              }),
              startPlayerIdx: 1,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.DOWNTOWN,
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(true);

      const data = transaction.getData();
      expect(data.roundStatus).toBe(GAME_STATUS);
      expect(data.currentPlayerIdx).toBe(1);
      expect(data.rounds.at(-1).currentTurn).toBe(1);
      expect(data.rounds.at(-1).trumpSuit).toBe(CLUB);
    });

    it('follows suit and plays the cheapest winning card when a bot needs a trick', async () => {
      const players = createPlayers();
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 1,
          gameType: GAME_TYPE.BID_WHIST,
          players: {
            ...players,
            Player2: {
              ...players.Player2,
              cards: [card('Q', CLUB), card('K', CLUB), card('A', SPADE)],
              isBot: true,
            },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('J', CLUB)] },
                Player2: { bids: 1, played: [], wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(true);

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player2.played).toEqual([card('Q', CLUB)]);
      expect(data.players.Player2.cards).toEqual([card('K', CLUB), card('A', SPADE)]);
      expect(data.currentPlayerIdx).toBe(2);
    });

    it('supports a winning Spades teammate instead of overtaking the trick', async () => {
      const players = createPlayers();
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 2,
          players: {
            ...players,
            Player3: {
              ...players.Player3,
              cards: [card('Q', HEART), card('2', HEART), card('A', SPADE)],
              isBot: true,
            },
          },
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, played: [card('A', HEART)], wins: 0 },
                Player2: { bids: 1, played: [card('K', HEART)], wins: 0 },
                Player3: { bids: 2, played: [], wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(true);

      expect(transaction.getData().rounds.at(-1).players.Player3.played).toEqual([
        card('2', HEART),
      ]);
    });

    it('starts Spades play after the last bot finishes the bidding cycle', async () => {
      const players = createPlayers();
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 3,
          players: {
            ...players,
            Player4: {
              ...players.Player4,
              cards: [card('A', SPADE), card('K', SPADE), card('Q', HEART)],
              isBot: true,
            },
          },
          roundNumber: 3,
          roundStatus: BIDDING,
          rounds: [
            {
              currentTurn: 0,
              players: {
                Player1: { bids: 1, hasBid: true, played: [], wins: 0 },
                Player2: { bids: 1, hasBid: true, played: [], wins: 0 },
                Player3: { bids: 0, hasBid: true, played: [], wins: 0 },
                Player4: { bids: 0, played: [], wins: 0 },
              },
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(true);

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player4.hasBid).toBe(true);
      expect(data.currentPlayerIdx).toBe(0);
      expect(data.rounds.at(-1).currentTurn).toBe(1);
      expect(data.rounds.at(-1).trumpSuit).toBe(SPADE);
      expect(data.roundStatus).toBe(GAME_STATUS);
    });

    it('resolves the trick when the last play is a bot action', async () => {
      vi.useFakeTimers();
      const players = createPlayers();
      const transaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 3,
          players: {
            ...players,
            Player4: {
              ...players.Player4,
              cards: [card('J', SPADE)],
              isBot: true,
            },
          },
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('A', SPADE)], wins: 0 },
                Player2: { played: [card('K', SPADE)], wins: 0 },
                Player3: { played: [card('Q', SPADE)], wins: 0 },
                Player4: { bids: 0, played: [], wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      const processPromise = gameService.processBotAction('lobby-1', 'Player1');
      await vi.advanceTimersByTimeAsync(1200);
      await expect(processPromise).resolves.toBe(true);

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player4.played).toEqual([card('J', SPADE)]);
      expect(data.rounds.at(-1).players.Player1.wins).toBe(1);
      expect(data.rounds.at(-1).currentTurn).toBe(2);
      expect(data.currentPlayerIdx).toBe(0);
      expect(data.roundStatus).toBe(GAME_STATUS);
    });

    it('does not process bot actions during post-trick transitions', async () => {
      const players = createPlayers();

      const newTurnTransaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 3,
          players: {
            ...players,
            Player4: {
              ...players.Player4,
              isBot: true,
            },
          },
          roundNumber: 3,
          roundStatus: NEW_TURN_STATUS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('A', HEART)], wins: 0 },
                Player2: { played: [card('K', HEART)], wins: 0 },
                Player3: { played: [card('Q', HEART)], wins: 0 },
                Player4: { bids: 0, played: [card('7', HEART)], wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );
      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(newTurnTransaction.getData().roundStatus).toBe(NEW_TURN_STATUS);

      const newRoundTransaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 3,
          players: {
            ...players,
            Player4: {
              ...players.Player4,
              isBot: true,
            },
          },
          roundNumber: 3,
          roundStatus: NEW_ROUND_STATUS,
          rounds: [
            {
              currentTurn: 3,
              players: createRoundPlayers({
                Player1: { played: playedOnTurn(3, card('A', HEART)), wins: 0 },
                Player2: { played: playedOnTurn(3, card('K', HEART)), wins: 0 },
                Player3: { played: playedOnTurn(3, card('Q', HEART)), wins: 0 },
                Player4: { bids: 0, played: playedOnTurn(3, card('7', HEART)), wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(newRoundTransaction.getData().roundStatus).toBe(NEW_ROUND_STATUS);
      expect(newRoundTransaction.getData().rounds.at(-1).currentTurn).toBe(3);

      const gameOverTransaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 3,
          players: {
            ...players,
            Player4: {
              ...players.Player4,
              isBot: true,
            },
          },
          roundNumber: MAX_ROUNDS,
          roundStatus: GAME_OVER_STATUS,
          rounds: [
            {
              currentTurn: MAX_ROUNDS,
              players: createRoundPlayers({
                Player1: { played: playedOnLastTurn(card('A', HEART)), wins: 0 },
                Player2: { played: playedOnLastTurn(card('K', HEART)), wins: 0 },
                Player3: { played: playedOnLastTurn(card('Q', HEART)), wins: 0 },
                Player4: { bids: 0, played: playedOnLastTurn(card('7', HEART)), wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(gameOverTransaction.getData().roundStatus).toBe(GAME_OVER_STATUS);
      expect(gameOverTransaction.getData().rounds.at(-1).currentTurn).toBe(MAX_ROUNDS);
    });

    it('returns false for missing lobbies, human turns, and missing round-player data', async () => {
      const missingTransaction = useTransactionData(null);
      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(missingTransaction.getData()).toBeNull();

      const humanTransaction = useTransactionData(createLobby());
      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(humanTransaction.getData().rounds.at(-1).players.Player1.played).toEqual([]);

      const players = createPlayers();
      const missingRoundPlayerTransaction = useTransactionData(
        createLobby({
          currentPlayerIdx: 1,
          players: {
            ...players,
            Player2: { ...players.Player2, isBot: true },
          },
          rounds: [
            {
              currentTurn: 1,
              players: {
                Player1: createRoundPlayers().Player1,
              },
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );
      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(missingRoundPlayerTransaction.getData().rounds.at(-1).players.Player1.played).toEqual(
        []
      );
    });

    it('does not repeat a bot action for the same game state or after a card is already recorded', async () => {
      const players = createPlayers();
      const duplicateBidTransaction = useTransactionData(
        createLobby({
          players: {
            ...players,
            Player1: { ...players.Player1, isBot: true },
          },
          roundStatus: BIDDING,
          rounds: [
            {
              currentTurn: 0,
              lastBotActionKey: `1:0:${BIDDING}:0:Player1`,
              players: createNewRoundPlayers(),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
        })
      );
      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(
        duplicateBidTransaction.getData().rounds.at(-1).players.Player1.hasBid
      ).toBeUndefined();

      const playedTransaction = useTransactionData(
        createLobby({
          players: {
            ...players,
            Player1: { ...players.Player1, isBot: true },
          },
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('A', SPADE)] },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );
      await expect(gameService.processBotAction('lobby-1', 'Player1')).resolves.toBe(false);
      expect(playedTransaction.getData().rounds.at(-1).players.Player1.played).toEqual([
        card('A', SPADE),
      ]);
    });

    it('propagates Firebase failures', async () => {
      runTransaction.mockRejectedValueOnce(new Error('bot transaction failed'));

      await expect(gameService.processBotAction('lobby-1', 'Player1')).rejects.toThrow(
        'bot transaction failed'
      );
    });
  });

  describe('updateTurnWinner', () => {
    it('awards the trick to the strongest trump card and starts the next turn', async () => {
      vi.useFakeTimers();
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('A', HEART)] },
                Player2: { played: [card('K', HEART)] },
                Player3: { played: [card('2', SPADE)] },
                Player4: { played: [card('3', HEART)] },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;

      const data = transaction.getData();
      expect(transaction.states[0].roundStatus).toBe(NEW_TURN_STATUS);
      expect(transaction.states[0].statusText).toBe(TURN_START_MESSAGE);
      expect(data.rounds.at(-1).players.Player3.wins).toBe(1);
      expect(data.rounds.at(-1).startPlayerIdx).toBe(2);
      expect(data.currentPlayerIdx).toBe(2);
      expect(data.rounds.at(-1).currentTurn).toBe(2);
      expect(data.roundStatus).toBe(GAME_STATUS);
      expect(data.statusText).toBe('');
    });

    it('uses Downtown rank order when comparing cards', async () => {
      vi.useFakeTimers();
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('K', SPADE)] },
                Player2: { played: [card('2', SPADE)] },
                Player3: { played: [card('3', SPADE)] },
                Player4: { played: [card('4', SPADE)] },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.DOWNTOWN,
        })
      );

      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;

      expect(transaction.getData().rounds.at(-1).players.Player2.wins).toBe(1);
      expect(transaction.getData().currentPlayerIdx).toBe(1);
    });

    it('treats jokers as trump for winner comparison', async () => {
      vi.useFakeTimers();
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('A', SPADE)] },
                Player2: { played: [card('SJ', JOKER)] },
                Player3: { played: [card('K', HEART)] },
                Player4: { played: [card('2', CLUB)] },
              }),
              startPlayerIdx: 0,
              trumpSuit: HEART,
            },
          ],
        })
      );

      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;

      expect(transaction.getData().rounds.at(-1).players.Player2.wins).toBe(1);
    });

    it('does not resolve a trick until every player has played that turn', async () => {
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [] },
                Player2: { played: [card('K', HEART)] },
                Player3: { played: [card('A', HEART)] },
                Player4: { played: [card('Q', HEART)] },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
        })
      );

      await gameService.updateTurnWinner('lobby-1');

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player3.wins).toBe(0);
      expect(data.rounds.at(-1).startPlayerIdx).toBe(0);
      expect(data.currentPlayerIdx).toBe(0);
      expect(data.rounds.at(-1).currentTurn).toBe(1);
      expect(data.roundStatus).toBe(GAME_STATUS);
    });

    it('does not resolve the same trick twice when turn-winner calls overlap', async () => {
      vi.useFakeTimers();
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 3,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { played: [card('A', HEART)], wins: 0 },
                Player2: { played: [card('K', HEART)], wins: 0 },
                Player3: { played: [card('Q', HEART)], wins: 0 },
                Player4: { played: [card('7', HEART)], wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      const firstUpdatePromise = gameService.updateTurnWinner('lobby-1');
      const secondUpdatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await firstUpdatePromise;
      await secondUpdatePromise;

      const data = transaction.getData();
      expect(data.rounds.at(-1).players.Player1.wins).toBe(1);
      expect(data.rounds.at(-1).currentTurn).toBe(2);
      expect(data.roundStatus).toBe(GAME_STATUS);
    });

    it('does not finalize the game when the final trick is incomplete', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [card('2', CLUB)], orderIdx: 0, score: 100 },
            Player2: { accumulated: 0, cards: [card('3', CLUB)], orderIdx: 1, score: 90 },
            Player3: { accumulated: 0, cards: [card('4', CLUB)], orderIdx: 2, score: 80 },
            Player4: { accumulated: 0, cards: [card('5', CLUB)], orderIdx: 3, score: 70 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: MAX_ROUNDS,
              players: createRoundPlayers({
                Player1: { bids: 0, played: playedOnLastTurn(card('A', SPADE)), wins: 0 },
                Player2: {
                  bids: 0,
                  played: playedOnTurn(MAX_ROUNDS - 1, card('K', SPADE)),
                  wins: 0,
                },
                Player3: {
                  bids: 0,
                  played: playedOnTurn(MAX_ROUNDS - 1, card('Q', SPADE)),
                  wins: 0,
                },
                Player4: {
                  bids: 0,
                  played: playedOnTurn(MAX_ROUNDS - 1, card('J', SPADE)),
                  wins: 0,
                },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateTurnWinner('lobby-1');

      const data = transaction.getData();
      expect(data.roundStatus).toBe(GAME_STATUS);
      expect(data.winnerNames).toBeUndefined();
      expect(data.rounds.at(-1).currentTurn).toBe(MAX_ROUNDS);
      expect(data.rounds.at(-1).players.Player1.wins).toBe(0);
    });

    it('finalizes scores and winners when the last turn of the last round completes', async () => {
      vi.useFakeTimers();
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 100 },
            Player2: { accumulated: 1, cards: [], orderIdx: 1, score: 90 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 80 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 100 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: MAX_ROUNDS,
              players: createRoundPlayers({
                Player1: { bids: 0, played: playedOnLastTurn(card('A', SPADE)), wins: 0 },
                Player2: { bids: 0, played: playedOnLastTurn(card('K', SPADE)), wins: 0 },
                Player3: { bids: 0, played: playedOnLastTurn(card('Q', SPADE)), wins: 0 },
                Player4: { bids: 0, played: playedOnLastTurn(card('J', SPADE)), wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;

      const data = transaction.getData();
      expect(transaction.states[0].roundStatus).toBe(GAME_OVER_STATUS);
      expect(transaction.states[0].statusText).toBe(FINALIZING_RESULTS_MESSAGE);
      expect(data.roundStatus).toBe(GAME_OVER_STATUS);
      expect(data.winnerNames).toEqual(['Player2', 'Player4']);
      expect(data.rounds.at(-1).players.Player1.wins).toBe(1);
    });

    it('uses the computed Bid Whist round cap when finalizing the last round', async () => {
      vi.useFakeTimers();
      const bidWhistMaxRounds = Math.floor(MAX_CARDS / 7);
      const players = {
        ...createPlayersByCount(7),
        Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 20 },
        Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 30 },
        Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 40 },
        Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 50 },
        Player5: { accumulated: 0, cards: [], orderIdx: 4, score: 60 },
        Player6: { accumulated: 0, cards: [], orderIdx: 5, score: 70 },
        Player7: { accumulated: 0, cards: [], orderIdx: 6, score: 80 },
      };
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players,
          roundNumber: bidWhistMaxRounds,
          rounds: [
            {
              currentTurn: bidWhistMaxRounds,
              players: createRoundPlayersByCount(7, {
                Player1: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('2', CLUB)),
                  wins: 0,
                },
                Player2: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('3', CLUB)),
                  wins: 0,
                },
                Player3: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('4', CLUB)),
                  wins: 0,
                },
                Player4: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('5', CLUB)),
                  wins: 0,
                },
                Player5: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('6', CLUB)),
                  wins: 0,
                },
                Player6: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('7', CLUB)),
                  wins: 0,
                },
                Player7: {
                  bids: 1,
                  played: playedOnTurn(bidWhistMaxRounds, card('8', CLUB)),
                  wins: 0,
                },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;

      const data = transaction.getData();
      expect(transaction.states[0].roundStatus).toBe(GAME_OVER_STATUS);
      expect(data.roundStatus).toBe(GAME_OVER_STATUS);
      expect(data.winnerNames).toEqual(['Player7']);
    });

    it('scores the round and adds a new one before max rounds', async () => {
      vi.useFakeTimers();
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 1,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, played: [card('A', SPADE)], wins: 0 },
                Player2: { bids: 1, played: [card('K', SPADE)], wins: 0 },
                Player3: { bids: 1, played: [card('Q', SPADE)], wins: 0 },
                Player4: { bids: 1, played: [card('J', SPADE)], wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;

      const data = transaction.getData();
      expect(transaction.states[0].roundStatus).toBe(NEW_ROUND_STATUS);
      expect(transaction.states[0].statusText).toBe(ROUND_START_MESSAGE);
      expect(data.players.Player1.score).toBe(10);
      expect(data.players.Player2.score).toBe(-10);
      expect(data.roundNumber).toBe(2);
      expect(data.roundStatus).toBe(BIDDING);
      expect(data.rounds).toHaveLength(2);
      expect(dealCards).toHaveBeenCalled();
    });

    it('throws for missing lobby ids, handles null lobbies, and propagates Firebase failures', async () => {
      await expect(gameService.updateTurnWinner('')).rejects.toThrow('Missing lobbyId.');

      vi.useFakeTimers();
      const transaction = useTransactionData(null);
      const updatePromise = gameService.updateTurnWinner('lobby-1');
      await vi.advanceTimersByTimeAsync(1200);
      await updatePromise;
      expect(transaction.getData()).toBeNull();

      runTransaction.mockRejectedValueOnce(new Error('turn transaction failed'));
      await expect(gameService.updateTurnWinner('lobby-1')).rejects.toThrow(
        'turn transaction failed'
      );
    });
  });

  describe('updateRoundWinnner', () => {
    it('scores exact, under, over, accumulated-penalty, and incomplete round entries', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 0 },
            Player2: { accumulated: 4, cards: [], orderIdx: 1, score: 15 },
            Player3: { accumulated: 1, cards: [], orderIdx: 2, score: 30 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 5 },
            Player5: { accumulated: 2, cards: [], orderIdx: 4, score: 40 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayersByCount(5, {
                Player1: { bids: 2, wins: 2 },
                Player2: { bids: 1, wins: 3 },
                Player3: { bids: 3, wins: 1 },
                Player4: { bids: undefined, wins: 2 },
                Player5: { bids: 2, wins: undefined },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      const data = transaction.getData();
      expect(data.players.Player1).toMatchObject({ accumulated: 0, score: 20 });
      expect(data.players.Player2).toMatchObject({ accumulated: 1, score: -25 });
      expect(data.players.Player3).toMatchObject({ accumulated: 1, score: 10 });
      expect(data.players.Player4).toMatchObject({ accumulated: 0, score: 5 });
      expect(data.players.Player5).toMatchObject({ accumulated: 2, score: 40 });
      expect(data.rounds.at(-1).players.Player1.accumulatedPenalty).toBeUndefined();
      expect(data.rounds.at(-1).players.Player2.accumulatedPenalty).toBe(50);
      expect(data.rounds.at(-1).players.Player3.accumulatedPenalty).toBeUndefined();
      expect(data.rounds.at(-1).players.Player4.accumulatedPenalty).toBeUndefined();
      expect(data.rounds.at(-1).players.Player5.accumulatedPenalty).toBeUndefined();
    });

    it('selects individual winners by score and lower accumulated value', async () => {
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 80 },
            Player2: { accumulated: 1, cards: [], orderIdx: 1, score: 80 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 70 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 80 },
          },
          roundNumber: MAX_ROUNDS,
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player1', 'Player4']);
    });

    it('declares Bid Whist winners at the computed max rounds', async () => {
      const bidWhistMaxRounds = Math.floor(MAX_CARDS / 7);
      const players = {
        ...createPlayersByCount(7),
        Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 60 },
        Player2: { accumulated: 1, cards: [], orderIdx: 1, score: 70 },
        Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 80 },
        Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 90 },
        Player5: { accumulated: 0, cards: [], orderIdx: 4, score: 100 },
        Player6: { accumulated: 0, cards: [], orderIdx: 5, score: 110 },
        Player7: { accumulated: 0, cards: [], orderIdx: 6, score: 120 },
      };
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players,
          roundNumber: bidWhistMaxRounds,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayersByCount(7),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player7']);
      expect(transaction.getData().rounds).toHaveLength(1);
    });

    it('adds a new Bid Whist round while still below the computed max rounds', async () => {
      const players = createPlayersByCount(7);
      const transaction = useTransactionData(
        createLobby({
          gameType: GAME_TYPE.BID_WHIST,
          players,
          roundNumber: Math.floor(MAX_CARDS / 7) - 1,
          rounds: [
            {
              currentTurn: Math.floor(MAX_CARDS / 7) - 1,
              players: createRoundPlayersByCount(7, {
                Player1: { bids: 1, wins: 1 },
                Player2: { bids: 1, wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: '',
            },
          ],
          variant: BID_WHIST_VARIANT.NO_TRUMP,
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().roundNumber).toBe(Math.floor(MAX_CARDS / 7));
      expect(transaction.getData().roundStatus).toBe(BIDDING);
      expect(transaction.getData().rounds).toHaveLength(2);
      expect(dealCards).toHaveBeenCalledWith(7, Math.floor(MAX_CARDS / 7), false);
    });

    it('selects Spades winners from aggregated team round scoring instead of cumulative player scores', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 0 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 100 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 0 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 100 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 2 },
                Player2: { bids: 1, wins: 0 },
                Player3: { bids: 1, wins: 0 },
                Player4: { bids: 1, wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player1', 'Player3']);
    });

    it('factors aggregated teammate penalties into Spades winner selection', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: MAX_ACCUMULATED - 1, cards: [], orderIdx: 0, score: 0 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 0 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 0 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 0 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 0, wins: 1 },
                Player2: { bids: 1, wins: 1 },
                Player3: { bids: 1, wins: 0 },
                Player4: { bids: 0, wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().rounds.at(-1).players.Player1.accumulatedPenalty).toBe(50);
      expect(transaction.getData().winnerNames).toEqual(['Player2', 'Player4']);
    });

    it('uses the highest individual final score as the Spades team tiebreak when team scores match', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 80 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 70 },
            Player3: { accumulated: 1, cards: [], orderIdx: 2, score: 50 },
            Player4: { accumulated: 1, cards: [], orderIdx: 3, score: 70 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 1 },
                Player2: { bids: 1, wins: 1 },
                Player3: { bids: 1, wins: 1 },
                Player4: { bids: 1, wins: 1 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player1', 'Player3']);
    });

    it('uses the second player final score after the highest individual final score also ties', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 2, cards: [], orderIdx: 0, score: 70 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 70 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 40 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 50 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 1 },
                Player2: { bids: 1, wins: 1 },
                Player3: { bids: 1, wins: 1 },
                Player4: { bids: 1, wins: 1 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player2', 'Player4']);
    });

    it('uses lower accumulated values after both player scores also tie', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 70 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 70 },
            Player3: { accumulated: 1, cards: [], orderIdx: 2, score: 40 },
            Player4: { accumulated: 2, cards: [], orderIdx: 3, score: 40 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 1 },
                Player2: { bids: 1, wins: 1 },
                Player3: { bids: 1, wins: 1 },
                Player4: { bids: 1, wins: 1 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player1', 'Player3']);
    });

    it('declares both Spades teams winners when both player scores and accumulated values tie', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 70 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 70 },
            Player3: { accumulated: 1, cards: [], orderIdx: 2, score: 40 },
            Player4: { accumulated: 1, cards: [], orderIdx: 3, score: 40 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 1 },
                Player2: { bids: 1, wins: 1 },
                Player3: { bids: 1, wins: 1 },
                Player4: { bids: 1, wins: 1 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual([
        'Player1',
        'Player3',
        'Player2',
        'Player4',
      ]);
    });

    it('adds a new round after scoring when the game is not over', async () => {
      const transaction = useTransactionData(
        createLobby({
          roundNumber: 2,
          rounds: [
            {
              currentTurn: 2,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 1 },
                Player2: { bids: 1, wins: 0 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      const data = transaction.getData();
      expect(runTransaction).toHaveBeenCalledTimes(2);
      expect(data.players.Player1.score).toBe(10);
      expect(data.players.Player2.score).toBe(-10);
      expect(data.roundNumber).toBe(3);
      expect(data.roundStatus).toBe(BIDDING);
      expect(data.rounds).toHaveLength(2);
    });

    it('throws for missing lobby ids and handles null lobby data', async () => {
      await expect(gameService.updateRoundWinnner('')).rejects.toThrow('Missing lobbyId.');

      const transaction = useTransactionData(null);
      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData()).toBeNull();
    });

    it('propagates Firebase failures', async () => {
      runTransaction.mockRejectedValueOnce(new Error('score transaction failed'));

      await expect(gameService.updateRoundWinnner('lobby-1')).rejects.toThrow(
        'score transaction failed'
      );
    });

    it('keeps accumulated values below the configured limit after penalties', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: MAX_ACCUMULATED - 1, cards: [], orderIdx: 0, score: 0 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 0 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 0 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 0 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 4 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().players.Player1.accumulated).toBe(2);
      expect(transaction.getData().players.Player1.score).toBe(-40);
      expect(transaction.getData().rounds.at(-1).players.Player1.accumulatedPenalty).toBe(50);
    });

    it('stores the full accumulated penalty amount when multiple thresholds are crossed', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: MAX_ACCUMULATED - 1, cards: [], orderIdx: 0, score: 0 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 0 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 0 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 0 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 1, wins: 11 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().players.Player1.accumulated).toBe(4);
      expect(transaction.getData().players.Player1.score).toBe(-90);
      expect(transaction.getData().rounds.at(-1).players.Player1.accumulatedPenalty).toBe(100);
    });
  });
});
