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
}

/** fNIRS: mean(ΔHbO − ΔHbR) in µM; a 0.8 µM task response shows as +20 %. */
export const FNIRS_METER: MeterConfig = { scale: 4, calSec: 20, driftTau: 600, smoothTau: 1 };
/** EEG: ln(frontal β/α); a doubling of the ratio shows as +30 %. */
export const EEG_METER: MeterConfig = { scale: Math.LN2 / 0.3, calSec: 20, driftTau: 600, smoothTau: 2 };

export interface MeterReading {
  phase: 'calibrating' | 'active';
  /** 0..1 through the calibration window */
  calProgress: number;
  /** null while calibrating or when the input is missing */
  activity: number | null;
  reliable: boolean;
}

export class ActivityMeter {
  private smooth: number | null = null;
  private calSum = 0;
  private calT = 0;
  private ref: number | null = null;

  constructor(readonly cfg: MeterConfig) {}

  get calibrated(): boolean { return this.ref !== null; }

  /** 0..1 through the calibration window right now */
  get calProgressNow(): number { return this.ref !== null ? 1 : Math.min(1, this.calT / this.cfg.calSec); }

  /** Start over: a new calibration. */
  reset(): void {
    this.smooth = null;
    this.calSum = 0;
    this.calT = 0;
    this.ref = null;
  }

  /**
   * One tick.  `x` is null when the tick brought no data; `reliable` is false during
   * motion, poor contact or a missing baseline — such ticks neither calibrate nor count.
   */
  push(x: number | null, reliable: boolean, dt: number): MeterReading {
    const ok = reliable && x !== null && Number.isFinite(x) && dt > 0;
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
    return { phase: 'active', calProgress: 1, activity: this.smooth === null ? null : this.activityOf(), reliable: ok };
  }

  private activityOf(): number {
    return (100 * (this.smooth! - this.ref!)) / this.cfg.scale;
  }
}
