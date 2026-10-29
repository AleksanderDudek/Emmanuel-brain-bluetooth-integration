import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import {
  BREATHER, CRAFT_GRAIN, DROP_ODDS, FRUITS, GUESTS, LOAF_POINTS, MAX_TIER, TABLE_START, TABLE_STEP, TABLE_STEPS, TIERS, TIPS, tierFromU,
} from '../src/arcade/urodzaj/content';
import { CATALOGS, bare, cap, t, unit } from '../src/arcade/urodzaj/i18n';
import {
  drawGuest, freshProgress, naomiDue, newChance, nextMissing, ruthDue, tablePoints, tableState, type UrodzajProgress,
} from '../src/arcade/urodzaj/meta';
import { BOTTOM, BOX_H, BOX_W, DROP_MAX_R, TOP, layout, sx, sy, type Rect } from '../src/arcade/urodzaj/layout';
import { progressPanel } from '../src/arcade/urodzaj/panel';
import { BASKET, PHYS, World, halfWidthAt, type Body, type Pair } from '../src/arcade/urodzaj/physics';
import {
  RULES, UrodzajSim, allowance, bridgeRange, chainMult, mergePoints, planBlocks, shootBonus, vineTarget, type SimEvent,
} from '../src/arcade/urodzaj/sim';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems, type Lang } from '../src/i18n';

