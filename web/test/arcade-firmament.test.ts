import { describe, expect, it } from 'vitest';
import { Board, PULSAR, SAT, setCells, type Sp } from '../src/arcade/firmament/board';
import { CATALOGS, t, unit } from '../src/arcade/firmament/i18n';
import { boardSpec, difficulty, figureOf, levelAt, toolsFor, traySize } from '../src/arcade/firmament/levels';
import { bestOf, freshProgress, winLevel, type FirmamentProgress } from '../src/arcade/firmament/meta';
import { RULES } from '../src/arcade/firmament/rules';
import { FirmamentSim, lensRate, planBlocks, starsFor, type SimEvent } from '../src/arcade/firmament/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-03';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ activity: 6, level: 0.9, focused: true, calm: 0.05 });
const LOW = frame({ activity: -2, level: 0.1, calm: 0.9 });

type SimOpts = { progress?: Partial<FirmamentProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };
function makeSim(o: SimOpts = {}): FirmamentSim {
  const sim = new FirmamentSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: 4242,
    plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}
/** A returning player (no warm-up, no gift): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, pushes: 1, ...o.progress } });

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
function toBlock(sim: FirmamentSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}
/** Play the best move and let it land. */
function play(sim: FirmamentSim, clock = { t: 0 }, f: FocusFrame = frame()): SimEvent[] {
  const m = sim.board.findMoves()[0];
  sim.trySwap(m.a, m.b);
  const out = [...sim.take()];
  out.push(...drive(sim, sim.busyT + 0.05, f, clock));
  return out;
}

/** A board with no randomness left to chance: the cells set by hand (letters a..f are the six kinds). */
function board(rows: string[], seed = 7, kinds = 6): Board {
  const b = new Board({ kinds, seed });
  setCells(b, rows);
  return b;
}
const kindsOf = (b: Board) => b.cells.map(p => (p ? p.kind : null));
const special = (b: Board, r: number, c: number, sp: Sp) => { b.cells[b.at(r, c)]!.sp = sp; };

// eight rows without a match anywhere (a checker of three kinds shifted per row)
const CALM = ['abcabcab', 'bcabcabc', 'cabcabca', 'abcabcab', 'bcabcabc', 'cabcabca', 'abcabcab', 'bcabcabc'];

describe('matches', () => {
  it('finds lines of three and more in rows and columns, and nothing in a calm sky', () => {
    expect(board(CALM).findGroups(null)).toEqual([]);
    const b = board(['aaabefef', ...CALM.slice(1)]);
    const g = b.findGroups(null);
    expect(g).toHaveLength(1);
    expect(g[0].cells).toEqual([0, 1, 2]);
    expect(g[0].make).toBe('none');
  });

  it('makes a comet of four along its line, a pulsar of five, a supernova of an L or a T', () => {
    const four = board(['dddd' + 'efef', ...CALM.slice(1)]).findGroups(null);
    expect(four[0].make).toBe('row');
    const col = board(CALM.map((r, i) => (i < 4 ? 'f' + r.slice(1) : r))).findGroups(null);
    expect(col[0].make).toBe('col');
    const five = board(['ddddd' + 'efe', ...CALM.slice(1)]).findGroups(null);
    expect(five[0].make).toBe('pulsar');
    // an L: three across the top and three down the left
    const l = board(['fffe' + 'dede', 'fcabcabc', 'fabcabca', ...CALM.slice(3)]).findGroups(null);
    expect(l).toHaveLength(1);
    expect(l[0].make).toBe('nova');
    expect(l[0].at).toBe(0);
    expect(l[0].cells).toEqual([0, 1, 2, 8, 16]);
    // a T: three across, three down from its middle
    const tee = board(['efffe' + 'ded', 'bcfbcabc', 'cafcabca', ...CALM.slice(3)]).findGroups(null);
    expect(tee[0].make).toBe('nova');
    expect(tee[0].at).toBe(2);
  });

  it('puts the special where the moved body landed', () => {
    // swapping (0,3) with (1,3) brings a "d" into a row of d d d _ d
    const b = board(['dddedcab', 'bcadcabc', ...CALM.slice(2)]);
    const res = b.swap(b.at(1, 3), b.at(0, 3));
    expect(res.ok).toBe(true);
    expect(res.steps[0].born).toEqual([expect.objectContaining({ at: b.at(0, 3), sp: 'pulsar', kind: PULSAR })]);
  });
});

