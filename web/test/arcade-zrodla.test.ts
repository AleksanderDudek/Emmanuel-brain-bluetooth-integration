import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { GUIDE_WORD_MIN, breathGuideBox, breathWords } from '../src/arcade/kit/breathguide';
import { DEFAULT_TUNING, type FocusFrame } from '../src/arcade/kit/focus';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, DESK_MIN_W, MIN_READ, MIN_TAP, MIN_TEXT, THUMB, auditTargets, target } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import { mergeSaved } from '../src/arcade/kit/progress';
import { LINES, MOMENTS, STATIONS, TIPS } from '../src/arcade/zrodla/content';
import {
  EMPTY, GARDEN, KINDS, MASK, PIPE, ROCK, SPRING, Valley, autoSpot, bit, channelOf, deal, exitOf, makeValley, opp, seeded, specOf, type Kind,
} from '../src/arcade/zrodla/grid';
import { CATALOGS, hand, t, unit } from '../src/arcade/zrodla/i18n';
import { cellAt, cellBox, computeLayout } from '../src/arcade/zrodla/layout';
import { SANS, SERIF, font } from '../src/arcade/zrodla/paint';
import type { ZrodlaView } from '../src/arcade/zrodla/render';
import { bestOf, freshProgress, migrate, recordValley, type ZrodlaProgress } from '../src/arcade/zrodla/meta';
import { RULES, cellSecOf, countdownOf, goalOf, gridOf, isGarden, paceOf, starsFor } from '../src/arcade/zrodla/rules';
import { ZrodlaSim, planBlocks, type ZrodlaEvent } from '../src/arcade/zrodla/sim';
import { catalogProblems, LANGS } from '../src/i18n';
import mod, { howto } from '../src/arcade/zrodla/index';

// ── helpers ─────────────────────────────────────────────────────

const TUNING = { ...DEFAULT_TUNING, adapt: 0.08 };
const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });
const focusing = (): FocusFrame => frame({ activity: 12, level: 0.97, focused: true, hold: 10, calm: 0.03 });
const neutral = (): FocusFrame => frame({ activity: 1, level: 0.35, calm: 0.4 });
const resting = (): FocusFrame => frame({ activity: -3, level: 0.05, focused: false, hold: 0, calm: 0.95 });
const lost = (): FocusFrame => frame({ reliable: false, activity: null, level: 0, calm: 0 });

const returning = (o: Partial<ZrodlaProgress> = {}): ZrodlaProgress => ({ ...freshProgress(), sessions: 4, pushes: 1, ...o });

function rng(seed: number): () => number { return seeded(seed); }

function newSim(o: { progress?: ZrodlaProgress; plannedSec?: number; seed?: number; eeg?: boolean } = {}): ZrodlaSim {
  return new ZrodlaSim({ progress: o.progress ?? returning(), rng: rng(o.seed ?? 3), plannedSec: o.plannedSec ?? 600, eeg: !!o.eeg, tuning: TUNING });
}

/** Run the sim for `sec` from its clock with frames from `f(t)`, collecting its events. */
function run(sim: ZrodlaSim, sec: number, f: (t: number) => FocusFrame = neutral, dt = 0.05, each?: (t: number) => void): ZrodlaEvent[] {
  const out: ZrodlaEvent[] = [];
  const t0 = sim.t;
  for (let t = t0; t < t0 + sec - 1e-9; t += dt) {
    each?.(t);
    sim.update(dt, f(t), t + dt);
    out.push(...sim.take());
  }
  return out;
}

/** A started sim past its story card with a hand-made valley: `rows` of '.' empty, '#' rock, 'S' spring (outlet east). */
function withValley(rows: string[], o: { goal?: number; plannedSec?: number; f?: () => FocusFrame } = {}): ZrodlaSim {
  const sim = newSim({ plannedSec: o.plannedSec ?? 600 });
  sim.start();
  sim.take();
  const v = new Valley(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const c = v.cells[v.idx(x, y)];
    if (ch === '#') { c.type = ROCK; c.fixed = true; }
    if (ch === 'S') { c.type = SPRING; c.dir = 1; c.fixed = true; v.spring = v.idx(x, y); }
    if (ch === 'G') { c.type = GARDEN; c.dir = 3; c.fixed = true; v.garden = v.idx(x, y); }
  }));
  sim.valley = v;
  sim.spec = { ...sim.spec, goal: o.goal ?? 3, garden: v.garden >= 0, cols: v.cols, rows: v.rows };
  sim.segs = [];
  sim.phase = 'count';
  sim.countLeft = 99;
  sim.cells = 0;
  sim.retrace();
  return sim;
}

/** Run until an event matches (at most `max` s), returning the events so far. */
function runUntil(sim: ZrodlaSim, pred: (e: ZrodlaEvent) => boolean, max = 30, f: (t: number) => FocusFrame = neutral): ZrodlaEvent[] {
  const out: ZrodlaEvent[] = [];
  for (let k = 0; k < max / 0.05; k++) {
    sim.update(0.05, f(sim.t), sim.t + 0.05);
    const ev = sim.take();
    out.push(...ev);
    if (ev.some(pred)) break;
  }
  return out;
}

function layKinds(sim: ZrodlaSim, cells: [number, number][], kinds: Kind[]): void {
  cells.forEach(([x, y], i) => {
    sim.queue[0] = kinds[i];
    expect(sim.layAt(sim.valley.idx(x, y))).toBe(true);
    sim.lockUntil = 0;
  });
}

// ── the stones and the valley ───────────────────────────────────

