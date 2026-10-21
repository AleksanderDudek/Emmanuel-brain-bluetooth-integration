/**
 * The focus training's picture (DESIGN.md §5): layered silhouettes scrolling
 * with parallax, a filled area chart of the activity with the orb riding its
 * leading edge at a fixed x, the baseline line, and stars where points were
 * earned.  Canvas 2D, no assets; four scenes share one renderer.
 */
import type { SceneId } from '../settings';

export interface HistoryPoint {
  /** seconds since the game started */
  t: number;
  /** activity % (held while the signal is unreliable) */
  a: number;
  reliable: boolean;
  star?: boolean;
}

interface Layer { color: string; base: number; amp: number; freqs: [number, number, number]; speed: number; peaks?: boolean; caps?: string }

interface SceneSpec {
  name: string;
  sky: [string, string];
  layers: Layer[];
  clouds: string | null;
  starCount: number;
  sun?: { x: number; y: number; r: number; color: string };
  planets?: boolean;
  /** area fill, top of the screen → bottom */
  fill: [string, string, string, string];
}

export const SCENES: Record<SceneId, SceneSpec> = {
  hills: {
    name: 'Wzgórza', sky: ['#353c4a', '#4a5261'], clouds: 'rgba(160,168,180,.55)', starCount: 18,
    layers: [
      { color: '#6a7381', base: 0.30, amp: 0.10, freqs: [0.9, 2.1, 3.7], speed: 0.12 },
      { color: '#575f6d', base: 0.42, amp: 0.07, freqs: [1.3, 2.9, 5.1], speed: 0.25 },
      { color: '#3a414f', base: 0.53, amp: 0.05, freqs: [1.7, 3.3, 6.3], speed: 0.45 },
    ],
    fill: ['#ffb08a', '#ff6fa8', '#e81fd8', '#7a2fd8'],
  },
  dunes: {
    name: 'Wydmy', sky: ['#f4b27c', '#d9785f'], clouds: 'rgba(255,226,196,.45)', starCount: 0,
    sun: { x: 0.74, y: 0.2, r: 0.07, color: 'rgba(255,240,205,.9)' },
    layers: [
      { color: '#e39c6c', base: 0.36, amp: 0.06, freqs: [0.7, 1.6, 2.4], speed: 0.12 },
      { color: '#c77a52', base: 0.45, amp: 0.06, freqs: [1.1, 1.9, 3.2], speed: 0.25 },
      { color: '#9a5537', base: 0.54, amp: 0.04, freqs: [1.4, 2.6, 4.1], speed: 0.45 },
    ],
    fill: ['#fff0b8', '#ff9f6e', '#e8378f', '#6e2a9e'],
  },
  snow: {
    name: 'Śnieżne szczyty', sky: ['#7d97b8', '#c5d4e5'], clouds: 'rgba(255,255,255,.6)', starCount: 0,
    layers: [
      { color: '#aebdd0', base: 0.26, amp: 0.16, freqs: [1.1, 2.3, 4.7], speed: 0.1, peaks: true, caps: 'rgba(255,255,255,.92)' },
      { color: '#8396b0', base: 0.40, amp: 0.10, freqs: [1.6, 3.1, 5.9], speed: 0.22, peaks: true, caps: 'rgba(240,246,255,.7)' },
      { color: '#56677f', base: 0.53, amp: 0.05, freqs: [1.9, 3.7, 6.7], speed: 0.45 },
    ],
    fill: ['#ffe2f0', '#ff8fc0', '#d63bd6', '#5b37c9'],
  },
  space: {
    name: 'Kosmos', sky: ['#140b2b', '#2c1252'], clouds: null, starCount: 140, planets: true,
    layers: [],
    fill: ['#ffd27a', '#ff7fb0', '#c43ae0', '#4b2bb8'],
  },
};

/** Where things sit, as fractions of the canvas. */
export const BALL_X = 0.42;
export const BASELINE_Y = 0.62;
const TOP_Y = 0.13;
const BOTTOM_Y = 0.94;
/** activity range shown above the baseline before dynamic zoom kicks in */
const DEFAULT_RANGE = 30;
export const HISTORY_SEC = 36;
/** seconds of the curve's head that blend into the orb's position */
const HEAD_SEC = 0.8;

