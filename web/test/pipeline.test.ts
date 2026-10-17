import { describe, expect, it } from 'vitest';
import { mean } from '../src/core/dsp';
import {
  DEFAULT_FNIRS_CONFIG, EXTINCTION, FNIRSPipeline, MENDI_SAMPLE_RATE, mbllMatrixInv, validateConfig,
} from '../src/core/pipeline';
import { Frame, type FrameData } from '../src/core/proto';
import { FNIRSSimulator } from '../src/core/simulator';
import type { Derived, FNIRSConfig } from '../src/core/types';
import { OPTICAL_CHANNELS } from '../src/core/types';
import pipelineJson from './fixtures/pipeline.json?raw';

// Fixtures: scripts/make_fixtures.py replays Python FNIRSSimulator frames through Python FNIRSPipeline
interface Checkpoint {
  after_push: number;
  heart_rate: number | null;
  scalp_coupling: Record<string, number | null>;
  signal_quality: unknown;
  motion: boolean;
  metrics: unknown;
  baseline_progress: number;
  baseline_ready: boolean;
  total_frames: number;
  snapshot: Record<string, unknown>;
}
interface Run {
  name: string;
  fs: number;
  config: Partial<FNIRSConfig>;
  frame_keys: (keyof FrameData)[];
  frames: number[][];
  pushes: { n: number; derived: Record<keyof Derived, (number | null)[]> }[];
  checkpoints: Checkpoint[];
}
const fixture = JSON.parse(pipelineJson) as { runs: Run[] };

const DERIVED_TOL = 1e-6;

/** Decimal places Python rounds each field to (nearest enclosing key wins). */
const DECIMALS: Record<string, number> = {
  sci: 3, scalp_coupling: 3, ambient_ratio: 3, dc: 1, activation: 3, asymmetry: 3, baseline_progress: 3,
  hbo: 4, hbr: 4, heart_rate: 1, heart_rate_bpm: 1, pulse_ir: 1, accel_g: 3, gyro_dps: 2, temp_c: 2,
};

/**
 * Deep comparison against a Python value: same keys, same labels/booleans,
 * numbers within 1e-6, or for rounded fields within ±1 in the last digit.
 */
function expectParity(actual: unknown, expected: unknown, path: string, decimals?: number): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    const tol = decimals === undefined ? 1e-6 : Math.max(1e-6, 10 ** -decimals * (1 + 1e-9));
    expect(Math.abs((actual as number) - expected), `${path}: ${String(actual)} vs ${expected}`).toBeLessThanOrEqual(tol);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    const arr = actual as unknown[];
    expect(arr.length, `${path}.length`).toBe(expected.length);
    expected.forEach((e, i) => expectParity(arr[i], e, `${path}[${i}]`, decimals));
  } else if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', path).toBe(true);
    const obj = actual as Record<string, unknown>;
    expect(Object.keys(obj).sort(), `${path} keys`).toEqual(Object.keys(expected).sort());
    for (const [k, e] of Object.entries(expected)) expectParity(obj[k], e, `${path}.${k}`, DECIMALS[k] ?? decimals);
  } else {
    expect(actual, path).toBe(expected); // null, string, boolean
  }
}

function toFrame(keys: (keyof FrameData)[], row: number[]): Frame {
  const init: Partial<FrameData> = {};
  keys.forEach((k, i) => {
    init[k] = row[i];
  });
  return new Frame(init);
}

/** Every value is a finite number, string, boolean or null (JSON.stringify would hide NaN as null). */
function expectJsonSafe(value: unknown, path = '$'): void {
  if (typeof value === 'number') expect(Number.isFinite(value), path).toBe(true);
  else if (Array.isArray(value)) value.forEach((v, i) => expectJsonSafe(v, `${path}[${i}]`));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) expectJsonSafe(v, `${path}.${k}`);
  }
}

