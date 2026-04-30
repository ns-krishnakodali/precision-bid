import { describe, expect, it } from 'vitest';

import { getRoundScore, getSpadesTeamRoundScore, getSpadesTeamRoundSummary } from '../score-utils';

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
});
