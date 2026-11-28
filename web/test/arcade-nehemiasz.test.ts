import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CHRONICLE_SIZE, DECREE, DECREES, GATES, GATE_SEG, LINES, LINE_COUNT, MARKERS, MOMENTS, PERKS, ROUTE_IDS, SEGS, gateDays, gateFirstDay,
  markerSpec, routeAt, routeLen, tierCubits,
} from '../src/arcade/nehemiasz/content';
import { CATALOGS, t, unit } from '../src/arcade/nehemiasz/i18n';
import {
  affordablePerk, bestOf, buyPerk, freshProgress, heightOf, isOpen, jobs, maxHp, migrate, room, starsOf, stoneCap, type NehProgress,
} from '../src/arcade/nehemiasz/meta';
import { LEVELS, RULES } from '../src/arcade/nehemiasz/rules';
import { DIFFICULTIES, type Difficulty } from '../src/arcade/kit/difficulty';
import { difficultyName } from '../src/arcade/kit/difficultypanel';
import { ROUND_SEC } from '../src/arcade/nehemiasz/talk';
import { NehSim, finaleFor, fireReach, planBlocks, type SimEvent } from '../src/arcade/nehemiasz/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems, type Lang } from '../src/i18n';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets, screenKind, target } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets, TapTarget } from '../src/arcade/kit/types';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import nehemiasz from '../src/arcade/nehemiasz/index';
import { S_MIN, badgeFree, badgeOf, cameraFor, inside, layout, type Layout } from '../src/arcade/nehemiasz/layout';
import { font } from '../src/arcade/nehemiasz/paint';
import type { Choice, Story, StoryKind } from '../src/arcade/nehemiasz/sim';

const DAY = '2026-11-11';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.95 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<NehProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): NehSim {
  const p = migrate(mergeSaved(freshProgress(), { ...freshProgress(), ...o.progress }));
  const sim = new NehSim({
    progress: p, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, every coach mark seen). */
const SEEN = ['move', 'guide', 'build', 'front', 'preview', 'night', 'light', 'horn', 'day', 'decree', 'breach', 'bread', 'choice', 'ono'];
/** (mid-gate: day 2 of the Sheep Gate, so no gate card holds the world at the start) */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, gateDay: 1, day: 1, seen: SEEN, cards: ['horn', 'ono'], ...o.progress } });

function drive(sim: NehSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Close any card in the way (a reader who taps through). */
const through = (sim: NehSim) => () => {
  if (sim.story && sim.story.t >= RULES.minCard) sim.tap();
  if (sim.choice && sim.choice.t >= 0.3) sim.pick(0);
};

/** Drive to the start of the next block of a kind. */
function toBlock(sim: NehSim, kind: 'push' | 'rest', f: FocusFrame = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  for (let guard = 0; guard < 4000 && !(sim.block.kind === kind && sim.blockT < 0.1 && sim.phase === 'play'); guard++) out.push(...drive(sim, STEP * 6, f, clock, through(sim)));
  return out;
}

describe('the block plan', () => {
  it('opens a first-ever session with the warm-up (the first morning) and alternates nights and days, ending on a night', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('push');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) {
        expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        const [mean, jitter] = b.kind === 'push' ? RULES.push : RULES.rest;
        expect(b.dur).toBeLessThanOrEqual((mean + jitter) * 1.1);
      }
    }
  });

  it('follows the rhythm the player set in the lobby: longer nights, shorter days, the jitter scaled; long nights bring their raiders', () => {
    for (const planned of [300, 1800]) {
      const plan = planBlocks(planned, false, mulberry32(5), { focus: 90, rest: 15 });
      const push = plan.filter(b => b.kind === 'push'), rest = plan.filter(b => b.kind === 'rest');
      const mean = (bs: typeof plan) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
      expect(mean(push) / mean(rest)).toBeGreaterThan(4);
      expect(mean(push)).toBeGreaterThan(70);
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
    // no rhythm: the designed one, the days under a third of the session
    const plan = planBlocks(600, false, mulberry32(5));
    const restShare = plan.filter(b => b.kind === 'rest').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(restShare).toBeGreaterThan(0.27);
    expect(restShare).toBeLessThan(0.4);
    // the sim takes the rhythm: a 2-minute night has more raiders, its last wave still before dawn; the wall still grows
    for (const rhythm of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }]) {
      const sim = new NehSim({
        progress: migrate(mergeSaved(freshProgress(), { ...freshProgress(), sessions: 5, pushes: 1, gateDay: 1, day: 1, seen: SEEN, cards: ['horn', 'ono'] })),
        rng: mulberry32(7), day: DAY, daySeed: 4242, plannedSec: 600, eeg: false, tuning: TUNING, rhythm,
      });
      sim.start();
      const nights = sim.plan.filter(b => b.kind === 'push');
      const night = nights.reduce((s, b) => s + b.dur, 0) / nights.length;
      expect(night).toBeGreaterThan(rhythm.focus * 0.75);
      expect(night).toBeLessThan(rhythm.focus * 1.25);
      let most = 0;
      drive(sim, 600 + RULES.settle, () => (sim.block?.kind === 'rest' ? CALM : HIGH), { t: 0 }, tt => {
        through(sim)();
        if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
        most = Math.max(most, sim.raiders.length);
      });
      expect(sim.phase).toBe('done');
      expect(sim.headlineValue).toBeGreaterThan(100);
      if (rhythm.focus > 60) expect(most).toBeGreaterThan(8);
      expect(most).toBeLessThan(60);
    }
  });

  it('opens a later session at dawn: day, night, day, night … ending on a night', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, false, mulberry32(5));
      plan.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'push' : 'rest'));
      expect(plan.at(-1)!.kind).toBe('push');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
    }
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('telegraphs the next block before it begins', () => {
    const sim = later({ planned: 300 });
    expect(sim.block.kind).toBe('rest');
    drive(sim, sim.block.dur - 2, frame(), { t: 0 }, through(sim));
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('push');
  });

  it('makes every 4th night moonless from the 3rd session, never the first night of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 8; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock, through(sim));
    }
    // nights counted 3, 4 …: the 4th overall (this session's 2nd night, block 3) is moonless
    expect(blinds[1]).toBe(false);
    expect(blinds[3]).toBe(true);
  });
});

