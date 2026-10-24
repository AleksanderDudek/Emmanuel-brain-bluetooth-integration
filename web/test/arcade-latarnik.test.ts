import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import type { GameEnv } from '../src/arcade/kit/types';
import { AMBER, CRAFT_OKRUCHY, LETTERS, START_CRATES, TIPS, VILLAGE } from '../src/arcade/latarnik/content';
import { CATALOGS, bare, cap, farShips, t, unit } from '../src/arcade/latarnik/i18n';
import latarnik from '../src/arcade/latarnik/index';
import { BOTTOM, TOP, cardSlot, layout, lanternRow } from '../src/arcade/latarnik/layout';
import {
  addCrumbs, daysBetween, drawAmber, freshProgress, newChance, nextMissing, village, welcomeBonus, type LatarnikProgress,
} from '../src/arcade/latarnik/meta';
import { progressPanel } from '../src/arcade/latarnik/panel';
import { Queue } from '../src/arcade/latarnik/queue';
import { LatarnikView } from '../src/arcade/latarnik/render';
import {
  BANDS, DEG, LatarnikSim, RULES, angDiff, beginnerBonus, cargoAt, drifted, holdTarget, pickBand, planBlocks, reachFor, type Boat, type SimEvent,
} from '../src/arcade/latarnik/sim';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';

const DAY = '2026-10-23';
const STEP = 1 / 60;

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.7, ...p });

