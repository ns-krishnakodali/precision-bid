import { BIG_JOKER, CARD_SUITS, CARD_VALUES, JOKER, SMALL_JOKER } from '../constants';

const buildDeck = (includeJokers) => {
  const deck = CARD_SUITS.flatMap((suit) => CARD_VALUES.map((value) => ({ value, suit })));

  if (includeJokers) {
    deck.push({ value: BIG_JOKER, suit: JOKER }, { value: SMALL_JOKER, suit: JOKER });
  }

  return deck;
};

const shuffleDeck = (cards) => {
  const shuffled = [...cards];

  for (let idx = shuffled.length - 1; idx > 0; idx -= 1) {
    const randomIdx = Math.floor(Math.random() * (idx + 1));
    [shuffled[idx], shuffled[randomIdx]] = [shuffled[randomIdx], shuffled[idx]];
  }

  return shuffled;
};

const getCardRank = (card) => {
  const maxRank = CARD_VALUES.length;
  if (card.suit === JOKER) {
    return card.value === BIG_JOKER ? maxRank + 1 : maxRank;
  }

  return CARD_VALUES.indexOf(card.value);
};

export const dealCards = (numPlayers, includeJokers = false) => {
  const playersCount = Number(numPlayers);
  if (!Number.isInteger(playersCount) || playersCount < 1) {
    throw new Error('numPlayers must be a positive integer.');
  }

  const shuffledDeck = shuffleDeck(buildDeck(includeJokers));
  const cardsPerPlayer = Math.floor(shuffledDeck.length / playersCount);

  const players = Array.from({ length: playersCount }, (_, playerIdx) => {
    const hand = shuffledDeck.slice(playerIdx * cardsPerPlayer, (playerIdx + 1) * cardsPerPlayer);
    return hand.sort((card1, card2) => {
      return getCardRank(card2) - getCardRank(card1) || card1.suit.localeCompare(card2.suit);
    });
  });

  return {
    players,
    remainingCards: shuffledDeck.slice(playersCount * cardsPerPlayer),
  };
};
