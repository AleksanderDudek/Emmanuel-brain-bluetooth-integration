import { describe, expect, it } from 'vitest';
import { FNIRS_SCENARIOS, FNIRS_STATES, FNIRSSimulator } from '../src/core/simulator';

const rawOf = (sim: FNIRSSimulator, n: number) =>
  sim.generate(n).map(f => [f.ir_l, f.red_l, f.amb_l, f.ir_p, f.acc_x, f.ang_z]);

describe('FNIRSSimulator', () => {
  it('timestamps increase within and across batches (ported)', () => {
    let wall = 1_700_000_000_000;
    const sim = new FNIRSSimulator({ seed: 5, wallClock: () => wall });
    const first = sim.generate(50).map(f => f.timestamp);
    expect(first.every((t, i) => i === 0 || t > first[i - 1])).toBe(true);
    expect(first[49]).toBeCloseTo(wall / 1000, 9); // the batch ends "now"
    wall += 2000;
    const second = sim.generate(3).map(f => f.timestamp);
    expect(second[0]).toBeGreaterThan(first[49]);
    expect(new FNIRSSimulator({ seed: 5 }).generate(1)[0].timestamp).toBeCloseTo(Date.now() / 1000, 0);
  });

  it('is reproducible for a seed and differs between seeds', () => {
    const a = rawOf(new FNIRSSimulator({ seed: 42 }), 100);
    expect(rawOf(new FNIRSSimulator({ seed: 42 }), 100)).toEqual(a);
    expect(rawOf(new FNIRSSimulator({ seed: 43 }), 100)).not.toEqual(a);
  });

  it('produces plausible raw counts and a resting IMU', () => {
    const frames = new FNIRSSimulator({ seed: 1 }).generate(200);
    for (const f of frames) {
      expect(f.ir_l).toBeGreaterThan(40_000);
      expect(f.red_l).toBeGreaterThan(25_000);
      expect(f.amb_l).toBeGreaterThan(800);
      expect(f.amb_l).toBeLessThan(1000);
      expect(Number.isInteger(f.ir_p) && Number.isInteger(f.acc_z)).toBe(true);
      expect(Math.abs(f.accel_g[2] - 1)).toBeLessThan(0.05);
    }
  });

  it('rejects unknown states and scenarios', () => {
    const sim = new FNIRSSimulator({ seed: 0 });
    expect(() => sim.setState('sleep')).toThrow("Unknown state 'sleep'");
    expect(() => sim.setState('auto:nope')).toThrow("Unknown scenario 'nope'");
    expect(() => sim.setState('toString')).toThrow('Unknown state');
    expect(sim.state).toBe('rest');
  });

  it('auto scenarios step through their blocks and loop', () => {
    const fs = 10;
    const sim = new FNIRSSimulator({ fs, seed: 0 });
    sim.setState('auto:balance');
    expect(sim.autoMode).toBe(true);
    expect(sim.autoProgress).toEqual({ scenario: 'balance', elapsed_sec: 0, total_sec: 140, state: 'rest' });
    const seen: string[] = [];
    for (let s = 0; s < 150; s++) {
      sim.generate(fs);
      if (seen.at(-1) !== sim.state) seen.push(sim.state);
    }
    expect(seen).toEqual(['rest', 'lateral_left', 'rest', 'lateral_right', 'rest']);
    expect(sim.autoProgress!.elapsed_sec).toBeCloseTo(10, 5);
    sim.setState('auto_stop');
    expect(sim.autoMode).toBe(false);
    expect(sim.autoProgress).toBeNull();
    expect(sim.state).toBe('rest');
    expect(FNIRS_SCENARIOS.block_design).toHaveLength(9);
  });

  it('wall-clock pacing: none on the first call, then fs per second, capped at 2 s', () => {
    let now = 0;
    const sim = new FNIRSSimulator({ fs: 30.6, seed: 0, clock: () => now });
    expect(sim.generateFrames()).toEqual([]);
    now += 1000;
    expect(sim.generateFrames()).toHaveLength(30); // 30.6 → 30, carry 0.6
    now += 1000;
    expect(sim.generateFrames()).toHaveLength(31); // 30.6 + 0.6
    now += 10_000;
    expect(sim.generateFrames()).toHaveLength(61); // capped at int(2 · fs)
    sim.resync();
    now += 5000;
    expect(sim.generateFrames()).toEqual([]);
  });

  it('ground truth follows the target state with a slow response', () => {
    const fs = 25;
    const sim = new FNIRSSimulator({ fs, seed: 0 });
    sim.setState('task');
    sim.generate(5 * fs); // one time constant
    const early = sim.truth.hbo.l;
    sim.generate(40 * fs);
    const target = FNIRS_STATES.task.hbo * 0.9;
    expect(early).toBeGreaterThan(0.5 * target);
    expect(early).toBeLessThan(0.75 * target);
    expect(sim.truth.hbo.l).toBeCloseTo(target, 3);
    expect(sim.truth.hbr.r).toBeCloseTo(FNIRS_STATES.task.hbr * 1.1, 3);
  });

  it('lateral states shift oxygenation to one side', () => {
    const sim = new FNIRSSimulator({ fs: 25, seed: 0 });
    sim.setState('lateral_right');
    sim.generate(1000);
    const t = sim.truth;
    expect(t.hbo.r - t.hbo.l).toBeGreaterThan(0.6);
    sim.setState('lateral_left');
    sim.generate(1500);
    expect(sim.truth.hbo.l - sim.truth.hbo.r).toBeGreaterThan(0.4);
    // truth is a copy
    t.hbo.l = 99;
    expect(sim.truth.hbo.l).not.toBe(99);
  });
});
