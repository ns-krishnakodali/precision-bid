import { POINTS } from '../constants';

export const getRoundScore = ({ accumulatedPenalty = 0, bids = 0, wins = 0 }) =>
  (wins < bids ? wins - bids : bids) * POINTS - accumulatedPenalty;

export const getSpadesTeamRoundSummary = ({ playerNames = [], roundPlayers = {} }) => {
  const summary = playerNames.reduce(
    (teamSummary, playerName) => {
      const playerRound = roundPlayers?.[playerName] ?? {};

      return {
        accumulatedPenalty: teamSummary.accumulatedPenalty + (playerRound.accumulatedPenalty ?? 0),
        bids: teamSummary.bids + (playerRound.bids ?? 0),
        wins: teamSummary.wins + (playerRound.wins ?? 0),
      };
    },
    { accumulatedPenalty: 0, bids: 0, wins: 0 }
  );

  return {
    ...summary,
    score: getRoundScore(summary),
  };
};

export const getSpadesTeamRoundScore = ({ playerNames = [], roundPlayers = {} }) =>
  getSpadesTeamRoundSummary({ playerNames, roundPlayers }).score;

export const getSpadesTeamScore = ({ playerNames = [], rounds = [] }) =>
  rounds.reduce(
    (teamScore, round) =>
      teamScore + getSpadesTeamRoundScore({ playerNames, roundPlayers: round?.players }),
    0
  );
