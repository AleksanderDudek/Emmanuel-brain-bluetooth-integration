/**
 * The signal dock's reading of the band (DESIGN.md §7.7), without the DOM: what the signal does right
 * now in plain words, whether the block that just ended moved the brain, and the session's contrast
 * so far.  It answers the player's question "is what I am doing working?" honestly —
 *
 *   now        above the threshold, rising, falling, or not yet — with fNIRS' lag in mind: in the
 *              first seconds of a block the old state still shows, so "wait" instead of "no"
 *   the block  its mean activity (after the lag) against the previous block of the other kind
 *              (a push against the rest before it, a rest against the push before it; the first push
 *              against the calibration's 0) — the contrast fNIRS studies measure
 *   the session  BlockContrast over every push and rest so far
 *
 * A blind block says nothing while it runs and reports when it ends.  Bad signal is never read as
 * low: it is "no signal", and a block without enough reliable seconds gets no verdict.
 */
import { BlockContrast, type FocusFrame } from './focus';
import type { TracePhase } from './trace';
import type { SignalPhase } from './types';

export type CoachState =
  | 'nosignal' | 'veiled'
  | 'wait' | 'above' | 'rising' | 'below'
  | 'restWait' | 'restLow' | 'falling' | 'restHigh'
  | 'freeAbove' | 'freeRising' | 'freeBelow';

export type Tone = 'good' | 'warn' | 'idle' | 'blind';

export const STATE_TONE: Readonly<Record<CoachState, Tone>> = {
  nosignal: 'idle', veiled: 'blind',
  wait: 'idle', above: 'good', rising: 'good', below: 'warn',
  restWait: 'idle', restLow: 'good', falling: 'good', restHigh: 'warn',
  freeAbove: 'good', freeRising: 'good', freeBelow: 'idle',
};

/** How a finished block went: the asked direction by at least MOVE_PCT, about flat, or the other way. */
export type BlockVerdict = 'moved' | 'flat' | 'against' | 'unjudged';

export interface BlockReport {
  kind: 'focus' | 'rest';
  blind: boolean;
  /** mean activity % after the lag (null: too little reliable signal) */
  mean: number | null;
  /** what it was compared with: the previous block of the other kind, or the calibration (0) */
  against: 'rest' | 'focus' | 'calibration';
  /** mean − reference (activity %) */
  delta: number | null;
  verdict: BlockVerdict;
  /** seconds of play when it ended */
  at: number;
}

/** A block counts as having moved the signal when its mean is this far (activity %) on the asked side. */
export const MOVE_PCT = 0.5;
/** Rising or falling: the slope of the last SLOPE_SEC, at least this steep (activity % per second). */
export const SLOPE_MIN = 0.12;
export const SLOPE_SEC = 4;
/** A block needs this many reliable seconds after its lag to be judged. */
export const MIN_JUDGED_SEC = 3;

interface Tick { t: number; v: number }

export class SignalCoach {
  state: CoachState = 'nosignal';
  /** the last finished push or rest block */
  report: BlockReport | null = null;
  readonly contrast: BlockContrast;
  /** activity % and the threshold of the latest reliable tick */
  activity: number | null = null;
  threshold = 0;
  slope = 0;
  private phase: SignalPhase = { want: 'free', blind: false };
  private inBlock = 0;
  private sum = 0;
  private sec = 0;
  private lastMean: { focus: number | null; rest: number | null } = { focus: null, rest: null };
  private recent: Tick[] = [];
  private gapSec = 0;

  /** `lagSec`: the band's delay (kit/trace LAG_SEC) — the start of a block that still shows the one before. */
  constructor(readonly lagSec: number) {
    this.contrast = new BlockContrast(lagSec);
  }

  get want(): TracePhase { return this.phase.want; }
  get blind(): boolean { return this.phase.blind; }
  /** seconds since the current block began */
  get blockSec(): number { return this.inBlock; }