describe('swaps', () => {
  it('bounces a swap that makes no line back, for free', () => {
    const b = board(CALM);
    const before = kindsOf(b);
    const res = b.swap(0, 1);
    expect(res.ok).toBe(false);
    expect(kindsOf(b)).toEqual(before);
    expect(res.dur).toBe(RULES.bounceSec);
    expect(b.swap(0, 9).ok).toBe(false);   // not neighbours
  });

  it('lets the gravity instrument swap without a line', () => {
    const b = board(CALM);
    const res = b.swap(0, 1, true);
    expect(res.ok).toBe(true);
    expect(b.cells[0]!.kind).toBe(1);
    expect(b.cells[1]!.kind).toBe(0);
  });

  it('clears a line, drops what was above and fills from the top', () => {
    const b = board(['abcabcab', 'bcabcabc', 'cabcabca', 'abcabcab', 'bcabcabc', 'cabcabca', 'ddeabcab', 'bcdcabca']);
    // (7,2) "d" up into (6,2): d d d in row 6
    const above = b.cells[b.at(5, 0)]!.id;
    const res = b.swap(b.at(7, 2), b.at(6, 2));
    expect(res.ok).toBe(true);
    const s = res.steps[0];
    expect(s.cleared.map(c => c.at).sort((x, y) => x - y)).toEqual([48, 49, 50]);
    expect(s.points).toBeGreaterThanOrEqual(3 * RULES.body);
    expect(s.moves).toContainEqual({ id: above, from: b.at(5, 0), to: b.at(6, 0) });
    expect(s.spawns.filter(x => b.c(x.to) === 0)).toHaveLength(1);
    expect(b.cells.every(p => p !== null)).toBe(true);
  });

  it('multiplies the points of a cascade by its step', () => {
    for (let seed = 1; seed < 200; seed++) {
      const b = new Board({ kinds: 4, seed });
      const m = b.findMoves()[0];
      const res = b.swap(m.a, m.b);
      if (res.steps.length < 2) continue;
      const s2 = res.steps[1];
      expect(s2.cascade).toBe(2);
      expect(s2.points).toBeGreaterThanOrEqual(s2.cleared.filter(c => c.kind >= 0).length * RULES.body * 2);
      return;
    }
    throw new Error('no cascade in 200 boards');
  });
});

describe('specials', () => {
  it('a comet clears its row (or its column)', () => {
    const b = board(['abcabcab', 'bcabcabc', 'cabcabca', 'abcabcab', 'bcabcabc', 'cabcabca', 'abcdcabc', 'bcadcabc']);
    special(b, 6, 0, 'row');
    // the ray sets the comet off where it sits
    const res = b.useTool('ray', b.at(6, 0))!;
    const blasts = res.steps[0].blasts.map(x => x.kind);
    expect(blasts).toContain('row');
    expect(res.steps[0].cleared.filter(c => b.r(c.at) === 6)).toHaveLength(8);
  });

  it('a supernova blasts 3×3, falls, and blasts again', () => {
    const b = board(CALM);
    special(b, 4, 4, 'nova');
    const id = b.cells[b.at(4, 4)]!.id;
    const res = b.useTool('ray', b.at(4, 4))!;
    const novaBlasts = res.steps.flatMap(s => s.blasts).filter(x => x.kind === 'nova');
    expect(novaBlasts).toHaveLength(2);
    expect(novaBlasts[0].cells).toHaveLength(9);
    expect(res.steps[0].changed).toContainEqual(expect.objectContaining({ id, armed: true }));
    expect(b.cells.some(p => p?.id === id)).toBe(false);
  });

  it('a pulsar swapped with a body clears every body of that kind', () => {
    const b = board(CALM);
    b.cells[b.at(3, 3)] = { id: 999, kind: PULSAR, sp: 'pulsar', armed: false };
    const kind = b.cells[b.at(3, 4)]!.kind;
    const count = b.cells.filter(p => p && p.kind === kind).length;
    const res = b.swap(b.at(3, 3), b.at(3, 4));
    expect(res.tally.combo).toBe('pulsar');
    expect(res.steps[0].cleared.filter(c => c.kind === kind)).toHaveLength(count);
  });

  it('combines two specials: comets a cross, comet and nova three rows and columns, two novae 5×5', () => {
    const run = (a: Sp, bsp: Sp) => {
      const b = board(CALM);
      special(b, 4, 3, a);
      special(b, 4, 4, bsp);
      const res = b.swap(b.at(4, 3), b.at(4, 4));
      return res.steps[0].blasts[0];
    };
    const cross = run('row', 'col');
    expect(cross.kind).toBe('cross');
    expect(cross.cells).toHaveLength(15);
    const big = run('row', 'nova');
    expect(big.kind).toBe('big');
    expect(big.cells).toHaveLength(3 * 8 + 3 * 8 - 9);
    const n5 = run('nova', 'nova');
    expect(n5.kind).toBe('nova5');
    expect(n5.cells).toHaveLength(25);
  });

  it('a pulsar with a special turns that kind into the special; two pulsars clear the sky', () => {
    const b = board(CALM);
    b.cells[b.at(3, 3)] = { id: 999, kind: PULSAR, sp: 'pulsar', armed: false };
    special(b, 3, 4, 'nova');
    const kind = b.cells[b.at(3, 4)]!.kind;
    const count = b.cells.filter(p => p && p.kind === kind).length;
    const res = b.swap(b.at(3, 3), b.at(3, 4));
    expect(res.tally.combo).toBe('pulsar+nova');
    expect(res.steps[0].changed.filter(c => c.sp === 'nova' && !c.armed)).toHaveLength(count);
    const b2 = board(CALM);
    b2.cells[b2.at(3, 3)] = { id: 998, kind: PULSAR, sp: 'pulsar', armed: false };
    b2.cells[b2.at(3, 4)] = { id: 999, kind: PULSAR, sp: 'pulsar', armed: false };
    const all = b2.swap(b2.at(3, 3), b2.at(3, 4));
    expect(all.tally.combo).toBe('pulsar+pulsar');
    expect(all.steps[0].cleared.length).toBe(64);
  });
});