const tailMean = (a: Float64Array, n: number): number => mean(a.subarray(a.length - n));
const lift = (f: Frame): Frame => new Frame({ ...f, ir_l: f.amb_l, red_l: f.amb_l });

describe('FNIRSPipeline parity with Python', () => {
  for (const run of fixture.runs) {
    it(`${run.name}: derived arrays every push and metrics at checkpoints`, () => {
      const frames = run.frames.map(r => toFrame(run.frame_keys, r));
      const pipe = new FNIRSPipeline(run.config, run.fs, () => 0);
      const checkpoints = new Map(run.checkpoints.map(c => [c.after_push, c]));
      let offset = 0;
      run.pushes.forEach((p, k) => {
        const out = pipe.push(frames.slice(offset, offset + p.n));
        offset += p.n;
        for (const key of ['hbo_left', 'hbr_left', 'hbo_right', 'hbr_right'] as const) {
          const exp = p.derived[key];
          expect(out[key].length).toBe(exp.length);
          exp.forEach((e, i) => {
            const v = out[key][i];
            if (e === null) expect(v, `push ${k} ${key}[${i}]`).toBeNaN();
            else expect(Math.abs(v - e), `push ${k} ${key}[${i}]: ${v} vs ${e}`).toBeLessThanOrEqual(DERIVED_TOL);
          });
        }
        const c = checkpoints.get(k);
        if (!c) return;
        const at = `push ${k}`;
        expectParity(pipe.heartRate(), c.heart_rate, `${at} heart_rate`, 1);
        for (const ch of OPTICAL_CHANNELS) {
          expectParity(pipe.scalpCoupling(ch), c.scalp_coupling[ch], `${at} sci.${ch}`, 3);
        }
        expectParity(pipe.signalQuality(), c.signal_quality, `${at} signal_quality`);
        expect(pipe.motion(), `${at} motion`).toBe(c.motion);
        expectParity(pipe.metrics(), c.metrics, `${at} metrics`);
        expectParity(pipe.baselineProgress, c.baseline_progress, `${at} baseline_progress`, 3);
        expect(pipe.baselineReady, `${at} baseline_ready`).toBe(c.baseline_ready);
        expect(pipe.totalFrames).toBe(c.total_frames);
        const { ts, measured_rate: measuredRate, ...snap } = pipe.snapshot();
        expect(ts).toBeGreaterThan(0);
        expect(measuredRate).toBeNull();
        expectParity(snap, c.snapshot, `${at} snapshot`);
      });
      expect(offset).toBe(frames.length);
    });
  }
});

