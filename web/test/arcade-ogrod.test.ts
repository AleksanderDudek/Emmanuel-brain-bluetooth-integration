// @vitest-environment happy-dom
/**
 * Ogród o świcie (builder A's half): the plan on the lead's frame, the session (only focus does an act, grace finishes
 * gently, a "not yet" stone is held), the progress, the words in four languages, the layout at every checked size and
 * the lobby's card.  Builder B's half (the preparation, the week, the sound) has its own tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { breathGuideBox, breathOf } from '../src/arcade/kit/breathguide';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, auditTargets, type Rect } from '../src/arcade/kit/mobile';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { ALL_VERSES, MOMENTS, ROOT, VERSES, verseFor } from '../src/arcade/ogrod/content';
import { CATALOGS, linesOf, t, unit, type Key } from '../src/arcade/ogrod/i18n';
import { gardenRhythm, howto } from '../src/arcade/ogrod/index';
import { layout } from '../src/arcade/ogrod/layout';
import { peekLetter, setLetter, takeLetter } from '../src/arcade/ogrod/letter';
import { BREATH_DEF, addWeight, bestOf, freshProgress, migrate, type OgrodProgress } from '../src/arcade/ogrod/meta';
import { forecastLines, progressPanel } from '../src/arcade/ogrod/panel';
import { freshPrep, weekOf, type GardenPrep } from '../src/arcade/ogrod/prep';
import { CATALOGS as PREP_TEXTS } from '../src/arcade/ogrod/prep-i18n';
import { RULES, actsRange, focusRate, planFor, restInFor, type BlockWhat, type Plan } from '../src/arcade/ogrod/rules';
import { GardenSim, type SimEvent } from '../src/arcade/ogrod/sim';
import { STATIONS, TIMING, frameOf, stationsFor, type StationId } from '../src/arcade/ogrod/stations';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, LANGS, type Lang } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { ARCADE, arcadeEntry } from '../src/arcade/registry';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const DAY = '2026-11-25';
const CYC = breathCycle(BREATH_DEF);
/** the breath presets' cycles: 10 s (4 · 6, 5 · 5), 16 s (the box), 19 s (4 · 7 · 8) */
const CYCLES = [...new Set(Object.values(BREATH_PRESETS).map(breathCycle))];
const LENGTHS = SESSION_MINUTES.map(m => m * 60);

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
/** the average player: a little above the threshold, held a while */
const AVG = frame({ level: 0.62, activity: 3, focused: true, hold: 6, calm: 0.2 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });

type Opts = {
  progress?: Partial<OgrodProgress>; prep?: Partial<GardenPrep>; planned?: number; seed?: number; eeg?: boolean;
  rhythm?: { focus: number; rest: number; custom: boolean } | null; first?: boolean;
};

function makeSim(o: Opts = {}): GardenSim {
  const base: OgrodProgress = o.first ? freshProgress() : { ...freshProgress(), sessions: 4, seen: ['c.tap', 'c.act', 'c.settle', 'c.flower'] };
  const progress = { ...base, ...o.progress, prep: { ...freshPrep(), ...o.prep } } as OgrodProgress;
  const sim = new GardenSim({
    progress, rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null, day: DAY,
  });
  sim.start();
  return sim;
}

type FrameFn = (t: number, sim: GardenSim) => FocusFrame;
/** Play `sec` seconds with the frame given (or a function of the time and the sim). */
function drive(sim: GardenSim, sec: number, f: FocusFrame | FrameFn, clock = { t: 0 }, out: SimEvent[] = []): SimEvent[] {
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}
/** Play until `done` (at most `max` s). */
function until(sim: GardenSim, done: (s: GardenSim) => boolean, f: FocusFrame | FrameFn, clock: { t: number }, out: SimEvent[] = [], max = 4000): SimEvent[] {
  for (let i = 0; i < max / STEP && !done(sim); i++) drive(sim, STEP, f, clock, out);
  return out;
}
/** A player who focuses in the pushes with `push` and rests elsewhere. */
const player = (push: FocusFrame): FrameFn => (_t, s) => (s.pushBlock ? push : LOW);
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
const cues = (evs: readonly SimEvent[]): string[] => ofType(evs, 'cue').map(e => e.cue);

/** The blocks' `what` in order, one letter each, to read the plan's shape at a glance. */
const SHAPE: Readonly<Record<BlockWhat, string>> = { arrive: 'A', open: 'O', act: 'p', settle: 's', sunrise: 'S', call: 'C', prayer: 'P', close: 'E' };
const shapeOf = (p: Plan): string => p.blocks.map(b => SHAPE[b.what]).join('');

const WAYS: (StationId[] | null)[] = [null, [...STATIONS], ['lzy'], ['nasiona', 'furtka'], ['kamienie', 'latarnie', 'dlon']];
const MANY = { feelings: 3, stones: 3, lanterns: 8, seeds: 3 };

