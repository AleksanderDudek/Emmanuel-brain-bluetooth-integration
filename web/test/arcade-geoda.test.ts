import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { mergeSaved } from '../src/arcade/kit/progress';
import type { GameEnv } from '../src/arcade/kit/types';
import geoda, { howto } from '../src/arcade/geoda/index';
import { GEODE_REACH } from '../src/arcade/geoda/art';
import { GeodaView } from '../src/arcade/geoda/render';
import { Board, bestSpot, chamberBoard, deal, EMPTY, idx, N, placeable, ROCK, tapSpot } from '../src/arcade/geoda/board';
import { LINES, MINERALS, MOMENTS, orientations, PIECES, pieceById, TIPS } from '../src/arcade/geoda/content';
import { CATALOGS, t } from '../src/arcade/geoda/i18n';
import { boardAt, computeLayout, slotAt, tapTargets } from '../src/arcade/geoda/layout';
import { bestOf, chamber, freshProgress, migrate, nextMineral, shelve, starsFor, type GeodaProgress } from '../src/arcade/geoda/meta';
import { comboFactor, linePoints, multOf, RULES } from '../src/arcade/geoda/rules';
import { GeodaSim, planBlocks, type GeodaEvent } from '../src/arcade/geoda/sim';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, LANGS } from '../src/i18n';

// ── helpers ─────────────────────────────────────────────────────

const TUNING = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });
const focusing = (): FocusFrame => frame({ activity: 12, level: 0.95, focused: true, hold: 10, calm: 0.05 });
const resting = (): FocusFrame => frame({ activity: -3, level: 0.08, focused: false, hold: 0, calm: 0.92 });
const lost = (): FocusFrame => frame({ reliable: false, activity: null, level: 0, calm: 0 });

const returning = (o: Partial<GeodaProgress> = {}): GeodaProgress => ({ ...freshProgress(), sessions: 4, pushes: 1, ...o });

function newSim(o: { progress?: GeodaProgress; plannedSec?: number; seed?: number; eeg?: boolean } = {}): GeodaSim {
  return new GeodaSim({ progress: o.progress ?? freshProgress(), rng: mulberry32(o.seed ?? 3), plannedSec: o.plannedSec ?? 180, eeg: !!o.eeg, tuning: TUNING });
}

/** Run the sim for `sec` from `t0` with frames from `f(t)`, collecting its events. */
function run(sim: GeodaSim, sec: number, f: (t: number) => FocusFrame, t0 = 0, dt = 0.05): GeodaEvent[] {
  const out: GeodaEvent[] = [];
  for (let t = t0; t < t0 + sec - 1e-9; t += dt) {
    sim.update(dt, f(t), t + dt);
    out.push(...sim.take());
  }
  return out;
}

function boardFrom(rows: string[]): Board {
  const b = new Board();
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') b.cells[idx(x, y)] = 1; if (c === 'R') b.cells[idx(x, y)] = ROCK; }));
  return b;
}

// ── pieces and the board ────────────────────────────────────────