type SimOpts = { progress?: Partial<LatarnikProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

/** The session's tuning as the runner builds it: the kit's defaults, Latarnik's entry, and a beginner's on top. */
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

function makeSim(o: SimOpts = {}): LatarnikSim {
  const sim = new LatarnikSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player's session with an empty sea and no spawns: the rules one at a time. */
function quiet(o: SimOpts = {}): LatarnikSim {
  const sim = makeSim({ ...o, progress: { sessions: 5, lastNewSession: 5, ...o.progress } });
  sim.spawnT = Infinity;
  sim.boats.length = 0;
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
    lastDay: '2026-10-20', lastCrates: 120, reachDay: '2026-10-22', reachBest: 0.8, dailyDay: DAY,
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

  it('turns clockwise at 110°/s, 90°/s in the very first watch', () => {
    const sim = quiet();
    expect(sim.omega).toBeCloseTo(110 * DEG, 9);
    sim.beam = 0;
    drive(sim, 1, frame());
    expect(sim.beam / DEG).toBeCloseTo(110, 3);
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
    drive(sim, 3, frame({ level: 0.1, activity: -1 }), clock);
    expect(sim.block.kind).toBe('konwoj');
    expect(sim.reach).toBeLessThan(frozen - 0.3);
    expect(sim.reach).toBeCloseTo(reachFor(sim.L, sim.holdBonus), 2);
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

  it('starts a new watch within the session after the third lantern: "Świt", then "Nowa wachta"', () => {
    const sim = quiet();
    drive(sim, 4, frame({ level: 0.8 }));
    const L = sim.L;
    boatAt(sim, 10, 0.4);
    sim.reach = 0.6;
    aim(sim, 10);
    sim.flash();
    for (const deg of [60, 150, 240]) boatAt(sim, deg, 0.185);
    let evs = drive(sim, 0.5, frame({ level: 0.8 }));
    expect(ofType(evs, 'reef')).toHaveLength(3);
    expect(ofType(evs, 'watchEnd')[0]).toMatchObject({ watch: 1, boats: 1 });
    expect(sim.phase).toBe('watchEnd');
    const b = boatAt(sim, 0, 0.3);
    aim(sim, 0);
    sim.flash();
    expect(b.state).toBe('sea');            // no flashes during the card
    evs = drive(sim, 1.8, frame({ level: 0.8 }));
    expect(ofType(evs, 'watchStart')[0].watch).toBe(2);
    expect(sim.phase).toBe('play');
    expect(sim.lanterns).toBe(3);
    expect(sim.watchBoats).toBe(0);
    expect(sim.bestWatch).toBe(1);
    expect(sim.L).toBeGreaterThan(L);        // the brain state carries on
    // the new watch's first boat comes soon, just ahead of the beam and within the reach
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
        expect(ofType(warm, 'watchEnd')).toHaveLength(0);
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
    expect(sim.p.stars).toBe(1);
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
  it('builds the village in 8 steps of 150 crates, the first half-built for the calibration', () => {
    expect(VILLAGE).toHaveLength(8);
    expect(VILLAGE.every(s => s.cost === 150)).toBe(true);
    expect(freshProgress().crates).toBe(START_CRATES);
    expect(village(START_CRATES)).toMatchObject({ built: 0, have: 75, need: 150 });
    expect(village(150)).toMatchObject({ built: 1, have: 0 });
    expect(village(1199).built).toBe(7);
    expect(village(1200)).toMatchObject({ built: 8, next: null });
    const sim = quiet({ progress: { crates: 149 } });
    boatAt(sim, 10, 0.3);
    aim(sim, 10);
    sim.flash();
    expect(ofType(sim.take(), 'built')[0].step).toBe(0);
  });

  it('gives a small welcome back from the smokehouse after two days away', () => {
    const p = { ...freshProgress(), crates: 500, lastDay: '2026-10-20', lastCrates: 200 };
    expect(welcomeBonus(p, DAY)).toBe(30);
    expect(welcomeBonus({ ...p, lastDay: '2026-10-22' }, DAY)).toBe(0);    // only one day away
    expect(welcomeBonus({ ...p, crates: 400 }, DAY)).toBe(0);              // no smokehouse yet
    expect(welcomeBonus({ ...p, lastCrates: 1000 }, DAY)).toBe(40);
    const sim = makeSim({ progress: { sessions: 4, crates: 500, lastDay: '2026-10-20', lastCrates: 200 } });
    expect(sim.p.crates).toBe(530);
    expect(sim.crates).toBe(0);                                             // not this session's catch
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
    const p = { ...freshProgress(), boats: 1, bestWatch: 3, amber: [9, 10, 11, 0], letters: 4 };
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
    expect(units.slice(0, 2)).toEqual(['łódź', 'łodzie']);
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
      for (const [k, v] of Object.entries(cat)) expect(JSON.stringify(v), `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/);
    }
    expect(same).toEqual({
      en: ['pct', 'hl.piece', 'panel.signed', 'panel.tile'],
      de: ['stat.contrast', 'hl.piece'],
      sv: ['stat.contrast', 'hl.piece'],
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
        for (const b of sim.boats) if (b.n >= 0 && !seen.has(b.n)) seen.set(b.n, `${b.kind} ${(b.a / DEG).toFixed(6)} ${b.r0.toFixed(6)} ${b.phase.toFixed(6)}`);
        tap?.(t);
      });
      return { seen, score: sim.score, watch: sim.watch };
    };
    const steady = night(1, 'steady'), sloppy = night(2, 'sloppy'), idle = night(3, 'idle');
    expect(steady.score).toBeGreaterThan(sloppy.score);       // three different evenings…
    expect(idle.score).toBe(0);
    expect(idle.watch).toBeGreaterThan(1);
    for (const other of [sloppy, idle]) {
      let shared = 0;
      for (const [n, boat] of other.seen) {
        if (!steady.seen.has(n)) continue;
        shared++;
        expect(boat, `boat ${n}`).toBe(steady.seen.get(n));   // …on the same night: every boat both met is the same boat
      }
      expect(shared).toBeGreaterThan(other === idle ? 25 : 50);
    }
    expect(steady.seen.size).toBeGreaterThan(60);
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
    const sim = makeSim({ progress: { sessions: 5, bestSession: 3, bestWatch: 2 }, planned: 120, seed: 2 });
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
    expect(again.omega).toBeCloseTo(RULES.firstSpeed, 9);
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

  it('puts the session\'s best moments first in the summary', () => {
    const sim = busySession();
    const { highlights } = sim.result();
    const rank = (s: string) => (/^Now.*(legendarny|epicki)/.test(s) ? 0 : s.startsWith('Port rośnie') ? 1 : s.startsWith('Rekord') ? 2
      : s.startsWith('List z butelki') ? 3 : s.startsWith('Now') ? 4 : s.startsWith('Żaglow') ? 5 : s.startsWith('Z daleka') ? 6
        : s.startsWith('Pełne światło') ? 7 : 8);
    const ranks = highlights.map(rank);
    expect(highlights).toHaveLength(5);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(highlights[0]).toMatch(/jaszczurka \(legendarny\)/);
    expect(highlights).toContain('Port rośnie: chata rybacka');
    expect(highlights.filter(h => h.startsWith('Rekord'))).toHaveLength(1);   // several records share a line
    expect(highlights).toContain('List z butelki 3/12');
    expect(highlights.some(h => h.startsWith('Wędzarnia'))).toBe(false);   // the welcome goes first when room is short
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
    // when wide the card sits under the lanterns, whose row follows the status block (about 150–170 px of it)
    const s = cardSlot(L, TOP + 175 * L.u, { x: 0, y: 0, w: 0, h: 0 });
    const nx = Math.min(Math.max(L.cx, s.x), s.x + s.w), ny = Math.min(Math.max(L.cy, s.y), s.y + s.h);
    expect(Math.hypot(nx - L.cx, ny - L.cy)).toBeGreaterThan(L.R);      // the nearest corner of the card lies off the sea
    expect(s.y + s.h).toBeLessThanOrEqual(h - BOTTOM);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x + s.w).toBeLessThanOrEqual(w);
    if (L.portrait) expect(s.y).toBeGreaterThan(lanternRow(L) + 10 * L.u);   // under the lanterns' row
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
    expect(titles).toEqual(['Gwiazda latarni', 'Cisza']);
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
    tuning,
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
    const stars = progress.stars, amber = progress.amber.length;
    game.finish!();
    game.result();
    expect(progress.stars).toBe(stars + 1);                          // the open Konwój was judged
    expect(progress.amber.length).toBe(amber + 1);                   // and the pity piece came at the settling
    expect(progress.sessions).toBe(4);
    game.draw();                                                     // nothing left to animate, nothing breaks
  });
});
