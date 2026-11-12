import type { RadiusScale } from '../sets/types';

/** Distance from the centre for a value, under the chosen scale. */
export function radiusFn(scale: RadiusScale): (v: number) => number {
  switch (scale) {
    case 'sqrt':
      return (v) => Math.sqrt(Math.abs(v));
    case 'log':
      return (v) => Math.log1p(Math.abs(v));
    default:
      return (v) => Math.abs(v);
  }
}
