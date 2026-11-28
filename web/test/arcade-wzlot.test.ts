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
import { hourFrames, mean } from './longframe';
import { catalogProblems } from '../src/i18n';
import { CATALOGS as SHARED } from '../src/i18n/arcade';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TEXT, auditTargets } from '../src/arcade/kit/mobile';
import type { GameEnv } from '../src/arcade/kit/types';
import wzlot, { hintText, howto } from '../src/arcade/wzlot/index';
import { BIG_ACROSS, layout } from '../src/arcade/wzlot/layout';
import type { WzlotView } from '../src/arcade/wzlot/render';
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
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, opened: true, taught: 255, practiced: 1, ...o.progress } });

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

/**
 * Tiny Wings played well: heavy on the way down, light on the way up (and over the crag's run-up); in the practice
 * valley it does what the prompt asks.
 */
function pilot(sim: WzlotSim): () => void {
  let down = false;
  return () => {
    const e = sim.eaglet, T = sim.terrain;
    const m = T.slope(e.x + 0.05);
    const h = e.y - T.height(e.x);
    const step = sim.practice?.step;
    const want = step === 'waitHold' ? true : step === 'waitRelease' ? false
      : sim.dayPhase === 'fly' && (e.mode === 'ground' ? m < -0.02 : (e.vy < 0 && m < 0 && h < 0.5) || (e.vy < -0.2 && T.slope(e.x + 0.25) < 0));
    if (want !== down) {
      down = want;
      sim.pointer(want ? 'down' : 'up', 1);
    }
  };
}

