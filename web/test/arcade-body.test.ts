/**
 * The band's side readings for the body games (src/arcade/kit/body.ts, hub.ts eegBalance): smoothed,
 * held through short gaps, dropped when unreliable — never invented.
 */
import { describe, expect, it } from 'vitest';
import { BodyTracker, EVEN_HIGH, EVEN_LOW, isEven } from '../src/arcade/kit/body';
import { eegBalance } from '../src/hub';

const tick = (p: { balance?: number | null; heartRate?: number | null; reliable?: boolean; dt?: number }) =>
  ({ reliable: p.reliable ?? true, dt: p.dt ?? 0.1, balance: p.balance ?? null, heartRate: p.heartRate ?? null });

describe('kit/body', () => {
  it('starts with no reading, then follows the balance smoothly', () => {
    const b = new BodyTracker();
    expect(b.value).toEqual({ balance: null, heartRate: null });
    b.push(tick({ balance: 0.5 }));
    expect(b.value.balance).toBe(0.5);
    for (let i = 0; i < 10; i++) b.push(tick({ balance: 0.7, dt: 0.1 }));
    const after1s = b.value.balance!;
    expect(after1s).toBeGreaterThan(0.5);
    expect(after1s).toBeLessThan(0.6);   // tau 3 s: one second moves it about a quarter of the way
    for (let i = 0; i < 200; i++) b.push(tick({ balance: 0.7, dt: 0.1 }));
    expect(b.value.balance!).toBeCloseTo(0.7, 2);
  });

  it('holds the balance through a short unreliable gap and drops it after a long one', () => {
    const b = new BodyTracker(3, 3);
    b.push(tick({ balance: 0.52 }));
    for (let i = 0; i < 20; i++) b.push(tick({ balance: 0.9, reliable: false, dt: 0.1 }));
    expect(b.value.balance).toBe(0.52);   // 2 s of motion: neither moved nor dropped
    for (let i = 0; i < 20; i++) b.push(tick({ balance: null, dt: 0.1 }));
    expect(b.value.balance).toBeNull();   // past 3 s: no reading
  });

  it('keeps a plausible pulse only, rounded, and forgets it after a few silent seconds', () => {
    const b = new BodyTracker();
    b.push(tick({ heartRate: 400 }));
    expect(b.value.heartRate).toBeNull();
    b.push(tick({ heartRate: 71.6 }));
    expect(b.value.heartRate).toBe(72);
    for (let i = 0; i < 70; i++) b.push(tick({ heartRate: null, dt: 0.1 }));
    expect(b.value.heartRate).toBeNull();
  });

  it('calls the trainer’s balanced band even', () => {
    expect(isEven(0.5)).toBe(true);
    expect(isEven(EVEN_LOW)).toBe(true);
    expect(isEven(EVEN_HIGH + 0.01)).toBe(false);
    expect(isEven(null)).toBe(false);
  });

  it('reads HALO’s two forehead channels as the same 0..1 asymmetry', () => {
    const even = eegBalance({ Fp1: { alpha: 10, beta: 5 }, Fp2: { alpha: 10, beta: 5 } });
    expect(even).toBeCloseTo(0.5, 6);
    const right = eegBalance({ Fp1: { alpha: 10, beta: 5 }, Fp2: { alpha: 8, beta: 6 } })!;
    expect(right).toBeGreaterThan(0.5);
    const left = eegBalance({ Fp1: { alpha: 8, beta: 6 }, Fp2: { alpha: 10, beta: 5 } })!;
    expect(left).toBeCloseTo(1 - right, 6);
    expect(eegBalance({ Fp1: { alpha: 0, beta: 0 }, Fp2: { alpha: 0, beta: 0 } })).toBeCloseTo(0.5, 6);
  });
});
