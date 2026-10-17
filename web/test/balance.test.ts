import { describe, expect, it } from 'vitest';
import { BalanceTracker, DEFAULT_BALANCE_CONFIG, validateBalanceConfig } from '../src/core/balance';
import { FNIRSPipeline } from '../src/core/pipeline';
import { FNIRSSimulator } from '../src/core/simulator';
import type { BalanceConfig, BalanceState } from '../src/core/types';
import balanceJson from './fixtures/balance.json?raw';

// Fixtures: scripts/make_fixtures.py drives the Python BalanceTracker
type Op =
  | { op: 'update'; a: number | null | 'nan'; t: number; hold: string | null; state: BalanceState }
  | { op: 'set_config'; overrides: Partial<BalanceConfig>; state: BalanceState }
  | { op: 'reset_stats'; state: BalanceState };
const fixture = JSON.parse(balanceJson) as { initial_config: Partial<BalanceConfig>; ops: Op[] };

/** Deep equality with numbers compared to 1e-9. */
function expectDeepClose(actual: unknown, expected: unknown, path: string): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs((actual as number) - expected), `${path}: ${String(actual)} vs ${expected}`).toBeLessThanOrEqual(1e-9);
  } else if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', path).toBe(true);
    const obj = actual as Record<string, unknown>;
    expect(Object.keys(obj).sort(), `${path} keys`).toEqual(Object.keys(expected).sort());
    for (const [k, e] of Object.entries(expected)) expectDeepClose(obj[k], e, `${path}.${k}`);
  } else {
    expect(actual, path).toBe(expected);
  }
}

const FAST: Partial<BalanceConfig> = { smoothing_sec: 0.0, dwell_sec: 1.0, warmup_sec: 1.0 };

/** Feed asymmetry values at 10 Hz; returns the last state and the next time. */
function feed(tr: BalanceTracker, values: number[], t0 = 0.0, hold: string | null = null): [BalanceState, number] {
  let t = t0;
  let st = tr.state();
  for (const v of values) {
    st = tr.update(v, t, hold);
    t += 0.1;
  }
  return [st, t];
}

const times = (v: number, n: number): number[] => Array<number>(n).fill(v);

describe('BalanceTracker parity with Python', () => {
  it('replays the fixture sequence state by state', () => {
    const tr = new BalanceTracker(fixture.initial_config);
    fixture.ops.forEach((op, i) => {
      let st: BalanceState;
      if (op.op === 'update') st = tr.update(op.a === 'nan' ? Number.NaN : op.a, op.t, op.hold);
      else if (op.op === 'set_config') {
        tr.setConfig(op.overrides);
        st = tr.state();
      } else {
        tr.resetStats();
        st = tr.state();
      }
      expectDeepClose(st, op.state, `op ${i} (${op.op})`);
    });
  });

  it('the fixture covers every zone, recommendation and pause reason', () => {
    const states = fixture.ops.map(o => o.state);
    for (const z of ['left_dominant', 'balanced', 'right_dominant']) expect(states.some(s => s.zone === z)).toBe(true);
    for (const r of ['train_left', 'train_right', 'focus']) expect(states.some(s => s.recommendation === r)).toBe(true);
    for (const p of ['waiting', 'warming_up', 'motion', 'poor_signal', null]) expect(states.some(s => s.paused === p)).toBe(true);
    expect(states.some(s => s.pending !== null)).toBe(true);
  });
});