describe('Źródła stones (Pipe Mania set: straights, bends, the cross, the pool)', () => {
  it('lets water through the open sides only, bends turn and straights and crosses go on', () => {
    expect(exitOf('h', 3)).toBe(1);
    expect(exitOf('h', 0)).toBe(-1);
    expect(exitOf('v', 0)).toBe(2);
    expect(exitOf('ne', 0)).toBe(1);
    expect(exitOf('ne', 1)).toBe(0);
    expect(exitOf('sw', 3)).toBe(2);
    expect(exitOf('x', 0)).toBe(2);
    expect(exitOf('x', 3)).toBe(1);
    expect(exitOf('ph', 1)).toBe(3);
    for (const k of KINDS) for (let d = 0; d < 4; d++) {
      const e = exitOf(k, d);
      expect(e >= 0).toBe(!!(MASK[k] & bit(d)));
      if (e >= 0) expect(MASK[k] & bit(e)).toBeTruthy();
    }
    expect(channelOf('x', 0)).toBe(1);
    expect(channelOf('x', 1)).toBe(0);
    expect(channelOf('h', 1)).toBe(0);
  });

  it('a cross takes water once on each axis, any other stone once', () => {
    const v = new Valley(3, 3);
    v.lay(4, 'x', 0);
    const a = v.enter(4, 3);
    expect(typeof a).toBe('object');
    v.cells[4].wet |= bit(0);
    expect(v.enter(4, 3)).toBe('blocked');
    expect(typeof v.enter(4, 0)).toBe('object');
    v.lay(1, 'h', 0);
    v.cells[1].wet = 1;
    expect(v.enter(1, 3)).toBe('blocked');
    expect(v.enter(-1, 0)).toBe('edge');
    expect(v.enter(0, 0)).toBe('empty');
  });

  it('traces the way ahead through dry stones to its open end', () => {
    const sim = withValley(['S....', '.....']);
    layKinds(sim, [[1, 0], [2, 0], [3, 0]], ['h', 'h', 'sw']);
    expect(sim.ahead.map(s => sim.valley.col(s.cell))).toEqual([1, 2, 3]);
    expect(sim.wayEnd.kind).toBe('empty');
    expect(sim.wayEnd.cell).toBe(sim.valley.idx(3, 1));
    expect(sim.wayEnd.side).toBe(0);
  });

  it('generates every road valley solvable, the same for everyone', () => {
    for (let v = 0; v < 70; v++) {
      const val = makeValley(v), spec = specOf(v);
      expect(val.cols * val.rows).toBe(spec.cols * spec.rows);
      expect(val.cells[val.spring].type).toBe(SPRING);
      const out = val.step(val.spring, val.cells[val.spring].dir);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(val.cells[out].type).toBe(EMPTY);
      expect(val.reach(out)).toBeGreaterThanOrEqual(spec.goal + 4);
      if (isGarden(v)) {
        expect(val.garden).toBeGreaterThanOrEqual(0);
        expect(val.reachable(out, val.step(val.garden, val.cells[val.garden].dir))).toBe(true);
      } else expect(val.garden).toBe(-1);
      const again = makeValley(v);
      expect(again.cells.map(c => c.type)).toEqual(val.cells.map(c => c.type));
    }
  });

  it('grows the valleys and their goals with a breather at each station', () => {
    expect(gridOf(0)).toEqual([7, 5]);
    expect(gridOf(60)).toEqual([...RULES.gridMax]);
    expect(goalOf(0)).toBe(RULES.goalStart);
    expect(goalOf(4)).toBeLessThan(goalOf(2) + 2);
    expect(goalOf(3)).toBeLessThan(goalOf(2));
    expect(countdownOf(0)).toBe(RULES.countStart);
    expect(countdownOf(100)).toBe(RULES.countMin);
    expect(cellSecOf(100)).toBe(RULES.cellMin);
    expect(starsFor(5, 6)).toBe(0);
    expect(starsFor(6, 6)).toBe(1);
    expect(starsFor(10, 6)).toBe(2);
    expect(starsFor(14, 6)).toBe(3);
  });

  it('slows the water only above the threshold', () => {
    expect(paceOf(0)).toBe(1);
    expect(paceOf(0.5)).toBe(1);
    expect(paceOf(1)).toBeCloseTo(1 - RULES.slowMax);
    expect(paceOf(0.75)).toBeGreaterThan(paceOf(1));
  });

  it('deals the seven stones, pools from valley 2, and leans to a side on request', () => {
    const r = rng(9);
    const seen = new Set<Kind>();
    for (let i = 0; i < 400; i++) seen.add(deal(r, 0, null));
    expect(seen.has('ph') || seen.has('pv')).toBe(false);
    expect(seen.size).toBe(7);
    for (let i = 0; i < 400; i++) seen.add(deal(r, 5, null));
    expect(seen.has('ph') || seen.has('pv')).toBe(true);
    for (let i = 0; i < 100; i++) expect(MASK[deal(r, 5, 3)] & bit(3)).toBeTruthy();
  });

  it('the helper lays at the open end when the stone goes on, and parks it away otherwise', () => {
    const sim = withValley(['S....', '.....', '.....']);
    const end = sim.wayEnd;
    expect(end.cell).toBe(sim.valley.idx(1, 0));
    expect(autoSpot(sim.valley, 'h', end, sim.valley.spring)).toBe(end.cell);
    const parked = autoSpot(sim.valley, 'v', end, sim.valley.spring);
    expect(parked).not.toBe(end.cell);
    expect(parked).toBeGreaterThanOrEqual(0);
    // a north-east bend would lead off the grid: parked
    expect(autoSpot(sim.valley, 'ne', end, sim.valley.spring)).not.toBe(end.cell);
  });
});

// ── the hands and the water ─────────────────────────────────────

