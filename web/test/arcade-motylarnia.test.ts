import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, FocusInput, type FocusFrame } from '../src/arcade/kit/focus';
import { drawCocoon } from '../src/arcade/motylarnia/butterfly';
import { CLASS_FROM, DANDELION_BONUS, NEUTRAL_DEPTH, PLANTS, SPECIES, TIERS, speciesById, type PlantId } from '../src/arcade/motylarnia/content';
import { CATALOGS, t, type Key } from '../src/arcade/motylarnia/i18n';
import { TOP, computeLayout, inRect, sideArea, toLeaf, toScreen } from '../src/arcade/motylarnia/layout';
import { CELL, GRID_H, GRID_W, LEAF_H, LEAF_W, buildLeaf, leafDist, placeDots } from '../src/arcade/motylarnia/leaf';
import {
  F, KEEP_RECORDS, beginSession, dailySpecies, daysBetween, drawEggs, emerge, forcedTier, freshProgress, hatch, laterEggs, nextDay, openHabitats,
  pollenTarget, rollAberration, rollTier, type EggOffer, type EmergeInput, type MothProgress,
} from '../src/arcade/motylarnia/meta';
import { progressPanel } from '../src/arcade/motylarnia/panel';
import { MothRenderer, splitName } from '../src/arcade/motylarnia/render';
import { BUD, sideGeometry, stemPoint } from '../src/arcade/motylarnia/scenery';
import {
  BITE, DMIN, GRACE, KEEP_MIN, LEAF_RANGE, MARGIN_EASY, MARGIN_START, MIN_BLOCK, MothSim, NEUTRAL_V, PAUSE_MAX, REST_RANGE, SILK_HOLD, SPEED, T_EMERGE, T_LEAF, TURN,
  addPigment, isBlind, planRound, sizeClass, wingspan, type Round, type SimEvent,
} from '../src/arcade/motylarnia/sim';
import { decodePath, encodePath, insideWing, mapPath, resamplePath, scribble, wingPoint, wingShape } from '../src/arcade/motylarnia/wing';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-10-23';
const DT = 1 / 60;

/** A player who knows the game: no first-egg tutorial, past the beginner margins, today's leaf done. */
function veteran(over: Partial<MothProgress> = {}): MothProgress {
  return { ...freshProgress(), hatched: 3, total: 3, sessions: 5, lastDay: '2026-10-22', daily: { day: DAY, done: true, sp: 'pawik', mm: 50 }, ...over };
}

const frame = (activity: number | null, reliable = true, threshold = 2): FocusFrame =>
  ({ reliable: reliable && activity !== null, activity, threshold, level: 0.5, focused: false, hold: 0, calm: 0.5 });

function newSim(o: { progress?: MothProgress; seed?: number; daySeed?: number; plannedSec?: number; tool?: 'fnirs' | 'eeg'; species?: string } = {}): MothSim {
  const p = o.progress ?? veteran();
  // a laid egg of the wanted species is the first card when nothing else claims it
  if (o.species) p.eggs.unshift({ sp: o.species, ready: DAY, from: 'laid' });
  const sim = new MothSim({ progress: p, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: o.daySeed ?? 777, plannedSec: o.plannedSec ?? 300, tool: o.tool ?? 'fnirs' });
  sim.start();
  return sim;
}

/** Advance `sec` seconds at 60 fps; `act` = activity % (or a function of the sim), `each` runs before every step. */
function run(sim: MothSim, sec: number, act: number | null | ((s: MothSim) => number | null), each?: (s: MothSim) => void, reliable: boolean | ((s: MothSim) => boolean) = true): void {
  for (let i = 0; i < Math.round(sec / DT); i++) {
    each?.(sim);
    const a = typeof act === 'function' ? act(sim) : act;
    const ok = typeof reliable === 'function' ? reliable(sim) : reliable;
    sim.update(DT, frame(a, ok), sim.t + DT);
  }
}

function untilPhase(sim: MothSim, phase: MothSim['phase'], act: number | ((s: MothSim) => number | null) = 0, max = 120): void {
  for (let i = 0; i < max / DT && sim.phase !== phase; i++) sim.update(DT, frame(typeof act === 'function' ? act(sim) : act), sim.t + DT);
  expect(sim.phase).toBe(phase);
}

const roundOf = (sim: MothSim): Round => sim.round!;

/** The nearest uneaten leaf cell to the head (the "smart player" of the calibration tests). */
function nearestFresh(r: Round): { x: number; y: number } | null {
  const c = r.cat, leaf = r.leaf!;
  let best = Infinity, bx = 0, by = 0;
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const k = j * GRID_W + i;
      if (!leaf.inside[k] || r.eaten[k] || leaf.dist[k] < 12 * leaf.k) continue;
      const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, d = Math.hypot(x - c.x, y - c.y);
      if (d < best && d > 20 * leaf.k) { best = d; bx = x; by = y; }
    }
  }
  return best < Infinity ? { x: bx, y: by } : null;
}

const tap = (sim: MothSim, x: number, y: number) => { sim.pointer('down', x, y); sim.pointer('up', x, y); };

/** A butterfly of `sp` (or of the egg card) emerging, with plain numbers. */
const butterfly = (sp: string, o: Partial<EmergeInput> = {}): EmergeInput =>
  ({ sp, mm: 50, cls: 1, flags: 0, pig: [], depth: 0.5, path: '', daily: false, ...o });
const fromEgg = (egg: EggOffer, o: Partial<EmergeInput> = {}): EmergeInput => butterfly(egg.sp, { egg, daily: egg.source === 'daily', ...o });

/** The smoke test's steering: a tap at the phone screen's centre (50 %, 60 %) every 0.65 s while it eats. */
function centreTap(sim: MothSim, frameNo: number): void {
  const r = sim.round;
  if (frameNo % 39 !== 0 || sim.phase !== 'feed' || !r?.leaf) return;
  const p = toLeaf(computeLayout(390, 844, r.leaf.box), 195, 844 * 0.6, { x: 0, y: 0 });
  tap(sim, p.x, p.y);
}

/** The shortest block on fNIRS: its 6 s lag window plus the reliable seconds a block needs. */
const MIN_FNIRS = 6 + KEEP_MIN;

describe('the leaf', () => {
  it('builds every host plant inside its box, with room to start and a sensible area', () => {
    for (const id of Object.keys(PLANTS) as PlantId[]) {
      const m = buildLeaf(id);
      expect(m.box.x0).toBeGreaterThan(CELL * 2);
      expect(m.box.x1).toBeLessThan(LEAF_W - CELL * 2);
      expect(m.box.y0).toBeGreaterThan(CELL * 2);
      expect(m.box.y1).toBeLessThan(LEAF_H - CELL * 2);
      expect(leafDist(m, m.start.x, m.start.y)).toBeGreaterThan(18 * m.k);
      expect(m.k).toBeGreaterThan(0.7);
      expect(m.k).toBeLessThan(1.15);
      expect(buildLeaf(id)).toBe(m);   // built once
    }
  });

  it('scatters dots and treats on the leaf, away from its edge, the same way for the same seed', () => {
    const m = buildLeaf('pokrzywa');
    const a = placeDots(m, mulberry32(3), [0, 1, 2], 14), b = placeDots(m, mulberry32(3), [0, 1, 2], 14);
    expect(a).toEqual(b);
    expect(a.dots.length).toBe(14);
    expect(a.treats.map(t => t.kind)).toEqual(['malina', 'dmuchawiec']);
    for (const d of a.dots) expect(leafDist(m, d.x, d.y)).toBeGreaterThan(20 * m.k);
    for (const c of [0, 1, 2]) expect(a.dots.filter(d => d.pigment === c).length).toBeGreaterThanOrEqual(3);
  });
});

