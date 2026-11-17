/**
 * The focus training's view of the signal (DESIGN.md §5): one scalar per tick
 * from the active tool (fNIRS oxygenation in µM, or EEG ln(β/α)), turned into
 * "activity %" relative to a reference taken at calibration.
 *
 *   activity % = 100 · (x − ref) / scale
 *
 * `ref` is the mean of the calibration window and then follows slow drift
 * (time constant `driftTau`), so a band settling over ten minutes does not
 * read as focus.  Input is smoothed first (`smoothTau`).
 *
 * **A break in the signal is not a new calibration** (DESIGN.md §13).  When the
 * signal comes back after at least `shiftGap` seconds without it (the band
 * moved, lost contact, or reconnected and took a quick new baseline), the level
 * it comes back at says nothing about the brain: optical coupling changes shift
 * fNIRS by a constant (the "baseline shift" of motion-artifact correction).  So
 * the meter waits `settleSec` of reliable signal, then moves `ref` so that the
 * activity continues where it was just before the break — the median of the
 * seconds before the break, not the last moments, which the cause of the break
 * may already have spoiled — fading toward the reference with the length of the
 * gap (time constant `carryTau`).  A few seconds instead of a 20 s calibration;
 * the adaptive threshold and everything else carry on.  A break in which only
 * the data paused (a Bluetooth stall: the band did not move) is no shift and is
 * not re-anchored: the caller says which unreliable ticks may move the baseline.
 */

export interface MeterConfig {
  /** input change shown as +100 % */
  scale: number;
  /** seconds of reliable signal that define the reference */
  calSec: number;
  /** drift-following time constant of the reference (s); 0 = fixed reference */
  driftTau: number;
  /** input smoothing (s) */
  smoothTau: number;
  /** a break at least this long (s) is re-anchored when the signal returns; shorter dips just continue */
  shiftGap: number;
  /** reliable seconds the returned signal settles before it is re-anchored */
  settleSec: number;
  /** the activity before a break fades toward the reference over the gap with this time constant (s) */
  carryTau: number;
}

/** fNIRS: mean(ΔHbO − ΔHbR) in µM; a 0.8 µM task response shows as +20 %. */
export const FNIRS_METER: MeterConfig = { scale: 4, calSec: 20, driftTau: 600, smoothTau: 1, shiftGap: 1.5, settleSec: 2.5, carryTau: 20 };
/** EEG: ln(frontal β/α); a doubling of the ratio shows as +30 %. */
export const EEG_METER: MeterConfig = { scale: Math.LN2 / 0.3, calSec: 20, driftTau: 600, smoothTau: 2, shiftGap: 1.5, settleSec: 1.5, carryTau: 12 };

/** The window before a break whose median activity carries over (s before the break): [far, near]. */
const CARRY_WINDOW: readonly [number, number] = [4, 1];
/** The carried activity is kept inside ±this (activity %): a break that began with an artifact cannot carry it. */
const CARRY_MAX = 50;

export interface MeterReading {
  phase: 'calibrating' | 'active';
  /** 0..1 through the calibration window */
  calProgress: number;
  /** null while calibrating or when the input is missing */
  activity: number | null;
  reliable: boolean;
  /** the signal came back after a break and is being re-anchored (no new calibration) */
  anchoring?: boolean;
}

export class ActivityMeter {
  private smooth: number | null = null;
  private calSum = 0;
  private calT = 0;
  private ref: number | null = null;
  /** the meter's own clock (s of ticks) and the recent reliable activities on it, for the carry over a break */
  private clock = 0;
  private recent: { t: number; a: number }[] = [];
  /** seconds since the last reliable tick (0 while reliable) */
  private gapT = 0;
  /** a break being bridged: the activity to carry, how long the signal was gone, and the settle so far */
  private bridge: { carry: number; gap: number; settle: number } | null = null;
  /** the current break had a tick that may move the baseline (motion, contact, a new optical baseline, a reconnect) */
  private gapShift = false;
  /** how many breaks were bridged (re-anchored) since the calibration */
  anchors = 0;

  constructor(readonly cfg: MeterConfig) {}

  get calibrated(): boolean { return this.ref !== null; }

  /** The signal is back after a break and settles before it is re-anchored (or it is still gone after a long break). */
  get anchoring(): boolean { return this.bridge !== null; }

  /** 0..1 through the settle of a returned signal (0 while it is still gone). */
  get anchorProgress(): number { return this.bridge ? Math.min(1, this.bridge.settle / this.cfg.settleSec) : 1; }

  /** 0..1 through the calibration window right now */
  get calProgressNow(): number { return this.ref !== null ? 1 : Math.min(1, this.calT / this.cfg.calSec); }

  /** The calibrated reference (null while calibrating), to carry over to the next session on the same signal. */
  get reference(): number | null { return this.ref; }

  /** Start calibrated, at a reference taken moments ago on the same signal (same tool, same engine epoch). */
  adopt(ref: number): void {
    this.reset();
    this.ref = ref;
    this.calT = this.cfg.calSec;
    this.calSum = ref * this.cfg.calSec;
  }