describe('Geoda pieces (Block Blast set, no rotation)', () => {
  it('has every orientation as its own piece, with sizes and positive weights', () => {
    const ids = new Set(PIECES.map(p => p.id));
    expect(ids.size).toBe(PIECES.length);
    for (const id of ['dot', 'i2.0', 'i2.1', 'i5.0', 'i5.1', 'o2', 'o3', 'r23.0', 'r23.1', 'l3.0', 'l3.3', 'l4.7', 'l5.3', 't4.3', 's4.3']) expect(ids.has(id)).toBe(true);
    for (const p of PIECES) {
      expect(p.weight).toBeGreaterThan(0);
      expect(p.w).toBe(Math.max(...p.cells.map(c => c[0])) + 1);
      expect(p.h).toBe(Math.max(...p.cells.map(c => c[1])) + 1);
      expect(Math.min(...p.cells.map(c => c[0]))).toBe(0);
      expect(Math.min(...p.cells.map(c => c[1]))).toBe(0);
    }
    expect(orientations([[0, 0], [0, 1], [0, 2], [1, 2]], true)).toHaveLength(8);
    expect(pieceById('o3').cells).toHaveLength(9);
  });

  it('places only on empty cells inside the board', () => {
    const b = new Board();
    const o3 = pieceById('o3');
    expect(b.fits(o3, 0, 0)).toBe(true);
    expect(b.fits(o3, 6, 0)).toBe(false);
    b.place(o3, 0, 0, 2);
    expect(b.fits(pieceById('dot'), 2, 2)).toBe(false);
    expect(b.fits(pieceById('dot'), 3, 2)).toBe(true);
    expect(b.filled).toBe(9);
  });

  it('clears full rows and columns at once, and an empty board is clean', () => {
    const b = boardFrom([
      '####### ',
      '       #',
      '       #',
      '       #',
      '       #',
      '       #',
      '       #',
      '       #',
    ]);
    const r = b.place(pieceById('dot'), 7, 0, 3);
    expect(r.rows).toEqual([0]);
    expect(r.cols).toEqual([7]);
    expect(r.cleared).toHaveLength(15);
    expect(r.clean).toBe(true);
    expect(b.filled).toBe(0);
    expect(b.seeds).toBe(15);   // the cleared cells are seeded for druses
  });

  it('keeps the jewels of filled cells, collects them in a clear, and harvests druses under a piece', () => {
    const b = new Board();
    b.place(pieceById('i4.0'), 0, 0, 1, 2, 1);
    expect(b.jewel[idx(1, 0)]).toBe(2);
    const r = b.place(pieceById('i4.0'), 4, 0, 1);
    expect(r.cleared.filter(c => c.jewel === 2)).toHaveLength(1);
    expect(b.grow(0.5)).toBeCloseTo(8 * 0.5, 5);
    const h = b.place(pieceById('i2.0'), 0, 0, 1);
    expect(h.druse).toBeCloseTo(1, 5);
    expect(h.druseCells).toHaveLength(2);
    expect(b.druse[idx(0, 0)]).toBe(0);
  });

  it('the auto-place prefers a clear, and a tap lands at the tapped cell or as near as it fits', () => {
    const b = boardFrom(['######  ', '', '', '', '', '', '', ''].map(r => r.padEnd(8, ' ')));
    expect(bestSpot(b, pieceById('i2.0'))).toEqual([6, 0]);
    expect(tapSpot(b, pieceById('dot'), 4, 4)).toEqual([4, 4]);
    expect(tapSpot(b, pieceById('i2.0'), 3, 0)).not.toBeNull();
    const full = boardFrom(Array(8).fill('########'));
    expect(bestSpot(full, pieceById('dot'))).toBeNull();
  });

  it('deals three pieces that can all be placed when the board allows it', () => {
    const rng = mulberry32(11);
    for (let k = 0; k < 40; k++) {
      const b = chamberBoard(rng, 20, [1], 4);
      const items = deal(b, rng, { gentle: false, jewels: [], jewelChance: 0 });
      expect(items).toHaveLength(3);
      expect(placeable(b, items.map(i => i.piece))).toBe(3);
      for (const it of items) expect(it.tile).toBeGreaterThanOrEqual(1);
    }
  });

  it('leans gentle (small pieces) in a rest block', () => {
    const rng = mulberry32(5);
    let small = { gentle: 0, plain: 0 };
    for (let k = 0; k < 300; k++) {
      const b = new Board();
      for (const g of [true, false]) {
        const items = deal(b, rng, { gentle: g, jewels: [], jewelChance: 0 });
        small[g ? 'gentle' : 'plain'] += items.filter(i => i.piece.cells.length <= 3).length;
      }
    }
    expect(small.gentle).toBeGreaterThan(small.plain * 1.2);
    small = { gentle: 0, plain: 0 };
  });

  it('a chamber board has its rock and jewels and no full line', () => {
    const b = chamberBoard(mulberry32(2), 18, [1, 2], 6);
    let rock = 0;
    for (let i = 0; i < N * N; i++) if (b.cells[i] === ROCK) rock++;
    expect(rock).toBeGreaterThan(10);
    expect(b.jewels()[1] + b.jewels()[2]).toBe(6);
    for (let y = 0; y < N; y++) expect([...Array(N).keys()].every(x => b.cells[idx(x, y)] !== EMPTY)).toBe(false);
  });
});

// ── scoring rules ───────────────────────────────────────────────

describe('Geoda scoring', () => {
  it('pays lines with a multi-line bonus, a combo factor and the shine’s steps', () => {
    expect([1, 2, 3, 4].map(linePoints)).toEqual([10, 30, 60, 100]);
    expect(comboFactor(1)).toBe(1);
    expect(comboFactor(3)).toBe(2);
    expect(multOf(0)).toBe(1);
    expect(multOf(0.3)).toBe(2);
    expect(multOf(0.5)).toBe(3);    // the threshold is where ×3 begins
    expect(multOf(0.7)).toBe(4);
    expect(multOf(1)).toBe(5);
  });
});

// ── blocks ──────────────────────────────────────────────────────

describe('Geoda blocks', () => {
  it('fill the planned time, open with a warm-up only the first time, alternate push and rest', () => {
    for (const sec of [10, 40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(sec));
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec, 5);
        expect(plan[0].kind === 'warmup').toBe(first);
        const core = plan.filter(b => b.kind !== 'warmup');
        core.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(core.at(-1)!.kind).toBe('rest');
        if (sec >= 120) for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      }
    }
  });

  it('tells the runner the block, its seconds left and the next one in the telegraph', () => {
    const sim = newSim({ progress: returning() });
    sim.start();
    run(sim, 2, () => focusing());
    expect(sim.pushBlock).toBe(true);
    expect(sim.left).toBeCloseTo(sim.plan[0].dur - 2, 1);
    const ev = run(sim, sim.plan[0].dur - 2, () => focusing(), 2);
    expect(ev.some(e => e.type === 'telegraph')).toBe(true);
    expect(sim.restBlock).toBe(true);
  });

  it('makes every 4th push blind from the 3rd session', () => {
    const sim = newSim({ progress: returning({ sessions: 4, pushes: 2 }), plannedSec: 600 });
    sim.start();
    run(sim, 600, () => focusing());
    const blind = sim.plan.filter(b => b.kind === 'push' && b.blind);
    expect(blind.length).toBeGreaterThanOrEqual(1);
    expect(sim.plan.find(b => b.kind === 'push')!.blind).toBe(false);   // never the first push of a session
    const early = newSim({ progress: returning({ sessions: 1, pushes: 2 }), plannedSec: 600 });
    early.start();
    run(early, 600, () => focusing());
    expect(early.plan.some(b => b.blind)).toBe(false);
  });
});