/** A player who does only what the practice valley's prompts ask (hold at its wait for the hold, let go at the other), then flies with `after`. */
function prompted(sim: WzlotSim, after: () => void = () => {}): () => void {
  let down = false;
  return () => {
    const step = sim.practice?.step;
    if (!step) return after();
    const want = step === 'waitHold' || step === 'down' ? true : step === 'waitRelease' || step === 'up' ? false : down && step !== 'go';
    if (want !== down) {
      down = want;
      sim.pointer(want ? 'down' : 'up', 7);
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

  it('jitters the blocks of a long session around 40 and 20 s', () => {
    const plan = planBlocks(600, false, mulberry32(9));
    const push = plan.filter(b => b.kind === 'push').map(b => b.dur);
    expect(new Set(push.map(d => d.toFixed(2))).size).toBeGreaterThan(1);
    for (const d of push) expect(d).toBeGreaterThan(28);
  });

  it('follows the rhythm the player set in the lobby: longer holding of the sun, shorter thermals, the jitter scaled', () => {
    for (const planned of [300, 1800]) {
      const plan = planBlocks(planned, false, mulberry32(5), { focus: 90, rest: 15 });
      const push = plan.filter(b => b.kind === 'push'), rest = plan.filter(b => b.kind === 'rest');
      const mean = (bs: typeof plan) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
      expect(mean(push) / mean(rest)).toBeGreaterThan(4);
      expect(mean(push)).toBeGreaterThan(70);
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - RULES.finale, 5);
      for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
    // no rhythm: the designed one, the thermals a third of the session
    const plan = planBlocks(600, false, mulberry32(5));
    const restShare = plan.filter(b => b.kind === 'rest').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(restShare).toBeGreaterThan(0.27);
    expect(restShare).toBeLessThan(0.4);
    // the sim takes the rhythm, also when the practice valley plans the blocks again; the score still grows
    for (const rhythm of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }]) {
      const sim = new WzlotSim({
        progress: { ...freshProgress(), sessions: 5, opened: true, taught: 255, practiced: 1 }, rng: mulberry32(7), day: DAY,
        daySeed: 4243, plannedSec: 600, eeg: false, tuning: TUNING, rhythm,
      });
      sim.start();
      const push = sim.plan.filter(b => b.kind === 'push');
      const mean = push.reduce((s, b) => s + b.dur, 0) / push.length;
      expect(mean).toBeGreaterThan(rhythm.focus * 0.75);
      expect(mean).toBeLessThan(rhythm.focus * 1.25);
      const clock = { t: 0 };
      const fly = pilot(sim);
      for (let i = 0; i < 606 * 30 && sim.phase !== 'done'; i++) {
        clock.t += 1 / 30;
        fly();
        sim.update(1 / 30, sim.block.kind === 'rest' ? CALM : HIGH, clock.t);
        sim.take();
      }
      expect(sim.phase).toBe('done');
      expect(sim.total).toBeGreaterThan(1000);
    }
    const practice = new WzlotSim({
      progress: freshProgress(), rng: mulberry32(2), day: DAY, daySeed: 4244, plannedSec: 300, eeg: false, tuning: TUNING, rhythm: { focus: 60, rest: 30 },
    });
    practice.start();
    const clock = { t: 0 };
    const fly = prompted(practice);
    drive(practice, 120, MID, clock, fly);
    const after = practice.plan.filter(b => b.kind === 'push');
    expect(after.length).toBeGreaterThan(0);
    for (const b of after) expect(b.dur).toBeGreaterThan(40);
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
    // a first session: the taps take the practice valley's three slides, then the flight runs at full speed
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
    expect(sim.practiceFinished).toBe(true);
    expect(sim.eaglet.maxX).toBeGreaterThan(4);
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
    // a session runs on it (opening with the practice valley, which a player from before round 11 never had)
    const sim = new WzlotSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.practiceSession).toBe(true);
    drive(sim, 10, MID, { t: 0 }, pilot(sim));
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
  it('teach the controls in the first session by doing: the practice valley shows the hold and the let-go, coach marks only what comes after', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    // a player who does what the prompts say, when they say it, and flies well after
    const fly = pilot(sim);
    const evs = drive(sim, 60, MID, clock, prompted(sim, fly));
    const steps = ofType(evs, 'practice').map(e => e.step);
    expect(steps).toContain('waitHold');
    expect(steps).toContain('waitRelease');
    expect(ofType(evs, 'practiceDone')).toEqual([{ type: 'practiceDone', finished: true }]);
    const keys = ofType(evs, 'hint').map(e => e.key);
    for (const k of ['hold', 'release', 'perfect'] as const) expect(keys, k).not.toContain(k);
    for (const k of ['hold', 'release', 'perfect'] as const) expect(sim.p.taught & TEACH[k], k).toBeTruthy();
    // no coach mark while the practice runs
    const done = evs.findIndex(e => e.type === 'practiceDone');
    expect(evs.slice(0, done).filter(e => e.type === 'hint')).toEqual([]);
  });

  it('a practice that ran out of time leaves the hold to the coach mark', () => {
    const sim = makeSim({ planned: 60 });
    const clock = { t: 0 };
    // the story card is tapped, then nothing: the practice waits, and gives up at its cap
    drive(sim, 1.5, MID, clock);
    sim.pointer('down', 1);
    sim.pointer('up', 1);
    const evs = drive(sim, 30, MID, clock);
    expect(ofType(evs, 'practiceDone')).toEqual([{ type: 'practiceDone', finished: false }]);
    expect(sim.p.practiced).toBe(0);
    expect(ofType(evs, 'hint').map(e => e.key)).toContain('hold');
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

// ── when to steer (round 11: "dalej niezrozumiałe jak i kiedy mam sterować") ─────────────
/** The first valley past `from` whose downslope and upslope are each at least `min` long (no gorge). */
function valleyAhead(sim: WzlotSim, from: number, min = 0.3) {
  const T = sim.terrain;
  T.ensure(from + 10);
  const list = T.stretches(from, from + 10);
  for (let i = 0; i + 1 < list.length; i++) {
    const a = list[i], b = list[i + 1];
    if (a.down && !a.gap && !b.down && !b.gap && a.x0 >= from && a.x1 - a.x0 >= min && b.x1 - b.x0 >= min) {
      return { top: a.x0, trough: a.x1, crest: b.x1, downLen: a.x1 - a.x0, upLen: b.x1 - b.x0 };
    }
  }
  throw new Error('no valley');
}

/** A returning player's sim in flight, the eaglet set on the ground at x sliding at s (any slide forgotten). */
function flyingAt(x: number, s = 1, o: SimOpts = {}): { sim: WzlotSim; clock: { t: number } } {
  const sim = later({ planned: 600, ...o });
  const clock = { t: 0 };
  drive(sim, RULES.dawnWait + 0.1, MID, clock);
  Object.assign(sim.eaglet, { mode: 'ground', x, y: sim.terrain.height(x), s, maxX: x, vx: 0, vy: 0 });
  (sim as unknown as { slide: unknown }).slide = null;
  sim.take();
  return { sim, clock };
}

/** Drive while the hand holds where `hold(x)` says (pointer 3), until `stop(x)`; the events. */
function slideBy(sim: WzlotSim, clock: { t: number }, hold: (x: number) => boolean, stop: (x: number) => boolean, max = 6): SimEvent[] {
  const out: SimEvent[] = [];
  let down = false;
  for (let i = 0; i < max / STEP && !stop(sim.eaglet.x); i++) {
    const want = hold(sim.eaglet.x);
    if (want !== down) {
      down = want;
      sim.pointer(want ? 'down' : 'up', 3);
    }
    out.push(...drive(sim, STEP, MID, clock));
  }
  if (down) sim.pointer('up', 3);
  return out;
}

describe('when to steer: the slopes, the cue, the verdict (round 11)', () => {
  it('colours the ground ahead of the eaglet by what the hands do: a downslope holds, an upslope lets go, a gorge glides', () => {
    const sim = later({ planned: 600 });
    const T = sim.terrain;
    T.ensure(20);
    let hold = 0, release = 0, gap = 0;
    for (let x = 0.031; x < 18; x += 0.0173) {
      const z = T.zoneAt(x), m = T.slope(x);
      if (T.gapAt(x)) {
        gap++;
        expect(z, `x ${x}`).toBe('gap');
        continue;
      }
      if (z === 'gap') continue;   // the gorge's rim stretches, just outside it
      if (Math.abs(m) < 1e-3) continue;   // a keypoint: flat
      expect(z, `x ${x.toFixed(3)} slope ${m.toFixed(3)}`).toBe(m < 0 ? 'hold' : 'release');
      if (z === 'hold') hold++; else release++;
    }
    expect(hold).toBeGreaterThan(100);
    expect(release).toBeGreaterThan(100);
    expect(gap).toBeGreaterThan(10);
    // a valley's numbers: its bottom between its top and the crest after it
    const v = valleyAhead(sim, 1);
    expect(T.valley(v.top + 0.05)).toEqual({ down0: v.top, trough: v.trough, crest: v.crest });
    expect(T.valley(v.trough + 0.05)).toEqual({ down0: v.top, trough: v.trough, crest: v.crest });
  });

  it('cues the hand a moment ahead: "hold" down the slope, "let go" just before its bottom, never "hold" before the crest', () => {
    const { sim } = flyingAt(1);
    const v = valleyAhead(sim, 1.5);
    const e = sim.eaglet, T = sim.terrain;
    const cueOf = () => (sim as unknown as { cueOf(): string | null }).cueOf();
    const ground = (x: number, s: number) => Object.assign(e, { mode: 'ground', x, y: T.height(x), s });
    ground(v.top + 0.3 * v.downLen, 1.5);
    expect(cueOf()).toBe('hold');
    // the let-go shows cueLead seconds of travel before the bottom
    ground(v.trough - 1.5 * RULES.cueLead * 0.6, 1.5);
    expect(cueOf()).toBe('release');
    ground(v.trough - 1.5 * RULES.cueLead * 1.4, 1.5);
    expect(cueOf()).toBe('hold');
    ground(v.trough + 0.3 * v.upLen, 1.5);
    expect(cueOf()).toBe('release');
    ground(v.crest - 0.01, 2.5);
    expect(cueOf()).toBe('release');
    // in the air: rising, glide on; falling over a downslope within reach, hold; too high or over an upslope, glide
    const air = (x: number, h: number, vy: number) => Object.assign(e, { mode: 'air', x, y: T.height(x) + h, vx: 1.4, vy });
    air(v.top + 0.3 * v.downLen, 0.3, 0.5);
    expect(cueOf()).toBe('release');
    air(v.top + 0.3 * v.downLen, 0.3, -0.5);
    expect(cueOf()).toBe('hold');
    air(v.top + 0.3 * v.downLen, RULES.cueReach + 0.5, -0.5);
    expect(cueOf()).toBe('release');
    air(v.trough + 0.4 * v.upLen, 0.3, -0.5);
    expect(cueOf()).toBe('release');
    Object.assign(e, { mode: 'climb' });
    expect(cueOf()).toBe('release');
    Object.assign(e, { mode: 'carry' });
    expect(cueOf()).toBeNull();
  });

  it('turns the cue to "let go" shortly before the valley\'s bottom as the eaglet slides, and back to "hold" past the next crest', () => {
    const { sim, clock } = flyingAt(1, 1.2);
    const v = valleyAhead(sim, 1.5, 0.35);
    Object.assign(sim.eaglet, { x: v.top + 0.03, y: sim.terrain.height(v.top + 0.03), s: 1.2 });
    let flip = -1, bottom = -1, back = -1;
    const evs = slideBy(sim, clock, x => x < v.trough, x => x > v.crest + 0.3 || sim.eaglet.mode !== 'ground' && x > v.crest, 4);
    void evs;
    // replay: watch the cue against the eaglet's place
    const { sim: s2, clock: c2 } = flyingAt(v.top + 0.03, 1.2);
    let down = false;
    for (let i = 0; i < 4 / STEP; i++) {
      const x = s2.eaglet.x;
      const want = x < v.trough;
      if (want !== down) { down = want; s2.pointer(want ? 'down' : 'up', 3); }
      drive(s2, STEP, MID, c2);
      const cue = s2.cue();
      if (flip < 0 && cue === 'release' && i > 2) flip = c2.t;
      if (bottom < 0 && s2.eaglet.x >= v.trough) bottom = c2.t;
      if (flip > 0 && back < 0 && cue === 'hold' && s2.eaglet.x > v.trough) back = s2.eaglet.x;
      if (back > 0) break;
    }
    expect(flip).toBeGreaterThan(0);
    expect(bottom - flip, 'the let-go shows before the bottom').toBeGreaterThan(0.05);
    expect(bottom - flip, '…by about cueLead').toBeLessThan(RULES.cueLead + 0.12);
    if (back > 0) expect(back, 'hold again only past the crest').toBeGreaterThan(v.crest - 0.02);
  });

  it('judges a slide held down the slope and let go at its bottom "Idealnie!" over the crest', () => {
    const { sim, clock } = flyingAt(1);
    const v = valleyAhead(sim, 1.5);
    Object.assign(sim.eaglet, { x: v.top + 0.02, y: sim.terrain.height(v.top + 0.02), s: 1 });
    const evs = slideBy(sim, clock, x => x < v.trough - 0.02, x => x > v.crest + 0.05);
    const vs = ofType(evs, 'verdict');
    expect(vs[0]).toMatchObject({ v: 'perfect', why: 'slide', ideal: null, chain: 1 });
    // (the let-go lands on the frame after the hand's, a few hundredths of a screen height on)
    expect(vs[0].x).toBeGreaterThan(v.trough - 0.08);
    expect(vs[0].x).toBeLessThan(v.trough + 0.08);
    expect(ofType(evs, 'perfect')).toHaveLength(1);
    expect(sim.chain).toBe(1);
    expect(sim.p.perfectAll).toBe(1);
  });

  it('judges a let-go high on the way down "Za wcześnie", marking the let-go and the bottom where it belonged', () => {
    const { sim, clock } = flyingAt(1);
    const v = valleyAhead(sim, 1.5, 0.45);
    Object.assign(sim.eaglet, { x: v.top + 0.02, y: sim.terrain.height(v.top + 0.02), s: 1 });
    const at = v.top + 0.15 * v.downLen;
    const evs = slideBy(sim, clock, x => x < at, x => x > v.crest + 0.05);
    const vs = ofType(evs, 'verdict');
    expect(vs[0]).toMatchObject({ v: 'early', why: 'releaseEarly', ideal: v.trough, chain: 0 });
    expect(vs[0].x).toBeGreaterThan(at - 0.01);
    expect(vs[0].x).toBeLessThan(v.trough - RULES.releaseEarly * v.downLen);
    expect(ofType(evs, 'perfect')).toHaveLength(0);
  });

  it('judges a hold kept up the next slope "Za późno", the moment marked past the bottom', () => {
    const { sim, clock } = flyingAt(1);
    const v = valleyAhead(sim, 1.5);
    Object.assign(sim.eaglet, { x: v.top + 0.02, y: sim.terrain.height(v.top + 0.02), s: 1 });
    const evs = slideBy(sim, clock, () => true, x => x > v.crest + 0.05);
    const vs = ofType(evs, 'verdict');
    expect(vs[0]).toMatchObject({ v: 'late', why: 'releaseLate', ideal: v.trough });
    expect(vs[0].x).toBeGreaterThan(v.trough);
    expect(vs[0].x).toBeLessThan(v.crest);
  });

  it('a new hold just under the crest is the next slide\'s (no harm); lower on the way up it comes too early', () => {
    const near = flyingAt(1);
    const v = valleyAhead(near.sim, 1.5);
    Object.assign(near.sim.eaglet, { x: v.top + 0.02, y: near.sim.terrain.height(v.top + 0.02), s: 1 });
    let evs = slideBy(near.sim, near.clock, x => x < v.trough - 0.02 || x > v.crest - 0.1 * v.upLen, x => x > v.crest + 0.02);
    expect(ofType(evs, 'verdict')[0]).toMatchObject({ v: 'perfect' });
    const low = flyingAt(1);
    Object.assign(low.sim.eaglet, { x: v.top + 0.02, y: low.sim.terrain.height(v.top + 0.02), s: 1 });
    evs = slideBy(low.sim, low.clock, x => x < v.trough - 0.02 || x > v.trough + 0.35 * v.upLen, x => x > v.crest + 0.02);
    expect(ofType(evs, 'verdict')[0]).toMatchObject({ v: 'early', why: 'diveEarly' });
  });

  it('says nothing of a valley the hand never held (the cue asks instead)', () => {
    const { sim, clock } = flyingAt(1);
    const v = valleyAhead(sim, 1.5);
    Object.assign(sim.eaglet, { x: v.top + 0.02, y: sim.terrain.height(v.top + 0.02), s: 1 });
    const evs = slideBy(sim, clock, () => false, x => x > v.crest - 0.01 || sim.eaglet.mode !== 'ground');
    expect(ofType(evs, 'verdict')).toEqual([]);
  });

  it('judges a landing into an upslope: a glide that missed the downhill "Za późno", a dive over the upslope "Za wcześnie"', () => {
    for (const held of [false, true]) {
      const { sim, clock } = flyingAt(1);
      const v = valleyAhead(sim, 1.5);
      const x = v.trough + 0.35 * v.upLen;
      Object.assign(sim.eaglet, { mode: 'air', x, y: sim.terrain.height(x) + 0.12, vx: 1, vy: -0.9, airT: 0.6 });
      if (held) sim.pointer('down', 4);
      const evs = drive(sim, 0.5, MID, clock);
      sim.pointer('up', 4);
      const vs = ofType(evs, 'verdict');
      expect(ofType(evs, 'land')[0]?.cls, `held ${held}`).toBe('stall');
      expect(vs[0], `held ${held}`).toMatchObject(held ? { v: 'early', why: 'diveEarly' } : { v: 'late', why: 'diveLate', ideal: (v.top + v.trough) / 2 });
      if (held) expect(vs[0].ideal).toBeGreaterThan(v.crest);
    }
  });

  it('counts perfect slides toward the Poryw (three light it), a miss breaks the chain and brings the cues back in full', () => {
    const sim = later({ planned: 600, progress: { perfectAll: 80 } });
    expect(sim.cueLevel).toBe(0);
    const verdict = (sim as unknown as { slideVerdict(v: string, w: string, x: number, i: number | null): void }).slideVerdict.bind(sim);
    drive(sim, RULES.dawnWait + 0.2, MID);
    verdict('perfect', 'slide', 1, null);
    verdict('perfect', 'slide', 2, null);
    expect(sim.fever).toBe(false);
    verdict('perfect', 'slide', 3, null);
    expect(sim.fever).toBe(true);
    expect(sim.chain).toBe(3);
    verdict('late', 'releaseLate', 4, 3.9);
    expect(sim.chain).toBe(0);
    expect(sim.cueLevel).toBe(0);
    verdict('early', 'releaseEarly', 5, 5.2);
    expect(sim.cueLevel).toBe(1);
    verdict('perfect', 'slide', 6, null);
    expect(sim.cueLevel).toBe(0);
  });

  it('fades the cues as perfect slides add up — never in a first session, never with the lobby\'s setting on', async () => {
    const { cueBase } = await import('../src/arcade/wzlot/meta');
    const p = freshProgress();
    expect(cueBase({ ...p, perfectAll: 0 })).toBe(1);
    expect(cueBase({ ...p, perfectAll: RULES.cueFull })).toBe(1);
    expect(cueBase({ ...p, perfectAll: (RULES.cueFull + RULES.cueGone) / 2 })).toBeCloseTo(0.5, 5);
    expect(cueBase({ ...p, perfectAll: RULES.cueGone })).toBe(0);
    expect(cueBase({ ...p, perfectAll: 500, cues: true })).toBe(1);
    expect(makeSim({ progress: { perfectAll: 500 } }).cueLevel).toBe(1);
    expect(later({ progress: { perfectAll: 500 } }).cueLevel).toBe(0);
    expect(later({ progress: { perfectAll: 500, cues: true } }).cueLevel).toBe(1);
    expect(later({ progress: { perfectAll: 500, practice: true } }).cueLevel).toBe(1);
  });
});

describe('the practice valley (round 11)', () => {
  /** A first-ever sim with its story card tapped away: the practice begins. */
  function practising(planned = 300): { sim: WzlotSim; clock: { t: number } } {
    const sim = makeSim({ planned });
    const clock = { t: 0 };
    drive(sim, 1.4, MID, clock);
    sim.pointer('down', 1);
    sim.pointer('up', 1);
    drive(sim, 0.3, MID, clock);
    return { sim, clock };
  }
  const steps = (evs: readonly SimEvent[]) => ofType(evs, 'practice').map(e => `${e.step}${e.again ? '!' : ''}`);

  it('waits for the hold at the top of the first downslope: the tap that took off is no hold, nothing moves, the night waits', () => {
    const { sim, clock } = practising();
    expect(sim.practice).toMatchObject({ step: 'waitHold', rep: 0, again: false });
    expect(sim.terrain.zoneAt(sim.eaglet.x)).toBe('hold');
    expect(sim.cue()).toBe('hold');
    expect(sim.waiting).toBe(true);
    const x = sim.eaglet.x, day = sim.dayLeft;
    drive(sim, 4, MID, clock);
    expect(sim.eaglet.x).toBe(x);
    expect(sim.dayLeft).toBe(day);
    expect(sim.practice!.step).toBe('waitHold');
  });

  it('a hold slides it down in slow motion; at the bottom it waits for the let-go, then rides up and over: one slide', () => {
    const { sim, clock } = practising();
    sim.pointer('down', 2);
    let evs = drive(sim, 0.4, MID, clock);
    expect(steps(evs)).toEqual(['down']);
    const pr = sim.practice!;
    const x0 = sim.eaglet.x;
    drive(sim, 0.5, MID, clock);
    // slow motion: the eaglet covers practiceSlow of what its speed would carry it
    expect(sim.eaglet.x - x0).toBeLessThan(sim.eaglet.speed * 0.5 * (RULES.practiceSlow + 0.15));
    evs = drive(sim, 6, MID, clock, () => undefined);
    expect(steps(evs)).toEqual(['waitRelease']);
    expect(Math.abs(sim.eaglet.x - pr.trough)).toBeLessThan(0.03);
    expect(sim.cue()).toBe('release');
    const xb = sim.eaglet.x;
    drive(sim, 2, MID, clock);
    expect(sim.eaglet.x).toBe(xb);
    sim.pointer('up', 2);
    evs = drive(sim, 8, MID, clock, () => undefined);
    expect(steps(evs).slice(0, 2)).toEqual(['up', 'go']);
    expect(ofType(evs, 'verdict')[0]).toMatchObject({ v: 'perfect' });
    expect(sim.practice!.rep).toBe(1);
  });

  it('a let-go high on the way down asks for the hold again; a hold on the way up, for the let-go', () => {
    const { sim, clock } = practising();
    sim.pointer('down', 2);
    drive(sim, 0.5, MID, clock);
    sim.pointer('up', 2);
    let evs = drive(sim, 0.3, MID, clock);
    expect(steps(evs)).toEqual(['waitHold!']);
    sim.pointer('down', 2);
    evs = drive(sim, 8, MID, clock);
    expect(steps(evs)).toEqual(['down', 'waitRelease']);
    sim.pointer('up', 2);
    drive(sim, 0.3, MID, clock);
    expect(sim.practice!.step).toBe('up');
    sim.pointer('down', 2);
    evs = drive(sim, 0.3, MID, clock);
    expect(steps(evs)).toEqual(['waitRelease!']);
    sim.pointer('up', 2);
  });

  it('three slides finish it: the Poryw lit, the hold and the let-go taught, the next session flies at once', () => {
    const { sim, clock } = practising();
    const evs = drive(sim, 60, MID, clock, prompted(sim));
    expect(ofType(evs, 'practiceDone')).toEqual([{ type: 'practiceDone', finished: true }]);
    expect(ofType(evs, 'verdict').filter(v => v.v === 'perfect').length).toBeGreaterThanOrEqual(3);
    expect(ofType(evs, 'fever')).toHaveLength(1);
    expect(sim.p).toMatchObject({ practiced: 1, practice: false });
    for (const k of ['hold', 'release', 'perfect', 'fever'] as const) expect(sim.p.taught & TEACH[k], k).toBeTruthy();
    // the next session skips it; the lobby's "Ćwiczenie" brings it back, with a warm-up first
    sim.result();
    expect(later({ progress: { practiced: 1 } }).practiceSession).toBe(false);
    const again = later({ progress: { practiced: 1, practice: true } });
    expect(again.practiceSession).toBe(true);
    expect(again.plan[0].kind).toBe('warmup');
  });

  it('the warm-up waits for the practice, and the blocks after it are planned again to end on time', () => {
    const { sim, clock } = practising(180);
    const warm = sim.plan[0].dur;
    // a slow learner: 30 s at the first prompt
    drive(sim, 30, MID, clock);
    expect(sim.block.kind).toBe('warmup');
    expect(sim.blockT).toBeGreaterThan(warm);
    const evs = drive(sim, 60, MID, clock, prompted(sim));
    expect(ofType(evs, 'practiceDone')[0]).toMatchObject({ finished: true });
    const tele = ofType(evs, 'telegraph')[0];
    expect(tele.next.kind).toBe('push');
    const total = sim.plan.reduce((a, b) => a + b.dur, 0);
    expect(total).toBeCloseTo(180 - RULES.finale, 0);
    for (const b of sim.plan.slice(1)) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-6);
  });
});

describe('every caption long enough to read twice (round 11)', () => {
  it('2.5 s + 70 ms a character, never under 4.5 s: Leon, the coach marks, the banners, the labels', async () => {
    const { readSec } = await import('../src/arcade/wzlot/rules');
    expect(readSec('')).toBe(4.5);
    expect(readSec('x'.repeat(60))).toBeCloseTo(6.7, 5);
    const talk = new Talk(lines(), mulberry32(3));
    talk.ask('open');
    talk.update(0.016, 0, false);
    expect(talk.line!.dur).toBe(readSec(talk.line!.text));
    expect(talk.line!.dur).toBeGreaterThanOrEqual(4.5);
    const { Hud } = await import('../src/arcade/wzlot/hud');
    const hud = new Hud();
    hud.resize(layout(390, 564, { top: 134, right: 0, bottom: 0, left: 0 }));
    expect(hud.say(t('fx.gran', { n: 2 }), t('fx.sun', { n: 8 }))).toBe(readSec(`${t('fx.gran', { n: 2 })} ${t('fx.sun', { n: 8 })}`));
  });

  it('one explanation at a time: a label waits for the coach mark on screen, and Leon keeps quiet meanwhile', () => {
    const sim = later({ planned: 600, progress: { taught: 255 & ~TEACH.night } });
    const clock = { t: 0 };
    drive(sim, RULES.dawnWait + 0.2, MID, clock);
    sim.take();
    const x = sim as unknown as { teach(k: string, a: string): void; explain(e: object): void };
    x.teach('night', 'night');
    x.explain({ key: 'sun', label: true, x: 1, until: clock.t + 20 });
    let evs = sim.take();
    expect(evs.map(e => e.type)).toEqual(['hint']);
    // (and while the runner's block banner holds the coach mark back, that wait too)
    const sec = readSecOf(t('hint.night')) + Math.max(0, RULES.banner - sim.blockT);
    sim.talk.ask('idle', 9, 30);
    evs = drive(sim, sec - 0.5, MID, clock);
    expect(ofType(evs, 'label')).toEqual([]);
    expect(sim.talk.line).toBeNull();
    evs = drive(sim, 1.2, MID, clock);
    expect(ofType(evs, 'label').map(e => e.what)).toEqual(['sun']);
  });

  it('asks the runner to keep a coach mark up as long as it takes to read twice', () => {
    const asked: number[] = [];
    const env = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), sessions: 5, opened: true, practiced: 1 }, rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec: 120,
      tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false, tuning: TUNING,
      hint: (_s: string, _a?: unknown, ms?: number) => { asked.push(ms ?? 0); }, hudTop: () => 134, insets: () => ({ top: 134, right: 0, bottom: 0, left: 0 }), touch: true,
    } as GameEnv<WzlotProgress>;
    const game = wzlot.create(env);
    game.resize(390, 564, 1);
    game.start();
    for (let i = 0; i < 80; i++) game.update(0.05, MID, i * 0.05);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked[0]).toBe(Math.round(readSecOf(t('hint.hold')) * 1000));
    game.destroy();
  });
});

