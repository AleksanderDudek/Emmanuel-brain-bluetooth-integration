import { describe, expect, it } from 'vitest';
import { HINTS, LINES } from '../src/arcade/chleby/content';
import { Field, isBoss, placeOf, planTerrace, terracesOf, type FieldCtl, type FieldEvent, type TerracePlan } from '../src/arcade/chleby/field';
import { CATALOGS, t, unit } from '../src/arcade/chleby/i18n';
import {
  addCrumbs, bestOf, buyUp, freshProgress, migrate, offers, parOf, starsFor, upPrice, type ChlebyProgress,
} from '../src/arcade/chleby/meta';
import { RULES, goldMult } from '../src/arcade/chleby/rules';
import { ChlebySim, planBlocks, sayDur, type SimEvent } from '../src/arcade/chleby/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const CALM: FieldCtl = { gold: 1, rest: false, quiet: true, basketX: 5 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ activity: 9, level: 0.95, focused: true, hold: 10, calm: 0.05 });
const LOW = frame({ activity: -3, level: 0.1, focused: false, calm: 0.95 });

type SimOpts = { progress?: Partial<ChlebyProgress>; planned?: number; seed?: number; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ChlebySim {
  const sim = new ChlebySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no gift, the opening card and the hands taught): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, calls: 1, seen: 1, taught: 0x3ff, ...o.progress } });

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

/** A terrace with only the gates given, one table of `hunger`, no Pelikan. */
function bare(gates: Partial<TerracePlan['gates'][number]>[] = [], hunger = 500, level = 1): Field {
  const plan: TerracePlan = {
    ...planTerrace(level, 0), pelikan: false, gates: gates.map(g => ({ kind: 'mul', n: 2, y: 6, x0: 5, slide: 0, ...g })),
    tables: [{ x: 5, half: 5, hunger }], hunger,
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

// ── the path ─────────────────────────────────────────────────────
describe('the path of hillsides', () => {
  it('has chapters of four, the fourth a Pelikan level, and comes round after six', () => {
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

  it('puts the Pelikan on the last terrace of a chapter’s last level, which is hungrier', () => {
    const of = terracesOf(3);
    expect(planTerrace(3, of - 1).pelikan).toBe(true);
    expect(planTerrace(3, 0).pelikan).toBe(of === 1);
    expect(planTerrace(2, 0).pelikan).toBe(false);
    expect(planTerrace(7, 1).hunger).toBeGreaterThan(planTerrace(6, 1).hunger);
  });

  it('gets hungrier level by level and time round', () => {
    expect(planTerrace(10, 0).hunger).toBeGreaterThan(planTerrace(1, 0).hunger);
    expect(planTerrace(24, 0).hunger).toBeGreaterThan(planTerrace(0, 0).hunger);
  });

  it('adds the start gate only with the upgrade', () => {
    expect(planTerrace(1, 0).gates.some(g => g.kind === 'start')).toBe(false);
    expect(planTerrace(1, 0, 2).gates.some(g => g.kind === 'start')).toBe(true);
  });
});

// ── the field ────────────────────────────────────────────────────
describe('a terrace: runners, gates, tables', () => {
  it('feeds the table with every runner that reaches the top', () => {
    const f = bare([]);
    for (let i = 0; i < 10; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(10);
    expect(f.tables[0].hunger).toBe(490);
  });

  it('multiplies by a honey gate once per runner', () => {
    const f = bare([{ kind: 'mul', n: 3, y: 6 }, { kind: 'mul', n: 2, y: 9, x0: -50 }]);
    f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(3);
    expect(evs.some(e => e.type === 'gate' && e.kind === 'mul' && e.made === 2)).toBe(true);
  });

  it('chains gates: ×2 then ×3 makes six', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 5 }, { kind: 'mul', n: 3, y: 10 }]);
    // wide gates so the clones' spread stays inside
    f.gates.forEach(g => { if (g.kind === 'mul') g.half = 5; });
    f.fire(5, 'loaf');
    expect(fedBy(stepField(f, 6))).toBe(6);
  });

  it('a green gate pops its number once, then recharges', () => {
    const f = bare([{ kind: 'add', n: 10, y: 6 }]);
    f.gates[0].half = 5;
    f.fire(5, 'loaf');
    f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(12);
    expect(f.gates[0].charge).toBe(1);
  });

  it('a grey gate swallows its count, breaks, and comes back', () => {
    const f = bare([{ kind: 'sub', n: 3, y: 6 }]);
    f.gates[0].half = 5;
    for (let i = 0; i < 5; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(2);
    expect(evs.filter(e => e.type === 'swallow')).toHaveLength(3);
    expect(evs.some(e => e.type === 'break')).toBe(true);
    stepField(f, RULES.greyBack);
    expect(f.gates[0].left).toBe(3);
  });

  it('the golden gate multiplies by what the band says, carrying the halves', () => {
    const f = bare([]);
    f.gold.x0 = 5;
    f.gold.half = 5;
    for (let i = 0; i < 4; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 6, { ...CALM, gold: 2.5 });
    expect(fedBy(evs)).toBe(10);
    const g = bare([]);
    g.gold.x0 = 5;
    g.fire(5, 'loaf');
    expect(fedBy(stepField(g, 6, { ...CALM, gold: 1 }))).toBe(1);
  });

  it('past the crowd cap a gate makes runners heavier instead', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 3 }]);
    f.gates[0].half = 5;
    for (let i = 0; i < RULES.maxRunners; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(2 * RULES.maxRunners);
    expect(f.crowd).toBe(0);
  });

  it('the Big Basket spills loaves at a gate and feeds its worth', () => {
    const f = bare([{ kind: 'mul', n: 2, y: 6 }]);
    f.fire(5, 'big', 30);
    const evs = stepField(f, 12);
    expect(evs.some(e => e.type === 'spill' && e.n === RULES.bigSpill)).toBe(true);
    expect(fedBy(evs)).toBe(30 + RULES.bigSpill);
  });

  it('a table fed, all tables fed: the terrace is cleared', () => {
    const f = bare([], 6);
    for (let i = 0; i < 9; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(fedBy(evs)).toBe(6);
    expect(evs.filter(e => e.type === 'tableFed')).toHaveLength(1);
    expect(evs.filter(e => e.type === 'cleared')).toHaveLength(1);
    expect(f.done).toBe(true);
  });

  it('grace: after a while the disciples help until the table is fed', () => {
    const f = bare([], 30);
    const evs = stepField(f, RULES.helpAfter + 25);
    expect(evs.some(e => e.type === 'help')).toBe(true);
    expect(f.done).toBe(true);
    expect(f.byHelp).toBe(true);
    expect(fedBy(evs)).toBe(0);
  });
});

