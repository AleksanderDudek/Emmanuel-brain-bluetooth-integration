/**
 * Hemispheric balance tracker for the fNIRS trainer view: TypeScript port of
 * brainlink/fnirs_balance.py.
 *
 * Turns the pipeline's per-tick `asymmetry` (0–1; 0.5 = balanced, < 0.5 =
 * left prefrontal cortex more oxygenated, > 0.5 = right) into a stable
 * recommendation:
 *
 * - `train_left`:  right side dominates → suggest left-hemisphere tasks
 * - `train_right`: left side dominates  → suggest right-hemisphere tasks
 * - `focus`:       inside the balance band → hold attention on the forehead
 *
 * Raw asymmetry is noisy (Mayer waves, respiration, a metric still settling
 * after the baseline), so it is smoothed with an exponential moving average,
 * classified with hysteresis, and the recommendation only changes once the
 * new zone has persisted for `dwell_sec`.  Feedback is held while the signal
 * is unreliable (motion, poor contact): neurofeedback on artefacts would
 * reward the wrong thing.
 */

import { pyRound } from './dsp';
import type { BalanceConfig, BalancePause, BalanceState, Recommendation, Zone } from './types';

export const ZONES: readonly Zone[] = ['left_dominant', 'balanced', 'right_dominant'];
export const RECOMMENDATION: Readonly<Record<Zone, Recommendation>> = {
  left_dominant: 'train_right',
  balanced: 'focus',
  right_dominant: 'train_left',
};
/** A longer gap between updates (source switch, stalled stream) starts over. */
export const MAX_GAP_SEC = 2.0;

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = Object.freeze({
  low: 0.47, // balanced band, lower edge (asymmetry)
  high: 0.53, // balanced band, upper edge
  hysteresis: 0.01, // extra margin before leaving the balanced band
  smoothing_sec: 4.0, // EMA time constant; 0 = no smoothing
  dwell_sec: 5.0, // a zone must persist this long to change the recommendation
  warmup_sec: 15.0, // ignored after (re)start while the asymmetry metric settles
});

const CONFIG_KEYS = Object.keys(DEFAULT_BALANCE_CONFIG) as (keyof BalanceConfig)[];

