import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import type { GameEnv } from '../src/arcade/kit/types';
import { AMBER, CRAFT_OKRUCHY, LETTERS, MOMENTS, TIPS, VILLAGE, ZOSKA } from '../src/arcade/latarnik/content';
import { CATALOGS, bare, cap, farShips, t, unit } from '../src/arcade/latarnik/i18n';
import latarnik, { hintText, howto } from '../src/arcade/latarnik/index';
import { Hud, fitSlot, font } from '../src/arcade/latarnik/hud';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, auditTargets, target } from '../src/arcade/kit/mobile';
import { SEA_PAD, layout, openCardRect } from '../src/arcade/latarnik/layout';
import {
  OLD_CRATES_CREDIT, addCrumbs, addToWorkshop, costOf, daysBetween, drawAmber, freshProgress, migrate, newChance, nextMissing, village, workshopTarget, type LatarnikProgress,
} from '../src/arcade/latarnik/meta';
import { nightSpec, starsFor, totalStars } from '../src/arcade/latarnik/nights';
import { progressPanel } from '../src/arcade/latarnik/panel';
import { Queue } from '../src/arcade/latarnik/queue';
import { LatarnikView } from '../src/arcade/latarnik/render';
import {
  BANDS, DEG, LatarnikSim, RULES, angDiff, beginnerBonus, cargoAt, drifted, holdTarget, pickBand, planBlocks, reachFor, reachMeter, type Boat, type SimEvent,
} from '../src/arcade/latarnik/sim';
import { mergeSaved } from '../src/arcade/kit/progress';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';

const DAY = '2026-10-23';
const STEP = 1 / 60;

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.7, ...p });

type SimOpts = { progress?: Partial<LatarnikProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning; story?: boolean };

/** The session's tuning as the runner builds it: the kit's defaults, Latarnik's entry, and a beginner's on top. */
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

function makeSim(o: SimOpts = {}): LatarnikSim {
  const sim = new LatarnikSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  if (!o.story) sim.story = null;   // the first session's opening card: closed, as the first tap does
  return sim;
}

/** A returning player's session with an empty sea and no spawns: the rules one at a time. */
function quiet(o: SimOpts = {}): LatarnikSim {
  const sim = makeSim({ ...o, progress: { sessions: 5, lastNewSession: 5, ...o.progress } });
  sim.spawnT = Infinity;
  sim.boats.length = 0;
  sim.spec = { ...nightSpec(0), goal: 1000 };   // a night that does not end under the rules being tested
  sim.take();
  return sim;
}

/** Point the beam so a flash right now is judged at `deg` (the 30 ms latency included). */
const aim = (sim: LatarnikSim, deg: number) => { sim.beam = deg * DEG + sim.omega * RULES.latency; };

const boatAt = (sim: LatarnikSim, deg: number, r: number): Boat => {
  const b = sim.spawn({ a: deg * DEG, band: 'near' });
  b.r = r;
  return b;
};

