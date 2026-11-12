# Music of the Primes

A small web app that turns sets of numbers into music and a growing picture.

Each number plays a note and appears as a dot. A number `v` sits at angle `v` radians, at a distance from the centre set by `v`. By default the angle also picks the note, so dots on the same ray share a colour and a pitch: the patterns you see are the patterns you hear.

It runs entirely in your browser. There is no server, no account and nothing is saved.

## Using it

- Pick a set and press **Play**. **Space** plays or pauses, **R** restarts.
- The bar at the bottom has play/pause, restart, speed, the set picker and settings. It fades away after a few seconds; move the mouse or tap to bring it back.
- **Settings** has four parts:
  - **Number set**: the set, how distance from the centre grows (linear, square root or log), and how many terms to play.
  - **What the numbers control**: pitch (angle, size or digit sum), rhythm (steady or by gap), volume (steady, by gap or fading with the zoom) and chords (a note for each prime factor).
  - **Sound**: scale, root note, octave range and instrument.
  - **Look**: colours and an optional guide spiral.

### Built-in sets

Primes, twin primes, Fibonacci, squares, triangular numbers, powers of 2 and the natural numbers.

Fibonacci and powers of 2 grow so fast that they end early (after 78 and 53 terms). Past that point the numbers are too large for a computer to place exactly.

### Custom sets

Choose **Custom…** in the set picker. There are three ways to define a set:

1. **Formula** in `n`, for example `n^2 + 1`. `n` counts 1, 2, 3 …
2. **Rule** using earlier terms, with starting values, for example `a(n-1) + a(n-2)` starting from `1, 1`.
3. **List**: paste numbers separated by commas, spaces or new lines.

You can type `+ - * / ^ ! mod`, brackets, `sqrt( )`, `floor( )`, `ceil( )`, `abs( )`, `round( )` and `π` (or `pi`), or use the symbol buttons. Things written side by side are multiplied, so `2n` and `n(n+1)` work. The formula is shown as typeset maths as you type, with the first few terms underneath.

Terms must be whole numbers that are not negative. If something is wrong, the editor says what in plain words and the set cannot be played until it is fixed.

## Run it on your computer

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000 and press Play.

## Check the logic

```bash
npm test
```

This checks the first terms of every set, the pitch mapping, the maths reader (including that it refuses anything that is not maths) and the custom set safeguards.

## Put it live

Import this repository in Vercel and press Deploy. No settings are needed.

## How it is built

- **Next.js** with strict TypeScript. Everything runs in the browser.
- **Sound** uses the browser's built-in Web Audio, with no audio library. Notes are lined up on the audio clock slightly ahead of time so the rhythm stays steady, and each dot is shown at the moment its note sounds.
- **Picture** is drawn on a canvas. Past 3,000 dots they are kept on a saved layer, so each frame only draws the layer and the newest dots.
- **Numbers** are worked out in the background (a Web Worker), in batches, so the screen never freezes.
- **Formulas** are read by a small purpose-built maths reader. Nothing typed is ever run as code.
- **KaTeX** shows the typeset maths.

### Folders

| Folder | What is in it |
| --- | --- |
| `app/` | The page, fonts and styling |
| `components/` | The screen: controls, settings panel, custom set editor |
| `lib/sets/` | The number sets, custom sets and the background worker |
| `lib/audio/` | Scales, pitch mapping, instruments and the sound engine |
| `lib/render/` | The plot, colours and radius scales |
| `lib/maths/` | The maths reader, angles and prime factors |
| `lib/player.ts` | Links numbers, sound and picture and keeps them in time |

### Adding a built-in set

Create one small file in `lib/sets/`, for example `cubes.ts`:

```ts
import { MAX_VALUE, type NumberSet } from './types';

export const cubes: NumberSet = {
  id: 'cubes',
  name: 'Cubes',
  rule: String.raw`a_n = n^3`,
  radiusScale: 'sqrt',
  *generate() {
    for (let n = 1; n ** 3 <= MAX_VALUE; n++) yield n ** 3;
  },
};
```

Then add it to the list in `lib/sets/index.ts`. It will appear in the set picker.
