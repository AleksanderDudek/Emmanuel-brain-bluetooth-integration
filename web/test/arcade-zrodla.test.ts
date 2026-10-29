import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { ALBUM, DAILY, DEPTHS, STAGES, TREES, depthOf, oasisRecipe, type Recipe } from '../src/arcade/zrodla/content';
import { CATALOGS, bare, cap, t, unit } from '../src/arcade/zrodla/i18n';
import {
  daysBetween, freshProgress, mergeRoad, nextSkill, pityDue, plantTree, restoreOpen, roadPlace, roadValley, rollCard, treeOfDay, treeStage,
  type ZrodlaProgress,
} from '../src/arcade/zrodla/meta';
import {
  RULES, Run, ZrodlaSim, baseFlow, cOf, flowRate, greenCap, greenRate, planBlocks, uOf, type Block, type SimEvent,
} from '../src/arcade/zrodla/sim';
import {
  BASE, BIT, FIELD, FOUR, LESSON_CURSOR, LESSON_OFF, ROCK, STONE, WELL, Valley, generate, lessonValley, mix, period, quality, rotMask, shapeOf,
  smokeCell, withSkill, type Source,
} from '../src/arcade/zrodla/valley';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-10-25';
const STEP = 1 / 60;
/** The session's tuning as the runner builds it: the kit's defaults, Źródła's entry, and a beginner's bias on top. */
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

/** Every recipe the game can ask for: the road's 39 generated valleys, the daily and the oasis (both kinds). */
const RECIPES: [string, Recipe][] = [
  ...STAGES.flatMap((s, si) => s.recipes.flatMap((r, vi) => (r === 'lesson' ? [] : [[`stage ${si + 1} valley ${vi + 1}`, r] as [string, Recipe]]))),
  ['daily', DAILY], ['oasis', oasisRecipe(0)], ['oasis with a well', oasisRecipe(30)],
];

