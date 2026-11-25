import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { boardFor, cloneBoard, firstBoard, generate, gridOf, solve, wayOut, type BoardSpec } from '../src/arcade/arka/board';
import { FIRST_OF, KINDS, STAGES, kindsAt, levelSpec } from '../src/arcade/arka/content';
import { CATALOGS, t, unit } from '../src/arcade/arka/i18n';
import arka, { howto } from '../src/arcade/arka/index';
import { cellAt, cellCentre, cellRect, layout, pacerAt, reachOf, sdir, sightRadius, tapTargets, toScreen, toSim, type Layout } from '../src/arcade/arka/layout';
import { pacerBox, pacerProblems, pacerSizeAt } from '../src/arcade/kit/pacerspot';
import { SANS, font, fontPx } from '../src/arcade/arka/paint';
import { clearLevel, freshProgress, homestead, migrate, settle, totalStars, type ArkaProgress } from '../src/arcade/arka/meta';
import { DX, DY, RULES, parFor, sightShare, starsFor } from '../src/arcade/arka/rules';
import { ArkaSim, planBlocks, type SimEvent } from '../src/arcade/arka/sim';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, DESK_MAX, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
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

type SimOpts = { progress?: Partial<ArkaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; rhythm?: { focus: number; rest: number } };

function makeSim(o: SimOpts = {}): ArkaSim {
  const sim = new ArkaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, rhythm: o.rhythm,
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

  it('follows the rhythm the player set in the lobby: longer Mgła, shorter Tęcza, the jitter scaled', () => {
    const mean = (bs: { dur: number }[]) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
    for (const sec of [300, 1800]) {
      for (const r of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }, { focus: 90, rest: 15 }]) {
        const plan = planBlocks(sec, false, mulberry32(5), r);
        const push = plan.filter(b => b.kind === 'push'), rest = plan.filter(b => b.kind === 'rest');
        // the shares the player asked for (a 10 s rainbow is lifted to the 12 s floor)
        const k = mean(push) / mean(rest) / (r.focus / r.rest);
        expect(k).toBeGreaterThan(0.75);
        expect(k).toBeLessThan(1.25);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec - RULES.finale, 5);
        for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[plan.length - 1].kind).toBe('rest');
      }
    }
    // the lobby's dials show the design itself (their 5 s steps keep it), named in the game's words
    const spec = arka.rhythm!();
    expect([spec.focus.def, spec.rest.def]).toEqual([RULES.push[0], RULES.rest[0]]);
    expect([spec.focus.name, spec.rest.name]).toEqual(['Mgła', 'Tęcza']);
    // no rhythm: the designed one, the rainbow a third of the session or less
    const plan = planBlocks(600, false, mulberry32(5));
    const share = plan.filter(b => b.kind === 'rest').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(share).toBeGreaterThan(0.27);
    expect(share).toBeLessThan(0.36);
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

