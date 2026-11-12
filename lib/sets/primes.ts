import type { NumberSet } from './types';

const SEGMENT = 1 << 16;
/** With the primes from the first block we can sieve up to about 4.29 billion. */
const LIMIT = 4_000_000_000;

/** Primes in order, found block by block (a segmented sieve). */
export function* generatePrimes(): Generator<number, void, void> {
  const base: number[] = [];
  let lo = 2;
  while (lo < LIMIT) {
    const hi = lo + SEGMENT;
    const composite = new Uint8Array(SEGMENT);
    for (let k = 0; k < base.length; k++) {
      const p = base[k];
      if (p * p >= hi) break;
      let j = Math.max(p * p, Math.ceil(lo / p) * p);
      for (; j < hi; j += p) composite[j - lo] = 1;
    }
    const first = lo === 2;
    for (let i = 0; i < SEGMENT; i++) {
      if (composite[i]) continue;
      const n = lo + i;
      if (first) {
        base.push(n);
        for (let j = n * n; j < hi; j += n) composite[j - lo] = 1;
      }
      yield n;
    }
    lo = hi;
  }
}

export const primes: NumberSet = {
  id: 'primes',
  name: 'Primes',
  rule: String.raw`\{\, p \in \mathbb{N} : p \text{ is prime} \,\}`,
  radiusScale: 'linear',
  generate: generatePrimes,
};