describe('dust, asteroids, satellites', () => {
  it('clears a layer of dust under a cleared body', () => {
    const b = board(['abcabcab', 'bcabcabc', 'cabcabca', 'abcabcab', 'bcabcabc', 'cabcabca', 'ddeabcab', 'bcdcabca']);
    b.dust[48] = 2;
    b.swap(b.at(7, 2), b.at(6, 2));
    expect(b.dust[48]).toBe(1);
  });

  it('hits an asteroid beside a match and breaks it at its last hit; pieces fall past it', () => {
    const b = board(['abcabcab', 'bcabcabc', 'cabcabca', 'abcabcab', 'bcabcabc', 'cabcabca', 'dd2abcab', 'bcdcabca']);
    // (6,2) is an asteroid with 2 hits; d d at (6,0..1), "d" at (7,2): no line yet — make one in row 7
    b.cells[b.at(7, 0)] = { id: 5000, kind: 3, sp: 'none', armed: false };
    b.cells[b.at(7, 1)] = { id: 5001, kind: 3, sp: 'none', armed: false };
    b.cells[b.at(7, 3)] = { id: 5002, kind: 4, sp: 'none', armed: false };
    // swap (7,3) e with (7,2) d? (7,2) is d already: lines d d d at row 7 cols 0..2 exist now — resolve with a free swap
    const res = b.swap(b.at(7, 4), b.at(7, 5), true);
    expect(res.steps[0].rocks).toContainEqual({ at: b.at(6, 2), hp: 1 });
    expect(b.rock[b.at(6, 2)]).toBe(1);
    // the column under and over the asteroid still holds pieces
    expect(b.cells[b.at(7, 2)]).not.toBeNull();
    expect(b.cells[b.at(5, 2)]).not.toBeNull();
    const r2 = b.useTool('ray', b.at(6, 2))!;
    expect(r2.tally.rocks).toBe(1);
    expect(b.rock[b.at(6, 2)]).toBe(0);
    expect(b.cells[b.at(6, 2)]).not.toBeNull();
  });

  it('brings a satellite down: it falls as the column below it clears, and leaves at the bottom', () => {
    const b = board(CALM);
    b.satTotal = 1;
    b.satSpawned = 1;
    b.cells[b.at(6, 0)] = { id: 4000, kind: SAT, sp: 'sat', armed: false };
    // a comet across row 7 takes the floor under it
    special(b, 7, 3, 'row');
    const res = b.useTool('ray', b.at(7, 3))!;
    expect(res.tally.sats).toBe(1);
    expect(b.satDown).toBe(1);
    expect(b.cells.some(p => p?.sp === 'sat')).toBe(false);
  });

  it('never clears a satellite with a blast', () => {
    const b = board(CALM);
    b.cells[b.at(2, 2)] = { id: 4000, kind: SAT, sp: 'sat', armed: false };
    special(b, 2, 5, 'row');
    b.useTool('ray', b.at(2, 5));
    expect(b.cells.some(p => p?.id === 4000)).toBe(true);
  });
});