describe('Nehemiah and the build', () => {
  it('walks where the stick points, at the walk speed, and never above the wall walk', () => {
    const sim = later();
    const x0 = sim.neh.x;
    sim.steer(1, 0);
    drive(sim, 1, frame(), { t: 0 }, through(sim));
    expect(sim.neh.x - x0).toBeGreaterThan(RULES.walk * 0.8);
    sim.steer(0, -1);
    drive(sim, 4, frame());
    expect(sim.neh.y).toBeGreaterThanOrEqual(RULES.walkTop - 1e-9);
  });

  it('walks with WASD and the arrows', () => {
    const sim = later();
    const y0 = sim.neh.y;
    sim.key('w', true);
    drive(sim, 0.5, frame(), { t: 0 }, through(sim));
    sim.key('w', false);
    expect(sim.neh.y).toBeLessThan(y0 - 1);
  });

  it('a tap on a marker walks there and builds it: the stones are paid and the level rises', () => {
    const sim = later({ progress: { stone: 40, timber: 20 } });
    drive(sim, 0.2, frame(), { t: 0 }, through(sim));
    const m = markerSpec('bakery')!;
    const stone = sim.p.stone;
    sim.tap({ x: m.x + 0.2, y: m.y });
    const evs = drive(sim, 4, frame());
    expect(ofType(evs, 'pay').some(e => e.id === 'bakery')).toBe(true);
    expect(ofType(evs, 'built').some(e => e.id === 'bakery')).toBe(true);
    expect(sim.p.city.bakery).toBe(1);
    expect(sim.p.stone).toBeLessThan(stone);
  });

  it('standing still on a marker builds it; walking away mid-build cancels and pays back', () => {
    const sim = later({ progress: { stone: 40, timber: 20 } });
    drive(sim, 0.2, frame(), { t: 0 }, through(sim));
    const m = markerSpec('well')!;
    sim.neh.x = m.x;
    sim.neh.y = m.y;
    const evs = drive(sim, 0.5, frame());
    expect(ofType(evs, 'pay').some(e => e.id === 'well')).toBe(true);
    const stone = sim.p.stone;
    sim.steer(1, 0);
    const evs2 = drive(sim, 0.5, frame());
    sim.steer(0, 0);
    expect(ofType(evs2, 'cancel')).toHaveLength(1);
    expect(sim.p.stone).toBeGreaterThan(stone);
    expect(sim.p.city.well).toBe(0);
  });

  it('a tap elsewhere (or Space) builds what the guide suggests; a tap never cancels a build in progress', () => {
    const sim = later({ progress: { stone: 30, timber: 12 } });
    drive(sim, 0.4, frame(), { t: 0 }, through(sim));
    expect(sim.guideId).not.toBeNull();
    const id = sim.guideId!;
    sim.key(' ', true);
    sim.key(' ', false);
    let builds = 0, cancels = 0;
    drive(sim, 6, frame(), { t: 0 }, tt => {
      if (Math.round(tt * 60) % 39 === 0) sim.tap({ x: 9, y: 7.2 });
      for (const e of sim.take()) { if (e.type === 'built') builds++; if (e.type === 'cancel') cancels++; }
    });
    expect(builds).toBeGreaterThanOrEqual(1);
    expect(cancels).toBe(0);
    expect(MARKERS.some(m => m.id === id)).toBe(true);
  });

  it('a tap on a marker that takes no build now (its tier still laid) leaves the tap to the guide', () => {
    const sim = later({ progress: { stone: 40, timber: 20 } });
    drive(sim, 0.4, frame(), { t: 0 }, through(sim));
    const gate = markerSpec('gate')!;
    sim.p.wall[GATE_SEG].tier = 1;
    expect(sim.nextLevel('gate')).toBeNull();
    const guide = sim.guideId;
    expect(guide).not.toBeNull();
    sim.tap({ x: gate.x, y: gate.y });
    expect(sim.neh.order ?? sim.neh.build?.id).toBe(guide);
  });

  it('a tap on a marker the stores cannot pay says what is missing and goes nowhere', () => {
    const sim = later({ progress: { stone: 0, timber: 0 } });
    drive(sim, 0.4, frame(), { t: 0 }, through(sim));
    const m = markerSpec('well')!;
    sim.p.stone = 0;
    sim.p.timber = 0;
    sim.tap({ x: m.x, y: m.y });
    expect(ofType(sim.take(), 'missing').some(e => e.id === 'well')).toBe(true);
    expect(sim.neh.order).toBeNull();
  });

  it('a tap on a build badge (phones) walks there and builds it, says what is missing, and does nothing by night', () => {
    const sim = later({ progress: { stone: 40, timber: 20 } });
    drive(sim, 0.2, frame(), { t: 0 }, through(sim));
    expect(sim.build('t1')).toBe(true);
    expect(sim.neh.order ?? sim.neh.build?.id).toBe('t1');
    const evs = drive(sim, 5, frame());
    expect(ofType(evs, 'built').some(e => e.id === 't1')).toBe(true);
    expect(sim.p.stretch.t1).toBe(1);
    // the stores cannot pay: it says what is missing and stays
    sim.p.stone = 0;
    sim.p.timber = 0;
    sim.build('bakery');
    expect(ofType(sim.take(), 'missing').some(e => e.id === 'bakery')).toBe(true);
    // a badge whose site takes no build now leaves the tap to the guide (here: nothing to pay for)
    sim.p.wall[GATE_SEG].tier = sim.p.wall[GATE_SEG].done + 1;
    expect(sim.nextLevel('gate')).toBeNull();
    sim.p.stone = 30;
    sim.p.timber = 12;
    drive(sim, 0.2, frame());
    const guide = sim.guideId;
    sim.build('gate');
    expect(sim.neh.order ?? sim.neh.build?.id ?? null).toBe(guide);
    // by night the badges are gone: build() refuses
    const night = later({ progress: { stone: 40, timber: 20 } });
    toBlock(night, 'push', frame(), { t: 0 });
    expect(night.build('bakery')).toBe(false);
  });

  it('the night\'s button sends Nehemiah where it is hottest and never blows the horn; a tap on a bubble hushes the line', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    drive(sim, 9, HIGH, clock, through(sim));
    sim.horn = 1;
    sim.hornReady = true;
    expect(sim.rush()).toBe(true);
    expect(sim.neh.goal).not.toBeNull();
    expect(sim.hornReady).toBe(true);
    expect(sim.horns).toBe(0);
    // by day it does nothing
    const day = later();
    expect(day.rush()).toBe(false);
    // the line on screen fades at once
    for (let i = 0; i < 600 && !day.talk.line; i++) drive(day, 0.1, frame(), clock, through(day));
    expect(day.talk.line).not.toBeNull();
    day.talk.hush();
    drive(day, 0.3, frame(), clock);
    expect(day.talk.line).toBeNull();
  });

  it('the governor\'s house caps the other buildings one level above it', () => {
    const sim = later({ progress: { stone: 200, timber: 200, city: { yard: 1, gov: 1, well: 2, bakery: 0, granary: 0, h0: 0, h1: 0, h2: 0, h3: 0 } } });
    expect(sim.nextLevel('well')).toBeNull();
    expect(sim.markerView('well').capped).toBe(true);
    sim.p.city.gov = 2;
    expect(sim.nextLevel('well')).toBe(3);
  });
});

describe('the working day (rest: calm = the builders\' rhythm)', () => {
  it('builders lay the ordered tier: the cubits (the headline) grow, the wall rises', () => {
    const sim = later();
    const before = sim.cubits;
    drive(sim, 10, frame(), { t: 0 }, through(sim));
    expect(sim.cubits).toBeGreaterThan(before + 5);
    expect(sim.headlineValue).toBe(Math.floor(sim.cubits + 1e-6));
    const h = heightOf(GATE_SEG - 1, sim.p.wall[GATE_SEG - 1]) + heightOf(GATE_SEG + 1, sim.p.wall[GATE_SEG + 1]);
    expect(h).toBeGreaterThan(0);
  });

  it('calm sets a faster rhythm than no signal (never slower than the base)', () => {
    const calm = later({ seed: 2 }), none = later({ seed: 2 });
    drive(calm, 18, CALM, { t: 0 }, through(calm));
    drive(none, 18, NONE, { t: 0 }, through(none));
    expect(calm.cubits).toBeGreaterThan(none.cubits * 1.4);
    expect(none.cubits).toBeGreaterThan(5);
  });

  it('mends a breach before laying new courses; mending is not counted as cubits', () => {
    const sim = later();
    const s = sim.p.wall[1];
    s.tier = 2; s.done = 2; s.prog = 0; s.hp = 0;
    const s3 = sim.p.wall[GATE_SEG - 1];
    const prog0 = s3.prog, cub0 = sim.cubits;
    drive(sim, 2, frame(), { t: 0 }, through(sim));
    expect(sim.p.wall[1].hp).toBeGreaterThan(0);
    expect(sim.mended).toBeGreaterThan(0);
    // all of the work went to mending: the front did not move yet
    expect(s3.prog).toBeCloseTo(prog0, 5);
    expect(sim.cubits).toBeCloseTo(cub0, 5);
  });

  it('a tier finishes at its cubits; the next tier must be ordered', () => {
    const sim = later();
    const i = GATE_SEG - 1;
    const evs = drive(sim, 60, CALM, { t: 0 }, through(sim));
    expect(ofType(evs, 'tier').some(e => e.seg === i || e.seg === GATE_SEG + 1)).toBe(true);
    expect(tierCubits(i, 1)).toBe(RULES.segCubits[1]);
    expect(tierCubits(i, 3)).toBeGreaterThan(tierCubits(i, 1));
  });
});

describe('the night watch (push: focus = the watch fires\' reach)', () => {
  it('the fires reach farther with the level in a sighted night past the lead-in; the base otherwise, never below it', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    const base = fireReach(1, 0);
    drive(sim, RULES.leadIn.fnirs - 1, HIGH, clock);
    expect(sim.fireR.f2).toBeCloseTo(base, 1);
    expect(sim.meter()).toBeNull();
    drive(sim, 4, HIGH, clock);
    expect(sim.fireR.f2).toBeGreaterThan(base + 1.5);
    expect(sim.meter()!).toBeGreaterThan(0.7);
    drive(sim, 3, NONE, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.fireR.f2).toBeGreaterThanOrEqual(base * (1 - 0.61) - 1e-9);
    expect(fireReach(1, 0.5)).toBeCloseTo(RULES.fireBase[1] + RULES.fireExtra[1] / 2, 5);
  });

  it('raiders come down the roads; struck, they lose heart and run (never die); a focused night drives more of them off', () => {
    const run = (f: FocusFrame) => {
      const sim = later({ seed: 7, progress: { stretch: { t0: 1, t1: 1, t2: 1, t3: 1, f0: 0, f1: 1, f2: 1, f3: 1, f4: 0, p0: 1, p1: 1, p2: 1 }, people: 24 } });
      const clock = { t: 0 };
      toBlock(sim, 'push', frame(), clock);
      const evs = drive(sim, sim.block.dur - 0.2, f, clock, through(sim));
      return { sim, evs };
    };
    const lit = run(HIGH), dark = run(NONE);
    expect(ofType(lit.evs, 'spawn').length).toBeGreaterThan(2);
    expect(ofType(lit.evs, 'driven').length).toBeGreaterThan(0);
    // in the light the towers strike them on the road, farther from the wall; in the dark only at its foot
    const meanY = (evs: SimEvent[]) => { const d = ofType(evs, 'driven'); return d.reduce((s, e) => s + e.y, 0) / Math.max(1, d.length); };
    expect(meanY(lit.evs)).toBeLessThan(meanY(dark.evs) - 0.4);
    expect(lit.sim.reached).toBeLessThanOrEqual(dark.sim.reached);
    // nobody is ever removed except by running off the top of the map
    for (const r of lit.sim.raiders) expect(r.courage).toBeGreaterThanOrEqual(-1e9);
  });

  it('towers and guards strike only what can be seen: in a fire\'s light, at the wall\'s foot, or by Tirza\'s lamp', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    expect(sim.seenAt(9, RULES.wallOut - 0.2)).toBe(true);
    expect(sim.seenAt(2, 0.5)).toBe(false);
    expect(sim.seenAt(sim.tirza.x, sim.tirza.y)).toBe(true);
  });

  it('the horn: charged by a held focus, blown by a tap where Nehemiah stands — every raider near him runs', () => {
    const sim = later({ seed: 3, progress: { people: 16 } });
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    let ready = false;
    drive(sim, sim.block.dur - 1, HIGH, clock, () => { if (sim.hornReady) ready = true; });
    expect(ready || sim.horns > 0).toBe(true);
    // set one up by hand: raiders around Nehemiah, the horn full
    const sim2 = later({ seed: 4 });
    const c2 = { t: 0 };
    toBlock(sim2, 'push', frame(), c2);
    drive(sim2, 9, frame(), c2);
    sim2.neh.x = 9;
    sim2.neh.y = 4.8;
    sim2.hornReady = true;
    sim2.horn = 1;
    const near = sim2.raiders.filter(r => r.state !== 'flee' && Math.hypot(r.x - 9, r.y - 4.8) <= RULES.hornR).length;
    sim2.tap();
    const evs = sim2.take();
    expect(ofType(evs, 'horn')).toHaveLength(1);
    expect(sim2.horns).toBe(1);
    expect(sim2.raiders.filter(r => r.state !== 'flee' && Math.hypot(r.x - 9, r.y - 4.8) <= RULES.hornR)).toHaveLength(0);
    expect(near).toBeGreaterThanOrEqual(0);
  });

  it('a raider who gets in steals a little; struck while carrying, he drops it and it is gathered back', () => {
    const sim = later({ seed: 9, progress: { stone: 30, bread: 30 } });
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    // all the stretch is rubble here: the raiders walk in
    sim.p.wall.forEach(s => { s.tier = 0; s.done = 0; s.prog = 0; s.hp = 0; });
    const evs = drive(sim, sim.block.dur - 0.2, NONE, clock);
    const grabbed = ofType(evs, 'grab').reduce((s, e) => s + e.n, 0);
    expect(grabbed).toBeGreaterThan(0);
    expect(grabbed).toBeLessThanOrEqual(Math.ceil(30 * RULES.lootCap) * 2 + RULES.loot * 2);
  });

  it('a night is a night: at dawn every raider left runs, and the night\'s report is given', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    const evs = drive(sim, sim.block.dur + 0.2, frame(), clock, through(sim));
    expect(ofType(evs, 'report')).toHaveLength(1);
    expect(sim.raiders.every(r => r.state === 'flee')).toBe(true);
  });
});

