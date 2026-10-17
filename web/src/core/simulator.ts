/**
 * Mendi fNIRS simulator: TypeScript port of brainlink/fnirs_simulator.py.
 *
 * Produces raw {@link Frame}s that look like what the headband streams:
 * ambient-contaminated IR/red intensities whose optical density follows a
 * synthetic haemodynamic model, plus cardiac pulse, respiration, Mayer waves,
 * noise and IMU readings.  The forward model is the inverse of the pipeline's
 * modified Beer–Lambert law, so the ΔHbO/ΔHbR that {@link FNIRSPipeline}
 * recovers should track {@link FNIRSSimulator.truth}.
 *
 * The noise comes from a seeded PRNG (mulberry32 + Box–Muller), so runs are
 * reproducible but not bit-identical to NumPy's generator.
 */

import { pyRound } from './dsp';
import { Frame } from './proto';
import { DEFAULT_FNIRS_CONFIG, EXTINCTION, MENDI_SAMPLE_RATE, validateConfig } from './pipeline';
import type { FNIRSConfig } from './types';

export interface FNIRSStateSpec {
  /** Target ΔHbO / ΔHbR (µM). */
  hbo: number;
  hbr: number;
  /** Heart rate (bpm). */
  hr: number;
  /** Motion artefact amplitude (0 = still). */
  motion: number;
  /** Optode contact (1 = perfect; low values add ambient leak). */
  contact: number;
  /** Shifts oxygenation toward the right (+) or left (−) side (µM), for the balance trainer. */
  lat?: number;
}

export const FNIRS_STATES: Record<string, FNIRSStateSpec> = {
  rest: { hbo: 0.0, hbr: 0.0, hr: 68, motion: 0.0, contact: 1.0 },
  task: { hbo: 0.6, hbr: -0.2, hr: 78, motion: 0.0, contact: 1.0 },
  high_load: { hbo: 1.1, hbr: -0.35, hr: 88, motion: 0.0, contact: 1.0 },
  relax: { hbo: -0.3, hbr: 0.1, hr: 62, motion: 0.0, contact: 1.0 },
  motion: { hbo: 0.0, hbr: 0.0, hr: 75, motion: 1.0, contact: 1.0 },
  poor_contact: { hbo: 0.0, hbr: 0.0, hr: 70, motion: 0.0, contact: 0.15 },
  lateral_left: { hbo: 0.4, hbr: -0.1, hr: 74, motion: 0.0, contact: 1.0, lat: -0.6 },
  lateral_right: { hbo: 0.4, hbr: -0.1, hr: 74, motion: 0.0, contact: 1.0, lat: 0.6 },
};

const repeat = <T>(xs: T[], times: number): T[] => Array.from({ length: times }, () => xs).flat();

/** Block designs: [state, seconds] segments, looped. */
export const FNIRS_SCENARIOS: Record<string, [string, number][]> = {
  block_design: [...repeat<[string, number]>([['rest', 20], ['task', 20]], 4), ['rest', 20]],
  n_back: [['rest', 30], ['task', 30], ['rest', 30], ['high_load', 30], ['rest', 30]],
  meditation: [['rest', 30], ['relax', 90], ['rest', 30]],
  balance: [['rest', 30], ['lateral_left', 40], ['rest', 30], ['lateral_right', 40]],
};

type Side = 'l' | 'r' | 'p';

/** Seeded standard-normal generator: mulberry32 uniforms + Box–Muller. */
function normalGenerator(seed: number): () => number {
  let a = seed >>> 0;
  const uniform = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    const r = Math.sqrt(-2 * Math.log(1 - uniform())); // 1 − u ∈ (0, 1], so log is finite
    const theta = 2 * Math.PI * uniform();
    spare = r * Math.sin(theta);
    return r * Math.cos(theta);
  };
}

export interface FNIRSSimulatorOptions {
  fs?: number;
  config?: Partial<FNIRSConfig>;
  seed?: number;
  /** Monotonic milliseconds for pacing `generateFrames` (default `performance.now`). */
  clock?: () => number;
  /** Wall-clock milliseconds for frame timestamps (default `Date.now`). */
  wallClock?: () => number;
}

/** Generate Mendi-like frames in real time (`generateFrames`) or in bulk (`generate`). */
export class FNIRSSimulator {
  fs: number;
  cfg: FNIRSConfig;
  state = 'rest';
  autoMode = false;
  /** Simulated time (s). */
  t = 0.0;