describe('the gulls and the Pelikan', () => {
  const waves = (f: Field, sec: number, ctl: FieldCtl) => stepField(f, sec, ctl).filter(e => e.type === 'wave');

  it('waves come down the hill, more and more often', () => {
    const f = bare([], 9999, 6);
    expect(waves(f, 40, { ...CALM, quiet: false }).length).toBeGreaterThanOrEqual(4);
    expect(f.gulls.length).toBeGreaterThan(0);
  });

  it('a gull snatches a loaf one for one and flies off with it', () => {
    const f = bare([]);
    f.gulls.push({ id: 900, kind: 'gull', x: 5, y: 3, w: 1, state: 'walk', t: 1, dir: 1, carry: false, lag: 0 });
    for (let i = 0; i < 3; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 6);
    expect(evs.filter(e => e.type === 'snatch').reduce((s, e) => s + (e.type === 'snatch' ? e.n : 0), 0)).toBe(1);
    expect(fedBy(evs)).toBe(2);
  });

  it('Gerwazy is worth six', () => {
    const f = bare([]);
    f.gulls.push({ id: 900, kind: 'fat', x: 5, y: 3, w: RULES.fatW, state: 'walk', t: 1, dir: 1, carry: false, lag: 0 });
    for (let i = 0; i < 10; i++) f.fire(5, 'loaf');
    expect(fedBy(stepField(f, 6))).toBe(10 - RULES.fatW);
  });

  it('a gull that reaches the basket pecks it, never more', () => {
    const f = bare([]);
    f.gulls.push({ id: 900, kind: 'gull', x: 5, y: 1.5, w: 1, state: 'walk', t: 1, dir: 1, carry: false, lag: 0 });
    const evs = stepField(f, 2);
    expect(evs.filter(e => e.type === 'peck')).toHaveLength(1);
  });

  it('in a rest the gulls doze and a runner only shoos them; no new waves', () => {
    const f = bare([], 9999, 6);
    f.gulls.push({ id: 900, kind: 'gull', x: 5, y: 6, w: 1, state: 'walk', t: 1, dir: 1, carry: false, lag: 0 });
    const rest = { ...CALM, rest: true, quiet: false };
    stepField(f, 0.5, rest);
    expect(f.gulls[0].state).toBe('doze');
    for (let i = 0; i < 3; i++) f.fire(5, 'loaf');
    const evs = stepField(f, 30, rest);
    expect(evs.some(e => e.type === 'shoo')).toBe(true);
    expect(evs.some(e => e.type === 'snatch' || e.type === 'wave')).toBe(false);
    expect(fedBy(evs)).toBe(3);
  });

  it('the Pelikan gulps runners until he is sated, then waddles off', () => {
    const plan = planTerrace(3, terracesOf(3) - 1);
    const f = new Field(plan, { seed: 1 });
    expect(f.pelikan).not.toBeNull();
    const pouch = f.pelikan!.pouch;
    stepField(f, 2);
    let evs: FieldEvent[] = [];
    for (let k = 0; k < 40 && f.pelikan && f.pelikan.state !== 'sated'; k++) {
      for (let i = 0; i < 10; i++) f.fire(f.pelikan.x, 'loaf');
      evs = evs.concat(stepField(f, 1));
    }
    const gulped = evs.reduce((s, e) => s + (e.type === 'gulp' ? e.n : 0), 0);
    expect(gulped).toBe(pouch);
    expect(evs.some(e => e.type === 'sated')).toBe(true);
    stepField(f, 4);
    expect(f.pelikan).toBeNull();
  });
});