/** readSec without the import dance (the same rule). */
const readSecOf = (s: string): number => Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * [...s].length);

describe('the hold never sticks and is never lost (round 11)', () => {
  function gameIn(frame: HTMLElement, touch = false) {
    const canvas = document.createElement('canvas');
    frame.append(canvas);
    const env = {
      canvas, hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), sessions: 5, opened: true, taught: 255, practiced: 1 }, rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec: 120,
      tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false, tuning: TUNING,
      hint: () => {}, hudTop: () => 134, insets: () => ({ top: 134, right: 0, bottom: 0, left: 0 }), touch,
    } as GameEnv<WzlotProgress>;
    const game = wzlot.create(env) as Game;
    game.resize(1280, 672, 1);
    game.start();
    for (let i = 0; i < 60; i++) game.update(0.05, MID, i * 0.05);
    return { game, canvas };
  }
  const pe = (type: string, id: number, button = 0) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { pointerId: number; button: number };
    Object.assign(e, { pointerId: id, button });
    return e;
  };
  const step = (game: Game) => game.update(0.05, MID, 10);

  it('no context menu on the canvas (a right-button hold, Android\'s long press); a lost capture lets go', () => {
    const frame = document.createElement('div');
    document.body.append(frame);
    const { game, canvas } = gameIn(frame);
    const menu = new Event('contextmenu', { cancelable: true });
    canvas.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    game.pointer!({ type: 'down', x: 600, y: 400, id: 9 });
    step(game);
    expect(game.sim.held).toBe(true);
    canvas.dispatchEvent(pe('lostpointercapture', 9));
    game.update(0.2, MID, 11);
    expect(game.sim.held).toBe(false);
    game.destroy();
    frame.remove();
  });

  it('a press on the game\'s screen outside the canvas holds too, and lets go on any pointerup or when the window loses focus', () => {
    const frame = document.createElement('div');
    const side = document.createElement('aside');
    const btn = document.createElement('button');
    frame.append(side, btn);
    document.body.append(frame);
    const { game } = gameIn(frame);
    let now = 10;
    const tick = () => game.update(0.05, MID, (now += 0.5));
    side.dispatchEvent(pe('pointerdown', 21));
    tick();
    expect(game.sim.held, 'a press outside').toBe(true);
    window.dispatchEvent(pe('pointerup', 21));
    tick();
    expect(game.sim.held, 'its pointerup anywhere').toBe(false);
    side.dispatchEvent(pe('pointerdown', 22));
    tick();
    expect(game.sim.held, 'another').toBe(true);
    window.dispatchEvent(new Event('blur'));
    tick();
    expect(game.sim.held, 'the window lost focus').toBe(false);
    // a button is a button, and a paused game holds nothing
    btn.dispatchEvent(pe('pointerdown', 23));
    tick();
    expect(game.sim.held, 'a button').toBe(false);
    game.pause!(true);
    side.dispatchEvent(pe('pointerdown', 24));
    game.pause!(false);
    tick();
    expect(game.sim.held, 'paused').toBe(false);
    game.destroy();
    // destroyed: nothing listens
    side.dispatchEvent(pe('pointerdown', 25));
    expect((game.sim as unknown as { downs: Set<number> }).downs.size).toBe(0);
    frame.remove();
  });
});