describe('the calendar: 52 days through ten gates', () => {
  it('the gates\' days add up to 52; each gate begins on its own day', () => {
    expect(RULES.gateDays.reduce((a, b) => a + b, 0)).toBe(52);
    expect(gateFirstDay(0)).toBe(1);
    expect(gateFirstDay(9) + gateDays(9) - 1).toBe(52);
  });

  it('every day block is a new day; after a gate\'s last day its stars are counted and the next gate begins; the city stays', () => {
    const sim = later({ planned: 600, progress: { gate: 0, gateDay: 4, day: 4, city: { yard: 1, gov: 1, well: 1, bakery: 1, granary: 0, h0: 1, h1: 0, h2: 0, h3: 0 } } });
    expect(sim.p.gateDay).toBe(5);
    expect(sim.p.day).toBe(5);
    const clock = { t: 0 };
    toBlock(sim, 'push', frame(), clock);
    const evs = toBlock(sim, 'rest', frame(), clock);
    expect(ofType(evs, 'gateDone')).toHaveLength(1);
    expect(sim.p.gate).toBe(1);
    expect(sim.p.gateDay).toBe(1);
    expect(sim.p.day).toBe(6);
    expect(sim.p.city.bakery).toBe(1);
    expect(sim.p.chronicle).toContain('gate:owcza');
    // the new stretch: rubble, the two sections by the gate ordered, its fire lit
    expect(sim.p.wall[GATE_SEG - 1].tier).toBe(1);
    expect(sim.p.stretch.f2).toBe(1);
  });

  it('after the last gate the wall is finished: the dedication, and year 2 begins at the Sheep Gate', () => {
    const sim = later({ planned: 300, progress: { gate: 9, gateDay: 5, day: 52 } });
    const evs = drive(sim, 1, frame());
    expect(ofType(evs, 'gateDone')).toHaveLength(1);
    expect(sim.wallDone).toBe(true);
    expect(sim.p.year).toBe(1);
    expect(sim.p.gate).toBe(0);
    expect(sim.story?.kind).toBe('wall');
  });

  it('stars: the gate and half a wall everywhere; a full wall everywhere; no breach at a dawn', () => {
    const p = freshProgress();
    expect(starsOf(p)).toBe(0);
    p.wall.forEach(s => { s.tier = 1; s.done = 1; });
    expect(starsOf(p)).toBe(2);
    p.wall.forEach((s, i) => { if (i !== GATE_SEG) { s.tier = 2; s.done = 2; } });
    expect(starsOf(p)).toBe(3);
    p.breached = true;
    expect(starsOf(p)).toBe(2);
  });
});

describe('the people, the stores and the decrees', () => {
  it('jobs fill the buildings\' slots, never past the share that must stay on the wall; everyone else builds', () => {
    const p = freshProgress();
    p.people = 10;
    p.city.bakery = 3;
    p.city.well = 3;
    const j = jobs(p, 20);
    expect(j.builders).toBeGreaterThanOrEqual(Math.ceil(10 * RULES.minBuilders));
    expect(j.quarry + j.bakers + j.water + j.guards + j.builders).toBe(10);
  });

  it('everyone eats at dusk; without bread strength fails (the bakery helps)', () => {
    const sim = later({ progress: { bread: 0, people: 12, strength: 0.8 } });
    const clock = { t: 0 };
    const evs = toBlock(sim, 'push', frame(), clock);
    expect(ofType(evs, 'hunger')).toHaveLength(1);
    expect(sim.p.strength).toBeLessThan(0.8);
  });

  it('newcomers come at dawn from a town of Judah when there is room and bread; the chronicle notes the town', () => {
    const sim = later({ progress: { people: 8, bread: 30 } });
    expect(sim.p.people).toBeGreaterThan(8);
    expect(sim.p.people).toBeLessThanOrEqual(room(sim.p));
    expect(sim.p.chronicle.some(c => c.startsWith('town:'))).toBe(true);
  });

  it('a decree card comes at the dawn of every third day; its trade-off applies when picked', () => {
    const sim = later({ progress: { gate: 0, gateDay: 2, day: 2, bread: 30, timber: 4 } });
    expect(sim.p.day).toBe(3);
    expect(sim.choice?.kind).toBe('decree');
    const id = sim.choice!.options[0];
    expect(DECREES).toContain(id);
    sim.choice!.t = 1;
    sim.pick(0);
    expect(sim.choice).toBeNull();
    const d = DECREE[id as keyof typeof DECREE];
    if (d.days > 0 && id !== 'szabat') expect(sim.p.decrees[id]).toBe(d.days);
  });

  it('every decree shows its numbers in all four languages', () => {
    for (const id of DECREES) for (const l of ['pl', 'en', 'de', 'sv'] as const) expect(String(CATALOGS[l][`decree.${id}.fx` as keyof typeof CATALOGS.pl])).toMatch(/\{/);
  });
});

describe('the end and the result', () => {
  it('settles once; result() is idempotent and keeps records with max', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, frame({ level: 0.6, calm: 0.6 }), { t: 0 }, through(sim));
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    const p = sim.p;
    const total = p.total;
    sim.finish();
    sim.result();
    expect(p.total).toBe(total);
    expect(p.sessions).toBe(6);
    expect(p.best['40']).toBe(sim.headlineValue);
    expect(passage(a.verse!).text.length).toBeGreaterThan(10);
    expect(a.highlights.at(-1)).toMatch(/Tirza/);
  });

  it('finish() mid-session settles as the end would', () => {
    const sim = later({ planned: 300 });
    drive(sim, 20, frame(), { t: 0 }, through(sim));
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.total).toBe(sim.headlineValue);
    expect(sim.phase).toBe('done');
  });
});

describe('the meta', () => {
  it('migrates the placeholder\'s save ({ sessions }) in place: the count stays, the campaign starts fresh', () => {
    const p = migrate(mergeSaved(freshProgress(), { sessions: 3 }) as NehProgress);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(3);
    expect(p.gate).toBe(0);
    expect(p.wall).toHaveLength(SEGS.length);
    expect(migrate(p)).toEqual(p);
    const raw = migrate({ sessions: 2, junk: 'x' } as unknown as NehProgress);
    expect(raw.ver).toBe(1);
    expect((raw as unknown as { junk?: string }).junk).toBeUndefined();
    // a game runs on it
    const sim = new NehSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
  });

  it('repairs a v1 save with wrong types and out-of-range numbers', () => {
    const p = migrate(mergeSaved(freshProgress(), {
      ver: 1, sessions: 'x', gate: 42, gateDay: -3, wall: 'oops', city: [], stretch: null, stars: { a: 1 }, perks: { drewno: 9, nope: 2 },
      stone: -5, timber: 'many', bread: 12, seen: null, chronicle: [1, 'town:tekoa'], strength: 7,
    }));
    expect(p.sessions).toBe(0);
    expect(p.gate).toBe(GATES.length - 1);
    expect(p.gateDay).toBe(0);
    expect(p.wall).toHaveLength(SEGS.length);
    expect(p.city.yard).toBe(1);
    expect(p.stars).toHaveLength(GATES.length);
    expect(p.perks.drewno).toBe(3);
    expect((p.perks as Record<string, number>).nope).toBeUndefined();
    expect(p.stone).toBe(0);
    expect(p.bread).toBe(12);
    expect(p.chronicle).toEqual(['town:tekoa']);
    expect(p.strength).toBe(1);
  });

  it('the king\'s letters spend the star bank', () => {
    const p = freshProgress();
    p.starBank = 3;
    expect(affordablePerk(p)).not.toBeNull();
    expect(buyPerk(p, 'drewno')).toBe(true);
    expect(p.starBank).toBe(2);
    expect(buyPerk(p, 'eskorta')).toBe(true);
    expect(p.starBank).toBe(0);
    expect(buyPerk(p, 'kielnie')).toBe(false);
    expect(PERKS).toHaveLength(6);
  });

  it('records the best of the length last played, else the best of any', () => {
    const p = freshProgress();
    expect(bestOf(p)).toBeNull();
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(30);
    p.lastLen = 600;
    expect(bestOf(p)).toBe(45);
  });

  it('the wall: open when low or breached, integrity by height', () => {
    const p = freshProgress();
    const s = p.wall[0];
    expect(isOpen(0, s)).toBe(true);
    s.tier = 1; s.done = 1; s.hp = maxHp(0, s);
    expect(isOpen(0, s)).toBe(false);
    s.hp = 0;
    expect(isOpen(0, s)).toBe(true);
    expect(CHRONICLE_SIZE).toBe(18);
  });
});

