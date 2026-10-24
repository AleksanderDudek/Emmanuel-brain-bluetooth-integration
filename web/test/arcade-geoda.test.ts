import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame } from '../src/arcade/kit/focus';
import { dayKey } from '../src/arcade/kit/progress';
import type { GameEnv } from '../src/arcade/kit/types';
import geoda from '../src/arcade/geoda/index';
import { geodePath, WALL_BED } from '../src/arcade/geoda/art';
import { CLARITY, CRAFT_DUST, DUST, MINERALS, NEW_FIRST, PITY, SHAPES, SIZES, STRATEGIES, TIERS } from '../src/arcade/geoda/content';
import { GeodaGame } from '../src/arcade/geoda/game';
import { statusRow, TELEGRAPH, type Measure } from '../src/arcade/geoda/hud';
import { CATALOGS, t, type GeodaKey } from '../src/arcade/geoda/i18n';
import { cellAt, computeLayout, trayBand, trayCellFor } from '../src/arcade/geoda/layout';
import {
  bestCarats, crackGeodes, craft, crack, depth, found, freshProgress, quality, record, rollTier, SessionCredit, sizeClass, specimenCm, tierOdds, xpFor,
  type GeodaProgress,
} from '../src/arcade/geoda/meta';
import { frameFor, HERO_TEXT } from '../src/arcade/geoda/preview';
import {
  clarityOf, connected, Continuity, crystalCells, dealSeed, FULL_EMPTY, GeodaSim, growthRate, LINE_BONUS, normalize, ORIENTS, planBlocks,
  type Crystal, type GeodaEvent, type SimOptions,
} from '../src/arcade/geoda/sim';
import { bestSpot, EMPTY, FTUE_GAP, GEM, generateWall, lineCells, N, regrowLines, ROCK, spotScore, tapSpot, Wall } from '../src/arcade/geoda/wall';
import { mulberry32, normalGenerator } from '../src/core/random';
import { catalogProblems, LANGS, type Plural } from '../src/i18n';

// ── helpers ─────────────────────────────────────────────────────

/** Geoda's focus tuning (the kit's, with the entry's slow threshold), as the runner hands it to a returning player. */
const TUNING = { ...DEFAULT_TUNING, adapt: 0.08 };
/** A beginner's: the runner leans the judges further toward the player in the first sessions. */
const BEGINNER = { ...TUNING, ...BEGINNER_TUNING };

/** A session's sim with Geoda's tuning unless the test asks for another. */
const newSim = (o: Omit<SimOptions, 'tuning'> & { tuning?: SimOptions['tuning'] }): GeodaSim => new GeodaSim({ tuning: TUNING, ...o });

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });

/** Steady focus: level high, a hold that grows with the session. */
const focusing = (hold: number): FocusFrame => frame({ activity: 12, level: 0.95, focused: true, hold, calm: 0.05 });
const resting = (): FocusFrame => frame({ activity: -3, level: 0.1, focused: false, hold: 0, calm: 0.9 });

/** Run the sim for `sec` with frames from `f(t)`, collecting its events. */
function run(sim: GeodaSim, sec: number, f: (t: number) => FocusFrame, t0 = 0, timeUpAt = Infinity, dt = 0.05): GeodaEvent[] {
  const out: GeodaEvent[] = [];
  for (let t = t0; t < t0 + sec - 1e-9; t += dt) {
    sim.update(dt, f(t), t >= timeUpAt);
    out.push(...sim.events.splice(0));
  }
  return out;
}

const crystal = (shape: number, grown: number, clarity: (1 | 2 | 3)[] = [], orient = 0, gem = 0): Crystal => ({
  shape, ghost: ORIENTS[shape][orient], gem, grown, frac: 0, clarity: Array.from({ length: grown }, (_, i) => clarity[i] ?? 1),
});

/** A sim whose wall is all rock except `empty` cells. */
function simWith(empty: number[], o: Partial<SimOptions> = {}): GeodaSim {
  const sim = newSim({ plannedSec: 180, rng: mulberry32(9), ...o });
  sim.wall = new Wall();
  for (const i of empty) sim.wall.cells[i] = { k: EMPTY, gem: 0, clarity: 1, piece: 0 };
  return sim;
}

// ── shapes and crystals ─────────────────────────────────────────

describe('Geoda shapes', () => {
  it('grows every seed along a connected path, in every orientation', () => {
    for (const [s, def] of SHAPES.entries()) {
      expect(def.cells.length).toBeGreaterThanOrEqual(3);
      expect(def.cells.length).toBeLessThanOrEqual(5);
      expect(ORIENTS[s].length).toBeGreaterThanOrEqual(1);
      for (const ghost of ORIENTS[s]) {
        for (let k = 1; k <= ghost.length; k++) expect(connected(ghost.slice(0, k))).toBe(true);
        expect(Math.min(...ghost.map(p => p[0]))).toBe(0);
        expect(Math.min(...ghost.map(p => p[1]))).toBe(0);
      }
    }
    // distinct orientations: an O has one, an I two, an L eight
    expect(ORIENTS[SHAPES.findIndex(x => x.id === 'O4')].length).toBe(1);
    expect(ORIENTS[SHAPES.findIndex(x => x.id === 'I3')].length).toBe(2);
    expect(ORIENTS[SHAPES.findIndex(x => x.id === 'L5')].length).toBe(8);
    expect(SHAPES.find(x => x.id === 'I5')!.weight).toBeLessThan(Math.min(...SHAPES.filter(x => x.id !== 'I5').map(x => x.weight)));
  });

  it('places the grown part of a crystal, normalised, and deals seeds in colours the tray does not show yet', () => {
    const c = crystal(SHAPES.findIndex(x => x.id === 'L4'), 2);   // (0,0),(0,1): a vertical domino
    expect(crystalCells(c)).toEqual([[0, 0], [0, 1]]);
    expect(normalize([[2, 3], [3, 3]])).toEqual([[0, 0], [1, 0]]);
    const rng = mulberry32(4);
    for (let i = 0; i < 50; i++) {
      const s = dealSeed(rng, [0, 1, 2]);
      expect(s.grown).toBe(1);
      expect([3, 4]).toContain(s.gem);
    }
  });
});

// ── the wall ────────────────────────────────────────────────────

describe('Geoda wall', () => {
  it('lets a crystal in only where every cell is free and inside', () => {
    const w = Wall.parse(['..######', ...Array(7).fill('########')]);
    expect(w.fits([[0, 0], [1, 0]], 0, 0)).toBe(true);
    expect(w.fits([[0, 0], [1, 0]], 1, 0)).toBe(false);   // rock
    expect(w.fits([[0, 0], [0, 1]], 0, 0)).toBe(false);   // rock below
    expect(w.fits([[0, 0]], -1, 0)).toBe(false);          // outside
    expect(w.fits([[0, 0]], 8, 0)).toBe(false);
    w.locked.add(0);
    expect(w.fits([[0, 0]], 0, 0)).toBe(false);            // a line breaking in the Zbiór
  });

  it('finds full rows and columns, rows first', () => {
    const w = new Wall();
    w.cells[3] = { k: EMPTY, gem: 0, clarity: 1, piece: 0 };       // row 0 and column 3 are open
    expect(w.fullLines()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15]);
    expect(lineCells(N + 3)).toEqual([3, 11, 19, 27, 35, 43, 51, 59]);
  });

  it('sets a crystal: carats = its cells × their clarity, at once; the slot empties', () => {
    const sim = simWith([0, 1, 2]);
    sim.start();
    sim.tray[0] = crystal(0, 3, [1, 2, 3]);   // I3 across
    expect(sim.place(0, 0, 0)).toBe(true);
    expect(sim.carats).toBe(6);
    expect(sim.tray[0]).toBeNull();
    expect(sim.wall.cells[1]).toMatchObject({ k: GEM, clarity: 2 });
    const placed = sim.events.find(e => e.type === 'place');
    expect(placed).toMatchObject({ carats: 6, lines: [0, N, N + 1, N + 2] });   // row 0 is full now, and the columns through it
    expect(sim.place(1, 0, 0)).toBe(false);
  });

  it('taps: covers the tapped cell if it can, else the nearest spot within a cell, else "nie pasuje"', () => {
    const w = Wall.parse(['#..#####', '########', '#....###', ...Array(5).fill('########')]);
    const domino: [number, number][] = [[0, 0], [1, 0]];
    expect(tapSpot(w, domino, 2, 0)).toEqual([1, 0]);          // the tapped cell is covered
    expect(tapSpot(w, domino, 4, 2)).toEqual([3, 2]);
    expect(tapSpot(w, domino, 4, 1)).toEqual([3, 2]);          // a rock cell: the nearest fit one row down
    expect(tapSpot(w, domino, 6, 1)).toBeNull();               // nothing within a cell
    expect(tapSpot(w, domino, 7, 7)).toBeNull();
  });

  it('the key and the best spot prefer completing lines, then nearly full ones', () => {
    const w = Wall.parse(['#######.', '####....', ...Array(6).fill('########')]);
    expect(bestSpot(w, [[0, 0]])).toEqual([7, 0]);              // completes row 0 (and column 7 is not complete)
    expect(bestSpot(w, [[0, 0], [1, 0]])).toEqual([4, 1]);      // the domino goes to the half-empty row
  });
});

