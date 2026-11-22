import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  CONT_MAX, DECLS, DECL_ORDER, FRAG_KEYS, LINES, LINES_OWN, LINE_COUNT, MOMENTS, OWN_VERSE, cleanCont, contDefault, contOf, declWord,
  formSample, label, legacyCont, ownLabel, ownSentence, ownSentenceParts, sentence,
} from '../src/arcade/jestem/content';
import { CATALOGS, t, unit } from '../src/arcade/jestem/i18n';
import {
  addOwn, cellsMaxFor, chooseNext, declKey, dropOwn, freshProgress, legacyLabel, markCont, migrate, nextNew, nextPace, nextVision, ownKey, pinVision,
  planCells, receive, received, type JestemProgress,
} from '../src/arcade/jestem/meta';
import { RULES, readSec } from '../src/arcade/jestem/rules';
import { SCENES, inPolygon, type DeclId } from '../src/arcade/jestem/scenes';
import {
  JestemSim, finaleFor, nextPushCells, playSecOf, pourRate, restSec, warmFor, type SimEvent, type SimVision,
} from '../src/arcade/jestem/sim';
import { ARCH_H, autoNext, buildVision, inWindow, photoSpace, pickAt, type VisionGeo } from '../src/arcade/jestem/vision';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { BREATH_DEFAULT, breathCycle, breathRest } from '../src/arcade/kit/breath';
import { IMAGE_ACCEPT, ImageError, putImage, getImage } from '../src/arcade/kit/images';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { coachText, howto } from '../src/arcade/jestem/index';
import { ARCH, formButtons, layout, tapTargets, tu, windowAt, type PicShape } from '../src/arcade/jestem/layout';
import { fitFont, fitLines, font, fontPx, layoutFinale, windowPath, wrapAll } from '../src/arcade/jestem/paint';
import { edgeMap, makeMosaic, type Pixels } from '../src/arcade/kit/mosaic';
import { cut, heartOf, seedOf, type Analysis } from '../src/arcade/jestem/prep';
import { addOwnPicture, ownErrorText, progressPanel } from '../src/arcade/jestem/panel';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, format, pick } from '../src/i18n';

const DAY = '2026-11-17';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
/** focus at the threshold: the level at its middle, just above it */
const MID = frame({ level: 0.5, activity: 2.1, focused: true, hold: 1, calm: 0.4 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.95 });
/** a signal, no focus */
const LOW = frame({ level: 0.05, activity: -3, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });
/** focus in a push, calm in a rest (a good player) */
const good = (push: FocusFrame) => (sim: JestemSim) => (sim.block.kind === 'rest' ? CALM : push);

const geoCache = new Map<string, VisionGeo>();
/** A declaration's vision cut into about `n` cells (the kit's mosaic over the picture's space; no canvas needed). */
function geoOf(id: DeclId = 'zdrowy', n = 48, seed = 5): VisionGeo {
  const k = `${id}|${n}|${seed}`;
  let g = geoCache.get(k);
  if (!g) {
    const m = makeMosaic(RULES.PW, RULES.PH, Math.round(n / 0.96), mulberry32(seed), { relax: RULES.relax });
    const s = SCENES[id];
    g = buildVision(m, { heart: { x: s.heart[0] * RULES.PW, y: s.heart[1] * RULES.PH }, regions: s.regions });
    geoCache.set(k, g);
  }
  return g;
}
/** An own photo's vision: its own rectangle at `aspect`, cut into `n` cells, clustered by a made-up colour. */
function photoGeo(aspect: number, n = 60, seed = 3): VisionGeo {
  const { w, h } = photoSpace(aspect);
  const m = makeMosaic(w, h, n, mulberry32(seed), { relax: RULES.relax });
  const colors = m.cells.map(c => (c.cy < h * 0.4 ? { r: 90, g: 140, b: 230 } : { r: 60, g: 160, b: 70 }));
  return buildVision(m, { shape: 'rect', heart: { x: w / 2, y: h / 2 }, colors });
}
const visionOf = (id: DeclId = 'zdrowy', n = 48): SimVision => ({ key: declKey(id), geo: geoOf(id, n), decl: id, word: declWord(id, 'm') });
const ownVision = (cont = 'mam pokój', aspect = 4 / 3): SimVision => ({ key: ownKey('img-1'), geo: photoGeo(aspect), decl: null, word: cont });

type SimOpts = { progress?: Partial<JestemProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; ask?: boolean; vision?: SimVision | null };

function makeSim(o: SimOpts = {}): JestemSim {
  const sim = new JestemSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY, plannedSec: o.planned ?? 300,
    eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, askForm: o.ask ?? false,
  });
  if (o.vision !== null) sim.setVision(o.vision ?? visionOf());
  sim.start();
  return sim;
}