describe('the layout, mobile first (DESIGN §12)', () => {
  const LEVELS = [1, 2, 6, 9, 12, 20, 40];

  it('keeps the deck in the band: under the HUD and the bar, over the new land, clear of the columns, at every size and board', () => {
    for (const c of CHECK_SIZES) {
      for (const n of LEVELS) {
        const b: BoardSpec = boardFor(n);
        const L = layout(c.w, c.h, c.insets, b.cols, b.rows);
        const name = `${c.name}, level ${n}`;
        expect(L.cols * L.rows, name).toBe(b.cols * b.rows);
        if (L.mode === 'side') {
          expect(L.deck.y - L.rim, name).toBeGreaterThanOrEqual(c.insets.top);
          expect(L.deck.x - L.rim, name).toBeGreaterThanOrEqual(L.bar.x + L.bar.w);
          expect(L.deck.x + L.deck.w + L.rim, name).toBeLessThanOrEqual(L.dove.x);
          expect(L.deck.y + L.deck.h, name).toBeLessThanOrEqual(c.h - c.insets.bottom);
        } else {
          expect(L.deck.y - L.rim, name).toBeGreaterThanOrEqual(L.bar.y + L.bar.h);
          expect(L.deck.y + L.deck.h + L.rim, name).toBeLessThanOrEqual(L.shore.y);
          expect(L.deck.x - L.rim, name).toBeGreaterThanOrEqual(c.insets.left);
          expect(L.deck.x + L.deck.w + L.rim, name).toBeLessThanOrEqual(c.w - c.insets.right);
        }
        if (L.mode === 'tall') expect(L.bar.y, name).toBeGreaterThanOrEqual(c.insets.top);
        // every board cell maps to its own screen square and back, turned or not
        const seen = new Set<string>();
        for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
          const p = cellCentre(L, x, y);
          expect(cellAt(L, p.x, p.y), name).toEqual({ x, y });
          const r = cellRect(L, x, y);
          expect(p.x).toBeCloseTo(r.x + r.w / 2, 6);
          seen.add(`${r.x},${r.y}`);
        }
        expect(seen.size).toBe(b.cols * b.rows);
      }
    }
  });

  it('turns a portrait board a quarter where the deck area is landscape and the cells grow: directions turn with it', () => {
    const small = CHECK_SIZES[0];
    const L = layout(small.w, small.h, small.insets, 7, 9);
    expect(L.rot).toBe(true);
    expect([L.cols, L.rows]).toEqual([9, 7]);
    const straight = layout(small.w, small.h, small.insets, 7, 9);
    expect(straight.cell).toBeGreaterThanOrEqual(Math.floor(Math.min((small.w - 22) / 7, 233 / 9)));
    // a step in a rules' direction is a step in the drawn direction on the screen's grid
    for (let d = 0; d < 4; d++) {
      const a = toScreen(L, 3, 4), b2 = toScreen(L, 3 + DX[d], 4 + DY[d]);
      const sd = sdir(L, d) % 4;
      expect([b2.x - a.x, b2.y - a.y]).toEqual([DX[sd], DY[sd]]);
      expect(toSim(L, a.x, a.y)).toEqual({ x: 3, y: 4 });
    }
    // a portrait deck area keeps a portrait board as it is (an installed app, the chart off)
    const app = CHECK_SIZES.find(x => x.name.startsWith('iPhone (installed'))!;
    expect(layout(app.w, app.h, app.insets, 7, 9).rot).toBe(false);
  });

  it('makes the cells as large as the band allows: 44 px and more on the early decks of a phone, larger than before on the big ones', () => {
    const cell = (name: string, n: number) => {
      const c = CHECK_SIZES.find(x => x.name === name)!, b = boardFor(n);
      return layout(c.w, c.h, c.insets, b.cols, b.rows).cell;
    };
    for (const n of [1, 2, 3, 4, 6]) expect(cell('small phone (Chrome)', n), `level ${n}`).toBeGreaterThanOrEqual(44);
    for (const n of [1, 2, 3, 4, 6, 7, 8, 9]) expect(cell('iPhone (Safari)', n), `level ${n}`).toBeGreaterThanOrEqual(44);
    // the biggest deck (9 × 11): 24 px on the small phone and 31 on an iPhone before
    expect(cell('small phone (Chrome)', 40)).toBeGreaterThanOrEqual(26);
    expect(cell('iPhone (Safari)', 40)).toBeGreaterThanOrEqual(33);
    expect(cell('phone on its side (chart on)', 40)).toBeGreaterThanOrEqual(27);
    expect(cell('phone on its side (chart on)', 6)).toBeGreaterThanOrEqual(44);
    // a finger's reach around a small animal: its cell grown to 44 px
    const L = layout(360, 500, CHECK_SIZES[0].insets, 9, 11);
    expect(L.cell + 2 * reachOf(L)).toBeGreaterThanOrEqual(44);
  });

  it('puts the dove\'s button in the thumb zone: a labelled pill of 48 px and more, off the edges, inside the insets', () => {
    for (const c of CHECK_SIZES) {
      for (const n of [1, 20]) {
        const b = boardFor(n);
        const L = layout(c.w, c.h, c.insets, b.cols, b.rows);
        const d = L.dove;
        expect(auditTargets(tapTargets(L, { card: null, dove: true }), c.w, c.h, c.insets), c.name).toEqual([]);
        expect(d.h, c.name).toBeGreaterThanOrEqual(48);
        expect(d.w).toBeGreaterThanOrEqual(100);
        expect(d.y + d.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom - 2);
        if (L.mode === 'tall') {
          expect(d.y, c.name).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
          if (c.w < 600) expect(d.x + d.w).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
          // the waiting animals stand on the land left of it, clear of the gangway
          for (const s0 of L.slots) expect(s0.x).toBeLessThan(d.x);
          expect(L.slots.length, c.name).toBeGreaterThanOrEqual(3);
        }
        if (L.mode === 'side') {
          expect(d.x).toBeGreaterThan(L.deck.x + L.deck.w);
          for (const s0 of L.slots) expect(s0.y).toBeLessThan(d.y);
        }
      }
    }
  });

  it('grows the clear circle from a third of the deck to all of it', () => {
    const L = layout(1280, 618, 136, 7, 8);
    const far = Math.hypot(L.deck.w / 2, L.deck.h);
    expect(sightRadius(L, sightShare(0))).toBeLessThan(far * 0.35);
    expect(sightRadius(L, sightShare(1))).toBeGreaterThan(far);
    expect(parFor(10)).toBe(Math.round(RULES.parBase + RULES.parPer * 10));
  });
});