describe('Geoda walls and gaps', () => {
  it('a fresh wall is over half rock, has no full line and hollows of 1–6 cells', () => {
    for (let s = 1; s <= 40; s++) {
      const w = generateWall(mulberry32(s));
      const empty = w.emptyCount();
      expect(empty).toBeGreaterThanOrEqual(20);
      expect(empty).toBeLessThanOrEqual(30);
      expect(w.fullLines()).toEqual([]);
    }
  });

  it('regrows cleared lines as rock with at least two gaps of their own, never into crystals', () => {
    for (let s = 1; s <= 60; s++) {
      const rng = mulberry32(s);
      const w = generateWall(rng);
      // a crystal sits in row 5; row 2 and column 6 fill up, and every full line is harvested
      const gem = 5 * N + 1;
      w.cells[gem] = { k: GEM, gem: 1, clarity: 2, piece: 7 };
      for (const i of [...lineCells(2), ...lineCells(N + 6)]) if (w.cells[i].k === EMPTY) w.cells[i] = { k: GEM, gem: 0, clarity: 1, piece: 9 };
      const lines = w.fullLines();
      expect(lines).toEqual(expect.arrayContaining([2, N + 6]));
      const gone = new Set(lines.flatMap(lineCells));
      for (const i of gone) w.cells[i] = { k: EMPTY, gem: 0, clarity: 1, piece: 0 };
      const size = 2 + (s % 4);
      const gaps = regrowLines(w, lines, () => size, rng);
      for (const l of lines) {
        const own = lineCells(l).filter(i => w.cells[i].k === EMPTY).length;
        expect(own).toBeGreaterThanOrEqual(2);
        expect(w.full(l)).toBe(false);
      }
      if (!gone.has(gem)) expect(w.cells[gem]).toMatchObject({ k: GEM, piece: 7 });
      expect(gaps.every(i => w.cells[i].k === EMPTY)).toBe(true);
      expect(w.fullLines()).toEqual([]);
    }
  });

  it('never leaves an unfillable wall: there is always a free cell for a 1-cell seed (or a crumble)', () => {
    const rng = mulberry32(77);
    const sim = newSim({ plannedSec: 600, rng });
    sim.start();
    let t = 0;
    while (sim.phase !== 'done' && t < 640) {
      sim.update(0.1, focusing(t % 30), t >= 597);
      sim.events.length = 0;
      t += 0.1;
      if (sim.phase === 'wzrost') {
        // a greedy player: whatever fits best goes in
        for (let s = 0; s < 3; s++) {
          const c = sim.tray[s];
          const spot = c && bestSpot(sim.wall, crystalCells(c));
          if (spot) sim.place(s, spot[0], spot[1]);
        }
        expect(sim.wall.emptyCount() > 0 || sim.wall.fullLines().length > 0).toBe(true);
        // one cell always fits while the wall has a hole
        if (sim.wall.emptyCount() > sim.wall.locked.size) expect(bestSpot(sim.wall, [[0, 0]])).not.toBeNull();
      }
    }
    expect(sim.phase).toBe('done');
  });

  it('keeps lines clearing without control, and pays steady focus clearly more (the economy)', () => {
    // a plain greedy player: a crystal goes in when it completes a line, fills a hollow exactly or is
    // full-grown; near the end of a block, whatever helps a nearly full line
    const exact = (w: Wall, cells: readonly (readonly [number, number])[], ax: number, ay: number) => {
      const own = new Set(cells.map(([x, y]) => (ay + y) * N + ax + x));
      return [...own].every(i => [i - 1, i + 1, i - N, i + N].every(k =>
        k < 0 || k >= N * N || Math.abs((k % N) - (i % N)) > 1 || own.has(k) || w.cells[k].k !== EMPTY));
    };
    const play = (seed: number, f: (t: number, sim: GeodaSim) => FocusFrame) => {
      const sim = newSim({ plannedSec: 300, rng: mulberry32(seed) });
      sim.start(300);
      let t = 0;
      while (sim.phase !== 'done' && t < 330) {
        sim.update(0.1, f(t, sim), t >= 300);
        sim.events.length = 0;
        t += 0.1;
        if (sim.phase !== 'wzrost' || Math.round(t * 10) % 10) continue;
        const late = sim.bt > sim.block!.dur - 2;
        for (let s = 0; s < 3; s++) {
          const c = sim.tray[s];
          if (!c) continue;
          const cells = crystalCells(c), spot = bestSpot(sim.wall, cells);
          if (!spot) continue;
          const score = spotScore(sim.wall, cells, spot[0], spot[1]);
          if (score >= 100 || exact(sim.wall, cells, spot[0], spot[1]) || c.grown === c.ghost.length || (late && score > 4)) sim.place(s, spot[0], spot[1]);
        }
      }
      return sim;
    };
    let withLine = 0, blocks = 0, idle = 0, steady = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const none = play(seed, () => frame({ activity: 0, level: 0.3, calm: 0.7 }));
      withLine += none.stats.harvestsWithLine;
      blocks += none.stats.harvests;
      idle += none.carats;
      let hold = 0;
      steady += play(seed, (_, sim) => {
        hold = sim.phase === 'wzrost' ? hold + 0.1 : 0;
        return sim.phase === 'wzrost' ? focusing(hold) : resting();
      }).carats;
    }
    // the design: 75–85 % of a weak regulator's blocks complete a line (this player measures ~100 %)
    expect(withLine / blocks).toBeGreaterThanOrEqual(0.75);
    expect(steady).toBeGreaterThan(idle * 2.5);
  });

  it('a sloppy player without control, tapping the wall anywhere and pressing Space, still clears a line in ≥ 75 % of blocks', () => {
    let withLine = 0, blocks = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const sim = newSim({ plannedSec: 300, rng: mulberry32(seed) });
      const me = mulberry32(seed * 7 + 1);
      sim.start(300);
      for (let t = 0, tick = 0; sim.phase !== 'done' && t < 330; t += 0.1, tick++) {
        sim.update(0.1, frame({ activity: 0, level: 0.3, calm: 0.7 }), t >= 300);
        sim.events.length = 0;
        if (sim.phase !== 'wzrost') continue;
        if (tick % 7 === 0) sim.tapWall(Math.floor(me() * N), Math.floor(me() * N));   // a tap every 0.7 s, anywhere
        if (tick % 20 === 0) sim.placeKey(null);                                          // Space every 2 s
      }
      withLine += sim.stats.harvestsWithLine;
      blocks += sim.stats.harvests;
    }
    expect(withLine / blocks).toBeGreaterThanOrEqual(0.75);   // measured 0.83–0.91 over 100 sessions
  });

  it('sizes new gaps to the crystals the player has been setting (± 1)', () => {
    const gapsAfter = (cells: number) => {
      const sim = simWith([0, 1, 2, 3, 4, 5, 6, 7]);
      sim.start(180);
      // fill row 0 with crystals of `cells` cells (the rest of the row with seeds), then harvest it
      let x = 0;
      while (x < N) {
        const len = Math.min(cells, N - x);
        sim.tray[0] = crystal(SHAPES.findIndex(sh => sh.id === 'I5'), len);
        sim.place(0, x, 0);
        x += len;
      }
      run(sim, sim.block!.dur + 2.5, t => focusing(t));
      const own = lineCells(0).filter(i => sim.wall.cells[i].k === EMPTY).length;
      return own;
    };
    const small = gapsAfter(1), big = gapsAfter(4);
    expect(small).toBeGreaterThanOrEqual(2);
    expect(small).toBeLessThanOrEqual(3);
    expect(big).toBeGreaterThanOrEqual(3);
  });
});

// ── the brain ───────────────────────────────────────────────────

describe('Geoda brain mapping', () => {
  it('grows (0.05 + 0.25·u) × (1 + min(cont, 20)/40) cells/s, u from level 0.35 (0.30 for beginners)', () => {
    expect(growthRate(0.2, 0)).toBeCloseTo(0.05, 6);
    expect(growthRate(0.35, 0)).toBeCloseTo(0.05, 6);
    expect(growthRate(0.6, 0)).toBeCloseTo(0.05 + 0.25 * 0.5, 6);
    expect(growthRate(0.85, 0)).toBeCloseTo(0.3, 6);
    expect(growthRate(1, 20)).toBeCloseTo(0.45, 6);
    expect(growthRate(1, 60)).toBeCloseTo(0.45, 6);       // the hold bonus tops out at × 1.5
    expect(growthRate(0.6, 10)).toBeCloseTo(0.175 * 1.25, 6);
    expect(growthRate(0.6, 0, 0.3)).toBeCloseTo(0.05 + 0.25 * 0.6, 6);
  });

  it('records steadiness as clarity: under 4 s mleczny, 4–12 s czysty, 12 s on lśniący', () => {
    expect(clarityOf(0)).toBe(1);
    expect(clarityOf(3.99)).toBe(1);
    expect(clarityOf(4)).toBe(2);
    expect(clarityOf(11.99)).toBe(2);
    expect(clarityOf(12)).toBe(3);
  });

  it('continuity follows the hold, pauses through bad signal and breaks only on a real lapse', () => {
    const c = new Continuity();
    for (let i = 1; i <= 50; i++) c.push(frame({ focused: true, hold: i * 0.1 }));
    expect(c.cont).toBeCloseTo(5, 6);
    // an 8 s motion artefact: the kit drops the hold, the game keeps its continuity
    for (let i = 0; i < 80; i++) c.push(frame({ reliable: false, focused: false, hold: 0 }));
    expect(c.cont).toBeCloseTo(5, 6);
    for (let i = 1; i <= 30; i++) c.push(frame({ focused: true, hold: i * 0.1 }));
    expect(c.cont).toBeCloseTo(7.9, 6);                     // resumed from where it paused
    expect(c.longest).toBeCloseTo(7.9, 6);
    c.push(frame({ focused: false, hold: 0 }));             // a real break of focus
    expect(c.cont).toBe(0);
    expect(c.longest).toBeCloseTo(7.9, 6);
  });

  it('starts continuity over at every Wzrost: a hold kept up through the Zbiór and the Szlif is not carried in', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(3) });
    sim.start(180);
    const starts: number[] = [];
    let t = 0, inWzrost = 0;
    while (starts.length < 4 && t < 200) {
      sim.update(0.05, focusing(t), false);    // focus never let go: the kit's hold grows through the rests
      sim.events.length = 0;
      inWzrost = sim.phase === 'wzrost' ? inWzrost + 1 : 0;
      if (inWzrost === 2) starts.push(sim.brain.cont);
      t += 0.05;
    }
    expect(starts.length).toBe(4);
    for (const c of starts) expect(c).toBeLessThan(1);
    // so the record is a hold within one block, and the first cells of a block grow mleczne
    expect(sim.brain.longest).toBeLessThanOrEqual(30);
    const c = new Continuity();
    for (let i = 1; i <= 100; i++) c.push(frame({ focused: true, hold: i * 0.1 }));
    c.restart();
    c.push(frame({ focused: true, hold: 30 }));
    expect(c.cont).toBe(0);
    c.push(frame({ focused: true, hold: 30.5 }));
    expect(c.cont).toBeCloseTo(0.5, 6);
    expect(c.longest).toBeCloseTo(10, 6);
  });

  it('bad signal: no growth, no drip, the block clock waits up to 10 s, placing still works', () => {
    const sim = simWith(Array.from({ length: 16 }, (_, i) => i));
    sim.start(180);
    const c = sim.tray[0]!;
    run(sim, 3, () => focusing(5));
    const grown = c.grown + c.frac, bt = sim.bt;
    expect(sim.drip).toBeGreaterThan(1);
    run(sim, 6, () => frame({ reliable: false, level: 0.95, calm: 0 }));
    expect(c.grown + c.frac).toBeCloseTo(grown, 9);        // frozen
    expect(sim.drip).toBeLessThan(0.2);
    expect(sim.bt).toBeCloseTo(bt, 6);                       // the clock waited
    run(sim, 8, () => frame({ reliable: false, level: 0.95, calm: 0 }));
    expect(sim.bt).toBeGreaterThan(bt + 3.5);                // but at most 10 s
    expect(sim.place(1, 0, 0)).toBe(true);                   // the hands still work
  });

  it('a long steady hold grows lśniące cells faster than a scattered one', () => {
    const grow = (f: (t: number) => FocusFrame) => {
      const sim = simWith([0]);
      sim.start(180);
      const ev = run(sim, 20, f);
      return ev.filter(e => e.type === 'grow' || e.type === 'sprout') as Extract<GeodaEvent, { type: 'grow' | 'sprout' }>[];
    };
    const steady = grow(t => focusing(t));
    const none = grow(() => resting());
    expect(steady.length).toBeGreaterThan(none.length * 2);
    expect(steady.some(e => e.clarity === 3)).toBe(true);
    expect(none.every(e => e.clarity === 1)).toBe(true);
    // the bell's ladder climbs within one hold, an octave at most
    const ladder = steady.filter((e): e is Extract<GeodaEvent, { type: 'grow' }> => e.type === 'grow').map(e => e.ladder);
    expect(ladder).toEqual([...ladder].sort((a, b) => a - b));
    expect(Math.max(...ladder)).toBeLessThanOrEqual(12);
  });
});

// ── feeding ─────────────────────────────────────────────────────

