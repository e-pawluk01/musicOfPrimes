import { describe, expect, it } from 'vitest';
import { primeFactors } from '../maths/factors';
import { digitSum, gapRatio, gapVolume, noteIndex, zoomVolume } from './mapping';

describe('mapping choices', () => {
  it('digit sum', () => {
    expect(digitSum(0)).toBe(0);
    expect(digitSum(7919)).toBe(26);
    expect(digitSum(9_007_199_254_740_991)).toBe(76);
  });

  it('every pitch source always picks a note that exists', () => {
    for (const source of ['angle', 'size', 'digits'] as const) {
      for (const slices of [6, 16, 49]) {
        for (const v of [0, 1, 2, 97, 7919, 611_953, 1e12, Number.MAX_SAFE_INTEGER]) {
          const i = noteIndex(source, v, slices);
          expect(Number.isInteger(i)).toBe(true);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(slices);
        }
      }
    }
  });

  it('size: bigger numbers play higher, until the range wraps', () => {
    expect(noteIndex('size', 1, 16)).toBeLessThan(noteIndex('size', 10, 16));
    expect(noteIndex('size', 10, 16)).toBeLessThan(noteIndex('size', 100, 16));
  });

  it('gaps are measured against the average and kept within sensible limits', () => {
    expect(gapRatio(4, 4)).toBe(1);
    expect(gapRatio(2, 4)).toBe(0.5);
    expect(gapRatio(1000, 4)).toBe(4);
    expect(gapRatio(0, 4)).toBe(0.25);
    expect(gapRatio(5, 0)).toBe(1);
  });

  it('volumes stay between quiet and full', () => {
    for (const r of [0.25, 1, 4]) {
      expect(gapVolume(r)).toBeGreaterThanOrEqual(0.3);
      expect(gapVolume(r)).toBeLessThanOrEqual(1);
    }
    expect(zoomVolume(10, 30)).toBe(1);
    expect(zoomVolume(3000, 30)).toBeLessThan(zoomVolume(300, 30));
    expect(zoomVolume(1e15, 30)).toBeGreaterThanOrEqual(0.12);
  });
});

describe('prime factors (for chords)', () => {
  it('finds the different prime factors', () => {
    expect(primeFactors(12)).toEqual([2, 3]);
    expect(primeFactors(97)).toEqual([97]);
    expect(primeFactors(360)).toEqual([2, 3, 5]);
    expect(primeFactors(1024)).toEqual([2]);
    expect(primeFactors(7919 * 2)).toEqual([2, 7919]);
  });

  it('gives nothing for numbers with no prime factors, or non-whole numbers', () => {
    expect(primeFactors(0)).toEqual([]);
    expect(primeFactors(1)).toEqual([]);
    expect(primeFactors(2.5)).toEqual([]);
    expect(primeFactors(-6)).toEqual([]);
  });

  it('stays fast for the largest numbers', () => {
    const start = Date.now();
    for (let i = 0; i < 200; i++) primeFactors(Number.MAX_SAFE_INTEGER - i);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
