import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HILLS, LAMBS, LINES, LINE_COUNT, MOMENTS, RIVALS, RIVAL_LINES, SKINS, UNLOCKS } from '../src/arcade/pasterz/content';
import { CATALOGS, hand, t, unit } from '../src/arcade/pasterz/i18n';
import { howto } from '../src/arcade/pasterz/index';
import { BANNER_ROOM, layout } from '../src/arcade/pasterz/layout';
import { addHome, bestOf, freshProgress, homeFor, migrate, nameLamb, nextUnlock, openWardrobe, owns, wear, type PasterzProgress } from '../src/arcade/pasterz/meta';
import { SANS, SERIF, font } from '../src/arcade/pasterz/paint';
import type { PasterzView } from '../src/arcade/pasterz/render';
import { RULES } from '../src/arcade/pasterz/rules';
import { PasterzSim, RING_MARK, contest, crownFor, listShort, morningFor, planBlocks, ringFor, type SimEvent } from '../src/arcade/pasterz/sim';
import { SAID_KEEP, Talk } from '../src/arcade/pasterz/talk';
import { World } from '../src/arcade/pasterz/world';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TEXT, THUMB, auditTargets, screenKind, target } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 0, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<PasterzProgress>; planned?: number; seed?: number; eeg?: boolean };

function makeSim(o: SimOpts = {}): PasterzSim {
  const sim = new PasterzSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: TUNING,
  });
  sim.start();
  return sim;
}

const TAUGHT = ['steer', 'join', 'whistle', 'rival', 'ring', 'night', 'lamb', 'bigger'];
/** A returning player (no warm-up, every lesson done). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, calls: 1, taught: TAUGHT, ...o.progress } });

function drive(sim: PasterzSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Into block i (the rest of the hill keeps playing). */
function toBlock(sim: PasterzSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  let guard = 0;
  while (sim.blockIndex < i && sim.phase === 'play' && guard++ < 100000) out.push(...drive(sim, STEP, f, clock));
  return out;
}

/** An empty hill around the player: no loose sheep, the rivals far away and asleep in a corner. */
function clearHill(sim: PasterzSim): void {
  sim.sheep.length = 0;
  for (const s of sim.shepherds) {
    s.n = 0;
    if (s.i !== 0) Object.assign(s, { x: 4 + s.i, y: 4, out: true });
  }
  Object.assign(sim.player, { x: 32, y: 32, vx: 0, vy: 0 });
  sim.lamb.state = 'home';
}

/** A sheep at (x, y) for an owner (−1 loose). */
function put(sim: PasterzSim, x: number, y: number, owner: number) {
  const s = {
    id: 9000 + sim.sheep.length, x, y, vx: 0, vy: 0, dir: 0, owner, hx: x, hy: y, gx: x, gy: y, wanderT: 99,
    immune: 0, flash: 0, fetch: -1, fetchT: 0, bob: 0, lie: 0, look: 0, small: false,
  };
  sim.sheep.push(s);
  if (owner >= 0) sim.shepherds[owner].n++;
  return s;
}

/** A hill without the river or pens in the way (for exact contact tests). */
function flat(sim: PasterzSim): void {
  const w = sim.world as unknown as { rocks: unknown[]; trees: unknown[]; bushes: unknown[]; pens: unknown[]; river: string };
  w.rocks.length = 0;
  w.trees.length = 0;
  w.bushes.length = 0;
  w.pens.length = 0;
  w.river = 'none';
}

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more, nights end rounds, the last block ends a round', () => {
    for (const planned of [40, 60, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(sum).toBeLessThanOrEqual(planned + 1);
        if (planned > 60) expect(sum).toBeCloseTo(planned - RULES.finale, 0);
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-6);
        expect(plan[plan.length - 1].kind).toBe('watch');
        expect(plan[plan.length - 1].roundEnd).toBe(true);
        for (const b of plan) if (b.roundEnd) expect(b.kind).toBe('watch');
        if (first) expect(plan[0].kind).toBe('warmup');
        else expect(plan[0].kind).toBe('call');
      }
    }
  });

  it('follows the rhythm the player set in the lobby: longer Wołanie, shorter nights, the jitter scaled; a long call sends more voices', () => {
    for (const planned of [300, 1800]) {
      const plan = planBlocks(planned, false, mulberry32(5), { focus: 90, rest: 15 });
      const call = plan.filter(b => b.kind === 'call'), watch = plan.filter(b => b.kind === 'watch');
      const mean = (bs: typeof plan) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
      expect(mean(call) / mean(watch)).toBeGreaterThan(4);
      expect(mean(call)).toBeGreaterThan(70);
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - RULES.finale, 5);
      for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      expect(plan.at(-1)!.roundEnd).toBe(true);
    }
    // no rhythm: the designed one, the nights a third of the session
    const plan = planBlocks(600, false, mulberry32(5));
    const restShare = plan.filter(b => b.kind === 'watch').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(restShare).toBeGreaterThan(0.27);
    expect(restShare).toBeLessThan(0.4);
    // the sim takes the rhythm: at either extreme a 10-minute session plays its rounds to the end and gathers
    for (const rhythm of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }]) {
      const sim = new PasterzSim({
        progress: { ...freshProgress(), sessions: 5, calls: 1, taught: TAUGHT }, rng: mulberry32(7), day: DAY, daySeed: 4242, plannedSec: 600, eeg: false, tuning: TUNING, rhythm,
      });
      sim.start();
      const calls = sim.plan.filter(b => b.kind === 'call');
      const m = calls.reduce((s, b) => s + b.dur, 0) / calls.length;
      expect(m).toBeGreaterThan(rhythm.focus * 0.75);
      expect(m).toBeLessThan(rhythm.focus * 1.25);
      let voices = 0, nextTap = 0.65;
      // the coarsest step the sim takes (0.1 s), a focus held from the call's start (its seconds grow with the block)
      const DT = 0.1;
      for (let i = 1; i <= Math.round((600 + RULES.settle) / DT); i++) {
        const t = i * DT;
        if (t >= nextTap) { nextTap += 0.65; sim.whistle(); }
        sim.update(DT, sim.block?.kind === 'watch' ? CALM : frame({ level: 0.9, activity: 5, focused: true, hold: sim.blockT, calm: 0.05 }), t);
        voices += ofType(sim.take(), 'voice').length;
      }
      expect(sim.phase).toBe('done');
      expect(sim.roundsDone).toBe(sim.roundsPlanned);
      expect(sim.score).toBeGreaterThan(10);
      // a 2-minute call has room for more than two voices
      if (rhythm.focus > 60) expect(voices).toBeGreaterThan(2 * calls.length);
    }
  });

  it('makes rounds of about two minutes: two days and two nights each', () => {
    const plan = planBlocks(600, false, mulberry32(3));
    const rounds = plan.filter(b => b.roundEnd).length;
    expect(rounds).toBeGreaterThanOrEqual(4);
    let len = 0, n = 0;
    for (const b of plan) {
      len += b.dur;
      if (b.roundEnd) {
        n++;
        expect(len).toBeGreaterThan(100);
        // (the last round takes a lone pair left over: three pairs)
        expect(len).toBeLessThan(n === rounds ? 250 : 180);
        len = 0;
      }
    }
  });
});

