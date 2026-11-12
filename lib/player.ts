import { AudioEngine } from './audio/engine';
import { buildNotes, midiToFreq, noteForValue } from './audio/pitch';
import { getScale } from './audio/scales';
import { Plot } from './render/plot';
import { radiusFn } from './render/radius';
import { DEFAULT_SET_ID, getSet, type NumberSet } from './sets';
import type { WorkerRequest, WorkerResponse } from './sets/worker';

export type PlayerState = 'idle' | 'playing' | 'paused' | 'ended';

export interface PlayerSettings {
  /** Notes per second. */
  speed: number;
  /** How many terms to play before the piece ends. */
  maxTerms: number;
  scaleId: string;
  /** Lowest note, as a MIDI number (48 = the C below middle C). */
  rootMidi: number;
  octaves: number;
}

export const SPEED_MIN = 1;
export const SPEED_MAX = 60;
export const TERMS_MAX = 50_000;

export const DEFAULT_SETTINGS: PlayerSettings = {
  speed: 6,
  maxTerms: 5000,
  scaleId: 'majorPentatonic',
  rootMidi: 48,
  octaves: 3,
};

export interface PlayerEvents {
  onState: (state: PlayerState) => void;
  onProgress: (count: number, latest: number) => void;
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
  private set: NumberSet = getSet(DEFAULT_SET_ID);
  private radius = radiusFn(this.set.radiusScale);
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
    this.send({ type: 'reset', setId: this.set.id, runId: this.runId });
    this.requestMore();

    this.raf = requestAnimationFrame(this.frame);
  }

  get currentSet(): NumberSet {
    return this.set;
  }

  setSpeed(speed: number): void {
    this.settings.speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed));
  }

  resize(): void {
    this.plot.resize();
  }

  async play(): Promise<void> {
    if (this.state === 'playing') return;
    if (this.state === 'ended') this.restart();
    // Browsers only allow sound after a tap or click, so it is set up here.
    this.engine ??= new AudioEngine();
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
    const { scaleId, rootMidi, octaves } = this.settings;
    this.notes = buildNotes(getScale(scaleId).intervals, rootMidi, octaves);
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
  }

  /** How many terms this run will play in total, as far as is known. */
  private get total(): number {
    const cap = Math.min(this.settings.maxTerms, TERMS_MAX);
    return this.exhausted ? Math.min(cap, this.terms.length) : cap;
  }

  /** Hands the next few notes to the audio clock. Runs many times a second. */
  private tick = (): void => {
    const engine = this.engine;
    if (!engine || this.state !== 'playing') return;
    const now = engine.ctx.currentTime;
    const total = this.total;

    if (this.terms.length < total && this.nextIndex + BATCH / 2 > this.terms.length) {
      this.requestMore();
    }
    // If we fell behind (for example the tab was in the background), pick up from now.
    if (this.nextTime < now) this.nextTime = now + 0.03;

    const speed = this.settings.speed;
    const decay = Math.min(0.3, Math.max(0.06, 1.5 / speed));
    const available = Math.min(total, this.terms.length);
    while (this.nextIndex < available && this.nextTime < now + LOOKAHEAD) {
      const value = this.terms[this.nextIndex];
      engine.playNote(midiToFreq(noteForValue(value, this.notes)), this.nextTime, 1, decay);
      this.times[this.nextIndex] = this.nextTime;
      this.nextIndex++;
      this.nextTime += 1 / speed;
      if (this.nextIndex >= total) this.endTime = this.nextTime + TAIL_S;
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
        this.shown >= this.total &&
        engine.ctx.currentTime > this.endTime
      ) {
        this.stopTimer();
        this.setState('ended');
      }
    }

    this.plot.frame(now, this.zoomTarget());
  };

  /** How far out the view should reach: the furthest dot shown or about to be shown. */
  private zoomTarget(): number {
    // Open on a view wide enough for the first handful of terms.
    let target = this.terms.length > 9 ? this.radius(this.terms[9]) : 30;
    if (this.maxShownR > target) target = this.maxShownR;
    const ahead = Math.ceil(this.settings.speed * ZOOM_AHEAD_S);
    const end = Math.min(this.shown + ahead, this.terms.length, this.total);
    for (let i = this.shown; i < end; i++) {
      const r = this.radius(this.terms[i]);
      if (r > target) target = r;
    }
    return target;
  }
}
