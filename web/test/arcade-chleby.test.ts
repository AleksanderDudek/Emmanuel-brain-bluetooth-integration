import { describe, expect, it } from 'vitest';
import { makeBoss, munchSpots, stepBoss, stunBoss, type BossEvent } from '../src/arcade/chleby/boss';
import {
  CARDS, KINDS, MAX_LEVEL, PACK, copiesFor, evoOf, levelOf, oddsWith, rollPack, starterCards, type CardId, type Loadout,
} from '../src/arcade/chleby/cards';
import { HINTS, HINTS_KEYS, LINES, bossName, buildName, cardName, cardText, dayName, hintFor, missionText, tierName } from '../src/arcade/chleby/content';
import {
  Field, bossOf, isBoss, placeOf, planTerrace, terracesOf, type FieldCtl, type FieldEvent, type Runner, type Shot, type TerracePlan,
} from '../src/arcade/chleby/field';
import { CATALOGS, t, unit } from '../src/arcade/chleby/i18n';
import {
  EDGE, chlebyTargets, giantRect, helpRect, layout, revealGeo, sheetBox, tablesBand, toScreen, villageGeo, wonBox, type Layout, type Rect,
} from '../src/arcade/chleby/layout';
import {
  BOSSES, BUILDINGS, BUILD_PRICES, MISSION_KINDS, addCrumbs, bestOf, build, buildPrice, champBonus, dayOf, fishEvery, freshProgress, giftOf, helpNeed,
  luckOf, migrate, offers, parOf, progressMission, starsFor, starsTotal, streamRate, tierFloor, tierOf, villageLevel, type ChlebyProgress,
  type DayKind,
} from '../src/arcade/chleby/meta';
import { SANS, SERIF, font } from '../src/arcade/chleby/paint';
import { RULES, goldMult } from '../src/arcade/chleby/rules';
import { ChlebySim, planBlocks, sayDur, type SimEvent } from '../src/arcade/chleby/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, TAP_GAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-11';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const CALM: FieldCtl = { gold: 1, rest: false, quiet: true, basketX: 5 };
const LOAF: Shot = { look: 'bochenek', w: 1, speed: RULES.loafSpeed };
const champ = (id: Runner['champ'], w: number, extra: Partial<Shot> = {}): Shot =>
  ({ look: 'bochenek', w, speed: RULES.champ[id ?? 'kosz'].speed, champ: id, evo: 0, dx: 0, ...extra });

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ activity: 9, level: 0.95, focused: true, hold: 10, calm: 0.05 });
const LOW = frame({ activity: -3, level: 0.1, focused: false, calm: 0.95 });

/** A day seed whose weather is `want` (the day is date-seeded; tests pick one). */
function seedFor(want: DayKind): number {
  for (let s = 1; s < 100000; s++) if (dayOf(s) === want) return s;
  throw new Error(want);
}
const PLAIN = seedFor('zwykly');

type SimOpts = { progress?: Partial<ChlebyProgress>; planned?: number; seed?: number; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ChlebySim {
  const sim = new ChlebySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: o.daySeed ?? PLAIN, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no gift, the opening card and every coach mark seen): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, calls: 1, seen: 1, taught: 0xffffff, ...o.progress } });

/** A player with these cards (one copy each, beside the starter ones) and this loadout. */
const withCards = (load: Partial<Loadout>, extra: Partial<Record<CardId, number>> = {}): Partial<ChlebyProgress> => {
  const cards: Record<string, number> = { ...starterCards() };
  for (const id of Object.values(load)) cards[id] = Math.max(cards[id] ?? 0, 1);
  Object.assign(cards, extra);
  return { cards, loadout: { kosz: 'mama', chleb: 'bochenek', mistrz: 'kosz', pomoc: 'mewy', ...load } };
};

