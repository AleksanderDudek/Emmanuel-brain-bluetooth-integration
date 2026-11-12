import { describe, expect, it } from 'vitest';
import { CARDS, CARD_IDS, LESIONS, LINE_COUNT, MOMENTS, NICHES, lines, type LesionKind } from '../src/arcade/odnowa/content';
import { CATALOGS, atpText, t, unit } from '../src/arcade/odnowa/i18n';
import {
  bestOf, enzymeLevel, freshProgress, levelOf, lysoLevel, migrate, mitoLevel, nicheOpen, patchOf, sessionNiche, traitState,
  type OdnowaProgress,
} from '../src/arcade/odnowa/meta';
import { RULES, need } from '../src/arcade/odnowa/rules';
import { OdnowaSim, finaleFor, gradOf, planBlocks, recipe, spinOf, stepSec, type SimEvent } from '../src/arcade/odnowa/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { CHORUS_BEATS, lineAt, seriesChorus, songProblems } from '../src/arcade/kit/song';
import { buildSong, verseBeats } from '../src/arcade/odnowa/song';
import { laneU, laneX, layout, onLane, onLens, tapTargets } from '../src/arcade/odnowa/layout';
import { font, fontPx } from '../src/arcade/odnowa/paint';
import { coachText, howto } from '../src/arcade/odnowa/index';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const LOW = frame({ level: 0.05, activity: -3, calm: 0.95 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['lane', 'turbine', 'recipe', 'gauge', 'two', 'rest', 'drag', 'surge', 'check', 'blind'];

type SimOpts = { progress?: Partial<OdnowaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; niche?: 'gut' | 'skin' | 'blood' };

function makeSim(o: SimOpts = {}): OdnowaSim {
  const p = migrate({ ...freshProgress(), ...o.progress } as OdnowaProgress);
  const sim = new OdnowaSim({ progress: p, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, niche: o.niche });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, every coach mark seen). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: OdnowaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Run to the next block of a kind (returns the clock). */
function until(sim: OdnowaSim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

/** Mend every lesion that needs a tap (a diligent player). */
const tapAll = (sim: OdnowaSim) => () => { for (let k = 0; k < 4 && sim.openLesions.length; k++) sim.repairNext(); };

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up, alternates pushes and rests and ends on a rest', () => {
    const plan = planBlocks(300, true, mulberry32(3));
    expect(plan[0].kind).toBe('warmup');
    expect(plan[0].dur).toBe(RULES.warm.long);
    const rest = plan.slice(1);
    rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
    expect(rest[rest.length - 1].kind).toBe('rest');
    const total = plan.reduce((s, b) => s + b.dur, 0);
    expect(total).toBeCloseTo(300 - finaleFor(300), 5);
    for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    const p = planBlocks(40, true, mulberry32(1));
    expect(p.map(b => b.kind)).toEqual(['warmup', 'push', 'rest']);
    for (const sec of [10, 15, 25, 40, 60, 90, 180, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(sec, first, mulberry32(sec));
        expect(plan.length).toBeGreaterThanOrEqual(2);
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later();
    expect(sim.block.kind).toBe('push');
    const clock = { t: 0 };
    const evs = drive(sim, sim.block.dur - 1, MID, clock);
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
    expect(sim.telegraphed).toBe(true);
    drive(sim, 2, MID, clock);
    expect(sim.block.kind).toBe('rest');
  });

  it('makes every 4th push blind from the 3rd session, never the first push of a session', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 } });
    expect(sim.block.blind).toBe(false);
    const clock = { t: 0 };
    let blind = 0;
    while (sim.phase === 'play' && clock.t < 300) {
      drive(sim, 1, MID, clock);
      if (sim.blind) blind++;
    }
    expect(blind).toBeGreaterThan(0);
    // the 2nd session never blinds
    const early = later({ progress: { sessions: 1, pushes: 2 } });
    const c2 = { t: 0 };
    let b2 = 0;
    while (early.phase === 'play' && c2.t < 300) {
      drive(early, 1, MID, c2);
      if (early.blind) b2++;
    }
    expect(b2).toBe(0);
  });

  it('judges each block once at its end from its last 15 s, and a calm rest leaves extra material', () => {
    const sim = later();
    const clock = until(sim, 'rest', HIGH);
    const mat0 = sim.material;
    const evs = drive(sim, sim.block.dur + 0.5, CALM, clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].block.kind).toBe('rest');
    expect(ends[0].verdict).toBe(true);
    expect(sim.passedRests).toBe(1);
    expect(sim.material).toBeGreaterThanOrEqual(mat0 + 2);
  });
});