describe('the generator and the reshuffle', () => {
  it('never starts with a match and always leaves a move, for any seed and kind count', () => {
    for (let seed = 1; seed <= 120; seed++) {
      for (const kinds of [5, 6]) {
        const b = new Board({ kinds, seed });
        expect(b.findGroups(null)).toEqual([]);
        expect(b.hasMove()).toBe(true);
        expect(b.cells.every(p => p && p.kind >= 0 && p.kind < kinds)).toBe(true);
      }
    }
  });

  it('is the same sky for the same seed (the same level for everyone), and moves resolve the same', () => {
    const play = (seed: number) => {
      const b = new Board({ kinds: 6, seed });
      const log: number[] = [];
      for (let k = 0; k < 12; k++) {
        const m = b.findMoves()[0];
        const res = b.swap(m.a, m.b);
        log.push(res.tally.points, res.steps.length);
      }
      return { kinds: kindsOf(b), log };
    };
    expect(play(42)).toEqual(play(42));
    expect(play(42).kinds).not.toEqual(play(43).kinds);
  });

  it('reshuffles when no move is left: no match, a move, the same pieces', () => {
    // two kinds can be laid out without a move; the reshuffle has to find one
    const b = board(['abcdefab', 'cdefabcd', 'efabcdef', 'abcdefab', 'cdefabcd', 'efabcdef', 'abcdefab', 'cdefabcd']);
    expect(b.hasMove()).toBe(false);
    const ids = b.cells.map(p => p!.id).sort();
    b.reshuffle();
    expect(b.findGroups(null)).toEqual([]);
    expect(b.hasMove()).toBe(true);
    expect(b.cells.map(p => p!.id).sort()).toEqual(ids);
  });

  it('keeps a playable sky through a long game: every move leaves a move', () => {
    const b = new Board({ kinds: 6, seed: 9, rocks: Array.from({ length: 64 }, (_, i) => (i === 27 || i === 36 ? 2 : 0)), sats: 3 });
    for (let k = 0; k < 80; k++) {
      const m = b.findMoves()[0];
      expect(m, `move ${k}`).toBeDefined();
      const res = b.swap(m.a, m.b);
      expect(res.ok).toBe(true);
      expect(b.findGroups(null)).toEqual([]);
      expect(b.cells.every((p, i) => (b.free(i) ? p !== null : p === null))).toBe(true);
    }
    expect(b.satDown).toBeGreaterThan(0);
  });
});

describe('levels', () => {
  it('makes the first constellation by hand: ten levels, each with goals and moves', () => {
    for (let i = 0; i < 10; i++) {
      const l = levelAt(i);
      expect(l.constellation).toBe(0);
      expect(l.goals.length).toBeGreaterThan(0);
      expect(l.moves).toBeGreaterThanOrEqual(15);
      expect(l.stars[1]).toBeGreaterThan(l.stars[0]);
      const b = new Board(boardSpec(l));
      expect(b.findGroups(null)).toEqual([]);
      expect(b.hasMove()).toBe(true);
    }
    expect(levelAt(2).goals[0].kind).toBe('dust');
    expect(new Board(boardSpec(levelAt(2))).dustLeft).toBe(16);
    expect(new Board(boardSpec(levelAt(4))).rocksLeft).toBe(8);
  });

  it('generates later levels from their number: the same for everyone, harder in waves', () => {
    expect(levelAt(37)).toEqual(levelAt(37));
    expect(levelAt(37).seed).not.toBe(levelAt(38).seed);
    for (let i = 10; i < 120; i++) {
      const l = levelAt(i);
      expect(l.moves).toBeGreaterThanOrEqual(16);
      expect(l.moves).toBeLessThanOrEqual(34);
      expect(l.goals.length).toBeGreaterThan(0);
      const b = new Board(boardSpec(l));
      expect(b.findGroups(null)).toEqual([]);
      expect(b.hasMove()).toBe(true);
      if (l.goals.some(g => g.kind === 'dust')) expect(b.dustLeft).toBeGreaterThan(0);
      if (l.goals.some(g => g.kind === 'rocks')) expect(b.rocksLeft).toBeGreaterThan(0);
      if (l.goals.some(g => g.kind === 'sats')) expect(l.sats).toBeGreaterThan(0);
    }
    expect(difficulty(80)).toBeGreaterThan(difficulty(12));
    expect(levelAt(14).calm).toBe(true);
    expect(levelAt(19).boss).toBe(true);
  });

  it('opens instruments by constellation and grows the tray to four', () => {
    expect(toolsFor(0)).toEqual(['comet', 'ray']);
    expect(toolsFor(2)).toContain('nova');
    expect(traySize(0)).toBe(3);
    expect(traySize(3)).toBe(4);
    expect(figureOf(0).pts).toHaveLength(10);
    expect(figureOf(7).pts).toHaveLength(10);
  });
});

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a night, the dawn\'s 4 s left over', () => {
    for (const planned of [40, 60, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(sum).toBeCloseTo(planned - RULES.finale, 5);
        expect(plan.every(b => b.dur >= RULES.minBlock - 1e-9 || b.kind === 'warmup')).toBe(true);
        expect(plan[plan.length - 1].kind).toBe('night');
        expect(plan[0].kind).toBe(first ? 'warmup' : 'obs');
      }
    }
  });

  it('says what each block asks of the brain, with a telegraph 4 s ahead', () => {
    const sim = later({ planned: 180 });
    const evs = toBlock(sim, 1);
    const tel = ofType(evs, 'telegraph');
    expect(tel).toHaveLength(1);
    expect(tel[0].next?.kind).toBe('night');
    expect(sim.block.kind).toBe('night');
    // the strategy the HUD shows (and signal() hands the dock) is the night's own
    expect(['tip.night.1', 'tip.night.2', 'tip.night.3'].map(k => t(k as 'tip.night.1'))).toContain(sim.tip);
  });
});