function drive(sim: ChlebySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

function toBlock(sim: ChlebySim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

/** Pour at the first gate until the level is won (or `sec` runs out). */
function winLevel(sim: ChlebySim, clock = { t: 0 }, sec = 60): SimEvent[] {
  let evs: SimEvent[] = [];
  for (let i = 0; i < sec * 2 && !evs.some(e => e.type === 'won'); i++) {
    sim.press(sim.field.gates[0].x);
    evs = evs.concat(drive(sim, 0.5, HIGH, clock));
    sim.release();
  }
  return evs;
}

/** A terrace with only the gates given, one table of `hunger`, no boss, no elements. */
function bare(gates: Partial<TerracePlan['gates'][number]>[] = [], hunger = 500, level = 1, extra: Partial<TerracePlan> = {}): Field {
  const plan: TerracePlan = {
    ...planTerrace(level, 0), arena: null, pads: [], brook: null, rocks: [],
    gates: gates.map(g => ({ kind: 'mul', n: 2, y: 6, x0: 5, slide: 0, ...g })),
    tables: [{ x: 5, half: 5, hunger }], hunger, ...extra,
  };
  const f = new Field(plan, { seed: 3 });
  f.gold.slide = 0;
  f.gold.x0 = -50;   // the golden gate out of the way unless a test wants it
  return f;
}

function stepField(f: Field, sec: number, ctl: FieldCtl = CALM): FieldEvent[] {
  const out: FieldEvent[] = [];
  for (let i = 0; i < Math.round(sec / STEP); i++) {
    f.step(STEP, ctl);
    out.push(...f.take());
  }
  return out;
}

const fedBy = (evs: readonly FieldEvent[]) => evs.reduce((s, e) => s + (e.type === 'feed' ? e.n : 0), 0);
const gull = (x: number, y: number, kind: 'gull' | 'fat' | 'mirka' = 'gull') =>
  ({ id: 900 + Math.round(x * 10 + y * 100), kind, x, y, w: kind === 'fat' ? RULES.fatW : 1, state: 'walk' as const, t: 1, dir: 1, carry: false, lag: 0 });
/** A runner that stands still (speed 0), for the bosses' tests. */
const still = (x: number, y: number, id: number): Runner =>
  ({ id, x, y, vx: 0, w: 1, mask: 0, age: 0, look: 'bochenek', speed: 0, flat: false, warm: false, champ: null, evo: 0, fuse: 0, burst: 0, tumble: 0, hit: false });

// ── the path ─────────────────────────────────────────────────────
describe('the path of hillsides', () => {
  it('has chapters of four, the fourth ending in a boss arena, and comes round after six', () => {
    expect(placeOf(0)).toEqual({ chapter: 0, circle: 0, local: 0 });
    expect(isBoss(3)).toBe(true);
    expect(isBoss(4)).toBe(false);
    expect(placeOf(24)).toEqual({ chapter: 0, circle: 1, local: 0 });
  });

  it('grows from one terrace to three', () => {
    expect(terracesOf(0)).toBe(1);
    expect(terracesOf(RULES.twoTerraces)).toBe(2);
    expect(terracesOf(RULES.threeTerraces)).toBe(3);
  });

  it('plans the same terrace for everyone, with a ×2 first and the golden gate in the middle', () => {
    const a = planTerrace(5, 1), b = planTerrace(5, 1);
    expect(a).toEqual(b);
    expect(a.gates[0]).toMatchObject({ kind: 'mul', y: 3.6 });
    expect(a.goldY).toBeGreaterThan(5);
    expect(a.goldY).toBeLessThan(RULES.laneH - 5);
    expect(a.hunger).toBe(a.tables.reduce((s, x) => s + x.hunger, 0));
  });

  it('ends every chapter in a boss arena with its own layout: Pelikan, Kozioł, Czapla, Kormorany', () => {
    const arena = (L: number) => planTerrace(L, terracesOf(L) - 1);
    expect([3, 7, 11, 15, 19, 23].map(L => arena(L).arena)).toEqual(['pelikan', 'koziol', 'czapla', 'kormorany', 'pelikan', 'koziol']);
    expect(bossOf(3)).toBe('kormorany');
    expect(planTerrace(3, 0).arena).toBe(terracesOf(3) === 1 ? 'pelikan' : null);
    expect(planTerrace(2, 0).arena).toBeNull();
    expect(arena(7).rocks.length).toBeGreaterThan(0);
    expect(arena(7).pads.length).toBe(2);
    expect(arena(11).brook).not.toBeNull();
    expect(arena(15).rocks.length).toBe(4);
    expect(arena(7).hunger).toBeGreaterThan(planTerrace(6, terracesOf(6) - 1).hunger);
  });

  it('brings the lane’s elements in as the levels grow, never before their level', () => {
    const plans = Array.from({ length: 40 }, (_, L) => Array.from({ length: terracesOf(L) }, (_, i) => planTerrace(L, i))).flat().filter(p => !p.arena);
    const first = (has: (p: TerracePlan) => boolean) => Math.min(...plans.filter(has).map(p => p.level));
    expect(first(p => p.pads.length > 0 && !p.brook)).toBeGreaterThanOrEqual(RULES.sprintFrom);
    expect(first(p => p.gates.some(g => g.kind === 'jar'))).toBeGreaterThanOrEqual(RULES.jarFrom);
    expect(first(p => p.rocks.length > 0)).toBeGreaterThanOrEqual(RULES.rocksFrom);
    expect(first(p => p.brook !== null)).toBeGreaterThanOrEqual(RULES.brookFrom);
    expect(first(p => p.gates.some(g => g.kind === 'mul' && g.n >= 4))).toBeGreaterThanOrEqual(RULES.fourFrom);
    for (const has of [(p: TerracePlan) => p.pads.length > 0, (p: TerracePlan) => p.gates.some(g => g.kind === 'jar'), (p: TerracePlan) => p.rocks.length > 0,
      (p: TerracePlan) => p.brook !== null, (p: TerracePlan) => p.gates.some(g => g.n >= 4)]) expect(plans.some(has)).toBe(true);
  });

  it('gets hungrier level by level and time round', () => {
    expect(planTerrace(10, 0).hunger).toBeGreaterThan(planTerrace(1, 0).hunger);
    expect(planTerrace(24, 0).hunger).toBeGreaterThan(planTerrace(0, 0).hunger);
  });

  it('adds the start gate only with the village’s Brama', () => {
    expect(planTerrace(1, 0).gates.some(g => g.kind === 'start')).toBe(false);
    expect(planTerrace(1, 0, 2).gates.some(g => g.kind === 'start')).toBe(true);
  });
});

// ── the field ────────────────────────────────────────────────────
describe('a terrace: runners, gates, tables', () => {
  it('feeds the table with every runner that reaches the top', () => {
    const f = bare([]);
    for (let i = 0; i < 10; i++) f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(10);
    expect(f.tables[0].hunger).toBe(490);
  });

  it('multiplies by a honey gate once per runner', () => {
    const f = bare([{ kind: 'mul', n: 3, y: 6 }, { kind: 'mul', n: 2, y: 9, x0: -50 }]);
    f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(3);
    expect(evs.some(e => e.type === 'gate' && e.kind === 'mul' && e.made === 2)).toBe(true);
  });

  it('chains gates: ×2 then ×3 makes six', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 5 }, { kind: 'mul', n: 3, y: 10 }]);
    f.gates.forEach(g => { if (g.kind === 'mul') g.half = 5; });
    f.fire(5, LOAF);
    expect(fedBy(stepField(f, 6))).toBe(6);
  });

  it('a green gate pops its number once, then recharges', () => {
    const f = bare([{ kind: 'add', n: 10, y: 6 }]);
    f.gates[0].half = 5;
    f.fire(5, LOAF);
    f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(12);
    expect(f.gates[0].charge).toBe(1);
  });

  it('a grey gate swallows its count, breaks, and comes back', () => {
    const f = bare([{ kind: 'sub', n: 3, y: 6 }]);
    f.gates[0].half = 5;
    for (let i = 0; i < 5; i++) f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(2);
    expect(evs.filter(e => e.type === 'swallow')).toHaveLength(3);
    expect(evs.some(e => e.type === 'break')).toBe(true);
    stepField(f, RULES.greyBack);
    expect(f.gates[0].left).toBe(3);
  });

  it('the jar drinks loaves until it is full, then opens as ×3 for a while, then empties again', () => {
    const f = bare([{ kind: 'jar', n: RULES.jarMult, y: 4, half: 5 }], 900);
    const jar = f.gates[0];
    expect(jar.need).toBe(RULES.jarNeed + Math.floor(1 / 2));
    for (let i = 0; i < jar.need; i++) f.fire(5, LOAF);
    let evs = stepField(f, 2);
    expect(evs.filter(e => e.type === 'swallow' && e.jar).reduce((s, e) => s + (e.type === 'swallow' ? e.n : 0), 0)).toBe(jar.need);
    expect(evs.some(e => e.type === 'jarOpen')).toBe(true);
    expect(jar.open).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) f.fire(5, LOAF);
    evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(4 * RULES.jarMult);
    stepField(f, RULES.jarOpen);
    expect(jar.open).toBe(0);
    expect(jar.left).toBe(jar.need);
  });

  it('a flatbread slips under a grey gate and the jar', () => {
    const f = bare([{ kind: 'sub', n: 5, y: 4, half: 5 }, { kind: 'jar', n: 3, y: 8, half: 5 }]);
    for (let i = 0; i < 4; i++) f.fire(5, { ...LOAF, look: 'podplomyk', flat: true });
    const evs = stepField(f, 7);
    expect(evs.some(e => e.type === 'swallow')).toBe(false);
    expect(fedBy(evs)).toBe(4);
  });

  it('the golden gate multiplies by what the band says, carrying the halves', () => {
    const f = bare([]);
    f.gold.x0 = 5;
    f.gold.half = 5;
    for (let i = 0; i < 4; i++) f.fire(5, LOAF);
    const evs = stepField(f, 6, { ...CALM, gold: 2.5 });
    expect(fedBy(evs)).toBe(10);
    expect(f.goldPassed).toBe(4);
    const g = bare([]);
    g.gold.x0 = 5;
    g.fire(5, LOAF);
    expect(fedBy(stepField(g, 6, { ...CALM, gold: 1 }))).toBe(1);
  });

  it('past the crowd cap a gate makes runners heavier instead', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 3 }]);
    f.gates[0].half = 5;
    for (let i = 0; i < RULES.maxRunners; i++) f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(2 * RULES.maxRunners);
    expect(f.crowd).toBe(0);
  });

  it('pebble arrows make runners sprint straight up', () => {
    const plain = bare([]), pads = bare([], 500, 1, { pads: [{ x: 5, half: 5, y0: 0, y1: 20 }] });
    plain.fire(5, { ...LOAF, dx: 0 });
    pads.fire(5, { ...LOAF, dx: 0 });
    stepField(plain, 1);
    stepField(pads, 1);
    expect(pads.runners[0].y).toBeGreaterThan(plain.runners[0].y * (RULES.sprint - 0.1));
  });

  it('the brook carries runners sideways; its stones, a flatbread and a champion go straight', () => {
    const brook = { y0: 0, y1: 20, dir: 1 as const, speed: RULES.brookSpeed };
    const f = bare([], 500, 1, { brook });
    for (let i = 0; i < 10; i++) f.fire(3, { ...LOAF, dx: 0 });
    for (let i = 0; i < 10; i++) f.fire(3, { ...LOAF, look: 'podplomyk', flat: true, dx: 0 });
    f.runners.forEach(r => { r.vx = 0; });
    stepField(f, 1);
    const mean = (flat: boolean) => f.runners.filter(r => r.flat === flat).reduce((s, r) => s + r.x, 0) / 10;
    expect(mean(false) - mean(true)).toBeGreaterThan(RULES.brookSpeed * 0.7);
    const stones = bare([], 500, 1, { brook, pads: [{ x: 3, half: 1, y0: 0, y1: 20 }] });
    stones.fire(3, { ...LOAF, dx: 0 });
    stones.runners[0].vx = 0;
    stepField(stones, 0.5);
    expect(Math.abs(stones.runners[0].x - 3)).toBeLessThan(0.2);
  });

  it('boulders part the stream: nothing passes through a stone, everything gets past it', () => {
    const f = bare([], 500, 1, { rocks: [{ x: 5, y: 6, r: 0.8 }] });
    for (let i = 0; i < 12; i++) f.fire(5, { ...LOAF, dx: (i - 6) * 0.05 });
    let inside = 0;
    for (let i = 0; i < 360; i++) {
      f.step(STEP, CALM);
      for (const r of f.runners) if (Math.hypot(r.x - 5, r.y - 6) < 0.8) inside++;
    }
    expect(inside).toBe(0);
    expect(f.tables[0].full - f.tables[0].hunger).toBe(12);
  });

  it('a table fed, all tables fed: the terrace is cleared', () => {
    const f = bare([], 6);
    for (let i = 0; i < 9; i++) f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(6);
    expect(evs.filter(e => e.type === 'tableFed')).toHaveLength(1);
    expect(evs.filter(e => e.type === 'cleared')).toHaveLength(1);
    expect(f.done).toBe(true);
  });

  it('a big runner arriving at a fed table feeds the next hungry one', () => {
    const f = bare([], 10, 1, { tables: [{ x: 3, half: 1.8, hunger: 5 }, { x: 7, half: 1.8, hunger: 50 }], hunger: 55 });
    f.fire(3, { ...champ('wielblad', 30), speed: 6 });
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(30);
    expect(f.tables[1].hunger).toBe(25);
  });

  it('grace: after a while the disciples help until the table is fed', () => {
    const f = bare([], 30);
    const evs = stepField(f, RULES.helpAfter + 25);
    expect(evs.some(e => e.type === 'disciples')).toBe(true);
    expect(f.done).toBe(true);
    expect(f.byHelp).toBe(true);
    expect(fedBy(evs)).toBe(0);
  });
});