// ── under a finger, on the real view ────────────────────────────────
const PX = /(\d+(?:\.\d+)?)px/;
const pxOf = (f: string): number => Number(String(f).match(PX)?.[1] ?? 0);

/** A 2D context that draws nothing and notes the size of every string drawn (and measures 0.56 em a character). */
function fakeContext(canvas: HTMLCanvasElement, sizes: { text: string; px: number }[]): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const note = (text: unknown) => { if (String(text).trim() && Number(state.globalAlpha) > 0.05) sizes.push({ text: String(text), px: pxOf(String(state.font)) }); };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * pxOf(String(target.font)) * 0.56 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0 });
      if (prop === 'fillText' || prop === 'strokeText') return (text: unknown) => note(text);
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

type Size = { name: string; w: number; h: number; insets: Insets };
interface Played { game: ArcadeGame; sim: ArkaSim; view: { L: Layout; pick: { id: number } | null; cardBox: unknown }; sizes: { text: string; px: number }[] }
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe('Arka under a finger (DESIGN §12)', () => {
  const sizes: { text: string; px: number }[] = [];
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this, sizes); }; });
  afterAll(() => { proto.getContext = original; });

  const TAUGHT = ['tap', 'bump', 'hearts', 'pair', 'dove', 'mist', 'rainbow', 'file', 'sleepy', 'turner', 'locked'];

  function play(size: Size, progress: Partial<ArkaProgress> = { sessions: 5, level: 9, taught: TAUGHT }, touch = true): Played {
    const env: GameEnv<ArkaProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), ...progress }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    sizes.length = 0;
    const game = arka.create(env);
    game.resize(size.w, size.h, 1);
    game.start();
    const inner = game as unknown as { sim: ArkaSim; view: Played['view'] };
    const p: Played = { game, sim: inner.sim, view: inner.view, sizes };
    frames(p, 40);
    return p;
  }
  function frames(p: Played, n: number, f: FocusFrame = frame()): void {
    for (let i = 0; i < n; i++) {
      p.game.update(STEP, f, p.sim.now + STEP);
      p.game.draw();
    }
  }
  const down = (p: Played, at: { x: number; y: number }, id = 1) => p.game.pointer!({ type: 'down', ...at, id });
  const move = (p: Played, at: { x: number; y: number }, id = 1) => p.game.pointer!({ type: 'move', ...at, id });
  const up = (p: Played, at: { x: number; y: number }, id = 1) => p.game.pointer!({ type: 'up', ...at, id });

  it('picks the animal under a finger on touch-down and sends it when the finger lifts; sliding off the deck lets it be', () => {
    const p = play(CHECK_SIZES[0]);
    const { sim } = p;
    expect(sim.levelState).toBe('play');
    const L = p.view.L;
    const free = sim.freeIds()[0];
    const a = sim.animals[free];
    const at = cellCentre(L, a.cells[0].x, a.cells[0].y);
    down(p, at);
    expect(p.view.pick?.id).toBe(free);
    expect(a.out).toBe(false);
    // slid off the deck and lifted: nothing goes
    move(p, { x: at.x, y: L.bar.y - 20 });
    expect(p.view.pick).toBeNull();
    up(p, { x: at.x, y: L.bar.y - 20 });
    expect(a.out).toBe(false);
    // down and up on it: it goes
    down(p, at);
    up(p, at);
    expect(a.out).toBe(true);
  });

  it('slides from one animal to another before lifting: the last one under the finger goes', () => {
    const p = play(CHECK_SIZES[1]);
    const { sim } = p;
    const L = p.view.L;
    const ids = sim.freeIds();
    const blocked = sim.animals.find(a => !a.out && !ids.includes(a.id))!;
    const free = sim.animals[ids[0]];
    const hearts = sim.hearts;
    down(p, cellCentre(L, blocked.cells[0].x, blocked.cells[0].y));
    expect(p.view.pick?.id).toBe(blocked.id);
    const to = cellCentre(L, free.cells[0].x, free.cells[0].y);
    move(p, to);
    expect(p.view.pick?.id).toBe(free.id);
    up(p, to);
    expect(free.out).toBe(true);
    expect(sim.hearts).toBe(hearts);
  });

  it('takes a touch a finger\'s reach off a small animal, and nothing farther', () => {
    const p = play(CHECK_SIZES[0], { sessions: 5, level: 40, taught: TAUGHT });
    const { sim } = p;
    const L = p.view.L;
    expect(L.cell).toBeLessThan(44);
    // an empty cell next to an animal: the animal is taken
    let found = false;
    for (let y = 0; y < sim.board.rows && !found; y++) for (let x = 0; x < sim.board.cols && !found; x++) {
      if (sim.animalAt(x, y)) continue;
      const r = cellRect(L, x, y);
      const id = (p.view as unknown as { pickAt: (s: ArkaSim, x: number, y: number) => number }).pickAt(sim, r.x + r.w / 2, r.y + r.h / 2);
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sim.animalAt(x + dx, y + dy));
      if (near && L.cell / 2 <= reachOf(L)) { expect(id).toBeGreaterThanOrEqual(0); found = true; }
    }
    // far off the deck: nothing
    const pickAt = (p.view as unknown as { pickAt: (s: ArkaSim, x: number, y: number) => number }).pickAt.bind(p.view);
    expect(pickAt(sim, L.deck.x - reachOf(L) - 4, L.deck.y + 5)).toBe(-1);
  });

  it('reports the dove\'s button in play and a card while one takes the tap; both answer a tap', () => {
    const first = play(CHECK_SIZES[0], { ...freshProgress() });
    // the first-ever session opens on the story card: it takes the tap
    const ts = first.game.targets!();
    expect(ts.map(x => x.label)).toEqual(['card']);
    for (const c of CHECK_SIZES.slice(0, 1)) expect(auditTargets(ts, c.w, c.h, c.insets)).toEqual([]);
    const p = play(CHECK_SIZES[0]);
    const t2 = p.game.targets!();
    expect(t2.map(x => x.label)).toEqual(['dove']);
    const on = p.sim.onDeck;
    down(p, mid(t2[0]));
    up(p, mid(t2[0]));
    expect(p.sim.onDeck).toBe(on - 1);
  });

  it('never draws text under 11 px at any size: the story card, play with a pick and the raven, a bump, the stars card', () => {
    for (const c of CHECK_SIZES) {
      const seen: { text: string; px: number }[] = [];
      const grab = (p: Played) => { seen.push(...p.sizes); p.sizes.length = 0; };
      const first = play(c, { ...freshProgress() }, c.name !== 'desktop');
      frames(first, 30);
      grab(first);
      const p = play(c, { sessions: 5, level: 12, taught: TAUGHT }, c.name !== 'desktop');
      const L = p.view.L;
      const blocked = p.sim.animals.find(a => !a.out && !p.sim.freeIds().includes(a.id));
      if (blocked) {
        const at = cellCentre(L, blocked.cells[0].x, blocked.cells[0].y);
        down(p, at);
        frames(p, 5);
        up(p, at);
      }
      p.sim.dove();
      frames(p, 60);
      grab(p);
      // clear the deck: every free animal in turn
      for (let k = 0; k < 400 && p.sim.levelState === 'play'; k++) {
        const id = p.sim.freeIds()[0];
        if (id === undefined) { frames(p, 10); continue; }
        p.sim.tap(id);
        frames(p, 2);
      }
      frames(p, 40);
      grab(p);
      expect(seen.length, c.name).toBeGreaterThan(10);
      // each string at its largest, as the audit takes it (the kit's floating words pop in from nothing)
      const most = new Map<string, number>();
      for (const x of seen) most.set(x.text, Math.max(most.get(x.text) ?? 0, x.px));
      const tiny = [...most].filter(([, px]) => px < MIN_TEXT);
      expect(tiny, `${c.name}: ${JSON.stringify(tiny.slice(0, 5))}`).toEqual([]);
      for (const key of ['hud.dove', 'card.tap'] as const) if (most.has(t(key))) expect(most.get(t(key)), `${c.name}: ${key}`).toBeGreaterThanOrEqual(MIN_READ);
      expect(most.has(t('hud.dove')), c.name).toBe(true);
    }
  });

  it('keeps its font helper over the floor', () => {
    for (const px of [0, 4, 9.6, 10.99, 11, 12.5, 30]) expect(pxOf(font(700, px, SANS))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fontPx(3)).toBe(MIN_TEXT);
  });

  it('speaks to the hand the player has: a finger hears of the dove on the meadow, a keyboard of Space', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus|strzałk|arrow|pfeil|piltangent/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['how.goal', 'how.tap', 'how.dove.touch', 'coach.dove.touch', 'coach.tap', 'card.tap']) {
        expect(c[k], `${l}.${k}`).toBeTypeOf('string');
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      expect(c['how.dove'], `${l}.how.dove`).toMatch(KEYS);
      expect(c['coach.dove'], `${l}.coach.dove`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(touch.hands).toHaveLength(2);
    expect(desk.hands.filter(x => x.gesture === 'keys')).toHaveLength(2);
  });
});