describe('the engine: the gradient, the turbine, ATP', () => {
  it('turns 3 ATP out of every full turn, 8 protons a turn', () => {
    expect(RULES.atpPerTurn).toBe(3);
    expect(RULES.protonsPerTurn).toBe(8);
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 10, NONE, clock);
    expect(sim.atp).toBe(Math.floor(sim.angle * 3));
  });

  it('runs at the neutral pace without a signal, never slower in a push for a low reading, faster with focus', () => {
    const none = later(), low = later(), high = later();
    const c1 = { t: 0 }, c2 = { t: 0 }, c3 = { t: 0 };
    drive(none, 20, NONE, c1);
    drive(low, 20, LOW, c2);
    drive(high, 20, HIGH, c3);
    expect(none.grad).toBeCloseTo(RULES.gradNeutral, 2);
    expect(low.grad).toBeGreaterThanOrEqual(RULES.gradNeutral - 0.01);
    expect(high.grad).toBeGreaterThan(0.85);
    expect(high.spin).toBeGreaterThan(none.spin * 2);
    expect(high.atp).toBeGreaterThan(none.atp * 1.6);
    expect(low.atp).toBeGreaterThanOrEqual(none.atp - 1);
  });

  it('lets the band act only after the lead-in (5 s Mendi, 2 s HALO)', () => {
    const m = later(), e = later({ eeg: true });
    drive(m, 4, HIGH);
    drive(e, 4, HIGH);
    expect(m.sighted).toBe(false);
    expect(m.meter()).toBeNull();
    expect(e.sighted).toBe(true);
    expect(e.meter()).toBeGreaterThan(0.2);
  });

  it('maps the gauge onto the gradient with the neutral floor, and the gradient onto the spin', () => {
    expect(gradOf(0)).toBeCloseTo(RULES.gradNeutral, 5);
    expect(gradOf(1)).toBeCloseTo(1, 5);
    expect(spinOf(gradOf(0.5)) / spinOf(gradOf(0))).toBeGreaterThan(1.6);
    expect(spinOf(1)).toBeCloseTo(RULES.spinBase + RULES.spinK, 5);
  });

  it('idles in a rest: the turbine slows, ATP still comes', () => {
    const sim = later();
    const clock = until(sim, 'rest', HIGH);
    const a0 = sim.atp;
    drive(sim, 10, CALM, clock);
    expect(sim.grad).toBeLessThan(RULES.gradNeutral);
    expect(sim.atp).toBeGreaterThan(a0);
  });

  it('a tap on the turbine pushes it by one proton’s step (an eighth of a turn), at most every 0.3 s', () => {
    const sim = later();
    drive(sim, 0.5, NONE);
    const a0 = sim.angle;
    expect(sim.tapTurbine()).toBe('kick');
    expect(sim.tapTurbine()).toBeNull();
    drive(sim, 1, NONE);
    const spun = sim.angle - a0;
    expect(spun).toBeGreaterThan(sim.spin * 1 + 0.1);
    expect(sim.kicks).toBe(1);
  });

  it('adds the extra mitochondria of biogenesis: more ATP at the same focus', () => {
    const one = later(), four = later({ progress: { atpTotal: RULES.mitoAt[2] } });
    expect(four.mitoCount).toBe(3);
    drive(one, 20, MID);
    drive(four, 20, MID);
    expect(four.atp).toBeGreaterThan(one.atp * 1.5);
  });

  it('fills the full power from a held focus; a tap on the turbine releases it and mends every open lesion', () => {
    const sim = later();
    const clock = { t: 0 };
    let readyAt = -1;
    drive(sim, sim.block.dur - 1, HIGH, clock, t => { if (sim.ready && readyAt < 0) readyAt = t; });
    if (!sim.ready) {
      // a long push is not always enough: carry on into the next push
      until(sim, 'push', HIGH, clock);
      drive(sim, 20, HIGH, clock);
    }
    expect(sim.ready).toBe(true);
    // release at the start of a push, with damage on the helix
    until(sim, 'rest', HIGH, clock);
    until(sim, 'push', HIGH, clock);
    expect(sim.ready).toBe(true);
    const before = sim.openLesions.length;
    expect(sim.tapTurbine()).toBe('surge');
    expect(sim.surge).toBeGreaterThan(0);
    const evs = drive(sim, 2.5, HIGH, clock);
    if (before > 0) expect(ofType(evs, 'repaired').filter(e => e.by === 'surge').length).toBeGreaterThanOrEqual(Math.min(before, 1));
    expect(sim.spin).toBeGreaterThan(spinOf(1) * 1.5);
  });

  it('never fills the full power in a rest (repair streaks there stop just short), and a rest ends a running one', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    sim.charge = 0.98;
    drive(sim, 15, CALM, clock, () => { if (sim.openLesions.length) sim.repairNext(); });
    expect(sim.ready).toBe(false);
    expect(sim.charge).toBeLessThan(1);
    const run = later();
    run.charge = 0.999;
    const c2 = { t: 0 };
    drive(run, 8, HIGH, c2);
    expect(run.tapTurbine()).toBe('surge');
    const evs = drive(run, run.block.dur, HIGH, c2);
    expect(run.restBlock || run.surge === 0).toBe(true);
    expect(ofType(evs, 'surgeEnd').length).toBeGreaterThan(0);
  });

  it('releases a ready full power by itself after a while (never in a rest)', () => {
    const sim = later();
    sim.charge = 0.999;
    const clock = { t: 0 };
    drive(sim, 7, HIGH, clock);
    expect(sim.ready).toBe(true);
    drive(sim, RULES.surgeAuto + 0.5, HIGH, clock);
    expect(sim.ready).toBe(false);
    expect(sim.surgesNow).toBe(1);
  });
});