describe('the champions, each with its own way', () => {
  it('the Big Basket spills loaves at a gate and feeds its worth', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 6 }]);
    f.fire(5, champ('kosz', 30));
    const evs = stepField(f, 12);
    expect(evs.some(e => e.type === 'spill' && e.n === RULES.champ.kosz.spill[0])).toBe(true);
    expect(fedBy(evs)).toBe(30 + RULES.champ.kosz.spill[0]);
  });

  it('the donkey: gulls he meets carry bread to the tables instead of snatching it', () => {
    const f = bare([]);
    f.gulls.push(gull(5, 8), gull(5.5, 9.5), gull(4.5, 11));
    f.fire(5, champ('osiol', 16));
    const evs = stepField(f, 12);
    expect(evs.filter(e => e.type === 'befriend').reduce((s, e) => s + (e.type === 'befriend' ? e.n : 0), 0)).toBe(3);
    expect(evs.some(e => e.type === 'snatch')).toBe(false);
    expect(evs.filter(e => e.type === 'feed' && e.air).reduce((s, e) => s + (e.type === 'feed' ? e.n : 0), 0)).toBe(3);
    expect(fedBy(evs)).toBe(16 + 3);
  });

  it('the cart: the fastest, shoos the gulls without losing a loaf, spills at gates', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 6 }]);
    f.gulls.push(gull(5, 10), gull(5.4, 11.5));
    f.fire(5, champ('woz', 22));
    const evs = stepField(f, 5);
    expect(evs.some(e => e.type === 'ram' && e.n > 0)).toBe(true);
    expect(evs.some(e => e.type === 'snatch')).toBe(false);
    expect(fedBy(evs)).toBe(22 + RULES.champ.woz.spill[0]);
  });

  it('the giant loaf bursts at a tap into loaves that the gates above multiply', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 12, half: 5 }]);
    f.fire(5, champ('olbrzym', 8, { burst: 28 }));
    stepField(f, 1);
    expect(f.burstChampion()).toBe(true);
    expect(f.burstChampion()).toBe(false);
    const evs = f.take().concat(stepField(f, 8));
    expect(evs.find(e => e.type === 'burst')).toMatchObject({ n: 28 });
    expect(fedBy(evs)).toBe(56);
  });

  it('the giant loaf grows at a gate it passes, and bursts by itself after its fuse', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 2, half: 5 }]);
    f.fire(5, champ('olbrzym', 8, { burst: 28 }));
    const evs = stepField(f, RULES.champ.olbrzym.fuse + 0.5);
    expect(evs.find(e => e.type === 'burst')).toMatchObject({ n: 28 + RULES.champ.olbrzym.perGate });
  });

  it('the camel: gulls bounce off him, and a gate adds to what he carries', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 6, half: 5 }]);
    f.gulls.push(gull(5, 9), gull(5, 10.5));
    f.fire(5, champ('wielblad', 70));
    const evs = stepField(f, 14);
    expect(evs.some(e => e.type === 'snatch')).toBe(false);
    expect(evs.some(e => e.type === 'ram')).toBe(true);
    expect(fedBy(evs)).toBe(70 + RULES.champ.wielblad.perGate[0]);
  });
});

describe('the helps', () => {
  it('Mewy Mirki: the gulls fly bread straight to the tables', () => {
    const f = bare([]);
    f.useHelp('mewy', 0, 1, 5);
    const evs = f.take().concat(stepField(f, 4));
    const n = RULES.help.mewy.gulls[0] * RULES.help.mewy.each;
    expect(evs.find(e => e.type === 'helped')).toMatchObject({ id: 'mewy', n });
    expect(evs.filter(e => e.type === 'feed' && e.air).reduce((s, e) => s + (e.type === 'feed' ? e.n : 0), 0)).toBe(n);
  });

  it('the fishermen’s net sends every gull off and stops the boss for a while', () => {
    const f = new Field(planTerrace(3, terracesOf(3) - 1), { seed: 1 });
    stepField(f, 4);
    f.gulls.push(gull(3, 10), gull(6, 12), gull(5, 14));
    f.useHelp('siec', 0, 1, 5);
    expect(f.gulls.every(g => g.state === 'fly')).toBe(true);
    expect(f.boss?.stun).toBeGreaterThanOrEqual(RULES.help.siec.stun[0]);
    expect(f.take().find(e => e.type === 'helped')).toMatchObject({ id: 'siec', n: 3 });
  });

  it('the wind off the lake: runners fly up, gulls are blown back, no new wave', () => {
    const f = bare([], 9999, 6);
    f.fire(5, { ...LOAF, dx: 0 });
    f.gulls.push(gull(5, 15));
    f.useHelp('wiatr', 0, 1, 5);
    const ctl = { ...CALM, quiet: false };
    stepField(f, 0.5, ctl);
    expect(f.runners[0].y).toBeGreaterThan(0.35 + 0.5 * RULES.loafSpeed * 1.4);
    expect(f.gulls[0].y).toBeGreaterThan(15);
    expect(stepField(f, 5.4, ctl).some(e => e.type === 'wave')).toBe(false);
  });

  it('the disciples’ gate: a wide ×3 by the basket for a while', () => {
    const f = bare([]);
    f.useHelp('bramka', 0, 1, 5);
    const g = f.gates.find(x => x.kind === 'help')!;
    expect(g).toMatchObject({ n: RULES.help.bramka.mult[0], y: RULES.help.bramka.y });
    f.fire(5, LOAF);
    expect(fedBy(stepField(f, 6))).toBe(3);
    stepField(f, RULES.help.bramka.sec[0]);
    expect(f.gates.some(x => x.kind === 'help')).toBe(false);
  });
});

describe('the gulls', () => {
  const waves = (f: Field, sec: number, ctl: FieldCtl) => stepField(f, sec, ctl).filter(e => e.type === 'wave');

  it('waves come down the hill, more and more often', () => {
    const f = bare([], 9999, 6);
    expect(waves(f, 40, { ...CALM, quiet: false }).length).toBeGreaterThanOrEqual(4);
    expect(f.gulls.length).toBeGreaterThan(0);
  });

  it('a gull snatches a loaf one for one and flies off with it', () => {
    const f = bare([]);
    f.gulls.push(gull(5, 3));
    for (let i = 0; i < 3; i++) f.fire(5, LOAF);
    const evs = stepField(f, 6);
    expect(evs.filter(e => e.type === 'snatch').reduce((s, e) => s + (e.type === 'snatch' ? e.n : 0), 0)).toBe(1);
    expect(fedBy(evs)).toBe(2);
  });

  it('Gerwazy is worth six', () => {
    const f = bare([]);
    f.gulls.push(gull(5, 3, 'fat'));
    for (let i = 0; i < 10; i++) f.fire(5, LOAF);
    expect(fedBy(stepField(f, 6))).toBe(10 - RULES.fatW);
  });

  it('a gull that reaches the basket pecks it, never more', () => {
    const f = bare([]);
    f.gulls.push(gull(5, 1.5));
    expect(stepField(f, 2).filter(e => e.type === 'peck')).toHaveLength(1);
  });

  it('in a rest the gulls doze and a runner only shoos them; no new waves', () => {
    const f = bare([], 9999, 6);
    f.gulls.push(gull(5, 6));
    const rest = { ...CALM, rest: true, quiet: false };
    stepField(f, 0.5, rest);
    expect(f.gulls[0].state).toBe('doze');
    for (let i = 0; i < 3; i++) f.fire(5, LOAF);
    const evs = stepField(f, 30, rest);
    expect(evs.some(e => e.type === 'shoo')).toBe(true);
    expect(evs.some(e => e.type === 'snatch' || e.type === 'wave')).toBe(false);
    expect(fedBy(evs)).toBe(3);
  });
});