describe('Geoda tray', () => {
  it('only the fed crystal grows; when it is full the water runs to an empty slot, then to the next', () => {
    const sim = simWith([0, 1, 2, 3]);
    sim.start(180);
    sim.tray[0] = crystal(0, 2);      // I3: one cell to go
    sim.tray[1] = null;
    sim.tray[2] = crystal(1, 1);
    sim.fed = 0;
    expect(sim.growTarget()).toBe(0);
    sim.grow(1);
    expect(sim.tray[0]!.grown).toBe(3);
    expect(sim.growTarget()).toBe(1);          // the empty slot sprouts a seed from the next cell
    sim.grow(1);
    expect(sim.tray[1]!.grown).toBe(1);
    expect(sim.growTarget()).toBe(1);          // …and keeps growing it, then the third
    sim.tray[1] = crystal(0, 3);
    expect(sim.growTarget()).toBe(2);
  });

  it('refills empty slots at the start of each Wzrost; an emptied fed slot sprouts from growth', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(3) });
    sim.start(180);
    expect(sim.tray.every(c => c && c.grown === 1)).toBe(true);
    sim.tray[0] = null;
    sim.fed = 0;
    run(sim, 6, () => focusing(5));
    expect(sim.tray[0]).not.toBeNull();        // sprouted from the drip
  });

  it('a long press crumbles a crystal back to its seed, keeping the first cell', () => {
    const sim = simWith([0]);
    sim.start(180);
    sim.tray[0] = crystal(1, 3, [3, 2, 2]);
    expect(sim.crumble(0)).toBe(true);
    expect(sim.tray[0]).toMatchObject({ grown: 1, clarity: [3], frac: 0 });
    expect(sim.crumble(0)).toBe(false);
  });

  it('while the fed slot sprouts, a tap or Space sets the next crystal and the water keeps sprouting the slot', () => {
    const sim = simWith([0, 1, 2, 3, 4, 5]);
    sim.start(180);
    sim.tray[0] = null;
    sim.tray[1] = crystal(0, 1);
    sim.tray[2] = crystal(0, 2, [2, 2]);
    sim.fed = 0;
    expect(sim.placing).toBe(1);
    expect(sim.tapWall(0, 0)).toEqual([0, 0]);
    expect(sim.tray[1]).toBeNull();
    expect(sim.fed).toBe(0);                      // the selection stays on the sprouting slot…
    expect(sim.growTarget()).toBe(0);              // …so the drip keeps sprouting it
    expect(sim.placeKey(null)).not.toBeNull();     // Space: the crystal after it
    expect(sim.tray[2]).toBeNull();
    expect(sim.carats).toBe(5);
    // nothing left to set: the tap says the tray is sprouting
    sim.events.length = 0;
    expect(sim.tapWall(5, 0)).toBeNull();
    expect(sim.events).toEqual([{ type: 'wait', slot: 0, cell: 5 }]);
    // a selected crystal that does not fit is not swapped for another: "nie pasuje"
    sim.tray[0] = crystal(SHAPES.findIndex(sh => sh.id === 'I5'), 5);
    sim.tray[1] = crystal(0, 1);
    sim.events.length = 0;
    expect(sim.tapWall(5, 0)).toBeNull();
    expect(sim.events).toEqual([{ type: 'nofit', slot: 0, cell: 5 }]);
    expect(sim.tray[1]).not.toBeNull();
  });
});

// ── blocks ──────────────────────────────────────────────────────

describe('Geoda blocks', () => {
  it('plans 40 s as a 16 s Wzrost, a Zbiór and Szlif to the end', () => {
    const p = planBlocks(40, mulberry32(1));
    expect(p.map(b => [b.kind, b.dur])).toEqual([['wzrost', 16], ['zbior', 3], ['szlif', 21]]);
    expect(planBlocks(40, mulberry32(1), { playSec: 37.6 })[2].dur).toBeCloseTo(18.6, 6);
  });

  it('scales rounds of 24 ± 3 / 3 / 17 s to 3, 5 and 10 minutes, ending on time, nothing under 12 s', () => {
    for (const [sec, rounds] of [[180, 4], [300, 7], [600, 14]] as const) {
      for (let s = 1; s <= 10; s++) {
        const p = planBlocks(sec, mulberry32(s), { blind: true });
        expect(p.length).toBe(rounds * 3);
        expect(p.reduce((t, b) => t + b.dur, 0)).toBeCloseTo(sec, 6);
        for (const b of p) {
          if (b.kind === 'wzrost') {
            expect(b.dur).toBeGreaterThanOrEqual(20);
            expect(b.dur).toBeLessThanOrEqual(28);
          } else if (b.kind === 'szlif') expect(b.dur).toBeGreaterThanOrEqual(12);
          else expect(b.dur).toBe(3);
        }
        // one Wzrost in four is a Ciemna komora: the 3rd, 7th, 11th
        expect(p.filter(b => b.blind).map(b => b.round)).toEqual([2, 6, 10, 14].filter(r => r < rounds));
      }
      // jitter: the starts differ between sessions
      const a = planBlocks(sec, mulberry32(1)), b = planBlocks(sec, mulberry32(2));
      expect(a[0].dur).not.toBeCloseTo(b[0].dur, 3);
    }
    expect(planBlocks(180, mulberry32(1)).some(b => b.blind)).toBe(false);
  });

  it('telegraphs each block 4 s ahead and judges every Wzrost and Szlif once (RoundJudge, BlockContrast)', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(5) });
    sim.start(180);
    let hold = 0;
    const ev = run(sim, 190, () => {
      hold = sim.phase === 'wzrost' ? hold + 0.05 : 0;
      return sim.phase === 'wzrost' ? focusing(hold) : resting();
    }, 0, 180);
    const tele = ev.filter(e => e.type === 'telegraph').map(e => (e as { to: string }).to);
    expect(tele.slice(0, 4)).toEqual(['szlif', 'wzrost', 'szlif', 'wzrost']);
    const verdicts = ev.filter((e): e is Extract<GeodaEvent, { type: 'verdict' }> => e.type === 'verdict');
    expect(verdicts.filter(v => v.kind === 'focus').length).toBe(4);
    expect(verdicts.filter(v => v.kind === 'rest').length).toBe(4);
    expect(sim.stats.focusPass).toBe(4);
    expect(sim.stats.restPass).toBe(4);
    expect(sim.contrast.contrast).toBeCloseTo(15, 6);       // 12 % in focus against −3 % at rest
    expect(sim.stats.zoneSec).toBeGreaterThan(120);
  });

  it('announces the Zbiór first, then the Wzrost’s verdict, so the Zbiór’s caption can carry it', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(5) });
    sim.start(180);
    let hold = 0;
    const ev = run(sim, 100, () => {
      hold = sim.phase === 'wzrost' ? hold + 0.05 : 0;
      return sim.phase === 'wzrost' ? focusing(hold) : resting();
    });
    const order = ev.filter(e => e.type === 'zbior' || e.type === 'verdict').map(e => (e.type === 'verdict' ? `verdict:${e.kind}` : e.type));
    expect(order.slice(0, 5)).toEqual(['zbior', 'verdict:focus', 'verdict:rest', 'zbior', 'verdict:focus']);
  });

  it('judges fairly without control: a realistic signal through the kit’s FocusInput passes focus and rest blocks alike, never always or never', () => {
    // no control: Mayer waves (~0.1 Hz), a slow drift and smoothed noise in the activity
    const signal = (seed: number, drift: boolean) => {
      const n = normalGenerator(seed), rnd = mulberry32(seed + 99);
      const ph = rnd() * 6.28, f = 0.08 + rnd() * 0.04, amp = 1 + rnd() * 1.5, slope = (rnd() - 0.5) * 0.02;
      let lp = 0;
      return (t: number) => {
        lp += (n() * 2.5 - lp) * (0.1 / 1.5);
        return 2 + amp * Math.sin(6.283 * f * t + ph) + (drift ? slope * t + 0.8 * Math.sin(t / 47 + ph) : 0) + lp;
      };
    };
    for (const beginner of [false, true]) {
      for (const drift of [false, true]) {
        const tune = beginner ? BEGINNER : TUNING;
        let fp = 0, fj = 0, rp = 0, rj = 0, polished = 0, szlifs = 0;
        for (let seed = 1; seed <= 12; seed++) {
          const sim = newSim({ plannedSec: 600, rng: mulberry32(seed), tuning: tune });
          const input = new FocusInput(tune), act = signal(seed, drift);
          sim.start(600);
          for (let t = 0; t < 640 && sim.phase !== 'done'; t += 0.1) {
            sim.update(0.1, input.push(act(t), true, 0.1), t >= 600);
            sim.events.length = 0;
            if (sim.phase === 'wzrost' && Math.round(t * 10) % 20 === 0) sim.placeKey(null);   // gems for the bowl
          }
          fp += sim.stats.focusPass; fj += sim.stats.focusJudged; rp += sim.stats.restPass; rj += sim.stats.restJudged;
          polished += sim.stats.polished; szlifs += sim.stats.szlifs;
        }
        // measured over 40 sessions: 0.60–0.87 for a returning player; a beginner's judges lean
        // toward the player on purpose (the kit's BEGINNER_TUNING): 0.75–0.97, still never always
        for (const rate of [fp / fj, rp / rj, polished / szlifs]) {
          expect(rate).toBeGreaterThan(beginner ? 0.6 : 0.45);
          expect(rate).toBeLessThan(beginner ? 0.99 : 0.95);
        }
      }
    }
  });

  it('has no verdicts without reliable data', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(5) });
    sim.start(180);
    run(sim, 200, () => frame({ reliable: false, activity: null }), 0, 180);
    expect(sim.stats.focusJudged + sim.stats.restJudged).toBe(0);
    expect(sim.contrast.contrast).toBeNull();
    expect(sim.phase).toBe('done');
  });
});

