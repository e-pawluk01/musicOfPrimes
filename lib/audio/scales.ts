export interface Scale {
  id: string;
  name: string;
  /** Steps above the root note, in semitones, within one octave. */
  intervals: number[];
}

export const SCALES: Scale[] = [
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Natural minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'majorPentatonic', name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'minorPentatonic', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'wholeTone', name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10] },
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export function getScale(id: string): Scale {
  return SCALES.find((s) => s.id === id) ?? SCALES[2];
}