describe('Ogród o świcie — the plan', () => {
  it('fills every session length 3–30 min and a ≤ 60 s test: blocks contiguous, in order, ending at T', () => {
    for (const T of [...LENGTHS, 40, 60]) for (const way of WAYS) for (const cyc of CYCLES) for (const eeg of [false, true]) for (const counts of [{}, MANY]) {
      const p = planFor({ plannedSec: T, cyc, eeg, way, counts });
      const name = `${T} s ${way?.join('+') ?? 'recommended'} cyc ${cyc} ${eeg ? 'eeg' : 'fnirs'}`;
      // the lead's stations, in the way's order
      expect(p.stations.map(s => s.id), name).toEqual(stationsFor(T, way));
      // contiguous from 0 to T, every block of some length or none
      expect(p.blocks[0].t0).toBe(0);
      for (let i = 1; i < p.blocks.length; i++) expect(Math.abs(p.blocks[i].t0 - p.blocks[i - 1].t1), name).toBeLessThan(1e-9);
      for (const b of p.blocks) expect(b.t1, name).toBeGreaterThanOrEqual(b.t0);
      expect(Math.abs(p.blocks[p.blocks.length - 1].t1 - T), name).toBeLessThan(1e-6);
      // the arrival, each station's opening and its acts (a push, then a settle), the dawn's four parts
      expect(shapeOf(p), name).toBe('A' + p.stations.map(s => 'O' + s.acts.map(a => (a.rest > 0 ? 'ps' : 'p')).join('')).join('') + 'SCPE');
      for (const b of p.blocks) expect(b.kind, `${name} ${b.what}`).toBe(b.what === 'act' ? 'push' : b.what === 'close' ? 'free' : 'rest');
      // the station and act each block belongs to, in order
      const own = p.blocks.filter(b => b.station >= 0);
      for (let i = 1; i < own.length; i++) expect(own[i].station).toBeGreaterThanOrEqual(own[i - 1].station);
      expect(p.dawnStart).toBe(p.blocks.find(b => b.what === 'sunrise')!.t0);
      expect(p.arriveEnd).toBeGreaterThan(0);
      expect(p.sunriseEnd).toBeGreaterThan(p.dawnStart);
      expect(p.callEnd).toBeGreaterThan(p.sunriseEnd);
      expect(T - p.prayerEnd, name).toBeGreaterThan(0);
      if (T <= TIMING.testSec) {
        // a test: one station, one act whose push sees well past the lead-in
        expect(p.test).toBe(true);
        expect(p.stations).toHaveLength(1);
        expect(p.stations[0].acts).toHaveLength(1);
        expect(p.stations[0].acts[0].push - p.lead, name).toBeGreaterThanOrEqual(8);
        continue;
      }
      const f = frameOf(T);
      // the arrival is whole breaths near the frame's; the dawn never shorter than the frame gives it
      expect(Math.abs(p.arriveEnd - f.arrive), name).toBeLessThanOrEqual(cyc / 2 + 1e-6);
      expect(p.arriveEnd / cyc).toBeCloseTo(Math.round(p.arriveEnd / cyc), 9);
      expect(T - p.dawnStart, name).toBeGreaterThanOrEqual(f.dawn - 1e-6);
      expect(T - p.prayerEnd, name).toBeGreaterThanOrEqual(Math.min(RULES.closeMin, 0.4 * (T - p.dawnStart)) - 1e-6);
      for (const s of p.stations) {
        expect(s.open, name).toBeLessThanOrEqual(cyc + 1e-9);
        expect(s.open, name).toBeGreaterThanOrEqual(Math.min(cyc, RULES.openMin) - 1e-9);
        for (const a of s.acts) {
          expect(a.push - p.lead, name).toBeGreaterThanOrEqual(RULES.pushMinSighted - 1e-6);
          expect(a.push, name).toBeLessThanOrEqual(RULES.pushMax + 1e-6);
          // settles are whole breaths
          expect(a.breaths, name).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(a.breaths)).toBe(true);
          expect(a.rest).toBeCloseTo(a.breaths * cyc, 9);
        }
      }
    }
  });

  it('walks the recommended way by default, more acts as the length grows — never more than the player’s words', () => {
    expect(planFor({ plannedSec: 180, cyc: CYC, eeg: false }).stations.map(s => s.id)).toEqual(['lzy', 'dlon']);
    expect(planFor({ plannedSec: 300, cyc: CYC, eeg: false }).stations.map(s => s.id)).toEqual(['lzy', 'dlon', 'list']);
    expect(planFor({ plannedSec: 600, cyc: CYC, eeg: false }).stations.map(s => s.id)).toEqual(['lzy', 'dlon', 'list', 'kamienie', 'latarnie']);
    for (const m of [15, 20, 25, 30]) expect(planFor({ plannedSec: m * 60, cyc: CYC, eeg: false }).stations.map(s => s.id)).toEqual([...STATIONS]);
    for (const counts of [{}, MANY, { feelings: 2, stones: 1, lanterns: 3, seeds: 2 }]) {
      let prev = 0;
      for (const T of LENGTHS) {
        const p = planFor({ plannedSec: T, cyc: CYC, eeg: false, counts, way: [...STATIONS] });
        const n = p.stations.reduce((k, s) => k + s.acts.length, 0);
        expect(n, `${T}`).toBeGreaterThanOrEqual(prev);
        prev = n;
        const c = { feelings: 1, stones: 1, lanterns: 2, seeds: 1, ...counts };
        for (const s of p.stations) {
          const r = actsRange(s.id, c);
          expect(s.acts.length, `${T} ${s.id}`).toBeGreaterThanOrEqual(1);
          expect(s.acts.length, `${T} ${s.id}`).toBeLessThanOrEqual(r.max);
        }
        // the stones and the lanterns are the player's own: never more acts than they brought
        for (const s of p.stations) if (s.id === 'kamienie') expect(s.acts.length).toBeLessThanOrEqual(c.stones);
        for (const s of p.stations) if (s.id === 'latarnie') expect(s.acts.length).toBeLessThanOrEqual(c.lanterns);
      }
    }
    // from 15 minutes every station of the whole way gets the acts the default words bring
    const whole = planFor({ plannedSec: 900, cyc: CYC, eeg: false });
    for (const s of whole.stations) expect(s.acts.length, s.id).toBeGreaterThanOrEqual(actsRange(s.id, { feelings: 1, stones: 1, lanterns: 2, seeds: 1 }).want);
    // a way much too short for its length says so (the lobby's forecast tells it)
    expect(planFor({ plannedSec: 1800, cyc: CYC, eeg: false, way: ['lzy'] }).short).toBe(true);
    expect(planFor({ plannedSec: 900, cyc: CYC, eeg: false }).short).toBe(false);
  });

  it('honours the rhythm dials: the player’s push and settle where they fit, and restIn when a short session shortens it', () => {
    const dials = [{ f: 15, r: 1 }, { f: 25, r: 2 }, { f: 30, r: 3 }, { f: 45, r: 4 }];
    for (const T of LENGTHS) for (const d of dials) for (const way of [null, [...STATIONS]]) {
      const p = planFor({ plannedSec: T, cyc: CYC, eeg: false, way, focus: d.f, rest: d.r, custom: true });
      const name = `${T} s ${d.f}/${d.r} ${way ? 'all' : 'rec'}`;
      const pushes = p.stations.flatMap(s => s.acts.map(a => a.push));
      const breaths = p.stations.flatMap(s => s.acts.map(a => a.breaths));
      const kept = restInFor(d.f, d.r, T, CYC, way);
      expect(kept, name).toBe(p.breaths);
      expect(kept, name).toBeLessThanOrEqual(d.r);
      // the settles never shorter than the lobby says, the pushes never longer than the dial
      for (const b of breaths) expect(b, name).toBeGreaterThanOrEqual(kept);
      for (const x of pushes) expect(x, name).toBeLessThanOrEqual(d.f + 1e-6);
      if (kept === d.r) {
        // it all fits: the push is the dial's, every settle is the dial's (a way much too short lets them grow)
        for (const x of pushes) expect(x, name).toBeCloseTo(d.f, 6);
        if (!p.short) for (const b of breaths) expect(b, name).toBe(d.r);
      }
    }
    // a 3-minute session has no room for four-breath settles: the lobby says it keeps one; 30 minutes keep them
    expect(restInFor(45, 4, 180, CYC)).toBe(1);
    expect(restInFor(45, 4, 1800, CYC)).toBe(4);
    // by design a session under 10 minutes builds on one-breath settles (more acts fit), from 10 on on two
    for (const T of LENGTHS) expect(planFor({ plannedSec: T, cyc: CYC, eeg: false }).breaths, `${T}`).toBe(T < RULES.shortSec ? RULES.rest.min : RULES.rest.def);
    // the lobby's dials
    const r = gardenRhythm();
    expect([r.focus.def, r.focus.min, r.focus.max, r.focus.step]).toEqual([RULES.focus.def, RULES.focus.min, RULES.focus.max, RULES.focus.step]);
    expect([r.rest.def, r.rest.min, r.rest.max]).toEqual([RULES.rest.def, RULES.rest.min, RULES.rest.max]);
    expect(r.restSec?.(2)).toBe(2 * CYC);
    expect(r.restIn?.({ focus: 45, rest: 4 }, 180)).toBe(1);
    const box = { ...freshProgress(), breath: { ...BREATH_PRESETS.box } };
    expect(gardenRhythm(box).restSec?.(1)).toBe(breathCycle(BREATH_PRESETS.box));
    // the lobby's restIn reads the player's own way as it is now: more stations, less room for long settles
    const mine = freshProgress();
    const spec = gardenRhythm(mine);
    expect(spec.restIn?.({ focus: 25, rest: 2 }, 180)).toBe(2);
    mine.prep.way = [...STATIONS];
    expect(spec.restIn?.({ focus: 25, rest: 2 }, 180)).toBe(restInFor(25, 2, 180, CYC, STATIONS));
    expect(spec.restIn?.({ focus: 25, rest: 2 }, 180)).toBe(1);
    // the session plays the player's dials (the runner's env.rhythm)
    const own = makeSim({ planned: 1200, rhythm: { focus: 30, rest: 3, custom: true } });
    expect(own.plan.short).toBe(false);
    for (const s of own.plan.stations) for (const a of s.acts) expect([a.push, a.breaths], s.id).toEqual([30, 3]);
    expect(own.acts.every(a => Math.abs(a.t1 - a.t0 - 30) < 1e-9)).toBe(true);
  });

  it('moves an act only with focus: no rate without it, faster above the threshold and as it is held', () => {
    expect(focusRate(0.9, false, 10)).toBe(0);
    expect(focusRate(0.5, true, 0)).toBeGreaterThan(0);
    expect(focusRate(0.9, true, 12)).toBeGreaterThan(focusRate(0.55, true, 0));
    expect(focusRate(0.7, true, 12)).toBeGreaterThan(focusRate(0.7, true, 0));
    expect(focusRate(Number.NaN, true, Number.NaN)).toBeGreaterThan(0);
  });
});

