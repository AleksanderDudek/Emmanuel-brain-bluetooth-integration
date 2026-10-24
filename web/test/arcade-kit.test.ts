import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, BlockContrast, DEFAULT_TUNING, FocusInput, RoundJudge, type FocusFrame } from '../src/arcade/kit/focus';
import { mulberry32 } from '../src/core/random';
import { ActivityMeter, FNIRS_METER } from '../src/training/meter';

const run = (f: FocusInput, activity: number | null, sec: number, reliable = true) => {
  let fr = f.push(activity, reliable, 0.1);
  for (let i = 1; i < sec * 10; i++) fr = f.push(activity, reliable, 0.1);
  return fr;
};

describe('FocusInput', () => {
  it('keeps the threshold at or above the floor: a reward always means a real rise', () => {
    const f = new FocusInput();
    const fr = run(f, -4, 120);
    expect(fr.threshold).toBe(DEFAULT_TUNING.floor);
    expect(fr.focused).toBe(false);
    expect(fr.level).toBeLessThan(0.2);
    expect(fr.calm).toBeGreaterThan(0.8);
  });

  it('settles where about 60 % of the reliable time is above it', () => {
    const f = new FocusInput();
    const rnd = mulberry32(7);
    for (let i = 0; i < 20 * 60 * 10; i++) f.push(rnd() * 10, true, 0.1);   // 20 min of activity spread over 0..10 %
    expect(f.threshold).toBeGreaterThan(3.2);
    expect(f.threshold).toBeLessThan(4.8);                                  // the 40th percentile is 4 %
    expect(f.rewardRate!).toBeGreaterThan(0.55);
    expect(f.rewardRate!).toBeLessThan(0.66);
  });

  it('rises slowly with a held response instead of chasing it', () => {
    const f = new FocusInput();
    const fr = run(f, 20, 30);
    expect(fr.threshold).toBeLessThan(6);      // 30 s at +20 % moves it by ~3 %
    expect(fr.level).toBeGreaterThan(0.99);
    expect(fr.hold).toBeCloseTo(30, 0);
  });

  it('forgives a short dip in a hold, not a long one', () => {
    const f = new FocusInput();
    run(f, 10, 5);
    let fr = run(f, -3, 1);
    expect(fr.focused).toBe(true);
    fr = run(f, 10, 2);
    expect(fr.hold).toBeCloseTo(7, 0);         // 5 + 2: the dip is forgiven, not counted (as in the training's Control)
    fr = run(f, -3, 4);
    expect(fr.focused).toBe(false);
    expect(fr.hold).toBe(0);
  });

  it('rides out Mayer waves: a 0.1 Hz swing around the threshold does not chop a hold', () => {
    const f = new FocusInput();
    run(f, 8, 20);                                 // focused, threshold settling just above the floor
    const th = f.threshold;
    let fr = f.push(th, true, 0.1);
    for (let i = 0; i < 300; i++) fr = f.push(th + 1 + 2 * Math.sin((2 * Math.PI * 0.1 * i) / 10), true, 0.1);   // ±2 % around th + 1
    expect(fr.focused).toBe(true);
    expect(fr.hold).toBeGreaterThan(40);
  });

  it('keeps the picture through a short gap and fades to neutral after a long one', () => {
    const f = new FocusInput();
    run(f, 12, 10);
    let fr = run(f, null, 1, false);
    expect(fr.reliable).toBe(false);
    expect(fr.level).toBeGreaterThan(0.9);
    fr = run(f, 12, 0.5, false);               // unreliable data is ignored, even when it looks good
    fr = run(f, null, 10, false);
    expect(fr.level).toBeLessThan(0.05);
    expect(fr.calm).toBeLessThan(0.05);         // a failed signal is not "rest" either
    const th = fr.threshold;
    run(f, 30, 5, false);
    expect(f.threshold).toBe(th);               // nor does it move the threshold
  });
});