describe('the gluttons (the boss arenas)', () => {
  const arena = (L: number) => new Field(planTerrace(L, terracesOf(L) - 1), { seed: 1 });

  it('the Pelikan gulps runners until he is sated, then waddles off', () => {
    const f = arena(3);
    expect(f.boss?.kind).toBe('pelikan');
    const pouch = f.boss!.pouch;
    stepField(f, 3);
    let evs: FieldEvent[] = [];
    for (let k = 0; k < 40 && f.boss && f.boss.state !== 'sated'; k++) {
      for (let i = 0; i < 10; i++) f.fire(f.boss.x, LOAF);
      evs = evs.concat(stepField(f, 1));
    }
    const gulped = evs.reduce((s, e) => s + (e.type === 'gulp' ? e.n : 0), 0);
    expect(gulped).toBe(pouch);
    expect(evs.some(e => e.type === 'sated' && e.kind === 'pelikan')).toBe(true);
    stepField(f, 4);
    expect(f.boss).toBeNull();
  });

  it('Kozioł Zenek aims at the column with the most bread, charges, and rolls it back — never lost', () => {
    const f = arena(7);
    expect(f.boss?.kind).toBe('koziol');
    stepField(f, 3.5);
    expect(f.boss?.state).toBe('act');
    for (let i = 0; i < 12; i++) f.runners.push(still(RULES.columns[2] + (i % 3 - 1) * 0.2, 10 + (i % 4) * 0.9, 500 + i));
    let evs: FieldEvent[] = [];
    for (let k = 0; k < 600 && !evs.some(e => e.type === 'butt'); k++) evs = evs.concat(stepField(f, STEP));
    expect(evs.find(e => e.type === 'aim')).toMatchObject({ x: RULES.columns[2], kind: 'koziol' });
    expect(evs.some(e => e.type === 'butt')).toBe(true);
    evs = evs.concat(stepField(f, 2.5));
    expect(f.runners.filter(r => r.id >= 500).reduce((s, r) => s + r.w, 0)).toBe(12);
    expect(Math.min(...f.runners.filter(r => r.id >= 500).map(r => r.y))).toBeLessThan(9);
  });

  it('Czapla Klara stabs what comes within reach, and ripples show where she steps', () => {
    const f = arena(11);
    expect(f.boss?.kind).toBe('czapla');
    stepField(f, 2);
    const b = f.boss!;
    expect(b.state).toBe('act');
    const from = b.x;
    f.runners.push(still(b.x + 0.6, b.y, 600));
    let evs = stepField(f, 0.6);
    expect(evs.some(e => e.type === 'stab')).toBe(true);
    expect(f.runners.some(r => r.id === 600)).toBe(false);
    evs = stepField(f, RULES.czaplaStand + RULES.czaplaRipple + 1.2);
    const aim = evs.find(e => e.type === 'aim');
    expect(aim).toBeTruthy();
    expect(Math.abs(b.x - from)).toBeGreaterThan(0.5);
  });

  it('the cormorants mark a shadow, dive and take what is there, then dry their wings', () => {
    const f = arena(15);
    expect(f.boss?.kind).toBe('kormorany');
    for (let i = 0; i < 10; i++) f.runners.push(still(5 + (i % 3) * 0.3, 14 + (i % 2) * 0.3, 700 + i));
    let evs: FieldEvent[] = [];
    for (let k = 0; k < 600 && !evs.some(e => e.type === 'dive'); k++) evs = evs.concat(stepField(f, STEP));
    const aim = evs.find(e => e.type === 'aim');
    expect(aim).toMatchObject({ kind: 'kormorany' });
    expect(evs.find(e => e.type === 'dive')).toMatchObject({});
    expect(evs.filter(e => e.type === 'dive').reduce((s, e) => s + (e.type === 'dive' ? e.n : 0), 0)).toBeGreaterThan(0);
    expect(f.boss?.birds.some(w => w.state === 'dry')).toBe(true);
  });

  it('an arena is done only when its glutton is sated too', () => {
    const f = arena(3);
    stepField(f, 3);
    for (const tb of f.tables) { tb.hunger = 1; }
    f.fire(0.6, { ...LOAF, dx: 0 });
    f.fire(9.4, { ...LOAF, dx: 0 });
    let evs = stepField(f, 6);
    expect(f.tables.every(tb => tb.fed)).toBe(true);
    expect(evs.some(e => e.type === 'cleared')).toBe(false);
    // with the tables full, bread that reaches the top goes to the glutton
    const pouch = f.boss!.pouch;
    for (let i = 0; i < 6; i++) f.fire(0.6, { ...LOAF, dx: 0 });
    evs = stepField(f, 6);
    expect(f.boss ? f.boss.pouch : 0).toBeLessThan(pouch);
    for (let k = 0; k < 40 && f.boss && f.boss.state === 'act'; k++) {
      for (let i = 0; i < 10; i++) f.fire(f.boss.x, LOAF);
      evs = evs.concat(stepField(f, 1));
    }
    evs = evs.concat(stepField(f, 0.5));
    expect(evs.some(e => e.type === 'cleared')).toBe(true);
  });

  it('in a rest a glutton dozes: no charge, no dive', () => {
    const f = arena(7);
    const rest = { ...CALM, rest: true };
    stepField(f, 3.5, rest);
    for (let i = 0; i < 6; i++) f.runners.push(still(5, 11, 800 + i));
    expect(stepField(f, 12, rest).some(e => e.type === 'aim' || e.type === 'butt')).toBe(false);
  });

  it('a stunned boss stops; the disciples feed both the tables and the boss in the end', () => {
    const b = makeBoss('koziol', 30);
    const emitted: BossEvent[] = [];
    const ctx = { runners: [], rest: false, rnd: mulberry32(2), emit: (e: BossEvent) => emitted.push(e), brookY: 11.4 };
    for (let i = 0; i < 300; i++) stepBoss(b, STEP, ctx);
    stunBoss(b, 3);
    const pt = b.pt;
    for (let i = 0; i < 60; i++) stepBoss(b, STEP, ctx);
    expect(b.pt).toBe(pt);
    expect(munchSpots(b).length).toBe(1);
    const f = arena(3);
    const evs = stepField(f, 95);
    expect(evs.some(e => e.type === 'sated')).toBe(true);
    expect(f.done).toBe(true);
  });
});

