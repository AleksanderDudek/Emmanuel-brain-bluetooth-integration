import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Board, MOON, PULSAR, setCells, type Sp } from '../src/arcade/firmament/board';
import { CONSTELLATIONS, constName, figure } from '../src/arcade/firmament/content';
import { CATALOGS, line, t, unit } from '../src/arcade/firmament/i18n';
import firmament, { howto } from '../src/arcade/firmament/index';
import { cardRect, layout, outButtons, tapTargets, type Layout } from '../src/arcade/firmament/layout';
import { boardSpec, difficulty, layoutCounts, levelAt, starsFor, traySize } from '../src/arcade/firmament/levels';
import { bestOf, freshProgress, migrate, winLevel, type FirmamentProgress } from '../src/arcade/firmament/meta';
import { SANS, font, fontPx } from '../src/arcade/firmament/paint';
import { RULES } from '../src/arcade/firmament/rules';
import { FirmamentSim, chargeRate, planBlocks, type SimEvent } from '../src/arcade/firmament/sim';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, TAP_GAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CATALOGS as SHARED } from '../src/i18n/arcade';

const DAY = '2026-11-07';
const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ activity: 6, level: 0.9, focused: true, hold: 3, calm: 0.05 });
const LOW = frame({ activity: -2, level: 0.1, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<FirmamentProgress>; planned?: number; seed?: number; eeg?: boolean };
function makeSim(o: SimOpts = {}): FirmamentSim {
  const sim = new FirmamentSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: 4242,
    plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: TUNING,
  });
  sim.start();
  return sim;
}
/** A returning player (no warm-up, no story): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, story: [0, 1, 2, 3, 4, 5, 6, 7], seen: ['x'], ...o.progress } });

function drive(sim: FirmamentSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
/** Get through the cards to play. */
function toPlay(sim: FirmamentSim, clock = { t: 0 }, f: FocusFrame = frame()): SimEvent[] {
  const out: SimEvent[] = [];
  for (let k = 0; k < 400 && sim.stage !== 'play'; k++) { out.push(...drive(sim, 0.1, f, clock)); sim.advance(); }
  return out;
}

/** A board with no randomness left to chance: letters a..f are the six kinds. */
function board(rows: string[], sp: Record<number, Sp> = {}, seed = 7, kinds = 6): Board {
  const b = new Board({ rows: rows.length, cols: rows[0].length, kinds, seed });
  setCells(b, rows, sp);
  return b;
}
const noEmpty = (b: Board) => b.cells.every((p, i) => !b.open(i) || p !== null);