// ── the band ────────────────────────────────────────────────────

describe('Geoda and the band', () => {
  it('the dial waits out the lead-in, then follows the focus: ×3 and more above the threshold', () => {
    const sim = newSim({ progress: returning() });
    sim.start();
    run(sim, RULES.leadIn.fnirs - 0.5, () => focusing());
    expect(sim.mult).toBe(1);
    expect(sim.meter()).toBeNull();
    run(sim, 6, () => focusing(), RULES.leadIn.fnirs);
    expect(sim.mult).toBeGreaterThanOrEqual(4);
    expect(sim.meter()!).toBeGreaterThan(0.8);
    expect(sim.padLevel(focusing())).toBeCloseTo(0.95, 5);
  });

  it('without focus the dial stays low, and a lost signal freezes it (never a loss, never shown low)', () => {
    const sim = newSim({ progress: returning() });
    sim.start();
    run(sim, 12, () => focusing());
    const m = sim.mult, d = sim.dial;
    run(sim, 3, () => lost(), 12);
    expect(sim.mult).toBe(m);
    expect(sim.dial).toBeCloseTo(d, 5);
    expect(sim.meter()).toBeNull();
    const calm = newSim({ progress: returning() });
    calm.start();
    run(calm, 15, () => resting());
    expect(calm.mult).toBe(1);
  });

  it('a clear in a focused push pays × the shine; druses grow on cleared cells and pay when covered', () => {
    const sim = newSim({ progress: returning({ mode: 'classic' }) });
    sim.start();
    run(sim, 10, () => focusing());
    expect(sim.mult).toBeGreaterThanOrEqual(4);
    // a row with one gap and the dot for it
    sim.board.clear();
    for (let x = 0; x < 7; x++) sim.board.cells[idx(x, 7)] = 1;
    sim.board.cells[idx(3, 2)] = 1;   // not a clean board
    sim.tray = [{ piece: pieceById('dot'), tile: 1, jewel: 0, jewelAt: -1 }, { piece: pieceById('dot'), tile: 2, jewel: 0, jewelAt: -1 }, null];
    const before = sim.score;
    sim.place(0, 7, 7);
    const ev = sim.take().find(e => e.type === 'place')!;
    expect(ev.type === 'place' && ev.lines).toBe(1);
    expect(sim.score - before).toBe(1 + 10 * sim.mult);
    run(sim, 5, () => focusing(), 10);
    expect(sim.board.druse[idx(0, 7)]).toBeGreaterThan(0.2);
    const s0 = sim.score;
    sim.place(1, 0, 7);
    const ev2 = sim.take().find(e => e.type === 'place')!;
    expect(ev2.type === 'place' && ev2.druse).toBeGreaterThan(0);
    expect(sim.score - s0).toBeGreaterThan(1);
  });

  it('keeps a combo while a clear comes within three placements, and pays a clean board', () => {
    const sim = newSim({ progress: returning({ mode: 'classic' }) });
    sim.start();
    sim.board.clear();
    const dot = { piece: pieceById('dot'), tile: 1, jewel: 0, jewelAt: -1 };
    for (let x = 0; x < 7; x++) sim.board.cells[idx(x, 0)] = 1;
    sim.tray = [dot, dot, dot];
    sim.place(0, 7, 0);
    expect(sim.combo).toBe(1);
    expect(sim.take().some(e => e.type === 'place' && e.clean)).toBe(true);
    expect(sim.cleans).toBe(1);
    sim.place(1, 0, 3);
    sim.place(2, 0, 5);
    expect(sim.combo).toBe(1);
    sim.tray = [dot, dot, dot];
    sim.place(0, 5, 5);
    expect(sim.combo).toBe(0);
    expect(sim.take().some(e => e.type === 'comboBreak')).toBe(true);
  });

  it('a rest polishes the round’s gem with calm and puts it in the cabinet, a tier up', () => {
    const sim = newSim({ progress: returning() });
    sim.start();
    const push = sim.plan[0].dur;
    run(sim, push, () => focusing());
    expect(sim.restBlock).toBe(true);
    expect(sim.bowl).not.toBeNull();
    const ev = run(sim, sim.plan[1].dur, () => resting(), push);
    const gem = ev.find(e => e.type === 'gem');
    expect(gem && gem.type === 'gem' && gem.polished).toBe(true);
    expect(gem && gem.type === 'gem' && gem.tier).toBeGreaterThanOrEqual(1);
    expect(sim.p.cabinet.filter(v => v !== null)).toHaveLength(1);
  });

  it('a rest without signal still gives the gem (no lift, no loss)', () => {
    const sim = newSim({ progress: returning() });
    sim.start();
    const push = sim.plan[0].dur;
    run(sim, push, () => focusing());
    const ev = run(sim, sim.plan[1].dur, () => lost(), push);
    const gem = ev.find(e => e.type === 'gem');
    expect(gem && gem.type === 'gem' && gem.polished).toBe(false);
    expect(sim.p.cabinet.filter(v => v !== null)).toHaveLength(1);
  });

  it('a blind push hides the dial and pays its sack at the end × the judged share', () => {
    const sim = newSim({ progress: returning({ sessions: 4, pushes: 3 }), plannedSec: 600 });
    sim.start();
    // the first push is never blind; the second (pushes 3 + 2 = 5) is not; find the blind one
    let t = 0;
    let revealed = false;
    for (let i = 0; i < sim.plan.length; i++) {
      const b = sim.plan[i];
      if (b.kind === 'push' && sim.blockIndex === i && b.blind) {
        expect(sim.meter()).toBeNull();
        sim.board.clear();
        for (let x = 0; x < 7; x++) sim.board.cells[idx(x, 0)] = 1;
        sim.tray = [{ piece: pieceById('dot'), tile: 1, jewel: 0, jewelAt: -1 }, null, null];
        sim.place(0, 7, 0);
        expect(sim.sack).toBeGreaterThan(0);
      }
      const ev = run(sim, b.dur, () => focusing(), t);
      t += b.dur;
      if (ev.some(e => e.type === 'reveal' && e.points > 0)) revealed = true;
    }
    expect(sim.plan.some(b => b.blind)).toBe(true);
    expect(revealed).toBe(true);
  });
});

