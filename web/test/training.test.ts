import { describe, expect, it } from 'vitest';
import { ActivityMeter, FNIRS_METER } from '../src/training/meter';
import {
  dayScore, isTopSession, newMilestones, restedYesterday, SessionScorer, streakDays, type TrainingResult,
} from '../src/training/score';

const DAY = 86400;
const NOW = new Date(2026, 9, 21, 18, 0, 0).getTime() / 1000;

function result(p: Partial<TrainingResult> = {}): TrainingResult {
  return {
    id: Math.random().toString(36).slice(2), kind: 'focus', tool: 'fnirs', source: 'simulator', device: 'Simulator',
    start_time: NOW - 600, end_time: NOW, planned_sec: 300, played_sec: 300, breathwork_sec: 0, completed: true, mood: null,
    scene: 'hills', points: 100, control_sec: 12, activity_avg_pct: 10, activity_max_pct: 25, reliable_pct: 100, series: [], ...p,
  };
}

describe('ActivityMeter', () => {
  it('calibrates on reliable ticks only, then reports activity against the reference', () => {
    const m = new ActivityMeter({ ...FNIRS_METER, smoothTau: 0, driftTau: 0 });
    let r = m.push(0.2, false, 0.1);
    expect(r.calProgress).toBe(0);                    // unreliable ticks do not count
    for (let i = 0; i < 199; i++) r = m.push(0.2, true, 0.1);
    expect(r.phase).toBe('calibrating');
    r = m.push(0.2, true, 0.1);
    expect(r.phase).toBe('active');
    r = m.push(1.0, true, 0.1);                       // +0.8 µM over a 4 µM scale
    expect(r.activity).toBeCloseTo(20, 6);
    expect(m.push(null, true, 0.1).reliable).toBe(false);
  });

  it('follows slow drift, not a held response', () => {
    const m = new ActivityMeter({ ...FNIRS_METER, smoothTau: 0 });
    for (let i = 0; i < 200; i++) m.push(0, true, 0.1);
    let r = m.push(0.8, true, 0.1);
    for (let i = 0; i < 600; i++) r = m.push(0.8, true, 0.1);   // a 60 s hold
    expect(r.activity!).toBeGreaterThan(17);                        // keeps most of its +20 %
    for (let i = 0; i < 60000; i++) r = m.push(0.8, true, 0.1);  // 100 min later the new level is the norm
    expect(Math.abs(r.activity!)).toBeLessThan(1);
  });

  /** A calibrated meter (reference 0 µM, no drift) with `act` % activity held for 8 s. */
  const holding = (act: number) => {
    const m = new ActivityMeter({ ...FNIRS_METER, driftTau: 0 });
    for (let i = 0; i < 200; i++) m.push(0, true, 0.1);
    const x = (act / 100) * FNIRS_METER.scale;
    for (let i = 0; i < 80; i++) m.push(x, true, 0.1);
    return m;
  };

  it('bridges a break: the signal comes back shifted, the activity goes on where it was (no new calibration)', () => {
    const m = holding(15);
    for (let i = 0; i < 40; i++) expect(m.push(null, false, 0.1).reliable).toBe(false);   // 4 s without a signal
    expect(m.anchoring).toBe(true);
    // back 3 µM higher (the band moved: a baseline shift worth +75 %), settling for 2.5 s
    let r = m.push(3 + 0.6, true, 0.1);
    expect(r).toMatchObject({ reliable: false, activity: null, anchoring: true });
    for (let i = 0; i < 24; i++) r = m.push(3 + 0.6, true, 0.1);
    expect(m.anchoring).toBe(false);
    expect(m.calibrated).toBe(true);
    expect(m.anchors).toBe(1);
    r = m.push(3 + 0.6, true, 0.1);
    expect(r.reliable).toBe(true);
    // 15 % faded over the 6.5 s since the break (τ 20 s): ≈ 10.8 %, nowhere near the +90 % a shifted reference would show
    expect(r.activity!).toBeGreaterThan(9);
    expect(r.activity!).toBeLessThan(13);
    // and it follows the brain from there
    for (let i = 0; i < 30; i++) r = m.push(3 + 0.6 + 0.4, true, 0.1);
    expect(r.activity!).toBeGreaterThan(17);
  });

  it('lets a short dip pass without re-anchoring', () => {
    const m = holding(10);
    for (let i = 0; i < 10; i++) m.push(null, false, 0.1);    // 1 s
    expect(m.anchoring).toBe(false);
    const r = m.push(0.4, true, 0.1);
    expect(r.reliable).toBe(true);
    expect(r.activity!).toBeCloseTo(10, 0);
    expect(m.anchors).toBe(0);
  });

  it('carries the seconds before a break, not the artifact that started it, and fades over a long one', () => {
    const m = holding(12);
    for (let i = 0; i < 6; i++) m.push(4, true, 0.1);         // the band slipping: +100 % for the last 0.6 s
    for (let i = 0; i < 20; i++) m.push(null, false, 0.1);
    for (let i = 0; i < 26; i++) m.push(1, true, 0.1);
    const r = m.push(1, true, 0.1);
    expect(r.activity!).toBeGreaterThan(8);                   // ≈ 12 % faded, not the spike
    expect(r.activity!).toBeLessThan(14);
    const long = holding(30);
    for (let i = 0; i < 1200; i++) long.push(null, false, 0.1);   // two minutes away
    for (let i = 0; i < 26; i++) long.push(-2, true, 0.1);
    expect(Math.abs(long.push(-2, true, 0.1).activity!)).toBeLessThan(1);   // the reference is where the signal is now
  });

  it('does not re-anchor after a pause of the data alone (a Bluetooth stall: the band did not move)', () => {
    const m = holding(14);
    for (let i = 0; i < 40; i++) m.push(null, false, 0.1, false);   // 4 s of 'no_data'
    expect(m.anchoring).toBe(false);
    const r = m.push(0.56, true, 0.1);
    expect(r.reliable).toBe(true);
    expect(r.activity!).toBeCloseTo(14, 0);
    // a stall that turns into a reconnect (a new optical baseline) is bridged
    for (let i = 0; i < 10; i++) m.push(null, false, 0.1, false);
    for (let i = 0; i < 10; i++) m.push(null, false, 0.1, true);
    expect(m.anchoring).toBe(true);
  });

  it('settles again when the signal drops while it settles, and never bridges before the calibration', () => {
    const m = holding(5);
    for (let i = 0; i < 20; i++) m.push(null, false, 0.1);
    for (let i = 0; i < 10; i++) m.push(1, true, 0.1);        // 1 s of the 2.5 s settle
    for (let i = 0; i < 5; i++) m.push(null, false, 0.1);
    expect(m.anchorProgress).toBe(0);
    for (let i = 0; i < 24; i++) expect(m.push(1, true, 0.1).reliable).toBe(false);
    expect(m.push(1, true, 0.1).reliable).toBe(true);
    const fresh = new ActivityMeter(FNIRS_METER);
    for (let i = 0; i < 50; i++) fresh.push(null, false, 0.1);
    expect(fresh.anchoring).toBe(false);
    expect(fresh.push(0, true, 0.1).phase).toBe('calibrating');
  });
});