describe('the telescope (Obserwacja)', () => {
  it('fills the lens only above the threshold: nothing at or below it, about 8 s well above it', () => {
    expect(lensRate(0.5)).toBe(0);
    expect(lensRate(0.3)).toBe(0);
    expect(lensRate(1)).toBeCloseTo(1 / RULES.lensSec, 9);
    expect(lensRate(0.55)).toBeGreaterThan(0);
    expect(lensRate(0.55)).toBeLessThan(lensRate(0.7));
  });

  it('waits for the lead-in, then a full lens puts an instrument in the tray', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, RULES.leadIn.fnirs - 0.2, HIGH, clock);
    expect(sim.lens).toBe(0);
    expect(sim.lensLook).toBe('lead');
    const evs = drive(sim, RULES.lensSec + 0.5, HIGH, clock);
    const got = ofType(evs, 'instrument');
    expect(got).toHaveLength(1);
    expect(sim.tray).toHaveLength(1);
    expect(sim.toolsEarned).toBe(1);
    expect(sim.lensLook).toBe('live');
  });

  it('never gathers below the threshold or without signal (and never loses what it has)', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, RULES.leadIn.fnirs + 3, HIGH, clock);
    const had = sim.lens;
    expect(had).toBeGreaterThan(0);
    drive(sim, 5, LOW, clock);
    expect(sim.lens).toBeCloseTo(had, 9);
    drive(sim, 5, frame({ reliable: false, activity: null, level: 0, calm: 0 }), clock);
    expect(sim.lens).toBeCloseTo(had, 9);
    expect(sim.lensLook).toBe('grey');
  });

  it('keeps at most three in the tray: a full tray waits with a full lens', () => {
    const sim = later();
    sim.tray.push('comet', 'ray');
    const clock = { t: 0 };
    const evs = drive(sim, RULES.leadIn.fnirs + RULES.lensSec * 2 + 1, HIGH, clock);
    expect(sim.tray).toHaveLength(3);
    expect(sim.lens).toBe(1);
    expect(ofType(evs, 'trayFull')).toHaveLength(1);
  });

  it('makes the next instrument a pulsar after a 12 s hold', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = drive(sim, RULES.leadIn.fnirs + RULES.lensSec + 6, t => ({ ...HIGH, hold: t }), clock);
    expect(ofType(evs, 'pulsarReady')).toHaveLength(1);
    expect(ofType(evs, 'instrument').map(e => e.tool)).toContain('pulsar');
    expect(sim.pulsarsEarned).toBe(1);
  });

  it('opens only comet and ray in the first constellation, picking the ray while asteroids are in the way', () => {
    const sim = later({ progress: { level: 4 } });
    const clock = { t: 0 };
    const evs = drive(sim, RULES.leadIn.fnirs + RULES.lensSec * 2 + 1, HIGH, clock);
    const tools = ofType(evs, 'instrument').map(e => e.tool);
    expect(tools[0]).toBe('ray');
    expect(tools.every(x => x === 'ray' || x === 'comet')).toBe(true);
  });
});