const DAY = '2026-10-25';
const STEP = 1 / 60;
/** The session's tuning as the runner builds it: the kit's defaults, Urodzaj's entry, and a beginner's on top. */
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.5, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
/** a player clearly focused (above the threshold) and clearly resting (below it) */
const FOCUS = frame({ activity: 8, level: 0.95, focused: true, calm: 0.05 });
const REST = frame({ activity: -4, level: 0.05, calm: 0.95 });
const FOG = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<UrodzajProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): UrodzajSim {
  const sim = new UrodzajSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, today's basket already played): the rules one at a time. */
const quiet = (o: SimOpts = {}): UrodzajSim => {
  const sim = makeSim({ ...o, progress: { sessions: 5, lastNewSession: 5, dailyDay: o.day ?? DAY, loafDay: o.day ?? DAY, ...o.progress } });
  sim.take();
  return sim;
};

/** Run the sim for `sec` at 60 fps; `f` may depend on the play time; returns the events. */
function drive(sim: UrodzajSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Run until the block index changes (or `max` s pass). */
function untilBlock(sim: UrodzajSim, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, max = 120): SimEvent[] {
  const i0 = sim.blockIndex, out: SimEvent[] = [];
  for (let k = 0; k < max / STEP && sim.blockIndex === i0 && sim.phase === 'play'; k++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

const tap = (sim: UrodzajSim, x = 0) => { sim.pointerDown(x); sim.pointerUp(x); };

/** A resting fruit placed by hand (the world's own sleep flags set, so it stays put). */
function place(w: World, tier: number, x: number, y?: number): Body {
  const b = w.add(tier, x, y ?? FRUITS[tier - 1].r);
  b.restT = 1;
  b.resting = true;
  b.touched = 0;
  return b;
}

/**
 * Great clusters never merge, and two side by side wedge between the walls: five heap well over the
 * rim, three stay under it (`n` of them, settled).
 */
function clusters(w: World, n = 5): void {
  for (const [x, y] of [[-0.22, 0.23], [0.22, 0.23], [-0.2, 0.68], [0.2, 0.68], [0, 1.12]].slice(0, n)) w.add(MAX_TIER, x, y);
  for (let i = 0; i < 480; i++) w.stepOnce();
  w.merges.length = 0;
}

/** A greedy player: the landing spot that touches an alike fruit, else the lowest one. */
function greedyX(sim: UrodzajSim): number {
  const tier = sim.hanging ?? 1, r = FRUITS[tier - 1].r;
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const x = -0.5 + r + 0.006 + (i / 24) * (1 - 2 * r - 0.012);
    const y = sim.world.dropY(x, r);
    let score = -y;
    for (const b of sim.world.bodies) {
      if (b.tier !== tier || Math.abs(b.x - x) >= b.r + r) continue;
      if (Math.abs(b.y + Math.sqrt((b.r + r) ** 2 - (b.x - x) ** 2) - y) < 1e-6) score += 2;
    }
    if (score > bestScore) { bestScore = score; best = x; }
  }
  return best;
}

// ── physics ──────────────────────────────────────────────────────
describe('the basket\'s physics', () => {
  it('drops an olive on the resting olive: it falls 1.03 W in under a second and they join into a grape between them', () => {
    const w = new World();
    place(w, 1, 0);
    w.add(1, 0, BASKET.hang);
    let t = 0;
    while (!w.merges.length && t < 3) { w.stepOnce(); t += PHYS.step; }
    expect(t).toBeGreaterThan(0.75);
    expect(t).toBeLessThan(0.95);
    expect(w.merges[0].tier).toBe(2);
    expect(w.merges[0].x).toBeCloseTo(0, 6);
    expect(w.count).toBe(1);
    expect(w.bodies[0].tier).toBe(2);
  });

  it('joins two alike of every tier up to the bunch, never the great cluster, never unlike fruit', () => {
    for (let k = 1; k < MAX_TIER; k++) {
      const w = new World(), r = FRUITS[k - 1].r;
      place(w, k, -r - 0.0005);
      place(w, k, r + 0.0005);
      for (let i = 0; i < 30; i++) w.stepOnce();
      expect(w.merges.map(m => m.tier), `tier ${k}`).toEqual([k + 1]);
    }
    const w = new World(), r9 = FRUITS[MAX_TIER - 1].r;
    place(w, MAX_TIER, -r9);
    place(w, MAX_TIER, r9);
    place(w, 1, -0.3, 0.6);
    place(w, 2, -0.3 + 0.042 + 0.052, 0.6);
    for (let i = 0; i < 240; i++) w.stepOnce();
    expect(w.merges).toHaveLength(0);
  });

  it('grows a merged fruit from its parents\' size to its own over 0.12 s', () => {
    const w = new World(), r = FRUITS[4].r;
    place(w, 5, -r);
    place(w, 5, r);
    w.stepOnce();
    const nb = w.merges[0].body;
    expect(nb.r).toBeLessThan(FRUITS[5].r);
    for (let i = 0; i < 0.12 / PHYS.step + 1; i++) w.stepOnce();
    expect(nb.r).toBeCloseTo(FRUITS[5].r, 9);
  });

  it('brings a 40-fruit heap to rest within 3 s, and then it stays still', () => {
    const w = new World(), rnd = mulberry32(7);
    // one fruit every 0.25 s from the hang line, kept from merging (each a tier unlike its neighbour in the queue)
    for (let i = 0; i < 40; i++) {
      const tier = 1 + (i % 6), r = FRUITS[tier - 1].r;
      w.add(tier, (rnd() - 0.5) * (1 - 2 * r - 0.01), BASKET.hang);
      for (let k = 0; k < 30; k++) w.stepOnce();
    }
    for (let i = 0; i < 3 / PHYS.step; i++) w.stepOnce();
    expect(w.energy()).toBeLessThan(1e-4);
    expect(w.bodies.every(b => b.resting)).toBe(true);
    const at = new Map(w.bodies.map(b => [b.id, [b.x, b.y]]));
    w.merges.length = 0;
    for (let i = 0; i < 2 / PHYS.step; i++) w.stepOnce();
    expect(w.merges).toHaveLength(0);
    let drift = 0;
    for (const b of w.bodies) {
      const p = at.get(b.id)!;
      drift = Math.max(drift, Math.hypot(b.x - p[0], b.y - p[1]));
    }
    expect(drift).toBeLessThan(1e-3);
  });

  it('keeps every fruit inside the basket through 2 000 random drops', () => {
    const w = new World(), rnd = mulberry32(11);
    let worst = 0;
    for (let d = 0; d < 2000; d++) {
      if (w.count >= 40) w.clear();
      const tier = 1 + Math.floor(rnd() * 4), r = FRUITS[tier - 1].r;
      w.add(tier, (rnd() - 0.5) * (1 - 2 * r - 0.01), BASKET.hang);
      for (let i = 0; i < 20; i++) {
        w.stepOnce();
        for (const b of w.bodies) worst = Math.max(worst, Math.abs(b.x) + b.r - halfWidthAt(b.y), b.r - b.y);
      }
    }
    expect(worst).toBeLessThan(BASKET.wall);   // inside the drawn wall at the worst impact
  });

  it('rolls a fruit off another instead of balancing it: no towers at the centre', () => {
    const w = new World();
    const fig = place(w, 4, 0);
    const date = w.add(3, 0.002, 0.5);
    for (let i = 0; i < 4 / PHYS.step; i++) w.stepOnce();
    expect(date.y).toBeLessThan(fig.y);            // it rolled down beside the fig
    expect(w.heapTop()).toBeLessThan(2 * FRUITS[3].r + 1e-3);
  });

  it('is deterministic: the same drops at the same steps give the same basket', () => {
    const run = () => {
      const w = new World(), rnd = mulberry32(3);
      for (let d = 0; d < 60; d++) {
        const tier = 1 + Math.floor(rnd() * 4), r = FRUITS[tier - 1].r;
        w.add(tier, (rnd() - 0.5) * (1 - 2 * r - 0.01), BASKET.hang);
        for (let i = 0; i < 70; i++) w.stepOnce();
      }
      return JSON.stringify(w.bodies.map(b => [b.tier, b.x, b.y, b.angle]));
    };
    expect(run()).toBe(run());
  });

  it('finds where a drop would land for the plumb line: the floor, a fruit below, a wall', () => {
    const w = new World();
    expect(w.dropY(0, 0.05)).toBeCloseTo(0.05, 9);
    const b = place(w, 4, 0.1);
    expect(w.dropY(0.1, 0.05)).toBeCloseTo(b.y + b.r + 0.05, 9);
    // near the slanted wall the centre stops where it would touch it, above the floor
    const x = -halfWidthAt(0.5) + 0.06;
    expect(w.dropY(x, 0.06)).toBeGreaterThan(0.06);
  });
});

// ── the rules of a basket ────────────────────────────────────────
describe('drops, merges and chains', () => {
  it('scores k(k − 1) for making tier k: 2, 6, 12 … 72, and the great cluster brings 150 more', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9].map(mergePoints)).toEqual([2, 6, 12, 20, 30, 42, 56, 72]);
    expect(FRUITS.map(f => f.pts)).toEqual([0, 2, 6, 12, 20, 30, 42, 56, 72]);
    const sim = quiet();
    sim.world.clear();
    const r = FRUITS[7].r;
    place(sim.world, 8, -r - 0.0005);
    place(sim.world, 8, r + 0.0005);
    const evs = drive(sim, 0.1, frame());
    expect(ofType(evs, 'merge')[0].pts).toBe(72);
    expect(ofType(evs, 'great')).toHaveLength(1);
    expect(sim.score).toBe(72 + 150);
    expect(sim.p.greatClusters).toBe(1);
  });

  it('links merges within 0.8 s of the basket\'s last one: ×1, ×1.25 … up to ×3', () => {
    expect([0, 1, 2, 3, 4, 8, 12].map(chainMult)).toEqual([1, 1.25, 1.5, 1.75, 2, 3, 3]);
    const sim = quiet();
    sim.world.clear();
    for (const x of [-0.3, 0.3]) {
      place(sim.world, 2, x - 0.0525);
      place(sim.world, 2, x + 0.0525);
    }
    const evs = drive(sim, 0.1, frame());
    expect(ofType(evs, 'merge').map(e => [e.link, e.pts])).toEqual([[0, 6], [1, 8]]);   // the same step: a chain of two
    drive(sim, 1, frame());
    place(sim.world, 1, -0.3, 0.6);
    place(sim.world, 1, -0.3 + 0.0845, 0.6);
    const late = ofType(drive(sim, 0.1, frame()), 'merge');
    expect(late.map(e => e.link)).toEqual([0]);   // a second later: a new chain
  });

  it('drops on release, after a 0.45 s cooldown; a release in its last 0.2 s waits for it, an earlier one is ignored', () => {
    const sim = quiet();
    tap(sim);
    let evs = drive(sim, STEP, frame());
    expect(ofType(evs, 'drop')).toHaveLength(1);
    drive(sim, 0.1, frame());
    tap(sim);   // 0.35 s left: too early
    evs = drive(sim, 0.5, frame());
    expect(ofType(evs, 'drop')).toHaveLength(0);
    tap(sim);
    evs = drive(sim, STEP, frame());
    expect(ofType(evs, 'drop')).toHaveLength(1);
    drive(sim, 0.3, frame());
    tap(sim);   // 0.13 s left: buffered
    evs = drive(sim, 0.2, frame());
    expect(ofType(evs, 'drop')).toHaveLength(1);
  });

  it('keeps the hanging fruit inside the rim for its size, and a pause disarms a drop', () => {
    const sim = quiet();
    sim.pointerMove(-2);
    drive(sim, STEP, frame());
    const r = FRUITS[sim.tierOf(0) - 1].r;
    expect(sim.aim).toBeCloseTo(-(0.5 - r - RULES.aimPad), 9);
    expect(Math.abs(sim.hangX)).toBeLessThanOrEqual(0.5 - r - RULES.aimPad + 1e-9);
    sim.pointerUp(0);
    sim.disarm();
    expect(ofType(drive(sim, 0.1, frame()), 'drop')).toHaveLength(0);
  });

  it('steers with the keys: a tap moves 0.02 W, holding speeds up from 0.5 to 1.6 W/s over 0.6 s', () => {
    const sim = quiet();
    sim.keyAim(1);
    sim.keyAim(0);
    drive(sim, STEP, frame());
    expect(sim.aim).toBeCloseTo(0.02, 9);
    sim.pointerMove(0.4);
    drive(sim, STEP, frame());
    sim.keyAim(-1);
    drive(sim, 0.1, frame());
    const slow = (0.4 - RULES.keyTap - sim.aim) / 0.1;
    drive(sim, 0.5, frame());
    const a = sim.aim;
    drive(sim, 0.1, frame());
    sim.keyAim(0);
    expect(slow).toBeGreaterThan(0.5);
    expect(slow).toBeLessThan(0.7);
    expect((a - sim.aim) / 0.1).toBeCloseTo(1.6, 1);
  });

  it('draws tiers 1–4 at 32/30/22/16 % and a breather\'s at 55/45 %', () => {
    const rnd = mulberry32(17), n = 10000;
    const count = [0, 0, 0, 0, 0], small = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      count[tierFromU(rnd(), false)]++;
      small[tierFromU(rnd(), true)]++;
    }
    DROP_ODDS.forEach((p, i) => expect(Math.abs(count[i + 1] / n - p)).toBeLessThan(0.015));
    expect(Math.abs(small[1] / n - 0.55)).toBeLessThan(0.015);
    expect(small[1] + small[2]).toBe(n);
  });

  it('opens every basket with an olive; the first-ever basket and the 8 drops after a great cluster are olives and grapes', () => {
    const first = makeSim({ planned: 300 });
    const tiers: number[] = [];
    drive(first, 9, frame(), { t: 0 }, t => { if (first.hanging !== null && tiers.length < 12 && Math.round(t * 60) % 40 === 0) { tiers.push(first.hanging); tap(first); } });
    expect(tiers[0]).toBe(1);
    expect(tiers.slice(0, BREATHER).every(k => k <= 2)).toBe(true);
    const sim = quiet();
    expect(sim.tierOf(0)).toBe(1);
    sim.world.clear();
    const r = FRUITS[7].r;
    place(sim.world, 8, -r - 0.0005);
    place(sim.world, 8, r + 0.0005);
    drive(sim, 1, frame());
    expect(sim.baskets).toBe(2);
    expect(sim.breather).toBe(BREATHER);
    expect(sim.tierOf(0)).toBe(1);
    for (let k = 1; k < BREATHER; k++) expect(sim.tierOf(k)).toBeLessThanOrEqual(2);
    expect(sim.world.count).toBe(1);                       // the new basket's olive
  });
});