describe('FNIRSPipeline behaviour (ported from tests/test_mendi.py)', () => {
  it('MBLL inverse recovers concentrations', () => {
    const minv = mbllMatrixInv(DEFAULT_FNIRS_CONFIG);
    // Forward model: ΔOD = M·Δc with M = ε·d·DPF per wavelength
    const [eR, eI] = [EXTINCTION[660], EXTINCTION[850]];
    const L = 3.0 * 6.0;
    const hb = [0.8e-6, -0.3e-6]; // M
    const od = [(eR[0] * hb[0] + eR[1] * hb[1]) * L, (eI[0] * hb[0] + eI[1] * hb[1]) * L];
    expect(minv[0][0] * od[0] + minv[0][1] * od[1]).toBeCloseTo(0.8, 10);
    expect(minv[1][0] * od[0] + minv[1][1] * od[1]).toBeCloseTo(-0.3, 10);
  });

  it('simulated task increases HbO and decreases HbR, tracking the ground truth', () => {
    const fs = 25.0;
    const sim = new FNIRSSimulator({ fs, seed: 0 });
    const pipe = new FNIRSPipeline({}, fs);
    sim.setState('rest');
    const rest = pipe.push(sim.generate(40 * fs)); // baseline + settle
    expect(pipe.baselineReady).toBe(true);
    const restHbo = tailMean(rest.hbo_left, 10 * fs);
    const restHbr = tailMean(rest.hbr_left, 10 * fs);
    sim.setState('high_load');
    const task = pipe.push(sim.generate(20 * fs));
    const dHbo = tailMean(task.hbo_left, 8 * fs) - restHbo;
    const dHbr = tailMean(task.hbr_left, 8 * fs) - restHbr;
    const truth = sim.truth;
    expect(dHbo).toBeGreaterThan(0);
    expect(dHbr).toBeLessThan(0);
    expect(Math.abs(dHbo - truth.hbo.l)).toBeLessThanOrEqual(0.25 * Math.abs(truth.hbo.l));
    expect(Math.abs(dHbr - truth.hbr.l)).toBeLessThanOrEqual(0.35 * Math.abs(truth.hbr.l));
  });

  it('heart rate and signal quality', () => {
    const fs = 25.0;
    const sim = new FNIRSSimulator({ fs, seed: 2 });
    const pipe = new FNIRSPipeline({}, fs);
    pipe.push(sim.generate(30 * fs));
    const hr = pipe.heartRate();
    expect(hr).not.toBeNull();
    expect(hr!).toBeGreaterThan(55);
    expect(hr!).toBeLessThan(85);
    expect(['good', 'fair']).toContain(pipe.signalQuality().left.label);
    expect(pipe.motion()).toBe(false);
  });

  it('detects motion and poor contact', () => {
    const fs = 25.0;
    const sim = new FNIRSSimulator({ fs, seed: 3 });
    const pipe = new FNIRSPipeline({}, fs);
    sim.setState('motion');
    pipe.push(sim.generate(5 * fs));
    expect(pipe.motion()).toBe(true);
    sim.setState('poor_contact');
    pipe.push(sim.generate(20 * fs));
    expect(pipe.signalQuality().left.ambient_ratio!).toBeGreaterThan(0.3);
  });

  it('snapshot is JSON safe (no NaN/Infinity) before and after the baseline', () => {
    const pipe = new FNIRSPipeline();
    const sim = new FNIRSSimulator({ seed: 4 });
    for (const n of [10, 400]) {
      pipe.push(sim.generate(n));
      const snap = pipe.snapshot();
      expectJsonSafe(snap);
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    }
    expect(pipe.snapshot().baseline_ready).toBe(true);
  });

  it('validates config changes with the Python messages', () => {
    const pipe = new FNIRSPipeline();
    expect(() => pipe.setConfig({ red_nm: 123 }))
      .toThrow('No extinction data for 123 nm. Known: [660, 690, 730, 760, 780, 810, 830, 850, 880, 905, 940]');
    expect(() => pipe.setConfig({ hp_hz: 1.0 })).toThrow('need 0 <= hp_hz < lp_hz and hp_hz < 14.535 Hz (Nyquist)');
    expect(() => pipe.setConfig({ red_nm: 850 })).toThrow('red_nm and ir_nm must differ');
    expect(() => pipe.setConfig({ dpf_ir: -1 })).toThrow('separation_cm and DPF must be positive');
    const cfg = pipe.setConfig({ ir_nm: 940, separation_cm: 2.5, hp_hz: 0.005 });
    expect(cfg.ir_nm).toBe(940);
    expect(pipe.config.ir_nm).toBe(940);
    expect(pipe.baselineReady).toBe(false);
    expect(() => validateConfig(DEFAULT_FNIRS_CONFIG, 25)).not.toThrow();
    expect(() => validateConfig({ ...DEFAULT_FNIRS_CONFIG, hp_hz: 15, lp_hz: 20 }, 25)).toThrow('11.875 Hz');
  });

  it('rejects unknown keys and non-finite values', () => {
    const pipe = new FNIRSPipeline();
    expect(() => pipe.setConfig({ bogus: 1 } as Partial<FNIRSConfig>)).toThrow(TypeError);
    expect(() => pipe.setConfig({ lp_hz: Number.POSITIVE_INFINITY })).toThrow('lp_hz must be a finite number');
    expect(() => pipe.setConfig({ hp_hz: undefined })).toThrow('hp_hz must be a finite number');
    expect(() => new FNIRSPipeline({ bogus: 1 } as Partial<FNIRSConfig>)).toThrow(TypeError);
    expect(pipe.config).toEqual(DEFAULT_FNIRS_CONFIG);
  });

  it('metrics survive a lifted optode (huge ΔHb with a flat window)', () => {
    const sim = new FNIRSSimulator({ seed: 1 });
    const pipe = new FNIRSPipeline();
    pipe.push(sim.generate(400));
    for (let i = 0; i < 20; i++) pipe.push(sim.generate(100).map(lift));
    const m = pipe.metrics();
    for (const v of [m.asymmetry, m.activation]) {
      expect(v).not.toBeNull();
      expect(v!).toBeGreaterThanOrEqual(0);
      expect(v!).toBeLessThanOrEqual(1);
    }
    expectJsonSafe(pipe.snapshot());
  });

  it('setConfig rejects unbuildable configs and keeps the old one', () => {
    const pipe = new FNIRSPipeline();
    const bad: Partial<FNIRSConfig>[] = [
      { hp_hz: 15, lp_hz: 20 }, // above Nyquist
      { separation_cm: Number.NaN },
      { activation_window_sec: -1 },
      { baseline_sec: 0 },
    ];
    for (const overrides of bad) {
      expect(() => pipe.setConfig(overrides)).toThrow();
      expect(pipe.config).toEqual(DEFAULT_FNIRS_CONFIG);
    }
    pipe.reset(); // still usable
    pipe.push(new FNIRSSimulator({ seed: 0 }).generate(10));
    expect(pipe.totalFrames).toBe(10);
  });

  it('adapts to the measured rate', () => {
    const pipe = new FNIRSPipeline({}, 25.0);
    pipe.measuredRate = 26.0;
    expect(pipe.adaptRate()).toBe(false); // within 10 %
    pipe.measuredRate = 30.63;
    expect(pipe.adaptRate()).toBe(true);
    expect(pipe.fs).toBe(30.6);
    expect(pipe.baselineReady).toBe(false);
    expect(pipe.measuredRate).toBeNull();
  });

  it('measures the incoming frame rate with the injected clock', () => {
    let now = 1000;
    const pipe = new FNIRSPipeline({}, 25.0, () => now);
    const sim = new FNIRSSimulator({ fs: 30.6, seed: 9 });
    for (let i = 0; i < 70; i++) {
      pipe.push(sim.generate(3));
      now += 3000 / 30.6; // 3 frames per 98 ms
    }
    expect(pipe.measuredRate).toBeCloseTo(30.6, 1);
    expect(pipe.adaptRate()).toBe(true);
    expect(pipe.fs).toBe(30.6);
  });

  it('an empty push returns empty arrays and changes nothing', () => {
    const pipe = new FNIRSPipeline();
    const out = pipe.push([]);
    expect(out.hbo_left.length).toBe(0);
    expect(pipe.totalFrames).toBe(0);
    expect(pipe.lastFrame).toBeNull();
    expect(pipe.snapshot().raw).toBeNull();
    expect(pipe.metrics()).toEqual({ activation: null, asymmetry: null });
  });

  it('derived values are NaN until the baseline is complete', () => {
    const pipe = new FNIRSPipeline({ baseline_sec: 1.0 });
    const sim = new FNIRSSimulator({ seed: 6 });
    const target = Math.trunc(1.0 * MENDI_SAMPLE_RATE);
    const out = pipe.push(sim.generate(target + 5));
    expect(Array.from(out.hbo_left.subarray(0, target)).every(Number.isNaN)).toBe(true);
    expect(Array.from(out.hbo_left.subarray(target)).every(Number.isFinite)).toBe(true);
    expect(pipe.baselineProgress).toBe(1);
  });
});
