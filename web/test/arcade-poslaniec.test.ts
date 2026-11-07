import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { CITIES, UP_IDS, dayWord, missionSet, missionText, taskFor, upPrice } from '../src/arcade/poslaniec/content';
import { CATALOGS, metres, t } from '../src/arcade/poslaniec/i18n';
import { Gestures, keyMove, swipe, tapAt } from '../src/arcade/poslaniec/input';
import {
  LAP, buyUp, citiesBetween, countMission, dayBefore, flightSecFor, freshProgress, migrate, multOf, postcards, powerSecFor, routeAt, wordComplete, wordToday,
  type PoslaniecProgress,
} from '../src/arcade/poslaniec/meta';
import { GRAVITY, RULES, difficultyFor, jumpV, liftOf, speedFor } from '../src/arcade/poslaniec/rules';
import { PoslaniecSim, planBlocks, type SimEvent } from '../src/arcade/poslaniec/sim';
import { SAY } from '../src/arcade/poslaniec/talk';
import { Track, surfaceOf, type ObKind, type Obstacle } from '../src/arcade/poslaniec/track';
import { mergeSaved } from '../src/arcade/kit/progress';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const focused = (level = 0.9): FocusFrame => frame({ activity: 6, level, focused: true, hold: 10, calm: 0.05 });
const calm = (c = 0.85): FocusFrame => frame({ activity: -3, level: 0.1, calm: c });
const lost: FocusFrame = { reliable: false, activity: null, threshold: 2, level: 0, focused: false, hold: 0, calm: 0 };

