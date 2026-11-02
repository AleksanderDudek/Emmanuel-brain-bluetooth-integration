/**
 * The band's signal drawn inside a game's world (DESIGN.md §7): the last few tens of seconds of the
 * focus training's activity %, against the adaptive threshold, with the blocks behind it.  A game
 * keeps one SignalTrace, pushes every frame of play into it and draws it in its own skin — a ribbon
 * of dawn over the road, a skyline of palms, footprints in the grass — so the player sees what the
 * band sees and learns its rhythm: the effort shows a few seconds later, rest lets it sink.
 *
 * The meaning of the marks is the same in every game:
 *
 *   above the threshold   gold (the game's warm colour)
 *   rest blocks           a cool band behind the curve
 *   no signal             a gap with a dotted floor — never a low value, the sensor is to blame
 *   a blind block         veiled while it runs, revealed when it ends (walking without seeing)
 *
 * Unreliable samples are kept (as gaps) but never feed the range, so motion never squashes the curve.
 */
import type { Tool } from '../../tools';
import type { FocusFrame } from './focus';

export type TracePhase = 'focus' | 'rest' | 'free';

export interface TraceSample {
  /** seconds of play */
  t: number;
  /** activity % against the session's reference (null: no signal yet) */
  activity: number | null;
  threshold: number;
  level: number;
  calm: number;
  reliable: boolean;
  phase: TracePhase;
  /** recorded in a blind block: hidden until `unveil()` */
  veiled: boolean;
  /** when the veil was lifted (seconds of play), for the reveal's fade */
  revealedAt: number | null;
}

/** The haemodynamic delay the trace marks at its "now" end: fNIRS answers 4–6 s after the effort, EEG at once. */
export const LAG_SEC: Readonly<Record<Tool, number>> = { fnirs: 5, eeg: 1 };

/** How long a lifted veil takes to fade out (s). */
export const REVEAL_SEC = 1.2;

export interface TraceBox { x: number; y: number; w: number; h: number }

export interface TracePoint {
  x: number;
  /** the activity's y (NaN where there is no signal) and the threshold's y */
  y: number;
  ty: number;
  above: boolean;
  reliable: boolean;
  /** 0 = hidden by the veil, 1 = shown (a lifted veil fades from 0 to 1 over REVEAL_SEC) */
  shown: number;
  phase: TracePhase;
  level: number;
  calm: number;
  t: number;
}

export interface TraceBand { x0: number; x1: number; phase: TracePhase; veiled: boolean }

export interface TraceLayout {
  box: TraceBox;
  points: TracePoint[];
  /** runs of one phase (and veil), left to right */
  bands: TraceBand[];
  lo: number;
  hi: number;
  /** activity % → y in the box */
  yOf(v: number): number;
  /** seconds of play → x in the box */
  xOf(t: number): number;
}

export class SignalTrace {
  private readonly buf: TraceSample[] = [];
  private lastT = -Infinity;

  /** `windowSec` of history, one sample every `every` seconds at most. */
  constructor(readonly windowSec = 40, readonly every = 0.1) {}

  get samples(): readonly TraceSample[] { return this.buf; }

  get latest(): TraceSample | null { return this.buf.length ? this.buf[this.buf.length - 1] : null; }

  push(t: number, f: FocusFrame, phase: TracePhase, veiled = false): void {
    if (t - this.lastT < this.every - 1e-9) return;
    this.lastT = t;
    const reliable = f.reliable && f.activity !== null && Number.isFinite(f.activity);
    this.buf.push({
      t, activity: reliable ? f.activity : null, threshold: f.threshold, level: f.level, calm: f.calm,
      reliable, phase, veiled, revealedAt: null,
    });
    const cut = t - this.windowSec - 1;
    let drop = 0;
    while (drop < this.buf.length && this.buf[drop].t < cut) drop++;
    if (drop) this.buf.splice(0, drop);
  }

  /** A blind block ended: lift the veil from everything it hid (`now` = seconds of play). */
  unveil(now: number): void {
    for (const s of this.buf) {
      if (s.veiled) {
        s.veiled = false;
        s.revealedAt = now;
      }
    }
  }

  /** Forget everything (a new session). */
  clear(): void {
    this.buf.length = 0;
    this.lastT = -Infinity;
  }