describe('steering', () => {
  it('turns toward the finger at most 200° a second, so every path is a smooth curve', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'feed');
    const c = roundOf(sim).cat;
    // a target straight behind the head
    let prev = c.heading, worst = 0;
    run(sim, 2, 0, s => {
      const cc = roundOf(s).cat;
      tap(s, cc.x - Math.cos(cc.heading) * 80, cc.y - Math.sin(cc.heading) * 80);
      const d = Math.abs(Math.atan2(Math.sin(cc.heading - prev), Math.cos(cc.heading - prev)));
      worst = Math.max(worst, d);
      prev = cc.heading;
    });
    expect(worst).toBeLessThanOrEqual(TURN * DT + 1e-9);
    expect(worst).toBeGreaterThan(TURN * DT * 0.9);   // and it does turn at the cap
  });

  it('never leaves the leaf, on any host plant, whatever the finger does', () => {
    for (const plant of Object.keys(PLANTS) as PlantId[]) {
      const sp = SPECIES.find(s => s.plant === plant)!;
      const sim = newSim({ species: sp.id, seed: 9 });
      untilPhase(sim, 'feed');
      const r = roundOf(sim), leaf = r.leaf!, rng = mulberry32(plant.length * 31);
      let target = { x: 0, y: 0 }, worst = Infinity;
      for (let i = 0; i < 40 * 60; i++) {
        if (i % 30 === 0) target = { x: -60 + rng() * (LEAF_W + 120), y: -60 + rng() * (LEAF_H + 120) };   // often off the leaf
        if (i % 30 === 0) sim.pointer('down', target.x, target.y);
        if (i % 30 === 20) sim.pointer('up', target.x, target.y);
        if (i % 400 === 200) sim.key('ArrowLeft', true);
        if (i % 400 === 320) sim.key('ArrowLeft', false);
        sim.update(DT, frame(30), sim.t + DT);   // full appetite: fastest, widest
        if (sim.phase !== 'feed') break;
        worst = Math.min(worst, leafDist(leaf, r.cat.x, r.cat.y));
      }
      expect(worst, plant).toBeGreaterThan(DMIN * leaf.k - 2);
    }
  });

  it('keeps crawling and curls along the edge when nothing steers it', () => {
    const sim = newSim({ species: 'bielinek' });
    untilPhase(sim, 'feed');
    const r = roundOf(sim), leaf = r.leaf!;
    let travelled = 0, px = r.cat.x, py = r.cat.y, nearEdge = 0;
    run(sim, 16, -10, s => {
      const c = roundOf(s).cat;
      travelled += Math.hypot(c.x - px, c.y - py);
      px = c.x;
      py = c.y;
      if (leafDist(leaf, c.x, c.y) < 60 * leaf.k) nearEdge++;
      expect(leafDist(leaf, c.x, c.y)).toBeGreaterThan(DMIN * leaf.k - 2);
    });
    expect(travelled).toBeGreaterThan(SPEED[0] * leaf.k * 16 * 0.8);   // it never stalls
    expect(nearEdge).toBeGreaterThan(60);                               // it found the edge and followed it
  });

  it('turns with the arrow keys (and A/D)', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'feed');
    const h0 = roundOf(sim).cat.heading;
    expect(sim.key('ArrowRight', true)).toBe(true);
    run(sim, 0.25, 0);
    sim.key('ArrowRight', false);
    const d = Math.atan2(Math.sin(roundOf(sim).cat.heading - h0), Math.cos(roundOf(sim).cat.heading - h0));
    expect(d).toBeGreaterThan(TURN * 0.2);
    expect(sim.key('a', true)).toBe(true);
    sim.key('a', false);
    expect(sim.key('x', true)).toBe(false);
  });
});

describe('eating', () => {
  it('counts the eaten area on the grid and eats nothing new when it re-crosses its trail', () => {
    const sim = newSim({ species: 'bielinek' });
    untilPhase(sim, 'feed');
    sim.key('ArrowLeft', true);              // a tight circle: the same ground again and again
    run(sim, 4, -10);
    const once = roundOf(sim).eatenCells;
    expect(once).toBeGreaterThan(20);
    run(sim, 4, -10);
    expect(roundOf(sim).eatenCells - once).toBeLessThan(once * 0.08);
    sim.key('ArrowLeft', false);
    expect(sim.eatenShare(roundOf(sim))).toBeCloseTo(roundOf(sim).eatenCells / roundOf(sim).leaf!.insideCount + roundOf(sim).dandelions * DANDELION_BONUS, 9);
  });

  it('maps the eaten share to the size classes and a wingspan in the species range', () => {
    expect(sizeClass(0)).toBe(0);
    expect(sizeClass(CLASS_FROM[1] - 0.001)).toBe(0);
    expect(sizeClass(CLASS_FROM[1])).toBe(1);
    expect(sizeClass(CLASS_FROM[2])).toBe(2);
    expect(sizeClass(CLASS_FROM[3])).toBe(3);
    for (const sp of SPECIES) {
      let prev = 0;
      for (let e = 0; e <= 0.6; e += 0.01) {
        const mm = wingspan(sp, e);
        expect(mm).toBeGreaterThanOrEqual(prev);
        prev = mm;
      }
      expect(wingspan(sp, CLASS_FROM[1])).toBe(sp.span[0]);
      expect(wingspan(sp, CLASS_FROM[3])).toBe(sp.span[1]);
      expect(wingspan(sp, 0)).toBeGreaterThan(0);
    }
  });

  it('gives a no-focus leaf S, a focused one L or XL, a middling one M or L (a player steering to fresh leaf)', () => {
    const sizeAt = (activity: number) => {
      const sim = newSim({ species: 'pawik', seed: 4 });
      untilPhase(sim, 'feed');
      const r = roundOf(sim);
      let k = 0;
      for (let i = 0; i < 60 / DT && sim.phase === 'feed'; i++) {
        if (k++ % 15 === 0) {
          const t = nearestFresh(r);
          if (t) tap(sim, t.x, t.y);
        }
        sim.update(DT, frame(activity), sim.t + DT);
      }
      return sizeClass(sim.eatenShare(r) - r.dandelions * DANDELION_BONUS);
    };
    expect(sizeAt(-30)).toBe(0);
    expect([1, 2]).toContain(sizeAt(2.2));
    expect([2, 3]).toContain(sizeAt(30));
  });

  it('collects pigments into three slots, newest last, the oldest dropping out', () => {
    let p: number[] = [];
    p = addPigment(p, 0);
    p = addPigment(p, 1);
    p = addPigment(p, 2);
    expect(p).toEqual([0, 1, 2]);
    p = addPigment(p, 0);                     // eaten again: it moves to the newest slot
    expect(p).toEqual([1, 2, 0]);
    p = addPigment(p, 4);                     // a fourth colour pushes out the oldest
    expect(p).toEqual([2, 0, 4]);
  });

  it('eats a dot it crawls over and plays it into the palette', () => {
    const sim = newSim({ species: 'pawik', seed: 2 });
    untilPhase(sim, 'feed');
    const r = roundOf(sim), dot = [...r.dots].sort((a, b) => Math.hypot(a.x - r.cat.x, a.y - r.cat.y) - Math.hypot(b.x - r.cat.x, b.y - r.cat.y))[0];
    run(sim, 8, 0, s => { if (!dot.eaten && s.phase === 'feed') tap(s, dot.x, dot.y); });
    expect(dot.eaten).toBe(true);
    expect(r.palette).toContain(dot.pigment);
    expect(sim.drain().some(e => e.type === 'dot')).toBe(true);
  });
});