  private readonly normal: () => number;
  private readonly clock: () => number;
  private readonly wallClock: () => number;
  private scenario: [string, number][] = [];
  private scenarioName: string | null = null;
  private scenarioT0 = 0.0;
  private wallLast: number | null = null;
  private frac = 0.0;
  // Smoothed (haemodynamically lagged) values per side
  private readonly hbo = { l: 0.0, r: 0.0 };
  private readonly hbr = { l: 0.0, r: 0.0 };
  private contact = 1.0;
  private hr = 68.0;
  private cardiacPhase = 0.0;
  private readonly baseIr: Record<Side, number> = { l: 52_000.0, r: 49_000.0, p: 61_000.0 };
  private readonly baseRed: Record<Side, number> = { l: 31_000.0, r: 29_500.0, p: 38_000.0 };
  private readonly baseAmb: Record<Side, number> = { l: 900.0, r: 950.0, p: 700.0 };

  constructor(opts: FNIRSSimulatorOptions = {}) {
    this.fs = opts.fs ?? MENDI_SAMPLE_RATE;
    this.cfg = { ...DEFAULT_FNIRS_CONFIG, ...opts.config };
    validateConfig(this.cfg, this.fs);
    this.normal = normalGenerator(opts.seed ?? Math.floor(Math.random() * 2 ** 32));
    this.clock = opts.clock ?? (() => performance.now());
    this.wallClock = opts.wallClock ?? (() => Date.now());
  }

  // ── Control ────────────────────────────────────────────────────

  /** A state from {@link FNIRS_STATES}, `"auto:<scenario>"` to loop a scenario, or `"auto_stop"`. */
  setState(state: string): void {
    if (state.startsWith('auto:')) {
      const name = state.slice(5);
      if (!Object.hasOwn(FNIRS_SCENARIOS, name)) throw new Error(`Unknown scenario '${name}'`);
      this.scenario = FNIRS_SCENARIOS[name];
      this.scenarioName = name;
      this.scenarioT0 = this.t;
      this.autoMode = true;
      this.state = this.scenario[0][0];
      return;
    }
    if (state === 'auto_stop') {
      this.autoMode = false;
      this.scenarioName = null;
      this.state = 'rest';
      return;
    }
    if (!Object.hasOwn(FNIRS_STATES, state)) throw new Error(`Unknown state '${state}'`);
    this.autoMode = false;
    this.scenarioName = null;
    this.state = state;
  }

  get autoProgress(): { scenario: string; elapsed_sec: number; total_sec: number; state: string } | null {
    if (!this.autoMode || this.scenarioName === null) return null;
    const total = this.scenarioTotal();
    const elapsed = (this.t - this.scenarioT0) % total;
    return { scenario: this.scenarioName, elapsed_sec: pyRound(elapsed, 1), total_sec: total, state: this.state };
  }

  private scenarioTotal(): number {
    return this.scenario.reduce((s, [, d]) => s + d, 0);
  }

  private updateAuto(): void {
    const elapsed = (this.t - this.scenarioT0) % this.scenarioTotal();
    let acc = 0;
    for (const [st, d] of this.scenario) {
      acc += d;
      if (elapsed < acc) {
        this.state = st;
        return;
      }
    }
  }

  // ── Generation ─────────────────────────────────────────────────

  /** Restart wall-clock pacing (e.g. after the simulator was not polled for a while). */
  resync(): void {
    this.wallLast = null;
    this.frac = 0.0;
  }

  /** The frames that "arrived" since the last call (wall-clock paced; the first call returns none). */
  generateFrames(): Frame[] {
    const now = this.clock() / 1000;
    if (this.wallLast === null) {
      this.wallLast = now;
      return [];
    }
    const exact = (now - this.wallLast) * this.fs + this.frac;
    const n = Math.trunc(exact);
    this.frac = exact - n;
    this.wallLast = now;
    return this.generate(Math.min(n, Math.trunc(this.fs * 2)));
  }