describe('the pure rules', () => {
  it('the ring grows with the level, the threshold circle at its middle', () => {
    expect(ringFor(0)).toBe(RULES.r0);
    expect(ringFor(1)).toBe(RULES.r0 + RULES.rExtra);
    expect(RING_MARK).toBeCloseTo((ringFor(0) + ringFor(1)) / 2);
    expect(ringFor(-1)).toBe(RULES.r0);
  });

  it('the bigger flock wins at a contact; equal ones bounce', () => {
    expect(contest(5, 3)).toBe(1);
    expect(contest(3, 5)).toBe(-1);
    expect(contest(4, 4)).toBe(0);
  });

  it('pays the crown and the second place; nothing for an empty flock', () => {
    expect(crownFor(1, 50)).toBe(Math.round(50 * RULES.crownShare) + RULES.crownFlat);
    expect(crownFor(2, 50)).toBe(RULES.secondFlat);
    expect(crownFor(3, 50)).toBe(0);
    expect(crownFor(1, 0)).toBe(0);
  });

  it('morning lambs grow with the stars', () => {
    expect(morningFor(0)).toBe(2);
    expect(morningFor(6)).toBe(3);
    expect(morningFor(12)).toBe(4);
  });
});

describe('the hill', () => {
  it('is seeded, has its pens, its bridges and a far-off lost lamb', () => {
    for (const def of HILLS) {
      const a = new World(77, def, RULES.rivals), b = new World(77, def, RULES.rivals);
      expect(a.starts).toEqual(b.starts);
      expect(a.starts).toHaveLength(RULES.rivals + 1);
      expect(a.pens.length).toBeGreaterThan(0);
      if (def.river !== 'none') expect(a.bridges).toHaveLength(def.bridges);
      const s = a.starts[0];
      expect(Math.hypot(a.lamb.x - s.x, a.lamb.y - s.y)).toBeGreaterThan(10);
      expect(a.wet(s.x, s.y)).toBe(false);
    }
  });

  it('keeps bodies out of the river except on a bridge, and routes across a bridge', () => {
    const def = HILLS.find(h => h.river === 'v')!;
    const w = new World(5, def, 5);
    const y = 10, c = w.riverAt(y);
    const p = w.push({ x: c, y }, 0.4, c - 3, y);
    expect(w.wet(p.x, p.y)).toBe(false);
    expect(p.x).toBeLessThan(c);
    const goal = w.waypoint(c - 5, y, c + 5, y);
    const ends = w.bridges.map((_, i) => w.bridgeEnds(i)[0]);
    expect(ends.some(e => Math.hypot(e.x - goal.x, e.y - goal.y) < 0.01)).toBe(true);
  });

  it('walls a pen except at its gate', () => {
    const def = HILLS.find(h => h.pens >= 3)!;
    const w = new World(9, def, 5);
    const pen = w.pens[0];
    const back = pen.gate + Math.PI;
    const inside = { x: pen.x + Math.cos(back) * (pen.r - 0.5), y: pen.y + Math.sin(back) * (pen.r - 0.5) };
    const p = w.push({ x: pen.x + Math.cos(back) * pen.r, y: pen.y + Math.sin(back) * pen.r }, 0.36, inside.x, inside.y);
    expect(Math.hypot(p.x - pen.x, p.y - pen.y)).toBeLessThan(pen.r);
    const [out] = w.gate(0);
    expect(Math.hypot(out.x - pen.x, out.y - pen.y)).toBeGreaterThan(pen.r);
  });
});

describe('the flocks', () => {
  it('a loose sheep touched by the flock joins it (the score counts it at once)', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    put(sim, 32.6, 32, 0);
    put(sim, 33.2, 32, -1);
    const before = sim.score;
    const ev = drive(sim, 0.3, frame());
    expect(ofType(ev, 'join').length).toBeGreaterThanOrEqual(1);
    expect(sim.player.n).toBe(2);
    expect(sim.score).toBe(before + 1);
  });

  it('the bigger flock wins the smaller one\'s sheep at the contact, one by one', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    const r = sim.shepherds[1];
    Object.assign(r, { out: false, x: 34.5, y: 32, habit: null, think: 99, mode: 'idle', tx: 34.5, ty: 32 });
    for (let i = 0; i < 12; i++) put(sim, 32 + (i % 4) * 0.5, 31 + Math.floor(i / 4) * 0.6, 0);
    for (let i = 0; i < 4; i++) put(sim, 33.8 + (i % 2) * 0.5, 31.6 + Math.floor(i / 2) * 0.6, 1);
    r.think = 99;
    const ev = drive(sim, 2, frame());
    const steals = ofType(ev, 'steal');
    expect(steals.length).toBeGreaterThan(0);
    expect(steals.every(s => s.to === 0)).toBe(true);
    expect(sim.player.n).toBeGreaterThan(12);
  });

  it('a rival with no sheep left, touched by a bigger flock, is out till the round ends', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    const r = sim.shepherds[2];
    Object.assign(r, { out: false, x: 33, y: 32, habit: null, think: 99, tx: 33, ty: 32 });
    for (let i = 0; i < 6; i++) put(sim, 32.4 + (i % 3) * 0.4, 31.6 + Math.floor(i / 3) * 0.5, 0);
    const ev = drive(sim, 1.5, frame());
    expect(ofType(ev, 'out').some(e => e.who === 2 && e.by === 0)).toBe(true);
    expect(r.out).toBe(true);
    expect(sim.rivalsOut).toBe(1);
  });

  it('the player is never out: eaten down to the shepherd, Łatek pulls him to safety (grace)', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    put(sim, 10, 10, -1);
    put(sim, 50, 50, -1);
    const r = sim.shepherds[1];
    Object.assign(r, { out: false, x: 33.2, y: 32, habit: null });
    for (let i = 0; i < 8; i++) put(sim, 32.4 + (i % 4) * 0.4, 32.3 + Math.floor(i / 4) * 0.4, 1);
    sim.banked = 30;
    const ev = drive(sim, 0.5, frame());
    const tumble = ofType(ev, 'tumble');
    expect(tumble).toHaveLength(1);
    expect(sim.player.out).toBe(false);
    expect(sim.player.grace).toBeGreaterThan(0);
    expect(Math.hypot(sim.player.x - 32, sim.player.y - 32)).toBeGreaterThan(3);
    expect(sim.banked).toBe(30);
    expect(sim.score).toBeGreaterThanOrEqual(30);
  });

  it('a tap whistles: Łatek runs to the nearest loose sheep and herds them in', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    for (let i = 0; i < 3; i++) put(sim, 38 + i * 0.5, 32, -1);
    sim.whistle();
    expect(sim.dog.state).toBe('run');
    const ev = drive(sim, 2, frame());
    expect(ofType(ev, 'herd').length).toBe(1);
    expect(sim.player.n).toBe(3);
    sim.whistle();
    expect(sim.whistleCool).toBeGreaterThan(0);
  });

  it('left alone, Łatek leads the shepherd to the nearest loose sheep', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    put(sim, 40, 32, -1);
    drive(sim, 4, frame());
    expect(sim.player.n).toBe(1);
  });

  it('a drag steers like a joystick', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    sim.drag(60, 0);
    drive(sim, 1, frame());
    expect(sim.player.x).toBeGreaterThan(34);
    sim.drag(null);
  });
});

describe('the rivals', () => {
  it('flee a bigger flock and hunt a smaller one', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    const a = sim.shepherds[1], b = sim.shepherds[2];
    Object.assign(a, { out: false, x: 20, y: 20, habit: null, think: 0, habitNext: 99 });
    Object.assign(b, { out: false, x: 25, y: 20, habit: null, think: 0, habitNext: 99 });
    for (let i = 0; i < 10; i++) put(sim, 19 + (i % 3) * 0.5, 19 + Math.floor(i / 3) * 0.5, 1);
    for (let i = 0; i < 3; i++) put(sim, 26 + i * 0.5, 21, 2);
    drive(sim, 0.1, frame());
    expect(a.mode).toBe('hunt');
    expect(b.mode).toBe('flee');
    expect(b.tx).toBeGreaterThan(b.x);
  });

  it('a long chase gives up for a while', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    const a = sim.shepherds[1], b = sim.shepherds[2];
    // neither gets anywhere (both stand): the chase goes on in vain
    Object.assign(a, { out: false, x: 20, y: 20, habit: null, habitNext: 999, speedMul: 0 });
    Object.assign(b, { out: false, x: 27, y: 20, habit: null, habitNext: 999, speedMul: 0 });
    for (let i = 0; i < 10; i++) put(sim, 19 + (i % 3) * 0.5, 19 + Math.floor(i / 3) * 0.5, 1);
    put(sim, 27.5, 20.5, 2);
    let gaveUp = false;
    drive(sim, 12, frame(), { t: 0 }, () => { if (a.huntCool > 0) gaveUp = true; });
    expect(gaveUp).toBe(true);
  });
});