describe('Ogród o świcie — the session', () => {
  it('moves an act only in a sighted push past its lead-in, with a reliable signal, while focused', () => {
    for (const eeg of [false, true]) {
      const sim = makeSim({ planned: 600, eeg });
      const clock = { t: 0 };
      until(sim, s => s.block.what === 'act', LOW, clock);
      const a = sim.act!;
      expect(a.id).toBe('lzy');
      // the lead-in: strong focus, nothing moves yet
      drive(sim, sim.lead - 0.3, HIGH, clock);
      expect(sim.sighted).toBe(false);
      expect(a.p).toBe(0);
      drive(sim, 0.6, LOW, clock);
      expect(sim.sighted).toBe(true);
      // no reliable signal, or not focused: still nothing
      drive(sim, 3, { ...HIGH, reliable: false }, clock);
      expect(a.p).toBe(0);
      drive(sim, 3, { ...HIGH, focused: false }, clock);
      expect(a.p).toBe(0);
      // focus: the act moves
      drive(sim, 2, HIGH, clock);
      expect(a.p).toBeGreaterThan(0);
      expect(a.done).toBeNull();
    }
  });

  it('waits without focus — nothing forced — and says so once', () => {
    const sim = makeSim({ planned: 600 });
    const clock = { t: 0 };
    until(sim, s => s.block.what === 'act', LOW, clock);
    const a = sim.act!;
    drive(sim, a.t1 - clock.t - 0.2, LOW, clock);
    expect(a.p).toBe(0);
    const evs = until(sim, s => s.block.what !== 'act', LOW, clock);
    expect(a.done).toBe('grace');
    expect(ofType(evs, 'flower')).toHaveLength(0);
    const wait = linesOf('wait');
    expect(sim.talk.said.filter(s => wait.includes(s))).toHaveLength(1);
  });

  it('finishes an unfinished act gently by grace at its push’s end — begun or not — and grows no flower for it', () => {
    const sim = makeSim({ planned: 600 });
    const clock = { t: 0 };
    until(sim, s => s.block.what === 'act', LOW, clock);
    const a = sim.act!;
    // a little focus: begun, not done
    drive(sim, sim.lead + 1.5, HIGH, clock);
    expect(a.p).toBeGreaterThan(0);
    expect(a.p).toBeLessThan(1);
    const evs = until(sim, s => s.block.what !== 'act', LOW, clock);
    expect(sim.block.what).toBe('settle');
    expect(a.done).toBe('grace');
    expect(a.p).toBe(1);
    expect(ofType(evs, 'done')).toEqual([{ type: 'done', act: sim.acts.indexOf(a), by: 'grace' }]);
    expect(cues(evs)).toContain('grace');
    expect(a.flowers).toBe(0);
    expect(sim.score).toBe(0);
  });

  it('holds a “not yet” stone in the open hand: never dropped, not even by grace, and no flower lost for it', () => {
    const stones = [{ w: { k: 'zal-osoba' }, ready: false }, { w: { k: 'zal-siebie' }, ready: true }];
    // no focus at all: both stones stay held — none is let go for the player
    const quiet = makeSim({ planned: 600, prep: { way: ['kamienie'], stones } });
    expect(quiet.acts.map(a => a.kind)).toEqual(['hold', 'drop']);
    const qe = drive(quiet, 600.2, LOW);
    expect(quiet.acts.map(a => a.done)).toEqual(['kept', 'kept']);
    expect(cues(qe)).not.toContain('grace');
    expect(cues(qe)).not.toContain('stone');
    expect(quiet.tally).toMatchObject({ focus: 0, grace: 0, kept: 2, dropped: 0 });
    expect(quiet.talk.said.some(s => linesOf('kamienieKeep').includes(s))).toBe(true);
    quiet.finish();
    expect(quiet.p.stones).toBe(0);
    expect(quiet.result().highlights).toContain(t('hl.kept'));
    // focus: the held stone warms in the open hand (a flower), the ready one falls into the pond (a flower, rings)
    const warm = makeSim({ planned: 600, prep: { way: ['kamienie'], stones } });
    const we = drive(warm, 600.2, player(HIGH));
    const [hold, drop] = warm.acts;
    expect(hold.done).toBe('focus');
    expect(drop.done).toBe('focus');
    expect(hold.flowers).toBeGreaterThanOrEqual(1);
    expect(hold.flowers).toBe(drop.flowers);
    expect(cues(we).filter(c => c === 'stone')).toHaveLength(1);
    expect(cues(we)).toContain('warm');
    expect(cues(we)).toContain('ring');
    expect(warm.tally).toMatchObject({ focus: 2, kept: 0, dropped: 1 });
    warm.finish();
    expect(warm.p.stones).toBe(1);
    // the band asks to hold, never to let go, for a "not yet" stone
    const tip = makeSim({ planned: 600, prep: { way: ['kamienie'], stones } });
    until(tip, s => s.block.what === 'act', LOW, { t: 0 });
    expect(tip.tip).toBe(t('task.hold'));
  });

  it('grows flowers only from focus: none without it, none from focus in the rests, buds where the acts were', () => {
    for (const T of [180, 600]) {
      const none = makeSim({ planned: T });
      drive(none, T + 0.2, LOW);
      expect(none.score).toBe(0);
      expect(none.result().highlights).toContain(t('hl.quiet'));
      const restOnly = makeSim({ planned: T });
      drive(restOnly, T + 0.2, (_t, s) => (s.pushBlock ? LOW : HIGH));
      expect(restOnly.score, `${T}`).toBe(0);
      const strong = makeSim({ planned: T });
      drive(strong, T + 0.2, player(HIGH));
      expect(strong.score).toBeGreaterThanOrEqual(strong.acts.length);
      expect(strong.score).toBeLessThanOrEqual(strong.acts.length * (1 + RULES.abideMax));
      for (const f of strong.flowers) {
        const a = strong.acts[f.act];
        expect(a.done).toBe('focus');
        expect(f.station).toBe(a.id);
        expect(f.born).toBeGreaterThanOrEqual(a.t0 + strong.lead);
        expect(f.born).toBeLessThanOrEqual(a.t1 + STEP);
        expect(Number.isFinite(f.spot.x) && Number.isFinite(f.spot.y)).toBe(true);
      }
      expect(strong.score).toBe(strong.acts.reduce((n, a) => n + a.flowers, 0));
    }
  });

  it('lets the average player do the acts with focus, and a stronger one grow more', () => {
    for (const T of [300, 600, 1200]) {
      const avg = makeSim({ planned: T, seed: 11 });
      drive(avg, T + 0.2, player(AVG));
      const strong = makeSim({ planned: T, seed: 11 });
      drive(strong, T + 0.2, player(HIGH));
      expect(avg.tally.focus, `${T}`).toBeGreaterThanOrEqual(Math.max(1, avg.tally.all - 1));
      expect(strong.score, `${T}`).toBeGreaterThanOrEqual(avg.score);
      expect(strong.score, `${T}`).toBeGreaterThan(strong.tally.focus);
    }
  });

  it('a test session (≤ 60 s; app:smoke plays 40 s) reaches the dawn with a flower when focus is held — first-ever and returning, Mendi and HALO', () => {
    // app:smoke's simulator: focus on about half the time (2 s on, 2 s off)
    const half: FrameFn = (t, s) => (s.pushBlock && Math.floor(t / 2) % 2 === 0 ? AVG : LOW);
    for (const T of [40, 60]) for (const eeg of [false, true]) for (const first of [true, false]) for (const f of [HIGH, player(HIGH), player(AVG), half]) {
      const sim = makeSim({ planned: T, seed: T, eeg, first });
      const name = `${T} s ${eeg ? 'eeg' : 'fnirs'} ${first ? 'first' : 'returning'}`;
      const clock = { t: 0 };
      until(sim, s => s.block.what === 'sunrise', f, clock);
      expect(sim.place, name).toBe('dawn');
      expect(sim.score, name).toBeGreaterThanOrEqual(1);
      drive(sim, T - clock.t + 0.2, LOW, clock);
      expect(sim.block.what).toBe('close');
      drive(sim, RULES.rateWait + 0.5, LOW, clock);
      expect(sim.canStop(), name).toBe(true);
    }
  });

  it('always reaches the close and its end, at every length, with any focus — Mendi and HALO', () => {
    for (const T of [40, 60, ...LENGTHS]) for (const f of [LOW, player(AVG), player(HIGH)]) for (const eeg of [false, true]) {
      const sim = makeSim({ planned: T, seed: T, eeg });
      const name = `${T} s ${eeg ? 'eeg' : 'fnirs'}`;
      const clock = { t: 0 };
      drive(sim, T - 1, f, clock);
      expect(sim.canStop(), name).toBe(false);
      drive(sim, 1.2, f, clock);
      expect(sim.block.what, name).toBe('close');
      expect(sim.place).toBe('close');
      expect(sim.canStop(), name).toBe(false);
      // every act ended: by focus, by grace, or (a stone) kept
      expect(sim.acts.every(a => a.done !== null), name).toBe(true);
      const tl = sim.tally;
      expect(tl.focus + tl.grace + tl.kept).toBe(tl.all);
      expect(sim.walked).toBe(sim.plan.stations.length);
      drive(sim, RULES.rateWait + 0.5, LOW, clock);
      expect(sim.canStop(), name).toBe(true);
    }
    // an answer ends the waiting at once, never before the session's end
    const sim = makeSim({ planned: 180 });
    const clock = { t: 0 };
    until(sim, s => s.rateOpen, LOW, clock);
    expect(sim.rate10(3)).toBe(true);
    expect(sim.rate10(5)).toBe(false);
    expect(sim.canStop()).toBe(false);
    drive(sim, 180 - clock.t + 0.1, LOW, clock);
    expect(sim.canStop()).toBe(true);
    expect(sim.rating).toBe(3);
  });

  it('turns the sky from the night to the risen sun as the way is walked, and opens the buds at the sunrise', () => {
    const sim = makeSim({ planned: 600 });
    const clock = { t: 0 };
    let prev = -1;
    const P = sim.plan;
    for (let i = 0; i < 600 / 2; i++) {
      drive(sim, 2, player(HIGH), clock);
      expect(sim.sky).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = sim.sky;
      if (clock.t < P.arriveEnd) expect(sim.sky).toBeLessThan(0.05);
      if (clock.t < P.dawnStart) expect(sim.sky).toBeLessThanOrEqual(RULES.skyStations + 1e-9);
      const n = sim.flowers.length;
      if (clock.t < P.dawnStart) for (let k = 0; k < n; k++) expect(sim.bloomOf(k, n)).toBe(0);
      if (clock.t >= P.sunriseEnd) {
        expect(sim.sky).toBe(1);
        for (let k = 0; k < n; k++) expect(sim.bloomOf(k, n)).toBe(1);
      }
    }
    expect(sim.flowers.length).toBeGreaterThan(0);
  });

  it('calls by name at dawn: the gardener’s passage, then the name in light — or “I have called you by name”', () => {
    for (const name of ['Marysiu', '']) for (const T of [900, 1800]) {
      const sim = makeSim({ planned: T, prep: { name } });
      const clock = { t: 0 };
      until(sim, s => s.block.what === 'call', LOW, clock);
      const dur = sim.dur;
      // what the band shows over the call, and for how long
      const seen = new Map<string, number>();
      const phases = new Set<string>();
      const out: SimEvent[] = [];
      while (sim.block.what === 'call') {
        phases.add(sim.callPhase);
        if (sim.card) seen.set(sim.card.id, (seen.get(sim.card.id) ?? 0) + STEP);
        drive(sim, STEP, LOW, clock, out);
      }
      expect([...phases], `${T} ${name}`).toEqual(['say', 'verse', 'name']);
      expect(cues(out).filter(c => c === 'call')).toHaveLength(1);
      const jn = seen.get('jhn20.15-16') ?? 0;
      if (name) {
        // the passage (~20 s to read) stays while the name rises in light: all of the call after the narrator's line
        expect(jn, `${T}`).toBeGreaterThan(dur - RULES.callSay - 1);
        expect(seen.has('isa43.1')).toBe(false);
        expect(sim.name).toBe(name);
      } else {
        expect(jn, `${T}`).toBeGreaterThan(0.62 * dur - RULES.callSay - 1);
        expect(seen.get('isa43.1') ?? 0, `${T}`).toBeGreaterThan(0.3 * dur);
        expect(sim.name).toBeNull();
      }
    }
  });

  it('settles once: the result is idempotent, records only rise, the before belongs to its session', () => {
    const p = { ...freshProgress(), sessions: 2, best: 1, prep: { ...freshPrep(), before: 7 } } as OgrodProgress;
    const sim = new GardenSim({ progress: p, rng: mulberry32(5), plannedSec: 300, eeg: false, tuning: TUNING, day: DAY });
    sim.start();
    drive(sim, 300.5, player(HIGH));
    sim.rate10(3);
    sim.finish();
    sim.finish();
    const a = JSON.stringify(sim.result()), b = JSON.stringify(sim.result());
    expect(a).toBe(b);
    expect(p.sessions).toBe(3);
    expect(p.best).toBe(sim.score);
    expect(p.flowers).toBe(sim.score);
    expect(p.acts).toBe(sim.tally.focus);
    expect(p.ways).toBe(1);
    expect(p.lastLen).toBe(300);
    expect(p.history).toEqual([{ day: DAY, before: 7, after: 3 }]);
    expect(p.prep.before).toBeNull();
    expect(sim.result().record).toBe(true);
    expect(sim.result().score).toBe(sim.score);
    expect(sim.result().unit).toBe(unit(sim.score));
    expect(sim.result().verse).toBe(sim.closingVerse);
    expect(VERSES.close).toContain(sim.result().verse);
    expect(sim.result().stats).toContainEqual([t('stat.heavy'), '7 → 3']);
    // a quieter session after it: the record stays, the totals grow, the next one asks "before" again
    const best = p.best, flowers = p.flowers;
    const next = new GardenSim({ progress: p, rng: mulberry32(6), plannedSec: 300, eeg: false, tuning: TUNING, day: DAY });
    next.start();
    drive(next, 306.5, player(AVG));
    next.finish();
    expect(next.score).toBeLessThan(best);
    expect(p.best).toBe(best);
    expect(p.flowers).toBe(flowers + next.score);
    expect(p.sessions).toBe(4);
    expect(next.result().record).toBe(false);
    // no answer: no history entry, no "before → after" line
    expect(p.history).toHaveLength(1);
    expect(next.result().stats.some(([k]) => k === t('stat.heavy'))).toBe(false);
    expect(next.closingVerse).not.toBe(sim.closingVerse);
  });

  it('never puts own words, names or the letter into the result, nor the letter into the progress', () => {
    const own = {
      feel: 'tęsknota qxa', harsh: 'nic nie umiem qxb', kind: 'umiem kochać qxc', bound: 'jego zdjęcia qxd', stone: 'żal do Marka qxe', seed: 'pisanie qxf',
    };
    const names = ['Zuzanna', 'Bartosz'], call = 'Marysiu';
    const letter = 'Drogi Tomku, piszę ten list qxletter, choć go nie wyślę.';
    setLetter(letter);
    const prep: Partial<GardenPrep> = {
      way: null, feelings: [{ o: own.feel }], kind: { harsh: { o: own.harsh }, kind: { o: own.kind } }, bounds: [{ o: own.bound }],
      intention: 'i1', stones: [{ w: { o: own.stone }, ready: true }], friends: names, hurt: true, seeds: [{ o: own.seed }], name: call, before: 8,
    };
    const sim = makeSim({ planned: 900, prep });
    // the session has the letter, the lobby no more
    expect(sim.letter).toBe(letter);
    expect(peekLetter()).toBe('');
    // the words are on the scene
    expect(sim.acts.map(a => a.word)).toEqual(expect.arrayContaining([own.feel, own.kind, own.stone, own.seed]));
    expect(sim.view.harsh).toBe(own.harsh);
    expect(sim.view.bounds).toEqual([own.bound]);
    expect(sim.lanternText(1)).toContain(names[0]);
    expect(sim.name).toBe(call);
    drive(sim, 900.5, player(AVG));
    sim.rate10(4);
    sim.finish();
    const txt = JSON.stringify(sim.result());
    for (const w of [...Object.values(own), ...names, call, 'qx', 'Tomku', 'Marka']) expect(txt, w).not.toContain(w);
    expect(txt).toContain('8 → 4');
    const saved = JSON.stringify(sim.p);
    for (const w of ['qxletter', 'Tomku', 'nie wyślę']) expect(saved, w).not.toContain(w);
    expect(Object.keys(sim.p)).not.toContain('letter');
    expect(Object.keys(sim.p.prep)).not.toContain('letter');
    expect(sim.p.prep.before).toBeNull();
    expect(sim.p.history.at(-1)).toEqual({ day: DAY, before: 8, after: 4 });
  });

  it('leaves the week for the lobby’s card: the boundary, the friends and the seeds of the stations walked', () => {
    const prep: Partial<GardenPrep> = { intention: 'i2', friends: ['Ania'], seeds: [{ o: 'muzyka' }] };
    const whole = makeSim({ planned: 900, prep });
    drive(whole, 900.5, LOW);
    whole.finish();
    expect(whole.p.week).toEqual(weekOf(whole.p.prep, DAY, STATIONS));
    expect(whole.p.week).toMatchObject({ day: DAY, intention: 'i2', friends: ['Ania'], seeds: ['muzyka'] });
    expect(JSON.stringify(whole.result())).not.toContain('Ania');
    // a 3-minute way (the waves and the hands): nothing of the gate, the lanterns or the seeds
    const short = makeSim({ planned: 180, prep });
    drive(short, 180.5, LOW);
    short.finish();
    expect(short.p.week).toEqual({ day: DAY, intention: null, friends: [], seeds: [] });
  });

  it('keeps last week’s card through a short way, and what this way did not walk', () => {
    const prev = { day: '2026-11-22', intention: 'i1', friends: ['Ania'], seeds: ['muzyka'] };
    // a 3-minute way walks none of the gate, the lanterns, the seeds: last week's card stays as it was
    const short = makeSim({ planned: 180, progress: { week: { ...prev } } });
    drive(short, 180.5, LOW);
    short.finish();
    expect(short.p.week).toEqual(prev);
    // a way with the lanterns only: new friends, last week's boundary and seeds
    const lanterns = makeSim({ planned: 600, prep: { way: ['lzy', 'latarnie'], friends: ['Kasia'] }, progress: { week: { ...prev } } });
    drive(lanterns, 600.5, LOW);
    lanterns.finish();
    expect(lanterns.p.week).toEqual({ day: DAY, intention: 'i1', friends: ['Kasia'], seeds: ['muzyka'] });
    // a card older than a week is not carried on
    const old = makeSim({ planned: 180, progress: { week: { ...prev, day: '2026-11-01' } } });
    drive(old, 180.5, LOW);
    old.finish();
    expect(old.p.week).toEqual({ day: DAY, intention: null, friends: [], seeds: [] });
  });

  it('blesses each lantern in the band, the unlit ones with the last', () => {
    // fewer acts than lanterns: the last one's blessing names the others too
    const few = makeSim({ planned: 600, prep: { way: ['latarnie', 'lzy', 'dlon', 'list', 'kamienie'], friends: ['A', 'B', 'C', 'D', 'E'], hurt: true } });
    const lat = few.plan.stations.find(s => s.id === 'latarnie')!;
    expect(lat.acts.length).toBeLessThan(few.view.lanterns.length);
    const items = few.acts.filter(a => a.id === 'latarnie').map(a => a.item);
    expect(items[0]).toBe(0);
    expect(items[items.length - 1]).toBe(few.view.lanterns.length - 1);
    const clock = { t: 0 };
    until(few, s => s.block.what === 'settle' && s.act?.id === 'latarnie' && s.act.i === lat.acts.length - 1, LOW, clock);
    until(few, s => s.blessing !== null, LOW, clock, [], 30);
    expect(few.blessing).toBe(`${t('bless.all')} ${t('bless.others')}`);
  });

  it('asks the band for focus in the acts and for rest in the arrival, the openings, the settles and the dawn', () => {
    const sim = makeSim({ planned: 600 });
    const kinds = new Map<string, Set<string>>();
    const tips = new Set<string>();
    drive(sim, 600.2, (_t, s) => {
      const set = kinds.get(s.block.what) ?? new Set();
      set.add(s.block.kind);
      kinds.set(s.block.what, set);
      tips.add(s.tip);
      tips.add(s.subLine);
      return s.pushBlock ? HIGH : LOW;
    });
    expect([...kinds.get('act')!]).toEqual(['push']);
    for (const w of ['arrive', 'open', 'settle', 'sunrise', 'call', 'prayer']) expect([...(kinds.get(w) ?? [])], w).toEqual(['rest']);
    expect([...kinds.get('close')!]).toEqual(['free']);
    // every line the band shows is a sentence of the catalog, never a key
    for (const s of tips) expect(s, s).not.toMatch(/^(task|st)\.[\w.]+$/);
  });
});

