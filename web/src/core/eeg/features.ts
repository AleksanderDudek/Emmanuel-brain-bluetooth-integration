/**
 * EEG metric engine: TypeScript port of brainlink/features.py.
 *
 * Band powers → six game metrics in 0..1 (normalised between a floor and a
 * calibration ceiling, with sensitivity, dead zone and exponential smoothing)
 * and "combos" — metric conditions held for a while, with a cooldown.
 */
import { pyRound } from '../dsp';
import { EEG_METRICS, type BandPowers, type EegMetric, type EegMetrics } from './types';

export interface MetricParams { sensitivity: number; smoothing: number; dead_zone: number; window_sec?: number }

export interface CalibrationProfile {
  baseline_powers: Partial<BandPowers>;
  focus_ceiling: number;
  calm_ceiling: number;
  stress_blink_ceiling: number;
  stress_theta_ceiling: number;
  flow_coherence_threshold: number;
}

export interface Combo {
  /** metric → ">0.7" / "<0.2" */
  requires: Partial<Record<EegMetric, string>>;
  sustain_sec: number;
  cooldown_sec: number;
  enabled: boolean;
}

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  baseline_powers: {}, focus_ceiling: 3.0, calm_ceiling: 20.0, stress_blink_ceiling: 30, stress_theta_ceiling: 15.0,
  flow_coherence_threshold: 0.7,
};

export const DEFAULT_METRIC_PARAMS: Record<EegMetric, MetricParams> = {
  focus: { sensitivity: 1.0, smoothing: 0.3, dead_zone: 0.05, window_sec: 1.0 },
  calm: { sensitivity: 1.0, smoothing: 0.5, dead_zone: 0.10, window_sec: 2.0 },
  valence: { sensitivity: 1.0, smoothing: 0.4, dead_zone: 0.05 },
  instability: { sensitivity: 1.0, smoothing: 0.3, dead_zone: 0.08 },
  stress: { sensitivity: 1.0, smoothing: 0.4, dead_zone: 0.10 },
  flow: { sensitivity: 1.0, smoothing: 0.5, dead_zone: 0.15 },
};

export const DEFAULT_COMBOS: Record<string, Combo> = {
  super_flow: { requires: { focus: '>0.7', flow: '>0.8' }, sustain_sec: 3.0, cooldown_sec: 10.0, enabled: true },
  panic: { requires: { stress: '>0.8', flow: '<0.2' }, sustain_sec: 1.5, cooldown_sec: 5.0, enabled: true },
  zen_heal: { requires: { calm: '>0.8', stress: '<0.2' }, sustain_sec: 2.0, cooldown_sec: 8.0, enabled: true },
  berserker: { requires: { stress: '>0.6', focus: '>0.6' }, sustain_sec: 2.0, cooldown_sec: 12.0, enabled: true },
};

export type ComboTimer = { active_sec: number } | { cooldown_remaining: number };

export interface FeatureResult {
  metrics: EegMetrics;
  active_combos: string[];
  combo_timers: Record<string, ComboTimer>;
}

const zeros = (): EegMetrics => Object.fromEntries(EEG_METRICS.map(m => [m, 0])) as EegMetrics;
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export class FeatureEngine {
  calibration: CalibrationProfile = clone(DEFAULT_CALIBRATION);
  metricParams: Record<EegMetric, MetricParams> = clone(DEFAULT_METRIC_PARAMS);
  combos: Record<string, Combo> = clone(DEFAULT_COMBOS);
  private prev: EegMetrics = zeros();
  private comboStates = new Map<string, { active: boolean; active_since: number; cooldown_until: number }>();

  /** @param clock wall-clock seconds, for combo timing */
  constructor(private readonly clock: () => number = () => Date.now() / 1000) {}

  reset(): void {
    this.prev = zeros();
    this.comboStates.clear();
  }

  compute(bp: BandPowers, blinkCount: number): FeatureResult {
    const s = this.metricParams, c = this.calibration;
    const fpAlpha = (bp.Fp1.alpha + bp.Fp2.alpha) / 2;
    const fpBeta = (bp.Fp1.beta + bp.Fp2.beta) / 2;
    const occAlpha = (bp.O1.alpha + bp.O2.alpha) / 2;
    const fpTheta = (bp.Fp1.theta + bp.Fp2.theta) / 2;

    const focus = norm(fpBeta / Math.max(fpAlpha, 0.01), 0.5, c.focus_ceiling, s.focus);   // frontal beta/alpha
    const calm = norm(occAlpha, 2.0, c.calm_ceiling, s.calm);                            // occipital alpha
    const asym = Math.log(Math.max(bp.Fp1.alpha, 0.01)) - Math.log(Math.max(bp.Fp2.alpha, 0.01));
    const valence = norm(asym + 1.0, 0.0, 2.0, s.valence);                               // frontal alpha asymmetry
    const baselineTheta = c.baseline_powers.Fp1?.theta ?? 5.0;
    const instability = norm(fpTheta, baselineTheta * 0.5, c.stress_theta_ceiling, s.instability);
    const stress = norm(blinkCount, 2.0, c.stress_blink_ceiling, s.stress);              // blink-rate proxy
    const coherence = 1.0 - Math.abs(fpAlpha - occAlpha) / Math.max(fpAlpha + occAlpha, 0.01);
    const flow = norm(coherence, 0.2, c.flow_coherence_threshold, s.flow);

    const raw: EegMetrics = { focus, calm, valence, instability, stress, flow };
    const metrics = zeros();
    for (const k of EEG_METRICS) {
      const sm = s[k]?.smoothing ?? 0.3;
      metrics[k] = sm * this.prev[k] + (1 - sm) * raw[k];
    }
    this.prev = { ...metrics };
    const [active, timers] = this.evaluateCombos(metrics);
    const rounded = zeros();
    for (const k of EEG_METRICS) rounded[k] = pyRound(metrics[k], 3);
    return { metrics: rounded, active_combos: active, combo_timers: timers };
  }

  private evaluateCombos(m: EegMetrics): [string[], Record<string, ComboTimer>] {
    const now = this.clock();
    const active: string[] = [];
    const timers: Record<string, ComboTimer> = {};
    for (const [name, combo] of Object.entries(this.combos)) {
      if (combo.enabled === false) continue;
      let st = this.comboStates.get(name);
      if (!st) this.comboStates.set(name, st = { active: false, active_since: 0, cooldown_until: 0 });
      if (now < st.cooldown_until) {
        timers[name] = { cooldown_remaining: pyRound(st.cooldown_until - now, 1) };
        continue;
      }
      const met = Object.entries(combo.requires).every(([k, cond]) => {
        const v = m[k as EegMetric] ?? 0, t = Number(cond!.slice(1));
        return cond![0] === '>' ? v > t : v < t;
      });
      if (met) {
        if (!st.active) {
          st.active = true;
          st.active_since = now;
        }
        const elapsed = now - st.active_since;
        if (elapsed >= combo.sustain_sec) {
          active.push(name);
          timers[name] = { active_sec: pyRound(elapsed, 1) };
        }
      } else if (st.active) {
        st.active = false;
        st.cooldown_until = now + (combo.cooldown_sec ?? 5.0);
      }
    }
    return [active, timers];
  }
}

function norm(value: number, floor: number, ceiling: number, p: MetricParams): number {
  const sensitivity = p.sensitivity ?? 1.0, deadZone = p.dead_zone ?? 0.05;
  let raw = ((value - floor) / Math.max(ceiling - floor, 0.001)) * sensitivity;
  raw = Math.max(0, Math.min(1, raw));
  return raw < deadZone ? 0 : raw;
}