describe('Geoda harvest', () => {
  it('shatters the full lines top to bottom, 120 ms apart, with a bonus for several at once', () => {
    // rows 0 and 1 full of crystals, column 7 full too: three lines at once (+100 % of their carats);
    // the other rows and columns keep a hole each, more than a Pełna geoda leaves
    const holes = [2 * N, 3 * N + 1, 4 * N + 2, 5 * N + 3, 6 * N + 4, 7 * N + 5, 7 * N + 6, 2 * N + 3, 2 * N + 6, 3 * N + 3, 3 * N + 5, 4 * N + 6, 5 * N, 6 * N + 1];
    expect(holes.length).toBeGreaterThan(FULL_EMPTY);
    const sim = simWith([...lineCells(0), ...lineCells(1), ...lineCells(N + 7), ...holes]);
    sim.start(180);
    const fill = (i: number, cl: 1 | 2 | 3) => { sim.wall.cells[i] = { k: GEM, gem: 2, clarity: cl, piece: 1 }; };
    for (const i of lineCells(0)) fill(i, 2);
    for (const i of lineCells(1)) fill(i, 1);
    for (const i of lineCells(N + 7)) fill(i, 3);
    const inLines = new Set([...lineCells(0), ...lineCells(1), ...lineCells(N + 7)]);
    const value = [...inLines].reduce((s, i) => s + sim.wall.cells[i].clarity, 0);
    const ev = run(sim, sim.block!.dur + 3.5, t => focusing(t));
    const shatters = ev.filter((e): e is Extract<GeodaEvent, { type: 'shatter' }> => e.type === 'shatter');
    expect(shatters.map(e => e.line)).toEqual([0, 1, N + 7]);
    expect(shatters[2].cells.length).toBe(6);              // the column's top two cells broke with the rows
    const bonus = ev.find((e): e is Extract<GeodaEvent, { type: 'bonus' }> => e.type === 'bonus')!;
    expect(bonus.mult).toBe(LINE_BONUS[2]);
    expect(bonus.carats).toBe(Math.round(value * 1));
    expect(sim.carats).toBe(bonus.carats);
    expect(sim.stats.lines).toBe(3);
    // the harvested gems go to the bowl; the lines came back as rock with gaps
    expect(sim.phase).toBe('szlif');
    expect(sim.bowl.length).toBeGreaterThan(0);
    for (const l of [0, 1, N + 7]) expect(sim.wall.full(l)).toBe(false);
  });

  it('pays no bonus for a single line, +50 % for two, +200 % for four or more', () => {
    expect(LINE_BONUS).toEqual([0, 0.5, 1, 2]);
  });

  it('a full wall is a Pełna geoda: it all breaks as 16 lines and a new geode starts', () => {
    const sim = simWith([]);
    sim.start(180);
    for (let i = 0; i < N * N; i++) sim.wall.cells[i] = i % 3 ? { k: ROCK, gem: 0, clarity: 1, piece: 0 } : { k: GEM, gem: 0, clarity: 2, piece: 1 };
    const value = sim.wall.cells.reduce((s, c) => s + (c.k === GEM ? c.clarity : 0), 0);
    const ev = run(sim, sim.block!.dur + 3.5, t => focusing(t));
    expect(ev.find(e => e.type === 'zbior')).toMatchObject({ full: true });
    expect(sim.stats.fullGeodes).toBe(1);
    expect(sim.stats.lines).toBe(16);
    expect(sim.carats).toBe(value * 2);
    expect(sim.wall.emptyCount()).toBeGreaterThan(15);     // a fresh geode
  });

  it(`a wall filled to all but ${FULL_EMPTY} cells breaks whole as a Pełna geoda, one more empty cell is an ordinary Zbiór`, () => {
    const zbiorWith = (empty: number, ftue = false) => {
      // crystals and rock, with the holes on the diagonals: no line is full
      const holes = [...Array.from({ length: N }, (_, i) => i * N + i), ...Array.from({ length: N }, (_, i) => i * N + N - 1 - i)].slice(0, empty);
      const sim = simWith(holes, { ftue });
      for (let i = 0; i < N * N; i++) if (!holes.includes(i) && (i * 5) % 3 === 0) sim.wall.cells[i] = { k: GEM, gem: 1, clarity: 3, piece: 1 };
      sim.start(180);
      const value = sim.wall.cells.reduce((s, c) => s + (c.k === GEM ? c.clarity : 0), 0);
      expect(sim.toFull).toBe(ftue ? null : Math.max(0, empty - FULL_EMPTY));
      expect(sim.wall.fullLines()).toEqual([]);
      const ev = run(sim, sim.block!.dur + 3.5, t => focusing(t));
      return { sim, ev, value };
    };
    const full = zbiorWith(FULL_EMPTY);
    expect(full.ev.find(e => e.type === 'zbior')).toMatchObject({ full: true });
    expect(full.ev.filter(e => e.type === 'shatter').length).toBe(N);        // row by row, every cell
    expect(full.ev.find(e => e.type === 'bonus')).toMatchObject({ lines: 16, mult: LINE_BONUS[3], carats: full.value * 2 });
    expect(full.sim.stats.fullGeodes).toBe(1);
    expect(full.sim.wall.emptyCount()).toBeGreaterThan(FULL_EMPTY + 6);       // a fresh geode
    expect(full.sim.bowl.length).toBeGreaterThan(0);
    const short = zbiorWith(FULL_EMPTY + 1);
    expect(short.ev.find(e => e.type === 'zbior')).toMatchObject({ full: false, lines: [] });
    expect(short.sim.stats.fullGeodes).toBe(0);
    expect(short.sim.carats).toBe(0);
    // the first session's small learning wall fills too soon: no Pełna geoda there
    const first = zbiorWith(FULL_EMPTY, true);
    expect(first.ev.find(e => e.type === 'zbior')).toMatchObject({ full: false });
    expect(first.sim.stats.fullGeodes).toBe(0);
  });

  it('a steady player fills a Pełna geoda about every 3–5 sessions; without control the wall never gets there', () => {
    const sessions = (level: number, seeds: number) => {
      let withFull = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        const sim = newSim({ plannedSec: 300, rng: mulberry32(seed) });
        sim.start(300);
        let t = 0, hold = 0, full = false;
        while (sim.phase !== 'done' && t < 330) {
          hold = sim.phase === 'wzrost' ? hold + 0.1 : 0;
          sim.update(0.1, sim.phase === 'wzrost' && level > 0.6 ? focusing(hold) : frame({ activity: 1, level, calm: 1 - level }), t >= 300);
          for (const e of sim.events.splice(0)) if (e.type === 'zbior' && e.full) full = true;
          t += 0.1;
          if (sim.phase !== 'wzrost' || Math.round(t * 10) % 10) continue;
          // the greedy player: lines first, full-grown crystals, anything useful at the end of the block
          const late = sim.bt > sim.block!.dur - 2;
          for (let s = 0; s < 3; s++) {
            const c = sim.tray[s];
            const cells = c && crystalCells(c), spot = cells && bestSpot(sim.wall, cells);
            if (!c || !cells || !spot) continue;
            const score = spotScore(sim.wall, cells, spot[0], spot[1]);
            if (score >= 100 || c.grown === c.ghost.length || (late && score > 4)) sim.place(s, spot[0], spot[1]);
          }
        }
        if (full) withFull++;
      }
      return withFull / seeds;
    };
    const steady = sessions(0.95, 30);
    expect(steady).toBeGreaterThan(0.15);
    expect(steady).toBeLessThan(0.5);
    expect(sessions(0.5, 15)).toBe(0);
  });

  it('a Szlif its judge passes polishes the round’s best gem; a restless one loses nothing', () => {
    const polishAfter = (f: (t: number) => FocusFrame, o: Partial<SimOptions> = {}) => {
      const sim = simWith([...lineCells(0)], o);
      sim.start(180);
      sim.tray[0] = crystal(SHAPES.findIndex(sh => sh.id === 'I5'), 5, [3, 3, 3, 3, 3]);
      sim.tray[1] = crystal(0, 3, [2, 2, 2], 0, 1);
      sim.place(0, 0, 0);
      sim.place(1, 5, 0);
      run(sim, sim.block!.dur + 3.1, t => focusing(t));
      expect(sim.phase).toBe('szlif');
      const best = sim.bowl[sim.bowlBest];
      expect(best.value).toBe(15);
      const before = sim.carats;
      let shine = 0, t = 0;
      for (; sim.phase === 'szlif' && t < 60; t += 0.05) {
        shine = sim.shine;
        sim.update(0.05, f(t), false);
      }
      expect(sim.phase).toBe('wzrost');
      expect(sim.carats).toBe(before);
      return { polished: sim.stats.polished, best: best.polish, shine, need: sim.polishNeed, judged: sim.stats.restJudged };
    };
    const calm = () => frame({ activity: -2, threshold: 2, level: 0.1, calm: 0.9 });
    const restless = () => frame({ activity: 6, threshold: 2, level: 0.9, calm: 0.1 });
    const rested = polishAfter(calm);
    expect(rested).toMatchObject({ polished: 1, best: 1, judged: 1 });
    expect(rested.shine).toBeGreaterThan(0.9);                   // the shine on display filled past the mark
    expect(polishAfter(restless)).toMatchObject({ polished: 0, best: 0, shine: 0, judged: 1 });
    expect(polishAfter(() => frame({ reliable: false, activity: null, calm: 0 }))).toMatchObject({ polished: 0, best: 0, judged: 0 });
    // a rest with 35 % of its window below the threshold: with the kit's 60 % target a rest needs 30 %
    // below and passes, with a beginner's wider lean 25 % (passes), with a 50 % target 40 % (fails)
    const third = (t: number) => (t % 3 < 1.05 ? calm() : restless());
    const kit = polishAfter(third), beginner = polishAfter(third, { tuning: BEGINNER }), half = polishAfter(third, { tuning: { ...TUNING, targetRate: 0.5 } });
    expect([kit.polished, beginner.polished, half.polished]).toEqual([1, 1, 0]);
    expect(kit.need).toBeCloseTo(0.3, 9);
    expect(beginner.need).toBeCloseTo(0.25, 9);
    expect(half.need).toBeCloseTo(0.4, 9);
    // the shine on display agrees with the verdict: past the mark when it polished
    expect(kit.shine).toBeGreaterThan(kit.need);
    expect(half.shine).toBeLessThan(half.need);
  });
});