describe('the brain', () => {
  it('keeps the appetite at its base for the 6 s lag, then follows v with τ 3 s', () => {
    const sim = newSim({ species: 'bielinek' });
    untilPhase(sim, 'feed');
    const r = roundOf(sim);
    run(sim, 5.5, 30);
    expect(r.cat.a).toBeLessThan(0.01);
    expect(r.cat.speed).toBeCloseTo(SPEED[0] * r.leaf!.k, 6);
    expect(r.cat.bite).toBeCloseTo(BITE[0] * r.leaf!.k, 6);
    expect(r.leafBlock!.meter).toBe(0);         // Śmiałe linie wait for the lag too
    run(sim, 3.5, 30);                           // 3 s past the lag: ~1 − e⁻¹
    expect(r.cat.a).toBeGreaterThan(0.55);
    expect(r.cat.a).toBeLessThan(0.75);
    run(sim, 8, 30);
    expect(r.cat.a).toBeGreaterThan(0.95);
    expect(r.cat.speed).toBeGreaterThan(SPEED[1] * r.leaf!.k * 0.95);
  });

  it('uses a 2 s lag and τ 1.5 s on the EEG band', () => {
    const sim = newSim({ species: 'pawik', tool: 'eeg' });
    expect(sim.lag).toBe(2);
    expect(sim.tau).toBe(1.5);
    untilPhase(sim, 'feed');
    run(sim, 3.5, 30);
    expect(roundOf(sim).cat.a).toBeGreaterThan(0.55);
  });

  it('fills S on the leaf and B in the chrysalis, and freezes both while the signal is bad', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'feed');
    const r = roundOf(sim), b = r.leafBlock!;
    run(sim, 12, 30);
    const s1 = b.meter;
    expect(s1).toBeGreaterThan(0);
    const clock = b.clock, cat = r.cat.a;
    expect(cat).toBeGreaterThan(0.8);
    run(sim, 3, 30, undefined, false);          // bad signal
    expect(b.meter).toBe(s1);                    // frozen
    expect(b.clock).toBeCloseTo(clock, 6);       // the block clock waits …
    // … and the appetite eases toward the neutral v of the reference, as smoothly as it follows v
    expect(r.cat.a).toBeLessThan(cat);
    expect(r.cat.a).toBeGreaterThan(NEUTRAL_V);
    run(sim, 7, 30, undefined, false);
    expect(b.paused).toBeCloseTo(PAUSE_MAX, 1);  // … but at most 8 s
    expect(b.clock).toBeGreaterThan(clock + 1.5);
    expect(r.cat.a).toBeCloseTo(NEUTRAL_V, 1);
    untilPhase(sim, 'chrysalis', -10);
    const rb = r.restBlock!;
    run(sim, 4, -10);
    const b1 = rb.meter;
    expect(b1).toBeGreaterThan(0);
    run(sim, 2, -10, undefined, false);
    expect(rb.meter).toBe(b1);
  });

  it('judges each block against the previous block of the other kind, with a staircase between blocks', () => {
    const sim = newSim({ species: 'pawik', plannedSec: 600 });
    expect(sim.margins.up).toBe(MARGIN_START);
    untilPhase(sim, 'feed', 0);
    expect(roundOf(sim).leafBlock!.ref).toBe(2);           // the first leaf: FocusFrame.threshold
    // a clear push: S fills → success → m_up +0.2
    untilPhase(sim, 'spin', 12);
    expect(sim.margins.up).toBeCloseTo(MARGIN_START + 0.2, 9);
    const leafMean = sim.lastMean.focus!;
    expect(leafMean).toBeCloseTo(12, 6);
    expect(roundOf(sim).restBlock!.ref).toBeCloseTo(leafMean - sim.margins.down, 9);
    // a chrysalis that stays up: B stays low → a miss → m_down −0.6
    untilPhase(sim, 'emerge', 12);
    expect(sim.margins.down).toBeCloseTo(MARGIN_START - 0.6, 9);
    expect(sim.lastMean.rest).toBeCloseTo(12, 6);
    untilPhase(sim, 'feed', 0);
    expect(roundOf(sim).leafBlock!.ref).toBeCloseTo(12 + sim.margins.up, 9);
    // two misses in a row put the margin at the easiest
    untilPhase(sim, 'spin', 0);
    untilPhase(sim, 'emerge', 20);
    untilPhase(sim, 'spin', 0);
    expect(sim.margins.up).toBe(MARGIN_EASY);
    expect(sim.counts.pushJudged).toBe(3);
    expect(sim.counts.pushOk).toBe(1);
  });

  it('starts beginners and the golden-hour finisher at the easy margin', () => {
    const beginner = newSim({ progress: veteran({ sessions: 1 }) });
    expect(beginner.margins.up).toBe(MARGIN_EASY);
    expect(beginner.margins.down).toBe(MARGIN_EASY);
    const sim = newSim({ species: 'pawik', plannedSec: 120 });
    untilPhase(sim, 'emerge', 0);
    untilPhase(sim, 'feed', 0);
    expect(roundOf(sim).last).toBe(true);                   // the second of two rounds
    expect(roundOf(sim).leafBlock!.ref).toBeCloseTo(sim.lastMean.rest! + MARGIN_EASY, 9);
  });

  it('drops a block with under 8 reliable scored seconds: no staircase, no reference, no contrast, no verdict', () => {
    const sim2 = newSim({ species: 'pawik', plannedSec: 120 });
    untilPhase(sim2, 'feed', 0);
    const r2 = roundOf(sim2);
    // a strong push, but the signal fails 3 s after the lag window
    for (let i = 0; i < 200 / DT && sim2.phase === 'feed'; i++) sim2.update(DT, frame(30, r2.leafBlock!.clock < sim2.lag + 3), sim2.t + DT);
    expect(sim2.phase).toBe('spin');
    expect(r2.leafKept).toBe(false);
    expect(r2.leafBlock!.reliableScored).toBeLessThan(KEEP_MIN);
    expect(r2.leafBlock!.meter).toBeLessThan(1);             // S cannot fill on 3 s
    expect(sim2.margins.up).toBe(MARGIN_START);
    expect(sim2.lastMean.focus).toBeNull();
    expect(sim2.counts.pushJudged).toBe(0);
    untilPhase(sim2, 'emerge', 20, 60);
    expect(r2.restKept).toBe(true);
    expect(sim2.contrast.contrast).toBeNull();               // the dropped leaf left nothing to compare
    // its size is what it ate (bad-signal time ate at the neutral appetite): no floor that could pay
    const o = r2.outcome!;
    expect(o.rec.mm).toBe(wingspan(speciesById('pawik'), sim2.eatenShare(r2)));
    expect(o.bold).toBe(false);
  });

  it('judges a block on its reliable seconds: the same focus with and without a 12 s dropout gets the same verdict', () => {
    const verdict = (activity: number, dropout: boolean) => {
      const sim = newSim({ species: 'pawik', seed: 7 });
      untilPhase(sim, 'feed', 0);
      const r = roundOf(sim), b = r.leafBlock!;
      let bad = 0;
      run(sim, 45, () => (sim.phase === 'feed' ? activity : 0), undefined, s => {
        if (!dropout || s.phase !== 'feed' || b.clock < 10 || bad >= 12) return true;
        bad += DT;
        return false;
      });
      expect(r.leafKept).toBe(true);
      return { ok: sim.counts.pushOk === 1, meter: b.meter, reliable: b.reliableScored, up: sim.margins.up };
    };
    for (const activity of [30, 4, -30]) {
      const clean = verdict(activity, false), lost = verdict(activity, true);
      expect(lost.reliable).toBeLessThan(clean.reliable - 3);   // the dropout did cost scored seconds …
      expect(lost.ok, `${activity}`).toBe(clean.ok);            // … but not the verdict
      expect(lost.up).toBeCloseTo(clean.up, 9);                 // nor the staircase step
      expect(lost.meter >= 1).toBe(lost.ok);                    // a full meter is the success, and only it
    }
    expect(verdict(30, true).ok).toBe(true);
    expect(verdict(-30, true).ok).toBe(false);
  });

  it('never pays for losing the signal: the wingspan grows with the reliable seconds before the loss', () => {
    // the smoke test's steering, the signal lost for good after k reliable scored seconds of the leaf
    const mmAfter = (activity: number, k: number | null) => {
      const sim = newSim({ species: 'pawik', seed: 3 });
      let n = 0;
      for (; sim.phase !== 'emerge' && n < 160 / DT; n++) {
        centreTap(sim, n);
        const b = sim.round?.leafBlock;
        const ok = sim.phase !== 'feed' || !b || k === null || b.reliableScored < k;
        sim.update(DT, frame(sim.phase === 'feed' ? activity : -10, ok), sim.t + DT);
      }
      return roundOf(sim).outcome!.rec.mm;
    };
    // a strong push: each reliable second adds; a loss (dropped block or not) never beats playing on
    const full = mmAfter(30, null), sweep = Array.from({ length: 21 }, (_, k) => mmAfter(30, k));
    let best = 0;
    for (const mm of sweep) {
      expect(mm).toBeLessThanOrEqual(full);
      expect(mm).toBeGreaterThanOrEqual(best - 1);   // a path that differs may round a millimetre either way
      best = Math.max(best, mm);
    }
    expect(sweep[20] - sweep[0]).toBeGreaterThanOrEqual(4);
    for (let k = 4; k <= 20; k += 4) expect(sweep[k]).toBeGreaterThanOrEqual(sweep[k - 4]);
    // at the reference (v = ½) bad-signal time is exactly neutral
    const even = mmAfter(2, null);
    for (const k of [0, 3, 7, 9, 14, 20]) expect(Math.abs(mmAfter(2, k) - even), `k ${k}`).toBeLessThanOrEqual(1);
  });

  it('crawls on without eating while the block clock stands still, and never draws silk for bad-signal time', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'feed');
    const r = roundOf(sim), b = r.leafBlock!;
    let k = 0;
    const steer = (s: MothSim) => {             // a player heading for fresh leaf
      const t = k++ % 15 === 0 ? nearestFresh(roundOf(s)) : null;
      if (t) tap(s, t.x, t.y);
    };
    run(sim, 17, 30, steer);                     // in the zone long enough for the silk
    expect(r.silk).toBe(true);
    const cells = r.eatenCells, points = r.path.length, x = r.cat.x, y = r.cat.y;
    run(sim, 5, 30, steer, false);
    expect(b.frozen).toBe(true);
    expect(r.eatenCells).toBe(cells);            // nothing eaten while the clock waits …
    expect(Math.hypot(r.cat.x - x, r.cat.y - y)).toBeGreaterThan(40);   // … though it crawls on
    expect(r.path.length).toBeGreaterThan(points);
    const paused = r.path.slice(points);
    expect(paused.every(p => p.bad && !p.silk && p.a === 0)).toBe(true);   // a thin thread, never silk
    run(sim, 4, 30, steer, false);               // the pause budget is spent: it eats again, at the neutral appetite
    expect(sim.phase).toBe('feed');
    expect(b.frozen).toBe(false);
    expect(r.eatenCells).toBeGreaterThan(cells);
    expect(r.path.slice(points).some(p => p.silk)).toBe(false);
  });

  it('waits out a gap in the signal shorter than the grace, but a longer one breaks the zone hold (no silk across it)', () => {
    const hold = (gap: number) => {
      const sim = newSim({ species: 'pawik' });
      untilPhase(sim, 'feed');
      const r = roundOf(sim), b = r.leafBlock!;
      run(sim, sim.lag + 5, 30);                  // the lag, then 5 s in the zone
      const before = b.zone;
      run(sim, gap, 30, undefined, false);        // the signal drops …
      run(sim, 4, 30);                            // … and comes back in the zone
      return { r, b, before };
    };
    const short = hold(GRACE * 0.6);              // 5 + 4 s: one hold, long enough for the silk
    expect(short.r.silk).toBe(true);
    expect(short.r.path.filter(p => p.bad).length).toBeGreaterThan(0);
    expect(short.r.path.every(p => !p.bad || !p.silk)).toBe(true);   // the gap's own points are never silk
    const long = hold(3);                         // 5 s, a gap, 4 s: two holds, neither long enough
    expect(long.before).toBeGreaterThan(4.9);
    expect(long.b.zone).toBeLessThan(4.1);
    expect(long.r.silk).toBe(false);
  });

  it('ends a jedwabna nić that is being drawn when the signal drops past the grace', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'feed');
    const r = roundOf(sim), b = r.leafBlock!;
    run(sim, sim.lag + SILK_HOLD + 0.5, 30);
    expect(r.silkOn).toBe(true);
    const n = r.path.length;
    run(sim, 2, 30, undefined, false);
    expect(r.silkOn).toBe(false);
    expect(b.zone).toBe(0);
    run(sim, 6, 30);                              // in the zone again, but a new hold of only 6 s
    expect(sim.phase).toBe('feed');
    expect(r.silkOn).toBe(false);
    expect(r.path.length).toBeGreaterThan(n + 10);
    expect(r.path.slice(n).some(p => p.silk)).toBe(false);
  });

  it('floors a dropped chrysalis at middling colours', () => {
    const sim2 = newSim({ species: 'pawik' });
    untilPhase(sim2, 'spin', 12);
    for (let i = 0; i < 80 / DT && sim2.phase !== 'emerge'; i++) sim2.update(DT, frame(20, false), sim2.t + DT);
    const r2 = roundOf(sim2);
    expect(r2.restKept).toBe(false);
    expect(r2.outcome!.rec.b).toBe(Math.round(NEUTRAL_DEPTH * 100));
    expect(sim2.margins.down).toBe(MARGIN_START);
  });

  it('makes a butterfly radiant when both S and B fill', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'spin', 20);
    expect(roundOf(sim).leafBlock!.meter).toBe(1);
    untilPhase(sim, 'emerge', -10);
    const o = roundOf(sim).outcome!;
    expect(o.bold && o.deep && o.radiant).toBe(true);
    expect(o.rec.f & F.RADIANT).toBeTruthy();
    const plain = newSim({ species: 'pawik' });
    untilPhase(plain, 'spin', 20);
    untilPhase(plain, 'emerge', 20);
    expect(roundOf(plain).outcome!.radiant).toBe(false);
    expect(roundOf(plain).outcome!.bold).toBe(true);
  });

  it('feeds the leaf-against-chrysalis contrast', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'spin', 14);
    untilPhase(sim, 'emerge', 2);
    expect(sim.contrast.contrast).toBeCloseTo(12, 1);
  });
});