// ── the modes ───────────────────────────────────────────────────

describe('Geoda modes', () => {
  it('turns the geode when nothing fits: the board’s tally, a fresh board, the score kept', () => {
    const sim = newSim({ progress: returning({ mode: 'classic', bestBoard: 500 }) });
    sim.start();
    sim.board.clear();
    // a checkerboard of holes: only dots fit
    for (let i = 0; i < N * N; i++) sim.board.cells[i] = (i + Math.floor(i / N)) % 2 ? 1 : 0;
    sim.board.cells[idx(0, 0)] = 1;
    const o3 = { piece: pieceById('o3'), tile: 1, jewel: 0, jewelAt: -1 };
    sim.tray = [{ piece: pieceById('dot'), tile: 1, jewel: 0, jewelAt: -1 }, o3, o3];
    sim.boardPts = 120;
    sim.score = 120;
    sim.place(0, 2, 0);
    const ev = sim.take();
    const turn = ev.find(e => e.type === 'turn');
    expect(turn && turn.type === 'turn' && turn.toRecord).toBe(500 - 121);
    expect(sim.story?.kind).toBe('turn');
    expect(sim.board.filled).toBe(0);
    expect(sim.score).toBe(121);
    expect(sim.tray.every(x => x !== null)).toBe(true);
  });

  it('the Wyprawa: jewels toward the chamber’s goal, then stars and the next chamber', () => {
    const sim = newSim({ progress: returning({ mode: 'adventure', level: 0 }) });
    sim.start();
    expect(sim.mode).toBe('adventure');
    const [kind, need] = sim.spec.goal[0];
    sim.got[0] = need - 1;
    sim.board.clear();
    for (let x = 0; x < 7; x++) sim.board.cells[idx(x, 0)] = 1;
    sim.board.jewel[idx(3, 0)] = kind;
    sim.tray = [{ piece: pieceById('dot'), tile: 1, jewel: 0, jewelAt: -1 }, null, null];
    sim.levelPts = 1000;
    sim.place(0, 7, 0);
    const ev = sim.take();
    expect(ev.some(e => e.type === 'jewel' && e.got === need)).toBe(true);
    const lv = ev.find(e => e.type === 'level');
    expect(lv && lv.type === 'level' && lv.stars).toBe(3);
    expect(sim.p.level).toBe(1);
    expect(sim.p.stars[0]).toBe(3);
    expect(sim.spec.level).toBe(1);
    expect(sim.story?.kind).toBe('level');
  });

  it('chambers grow harder and stars follow points', () => {
    const a = chamber(0), b = chamber(8);
    expect(b.rock).toBeGreaterThan(a.rock);
    expect(b.goal.reduce((s, g) => s + g[1], 0)).toBeGreaterThan(a.goal.reduce((s, g) => s + g[1], 0));
    expect(b.goal.length).toBe(3);
    expect(starsFor(a, 0)).toBe(1);
    expect(starsFor(a, a.stars[0])).toBe(2);
    expect(starsFor(a, a.stars[1])).toBe(3);
  });

  it('the first-ever session plays the Wyprawa with an opening card a tap closes', () => {
    const sim = newSim();
    sim.start();
    expect(sim.mode).toBe('adventure');
    expect(sim.story?.kind).toBe('open');
    expect(sim.plan[0].kind).toBe('warmup');
    expect(sim.tapAt(4, 4)).toBe(true);
    expect(sim.story).toBeNull();
    expect(sim.tapAt(4, 4)).toBe(true);
    expect(sim.score).toBeGreaterThan(0);
  });
});

// ── the meta ────────────────────────────────────────────────────