describe('Firmament — the engine', () => {
  it('generates a sky with no match and at least one move, the same for the same seed', () => {
    for (let s = 1; s < 30; s++) {
      const b = new Board({ kinds: 5, seed: s });
      expect(b.findGroups()).toEqual([]);
      expect(b.hasMove()).toBe(true);
      expect(noEmpty(b)).toBe(true);
    }
    const a = new Board({ kinds: 6, seed: 99 }), c = new Board({ kinds: 6, seed: 99 });
    expect(a.cells.map(p => p?.kind)).toEqual(c.cells.map(p => p?.kind));
  });

  it('bounces a swap that makes nothing, and spends no move', () => {
    const b = board(['abcd', 'bcda', 'cdab', 'dabc']);
    const res = b.swap(0, 1);
    expect(res.ok).toBe(false);
    expect(b.cells[0]!.kind).toBe(0);
  });

  it('clears three in a line, refills every cell and scores', () => {
    const b = board(['abab', 'baba', 'aaba', 'babb']);
    // swap (2,2)b with (2,3)a → row 2: a a a b
    const res = b.swap(10, 11);
    expect(res.ok).toBe(true);
    expect(res.steps[0].cleared.length).toBeGreaterThanOrEqual(3);
    expect(res.tally.points).toBeGreaterThan(0);
    expect(noEmpty(b)).toBe(true);
  });

  it('makes the specials of the genre: four → comet across, L → supernova, five → pulsar, square → meteor', () => {
    expect(Board.special({ h: 4, v: 0, square: false })).toBe('col');
    expect(Board.special({ h: 0, v: 4, square: false })).toBe('row');
    expect(Board.special({ h: 3, v: 3, square: false })).toBe('nova');
    expect(Board.special({ h: 5, v: 0, square: false })).toBe('pulsar');
    expect(Board.special({ h: 0, v: 0, square: true })).toBe('meteor');
    expect(Board.special({ h: 3, v: 0, square: false })).toBe('none');
    // five in a row: the 'a' at (0,2) comes down into a a b a a
    const b2 = board(['cdacd', 'aabaa', 'dcdcd', 'cdcdc', 'dcdcd']);
    const r2 = b2.swap(2, 7);
    expect(r2.ok).toBe(true);
    expect(r2.steps[0].born.some(x => x.sp === 'pulsar')).toBe(true);
    const b3 = board(['cdacd', 'aabad', 'dcdcd', 'cdcdc', 'dcdcd']);
    const r3 = b3.swap(2, 7);   // row 1: a a a a d → four → a vertical comet
    expect(r3.steps[0].born.some(x => x.sp === 'col')).toBe(true);
    const b4 = board(['abad', 'aacd', 'bdbc', 'dcda']);
    const r4 = b4.swap(1, 2);   // (0,1)b ↔ (0,2)a → a a b / a a → a square
    expect(r4.ok).toBe(true);
    expect(r4.steps[0].born.some(x => x.sp === 'meteor')).toBe(true);
    const b5 = board(['adcd', 'acdc', 'daab', 'acdc']);
    const r5 = b5.swap(8, 12);  // (2,0)d ↔ (3,0)a → col 0: a a a, row 2: a a a → L/T
    expect(r5.ok).toBe(true);
    expect(r5.steps[0].born.some(x => x.sp === 'nova')).toBe(true);
  });

  it('fires a comet along its line, and a supernova twice', () => {
    // a row comet at (2,0) in a line of three made by bringing the 'a' at (1,2) down
    const b = board(['abcde', 'bcaea', 'aacbd', 'deabc', 'eabcd'], { 10: 'row' });
    const res = b.swap(7, 12);
    expect(res.ok).toBe(true);
    expect(res.steps[0].blasts.some(x => x.kind === 'row')).toBe(true);
    const n = board(['abcde', 'bcaea', 'aacbd', 'deabc', 'eabcd'], { 10: 'nova' });
    const rn = n.swap(7, 12);
    expect(rn.steps.flatMap(s => s.blasts).filter(x => x.kind === 'nova').length).toBe(2);
  });

  it('combines two specials: comets cross, a pulsar takes a kind, two pulsars take the sky', () => {
    const b = board(['abcde', 'bcdea', 'cdeab', 'deabc', 'eabcd'], { 12: 'row', 13: 'col' });
    const res = b.swap(12, 13);
    expect(res.ok).toBe(true);
    expect(res.tally.combo).toBe('comet+comet');
    expect(res.steps[0].blasts[0].kind).toBe('cross');
    expect(res.steps[0].blasts[0].cells.length).toBe(9);
    const p = board(['abcde', 'bcdea', 'cdPab', 'deabc', 'eabcd']);
    const rp = p.swap(12, 13);   // the pulsar with an 'a'
    expect(rp.ok).toBe(true);
    expect(rp.steps[0].blasts[0].kind).toBe('kind');
    expect(rp.steps[0].cleared.filter(c => c.kind === 0).length).toBe(5);
    const pp = board(['abcde', 'bcdea', 'cdPPb', 'deabc', 'eabcd']);
    const rpp = pp.swap(12, 13);
    expect(rpp.tally.combo).toBe('pulsar+pulsar');
    expect(rpp.steps[0].cleared.length).toBe(25);
    expect(noEmpty(pp)).toBe(true);
    const pc = board(['abcde', 'bcdea', 'cdPab', 'deabc', 'eabcd'], { 13: 'row' });
    const rpc = pc.swap(12, 13);
    expect(rpc.tally.combo).toBe('pulsar+comet');
    expect(rpc.steps[0].changed.length).toBe(4);   // the other four a's became comets
  });

  it('sends a meteor to what the level wants cleared', () => {
    const b = new Board({ rows: 5, cols: 5, kinds: 5, seed: 3, cloud: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2] });
    expect(b.meteorTarget()).toBe(24);
  });

  it('thins clouds under cleared bodies, cracks asteroids beside a match, frees locks', () => {
    const b = new Board({ rows: 4, cols: 4, kinds: 6, seed: 5, cloud: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0], rock: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0] });
    setCells(b, ['abcd', 'bcdb', 'aaba', '.ced']);
    const res = b.swap(10, 11);   // row 2: a a a
    expect(res.ok).toBe(true);
    expect(res.tally.clouds).toBe(3);
    expect(b.rock[12]).toBe(1);
    const l = new Board({ rows: 4, cols: 4, kinds: 6, seed: 5, lock: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] });
    setCells(l, ['abcd', 'bcdb', 'aaba', 'dcef']);
    expect(l.free(8)).toBe(false);
    const r = l.swap(10, 11);
    expect(r.ok).toBe(true);
    expect(l.lock[8]).toBe(0);
    expect(l.cells[8]).not.toBeNull();   // the body stays, freed
  });

  it('brings moons down to the bottom, where they leave the sky', () => {
    const b = new Board({ rows: 4, cols: 4, kinds: 6, seed: 9, moons: 1, moonsAtOnce: 1 });
    setCells(b, ['abcd', 'bMdb', 'caba', 'dcac']);
    expect(b.cells.filter(p => p?.kind === MOON)).toHaveLength(1);
    // hammer the cell under the moon until it is home
    for (let k = 0; k < 6 && b.moonDown === 0; k++) {
      const at = b.cells.findIndex(p => p?.kind === MOON);
      if (at < 0) break;
      const below = at + b.cols;
      if (below < b.n) b.hammer(below);
    }
    expect(b.moonDown).toBe(1);
  });

  it('lets ink spread onto a plain body when a move did not touch it', () => {
    const b = new Board({ rows: 4, cols: 4, kinds: 6, seed: 2, ink: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    const before = b.inkLeft;
    const st = b.spreadInk();
    expect(st).not.toBeNull();
    expect(b.inkLeft).toBe(before + 1);
  });

  it('slides bodies diagonally past an asteroid so no reachable cell stays empty', () => {
    const rock = new Array<number>(36).fill(0);
    rock[2] = 3;   // the top of column 2 is a rock: column 2 below fills from the sides
    const b = new Board({ rows: 6, cols: 6, kinds: 5, seed: 4, rock });
    for (let k = 0; k < 8; k++) {
      const m = b.findMoves()[0];
      b.swap(m.a, m.b);
      expect(noEmpty(b)).toBe(true);
    }
  });

  it('reshuffles a stuck sky into one with a move and no ready match', () => {
    const b = board(['abab', 'cdcd', 'abab', 'cdcd'], {}, 3, 4);
    expect(b.hasMove()).toBe(false);
    b.reshuffle();
    expect(b.hasMove()).toBe(true);
    expect(b.findGroups()).toEqual([]);
  });

  it('turns the moves left into firing comets at the end of a won level (Deszcz komet)', () => {
    const b = new Board({ kinds: 5, seed: 11 });
    const res = b.celebrate(5);
    expect(res.steps.length).toBeGreaterThanOrEqual(5);
    expect(res.tally.points).toBeGreaterThanOrEqual(5 * RULES.leftover);
    expect(noEmpty(b)).toBe(true);
  });

  it('has a pulsar kind of its own', () => expect(PULSAR).toBe(-1));
});

