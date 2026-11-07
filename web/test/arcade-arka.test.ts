import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { boardFor, cloneBoard, firstBoard, generate, gridOf, solve, wayOut, type BoardSpec } from '../src/arcade/arka/board';
import { FIRST_OF, KINDS, STAGES, kindsAt, levelSpec } from '../src/arcade/arka/content';
import { CATALOGS, t, unit } from '../src/arcade/arka/i18n';
import { cellAt, cellCentre, layout, sightRadius } from '../src/arcade/arka/layout';
import { clearLevel, freshProgress, homestead, migrate, settle, totalStars, type ArkaProgress } from '../src/arcade/arka/meta';
import { RULES, parFor, sightShare, starsFor } from '../src/arcade/arka/rules';
import { ArkaSim, planBlocks, type SimEvent } from '../src/arcade/arka/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });
const FOCUS = frame({ activity: 8, level: 0.92, focused: true, hold: 20, calm: 0.05 });
const REST = frame({ activity: -4, level: 0.08, calm: 0.95 });
const NOSIG = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

type SimOpts = { progress?: Partial<ArkaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ArkaSim {
  const sim = new ArkaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player at level `level` (the tutorial's marks shown already). */
function returning(level = 6, o: SimOpts = {}): ArkaSim {
  return makeSim({ ...o, progress: { sessions: 5, level, taught: ['tap', 'bump', 'hearts', 'pair', 'dove', 'mist', 'rainbow', 'file', 'sleepy', 'turner', 'locked'], ...o.progress } });
}

function drive(sim: ArkaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    const t = sim.now + STEP;
    sim.update(STEP, typeof f === 'function' ? f(t) : f, t);
    each?.(t);
    out.push(...sim.take());
  }
  return out;
}

/** Let the board drop in. */
const ready = (sim: ArkaSim) => drive(sim, RULES.dropSec + 0.05, frame());

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

const blockedOne = (sim: ArkaSim) => sim.animals.find(a => !a.out && !a.asleep && a.lockedBy < 0 && sim.way(a).blocker >= 0)!;
const freeOne = (sim: ArkaSim) => sim.animals.find(a => !a.out && !a.asleep && a.lockedBy < 0 && sim.way(a).blocker < 0)!;

describe('the boards: solvable by construction', () => {
  it('finds the way out: free cells to the edge, or the first animal in the way', () => {
    const b = firstBoard();
    const g = gridOf(b);
    expect(wayOut(g, b.cols, b.rows, b.pieces[0].cells[0], 0, 0)).toEqual({ dist: 1, blocker: -1 });
    expect(wayOut(g, b.cols, b.rows, b.pieces[1].cells[0], 0, 1)).toEqual({ dist: 0, blocker: 0 });
  });

  it('solves every level from 1 to 60, with an even number of animals, two (or four, …) of every kind', () => {
    for (let n = 1; n <= 60; n++) {
      const b = boardFor(n);
      expect(solve(cloneBoard(b)), `level ${n}`).not.toBeNull();
      expect(b.pieces.length % 2).toBe(0);
      const count: Record<string, number> = {};
      for (const p of b.pieces) count[p.kind] = (count[p.kind] ?? 0) + 1;
      for (const c of Object.values(count)) expect(c % 2).toBe(0);
      // cells are on the board, no two animals share one, files are connected and never in their leader's way
      const seen = new Set<string>();
      for (const p of b.pieces) {
        p.cells.forEach((c, i) => {
          expect(c.x >= 0 && c.y >= 0 && c.x < b.cols && c.y < b.rows).toBe(true);
          const k = `${c.x},${c.y}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
          if (i > 0) expect(Math.abs(c.x - p.cells[i - 1].x) + Math.abs(c.y - p.cells[i - 1].y)).toBe(1);
        });
      }
    }
  });

  it('is the same board for the same level, and a filled one: most of the asked animals', () => {
    expect(boardFor(9)).toEqual(boardFor(9));
    for (const n of [3, 8, 15, 25, 40]) {
      const spec = levelSpec(n);
      expect(boardFor(n).pieces.length).toBeGreaterThanOrEqual(Math.min(spec.animals, 4) );
      expect(boardFor(n).pieces.length).toBeGreaterThanOrEqual(spec.animals * 0.6);
    }
  });

  it('starts with blocked animals: the puzzle is to find the free ones', () => {
    for (const n of [6, 12, 20]) {
      const b = boardFor(n);
      const g = gridOf(b);
      const blocked = b.pieces.filter((p, i) => wayOut(g, b.cols, b.rows, p.cells[0], p.dir, i).blocker >= 0).length;
      expect(blocked / b.pieces.length).toBeGreaterThan(0.2);
    }
  });

  it('grows the boards and brings files, sleepers, turning goats and pens at their levels; peaks then breathers', () => {
    expect(levelSpec(1).cols * levelSpec(1).rows).toBeLessThan(levelSpec(30).cols * levelSpec(30).rows);
    expect(levelSpec(40).cols).toBeLessThanOrEqual(9);
    expect(levelSpec(40).rows).toBeLessThanOrEqual(11);
    expect(levelSpec(FIRST_OF.file - 1).files).toBe(0);
    expect(levelSpec(FIRST_OF.file).files).toBeGreaterThan(0);
    expect(levelSpec(FIRST_OF.sleepy).sleepy).toBeGreaterThan(0);
    expect(levelSpec(FIRST_OF.turner).turners).toBeGreaterThan(0);
    expect(levelSpec(FIRST_OF.locked + 1).locks).toBeGreaterThan(0);
    expect(levelSpec(10).mood).toBe('big');
    expect(levelSpec(11).mood).toBe('easy');
    expect(levelSpec(11).animals).toBeLessThan(levelSpec(10).animals);
    expect(boardFor(14).pieces.some(p => p.cells.length > 1)).toBe(true);
    expect(boardFor(13).pieces.some(p => p.lockedBy >= 0) || boardFor(14).pieces.some(p => p.lockedBy >= 0)).toBe(true);
  });

  it('puts a pen\'s key on an animal that can leave before it', () => {
    for (let n = 11; n <= 40; n++) {
      const b = boardFor(n);
      const order = solve(cloneBoard(b))!;
      b.pieces.forEach((p, i) => {
        if (p.lockedBy >= 0) expect(order.indexOf(p.lockedBy)).toBeLessThan(order.indexOf(i));
      });
    }
  });

  it('falls back to a board without turning goats or pens when a spec cannot be met', () => {
    const b = generate({ ...levelSpec(20), cols: 3, rows: 3, animals: 8, turners: 3, locks: 3 }, 7);
    expect(solve(cloneBoard(b))).not.toBeNull();
  });

  it('brings three kinds at first and one more every second level', () => {
    expect(kindsAt(1)).toBe(3);
    expect(kindsAt(3)).toBe(4);
    expect(kindsAt(40)).toBe(KINDS.length);
  });
});

describe('the deck: tap, slide, bump, hearts', () => {
  it('slides a free animal out and frees its cells; a pair forms when the second of a kind comes down', () => {
    const sim = returning(2);
    ready(sim);
    const a = freeOne(sim);
    expect(sim.tap(a.id)).toBe(true);
    const evs = sim.take();
    expect(ofType(evs, 'send')).toHaveLength(1);
    expect(a.out).toBe(true);
    expect(sim.animalAt(a.cells[0].x, a.cells[0].y)).toBeNull();
    expect(sim.shore).toContain(a.kind);
    // send its mate when it is free (any order of free animals clears the board)
    let guard = 0;
    while (!sim.animals.filter(b => b.kind === a.kind).every(b => b.out) && guard++ < 50) {
      const mate = sim.animals.find(b => !b.out && b.kind === a.kind && sim.freeIds().includes(b.id));
      const id = mate ? mate.id : sim.freeIds()[0];
      if (sim.animals[id].asleep) sim.tap(id);
      sim.tap(id);
    }
    expect(sim.pairs).toBeGreaterThanOrEqual(1);
  });

  it('bumps a blocked animal into the one in its way: a heart goes, the deck stays as it was', () => {
    const sim = returning(6);
    ready(sim);
    const a = blockedOne(sim);
    const before = sim.animals.map(x => ({ ...x.cells[0] }));
    sim.tap(a.id);
    const bump = ofType(sim.take(), 'bump')[0];
    expect(bump.blocker).toBe(sim.way(a).blocker);
    expect(bump.lost).toBe(true);
    expect(sim.hearts).toBe(RULES.hearts - 1);
    expect(sim.chain).toBe(0);
    expect(sim.animals.map(x => ({ ...x.cells[0] }))).toEqual(before);
  });

  it('charges no second heart for the same animal tapped again within 1.4 s', () => {
    const sim = returning(6);
    ready(sim);
    const a = blockedOne(sim);
    sim.tap(a.id);
    drive(sim, 0.5, frame());
    sim.tap(a.id);
    expect(sim.hearts).toBe(RULES.hearts - 1);
    drive(sim, 1.5, frame());
    sim.tap(a.id);
    expect(sim.hearts).toBe(RULES.hearts - 2);
  });

  it('restarts the board gently with no hearts left; the pairs already out stay counted', () => {
    const sim = returning(6);
    ready(sim);
    // a pair first
    let guard = 0;
    while (sim.pairs === 0 && guard++ < 40) sim.dove() || drive(sim, RULES.doveRest + 0.1, frame());
    const pairs = sim.pairs;
    expect(pairs).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) {
      const b = blockedOne(sim);
      sim.tap(b.id);
      drive(sim, RULES.bumpGrace + 0.1, frame());
    }
    expect(sim.levelState === 'restart' || sim.restarts === 1).toBe(true);
    drive(sim, RULES.restartSec + RULES.dropSec + 0.2, frame());
    expect(sim.restarts).toBe(1);
    expect(sim.hearts).toBe(RULES.hearts);
    expect(sim.animals.every(a => !a.out)).toBe(true);
    expect(sim.pairs).toBe(pairs);
    expect(sim.levelN).toBe(6);
  });

  it('lets the tutorial\'s first board cost no heart', () => {
    const sim = makeSim();
    ready(sim);
    expect(sim.levelN).toBe(1);
    sim.tap(1);   // the goat behind the sheep
    const bump = ofType(sim.take(), 'bump')[0];
    expect(bump.lost).toBe(false);
    expect(sim.hearts).toBe(RULES.hearts);
  });

  it('wakes a sleeper at the first tap and sends it at the second; rattles a closed pen; turns the goats', () => {
    const sim = returning(17);
    ready(sim);
    const sleeper = sim.animals.find(a => a.asleep && a.lockedBy < 0);
    if (sleeper) {
      sim.tap(sleeper.id);
      expect(ofType(sim.take(), 'wake')).toHaveLength(1);
      expect(sleeper.asleep).toBe(false);
      expect(sim.hearts).toBe(RULES.hearts);
    }
    const pen = sim.animals.find(a => a.lockedBy >= 0);
    if (pen) {
      sim.tap(pen.id);
      expect(ofType(sim.take(), 'locked')).toHaveLength(1);
      expect(sim.hearts).toBe(RULES.hearts);
    }
    const goat = sim.animals.find(a => a.turner);
    expect(goat).toBeTruthy();
    const d = goat!.dir;
    const other = sim.freeIds().find(id => id !== goat!.id)!;
    if (sim.animals[other].asleep) sim.tap(other);
    sim.tap(other);
    expect(goat!.dir).toBe((d + 1) % 4);
  });

  it('opens a pen when the animal with its key leaves', () => {
    let sim: ArkaSim | null = null;
    for (const n of [12, 13, 14, 15, 17, 18, 19]) {
      const s = returning(n);
      if (s.animals.some(a => a.lockedBy >= 0)) { sim = s; break; }
    }
    expect(sim).not.toBeNull();
    ready(sim!);
    const pen = sim!.animals.find(a => a.lockedBy >= 0)!;
    const key = sim!.animals[pen.lockedBy];
    let guard = 0, opened = false;
    while (!key.out && guard++ < 80) {
      sim!.dove() || drive(sim!, RULES.doveRest + 0.05, frame());
      if (ofType(sim!.take(), 'unlock').some(e => e.id === pen.id)) opened = true;
    }
    expect(key.out).toBe(true);
    expect(opened || pen.out).toBe(true);
  });

  it('clears a board: ★★★ clean and quick, ★★ with a bump or the dove, ★ with two bumps; the saga moves on', () => {
    expect(starsFor(0, 0, 10, 20)).toBe(3);
    expect(starsFor(0, 1, 10, 20)).toBe(2);
    expect(starsFor(0, 0, 30, 20)).toBe(2);
    expect(starsFor(1, 0, 10, 20)).toBe(2);
    expect(starsFor(2, 0, 10, 20)).toBe(1);
    const sim = returning(3);
    ready(sim);
    let guard = 0;
    const evs: SimEvent[] = [];
    while (sim.levelState !== 'clear' && guard++ < 100) {
      const id = sim.bestMove(false);
      if (sim.animals[id].asleep) sim.tap(id);
      sim.tap(id);
      evs.push(...sim.take());
    }
    const clear = ofType(evs, 'clear')[0];
    expect(clear.stars).toBe(3);
    expect(sim.p.level).toBe(4);
    expect(sim.p.stars[2]).toBe(3);
    drive(sim, RULES.clearSec + 0.1, frame());
    expect(sim.levelN).toBe(4);
  });

  it('counts mates sent back to back as "Parami!"', () => {
    const sim = makeSim({ progress: { sessions: 3, level: 1, taught: ['tap'] } });
    ready(sim);
    // the first board: sheep 0 (free), goat 1 behind it, goat 2 free, sheep 3 free
    sim.tap(0);
    sim.tap(3);
    const pair = ofType(sim.take(), 'pair')[0];
    expect(pair.kind).toBe('sheep');
    expect(pair.bonus).toBe(true);
    sim.tap(2);
    sim.tap(1);
    expect(sim.bonus).toBe(2);
    expect(sim.pairs).toBe(2);
  });

  it('lets the dove show and send a free animal, a waiting mate first, then rest 4 s; it costs the third star', () => {
    const sim = returning(5);
    ready(sim);
    expect(sim.dove()).toBe(true);
    const first = ofType(sim.take(), 'send')[0];
    expect(first.dove).toBe(true);
    expect(sim.dove()).toBe(false);
    expect(ofType(sim.take(), 'doveBusy')).toHaveLength(1);
    drive(sim, RULES.doveRest + 0.05, frame());
    const want = sim.bestMove(false);
    if (sim.freeIds().some(id => sim.animals[id].kind === first.kind)) expect(sim.animals[want].kind).toBe(first.kind);
    expect(sim.doves).toBe(1);
  });

  it('moves the keyboard cursor and sends the animal under it with Enter', () => {
    const sim = makeSim({ progress: { sessions: 2, level: 1, taught: ['tap'] } });
    ready(sim);
    sim.cursor = { x: 1, y: 1 };
    sim.moveCursor(0, 1);
    expect(sim.cursor).toEqual({ x: 1, y: 2 });
    sim.moveCursor(0, -1);
    sim.sendCursor();
    expect(sim.animals[0].out).toBe(true);
  });
});

describe('the band: the mist by focus, the rainbow by calm', () => {
  const pushOf = (sim: ArkaSim) => {
    // run until the first push block, past its lead-in
    let guard = 0;
    while (sim.block.kind !== 'push' && guard++ < 6000) drive(sim, 0.1, frame());
  };

  it('widens the clear circle with focus after the lead-in, and holds it at the threshold without signal', () => {
    const sim = returning(6);
    pushOf(sim);
    drive(sim, 2, FOCUS);
    expect(sim.sight).toBeCloseTo(0.5, 1);   // still the lead-in
    drive(sim, sim.leadIn + 2, FOCUS);
    expect(sim.sight).toBeGreaterThan(0.85);
    expect(sim.meter()).toBeGreaterThan(0.85);
    expect(sim.mist).toBeGreaterThan(0.9);
    drive(sim, 4, NOSIG);
    expect(sim.sight).toBeCloseTo(0.5, 1);
    expect(sim.meter()).toBeNull();
  });

  it('says "sun" once the circle crosses the threshold', () => {
    const sim = returning(6);
    pushOf(sim);
    const evs = drive(sim, sim.leadIn + 3, FOCUS);
    expect(ofType(evs, 'sun')).toHaveLength(1);
  });

  it('fills the rainbow with calm in a rest block: a heart back and a safe move lit', () => {
    const sim = returning(6);
    let guard = 0;
    while (sim.block.kind !== 'rest' && guard++ < 6000) drive(sim, 0.1, frame());
    ready(sim);
    const a = blockedOne(sim);
    sim.tap(a.id);
    expect(sim.hearts).toBe(2);
    const evs = drive(sim, sim.leadIn + RULES.rainbowSec + 1, REST);
    const rb = ofType(evs, 'rainbow');
    expect(rb.length).toBeGreaterThanOrEqual(1);
    expect(rb[0].heart).toBe(true);
    expect(sim.hearts).toBeGreaterThanOrEqual(3);
    expect(rb[0].shine).toBeGreaterThanOrEqual(0);
    expect(sim.meter()).toBeGreaterThan(0.8);
  });

  it('gives no rainbow without signal, and loses nothing either', () => {
    const sim = returning(6);
    let guard = 0;
    while (sim.block.kind !== 'rest' && guard++ < 6000) drive(sim, 0.1, frame());
    const evs = drive(sim, 12, NOSIG);
    expect(ofType(evs, 'rainbow')).toHaveLength(0);
    expect(sim.hearts).toBe(RULES.hearts);
  });

  it('lets the pad follow the level only in a sighted Mgła', () => {
    const sim = returning(6);
    expect(sim.padLevel(FOCUS)).toBeNull();
    pushOf(sim);
    drive(sim, sim.leadIn + 0.5, FOCUS);
    expect(sim.padLevel(FOCUS)).toBe(FOCUS.level);
  });

  it('judges each block once at its end and reports blind blocks only then', () => {
    const sim = returning(6, { progress: { sessions: 5, pushes: 2 } });
    const evs = drive(sim, 300, () => (sim.block.kind === 'push' ? FOCUS : REST));
    const ends = ofType(evs, 'blockEnd').filter(e => e.block.kind !== 'warmup');
    expect(ends.length).toBeGreaterThanOrEqual(4);
    expect(ends.filter(e => e.block.kind === 'push').every(e => e.verdict === true)).toBe(true);
    expect(ends.filter(e => e.block.kind === 'rest').every(e => e.verdict === true)).toBe(true);
    const blind = sim.plan.filter(b => b.kind === 'push' && b.blind);
    expect(blind.length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'blindReveal').length).toBe(blind.length);
    expect(sim.blockContrast).toBeGreaterThan(0);
  });

  it('never makes the first Mgła of a session blind, and none before the 3rd session', () => {
    const early = returning(6, { progress: { sessions: 1, pushes: 3 } });
    drive(early, 300, frame());
    expect(early.plan.some(b => b.blind)).toBe(false);
    const later = returning(6, { progress: { sessions: 5, pushes: 3 } });
    drive(later, 300, frame());
    expect(later.plan.find(b => b.kind === 'push')!.blind).toBe(false);
  });
});

describe('the session plan', () => {
  it('fits any length ≥ 10 s, ends with a rest, telegraphs and keeps blocks ≥ 12 s from 3 minutes', () => {
    for (const sec of [10, 40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(3));
        const total = plan.reduce((s, b) => s + b.dur, 0);
        expect(total).toBeCloseTo(Math.max(4, sec - RULES.finale), 0);
        expect(plan[plan.length - 1].kind).toBe('rest');
        if (sec >= 180) for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      }
    }
    expect(planBlocks(300, true, mulberry32(1))[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
  });

  it('telegraphs each block 4 s ahead and names the next one for the panel', () => {
    const sim = returning(6, { planned: 180 });
    const first = sim.block;
    drive(sim, first.dur - RULES.telegraph + 0.1, frame());
    expect(sim.nextBlock).toBe(sim.plan[1]);
    expect(sim.blockLeft).toBeLessThan(RULES.telegraph);
  });

  it('opens the first-ever session on the tutorial\'s board with its coach marks, one at a time', () => {
    const sim = makeSim();
    expect(sim.levelN).toBe(1);
    expect(sim.block.kind).toBe('warmup');
    const evs = drive(sim, 6, frame());
    const coach = ofType(evs, 'coach');
    expect(coach[0].key).toBe('tap');
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap on the deck's middle cell every 0.65 s, Space every ~2 s, focus on. */
  function smoke(sim: ArkaSim, sec: number): void {
    let nextTap = 0.65, nextSpace = 2;
    drive(sim, sec, FOCUS, t => {
      if (t >= nextTap) {
        nextTap += 0.65;
        const L = layout(1280, 620, 140, sim.board.cols, sim.board.rows);
        const c = cellAt(L, 640, 620 * 0.6);
        if (c) sim.tapCell(c.x, c.y); else if (sim.levelState === 'clear') sim.skip();
      }
      if (t >= nextSpace) {
        nextSpace += 2;
        sim.dove();
      }
    });
  }

  it('scores within 22 s of a 40 s first session, on both bands', () => {
    for (const eeg of [false, true]) {
      const sim = makeSim({ planned: 40, eeg, tuning: { ...TUNING, ...BEGINNER_TUNING } });
      smoke(sim, 22);
      expect(sim.pairs).toBeGreaterThan(0);
      expect(sim.headline().value).toBe(sim.pairs);
      expect(sim.result().score).toBe(sim.pairs);
    }
  });

  it('keeps scoring for a returning player deep in the saga', () => {
    const sim = returning(24, { planned: 40 });
    smoke(sim, 22);
    expect(sim.pairs).toBeGreaterThan(0);
  });
});

describe('the meta, the result and the texts', () => {
  it('result() is idempotent: records with Math.max', () => {
    const sim = makeSim({ planned: 40 });
    drive(sim, 4, frame());
    sim.dove();
    sim.dove();
    drive(sim, 5, frame());
    sim.dove();
    const a = sim.result();
    const p1 = JSON.stringify(sim.p);
    const b = sim.result();
    expect(b).toEqual(a);
    expect(JSON.stringify(sim.p)).toBe(p1);
    expect(sim.p.sessions).toBe(1);
  });

  it('migrates an old v1 save in place: the best session and the sessions stay, the rest starts fresh', () => {
    const old = {
      v: 1, sessions: 7, pairs: 52, bestSession: 14, bestByLen: { 300: 14 }, bestChain: 'x', bestStars: 3, bestPlanks: 4,
      settled: { sheep: 'lots' }, young: 'sheep', home: 30, olives: 2, leaves: 1, evenings: 9, dry: 0, days: 11,
      dailyDay: '2026-10-30', dailyStars: 2, dailySec: 80, giftDay: '2026-10-30', lastDay: '2026-10-30',
    };
    const p = migrate({ ...freshProgress(), ...old } as unknown as ArkaProgress);
    expect(p.ver).toBe(2);
    expect(p.bestSession).toBe(14);
    expect(p.sessions).toBe(7);
    expect(p.level).toBe(1);
    expect(p.settled).toEqual({});
    expect(p.young).toEqual([]);
    expect((p as unknown as Record<string, unknown>).leaves).toBeUndefined();
    // and the game runs on it
    const sim = new ArkaSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 3, frame());
    expect(sim.result().score).toBe(0);
  });

  it('repairs a v2 save with fields of the wrong type', () => {
    const p = migrate({ ...freshProgress(), level: 'nine', stars: [3, 'x', 2], settled: { sheep: 2, goat: 'y' }, taught: 'tap' } as unknown as ArkaProgress);
    expect(p.level).toBe(1);
    expect(p.stars).toEqual([3, 2]);
    expect(p.settled).toEqual({ sheep: 2 });
    expect(p.taught).toEqual([]);
  });

  it('keeps every level\'s best stars and moves the saga only from its frontier', () => {
    const p = freshProgress();
    expect(clearLevel(p, 1, 2)).toEqual({ gained: 2, advanced: true });
    expect(clearLevel(p, 1, 3)).toEqual({ gained: 1, advanced: false });
    expect(clearLevel(p, 1, 1).gained).toBe(0);
    expect(p.level).toBe(2);
    expect(totalStars(p)).toBe(3);
    expect(homestead(STAGES[0].at).built).toBe(1);
    expect(settle(p, 'sheep')).toBe(false);
    settle(p, 'sheep');
    expect(settle(p, 'sheep')).toBe(true);
    expect(p.young).toEqual(['sheep']);
  });

  it('closes with a passage that fits: mercies new after a restart, a rainbow, the dove, a new kind', () => {
    const sim = makeSim({ planned: 40 });
    drive(sim, 2, frame());
    sim.dove();
    const v = sim.result().verse!;
    expect(['gen8.17', 'gen8.11', 'gen9.13', 'psa36.6', 'lam3.22-23']).toContain(v);
    expect(passage(v).text.length).toBeGreaterThan(10);
  });

  it('bends the headline\'s unit: 1 para, 2–4 pary, 5+ par', () => {
    expect(unit(1)).toBe('para');
    expect(unit(3)).toBe('pary');
    expect(unit(5)).toBe('par');
    expect(unit(22)).toBe('pary');
  });

  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('keeps the raven\'s lines under 90 characters and the tips free of "harder"', () => {
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) {
        if (k.startsWith('say.')) expect((v as string).length, k).toBeLessThanOrEqual(90);
        if (k.startsWith('tip.')) expect(v as string).not.toMatch(/mocniej|harder|stärker/i);
      }
    }
  });

  it('never types a verse: the catalog holds no passage\'s words', () => {
    const all = JSON.stringify(CATALOGS);
    for (const id of ['gen8.1', 'gen8.11', 'gen8.17', 'gen9.13', 'psa36.6', 'lam3.22-23'] as const) {
      const words = passage(id).text.split(/\s+/).slice(0, 6).join(' ');
      expect(all.includes(words)).toBe(false);
    }
    expect(t('sub.level', { have: 1, all: 4 })).toBe('Ten pokład: 1/4');
  });
});

describe('the layout', () => {
  const screens: [number, number, number][] = [[1280, 618, 136], [1280, 672, 190], [390, 640, 124], [844, 300, 120], [768, 900, 136], [1024, 600, 190]];

  it('keeps the deck below the HUD band and above the new land, on every screen and board size', () => {
    for (const [w, h, top] of screens) {
      for (const n of [1, 6, 20, 40]) {
        const b: BoardSpec = boardFor(n);
        const L = layout(w, h, top, b.cols, b.rows);
        if (L.wide) {
          // the middle column: clear of the panel (left ~350 px) and the score (right ~140 px)
          expect(L.deck.x).toBeGreaterThanOrEqual(Math.min(352, w * 0.3));
          expect(L.deck.x + L.deck.w).toBeLessThanOrEqual(w - 140);
          expect(L.bar.x).toBeGreaterThanOrEqual(Math.min(352, w * 0.3));
          expect(L.deck.y).toBeGreaterThanOrEqual(L.bar.y + L.bar.h);
          expect(L.deck.y + L.deck.h).toBeLessThanOrEqual(L.shore.y + 1);
          continue;
        }
        expect(L.bar.y).toBeGreaterThanOrEqual(Math.min(top, h * 0.45));
        if (L.compact) {
          // beside the panel's column: the deck starts right of the bar and the new land
          expect(L.deck.x).toBeGreaterThanOrEqual(L.bar.x + L.bar.w);
          expect(L.deck.x).toBeGreaterThanOrEqual(L.shore.x + L.shore.w);
          expect(L.deck.y + L.deck.h).toBeLessThanOrEqual(h);
        } else {
          expect(L.deck.y).toBeGreaterThanOrEqual(L.bar.y + L.bar.h);
          expect(L.deck.y + L.deck.h).toBeLessThanOrEqual(L.shore.y + 1);
        }
        expect(L.deck.x).toBeGreaterThanOrEqual(0);
        expect(L.deck.x + L.deck.w).toBeLessThanOrEqual(w);
        const c = cellCentre(L, b.cols - 1, b.rows - 1);
        expect(cellAt(L, c.x, c.y)).toEqual({ x: b.cols - 1, y: b.rows - 1 });
      }
    }
  });

  it('gives a 390 px phone held upright cells of 36 px or more on the biggest boards', () => {
    const L = layout(390, 640, 124, 9, 11);
    expect(L.cell).toBeGreaterThanOrEqual(36);
  });

  it('grows the clear circle from a third of the deck to all of it', () => {
    const L = layout(1280, 618, 136, 7, 8);
    const far = Math.hypot(L.deck.w / 2, L.deck.h);
    expect(sightRadius(L, sightShare(0))).toBeLessThan(far * 0.35);
    expect(sightRadius(L, sightShare(1))).toBeGreaterThan(far);
    expect(parFor(10)).toBe(Math.round(RULES.parBase + RULES.parPer * 10));
  });
});