  /**
   * The activity range to draw over the window: every reliable activity and threshold inside it,
   * padded by 15 %, at least `minSpan` wide (activity %) so a flat signal is not blown up into noise.
   */
  range(now: number, minSpan = 4): { lo: number; hi: number } {
    let lo = Infinity, hi = -Infinity;
    for (const s of this.buf) {
      if (s.t < now - this.windowSec) continue;
      lo = Math.min(lo, s.threshold);
      hi = Math.max(hi, s.threshold);
      if (s.reliable && s.activity !== null) {
        lo = Math.min(lo, s.activity);
        hi = Math.max(hi, s.activity);
      }
    }
    if (!Number.isFinite(lo)) return { lo: -minSpan / 2, hi: minSpan / 2 };
    const pad = (hi - lo) * 0.15;
    lo -= pad;
    hi += pad;
    if (hi - lo < minSpan) {
      const mid = (hi + lo) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
    return { lo, hi };
  }

  /**
   * The window mapped into `box`: time runs left to right with `now` on the right edge, activity
   * runs bottom to top.  `span` narrows the window (s); `minSpan` as in range().
   */
  layout(box: TraceBox, now: number, opts: { span?: number; minSpan?: number } = {}): TraceLayout {
    const span = Math.min(opts.span ?? this.windowSec, this.windowSec);
    const { lo, hi } = this.range(now, opts.minSpan);
    const yOf = (v: number) => box.y + box.h * (1 - (v - lo) / (hi - lo));
    const xOf = (t: number) => box.x + box.w * (1 - (now - t) / span);
    const points: TracePoint[] = [];
    for (const s of this.buf) {
      if (s.t < now - span) continue;
      const shown = s.veiled ? 0 : s.revealedAt === null ? 1 : Math.min(1, Math.max(0, (now - s.revealedAt) / REVEAL_SEC));
      points.push({
        x: xOf(s.t), y: s.reliable && s.activity !== null ? yOf(s.activity) : NaN, ty: yOf(s.threshold),
        above: s.reliable && s.activity !== null && s.activity >= s.threshold, reliable: s.reliable,
        shown, phase: s.phase, level: s.level, calm: s.calm, t: s.t,
      });
    }
    const bands: TraceBand[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const veiled = p.shown === 0;
      const x1 = i + 1 < points.length ? points[i + 1].x : p.x;
      const last = bands[bands.length - 1];
      if (last && last.phase === p.phase && last.veiled === veiled) last.x1 = x1;
      else bands.push({ x0: p.x, x1, phase: p.phase, veiled });
    }
    return { box, points, bands, lo, hi, yOf, xOf };
  }
}

/**
 * The window as `n` equal bars, oldest first, for skylines made of things (palms, beacons, stars):
 * each bar's mean level, whether most of its signal lay above the threshold, its phase, and whether
 * it had any signal or is still veiled.  A bar with no samples yet is `empty`.
 */
export interface TraceBar { level: number; calm: number; above: boolean; reliable: boolean; phase: TracePhase; shown: number; empty: boolean }

export function traceBars(trace: SignalTrace, now: number, n: number, span = trace.windowSec): TraceBar[] {
  const out: TraceBar[] = [];
  const w = span / n;
  const s = trace.samples;
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t0 = now - span + i * w, t1 = t0 + w;
    let k = 0, rel = 0, up = 0, lev = 0, calm = 0, shown = 1;
    let phase: TracePhase = 'free';
    while (j < s.length && s[j].t < t0) j++;
    for (let q = j; q < s.length && s[q].t < t1; q++) {
      const p = s[q];
      k++;
      phase = p.phase;
      if (p.veiled) shown = 0;
      else if (p.revealedAt !== null) shown = Math.min(shown, Math.min(1, Math.max(0, (now - p.revealedAt) / REVEAL_SEC)));
      if (!p.reliable || p.activity === null) continue;
      rel++;
      lev += p.level;
      calm += p.calm;
      if (p.activity >= p.threshold) up++;
    }
    out.push({
      level: rel ? lev / rel : 0, calm: rel ? calm / rel : 0, above: rel > 0 && up * 2 >= rel,
      reliable: rel > 0, phase, shown: k ? shown : 1, empty: k === 0,
    });
  }
  return out;
}