// ── the collection ───────────────────────────────────────────────
describe('the collection: cards, levels, evolutions, bundles', () => {
  it('levels come from copies, rarer cards need fewer; evolutions at 3, 6 and 9', () => {
    expect(copiesFor(1, 'common')).toBe(1);
    expect(copiesFor(3, 'common')).toBe(7);
    expect(copiesFor(MAX_LEVEL, 'common')).toBe(80);
    expect(copiesFor(MAX_LEVEL, 'legend')).toBeLessThan(copiesFor(MAX_LEVEL, 'epic'));
    expect(levelOf('mama', 0)).toBe(0);
    expect(levelOf('mama', 7)).toBe(3);
    expect(levelOf('mama', 6)).toBe(2);
    expect(levelOf('mama', 999)).toBe(MAX_LEVEL);
    expect([1, 2, 3, 5, 6, 8, 9].map(evoOf)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('every kind has cards, the starter ones are common and in the first pool', () => {
    for (const k of KINDS) expect(CARDS.filter(c => c.kind === k).length).toBeGreaterThanOrEqual(4);
    for (const id of Object.keys(starterCards())) expect(CARDS.find(c => c.id === id)).toMatchObject({ rarity: 'common', unlock: 0 });
  });

  it('a bundle is the same for the same seed, has its size, and its last card is at least its floor', () => {
    const a = { ...starterCards() }, b = { ...starterCards() };
    const opts = { village: 20, luck: 0, pity: 0 };
    expect(rollPack(a, 'skrzynka', mulberry32(5), opts)).toEqual(rollPack(b, 'skrzynka', mulberry32(5), opts));
    for (const kind of ['wezelek', 'tobolek', 'skrzynka'] as const) {
      for (let s = 1; s < 40; s++) {
        const r = rollPack({ ...starterCards() }, kind, mulberry32(s), opts);
        expect(r.drops).toHaveLength(PACK[kind].n);
        const last = CARDS.find(c => c.id === r.drops.at(-1)!.id)!;
        expect(['common', 'rare', 'epic', 'legend'].indexOf(last.rarity)).toBeGreaterThanOrEqual(['common', 'rare', 'epic', 'legend'].indexOf(PACK[kind].floor));
      }
    }
  });

  it('only the village’s pool drops; a card never found comes first; the pity brings an epic', () => {
    for (let s = 1; s < 30; s++) {
      for (const d of rollPack({ ...starterCards() }, 'tobolek', mulberry32(s), { village: 0, luck: 0, pity: 0 }).drops) {
        expect(CARDS.find(c => c.id === d.id)!.unlock).toBe(0);
      }
    }
    const zero = () => 0;
    const r = rollPack({ ...starterCards() }, 'wezelek', zero, { village: 0, luck: 0, pity: 0 });
    expect(r.drops[0]).toMatchObject({ id: 'bulka', fresh: true, level: 1 });
    const high = () => 0.999;
    const p = rollPack({ ...starterCards() }, 'wezelek', high, { village: 20, luck: 0, pity: RULES.pity });
    expect(['epic', 'legend']).toContain(CARDS.find(c => c.id === p.drops[0].id)!.rarity);
    expect(p.pity).toBeLessThan(RULES.pity);
  });

  it('a copy past the top level becomes crumbs; the market day adds a card', () => {
    const cards = { ...starterCards(), mama: 999, bochenek: 999, bulka: 999, kosz: 999, mewy: 999 };
    const r = rollPack(cards, 'wezelek', mulberry32(3), { village: 0, luck: 0, pity: 0, extra: 1 });
    expect(r.drops).toHaveLength(3);
    expect(r.drops.every(d => d.dust === RULES.dustPerCopy)).toBe(true);
    expect(cards.mama).toBe(999);
  });

  it('the odds are published, add up, and the granary tips them toward the rare', () => {
    const o = oddsWith(0), lucky = oddsWith(0.09);
    expect(o.common + o.rare + o.epic + o.legend).toBeCloseTo(1, 9);
    expect(lucky.common + lucky.rare + lucky.epic + lucky.legend).toBeCloseTo(1, 9);
    expect(lucky.common).toBeLessThan(o.common);
    expect(lucky.legend).toBeGreaterThan(o.legend);
  });
});

// ── the meta ─────────────────────────────────────────────────────
describe('the meta: baskets, the village, the league, missions, the day, records', () => {
  it('crumbs fill whole baskets into the bank', () => {
    const p = freshProgress();
    expect(addCrumbs(p, 0.6)).toBe(0);
    expect(addCrumbs(p, 0.6)).toBe(1);
    expect(p.bank).toBe(1);
    expect(p.crumbs).toBeCloseTo(0.2, 5);
  });

  it('builds the village with baskets, cheapest first, up to the top', () => {
    const p = freshProgress();
    p.bank = BUILD_PRICES.piekarnia[0];
    expect(offers(p)[0].price).toBe(Math.min(...BUILDINGS.map(b => BUILD_PRICES[b][0])));
    expect(build(p, 'piekarnia')).toBe(true);
    expect(p.bank).toBe(0);
    expect(build(p, 'piekarnia')).toBe(false);
    p.village.piekarnia = 4;
    expect(buildPrice('piekarnia', 4)).toBeNull();
    expect(offers(p).some(o => o.b === 'piekarnia')).toBe(false);
    expect(villageLevel(p)).toBe(4);
  });

  it('each building does what it says', () => {
    const p = freshProgress(), q = freshProgress();
    for (const b of BUILDINGS) q.village[b] = 2;
    expect(streamRate(q)).toBeGreaterThan(streamRate(p));
    expect(fishEvery(p)).toBe(0);
    expect(fishEvery(q)).toBeGreaterThan(0);
    expect(champBonus(q)).toBeGreaterThan(champBonus(p));
    expect(helpNeed(q)).toBeLessThan(helpNeed(p));
    expect(giftOf(q)).toBe(giftOf(p) + 2);
    expect(luckOf(q)).toBeGreaterThan(0);
  });

  it('the league: stars from levels, buildings and evolutions; tiers from a handful to the twelve baskets and on', () => {
    expect([0, 14, 15, 39, 40, 80, 140, 219, 220, 289, 290, 360].map(tierOf)).toEqual([0, 0, 1, 1, 2, 3, 4, 4, 5, 5, 6, 7]);
    expect(tierFloor(6)).toBe(290);
    const p = freshProgress();
    p.stars = [3, 2];
    p.village.studnia = 2;
    p.cards.mama = 7;   // level 3: one evolution
    expect(starsTotal(p)).toBe(5 + 2 + 1);
  });

  it('three missions at a time, of different kinds; one done is replaced and the next goals grow', () => {
    const p = freshProgress();
    expect(p.missions).toHaveLength(RULES.missions);
    expect(new Set(p.missions.map(m => m.kind)).size).toBe(RULES.missions);
    const feed = p.missions.find(m => m.kind === 'feed')!;
    expect(progressMission(p, 'feed', feed.goal - 1)).toEqual([]);
    const done = progressMission(p, 'feed', 5);
    expect(done).toHaveLength(1);
    expect(p.missionsDone).toBe(1);
    expect(p.missions).toHaveLength(RULES.missions);
    expect(p.missions.every(m => MISSION_KINDS.includes(m.kind))).toBe(true);
  });

  it('the day’s weather is the same for everyone that day, and varies', () => {
    expect(dayOf(1234)).toBe(dayOf(1234));
    expect(new Set(Array.from({ length: 200 }, (_, i) => dayOf(i * 7919))).size).toBeGreaterThanOrEqual(5);
  });

  it('stars by par: three within, two within 1.6×, else one; the disciples’ help gives one', () => {
    const par = parOf([50]);
    expect(par).toBeCloseTo(RULES.parBase + 50 / RULES.parRate, 5);
    expect(starsFor(par, par, false)).toBe(3);
    expect(starsFor(par * 1.5, par, false)).toBe(2);
    expect(starsFor(par * 2, par, false)).toBe(1);
    expect(starsFor(1, par, true)).toBe(1);
  });

  it('migrates a realistic v2 save in place: the path, stars, bank and records stay, the upgrades become buildings', () => {
    const v2 = {
      ver: 2, sessions: 14, total: 9120, levels: 17, pelikans: 3, bigs: 22, level: 17, stars: [3, 3, 2, 3, 1, 2, 3, 3, 2, 3, 3, 1, 2, 3, 3, 2, 3],
      bank: 9, crumbs: 0.4, bankAll: 61, up: { rate: 2, fish: 1, big: 3, start: 1 }, calls: 31, bestGold: 4.5, best: { 300: 1450, 180: 760 },
      lastLen: 300, seen: 0b1111, taught: 0x3ff, giftDay: '2026-11-09',
    };
    const p = migrate(mergeSaved(freshProgress(), JSON.parse(JSON.stringify(v2))));
    expect(p.ver).toBe(3);
    expect(p).toMatchObject({ sessions: 14, total: 9120, levels: 17, level: 17, bank: 9, bankAll: 61, calls: 31, bestGold: 4.5, lastLen: 300, seen: 15, taught: 0x3ff });
    expect(p.stars).toEqual(v2.stars);
    expect(p.best).toEqual({ 300: 1450, 180: 760 });
    expect(bestOf(p)).toBe(1450);
    expect(p.village).toEqual({ piekarnia: 2, przystan: 1, wiklina: 3, brama: 1, studnia: 0, spichlerz: 0 });
    expect(p.cards).toEqual(starterCards());
    expect(p.loadout).toEqual({ kosz: 'mama', chleb: 'bochenek', mistrz: 'kosz', pomoc: 'mewy' });
    expect(p.bosses.pelikan).toBe(3);
    expect(p.welcome).toBe(1);
    expect(p.tier).toBe(tierOf(starsTotal(p)));
    expect(p.missions).toHaveLength(RULES.missions);
    expect('up' in p).toBe(false);
    expect(migrate(JSON.parse(JSON.stringify(p)))).toEqual(p);
    // the first v3 session opens a welcome chest and plays on
    const sim = makeSim({ progress: p });
    const evs = drive(sim, 5, frame(), { t: 0 }, () => sim.burst());
    expect(ofType(evs, 'pack').some(e => e.pack.why === 'welcome' && e.pack.kind === 'skrzynka')).toBe(true);
    expect(sim.p.welcome).toBe(0);
    expect(Object.values(sim.p.cards).reduce((s, n) => s + n, 0)).toBeGreaterThanOrEqual(4 + PACK.skrzynka.n);
    expect(sim.session).toBe(15);
    expect(sim.level).toBe(17);
  });

  it('migrates a v1 save: keeps the records and sessions, starts the path and the village', () => {
    const v1 = {
      v: 1, sessions: 7, total: 4210, levels: 9, baskets: 31, pelikans: 2, bigs: 5, level: 9, stars: [3, 2, 3, 1, 2, 3, 3, 2, 1],
      grain: 55, grainAll: 410, up: { stream: 2, start: 1, fish: 3, big: 1 }, calls: 14, bestGold: 4.5,
      best: { 300: 820, 180: 410 }, lastLen: 300, seen: 7, giftDay: '2026-11-06',
    };
    const p = migrate(mergeSaved(freshProgress(), JSON.parse(JSON.stringify(v1))));
    expect(p.ver).toBe(3);
    expect(p).toMatchObject({ sessions: 7, total: 4210, level: 0, bank: 0, welcome: 1 });
    expect(p.best).toEqual({ 300: 820, 180: 410 });
    expect(p.stars).toEqual([]);
    expect(villageLevel(p)).toBe(0);
    expect('v' in p).toBe(false);
    expect('grain' in p).toBe(false);
    const sim = makeSim({ progress: p });
    drive(sim, 5, frame(), { t: 0 }, () => sim.burst());
    expect(sim.session).toBe(8);
  });

  it('never crashes on odd fields', () => {
    const odd = {
      ver: 3, sessions: '3', best: [1, 2], village: 'x', cards: { mama: 'a', zzz: 5, dwojak: 2 }, loadout: { kosz: 'piec', chleb: 42 },
      missions: [{ kind: 'nope', goal: 3 }, null, { kind: 'feed', goal: 300, have: 9999 }], stars: 'abc', bank: NaN, level: -4, taught: null, bosses: 7, tier: -9,
    };
    const p = migrate(mergeSaved(freshProgress(), odd));
    expect(p.sessions).toBe(0);
    expect(p.best).toEqual({});
    expect(villageLevel(p)).toBe(0);
    expect(p.cards).toEqual({ ...starterCards(), dwojak: 2 });
    expect(p.loadout.kosz).toBe('mama');
    expect(p.loadout.chleb).toBe('bochenek');
    expect(p.missions).toHaveLength(RULES.missions);
    expect(p.missions.find(m => m.kind === 'feed')?.have).toBeLessThanOrEqual(300);
    expect(p.stars).toEqual([]);
    expect(p.bank).toBe(0);
    expect(p.level).toBe(0);
    expect(p.tier).toBeGreaterThanOrEqual(0);
    expect(migrate(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

// ── the session ──────────────────────────────────────────────────
describe('the blocks', () => {
  it('fit the planned time, with a warm-up only the first time', () => {
    for (const sec of [40, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(9));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        if (sec > 60) expect(sum).toBeCloseTo(sec - RULES.finale, 5);
        expect(plan[0].kind === 'warmup').toBe(first);
        expect(plan.every(b => b.dur >= RULES.minBlock - 1e-9 || b.kind === 'warmup')).toBe(true);
      }
    }
    expect(planBlocks(10, false, mulberry32(1)).length).toBeGreaterThan(0);
  });

  it('a blind Rozdawanie every 4th from the 3rd session', () => {
    const sim = later({ progress: { sessions: 4, calls: 2 } });
    const blinds = sim.plan.filter(b => b.kind === 'push');
    toBlock(sim, sim.plan.length - 1);
    expect(blinds.some(b => b.blind)).toBe(true);
    const fresh = makeSim();
    toBlock(fresh, fresh.plan.length - 1);
    expect(fresh.plan.some(b => b.blind)).toBe(false);
  });

  it('signal(): want, blind, task, seconds left and the next block in the telegraph', () => {
    const sim = later();
    expect(sim.signal()).toMatchObject({ want: 'focus', blind: false });
    expect(sim.signal().task).toBeTruthy();
    expect(sim.signal().left).toBeCloseTo(sim.plan[0].dur, 0);
    const clock = { t: 0 };
    drive(sim, sim.plan[0].dur - 2, frame(), clock);
    expect(sim.signal().next).toBe('rest');
    drive(sim, 3, frame(), clock);
    expect(sim.signal().want).toBe('rest');
  });
});

describe('the band drives the golden gate and the ring', () => {
  it('the gate is ×1 in the lead-in and below the threshold, then follows the level', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 2, HIGH, clock);
    expect(sim.gold).toBe(1);
    drive(sim, RULES.leadIn.fnirs, HIGH, clock);
    expect(sim.gold).toBe(goldMult(0.95));
    expect(sim.gold).toBe(5);
    drive(sim, 0.5, LOW, clock);
    expect(sim.gold).toBe(1);
    drive(sim, 0.5, frame({ reliable: false, level: 0.9 }), clock);
    expect(sim.gold).toBe(1);
  });

  it('goldMult: ×1 below, ×2 at the threshold, ×5 at the top, in halves', () => {
    expect(goldMult(0.2)).toBe(1);
    expect(goldMult(0.5)).toBe(2);
    expect(goldMult(0.9)).toBe(5);
    expect(goldMult(0.7) * 2 % 1).toBe(0);
  });

  it('a held focus fills the ring in 6 s (Mendi) and 3 s (HALO); the next shot is the chosen champion', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg, progress: withCards({ mistrz: 'osiol' }) });
      const clock = { t: 0 };
      drive(sim, sim.leadIn, HIGH, clock);
      const evs = drive(sim, (eeg ? 3 : 6) + 0.2, HIGH, clock);
      expect(ofType(evs, 'bigReady')).toEqual([{ type: 'bigReady', champ: 'osiol' }]);
      sim.burst();
      const fired = ofType(drive(sim, 0.5, HIGH, clock), 'fire');
      expect(fired[0].champ).toBe('osiol');
      expect(sim.field.runners.some(r => r.champ === 'osiol')).toBe(true);
      expect(sim.bigsNow).toBe(1);
    }
  });

  it('without a signal the gate stays ×1 and the ring fills only slowly from pouring — never a loss', () => {
    const sim = later();
    const clock = { t: 0 };
    let tap = 0;
    drive(sim, 20, frame({ reliable: false, level: 0, calm: 0 }), clock, tt => { if (tt >= tap) { sim.burst(); tap += 0.65; } });
    expect(sim.bestGoldNow).toBe(1);
    expect(sim.charge).toBeGreaterThan(0);
    expect(sim.charge).toBeLessThan(0.5);
    expect(sim.meter()).toBeNull();
  });

  it('a blind block shows nothing and pours its share at the end', () => {
    const sim = later({ progress: { sessions: 4, calls: 2 } });
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.blind).toBe(true);
    drive(sim, 8, HIGH, clock);
    expect(sim.gold).toBe(1);
    expect(sim.goldWant).toBe(5);
    expect(sim.meter()).toBeNull();
    const pay = ofType(toBlock(sim, 3, HIGH, clock), 'blindPay');
    expect(pay).toHaveLength(1);
    expect(pay[0].runners).toBeGreaterThan(20);
  });
});

describe('the loadout: the basket, the bread', () => {
  const tapOnce = (sim: ChlebySim) => {
    sim.burst();
    return drive(sim, 0.45, frame(), { t: 0.1 });
  };

  it('Dwojak pours pairs, Przetak a fan of five, Kosz rybacki one heavy stack', () => {
    const two = later({ progress: withCards({ kosz: 'dwojak' }) });
    expect(ofType(tapOnce(two), 'fire').reduce((s, e) => s + e.n, 0)).toBe(2 * 2);
    const fan = later({ progress: withCards({ kosz: 'przetak' }) });
    const fanFire = ofType(tapOnce(fan), 'fire');
    expect(fanFire).toHaveLength(1);
    expect(fanFire[0].n).toBe(5);
    const xs = fan.field.runners.map(r => r.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2.5);
    const creel = later({ progress: withCards({ kosz: 'rybacki' }) });
    tapOnce(creel);
    expect(creel.field.runners.map(r => r.w)).toEqual([3]);
  });

  it('Trojak pours left, centre and right in turn, faster than the mother’s basket', () => {
    const tri = later({ progress: withCards({ kosz: 'trojak' }) }), mum = later();
    expect(tri.rate).toBeGreaterThan(mum.rate);
    const dxs: number[] = [];
    const fire = tri.field.fire.bind(tri.field);
    tri.field.fire = (x, s) => { dxs.push(Math.round((s.dx ?? 9) * 10) / 10); fire(x, s); };
    tri.press(5);
    drive(tri, 1.2, frame(), { t: 0 });
    expect(dxs.slice(0, 6)).toEqual([-1.3, 0, 1.3, -1.3, 0, 1.3]);
  });

  it('the Surprise basket throws golden loaves now and then; the Oven warm ones while its embers last', () => {
    const lucky = later({ progress: withCards({ kosz: 'niespodzianka' }) });
    lucky.press(5);
    const looks = ofType(drive(lucky, 10, frame(), { t: 0 }), 'fire').map(e => e.look);
    expect(looks).toContain('gold');
    const oven = later({ progress: withCards({ kosz: 'piec' }) });
    expect(oven.embers).toBe(oven.ovenMax);
    oven.press(5);
    drive(oven, 2, frame(), { t: 0 });
    expect(oven.field.runners.some(r => r.warm && r.w === 2)).toBe(true);
    expect(oven.embers).toBeLessThan(oven.ovenMax);
    // the embers run out: the loaves come out cold
    const warm: boolean[] = [];
    const fire = oven.field.fire.bind(oven.field);
    oven.field.fire = (x, s) => { warm.push(!!s.warm); fire(x, s); };
    oven.embers = 0.05;
    drive(oven, 0.6, frame(), { t: 2 });
    expect(oven.embers).toBe(0);
    expect(warm.at(-1)).toBe(false);
    oven.release();
    drive(oven, 1.5, frame(), { t: 3 });
    expect(oven.embers).toBeGreaterThan(0);
  });

  it('the bread sets the runners: a bun is quick, a barley cake feeds two, the harbour adds fish', () => {
    const bun = later({ progress: withCards({ chleb: 'bulka' }) });
    bun.burst();
    drive(bun, 0.3, frame(), { t: 0 });
    expect(bun.field.runners[0]).toMatchObject({ look: 'bulka', speed: 6.2, w: 1 });
    const cake = later({ progress: withCards({ chleb: 'placek' }) });
    expect(cake.rate).toBeLessThan(later().rate);
    cake.burst();
    drive(cake, 0.3, frame(), { t: 0 });
    expect(cake.field.runners[0]).toMatchObject({ look: 'placek', w: 2 });
    const fish = later({ progress: { village: { piekarnia: 0, przystan: 3, wiklina: 0, brama: 0, studnia: 0, spichlerz: 0 } } });
    fish.press(5);
    drive(fish, 3, frame(), { t: 0 });
    expect(fish.field.runners.some(r => r.look === 'fish' && r.w === 2)).toBe(true);
  });
});

describe('the help', () => {
  it('cannot be used before it is ready; feeding fills it; then it comes into play once', () => {
    const sim = later();
    expect(sim.useHelp()).toBe(false);
    const clock = { t: 0 };
    let evs: SimEvent[] = [];
    for (let i = 0; i < 200 && !sim.helpReady; i++) {
      sim.press(sim.field.gates[0].x);
      evs = evs.concat(drive(sim, 0.5, frame(), clock));
      sim.release();
    }
    expect(sim.helpReady).toBe(true);
    expect(ofType(evs, 'helpReady')).toHaveLength(1);
    const stage = () => sim.stage;
    for (let i = 0; i < 40 && stage() !== 'level'; i++) drive(sim, 0.5, frame(), clock);
    expect(sim.useHelp()).toBe(true);
    const after = sim.take();
    expect(ofType(after, 'help')).toEqual([{ type: 'help', id: 'mewy' }]);
    expect(sim.helpReady).toBe(false);
    expect(sim.useHelp()).toBe(false);
    expect(sim.p.helps).toBe(1);
  });

  it('a passed rest on the grass readies it', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.helpReady).toBe(false);
    toBlock(sim, 2, LOW, clock);
    expect(sim.helpReady).toBe(true);
  });
});