/** Run the sim for `sec` at 60 fps; `f` may depend on the play time. */
function drive(sim: LatarnikSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), t0 = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    t0.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(t0.t) : f, t0.t);
    each?.(t0.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/**
 * A human-like tapper: as the beam nears a boat within reach it plans one tap for the crossing, off
 * by a Gaussian timing error (σ, s), and skips a pass now and then (attend < 1).  When the lesson's
 * beam waits on its boat, it taps after a reaction time.
 */
function tapper(sim: LatarnikSim, seed: number, sigma: number, attend: number): (t: number) => void {
  const rnd = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const planned = new Set<number>();
  const taps: number[] = [];
  let lesson = false;
  return t => {
    if (sim.lesson === 'hold' && !lesson) {
      lesson = true;
      taps.push(t + 0.5 + Math.abs(gauss()) * 0.3);
    }
    const at = sim.beam - sim.omega * RULES.latency;
    for (const b of sim.boats) {
      if (b.state !== 'sea' || b.r > sim.reach) continue;
      const ahead = angDiff(b.a, at);
      if (ahead > 0 && ahead < 40 * DEG && sim.omega > 0 && !planned.has(b.id)) {
        planned.add(b.id);
        if (rnd() < attend) taps.push(t + ahead / sim.omega + gauss() * sigma);
      } else if (ahead < -40 * DEG) planned.delete(b.id);   // the next pass is a new chance
    }
    for (let i = taps.length - 1; i >= 0; i--) {
      if (taps[i] > t) continue;
      taps.splice(i, 1);
      sim.flash();
    }
  };
}

/** A canvas whose context only measures text: the view's timing runs without drawing. */
function stubCanvas(): HTMLCanvasElement {
  const ctx = { font: '', measureText: (s: string) => ({ width: s.length * 7 }) };
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

/**
 * A busy 180 s session of a returning player: a scripted brain (a 5 s lag, then focus in a Konwój and
 * calm in a Cisza, a dropout in the second Konwój) and a steady tapper.  It brings a blind Konwój, a
 * letter, a tall ship, a village step, new amber and a welcome bonus.
 */
function busySession(): LatarnikSim {
  const progress: LatarnikProgress = {
    ...freshProgress(), sessions: 3, konwoje: 3, crates: 520, amber: [0, 1, 4], letters: 2, lastNewSession: 3,
    lastDay: '2026-10-20', reachDay: '2026-10-22', reachBest: 0.8, dailyDay: DAY,
  };
  const sim = new LatarnikSim({ progress, rng: mulberry32(7), day: DAY, daySeed: 99, plannedSec: 180, eeg: false, tuning: TUNING });
  sim.start();
  const rnd = mulberry32(3);
  let t = 0, level = 0.3, hold = 0, inBlock = 0, last = -1, konwoj = 0;
  while (t < 200 && sim.phase !== 'done') {
    t += STEP;
    if (sim.blockIndex !== last) {
      last = sim.blockIndex;
      inBlock = 0;
      if (sim.block.kind === 'konwoj') konwoj++;
    }
    inBlock += STEP;
    const k = sim.block.kind === 'konwoj';
    level += ((inBlock > 5 ? (k ? 0.85 : 0.18) : level) - level) * (1 - Math.exp(-STEP / 2));
    hold = k && inBlock > 6 ? hold + STEP : 0;
    const fog = k && konwoj === 2 && inBlock > 11 && inBlock < 17;
    const activity = k ? (inBlock > 5 ? 6 : 1) : (inBlock > 5 ? -1 : 1.5);
    sim.update(STEP, { reliable: !fog, activity: fog ? null : activity, threshold: 2, level, focused: k && inBlock > 6, hold, calm: 1 - level }, t);
    if (sim.phase === 'play' && sim.recharge <= 0) {
      const at = sim.beam - sim.omega * RULES.latency;
      if (sim.boats.some(b => b.state === 'sea' && b.r <= sim.reach && Math.abs(angDiff(b.a, at)) < 2.5 * DEG) && rnd() < 0.35) sim.flash();
    }
    sim.take();
  }
  return sim;
}

describe('the beam and the flash', () => {
  it('wraps angles at 360°', () => {
    expect(angDiff(2 * DEG, 358 * DEG) / DEG).toBeCloseTo(4, 6);
    expect(angDiff(358 * DEG, 2 * DEG) / DEG).toBeCloseTo(-4, 6);
    expect(angDiff(Math.PI, -Math.PI)).toBeCloseTo(0, 9);
    expect(Math.abs(angDiff(190 * DEG, 10 * DEG))).toBeCloseTo(Math.PI, 6);
  });

  it('turns clockwise at 104°/s, 90°/s in the very first night', () => {
    const sim = quiet();
    expect(sim.omega).toBeCloseTo(104 * DEG, 9);
    sim.beam = 0;
    drive(sim, 1, frame());
    expect(sim.beam / DEG).toBeCloseTo(104, 3);
    expect(makeSim().omega).toBeCloseTo(90 * DEG, 9);
  });

  it('lights a boat inside ±10° across 0°, "Idealnie" within ±4°, judged 30 ms back', () => {
    const sim = quiet();
    const b = boatAt(sim, 2, 0.3);
    aim(sim, 359);
    sim.flash();
    let e = ofType(sim.take(), 'flash');
    expect(e).toHaveLength(1);
    expect(e[0].perfect).toBe(true);           // 3° off the axis, across the wrap
    expect(b.state).toBe('home');
    const c = boatAt(sim, 352.5, 0.3);
    aim(sim, 1);
    sim.flash();
    e = ofType(sim.take(), 'flash');
    expect(e[0].perfect).toBe(false);          // 8.5° off: lit, but not perfect
    expect(c.state).toBe('home');
    // the beam is judged where it was 30 ms ago: aiming at the boat without the latency misses the core
    const d = boatAt(sim, 100, 0.3);
    sim.beam = 100 * DEG + 4.5 * DEG + sim.omega * RULES.latency;
    sim.flash();
    expect(ofType(sim.take(), 'flash')[0].perfect).toBe(false);
    expect(d.state).toBe('home');
  });

  it('costs nothing when the light falls short of a boat, and says how close it was; only empty water costs', () => {
    const sim = quiet();
    for (let i = 0; i < 3; i++) {   // a streak of three perfects to keep
      boatAt(sim, 40 * i, 0.3);
      aim(sim, 40 * i);
      sim.flash();
    }
    sim.take();
    const out = boatAt(sim, 250, 0.3);
    const far = boatAt(sim, 240, sim.reach + 0.05);
    aim(sim, 239.5);
    sim.flash();
    let evs = sim.take();
    expect(ofType(evs, 'empty')).toHaveLength(0);
    expect(ofType(evs, 'short')).toHaveLength(1);
    expect(ofType(evs, 'short')[0]).toMatchObject({ boat: far, hint: true });
    expect(ofType(evs, 'short')[0].short).toBeCloseTo(0.05, 6);
    expect(sim.streak).toBe(3);               // the touch was right: the streak stays
    expect(sim.recharge).toBe(0);             // and the lamp is ready at once
    expect([out.state, far.state]).toEqual(['sea', 'sea']);
    // far beyond the reach: no "zabrakło", and still no cost
    far.r = sim.reach + 0.2;
    sim.flash();
    evs = sim.take();
    expect(ofType(evs, 'short')[0].hint).toBe(false);
    expect([sim.streak, sim.recharge]).toEqual([3, 0]);
    // truly empty water breaks the streak and recharges the lamp
    aim(sim, 150);
    sim.flash();
    expect(ofType(sim.take(), 'empty')).toHaveLength(1);
    expect(sim.streak).toBe(0);
    expect(sim.recharge).toBeCloseTo(RULES.recharge, 9);
  });

  it('counts a "Szereg" when one flash lights several boats, with cargo by distance', () => {
    const sim = quiet({ progress: { sessions: 5 } });
    sim.reach = 1;
    boatAt(sim, 200, 0.3);
    boatAt(sim, 203, 0.55);
    boatAt(sim, 196, 0.85);
    aim(sim, 200);
    sim.flash();
    const [e] = ofType(sim.take(), 'flash');
    expect(e.boats).toHaveLength(3);
    expect(e.cargo).toBe(1 + 2 + 3);
    expect(sim.score).toBe(3);
    expect(sim.crates).toBe(6);
    expect([cargoAt(0.39), cargoAt(0.4), cargoAt(0.7), cargoAt(0.71)]).toEqual([1, 2, 2, 3]);
  });

  it('arms "Pełne światło" after 8 perfects in a row: the next flash lights everything in reach, 360°', () => {
    const sim = quiet();
    for (let i = 0; i < 8; i++) {
      boatAt(sim, 30 * i, 0.3);
      aim(sim, 30 * i + 1);
      sim.flash();
    }
    const evs = sim.take();
    expect(sim.streak).toBe(8);
    expect(ofType(evs, 'armed')).toHaveLength(1);
    expect(sim.armed).toBe(true);
    const behind = boatAt(sim, 180, 0.3), side = boatAt(sim, 90, 0.35), beyond = boatAt(sim, 270, sim.reach + 0.2);
    aim(sim, 0);
    sim.flash();
    const [e] = ofType(sim.take(), 'flash');
    expect(e.full).toBe(true);
    expect(e.boats).toHaveLength(2);
    expect(behind.state).toBe('home');
    expect(side.state).toBe('home');
    expect(beyond.state).toBe('sea');       // still only within the reach
    expect(sim.armed).toBe(false);
    expect(sim.maxStreak).toBe(8);
  });

  it('an empty flash breaks the streak and recharges the lamp for 0.6 s, nothing else', () => {
    const sim = quiet();
    for (let i = 0; i < 3; i++) {
      boatAt(sim, 40 * i, 0.3);
      aim(sim, 40 * i);
      sim.flash();
    }
    expect(sim.streak).toBe(3);
    const score = sim.score, lanterns = sim.lanterns;
    aim(sim, 300);
    sim.flash();
    expect(sim.streak).toBe(0);
    expect(sim.recharge).toBeCloseTo(0.6, 9);
    expect(sim.score).toBe(score);
    expect(sim.lanterns).toBe(lanterns);
    const b = boatAt(sim, 120, 0.3);
    drive(sim, 0.3, frame());
    aim(sim, 120);
    sim.flash();
    expect(b.state).toBe('sea');            // still recharging: the tap is ignored
    drive(sim, 0.31, frame());
    b.r = 0.3;
    aim(sim, 120);
    sim.flash();
    expect(b.state).toBe('home');
  });
});

describe('the reach', () => {
  it('is 0.42 R + 0.58 R × L: 0.71 R at the threshold, 0.93 R at level 0.88', () => {
    expect(reachFor(0)).toBeCloseTo(0.42, 9);
    expect(reachFor(0.5)).toBeCloseTo(0.71, 9);
    expect(reachFor(0.88)).toBeCloseTo(0.93, 2);
    expect(reachFor(1, 0.12)).toBeCloseTo(1.12, 9);
  });

  it('smooths the level again with τ 3 s (1 s on EEG)', () => {
    const sim = quiet();
    expect(sim.L).toBe(0.3);                         // a resting player's level to start with
    drive(sim, 3, frame({ level: 1 }));
    expect(sim.L).toBeCloseTo(1 - 0.7 * Math.exp(-1), 2);
    const eeg = quiet({ eeg: true });
    drive(eeg, 1, frame({ level: 1 }));
    expect(eeg.L).toBeCloseTo(1 - 0.7 * Math.exp(-1), 2);
    drive(sim, 20, frame({ level: 1 }));
    expect(sim.reach).toBeCloseTo(reachFor(sim.L), 2);
  });

  it('adds +0.04 R per 6 s of hold up to +0.12 R, easing off over 3 s when the hold breaks', () => {
    expect([holdTarget(5.9), holdTarget(6), holdTarget(12), holdTarget(18), holdTarget(40)]).toEqual([0, 0.04, 0.08, 0.12, 0.12]);
    const sim = quiet();
    const clock = { t: 0 };
    const steps = drive(sim, 6.5, t => frame({ level: 0.5, focused: true, hold: t }), clock);
    expect(sim.holdBonus).toBeCloseTo(0.04, 9);
    steps.push(...drive(sim, 12, t => frame({ level: 0.5, focused: true, hold: t }), clock));
    expect(sim.holdBonus).toBeCloseTo(0.12, 9);
    expect(ofType(steps, 'steady').map(e => Math.round(e.bonus * 100))).toEqual([4, 8, 12]);   // each step is shown
    drive(sim, 1.5, frame({ level: 0.5, hold: 0 }), clock);
    expect(sim.holdBonus).toBeCloseTo(0.06, 2);
    drive(sim, 1.6, frame({ level: 0.5, hold: 0 }), clock);
    expect(sim.holdBonus).toBe(0);
  });

  it('leans toward beginners in sessions 1–3, and helps after two failed Konwój blocks', () => {
    expect([1, 2, 3, 4].map(beginnerBonus).map(v => +v.toFixed(3))).toEqual([0.06, 0.04, 0.02, 0]);
    const sim = quiet({ planned: 600 });
    const clock = { t: 0 };
    const low = frame({ activity: 0, level: 0.2 });
    const kind = () => sim.block.kind;
    for (let k = 0; k < 2; k++) {
      while (kind() !== 'cisza') drive(sim, 0.5, low, clock);
      while (kind() !== 'konwoj') drive(sim, 0.5, low, clock);
    }
    drive(sim, 8, low, clock);
    expect(sim.reach).toBeCloseTo(reachFor(sim.L, RULES.failBoost), 2);
  });

  it('holds, dimmed, at its last value while the signal is unreliable', () => {
    const sim = quiet();
    drive(sim, 5, frame({ level: 0.9 }));
    const reach = sim.reach, L = sim.L;
    drive(sim, 5, frame({ reliable: false, level: 0 }));
    expect(sim.reach).toBe(reach);
    expect(sim.L).toBe(L);
    expect(sim.fog).toBeGreaterThan(0.95);
  });

  it('answers focus only in a Konwój: a Cisza holds the reach, the lamp and the bonus, and shows no steadiness', () => {
    const sim = quiet({ planned: 300 });
    const clock = { t: 0 };
    const focused = (t: number) => frame({ level: 0.9, focused: true, hold: t, activity: 8, calm: 0.1 });
    const konwoj: SimEvent[] = [];
    while (sim.block.kind === 'konwoj') konwoj.push(...drive(sim, STEP, focused, clock));
    expect(ofType(konwoj, 'steady').length).toBeGreaterThan(0);
    const reach = sim.reach, lens = sim.lens, bonus = sim.holdBonus;
    expect(bonus).toBeGreaterThan(0);
    // a player who stays focused through the rest: nothing on screen answers it, nothing rewards it
    let lo = Infinity, hi = -Infinity;
    const cisza: SimEvent[] = [];
    while (sim.block.kind === 'cisza') {
      cisza.push(...drive(sim, STEP, focused, clock, () => {
        lo = Math.min(lo, sim.reach);
        hi = Math.max(hi, sim.reach);
      }));
    }
    expect(ofType(cisza, 'steady')).toHaveLength(0);
    expect([lo, hi]).toEqual([reach, reach]);
    expect(sim.lens).toBe(lens);
    expect(sim.holdBonus).toBe(bonus);
    // and no "zabrakło" in rest: a ship beyond the frozen reach just waits, at no cost
    const sim2 = quiet({ planned: 300 });
    while (sim2.block.kind !== 'cisza') drive(sim2, 0.25, frame(), clock);
    boatAt(sim2, 60, sim2.reach + 0.03);
    aim(sim2, 60);
    sim2.flash();
    expect(ofType(sim2.take(), 'short').map(e => e.hint)).toEqual([false]);
  });

  it('lets L follow the band silently through a Cisza, so the next Konwój starts from where the player is', () => {
    const sim = quiet({ planned: 300 });
    const clock = { t: 0 };
    while (sim.block.kind === 'konwoj') drive(sim, STEP, frame({ level: 0.9, activity: 8 }), clock);
    const frozen = sim.reach;
    while (sim.block.kind === 'cisza') drive(sim, STEP, frame({ level: 0.1, calm: 0.9, activity: -1 }), clock);
    expect(sim.reach).toBe(frozen);
    expect(sim.L).toBeLessThan(0.15);
    // the band's delay first (5 s on fNIRS): the reach holds, then follows
    drive(sim, 3, frame({ level: 0.1, activity: -1 }), clock);
    expect(sim.block.kind).toBe('konwoj');
    expect(sim.reach).toBe(frozen);
    drive(sim, 4, frame({ level: 0.1, activity: -1 }), clock);
    expect(sim.reach).toBeLessThan(frozen - 0.3);
    expect(sim.reach).toBeCloseTo(reachFor(sim.L, sim.holdBonus), 1);
  });

  it('keeps the lamp steady and the steadiness steps silent in a blind Konwój, while the reach still works', () => {
    const sim = quiet({ progress: { sessions: 4, konwoje: 3 }, planned: 300 });
    expect(sim.blind).toBe(true);
    const lens = sim.lens;
    const evs = drive(sim, 14, t => frame({ level: 0.9, focused: true, hold: t, activity: 8 }));
    expect(ofType(evs, 'steady')).toHaveLength(0);
    expect(sim.holdBonus).toBeCloseTo(0.08, 9);
    expect(sim.lens).toBe(lens);
    expect(sim.reach).toBeGreaterThan(0.95);
  });

  it('keeps the warm-up a no-feedback pre-run: the beam, the lamp and the pad do not follow the level', () => {
    const warmUp = (level: number) => {
      const sim = makeSim({ planned: 180 });
      const lens: number[] = [], pad: (number | null)[] = [];
      drive(sim, 25, frame({ level, activity: level > 0.5 ? 8 : -2, calm: 1 - level, focused: level > 0.5 }), { t: 0 }, () => {
        lens.push(sim.lens);
        pad.push(sim.padLevel(frame({ level })));
      });
      expect(sim.block.kind).toBe('warmup');
      return { lens, pad, reach: sim.reach };
    };
    const hi = warmUp(0.95), lo = warmUp(0.05);
    expect(hi.lens).toEqual(lo.lens);
    expect(new Set(hi.lens)).toEqual(new Set([RULES.warmLens]));
    expect(hi.pad).toEqual(lo.pad);
    expect(hi.reach).toBe(RULES.warmReach);
  });

  /** A long Konwój fed through the kit's own FocusInput: activity 8 % until 20 s, a dropout until 30 s, then `after`. */
  function dropout(after: number) {
    const sim = quiet({ planned: 600 });
    sim.plan[0].dur = 60;
    const focus = new FocusInput({ ...DEFAULT_TUNING, adapt: 0.08 });
    let f = focus.push(0, true, 0.1), hub = 0;
    const fog = (t: number) => t >= 20 && t < 30;
    const before = { reach: 0, bonus: 0, L: 0 };
    const trace: { t: number; reach: number; bonus: number; L: number }[] = [];
    for (let t = STEP; t < 46; t += STEP) {
      if ((hub += STEP) >= 0.1) {
        hub -= 0.1;
        f = focus.push(fog(t) ? null : t < 20 ? 8 : after, !fog(t), 0.1);
      }
      sim.update(STEP, f, t);
      sim.take();
      if (t < 20) Object.assign(before, { reach: sim.reach, bonus: sim.holdBonus, L: sim.L });
      else trace.push({ t, reach: sim.reach, bonus: sim.holdBonus, L: sim.L });
    }
    expect(sim.block.kind).toBe('konwoj');
    return { before, trace };
  }

  it('loses nothing to a dropout: after the fog the reach and the steadiness bonus carry on', () => {
    const { before, trace } = dropout(8);
    expect(before.bonus).toBeCloseTo(0.12, 9);              // 18 s of steady focus before the fog
    expect(Math.min(...trace.map(s => s.reach))).toBeGreaterThan(before.reach - 0.02);
    expect(Math.min(...trace.map(s => s.bonus))).toBeCloseTo(before.bonus, 9);
  });

  it('shows a real drop after a dropout once the band has had time to climb back', () => {
    const { before, trace } = dropout(0);                    // after the fog the player is at rest
    const at = (t: number) => trace.find(s => s.t >= t)!;
    expect(at(30 + RULES.recover - 0.1).reach).toBeGreaterThan(before.reach - 0.02);   // the grace: nothing falls yet
    expect(at(45).reach).toBeLessThan(before.reach - 0.1);
    expect(at(45).bonus).toBe(0);
  });
});

describe('the sea', () => {
  it('spawns 60 % of a Konwój at the horizon, a Cisza only at mid and near range, nothing far in fog', () => {
    const share = (kind: 'konwoj' | 'cisza', reliable = true) => {
      let far = 0;
      for (let i = 0; i < 1000; i++) if (pickBand(kind, (i + 0.5) / 1000, reliable) === 'horizon') far++;
      return far / 1000;
    };
    expect(share('konwoj')).toBeCloseTo(0.6, 2);
    expect(share('cisza')).toBe(0);
    expect(share('konwoj', false)).toBe(0);
    expect(pickBand('warmup', 0.1, true)).toBe('warm');
    // and in a whole simulated session
    const sim = makeSim({ progress: { sessions: 5 }, planned: 600, seed: 9 });
    const seen = new Set<number>();
    const tally = { konwoj: [0, 0], cisza: [0, 0] };
    drive(sim, 590, frame(), { t: 0 }, () => {
      for (const b of sim.boats) {
        if (seen.has(b.id) || b.kind === 'butelka') continue;
        seen.add(b.id);
        const k = sim.block.kind as 'konwoj' | 'cisza';
        tally[k][0]++;
        if (b.r >= BANDS.horizon[0] - 0.01) tally[k][1]++;
      }
    });
    expect(tally.konwoj[0]).toBeGreaterThan(40);
    expect(tally.konwoj[1] / tally.konwoj[0]).toBeGreaterThan(0.4);
    expect(tally.konwoj[1] / tally.konwoj[0]).toBeLessThan(0.75);
    expect(tally.cisza[0]).toBeGreaterThan(40);
    expect(tally.cisza[1]).toBe(0);
  });

  it('keeps at most 4 boats on the sea, so never more than 4 within reach', () => {
    const sim = makeSim({ progress: { sessions: 5 }, seed: 3 });
    let most = 0;
    drive(sim, 200, frame({ level: 1 }), { t: 0 }, () => {
      const inReach = sim.boats.filter(b => b.state === 'sea' && b.kind !== 'butelka' && b.r <= sim.reach).length;
      most = Math.max(most, inReach);
    });
    expect(most).toBeLessThanOrEqual(RULES.maxBoats);
    expect(most).toBeGreaterThanOrEqual(3);
  });

  it('takes a lantern only for an unlit boat at the reef — never for the brain', () => {
    const sim = quiet();
    const clock = { t: 0 };
    drive(sim, 60, t => frame({ level: (Math.sin(t) + 1) / 2, activity: 10 * Math.sin(t / 3), calm: 0.2 }), clock);
    expect(sim.lanterns).toBe(3);
    const b = boatAt(sim, 90, 0.2);
    drive(sim, 0.4, frame({ reliable: false }), clock);
    expect(b.state).toBe('sea');           // fog: the boat waits, nothing can be lost
    expect(sim.lanterns).toBe(3);
    const evs = drive(sim, 1, frame(), clock);
    expect(ofType(evs, 'reef')).toHaveLength(1);
    expect(b.state).toBe('leaving');
    expect(sim.lanterns).toBe(2);
  });

  it('starts the night again after the third lantern, keeping its count: the card, then the same night', () => {
    const sim = quiet();
    drive(sim, 4, frame({ level: 0.8 }));
    const L = sim.L;
    boatAt(sim, 10, 0.4);
    sim.reach = 0.6;
    aim(sim, 10);
    sim.flash();
    expect(sim.got).toBe(1);
    for (const deg of [60, 150, 240]) boatAt(sim, deg, 0.185);
    let evs = drive(sim, 0.5, frame({ level: 0.8 }));
    expect(ofType(evs, 'reef')).toHaveLength(3);
    expect(ofType(evs, 'rewind')).toHaveLength(1);
    expect(sim.phase).toBe('between');
    expect(sim.between).toBe('rewind');
    expect(sim.lost).toBe(3);
    const b = boatAt(sim, 0, 0.3);
    aim(sim, 0);
    sim.flash();
    expect(b.state).toBe('sea');            // no flashes during the card
    evs = drive(sim, RULES.nightCard, frame({ level: 0.8 }));
    expect(ofType(evs, 'nightStart')[0]).toMatchObject({ again: true });
    expect(sim.phase).toBe('play');
    expect(sim.lanterns).toBe(3);
    expect(sim.got).toBe(1);                 // the count stays
    expect(sim.spec.n).toBe(0);
    expect(sim.L).toBeGreaterThan(L);        // the brain state carries on
    // the night's first boat comes soon, just ahead of the beam and within the reach
    drive(sim, RULES.watchFirst + 0.1, frame({ level: 0.8 }));
    const first = sim.boats.filter(x => x.state === 'sea' && x.n < 0 && x !== b && x.kind !== 'butelka');
    expect(first).toHaveLength(1);
    expect(first[0].r).toBeLessThanOrEqual(sim.reach);
  });

  it('pauses boats and the block clock while the signal is unreliable; taps still light paused boats', () => {
    const sim = quiet();
    const b = boatAt(sim, 45, 0.5);
    drive(sim, 2, frame());
    const r = b.r, bt = sim.blockT;
    drive(sim, 5, frame({ reliable: false, activity: null }));
    expect(b.r).toBe(r);
    expect(sim.blockT).toBe(bt);
    sim.spawnT = 0;
    for (let i = 0; i < 40; i++) expect(sim.spawn().r).toBeLessThan(BANDS.horizon[0]);
    sim.reach = 0.6;
    aim(sim, 45);
    sim.flash();
    expect(b.state).toBe('home');
  });

  it('knows where an undisturbed boat drifts: 0.05 R/s, 0.03 R/s inside half the sea', () => {
    expect(drifted(0.9, 8)).toBeCloseTo(0.5, 9);
    expect(drifted(0.9, 10)).toBeCloseTo(0.44, 9);
    expect(drifted(0.4, 5)).toBeCloseTo(0.25, 9);
  });
});

describe('the first watch: a lesson, not a test', () => {
  it('opens with the first line of the warm-up', () => {
    expect(makeSim({ planned: 180 }).tip).toBe(TIPS.warmup[0]);
    expect(makeSim({ planned: 40 }).tip).toBe(TIPS.warmup[0]);
  });

  it('stills the sea while the beam waits on the first boat, then sends the next one soon', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    while (sim.lesson !== 'hold' && clock.t < 5) drive(sim, STEP, frame(), clock);
    expect(sim.boats).toHaveLength(1);
    const boat = sim.boats[0], r = boat.r;
    drive(sim, 4, frame(), clock);
    expect(sim.boats).toHaveLength(1);           // nothing new while the lesson waits
    expect(boat.r).toBe(r);
    sim.flash();
    expect(boat.state).toBe('home');
    drive(sim, RULES.afterLesson + 0.1, frame(), clock);
    expect(sim.boats.filter(b => b.state === 'sea')).toHaveLength(1);
  });

  it('keeps the warm-up to two boats, each with three passes of the beam before the reef', () => {
    expect(RULES.warmReach).toBeGreaterThanOrEqual(BANDS.warm[1]);   // every warm-up boat is within the fixed beam
    for (let seed = 1; seed <= 12; seed++) {
      const sim = makeSim({ planned: 180, seed, daySeed: seed });
      const passes = new Map<number, number>(), prev = new Map<number, number>(), born = new Map<number, number>();
      let most = 0;
      drive(sim, 60, frame(), { t: 0 }, () => {
        if (sim.block.kind === 'warmup') most = Math.max(most, sim.alive());
        for (const b of sim.boats) {
          if (!b.practice || b.state !== 'sea') continue;
          if (!born.has(b.id)) born.set(b.id, b.r0);   // where it appeared
          const d = angDiff(b.a, sim.beam), p = prev.get(b.id);
          if (p !== undefined && p > 0 && d <= 0 && d > -0.5) passes.set(b.id, (passes.get(b.id) ?? 0) + 1);
          prev.set(b.id, d);
        }
      });
      expect(most).toBeLessThanOrEqual(RULES.warmBoats);
      expect(born.size).toBeGreaterThanOrEqual(3);   // nobody lights them, so the cap holds the next ones back
      for (const [id, r] of born) {
        expect(r).toBeGreaterThanOrEqual(BANDS.warm[0]);
        expect(r).toBeLessThanOrEqual(BANDS.warm[1]);
        expect(passes.get(id) ?? 0, `seed ${seed}, boat ${id}`).toBeGreaterThanOrEqual(3);   // nobody taps: all sail to the reef
      }
    }
  });

  it('lets a warm-up boat that reaches the reef turn back at no cost: the first watch cannot end in the lesson', () => {
    const sim = makeSim({ planned: 180 });
    const b = sim.spawn({ band: 'warm' });
    b.r = RULES.reef + 0.005;
    const evs = drive(sim, 1, frame());
    expect(ofType(evs, 'reef').find(e => e.boat === b)).toMatchObject({ free: true, lanterns: RULES.lanterns });
    expect(b.state).toBe('leaving');
    // imperfect hands over many first sessions: an unsteady tapper never loses a lantern or the watch there,
    // and a steady one lights nearly every boat
    for (const [sigma, attend, share] of [[0.11, 0.85, 0.7], [0.07, 0.95, 0.85]]) {
      let lit = 0, born = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const s = makeSim({ planned: 180, seed, daySeed: seed * 13 + 5 });
        const tap = tapper(s, seed + 1000, sigma, attend);
        const ids = new Set<number>();
        const warm = drive(s, 30, frame(), { t: 0 }, t => {
          tap(t);
          for (const x of s.boats) if (x.practice) ids.add(x.id);
        });
        expect(s.plan[0]).toMatchObject({ kind: 'warmup', dur: 30 });
        expect(ofType(warm, 'rewind')).toHaveLength(0);
        expect(ofType(warm, 'reef').every(e => e.free)).toBe(true);
        expect(s.lanterns).toBe(RULES.lanterns);
        lit += ofType(warm, 'flash').reduce((n, e) => n + e.boats.filter(x => x.practice).length, 0);
        born += ids.size;
      }
      expect(lit / born, `σ ${sigma}`).toBeGreaterThan(share);
    }
  });
});