describe('the world', () => {
  it('the roads run from beyond the top edge to the foot of the wall', () => {
    for (const id of ROUTE_IDS) {
      const a = routeAt(id, 0), b = routeAt(id, routeLen(id));
      expect(a.y).toBeLessThan(0);
      expect(b.y).toBeGreaterThan(RULES.wallOut - 0.5);
      expect(b.y).toBeLessThan(RULES.wallY);
    }
  });

  it('every marker is inside the world and reachable (not above the wall walk)', () => {
    for (const m of MARKERS) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(RULES.worldW);
      expect(m.y).toBeGreaterThanOrEqual(RULES.walkTop);
      expect(m.y).toBeLessThan(RULES.worldH);
    }
    const ids = new Set(MARKERS.map(m => m.id));
    expect(ids.size).toBe(MARKERS.length);
  });
});

describe('Tirza talks, and the texts in four languages', () => {
  it('has at least 3 variants per moment, each fits a bubble (90 characters)', () => {
    for (const m of MOMENTS) {
      expect(LINE_COUNT[m]).toBeGreaterThanOrEqual(3);
      for (const l of LINES[m]) expect(l.length, l).toBeLessThanOrEqual(90);
    }
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) if (k.startsWith('say.')) expect((v as string).length, `${k}: ${v}`).toBeLessThanOrEqual(90);
    }
  });

  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 łokieć, 3 łokcie, 5 łokci)', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['łokieć', 'łokcie', 'łokci', 'łokcie', 'łokci']);
    expect(t('cubits', { n: 12 })).toBe('12\u00a0łokci');
  });

  it('never asks to concentrate harder, never uses holiness words, gore or "hack"; nobody is killed', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /\bkill/, /töte/, /döda/, /pray/, /módl/, /\bbete\b/]) {
        expect(all).not.toMatch(word);
      }
      const tips = Object.entries(cat).filter(([k]) => k.startsWith('tip.') || k.startsWith('howto.')).map(([, v]) => String(v).toLowerCase()).join(' ');
      for (const word of [/mocniej/, /harder/, /stärker/, /hårdare/]) expect(tips).not.toMatch(word);
    }
  });

  it('leaves no Polish in the other languages, and quotes in each language\'s own marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) {
            if (l === 'en') expect(s, `${l}.${k}`).toMatch(/“[^„”"“]+”/);
            if (l === 'de') expect(s, `${l}.${k}`).toMatch(/„[^„”"“]+“/);
            if (l === 'sv') expect(s, `${l}.${k}`).toMatch(/”[^„”"“]+”/);
          }
        }
      }
    }
    for (const [k, m] of Object.entries(CATALOGS.pl)) {
      if (typeof m === 'string' && /[„“”"]/.test(m)) expect(m, k).toMatch(/„[^„”"“]+”/);
    }
  });

  it('a session talks: Tirza opens, and lines never repeat until their moment is used up', () => {
    const sim = later({ planned: 180 });
    drive(sim, 60, frame({ level: 0.7, calm: 0.7, hold: 8 }), { t: 0 }, through(sim));
    expect(sim.talk.said.length).toBeGreaterThan(2);
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the centre every 0.65 s (a tap: no drag), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<NehProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, score = 0;
    const seen: number[] = [];
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.steer(0, 0);
        sim.tap({ x: 9, y: 7.0 });
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
      score = sim.result().score;
      if (Math.round(t * 60) % 300 === 0) seen.push(score);
    }
    return { score, seen, sim };
  }

  it('raises cubits by 22 s on either band, first session or later, and the headline climbs live', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 4; seed++) {
        for (const planned of [40, 180, 300]) {
          const { score, seen } = smoke({}, seed, eeg, planned);
          expect(score, `eeg ${eeg}, seed ${seed}, ${planned} s`).toBeGreaterThan(3);
          expect(seen.at(-1)!).toBeGreaterThan(seen[1] ?? 0);
        }
      }
    }
    expect(smoke({ sessions: 6, seen: SEEN }, 3, false, 300).score).toBeGreaterThan(3);
    expect(smoke({ sessions: 6, seen: SEEN }, 3, false, 40).score).toBeGreaterThan(3);
  });

  it('the smoke\'s taps build something (the guide) and never leave a build cancelled', () => {
    const { sim } = smoke({ sessions: 6, seen: SEEN, stone: 30, timber: 12 }, 2, false, 300);
    const built = MARKERS.filter(m => sim.levelOf(m.id) > (m.kind === 'yard' || m.kind === 'governor' ? 1 : 0)).length;
    expect(built).toBeGreaterThan(0);
  });
});

describe('a long headless campaign', () => {
  it('ten 5-minute sessions of a middling player: the wall grows, gates finish, nothing breaks', () => {
    let p = freshProgress();
    let total = 0;
    for (let s = 0; s < 10; s++) {
      p = migrate(JSON.parse(JSON.stringify(p)));
      const sim = new NehSim({ progress: p, rng: mulberry32(100 + s), day: DAY, daySeed: s, plannedSec: 300, eeg: false, tuning: TUNING });
      sim.start();
      const clock = { t: 0 };
      drive(sim, 304, tt => (Math.sin(tt / 7) > 0 ? frame({ level: 0.62, calm: 0.4, hold: 6 }) : frame({ level: 0.35, calm: 0.7 })), clock, tt => {
        through(sim)();
        if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
      });
      sim.finish();
      const r = sim.result();
      expect(r.score).toBeGreaterThan(40);
      total += r.score;
      for (const k of ['stone', 'timber', 'bread', 'people', 'strength'] as const) expect(Number.isFinite(p[k]), k).toBe(true);
    }
    expect(p.gate + p.year * 10).toBeGreaterThanOrEqual(5);
    expect(total).toBeGreaterThan(1000);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/nehemiasz/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(mod.best(p)).toBe(30);
    expect(mod.unit!(2)).toBe('łokcie');
    expect(mod.unit!(5)).toBe('łokci');
    const how = mod.howto!();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
    // the placeholder's save loads
    expect(mod.best({ sessions: 4 } as unknown as NehProgress)).toBeNull();
  });

  it('builds the progress card from elements: the ten gates, the letters, the chronicle', async () => {
    const { progressPanel } = await import('../src/arcade/nehemiasz/panel');
    const p = { ...freshProgress(), sessions: 3, gate: 2, gateDay: 3, stars: [3, 1, 0, 0, 0, 0, 0, 0, 0, 0], starBank: 3, chronicle: ['town:jerycho', 'gate:owcza'] };
    let saved = 0;
    const el = progressPanel(p, () => saved++);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(GATES.length);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(3);
    expect(el.textContent).toContain(t('gate.rybna'));
    // (the letters' buy button: the difficulty row's chips stand above it since round 25)
    const buy = el.querySelector<HTMLButtonElement>('.arcade-daily button:not([disabled])');
    expect(buy).not.toBeNull();
    buy!.click();
    expect(saved).toBe(1);
    expect(p.starBank).toBeLessThan(3);
  });
});

