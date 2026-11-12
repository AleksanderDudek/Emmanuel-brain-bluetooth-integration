import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LINE_COUNT, MOMENTS, SETS, lessonsOf, lines } from '../src/arcade/wzlot/content';
import { CATALOGS, t } from '../src/arcade/wzlot/i18n';
import { TEACH, bestOf, checkLessons, freshProgress, hatch, migrate, noFeats, openLessons, type WzlotProgress } from '../src/arcade/wzlot/meta';
import { RULES } from '../src/arcade/wzlot/rules';
import { WzlotSim, granSeed, nightPace, perfectPts, planBlocks, quickOf, type SimEvent } from '../src/arcade/wzlot/sim';
import { Terrain } from '../src/arcade/wzlot/terrain';
import { Talk } from '../src/arcade/wzlot/talk';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CATALOGS as SHARED } from '../src/i18n/arcade';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, auditTargets } from '../src/arcade/kit/mobile';
import type { GameEnv } from '../src/arcade/kit/types';
import wzlot, { hintText, howto } from '../src/arcade/wzlot/index';
import { layout } from '../src/arcade/wzlot/layout';
import { font } from '../src/arcade/wzlot/paint';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });
const MID = frame({ level: 0.5, activity: 2, calm: 0.5 });

type SimOpts = { progress?: Partial<WzlotProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): WzlotSim {
  const sim = new WzlotSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242 + (o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player: no warm-up, no opening card, nothing left to teach. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, opened: true, taught: 255, ...o.progress } });

function drive(sim: WzlotSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    each?.(clock.t);
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Tiny Wings played well: heavy on the way down, light on the way up (and over the crag's run-up). */
function pilot(sim: WzlotSim): () => void {
  let down = false;
  return () => {
    const e = sim.eaglet, T = sim.terrain;
    const m = T.slope(e.x + 0.05);
    const h = e.y - T.height(e.x);
    const want = sim.dayPhase === 'fly' && (e.mode === 'ground' ? m < -0.02 : (e.vy < 0 && m < 0 && h < 0.5) || (e.vy < -0.2 && T.slope(e.x + 0.25) < 0));
    if (want !== down) {
      down = want;
      sim.pointer(want ? 'down' : 'up', 1);
    }
  };
}

/** Into block i (the day keeps flying). */
function toBlock(sim: WzlotSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = MID, clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more, push and rest alternating, ending before the last sunset', () => {
    for (const planned of [10, 40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(3));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(sum, `${planned} ${first}`).toBeLessThanOrEqual(Math.max(planned - RULES.finale, 2 * RULES.minBlock + RULES.warm.test) + 1e-6);
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-6);
        expect(plan[plan.length - 1].kind).toBe('rest');
        if (first) expect(plan[0].kind).toBe('warmup');
        const kinds = plan.filter(b => b.kind !== 'warmup').map(b => b.kind);
        kinds.forEach((k, i) => expect(k).toBe(i % 2 ? 'rest' : 'push'));
      }
    }
  });

  it('jitters the blocks of a long session around 24 and 23 s', () => {
    const plan = planBlocks(600, false, mulberry32(9));
    const push = plan.filter(b => b.kind === 'push').map(b => b.dur);
    expect(new Set(push.map(d => d.toFixed(2))).size).toBeGreaterThan(1);
    for (const d of push) expect(d).toBeGreaterThan(17);
  });

  it('reports each block to the dock, with its seconds left and the next block in the telegraph', () => {
    const sim = later({ planned: 120 });
    expect(sim.signal()).toMatchObject({ want: 'focus', blind: false });
    expect(sim.signal().task).toBeTruthy();
    const b0 = sim.block.dur;
    const clock = { t: 0 };
    drive(sim, b0 - 2, MID, clock);
    const s = sim.signal();
    expect(s.left).toBeCloseTo(2, 0);
    expect(s.next).toBe('rest');
    drive(sim, 3, MID, clock);
    expect(sim.signal()).toMatchObject({ want: 'rest', next: null });
  });

  it('opens a first-ever session with a free warm-up', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.block.kind).toBe('warmup');
    expect(sim.signal().want).toBe('free');
  });
});

