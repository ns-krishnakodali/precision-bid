import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateUniqueCode, getRandomInt } from '../generator-utils';

const mockRandomSequence = (values) => {
  let idx = 0;
  return vi.spyOn(Math, 'random').mockImplementation(() => values[idx++] ?? values.at(-1) ?? 0);
};

describe('generateUniqueCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a six-character uppercase alphanumeric code by default', () => {
    mockRandomSequence([0, 1 / 36, 25 / 36, 26 / 36, 35 / 36, 0.999]);

    expect(generateUniqueCode()).toBe('ABZ099');
  });

  it('uses the requested code length', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(generateUniqueCode(4)).toBe('AAAA');
    expect(Math.random).toHaveBeenCalledTimes(4);
  });

  it('accepts numeric string lengths', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    expect(generateUniqueCode('3')).toBe('999');
  });

  it('returns an empty code for zero, negative, null, and non-numeric lengths', () => {
    [0, -1, null, Number.NaN, 'abc'].forEach((length) => {
      expect(generateUniqueCode(length)).toBe('');
    });
  });

  it('follows the loop boundary for fractional lengths', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(generateUniqueCode(2.2)).toBe('AAA');
  });
});

describe('getRandomInt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses zero as the minimum when only max is provided', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(getRandomInt(5)).toBe(2);
  });

  it('returns a value within the provided min-inclusive max-exclusive range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(getRandomInt(5, 10)).toBe(7);
  });

  it('honors lower and upper random boundaries', () => {
    const randomSpy = mockRandomSequence([0, 0.999]);

    expect(getRandomInt(5, 10)).toBe(5);
    expect(getRandomInt(5, 10)).toBe(9);
    expect(randomSpy).toHaveBeenCalledTimes(2);
  });

  it('supports negative ranges', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);

    expect(getRandomInt(-10, -5)).toBe(-8);
    expect(getRandomInt(-5, 5)).toBe(-1);
  });

  it('returns min without using randomness when max is less than or equal to min', () => {
    const randomSpy = vi.spyOn(Math, 'random');

    expect(getRandomInt(5, 5)).toBe(5);
    expect(getRandomInt(10, 5)).toBe(10);
    expect(getRandomInt(0)).toBe(0);
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it('preserves decimal min values with the current arithmetic', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(getRandomInt(1.5, 4.5)).toBe(2.5);
  });
});
