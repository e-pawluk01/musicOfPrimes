import { describe, expect, it } from 'vitest';
import { getSet, SETS } from './index';
import { MAX_VALUE } from './types';

function take(id: string, n: number): number[] {
  const out: number[] = [];
  for (const v of getSet(id).generate()) {
    out.push(v);
    if (out.length === n) break;
  }
  return out;
}

describe('built-in sets', () => {
  it('start with the right terms', () => {
    expect(take('primes', 10)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
    expect(take('twinPrimes', 10)).toEqual([3, 5, 11, 17, 29, 41, 59, 71, 101, 107]);
    expect(take('fibonacci', 12)).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144]);
    expect(take('squares', 8)).toEqual([1, 4, 9, 16, 25, 36, 49, 64]);
    expect(take('triangular', 8)).toEqual([1, 3, 6, 10, 15, 21, 28, 36]);
    expect(take('powersOfTwo', 8)).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(take('naturals', 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('fast-growing sets stop before numbers get too large to be exact', () => {
    const fib = take('fibonacci', 1000);
    expect(fib).toHaveLength(78);
    expect(fib[77]).toBe(8_944_394_323_791_464);
    const powers = take('powersOfTwo', 1000);
    expect(powers).toHaveLength(53);
    expect(Math.max(...fib, ...powers)).toBeLessThanOrEqual(MAX_VALUE);
  });

  it('every set has a name, a rule and whole-number terms', () => {
    for (const set of SETS) {
      expect(set.name.length).toBeGreaterThan(0);
      expect(set.rule.length).toBeGreaterThan(0);
      for (const v of take(set.id, 200)) expect(Number.isSafeInteger(v)).toBe(true);
    }
  });
});
