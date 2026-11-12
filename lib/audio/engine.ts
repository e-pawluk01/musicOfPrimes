import { getTimbre, type TimbreId, type Voice } from './timbres';

const MAX_VOICES = 24;

/** A soft room echo made from fading noise, so no sound file is needed. */
function makeImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      smooth += 0.3 * (white - smooth);
      data[i] = smooth * Math.pow(1 - i / length, 3);
    }
  }
  return buffer;
}

export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly mix: GainNode;
  private bus: GainNode;
  private voices: Voice[] = [];
  /** Which synth sound new notes use. */
  timbre: TimbreId = 'sine';

  constructor() {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    // Keeps loud moments from distorting.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 10;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    const master = ctx.createGain();
    master.gain.value = 0.85;
    limiter.connect(master).connect(ctx.destination);

    this.mix = ctx.createGain();
    this.mix.connect(limiter);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.mix.connect(reverb).connect(wet).connect(limiter);

    this.bus = this.newBus();
  }

  private newBus(): GainNode {
    const bus = this.ctx.createGain();
    bus.connect(this.mix);
    return bus;
  }

  /** How long after scheduling a sound actually reaches the speakers. */
  get latency(): number {
    const l = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return Math.min(0.25, Math.max(0, l));
  }

  /** Quickly fades and drops everything that is sounding or waiting to sound. */
  silence(): void {
    const old = this.bus;
    this.bus = this.newBus();
    this.voices = [];
    if (this.ctx.state === 'running') {
      old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      setTimeout(() => old.disconnect(), 200);
    } else {
      old.disconnect();
    }
  }

  /**
   * Plays one note with the current sound.
   * @param velocity loudness, 0 to 1
   * @param decay how quickly the note dies away, in seconds
   */
  playNote(freq: number, time: number, velocity: number, decay: number): void {
    const ctx = this.ctx;

    // Never let too many notes sound at once: fade out the oldest first.
    this.voices = this.voices.filter((v) => v.end > ctx.currentTime);
    while (this.voices.length >= MAX_VOICES) {
      const v = this.voices.shift()!;
      v.out.gain.cancelScheduledValues(time);
      v.out.gain.setTargetAtTime(0, time, 0.012);
      v.stop(time + 0.1);
    }

    // Higher notes sound louder to the ear, so turn them down a little.
    const peak = 0.22 * velocity * Math.min(1, Math.pow(330 / freq, 0.35));
    this.voices.push(getTimbre(this.timbre)(ctx, this.bus, freq, time, peak, decay));
  }
}
