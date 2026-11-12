import { describe, expect, it } from 'vitest';
import {
  DECLS, DECL_ORDER, FRAG_KEYS, LINES, LINE_COUNT, MOMENTS, OWN_VERSE, cleanWord, declWord, formSample, label, sentence,
} from '../src/arcade/jestem/content';
import { CATALOGS, t, unit } from '../src/arcade/jestem/i18n';
import {
  addOwn, chooseNext, declKey, dropOwn, freshProgress, migrate, nextNew, nextPace, nextVision, ownKey, pinVision, planCells, receive,
  received, type JestemProgress,
} from '../src/arcade/jestem/meta';
import { RULES } from '../src/arcade/jestem/rules';
import { SCENES, inPolygon, type DeclId } from '../src/arcade/jestem/scenes';
import { JestemSim, finaleFor, planBlocks, pourRate, pourSecOf, type SimEvent, type SimVision } from '../src/arcade/jestem/sim';
import { ARCH_H, autoNext, buildVision, inWindow, pickAt, type VisionGeo } from '../src/arcade/jestem/vision';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { coachText, howto } from '../src/arcade/jestem/index';
import { formButtons, layout, tapTargets, windowAt } from '../src/arcade/jestem/layout';
import { fitFont, font, fontPx } from '../src/arcade/jestem/paint';
import { edgeMap, makeMosaic, type Pixels } from '../src/arcade/kit/mosaic';
import { cut, heartOf, seedOf, type Analysis } from '../src/arcade/jestem/prep';
import { progressPanel } from '../src/arcade/jestem/panel';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-12';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.95 });
const LOW = frame({ level: 0.05, activity: -3, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const geoCache = new Map<string, VisionGeo>();
/** A declaration's vision cut into about `n` cells (the kit's mosaic over the picture's space; no canvas needed). */
function geoOf(id: DeclId = 'zdrowy', n = 30, seed = 5): VisionGeo {
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
const visionOf = (id: DeclId = 'zdrowy', n = 30): SimVision => ({ key: declKey(id), geo: geoOf(id, n), decl: id, word: declWord(id, 'm') });

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

const ALL_SEEN = ['tap', 'lit', 'oculus', 'rest', 'drag', 'pane', 'night', 'light'];
/** A returning player: no warm-up, no opening card, every coach mark seen. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], form: 'm', ...o.progress } });

function drive(sim: JestemSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run to the start of the next block of a kind (returns the clock). */
function until(sim: JestemSim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && sim.phase === 'play' && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

const inkSum = (sim: JestemSim) => sim.ink.reduce((s, v) => s + v, 0);

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up, alternates push and rest, ends on a rest and leaves the finale', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      const sum = plan.reduce((s, b) => s + b.dur, 0);
      expect(sum).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
    expect(finaleFor(300)).toBe(RULES.finale.long);
    expect(finaleFor(130)).toBe(RULES.finale.mid);
    expect(finaleFor(40)).toBe(RULES.finale.short);
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later({ planned: 300 });
    const b = sim.block;
    expect(b.kind).toBe('push');
    const evs = drive(sim, b.dur - 2, frame());
    expect(sim.telegraphed).toBe(true);
    expect(ofType(evs, 'telegraph')[0].next!.kind).toBe('rest');
  });

  it('makes every 4th push blind (the night) from the 3rd session, never the first push of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock);
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
    const fresh = makeSim({ planned: 600, progress: { sessions: 1, pushes: 3 } });
    expect(fresh.plan.every(b => !b.blind)).toBe(true);
  });

  it('cuts the window into as many cells as the player can colour: 24…64, more for longer sessions and a quicker pace', () => {
    expect(planCells(RULES.pace0, 10)).toBe(RULES.cellsMin);
    expect(planCells(RULES.paceMax, 9999)).toBe(RULES.cellsMax);
    const p3 = planCells(RULES.pace0, pourSecOf(planBlocks(180, false, mulberry32(1))));
    const p5 = planCells(RULES.pace0, pourSecOf(planBlocks(300, false, mulberry32(1))));
    const p10 = planCells(RULES.pace0, pourSecOf(planBlocks(600, false, mulberry32(1))));
    expect(p3).toBeGreaterThanOrEqual(24);
    expect(p5).toBeGreaterThan(p3);
    expect(p10).toBeGreaterThan(p5);
    expect(planCells(RULES.pace0 * 1.5, 150)).toBeGreaterThan(planCells(RULES.pace0, 150));
    // the pace follows the sessions, a short one barely
    expect(nextPace(RULES.pace0, 60, 120)).toBeGreaterThan(RULES.pace0);
    expect(nextPace(RULES.pace0, 5, 120)).toBeLessThan(RULES.pace0);
    expect(Math.abs(nextPace(RULES.pace0, 30, 3) - RULES.pace0)).toBeLessThan(0.01);
  });
});

