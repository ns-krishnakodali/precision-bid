import { describe, expect, it } from 'vitest';

import {
  compareSpadesTeams,
  getRoundScore,
  getSpadesTeamDisplayScore,
  getSpadesTeamRoundScore,
  getSpadesTeamRoundSummary,
} from '../score-utils';

describe('scoreUtils', () => {
  describe('getRoundScore', () => {
    it('scores exact, underbid, and penalty rounds', () => {
      expect(getRoundScore({ bids: 2, wins: 2 })).toBe(20);
      expect(getRoundScore({ bids: 3, wins: 1 })).toBe(-20);
      expect(getRoundScore({ accumulatedPenalty: 50, bids: 1, wins: 1 })).toBe(-40);
    });
  });

  describe('getSpadesTeamRoundSummary', () => {
    it('aggregates teammate bids, wins, and penalty into a team round score', () => {
      expect(
        getSpadesTeamRoundSummary({
          playerNames: ['Player1', 'Player3'],
          roundPlayers: {
            Player1: { accumulatedPenalty: 50, bids: 0, wins: 1 },
            Player3: { bids: 1, wins: 0 },
          },
        })
      ).toEqual({
        accumulatedPenalty: 50,
        bids: 1,
        score: -40,
        wins: 1,
      });
    });

    it('uses aggregated team bids and wins instead of summed player scores', () => {
      expect(
        getSpadesTeamRoundSummary({
          playerNames: ['Player1', 'Player3'],
          roundPlayers: {
            Player1: { bids: 2, wins: 1 },
            Player3: { bids: 0, wins: 1 },
          },
        })
      ).toEqual({
        accumulatedPenalty: 0,
        bids: 2,
        score: 20,
        wins: 2,
      });
    });

    it('keeps Spades team scoring on aggregated bids and wins for the regression case', () => {
      expect(
        getSpadesTeamRoundSummary({
          playerNames: ['Player1', 'Player2'],
          roundPlayers: {
            Player1: { bids: 1, wins: 2 },
            Player2: { bids: 1, wins: 0 },
          },
        })
      ).toEqual({
        accumulatedPenalty: 0,
        bids: 2,
        score: 20,
        wins: 2,
      });
    });

    it('subtracts the summed teammate penalties after aggregated Spades team scoring', () => {
      expect(
        getSpadesTeamRoundScore({
          playerNames: ['Player1', 'Player2'],
          roundPlayers: {
            Player1: { accumulatedPenalty: 50, bids: 1, wins: 2 },
            Player2: { bids: 1, wins: 0 },
          },
        })
      ).toBe(-30);
    });
  });

  describe('getSpadesTeamDisplayScore', () => {
    const rounds = [
      {
        players: {
          Player1: { bids: 1, wins: 1 },
          Player2: { bids: 1, wins: 1 },
        },
      },
      {
        players: {
          Player1: { bids: 1, wins: 1 },
          Player2: { bids: 1, wins: 1 },
        },
      },
    ];

    it('excludes the current round until the game is completed', () => {
      expect(
        getSpadesTeamDisplayScore({
          playerNames: ['Player1', 'Player2'],
          rounds,
        })
      ).toBe(20);
    });

    it('includes the last round after the game is completed', () => {
      expect(
        getSpadesTeamDisplayScore({
          playerNames: ['Player1', 'Player2'],
          rounds,
          gameCompleted: true,
        })
      ).toBe(40);
    });
  });

  describe('compareSpadesTeams', () => {
    it('orders teams by score, highest player score, second player score, then accumulated values', () => {
      const teams = [
        {
          accumulatedValues: [0, 2],
          highestPlayerScore: 60,
          score: 100,
          secondHighestPlayerScore: 40,
          teamName: 'Team 1',
        },
        {
          accumulatedValues: [0, 1],
          highestPlayerScore: 60,
          score: 100,
          secondHighestPlayerScore: 30,
          teamName: 'Team 2',
        },
        {
          accumulatedValues: [0, 1],
          highestPlayerScore: 60,
          score: 100,
          secondHighestPlayerScore: 40,
          teamName: 'Team 3',
        },
        {
          accumulatedValues: [0, 3],
          highestPlayerScore: 55,
          score: 100,
          secondHighestPlayerScore: 55,
          teamName: 'Team 4',
        },
        {
          accumulatedValues: [0, 0],
          highestPlayerScore: 70,
          score: 90,
          secondHighestPlayerScore: 20,
          teamName: 'Team 5',
        },
      ];

      expect(teams.sort(compareSpadesTeams).map((team) => team.teamName)).toEqual([
        'Team 3',
        'Team 1',
        'Team 2',
        'Team 4',
        'Team 5',
      ]);
    });
  });
});