describe('the DNA lane', () => {
  it('brings damage in from the right as the scan moves on, and a tap sends a crew to the nearest', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = drive(sim, 12, NONE, clock);
    expect(ofType(evs, 'spawn').length).toBeGreaterThanOrEqual(2);
    const open = sim.openLesions;
    expect(open.length).toBeGreaterThan(0);
    const target = open[open.length - 1];
    expect(sim.tapLane(target.u + 0.2)).toBe(true);
    expect(target.state).toBe('fixing');
  });

  it('runs a base excision repair in the pathway’s order: glycosylase, APE1, polymerase β, ligase', () => {
    expect(LESIONS.oxo.stages[0]).toEqual(['glyco', 'ape1', 'polb', 'lig']);
    expect(LESIONS.abasic.stages[0]).toEqual(['ape1', 'polb', 'lig']);
    expect(LESIONS.dimer.stages).toEqual([['xpc', 'tfiih'], ['cut', 'fill', 'lig']]);
    expect(LESIONS.dsb.stages).toEqual([['ku'], ['lig4']]);
    const sim = later();
    const clock = { t: 0 };
    const l = sim.lesions[0];
    l.kind = 'oxo';
    sim.tapLane(l.u);
    const evs = drive(sim, 3, NONE, clock);
    const steps = ofType(evs, 'repairStep').filter(e => e.id === l.id).map(e => e.step);
    expect(steps).toEqual(['glyco', 'ape1', 'polb', 'lig']);
    expect(l.state).toBe('done');
    expect(ofType(evs, 'repaired').some(e => e.id === l.id && e.by === 'tap')).toBe(true);
    expect(ofType(evs, 'atpUse').length).toBeGreaterThan(0);
  });

  it('needs a second tap for a two-step repair (nucleotide excision, end joining)', () => {
    const sim = later();
    const clock = { t: 0 };
    const l = sim.lesions[0];
    l.kind = 'dimer';
    sim.tapLane(l.u);
    drive(sim, 2, NONE, clock);
    expect(l.state).toBe('wait');
    expect(sim.openLesions).toContain(l);
    sim.tapLane(l.u);
    drive(sim, 2.5, NONE, clock);
    expect(l.state).toBe('done');
  });

  it('stops the helix at the gate for an unrepaired lesion; the cell’s own crew mends it — nothing is lost', () => {
    const sim = later();
    const clock = { t: 0 };
    let gateSeen = false;
    const evs = drive(sim, 60, NONE, clock, () => { if (sim.atGate) gateSeen = true; });
    expect(gateSeen).toBe(true);
    expect(ofType(evs, 'gate').length).toBeGreaterThan(0);
    expect(ofType(evs, 'repaired').some(e => e.by === 'cell')).toBe(true);
    expect(sim.repairsNow).toBeGreaterThan(0);
  });

  it('scans faster on a clean helix: a diligent player checks more genome than an idle one', () => {
    const idle = later(), busy = later();
    drive(idle, 60, NONE);
    drive(busy, 60, NONE, { t: 0 }, tapAll(busy));
    expect(busy.scanned).toBeGreaterThan(idle.scanned * 1.4);
    expect(busy.tapRepairs).toBeGreaterThan(4);
  });

  it('chains taps into a combo that climbs and resets after a pause', () => {
    const sim = later();
    const clock = { t: 0 };
    let best = 0;
    drive(sim, 30, NONE, clock, () => { if (sim.openLesions.length) sim.repairNext(); best = Math.max(best, sim.combo); });
    expect(best).toBeGreaterThanOrEqual(3);
    expect(sim.maxCombo).toBe(best);
  });

  it('times the steps by the enzymes’ level and the gradient, slower for the cell’s crew, faster in full power', () => {
    expect(stepSec(1, 0.5, 'tap')).toBeLessThan(stepSec(0, 0.5, 'tap'));
    expect(stepSec(0, 1, 'tap')).toBeLessThan(stepSec(0, 0.3, 'tap'));
    expect(stepSec(0, 0.5, 'cell')).toBeGreaterThan(stepSec(0, 0.5, 'tap'));
    expect(stepSec(0, 0.5, 'surge')).toBeLessThan(stepSec(0, 0.5, 'tap'));
  });

  it('brings each niche its own damage: UV dimers in the skin, none in the gut', () => {
    const count = (niche: 'gut' | 'skin' | 'blood'): Record<LesionKind, number> => {
      const c: Record<LesionKind, number> = { oxo: 0, abasic: 0, dimer: 0, bulky: 0, dsb: 0 };
      const sim = later({ niche, planned: 600, seed: 9 });
      const evs = drive(sim, 240, NONE, { t: 0 }, tapAll(sim));
      for (const e of ofType(evs, 'spawn')) c[e.kind]++;
      return c;
    };
    const skin = count('skin'), gut = count('gut');
    expect(skin.dimer).toBeGreaterThan(0);
    expect(gut.dimer).toBe(0);
    expect(gut.bulky).toBeGreaterThan(0);
  });
});