describe('instruments (touch)', () => {
  it('cost no move: a ray breaks an asteroid outright', () => {
    const sim = later({ progress: { level: 4 } });
    sim.tray.push('ray');
    const rock = sim.board.rock.findIndex(v => v > 0);
    const moves = sim.movesLeft;
    sim.pickTool(0);
    expect(sim.armedTool).toBe('ray');
    sim.tap(rock);
    expect(sim.board.rock[rock]).toBe(0);
    expect(sim.movesLeft).toBe(moves);
    expect(sim.tray).toHaveLength(0);
  });

  it('keep the instrument when it cannot be used there', () => {
    const sim = later({ progress: { level: 9 } });
    sim.tray.push('comet');
    sim.pickTool(0);
    const hole = sim.board.mask.findIndex(m => !m);
    sim.tap(hole);
    expect(sim.tray).toEqual(['comet']);
    const rock = sim.board.rock.findIndex(v => v > 0);
    sim.tap(rock);
    expect(ofType(sim.take(), 'toolMiss')).toHaveLength(1);
    expect(sim.tray).toEqual(['comet']);
  });

  it('gravity lets one swap stand without a line, for free', () => {
    const sim = later();
    sim.tray.push('swap');
    const moves = sim.movesLeft;
    // a swap that makes no line
    let pair: [number, number] | null = null;
    for (let i = 0; i < 63 && !pair; i++) if (i % 8 < 7 && sim.board.swapValue(i, i + 1) === 0) pair = [i, i + 1];
    sim.pickTool(0);
    sim.tap(pair![0]);
    sim.tap(pair![1]);
    expect(ofType(sim.take(), 'resolve')[0].via).toBe('free');
    expect(sim.movesLeft).toBe(moves);
    expect(sim.tray).toHaveLength(0);
  });
});

describe('the hands', () => {
  it('a tap selects, a second tap on the same cell lets go, a tap on a neighbour swaps', () => {
    const sim = later();
    sim.tap(27);
    expect(sim.selected).toBe(27);
    sim.tap(27);
    expect(sim.selected).toBe(-1);
    const m = sim.board.findMoves()[0];
    const moves = sim.movesLeft;
    sim.tap(m.a);
    sim.tap(m.b);
    expect(sim.movesLeft).toBe(moves - 1);
    expect(sim.score).toBeGreaterThan(0);
  });

  it('a swap that makes no line bounces back for free', () => {
    const sim = later();
    let pair: [number, number] | null = null;
    for (let i = 0; i < 63 && !pair; i++) if (i % 8 < 7 && sim.board.swapValue(i, i + 1) === 0) pair = [i, i + 1];
    const moves = sim.movesLeft;
    sim.trySwap(pair![0], pair![1]);
    expect(ofType(sim.take(), 'bounce')).toHaveLength(1);
    expect(sim.movesLeft).toBe(moves);
  });

  it('Space shows the best move, a second Space plays it; arrows and Enter swap too', () => {
    const sim = later();
    sim.key(' ', true);
    expect(sim.hintShown).toBe(true);
    const hint = sim.hint!;
    expect(hint).not.toBeNull();
    sim.key(' ', true);
    expect(sim.movesLeft).toBe(sim.level.moves - 1);
    drive(sim, sim.busyT + 0.1, frame());
    sim.key('ArrowLeft', true);
    expect(sim.cursor).toBeGreaterThanOrEqual(0);
    const m = sim.board.findMoves()[0];
    sim.cursor = m.a;
    sim.key('Enter', true);
    sim.cursor = m.b;
    sim.key('Enter', true);
    expect(sim.movesLeft).toBe(sim.level.moves - 2);
  });
});

