/**
 * The band's side readings for the games about the body (DESIGN.md §13): the balance of the two
 * prefrontal halves and Mendi's pulse — smoothed, held through short gaps, and never invented.
 *
 * The balance is the hemispheric trainer's metric (src/core/balance.ts): Mendi's right-minus-left
 * oxygenation through a logistic, 0.5 = even.  HALO gives the same shape from its two forehead
 * channels (hub.ts `eegBalance`).  An unreliable stretch longer than `hold` seconds drops it to null,
 * so a game shows "no reading" instead of a stale or made-up one.
 */
import type { HubSample } from '../../hub';

export interface BodySignals {
  /**
   * 0..1, the two prefrontal halves (0.5 even; below the left half is more active, above the right),
   * smoothed over ~3 s; null while unknown or while the signal is unreliable.
   */
  balance: number | null;
  /** Mendi's pulse (beats per minute, smoothed); null for HALO and before the first reading. */
  heartRate: number | null;
}

/** The band the hemispheric trainer counts as even (core/balance.ts DEFAULT_BALANCE_CONFIG). */
export const EVEN_LOW = 0.47;
export const EVEN_HIGH = 0.53;

/** Inside the even band (a game's "the halves are in step"). */
export const isEven = (balance: number | null): boolean => balance !== null && balance >= EVEN_LOW && balance <= EVEN_HIGH;

const PULSE_MIN = 30;
const PULSE_MAX = 220;

export class BodyTracker {
  private bal: number | null = null;
  private hr: number | null = null;
  private balGap = 0;
  private hrGap = 0;

  /**
   * @param tau  smoothing of the balance (s)
   * @param hold how long an unreliable or missing balance keeps its last value (s)
   * @param pulseHold how long a missing pulse keeps its last value (s)
   */
  constructor(private readonly tau = 3, private readonly hold = 3, private readonly pulseHold = 6) {}

  push(s: Pick<HubSample, 'reliable' | 'dt' | 'balance' | 'heartRate'>): BodySignals {
    const dt = Math.max(0, Math.min(1, Number.isFinite(s.dt) ? s.dt : 0));
    const b = s.balance;
    if (s.reliable && typeof b === 'number' && Number.isFinite(b)) {
      const v = Math.max(0, Math.min(1, b));
      this.bal = this.bal === null ? v : this.bal + (v - this.bal) * (1 - Math.exp(-dt / this.tau));
      this.balGap = 0;
    } else {
      this.balGap += dt;
      if (this.balGap > this.hold) this.bal = null;
    }
    const p = s.heartRate;
    if (typeof p === 'number' && Number.isFinite(p) && p >= PULSE_MIN && p <= PULSE_MAX) {
      this.hr = this.hr === null ? p : this.hr + (p - this.hr) * (1 - Math.exp(-dt / 2));
      this.hrGap = 0;
    } else {
      this.hrGap += dt;
      if (this.hrGap > this.pulseHold) this.hr = null;
    }
    return this.value;
  }

  get value(): BodySignals {
    return { balance: this.bal, heartRate: this.hr === null ? null : Math.round(this.hr) };
  }

  reset(): void {
    this.bal = null;
    this.hr = null;
    this.balGap = 0;
    this.hrGap = 0;
  }
}