// ── mobile first (src/arcade/DESIGN.md §12): the layout at every size the runner reports ──────────
const PX = /(\d+(?:\.\d+)?)px/;
/** A context that measures text at 0.6 em a character (a little wider than Manrope), for the cards' layouts. */
function measuring(): CanvasRenderingContext2D {
  const ctx = {
    font: '10px sans-serif',
    save() { /* nothing to keep */ },
    restore() { /* nothing to restore */ },
    measureText(text: string) { return { width: text.length * Number(String(this.font).match(PX)?.[1] ?? 10) * 0.6 } as TextMetrics; },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/** The day's targets for Nehemiah at (nx, ny), the worst case: every build site has a build, so every badge shows (`dusk`: the camera looks up while tonight's preview shows). */
function dayTargets(L: Layout, nx: number, ny: number, dusk = false): TapTarget[] {
  const cam = cameraFor(L, nx, ny, dusk);
  const out = [target('next build', L.guide)];
  for (const m of MARKERS) {
    const b = badgeOf(L, cam.x, cam.y, m);
    if (badgeFree(L, b)) out.push(target(`build ${m.id}`, b.box));
  }
  return out;
}

const STORY_KINDS: StoryKind[] = ['open', 'gate', 'done', 'horn', 'ono', 'wall', 'dedication', 'year'];
const story = (kind: StoryKind, gate = 0): Story => ({ kind, t: 1, dur: 6, gate, next: (gate + 1) % 10, stars: 2, year: 1 });

/** The modules of the cards in another language (the language is settled when the modules load). */
async function cardsIn(l: Lang) {
  localStorage.setItem('brainlink.lang', l);
  vi.resetModules();
  return { hud: await import('../src/arcade/nehemiasz/hud'), lay: await import('../src/arcade/nehemiasz/layout') };
}

describe('mobile first (layout.ts, hud.ts)', () => {
  afterEach(() => { localStorage.setItem('brainlink.lang', 'pl'); });

  it('a phone upright shows ~8.6 u across and follows Nehemiah; no size goes under S_MIN px per u; the panel has no empty band', () => {
    expect(layout(360, 500, { top: 134, right: 0, bottom: 0, left: 0 }).s).toBeCloseTo(360 / 8.6, 0);
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.s, c.name).toBeGreaterThanOrEqual(S_MIN);
      expect(L.u, c.name).toBeGreaterThanOrEqual(1);
      // the controls sit just above the screen's foot (the home indicator kept clear), nothing reserved under them
      const foot = c.h - c.insets.bottom;
      expect(foot - (L.guide.y + L.guide.h), c.name).toBeLessThanOrEqual(24);
      expect(foot - (L.horn.y + L.horn.r), c.name).toBeLessThanOrEqual(16);
      expect(L.bottom - L.top, c.name).toBeGreaterThan(c.h * 0.3);
    }
  });

  it('every size: by day the guide\'s button and every build badge take a finger, inside the insets and apart, wherever Nehemiah walks', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      let seen = 0;
      for (let nx = 0.3; nx <= RULES.worldW - 0.3; nx += 0.7) {
        for (let ny = RULES.walkTop; ny <= RULES.worldH - 0.4; ny += 0.6) {
          for (const dusk of [false, true]) {
            const ts = dayTargets(L, nx, ny, dusk);
            seen = Math.max(seen, ts.length);
            expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}, Nehemiah at ${nx.toFixed(1)},${ny.toFixed(1)}${dusk ? ' at dusk' : ''}`).toEqual([]);
          }
        }
      }
      // a phone still offers a handful of sites at once; a desktop most of them
      expect(seen, c.name).toBeGreaterThanOrEqual(c.w < 700 ? 5 : 12);
    }
  });

  it('every size: by night "To the wall!" and the horn (a 56–64 px button on a phone) sit in the thumb zone', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      const h = L.horn;
      const ts = [target('to the wall', L.rush), target('horn', { x: h.x - h.r, y: h.y - h.r, w: h.r * 2, h: h.r * 2 })];
      expect(auditTargets(ts, c.w, c.h, c.insets), c.name).toEqual([]);
      expect(h.r * 2, c.name).toBeGreaterThanOrEqual(56);
      expect(L.rush.h, c.name).toBeGreaterThanOrEqual(48);
      if (L.phone) {
        // upright: the bottom 45 %, and nothing to press in the outer 16 px
        for (const t2 of [...ts, target('next build', L.guide)]) {
          expect(t2.y + t2.h / 2, `${c.name} ${t2.label}`).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
          expect(t2.x, `${c.name} ${t2.label}`).toBeGreaterThanOrEqual(16);
          expect(t2.x + t2.w, `${c.name} ${t2.label}`).toBeLessThanOrEqual(c.w - 16);
        }
      }
    }
  });

  it('the desktop smoke\'s centre tap lands on the open city, so it builds what the guide suggests', () => {
    const L = layout(1280, 672, { top: 192, right: 0, bottom: 0, left: 0 });
    expect(L.panX || L.panY).toBe(false);
    const cam = cameraFor(L, 9, 8.1, false);
    for (const m of MARKERS) expect(inside(badgeOf(L, cam.x, cam.y, m).box, 640, 672 * 0.6), m.id).toBe(false);
    expect(inside(L.guide, 640, 672 * 0.6)).toBe(false);
  });

  it('every size: the stores\' strip holds its five numbers at 12 px or more, the widest they get', async () => {
    const { storesFit } = await import('../src/arcade/nehemiasz/hud');
    const ctx = measuring();
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      const fit = storesFit(ctx, L, ['130', '99', '130', '40/40', '100%']);
      expect(fit.fits, c.name).toBe(true);
      expect(fit.px, c.name).toBeGreaterThanOrEqual(12);
    }
  });

  it('the font never goes under 11 px', () => {
    for (const px of [0, 4, 6.5, 9, 10.9, 11, 12.4, 13, 16, 30]) {
      expect(Number(font(px).match(PX)![1]), String(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(font(16, 700)).toContain('16px');
  });

  it('every size, every language: a story card fits the screen whole, its text at 13 px or more and its passage uncut', async () => {
    for (const l of LANGS) {
      const { hud, lay } = await cardsIn(l);
      const ctx = measuring();
      for (const c of CHECK_SIZES) {
        const L = lay.layout(c.w, c.h, c.insets);
        for (const kind of STORY_KINDS) {
          for (const gate of kind === 'gate' || kind === 'done' ? [0, 3, 4, 8, 9] : [0]) {
            const sl = hud.storyLayout(ctx, L, hud.storyText(story(kind, gate)));
            const what = `${l} ${c.name} ${kind} ${gate}`;
            expect(sl.textPx, what).toBeGreaterThanOrEqual(MIN_READ);
            expect(Math.min(sl.kickerPx, sl.footPx), what).toBeGreaterThanOrEqual(MIN_READ);
            expect(sl.rect.y, what).toBeGreaterThanOrEqual(c.insets.top);
            expect(sl.rect.y + sl.rect.h, what).toBeLessThanOrEqual(c.h - c.insets.bottom);
            if (sl.verse) {
              expect(sl.verse.fits, what).toBe(true);
              expect(sl.verse.size, what).toBeGreaterThanOrEqual(MIN_READ);
              expect(sl.refPx, what).toBeGreaterThanOrEqual(MIN_READ);
            }
            expect(auditTargets([target('story card', sl.rect)], c.w, c.h, c.insets), what).toEqual([]);
          }
        }
      }
    }
  });

  it('every size, every language: the choice cards fit and take a finger; on a phone they stack full width at 15 px', async () => {
    for (const l of LANGS) {
      const { hud, lay } = await cardsIn(l);
      const ctx = measuring();
      const choices: Choice[] = [{ kind: 'tower', options: ['far', 'quick'], t: 1, marker: 't1' }];
      for (let i = 0; i < DECREES.length; i++) for (let j = i + 1; j < DECREES.length; j++) choices.push({ kind: 'decree', options: [DECREES[i], DECREES[j]], t: 1, marker: null });
      for (const c of CHECK_SIZES) {
        const L = lay.layout(c.w, c.h, c.insets);
        for (const ch of choices) {
          const cl = hud.choiceLayout(ctx, L, hud.choiceText(ch));
          const what = `${l} ${c.name} ${ch.options.join('+')}`;
          const ts = cl.cards.map((r, i) => target(`choice ${i + 1}`, r));
          expect(auditTargets(ts, c.w, c.h, c.insets), what).toEqual([]);
          expect(cl.headY, what).toBeGreaterThanOrEqual(c.insets.top);
          expect(Math.min(cl.fxPx, cl.refPx), what).toBeGreaterThanOrEqual(MIN_READ);
          expect(cl.fxs.every(f => f.length <= 5) && cl.names.every(n => n.length <= 2), what).toBe(true);
          if (L.phone) {
            for (const r of cl.cards) expect(r.w, what).toBeCloseTo(L.right - L.left, 5);
            expect(cl.cards[1].y, what).toBeGreaterThan(cl.cards[0].y + cl.cards[0].h);
            if (l === 'pl') expect(cl.fxPx, what).toBeGreaterThanOrEqual(15);
          }
        }
      }
    }
  });
});

// ── a big screen and a mouse (DESIGN.md §14) ─────────────────────────

describe('a big screen and a mouse (DESIGN.md §14)', () => {
  const FONTS: number[] = [];
  /** A canvas context that draws nothing, keeps what is set, measures text at 0.55 em a character and logs every font. */
  function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const gradient = { addColorStop: () => undefined };
    const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
    return new Proxy(state, {
      get(target2, prop) {
        if (prop in target2) return target2[prop];
        if (prop === 'measureText') return (x: string) => ({ width: String(x).length * Number(String(target2.font).match(PX)?.[1] ?? 10) * 0.55 });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => gradient;
        if (prop === 'getTransform') return () => ({ a: 1, b: 0 });
        return () => undefined;
      },
      set(target2, prop, value) {
        target2[prop] = value;
        if (prop === 'font') FONTS.push(Number(String(value).match(PX)?.[1] ?? 10));
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
  }
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  type Size = { name: string; w: number; h: number; insets: Insets };
  const FULLHD = CHECK_SIZES.find(c => c.name.startsWith('Full HD'))!;
  const QHD = CHECK_SIZES.find(c => c.name.startsWith('2560'))!;
  const RETURNING: Partial<NehProgress> = { sessions: 5, pushes: 1, gateDay: 1, day: 1, seen: SEEN, cards: ['horn', 'ono'] };
  interface View { L: Layout; hover: { kind: string; id?: string; i?: number } | null; aim: boolean; tip: { text: string } | null; hud: { storeRects: { x: number; y: number; w: number; h: number }[] }; badges(sim: NehSim): { id: string; free: boolean; box: { x: number; y: number; w: number; h: number } }[] }
  interface Played { game: ArcadeGame; sim: NehSim; view: View; canvas: HTMLCanvasElement }

  /** The real game on a canvas of w × h with the runner's insets, a few frames in (a finger's, or a mouse's). */
  function play(size: Size, touch: boolean, progress: Partial<NehProgress> = RETURNING): Played {
    const canvas = document.createElement('canvas');
    const env: GameEnv<NehProgress> = {
      canvas, hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: migrate(mergeSaved(freshProgress(), { ...freshProgress(), ...progress })), rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300,
      tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    const game = nehemiasz.create(env);
    game.resize(size.w, size.h, 1);
    game.start();
    const inner = game as unknown as { sim: NehSim; view: View };
    const p: Played = { game, sim: inner.sim, view: inner.view, canvas };
    frames(p, 20);
    return p;
  }
  function frames(p: Played, n: number, f: FocusFrame = frame()): void {
    for (let i = 0; i < n; i++) {
      p.game.update(STEP, f, p.sim.t + STEP);
      p.game.draw();
    }
  }
  const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const move = (p: Played, at: { x: number; y: number }, n = 1) => {
    p.game.pointer!({ type: 'move', ...at, id: 1 });
    frames(p, n);
  };

  it('a mouse on a desktop keeps the row and gets a desktop\'s answers; a finger keeps its layouts; every size audits clean with a mouse', () => {
    for (const c of CHECK_SIZES) {
      const kind = screenKind(c.w, c.h, false);
      const M = layout(c.w, c.h, c.insets, false), F = layout(c.w, c.h, c.insets, true);
      expect(F.desk, c.name).toBe(false);
      expect(M.desk, c.name).toBe(!M.stack && !M.side && (kind === 'desktop' || kind === 'big'));
      // the same geometry: the desktop's answers are hover, key caps and tooltips, not another panel
      expect([M.s, M.guide.x, M.guide.w, M.horn.r], c.name).toEqual([F.s, F.guide.x, F.guide.w, F.horn.r]);
      const foot = c.h - c.insets.bottom;
      expect(foot - (M.guide.y + M.guide.h), c.name).toBeLessThanOrEqual(24);
      expect(foot - (M.horn.y + M.horn.r), c.name).toBeLessThanOrEqual(16);
      if (!M.desk) continue;
      // a big screen fills the band's height with the world (QHD: 140 px a u) and grows its panel with the screen
      if (kind === 'big') {
        expect(M.s, c.name).toBeGreaterThanOrEqual(95);
        expect(M.horn.r, c.name).toBeGreaterThanOrEqual(32 * 1.35 - 0.5);
      }
    }
    expect(layout(QHD.w, QHD.h, QHD.insets, false).s).toBeGreaterThanOrEqual(135);
  });

  it('a mouse: a build badge lights up with its cost card, the buttons and the stores answer with tooltips, the open field rings the guide\'s pick; a finger has none of it', () => {
    const p = play(FULLHD, false);
    const sim = p.sim, L = p.view.L;
    expect(L.desk).toBe(true);
    expect(sim.dayTime).toBe(true);
    // the guide's button: lit, a hand, its tooltip with its key
    move(p, mid(L.guide));
    expect(p.view.hover?.kind).toBe('guide');
    expect(p.canvas.style.cursor).toBe('pointer');
    frames(p, 40);
    expect(sim.guideId).toBeTruthy();
    expect(p.view.tip?.text).toBe(t('hover.guide'));
    // a free build badge
    const b = p.view.badges(sim).find(x => x.free)!;
    expect(b).toBeTruthy();
    move(p, mid(b.box));
    expect(p.view.hover).toEqual({ kind: 'marker', id: b.id });
    // the stores: what each number is
    const r = p.view.hud.storeRects[0];
    move(p, mid(r), 40);
    expect(p.view.tip?.text).toBe(t('hover.stone', { n: Math.floor(sim.p.stone), max: stoneCap(sim.p) }));
    // the open field by day: a click builds the guide's pick, which wears a ring
    move(p, { x: L.w / 2, y: L.top + (L.bottom - L.top) * 0.12 });
    expect(p.view.hover).toBeNull();
    expect(p.view.tip).toBeNull();
    expect(p.canvas.style.cursor).toBe('pointer');
    expect(sim.neh.build).toBeFalsy();
    expect(p.view.aim).toBe(true);
    // the night: the horn and "Na mur!"
    sim.blockIndex = sim.plan.findIndex(x => x.kind === 'push');
    sim.blockT = 6;
    frames(p, 2);
    expect(sim.nightTime).toBe(true);
    move(p, { x: L.horn.x, y: L.horn.y }, 40);
    expect(p.view.hover?.kind).toBe('horn');
    expect(p.view.tip?.text).toBe(sim.hornReady ? t('hover.horn') : t('hover.hornWait', { n: Math.floor(Math.min(1, sim.horn) * 100) }));
    move(p, mid(L.rush), 40);
    expect(p.view.hover?.kind).toBe('rush');
    expect(p.view.tip?.text).toBe(t('hover.rush'));
    // a finger: no hover
    const f = play(FULLHD, true);
    move(f, mid(f.view.L.guide), 40);
    expect(f.view.hover).toBeNull();
    expect(f.view.tip).toBeNull();
  });

  it('keeps the font floor with a mouse at every desktop size (playing, a tooltip, a choice, a story card)', () => {
    for (const c of CHECK_SIZES.filter(x => layout(x.w, x.h, x.insets, false).desk)) {
      FONTS.length = 0;
      const p = play(c, false);
      move(p, mid(p.view.L.guide), 40);
      move(p, mid(p.view.hud.storeRects[4]), 40);
      play(c, false, { sessions: 0 });
      expect(Math.min(...FONTS), c.name).toBeGreaterThanOrEqual(MIN_TEXT);
    }
  });

  it('speaks of clicks to a mouse: the how-to, the coach marks and the story card have a mouse\'s words in four languages', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      expect(String(cat['howto.tap.keys']), l).not.toMatch(/stuk|\btap|tipp|tryck på en/i);
      for (const k of ['hover.guide', 'hover.rush', 'hover.horn', 'hover.hornWait', 'hover.stone', 'hover.timber', 'hover.bread', 'hover.people', 'hover.strength', 'hud.tapKeys', 'coach.moveKeys', 'coach.guideKeys', 'coach.hornKeys']) {
        expect(typeof cat[k], `${l} ${k}`).toBe('string');
      }
    }
    // no matchMedia here: no coarse pointer — the mouse's how-to
    expect(nehemiasz.howto!().hands[1].text).toBe(t('howto.tap.keys'));
  });
});

describe('long sessions (15–30 minutes)', () => {
  it('plans 15, 20, 25 and 30 minutes of days and nights to the next dawn, none past its nominal length', () => {
    for (const planned of [900, 1200, 1500, 1800]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned + 1));
        const body = first ? plan.slice(1) : plan;
        if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        body.forEach((b, i) => expect(b.kind).toBe((i % 2 === 0) === first ? 'push' : 'rest'));
        expect(plan.at(-1)!.kind).toBe('push');
        expect(finaleFor(planned)).toBe(RULES.finale.long);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        // about one night and one day every 65 s: 14 nights in 15 minutes, 27 in 30
        const nights = body.filter(b => b.kind === 'push').length;
        expect(Math.abs(nights - (planned - finaleFor(planned)) / (RULES.push[0] + RULES.rest[0]))).toBeLessThan(1);
        for (const b of body) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
          const [mean, jitter] = b.kind === 'push' ? RULES.push : RULES.rest;
          expect(b.dur).toBeLessThanOrEqual((mean + jitter) * 1.1);
        }
      }
    }
  });

  it('a 30-minute session builds on day after day through the gates, ends on time, and nothing piles up', () => {
    for (const [progress, f] of [
      [{}, 'mixed'],
      [{ sessions: 5, pushes: 1, gateDay: 1, day: 1, seen: SEEN, cards: ['horn', 'ono'] }, 'steady'],
    ] as const) {
      const sim = makeSim({ planned: 1800, progress: progress as Partial<NehProgress> });
      const p = sim.p;
      const gate0 = p.gate;
      let maxRaiders = 0, maxPebbles = 0, maxRings = 0, maxJabs = 0;
      const evs: SimEvent[] = [];
      drive(sim, 1800 + RULES.settle, tt => (f === 'steady' ? (sim.block?.kind === 'rest' ? CALM : HIGH)
        : Math.sin(tt / 7) > 0 ? frame({ level: 0.62, calm: 0.4, hold: 6 }) : frame({ level: 0.35, calm: 0.7 })), { t: 0 }, tt => {
        through(sim)();
        if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
        maxRaiders = Math.max(maxRaiders, sim.raiders.length);
        maxPebbles = Math.max(maxPebbles, sim.pebbles.length);
        maxRings = Math.max(maxRings, sim.rings.length);
        maxJabs = Math.max(maxJabs, sim.jabs.length);
        evs.push(...sim.take());
      });
      expect(sim.phase).toBe('done');
      expect(ofType(evs, 'done')).toHaveLength(1);
      expect(sim.canStop()).toBe(true);
      // a day for every day block, the gates finishing one after another
      expect(ofType(evs, 'dawn').length).toBe(sim.plan.filter(b => b.kind !== 'push').length);
      expect(ofType(evs, 'gateDone').length).toBeGreaterThanOrEqual(4);
      expect(p.gate).toBeGreaterThanOrEqual(gate0 + 4);
      expect(sim.headlineValue).toBeGreaterThan(1500);
      for (const k of ['stone', 'timber', 'bread', 'people', 'strength'] as const) expect(Number.isFinite(p[k]), k).toBe(true);
      expect(p.stone).toBeLessThanOrEqual(stoneCap(p));
      expect(p.timber).toBeLessThan(100);
      expect(maxRaiders).toBeLessThan(40);
      expect(maxPebbles).toBeLessThan(40);
      expect(maxRings).toBeLessThan(40);
      expect(maxJabs).toBeLessThan(40);
      expect(p.cards.length).toBeLessThanOrEqual(3);
      const r = sim.result();
      expect(JSON.stringify(r)).not.toMatch(/undefined|NaN|Infinity/);
    }
  });

  it('a long session can finish the wall and begin the next year: the days read across the turn, the fox\'s old marks go', () => {
    const sim = later({ planned: 1800, progress: { gate: 8, gateDay: 1, day: gateFirstDay(8), cards: ['horn', 'ono', 'fox:7', 'fox:8'] } });
    const evs: SimEvent[] = [];
    drive(sim, 1804, () => (sim.block?.kind === 'rest' ? CALM : HIGH), { t: 0 }, tt => {
      through(sim)();
      if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
      evs.push(...sim.take());
    });
    expect(sim.p.year).toBe(1);
    expect(sim.wallDone).toBe(true);
    expect(ofType(evs, 'gateDone').map(e => e.gate).slice(0, 3)).toEqual([8, 9, 0]);
    const days = sim.result().stats!.find(([k]) => k === t('stat.days'))![1];
    // the session's first dawn is the gate's second day
    expect(days).toBe(t('stat.daysWrap', { from: gateFirstDay(8) + 1, to: sim.p.day }));
    expect(sim.p.cards.filter(c => c.startsWith('fox:')).every(c => c === `fox:${10 + sim.p.gate}`)).toBe(true);
  });

  it('the years\' climb stops at yearTop: year 9 sends the same night as year 4, more than year 1', () => {
    const tonight = (year: number) => {
      const sim = later({ seed: 9, progress: { year, gate: 3, gateDay: 2, day: 13 } });
      return sim.preview.reduce((s, v) => s + v.total, 0);
    };
    expect(tonight(RULES.yearTop + 5)).toBe(tonight(RULES.yearTop));
    expect(tonight(RULES.yearTop)).toBeGreaterThan(tonight(1));
  });
});

describe('long sessions (45–60 minutes)', () => {
  it('plans 45 and 60 minutes of days and nights to the next dawn, none past its nominal length', () => {
    for (const planned of [2700, 3600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned + 1));
        const body = first ? plan.slice(1) : plan;
        if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        body.forEach((b, i) => expect(b.kind).toBe((i % 2 === 0) === first ? 'push' : 'rest'));
        expect(plan.at(-1)!.kind).toBe('push');
        expect(finaleFor(planned)).toBe(RULES.finale.long);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        const nights = body.filter(b => b.kind === 'push').length;
        expect(Math.abs(nights - (planned - finaleFor(planned)) / (RULES.push[0] + RULES.rest[0]))).toBeLessThan(1);
        for (const b of body) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
          const [mean, jitter] = b.kind === 'push' ? RULES.push : RULES.rest;
          expect(b.dur).toBeLessThanOrEqual((mean + jitter) * 1.1);
        }
      }
    }
  });

  it('a 60-minute session builds day after day through the gates, ends on time, nothing piles up, Tirza never repeats within ten minutes', () => {
    for (const [progress, f] of [
      [{}, 'mixed'],
      [{ sessions: 5, pushes: 1, gateDay: 1, day: 1, seen: SEEN, cards: ['horn', 'ono'] }, 'steady'],
    ] as const) {
      const sim = makeSim({ planned: 3600, progress: progress as Partial<NehProgress> });
      const p = sim.p;
      const gate0 = p.gate + p.year * GATES.length;
      let maxRaiders = 0, maxPebbles = 0, maxRings = 0, maxJabs = 0, maxStories = 0;
      let soonest = Infinity, lastLine: unknown = null;
      const heard = new Map<string, number>();
      const evs: SimEvent[] = [];
      drive(sim, 3600 + RULES.settle, tt => (f === 'steady' ? (sim.block?.kind === 'rest' ? CALM : HIGH)
        : Math.sin(tt / 7) > 0 ? frame({ level: 0.62, calm: 0.4, hold: 6 }) : frame({ level: 0.35, calm: 0.7 })), { t: 0 }, tt => {
        through(sim)();
        if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
        maxRaiders = Math.max(maxRaiders, sim.raiders.length);
        maxPebbles = Math.max(maxPebbles, sim.pebbles.length);
        maxRings = Math.max(maxRings, sim.rings.length);
        maxJabs = Math.max(maxJabs, sim.jabs.length);
        maxStories = Math.max(maxStories, (sim as unknown as { stories: unknown[] }).stories.length);
        const line = sim.talk.line;
        if (line && line !== lastLine) {
          const was = heard.get(line.text);
          if (was !== undefined) soonest = Math.min(soonest, tt - was);
          heard.set(line.text, tt);
        }
        lastLine = line;
        evs.push(...sim.take());
      });
      expect(sim.phase, f).toBe('done');
      expect(ofType(evs, 'done'), f).toHaveLength(1);
      expect(sim.canStop(), f).toBe(true);
      expect(ofType(evs, 'dawn').length, f).toBe(sim.plan.filter(b => b.kind !== 'push').length);
      expect(ofType(evs, 'gateDone').length, f).toBeGreaterThanOrEqual(8);
      expect(p.gate + p.year * GATES.length, f).toBeGreaterThanOrEqual(gate0 + 8);
      expect(sim.headlineValue, f).toBeGreaterThan(3000);
      expect(sim.headlineValue, f).toBeLessThan(10_000_000);
      for (const k of ['stone', 'timber', 'bread', 'people', 'strength'] as const) expect(Number.isFinite(p[k]), k).toBe(true);
      expect(p.stone, f).toBeLessThanOrEqual(stoneCap(p));
      expect(p.timber, f).toBeLessThan(100);
      expect(maxRaiders, f).toBeLessThan(40);
      expect(maxPebbles, f).toBeLessThan(40);
      expect(maxRings, f).toBeLessThan(40);
      expect(maxJabs, f).toBeLessThan(40);
      expect(maxStories, f).toBeLessThanOrEqual(4);
      expect(p.cards.length, f).toBeLessThanOrEqual(3);
      expect(p.chronicle.length, f).toBeLessThanOrEqual(CHRONICLE_SIZE);
      // Tirza talks all hour, and past half an hour a line comes back only after ten minutes (§17.1, §28)
      expect(sim.talk.said.length, f).toBeGreaterThan(60);
      expect(soonest, f).toBeGreaterThanOrEqual(ROUND_SEC - 1);
      const r = sim.result();
      expect(JSON.stringify(r), f).not.toMatch(/undefined|NaN|Infinity/);
      expect(r.highlights!.length, f).toBeLessThanOrEqual(6);
      for (const [, v] of r.stats!) if (/^[+−×]?[\d\s  ,.%]+$/.test(v)) expect(v.length, v).toBeLessThanOrEqual(8);
    }
  });

  it('an hour can run the wall to its end and on: the days read across the turn, and twice round as the whole calendar', () => {
    const sim = later({ planned: 3600, progress: { gate: 9, gateDay: 1, day: gateFirstDay(9), cards: ['horn', 'ono'] } });
    const year0 = sim.p.year;
    drive(sim, 3604, () => (sim.block?.kind === 'rest' ? CALM : HIGH), { t: 0 }, tt => {
      through(sim)();
      if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
      sim.take();
    });
    expect(sim.p.year).toBeGreaterThan(year0);
    const days = () => sim.result().stats!.find(([k]) => k === t('stat.days'))![1];
    expect(days()).toBe(t('stat.daysWrap', { from: gateFirstDay(9) + 1, to: sim.p.day }));
    // a strong hour may finish the wall a second time: not "a few days", the whole calendar
    sim.p.year = year0 + 2;
    expect(days()).toBe(t('stat.daysV', { from: 1, to: 52 }));
  });
});

// ── difficulty levels (kit/difficulty.ts, DESIGN §29): Na start · Zwykły · Zaawansowany · Hardcore ──────────────────
describe('difficulty levels', () => {
  /** A session of a player who taps the guide and blows the horn, at a steady focus by night and calm by day. */
  function play(d: Difficulty | undefined, planned: number, seed: number, night: FocusFrame, progress: Partial<NehProgress> = {}) {
    const sim = later({ planned, seed, progress: { ...progress, ...(d ? { difficulty: d } : {}) } });
    const evs = drive(sim, planned + RULES.settle, () => (sim.block?.kind === 'push' ? night : CALM), { t: 0 }, tt => {
      through(sim)();
      if (Math.round(tt * 60) % 39 === 0) sim.tap(null);
    });
    sim.finish();
    return { sim, evs, r: sim.result() };
  }

  it('reads an older save as REGULAR and keeps a chosen level through the migration', () => {
    const old = freshProgress() as unknown as Record<string, unknown>;
    delete old.difficulty;
    expect(migrate(old as unknown as NehProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'nightmare' } as unknown as NehProgress).difficulty).toBe('regular');
    expect(migrate({ ...freshProgress(), difficulty: 'hardcore' }).difficulty).toBe('hardcore');
    expect(migrate({ sessions: 4, difficulty: 'start' } as unknown as NehProgress)).toMatchObject({ sessions: 4, difficulty: 'start', ver: 1 });
    expect(freshProgress().difficulty).toBe('regular');
    expect(LEVELS.regular).toEqual({ courage: 1, pry: 1, loot: 1, count: 1, speed: 1, helps: 1, reward: 1 });
  });

  it('keeps the training the same at every level: the same blocks at 40 s and 3–60 minutes', () => {
    for (const planned of [40, 60, 180, 600, 1800, 2700, 3600]) {
      for (const first of [true, false]) {
        const plans = DIFFICULTIES.map(d => makeSim({ planned, seed: 9, progress: first ? { difficulty: d } : { sessions: 4, difficulty: d } }).plan);
        for (const plan of plans) expect(plan).toEqual(plans[1]);
        expect(plans[1].reduce((n, b) => n + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      }
    }
  });

  it('REGULAR is the game as it was: an old save and a REGULAR one play the same session, number for number', () => {
    const night = frame({ level: 0.6, activity: 3, focused: true, hold: 4 });
    const a = play(undefined, 300, 4, night), b = play('regular', 300, 4, night);
    expect(b.r).toEqual(a.r);
    expect(b.evs).toEqual(a.evs);
    expect(JSON.stringify(b.sim.p)).toBe(JSON.stringify(a.sim.p));
    expect(b.r.stats.map(([k]) => k)).not.toContain(t('stat.level'));
  });

  it('scores in a 40 s test session at every level, on either band, first session or later', () => {
    for (const d of DIFFICULTIES) {
      for (const eeg of [false, true]) {
        for (const progress of [{}, { sessions: 6, seen: SEEN }] as Partial<NehProgress>[]) {
          const sim = makeSim({ progress: { ...progress, difficulty: d }, planned: 40, seed: 3, tuning: BEGINNER, eeg });
          const focus = new FocusInput(BEGINNER);
          let f = focus.push(0, true, 0.1), hub = 0, tap = 0;
          for (let tt = 0; tt < 40 + RULES.settle; tt += STEP) {
            if ((hub += STEP) >= 0.1) { hub -= 0.1; f = focus.push(10 * (1 - Math.exp(-tt / 4)), true, 0.1); }
            sim.update(STEP, f, tt);
            if ((tap += STEP) >= 0.65) { tap -= 0.65; sim.steer(0, 0); sim.tap({ x: 9, y: 7 }); }
            sim.take();
          }
          expect(sim.result().score, `${d}, eeg ${eeg}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('orders the nights from Na start to Hardcore at the same focus; Hardcore stays winnable for a focused player', () => {
    const at = (d: Difficulty, night: FocusFrame) => {
      let reached = 0, breaches = 0, held = 0, nights = 0, courage = 0, raiders = 0;
      for (const seed of [1, 2]) {
        const { sim, evs } = play(d, 600, seed, night, { gate: 3, gateDay: 1, day: gateFirstDay(3) + 1 });
        reached += sim.reached;
        breaches += sim.breaches;
        held += sim.nightsHeld;
        nights += sim.nightsAll;
        raiders += ofType(evs, 'spawn').length;
        courage += sim.raiders.reduce((n, r) => n + r.max, 0);
      }
      return { reached: reached / 20, breaches, held: held / nights, raiders, courage };
    };
    const mid = frame({ level: 0.55, activity: 3, focused: true, hold: 3 });
    const m = DIFFICULTIES.map(d => at(d, mid));
    for (let i = 1; i < m.length; i++) {
      // raiders that reach the wall's foot per minute (through the light and the towers), breaches, nights held
      expect(m[i].reached, DIFFICULTIES[i]).toBeGreaterThan(m[i - 1].reached);
      expect(m[i].breaches, DIFFICULTIES[i]).toBeGreaterThanOrEqual(m[i - 1].breaches);
      expect(m[i].held, DIFFICULTIES[i]).toBeLessThanOrEqual(m[i - 1].held);
      expect(m[i].raiders, DIFFICULTIES[i]).toBeGreaterThan(m[i - 1].raiders);
    }
    expect(m[0].held).toBe(1);
    expect(m[3].held).toBeLessThan(0.7);
    // a focused player holds most Hardcore nights
    const strong = at('hardcore', frame({ level: 0.9, activity: 6, focused: true, hold: 10 }));
    expect(strong.held).toBeGreaterThan(0.6);
  });

  it('Hardcore has no helps: the horn never sounds by itself and a held night keeps none of it; Na start sounds it sooner', () => {
    const wait = (d: Difficulty) => {
      const sim = later({ planned: 300, progress: { difficulty: d } });
      const clock = { t: 0 };
      toBlock(sim, 'push', CALM, clock);
      let blown = -1;
      drive(sim, sim.block.dur - 1, HIGH, clock, tt => {
        if (blown < 0 && sim.horns > 0) blown = tt;
        if (sim.hornReady && blown >= 0) blown = Math.min(blown, tt);
      });
      return { horns: sim.horns, ready: sim.hornReady };
    };
    expect(wait('hardcore')).toEqual({ horns: 0, ready: true });
    expect(wait('regular').horns).toBeGreaterThan(0);
    expect(wait('start').horns).toBeGreaterThanOrEqual(wait('regular').horns);
  });

  it('pays a Hardcore gate a star more for two or three stars, never less at Na start', () => {
    for (const [d, stars, pay] of [['regular', 3, 3], ['start', 1, 1], ['start', 3, 3], ['advanced', 3, 3], ['hardcore', 1, 1], ['hardcore', 2, 3], ['hardcore', 3, 4]] as const) {
      const p = { ...freshProgress(), difficulty: d as Difficulty, gate: 1, gateDay: gateDays(1), stars: GATES.map(() => 0) };
      const sim = makeSim({ progress: p });
      sim.p.wall.forEach((s, i) => { s.done = s.tier = i === GATE_SEG || stars >= 2 ? 2 : 1; s.hp = maxHp(i, s); });
      sim.p.breached = stars < 3;
      if (stars === 1) sim.p.wall.forEach(s => { s.done = s.tier = 1; });
      const before = sim.p.starBank;
      (sim as unknown as { finishGate: () => void }).finishGate();
      expect(sim.p.starBank - before, `${d} ${stars}`).toBe(pay);
    }
  });

  it('keeps records per level and names a level other than REGULAR in the summary', () => {
    const night = frame({ level: 0.6, activity: 3, focused: true, hold: 4 });
    const p = { ...freshProgress(), best: { 300: 999 } };
    const hard = play('hardcore', 300, 2, night, p);
    expect(hard.sim.p.best[300]).toBe(999);
    expect(hard.sim.p.best['300@hardcore']).toBe(hard.r.score);
    expect(hard.r.record).toBe(false);
    expect(hard.r.stats[0]).toEqual([t('stat.level'), difficultyName('hardcore')]);
    expect(bestOf(hard.sim.p)).toBe(hard.r.score);
    hard.sim.p.difficulty = 'regular';
    expect(bestOf(hard.sim.p)).toBe(999);
    hard.sim.p.difficulty = 'start';
    expect(bestOf(hard.sim.p)).toBeNull();
    // a second Hardcore session knows its record
    const again = play('hardcore', 300, 3, night, JSON.parse(JSON.stringify({ ...hard.sim.p, difficulty: 'hardcore' })));
    expect(again.r.record).toBe(again.r.score > hard.r.score);
  });

  it('plays an hour at Hardcore and three minutes at Na start: on time, nothing piles up', () => {
    for (const [d, planned] of [['hardcore', 3600], ['start', 180]] as const) {
      const sim = later({ planned, progress: { difficulty: d } });
      let maxRaiders = 0;
      drive(sim, planned + RULES.settle, tt => (sim.block?.kind === 'rest' ? CALM : Math.sin(tt / 9) > 0 ? HIGH : frame({ level: 0.35 })), { t: 0 }, tt => {
        through(sim)();
        if (Math.round(tt * 60) % 50 === 0) sim.tap(null);
        maxRaiders = Math.max(maxRaiders, sim.raiders.length);
      });
      expect(sim.canStop(), d).toBe(true);
      expect(maxRaiders, d).toBeLessThan(80);
      expect(sim.result().score, d).toBeGreaterThan(planned / 10);
    }
  });

  it('opens the lobby card with the four chips; a chip saves the level and the card shows that level\'s record', async () => {
    const { progressPanel } = await import('../src/arcade/nehemiasz/panel');
    const p = { ...freshProgress(), sessions: 2, lastLen: 300, best: { 300: 45, '300@hardcore': 12 } };
    let saved = 0;
    const el = progressPanel(p, () => saved++);
    expect(el.firstElementChild?.classList.contains('difficulty')).toBe(true);
    const chips = [...el.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(el.querySelector('[aria-checked="true"]')?.getAttribute('data-difficulty')).toBe('regular');
    // (the card's words come in the language its module was loaded with)
    const line = () => el.querySelector('.difficulty-line')?.textContent;
    const lang = LANGS.find(l => CATALOGS[l]['diff.regular'] === line());
    expect(lang).toBeDefined();
    const best = () => el.querySelectorAll('.arcade-stats .stat .v')[1].textContent;
    expect(best()).toBe('45');
    chips[3].click();
    expect(p.difficulty).toBe('hardcore');
    expect(saved).toBe(1);
    expect(best()).toBe('12');
    expect(line()).toBe(CATALOGS[lang!]['diff.hardcore']);
    expect(el.querySelectorAll('.difficulty')).toHaveLength(1);
    for (const l of LANGS) for (const d of DIFFICULTIES) expect(String(CATALOGS[l][`diff.${d}`]).length, `${l} ${d}`).toBeGreaterThan(20);
  });
});