const ALL_SEEN = ['tap', 'lit', 'oculus', 'push', 'rest', 'drag', 'pane', 'night', 'light'];
/** A returning player: no warm-up, no opening card, every coach mark seen. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], form: 'm', ...o.progress } });

type Feed = FocusFrame | ((sim: JestemSim, t: number) => FocusFrame);
function drive(sim: JestemSim, sec: number, f: Feed, clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(sim, clock.t) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

/** Play to the end of the session (and its finale). */
function playOut(sim: JestemSim, f: Feed, clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  let guard = 0;
  while (sim.phase !== 'done' && guard++ < 200) out.push(...drive(sim, 5, f, clock));
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run to the start of the next block of a kind (returns the clock). */
function until(sim: JestemSim, kind: 'push' | 'rest', f: Feed, clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && sim.phase === 'play' && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

/** Run a push to its end (returns its length). */
function pushOut(sim: JestemSim, f: Feed, clock = { t: 0 }): number {
  const i = sim.blockIndex;
  let guard = 0;
  while (sim.blockIndex === i && sim.phase === 'play' && guard++ < 4000) drive(sim, 0.1, f, clock);
  return sim.plan[i].dur;
}

const inkSum = (sim: JestemSim) => sim.ink.reduce((s, v) => s + v, 0);

describe('the blocks (round 11: the rest comes after 3–5 lit cells)', () => {
  it('opens a first-ever session with a warm-up, then pushes and rests of whole breaths, and the finale last', () => {
    for (const planned of [180, 300, 600]) {
      const sim = makeSim({ planned, progress: { seen: [...ALL_SEEN], form: 'm' } });
      expect(sim.block.kind).toBe('warmup');
      playOut(sim, good(MID));
      expect(sim.phase).toBe('done');
      const kinds = sim.plan.map(b => b.kind);
      expect(kinds[0]).toBe('warmup');
      kinds.slice(1).forEach((k, i) => expect(k, `${planned}: block ${i + 1}`).toBe(i % 2 ? 'rest' : 'push'));
      expect(kinds.at(-1)).toBe('rest');
      // every rest is a whole number of breaths (kit/breath: 4 in, 6 out)
      for (const b of sim.plan.filter(x => x.kind === 'rest')) expect(b.dur % breathCycle(BREATH_DEFAULT), `${planned}`).toBeCloseTo(0, 6);
      // the finale takes what is left, about its nominal length
      expect(sim.finaleSec).toBeGreaterThan(finaleFor(planned) - 6);
      expect(sim.finaleSec).toBeLessThan(finaleFor(planned) + 16);
      expect(sim.t).toBeLessThanOrEqual(planned + RULES.settle + 0.1);
    }
    expect(warmFor(300)).toBe(RULES.warm.long);
    expect(warmFor(180)).toBe(RULES.warm.short);
    expect(warmFor(40)).toBe(RULES.warm.test);
  });

  it('rests for two breaths of 4 in, 6 out (kit/breath: about 22 s, at least 12)', () => {
    expect(restSec()).toBe(breathRest(BREATH_DEFAULT, 22, 12).sec);
    expect(restSec()).toBe(20);
    const sim = later();
    const clock = until(sim, 'rest', good(MID));
    expect(sim.block.dur).toBe(20);
    // the breath guide begins with the rest: an in-breath for 4 s, then out for 6, twice
    expect(sim.breath.phase).toBe('in');
    expect(t(sim.now!.key)).toBe(t('now.in'));
    drive(sim, 4.2, CALM, clock);
    expect(sim.breath.phase).toBe('out');
    expect(sim.now!.key).toBe('now.out');
    expect(sim.headSub()).toBe(t('hud.breath', { n: 1, k: 2 }));
    drive(sim, 6, CALM, clock);
    expect(sim.headSub()).toBe(t('hud.breath', { n: 2, k: 2 }));
  });

  it('ends a push when its 3rd, 4th or 5th cell lights — 3 first, then by the player’s pace', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    expect(sim.block.cells).toBe(3);
    const asked: number[] = [], lit: number[] = [];
    for (let i = 0; i < 5; i++) {
      until(sim, 'push', good(HIGH), clock);
      asked.push(sim.block.cells);
      const before = sim.score;
      pushOut(sim, good(HIGH), clock);
      lit.push(sim.score - before);
    }
    // a quick player is asked for more cells, up to five; each push lit exactly what it asked
    expect(asked).toEqual([3, 4, 5, 5, 5]);
    expect(lit).toEqual(asked);
    // the next push: quicker → one more, slow or cut at the cap → one fewer, within 3…5
    expect(nextPushCells(3, 15, false)).toBe(4);
    expect(nextPushCells(4, 28, false)).toBe(4);
    expect(nextPushCells(4, 36, false)).toBe(3);
    expect(nextPushCells(5, 20, true)).toBe(4);
    expect(nextPushCells(3, 50, true)).toBe(3);
    expect(nextPushCells(5, 10, false)).toBe(5);
  });

  it('lasts about 20–30 s at threshold focus and 13–19 s at full focus (3, 4 and 5 cells, with the band’s lead-in)', () => {
    for (const [f, lo, hi] of [[MID, 15, 35], [HIGH, 12, 20]] as const) {
      const sim = later({ planned: 600 });
      const clock = { t: 0 };
      const lens: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        until(sim, 'push', good(f), clock);
        const k = sim.block.cells;
        lens.push([k, pushOut(sim, good(f), clock)]);
      }
      for (const [k, sec] of lens) {
        expect(sec, `${k} cells`).toBeGreaterThanOrEqual(lo);
        expect(sec, `${k} cells`).toBeLessThanOrEqual(hi);
      }
      expect(new Set(lens.map(x => x[0])).size).toBeGreaterThan(1);
    }
  });

  it('pours nothing without focus: the push runs to its cap, the rest still comes, nothing is lost', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 12, HIGH, clock);
    const ink = inkSum(sim) + sim.score;
    expect(ink).toBeGreaterThan(0);
    const len = pushOut(sim, LOW, clock);
    expect(len).toBeCloseTo(RULES.pushMax, 0);
    expect(inkSum(sim) + sim.score).toBeCloseTo(ink, 6);
    expect(sim.block.kind).toBe('rest');
    // the next push asks one cell fewer (it never goes under 3)
    until(sim, 'push', CALM, clock);
    expect(sim.block.cells).toBe(3);
    // no signal at all: nothing flows either, and the line says so after a few seconds
    drive(sim, 8, NONE, clock);
    expect(inkSum(sim) + sim.score).toBeCloseTo(ink, 6);
    expect(sim.now!.key).toBe('now.nosignal');
  });

  it('telegraphs the rest when the push’s last cell is 60 % full, and says it in the line', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    let tele: SimEvent | null = null, lastSeen = false, share = 0;
    drive(sim, 60, MID, clock, () => {
      if (sim.now?.key === 'now.last') lastSeen = true;
      for (const e of sim.take()) {
        if (e.type === 'telegraph' && !tele) {
          tele = e;
          const c = sim.target;
          share = c >= 0 ? sim.ink[c] / sim.vision!.geo.cells[c].cap : 1;
        }
      }
    });
    expect(tele).not.toBeNull();
    expect((tele as unknown as { next: { kind: string } }).next.kind).toBe('rest');
    expect(share).toBeGreaterThanOrEqual(RULES.teleShare - 0.02);
    expect(lastSeen).toBe(true);
    const sub = later({ planned: 600 });
    drive(sub, 6, MID);
    expect(sub.headSub()).toBe(t('hud.toRest', { n: 0, k: 3 }));
  });

  it('judges each block once, at its end, over its last 15 s (a ray for a push, a ring for a rest)', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    const evs = drive(sim, 120, good(HIGH), clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBeGreaterThanOrEqual(4);
    for (const e of ends) expect(e.verdict).toBe(true);
    expect(sim.rays).toBe(ends.filter(e => e.block.kind === 'push').length);
    expect(sim.rings).toBe(ends.filter(e => e.block.kind === 'rest').length);
    // no signal: no verdict either way
    const none = later();
    const e2 = drive(none, 45, NONE);
    expect(ofType(e2, 'blockEnd')[0].verdict).toBeNull();
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const sim = first ? makeSim({ planned, progress: { seen: [...ALL_SEEN], form: 'm' } }) : later({ planned });
        playOut(sim, good(MID));
        expect(sim.phase, `${planned} ${first}`).toBe('done');
        // (a session under half a minute is a test of the code: its warm-up and card may take it whole)
        if (planned >= 40) {
          expect(sim.plan.some(b => b.kind === 'push'), `${planned} ${first}`).toBe(true);
          expect(sim.plan.some(b => b.kind === 'rest'), `${planned} ${first}`).toBe(true);
        }
        expect(sim.t).toBeLessThanOrEqual(planned + RULES.settle + 0.1);
      }
    }
  });

  it('tells the runner the block: a push counts its seconds up, a rest down; the next block during the telegraph', () => {
    const sim = later({ planned: 300 });
    expect(sim.block.kind).toBe('push');
    expect(sim.next?.kind).toBe('rest');
    const clock = until(sim, 'rest', good(MID));
    expect(sim.next?.kind).toBe('push');
    const evs = drive(sim, sim.block.dur - 2, CALM, clock);
    expect(sim.telegraphed).toBe(true);
    expect(ofType(evs, 'telegraph')[0].next!.kind).toBe('push');
  });

  it('makes every 4th push blind (the night) from the 3rd session, never the first push of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 3; i++) {
      until(sim, 'push', good(MID), clock);
      blinds.push(sim.block.blind);
      pushOut(sim, good(MID), clock);
    }
    expect(blinds).toEqual([false, true, false]);
    const fresh = makeSim({ planned: 600, progress: { sessions: 1, pushes: 3 } });
    playOut(fresh, good(MID));
    expect(fresh.plan.every(b => !b.blind)).toBe(true);
  });
});

describe('sessions of 15–30 minutes (round 12)', () => {
  it('lets sessions over 15 minutes take finer windows (up to 216); 15 minutes and less exactly as before', () => {
    for (const sec of [180, 300, 600, 900]) {
      const ps = playSecOf(sec, false);
      expect(cellsMaxFor(ps)).toBe(RULES.cellsMax);
      // round 11's formula, unchanged
      for (const pace of [RULES.paceMin, RULES.pace0, 9, RULES.paceMax]) {
        expect(planCells(pace, ps)).toBe(Math.round(Math.min(144, Math.max(48, ((pace * ps) / 60) * RULES.planSpread))));
      }
    }
    expect(planCells(RULES.pace0, playSecOf(1200, false))).toBeGreaterThan(144);
    expect(planCells(RULES.pace0, playSecOf(1800, false))).toBe(RULES.cellsLongMax);
    expect(planCells(RULES.paceMax, 99_999)).toBe(RULES.cellsLongMax);
    expect(later({ planned: 1800 }).cellsWanted).toBe(RULES.cellsLongMax);
    // the progress keeps a long window's count
    expect(migrate({ ...freshProgress(), cells: 200 }).cells).toBe(200);
  });

  it('plays 30 minutes through: blocks to the finale, every piece counted, a strong player still colouring past half-way', () => {
    const n = planCells(RULES.pace0, playSecOf(1800, false));
    for (const [feed, strong] of [[good(MID), false], [good(HIGH), true]] as const) {
      const sim = later({ planned: 1800, vision: visionOf('zdrowy', n) });
      const clock = { t: 0 };
      let firstLight = -1, guard = 0, pushes = 0, rests = 0, last = '';
      while (sim.phase !== 'done' && guard++ < 1000) {
        drive(sim, 2, feed, clock);
        if (firstLight < 0 && sim.lighting) firstLight = clock.t;
        const k = `${sim.blockIndex}`;
        if (k !== last) { last = k; if (sim.block.kind === 'push') pushes++; else if (sim.block.kind === 'rest') rests++; }
      }
      expect(sim.phase).toBe('done');
      expect(clock.t).toBeGreaterThan(1790);
      expect(clock.t).toBeLessThan(1860);
      expect(sim.score + sim.graced).toBe(sim.cells);
      expect(Number.isFinite(sim.score)).toBe(true);
      expect(pushes).toBeGreaterThan(20);
      expect(rests).toBeGreaterThan(20);
      if (strong) expect(firstLight < 0 || firstLight > 900).toBe(true);
      else expect(sim.score).toBeGreaterThan(n * 0.45);
    }
  });
});