describe('the band', () => {
  it('in a sighted Wołanie past the lead-in the ring follows the level and pulls loose sheep in', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    put(sim, 32 + 5.5, 32, -1);
    sim.drag(0, 0);   // a finger down without moving: the shepherd stands
    drive(sim, RULES.leadIn.fnirs + 3, HIGH);
    expect(sim.ringR).toBeGreaterThan(RING_MARK);
    expect(sim.player.n).toBe(1);
    expect(sim.meter()!).toBeGreaterThan(0.5);
  });

  it('without the signal the ring rests at r0 and nothing is lost', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    put(sim, 32 + 5.5, 32, -1);
    sim.drag(0, 0);
    drive(sim, 8, NONE);
    expect(sim.ringR).toBeCloseTo(RULES.r0, 3);
    expect(sim.player.n).toBe(0);
    expect(sim.meter()).toBeNull();
  });

  it('a held focus sends the Głos: loose sheep in reach walk over, the lost lamb shows', () => {
    const sim = later();
    clearHill(sim);
    flat(sim);
    sim.lamb.state = 'hidden';
    for (let i = 0; i < 4; i++) put(sim, 32 + 10, 32 + i, -1);
    sim.drag(0, 0);
    const ev = drive(sim, 12, t => frame({ level: 0.95, activity: 6, focused: true, hold: t }));
    const v = ofType(ev, 'voice');
    expect(v.length).toBeGreaterThanOrEqual(1);
    expect(v[0].called).toBe(4);
    expect(sim.player.n).toBe(4);
    expect(sim.voices).toBeGreaterThanOrEqual(1);
  });

  it('a Nocna straż: everyone beds down, calm lights the stars and each brings a straggler; no stealing at night', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.kind).toBe('watch');
    clearHill(sim);
    flat(sim);
    for (let i = 0; i < 20; i++) put(sim, 20 + i, 50, -1);
    const r = sim.shepherds[1];
    Object.assign(r, { out: false, x: 33, y: 32 });
    for (let i = 0; i < 9; i++) put(sim, 33 + (i % 3) * 0.4, 32 + Math.floor(i / 3) * 0.4, 1);
    put(sim, 32.3, 32, 0);
    const ev = drive(sim, sim.block.dur - sim.blockT - 0.2, CALM, clock);
    expect(ofType(ev, 'steal')).toHaveLength(0);
    expect(ofType(ev, 'tumble')).toHaveLength(0);
    expect(sim.stars).toBeGreaterThanOrEqual(6);
    expect(ofType(ev, 'join').filter(j => j.via === 'star').length).toBeGreaterThanOrEqual(4);
    expect(sim.meter()!).toBeGreaterThan(0.5);
  });

  it('a passed night brings morning lambs; a night without a pass still brings one (grace)', () => {
    const a = later(), clock = { t: 0 };
    toBlock(a, 1, frame(), clock);
    const ev = toBlock(a, 2, CALM, clock);
    const end = ofType(ev, 'blockEnd').find(e => e.block.kind === 'watch')!;
    expect(end.verdict).toBe(true);
    expect(ofType(ev, 'morning')[0].n).toBe(morningFor(end.stars));
    const b = later(), c2 = { t: 0 };
    toBlock(b, 1, frame(), c2);
    const ev2 = toBlock(b, 2, NONE, c2);
    expect(ofType(ev2, 'morning')[0].n).toBe(RULES.graceLambs);
  });

  it('blind Wołanie from the 3rd session every 4th: the ring stays at r0, then flares by the share', () => {
    const sim = makeSim({ progress: { sessions: 4, calls: 2, taught: TAUGHT } });
    const clock = { t: 0 };
    const ev = toBlock(sim, 2, HIGH, clock);
    expect(sim.block.kind).toBe('call');
    expect(sim.block.blind).toBe(true);
    expect(sim.meter()).toBeNull();
    const ev2 = toBlock(sim, 3, HIGH, clock);
    expect(ofType([...ev, ...ev2], 'flare').length).toBe(1);
    expect(sim.blindShare).toBeGreaterThan(50);
  });

  it('judges each block once at its end and reports the strategy and the seconds left', () => {
    const sim = later();
    const clock = { t: 0 };
    const ev = toBlock(sim, 2, HIGH, clock);
    const ends = ofType(ev, 'blockEnd');
    expect(ends).toHaveLength(2);
    expect(ends[0].verdict).toBe(true);
    expect(sim.tip.length).toBeGreaterThan(5);
  });

  it('the pad holds still in a night and a blind block', () => {
    const sim = later();
    toBlock(sim, 1, frame());
    expect(sim.padLevel(CALM)).toBeNull();
  });
});

describe('the rounds', () => {
  it('a round ends at dawn: the tally banks the flock and its bonus, and the next hill comes', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    const ev: SimEvent[] = [];
    const firstEnd = sim.plan.findIndex(b => b.roundEnd);
    ev.push(...toBlock(sim, firstEnd + 1, HIGH, clock));
    const ends = ofType(ev, 'roundEnd');
    expect(ends).toHaveLength(1);
    const tl = ends[0].tally;
    expect(tl.score).toBe(tl.flock + tl.crown + tl.lamb);
    expect(sim.banked).toBe(tl.score);
    expect(sim.score).toBe(sim.banked + sim.player.n);
    expect(ofType(ev, 'newRound')).toHaveLength(1);
    expect(sim.roundIndex).toBe(1);
    expect(sim.hill.index).toBe(1);
    expect(sim.tallyT).toBeGreaterThan(0);
    expect(sim.p.hill).toBe(1);
    expect(sim.p.rounds).toBe(1);
  });

  it('a whole session: every planned round is tallied once, the finale settles', () => {
    const sim = later({ planned: 300 });
    const ev = drive(sim, 310, HIGH);
    expect(ofType(ev, 'roundEnd')).toHaveLength(sim.roundsPlanned);
    expect(ofType(ev, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.p.sessions).toBe(6);
    expect(sim.canStop()).toBe(true);
    expect(sim.score).toBeGreaterThan(30);
  });

  it('the lost lamb carried home is worth its bonus and gets a name', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    drive(sim, 1, frame(), clock);
    sim.lamb.state = 'hidden';
    Object.assign(sim.player, { x: sim.lamb.x + 0.5, y: sim.lamb.y });
    const ev = drive(sim, 0.2, frame(), clock);
    expect(ofType(ev, 'lambFound')).toHaveLength(1);
    expect(sim.lamb.state).toBe('carried');
    const ev2 = drive(sim, 70, frame(), clock);
    const tl = ofType(ev2, 'roundEnd')[0].tally;
    expect(tl.lamb).toBe(RULES.lambBonus);
    expect(tl.lambName).toBe(LAMBS[0].name);
    expect(sim.p.lambs).toEqual([0]);
  });
});

describe('the smoke test', () => {
  for (const sessions of [0, 5]) {
    it(`centre taps and Space gather sheep within 22 s (${sessions ? 'returning' : 'first-ever'} player)`, () => {
      const sim = makeSim({ progress: { sessions }, planned: 180, seed: 11 });
      let nextTap = 0.65, nextSpace = 2;
      const seen: number[] = [];
      drive(sim, 22, HIGH, { t: 0 }, t => {
        if (t >= nextTap) {
          nextTap += 0.65;
          sim.whistle();
        }
        if (t >= nextSpace) {
          nextSpace += 2;
          sim.key(' ', true);
          sim.key(' ', false);
        }
        if (Math.abs(t - Math.round(t)) < STEP / 2) seen.push(sim.score);
      });
      expect(sim.result().score).toBeGreaterThan(0);
      expect(seen[5]).toBeGreaterThan(0);
      expect(seen[seen.length - 1]).toBeGreaterThan(seen[2]);
    });
  }
});

