/** How far trial division goes. Keeps the work tiny even for huge numbers. */
const TRIAL_LIMIT = 10_000;

/**
 * The different prime factors of a whole number, smallest first.
 * For very large numbers, whatever is left after dividing out the small
 * primes is returned as the last factor.
 */
export function primeFactors(value: number): number[] {
  if (!Number.isInteger(value) || value < 2) return [];
  const factors: number[] = [];
  let rest = value;
  for (let d = 2; d <= TRIAL_LIMIT && d * d <= rest; d += d === 2 ? 1 : 2) {
    if (rest % d === 0) {
      factors.push(d);
      while (rest % d === 0) rest /= d;
    }
  }
  if (rest > 1) factors.push(rest);
  return factors;
}