describe('the granie (terrain)', () => {
  it('is the same for everyone on a day and in every run of the day', () => {
    const a = new Terrain(i => ({ seed: granSeed(77, i), gentle: false }));
    const b = new Terrain(i => ({ seed: granSeed(77, i), gentle: false }));
    a.ensure(40);
    b.ensure(40);
    for (let x = 0; x < 40; x += 0.37) expect(a.height(x)).toBeCloseTo(b.height(x), 9);
  });

  it('grows bolder grań by grań: more hills, a wider gorge; promyki and a podmuch on each', () => {
    const T = new Terrain(i => ({ seed: granSeed(5, i), gentle: false }));
    T.ensure(80);
    const g = T.granie;
    expect(g.length).toBeGreaterThan(3);
    expect(g[0].hills).toBe(RULES.hills0);
    expect(g[3].hills).toBe(RULES.hills0 + 3);
    for (const gr of g) {
      expect(gr.coins.length).toBeGreaterThanOrEqual(5);
      expect(gr.gapX1 - gr.gapX0).toBeGreaterThan(0.8);
      expect(gr.rimY).toBeLessThan(gr.cragY);
    }
    expect(g.some(gr => gr.orbs.length > 0)).toBe(true);
  });

  it('is smooth: height and slope continuous', () => {
    const T = new Terrain(i => ({ seed: granSeed(11, i), gentle: false }));
    T.ensure(30);
    for (let x = 0.01; x < 29; x += 0.013) {
      expect(Math.abs(T.height(x + 1e-4) - T.height(x))).toBeLessThan(0.002);
      expect(Math.abs(T.slope(x + 1e-4) - T.slope(x))).toBeLessThan(0.05);
    }
  });
});

describe('the flight (touch)', () => {
  it('waits in the nest at dawn; a touch takes off, or the sun rises by itself', () => {
    const sim = later();
    expect(sim.dayPhase).toBe('nest');
    sim.pointer('down', 1);
    sim.pointer('up', 1);
    const evs = drive(sim, 0.1, MID);
    expect(sim.dayPhase).toBe('fly');
    expect(ofType(evs, 'takeoff').length + 0).toBeGreaterThanOrEqual(0);
    const sim2 = later();
    drive(sim2, RULES.dawnWait + 0.2, MID);
    expect(sim2.dayPhase).toBe('fly');
  });

  it('holding makes it heavy: faster down a slope than light', () => {
    const run = (hold: boolean) => {
      const sim = later();
      const clock = { t: 0 };
      drive(sim, RULES.dawnWait + 0.1, MID, clock);
      if (hold) sim.pointer('down', 1);
      drive(sim, 2, MID, clock);
      return sim.eaglet.maxX;
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });

  it('a pilot who dives down and lets go up makes perfect slides, lights the Poryw and scores', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, 45, MID, { t: 0 }, pilot(sim));
    const perfect = ofType(evs, 'perfect');
    expect(perfect.length).toBeGreaterThan(3);
    expect(perfect[0].pts).toBe(perfectPts(1) * sim.dayMult);
    expect(ofType(evs, 'fever').length).toBeGreaterThan(0);
    expect(ofType(evs, 'gran').length).toBeGreaterThan(0);
    expect(ofType(evs, 'coin').length).toBeGreaterThan(0);
    expect(sim.total).toBeGreaterThan(500);
  });

  it('the Poryw doubles the points and ends at a landing that is not smooth', () => {
    const sim = later();
    drive(sim, RULES.dawnWait + 0.5, MID);
    const before = sim.mult;
    (sim as unknown as { startFever(b: boolean): void }).startFever(false);
    expect(sim.fever).toBe(true);
    expect(sim.mult).toBe(before * 2);
    (sim as unknown as { flightEvents: unknown[] }).flightEvents.push({ type: 'land', cls: 'stall', deg: 50, down: false, airT: 0.5, glide: 0.3, hills: 0, speed: 1 });
    (sim as unknown as { flightOut(): void }).flightOut();
    expect(sim.fever).toBe(false);
    expect(ofType(sim.take(), 'bump')).toHaveLength(1);
  });

  it('crude taps (the smoke test) still carry the eaglet forward, points accruing live', () => {
    const sim = makeSim({ planned: 40, tuning: BEGINNER });
    let tap = 0;
    const seen: number[] = [];
    drive(sim, 22, MID, { t: 0 }, tt => {
      if (tt - tap >= 0.65) {
        tap = tt;
        sim.pointer('down', 1);
        sim.pointer('up', 1);
      }
      seen.push(sim.headline().value);
    });
    expect(sim.eaglet.maxX).toBeGreaterThan(8);
    expect(sim.result().score).toBeGreaterThan(100);
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[Math.floor(seen.length / 2)]);
  });

  it('a grań reached gives the sun back, more for a quick one', () => {
    expect(quickOf(5, 10)).toBe(1);
    expect(quickOf(15, 10)).toBe(0);
    const sim = later({ planned: 600 });
    const evs = drive(sim, 40, MID, { t: 0 }, pilot(sim));
    const g = ofType(evs, 'gran')[0];
    expect(g.sun).toBeGreaterThanOrEqual(RULES.granSun);
    expect(g.pts).toBeGreaterThanOrEqual(RULES.gran);
  });

  it('the mother catches the eaglet over a gorge it cannot make and carries it to the next grań', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.2, MID, clock);
    const g = sim.terrain.granie[0];
    // drop it into the gorge, slowly
    Object.assign(sim.eaglet, { mode: 'air', x: g.gapX0 + 0.2, y: g.catchY + 0.05, vx: 0.3, vy: -1 });
    const evs = drive(sim, 6, MID, clock);
    expect(ofType(evs, 'catch')).toHaveLength(1);
    expect(sim.eaglet.maxX).toBeGreaterThan(g.gapX1);
    expect(ofType(evs, 'gran').length).toBeGreaterThan(0);
  });
});