describe('the session', () => {
  const schedule = (planned: number) => {
    const rng = mulberry32(planned);
    let t = 2.4;                                 // the countdown already runs the clock
    const rounds: { leaf: number; rest: number }[] = [];
    for (;;) {
      const plan = planRound(planned - t, rng, MIN_FNIRS);
      if (!plan) break;
      rounds.push(plan);
      t += T_LEAF + plan.leaf + plan.rest + T_EMERGE;
    }
    return { rounds, end: t };
  };

  it('scales the block plan to 40, 70, 180, 300 and 600 s and ends near time up', () => {
    for (const [planned, n] of [[40, 1], [70, 1], [180, 3], [300, 5], [600, 11]] as const) {
      const { rounds, end } = schedule(planned);
      expect(rounds.length, `${planned}`).toBe(n);
      expect(Math.abs(end - planned)).toBeLessThan(0.01);
      for (const r of rounds) {
        // never under 12 s, and on fNIRS never under the lag window plus the seconds a block needs
        expect(r.leaf).toBeGreaterThanOrEqual(Math.max(MIN_BLOCK, MIN_FNIRS));
        expect(r.rest).toBeGreaterThanOrEqual(Math.max(MIN_BLOCK, MIN_FNIRS));
        if (planned >= 180) {
          expect(r.leaf).toBeGreaterThanOrEqual(LEAF_RANGE[0]);
          expect(r.leaf).toBeLessThanOrEqual(LEAF_RANGE[1]);
          expect(r.rest).toBeGreaterThanOrEqual(REST_RANGE[0]);
          expect(r.rest).toBeLessThanOrEqual(REST_RANGE[1]);
        }
      }
    }
    expect(planRound(31, mulberry32(1))).toBeNull();
    expect(planRound(T_LEAF + T_EMERGE + 2 * MIN_FNIRS - 0.1, mulberry32(1), MIN_FNIRS)).toBeNull();
    expect(planRound(T_LEAF + T_EMERGE + 2 * MIN_FNIRS, mulberry32(1), MIN_FNIRS)).not.toBeNull();
    expect(newSim().minBlock).toBe(MIN_FNIRS);
    expect(newSim({ tool: 'eeg' }).minBlock).toBe(MIN_BLOCK);   // a 2 s lag: 12 s blocks have room
  });

  it('keeps every block of a clean signal, at 40, 70, 180, 300 and 600 s', () => {
    for (const planned of [40, 70, 180, 300, 600]) {
      for (let seed = 1; seed <= (planned <= 70 ? 30 : 4); seed++) {
        const sim = newSim({ plannedSec: planned, seed });
        const rounds: Round[] = [];
        run(sim, planned + 30, s => (s.phase === 'feed' ? 8 : -4), s => {
          if (s.round && !rounds.includes(s.round)) rounds.push(s.round);
        });
        expect(sim.phase, `${planned} s, seed ${seed}`).toBe('finale');
        for (const r of rounds) {
          expect(r.leafKept, `${planned} s, seed ${seed}, round ${r.index}`).toBe(true);
          expect(r.restKept, `${planned} s, seed ${seed}, round ${r.index}`).toBe(true);
        }
        // the round whose emergence ends the session knows it as it starts to spin (the finale is painted ahead)
        expect(rounds.map(r => r.final), `${planned} s, seed ${seed}`).toEqual(rounds.map((_, i) => i === rounds.length - 1));
        expect(sim.counts.pushJudged).toBe(rounds.length);
        expect(sim.contrast.contrast).not.toBeNull();
      }
    }
  });

  it('ends near time up when bad signal makes rounds slip (a short last round may run into the overtime)', () => {
    for (const planned of [300, 600]) {
      for (let seed = 1; seed <= 25; seed++) {
        const rnd = mulberry32(seed * 97 + planned);
        const sim = newSim({ plannedSec: planned, seed });
        // in every block a dropout of 0–14 s half the time, from a random second
        let cur: object | null = null, at = 0, len = 0, gone = 0, finaleAt: number | null = null, t = 0;
        while (t < planned + 40) {
          const r = sim.round, b = sim.phase === 'feed' ? r?.leafBlock : sim.phase === 'spin' || sim.phase === 'chrysalis' ? r?.restBlock : null;
          if (b && b !== cur) { cur = b; at = 2 + rnd() * 14; len = rnd() < 0.5 ? 0 : rnd() * 14; gone = 0; }
          let ok = true;
          if (b && b.clock >= at && gone < len) { ok = false; gone += DT; }
          t += DT;
          sim.update(DT, frame(sim.phase === 'feed' ? 6 : -2, ok), t);
          if (sim.phase === 'finale' && finaleAt === null) finaleAt = t;
          if (t >= planned && sim.canStop()) break;
        }
        expect(finaleAt, `${planned} s, seed ${seed}`).not.toBeNull();
        expect(planned - finaleAt!, `${planned} s, seed ${seed}: idle at the end`).toBeLessThan(12);
        expect(t - planned, `${planned} s, seed ${seed}: overtime`).toBeLessThan(30);
      }
    }
  });

  it('jitters the blocks from round to round', () => {
    const { rounds } = schedule(600);
    expect(new Set(rounds.map(r => r.leaf.toFixed(1))).size).toBeGreaterThan(4);
  });

  it('makes one chrysalis in four a blind cocoon from round 3, never the first two or the last', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => isBlind(i, 5))).toEqual([false, false, true, false, false, false, true, false, false, false, true]);
    expect(isBlind(3, 1)).toBe(false);
    const sim = newSim({ plannedSec: 600, seed: 3 });
    const blind: number[] = [];
    let last = 0;
    run(sim, 640, s => (s.phase === 'feed' ? 10 : 0), s => {
      const r = s.round;
      if (r && r.index !== last) {
        last = r.index;
        if (r.blind) blind.push(r.index);
      }
    });
    expect(blind).toEqual([3, 7]);
    expect(sim.counts.blindN).toBe(2);
    expect(sim.done.filter(o => o.blind).length).toBe(2);
  });

  it('keeps a blind cocoon\'s result to itself until it opens', () => {
    const sim = newSim({ plannedSec: 300, seed: 3 });
    const inside: SimEvent[] = [], open: SimEvent[] = [], spins: SimEvent[] = [];
    let blindRound: Round | null = null;
    run(sim, 300, s => (s.phase === 'feed' ? 8 : -8), s => {
      const r = s.round, events = s.drain();
      spins.push(...events.filter(e => e.type === 'spin'));
      if (!r?.blind) return;
      blindRound = r;
      if (s.phase === 'spin' || s.phase === 'chrysalis') inside.push(...events);
      else if (s.phase === 'emerge') open.push(...events);
    });
    const r = blindRound as Round | null;
    expect(r?.index).toBe(3);
    // calm all through: B filled inside the cocoon, but nothing said so there …
    expect(r!.restBlock!.meter).toBe(1);
    expect(inside.map(e => e.type)).not.toContain('deep');
    // … it shows when the butterfly is out (its card says "Bez podglądu ✓")
    const out = open.find(e => e.type === 'emerge');
    expect(out && out.type === 'emerge' && out.outcome.blind && out.outcome.deep).toBe(true);
    expect(sim.counts.blindOk).toBeGreaterThanOrEqual(1);
    // the sound learns which spins are blind (its pad stays muffled inside)
    expect(spins.map(e => e.type === 'spin' && e.blind)).toContain(true);
    // seen chrysalises do announce their deep colours as they happen
    const seen = newSim({ plannedSec: 300, seed: 3 }), said: string[] = [];
    run(seen, 70, s => (s.phase === 'feed' ? 8 : -8), s => {
      const events = s.drain();
      if (s.phase === 'chrysalis') said.push(...events.map(e => e.type));
    });
    expect(said).toContain('deep');
  });

  it('keeps going only through the final chrysalis and emergence', () => {
    const sim = newSim({ plannedSec: 40 });
    const seen = new Map<string, boolean>();
    run(sim, 2.4 + 46, 5, s => seen.set(s.phase, s.canStop()));
    expect(seen.get('leaf')).toBe(true);
    expect(seen.get('feed')).toBe(true);
    expect(seen.get('spin')).toBe(false);
    expect(seen.get('chrysalis')).toBe(false);
    expect(seen.get('emerge')).toBe(false);
    expect(sim.phase).toBe('finale');
    expect(sim.canStop()).toBe(true);
  });

  it('result() is idempotent, and the best session counts only butterflies that flew out', () => {
    const sim = newSim({ plannedSec: 180 });
    run(sim, 100, s => (s.phase === 'feed' ? 12 : 0));
    untilPhase(sim, 'feed', 12);
    run(sim, 8, 12);                              // a caterpillar halfway through its leaf
    const a = sim.result(), snapshot = JSON.stringify(sim.p);
    const b = sim.result();
    expect(b).toEqual(a);
    expect(JSON.stringify(sim.p)).toBe(snapshot);
    const flown = sim.done.reduce((s, o) => s + o.rec.mm, 0);
    expect(sim.provisional).toBeGreaterThan(0);
    expect(a.score).toBe(flown + sim.provisional!);   // the live headline counts the caterpillar …
    expect(sim.p.bestSession).toBe(flown);            // … the record does not
  });

  it('lets the pad follow the appetite and a seen chrysalis\' calm, and holds it still in a blind cocoon', () => {
    const sim = newSim({ plannedSec: 300, seed: 3 });
    const seen: Record<string, (number | null)[]> = {};
    run(sim, 300, s => (s.phase === 'feed' ? 8 : -8), s => {
      const r = s.round, level = s.padLevel();
      const key = s.phase === 'spin' || s.phase === 'chrysalis' ? (r?.blind ? 'blind' : 'seen') : s.phase;
      (seen[key] ??= []).push(level);
      if (s.phase === 'feed') expect(level).toBe(r!.cat.a);
    });
    expect(seen.blind.length).toBeGreaterThan(10 * 60);
    expect(seen.blind.every(v => v === null)).toBe(true);
    expect(seen.leaf.every(v => v === null)).toBe(true);
    expect(seen.emerge.every(v => v === null)).toBe(true);
    const calm = seen.seen.filter((v): v is number => v !== null);
    expect(calm.length).toBe(seen.seen.length);
    expect(Math.min(...calm)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...calm)).toBeGreaterThan(0.8);   // calm clears the shell and opens the sound
  });

  it('sums the session up in at most four lines, merged where they belong together', () => {
    // the very first session: its new peacock first, the strategy tip last
    const first = new MothSim({ progress: freshProgress(), rng: mulberry32(2), day: DAY, daySeed: 5, plannedSec: 70, tool: 'fnirs' });
    first.start();
    run(first, 75, s => (s.phase === 'feed' ? 20 : -10));
    const h1 = first.result().highlights;
    expect(first.done.length).toBe(1);
    expect(h1.length).toBeLessThanOrEqual(4);
    // (this seed's peacock is an albino: its aberration goes with its species, not on a line of its own)
    expect(first.done[0].aberration).toBe('albino');
    expect(h1[0]).toBe('Nowy gatunek: rusałka pawik (odmiana albinotyczna)');
    expect(h1[h1.length - 1]).toMatch(/^Gdy je — planuj trasę/);
    expect(h1.some(l => l.startsWith('Jutro wyklują się: rusałka pawik'))).toBe(true);
    // ten minutes that also open the meadow: still four lines
    const sim = newSim({ plannedSec: 600, seed: 5, progress: veteran({ total: 5 }) });
    run(sim, 640, s => (s.phase === 'feed' ? 20 : -10));
    const h = sim.result().highlights;
    expect(sim.done.length).toBeGreaterThan(8);
    expect(h.length).toBe(4);
    expect(h).toContain('Nowe siedlisko: Łąka — 9 gatunków');
    expect(h.some(l => /^Promienn[ey]: .* · jedwabna nić na skrzydle$/.test(l))).toBe(true);
    // the Polish counts: 1 gatunek; 2–4 motyle (22–24…); 5+ motyli
    expect(t('hl.habitat', { habitat: 'Łąka', n: 1 })).toBe('Nowe siedlisko: Łąka — 1 gatunek');
    expect([2, 4, 22, 104].map(n => t('finale.line', { n, mm: 0 }))).toEqual([2, 4, 22, 104].map(n => `Dziś ${n} motyle · 0 mm`));
    expect([5, 12, 14, 25, 111].map(n => t('finale.line', { n, mm: 0 }))).toEqual([5, 12, 14, 25, 111].map(n => `Dziś ${n} motyli · 0 mm`));
  });

  it('counts the current caterpillar\'s wingspan live, so the score grows while it eats', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'feed');
    const s0 = sim.result().score;
    expect(s0).toBeGreaterThan(0);
    let k = 0;
    run(sim, 15, 20, s => {
      const t = k++ % 15 === 0 ? nearestFresh(roundOf(s)) : null;
      if (t) tap(s, t.x, t.y);
    });
    expect(sim.result().score).toBeGreaterThan(s0);
  });

  it('plays the smoke path: centre taps every 0.65 s, Space every 2 s, simulated focus → score > 0 within 22 s', () => {
    for (const [w, h] of [[1280, 800], [390, 844]] as const) {
      const sim = new MothSim({ progress: freshProgress(), rng: mulberry32(w + h), day: DAY, daySeed: 4242, plannedSec: 40, tool: 'fnirs' });
      const focus = new FocusInput({ ...DEFAULT_TUNING, targetRate: 0.5, adapt: 0.08, floor: 0.5, start: 1 });
      let t = 2.4, f: FocusFrame = focus.push(0, true, 0.1), sinceSample = 0, sinceTap = 0, taps = 0, scoreAt22 = 0, shareAt22 = 0;
      sim.start();
      const L0 = computeLayout(w, h);
      expect(inRect(L0.cards[0], w / 2, h * 0.6) || inRect(L0.cards[1], w / 2, h * 0.6)).toBe(false);   // the centre tap is between the cards
      while (t < 2.4 + 70) {
        sinceSample += DT;
        if (sinceSample >= 0.1) {                 // the band's 10 Hz: the simulator's focus rises to ~+20 % over ~10 s
          sinceSample = 0;
          f = focus.push(20 * (1 - Math.exp(-(t - 2.4) / 3.5)), true, 0.1);
        }
        sinceTap += DT;
        if (sinceTap >= 0.65) {
          sinceTap = 0;
          taps++;
          const r = sim.round;
          if (sim.phase === 'feed' && r?.leaf) {
            const p = toLeaf(computeLayout(w, h, r.leaf.box), w / 2, h * 0.6, { x: 0, y: 0 });
            tap(sim, p.x, p.y);
          }
          if (taps % 3 === 0) { sim.key(' ', true); sim.key(' ', false); }
        }
        t += DT;
        sim.update(DT, f, t);
        if (t <= 2.4 + 22) {
          scoreAt22 = sim.result().score;
          shareAt22 = sim.round ? sim.eatenShare(sim.round) : 0;
        }
        if (t >= 40 && sim.canStop()) break;
      }
      // it really ate: more than the size of a caterpillar that ate nothing
      expect(shareAt22, `${w}×${h}`).toBeGreaterThan(0.04);
      expect(scoreAt22, `${w}×${h}`).toBeGreaterThan(wingspan(speciesById('pawik'), 0));
      expect(sim.done.length).toBe(1);
      expect(t).toBeLessThan(40 + 30);           // within the runner's overtime
      expect(sim.done[0].species.id).toBe('pawik');   // the very first egg is always a peacock
    }
  });

  it('maps screen and leaf space both ways, upright and sideways', () => {
    const box = buildLeaf('pokrzywa').box;
    for (const [w, h] of [[390, 844], [844, 390], [1440, 900]] as const) {
      const L = computeLayout(w, h, box);
      const s = toScreen(L, 123, 321, { x: 0, y: 0 }), l = toLeaf(L, s.x, s.y, { x: 0, y: 0 });
      expect(l.x).toBeCloseTo(123, 6);
      expect(l.y).toBeCloseTo(321, 6);
      expect(L.wide).toBe(w > h);
      // the leaf box fits the play area below the runner's top bar
      const a = toScreen(L, box.x0, box.y0, { x: 0, y: 0 }), b = toScreen(L, box.x1, box.y1, { x: 0, y: 0 });
      expect(Math.min(a.y, b.y)).toBeGreaterThanOrEqual(64);
      expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(w);
    }
  });
});