type SimOpts = { progress?: Partial<PoslaniecProgress>; planned?: number; seed?: number; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): PoslaniecSim {
  const sim = new PoslaniecSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player who has learnt the controls (no lesson road). */
const later = (o: SimOpts = {}) => makeSim({
  ...o, progress: { sessions: 5, pushes: 1, taught: ['jump', 'roll', 'lane', 'ramp', 'wings', 'tower', 'goat'], ...o.progress },
});

type Clock = { t: number };
function drive(sim: PoslaniecSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock: Clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** An empty road from here on: nothing more is made. */
function emptyRoad(sim: PoslaniecSim): void {
  const tr = sim.track;
  tr.obstacles.length = 0;
  tr.coins.length = 0;
  tr.powers.length = 0;
  tr.letters.length = 0;
  tr.cursor = 1e9;
  tr.fill = () => undefined;
}

let obId = 1e6;
function place(sim: PoslaniecSim, kind: ObKind, lane: number, ahead: number, o: Partial<Obstacle> = {}): Obstacle {
  const ob: Obstacle = {
    id: ++obId, kind, lane, z: sim.z + ahead, len: kind === 'wagon' ? 10 : kind === 'cart' ? RULES.cartLen : kind === 'low' ? RULES.lowLen : RULES.highLen,
    ramp: false, meet: sim.z + ahead, rolling: false, hit: false, passed: false, look: 0, ...o,
  };
  sim.track.obstacles.push(ob);
  return ob;
}

/** Play until block i begins. */
function toBlock(sim: PoslaniecSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock: Clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  let guard = 0;
  while (sim.blockIndex < i && guard++ < 100000) out.push(...drive(sim, STEP, f, clock));
  return out;
}

describe('the rules', () => {
  it('jumps clear a fence, the sandals reach a roof, the speed rises within a run', () => {
    expect(jumpV(RULES.jumpTop) ** 2 / (2 * GRAVITY)).toBeCloseTo(RULES.jumpTop, 6);
    expect(RULES.jumpTop).toBeGreaterThan(RULES.lowTop);
    expect(RULES.sandalTop).toBeGreaterThan(RULES.wagonTop);
    expect(RULES.rollH).toBeLessThan(RULES.highGap);
    expect(speedFor(0)).toBe(RULES.vMin);
    expect(speedFor(5000)).toBeGreaterThan(speedFor(500));
    expect(speedFor(1e7)).toBeLessThanOrEqual(RULES.vMax);
    expect(difficultyFor(0)).toBeCloseTo(RULES.d0);
    expect(difficultyFor(3000)).toBeGreaterThan(0.7);
  });

  it('lifts the wings only above the threshold', () => {
    expect(liftOf(0.5)).toBe(0);
    expect(liftOf(0.3)).toBe(0);
    expect(liftOf(RULES.liftFull)).toBe(1);
    expect(liftOf(0.6)).toBeGreaterThan(0);
  });
});

describe('the block plan', () => {
  it('fits any session of 10 s or more with push and rest blocks and a finale', () => {
    for (const planned of [10, 40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(3));
        expect(plan.some(b => b.kind === 'push'), `${planned}`).toBe(true);
        expect(plan.some(b => b.kind === 'rest'), `${planned}`).toBe(true);
        expect(plan[plan.length - 1].kind).toBe('finale');
        for (let i = 1; i < plan.length; i++) expect(plan[i].start).toBeCloseTo(plan[i - 1].start + plan[i - 1].dur, 6);
        for (const b of plan) if (b.kind === 'push' || b.kind === 'rest') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        if (planned >= 180) for (const b of plan) if (b.kind === 'push' || b.kind === 'rest') expect(b.dur).toBeLessThanOrEqual(32);
      }
    }
  });

  it('teaches in a warm-up the first time only (a short run-up later)', () => {
    expect(planBlocks(300, true, mulberry32(1))[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
    expect(planBlocks(300, false, mulberry32(1))[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.later });
    expect(planBlocks(40, false, mulberry32(1))[0].kind).toBe('push');
  });

  it('telegraphs the next block and says it in the panel, counting down', () => {
    const sim = later();
    const clock = { t: 0 };
    const b = sim.plan[1];
    const evs = drive(sim, b.start - 2, frame(), clock);
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
    expect(ofType(evs, 'telegraph')[0].next).toBe('push');
    const s = sim.signal();
    expect(s.want).toBe('free');
    expect(s.next).toBe('focus');
    drive(sim, 3, frame(), clock);
    const p = sim.signal();
    expect(p.want).toBe('focus');
    expect(p.task).toBe(taskFor('push', 0));
    expect(p.left!).toBeGreaterThan(b.dur - 2);
    expect(p.next).toBeNull();
  });
});

describe('the hands', () => {
  it('maps swipes, taps and keys; a centre tap and Space jump', () => {
    expect(swipe(-40, 2)).toBe('left');
    expect(swipe(40, 2)).toBe('right');
    expect(swipe(0, -40)).toBe('jump');
    expect(swipe(0, 40)).toBe('roll');
    expect(swipe(10, 5)).toBeNull();
    expect(tapAt(640, 1280)).toBe('jump');
    expect(tapAt(100, 1280)).toBe('left');
    expect(tapAt(1200, 1280)).toBe('right');
    expect(keyMove(' ')).toBe('jump');
    expect(keyMove('ArrowDown')).toBe('roll');
    expect(keyMove('a')).toBe('left');
    expect(keyMove('x')).toBeNull();
    const g = new Gestures(1280);
    g.pointer('down', 1, 640, 480, 0);
    expect(g.pointer('up', 1, 641, 481, 0.1)).toBe('jump');
    g.pointer('down', 2, 640, 480, 0);
    expect(g.pointer('move', 2, 600, 480, 0.05)).toBe('left');
    expect(g.pointer('up', 2, 560, 480, 0.1)).toBeNull();
  });

  it('changes lanes at once and snaps across in about a tenth of a second', () => {
    const sim = later();
    emptyRoad(sim);
    sim.act('left');
    expect(sim.r.lane).toBe(-1);
    drive(sim, 0.13, frame());
    expect(sim.r.x).toBeCloseTo(-RULES.laneW, 6);
    sim.act('left');
    expect(sim.r.lane).toBe(-1);
    expect(ofType(sim.take(), 'bump')).toHaveLength(1);
  });

  it('jumps a fence and rolls under a beam; standing into either is a stumble', () => {
    const sim = later();
    emptyRoad(sim);
    place(sim, 'low', 0, 3);
    sim.act('jump');
    let evs = drive(sim, 1, frame());
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    expect(ofType(evs, 'cleared')[0]?.kind).toBe('low');
    place(sim, 'high', 0, 4);
    sim.act('roll');
    evs = drive(sim, 1, frame());
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    expect(ofType(evs, 'cleared')[0]?.kind).toBe('high');
    place(sim, 'low', 0, 4);
    evs = drive(sim, 1, frame());
    expect(ofType(evs, 'stumble')).toHaveLength(1);
  });

  it('a roll pressed in the air slams down and rolls on landing; a jump pressed just before landing jumps (buffer)', () => {
    const sim = later();
    emptyRoad(sim);
    sim.act('jump');
    drive(sim, 0.12, frame());
    sim.act('roll');
    const evs = drive(sim, 0.2, frame());
    expect(ofType(evs, 'slam')).toHaveLength(1);
    expect(sim.r.grounded).toBe(true);
    expect(sim.r.rollT).toBeGreaterThan(0);
    sim.take();
    const s2 = later();
    emptyRoad(s2);
    s2.act('jump');
    drive(s2, RULES.jumpSec - 0.08, frame());
    s2.act('jump');
    const e2 = drive(s2, 0.2, frame());
    expect(ofType(e2, 'jump')).toHaveLength(1);
  });

  it('runs up a ramp onto a wagon roof and along it; a wagon without a ramp in the lane is a hit', () => {
    const sim = later();
    emptyRoad(sim);
    place(sim, 'wagon', 0, 8, { ramp: true, len: 20 });
    const evs = drive(sim, 1.6, frame());
    expect(ofType(evs, 'roof')).toHaveLength(1);
    expect(sim.r.y).toBeCloseTo(RULES.wagonTop, 3);
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    // off the end, down onto the road
    drive(sim, 2, frame());
    expect(sim.r.y).toBe(0);
    place(sim, 'wagon', 0, 4);
    expect(ofType(drive(sim, 0.6, frame()), 'stumble')).toHaveLength(1);
  });

  it('a lane change into a wagon\'s side bounces back with a stumble', () => {
    const sim = later();
    emptyRoad(sim);
    place(sim, 'wagon', -1, -3, { len: 12 });
    sim.act('left');
    expect(sim.r.lane).toBe(0);
    const evs = sim.take();
    expect(ofType(evs, 'stumble')[0]).toMatchObject({ side: true });
    expect(ofType(evs, 'bump')).toHaveLength(1);
  });

  it('meets an oncoming cart where it was planned; leaving the lane passes it', () => {
    const sim = later();
    emptyRoad(sim);
    const c = place(sim, 'cart', 0, 60);
    drive(sim, 0.5, frame());
    expect(c.rolling).toBe(true);
    expect(c.z).toBeGreaterThan(60);
    sim.act('right');
    const evs = drive(sim, 6, frame());
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    expect(c.z).toBeLessThan(sim.z);
  });
});

describe('the goat and the runs', () => {
  it('a stumble brings Bela to the heels; a second while she is close ends the run, and a new run starts', () => {
    const sim = later();
    emptyRoad(sim);
    place(sim, 'low', 0, 3);
    drive(sim, 0.5, frame());
    expect(sim.goatNear).toBeGreaterThan(0);
    const before = sim.score;
    place(sim, 'low', 0, 3);
    const evs = drive(sim, 0.6, frame());
    const caught = ofType(evs, 'caught');
    expect(caught).toHaveLength(1);
    expect(sim.phase).toBe('caught');
    expect(caught[0].tally.metres).toBeGreaterThan(0);
    const e2 = drive(sim, RULES.caughtSec + 0.2, frame());
    expect(ofType(e2, 'newRun')).toHaveLength(1);
    expect(sim.phase).toBe('play');
    expect(sim.run.n).toBe(2);
    expect(sim.score).toBeGreaterThanOrEqual(before);
    expect(sim.runMetres).toBeLessThan(10);
  });

  it('she falls back after a clean stretch: a later stumble is only a stumble', () => {
    const sim = later();
    emptyRoad(sim);
    place(sim, 'low', 0, 3);
    drive(sim, RULES.goatNear + 0.5, frame());
    expect(sim.goatNear).toBe(0);
    place(sim, 'low', 0, 3);
    const evs = drive(sim, 0.6, frame());
    expect(ofType(evs, 'stumble')[0]).toMatchObject({ caught: false });
  });

  it('the shield takes a hit instead of a stumble', () => {
    const sim = later();
    emptyRoad(sim);
    sim.shield = true;
    place(sim, 'low', 0, 3);
    const evs = drive(sim, 0.6, frame());
    expect(ofType(evs, 'shieldBreak')).toHaveLength(1);
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    expect(sim.shield).toBe(false);
    expect(sim.goatNear).toBe(0);
  });

  it('never ends a run in the first-ever lesson', () => {
    const sim = makeSim({ planned: 300 });
    emptyRoad(sim);
    for (let i = 0; i < 3; i++) {
      place(sim, 'low', 0, 3);
      drive(sim, 0.7, frame());
    }
    expect(sim.phase).toBe('play');
    expect(sim.run.n).toBe(1);
  });
});

describe('drachmas, power-ups, the score', () => {
  it('scores metres × the multiplier, doubled by the seal', () => {
    const sim = later({ progress: { sets: 2 } });
    emptyRoad(sim);
    expect(sim.mult).toBe(3);
    const s0 = sim.score, z0 = sim.z;
    drive(sim, 1, frame());
    expect(sim.score - s0).toBeCloseTo((sim.z - z0) * 3, 3);
    sim.powers.double = 5;
    const s1 = sim.score, z1 = sim.z;
    drive(sim, 1, frame());
    expect(sim.score - s1).toBeCloseTo((sim.z - z1) * 6, 3);
  });

  it('picks up drachmas in the lane, not a lane away; the satchel pulls them from beside', () => {
    const sim = later();
    emptyRoad(sim);
    sim.track.coins.push({ id: 1, lane: 0, z: sim.z + 4, y: 0.9, taken: false, sky: false }, { id: 2, lane: 1, z: sim.z + 4, y: 0.9, taken: false, sky: false });
    let evs = drive(sim, 0.6, frame());
    expect(ofType(evs, 'coin')).toHaveLength(1);
    sim.powers.magnet = 5;
    sim.track.coins.push({ id: 3, lane: 1, z: sim.z + 6, y: 0.9, taken: false, sky: false });
    evs = drive(sim, 0.2, frame());
    expect(ofType(evs, 'coin')).toHaveLength(1);
    expect(sim.p.drachmas).toBe(2);
  });

  it('gives the power-ups their upgraded length', () => {
    const sim = later({ progress: { ups: { magnet: 2, sandals: 0, double: 0, wings: 0 } } });
    emptyRoad(sim);
    sim.track.powers.push({ id: 9, kind: 'magnet', lane: 0, z: sim.z + 3, y: 1, taken: false });
    const evs = drive(sim, 0.4, frame());
    expect(ofType(evs, 'power')[0].kind).toBe('magnet');
    expect(sim.powers.magnet).toBeGreaterThan(powerSecFor(2) - 0.5);
    expect(powerSecFor(2)).toBe(RULES.powerSec + 2 * RULES.powerStep);
  });

  it('jumps onto a wagon\'s roof in sandals', () => {
    const sim = later();
    emptyRoad(sim);
    sim.powers.sandals = 9;
    place(sim, 'wagon', 0, 7, { len: 16 });
    sim.act('jump');
    const evs = drive(sim, 1.2, frame());
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    expect(sim.r.roof).toBe(true);
  });

  it('delivers a letter at each relay station', () => {
    const sim = later();
    emptyRoad(sim);
    const evs = drive(sim, (RULES.stationEvery + 30) / RULES.vMin, frame());
    expect(ofType(evs, 'station').length).toBeGreaterThanOrEqual(1);
    expect(sim.p.stations).toBeGreaterThanOrEqual(1);
  });

  it('spells the day\'s word from letters on the road; done, it pays and counts the streak', () => {
    const sim = later();
    emptyRoad(sim);
    const word = sim.word;
    expect(word.length).toBeGreaterThan(2);
    let evs: SimEvent[] = [];
    for (let i = 0; i < word.length; i++) {
      sim.track.letters.push({ id: 100 + i, lane: 0, z: sim.z + 3, y: 1.1, taken: false });
      evs = evs.concat(drive(sim, 0.4, frame()));
    }
    expect(ofType(evs, 'letter').map(e => e.ch).join('')).toBe(word);
    expect(ofType(evs, 'word')).toHaveLength(1);
    expect(sim.p.wordDone).toBe(true);
    expect(sim.p.wordStreak).toBe(1);
  });
});

describe('the wings (push)', () => {
  it('fill only past the lead-in of a sighted push, from a level above the threshold; full = the flight', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.kind).toBe('push');
    drive(sim, RULES.leadIn.fnirs - 0.5, focused(), clock);
    expect(sim.charge).toBe(0);
    const evs = drive(sim, RULES.fillSec.fnirs + 1.5, focused(), clock);
    expect(ofType(evs, 'full')).toHaveLength(1);
    expect(ofType(evs, 'flight').map(e => e.stage)).toContain('start');
    expect(sim.flying).toBe(true);
  });

  it('on HALO the lead-in is 2 s and the ring fills faster', () => {
    const sim = later({ eeg: true });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, RULES.leadIn.eeg + RULES.fillSec.eeg + 1, focused(), clock);
    expect(ofType(evs, 'flight').length).toBeGreaterThan(0);
  });

  it('a level at or below the threshold adds nothing, and a lost signal freezes it (never a loss)', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    drive(sim, 10, frame({ level: 0.5 }), clock);
    expect(sim.charge).toBe(0);
    drive(sim, 3, focused(), clock);
    const c = sim.charge;
    expect(c).toBeGreaterThan(0);
    drive(sim, 4, lost, clock);
    expect(sim.charge).toBe(c);
    expect(sim.meter()).toBeNull();
  });

  it('flies over everything along a trail of drachmas and lands on a clear stretch', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    drive(sim, RULES.leadIn.fnirs + RULES.fillSec.fnirs + 1.5, focused(), clock);
    expect(sim.flying).toBe(true);
    const evs = drive(sim, RULES.flightRise + RULES.flightMax + RULES.flightGlide + 1, frame({ level: 0.3 }), clock);
    expect(ofType(evs, 'stumble')).toHaveLength(0);
    expect(ofType(evs, 'coin').filter(e => e.sky).length).toBeGreaterThan(10);
    expect(ofType(evs, 'flight').map(e => e.stage)).toEqual(['glide', 'end']);
    expect(sim.flying).toBe(false);
    expect(sim.r.y).toBe(0);
    expect(sim.flights).toBe(1);
    expect(flightSecFor(3)).toBe(RULES.flightSec + 3);
  });

  it('shows the lift in the panel: the level in a push, calm in a rest, nothing blind or without a signal', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    drive(sim, 0.1, focused(0.8), clock);
    expect(sim.meter()).toBeCloseTo(0.8);
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.kind).toBe('rest');
    drive(sim, 0.1, calm(0.7), clock);
    expect(sim.meter()).toBeCloseTo(0.7);
    expect(sim.padLevel(calm())).toBeNull();
  });
});