describe('the clean-up: autophagy in a rest', () => {
  it('tags, wraps, carries and digests worn parts in a rest, giving building material back', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    const evs = drive(sim, sim.block.dur - 0.5, CALM, clock);
    expect(ofType(evs, 'part').length).toBeGreaterThan(0);
    expect(ofType(evs, 'sealed').length).toBeGreaterThan(0);
    expect(ofType(evs, 'recycled').length).toBeGreaterThan(0);
    expect(sim.material).toBeGreaterThan(0);
    expect(sim.partsNow).toBeGreaterThan(0);
  });

  it('wraps faster with calm, and at the neutral pace without a signal — never slower', () => {
    const wrapSpeed = (f: FocusFrame): number => {
      const sim = later();
      const clock = until(sim, 'rest', MID);
      drive(sim, 6, f, clock);
      const pt = sim.parts.find(p => p.phase === 'wrap');
      return pt ? pt.k : 1;
    };
    const calm = wrapSpeed(CALM), none = wrapSpeed(NONE), restless = wrapSpeed(HIGH);
    expect(calm).toBeGreaterThan(none);
    expect(restless).toBeGreaterThanOrEqual(none - 1e-9);
  });

  it('sends an autophagosome at once on a tap, or fuses it with the lysosome it is dropped on', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    let sent = false, dropped = false;
    drive(sim, sim.block.dur - 0.5, CALM, clock, () => {
      for (const p of sim.parts) {
        if ((p.phase === 'sealed' || p.phase === 'travel') && !sent) sent = sim.sendPart(p.id);
        else if ((p.phase === 'sealed' || p.phase === 'travel') && !dropped) {
          sim.holdPart(p.id, true);
          dropped = sim.dropPart(p.id, 1);
        }
      }
    });
    expect(sent).toBe(true);
    expect(sim.partsNow).toBeGreaterThan(0);
  });
});

