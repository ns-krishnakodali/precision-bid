// Values
export const HEART = 'heart';
export const DIAMOND = 'diamond';
export const CLUB = 'club';
export const SPADE = 'spade';
export const JOKER = 'joker';

export const MAX_ATTEMPTS = 10;
export const MAX_ROUNDS = 13;
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
  BID_WHIST: 'BidWhist',
};

export const SPADES_VARIANT = {
  CLASSIC: 'Classic',
  OH_HELL: 'Oh Hell',
};

export const BID_WHIST_VARIANT = {
  UPTOWN: 'Uptown (Oh Hell)',
  DOWNTOWN: 'Downtown (Oh Hell)',
  NO_TRUMP: ' No Trump (Classic)',
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

export const GAME_ROUND = {
  [SPADES_VARIANT.CLASSIC]: 13,
  [SPADES_VARIANT.OH_HELL]: 1,
  [BID_WHIST_VARIANT.UPTOWN]: 1,
  [BID_WHIST_VARIANT.DOWNTOWN]: 1,
  [BID_WHIST_VARIANT.NO_TRUMP]: 13,
};

export const SUITE_META = {
  [HEART]: { symbol: '\u2665', color: 'text-rose-500' },
  [DIAMOND]: { symbol: '\u2666', color: 'text-rose-500' },
  [CLUB]: { symbol: '\u2663', color: 'text-slate-800' },
  [SPADE]: { symbol: '\u2663', color: 'text-slate-800' },
  [JOKER]: { symbol: '\u2605', color: 'text-amber-300' },
};

// Arrays
export const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const CARD_TYPES = ['spade', 'heart', 'diamond', 'club'];

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