describe('Źródła play (Pipe Mania)', () => {
  it('lays the next stone from a queue of five, which refills', () => {
    const sim = withValley(['S....', '.....']);
    const q = [...sim.queue];
    expect(q).toHaveLength(RULES.queueLen);
    sim.layAt(sim.valley.idx(1, 0));
    expect(sim.valley.cells[sim.valley.idx(1, 0)].kind).toBe(q[0]);
    expect(sim.queue.slice(0, 4)).toEqual(q.slice(1));
    expect(sim.queue).toHaveLength(RULES.queueLen);
    expect(sim.layAt(sim.valley.spring)).toBe(false);
  });

  it('replaces a dry stone, and the hands wait a moment with the next input buffered', () => {
    const sim = withValley(['S....', '.....']);
    const c = sim.valley.idx(1, 0);
    sim.layAt(c);
    sim.take();
    const next = sim.queue[0];
    expect(sim.layAt(c)).toBe(true);
    const ev = sim.take();
    expect(ev.some(e => e.type === 'lay' && e.replaced)).toBe(true);
    expect(sim.valley.cells[c].kind).toBe(next);
    expect(sim.bombs).toBe(1);
    const other = sim.valley.idx(3, 1);
    expect(sim.layAt(other)).toBe(true);
    expect(sim.valley.cells[other].type).toBe(EMPTY);
    run(sim, RULES.bombSec + 0.1);
    expect(sim.valley.cells[other].type).toBe(PIPE);
  });

  it('runs the water after the countdown, scores each cell, and spills where the way ends', () => {
    const sim = withValley(['S....', '.....'], { goal: 2 });
    layKinds(sim, [[1, 0], [2, 0], [3, 0]], ['h', 'h', 'h']);
    sim.countLeft = 0.5;
    const ev = run(sim, 0.6);
    expect(ev.some(e => e.type === 'flow')).toBe(true);
    const ev2 = runUntil(sim, e => e.type === 'valleyEnd');
    const fills = ev2.filter(e => e.type === 'fill');
    expect(fills).toHaveLength(3);
    expect(sim.score).toBeGreaterThanOrEqual(3 * RULES.perCell);
    const end = ev2.find(e => e.type === 'valleyEnd');
    expect(end && end.type === 'valleyEnd' && end.won).toBe(true);
    expect(ev2.some(e => e.type === 'spill')).toBe(true);
    // the tally card, then the next valley
    expect(sim.story?.kind).toBe('tally');
    const before = sim.v;
    run(sim, RULES.tallySec + 0.2);
    expect(sim.v).toBe(before + 1);
    expect(sim.phase).toBe('count');
  });

  it('a missed goal soaks in: the score stays and the same valley comes again', () => {
    const sim = withValley(['S....', '.....'], { goal: 5 });
    layKinds(sim, [[1, 0]], ['h']);
    sim.countLeft = 0.1;
    const ev = runUntil(sim, e => e.type === 'valleyEnd');
    const end = ev.find(e => e.type === 'valleyEnd');
    expect(end && end.type === 'valleyEnd' && !end.won).toBe(true);
    expect(sim.story?.kind).toBe('spill');
    const score = sim.score;
    expect(score).toBeGreaterThan(0);
    const v = sim.v;
    run(sim, RULES.spillSec + 0.2);
    expect(sim.v).toBe(v);
    expect(sim.score).toBe(score);
    expect(sim.nearMiss).toBe(4);
  });

  it('pays a loop when the water runs through a cross twice', () => {
    const s2 = withValley(['.....', 'S....', '.....'], { goal: 4 });
    // east through x(2,1) to (3,1) 'sw' → south to (3,2) 'nw' → west to (2,2) 'ne' → north into x(2,1) second channel → north to (2,0) 'v'
    layKinds(s2, [[1, 1], [2, 1], [3, 1], [3, 2], [2, 2], [2, 0]], ['h', 'x', 'sw', 'nw', 'ne', 'v']);
    expect(s2.ahead.length).toBe(7);
    s2.countLeft = 0.1;
    const ev = run(s2, 30);
    const loops = ev.filter(e => e.type === 'fill' && e.loop);
    expect(loops).toHaveLength(1);
    expect(s2.loops).toBe(1);
    expect(s2.score).toBeGreaterThanOrEqual(7 * RULES.perCell + RULES.loopBonus);
  });

  it('a pool fills slowly and pays when full', () => {
    const sim = withValley(['S....', '.....'], { goal: 2 });
    layKinds(sim, [[1, 0], [2, 0]], ['ph', 'h']);
    sim.countLeft = 0.01;
    const ev = run(sim, 30);
    expect(ev.some(e => e.type === 'poolDone')).toBe(true);
    expect(sim.pools).toBe(1);
  });

  it('Space lays where it helps until the way is ready, then lets the water run fast (×2)', () => {
    const sim = withValley(['S....', '.....', '.....'], { goal: 2 });
    sim.queue = ['h', 'h', 'h', 'h', 'h'];
    sim.space();
    sim.space();
    expect(sim.ahead.length).toBe(2);
    expect(sim.wayDone).toBe(true);
    sim.take();
    sim.space();
    const ev = sim.take();
    expect(ev.some(e => e.type === 'fast')).toBe(true);
    expect(ev.some(e => e.type === 'flow')).toBe(true);
    const ev2 = run(sim, 4);
    const fills = ev2.filter(e => e.type === 'fill');
    expect(fills.length).toBeGreaterThanOrEqual(2);
    for (const f of fills) if (f.type === 'fill') expect(f.points).toBe(RULES.perCell * RULES.fastMult);
  });

  it('a garden valley is won only in the garden', () => {
    const sim = withValley(['S...G', '.....'], { goal: 2 });
    layKinds(sim, [[1, 0], [2, 0], [3, 0]], ['h', 'h', 'h']);
    expect(sim.wayEnd.kind).toBe('garden');
    expect(sim.wayDone).toBe(true);
    sim.countLeft = 0.01;
    const ev = run(sim, 12);
    expect(ev.some(e => e.type === 'garden')).toBe(true);
    const end = ev.find(e => e.type === 'valleyEnd');
    expect(end && end.type === 'valleyEnd' && end.won).toBe(true);
  });

  it('keyboard: arrows move a cursor and Enter lays there', () => {
    const sim = withValley(['S....', '.....']);
    sim.key('ArrowRight', true);
    expect(sim.cursor).toBe(sim.valley.idx(1, 0));
    sim.key('ArrowDown', true);
    sim.key('ArrowRight', true);
    sim.key('Enter', true);
    expect(sim.valley.cells[sim.valley.idx(2, 1)].type).toBe(PIPE);
  });
});

// ── the band ────────────────────────────────────────────────────

describe('Źródła and the band', () => {
  function pushSim(): ZrodlaSim {
    const sim = newSim({ plannedSec: 600 });
    sim.start();
    sim.dismiss();
    expect(sim.block.kind).toBe('push');
    return sim;
  }

  it('in a push, focus closes the sluice and the water flows slower; without signal nothing changes', () => {
    const a = pushSim(), b = pushSim(), c = pushSim();
    run(a, 9, focusing);
    run(b, 9, neutral);
    run(c, 9, lost);
    expect(a.sluice).toBeGreaterThan(0.85);
    expect(a.pace).toBeLessThan(0.6);
    expect(a.meter()).toBeGreaterThan(0.85);
    expect(b.pace).toBe(1);
    expect(c.pace).toBe(1);
    expect(c.meter()).toBeNull();
  });

  it('a held focus fills the charge: still waters for a few seconds', () => {
    const sim = pushSim();
    const ev = run(sim, 20, focusing);
    expect(ev.some(e => e.type === 'still' && e.on)).toBe(true);
    expect(sim.stillRuns).toBeGreaterThanOrEqual(1);
  });

  it('waits for the band’s delay before the sluice moves (5 s Mendi, 2 s HALO)', () => {
    const m = pushSim();
    run(m, 4, focusing);
    expect(m.sluice).toBe(0);
    const e = new ZrodlaSim({ progress: returning(), rng: rng(3), plannedSec: 600, eeg: true, tuning: TUNING });
    e.start();
    run(e, 4, focusing);
    expect(e.sluice).toBeGreaterThan(0.3);
  });

  it('in a rest, calm grows gardens along the wet cells, and they bloom for jars', () => {
    const sim = withValley(['S....', '.....'], { goal: 9 });
    layKinds(sim, [[1, 0], [2, 0], [3, 0], [4, 0]], ['h', 'h', 'h', 'sw']);
    sim.countLeft = 0.01;
    run(sim, 3);
    // jump into the first rest block
    while (sim.block.kind !== 'rest') run(sim, 1, neutral);
    const before = sim.score;
    // (to just before the Sela's end: the meter is the rest's)
    const ev = run(sim, Math.min(18, sim.left - 0.5), resting);
    expect(ev.some(e => e.type === 'bloom')).toBe(true);
    expect(sim.blooms).toBeGreaterThan(0);
    expect(sim.score).toBeGreaterThan(before);
    expect(sim.meter()).toBeGreaterThan(0.8);
  });

  it('plans blocks that fill the session, with a warm-up only the first time', () => {
    for (const sec of [10, 40, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, rng(1));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(sum).toBeCloseTo(Math.max(10, sec), 5);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        expect(plan.at(-1)!.kind).toBe('rest');
        if (sec >= 180) for (const b of plan.filter(x => x.kind !== 'warmup')) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      }
    }
  });

  it('follows the rhythm the player set in the lobby: a longer sluice, a shorter Sela, the jitter scaled; the valleys keep coming', () => {
    for (const sec of [300, 1800]) {
      const plan = planBlocks(sec, false, rng(5), { focus: 90, rest: 15 });
      const push = plan.filter(b => b.kind === 'push'), rest = plan.filter(b => b.kind === 'rest');
      const mean = (bs: typeof plan) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
      expect(mean(push) / mean(rest)).toBeGreaterThan(4);
      expect(mean(push)).toBeGreaterThan(70);
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec, 5);
      for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
    // no rhythm: the designed one, the Sela a third of the session
    const plan = planBlocks(600, false, rng(5));
    const restShare = plan.filter(b => b.kind === 'rest').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(restShare).toBeGreaterThan(0.27);
    expect(restShare).toBeLessThan(0.4);
    // the sim takes the rhythm; at either extreme the valleys keep coming, the gardens green, the score grows
    for (const rhythm of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }]) {
      const sim = new ZrodlaSim({ progress: returning(), rng: rng(3), plannedSec: 600, eeg: false, tuning: TUNING, rhythm });
      sim.start();
      const pushes = sim.plan.filter(b => b.kind === 'push');
      const push = pushes.reduce((s, b) => s + b.dur, 0) / pushes.length;
      expect(push).toBeGreaterThan(rhythm.focus * 0.75);
      expect(push).toBeLessThan(rhythm.focus * 1.25);
      let valleys = 0, lastSpace = -1;
      run(sim, 600, () => (sim.restBlock ? resting() : focusing()), 0.1, tt => {
        if (tt - lastSpace >= 0.5) { lastSpace = tt; sim.space(); }
      }).forEach(e => { if (e.type === 'valley') valleys++; });
      expect(sim.ended).toBe(true);
      expect(valleys).toBeGreaterThan(8);
      expect(sim.blooms).toBeGreaterThan(0);
      expect(sim.score).toBeGreaterThan(100);
    }
  });

  it('every 4th push is blind from the 3rd session: the gauge hides, the result shows at the end', () => {
    const sim = newSim({ progress: returning({ sessions: 4, pushes: 2 }), plannedSec: 600 });
    sim.start();
    const ev = run(sim, 120, focusing);
    const blindStart = ev.find(e => e.type === 'blockStart' && e.block.blind);
    expect(blindStart).toBeTruthy();
    expect(ev.some(e => e.type === 'reveal')).toBe(true);
  });

  it('judges each block once, at its end', () => {
    const sim = newSim({ plannedSec: 180 });
    sim.start();
    const ev = run(sim, 180, t => (Math.floor(t / 24) % 2 === 0 ? focusing() : resting()));
    const ends = ev.filter(e => e.type === 'blockEnd');
    expect(ends.length).toBe(sim.plan.length);
    expect(ends.some(e => e.type === 'blockEnd' && e.verdict === true)).toBe(true);
  });
});

