import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LINES, MOMENTS, RUNGS, RUNG_IDS, TIPS, powText } from '../src/arcade/ogien/content';
import { CATALOGS, t, unit } from '../src/arcade/ogien/i18n';
import { allForms, bestOf, freshProgress, migrate, skyPlace, starLook, unlocked, variantFor, type OgienProgress } from '../src/arcade/ogien/meta';
import { RULES } from '../src/arcade/ogien/rules';
import { BREATH_SEC, OgienSim, brainK, breathAt, finaleFor, planBlocks, ringSecFor, type SimEvent } from '../src/arcade/ogien/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_TEXT, auditTargets, screenKind } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import ogien, { coachText, howto, rhythm } from '../src/arcade/ogien/index';
import { layout } from '../src/arcade/ogien/layout';
import { fontPx } from '../src/arcade/ogien/paint';
import { OgienView } from '../src/arcade/ogien/render';
import { breathGuideBox } from '../src/arcade/kit/breathguide';
import { rhythmOf } from '../src/arcade/kit/rhythm';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';

const DAY = '2026-11-12';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const LOW = frame({ level: 0.2, activity: -1, calm: 0.75 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['open', 'c:blow', 'c:ring', 'c:rest', 'c:breath', 'c:light', 'c:shield', 'c:feed', 'c:tents', 'c:fuse', 'c:gather', 'c:pass', 'c:blind', 'c:button'];

type SimOpts = { progress?: Partial<OgienProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; rhythm?: { focus: number; rest: number } | null };

function makeSim(o: SimOpts = {}): OgienSim {
  const sim = new OgienSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, rhythm: o.rhythm,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, every explanation seen). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: OgienSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: sim.t }, each?: (t: number) => void): SimEvent[] {
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
function until(sim: OgienSim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: sim.t }): { t: number } {
  let guard = 0;
  while (!(sim.phase === 'play' && sim.block.kind === kind) && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

/** The smoke test's input: a tap at the screen's (w/2, h·0.6) — a little under the fire — every 0.65 s, Space every ~2 s. */
function smokeHands(sim: OgienSim): (t: number) => void {
  let nextTap = 0.65, nextSpace = 2;
  return (t: number) => {
    if (t >= nextTap) {
      nextTap += 0.65;
      if (sim.card) sim.closeCard();
      else sim.tap({ x: 0, y: 0.35 });
    }
    if (t >= nextSpace) {
      nextSpace += 2;
      sim.key(' ', true);
      sim.key(' ', false);
    }
  };
}

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates push and rest, ending on a rest', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      const sum = plan.reduce((s, b) => s + b.dur, 0);
      expect(sum).toBeCloseTo(planned - finaleFor(planned), 5);
      // round 15: pushes of about 40 s (± 6, scaled to end on time), rests of two whole breaths
      for (const b of rest) {
        expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.16);
        if (b.kind === 'rest') expect(b.dur).toBe(RULES.restBreaths * BREATH_SEC);
      }
    }
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 75]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later();
    const b = sim.block;
    expect(b.kind).toBe('push');
    const evs = drive(sim, b.dur - 2, frame());
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('rest');
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
  });

  it('makes every 4th push blind (smoke) from the 3rd session, never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock);
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
    // the first two sessions never go blind
    const early = later({ planned: 600, progress: { sessions: 0, pushes: 3, seen: [...ALL_SEEN] } });
    const c2 = { t: 0 };
    const seen: boolean[] = [];
    for (let i = 0; i < 8 && early.phase === 'play'; i++) {
      if (early.block.kind === 'push') seen.push(early.block.blind);
      drive(early, early.block.dur + 0.05, frame(), c2);
    }
    expect(seen.some(Boolean)).toBe(false);
  });

  it('turns the strategies: the scene’s imagery, a counting one in turn, never the same twice running', () => {
    const sim = later({ planned: 600 });
    const tips: string[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 12 && sim.phase === 'play'; i++) {
      tips.push(sim.tip);
      drive(sim, sim.block.dur + 0.05, frame(), clock);
    }
    for (let i = 1; i < tips.length; i++) expect(tips[i]).not.toBe(tips[i - 1]);
    expect(tips.some(x => TIPS.count.includes(x))).toBe(true);
    expect(tips.some(x => Object.values(TIPS.push).flat().includes(x))).toBe(true);
    expect(tips.some(x => TIPS.rest.includes(x))).toBe(true);
  });
});