describe('the vision', () => {
  it('keeps the cells inside the arched window, each with its capacity, neighbours and a named fragment', () => {
    const g = geoOf('zdrowy', 36);
    expect(g.cells.length).toBeGreaterThanOrEqual(30);
    expect(g.cells.length).toBeLessThanOrEqual(40);
    for (const c of g.cells) {
      expect(inWindow(c.cx, c.cy)).toBe(true);
      expect(c.cap).toBeGreaterThanOrEqual(RULES.capMin);
      expect(c.cap).toBeLessThanOrEqual(RULES.capMax);
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

  it('cuts every picture into named fragments, its heart inside the window', () => {
    for (const id of DECL_ORDER) {
      const g = geoOf(id, 40, 9);
      expect(g.frags.length, id).toBeGreaterThanOrEqual(3);
      expect(inWindow(g.heart.x, g.heart.y), id).toBe(true);
      for (const f of g.frags) expect(t(`frag.${f.key}` as never), `${id}: ${f.key}`).not.toMatch(/^frag\./);
    }
  });

  it('flows from the heart outward, finishing a fragment before the next', () => {
    const g = geoOf('zdrowy', 36);
    const lit = g.cells.map(() => false), ink = g.cells.map(() => 0);
    const first = autoNext(g, lit, ink, -1);
    const nearest = g.cells.reduce((b, c) => (c.heartD < g.cells[b].heartD ? c.id : b), 0);
    expect(first).toBe(nearest);
    // light the whole first fragment except one cell: the next is that cell
    const f = g.cells[first].frag;
    const cells = g.frags[f].cells;
    for (const id of cells.slice(0, -1)) lit[id] = true;
    if (cells.length > 1) expect(autoNext(g, lit, ink, f)).toBe(cells.at(-1));
    // a tap picks the cell under the finger, else the nearest unlit one
    const c = g.cells[5];
    expect(pickAt(g, g.cells.map(() => false), c.cx, c.cy)).toBe(5);
    const all = g.cells.map(x => x.id !== 7);
    expect(pickAt(g, all, 0, 0)).toBe(7);
  });

  it('clusters an own photo into 3…6 fragments ordered from its heart', () => {
    const m = makeMosaic(RULES.PW, RULES.PH, 40, mulberry32(4), { relax: 2 });
    const colors = m.cells.map(c => (c.cy < RULES.PH * 0.4 ? { r: 90, g: 140, b: 230 } : { r: 60, g: 160, b: 70 }));
    const g = buildVision(m, { heart: { x: RULES.PW / 2, y: RULES.PH / 2 }, colors });
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

describe('colour and light', () => {
  it('pours at the base without control and wider above the threshold, after the band’s lead-in', () => {
    expect(pourRate(0)).toBeCloseTo(RULES.baseRate, 6);
    expect(pourRate(0.5)).toBeGreaterThan(RULES.baseRate * 1.6);
    expect(pourRate(0.95)).toBeGreaterThan(pourRate(0.5) * 1.5);
    const hi = later(), lo = later(), none = later();
    drive(hi, 3, HIGH);
    drive(lo, 3, LOW);
    // the lead-in: the band has not answered yet
    expect(inkSum(hi)).toBeCloseTo(inkSum(lo), 5);
    drive(hi, 15, HIGH);
    drive(lo, 15, LOW);
    drive(none, 18, NONE);
    expect(inkSum(hi)).toBeGreaterThan(inkSum(lo) * 2);
    // no signal: the base flow, never less
    expect(inkSum(none)).toBeCloseTo(inkSum(lo), 1);
    expect(hi.score).toBeGreaterThan(lo.score);
  });

  it('lights a full cell, counts it, and joins a whole fragment into one pane', () => {
    const sim = later();
    const evs = drive(sim, 25, HIGH);
    const lit = ofType(evs, 'lit');
    expect(lit.length).toBeGreaterThan(3);
    expect(sim.score).toBe(lit.length);
    expect(lit.every(e => e.by === 'player')).toBe(true);
    for (const e of lit) expect(sim.lit[e.cell]).toBe(true);
    // keep pouring: fragments fill one by one
    const more = drive(sim, 200, HIGH);
    expect(ofType(more, 'fragment').length).toBeGreaterThan(0);
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
  it('a tap sends the colour to the cell under the finger and drops a little colour; a tap on the light finds the nearest unlit cell', () => {
    const sim = later();
    const g = sim.vision!.geo;
    const far = g.cells.reduce((b, c) => (c.heartD > g.cells[b].heartD ? c.id : b), 0);
    expect(sim.tapAt(g.cells[far].cx, g.cells[far].cy)).toBe(true);
    expect(sim.target).toBe(far);
    expect(sim.ink[far]).toBeCloseTo(RULES.splash, 6);
    // a second tap at once is held by the cooldown
    sim.tapAt(g.cells[far].cx, g.cells[far].cy);
    expect(sim.ink[far]).toBeCloseTo(RULES.splash, 6);
    drive(sim, RULES.splashCool + 0.05, LOW);
    const before = sim.ink[far];
    sim.key(' ', true);
    expect(sim.ink[far]).toBeGreaterThan(before + RULES.splash * 0.9);
    // the colour stays where it was poured: switching never loses any
    const kept = sim.ink[far];
    const near = g.cells.find(c => c.id !== far && !sim.lit[c.id])!;
    sim.tapAt(near.cx, near.cy);
    expect(sim.ink[far]).toBeCloseTo(kept, 6);
  });

  it('a drag lays a path the colour follows, cell after cell', () => {
    const sim = later();
    const g = sim.vision!.geo;
    const path = g.cells.slice(-4).map(c => c.id);
    sim.setPath(path);
    expect(sim.target).toBe(path[0]);
    const evs = drive(sim, 40, HIGH);
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
    drive(sim, 0.5, LOW, clock);
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

  it('scores within 22 s with no input at all (the opening card closes by itself)', () => {
    const sim = makeSim({ ask: true });
    drive(sim, 22, MID);
    expect(sim.score).toBeGreaterThan(0);
  });

  it('opens the first session with the card, asks the Polish form, and teaches with coach marks', () => {
    const sim = makeSim({ ask: true });
    expect(sim.block.kind).toBe('warmup');
    expect(sim.story).not.toBeNull();
    sim.chooseForm('f');
    expect(sim.p.form).toBe('f');
    expect(sim.story).toBeNull();
    const evs = drive(sim, 60, HIGH);
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('lit');
    const shown = makeSim({ ask: true, progress: { form: 'm' } });
    expect(shown.story?.ask).toBe(false);
  });
});

describe('night, rays and rings', () => {
  it('keeps what focus adds in the dark and pours it at dawn', () => {
    const run = (f: FocusFrame) => {
      const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
      const clock = { t: 0 };
      while (!(sim.pushBlock && sim.blind) && clock.t < 400) drive(sim, 0.25, MID, clock);
      expect(sim.blind).toBe(true);
      expect(sim.meter()).toBeNull();
      expect(sim.padLevel(f)).toBeNull();
      const before = inkSum(sim) + sim.score;
      const evs = drive(sim, sim.block.dur - sim.blockT + 0.1, f, clock);
      return { sim, evs, before };
    };
    const hi = run(HIGH), lo = run(LOW);
    const dawnHi = ofType(hi.evs, 'dawn')[0], dawnLo = ofType(lo.evs, 'dawn')[0];
    expect(dawnHi).toBeDefined();
    expect(dawnHi.cells.length).toBeGreaterThan(dawnLo.cells.length);
    expect(dawnHi.share).toBeGreaterThan(0.8);
    expect(hi.sim.nightShare).toBeGreaterThan(80);
    expect(hi.sim.result().stats.map(s => s[0])).toContain(t('stat.night'));
  });

  it('leaves a ray for a passed push and a ring for a passed rest, never taking one away', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = [...drive(sim, sim.block.dur + 0.1, HIGH, clock)];
    expect(ofType(evs, 'ray').length).toBe(1);
    evs.push(...drive(sim, sim.block.dur + 0.1, CALM, clock));
    expect(ofType(evs, 'ring').length).toBe(1);
    const rays = sim.rays;
    drive(sim, sim.block.dur + 0.1, LOW, clock);
    expect(sim.rays).toBe(rays);
    // no signal: no verdict either way
    const none = later();
    const e2 = drive(none, none.block.dur + 0.1, NONE);
    expect(ofType(e2, 'blockEnd')[0].verdict).toBeNull();
  });
});

describe('the whole vision and the finale', () => {
  it('turns to the light pass once every cell is lit: a push pours light', () => {
    const sim = later({ vision: visionOf('wolny', 24) });
    const clock = { t: 0 };
    const evs = drive(sim, 200, HIGH, clock);
    expect(ofType(evs, 'complete').length).toBe(1);
    expect(sim.complete).toBe(true);
    expect(sim.score).toBe(sim.cells);
    until(sim, 'push', HIGH, clock);
    sim.glow.fill(0.2);
    const g = sim.glowMean;
    drive(sim, 10, HIGH, clock);
    expect(sim.lighting).toBe(true);
    expect(sim.glowMean).toBeGreaterThan(g);
  });

  it('fills what is still unlit with light at the finale, counting only the player’s pieces', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    const evs = drive(sim, 200, LOW, clock);
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

  it('gives result() idempotently, the record only with Math.max, and the album once', () => {
    const sim = later({ planned: 180, progress: { best: 3 } });
    drive(sim, 60, HIGH);
    const a = sim.result();
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(a.record).toBe(a.score > 3);
    expect(sim.p.best).toBe(Math.max(3, a.score));
    drive(sim, 200, HIGH);
    sim.result();
    sim.finish();
    sim.result();
    expect(sim.p.album.zdrowy?.n).toBe(1);
    expect(sim.p.total).toBe(sim.score);
    expect(sim.p.sessions).toBe(6);
    const again = later({ planned: 180, progress: { ...sim.p } });
    drive(again, 200, MID);
    expect(again.p.album.zdrowy?.n).toBe(2);
    expect(again.result().highlights.join(' ')).toContain(t('hl.again', { n: 2 }));
  });

  it('settles a session ended early: the declaration is received, the choice for it used', () => {
    const p = { ...freshProgress(), sessions: 2, seen: [...ALL_SEEN] };
    chooseNext(p, declKey('madry'));
    expect(nextVision(p)).toBe('decl:madry');
    const sim = makeSim({ progress: p, vision: visionOf('madry', 24) });
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
    sim.setVision(visionOf('silny', 30));
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
    chooseNext(p, ownKey('img-1'));
    expect(nextVision(p)).toBe('own:img-1');
    expect(receive(p, { key: ownKey('img-1'), lit: 12, rays: 1, rings: 0, day: DAY })).toBe(1);
    expect(p.own[0]).toMatchObject({ id: 'img-1', n: 1, best: 12 });
    dropOwn(p, 'img-1');
    expect(p.own).toHaveLength(0);
    expect(nextVision(p)).toBe('decl:silny');
  });

  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and keeps the count', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as JestemProgress);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.album).toEqual({});
    expect(p.pace).toBe(RULES.pace0);
    expect(migrate(p)).toBe(p);
    const sim = makeSim({ progress: p });
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
  });

  it('repairs fields of a wrong type and survives garbage', () => {
    const saved = {
      ver: 1, sessions: '7', pushes: 9, form: 'x', pin: 'decl:nope', next: 'own:gone', pace: 99, best: -4, total: 30,
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
    expect(p.cells).toBe(RULES.cellsMax);
    expect(p.seen).toEqual(['tap']);
    expect(p.last).toBe('decl:silny');
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { album: [], own: {}, seen: 'x' }]) {
      const q = migrate(mergeSaved(freshProgress(), junk) as JestemProgress);
      expect(q.ver).toBe(1);
      expect(Array.isArray(q.own)).toBe(true);
      expect(q.album).toEqual({});
    }
  });

  it('keeps an own word plain and short', () => {
    expect(cleanWord('  spokojny\n\tw sercu  ')).toBe('spokojny w sercu');
    expect(cleanWord('<b>silny</b>')).toBe('b silny /b');
    expect([...cleanWord('x'.repeat(60))].length).toBe(24);
    expect(cleanWord(42)).toBe('');
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('says each declaration in the speaker’s form, with a verse that exists, in the founder’s sentence', () => {
    expect(declWord('silny', 'm')).toBe('silny');
    expect(declWord('silny', 'f')).toBe('silna');
    expect(declWord('zwyciezca', 'f')).toBe('zwyciężczynią');
    expect(declWord('dziecko', null)).toBe('dzieckiem Bożym');
    expect(sentence('silny')).toBe('Przez potężne imię Jezusa ja jestem silny.');
    expect(label('silna')).toBe('jestem silna');
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

  it('gives Hanna at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
    expect(LINE_COUNT).toBeGreaterThan(55);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
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
      // (a word that ends in -łeś / -łaś; JavaScript's \b does not know Polish letters)
      expect(v.split(/[\s.,!?;:…—–-]+/).filter(w => /(łeś|łaś)$/.test(w)), k).toEqual([]);
      expect(v, k).not.toMatch(/\b(będziesz zdrow|wyzdrowiejesz|uzdrowi Cię|staniesz się bogat)/i);
    }
  });

  it('suggests strategies, never to concentrate harder', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip|task|howto)\./.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
  });

  it('bends the headline’s unit', () => {
    expect(unit(1)).toBe('część');
    expect(unit(3)).toBe('części');
    expect(unit(5)).toBe('części');
    expect(t('pieces', { n: 22 })).toBe('22 części');
  });
});

/** The size in a canvas font string. */
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);

/** A canvas context that measures text as 0.6 em per character (enough to test fitting). */
function measuring(): CanvasRenderingContext2D {
  const ctx = { font: '10px sans-serif', measureText(text: string) { return { width: text.length * pxOf(this.font) * 0.6 } as TextMetrics; } };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('mobile first (DESIGN §12, §13.8)', () => {
  it('keeps the window and its oculus inside the band under the HUD, at every checked size', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.win.x, c.name).toBeGreaterThanOrEqual(c.insets.left - 0.5);
      expect(L.win.x + L.win.w, c.name).toBeLessThanOrEqual(c.w - c.insets.right + 0.5);
      expect(L.win.y + L.win.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
      expect(L.oculus.y - L.oculus.r * 1.2, c.name).toBeGreaterThanOrEqual(c.insets.top - 0.5);
      expect(L.oculus.r, c.name).toBeGreaterThanOrEqual(15);
      expect(L.win.w / L.win.h).toBeCloseTo(RULES.PW / RULES.PH, 5);
      // the window is as large as the band allows: most of its height (or its width on a narrow phone)
      expect(Math.max(L.win.h / L.band.h, L.win.w / L.band.w), c.name).toBeGreaterThan(0.75);
      // the finale's words have room
      expect(L.finText.w, c.name).toBeGreaterThan(150);
      expect(L.finText.h, c.name).toBeGreaterThan(50);
      expect(L.finText.y + L.finText.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
    }
  });

  it('puts the window under a centre tap on a desktop (the smoke test taps at the middle, 60 % down)', () => {
    for (const c of CHECK_SIZES.filter(x => x.w >= 1000)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode).toBe('wide');
      expect(c.w / 2).toBeGreaterThan(L.win.x);
      expect(c.w / 2).toBeLessThan(L.win.x + L.win.w);
      expect(c.h * 0.6).toBeGreaterThan(L.win.y);
      expect(c.h * 0.6).toBeLessThan(L.win.y + L.win.h);
      expect(L.side).not.toBeNull();
      expect(L.side!.x).toBeGreaterThan(L.win.x + L.win.w);
      expect(L.side!.x + L.side!.w).toBeLessThanOrEqual(c.w - c.insets.right);
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
      // the window takes the band's width on a narrow phone
      expect(L.win.w, c.name).toBeGreaterThan(c.w * 0.7);
      // the finale lifts the window over the words
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

  it('never draws text under 11 px: the font helper has a floor, fitting never shrinks under it', () => {
    for (const px of [0, 3, 6.4, 8, 10.4, 10.99, 11, 12.3, 13, 30]) expect(pxOf(font(px))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fontPx(4)).toBe(MIN_TEXT);
    expect(pxOf(font(14.2, 600, true))).toBe(14);
    const ctx = measuring();
    expect(fitFont(ctx, 'Przez potężne imię Jezusa ja jestem zwyciężczynią.', 40, 30, 6)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fitFont(ctx, 'Taniec', 300, 21, 13)).toBe(21);
    expect(MIN_READ).toBe(13);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|klick|click|mysz[ąy]|mouse|maus/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['howto.goal', 'howto.tap', 'howto.drag', 'coach.tap', 'coach.drag', 'coach.lit', 'coach.oculus', 'story.tap']) {
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
  });
});

describe('the preparation (prep.ts)', () => {
  /** A 600 × 700 picture: a bright disc on a dark ground (its detail is the disc's rim). */
  function disc(cx = 300, cy = 350, r = 90): Pixels {
    const w = RULES.PW, h = RULES.PH, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, inside = (x - cx) ** 2 + (y - cy) ** 2 < r * r;
      data[o] = inside ? 250 : 30; data[o + 1] = inside ? 220 : 40; data[o + 2] = inside ? 120 : 90; data[o + 3] = 255;
    }
    return { width: w, height: h, data };
  }

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
    const a = { key: 'own:x', decl: null, ownId: 'x', word: 'w', picture: null, px, edges: edgeMap(px), sketch: null, heart: { x: 300, y: 350 }, photo: null, crop: null } as unknown as Analysis;
    const p = cut(a, 40, seedOf('own:x', 1));
    expect(p.geo.cells.length).toBeGreaterThan(30);
    expect(p.geo.cells.length).toBeLessThan(50);
    expect(p.colors).toHaveLength(p.geo.cells.length);
    const near = p.geo.cells.filter(c => c.heartD < 150), far = p.geo.cells.filter(c => c.heartD > 300);
    const mean = (xs: typeof near) => xs.reduce((s, c) => s + c.area, 0) / Math.max(1, xs.length);
    expect(near.length).toBeGreaterThan(2);
    expect(mean(near)).toBeLessThan(mean(far));
    expect(p.geo.frags.length).toBeGreaterThanOrEqual(RULES.fragMin);
    expect(seedOf('own:x', 1)).not.toBe(seedOf('own:x', 2));
    expect(seedOf('own:x', 1)).toBe(seedOf('own:x', 1));
  });
});

describe('the lobby’s card (panel.ts)', () => {
  const buttons = (root: HTMLElement) => [...root.querySelectorAll('button')];

  it('asks the Polish form once, opens the chooser, chooses and pins a vision, and shows the album of eighteen', () => {
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
    expect(tiles).toHaveLength(18);
    tiles[2].click();
    expect(p.next).toBe(`decl:${DECL_ORDER[2]}`);
    expect(root.textContent).toContain(sentence(declWord(DECL_ORDER[2], 'f')));
    buttons(root).find(b => b.textContent === t('panel.pin'))!.click();
    expect(p.pin).toBe(`decl:${DECL_ORDER[2]}`);
    expect(p.next).toBeNull();
    buttons(root).find(b => b.textContent === t('panel.auto'))!.click();
    expect(p.pin).toBeNull();
    // the album: the eighteen, in pencil until received
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