// ── the session ─────────────────────────────────────────────────

describe('Źródła session', () => {
  it('the smoke input (a tap at the centre every 0.65 s, Space every ~2 s) scores within 22 s of a first session', () => {
    for (const [seed, plannedSec] of [[1, 40], [2, 40], [3, 40], [4, 180], [5, 40], [6, 300]]) {
      const sim = newSim({ progress: freshProgress(), plannedSec, seed });
      sim.start();
      let lastTap = -1, lastSpace = -1;
      run(sim, 22, focusing, 1 / 30, t => {
        if (t - lastTap >= 0.65) {
          lastTap = t;
          const v = sim.valley;
          sim.layAt(v.idx(Math.floor(v.cols / 2), Math.floor(v.rows * 0.6)));
        }
        if (t - lastSpace >= 1.95) {
          lastSpace = t;
          sim.space();
        }
      });
      expect(sim.result().score, `seed ${seed}`).toBeGreaterThan(0);
      const e = new ZrodlaSim({ progress: freshProgress(), rng: rng(seed), plannedSec, eeg: true, tuning: TUNING });
      e.start();
      let k = 0;
      run(e, 22, focusing, 1 / 30, () => { k++; if (k % 20 === 0) { const v = e.valley; e.layAt(v.idx(Math.floor(v.cols / 2), Math.floor(v.rows * 0.6))); } if (k % 60 === 0) e.space(); });
      expect(e.result().score, `eeg seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('result() is idempotent and records with Math.max', () => {
    const sim = newSim({ plannedSec: 60 });
    sim.start();
    sim.dismiss();
    let k = 0;
    run(sim, 60, neutral, 0.05, () => { if (++k % 30 === 0) sim.space(); });
    sim.finish();
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.best).toBe(Math.max(returning().best, a.score));
    expect(sim.p.sessions).toBe(5);
    expect(a.verse).toBeTruthy();
    expect(a.highlights.length).toBeGreaterThan(0);
  });

  it('a first session opens on a story card that a tap closes', () => {
    const sim = newSim({ progress: freshProgress() });
    sim.start();
    expect(sim.story?.kind).toBe('open');
    expect(sim.plan[0].kind).toBe('warmup');
    run(sim, 1);
    expect(sim.dismiss()).toBe(true);
    expect(sim.story).toBeNull();
  });

  it('records stars and opens the next valley', () => {
    const p = freshProgress();
    recordValley(p, 0, 2);
    recordValley(p, 0, 1);
    expect(p.stars[0]).toBe(2);
    expect(p.valley).toBe(1);
    recordValley(p, 1, 0);
    expect(p.valley).toBe(1);
  });
});

// ── saves ───────────────────────────────────────────────────────

describe('Źródła saves', () => {
  it('migrates a version-1 save: keeps the best session and the session count, resets the rest', () => {
    const old = {
      v: 1, sessions: 7, jars: 412, valleys: 9, nests: 2, pushes: 11, roadIndex: 13,
      open: { idx: 13, seed: 5, skill: 1, rot: [0, 1], jars: [1], green: [0] },
      road: [{ i: 0, d: 2, g: 50, n: 1, y: 0 }], skill: 1, album: [0, 2], dawn: [2], drops: 1, lastNewSession: 4,
      trees: [{ k: 1, d: '2026-11-01' }], giftDay: '2026-11-01', dailyDay: '', dailySec: 0, dailyBest: 0,
      bestSession: 233, deepestJars: 18, deepest: 3, fastest: 12, steady: 9, rytm: 2.5, lastDay: '2026-11-01',
    };
    const p = mergeSaved(freshProgress(), old);
    expect(bestOf(p)).toBe(233);
    migrate(p);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.best).toBe(233);
    expect(p.valley).toBe(0);
    expect(p.stars).toEqual([]);
    expect((p as unknown as Record<string, unknown>).album).toBeUndefined();
    expect(migrate(p)).toEqual(p);
    // a session runs on it
    const sim = new ZrodlaSim({ progress: p, rng: rng(1), plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    run(sim, 10);
    expect(sim.p.sessions).toBe(8);
  });

  it('never crashes on fields of a wrong type', () => {
    const bad = mergeSaved(freshProgress(), { ver: 2, sessions: 'x', best: null, stars: 'no', seen: 5, valley: -3, lastDay: 4 });
    migrate(bad);
    expect(bad.sessions).toBe(0);
    expect(bad.stars).toEqual([]);
    expect(bad.seen).toEqual([]);
    expect(bad.valley).toBe(0);
    expect(bad.lastDay).toBe('');
    expect(mod.best(freshProgress())).toBeNull();
  });
});

// ── words ───────────────────────────────────────────────────────

describe('Źródła words', () => {
  it('has every text in all four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Kumka at least three short lines for every moment', () => {
    for (const m of MOMENTS) {
      expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
      for (const l of LANGS) for (let i = 1; i <= 3; i++) {
        const s = CATALOGS[l][`say.${m}.${i}` as keyof typeof CATALOGS.pl] as string;
        expect(s.length, `${l} say.${m}.${i}`).toBeLessThanOrEqual(90);
      }
    }
    expect(STATIONS).toHaveLength(RULES.stations);
  });

  it('suggests strategies, never to try harder; quotes in each language’s own marks', () => {
    const all = (l: (typeof LANGS)[number]) => Object.values(CATALOGS[l]).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m)));
    for (const l of LANGS) for (const s of all(l)) {
      expect(s).not.toMatch(/mocniej|harder|stärker|hårdare|concentrate more/i);
      if (l !== 'pl') expect(s, s).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/);
      if (/[„“”"]/.test(s)) {
        if (l === 'pl') expect(s).toMatch(/„[^„”"“]+”/);
        if (l === 'de') expect(s).toMatch(/„[^„”"“]+“/);
        if (l === 'sv') expect(s).toMatch(/”[^„”"“]+”/);
        if (l === 'en') expect(s).toMatch(/“[^„”"“]+”/);
      }
    }
    for (const tip of [...TIPS.push, ...TIPS.rest, ...TIPS.blind]) expect(tip.length).toBeGreaterThan(5);
    expect(unit(1)).toBe('dzban');
    expect(unit(5)).toBe('dzbanów');
    expect(t('sub.goal', { v: 2, got: 3, goal: 8 })).toBe('Dolina 2 · 3/8');
  });

  it('describes how to play in one goal, up to three controls and two tips', () => {
    const h = mod.howto!();
    expect(h.goal.length).toBeGreaterThan(10);
    expect(h.hands.length).toBeGreaterThanOrEqual(1);
    expect(h.hands.length).toBeLessThanOrEqual(3);
    expect(h.tips!.length).toBeLessThanOrEqual(2);
    expect(opp(0)).toBe(2);
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
const GRIDS = [[7, 5], [8, 5], [8, 6], [8, 7]] as const;

describe('Źródła on a phone first: the layout', () => {
  it('the font helper never goes under 11 px', () => {
    for (const px of [0, 4, 6.4, 9, 10.99, 11, 13, 24]) {
      for (const fam of [SANS, SERIF]) expect(pxOf(font(700, px, fam, px > 20))).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(pxOf(font(800, 24, SERIF))).toBe(24);
  });

  it('every checked screen and grid: cells of 44 px or more inside the band, the valley whole where it fits, a short pan where it does not', () => {
    for (const z of CHECK_SIZES) {
      for (const [c, r] of GRIDS) {
        const L = computeLayout(z.w, z.h, z.insets, c, r);
        const name = `${z.name} ${c}×${r}`, v = L.view;
        expect(L.shape, name).toBe(upright(z) || z.w < z.h ? 'tall' : z.h < 470 ? 'side' : 'wide');
        expect(L.u, name).toBeGreaterThanOrEqual(1);
        // past 1.3 only on a big screen (DESIGN §14)
        expect(L.u, name).toBeLessThanOrEqual(z.w >= DESK_MIN_W && Math.min(z.w, z.h) >= DESK_BIG ? DESK_MAX : 1.3);
        expect(L.cell, name).toBeGreaterThanOrEqual(MIN_TAP);
        expect(L.board.w, name).toBe(c * L.cell);
        expect(L.board.h, name).toBe(r * L.cell);
        expect(v.y, name).toBeGreaterThanOrEqual(z.insets.top);
        expect(v.y + v.h, name).toBeLessThanOrEqual(z.h - z.insets.bottom);
        expect(v.x, name).toBeGreaterThanOrEqual(Math.max(16, z.insets.left));
        expect(v.x + v.w, name).toBeLessThanOrEqual(z.w - Math.max(16, z.insets.right));
        expect(L.panX, name).toBe(L.board.w - v.w);
        expect(L.panY, name).toBe(L.board.h - v.h);
        // the window shows nearly all the valley: never more than a cell hidden each way
        expect(L.panX, name).toBeLessThanOrEqual(L.cell);
        expect(L.panY, name).toBeLessThanOrEqual(L.cell * 1.05);
        // the smoke's tap (50 % × 60 % of the canvas) lands on the valley
        expect(cellAt(L, z.w / 2, z.h * 0.6), name).toBeGreaterThanOrEqual(0);
      }
    }
    // a 360 px phone pans an eight-wide valley a little; an iPhone in Safari shows it whole
    expect(computeLayout(360, 500, CHECK_SIZES[0].insets, 8, 5).panX).toBeGreaterThan(0);
    expect(computeLayout(360, 500, CHECK_SIZES[0].insets, 7, 5).panX).toBe(0);
    const ip = computeLayout(390, 564, CHECK_SIZES[1].insets, 8, 7);
    expect(ip.panX + ip.panY).toBe(0);
  });

  it('the next stone and the dial are clear targets beside every whole cell at both ends of the pan, in the thumb zone upright', () => {
    for (const z of CHECK_SIZES) {
      for (const [c, r] of GRIDS) {
        const L = computeLayout(z.w, z.h, z.insets, c, r);
        const name = `${z.name} ${c}×${r}`;
        for (const [px, py] of [[0, 0], [L.panX, L.panY]]) {
          L.board.x = L.view.x - px;
          L.board.y = L.view.y - py;
          const ts = [target('next', L.next), target('dial', L.dial)];
          let whole = 0;
          for (let i = 0; i < c * r; i++) {
            const b = cellBox(L, i).shown;
            if (b && b.w >= MIN_TAP - 0.5 && b.h >= MIN_TAP - 0.5) {
              ts.push({ label: `cell ${i}`, ...b });
              whole++;
            }
          }
          expect(auditTargets(ts, z.w, z.h, z.insets), `${name} pan ${px},${py}`).toEqual([]);
          expect(whole, name).toBeGreaterThanOrEqual((c - (L.panX > 0 ? 1 : 0)) * (r - (L.panY > 0 ? 1 : 0)));
        }
        for (const b of [L.next, L.dial]) expect(b.y + b.h, name).toBeLessThan(z.h - 1);
        if (upright(z)) {
          expect(L.next.y, name).toBeGreaterThanOrEqual(z.h * (1 - THUMB));
          expect(L.dial.y, name).toBeGreaterThanOrEqual(z.h * (1 - THUMB));
          expect(L.next.x, name).toBeGreaterThanOrEqual(16 - 4);
          expect(L.dial.x + L.dial.w, name).toBeLessThanOrEqual(z.w - 16 + 6);
          expect(L.gauge.r * 2, name).toBeGreaterThanOrEqual(52);
        }
        // the dispenser's stones and the dial stay off the valley's window
        for (const b of [L.next, L.dial, ...L.slots]) {
          const v = L.view;
          const ox = Math.min(b.x + b.w, v.x + v.w) - Math.max(b.x, v.x), oy = Math.min(b.y + b.h, v.y + v.h) - Math.max(b.y, v.y);
          expect(ox > 1 && oy > 1, name).toBe(false);
        }
      }
    }
  });
});

describe('Źródła on a phone first: the game at every checked size', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return noteContext(this); }; });
  afterAll(() => { proto.getContext = original; });
  type Hint = { text: string; at: { x: number; y: number } | null };

  function envFor(z: { w: number; h: number; insets: Insets }, progress: ZrodlaProgress, touch: boolean, hints: Hint[]): GameEnv<ZrodlaProgress> {
    return {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress, rng: rng(5), day: '2026-11-12', daySeed: 7, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false,
      tuning: TUNING, hint: (text: string, at?: { x: number; y: number } | null) => { if (text) hints.push({ text, at: at ?? null }); },
      hudTop: () => z.insets.top, insets: () => z.insets, touch,
    };
  }

  function gameAt(z: { w: number; h: number; insets: Insets }, touch = true, progress = returning(), hints: Hint[] = []) {
    const game = mod.create(envFor(z, progress, touch, hints));
    game.resize(z.w, z.h, 1);
    game.start();
    const inner = game as unknown as { sim: ZrodlaSim; view: ZrodlaView };
    return { game, sim: inner.sim, view: inner.view, clock: { t: 0 } };
  }

  const play = (game: ArcadeGame, clock: { t: number }, sec: number, f: FocusFrame = neutral()) => {
    for (let i = 0; i < Math.round(sec * 30); i++) {
      clock.t += 1 / 30;
      game.update(1 / 30, f, clock.t);
      game.draw();
    }
  };

  /** Text allowed under MIN_READ (never under MIN_TEXT): the dial's tags (the threshold, the pace), a count, a verse's reference. */
  const secondary = (s: string): boolean => s === t('g.threshold') || /^×/.test(s) || /^[\d\s+−-]+$/.test(s) || s.includes(' · ');

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

  it('the countdown, the water, a rest, a blind push and the story cards: targets and text pass the phone checks', () => {
    for (const z of CHECK_SIZES) {
      const touch = !z.name.startsWith('desktop');
      for (const valley of [0, 6]) {
        const { game, sim, view, clock } = gameAt(z, touch, returning({ valley }));
        const what = (s: string) => `valley ${valley}: ${s}`;
        play(game, clock, 0.5);
        const labels = check(game, z, what('the countdown'));
        expect(labels, z.name).toContain(t('g.next'));
        expect(labels, z.name).toContain(t('g.sluice'));
        const L = view.layout, n = sim.valley.n;
        expect(labels.filter(l => l.startsWith('cell')).length, z.name).toBeGreaterThan(n * 0.6);
        // Kumka at length
        sim.talk.line = { moment: 'idle', text: 'Kamienie czekają! Stuknij pole albo następny kamień, to pomogę. I jeszcze dłużej, żeby zawinęło.', t: 0.5, dur: 4 };
        play(game, clock, 0.4);
        check(game, z, what('Kumka talks'));
        // the water runs (Space: the stones go where they help, then the fast flow)
        for (let i = 0; i < 6; i++) sim.space();
        play(game, clock, 1.5);
        check(game, z, what('the water'));
        // a rest (the green dial), then a blind push
        sim.blockT = sim.block.dur;
        play(game, clock, 0.2, resting());
        expect(sim.restBlock, z.name).toBe(true);
        check(game, z, what('a rest'));
        // the Sela's breath guide is the game's own (ownBreath): big words, on the screen, never over the valley
        expect(mod.ownBreath).toBe(true);
        play(game, clock, 1, resting());
        expect(drawn.some(d => d.text === breathWords().in && d.px >= GUIDE_WORD_MIN - 4), what('the breath word')).toBe(true);
        const spot = view.breathSpot(sim)!;
        const gb = breathGuideBox(view.context, spot), V = L.view;
        expect(gb.x + gb.w <= V.x || gb.x >= V.x + V.w || gb.y + gb.h <= V.y || gb.y >= V.y + V.h, `${z.name}: ${what('the guide clear of the valley')}`).toBe(true);
        expect(gb.y, what('the guide under the HUD')).toBeGreaterThanOrEqual(z.insets.top - 1);
        expect(gb.y + gb.h, what('the guide over the home bar')).toBeLessThanOrEqual(z.h - z.insets.bottom + 1);
        expect(gb.x, what('the guide on the screen')).toBeGreaterThanOrEqual(0);
        expect(gb.x + gb.w, what('the guide on the screen')).toBeLessThanOrEqual(z.w);
        sim.blockT = sim.block.dur;
        play(game, clock, 0.2);
        sim.plan[sim.blockIndex].blind = true;
        expect(sim.blind, z.name).toBe(true);
        check(game, z, what('a blind push'));
        // the story cards: the targets are the card alone
        sim.story = { kind: 'tally', t: 2, dur: 6, v: 3, cells: 9, goal: 8, stars: 2, points: 140, loops: 1, blooms: 2, garden: false };
        expect(check(game, z, what('a tally card')), z.name).toEqual(['story']);
        sim.story = { kind: 'spill', t: 2, dur: 6, v: 3, cells: 4, goal: 8, short: 4, garden: false };
        check(game, z, what('a spill card'));
        sim.story = { kind: 'station', t: 2, dur: 6, station: 1 };
        check(game, z, what('a station card'));
        sim.story = { kind: 'open', t: 2, dur: 8 };
        check(game, z, what('the opening card'));
        sim.story = null;
        expect(L.cell, z.name).toBeGreaterThanOrEqual(MIN_TAP);
      }
    }
  });

  it('a finger on a cell shows the next stone there and lays it on the lift; slid to another cell it lays there; lifted off the valley, nothing', () => {
    const z = CHECK_SIZES[0];
    const { game, sim, view, clock } = gameAt(z);
    play(game, clock, 0.3);
    const L = view.layout, val = sim.valley;
    const free = [...Array(val.n).keys()].filter(i => val.canLay(i) && cellBox(L, i).shown?.w === L.cell);
    const a = cellBox(L, free[0]).full, b = cellBox(L, free[1]).full;
    const kind = sim.queue[0];
    game.pointer!({ type: 'down', x: a.x + a.w / 2, y: a.y + a.h / 2, id: 1 });
    expect(view.aim).toBe(free[0]);
    expect(val.cells[free[0]].type).toBe(EMPTY);
    game.pointer!({ type: 'move', x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 });
    expect(view.aim).toBe(free[1]);
    game.pointer!({ type: 'up', x: b.x + b.w / 2, y: b.y + b.h / 2, id: 1 });
    expect(view.aim).toBe(-1);
    expect(val.cells[free[1]].kind).toBe(kind);
    expect(val.cells[free[0]].type).toBe(EMPTY);
    // lifted off the valley: nothing laid
    const before = sim.queue.slice();
    const c = cellBox(L, free[2]).full;
    game.pointer!({ type: 'down', x: c.x + c.w / 2, y: c.y + c.h / 2, id: 2 });
    game.pointer!({ type: 'move', x: L.view.x + L.view.w / 2, y: L.next.y + L.next.h / 2, id: 2 });
    game.pointer!({ type: 'up', x: L.view.x + L.view.w / 2, y: L.next.y + L.next.h / 2, id: 2 });
    expect(sim.queue).toEqual(before);
    expect(val.cells[free[2]].type).toBe(EMPTY);
  });

  it("the next stone and the dial: pressed at the touch, Kumka's help on the lift; a thumb that slides off takes nothing", () => {
    const z = CHECK_SIZES[1];
    const { game, sim, view, clock } = gameAt(z);
    play(game, clock, 0.3);
    const L = view.layout, nx = L.next.x + L.next.w / 2, ny = L.next.y + L.next.h / 2;
    const laid = () => sim.valley.cells.filter(c => c.type === PIPE && !c.fixed).length;
    const n0 = laid();
    game.pointer!({ type: 'down', x: nx, y: ny, id: 1 });
    expect(view.pressed).toBe('next');
    expect(laid()).toBe(n0);
    game.pointer!({ type: 'up', x: nx, y: ny, id: 1 });
    expect(view.pressed).toBeNull();
    expect(laid()).toBe(n0 + 1);
    // slid off: nothing
    game.pointer!({ type: 'down', x: nx, y: ny, id: 2 });
    game.pointer!({ type: 'move', x: nx, y: ny - 80, id: 2 });
    expect(view.pressed).toBeNull();
    game.pointer!({ type: 'up', x: nx, y: ny - 80, id: 2 });
    expect(laid()).toBe(n0 + 1);
    // the dial does the same
    play(game, clock, 1);
    const g = L.dial;
    game.pointer!({ type: 'down', x: g.x + g.w / 2, y: g.y + g.h / 2, id: 3 });
    expect(view.pressed).toBe('dial');
    game.pointer!({ type: 'up', x: g.x + g.w / 2, y: g.y + g.h / 2, id: 3 });
    expect(laid()).toBe(n0 + 2);
  });

  it("the camera keeps the way's open end in the window where the valley pans (a 360 px phone, an eight-wide valley)", () => {
    const z = CHECK_SIZES[0];
    const { game, sim, view, clock } = gameAt(z, true, returning({ valley: 6 }));
    const L = view.layout;
    expect(L.panX).toBeGreaterThan(0);
    expect(L.panY).toBeGreaterThan(0);
    for (const [c, r] of [[0, 0], [sim.valley.cols - 1, sim.valley.rows - 1], [sim.valley.cols - 1, 0]] as const) {
      sim.wayEnd = { cell: sim.valley.idx(c, r), side: 0, kind: 'empty' };
      for (let i = 0; i < 60; i++) {
        clock.t += 1 / 30;
        view.update(1 / 30, sim);
      }
      const b = cellBox(L, sim.wayEnd.cell).shown;
      expect(b, `${c},${r}`).not.toBeNull();
      expect(b!.w, `${c},${r}`).toBeGreaterThanOrEqual(L.cell - 0.5);
      expect(b!.h, `${c},${r}`).toBeGreaterThanOrEqual(L.cell - 0.5);
    }
    void game;
  });

  it('speaks of the hand the player has: no keys on a touch screen, keys as shortcuts on a desktop', () => {
    const named = (s: string) => /Spac|Space|Leertaste|mellanslag|Enter|strzałk|Arrow|Pfeil|Pilar|klik|click|Klick/i.test(s);
    for (const k of ['how.tap', 'how.help', 'hint.tap', 'hint.space', 'hint.fast', 'hint.queue', 'hint.bomb', 'g.help.touch', 'g.fast.touch', 'say.idle.1', 'say.idle.2', 'say.idle.3'] as const) {
      for (const lang of LANGS) {
        const text = String(CATALOGS[lang][k]);
        expect(named(text), `${lang} ${k}: ${text}`).toBe(false);
        const desk = (CATALOGS[lang] as Record<string, unknown>)[`${k}.keys`];
        if (desk !== undefined) expect(named(String(desk)), `${lang} ${k}.keys: ${String(desk)}`).toBe(true);
      }
    }
    for (const lang of LANGS) expect(named(String(CATALOGS[lang]['how.space'])), lang).toBe(true);
    expect(hand('hint.space', true)).toBe(t('hint.space'));
    expect(hand('hint.space', false)).toBe(t('hint.space.keys'));
    expect(hand('hint.flow', false)).toBe(t('hint.flow'));
    const how = howto(true);
    expect(how.hands.map(h => h.gesture)).toEqual(['tap', 'tap', 'keys']);
    for (const h of how.hands.filter(x => x.gesture !== 'keys')) expect(named(h.text), h.text).toBe(false);
    // a mouse clicks (DESIGN §14): its how-to says so
    for (const h of howto(false).hands) expect(named(h.text), h.text).toBe(true);
  });
});

// ── a big screen (DESIGN §14) ──

describe('Źródła on a desktop and a big screen (DESIGN §14)', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return noteContext(this); }; });
  afterAll(() => { proto.getContext = original; });
  const monitors = CHECK_SIZES.filter(z => /monitor/.test(z.name));
  const GRIDS2 = [[7, 5], [8, 5], [8, 6], [8, 7]] as const;

  function gameAt(z: { w: number; h: number; insets: Insets }, touch: boolean, progress = returning()) {
    const env: GameEnv<ZrodlaProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress, rng: rng(5), day: '2026-11-13', daySeed: 7, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false,
      tuning: TUNING, hint: () => undefined, hudTop: () => z.insets.top, insets: () => z.insets, touch,
    };
    const game = mod.create(env);
    game.resize(z.w, z.h, 1);
    game.start();
    const inner = game as unknown as { sim: ZrodlaSim; view: ZrodlaView };
    const clock = { t: 0 };
    const step = (sec: number, f: FocusFrame = neutral()) => {
      for (let i = 0; i < Math.round(sec * 30); i++) { clock.t += 1 / 30; game.update(1 / 30, f, clock.t); game.draw(); }
    };
    return { game, env, sim: inner.sim, view: inner.view, step };
  }

  it('chooses its layout from the screen: a finger keeps the phone’s and the tablet’s, a mouse on a big screen gets its own', () => {
    for (const z of CHECK_SIZES) {
      const T = computeLayout(z.w, z.h, z.insets, 7, 5, true);
      expect(['phone', 'phone-side', 'tablet'], z.name).toContain(T.kind);
      expect(T.tk, z.name).toBe(Math.min(T.u, 1.15));
    }
    for (const z of monitors) expect(computeLayout(z.w, z.h, z.insets, 7, 5, false).kind, z.name).toBe('big');
  });

  it('fills a big monitor: a bigger valley with the dispenser and the dial hugging it, every target finger-sized and inside', () => {
    for (const z of monitors) {
      for (const [c, r] of GRIDS2) {
        const L = computeLayout(z.w, z.h, z.insets, c, r, false);
        const before = computeLayout(z.w, z.h, z.insets, c, r, true);
        const name = `${z.name} ${c}×${r}`, v = L.view;
        expect(L.u, name).toBeGreaterThan(1.3);
        expect(L.cell, name).toBeGreaterThanOrEqual(before.cell);
        expect(L.panX + L.panY, name).toBe(0);
        expect(v.y, name).toBeGreaterThanOrEqual(z.insets.top);
        expect(v.y + v.h + L.reeds.h, name).toBeLessThanOrEqual(z.h - z.insets.bottom);
        // the dispenser hugging the valley's left, its next stone level with the valley's foot
        const next = L.slots[0];
        expect(next.x + next.w, name).toBeLessThan(v.x);
        expect(v.x - (next.x + next.w), name).toBeLessThan(L.cell);
        expect(Math.abs(next.y + next.h - (v.y + v.h)), name).toBeLessThanOrEqual(1);
        for (const sl of L.slots.slice(1)) expect(sl.y + sl.h, name).toBeLessThan(next.y);
        // the dial (grown with the UI) right of the valley, level with its top
        expect(L.gauge.x - L.gauge.r, name).toBeGreaterThan(v.x + v.w);
        expect(L.gauge.r, name).toBeGreaterThanOrEqual(66);
        expect(L.dial.y, name).toBeGreaterThanOrEqual(v.y - 1);
        expect(auditTargets([target('next', L.next), target('dial', L.dial)], z.w, z.h, z.insets), name).toEqual([]);
      }
      // the valley 7 × 5 grows (679 → 770+ px on Full HD)
      expect(computeLayout(z.w, z.h, z.insets, 7, 5, false).board.w, z.name).toBeGreaterThan(computeLayout(z.w, z.h, z.insets, 7, 5, true).board.w * 1.1);
    }
  });

  it('plays a big monitor with a mouse: targets pass, no word under 11 px, the goal and Kumka grown past an iPhone’s', () => {
    const sizeOf = (z: { w: number; h: number; insets: Insets }, touch: boolean, pick: (s: string) => boolean) => {
      const { sim, step } = gameAt(z, touch);
      drawn.length = 0;
      sim.talk.line = { moment: 'idle', text: t('say.idle.1'), t: 0.5, dur: 4 };
      step(0.6);
      for (let i = 0; i < 4; i++) sim.space();
      step(1);
      return { max: Math.max(0, ...drawn.filter(d => pick(d.text)).map(d => d.px)), all: drawn.slice() };
    };
    const goal = (s: string) => s.startsWith(t('g.goal'));
    const phone = sizeOf(CHECK_SIZES[1], true, goal).max;
    for (const z of monitors) {
      const { game, sim, step } = gameAt(z, false);
      step(0.5);
      expect(auditTargets(game.targets!(), z.w, z.h, z.insets), z.name).toEqual([]);
      sim.story = { kind: 'open', t: 2, dur: 8 };
      drawn.length = 0;
      game.draw();
      expect(game.targets!().map(x => x.label), z.name).toEqual(['story']);
      expect(auditTargets(game.targets!(), z.w, z.h, z.insets), z.name).toEqual([]);
      expect(drawn.some(d => d.text === t('card.tap.keys')) || drawn.length > 0, z.name).toBe(true);
      sim.story = null;
      const got = sizeOf(z, false, goal);
      expect(got.all.filter(d => d.px < MIN_TEXT - 1e-6), z.name).toEqual([]);
      expect(got.max, z.name).toBeGreaterThanOrEqual(phone * 1.3);
    }
  });

  it('answers a resting mouse: the next stone in the cell under it (gold where it goes, rose where not), a click lays it, the cursor tells', () => {
    for (const z of monitors) {
      const { game, env, sim, view, step } = gameAt(z, false);
      step(0.3);
      const L = view.layout, val = sim.valley;
      const free = Array.from({ length: val.n }, (_, i) => i).find(i => val.canLay(i))!;
      const blocked = Array.from({ length: val.n }, (_, i) => i).find(i => !val.canLay(i));
      const at = (i: number) => ({ x: L.board.x + ((i % L.cols) + 0.5) * L.cell, y: L.board.y + (Math.floor(i / L.cols) + 0.5) * L.cell });
      game.pointer!({ type: 'move', ...at(free), id: 1 });
      expect(view.aim, z.name).toBe(free);
      expect(view.holding, z.name).toBe(false);
      expect(env.canvas.style.cursor, z.name).toBe('pointer');
      if (blocked !== undefined) {
        game.pointer!({ type: 'move', ...at(blocked), id: 1 });
        expect(view.aim, z.name).toBe(blocked);
        expect(env.canvas.style.cursor, z.name).toBe('not-allowed');
      }
      // a click lays the next stone where the cursor rests
      const before = sim.queue[0];
      game.pointer!({ type: 'move', ...at(free), id: 1 });
      game.pointer!({ type: 'down', ...at(free), id: 1 });
      game.pointer!({ type: 'up', ...at(free), id: 1 });
      expect(val.cells[free].type, z.name).toBe(PIPE);
      expect(sim.queue[0] === before && val.cells[free].type !== PIPE, z.name).toBe(false);
      // the next stone: a pointer (Kumka's help); off everything: the plain arrow; a pause gives the page its cursor
      game.pointer!({ type: 'move', x: L.next.x + L.next.w / 2, y: L.next.y + L.next.h / 2, id: 1 });
      expect(env.canvas.style.cursor, z.name).toBe('pointer');
      game.pointer!({ type: 'move', x: 2, y: z.h - 2, id: 1 });
      expect(env.canvas.style.cursor, z.name).toBe('default');
      game.pause!(true);
      expect(env.canvas.style.cursor, z.name).toBe('');
    }
  });

  it('speaks of clicking to a mouse, in every language, and keeps Kumka hand-neutral', () => {
    const CLICK = /klik|click|klick/i;
    for (const lang of LANGS) {
      const cat = CATALOGS[lang] as Record<string, unknown>;
      for (const k of ['card.tap.keys', 'hint.tap.keys', 'how.tap.keys', 'how.help.keys']) expect(cat[k], `${lang}.${k}`).toMatch(CLICK);
      for (const k of ['say.warm.1', 'say.idle.1', 'say.idle.3']) expect(String(cat[k]), `${lang}.${k}`).not.toMatch(/stuk|tap\b|tipp|tryck|klik|click|klick/i);
    }
    expect(hand('card.tap', false)).toBe(t('card.tap.keys'));
    expect(hand('card.tap', true)).toBe(t('card.tap'));
  });
});

// ── long sessions (15–30 min) ───────────────────────────────────

describe('Źródła at 15–30 minutes', () => {
  it('plans 900–1800 s to the end: push/rest pairs at their design lengths, ending on a Sela', () => {
    for (const sec of [900, 1200, 1500, 1800]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, rng(sec));
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec, 5);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
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

  it('walks a whole 30-min session: valleys keep coming past the stations, the summary stays short, it ends', () => {
    for (const progress of [freshProgress(), returning({ valley: 55 })]) {
      const sim = newSim({ progress, plannedSec: 1800, seed: 8 });
      sim.start();
      let evs = 0, valleys = 0, lastSpace = -1, maxSegs = 0;
      const dt = 0.1;
      for (let t = 0; t < 1800 + 1e-9; t += dt) {
        if (t - lastSpace >= 0.5) { lastSpace = t; sim.space(); }
        sim.update(dt, sim.restBlock ? resting() : focusing(), t + dt);
        for (const e of sim.take()) { evs++; if (e.type === 'valley') valleys++; }
        maxSegs = Math.max(maxSegs, sim.segs.length);
      }
      expect(sim.ended).toBe(true);
      expect(evs).toBeGreaterThan(500);
      expect(valleys).toBeGreaterThan(40);   // a valley every half minute or so, won or tried again
      if (progress.valley === 0) expect(sim.valleysWon).toBeGreaterThan(8);
      expect(maxSegs).toBeLessThan(200);
      expect(Number.isFinite(sim.score)).toBe(true);
      expect(sim.trace.samples.length).toBeLessThan(400);
      const r = sim.result();
      expect(r.highlights.length).toBeLessThanOrEqual(10);
      for (const s of [...r.highlights, ...r.stats.flat(), sim.headlineSub()]) expect(s).not.toMatch(/undefined|NaN|Infinity/);
    }
  });
});
