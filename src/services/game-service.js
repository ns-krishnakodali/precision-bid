import { CARD_TYPES, CARD_VALUES, JOKER } from '../constants';

const buildDeck = (includeJokers) => {
  const deck = CARD_TYPES.flatMap((type) => CARD_VALUES.map((value) => ({ value, type })));

  if (includeJokers) {
    deck.push({ value: JOKER, type: 'joker' }, { value: JOKER, type: 'joker' });
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

export const dealCards = (numPlayers, includeJokers = false) => {
  const playersCount = Number(numPlayers);
  if (!Number.isInteger(playersCount) || playersCount < 1) {
    throw new Error('numPlayers must be a positive integer.');
  }

  const shuffledDeck = shuffleDeck(buildDeck(includeJokers));
  const cardsPerPlayer = Math.floor(shuffledDeck.length / playersCount);

  const players = Array.from({ length: playersCount }, (_, playerIdx) =>
    shuffledDeck.slice(playerIdx * cardsPerPlayer, (playerIdx + 1) * cardsPerPlayer)
  );

  return {
    players,
    remainingCards: shuffledDeck.slice(playersCount * cardsPerPlayer),
  };
};

export const gameService = {
  dealCards,
};