describe('more pieces (48–144)', () => {
  it('cuts a window into what the player is expected to light, ×1.4 — 48 at least, 144 at most', () => {
    expect(planCells(RULES.pace0, 10)).toBe(RULES.cellsMin);
    expect(planCells(RULES.paceMax, 9999)).toBe(RULES.cellsLongMax);
    expect(planCells(RULES.paceMax, playSecOf(600, false))).toBe(RULES.cellsMax);
    const p3 = planCells(RULES.pace0, playSecOf(180, false));
    const p5 = planCells(RULES.pace0, playSecOf(300, false));
    const p10 = planCells(RULES.pace0, playSecOf(600, false));
    expect(p3).toBe(48);
    expect(p5).toBe(48);
    expect(p10).toBeGreaterThan(64);
    expect(p10).toBeLessThanOrEqual(144);
    expect(planCells(RULES.pace0 * 1.6, playSecOf(600, false))).toBeGreaterThan(p10);
    expect(RULES.cellsMin).toBeGreaterThanOrEqual(48);
    // the pace follows the sessions (cells per minute of push and rest), a short one barely
    expect(nextPace(RULES.pace0, 40, 280)).toBeGreaterThan(RULES.pace0);
    expect(nextPace(RULES.pace0, 5, 280)).toBeLessThan(RULES.pace0);
    expect(Math.abs(nextPace(RULES.pace0, 30, 3) - RULES.pace0)).toBeLessThan(0.1);
    const sim = later({ planned: 600 });
    expect(sim.cellsWanted).toBe(p10);
    // forced (tests, the frame-time audit), within the bounds only
    const at = (cells: number) => new JestemSim({ progress: freshProgress(), rng: mulberry32(1), day: DAY, plannedSec: 60, eeg: false, tuning: TUNING, askForm: false, cells }).cellsWanted;
    expect(at(144)).toBe(144);
    expect(at(500)).toBe(48);
  });

  it('a session at threshold focus colours the heart of the picture; the finale’s light completes it', () => {
    const sim = later({ planned: 300, vision: visionOf('zdrowy', 48) });
    playOut(sim, good(MID));
    expect(sim.score).toBeGreaterThan(16);
    expect(sim.score).toBeLessThan(sim.cells);
    expect(sim.score + sim.graced).toBe(sim.cells);
    // the pace moves toward what the player did
    expect(sim.p.pace).toBeGreaterThan(RULES.paceMin);
  });

  it('scales each cell’s capacity so a mean cell holds about 5 s of threshold focus', () => {
    const g = geoOf('zdrowy', 96);
    expect(g.cells.length).toBeGreaterThan(85);
    const mean = g.cells.reduce((s, c) => s + c.cap, 0) / g.cells.length;
    expect(mean).toBeCloseTo(RULES.capUnit, 1);
    expect(mean / pourRate(0.5)).toBeGreaterThan(4);
    expect(mean / pourRate(0.5)).toBeLessThan(6.5);
    for (const c of g.cells) {
      expect(c.cap).toBeGreaterThanOrEqual(RULES.capMin * RULES.capUnit - 1e-9);
      expect(c.cap).toBeLessThanOrEqual(RULES.capMax * RULES.capUnit + 1e-9);
    }
  });
});