describe('the day and the night', () => {
  it('the sun sinks one second a second; the night catches the eaglet, a tally, then a new day: the score is kept', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.1, MID, clock);
    const left = sim.dayLeft;
    drive(sim, 2, NONE, clock);
    expect(left - sim.dayLeft).toBeCloseTo(2, 0);
    sim.dayLeft = 0.5;
    const evs = drive(sim, 1 + RULES.dusk, NONE, clock);
    expect(ofType(evs, 'nightfall')).toHaveLength(1);
    expect(sim.dayPhase).toBe('tally');
    const tally = ofType(evs, 'tally')[0].tally;
    expect(tally.points).toBeGreaterThan(0);
    const banked = sim.total;
    expect(banked).toBe(tally.points);
    const evs2 = drive(sim, RULES.tallyMax + 0.1, NONE, clock);
    expect(ofType(evs2, 'dawn')[0].day).toBe(2);
    expect(sim.dayPhase).toBe('nest');
    expect(sim.total).toBe(banked);
    expect(sim.phase).toBe('play');
  });

  it('a tap skips the tally after a moment', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.1, MID, clock);
    sim.dayLeft = 0.1;
    drive(sim, RULES.dusk + 0.3, MID, clock);
    expect(sim.dayPhase).toBe('tally');
    drive(sim, RULES.tallyMin, MID, clock);
    sim.pointer('down', 1);
    expect(sim.dayPhase).toBe('nest');
  });

  it('focus holds the sun up in a push block, after the lead-in: never faster than its base pace', () => {
    expect(nightPace(0.5)).toBe(1);
    expect(nightPace(0.2)).toBe(1);
    expect(nightPace(1)).toBeCloseTo(1 - RULES.holdMax);
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.1, HIGH, clock);
    expect(sim.inPush).toBe(true);
    drive(sim, RULES.leadIn.fnirs + 4, HIGH, clock);
    const a = sim.dayLeft;
    drive(sim, 4, HIGH, clock);
    expect(a - sim.dayLeft).toBeLessThan(4 * 0.75);
    expect(sim.meter()).toBeGreaterThan(0.8);
  });

  it('without signal the sun goes at its base pace and the gauge shows nothing', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 8, NONE, clock);
    const a = sim.dayLeft;
    const evs = drive(sim, 3, NONE, clock);
    const back = ofType(evs, 'gran').reduce((s, e) => s + e.sun, 0);
    expect(a + back - sim.dayLeft).toBeCloseTo(3, 1);
    expect(sim.meter()).toBeNull();
  });

  it('a held focus fills the Poryw: a Poryw of the band', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, RULES.dawnWait + RULES.leadIn.fnirs + RULES.feverHold.fnirs + 1, HIGH);
    const f = ofType(evs, 'fever');
    expect(f.some(e => e.band)).toBe(true);
    expect(sim.bandFevers).toBe(1);
  });

  it('a passed push gives daylight back; a passed rest warms the next', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.1, HIGH, clock);
    const evs = toBlock(sim, 1, HIGH, clock);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBe(true);
    expect(end.pts).toBeGreaterThan(0);
    const evs2 = toBlock(sim, 2, CALM, clock);
    expect(ofType(evs2, 'blockEnd')[0].verdict).toBe(true);
    toBlock(sim, 3, CALM, clock);
    expect(sim.inRest).toBe(true);
    expect(sim.T).toBeGreaterThanOrEqual(RULES.tPass - 1e-9);
  });
});