describe('the division', () => {
  it('grows the recipe with the stages', () => {
    expect(recipe(1)).toEqual({ atp: RULES.atpNeed[0], mat: RULES.matNeed[0], scan: RULES.scanNeed[0] });
    expect(recipe(3).atp).toBeGreaterThan(recipe(2).atp);
    expect(recipe(99).atp).toBe(RULES.atpNeed[2]);
    expect(need(RULES.matNeed, 50, false)).toBe(RULES.matNeed[2]);
  });

  it('divides once energy, material and the scan are there and no damage is open; the daughter joins the tissue', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    const evs = drive(sim, 240, () => (sim.restBlock ? CALM : HIGH), clock, tapAll(sim));
    const divides = ofType(evs, 'divide');
    expect(divides.length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'mitosis').map(e => e.phase).slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(ofType(evs, 'cell').length).toBe(sim.divisionsNow);
    expect(sim.stage).toBe(sim.divisionsNow + 1);
    expect(sim.cellsNow.gut).toBe(sim.divisionsNow);
    // settled at the end: the tissue keeps them
    sim.finish();
    expect(sim.p.tissue.gut).toBe(sim.divisionsNow);
    expect(sim.p.divisions).toBe(sim.divisionsNow);
  });

  it('holds the division at the checkpoint while damage is open on the helix', () => {
    const sim = later();
    sim.stageAtp = 1000;
    sim.material = 100;
    sim.scan = 1000;
    const clock = { t: 0 };
    // damage on the helix: the checkpoint holds
    expect(sim.lesions.length).toBeGreaterThan(0);
    const evs = drive(sim, 0.2, NONE, clock);
    expect(ofType(evs, 'checkpoint')).toHaveLength(1);
    expect(sim.mitosis).toBeNull();
    // mend it all: the division begins
    let began = false;
    drive(sim, 15, NONE, clock, () => { tapAll(sim)(); if (sim.mitosis) began = true; });
    expect(began).toBe(true);
  });

  it('a session ended mid-division still counts the new cell', () => {
    const sim = later();
    sim.stageAtp = 1000;
    sim.material = 100;
    sim.scan = 1000;
    for (const l of sim.lesions) l.state = 'done';
    drive(sim, 1, NONE);
    expect(sim.mitosis).not.toBeNull();
    sim.finish();
    expect(sim.divisionsNow).toBe(1);
    expect(sim.p.tissue.gut).toBe(1);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER });
    let next = 0.65, space = 2;
    drive(sim, 22, HIGH, { t: 0 }, tt => {
      if (tt >= next) {
        next += 0.65;
        if (!sim.tap()) sim.repairNext() || sim.tapTurbine();
      }
      if (tt >= space) {
        space += 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
    });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.atp).toBeGreaterThan(20);
    expect(sim.repairsNow).toBeGreaterThan(0);
  });

  it('scores within 22 s with no input at all (the turbine turns; the opening card closes by itself)', () => {
    const sim = makeSim();
    drive(sim, 22, HIGH);
    expect(sim.atp).toBeGreaterThan(0);
  });

  it('opens the first session with the story card and teaches with coach marks, one at a time', () => {
    const sim = makeSim();
    expect(sim.story?.kind).toBe('open');
    expect(sim.block.kind).toBe('warmup');
    const evs = drive(sim, 60, MID, { t: 0 }, () => { if (sim.story && sim.story.t > 1) sim.tap(); });
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('lane');
    expect(coach).toContain('turbine');
    expect(coach).toContain('recipe');
    expect(new Set(coach).size).toBe(coach.length);
  });

  it('gives result() idempotently and keeps records with Math.max', () => {
    const sim = later();
    drive(sim, 30, HIGH);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(a.unit).toBe('ATP');
    expect(sim.p.best['300']).toBe(a.score);
    sim.finish();
    const total = sim.p.atpTotal;
    sim.result();
    sim.finish();
    expect(sim.p.atpTotal).toBe(total);
  });

  it('settles once at the end (or early) and counts the session', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 46, MID, clock);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.atpTotal).toBe(sim.atp);
    const early = later();
    drive(early, 20, MID);
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('hides the gauge in a blind push and without a signal, shows calm in a rest', () => {
    const sim = later();
    drive(sim, 8, NONE);
    expect(sim.meter()).toBeNull();
    drive(sim, 2, HIGH);
    expect(sim.meter()).not.toBeNull();
    const clock = until(sim, 'rest', HIGH);
    drive(sim, 3, CALM, clock);
    expect(sim.meter()).toBeGreaterThan(0.5);
    const blind = later({ progress: { sessions: 4, pushes: 2 } });
    const c2 = { t: 0 };
    let hidden = true, sawBlind = false;
    drive(blind, 300, HIGH, c2, () => {
      if (blind.blind) {
        sawBlind = true;
        if (blind.meter() !== null || blind.songLevel(HIGH) !== null || blind.padLevel(HIGH) !== null) hidden = false;
      }
    });
    expect(sawBlind).toBe(true);
    expect(hidden).toBe(true);
  });

  it('a blind push tells its share at the end and charges the full power with it', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    const evs = drive(sim, 300, HIGH, clock);
    const ends = ofType(evs, 'blindEnd');
    expect(ends.length).toBeGreaterThan(0);
    expect(ends[0].share).toBeGreaterThan(0.5);
    expect(sim.blindShare).toBeGreaterThan(50);
  });

  it('closes with a passage that exists, fitting what happened', () => {
    for (const s of [later(), makeSim(), later({ niche: 'skin' })]) {
      drive(s, 40, MID, { t: 0 }, () => { if (s.story) s.tap(); });
      const r = s.result();
      expect(r.verse).toBeDefined();
      expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    }
    expect(makeSim().closingVerse()).toBe('psa139.16');
  });

  it('keeps the headline the same as the result, with readable stats and highlights', () => {
    const sim = later();
    drive(sim, 60, MID, { t: 0 }, tapAll(sim));
    const r = sim.result();
    expect(r.score).toBe(sim.atp);
    expect(r.stats.length).toBeGreaterThanOrEqual(5);
    for (const [k, v] of r.stats) {
      expect(k.length).toBeGreaterThan(0);
      expect(v.length).toBeGreaterThan(0);
    }
    expect(r.highlights.length).toBeGreaterThan(0);
  });

  it('lets Mito speak one message at a time: never over a card of the view or a new cell’s toast', () => {
    const sim = later();
    sim.holdTalk = true;
    drive(sim, 12, MID);
    expect(sim.talk.said).toEqual([]);
    sim.holdTalk = false;
    drive(sim, 4, MID);
    expect(sim.talk.said.length).toBeGreaterThan(0);
    // a quiet stretch earns a fact (queued while nothing else is said)
    const quiet = later();
    quiet.holdTalk = true;
    drive(quiet, 17, NONE);
    expect(quiet.talk.has('fact')).toBe(true);
  });

  it('meets Wiedza cards in play, once each', () => {
    const sim = later({ planned: 600, niche: 'skin' });
    const evs = drive(sim, 300, () => (sim.restBlock ? CALM : HIGH), { t: 0 }, tapAll(sim));
    const ids = ofType(evs, 'card').map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['turbine', 'lesions', 'ber', 'autophagy', 'turnover', 'skin'] as const) expect(ids, id).toContain(id);
    expect(sim.p.cards.length).toBe(ids.length);
  });
});