describe('the vision', () => {
  it('keeps the cells inside the arched window, each with its capacity, neighbours and a named fragment', () => {
    const g = geoOf('zdrowy', 48);
    expect(g.shape).toBe('arch');
    expect(g.cells.length).toBeGreaterThanOrEqual(42);
    expect(g.cells.length).toBeLessThanOrEqual(56);
    for (const c of g.cells) {
      expect(inWindow(c.cx, c.cy)).toBe(true);
      for (const n of c.nb) expect(g.cells[n].nb).toContain(c.id);
    }
    const keys = g.frags.map(f => f.key);
    expect(keys).toContain('runner');
    expect(keys).toContain('sky');
    expect(g.frags.reduce((s, f) => s + f.cells.length, 0)).toBe(g.cells.length);
    // the arch: the top corners are outside, its crown inside
    expect(inWindow(5, 5)).toBe(false);
    expect(inWindow(RULES.PW / 2, 3)).toBe(true);
    expect(inWindow(10, ARCH_H + 1)).toBe(true);
  });

  it('gives an own photo its own shape: its aspect within 9:16…16:9, about the window’s area, every cell kept', () => {
    for (const [asp, want] of [[3 / 4, 3 / 4], [1, 1], [16 / 9, 16 / 9], [4, 16 / 9], [0.2, 9 / 16]] as const) {
      const sp = photoSpace(asp);
      expect(sp.w / sp.h, `${asp}`).toBeCloseTo(want, 2);
      expect((sp.w * sp.h) / (RULES.PW * RULES.PH), `${asp}`).toBeCloseTo(1, 1);
      const g = photoGeo(asp, 60);
      expect(g.shape).toBe('rect');
      expect(g.w).toBe(sp.w);
      expect(g.cells.length).toBe(60);
      // the rectangle: its corners are inside
      expect(inWindow(3, 3, g.w, g.h, 'rect')).toBe(true);
      expect(inWindow(g.w - 3, 3, g.w, g.h, 'rect')).toBe(true);
      expect(inWindow(g.w + 3, 3, g.w, g.h, 'rect')).toBe(false);
    }
    expect(photoSpace(NaN).w / photoSpace(NaN).h).toBeCloseTo(RULES.PW / RULES.PH, 2);
  });

  it('cuts every picture into named fragments, its heart inside the window', () => {
    for (const id of DECL_ORDER) {
      const g = geoOf(id, 48, 9);
      expect(g.frags.length, id).toBeGreaterThanOrEqual(3);
      expect(inWindow(g.heart.x, g.heart.y), id).toBe(true);
      for (const f of g.frags) expect(t(`frag.${f.key}` as never), `${id}: ${f.key}`).not.toMatch(/^frag\./);
    }
  });

  it('flows from the heart outward, finishing a fragment before the next', () => {
    const g = geoOf('zdrowy', 48);
    const lit = g.cells.map(() => false), ink = g.cells.map(() => 0);
    const first = autoNext(g, lit, ink, -1);
    const nearest = g.cells.reduce((b, c) => (c.heartD < g.cells[b].heartD ? c.id : b), 0);
    expect(first).toBe(nearest);
    const f = g.cells[first].frag;
    const cells = g.frags[f].cells;
    for (const id of cells.slice(0, -1)) lit[id] = true;
    if (cells.length > 1) expect(autoNext(g, lit, ink, f)).toBe(cells.at(-1));
    const c = g.cells[5];
    expect(pickAt(g, g.cells.map(() => false), c.cx, c.cy)).toBe(5);
    const all = g.cells.map(x => x.id !== 7);
    expect(pickAt(g, all, 0, 0)).toBe(7);
  });

  it('clusters an own photo into 3…6 fragments ordered from its heart', () => {
    const g = photoGeo(4 / 3, 60);
    expect(g.frags.length).toBeGreaterThanOrEqual(RULES.fragMin);
    expect(g.frags.length).toBeLessThanOrEqual(RULES.fragMax);
    expect(g.frags.map(f => f.key)).toEqual(g.frags.map((_, i) => `part${i + 1}`));
    const d = g.frags.map(f => Math.hypot(f.cx - g.heart.x, f.cy - g.heart.y));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1] - 1e-9);
  });

  it('keeps every region test a pure function of the picture (a polygon test works)', () => {
    expect(inPolygon(0.5, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(true);
    expect(inPolygon(1.5, 0.5, [[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
  });
});

describe('colour and light (progress only from focus)', () => {
  it('pours only while focused, past the band’s lead-in, wider above the threshold', () => {
    expect(pourRate(0)).toBeCloseTo(RULES.baseRate, 6);
    expect(pourRate(0.5)).toBeGreaterThan(RULES.baseRate * 1.6);
    expect(pourRate(0.95)).toBeGreaterThan(pourRate(0.5) * 1.5);
    const hi = later(), mid = later(), lo = later(), none = later();
    drive(hi, 4.5, HIGH);
    // the lead-in: nothing flows yet
    expect(inkSum(hi)).toBe(0);
    drive(hi, 9, HIGH);
    drive(mid, 13.5, MID);
    drive(lo, 13.5, LOW);
    drive(none, 13.5, NONE);
    expect(inkSum(hi) + hi.score * RULES.capUnit).toBeGreaterThan((inkSum(mid) + mid.score * RULES.capUnit) * 1.5);
    expect(inkSum(mid)).toBeGreaterThan(0);
    // no focus, no signal: nothing
    expect(inkSum(lo)).toBe(0);
    expect(inkSum(none)).toBe(0);
    expect(lo.score + none.score).toBe(0);
  });

  it('lights a full cell, counts it, and joins a whole fragment into one pane', () => {
    const sim = later({ planned: 600 });
    const evs = playOut(sim, good(HIGH));
    const lit = ofType(evs, 'lit').filter(e => e.by !== 'grace');
    expect(lit.length).toBeGreaterThan(10);
    expect(sim.score).toBe(lit.length);
    expect(ofType(evs, 'fragment').length).toBeGreaterThan(0);
  });

  it('pours nothing in a rest; calm makes the lit glass glow (a little even without a signal)', () => {
    const calm = later(), none = later();
    const c1 = until(calm, 'rest', HIGH), c2 = until(none, 'rest', HIGH);
    const ink1 = inkSum(calm), g1 = calm.glowMean, g2 = none.glowMean;
    drive(calm, 12, CALM, c1);
    drive(none, 12, NONE, c2);
    expect(inkSum(calm)).toBeCloseTo(ink1, 6);
    expect(calm.glowMean).toBeGreaterThan(g1 + 0.2);
    expect(none.glowMean).toBeGreaterThan(g2);
    expect(calm.glowMean - g1).toBeGreaterThan(none.glowMean - g2);
  });

  it('gives the gauge: the stream in a sighted push past its lead-in, the calm in a rest, nothing blind or without signal', () => {
    const sim = later();
    drive(sim, 2, HIGH);
    expect(sim.meter()).toBeNull();
    drive(sim, 6, HIGH);
    expect(sim.meter()!).toBeGreaterThan(0.8);
    expect(sim.padLevel(HIGH)!).toBeGreaterThan(0.8);
    drive(sim, 0.1, NONE);
    expect(sim.meter()).toBeNull();
    const clock = until(sim, 'rest', HIGH);
    drive(sim, 4, CALM, clock);
    expect(sim.meter()!).toBeGreaterThan(0.5);
    expect(sim.padLevel(CALM)).toBeNull();
  });
});

describe('the hands', () => {
  it('a tap sends the colour to the cell under the finger; its drop joins only colour that flows', () => {
    const sim = later();
    const g = sim.vision!.geo;
    const far = g.cells.reduce((b, c) => (c.heartD > g.cells[b].heartD ? c.id : b), 0);
    // in the lead-in nothing flows: the tap chooses, adds nothing
    expect(sim.tapAt(g.cells[far].cx, g.cells[far].cy)).toBe(true);
    expect(sim.target).toBe(far);
    expect(sim.ink[far]).toBe(0);
    drive(sim, 6, HIGH);
    const before = sim.ink[far];
    expect(before).toBeGreaterThan(0);
    drive(sim, RULES.splashCool + 0.05, HIGH);
    const mid = sim.ink[far];
    sim.key(' ', true);
    expect(sim.ink[far]).toBeGreaterThan(mid + RULES.splash * 0.9);
    // without focus Space adds nothing
    drive(sim, RULES.splashCool + 0.05, LOW);
    const flat = sim.ink[far];
    sim.key(' ', true);
    expect(sim.ink[far]).toBe(flat);
    // the colour stays where it was poured: switching never loses any
    const near = g.cells.find(c => c.id !== far && !sim.lit[c.id])!;
    sim.tapAt(near.cx, near.cy);
    expect(sim.ink[far]).toBeCloseTo(flat, 6);
  });

  it('a drag lays a path the colour follows, cell after cell, across a rest', () => {
    const sim = later();
    const g = sim.vision!.geo;
    const path = g.cells.slice(-4).map(c => c.id);
    sim.setPath(path);
    expect(sim.target).toBe(path[0]);
    const evs = drive(sim, 90, good(HIGH));
    const order = ofType(evs, 'lit').map(e => e.cell);
    expect(order.slice(0, path.length)).toEqual(path);
  });

  it('in a rest a tap on the glass makes it glow, a tap on the sketch marks where the next push begins', () => {
    const sim = later();
    const clock = until(sim, 'rest', HIGH);
    const litCell = sim.lit.findIndex(Boolean);
    const g = sim.vision!.geo;
    const before = sim.glow[litCell];
    expect(sim.tapAt(g.cells[litCell].cx, g.cells[litCell].cy)).toBe(true);
    expect(sim.glow[litCell]).toBeGreaterThan(before);
    const unlit = g.cells.filter(c => !sim.lit[c.id]).at(-1)!;
    sim.tapAt(unlit.cx, unlit.cy);
    expect(sim.marked).toBe(unlit.id);
    until(sim, 'push', CALM, clock);
    drive(sim, 6, HIGH, clock);
    expect(sim.target).toBe(unlit.id);
  });

  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER, ask: true });
    expect(sim.story?.ask).toBe(true);
    let next = 0.65, space = 2;
    drive(sim, 22, HIGH, { t: 0 }, tt => {
      if (tt >= next) {
        next += 0.65;
        sim.tapAt(RULES.PW / 2, RULES.PH * 0.55);
      }
      if (tt >= space) {
        space += 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
    });
    expect(sim.story).toBeNull();
    expect(sim.result().score).toBeGreaterThan(2);
  });

  it('scores within 22 s with no input at all (the opening card closes by itself), focus on', () => {
    const sim = makeSim({ ask: true });
    drive(sim, 22, MID);
    expect(sim.score).toBeGreaterThan(0);
    // focus off: nothing, even in the warm-up
    const off = makeSim({ ask: true });
    drive(off, 22, LOW);
    expect(off.score).toBe(0);
  });

  it('opens the first session with the card, asks the Polish form, and teaches with coach marks', () => {
    const sim = makeSim({ ask: true });
    expect(sim.block.kind).toBe('warmup');
    expect(sim.story).not.toBeNull();
    expect(sim.now).toBeNull();
    sim.chooseForm('f');
    expect(sim.p.form).toBe('f');
    expect(sim.story).toBeNull();
    expect(sim.now!.key).toBe('now.warm');
    const evs = drive(sim, 60, HIGH);
    const coach = ofType(evs, 'coach');
    expect(coach.map(e => e.what)).toContain('lit');
    expect(coach.map(e => e.what)).toContain('push');
    expect(coach.find(e => e.what === 'push')!.k).toBe(3);
    const shown = makeSim({ ask: true, progress: { form: 'm' } });
    expect(shown.story?.ask).toBe(false);
  });
});

describe('night, rays and rings', () => {
  it('keeps what focus pours in the dark; the night ends with its cells, and they light at dawn', () => {
    const run = (f: FocusFrame) => {
      const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
      const clock = { t: 0 };
      until(sim, 'push', good(MID), clock);
      pushOut(sim, good(MID), clock);
      until(sim, 'push', CALM, clock);
      expect(sim.blind).toBe(true);
      expect(sim.meter()).toBeNull();
      expect(sim.padLevel(f)).toBeNull();
      expect(sim.headSub()).toBe(t('hud.night'));
      const k = sim.block.cells;
      const ink = inkSum(sim);
      const evs: SimEvent[] = [];
      let guard = 0;
      while (sim.blind && guard++ < 1000) {
        evs.push(...drive(sim, 0.1, f, clock));
        if (sim.blind) expect(inkSum(sim)).toBeCloseTo(ink, 6);
      }
      return { sim, evs, k, len: sim.plan.filter(b => b.blind)[0].dur };
    };
    const hi = run(HIGH), lo = run(LOW);
    const dawnHi = ofType(hi.evs, 'dawn')[0], dawnLo = ofType(lo.evs, 'dawn')[0];
    expect(dawnHi.cells.length).toBe(hi.k);
    expect(hi.len).toBeLessThan(25);
    expect(dawnLo.cells.length).toBe(0);
    expect(lo.len).toBeCloseTo(RULES.pushMax, 0);
    expect(dawnHi.share).toBeGreaterThan(0.8);
    expect(hi.sim.nightShare).toBeGreaterThan(80);
    expect(hi.sim.result().stats.map(s => s[0])).toContain(t('stat.night'));
  });
});

describe('the whole vision and the finale', () => {
  it('turns to the light pass once every cell is lit: a push pours light', () => {
    const sim = later({ planned: 600, vision: visionOf('wolny', 24) });
    const clock = { t: 0 };
    const evs: SimEvent[] = [];
    let guard = 0;
    while (!sim.complete && guard++ < 400) evs.push(...drive(sim, 1, good(HIGH), clock));
    expect(ofType(evs, 'complete').length).toBe(1);
    expect(sim.score).toBe(sim.cells);
    until(sim, 'push', good(HIGH), clock);
    expect(sim.lighting).toBe(true);
    expect(sim.now!.key).toBe('now.light');
    sim.glow.fill(0.2);
    const g = sim.glowMean;
    drive(sim, 10, HIGH, clock);
    expect(sim.glowMean).toBeGreaterThan(g);
  });

  it('fills what is still unlit with light at the finale, counting only the player’s pieces', () => {
    const sim = later({ planned: 180 });
    const evs = playOut(sim, good(MID));
    expect(sim.phase).toBe('done');
    expect(ofType(evs, 'finale').length).toBe(1);
    const grace = ofType(evs, 'lit').filter(e => e.by === 'grace');
    expect(grace.length).toBeGreaterThan(0);
    expect(sim.lit.every(Boolean)).toBe(true);
    expect(sim.score + sim.graced).toBe(sim.cells);
    expect(sim.score).toBe(ofType(evs, 'lit').filter(e => e.by !== 'grace').length);
    expect(sim.canStop()).toBe(true);
    const r = sim.result();
    expect(r.highlights[0]).toBe(sentence(declWord('zdrowy', 'm')));
    expect(r.highlights.join(' ')).toContain(t('hl.grace', { pieces: t('pieces', { n: sim.graced }) }));
    expect(r.verse).toBe(DECLS.zdrowy.verse);
  });

  it('writes an own vision’s affirmation with the player’s continuation, and keeps it out of the stats', () => {
    const sim = later({ planned: 180, vision: ownVision('mam pokój') });
    playOut(sim, good(MID));
    const r = sim.result();
    expect(r.highlights[0]).toBe('Przez potężne imię Jezusa ja mam pokój.');
    expect(r.verse).toBe(OWN_VERSE);
    expect(JSON.stringify(r.stats)).not.toContain('pokój');
    expect(sim.own).toBe(true);
    // Hanna speaks of no window or lead to an own photo
    for (const line of sim.talk.said) expect(line).not.toMatch(/Ołów|okno|Okno/);
    const empty = later({ planned: 60, vision: ownVision('') });
    expect(empty.affirmation).toBe('Przez potężne imię Jezusa ja wszystko mogę.');
  });

  it('gives result() idempotently, the record only with Math.max, and the album once', () => {
    const sim = later({ planned: 180, progress: { best: 3 } });
    drive(sim, 60, good(HIGH));
    const a = sim.result();
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(a.record).toBe(a.score > 3);
    expect(sim.p.best).toBe(Math.max(3, a.score));
    playOut(sim, good(HIGH));
    sim.result();
    sim.finish();
    sim.result();
    expect(sim.p.album.zdrowy?.n).toBe(1);
    expect(sim.p.total).toBe(sim.score);
    expect(sim.p.sessions).toBe(6);
    const again = later({ planned: 180, progress: { ...sim.p } });
    playOut(again, good(MID));
    expect(again.p.album.zdrowy?.n).toBe(2);
    expect(again.result().highlights.join(' ')).toContain(t('hl.again', { n: 2 }));
  });

  it('settles a session ended early: the declaration is received, the choice for it used', () => {
    const p = { ...freshProgress(), sessions: 2, seen: [...ALL_SEEN] };
    chooseNext(p, declKey('madry'));
    expect(nextVision(p)).toBe('decl:madry');
    const sim = makeSim({ progress: p, vision: visionOf('madry', 48) });
    drive(sim, 20, MID);
    sim.finish();
    expect(sim.phase).toBe('done');
    expect(sim.p.album.madry?.n).toBe(1);
    expect(sim.p.next).toBeNull();
    expect(sim.result().verse).toBe(DECLS.madry.verse);
  });

  it('plays without a vision for a moment (an own picture still loading) and takes it when it comes', () => {
    const sim = makeSim({ vision: null, progress: { sessions: 3, seen: [...ALL_SEEN] } });
    drive(sim, 3, HIGH);
    expect(sim.score).toBe(0);
    sim.setVision(visionOf('silny', 48));
    drive(sim, 25, HIGH);
    expect(sim.score).toBeGreaterThan(0);
  });
});

describe('the meta', () => {
  it('offers the next declaration not yet received, then the least received', () => {
    const p = freshProgress();
    expect(nextNew(p)).toBe(DECL_ORDER[0]);
    receive(p, { key: declKey(DECL_ORDER[0]), lit: 20, rays: 2, rings: 1, day: DAY });
    expect(nextNew(p)).toBe(DECL_ORDER[1]);
    expect(received(p)).toBe(1);
    for (const id of DECL_ORDER) receive(p, { key: declKey(id), lit: 10, rays: 0, rings: 0, day: DAY });
    expect(received(p)).toBe(18);
    expect(nextNew(p)).toBe(DECL_ORDER[1]);
    expect(p.album[DECL_ORDER[0]]).toEqual({ n: 2, best: 20, rays: 2, rings: 1, first: DAY, last: DAY });
  });

  it('pins a vision for every session, chooses one for the next only, and keeps own pictures by id', () => {
    const p = freshProgress();
    pinVision(p, declKey('silny'));
    expect(nextVision(p)).toBe('decl:silny');
    chooseNext(p, declKey('wolny'));
    expect(nextVision(p)).toBe('decl:wolny');
    chooseNext(p, null);
    expect(nextVision(p)).toBe('decl:silny');
    addOwn(p, 'img-1');
    expect(p.own[0].cont).toBe(true);
    chooseNext(p, ownKey('img-1'));
    expect(nextVision(p)).toBe('own:img-1');
    expect(receive(p, { key: ownKey('img-1'), lit: 12, rays: 1, rings: 0, day: DAY })).toBe(1);
    expect(p.own[0]).toMatchObject({ id: 'img-1', n: 1, best: 12, cont: true });
    dropOwn(p, 'img-1');
    expect(p.own).toHaveLength(0);
    expect(nextVision(p)).toBe('decl:silny');
  });

  it('reads a save of version 1: the count kept, the pace started again, old own words marked for migration', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 4, pace: 0.3, own: [{ id: 'old', n: 2, best: 9 }] }) as JestemProgress);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(4);
    expect(p.album).toEqual({});
    expect(p.pace).toBe(RULES.pace0);
    expect(p.own[0]).toMatchObject({ id: 'old', n: 2, cont: false });
    expect(legacyLabel(p, 'old')).toBe(true);
    markCont(p, 'old');
    expect(legacyLabel(p, 'old')).toBe(false);
    expect(migrate(p)).toBe(p);
    const sim = makeSim({ progress: p });
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
    // a version-2 save keeps its pace and its own pictures' state
    const q = migrate(mergeSaved(freshProgress(), { ver: 2, pace: 8, own: [{ id: 'a', n: 1, cont: true }, { id: 'b', n: 0, cont: false }] }) as JestemProgress);
    expect(q.pace).toBe(8);
    expect(q.own.map(o => o.cont)).toEqual([true, false]);
  });

  it('repairs fields of a wrong type and survives garbage', () => {
    const saved = {
      ver: 2, sessions: '7', pushes: 9, form: 'x', pin: 'decl:nope', next: 'own:gone', pace: 99, best: -4, total: 30,
      album: { silny: { n: 2, best: 30, rays: 99, rings: 2, first: '2026-11-01', last: 'yesterday' }, nope: { n: 3 }, wolny: 'x' },
      own: [{ id: 'a', n: 1, best: 4 }, { id: 'a', n: 2 }, 'junk', { id: 5 }], cells: 900, seen: ['tap', 3], last: 'decl:silny',
    };
    const p = migrate(mergeSaved(freshProgress(), saved) as JestemProgress);
    expect(p.sessions).toBe(0);
    expect(p.pushes).toBe(9);
    expect(p.form).toBeNull();
    expect(p.pin).toBeNull();
    expect(p.next).toBeNull();
    expect(p.pace).toBe(RULES.paceMax);
    expect(p.best).toBe(0);
    expect(p.album).toEqual({ silny: { n: 2, best: 30, rays: RULES.raysMax, rings: 2, first: '2026-11-01', last: '' } });
    expect(p.own.map(o => o.id)).toEqual(['a']);
    expect(p.cells).toBe(RULES.cellsLongMax);
    expect(p.seen).toEqual(['tap']);
    expect(p.last).toBe('decl:silny');
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { album: [], own: {}, seen: 'x' }]) {
      const q = migrate(mergeSaved(freshProgress(), junk) as JestemProgress);
      expect(q.ver).toBe(2);
      expect(Array.isArray(q.own)).toBe(true);
      expect(q.album).toEqual({});
    }
  });
});