describe('rest: the crowd sits, the gulls doze, calm fills the baskets', () => {
  it('calm fills baskets of crumbs and a passed rest adds a full one', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.restBlock).toBe(true);
    const bank0 = sim.p.bank;
    const evs = toBlock(sim, 2, LOW, clock);
    expect(sim.p.bank - bank0).toBeGreaterThanOrEqual(2);
    expect(ofType(evs, 'restPass')).toHaveLength(1);
  });

  it('no gull wave starts during a rest', () => {
    const sim = later({ progress: { level: 6 } });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(ofType(drive(sim, sim.plan[1].dur - 1, LOW, clock), 'wave')).toHaveLength(0);
  });
});

describe('between levels: bundles, the league, missions, the village', () => {
  it('a level fed pays stars, baskets and a bundle that goes into the collection, shown between levels', () => {
    const sim = later({ progress: { level: 0 } });
    const clock = { t: 0 };
    const copies0 = Object.values(sim.p.cards).reduce((s, n) => s + n, 0);
    const evs = winLevel(sim, clock);
    const won = ofType(evs, 'won');
    expect(won).toHaveLength(1);
    expect(sim.p.level).toBe(1);
    expect(sim.p.stars[0]).toBe(won[0].stars);
    const pack = ofType(evs, 'pack')[0].pack;
    expect(pack.kind).toBe(won[0].stars >= 3 ? 'tobolek' : 'wezelek');
    const dust = pack.drops.filter(d => d.dust > 0).length;
    expect(Object.values(sim.p.cards).reduce((s, n) => s + n, 0)).toBe(copies0 + pack.drops.length - dust);
    const more = drive(sim, RULES.wonHold + 0.2, frame(), clock);
    expect(ofType(more, 'reveal')).toHaveLength(1);
    expect(sim.stage).toBe('pack');
    sim.skip();   // a tap in the reveal's first moment does not skip it
    drive(sim, 0.7, frame(), clock);
    expect(sim.stage).toBe('pack');
    const stage = () => sim.stage;
    for (let i = 0; i < 8 && stage() === 'pack'; i++) {
      sim.skip();
      drive(sim, 1.3, frame(), clock);
    }
    expect(['card', 'level']).toContain(sim.stage);
  });

  it('a glutton sated pays a chest and counts in the progress', () => {
    const sim = later({ progress: { level: 3 } });
    sim.field = new Field(planTerrace(3, terracesOf(3) - 1), { seed: 4 });
    const clock = { t: 0 };
    let evs: SimEvent[] = [];
    for (let i = 0; i < 160 && !evs.some(e => e.type === 'sated'); i++) {
      sim.press(sim.field.boss ? sim.field.boss.x : 5);
      evs = evs.concat(drive(sim, 0.5, HIGH, clock));
    }
    expect(ofType(evs, 'sated')[0].kind).toBe('pelikan');
    expect(ofType(evs, 'pack').some(e => e.pack.why === 'boss' && e.pack.kind === 'skrzynka')).toBe(true);
    expect(sim.p.bosses.pelikan).toBe(1);
    expect(sim.p.pelikans).toBe(1);
  });

  it('a new tier of the league pays a chest, once', () => {
    const sim = later({ progress: { level: 1, stars: [3, 0, 3, 3, 3, 2], tier: 0 } });
    const clock = { t: 0 };
    const evs = winLevel(sim, clock);
    expect(ofType(evs, 'tier')).toEqual([{ type: 'tier', tier: 1 }]);
    expect(ofType(evs, 'pack').some(e => e.pack.why === 'tier')).toBe(true);
    sim.result();
    sim.result();
    expect(sim.p.tier).toBe(1);
  });

  it('a mission done pays a sack and a new mission takes its place', () => {
    const sim = later({ progress: { missions: [{ kind: 'feed', goal: 5, have: 0 }, { kind: 'boss', goal: 1, have: 0 }, { kind: 'build', goal: 1, have: 0 }] } });
    const clock = { t: 0 };
    sim.press(5);
    const evs = drive(sim, 7, frame(), clock);
    expect(ofType(evs, 'mission')[0]).toMatchObject({ kind: 'feed', goal: 5 });
    expect(ofType(evs, 'pack').some(e => e.pack.why === 'mission' && e.pack.kind === 'tobolek')).toBe(true);
    expect(sim.p.missions).toHaveLength(RULES.missions);
    expect(sim.p.missions.some(m => m.kind === 'feed' && m.goal === 5)).toBe(false);
  });

  it('the village card builds with the bank, and a market day puts one more card in every bundle', () => {
    const sim = later({ progress: { bank: 40 } });
    const clock = { t: 0 };
    winLevel(sim, clock);
    for (let i = 0; i < 40 && sim.stage !== 'card'; i++) {
      if (sim.stage === 'pack') sim.skip();
      drive(sim, 0.25, frame(), clock);
    }
    expect(sim.stage).toBe('card');
    const lv0 = villageLevel(sim.p);
    expect(sim.buy(0)).toBe(true);
    expect(villageLevel(sim.p)).toBe(lv0 + 1);
    expect(ofType(sim.take(), 'build')).toHaveLength(1);
    const market = later({ daySeed: seedFor('targ') });
    expect(market.day).toBe('targ');
    const pack = ofType(winLevel(market), 'pack')[0].pack;
    expect(pack.drops.length).toBe(PACK[pack.kind].n + 1);
  });
});