describe('Geoda Ciemna komora and the end', () => {
  it('hides the chamber’s growth until the Zbiór, while the other crystals can still be set', () => {
    // the third Wzrost is the dark one
    const s2 = newSim({ plannedSec: 180, rng: mulberry32(8), blind: true });
    s2.start(180);
    let hold = 0;
    const ev: GeodaEvent[] = [];
    while (s2.round < 2 || s2.phase !== 'wzrost') ev.push(...run(s2, 0.05, () => { hold = s2.phase === 'wzrost' ? hold + 0.05 : 0; return s2.phase === 'wzrost' ? focusing(hold) : resting(); }));
    const chamber = s2.blindSlot;
    expect(chamber).toBeGreaterThanOrEqual(0);
    expect(s2.fed).not.toBe(chamber);                        // taps and keys work with the others
    expect(s2.select(chamber)).toBe(false);
    expect(s2.canPlace(chamber)).toBe(false);
    expect(s2.crumble(chamber)).toBe(false);
    s2.tray[chamber] = crystal(SHAPES.findIndex(sh => sh.id === 'I5'), 1);   // a fresh seed in the dark
    const dark = run(s2, 10, t => focusing(t));
    const grows = dark.filter((e): e is Extract<GeodaEvent, { type: 'grow' }> => e.type === 'grow' && e.slot === chamber);
    expect(grows.length).toBeGreaterThan(0);
    expect(grows.every(e => e.hidden)).toBe(true);
    const rest = run(s2, s2.block!.dur, t => focusing(t), 10);
    const reveal = rest.find((e): e is Extract<GeodaEvent, { type: 'reveal' }> => e.type === 'reveal');
    expect(reveal).toBeDefined();
    expect(reveal!.grown).toBe(5);
    // the block's hold made its cells clearer as they grew: mostly czyste
    expect(s2.tray[chamber]!.clarity).toEqual([1, 1, 2, 2, 2]);
    expect(reveal!.clarity).toBe(2);
    expect(s2.stats.blind.length).toBe(1);
    expect(s2.blindSlot).toBe(-1);
  });

  it('time up: a Wzrost harvests at once, then the 5 s crack, then done', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(2) });
    sim.start(180);
    run(sim, 10, () => focusing(5));
    expect(sim.phase).toBe('wzrost');
    let ev = run(sim, 0.1, () => focusing(5), 10, 0);
    expect(sim.ending).toBe(true);
    expect(sim.phase).toBe('zbior');
    ev = run(sim, 3.1, () => focusing(5), 10, 0);
    expect(ev.some(e => e.type === 'finale')).toBe(true);
    expect(sim.phase).toBe('finale');
    run(sim, 4.8, () => focusing(5), 10, 0);
    expect(sim.phase).toBe('finale');
    run(sim, 0.3, () => focusing(5), 10, 0);
    expect(sim.phase).toBe('done');
  });

  it('the last Zbiór waits for a crystal still in the hand', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(2) });
    sim.start(180);
    sim.update(0.1, focusing(1), true, true);
    expect(sim.phase).toBe('zbior');
    for (let i = 0; i < 60; i++) sim.update(0.1, focusing(1), true, true);
    expect(sim.phase).toBe('zbior');
    sim.update(0.1, focusing(1), true, false);
    expect(sim.phase).toBe('finale');
  });

  /** Two full rows of crystals (0 and 1) and a hole in every other row and column (more than a Pełna geoda leaves). */
  const twoRows = (clarity: 1 | 2 | 3) => {
    const holes = [2 * N, 3 * N + 1, 4 * N + 2, 5 * N + 3, 6 * N + 4, 7 * N + 5, 7 * N + 6, 2 * N + 3, 2 * N + 6, 3 * N + 3, 3 * N + 5, 4 * N + 6, 5 * N, 6 * N + 1, 4 * N + 7];
    const sim = simWith(holes);
    for (const i of [...lineCells(0), ...lineCells(1)]) sim.wall.cells[i] = { k: GEM, gem: 1, clarity, piece: 1 };
    expect(sim.wall.fullLines()).toEqual([0, 1]);
    return sim;
  };

  it('ended early, a session settles at once: the open Wzrost is judged and its full lines break and pay, up to the finale', () => {
    const sim = twoRows(2);
    sim.start(180);
    run(sim, 8, t => focusing(t));
    expect(sim.phase).toBe('wzrost');
    sim.settle();
    expect(sim.phase).toBe('finale');
    expect(sim.stats.focusJudged).toBe(1);
    expect(sim.stats.lines).toBe(2);
    expect(sim.carats).toBe(16);                                   // the bonus: 50 % of the 32 carats in the two rows
    expect(sim.events.some(e => e.type === 'finale')).toBe(true);
    sim.settle();                                                   // once
    expect(sim.carats).toBe(16);
    expect(sim.stats.focusJudged).toBe(1);
  });

  it('ended early in a Szlif, the rest is judged and polishes; in a Zbiór, the harvest finishes', () => {
    const sim = simWith([...lineCells(0)]);
    sim.start(180);
    sim.tray[0] = crystal(SHAPES.findIndex(sh => sh.id === 'I5'), 5, [3, 3, 3, 3, 3]);
    sim.tray[1] = crystal(0, 3, [2, 2, 2], 0, 1);
    sim.place(0, 0, 0);
    sim.place(1, 5, 0);
    run(sim, sim.block!.dur + 3.1, t => focusing(t));
    expect(sim.phase).toBe('szlif');
    run(sim, 9, () => frame({ activity: -2, threshold: 2, level: 0.1, calm: 0.9 }));
    sim.settle();
    expect(sim.phase).toBe('finale');
    expect(sim.stats.restJudged).toBe(1);
    expect(sim.stats.polished).toBe(1);
    // a Zbiór cut short: every line breaks and pays before the finale
    const z = twoRows(1);
    z.start(180);
    run(z, z.block!.dur + 0.2, t => focusing(t));
    expect(z.phase).toBe('zbior');
    z.settle();
    expect(z.phase).toBe('finale');
    expect(z.stats.lines).toBe(2);
    expect(z.carats).toBe(8);
  });
});

describe('Geoda first session', () => {
  it('starts on a wall to learn on: a row with a 2-cell gap, one seed that grows its 2nd cell in about 6 s', () => {
    const sim = newSim({ plannedSec: 180, rng: mulberry32(1), ftue: true, beginner: true });
    sim.start(180);
    expect(FTUE_GAP.every(i => sim.wall.cells[i].k === EMPTY)).toBe(true);
    expect(N - sim.wall.filled(5)).toBe(2);
    expect(sim.slots).toBe(1);
    expect(sim.tray[1]).toBeNull();
    const seed = sim.tray[0]!;
    expect(crystalCells({ ...seed, grown: 2 })).toEqual([[0, 0], [1, 0]]);   // its first two cells lie across, like the gap
    run(sim, 6.2, () => frame({ activity: 0, level: 0.3, calm: 0.7 }));       // no help from the band at all
    expect(seed.grown).toBe(2);
    expect(sim.place(0, 3, 5)).toBe(true);
    expect(sim.wall.full(5)).toBe(true);
    expect(sim.stats.firstCrystal).toBe(true);
  });

  it('opens a second slot in round 2 and the third in round 3', () => {
    const sim = newSim({ plannedSec: 300, rng: mulberry32(1), ftue: true });
    sim.start(300);
    const slots: number[] = [];
    let last = -1;
    run(sim, 300, () => {
      if (sim.phase === 'wzrost' && sim.round !== last) { last = sim.round; slots.push(sim.slots); }
      return focusing(3);
    });
    expect(slots.slice(0, 4)).toEqual([1, 2, 3, 3]);
  });
});

describe('Geoda daily geode', () => {
  it('is the same wall and seed bag for everyone on a day, another one the next day', () => {
    const today = (seed: number) => newSim({ plannedSec: 180, rng: mulberry32(Date.now() % 1000), bagRng: mulberry32(seed) });
    const a = today(123456), b = today(123456), c = today(654321);
    a.start(180);
    b.start(180);
    c.start(180);
    expect(a.wall.toString()).toBe(b.wall.toString());
    expect(a.tray.map(x => x!.ghost)).toEqual(b.tray.map(x => x!.ghost));
    expect(a.wall.toString()).not.toBe(c.wall.toString());
  });
});

// ── the cabinet ─────────────────────────────────────────────────

describe('Geoda progress', () => {
  it('starts with the calibration’s amethyst and version 1', () => {
    const p = freshProgress();
    expect(p.v).toBe(1);
    expect(p.cracks).toBe(0);
    expect(p.gablota).toEqual([0, null, null, null, null, null, null, null, null]);
    expect(bestCarats(p)).toBeNull();
    expect(geoda.best(p)).toBeNull();
    expect(MINERALS.length).toBe(9);
  });

  it('publishes odds that sum to 1 and improve with clarity and the longest hold', () => {
    for (const q of [0, 0.5, 1]) expect(tierOdds(q).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(tierOdds(1)[3]).toBeGreaterThan(tierOdds(0)[3]);
    expect(tierOdds(1)[0]).toBeLessThan(tierOdds(0)[0]);
    expect(quality(1, 30)).toBe(1);
    expect(quality(null, 0)).toBe(0);
  });

  it('pity: even with the worst luck a piękny comes within 5 rolls, a rzadki within 10, a muzealny within 20', () => {
    const p = freshProgress();
    const worst = () => 0;    // the roll always lands on the plainest tier the floor allows
    const tiers: number[] = [];
    for (let i = 0; i < 20; i++) tiers.push(crack(p, worst, 0, 50).specimen.tier);
    expect(tiers.slice(0, 5).some(t => t >= 1)).toBe(true);
    expect(tiers.slice(0, 10).some(t => t >= 2)).toBe(true);
    expect(tiers.slice(0, 20).some(t => t >= 3)).toBe(true);
    expect(tiers.indexOf(1)).toBe(PITY[1] - 1);
    expect(rollTier(() => 0, tierOdds(0), [0, 0, 0, 0])).toBe(0);
    expect(rollTier(() => 0.99999, tierOdds(0), [0, 0, 0, 0])).toBe(3);
  });

  it('the first geodes always hold a mineral the cabinet misses; later ones any of the nine', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = freshProgress();
      const rng = mulberry32(seed);
      for (let i = 0; i < NEW_FIRST; i++) expect(crack(p, rng, 0, 40).outcome).toBe('new');
      expect(found(p)).toBe(1 + NEW_FIRST);
      expect(p.cracks).toBe(NEW_FIRST);
    }
    // a Pełna geoda's extra roll in an early session is new too
    const early = freshProgress();
    expect(crackGeodes(early, mulberry32(4), { carats: 90, clearShare: 0.5, longest: 10, geodes: 2 }).rolls.map(r => r.outcome)).toEqual(['new', 'new']);
    // afterwards every mineral, the calibration's amethyst included, comes 1 in 9
    const p = freshProgress();
    p.cracks = NEW_FIRST;
    const seen = new Set<number>(), rng = mulberry32(8);
    for (let i = 0; i < 300; i++) seen.add(crack(p, rng, 0, 40).specimen.m);
    expect(seen.size).toBe(MINERALS.length);
  });

  it('turns duplicates into pył; 30 pył crafts the next missing specimen', () => {
    const p = freshProgress();
    p.pity = [0, 0, 0, 0];
    p.cracks = NEW_FIRST;                           // past the first geodes' new minerals
    const dupe = crack(p, () => 0, 0, 10);          // mineral 0, plainest tier: the amethyst again
    expect(dupe.outcome).toBe('dust');
    expect(p.dust).toBe(DUST[0]);
    p.dust = CRAFT_DUST + 4;
    expect(craft(p)).toEqual([1]);
    expect(p.gablota[1]).toBe(0);
    expect(p.dust).toBe(4);
  });

  it('credits a session as it goes: it counts once from its first block, XP and counters by what is new', () => {
    const p = freshProgress();
    p.dailyDay = '2026-10-23';
    p.dailyBest = 300;
    const credit = new SessionCredit(p, '2026-10-24', true);
    expect(credit.levelBefore).toBe(1);
    expect(p.sessions).toBe(0);
    credit.add({ carats: 40, zoneSec: 20, lines: 1, fullGeodes: 0 });
    expect(p).toMatchObject({ sessions: 1, xp: 24, lines: 1, fullGeodes: 0, dailyDay: '2026-10-24', dailyBest: 0 });
    credit.add({ carats: 40, zoneSec: 20, lines: 1, fullGeodes: 0 });          // nothing new, nothing moves
    expect(p).toMatchObject({ sessions: 1, xp: 24, lines: 1 });
    credit.add({ carats: 120, zoneSec: 90, lines: 9, fullGeodes: 1 });
    expect(p).toMatchObject({ sessions: 1, xp: 90 + 12, lines: 9, fullGeodes: 1 });
    expect(depth(p.xp).level).toBe(2);
    record(p, 180, 120, 18, '2026-10-24');
    record(p, 180, 90, 18, '2026-10-24');
    expect(p.dailyBest).toBe(120);
    // the crack: the session's geode and the Pełna geoda's
    const k = crackGeodes(p, mulberry32(3), { carats: 120, clearShare: 0.6, longest: 18, geodes: 2 });
    expect(k.rolls.length).toBe(2);
    expect(p.biggest).toBe(specimenCm(120));
    expect(p.star).not.toBeNull();
    expect(p.sessions).toBe(1);
  });

  it('keeps records with Math.max and grows the depth level', () => {
    const p = freshProgress();
    record(p, 180, 50, 12.4);
    record(p, 180, 30, 20);
    record(p, 300, 70, 3);
    expect(p.best).toEqual({ 180: 50, 300: 70 });
    expect(p.longestCont).toBe(20);
    expect(bestCarats(p)).toBe(70);
    expect(xpFor(1)).toBe(0);
    expect(xpFor(2)).toBe(60);
    expect(depth(59).level).toBe(1);
    expect(depth(60)).toEqual({ level: 2, from: 60, to: 200 });
    expect(sizeClass(10)).toEqual({ size: 0, need: 20 });
    expect(t(SIZES[sizeClass(10).size].goal, { need: 20 })).toBe('Okaz drobny · do małego 20 ct');
    expect(sizeClass(160)).toEqual({ size: 3, need: 90 });
    expect(sizeClass(500)).toEqual({ size: SIZES.length - 1, need: null });
    expect(t(SIZES[SIZES.length - 1].goal)).toBe('Okaz wielki');
    expect(TIERS.length).toBe(4);
  });
});