describe('SessionScorer', () => {
  it('earns up to 3 points a second while elevated, a star per 10 points', () => {
    const s = new SessionScorer();
    let stars = 0;
    for (let i = 0; i < 100; i++) stars += s.tick(15, true, 0.1).star ? 1 : 0;   // 10 s at +15 %
    expect(s.points).toBeCloseTo(30, 6);
    expect(stars).toBe(3);
    for (let i = 0; i < 100; i++) s.tick(-5, true, 0.1);
    expect(s.points).toBeCloseTo(30, 6);              // nothing below the baseline
    for (let i = 0; i < 100; i++) s.tick(20, false, 0.1);
    expect(s.points).toBeCloseTo(30, 6);              // nothing while unreliable
    expect(s.meanActivity).toBeCloseTo(5, 6);
    expect(s.series).toHaveLength(30);
    expect(s.series[0]).toBe(15);
    expect(s.series[25]).toBeNull();
  });

  it('measures control as the longest steady hold, forgiving short dips', () => {
    const s = new SessionScorer();
    const run = (act: number, sec: number) => { for (let i = 0; i < sec * 10; i++) s.tick(act, true, 0.1); };
    run(5, 4);
    run(-2, 1);          // a 1 s dip: forgiven
    run(5, 4);
    expect(s.control).toBeCloseTo(8, 6);
    run(-2, 3);          // a real break
    run(5, 2);
    expect(s.hold).toBeCloseTo(2, 6);
    expect(s.control).toBeCloseTo(8, 6);
  });
});

