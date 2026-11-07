import { describe, expect, it } from 'vitest';
import { Board, MOON, PULSAR, setCells, type Sp } from '../src/arcade/firmament/board';
import { CONSTELLATIONS, constName, figure } from '../src/arcade/firmament/content';
import { CATALOGS, line, t, unit } from '../src/arcade/firmament/i18n';
import { boardSpec, difficulty, layoutCounts, levelAt, starsFor, traySize } from '../src/arcade/firmament/levels';
import { bestOf, freshProgress, migrate, winLevel, type FirmamentProgress } from '../src/arcade/firmament/meta';
import { RULES } from '../src/arcade/firmament/rules';
import { FirmamentSim, chargeRate, planBlocks, type SimEvent } from '../src/arcade/firmament/sim';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

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