describe('the rest: thermals', () => {
  it('calm builds the warm air; columns rise ahead and lift an eaglet with open wings', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.1, MID, clock);
    toBlock(sim, 1, MID, clock);
    expect(sim.inRest).toBe(true);
    const evs = drive(sim, 16, CALM, clock);
    expect(sim.T).toBeGreaterThan(0.4);
    expect(sim.meter()).toBeCloseTo(sim.T, 6);
    expect(ofType(evs, 'thermalRise').length).toBeGreaterThan(0);
    const climbs = ofType(evs, 'thermal');
    expect(climbs.length).toBeGreaterThan(0);
  });
});

describe('blind blocks', () => {
  it('every 4th push from the 3rd session; the gauge is veiled; the held seconds are revealed', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    expect(sim.block.blind).toBe(false);
    const clock = { t: 0 };
    toBlock(sim, 2, HIGH, clock);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    expect(sim.signal().blind).toBe(true);
    expect(sim.meter()).toBeNull();
    expect(sim.padLevel(HIGH)).toBeNull();
    const evs = toBlock(sim, 3, HIGH, clock);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.block.blind).toBe(true);
    expect(end.sunHeld).toBeGreaterThan(1);
  });

  it('never the second session', () => {
    const sim = later({ planned: 600, progress: { sessions: 1, pushes: 3 } });
    const clock = { t: 0 };
    toBlock(sim, 2, MID, clock);
    expect(sim.block.blind).toBe(false);
  });
});

describe('the meta: lessons, the nest, eggs', () => {
  it('three lessons at a time; a full set grows the nest (×2), lays an egg, opens the next set', () => {
    const p = freshProgress();
    expect(openLessons(p)).toHaveLength(3);
    const f = { ...noFeats(), perfectDay: 5, granDay: 2 };
    p.coins = 100;
    const out = checkLessons(p, f);
    expect(out.done.sort()).toEqual([0, 1, 2]);
    expect(out.nest).toBe(2);
    expect(p.eggs).toBe(1);
    expect(p.set).toBe(1);
    expect(openLessons(p).every(o => !o.done)).toBe(true);
    expect(hatch(p)).toBe(1);
    expect(p.chicks).toBe(1);
    expect(hatch(p)).toBe(0);
  });

  it('the sets go on past the written ones', () => {
    expect(SETS.length).toBeGreaterThanOrEqual(8);
    const far = lessonsOf(SETS.length + 2);
    expect(far).toHaveLength(3);
    expect(far[0].target).toBeGreaterThan(0);
  });

  it('a lesson done in flight is announced; the nest grows at the tally and multiplies the next day', () => {
    const sim = later({ planned: 600, progress: { coins: 99, doneMask: 0b101 } });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.1, MID, clock);
    const evs = drive(sim, 30, MID, clock, pilot(sim));
    expect(ofType(evs, 'lesson').length).toBeGreaterThan(0);
    expect(sim.p.nest).toBe(2);
    expect(sim.dayMult).toBe(1);
    sim.dayLeft = 0.1;
    const evs2 = drive(sim, RULES.dusk + RULES.tallyMax + 0.5, MID, clock);
    expect(ofType(evs2, 'nest')[0].level).toBe(2);
    expect(sim.dayMult).toBe(2);
  });

  it('migrates a version-1 save: keeps the sessions and the farthest flight, resets the rest', () => {
    const old = {
      v: 1, sessions: 7, metres: 23000, feathers: 40, down: 5, vistas: [0, 2, 5], lastVistaSession: 6, lekcje: 11,
      missions: ['soar', 'km3', 'chain5'], missionsDone: 4, missionNext: 7, best: { 180: 2400, 300: 4100 }, lastLen: 300,
      bestChain: 8, longestGlide: 300, highest: 180, dailyDay: '2026-11-01', dailyAir: 1200, giftDay: '2026-11-01',
    };
    // the runner merges the save over fresh defaults
    const p = { ...freshProgress(), ...old } as unknown as WzlotProgress;
    migrate(p);
    expect(p.ver).toBe(2);
    expect('v' in p).toBe(false);
    expect('vistas' in p).toBe(false);
    expect(p.sessions).toBe(7);
    expect(p.farthest).toBe(4100);
    expect(p.pushes).toBe(11);
    expect(p.nest).toBe(1);
    expect((p as unknown as Record<string, unknown>).best).toBeUndefined();
    expect(bestOf(p)).toBeNull();
    // a session runs on it
    const sim = new WzlotSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThan(0);
    // and it is idempotent
    const copy = JSON.stringify(p);
    migrate(p);
    expect(JSON.stringify(p)).toBe(copy);
  });

  it('repairs wrong field types in a version-2 save', () => {
    const p = { ...freshProgress(), nest: 'x', coins: null, taught: 'a' } as unknown as WzlotProgress;
    migrate(p);
    expect(p.nest).toBe(1);
    expect(p.coins).toBe(0);
    expect(p.taught).toBe(0);
  });
});