  /** One tick of play: `t` = seconds of play, `phase` = the game's block (ArcadeGame.signal). */
  push(t: number, f: FocusFrame, phase: SignalPhase, dt: number): void {
    if (phase.want !== this.phase.want || phase.blind !== this.phase.blind) this.endBlock(t, phase);
    // the tick covers [at, at + dt) of the block: it counts once it starts past the lag
    const at = this.inBlock;
    this.inBlock += dt;
    const ok = f.reliable && f.activity !== null && Number.isFinite(f.activity);
    if (ok) {
      const v = f.activity as number;
      this.gapSec = 0;
      this.activity = v;
      this.threshold = f.threshold;
      this.recent.push({ t, v });
      while (this.recent.length && this.recent[0].t < t - SLOPE_SEC) this.recent.shift();
      this.slope = slopeOf(this.recent);
      if (this.phase.want !== 'free' && at >= this.lagSec - 1e-9) {
        this.sum += v * dt;
        this.sec += dt;
      }
      if (this.phase.want !== 'free') this.contrast.push(this.phase.want, v, true, at + 1e-9, dt);
    } else {
      this.gapSec += dt;
      // a short gap keeps the slope; a long one starts it again (the curve after it is a new piece)
      if (this.gapSec > 2) this.recent = [];
    }
    this.state = this.read(ok);
  }

  private read(ok: boolean): CoachState {
    const p = this.phase;
    if (p.blind) return 'veiled';
    if (!ok || this.activity === null) return 'nosignal';
    const above = this.activity >= this.threshold;
    const early = this.inBlock < this.lagSec + 1;
    const rising = this.slope >= SLOPE_MIN && this.recent.length > 1;
    const falling = this.slope <= -SLOPE_MIN && this.recent.length > 1;
    if (p.want === 'focus') return above ? 'above' : rising ? 'rising' : early ? 'wait' : 'below';
    if (p.want === 'rest') return !above ? 'restLow' : falling ? 'falling' : early ? 'restWait' : 'restHigh';
    return above ? 'freeAbove' : rising ? 'freeRising' : 'freeBelow';
  }

  private endBlock(t: number, next: SignalPhase): void {
    const was = this.phase;
    if (was.want !== 'free') {
      const kind = was.want;
      const mean = this.sec >= MIN_JUDGED_SEC ? this.sum / this.sec : null;
      const other = kind === 'focus' ? this.lastMean.rest : this.lastMean.focus;
      // the first push has no rest before it: the calibration's 0 is the honest reference
      const ref = other ?? (kind === 'focus' ? 0 : null);
      const against = other !== null ? (kind === 'focus' ? 'rest' : 'focus') : 'calibration';
      const delta = mean !== null && ref !== null ? mean - ref : null;
      const sign = kind === 'focus' ? 1 : -1;
      const verdict: BlockVerdict = delta === null ? 'unjudged'
        : delta * sign >= MOVE_PCT ? 'moved' : delta * sign <= -MOVE_PCT ? 'against' : 'flat';
      this.report = { kind, blind: was.blind, mean, against, delta, verdict, at: t };
      if (mean !== null) this.lastMean[kind] = mean;
    }
    this.phase = { ...next };
    this.inBlock = 0;
    this.sum = 0;
    this.sec = 0;
  }
}

/** Least-squares slope of v over t (per second); 0 with fewer than two points or under a second. */
function slopeOf(ticks: readonly Tick[]): number {
  const n = ticks.length;
  if (n < 2 || ticks[n - 1].t - ticks[0].t < 1) return 0;
  let st = 0, sv = 0;
  for (const k of ticks) { st += k.t; sv += k.v; }
  const mt = st / n, mv = sv / n;
  let num = 0, den = 0;
  for (const k of ticks) { num += (k.t - mt) * (k.v - mv); den += (k.t - mt) ** 2; }
  return den > 0 ? num / den : 0;
}