describe('the own affirmation: “…ja {continuation}”', () => {
  it('keeps a continuation plain and up to 100 characters', () => {
    expect(CONT_MAX).toBe(100);
    expect(cleanCont('  mam\n\tpokój  ')).toBe('mam pokój');
    expect(cleanCont('<b>silna</b>')).toBe('b silna /b');
    expect([...cleanCont('x'.repeat(160))].length).toBe(100);
    expect([...cleanCont('ż'.repeat(160))].length).toBe(100);
    expect(cleanCont(42)).toBe('');
  });

  it('says the founder’s sentence: the declarations unchanged, an own vision continues after “ja”', () => {
    expect(sentence('silny')).toBe('Przez potężne imię Jezusa ja jestem silny.');
    expect(label('silna')).toBe('jestem silna');
    expect(ownSentence('mam pokój')).toBe('Przez potężne imię Jezusa ja mam pokój.');
    expect(ownSentence('mam pokój!')).toBe('Przez potężne imię Jezusa ja mam pokój!');
    expect(ownSentence('')).toBe('Przez potężne imię Jezusa ja wszystko mogę.');
    expect(ownSentenceParts('jestem zdrowa')).toEqual(['Przez potężne imię Jezusa', 'ja jestem zdrowa.']);
    expect(ownLabel('mam pokój')).toBe('ja mam pokój');
    expect(contOf('  ')).toBe(contDefault());
    // the title and the eighteen keep their words
    expect(declWord('kochany', 'm')).toBe('kochany');
    expect(t('sentence', { word: 'kochany' })).toBe('Przez potężne imię Jezusa ja jestem kochany.');
  });

  it('turns an old own word into a continuation in each language (“zdrowa” → “jestem zdrowa”)', () => {
    expect(legacyCont('zdrowa')).toBe('jestem zdrowa');
    expect(legacyCont('')).toBe('');
    const prefix = { pl: 'jestem', en: 'am', de: 'bin', sv: 'är' } as const;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      expect(format(CATALOGS[l]['cont.legacy'] as string, { word: 'x' })).toBe(`${prefix[l]} x`);
    }
  });

  it('lets German and Swedish continue after a colon (verb-second), English after “I”', () => {
    expect(format(CATALOGS.en['own.sentence'] as string, { cont: 'can do all things through Christ' })).toBe('In the powerful name of Jesus I can do all things through Christ');
    expect(format(CATALOGS.de['own.sentence'] as string, { cont: 'vermag alles' })).toBe('Im mächtigen Namen Jesu: Ich vermag alles');
    expect(format(CATALOGS.sv['own.sentence'] as string, { cont: 'har frid' })).toBe('I Jesu mäktiga namn: jag har frid');
    // the declarations keep their sentences
    expect(CATALOGS.de.sentence).toBe('Im mächtigen Namen Jesu bin ich {word}.');
    expect(CATALOGS.sv.sentence).toBe('I Jesu mäktiga namn är jag {word}.');
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('says each declaration in the speaker’s form, with a verse that exists', () => {
    expect(declWord('silny', 'm')).toBe('silny');
    expect(declWord('silny', 'f')).toBe('silna');
    expect(declWord('zwyciezca', 'f')).toBe('zwyciężczynią');
    expect(declWord('dziecko', null)).toBe('dzieckiem Bożym');
    for (const id of DECL_ORDER) {
      expect(passage(DECLS[id].verse).text.length, id).toBeGreaterThan(10);
      expect(t(`task.${id}` as never), id).not.toMatch(/^task\./);
      expect(t(`scene.${id}` as never), id).not.toMatch(/^scene\./);
    }
    expect(passage(OWN_VERSE).ref).toMatch(/4/);
    expect(DECL_ORDER).toHaveLength(18);
    expect(new Set(DECL_ORDER).size).toBe(18);
    for (const k of FRAG_KEYS) expect(t(`frag.${k}` as never), k).not.toMatch(/^frag\./);
  });

  it('gives Hanna at least three lines a moment (two for an own photo), each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
    for (const m of MOMENTS) expect(LINES_OWN[m].length, m).toBeGreaterThanOrEqual(2);
    expect(LINE_COUNT).toBeGreaterThan(55);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps words on screen long enough to read twice (2.5 s + 70 ms a character, at least 4.5 s)', () => {
    expect(readSec('Promień')).toBe(4.5);
    expect(readSec('x'.repeat(60))).toBeCloseTo(6.7, 6);
    const sim = later();
    drive(sim, 40, good(HIGH));
    const line = sim.talk.line;
    if (line) expect(line.dur).toBeCloseTo(readSec(line.text), 6);
  });

  it('keeps Polish letters and Polish words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
  });

  it('never says a gendered past tense to the player in Polish, and never promises outcomes', () => {
    for (const [k, v] of Object.entries(CATALOGS.pl)) {
      if (typeof v !== 'string') continue;
      expect(v.split(/[\s.,!?;:…—–-]+/).filter(w => /(łeś|łaś)$/.test(w)), k).toEqual([]);
      expect(v, k).not.toMatch(/\b(będziesz zdrow|wyzdrowiejesz|uzdrowi Cię|staniesz się bogat)/i);
    }
  });

  it('suggests strategies, never to concentrate harder; the how-to’s last tip says the band measures attention', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip|task|howto|now|coach)\./.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
      expect(CATALOGS[l]['howto.tip2'], l).toMatch(/uwag|attention|Aufmerksamkeit|uppmärksamhet/);
    }
    expect(howto(true).tips?.at(-1)).toBe(t('howto.tip2'));
  });

  it('says what to do now in a few words, an icon each, and names each image failure in its own words', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const k of ['now.warm', 'now.push', 'now.last', 'now.night', 'now.light', 'now.in', 'now.out', 'now.hold', 'now.nosignal']) {
        expect((CATALOGS[l] as Record<string, string>)[k].length, `${l}.${k}`).toBeLessThanOrEqual(64);
      }
    }
    expect(t('now.last')).toBe('Jeszcze jedna część, potem odpoczynek');
    const texts = (['notImage', 'heic', 'format', 'tooBig', 'storage'] as const).map(r => ownErrorText(new ImageError(r)));
    expect(new Set(texts).size).toBe(5);
    expect(texts[1]).toBe('Zdjęcie HEIC z iPhone’a otworzy Safari; w innej przeglądarce zapisz je jako JPG lub PNG.');
    expect(ownErrorText(new Error('x'))).toBe(t('panel.err.other'));
  });

  it('bends the headline’s unit', () => {
    expect(unit(1)).toBe('część');
    expect(unit(3)).toBe('części');
    expect(unit(5)).toBe('części');
    expect(t('pieces', { n: 22 })).toBe('22 części');
    expect(pick(CATALOGS.en.pieces, 1)).toContain('piece');
  });
});