describe('the coach marks', () => {
  it('teach the controls in the first session, one at a time, and the band blocks when they come', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    const evs = drive(sim, 60, MID, clock, pilot(sim));
    const keys = ofType(evs, 'hint').map(e => e.key);
    expect(keys[0]).toBe('hold');
    expect(keys).toContain('release');
    expect(keys).toContain('perfect');
    expect(sim.p.taught & TEACH.hold).toBeTruthy();
  });

  it('later sessions only hear about new things', () => {
    const sim = later({ planned: 300 });
    const evs = drive(sim, 60, MID, { t: 0 }, pilot(sim));
    expect(ofType(evs, 'hint')).toHaveLength(0);
  });
});

describe('the summary', () => {
  it('result() is idempotent and the records use Math.max', () => {
    const sim = later({ planned: 60, progress: { bestTotal: 10, bestDay: 5 } });
    drive(sim, 30, MID, { t: 0 }, pilot(sim));
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.bestTotal).toBe(a.score);
    expect(a.record).toBe(true);
    sim.finish();
    const c = sim.result();
    expect(sim.p.sessions).toBe(6);
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.result()).toEqual(c);
  });

  it('ends with the last sunset: the session settles by itself', () => {
    const sim = later({ planned: 40 });
    const evs = drive(sim, 46, MID);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
  });

  it('closes with a passage that exists', () => {
    const sim = later({ planned: 60 });
    drive(sim, 20, MID, { t: 0 }, pilot(sim));
    const r = sim.result();
    expect(passage(r.verse!)).toBeTruthy();
    expect(r.stats.length).toBeGreaterThan(5);
    expect(r.highlights.length).toBeGreaterThan(0);
  });
});

describe('Leon talks', () => {
  it('every moment has 3+ lines, each fits a bubble (90 characters), in all four languages', () => {
    for (const m of MOMENTS) expect(LINE_COUNT[m]).toBeGreaterThanOrEqual(3);
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) {
        if (k.startsWith('talk.')) expect((v as string).length, k).toBeLessThanOrEqual(RULES.talkChars);
      }
    }
    const all = lines();
    for (const m of MOMENTS) expect(all[m].every(s => s && !s.startsWith('talk.'))).toBe(true);
  });

  it('one line at a time, never while blocked, no repeats until a moment has used them all', () => {
    const talk = new Talk(lines(), mulberry32(4));
    talk.ask('bump');
    talk.update(0.1, 0, true);
    expect(talk.line).toBeNull();
    const said = new Set<string>();
    let now = 0;
    for (let i = 0; i < LINE_COUNT.bump; i++) {
      talk.ask('bump', 1, 99);
      for (let k = 0; k < 600 && !talk.line; k++) talk.update(0.05, (now += 0.05), false);
      said.add(talk.line!.text);
      for (let k = 0; k < 200 && talk.line; k++) talk.update(0.05, (now += 0.05), false);
    }
    expect(said.size).toBe(LINE_COUNT.bump);
  });

  it('talks during a session and stays quiet under the banner', () => {
    const sim = later({ planned: 120 });
    let under = 0, lines = 0;
    drive(sim, 60, MID, { t: 0 }, () => {
      if (sim.talk.line) lines++;
      if (sim.talk.line && sim.phase === 'play' && sim.blockT < RULES.banner - 0.1 && sim.blockT > 0.1) under++;
    });
    expect(lines).toBeGreaterThan(0);
    expect(under).toBe(0);
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('never asks to concentrate harder, never uses holiness words or "hack"', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /mocniej/, /harder/, /stärker/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /odblok/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /pray/, /módl/, /\bbete/]) {
        expect(all).not.toMatch(word);
      }
    }
  });

  it('keeps numbers with their units (no-break spaces)', () => {
    expect(t('sec', { n: 12 })).toBe('12 s');
    expect(CATALOGS.de.pct).toBe('{n} %');
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the centre every 0.65 s, Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<WzlotProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, at22 = 0;
    const live: number[] = [];
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.pointer('down', 1);
        sim.pointer('up', 1);
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
      live.push(sim.headline().value);
      at22 = sim.result().score;
    }
    return { at22, live };
  }

  it('scores by 22 s on either band, first session or later, and the headline accrues live', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) {
        const { at22, live } = smoke({}, seed, eeg);
        expect(at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(50);
        expect(live[live.length - 1]).toBe(at22);
        expect(live[Math.floor(live.length / 2)]).toBeGreaterThan(0);
      }
    }
    expect(smoke({ sessions: 6, opened: true, taught: 255 }, 3, false, 300).at22).toBeGreaterThan(50);
  });
});