  /** Start over: a new calibration. */
  reset(): void {
    this.smooth = null;
    this.calSum = 0;
    this.calT = 0;
    this.ref = null;
    this.recent = [];
    this.gapT = 0;
    this.bridge = null;
    this.gapShift = false;
    this.anchors = 0;
  }

  /**
   * One tick.  `x` is null when the tick brought no data; `reliable` is false during
   * motion, poor contact or a missing baseline — such ticks neither calibrate nor count.
   * `shift`: an unreliable tick whose cause may move the baseline (default); false for a
   * pause of the data alone, which is bridged without re-anchoring.
   */
  push(x: number | null, reliable: boolean, dt: number, shift = true): MeterReading {
    const ok = reliable && x !== null && Number.isFinite(x) && dt > 0;
    if (dt > 0) this.clock += dt;
    if (this.ref !== null && this.cfg.shiftGap > 0) {
      const held = this.bridgeTick(ok ? x : null, dt, shift);
      if (held) return held;
    }
    if (ok) {
      const a = this.cfg.smoothTau > 0 ? 1 - Math.exp(-dt / this.cfg.smoothTau) : 1;
      this.smooth = this.smooth === null ? x : this.smooth + a * (x - this.smooth);
    }
    if (this.ref === null) {
      if (ok) {
        this.calSum += x * dt;
        this.calT += dt;
        if (this.calT >= this.cfg.calSec) this.ref = this.calSum / this.calT;
      }
      return { phase: this.ref === null ? 'calibrating' : 'active', calProgress: Math.min(1, this.calT / this.cfg.calSec),
               activity: this.ref === null ? null : this.activityOf(), reliable: ok };
    }
    if (ok && this.cfg.driftTau > 0) this.ref += (1 - Math.exp(-dt / this.cfg.driftTau)) * (this.smooth! - this.ref);
    const activity = this.smooth === null ? null : this.activityOf();
    if (ok && activity !== null) {
      this.recent.push({ t: this.clock, a: activity });
      while (this.recent.length && this.clock - this.recent[0].t > CARRY_WINDOW[0] + 2) this.recent.shift();
    }
    return { phase: 'active', calProgress: 1, activity, reliable: ok };
  }

  /**
   * Bridging a break (after the calibration): counts the time without a signal; when a long enough break ends, lets
   * the returned signal settle and re-anchors the reference to it.  Returns the reading while the break is being
   * bridged, or null to go on as usual.
   */
  private bridgeTick(x: number | null, dt: number, shift: boolean): MeterReading | null {
    const cfg = this.cfg;
    if (x === null) {
      if (this.gapT === 0 && !this.bridge) {
        this.gapT = 1e-9;   // the break starts now
        this.gapShift = false;
      }
      this.gapT += dt;
      if (shift) this.gapShift = true;
      if (!this.bridge && this.gapShift && this.gapT >= cfg.shiftGap) {
        this.bridge = { carry: this.carryFrom(this.clock - this.gapT), gap: this.gapT, settle: 0 };
      } else if (this.bridge) {
        this.bridge.gap += dt;
        this.bridge.settle = 0;   // gone again while settling: the settle starts over when it returns
      }
      if (!this.bridge) return null;
      return { phase: 'active', calProgress: 1, activity: this.smooth === null ? null : this.activityOf(), reliable: false, anchoring: true };
    }
    this.gapT = 0;
    const b = this.bridge;
    if (!b) return null;
    // the returned signal: the smoother starts from it (not from the level before the break) and settles
    const a = cfg.smoothTau > 0 ? 1 - Math.exp(-dt / cfg.smoothTau) : 1;
    this.smooth = b.settle === 0 || this.smooth === null ? x : this.smooth + a * (x - this.smooth);
    b.settle += dt;
    if (b.settle < cfg.settleSec) return { phase: 'active', calProgress: 1, activity: null, reliable: false, anchoring: true };
    // re-anchor: the activity goes on from where it was, faded toward the reference over the break
    const carry = b.carry * Math.exp(-(b.gap + b.settle) / cfg.carryTau);
    this.ref = this.smooth! - (carry * cfg.scale) / 100;
    this.bridge = null;
    this.recent = [];
    this.anchors++;
    return null;
  }

  /** The activity just before a break that began at `t0` (meter clock): the median of [t0 − 4 s, t0 − 1 s], kept sane. */
  private carryFrom(t0: number): number {
    const [far, near] = CARRY_WINDOW;
    let pts = this.recent.filter(r => r.t >= t0 - far && r.t <= t0 - near).map(r => r.a);
    if (!pts.length) pts = this.recent.filter(r => r.t <= t0).map(r => r.a).slice(-3);
    if (!pts.length) return 0;
    pts.sort((p, q) => p - q);
    const m = pts.length % 2 ? pts[pts.length >> 1] : (pts[pts.length / 2 - 1] + pts[pts.length / 2]) / 2;
    return Math.max(-CARRY_MAX, Math.min(CARRY_MAX, m));
  }

  private activityOf(): number {
    return (100 * (this.smooth! - this.ref!)) / this.cfg.scale;
  }
}