describe('Mgła: the blind push', () => {
  it('comes every 4th push from the 3rd session, never a session\'s first', () => {
    const sim = later({ progress: { sessions: 2, pushes: 2 } });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.blind).toBe(false);
    toBlock(sim, 3, frame(), clock);
    expect(sim.p.pushes).toBe(4);
    expect(sim.block.blind).toBe(true);
    expect(sim.signal().blind).toBe(true);
    expect(sim.meter()).toBeNull();
    const fresh = later({ progress: { sessions: 1, pushes: 3 } });
    toBlock(fresh, 1, frame());
    expect(fresh.block.blind).toBe(false);
  });

  it('hides the wings while it runs and reveals them at its end (flying if the ring is full)', () => {
    const sim = later({ progress: { sessions: 2, pushes: 2 } });
    const clock = { t: 0 };
    toBlock(sim, 3, frame(), clock);
    expect(sim.block.blind).toBe(true);
    const evs = toBlock(sim, 4, focused(), clock);
    expect(ofType(evs, 'flight')).toHaveLength(1);
    expect(ofType(evs, 'reveal')).toHaveLength(1);
    expect(ofType(evs, 'full')).toHaveLength(0);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
  });
});

describe('Strażnice: the rest road', () => {
  it('is slower and quieter, and calm lights each tower passed; three fires throw a shield', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.kind).toBe('rest');
    expect(sim.track.mode).toBe('rest');
    const evs = drive(sim, sim.block.dur - 0.5, calm(), clock);
    const fires = ofType(evs, 'fire').filter(e => e.lit);
    expect(fires.length).toBeGreaterThanOrEqual(3);
    expect(ofType(evs, 'shieldGift').length).toBeGreaterThanOrEqual(1);
    expect(sim.shield).toBe(true);
  });

  it('a busy mind leaves a tower unlit, a lost signal leaves it neutral — never a penalty', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const evs = drive(sim, 12, t => (t < 100 ? frame({ calm: 0.2 }) : lost), clock);
    expect(ofType(evs, 'fire').every(e => e.lit !== true)).toBe(true);
    const s2 = later();
    const c2 = { t: 0 };
    toBlock(s2, 2, frame(), c2);
    const e2 = drive(s2, 12, lost, c2);
    expect(ofType(e2, 'fire').every(e => e.lit === null)).toBe(true);
    expect(ofType(e2, 'stumble')).toHaveLength(0);
  });

  it('judges each block once at its end; a passed rest is the watchmen\'s song', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 2, focused(), clock);
    const evs = toBlock(sim, 3, calm(), clock);
    const v = ofType(evs, 'verdict');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ kind: 'rest', pass: true });
    expect(sim.songs).toBe(1);
  });

  it('gives no verdict without enough signal', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = toBlock(sim, 2, lost, clock);
    expect(ofType(evs, 'verdict')[0].pass).toBeNull();
  });
});