// ── the screen ──────────────────────────────────────────────────

describe('Geoda on screen', () => {
  /** Manrope's advance widths, roughly (em): the reviewer measured "CIEMNA KOMORA" hair-spaced at 700 11 px as 100.2 px and "za chwilę szlif" at 600 10.5 px as 68.7 px */
  const HAIR = String.fromCharCode(8202);
  const em = (ch: string) => (ch === HAIR ? 0.08 : ch === ' ' ? 0.26 : ch === '→' ? 0.9 : ch !== ch.toLowerCase() ? 0.64 : 0.47);
  const measure: Measure = (text, px) => [...text].reduce((s, ch) => s + em(ch) * px, 0);
  const used = (r: ReturnType<typeof statusRow>) => measure(r.name, r.nameFs, 700) + (r.tele ? 8 + measure(r.tele, r.teleFs, 600) : 0);

  it('fits the block’s name and the telegraph into the HUD’s column, never running together, in every language', () => {
    expect(measure(['C', 'I', 'E', 'M', 'N', 'A', ' ', 'K', 'O', 'M', 'O', 'R', 'A'].join(HAIR), 11, 700)).toBeCloseTo(100.2, -1);
    expect(measure('za chwilę szlif', 10.5, 600)).toBeCloseTo(68.7, -1);
    for (const lang of LANGS) {
      const c = CATALOGS[lang] as Record<GeodaKey, string>;
      const teles = [null, { long: c['tele.szlif'], short: c['tele.szlifShort'] }, { long: c['tele.wzrost'], short: c['tele.wzrostShort'] }];
      for (const w of [88, 110, 140, 150, 168, 172, 196, 244]) {
        for (const name of [c['block.wzrost'], c['block.zbior'], c['block.szlif'], c['block.blind']]) {
          for (const tele of teles) {
            for (const [fs, small] of [[11, 10.5], [13, 11.5]]) {
              const r = statusRow(measure, name, tele, w, fs, small);
              expect(used(r)).toBeLessThanOrEqual(w);
              expect(r.nameFs).toBeGreaterThanOrEqual(9);
              expect(r.name.replaceAll(HAIR, '')).toBe(name.toUpperCase());
              // on the 390 px phone's column the next block is still announced, at least in short
              if (tele && w >= 168) expect(r.tele).not.toBeNull();
            }
          }
        }
      }
    }
    // the reviewer's case, a 390 px phone's 168 px column: the name loses its hair spaces, the telegraph stays whole
    expect(statusRow(measure, 'Ciemna komora', TELEGRAPH.szlif, 168, 11, 10.5)).toEqual({ name: 'CIEMNA KOMORA', nameFs: 11, tele: 'za chwilę szlif', teleFs: 10.5 });
    // a 360 px phone's 140 px column: the short telegraph
    expect(statusRow(measure, 'Ciemna komora', TELEGRAPH.wzrost, 140, 11, 10.5).tele).toBe('→ wzrost');
    // room enough: hair-spaced capitals
    expect(statusRow(measure, 'Wzrost', TELEGRAPH.szlif, 244, 13, 11.5).name).toBe([...'WZROST'].join(HAIR));
    // the HUD's status column on the phones it must fit (portrait): at least the 140 px tested above
    for (const [w, h] of [[360, 740], [390, 844], [430, 932]] as const) {
      const l = computeLayout(w, h);
      expect(Math.min(172, l.hud.w * 0.5 - 8)).toBeGreaterThanOrEqual(140);
    }
  });

  it('sizes tray crystals by the widest and the tallest crystal separately; every crystal fits its slot', () => {
    const l = computeLayout(844, 390);
    const flat = trayCellFor(l, 5, 1), tall = trayCellFor(l, 1, 5);
    expect(flat).toBeGreaterThan(tall);              // a lying I5 is not shrunk by the slot's height
    expect(flat).toBeGreaterThanOrEqual(18);
    expect(tall).toBeGreaterThanOrEqual(14);          // was 12: the landscape label moved beside the crystal
    expect(trayCellFor(l, 2, 4)).toBeGreaterThanOrEqual(18);
    for (const [w, h] of [[390, 844], [360, 740], [844, 390], [667, 375], [1280, 800], [1440, 900]] as const) {
      const lay = computeLayout(w, h);
      for (const os of ORIENTS) {
        for (const g of os) {
          const gw = Math.max(...g.map(p => p[0])) + 1, gh = Math.max(...g.map(p => p[1])) + 1;
          const cs = trayCellFor(lay, gw, gh), s = lay.slots[0], band = trayBand(lay, s);
          expect(cs).toBeGreaterThanOrEqual(10);
          expect(gw * cs).toBeLessThanOrEqual(s.w);
          expect(gh * cs).toBeLessThanOrEqual(band.bottom - band.top + 1e-9);
        }
      }
    }
  });

  it('frames the lobby’s geode above the hero’s words on a phone, as before on a desktop, and large in a wide card', () => {
    const phone = frameFor(358, 268, true);
    expect(phone.wall.y - phone.reach).toBeGreaterThanOrEqual(0);
    expect(phone.wall.y + phone.wall.h + phone.reach).toBeLessThanOrEqual(268 - HERO_TEXT);
    expect(phone.wall.w).toBeGreaterThan(100);
    expect(phone.sides.length).toBe(2);                // the cave fills its sides
    const desk = frameFor(668, 610, true);
    expect(desk.wall.w).toBeCloseTo(Math.min(668 * 0.52, 610 * 0.56), 6);
    expect(desk.wall.y + desk.wall.h / 2).toBeCloseTo(610 * 0.42, 6);
    for (const [w, h] of [[548, 150], [360, 150]] as const) {
      const card = frameFor(w, h, false);
      expect(card.wide).toBe(true);
      expect(card.wall.h).toBeGreaterThan(h);          // sized by the band's height, cropped by it
      expect(card.sides.length).toBe(2);
      expect(card.sides.every(s => s.w > 50)).toBe(true);
    }
    expect(frameFor(260, 230, false).wide).toBe(false); // the Start page's tiles keep the whole geode
  });

  it('keeps every layer of the geode’s rim clear of the wall’s corners', () => {
    const pts: [number, number][] = [];
    const rec = { beginPath() { pts.length = 0; }, moveTo(x: number, y: number) { pts.push([x, y]); }, lineTo(x: number, y: number) { pts.push([x, y]); }, closePath() { /* closed */ } } as unknown as CanvasRenderingContext2D;
    for (const rim of [4.5, 9, 13, 22]) {
      const wall = { x: 100, y: 100, w: rim * 26, h: rim * 26 };
      // the crust, the bands and the rind, as drawGeode lays them (offset, wobble)
      for (const [d, rough] of [[1.12, 0.22], [1.22, 0.32], [1.42, 0.32], [1.62, 0.32], [2.6, 0.5]]) {
        for (const seed of [1.7, 2.1, 2.7, 4.1]) {
          geodePath(rec, wall, d * rim, rough * rim, seed);
          expect(pts.length).toBeGreaterThan(60);
          // the distance from each point to the wall's rectangle: never inside the wall's bed
          const gap = Math.min(...pts.map(([x, y]) => Math.hypot(Math.max(wall.x - x, 0, x - wall.x - wall.w), Math.max(wall.y - y, 0, y - wall.y - wall.h))));
          expect(gap).toBeGreaterThanOrEqual(rim >= 9 ? WALL_BED : 1);
        }
      }
    }
  });
});

// ── the game, as the runner drives it ──────────────────────────

/** drawImage calls per canvas, for the tests that look at where things were drawn */
const drawLogs = new Map<unknown, unknown[][]>();