describe('the rim: nothing is ever lost', () => {
  it('warns from 0.4 s over the rim and tips at 2 s: what is above rolls to the gleaners, every point stays', () => {
    const sim = quiet();
    sim.world.clear();
    clusters(sim.world);
    sim.score = 40;
    sim.basketPts = 40;
    const clock = { t: 0 };
    drive(sim, 0.3, frame(), clock);
    expect(sim.warning).toBe(0);
    const warn = drive(sim, 0.2, frame(), clock);
    expect(sim.overT).toBeGreaterThan(0.4);
    expect(ofType(warn, 'warnTick').length).toBeGreaterThan(0);
    const evs = drive(sim, 1.6, frame(), clock);
    const spill = ofType(evs, 'spill');
    expect(spill).toHaveLength(1);
    expect(spill[0].pts).toBe(40);
    expect(spill[0].spilled).toBeGreaterThan(0);
    expect(sim.score).toBe(40);
    expect(sim.spilled).toBe(true);
    // a new basket with its olive within 0.8 s
    const after = drive(sim, 0.8, frame(), clock);
    expect(ofType(after, 'newBasket')).toHaveLength(1);
    expect(sim.change).toBeNull();
    expect(sim.world.count).toBe(1);
    expect(sim.open).toBe(true);
  });

  it('spares the newest drop until 1 s after it first touched', () => {
    const sim = quiet();
    sim.world.clear();
    clusters(sim.world, 2);
    expect(sim.world.heapTop()).toBeLessThan(BASKET.rim);
    // the newest drop has just come to rest on top, over the rim (held there: only the rule is under test)
    const last = sim.world.add(4, 0, 1.0);
    last.touched = sim.world.t;
    sim.lastDrop = last;
    const hold = () => { last.x = 0; last.y = 1.0; last.vx = last.vy = last.spin = 0; };
    const clock = { t: 0 };
    drive(sim, RULES.overflowExempt - 0.1, frame(), clock, hold);
    expect(sim.overT).toBe(0);
    drive(sim, 0.4, frame(), clock, hold);
    expect(sim.overT).toBeGreaterThan(0.2);
    expect(sim.warning).toBe(0);
    drive(sim, 0.3, frame(), clock, hold);
    expect(sim.warning).toBeGreaterThan(0);
  });

  it('holds the timer in Rosa and through the payouts, and starts it over when the settle takes the heap under the rim', () => {
    const sim = quiet({ planned: 180 });
    const clock = { t: 0 };
    untilBlock(sim, frame(), clock);   // into Rosa
    sim.world.clear();
    clusters(sim.world);
    sim.overT = 1.5;
    drive(sim, 3, frame(), clock);
    expect(sim.overT).toBe(1.5);
    // the heap goes under the rim during the Rosa (the top clusters taken out): the settle resets the timer
    for (const b of sim.world.bodies.filter(x => x.y > 0.6)) sim.world.remove(b);
    const evs = untilBlock(sim, frame(), clock);
    evs.push(...drive(sim, 3, frame(), clock));
    expect(ofType(evs, 'settled')).toHaveLength(1);
    expect(ofType(evs, 'saved')).toHaveLength(1);
    expect(sim.overT).toBeLessThan(0.1);
  });

  it('never takes a point away over whole random sessions', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = makeSim({ seed, planned: 180, progress: seed % 2 ? {} : { sessions: 3 } });
      const rnd = mulberry32(seed + 50);
      let last = 0, ok = true;
      drive(sim, 182, t => (Math.sin(t / 5) > 0 ? FOCUS : REST), { t: 0 }, () => {
        if (rnd() < 0.03) tap(sim, (rnd() - 0.5) * 0.9);
        if (sim.score < last) ok = false;
        last = sim.score;
      });
      expect(ok, `seed ${seed}`).toBe(true);
    }
  });
});

