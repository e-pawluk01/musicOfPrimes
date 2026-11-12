import { generatePrimes } from './primes';
import type { NumberSet } from './types';

/** The lower prime of each pair of primes that differ by 2. */
export function* generateTwinPrimes(): Generator<number, void, void> {
  let prev = 0;
  for (const p of generatePrimes()) {
    if (prev > 0 && p - prev === 2) yield prev;
    prev = p;
  }
}

export const twinPrimes: NumberSet = {
  id: 'twinPrimes',
  name: 'Twin primes',
  rule: String.raw`\{\, p : p \text{ and } p+2 \text{ are prime} \,\}`,
  radiusScale: 'linear',
  generate: generateTwinPrimes,
};