describe('Firmament — the saga', () => {
  it('gives every level one goal, moves, three-star scores and a board that matches it', () => {
    for (let i = 0; i < 64; i++) {
      const l = levelAt(i);
      expect(['score', 'clouds', 'moons', 'collect', 'rocks']).toContain(l.goal);
      expect(l.n).toBeGreaterThan(0);
      expect(l.moves).toBeGreaterThanOrEqual(12);
      expect(l.stars[1]).toBeGreaterThan(l.stars[0]);
      for (const w of l.want) expect(w.of).toBeLessThan(l.kinds);
      const b = new Board(boardSpec(l));
      expect(b.hasMove()).toBe(true);
      if (l.goal === 'clouds') expect(b.cloudLeft).toBe(l.n);
      if (l.goal === 'rocks') expect(b.rocksLeft).toBe(l.n);
      if (l.goal === 'moons') expect(b.moonsLeft).toBe(l.n);
    }
  });

  it('marks the last star of each constellation hard, and rides a roller-coaster', () => {
    expect(levelAt(7).hard).toBe(true);
    expect(levelAt(6).hard).toBe(false);
    expect(difficulty(7)).toBeGreaterThan(difficulty(8));
    expect(layoutCounts(['cC1i', 'l k.']).clouds).toBe(4);
  });

  it('counts stars by score after the goal', () => {
    const l = levelAt(0);
    expect(starsFor(l, 0)).toBe(1);
    expect(starsFor(l, l.stars[0])).toBe(2);
    expect(starsFor(l, l.stars[1])).toBe(3);
  });

  it('names and draws every constellation, and its story verse exists', () => {
    for (let c = 0; c < 8; c++) {
      expect(constName(c).length).toBeGreaterThan(2);
      const f = figure(c);
      expect(f.stars).toHaveLength(RULES.perConst);
    }
    for (const c of CONSTELLATIONS) expect(passage(c.verse).text.length).toBeGreaterThan(10);
    expect(traySize(0)).toBe(3);
    expect(traySize(5)).toBe(4);
  });

  it('a greedy player wins the first constellation in a fair number of tries', () => {
    let tries = 0, won = 0;
    for (let i = 0; i < 8; i++) {
      const l = levelAt(i);
      for (let a = 0; a < 4; a++) {
        tries++;
        const b = new Board(boardSpec(l, a));
        let score = 0, moves = l.moves;
        const collected = new Array<number>(6).fill(0);
        const left = () => l.goal === 'score' ? l.n - score : l.goal === 'clouds' ? b.cloudLeft : l.goal === 'moons' ? b.moonsLeft : l.goal === 'rocks' ? b.rocksLeft
          : l.want.reduce((s, w) => s + Math.max(0, w.n - collected[w.of]), 0);
        while (moves > 0 && left() > 0) {
          const m = b.findMoves()[0];
          const r = b.swap(m.a, m.b);
          moves--;
          score += r.tally.points;
          r.tally.kinds.forEach((v, k) => { collected[k] += v; });
        }
        if (left() <= 0) { won++; break; }
      }
    }
    expect(won).toBeGreaterThanOrEqual(6);
    expect(tries).toBeLessThan(26);
  });
});