describe('Geoda progress', () => {
  it('migrates a realistic version-1 save: the best and the session count stay, the rest starts over', () => {
    const old = {
      v: 1, sessions: 7, xp: 420, best: { 180: 212, 300: 340, 600: 'x' }, longestCont: 31, biggest: 14.2,
      gablota: [0, 2, null, 1, null, null, null, null, null], dust: 18, pity: [0, 2, 4, 9], cracks: 6, dailyDay: '2026-10-20',
      dailyBest: 120, fullGeodes: 1, lines: 77, star: { m: 1, tier: 2, cm: 12 },
    };
    const p = mergeSaved(freshProgress(), JSON.parse(JSON.stringify(old)));
    expect(bestOf(p)).toBe(340);
    migrate(p);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.best).toBe(340);
    expect(p.cabinet).toEqual(MINERALS.map(() => null));
    expect(p.level).toBe(0);
    expect((p as unknown as Record<string, unknown>).gablota).toBeUndefined();
    expect(migrate(p)).toEqual(p);
    // a game runs on it
    const sim = new GeodaSim({ progress: p, rng: mulberry32(1), plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    run(sim, 60, () => focusing());
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
  });

  it('survives a version-2 save with fields of the wrong type', () => {
    const p = mergeSaved(freshProgress(), { ver: 2, sessions: '3', stars: 'x', cabinet: [1], mode: 'arcade', seen: null, best: 50 });
    migrate(p);
    expect(p.sessions).toBe(0);
    expect(p.stars).toEqual([]);
    expect(p.cabinet).toHaveLength(MINERALS.length);
    expect(p.mode).toBe('adventure');
    expect(p.best).toBe(50);
  });

  it('the cabinet fills with missing minerals first, then lifts tiers', () => {
    const p = freshProgress();
    const rng = mulberry32(4);
    for (let i = 0; i < MINERALS.length; i++) expect(shelve(p, nextMineral(p, rng), 0)).toBe('new');
    expect(p.cabinet.every(v => v === 0)).toBe(true);
    expect(shelve(p, 3, 2)).toBe('up');
    expect(shelve(p, 3, 1)).toBe('same');
  });

  it('result() is idempotent: records by Math.max, counters move only during play', () => {
    const sim = newSim({ progress: returning({ best: 10 }) });
    sim.start();
    run(sim, 30, t => (t < 24 ? focusing() : resting()));
    for (let k = 0; k < 6; k++) sim.auto();
    const p = sim.p;
    const a = sim.result();
    const snap = JSON.stringify(p);
    const b = sim.result();
    expect(b).toEqual(a);
    expect(JSON.stringify(p)).toBe(snap);
    expect(p.best).toBe(Math.max(10, sim.score));
    sim.finish();
    sim.finish();
    expect(sim.ended).toBe(true);
  });
});

// ── the words ───────────────────────────────────────────────────

describe('Geoda words', () => {
  it('has complete catalogs in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Bazyl at least three lines per moment, each under 90 characters, in every language', () => {
    for (const m of MOMENTS) expect(LINES[m].length).toBeGreaterThanOrEqual(3);
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.')) expect((v as string).length, `${l} ${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('never asks to try harder in a strategy', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!k.startsWith('task.') && !k.startsWith('how.')) continue;
        expect(String(v)).not.toMatch(/mocniej|harder|stärker|hårdare/i);
      }
    }
    expect(TIPS.push.length).toBeGreaterThanOrEqual(4);
    expect(t('sub.combo', { n: 3 })).toContain('3');
  });
});

// ── the game (the arcade contract) ──────────────────────────────

