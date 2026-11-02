import { describe, expect, it } from 'vitest';
import { SignalCoach, STATE_TONE } from '../src/arcade/kit/coach';
import { NEUTRAL_FRAME, type FocusFrame } from '../src/arcade/kit/focus';
import type { SignalPhase } from '../src/arcade/kit/types';

const DT = 0.1;
const frame = (activity: number | null, threshold = 2, reliable = true): FocusFrame =>
  ({ ...NEUTRAL_FRAME, activity, threshold, reliable });
const FOCUS: SignalPhase = { want: 'focus', blind: false };
const REST: SignalPhase = { want: 'rest', blind: false };
const FREE: SignalPhase = { want: 'free', blind: false };

/** Feeds `sec` seconds of `act(t in block)` in one phase, from play time `t0`; returns the end time. */
function run(c: SignalCoach, t0: number, sec: number, phase: SignalPhase, act: (s: number) => number | null, reliable = true): number {
  let t = t0;
  for (let s = 0; s < sec - 1e-9; s += DT) {
    t += DT;
    c.push(t, frame(act(s), 2, reliable), phase, DT);
  }
  return t;
}

describe('SignalCoach — now', () => {
  it('reads a focus block above the threshold as working', () => {
    const c = new SignalCoach(5);
    run(c, 0, 10, FOCUS, () => 4);
    expect(c.state).toBe('above');
    expect(STATE_TONE[c.state]).toBe('good');
  });

  it('says "wait" in the first seconds of a focus block, "below" after the lag', () => {
    const c = new SignalCoach(5);
    run(c, 0, 3, FOCUS, () => 0);
    expect(c.state).toBe('wait');
    run(c, 3, 5, FOCUS, () => 0);
    expect(c.state).toBe('below');
  });

  it('sees a rising signal under the threshold as rising', () => {
    const c = new SignalCoach(5);
    run(c, 0, 10, FOCUS, s => -1 + s * 0.25);   // −1 … +1.5, still under 2
    expect(c.activity!).toBeLessThan(2);
    expect(c.slope).toBeGreaterThan(0.2);
    expect(c.state).toBe('rising');
  });

  it('reads rest: low is good, falling is good, high after the lag is a nudge', () => {
    const low = new SignalCoach(5);
    run(low, 0, 8, REST, () => 0);
    expect(low.state).toBe('restLow');
    const fall = new SignalCoach(5);
    run(fall, 0, 10, REST, s => 8 - s * 0.4);
    expect(fall.state).toBe('falling');
    const high = new SignalCoach(5);
    run(high, 0, 10, REST, () => 5);
    expect(high.state).toBe('restHigh');
    const early = new SignalCoach(5);
    run(early, 0, 2, REST, () => 5);
    expect(early.state).toBe('restWait');
  });

  it('never reads bad signal as low, and says nothing inside a blind block', () => {
    const c = new SignalCoach(5);
    run(c, 0, 4, FOCUS, () => 3, false);
    expect(c.state).toBe('nosignal');
    expect(c.activity).toBeNull();
    run(c, 4, 4, { want: 'focus', blind: true }, () => 9);
    expect(c.state).toBe('veiled');
  });
});

describe('SignalCoach — blocks', () => {
  it('judges the first push against the calibration, the next against the rest before it', () => {
    const c = new SignalCoach(5);
    let t = run(c, 0, 20, FOCUS, s => (s < 5 ? 0 : 3));
    t = run(c, t, 20, REST, s => (s < 5 ? 3 : 1));
    // the push ended when the rest began
    let r = c.report!;
    expect(r).toBeTruthy();
    t = run(c, t, 20, FOCUS, s => (s < 5 ? 1 : 2.8));
    run(c, t, 1, FREE, () => 2);
    r = c.report!;
    expect(r.kind).toBe('focus');
    expect(r.against).toBe('rest');
    expect(r.delta!).toBeCloseTo(1.8, 1);
    expect(r.verdict).toBe('moved');
  });

  it('reports a first push against the calibration and a rest against the push', () => {
    const c = new SignalCoach(5);
    let t = run(c, 0, 20, FOCUS, () => 2);
    run(c, t, 0.1, REST, () => 2);
    expect(c.report).toMatchObject({ kind: 'focus', against: 'calibration', verdict: 'moved' });
    expect(c.report!.delta!).toBeCloseTo(2, 5);
    t = run(c, t + 0.1, 20, REST, () => 2.2);
    run(c, t, 0.1, FOCUS, () => 2);
    expect(c.report).toMatchObject({ kind: 'rest', against: 'focus', verdict: 'flat' });
  });

  it('calls a push that went the other way "against", and a push without signal unjudged', () => {
    const c = new SignalCoach(5);
    let t = run(c, 0, 20, REST, () => 3);
    t = run(c, t, 20, FOCUS, () => 1);
    run(c, t, 0.1, REST, () => 1);
    expect(c.report).toMatchObject({ kind: 'focus', verdict: 'against' });
    const d = new SignalCoach(5);
    const t2 = run(d, 0, 20, FOCUS, () => 3, false);
    run(d, t2, 0.1, REST, () => 0);
    expect(d.report).toMatchObject({ kind: 'focus', verdict: 'unjudged', mean: null });
  });

  it('skips the lag at the start of each block', () => {
    const c = new SignalCoach(5);
    // the first 5 s still show the old state (very high), then 1 %: the mean must be 1
    const t = run(c, 0, 20, FOCUS, s => (s < 4.95 ? 10 : 1));   // 4.95: the sum of fifty 0.1 steps is 4.999…
    run(c, t, 0.1, REST, () => 0);
    expect(c.report!.mean!).toBeCloseTo(1, 1);
  });

  it('reports a blind block when it ends, and keeps the session contrast', () => {
    const c = new SignalCoach(5);
    let t = run(c, 0, 20, REST, () => 0);
    t = run(c, t, 20, { want: 'focus', blind: true }, () => 2);
    run(c, t, 0.1, REST, () => 0);
    expect(c.report).toMatchObject({ kind: 'focus', blind: true, verdict: 'moved' });
    expect(c.contrast.contrast!).toBeCloseTo(2, 1);
  });

  it('warm-ups and other free stretches neither report nor count', () => {
    const c = new SignalCoach(5);
    const t = run(c, 0, 20, FREE, () => 5);
    run(c, t, 1, FOCUS, () => 5);
    expect(c.report).toBeNull();
    expect(c.contrast.mean('focus')).toBeNull();
  });
});