describe('the meta', () => {
  it('counts trait levels from the lifetime totals', () => {
    expect(levelOf([10, 20], 9)).toBe(0);
    expect(levelOf([10, 20], 20)).toBe(2);
    expect(mitoLevel({ atpTotal: RULES.mitoAt[0] })).toBe(1);
    expect(enzymeLevel({ repairs: RULES.enzymeAt[2] + 5 })).toBe(3);
    expect(lysoLevel({ recycled: 0 })).toBe(0);
    const p = freshProgress();
    p.repairs = RULES.enzymeAt[0];
    expect(traitState(p, 'enzyme')).toEqual({ level: 1, max: 3, total: RULES.enzymeAt[0], next: RULES.enzymeAt[1] });
  });

  it('opens the niches with divisions and takes them in turn, or the chosen one', () => {
    const p = freshProgress();
    expect(sessionNiche(p)).toBe('gut');
    expect(nicheOpen(p, 'skin')).toBe(false);
    p.divisions = RULES.nicheAt.blood;
    p.lastNiche = 'gut';
    expect(sessionNiche(p)).toBe('skin');
    p.lastNiche = 'skin';
    expect(sessionNiche(p)).toBe('blood');
    p.lastNiche = 'blood';
    expect(sessionNiche(p)).toBe('gut');
    p.niche = 'blood';
    expect(sessionNiche(p)).toBe('blood');
    p.divisions = 0;
    expect(sessionNiche(p)).toBe('gut');
  });

  it('grows the tissue in patches of twelve and remembers the best', () => {
    const p = freshProgress();
    p.tissue.skin = 27;
    expect(patchOf(p, 'skin')).toEqual({ patches: 2, cells: 3, of: 12 });
    expect(bestOf(p)).toBeNull();
    p.best = { '300': 400, '600': 900 };
    expect(bestOf(p)).toBe(900);
  });

  it('levels a trait up during play, once, and says so', () => {
    const sim = later({ progress: { atpTotal: RULES.mitoAt[0] - 5 } });
    const evs = drive(sim, 10, MID);
    const ups = ofType(evs, 'up');
    expect(ups).toHaveLength(1);
    expect(ups[0]).toEqual({ type: 'up', trait: 'mito', level: 1 });
    expect(sim.upsNow).toEqual(['mito']);
  });

  it('keeps a progress pace in a fair band over a week of 5-minute sessions (simulated play)', () => {
    const p = migrate(freshProgress());
    for (let s = 0; s < 7; s++) {
      const sim = new OdnowaSim({ progress: p, rng: mulberry32(100 + s), plannedSec: 300, eeg: false, tuning: TUNING });
      sim.start();
      drive(sim, 310, t => (sim.restBlock ? (t % 7 < 4 ? CALM : MID) : t % 9 < 5 ? HIGH : MID), { t: 0 }, () => {
        if (sim.story) sim.tap();
        if (sim.openLesions.length && Math.random() < 0.05) sim.repairNext();
      });
      sim.finish();
    }
    // a week: a dozen or more cells, two niches open, a first trait or two
    expect(p.divisions).toBeGreaterThanOrEqual(8);
    expect(p.divisions).toBeLessThanOrEqual(40);
    expect(nicheOpen(p, 'skin')).toBe(true);
    expect(mitoLevel(p) + enzymeLevel(p) + lysoLevel(p)).toBeGreaterThanOrEqual(2);
    expect(p.cards.length).toBeGreaterThanOrEqual(12);
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and keeps the count', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as OdnowaProgress);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.tissue).toEqual({ gut: 0, skin: 0, blood: 0 });
    expect(p.song).toBe(true);
    expect(migrate(p)).toBe(p);
    const sim = new OdnowaSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: true, tuning: TUNING });
    sim.start();
    expect(sim.session).toBe(5);
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: '3', pushes: 9, atpTotal: 5000.7, repairs: -4, recycled: 'x', divisions: 2, tissue: { gut: 5, skin: 'no' },
      log: { oxo: 3, nope: 9 }, cards: ['turbine', 'ghost', 'turbine', 7], seen: ['lane', 3], best: { '300': 420, x: 9, '600': 'y' },
      bestCombo: 99, niche: 'liver', lastNiche: 'skin', song: 'yes', lyrics: false,
    };
    const p = migrate(mergeSaved(freshProgress(), saved) as OdnowaProgress);
    expect(p.sessions).toBe(0);
    expect(p.atpTotal).toBe(5000);
    expect(p.repairs).toBe(0);
    expect(p.recycled).toBe(0);
    expect(p.tissue).toEqual({ gut: 5, skin: 0, blood: 0 });
    expect(p.divisions).toBe(5);
    expect(p.log.oxo).toBe(3);
    expect(p.cards).toEqual(['turbine']);
    expect(p.seen).toEqual(['lane']);
    expect(p.best).toEqual({ '300': 420 });
    expect(p.bestCombo).toBe(RULES.comboMax);
    expect(p.niche).toBe('auto');
    expect(p.lastNiche).toBe('skin');
    expect(p.song).toBe(true);
    expect(p.lyrics).toBe(false);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, tissue: 'x', log: [], cards: {}, best: [] }]) {
      const p = migrate(mergeSaved(freshProgress(), junk) as OdnowaProgress);
      expect(p.ver).toBe(1);
      expect(Array.isArray(p.cards)).toBe(true);
      expect(typeof p.tissue.gut).toBe('number');
      const sim = new OdnowaSim({ progress: p, rng: mulberry32(4), plannedSec: 60, eeg: false, tuning: TUNING });
      sim.start();
      drive(sim, 3, NONE);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Mito at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINE_COUNT[m], m).toBeGreaterThanOrEqual(3);
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (k.startsWith('say.')) expect(typeof v === 'string' && v.length <= 90, k).toBe(true);
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.')) expect((v as string).length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
    const all = lines();
    for (const m of MOMENTS) expect(all[m].length).toBe(LINE_COUNT[m]);
  });

  it('keeps Polish letters and Polish words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
  });

  it('suggests strategies, never to concentrate harder', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip|how)\./.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
  });

  it('never promises healing: the how-to’s last tip says it plainly in every language', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) expect(CATALOGS[l]['how.tip2']).toMatch(/leczenia|treatment|Behandlung|vård/);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) expect(s, `${l}.${k}`).not.toMatch(/uleczy|wyleczy|heals you|cures|heilt dich|botar/i);
      }
    }
  });

  it('keeps a no-break space between a number and its unit, and before % in German and Swedish', () => {
    expect(atpText(120)).toBe('120\u00a0ATP');
    expect(unit(5)).toBe('ATP');
    for (const l of ['de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) expect(s, `${l}.${k}`).not.toMatch(/\d\u0020%|\}\u0020%/);
      }
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!k.startsWith('card.')) continue;
        expect(v as string, `${l}.${k}`).not.toMatch(/\d\u0020(dni|days|Tage|dagar|mV|min|ATP)\b/);
      }
    }
  });

  it('gives every Wiedza card a title, a number, a sentence and a source', () => {
    expect(CARD_IDS.length).toBeGreaterThanOrEqual(20);
    for (const c of CARDS) {
      expect(c.src.length, c.id).toBeGreaterThan(8);
      for (const part of ['title', 'num', 'text'] as const) expect(t(`card.${c.id}.${part}` as 'card.turbine.title').length, `${c.id}.${part}`).toBeGreaterThan(2);
    }
    for (const n of NICHES) expect(t(`niche.${n}` as 'niche.gut')).not.toBe(`niche.${n}`);
  });
});