describe('the smoke input feeds people (a centre tap every 0.65 s, Space every 2 s)', () => {
  for (const eeg of [false, true]) {
    it(`score > 0 after 22 s and the headline accrues live (${eeg ? 'HALO' : 'Mendi'}, first session)`, () => {
      const sim = makeSim({ planned: 40, eeg, tuning: BEGINNER });
      const clock = { t: 0 };
      let nextTap = 0.3, nextSpace = 1, mid = 0;
      drive(sim, 22, HIGH, clock, tt => {
        if (tt >= nextTap) { sim.press(RULES.laneW / 2); sim.release(); nextTap += 0.65; }
        if (tt >= nextSpace) { sim.burst(); nextSpace += 2; }
        if (Math.abs(tt - 11) < STEP / 2) mid = sim.headline().value;
      });
      expect(mid).toBeGreaterThan(0);
      expect(sim.result().score).toBeGreaterThan(mid);
      expect(sim.headline().value).toBe(sim.result().score);
    });
  }

  it('keeps going through levels, bundles and the village card for a whole 5 min session', () => {
    const sim = later({ planned: 300, progress: { bank: 20 } });
    const clock = { t: 0 };
    let tap = 0;
    drive(sim, 300, tt => (Math.floor(tt / 25) % 2 ? LOW : HIGH), clock, tt => {
      if (tt >= tap) { sim.press(RULES.laneW / 2 + Math.sin(tt) * 3); tap += 0.65; }
      if (tt >= tap - 0.3) sim.release();
    });
    drive(sim, 10, frame(), clock);
    expect(sim.phase).toBe('done');
    expect(sim.levelsNow).toBeGreaterThanOrEqual(3);
    expect(sim.packsNow).toBeGreaterThanOrEqual(3);
    expect(sim.score).toBeGreaterThan(300);
  });
});

describe('the coach marks teach one thing at a time', () => {
  it('tap, then hold, then drag in the first session', () => {
    const sim = makeSim({ progress: { seen: 1 } });
    const clock = { t: 0 };
    let evs = drive(sim, 1, frame(), clock);
    expect(ofType(evs, 'teach').map(e => e.what)).toEqual(['tap']);
    sim.press(5);
    sim.release();
    evs = drive(sim, 2, frame(), clock);
    expect(ofType(evs, 'teach').map(e => e.what)).toEqual(['hold']);
    sim.press(5);
    evs = drive(sim, 2, frame(), clock);
    sim.release();
    evs = evs.concat(drive(sim, 1, frame(), clock));
    expect(ofType(evs, 'teach').map(e => e.what)).toContain('drag');
    sim.press(5);
    sim.drag(1);
    sim.release();
    expect(sim.coach === 'drag').toBe(false);
  });

  it('later sessions do not teach the hands again', () => {
    const sim = makeSim({ progress: { sessions: 2, seen: 1, giftDay: DAY } });
    sim.finish();
    const again = makeSim({ progress: { ...sim.p } });
    expect(ofType(drive(again, 3, frame()), 'teach').filter(e => e.what === 'tap')).toHaveLength(0);
  });

  it('a new thing gets its mark when it first matters: the help, a boss, the jar', () => {
    const sim = later({ progress: { taught: 0x3ff } });
    const clock = { t: 0 };
    for (let i = 0; i < 200 && !sim.helpReady; i++) {
      sim.press(sim.field.gates[0].x);
      drive(sim, 0.5, frame(), clock);
      sim.release();
    }
    const evs = drive(sim, 12, frame(), clock);
    expect(ofType(evs, 'teach').map(e => e.what)).toContain('help');
  });

  it('every coach mark has words', () => {
    for (const s of Object.values(HINTS)) expect(s.length).toBeGreaterThan(5);
  });
});

describe('the session’s ending', () => {
  it('result() is idempotent and finish() settles once', () => {
    const sim = later({ planned: 120 });
    drive(sim, 30, HIGH, { t: 0 }, () => sim.burst());
    const a = sim.result();
    const b = sim.result();
    expect(a).toEqual(b);
    sim.finish();
    const total = sim.p.total;
    const cards = JSON.stringify(sim.p.cards);
    sim.finish();
    sim.result();
    expect(sim.p.total).toBe(total);
    expect(JSON.stringify(sim.p.cards)).toBe(cards);
    expect(sim.p.sessions).toBe(6);
  });

  it('the day’s gift is paid once a day, bigger with the granary', () => {
    const sim = makeSim({ progress: { seen: 1, giftDay: '2026-11-01', village: { piekarnia: 0, przystan: 0, wiklina: 0, brama: 0, studnia: 0, spichlerz: 2 } } });
    sim.finish();
    expect(sim.p.giftDay).toBe(DAY);
    expect(sim.p.bank).toBeGreaterThanOrEqual(RULES.giftBaskets + 2);
  });

  it('a record and its near miss show in the highlights; the story closes with Mirka', () => {
    const sim = later({ progress: { best: { 300: 1 } } });
    drive(sim, 20, HIGH, { t: 0 }, () => sim.burst());
    const r = sim.result();
    expect(r.record).toBe(true);
    expect(r.highlights[0]).toContain(String(r.score).slice(0, 1));
    expect(r.highlights.at(-1)).toMatch(/Mir/);
    expect(passage(r.verse!)).toBeTruthy();
  });

  it('closes with a passage that fits: a building, many rests, a new card', () => {
    for (let s = 1; s < 12; s++) {
      const sim = later({ seed: s });
      sim.upsBought = 1;
      sim.passedRests = 2;
      expect(passage(sim.closingVerse())).toBeTruthy();
    }
  });

  it('canStop waits at most a few seconds past the time', () => {
    const sim = later({ planned: 40 });
    drive(sim, 40 + RULES.settle + 0.5, frame());
    expect(sim.canStop()).toBe(true);
  });
});

