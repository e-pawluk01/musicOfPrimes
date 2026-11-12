import { AudioEngine } from './audio/engine';
import {
  gapRatio,
  gapVolume,
  noteIndex,
  zoomVolume,
  type PitchSource,
  type RhythmMode,
  type VolumeMode,
} from './audio/mapping';
import { buildNotes, midiToFreq } from './audio/pitch';
import { getScale } from './audio/scales';
import type { TimbreId } from './audio/timbres';
import { primeFactors } from './maths/factors';
import { getPalette } from './render/color';
import { Plot } from './render/plot';
import { radiusFn } from './render/radius';
import { DEFAULT_SET_ID, getSet, type RadiusScale } from './sets';
import type { SetSource, WorkerRequest, WorkerResponse } from './sets/worker';

export type PlayerState = 'idle' | 'playing' | 'paused' | 'ended';

export interface PlayerSettings {
  /** Notes per second. */
  speed: number;
  /** How many terms to play before the piece ends. */
  maxTerms: number;
  scaleId: string;
  /** Root note: 0 = C, 1 = C sharp … 11 = B. */
  root: number;
  octaves: number;
  timbre: TimbreId;
  pitchSource: PitchSource;
  rhythm: RhythmMode;
  volume: VolumeMode;
  /** Also play notes for the number's prime factors. */
  chords: boolean;
  paletteId: string;
  /** Show a faint spiral through the points. */
  guide: boolean;
  radiusScale: RadiusScale;
}

export const SPEED_MIN = 1;
export const SPEED_MAX = 60;
export const TERMS_MIN = 100;
export const TERMS_MAX = 50_000;
/** The lowest root note: the C below middle C, as a MIDI number. */
const LOWEST_ROOT = 48;
const MAX_CHORD_NOTES = 4;

export const DEFAULT_SETTINGS: PlayerSettings = {
  speed: 6,
  maxTerms: 5000,
  scaleId: 'majorPentatonic',
  root: 0,
  octaves: 3,
  timbre: 'sine',
  pitchSource: 'angle',
  rhythm: 'steady',
  volume: 'steady',
  chords: false,
  paletteId: 'spectrum',
  guide: false,
  radiusScale: getSet(DEFAULT_SET_ID).radiusScale,
};

export interface PlayerEvents {
  onState: (state: PlayerState) => void;
  onProgress: (count: number, latest: number) => void;
  /** Tells how many terms the set has, once known to be limited (otherwise null). */
  onLength: (length: number | null) => void;
}

/** How far ahead of "now" notes are handed to the audio clock, in seconds. */
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const BATCH = 2000;
/** The zoom looks this far ahead so it starts moving before a dot needs the room. */
const ZOOM_AHEAD_S = 1.5;
/** How long the last notes are left to ring before the piece counts as ended. */
const TAIL_S = 3;

/** Links the numbers, the sound and the picture, and keeps them in time. */
export class Player {
  private readonly plot: Plot;
  private readonly events: PlayerEvents;
  private readonly worker: Worker;
  private engine: AudioEngine | null = null;

  private settings: PlayerSettings = { ...DEFAULT_SETTINGS };
  private radius = radiusFn(this.settings.radiusScale);
  private notes: number[] = [];

  private state: PlayerState = 'idle';
  private terms: number[] = [];
  private exhausted = false;
  private waiting = false;
  private runId = 0;

  private readonly times = new Float64Array(TERMS_MAX);
  private nextIndex = 0;
  private nextTime = 0;
  private shown = 0;
  private maxShownR = 0;
  private endTime = 0;
  private gapSum = 0;
  private gapCount = 0;