describe('Ogród o świcie — the progress', () => {
  it('migrates fresh, broken and hostile saves field by field — and a save carrying a letter loses it', () => {
    expect(migrate(freshProgress())).toEqual(freshProgress());
    const hostile = JSON.parse(JSON.stringify({
      ver: 1, sessions: 'x', best: -3, flowers: 1e999, acts: null, grace: '5', ways: {}, stones: [], lastLen: -5,
      prep: { way: ['lzy', 'nope', 'lzy'], feelings: 'hack', stones: [{ w: { k: 'nope' } }], friends: [7, 'Ania', 'ania'], name: 42, before: 99, letter: 'secret page' },
      week: { day: 'yesterday' }, breath: null, history: [{ after: 4, before: 'x' }, 7, { after: 99, day: 12 }, { before: 3 }], seen: [1, 'a', 'a'],
      letter: 'Drogi Tomku…',
    })) as Record<string, unknown>;
    hostile['__proto__'] = { polluted: true };
    for (const bad of [{}, { best: null }, { ver: 3, sessions: 4 }, { ver: '1', sessions: 2.7 }, hostile]) {
      for (const raw of [structuredClone(bad), mergeSaved(freshProgress(), structuredClone(bad))]) {
        const p = migrate(raw as unknown as OgrodProgress);
        expect(p).toBe(raw);
        expect(p.ver).toBe(1);
        for (const k of ['sessions', 'best', 'flowers', 'acts', 'grace', 'ways', 'stones', 'lastLen'] as const) {
          expect(Number.isInteger(p[k]) && p[k] >= 0, `${k} ${JSON.stringify(bad)}`).toBe(true);
        }
        expect(Array.isArray(p.prep.feelings) && p.prep.feelings.length >= 1).toBe(true);
        expect(p.prep.way === null || p.prep.way.every(s => STATIONS.includes(s))).toBe(true);
        expect(p.prep.before === null || (p.prep.before >= 0 && p.prep.before <= 10)).toBe(true);
        expect(p.week).toBeNull();
        expect(p.breath).toEqual(expect.objectContaining({ in: expect.any(Number), out: expect.any(Number) }));
        for (const x of p.history) expect(x.after >= 0 && x.after <= 10 && (x.before === null || (x.before >= 0 && x.before <= 10))).toBe(true);
        expect(new Set(p.seen).size).toBe(p.seen.length);
        expect(p.seen.every(s => typeof s === 'string')).toBe(true);
        expect(JSON.stringify(p)).not.toContain('Tomku');
        expect(JSON.stringify(p)).not.toContain('secret page');
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        // idempotent
        const again = JSON.parse(JSON.stringify(p));
        expect(migrate(again)).toEqual(JSON.parse(JSON.stringify(p)));
      }
    }
    const h = migrate(structuredClone(hostile) as unknown as OgrodProgress);
    expect(h.history).toEqual([{ day: '', before: null, after: 4 }, { day: '', before: null, after: 10 }]);
    expect(h.prep.way).toEqual(['lzy']);
    expect(h.prep.friends).toEqual(['Ania']);
    expect(migrate({ sessions: 5 } as unknown as OgrodProgress).sessions).toBe(5);
    expect(migrate({ ver: 3, sessions: 4, letter: 'x' } as unknown as OgrodProgress)).toEqual({ ...freshProgress(), sessions: 4 });
  });

  it('keeps a sound week and cleans a broken one', () => {
    const p = migrate({ ...freshProgress(), week: { day: '2026-11-20', intention: 'i1', friends: ['Ania', 5, '', 'ania'], seeds: ['muzyka', 3, '  '] } } as unknown as OgrodProgress);
    expect(p.week).toEqual({ day: '2026-11-20', intention: 'i1', friends: ['Ania'], seeds: ['muzyka'] });
    expect(migrate({ ...freshProgress(), week: { day: '2026-11-20', intention: 'zzz' } } as unknown as OgrodProgress).week)
      .toEqual({ day: '2026-11-20', intention: null, friends: [], seeds: [] });
    for (const week of [null, 'x', [], { day: 20261120 }, { day: '20.11.2026' }]) {
      expect(migrate({ ...freshProgress(), week } as unknown as OgrodProgress).week).toBeNull();
    }
  });

  it('keeps the last thirty before → after, and says nothing of a best before the first session', () => {
    const p = freshProgress();
    expect(bestOf(p)).toBeNull();
    for (let i = 0; i < 40; i++) addWeight(p, `${DAY}T10:00`, i % 11, (i + 3) % 11);
    expect(p.history).toHaveLength(RULES.historyMax);
    expect(p.history[0].day).toBe(DAY);
    addWeight(p, DAY, null, 12.4);
    expect(p.history.at(-1)).toEqual({ day: DAY, before: null, after: 10 });
    addWeight(p, DAY, 3, Number.NaN);
    expect(p.history.at(-1)).toEqual({ day: DAY, before: null, after: 10 });
    expect(bestOf({ ...freshProgress(), sessions: 1, best: 4 })).toBe(4);
  });
});

