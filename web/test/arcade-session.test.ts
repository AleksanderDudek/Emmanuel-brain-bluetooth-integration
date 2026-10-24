import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { HubSample } from '../src/hub';
import { dayKey, daySeed, loadProgress, mergeSaved, saveProgress } from '../src/arcade/kit/progress';
import { ArcadeSession, CARRY_SEC } from '../src/arcade/kit/session';
import { SessionDB } from '../src/storage/db';

const sample = (x: number | null, p: Partial<HubSample> = {}): HubSample =>
  ({ tool: 'fnirs', x, reliable: true, reason: null, warning: null, dt: 0.1, epoch: 1, ...p });

const feed = (s: ArcadeSession, x: number | null, sec: number, p: Partial<HubSample> = {}) => {
  let out = s.onSample(sample(x, p));
  for (let i = 1; i < sec * 10; i++) out = s.onSample(sample(x, p));
  return out;
};

describe('ArcadeSession', () => {
  it('calibrates like the focus training, then gives the game a focus frame and runs the clock', () => {
    const s = new ArcadeSession('fnirs', 60);
    expect(s.begin(null, 1)).toBe(false);
    let calibrated = false;
    for (let i = 0; i < 200; i++) calibrated ||= s.onSample(sample(0)).calibrated;
    expect(calibrated).toBe(true);
    expect(s.phase).toBe('play');
    const out = feed(s, 0.8, 15);                 // +0.8 µM = +20 %
    expect(out.frame.reliable).toBe(true);
    expect(out.frame.level).toBeGreaterThan(0.95);
    expect(out.frame.focused).toBe(true);
    expect(s.t).toBeCloseTo(15, 0);
    expect(s.core.scorer.points).toBeGreaterThan(30);   // the training's Tlen points accrue as well
    expect(s.timeUp).toBe(false);
    feed(s, 0.8, 46);
    expect(s.timeUp).toBe(true);
    expect(s.phase).toBe('play');                 // time up never cuts the game by itself
  });

  it('stops the clock and the focus while paused', () => {
    const s = new ArcadeSession('fnirs', 60);
    s.begin(null, 1);
    feed(s, 0, 20);
    feed(s, 0.8, 5);
    const t = s.t;
    s.paused = true;
    feed(s, 0.8, 10);
    expect(s.t).toBe(t);
    s.paused = false;
    feed(s, 0.8, 1);
    expect(s.t).toBeCloseTo(t + 1, 6);
  });

  it('carries a fresh calibration on the same signal, not an old one or another epoch', () => {
    const a = new ArcadeSession('fnirs', 60);
    a.begin(null, 1);
    for (let i = 0; i < 210; i++) a.onSample(sample(0.3), 900 + i / 10);
    const carry = a.carry(5000)!;
    expect(carry.ref).toBeCloseTo(0.3, 2);
    expect(carry.at).toBeCloseTo(920.9, 6);                    // dated by the last live sample, not by the call
    carry.at = 1000;
    const b = new ArcadeSession('fnirs', 60);
    expect(b.begin(carry, 1, 1000 + 60)).toBe(true);
    expect(b.onSample(sample(0.3)).calibrated).toBe(true);   // the game starts at once
    expect(new ArcadeSession('fnirs', 60).begin(carry, 2, 1060)).toBe(false);              // a new baseline since
    expect(new ArcadeSession('fnirs', 60).begin(carry, 1, 1000 + CARRY_SEC + 1)).toBe(false);
    expect(new ArcadeSession('eeg', 60).begin(carry, 1, 1060)).toBe(false);
  });

  it('ignores samples of the other band (the tool switched under a running game)', () => {
    const s = new ArcadeSession('fnirs', 60);
    s.begin(null, 1);
    feed(s, 0, 20);
    feed(s, 0.8, 10);
    const t = s.t, frame = s.frame;
    feed(s, 5, 5, { tool: 'eeg' });
    expect(s.t).toBe(t);
    expect(s.frame).toBe(frame);
  });

  it('saves as a game result with the training numbers', () => {
    const s = new ArcadeSession('fnirs', 30);
    s.begin(null, 1);
    feed(s, 0, 20);
    feed(s, 0.6, 31);
    s.finish();
    const r = s.toResult({ id: 'g1', source: 'simulator', device: 'Symulator' },
      { id: 'test', title: 'Test', score: 12, unit: 'pkt', best: null, stats: [['Rzuty', '3']] });
    expect(r.kind).toBe('game');
    expect(r.scene).toBe('test');
    expect(r.planned_sec).toBe(30);
    expect(r.completed).toBe(true);
    expect(r.game?.score).toBe(12);
    expect(r.points).toBeGreaterThan(0);
    expect(r.activity_avg_pct).toBeGreaterThan(5);
    expect(r.series.length).toBeGreaterThanOrEqual(30);
  });
});

describe('arcade progress', () => {
  it('merges a save over fresh defaults, one level deep', () => {
    const fresh = { best: 0, seen: [] as string[], opts: { a: 1, b: 2 }, added: 'x' };
    expect(mergeSaved(fresh, { best: 5, seen: ['p'], opts: { a: 9 } })).toEqual({ best: 5, seen: ['p'], opts: { a: 9, b: 2 }, added: 'x' });
    expect(mergeSaved(fresh, null)).toBe(fresh);
  });

  it('round-trips through IndexedDB and gives everybody the same daily seed', async () => {
    const db = await SessionDB.open('arcade-progress');
    await saveProgress(db, 'g', { best: 7 });
    expect(await loadProgress(db, 'g', () => ({ best: 0, extra: true }))).toEqual({ best: 7, extra: true });
    db.close();
    expect(daySeed('g', '2026-10-23')).toBe(daySeed('g', '2026-10-23'));
    expect(daySeed('g', '2026-10-23')).not.toBe(daySeed('g', '2026-10-24'));
    expect(daySeed('g', '2026-10-23')).not.toBe(daySeed('h', '2026-10-23'));
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