const TAU = Math.PI * 2;

/** Deterministic pseudo-random numbers for decorations (stable across frames). */
function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export interface SceneOptions { glow: boolean; zoom: boolean }

export class SceneRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private scroll = 0;
  private range = DEFAULT_RANGE;
  private ballY: number | null = null;
  private ballV = 0;
  private spin = 0;
  private glow = 0;
  private bursts: { x: number; y: number; t: number }[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, public scene: SceneId, public opts: SceneOptions = { glow: true, zoom: true }) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    // positions in the old size mean nothing now: snap instead of springing across the screen
    this.ballY = null;
    this.ballV = 0;
    this.bursts = [];
  }

  /** px per activity-% above the baseline, for the current zoom */
  private get pxPerPct(): number { return ((BASELINE_Y - TOP_Y) * this.h) / this.range; }

  private yOf(a: number): number {
    const y = BASELINE_Y * this.h - a * this.pxPerPct;
    return Math.max(TOP_Y * this.h * 0.6, Math.min(BOTTOM_Y * this.h, y));
  }

  /** A star burst at the orb (called when a point star is earned). */
  burst(): void {
    if (this.ballY !== null) this.bursts.push({ x: BALL_X * this.w, y: this.ballY, t: 0 });
  }

  /**
   * One frame.  `now` = seconds since the game started; `level` = the current activity (null: none yet);
   * `rising` = the signal is elevated and reliable (glow, spin).
   */
  draw(history: readonly HistoryPoint[], now: number, level: number | null, reliable: boolean, dt: number): void {
    const { ctx, w, h } = this;
    if (!w || !h) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pxPerSec = (BALL_X * w) / HISTORY_SEC;
    this.scroll += dt * pxPerSec;
    // dynamic zoom: widen the range when the curve leaves the view, ease back slowly
    if (this.opts.zoom) {
      const peak = history.reduce((m, p) => Math.max(m, Math.abs(p.a)), Math.abs(level ?? 0));
      const want = Math.max(DEFAULT_RANGE, Math.min(150, peak * 1.25));
      this.range += (want - this.range) * (1 - Math.exp(-dt / (want > this.range ? 0.8 : 6)));
    } else this.range = DEFAULT_RANGE;
    this.drawBackdrop(dt);
    const cur = level ?? 0;
    // the orb follows its target with a critically damped spring (the signal arrives at 10 Hz)
    const target = this.yOf(cur);
    if (this.ballY === null) this.ballY = target;
    const k = 18, c = 2 * Math.sqrt(k);
    this.ballV += (k * (target - this.ballY) - c * this.ballV) * Math.min(dt, 0.05);
    this.ballY += this.ballV * Math.min(dt, 0.05);
    this.drawArea(history, now, pxPerSec);
    this.drawBaseline();
    this.drawStars(history, now, pxPerSec);
    const elevated = reliable && cur >= 1;
    this.glow += ((elevated && this.opts.glow ? 1 : 0) - this.glow) * (1 - Math.exp(-dt / 0.6));
    this.spin += dt * (elevated ? 0.6 + Math.min(2, cur / 10) : 0.15) * (this.opts.glow ? 1 : 0.6);
    this.drawOrb(reliable);
    this.drawBursts(dt);
  }

  private drawBackdrop(dt: number): void {
    const { ctx, w, h } = this;
    const s = SCENES[this.scene];
    const sky = ctx.createLinearGradient(0, 0, 0, h * BASELINE_Y);
    sky.addColorStop(0, s.sky[0]);
    sky.addColorStop(1, s.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    if (s.starCount) {
      for (let i = 0; i < s.starCount; i++) {
        const x = ((hash(i) * w * 1.6 - this.scroll * 0.03) % (w * 1.6) + w * 1.6) % (w * 1.6) - w * 0.3;
        const y = hash(i + 99) * h * (s.planets ? 0.95 : 0.4);
        const tw = 0.55 + 0.45 * Math.sin(this.scroll * 0.01 + i);
        ctx.fillStyle = `rgba(255,255,255,${(s.planets ? 0.35 : 0.22) * tw + 0.1})`;
        const r = hash(i + 7) < 0.1 ? 1.6 : 0.9;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
    if (s.sun) {
      const g = ctx.createRadialGradient(s.sun.x * w, s.sun.y * h, 0, s.sun.x * w, s.sun.y * h, s.sun.r * Math.min(w, h) * 3);
      g.addColorStop(0, s.sun.color);
      g.addColorStop(0.3, 'rgba(255,230,190,.35)');
      g.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.planets) this.drawPlanets();
    if (s.clouds) {
      ctx.fillStyle = s.clouds;
      for (let i = 0; i < 9; i++) {
        const span = w * 1.5;
        const x = ((hash(i + 40) * span - this.scroll * (0.05 + hash(i + 3) * 0.06)) % span + span) % span - w * 0.25;
        const y = h * (0.06 + hash(i + 80) * 0.3);
        const sz = Math.min(w, h) * (0.025 + hash(i + 5) * 0.035);
        this.cloud(x, y, sz);
      }
    }
    for (const l of s.layers) this.drawLayer(l);
    void dt;
  }

  private cloud(x: number, y: number, s: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.6, s * 0.55, 0, 0, TAU);
    ctx.ellipse(x - s * 0.7, y + s * 0.1, s * 0.8, s * 0.45, 0, 0, TAU);
    ctx.ellipse(x + s * 0.5, y - s * 0.25, s * 0.9, s * 0.6, 0, 0, TAU);
    ctx.fill();
  }

  private drawLayer(l: Layer): void {
    const { ctx, w, h } = this;
    const off = this.scroll * l.speed;
    const yAt = (x: number): number => {
      const u = (x + off) / w;
      let v = Math.sin(u * TAU * l.freqs[0] * 0.5) * 0.55 + Math.sin(u * TAU * l.freqs[1] * 0.5 + 1.3) * 0.3 + Math.sin(u * TAU * l.freqs[2] * 0.5 + 2.1) * 0.15;
      if (l.peaks) v = 1 - Math.abs(v) * 2.2;
      return h * (l.base + l.amp * v);
    };
    const step = Math.max(4, w / 160);
    ctx.fillStyle = l.color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, yAt(x));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    if (l.caps) {
      // snow on the peaks: the band just under the ridge line
      ctx.save();
      ctx.clip();
      ctx.fillStyle = l.caps;
      ctx.beginPath();
      for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, yAt(x));
      for (let x = w + step; x >= 0; x -= step) ctx.lineTo(x, Math.max(yAt(x) + h * 0.03, h * (l.base - l.amp * 0.35)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPlanets(): void {
    const { ctx, w, h } = this;
    const m = Math.min(w, h);
    const planet = (x: number, y: number, r: number, c1: string, c2: string, ring: boolean) => {
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (ring) {
        ctx.strokeStyle = 'rgba(255,214,140,.55)';
        ctx.lineWidth = Math.max(1.5, r * 0.08);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.9, r * 0.45, -0.35, 0, TAU);
        ctx.stroke();
      }
    };
    const drift = this.scroll * 0.02;
    planet(w * 0.88 - (drift % (w * 1.3)), h * 0.18, m * 0.07, '#5fae8f', '#173b33', false);
    planet(w * 0.12, h * 0.82, m * 0.16, '#ffcf8a', '#a2401e', true);
    // golden rings drifting by, like the asteroid scene's
    ctx.strokeStyle = 'rgba(255,205,110,.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const span = w * 1.4;
      const x = ((hash(i + 200) * span - this.scroll * 0.35) % span + span) % span - w * 0.2;
      const y = h * (0.3 + hash(i + 210) * 0.4);
      ctx.beginPath();
      ctx.ellipse(x, y, m * 0.012, m * 0.03, 0.4 + i, 0, TAU);
      ctx.stroke();
    }
  }

  private drawArea(history: readonly HistoryPoint[], now: number, pxPerSec: number): void {
    const { ctx, w, h } = this;
    const bx = BALL_X * w;
    const s = SCENES[this.scene];
    const g = ctx.createLinearGradient(0, h * TOP_Y, 0, h);
    g.addColorStop(0, s.fill[0]);
    g.addColorStop(0.32, s.fill[1]);
    g.addColorStop((BASELINE_Y - TOP_Y) / (1 - TOP_Y), s.fill[2]);
    g.addColorStop(1, s.fill[3]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const pts = history.filter(p => now - p.t <= HISTORY_SEC + 2);
    const yb = this.ballY ?? this.yOf(0);
    let started = false;
    for (const p of pts) {
      const age = now - p.t;
      const x = bx - age * pxPerSec;
      const y = this.curveY(p, now);
      if (!started) {
        ctx.lineTo(Math.min(x, 0), y);
        started = true;
      }
      ctx.lineTo(x, y);
    }
    if (!started) ctx.lineTo(0, yb);
    ctx.lineTo(bx, yb);
    ctx.lineTo(w, yb);   // the present level continues flat to the right
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // soft light along the edge
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** The curve's height at a history point: the newest stretch bends into the orb, which follows the 10 Hz signal on a spring. */
  private curveY(p: HistoryPoint, now: number): number {
    const age = now - p.t, y = this.yOf(p.a);
    return age < HEAD_SEC && this.ballY !== null ? this.ballY + (y - this.ballY) * (age / HEAD_SEC) : y;
  }

  private drawBaseline(): void {
    const { ctx, w, h } = this;
    ctx.strokeStyle = 'rgba(255,255,255,.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(BASELINE_Y * h) + 0.5);
    ctx.lineTo(w, Math.round(BASELINE_Y * h) + 0.5);
    ctx.stroke();
  }

  private starPath(x: number, y: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
    }
    ctx.closePath();
  }

  private drawStars(history: readonly HistoryPoint[], now: number, pxPerSec: number): void {
    const { ctx, w } = this;
    const bx = BALL_X * w;
    const r = Math.max(3.5, Math.min(14, Math.min(this.w, this.h) * 0.018));
    for (const p of history) {
      if (!p.star) continue;
      const x = bx - (now - p.t) * pxPerSec;
      if (x < -r) continue;
      const age = now - p.t;
      const pop = Math.min(1, age / 0.35);
      ctx.fillStyle = `rgba(255,246,222,${0.95 * Math.min(1, x / (w * 0.08))})`;
      this.starPath(x, this.curveY(p, now) - r * 0.8 * pop, r * (0.6 + 0.4 * pop));
      ctx.fill();
    }
  }

  private get orbR(): number { return Math.max(7, Math.min(36, Math.min(this.w, this.h) * 0.045)); }

  private drawOrb(reliable: boolean): void {
    const { ctx, w, h } = this;
    const r = this.orbR;
    const x = BALL_X * w, y = (this.ballY ?? BASELINE_Y * h) - r;
    if (this.glow > 0.02) {
      const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3.4);
      g.addColorStop(0, `rgba(255,236,250,${0.55 * this.glow})`);
      g.addColorStop(1, 'rgba(255,236,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = reliable ? 1 : 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.25)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    // a calm two-stroke swirl that turns with the effort
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = r * 0.17;
    ctx.lineCap = 'round';
    for (const k of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(this.spin + k) * r * 0.22, y + Math.sin(this.spin + k) * r * 0.22, r * 0.42, this.spin + k + 0.4, this.spin + k + 2.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawBursts(dt: number): void {
    const { ctx } = this;
    const r = this.orbR;
    this.bursts = this.bursts.filter(b => (b.t += dt) < 0.9);
    for (const b of this.bursts) {
      const k = b.t / 0.9;
      ctx.strokeStyle = `rgba(255,246,222,${0.7 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y - r, r * (1.2 + 2.2 * k), 0, TAU);
      ctx.stroke();
    }
  }
}

/** A still frame of a scene with a gentle made-up curve, for the scene picker and tiles. */
export function drawScenePreview(canvas: HTMLCanvasElement, scene: SceneId): void {
  const r = new SceneRenderer(canvas, scene, { glow: true, zoom: false });
  r.resize();
  const hist: HistoryPoint[] = [];
  for (let t = 0; t <= HISTORY_SEC; t += 0.5) {
    // a session warming up: a slow rise with the breath-like waves of a real curve
    const a = 16 * (1 - Math.exp(-t / 14)) + 3.2 * Math.sin(t / 2.6) + 1.6 * Math.sin(t / 1.1 + 1) - 2;
    hist.push({ t, a, reliable: true, star: t > 8 && t % 5 === 0 });
  }
  const last = hist[hist.length - 1];
  for (let i = 0; i < 30; i++) r.draw(hist, HISTORY_SEC, last.a, true, 0.05);
}