/** All texts of a catalog (plural forms one by one), with their keys. */
const textsOf = (cat: Record<string, unknown>, keep: (k: string) => boolean = () => true): [string, string][] =>
  Object.entries(cat).filter(([k]) => keep(k)).flatMap(([k, m]) => (typeof m === 'string' ? [[k, m]] : Object.values(m as object).map(s => [k, s])) as [string, string][]);
const isOgrod = (k: string): boolean => k.startsWith('ogrod.');
/** Ogród's own texts in a language: its catalog, builder B's way, its arcade texts and their mouse twins. */
const ownTexts = (l: Lang): [string, string][] => [
  ...textsOf(CATALOGS[l]).map(([k, s]) => [`og.${k}`, s] as [string, string]),
  ...textsOf(PREP_TEXTS[l]).map(([k, s]) => [`prep.${k}`, s] as [string, string]),
  ...textsOf(ARCADE_TEXTS[l] as Record<string, unknown>, isOgrod).map(([k, s]) => [`arcade.${k}`, s] as [string, string]),
  ...textsOf(MOUSE_TEXTS[l] as Record<string, unknown>, isOgrod).map(([k, s]) => [`mouse.${k}`, s] as [string, string]),
];

describe('Ogród o świcie — the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    // the keys the session builds from ids exist
    const pl = CATALOGS.pl as Record<string, unknown>;
    for (const id of STATIONS) for (const k of [`st.${id}`, `stsub.${id}`, `task.settle.${id}`]) expect(pl[k], k).toBeTypeOf('string');
    for (const k of ['st.arrive', 'st.dawn', 'task.settle.keep', 'coach.act', 'coach.settle', 'coach.flower', 'coach.tap', 'coach.click']) expect(pl[k], k).toBeTypeOf('string');
    for (const k of Object.keys(BREATH_PRESETS)) expect(pl[`preset.${k}`], k).toBeTypeOf('string');
    for (const k of ['br.in', 'br.holdIn', 'br.out', 'br.holdOut']) expect(pl[k], k).toBeTypeOf('string');
  });

  it('voices every moment of the narrator, each line short enough to read twice', () => {
    for (const m of MOMENTS) {
      const lines = linesOf(m);
      expect(lines.length, m).toBeGreaterThan(0);
      for (const s of lines) expect([...s].length, s).toBeLessThanOrEqual(90);
    }
    // the stations' grace and settle moments the session asks for
    for (const id of STATIONS) {
      if (id !== 'kamienie') expect(MOMENTS as readonly string[], id).toContain(`${id}Grace`);
      if (id !== 'latarnie') expect(MOMENTS as readonly string[], id).toContain(`${id}Settle`);
      expect(MOMENTS as readonly string[], id).toContain(`${id}Act`);
    }
  });

  it('counts flowers in Polish with all three forms', () => {
    expect(unit(1)).toBe('kwiat');
    expect(unit(3)).toBe('kwiaty');
    expect(unit(5)).toBe('kwiatów');
    expect(unit(22)).toBe('kwiaty');
    expect(t('flowers', { n: 22 })).toBe('22 kwiaty');
    expect(t('flowers', { n: 12 })).toBe('12 kwiatów');
  });

  it('has the arcade texts in four languages, with the help lines, "not therapy", the source named once and a mouse twin', () => {
    const want = Object.keys(ARCADE_TEXTS.pl).filter(k => k.startsWith('kintsugi.')).map(k => k.slice('kintsugi.'.length)).sort();
    for (const l of LANGS) {
      const a = ARCADE_TEXTS[l] as Record<string, string>;
      const have = Object.keys(a).filter(isOgrod).map(k => k.slice('ogrod.'.length)).sort();
      expect(have, l).toEqual(want);
      for (const k of have) expect(a[`ogrod.${k}`]?.trim(), `${l} ogrod.${k}`).toBeTruthy();
      // the help lines exactly as Złote serce's tip 5
      expect(a['ogrod.tip5'], l).toBe(a['kintsugi.tip5']);
      expect(a['ogrod.tip5']).toMatch(l === 'pl' ? /116 123.*116 111.*112/ : l === 'de' ? /0800 111 0 111.*112/ : l === 'sv' ? /90101.*112/ : /emergency number|crisis line/);
      for (const k of ['ogrod.tip5', 'ogrod.text']) expect(a[k], `${l} ${k}`).toMatch(/terapi|therapy|Therapie/);
      // the practices' sources, named once, in the lobby's text only
      expect(a['ogrod.text'].match(/metta/gi), l).toHaveLength(1);
      expect(a['ogrod.text'].match(/ps[yi]cholog|psykolog/gi), l).toHaveLength(1);
      for (const [k, s] of ownTexts(l)) if (k !== 'arcade.ogrod.text') expect(s, `${l} ${k}`).not.toMatch(/metta/i);
      expect(a['ogrod.title']).toBe({ pl: 'Ogród o świcie', en: 'Garden at Dawn', de: 'Garten im Morgenlicht', sv: 'Trädgården i gryningen' }[l]);
    }
    // a line that says "tap" has its mouse twin
    for (const l of LANGS) {
      const a = ARCADE_TEXTS[l] as Record<string, string>, m = MOUSE_TEXTS[l] as Record<string, string>;
      for (const [k, s] of Object.entries(a)) if (isOgrod(k) && /stukn|\btap\b|tippe|\btryck/i.test(s)) expect(m[k], `${l} ${k}`).toBeTypeOf('string');
    }
    expect((MOUSE_TEXTS.pl as Record<string, string>)['ogrod.how3']).toMatch(/kliknij/);
  });

  it('speaks of light, care and the garden — no energy, no promise of healing, no magic — in every language', () => {
    const FORBID: Record<Lang, RegExp> = {
      pl: /energi|wibrac|uzdrawia|uzdrow|(?<!\p{L})(u|wy)?lecz(y|ę|ysz)(?!\p{L})|uleczen|czakr|kundalini|aktywuj|aktywacj|magi[aię]|zaklęci|manifest|detoks/iu,
      en: /energy|vibrat|heal|\bcures?\b|chakra|kundalini|activat|\bmagic|\bspell\b|manifest|detox/i,
      de: /energie|schwingung|heil(t|ung|en|e)?\b|chakra|kundalini|aktivier|magie|zauber|manifest|entgift|detox/i,
      sv: /energi|vibration|\bhelar\b|helande|läk|chakra|kundalini|aktiver|magi|trollformel|manifest|detox/i,
    };
    for (const l of LANGS) for (const [k, s] of ownTexts(l)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
  });

  it('never gives the player a gender in Polish (whitelisted: words that are not about the player)', () => {
    // a past tense of the second (or the first) person, an adjective addressed to the player, a "y/a" pair
    const GENDERED = /\p{L}+(łeś|łaś|łem|łam|łbyś|łabyś|łbym|łabym)(?!\p{L})|(?<!\p{L})(sam|sama|samotny|samotna|gotowy|gotowa|gotów|zraniony|zraniona|kochany|kochana|zmęczony|zmęczona|pewny|pewna|silny|silna)(?!\p{L})|\p{L}+(y|i)\/a(?!\p{L})|\p{L}+\((a|aś|na)\)|(?<!\p{L})(jesteś|jestem|czujesz się|czuję się|zostaniesz|zostanę|będziesz)\s+\p{L}{2,}(ny|na|ty|ta|wy|wa|ły|ła)(?!\p{L})/giu;
    const NOT_THE_PLAYER: Readonly<Record<string, string>> = {
      'światłem': 'the instrumental of "światło" (light), not a verb',
    };
    // "sam / sama" said of a thing: the wave passes by itself, the boat drifts on, the gate, the lantern, the earth, the act
    const OF_A_THING = /^og\.(say\.\w+Grace\.\d|coach\.settle)$/;
    const hits: string[] = [];
    for (const [k, s] of ownTexts('pl')) {
      for (const m of s.matchAll(GENDERED)) {
        const w = m[0].toLowerCase();
        if (NOT_THE_PLAYER[w]) continue;
        if (/^sam[a]?$/.test(w) && OF_A_THING.test(k)) continue;
        hits.push(`${k}: "${m[0]}" in ${s}`);
      }
    }
    expect(hits).toEqual([]);
    // the whitelist is used (a stale entry would hide nothing and should go)
    expect(ownTexts('pl').some(([, s]) => /światłem/.test(s))).toBe(true);
  });

  it('quotes only verified passages, each in four languages, and turns the closing verse session by session', () => {
    expect(ROOT).toBe('psa30.5');
    expect(ALL_VERSES).toContain(ROOT);
    for (const ids of Object.values(VERSES)) for (const id of ids) expect(ALL_VERSES).toContain(id);
    for (const id of ALL_VERSES) for (const l of LANGS) {
      const p = passage(id, l);
      expect(p.text.length, `${id} ${l}`).toBeGreaterThan(10);
      expect(p.ref.length, `${id} ${l}`).toBeGreaterThan(2);
    }
    expect(verseFor('close', 1)).toBe(VERSES.close[0]);
    expect(verseFor('close', 2)).toBe(VERSES.close[1]);
    expect(verseFor('close', 1 + VERSES.close.length)).toBe(VERSES.close[0]);
    expect(verseFor('lzy', 1, 1)).toBe(VERSES.lzy[1]);
    expect([...VERSES.close].sort()).toEqual(['isa58.11', 'jhn16.22', 'lam3.22-23', 'rev21.4', 'sng2.11-12']);
    expect(VERSES.call).toEqual(['jhn20.15-16']);
    expect(VERSES.name).toEqual(['isa43.1']);
  });

  it('stands in the registry after Złote serce: a heart meditation on Ps 30:6 for Mendi and HALO', async () => {
    const e = arcadeEntry('ogrod')!;
    expect(e).toBeTruthy();
    expect(e.kind).toBe('heart');
    expect(e.root).toBe('psa30.5');
    expect([...e.tools].sort()).toEqual(['eeg', 'fnirs']);
    expect(e.focusChip).toBe(false);
    expect(e.tuning).toEqual({ adapt: 0.08 });
    expect(e.art).toBe('art-ogrod');
    expect(ARCADE.findIndex(a => a.id === 'ogrod')).toBe(ARCADE.findIndex(a => a.id === 'kintsugi') + 1);
    const mod = await e.load();
    expect(mod.freshProgress()).toEqual(freshProgress());
    expect(mod.unit?.(5)).toBe('kwiatów');
    expect(mod.ownBreath).toBe(true);
    expect(mod.best(freshProgress())).toBeNull();
  });
});