describe('Firmament — the session', () => {
  it('plans blocks that fit any length, with the warm-up first in a first-ever session', () => {
    for (const sec of [10, 40, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(3));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        if (sec > 60) expect(sum).toBeCloseTo(sec - RULES.finale, 3);
        expect(plan.every(b => b.dur >= RULES.minBlock - 1e-9 || b.kind === 'warmup')).toBe(true);
        if (first) expect(plan[0].kind).toBe('warmup');
        expect(plan[plan.length - 1].kind).toBe('night');
      }
    }
  });

  it('opens a first-ever session with the story card and the root verse, then the goal card, then play', () => {
    const sim = makeSim();
    const evs = sim.take();
    expect(ofType(evs, 'story')[0]).toMatchObject({ constellation: 0, open: true });
    expect(sim.stage).toBe('story');
    const out = toPlay(sim);
    expect(ofType(out, 'intro')).toHaveLength(1);
    expect(sim.stage).toBe('play');
  });

  it('scores with the smoke test’s crude input: a centre tap every 0.65 s and Space every 2 s', () => {
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    let nextTap = 0.65, nextSpace = 2;
    const centre = sim.board.at(5, 4);
    while (clock.t < 22) {
      drive(sim, STEP, frame({ level: 0.7, activity: 4, focused: true, calm: 0.2 }), clock);
      if (clock.t >= nextTap) { sim.tap(centre); nextTap += 0.65; }
      if (clock.t >= nextSpace) { sim.space(); nextSpace += 2; }
    }
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.headline().value).toBe(sim.result().score);
  });

  it('charges the telescope only above the threshold in a sighted Obserwacja, after the lead-in', () => {
    expect(chargeRate(0.5)).toBe(0);
    expect(chargeRate(0.9)).toBeCloseTo(1 / RULES.chargeSec, 5);
    const sim = later();
    const clock = { t: 0 };
    toPlay(sim, clock);
    expect(sim.block.kind).toBe('obs');
    const evs = drive(sim, 4, HIGH, clock);
    expect(ofType(evs, 'tool')).toHaveLength(0);   // the lead-in
    const more = drive(sim, 10, HIGH, clock);
    expect(ofType(more, 'tool').length).toBeGreaterThanOrEqual(1);
    const low = later();
    toPlay(low);
    expect(ofType(drive(low, 20, LOW), 'tool')).toHaveLength(0);
    const none = later();
    toPlay(none);
    expect(ofType(drive(none, 20, NONE), 'tool')).toHaveLength(0);
    expect(none.meter()).toBeNull();
  });

  it('turns a long held focus into a pulsar tool', () => {
    const sim = later();
    const clock = { t: 0 };
    toPlay(sim, clock);
    const evs = drive(sim, 20, t => frame({ activity: 6, level: 0.9, focused: true, hold: t, calm: 0 }), clock);
    expect(ofType(evs, 'pulsarReady')).toHaveLength(1);
    expect(sim.tray.includes('pulsar') || ofType(evs, 'tool').some(e => e.tool === 'pulsar')).toBe(true);
  });

  it('uses the tools: the hammer on a cell, +5 moves at once', () => {
    const sim = later({ progress: { kit: ['hammer', 'moves'] } });
    toPlay(sim);
    expect(sim.tray).toEqual(['hammer', 'moves']);
    const moves = sim.movesLeft;
    sim.pickTool(1);
    expect(sim.movesLeft).toBe(moves + RULES.toolMoves);
    sim.pickTool(0);
    expect(sim.armedTool).toBe('hammer');
    const at = sim.board.cells.findIndex((p, i) => p && sim.board.free(i));
    sim.tap(at);
    expect(sim.tray).toEqual([]);
    expect(sim.movesLeft).toBe(moves + RULES.toolMoves);   // a tool costs no move
    expect(sim.score).toBeGreaterThan(0);
  });

  it('lands falling stars in the calm sky: comets, then two moves back', () => {
    const sim = later();
    const clock = { t: 0 };
    toPlay(sim, clock);
    while (sim.block.kind !== 'night') drive(sim, 0.5, frame(), clock);
    const moves = sim.movesLeft;
    const evs = drive(sim, 18, LOW, clock);
    expect(ofType(evs, 'star').length).toBe(RULES.starMax);
    expect(ofType(evs, 'changed').filter(e => e.why === 'star').length).toBe(2);
    expect(sim.movesLeft).toBe(moves + RULES.starMoves);
    expect(sim.meter()).toBeGreaterThan(0.5);
  });

  it('out of moves is a gentle retry: a card, then a new sky for the same level, the points kept', () => {
    const sim = later({ progress: { level: 1 } });   // a clouds level: one move will not clear them all
    const clock = { t: 0 };
    toPlay(sim, clock);
    sim.movesLeft = 1;
    sim.space();
    drive(sim, 3, frame(), clock);
    expect(sim.stage).toBe('out');
    const score = sim.score;
    const evs = drive(sim, RULES.outSec + 0.5, frame(), clock);
    expect(ofType(evs, 'intro')).toHaveLength(1);
    expect(sim.attempt).toBe(1);
    expect(sim.level.index).toBe(1);
    expect(sim.score).toBe(score);
  });

  it('out of moves with +5 in the tray: Space uses it and play goes on', () => {
    const sim = later({ progress: { level: 1, kit: ['moves'] } });
    const clock = { t: 0 };
    toPlay(sim, clock);
    sim.movesLeft = 1;
    sim.space();
    drive(sim, 3, frame(), clock);
    expect(sim.stage).toBe('out');
    drive(sim, 1, frame(), clock);
    sim.space();
    expect(sim.stage).toBe('play');
    expect(sim.movesLeft).toBe(RULES.toolMoves);
  });

  it('wins a level: the comet shower, the stars, the next level', () => {
    const sim = later();
    const clock = { t: 0 };
    toPlay(sim, clock);
    sim.levelScore = sim.level.n;   // level 1 is a score goal: it plays every move, then checks
    sim.movesLeft = 1;
    sim.space();
    const evs = drive(sim, 14, frame(), clock);
    expect(ofType(evs, 'shower')).toHaveLength(1);
    expect(ofType(evs, 'won')).toHaveLength(1);
    expect(sim.p.level).toBe(1);
    expect(sim.p.stars[0]).toBeGreaterThanOrEqual(1);
    drive(sim, RULES.wonSec + 2, frame(), clock);
    toPlay(sim, clock);
    expect(sim.level.index).toBe(1);
  });

  it('veils every 4th Obserwacja from the 3rd session and reveals its tools at the end', () => {
    const sim = makeSim({ progress: { sessions: 4, pushes: 2, story: [0, 1, 2, 3, 4, 5], seen: ['x'] } });
    const clock = { t: 0 };
    toPlay(sim, clock);
    let blind = false;
    const evs: SimEvent[] = [];
    while (sim.phase === 'play' && clock.t < 300) {
      evs.push(...drive(sim, 0.5, HIGH, clock));
      if (sim.blind) { blind = true; expect(sim.meter()).toBeNull(); }
    }
    expect(blind).toBe(true);
    const ends = ofType(evs, 'blockEnd').filter(e => e.block.blind);
    expect(ends.length).toBeGreaterThan(0);
  });

  it('keeps the signal() honest: focus, rest, the seconds left and the next block in the telegraph', () => {
    const sim = later();
    const clock = { t: 0 };
    toPlay(sim, clock);
    const s = sim.signal();
    expect(s.want).toBe('focus');
    expect(s.left).toBeGreaterThan(0);
    expect(s.task).toBeTruthy();
    while (sim.blockT < sim.block.dur - RULES.telegraph + 0.2) drive(sim, 0.2, frame(), clock);
    expect(sim.signal().next).toBe('rest');
  });

  it('says Bubo’s lines one at a time, never in a block’s first seconds', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = toPlay(sim, clock);
    evs.push(...drive(sim, 60, frame(), clock));
    for (const s of ofType(evs, 'say')) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(90);
    }
    expect(ofType(evs, 'say').length).toBeGreaterThan(0);
  });

  it('teaches the first session with coach marks, once each', () => {
    const sim = makeSim();
    const clock = { t: 0 };
    const evs = toPlay(sim, clock);
    evs.push(...drive(sim, 6, frame(), clock));
    const keys = ofType(evs, 'coach').map(e => e.key);
    expect(keys).toContain('hint.swap');
    expect(new Set(keys).size).toBe(keys.length);
    expect(sim.p.seen).toContain('hint.swap');
  });

  it('settles once, carries tools over and keeps result() idempotent', () => {
    const sim = later({ progress: { kit: ['ray'] } });
    const clock = { t: 0 };
    toPlay(sim, clock);
    sim.space();
    drive(sim, 2, frame(), clock);
    const a = sim.result(), b = sim.result();
    expect(a.score).toBe(b.score);
    expect(sim.p.best['300']).toBe(a.score);
    sim.finish();
    const total = sim.p.total;
    sim.finish();
    expect(sim.p.total).toBe(total);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.kit).toEqual(['ray']);
    expect(a.verse).toBeTruthy();
    expect(passage(a.verse!).text.length).toBeGreaterThan(5);
    expect(a.highlights.some(h => h.startsWith('Bubo'))).toBe(true);
  });
});