describe('levels in play', () => {
  it('a won level keeps its stars and moves the saga on; moves left fly as comets', () => {
    const sim = later();
    const clock = { t: 0 };
    sim.level.goals = [{ kind: 'score', n: 1 }];
    const evs = play(sim, clock);
    const won = ofType(evs, 'won');
    expect(won).toHaveLength(1);
    expect(won[0].bonus).toBe((sim.level.moves - 1) * RULES.leftover);
    expect(ofType(evs, 'resolve').some(e => e.via === 'bonus')).toBe(true);
    expect(sim.p.level).toBe(1);
    expect(sim.p.stars[0]).toBeGreaterThanOrEqual(1);
    drive(sim, RULES.wonHold + 1, frame(), clock);
    expect(sim.level.index).toBe(1);
    expect(sim.movesLeft).toBe(levelAt(1).moves);
  });

  it('scores one star for the goals, two and three for the points; never fewer than before', () => {
    const l = levelAt(3);
    expect(starsFor(l, 0)).toBe(1);
    expect(starsFor(l, l.stars[0])).toBe(2);
    expect(starsFor(l, l.stars[1])).toBe(3);
    const p = freshProgress();
    expect(winLevel(p, 3, 3)).toBe(3);
    expect(winLevel(p, 3, 1)).toBe(0);
    expect(p.stars[3]).toBe(3);
    expect(p.level).toBe(4);
  });

  it('out of moves: the rescue gives five more for six seconds of the block\'s own state, once', () => {
    const sim = later();
    const clock = { t: 0 };
    sim.level.goals = [{ kind: 'score', n: 1e9 }];
    sim.movesLeft = 1;
    let evs = play(sim, clock);
    expect(ofType(evs, 'rescueOpen')[0].want).toBe('focus');
    expect(sim.stage).toBe('rescue');
    evs = drive(sim, RULES.rescueSec + 0.3, HIGH, clock);
    expect(ofType(evs, 'rescue')).toHaveLength(1);
    expect(sim.movesLeft).toBe(RULES.rescueMoves);
    sim.movesLeft = 1;
    const score = sim.score;
    evs = play(sim, clock);
    expect(ofType(evs, 'lost')).toHaveLength(1);
    expect(sim.score).toBeGreaterThan(score);
    evs = drive(sim, RULES.lostHold + 0.2, frame(), clock);
    const lv = ofType(evs, 'level');
    expect(lv[0].level.index).toBe(0);
    expect(lv[0].attempt).toBe(1);
    expect(sim.movesLeft).toBe(sim.level.moves);
    expect(sim.score).toBeGreaterThan(score);   // the points stay
  });

  it('asks for calm in the rescue outside a push block, and waits without signal (never a loss)', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    sim.level.goals = [{ kind: 'score', n: 1e9 }];
    sim.movesLeft = 1;
    const evs = play(sim, clock);
    expect(ofType(evs, 'rescueOpen')[0].want).toBe('calm');
    const had = sim.rescueP;
    drive(sim, 10, frame({ reliable: false, activity: null }), clock);
    expect(sim.stage).toBe('rescue');
    expect(sim.rescueP).toBe(had);
    drive(sim, RULES.rescueSec + 0.2, LOW, clock);
    expect(sim.stage).toBe('play');
  });
});

describe('Cisza nocy (rest)', () => {
  it('turns calm into falling stars that leave comets, and lets the best move glow', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, 15, LOW, clock);
    const fell = ofType(evs, 'falling');
    expect(fell.length).toBeGreaterThanOrEqual(2);
    expect(fell.length).toBeLessThanOrEqual(RULES.starMax);
    for (const f of fell) expect(['row', 'col']).toContain(sim.board.cells.find(p => p?.id === f.id)?.sp ?? 'row');
    expect(sim.hintShown).toBe(true);
    expect(sim.sky).toBeGreaterThan(0.5);
  });

  it('brings no stars without signal', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, 20, frame({ reliable: false, activity: null, calm: 0 }), clock);
    expect(ofType(evs, 'falling')).toHaveLength(0);
  });
});

describe('Zachmurzenie: the blind Obserwacja', () => {
  it('comes every 4th Obserwacja from the 3rd session, never a session\'s first', () => {
    const sim = later({ planned: 600, progress: { pushes: 2 } });
    const clock = { t: 0 };
    const evs = drive(sim, 590, frame(), clock);
    const starts = ofType(evs, 'blockStart').map(e => e.block).filter(b => b.kind === 'obs');
    expect(sim.plan[0].blind).toBe(false);
    const blind = sim.plan.filter(b => b.kind === 'obs' && b.blind);
    expect(blind.length).toBeGreaterThanOrEqual(1);
    expect(starts.length).toBeGreaterThan(3);
    expect(makeSim({ planned: 600, progress: { sessions: 1, pushes: 2, giftDay: DAY } }).plan.some(b => b.blind)).toBe(false);
  });

  it('hides the lens and the trace; the instruments gathered appear at the end, the veil lifts', () => {
    const sim = later({ planned: 600, progress: { pushes: 2 } });
    const clock = { t: 0 };
    // the second Obserwacja (index 2) is the 4th of all time
    toBlock(sim, 2, frame(), clock);
    expect(sim.blind).toBe(true);
    let evs = drive(sim, sim.block.dur - 0.5, HIGH, clock);
    expect(ofType(evs, 'instrument')).toHaveLength(0);
    expect(sim.lensLook).toBe('blind');
    expect(sim.trace.samples.some(s => s.veiled)).toBe(true);
    evs = drive(sim, 1, HIGH, clock);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.block.blind).toBe(true);
    expect(end.tools.length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'instrument').every(e => e.blind)).toBe(true);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
    expect(sim.blindShare).toBeGreaterThan(50);
  });
});

