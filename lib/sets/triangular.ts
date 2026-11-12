import { MAX_VALUE, type NumberSet } from './types';

export const triangular: NumberSet = {
  id: 'triangular',
  name: 'Triangular numbers',
  rule: String.raw`T_n = \frac{n(n+1)}{2}`,
  radiusScale: 'sqrt',
  *generate() {
    let t = 0;
    for (let n = 1; t + n <= MAX_VALUE; n++) {
      t += n;
      yield t;
    }
  },
};
