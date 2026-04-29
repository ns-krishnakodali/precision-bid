// Values
export const SPADE = 'spade';
export const HEART = 'heart';
export const DIAMOND = 'diamond';
export const CLUB = 'club';
export const JOKER = 'joker';

export const BIG_JOKER = 'BJ';
export const SMALL_JOKER = 'SJ';

export const MAX_ATTEMPTS = 10;
export const MAX_ROUNDS = 13;
export const MAX_ORDER = 14;
export const MAX_ACCUMULATED = 5;
export const POINTS = 10;

export const BOT_ACTION_DELAY = 650;
export const BOT_NAME_LIMIT = 7;
export const BOT_NAME_PREFIX = 'Bot';
export const BOT_PIN = '1234';

export const BIDDING = 'Bidding';
export const GAME_STATUS = 'Game Status';
export const NEW_ROUND_STATUS = 'New Round';
export const NEW_TURN_STATUS = 'New Turn';
export const SELECT_TRUMP_STATUS = 'Selecting Suit';
export const GAME_OVER_STATUS = 'Game Over';
export const TURN_START_MESSAGE = 'Next trick starting';
export const ROUND_START_MESSAGE = 'Starting a new round';
export const FINALIZING_RESULTS_MESSAGE = 'Finalizing the results';

export const LOBBY_DETAILS = 'LOBBY_DETAILS';

// Objects
export const GAME_STATE = {
  LANDING: 'LANDING',
  LOBBY: 'LOBBY',
  GAME: 'GAME',
};

export const LOBBY_STATUS = {
  WAITING: 'WAITING',
  IN_GAME: 'IN GAME',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
};

export const GAME_TYPE = {
  SPADES: 'Spades',
  BID_WHIST: 'Bid Whist',
};

export const SPADES_VARIANT = {
  CLASSIC: 'Classic',
  OH_HELL: 'Oh Hell',
};

export const BID_WHIST_VARIANT = {
  UPTOWN: 'Uptown',
  DOWNTOWN: 'Downtown',
  NO_TRUMP: ' No Trump',
};

export const VARIANT_VERSIONS = {
  [BID_WHIST_VARIANT.UPTOWN]: 'Oh Hell',
  [BID_WHIST_VARIANT.DOWNTOWN]: 'Oh Hell',
  [BID_WHIST_VARIANT.NO_TRUMP]: 'Classic',
};

export const GAME_CONFIG = {
  [GAME_TYPE.SPADES]: {
    minPlayers: 4,
    maxPlayers: 4,
  },
  [GAME_TYPE.BID_WHIST]: {
    minPlayers: 4,
    maxPlayers: 7,
  },
};

export const GAME_ROUNDS = {
  [SPADES_VARIANT.CLASSIC]: 13,
  [SPADES_VARIANT.OH_HELL]: 1,
  [BID_WHIST_VARIANT.UPTOWN]: 1,
  [BID_WHIST_VARIANT.DOWNTOWN]: 1,
  [BID_WHIST_VARIANT.NO_TRUMP]: 13,
};

export const SUITE_META = {
  [SPADE]: { symbol: '\u2660', color: 'text-black' },
  [HEART]: { symbol: '\u2665', color: 'text-rose-600' },
  [DIAMOND]: { symbol: '\u2666', color: 'text-rose-600' },
  [CLUB]: { symbol: '\u2663', color: 'text-black' },
  [JOKER]: { symbol: '\u2605', color: 'text-violet-600' },
};

export const CARDS_ORDER = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  J: 10,
  Q: 11,
  K: 12,
  A: 13,
  SJ: 14,
  BJ: 15,
};

// Arrays
export const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const CARD_SUITS = [SPADE, HEART, DIAMOND, CLUB];

export const LOADING_MESSAGES = [
  'Shuffling cards and preparing the deck',
  'Dealing hands to players',
  'Setting up bidding phase',
  'Determining game mode and rules',
  'Preparing trick play sequence',
];

export const LOCAL_STORAGE_KEYS = {
  CLIENT_ID: 'precisionBid.clientId',
  DISPLAY_NAME: 'precisionBid.displayName',
};