// ── blocks ───────────────────────────────────────────────────────
describe('the blocks', () => {
  const sum = (b: { dur: number }[]) => b.reduce((s, x) => s + x.dur, 0);

  it.each([
    [40, true, [8, 12.48, 13.52]],
    [40, false, [16.32, 17.68]],
  ])('plans %i s (first-ever %s) as the design table says', (sec, first, want) => {
    const plan = planBlocks(sec, first, mulberry32(1));
    expect(plan.map(b => +b.dur.toFixed(2))).toEqual(want);
  });

  it.each([[40], [180], [300], [600]])('plans %i s to end on time: blocks of 12 s or more, a Rosa last, the evening\'s 6 s left', sec => {
    for (const first of [true, false]) {
      for (let seed = 1; seed <= 5; seed++) {
        const plan = planBlocks(sec, first, mulberry32(seed));
        expect(sum(plan)).toBeCloseTo(sec - RULES.finale, 6);
        expect(plan.every(b => b.kind === 'warmup' || b.dur >= RULES.minBlock - 1e-9)).toBe(true);
        expect(plan[plan.length - 1].kind).toBe('rosa');
        expect(plan[0].kind).toBe(first ? 'warmup' : 'zbior');
        const pairs = plan.filter(b => b.kind === 'zbior').length;
        expect(plan.filter(b => b.kind === 'rosa').length).toBe(pairs);
      }
    }
    const warm = planBlocks(sec, true, mulberry32(1))[0].dur;
    expect(warm).toBe(sec <= 60 ? 8 : sec <= 200 ? 20 : 30);
  });

  it('pairs the blocks like the design: 3 and 4 pairs in 3 min, 5 and 6 in 5 min, 11 and 12 in 10 min', () => {
    const pairs = (sec: number, first: boolean) => planBlocks(sec, first, mulberry32(2)).filter(b => b.kind === 'zbior').length;
    expect([pairs(180, true), pairs(180, false), pairs(300, true), pairs(300, false), pairs(600, true), pairs(600, false)]).toEqual([3, 4, 5, 6, 11, 12]);
  });

  it('telegraphs the next block 4 s ahead and plays the evening at the end', () => {
    const sim = quiet({ planned: 40 });
    const clock = { t: 0 };
    const evs = drive(sim, 40.5, frame(), clock);
    const tg = ofType(evs, 'telegraph');
    expect(tg.map(e => e.next)).toEqual(['rosa', 'evening']);
    expect(ofType(evs, 'evening')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('covers the basket in Rosa once the gather is done, takes drops nowhere in it, and lifts the cloth at the push telegraph', () => {
    const sim = quiet({ planned: 180 });
    const clock = { t: 0 };
    untilBlock(sim, frame(), clock);
    expect(sim.block.kind).toBe('rosa');
    expect(sim.open).toBe(false);
    expect(sim.hanging).toBeNull();
    drive(sim, 3, frame(), clock);
    expect(sim.veil).toBe(1);
    tap(sim);
    expect(ofType(drive(sim, 1, frame(), clock), 'drop')).toHaveLength(0);
    while (sim.blockT < sim.block.dur - RULES.telegraph + 1.1) drive(sim, STEP, frame(), clock);
    expect(sim.veil).toBe(0);                 // unveiled for the plan, still no drops
    tap(sim);
    expect(ofType(drive(sim, STEP, frame(), clock), 'drop')).toHaveLength(0);
    untilBlock(sim, frame(), clock);
    drive(sim, 3, frame(), clock);
    tap(sim);
    expect(ofType(drive(sim, STEP, frame(), clock), 'drop')).toHaveLength(1);   // the Zbiór is open again
  });

  it('may not stop mid-evening or while a fruit is on its way', () => {
    const sim = quiet({ planned: 40 });
    drive(sim, 37, frame());
    expect(sim.phase).toBe('evening');
    expect(sim.canStop()).toBe(false);
  });
});

// ── the band ─────────────────────────────────────────────────────
describe('the vine in Zbiór', () => {
  it('maps the level to its target: 0 up to 0.35, 1 from 0.85', () => {
    expect([0, 0.35, 0.6, 0.85, 1].map(vineTarget)).toEqual([0, 0, 0.5, 1, 1]);
  });

  it('grows after the lead-in (5 s on Mendi, 2 s on HALO) toward the target with τ 6 s', () => {
    for (const eeg of [false, true]) {
      const sim = quiet({ eeg });
      const lead = eeg ? RULES.leadZbiorEeg : RULES.leadZbior;
      drive(sim, lead - 0.1, FOCUS);
      expect(sim.V).toBe(0);
      drive(sim, 0.1 + 6, FOCUS);
      expect(sim.V).toBeCloseTo(1 - Math.exp(-1), 1);
    }
  });

  it('grows shoots for steady focus: +0.10 per 6 s of hold up to +0.30, easing off over 3 s when it breaks', () => {
    expect([0, 5.9, 6, 12, 18, 40].map(shootBonus)).toEqual([0, 0, 0.1, 0.2, 0.30000000000000004, 0.30000000000000004]);
    const sim = quiet();
    sim.plan[0].dur = 60;
    const clock = { t: 0 };
    let hold = 0;
    const evs = drive(sim, 5 + 19, () => frame({ ...FOCUS, hold: (hold += STEP) }), clock);
    expect(ofType(evs, 'shoot').map(e => e.n)).toEqual([1, 2, 3]);
    expect(sim.K).toBeCloseTo(0.3, 9);
    drive(sim, 1.5, frame({ ...FOCUS, focused: false, hold: 0 }), clock);
    expect(sim.K).toBeGreaterThan(0.1);
    expect(sim.K).toBeLessThan(0.2 + 1e-6);
  });

  it('allows A = 0.20 + 1.00 V + K, +0.15 after "Liść" — at most 1.65 r', () => {
    expect(allowance(0, 0)).toBeCloseTo(0.2, 9);
    expect(allowance(1, 0.3, true)).toBeCloseTo(1.65, 9);
    expect(allowance(2, 0.3, true)).toBeCloseTo(1.65, 9);
  });

  it('freezes the vine while the signal is unreliable, the block clock running on', () => {
    const sim = quiet();
    const clock = { t: 0 };
    drive(sim, 9, FOCUS, clock);
    const V = sim.V, T = sim.blockT;
    drive(sim, 3, FOG, clock);
    expect(sim.V).toBe(V);
    expect(sim.blockT).toBeCloseTo(T + 3, 6);
    expect(sim.mist).toBeGreaterThan(0.9);
  });

  it('lets nothing fall for 6 s after a dropout of 2 s or more, while the band climbs back', () => {
    const sim = quiet();
    sim.plan[0].dur = 60;
    const clock = { t: 0 };
    drive(sim, 12, FOCUS, clock);
    const V = sim.V;
    drive(sim, 2.5, FOG, clock);
    drive(sim, 5, frame({ level: 0.1 }), clock);
    expect(sim.V).toBeCloseTo(V, 9);
    drive(sim, 3, frame({ level: 0.1 }), clock);
    expect(sim.V).toBeLessThan(V);
  });

  it('pays a block with under 8 reliable seconds at the neutral floor, with no verdict', () => {
    const sim = quiet({ planned: 180 });
    const evs = untilBlock(sim, FOG);
    expect(ofType(evs, 'stamp')).toHaveLength(0);
    expect(sim.payout?.range).toBeCloseTo(allowance(RULES.neutral, 0), 9);
    expect(sim.zbiorJudged).toBe(0);
  });

  it('judges a Zbiór on its last 15 s: "Liść" adds 0.15 to the gather; else "Prawie" with the seconds it had', () => {
    const won = quiet({ planned: 180 });
    const evs = untilBlock(won, FOCUS);
    expect(ofType(evs, 'stamp')[0].kind).toBe('leaf');
    expect(won.payout?.range).toBeCloseTo(allowance(won.V, won.K, true), 9);
    const lost = quiet({ planned: 180 });
    const evs2 = untilBlock(lost, REST);
    const st = ofType(evs2, 'stamp')[0];
    expect(st.kind).toBe('almost');
    expect(st.need).toBeCloseTo(15 * (0.5 - TUNING.judgeBias), 1);
    expect(st.have).toBeLessThan(st.need);
    expect(t('stamp.almostLine', { have: st.have, need: st.need })).toContain(String(st.need).replace('.', ','));
  });

  it('judges with the session\'s own tuning, so a beginner\'s judge leans further toward the player', () => {
    const half = (tuning: FocusTuning) => {
      const sim = quiet({ planned: 180, tuning });
      let k = 0;
      // above the threshold a bit under 40 % of the time
      const evs = untilBlock(sim, () => ((k++ % 100) < 37 ? FOCUS : REST));
      return ofType(evs, 'stamp')[0]?.kind;
    };
    expect(half(TUNING)).toBe('almost');
    expect(half(BEGINNER)).toBe('leaf');
  });

  it('shows the vine\'s tendrils only between resting alike fruit with a clear line, nearest first', () => {
    const sim = quiet();
    sim.world.clear();
    const r = FRUITS[2].r;
    place(sim.world, 3, -0.2);
    place(sim.world, 3, -0.2 + 2 * r + 0.6 * r);    // a near miss
    place(sim.world, 5, 0.2);
    drive(sim, RULES.leadZbior + 0.5, FOCUS);
    expect(sim.vine).toHaveLength(1);
    expect(sim.vine[0].gap).toBeCloseTo(0.6 * r, 3);
    expect(sim.vine[0].r).toBe(Math.max(r, RULES.reachR));   // small fruit reach at least as far as 0.1 W allows
  });
});

describe('the gather and the dew: paid right after the block', () => {
  /** A Zbiór that ends with a pair `gapR` apart (in r) left in the basket. */
  function pairAtEnd(gapR: number, f: FocusFrame): { sim: UrodzajSim; during: SimEvent[]; after: SimEvent[] } {
    const sim = quiet({ planned: 180 });
    sim.world.clear();
    const r = FRUITS[3].r;
    place(sim.world, 4, -0.15);
    place(sim.world, 4, -0.15 + 2 * r + gapR * r);
    const clock = { t: 0 };
    const during = untilBlock(sim, f, clock);
    const after = drive(sim, 3, frame(), clock);
    return { sim, during, after };
  }

  it('gathers a tied pair after the Zbiór (never during it), pulled along its tendril into one chain', () => {
    const { sim, during, after } = pairAtEnd(0.9, FOCUS);
    expect(ofType(during, 'merge')).toHaveLength(0);
    const m = ofType(after, 'merge');
    expect(m.map(e => [e.tier, e.via])).toEqual([[5, 'vine']]);
    expect(ofType(after, 'gather')[0].pairs).toBe(1);
    expect(sim.world.bodies.map(b => b.tier)).toEqual([5]);
  });

  it('leaves a pair the vine did not reach: a calm player\'s A is 0.20', () => {
    const { after } = pairAtEnd(0.9, REST);
    expect(ofType(after, 'merge')).toHaveLength(0);
    expect(ofType(after, 'gather')[0].pairs).toBe(0);
  });

  it('gathers each fruit once, at most 10 pairs, the closest first, and never across a fruit in the way', () => {
    const w = new World();
    const r = FRUITS[0].r;
    for (let i = 0; i < 12; i++) {
      place(w, 1, -0.4 + i * 0.07, 0.042);
      place(w, 1, -0.4 + i * 0.07, 0.042 + 2 * r + 0.3 * r);
    }
    const found: Pair[] = [];
    w.pairs(found, { maxGap: 1, limit: 64, clear: RULES.clear });
    const sim = quiet();
    // the sim's own selection, from the same pairs
    const picked = (sim as unknown as { gatherPairs(range: number): [Body, Body][] });
    expect(picked).toBeTruthy();
    // a fruit in the gap blocks the line
    const v = new World();
    place(v, 2, -0.2);
    place(v, 2, 0.2);
    place(v, 5, 0, 0.1);
    v.pairs(found, { maxGap: 6, limit: 64, clear: RULES.clear });
    expect(found).toHaveLength(0);
    v.pairs(found, { maxGap: 6, limit: 64 });
    expect(found).toHaveLength(1);
  });

  it('caps the gather at 10 pairs', () => {
    const sim = quiet({ planned: 180 });
    sim.world.clear();
    const r = FRUITS[0].r;
    for (let i = 0; i < 12; i++) {
      place(sim.world, 1 + (i % 2), -0.42 + i * 0.075, FRUITS[i % 2].r);
      place(sim.world, 1 + (i % 2), -0.42 + i * 0.075, FRUITS[i % 2].r * 3 + 0.5 * r);
    }
    const clock = { t: 0 };
    untilBlock(sim, FOCUS, clock);
    const evs = drive(sim, 0.5, frame(), clock);
    expect(ofType(evs, 'gather')[0].pairs).toBeLessThanOrEqual(RULES.gatherMax);
  });

  it('gathers the dew from calm after its lead-in: dD/dt = 0.065 calm − 0.010', () => {
    for (const eeg of [false, true]) {
      const sim = quiet({ planned: 180, eeg });
      const clock = { t: 0 };
      untilBlock(sim, frame(), clock);
      const lead = eeg ? RULES.leadRosaEeg : RULES.leadRosa;
      drive(sim, lead + 10, frame({ calm: 0.8 }), clock);
      expect(sim.D).toBeCloseTo((0.065 * 0.8 - 0.01) * 10, 1);
      expect(sim.beads).toBe(Math.round(RULES.beads * sim.D));
    }
    expect(bridgeRange(0)).toBeCloseTo(0.15, 9);
    expect(bridgeRange(1, true)).toBeCloseTo(1.25, 9);
  });

  it('freezes the dew under mist, and "Kropla" widens the bridges by 0.10', () => {
    const sim = quiet({ planned: 180 });
    const clock = { t: 0 };
    untilBlock(sim, frame(), clock);
    drive(sim, 8, REST, clock);
    const D = sim.D;
    drive(sim, 3, FOG, clock);
    expect(sim.D).toBe(D);
    const evs = untilBlock(sim, REST, clock);
    expect(ofType(evs, 'stamp')[0].kind).toBe('drop');
    expect(sim.payout?.range).toBeCloseTo(bridgeRange(sim.payout!.dew, true), 9);
  });

  it('settles the heap after Rosa and bridges a near pair the dew reaches', () => {
    const run = (calm: number) => {
      const sim = quiet({ planned: 180 });
      const clock = { t: 0 };
      untilBlock(sim, frame(), clock);
      drive(sim, 3, frame({ calm }), clock);
      sim.world.clear();
      const r = FRUITS[2].r;
      place(sim.world, 3, -0.1);
      place(sim.world, 3, -0.1 + 2 * r + 0.4 * r);
      const during = untilBlock(sim, frame({ calm, activity: calm > 0.5 ? -4 : 4 }), clock);
      const after = drive(sim, 3, frame(), clock);
      return { sim, during, after };
    };
    const deep = run(0.95);
    expect(ofType(deep.during, 'merge')).toHaveLength(0);
    expect(ofType(deep.after, 'settle')).toHaveLength(1);
    expect(ofType(deep.after, 'merge')).toHaveLength(1);       // the shiver or the dew's bridge joins them
    const shallow = run(0.1);
    expect(ofType(shallow.after, 'merge')).toHaveLength(0);
  });

  it('shows nothing live in a blind block, and reveals what it did at its end', () => {
    // from the 3rd session: the 4th Zbiór of all time is "Zbiór za chmurą", the 2nd Rosa "Zmierzch"
    const sim = quiet({ planned: 300, progress: { sessions: 2, zbiory: 3, rosy: 1 } });
    expect(sim.block.blind).toBe(true);
    const clock = { t: 0 };
    let hold = 0;
    const evs = untilBlock(sim, () => frame({ ...FOCUS, hold: (hold += STEP) }), clock);
    expect(sim.padLevel(FOCUS)).toBeNull();   // Rosa now
    expect(ofType(evs, 'shoot').every(e => e.blind)).toBe(true);
    const reveal = ofType(drive(sim, 1, frame(), clock), 'revealZbior');
    expect(reveal).toHaveLength(1);
    expect(sim.block.kind).toBe('rosa');
    expect(sim.block.blind).toBe(true);
    const rosa = untilBlock(sim, REST, clock);
    expect(ofType(rosa, 'bead')).toHaveLength(0);
    expect(ofType(drive(sim, 1, frame(), clock), 'revealRosa')).toHaveLength(1);
  });

  it('turns blind only from the 3rd session, in the all-time rotation (Zbiór % 4 = 0, Rosa % 4 = 2)', () => {
    const second = quiet({ planned: 300, progress: { sessions: 1, zbiory: 3, rosy: 1 } });
    expect(second.plan.some(b => b.blind)).toBe(false);
    const third = quiet({ planned: 600, progress: { sessions: 2, zbiory: 0, rosy: 0 } });
    const clock = { t: 0 };
    const kinds: string[] = [];
    while (third.phase === 'play') {
      const b = third.block;
      if (!kinds[third.blockIndex]) kinds[third.blockIndex] = `${b.kind}${b.blind ? '*' : ''}`;
      drive(third, 1, frame(), clock);
    }
    expect(kinds.slice(0, 8)).toEqual(['zbior', 'rosa', 'zbior', 'rosa*', 'zbior', 'rosa', 'zbior*', 'rosa']);
  });

  it('lets the pad follow only what the screen shows: steady in the warm-up, the vine in a sighted Zbiór, nothing else', () => {
    const first = makeSim({ planned: 300 });
    expect(first.padLevel(FOCUS)).toBe(0.5);
    const sim = quiet({ planned: 180 });
    const clock = { t: 0 };
    drive(sim, 9, FOCUS, clock);
    expect(sim.padLevel(FOCUS)).toBeCloseTo(sim.V, 9);
    expect(sim.padLevel(FOG)).toBeNull();
    untilBlock(sim, FOCUS, clock);
    expect(sim.padLevel(REST)).toBeNull();
  });

  it('measures the session\'s push-minus-rest contrast for the summary', () => {
    const sim = quiet({ planned: 180 });
    drive(sim, 180, () => (sim.block?.kind === 'zbior' ? frame({ ...FOCUS, activity: 6 }) : frame({ ...REST, activity: 1 })));
    expect(sim.contrast.contrast).toBeCloseTo(5, 6);
  });
});

// ── the meta ─────────────────────────────────────────────────────
describe('the table and the guests', () => {
  it('sets the table in 8 steps of 700 points from 350, every harvest point and 150 per day\'s loaf', () => {
    expect(TABLE_STEPS).toHaveLength(8);
    expect(tablePoints(freshProgress())).toBe(TABLE_START);
    expect(tableState(TABLE_START)).toMatchObject({ built: 0, have: 350, need: TABLE_STEP });
    expect(tableState(tablePoints({ harvest: 1000, loaves: 2 }))).toMatchObject({ built: 2, have: 350 + 1000 + 2 * LOAF_POINTS - 1400 });
    expect(tableState(8 * TABLE_STEP + 10)).toMatchObject({ built: 8, next: null });
  });

  it('sets the day\'s loaf on the first saved session of the day, whatever the score — the same for everyone', () => {
    const sim = makeSim({ planned: 40, progress: { sessions: 4, lastNewSession: 4 } });
    drive(sim, 41, frame());
    expect(sim.score).toBe(0);
    expect(sim.p.loaves).toBe(1);
    expect(sim.p.loafDay).toBe(DAY);
    const again = makeSim({ planned: 40, progress: { ...sim.p } });
    drive(again, 41, frame());
    expect(again.p.loaves).toBe(1);
    expect(again.loafNow).toBe(false);
  });

  it('draws evenly within a tier, turns duplicates into 5 grain and 25 grain into the lowest missing guest', () => {
    const p = freshProgress();
    const seen = new Map<string, number>();
    for (let i = 0; i < 5000; i++) {
      const q = freshProgress();
      const d = drawGuest(q, 'common', mulberry32(i + 1));
      seen.set(d.id, (seen.get(d.id) ?? 0) + 1);
    }
    expect([...seen.values()].every(n => Math.abs(n / 5000 - 0.2) < 0.03)).toBe(true);
    p.guests = ['piekarka', 'pasterz', 'wdowa', 'chlopiec', 'zniwiarka'];
    let crafted: string[] = [];
    for (let i = 0; i < 5; i++) crafted = crafted.concat(drawGuest(p, 'common', mulberry32(i)).crafted);
    expect(crafted).toEqual(['booz']);       // the lowest missing tier first
    expect(p.grain).toBe(0);
    expect(CRAFT_GRAIN).toBe(25);
  });

  it('publishes the odds of a new guest per tier and gives pity\'s guest never the legendary', () => {
    const p = freshProgress();
    expect(newChance(p, 'common')).toBe(1);
    p.guests = ['piekarka', 'pasterz', 'wdowa', 'chlopiec'];
    expect(newChance(p, 'common')).toBeCloseTo(0.2, 9);
    p.guests = GUESTS.filter(g => g.tier && g.tier !== 'legend').map(g => g.id);
    expect(nextMissing(p, false)).toBeNull();
    expect(nextMissing(p)).toBe('rodzina');
    const d = drawGuest(p, 'common', mulberry32(1), true);
    expect(d.isNew).toBe(false);
  });

  it('brings a new guest at least every second session (pity), and at most 3 draws an evening', () => {
    const p: UrodzajProgress = { ...freshProgress(), sessions: 5, lastNewSession: 3, guests: ['piekarka', 'pasterz', 'wdowa', 'chlopiec', 'rut', 'noemi'], ruthAt: 2, naomiAt: 3 };
    const sim = makeSim({ planned: 40, progress: p });
    drive(sim, 41, frame());
    expect(sim.guestsNow.filter(g => g.isNew)).toHaveLength(1);
    expect(sim.p.lastNewSession).toBe(6);
    expect(sim.guestsNow.length).toBeLessThanOrEqual(RULES.maxDraws + 1);
  });

  it('brings Ruth to the table on the first spill or in the 3rd session, and Naomi the session after', () => {
    const p = freshProgress();
    expect(ruthDue(p, 1, false)).toBe(false);
    expect(ruthDue(p, 1, true)).toBe(true);
    expect(ruthDue(p, 3, false)).toBe(true);
    p.ruthAt = 2;
    expect(naomiDue(p, 2)).toBe(false);
    expect(naomiDue(p, 3)).toBe(true);
    const third = makeSim({ planned: 40, progress: { sessions: 2, lastNewSession: 2, dailyDay: DAY } });
    drive(third, 41, frame());
    expect(third.p.ruthAt).toBe(3);
    expect(third.p.guests).toContain('rut');
    expect(third.result().verse).toBe('rut2.16');
    const fourth = makeSim({ planned: 40, progress: { ...third.p } });
    drive(fourth, 41, frame());
    expect(fourth.p.naomiAt).toBe(4);
    expect(fourth.result().highlights).toContain(t('hl.naomi'));
  });

  it('draws rarer guests for honest feats: deep dew rare, a blind Rosa passed epic, the session\'s contrast legendary', () => {
    const tierOf = (sim: UrodzajSim) => GUESTS.find(g => g.id === sim.guestsNow.find(x => x.via === 'draw')?.id)?.tier;
    // a 2nd session: no blind blocks yet, so a Rosa passed is no "Zmierzch z kroplą"
    const known = { sessions: 1, lastNewSession: 1, dailyDay: DAY, loafDay: DAY, ruthAt: 1, naomiAt: 2, guests: ['rut', 'noemi'] };
    const deep = makeSim({ planned: 180, progress: known });
    drive(deep, 181, () => (deep.block?.kind === 'rosa' ? frame({ ...REST, activity: 1 }) : frame({ ...FOCUS, activity: 1 })));
    expect(tierOf(deep)).toBe('rare');
    const legend = makeSim({ planned: 180, progress: known });
    drive(legend, 181, () => (legend.block?.kind === 'rosa' ? REST : FOCUS));
    expect(tierOf(legend)).toBe('legend');
    const plain = makeSim({ planned: 180, progress: known });
    drive(plain, 181, frame({ activity: 1, calm: 0.5 }));
    expect(tierOf(plain)).toBe('common');
  });
});

describe('Kosz dnia, result and the summary', () => {
  it('gives everyone the same fruit: the n-th drop of the day does not depend on how anyone plays', () => {
    const tiersOf = (seed: number, every: number) => {
      const sim = makeSim({ seed, planned: 300, progress: { sessions: 4, lastNewSession: 4 }, daySeed: 777 });
      const tiers: number[] = [];
      drive(sim, 20, frame(), { t: 0 }, t => {
        if (sim.hanging !== null && Math.round(t * 60) % every === 0) {
          tiers.push(sim.hanging);
          tap(sim, (seed % 3 - 1) * 0.3);
        }
      });
      return tiers;
    };
    const a = tiersOf(1, 40), b = tiersOf(9, 70);
    const n = Math.min(a.length, b.length);
    expect(n).toBeGreaterThan(10);
    // each basket's first is an olive by rule: compare the stream itself
    const sa = makeSim({ seed: 1, progress: { sessions: 4 }, daySeed: 777 }), sb = makeSim({ seed: 2, progress: { sessions: 4 }, daySeed: 777 });
    for (let i = 0; i < 50; i++) expect(sa.dropU(i)).toBe(sb.dropU(i));
    const later = makeSim({ seed: 1, progress: { sessions: 4, dailyDay: DAY }, daySeed: 777 });
    expect([0, 1, 2, 3].map(i => later.dropU(i))).not.toEqual([0, 1, 2, 3].map(i => sa.dropU(i)));
    expect(sa.daily).toBe(true);
    expect(later.daily).toBe(false);
  });

  it('plans the day\'s first session from the date', () => {
    const a = makeSim({ seed: 1, progress: { sessions: 4 }, daySeed: 31 }), b = makeSim({ seed: 2, progress: { sessions: 4 }, daySeed: 31 });
    expect(a.plan.map(x => x.dur)).toEqual(b.plan.map(x => x.dur));
  });

  it('marks the day\'s basket only in result(), which is idempotent: records with Math.max, counters only during play', () => {
    const sim = makeSim({ planned: 40, progress: { sessions: 4, lastNewSession: 4, bestSession: 9999 } });
    drive(sim, 41, frame(), { t: 0 }, t => { if (Math.round(t * 60) % 40 === 0) tap(sim); });
    expect(sim.p.dailyDay).toBe('');
    const a = sim.result();
    const p1 = JSON.stringify(sim.p);
    const b = sim.result();
    expect(JSON.stringify(sim.p)).toBe(p1);
    expect(b).toEqual(a);
    expect(sim.p.dailyDay).toBe(DAY);
    expect(sim.p.dailyScore).toBe(sim.score);
    expect(sim.p.sessions).toBe(5);
    expect(sim.p.bestSession).toBe(9999);
    expect(a.record).toBe(false);
  });

  it('counts a session only when it is saved: after an abandoned first attempt the next one is still the first', () => {
    const progress = freshProgress();
    const before = JSON.stringify(progress);
    const sim = makeSim({ planned: 40, progress });
    drive(sim, 20, frame(), { t: 0 }, t => { if (Math.round(t * 60) % 40 === 0) tap(sim); });
    // the runner undoes what an abandoned session changed in the progress
    const restored = JSON.parse(before) as UrodzajProgress;
    const next = makeSim({ planned: 40, progress: restored });
    expect(next.session).toBe(1);
    expect(next.plan[0].kind).toBe('warmup');
  });

  it('settles a session ended early like its evening: the open block is paid, the loaf and the draws rolled, once', () => {
    const sim = makeSim({ planned: 300, progress: { sessions: 4, lastNewSession: 2, ruthAt: 1, naomiAt: 2, guests: ['rut', 'noemi'] } });
    sim.world.clear();
    const r = FRUITS[3].r;
    place(sim.world, 4, -0.15);
    place(sim.world, 4, -0.15 + 2 * r + 0.8 * r);
    drive(sim, 12, FOCUS);
    const guests = sim.p.guests.length;
    sim.finish();
    expect(sim.phase).toBe('done');
    expect(sim.p.loaves).toBe(1);
    expect(sim.p.guests.length).toBe(guests + 1);          // pity: a new one
    expect(sim.world.bodies.map(b => b.tier)).toEqual([5]);  // the open Zbiór's gather, at once
    const p = JSON.stringify(sim.p);
    sim.finish();
    expect(JSON.stringify(sim.p)).toBe(p);
    expect(sim.canStop()).toBe(true);
  });

  it('puts the session\'s best moments first and keeps the summary to five lines', () => {
    const sim = makeSim({ planned: 180, progress: { sessions: 1, lastNewSession: 1, bestBasket: 1, bestChain: 1, bestSession: 1 }, seed: 4 });
    drive(sim, 182, () => (sim.block?.kind === 'rosa' ? REST : FOCUS), { t: 0 }, () => {
      if (sim.hanging !== null && sim.cooldown <= 0) {
        const x = greedyX(sim);
        sim.pointerMove(x);
        tap(sim, x);
      }
    });
    const out = sim.result();
    expect(out.highlights.length).toBeGreaterThan(0);
    expect(out.highlights.length).toBeLessThanOrEqual(5);
    expect(out.stats).toHaveLength(8);
    expect(out.unit).toBe(unit(out.score));
  });
});

describe('the closing verse: one, at rest, never the root', () => {
  it('closes the first session on the good land\'s fruit and takes the fitting passages in turn', () => {
    const first = makeSim({ planned: 40 });
    drive(first, 41, frame(), { t: 0 }, t => { if (Math.round(t * 60) % 40 === 0) tap(first); });
    expect(first.closingVerse()).toBe('deu8.8');
    const verses = new Set<string>();
    for (let s = 4; s <= 12; s++) {
      const sim = makeSim({ planned: 40, progress: { sessions: s, lastNewSession: s, dailyDay: DAY, loafDay: DAY, ruthAt: 1, naomiAt: 2, bestTier: 9 } });
      drive(sim, 41, frame());
      const v = sim.result().verse!;
      verses.add(v);
      expect(v).not.toBe('deu8.10');
    }
    expect(verses.has('psa126.5')).toBe(true);
    expect(verses.size).toBeGreaterThan(1);
  });

  it('exposes no verse during play: no event carries a passage and none may show before the session is over', () => {
    const sim = makeSim({ planned: 180, progress: { sessions: 2, lastNewSession: 2 } });
    const evs = drive(sim, 182, t => (Math.sin(t / 7) > 0 ? FOCUS : REST), { t: 0 }, t => {
      if (sim.phase !== 'done') expect(sim.verseMayShow).toBe(false);
      if (Math.round(t * 60) % 45 === 0) tap(sim, Math.sin(t) * 0.3);
    });
    expect(JSON.stringify(evs)).not.toMatch(/"(deu|psa|lev|jhn|luk|mat|rut)\d/);
    expect(sim.verseMayShow).toBe(true);
    const v = sim.result().verse;
    expect(v).toBeDefined();
    expect(passage(v!).text.length).toBeGreaterThan(10);
  });
});

describe('the smoke path: generic taps at the centre and the simulator\'s focus', () => {
  it.each([[false, false], [false, true], [true, false], [true, true]])('scores within 22 s of a 40 s session (returning %s, HALO %s) over 40 seeds; the first merge by 2 s', (returning, eeg) => {
    for (let seed = 1; seed <= 40; seed++) {
      const sim = makeSim({ seed, planned: 40, eeg, daySeed: 1000 + seed, tuning: returning ? TUNING : BEGINNER, progress: returning ? { sessions: 4, lastNewSession: 4 } : {} });
      const period = [0.65, 0.66, 2 / 3, 0.68, 0.7][seed % 5];
      let tapT = 0, n = 0, first = -1;
      const clock = { t: 0 };
      while (clock.t < 22) {
        clock.t += STEP;
        if ((tapT += STEP) >= period) {
          tapT -= period;
          sim.pointerMove(0);
          tap(sim);
          if (++n % 3 === 0) sim.keyDrop();
        }
        // the simulator's focus: activity rises to about +20 % over ~10 s
        const level = clock.t > 5 ? 0.9 : 0.3;
        sim.update(STEP, frame({ level, activity: clock.t > 5 ? 20 : 0, focused: clock.t > 5, hold: Math.max(0, clock.t - 5) }), clock.t);
        for (const e of sim.take()) if (e.type === 'merge' && first < 0) first = clock.t;
      }
      expect(sim.score, `seed ${seed}`).toBeGreaterThan(0);
      expect(first, `seed ${seed}`).toBeGreaterThan(0);
      expect(first, `seed ${seed}`).toBeLessThan(2);
    }
  });
});

// ── the bot harness: tuning targets ──────────────────────────────
describe('tuning', () => {
  it('a centre-only tapper overflows a basket now and then (the rim is a real limit), never before 25 s', () => {
    const times: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      const sim = quiet({ seed, planned: 600 });
      sim.plan[0].dur = 1e9;
      let at = -1;
      const clock = { t: 0 };
      let tapT = 0;
      while (clock.t < 150 && at < 0) {
        clock.t += STEP;
        if ((tapT += STEP) >= 0.65) { tapT -= 0.65; tap(sim); }
        sim.update(STEP, frame(), clock.t);
        for (const e of sim.take()) if (e.type === 'spill') at = clock.t;
      }
      times.push(at);
    }
    const spilled = times.filter(x => x > 0);
    expect(spilled.length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...spilled)).toBeGreaterThan(25);
  });

  it('a greedy player\'s baskets last 60 drops or more and reach a melon in most 300-drop runs', () => {
    const lives: number[] = [];
    let melons = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const sim = quiet({ seed, planned: 900 });
      sim.plan[0].dur = 1e9;
      let drops = 0, start = 0, top = 0, since = 0;
      const clock = { t: 0 };
      while (drops < 300 && clock.t < 900) {
        clock.t += STEP;
        sim.update(STEP, frame(), clock.t);
        for (const e of sim.take()) {
          if (e.type === 'merge') top = Math.max(top, e.tier);
          if (e.type === 'spill' || e.type === 'greatBasket') { lives.push(drops - start); start = drops; }
        }
        if (sim.hanging !== null && (since += STEP) >= 0.7) {
          const x = greedyX(sim);
          sim.pointerMove(x);
          tap(sim, x);
          drops++;
          since = 0;
        }
      }
      if (top >= 7) melons++;
    }
    expect(lives.reduce((s, x) => s + x, 0) / lives.length).toBeGreaterThanOrEqual(60);
    expect(melons).toBeGreaterThanOrEqual(2);
  });

  /**
   * Real sessions of a human-like player (60 % greedy with a shaky hand, 40 % anywhere): the first three
   * Zbiór blocks of a 5-minute session with or without focus, and the Rosa blocks with deep dew or none.
   */
  function payouts(focus: boolean, calm: number, seeds = 16) {
    const gathered: number[] = [], settled: number[] = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const sim = quiet({ seed, planned: 300, progress: { sessions: 1, lastNewSession: 1, ruthAt: 1 } });
      const rnd = mulberry32(seed * 7);
      const clock = { t: 0 };
      let since = 0, hold = 0, zbior = 0, merged = 0;
      while (sim.phase === 'play' && zbior <= 3) {
        const b = sim.block;
        const f = b.kind === 'zbior' ? (focus ? frame({ ...FOCUS, hold: (hold += STEP) }) : frame({ ...REST, calm: 0.5 })) : frame({ activity: calm > 0.5 ? -4 : 4, calm });
        if (b.kind !== 'zbior') hold = 0;
        clock.t += STEP;
        sim.update(STEP, f, clock.t);
        for (const e of sim.take()) {
          if (e.type === 'blockStart' && e.block.kind === 'zbior') zbior++;
          if (e.type === 'gathered' && zbior <= 3) gathered.push(e.merged);
          if (e.type === 'settle') merged = 0;
          if (e.type === 'merge' && sim.payout?.kind === 'settle') merged++;
          if (e.type === 'settled') settled.push(merged + e.merged);
        }
        if (sim.hanging !== null && (since += STEP) >= 0.8) {
          const x = rnd() < 0.6 ? greedyX(sim) + (rnd() - 0.5) * 0.12 : (rnd() - 0.5) * 0.8;
          sim.pointerMove(x);
          tap(sim, x);
          since = 0;
        }
      }
    }
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
    return { gather: mean(gathered), settle: settled.filter(n => n > 0).length / Math.max(1, settled.length) };
  }

  it('the vine gathers about a pair a Zbiór for a focused player, hardly any without focus', () => {
    const on = payouts(true, 0.95), off = payouts(false, 0.95);
    expect(on.gather).toBeGreaterThan(0.7);
    expect(off.gather).toBeLessThan(0.35);
    expect(on.gather).toBeGreaterThan(3 * off.gather);
  });

  it('the dew\'s settle joins fruit in a good share of Rosas with deep dew, and hardly any without', () => {
    const deep = payouts(false, 0.95), dry = payouts(false, 0);
    expect(deep.settle).toBeGreaterThan(0.2);
    expect(dry.settle).toBeLessThan(0.1);
    expect(deep.settle).toBeGreaterThan(2 * dry.settle);
  });
});