describe('the missions and the multiplier', () => {
  it('come in sets of three; a set done raises the multiplier for good', () => {
    const p = freshProgress();
    expect(multOf(p)).toBe(1);
    const set = missionSet(0);
    expect(set).toHaveLength(3);
    for (const m of set) countMission(p, m.kind, m.target);
    expect(p.sets).toBe(1);
    expect(multOf(p)).toBe(2);
    expect(p.mprog).toEqual([0, 0, 0]);
    expect(missionSet(8)[0].target).toBe(Math.round(missionSet(0)[0].target * 1.5));
  });

  it('counts the in-one-run kinds as the best run, the others as a sum', () => {
    const p = freshProgress();
    countMission(p, 'coinsRun', 50);
    countMission(p, 'coinsRun', 30);
    expect(p.mprog[0]).toBe(50);
    countMission(p, 'jumps', 4);
    countMission(p, 'jumps', 4);
    expect(p.mprog[1]).toBe(8);
  });

  it('pops a mission live in play and lifts the multiplier at once', () => {
    const sim = later({ progress: { mprog: [80, 10, 4] } });
    emptyRoad(sim);
    sim.act('roll');
    const evs = sim.take().concat(drive(sim, 0.2, frame()));
    expect(ofType(evs, 'mission')).toHaveLength(1);
    expect(ofType(evs, 'mult')[0].mult).toBe(2);
    expect(sim.mult).toBe(2);
  });
});