/** A 2D context that accepts every call (happy-dom has no canvas): the renderer's code runs, nothing is painted. */
function fakeContext(canvas: unknown): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 7 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1 });
      if (prop === 'drawImage') return (...a: unknown[]) => { drawLogs.get(canvas)?.push(a); };
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Geoda game', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  const envFor = (progress: GeodaProgress, plannedSec: number, seed = 1): GameEnv<GeodaProgress> => ({
    canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
    progress, rng: mulberry32(seed), day: '2026-10-24', daySeed: 99, plannedSec, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
    tuning: TUNING,
  });

  /**
   * The smoke test's input on the runner's clock: a click at 50 % × 60 % of the canvas every 0.65 s,
   * Space every ~2 s, the simulator's focus on (+20 % over ~10 s) through the kit's FocusInput.
   */
  function smoke(w: number, h: number, sec = 40, until = 22, progress = geoda.freshProgress()): { game: GeodaGame; scoreAt: number | null } {
    const game = geoda.create(envFor(progress, sec)) as GeodaGame;
    game.resize(w, h, 1);
    for (let i = 0; i < 30; i++) {
      game.intro(1 / 30, i / 30);
      game.draw();
    }
    game.start();
    const focus = new FocusInput(BEGINNER);
    const rnd = mulberry32(5);
    let t = 2.4, tap = 0, space = 0, scoreAt: number | null = null;
    const dt = 1 / 30;
    for (let k = 0; t < until; k++) {
      const play = t - 2.4;
      const f = focus.push(20 * (1 - Math.exp(-play / 4)) + (rnd() - 0.5) * 2, true, dt);
      game.update(dt, f, t);
      game.draw();
      tap += dt;
      space += dt;
      if (tap >= 0.65) {
        tap = 0;
        game.pointer({ type: 'down', x: w / 2, y: h * 0.6, id: 1 });
        game.pointer({ type: 'up', x: w / 2, y: h * 0.6, id: 1 });
      }
      if (space >= 1.95) {
        space = 0;
        game.key(' ', true);
        game.key(' ', false);
      }
      if (scoreAt === null && game.result().score > 0) scoreAt = t;
      t += dt;
    }
    return { game, scoreAt };
  }

  it('the smoke input scores within 22 s on the app smoke’s and the shot script’s screens', () => {
    for (const [w, h] of [[1440, 900], [1280, 800], [390, 844], [844, 390]] as const) {
      expect(cellAt(computeLayout(w, h), w / 2, h * 0.6)).not.toBeNull();     // the taps land on the wall
      const { scoreAt } = smoke(w, h);
      expect(scoreAt).not.toBeNull();
      expect(scoreAt!).toBeLessThan(22);
    }
  });

  it('plays a whole 40 s session to its crack, settles once, and result() is idempotent', () => {
    const { game } = smoke(1280, 800, 40, 40);
    const env = (game as unknown as { env: GameEnv<GeodaProgress> }).env;
    const p = env.progress;
    expect(game.canStop()).toBe(false);
    const focus = frame({ activity: 15, level: 0.95, focused: true, hold: 20 });
    let t = 40;
    for (let i = 0; i < 30 * 12 && !game.canStop(); i++) {
      game.update(1 / 30, focus, t);
      game.draw();
      t += 1 / 30;
    }
    expect(game.canStop()).toBe(true);
    expect(p.sessions).toBe(1);
    const a = game.result();
    const snapshot = JSON.stringify(p);
    const b = game.result();
    expect(b).toEqual(a);
    expect(JSON.stringify(p)).toBe(snapshot);
    game.finish();                                   // settled at the crack already: nothing more
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(a.score).toBeGreaterThan(0);
    expect(a.unit).toBe('ct');
    expect(a.highlights[0]).toBe('Pierwszy kryształ');
    expect(a.highlights.some(x => /okaz|Duplikat/i.test(x))).toBe(true);
    expect(a.stats.map(s => s[0])).toEqual(['Kryształy', 'Linie', 'Najdłuższa ciągłość', 'Czyste i lśniące', 'Rytm', 'Bloki w normie', 'Szlif', 'Gablota']);
    expect(p.best['40']).toBe(a.score);
    expect(a.record).toBe(false);                    // nothing to beat on a first try
    expect(a.verse).toBe('1pe2.5');                  // a first wall of common finds: the living stones
    game.destroy();
  });

  it('ended early (the runner reads result(), then destroys the game), a session keeps what it earned', () => {
    const { game } = smoke(1280, 800, 180, 92);
    const p = (game as unknown as { env: GameEnv<GeodaProgress> }).env.progress;
    const out = game.result();
    game.destroy();
    expect(out.score).toBeGreaterThan(0);
    expect(p.sessions).toBe(1);                      // the next session is no first-session tutorial again
    expect(p.xp).toBeGreaterThan(0);
    expect(p.lines).toBeGreaterThan(0);
    expect(p.best['180']).toBe(out.score);
    expect(out.highlights.some(x => /okaz|Duplikat/.test(x))).toBe(false);   // the specimen waits for the crack, or finish()
  });

  it('finish(): a session ended before its crack settles at once — its open block, then the geode — and only once', () => {
    const { game } = smoke(1280, 800, 180, 92);
    const p = (game as unknown as { env: GameEnv<GeodaProgress> }).env.progress;
    const sim = (game as unknown as { sim: GeodaSim }).sim;
    const before = { xp: p.xp, found: p.gablota.filter(t => t !== null).length + p.dust };
    game.finish();
    expect(sim.phase).toBe('finale');
    expect(sim.events).toEqual([]);                  // no show: the session is over
    const out = game.result();
    expect(out.highlights.some(x => /Nowy okaz/.test(x))).toBe(true);   // the first geode brings a new mineral
    expect(p.sessions).toBe(1);
    expect(p.xp).toBeGreaterThanOrEqual(before.xp);
    expect(p.gablota.filter(t => t !== null).length + p.dust).toBeGreaterThan(before.found);
    const snapshot = JSON.stringify(p);
    game.finish();
    expect(game.result()).toEqual(out);
    expect(JSON.stringify(p)).toBe(snapshot);
    game.destroy();
  });

  it('marks the daily geode from the first block’s end, and its judge follows the runner’s tuning', () => {
    const p = geoda.freshProgress();
    p.sessions = 4;
    p.dailyDay = '2026-10-20';
    const { game } = smoke(390, 844, 180, 34, p);
    expect(p.dailyDay).toBe('2026-10-24');
    expect(game.result().highlights).toContain('Geoda dnia zaliczona');
    game.destroy();
    const sim = (g: unknown) => (g as { sim: GeodaSim }).sim;
    const plain = geoda.create(envFor(geoda.freshProgress(), 180)) as GeodaGame;
    const tuned = geoda.create({ ...envFor(geoda.freshProgress(), 180), tuning: BEGINNER }) as GeodaGame;
    expect(sim(plain).polishNeed).toBeCloseTo(0.3, 9);
    expect(sim(tuned).polishNeed).toBeCloseTo(0.25, 9);          // a beginner's judge leans further: 1 − 0.6 − 0.15
  });

  it('drag and drop: a crystal lifted a cell above the finger lands where its ghost snaps, or slides back', () => {
    const p = geoda.freshProgress();
    p.sessions = 5;
    p.dailyDay = '2026-10-24';
    const game = geoda.create(envFor(p, 180, 4)) as GeodaGame;
    game.resize(1280, 800, 1);
    game.start();
    game.update(1 / 30, frame(), 2.4);
    const g = game as unknown as { sim: GeodaSim; layout: ReturnType<typeof computeLayout> };
    const l = g.layout, sim = g.sim;
    const slot = l.slots[0];
    // a crystal of one cell, an empty cell at (x, y): drop the finger a cell below it
    sim.tray[0] = crystal(0, 1);
    const target = sim.wall.cells.findIndex(c => c.k === EMPTY);
    const tx = l.wall.x + (target % N + 0.5) * l.cell, ty = l.wall.y + (Math.floor(target / N) + 0.5) * l.cell + l.cell * 1.1;
    game.pointer({ type: 'down', x: slot.x + slot.w / 2, y: slot.y + slot.h / 2, id: 3 });
    game.pointer({ type: 'move', x: (slot.x + tx) / 2, y: (slot.y + ty) / 2, id: 3 });
    game.pointer({ type: 'move', x: tx, y: ty, id: 3 });
    game.draw();
    game.pointer({ type: 'up', x: tx, y: ty, id: 3 });
    expect(sim.wall.cells[target].k).toBe(GEM);
    expect(sim.tray[0]).toBeNull();
    // a drop on rock slides back
    sim.tray[1] = crystal(0, 1);
    const rock = sim.wall.cells.findIndex(c => c.k === ROCK);
    const rx = l.wall.x + (rock % N + 0.5) * l.cell, ry = l.wall.y + (Math.floor(rock / N) + 0.5) * l.cell + l.cell * 1.1;
    const s1 = l.slots[1];
    game.pointer({ type: 'down', x: s1.x + s1.w / 2, y: s1.y + s1.h / 2, id: 4 });
    game.pointer({ type: 'move', x: rx, y: ry, id: 4 });
    game.pointer({ type: 'up', x: rx, y: ry, id: 4 });
    expect(sim.wall.cells[rock].k).toBe(ROCK);
    expect(sim.tray[1]).not.toBeNull();
    // a tap on a crystal feeds it; keys 1–3 too
    game.pointer({ type: 'down', x: s1.x + 10, y: s1.y + 10, id: 5 });
    game.pointer({ type: 'up', x: s1.x + 10, y: s1.y + 10, id: 5 });
    expect(sim.fed).toBe(1);
    expect(game.key('3', true)).toBe(true);
    expect(sim.fed).toBe(2);
    game.destroy();
  });

  it('a held Backspace crumbles the fed crystal after 0.8 s', () => {
    const p = geoda.freshProgress();
    p.sessions = 5;
    const game = geoda.create(envFor(p, 180, 6)) as GeodaGame;
    game.resize(390, 844, 2);
    game.start();
    game.update(1 / 30, frame(), 2.4);
    const sim = (game as unknown as { sim: GeodaSim }).sim;
    sim.tray[sim.fed] = crystal(1, 3);
    game.key('Backspace', true);
    for (let i = 0; i < 20; i++) game.update(1 / 30, frame(), 2.4 + i / 30);
    expect(sim.tray[sim.fed]!.grown).toBe(3);
    for (let i = 0; i < 10; i++) game.update(1 / 30, frame(), 3.1 + i / 30);
    expect(sim.tray[sim.fed]!.grown).toBe(1);
    game.key('Backspace', false);
    game.destroy();
  });

  /** A returning player's session (no tutorial, today's daily geode already played) at its first frame. */
  const returning = (w: number, h: number, seed = 3, o: Partial<GameEnv<GeodaProgress>> = {}) => {
    const p = geoda.freshProgress();
    p.sessions = 5;
    p.dailyDay = '2026-10-24';
    const game = geoda.create({ ...envFor(p, 180, seed), ...o }) as GeodaGame;
    game.resize(w, h, 1);
    game.start();
    const g = game as unknown as { sim: GeodaSim; layout: ReturnType<typeof computeLayout>; view: { caption: { text: string; sub: string } | null; regrow: { held: boolean; t: number; cells: Set<number> } } };
    return { game, sim: g.sim, layout: g.layout, view: g.view };
  };

  it('the ambient pad follows focus in a Wzrost, a dark calm in a Szlif, and holds still in a Ciemna komora and the Zbiór', () => {
    const { game, sim } = returning(1280, 800);
    const pad = (level: number, calm: number, reliable = true) => game.padLevel(frame({ level, calm, reliable }));
    expect(pad(0.8, 0.2)).toBe(0.8);                 // the first Wzrost is about to start
    game.update(1 / 30, frame(), 2.4);
    expect(sim.phase).toBe('wzrost');
    expect(pad(0.8, 0.2)).toBe(0.8);
    expect(pad(0.8, 0.2, false)).toBe(0);            // no signal: dark, as the kit does it
    sim.blindSlot = 1;                               // a Ciemna komora: no feedback, not even by ear
    expect(pad(0.8, 0.2)).toBeNull();
    sim.blindSlot = -1;
    let t = 2.4;
    while (sim.phase === 'wzrost') game.update(0.1, frame(), (t += 0.1));
    expect(sim.phase).toBe('zbior');
    expect(pad(0.8, 0.2)).toBeNull();
    while (sim.phase === 'zbior') game.update(0.1, frame(), (t += 0.1));
    expect(sim.phase).toBe('szlif');
    const calm = pad(0.1, 1)!, restless = pad(0.9, 0)!;
    expect(calm).toBeGreaterThan(restless);          // a little lighter with calm…
    expect(calm).toBeLessThan(0.31);                 // …and dark: a rest never plays the focus level
    expect(pad(0.95, 0)).toBe(restless);
    game.destroy();
  });

  it('a long press crumbles only a crystal that fits nowhere: holding one to look at it is safe', () => {
    const { game, sim, layout } = returning(390, 844, 4);
    game.update(1 / 30, frame(), 2.4);
    const s0 = layout.slots[0], x = s0.x + s0.w / 2, y = s0.y + s0.h / 2;
    const hold = (sec: number) => {
      game.pointer({ type: 'down', x, y, id: 7 });
      for (let i = 0; i < sec * 30; i++) game.update(1 / 30, frame({ reliable: false, activity: null }), 3);
      game.pointer({ type: 'up', x, y, id: 7 });
    };
    sim.fed = 1;
    sim.tray[0] = crystal(1, 3);                     // three cells of an L: they fit the wall
    expect(sim.fitsSomewhere(0)).toBe(true);
    hold(1.5);
    expect(sim.tray[0]!.grown).toBe(3);              // kept…
    expect(sim.fed).toBe(0);                         // …and fed: the hold counts as a tap
    sim.wall = new Wall();                           // all rock but one cell: it fits nowhere now
    sim.wall.cells[0] = { k: EMPTY, gem: 0, clarity: 1, piece: 0 };
    expect(sim.fitsSomewhere(0)).toBe(false);
    hold(1);
    expect(sim.tray[0]!.grown).toBe(1);              // crumbled back to its seed, which fits
    game.destroy();
  });

  it('“Nowy rekord!” is the best over every session length, as the runner shows it; a best for this length gets a line of its own', () => {
    const p = geoda.freshProgress();
    p.sessions = 5;
    p.dailyDay = '2026-10-24';
    p.best = { '600': 9999, '180': 1 };
    const a = smoke(1280, 800, 180, 40, p).game, out = a.result();
    expect(out.score).toBeGreaterThan(1);
    expect(out.record).toBe(false);
    expect(out.highlights).toContain(`Rekord 3 min: ${out.score} ct`);
    a.destroy();
    const q = geoda.freshProgress();
    q.sessions = 5;
    q.dailyDay = '2026-10-24';
    q.best = { '180': 1 };
    const b = smoke(1280, 800, 180, 40, q).game, out2 = b.result();
    expect(out2.record).toBe(true);
    expect(out2.highlights.some(x => x.startsWith('Rekord'))).toBe(false);
    b.destroy();
  });

  it('shows each Wzrost’s verdict under the Zbiór’s caption, or on its own when no line breaks', () => {
    const captionAfter = (steady: boolean, line: boolean) => {
      const { game, sim, view } = returning(1280, 800, 5);
      game.update(1 / 30, frame(), 2.4);
      if (line) for (const i of lineCells(0)) if (sim.wall.cells[i].k === EMPTY) sim.wall.cells[i] = { k: GEM, gem: 2, clarity: 2, piece: 99 };
      const f = steady ? frame({ activity: 12, level: 0.95, focused: true, hold: 1 }) : frame({ activity: -3, level: 0.1 });
      for (let t = 2.4; sim.phase !== 'zbior'; t += 1 / 30) {
        game.update(1 / 30, f, t);
        game.draw();
      }
      const c = view.caption && { ...view.caption };
      game.destroy();
      return c;
    };
    expect(captionAfter(true, true)).toMatchObject({ text: 'Zbiór', sub: 'Równy wzrost' });
    expect(captionAfter(true, false)).toMatchObject({ text: '', sub: 'Równy wzrost' });
    expect(captionAfter(false, false)).toMatchObject({ text: '', sub: 'Tym razem nierówno' });
  });

  it('lays the cleared lines as rubble through the Szlif and regrows them only in the telegraph of the next Wzrost', () => {
    const { game, sim, view } = returning(390, 844, 6);
    game.update(1 / 30, frame(), 2.4);
    for (const i of lineCells(0)) if (sim.wall.cells[i].k === EMPTY) sim.wall.cells[i] = { k: GEM, gem: 0, clarity: 1, piece: 99 };
    let t = 2.4;
    const step = () => {
      game.update(0.1, frame(), (t += 0.1));
      game.draw();
    };
    while (sim.phase !== 'szlif') step();
    expect(view.regrow.held).toBe(true);
    expect([...view.regrow.cells]).toEqual(expect.arrayContaining(lineCells(0)));
    while (sim.phase === 'szlif' && !sim.telegraph) {
      expect(view.regrow.held).toBe(true);           // the new gaps stay unseen: nothing to plan in the rest
      step();
    }
    expect(sim.telegraph?.to).toBe('wzrost');
    expect(view.regrow.held).toBe(false);
    for (let i = 0; i < 30; i++) step();             // the regrowth takes 0.9 s (a frame advances the picture 0.05 s at most)
    expect(view.regrow.t).toBe(1);
    game.destroy();
  });

  it('reduced motion: a "nie pasuje" flashes the slot’s edge instead of shaking the crystal', () => {
    const trayFrames = (still: boolean) => {
      const canvas = document.createElement('canvas'), log: unknown[][] = [];
      drawLogs.set(canvas, log);
      const { game, sim, layout } = returning(390, 844, 2, { canvas, reducedMotion: still });
      const quiet = frame({ reliable: false, activity: null });
      let t = 2.4;
      for (let i = 0; i < 40; i++) {
        game.update(1 / 30, quiet, (t += 1 / 30));   // the refill's pop settles
        game.draw();
      }
      sim.wall = new Wall();
      sim.wall.cells[0] = { k: EMPTY, gem: 0, clarity: 1, piece: 0 };
      sim.tray[sim.fed] = crystal(SHAPES.findIndex(sh => sh.id === 'I5'), 5);
      const x = layout.wall.x + layout.cell * 4.5, y = layout.wall.y + layout.cell * 4.5;
      game.pointer({ type: 'down', x, y, id: 9 });
      game.pointer({ type: 'up', x, y, id: 9 });
      game.update(1 / 60, quiet, (t += 1 / 60));
      const frames: number[][] = [];
      for (let k = 0; k < 2; k++) {
        log.length = 0;
        game.draw();
        frames.push(log.filter(a => (a[2] as number) >= layout.slots[0].y - 4).map(a => a[1] as number));
        game.update(1 / 60, quiet, (t += 1 / 60));
      }
      drawLogs.delete(canvas);
      game.destroy();
      return frames;
    };
    const [a, b] = trayFrames(true);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);                            // still: the crystal stays put
    const [c, d] = trayFrames(false);
    expect(d).not.toEqual(c);                        // the shake, where motion is welcome
  });

  it('tells a new player the daily geode starts with the second session, states the new-mineral rule, lists records per length', () => {
    const p = geoda.freshProgress();
    const panel = () => geoda.progressPanel(p, () => { throw new Error('the panel changes nothing'); });
    const daily = () => panel().querySelector('.arcade-daily p')!.textContent!;
    const notes = () => [...panel().querySelectorAll('p.muted')].map(e => e.textContent!);
    expect(daily()).toMatch(/^Od drugiej sesji/);
    expect(panel().querySelector('.arcade-daily .badge')!.textContent).toBe('0/1');
    p.sessions = 1;
    expect(daily()).toMatch(/następna sesja zagra dzisiejszą/);
    p.dailyDay = dayKey();
    p.dailyBest = 120;
    expect(daily()).toBe('Zagrana: 120 ct. Jutro nowa ściana.');
    expect(notes().some(t => t.includes(`w pierwszych ${NEW_FIRST} geodach zawsze nowy`))).toBe(true);
    p.best = { 180: 50 };
    expect(notes().some(t => t.startsWith('Rekordy'))).toBe(false);   // one length: "Rekord" says it all
    p.best = { 180: 50, 300: 70, 40: 3 };
    expect(notes()).toContain('Rekordy: 3 min: 50 ct · 5 min: 70 ct');
  });

  it('draws the lobby picture and the card art without the player’s progress, and builds the panel', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    expect(() => geoda.preview(ctx, 260, 230, 3.2)).not.toThrow();
    const p = geoda.freshProgress();
    p.gablota[3] = 2;
    p.star = { m: 3, tier: 2, cm: 6.1 };
    expect(() => geoda.preview(ctx, 600, 440, 1.5, p)).not.toThrow();
    const panel = geoda.progressPanel(p, () => { throw new Error('the panel changes nothing'); });
    expect(panel.querySelectorAll('.arcade-album > div').length).toBe(9);
    expect(panel.querySelectorAll('.arcade-album > div.on').length).toBe(2);
    expect(panel.querySelector('.arcade-album > div.epic')).not.toBeNull();
    expect(panel.querySelector('.arcade-daily')).not.toBeNull();
    expect(panel.querySelector('.arcade-meter i i')).not.toBeNull();
  });
});