describe('the song', () => {
  it('is a sound song: verses of 32 beats around the series refrain, no note outside the loop', () => {
    const song = buildSong();
    expect(songProblems(song)).toEqual([]);
    expect(verseBeats()).toEqual([32, 32]);
    expect(song.beats).toBe(64 + 2 * CHORUS_BEATS);
    expect(song.lines).toHaveLength(16);
    // its own verses in the page's language, the refrain twice
    expect(song.lines[0].text).toBe(t('song.a.1'));
    expect(song.lines[8].text).toBe(t('song.b.1'));
    expect(song.lines.filter(l => l.at >= 32 && l.at < 64)).toEqual(seriesChorus(32).lines);
    expect(lineAt(song, 1)?.text).toBe(t('song.a.1'));
    // eight plucks a bar (the c-ring's protons), three bells a bar (three ATP)
    const pluck = song.parts.find(p => p.voice === 'pluck')!;
    expect(pluck.notes.filter(n => n.at >= 0 && n.at < 4)).toHaveLength(8);
    const bell = song.parts.find(p => p.voice === 'bell' && p.notes.some(n => n.at < 4))!;
    expect(bell.notes.filter(n => n.at >= 0 && n.at < 4)).toHaveLength(3);
  });

  it('follows the band in a sighted push, holds in a blind one, stays gentle in a rest', () => {
    const sim = later();
    drive(sim, 2, HIGH);
    expect(sim.songLevel(HIGH)).toBeCloseTo(0.42, 5);
    drive(sim, 8, HIGH);
    expect(sim.songLevel(HIGH)!).toBeGreaterThan(0.7);
    expect(sim.songLevel(NONE)).toBeNull();
    const clock = until(sim, 'rest', HIGH);
    drive(sim, 2, CALM, clock);
    expect(sim.songLevel(CALM)).toBe(0.3);
  });
});

