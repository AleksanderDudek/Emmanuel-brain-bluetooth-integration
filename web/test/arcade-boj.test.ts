// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_TAP, auditTargets } from '../src/arcade/kit/mobile';
import { overlaps, pacerBox, pacerSizeAt } from '../src/arcade/kit/pacerspot';
import { restKept } from '../src/arcade/kit/rhythm';
import { passage } from '../src/arcade/kit/scripture';
import { ALL_VERSES, LADDER, MOMENTS, ROOT, SKIN_SWATCH, VERSES, personaProblems, verseFor } from '../src/arcade/boj/content';
import { cardRect, optionTargets } from '../src/arcade/boj/hud';
import { CATALOGS, linesOf, t, unit } from '../src/arcade/boj/i18n';
import { bojRhythm, howto } from '../src/arcade/boj/index';
import { layout } from '../src/arcade/boj/layout';
import { bestOf, freshProgress, ladderAfter, migrate, setSex, setSkin, setStyle, type BojProgress } from '../src/arcade/boj/meta';
import { COMBOS, DEFENSES, DEFENSE_IDS, OPENINGS, STRIKES, STRIKE_IDS, STYLES, answer, bestAnswers, combosFor, fit, openingsFor, type Style } from '../src/arcade/boj/moves';
import { forecastLines, progressPanel } from '../src/arcade/boj/panel';
import {
  CYC, RULES, attackLands, defend, fightPlan, focusRate, needFor, planFor, q, readBreathsIn, roundSecFor, windowFits,
} from '../src/arcade/boj/rules';
import { BojSim, incomingOptions, openingOptions, optionWords, type SimEvent, type Stage } from '../src/arcade/boj/sim';
import { mulberry32 } from '../src/core/random';
import { hourFrames, mean } from './longframe';
import boj from '../src/arcade/boj/index';
import { catalogProblems, LANGS } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { arcadeEntry } from '../src/arcade/registry';
import { SESSION_MINUTES } from '../src/settings';
import { DIFFICULTIES, recordKey, type Difficulty } from '../src/arcade/kit/difficulty';
import { difficultyName } from '../src/arcade/kit/difficultypanel';
import { MIN_READ } from '../src/arcade/kit/mobile';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { RingSound } from '../src/arcade/boj/audio';
import { FirstPersonView, BACK, drawFpPreview, fpSpacing, lensOf, ownGloves, reachOf, restAt, restRadius } from '../src/arcade/boj/fpv';
import { makeCam, project, worldOf } from '../src/arcade/boj/fpaint';
import { BUILD, Rig, aimAt, poseFor, solve, travelT } from '../src/arcade/boj/rig';
import { LEVELS, levelOf } from '../src/arcade/boj/rules';
import { bestAt, setView, viewOf } from '../src/arcade/boj/meta';
import { levelLine } from '../src/arcade/boj/panel';
import type { FightView, Option, Phase, Look } from '../src/arcade/boj/view';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const SEEN = ['c.slow', 'c.chooseIn', 'c.chooseOpen', 'c.count', 'c.read', 'c.corner'];

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
/** the average player: a little above the threshold, held a while */
const AVG = frame({ level: 0.62, activity: 3, focused: true, hold: 6, calm: 0.2 });
const WEAK_ON = frame({ level: 0.56, activity: 2.5, focused: true, hold: 2, calm: 0.3 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });

type Opts = { progress?: Partial<BojProgress>; planned?: number; seed?: number; eeg?: boolean; rhythm?: { focus: number; rest: number; custom: boolean } | null };

function makeSim(o: Opts = {}): BojSim {
  const sim = new BojSim({
    progress: { ...freshProgress(), sessions: 5, seen: [...SEEN], ...o.progress } as BojProgress,
    rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null,
  });
  sim.start();
  return sim;
}

type FrameFn = (t: number, sim: BojSim) => FocusFrame;
/** A player: the push frame in the slow motion and the count, rest elsewhere; `pick(n)` → right (true), wrong (false), none (null). */
interface Player { push: FrameFn; pick: (n: number) => boolean | null }
const STRONG: Player = { push: () => HIGH, pick: () => true };
const AVERAGE: Player = { push: () => AVG, pick: n => n % 10 < 7 };
const WEAK: Player = { push: t => (Math.floor(t / 2) % 2 ? WEAK_ON : LOW), pick: n => n % 2 === 0 };
const NONE: Player = { push: () => LOW, pick: () => null };

interface Run { evs: SimEvent[]; stages: { stage: Stage; t: number; dur: number }[]; lifeLostAt: number[] }

/** Play `sec` seconds as `pl`. */
function drive(sim: BojSim, sec: number, pl: Player = STRONG, clock = { t: 0 }, run: Run = { evs: [], stages: [], lifeLostAt: [] }): Run {
  const n = Math.round(sec / STEP);
  let picks = run.evs.filter(e => e.type === 'choose').length;
  let lastEx: unknown = null;
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    if (sim.stage === 'slow' && sim.ex && sim.ex !== lastEx && sim.ex.opts.length) {
      lastEx = sim.ex;
      const r = pl.pick(picks++);
      if (r !== null) sim.choose(r ? sim.ex.right : (sim.ex.right + 1) % sim.ex.opts.length);
    }
    const lives = sim.player.lives;
    sim.update(STEP, sim.pushBlock ? pl.push(clock.t, sim) : LOW, clock.t);
    if (sim.player.lives < lives) run.lifeLostAt.push(clock.t);
    for (const e of sim.take()) {
      run.evs.push(e);
      if (e.type === 'stage') run.stages.push({ stage: e.stage, t: clock.t, dur: sim.blockDur });
    }
  }
  return run;
}
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
const LENS = [40, 60, ...SESSION_MINUTES.map(m => m * 60)];

// ── the plan ──────────────────────────────────────────────────────