  private timer: ReturnType<typeof setInterval> | null = null;
  private raf = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, events: PlayerEvents) {
    this.events = events;
    this.plot = new Plot(canvas);
    this.plot.reset(this.radius);
    this.rebuildNotes();

    this.worker = new Worker(new URL('./sets/worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.onTerms(e.data);
    this.send({ type: 'reset', source: { type: 'builtin', id: DEFAULT_SET_ID }, runId: this.runId });
    this.requestMore();

    this.raf = requestAnimationFrame(this.frame);
  }

  /** Switches to another set of numbers and goes back to the start. */
  setSource(source: SetSource, radiusScale: RadiusScale): void {
    this.runId++;
    this.terms = [];
    this.exhausted = false;
    this.waiting = false;
    this.settings.radiusScale = radiusScale;
    this.radius = radiusFn(radiusScale);
    this.events.onLength(null);
    this.send({ type: 'reset', source, runId: this.runId });
    this.requestMore();
    this.restart();
  }

  /** Changes settings. They apply from the next note on. */
  update(patch: Partial<PlayerSettings>): void {
    const before = this.settings;
    const next = { ...before, ...patch };
    next.speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, next.speed));
    next.maxTerms = Math.min(TERMS_MAX, Math.max(1, Math.round(next.maxTerms)));
    next.octaves = Math.min(4, Math.max(1, Math.round(next.octaves)));
    this.settings = next;

    if (
      next.scaleId !== before.scaleId ||
      next.root !== before.root ||
      next.octaves !== before.octaves
    ) {
      this.rebuildNotes();
    }
    if (this.engine) this.engine.timbre = next.timbre;
    if (next.paletteId !== before.paletteId) this.plot.setPalette(getPalette(next.paletteId));
    this.plot.guide = next.guide;
    if (next.radiusScale !== before.radiusScale) {
      this.radius = radiusFn(next.radiusScale);
      this.plot.setRadius(this.radius);
      this.maxShownR = 0;
      for (let i = 0; i < this.shown; i++) {
        const r = this.radius(this.terms[i]);
        if (r > this.maxShownR) this.maxShownR = r;
      }
    }
  }

  /** Keeps the picture clear of the settings panel. */
  setInset(right: number, bottom: number): void {
    this.plot.setInset(right, bottom);
  }

  setReducedMotion(reduced: boolean): void {
    this.plot.reducedMotion = reduced;
  }

  resize(): void {
    this.plot.resize();
  }

  async play(): Promise<void> {
    if (this.state === 'playing') return;
    if (this.state === 'ended') this.restart();
    // Browsers only allow sound after a tap or click, so it is set up here.
    if (!this.engine) {
      this.engine = new AudioEngine();
      this.engine.timbre = this.settings.timbre;
    }
    await this.engine.ctx.resume();
    if (this.disposed) return;
    if (this.state === 'idle') this.nextTime = this.engine.ctx.currentTime + 0.12;
    this.setState('playing');
    this.timer ??= setInterval(this.tick, TICK_MS);
    this.tick();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.stopTimer();
    // Freezing the audio clock freezes notes already lined up, so resuming is seamless.
    void this.engine?.ctx.suspend();
    this.setState('paused');
  }

  toggle(): void {
    if (this.state === 'playing') this.pause();
    else void this.play();
  }

  restart(): void {
    this.stopTimer();
    this.engine?.silence();
    this.nextIndex = 0;
    this.shown = 0;
    this.maxShownR = 0;
    this.endTime = 0;
    this.gapSum = 0;
    this.gapCount = 0;
    this.plot.reset(this.radius);
    this.setState('idle');
    this.events.onProgress(0, 0);
  }

  dispose(): void {
    this.disposed = true;
    this.stopTimer();
    cancelAnimationFrame(this.raf);
    this.worker.terminate();
    void this.engine?.ctx.close();
  }

  private setState(state: PlayerState): void {
    this.state = state;
    this.events.onState(state);
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private rebuildNotes(): void {
    const { scaleId, root, octaves } = this.settings;
    this.notes = buildNotes(getScale(scaleId).intervals, LOWEST_ROOT + root, octaves);
  }

  private send(msg: WorkerRequest): void {
    this.worker.postMessage(msg);
  }

  private requestMore(): void {
    if (this.waiting || this.exhausted || this.terms.length >= TERMS_MAX) return;
    this.waiting = true;
    this.send({ type: 'more', count: BATCH, runId: this.runId });
  }

  private onTerms(res: WorkerResponse): void {
    if (res.runId !== this.runId) return;
    this.waiting = false;
    for (let i = 0; i < res.terms.length; i++) this.terms.push(res.terms[i]);
    this.exhausted = res.done;
    if (res.done) this.events.onLength(this.terms.length);
  }

  /** How many terms this run will play in total, as far as is known. */
  private get total(): number {
    const cap = Math.min(this.settings.maxTerms, TERMS_MAX);
    return this.exhausted ? Math.min(cap, this.terms.length) : cap;
  }

  /** The reach of the opening view: wide enough for the first handful of terms. */
  private get baseR(): number {
    if (this.terms.length === 0) return 30;
    let r = 0;
    const n = Math.min(10, this.terms.length);
    for (let i = 0; i < n; i++) r = Math.max(r, this.radius(this.terms[i]));
    return Math.max(r, 1);
  }

  private frequencyFor(value: number): number {
    const i = noteIndex(this.settings.pitchSource, value, this.notes.length);
    return midiToFreq(this.notes[i]);
  }

  /** Hands the next few notes to the audio clock. Runs many times a second. */
  private tick = (): void => {
    const engine = this.engine;
    if (!engine || this.state !== 'playing') return;
    const now = engine.ctx.currentTime;
    const total = this.total;
    const { speed, rhythm, volume, chords } = this.settings;

    if (this.terms.length < total && this.nextIndex + BATCH / 2 > this.terms.length) {
      this.requestMore();
    }
    // If we fell behind (for example the tab was in the background), pick up from now.
    if (this.nextTime < now) this.nextTime = now + 0.03;

    const decay = Math.min(0.3, Math.max(0.06, 1.5 / speed));
    const available = Math.min(total, this.terms.length);
    while (this.nextIndex < available && this.nextTime < now + LOOKAHEAD) {
      const i = this.nextIndex;
      const value = this.terms[i];
      const time = this.nextTime;

      // The gap to the previous term, compared with the average gap so far.
      let ratio = 1;
      if (i > 0) {
        const gap = Math.abs(value - this.terms[i - 1]);
        this.gapSum += gap;
        this.gapCount++;
        ratio = gapRatio(gap, this.gapSum / this.gapCount);
      }

      let velocity = 1;
      if (volume === 'gap') velocity = gapVolume(ratio);
      else if (volume === 'zoom') velocity = zoomVolume(this.radius(value), this.baseR);

      engine.playNote(this.frequencyFor(value), time, velocity, decay);
      if (chords && Number.isInteger(value)) {
        const factors = primeFactors(value).filter((f) => f !== value);
        for (const f of factors.slice(0, MAX_CHORD_NOTES)) {
          engine.playNote(this.frequencyFor(f), time, velocity * 0.45, decay);
        }
      }

      this.times[i] = time;
      this.nextIndex++;
      this.nextTime += (rhythm === 'gap' ? ratio : 1) / speed;
    }

    // Once the last term is lined up, leave time for it to ring out.
    if (this.nextIndex >= total && (this.exhausted || this.terms.length >= total)) {
      if (this.endTime === 0) this.endTime = Math.max(this.nextTime, now) + TAIL_S;
    } else {
      this.endTime = 0;
    }
  };

  /** Runs once per screen refresh: shows dots whose notes have sounded, then draws. */
  private frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);

    const engine = this.engine;
    if (engine && this.state !== 'idle') {
      const heard = engine.ctx.currentTime - engine.latency;
      const before = this.shown;
      while (this.shown < this.nextIndex && this.times[this.shown] <= heard) {
        const value = this.terms[this.shown++];
        this.plot.addDot(value, now);
        const r = this.radius(value);
        if (r > this.maxShownR) this.maxShownR = r;
      }
      if (this.shown !== before) this.events.onProgress(this.shown, this.terms[this.shown - 1]);

      if (
        this.state === 'playing' &&
        this.endTime > 0 &&
        this.shown >= this.nextIndex &&
        engine.ctx.currentTime > this.endTime
      ) {
        this.stopTimer();
        this.setState('ended');
      }
    }

    this.plot.frame(now, this.zoomTarget(), this.baseR);
  };

  /** How far out the view should reach: the furthest dot shown or about to be shown. */
  private zoomTarget(): number {
    let target = Math.max(this.baseR, this.maxShownR);
    const ahead = Math.ceil(this.settings.speed * ZOOM_AHEAD_S);
    const end = Math.min(this.shown + ahead, this.terms.length, this.total);
    for (let i = this.shown; i < end; i++) {
      const r = this.radius(this.terms[i]);
      if (r > target) target = r;
    }
    return target;
  }
}