/** The size in a canvas font string. */
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);

/** A canvas context that measures text as 0.6 em per character (enough to test fitting). */
function measuring(): CanvasRenderingContext2D {
  const ctx = { font: '10px sans-serif', measureText(text: string) { return { width: [...text].length * pxOf(this.font) * 0.6 } as TextMetrics; } };
  return ctx as unknown as CanvasRenderingContext2D;
}

/** The pictures a layout is checked for: the arched window, and own photos portrait, square and landscape. */
const SHAPES: [string, PicShape][] = [
  ['arch', ARCH],
  ['portrait photo', { shape: 'rect', ...photoSpace(9 / 16) }],
  ['3:4 photo', { shape: 'rect', ...photoSpace(3 / 4) }],
  ['square photo', { shape: 'rect', ...photoSpace(1) }],
  ['landscape photo', { shape: 'rect', ...photoSpace(16 / 9) }],
];

describe('mobile first (DESIGN §12, §13.8)', () => {
  it('keeps the window, its gauge and the “what to do now” line inside the band, at every checked size and shape', () => {
    for (const touch of [true, false]) {
      for (const c of CHECK_SIZES) {
        for (const [name, pic] of SHAPES) {
          const L = layout(c.w, c.h, c.insets, touch, pic);
          const id = `${c.name} · ${name} · ${touch ? 'touch' : 'mouse'}`;
          expect(L.win.x, id).toBeGreaterThanOrEqual(c.insets.left - 0.5);
          expect(L.win.x + L.win.w, id).toBeLessThanOrEqual(c.w - c.insets.right + 0.5);
          expect(L.win.y + L.win.h, id).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
          expect(L.oculus.y - L.oculus.r * 1.2, id).toBeGreaterThanOrEqual(c.insets.top - 0.5);
          expect(L.oculus.x - L.oculus.r * 1.2, id).toBeGreaterThanOrEqual(c.insets.left - 0.5);
          expect(L.oculus.r, id).toBeGreaterThanOrEqual(15);
          expect(L.win.w / L.win.h, id).toBeCloseTo(pic.w / pic.h, 5);
          expect(L.k, id).toBeCloseTo(L.win.w / pic.w, 6);
          // the window is as large as the band allows: most of its height or its width
          expect(Math.max(L.win.h / L.band.h, L.win.w / L.band.w), id).toBeGreaterThan(pic.shape === 'arch' ? 0.75 : 0.55);
          // the now line: two lines of it fit inside the band, under the window or over its lower edge
          const N = L.now;
          const h2 = 2 * fontPx(14 * (L.desk ? L.u : Math.min(L.u, 1.15))) * 1.3 + 12;
          const top = N.anchor === 'top' ? N.y : N.y - h2, bottom = N.anchor === 'top' ? N.y + h2 : N.y;
          expect(top, id).toBeGreaterThanOrEqual(L.band.y - 0.5);
          expect(bottom, id).toBeLessThanOrEqual(L.band.y + L.band.h + 0.5);
          expect(N.cx - N.maxW / 2, id).toBeGreaterThanOrEqual(L.band.x - 0.5);
          expect(N.cx + N.maxW / 2, id).toBeLessThanOrEqual(L.band.x + L.band.w + 0.5);
          // the finale's words have room
          expect(L.finText.w, id).toBeGreaterThan(150);
          expect(L.finText.h, id).toBeGreaterThan(50);
          expect(L.finText.y + L.finText.h, id).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
          expect(L.finWin.x, id).toBeGreaterThanOrEqual(L.band.x - 0.5);
          expect(L.finWin.x + L.finWin.w, id).toBeLessThanOrEqual(L.band.x + L.band.w + 0.5);
        }
      }
    }
  });

  it('puts the window under a centre tap on a desktop (the smoke test taps at the middle, 60 % down)', () => {
    for (const c of CHECK_SIZES.filter(x => x.w >= 1000)) {
      for (const [name, pic] of SHAPES) {
        const L = layout(c.w, c.h, c.insets, true, pic);
        expect(L.mode).toBe('wide');
        expect(c.w / 2, `${c.name} ${name}`).toBeGreaterThan(L.win.x);
        expect(c.w / 2, `${c.name} ${name}`).toBeLessThan(L.win.x + L.win.w);
        if (pic.shape === 'arch') {
          expect(c.h * 0.6).toBeGreaterThan(L.win.y);
          expect(c.h * 0.6).toBeLessThan(L.win.y + L.win.h);
        }
        expect(L.side, `${c.name} ${name}`).not.toBeNull();
        expect(L.side!.x).toBeGreaterThan(L.win.x + L.win.w);
        expect(L.side!.x + L.side!.w).toBeLessThanOrEqual(c.w - c.insets.right);
      }
    }
  });

  it('frames an own photo as a rectangle (no arch), a declaration as the arched window', () => {
    const r = { x: 10, y: 20, w: 300, h: 200 };
    const calls: string[] = [];
    const P = globalThis.Path2D;
    class Rec { moveTo(x: number, y: number) { calls.push(`M${x},${y}`); } lineTo(x: number, y: number) { calls.push(`L${x},${y}`); } arc() { calls.push('A'); } closePath() { calls.push('Z'); } }
    (globalThis as { Path2D: unknown }).Path2D = Rec;
    try {
      windowPath(r, 0, false, 'rect');
      expect(calls).toEqual(['M10,220', 'L10,20', 'L310,20', 'L310,220', 'Z']);
      calls.length = 0;
      windowPath(r, 0, false, 'arch');
      expect(calls).toContain('A');
    } finally {
      (globalThis as { Path2D: unknown }).Path2D = P;
    }
  });

  it('lists no targets in play (the window is the free play area), the card’s two answers when it asks, all finger-sized and in place', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      expect(tapTargets(L, { card: null })).toEqual([]);
      expect(tapTargets(L, { card: 'story' })).toEqual([]);
      for (const hh of [L.card.h, 260, 200]) {
        const box = { ...L.card, y: L.anchor === 'bottom' ? L.card.y + L.card.h - hh : L.card.y + (L.card.h - hh) / 2, h: hh };
        const ts = tapTargets(L, { card: 'ask', cardBox: box });
        expect(ts.map(x => x.label)).toEqual(['form: m', 'form: f']);
        expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: the card at ${hh} px`).toEqual([]);
        for (const x of ts) {
          expect(x.h).toBeGreaterThanOrEqual(48);
          expect(x.x).toBeGreaterThanOrEqual(c.insets.left + 16 - 0.01);
          expect(x.x + x.w).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
        }
      }
    }
  });

  it('lays a phone upright out tall: the opening card a bottom sheet with its answers in the thumb zone', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode, c.name).toBe('tall');
      expect(L.u).toBeLessThan(1.1);
      expect(L.anchor).toBe('bottom');
      const [a, b] = formButtons(L);
      for (const r of [a, b]) expect(r.y, c.name).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
      expect(L.win.w, c.name).toBeGreaterThan(c.w * 0.7);
      expect(L.finWin.y + L.finWin.h).toBeLessThan(L.finText.y + 1);
      expect(windowAt(L, 1)).toEqual(L.finWin);
      expect(windowAt(L, 0)).toEqual(L.win);
    }
  });

  it('lays a phone on its side and a desktop out wide: the window high in the band, a column beside it where it fits', () => {
    for (const c of CHECK_SIZES.filter(x => x.w > x.h)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode, c.name).toBe('wide');
      expect(L.win.h, c.name).toBeGreaterThan((c.h - c.insets.top - c.insets.bottom) * 0.8);
      if (L.side) expect(L.side.w, c.name).toBeGreaterThanOrEqual(189);
    }
    const phone = layout(844, 390, CHECK_SIZES[5].insets);
    expect(phone.side).not.toBeNull();
  });

  it('never draws text under 11 px: the font helper has a floor, fitting never shrinks under it, wrapping never cuts', () => {
    for (const px of [0, 3, 6.4, 8, 10.4, 10.99, 11, 12.3, 13, 30]) expect(pxOf(font(px))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fontPx(4)).toBe(MIN_TEXT);
    expect(pxOf(font(14.2, 600, true))).toBe(14);
    const ctx = measuring();
    expect(fitFont(ctx, 'Przez potężne imię Jezusa ja jestem zwyciężczynią.', 40, 30, 6)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fitFont(ctx, 'Taniec', 300, 21, 13)).toBe(21);
    expect(MIN_READ).toBe(13);
    ctx.font = font(13);
    const long = 'x'.repeat(100);
    const lines = wrapAll(ctx, `a ${long} b`, 120);
    expect(lines.join('').replace(/\s/g, '')).toBe(`a${long}b`);
    for (const l of lines) expect(ctx.measureText(l).width).toBeLessThanOrEqual(120);
  });

  it('fits a 100-character affirmation everywhere it shows, in all four languages, at every checked size and shape', () => {
    const ctx = measuring();
    const conts = {
      pl: 'mam w sercu pokój, który przewyższa wszelki umysł, i idę przez każdy dzień z ufnością, światłem i radością',
      en: 'can do all things through Christ who strengthens me, and I walk each day in peace, light and quiet joy here',
      de: 'vermag alles durch den, der mich stark macht, und gehe jeden Tag in Frieden, im Licht und in stiller Freude',
      sv: 'förmår allt genom honom som ger mig kraft, och jag går varje dag i frid, i ljus och i en stilla glädje här',
    };
    for (const [l, raw] of Object.entries(conts) as [keyof typeof conts, string][]) {
      const cont = cleanCont(raw);
      expect([...cont].length, l).toBe(100);
      const a = format(CATALOGS[l]['own.a'] as string, {});
      const b = `${format(CATALOGS[l]['own.b'] as string, { cont })}.`;
      const whole = `${format(CATALOGS[l]['own.sentence'] as string, { cont })}.`;
      for (const touch of [true, false]) {
        for (const c of CHECK_SIZES) {
          for (const [name, pic] of SHAPES) {
            const L = layout(c.w, c.h, c.insets, touch, pic);
            const id = `${l} · ${c.name} · ${name}`;
            // the finale: both parts wrapped and fitted into their box, nothing cut, nothing under the floor
            const T = L.finText;
            const fin = layoutFinale(ctx, a, b, T.w, T.h, L.u);
            expect(fin.a.join(' '), id).toBe(a);
            expect(fin.b.join(' '), id).toBe(b);
            expect(fin.height, id).toBeLessThanOrEqual(T.h + 0.5);
            expect(fin.sizeA, id).toBeGreaterThanOrEqual(MIN_READ);
            expect(fin.sizeB, id).toBeGreaterThanOrEqual(14);
            ctx.font = font(fin.sizeB, 700, true);
            for (const line of fin.b) expect(ctx.measureText(line).width, id).toBeLessThanOrEqual(T.w + 0.5);
            // the column beside the window: the whole affirmation under Hanna's bubble, at the reading floor at least
            if (L.side) {
              const S = L.side;
              const room = S.y + S.h - (S.y + Math.max(74 * L.u, 98)) - 4;
              const f = fitLines(ctx, whole, S.w, room, 15 * tu(L, 1.2), MIN_READ, { weight: 500, serif: true, italic: true, lead: 1.35 });
              expect(f.lines.join(' '), id).toBe(whole);
              expect(f.lines.length * f.lh, id).toBeLessThanOrEqual(room + 0.5);
              expect(f.size, id).toBeGreaterThanOrEqual(MIN_READ);
            }
          }
        }
      }
    }
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|klick|click|mysz[ąy]|mouse|maus/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['howto.goal', 'howto.tap', 'howto.drag', 'coach.tap', 'coach.drag', 'coach.lit', 'coach.oculus', 'coach.ring', 'coach.push', 'story.tap', 'now.warm', 'now.push']) {
        expect(c[k], `${l}.${k}`).toBeTypeOf('string');
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      expect(c['coach.tap.keys'], `${l}.coach.tap.keys`).toMatch(KEYS);
      expect(c['howto.keys'], `${l}.howto.keys`).toMatch(KEYS);
      expect(c['story.click'], `${l}.story.click`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
    expect(touch.tips?.length).toBe(2);
    expect(coachText('tap', true)).not.toMatch(KEYS);
    expect(coachText('tap', false)).toMatch(KEYS);
    expect(coachText('oculus', true, { photo: true })).toBe(t('coach.ring'));
    expect(coachText('push', true, { k: 4 })).toBe('Skup się na obrazie. Po 4 częściach w barwie przyjdzie odpoczynek');
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, string>;
      expect(c['howto.click'], `${l}.howto.click`).toMatch(/klik|click|klick/i);
      expect(c['howto.drag.mouse'], `${l}.howto.drag.mouse`).toMatch(/mysz|mouse|maus|mus/i);
      for (const k of ['howto.click', 'howto.drag.mouse', 'howto.keys']) expect(c[k], `${l}.${k}`).not.toMatch(/stuk|palc|\btap|finger|tipp|tryck på en|fingret/i);
    }
    expect(desk.hands.map(x => x.text)).toEqual([t('howto.click'), t('howto.drag.mouse'), t('howto.keys')]);
    expect(touch.hands.map(x => x.text)).toEqual([t('howto.tap'), t('howto.drag')]);
  });
});

describe('a big screen and a mouse (DESIGN §14)', () => {
  const desks = CHECK_SIZES.filter(c => c.w > c.h && c.w >= 1024 && c.h >= 560);

  it('lays a desktop and a big screen out for the mouse; a finger keeps its own layouts', () => {
    expect(desks.length).toBeGreaterThanOrEqual(5);
    for (const c of CHECK_SIZES) {
      expect(layout(c.w, c.h, c.insets).desk, c.name).toBe(false);
      expect(layout(c.w, c.h, c.insets, false).desk, c.name).toBe(desks.includes(c));
      expect(layout(c.w, c.h, c.insets, true)).toEqual(layout(c.w, c.h, c.insets));
    }
  });

  it('gives the window the band’s full height and the words a column beside it, centred as one group', () => {
    for (const c of desks) {
      const L = layout(c.w, c.h, c.insets, false);
      expect(L.mode, c.name).toBe('wide');
      expect(L.win.h / L.band.h, c.name).toBeGreaterThan(0.88);
      expect(L.win.x, c.name).toBeLessThan(c.w / 2);
      expect(L.win.x + L.win.w, c.name).toBeGreaterThan(c.w / 2);
      expect(L.win.y, c.name).toBeLessThan(c.h * 0.6);
      expect(L.win.y + L.win.h, c.name).toBeGreaterThan(c.h * 0.6);
      const S = L.side!;
      expect(S, c.name).not.toBeNull();
      expect(S.x, c.name).toBeGreaterThan(L.win.x + L.win.w);
      expect(S.x + S.w, c.name).toBeLessThanOrEqual(c.w - c.insets.right - 16);
      expect(S.w, c.name).toBeGreaterThanOrEqual(190 * L.u - 0.5);
      expect(S.w, c.name).toBeLessThanOrEqual(18 * 15 * L.u + 0.5);
      expect(L.finText).toEqual({ x: S.x, y: L.band.y + 8, w: S.w, h: L.band.h - 16 });
    }
    for (const c of desks.filter(x => Math.min(x.w, x.h) >= DESK_BIG)) {
      const L = layout(c.w, c.h, c.insets, false);
      const leftRoom = L.win.x - L.band.x, rightRoom = L.band.x + L.band.w - (L.side!.x + L.side!.w);
      expect(Math.abs(leftRoom - rightRoom), c.name).toBeLessThan(0.06 * L.band.w);
      expect(L.u, c.name).toBeGreaterThan(1.3);
      expect(L.u, c.name).toBeLessThanOrEqual(DESK_MAX);
    }
  });

  it('grows the words with the screen on a desktop; a phone’s stop where they did', () => {
    const big = layout(1587, 1300, { top: 118, right: 0, bottom: 0, left: 0 }, false);
    expect(tu(big, 1.2)).toBeCloseTo(big.u, 6);
    expect(15 * tu(big, 1.2)).toBeGreaterThanOrEqual(1.5 * 15);
    const tablet = layout(820, 1052, CHECK_SIZES[6].insets, true);
    expect(tu(tablet, 1.2)).toBeCloseTo(Math.min(tablet.u, 1.2), 6);
    const phone = layout(360, 500, CHECK_SIZES[0].insets);
    expect(tu(phone, 1.15)).toBe(1);
  });

  it('keeps the card’s answers finger-sized and in place at every desk size', () => {
    for (const c of desks) {
      const L = layout(c.w, c.h, c.insets, false);
      const ts = tapTargets(L, { card: 'ask' });
      expect(auditTargets(ts, c.w, c.h, c.insets), c.name).toEqual([]);
    }
  });

  it('shows the part a click would act on (hoverAt), the same that a click then chooses', () => {
    const sim = later();
    const g = sim.vision!.geo;
    const far = g.cells.reduce((b, c) => (c.heartD > g.cells[b].heartD ? c.id : b), 0);
    sim.take();
    const target = sim.target;
    expect(sim.hoverAt(g.cells[far].cx, g.cells[far].cy)).toBe(far);
    expect(sim.take()).toEqual([]);
    expect(sim.target).toBe(target);
    sim.tapAt(g.cells[far].cx, g.cells[far].cy);
    expect(sim.target).toBe(far);
    const clock = { t: 0 };
    drive(sim, 14, HIGH, clock);
    const lit = sim.lit.findIndex(Boolean);
    expect(lit).toBeGreaterThanOrEqual(0);
    if (sim.pushBlock) expect(sim.lit[sim.hoverAt(g.cells[lit].cx, g.cells[lit].cy)]).toBe(false);
    until(sim, 'rest', HIGH, clock);
    const litNow = sim.lit.findIndex(Boolean);
    expect(sim.hoverAt(g.cells[litNow].cx, g.cells[litNow].cy)).toBe(litNow);
  });
});

describe('the preparation (prep.ts)', () => {
  /** A w × h picture: a bright disc on a dark ground (its detail is the disc's rim). */
  function disc(cx = 300, cy = 350, r = 90, w: number = RULES.PW, h: number = RULES.PH): Pixels {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, inside = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      data[o] = inside ? 250 : 30; data[o + 1] = inside ? 220 : 40; data[o + 2] = inside ? 120 : 90; data[o + 3] = 255;
    }
    return { width: w, height: h, data };
  }
  const analysis = (px: Pixels, shape: 'arch' | 'rect', heart = { x: px.width / 2, y: px.height / 2 }) =>
    ({ key: 'own:x', decl: null, ownId: 'x', word: 'w', shape, w: px.width, h: px.height, picture: null, px, edges: edgeMap(px), sketch: null, heart, photo: null, crop: null } as unknown as Analysis);

  it('finds a photo’s heart at its detail, pulled toward the middle', () => {
    const px = disc(200, 260, 70);
    const heart = heartOf(edgeMap(px), px.width, px.height);
    expect(heart.x).toBeGreaterThan(200);
    expect(heart.x).toBeLessThan(300);
    expect(heart.y).toBeGreaterThan(260);
    expect(heart.y).toBeLessThan(370);
    const flat = { width: 600, height: 700, data: new Uint8ClampedArray(600 * 700 * 4).fill(128) };
    expect(heartOf(edgeMap(flat), 600, 700)).toEqual({ x: 300, y: 364 });
  });

  it('cuts the picture denser around its heart, and the same vision a little differently session by session', () => {
    const px = disc();
    const p = cut(analysis(px, 'arch', { x: 300, y: 350 }), 60, seedOf('own:x', 1));
    expect(p.geo.cells.length).toBeGreaterThan(50);
    expect(p.geo.cells.length).toBeLessThan(70);
    expect(p.colors).toHaveLength(p.geo.cells.length);
    const near = p.geo.cells.filter(c => c.heartD < 150), far = p.geo.cells.filter(c => c.heartD > 300);
    const mean = (xs: typeof near) => xs.reduce((s, c) => s + c.area, 0) / Math.max(1, xs.length);
    expect(near.length).toBeGreaterThan(2);
    expect(mean(near)).toBeLessThan(mean(far));
    expect(p.geo.frags.length).toBeGreaterThanOrEqual(RULES.fragMin);
    expect(seedOf('own:x', 1)).not.toBe(seedOf('own:x', 2));
    expect(seedOf('own:x', 1)).toBe(seedOf('own:x', 1));
  });

  it('cuts an own photo over its own rectangle, keeping exactly the cells asked for, up to 144', () => {
    for (const asp of [9 / 16, 1, 16 / 9]) {
      const sp = photoSpace(asp);
      const px = disc(sp.w / 2, sp.h / 2, 80, sp.w, sp.h);
      for (const n of [48, 144]) {
        const p = cut(analysis(px, 'rect'), n, seedOf('own:x', 2));
        expect(p.geo.shape).toBe('rect');
        expect(p.geo.w).toBe(sp.w);
        expect(p.geo.cells.length, `${asp} ${n}`).toBe(n);
      }
    }
  });
});

describe('the lobby’s card (panel.ts)', () => {
  const buttons = (root: HTMLElement) => [...root.querySelectorAll('button')];

  it('puts “Dodaj własny obraz” first: the kit’s picker for every popular format, a drop zone, a paste', () => {
    const p = freshProgress();
    const root = progressPanel(p, () => undefined);
    document.body.appendChild(root);
    const first = root.firstElementChild as HTMLElement;
    expect(first.getAttribute('data-own')).toBe('add');
    expect(first.textContent).toContain(t('panel.ownAdd'));
    const input = first.querySelector('input[type="file"]')!;
    expect(input.getAttribute('accept')).toBe(IMAGE_ACCEPT);
    expect(first.querySelector('label.img-pick')!.className).toContain('primary');
    // a file dragged over the card lights the drop zone
    const enter = new Event('dragenter', { cancelable: true }) as Event & { dataTransfer: unknown };
    Object.defineProperty(enter, 'dataTransfer', { value: { types: ['Files'], files: [], items: [] } });
    first.dispatchEvent(enter);
    expect(first.classList.contains('img-drop-on')).toBe(true);
    root.remove();
  });

  it('after a pick: the picture is chosen for the next session at once; a failure says why', async () => {
    const p = freshProgress();
    let changed = 0;
    const said: string[] = [];
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    await addOwnPicture(p, file, () => { changed++; }, s => said.push(s.text),
      (game, role, f, lab) => putImage({ game: `${game}-t`, role, label: lab ?? '', w: 800, h: 600, blob: f }));
    expect(said[0]).toBe(t('panel.ownBusy'));
    expect(p.own).toHaveLength(1);
    expect(nextVision(p)).toBe(ownKey(p.own[0].id));
    expect(changed).toBe(1);
    expect((await getImage(p.own[0].id))?.w).toBe(800);
    const q = freshProgress();
    await addOwnPicture(q, new File(['x'], 'notes.txt', { type: 'text/plain' }), () => undefined, () => undefined);
    expect(q.own).toHaveLength(0);
    expect(nextVision(q)).toBe(declKey(DECL_ORDER[0]));
  });

  it('asks the Polish form once, opens the chooser (an own-picture tile first), chooses and pins a vision, and shows the album', () => {
    const p = freshProgress();
    let saved = 0;
    const root = progressPanel(p, () => { saved++; });
    expect(root.textContent).toContain(t('panel.form'));
    expect(root.textContent).toContain(sentence(declWord('kochany', null)));
    const fem = buttons(root).find(b => b.textContent === label('kochana'))!;
    fem.click();
    expect(p.form).toBe('f');
    expect(saved).toBe(1);
    expect(root.textContent).toContain(sentence('kochana'));
    buttons(root).find(b => b.textContent === t('panel.choose'))!.click();
    const tiles = [...root.querySelectorAll('.arcade-album [role="button"]')] as HTMLElement[];
    expect(tiles).toHaveLength(19);
    expect(tiles[0].textContent).toContain(t('panel.ownPick'));
    tiles[3].click();
    expect(p.next).toBe(`decl:${DECL_ORDER[2]}`);
    expect(root.textContent).toContain(sentence(declWord(DECL_ORDER[2], 'f')));
    buttons(root).find(b => b.textContent === t('panel.pin'))!.click();
    expect(p.pin).toBe(`decl:${DECL_ORDER[2]}`);
    expect(p.next).toBeNull();
    buttons(root).find(b => b.textContent === t('panel.auto'))!.click();
    expect(p.pin).toBeNull();
    const album = root.querySelectorAll('.arcade-album');
    expect(album[album.length - 1].children).toHaveLength(18);
    expect(saved).toBeGreaterThanOrEqual(4);
  });
});

describe('the Polish form', () => {
  it('asks with a word that changes with the form (a noun declaration asks with “silny / silna”)', () => {
    expect(formSample('kochany')).toBe('kochany');
    expect(formSample('dziecko')).toBe('silny');
    expect(formSample('swiatlo')).toBe('silny');
    expect(formSample('nowy')).toBe('silny');
    expect(formSample(null)).toBe('silny');
    for (const id of DECL_ORDER) expect(declWord(formSample(id), 'm')).not.toBe(declWord(formSample(id), 'f'));
  });
});