describe('focus charges the fire', () => {
  it('charges nothing at or below the threshold and faster the higher the signal', () => {
    expect(brainK(0.5)).toBe(0);
    expect(brainK(0.3)).toBe(0);
    expect(brainK(0.75)).toBeCloseTo(0.5, 5);
    expect(brainK(1)).toBe(1);
    const rings: number[] = [];
    for (const level of [0.5, 0.65, 0.8, 0.95]) {
      const sim = later();
      drive(sim, 12, frame({ level, activity: 3 }));
      rings.push(sim.ring);
    }
    expect(rings[0]).toBe(0);
    for (let i = 1; i < rings.length; i++) expect(rings[i]).toBeGreaterThan(rings[i - 1]);
  });

  it('waits out the lead-in (5 s Mendi, 2 s HALO) before the brain acts', () => {
    const sim = later();
    drive(sim, RULES.leadIn.fnirs - 0.2, HIGH);
    expect(sim.ring).toBe(0);
    expect(sim.meter()).toBeNull();
    drive(sim, 1, HIGH);
    expect(sim.ring).toBeGreaterThan(0);
    const eeg = later({ eeg: true });
    drive(eeg, RULES.leadIn.eeg + 0.5, HIGH);
    expect(eeg.ring).toBeGreaterThan(0);
  });

  it('freezes at neutral without a signal: no charge, no loss, the heat never shown low', () => {
    const sim = later();
    drive(sim, 12, HIGH);
    const ring = sim.ring, sparks = sim.sparks;
    drive(sim, 6, NONE);
    expect(sim.ring).toBe(ring);
    expect(sim.sparks).toBe(sparks);
    expect(sim.meter()).toBeNull();
    expect(sim.heat).toBeGreaterThan(0.45);
  });

  it('fills a spark’s ring in about ringSec of full focus and changes it into a candle, with its card', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = drive(sim, RULES.leadIn.fnirs + RULES.ringSec[0] + 0.6, frame({ level: 1, activity: 8 }), clock);
    const ch = ofType(evs, 'change');
    expect(ch).toHaveLength(1);
    expect(ch[0].from).toBe(0);
    expect(ch[0].to).toBe(1);
    expect(sim.rung).toBe(1);
    expect(sim.card?.kind).toBe('change');
    expect(sim.card?.verse).toBe('pro20.27');
    expect(sim.changesNow).toBe(1);
    expect(ringSecFor(4, 1)).toBeCloseTo(RULES.ringSec[4] * RULES.cycleK, 6);
  });

  it('never shrinks the ring; a rest’s calm banks light that pours back at the next push', () => {
    const sim = later();
    const clock = until(sim, 'rest', frame({ level: 0.8, activity: 4 }));
    expect(sim.ring).toBeGreaterThan(0);
    // (a 40 s push may nearly fill the ring: hold it at half, so the light poured back cannot complete it)
    sim.ring = Math.min(sim.ring, 0.5);
    const ring = sim.ring;
    drive(sim, sim.block.dur - sim.blockT - 0.2, CALM, clock);
    expect(sim.ring).toBe(ring);
    expect(sim.light).toBeGreaterThan(0.1);
    expect(sim.lightSparks).toBeGreaterThan(0);
    const light = sim.light;
    const evs = drive(sim, 0.4, CALM, clock);
    expect(ofType(evs, 'pour')).toHaveLength(1);
    drive(sim, RULES.leadIn.fnirs + 0.5, MID, clock);
    expect(sim.light).toBeLessThan(1e-6);
    expect(sim.ring).toBeGreaterThan(ring + light * 0.99 - 1e-6);
  });

  it('never fires the change in a rest: a full ring waits there as light and changes with the next push', () => {
    const sim = later();
    const clock = until(sim, 'rest', frame({ level: 0.6, activity: 3 }));
    sim.ring = 0.99;
    // a verdict bonus or a blind block's reveal could land here; feed it directly through a blind-free path
    (sim as unknown as { add(a: number, s: string): void }).add(0.2, 'hands');
    expect(sim.rung).toBe(0);
    expect(sim.ring).toBeLessThan(1);
    expect(sim.light).toBeGreaterThan(0.18);
    const evs = drive(sim, sim.block.dur - sim.blockT + RULES.leadIn.fnirs, CALM, clock);
    expect(ofType(evs, 'change').length).toBeGreaterThanOrEqual(1);
    expect(sim.rung).toBe(1);
  });

  it('leaves an ember bed after a passed rest (the next push charges ×1.15) and adds a bonus after a passed push', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = drive(sim, sim.block.dur + 0.1, HIGH, clock);
    expect(ofType(evs, 'bonus')).toHaveLength(1);
    expect(sim.passedPushes).toBe(1);
    const evs2 = drive(sim, sim.block.dur - sim.blockT + 0.1, CALM, clock);
    expect(ofType(evs2, 'ember')).toHaveLength(1);
    expect(sim.ember).toBe(true);
  });

  it('hides a blind block’s charge (ring, meter, headline) and reveals it when the smoke lifts', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    // to the third push (blind)
    let guard = 0;
    while (!(sim.block.kind === 'push' && sim.block.blind) && guard++ < 20) drive(sim, sim.block.dur - sim.blockT + 0.05, frame(), clock);
    expect(sim.blind).toBe(true);
    // the light banked in the rest before pours in (it is no feedback of this block); the brain's part stays hidden
    const ring = sim.ring + sim.light, sparks = sim.sparks;
    drive(sim, 15, HIGH, clock);
    expect(sim.ring).toBeCloseTo(Math.min(0.999, ring), 6);
    expect(sim.sparks).toBe(sparks);
    expect(sim.meter()).toBeNull();
    expect(sim.veiled).toBeGreaterThan(0.2);
    const evs = drive(sim, sim.block.dur - sim.blockT + 0.1, HIGH, clock);
    expect(ofType(evs, 'reveal')).toHaveLength(1);
    expect(sim.sparks).toBeGreaterThan(sparks);
    expect(sim.ring + sim.rung).toBeGreaterThan(ring);
  });

  it('gives the gauge the heat in a sighted push and calm in a rest', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 8, HIGH, clock);
    expect(sim.meter()!).toBeGreaterThan(0.85);
    drive(sim, 3, LOW, clock);
    expect(sim.meter()!).toBeLessThan(0.5);
    until(sim, 'rest', LOW, clock);
    drive(sim, 8, CALM, clock);
    expect(sim.meter()!).toBeGreaterThan(0.7);
    expect(sim.padLevel(CALM)).toBeNull();
  });
});

