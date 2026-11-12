import { describe, expect, it } from 'vitest';
import { angleOf, TAU } from '../maths/angle';
import { oklchToRgb } from '../render/color';
import { buildNotes, midiToFreq, noteForValue, sliceForAngle } from './pitch';
import { getScale } from './scales';

const pentatonic = getScale('majorPentatonic').intervals;

describe('angle', () => {
  it('is the value mod 2π', () => {
    expect(angleOf(0)).toBe(0);
    expect(angleOf(1)).toBeCloseTo(1, 12);
    expect(angleOf(7)).toBeCloseTo(7 - TAU, 12);
    expect(angleOf(611_953)).toBeCloseTo(611_953 % TAU, 6);
  });

  it('always lands in [0, 2π)', () => {
    for (const v of [0, 2, 3, 1e6, 1e12, Number.MAX_SAFE_INTEGER, TAU, TAU * 3]) {
      const a = angleOf(v);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(TAU);
    }
  });
});

describe('pitch mapping', () => {
  it('builds the notes low to high, ending on the top root', () => {
    expect(buildNotes(pentatonic, 48, 1)).toEqual([48, 50, 52, 55, 57, 60]);
    expect(buildNotes(pentatonic, 48, 3)).toHaveLength(16);
    expect(buildNotes(getScale('chromatic').intervals, 60, 4)).toHaveLength(49);
  });

  it('cuts the circle into equal slices', () => {
    expect(sliceForAngle(0, 16)).toBe(0);
    expect(sliceForAngle(TAU / 16 - 1e-9, 16)).toBe(0);
    expect(sliceForAngle(TAU / 16 + 1e-9, 16)).toBe(1);
    expect(sliceForAngle(TAU / 2 + 1e-9, 16)).toBe(8);
    expect(sliceForAngle(TAU - 1e-9, 16)).toBe(15);
    expect(sliceForAngle(TAU, 16)).toBe(15);
  });

  it('one full turn covers the whole range, low to high', () => {
    const notes = buildNotes(pentatonic, 48, 3);
    expect(noteForValue(0.01, notes)).toBe(48);
    expect(noteForValue(TAU - 0.01, notes)).toBe(84);
    let last = -Infinity;
    for (let a = 0.001; a < TAU; a += 0.05) {
      const n = noteForValue(a, notes);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('gives the same note to values on the same ray', () => {
    const notes = buildNotes(pentatonic, 48, 3);
    // 2 and 2 + 710 sit on almost the same ray (710 is very nearly 113 full turns).
    expect(noteForValue(2 + 710, notes)).toBe(noteForValue(2, notes));
    expect(notes).toContain(noteForValue(7919, notes));
  });

  it('turns notes into frequencies', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 9);
    expect(midiToFreq(57)).toBeCloseTo(220, 9);
  });
});

describe('colour', () => {
  it('always gives a displayable colour', () => {
    for (let h = 0; h < 360; h += 7) {
      for (const v of oklchToRgb(0.8, 0.125, h)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });

  it('gives grey when there is no colour strength', () => {
    const [r, g, b] = oklchToRgb(0.8, 0, 0);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
  });
});
