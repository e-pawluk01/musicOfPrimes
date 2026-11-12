export type TimbreId = 'sine' | 'bell' | 'pluck' | 'pad';

export const TIMBRES: { id: TimbreId; name: string }[] = [
  { id: 'sine', name: 'Soft sine' },
  { id: 'bell', name: 'Bell' },
  { id: 'pluck', name: 'Pluck' },
  { id: 'pad', name: 'Warm pad' },
];

export interface Voice {
  /** The note's own volume control, used to fade it out early if needed. */
  out: GainNode;
  /** Stops the note's sound sources at the given time. */
  stop: (time: number) => void;
  /** When the note has died away by itself. */
  end: number;
}

/**
 * Builds one note.
 * @param peak loudest point, 0 to 1
 * @param decay how quickly the note dies away, in seconds
 */
export type Timbre = (
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  peak: number,
  decay: number,
) => Voice;

/** A volume shape with a smooth rise and a smooth fall, so there are no clicks. */
function envelope(
  ctx: AudioContext,
  time: number,
  peak: number,
  attack: number,
  decay: number,
): { out: GainNode; end: number } {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, time);
  out.gain.linearRampToValueAtTime(peak, time + attack);
  out.gain.setTargetAtTime(0, time + attack, decay);
  return { out, end: time + attack + decay * 6 };
}

function finish(oscs: OscillatorNode[], out: GainNode, time: number, end: number): Voice {
  for (const o of oscs) {
    o.start(time);
    o.stop(end);
  }
  oscs[0].onended = () => out.disconnect();
  return {
    out,
    end,
    stop: (t) => {
      for (const o of oscs) o.stop(t);
    },
  };
}

const sine: Timbre = (ctx, dest, freq, time, peak, decay) => {
  const { out, end } = envelope(ctx, time, peak, 0.012, decay);
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(out).connect(dest);
  return finish([osc], out, time, end);
};

/** A pure tone with two quieter, quickly fading overtones that are slightly "off", like a bell. */
const bell: Timbre = (ctx, dest, freq, time, peak, decay) => {
  const { out, end } = envelope(ctx, time, peak * 0.8, 0.004, decay * 1.8);
  out.connect(dest);
  const partials: [number, number, number][] = [
    [1, 1, 0],
    [2.76, 0.32, decay * 0.7],
    [5.4, 0.14, decay * 0.35],
  ];
  const oscs = partials
    .filter(([ratio]) => freq * ratio < 16000)
    .map(([ratio, level, fade]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, time);
      if (fade > 0) g.gain.setTargetAtTime(0, time, fade);
      osc.connect(g).connect(out);
      return osc;
    });
  return finish(oscs, out, time, end);
};

/** A bright start that quickly turns mellow, like a plucked string. */
const pluck: Timbre = (ctx, dest, freq, time, peak, decay) => {
  const { out, end } = envelope(ctx, time, peak * 0.75, 0.003, decay * 0.8);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(Math.min(freq * 7, 12000), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.3, 200), time + 0.16);
  osc.connect(filter).connect(out).connect(dest);
  return finish([osc], out, time, end);
};

/** Two slightly detuned tones, softened, with a slow rise and a long fall. */
const pad: Timbre = (ctx, dest, freq, time, peak, decay) => {
  const attack = Math.min(0.1, decay * 0.9);
  const { out, end } = envelope(ctx, time, peak * 0.55, attack, decay * 2.2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.connect(out).connect(dest);
  const oscs = [-7, 7].map((cents) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = cents;
    osc.connect(filter);
    return osc;
  });
  return finish(oscs, out, time, end);
};

const BY_ID: Record<TimbreId, Timbre> = { sine, bell, pluck, pad };

export function getTimbre(id: TimbreId): Timbre {
  return BY_ID[id] ?? sine;
}
