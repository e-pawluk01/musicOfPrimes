export type RadiusScale = 'linear' | 'sqrt' | 'log';

/**
 * A number set. To add a new one, create one small file that exports
 * an object of this shape, then list it in lib/sets/index.ts.
 */
export interface NumberSet {
  id: string;
  name: string;
  /** The rule, written in TeX, shown as typeset maths. */
  rule: string;
  /** How distance from the centre grows with the value. */
  radiusScale: RadiusScale;
  /** Produces the terms one at a time, in order. */
  generate: () => Generator<number, void, void>;
}

/** Largest whole number that can be placed exactly. */
export const MAX_VALUE = Number.MAX_SAFE_INTEGER;