describe('the hands', () => {
  it('blows on the spark: a little charge, a pause between counted blows, capped softly per block', () => {
    const sim = later();
    expect(sim.tap({ x: 0, y: 0 })).toBe(true);
    const r1 = sim.ring;
    expect(r1).toBeCloseTo(RULES.gains.blow, 6);
    sim.tap({ x: 0, y: 0 });
    expect(sim.ring).toBe(r1);
    const clock = { t: 0 };
    for (let i = 0; i < 400; i++) {
      drive(sim, 0.3, MID, clock);
      sim.tap(null);
    }
    expect(sim.touchUsed).toBeLessThanOrEqual(RULES.touchCap.push + 1e-9);
  });

  it('shelters the candle: a draught warned, held off by a held finger, a gentle miss otherwise', () => {
    const sim = later({ seed: 3 });
    sim.ring = 0;
    (sim as unknown as { rung: number }).rung = 1;
    (sim as unknown as { setupTask(): void }).setupTask();
    const clock = { t: 0 };
    let evs: SimEvent[] = [];
    let guard = 0;
    while (!ofType(evs, 'gustTele').length && guard++ < 200) evs = drive(sim, 0.1, MID, clock);
    expect(ofType(evs, 'gustTele')).toHaveLength(1);
    sim.holdStart();
    evs = drive(sim, RULES.gustTele + RULES.gustSec + 0.2, MID, clock);
    sim.holdEnd();
    const g = ofType(evs, 'gust');
    expect(g).toHaveLength(1);
    expect(g[0].shielded).toBe(true);
    expect(ofType(evs, 'task').some(e => e.kind === 'shield')).toBe(true);
    // a tap at the warning shelters it too
    sim.gust.t = 0.3;
    evs = [];
    guard = 0;
    while (!ofType(evs, 'gustTele').length && guard++ < 200) evs = drive(sim, 0.1, MID, clock);
    sim.tap({ x: 0, y: 0 });
    evs = drive(sim, RULES.gustTele + RULES.gustSec + 0.2, MID, clock);
    expect(ofType(evs, 'gust')[0].shielded).toBe(true);
    // unsheltered: no loss
    sim.gust.t = 0.3;
    evs = [];
    guard = 0;
    while (!ofType(evs, 'gustTele').length && guard++ < 200) evs = drive(sim, 0.1, MID, clock);
    const ring = sim.ring;
    evs = drive(sim, RULES.gustTele + RULES.gustSec + 0.2, MID, clock);
    expect(ofType(evs, 'gust')[0].shielded).toBe(false);
    expect(sim.ring).toBeGreaterThanOrEqual(ring);
  });

  it('feeds the bonfire: a log dragged onto the fire burns, one dropped elsewhere goes back, the pile refills', () => {
    const sim = later();
    (sim as unknown as { rung: number }).rung = 2;
    (sim as unknown as { setupTask(): void }).setupTask();
    expect(sim.logs).toBe(RULES.logs);
    expect(sim.pickLog()).toBe(true);
    expect(sim.logs).toBe(RULES.logs - 1);
    expect(sim.dropLog(false)).toBe(false);
    expect(sim.logs).toBe(RULES.logs);
    expect(sim.pickLog()).toBe(true);
    expect(sim.dropLog(true)).toBe(true);
    expect(sim.ring).toBeCloseTo(RULES.gains.log, 6);
    expect(sim.burning).toHaveLength(1);
    // a tap elsewhere pokes; Space throws the next log
    sim.tap({ x: 0.3, y: 0.4 });
    expect(sim.ring).toBeGreaterThan(RULES.gains.log);
    sim.key(' ', true);
    expect(sim.logs).toBe(RULES.logs - 2);
    drive(sim, RULES.logEvery * 2 + 0.2, MID);
    expect(sim.logs).toBe(RULES.logs);
  });

  it('lights the camp’s tents from the pillar: the nearest dark one, never a lit one', () => {
    const sim = later();
    (sim as unknown as { rung: number }).rung = 3;
    (sim as unknown as { setupTask(): void }).setupTask();
    const dark = sim.tents.filter(x => x.lit < RULES.relight).length;
    expect(dark).toBeGreaterThan(3);
    const tt = sim.tents[0];
    expect(sim.tap({ x: tt.x, y: tt.y })).toBe(true);
    expect(tt.arc).toBe(0);
    drive(sim, 0.7, MID);
    expect(tt.lit).toBeGreaterThan(0.95);
    for (let i = 0; i < 12; i++) sim.tap(null);
    expect(sim.tents.every(x => x.lit >= RULES.relight || x.arc >= 0)).toBe(true);
    expect(sim.tap(null)).toBe(false);
  });

  it('fuses hydrogen pairs in the star and gathers the nebula’s gas into the hypergiant', () => {
    const sim = later();
    (sim as unknown as { rung: number }).rung = 4;
    (sim as unknown as { setupTask(): void }).setupTask();
    expect(sim.pairs.length).toBeGreaterThan(0);
    const q = sim.pairAt(sim.pairs[0]);
    expect(sim.tap(q)).toBe(true);
    expect(sim.pairs[0].fused).toBe(0);
    expect(sim.tap({ x: 9, y: 9 })).toBe(false);
    const mega = later();
    (mega as unknown as { rung: number }).rung = 5;
    (mega as unknown as { setupTask(): void }).setupTask();
    const w = mega.wisps[0];
    expect(mega.drag(mega.wispAt(w))).toBeGreaterThanOrEqual(1);
    const evs = drive(mega, RULES.wispIn + 0.1, MID);
    expect(ofType(evs, 'task').some(e => e.kind === 'gather')).toBe(true);
    expect(mega.ring).toBeGreaterThan(0);
  });

  it('at Pentecost the tongues of fire come down by themselves; a tap passes the flame on to one who waits', () => {
    const sim = later();
    (sim as unknown as { rung: number }).rung = 6;
    (sim as unknown as { setupTask(): void }).setupTask();
    expect(sim.tap(null)).toBe(false);
    const evs = drive(sim, RULES.tongueSec + 1.5, MID);
    expect(ofType(evs, 'tongue').length).toBeGreaterThanOrEqual(1);
    expect(sim.figures.some(f => f.state === 'lit')).toBe(true);
    const waiting = sim.figures.findIndex(f => f.street && f.state === 'wait');
    const f = sim.figures[waiting];
    expect(sim.tap({ x: f.x, y: f.y })).toBe(true);
    expect(f.state).toBe('pass');
    drive(sim, RULES.passSec + 0.1, MID);
    expect(f.state).toBe('lit');
  });

  it('makes a centre tap and Space useful at every fire (the smoke contract)', () => {
    for (let rung = 0; rung < RUNGS.length; rung++) {
      const sim = later({ seed: 11 + rung });
      (sim as unknown as { rung: number }).rung = rung;
      (sim as unknown as { setupTask(): void }).setupTask();
      const clock = { t: 0 };
      // Pentecost: the first tongues come down by themselves before anyone can pass the fire on
      if (rung === 6) drive(sim, RULES.tongueSec + 1.5, MID, clock);
      const ring0 = sim.ring;
      // a tap a little under the fire (the smoke clicks at the screen's h·0.6) every 0.65 s and Space every 2 s
      drive(sim, 12, MID, clock, smokeHands(sim));
      expect(sim.ring, `fire ${rung}`).toBeGreaterThan(ring0 + 0.02);
      expect(sim.tasksDone, `fire ${rung}`).toBeGreaterThan(3);
    }
  });

  it('rests the hands in a rest block: a tap only ripples', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    const ring = sim.ring;
    const evs: SimEvent[] = [];
    for (let i = 0; i < 10; i++) {
      sim.tap({ x: 0, y: 0 });
      evs.push(...drive(sim, 0.4, CALM, clock));
    }
    expect(evs.some(e => e.type === 'task')).toBe(false);
    expect(sim.ring).toBe(ring);
  });
});

describe('a session', () => {
  it('scores with the smoke test’s crude input: taps at the centre and Space, the simulator’s focus on', () => {
    // a first-ever session (warm-up and the opening card included)
    const sim = makeSim({ planned: 120 });
    const clock = { t: 0 };
    const heads: number[] = [];
    drive(sim, 22, t => (t > 8 ? frame({ level: 0.8, activity: 4 }) : MID), clock, (tt) => {
      smokeHands(sim)(tt);
      if (Math.abs(tt % 5) < STEP) heads.push(Math.floor(sim.sparks));
    });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(heads.at(-1)!).toBeGreaterThan(heads[0]);
  });

  it('keeps result() idempotent and settles once: the star in the sky, the records', () => {
    const sim = later();
    drive(sim, 60, frame({ level: 0.85, activity: 4 }));
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    sim.finish();
    const p = sim.p;
    expect(p.sky).toHaveLength(1);
    expect(p.sky[0].n).toBe(6);
    expect(p.total).toBe(Math.floor(sim.sparks));
    sim.finish();
    sim.result();
    expect(p.sky).toHaveLength(1);
    expect(p.total).toBe(Math.floor(sim.sparks));
    expect(p.best['300']).toBe(Math.floor(sim.sparks));
    expect(sim.canStop()).toBe(true);
  });

  it('runs a whole session to its end: the finale, the settle, a verse of the highest fire', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    drive(sim, 182, tt => (sim.restBlock ? CALM : frame({ level: 0.85 + 0.05 * Math.sin(tt), activity: 4 })), clock, smokeHands(sim));
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    const r = sim.result();
    expect(r.score).toBeGreaterThan(0);
    expect(r.highlights.length).toBeGreaterThan(0);
    expect(RUNGS.map(x => x.verse).concat(['jer20.9', 'sng8.7'])).toContain(r.verse);
    expect(sim.p.sky).toHaveLength(1);
  });

  /**
   * The pace (DESIGN §13.6): in a 5-minute session everyone reaches at least the bonfire (most the pillar),
   * good focus the top rungs.  A no-control signal wanders around the threshold (the adaptive threshold keeps
   * it above ~60 % of the time); the hands do a task now and then.
   */
  it('paces the ladder: everyone reaches the bonfire in 5 minutes, good focus the top', () => {
    const run = (focus: 'none' | 'some' | 'good', seed: number, planned = 300): OgienSim => {
      const sim = later({ planned, seed, tuning: BEGINNER });
      const rnd = mulberry32(seed * 7 + 1);
      let base = 0.5;
      let nextTap = 1;
      drive(sim, planned + 1, tt => {
        // an Ornstein–Uhlenbeck wander (sd ≈ 0.12, ~2 s) around what the player's focus pulls it to, plus Mayer waves
        base += (rnd() - 0.5) * 0.075;
        const pull = focus === 'none' ? 0.53 : focus === 'some' ? (sim.pushBlock ? 0.63 : 0.43) : (sim.pushBlock ? 0.82 : 0.3);
        base += (pull - base) * 0.008;
        const level = Math.max(0.03, Math.min(0.98, base + 0.05 * Math.sin(tt * 0.63)));
        return frame({ level, activity: (level - 0.5) * 8, calm: 1 - level, hold: level > 0.5 ? 4 : 0 });
      }, { t: 0 }, tt => {
        if (tt >= nextTap) {
          nextTap += 2.2;
          if (sim.card) sim.closeCard();
          sim.tap(null);
        }
      });
      return sim;
    };
    const tops = { none: [] as number[], some: [] as number[], good: [] as number[] };
    for (const focus of ['none', 'some', 'good'] as const) for (let s = 1; s <= 4; s++) tops[focus].push(run(focus, s).top);
    if (process.env.OGIEN_OUT) writeFileSync(process.env.OGIEN_OUT, `pace (ladder index reached, 5 min): ${JSON.stringify(tops)}\n`);
    for (const x of tops.none) expect(x).toBeGreaterThanOrEqual(2);
    for (const x of tops.none) expect(x).toBeLessThanOrEqual(4);
    expect(Math.min(...tops.some)).toBeGreaterThanOrEqual(3);
    for (const x of tops.good) expect(x).toBeGreaterThanOrEqual(6);
    // a 10-minute session with good focus completes the ladder and starts a new round, never an empty end
    const long = run('good', 9, 600);
    expect(long.top).toBeGreaterThanOrEqual(7);
    expect(long.cyclesNow).toBeGreaterThanOrEqual(1);
  });
});

