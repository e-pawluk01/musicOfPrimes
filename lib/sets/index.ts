import { fibonacci } from './fibonacci';
import { naturals } from './naturals';
import { powersOfTwo } from './powersOfTwo';
import { primes } from './primes';
import { squares } from './squares';
import { triangular } from './triangular';
import { twinPrimes } from './twinPrimes';
import type { NumberSet } from './types';

/** Every built-in set. To add one, write its small file and list it here. */
export const SETS: NumberSet[] = [
  primes,
  twinPrimes,
  fibonacci,
  squares,
  triangular,
  powersOfTwo,
  naturals,
];

export const DEFAULT_SET_ID = primes.id;

export function getSet(id: string): NumberSet {
  return SETS.find((s) => s.id === id) ?? primes;
}

export type { NumberSet, RadiusScale } from './types';