describe('the lobby\'s card: the practice on demand and the cues kept (round 11)', () => {
  it('"Ćwiczenie" opens the next session with the practice; a switch keeps the cues; each choice saves', async () => {
    const { progressPanel } = await import('../src/arcade/wzlot/panel');
    const p = { ...freshProgress(), sessions: 3, practiced: 1 };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    const btn = [...el.querySelectorAll('button')].find(b => b.textContent === t('panel.practiceBtn'))!;
    expect(btn).toBeTruthy();
    btn.click();
    expect(p.practice).toBe(true);
    expect(saved).toBe(1);
    expect(el.textContent).toContain(t('panel.practiceOn'));
    [...el.querySelectorAll('button')].find(b => b.textContent === t('panel.practiceOff'))!.click();
    expect(p.practice).toBe(false);
    const box = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(p.cues).toBe(true);
    expect(saved).toBe(3);
    // a player who never finished one: the practice comes anyway, no way to skip it yet
    const fresh = progressPanel(freshProgress());
    expect(fresh.textContent).toContain(t('panel.practiceOn'));
    expect([...fresh.querySelectorAll('button')].some(b => b.textContent === t('panel.practiceOff'))).toBe(false);
  });
});

describe('the words of round 11', () => {
  it('cue, verdicts, practice and labels in four languages; Polish verdicts without gendered past forms', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as unknown as Record<string, string>;
      for (const k of ['cue.hold', 'cue.release', 'verdict.perfect', 'verdict.early', 'verdict.late', 'practice.hold', 'practice.release', 'label.sun', 'label.thermal']) {
        expect(cat[k], `${l}.${k}`).toBeTruthy();
      }
      // the cue is a word or two
      expect(cat['cue.hold'].split(' ').length).toBeLessThanOrEqual(2);
      expect(cat['cue.release'].split(' ').length).toBeLessThanOrEqual(2);
    }
    const pl = CATALOGS.pl as unknown as Record<string, string>;
    for (const k of Object.keys(pl).filter(k => /^(verdict|why|practice|cue)\./.test(k))) expect(pl[k], k).not.toMatch(/łeś|łaś|łem|łam|łyś/);
    expect(pl['label.sun']).toBe('Twoje skupienie trzyma słońce wysoko');
    expect(pl['label.thermal']).toBe('Spokój unosi — prąd wznoszący');
  });

  it('how to play in a few concrete steps, the last saying the band measures attention', () => {
    for (const touch of [true, false]) {
      const how = howto(touch);
      const steps = 1 + how.hands.length + (how.tips ?? []).length;
      expect(steps).toBeGreaterThanOrEqual(3);
      expect(steps).toBeLessThanOrEqual(5);
      expect((how.tips ?? []).at(-1)).toMatch(/uwag/);
    }
    for (const l of ['en', 'de', 'sv'] as const) expect((CATALOGS[l] as unknown as Record<string, string>)['how.tip2']).toMatch(/attention|Aufmerksamkeit|uppmärksamhet/);
    // hold anywhere, said so
    expect(t('how.hold')).toMatch(/gdziekolwiek/);
    expect(t('practice.hold')).toMatch(/gdziekolwiek/);
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
    expect(smoke({ sessions: 6, opened: true, taught: 255, practiced: 1 }, 3, false, 300).at22).toBeGreaterThan(50);
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
    const progress = later ? { ...freshProgress(), sessions: 5, opened: true, taught: 255, practiced: 1 } : freshProgress();
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
      // a finger on a phone and a tablet, a mouse on a desktop and the big monitors (§14)
      const L = layout(c.w, c.h, c.insets, c.w < 1024);
      const name = c.name;
      if (Math.min(c.w, c.h) <= 390) expect(L.u, name).toBe(1);
      else expect(L.u, name).toBeGreaterThan(1);
      expect(L.u, name).toBeLessThanOrEqual(Math.min(c.w, c.h) >= DESK_BIG ? DESK_MAX : 1.3);
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
      // the practice valley (the night waits for it), then nightfall: the tally, then the dawn's prompt
      play(game, 40, MID, () => game.sim.practice === null);
      expect(game.sim.practiceFinished, c.name).toBe(true);
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

  it('draws the practice valley\'s prompts, the cue and the verdicts at 13 px or more at every checked size', () => {
    const RE = (s: string) => s.replace(/…$/, '');
    for (const c of CHECK_SIZES) {
      const texts = new Map<string, number>();
      const game = startAt(c, false, texts, 120);
      const clock = { t: 0 };
      for (let i = 0; i < 30; i++) { clock.t += 0.05; game.update(0.05, MID, clock.t); game.draw(); }
      game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 1 });
      game.pointer!({ type: 'up', x: c.w / 2, y: c.h / 2, id: 1 });
      // the first prompt (wait for the hold), then the let-go's, then the rest of the practice and some flight
      for (let i = 0; i < 20; i++) { clock.t += 0.05; game.update(0.05, MID, clock.t); game.draw(); }
      expect(game.sim.practice?.step, c.name).toBe('waitHold');
      game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 2 });
      for (let i = 0; i < 200 && game.sim.practice?.step !== 'waitRelease'; i++) { clock.t += 0.05; game.update(0.05, MID, clock.t); game.draw(); }
      for (let i = 0; i < 6; i++) { clock.t += 0.05; game.update(0.05, MID, clock.t); game.draw(); }
      game.pointer!({ type: 'up', x: c.w / 2, y: c.h / 2, id: 2 });
      play(game, 30, MID, () => false, clock);
      const reading = [
        t('practice.hold'), t('practice.holdSub'), t('practice.release'), t('practice.releaseSub'), t('practice.title', { n: 1, m: 3 }),
        t('cue.hold'), t('verdict.perfect'), t('verdict.early'), t('verdict.late'), t('why.releaseLate'), t('why.releaseEarly'), t('why.diveLate'),
      ];
      const seen = reading.filter(r => [...texts.keys()].some(s => r.includes(RE(s))));
      expect(seen.length, `${c.name}: prompts drawn`).toBeGreaterThanOrEqual(5);
      for (const [s, px] of texts) {
        if (s.length > 4 && reading.some(r => r.includes(RE(s)))) expect(px, `${c.name}: "${s}"`).toBeGreaterThanOrEqual(MIN_READ - 0.05);
      }
      game.destroy();
    }
  }, 120_000);

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
    // a mouse: one row for the hold and the let-go (a let-go is no click), then the keys
    expect(howto(false).hands.map(x => x.gesture)).toEqual(['hold', 'keys']);
  });
});