describe('the session record', () => {
  it('result() is idempotent and keeps the record with Math.max', () => {
    const sim = later({ planned: 60 });
    drive(sim, 20, HIGH);
    const a = sim.result(), total = sim.p.total;
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.total).toBe(total);
    expect(sim.p.best['60']).toBe(a.score);
    expect(a.unit).toBe(unit(a.score));
    expect(a.stats.length).toBeGreaterThan(4);
  });

  it('finish() settles an early end: the round is tallied once, the session counted', () => {
    const sim = later({ planned: 300 });
    drive(sim, 30, HIGH);
    const n = sim.player.n;
    sim.finish();
    sim.finish();
    expect(ofType(sim.take(), 'roundEnd')).toHaveLength(1);
    expect(sim.p.sessions).toBe(6);
    expect(sim.banked).toBeGreaterThanOrEqual(n);
    expect(sim.result().score).toBe(sim.banked);
  });

  it('closes with a passage that exists, and the highlights are short', () => {
    const sim = later({ planned: 60 });
    drive(sim, 70, HIGH);
    const r = sim.result();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    expect(r.highlights.length).toBeGreaterThan(0);
    expect(r.highlights.length).toBeLessThanOrEqual(5);
  });
});

describe('the tutorial', () => {
  it('the first-ever session teaches the controls with coach marks, one at a time', () => {
    const sim = makeSim({ planned: 180 });
    const ev = drive(sim, 15, frame());
    const hints = ofType(ev, 'hint');
    expect(hints[0].key).toBe('steer');
    expect(hints.map(h => h.key)).toContain('join');
    for (let i = 1; i < hints.length; i++) expect(hints[i].x).toBeTypeOf('number');
  });

  it('no coach mark for the hands in a night', () => {
    const sim = makeSim({ planned: 180, progress: { taught: ['join', 'rival', 'ring', 'lamb', 'bigger', 'night'] } });
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const ev = drive(sim, sim.block.dur - 1, frame(), clock);
    expect(ofType(ev, 'hint')).toHaveLength(0);
  });

  it('a returning player who learnt everything gets no coach marks', () => {
    const sim = later();
    const ev = drive(sim, 60, HIGH);
    expect(ofType(ev, 'hint')).toHaveLength(0);
  });

  it('Łatek talks at the opening and never over a telegraph', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    let over = 0;
    drive(sim, 120, HIGH, clock, () => { if (sim.telegraphing && sim.talk.line && sim.talk.line.t > 0.2) over++; });
    expect(sim.talk.said.length).toBeGreaterThan(2);
    expect(over).toBe(0);
  });
});

describe('the meta', () => {
  it('the hundred grows by a tenth of the flock, and turns into a season', () => {
    const p = freshProgress();
    expect(homeFor(4)).toBe(1);
    expect(homeFor(57)).toBe(5);
    p.flock = 97;
    expect(addHome(p, 5)).toBe(1);
    expect(p.flock).toBe(2);
    expect(p.season).toBe(1);
  });

  it('names the twelve lambs in turn, then they come home again', () => {
    const p = freshProgress();
    for (let i = 0; i < LAMBS.length; i++) expect(nameLamb(p)).toEqual({ index: i, isNew: true });
    expect(nameLamb(p)).toEqual({ index: 0, isNew: false });
  });

  it('the wardrobe opens with the sheep gathered, wears the new piece, and the panel can change it', () => {
    const p = freshProgress();
    p.total = RULES.unlockEvery * 2 + 5;
    const got = openWardrobe(p);
    expect(got).toEqual(UNLOCKS.slice(0, 2));
    expect(p.wear[UNLOCKS[0].kind]).toBe(UNLOCKS[0].index);
    expect(owns(p, 'crook', 3)).toBe(false);
    expect(wear(p, 'cloak', 0)).toBe(true);
    expect(wear(p, 'crook', 3)).toBe(false);
    expect(nextUnlock(p)!.left).toBe(RULES.unlockEvery - 5);
    for (const k of ['cloak', 'crook', 'dog'] as const) expect(SKINS[k].length).toBeGreaterThan(UNLOCKS.filter(u => u.kind === k).length);
  });

  it('migrates a realistic version-1 save in place: the records and sessions stay, the rest starts afresh', () => {
    const old = {
      v: 1, sessions: 7, total: 312, flock: 41, season: 0, lambs: [0, 1, 2], lambsFound: 3, calls: 9,
      missions: ['gather15', 'lamb', 'voice2'], missionsDone: 4, missionNext: 7,
      best: { '180': 38, '300': 52, bad: 'x' }, lastLen: 300, bestStars: 9, dailyDay: '2026-11-01', dailyGathered: 20, giftDay: '2026-11-01',
    };
    const p = { ...freshProgress(), ...old } as unknown as PasterzProgress;
    expect(migrate(p)).toBe(true);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.best).toEqual({ '180': 38, '300': 52 });
    expect(p.lastLen).toBe(300);
    expect(p.total).toBe(0);
    expect(p.lambs).toEqual([]);
    expect((p as unknown as Record<string, unknown>).missions).toBeUndefined();
    expect(bestOf(p)).toBe(52);
    expect(migrate(p)).toBe(false);
    // and plays
    const sim = new PasterzSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, HIGH);
    expect(sim.score).toBeGreaterThanOrEqual(0);
  });

  it('never crashes on fields of the wrong type', () => {
    const p = { ...freshProgress(), ver: 2, lambs: 'x', hillCrowns: null, wear: 5, taught: {}, total: 'lots' } as unknown as PasterzProgress;
    migrate(p);
    expect(p.lambs).toEqual([]);
    expect(p.hillCrowns).toEqual([]);
    expect(p.wear).toEqual({ cloak: 0, crook: 0, dog: 0 });
    expect(p.taught).toEqual([]);
    expect(p.total).toBe(0);
  });
});

describe('the words', () => {
  it('the catalog is complete in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('Łatek has at least three lines per moment, each a bubble of at most 90 characters', () => {
    for (const m of MOMENTS) {
      expect(LINES[m].length).toBeGreaterThanOrEqual(LINE_COUNT);
      for (const s of LINES[m]) expect(s.length).toBeLessThanOrEqual(RULES.talkChars);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('dog.') || k.startsWith('rv.')) expect((v as string).length, `${l}.${k}`).toBeLessThanOrEqual(RULES.talkChars);
    }
    for (const lines of Object.values(RIVAL_LINES)) expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('strategies, never "harder"; no holiness words in the verdict-like lines', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (typeof v !== 'string') continue;
        if (k.startsWith('tip.') || k.startsWith('how.')) expect(v).not.toMatch(/mocniej|harder|stärker|hårdare/i);
        expect(v).not.toMatch(/\bhack|unlock|neurohack/i);
      }
    }
  });

  it('the rivals have names and dyes of their own', () => {
    expect(new Set(RIVALS.map(r => r.dye)).size).toBe(RIVALS.length);
    for (const r of RIVALS) expect(r.name.length).toBeGreaterThan(2);
    expect(t('sub.place', { n: 2, of: 6 })).toContain('2');
  });
});

describe('the speech bubble', () => {
  it('says one line at a time, waits while blocked', () => {
    const talk = new Talk(LINES, mulberry32(1));
    talk.ask('open', 1, 5);
    talk.update(0.1, 0.1, true);
    expect(talk.line).toBeNull();
    talk.update(0.1, 0.2, false);
    expect(talk.line?.moment).toBe('open');
  });
});