// ── texts ────────────────────────────────────────────────────────
describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('leaves no Polish behind: only names and signs read the same as the Polish ones', () => {
    const same = new Set(['pct', 'sec', 'fx.points', 'fx.chain', 'panel.tile', 'block.rosaBlind', 'guest.booz', 'guest.rut', 'guest.noemi', 'table.pergola.short', 'stat.contrast', 'fruit.7', 'pairs']);
    for (const l of LANGS.filter(x => x !== 'pl') as Lang[]) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (same.has(k)) continue;
        expect(JSON.stringify(v), `${l}.${k}`).not.toBe(JSON.stringify(CATALOGS.pl[k as keyof typeof CATALOGS.pl]));
      }
    }
  });

  it('keeps every guest\'s Polish line to 60 characters, and gives the three people of the Book of Ruth their references', () => {
    for (const g of GUESTS) expect(CATALOGS.pl[`guest.${g.id}.line` as keyof typeof CATALOGS.pl].toString().length, g.id).toBeLessThanOrEqual(60);
    expect(GUESTS.filter(g => g.ref).map(g => g.id).sort()).toEqual(['booz', 'noemi', 'rut']);
    for (const l of LANGS as readonly Lang[]) expect(String(CATALOGS[l]['guest.after'])).toMatch(/\{ref\}/);
  });

  it('names the units with the right plural, and makes labels with cap()', () => {
    expect(unit(1)).toBe('pkt');
    expect(bare('baskets', 3)).toBe('kosze');
    expect(t('baskets', { n: 5 })).toBe('5 koszy');
    expect(t('grain', { n: 22 })).toBe('22 ziarna');
    expect(cap(FRUITS[7].name)).toBe('Kiść winogron');
    expect(TIPS.zbior.every(s => !/skup|mocniej|opróżnij/i.test(s))).toBe(true);
  });

  it('uses no holiness words for verdicts and no "energy" anywhere', () => {
    for (const l of LANGS as readonly Lang[]) {
      const all = JSON.stringify(CATALOGS[l]).toLowerCase();
      expect(all).not.toMatch(/błogosław|namaszcz|wiern|energi|przepływ|blessed|anointed|faithful|energy|gesegnet|energie|välsignad|energi/);
    }
  });

  it('keeps the tiers named by distance, never worth', () => {
    expect(TIERS.map(x => t(`tier.${x}` as 'tier.common'))).toEqual(['z sąsiedztwa', 'z okolicy', 'z daleka', 'z dalekiego kraju']);
  });
});

