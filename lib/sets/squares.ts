import { MAX_VALUE, type NumberSet } from './types';

export const squares: NumberSet = {
  id: 'squares',
  name: 'Squares',
  rule: String.raw`a_n = n^2`,
  radiusScale: 'sqrt',
  *generate() {
    for (let n = 1; n * n <= MAX_VALUE; n++) yield n * n;
  },
};