// ── on a phone first (src/arcade/DESIGN.md §12) ──
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
/** every string drawn on a canvas made by the patched getContext, with its font size */
const drawn: { text: string; px: number }[] = [];

/** A context that draws nothing, measures text at 0.55 em a character and notes each string drawn with its size. */
function noteContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const note = (s: unknown) => {
    const text = String(s);
    if (text.trim() && (state.globalAlpha as number) > 0.05) drawn.push({ text, px: pxOf(String(state.font)) });
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * pxOf(String(target.font)) * 0.55 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: unknown) => note(s);
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

type Size = (typeof CHECK_SIZES)[number];
const upright = (z: Size) => z.w < 600;

describe('on a phone first: the layout', () => {
  it('the font helper never goes under 11 px', () => {
    for (const px of [0, 4, 8.8, 9.2, 10.5, 10.99, 11, 13, 24, 40]) {
      for (const fam of [SANS, SERIF]) expect(pxOf(font(700, px, fam, px > 20))).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(pxOf(font(800, 24, SERIF))).toBe(24);
    expect(font(600, 13.37, SANS)).toBe(`600 13.4px ${SANS}`);
  });

  it('every checked screen: a scale from the phone, the shepherd in the field, the ranking under the HUD, no tiny world', () => {
    for (const z of CHECK_SIZES) {
      const L = layout(z.w, z.h, z.insets);
      const name = z.name;
      expect(L.u, name).toBeGreaterThanOrEqual(1);
      // a big screen's UI grows with it (§14), up to DESK_MAX; anything smaller stops at 1.3
      expect(L.u, name).toBeLessThanOrEqual(Math.min(z.w, z.h) >= DESK_BIG ? DESK_MAX : 1.3);
      // a phone upright is sized at 1 (a 412 px phone grows a hair)
      if (upright(z)) expect(L.u, name).toBeLessThanOrEqual(1.06);
      // no reserve at the bottom: the room runs to the home indicator
      expect(L.top, name).toBe(z.insets.top);
      expect(L.bottom, name).toBe(z.h - z.insets.bottom);
      expect(L.cy, name).toBeGreaterThan(L.field.top);
      expect(L.cy, name).toBeLessThan(L.field.bottom);
      expect(L.rank.y, name).toBeGreaterThanOrEqual(L.top);
      expect(L.rank.x, name).toBeGreaterThanOrEqual(L.left);
      expect(L.rank.x + L.rank.w, name).toBeLessThanOrEqual(L.right);
      expect(L.stars.x, name).toBeGreaterThanOrEqual(L.left);
      expect(L.stars.x + L.stars.w, name).toBeLessThanOrEqual(L.right);
      // the tally card: a sheet from the bottom, under the runner's (brief) block banner — one column upright
      expect(L.card.y, name).toBeGreaterThanOrEqual(L.top + BANNER_ROOM * L.u - 0.5);
      expect(L.card.y + L.card.h, name).toBeLessThanOrEqual(L.bottom);
      expect(L.card.h, name).toBeGreaterThanOrEqual(upright(z) ? 240 : 170);
      expect(L.card.w, name).toBeGreaterThanOrEqual(Math.min(330, z.w - 30));
      expect(L.cardWide, name).toBe(!L.tall);
      // a phone upright sees about 14 m across (a sheep ~25 px long, its ring readable), a wide screen 15.5 m
      if (upright(z)) expect((L.right - L.left) / L.S0, name).toBeLessThanOrEqual(14.5);
      expect(L.S0, name).toBeGreaterThanOrEqual(21);
    }
  });

  it("Łatek's button: a 60–70 px disc, a clear target in the bottom-right thumb zone inside the safe area; the smoke's centre tap lands on the field", () => {
    for (const z of CHECK_SIZES) {
      const L = layout(z.w, z.h, z.insets);
      const b = L.whistle, name = z.name;
      expect(b.r * 2, name).toBeGreaterThanOrEqual(60);
      expect(b.r * 2, name).toBeLessThanOrEqual(70);
      expect(auditTargets([target('whistle', b.hit)], z.w, z.h, z.insets), name).toEqual([]);
      expect(b.hit.x + b.hit.w, name).toBeLessThanOrEqual(z.w - 16);
      // the dock's relayed touches come in at y = h − 1: they steer, never press the button
      expect(b.hit.y + b.hit.h, name).toBeLessThan(z.h - 1);
      expect(b.x, name).toBeGreaterThan((L.left + L.right) / 2);
      if (upright(z)) expect(b.y, name).toBeGreaterThanOrEqual(z.h * (1 - THUMB));
      const sx = z.w / 2, sy = z.h * 0.6;
      expect(sx >= b.hit.x && sx <= b.hit.x + b.hit.w && sy >= b.hit.y && sy <= b.hit.y + b.hit.h, name).toBe(false);
      // bubbles and coach marks keep above its row
      expect(L.field.bottom, name).toBeLessThanOrEqual(b.hit.y);
    }
  });
});

describe('on a phone first: the game at every checked size', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return noteContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  const returning = (): PasterzProgress => ({ ...freshProgress(), sessions: 5, calls: 1, taught: [...TAUGHT] });
  type Hint = { text: string; at: { x: number; y: number } | null };

  function envFor(z: { w: number; h: number; insets: Insets }, progress: PasterzProgress, touch: boolean, hints: Hint[]): GameEnv<PasterzProgress> {
    return {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress, rng: mulberry32(3), day: DAY, daySeed: 7, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false,
      tuning: TUNING, hint: (text: string, at?: { x: number; y: number } | null) => { if (text) hints.push({ text, at: at ?? null }); },
      hudTop: () => z.insets.top, insets: () => z.insets, touch,
    };
  }

  async function gameAt(z: { w: number; h: number; insets: Insets }, touch = true, progress = returning(), hints: Hint[] = []) {
    const mod = (await import('../src/arcade/pasterz/index')).default;
    const game = mod.create(envFor(z, progress, touch, hints));
    game.resize(z.w, z.h, 1);
    game.start();
    const inner = game as unknown as { sim: PasterzSim; view: PasterzView };
    return { game, sim: inner.sim, view: inner.view, clock: { t: 0 } };
  }

  const run = (game: ArcadeGame, clock: { t: number }, sec: number, f = frame()) => {
    for (let i = 0; i < Math.round(sec * 30); i++) {
      clock.t += 1 / 30;
      game.update(1 / 30, f, clock.t);
      game.draw();
    }
  };

  /** On to the block where `done` holds: each block's clock is run out in one frame (the hill holds its state). */
  const skipTo = (game: ArcadeGame, sim: PasterzSim, clock: { t: number }, done: () => boolean) => {
    for (let guard = 0; guard < 20 && !done(); guard++) {
      sim.blockT = sim.block.dur;
      clock.t += sim.block.dur;
      game.update(1 / 30, frame(), clock.t);
    }
    expect(done()).toBe(true);
  };

  /** Text allowed under MIN_READ (never under MIN_TEXT): a name cut to the ranking's room, the ranking's header, a count. */
  const secondary = (s: string): boolean =>
    /^[\d:+−-]+$/.test(s) || s.endsWith('…') || s.startsWith(t('ui.round', { n: 1, of: 1 }).split(' ')[0]) || RIVALS.some(r => r.name === s) || s === t('ui.you');

  /** Draw one frame and check it: the targets (size, the safe area, no overlaps) and every string (≥ 11 px; under 13 only a secondary label). */
  function check(game: ArcadeGame, z: { name: string; w: number; h: number; insets: Insets }, what: string): string[] {
    drawn.length = 0;
    game.draw();
    const name = `${z.name}: ${what}`;
    const ts = game.targets!();
    expect(auditTargets(ts, z.w, z.h, z.insets), name).toEqual([]);
    expect(drawn.filter(d => d.px < MIN_TEXT - 1e-6), name).toEqual([]);
    expect(drawn.filter(d => d.px < MIN_READ - 1e-6 && !secondary(d.text)), name).toEqual([]);
    return ts.map(x => x.label);
  }

  it('by day, with bubbles, in a night, on the tally and the last card: targets and text pass the phone checks', async () => {
    // every size with a finger, and with a mouse where the canvas is a desktop's
    const runs = CHECK_SIZES.flatMap(z => [{ z, touch: true }, ...(layout(z.w, z.h, z.insets, screenKind(z.w, z.h, false)).desk ? [{ z, touch: false }] : [])]);
    expect(runs.length).toBeGreaterThan(CHECK_SIZES.length + 3);
    for (const { z, touch } of runs) {
      const { game, sim, clock } = await gameAt(z, touch);
      run(game, clock, 0.6, HIGH);
      expect(check(game, z, 'by day'), z.name).toEqual([t('ui.whistle')]);
      expect(drawn.some(d => d.text === t('ui.round', { n: 1, of: sim.roundsPlanned })), z.name).toBe(true);
      // Łatek at length, a rival close by with a bubble of his own
      const pl = sim.player, rv = sim.shepherds[1];
      Object.assign(rv, { x: pl.x + 2.5, y: pl.y + 1.5, out: false });
      sim.talk.line = { moment: 'open', text: 'Pięcioro pasterzy już biega. Spokojnie, mają gorszego psa, a ja mam jeszcze siły!', t: 0.6, dur: 4 };
      rv.say = { text: 'Chrrr… pięć minut…', t: 0.5 };
      check(game, z, 'bubbles');
      // a night: the button steps aside, the stars take the top band
      skipTo(game, sim, clock, () => sim.nightBlock);
      run(game, clock, 1.6, CALM);
      expect(check(game, z, 'a night'), z.name).toEqual([]);
      // the round's tally at dawn
      skipTo(game, sim, clock, () => sim.tallyT > 0);
      run(game, clock, 1.2);
      expect(sim.frozen, z.name).toBe(true);
      expect(check(game, z, 'the tally'), z.name).toEqual([]);
      expect(drawn.some(d => d.text === t('tally.score')), z.name).toBe(true);
      // the session's last card
      sim.finish();
      expect(check(game, z, 'the last card'), z.name).toEqual([]);
      game.destroy();
    }
  });

  it('the joystick shows from the touch-down and steers past the slop; a short tap whistles; the button is pressed at the touch and whistles on the lift; a thumb that slides off steers', async () => {
    const z = CHECK_SIZES[0];
    const { game, sim, view, clock } = await gameAt(z);
    clearHill(sim);
    run(game, clock, 0.4);
    // the field: the base and the knob at once, the walk only past the slop
    game.pointer!({ type: 'down', x: 120, y: 300, id: 1 });
    expect(view.stick).toMatchObject({ ox: 120, oy: 300, on: false });
    game.pointer!({ type: 'move', x: 126, y: 300, id: 1 });
    expect(view.stick).toMatchObject({ on: false });
    game.pointer!({ type: 'move', x: 175, y: 300, id: 1 });
    expect(view.stick).toMatchObject({ on: true });
    const x0 = sim.player.x;
    run(game, clock, 0.6);
    expect(sim.player.x).toBeGreaterThan(x0 + 1);
    // a finger that runs far past the rim drags the base along
    game.pointer!({ type: 'move', x: 320, y: 300, id: 1 });
    expect(view.stick!.ox).toBeGreaterThan(120 + RULES.stickPx);
    game.pointer!({ type: 'up', x: 320, y: 300, id: 1 });
    expect(view.stick).toBeNull();
    expect(sim.whistleCool).toBe(0);
    // a short tap on the field whistles
    game.pointer!({ type: 'down', x: 120, y: 300, id: 2 });
    game.pointer!({ type: 'up', x: 123, y: 302, id: 2 });
    expect(sim.whistleCool).toBeGreaterThan(0);
    run(game, clock, RULES.whistleCool + 0.3);
    expect(sim.whistleCool).toBe(0);
    // the button: pressed at the touch (no joystick), the whistle on the lift
    const b = view.L.whistle;
    game.pointer!({ type: 'down', x: b.x, y: b.y, id: 3 });
    expect(view.hud.pressed).toBe(true);
    expect(view.stick).toBeNull();
    expect(sim.whistleCool).toBe(0);
    game.pointer!({ type: 'up', x: b.x + 2, y: b.y, id: 3 });
    expect(view.hud.pressed).toBe(false);
    expect(sim.whistleCool).toBeGreaterThan(0);
    // too soon: no whistle (the button shakes)
    const cool = sim.whistleCool;
    game.pointer!({ type: 'down', x: b.x, y: b.y, id: 4 });
    game.pointer!({ type: 'up', x: b.x, y: b.y, id: 4 });
    expect(sim.whistleCool).toBe(cool);
    run(game, clock, RULES.whistleCool + 0.3);
    // a thumb that slides off the button steers from there, and whistles nothing
    game.pointer!({ type: 'down', x: b.x, y: b.y, id: 5 });
    game.pointer!({ type: 'move', x: b.x - 60, y: b.y, id: 5 });
    expect(view.hud.pressed).toBe(false);
    expect(view.stick).toMatchObject({ on: true });
    const x1 = sim.player.x;
    run(game, clock, 0.5);
    expect(sim.player.x).toBeLessThan(x1 - 1);
    game.pointer!({ type: 'up', x: b.x - 60, y: b.y, id: 5 });
    expect(sim.whistleCool).toBe(0);
    expect(view.stick).toBeNull();
  });

  it('coach marks: the whistle points at the button on a touch screen; a point high on the hill keeps its bubble below the HUD', async () => {
    const z = CHECK_SIZES[0];
    const hints: Hint[] = [];
    const { game, sim, view, clock } = await gameAt(z, true, returning(), hints);
    run(game, clock, 0.4);
    const say = (game as unknown as { hint(e: Extract<SimEvent, { type: 'hint' }>): void }).hint.bind(game);
    say({ type: 'hint', key: 'whistle', x: sim.player.x, y: sim.player.y });
    expect(hints.at(-1)).toEqual({ text: t('hint.whistle'), at: { x: view.L.whistle.x, y: view.L.whistle.hit.y } });
    say({ type: 'hint', key: 'rival', x: sim.player.x, y: sim.player.y - 40 });
    expect(hints.at(-1)!.at!.y).toBeGreaterThanOrEqual(view.L.top + 96);
    // Łatek's bubble steps aside while a coach mark speaks
    expect(sim.hushUntil).toBeGreaterThan(sim.t + 4);
    sim.talk.ask('open', 9, 9);
    run(game, clock, 1);
    expect(sim.talk.line).toBeNull();
    const desk = await gameAt(CHECK_SIZES[7], false, returning(), hints);
    run(desk.game, desk.clock, 0.4);
    (desk.game as unknown as { hint(e: Extract<SimEvent, { type: 'hint' }>): void }).hint({ type: 'hint', key: 'whistle', x: desk.sim.player.x, y: desk.sim.player.y });
    expect(hints.at(-1)!.text).toBe(t('hint.whistle.keys'));
  });

  it('the camera keeps to the hill: near its edge the room shows at most a metre beyond it, and the shepherd walks off the middle', async () => {
    for (const z of [CHECK_SIZES[0], CHECK_SIZES[4], CHECK_SIZES[8]]) {
      const { game, sim, view, clock } = await gameAt(z);
      const L = view.L;
      for (const [x, y] of [[0.8, 0.8], [sim.world.w - 0.8, sim.world.h - 0.8]] as const) {
        Object.assign(sim.player, { x, y, vx: 0, vy: 0 });
        run(game, clock, 2);
        const a = view.toWorld(L.left, L.top), b = view.toWorld(L.right, L.bottom);
        expect(a.x, z.name).toBeGreaterThanOrEqual(-1.05);
        expect(a.y, z.name).toBeGreaterThanOrEqual(-1.05);
        expect(b.x, z.name).toBeLessThanOrEqual(sim.world.w + 1.05);
        expect(b.y, z.name).toBeLessThanOrEqual(sim.world.h + 1.05);
        expect(Math.hypot(view.sx(sim.player.x) - L.cx, view.sy(sim.player.y) - L.cy), z.name).toBeGreaterThan(20);
      }
      game.destroy();
    }
  });

  it('speaks of the hand the player has: no keys on a touch screen, keys as shortcuts on a desktop', () => {
    const named = (s: string) => /WASD|Spac|Leertaste|mellanslag|Enter|strzałk|arrow|Pfeil|pilar|klik|click|Klick|mysz|mouse|Maus|musen/i.test(s);
    for (const k of ['how.drag', 'how.tap', 'hint.steer', 'hint.whistle', 'hint.join', 'tip.warmup.1', 'tip.warmup.2', 'tip.warmup.3'] as const) {
      for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
        const touchText = String(CATALOGS[lang][k]);
        expect(named(touchText), `${lang} ${k}: ${touchText}`).toBe(false);
        const desk = (CATALOGS[lang] as Record<string, unknown>)[`${k}.keys`];
        if (desk !== undefined) expect(named(String(desk)), `${lang} ${k}.keys: ${String(desk)}`).toBe(true);
      }
    }
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) expect(named(String(CATALOGS[lang]['how.keys'])), lang).toBe(true);
    expect(hand('hint.whistle', true)).toBe(t('hint.whistle'));
    expect(hand('hint.whistle', false)).toBe(t('hint.whistle.keys'));
    expect(hand('hint.ring', false)).toBe(t('hint.ring'));
    // the how-to card: the keys on a row of their own (the runner drops it on a touch screen)
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('coarse'), media: q }));
    const how = howto();
    vi.unstubAllGlobals();
    expect(how.hands.map(h => h.gesture)).toEqual(['drag', 'tap', 'keys']);
    for (const h of how.hands.filter(x => x.gesture !== 'keys')) expect(named(h.text), h.text).toBe(false);
  });

  // ── a desktop and a big screen (DESIGN §14) ──
  it('a mouse walks him to the pointer while its button is held, a click whistles, the hover shows the way', async () => {
    for (const z of CHECK_SIZES.filter(c => layout(c.w, c.h, c.insets, screenKind(c.w, c.h, false)).desk)) {
      const { game, sim, view, clock } = await gameAt(z, false);
      clearHill(sim);
      run(game, clock, 0.4);
      const L = view.L;
      expect(L.desk, z.name).toBe(true);
      // the hover: a ring where the pointer rests and the way to it; nothing moves
      const me = () => ({ x: view.sx(sim.player.x), y: view.sy(sim.player.y) });
      const x0 = sim.player.x, y0 = sim.player.y;
      const to = { x: me().x + 6 * view.S, y: me().y - 2 * view.S };
      game.pointer!({ type: 'move', x: to.x, y: to.y, id: 1 });
      expect(view.hover, z.name).toMatchObject({ x: to.x, y: to.y });
      run(game, clock, 0.5);
      expect(Math.hypot(sim.stickX, sim.stickY), z.name).toBeLessThan(0.08);
      expect(view.follow, z.name).toBeNull();
      Object.assign(sim.player, { x: x0, y: y0, vx: 0, vy: 0 });
      run(game, clock, 0.05);
      // held: he walks toward the pointer (no joystick under it), and stops near it
      game.pointer!({ type: 'down', x: to.x, y: to.y, id: 1 });
      run(game, clock, 1.2);
      expect(view.stick, z.name).toBeNull();
      expect(sim.player.x - x0, z.name).toBeGreaterThan(2);
      expect(sim.player.y - y0, z.name).toBeLessThan(0);
      game.pointer!({ type: 'up', x: to.x, y: to.y, id: 1 });
      expect(sim.whistleCool, z.name).toBe(0);
      // a click (quick, in place) whistles
      game.pointer!({ type: 'down', x: to.x, y: to.y, id: 2 });
      game.pointer!({ type: 'up', x: to.x + 2, y: to.y, id: 2 });
      expect(sim.whistleCool, z.name).toBeGreaterThan(0);
      run(game, clock, RULES.whistleCool + 0.3);
      // the button: a click on it whistles; the mouse resting on it lights it
      const b = L.whistle;
      game.pointer!({ type: 'move', x: b.x, y: b.y, id: 1 });
      expect(view.hud.hoverBtn, z.name).toBe(true);
      game.pointer!({ type: 'down', x: b.x, y: b.y, id: 3 });
      game.pointer!({ type: 'up', x: b.x, y: b.y, id: 3 });
      expect(sim.whistleCool, z.name).toBeGreaterThan(0);
      // a mouse that slides off the button walks him to the pointer (no joystick under a mouse), no whistle
      run(game, clock, RULES.whistleCool + 0.3);
      const y1 = sim.player.y;
      game.pointer!({ type: 'down', x: b.x, y: b.y, id: 4 });
      game.pointer!({ type: 'move', x: b.x, y: b.y - 10 * view.S, id: 4 });
      run(game, clock, 0.8);
      expect(view.stick, z.name).toBeNull();
      expect(sim.player.y, z.name).toBeLessThan(y1 - 1);
      game.pointer!({ type: 'up', x: b.x, y: b.y - 10 * view.S, id: 4 });
      expect(sim.whistleCool, z.name).toBe(0);
      game.destroy();
    }
  });

  it('lists the keys first at a keyboard and speaks of the mouse there', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q }));
    const how = howto();
    vi.unstubAllGlobals();
    expect(how.hands.map(h => h.gesture)).toEqual(['keys', 'hold', 'tap']);
    const MOUSE = /klik|click|Klick|mysz|mouse|Maus|mus/i;
    const TOUCH = /stuk|\btap\b|tipp|palc|finger|Finger|fingret/i;
    for (const h of how.hands.slice(1)) {
      expect(h.text, h.text).toMatch(MOUSE);
      expect(h.text, h.text).not.toMatch(TOUCH);
    }
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[lang] as Record<string, unknown>;
      for (const k of Object.keys(cat).filter(x => x.endsWith('.keys'))) expect(String(cat[k]), `${lang} ${k}`).not.toMatch(TOUCH);
      for (const k of ['tip.warmup.1.keys', 'tip.warmup.3.keys', 'hint.steer.keys', 'how.drag.keys', 'how.tap.keys']) expect(String(cat[k]), `${lang} ${k}`).toMatch(MOUSE);
    }
    // the warm-up's tips in the panel: a mouse's words at a desktop (each of the three)
    for (let seed = 1; seed <= 6; seed++) {
      const sim = new PasterzSim({ progress: freshProgress(), rng: mulberry32(seed), day: DAY, daySeed: 4242, plannedSec: 300, eeg: false, tuning: TUNING });
      sim.handKeys = true;
      sim.start();
      expect(sim.block.kind).toBe('warmup');
      expect(sim.tip, sim.tip).not.toMatch(TOUCH);
    }
  });
});