describe('the summary', () => {
  it('result() is idempotent and the record uses Math.max', () => {
    const sim = later();
    const clock = { t: 0 };
    play(sim, clock);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.best['300']).toBe(sim.score);
    sim.finish();
    sim.finish();
    const total = sim.p.total;
    sim.result();
    expect(sim.p.total).toBe(total);
    expect(sim.p.sessions).toBe(6);
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    const sim = later();
    expect(['gen1.16', 'psa19.1']).toContain(sim.closingVerse());
    sim.rescues = 1;
    sim.toolsEarned = 2;
    expect(['php2.15', '1co15.41', 'gen1.16', 'psa19.1']).toContain(sim.closingVerse());
    for (const id of ['isa40.26', 'gen15.5', 'dan12.3', 'php2.15', 'job38.7', '1co15.41', 'jer31.35', 'gen1.16', 'psa19.1', 'psa147.4'] as const) {
      expect(passage(id).text.length).toBeGreaterThan(10);
    }
  });

  it('gives the day\'s gift once: a comet in the tray', () => {
    const sim = makeSim({ progress: { sessions: 4 } });
    expect(sim.tray).toEqual(['comet']);
    expect(sim.p.giftDay).toBe(DAY);
    expect(makeSim({ progress: { sessions: 4, giftDay: DAY } }).tray).toEqual([]);
  });

  it('remembers the best of the length last played', () => {
    const p = freshProgress();
    expect(bestOf(p)).toBeNull();
    p.best = { 180: 1200, 300: 3400 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(1200);
    p.lastLen = 600;
    expect(bestOf(p)).toBe(3400);
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('says "pkt" and keeps numbers with their units', () => {
    expect(unit(5)).toBe('pkt');
    expect(t('pts', { n: 12 })).toBe('12 pkt');
    expect(t('moves', { n: 5 })).toBe('5 ruchów');
  });

  it('never asks to concentrate harder, never uses holiness words or "hack"', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /niebiań/, /heaven/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the canvas centre (one cell) every 0.65 s, Space every third click, the simulator's focus on. */
  function smoke(progress: Partial<FirmamentProgress>, seed: number, eeg: boolean) {
    const sim = makeSim({ progress, planned: 40, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at22 = 0;
    const centre = sim.board.at(5, 3);
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.tap(centre);
        if (taps++ % 3 === 0) sim.key(' ', true);
      }
      sim.take();
      at22 = sim.result().score;
    }
    return at22;
  }

  it('scores by 22 s on either band, first-ever session or not', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) {
        expect(smoke({}, seed, eeg), `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        expect(smoke({ sessions: 6, level: 12, giftDay: DAY }, seed, eeg)).toBeGreaterThan(0);
      }
    }
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/firmament/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 2400, 300: 5100 };
    p.lastLen = 300;
    expect(mod.best(p)).toBe(5100);
    expect(mod.unit!(2)).toBe('pkt');
  });

  it('builds the progress card from elements: the records, the constellation, the instruments, the gift', async () => {
    const { progressPanel } = await import('../src/arcade/firmament/panel');
    const p = { ...freshProgress(), sessions: 3, level: 12, stars: [3, 2, 3, 1, 2, 2, 1, 3, 2, 2, 3, 1], total: 12345 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-stats .stat')).toHaveLength(4);
    expect(el.textContent).toContain('Orion');
    expect(el.textContent).toContain('Kometa');
    expect(el.querySelectorAll('.arcade-chips span.on').length).toBe(4);   // comet, ray, gravity and the pulsar
    expect(el.querySelector('.arcade-daily')).not.toBeNull();
  });
});
