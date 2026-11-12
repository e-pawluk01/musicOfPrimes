import { describe, expect, it } from 'vitest';
import { generatePrimes } from './primes';

function take(n: number): number[] {
  const out: number[] = [];
  for (const p of generatePrimes()) {
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}

describe('primes', () => {
  it('starts with the right terms', () => {
    expect(take(15)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
  });

  it('is right far along, across sieve blocks', () => {
    const p = take(50_000);
    expect(p[999]).toBe(7919);
    expect(p[9999]).toBe(104_729);
    expect(p[49_999]).toBe(611_953);
  });

  it('matches a simple check for the first 2,000', () => {
    const isPrime = (n: number) => {
      for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
      return n > 1;
    };
    const slow: number[] = [];
    for (let n = 2; slow.length < 2000; n++) if (isPrime(n)) slow.push(n);
    expect(take(2000)).toEqual(slow);
  });
});