function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: s.length * 7 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 1 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
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

  const hints: string[] = [];
  const envFor = (progress: GeodaProgress, plannedSec: number, seed = 1, top = 120): GameEnv<GeodaProgress> => ({
    canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
    progress, rng: mulberry32(seed), day: '2026-11-07', daySeed: 99, plannedSec, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
    tuning: TUNING, hint: (text: string) => { if (text) hints.push(text); }, hudTop: () => top,
    insets: () => ({ top, right: 0, bottom: 0, left: 0 }), touch: false,
  });

  /** The smoke test's input on the runner's clock: a click at 50 % × 60 % every 0.65 s, Space every ~2 s, focus on. */
  function smoke(w: number, h: number, sec = 40, until = 22, progress = geoda.freshProgress(), top = 120) {
    const game = geoda.create(envFor(progress, sec, 1, top));
    game.resize(w, h, 1);
    for (let i = 0; i < 20; i++) { game.intro(1 / 30, i / 20); game.draw(); }
    game.start();
    const focus = new FocusInput(BEGINNER);
    const rnd = mulberry32(5);
    let t = 0, tap = 0, space = 0, scoreAt: number | null = null, headlineGrew = false, last = 0;
    const dt = 1 / 30;
    while (t < until) {
      const f = focus.push(20 * (1 - Math.exp(-t / 4)) + (rnd() - 0.5) * 2, true, dt);
      game.update(dt, f, t);
      game.draw();
      tap += dt;
      space += dt;
      if (tap >= 0.65) {
        tap = 0;
        game.pointer!({ type: 'down', x: w / 2, y: h * 0.6, id: 1 });
        game.pointer!({ type: 'up', x: w / 2, y: h * 0.6, id: 1 });
      }
      if (space >= 1.95) {
        space = 0;
        game.key!(' ', true);
        game.key!(' ', false);
      }
      const hv = game.headline!().value;
      if (hv > last) headlineGrew = true;
      last = hv;
      if (scoreAt === null && game.result().score > 0) scoreAt = t;
      t += dt;
    }
    return { game, scoreAt, headlineGrew };
  }

  it('the smoke input scores within 22 s on desktop, phone and phone landscape, and the headline accrues', () => {
    for (const [w, h, top] of [[1440, 760, 130], [1280, 618, 130], [390, 640, 120], [844, 336, 120]] as const) {
      const lay = computeLayout(w, h, top);
      expect(boardAt(lay, w / 2, h * 0.6), `${w}×${h}`).not.toBeNull();
      const { scoreAt, headlineGrew } = smoke(w, h, 40, 22, geoda.freshProgress(), top);
      expect(scoreAt, `${w}×${h}`).not.toBeNull();
      expect(scoreAt!).toBeLessThan(22);
      expect(headlineGrew).toBe(true);
    }
  });

  it('teaches with coach marks in the first session', () => {
    hints.length = 0;
    smoke(1280, 618, 40, 30);
    expect(hints.length).toBeGreaterThanOrEqual(2);
  });

  it('a drag from the tray places the piece where it is dropped', () => {
    const p = returning({ mode: 'classic' });
    const game = geoda.create(envFor(p, 180));
    game.resize(1280, 618, 1);
    game.start();
    game.update(1 / 30, frame(), 0.1);
    const lay = computeLayout(1280, 618, 120);
    const s = lay.slots[0];
    const before = game.headline!().value;
    game.pointer!({ type: 'down', x: s.x + s.w / 2, y: s.y + s.h / 2, id: 1 });
    // drag up onto the board's middle
    const bx = lay.board.x + lay.board.w / 2, by = lay.board.y + lay.board.h / 2;
    for (let k = 1; k <= 10; k++) game.pointer!({ type: 'move', x: s.x + s.w / 2 + (bx - s.x - s.w / 2) * k / 10, y: s.y + s.h / 2 + (by - s.y - s.h / 2) * k / 10, id: 1 });
    game.pointer!({ type: 'up', x: bx, y: by, id: 1 });
    expect(game.headline!().value).toBeGreaterThan(before);
    expect(slotAt(lay, s.x + 2, s.y + 2)).toBe(0);
  });

  it('plays a whole 40 s session, settles, and result() is idempotent', () => {
    const { game } = smoke(1280, 618, 40, 41);
    game.finish?.();
    const a = game.result(), b = game.result();
    expect(b).toEqual(a);
    expect(a.score).toBeGreaterThan(0);
    expect(a.unit).toBe('ct');
    expect(a.verse).toBeTruthy();
    expect(game.canStop()).toBe(true);
    expect(game.signal!().want).toBe('free');
  });

  it('feeds the standard HUD: the signal with seconds left, the meter, the headline and how to play', () => {
    const p = returning();
    const game = geoda.create(envFor(p, 180));
    game.resize(1280, 618, 1);
    game.start();
    let t = 0;
    for (; t < 12; t += 1 / 30) game.update(1 / 30, focusing(), t);
    const s = game.signal!();
    expect(s.want).toBe('focus');
    expect(s.task).toBeTruthy();
    expect(s.left!).toBeGreaterThan(0);
    expect(game.meter!()!).toBeGreaterThan(0.5);
    expect(game.headline!().sub).toBeTruthy();
    const how = geoda.howto!();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
  });
});

// ── mobile first ─────────────────────────────────────────────────