/** A canvas context that measures text at 0.6 em a character (enough to place the breath guide's box). */
const measuring = (): CanvasRenderingContext2D => {
  const ctx = { font: '16px sans-serif', measureText: (s: string) => ({ width: [...s].length * 0.6 * Number(ctx.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 16) }) };
  return ctx as unknown as CanvasRenderingContext2D;
};
const inside = (r: Rect, w: number, h: number, ins: { top: number; right: number; bottom: number; left: number }): boolean =>
  r.x >= ins.left - 0.5 && r.y >= ins.top - 0.5 && r.x + r.w <= w - ins.right + 0.5 && r.y + r.h <= h - ins.bottom + 0.5;
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

describe('Ogród o świcie — the layout and the lobby', () => {
  it('keeps everything inside the insets and under the HUD, the 0–10 row tappable, the text readable', () => {
    for (const size of CHECK_SIZES) {
      const { w, h, insets } = size;
      const l = layout(w, h, insets);
      const name = `${size.name} (${l.kind})`;
      for (const [k, r] of Object.entries({ view: l.view, title: l.title, band: l.band, rateQ: l.rateQ, closeText: l.closeText, name: l.name })) {
        expect(inside(r, w, h, insets), `${name} ${k} ${JSON.stringify(r)}`).toBe(true);
        expect(r.y, `${name} ${k} under the HUD`).toBeGreaterThanOrEqual(insets.top);
      }
      // the 0–10: eleven targets of a finger's size, none overlapping, under the question, the words above it
      expect(l.rate).toHaveLength(11);
      const targets = l.rate.map((r, i) => ({ label: String(i), ...r }));
      expect(auditTargets(targets, w, h, insets), name).toEqual([]);
      for (const r of l.rate) expect(Math.min(r.w, r.h), name).toBeGreaterThanOrEqual(MIN_TAP);
      expect(l.rateQ.y + l.rateQ.h, name).toBeLessThanOrEqual(Math.min(...l.rate.map(r => r.y)) + 0.5);
      // room for the question (font + 1) and its "0 — lekko, 10 — bardzo ciężko" line (font − 2, ≥ 13) at the layout's
      // font: a big screen's 20 px question once reached 3 px over the row
      expect(l.rateQ.h, name).toBeGreaterThanOrEqual(Math.round(l.font + 8) + Math.max(MIN_READ, Math.round(l.font - 2)) + 3);
      expect(l.closeText.y + l.closeText.h, name).toBeLessThanOrEqual(l.rateQ.y + 0.5);
      expect(l.closeText.h, name).toBeGreaterThanOrEqual(60);
      // the name card and the name in light stand in the view; the hands in its lower part
      for (const r of [l.title, l.name]) expect(r.y >= l.view.y - 0.5 && r.y + r.h <= l.view.y + l.view.h + 0.5, name).toBe(true);
      expect(l.hands.cy, name).toBeGreaterThan(l.view.y + l.view.h / 2);
      expect(l.hands.cy, name).toBeLessThan(l.view.y + l.view.h);
      expect(l.hands.px, name).toBeGreaterThanOrEqual(70);
      // the band never over the view where the garden's places stand (the side column, the foot)
      expect(overlap(l.band, l.view), name).toBe(false);
      // the breath guide (its scrim, its word and "oddech 3 z 3") on the screen, off the band
      const g = l.guide;
      const box = breathGuideBox(measuring(), { cx: g.cx, cy: g.cy, r: g.r, layout: g.layout, maxW: g.maxW, sub: breathOf(3, 3) });
      expect(inside(box, w, h, insets), `${name} guide ${JSON.stringify(box)}`).toBe(true);
      expect(overlap(box, l.band), `${name} guide over the band`).toBe(false);
      // the text's base size: the smallest line drawn from it (its size − 2) still reads (≥ 13 px)
      expect(l.font - 2, name).toBeGreaterThanOrEqual(MIN_READ);
      expect(l.font, name).toBeLessThanOrEqual(20);
      // the garden is a panorama wider than the view; the dawn shows more of it
      expect(l.s, name).toBeGreaterThanOrEqual(60);
      expect(l.sDawn, name).toBeLessThanOrEqual(l.s);
      expect(l.sDawn, name).toBeGreaterThanOrEqual(0.62 * l.s - 1e-9);
    }
  });

  it('builds the card: the numbers, how the way goes, this length’s forecast, the way, the breath, the week', () => {
    takeLetter();
    const p = freshProgress();
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    // the forecast is there before the card is shown, for the lobby's length (none chosen: 5 minutes)
    expect(el.textContent).toContain(forecastLines(p, 300)[0]);
    document.body.append(el);
    expect(el.textContent).toContain(t('panel.rules'));
    expect(el.textContent).toContain(t('panel.best'));
    expect(el.querySelector('.og-prep')).not.toBeNull();
    expect(el.querySelector('.og-week')).toBeNull();
    // the breath presets: a finger's size, a click keeps the choice
    const box = [...el.querySelectorAll('button')].find(b => b.textContent === t('preset.box' as Key))!;
    expect(box).toBeTruthy();
    expect((box as HTMLElement).style.minHeight).toBe('44px');
    box.click();
    expect(p.breath).toEqual(BREATH_PRESETS.box);
    expect(saves).toBe(1);
    // the breath before the way, so the way's care and privacy lines end the card
    const kids = [...el.children];
    const breathAt = kids.findIndex(k => k.textContent === t('panel.breath'));
    expect(breathAt).toBeGreaterThan(0);
    expect(breathAt).toBeLessThan(kids.findIndex(k => k.classList.contains('og-prep')));
    el.remove();
    // after a session: the week's card, the last before → after
    const q = freshProgress();
    q.sessions = 1;
    const d = new Date();
    q.week = { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, intention: 'i1', friends: ['Ania'], seeds: ['muzyka'] };
    q.history = [{ day: DAY, before: 7, after: 4 }];
    const card = progressPanel(q, () => {});
    expect(card.querySelector('.og-week')).not.toBeNull();
    expect(card.textContent).toContain('Ania');
    expect(card.textContent).toContain(t('panel.hurtLast', { a: 7, b: 4 }));
    // the forecast says this length's way, and when the chosen way is short for it
    expect(forecastLines(freshProgress(), 600)[0]).toMatch(/10 min/);
    expect(forecastLines(freshProgress(), 600)).toHaveLength(1);
    const one = freshProgress();
    one.prep.way = ['lzy'];
    expect(forecastLines(one, 1800)).toEqual([expect.stringMatching(/30 min/), t('panel.fcShort')]);
  });

  it('says how to play for the hand the player has', () => {
    expect(howto(true).hands).toHaveLength(1);
    expect(howto(false).hands).toHaveLength(2);
    expect(howto(true, BREATH_PRESETS.box).tips?.[0]).toContain('4');
  });
});