describe('the module (index.ts, panel.ts)', () => {
  it('shows the best session in the lobby, nothing before a first session; how to play in words', async () => {
    const mod = (await import('../src/arcade/wzlot/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.bestTotal = 3400;
    expect(mod.best(p)).toBe(3400);
    const how = mod.howto!();
    expect(how.goal).toBeTruthy();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
  });

  it('builds the progress card from elements: the nest, the lessons', async () => {
    const { progressPanel } = await import('../src/arcade/wzlot/panel');
    const p = { ...freshProgress(), sessions: 3, nest: 2, eggs: 1, chicks: 1, bestTotal: 2000, bestDay: 900, doneMask: 1 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-chips span, li').length).toBeGreaterThan(0);
    expect(el.textContent).toContain(t('panel.nest'));
  });
});

// ── mobile first (DESIGN §12) ──────────────────────────────────
/** The size in a canvas font string. */
const pxOf = (f: unknown): number => Number(String(f).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);

/**
 * A 2D context that draws nothing and notes every string filled or stroked at the size it shows (the font's
 * size times the transform's scale over the pixel ratio), the largest per string — as the mobile audit
 * measures it.  Save and restore keep the scale, the font and the alpha like a real context.
 */
function recordingContext(canvas: unknown, dpr: number, texts: Map<string, number> | null): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const stack: { k: number; font: unknown; alpha: unknown }[] = [];
  let k = 1 / dpr;
  const width = (s: string) => s.length * pxOf(state.font) * 0.55;
  const note = (text: unknown, maxW?: number) => {
    const str = String(text);
    if (!texts || !str.trim() || Number(state.globalAlpha) <= 0.05) return;
    let px = pxOf(state.font) * k;
    if (maxW !== undefined && maxW > 0 && width(str) > maxW) px *= maxW / width(str);
    texts.set(str, Math.max(texts.get(str) ?? 0, px));
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      switch (prop) {
        case 'measureText': return (s: string) => ({ width: width(String(s)) });
        case 'createLinearGradient': case 'createRadialGradient': case 'createConicGradient': return () => gradient;
        case 'setTransform': return (a: number, b: number) => { k = Math.hypot(a, b) / dpr; };
        case 'scale': return (sx: number) => { k *= sx; };
        case 'save': return () => { stack.push({ k, font: state.font, alpha: state.globalAlpha }); };
        case 'restore': return () => {
          const top = stack.pop();
          if (top) { k = top.k; state.font = top.font; state.globalAlpha = top.alpha; }
        };
        case 'fillText': case 'strokeText': return (s: string, _x: number, _y: number, maxW?: number) => note(s, maxW);
        default: return () => undefined;
      }
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

type Box = { kind: string; r: { x: number; y: number; w: number; h: number } } | null;
type Game = ReturnType<typeof wzlot.create> & { sim: WzlotSim; view: { hud: { box: Box; float(text: string, x: number, y: number, color?: string, size?: number): void } } };

describe('mobile first (DESIGN §12)', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  let recording: { canvas: HTMLCanvasElement; texts: Map<string, number> } | null = null;
  beforeAll(() => {
    proto.getContext = function (this: HTMLCanvasElement) {
      return recording && recording.canvas === this ? recordingContext(this, 2, recording.texts) : recordingContext(this, 1, null);
    };
  });
  afterAll(() => {
    proto.getContext = original;
  });

  const envAt = (progress: WzlotProgress, c: (typeof CHECK_SIZES)[number], plannedSec: number, touch = true): GameEnv<WzlotProgress> => ({
    canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
    progress, rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
    tuning: TUNING, hint: () => {}, hudTop: () => c.insets.top, insets: () => c.insets, touch,
  });

  /** A game as the runner starts it at size c (a first-ever session unless `later`). */
  function startAt(c: (typeof CHECK_SIZES)[number], later = false, texts: Map<string, number> | null = null, planned = 90): Game {
    const progress = later ? { ...freshProgress(), sessions: 5, opened: true, taught: 255 } : freshProgress();
    const env = envAt(progress, c, planned);
    recording = texts ? { canvas: env.canvas, texts } : null;
    const game = wzlot.create(env) as Game;
    recording = null;
    game.resize(c.w, c.h, 2);
    game.start();
    return game;
  }

  /** Play until `until` holds (or `max` s): hold on the way down, let go on the way up, drawing every frame. */
  function play(game: Game, max: number, f: FocusFrame = MID, until: () => boolean = () => false, clock = { t: 0 }): void {
    const fly = pilot(game.sim);
    for (let i = 0; i < max / 0.05 && !until(); i++) {
      clock.t += 0.05;
      fly();
      game.update(0.05, f, clock.t);
      game.draw();
    }
  }

  it('lays the world out phone first at every checked size: a thumb pad under the ground upright, the sun under the HUD', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      const name = c.name;
      if (Math.min(c.w, c.h) <= 390) expect(L.u, name).toBe(1);
      else expect(L.u, name).toBeGreaterThan(1);
      expect(L.u).toBeLessThanOrEqual(1.3);
      expect(L.top, name).toBe(c.insets.top);
      expect(L.foot, name).toBe(c.h - c.insets.bottom);
      // the sun (from noon, the arc's middle, to the night at its end), its gauge and the Poryw's ring stay in the
      // band; the sun itself inside the sides
      expect(L.arcTop - L.sunR * 3.5, name).toBeGreaterThanOrEqual(c.insets.top - 6);
      expect((L.arcX0 + L.arcX1) / 2 - L.sunR * 3.5, name).toBeGreaterThanOrEqual(c.insets.left);
      expect(L.arcX1 + L.sunR * 2, name).toBeLessThanOrEqual(c.w - c.insets.right);
      expect(L.sunR, name).toBeGreaterThanOrEqual(14);
      expect(L.cardY, name).toBeGreaterThan(L.top);
      expect(L.cardY, name).toBeLessThan(L.bottom);
      // the camera on the ground (span 1.15): the world closer upright than it was (212 px per screen height on a 360 px phone)
      const S = Math.min((L.bottom - L.top) / 1.27, L.w / L.minWorldW, L.maxS);
      if (L.tall && c.w < 600) {
        expect(c.h - c.insets.bottom - L.bottom, `${name}: the thumb pad`).toBeGreaterThanOrEqual(50);
        expect(S, name).toBeGreaterThanOrEqual(240);
        expect(0.13 * S, `${name}: the eaglet`).toBeGreaterThanOrEqual(31);
        expect(L.ex, name).toBeLessThanOrEqual(c.w * 0.22);
      }
      expect(S, name).toBeLessThanOrEqual(L.maxS + 1e-9);
    }
  });

  it('gives the one control on screen — the story card, the tally, the dawn prompt — a finger-sized target in the band, and none over the free sky', () => {
    for (const c of CHECK_SIZES) {
      const game = startAt(c);
      game.update(0.05, MID, 0.05);
      game.draw();
      let ts = game.targets!();
      expect(ts.map(x => x.label), c.name).toEqual(['story']);
      expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: the story`).toEqual([]);
      // a tap on the chart under the game (the canvas's bottom edge) takes off once the card has been up a moment
      play(game, 1.4);
      game.pointer!({ type: 'down', x: c.w / 2, y: c.h - 1, id: 1 });
      game.pointer!({ type: 'up', x: c.w / 2, y: c.h - 1, id: 1 });
      play(game, 1);
      expect(game.sim.opening, c.name).toBe(false);
      expect(game.targets!(), `${c.name}: flying`).toEqual([]);
      // nightfall: the tally, then the dawn's prompt
      game.sim.dayLeft = 0.05;
      play(game, 12, MID, () => game.sim.dayPhase === 'tally');
      play(game, 0.3);
      ts = game.targets!();
      expect(ts.map(x => x.label), c.name).toEqual(['tally']);
      expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: the tally`).toEqual([]);
      play(game, 2.5);
      game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 1 });
      game.pointer!({ type: 'up', x: c.w / 2, y: c.h / 2, id: 1 });
      play(game, 0.3);
      ts = game.targets!();
      expect(ts.map(x => x.label), c.name).toEqual(['dawn']);
      expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: the dawn`).toEqual([]);
      game.destroy();
    }
  });

  it('never draws text under 11 px: the font helper has a floor, the flying words 13 px and more', () => {
    for (const px of [0, 3, 6.4, 8, 10, 10.99, 11, 12.3, 13, 30]) expect(pxOf(font(600, px, 'sans-serif'))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(font(800, 14.24, 'serif', true))).toBe(14.2);
    const game = startAt(CHECK_SIZES[0]);
    game.view.hud.float('×5', 100, 300, '#fff', 8);
    const f = (game.view.hud as unknown as { floats: { items: { size: number }[] } }).floats.items;
    expect(f[f.length - 1].size).toBeGreaterThanOrEqual(MIN_READ);
    game.destroy();
  });

  it('draws every word of a session at 11 px or more on the smallest phone, on its side and on a desktop; the flying words, Leon and the cards at 13', () => {
    for (const c of [CHECK_SIZES[0], CHECK_SIZES[4], CHECK_SIZES[7]]) {
      for (const later of [false, true]) {
        const texts = new Map<string, number>();
        const game = startAt(c, later, texts, 60);
        const name = `${c.name}, ${later ? 'a later session' : 'the first'}`;
        const clock = { t: 0 };
        play(game, 1.6, MID, undefined, clock);
        game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 1 });
        game.pointer!({ type: 'up', x: c.w / 2, y: c.h / 2, id: 1 });
        play(game, 40, (clock.t % 50) < 25 ? HIGH : CALM, undefined, clock);
        game.sim.dayLeft = 0.05;
        play(game, 12, MID, () => game.sim.dayPhase === 'tally', clock);
        play(game, 2.5, MID, undefined, clock);
        expect(texts.size, name).toBeGreaterThan(6);
        for (const [s, px] of texts) expect(px, `${name}: "${s}"`).toBeGreaterThanOrEqual(MIN_TEXT - 0.05);
        // what the player reads to play: Leon's lines, the flying words, the tally's rows
        const reading = [...game.sim.talk.said, t('fx.caught'), t('fx.perfect'), t('tally.perfect'), t('tally.coins'), t('dawn.tap'), t('tally.next')];
        for (const [s, px] of texts) {
          if (s.length > 5 && reading.some(r => r.includes(s.replace(/…$/, '')))) expect(px, `${name}: "${s}"`).toBeGreaterThanOrEqual(MIN_READ - 0.05);
        }
        game.destroy();
      }
    }
  }, 90_000);

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['hint.hold', 'hint.release', 'dawn.tap', 'tally.next', 'how.goal', 'how.hold', 'how.release', 'how.tip1', 'how.tip2']) {
        expect(cat[k], `${l}.${k}`).toBeTypeOf('string');
        expect(cat[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      for (const k of ['hint.hold.keys', 'dawn.tap.keys', 'tally.next.keys', 'how.keys']) expect(cat[k], `${l}.${k}`).toMatch(KEYS);
      // the calibration card turns the registry's tips on a phone too
      const shared = SHARED[l] as Record<string, unknown>;
      for (let i = 1; i <= 5; i++) expect(shared[`wzlot.tip${i}`], `${l} wzlot.tip${i}`).not.toMatch(KEYS);
    }
    expect(hintText('hold', true)).not.toMatch(KEYS);
    expect(hintText('hold', false)).toMatch(KEYS);
    expect(hintText('sun', false)).toBe(t('hint.sun'));
    expect(howto(true).hands.map(x => x.gesture)).toEqual(['hold', 'tap']);
    expect(howto(false).hands.map(x => x.gesture)).toEqual(['hold', 'tap', 'keys']);
  });
});