describe('progress and meta', () => {
  it('loads the placeholder’s save { ver: 1, sessions: n } and repairs wrong types without crashing', () => {
    const old = migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 3 }));
    expect(old.sessions).toBe(3);
    expect(old.sky).toEqual([]);
    expect(old.bestTop).toBe(-1);
    const junk = migrate(mergeSaved(freshProgress(), {
      ver: 1, sessions: '7', pushes: null, total: -5, best: [1, 2], bestTop: 'x', reached: { iskra: 2, nope: 4, swieca: 'a' },
      forms: ['iskra:0', 'iskra:9', 3, 'zeslanie:1'], fastest: { iskra: 12.5, mars: 1 }, sky: [{ n: 1, top: 3, sparks: 50, day: '2026-11-10' }, { n: 0 }, 'x'],
      seen: ['open', 5], extra: { a: 1 },
    }));
    expect(junk.sessions).toBe(1);
    expect(junk.pushes).toBe(0);
    expect(junk.total).toBe(0);
    expect(junk.best).toEqual({});
    expect(junk.reached).toEqual({ iskra: 2 });
    expect(junk.forms).toEqual(['iskra:0', 'zeslanie:1']);
    expect(junk.fastest).toEqual({ iskra: 12.5 });
    expect(junk.sky).toHaveLength(1);
    expect(junk.seen).toEqual(['open']);
    expect('extra' in junk).toBe(false);
    // an unversioned save keeps its sessions and starts fresh
    const v0 = migrate({ sessions: 2, best: 'x' } as unknown as OgienProgress);
    expect(v0.ver).toBe(1);
    expect(v0.sessions).toBe(2);
    expect(bestOf(freshProgress())).toBeNull();
  });

  it('unlocks a fire’s second picture after three sessions there, and shows the richer one in a second round', () => {
    const p = freshProgress();
    expect(unlocked(p, 2)).toBe(1);
    expect(variantFor(p, 2, 0, 5)).toBe(0);
    expect(variantFor(p, 2, 1, 5)).toBe(1);
    p.reached.ognisko = 3;
    expect(unlocked(p, 2)).toBe(2);
    expect(new Set([variantFor(p, 2, 0, 4), variantFor(p, 2, 0, 5)]).size).toBe(2);
    expect(allForms()).toHaveLength(RUNGS.reduce((s, r) => s + r.variants, 0));
  });

  it('places every session’s star in the sky and shines it by the fire reached', () => {
    const spots = Array.from({ length: 160 }, (_, i) => skyPlace(i + 1));
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0.01);
      expect(s.x).toBeLessThan(0.99);
      expect(s.y).toBeGreaterThan(0.01);
      expect(s.y).toBeLessThan(0.99);
    }
    expect(starLook(6).size).toBeGreaterThan(starLook(0).size);
    expect(starLook(4).rays).toBe(true);
    expect(starLook(0).rays).toBe(false);
  });
});

describe('words and verses', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('leaves no Polish in the other languages and keeps each language’s quotes, no "harder" in the strategies', () => {
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        const texts = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
        for (const s of texts) {
          if (l !== 'pl') expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/^tip\./.test(k)) expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
          if (/^say\./.test(k)) expect(s.length, `${l}.${k}`).toBeLessThanOrEqual(90);
          // a strategy fits the phone panel's two lines after "W głowie: "
          if (/^tip\./.test(k)) expect(s.length, `${l}.${k}`).toBeLessThanOrEqual(58);
          if (l === 'de' && /\d%/.test(s)) throw new Error(`${l}.${k}: a number touches %`);
        }
      }
    }
  });

  it('gives Ignacy at least three lines for every moment, in every language', () => {
    for (const m of MOMENTS) expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
  });

  it('bends the unit: 1 iskra, 3 iskry, 5 iskier', () => {
    expect(unit(1)).toBe('iskra');
    expect(unit(3)).toBe('iskry');
    expect(unit(5)).toBe('iskier');
    expect(unit(22)).toBe('iskry');
    expect(t('sparks', { n: 12 })).toBe('12\u00a0iskier');
  });

  it('names only passages that exist, the root among them', () => {
    for (const r of RUNGS) expect(passage(r.verse).text.length).toBeGreaterThan(10);
    for (const id of ['2ti1.6', 'jer20.9', 'sng8.7'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    expect(RUNG_IDS).toHaveLength(7);
    expect(powText(9)).toBe('10⁹ m');
    expect(powText(-1)).toBe('10⁻¹ m');
  });

  it('breathes 4 in and 6 out', () => {
    expect(breathAt(0).in).toBe(true);
    expect(breathAt(3.9).in).toBe(true);
    expect(breathAt(4.1).in).toBe(false);
    expect(breathAt(4).k).toBeCloseTo(1, 3);
    expect(breathAt(10).k).toBeCloseTo(0, 3);
  });
});

// ── phone first (src/arcade/DESIGN.md §12) ──────────────────────────

const PX = /(\d+(?:\.\d+)?)px/;
/** every text drawn, with its font size */
const drawn: { text: string; px: number }[] = [];