describe('Dobry bój — the plan', () => {
  it('fits every session length: rounds of the designed length, the session’s last bell before its end', () => {
    expect(roundSecFor(180)).toBe(70);
    expect(roundSecFor(300)).toBe(120);
    expect(roundSecFor(600)).toBe(165);
    expect(roundSecFor(1800)).toBe(180);
    for (const T of LENS) {
      const p = planFor({ plannedSec: T, eeg: false });
      expect(p.lastBell, `${T}`).toBeLessThan(T);
      expect(p.window).toBe(T <= 60 ? RULES.test.window : RULES.focus.def);
      const f = fightPlan(p, p.intro);
      expect(f.rounds).toBeGreaterThanOrEqual(1);
      expect(f.rounds).toBeLessThanOrEqual(RULES.maxRoundsLast);
      // a round holds at least one exchange (a test: the first window too)
      expect(windowFits(p, p.intro, p.intro + f.len), `${T}`).not.toBeNull();
      if (T > 60) {
        expect(f.len).toBeGreaterThan(55);
        // the rounds and corners of the first fight end on its bell
        expect(p.intro + f.rounds * f.len + (f.rounds - 1) * p.corner).toBeCloseTo(f.bell, 6);
      }
    }
    // 10 minutes: one fight of three rounds; 20 and 30: room for more fights
    expect(fightPlan(planFor({ plannedSec: 600, eeg: false }), 6).rounds).toBe(3);
    expect(fightPlan(planFor({ plannedSec: 1200, eeg: false }), 6).last).toBe(false);
    expect(fightPlan(planFor({ plannedSec: 1800, eeg: false }), 6).last).toBe(false);
  });

  it('keeps the rhythm’s dials: the window, the read’s whole breaths, the corner two breaths longer (one under 10 min)', () => {
    for (const [focus, rest] of [[10, 1], [20, 2], [30, 3]] as const) {
      const p = planFor({ plannedSec: 900, eeg: false, focus, rest, custom: true });
      expect(p.window).toBe(focus);
      expect(p.readBreaths).toBe(rest);
      expect(p.read).toBe(rest * CYC);
      expect(p.corner).toBe((rest + RULES.cornerPlus) * CYC);
    }
    expect(planFor({ plannedSec: 300, eeg: false }).cornerBreaths).toBe(RULES.rest.def + RULES.cornerPlusShort);
    // restIn: a session under 5 minutes keeps at most two breaths of reading
    expect(readBreathsIn(3, 180)).toBe(2);
    expect(readBreathsIn(3, 600)).toBe(3);
    const spec = bojRhythm();
    expect(spec.focus.def).toBe(RULES.focus.def);
    expect(spec.rest.def).toBe(RULES.rest.def);
    expect(spec.restSec?.(2)).toBe(2 * CYC);
    expect(restKept(spec, { focus: 20, rest: 3, custom: true }, 180)).toBe(2);
    expect(restKept(spec, { focus: 20, rest: 3, custom: true }, 600)).toBeNull();
    expect(howto(true).hands).toHaveLength(1);
    expect(howto(false).hands).toHaveLength(2);
  });

  it('plays every length to its end: the corners and the end in whole breaths, the reads as the dial says, stops at T', () => {
    for (const T of LENS) {
      for (const pl of [STRONG, NONE]) {
        const sim = makeSim({ planned: T, seed: T });
        const clock = { t: 0 };
        const run = drive(sim, T + 0.2, pl, clock);
        expect(sim.canStop(), `${T}`).toBe(true);
        expect(sim.stage, `${T}`).toBe('end');
        expect(sim.fights.length, `${T}`).toBeGreaterThanOrEqual(1);
        for (const s of run.stages) {
          if (s.stage === 'corner') {
            const breaths = s.dur / CYC;
            expect(Math.abs(breaths - Math.round(breaths)), `${T} corner ${s.dur}`).toBeLessThan(1e-6);
            expect(breaths).toBeGreaterThanOrEqual(1);
          }
        }
        // the reads that lead to an exchange are the dial's whole breaths (a test: its share of one)
        const reads = run.stages.filter((s, i) => s.stage === 'read' && run.stages[i + 1]?.stage === 'sequence');
        expect(reads.length, `${T}`).toBeGreaterThan(0);
        for (const r of reads) expect(r.dur, `${T}`).toBeCloseTo(T <= 60 ? RULES.test.read : sim.plan.read, 6);
      }
    }
  });

  it('a ≤ 60 s test reaches a slow motion within ~8 s and scores with focus — first-ever and returning, Mendi and HALO', () => {
    for (const T of [40, 60]) {
      for (const eeg of [false, true]) {
        for (const sessions of [0, 5]) {
          for (const pl of [STRONG, { push: () => HIGH, pick: () => null } as Player]) {
            const sim = makeSim({ planned: T, seed: T + sessions, eeg, progress: { sessions, seen: sessions ? [...SEEN] : [] } });
            const run = drive(sim, T * 0.85, pl);
            const slow = run.stages.find(s => s.stage === 'slow');
            expect(slow, `${T} ${eeg}`).toBeDefined();
            expect(slow!.t, `${T} ${eeg} ${sessions}`).toBeLessThanOrEqual(8.5);
            expect(sim.score, `${T} s ${eeg ? 'eeg' : 'fnirs'} sessions ${sessions}`).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });
});

// ── the energy ────────────────────────────────────────────────────

describe('Dobry bój — the energy is focus only', () => {
  const toSlow = (sim: BojSim, clock: { t: number }) => {
    for (let i = 0; i < 4000 && sim.stage !== 'slow'; i++) drive(sim, STEP, NONE, clock);
    expect(sim.stage).toBe('slow');
  };

  it('charges nothing without focus, nothing before the lead-in, nothing unreliable', () => {
    for (const eeg of [false, true]) {
      const sim = makeSim({ eeg });
      const clock = { t: 0 };
      toSlow(sim, clock);
      // before the lead-in: even the strongest focus does not charge
      const lead = sim.lead;
      for (let i = 0; i < Math.floor((lead - 0.1) / STEP); i++) { clock.t += STEP; sim.update(STEP, HIGH, clock.t); }
      expect(sim.ex!.energy).toBe(0);
      // past it: no focus, no charge
      for (let i = 0; i < 60; i++) { clock.t += STEP; sim.update(STEP, LOW, clock.t); }
      expect(sim.ex!.energy).toBe(0);
      // an unreliable signal: no charge however high it reads
      for (let i = 0; i < 60; i++) { clock.t += STEP; sim.update(STEP, { ...HIGH, reliable: false }, clock.t); }
      expect(sim.ex!.energy).toBe(0);
      // focus: it charges
      for (let i = 0; i < 30; i++) { clock.t += STEP; sim.update(STEP, HIGH, clock.t); }
      expect(sim.ex!.energy).toBeGreaterThan(0);
    }
  });

  it('a tap chooses but never charges; the move goes the moment the energy is full, else at the window’s end', () => {
    const sim = makeSim();
    const clock = { t: 0 };
    toSlow(sim, clock);
    for (let i = 0; i < 3; i++) sim.choose(i % sim.ex!.opts.length);
    expect(sim.ex!.energy).toBe(0);
    const evs = drive(sim, sim.lead + 30, STRONG, clock).evs;
    expect(ofType(evs, 'cue').some(e => e.cue === 'ready')).toBe(true);
    // the strong player fills it well before the window's end
    const rel = sim;
    expect(rel.slowsFull).toBeGreaterThanOrEqual(1);
    // no focus: the window runs out
    const none = makeSim();
    const c2 = { t: 0 };
    toSlow(none, c2);
    const w = none.ex!.window;
    drive(none, w - 0.2, NONE, c2);
    expect(none.stage).toBe('slow');
    drive(none, 0.5, NONE, c2);
    expect(none.stage).not.toBe('slow');
    expect(none.slowsFull).toBe(0);
  });

  it('asks the average player to fill near the window’s end and the first-ever window half of it', () => {
    const p = planFor({ plannedSec: 600, eeg: false });
    const rate = focusRate(AVG.level, true, AVG.hold);
    const fillAt = p.lead + p.need / rate;
    expect(fillAt).toBeGreaterThan(p.window * 0.65);
    expect(fillAt).toBeLessThan(p.window);
    expect(p.lead + p.need / focusRate(HIGH.level, true, HIGH.hold)).toBeLessThan(p.window * 0.7);
    const first = makeSim({ progress: { sessions: 0, seen: [] } });
    const clock = { t: 0 };
    toSlow(first, clock);
    expect(first.ex!.need).toBeCloseTo(needFor(first.ex!.window, first.lead) * RULES.firstNeed, 6);
  });
});

// ── the options and the outcome ───────────────────────────────────

describe('Dobry bój — the options and the outcome', () => {
  it('always holds exactly one right answer against every key strike, a counter when the strike allows', () => {
    for (const style of STYLES) {
      for (const c of combosFor(style)) {
        const key = c.strikes[c.key];
        expect(STRIKES[key].power, c.id).toBe(true);
        expect(bestAnswers(key, style).length, `${style} ${key}`).toBeGreaterThan(0);
        let counters = 0;
        for (let seed = 1; seed <= 40; seed++) {
          const { opts, right } = incomingOptions(key, style, mulberry32(seed));
          expect(opts.length, `${style} ${key}`).toBeGreaterThanOrEqual(2);
          expect(opts.length).toBeLessThanOrEqual(3);
          expect(opts.filter(o => o.right)).toHaveLength(1);
          expect(opts[right].right).toBe(true);
          expect(answer(opts[right].defense!, key)).toBe(1);
          for (const o of opts) {
            expect(DEFENSES[o.defense!].styles).toContain(style);
            if (!o.right) expect(answer(o.defense!, key)).toBeLessThan(1);
            if (o.counter) expect(STRIKES[o.counter].styles).toContain(style);
          }
          expect(new Set(opts.map(o => o.defense)).size).toBe(opts.length);
          if (opts[right].kind === 'counter') counters++;
        }
        expect(counters, `${style} ${key}`).toBeGreaterThan(10);
      }
    }
  });

  it('gives every opening of a style one combination that fits, and a misfit to read against', () => {
    for (const style of STYLES) {
      for (const o of openingsFor(style)) {
        for (let seed = 1; seed <= 20; seed++) {
          const { opts, right } = openingOptions(o, style, mulberry32(seed));
          expect(opts).toHaveLength(3);
          expect(opts.filter(x => x.right)).toHaveLength(1);
          expect(fit(o, opts[right].combo!.id)).toBe(1);
          for (const x of opts) expect(x.combo!.styles).toContain(style);
          expect(opts.some(x => fit(o, x.combo!.id) < 0.5)).toBe(true);
        }
      }
    }
  });

  it('a right defence at full charge saves the strike; a wrong one barely; a counter lands only with a right defence and full charge', () => {
    expect(q(0)).toBeCloseTo(RULES.q0);
    expect(q(1)).toBe(1);
    expect(defend('slip', 'cross', 1, false).save).toBe(1);
    expect(defend('slip', 'cross', 0, false).save).toBeCloseTo(RULES.q0);
    expect(defend('check', 'cross', 1, false).save).toBeLessThanOrEqual(0.15 + 1e-9);
    expect(defend('roll', 'hookL', 1, true).counter).toBe(true);
    expect(defend('roll', 'hookL', 0.95, true).counter).toBe(false);
    expect(defend('block', 'hookL', 1, true).counter).toBe(false);
    expect(defend('roll', 'hookL', 1, false).counter).toBe(false);
    // an attack: the whole combination with the right one at full charge; the lead strike with any; none with no charge
    expect(attackLands(4, 1, 1)).toEqual([true, true, true, true]);
    expect(attackLands(4, 0.15, 1)).toEqual([true, false, false, false]);
    expect(attackLands(3, 1, 0)).toEqual([false, false, false]);
    expect(attackLands(4, 0.6, 1).filter(Boolean).length).toBe(2);
  });

  it('names every option in words; the hint glows in the first three sessions and after two wrong picks', () => {
    for (const style of STYLES) for (const c of combosFor(style)) {
      const { opts } = incomingOptions(c.strikes[c.key], style, mulberry32(3));
      for (const o of opts) {
        const w = optionWords(o);
        expect(w.label.length).toBeGreaterThan(0);
        expect([...w.label].length, w.label).toBeLessThanOrEqual(20);
        expect([...w.sub].length, w.sub).toBeLessThanOrEqual(26);
      }
    }
    expect(makeSim({ progress: { sessions: 2 } }).hintOn).toBe(true);
    const sim = makeSim({ progress: { sessions: 8 } });
    expect(sim.hintOn).toBe(false);
    const clock = { t: 0 };
    drive(sim, 200, { push: () => HIGH, pick: () => false }, clock);
    expect(sim.wrongRun).toBeGreaterThanOrEqual(2);
    expect(sim.hintOn).toBe(true);
  });
});

// ── knockdowns, the fight's end ───────────────────────────────────

describe('Dobry bój — knockdowns and the end of a fight', () => {
  /** Bring the player's health to `hp` and play until a knockdown's count begins. */
  function toCount(sim: BojSim, clock: { t: number }): void {
    for (let i = 0; i < 20000 && sim.stage !== 'count' && sim.stage !== 'fightEnd' && sim.stage !== 'end'; i++) {
      if (sim.stage !== 'resolve') sim.player.hp = 1;
      drive(sim, STEP, { push: () => LOW, pick: () => false }, clock);
    }
  }

  it('never out while lives remain: the count ends on the feet with what was charged, sooner with focus', () => {
    const sim = makeSim({ planned: 900 });
    const clock = { t: 0 };
    toCount(sim, clock);
    expect(sim.stage).toBe('count');
    expect(sim.player.lives).toBe(2);
    // no focus at all: still up at the count's end, with the low health
    const c0 = clock.t;
    drive(sim, sim.plan.count + 0.2, NONE, clock);
    expect(sim.stage).not.toBe('count');
    expect(clock.t - c0).toBeGreaterThan(sim.plan.count - 0.1);
    expect(sim.player.hp).toBeGreaterThanOrEqual(RULES.hp * RULES.count.lowHp);
    expect(sim.player.hp).toBeLessThan(RULES.hp * RULES.count.lowHp + 1);
    // with focus: up early, with more
    toCount(sim, clock);
    expect(sim.stage).toBe('count');
    expect(sim.player.lives).toBe(1);
    const c1 = clock.t;
    const run = drive(sim, sim.plan.count, STRONG, clock);
    const up = run.stages.find(s => s.stage !== 'count');
    expect(up!.t - c1).toBeLessThan(sim.plan.count - 1);
    expect(ofType(run.evs, 'cue').some(e => e.cue === 'rise')).toBe(true);
    // the third knockdown: the fight is over
    toCount(sim, clock);
    expect(sim.fights[0]?.how).toBe('out');
    expect(sim.player.lives).toBe(0);
  });

  it('a knockout win: the opponent rises twice with half health, the third time is the end', () => {
    const sim = makeSim({ planned: 1200 });
    const clock = { t: 0 };
    const run: Run = { evs: [], stages: [], lifeLostAt: [] };
    for (let i = 0; i < 40000 && !sim.fights.length; i++) {
      if (sim.stage === 'read') sim.foe.hp = Math.min(sim.foe.hp, 3);
      drive(sim, STEP, STRONG, clock, run);
    }
    expect(sim.fights[0]?.how).toBe('ko');
    expect(ofType(run.evs, 'knockdown').filter(e => e.who === 'foe')).toHaveLength(3);
    expect(run.stages.filter(s => s.stage === 'foeCount')).toHaveLength(2);
    expect(sim.view(false).banner?.text).toBe(t('ban.ko'));
  });

  it('a win at the bell for the one still on the feet; a loss with time left brings a rematch with the same opponent', () => {
    const a = makeSim({ planned: 180 });
    drive(a, 181, STRONG);
    expect(a.fights.map(f => f.how)).toEqual(['bell']);
    const b = makeSim({ planned: 1800, seed: 2 });
    drive(b, 1801, NONE);
    expect(b.fights[0].how).toBe('out');
    expect(b.fights.length).toBeGreaterThanOrEqual(2);
    expect(b.fights[1].foe).toBe(b.fights[0].foe);
    // a win moves up the ladder; a loss keeps the rung
    expect(ladderAfter(0, true)).toBe(1);
    expect(ladderAfter(2, false)).toBe(2);
    expect(ladderAfter(LADDER.length - 1, true)).toBe(LADDER.length - 1);
  });
});

// ── fairness ──────────────────────────────────────────────────────

describe('Dobry bój — fairness (strong / average / weak / no focus × 3, 10, 30 min)', () => {
  const play = (pl: Player, T: number, seed: number, style: Style = 'boks') => {
    const sim = makeSim({ planned: T, seed, progress: { style } });
    const run = drive(sim, T + 0.2, pl);
    return { sim, run };
  };

  it('the strong player never loses a life and knocks out within 10 minutes', () => {
    for (const style of STYLES) for (const T of [180, 600, 1800]) {
      const { sim, run } = play(STRONG, T, 3, style);
      expect(run.lifeLostAt, `${style} ${T}`).toEqual([]);
      expect(sim.tally.lost).toBe(0);
      if (T >= 600) expect(sim.tally.kos, `${style} ${T}`).toBeGreaterThanOrEqual(1);
      expect(sim.score).toBeGreaterThan(T / 30);
    }
  });

  it('the average player usually wins — at the bell or by knockout — and loses at most a life in 10 minutes', () => {
    for (const style of STYLES) for (const T of [180, 600, 1800]) for (const seed of [1, 2]) {
      const { sim, run } = play(AVERAGE, T, seed, style);
      expect(sim.tally.lost, `${style} ${T} ${seed}`).toBe(0);
      if (T <= 600) expect(run.lifeLostAt.length, `${style} ${T}`).toBeLessThanOrEqual(1);
      expect(sim.score).toBeGreaterThan(0);
    }
  });

  it('the weak player still lands strikes and finishes 10 minutes on the feet', () => {
    for (const style of STYLES) {
      const { sim } = play(WEAK, 600, 4, style);
      expect(sim.score).toBeGreaterThan(5);
      expect(sim.tally.lost, style).toBe(0);
    }
  });

  it('no focus: no landed strikes, no life lost in the first minute, lives lost steadily — a fight lost in 30 minutes', () => {
    for (const style of STYLES) for (const T of [180, 600, 1800]) {
      const { sim, run } = play(NONE, T, 5, style);
      expect(sim.score, `${style} ${T}`).toBe(0);
      expect(run.lifeLostAt.every(t => t > 60), `${style} ${T}`).toBe(true);
      if (T >= 600) expect(run.lifeLostAt.length, `${style} ${T}`).toBeGreaterThanOrEqual(2);
      if (T >= 1800) expect(sim.tally.lost, `${style} ${T}`).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── the view, the signal ──────────────────────────────────────────

describe('Dobry bój — the view and the band', () => {
  it('builds a sound FightView every frame of a whole session', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    const phases = new Set<string>();
    for (let i = 0; i < 300 / STEP; i++) {
      drive(sim, STEP, AVERAGE, clock);
      const v = sim.view(false);
      phases.add(v.phase);
      expect(v.energy).toBeGreaterThanOrEqual(0);
      expect(v.energy).toBeLessThanOrEqual(1);
      expect(v.slow).toBeGreaterThanOrEqual(0);
      expect(v.slow).toBeLessThanOrEqual(1);
      expect(v.timeScale).toBeGreaterThan(0);
      expect(v.player.hp).toBeGreaterThanOrEqual(0);
      expect(v.player.t).toBeGreaterThanOrEqual(0);
      expect(v.player.t).toBeLessThanOrEqual(1);
      expect(v.foe.t).toBeGreaterThanOrEqual(0);
      expect(v.foe.t).toBeLessThanOrEqual(1);
      expect(v.options.length).toBeLessThanOrEqual(3);
      if (v.options.length) {
        expect(v.phase).toBe('slow');
        expect(v.left).not.toBeNull();
      }
      if (v.phase !== 'slow') expect(v.left).toBeNull();
      if (v.incoming) expect(v.incoming.travel).toBeGreaterThanOrEqual(RULES.travel0 - 1e-9);
      for (const im of v.impacts) expect(im.age).toBeLessThanOrEqual(RULES.impactSec + 1e-9);
      expect(v.player.name).toBe(t('you'));
    }
    for (const p of ['intro', 'read', 'sequence', 'slow', 'resolve', 'corner', 'end']) expect(phases, p).toContain(p);
  });

  it('asks for focus in the slow motion and the count, rest in the read and the corner; quiet pad; a gauge that follows the pace', () => {
    const sim = makeSim({ planned: 600 });
    const kinds = new Map<string, Set<string>>();
    drive(sim, 600, { push: (_t, s) => { const set = kinds.get(s.stage) ?? new Set(); set.add(s.kind); kinds.set(s.stage, set); return HIGH; }, pick: () => true });
    expect([...(kinds.get('slow') ?? [])]).toEqual(['push']);
    const s2 = makeSim({ planned: 600 });
    const clock = { t: 0 };
    let sawRest = false, sawPushMeter = false;
    for (let i = 0; i < 200 / STEP; i++) {
      drive(s2, STEP, STRONG, clock);
      if (s2.restBlock) { sawRest = true; expect(s2.meter()).toBeCloseTo(s2.calm, 6); }
      if (s2.pushBlock && s2.sighted && s2.meter() !== null) sawPushMeter = true;
      if (s2.pushBlock && !s2.sighted) expect(s2.meter()).toBeNull();
    }
    expect(sawRest && sawPushMeter).toBe(true);
  });
});

// ── the progress ──────────────────────────────────────────────────

describe('Dobry bój — the progress', () => {
  it('settles once: the result is idempotent, records only rise, the ladder follows the wins', () => {
    const p = { ...freshProgress(), sessions: 2, best: 3, strikes: 3, seen: [...SEEN] } as BojProgress;
    const sim = new BojSim({ progress: p, rng: mulberry32(5), plannedSec: 600, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 600.5, STRONG);
    sim.finish();
    sim.finish();
    const a = JSON.stringify(sim.result()), b = JSON.stringify(sim.result());
    expect(a).toBe(b);
    expect(p.sessions).toBe(3);
    expect(p.best).toBe(Math.max(3, sim.score));
    expect(p.strikes).toBe(3 + sim.score);
    expect(p.wins).toBe(sim.tally.won);
    expect(p.fights).toBe(sim.fights.length);
    expect(p.ladder).toBe(sim.ladderNow);
    expect(p.ladder).toBeGreaterThan(0);
    const r = sim.result();
    expect(r.record).toBe(true);
    expect(r.unit).toBe(unit(sim.score));
    expect(r.verse).toBe(sim.closingVerse);
    expect(r.stats.length).toBeGreaterThan(2);
    // a lower score later does not lower the record
    const sim2 = new BojSim({ progress: p, rng: mulberry32(6), plannedSec: 40, eeg: false, tuning: TUNING });
    sim2.start();
    drive(sim2, 40.5, NONE);
    sim2.finish();
    expect(p.best).toBe(Math.max(3, sim.score));
    expect(sim2.result().record).toBe(false);
  });

  it('migrates fresh, broken and hostile saves field by field', () => {
    expect(migrate(freshProgress())).toEqual(freshProgress());
    for (const bad of [{}, { best: null }, { ver: 3, sessions: 4 }, {
      ver: 1, sessions: 'x', style: 'kick', sex: 'x', skin: 9, hair: -1, ladder: 99, titles: -2, fights: 2, wins: 7, kos: 9, best: -3,
      strikes: 'a', counters: null, seen: [1, 'a', 'a'], lastLen: Infinity,
    }]) {
      const p = migrate(bad as unknown as BojProgress);
      expect(p.ver).toBe(1);
      expect(Number.isInteger(p.sessions) && p.sessions >= 0).toBe(true);
      expect(STYLES).toContain(p.style);
      expect(['ona', 'on']).toContain(p.sex);
      expect(p.skin >= 0 && p.skin < SKIN_SWATCH.length).toBe(true);
      expect(p.hair >= 0 && p.hair < 4).toBe(true);
      expect(p.ladder >= 0 && p.ladder < LADDER.length).toBe(true);
      expect(p.wins).toBeLessThanOrEqual(p.fights);
      expect(p.kos).toBeLessThanOrEqual(p.wins);
      expect(p.seen.every(s => typeof s === 'string')).toBe(true);
      expect(Number.isFinite(p.lastLen)).toBe(true);
    }
    expect(migrate({ sessions: 5 } as unknown as BojProgress).sessions).toBe(5);
    const p = freshProgress();
    expect(setStyle(p, 'mma')).toBe(true);
    expect(setStyle(p, 'judo')).toBe(false);
    expect(setSex(p, 'ona')).toBe(true);
    expect(p.hair).toBe(1);
    expect(setSkin(p, 4)).toBe(true);
    expect(setSkin(p, 5)).toBe(false);
    expect(bestOf(freshProgress())).toBeNull();
  });

  it('builds the lobby card: the next opponent, the style, the fighter, five skin tones, the forecast and the spirit', () => {
    const p = freshProgress();
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    document.body.append(el);
    expect(el.textContent).toContain(t('foe.iskra'));
    expect(el.textContent).toContain(t('panel.spirit'));
    const mma = [...el.querySelectorAll('button')].find(b => b.textContent === t('style.mma'))!;
    mma.click();
    expect(p.style).toBe('mma');
    expect(saves).toBe(1);
    const skins = [...el.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label') ?? '').startsWith(t('skin.n', { n: '' }).trim()));
    expect(skins).toHaveLength(5);
    skins[3].click();
    expect(p.skin).toBe(3);
    for (const b of el.querySelectorAll('button')) expect((b as HTMLElement).style.minHeight).toBe('44px');
    expect(forecastLines(600)[0]).toMatch(/10/);
    expect(forecastLines(600)[0]).toContain(t('rounds', { n: 3 }));
    el.remove();
  });
});

// ── the words ─────────────────────────────────────────────────────

describe('Dobry bój — the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('names every move, defence, combination and opening of moves.ts, and the why of every right answer (≤ 70 characters)', () => {
    for (const l of LANGS) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const s of STRIKE_IDS) expect(typeof c[`strike.${s}`], `${l} strike.${s}`).toBe('string');
      for (const d of DEFENSE_IDS) for (const k of ['defense', 'dsub', 'dshort']) expect(typeof c[`${k}.${d}`], `${l} ${k}.${d}`).toBe('string');
      for (const cb of COMBOS) for (const k of ['combo', 'cl']) expect(typeof c[`${k}.${cb.id}`], `${l} ${k}.${cb.id}`).toBe('string');
      for (const o of OPENINGS) {
        expect(typeof c[`opening.${o.id}`], `${l} opening.${o.id}`).toBe('string');
        expect([...(c[`why.open.${o.id}`] as string)].length, `${l} why.open.${o.id}`).toBeLessThanOrEqual(70);
      }
      for (const d of DEFENSE_IDS) for (const s of STRIKE_IDS) {
        if (answer(d, s) < 1) continue;
        const w = c[`why.${d}.${s}`];
        expect(typeof w, `${l} why.${d}.${s}`).toBe('string');
        expect([...(w as string)].length, `${l} why.${d}.${s}`).toBeLessThanOrEqual(70);
      }
      for (const p of LADDER) expect(typeof c[`foeLine.${p.id}`]).toBe('string');
    }
    expect(personaProblems()).toEqual([]);
  });

  it('keeps the coach short, calm and every moment voiced', () => {
    for (const m of MOMENTS) {
      const lines = linesOf(m);
      expect(lines.length, m).toBeGreaterThan(0);
      for (const s of lines) expect([...s].length, s).toBeLessThanOrEqual(80);
    }
  });

  it('a sport with respect: no gore, no injuries, no insults, no killing — and no gendered Polish second person', () => {
    const FORBID: Record<string, RegExp> = {
      pl: /krew|krwi|krwaw|kontuzj|złaman|złama|rozbit|rozbij|zabij|zabić|śmier|miazg|frajer|słabeusz|nienawi|zniszcz/i,
      en: /blood|bleed|injur|broken|break (his|her)|kill|death|destroy|smash|crush|loser|weakling|hate/i,
      de: /blut|verletz|gebrochen|brech|töte|töten|tod\b|zerstör|vernicht|versager|hass/i,
      sv: /blod|skada (honom|henne)|bruten|döda|död\b|förstör|krossa|förlorare|hata/i,
    };
    const GENDERED = /\b\w+(łeś|łaś|łbyś|łabyś)\b|\b\w+(y|a)\/(a|y)\b|\bgotow[ya]\b|\bjesteś (gotow|zmęczon|silny|silna)/i;
    for (const l of LANGS) {
      const own = Object.entries(CATALOGS[l]).flatMap(([k, m]) => (typeof m === 'string' ? [[k, m]] : Object.values(m).map(v => [k, v as string])));
      const reg = Object.entries(ARCADE_TEXTS[l]).filter(([k]) => k.startsWith('boj.')).flatMap(([k, m]) => (typeof m === 'string' ? [[k, m]] : Object.values(m as object).map(v => [k, v as string])));
      for (const [k, s] of [...own, ...reg]) {
        expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
        if (l === 'pl') expect(s, `${l}.${k}`).not.toMatch(GENDERED);
      }
    }
    expect((MOUSE_TEXTS.pl as Record<string, string>)['boj.how3']).toMatch(/kliknij/);
  });

  it('counts landed strikes in Polish with all three forms', () => {
    expect(unit(1)).toBe('cios');
    expect(unit(3)).toBe('ciosy');
    expect(unit(5)).toBe('ciosów');
    expect(t('strikes', { n: 22 })).toBe('22\u00a0ciosy');
  });

  it('quotes only verified passages, each in four languages', () => {
    for (const id of ALL_VERSES) for (const l of LANGS) expect(passage(id, l).text.length, `${id} ${l}`).toBeGreaterThan(10);
    expect(ROOT).toBe('2ti4.7');
    expect(arcadeEntry('boj')?.root).toBe(ROOT);
    expect(verseFor('loss', 1)).toBe(VERSES.loss[0]);
    expect(verseFor('loss', 2)).toBe(VERSES.loss[1]);
    for (const id of ['1co9.26-27', 'psa144.1', 'psa18.34', 'pro24.16', 'mic7.8', '1ti6.12', '1co9.24', 'eph6.10-11', 'isa40.31', 'heb12.1', 'php4.13', 'jos1.9']) {
      expect(ALL_VERSES).toContain(id);
    }
  });
});

// ── the layout (builder B's) and the targets ──────────────────────

describe('Dobry bój — the options on every screen', () => {
  it('lists the open options as targets: at least 44 px, inside the insets, under the HUD band, clear of each other', () => {
    for (const size of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const l = layout(size.w, size.h, size.insets, touch);
        expect(l.options.length, size.name).toBeGreaterThanOrEqual(3);
        const targets = optionTargets(l, ['Unik + kontra', 'Garda', 'Blok goleniem']);
        expect(auditTargets(targets, size.w, size.h, size.insets), `${size.name} ${touch}`).toEqual([]);
        for (const r of targets) {
          expect(Math.min(r.w, r.h), size.name).toBeGreaterThanOrEqual(MIN_TAP);
          expect(r.y, size.name).toBeGreaterThanOrEqual(size.insets.top);
        }
      }
    }
  });

  it('keeps the verse card of a rest clear of the breath pacer, on the screen, above the options', () => {
    for (const size of CHECK_SIZES) {
      const l = layout(size.w, size.h, size.insets, true);
      const c = cardRect(l, true), p = l.pacer;
      expect(c.y, size.name).toBeGreaterThanOrEqual(size.insets.top);
      expect(c.y + c.h, size.name).toBeLessThanOrEqual(size.h - size.insets.bottom);
      expect(c.h, size.name).toBeGreaterThanOrEqual(80);
      if (p) expect(overlaps(c, pacerBox(p, pacerSizeAt(p, true))), size.name).toBe(false);
    }
  });
});

describe('Dobry bój — 45–60 minutes', () => {
  it('plans 45 and 60 minutes: rounds of three minutes, room for six or seven fights, the last bell before the end', () => {
    for (const T of [2700, 3600]) {
      const p = planFor({ plannedSec: T, eeg: false });
      expect(roundSecFor(T)).toBe(180);
      expect(p.lastBell).toBeLessThan(T);
      expect(T - p.lastBell).toBeLessThan(60);
      const f = fightPlan(p, p.intro);
      expect(f.rounds).toBeLessThanOrEqual(RULES.maxRoundsLast);
      expect(f.last).toBe(false);
    }
  }, 300_000);

  const play = (pl: Player, T: number, seed: number, style: Style = 'boks') => {
    const sim = makeSim({ planned: T, seed, progress: { style } });
    const run = drive(sim, T + 0.2, pl);
    return { sim, run };
  };

  it('every player plays 45 and 60 minutes to the end: the strong never falls, the average wins, the one without focus loses steadily but is never stuck', () => {
    for (const style of STYLES) for (const T of [2700, 3600]) {
      const name = `${style} ${T}`;
      const strong = play(STRONG, T, 3, style);
      expect(strong.run.lifeLostAt, name).toEqual([]);
      expect(strong.sim.tally.kos, name).toBeGreaterThanOrEqual(3);
      expect(strong.sim.fights.length, name).toBeGreaterThanOrEqual(5);
      const avg = play(AVERAGE, T, 2, style);
      expect(avg.sim.tally.lost, name).toBe(0);
      expect(avg.sim.tally.won, name).toBeGreaterThanOrEqual(4);
      const weak = play(WEAK, T, 4, style);
      expect(weak.sim.score, name).toBeGreaterThan(T / 100);
      const none = play(NONE, T, 5, style);
      expect(none.sim.score, name).toBe(0);
      expect(none.sim.fights.length, name).toBeGreaterThanOrEqual(4);
      for (const { sim } of [strong, avg, weak, none]) {
        expect(sim.stage, name).toBe('end');
        expect(sim.canStop(), name).toBe(true);
        expect(sim.impacts.length, name).toBeLessThan(20);
        expect(sim.talk.said.length, name).toBeLessThanOrEqual(120);
        const r = sim.result();
        // the summary: a line a fight for the last four (the same line once), the stats keep the whole record
        expect(r.highlights.length, name).toBeLessThanOrEqual(9);
        expect(new Set(r.highlights).size, name).toBe(r.highlights.length);
        expect(r.stats[0][1], name).toBe(`${sim.tally.won}–${sim.tally.lost}`);
        for (const h of [...r.highlights, ...r.stats.flat()]) expect(h, name).not.toMatch(/undefined|NaN|Infinity|\{/);
      }
    }
  }, 300_000);
});

describe('Dobry bój — 45–60 minutes, drawn', () => {
  it('costs a frame at the hour what it cost in the first minutes (nothing drawn piles up)', () => {
    const simOf = (game: unknown) => (game as { sim: BojSim }).sim;
    let lastEx: unknown = null;
    const { early, late } = hourFrames({
      module: boj, progress: { ...boj.freshProgress(), sessions: 5, seen: [...SEEN] } as BojProgress, tuning: TUNING,
      frame: game => (simOf(game).pushBlock ? HIGH : LOW),
      each: game => {
        const sim = simOf(game);
        if (sim.stage === 'slow' && sim.ex && sim.ex !== lastEx && sim.ex.opts.length) { lastEx = sim.ex; sim.choose(sim.ex.right); }
      },
    });
    expect(late.length).toBeGreaterThan(200);
    expect(mean(late)).toBeLessThan(mean(early) * 1.5);
    expect(Math.max(...late)).toBeLessThan(Math.max(...early) * 1.5);
  }, 300_000);
});

// ── round 25: through the boxer's eyes (DESIGN §29) ─────────────────────────────────────

/** A 2-D context that only records the text drawn and its size (the picture's other calls do nothing). */
function recCtx(): { ctx: CanvasRenderingContext2D; texts: { text: string; px: number }[] } {
  const texts: { text: string; px: number }[] = [];
  const pxOf = (f: string): number => Number(/(\d+(?:\.\d+)?)px/.exec(f)?.[1] ?? 10);
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1 };
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (x: string) => ({ width: String(x).length * pxOf(String(target.font)) * 0.55 });
      if (prop === 'fillText' || prop === 'strokeText') return (x: unknown) => {
        const text = String(x);
        if (text.trim() && (target.globalAlpha as number) > 0.05) texts.push({ text, px: pxOf(String(target.font)) });
      };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => undefined;
    },
    set(target, prop, value) { target[prop] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

const ME_LOOK: Look = { sex: 'ona', skin: 3, hair: 1, kit: '#2c5aa0', gloves: '#c0342f' };
const FOE_LOOK: Look = { sex: 'ona', skin: 0, hair: 2, kit: '#a8443a', gloves: '#f0c040' };
const FP_OPTS: Option[] = [
  { id: 'a', kind: 'counter', label: 'Unik + kontra', sub: 'z lewym podbródkowym', chosen: true, hint: false, aim: 'head' },
  { id: 'c', kind: 'attack', label: '1-2 + obalenie', sub: 'lewy, prawy i obalenie', chosen: false, hint: false },
  { id: 'd', kind: 'counter', label: 'Ausweichen + Konter', sub: 'mit linkem Aufwärtshaken', chosen: false, hint: true },
];
function fpView(phase: Phase, style: Style, extra: Partial<FightView> = {}): FightView {
  const strike = style === 'mma' ? 'bodyKick' : 'hookR';
  return {
    style, phase, timeScale: phase === 'slow' ? 0.05 : 1, slow: phase === 'slow' ? 1 : 0,
    player: { look: ME_LOOK, act: phase === 'count' ? { kind: 'down' } : { kind: 'guard' }, t: 0.5, dur: 1, hp: 0.4, lives: 2, maxLives: 3, name: 'Ty' },
    foe: { look: FOE_LOOK, act: phase === 'slow' ? { kind: 'strike', strike, power: 1 } : phase === 'corner' ? { kind: 'corner' } : { kind: 'guard' }, t: 0.4, dur: 1, hp: 0.8, lives: 3, maxLives: 3, name: 'Mistrzyni' },
    round: 2, rounds: 3, energy: 0.6, ready: false, left: phase === 'slow' ? 12 : null,
    incoming: phase === 'slow' ? { strike, travel: 0.5 } : null,
    options: phase === 'slow' ? FP_OPTS : [], impacts: [{ on: 'foe', target: 'head', force: 0.8, text: 'Kontra!', age: 0.3 }, { on: 'player', target: 'body', force: 0.6, text: '−4', age: 0.1 }],
    count: phase === 'count' ? 7 : null, banner: phase === 'end' ? { text: 'DO KOŃCA NA NOGACH', age: 1 } : null,
    coach: phase === 'read' || phase === 'corner' ? 'Oddychaj. Ręce wysoko, łokcie przy sobie — jeszcze chwila.' : null,
    why: phase === 'slow' ? 'Pod hakiem przechodzi się rolką — kolana miękko, głowa pod łukiem.' : null,
    crowd: 0.6, breath: 0.5, reduced: false,
    prompt: phase === 'slow' ? 'Nadchodzi: prawy sierpowy' : null, choice: null, closed: null, ...extra,
  };
}

/** The module's game in a view, on a fake canvas (the picture draws on a recording context). */
function gameIn(view: 'side' | 'fp', o: { planned?: number; seed?: number; level?: Difficulty; reduced?: boolean } = {}) {
  const progress = { ...freshProgress(), sessions: 5, seen: [...SEEN], view, difficulty: o.level ?? 'regular' } as BojProgress;
  const canvas = document.createElement('canvas');
  const { ctx } = recCtx();
  (canvas as unknown as { getContext: () => CanvasRenderingContext2D }).getContext = () => ctx;
  const game = boj.create({
    canvas, hud: document.createElement('div'), audio: new ArcadeAudio(0, false), progress, rng: mulberry32(o.seed ?? 9), day: '2026-11-28', daySeed: 3,
    plannedSec: o.planned ?? 240, tool: 'fnirs', simulated: true, reducedMotion: !!o.reduced, haptics: false, tuning: TUNING, hint: () => {},
    hudTop: () => 64, insets: () => ({ top: 64, right: 0, bottom: 0, left: 0 }), touch: true,
  });
  game.resize(390, 844, 2);
  game.start();
  return { game, sim: (game as unknown as { sim: BojSim }).sim, progress };
}

describe('Dobry bój — through the boxer’s eyes (round 25)', () => {
  it('keeps the side view for a save that has none; the choice survives a broken save; first person only when chosen', () => {
    expect(freshProgress().view).toBe('side');
    expect(migrate({ ...freshProgress(), view: undefined } as unknown as BojProgress).view).toBe('side');
    expect(migrate({ ...freshProgress(), view: 'fp' } as BojProgress).view).toBe('fp');
    for (const junk of ['first', 3, null, {}]) expect(migrate({ ...freshProgress(), view: junk } as unknown as BojProgress).view).toBe('side');
    const broken = migrate({ ver: 7, sessions: 4, view: 'fp', difficulty: 'hardcore' } as unknown as BojProgress);
    expect([broken.view, broken.difficulty, broken.sessions]).toEqual(['fp', 'hardcore', 4]);
    expect(viewOf('fp')).toBe('fp');
    const p = freshProgress();
    expect(setView(p, 'fp')).toBe(true);
    expect(setView(p, 'top')).toBe(false);
    expect(p.view).toBe('fp');
  });

  it('plays the same fight in both views — only the picture differs', () => {
    const runs = (['side', 'fp'] as const).map(view => {
      const { game, sim } = gameIn(view, { planned: 240, seed: 4 });
      const stages: string[] = [];
      let lastEx: unknown = null, n = 0;
      for (let t = STEP; t < 240.5; t += STEP) {
        game.update(STEP, sim.pushBlock ? (Math.floor(t / 7) % 3 ? AVG : LOW) : LOW, t);
        if (sim.stage === 'slow' && sim.ex && sim.ex !== lastEx && sim.ex.opts.length) {
          lastEx = sim.ex;
          sim.choose(n++ % 3 ? sim.ex.right : (sim.ex.right + 1) % sim.ex.opts.length);
        }
        if (stages[stages.length - 1] !== sim.stage) stages.push(sim.stage);
        if (Math.round(t / STEP) % 6 === 0) game.draw();
      }
      game.finish?.();
      return { stages: stages.join(','), result: JSON.stringify(game.result()), score: sim.score };
    });
    expect(runs[1].stages).toBe(runs[0].stages);
    expect(runs[1].result).toBe(runs[0].result);
    expect(runs[0].score).toBeGreaterThan(0);
  });

  it('draws every phase at every size, both styles, with and without reduced motion — no text under 13 px, the prompt over the opponent', () => {
    const phases: Phase[] = ['intro', 'read', 'sequence', 'slow', 'resolve', 'corner', 'count', 'end'];
    for (const z of CHECK_SIZES) {
      for (const style of STYLES) {
        const l = layout(z.w, z.h, z.insets, z.w < 900);
        for (const reduced of [false, true]) {
          const fv = new FirstPersonView({ reduced });
          fv.resize(l, 2);
          for (const ph of phases) {
            const { ctx, texts } = recCtx();
            for (let i = 0; i < 4; i++) fv.draw(ctx, fpView(ph, style, { reduced }), 1 / 30, i / 30);
            for (const tx of texts) expect(tx.px, `${z.name} ${ph} "${tx.text}"`).toBeGreaterThanOrEqual(MIN_READ);
            if (ph === 'slow') {
              expect(texts.some(tx => tx.text.startsWith('Nadchodzi')), `${z.name} prompt`).toBe(true);
              expect(texts.some(tx => tx.text.startsWith('Unik'))).toBe(true);
            }
          }
        }
      }
    }
    // the lobby's picture at any size, with or without a look
    for (const [w, h] of [[340, 190], [390, 260], [520, 760], [220, 124], [1, 1], [0, 0]] as const) {
      for (const style of [undefined, 'boks', 'mma'] as const) {
        const { ctx } = recCtx();
        expect(() => drawFpPreview(ctx, w, h, 2.5, w > 400 ? ME_LOOK : undefined, style)).not.toThrow();
      }
    }
  });

  it('moves the camera gently: a slip tilts at most 6°, the guard bobs a few pixels, reduced motion keeps it still', () => {
    for (const reduced of [false, true]) {
      const sim = makeSim({ planned: 420, seed: 11, progress: { style: 'mma' } });
      const l = layout(390, 844, { top: 64, right: 0, bottom: 0, left: 0 }, true);
      const fv = new FirstPersonView({ reduced });
      fv.resize(l, 2);
      const cam = () => (fv as unknown as { cam: { x: number; y: number; z: number; roll: number; pitch: number } }).cam;
      const clock = { t: 0 };
      const { ctx } = recCtx();
      let maxRoll = 0, maxPitch = 0, rolled = 0;
      const readY: number[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < 420 / STEP; i++) {
        drive(sim, STEP, { push: () => AVG, pick: n => n % 3 !== 2 }, clock);
        fv.draw(ctx, sim.view(reduced), STEP, clock.t);
        const c = cam();
        maxRoll = Math.max(maxRoll, Math.abs(c.roll));
        maxPitch = Math.max(maxPitch, Math.abs(c.pitch));
        if (Math.abs(c.roll) > 0.02) rolled++;
        if (sim.stage === 'read' && sim.player.act.kind === 'guard' && sim.blockT > 1) readY.push(c.y);
        seen.add(`${c.x.toFixed(4)},${c.y.toFixed(4)},${c.z.toFixed(4)},${c.roll.toFixed(4)}`);
      }
      expect(maxRoll).toBeLessThanOrEqual(0.105 + 1e-9);
      expect(maxPitch).toBeLessThanOrEqual(0.07 + 1e-9);
      if (reduced) expect(seen.size).toBe(1);
      else {
        expect(rolled, 'the slips and rolls tilt the view').toBeGreaterThan(0);
        // the guard's bob, in pixels at the opponent's distance in the read
        const f = lensOf(l.stage!), depth = 0.86 + BACK;
        expect((Math.max(...readY) - Math.min(...readY)) * f / depth).toBeLessThan(4);
      }
    }
  });

  it('puts the player’s own gloves at the frame’s foot at rest, over the chin in a block, and lands a strike where the target shows', () => {
    const l = layout(390, 844, { top: 64, right: 0, bottom: 0, left: 0 }, true);
    const stage = l.stage!;
    const f = lensOf(stage);
    const b = BUILD.on, D = 0.62;
    const c = { style: 'boks' as Style, D, time: 0 };
    const g0 = solve(poseFor({ kind: 'guard' }, 0, c), b);
    const cam = makeCam({ x: (g0.head[0] + 0.045) - BACK, y: g0.head[1] + 0.035, z: 0, f, ox: stage.x + stage.w / 2, oy: stage.y + stage.h * 0.3 });
    const rest = ownGloves(cam, { kind: 'guard' }, 'boks', D, g0, g0, b, stage, stage);
    for (const sd of ['L', 'R'] as const) {
      const at = restAt(stage, stage, sd);
      expect(rest[sd].x).toBeCloseTo(at.x, 6);
      expect(rest[sd].y).toBeCloseTo(at.y, 6);
      expect(rest[sd].y).toBeGreaterThan(stage.y + stage.h * 0.6);
      expect(rest[sd].y).toBeLessThanOrEqual(stage.y + stage.h);
      expect(rest[sd].r).toBeGreaterThanOrEqual(restRadius(stage) * 0.9);
    }
    expect(rest.L.x).toBeLessThan(cam.ox);
    expect(rest.R.x).toBeGreaterThan(cam.ox);
    // a block raises both gloves toward the chin
    const blk = ownGloves(cam, { kind: 'defend', defense: 'block', ok: 1 }, 'boks', D, solve(poseFor({ kind: 'defend', defense: 'block', ok: 1 }, 0.5, c), b), g0, b, stage, stage);
    expect(blk.L.y).toBeLessThan(rest.L.y - 20);
    expect(Math.abs(blk.R.x - cam.ox)).toBeLessThan(Math.abs(rest.R.x - cam.ox));
    // the jab at contact: the glove is where the projection puts it — on the opponent's face
    for (const id of ['jab', 'cross', 'hookL', 'upperR'] as const) {
      const act = { kind: 'strike' as const, strike: id, power: 1 };
      const j = solve(poseFor(act, travelT(id, 1) - 1e-4, c), b);
      const g = ownGloves(cam, act, 'boks', D, j, g0, b, stage, stage);
      const sd = id === 'jab' || id === 'hookL' ? 'L' : 'R';
      const glove = project(cam, ...worldOf(sd === 'L' ? j.gL : j.gR, b, { x: 0, z: 0, yaw: 0 }));
      expect(Math.hypot(g[sd].x - glove.x, g[sd].y - glove.y), id).toBeLessThan(2);
      const aim = aimAt('head', D);
      const target = project(cam, aim[0], aim[1], 0);
      expect(Math.hypot(glove.x - target.x, glove.y - target.y), id).toBeLessThan(f * 0.12);
      expect(reachOf(act, sd, D)).toBeCloseTo(aim[0], 6);
    }
    expect(reachOf({ kind: 'touch' }, 'L', D)).toBeCloseTo(D / 2, 6);
    // the spacing through the eyes: across the ring in the corner, close in the exchange
    expect(fpSpacing(fpView('corner', 'boks', { player: { ...fpView('corner', 'boks').player, act: { kind: 'corner' } } }))).toBeGreaterThan(2);
    expect(fpSpacing(fpView('slow', 'boks'))).toBeLessThan(0.7);
    void Rig;
  });

  it('offers the view on the lobby card — two tiles with their own small picture — and the lobby’s hero follows it', () => {
    const p = freshProgress();
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    document.body.append(el);
    const tiles = [...el.querySelectorAll<HTMLButtonElement>('button[data-view]')];
    expect(tiles.map(b => b.dataset.view)).toEqual(['side', 'fp']);
    expect(tiles.every(b => b.querySelector('canvas'))).toBe(true);
    expect(tiles[0].getAttribute('aria-checked')).toBe('true');
    expect(el.textContent).toContain(t('view.fp'));
    tiles[1].click();
    expect(p.view).toBe('fp');
    expect(saves).toBe(1);
    expect(el.querySelector('button[data-view="fp"]')?.getAttribute('aria-checked')).toBe('true');
    expect(el.textContent).toContain(t('view.fpNote'));
    for (const b of el.querySelectorAll('button')) expect((b as HTMLElement).style.minHeight).toBe('44px');
    el.remove();
    const { ctx } = recCtx();
    expect(() => boj.preview(ctx, 390, 260, 1.5, p)).not.toThrow();
    expect(() => boj.preview(ctx, 390, 260, 1.5)).not.toThrow();
  });

  it('hears a blow from its side through the eyes, safely in every state', () => {
    const s = new RingSound(new ArcadeAudio(0, false), { reducedMotion: false });
    expect(() => { s.cue('jab', 1, -0.6); s.cue('punch', 0.8, 0.6); s.start(); s.cue('blocked', 0.5, 0.6); s.destroy(); s.cue('jab', 1, -1); }).not.toThrow();
    // through the eyes the game picks the side by the hand that threw; from the side it stays in the middle
    for (const view of ['side', 'fp'] as const) {
      const { game, sim } = gameIn(view, { planned: 120 });
      const pans: number[] = [];
      const sound = (game as unknown as { sound: RingSound }).sound;
      const orig = sound.cue.bind(sound);
      sound.cue = (c, k, pan = 0) => { if (['jab', 'punch', 'body', 'blocked'].includes(c)) pans.push(pan); orig(c, k, pan); };
      for (let t = STEP; t < 120; t += STEP) {
        game.update(STEP, sim.pushBlock ? HIGH : LOW, t);
        if (sim.stage === 'slow' && sim.ex && !sim.ex.chosen && sim.ex.opts.length) sim.choose(sim.ex.right);
      }
      expect(pans.length, view).toBeGreaterThan(0);
      if (view === 'side') expect(pans.every(x => x === 0)).toBe(true);
      else expect(pans.some(x => x !== 0)).toBe(true);
    }
  });
});

describe('Dobry bój — 45–60 minutes through the eyes, drawn', () => {
  it('costs a frame at the hour what it cost in the first minutes (nothing of the first-person picture piles up)', () => {
    const simOf = (game: unknown) => (game as { sim: BojSim }).sim;
    let lastEx: unknown = null;
    const { early, late } = hourFrames({
      module: boj, progress: { ...boj.freshProgress(), sessions: 5, seen: [...SEEN], view: 'fp' } as BojProgress, tuning: TUNING,
      frame: game => (simOf(game).pushBlock ? HIGH : LOW),
      each: game => {
        const sim = simOf(game);
        if (sim.stage === 'slow' && sim.ex && sim.ex !== lastEx && sim.ex.opts.length) { lastEx = sim.ex; sim.choose(sim.ex.right); }
      },
    });
    expect(late.length).toBeGreaterThan(200);
    expect(mean(late)).toBeLessThan(mean(early) * 1.5);
    expect(Math.max(...late)).toBeLessThan(Math.max(...early) * 1.5);
  }, 300_000);
});

// ── round 25: the four levels (kit/difficulty.ts, DESIGN §29) ─────────────────────────────

describe('Dobry bój — the difficulty levels (round 25)', () => {
  const lvSim = (level: Difficulty, o: Opts = {}) => makeSim({ ...o, progress: { ...o.progress, difficulty: level } });
  const playAt = (level: Difficulty, pl: Player, T: number, seed: number, style: Style = 'boks') => {
    const sim = lvSim(level, { planned: T, seed, progress: { style } });
    const run = drive(sim, T + 0.2, pl);
    return { sim, run };
  };

  it('orders the four levels: harder, faster, tighter opponents and fewer helps from STARTING to HARDCORE; REGULAR is the design', () => {
    const L = DIFFICULTIES.map(d => LEVELS[d]);
    for (let i = 1; i < L.length; i++) {
      expect(L[i].pow, L[i].d).toBeGreaterThan(L[i - 1].pow);
      expect(L[i].chin, L[i].d).toBeLessThan(L[i - 1].chin);
      expect(L[i].guard, L[i].d).toBeGreaterThan(L[i - 1].guard);
      expect(L[i].aggr, L[i].d).toBeGreaterThan(L[i - 1].aggr);
      expect(L[i].speed, L[i].d).toBeGreaterThanOrEqual(L[i - 1].speed);
      expect(L[i].hintSessions, L[i].d).toBeLessThan(L[i - 1].hintSessions);
      expect(L[i].hintWrong, L[i].d).toBeGreaterThanOrEqual(L[i - 1].hintWrong);
      expect(L[i].chooseSec, L[i].d).toBeLessThanOrEqual(L[i - 1].chooseSec);
    }
    expect(LEVELS.regular).toEqual({ d: 'regular', pow: 1, chin: 1, speed: 1, guard: 1, aggr: 1, hintSessions: RULES.hint.sessions, hintWrong: RULES.hint.wrongRun, chooseSec: Infinity });
    expect(LEVELS.start.speed).toBe(1);
    expect(LEVELS.hardcore.chooseSec).toBeGreaterThanOrEqual(4);
    expect(levelOf(undefined).d).toBe('regular');
    expect(levelOf('nope').d).toBe('regular');
    // a level changes the game, never the training: the energy's need and rate are the same functions of focus
    for (const d of DIFFICULTIES) {
      const s = lvSim(d, { planned: 600 });
      expect(s.plan).toEqual(makeSim({ planned: 600 }).plan);
    }
    expect(attackLands(4, 0.7, 0.9, 1)).toEqual(attackLands(4, 0.7, 0.9));
    expect(attackLands(4, 1, 1, LEVELS.hardcore.guard)).toEqual([true, true, true, true]);
    expect(attackLands(4, 1, 0.35, LEVELS.hardcore.guard)[0]).toBe(true);
  });

  it('REGULAR is the game as it was: an old save and a REGULAR one play the identical fight', () => {
    for (const T of [40, 600]) {
      const a = makeSim({ planned: T, seed: 21 });
      const old = { ...freshProgress(), sessions: 5, seen: [...SEEN] } as Partial<BojProgress>;
      delete old.difficulty;
      delete old.records;
      delete old.view;
      const b = new BojSim({ progress: old as BojProgress, rng: mulberry32(21), plannedSec: T, eeg: false, tuning: TUNING, rhythm: null });
      b.start();
      const ra = drive(a, T + 0.2, AVERAGE), rb = drive(b, T + 0.2, AVERAGE);
      expect(JSON.stringify(rb.stages)).toBe(JSON.stringify(ra.stages));
      a.finish(); b.finish();
      expect(JSON.stringify(b.result())).toBe(JSON.stringify(a.result()));
      expect(a.result().stats.some(([k]) => k === t('stat.level'))).toBe(false);
    }
  });

  it('measured in the sim: lives lost rise and knockouts fall from STARTING to HARDCORE; the strong player never falls at any level', () => {
    for (const style of STYLES) {
      const lives = (pl: Player, T: number) => DIFFICULTIES.map(d => [1, 2].reduce((a, seed) => a + playAt(d, pl, T, seed, style).run.lifeLostAt.length, 0));
      for (const [pl, T] of [[WEAK, 1800], [NONE, 600], [NONE, 1800]] as const) {
        const L = lives(pl, T);
        for (let i = 1; i < L.length; i++) expect(L[i], `${style} ${T} ${L}`).toBeGreaterThanOrEqual(L[i - 1]);
        expect(L[3], `${style} ${T} ${L}`).toBeGreaterThan(L[0]);
      }
      const kos = DIFFICULTIES.map(d => {
        const { sim, run } = playAt(d, STRONG, 1800, 3, style);
        expect(run.lifeLostAt, `${style} ${d}`).toEqual([]);
        expect(sim.tally.lost, `${style} ${d}`).toBe(0);
        return sim.tally.kos;
      });
      expect(kos[0], `${style} ${kos}`).toBeGreaterThanOrEqual(kos[1]);
      expect(kos[1], `${style} ${kos}`).toBeGreaterThanOrEqual(kos[2]);
      expect(kos[2], `${style} ${kos}`).toBeGreaterThanOrEqual(kos[3]);
      expect(kos[0], `${style} ${kos}`).toBeGreaterThan(kos[3]);
      // STARTING: a weak player finishes half an hour without a life lost; no focus still stands ten minutes
      expect(playAt('start', WEAK, 1800, 4, style).run.lifeLostAt, style).toEqual([]);
      expect(playAt('start', NONE, 600, 5, style).sim.tally.lost, style).toBe(0);
    }
  }, 300_000);

  it('a 40 s test scores at every level — Mendi and HALO, first-ever and returning, without a tap, at half focus', () => {
    for (const d of DIFFICULTIES) for (const eeg of [false, true]) for (const sessions of [0, 5]) {
      for (const pl of [{ push: () => HIGH, pick: () => null } as Player, { push: (t: number) => (Math.floor(t / 2) % 2 ? LOW : HIGH), pick: () => null } as Player]) {
        const sim = lvSim(d, { planned: 40, seed: 40 + sessions, eeg, progress: { sessions, seen: sessions ? [...SEEN] : [] } });
        drive(sim, 40 * 0.85, pl);
        expect(sim.score, `${d} ${eeg ? 'eeg' : 'fnirs'} ${sessions}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('closes the quick-time choice a few seconds into the slow motion on ADVANCED and HARDCORE, never on REGULAR or STARTING', () => {
    for (const d of DIFFICULTIES) {
      const sim = lvSim(d, { planned: 600, seed: 3 });
      const clock = { t: 0 };
      while (sim.stage !== 'slow' && clock.t < 60) drive(sim, STEP, { push: () => LOW, pick: () => null }, clock);
      expect(sim.stage).toBe('slow');
      const L = LEVELS[d];
      const v0 = sim.view(false);
      if (Number.isFinite(L.chooseSec)) expect(v0.choice?.open).toBe(true);
      else expect(v0.choice ?? null).toBeNull();
      while (sim.stage === 'slow' && sim.blockT < Math.min(L.chooseSec, sim.ex!.window) + 0.1) drive(sim, STEP, { push: () => LOW, pick: () => null }, clock);
      if (sim.stage !== 'slow') { expect(Number.isFinite(L.chooseSec)).toBe(false); continue; }
      const v = sim.view(false);
      if (Number.isFinite(L.chooseSec)) {
        expect(sim.choiceOpen, d).toBe(false);
        expect(sim.choose(0), d).toBe(false);
        expect(v.choice?.open).toBe(false);
        expect(v.options.filter(o => o.chosen)).toHaveLength(1);
        expect(v.options.findIndex(o => o.chosen)).toBe(sim.defaultPick);
        expect(v.closed).toBe(t('choice.closed'));
      } else {
        expect(sim.choiceOpen, d).toBe(true);
        expect(sim.choose(1), d).toBe(true);
        expect(v.closed ?? null).toBeNull();
      }
    }
    // the coach's pick: every STARTING session's first five, never on HARDCORE
    expect(lvSim('hardcore', { progress: { sessions: 0, seen: [...SEEN] } }).hintOn).toBe(false);
    expect(lvSim('start', { progress: { sessions: 4 } }).hintOn).toBe(true);
    expect(lvSim('regular', { progress: { sessions: 4 } }).hintOn).toBe(false);
  });

  it('keeps the records per level (REGULAR’s where they were) and names a level other than REGULAR in the summary', () => {
    const p = { ...freshProgress(), sessions: 2, best: 3, strikes: 3, seen: [...SEEN], difficulty: 'hardcore' } as BojProgress;
    const sim = new BojSim({ progress: p, rng: mulberry32(5), plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 300.5, STRONG);
    sim.finish();
    expect(p.best).toBe(3);
    expect(p.records[recordKey('best', 'hardcore')]).toBe(sim.score);
    expect(bestAt(p, 'hardcore')).toBe(sim.score);
    expect(bestAt(p, 'regular')).toBe(3);
    expect(bestAt(p, 'start')).toBeNull();
    expect(bestOf(p)).toBe(sim.score);
    const r = sim.result();
    expect(r.record).toBe(true);
    expect(r.stats).toContainEqual([t('stat.level'), difficultyName('hardcore')]);
    expect(r.stats[0][0]).toBe(t('stat.record'));
    // a weaker hardcore session later does not lower it; the shared numbers are shared
    const sim2 = new BojSim({ progress: p, rng: mulberry32(6), plannedSec: 40, eeg: false, tuning: TUNING });
    sim2.start();
    drive(sim2, 40.5, NONE);
    sim2.finish();
    expect(bestAt(p, 'hardcore')).toBe(sim.score);
    expect(p.fights).toBe(sim.fights.length + sim2.fights.length);
    // a broken records object is repaired
    expect(migrate({ ...freshProgress(), records: { 'best@hardcore': -2, 'best@start': 7, x: 9 } } as unknown as BojProgress).records).toEqual({ 'best@start': 7 });
  });

  it('plays 45 and 60 minutes at STARTING and HARDCORE to the end, with a short summary', () => {
    for (const d of ['start', 'hardcore'] as const) for (const T of [2700, 3600]) {
      for (const pl of [STRONG, NONE]) {
        const { sim } = playAt(d, pl, T, 7, 'mma');
        expect(sim.stage, `${d} ${T}`).toBe('end');
        expect(sim.canStop()).toBe(true);
        const r = sim.result();
        expect(r.highlights.length).toBeLessThanOrEqual(9);
        expect(r.stats.length).toBeLessThanOrEqual(8);
        for (const h of [...r.highlights, ...r.stats.flat()]) expect(h).not.toMatch(/undefined|NaN|Infinity|\{/);
      }
    }
  }, 300_000);

  it('the lobby row: the four levels at the top of the card, each with its line in the ring’s words', () => {
    const p = freshProgress();
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    document.body.append(el);
    const chips = [...el.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(el.firstElementChild?.querySelector('[data-difficulty]')).not.toBeNull();
    expect(el.textContent).toContain(levelLine('regular'));
    chips[3].click();
    expect(p.difficulty).toBe('hardcore');
    expect(saves).toBe(1);
    expect(el.textContent).toContain(levelLine('hardcore'));
    expect(levelLine('hardcore')).toMatch(/4,5/);
    for (const d of DIFFICULTIES) expect(levelLine(d)).not.toMatch(/\{|undefined|NaN|Infinity/);
    el.remove();
  });
});
