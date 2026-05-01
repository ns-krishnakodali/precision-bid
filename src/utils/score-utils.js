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

export const getSpadesTeamDisplayScore = ({
  playerNames = [],
  rounds = [],
  gameCompleted = false,
}) =>
  getSpadesTeamScore({
    playerNames,
    rounds: gameCompleted ? rounds : rounds.slice(0, -1),
  });

export const compareSpadesTeams = (team1 = {}, team2 = {}) => {
  const scoreComparison = (team2.score ?? 0) - (team1.score ?? 0);
  if (scoreComparison) return scoreComparison;

  const highestPlayerScoreComparison =
    (team2.highestPlayerScore ?? 0) - (team1.highestPlayerScore ?? 0);
  if (highestPlayerScoreComparison) return highestPlayerScoreComparison;

  const secondHighestPlayerScoreComparison =
    (team2.secondHighestPlayerScore ?? 0) - (team1.secondHighestPlayerScore ?? 0);
  if (secondHighestPlayerScoreComparison) return secondHighestPlayerScoreComparison;

  for (
    let idx = 0;
    idx < Math.max(team1.accumulatedValues?.length ?? 0, team2.accumulatedValues?.length ?? 0);
    idx++
  ) {
    const value1 = team1.accumulatedValues?.[idx] ?? Number.POSITIVE_INFINITY;
    const value2 = team2.accumulatedValues?.[idx] ?? Number.POSITIVE_INFINITY;
    if (value1 !== value2) return value1 - value2;
  }

  return 0;
};
