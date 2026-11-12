import { MAX_VALUE, type NumberSet } from './types';

export const powersOfTwo: NumberSet = {
  id: 'powersOfTwo',
  name: 'Powers of 2',
  rule: String.raw`a_n = 2^{\,n-1}`,
  radiusScale: 'log',
  *generate() {
    for (let v = 1; v <= MAX_VALUE; v *= 2) yield v;
  },
};