describe('words', () => {
  it('the catalog is complete in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('companion lines stay under 90 characters, at least three per moment', () => {
    for (const [m, list] of Object.entries(LINES)) {
      expect(list.length, m).toBeGreaterThanOrEqual(3);
      for (const s of list) expect(s.length, s).toBeLessThanOrEqual(90);
    }
    for (const lang of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[lang])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${lang}.${k}`).toBeLessThanOrEqual(90);
    }
    expect(sayDur('x')).toBeGreaterThanOrEqual(2);
    expect(sayDur('x'.repeat(200))).toBeLessThanOrEqual(4);
  });

  it('no banned words in the tips; no Polish in the other languages', () => {
    for (const [lang, cat] of Object.entries(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) {
        const texts = typeof v === 'string' ? [v] : Object.values(v as unknown as Record<string, string>);
        for (const s of texts) {
          if (k.startsWith('tip.') || k.startsWith('howto.')) expect(s).not.toMatch(/mocniej|harder|stärker|hack|unlock/i);
          if (lang !== 'pl') expect(s, `${lang}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
        }
      }
    }
  });

  it('every card, building, glutton, tier, day and mission has its words', () => {
    for (const c of CARDS) {
      expect(cardName(c.id)).not.toMatch(/^card\./);
      expect(cardText(c.id).length).toBeGreaterThan(10);
    }
    for (const b of BUILDINGS) expect(buildName(b)).not.toMatch(/^b\./);
    for (const b of BOSSES) expect(bossName(b)).not.toMatch(/^boss\./);
    for (let i = 0; i < 9; i++) expect(tierName(i)).not.toMatch(/^tier\./);
    expect(tierName(7)).toMatch(/ III$/);
    for (const d of ['zwykly', 'wiatr', 'targ', 'rodzina', 'polow', 'cisza'] as const) expect(dayName(d)).not.toMatch(/^day\./);
    for (const m of MISSION_KINDS) expect(missionText(m, 12)).not.toMatch(/^mission\./);
  });

  it('the unit bends with the number', () => {
    expect(unit(1)).toBeTruthy();
    expect(t('fed', { n: 5 })).toContain('5');
  });
});

describe('mobile first: the layout at every checked size (DESIGN §12)', () => {
  const inside = (r: Rect, L: Layout) =>
    r.x >= L.play.x - 0.5 && r.y >= L.play.y - 0.5 && r.x + r.w <= L.play.x + L.play.w + 0.5 && r.y + r.h <= L.play.y + L.play.h + 0.5;
  const giantAt = (L: Layout, x: number, y: number) => {
    const q = toScreen(L.lane, x, y), S = L.lane.su * q.s;
    return { x: q.x, y: q.y - S, r: S * 1.5 + 8 };
  };

  for (const c of CHECK_SIZES) {
    describe(c.name, () => {
      const L = layout(c.w, c.h, c.insets);

      it('the help button and the giant loaf anywhere on the lane pass the audit', () => {
        expect(auditTargets(chlebyTargets(L, { stage: 'level', idle: false, offers: 0, giant: null }), c.w, c.h, c.insets)).toEqual([]);
        for (const gx of [RULES.edge, 2, 5, 8, RULES.laneW - RULES.edge]) {
          for (const gy of [0, 0.8, 2, 4, 8, 13, 17, RULES.laneH]) {
            const tg = chlebyTargets(L, { stage: 'level', idle: false, offers: 0, giant: giantAt(L, gx, gy) });
            expect(auditTargets(tg, c.w, c.h, c.insets), `giant at ${gx},${gy}`).toEqual([]);
          }
        }
      });

      it('the village sheet with one to three buildings passes the audit: rows and "Dalej" finger-sized, apart, inside', () => {
        for (const n of [1, 2, 3]) {
          const tg = chlebyTargets(L, { stage: 'card', idle: false, offers: n, giant: null });
          expect(tg.length).toBe(n + 1);
          expect(auditTargets(tg, c.w, c.h, c.insets), `${n} offers`).toEqual([]);
          for (const r of tg) expect(Math.min(r.w, r.h), r.label).toBeGreaterThanOrEqual(MIN_TAP + 4);
          const v = villageGeo(L, n);
          for (let i = 0; i + 1 < v.rows.length; i++) expect(v.rows[i + 1].y - (v.rows[i].y + v.rows[i].h)).toBeGreaterThanOrEqual(TAP_GAP);
          expect(v.go.y - (v.rows[n - 1].y + v.rows[n - 1].h)).toBeGreaterThanOrEqual(TAP_GAP);
        }
      });

      it('nothing is a target while a story card holds the hands, between terraces, after a level or on the reveal', () => {
        expect(chlebyTargets(L, { stage: 'level', idle: true, offers: 0, giant: giantAt(L, 5, 8) })).toEqual([]);
        for (const stage of ['climb', 'won', 'pack'] as const) expect(chlebyTargets(L, { stage, idle: false, offers: 3, giant: null })).toEqual([]);
      });

      it('every sheet fits the play area: the level fed, the reveal (six or eight tiles), the village, a story card', () => {
        expect(inside(wonBox(L), L)).toBe(true);
        for (const [n, sub] of [[1, false], [6, true], [8, true]] as const) {
          const g = revealGeo(L, n, sub);
          expect(inside(g.box, L), `reveal ${n}`).toBe(true);
          for (const cell of g.cells) {
            expect(inside(cell, L)).toBe(true);
            expect(cell.y + cell.h).toBeLessThanOrEqual(g.box.y + g.box.h - g.foot + 0.5);
          }
          expect(g.cells.length).toBeLessThanOrEqual(g.max);
        }
        const v = villageGeo(L, 3);
        expect(inside(v.box, L)).toBe(true);
        expect(v.go.y + v.go.h).toBeLessThanOrEqual(v.box.y + v.box.h);
        expect(inside(sheetBox(L, 320, true), L)).toBe(true);
        // a phone held upright: the sheets rise from the bottom, full width
        if (L.mode === 'tall' && c.w < 500) {
          const b = wonBox(L);
          expect(b.y + b.h).toBeCloseTo(L.play.y + L.play.h - 8, 0);
          expect(b.w).toBeGreaterThanOrEqual(c.w - 16 - 0.5);
        }
      });

      it('a side sheet never covers the lane: the lane slides aside by enough', () => {
        if (L.sheet !== 'side') return;
        const b = wonBox(L);
        expect(L.lane.cx - L.lane.hwB + L.slide).toBeGreaterThanOrEqual(b.x + b.w + 6);
      });

      it('the tables\' numbers stay under the HUD, the help button and the baskets inside the play area and apart', () => {
        expect(L.lane.yT - tablesBand(L.lane.su / (1 + L.lane.k))).toBeGreaterThanOrEqual(L.hudTop - 2);
        const h = helpRect(L);
        expect(inside(h, L)).toBe(true);
        expect(inside(L.bank, L)).toBe(true);
        const bank = { x: L.bank.x - 6, y: L.bank.y - 3, w: L.bank.w + 12, h: L.bank.h + 6 };
        expect(bank.x + bank.w <= h.x || bank.y + bank.h <= h.y || h.x + h.w <= bank.x).toBe(true);
        expect(L.lane.yB).toBeGreaterThan(L.lane.yT + 120);
      });

      if (c.w < c.h) {
        it('on a phone upright: the help button low in the thumb zone, clear of the side edges; the basket low', () => {
          const h = helpRect(L);
          expect(h.y).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
          expect(h.x).toBeGreaterThanOrEqual(EDGE);
          expect(h.x + h.w).toBeLessThanOrEqual(c.w - EDGE);
          expect(L.lane.yB).toBeGreaterThanOrEqual(c.h * 0.72);
          // the lane fills the width: no tiny world
          expect(2 * L.lane.hwB).toBeGreaterThanOrEqual(c.w * 0.85);
        });
      }
    });
  }

  it('the giant loaf is not a target while it is still at the basket (a tap there pours), and never over the help button', () => {
    const L = layout(360, 500, { top: 134, right: 0, bottom: 0, left: 0 });
    expect(giantRect(L, toScreen(L.lane, 5, 0).x, L.lane.yB - L.lane.su, L.lane.su * 1.5 + 8)).toBeNull();
    const far = giantAt(L, RULES.laneW - RULES.edge, 1.5);
    const g = giantRect(L, far.x, far.y, far.r);
    const h = helpRect(L);
    if (g) expect(g.y + g.h <= h.y - TAP_GAP + 0.5 || g.x + g.w <= h.x || g.x >= h.x + h.w).toBe(true);
  });

  it('the font helper never draws under 11 px', () => {
    const px = (f: string) => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1]);
    for (const size of [0, 4, 8, 9.5, 10.9, 11, 12.5, 13, 20]) {
      expect(px(font(800, size, SANS))).toBeGreaterThanOrEqual(MIN_TEXT);
      expect(px(font(500, size, SERIF, true))).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(px(font(800, 15, SANS))).toBe(15);
    expect(MIN_READ).toBe(13);
  });

  it('speaks of taps and drags to a finger, and names the keys only as shortcuts for a keyboard', () => {
    // the keys (not the lane's pebble arrows, which are a thing in the game): Space, E, the arrow keys, WASD, a mouse
    const KEYS = /spac|Space|Leertaste|mellanslag|\(E\)|albo E|or E|oder E|eller E|←|→|WASD|klik|click|Klick|mysz|mouse|Maus|\bmus\b/i;
    for (const [lang, cat] of Object.entries(CATALOGS)) {
      const c = cat as Record<string, unknown>;
      for (const k of ['hint.help', 'hint.burst', 'howto.tap', 'howto.hold', 'howto.drag', 'hint.tap', 'hint.hold', 'hint.drag', 'story.tap', 'reveal.tap']) {
        expect(String(c[k]), `${lang}.${k}`).not.toMatch(KEYS);
      }
      expect(String(c['hint.help.keys']), lang).toMatch(/E\)/);
      expect(String(c['howto.keys']), lang).toMatch(/1–3/);
    }
    for (const w of Object.keys(HINTS) as (keyof typeof HINTS)[]) expect(hintFor(w, true), w).not.toMatch(KEYS);
    expect(hintFor('help', false)).toBe(HINTS_KEYS.help);
    expect(hintFor('tap', false)).toBe(HINTS.tap);
  });
});
