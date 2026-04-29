import { afterEach, describe, expect, it, vi } from 'vitest';

import { dealCards } from '../card-utils';

import {
  BIG_JOKER,
  CARD_SUITS,
  CARD_VALUES,
  CLUB,
  DIAMOND,
  HEART,
  JOKER,
  SMALL_JOKER,
  SPADE,
} from '../../constants';

const flattenCards = (dealtCards) => dealtCards.flat();

const cardKey = (cardDetails) => `${cardDetails.value}-${cardDetails.suit}`;

const getCardRank = (cardDetails) => {
  if (cardDetails.suit === JOKER) {
    return cardDetails.value === BIG_JOKER ? CARD_VALUES.length + 1 : CARD_VALUES.length;
  }

  return CARD_VALUES.indexOf(cardDetails.value);
};

const expectSortedHand = (hand) => {
  hand.slice(1).forEach((cardDetails, idx) => {
    const previousCard = hand[idx];
    const rankDifference = getCardRank(previousCard) - getCardRank(cardDetails);

    expect(rankDifference > 0 || previousCard.suit.localeCompare(cardDetails.suit) <= 0).toBe(true);
  });
};

describe('dealCards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deals a full standard deck by default with no duplicate cards or jokers', () => {
    const { dealtCards, remainingCards } = dealCards(4);
    const allDealtCards = flattenCards(dealtCards);

    expect(dealtCards).toHaveLength(4);
    expect(dealtCards.map((hand) => hand.length)).toEqual([13, 13, 13, 13]);
    expect(remainingCards).toEqual([]);
    expect(allDealtCards).toHaveLength(52);
    expect(new Set(allDealtCards.map(cardKey))).toHaveProperty('size', 52);
    expect(allDealtCards.every((cardDetails) => CARD_SUITS.includes(cardDetails.suit))).toBe(true);
    expect(allDealtCards.every((cardDetails) => CARD_VALUES.includes(cardDetails.value))).toBe(
      true
    );
    expect(allDealtCards.some((cardDetails) => cardDetails.suit === JOKER)).toBe(false);
  });

  it('sorts every dealt hand by descending card rank and suit name', () => {
    const { dealtCards } = dealCards(1, 52);
    const [hand] = dealtCards;

    expectSortedHand(hand);
    expect(hand.slice(0, 4)).toEqual([
      { suit: CLUB, value: 'A' },
      { suit: DIAMOND, value: 'A' },
      { suit: HEART, value: 'A' },
      { suit: SPADE, value: 'A' },
    ]);
    expect(hand.slice(-4)).toEqual([
      { suit: CLUB, value: '2' },
      { suit: DIAMOND, value: '2' },
      { suit: HEART, value: '2' },
      { suit: SPADE, value: '2' },
    ]);
  });

  it('includes and ranks jokers when requested', () => {
    const { dealtCards, remainingCards } = dealCards(1, 54, true);
    const [hand] = dealtCards;

    expect(remainingCards).toEqual([]);
    expect(hand).toHaveLength(54);
    expect(hand[0]).toEqual({ suit: JOKER, value: BIG_JOKER });
    expect(hand[1]).toEqual({ suit: JOKER, value: SMALL_JOKER });
    expect(new Set(hand.map(cardKey))).toHaveProperty('size', 54);
    expectSortedHand(hand);
  });

  it('returns remaining cards without duplicating dealt cards', () => {
    const { dealtCards, remainingCards } = dealCards(3, 5, true);
    const allCards = [...flattenCards(dealtCards), ...remainingCards];

    expect(flattenCards(dealtCards)).toHaveLength(15);
    expect(remainingCards).toHaveLength(39);
    expect(allCards).toHaveLength(54);
    expect(new Set(allCards.map(cardKey))).toHaveProperty('size', 54);
  });

  it('accepts numeric string counts', () => {
    const { dealtCards, remainingCards } = dealCards('2', '3');

    expect(dealtCards).toHaveLength(2);
    expect(dealtCards.map((hand) => hand.length)).toEqual([3, 3]);
    expect(remainingCards).toHaveLength(46);
  });

  it('rejects missing, non-integer, and non-positive player counts', () => {
    [undefined, null, '', 0, -1, 1.5, 'abc'].forEach((playersCount) => {
      expect(() => dealCards(playersCount, 1)).toThrow('numPlayers must be a positive integer.');
    });
  });

  it('rejects null, non-integer, and non-positive card counts', () => {
    [null, '', 0, -1, 1.5, 'abc'].forEach((cardsCount) => {
      expect(() => dealCards(1, cardsCount)).toThrow('cardsPerPlayer must be a positive integer.');
    });
  });

  it('uses the default card count when cardsPerPlayer is undefined', () => {
    const { dealtCards, remainingCards } = dealCards(2, undefined);

    expect(dealtCards.map((hand) => hand.length)).toEqual([13, 13]);
    expect(remainingCards).toHaveLength(26);
  });

  it('throws when the requested deal exceeds the available deck size', () => {
    expect(() => dealCards(5, 11)).toThrow('Not enough cards to deal.');
    expect(() => dealCards(3, 19, true)).toThrow('Not enough cards to deal.');
  });
});