describe('day score, streak, milestones', () => {
  it('counts the streak back from today or yesterday', () => {
    const rs = [0, 1, 2, 5].map(d => result({ start_time: NOW - d * DAY }));
    expect(streakDays(rs, NOW)).toBe(3);
    expect(streakDays(rs.slice(1), NOW)).toBe(2);   // nothing today yet: yesterday's streak still stands
    expect(streakDays([], NOW)).toBe(0);
  });

  it('forgives one missed day a week (a streak freeze), not two', () => {
    const days = (...ds: number[]) => ds.map(d => result({ start_time: NOW - d * DAY }));
    expect(streakDays(days(0, 1, 3, 4), NOW)).toBe(4);          // day 2 missed: frozen, not counted
    expect(streakDays(days(0, 2, 4), NOW)).toBe(2);             // a second gap within the week ends it
    expect(streakDays(days(0, 2, 3, 4, 5, 6, 7, 8, 10), NOW)).toBe(9);   // gaps 7 days apart are both forgiven
    expect(streakDays(days(0, 1, 4), NOW)).toBe(2);             // two missed days in a row are no freeze
  });

  it('keeps a frozen streak in the morning after the missed day, and does not re-announce milestones', () => {
    const days = (...ds: number[]) => ds.map(d => result({ start_time: NOW - d * DAY }));
    const before = days(2, 3, 4, 5, 6, 7, 8, 9);                 // 8 days, yesterday missed, nothing yet today
    expect(streakDays(before, NOW)).toBe(8);
    const today = result({ start_time: NOW - 60 });
    expect(streakDays([...before, today], NOW)).toBe(9);
    expect(newMilestones(before, today, NOW).map(m => m.id)).toEqual([]);
    expect(streakDays(days(3, 4, 5), NOW)).toBe(0);              // yesterday and the day before both missed
  });

  it('names the forgiven day a day of rest when today’s session carries the streak over it', () => {
    const days = (...ds: number[]) => ds.map(d => result({ start_time: NOW - d * DAY }));
    expect(restedYesterday(days(0, 2, 3), NOW)).toBe(true);     // yesterday missed, the streak goes on
    expect(dayScore(days(0, 2, 3), NOW).rested).toBe(true);
    expect(restedYesterday(days(0, 1, 2), NOW)).toBe(false);    // no gap
    expect(restedYesterday(days(2, 3), NOW)).toBe(false);       // nothing today yet
    expect(streakDays(days(0, 2, 3, 5), NOW)).toBe(3);          // the second gap ends the streak, yesterday's is the rest day
    expect(restedYesterday(days(0, 2, 3, 5), NOW)).toBe(true);
    expect(restedYesterday(days(0, 3), NOW)).toBe(false);       // two days missed are no rest day
  });

  it('adds commitment and performance', () => {
    const one = dayScore([result({ played_sec: 300, activity_avg_pct: 10 })], NOW);
    // 5 min × 4 = 20 · 1 day of 7 → 2.86 · streak 1 → 2  | performance 10/20 × 30 = 15
    expect(one.commitment).toBe(25);
    expect(one.performance).toBe(15);
    expect(one.score).toBe(40);
    expect(one.label).toBe('Budujesz rozpęd');
    const week = [...Array(7).keys()].map(d => result({ start_time: NOW - d * DAY, played_sec: 600, activity_avg_pct: 25 }));
    expect(dayScore(week, NOW).score).toBe(100);   // 40 + 20 + 10 (streak ×2 capped) + 30
  });

  it('reports milestones once, and the top session of the day', () => {
    const first = result();
    expect(newMilestones([], first, NOW).map(m => m.id)).toEqual(['first']);
    expect(newMilestones([first], result(), NOW)).toEqual([]);
    const streak = [1, 2].map(d => result({ start_time: NOW - d * DAY }));
    expect(newMilestones(streak, result(), NOW).map(m => m.id)).toContain('streak3');
    const a = result({ points: 50 }), b = result({ points: 80 });
    expect(isTopSession([a, b], b)).toBe(true);
    expect(isTopSession([a, b], a)).toBe(false);
  });
});