/** A canvas context that draws nothing, keeps what is set, measures text at 0.56 em a character and records each text's size. */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const record = (s: unknown) => { drawn.push({ text: String(s), px: Number(String(state.font).match(PX)?.[1] ?? 10) }); };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * Number(String(target.font).match(PX)?.[1] ?? 10) * 0.56 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: unknown) => record(s);
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

interface Played { game: ArcadeGame; sim: OgienSim; view: OgienView }
type Size = { name: string; w: number; h: number; insets: Insets };

describe('phone first (DESIGN.md §12)', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  function play(size: Size, progress: Partial<OgienProgress> = { sessions: 5, pushes: 1, seen: [...ALL_SEEN] }, touch = true): Played {
    const env: GameEnv<OgienProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), ...progress }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: false, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    const game = ogien.create(env);
    game.resize(size.w, size.h, 1);
    game.start();
    const inner = game as unknown as { sim: OgienSim; view: OgienView };
    const p: Played = { game, sim: inner.sim, view: inner.view };
    frames(p, 20);
    return p;
  }

  function frames(p: Played, n: number, f: FocusFrame = frame({ level: 0.8, activity: 4 })): void {
    for (let i = 0; i < n; i++) {
      p.game.update(STEP, f, p.sim.t + STEP);
      p.game.draw();
    }
  }

  const audit = (p: Played, s: Size, what: string) => {
    const problems = auditTargets(p.game.targets!(), s.w, s.h, s.insets);
    expect(problems, `${s.name} · ${what}`).toEqual([]);
  };

  it('keeps every control a finger-sized target inside the insets, apart from the others, at every size and state', () => {
    for (const s of CHECK_SIZES) {
      const p = play(s);
      audit(p, s, 'a spark in a push');
      expect(p.game.targets!().map(t => t.label)).toEqual(['act']);
      // the bonfire: its pile of logs bottom left, the button bottom right
      p.sim.rung = 2;
      (p.sim as unknown as { setupTask(): void }).setupTask();
      frames(p, 4);
      expect(p.game.targets!().map(t => t.label).sort()).toEqual(['act', 'pile']);
      audit(p, s, 'the bonfire');
      // a change: its card alone is the target while it shows
      p.sim.ring = 0.995;
      frames(p, 60 * 8, HIGH);
      expect(p.sim.card).not.toBeNull();
      expect(p.view.cardShown(p.sim)).toBe(true);
      expect(p.game.targets!().map(t => t.label)).toEqual(['card']);
      audit(p, s, 'a card');
      const card = p.game.targets!()[0];
      expect(card.y + card.h).toBeLessThanOrEqual(s.h - s.insets.bottom + 0.5);
      expect(card.y).toBeGreaterThanOrEqual(s.insets.top - 0.5);
    }
  });

  it('fits every card’s words in its box at every size: the opening, each fire’s, a new round’s', () => {
    for (const s of CHECK_SIZES) {
      const p = play(s, { sessions: 0, pushes: 0, seen: [] });
      frames(p, 30);
      expect(p.sim.card?.kind, s.name).toBe('open');
      expect(p.view.cardOverflow, `${s.name} · open`).toBeLessThanOrEqual(0.5);
      for (let rung = 0; rung < RUNGS.length; rung++) {
        p.sim.card = { kind: rung === 0 ? 'cycle' : 'change', rung, variant: 1, cycle: rung === 0 ? 1 : 0, t: 3, dur: 7, fresh: true, verse: RUNGS[rung].verse };
        p.game.draw();
        expect(p.view.cardOverflow, `${s.name} · card ${rung}`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('puts the recurring controls in the thumb zone of a phone held upright', () => {
    for (const s of CHECK_SIZES.filter(x => x.w / x.h < 0.9)) {
      const L = layout(s.w, s.h, s.insets);
      for (const r of [L.btn, L.pile]) {
        expect(r.y, s.name).toBeGreaterThanOrEqual(s.h * (1 - 0.45));
        expect(r.x, s.name).toBeGreaterThanOrEqual(s.insets.left + 16 - 0.5);
        expect(r.x + r.w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - 16 + 0.5);
        expect(Math.min(r.w, r.h), s.name).toBeGreaterThanOrEqual(48);
      }
      // the ring and the fire sit in the band between the HUD and the controls
      expect(L.cy - L.R, s.name).toBeGreaterThan(s.insets.top);
      expect(L.cy + L.R, s.name).toBeLessThan(L.btn.y);
    }
  });

  it('never draws text under 11 px, and the words to read (the button, Ignacy, the card) at 13 px and more', () => {
    expect(fontPx(4)).toBe(MIN_TEXT);
    for (const s of CHECK_SIZES) {
      for (const lang of ['pl'] as const) {
        void lang;
        drawn.length = 0;
        const p = play(s, { sessions: 0, pushes: 0, seen: [] });
        // the opening card, the warm-up, a push with Ignacy talking, the bonfire, a change's card, a rest's breath
        frames(p, 60 * 3);
        p.sim.closeCard();
        frames(p, 60 * 40, HIGH);
        p.sim.rung = 2;
        (p.sim as unknown as { setupTask(): void }).setupTask();
        p.sim.ring = 0.995;
        frames(p, 60 * 6, HIGH);
        frames(p, 60 * 30, CALM);
        expect(drawn.length, s.name).toBeGreaterThan(20);
        for (const d of drawn) expect(d.px, `${s.name}: “${d.text}”`).toBeGreaterThanOrEqual(MIN_TEXT);
        const read = drawn.filter(d => [t('act.blow'), t('act.feed'), t('card.tap'), t('card.click'), t('hud.in'), t('hud.out')].includes(d.text) || LINES.open.includes(d.text) || LINES.push.includes(d.text));
        expect(read.length, s.name).toBeGreaterThan(0);
        for (const d of read) expect(d.px, `${s.name}: “${d.text}”`).toBeGreaterThanOrEqual(13);
      }
    }
    // ~80 s of play at each of the twelve checked sizes: ~5 s on a quiet machine, far more under a busy one
  }, 120_000);

  it('fits every language’s verb on the smallest phone’s button at 13 px (a bold sans’ 0.62 em a letter)', () => {
    const L = layout(CHECK_SIZES[0].w, CHECK_SIZES[0].h, CHECK_SIZES[0].insets);
    const room = L.btn.w - L.btn.h - 14;
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        if (!k.startsWith('act.')) continue;
        expect(String(m).length * 13 * 0.62, `${l}.${k}`).toBeLessThanOrEqual(room);
      }
    }
  });

  it('speaks of tapping on a touch screen, keys only as a desktop’s shortcut', () => {
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
    for (const w of ['blow', 'shield', 'gather', 'ring', 'pass', 'feed'] as const) expect(coachText(w, true)).not.toMatch(/Spacj|klik|mysz/i);
    expect(coachText('blow', false)).toMatch(/Spacj/);
    for (const x of touch.hands) expect(x.text).not.toMatch(/Spacj|klawisz/i);
    // a mouse clicks and drags with the mouse: its how-to and every coach mark about the hands say so
    for (const x of desk.hands) expect(x.text, x.gesture).not.toMatch(/stuk|palc/i);
    for (const w of ['blow', 'shield', 'gather', 'feed', 'tents', 'fuse', 'pass', 'button'] as const) {
      expect(coachText(w, false), w).not.toMatch(/stuk|palc/i);
      expect(coachText(w, false), w).toMatch(/klik|spacj|mysz/i);
    }
    for (const l of LANGS) {
      const c = CATALOGS[l] as Record<string, string>;
      for (const k of ['howto.click', 'coach.tents.keys', 'coach.fuse.keys', 'coach.pass.keys', 'coach.feed.keys', 'coach.button.keys']) expect(c[k], `${l}.${k}`).toMatch(/klik|click|klick/i);
      expect(c['howto.drag.mouse'], `${l}.howto.drag.mouse`).toMatch(/mysz|mouse|maus|mus/i);
    }
  });

  describe('a big screen and a mouse (DESIGN §14)', () => {
    const desks = CHECK_SIZES.filter(s => s.w / s.h >= 0.9 && s.h >= 460 && ['desktop', 'big'].includes(screenKind(s.w, s.h, false)));

    it('lays a desktop out for the mouse: the fire larger, the button and the pile beside the ring, a finger’s layout as it was', () => {
      expect(desks.length).toBeGreaterThanOrEqual(5);
      for (const s of CHECK_SIZES) {
        expect(layout(s.w, s.h, s.insets).desk, s.name).toBe(false);
        expect(layout(s.w, s.h, s.insets, true)).toEqual(layout(s.w, s.h, s.insets));
      }
      for (const s of desks) {
        const L = layout(s.w, s.h, s.insets, false), T = layout(s.w, s.h, s.insets, true);
        expect(L.desk, s.name).toBe(true);
        // the fire larger than the touch layout's, filling most of the band
        expect(L.R, s.name).toBeGreaterThan(T.R);
        expect(2 * L.R / (L.bottom - L.top), s.name).toBeGreaterThan(0.64);
        // the button right of the ring and the pile left of it, beside its lower half (where the mouse is)
        expect(L.btn.x, s.name).toBeGreaterThanOrEqual(L.cx + L.R);
        expect(L.pile.x + L.pile.w, s.name).toBeLessThanOrEqual(L.cx - L.R);
        for (const r of [L.btn, L.pile]) {
          expect(r.y + r.h / 2, s.name).toBeGreaterThan(L.cy);
          expect(r.y, s.name).toBeLessThan(L.cy + L.R);
          expect(r.y + r.h, s.name).toBeLessThanOrEqual(L.bottom);
        }
        expect(L.under, s.name).toBeLessThanOrEqual(L.bottom - 13);
        if (Math.min(s.w, s.h) >= 860) expect(L.u, s.name).toBeGreaterThan(1.3);
      }
    });

    it('keeps every control a finger-sized target inside the play at every desk size and state, with a mouse', () => {
      for (const s of desks) {
        const p = play(s, { sessions: 5, pushes: 1, seen: [...ALL_SEEN] }, false);
        audit(p, s, 'a spark in a push (mouse)');
        p.sim.rung = 2;
        (p.sim as unknown as { setupTask(): void }).setupTask();
        frames(p, 4);
        expect(p.game.targets!().map(t => t.label).sort()).toEqual(['act', 'pile']);
        audit(p, s, 'the bonfire (mouse)');
        p.sim.ring = 0.995;
        frames(p, 60 * 8, HIGH);
        expect(p.game.targets!().map(t => t.label)).toEqual(['card']);
        audit(p, s, 'a card (mouse)');
        expect(p.view.cardOverflow, `${s.name} · card`).toBeLessThanOrEqual(0.5);
        // every fire's card fits its box over the ring's right half
        for (let rung = 0; rung < RUNGS.length; rung++) {
          p.sim.card = { kind: rung === 0 ? 'cycle' : 'change', rung, variant: 1, cycle: rung === 0 ? 1 : 0, t: 3, dur: 7, fresh: true, verse: RUNGS[rung].verse };
          p.game.draw();
          expect(p.view.cardOverflow, `${s.name} · card ${rung} (mouse)`).toBeLessThanOrEqual(0.5);
        }
      }
    });

    it('answers the mouse: a ring at what a click would act on, the button lit under it, the cursor a pointer', () => {
      const s = desks.find(x => x.name.startsWith('Full HD'))!;
      const p = play(s, { sessions: 5, pushes: 1, seen: [...ALL_SEEN] }, false);
      const L = p.view.L;
      const canvas = (p.game as unknown as { env: GameEnv<OgienProgress> }).env.canvas;
      // over the spark: the fire is what a click blows on
      p.game.pointer!({ type: 'move', x: L.cx, y: L.cy, id: 1 });
      frames(p, 1);
      expect(p.view.hoverSpot).not.toBeNull();
      expect(Math.hypot(p.view.hoverSpot!.x, p.view.hoverSpot!.y)).toBeLessThan(0.3);
      expect(canvas.style.cursor).toBe('pointer');
      // over the button: the button lit, and the spot the button's tap acts on
      p.game.pointer!({ type: 'move', x: L.btn.x + L.btn.w / 2, y: L.btn.y + L.btn.h / 2, id: 1 });
      frames(p, 1);
      expect(p.view.hoverCtl).toBe('btn');
      // the pillar of fire: the ring stands on the dark tent a click would light, the one a click then lights
      p.sim.rung = 3;
      (p.sim as unknown as { setupTask(): void }).setupTask();
      frames(p, 2);
      const dark = p.sim.tents.map((x, i) => ({ x, i })).filter(o => o.x.lit < RULES.relight && o.x.arc < 0)[0];
      const at = { x: L.cx + dark.x.x * L.R, y: L.cy + dark.x.y * L.R };
      p.game.pointer!({ type: 'move', ...at, id: 1 });
      frames(p, 1);
      const spot = p.view.hoverSpot!;
      expect(Math.hypot(spot.x - dark.x.x, spot.y - (dark.x.y - dark.x.s * 0.3))).toBeLessThan(0.01);
      p.game.pointer!({ type: 'down', ...at, id: 1 });
      p.game.pointer!({ type: 'up', ...at, id: 1 });
      expect(p.sim.tents[dark.i].arc).toBeGreaterThanOrEqual(0);
      // a phone never shows it
      const q = play(CHECK_SIZES[1]);
      q.game.pointer!({ type: 'move', x: q.view.L.cx, y: q.view.L.cy, id: 1 });
      frames(q, 1);
      expect(q.view.hoverSpot).toBeNull();
    });
  });

  it('shows the same number in the headline as the result, and the ring in its line', () => {
    const s = CHECK_SIZES[0];
    const p = play(s);
    frames(p, 60 * 12, HIGH);
    const hl = p.game.headline!();
    expect(hl.value).toBe(p.game.result().score);
    expect(hl.sub).toMatch(/%|rekordu|krąg/);
  });

  it('plays a phone session with taps on the scene: a drag of a log onto the bonfire feeds it', () => {
    const s = CHECK_SIZES[1];
    const p = play(s);
    p.sim.rung = 2;
    (p.sim as unknown as { setupTask(): void }).setupTask();
    frames(p, 2);
    const L = p.view.L;
    const ring0 = p.sim.ring;
    const pile = { x: L.pile.x + L.pile.w / 2, y: L.pile.y + L.pile.h / 2 };
    p.game.pointer!({ type: 'down', ...pile, id: 1 });
    expect(p.view.drag).not.toBeNull();
    for (let i = 1; i <= 10; i++) p.game.pointer!({ type: 'move', x: pile.x + (L.cx - pile.x) * i / 10, y: pile.y + (L.cy + L.R * 0.2 + p.view.drag!.lift - pile.y) * i / 10, id: 1 });
    p.game.pointer!({ type: 'up', x: L.cx, y: L.cy + L.R * 0.2 + 60, id: 1 });
    expect(p.view.drag).toBeNull();
    expect(p.sim.ring).toBeGreaterThan(ring0 + RULES.gains.log * 0.8);
    expect(p.sim.burning.length).toBe(1);
  });
});

describe('long sessions (15–30 minutes)', () => {
  it('plans 15, 20, 25 and 30 minutes to the finale: push and rest alternating, ending on a rest, pushes about 40 s, rests 20 s', () => {
    for (const planned of [900, 1200, 1500, 1800]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned + (first ? 1 : 0)));
        const body = first ? plan.slice(1) : plan;
        if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        body.forEach((b, i) => expect(b.kind, `${planned} #${i}`).toBe(i % 2 ? 'rest' : 'push'));
        expect(body.at(-1)!.kind).toBe('rest');
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        for (const b of body) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
          expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.16);
        }
        // about a pair a minute (40 s of kindling, two breaths of rest)
        const pairs = (planned - finaleFor(planned) - (first ? RULES.warm.long : 0)) / (RULES.push[0] + RULES.restBreaths * BREATH_SEC);
        expect(Math.abs(body.length / 2 - pairs)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('burns a whole 30-minute session: round after round of the ladder, no throw, finite numbers, the end, bounded scene', () => {
    const sim = makeSim({ planned: 1800, seed: 5, tuning: BEGINNER });
    const rnd = mulberry32(41);
    let base = 0.5, nextTap = 1, maxPairs = 0, maxWisps = 0, maxBurning = 0, finale = false;
    for (let i = 1; i <= 1806 / STEP; i++) {
      const tt = i * STEP;
      base += (rnd() - 0.5) * 0.075;
      base += ((sim.pushBlock ? 0.82 : 0.3) - base) * 0.008;
      const level = Math.max(0.03, Math.min(0.98, base + 0.05 * Math.sin(tt * 0.63)));
      sim.update(STEP, frame({ level, activity: (level - 0.5) * 8, calm: 1 - level, hold: level > 0.5 ? 4 : 0 }), tt);
      if (tt >= nextTap) {
        nextTap += 2.2;
        if (sim.card) sim.closeCard();
        sim.tap(null);
      }
      if (sim.take().some(e => e.type === 'finale')) finale = true;
      maxPairs = Math.max(maxPairs, sim.pairs.length);
      maxWisps = Math.max(maxWisps, sim.wisps.length);
      maxBurning = Math.max(maxBurning, sim.burning.length);
    }
    expect(finale).toBe(true);
    expect(sim.phase).toBe('done');
    expect(sim.blockIndex).toBe(sim.plan.length - 1);
    for (const v of [sim.sparks, sim.ring, sim.light, sim.heat, sim.cycle, sim.top]) expect(Number.isFinite(v)).toBe(true);
    // 30 minutes of good focus go round the ladder again and again, each round a little longer, never an empty end
    expect(sim.cyclesNow).toBeGreaterThanOrEqual(2);
    expect(sim.cyclesNow).toBeLessThanOrEqual(12);
    expect(sim.changesNow).toBeGreaterThanOrEqual(14);
    expect(maxPairs).toBeLessThanOrEqual(RULES.pairs + 4);
    expect(maxWisps).toBeLessThanOrEqual(RULES.wisps + 6);
    expect(maxBurning).toBeLessThanOrEqual(4);
    expect(sim.newFastest.length).toBeLessThanOrEqual(sim.changesNow);
    const r = sim.result();
    expect(r.score).toBe(Math.floor(sim.sparks));
    expect(sim.p.best['1800']).toBe(r.score);
    expect(sim.p.sky).toHaveLength(1);
    expect(r.verse).toBeTruthy();
    for (const [k, v] of r.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
    for (const h of r.highlights) expect(h).not.toMatch(/undefined|NaN/);
  });
});

describe('45–60 minutes (round 24)', () => {
  it('plans 45 and 60 minutes to the finale: push and rest alternating, ending on a rest, pushes about 40 s, rests 20 s', () => {
    for (const planned of [2700, 3600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned + (first ? 1 : 0)));
        const body = first ? plan.slice(1) : plan;
        if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        body.forEach((b, i) => expect(b.kind, `${planned} #${i}`).toBe(i % 2 ? 'rest' : 'push'));
        expect(body.at(-1)!.kind).toBe('rest');
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        expect(finaleFor(planned)).toBe(RULES.finale.long);
        for (const b of body) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
          expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.16);
        }
        const pairs = (planned - finaleFor(planned) - (first ? RULES.warm.long : 0)) / (RULES.push[0] + RULES.restBreaths * BREATH_SEC);
        expect(Math.abs(body.length / 2 - pairs)).toBeLessThanOrEqual(1);
      }
      // the lobby's own rhythm too: the player's pushes and whole-breath rests, on time
      for (const [focus, rest] of [[20, 1], [120, 4]] as const) {
        const plan = planBlocks(planned, false, mulberry32(planned), { focus, rest });
        const pushes = plan.filter(b => b.kind === 'push');
        expect(Math.abs(pushes.reduce((s, b) => s + b.dur, 0) / pushes.length - focus)).toBeLessThanOrEqual(Math.max(10, focus * 0.4));
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      }
    }
  });

  it('burns a whole hour: round after round of the ladder to the end, no throw, numbers that fit, a bounded scene, Ignacy not looping', () => {
    // Ignacy's quick cheers for the hands (3–4 variants each) come round within minutes in any session; his lines for
    // a block, a fire and a round must not loop
    const quick = new Set(['shield', 'gust', 'log', 'tent', 'fuse', 'gather', 'pass', 'blow', 'good', 'wait', 'calm', 'near']);
    for (const strong of [false, true]) {
      const sim = makeSim({ planned: 3600, seed: 5, tuning: BEGINNER });
      const rnd = mulberry32(41);
      let base = 0.5, nextTap = 1, maxPairs = 0, maxWisps = 0, maxBurning = 0, finale = false;
      let lastLine: unknown = null, minGap = Infinity, changeGap = 0, lastChange = 0, lateLines = 0;
      const heard = new Map<string, number>();
      for (let i = 1; i <= 3606 / STEP; i++) {
        const tt = i * STEP;
        base += (rnd() - 0.5) * 0.075;
        base += ((sim.pushBlock ? (strong ? 0.95 : 0.82) : 0.3) - base) * 0.008;
        const level = Math.max(0.03, Math.min(0.98, base + 0.05 * Math.sin(tt * 0.63)));
        sim.update(STEP, frame({ level, activity: (level - 0.5) * 8, calm: 1 - level, hold: level > 0.5 ? 4 : 0 }), tt);
        if (tt >= nextTap) {
          nextTap += 2.2;
          if (sim.card) sim.closeCard();
          sim.tap(null);
        }
        for (const e of sim.take()) {
          if (e.type === 'finale') finale = true;
          if (e.type === 'change') {
            changeGap = Math.max(changeGap, tt - lastChange);
            lastChange = tt;
          }
        }
        const line = sim.talk.line;
        if (line && line !== lastLine) {
          if (tt > 3000) lateLines++;
          if (!quick.has(line.moment)) {
            const prev = heard.get(line.text);
            if (prev !== undefined) minGap = Math.min(minGap, tt - prev);
            heard.set(line.text, tt);
          }
        }
        lastLine = line;
        maxPairs = Math.max(maxPairs, sim.pairs.length);
        maxWisps = Math.max(maxWisps, sim.wisps.length);
        maxBurning = Math.max(maxBurning, sim.burning.length);
      }
      const tag = strong ? 'strong' : 'good';
      expect(finale, tag).toBe(true);
      expect(sim.phase).toBe('done');
      expect(sim.blockIndex).toBe(sim.plan.length - 1);
      for (const v of [sim.sparks, sim.ring, sim.light, sim.heat, sim.cycle, sim.top]) expect(Number.isFinite(v)).toBe(true);
      // the rounds grow longer (×1.2 each) but a fire still changes every minute or two to the last minutes
      expect(sim.cyclesNow, tag).toBeGreaterThanOrEqual(5);
      expect(sim.cyclesNow, tag).toBeLessThanOrEqual(16);
      expect(changeGap, tag).toBeLessThan(180);
      expect(lastChange, tag).toBeGreaterThan(3300);
      expect(maxPairs).toBeLessThanOrEqual(RULES.pairs + 4);
      expect(maxWisps).toBeLessThanOrEqual(RULES.wisps + 6);
      expect(maxBurning).toBeLessThanOrEqual(4);
      // Ignacy still speaks in the last ten minutes; a line of a block or a fire comes back after a block or more
      expect(lateLines, tag).toBeGreaterThan(20);
      expect(minGap, tag).toBeGreaterThan(30);
      const r = sim.result();
      expect(r.score).toBe(Math.floor(sim.sparks));
      expect(String(r.score).length, tag).toBeLessThanOrEqual(7);
      expect(sim.p.best['3600']).toBe(r.score);
      expect(sim.p.sky).toHaveLength(1);
      expect(r.highlights.length).toBeLessThanOrEqual(5);
      expect(r.stats.length).toBeLessThanOrEqual(7);
      for (const [k, v] of r.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
      for (const h of r.highlights) expect(h).not.toMatch(/undefined|NaN/);
    }
  }, 120_000);
});