describe('the blocks', () => {
  const total = (plan: { dur: number }[]) => plan.reduce((s, b) => s + b.dur, 0);

  it.each([40, 180, 300, 600])('fills a %i s session, ending with a Cisza, no block under 12 s', planned => {
    for (const first of [false, true]) {
      const plan = planBlocks(planned, first, mulberry32(planned));
      expect(total(plan) + RULES.finale).toBeCloseTo(planned, 6);
      expect(plan[plan.length - 1].kind).toBe('cisza');
      expect(plan.every(b => b.dur >= 12 - 1e-9)).toBe(true);
      const play = first ? plan.slice(1) : plan;
      expect(play.every((b, i) => b.kind === (i % 2 ? 'cisza' : 'konwoj'))).toBe(true);
      if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: planned <= 60 ? 12 : 30 });
      if (planned >= 180) {
        const k = play.filter(b => b.kind === 'konwoj').map(b => b.dur), c = play.filter(b => b.kind === 'cisza').map(b => b.dur);
        expect(Math.min(...k)).toBeGreaterThan(19);
        expect(Math.max(...k)).toBeLessThan(33);
        expect(Math.min(...c)).toBeGreaterThan(16);
        expect(Math.max(...c)).toBeLessThan(27);
      }
    }
    expect(planBlocks(300, false, mulberry32(1)).length).toBe(12);
    expect(planBlocks(600, false, mulberry32(1)).length).toBe(24);
  });

  it('telegraphs the next block 4 s ahead and plays the finisher at the end', () => {
    const sim = makeSim({ progress: { sessions: 5 }, planned: 40 });
    const evs = drive(sim, 42, frame());
    const tele = ofType(evs, 'telegraph');
    expect(tele.map(e => e.next)).toEqual(['cisza']);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('may not stop mid-finisher or while a boat sails in', () => {
    const sim = makeSim({ progress: { sessions: 5 }, planned: 40 });
    const clock = { t: 0 };
    drive(sim, 37, frame(), clock);
    expect(sim.phase).toBe('finale');
    expect(sim.canStop()).toBe(false);
    drive(sim, 3.2, frame(), clock);
    expect(sim.canStop()).toBe(true);
  });

  it('gives fog\'s lost time back from the Konwój blocks, so the closing Cisza stays whole', () => {
    const sim = quiet({ planned: 180 });
    const planned = sim.plan.map(b => b.dur);
    const konwoj = (durs: number[]) => durs.filter((_, i) => sim.plan[i].kind === 'konwoj').reduce((s, d) => s + d, 0);
    const clock = { t: 0 };
    drive(sim, 8, frame(), clock);
    drive(sim, 20, frame({ reliable: false, activity: null }), clock);   // 20 s of fog in the first Konwój
    let lastT = 0;
    while (sim.phase === 'play' && clock.t < 200) drive(sim, STEP, frame(), clock, () => { lastT = sim.blockT; });
    const last = sim.plan.length - 1;
    expect(sim.blockIndex).toBe(last);                                   // the session ended in its last block…
    expect(sim.plan[last].kind).toBe('cisza');                           // …a Cisza…
    expect(sim.plan[last].dur).toBeCloseTo(planned[last], 6);            // …that kept its length…
    expect(lastT).toBeGreaterThanOrEqual(planned[last] - 0.05);          // …and ran to its end
    expect(clock.t).toBeCloseTo(180 - RULES.finale, 0);                  // with the finisher on time
    expect(konwoj(planned) - konwoj(sim.plan.map(b => b.dur))).toBeCloseTo(20, 0);   // the Konwój blocks gave the 20 s
    expect(sim.plan.every(b => b.dur >= RULES.minBlock - 1e-9)).toBe(true);
  });

  it('judges a Konwój with the RoundJudge: focus earns a star, a lantern back and 5 crates', () => {
    const sim = quiet();
    const clock = { t: 0 };
    boatAt(sim, 90, 0.19);
    drive(sim, 1, frame({ activity: 8, level: 0.95, focused: true }), clock);
    expect(sim.lanterns).toBe(2);
    const crates = sim.crates;
    const evs: SimEvent[] = [];
    while (sim.blockIndex === 0) evs.push(...drive(sim, 0.25, frame({ activity: 8, level: 0.95, focused: true }), clock));
    expect(ofType(evs, 'star')).toHaveLength(1);
    expect(sim.lanterns).toBe(3);
    expect(sim.crates).toBe(crates + RULES.starCrates);
    expect(sim.starsWon).toBe(1);
    // a Konwój spent below the threshold earns nothing (and loses nothing)
    while (sim.block.kind !== 'konwoj') drive(sim, 0.25, frame(), clock);
    const lost: SimEvent[] = [];
    while (sim.block.kind === 'konwoj') lost.push(...drive(sim, 0.25, frame({ activity: 0 }), clock));
    expect(ofType(lost, 'star')).toHaveLength(0);
    expect(ofType(lost, 'blockEnd')[0].verdict).toBe(false);
    expect(sim.lanterns).toBe(3);
  });

  it('judges with the session\'s own tuning, so a beginner\'s judge leans further toward the player', () => {
    // 14 of every 30 tenths of a second above the threshold (47 % of the window): short of the 50 % a Konwój
    // asks for, past the 45 % it asks of a beginner
    const verdict = (tuning: FocusTuning) => {
      const sim = quiet({ tuning });
      const evs: SimEvent[] = [];
      let i = 0;
      while (sim.blockIndex === 0) evs.push(...drive(sim, 0.1, frame({ activity: i++ % 30 < 14 ? 5 : -1 })));
      return ofType(evs, 'blockEnd')[0].verdict;
    };
    expect(verdict(TUNING)).toBe(false);
    expect(verdict(BEGINNER)).toBe(true);
  });

  it('has no verdict for a block without reliable data', () => {
    const sim = quiet({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, 2, frame(), clock);
    const evs: SimEvent[] = [];
    // only the first 2 s were reliable; the block clock waits through the fog, then 1 s per 10 counts
    for (let i = 0; i < 400 && sim.blockIndex === 0; i++) evs.push(...drive(sim, 0.5, frame({ reliable: i % 10 === 0, activity: 8 }), clock));
    const end = ofType(evs, 'blockEnd');
    if (end.length) expect(end[0].verdict === null || end[0].verdict === true).toBe(true);
    expect(sim.lanterns).toBe(3);
  });
});

describe('Cisza: the glowing sea and its amber', () => {
  /** A returning player at the start of the first Cisza. */
  function toCisza(o: SimOpts = {}, konwoj = frame({ activity: 2.5, level: 0.6 })) {
    const sim = quiet({ planned: 300, ...o });
    const clock = { t: 0 };
    while (sim.block.kind !== 'cisza') drive(sim, 0.25, konwoj, clock);
    sim.take();
    return { sim, clock };
  }

  it('grows the glow +0.04 R/s while calm ≥ 0.5, shrinks it −0.02 R/s otherwise, up to 0.6 R', () => {
    const { sim, clock } = toCisza();
    expect(sim.glow).toBeLessThan(0.05);
    const g0 = sim.glow;
    drive(sim, 5, frame({ calm: 0.8 }), clock);
    expect(sim.glow - g0).toBeCloseTo(0.2, 2);
    const g1 = sim.glow;
    drive(sim, 5, frame({ calm: 0.3 }), clock);
    expect(g1 - sim.glow).toBeCloseTo(0.1, 2);
    drive(sim, 4, frame({ reliable: false, calm: 0 }), clock);
    expect(g1 - sim.glow).toBeCloseTo(0.1, 2);     // frozen while unreliable
    drive(sim, 12, frame({ calm: 0.9 }), clock);
    expect(sim.glow).toBeLessThanOrEqual(RULES.glowMax + 1e-9);
  });

  it('reveals amber under the glow, which washes up by itself at the block end as crumbs', () => {
    const { sim, clock } = toCisza();
    expect(sim.nuggets).toHaveLength(RULES.nuggets);
    const okruchy = sim.p.okruchy;
    const evs: SimEvent[] = [];
    while (sim.block.kind === 'cisza') evs.push(...drive(sim, 0.25, frame({ calm: 0.8, activity: 2.5 }), clock));
    const revealed = ofType(evs, 'reveal').length;
    expect(revealed).toBeGreaterThanOrEqual(3);
    const wash = ofType(evs, 'washUp');
    expect(wash[0].nuggets).toHaveLength(revealed);
    expect(sim.nuggetsFound).toBe(revealed);
    expect(sim.p.okruchy).toBe(okruchy + revealed);
  });

  it('draws a common piece for a successful Cisza, rare after 12 s of deep calm', () => {
    const tierOf = (calm: number) => {
      const { sim, clock } = toCisza();
      const evs: SimEvent[] = [];
      while (sim.block.kind === 'cisza') evs.push(...drive(sim, 0.25, frame({ activity: 0, calm }), clock));
      return ofType(evs, 'amber').filter(e => e.via === 'draw').map(e => e.tier);
    };
    expect(tierOf(0.55)).toEqual(['common']);
    expect(tierOf(0.8)).toEqual(['rare']);
  });

  it('draws an epic piece after a blind Konwój, a legendary one for a session contrast ≥ +5 %', () => {
    const blind = toCisza({ progress: { sessions: 4, konwoje: 3 } });
    expect(blind.sim.plan[0].blind).toBe(true);
    const evs: SimEvent[] = [];
    while (blind.sim.block.kind === 'cisza') evs.push(...drive(blind.sim, 0.25, frame({ activity: 0, calm: 0.55 }), blind.clock));
    expect(ofType(evs, 'amber').find(e => e.via === 'draw')?.tier).toBe('epic');
    const legend = toCisza({}, frame({ activity: 9, level: 0.95 }));
    const ev2: SimEvent[] = [];
    while (legend.sim.block.kind === 'cisza') ev2.push(...drive(legend.sim, 0.25, frame({ activity: 0, calm: 0.55 }), legend.clock));
    expect(legend.sim.contrast.contrast!).toBeGreaterThanOrEqual(5);
    expect(ofType(ev2, 'amber').find(e => e.via === 'draw')?.tier).toBe('legend');
  });

  it('a failed Cisza draws nothing but keeps the amber it revealed', () => {
    const { sim, clock } = toCisza();
    const evs: SimEvent[] = [];
    while (sim.block.kind === 'cisza') evs.push(...drive(sim, 0.25, frame({ activity: 8, calm: 0.6 }), clock));
    expect(ofType(evs, 'blockEnd')[0].verdict).toBe(false);
    expect(ofType(evs, 'amber').filter(e => e.via === 'draw')).toHaveLength(0);
    expect(ofType(evs, 'washUp')).toHaveLength(1);
  });

  it('lets the pad follow only what the screen shows: the lamp in a Konwój, the glow in a Cisza, nothing blind or in fog', () => {
    const { sim, clock } = toCisza({}, frame({ level: 0.9, activity: 8 }));
    drive(sim, 6, frame({ level: 0.1, calm: 0.9, activity: -2 }), clock);
    expect(sim.glow).toBeGreaterThan(0.1);
    expect(sim.padLevel(frame({ level: 0.95 }))).toBeCloseTo(sim.glow / RULES.glowMax, 9);   // the glow, not the level
    expect(sim.padLevel(frame({ reliable: false }))).toBeNull();
    while (sim.block.kind !== 'konwoj') drive(sim, 0.25, frame({ level: 0.6 }), clock);
    drive(sim, 2, frame({ level: 0.6 }), clock);
    expect(sim.padLevel(frame({ level: 0.1 }))).toBeCloseTo(sim.lens, 9);                    // the lamp, as drawn
    const blind = quiet({ progress: { sessions: 4, konwoje: 3 } });
    expect(blind.blind).toBe(true);
    expect(blind.padLevel(frame({ level: 0.9 }))).toBeNull();
    const done = makeSim({ progress: { sessions: 5 }, planned: 40 });
    drive(done, 41, frame());
    expect(done.padLevel(frame({ level: 0.9 }))).toBeNull();                                 // dawn holds it still
  });
});

describe('the harbour, the album, the letters', () => {
  it('lights the village in 8 steps by the stars of the nights kept', () => {
    expect(VILLAGE).toHaveLength(8);
    expect(village(0)).toMatchObject({ built: 0, have: 0, need: 1 });
    expect(village(1)).toMatchObject({ built: 1, have: 0, need: 2 });
    expect(village(5)).toMatchObject({ built: 2, have: 2, need: 3 });
    expect(village(29).built).toBe(7);
    expect(village(30)).toMatchObject({ built: 8, next: null });
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('draws evenly within a tier, turns duplicates into crumbs and 25 crumbs into the next piece', () => {
    const rnd = mulberry32(5);
    const counts = new Map<number, number>();
    for (let i = 0; i < 4000; i++) {
      const p = freshProgress();
      const d = drawAmber(p, 'common', rnd);
      counts.set(d.piece, (counts.get(d.piece) ?? 0) + 1);
      expect(d.isNew).toBe(true);
      expect(AMBER[d.piece].tier).toBe('common');
    }
    expect(counts.size).toBe(8);
    for (const n of counts.values()) expect(n / 4000).toBeCloseTo(1 / 8, 1);
    const p = freshProgress();
    p.amber = AMBER.filter(a => a.tier === 'legend').map(a => a.index);
    expect(newChance(p, 'legend')).toBe(0);
    expect(newChance(p, 'common')).toBe(1);
    const dup = drawAmber(p, 'legend', rnd);
    expect(dup.isNew).toBe(false);
    expect(p.okruchy).toBe(5);
    expect(addCrumbs(p, CRAFT_OKRUCHY - 5)).toEqual([0]);   // the album's first missing piece
    expect(p.okruchy).toBe(0);
    expect(nextMissing(p)).toBe(1);
    const forced = drawAmber(p, 'legend', rnd, true);       // pity: the tier is complete, so what pity gives
    expect(forced).toMatchObject({ piece: 1, isNew: true });
  });

  it('crafts and pities the lowest missing tier across both sets; a legendary piece only from crumbs, last', () => {
    const p = freshProgress();
    p.amber = [0, 1, 2, 3];                                  // all of Zatoka's commons
    expect(nextMissing(p)).toBe(9);                          // Mierzeja's komar, not Zatoka's pióro
    p.amber = AMBER.filter(a => a.tier === 'common').map(a => a.index);
    expect(AMBER[nextMissing(p)!].tier).toBe('rare');
    p.amber = AMBER.filter(a => a.tier !== 'legend').map(a => a.index);
    expect(nextMissing(p, false)).toBeNull();                // pity never gives a legendary piece…
    expect(AMBER[nextMissing(p)!].tier).toBe('legend');      // …crumbs may, last of all
    p.okruchy = CRAFT_OKRUCHY - 1;
    expect(addCrumbs(p, 1)).toEqual([8]);
    // a session whose pity is due, with only the legendary pieces missing: nothing comes by pity
    const fail = frame({ activity: 8, calm: 0.2 });
    const sim = makeSim({ progress: { sessions: 6, lastNewSession: 1, amber: AMBER.filter(a => a.tier !== 'legend').map(a => a.index) }, planned: 120 });
    sim.spawnT = Infinity;
    expect(ofType(drive(sim, 122, fail), 'amber')).toEqual([]);
  });

  it('guarantees a new piece at least every second session (pity), washed up at dawn', () => {
    const fail = frame({ activity: 8, calm: 0.2 });         // every Cisza fails: no draws at all
    const run = (progress: Partial<LatarnikProgress>) => {
      const sim = makeSim({ progress: { sessions: 3, ...progress }, planned: 120 });
      sim.spawnT = Infinity;
      return ofType(drive(sim, 122, fail), 'amber');
    };
    expect(run({ lastNewSession: 2 }).map(e => e.via)).toEqual(['pity']);   // session 4, nothing new in 3
    expect(run({ lastNewSession: 3 })).toEqual([]);                          // session 4, a new piece in 3
    const first = makeSim({ planned: 40 });
    first.spawnT = Infinity;
    expect(ofType(drive(first, 42, fail), 'amber').map(e => e.via)).toEqual(['pity']);   // the very first session
  });

  it('opens the letters in order, one bottle per session in a Konwój', () => {
    const sim = quiet({ progress: { letters: 3 }, planned: 300 });
    const clock = { t: 0 };
    drive(sim, 2.5, frame(), clock);
    expect(sim.boats.some(b => b.kind === 'butelka')).toBe(false);
    drive(sim, 5, frame(), clock);
    const bottle = sim.boats.find(b => b.kind === 'butelka')!;
    expect(bottle).toBeDefined();
    expect(bottle.r).toBeGreaterThanOrEqual(BANDS.mid[0] - 0.1);
    sim.reach = 1;
    aim(sim, bottle.a / DEG);
    sim.flash();
    expect(ofType(sim.take(), 'bottle')[0].letter).toBe(4);
    expect(sim.p.letters).toBe(4);
    expect(sim.score).toBe(0);              // a bottle is not a boat
    while (sim.blockIndex < 3) drive(sim, 0.5, frame(), clock);
    expect(sim.boats.some(b => b.kind === 'butelka')).toBe(false);   // one a session
    const done = quiet({ progress: { letters: LETTERS.length } });
    drive(done, 10, frame());
    expect(done.boats.some(b => b.kind === 'butelka')).toBe(false);
  });

  it('spawns the rare żaglowiec at the horizon only after 12 s of hold in a Konwój', () => {
    const sim = makeSim({ progress: { sessions: 5 }, planned: 300, seed: 4 });
    const clock = { t: 0 };
    const born = new Map<number, number>();
    const watch = () => { for (const b of sim.boats) if (b.kind === 'zaglowiec' && !born.has(b.id)) born.set(b.id, b.r); };
    drive(sim, 11, t => frame({ level: 0.9, focused: true, hold: t, activity: 8 }), clock, watch);
    expect(born.size).toBe(0);
    drive(sim, 8, t => frame({ level: 0.9, focused: true, hold: t, activity: 8 }), clock, watch);
    expect(born.size).toBe(1);
    expect([...born.values()][0]).toBeGreaterThanOrEqual(BANDS.horizon[0]);
  });

  it('reveals in a blind Konwój how many ships came from afar, and hides their lanterns', () => {
    const sim = quiet({ progress: { sessions: 4, konwoje: 3 }, planned: 300 });
    expect(sim.blind).toBe(true);
    drive(sim, 2, frame({ level: 1 }));
    sim.reach = 1;
    const far = boatAt(sim, 120, 0.8);
    aim(sim, 120);
    sim.flash();
    expect(far.state).toBe('home');
    const silhouette = sim.spawn({ band: 'horizon' });
    expect(silhouette.dark).toBe(true);
    const evs: SimEvent[] = [];
    while (sim.blockIndex === 0) evs.push(...drive(sim, 0.25, frame({ level: 1, activity: 8 })));
    expect(ofType(evs, 'blindReveal')[0].far).toBe(1);
    expect(farShips(1)).toBe('Z daleka dopłynął 1 statek');
    expect(farShips(3)).toBe('Z daleka dopłynęły 3 statki');
    expect(farShips(5)).toBe('Z daleka dopłynęło 5 statków');
    expect(farShips(22)).toBe('Z daleka dopłynęły 22 statki');
    expect(farShips(0)).toBe('Tym razem z daleka nie dopłynął żaden statek');
  });

  it('keeps yesterday\'s best reach as a faint ring to beat', () => {
    const sim = makeSim({ progress: { sessions: 2, reachDay: '2026-10-22', reachBest: 0.83 } });
    expect(sim.ghost).toEqual({ reach: 0.83, label: 'wczoraj' });
    expect(sim.p.reachPrev).toBe(0.83);
    expect(sim.p.reachBest).toBe(0);
    drive(sim, 40, frame({ level: 0.9 }));
    expect(sim.p.reachBest).toBeGreaterThan(0.8);
  });

  it('keeps the lobby card short: one album set open, the other set, the odds and the letter folded', () => {
    const p = { ...freshProgress(), boats: 1, bestStreak: 3, amber: [9, 10, 11, 0], letters: 4 };
    const el = progressPanel(p);
    const open = [...el.querySelectorAll('.arcade-album')].filter(g => !g.closest('details'));
    expect(open).toHaveLength(1);
    expect(open[0].children).toHaveLength(9);
    expect(el.textContent).toContain('Bursztyny · Mierzeja 3/9');   // the set being collected: the one with more pieces
    const folds = [...el.querySelectorAll('details')];
    expect(folds.map(d => d.open)).toEqual([false, false, false]);
    expect(folds.map(d => d.querySelector('summary')!.textContent)).toEqual([
      'Zatoka · 1/9 ▾', 'Szanse i zasady · masz 0 okruchów ▾', `„${LETTERS[3].replace(/\s*Hania$/, '')}”— Hania · czytaj całość`,
    ]);
    const units = [...el.querySelectorAll('.arcade-stats .v small')].map(s => s.textContent);
    expect(units.slice(0, 1)).toEqual(['łódź']);
    expect(el.textContent).toContain('tyle samo minut');
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('leaves no Polish behind: only these texts read the same as the Polish ones', () => {
    const same: Record<string, string[]> = {};
    for (const l of LANGS.filter(x => x !== 'pl')) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      same[l] = Object.keys(CATALOGS.pl).filter(k => JSON.stringify(cat[k]) === JSON.stringify((CATALOGS.pl as Record<string, unknown>)[k]));
      // only Zośka keeps her Polish name in every language
      for (const [k, v] of Object.entries(cat)) expect(JSON.stringify(v).replace(/Zośka/g, ''), `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/);
    }
    expect(same).toEqual({
      en: ['pct', 'stat.nightsV', 'panel.level', 'hl.piece', 'panel.signed', 'panel.tile'],
      de: ['stat.nightsV', 'panel.level', 'stat.contrast', 'hl.piece'],
      sv: ['stat.nightsV', 'panel.level', 'stat.contrast', 'hl.piece'],
    });
  });

  it('signs every letter with Hania\'s name at its end, in every language (the lobby signs it apart)', () => {
    for (const l of LANGS) {
      for (let i = 1; i <= LETTERS.length; i++) expect((CATALOGS[l] as Record<string, string>)[`letter.${i}`], `${l} letter ${i}`).toMatch(/\. Hania$/);
    }
  });

  it('writes names as they read inside a sentence and makes labels of them with cap()', () => {
    expect(VILLAGE.map(s => s.name)).toContain('chata rybacka');
    expect(cap(VILLAGE[3].name)).toBe('Chata rybacka');
    expect(cap(AMBER[0].name)).toBe('Komar');
    // German nouns keep their capital inside a sentence
    expect(CATALOGS.de['amber.komar']).toBe('Mücke');
    expect(CATALOGS.de['village.chata']).toBe('Fischerhütte');
  });
});

describe('Noc dnia, result, the smoke path', () => {
  const firstBoats = (sim: LatarnikSim) => {
    const seen: string[] = [];
    drive(sim, 20, frame(), { t: 0 }, () => {
      for (const b of sim.boats) if (b.t === STEP && b.n >= 0) seen.push(`${b.kind}@${(b.a / DEG).toFixed(2)}`);   // the bottle is the session's own
    });
    return seen.slice(0, 5);
  };

  it('seeds the day\'s first session with the date', () => {
    const a = firstBoats(makeSim({ progress: { sessions: 5 }, seed: 1 }));
    const b = firstBoats(makeSim({ progress: { sessions: 5 }, seed: 99 }));
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(b).toEqual(a);
    const later = firstBoats(makeSim({ progress: { sessions: 5, dailyDay: DAY }, seed: 99 }));
    expect(later).not.toEqual(a);
    // the night counts as played once the session is saved (result()), not when an attempt is abandoned
    const sim = makeSim({ progress: { sessions: 5 } });
    drive(sim, 31, frame());
    expect(sim.p.dailyDay).toBe('');
    sim.result();
    expect(sim.p).toMatchObject({ dailyDay: DAY, dailyScore: sim.score });
  });

  it('gives everyone the same night: the n-th boat of "Noc dnia" does not depend on how anyone taps', () => {
    /** The night's scheduled boats as one player meets them, by their number: kind, bearing, distance, bob. */
    const night = (seed: number, policy: 'steady' | 'sloppy' | 'idle') => {
      const sim = makeSim({ progress: { sessions: 5, lastNewSession: 5 }, planned: 300, seed, daySeed: 2024 });
      expect(sim.daily).toBe(true);
      const tap = policy === 'idle' ? null : tapper(sim, seed + 50, policy === 'steady' ? 0.06 : 0.14, policy === 'steady' ? 0.95 : 0.7);
      const seen = new Map<number, string>();
      drive(sim, 240, frame(), { t: 0 }, t => {
        for (const b of sim.boats) if (b.n >= 0 && !seen.has(b.n)) seen.set(b.n, `${b.kind} ${(b.a0 / DEG).toFixed(6)} ${b.r0.toFixed(6)} ${b.phase.toFixed(6)}`);   // where it was born (a squall's gust may push it)
        tap?.(t);
      });
      return { seen, score: sim.score, rewound: sim.lost };
    };
    const steady = night(1, 'steady'), sloppy = night(2, 'sloppy'), idle = night(3, 'idle');
    expect(steady.score).toBeGreaterThan(sloppy.score);       // three different evenings…
    expect(idle.score).toBe(0);
    expect(idle.rewound).toBeGreaterThan(3);
    for (const other of [sloppy, idle]) {
      let shared = 0;
      for (const [n, boat] of other.seen) {
        if (!steady.seen.has(n)) continue;
        shared++;
        expect(boat, `boat ${n}`).toBe(steady.seen.get(n));   // …on the same night: every boat both met is the same boat
      }
      expect(shared).toBeGreaterThan(other === idle ? 25 : 30);   // cards between nights and flotillas skip a few, each player other ones
    }
    expect(steady.seen.size).toBeGreaterThan(50);
    // a later session of the day is a night of its own
    const later = makeSim({ progress: { sessions: 5, dailyDay: DAY }, planned: 300, seed: 1, daySeed: 2024 });
    const other = new Map<number, string>();
    drive(later, 30, frame(), { t: 0 }, () => {
      for (const b of later.boats) if (b.n >= 0 && !other.has(b.n)) other.set(b.n, `${b.kind} ${(b.a / DEG).toFixed(6)}`);
    });
    expect([...other.values()].slice(0, 5)).not.toEqual([...steady.seen.values()].slice(0, 5).map(s => s.split(' ').slice(0, 2).join(' ')));
  });

  it('closes the night with a passage that fits it, a different one session by session', () => {
    const verse = (o: { sessions: number; boats: number; calm: number }) => {
      const sim = quiet({ progress: { sessions: o.sessions - 1 } });
      sim.score = o.boats;
      sim.ciszeWon = o.calm;
      return sim.result().verse;
    };
    expect(verse({ sessions: 1, boats: 0, calm: 0 })).toBe('psa119.105');      // the lamp fits every night
    expect(verse({ sessions: 1, boats: 3, calm: 0 })).toBe('psa107.29-30');    // boats home: the haven
    expect(verse({ sessions: 2, boats: 3, calm: 0 })).toBe('isa43.2');         // … the waters passed
    expect(verse({ sessions: 1, boats: 3, calm: 1 })).toBe('mrk4.39');         // a Cisza won: the stilled sea
    expect(verse({ sessions: 4, boats: 3, calm: 1 })).toBe('psa119.105');
  });

  it('result() is idempotent: records with Math.max, counters only during play', () => {
    const sim = makeSim({ progress: { sessions: 5, bestSession: 3 }, planned: 120, seed: 2 });
    const clock = { t: 0 };
    drive(sim, 60, frame({ level: 0.8 }), clock, t => {
      if (Math.round(t * 60) % 20 === 0) {
        const b = sim.boats.find(x => x.state === 'sea' && x.r <= sim.reach);
        if (b) { aim(sim, b.a / DEG); sim.flash(); }
      }
    });
    const first = sim.result();
    const saved = JSON.stringify(sim.p);
    const second = sim.result();
    expect(second).toEqual(first);
    expect(JSON.stringify(sim.p)).toBe(saved);
    expect(first.score).toBe(sim.score);
    expect(first.score).toBeGreaterThan(3);
    expect(first.record).toBe(true);
    expect(sim.p.bestSession).toBe(first.score);
    expect(first.stats).toHaveLength(8);
    expect(first.unit).toBe(unit(first.score));
  });

  it('names the boats with the right Polish plural (1 łódź, 2–4 łodzie, 5+ łodzi, 12–14 łodzi, 22–24 łodzie)', () => {
    expect([1, 2, 4, 5, 12, 14, 21, 22, 24, 25, 112].map(unit))
      .toEqual(['łódź', 'łodzie', 'łodzie', 'łodzi', 'łodzi', 'łodzi', 'łodzi', 'łodzie', 'łodzie', 'łodzi', 'łodzi']);
    expect([0, 1, 3, 5].map(n => t('crates', { n }))).toEqual(['0 skrzyń', '1 skrzynia', '3 skrzynie', '5 skrzyń']);
    expect([1, 2, 25].map(n => t('crumbs', { n }))).toEqual(['1 okruch', '2 okruchy', '25 okruchów']);
    expect([1, 3, 13].map(n => bare('hud.inPort', n))).toEqual(['łódź w porcie', 'łodzie w porcie', 'łodzi w porcie']);   // under the score
    const sim = quiet();
    for (const [score, unit] of [[0, 'łodzi'], [1, 'łódź'], [3, 'łodzie'], [13, 'łodzi'], [23, 'łodzie']] as const) {
      sim.score = score;
      expect(sim.result().unit).toBe(unit);
    }
  });

  it('counts a session only when it is saved: after an abandoned first attempt the next one is still the first', () => {
    const p = freshProgress();
    const make = (seed: number) => new LatarnikSim({ progress: p, rng: mulberry32(seed), day: DAY, daySeed: 7, plannedSec: 180, eeg: false, tuning: BEGINNER });
    const quitter = make(1);
    quitter.start();
    drive(quitter, 50, frame({ activity: 8, level: 0.9 }));   // into the first Konwój, then "Porzuć": no result()
    expect(quitter.session).toBe(1);
    expect(p).toMatchObject({ sessions: 0, konwoje: 0, dailyDay: '' });
    expect(latarnik.best(p)).toBeNull();
    const again = make(2);
    again.start();
    expect(again.session).toBe(1);
    expect(again.plan[0].kind).toBe('warmup');
    expect(again.speed).toBeCloseTo(RULES.firstSpeed, 9);
    drive(again, 182, frame());
    const out = again.result();
    again.result();
    expect(p.sessions).toBe(1);
    expect(p.konwoje).toBe(again.plan.filter(b => b.kind === 'konwoj').length);
    expect(p.dailyDay).toBe(DAY);
    expect(latarnik.best(p)).toBe(out.score);
    // a returning player's session too: nothing is counted during play, only by result()
    const back = makeSim({ progress: { sessions: 5, konwoje: 7 }, planned: 120 });
    drive(back, 100, frame());
    expect([back.p.sessions, back.p.konwoje, back.p.dailyDay]).toEqual([5, 7, '']);
    back.result();
    expect([back.p.sessions, back.p.konwoje]).toEqual([6, 7 + back.plan.filter(b => b.kind === 'konwoj').length]);
  });

  it('puts the session\'s best moments first in the summary, and gives Zośka the last word', () => {
    const sim = busySession();
    const { highlights } = sim.result();
    expect(highlights.length).toBeGreaterThanOrEqual(3);
    expect(highlights.length).toBeLessThanOrEqual(5);
    expect(highlights[0]).toMatch(/^(Noc za Tobą|\d+ no(ce|cy) za Tobą|Szkwał)/);
    expect(highlights[highlights.length - 1]).toMatch(/^Zośka: „.+”$/);
    expect(sim.result().highlights).toEqual(highlights);   // the same on every call
    expect(highlights.filter(h => h.startsWith('Rekord'))).toHaveLength(highlights.some(h => h.startsWith('Rekord')) ? 1 : 0);
  });

  it('merges new amber into one line and keeps an empty blind reveal out of the summary', () => {
    const blind = quiet({ progress: { sessions: 4, konwoje: 3 }, planned: 120 });
    while (blind.blockIndex === 0) drive(blind, 0.25, frame({ level: 0.2 }));
    expect(blind.plan[0].blind).toBe(true);
    expect(blind.result().highlights.join(' ')).not.toMatch(/statek|statki|statków/);
    // a Cisza whose amber crafts a piece from crumbs, then its own draw: two new pieces in one line
    const sim = quiet({ progress: { okruchy: CRAFT_OKRUCHY - 1 }, planned: 300 });
    const clock = { t: 0 };
    while (sim.block.kind !== 'cisza') drive(sim, 0.25, frame({ activity: 2.5, level: 0.6 }), clock);
    while (sim.block.kind === 'cisza') drive(sim, 0.25, frame({ activity: 0, calm: 0.8 }), clock);
    const amber = sim.result().highlights.filter(h => h.startsWith('Now'));
    expect(amber).toHaveLength(1);
    expect(amber[0]).toMatch(/^Nowe bursztyny: \S+ \(\S+\), \S+ \(\S+\)$/);
  });

  it('settles a session ended early like its dawn: the open block is judged and the pity piece rolled, once', () => {
    // ended in a Konwój: the Konwój is judged now, and the pity piece washes up
    const k = makeSim({ progress: { sessions: 3, lastNewSession: 1 }, planned: 300 });
    k.spawnT = Infinity;
    drive(k, 12, frame({ activity: 8, level: 0.9, focused: true }));
    k.finish();
    const ev = k.take();
    expect(ofType(ev, 'star')).toHaveLength(1);
    expect(ofType(ev, 'amber').map(e => e.via)).toEqual(['pity']);
    expect(k.phase).toBe('finale');
    const amber = k.p.amber.length;
    k.finish();
    expect(k.take()).toHaveLength(0);
    expect(k.p.amber).toHaveLength(amber);
    expect(k.result().score).toBe(k.score);
    expect(k.p.sessions).toBe(4);
    // ended in a calm Cisza: its draw (a new piece, pity being due) and its amber, no second piece at dawn
    const c = makeSim({ progress: { sessions: 3, lastNewSession: 1 }, planned: 300 });
    c.spawnT = Infinity;
    const clock = { t: 0 };
    while (c.block.kind !== 'cisza') drive(c, 0.25, frame({ activity: 8, level: 0.9 }), clock);
    drive(c, 14, frame({ activity: -2, calm: 0.9, level: 0.1 }), clock);
    c.take();
    c.finish();
    const ec = c.take();
    expect(ofType(ec, 'blockEnd')[0].verdict).toBe(true);
    expect(ofType(ec, 'washUp')).toHaveLength(1);
    expect(ofType(ec, 'amber').map(e => [e.via, e.isNew])).toEqual([['draw', true]]);
    // the session's own dawn: nothing left to settle
    const done = makeSim({ progress: { sessions: 5 }, planned: 40 });
    drive(done, 41, frame());
    done.take();
    done.finish();
    expect(done.take()).toHaveLength(0);
  });

  /** The smoke test's input: a tap at the centre every ~0.65 s, Space after every third one, the simulator's focus on. */
  function smoke(progress: Partial<LatarnikProgress>, seed: number, every = 0.65): LatarnikSim {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER });
    const focus = new FocusInput({ ...DEFAULT_TUNING, adapt: 0.08, ...BEGINNER_TUNING });
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0;
    for (let t = 0; t < 22; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);   // activity rises to about +20 % in ~10 s
      }
      sim.update(STEP, f, t);
      tap += STEP;
      if (tap >= every) {
        tap -= every;
        sim.flash();
        if (taps++ % 3 === 0) sim.flash();
      }
      sim.take();
    }
    return sim;
  }

  it('lights boats within 22 s with the smoke test\'s generic input in a first session (any tap rhythm)', () => {
    // the smoke tests run on a fresh profile: the first-ever session, whose lesson stops the beam on the first boat
    for (const every of [0.65, 0.66, 2 / 3, 0.68, 0.7]) {
      for (let seed = 1; seed <= 40; seed++) expect(smoke({}, seed, every).score, `every ${every} s, seed ${seed}`).toBeGreaterThan(0);
    }
    const sim = smoke({}, 1);
    expect(sim.lesson).toBe('done');
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('stops the beam on the first-ever boat until it is lit', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    while (sim.lesson !== 'hold' && clock.t < 5) drive(sim, STEP, frame(), clock);
    expect(sim.lesson).toBe('hold');
    const beam = sim.beam;
    drive(sim, 2, frame(), clock);
    expect(sim.beam).toBe(beam);
    const boat = sim.boats.find(b => b.anchored)!;
    expect(boat.r).toBeGreaterThan(RULES.reef);
    sim.flash();
    expect(boat.state).toBe('home');
    expect(boat.perfect).toBe(true);
    drive(sim, 1, frame(), clock);
    expect(sim.lesson).toBe('done');
    expect(sim.omega).toBeCloseTo(RULES.firstSpeed, 1);
  });

  it('makes blind periodic tapping score most of the time in later sessions too', () => {
    let scored = 0;
    for (let seed = 1; seed <= 100; seed++) if (smoke({ sessions: 6, lastNewSession: 6, dailyDay: DAY }, seed).score > 0) scored++;
    expect(scored).toBeGreaterThanOrEqual(85);
  });
});

describe('the view: where things go', () => {
  const sizes: [number, number][] = [[390, 844], [375, 667], [360, 640], [412, 915], [844, 390], [667, 375], [1280, 800], [1440, 900]];

  it.each(sizes)('keeps the card slot off the sea and on the stage at %i×%i', (w, h) => {
    const L = layout(w, h);
    const s = L.card;
    const nx = Math.min(Math.max(L.cx, s.x), s.x + s.w), ny = Math.min(Math.max(L.cy, s.y), s.y + s.h);
    expect(Math.hypot(nx - L.cx, ny - L.cy)).toBeGreaterThan(L.R);      // the nearest corner of the card lies off the sea
    expect(s.y + s.h).toBeLessThanOrEqual(L.bottom);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x + s.w).toBeLessThanOrEqual(w);
    // upright: in the pill's place over the sea, or under the sea's deck where the band is taller
    if (L.portrait) expect(L.cardOver === 'goal' ? s.y + s.h < L.cy - L.R : s.y > L.cy + L.R).toBe(true);
  });

  it('draws the boats and the island large enough to read on a phone', () => {
    const phone = layout(390, 844), land = layout(844, 390), desk = layout(1280, 800);
    for (const L of [phone, land]) {
      expect(L.boat).toBeGreaterThanOrEqual(20);
      expect(L.s / L.R).toBeCloseTo(0.13, 2);
    }
    expect(desk.s / desk.R).toBeCloseTo(0.115, 3);
    expect(desk.boat).toBeCloseTo(desk.R * 0.1, 6);
  });

  it('shows each message at least its minimum time, the more important first, and drops stale ones', () => {
    const q = new Queue<string>();
    const shown: string[] = [];
    q.push('Konwój', { dur: 2.4, min: 1.6, rank: 1 });
    q.push('Pełne światło gotowe', { dur: 1.6, min: 1, rank: 2, keep: 1 });
    q.push('Gwiazda latarni', { dur: 1.8, min: 1.1, rank: 0 });
    for (let i = 0; i < 300; i++) {
      const h = q.head?.item ?? null;
      if (h && h !== shown[shown.length - 1]) shown.push(h);
      q.update(STEP);
    }
    expect(shown).toEqual(['Konwój', 'Gwiazda latarni']);    // the stale one waited past its moment
    const r = new Queue<string>();
    r.push('a', { dur: 2, min: 0.5 });
    r.update(1);
    r.push('b', { dur: 2 });
    r.update(0.29);
    expect(r.head?.item).toBe('a');                            // fading out after its minimum
    expect(r.alpha).toBeLessThan(0.1);
    r.update(0.02);
    expect(r.head?.item).toBe('b');
  });

  it('shows the blind Konwój\'s reveal in the card slot while the star and the next block\'s name take turns above', () => {
    const sim = quiet({ progress: { sessions: 4, konwoje: 3 }, planned: 300 });
    const view = new LatarnikView(stubCanvas(), { reducedMotion: true });
    view.resize(390, 844, 2);
    view.start();
    const step = (f: FocusFrame) => {
      sim.update(STEP, f, 0);
      for (const e of sim.take()) view.on(e, sim);
      view.update(STEP, sim);
    };
    sim.reach = 1;
    const far = boatAt(sim, 120, 0.8);
    aim(sim, 120);
    sim.flash();
    for (const e of sim.take()) view.on(e, sim);
    expect(far.state).toBe('home');
    while (sim.blockIndex === 0) step(frame({ level: 0.9, activity: 8 }));
    const seen: { title: string | null; card: string | null }[] = [];
    for (let i = 0; i < 5 / STEP; i++) {
      step(frame({ calm: 0.8 }));
      seen.push(view.showing);
    }
    expect(seen.filter(s => s.card === farShips(1)).length * STEP).toBeGreaterThan(2.5);
    const titles = seen.map(s => s.title).filter((x, i, all) => x !== null && x !== all[i - 1]);
    expect(titles).toEqual(['Blask latarni']);   // the runner's banner names the Cisza
  });
});

// ── the game, as the runner drives it ──────────────────────────
/** A 2D context that accepts every call (happy-dom has no canvas): the drawing code runs, nothing is painted. */
function fakeContext(canvas: unknown): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (t: string) => ({ width: t.length * 7 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') return () => gradient;
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Latarnik as the runner plays it', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  const g = globalThis as unknown as { Path2D?: unknown };
  const hadPath = 'Path2D' in g;
  beforeAll(() => {
    proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); };
    if (!hadPath) g.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} roundRect() {} arc() {} ellipse() {} };
  });
  afterAll(() => {
    proto.getContext = original;
    if (!hadPath) delete g.Path2D;
  });

  const envFor = (progress: LatarnikProgress, plannedSec: number, tuning = TUNING): GameEnv<LatarnikProgress> => ({
    canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
    progress, rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
    tuning, hint: () => {}, hudTop: () => 0, insets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }), touch: false,
  });

  it('plays the smoke path through intro, play and the summary at every screen size, drawing every frame', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1280, 800]]) {
      const progress = latarnik.freshProgress();
      const game = latarnik.create(envFor(progress, 40, BEGINNER));
      game.resize(w, h, 2);
      for (let i = 0; i < 20; i++) {
        game.intro(1 / 30, i / 20);
        game.draw();
      }
      game.start();
      const focus = new FocusInput({ ...DEFAULT_TUNING, adapt: 0.08, ...BEGINNER_TUNING });
      let f = focus.push(0, true, 0.1), tap = 0;
      for (let t = 0; t < 44; t += STEP) {
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, STEP);
        game.update(STEP, f, t);
        game.draw();
        if ((tap += STEP) >= 0.65) {
          tap -= 0.65;
          game.pointer!({ type: 'down', x: w / 2, y: h * 0.6, id: 1 });
        }
        if (t > 40 && game.canStop()) break;
      }
      expect(game.canStop()).toBe(true);
      game.finish!();
      const out = game.result();
      expect(out.score, `${w}×${h}`).toBeGreaterThan(0);
      expect(out.unit).toBe(unit(out.score));
      expect(progress.sessions).toBe(1);
      game.destroy();
    }
  });

  it('ends early without animations: finish() settles the night, and the summary counts it', () => {
    const progress = { ...latarnik.freshProgress(), sessions: 3, lastNewSession: 1 };
    const game = latarnik.create(envFor(progress, 300));
    game.resize(390, 844, 2);
    game.start();
    for (let t = 0; t < 12; t += STEP) {
      game.update(STEP, frame({ activity: 8, level: 0.9, focused: true }), t);
      game.draw();
    }
    expect(game.padLevel!(frame({ level: 0.1 }))).not.toBeNull();   // a sighted Konwój: the pad follows the lamp
    const amber = progress.amber.length;
    game.finish!();
    const out = game.result();
    expect(out.stats.find(([k]) => k === t('stat.stars'))![1]).toBe('1/1');   // the open Konwój was judged
    expect(progress.amber.length).toBe(amber + 1);                   // and the pity piece came at the settling
    expect(progress.sessions).toBe(4);
    game.draw();                                                     // nothing left to animate, nothing breaks
  });
});

// ── version 2 ──────────────────────────────────────────────────
describe('version 2: the nights', () => {
  it('cycles five kinds of night, a squall every fifth, with goals and speed growing rejs by rejs', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(n => nightSpec(n).kind)).toEqual(['powroty', 'mgla', 'flotylla', 'ratunek', 'szkwal', 'powroty', 'szkwal']);
    expect([0, 5, 10].map(n => nightSpec(n).goal)).toEqual([6, 8, 10]);
    expect(nightSpec(4)).toMatchObject({ boss: true, goal: 8 });
    expect(nightSpec(1).whale).toBe(false);
    expect(nightSpec(2).whale).toBe(true);
    expect(nightSpec(1).speed).toBeGreaterThan(nightSpec(0).speed);
    expect(nightSpec(200).speed).toBe(RULES.speedMax);
    expect(nightSpec(200).goal).toBeLessThanOrEqual(16);
  });

  it('gives ★ for the goal, ★★ for at most one lantern out, ★★★ for five perfects in a row', () => {
    const spec = nightSpec(0);
    expect(starsFor(spec, { got: 5, lost: 0, bestStreak: 9 })).toBe(0);
    expect(starsFor(spec, { got: 6, lost: 2, bestStreak: 4 })).toBe(1);
    expect(starsFor(spec, { got: 6, lost: 1, bestStreak: 4 })).toBe(2);
    expect(starsFor(spec, { got: 6, lost: 3, bestStreak: 5 })).toBe(2);
    expect(starsFor(spec, { got: 6, lost: 0, bestStreak: 5 })).toBe(3);
    expect(totalStars([3, 2, 0, 7, -1])).toBe(8);
  });

  it('keeps a night at its goal: the stars saved, the village lit, a card, then the next night', () => {
    const sim = quiet();
    sim.spec = nightSpec(0);
    sim.reach = 0.8;
    for (let i = 0; i < 6; i++) {
      boatAt(sim, 40 * i, 0.3);
      aim(sim, 40 * i);
      sim.flash();
    }
    const evs = sim.take();
    expect(ofType(evs, 'progress').map(e => e.got)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ofType(evs, 'nightWon')[0]).toMatchObject({ stars: 3, before: 0 });
    expect(ofType(evs, 'built').map(e => e.step)).toEqual([0, 1]);   // 3 stars light the pier and the nets
    expect(sim.p.nightStars).toEqual([3]);
    expect(sim.p.night).toBe(1);
    expect(sim.phase).toBe('between');
    expect(sim.headlineSub()).toBe('Noc 1 · 6/6');
    const next = drive(sim, RULES.nightCard + 0.1, frame());
    expect(ofType(next, 'nightStart')[0].spec).toMatchObject({ n: 1, kind: 'mgla' });
    expect([sim.got, sim.lost, sim.lanterns, sim.phase]).toEqual([0, 0, 3, 'play']);
    expect(sim.result().highlights[0]).toBe('Noc za Tobą: +3 ★');
    // a night kept again never takes its stars away
    sim.spec = nightSpec(0);
    sim.got = 5;
    sim.lost = 3;
    boatAt(sim, 90, 0.3);
    aim(sim, 90);
    sim.flash();
    expect(ofType(sim.take(), 'nightWon')[0]).toMatchObject({ stars: 1, before: 3 });
    expect(sim.p.nightStars[0]).toBe(3);
  });

  it('hides fog-bound boats until the beam passes over them within its reach, and counts them in a fog night', () => {
    const sim = quiet();
    sim.spec = { ...nightSpec(1), goal: 1000 };
    sim.reach = 0.6;
    const b = sim.spawn({ kind: 'mgla', a: 90 * DEG, r: 0.5 });
    const far = sim.spawn({ kind: 'mgla', a: 270 * DEG, r: 0.8 });
    expect([b.hidden, b.seen]).toEqual([true, 0]);
    sim.beam = 0;
    drive(sim, STEP, frame());
    expect(b.seen).toBe(0);
    sim.beam = 90 * DEG;
    let evs: readonly SimEvent[] = drive(sim, STEP, frame());
    expect(ofType(evs, 'spotted').map(e => e.boat)).toEqual([b]);
    expect(b.seen).toBeCloseTo(RULES.fogSeen, 6);
    sim.beam = 270 * DEG;
    evs = drive(sim, STEP, frame());
    expect(ofType(evs, 'spotted')).toHaveLength(0);   // beyond the reach: still in the fog
    expect(far.seen).toBe(0);
    aim(sim, b.a / DEG);
    sim.flash();
    evs = sim.take();
    expect(b.state).toBe('home');
    expect(b.cargo).toBe(cargoAt(b.r0) + 1);           // a find carries a crate more
    expect(sim.got).toBe(1);
    // a regular boat does not count in a fog night
    boatAt(sim, 200, 0.3);
    aim(sim, 200);
    sim.flash();
    expect(sim.got).toBe(1);
  });

  it('rings the workshop\'s bell where a fog-bound boat hides', () => {
    const sim = quiet({ progress: { upgrades: { lens: 0, oil: 0, bell: 1, beam: 0 } } });
    sim.spec = { ...nightSpec(1), goal: 1000 };
    sim.spawn({ kind: 'mgla', a: 180 * DEG, r: 0.85 });
    sim.beam = 0;
    const evs = drive(sim, 4, frame({ level: 0.1 }));
    expect(ofType(evs, 'ring').length).toBeGreaterThanOrEqual(1);
    expect(sim.bell).toBe(1);
  });

  it('brings a flotilla home in its numbers\' order: a boat out of turn waits, at no cost', () => {
    const sim = quiet();
    sim.spec = { ...nightSpec(2), goal: 1000 };
    sim.reach = 0.9;
    drive(sim, STEP, frame());
    const fl = sim.boats.filter(b => b.kind === 'flotylla');
    expect(fl.map(b => b.order).sort()).toEqual([1, 2, 3]);
    const no = (n: number) => fl.find(b => b.order === n)!;
    for (const _ of [0, 1, 2]) sim.flash();   // nothing in the beam yet? make sure the streak and lamp are fresh
    sim.take();
    sim.recharge = 0;
    sim.streak = 2;
    aim(sim, no(2).a / DEG);
    sim.flash();
    let evs: readonly SimEvent[] = sim.take();
    expect(ofType(evs, 'order')[0]).toMatchObject({ boat: no(2), want: 1 });
    expect([no(2).state, sim.streak, sim.recharge]).toEqual(['sea', 2, 0]);
    for (const n of [1, 2, 3]) {
      aim(sim, no(n).a / DEG);
      sim.flash();
    }
    evs = sim.take();
    expect(fl.every(b => b.state === 'home')).toBe(true);
    expect(ofType(evs, 'flotilla')[0]).toMatchObject({ size: 3, lit: 3, counted: true });
    expect(sim.got).toBe(1);
    expect(sim.flotilla).toBeNull();
  });

  it('lets pan Edek\'s rowboat bump the reef at no cost, and counts his rescue', () => {
    const sim = quiet();
    sim.spec = { ...nightSpec(3), goal: 1000 };
    sim.reach = 0.6;
    const b = sim.spawn({ kind: 'lodka', a: 45 * DEG, r: RULES.reef + 0.002 });
    let evs: readonly SimEvent[] = drive(sim, 0.3, frame());
    expect(ofType(evs, 'bump')).toHaveLength(1);
    expect(ofType(evs, 'reef')).toHaveLength(0);
    expect([b.state, sim.lanterns]).toEqual(['sea', 3]);
    expect(b.r).toBeGreaterThan(RULES.reef);
    aim(sim, b.a / DEG);
    sim.flash();
    evs = sim.take();
    expect(ofType(evs, 'rescue')).toHaveLength(1);
    expect([sim.got, sim.p.rescued, sim.rescuedNow]).toEqual([1, 1, 1]);
    expect(sim.result().verse).toBe('mat14.31');   // the hand that caught the sinking one
  });

  it('raises the whale with a warning; a flash on it is a bonus, and its dive costs nothing', () => {
    const sim = quiet();
    sim.spec = { ...nightSpec(5), goal: 1000 };
    sim.whale.next = 0.01;
    let evs: readonly SimEvent[] = drive(sim, 0.1, frame());
    expect(ofType(evs, 'whaleWarn')).toHaveLength(1);
    evs = drive(sim, RULES.whaleWarn, frame());
    expect(ofType(evs, 'whaleUp')).toHaveLength(1);
    sim.reach = 1;
    const crates = sim.crates;
    aim(sim, sim.whale.a / DEG);
    sim.flash();
    evs = sim.take();
    expect(ofType(evs, 'whale')[0].crates).toBe(RULES.whaleCrates);
    expect(ofType(evs, 'empty')).toHaveLength(0);
    expect([sim.p.whales, sim.crates - crates, sim.whale.state]).toEqual([1, RULES.whaleCrates, 'idle']);
    // the next one dives unlit: nothing lost
    sim.whale.next = 0.01;
    evs = drive(sim, 0.1 + RULES.whaleWarn + RULES.whaleUp + 0.2, frame());
    expect(ofType(evs, 'whaleDown')).toHaveLength(1);
    expect(sim.lanterns).toBe(3);
  });

  it('telegraphs a squall\'s gust 1.6 s ahead, then throws the beam back and pushes the boats aside', () => {
    const sim = quiet();
    sim.spec = { ...nightSpec(4), goal: 1000 };
    sim.gust.next = 0.2;
    let evs: readonly SimEvent[] = drive(sim, 0.3, frame());
    expect(ofType(evs, 'gustWarn')).toHaveLength(1);
    sim.gust.kind = 'back';
    const b = boatAt(sim, 90, 0.6), a = b.a;
    expect(sim.omega).toBeGreaterThan(0);              // the warning does not move the beam yet
    evs = drive(sim, RULES.gustWarn, frame());
    expect(ofType(evs, 'gust')[0].kind).toBe('back');
    drive(sim, 0.8, frame());
    expect(sim.omega).toBeLessThan(0);
    expect(b.a).toBeLessThan(a);
    evs = drive(sim, RULES.gustBlow, frame());
    expect(ofType(evs, 'gustEnd')).toHaveLength(1);
    drive(sim, 2, frame());
    expect(sim.omega).toBeCloseTo(sim.speed, 2);
    expect(sim.talkBlocked).toBe(false);
  });
});

describe('version 2: the workshop and old saves', () => {
  it('buys the upgrades with crates, the player\'s pick first, then the next one still to buy', () => {
    const p = freshProgress();
    p.focus = 'oil';
    expect(workshopTarget(p)).toBe('oil');
    expect(addToWorkshop(p, 49)).toEqual([]);
    expect(addToWorkshop(p, 1)).toEqual(['oil']);
    expect([p.upgrades.oil, p.chest]).toEqual([1, 0]);
    expect(addToWorkshop(p, 120 + 230)).toEqual(['oil', 'oil']);
    expect(costOf(p, 'oil')).toBeNull();
    expect(workshopTarget(p)).toBe('lens');             // at its top: the crates go on to the next
    expect(addToWorkshop(p, 10000)).toEqual(['lens', 'lens', 'lens', 'bell', 'bell', 'beam']);
    expect(workshopTarget(p)).toBeNull();
  });

  it('puts an upgrade to work the moment it is paid: a wider lens lights a boat a degree further out', () => {
    const sim = quiet({ progress: { chest: 39 } });
    const off = boatAt(sim, 100 + 10.6, 0.3);
    aim(sim, 100);
    sim.flash();
    expect(off.state).toBe('sea');
    sim.take();
    sim.recharge = 0;
    boatAt(sim, 30, 0.3);
    aim(sim, 30);
    sim.flash();
    expect(ofType(sim.take(), 'upgrade')[0]).toMatchObject({ upgrade: 'lens', level: 1 });
    expect(sim.wedge / DEG).toBeCloseTo(11, 6);
    aim(sim, 100);
    sim.flash();
    expect(off.state).toBe('home');
  });

  it('opens the second beam opposite the first, with a shorter reach', () => {
    const sim = quiet({ progress: { upgrades: { lens: 0, oil: 0, bell: 0, beam: 1 } } });
    sim.reach = 0.8;
    const back = boatAt(sim, 180, 0.4), tooFar = boatAt(sim, 185, 0.7);
    aim(sim, 0);
    sim.flash();
    expect(back.state).toBe('home');
    expect(tooFar.state).toBe('sea');                   // 0.7 R is past 62 % of the reach
  });

  it('migrates a version-1 save in place: the best, the sessions, the records, the amber and the letters stay', () => {
    const old = {
      v: 1, sessions: 7, boats: 210, crates: 905, stars: 6, bestSession: 41, bestWatch: 18, bestStreak: 12, farthest: 96, konwoje: 14,
      amber: [0, 3, 9], okruchy: 12, lastNewSession: 6, letters: 5, tallShips: 2, lastDay: '2026-10-20', lastCrates: 77,
      reachDay: '2026-10-20', reachBest: 0.91, reachPrevDay: '2026-10-18', reachPrev: 0.88, dailyDay: '2026-10-20', dailyScore: 33,
    };
    const p = mergeSaved(latarnik.freshProgress(), old);
    expect(latarnik.best(p)).toBe(41);
    const raw = p as unknown as Record<string, unknown>;
    expect(raw.v).toBeUndefined();
    expect(raw.bestWatch).toBeUndefined();
    expect(p).toMatchObject({
      ver: 2, sessions: 7, bestSession: 41, boats: 210, bestStreak: 12, farthest: 96, konwoje: 14, amber: [0, 3, 9], okruchy: 12,
      letters: 5, tallShips: 2, chest: OLD_CRATES_CREDIT, night: 0, nightStars: [], upgrades: { lens: 0, oil: 0, bell: 0, beam: 0 }, crates: 0,
    });
    expect(p.seen).toContain('tap');                     // a keeper who played knows the tap
    expect(migrate(p)).toBe(p);                          // idempotent
    expect(progressPanel(p).textContent).toContain('Noce');
    // a session on it runs and saves
    const sim = new LatarnikSim({ progress: p, rng: mulberry32(3), day: DAY, daySeed: 5, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 62, frame({ level: 0.7 }));
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
    expect(p.sessions).toBe(8);
    // fields of the wrong type never crash anything
    const odd = mergeSaved(latarnik.freshProgress(), { v: 1, sessions: '3', amber: 'x', bestSession: null, upgrades: 5, nightStars: { a: 1 }, seen: 7 });
    migrate(odd);
    expect(odd).toMatchObject({ sessions: 0, amber: [], bestSession: 0, nightStars: [], seen: [] });
    const odd2 = mergeSaved(latarnik.freshProgress(), { ver: 2, night: -3, nightStars: [9, 'a', 2], upgrades: { lens: 99, oil: 'x' }, focus: 'nope', amber: [1, 1, 99] });
    migrate(odd2);
    expect(odd2).toMatchObject({ night: 0, nightStars: [3, 0, 2], upgrades: { lens: 3, oil: 0, bell: 0, beam: 0 }, focus: 'lens', amber: [1] });
  });
});

describe('version 2: the standard HUD', () => {
  it('names the block, its strategy, its seconds left and, in the telegraph, the next one', () => {
    const sim = quiet({ planned: 300 });
    let s = sim.signal();
    expect(s).toMatchObject({ want: 'focus', blind: false, task: sim.tip, next: null });
    expect(s.left).toBeCloseTo(sim.block.dur, 6);
    expect(sim.tip).not.toMatch(/światło|zasięg|pierścień/i);   // a strategy, not the mechanic
    const clock = { t: 0 };
    while (sim.toNext! > RULES.telegraph - 0.5) drive(sim, 0.25, frame(), clock);
    s = sim.signal();
    expect(s.next).toBe('rest');
    expect(s.left!).toBeLessThan(RULES.telegraph);
    // the first session's warm-up is free
    expect(makeSim({ planned: 180 }).signal()).toMatchObject({ want: 'free', blind: false });
  });

  it('gauges the reach in a sighted Konwój (0.5 at the threshold), the glow in a Cisza, nothing blind or without a signal', () => {
    expect(reachMeter(reachFor(0.5))).toBeCloseTo(0.5, 9);
    const sim = quiet({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, 25, frame({ level: 0.5 }), clock);
    expect(sim.meter()!).toBeCloseTo(0.5, 1);
    drive(sim, STEP, frame({ reliable: false, activity: null }), clock);
    expect(sim.meter()).toBeNull();
    while (sim.block.kind !== 'cisza') drive(sim, 0.25, frame(), clock);
    drive(sim, 6, frame({ calm: 0.9 }), clock);
    expect(sim.meter()!).toBeCloseTo(sim.glow / RULES.glowMax, 6);
    expect(sim.meter()!).toBeGreaterThan(0.2);
    const blind = quiet({ progress: { sessions: 4, konwoje: 3 }, planned: 300 });
    drive(blind, 8, frame({ level: 0.9 }));
    expect(blind.blind).toBe(true);
    expect(blind.meter()).toBeNull();
    expect(blind.signal().blind).toBe(true);
  });

  it('heads the score corner with the boats and the night under them', () => {
    const sim = makeSim({ progress: { sessions: 5 }, planned: 300 });
    expect(sim.headlineSub()).toBe('Noc 1 · 0/6');
    sim.finish();
    expect(sim.headlineSub()).toBe('Świt · nocy za Tobą: 0');
  });

  it('keeps the sea under the HUD on a phone and clear of the panel and the score when wide', () => {
    for (const [w, h, top] of [[390, 694, 174], [375, 560, 174], [412, 760, 174], [1280, 672, 186], [1440, 770, 186], [1024, 640, 186], [844, 390, 174]]) {
      const L = layout(w, h, { top, right: 0, bottom: 0, left: 0 });
      if (L.portrait) expect(L.cy - L.R, `${w}×${h}`).toBeGreaterThanOrEqual(top - 1);
      else {
        for (const b of [[0, Math.min(w * 0.64, 350)], [w - Math.min(w * 0.3, 190), w]]) {
          const x = Math.min(Math.max(L.cx, b[0]), b[1]), y = Math.min(Math.max(L.cy, 0), top);
          expect(Math.hypot(x - L.cx, y - L.cy), `${w}×${h}`).toBeGreaterThanOrEqual(L.R - 1);
        }
      }
      for (const y of [L.goal.y, L.lanterns.y - 20 * L.u, L.ladder.y - 22 * L.u, L.card.y]) expect(y, `${w}×${h}`).toBeGreaterThanOrEqual(L.top - 1);
      expect(L.goal.y + L.goal.h, `${w}×${h}`).toBeLessThanOrEqual(L.bottom + 1);
      expect(L.R).toBeGreaterThanOrEqual(60);
    }
  });

  it('gives how to play in one goal, two controls and two tips, in every language', () => {
    const how = latarnik.howto!();
    expect(how.goal.length).toBeGreaterThan(10);
    expect(how.hands.map(x => x.gesture)).toEqual(['tap', 'keys']);
    expect(how.tips).toHaveLength(2);
  });
});

describe('version 2: Zośka', () => {
  it('has three lines or more for every moment, at most 90 characters, in every language', () => {
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const m of MOMENTS) {
        for (let i = 1; i <= 3; i++) {
          const line = cat[`z.${m}.${i}`];
          expect(typeof line, `${l} z.${m}.${i}`).toBe('string');
          expect((line as string).length, `${l} z.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
    expect(Object.keys(ZOSKA)).toEqual([...MOMENTS]);
  });

  it('waits for the runner\'s banner, never repeats a line before its moment has used them all, and keeps quiet under a card', () => {
    const sim = quiet({ planned: 300 });
    expect(sim.talkBlocked).toBe(true);                  // the block's banner
    drive(sim, RULES.bannerSec + 0.5, frame());
    expect(sim.talk.line).not.toBeNull();
    const said = new Set<string>();
    for (let i = 0; i < 3; i++) {
      sim.talk.line = null;
      sim.talk.ask('reef', 5, 10);
      drive(sim, RULES.talkGap + 0.1, frame());
      said.add(sim.talk.line!.text);
    }
    expect(said.size).toBe(3);
    sim.story = { kind: 'open', t: 0, dur: 5 };
    drive(sim, STEP, frame());
    expect(sim.talk.line).toBeNull();
  });
});

// ── mobile first (DESIGN §12) ──────────────────────────────────
/** The size in a canvas font string. */
const pxOf = (f: unknown): number => Number(String(f).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);

/** How far a box lies from a point (0: the point is inside it). */
const boxDist = (b: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number): number =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));

/**
 * A 2D context that draws nothing and notes every string filled or stroked at the size it shows (the font's
 * size times the transform's scale over the pixel ratio), the largest per string — as the mobile audit
 * measures it.  Save and restore keep the scale, the font and the alpha like a real context.
 */
function recordingContext(canvas: unknown, dpr: number, texts: Map<string, number> | null): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const stack: { k: number; font: unknown; alpha: unknown }[] = [];
  let k = 1 / dpr;
  const width = (s: string) => s.length * pxOf(state.font) * 0.55;
  const note = (text: unknown, maxW?: number) => {
    const str = String(text);
    if (!texts || !str.trim() || Number(state.globalAlpha) <= 0.05) return;
    let px = pxOf(state.font) * k;
    if (maxW !== undefined && maxW > 0 && width(str) > maxW) px *= maxW / width(str);
    texts.set(str, Math.max(texts.get(str) ?? 0, px));
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      switch (prop) {
        case 'measureText': return (s: string) => ({ width: width(String(s)) });
        case 'createLinearGradient': case 'createRadialGradient': case 'createConicGradient': return () => gradient;
        case 'setTransform': return (a: number, b: number) => { k = Math.hypot(a, b) / dpr; };
        case 'scale': return (sx: number) => { k *= sx; };
        case 'save': return () => { stack.push({ k, font: state.font, alpha: state.globalAlpha }); };
        case 'restore': return () => {
          const top = stack.pop();
          if (top) { k = top.k; state.font = top.font; state.globalAlpha = top.alpha; }
        };
        case 'fillText': case 'strokeText': return (s: string, _x: number, _y: number, maxW?: number) => note(s, maxW);
        default: return () => undefined;
      }
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('mobile first (DESIGN §3.2, §12)', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  const g = globalThis as unknown as { Path2D?: unknown };
  const hadPath = 'Path2D' in g;
  let recording: { canvas: HTMLCanvasElement; texts: Map<string, number> } | null = null;
  beforeAll(() => {
    proto.getContext = function (this: HTMLCanvasElement) {
      return recording && recording.canvas === this ? recordingContext(this, 2, recording.texts) : recordingContext(this, 1, null);
    };
    if (!hadPath) g.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} roundRect() {} arc() {} ellipse() {} rect() {} };
  });
  afterAll(() => {
    proto.getContext = original;
    if (!hadPath) delete g.Path2D;
  });

  const envAt = (progress: LatarnikProgress, c: (typeof CHECK_SIZES)[number], plannedSec: number, touch = true): GameEnv<LatarnikProgress> => ({
    canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
    progress, rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false,
    tuning: TUNING, hint: () => {}, hudTop: () => c.insets.top, insets: () => c.insets, touch,
  });

  it('lays the sea as large as the band allows, the deck inside the band and off the sea, at every checked size', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      const keep = L.R * SEA_PAD, u = L.u;
      const name = `${c.name} (${L.shape})`;
      // the scale starts from the phone and grows to 1.3
      if (Math.min(c.w, c.h) <= 390) expect(u, name).toBe(1);
      else expect(u, name).toBeGreaterThan(1);
      expect(u).toBeLessThanOrEqual(1.3);
      // the sea and the horizon's boats in sight: inside the band's sides, under the HUD where it has the room
      expect(L.cx - keep, name).toBeGreaterThanOrEqual(c.insets.left - 0.5);
      expect(L.cx + keep, name).toBeLessThanOrEqual(c.w - c.insets.right + 0.5);
      expect(L.cy + keep, name).toBeLessThanOrEqual(c.h - c.insets.bottom + (L.shape === 'wide' ? 5 : 0.5));
      if (L.shape !== 'wide') expect(L.cy - keep, name).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.boat, name).toBeGreaterThanOrEqual(24);
      // the deck: the pill, the lanterns, the ladder (and its words) inside the band, none of them on the sea
      const s = L.lanterns.s, r = 4.6 * u, ly = L.ladder.y - r - 8 * u;
      const boxes = {
        pill: { x0: L.goal.x, y0: L.goal.y, x1: L.goal.x + L.goal.w, y1: L.goal.y + L.goal.h },
        lanterns: { x0: L.lanterns.x + s * 0.1, y0: L.lanterns.y - s * 1.3, x1: L.lanterns.x + s * 5.7, y1: L.lanterns.y + s * 0.82 },
        ladder: { x0: L.ladder.x - 2 * r - 7 * 12 * u, y0: L.ladder.y - 1.25 * r, x1: L.ladder.x, y1: L.ladder.y + 1.25 * r },
        ...(L.ladder.label >= 40 ? { words: { x0: L.ladder.x - L.ladder.label, y0: ly - 13 * u, x1: L.ladder.x, y1: ly + 3 } } : {}),
        card: { x0: L.card.x, y0: L.card.y, x1: L.card.x + L.card.w, y1: L.card.y + L.card.h },
      };
      for (const [what, b] of Object.entries(boxes)) {
        expect(b.x0, `${name}: ${what}`).toBeGreaterThanOrEqual(c.insets.left - 0.5);
        expect(b.x1, `${name}: ${what}`).toBeLessThanOrEqual(c.w - c.insets.right + 0.5);
        expect(b.y0, `${name}: ${what}`).toBeGreaterThanOrEqual(c.insets.top - 0.5);
        expect(b.y1, `${name}: ${what}`).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
        expect(boxDist(b, L.cx, L.cy), `${name}: ${what}`).toBeGreaterThanOrEqual(keep - 0.5);
      }
    }
  });

  it('makes the sea of an upright phone fill its width, the night\'s pill right under the HUD', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.shape, c.name).toBe('tall');
      expect(2 * L.R * SEA_PAD, c.name).toBeGreaterThan(c.w * 0.78);
      expect(L.goal.y - c.insets.top, c.name).toBeLessThanOrEqual(8);
      expect(L.goal.h, c.name).toBeGreaterThanOrEqual(40);
      // Zośka on her post at the pill's left; her bubble takes the pill's place
      expect(L.gull.x + L.gull.s * 0.5, c.name).toBeLessThanOrEqual(L.goal.x);
      expect(L.bubbleOnGoal).toBe(true);
    }
    // the smallest phone: a 360 × 366 band, the sea at least 140 px in radius (it was 115)
    const small = layout(CHECK_SIZES[0].w, CHECK_SIZES[0].h, CHECK_SIZES[0].insets);
    expect(small.R).toBeGreaterThan(140);
    // a phone on its side: the column on the left, the sea the band's height beside it
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.shape, c.name).toBe('side');
      expect(L.goal.x + L.goal.w, c.name).toBeLessThan(L.cx - L.R * SEA_PAD);
      expect(2 * L.R * SEA_PAD, c.name).toBeGreaterThan((c.h - c.insets.top - c.insets.bottom) * 0.9);
      expect(L.goal.w, c.name).toBeGreaterThanOrEqual(200);
    }
  });

  it('gives the one control it has — the opening card — a finger-sized target in the band, and none over the free sea', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      expect(auditTargets([target('story', openCardRect(L))], c.w, c.h, c.insets), c.name).toEqual([]);
      // the game as the runner plays it: the first session opens with the card; a tap anywhere closes it
      const game = latarnik.create(envAt(latarnik.freshProgress(), c, 60));
      game.resize(c.w, c.h, 2);
      game.start();
      game.update(STEP, frame(), STEP);
      game.draw();
      const ts = game.targets!();
      expect(ts.map(x => x.label), c.name).toEqual(['story']);
      expect(auditTargets(ts, c.w, c.h, c.insets), c.name).toEqual([]);
      game.pointer!({ type: 'down', x: c.w / 2, y: c.h - 1, id: 1 });   // a tap on the dock reaches the canvas's bottom edge
      game.update(STEP, frame(), 2 * STEP);
      game.draw();
      expect(game.targets!(), c.name).toEqual([]);
      game.destroy();
    }
  });

  it('never draws text under 11 px: the font helper has a floor, fitting never shrinks under it', () => {
    for (const px of [0, 3, 6.4, 8.8, 10.5, 10.99, 11, 12.3, 13, 30]) expect(pxOf(font(600, px, 'sans-serif'))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(font(600, 14.24, 'sans-serif', true))).toBe(14.2);
    const ctx = recordingContext(null, 1, null);
    const hud = new Hud(ctx);
    const slot = fitSlot();
    // a goal far too long for its room: 13 px (MIN_READ) at the least, then cut with "…"
    expect(hud.fitIn(slot, 'Wprowadź 1 flotyllę, numer po numerze', 60, 14, 650, 'sans-serif')).toBe(MIN_READ);
    expect(slot.shown.endsWith('…')).toBe(true);
    expect(hud.fitIn(slot, 'Noc', 200, 14, 650, 'sans-serif')).toBe(14);
    expect(slot.shown).toBe('Noc');
    // a secondary label may go to 11, never under
    expect(hud.fitIn(slot, 'NOC 12 · NA RATUNEK', 20, 12, 750, 'sans-serif', false, 4)).toBe(MIN_TEXT);
  });

  it('draws every word of a session at 11 px or more on the smallest phone, on its side and on a desktop; what is read to play at 13', () => {
    for (const c of [CHECK_SIZES[0], CHECK_SIZES[4], CHECK_SIZES[7]]) {
      for (const first of [true, false]) {
        const texts = new Map<string, number>();
        const progress = first ? latarnik.freshProgress() : { ...latarnik.freshProgress(), sessions: 5, lastNewSession: 5, konwoje: 2, crates: 400 };
        const env = envAt(progress, c, first ? 40 : 90);
        recording = { canvas: env.canvas, texts };
        const game = latarnik.create(env);
        recording = null;
        game.resize(c.w, c.h, 2);
        game.start();
        const sim = (game as unknown as { sim: LatarnikSim }).sim;
        const tap = tapper(sim, 3, 0.04, 0.9);
        for (let time = 0; time < (first ? 40 : 90) + 6 && !(time > 10 && sim.phase === 'done'); time += 0.05) {
          const k = sim.block?.kind === 'konwoj';
          game.update(0.05, frame({ level: k ? 0.85 : 0.3, activity: k ? 6 : -1, focused: k, calm: k ? 0.3 : 0.9 }), time);
          if (first && sim.story && time > 2) game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 1 });
          tap(time);
          game.draw();
        }
        const name = `${c.name}, ${first ? 'the first session' : 'a later one'}`;
        expect(texts.size, name).toBeGreaterThan(8);
        for (const [s, px] of texts) expect(px, `${name}: "${s}"`).toBeGreaterThanOrEqual(MIN_TEXT - 0.05);
        // what the player reads to play: Zośka's lines, the night's goal, the opening story
        const reading = [...sim.talk.said, goalTextOf(sim), CATALOGS.pl['open.text']];
        for (const [s, px] of texts) {
          if (s.length > 8 && reading.some(r => r.includes(s.replace(/…$/, '')))) expect(px, `${name}: "${s}"`).toBeGreaterThanOrEqual(MIN_READ - 0.05);
        }
        game.destroy();
      }
    }
  }, 90_000);

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['hint.tap', 'open.tap', 'how.goal', 'how.tap', 'how.tip1', 'how.tip2', 'hud.armed']) {
        expect(cat[k], `${l}.${k}`).toBeTypeOf('string');
        expect(cat[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      for (const k of ['hint.tap.keys', 'open.tap.keys', 'how.keys']) expect(cat[k], `${l}.${k}`).toMatch(KEYS);
    }
    expect(hintText('tap', true)).not.toMatch(KEYS);
    expect(hintText('tap', false)).toMatch(KEYS);
    expect(hintText('fog', false)).toBe(t('hint.fog'));
    expect(howto(true).hands.map(x => x.gesture)).toEqual(['tap']);
    expect(howto(false).hands.map(x => x.gesture)).toEqual(['tap', 'keys']);
  });
});

/** The night's goal as the pill says it. */
function goalTextOf(sim: LatarnikSim): string {
  return t(`goal.${sim.spec.kind}` as 'goal.powroty', { n: sim.spec.goal });
}