// (last: it loads the modules again in each language, which later imports would see)
describe('Ogród o świcie — in every language', () => {
  afterEach(() => {
    localStorage.setItem('brainlink.lang', 'pl');
    vi.resetModules();
  });

  it('blesses a friend’s lantern by the friend’s name alone (the paper says “For Anna”, the prayer “here is Anna”)', async () => {
    for (const l of LANGS) {
      localStorage.setItem('brainlink.lang', l);
      vi.resetModules();
      const S = await import('../src/arcade/ogrod/sim');
      const M = await import('../src/arcade/ogrod/meta');
      const I = await import('../src/arcade/ogrod/i18n');
      const progress = { ...M.freshProgress(), sessions: 4, seen: ['c.tap', 'c.act', 'c.settle', 'c.flower'] };
      progress.prep = { ...progress.prep, way: ['latarnie'], friends: ['Ania'] };
      const sim = new S.GardenSim({ progress, rng: mulberry32(1), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
      sim.start();
      expect(sim.acts.map(a => a.item), l).toEqual([0, 1, 2]);
      const said: string[] = [];
      const clock = { t: 0 };
      for (let i = 0; i < 600 / STEP && sim.block.what !== 'sunrise'; i++) {
        drive(sim, STEP, LOW, clock);
        const b = sim.blessing;
        if (b && !said.includes(b)) said.push(b);
      }
      expect(said, l).toContain(I.t('bless.friend', { name: 'Ania' }));
      expect(said.join(' '), l).not.toMatch(/\b(For|Für|För) Ania/);
      expect(said[0], l).toBe(I.t('bless.me'));
      expect(said[said.length - 1], l).toBe(I.t('bless.all'));
    }
  });
});

afterEach(() => { takeLetter(); });