// ── a big screen (DESIGN §14) ────────────────────────────────────────

describe('Arka on a desktop and a big screen (DESIGN §14)', () => {
  const sizes: { text: string; px: number }[] = [];
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this, sizes); }; });
  afterAll(() => { proto.getContext = original; });

  const TAUGHT = ['tap', 'bump', 'hearts', 'pair', 'dove', 'mist', 'rainbow', 'file', 'sleepy', 'turner', 'locked'];
  const LEVELS = [1, 2, 6, 9, 12, 20, 40];
  const monitors = CHECK_SIZES.filter(c => /monitor/.test(c.name));
  type View = Played['view'] & { hover: number; doveHover: boolean };
  function play(size: Size, touch: boolean, progress: Partial<ArkaProgress> = { sessions: 5, level: 9, taught: TAUGHT }) {
    const env: GameEnv<ArkaProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), ...progress }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    sizes.length = 0;
    const game = arka.create(env);
    game.resize(size.w, size.h, 1);
    game.start();
    const inner = game as unknown as { sim: ArkaSim; view: View };
    const step = (n: number) => { for (let i = 0; i < n; i++) { game.update(STEP, frame(), inner.sim.now + STEP); game.draw(); } };
    step(40);
    return { game, env, sim: inner.sim, view: inner.view, step };
  }

  it('chooses its layout from the screen: a finger keeps the phone’s and the tablet’s, a mouse on a big screen gets its own', () => {
    for (const c of CHECK_SIZES) {
      const T = layout(c.w, c.h, c.insets, 7, 8, true);
      expect(['phone', 'phone-side', 'tablet'], c.name).toContain(T.kind);
      expect(T.tk, c.name).toBe(Math.min(T.u, 1.15));
    }
    for (const c of monitors) expect(layout(c.w, c.h, c.insets, 7, 8, false).kind, c.name).toBe('big');
  });

  it('fills a big monitor: the bar under the top bar, the deck across the middle with larger cells, the dove and the raven beside it', () => {
    for (const c of monitors) {
      for (const n of LEVELS) {
        const b = boardFor(n);
        const L = layout(c.w, c.h, c.insets, b.cols, b.rows, false);
        const before = layout(c.w, c.h, c.insets, b.cols, b.rows, true);
        const name = `${c.name}, level ${n}`;
        expect(L.u, name).toBeGreaterThan(1.3);
        expect(L.u, name).toBeLessThanOrEqual(DESK_MAX);
        // nothing under the runner's top bar (the old desktop layout rose into a band that a big screen does not have)
        expect(L.bar.y, name).toBeGreaterThanOrEqual(c.insets.top);
        expect(L.deck.y - L.rim, name).toBeGreaterThanOrEqual(L.bar.y + L.bar.h);
        expect(L.deck.y + L.deck.h + L.rim, name).toBeLessThanOrEqual(L.shore.y);
        expect(L.deck.x - L.rim, name).toBeGreaterThanOrEqual(0);
        expect(L.deck.x + L.deck.w + L.rim, name).toBeLessThanOrEqual(c.w);
        expect(L.cell, name).toBeGreaterThanOrEqual(before.cell);
        // the raven right of the hull, on the canvas; the dove's pill grown, inside the insets
        expect(L.raven.x - L.raven.s * 0.6, name).toBeGreaterThan(L.deck.x + L.deck.w + L.rim);
        expect(L.raven.x + L.raven.s * 0.6, name).toBeLessThanOrEqual(c.w);
        expect(L.dove.h, name).toBeGreaterThanOrEqual(64);
        expect(auditTargets(tapTargets(L, { card: null, dove: true }), c.w, c.h, c.insets), name).toEqual([]);
        // every board cell maps to its own square and back
        for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) expect(cellAt(L, cellCentre(L, x, y).x, cellCentre(L, x, y).y), name).toEqual({ x, y });
      }
      // the biggest deck: its cells half as large again on a Full HD monitor (48 → 71 px)
      const big = boardFor(40);
      expect(layout(c.w, c.h, c.insets, big.cols, big.rows, false).cell, c.name).toBeGreaterThanOrEqual(layout(c.w, c.h, c.insets, big.cols, big.rows, true).cell * (c.w < 1300 ? 1.4 : 1.05));
    }
  });

  it('grows its words on a big monitor: the bar and the dove ≥ 1.3 × an iPhone’s, none under 13 px where they are read', () => {
    const at = (c: Size, touch: boolean) => {
      const p = play(c, touch);
      const blocked = p.sim.animals.find(a => !a.out && !p.sim.freeIds().includes(a.id));
      if (blocked) p.sim.tap(blocked.id);
      p.step(60);
      const most = new Map<string, number>();
      for (const x of sizes) most.set(x.text, Math.max(most.get(x.text) ?? 0, x.px));
      return most;
    };
    const phone = at(CHECK_SIZES[1], true);
    for (const c of monitors) {
      const desk = at(c, false);
      expect([...desk].filter(([, px]) => px < MIN_TEXT), c.name).toEqual([]);
      expect(desk.get(t('hud.dove'))!, c.name).toBeGreaterThanOrEqual(Math.max(MIN_READ, phone.get(t('hud.dove'))! * 1.3));
      const level = [...desk.keys()].find(k => k === t('hud.level', { n: 10 }));
      if (level) expect(desk.get(level)!, c.name).toBeGreaterThanOrEqual(15 * 1.3);
    }
  });

  it('answers a resting mouse: the animal under it is ringed (its way never told), the dove lights, the cursor tells', () => {
    for (const c of monitors) {
      const { game, env, sim, view, step } = play(c, false);
      const L = view.L;
      const free = sim.freeIds()[0];
      const a = sim.animals[free];
      const at = cellCentre(L, a.cells[0].x, a.cells[0].y);
      game.pointer!({ type: 'move', ...at, id: 1 });
      expect(view.hover, c.name).toBe(free);
      expect(env.canvas.style.cursor, c.name).toBe('pointer');
      // a blocked animal is ringed alike: the ring tells which one a click takes, not whether it can go
      const blocked = sim.animals.find(x => !x.out && !sim.freeIds().includes(x.id));
      if (blocked) {
        game.pointer!({ type: 'move', ...cellCentre(L, blocked.cells[0].x, blocked.cells[0].y), id: 1 });
        expect(view.hover, c.name).toBe(blocked.id);
      }
      // a click sends the animal under the cursor
      game.pointer!({ type: 'move', ...at, id: 1 });
      game.pointer!({ type: 'down', ...at, id: 1 });
      game.pointer!({ type: 'up', ...at, id: 1 });
      expect(a.out, c.name).toBe(true);
      step(5);
      // over the dove's pill: it lights; off everything: the plain arrow; a pause gives the page its cursor back
      game.pointer!({ type: 'move', ...mid(L.dove), id: 1 });
      expect(view.doveHover, c.name).toBe(true);
      expect(env.canvas.style.cursor, c.name).toBe('pointer');
      game.pointer!({ type: 'move', x: 4, y: L.bar.y + 4, id: 1 });
      expect(env.canvas.style.cursor, c.name).toBe('default');
      game.pause!(true);
      expect(env.canvas.style.cursor, c.name).toBe('');
    }
  });

  it('holds the raven’s line while a desktop’s coach mark is up (his bubble would stand under it); a phone’s raven talks as before', () => {
    for (const touch of [false, true]) {
      const c = touch ? CHECK_SIZES[1] : monitors[0];
      const hints: string[] = [];
      const env: GameEnv<ArkaProgress> = {
        canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
        progress: { ...freshProgress(), sessions: 5, level: 9, taught: TAUGHT.filter(k => k !== 'dove') }, rng: mulberry32(7), day: DAY,
        daySeed: 1, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false, tuning: TUNING,
        hint: (text: string) => { if (text) hints.push(text); }, hudTop: () => c.insets.top, insets: () => c.insets, touch,
      };
      const game = arka.create(env);
      game.resize(c.w, c.h, 1);
      game.start();
      const sim = (game as unknown as { sim: ArkaSim }).sim;
      // left idle, the dove's coach mark comes (a deterministic one)
      for (let i = 0; i < 60 * 40 && !hints.length; i++) { game.update(STEP, frame(), sim.now + STEP); game.draw(); }
      expect(hints.length, touch ? 'finger' : 'mouse').toBeGreaterThan(0);
      if (touch) {
        expect(sim.hushUntil).toBeLessThan(sim.now);
        continue;
      }
      // the hush covers the coach mark's 4.2 s; a line under way waits (its clock stops) and is not drawn
      expect(sim.hushUntil - sim.now).toBeGreaterThanOrEqual(4.2);
      const text = 'Znowu Ty! Ja doradzam, Ty robisz na odwrót. I to działa!';
      sim.line = { text, t0: sim.now, dur: 3, moment: 'open' as never };
      (sim as unknown as { talkTill: number }).talkTill = sim.now + 3.5;   // as the sim sets it for a line it says
      sizes.length = 0;
      for (let i = 0; i < 60; i++) { game.update(STEP, frame(), sim.now + STEP); game.draw(); }
      expect(sim.now - sim.line!.t0).toBeLessThan(0.05);
      expect(sizes.some(x => text.includes(x.text) && x.text.length > 4)).toBe(false);
      // after it, the line goes on and shows
      while (sim.now < sim.hushUntil + 0.1) { game.update(STEP, frame(), sim.now + STEP); game.draw(); }
      sizes.length = 0;
      for (let i = 0; i < 20; i++) { game.update(STEP, frame(), sim.now + STEP); game.draw(); }
      expect(sim.line?.text).toBe(text);
      expect(sizes.some(x => text.includes(x.text) && x.text.length > 4)).toBe(true);
    }
  });

  it('speaks of clicking to a mouse, in every language, and keeps a finger’s words', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['coach.click', 'card.click', 'how.click']) expect(cat[k], `${l}.${k}`).toMatch(/klik|click|klick/i);
    }
    expect(howto(false).hands[0].text).toBe(t('how.click'));
    expect(howto(true).hands[0].text).toBe(t('how.tap'));
  });
});