describe('Firmament — progress', () => {
  it('migrates a version-1 save: sessions, points and records kept, the map starts over', () => {
    const old = {
      v: 1, sessions: 7, total: 12345, level: 23, stars: [3, 2, 3, 1, 'x'], pushes: 15, tools: 9, pulsars: 2, rescues: 3,
      bestCascade: 6, best: { '300': 2400, '180': 'bad' }, lastLen: 300, giftDay: '2026-11-03',
    };
    const p = migrate({ ...freshProgress(), ...(old as unknown as Partial<FirmamentProgress>) });
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.total).toBe(12345);
    expect(p.best).toEqual({ '300': 2400 });
    expect(p.level).toBe(0);
    expect(p.stars).toEqual([]);
    expect((p as unknown as Record<string, unknown>).giftDay).toBeUndefined();
    expect(bestOf(p)).toBe(2400);
    // and a sim runs on it
    const sim = new FirmamentSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.level.index).toBe(0);
    expect(migrate(p)).toEqual(p);
  });

  it('never trusts a field of the wrong type in a version-2 save', () => {
    const p = migrate({ ...freshProgress(), level: 'x', kit: ['hammer', 'nope', 'ray', 'moves'], seen: [1, 'hint.swap'] } as unknown as FirmamentProgress);
    expect(p.level).toBe(0);
    expect(p.kit).toEqual(['hammer', 'ray']);
    expect(p.seen).toEqual(['hint.swap']);
  });

  it('keeps the best stars of a level and moves the saga on', () => {
    const p = freshProgress();
    expect(winLevel(p, 0, 2)).toBe(2);
    expect(winLevel(p, 0, 1)).toBe(0);
    expect(p.stars[0]).toBe(2);
    expect(p.level).toBe(1);
  });
});

describe('Firmament — words', () => {
  it('has every text in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    expect(unit(5)).toBeTruthy();
    expect(t('moves', { n: 5 })).toContain('5');
  });

  it('keeps Bubo’s lines short (≤ 90 characters), three for every moment', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (k.startsWith('bubo.') && k !== 'bubo.name') expect(typeof v === 'string' && v.length <= 90, `${l}.${k}`).toBe(true);
      }
    }
    for (const m of ['open', 'push', 'rest', 'tool', 'star', 'near', 'out', 'big', 'hard', 'win', 'three', 'moon', 'blind', 'special', 'end']) {
      for (let k = 0; k < 3; k++) expect(line(m, k)).toBeTruthy();
    }
  });

  it('never tells anyone to try harder', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (typeof v === 'string' && k.startsWith('tip.')) expect(/mocniej|harder|stärker/i.test(v)).toBe(false);
      }
    }
  });
});