describe('eggs, pity and pyłek', () => {
  it('rolls wild eggs at the published odds', () => {
    const rng = mulberry32(11), n = 200000, count = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) count[rollTier(rng)]++;
    TIERS.forEach((t, i) => expect(count[i] / n).toBeCloseTo(t.odds, 2));
  });

  it('guarantees a rare egg within 5, an exceptional one within 15, a legendary one within 28 (taking the default card)', () => {
    // with today's leaf done, and with it waiting on every leaf (the default card is then the daily
    // egg unless a pity egg is due: the guarantee must not slip behind it)
    for (const pending of [false, true]) {
      const p = veteran();
      const unlucky = () => 0.99;                // every roll a common egg
      const last = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>, worst = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
      for (let egg = 1; egg <= 200; egg++) {
        if (pending) p.daily = { day: '', done: false, sp: '', mm: 0 };
        const offers = drawEggs(p, DAY, 1, unlucky);
        if (pending) expect(offers.some(o => o.source === 'daily'), `egg ${egg}`).toBe(true);
        emerge(p, fromEgg(offers[0]), DAY, () => 0.9);
        for (const t of [1, 2, 3] as const) {
          if (offers[0].tier >= t) {
            worst[t] = Math.max(worst[t], egg - last[t]);
            last[t] = egg;
          }
        }
      }
      expect(worst[1], `pending ${pending}`).toBeLessThanOrEqual(5);
      expect(worst[2], `pending ${pending}`).toBeLessThanOrEqual(15);
      expect(worst[3], `pending ${pending}`).toBeLessThanOrEqual(28);
      expect(worst[3], `pending ${pending}`).toBeGreaterThan(20);   // the pity, not luck, delivered it
    }
    const q = veteran();
    q.pity.rare = 4;
    expect(forcedTier(q)).toBe(1);
    q.pity.epic = 14;
    expect(forcedTier(q)).toBe(2);
    q.pity.legend = 27;
    expect(forcedTier(q)).toBe(3);
  });

  it('puts a due pity egg on the default card while today\'s leaf waits; the leaf comes on the next card', () => {
    const p = veteran({ daily: { day: '', done: false, sp: '', mm: 0 } });
    p.pity.legend = 27;                          // the 28th egg must be legendary
    const offers = drawEggs(p, DAY, 99, mulberry32(1));
    expect(offers[0]).toMatchObject({ source: 'pity', tier: 3 });
    expect(offers[1]).toMatchObject({ source: 'daily', sp: dailySpecies(99).id });
    emerge(p, fromEgg(offers[0]), DAY, () => 0.9);
    expect(p.pity.legend).toBe(0);
    expect(p.daily.done).toBe(false);
    expect(drawEggs(p, DAY, 99, mulberry32(2))[0].source).toBe('daily');
  });

  it('gives an aberration at the published odds, more on radiant butterflies, and within 40 butterflies', () => {
    const p = veteran(), rng = mulberry32(5), n = 100000, seen = { gyn: 0, albino: 0, melanic: 0 };
    for (let i = 0; i < n; i++) {
      p.pity.aberr = 0;
      const a = rollAberration(p, false, rng);
      if (a) seen[a]++;
    }
    expect(seen.albino / n).toBeCloseTo(0.02, 2);
    expect(seen.melanic / n).toBeCloseTo(0.02, 2);
    expect(seen.gyn / n).toBeCloseTo(0.005, 2);
    let radiant = 0;
    for (let i = 0; i < n; i++) {
      p.pity.aberr = 0;
      if (rollAberration(p, true, rng)) radiant++;
    }
    expect(radiant / n).toBeCloseTo(0.045 * 1.5, 2);
    const q = veteran();
    let k = 0;
    while (!rollAberration(q, false, () => 0.999)) k++;
    expect(k).toBe(39);                           // the 40th butterfly
  });

  it('lays an egg for tomorrow, offers it then, and leaves a rare egg after two days away', () => {
    const p = veteran();
    emerge(p, { sp: 'cytrynek', mm: 55, cls: 2, flags: 0, pig: [2], depth: 0.6, path: '', daily: false }, DAY, () => 0.5);
    expect(p.eggs).toEqual([{ sp: 'cytrynek', ready: '2026-10-24', from: 'laid' }]);
    expect(drawEggs(p, DAY, 1, mulberry32(2)).some(o => o.source === 'laid')).toBe(false);
    const tomorrow = drawEggs(p, '2026-10-24', 1, mulberry32(2));
    expect(tomorrow.some(o => o.source === 'laid' && o.sp === 'cytrynek')).toBe(true);
    expect(laterEggs(p, DAY)).toEqual([{ sp: speciesById('cytrynek'), n: 1, isNew: false }]);
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(daysBetween('2026-10-20', DAY)).toBe(3);
    const away = veteran({ lastDay: '2026-10-20' });
    const gift = beginSession(away, DAY, mulberry32(3))!;
    expect(gift.tier).toBe(1);
    expect(away.eggs[0]).toEqual({ sp: gift.id, ready: DAY, from: 'welcome' });
    expect(away.lastDay).toBe(DAY);
    const back = veteran({ lastDay: '2026-10-22' });
    expect(beginSession(back, DAY, mulberry32(3))).toBeNull();
    // hatching opens the caterpillar card and spends nothing; the egg is used up when its butterfly emerges
    const offers = drawEggs(p, '2026-10-24', 1, mulberry32(2)), i = offers.findIndex(o => o.source === 'laid');
    const pity = { ...p.pity };
    hatch(p, offers[i].sp, '2026-10-24');
    expect(p.atlas.cytrynek.larva).toBe(true);
    expect(p.eggs).toEqual([{ sp: 'cytrynek', ready: '2026-10-24', from: 'laid' }]);
    expect(p.pity).toEqual(pity);
    emerge(p, fromEgg(offers[i]), '2026-10-24', () => 0.9);
    expect(p.eggs).toEqual([{ sp: 'cytrynek', ready: '2026-10-25', from: 'laid' }]);   // its own egg for the day after
    expect(p.pity.rare).toBe(pity.rare + 1);
  });

  it('pays pyłek for duplicates and turns enough of it into a missing species\' egg', () => {
    const p = veteran({ total: 0 });
    const common = SPECIES.filter(s => s.habitat === 'ogrod' && s.tier === 0);
    for (const s of common.slice(0, -1)) p.atlas[s.id] = { n: 1, larva: true, best: 50, radiant: 0, classic: false, ab: 0, first: DAY };
    const missing = common[common.length - 1];
    expect(pollenTarget(p)!.id).toBe(missing.id);
    p.pollen = TIERS[0].price - 1;
    expect(drawEggs(p, DAY, 1, mulberry32(1)).some(o => o.source === 'pollen')).toBe(false);
    p.pollen = TIERS[0].price;
    const offers = drawEggs(p, DAY, 1, mulberry32(1)), o = offers.find(x => x.source === 'pollen')!;
    expect(o.sp).toBe(missing.id);
    hatch(p, o.sp, DAY);
    expect(p.pollen).toBe(TIERS[0].price);      // paid when its butterfly emerges, not at the pick
    emerge(p, fromEgg(o), DAY, () => 0.9);
    expect(p.pollen).toBe(0);
    // a duplicate pays by tier, twice for a radiant one
    const res = emerge(p, butterfly(common[0].id, { flags: F.RADIANT, depth: 1 }), DAY, () => 0.9);
    expect(res.pollen).toBe(TIERS[0].dup * 2);
    expect(res.isNew).toBe(false);
    const first = emerge(p, butterfly('paz', { mm: 70, cls: 2, depth: 1 }), DAY, () => 0.9);
    expect(first.pollen).toBe(0);
    expect(first.isNew).toBe(true);
  });

  it('opens the meadow after 6 butterflies', () => {
    const p = veteran({ total: 5 });
    expect(openHabitats(p)).toEqual(['ogrod']);
    const res = emerge(p, { sp: 'pawik', mm: 50, cls: 1, flags: 0, pig: [], depth: 0.5, path: '', daily: false }, DAY, () => 0.9);
    expect(res.opened).toBe('laka');
    expect(openHabitats(p)).toEqual(['ogrod', 'laka']);
    const rng = mulberry32(8), seen = new Set<string>();
    for (let i = 0; i < 300; i++) for (const o of drawEggs(p, DAY, 1, rng)) seen.add(speciesById(o.sp).habitat);
    expect(seen.has('laka')).toBe(true);
    expect(drawEggs(veteran({ total: 5 }), DAY, 1, mulberry32(8)).every(o => speciesById(o.sp).habitat === 'ogrod')).toBe(true);
  });

  it('keeps 120 full butterflies, each species\' biggest for good, and the per-species record for all', () => {
    const p = veteran();
    // an early legendary catch and a big peacock, then a long run of smaller ones
    emerge(p, butterfly('paz', { mm: 78, pig: [0], path: 'AAAA' }), DAY, () => 0.9);
    emerge(p, butterfly('pawik', { mm: 64, pig: [0], path: 'AAAA' }), DAY, () => 0.9);
    for (let i = 0; i < 200; i++) emerge(p, butterfly(i % 3 ? 'pawik' : 'cytrynek', { mm: 40 + (i % 20), pig: [0], path: 'AAAA' }), DAY, () => 0.9);
    expect(p.butterflies.length).toBe(KEEP_RECORDS);
    expect(p.atlas.pawik.n).toBe(1 + 133);
    for (const id of ['paz', 'pawik', 'cytrynek']) {
      // the Atlas tile's picture: the biggest stored record is the species' best
      const stored = p.butterflies.filter(r => r.sp === id);
      expect(stored.length, id).toBeGreaterThan(0);
      expect(Math.max(...stored.map(r => r.mm)), id).toBe(p.atlas[id].best);
    }
    // pinned: the paź (id 1), the 64 mm peacock (id 2) and the first 59 mm cytrynek (i = 39, id 42);
    // the other 117 are the newest
    expect(p.butterflies.slice(0, 3).map(r => r.id)).toEqual([1, 2, 42]);
    expect(p.butterflies.slice(3).map(r => r.id)).toEqual(Array.from({ length: KEEP_RECORDS - 3 }, (_, k) => 202 - (KEEP_RECORDS - 3) + 1 + k));
    expect(p.eggs.length).toBeLessThanOrEqual(30);
  });

  it('opens the first session with a peacock egg', () => {
    const offers = drawEggs(freshProgress(), DAY, 1, mulberry32(1));
    expect(offers[0]).toMatchObject({ sp: 'pawik', source: 'first' });
  });
});