describe('the meta', () => {
  it('walks the road to the seven churches and delivers a city on the way', () => {
    expect(routeAt(0)).toMatchObject({ lap: 1, city: 0, next: 1 });
    expect(routeAt(RULES.legs[0])).toMatchObject({ city: 1 });
    expect(routeAt(LAP + 10).lap).toBe(2);
    expect(citiesBetween(1990, 2010)).toEqual([{ lap: 1, city: 1 }]);
    expect(postcards(0).filter(Boolean)).toHaveLength(1);
    const sim = later({ progress: { metres: RULES.legs[0] - 20 } });
    emptyRoad(sim);
    const evs = drive(sim, 3, frame());
    expect(ofType(evs, 'city')[0]).toMatchObject({ city: 1, lap: 1 });
  });

  it('buys upgrades with drachmas, dearer each level, up to the top', () => {
    const p = freshProgress();
    p.drachmas = 100;
    expect(buyUp(p, 'magnet')).toBe(true);
    expect(p.ups.magnet).toBe(1);
    expect(p.drachmas).toBe(100 - RULES.upCost[0]);
    expect(buyUp(p, 'magnet')).toBe(false);
    p.ups.wings = RULES.upMax;
    p.drachmas = 1e6;
    expect(upPrice(RULES.upMax)).toBeNull();
    expect(buyUp(p, 'wings')).toBe(false);
    expect(UP_IDS).toHaveLength(4);
  });

  it('keeps the day\'s word per day and the streak only for days in a row', () => {
    const p = freshProgress();
    wordToday(p, '2026-11-06');
    wordComplete(p, '2026-11-06');
    wordToday(p, '2026-11-07');
    expect(p.wordDone).toBe(false);
    wordComplete(p, '2026-11-07');
    expect(p.wordStreak).toBe(2);
    wordToday(p, '2026-11-09');
    wordComplete(p, '2026-11-09');
    expect(p.wordStreak).toBe(1);
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayWord(1)).toBe(dayWord(11));
  });

  it('migrates a realistic old save in place: the record and sessions kept, the road and drachmas carried, the rest fresh', () => {
    const old = {
      v: 1, sessions: 7, metres: 5321.4, drachmas: 412, cloak: 2, pushes: 9,
      missions: ['slide10', 'coins300', 'heights20'], missionsDone: 4, missionNext: 7,
      best: { 300: 1840, 180: 990 }, lastLen: 300, bestCombo: 75, heightsBest: 14, firesBest: 6,
      dailyDay: '2026-11-03', dailyMetres: 1200, giftDay: '2026-11-03',
    };
    const p = migrate(mergeSaved(freshProgress(), old));
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.metres).toBe(5321);
    expect(p.drachmas).toBe(412);
    expect(p.best).toBe(1840);
    expect(p.bestMetres).toBe(1840);
    expect(p.pushes).toBe(9);
    expect(p.sets).toBe(0);
    expect(p.ups).toEqual({ magnet: 0, sandals: 0, double: 0, wings: 0 });
    for (const k of ['v', 'cloak', 'missions', 'lastLen', 'bestCombo', 'giftDay']) expect(k in p).toBe(false);
    // and it plays
    const sim = new PoslaniecSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
    expect(sim.score).toBeGreaterThan(0);
    expect(migrate(p)).toBe(p);
  });

  it('never crashes on a damaged save', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 2, sessions: 'x', ups: 'no', mprog: null, taught: [1, 'jump'], best: -5, wordDone: 'yes' }));
    expect(p.sessions).toBe(0);
    expect(p.ups.magnet).toBe(0);
    expect(p.mprog).toEqual([0, 0, 0]);
    expect(p.taught).toEqual(['jump']);
    expect(p.best).toBe(0);
    expect(p.wordDone).toBe(false);
    expect(migrate(mergeSaved(freshProgress(), null)).ver).toBe(2);
  });
});