export interface TraceStyle {
  /** the curve below and above the threshold */
  line: string;
  above: string;
  lineWidth: number;
  /** the fill between the curve and the threshold where it lies above (a translucent gold) */
  aboveFill?: string;
  threshold: string;
  /** the band tints behind focus and rest blocks (transparent to skip) */
  focusBand?: string;
  restBand?: string;
  /** the dotted floor under a gap without signal */
  gap: string;
  /** the veil over a blind block */
  veil: string;
  /** the dot at "now" and a soft glow around it */
  now?: string;
  glow?: string;
  /** a bracket left of "now", `lagSec` wide: where the effort of "now" will show */
  lag?: { sec: number; color: string; label?: string; font?: string };
}

/**
 * Draws a laid-out trace in a style: bands, veils, the threshold, the gold above it, the curve (gaps
 * where the signal failed), the lag bracket and the "now" dot.  Games with their own picture use the
 * layout's points instead and draw their own marks.
 */
export function drawTrace(ctx: CanvasRenderingContext2D, l: TraceLayout, st: TraceStyle): void {
  const { box, points } = l;
  if (points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();

  for (const b of l.bands) {
    const c = b.phase === 'focus' ? st.focusBand : b.phase === 'rest' ? st.restBand : undefined;
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(b.x0, box.y, Math.max(1, b.x1 - b.x0), box.h);
  }

  // the threshold: a dashed line that moves as it adapts
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = st.threshold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.ty) : ctx.moveTo(p.x, p.ty)));
  ctx.stroke();
  ctx.setLineDash([]);

  // gold between the curve and the threshold where the signal lies above it
  if (st.aboveFill) {
    ctx.fillStyle = st.aboveFill;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (!a.above || !b.above || !(a.shown * b.shown)) continue;
      ctx.globalAlpha = Math.min(a.shown, b.shown);
      ctx.beginPath();
      ctx.moveTo(a.x, a.ty);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x, b.ty);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // the curve, segment by segment: its colour follows the threshold, gaps stay open
  ctx.lineWidth = st.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const shown = Math.min(a.shown, b.shown);
    if (!a.reliable || !b.reliable || shown <= 0) continue;
    ctx.globalAlpha = shown;
    ctx.strokeStyle = a.above && b.above ? st.above : st.line;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // gaps without signal: a dotted floor, so the eye reads "no data", not "low"
  ctx.strokeStyle = st.gap;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([1, 5]);
  const floor = box.y + box.h - 3;
  let gapFrom: number | null = null;
  for (let i = 0; i <= points.length; i++) {
    const p = points[i];
    const gap = p && !p.reliable && p.shown > 0;
    if (gap && gapFrom === null) gapFrom = p.x;
    if (!gap && gapFrom !== null) {
      const x1 = p ? p.x : points[points.length - 1].x;
      ctx.beginPath();
      ctx.moveTo(gapFrom, floor);
      ctx.lineTo(x1, floor);
      ctx.stroke();
      gapFrom = null;
    }
  }
  ctx.setLineDash([]);

  // veils over blind blocks
  ctx.fillStyle = st.veil;
  for (const b of l.bands) if (b.veiled) ctx.fillRect(b.x0, box.y, Math.max(1, b.x1 - b.x0), box.h);

  // the lag bracket: the last `sec` seconds, where the effort of now has not shown yet
  const last = points[points.length - 1];
  if (st.lag && st.lag.sec > 0) {
    const x0 = l.xOf(last.t - st.lag.sec);
    const y = box.y + 4;
    ctx.strokeStyle = st.lag.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y + 4);
    ctx.lineTo(x0, y);
    ctx.lineTo(last.x, y);
    ctx.lineTo(last.x, y + 4);
    ctx.stroke();
    if (st.lag.label) {
      ctx.fillStyle = st.lag.color;
      ctx.font = st.lag.font ?? '600 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(st.lag.label, (x0 + last.x) / 2, y + 2);
    }
  }

  // now
  if (st.now && last.reliable && last.shown > 0) {
    if (st.glow) {
      ctx.fillStyle = st.glow;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = st.now;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