// ── the meta ─────────────────────────────────────────────────────
describe('the meta: baskets, upgrades, stars, records', () => {
  it('crumbs fill whole baskets into the bank', () => {
    const p = freshProgress();
    expect(addCrumbs(p, 0.6)).toBe(0);
    expect(addCrumbs(p, 0.6)).toBe(1);
    expect(p.bank).toBe(1);
    expect(p.crumbs).toBeCloseTo(0.2, 5);
  });

  it('buys upgrades with baskets, cheapest first, up to the top', () => {
    const p = freshProgress();
    p.bank = RULES.prices.rate[0];
    expect(offers(p)[0].price).toBe(Math.min(...Object.values(RULES.prices).map(l => l[0])));
    expect(buyUp(p, 'rate')).toBe(true);
    expect(p.bank).toBe(0);
    expect(buyUp(p, 'rate')).toBe(false);
    p.up.rate = RULES.prices.rate.length;
    expect(upPrice('rate', p.up.rate)).toBeNull();
    expect(offers(p).some(o => o.u === 'rate')).toBe(false);
  });

  it('stars by par: three within, two within 1.6×, else one; the disciples’ help gives one', () => {
    const par = parOf([50]);
    expect(par).toBeCloseTo(RULES.parBase + 50 / RULES.parRate, 5);
    expect(starsFor(par, par, false)).toBe(3);
    expect(starsFor(par * 1.5, par, false)).toBe(2);
    expect(starsFor(par * 2, par, false)).toBe(1);
    expect(starsFor(1, par, true)).toBe(1);
  });

  it('migrates a realistic v1 save: keeps the records and sessions, starts the new path', () => {
    const v1 = {
      v: 1, sessions: 7, total: 4210, levels: 9, baskets: 31, pelikans: 2, bigs: 5, level: 9, stars: [3, 2, 3, 1, 2, 3, 3, 2, 1],
      grain: 55, grainAll: 410, up: { stream: 2, start: 1, fish: 3, big: 1 }, calls: 14, bestGold: 4.5,
      best: { 300: 820, 180: 410 }, lastLen: 300, seen: 7, giftDay: '2026-11-06',
    };
    const p = migrate(mergeSaved(freshProgress(), JSON.parse(JSON.stringify(v1))));
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.total).toBe(4210);
    expect(p.best).toEqual({ 300: 820, 180: 410 });
    expect(bestOf(p)).toBe(820);
    expect(p.level).toBe(0);
    expect(p.stars).toEqual([]);
    expect(p.up).toEqual({ rate: 0, fish: 0, big: 0, start: 0 });
    expect(p.bank).toBe(0);
    expect('v' in p).toBe(false);
    expect('grain' in p).toBe(false);
    // and a session plays on it
    const sim = makeSim({ progress: p });
    drive(sim, 5, frame(), { t: 0 }, () => sim.burst());
    expect(sim.session).toBe(8);
  });

  it('never crashes on odd fields', () => {
    const odd = { ver: 2, sessions: '3', best: [1, 2], up: 'x', stars: 'abc', bank: NaN, level: -4, taught: null };
    const p = migrate(mergeSaved(freshProgress(), odd));
    expect(p.sessions).toBe(0);
    expect(p.best).toEqual({});
    expect(p.up.rate).toBe(0);
    expect(p.stars).toEqual([]);
    expect(p.bank).toBe(0);
    expect(p.level).toBe(0);
    expect(migrate(p)).toEqual(p);
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

describe('the band drives the golden gate and the Big Basket', () => {
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

  it('a held focus fills the Big Basket in 6 s (Mendi) and 3 s (HALO); the next shot is the champion', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      const clock = { t: 0 };
      drive(sim, sim.leadIn, HIGH, clock);
      const evs = drive(sim, (eeg ? 3 : 6) + 0.2, HIGH, clock);
      expect(ofType(evs, 'bigReady')).toHaveLength(1);
      sim.burst();
      const fired = ofType(drive(sim, 0.5, HIGH, clock), 'fire');
      expect(fired[0].kind).toBe('big');
      expect(sim.bigsNow).toBe(1);
    }
  });

  it('without a signal the gate stays ×1 and the basket fills only slowly from pouring — never a loss', () => {
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
    const evs = toBlock(sim, 3, HIGH, clock);
    const pay = ofType(evs, 'blindPay');
    expect(pay).toHaveLength(1);
    expect(pay[0].runners).toBeGreaterThan(20);
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
    expect(sim.p.bank - bank0).toBeGreaterThanOrEqual(3);
    expect(ofType(evs, 'restPass')).toHaveLength(1);
    expect(sim.meter()).not.toBeNull();
  });

  it('no gull wave starts during a rest', () => {
    const sim = later({ progress: { level: 6 } });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, sim.plan[1].dur - 1, LOW, clock);
    expect(ofType(evs, 'wave')).toHaveLength(0);
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

  it('keeps going through levels and the card between them for a whole 5 min session', () => {
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
    expect(sim.score).toBeGreaterThan(300);
  });
});

describe('the coach marks teach one control at a time', () => {
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
    const evs = drive(again, 3, frame());
    expect(ofType(evs, 'teach').filter(e => e.what === 'tap')).toHaveLength(0);
  });

  it('every coach mark has words', () => {
    for (const s of Object.values(HINTS)) expect(s.length).toBeGreaterThan(5);
  });
});