describe('the coach marks', () => {
  it('in the first-ever session teach jump, roll, a lane and the ramp on the lesson road, one at a time', () => {
    const sim = makeSim({ planned: 300 });
    const evs = drive(sim, RULES.warm.long, frame());
    const what = ofType(evs, 'teach').map(e => e.what);
    expect(what.slice(0, 4)).toEqual(['jump', 'roll', 'lane', 'ramp']);
  });

  it('stop teaching a control once it was done', () => {
    const sim = makeSim({ planned: 300 });
    sim.act('jump');
    sim.act('roll');
    sim.act('left');
    const evs = drive(sim, 12, frame());
    expect(ofType(evs, 'teach').map(e => e.what)).not.toContain('jump');
    expect(sim.p.taught).toEqual(expect.arrayContaining(['jump', 'roll', 'lane']));
  });

  it('explain a power-up the first time it is picked, never again', () => {
    const sim = later();
    emptyRoad(sim);
    sim.track.powers.push({ id: 9, kind: 'double', lane: 0, z: sim.z + 3, y: 1, taken: false });
    let evs = drive(sim, 0.4, frame());
    expect(ofType(evs, 'teach').map(e => e.what)).toEqual(['power.double']);
    sim.track.powers.push({ id: 10, kind: 'double', lane: 0, z: sim.z + 3, y: 1, taken: false });
    evs = drive(sim, 0.4, frame());
    expect(ofType(evs, 'teach')).toHaveLength(0);
  });
});

