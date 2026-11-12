import { angleOf, TAU } from '../maths/angle';
import { buildColorTable, LUT_SIZE, SPECTRUM, type ColorTable, type Palette } from './color';

/** The newest dot sits at most this far from the centre, as a share of the half-screen. */
const MARGIN = 0.9;
/** Below this many dots, simply redraw them all each frame. */
const DIRECT_MAX = 3000;
/** Above it, dots live on a saved layer that is re-made when it has shrunk this much. */
const REBAKE_AT = 0.92;
const GLOW_MS = 700;
const ZOOM_EASE_MS = 1100;
const DOT_MAX = 3.2;
const DOT_MIN = 0.45;
/** The guide spiral fades out once its turns are closer together than this (in screen pixels). */
const GUIDE_MIN_GAP = 3;
const GUIDE_STEP = TAU / 72;
const GUIDE_MAX_SEGMENTS = 12_000;

export class Plot {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layer: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;

  private w = 1;
  private h = 1;
  private dpr = 1;

  private values = new Float64Array(4096);
  private xs = new Float32Array(4096);
  private ys = new Float32Array(4096);
  private hues = new Uint8Array(4096);
  private buckets: number[][] = Array.from({ length: LUT_SIZE }, () => []);
  private count = 0;
  private maxR = 0;
  private maxValue = 0;

  private started = false;
  private logR = 0;
  private initR = 1;
  private snap = false;

  /** Show a faint spiral through the points. */
  guide = false;
  /** Keep movement to a minimum (for people who ask their device for that). */
  reducedMotion = false;
  private lastFrame = 0;

  private baked = false;
  private bakeS = 1;

  // Space kept clear on the right and bottom (for the settings panel), in screen pixels.
  private insetR = 0;
  private insetB = 0;
  private targetInsetR = 0;
  private targetInsetB = 0;
  private bakeDot = 1;

  private glowIdx: number[] = [];
  private glowAt: number[] = [];

