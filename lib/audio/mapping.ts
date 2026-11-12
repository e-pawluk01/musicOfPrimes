import { angleOf } from '../maths/angle';
import { sliceForAngle } from './pitch';

export type PitchSource = 'angle' | 'size' | 'digits';
export type RhythmMode = 'steady' | 'gap';
export type VolumeMode = 'steady' | 'gap' | 'zoom';

/** How many notes the pitch climbs each time the number doubles ("size" pitch). */
const STEPS_PER_DOUBLING = 2;

export function digitSum(value: number): number {
  let v = Math.abs(Math.trunc(value));
  let sum = 0;
  while (v > 0) {
    sum += v % 10;
    v = Math.floor(v / 10);
  }
  return sum;
}

/** Which of the available notes (0 = lowest) a value plays. */
export function noteIndex(source: PitchSource, value: number, slices: number): number {
  switch (source) {
    case 'size':
      // Bigger numbers play higher; at the top it starts again from the bottom.
      return Math.floor(Math.log2(1 + Math.abs(value)) * STEPS_PER_DOUBLING) % slices;
    case 'digits':
      return digitSum(value) % slices;
    default:
      return sliceForAngle(angleOf(value), slices);
  }
}

/**
 * A gap compared with the average gap so far: 1 means typical.
 * Kept between a quarter and four, so nothing is absurdly short or long.
 */
export function gapRatio(gap: number, averageGap: number): number {
  if (!(averageGap > 0)) return 1;
  return Math.min(4, Math.max(0.25, gap / averageGap));
}

/** Loudness (0 to 1) when volume follows the gap: bigger gaps are louder. */
export function gapVolume(ratio: number): number {
  return Math.min(1, Math.max(0.3, 0.3 + 0.45 * ratio));
}

/** Loudness (0 to 1) when volume fades as the plot zooms out. */
export function zoomVolume(radius: number, startRadius: number): number {
  if (!(radius > startRadius)) return 1;
  return Math.min(1, Math.max(0.12, Math.pow(startRadius / radius, 0.2)));
}