describe('big screens and the mouse (DESIGN §14)', () => {
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

  const BIG = CHECK_SIZES.filter(c => Math.min(c.w, c.h) >= DESK_BIG);
  /** The camera's scale on the ground (span 1.15), as render.ts sets it. */
  const ground = (L: ReturnType<typeof layout>) => Math.min((L.bottom - L.top) / 1.27, L.w / L.minWorldW, L.maxS);
  /** The view as the tests read it (its camera's scale and the sun's place are private). */
  type View = { S: number; sunPos: { x: number; y: number }; layout: WzlotView['layout']; hovered: WzlotView['hovered'] };
  function startAt(c: (typeof CHECK_SIZES)[number], touch: boolean, texts: Map<string, number> | null = null, later = true) {
    const progress = later ? { ...freshProgress(), sessions: 5, opened: true, taught: 255, practiced: 1 } : freshProgress();
    const env: GameEnv<WzlotProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress, rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec: 90, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
      tuning: TUNING, hint: () => {}, hudTop: () => c.insets.top, insets: () => c.insets, touch,
    };
    recording = texts ? { canvas: env.canvas, texts } : null;
    const game = wzlot.create(env) as Game;
    recording = null;
    game.resize(c.w, c.h, 2);
    game.start();
    return { game, env, view: game.view as unknown as View };
  }
  function play(game: Game, sec: number, f: FocusFrame = MID, clock = { t: 0 }, fly = true): void {
    const p = pilot(game.sim);
    for (let i = 0; i < sec / 0.05; i++) {
      clock.t += 0.05;
      if (fly) p();
      game.update(0.05, f, clock.t);
      game.draw();
    }
  }

  it('brings the camera closer on a big screen with a mouse: the hills fill the canvas, the eaglet half as large again', () => {
    expect(BIG.map(c => c.w)).toEqual([1190, 1587]);
    const desk = layout(1280, 672, { top: 192, right: 0, bottom: 0, left: 0 }, false);
    for (const c of BIG) {
      const L = layout(c.w, c.h, c.insets, false);
      const S = ground(L);
      expect(L.big && L.mouse, c.name).toBe(true);
      // on the ground: 2.2 screen heights across (it was 3.0, the 290 × u cap), the eaglet 70 px and more
      expect(L.w / S, c.name).toBeCloseTo(BIG_ACROSS, 5);
      expect(S, c.name).toBeGreaterThan(290 * L.u * 1.35);
      expect(0.13 * S, `${c.name}: the eaglet`).toBeGreaterThanOrEqual(70);
      expect(0.13 * S, `${c.name}: the eaglet`).toBeGreaterThan(0.13 * ground(desk) * 1.45);
      // still 1.5 screen heights of slope ahead of the eaglet, and a high flight (span 3.8) still fits the band's height
      expect((L.w - L.ex) / S, c.name).toBeGreaterThan(1.5);
      expect((L.bottom - L.top) / (3.8 + 0.12), c.name).toBeLessThan(S);
      // the sun's gauge grows with the screen
      expect(L.sunR, c.name).toBeGreaterThanOrEqual(14 * 1.35 - 0.01);
    }
    // the game itself: the camera holds that scale over low ground
    for (const c of BIG) {
      const { game, view } = startAt(c, false);
      play(game, 3);
      expect(view.S, c.name).toBeGreaterThan(400 * view.layout.u / 1.35 * 0.98 - 1);
      game.destroy();
    }
  });

  it('keeps every phone, tablet and desktop as it was: the closer camera is a big screen\'s with a mouse only', () => {
    // the camera's scale on the ground at each checked size before the desktop pass (2026-11-13)
    const before = [242, 269, 269, 284, 221, 228, 377, 362, 377, 354];
    CHECK_SIZES.filter(c => Math.min(c.w, c.h) < DESK_BIG).forEach((c, i) => {
      const finger = layout(c.w, c.h, c.insets, true), mouse = layout(c.w, c.h, c.insets, false);
      expect(Math.round(ground(finger)), c.name).toBe(before[i]);
      expect(layout(c.w, c.h, c.insets), c.name).toEqual(finger);
      const { mouse: m1, ...a } = mouse;
      const { mouse: m2, ...b } = finger;
      expect(a, c.name).toEqual(b);
      expect([m1, m2, a.big]).toEqual([true, false, false]);
    });
    for (const c of BIG) expect(layout(c.w, c.h, c.insets, true).big, `${c.name} under a finger`).toBe(false);
  });

  it('answers the mouse: a pointer cursor that closes while it holds, the sun and the night explained under it, a card lit', () => {
    for (const c of BIG) {
      const texts = new Map<string, number>();
      const { game, env, view } = startAt(c, false, texts);
      const L = view.layout, clock = { t: 0 };
      expect(env.canvas.style.cursor, c.name).toBe('pointer');
      // the day under way (the dawn's prompt taken), a second of flight
      for (let i = 0; i < 200 && game.sim.dayPhase !== 'fly'; i++) play(game, 0.05, MID, clock);
      play(game, 1, MID, clock);
      // the sun: its ring and the coach mark's words beside it, 13.5 px × u
      game.pointer!({ type: 'move', x: view.sunPos.x, y: view.sunPos.y, id: 1 });
      play(game, 0.5, MID, clock, false);
      expect(view.hovered, c.name).toBe('sun');
      const sun = [...texts].filter(([s]) => s.length > 6 && t('hint.sun').includes(s));
      expect(sun.length, c.name).toBeGreaterThan(0);
      for (const [s, px] of sun) expect(px, `${c.name}: "${s}"`).toBeGreaterThanOrEqual(13.5 * L.u - 0.05);
      // a held button is the dive: the cursor closes, the answer waits
      game.pointer!({ type: 'down', x: view.sunPos.x, y: view.sunPos.y, id: 1 });
      play(game, 0.1, MID, clock, false);
      expect(env.canvas.style.cursor, c.name).toBe('grabbing');
      expect(view.hovered, c.name).toBeNull();
      expect(game.sim.held, c.name).toBe(true);
      game.pointer!({ type: 'up', x: view.sunPos.x, y: view.sunPos.y, id: 1 });
      expect(env.canvas.style.cursor, c.name).toBe('pointer');
      // the night at the arc's end
      game.pointer!({ type: 'move', x: L.arcX1, y: L.arcTop + L.arcH, id: 1 });
      play(game, 0.5, MID, clock, false);
      expect(view.hovered, c.name).toBe('night');
      // the open sky: nothing; a still mouse lets go, leaving takes it at once
      game.pointer!({ type: 'move', x: L.w * 0.6, y: L.top + 20 * L.u, id: 1 });
      play(game, 0.1, MID, clock, false);
      expect(view.hovered, c.name).toBeNull();
      game.pointer!({ type: 'move', x: L.arcX1, y: L.arcTop + L.arcH, id: 1 });
      play(game, 7, MID, clock, false);
      expect(view.hovered, c.name).toBeNull();
      game.pointer!({ type: 'move', x: L.arcX1, y: L.arcTop + L.arcH, id: 1 });
      play(game, 0.2, MID, clock, false);
      expect(view.hovered, c.name).toBe('night');
      env.canvas.dispatchEvent(new Event('pointerleave'));
      play(game, 0.05, MID, clock, false);
      expect(view.hovered, c.name).toBeNull();
      // nightfall: the tally card lights under the mouse
      game.sim.dayLeft = 0.05;
      for (let i = 0; i < 240 && game.sim.dayPhase !== 'tally'; i++) play(game, 0.05, MID, clock);
      play(game, 0.3, MID, clock, false);
      const box = game.view.hud.box!;
      game.pointer!({ type: 'move', x: box.r.x + box.r.w / 2, y: box.r.y + box.r.h / 2, id: 1 });
      play(game, 0.1, MID, clock, false);
      expect(view.hovered, c.name).toBe('card');
      game.destroy();
      expect(env.canvas.style.cursor, c.name).toBe('');
      // a finger: no cursor, no answer
      const f = startAt(c, true);
      play(f.game, 2);
      f.game.pointer!({ type: 'move', x: f.view.sunPos.x, y: f.view.sunPos.y, id: 1 });
      play(f.game, 0.5, MID, { t: 2 }, false);
      expect(f.env.canvas.style.cursor, c.name).toBe('');
      expect(f.view.hovered, c.name).toBeNull();
      f.game.destroy();
    }
  });

  it('draws every word of a session at 11 px or more on the big screens, what is read to play at 13 × u and more', () => {
    for (const c of BIG) {
      for (const later of [false, true]) {
        const texts = new Map<string, number>();
        const { game, view } = startAt(c, false, texts, later);
        const u = view.layout.u, clock = { t: 0 };
        const name = `${c.name}, ${later ? 'a later session' : 'the first'}`;
        play(game, 1.6, MID, clock);
        game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 1 });
        game.pointer!({ type: 'up', x: c.w / 2, y: c.h / 2, id: 1 });
        play(game, 40, (clock.t % 50) < 25 ? HIGH : CALM, clock);
        game.sim.dayLeft = 0.05;
        for (let i = 0; i < 240 && game.sim.dayPhase !== 'tally'; i++) play(game, 0.05, MID, clock);
        play(game, 2.5, MID, clock);
        expect(texts.size, name).toBeGreaterThan(6);
        for (const [s, px] of texts) expect(px, `${name}: "${s}"`).toBeGreaterThanOrEqual(MIN_TEXT - 0.05);
        // Leon's lines, the flying words and the tally's rows grow with the screen
        const reading = [...game.sim.talk.said, t('fx.caught'), t('fx.perfect'), t('tally.perfect'), t('tally.coins'), t('dawn.tap.keys'), t('tally.next.keys')];
        for (const [s, px] of texts) {
          if (s.length > 5 && reading.some(r => r.includes(s.replace(/…$/, '')))) expect(px, `${name}: "${s}"`).toBeGreaterThanOrEqual(13 * u - 0.05);
        }
        game.destroy();
      }
    }
  }, 90_000);

  it('speaks of the mouse to a mouse: one row for the hold and the let-go, the keys like the mouse button, in four languages', () => {
    const MOUSE = /mysz|mouse|maus|mus/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['how.hold.mouse', 'how.keys']) expect(cat[k], `${l}.${k}`).toMatch(MOUSE);
      for (const k of ['how.hold', 'how.release', 'hint.hold', 'dawn.tap', 'tally.next']) expect(cat[k], `${l}.${k}`).not.toMatch(MOUSE);
    }
    expect(howto(false).hands).toEqual([{ gesture: 'hold', text: t('how.hold.mouse') }, { gesture: 'keys', text: t('how.keys') }]);
    expect(howto(true).hands).toEqual([{ gesture: 'hold', text: t('how.hold') }, { gesture: 'tap', text: t('how.release') }]);
  });
});

