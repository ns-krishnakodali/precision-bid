export const GAME_TYPE = {
  SPADES: 'Spades',
  BID_WHIST: 'BidWhist',
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

export const SPADES_VARIANT = {
  CLASSIC: 'Classic',
  OH_HELL: 'Oh Hell',
};

export const BID_WHIST_VARIANT = {
  UPTOWN: 'Uptown (Oh Hell)',
  DOWNTOWN: 'Downtown (Oh Hell)',
  NO_TRUMP: ' No Trump (Classic)',
};

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

export const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const CARD_TYPES = ['spade', 'heart', 'diamond', 'club'];

export const LOCAL_STORAGE_KEYS = {
  CLIENT_ID: 'precisionBid.clientId',
  DISPLAY_NAME: 'precisionBid.displayName',
};

export const LOADING_MESSAGES = [
  'Shuffling cards and preparing the deck',
  'Dealing hands to players',
  'Setting up bidding phase',
  'Determining game mode and rules',
  'Preparing trick play sequence',
];

export const MAX_ATTEMPTS = 10;