describe('the Atlas in the lobby', () => {
  it('shows each species\' cards, its classic recipe and the forms earned, dimmed until earned', () => {
    const p = veteran();
    p.atlas.pawik = { n: 3, larva: true, best: 57, radiant: 2, classic: false, ab: F.ALBINO, first: DAY };
    p.atlas.cytrynek = { n: 0, larva: true, best: 0, radiant: 0, classic: false, ab: 0, first: DAY };
    p.atlas.pokrzywnik = { n: 1, larva: true, best: 44, radiant: 0, classic: true, ab: 0, first: DAY };
    const panel = progressPanel(p);
    const tiles = [...panel.querySelectorAll('.arcade-album > div')] as HTMLElement[];
    expect(tiles.length).toBe(9);                                  // Ogród; Łąka is still closed
    const byName = (name: string) => tiles.find(t => t.textContent!.replace(/­/g, '').includes(name))!;
    const marks = (t: HTMLElement) => {
      const small = [...t.querySelectorAll('small')].pop()!;
      return [...small.querySelectorAll('span')].map(s => [s.textContent, s.style.opacity || '1']);
    };
    const pawik = byName('rusałka pawik');
    expect(pawik.classList.contains('on')).toBe(true);
    expect(pawik.querySelector('canvas')).not.toBeNull();
    expect(pawik.textContent).toContain('57 mm · ×3');
    expect(marks(pawik)).toEqual([['◆', '0.3'], ['✦2', '1'], ['◐', '1']]);   // not classic yet; 2 radiant; an albino
    expect(pawik.title).toContain('przepis formy klasycznej: czerwień, ultramaryna, żółcień');
    expect(pawik.title).toContain('odmiany: albinotyczna');
    expect(marks(byName('rusałka pokrzywnik'))).toEqual([['◆', '1'], ['✦', '0.3'], ['◐', '0.3']]);
    // a caterpillar only: its card and recipe, no forms yet; an undiscovered species: a "?"
    const larva = byName('cytrynek');
    expect(larva.textContent).toContain('gąsienica');
    expect(larva.querySelectorAll('small').length).toBe(1);
    expect(tiles.filter(t => t.textContent!.startsWith('?')).length).toBe(6);
    expect(panel.textContent).toContain('◆ forma klasyczna');
    expect(progressPanel(freshProgress()).textContent).not.toContain('◆ forma klasyczna');   // the key waits for a butterfly
  });
});