describe('the rest’s rhythm and the breath guide (round 15)', () => {
  it('offers seconds of kindling (40: 20–120) and whole breaths of rest (2: 1–4) in the lobby', () => {
    const spec = rhythm();
    expect(ogien.ownBreath).toBe(true);
    expect(ogien.rhythm).toBeDefined();
    expect([spec.focus.def, spec.focus.min, spec.focus.max, spec.focus.step]).toEqual([40, 20, 120, 5]);
    expect([spec.rest.def, spec.rest.min, spec.rest.max]).toEqual([2, 1, 4]);
    expect(spec.focus.name).toBe(t('rhythm.focus'));
    expect(spec.restSec!(4)).toBe(40);
    expect(rhythmOf(spec, { focus: 300, rest: 0 })).toEqual({ focus: 120, rest: 1, custom: true });
  });

  it('plans the player’s pushes and whole-breath rests, and completes 3, 10 and 30 minutes on time', () => {
    for (const [focus, rest] of [[20, 1], [40, 2], [80, 3], [120, 4]] as const) {
      for (const sec of [180, 600, 1800]) {
        const plan = planBlocks(sec, false, mulberry32(sec), { focus, rest });
        const pushes = plan.filter(b => b.kind === 'push');
        const id = `${focus}/${rest} · ${sec}`;
        const mean = pushes.reduce((s, b) => s + b.dur, 0) / pushes.length;
        expect(Math.abs(mean - focus), id).toBeLessThanOrEqual(Math.max(10, focus * 0.4));
        for (const b of plan.filter(x => x.kind === 'rest')) expect(b.dur % BREATH_SEC, id).toBeCloseTo(0, 6);
        expect(plan.reduce((s, b) => s + b.dur, 0), id).toBeCloseTo(sec - finaleFor(sec), 5);
      }
    }
    for (const planned of [180, 600, 1800]) {
      for (const r of [null, { focus: 20, rest: 1 }, { focus: 120, rest: 4 }]) {
        const sim = later({ planned, rhythm: r });
        const clock = { t: 0 };
        let guard = 0;
        while (sim.phase !== 'done' && guard++ < 1000) drive(sim, 5, () => (sim.restBlock ? CALM : MID), clock);
        expect(sim.phase, `${planned} · ${JSON.stringify(r)}`).toBe('done');
        expect(clock.t).toBeLessThanOrEqual(planned + RULES.settle + 5.1);
      }
    }
  }, 180_000);

  it('guides the rest’s whole breaths from its start, and draws the guide clear of the fire, the ring and the button', () => {
    const sim = later({ rhythm: { focus: 40, rest: 3 } });
    const clock = until(sim, 'rest', MID);
    expect(sim.breaths).toBe(3);
    expect(sim.breathNow!.phase).toBe('in');
    drive(sim, 4.2, CALM, clock);
    expect(sim.breathNow!.phase).toBe('out');
    expect(sim.breath.in).toBe(false);
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    const ctx = { font: '10px sans-serif', measureText(this: { font: string }, text: string) { return { width: [...text].length * Number(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10) * 0.6 } as TextMetrics; } } as unknown as CanvasRenderingContext2D;
    for (const touch of [true, false]) {
      for (const c of CHECK_SIZES) {
        const view = new OgienView(canvas, { reducedMotion: false, touch });
        view.resize(c.w, c.h, 1, c.insets);
        const o = view.breathPlace(ctx, sim);
        const id = `${c.name} · ${touch ? 'touch' : 'mouse'}`;
        expect(o, id).not.toBeNull();
        const L = view.L, box = breathGuideBox(ctx, o!);
        expect(o!.r, id).toBeGreaterThanOrEqual(26);
        expect(box.y, id).toBeGreaterThanOrEqual(L.top - 0.5);
        expect(box.y + box.h, id).toBeLessThanOrEqual(L.bottom + 0.5);
        expect(box.x, id).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w, id).toBeLessThanOrEqual(L.w + 0.5);
        // never over the fire (the ring's inner half) nor the button
        const dx = Math.max(box.x - L.cx, 0, L.cx - (box.x + box.w)), dy = Math.max(box.y - L.cy, 0, L.cy - (box.y + box.h));
        expect(Math.hypot(dx, dy), id).toBeGreaterThanOrEqual(L.R * 0.75);
        const b = L.btn;
        const overlap = box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y;
        expect(overlap, id).toBe(false);
      }
    }
  });
});