describe('Klekot, the companion', () => {
  it('has every line in the catalog in four languages, each at most 90 characters', () => {
    for (const [m, n] of Object.entries(SAY)) {
      expect(n, m).toBeGreaterThanOrEqual(3);
      for (let i = 1; i <= n; i++) {
        for (const l of ['pl', 'en', 'de', 'sv'] as const) {
          const s = (CATALOGS[l] as Record<string, unknown>)[`say.${m}.${i}`];
          expect(typeof s, `${l} say.${m}.${i}`).toBe('string');
          expect((s as string).length, `${l} say.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('speaks one line at a time, never repeats one, keeps quiet over a telegraph and the banner', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    let last: unknown = null;
    drive(sim, 120, t => (t % 50 < 25 ? focused() : calm()), clock, () => {
      const l = sim.talk.current;
      if (!l || l === last) return;
      last = l;
      const b = sim.block, nx = sim.plan[sim.blockIndex + 1];
      if (nx) expect(clock.t < b.start + b.dur - RULES.telegraph).toBe(true);
    });
    const texts = sim.talk.said.map(l => l.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBeGreaterThan(3);
  });
});

describe('the summary', () => {
  it('result() is idempotent; finish() settles once, records with Math.max', () => {
    const sim = later({ planned: 60, progress: { best: 10 } });
    const clock = { t: 0 };
    drive(sim, 30, focused(), clock);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThan(0);
    sim.finish();
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.best).toBe(Math.max(10, a.score));
    expect(sim.result().score).toBe(a.score);
    expect(sim.result().record).toBe(true);
  });

  it('closes with a passage that fits and exists, and the story\'s closing line', () => {
    const sim = later({ planned: 60 });
    drive(sim, 20, frame());
    const r = sim.result();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    expect(r.highlights[r.highlights.length - 1]).toMatch(/Klekot/);
    const city = later({ progress: { metres: RULES.legs[0] - 30 } });
    drive(city, 5, frame());
    expect(city.result().verse).toBe('rom10.15');
  });

  it('can stop at once unless a flight is mid-air', () => {
    const sim = later();
    expect(sim.canStop()).toBe(true);
    sim.flight = { stage: 'fly', t: 0, len: 8 };
    expect(sim.canStop()).toBe(false);
    sim.flight.t = 6;
    expect(sim.canStop()).toBe(true);
  });
});

describe('the smoke path', () => {
  it('a tap in the centre every 0.65 s and Space every 2 s score by 22 s, live, first-ever or not, on either band', () => {
    for (const progress of [{}, { sessions: 4, taught: ['jump', 'roll', 'lane', 'ramp'] }]) {
      for (const eeg of [false, true]) {
        const sim = makeSim({ planned: 40, progress, eeg });
        const clock = { t: 0 };
        let lastTap = 0, lastSpace = 0, prev = 0, grew = 0;
        drive(sim, 22, focused(), clock, t => {
          if (t - lastTap >= 0.65) { lastTap = t; sim.act(tapAt(640, 1280)); }
          if (t - lastSpace >= 2) { lastSpace = t; sim.act(keyMove(' ')!); }
          const h = sim.headline().value;
          if (h > prev) grew++;
          prev = h;
        });
        expect(sim.result().score).toBeGreaterThan(0);
        expect(sim.headline().value).toBe(sim.result().score);
        expect(grew).toBeGreaterThan(20);
      }
    }
  });

  it('makes a passable road: a bot that dodges with the generic moves survives most of a long run', () => {
    const sim = later({ planned: 600, seed: 7 });
    const clock = { t: 0 };
    drive(sim, 200, frame(), clock, () => {
      // a fair bot: for what is just ahead in its lane, pick the move the obstacle asks for
      if (sim.phase !== 'play' || sim.flying) return;
      for (const o of sim.track.obstacles) {
        const d = o.z - (o.ramp ? RULES.rampLen : 0) - sim.z;
        if (o.hit || o.lane !== sim.r.lane || d < 0 || d > (o.kind === 'cart' ? 22 : 7)) continue;
        if (o.kind === 'low' && d < 3.2 && sim.r.grounded) sim.act('jump');
        else if (o.kind === 'high' && d < 2.5 && sim.r.grounded && sim.r.rollT <= 0) sim.act('roll');
        else if ((o.kind === 'wagon' && !o.ramp && sim.r.y < 1) || o.kind === 'cart') {
          for (const dir of [-1, 1] as const) {
            const to = sim.r.lane + dir;
            if (to < -1 || to > 1) continue;
            const free = !sim.track.obstacles.some(q => q.lane === to && !q.hit && q.z + q.len > sim.z - 1 && q.z - (q.ramp ? RULES.rampLen : 0) < sim.z + 8 && (q.kind === 'wagon' || q.kind === 'cart'));
            if (free) { sim.act(dir < 0 ? 'left' : 'right'); break; }
          }
        }
        break;
      }
    });
    expect(sim.metresAll).toBeGreaterThan(2000);
    expect(sim.runs).toBeLessThanOrEqual(6);
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('names cities, missions, upgrades and words', () => {
    expect(CITIES).toHaveLength(7);
    expect(CITIES[1].name).toBe('Smyrna');
    for (let k = 0; k < 10; k++) for (const m of missionSet(k)) expect(missionText(m)).toMatch(/\d/);
    expect(t('up.wings')).not.toBe('');
    expect(metres(1234)).toBe('1 234 m');
  });

  it('never asks to concentrate harder, never uses holiness words or "hack"; no Polish in the others', () => {
    for (const [l, cat] of Object.entries(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) {
        const texts = typeof v === 'string' ? [v] : Object.values(v as unknown as Record<string, string>);
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/mocniej|harder|stärker|hårdare|hack|unlock|odblokuj|święt|holy|heilig|helig|błogosław|bless|segen|välsign/i);
          if (l !== 'pl') expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się)\b/);
        }
      }
    }
  });
});

describe('the track', () => {
  it('makes the same road from the same seed and never blocks all three lanes with wagons at once', () => {
    const a = new Track(11, 30), b = new Track(11, 30);
    a.fill(3000, 0.8);
    b.fill(3000, 0.8);
    expect(a.obstacles.map(o => [o.kind, o.lane, Math.round(o.z)])).toEqual(b.obstacles.map(o => [o.kind, o.lane, Math.round(o.z)]));
    for (let z = 30; z < 2900; z += 1) {
      const walls = [-1, 0, 1].filter(l => a.obstacles.some(o => o.lane === l && (o.kind === 'wagon' && !o.ramp) && z >= o.z && z <= o.z + o.len));
      const ramps = [-1, 0, 1].filter(l => a.obstacles.some(o => o.lane === l && o.kind === 'wagon' && (o.ramp || a.obstacles.some(q => q.ramp && q.lane === l && q.z <= o.z && o.z - q.z < 80))));
      if (walls.length === 3) expect(ramps.length, `z ${z}`).toBeGreaterThan(0);
    }
  });

  it('a wagon\'s surface: the ramp rises to the roof', () => {
    const o: Obstacle = { id: 1, kind: 'wagon', lane: 0, z: 100, len: 10, ramp: true, meet: 100, rolling: false, hit: false, passed: false, look: 0 };
    expect(surfaceOf(o, 100 - RULES.rampLen)).toBe(0);
    expect(surfaceOf(o, 100 - RULES.rampLen / 2)).toBeCloseTo(RULES.wagonTop / 2);
    expect(surfaceOf(o, 105)).toBe(RULES.wagonTop);
    expect(surfaceOf(o, 111)).toBe(-1);
  });

  it('keeps the rest road gentle: no carts, no wagons', () => {
    const tr = new Track(5, 0);
    tr.mode = 'rest';
    tr.fill(2000, 0.9);
    expect(tr.obstacles.every(o => o.kind === 'low' || o.kind === 'high')).toBe(true);
  });
});

describe('the lobby', () => {
  it('shows a record only after a first session', async () => {
    const mod = (await import('../src/arcade/poslaniec/index')).default;
    const p = mod.freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 1;
    p.best = 1234;
    expect(mod.best(p)).toBe(1234);
    const how = mod.howto!();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
  });
});

// keep the beginner tuning import meaningful: a beginner session plays the same rules
describe('a beginner', () => {
  it('plays with the beginner tuning', () => {
    const sim = makeSim({ tuning: { ...TUNING, ...BEGINNER_TUNING }, planned: 40 });
    drive(sim, 10, frame());
    expect(sim.score).toBeGreaterThan(0);
  });
});