describe('BalanceTracker behaviour (ported from tests/test_fnirs_balance.py)', () => {
  it('validates config like Python', () => {
    const bad: [Partial<BalanceConfig>, string][] = [
      [{ low: 0.6, high: 0.5 }, 'need 0 < low < high < 1'],
      [{ low: 0.0 }, 'need 0 < low < high < 1'],
      [{ high: 1.0 }, 'need 0 < low < high < 1'],
      [{ low: Number.NaN }, 'low must be a finite number'],
      [{ hysteresis: 0.5 }, 'hysteresis must be within 0..0.1'],
      [{ dwell_sec: -1 }, 'dwell_sec must be within 0..600 s'],
      [{ smoothing_sec: true as unknown as number }, 'smoothing_sec must be a finite number'],
    ];
    for (const [overrides, msg] of bad) {
      const tr = new BalanceTracker();
      expect(() => tr.setConfig(overrides)).toThrow(msg);
      expect(tr.config).toEqual(DEFAULT_BALANCE_CONFIG);
    }
    expect(() => new BalanceTracker().setConfig({ bogus: 1 } as Partial<BalanceConfig>)).toThrow(TypeError);
    expect(new BalanceTracker().setConfig({ low: 0.45, high: 0.55 }).low).toBe(0.45);
    expect(() => validateBalanceConfig(DEFAULT_BALANCE_CONFIG)).not.toThrow();
    expect(() => new BalanceTracker({ warmup_sec: 601 })).toThrow('warmup_sec must be within 0..600 s');
  });

  it('waits for data, then warms up', () => {
    const tr = new BalanceTracker({ warmup_sec: 2.0 });
    expect(tr.update(null, 0.0).paused).toBe('waiting');
    let [st, t] = feed(tr, times(0.5, 10)); // 1 s of data
    expect(st.paused).toBe('warming_up');
    expect(st.warmup_left_sec!).toBeGreaterThanOrEqual(0.9);
    expect(st.warmup_left_sec!).toBeLessThanOrEqual(1.2);
    [st] = feed(tr, times(0.5, 15), t);
    expect(st.paused).toBeNull();
    expect(st.zone).toBe('balanced');
  });

  it('a recommendation needs the dwell time', () => {
    const tr = new BalanceTracker(FAST);
    let [st, t] = feed(tr, times(0.6, 15)); // warmup 1 s, then 0.5 s right-dominant
    expect(st.zone).toBe('right_dominant');
    expect(st.recommendation).toBeNull();
    expect(st.pending!.recommendation).toBe('train_left');
    expect(st.pending!.in_sec).toBeGreaterThan(0);
    [st, t] = feed(tr, times(0.6, 10), t);
    expect(st.recommendation).toBe('train_left');
    expect(st.pending).toBeNull();
    [st, t] = feed(tr, times(0.4, 12), t);
    expect(st.recommendation).toBe('train_right');
    [st] = feed(tr, times(0.5, 12), t);
    expect(st.recommendation).toBe('focus');
  });

  it('hysteresis: leave the band past the margin, re-enter at the band edge', () => {
    const tr = new BalanceTracker(FAST); // band 0.47..0.53, margin 0.01
    let [st, t] = feed(tr, times(0.5, 12));
    expect(st.zone).toBe('balanced');
    [st, t] = feed(tr, [0.465], t); // inside the margin: stays balanced
    expect(st.zone).toBe('balanced');
    [st, t] = feed(tr, [0.455], t);
    expect(st.zone).toBe('left_dominant');
    [st] = feed(tr, [0.465], t); // must reach 0.47 to re-enter
    expect(st.zone).toBe('left_dominant');
  });

  it('smoothing ignores a single spike', () => {
    const tr = new BalanceTracker({ smoothing_sec: 4.0, dwell_sec: 1.0, warmup_sec: 0.5 });
    const [, t] = feed(tr, times(0.5, 20));
    const [st] = feed(tr, [0.95], t);
    expect(st.zone).toBe('balanced');
    expect(st.raw).toBe(0.95);
    expect(st.asymmetry!).toBeLessThan(0.52);
  });

  it('a hold freezes feedback and restarts the dwell', () => {
    const tr = new BalanceTracker(FAST);
    let [st, t] = feed(tr, times(0.6, 25));
    expect(st.recommendation).toBe('train_left');
    [st, t] = feed(tr, times(0.4, 20), t, 'motion');
    expect(st.paused).toBe('motion');
    expect(st.recommendation).toBe('train_left');
    [st, t] = feed(tr, times(0.4, 5), t); // dwell starts only after the hold
    expect(st.recommendation).toBe('train_left');
    expect(st.pending!.recommendation).toBe('train_right');
    [st] = feed(tr, times(0.4, 8), t);
    expect(st.recommendation).toBe('train_right');
  });

  it('session stats and streaks', () => {
    const tr = new BalanceTracker(FAST);
    let [st, t] = feed(tr, times(0.5, 31)); // 1 s warmup + 2 s balanced
    [st, t] = feed(tr, times(0.6, 10), t); // 1 s right-dominant
    [st] = feed(tr, times(0.5, 6), t);
    const s = st.stats;
    expect(Math.abs(s.balanced_sec - 2.5)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(s.right_dominant_sec - 1.0)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(s.best_streak_sec - 2.0)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(st.streak_sec - 0.5)).toBeLessThanOrEqual(0.15);
    expect(s.balanced_pct!).toBeGreaterThan(60);
    expect(s.balanced_pct!).toBeLessThan(80);
    tr.resetStats();
    expect(tr.state().stats.session_sec).toBe(0);
    expect(tr.state().stats.balanced_pct).toBeNull();
  });

  it('a gap longer than 2 s restarts the warmup', () => {
    const tr = new BalanceTracker(FAST);
    const [st, t] = feed(tr, times(0.6, 25));
    expect(st.recommendation).toBe('train_left');
    const [after] = feed(tr, [0.6], t + 5.0); // 5 s without data
    expect(after.paused).toBe('warming_up');
    expect(after.recommendation).toBeNull();
  });

  it('a hold breaks the streak', () => {
    const tr = new BalanceTracker(FAST);
    let [st, t] = feed(tr, times(0.5, 40));
    expect(st.streak_sec).toBeGreaterThan(2);
    [st, t] = feed(tr, times(0.5, 5), t, 'motion');
    expect(st.streak_sec).toBe(0);
    [st] = feed(tr, times(0.5, 6), t);
    expect(Math.abs(st.streak_sec - 0.5)).toBeLessThanOrEqual(0.15);
  });

  it('simulated lateralisation drives the recommendation', () => {
    const sim = new FNIRSSimulator({ seed: 7 });
    const pipe = new FNIRSPipeline();
    const tracker = new BalanceTracker();
    let t = 0.0;
    const run = (seconds: number): BalanceState => {
      let st = tracker.state();
      for (let i = 0; i < seconds * 10; i++) { // 10 Hz ticks, like the server loop
        pipe.push(sim.generate(3));
        t += 3 / sim.fs;
        st = tracker.update(pipe.metrics().asymmetry, t);
      }
      return st;
    };
    run(40); // baseline + warmup at rest
    sim.setState('lateral_right');
    let st = run(40);
    expect(st.zone).toBe('right_dominant');
    expect(st.recommendation).toBe('train_left');
    sim.setState('lateral_left');
    st = run(60);
    expect(st.zone).toBe('left_dominant');
    expect(st.recommendation).toBe('train_right');
  });
});