describe('the daily leaf', () => {
  it('is the same for everyone on a day: species, plant, dots and treats', () => {
    const leafOf = (seed: number) => {
      const p = veteran({ daily: { day: '', done: false, sp: '', mm: 0 } });
      const sim = new MothSim({ progress: p, rng: mulberry32(seed), day: DAY, daySeed: 99, plannedSec: 300, tool: 'fnirs' });
      sim.start();
      sim.update(DT, frame(0), 2.4);
      const r = sim.round!, i = r.offers.findIndex(o => o.source === 'daily');
      expect(i).toBe(0);
      sim.pick(i);
      return { sp: r.species!.id, plant: r.leaf!.plant, dots: r.dots, treats: r.treats };
    };
    const a = leafOf(1), b = leafOf(12345);
    expect(b).toEqual(a);
    expect(a.sp).toBe(dailySpecies(99).id);
    expect(dailySpecies(99)).toBe(dailySpecies(99));
    const days = new Set(Array.from({ length: 60 }, (_, d) => dailySpecies(d * 7919).id));
    expect(days.size).toBeGreaterThan(3);
    for (const id of days) expect(speciesById(id).tier).toBeLessThanOrEqual(1);
  });

  it('is marked done when its butterfly emerges', () => {
    const p = veteran({ daily: { day: '', done: false, sp: '', mm: 0 } });
    const sim = new MothSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 99, plannedSec: 300, tool: 'fnirs' });
    sim.start();
    untilPhase(sim, 'emerge', s => (s.phase === 'feed' ? 10 : 0));
    expect(p.daily).toMatchObject({ day: DAY, done: true, sp: dailySpecies(99).id });
    expect(sim.done[0].rec.f & F.DAILY).toBeTruthy();
    expect(drawEggs(p, DAY, 99, mulberry32(4)).some(o => o.source === 'daily')).toBe(false);
  });
});

describe('the wings', () => {
  it('are drawn the same way for the same path, inside the wing outline', () => {
    const families = [...new Set(SPECIES.map(s => s.family))];
    for (const fam of families) {
      const w = wingShape(fam);
      expect(insideWing(w, w.ox, w.oy)).toBe(true);
      for (let seed = 1; seed <= 6; seed++) {
        const path = scribble(mulberry32(seed * 13), 360);
        const a = mapPath(w, path), b = mapPath(wingShape(fam), path);
        expect(b).toEqual(a);
        for (const p of a) expect(insideWing(w, p.x, p.y), fam).toBe(true);
      }
      // the polar frame stays inside too, for the markings
      const q = { x: 0, y: 0 };
      for (let u = 0; u <= 1; u += 0.05) for (let s = 0.05; s <= 0.95; s += 0.1) expect(insideWing(w, wingPoint(w, u, s, q).x, q.y), `${fam} ${u} ${s}`).toBe(true);
    }
  });

  it('stores a path in at most 1.5 KB and reads it back', () => {
    const path = scribble(mulberry32(7), 900);
    const code = encodePath(path);
    expect(code.length).toBeLessThanOrEqual(1536);
    const back = decodePath(code), ref = resamplePath(path);
    expect(back.length).toBe(ref.length);
    back.forEach((p, i) => {
      expect(Math.abs(p.x - ref[i].x)).toBeLessThan(LEAF_W / 255);
      expect(Math.abs(p.y - ref[i].y)).toBeLessThan(LEAF_H / 255);
      expect(Math.abs(p.a - ref[i].a)).toBeLessThan(1 / 15);
      expect(p.silk).toBe(ref[i].silk);
    });
    expect(encodePath(back)).toBe(code);         // stable: the same wing forever
  });

  it('width follows the appetite', () => {
    const w = wingShape('nymph');
    const thin = mapPath(w, [{ x: 100, y: 100, a: 0, silk: false }, { x: 110, y: 110, a: 0, silk: false }]);
    const bold = mapPath(w, [{ x: 100, y: 100, a: 1, silk: false }, { x: 110, y: 110, a: 1, silk: false }]);
    expect(bold[0].w).toBeGreaterThan(thin[0].w * 3);
  });
});

