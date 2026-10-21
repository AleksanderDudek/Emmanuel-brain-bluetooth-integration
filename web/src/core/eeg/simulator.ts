/**
 * EEG simulator: TypeScript port of brainlink/simulator.py.
 *
 * Synthetic four-channel EEG (µV) with mental states that blend smoothly
 * into each other, slow electrode drift and auto-played scenarios.  Same
 * signal model as the server; the noise comes from a seeded PRNG.
 */
import { mulberry32, normalGenerator } from '../random';
import { EEG_CHANNELS, EEG_SAMPLE_RATE, type EegChannel } from './types';

export const EEG_STATES = ['baseline', 'focus', 'stress', 'flow', 'eyes_closed', 'panic_spike'] as const;
export type EegState = (typeof EEG_STATES)[number];

export const EEG_SCENARIOS: Record<string, [EegState, number][]> = {
  gaming_session: [['baseline', 8], ['focus', 12], ['stress', 6], ['focus', 8], ['flow', 15], ['stress', 5], ['eyes_closed', 6], ['baseline', 5]],
  horror_game: [['baseline', 5], ['focus', 8], ['stress', 10], ['panic_spike', 2], ['stress', 6], ['eyes_closed', 4], ['focus', 6],
                ['stress', 12], ['panic_spike', 3], ['flow', 8]],
  meditation_trainer: [['baseline', 6], ['eyes_closed', 10], ['focus', 8], ['eyes_closed', 12], ['flow', 20], ['eyes_closed', 8], ['baseline', 5]],
  crafting_focus: [['baseline', 4], ['focus', 20], ['flow', 15], ['focus', 10], ['stress', 3], ['focus', 12], ['flow', 10]],
};

export interface EegAutoProgress { scenario: string; step_idx: number; total_steps: number; current_state: string; step_remaining_sec: number }

const TAU = 2 * Math.PI;

export class EEGSimulator {
  t = 0;
  state = 'baseline';
  private target: EegState = 'baseline';
  private prev: EegState = 'baseline';
  private blend = 1;
  private readonly blendRate = 0.8;
  private auto: { name: string; steps: [EegState, number][]; idx: number; timer: number } | null = null;
  private readonly drift: Record<EegChannel, number>;
  private driftTimer = 0;
  private readonly normal: () => number;
  private readonly uniform: () => number;
  private last = -1;

  /** @param clock monotonic milliseconds for real-time pacing (`generateRealtime`) */
  constructor(seed = Math.floor(Math.random() * 2 ** 32), private readonly clock: () => number = () => performance.now()) {
    this.uniform = mulberry32(seed ^ 0x9e3779b9);
    this.normal = normalGenerator(seed);
    this.drift = Object.fromEntries(EEG_CHANNELS.map(ch => [ch, this.normal() * 0.5])) as Record<EegChannel, number>;
  }

  /** A state name, `auto:<scenario>` or `auto_stop`. */
  setState(state: string): void {
    if (state.startsWith('auto:')) return this.startAuto(state.slice(5));
    if (state === 'auto_stop') {
      this.auto = null;
      return;
    }
    if (!(EEG_STATES as readonly string[]).includes(state)) return;
    if (state !== this.target) {
      this.prev = this.target;
      this.target = state as EegState;
      this.blend = 0;
    }
  }

  private startAuto(name: string): void {
    const steps = EEG_SCENARIOS[name];
    if (!steps) return;
    this.auto = { name, steps, idx: 0, timer: 0 };
    this.setState(steps[0][0]);
  }

  get autoProgress(): EegAutoProgress | null {
    const a = this.auto;
    if (!a) return null;
    const step = a.steps[a.idx];
    return {
      scenario: a.name, step_idx: a.idx, total_steps: a.steps.length, current_state: step ? step[0] : 'done',
      step_remaining_sec: step ? Math.round((step[1] - a.timer) * 10) / 10 : 0,
    };
  }

  /** Samples due since the last call (at 250 Hz, at most 1 s), for the 10 Hz loop. */
  generateRealtime(): Record<EegChannel, Float64Array> {
    const now = this.clock();
    if (this.last < 0) this.last = now - 100;
    const n = Math.min(EEG_SAMPLE_RATE, Math.floor(((now - this.last) / 1000) * EEG_SAMPLE_RATE));
    this.last += (n / EEG_SAMPLE_RATE) * 1000;
    return this.generate(n);
  }