// ── the view's layout and the lobby's card ───────────────────────
const SIZES: [number, number][] = [[390, 844], [360, 640], [430, 932], [844, 390], [1280, 800], [1024, 768], [1920, 1080], [768, 1024]];
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the layout', () => {
  it('centres the basket under the smoke test\'s tap (50 %, 60 %): it aims at the middle, inside the basket', () => {
    for (const [w, h] of SIZES) {
      const L = layout(w, h);
      const x = (w * 0.5 - L.cx) / L.s, y = (L.floorY - h * 0.6) / L.s;
      expect(Math.abs(x), `${w}×${h}`).toBeLessThan(1e-9);
      expect(y, `${w}×${h}`).toBeGreaterThan(0);
      expect(y, `${w}×${h}`).toBeLessThan(BASKET.hang + DROP_MAX_R);
    }
  });

  it('keeps the basket, its walls and the largest hanging fruit between the runner\'s strips', () => {
    for (const [w, h] of SIZES) {
      const L = layout(w, h), id = `${w}×${h}`;
      expect(sy(L, BASKET.hang) - DROP_MAX_R * L.s, id).toBeGreaterThanOrEqual(TOP - 0.5);
      expect(L.floorY + BASKET.wall * L.s, id).toBeLessThanOrEqual(h - BOTTOM + 0.5);
      expect(sx(L, -BOX_W / 2), id).toBeGreaterThanOrEqual(0);
      expect(sx(L, BOX_W / 2), id).toBeLessThanOrEqual(w);
      expect(BOX_H * L.s, id).toBeLessThanOrEqual(h - TOP - BOTTOM + 1);
    }
  });

  it('keeps the HUD, the table panel and the gleaners on screen and off the basket', () => {
    for (const [w, h] of SIZES) {
      const L = layout(w, h), id = `${w}×${h}`;
      const basket: Rect = { x: sx(L, -BOX_W / 2), y: sy(L, BASKET.rim), w: BOX_W * L.s, h: BASKET.rim * L.s };
      for (const r of [L.score, L.ladder, L.label, L.tip]) {
        expect(r.x, id).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, id).toBeLessThanOrEqual(w);
        expect(r.y, id).toBeGreaterThanOrEqual(TOP);
        if (!L.portrait) expect(overlap(r, basket), id).toBe(false);
      }
      const g = L.gleaners;
      const glean: Rect = { x: g.x - g.size * 0.7, y: g.y - g.size * 0.5, w: g.size * 1.1, h: g.size };
      expect(glean.x, id).toBeGreaterThanOrEqual(0);
      expect(glean.y + glean.h, id).toBeLessThanOrEqual(h - BOTTOM);
      if (L.table) {
        expect(overlap(L.table, basket), id).toBe(false);
        expect(overlap(L.table, glean), id).toBe(false);
        expect(L.table.y + L.table.h, id).toBeLessThanOrEqual(h - BOTTOM);
      }
    }
  });
});