const count = (v: Valley, k: number) => Array.from(v.kind).filter(x => x === k).length;

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });
/** Focused well above the threshold (a Nurt passes), and resting well below it (a Sela passes). */
const FOCUS = frame({ activity: 8, level: 0.95, focused: true, calm: 0.05 });
const REST = frame({ activity: -4, level: 0.05, calm: 0.95 });
const FOG = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<ZrodlaProgress>; planned?: number; seed?: number; day?: string; daySeed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ZrodlaSim {
  const sim = new ZrodlaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY, daySeed: o.daySeed ?? 4242,
    plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player whose day's valley is done: the session opens on the road. */
const RETURNING: Partial<ZrodlaProgress> = { sessions: 5, lastNewSession: 5, album: [0, 1], dailyDay: DAY, giftDay: DAY, roadIndex: 9 };

/** Run the sim for `sec` at 60 fps; `f` may depend on the play time and the sim. */
function drive(sim: ZrodlaSim, sec: number, f: FocusFrame | ((t: number, s: ZrodlaSim) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

/** Until the block of `kind` (index `atLeast` or later) begins. */
function driveTo(sim: ZrodlaSim, kind: Block['kind'], f: FocusFrame | ((t: number, s: ZrodlaSim) => FocusFrame), clock = { t: 0 }, atLeast = 1): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < 60 * 900 && !(sim.blockIndex >= atLeast && sim.block.kind === kind) && sim.phase === 'play'; i++) out.push(...drive(sim, STEP, f, clock));
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Tap every off stone of the current valley into its solved rotation (through the public input), until it closes. */
function solve(sim: ZrodlaSim): void {
  const v = sim.run.v;
  for (let i = 0; i < v.n && !sim.run.closed; i++) {
    if (!v.turnable(i)) continue;
    const per = period(v.shape[i]!);
    const k = (((v.solved[i] - v.rot[i]) % per) + per) % per;
    for (let j = 0; j < k && !sim.run.closed; j++) sim.tap(i);
  }
}

/** A small valley from a picture: one character per cell. */
function tiny(rows: string[], masks: number[], sources: Source[], fixed: number[] = []): Valley {
  const cols = rows[0].length;
  const kind = rows.join('').split('').map(c => (c === '#' ? ROCK : c === 'F' ? FIELD : c === 'W' ? WELL : STONE));
  const fx = kind.map((_, i) => (fixed.includes(i) ? 1 : 0));
  return new Valley(cols, rows.length, kind, masks, fx, sources);
}

// ── the puzzle ──────────────────────────────────────────────────
describe('ports and shapes', () => {
  it('turns a port mask clockwise N → E → S → W → N', () => {
    expect(rotMask(BIT[0], 1)).toBe(BIT[1]);
    expect(rotMask(BIT[3], 1)).toBe(BIT[0]);
    expect(rotMask(0b0011, 1)).toBe(0b0110);
    expect(rotMask(0b1001, 1)).toBe(0b0011);
    for (let m = 0; m < 16; m++) expect(rotMask(m, 4)).toBe(m);
    for (let m = 0; m < 16; m++) expect(rotMask(rotMask(m, 1), 3)).toBe(m);
  });

  it('knows the shapes and their periods: a straight repeats after two turns, a rosette never changes', () => {
    expect([1, 5, 10, 3, 7, 15].map(shapeOf)).toEqual(['end', 'straight', 'straight', 'bend', 'tee', 'four']);
    expect(rotMask(BASE.straight, 2)).toBe(BASE.straight);
    expect(period('straight')).toBe(2);
    expect(period('four')).toBe(1);
    expect(rotMask(BASE.four, 1)).toBe(BASE.four);
  });
});

describe('the flow search', () => {
  // spring W pours east into (0,0); a straight; a field
  const line = (rot1: number) => {
    const v = tiny(['SSF'], [10, 10, 0], [{ kind: 'spring', cell: 0, side: 3 }], [0]);
    v.rot[1] = rot1;
    v.search(v.flow);
    return v;
  };

  it('follows joined channels from a spring to a field, and counts the steps', () => {
    const v = line(1);
    expect(v.closed).toBe(true);
    expect(Array.from(v.flow.dist.slice(0, 2))).toEqual([0, 1]);
    expect(v.flow.fieldReached[0]).toBe(1);
  });

  it('leaks at a neighbour without a matching port, at the edge and at rock; dry stones do not matter', () => {
    const mis = line(0);   // the straight stands N–S: the mouth's east port finds no partner
    expect(v2(mis)).toEqual({ leaks: 1, reached: 0, closed: false });
    // a mouth that also opens north (off the board) and south into rock
    const edge = tiny(['SF', '#S'], [10 | 4 | 1, 0, 0, 1], [{ kind: 'spring', cell: 0, side: 3 }], [0]);
    expect(v2(edge)).toEqual({ leaks: 2, reached: 1, closed: false });
    // a dry stone that leaks nowhere because no water reaches it: the valley still closes
    const dry = tiny(['SF', 'SS'], [2 | 8, 0, 1 | 2, 8], [{ kind: 'spring', cell: 0, side: 3 }], [0]);
    dry.rot[2] = 1;
    dry.search(dry.flow);
    expect(dry.flow.comp[2]).toBe(-1);
    expect(dry.closed).toBe(true);
  });

  it('lets a field drink from every side, and counts the sources that meet in it', () => {
    // two springs (west and north edges) feed one field from two sides
    const v = tiny(['#S', 'SF'], [0, 1 | 4, 8 | 2, 0], [{ kind: 'spring', cell: 1, side: 0 }, { kind: 'spring', cell: 2, side: 3 }], [1, 2]);
    expect(v.closed).toBe(true);
    expect(v.flow.nComps).toBe(2);
    expect(v.flow.fieldSources[0]).toBe(2);
  });

  it('joins sources whose channels meet into one component, and treats a well as a source inside', () => {
    const v = tiny(['SSS', 'FWF'], [2 | 4, 2 | 8, 8 | 4, 0, 1 | 2 | 8, 0], [{ kind: 'well', cell: 4, side: -1 }], []);
    v.rot.fill(0);
    for (let i = 0; i < v.n; i++) if (v.shape[i]) v.rot[i] = v.solved[i];
    v.search(v.flow);
    expect(v.flow.fieldReached[0] + v.flow.fieldReached[1]).toBe(2);
    expect(v.flow.nComps).toBe(1);
  });

  it('finds the water\'s edge: the stone a leak faces, the closest leak first', () => {
    const v = lessonValley();
    expect(v.edge()).toBe(5);
    v.turn(5);
    expect(v.edge()).toBe(10);   // (2,2) leaks south into a pre-set stone: the leaking stone itself
  });
});

function v2(v: Valley) { return { leaks: v.flow.leaks, reached: v.flow.reachedFields, closed: v.closed }; }

describe('the lesson valley', () => {
  it('is the map as drawn: rock on the top row, two springs, three fields, three stones off', () => {
    const v = lessonValley();
    expect([v.cols, v.rows]).toEqual([4, 4]);
    expect([0, 1, 2].map(i => v.kind[i])).toEqual([ROCK, ROCK, ROCK]);
    expect(v.fields).toEqual([7, 15, 12]);
    expect(v.sources.map(s => [s.cell, s.side])).toEqual([[3, 0], [8, 3]]);
    const turnable = Array.from({ length: 16 }, (_, i) => i).filter(i => v.turnable(i));
    expect(turnable).toEqual([...LESSON_OFF]);
    expect(turnable.every(i => v.off(i))).toBe(true);
    expect(v.closed).toBe(false);
  });

  it('reaches fields 1 and 3 at once, spills where (1,0) faces (1,1), and closes with one tap on each off stone in any order', () => {
    for (const order of [[5, 10, 13], [13, 10, 5], [10, 5, 13], [10, 13, 5], [5, 13, 10], [13, 5, 10]]) {
      const v = lessonValley();
      expect(Array.from(v.flow.fieldReached)).toEqual([1, 0, 1]);
      expect(v.flow.leaks).toBe(1);
      expect(v.edge()).toBe(LESSON_CURSOR);
      order.forEach((i, k) => {
        expect(v.closed).toBe(false);
        v.turn(i);
        if (k === order.length - 1) expect(v.closed).toBe(true);
      });
    }
  });

  it('keeps every fixed stone where it lies', () => {
    const v = lessonValley();
    for (let i = 0; i < 16; i++) if (!(LESSON_OFF as readonly number[]).includes(i)) expect(v.turn(i)).toBe(false);
  });

  it('has water in fields 1 and 3 within a second with no input, the hint on (1,1) and the cursor there', () => {
    const sim = makeSim({ planned: 40 });
    expect(sim.run.kind).toBe('lesson');
    expect(sim.cursor).toBe(LESSON_CURSOR);
    expect(sim.hint).toBe(LESSON_CURSOR);
    expect(sim.lesson).toBe('tap');
    drive(sim, 1, frame());
    expect(sim.run.jars[0]).toBeGreaterThan(0);
    expect(sim.run.jars[2]).toBeGreaterThan(0);
    expect(sim.run.jars[1]).toBe(0);
  });

  it('speaks its three lines: tap, then where the grooves meet, then the water running by itself for 4 s', () => {
    const sim = makeSim({ planned: 40 });
    sim.tap(5);
    expect(sim.lesson).toBe('join');
    expect(sim.hint).toBe(10);
    sim.tap(10);
    sim.tap(13);
    expect(sim.run.closed).toBe(true);
    expect(sim.lesson).toBe('pour');
    drive(sim, 4.1, frame());
    expect(sim.lesson).toBe(null);
  });
});

describe('the generator', () => {
  it('is deterministic for a recipe and a seed, different for another seed', () => {
    const a = generate(DAILY, 1234), b = generate(DAILY, 1234), c = generate(DAILY, 4321);
    expect(Array.from(a.kind)).toEqual(Array.from(b.kind));
    expect(Array.from(a.rot)).toEqual(Array.from(b.rot));
    expect(Array.from(a.kind).join() + Array.from(a.rot).join()).not.toBe(Array.from(c.kind).join() + Array.from(c.rot).join());
  });

  it.each(RECIPES)('builds valid valleys for %s over 30 seeds', (_, r) => {
    for (let s = 0; s < 30; s++) {
      const v = generate(r, mix(7, s, 0x5eed));
      expect([v.cols, v.rows], `seed ${s}`).toEqual([r.cols, r.rows]);
      expect(v.fields.length).toBe(r.fields);
      expect(v.sources.filter(x => x.kind === 'spring').length).toBe(r.springs);
      expect(v.sources.filter(x => x.kind === 'well').length).toBe(r.wells);
      expect(count(v, ROCK)).toBe(r.rocks);
      expect(count(v, FOUR)).toBeLessThanOrEqual(r.fourMax);
      expect(v.closed).toBe(false);
      for (const src of v.sources) {
        if (src.kind !== 'spring') continue;
        expect(v.fixed[src.cell]).toBe(1);   // the mouth stones are pre-set, open toward their spring
        expect(v.ports(src.cell) & BIT[src.side]).toBeTruthy();
      }
      const { turnable, off } = v.counts();
      expect(off).toBeGreaterThanOrEqual(Math.ceil(turnable * 0.6));
      expect(v.turnable(smokeCell(v.cols, v.rows))).toBe(true);
      for (let i = 0; i < v.n; i++) if (v.turnable(i)) v.rot[i] = v.solved[i];
      v.search(v.flow);
      expect(v.closed, `seed ${s}`).toBe(true);
      if (r.meeting && r.springs + r.wells >= 2) expect(Math.max(...Array.from(v.flow.fieldSources)), `meeting, seed ${s}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the quality bands of the stages in range (logged for tuning)', () => {
    const rows: string[] = [];
    STAGES.forEach((stage, si) => {
      const q = { off: 0, turns: 0, tees: 0, fours: 0, longest: 0, forced: 0, turnable: 0, n: 0 };
      stage.recipes.forEach(r => {
        if (r === 'lesson') return;
        for (let s = 0; s < 10; s++) {
          const m = quality(generate(r, mix(si, s, 0x5eed)));
          q.off += m.off; q.turns += m.turns; q.tees += m.tees; q.fours += m.fours; q.longest += m.longest; q.forced += m.forced; q.turnable += m.turnable; q.n++;
        }
      });
      const avg = (k: keyof typeof q) => q[k] / q.n;
      rows.push(`stage ${si + 1}: turnable ${avg('turnable').toFixed(1)} off ${avg('off').toFixed(1)} turns ${avg('turns').toFixed(1)} longest ${avg('longest').toFixed(1)} forced ${avg('forced').toFixed(1)}`);
      expect(avg('off')).toBeGreaterThan(5);
      expect(avg('longest')).toBeGreaterThan(4);
      if (si >= 2) expect(avg('fours')).toBeGreaterThan(0.3);
    });
    expect(rows).toHaveLength(5);
  });

  it('moves a recipe by the skill offset', () => {
    const r = STAGES[0].recipes[1] as Recipe;
    expect(withSkill(r, 0)).toBe(r);
    const up = withSkill(r, 1);
    expect([up.cols, up.rows, up.preset]).toEqual([5, 4, r.preset - 1]);
    expect(up.tee).toBeCloseTo(r.tee + 0.1, 9);
    const up2 = withSkill(r, 2);
    expect([up2.fields, up2.fourMax]).toEqual([r.fields + 1, r.fourMax + 1]);
    expect(withSkill(STAGES[1].recipes[1] as Recipe, -1)).toMatchObject({ cols: 5, rows: 4, preset: 4 });
    expect(withSkill(r, -1)).toMatchObject({ cols: 4, rows: 4 });
    expect(withSkill(STAGES[4].recipes[0] as Recipe, 1)).toMatchObject({ cols: 6, rows: 5 });
    for (const k of [-1, 1, 2]) for (let s = 0; s < 10; s++) expect(generate(withSkill(STAGES[2].recipes[4] as Recipe, k), s).closed).toBe(false);
  });

  it('steps the skill offset: under 8 s up, past a Nurt plus 8 s down, within −1..+2', () => {
    expect(nextSkill(0, 7, 24)).toBe(1);
    expect(nextSkill(2, 5, 24)).toBe(2);
    expect(nextSkill(0, 20, 24)).toBe(0);
    expect(nextSkill(0, 33, 24)).toBe(-1);
    expect(nextSkill(-1, 40, 24)).toBe(-1);
  });

  it('keeps wells inside and turning, rosettes, fields and rock fixed', () => {
    const v = generate(STAGES[3].recipes[3] as Recipe, 99);
    expect(v.sources.every(s => s.kind === 'well')).toBe(true);
    for (let i = 0; i < v.n; i++) {
      if (v.kind[i] === WELL) expect(v.sourceAt[i]).toBeGreaterThanOrEqual(0);
      if (v.kind[i] === FOUR || v.kind[i] === FIELD || v.kind[i] === ROCK) expect(v.turnable(i)).toBe(false);
    }
    expect(count(v, STONE)).toBeGreaterThan(5);
  });
});

// ── the water and the band ──────────────────────────────────────
describe('where the water goes', () => {
  it('splits a component\'s water over its full outlets, ×1.5 where two sources meet, ×1.2 once closed', () => {
    const v = lessonValley();
    const r = new Run('lesson', 0, 0, 0, v);
    r.wet.fill(1);
    r.shares();
    expect(r.share[0]).toBeCloseTo(1, 9);        // spring A: all into field 1
    expect(r.share[2]).toBeCloseTo(0.5, 9);      // spring B: half into field 3, half spilling at (1,0)
    expect(r.leakShare[4 * 4 + 1]).toBeCloseTo(0.5, 9);
    v.turn(5);
    v.turn(10);
    v.turn(13);
    r.closed = true;
    r.shares();
    // B now feeds fields 3 and 2 through the closed channels: half each, ×1.2
    expect(r.share[1]).toBeCloseTo(0.5 * 1.2, 9);
    expect(r.share[2]).toBeCloseTo(0.5 * 1.2, 9);
    expect(r.share[0]).toBeCloseTo(1.2, 9);
    const m = tiny(['#S', 'SF'], [0, 1 | 4, 8 | 2, 0], [{ kind: 'spring', cell: 1, side: 0 }, { kind: 'spring', cell: 2, side: 3 }], [1, 2]);
    const rm = new Run('road', 1, 0, 0, m);
    rm.wet.fill(1);
    rm.shares();
    expect(rm.share[0]).toBeCloseTo(2 * 1.5, 9);   // two sources, each all into the field, ×1.5
  });

  it('counts spills a quarter, sets depths at 3, 8, 15 and 25 jars and floors the score', () => {
    expect(DEPTHS).toEqual([3, 8, 15, 25]);
    expect([0, 2.9, 3, 7.99, 8, 15, 24.9, 25, 40].map(depthOf)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
    const sim = makeSim({ planned: 40 });
    drive(sim, 5, frame({ level: 0.3 }));
    const fields = sim.run.jars.reduce((s, j) => s + j, 0), spilt = sim.run.spilt.reduce((s, j) => s + j, 0);
    expect(sim.jars).toBeCloseTo(fields + spilt * 0.25, 6);
    expect(sim.score).toBe(Math.floor(sim.jars));
    expect(sim.result().score).toBe(sim.score);
  });

  it('runs the front at 2.5 cells/s: a field drinks only once its inlet stone is full; cut channels drain at 5 cells/s', () => {
    const sim = makeSim({ planned: 40 });
    drive(sim, 0.38, frame());
    expect(sim.run.wet[3]).toBeCloseTo(0.38 * 2.5, 1);
    expect(sim.run.jars[0]).toBe(0);
    drive(sim, 0.1, frame());
    expect(sim.run.jars[0]).toBeGreaterThan(0);
    expect(sim.run.wet[4]).toBeLessThan(0.3);     // (1,0) waits for (2,0) to fill
    drive(sim, 0.5, frame());
    expect(sim.run.wet[4]).toBeCloseTo(1, 6);
    // join (1,1), let it fill, then cut it off again: it drains
    sim.tap(5);
    drive(sim, 1, frame());
    expect(sim.run.wet[5]).toBeCloseTo(1, 6);
    sim.tap(5);
    drive(sim, 0.1, frame());
    expect(sim.run.wet[5]).toBeCloseTo(0.5, 1);
  });
});

describe('the band: how much water runs', () => {
  it('pours F = (F0 + 0.75·u)·(1 + min(h, 20)/50), F0 = 0.25 + 0.05 per curb stone up to 6', () => {
    expect(flowRate(0.25, 0, 0)).toBeCloseTo(0.25, 9);
    expect(flowRate(0.25, 1, 0)).toBeCloseTo(1, 9);
    expect(flowRate(0.25, 1, 10)).toBeCloseTo(1.2, 9);
    expect(flowRate(0.55, 1, 40)).toBeCloseTo(1.3 * 1.4, 9);
    expect(baseFlow(3)).toBeCloseTo(0.4, 9);
    expect(baseFlow(9)).toBeCloseTo(0.55, 9);
    expect(uOf(0.35)).toBe(0);
    expect(uOf(0.6)).toBeCloseTo(0.5, 9);
    expect(uOf(0.95)).toBe(1);
    expect(cOf(0.55)).toBeCloseTo(0.5, 9);
    expect(greenRate(1)).toBeCloseTo(0.15, 9);
    expect(greenRate(0.4)).toBeCloseTo(0.078, 9);
  });

  it('pours 0.6 jars/s per source in the warm-up whatever the frame, steady in the pad', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.block.kind).toBe('warmup');
    drive(sim, 3, FOCUS);
    expect(sim.F).toBeCloseTo(0.6, 9);
    drive(sim, 3, REST);
    expect(sim.F).toBeCloseTo(0.6, 9);
    expect(sim.padLevel(FOCUS)).toBe(0.5);
  });

  it('smooths the level again: τ 3 s on Mendi, 1.5 s on HALO', () => {
    const mendi = makeSim({ planned: 40 }), halo = makeSim({ planned: 40, eeg: true });
    drive(mendi, 3, frame({ level: 1 }));
    drive(halo, 3, frame({ level: 1 }));
    expect(mendi.L).toBeCloseTo(1 - 0.7 * Math.exp(-1), 2);
    expect(halo.L).toBeCloseTo(1 - 0.7 * Math.exp(-2), 2);
  });

  it('shows the gauge φ = (F − F0) / 1.05 and the steady steps at 6, 12 and 18 s of hold', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const evs = drive(sim, 20, (t: number) => frame({ level: 1, focused: true, hold: t, activity: 8 }));
    expect(sim.phi).toBeCloseTo(Math.min(1, (sim.F - sim.F0) / 1.05), 9);
    expect(ofType(evs, 'steady').map(e => e.step)).toEqual([1, 2, 3]);
    expect(sim.F).toBeGreaterThan(1.2);
  });

  it('counts the steady stretch within the Nurt only, and carries it over a dropout', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    drive(sim, 8, (t: number) => frame({ level: 0.9, focused: true, hold: t }), clock);
    expect(sim.hold).toBeCloseTo(8, 1);
    drive(sim, 3, FOG, clock);
    expect(sim.hold).toBeCloseTo(8, 1);           // frozen while the signal is out
    drive(sim, 2, (t: number) => frame({ level: 0.9, focused: true, hold: t - 11 }), clock);
    expect(sim.hold).toBeCloseTo(10, 0);         // the kit restarted its hold: the stretch carries on
    driveTo(sim, 'sela', frame({ level: 0.9, focused: true, hold: 30 }), clock);
    expect(sim.hold).toBe(0);
    expect(sim.F).toBe(0);                        // a Sela: no flow, whatever the focus
  });
});

describe('an unreliable signal: neutral, never a loss', () => {
  it('holds u and c′ for 2 s, then eases them to 0.4; L and C stay still meanwhile', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    drive(sim, 6, frame({ level: 1 }), clock);
    const L = sim.L, u = sim.uEff;
    drive(sim, 1.5, FOG, clock);
    expect(sim.uEff).toBeCloseTo(u, 6);
    expect(sim.L).toBe(L);
    drive(sim, 8, FOG, clock);
    expect(sim.uEff).toBeCloseTo(0.4, 2);
    expect(sim.cEff).toBeCloseTo(0.4, 2);
    expect(sim.holdMul).toBeCloseTo(1, 2);
    expect(sim.F).toBeCloseTo(sim.F0 + 0.3, 2);
    expect(sim.L).toBe(L);
  });

  it('lets L and C only rise for 6 s after a long dropout, then follow again', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    drive(sim, 6, frame({ level: 0.8, calm: 0.7 }), clock);
    const L = sim.L, C = sim.C;
    drive(sim, 3, FOG, clock);
    drive(sim, 5, frame({ level: 0.1, calm: 0.1 }), clock);
    expect(sim.L).toBe(L);
    expect(sim.C).toBe(C);
    drive(sim, 3, frame({ level: 0.1, calm: 0.1 }), clock);
    expect(sim.L).toBeLessThan(L);
  });

  it('keeps the block clock running and keeps every jar delivered', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    drive(sim, 5, frame({ level: 0.9 }), clock);
    const jars = sim.jars, t0 = sim.blockT;
    drive(sim, 4, FOG, clock);
    expect(sim.blockT).toBeCloseTo(t0 + 4, 6);
    expect(sim.jars).toBeGreaterThanOrEqual(jars);
  });

  it('gives no verdict to a block with fewer than 8 reliable seconds, and tops its fields up to the neutral strength', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 0 } });
    // the lesson valley, closed at once, so all water goes to fields
    solve(sim);
    const clock = { t: 0 };
    const evs = driveTo(sim, 'sela', (t: number) => (t < 5 ? frame({ level: 0.05 }) : FOG), clock);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBe(null);
    // the counterfactual: u = 0.4 and ×1 for the whole Nurt, so the fields hold at least that
    const dur = sim.plan[0].dur;
    const neutral = 0.25 + 0.3;
    const total = sim.run.jars.reduce((s, j) => s + j, 0);
    expect(total).toBeGreaterThanOrEqual(neutral * 2 * 1.2 * (dur - 1));
    expect(ofType(evs, 'curb')).toHaveLength(0);
  });

  it('never pays more for a dropout than u = 0.4 would', () => {
    const run = (fog: boolean) => {
      const sim = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 0 } });
      solve(sim);
      drive(sim, 20, (t: number) => (fog && t > 2 ? FOG : frame({ level: 0.6 })));
      return sim.jars;
    };
    const neutral = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 0 } });
    solve(neutral);
    drive(neutral, 20, frame({ level: 0.35 + 0.4 * 0.5 }));
    expect(run(true)).toBeLessThanOrEqual(neutral.jars * 1.02);
    expect(run(false)).toBeGreaterThan(0);
  });

  it('grows the green at the neutral 0.078 cells/s through a dropout in a Sela, and tops it up when the Sela had too little', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 0 } });
    solve(sim);
    const clock = { t: 0 };
    driveTo(sim, 'sela', frame({ level: 0.5 }), clock);
    const g0 = sim.run.green[0];
    drive(sim, 12, FOG, clock);
    expect(sim.cEff).toBeCloseTo(0.4, 1);
    expect(sim.run.green[0]).toBeGreaterThan(g0 + 0.5);
    const evs = driveTo(sim, 'nurt', FOG, clock, 2);
    expect(ofType(evs, 'blockEnd')[0].verdict).toBe(null);
  });
});

describe('the session plan', () => {
  it('plays 22 + 12 s and the finale in a 40 s session', () => {
    expect(planBlocks(40, true, mulberry32(1))).toEqual([{ kind: 'nurt', dur: 22, blind: false }, { kind: 'sela', dur: 12, blind: false }]);
  });

  it.each([[180, 4], [300, 7], [600, 14]])('fills %i s with %i pairs, no block under 12 s, ending with a Sela 6 s before the end', (sec, pairs) => {
    for (const first of [true, false]) {
      const plan = planBlocks(sec, first, mulberry32(sec));
      expect(plan).toHaveLength(pairs * 2);
      expect(plan.every(b => b.dur >= 12 - 1e-9)).toBe(true);
      expect(plan.at(-1)!.kind).toBe('sela');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec - 6, 6);
      expect(plan[0].kind).toBe(first ? 'warmup' : 'nurt');
      expect(plan.filter(b => b.kind === 'oaza')).toHaveLength(1);
      expect(plan.at(-2)!.kind).toBe('oaza');
    }
  });

  it('opens with the warm-up only in a first-ever session of 2 min or more, and plays the Oaza only with 3 pairs or more', () => {
    expect(planBlocks(90, true, mulberry32(1)).map(b => b.kind)).toEqual(['nurt', 'sela', 'nurt', 'sela']);
    expect(planBlocks(120, true, mulberry32(1))[0].kind).toBe('warmup');
    expect(planBlocks(40, true, mulberry32(1)).some(b => b.kind === 'oaza')).toBe(false);
  });

  it('rains in Selas 3, 6, 9 and 12 only, for their first 5 s, 2 jars into every field, the dry ones too', () => {
    const sim = makeSim({ planned: 600, progress: RETURNING });
    const rainAt: number[] = [];
    const before: number[][] = [];
    let jarsAtStart: number[] = [];
    drive(sim, 600, frame(), { t: 0 }, () => {
      for (const e of sim.take()) {
        if (e.type === 'rain') {
          rainAt.push(sim.selahNo);
          jarsAtStart = Array.from(sim.run.jars);
        }
      }
      if (sim.block?.kind === 'sela' && rainAt.at(-1) === sim.selahNo && Math.abs(sim.blockT - 6) < STEP / 2) {
        before.push(Array.from(sim.run.jars).map((j, i) => j - jarsAtStart[i]));
      }
    });
    expect(rainAt).toEqual([3, 6, 9, 12]);
    for (const d of before) for (const x of d) expect(x).toBeCloseTo(2, 6);
  });
});

describe('verdicts and payouts', () => {
  it('lays a curb stone for a Nurt passed, at the Sela\'s start, and F0 grows from the next Nurt', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    const evs = driveTo(sim, 'sela', FOCUS, clock);
    const end = ofType(evs, 'blockEnd')[0], curb = evs.findIndex(e => e.type === 'curb');
    expect(end.verdict).toBe(true);
    expect(curb).toBeGreaterThan(evs.indexOf(end));
    expect(sim.curbStones).toBe(1);
    expect(sim.F0).toBeCloseTo(0.3, 9);
  });

  it('judges with the session\'s tuning: a Nurt without focus fails, a calm Sela passes and nests at the next Nurt\'s start', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    const e1 = driveTo(sim, 'sela', REST, clock);
    expect(ofType(e1, 'blockEnd')[0].verdict).toBe(false);
    expect(ofType(e1, 'curb')).toHaveLength(0);
    const e2 = driveTo(sim, 'nurt', REST, clock, 2);
    expect(ofType(e2, 'blockEnd')[0].verdict).toBe(true);
    const nest = ofType(e2, 'nest');
    expect(nest).toHaveLength(1);
    expect(e2.indexOf(nest[0])).toBeGreaterThan(e2.indexOf(ofType(e2, 'blockStart').at(-1)!));
  });

  it('brings the sparrows after the first-ever Sela whatever its verdict', () => {
    const sim = makeSim({ planned: 40 });
    const evs = drive(sim, 40, FOCUS);
    const nest = ofType(evs, 'nest');
    expect(nest).toHaveLength(1);
    expect(nest[0].nest.bird).toBe('sparrow');
    expect(sim.nestsBuilt).toBe(1);
  });

  it('raises young after a deep calm (12 s of calm ≥ 0.6), and the session\'s card comes in morning light', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, album: [] } });
    const clock = { t: 0 };
    driveTo(sim, 'sela', REST, clock);
    const evs = driveTo(sim, 'nurt', REST, clock, 2);
    expect(ofType(evs, 'nest')[0].nest.young).toBe(true);
    const rest = drive(sim, 400, REST, clock);
    const card = ofType(rest, 'card')[0];
    expect(card.roll.kind).toBe('dawn');
    expect(sim.p.dawn).toContain(card.roll.id);
  });

  it('feeds the session contrast from the Nurts and the Selas, not from the warm-up', () => {
    const sim = makeSim({ planned: 300 });
    drive(sim, 20, frame({ activity: 30 }));
    expect(sim.contrast.mean('focus')).toBe(null);
    driveTo(sim, 'nurt', frame({ activity: -2 }), { t: 20 }, 2);
    expect(sim.contrast.mean('rest')).toBeCloseTo(-2, 6);
  });
});

describe('the veil and the locked stones', () => {
  it('locks the stones in a Sela (a tap only shimmers) and veils them over 1.2 s', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    driveTo(sim, 'sela', frame(), clock);
    const v = sim.run.v, i = Array.from({ length: v.n }, (_, k) => k).find(k => v.turnable(k))!;
    const rot = v.rot[i];
    sim.tap(i);
    expect(v.rot[i]).toBe(rot);
    expect(ofType(sim.take(), 'knock')[0].selah).toBe(true);
    drive(sim, 0.6, frame(), clock);
    expect(sim.veil).toBeCloseTo(0.5, 1);
    drive(sim, 1, frame(), clock);
    expect(sim.veil).toBe(1);
  });

  it('lifts the veil over an open valley across the telegraph (still unreadable 2.5 s before its end), unlocking at the Nurt\'s start', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    driveTo(sim, 'sela', frame(), clock);
    expect(sim.run.closed).toBe(false);
    const dur = sim.block.dur;
    drive(sim, dur - 4 - 0.05, frame(), clock);
    expect(sim.veil).toBe(1);
    drive(sim, 2.5, frame(), clock);
    expect(sim.veil).toBeGreaterThan(0.7);
    driveTo(sim, 'nurt', frame(), clock, 2);
    expect(sim.veil).toBe(0);
    expect(sim.flowing).toBe(true);
  });

  it('keeps a closed valley veiled until it slides away', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    solve(sim);
    expect(sim.run.closed).toBe(true);
    const clock = { t: 0 };
    driveTo(sim, 'sela', frame(), clock);
    drive(sim, 10, frame(), clock);
    expect(sim.veil).toBe(1);
    driveTo(sim, 'nurt', REST, clock, 2);
    // a calm Sela's pair lands on the old valley first, still veiled; then the slide brings the next one
    expect(sim.beat?.kind).toBe('nest');
    expect(sim.veil).toBe(1);
    drive(sim, 1.55, REST, clock);
    expect(sim.beat?.kind).toBe('slide');
    expect(sim.prev?.closed).toBe(true);
    expect(sim.run.closed).toBe(false);
  });
});

describe('Pod ziemią: the blind Nurt', () => {
  it('runs every 4th eligible Nurt underground from the 4th session: never the first, the warm-up or the Oaza', () => {
    const blindAt = (sessions: number, pushes: number) => {
      const sim = makeSim({ planned: 600, progress: { ...RETURNING, sessions, pushes } });
      const evs = drive(sim, 600, frame());
      return ofType(evs, 'blockStart').concat([{ type: 'blockStart', block: sim.plan[0], index: 0 }])
        .filter(e => e.block.blind).map(e => e.index).sort((a, b) => a - b);
    };
    expect(blindAt(2, 0)).toEqual([]);
    const plan = makeSim({ planned: 600, progress: { ...RETURNING, sessions: 3 } }).plan;
    const eligible = plan.map((b, i) => (b.kind === 'nurt' && i > 0 ? i : -1)).filter(i => i >= 0);
    // pushes 2 before: the 2nd, 6th, 10th … eligible Nurt of this session make it 4, 8, 12 …
    expect(blindAt(3, 2)).toEqual(eligible.filter((_, k) => (2 + k + 1) % 4 === 0));
    expect(blindAt(3, 2).every(i => plan[i].kind === 'nurt' && i > 0)).toBe(true);
  });

  it('hides the water: the count holds, the pad holds, no depth is announced; the Sela reveals where it went', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, sessions: 3, pushes: 2, roadIndex: 0 } });
    solve(sim);
    const clock = { t: 0 };
    driveTo(sim, 'nurt', frame({ level: 0.9 }), clock, 2);
    driveTo(sim, 'nurt', frame({ level: 0.9 }), clock, 4);
    expect(sim.block.blind).toBe(true);
    const shown = sim.shownJars;
    let evs = drive(sim, 2, frame({ level: 0.9 }), clock);
    solve(sim);   // a valley closed by touch in a blind Nurt still rings, its bonus hidden
    expect(ofType(sim.take(), 'closed')[0]?.hidden).toBe(true);
    evs = evs.concat(drive(sim, sim.block.dur - 4, frame({ level: 0.9 }), clock));
    expect(sim.shownJars).toBe(shown);
    expect(sim.score).toBeGreaterThan(shown);
    expect(sim.padLevel(frame())).toBe(null);
    expect(ofType(evs, 'depth')).toHaveLength(0);
    expect(ofType(evs, 'drip')).toHaveLength(0);
    const at = driveTo(sim, 'sela', frame({ level: 0.9 }), clock, 5);
    const rev = ofType(at, 'reveal');
    expect(rev).toHaveLength(1);
    expect(rev[0].fields).toBeGreaterThan(0);
    expect(sim.shownJars).toBe(sim.score);
  });
});

describe('padLevel', () => {
  it('follows the water in a sighted Nurt, holds in a Sela, a blind Nurt, the finale and while the signal is out', () => {
    const fresh = new ZrodlaSim({ progress: freshProgress(), rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: TUNING });
    expect(fresh.padLevel(frame())).toBe(null);
    const sim = makeSim({ planned: 40, progress: RETURNING });
    drive(sim, 5, FOCUS);
    expect(sim.padLevel(FOCUS)).toBeCloseTo(sim.phi, 9);
    expect(sim.padLevel(FOG)).toBe(null);
    driveTo(sim, 'sela', FOCUS);
    expect(sim.padLevel(FOCUS)).toBe(null);
    drive(sim, 13, FOCUS);
    expect(sim.phase).toBe('finale');
    expect(sim.padLevel(FOCUS)).toBe(null);
  });
});

describe('the valleys of a session', () => {
  it('keeps an open valley through the next pair with its stones, water and green', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    const first = sim.run;
    driveTo(sim, 'sela', frame(), clock);
    const jars = Array.from(first.jars), rot = Array.from(first.v.rot);
    driveTo(sim, 'nurt', frame(), clock, 2);
    expect(sim.run).toBe(first);
    expect(Array.from(first.v.rot)).toEqual(rot);
    expect(first.jars[0]).toBeGreaterThanOrEqual(jars[0]);
  });

  it('sets a closed valley\'s stones (taps knock), advances the road and brings the next valley at the next Nurt', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 3 } });
    solve(sim);
    expect(sim.run.closed).toBe(true);
    expect(sim.roadIndex).toBe(4);
    const v = sim.run.v, i = Array.from({ length: v.n }, (_, k) => k).find(k => v.turnable(k))!;
    sim.take();
    sim.tap(i);
    expect(ofType(sim.take(), 'knock')).toHaveLength(1);
    const clock = { t: 0 };
    driveTo(sim, 'nurt', frame(), clock, 2);
    drive(sim, 1.6, frame(), clock);
    expect(sim.run.idx).toBe(4);
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.p.road.map(r => r.i)).toEqual([3]);
  });

  it('completes a stage with its 8th valley and walks on to the valleys by the road after the 40th', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 7 } });
    sim.take();
    solve(sim);
    expect(ofType(sim.take(), 'stage')).toEqual([{ type: 'stage', stage: 0 }]);
    expect(roadPlace(40)).toMatchObject({ free: true, stage: 4, index: 0 });
    expect(roadPlace(41).seed).not.toBe(roadPlace(33).seed);
    const free = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 41 } });
    expect(free.run.kind).toBe('free');
  });

  it('saves an open road valley in result() and resumes it in the next session; a mismatch generates it fresh', () => {
    const sim = makeSim({ planned: 300, progress: { ...RETURNING, roadIndex: 5 } });
    const v = sim.run.v, i = Array.from({ length: v.n }, (_, k) => k).find(k => v.turnable(k))!;
    sim.tap(i);
    drive(sim, 10, frame());
    sim.finish();
    sim.result();
    const open = sim.p.open!;
    expect(open.idx).toBe(5);
    expect(open.rot).toEqual(Array.from(v.rot));
    const next = makeSim({ planned: 300, progress: { ...sim.p, dailyDay: DAY } });
    expect(Array.from(next.run.v.rot)).toEqual(open.rot);
    expect(Array.from(next.run.jars)).toEqual(open.jars);
    const broken = makeSim({ planned: 300, progress: { ...sim.p, dailyDay: DAY, open: { ...open, rot: open.rot.slice(1) } } });
    expect(Array.from(broken.run.v.rot)).toEqual(Array.from(roadValley(5, open.skill).rot));
    expect(restoreOpen({ ...open, jars: [1] })).toBe(null);
  });

  it('sets the open road valley aside for the Oaza and keeps it for the next session', () => {
    const sim = makeSim({ planned: 180, progress: RETURNING });
    const road = sim.run;
    const clock = { t: 0 };
    driveTo(sim, 'oaza', frame(), clock);
    drive(sim, 1.2, frame(), clock);
    expect(sim.run.kind).toBe('oasis');
    drive(sim, 200, frame(), clock);
    sim.result();
    expect(sim.p.open?.idx).toBe(road.idx);
  });

  it('merges the road\'s closed valleys one per index, the newer winning', () => {
    const a = { i: 1, d: 1, g: 10, n: 0 as const, y: 0 as const };
    expect(mergeRoad([a, { ...a, i: 2 }], [{ ...a, d: 3 }])).toEqual([{ ...a, d: 3 }, { ...a, i: 2 }]);
  });
});

describe('Dolina dnia', () => {
  it('gives everyone the same board for the same day, another for another day', () => {
    const a = makeSim({ progress: { sessions: 1 }, daySeed: 77 }), b = makeSim({ progress: { sessions: 3, roadIndex: 12 }, daySeed: 77 });
    const c = makeSim({ progress: { sessions: 1 }, daySeed: 78 });
    expect(a.run.kind).toBe('daily');
    expect(Array.from(a.run.v.rot)).toEqual(Array.from(b.run.v.rot));
    expect(Array.from(a.run.v.kind)).toEqual(Array.from(generate(DAILY, 77).kind));
    expect(Array.from(a.run.v.rot).join() + Array.from(a.run.v.kind).join()).not.toBe(Array.from(c.run.v.rot).join() + Array.from(c.run.v.kind).join());
  });

  it('comes only from the second session, once a day, and records its closing time in result()', () => {
    expect(makeSim().run.kind).toBe('lesson');
    expect(makeSim({ progress: { sessions: 1, dailyDay: DAY } }).run.kind).not.toBe('daily');
    const sim = makeSim({ progress: { sessions: 2, dailyBest: 30 }, planned: 300 });
    drive(sim, 9, frame());
    solve(sim);
    sim.result();
    expect(sim.p.dailyDay).toBe(DAY);
    expect(sim.p.dailySec).toBe(9);
    expect(sim.p.dailyBest).toBe(9);
  });
});

describe('the day\'s tree and the album', () => {
  it('plants the same tree for everyone on a day, once, growing over three days', () => {
    expect(treeOfDay(12)).toBe(0);
    expect(treeOfDay(17)).toBe(5);
    const p = freshProgress();
    expect(plantTree(p, DAY, 13)).toBe(1);
    expect(plantTree(p, DAY, 13)).toBe(null);
    expect(p.trees).toEqual([{ k: 1, d: DAY }]);
    expect([treeStage(DAY, DAY), treeStage(DAY, '2026-10-26'), treeStage(DAY, '2026-10-27'), treeStage(DAY, '2026-10-28')]).toEqual([0, 1, 1, 2]);
    expect(daysBetween('2026-10-01', '2026-10-25')).toBe(24);
  });

  it('plants it at the finale, or when the session ends early', () => {
    const sim = makeSim({ planned: 40, daySeed: 4 });
    const evs = drive(sim, 41, frame());
    expect(ofType(evs, 'tree')).toEqual([{ type: 'tree', kind: 4 }]);
    const early = makeSim({ planned: 300, daySeed: 4 });
    drive(early, 30, frame());
    early.finish();
    expect(early.p.giftDay).toBe(DAY);
    expect(ofType(early.take(), 'tree')).toHaveLength(1);
  });

  it('rolls one card per session with a closed valley or when pity is due: uniform, pity every 3 sessions, the first one new', () => {
    const p = freshProgress();
    expect(pityDue(p, 1)).toBe(true);
    const counts = new Array(6).fill(0);
    const rnd = mulberry32(9);
    for (let i = 0; i < 6000; i++) {
      const q = { ...freshProgress(), album: [0, 1, 2, 3, 4, 5], lastNewSession: 10 };
      counts[rollCard(q, rnd, 11, false).id]++;
    }
    for (const c of counts) expect(c / 6000).toBeCloseTo(1 / 6, 1);
    const q = { ...freshProgress(), album: [0], lastNewSession: 2 };
    expect(pityDue(q, 4)).toBe(false);
    expect(pityDue(q, 5)).toBe(true);
    const r = rollCard(q, mulberry32(1), 5, false);
    expect(r.kind).toBe('new');
    expect(q.album).toHaveLength(2);
    // a session without a closed valley and without pity rolls nothing
    const sim = makeSim({ planned: 40, progress: { ...RETURNING, album: [0, 1], lastNewSession: 5 } });
    const evs = drive(sim, 41, REST);
    expect(ofType(evs, 'card')).toHaveLength(0);
  });

  it('turns duplicates into drops and three drops into the next missing card; morning light upgrades a plain duplicate', () => {
    const q = { ...freshProgress(), album: [0, 1, 2, 3, 4], lastNewSession: 9, drops: 2 };
    const all = () => 0.5 / 6;   // always card 0, owned
    const r = rollCard(q, all, 10, false);
    expect(r).toEqual({ id: 0, kind: 'dup', crafted: 5 });
    expect(q.drops).toBe(0);
    expect(q.album).toContain(5);
    const d = { ...freshProgress(), album: [0], lastNewSession: 9 };
    expect(rollCard(d, all, 10, true).kind).toBe('upgrade');
    expect(d.dawn).toEqual([0]);
    expect(rollCard(d, all, 10, true).kind).toBe('dup');
    const n = { ...freshProgress() };
    expect(rollCard(n, all, 1, true)).toMatchObject({ kind: 'dawn' });
    expect(n.dawn).toEqual(n.album);
  });

  it('rolls once per session, at the finale', () => {
    const sim = makeSim({ planned: 40 });
    const evs = drive(sim, 41, frame());
    expect(ofType(evs, 'card')).toHaveLength(1);
    sim.finish();
    sim.result();
    sim.result();
    expect(sim.p.album).toHaveLength(1);
  });
});

describe('result()', () => {
  it('is idempotent: three calls, one progress', () => {
    const sim = makeSim({ planned: 180, progress: RETURNING });
    drive(sim, 60, FOCUS);
    solve(sim);
    drive(sim, 130, FOCUS);
    const a = JSON.stringify(sim.result()), pa = JSON.stringify(sim.p);
    sim.result();
    const c = JSON.stringify(sim.result());
    expect(c).toBe(a);
    expect(JSON.stringify(sim.p)).toBe(pa);
    expect(sim.p.sessions).toBe(RETURNING.sessions! + 1);
    expect(sim.p.valleys).toBe(sim.valleysClosed);
  });

  it('keeps records with max and the smaller time, and names a broken one only when there was one before', () => {
    const sim = makeSim({ planned: 40, progress: { ...RETURNING, bestSession: 3, steady: 2, deepestJars: 1, fastest: 0 } });
    drive(sim, 41, (t: number) => frame({ level: 1, focused: true, hold: t }));
    const out = sim.result();
    expect(out.record).toBe(true);
    expect(sim.p.bestSession).toBe(out.score);
    expect(sim.p.steady).toBeGreaterThan(2);
    expect(out.highlights.some(h => h.startsWith('Rekordy:'))).toBe(true);
    const first = makeSim({ planned: 40 });
    drive(first, 41, frame());
    expect(first.result().record).toBe(false);
    expect(first.result().highlights.some(h => h.startsWith('Rekord'))).toBe(false);
  });

  it('leaves the road untouched when the session is abandoned (result() never called)', () => {
    const p = { ...freshProgress(), ...RETURNING, roadIndex: 3 };
    const sim = new ZrodlaSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    solve(sim);
    drive(sim, 20, frame());
    expect(p.roadIndex).toBe(3);
    expect(p.road).toEqual([]);
    expect(p.sessions).toBe(RETURNING.sessions);
  });

  it('settles a session ended early like its finale: the open block judged, its nest landed, once', () => {
    const sim = makeSim({ planned: 300, progress: RETURNING });
    const clock = { t: 0 };
    driveTo(sim, 'sela', frame(), clock);
    drive(sim, 15, REST, clock);
    sim.finish();
    const evs = sim.take();
    expect(ofType(evs, 'blockEnd')).toHaveLength(1);
    expect(ofType(evs, 'nest')).toHaveLength(1);
    expect(sim.canStop()).toBe(true);
    sim.finish();
    expect(sim.take()).toHaveLength(0);
  });
});

describe('the closing verse', () => {
  const ROOT = 'psa84.5-6';

  it('fits the session, best first: a stage, a river, a nest, a closed valley, half green, a Nurt passed, then always two', () => {
    const sim = makeSim({ planned: 40 });
    drive(sim, 41, frame({ level: 0.3 }));
    // the first-ever session nests (the sparrows) and has no stage, no river
    expect(sim.verseFit()).toEqual(['psa84.3', 'isa58.11', 'psa23.1-3']);
    expect(sim.closingVerse()).toBe('psa84.3');
    const road = makeSim({ planned: 40, progress: { ...RETURNING, roadIndex: 7 } });
    solve(road);
    drive(road, 41, FOCUS);
    const fit = road.verseFit();
    expect(fit[0]).toBe('psa121.1-2');
    expect(fit).toContain('isa41.18');
    expect(fit).toContain('psa1.2-3');
    expect(fit.slice(-2)).toEqual(['isa58.11', 'psa23.1-3']);
    const order = ['psa121.1-2', 'isa35.7', 'psa84.3', 'isa41.18', '1co3.6', 'psa1.2-3', 'isa58.11', 'psa23.1-3'];
    expect(fit.map(id => order.indexOf(id))).toEqual([...fit.map(id => order.indexOf(id))].sort((a, b) => a - b));
  });

  it('takes the fitting passages in turn from session to session, never the lobby\'s root', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 12; s++) {
      const sim = makeSim({ planned: 40, progress: { ...RETURNING, sessions: s } });
      drive(sim, 41, REST);
      const v = sim.result().verse!;
      expect(v).not.toBe(ROOT);
      expect(passage(v).text.length).toBeGreaterThan(10);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('shows no verse during play: no event carries one, only result() names it', () => {
    const sim = makeSim({ planned: 180 });
    const evs = drive(sim, 181, frame());
    expect(evs.some(e => 'verse' in e)).toBe(false);
    expect(sim.result().verse).toBeDefined();
  });
});

describe('the texts', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the jars in Polish: 1 dzban, 2 dzbany, 5 dzbanów, 22 dzbany', () => {
    expect([1, 2, 5, 12, 22, 25].map(unit)).toEqual(['dzban', 'dzbany', 'dzbanów', 'dzbanów', 'dzbany', 'dzbanów']);
    expect(t('jars', { n: 3 })).toBe('3 dzbany');
    expect(bare('fields', 5)).toBe('pól');
    expect(cap(TREES[4].name)).toBe('Palma daktylowa');
  });

  it('never calls the band\'s effect energy or flow, in any language', () => {
    const all = Object.values(CATALOGS).flatMap(c => Object.values(c).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))));
    for (const s of all) expect(s).not.toMatch(/energ|flow state|living water|żyw[aą] wod|lebendig|levande vatten|Energie/i);
  });

  it('writes album captions in our own words, without quotation marks, short enough for two lines', () => {
    for (const c of ALBUM) {
      expect(c.caption).not.toMatch(/[„”"“«»]/);
      expect(c.caption.length).toBeLessThanOrEqual(90);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap at the centre every ~0.65 s, Space after every third one, the simulator's focus rising to about +20 %. */
  function smoke(progress: Partial<ZrodlaProgress>, seed: number, every = 0.65, eeg = false, until = 22): ZrodlaSim {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput({ ...BEGINNER });
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0;
    for (let t = 0; t < until; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      tap += STEP;
      if (tap >= every) {
        tap -= every;
        sim.tap(smokeCell(sim.run.v.cols, sim.run.v.rows));
        if (taps++ % 3 === 0) sim.turnCursor(1);
      }
      sim.take();
    }
    return sim;
  }

  it('scores within 22 s of the first-ever 40 s session at any tap rhythm, on both bands', () => {
    for (const every of [0.65, 0.66, 2 / 3, 0.68, 0.7]) {
      for (let seed = 1; seed <= 40; seed++) {
        expect(smoke({}, seed, every).score, `every ${every} s, seed ${seed}`).toBeGreaterThan(0);
        expect(smoke({}, seed, every, true).score, `HALO, every ${every} s, seed ${seed}`).toBeGreaterThan(0);
      }
    }
    const sim = smoke({}, 1, 0.65, false, 40.5);
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.canStop()).toBe(true);
  });

  it('scores within 22 s in ≥ 95 of 100 later sessions (2–6), the day\'s valley or the road', () => {
    let scored = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const sessions = 1 + (seed % 5);
      const progress: Partial<ZrodlaProgress> = { sessions, lastNewSession: 1, album: [0], roadIndex: 1 + (seed % 12), dailyDay: seed % 2 ? DAY : '' };
      if (smoke(progress, seed).score > 0) scored++;
    }
    expect(scored).toBeGreaterThanOrEqual(95);
  });

  it('turns a stone with the centre click in the first valley of every later session', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const progress of [{ sessions: 2 }, { sessions: 4, dailyDay: DAY, roadIndex: seed }]) {
        const sim = makeSim({ progress, seed, daySeed: seed });
        expect(sim.run.v.turnable(smokeCell(sim.run.v.cols, sim.run.v.rows))).toBe(true);
      }
    }
  });
});

describe('the depth ladder and the green\'s reach', () => {
  it('caps the green by depth: half a cell wet, 1 ankle, 1.5 knee, 2 waist, 3 river; none while dry', () => {
    expect([0, 1, 3, 8, 15, 25].map(greenCap)).toEqual([0, 0.5, 1, 1.5, 2, 3]);
    expect(RULES.front).toBe(2.5);
  });
});
