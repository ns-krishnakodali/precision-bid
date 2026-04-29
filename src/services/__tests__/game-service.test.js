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

vi.mock('../../utils', () => ({
  dealCards: vi.fn(),
}));

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

const playedOnLastTurn = (cardDetails) =>
  Array(MAX_ROUNDS - 1)
    .fill(null)
    .concat(cardDetails);

const createLobby = (overrides = {}) => ({
  currentPlayerIdx: 0,
  gameType: GAME_TYPE.SPADES,
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
    it('scores exact, under, over, accumulated-penalty, and missing bid cases', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 0 },
            Player2: { accumulated: 4, cards: [], orderIdx: 1, score: 15 },
            Player3: { accumulated: 1, cards: [], orderIdx: 2, score: 30 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 5 },
          },
          roundNumber: MAX_ROUNDS,
          rounds: [
            {
              currentTurn: 1,
              players: createRoundPlayers({
                Player1: { bids: 2, wins: 2 },
                Player2: { bids: 1, wins: 3 },
                Player3: { bids: 3, wins: 1 },
                Player4: { bids: undefined, wins: 2 },
              }),
              startPlayerIdx: 0,
              trumpSuit: SPADE,
            },
          ],
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      const data = transaction.getData();
      expect(data.players.Player1).toMatchObject({ accumulated: 0, score: 20 });
      expect(data.players.Player2).toMatchObject({ accumulated: 1, score: -25 });
      expect(data.players.Player3).toMatchObject({ accumulated: 1, score: 10 });
      expect(data.players.Player4).toMatchObject({ accumulated: 0, score: 5 });
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

    it('selects Spades winners by opposite-seat team score', async () => {
      const transaction = useTransactionData(
        createLobby({
          players: {
            Player1: { accumulated: 0, cards: [], orderIdx: 0, score: 40 },
            Player2: { accumulated: 0, cards: [], orderIdx: 1, score: 50 },
            Player3: { accumulated: 0, cards: [], orderIdx: 2, score: 30 },
            Player4: { accumulated: 0, cards: [], orderIdx: 3, score: 10 },
          },
          roundNumber: MAX_ROUNDS,
        })
      );

      await gameService.updateRoundWinnner('lobby-1');

      expect(transaction.getData().winnerNames).toEqual(['Player1', 'Player3']);
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
    });
  });
});
