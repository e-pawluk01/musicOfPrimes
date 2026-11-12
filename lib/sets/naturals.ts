import { MAX_VALUE, type NumberSet } from './types';

export const naturals: NumberSet = {
  id: 'naturals',
  name: 'Natural numbers',
  rule: String.raw`a_n = n`,
  radiusScale: 'linear',
  *generate() {
    for (let n = 1; n <= MAX_VALUE; n++) yield n;
  },
};