// ── mobile first ────────────────────────────────────────────────────
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
interface Played { game: ArcadeGame; sim: FirmamentSim; view: { L: Layout; press: unknown; aim: number }; sizes: { text: string; px: number }[] }
const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe('Firmament — mobile first (DESIGN §8.4, §12)', () => {
  const sizes: { text: string; px: number }[] = [];
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this, sizes); }; });
  afterAll(() => { proto.getContext = original; });

  const RETURNING: Partial<FirmamentProgress> = { sessions: 5, pushes: 1, story: [0, 1, 2, 3, 4, 5, 6, 7], seen: ['x'] };

  /** The real game on a canvas of w × h with the runner's insets, a few frames in. */
  function play(size: Size, progress: Partial<FirmamentProgress> = RETURNING, touch = true): Played {
    const env: GameEnv<FirmamentProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), ...progress }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    sizes.length = 0;
    const game = firmament.create(env);
    game.resize(size.w, size.h, 1);
    game.start();
    const inner = game as unknown as { sim: FirmamentSim; view: Played['view'] };
    const p: Played = { game, sim: inner.sim, view: inner.view, sizes };
    frames(p, 4);
    return p;
  }
  function frames(p: Played, n: number, f: FocusFrame = frame()): void {
    for (let i = 0; i < n; i++) {
      p.game.update(STEP, f, p.sim.t + STEP);
      p.game.draw();
    }
  }
  /** Through the cards to play (a tap on each). */
  function toBoard(p: Played): void {
    for (let k = 0; k < 200 && p.sim.stage !== 'play'; k++) {
      frames(p, 3);
      tap(p, { x: p.view.L.w / 2, y: p.view.L.h * 0.6 });
    }
    frames(p, 2);
  }
  const tap = (p: Played, at: { x: number; y: number }, id = 1) => {
    p.game.pointer!({ type: 'down', ...at, id });
    p.game.pointer!({ type: 'up', ...at, id });
  };
  const swipe = (p: Played, from: { x: number; y: number }, dx: number, dy: number, id = 2) => {
    p.game.pointer!({ type: 'down', ...from, id });
    for (let k = 1; k <= 4; k++) p.game.pointer!({ type: 'move', x: from.x + (dx * k) / 4, y: from.y + (dy * k) / 4, id });
    p.game.pointer!({ type: 'up', x: from.x + dx, y: from.y + dy, id });
  };
  const cellAt = (p: Played, i: number) => {
    const L = p.view.L;
    return { x: L.board.x + ((i % L.cols) + 0.5) * L.cell, y: L.board.y + (Math.floor(i / L.cols) + 0.5) * L.cell };
  };
  /** Two neighbours whose swap lands (a move), and two free neighbours whose swap does not. */
  function moves(sim: FirmamentSim): { good: [number, number]; dud: [number, number] | null } {
    const B = sim.board;
    const good = B.findMoves()[0];
    let dud: [number, number] | null = null;
    for (let i = 0; i < B.n && !dud; i++) {
      const j = i + 1;
      if (B.c(i) < B.cols - 1 && B.free(i) && B.free(j) && B.swapValue(i, j) <= 0) dud = [i, j];
    }
    return { good: [good.a, good.b], dud };
  }

  it('gives every control a finger-sized target inside the insets, clear of the others, at every size and stage', () => {
    for (const c of CHECK_SIZES) {
      for (const slots of [RULES.tray, RULES.trayMax]) {
        const L = layout(c.w, c.h, c.insets, RULES.rows, RULES.cols, slots);
        for (let tools = 0; tools <= slots; tools++) {
          const ts = tapTargets(L, { stage: 'play', tools, can: false });
          expect(ts).toHaveLength(tools);
          expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: ${tools} of ${slots} tools`).toEqual([]);
        }
        for (const stage of ['story', 'intro', 'won'] as const) {
          expect(auditTargets(tapTargets(L, { stage, tools: slots, can: false }), c.w, c.h, c.insets), `${c.name}: ${stage}`).toEqual([]);
        }
        for (const can of [false, true]) {
          const ts = tapTargets(L, { stage: 'out', tools: slots, can });
          expect(ts).toHaveLength(can ? 2 : 1);
          expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: out of moves${can ? ' with +5' : ''}`).toEqual([]);
          // the buttons sit inside their card
          const r = cardRect(L, 'out');
          for (const b of ts) expect(b.y >= r.y && b.y + b.h <= r.y + r.h, `${c.name}: ${b.label}`).toBe(true);
        }
        expect(tapTargets(L, { stage: 'shower', tools: slots, can: true })).toEqual([]);
      }
    }
  });

  it('lays a phone upright out from the thumb: the tray and the buttons in the thumb zone, the goal under the HUD, the board as large as the band allows', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      for (const slots of [RULES.tray, RULES.trayMax]) {
        const L = layout(c.w, c.h, c.insets, RULES.rows, RULES.cols, slots);
        expect(L.mode, c.name).toBe('tall');
        expect(L.u).toBeLessThan(1.1);
        const zone = c.h * (1 - THUMB);
        for (const r of L.tray) {
          expect(r.w, c.name).toBeGreaterThanOrEqual(48);
          expect(r.y, c.name).toBeGreaterThanOrEqual(zone);
          expect(r.x).toBeGreaterThanOrEqual(c.insets.left + 16 - 0.01);
          expect(r.x + r.w).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
          // over the home indicator, and off the canvas's last row (the dock's forwarded touches land there)
          expect(r.y + r.h).toBeLessThanOrEqual(c.h - c.insets.bottom - 2);
        }
        for (let k = 1; k < L.tray.length; k++) expect(L.tray[k].x - (L.tray[k - 1].x + L.tray[k - 1].w)).toBeGreaterThanOrEqual(TAP_GAP);
        const b = outButtons(L, true);
        for (const r of [b.use!, b.retry]) {
          expect(r.y, c.name).toBeGreaterThanOrEqual(zone);
          expect(r.h).toBeGreaterThanOrEqual(48);
        }
        // the goal strip right under the HUD; the board under it, over the tray, never under the HUD
        expect(L.goal.y).toBeGreaterThanOrEqual(c.insets.top);
        expect(L.goal.y - c.insets.top).toBeLessThanOrEqual(4);
        expect(L.board.y).toBeGreaterThanOrEqual(L.goal.y + L.goal.h);
        expect(L.board.y + L.board.h).toBeLessThanOrEqual(L.tray[0].y - 4);
        // as large as the band allows: the room left over the board and under it is a few px, or the width is used
        const spare = L.tray[0].y - (L.goal.y + L.goal.h) - L.board.h;
        expect(spare < 30 || L.board.w >= c.w - 20, `${c.name}: ${spare} px spare, board ${L.board.w}`).toBe(true);
        // the telescope's lens in the row, its trail clear of the board
        expect(L.scope.y - L.scope.r * 1.3 - 4).toBeGreaterThanOrEqual(L.board.y + L.board.h - 1);
        // a story, the goal, the tally and out of moves are bottom sheets
        for (const kind of ['story', 'intro', 'won', 'out'] as const) {
          const r = cardRect(L, kind);
          expect(r.y + r.h, `${c.name}: ${kind}`).toBeCloseTo(c.h - c.insets.bottom - 3, 0);
          expect(r.y).toBeGreaterThanOrEqual(L.goal.y + L.goal.h);
        }
      }
    }
    // the cells: 32 px on the smallest band (360 × 366), 40 on an iPhone in Safari, the width filled where the band is tall
    const cellOf = (name: string) => layout(...((c => [c.w, c.h, c.insets] as const)(CHECK_SIZES.find(x => x.name === name)!))).cell;
    expect(cellOf('small phone (Chrome)')).toBeGreaterThanOrEqual(32);
    expect(cellOf('iPhone (Safari)')).toBeGreaterThanOrEqual(40);
    expect(cellOf('large phone (Chrome)')).toBeGreaterThanOrEqual(MIN_TAP);
    expect(cellOf('iPhone (installed app, chart off)')).toBeGreaterThanOrEqual(MIN_TAP);
  });

  it('lays a phone on its side out in three columns: the goal and Bubo, the board as tall as the band, the telescope and the tray under the right thumb', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      for (const slots of [RULES.tray, RULES.trayMax]) {
        const L = layout(c.w, c.h, c.insets, RULES.rows, RULES.cols, slots);
        expect(L.mode).toBe('side');
        expect(L.cell, c.name).toBeGreaterThanOrEqual(35);
        expect(L.board.h).toBeGreaterThanOrEqual((c.h - c.insets.top - c.insets.bottom) * 0.9);
        expect(L.goal.x + L.goal.w).toBeLessThan(L.board.x);
        expect(L.goal.y).toBeGreaterThanOrEqual(c.insets.top);
        expect(L.owl.x + L.owl.r).toBeLessThan(L.board.x);
        expect(L.scope.x - L.scope.r * 1.3).toBeGreaterThan(L.board.x + L.board.w);
        expect(L.scope.y - L.scope.r * 1.3).toBeGreaterThanOrEqual(c.insets.top);
        for (const r of L.tray) {
          expect(r.x).toBeGreaterThan(L.board.x + L.board.w);
          expect(r.w).toBeGreaterThanOrEqual(48);
          expect(r.y + r.h).toBeLessThanOrEqual(c.h - c.insets.bottom);
          expect(r.x + r.w).toBeLessThanOrEqual(c.w - c.insets.right);
        }
        expect(L.scopeText!.y).toBeLessThan(Math.min(...L.tray.map(r => r.y)) - 30);
        // room for the telescope's words in two lines at least, clear of the tray
        expect(L.scopeText!.h, c.name).toBeGreaterThanOrEqual(2 * 16);
        expect(L.scopeText!.y + L.scopeText!.h).toBeLessThanOrEqual(Math.min(...L.tray.map(r => r.y)));
      }
    }
  });

  it('grows on a tablet and a desktop (never past 1.3), with the board as large as before on a desktop', () => {
    for (const c of CHECK_SIZES.filter(x => Math.min(x.w, x.h) > 600)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.u).toBeGreaterThan(1);
      expect(L.u).toBeLessThanOrEqual(1.3);
      for (const r of L.tray) expect(r.w).toBeGreaterThanOrEqual(52);
      expect(L.cell).toBeGreaterThanOrEqual(60);
    }
    expect(layout(1280, 672, { top: 192, right: 0, bottom: 0, left: 0 }).board.w).toBeGreaterThanOrEqual(600);
  });

  it('swaps under a finger: a swipe from 10 px, a tap and a tap, a tap again lets go, a swipe from a body picked by a tap', () => {
    const small = CHECK_SIZES[0];
    const p = play(small);
    toBoard(p);
    const sim = p.sim, B = sim.board;
    expect(p.view.L.reach).toBeGreaterThanOrEqual(10);
    // a tap picks a body, a second tap on it lets it go
    const { good } = moves(sim);
    tap(p, cellAt(p, good[0]));
    expect(sim.selected).toBe(good[0]);
    tap(p, cellAt(p, good[0]));
    expect(sim.selected).toBe(-1);
    // a short wobble is still a tap
    p.game.pointer!({ type: 'down', ...cellAt(p, good[0]), id: 3 });
    p.game.pointer!({ type: 'move', x: cellAt(p, good[0]).x + 6, y: cellAt(p, good[0]).y + 3, id: 3 });
    p.game.pointer!({ type: 'up', x: cellAt(p, good[0]).x + 6, y: cellAt(p, good[0]).y + 3, id: 3 });
    expect(sim.selected).toBe(good[0]);
    // a swipe from the picked body still swaps (it used to let it go on the way down)
    const moves0 = sim.movesLeft;
    const a = cellAt(p, good[0]), b = cellAt(p, good[1]);
    swipe(p, a, Math.sign(b.x - a.x) * 14, Math.sign(b.y - a.y) * 14);
    expect(sim.movesLeft).toBe(moves0 - 1);
    expect(sim.selected).toBe(-1);
    // a swap that makes nothing bounces back for free; a tap and a tap on two neighbours swaps them
    frames(p, 90);
    const m = moves(sim);
    tap(p, cellAt(p, m.good[0]));
    tap(p, cellAt(p, m.good[1]));
    expect(sim.movesLeft).toBe(moves0 - 2);
    frames(p, 90);
    const d = moves(sim).dud;
    if (d) {
      const busy = sim.movesLeft;
      swipe(p, cellAt(p, d[0]), 14, 0);
      expect(sim.movesLeft).toBe(busy);
      expect(B === sim.board).toBe(true);
    }
  });

  it('takes a touch a little off the board as the nearest body, and the free sky as letting go', () => {
    const p = play(CHECK_SIZES[1]);
    toBoard(p);
    const L = p.view.L, sim = p.sim;
    const edge = sim.board.findMoves()[0];
    void edge;
    // just left of the board's first column, level with row 3: the body at (3, 0)
    const at = sim.board.at(3, 0);
    if (sim.board.free(at)) {
      tap(p, { x: L.board.x - L.slop + 2, y: L.board.y + 3.5 * L.cell });
      expect(sim.selected).toBe(at);
      tap(p, { x: L.board.x - L.slop - 6, y: L.board.y + 3.5 * L.cell });
      expect(sim.selected).toBe(-1);
    }
  });

  it('aims a tool while the finger is down and strikes where it lifts; lifted off the board, the tool stays', () => {
    const p = play(CHECK_SIZES[1], { ...RETURNING, kit: ['hammer', 'ray'] });
    toBoard(p);
    const sim = p.sim, L = p.view.L;
    expect(p.game.targets!().map(x => x.label)).toEqual(['tool 1', 'tool 2']);
    tap(p, mid(L.tray[1]));
    expect(sim.armedTool).toBe('ray');
    const at = sim.board.at(4, 4), c = cellAt(p, at);
    p.game.pointer!({ type: 'down', ...c, id: 5 });
    expect(p.view.aim).toBe(at);
    expect(sim.tray).toHaveLength(2);
    // slid off the board and lifted: nothing struck
    p.game.pointer!({ type: 'move', x: c.x, y: L.goal.y + 2, id: 5 });
    p.game.pointer!({ type: 'up', x: c.x, y: L.goal.y + 2, id: 5 });
    expect(sim.tray).toHaveLength(2);
    expect(sim.armedTool).toBe('ray');
    // down, slid to the next row, lifted: the ray strikes the row it ended on
    const score = sim.score;
    p.game.pointer!({ type: 'down', ...c, id: 6 });
    p.game.pointer!({ type: 'move', x: c.x, y: c.y + L.cell, id: 6 });
    expect(p.view.aim).toBe(sim.board.at(5, 4));
    p.game.pointer!({ type: 'up', x: c.x, y: c.y + L.cell, id: 6 });
    expect(sim.tray).toEqual(['hammer']);
    expect(sim.score).toBeGreaterThan(score);
  });

  it('answers the targets it reports: a tool picks, a card goes on, out of moves the buttons work', () => {
    const p = play(CHECK_SIZES[0], { ...RETURNING, level: 1, kit: ['moves'] });
    // the goal card is a target: a tap on it goes on
    frames(p, 30);
    expect(p.sim.stage).toBe('intro');
    const card = p.game.targets!();
    expect(card.map(x => x.label)).toEqual(['intro']);
    tap(p, mid(card[0]));
    expect(p.sim.stage).toBe('play');
    // out of moves with +5 in the tray: the card's first button plays on
    p.sim.movesLeft = 1;
    p.sim.space();
    for (let k = 0; k < 120 && p.sim.stage !== 'out'; k++) frames(p, 1);
    expect(p.sim.stage).toBe('out');
    frames(p, 40);
    const ts = p.game.targets!();
    expect(ts.map(x => x.label)).toEqual(['out: +5', 'out: retry']);
    for (const x of ts) expect(auditTargets([x], CHECK_SIZES[0].w, CHECK_SIZES[0].h, CHECK_SIZES[0].insets)).toEqual([]);
    tap(p, mid(ts[0]));
    expect(p.sim.stage).toBe('play');
    expect(p.sim.movesLeft).toBe(RULES.toolMoves);
  });

  it('never draws text under 11 px at any size: the play, a tool in hand, Bubo, every card', () => {
    for (const c of CHECK_SIZES) {
      const p = play(c, { ...freshProgress() }, c.name !== 'desktop');
      const seen: { text: string; px: number }[] = [];
      const stages = new Set<string>();
      const grab = () => { seen.push(...p.sizes); p.sizes.length = 0; stages.add(p.sim.stage); };
      // the story card of a first session, its goal card, play
      frames(p, 40);
      grab();
      expect(p.sim.stage).toBe('story');
      tap(p, { x: c.w / 2, y: c.h * 0.6 });
      frames(p, 20);
      expect(p.sim.stage).toBe('intro');
      grab();
      toBoard(p);
      // a tool armed, Bubo talking, a move's points flying
      p.sim.tray.push('hammer', 'moves');
      p.sim.pickTool(0);
      (p.game as unknown as { view: { on: (e: SimEvent, s: FirmamentSim) => void } }).view.on({ type: 'say', text: line('open', 1), moment: 'open' }, p.sim);
      p.sim.space();
      frames(p, 30);
      grab();
      // out of moves (with +5 to offer), then the tally of a won level
      p.sim.pickTool(0);
      p.sim.movesLeft = 1;
      p.sim.space();
      for (let k = 0; k < 200 && p.sim.stage !== 'out' && p.sim.stage !== 'shower' && p.sim.stage !== 'won'; k++) frames(p, 1);
      frames(p, 30);
      grab();
      if (p.sim.stage === 'out') {
        tap(p, mid(p.game.targets!()[0]));
        p.sim.levelScore = p.sim.level.n * 3;
        p.sim.movesLeft = 1;
        p.sim.space();
        for (let k = 0; k < 400 && (p.sim.stage as string) !== 'won'; k++) frames(p, 1);
        frames(p, 40);
        grab();
      }
      expect(seen.length, c.name).toBeGreaterThan(20);
      expect([...stages].sort(), c.name).toEqual(['intro', 'out', 'play', 'story', 'won']);
      // the words that ask to be read: the cards' lines, the bubble, the tool's use
      for (const key of ['story.tap', 'card.tap', 'out.retry'] as const) {
        const w = seen.filter(x => x.text === t(key));
        expect(w.length, `${c.name}: ${key}`).toBeGreaterThan(0);
        for (const x of w) expect(x.px, `${c.name}: ${key}`).toBeGreaterThanOrEqual(MIN_READ);
      }
      for (const x of seen.filter(y => y.text === t('use.hammer'))) expect(x.px).toBeGreaterThanOrEqual(MIN_READ - 1);
      const tiny = seen.filter(x => x.px < MIN_TEXT);
      expect(tiny, `${c.name}: ${JSON.stringify(tiny.slice(0, 5))}`).toEqual([]);
    }
  });

  it('keeps its font helper over the floor, and the words to read to play at 13 px and more', () => {
    for (const px of [0, 3, 6.6, 8, 10.4, 10.99, 11, 12.3, 13, 30]) expect(pxOf(font(700, px, SANS))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fontPx(4)).toBe(MIN_TEXT);
    expect(pxOf(font(800, 14.24, SANS))).toBe(14.2);
    expect(MIN_READ).toBe(13);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus|strzałk|arrow|pfeil|pil/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['how.goal', 'how.swipe', 'how.tool', 'hint.swap', 'hint.space.touch', 'hint.tool', 'use.hammer', 'use.ray', 'use.pulsar', 'card.tap', 'story.tap']) {
        expect(c[k], `${l}.${k}`).toBeTypeOf('string');
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      expect(c['how.keys'], `${l}.how.keys`).toMatch(KEYS);
      expect(c['hint.space'], `${l}.hint.space`).toMatch(KEYS);
      // the registry's tips show on the calibration card of a phone too
      const shared = SHARED[l] as Record<string, unknown>;
      for (let i = 1; i <= 5; i++) expect(shared[`firmament.tip${i}`], `${l}.firmament.tip${i}`).not.toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands[0].gesture).toBe('swipe');
    expect(desk.hands[0].gesture).toBe('drag');
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
  });

  it('shows the shortcut digits on a desktop only, and offers no target that is not on screen', () => {
    const desk = play(CHECK_SIZES[CHECK_SIZES.length - 1], { ...RETURNING, kit: ['hammer'] }, false);
    toBoard(desk);
    desk.sizes.length = 0;
    frames(desk, 2);
    expect(desk.sizes.some(x => x.text === '1')).toBe(true);
    const phone = play(CHECK_SIZES[0], { ...RETURNING, kit: ['hammer'] }, true);
    toBoard(phone);
    phone.sizes.length = 0;
    frames(phone, 2);
    expect(phone.sizes.some(x => x.text === '1')).toBe(false);
    expect(phone.game.targets!().map(x => x.label)).toEqual(['tool 1']);
    // the finale: nothing to tap
    phone.sim.finish();
    expect(phone.game.targets!()).toEqual([]);
  });
});