describe('Pasterz: a desktop and a big screen (DESIGN §14)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const mouse = (z: Size) => layout(z.w, z.h, z.insets, screenKind(z.w, z.h, false));

  it('a finger keeps the phone layout at every size; a mouse at a desktop-sized canvas gets the desktop one', () => {
    for (const z of CHECK_SIZES) {
      expect(layout(z.w, z.h, z.insets), z.name).toEqual(layout(z.w, z.h, z.insets, screenKind(z.w, z.h, true)));
      expect(layout(z.w, z.h, z.insets).desk, z.name).toBe(false);
      expect(mouse(z).desk, z.name).toBe(['desktop', 'big'].includes(screenKind(z.w, z.h, false)));
    }
  });

  it("Łatek's button by the play on a desktop: under the shepherd at the bottom's middle, never in a corner", () => {
    for (const z of CHECK_SIZES) {
      const L = mouse(z);
      if (!L.desk) continue;
      const b = L.whistle, name = z.name;
      expect(auditTargets([target('whistle', b.hit)], z.w, z.h, z.insets), name).toEqual([]);
      expect(Math.abs(b.x - L.cx), name).toBeLessThan(1);
      expect(b.y, name).toBeGreaterThan(L.cy);
      expect(b.hit.y + b.hit.h, name).toBeLessThan(z.h - 1);
      expect(L.field.bottom, name).toBeLessThanOrEqual(b.hit.y);
      // the smoke's centre tap lands on the field
      const sx = z.w / 2, sy = z.h * 0.6;
      expect(sx >= b.hit.x && sx <= b.hit.x + b.hit.w && sy >= b.hit.y && sy <= b.hit.y + b.hit.h, name).toBe(false);
      // the ranking stays inside, clear of the button
      expect(L.rank.x + L.rank.w, name).toBeLessThanOrEqual(L.right);
      expect(L.rank.y + L.rank.h, name).toBeLessThan(b.hit.y);
    }
  });

  it('grows the hill on a big screen: sheep more than twice a phone\'s, a little more of the hill in sight, the UI past 1.3', () => {
    const phone = layout(CHECK_SIZES[0].w, CHECK_SIZES[0].h, CHECK_SIZES[0].insets);
    const big = CHECK_SIZES.filter(z => Math.min(z.w, z.h) >= DESK_BIG);
    expect(big.length).toBeGreaterThanOrEqual(2);
    for (const z of big) {
      const L = mouse(z), name = z.name;
      expect(L.kind, name).toBe('big');
      expect(L.S0 / phone.S0, name).toBeGreaterThan(2);
      // the phone's layout at the same size stopped at 48 px a metre (a hill of tiny sheep)
      expect(L.S0 / layout(z.w, z.h, z.insets).S0, name).toBeGreaterThan(1.1);
      const across = (L.right - L.left) / L.S0;
      expect(across, name).toBeGreaterThan(16);
      expect(across, name).toBeLessThan(26);
      expect(L.u, name).toBeGreaterThan(1.3);
      expect(L.whistle.r * 2, name).toBeGreaterThan(70);
    }
  });
});

