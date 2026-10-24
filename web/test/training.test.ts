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
