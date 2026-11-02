import { describe, expect, it } from 'vitest';
import type { FocusFrame } from '../src/arcade/kit/focus';
import { REVEAL_SEC, SignalTrace, traceBars } from '../src/arcade/kit/trace';

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

/** Push `sec` of play at 60 fps from `t0`, the frame and phase chosen per time. */
function fill(tr: SignalTrace, t0: number, sec: number, f: (t: number) => Partial<FocusFrame>, phase: 'focus' | 'rest' | 'free' = 'focus', veiled = false): number {
  let t = t0;
  for (let i = 0; i < Math.round(sec * 60); i++) {
    t += 1 / 60;
    tr.push(t, frame(f(t)), phase, veiled);
  }
  return t;
}

const BOX = { x: 10, y: 20, w: 400, h: 100 };

describe('SignalTrace', () => {
  it('keeps one sample per `every` and only the window (plus a second of slack)', () => {
    const tr = new SignalTrace(10, 0.1);
    const end = fill(tr, 0, 30, () => ({ activity: 3 }));
    expect(tr.samples.length).toBeGreaterThan(100);
    expect(tr.samples.length).toBeLessThan(115);
    expect(tr.samples[0].t).toBeGreaterThanOrEqual(end - 11.2);
  });

  it('records a failed signal as a gap, never as a value', () => {
    const tr = new SignalTrace(10);
    fill(tr, 0, 2, () => ({ reliable: false, activity: -40 }));
    expect(tr.samples.every(s => s.activity === null && !s.reliable)).toBe(true);
    // and the gap does not stretch the range
    fill(tr, 2, 2, () => ({ activity: 1 }));
    const r = tr.range(4);
    expect(r.lo).toBeGreaterThan(-5);
  });

  it('spans at least minSpan so a flat signal is not blown up', () => {
    const tr = new SignalTrace(10);
    const now = fill(tr, 0, 5, () => ({ activity: 2, threshold: 2 }));
    const r = tr.range(now, 4);
    expect(r.hi - r.lo).toBeCloseTo(4, 5);
    expect((r.hi + r.lo) / 2).toBeCloseTo(2, 5);
  });

  it('lays the window out with now on the right edge and higher activity higher up', () => {
    const tr = new SignalTrace(20);
    const now = fill(tr, 0, 20, t => ({ activity: t < 10 ? 0 : 6, threshold: 3 }));
    const l = tr.layout(BOX, now);
    const last = l.points[l.points.length - 1];
    expect(last.x).toBeGreaterThan(BOX.x + BOX.w - 3);
    const early = l.points.find(p => p.t > 2 && p.t < 3)!;
    expect(last.y).toBeLessThan(early.y);
    expect(last.above).toBe(true);
    expect(early.above).toBe(false);
    expect(l.points.every(p => p.y >= BOX.y - 1e-6 && p.y <= BOX.y + BOX.h + 1e-6)).toBe(true);
  });

  it('groups phases into bands', () => {
    const tr = new SignalTrace(30);
    let t = fill(tr, 0, 8, () => ({ activity: 3 }), 'focus');
    t = fill(tr, t, 8, () => ({ activity: 0 }), 'rest');
    t = fill(tr, t, 8, () => ({ activity: 3 }), 'focus');
    const l = tr.layout(BOX, t);
    expect(l.bands.map(b => b.phase)).toEqual(['focus', 'rest', 'focus']);
    expect(l.bands[0].x1).toBeCloseTo(l.bands[1].x0, 5);
  });

  it('veils a blind block and reveals it with a fade', () => {
    const tr = new SignalTrace(30);
    let t = fill(tr, 0, 5, () => ({ activity: 1 }), 'rest');
    t = fill(tr, t, 6, () => ({ activity: 5 }), 'focus', true);
    let l = tr.layout(BOX, t);
    expect(l.points.filter(p => p.phase === 'focus').every(p => p.shown === 0)).toBe(true);
    expect(l.bands.some(b => b.veiled)).toBe(true);
    tr.unveil(t);
    l = tr.layout(BOX, t + REVEAL_SEC / 2);
    const focus = l.points.filter(p => p.phase === 'focus');
    expect(focus[0].shown).toBeCloseTo(0.5, 1);
    l = tr.layout(BOX, t + REVEAL_SEC * 2);
    expect(l.points.filter(p => p.phase === 'focus').every(p => p.shown === 1)).toBe(true);
    expect(l.bands.some(b => b.veiled)).toBe(false);
  });

  it('cuts the window into bars, oldest first, empty where nothing was recorded yet', () => {
    const tr = new SignalTrace(20);
    const now = fill(tr, 0, 10, t => (t < 5 ? { activity: 0, level: 0.2 } : { activity: 4, level: 0.8 }));
    const bars = traceBars(tr, now, 4);
    expect(bars.map(b => b.empty)).toEqual([true, true, false, false]);
    expect(bars[2].above).toBe(false);
    expect(bars[3].above).toBe(true);
    expect(bars[3].level).toBeGreaterThan(bars[2].level);
  });

  it('marks a bar without signal as unreliable, not as low', () => {
    const tr = new SignalTrace(10);
    const now = fill(tr, 0, 10, t => (t > 5 ? { reliable: false } : { activity: 3 }));
    const bars = traceBars(tr, now, 2);
    expect(bars[0].reliable).toBe(true);
    expect(bars[1].reliable).toBe(false);
    expect(bars[1].empty).toBe(false);
  });
});
