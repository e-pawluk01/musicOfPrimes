import { primes } from './primes';
import type { NumberSet } from './types';

export const SETS: NumberSet[] = [primes];

export const DEFAULT_SET_ID = primes.id;

export function getSet(id: string): NumberSet {
  return SETS.find((s) => s.id === id) ?? primes;
}

export type { NumberSet, RadiusScale } from './types';