describe('RoundJudge', () => {
  const frame = (activity: number | null, reliable = true): FocusFrame =>
    ({ reliable, activity, threshold: 3, level: 0.5, focused: false, hold: 0, calm: 0 });

  it('judges the last 15 s of a round, so the slow start (the lag) does not count', () => {
    const j = new RoundJudge();
    for (let i = 0; i < 100; i++) j.push('focus', frame(0), 0.1);     // a slow start …
    for (let i = 0; i < 80; i++) j.push('focus', frame(8), 0.1);      // … then 8 s above
    expect(j.share).toBeCloseTo(8 / 15, 2);
    expect(j.verdict()).toBe(true);                                  // 0.53 ≥ 0.6 − 0.1
    const r = new RoundJudge();
    for (let i = 0; i < 150; i++) r.push('rest', frame(i < 120 ? 6 : 0), 0.1);   // only the last 3 s below
    expect(r.verdict()).toBe(false);                                 // 0.2 < 0.4 − 0.1
  });

  it('is fair to both kinds of round when the threshold sits at the base rate', () => {
    const j = new RoundJudge();
    expect(j.need('focus')).toBeCloseTo(0.5, 6);
    expect(j.need('rest')).toBeCloseTo(0.3, 6);
    // no control at all: the signal is above the threshold 60 % of the time in every round
    const blind = (want: 'focus' | 'rest') => {
      const k = new RoundJudge();
      for (let i = 0; i < 150; i++) k.push(want, frame(i % 10 < 6 ? 6 : 0), 0.1);
      return k.share - k.need(want);
    };
    expect(blind('focus')).toBeCloseTo(0.1, 6);                      // both pass by the same small margin
    expect(blind('rest')).toBeCloseTo(0.1, 6);
  });

  it('leans further toward beginners on both sides, without moving their base rate', () => {
    const regular = RoundJudge.from(DEFAULT_TUNING), beginner = RoundJudge.from({ ...DEFAULT_TUNING, ...BEGINNER_TUNING });
    expect(beginner.base).toBe(regular.base);
    expect(beginner.need('focus')).toBeLessThan(regular.need('focus'));
    expect(beginner.need('rest')).toBeLessThan(regular.need('rest'));
    const half = RoundJudge.from({ ...DEFAULT_TUNING, targetRate: 0.5 });
    expect(half.need('focus')).toBeCloseTo(half.need('rest'), 9);     // a symmetric game is judged symmetrically
    expect(new RoundJudge(15, 0.9, 0.3).need('rest')).toBeCloseTo(0.05, 9);   // never below half of its side
  });

  it('has no verdict without reliable data, and ignores unreliable ticks', () => {
    const j = new RoundJudge();
    for (let i = 0; i < 200; i++) j.push('focus', frame(9, false), 0.1);
    expect(j.verdict()).toBeNull();
    for (let i = 0; i < 40; i++) j.push('focus', frame(null), 0.1);
    expect(j.verdict()).toBeNull();
  });
});

describe('BlockContrast', () => {
  it('compares focus blocks with rest blocks, skipping the haemodynamic lag', () => {
    const b = new BlockContrast(4);
    for (let i = 0; i < 200; i++) b.push('focus', i < 40 ? 0 : 12, true, i / 10, 0.1);   // the first 4 s still at rest level
    for (let i = 0; i < 200; i++) b.push('rest', i < 40 ? 12 : 2, true, i / 10, 0.1);
    b.push('rest', 99, false, 10, 0.1);
    expect(b.mean('focus')).toBeCloseTo(12, 6);
    expect(b.mean('rest')).toBeCloseTo(2, 6);
    expect(b.contrast).toBeCloseTo(10, 6);
    expect(new BlockContrast().contrast).toBeNull();
  });
});

describe('ActivityMeter.adopt', () => {
  it('starts calibrated at a carried-over reference', () => {
    const m = new ActivityMeter({ ...FNIRS_METER, smoothTau: 0, driftTau: 0 });
    for (let i = 0; i < 200; i++) m.push(0.5, true, 0.1);
    const ref = m.reference!;
    expect(ref).toBeCloseTo(0.5, 6);
    const next = new ActivityMeter({ ...FNIRS_METER, smoothTau: 0, driftTau: 0 });
    next.adopt(ref);
    const r = next.push(0.9, true, 0.1);
    expect(r.phase).toBe('active');
    expect(r.activity).toBeCloseTo(10, 6);       // +0.4 µM over a 4 µM scale
  });
});