// ── the languages ───────────────────────────────────────────────

describe('Geoda in four languages', () => {
  it('has every text in Polish, English, German and Swedish, with the same placeholders and the plural forms each needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('translates every text: only names and number templates read the same in all four, and no Polish letter is left in the others', () => {
    const same = new Set<GeodaKey>(['meter.clarity', 'finale.size', 'panel.tile', 'panel.oddsItem', 'mineral.opal']);
    const texts = (m: unknown) => (typeof m === 'string' ? [m] : Object.values(m as Plural).filter((v): v is string => typeof v === 'string'));
    for (const key of Object.keys(CATALOGS.pl) as GeodaKey[]) {
      const pl = JSON.stringify(CATALOGS.pl[key]);
      const differs = (['en', 'de', 'sv'] as const).some(l => JSON.stringify(CATALOGS[l][key]) !== pl);
      expect(differs || same.has(key), key).toBe(true);
      for (const l of ['en', 'de', 'sv'] as const) {
        for (const s of texts(CATALOGS[l][key])) expect(s, `${l}.${key}`).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
      }
    }
  });

  it('keeps the canvas’s one-line texts short enough for a 390 px phone, and the cabinet tile’s notes within its 10 mono characters', () => {
    // Manrope's advance widths, roughly (em), as in "Geoda on screen"; the hint line shrinks its type from 13.5 px to 10.5 px
    const em = (ch: string) => (ch === ' ' ? 0.26 : ch !== ch.toLowerCase() ? 0.64 : 0.47);
    const width = (text: string, px: number) => [...text].reduce((s, ch) => s + em(ch) * px, 0);
    const room = computeLayout(390, 844).hint.w;
    const hints: GeodaKey[] = ['hint.blind', 'hint.jam', 'hint.drag', 'hint.drip', 'hint.closeGap', 'hint.lines', 'hint.feed', 'hint.clarity', 'hint.daily', 'hint.full',
      'strategy.count', 'strategy.plan', 'strategy.picture', 'strategy.route', 'strategy.stones'];
    for (const l of LANGS) {
      const c = CATALOGS[l] as Record<GeodaKey, string>;
      for (const k of hints) expect(width(c[k], 11.5), `${l}.${k}`).toBeLessThanOrEqual(room);
      for (const k of ['panel.calib', 'panel.museumShort', 'tier.common', 'tier.fine', 'tier.rare'] as const) expect(c[k].length, `${l}.${k}`).toBeLessThanOrEqual(10);
    }
  });

  it('bends the counts in Polish (tests run in Polish) and builds the words from the catalog', () => {
    expect([1, 2, 5, 12, 22].map(n => t('hint.toFull', { n }))).toEqual([
      'Jeszcze 1 komórka do pełnej geody.', 'Jeszcze 2 komórki do pełnej geody.', 'Jeszcze 5 komórek do pełnej geody.',
      'Jeszcze 12 komórek do pełnej geody.', 'Jeszcze 22 komórki do pełnej geody.',
    ]);
    expect(t('hl.finest', { n: 4, clarity: CLARITY[3] })).toBe('Najczystszy kryształ: 4 komórki, lśniący');
    expect(t('finale.extra', { n: 1 })).toBe('+1 okaz z pełnej geody');
    expect(MINERALS.map(m => m.title)).toEqual(['Ametyst', 'Cytryn', 'Kwarc różowy', 'Akwamaryn', 'Malachit', 'Fluoryt', 'Agat', 'Turmalin', 'Opal']);
    expect(TIERS).toEqual(['zwykły', 'piękny', 'rzadki', 'muzealny']);
    expect(CLARITY.slice(1)).toEqual(['mleczny', 'czysty', 'lśniący']);
    expect(STRATEGIES[0]).toBe('Licz w myślach wstecz od 100 co 7.');
  });
});