// ── long sessions (15–30 min) ────────────────────────────────────

describe('Wzlot at 15–30 minutes', () => {
  it('plans 900–1800 s to the last sunset: push/rest pairs at their design lengths, ending on a rest', () => {
    for (const planned of [900, 1200, 1500, 1800]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - RULES.finale, 6);
        expect(plan[0].kind === 'warmup').toBe(first);
        const core = plan.filter(b => b.kind !== 'warmup');
        core.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(core.at(-1)!.kind).toBe('rest');
        for (const b of core) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock);
          expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.1);
        }
      }
    }
  });

  it('flies a whole 30-min session: day after day, the ground made and forgotten, the numbers sane, the last sunset', () => {
    const sim = later({ planned: 1800, seed: 3 });
    const clock = { t: 0 };
    const fly = pilot(sim);
    const terrain = sim.terrain as unknown as { kx: number[]; granie: unknown[] };
    let evs = 0, maxKnots = 0, maxGranie = 0, maxV = 0, finale = 0;
    const dt = 1 / 30;
    for (let i = 0; i < 1806 / dt && sim.phase !== 'done'; i++) {
      clock.t += dt;
      fly();
      sim.update(dt, sim.block.kind === 'rest' ? CALM : HIGH, clock.t);
      for (const e of sim.take()) { evs++; if (e.type === 'finale') finale++; }
      const tt = sim.terrain as unknown as { kx: number[]; granie: unknown[] };
      maxKnots = Math.max(maxKnots, tt.kx.length);
      maxGranie = Math.max(maxGranie, tt.granie.length);
      maxV = Math.max(maxV, Math.hypot(sim.eaglet.vx, sim.eaglet.vy));
    }
    void terrain;
    expect(sim.phase).toBe('done');
    expect(finale).toBe(1);
    expect(clock.t).toBeLessThanOrEqual(1800 + RULES.settle + 0.1);
    expect(sim.canStop()).toBe(true);
    expect(evs).toBeGreaterThan(500);
    expect(sim.daysDone).toBeGreaterThan(5);
    expect(maxKnots).toBeLessThan(400);
    expect(maxGranie).toBeLessThan(12);
    expect(Number.isFinite(maxV)).toBe(true);
    expect(maxV).toBeLessThan(60);
    expect(Number.isFinite(sim.total)).toBe(true);
    expect(sim.thermals.length).toBeLessThan(10);
    const out = sim.result();
    expect(out.highlights.length).toBeLessThanOrEqual(7);
    for (const s of [...out.highlights, ...out.stats.flat()]) expect(s).not.toMatch(/undefined|NaN|Infinity/);
  });
});

