import { MAX_VALUE, type NumberSet } from './types';

export const fibonacci: NumberSet = {
  id: 'fibonacci',
  name: 'Fibonacci',
  rule: String.raw`F_n = F_{n-1} + F_{n-2}, \quad F_1 = F_2 = 1`,
  radiusScale: 'log',
  *generate() {
    let a = 1;
    let b = 1;
    while (a <= MAX_VALUE) {
      yield a;
      [a, b] = [b, a + b];
    }
  },
};