describe('an early end ("Zakończ i zapisz", the overtime limit)', () => {
  it('lets the caterpillar that is eating out as a butterfly of the size it reached, and spends its egg then', () => {
    const p = veteran();
    p.eggs.push({ sp: 'pawik', ready: DAY, from: 'laid' });   // the default card
    const sim = newSim({ progress: p });
    untilPhase(sim, 'feed', 12);
    run(sim, 12, 12);
    const r = roundOf(sim), mm = sim.provisional!;
    expect(r.offers[r.pick].source).toBe('laid');
    expect(p.eggs).toEqual([{ sp: 'pawik', ready: DAY, from: 'laid' }]);   // not spent while it eats
    expect(p.atlas.pawik).toMatchObject({ larva: true, n: 0 });
    sim.finish();
    expect(sim.done.length).toBe(1);
    expect(sim.done[0].rec.mm).toBe(mm);
    expect(p.eggs).toEqual([{ sp: 'pawik', ready: nextDay(DAY), from: 'laid' }]);   // spent, and tomorrow's laid
    expect(p.pity.rare).toBe(1);
    expect(p.atlas.pawik.n).toBe(1);
    expect(sim.done[0].rec.b).toBe(Math.round(NEUTRAL_DEPTH * 100));   // no chrysalis: middling colours
    expect(sim.counts.pushJudged).toBe(0);       // an unfinished block is not judged
    const res = sim.result();
    expect(res.score).toBe(mm);                   // the headline matches the album
    expect(p.bestSession).toBe(mm);
    sim.finish();                                 // a second call changes nothing
    expect(sim.done.length).toBe(1);
  });

  it('keeps an egg that has not hatched yet', () => {
    const p = veteran();
    p.eggs.push({ sp: 'cytrynek', ready: DAY, from: 'laid' });
    const sim = newSim({ progress: p });
    run(sim, 1.5, 0);                             // the egg cards are up: take the left one
    expect(sim.key(' ', true)).toBe(true);
    expect(roundOf(sim).species!.id).toBe('cytrynek');
    sim.finish();
    expect(sim.done.length).toBe(0);
    expect(p.eggs).toEqual([{ sp: 'cytrynek', ready: DAY, from: 'laid' }]);
    expect(p.atlas.cytrynek).toBeUndefined();    // it never hatched
    expect(p.hatched).toBe(3);
    expect(sim.result().score).toBe(0);
  });

  it('opens a chrysalis cut short with its meters as they stood, at middling colours at least', () => {
    const sim = newSim({ species: 'pawik' });
    untilPhase(sim, 'spin', 20);                   // S filled: bold lines
    untilPhase(sim, 'chrysalis', -10);
    run(sim, 3, -10);
    sim.finish();
    const o = sim.done[0];
    expect(o.bold).toBe(true);
    expect(o.rec.b).toBeGreaterThanOrEqual(Math.round(NEUTRAL_DEPTH * 100));
    expect(sim.counts.pushJudged).toBe(1);
    expect(sim.counts.restJudged).toBe(0);
    expect(sim.phase).toBe('finale');
  });
});

describe('the side view', () => {
  it('hangs the pupa from a twig that reaches in from beyond the left edge, and keeps every stem below the top bar', () => {
    for (const [w, h] of [[390, 844], [360, 640], [844, 390], [568, 320], [1280, 800], [1440, 900]] as const) {
      const L = computeLayout(w, h), area = sideArea(L);
      const hang = sideGeometry('hanging', area);
      expect(stemPoint(hang, 0)[0], `${w}×${h}`).toBeLessThan(-20);   // its cut end is off screen
      let near = Infinity;
      for (let t = 0; t <= 1; t += 0.002) {
        const [x, y] = stemPoint(hang, t);
        near = Math.min(near, Math.hypot(x - hang.ax, y - hang.ay));
        // where it runs behind the side panel of a wide screen, it passes under it
        if (L.wide && x < area.x0 - 8) expect(y - hang.thick / 2, `${w}×${h} under the panel`).toBeGreaterThan(area.under);
      }
      expect(near, `${w}×${h}`).toBeLessThan(hang.len * 0.05);   // the pupa hangs from the twig
      const gird = sideGeometry('girdled', area);
      for (const g of [hang, gird]) {
        for (let t = 0; t <= 1; t += 0.01) expect(stemPoint(g, t)[1], `${w}×${h} ${g.kind}`).toBeGreaterThan(TOP + 4);
        expect(stemPoint(g, 1)[1] - g.thick * BUD, `${w}×${h} ${g.kind}: its bud`).toBeGreaterThan(TOP);
        // a leaf's highest point: its tip, or its curl near the tip (a quarter of its length across)
        for (const lf of g.leaves) expect(Math.min(lf.y, lf.y + Math.sin(lf.a) * lf.len) - lf.len * 0.25, `${w}×${h} ${g.kind}: a leaf`).toBeGreaterThan(TOP);
        // the pupa (and so its blind cocoon) lies in the free area: up along the stem, or hanging down
        expect(g.cx).toBeGreaterThan(area.x0);
        expect(g.cx).toBeLessThan(area.x1);
        expect(Math.min(g.ay, g.cy - g.len * 0.52)).toBeGreaterThan(TOP);
        expect(Math.max(g.ay, g.cy + g.len * 0.52)).toBeLessThan(area.y1 + 1);
      }
    }
  });

  it('draws a girdled species\' blind cocoon up along the stem and a hanging one\'s down from its pad', () => {
    const calls: { name: string; args: number[] }[] = [];
    const ctx = new Proxy({}, {
      get: (_, name) => (name === 'createLinearGradient' || name === 'createRadialGradient'
        ? () => ({ addColorStop: () => undefined })
        : (...args: number[]) => { calls.push({ name: String(name), args }); }),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const body = (kind: 'hanging' | 'girdled') => {
      calls.length = 0;
      drawCocoon(ctx, 100, kind, 0);
      return calls.find(c => c.name === 'ellipse' && c.args[3] === 50)!;   // the cocoon: half its length tall
    };
    expect(body('hanging').args[1]).toBeGreaterThan(0);   // below its silk pad
    expect(body('girdled').args[1]).toBeLessThan(0);      // up along the stem, as the pupa it hides
  });

  it('clears the floating words and sparks when the screen turns', () => {
    const view = new MothRenderer(document.createElement('canvas'), { reducedMotion: false });
    view.resize(390, 844, 1);
    view.floaters.add('Śmiałe linie!', 195, 320);
    view.particles.burst(195, 320, 10);
    view.resize(844, 390, 1);
    expect(view.floaters.items.length).toBe(0);
    expect(view.particles.count).toBe(0);
  });
});

describe('the texts in four languages', () => {
  it('has every text in pl, en, de and sv, with the same placeholders and the plural forms each needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('names every species and host plant in each language, none of them left in Polish, no two alike', () => {
    for (const lang of ['en', 'de', 'sv'] as const) {
      const names = SPECIES.map(s => CATALOGS[lang][`sp.${s.id}` as Key] as string);
      expect(new Set(names).size, lang).toBe(SPECIES.length);
      for (const s of SPECIES) expect(CATALOGS[lang][`sp.${s.id}` as Key], `${lang} ${s.id}`).not.toBe(CATALOGS.pl[`sp.${s.id}` as Key]);
      for (const id of Object.keys(PLANTS)) expect(CATALOGS[lang][`on.${id}` as Key], `${lang} ${id}`).not.toBe(CATALOGS.pl[`on.${id}` as Key]);
    }
    // the game shows the page's language (Polish in the tests)
    expect(speciesById('pawik').name).toBe('rusałka pawik');
    expect(PLANTS.pokrzywa.on).toBe('na pokrzywie');
  });

  it('saves species by id, never by name, so a collection reads in any language', () => {
    const sim = newSim({ plannedSec: 180, seed: 4 });
    run(sim, 190, s => (s.phase === 'feed' ? 10 : -6));
    expect(sim.done.length).toBeGreaterThan(1);
    const saved = JSON.stringify(sim.p);
    for (const s of SPECIES) {
      for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
        const name = CATALOGS[lang][`sp.${s.id}` as Key] as string;
        if (name !== s.id) expect(saved, `${lang} ${s.id}`).not.toContain(`"${name}"`);
      }
    }
    for (const o of sim.done) expect(saved).toContain(`"sp":"${o.species.id}"`);
  });

  it('breaks a long name into two balanced lines at a space or a hyphen', () => {
    const chars = { measureText: (s: string) => ({ width: s.length }) as TextMetrics };
    expect(splitName(chars, 'Schwarzkolbiger Braun-Dickkopffalter')).toEqual(['Schwarzkolbiger', 'Braun-Dickkopffalter']);
    expect(splitName(chars, 'Sechsfleck-Widderchen')).toEqual(['Sechsfleck-', 'Widderchen']);
    expect(splitName(chars, 'sexfläckig bastardsvärmare')).toEqual(['sexfläckig', 'bastardsvärmare']);
    expect(splitName(chars, 'Taubenschwänzchen')).toBeNull();
  });

  it('writes the contrast with the language\'s decimal comma and a real minus', () => {
    const up = newSim({ species: 'pawik' });
    untilPhase(up, 'spin', 14);
    untilPhase(up, 'emerge', 2);
    expect(up.result().stats).toContainEqual(['Kontrast', '+12,0 %']);
    const down = newSim({ species: 'pawik' });
    untilPhase(down, 'spin', 2);
    untilPhase(down, 'emerge', 14);
    expect(down.result().stats).toContainEqual(['Kontrast', '−12,0 %']);
  });
});