describe('the session’s ending', () => {
  it('result() is idempotent and finish() settles once', () => {
    const sim = later({ planned: 120 });
    const clock = { t: 0 };
    drive(sim, 30, HIGH, clock, () => sim.burst());
    const a = sim.result();
    const b = sim.result();
    expect(a).toEqual(b);
    sim.finish();
    const total = sim.p.total;
    sim.finish();
    sim.result();
    expect(sim.p.total).toBe(total);
    expect(sim.p.sessions).toBe(6);
  });

  it('the day’s gift is paid once a day', () => {
    const sim = makeSim({ progress: { seen: 1, giftDay: '2026-11-01' } });
    sim.finish();
    expect(sim.p.giftDay).toBe(DAY);
    expect(sim.p.bank).toBeGreaterThanOrEqual(RULES.giftBaskets);
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

  it('canStop waits at most a few seconds past the time', () => {
    const sim = later({ planned: 40 });
    drive(sim, 40 + RULES.settle + 0.5, frame());
    expect(sim.canStop()).toBe(true);
  });

  it('a level fed passes stars and baskets, the path moves on', () => {
    const sim = later({ progress: { level: 0 } });
    const clock = { t: 0 };
    let evs: SimEvent[] = [];
    for (let i = 0; i < 60 && !evs.some(e => e.type === 'won'); i++) {
      sim.press(sim.field.gates[0].x);
      evs = evs.concat(drive(sim, 0.5, HIGH, clock));
      sim.release();
    }
    const won = ofType(evs, 'won');
    expect(won).toHaveLength(1);
    expect(won[0].stars).toBeGreaterThanOrEqual(1);
    expect(sim.p.level).toBe(1);
    expect(sim.p.stars[0]).toBe(won[0].stars);
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
    expect(sayDur('x')).toBeGreaterThanOrEqual(2);
    expect(sayDur('x'.repeat(200))).toBeLessThanOrEqual(4);
  });

  it('no banned words in the tips', () => {
    for (const lang of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(lang)) {
        if (typeof v !== 'string') continue;
        if (k.startsWith('tip.') || k.startsWith('howto.')) expect(v).not.toMatch(/mocniej|harder|stärker|hack|unlock/i);
      }
    }
  });

  it('the unit bends with the number', () => {
    expect(unit(1)).toBeTruthy();
    expect(t('fed', { n: 5 })).toContain('5');
  });
});