/** A fake 2D context that measures text by its size (0.55 em a character) and records every word drawn with its px. */
function recordingContext(canvas: HTMLCanvasElement, said: { text: string; px: number }[]): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif' };
  const px = () => Number(String(state.font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: s.length * px() * 0.55 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: string) => { if (String(s).trim()) said.push({ text: String(s), px: px() }); };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 1 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Geoda mobile first (DESIGN §3.1, §12)', () => {
  const said: { text: string; px: number }[] = [];
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return recordingContext(this, said); }; });
  afterAll(() => { proto.getContext = original; });

  const envAt = (progress: GeodaProgress, c: (typeof CHECK_SIZES)[number], touch: boolean): GameEnv<GeodaProgress> => ({
    canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
    progress, rng: mulberry32(7), day: '2026-11-12', daySeed: 99, plannedSec: 60, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
    tuning: TUNING, hint: () => undefined, hudTop: () => c.insets.top, insets: () => c.insets, touch,
  });
  // each word at its largest, as the mobile audit counts it (a word that pops in grows to its size)
  const largest = (xs: typeof said) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x.text, Math.max(m.get(x.text) ?? 0, x.px));
    return [...m].map(([text, px]) => ({ text, px }));
  };

  it('gives the tray\'s pieces finger-sized targets inside the insets and apart at every checked size; under a story, the card', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = computeLayout(c.w, c.h, c.insets, touch);
        const what = `${c.name}${touch ? ' (touch)' : ''}`;
        const full = tapTargets(L, { tray: [1, 1, 1], story: false });
        expect(full.map(x => x.label), what).toEqual(['piece 1', 'piece 2', 'piece 3']);
        expect(auditTargets(full, c.w, c.h, c.insets), what).toEqual([]);
        expect(tapTargets(L, { tray: [null, 1, null], story: false }).map(x => x.label)).toEqual(['piece 2']);
        expect(auditTargets(tapTargets(L, { tray: [1, 1, 1], story: true }), c.w, c.h, c.insets), `${what}: a story`).toEqual([]);
        // the board never under the HUD; the canvas's last pixel row stays free (a touch on the dock arrives there)
        expect(L.board.y, what).toBeGreaterThanOrEqual(c.insets.top);
        for (const s of L.slots) expect(s.y + s.h, what).toBeLessThan(c.h - c.insets.bottom - 1);
        // the smoke's tap at 50 % × 60 % lands on the board
        if (c.w > 1000) expect(boardAt(L, c.w / 2, c.h * 0.6), what).not.toBeNull();
      }
    }
  });

  it('puts the tray under the thumb of a phone upright, the board right above it, as big as the band allows', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = computeLayout(c.w, c.h, c.insets, true);
      expect(L.portrait, c.name).toBe(true);
      expect(L.u).toBeLessThan(1.1);
      for (const s of L.slots) {
        expect(s.y, c.name).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
        expect(s.h, c.name).toBeGreaterThanOrEqual(80);
        expect(s.x, c.name).toBeGreaterThanOrEqual(c.insets.left + 16 - 0.01);
        expect(s.x + s.w, c.name).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
        expect(c.h - c.insets.bottom - (s.y + s.h), c.name).toBeLessThanOrEqual(10);
      }
      // the board sits on the tray (a short drag), its rim clear of the HUD
      expect(L.slots[0].y - (L.board.y + L.board.h), c.name).toBeLessThanOrEqual(L.rim * 2.5 + 12);
      expect(L.board.y - L.rim, c.name).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.cell, c.name).toBeGreaterThanOrEqual(28);
    }
    // a small phone puts the shine and the goal in the board's margins; a large one keeps a strip
    const small = CHECK_SIZES[0];
    const S = computeLayout(small.w, small.h, small.insets, true);
    expect(S.mode).toBe('columns');
    expect(S.cell).toBeGreaterThan(26);
    const reach = S.rim * GEODE_REACH;
    expect(S.column.x).toBeGreaterThanOrEqual(4);
    expect(S.column.x + S.column.w).toBeLessThanOrEqual(S.board.x - reach * 0.5 + 1);
    expect(S.goal.x).toBeGreaterThanOrEqual(S.board.x + S.board.w + reach * 0.5 - 1);
    expect(S.goal.x + S.goal.w).toBeLessThanOrEqual(small.w - 4 + 0.01);
    const big = CHECK_SIZES.find(x => x.name.startsWith('large phone'))!;
    expect(computeLayout(big.w, big.h, big.insets, true).mode).toBe('strip');
  });

  it('lays a phone on its side out in three columns, the whole geode on screen, the tray under the right thumb', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = computeLayout(c.w, c.h, c.insets, true);
      expect(L.mode, c.name).toBe('wide');
      expect(L.board.y + L.board.h + L.rim * 2.5, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
      for (const s of L.slots) {
        expect(s.x, c.name).toBeGreaterThan(L.board.x + L.board.w);
        expect(Math.min(s.w, s.h), c.name).toBeGreaterThanOrEqual(MIN_TAP);
      }
      expect(L.dial.x + L.dial.r, c.name).toBeLessThan(L.board.x);
    }
  });

  it('floats a dragged piece clear of the thumb on a phone, a cell above the mouse, and snaps it to the nearest spot where it fits', () => {
    const c = CHECK_SIZES[1];
    for (const touch of [true, false]) {
      const view = new GeodaView(document.createElement('canvas'), { reducedMotion: false, touch });
      view.resize(c.w, c.h, 2, c.insets);
      const L = view.layout;
      const p = pieceById('o2');
      const o = view.dragOrigin(p, 200, 400);
      const gapUnder = 400 - (o.y + p.h * L.cell);
      if (touch) expect(gapUnder).toBeGreaterThanOrEqual(56);
      else expect(gapUnder).toBeCloseTo(L.cell * 1.15, 5);
      expect(o.x + (p.w * L.cell) / 2).toBeCloseTo(200, 5);
    }
    // the snap: a finger that puts the piece half a cell off the free spot still lands it there
    const view = new GeodaView(document.createElement('canvas'), { reducedMotion: false, touch: true });
    view.resize(c.w, c.h, 2, c.insets);
    const L = view.layout;
    const sim = newSim({ progress: returning({ mode: 'classic' }) });
    sim.start();
    sim.board.clear();
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (x > 3 || y > 3) sim.board.cells[idx(x, y)] = 1;
    const p = pieceById('o2');
    // aim the piece's top-left at (1.6, 1.4) cells: the nearest fitting spot is (2, 1)… (1, 1) and (2, 2) fit too
    const fingerAt = (gx: number, gy: number) => ({ x: L.board.x + (gx + p.w / 2) * L.cell, y: L.board.y + gy * L.cell + L.lift + p.h * L.cell });
    const f = fingerAt(1.6, 1.4);
    expect(view.snap(sim, p, f.x, f.y)).toEqual({ gx: 2, gy: 1 });
    // over the filled part, the nearest free spot within reach
    const g = fingerAt(3.2, 2.2);
    const s = view.snap(sim, p, g.x, g.y);
    expect(s).not.toBeNull();
    expect(sim.board.fits(p, s!.gx, s!.gy)).toBe(true);
    // far from any free spot: nothing
    const h = fingerAt(6, 6);
    expect(view.snap(sim, p, h.x, h.y)).toBeNull();
  });

  it('never draws a word under 11 px at any checked size, the story and its verse at 13 px or more', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        said.length = 0;
        // a first session (the opening story with the verse), then a rest (the bowl), with the smoke's input
        const game = geoda.create(envAt(freshProgress(), c, touch)) as unknown as { sim: GeodaSim } & ReturnType<typeof geoda.create>;
        game.resize(c.w, c.h, 2);
        game.start();
        let tm = 0;
        for (; tm < 3; tm += 1 / 30) { game.update(1 / 30, frame(), tm); game.draw(); }
        const storyWords = said.slice();
        for (let k = 0; tm < 40; tm += 1 / 30, k++) {
          game.update(1 / 30, tm < 20 ? focusing() : resting(), tm);
          game.draw();
          if (k % 20 === 0) {
            game.pointer!({ type: 'down', x: c.w / 2, y: c.h * 0.6, id: 1 });
            game.pointer!({ type: 'up', x: c.w / 2, y: c.h * 0.6, id: 1 });
          }
          if (k % 60 === 30) { game.key!(' ', true); game.key!(' ', false); }
        }
        const what = `${c.name}${touch ? ' (touch)' : ''}`;
        const tiny = largest(said).filter(x => x.px < MIN_TEXT - 1e-6);
        expect(tiny.slice(0, 5), what).toEqual([]);
        // the story card's own words: its title, its text, the verse and its reference, "tap to begin"
        const verse = passage('isa54.11-12');
        const source = [t('open.title'), t('open.text'), verse.text, `${verse.ref} · ${verse.bible}`, t('open.tap')].join(' ').replace(/\s+/g, ' ');
        const story = storyWords.filter(x => x.text.length > 3 && source.includes(x.text.replace(/\s+/g, ' ').replace(/…$/, '')));
        expect(story.length, what).toBeGreaterThan(3);
        const smallStory = largest(story).filter(x => x.px < MIN_READ - 1e-6);
        expect(smallStory.slice(0, 5), `${what}: the story`).toEqual([]);
      }
    }
  });

  it('every language, every phone: every word the game draws through a focus block and a Szlif is 13 px or more', async () => {
    try {
      for (const l of LANGS) {
        localStorage.setItem('brainlink.lang', l);
        vi.resetModules();
        const { default: game0 } = await import('../src/arcade/geoda/index');
        for (const c of CHECK_SIZES.filter(x => /phone/i.test(x.name))) {
          said.length = 0;
          const game = game0.create(envAt(freshProgress(), c, true)) as unknown as { sim: GeodaSim } & ReturnType<typeof geoda.create>;
          game.resize(c.w, c.h, 2);
          game.start();
          let rested = false;
          // a first session of 60 s: the warm-up, the focus block, then the Szlif from ~46 s
          for (let tm = 0, k = 0; tm < 56; tm += 1 / 30, k++) {
            game.update(1 / 30, tm < 3 ? frame() : tm < 40 ? focusing() : resting(), tm);
            game.draw();
            rested ||= game.sim.restBlock && !!game.sim.bowl;
            if (k % 20 === 0) {
              game.pointer!({ type: 'down', x: c.w / 2, y: c.h * 0.6, id: 1 });
              game.pointer!({ type: 'up', x: c.w / 2, y: c.h * 0.6, id: 1 });
            }
          }
          const what = `${l}: ${c.name}`;
          expect(rested, `${what}: a Szlif came`).toBe(true);
          expect(largest(said).filter(x => x.px < MIN_READ - 1e-6).slice(0, 5), what).toEqual([]);
        }
      }
    } finally {
      localStorage.setItem('brainlink.lang', 'pl');
      vi.resetModules();
    }
  });

  it('speaks to the hand the player has: a finger hears of dragging and tapping, a keyboard keeps Space and 1–3', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus|1–3/i;
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['how.goal', 'how.drag', 'how.tap', 'hint.drag', 'hint.tap', 'hint.line', 'open.tap', 'v.tapOn']) {
        expect(cat[k], `${l}.${k}`).toBeTypeOf('string');
        expect(cat[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      expect(cat['how.tap.keys'], `${l}.how.tap.keys`).toMatch(KEYS);
      expect(cat['how.keys'], `${l}.how.keys`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.map(x => x.gesture)).toEqual(['drag', 'tap']);
    for (const h of touch.hands) expect(h.text).not.toMatch(KEYS);
    expect(desk.hands.map(x => x.gesture)).toEqual(['drag', 'tap', 'keys']);
  });
});