describe('mobile first (DESIGN §12)', () => {
  it('gives every control a finger-sized target inside the insets, clear of the others, at every checked size and state', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const card of [false, true]) {
        const ts = tapTargets(L, { card, started: true });
        expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}${card ? ', the story card' : ''}`).toEqual([]);
        expect(ts.length).toBe(card ? 1 : 2);
      }
      expect(tapTargets(L, { card: false, started: false })).toEqual([]);
    }
  });

  it('puts the lane in the thumb zone of a phone upright and a finger’s worth of the turbine there too', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode, c.name).toBe('tall');
      const zone = c.h * (1 - THUMB);
      expect(L.lane.y, c.name).toBeGreaterThanOrEqual(zone);
      expect(L.lane.h, c.name).toBeGreaterThanOrEqual(84);
      expect(L.lane.y + L.lane.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom);
      expect(L.lensHit.y + L.lensHit.h, c.name).toBeGreaterThanOrEqual(zone + MIN_TAP);
      // the lane keeps off the side edges; the lens is big
      expect(L.lane.x, c.name).toBeGreaterThanOrEqual(c.insets.left + 8);
      expect(L.lens.r, c.name).toBeGreaterThanOrEqual(80);
      // passive words under the HUD: the lyric and the chips, above the city
      expect(L.lyric.y).toBeGreaterThanOrEqual(c.insets.top);
      for (const ch of L.chips) expect(ch.y + ch.h, c.name).toBeLessThanOrEqual(L.city.y);
      // the lens and its gauge clear the lane and the chips
      expect(L.lens.y + L.lens.r * 1.12, c.name).toBeLessThanOrEqual(L.lane.y);
      expect(L.lens.y - L.lens.r * 1.12, c.name).toBeGreaterThanOrEqual(L.chips[0].y + L.chips[0].h - 2);
    }
  });

  it('keeps Mito, the lysosomes and the worn parts’ spots off the lens and inside the city', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const p of [L.mito, ...L.lysos]) {
        expect(Math.hypot(p.x - L.lens.x, p.y - L.lens.y), c.name).toBeGreaterThanOrEqual(L.lens.r + p.r * 0.6);
        expect(p.y - p.r, c.name).toBeGreaterThanOrEqual(L.city.y - 2);
        expect(p.y + p.r, c.name).toBeLessThanOrEqual(L.lane.y);
      }
      for (const s of L.spots) {
        expect(Math.hypot(s.x - L.lens.x, s.y - L.lens.y), c.name).toBeGreaterThanOrEqual(L.lens.r);
        expect(s.x, c.name).toBeGreaterThan(c.insets.left);
        expect(s.x, c.name).toBeLessThan(c.w - c.insets.right);
      }
    }
  });

  it('keeps the clean-up clear of the chips on every screen', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      const s = Math.max(14, L.mito.r * 1.05) * 1.4;
      for (const p of [...L.spots, ...L.lysos]) {
        for (const ch of L.chips) {
          const clear = p.x + s < ch.x || p.x - s > ch.x + ch.w || p.y - s * 0.8 > ch.y + ch.h || p.y + s < ch.y;
          expect(clear, `${c.name}: ${Math.round(p.x)},${Math.round(p.y)} vs chip ${Math.round(ch.x)},${Math.round(ch.y)}`).toBe(true);
        }
      }
    }
  });

  it('lays a phone on its side out with the lens left, the chips stacked on the right, the lane along the foot', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode).toBe('short');
      expect(L.lens.x).toBeLessThan(L.chips[0].x);
      expect(L.chips[2].y).toBeGreaterThan(L.chips[0].y);
      expect(L.lane.y + L.lane.h).toBeLessThanOrEqual(c.h - c.insets.bottom);
      expect(L.lens.y + L.lens.r).toBeLessThanOrEqual(L.lane.y);
    }
  });

  it('maps the lane both ways and finds the turbine and the lane under a finger', () => {
    const L = layout(360, 500, CHECK_SIZES[0].insets);
    for (const u of [0, 2.5, 10]) expect(laneU(L, laneX(L, u))).toBeCloseTo(u, 6);
    expect(onLens(L, L.lens.x, L.lens.y)).toBe(true);
    expect(onLens(L, L.lens.x, L.lane.y + L.lane.h / 2)).toBe(false);
    expect(onLane(L, L.lane.x + 20, L.laneMid)).toBe(true);
    expect(onLane(L, L.lens.x, L.lens.y)).toBe(false);
  });

  it('never draws a word under 11 px, and the words to read at 13 px and more', () => {
    for (const px of [0, 5, 9, 10.9, 11, 13, 22]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(4)).toMatch(/ 11px /);
    for (const c of CHECK_SIZES) expect(layout(c.w, c.h, c.insets).fs, c.name).toBeGreaterThanOrEqual(MIN_READ);
  });

  it('speaks of taps on a touch screen and of keys only with a keyboard', () => {
    expect(coachText('lane', true)).toBe(t('coach.lane'));
    expect(coachText('lane', false)).toBe(t('coach.lane.keys'));
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.map(x => x.gesture)).not.toContain('keys');
    expect(desk.hands.map(x => x.gesture)).toContain('keys');
    expect(touch.tips).toHaveLength(2);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const k of ['how.tap', 'how.turbine', 'how.drag', 'coach.lane', 'coach.surge'] as const) expect(CATALOGS[l][k]).not.toMatch(/Spac|Space|Leertaste|mellanslag/i);
    }
  });
});
