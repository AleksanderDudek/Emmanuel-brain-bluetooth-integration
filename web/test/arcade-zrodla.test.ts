import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type FocusFrame } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { LINES, MOMENTS, STATIONS, TIPS } from '../src/arcade/zrodla/content';
import {
  EMPTY, GARDEN, KINDS, MASK, PIPE, ROCK, SPRING, Valley, autoSpot, bit, channelOf, deal, exitOf, makeValley, opp, seeded, specOf, type Kind,
} from '../src/arcade/zrodla/grid';
import { CATALOGS, t, unit } from '../src/arcade/zrodla/i18n';
import { bestOf, freshProgress, migrate, recordValley, type ZrodlaProgress } from '../src/arcade/zrodla/meta';
import { RULES, cellSecOf, countdownOf, goalOf, gridOf, isGarden, paceOf, starsFor } from '../src/arcade/zrodla/rules';
import { ZrodlaSim, planBlocks, type ZrodlaEvent } from '../src/arcade/zrodla/sim';
import { catalogProblems, LANGS } from '../src/i18n';
import mod from '../src/arcade/zrodla/index';

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
    const ev = run(sim, 18, resting);
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