/** Throws with the same messages as `BalanceConfig.validate` in Python. */
export function validateBalanceConfig(c: BalanceConfig): void {
  for (const k of CONFIG_KEYS) {
    const v: unknown = c[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${k} must be a finite number`);
  }
  if (!(c.low > 0.0 && c.low < c.high && c.high < 1.0)) throw new Error('need 0 < low < high < 1');
  if (!(c.hysteresis >= 0.0 && c.hysteresis <= 0.1)) throw new Error('hysteresis must be within 0..0.1');
  for (const k of ['smoothing_sec', 'dwell_sec', 'warmup_sec'] as const) {
    if (!(c[k] >= 0.0 && c[k] <= 600.0)) throw new Error(`${k} must be within 0..600 s`);
  }
}

function mergeConfig(base: BalanceConfig, overrides: Partial<BalanceConfig>): BalanceConfig {
  for (const k of Object.keys(overrides)) {
    if (!(CONFIG_KEYS as string[]).includes(k)) {
      throw new TypeError(`BalanceConfig got an unexpected keyword argument '${k}'`);
    }
  }
  return { ...base, ...overrides };
}

/** Call {@link update} once per stream tick; it returns the state for the UI. */
export class BalanceTracker {
  config: BalanceConfig;

  private raw: number | null = null;
  private smoothed: number | null = null;
  private zone: Zone | null = null;
  private recommendation: Recommendation | null = null;
  private paused: BalancePause | null = 'waiting';
  private now: number | null = null;
  private tLast: number | null = null;
  private validSince: number | null = null;
  private recZone: Zone | null = null;
  private recSince: number | null = null;
  private candidate: Zone | null = null;
  private candidateSince: number | null = null;
  private activeLast = false;
  private streakSec = 0.0;
  private zoneSec: Record<Zone, number> = { left_dominant: 0, balanced: 0, right_dominant: 0 };
  private sessionSec = 0.0;
  private bestStreakSec = 0.0;

  constructor(config: Partial<BalanceConfig> = {}) {
    this.config = mergeConfig(DEFAULT_BALANCE_CONFIG, config);
    validateBalanceConfig(this.config);
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  /** Forget the signal state (gap, new baseline, …); session stats are kept. */
  private restart(): void {
    this.raw = null;
    this.smoothed = null;
    this.zone = null;
    this.recommendation = null;
    this.now = null;
    this.tLast = null;
    this.validSince = null;
    this.recZone = null;
    this.recSince = null;
    this.candidate = null;
    this.candidateSince = null;
    this.activeLast = false;
    this.streakSec = 0.0;
  }

  resetStats(): void {
    this.zoneSec = { left_dominant: 0, balanced: 0, right_dominant: 0 };
    this.sessionSec = 0.0;
    this.streakSec = 0.0;
    this.bestStreakSec = 0.0;
  }

  /** Validate and apply overrides (the signal state is kept); unknown keys throw a TypeError. */
  setConfig(overrides: Partial<BalanceConfig>): BalanceConfig {
    const cfg = mergeConfig(this.config, overrides);
    validateBalanceConfig(cfg);
    this.config = cfg;
    return { ...cfg };
  }

  // ── Update ─────────────────────────────────────────────────────

  /**
   * Feed one asymmetry sample (`null` while the pipeline has no baseline).
   * `nowSec` is a monotonic time in seconds; `hold` names a reason to freeze
   * feedback (e.g. `"motion"`, `"poor_signal"`).
   */
  update(asymmetry: number | null, nowSec: number, hold: string | null = null): BalanceState {
    if (asymmetry === null || !Number.isFinite(asymmetry)) {
      this.restart();
      this.paused = 'waiting';
      return this.state();
    }
    if (this.tLast !== null && nowSec - this.tLast > MAX_GAP_SEC) this.restart();
    const dt = this.tLast === null ? 0.0 : Math.max(0.0, nowSec - this.tLast);
    this.tLast = this.now = nowSec;
    this.raw = asymmetry;
    if (this.smoothed === null || this.config.smoothing_sec <= 0) {
      this.smoothed = asymmetry;
    } else {
      // EMA with a time constant, so irregular tick intervals weigh correctly
      this.smoothed += (1.0 - Math.exp(-dt / this.config.smoothing_sec)) * (asymmetry - this.smoothed);
    }
    if (this.validSince === null) this.validSince = nowSec;

    if (hold || nowSec - this.validSince < this.config.warmup_sec) {
      // Freeze zone and recommendation; a new zone must persist the full dwell afterwards
      this.paused = (hold || 'warming_up') as BalancePause; // hold reasons are free-form, as in Python
      this.candidate = null;
      this.activeLast = false;
      this.streakSec = 0.0; // unmeasured time breaks the streak
      return this.state();
    }

    this.paused = null;
    const zone = this.classify(this.smoothed);
    this.zone = zone;
    if (this.activeLast) {
      // Only count time between two active ticks
      this.sessionSec += dt;
      this.zoneSec[zone] += dt;
      if (zone === 'balanced') {
        this.streakSec += dt;
        this.bestStreakSec = Math.max(this.bestStreakSec, this.streakSec);
      }
    }
    if (zone !== 'balanced') this.streakSec = 0.0;
    this.activeLast = true;

    if (zone === this.recZone) {
      this.candidate = null;
    } else {
      if (this.candidate !== zone) {
        this.candidate = zone;
        this.candidateSince = nowSec;
      }
      if (nowSec - (this.candidateSince ?? nowSec) >= this.config.dwell_sec) {
        this.recZone = zone;
        this.recSince = nowSec;
        this.recommendation = RECOMMENDATION[zone];
        this.candidate = null;
      }
    }
    return this.state();
  }

  /** Enter the band at its edges; leave it only past the hysteresis margin. */
  private classify(a: number): Zone {
    const c = this.config;
    const margin = this.zone === 'balanced' ? c.hysteresis : 0.0;
    if (c.low - margin <= a && a <= c.high + margin) return 'balanced';
    return a < (c.low + c.high) / 2.0 ? 'left_dominant' : 'right_dominant';
  }

  // ── Output ─────────────────────────────────────────────────────

  state(): BalanceState {
    const now = this.now;
    const c = this.config;
    let warmLeft: number | null = null;
    if (this.paused === 'warming_up' && now !== null && this.validSince !== null) {
      warmLeft = pyRound(Math.max(0.0, c.warmup_sec - (now - this.validSince)), 1);
    }
    let pending: BalanceState['pending'] = null;
    if (this.candidate !== null && now !== null && this.candidateSince !== null) {
      pending = {
        zone: this.candidate,
        recommendation: RECOMMENDATION[this.candidate],
        in_sec: pyRound(Math.max(0.0, c.dwell_sec - (now - this.candidateSince)), 1),
      };
    }
    const s = this.sessionSec;
    return {
      asymmetry: this.smoothed === null ? null : pyRound(this.smoothed, 3),
      raw: this.raw === null ? null : pyRound(this.raw, 3),
      zone: this.zone,
      recommendation: this.recommendation,
      recommendation_sec: this.recommendation && now !== null && this.recSince !== null
        ? pyRound(now - this.recSince, 1)
        : null,
      pending,
      paused: this.paused,
      warmup_left_sec: warmLeft,
      streak_sec: pyRound(this.streakSec, 1),
      stats: {
        session_sec: pyRound(s, 1),
        balanced_sec: pyRound(this.zoneSec.balanced, 1),
        left_dominant_sec: pyRound(this.zoneSec.left_dominant, 1),
        right_dominant_sec: pyRound(this.zoneSec.right_dominant, 1),
        balanced_pct: s > 0 ? pyRound((100.0 * this.zoneSec.balanced) / s, 1) : null,
        best_streak_sec: pyRound(this.bestStreakSec, 1),
      },
      config: { ...c },
    };
  }
}