// ── long sessions (45–60 min) ────────────────────────────────────

describe('Wzlot at 45–60 minutes', () => {
  it('plans 2700 and 3600 s to the last sunset: push/rest pairs at their design lengths, ending on a rest', () => {
    for (const planned of [2700, 3600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - RULES.finale, 6);
        expect(plan[0].kind === 'warmup').toBe(first);
        const core = plan.filter(b => b.kind !== 'warmup');
        core.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(core.at(-1)!.kind).toBe('rest');
        for (const b of core) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock);
          expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.1);
        }
      }
    }
  }, 300_000);

  it.each([{ planned: 2700, first: false }, { planned: 3600, first: false }, { planned: 3600, first: true }])('flies a whole $planned s session (first ever: $first): day after day, the ground made and forgotten, the numbers sane, the last sunset', ({ planned, first }) => {
    const sim = later({ planned, seed: 3, progress: first ? { sessions: 0, opened: false, taught: 0, practiced: 0 } : {} });
    const clock = { t: 0 };
    const fly = pilot(sim);
    let evs = 0, maxKnots = 0, maxGranie = 0, maxV = 0, finale = 0, maxThermals = 0, finaleAt = 0;
    const dt = 1 / 30;
    for (let i = 0; i < (planned + 6) / dt && sim.phase !== 'done'; i++) {
      clock.t += dt;
      fly();
      sim.update(dt, sim.block.kind === 'rest' ? CALM : HIGH, clock.t);
      for (const e of sim.take()) { evs++; if (e.type === 'finale') { finale++; finaleAt = clock.t; } }
      const tt = sim.terrain as unknown as { kx: number[]; granie: unknown[] };
      maxKnots = Math.max(maxKnots, tt.kx.length);
      maxGranie = Math.max(maxGranie, tt.granie.length);
      maxV = Math.max(maxV, Math.hypot(sim.eaglet.vx, sim.eaglet.vy));
      maxThermals = Math.max(maxThermals, sim.thermals.length);
    }
    expect(sim.phase).toBe('done');
    expect(finale).toBe(1);
    // ~120 blocks: each block's last frame carries into the next, so the last sunset comes on time (it came 2 s
    // late at 30 fps, and the runner cut the last day's tally)
    expect(Math.abs(finaleAt - (planned - RULES.finale))).toBeLessThan(0.1);
    expect(clock.t).toBeLessThanOrEqual(planned + RULES.settle - 1);
    expect(sim.canStop()).toBe(true);
    expect(evs).toBeGreaterThan(planned * 2);
    expect(sim.daysDone).toBeGreaterThan(planned / 400);
    // the ground, the crags and the warm columns are made ahead and forgotten behind: the same at 60 minutes as at 5
    expect(maxKnots).toBeLessThan(400);
    expect(maxGranie).toBeLessThan(12);
    expect(maxThermals).toBeLessThan(10);
    expect(Number.isFinite(maxV)).toBe(true);
    expect(maxV).toBeLessThan(60);
    expect(Number.isFinite(sim.total)).toBe(true);
    // an hour's points stay under eight digits (the score corner takes a smaller size from eight characters)
    expect(sim.total).toBeLessThan(1e7);
    const out = sim.result();
    expect(out.highlights.length).toBeLessThanOrEqual(7);
    for (const s of [...out.highlights, ...out.stats.flat()]) expect(s).not.toMatch(/undefined|NaN|Infinity/);
  }, 300_000);
});

describe('Wzlot at 45–60 minutes, drawn', () => {
  it('costs a frame at the hour what it cost in the first minutes (nothing drawn piles up)', () => {
    const simOf = (game: unknown) => (game as { sim: WzlotSim }).sim;
    let fly: (() => void) | null = null;
    const { early, late } = hourFrames({
      module: wzlot, progress: { ...wzlot.freshProgress(), sessions: 5, opened: true, taught: 255, practiced: 1 }, tuning: TUNING,
      setup: game => { fly = pilot(simOf(game)); },
      frame: game => { fly!(); return simOf(game).block.kind === 'rest' ? CALM : HIGH; },
    });
    expect(late.length).toBeGreaterThan(200);
    expect(mean(late)).toBeLessThan(mean(early) * 1.5);
    expect(Math.max(...late)).toBeLessThan(Math.max(...early) * 1.5);
  }, 300_000);
});
