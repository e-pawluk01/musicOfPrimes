import { angleOf, TAU } from '../maths/angle';

/**
 * Every note available: the scale repeated over the octave range,
 * low to high, finishing on the root note at the top.
 * Notes are MIDI numbers (60 = middle C).
 */
export function buildNotes(intervals: number[], rootMidi: number, octaves: number): number[] {
  const notes: number[] = [];
  for (let o = 0; o < octaves; o++) {
    for (const step of intervals) notes.push(rootMidi + 12 * o + step);
  }
  notes.push(rootMidi + 12 * octaves);
  return notes;
}

/** Which slice of the circle an angle falls in, when the circle is cut into `slices` equal parts. */
export function sliceForAngle(angle: number, slices: number): number {
  const i = Math.floor((angle / TAU) * slices);
  return Math.min(slices - 1, Math.max(0, i));
}

/** The note for a value: its angle (value mod 2π) picks the slice, the slice picks the note. */
export function noteForValue(value: number, notes: number[]): number {
  return notes[sliceForAngle(angleOf(value), notes.length)];
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