  private colors: ColorTable = buildColorTable(SPECTRUM);
  private radius: (v: number) => number = (v) => v;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.layer = document.createElement('canvas');
    this.lctx = this.layer.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.baked = false;
  }

  /** Keeps the picture clear of something covering the right or bottom of the screen. */
  setInset(right: number, bottom: number): void {
    this.targetInsetR = Math.max(0, right);
    this.targetInsetB = Math.max(0, bottom);
  }

  setPalette(palette: Palette): void {
    this.colors = buildColorTable(palette);
    this.baked = false;
  }

  /** Changes how distance grows with value, moving the dots already drawn. */
  setRadius(radius: (v: number) => number): void {
    this.radius = radius;
    this.maxR = 0;
    for (let i = 0; i < this.count; i++) {
      const v = this.values[i];
      const r = radius(v);
      const angle = angleOf(v);
      this.xs[i] = r * Math.cos(angle);
      this.ys[i] = r * Math.sin(angle);
      if (r > this.maxR) this.maxR = r;
    }
    this.baked = false;
    this.snap = true;
  }

  reset(radius: (v: number) => number): void {
    this.radius = radius;
    this.count = 0;
    this.maxR = 0;
    this.maxValue = 0;
    this.started = false;
    this.baked = false;
    this.glowIdx = [];
    this.glowAt = [];
    for (const b of this.buckets) b.length = 0;
  }

  get dotCount(): number {
    return this.count;
  }

  addDot(value: number, now: number): void {
    if (this.count === this.xs.length) this.grow();
    const i = this.count++;
    const r = this.radius(value);
    const angle = angleOf(value);
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    const hue = Math.min(LUT_SIZE - 1, Math.floor((angle / TAU) * LUT_SIZE));
    this.values[i] = value;
    this.xs[i] = x;
    this.ys[i] = y;
    this.hues[i] = hue;
    this.buckets[hue].push(i);
    if (r > this.maxR) this.maxR = r;
    if (value > this.maxValue) this.maxValue = value;
    this.glowIdx.push(i);
    this.glowAt.push(now);

    if (this.baked && this.count > DIRECT_MAX) {
      const s = this.bakeS;
      const c = this.lctx;
      c.fillStyle = this.colors.css[hue];
      c.beginPath();
      c.arc(this.layer.width / 2 + x * s, this.layer.height / 2 - y * s, this.bakeDot, 0, TAU);
      c.fill();
    }
  }

  /**
   * Draws one frame.
   * @param targetR how far from the centre the view should reach
   * @param baseR the reach of the opening view, which dot size is measured against
   */
  frame(now: number, targetR: number, baseR: number): void {
    const dt = Math.min(100, Math.max(0, now - this.lastFrame));
    this.lastFrame = now;

    const target = Math.log(Math.max(targetR, 1e-6));
    this.initR = baseR;
    if (!this.started || this.snap) {
      this.logR = target;
      this.started = this.count > 0;
      this.snap = false;
    } else if (target > this.logR) {
      this.logR += (target - this.logR) * (1 - Math.exp(-dt / ZOOM_EASE_MS));
    }
    // Safety net: the newest dot must always be on screen.
    if (this.maxR > 0 && Math.exp(this.logR) < this.maxR) this.logR = Math.log(this.maxR);

    // Slide smoothly when the settings panel opens or closes.
    const ease = this.reducedMotion ? 1 : 1 - Math.exp(-dt / 110);
    for (const [key, goal] of [
      ['insetR', this.targetInsetR],
      ['insetB', this.targetInsetB],
    ] as const) {
      const gap = goal - this[key];
      if (gap === 0) continue;
      this[key] = Math.abs(gap) < 0.5 ? goal : this[key] + gap * ease;
      this.baked = false;
    }

    const viewR = Math.exp(this.logR);
    const dpr = this.dpr;
    const cx = ((this.w - this.insetR) / 2) * dpr;
    const cy = ((this.h - this.insetB) / 2) * dpr;
    const s = this.scaleFor(viewR) * dpr;
    const dot = this.dotSize(viewR) * dpr;

    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.guide) this.drawGuide(c, cx, cy, s);

    if (this.count <= DIRECT_MAX) {
      this.drawAll(c, cx, cy, s, dot);
    } else {
      if (!this.baked || s / this.bakeS < REBAKE_AT || s > this.bakeS * 1.0005) this.bake(viewR);
      const k = s / this.bakeS;
      const lw = this.layer.width * k;
      const lh = this.layer.height * k;
      c.drawImage(this.layer, cx - lw / 2, cy - lh / 2, lw, lh);
    }

    this.drawGlow(c, now, cx, cy, s, dot);
  }

  /** Screen pixels per unit of distance, when the view reaches out to viewR. */
  private scaleFor(viewR: number): number {
    const size = Math.max(40, Math.min(this.w - this.insetR, this.h - this.insetB));
    return ((size / 2) * MARGIN) / viewR;
  }

  /** Dots shrink gently as the view zooms out, down to a minimum size. */
  private dotSize(viewR: number): number {
    const size = DOT_MAX * Math.pow(this.initR / viewR, 0.25);
    return Math.min(DOT_MAX, Math.max(DOT_MIN, size));
  }

  private grow(): void {
    const n = this.xs.length * 2;
    const values = new Float64Array(n);
    values.set(this.values);
    this.values = values;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const hues = new Uint8Array(n);
    xs.set(this.xs);
    ys.set(this.ys);
    hues.set(this.hues);
    this.xs = xs;
    this.ys = ys;
    this.hues = hues;
  }

  private drawAll(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, dot: number): void {
    const { xs, ys, buckets } = this;
    for (let b = 0; b < LUT_SIZE; b++) {
      const list = buckets[b];
      if (list.length === 0) continue;
      c.fillStyle = this.colors.css[b];
      c.beginPath();
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        const x = cx + xs[i] * s;
        const y = cy - ys[i] * s;
        c.moveTo(x + dot, y);
        c.arc(x, y, dot, 0, TAU);
      }
      c.fill();
    }
  }

  /** Re-makes the saved layer of dots at the current zoom. */
  private bake(viewR: number): void {
    // Big enough to reach the furthest screen edge from the picture's centre.
    const lw = Math.ceil((this.canvas.width + this.insetR * this.dpr) / REBAKE_AT) + 8;
    const lh = Math.ceil((this.canvas.height + this.insetB * this.dpr) / REBAKE_AT) + 8;
    if (this.layer.width !== lw || this.layer.height !== lh) {
      this.layer.width = lw;
      this.layer.height = lh;
    } else {
      this.lctx.clearRect(0, 0, lw, lh);
    }
    this.bakeS = this.scaleFor(viewR) * this.dpr;
    // Slightly oversized, so the average size while the layer shrinks is right.
    this.bakeDot = (this.dotSize(viewR) * this.dpr) / Math.sqrt(REBAKE_AT);
    this.drawAll(this.lctx, lw / 2, lh / 2, this.bakeS, this.bakeDot);
    this.baked = true;
  }

  /**
   * A faint line through every possible point: the path a value traces as it grows.
   * Drawn only where its turns are far enough apart to see, fading as they close up.
   */
  private drawGuide(c: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
    const tMax = this.maxValue;
    if (tMax <= 0) return;
    const radius = this.radius;
    const minGap = GUIDE_MIN_GAP * this.dpr;
    c.lineWidth = this.dpr;
    let t = 0;
    let segments = 0;
    while (t < tMax && segments < GUIDE_MAX_SEGMENTS) {
      // How far apart neighbouring turns are here decides how visible this stretch is.
      const mid = Math.min(tMax, t + TAU);
      const gap = (radius(mid + TAU) - radius(mid)) * s;
      const alpha = 0.2 * Math.min(1, Math.max(0, (gap - minGap) / (2 * minGap)));
      if (alpha <= 0 && t > 0) break;
      c.strokeStyle = `rgba(255,255,255,${alpha})`;
      c.beginPath();
      let r = radius(t);
      c.moveTo(cx + r * Math.cos(t) * s, cy - r * Math.sin(t) * s);
      const stop = Math.min(tMax, t + TAU * 2);
      while (t < stop) {
        t = Math.min(stop, t + GUIDE_STEP);
        r = radius(t);
        c.lineTo(cx + r * Math.cos(t) * s, cy - r * Math.sin(t) * s);
        segments++;
      }
      c.stroke();
    }
  }

  /** The newest dots glow briefly, then settle. */
  private drawGlow(
    c: CanvasRenderingContext2D,
    now: number,
    cx: number,
    cy: number,
    s: number,
    dot: number,
  ): void {
    while (this.glowAt.length > 0 && now - this.glowAt[0] > GLOW_MS) {
      this.glowAt.shift();
      this.glowIdx.shift();
    }
    if (this.glowIdx.length === 0) return;
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < this.glowIdx.length; k++) {
      const i = this.glowIdx[k];
      const a = Math.pow(1 - (now - this.glowAt[k]) / GLOW_MS, 2);
      const x = cx + this.xs[i] * s;
      const y = cy - this.ys[i] * s;
      const [r, g, b] = this.colors.rgb[this.hues[i]];
      const reach = this.reducedMotion ? dot * 5 : dot * (3 + 6 * a);
      const grad = c.createRadialGradient(x, y, 0, x, y, reach);
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.6 * a})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(x, y, reach, 0, TAU);
      c.fill();
      c.fillStyle = `rgba(255,255,255,${0.75 * a})`;
      c.beginPath();
      c.arc(x, y, this.reducedMotion ? dot : dot * (1 + 0.5 * a), 0, TAU);
      c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
}