  generate(n: number): Frame[] {
    const frames: Frame[] = [];
    if (!(n > 0)) return frames;
    const dt = 1.0 / this.fs;
    const eRed = EXTINCTION[this.cfg.red_nm];
    const eIr = EXTINCTION[this.cfg.ir_nm];
    const lRed = this.cfg.separation_cm * this.cfg.dpf_red;
    const lIr = this.cfg.separation_cm * this.cfg.dpf_ir;
    // ~5 s time constant approximates the slow haemodynamic response
    const alpha = 1.0 - Math.exp(-dt / 5.0);
    // Spread the batch over the frame period so timestamps stay increasing
    const wall0 = this.wallClock() / 1000 - (n - 1) * dt;
    const TWO_PI = 2 * Math.PI;

    for (let i = 0; i < n; i++) {
      if (this.autoMode) this.updateAuto();
      const tgt = FNIRS_STATES[this.state];
      const lat = tgt.lat ?? 0.0;
      // Slight lateralisation (gain) plus the state's explicit left/right shift
      for (const [side, gain, shift] of [['l', 0.9, -lat / 2], ['r', 1.1, lat / 2]] as const) {
        this.hbo[side] += alpha * (tgt.hbo * gain + shift - this.hbo[side]);
        this.hbr[side] += alpha * (tgt.hbr * gain - this.hbr[side]);
      }
      this.contact += 0.05 * (tgt.contact - this.contact);
      this.hr += 0.02 * (tgt.hr - this.hr);
      this.cardiacPhase += TWO_PI * (this.hr / 60.0) * dt;

      const t = this.t;
      // Physiological oscillations (µM): Mayer ~0.1 Hz, respiration ~0.25 Hz
      const mayer = 0.12 * Math.sin(TWO_PI * 0.1 * t);
      const resp = 0.05 * Math.sin(TWO_PI * 0.25 * t + 0.7);
      // Cardiac: sharp-ish systolic upstroke
      const c = Math.sin(this.cardiacPhase);
      const cardiac = 0.25 * (Math.max(c, 0.0) ** 3 - 0.3 * Math.max(-c, 0.0));
      const spike = tgt.motion * (this.normal() + 3.0 * Math.sin(TWO_PI * 0.7 * t));

      /** Raw [ir, red, amb] counts for one optode. */
      const optode = (side: Side): [number, number, number] => {
        const [hbo, hbr, card] = side === 'p'
          ? [0.5 * (this.hbo.l + this.hbo.r), 0.5 * (this.hbr.l + this.hbr.r), cardiac * 3.0]
          : [this.hbo[side], this.hbr[side], cardiac];
        const hboT = hbo + mayer + resp + card + spike * 0.4;
        const hbrT = hbr - 0.3 * mayer + 0.2 * card + spike * 0.1;
        // Forward modified Beer–Lambert law
        const odRed = (eRed[0] * hboT + eRed[1] * hbrT) * 1e-6 * lRed;
        const odIr = (eIr[0] * hboT + eIr[1] * hbrT) * 1e-6 * lIr;
        const amb = this.baseAmb[side] * (1.0 + 0.05 * Math.sin(TWO_PI * 0.03 * t));
        const leak = (1.0 - this.contact) * 20_000.0;
        const ir = this.baseIr[side] * this.contact * 10 ** -odIr;
        const red = this.baseRed[side] * this.contact * 10 ** -odRed;
        const noise = [this.gauss(8.0), this.gauss(8.0), this.gauss(8.0)];
        return [
          Math.trunc(ir + amb + leak + noise[0]),
          Math.trunc(red + amb + leak + noise[1]),
          Math.trunc(amb + leak + noise[2]),
        ];
      };
      const vals = { l: optode('l'), r: optode('r'), p: optode('p') }; // noise drawn in l, r, p order

      const g = 16384; // 1 g on a ±2 g int16 scale
      const acc = [
        Math.trunc(this.gauss(80) + spike * 1500),
        Math.trunc(this.gauss(80) + spike * 900),
        Math.trunc(g + this.gauss(80)),
      ];
      const gyro = [0, 1, 2].map(() => Math.trunc(this.gauss(40) + spike * 9000));
      frames.push(new Frame({
        acc_x: acc[0], acc_y: acc[1], acc_z: acc[2],
        ang_x: gyro[0], ang_y: gyro[1], ang_z: gyro[2],
        temp: 33.5 + 0.2 * Math.sin((TWO_PI * t) / 300.0),
        ir_l: vals.l[0], red_l: vals.l[1], amb_l: vals.l[2],
        ir_r: vals.r[0], red_r: vals.r[1], amb_r: vals.r[2],
        ir_p: vals.p[0], red_p: vals.p[1], amb_p: vals.p[2],
        timestamp: wall0 + i * dt,
      }));
      this.t += dt;
    }
    return frames;
  }

  /** Current underlying (noise-free, slow) ΔHbO/ΔHbR, handy for tests. */
  get truth(): { hbo: { l: number; r: number }; hbr: { l: number; r: number } } {
    return { hbo: { ...this.hbo }, hbr: { ...this.hbr } };
  }

  private gauss(sd: number): number {
    return sd * this.normal();
  }
}