describe('long sessions (15–30 minutes)', () => {
  it('plans 15, 20, 25 and 30 minutes like the short ones: day and night in turn, rounds of about two minutes, a night last', () => {
    for (const planned of [900, 1200, 1500, 1800]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(planned + (first ? 1 : 0)));
        const name = `${planned}${first ? ' first' : ''}`;
        expect(plan.reduce((s, b) => s + b.dur, 0), name).toBeCloseTo(planned - RULES.finale, 0);
        const play = first ? plan.slice(1) : plan;
        if (first) expect(plan[0].kind, name).toBe('warmup');
        play.forEach((b, i) => {
          expect(b.kind, name).toBe(i % 2 ? 'watch' : 'call');
          expect(b.dur, name).toBeGreaterThanOrEqual(RULES.minBlock - 1e-6);
          expect(b.dur, name).toBeLessThanOrEqual(RULES.push[0] + RULES.push[1] + 2);
        });
        expect(plan[plan.length - 1].kind, name).toBe('watch');
        expect(plan[plan.length - 1].roundEnd, name).toBe(true);
        let len = 0, rounds = 0;
        const last = plan.filter(b => b.roundEnd).length;
        for (const b of plan) {
          len += b.dur;
          if (!b.roundEnd) continue;
          rounds++;
          expect(len, name).toBeGreaterThan(100);
          // (the last round takes a lone pair left over: three pairs)
          expect(len, name).toBeLessThan(rounds === last ? 250 : 180);
          len = 0;
        }
        expect(rounds, name).toBe(Math.floor(play.length / 4));
        // a round of two 67 s pairs: about one every 2¼ minutes
        expect(rounds, name).toBeGreaterThanOrEqual(Math.floor(planned / 140));
      }
    }
  });

  it('a 30-minute session from the first ever plays every round to the finale; nothing piles up', () => {
    // the coarsest step the sim takes (its dt is clamped to 0.1 s): 18 000 frames
    const sim = makeSim({ planned: 1800, progress: { sessions: 0 }, seed: 7 });
    const DT = 0.1, n = Math.round(1815 / DT);
    let nextTap = 0.65, maxSheep = 0, maxPrints = 0, finales = 0, rounds = 0, scoreAt20 = 0;
    for (let i = 1; i <= n; i++) {
      const t = i * DT;
      if (t >= nextTap) {
        nextTap += 0.65;
        sim.whistle();
      }
      sim.update(DT, sim.block?.kind === 'watch' ? CALM : HIGH, t);
      for (const e of sim.take()) {
        if (e.type === 'finale') finales++;
        if (e.type === 'roundEnd') rounds++;
      }
      maxSheep = Math.max(maxSheep, sim.sheep.length);
      maxPrints = Math.max(maxPrints, sim.prints.length);
      if (i === 12000) scoreAt20 = sim.score;
    }
    expect(sim.phase).toBe('done');
    expect(finales).toBe(1);
    expect(rounds).toBe(sim.roundsPlanned);
    expect(sim.roundsDone).toBe(sim.roundsPlanned);
    expect(sim.roundsPlanned).toBeGreaterThanOrEqual(12);
    // it keeps giving to the end: hills come round again, the last ten minutes still gather
    expect(sim.score).toBeGreaterThan(scoreAt20 * 1.2);
    expect(sim.p.hill).toBe(sim.roundsPlanned);
    for (const v of [sim.score, sim.banked, sim.p.total, sim.p.flock, sim.ringR, sim.player.x, sim.player.y]) expect(Number.isFinite(v)).toBe(true);
    expect(sim.p.flock).toBeLessThan(RULES.hundred);
    expect(maxSheep).toBeLessThanOrEqual(RULES.maxSheep);
    expect(maxPrints).toBeLessThanOrEqual(140);
    expect(sim.talk.said.length).toBeLessThanOrEqual(SAID_KEEP);
    expect(sim.talk.said.every(l => l && !l.includes('undefined'))).toBe(true);
    const r = sim.result();
    expect(sim.p.best['1800']).toBe(r.score);
    expect(r.highlights.length).toBeLessThanOrEqual(5);
    for (const h of r.highlights) {
      expect(h).not.toMatch(/undefined|NaN/);
      expect(h.length, h).toBeLessThanOrEqual(90);
    }
    for (const [k, v] of r.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
  });

  it('the summary names three new pieces or lambs at most, and counts the rest', () => {
    expect(listShort(['a'])).toBe('a');
    expect(listShort(['a', 'b', 'c'])).toBe('a, b, c');
    expect(listShort(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c +2');
    const sim = later({ planned: 60 });
    for (let i = 0; i < 14; i++) sim.lambsNamed.push({ index: i % LAMBS.length, isNew: i < LAMBS.length });
    sim.unlocksNow.push(...UNLOCKS);
    drive(sim, 1, HIGH);
    const hl = sim.result().highlights;
    const lambs = hl.find(h => h.includes(LAMBS[0].name))!;
    expect(lambs).toContain('(14)');
    expect(lambs).toContain(`+${LAMBS.length - 3}`);
    const wardrobe = hl.find(h => h.includes(t('skin.cloak.1' as 'skin.cloak.0')))!;
    expect(wardrobe).toContain(`+${UNLOCKS.length - 3}`);
  });
});