// ── long sessions (15–30 min) ────────────────────────────────────

describe('Arka at 15–30 minutes', () => {
  /** A steady player: focus in a Mgła, calm in a Tęcza, a free animal tapped every 0.7 s (the dove when none is free). */
  function steady(sim: ArkaSim, sec: number): { at23: number; rainbowsMax: number } {
    let nextTap = 0.5, at23 = -1, rainbowsMax = 0, inBlock = 0, last = sim.rainbows, block = sim.blockIndex;
    const dt = 1 / 30;
    for (let i = 0; i < (sec + 3) / dt; i++) {
      const t = sim.now + dt;
      sim.update(dt, sim.block.kind === 'rest' ? REST : FOCUS, t);
      if (sim.blockIndex !== block) { block = sim.blockIndex; inBlock = 0; }
      inBlock += sim.rainbows - last;
      last = sim.rainbows;
      rainbowsMax = Math.max(rainbowsMax, inBlock);
      if (at23 < 0 && t >= sec * 2 / 3) at23 = sim.pairs;
      if (t >= nextTap) {
        nextTap += 0.7;
        if (sim.levelState === 'clear') sim.skip();
        else {
          const open = (x: (typeof sim.animals)[number]) => x.lockedBy < 0 || sim.animals[x.lockedBy].out;
          const a = sim.animals.find(x => !x.out && open(x) && (x.asleep || sim.way(x).blocker < 0));
          if (a) sim.tap(a.id); else sim.dove();
        }
      }
      sim.take();
    }
    return { at23, rainbowsMax };
  }

  it('plays any rhythm the player sets to the finale: 3, 10 and 30 minutes, long mists or long rainbows, the pairs still grow', () => {
    for (const planned of [180, 600, 1800]) {
      for (const rhythm of [undefined, { focus: 120, rest: 10 }, { focus: 20, rest: 40 }]) {
        const name = `${planned} ${rhythm ? `${rhythm.focus}/${rhythm.rest}` : 'designed'}`;
        const sim = returning(12, { planned, seed: 9, rhythm });
        const r = steady(sim, planned);
        expect(sim.phase, name).toBe('finale');
        expect(sim.pairs, name).toBeGreaterThan(r.at23);
        // every passed Tęcza gives its rainbow (grace), never more than rainbowMax a rest
        expect(sim.rainbows, name).toBeGreaterThanOrEqual(sim.plan.filter(b => b.kind === 'rest').length - 1);
        expect(r.rainbowsMax, name).toBeLessThanOrEqual(RULES.rainbowMax);
        for (const v of [sim.pairs, sim.levelN, sim.starsSession, sim.hearts]) expect(Number.isFinite(v), name).toBe(true);
      }
    }
  });

  it('plans 900–1800 s to the finale: Mgła/Tęcza pairs at their design lengths, ending on a Tęcza', () => {
    for (const sec of [900, 1200, 1500, 1800]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(sec));
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec - RULES.finale, 6);
        expect(plan[0].kind === 'warmup').toBe(first);
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

  it('plays a whole 30-min session from the first ever: the saga keeps dealing decks, the summary stays short', () => {
    for (const fresh of [true, false]) {
      const sim = fresh ? makeSim({ planned: 1800, seed: 4 }) : returning(30, { planned: 1800, seed: 4 });
      let nextTap = 0.5, evs = 0;
      const dt = 1 / 30;
      for (let i = 0; i < 1803 / dt; i++) {
        const t = sim.now + dt;
        sim.update(dt, sim.block.kind === 'rest' ? REST : FOCUS, t);
        if (t >= nextTap) {
          nextTap += 0.7;
          if (sim.levelState === 'clear') sim.skip();
          else {
            const open = (x: (typeof sim.animals)[number]) => x.lockedBy < 0 || sim.animals[x.lockedBy].out;
            const a = sim.animals.find(x => !x.out && open(x) && (x.asleep || sim.way(x).blocker < 0));
            if (a) sim.tap(a.id); else sim.dove();
          }
        }
        evs += sim.take().length;
      }
      expect(sim.phase).toBe('finale');
      expect(evs).toBeGreaterThan(500);
      expect(sim.levels).toBeGreaterThan(fresh ? 15 : 10);
      expect(sim.pairs).toBeGreaterThan(100);
      for (const v of [sim.pairs, sim.levelN, sim.starsSession]) expect(Number.isFinite(v)).toBe(true);
      const out = sim.result();
      expect(out.highlights.length).toBeLessThanOrEqual(6);
      for (const s of out.highlights) expect(s.length).toBeLessThan(100);
      for (const s of [...out.highlights, ...out.stats.flat(), sim.headline().sub ?? '']) expect(s).not.toMatch(/undefined|NaN|Infinity/);
    }
  });
});

describe('Arka: the breath pacer in a Tęcza stands off the deck (pacerAt)', () => {
  const LEVELS = [1, 2, 6, 9, 12, 20, 40];
  const cover = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  it('keeps the pill whole under the HUD band, clear of the bar, the dove and the raven, beside the deck where there is room, at every size and board', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        for (const n of LEVELS) {
          const b = boardFor(n);
          const L = layout(c.w, c.h, c.insets, b.cols, b.rows, touch);
          const at = pacerAt(L);
          const name = `${c.name}${touch ? '' : ' (mouse)'}, level ${n}`;
          expect(at, name).not.toBeNull();
          const size = pacerSizeAt(at, L.kind === 'big');
          const s = L.raven.s;
          const hull = { label: 'hull', x: L.deck.x - L.rim, y: L.deck.y - L.rim, w: L.deck.w + 2 * L.rim, h: L.deck.h + 2 * L.rim };
          const keep = [
            { label: 'bar', ...L.bar },
            { label: 'raven', x: L.raven.x - s * 0.8, y: L.raven.y - s * 1.2, w: s * 1.6, h: s * 1.2 },
            ...tapTargets(L, { card: null, dove: true }),
          ];
          // a desktop, a tablet: beside or above the hull; an upright phone: at the foot, off the deck's cells (over
          // the waiting firsts); a phone on its side and a big screen: clear of the cells where the columns beside the
          // deck are wide enough, else a corner of the deck (never more than 30 % of the pill over its cells)
          const also = L.mode === 'wide' && L.kind !== 'big' ? [hull] : L.mode === 'tall' ? [{ label: 'deck', ...L.deck }] : [];
          expect(pacerProblems(at, c.w, c.h, c.insets, [...keep, ...also], size), name).toEqual([]);
          if (L.mode === 'tall' && at!.y > L.deck.y) expect(at!.y, name).toBeGreaterThanOrEqual(L.deck.y + L.deck.h);
          expect(cover(pacerBox(at!, size), L.deck), name).toBeLessThanOrEqual(size.w * size.h * 0.3);
          // a small phone on its side: the ring alone beside the hull, off the deck (the pill: 5 % of it)
          expect(cover(pacerBox(at!, size), L.deck), name).toBeLessThanOrEqual(L.deck.w * L.deck.h * 0.005);
        }
      }
    }
  });

  it('answers from the game in play, the same spot as the layout\'s (left of the deck on a desktop)', () => {
    const c = CHECK_SIZES[8];
    const env: GameEnv<ArkaProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), sessions: 5, level: 9 }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => c.insets.top, insets: () => c.insets, touch: false,
    };
    const game = arka.create(env);
    expect(game.pacerAt!()).toBeNull();
    game.resize(c.w, c.h, 1);
    game.start();
    const inner = game as unknown as { sim: ArkaSim; view: { L: Layout; lay: (s: ArkaSim) => Layout } };
    const L = inner.view.lay(inner.sim);
    expect(game.pacerAt!()).toEqual(pacerAt(L));
    expect(game.pacerAt!()!.x + 105).toBeLessThan(L.deck.x - L.rim);
  });
});