  /** Restart real-time pacing (after the source was switched away and back). */
  resync(): void { this.last = -1; }

  generate(n: number): Record<EegChannel, Float64Array> {
    const dt = 1 / EEG_SAMPLE_RATE, dur = n * dt;
    this.advanceAuto(dur);
    this.blend = Math.min(1, this.blend + this.blendRate * dur);
    this.state = this.blend >= 0.99 ? this.target : `${this.prev}>${this.target}`;
    this.driftTimer += dur;
    if (this.driftTimer > 3) {
      this.driftTimer = 0;
      for (const ch of EEG_CHANNELS) this.drift[ch] = (this.drift[ch] + this.normal() * 0.3) * 0.8;
    }
    const out = {} as Record<EegChannel, Float64Array>;
    for (const ch of EEG_CHANNELS) {
      const t = Float64Array.from({ length: n }, (_, i) => this.t + i * dt);
      const a = this.signal(ch, t, this.prev), b = this.signal(ch, t, this.target);
      const y = new Float64Array(n);
      for (let i = 0; i < n; i++) y[i] = a[i] * (1 - this.blend) + b[i] * this.blend + this.drift[ch];
      out[ch] = y;
    }
    this.t += n * dt;
    return out;
  }

  private advanceAuto(dur: number): void {
    const a = this.auto;
    if (!a) return;
    a.timer += dur;
    if (a.idx >= a.steps.length || a.timer < a.steps[a.idx][1]) return;
    a.timer = 0;
    a.idx = (a.idx + 1) % a.steps.length;   // loops back to the start
    this.prev = this.target;
    this.target = a.steps[a.idx][0];
    this.blend = 0;
  }

  private signal(ch: EegChannel, t: Float64Array, state: EegState): Float64Array {
    const n = t.length, frontal = ch.startsWith('Fp');
    const sig = new Float64Array(n);
    const noise = Float64Array.from({ length: n }, () => this.normal() * 3);
    const sin = (f: number, i: number, ph = 0) => Math.sin(TAU * f * t[i] + ph);
    for (let i = 0; i < n; i++) {
      sig[i] = frontal
        ? 5 * sin(10, i) + 2.5 * sin(20, i, 0.3) + 2 * sin(5.5, i) + 0.8 * sin(38, i) + noise[i]
        : 8 * sin(10.3, i) + 1.5 * sin(21, i, 0.5) + 1.5 * sin(6, i) + 0.5 * sin(40, i) + noise[i];
    }
    if (state === 'eyes_closed') {
      for (let i = 0; i < n; i++) {
        sig[i] += frontal ? 4 * sin(10, i) - 1.5 * sin(20, i) : 25 * sin(10.2, i) + 8 * sin(10.5, i, 1.2);
      }
    } else if (state === 'focus') {
      for (let i = 0; i < n; i++) {
        sig[i] += frontal
          ? 18 * sin(22, i) + 6 * sin(18, i, 0.8) + 3 * sin(25, i, 1.5) - 4 * sin(10, i) + 2 * sin(38, i)
          : 3 * sin(20, i);
      }
    } else if (state === 'stress' || state === 'panic_spike') {
      const k = state === 'panic_spike' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        sig[i] += k * 12 * sin(25, i) + k * 8 * sin(28, i, 0.4) + this.normal() * 8 * k + k * 6 * sin(5, i);
      }
      if (frontal) {
        for (let i = 0; i < n; i++) {
          if (this.uniform() < 0.012 * k) sig[i] += 100 * k;   // blink
          sig[i] += this.normal() * 5 * k;
        }
      }
    } else if (state === 'flow') {
      for (let i = 0; i < n; i++) {
        sig[i] += frontal ? 14 * sin(20, i) + 8 * sin(10, i) + 4 * sin(38, i) : 18 * sin(10.2, i) + 6 * sin(20, i);
        sig[i] -= noise[i] * 0.5;
      }
    }
    // inter-electrode variability
    const gain = ch === 'Fp1' ? (state === 'focus' || state === 'flow' ? 1.15 : 1.05)
      : ch === 'Fp2' ? (state === 'stress' || state === 'panic_spike' ? 1.12 : 0.97)
      : ch === 'O2' ? 0.95 : 1;
    if (gain !== 1) for (let i = 0; i < n; i++) sig[i] *= gain;
    return sig;
  }
}