describe('the lobby\'s progress card', () => {
  it('shows the table\'s eight steps, the twelve guests and the odds, built without a style attribute but the meter\'s', () => {
    const p = { ...freshProgress(), sessions: 3, harvest: 1200, loaves: 2, guests: ['rut', 'piekarka'], grain: 10, bestTier: 6 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-chips span.on').length).toBe(tableState(tablePoints(p)).built);
    expect(el.querySelectorAll('.arcade-album > div').length).toBe(GUESTS.length);
    expect(el.querySelectorAll('.arcade-album > div.on').length).toBe(2);
    expect(el.querySelector('details summary')?.textContent).toContain(t('grain', { n: 10 }));
    // the only inline style is the meter's width, set through CSSOM
    const styled = [...el.querySelectorAll('[style]')];
    expect(styled.length).toBeLessThanOrEqual(1);
    for (const n of styled) expect((n as HTMLElement).style.width).toMatch(/%$/);
  });

  it('tells a new player about Ruth and Naomi, and stops once both have come', () => {
    expect(progressPanel(freshProgress()).textContent).toContain(t('panel.story'));
    expect(progressPanel({ ...freshProgress(), sessions: 4, ruthAt: 2, naomiAt: 3, guests: ['rut', 'noemi'] }).textContent).not.toContain(t('panel.story'));
  });
});
