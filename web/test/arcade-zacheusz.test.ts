import { describe, expect, it } from 'vitest';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import zacheusz from '../src/arcade/zacheusz/index';
import { DOCK_ROW, EDGE, NEED_U, buttonRect, layout, melaBehind } from '../src/arcade/zacheusz/layout';
import { font } from '../src/arcade/zacheusz/paint';
import { SAY } from '../src/arcade/zacheusz/companion';
import { HOMES, LEVELS, MISSIONS, TIPS, specialsOf } from '../src/arcade/zacheusz/content';
import { Hero, type HeroEvent } from '../src/arcade/zacheusz/hero';
import { CATALOGS, t, unit, type Key } from '../src/arcade/zacheusz/i18n';
import {
  bestOf, finishLevel, freshProgress, homesRestored, migrate, nextLevel, startLevel, starsFor, toNextHome, turnPages, unlocked,
  type ZacheuszProgress,
} from '../src/arcade/zacheusz/meta';
import { RULES } from '../src/arcade/zacheusz/rules';
import { ZacheuszSim, bandFor, figsFor, planBlocks, reachFor, type SimEvent } from '../src/arcade/zacheusz/sim';
import { World } from '../src/arcade/zacheusz/world';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const FOCUSED = frame({ activity: 6, level: 0.85, focused: true, hold: 8, calm: 0 });
const CALM = frame({ activity: -2, level: 0.1, focused: false, hold: 0, calm: 0.9 });
const LOST = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<ZacheuszProgress>; planned?: number; seed?: number; eeg?: boolean };

function makeSim(o: SimOpts = {}): ZacheuszSim {
  const sim = new ZacheuszSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player: no warm-up, no opening card, the day's gift taken, controls taught. */
const later = (o: SimOpts = {}) => makeSim({
  ...o, progress: { sessions: 5, giftDay: DAY, opened: true, pushes: 1, taught: ['tap', 'hold', 'goose', 'pause', 'wall', 'awning', 'back', 'dash', 'bubble', 'special', 'road', 'orchard'], ...o.progress },
});

function drive(sim: ZacheuszSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: sim.t }, each?: (t: number) => void): SimEvent[] {
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

/** The smoke test's hand: a quick tap every 0.65 s, Space every ~2 s. */
const smokeHand = (sim: ZacheuszSim) => {
  let acc = 0, n = 0;
  return () => {
    if ((acc += STEP) >= 0.65) {
      acc -= 0.65;
      sim.press();
      sim.release();
      if (n++ % 3 === 0) { sim.key(' ', true); sim.key(' ', false); }
    }
  };
};

/** A world with only flat street (no level items). */
function flatWorld(): World {
  return new World({ index: 0, world: 0, len: 200, finishX: 190, finish: 'palm', items: [], target: 1 }, 0);
}

function stepHero(h: Hero, w: World, sec: number, each?: (t: number) => void): void {
  const n = Math.round(sec / RULES.step);
  for (let i = 0; i < n; i++) {
    h.step(RULES.step, w);
    each?.(i * RULES.step);
  }
}

// ── the blocks ─────────────────────────────────────────────────────
describe('Zacheusz: the blocks', () => {
  it('fill the planned time, warm-up first in a first-ever session', () => {
    for (const planned of [40, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(3));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(Math.abs(sum - planned)).toBeLessThan(planned <= 60 ? 1e-6 : RULES.minBlock);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        for (const b of plan.slice(first ? 1 : 0)) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      }
    }
  });

  it('alternate push and rest, 20–30 s each in a 5-minute session', () => {
    const plan = planBlocks(300, false, mulberry32(9));
    plan.forEach((b, i) => {
      expect(b.kind).toBe(i % 2 ? 'rest' : 'push');
      expect(b.dur).toBeGreaterThan(17);
      expect(b.dur).toBeLessThan(31);
    });
  });

  it('every 4th push is blind from the 3rd session', () => {
    const sim = later({ progress: { sessions: 4, pushes: 3 }, planned: 600 });
    drive(sim, 600, frame());
    const pushes = sim.plan.filter(b => b.kind === 'push');
    expect(pushes.some(b => b.blind)).toBe(true);
    expect(pushes[0].blind).toBe(false);
  });

  it('signal() names the block, its seconds left and the next one during the telegraph', () => {
    const sim = later();
    drive(sim, 2, frame());
    const s = sim.signal();
    expect(s.want).toBe('focus');
    expect(s.left).toBeGreaterThan(sim.block.dur - 3);
    expect(s.next).toBeNull();
    drive(sim, sim.block.dur - 2 - 2, frame());
    expect(sim.signal().next).toBe('rest');
    expect(sim.signal().task).toBeTruthy();
  });

  it('judges each block once at its end and keeps the contrast', () => {
    const sim = later({ planned: 180 });
    const clock = { t: sim.t };
    const evs = drive(sim, 180, () => (sim.block.kind === 'push' ? FOCUSED : CALM), clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBe(sim.plan.length);
    expect(ends.filter(e => e.block.kind === 'push').every(e => e.verdict === true)).toBe(true);
    expect(ofType(evs, 'pushPass').length).toBeGreaterThan(0);
  });

  it('an unreliable signal gives no verdict and freezes the road', () => {
    const sim = later();
    const evs = drive(sim, 26, LOST);
    expect(ofType(evs, 'plank').length).toBe(0);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBeNull();
    expect(sim.meter()).toBeNull();
  });
});

// ── the levels ─────────────────────────────────────────────────────
describe('Zacheusz: the levels', () => {
  it('three worlds of four, each ending at the sycamore', () => {
    expect(LEVELS.length).toBe(RULES.worlds * RULES.perWorld);
    LEVELS.forEach((lv, i) => {
      expect(lv.index).toBe(i);
      expect(lv.world).toBe(Math.floor(i / 4));
      expect(lv.finish).toBe(i % 4 === 3 ? 'sycamore' : 'palm');
    });
  });

  it('take 30–90 s of plain running, with five specials in each of three sets', () => {
    for (const lv of LEVELS) {
      const sec = lv.finishX / RULES.run;
      expect(sec, `level ${lv.index}`).toBeGreaterThan(28);
      expect(sec, `level ${lv.index}`).toBeLessThan(90);
      for (let tier = 0; tier < 3; tier++) {
        const sp = specialsOf(lv, tier);
        expect(sp.length, `level ${lv.index} tier ${tier}`).toBe(RULES.specials);
        for (const s of sp) {
          expect(s.x).toBeGreaterThan(0);
          expect(s.x).toBeLessThan(lv.finishX);
          expect(s.y).toBeLessThan(5.8);
        }
      }
      expect(lv.target).toBeGreaterThan(10);
    }
  });

  it('no wall is too tall for the leg-up and a mantle', () => {
    const reach = RULES.legUpV ** 2 / (2 * RULES.g) + RULES.mantle;
    for (const lv of LEVELS) for (const it of lv.items) if (it.t === 'box' && it.k !== 'trunk') expect(it.h).toBeLessThanOrEqual(reach);
  });

  it('every level can be finished by the smoke test’s hand (no soft-lock)', () => {
    for (const lv of LEVELS) {
      const sim = later({ progress: { pick: lv.index, levels: freshProgress().levels.map(() => ({ done: true, stars: 1, tier: 0, got: 0, coins: 0 })) }, planned: 600 });
      expect(sim.levelIndex).toBe(lv.index);
      const hand = smokeHand(sim);
      let done = false;
      const clock = { t: sim.t };
      for (let k = 0; k < 160 && !done; k++) {
        const evs = drive(sim, 1, frame(), clock, hand);
        if (ofType(evs, 'levelDone').length) done = true;
      }
      expect(done, `level ${lv.index} (${sim.hero.x.toFixed(1)} of ${lv.finishX})`).toBe(true);
    }
  });
});

// ── the hands (hero.ts) ────────────────────────────────────────────
describe('Zacheusz: the jump and its friends', () => {
  const run = (setup: (h: Hero, w: World, evs: HeroEvent[]) => void, sec: number, each?: (h: Hero, w: World, t: number) => void) => {
    const evs: HeroEvent[] = [];
    const h = new Hero(e => evs.push(e));
    const w = flatWorld();
    h.place(2, 0, RULES.run);
    setup(h, w, evs);
    stepHero(h, w, sec, tt => each?.(h, w, tt));
    return { h, w, evs };
  };

  it('a tap jumps ≈ 1.3 u, a held press ≈ 2.8 u', () => {
    let peak = 0;
    run((h, w) => { h.press(w); h.release(); }, 1, h => { peak = Math.max(peak, h.y); });
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan(1.6);
    peak = 0;
    run((h, w) => h.press(w), 1.2, h => { peak = Math.max(peak, h.y); });
    expect(peak).toBeGreaterThan(2.5);
    expect(peak).toBeLessThan(3.2);
  });

  it('a tap just before landing still jumps (buffer), and a spin is once a flight', () => {
    const { evs } = run((h, w) => { h.press(w); h.release(); }, 1.3, (h, w, tt) => {
      if (Math.abs(tt - 0.25) < 1e-6) { h.press(w); h.release(); }
      if (Math.abs(tt - 0.3) < 1e-6) { h.press(w); h.release(); }
    });
    expect(evs.filter(e => e.type === 'spin').length).toBe(1);
  });

  it('kicks off a wall in the air, and repeated taps climb it', () => {
    const evs: HeroEvent[] = [];
    const h = new Hero(e => evs.push(e));
    const w = flatWorld();
    w.solids.push({ x0: 5, x1: 6, top: 2.9, bottom: 0, kind: 'wall', seed: 1 });
    h.place(3.5, 0, RULES.run);
    h.press(w);
    h.release();
    let top = false;
    stepHero(h, w, 3, () => {
      if (h.sliding || (h.wall && !h.ground)) { h.press(w); h.release(); }
      if (h.y >= 2.9 - 1e-6 && h.x > 5) top = true;
    });
    expect(evs.some(e => e.type === 'wallJump')).toBe(true);
    expect(top).toBe(true);
  });

  it('pressed against a wall on the street, a neighbour gives a leg-up', () => {
    const evs: HeroEvent[] = [];
    const h = new Hero(e => evs.push(e));
    const w = flatWorld();
    w.solids.push({ x0: 5, x1: 6, top: 2.9, bottom: 0, kind: 'wall', seed: 1 });
    h.place(4, 0, RULES.run);
    stepHero(h, w, 4);
    expect(evs.some(e => e.type === 'legUp')).toBe(true);
    expect(h.x).toBeGreaterThan(5);
  });

  it('vaults a goose on the ground, bonks it from above (1, 2, 4 in a row)', () => {
    const sim = later({ planned: 120 });
    const w = sim.world;
    w.critters.length = 0;
    w.critters.push({ id: 900, kind: 'goose', x: sim.hero.x + 2, y: 0, home: sim.hero.x + 2, dir: -1, state: 'idle', t: 0, vaulted: false, spin: 0 });
    const evs = drive(sim, 1, frame());
    expect(ofType(evs, 'vault').length).toBe(1);
    // three goats along the air path on a flat street: a bonk chain pays 1, 2, 4
    sim.world = flatWorld();
    const h = sim.hero;
    h.place(2, 2.5, RULES.run);
    h.ground = false;
    for (const dx of [1.5, 4.4, 7.3]) sim.world.critters.push({ id: 950 + dx, kind: 'goat', x: 2 + dx, y: 0, home: 2 + dx, dir: -1, state: 'idle', t: 0, vaulted: true, spin: 0 });
    const bonks = ofType(drive(sim, 2, frame()), 'bonk');
    expect(bonks.map(b => b.pay)).toEqual([1, 2, 4]);
  });

  it('the pause stone stops him until a tap', () => {
    const evs: HeroEvent[] = [];
    const h = new Hero(e => evs.push(e));
    const w = flatWorld();
    w.tiles.push({ x0: 4, x1: 5.2, y: 0, kind: 'pause', used: false, glow: 0 });
    h.place(2, 0, RULES.run);
    stepHero(h, w, 2);
    expect(h.pauseT).toBeGreaterThan(1);
    const x = h.x;
    stepHero(h, w, 1);
    expect(h.x).toBeCloseTo(x, 5);
    h.press(w);
    h.release();
    stepHero(h, w, 1);
    expect(h.x).toBeGreaterThan(x + 2);
  });

  it('the ◀ stone runs him back, the ▶ stone dashes and a tap on it is a long jump', () => {
    const evs: HeroEvent[] = [];
    const h = new Hero(e => evs.push(e));
    const w = flatWorld();
    w.tiles.push({ x0: 4, x1: 5.2, y: 0, kind: 'back', used: false, glow: 0 });
    h.place(2, 0, RULES.run);
    let minVx = 0;
    stepHero(h, w, 2.5, () => { minVx = Math.min(minVx, h.vx); });
    expect(minVx).toBeLessThan(-3);
    expect(h.dir).toBe(1);
    const evs2: HeroEvent[] = [];
    const h2 = new Hero(e => evs2.push(e));
    const w2 = flatWorld();
    w2.tiles.push({ x0: 4, x1: 6, y: 0, kind: 'dash', used: false, glow: 0 });
    h2.place(2, 0, RULES.run);
    stepHero(h2, w2, 0.48);
    expect(h2.dashT).toBeGreaterThan(0);
    h2.press(w2);
    h2.release();
    stepHero(h2, w2, 0.05);
    expect(evs2.some(e => e.type === 'longJump')).toBe(true);
  });
});

// ── falls ──────────────────────────────────────────────────────────
describe('Zacheusz: the bubble and the rope', () => {
  const pitAhead = (sim: ZacheuszSim) => {
    const w = sim.world, x = sim.hero.x + 3;
    w.pits.push({ x0: x, x1: x + 4, kind: 'ditch' });
    for (const s of w.solids) if (s.kind === 'ground' && s.x0 < x && s.x1 > x) {
      w.solids.push({ ...s, x0: x + 4 });
      s.x1 = x;
    }
  };

  it('a fall with a bubble floats back a few seconds and pops on a tap', () => {
    const sim = later();
    drive(sim, 3, frame());
    pitAhead(sim);
    const evs = drive(sim, 2, frame());
    const fall = ofType(evs, 'fall')[0];
    expect(fall.bubble).toBe(true);
    expect(sim.bubbles).toBe(RULES.bubbles - 1);
    expect(sim.stage).toBe('bubble');
    drive(sim, RULES.floatSec + 0.1, frame());
    sim.press();
    sim.release();
    expect(sim.stage).toBe('run');
    expect(sim.world.inPit(sim.hero.x)).toBe(false);
  });

  it('without bubbles the neighbour’s rope pulls him out on the far rim', () => {
    const sim = later();
    drive(sim, 3, frame());
    sim.bubbles = 0;
    pitAhead(sim);
    const evs = drive(sim, 4, frame());
    expect(ofType(evs, 'fall')[0].bubble).toBe(false);
    expect(ofType(evs, 'ropeEnd').length).toBe(1);
    expect(sim.stage).toBe('run');
  });

  it('the bubble button rewinds on purpose, while bubbles last', () => {
    const sim = later();
    drive(sim, 4, frame());
    const x = sim.hero.x;
    expect(sim.bubbleNow()).toBe(true);
    drive(sim, RULES.floatSec + RULES.autoPop + 0.1, frame());
    expect(sim.stage).toBe('run');
    expect(sim.hero.x).toBeLessThan(x);
    sim.bubbles = 0;
    expect(sim.bubbleNow()).toBe(false);
  });

  it('a special left behind with a bubble in hand points at the button, once a session, until it is used', () => {
    const sim = later();
    sim.world = flatWorld();
    sim.world.specials.push({ x: 8, y: 2.6, i: 0, taken: false, t: 0 }, { x: 30, y: 2.6, i: 1, taken: false, t: 0 });
    sim.hero.place(5, 0, RULES.run);
    const evs = drive(sim, 6, frame());
    const marks = ofType(evs, 'hint').filter(h => h.key === 'button');
    expect(marks).toHaveLength(1);
    expect(marks[0].x).toBe(8);
    // used once, never again
    expect(sim.bubbleNow()).toBe(true);
    expect(sim.p.taught.includes('button') || (sim as unknown as { taught: Set<string> }).taught.has('button')).toBe(true);
  });
});

// ── the finish ─────────────────────────────────────────────────────
describe('Zacheusz: the finish palm', () => {
  it('pays by the height grabbed', () => {
    expect(bandFor(0)).toBe(0);
    expect(bandFor(1.2)).toBe(1);
    expect(bandFor(4.3)).toBe(4);
    expect(RULES.bandPay[4]).toBeGreaterThan(RULES.bandPay[0] * 5);
  });

  it('ends a level in a tally, records it and lays the next', () => {
    const sim = later({ planned: 600 });
    sim.hero.place(sim.world.finish.x - 3, 0, RULES.run);
    const evs = drive(sim, 2.5, frame());
    const trunk = ofType(evs, 'trunk')[0];
    expect(trunk).toBeTruthy();
    const done = ofType(evs, 'levelDone')[0];
    expect(done.res.index).toBe(0);
    expect(sim.p.levels[0].done).toBe(true);
    expect(sim.p.levels[0].stars).toBeGreaterThanOrEqual(1);
    const next = ofType(drive(sim, RULES.tallySec + 0.2, frame()), 'levelStart');
    expect(next[0].index).toBe(1);
    expect(sim.hero.x).toBeLessThan(9);
  });

  it('a world’s fourth level ends at the sycamore with the world’s story card (once)', () => {
    const sim = later({ planned: 600, progress: { pick: 3, levels: freshProgress().levels.map((l, i) => ({ ...l, done: i < 3 })) } });
    sim.hero.place(sim.world.finish.x - 3, 0, RULES.run);
    const evs = drive(sim, 2.5 + RULES.tallySec + 0.2, frame());
    expect(ofType(evs, 'trunk')[0].sycamore).toBe(true);
    expect(ofType(evs, 'story')[0]).toMatchObject({ kind: 'world', world: 0 });
    expect(sim.p.worldsSeen).toBe(0);
  });
});

// ── the band ───────────────────────────────────────────────────────
describe('Zacheusz: the road of light (push)', () => {
  it('grows ahead only above the threshold, after the lead-in, with a spring onto it', () => {
    const sim = later();
    let evs = drive(sim, RULES.leadIn.fnirs - 0.5, FOCUSED);
    expect(ofType(evs, 'plank').length).toBe(0);
    evs = drive(sim, 3, FOCUSED);
    expect(ofType(evs, 'plank').length).toBeGreaterThan(3);
    expect(sim.world.springs.length).toBeGreaterThan(0);
    expect(sim.roadTip).toBeGreaterThan(sim.hero.x + reachFor(0.85) - RULES.plank - 0.5);
    expect(sim.meter()).toBeCloseTo(0.85, 2);
  });

  it('stops growing below the threshold (the planks laid stay)', () => {
    const sim = later();
    drive(sim, 8, FOCUSED);
    const tip = sim.roadTip;
    const evs = drive(sim, 2, frame({ level: 0.3, focused: false }));
    expect(ofType(evs, 'plank').length).toBe(0);
    expect(sim.roadTip).toBe(tip);
  });

  it('takes him up: on the road he runs faster and gathers light coins', () => {
    const sim = later();
    const hand = smokeHand(sim);
    const evs = drive(sim, 20, FOCUSED, { t: sim.t }, hand);
    expect(ofType(evs, 'spring').length).toBeGreaterThan(0);
    expect(ofType(evs, 'coin').some(c => c.light)).toBe(true);
  });

  it('a held view showers light coins (at most three a block)', () => {
    const sim = later();
    const evs = drive(sim, 24, FOCUSED);
    const views = ofType(evs, 'view');
    expect(views.length).toBeGreaterThan(0);
    expect(views.length).toBeLessThanOrEqual(RULES.viewMax);
  });

  it('a blind block builds nothing and reveals its last focus as road at its end', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 }, planned: 600 });
    drive(sim, sim.plan[0].dur + sim.plan[1].dur + 0.1, frame());
    expect(sim.block.blind).toBe(true);
    const evs = drive(sim, sim.block.dur, FOCUSED);
    const before = ofType(evs, 'blockEnd')[0];
    expect(before.block.blind).toBe(true);
    const planksBefore = evs.findIndex(e => e.type === 'blockEnd');
    expect(evs.slice(0, planksBefore).some(e => e.type === 'plank')).toBe(false);
    const rev = ofType(evs, 'reveal')[0];
    expect(rev.len).toBeGreaterThan(5);
  });
});

describe('Zacheusz: the fig orchard (rest)', () => {
  it('opens in a rest block; calm ripens the figs he picks; a full tree gives a bubble', () => {
    const sim = later({ planned: 120 });
    const push = sim.block.dur;
    let evs = drive(sim, push + 1, frame());
    expect(ofType(evs, 'orchard').length).toBe(1);
    const o = sim.world.orchards[0];
    expect(o.x1 - o.x0).toBeGreaterThan(18);
    sim.bubbles = 0;
    evs = drive(sim, sim.block.dur - 2, CALM);
    const figs = ofType(evs, 'figs');
    expect(figs.length).toBeGreaterThan(0);
    expect(sim.figs).toBeGreaterThan(0);
    expect(ofType(evs, 'orchard').length).toBe(0);
    expect(figs.some(f => f.bubble) || sim.ripe < RULES.figAt[4]).toBe(true);
  });

  it('ripeness follows calm and holds while unreliable', () => {
    expect(figsFor(0)).toBe(0);
    expect(figsFor(0.5)).toBe(3);
    expect(figsFor(1)).toBe(5);
    const sim = later({ planned: 120 });
    drive(sim, sim.block.dur + 6, CALM);
    const r = sim.ripe;
    expect(r).toBeGreaterThan(0);
    drive(sim, 3, LOST);
    expect(sim.ripe).toBe(r);
  });
});

// ── the smoke contract ─────────────────────────────────────────────
describe('Zacheusz: the smoke test and the result', () => {
  it('the smoke hand scores within 22 s and the headline accrues live', () => {
    const sim = makeSim({ planned: 40 });
    const hand = smokeHand(sim);
    const seen: number[] = [];
    drive(sim, 22, frame({ level: 0.7, focused: true, hold: 3 }), { t: sim.t }, tt => { hand(); if (Math.abs(tt % 5) < STEP) seen.push(sim.headline().value); });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.headline().value).toBe(sim.result().score);
    expect(seen.at(-1)!).toBeGreaterThan(seen[0]);
  });

  it('a first-ever session shows the opening card and coach marks', () => {
    const sim = makeSim({ planned: 300 });
    const evs = drive(sim, 12, frame(), { t: sim.t }, smokeHand(sim));
    expect(ofType(evs, 'story')[0]).toMatchObject({ kind: 'open' });
    expect(ofType(evs, 'hint').map(h => h.key)).toContain('tap');
    expect(sim.talk.said.length).toBeGreaterThan(0);
  });

  it('result() is idempotent; finish() settles once', () => {
    const sim = later({ planned: 60 });
    drive(sim, 30, frame(), { t: sim.t }, smokeHand(sim));
    const a = sim.result();
    const b = sim.result();
    expect(b).toEqual(a);
    const den = sim.p.denarii, missions = sim.p.missionsDone;
    sim.finish();
    const once = sim.p.denarii;
    sim.finish();
    expect(sim.p.denarii).toBe(once);
    expect(once).toBe(den + sim.score + (sim.p.missionsDone - missions) * RULES.missionPay);
    expect(sim.p.sessions).toBe(6);
    expect(sim.result().score).toBe(a.score);
    expect(passage(a.verse!)).toBeTruthy();
  });

  it('canStop waits for a bubble, at most a few seconds', () => {
    const sim = later({ planned: 20 });
    drive(sim, 19, frame());
    sim.bubbleNow();
    drive(sim, 1.2, frame());
    expect(sim.canStop()).toBe(false);
    drive(sim, RULES.settle, frame());
    expect(sim.canStop()).toBe(true);
  });
});

// ── the meta ───────────────────────────────────────────────────────
describe('Zacheusz: the meta', () => {
  it('levels open in turn; the pick starts a session; replays go to the fewest sets', () => {
    const p = freshProgress();
    expect(unlocked(p)).toBe(1);
    expect(startLevel(p)).toBe(0);
    finishLevel(p, 0, 50, 4, 5);
    expect(unlocked(p)).toBe(2);
    expect(p.levels[0].tier).toBe(1);
    expect(p.levels[0].stars).toBe(starsFor(50, LEVELS[0].target, 4));
    expect(nextLevel(p, 0)).toBe(1);
    p.pick = 0;
    expect(startLevel(p)).toBe(0);
    p.pick = 7;
    expect(startLevel(p)).toBe(1);
    const all = freshProgress();
    all.levels.forEach((l, i) => { l.done = true; l.tier = i === 5 ? 0 : 2; });
    expect(nextLevel(all, 11)).toBe(5);
  });

  it('a set completes only with all five in one run', () => {
    const p = freshProgress();
    finishLevel(p, 0, 10, 0, 4);
    expect(p.levels[0].tier).toBe(0);
    expect(p.levels[0].got).toBe(4);
    finishLevel(p, 0, 10, 0, 5);
    expect(p.levels[0].tier).toBe(1);
    expect(p.levels[0].got).toBe(0);
  });

  it('households are restored by the all-time denarii', () => {
    expect(homesRestored(0)).toBe(0);
    expect(homesRestored(RULES.homes[0])).toBe(1);
    expect(homesRestored(99999)).toBe(HOMES.length);
    expect(toNextHome(RULES.homes[0])!.home.index).toBe(1);
    expect(toNextHome(99999)).toBeNull();
  });

  it('missions turn their pages', () => {
    const p = freshProgress();
    const opened = turnPages(p, [p.missions[0]]);
    expect(opened.length).toBe(1);
    expect(new Set(p.missions).size).toBe(3);
    expect(MISSIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('migrates a realistic v1 save: records and sessions kept, the rest fresh', () => {
    const old = {
      v: 1, sessions: 7, denarii: 345, figs: 21, pushes: 9,
      courses: [{ done: true, tier: 2, got: 3, branch: 4 }, { done: true, tier: 0, got: 1, branch: 2 }, 'junk'],
      lastCourse: 4, missions: ['coins60', 'wall3', 'bounce5'], missionsDone: 3, missionNext: 6,
      best: { '300': 212, '600': 'x', '180': 95 }, lastLen: 300, bestBranch: 4, dailyDay: '2026-11-05', dailyCoins: 40, giftDay: '2026-11-05',
    };
    const p = migrate({ ...freshProgress(), ...(old as unknown as Partial<ZacheuszProgress>) } as ZacheuszProgress);
    expect(p.ver).toBe(2);
    expect('v' in p).toBe(false);
    expect(p.sessions).toBe(7);
    expect(p.denarii).toBe(345);
    expect(p.best).toEqual({ '300': 212, '180': 95 });
    expect(bestOf(p)).toBe(212);
    expect(p.levels.length).toBe(LEVELS.length);
    expect(p.levels.every(l => !l.done)).toBe(true);
    expect(p.missions.every(id => MISSIONS.some(m => m.id === id))).toBe(true);
    expect(p.missions.length).toBe(3);
    // a sim runs on it
    const sim = new ZacheuszSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
    expect(migrate(p)).toBe(p);
  });

  it('survives fields of the wrong type', () => {
    const p = migrate({ ver: 2, sessions: 'x', levels: 'nope', taught: [3, 'tap'], best: [], pick: 99 } as unknown as ZacheuszProgress);
    expect(p.sessions).toBe(0);
    expect(p.levels.length).toBe(LEVELS.length);
    expect(p.taught).toEqual(['tap']);
    expect(p.pick).toBe(LEVELS.length - 1);
  });
});

// ── the words ──────────────────────────────────────────────────────
describe('Zacheusz: the words', () => {
  it('the catalog is complete in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('every companion line exists and is short', () => {
    for (const [m, n] of Object.entries(SAY)) {
      expect(n).toBeGreaterThanOrEqual(3);
      for (let i = 1; i <= n; i++) {
        for (const l of ['pl', 'en', 'de', 'sv'] as const) {
          const s = CATALOGS[l][`say.${m}.${i}` as Key];
          expect(s, `${l} say.${m}.${i}`).toBeTruthy();
          expect((s as string).length, `${l} say.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('strategies never ask to concentrate harder', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!k.startsWith('tip.') && !k.startsWith('how.')) continue;
        expect(String(v)).not.toMatch(/mocniej|harder|stärker/i);
      }
    }
    expect(TIPS.push.length).toBe(5);
  });

  it('the unit bends', () => {
    expect(unit(1)).toBeTruthy();
    expect(t('denarii', { n: 5 })).toContain('5');
  });
});

// ── mobile first (DESIGN.md §12) ───────────────────────────────────
const PX = /(\d+(?:\.\d+)?)px/;
const pxOf = (f: unknown): number => Number(String(f).match(PX)?.[1] ?? 10);

/**
 * A 2D context that draws nothing: it measures text at 0.56 em a character and notes every string it is
 * asked to write at its largest size (as the mobile audit does), so the view runs in a test.
 */
function fakeCtx(texts = new Map<string, number>()): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, lineWidth: 1 };
  const grad = { addColorStop: () => undefined };
  const note = (s: unknown) => {
    const k = String(s), px = pxOf(state.font);
    if (k.trim() && (state.globalAlpha as number) > 0.05) texts.set(k, Math.max(texts.get(k) ?? 0, px));
  };
  const fns: Record<string, (...a: unknown[]) => unknown> = {
    measureText: (s: unknown) => ({ width: String(s).length * pxOf(state.font) * 0.56 }),
    fillText: note, strokeText: note,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(state, {
    get: (o, k) => (typeof k === 'string' && k in fns ? fns[k] : k in o ? o[k] : () => undefined),
    set: (o, k, v) => { o[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

const silent = new Proxy({ on: false }, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => undefined) }) as unknown as ArcadeAudio;

/** The game as the runner makes it, on a canvas that draws nothing (a finger, the insets of a CHECK_SIZES entry). */
function phoneGame(progress: Partial<ZacheuszProgress>, ins: Insets, o: { texts?: Map<string, number>; touch?: boolean; planned?: number } = {}) {
  const ctx = fakeCtx(o.texts);
  const hints: string[] = [];
  const env = {
    canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement, hud: document.createElement('div'), audio: silent,
    progress: { ...freshProgress(), ...progress }, rng: mulberry32(5), day: DAY, daySeed: 4242, plannedSec: o.planned ?? 300, tool: 'fnirs' as const,
    simulated: true, reducedMotion: false, haptics: false, tuning: TUNING,
    hint: (text: string) => { hints.push(text); }, hudTop: () => ins.top, insets: () => ins, touch: o.touch ?? true,
  } satisfies GameEnv<ZacheuszProgress>;
  const game = zacheusz.create(env);
  return { game, sim: (game as unknown as { sim: ZacheuszSim }).sim, hints };
}

const RETURNING: Partial<ZacheuszProgress> = {
  sessions: 5, giftDay: DAY, opened: true, pushes: 1,
  taught: ['tap', 'hold', 'goose', 'pause', 'wall', 'awning', 'back', 'dash', 'bubble', 'special', 'road', 'orchard'],
};

/** Play the game for `sec` seconds at 60 frames a second, drawing every frame. */
function play(game: ArcadeGame, clock: { t: number }, sec: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), each?: (i: number) => void): void {
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    game.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    each?.(i);
    game.draw();
  }
}

describe('Zacheusz: mobile first', () => {
  it('never asks for canvas text under 11 px', () => {
    for (const size of [0, 4, 8, 10.9, 11, 13, 22]) expect(pxOf(font(800, size, 'x'))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(font(600, 15, 'x', true))).toBe(15);
  });

  it('lays out every checked screen phone first: room to jump, the street ahead, the thumb’s band, the button in reach', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets);
      const phone = Math.min(s.w, s.h) <= 430;
      expect(L.u, s.name).toBeGreaterThanOrEqual(1);
      expect(L.u, s.name).toBeLessThanOrEqual(1.3);
      if (phone) expect(L.u, s.name).toBeLessThan(1.1);
      expect(L.tall, s.name).toBe(s.w < s.h);
      // the light road's lane, his height and a coin over him fit between the HUD and the street
      expect(L.gy - s.insets.top - 8, s.name).toBeGreaterThanOrEqual(NEED_U * L.S - 0.5);
      // about a second of street ahead at his pace; Zacchaeus at least ~40 px tall on a phone
      expect((s.w - s.insets.right - L.hx) / L.S / RULES.run, s.name).toBeGreaterThan(1.0);
      if (phone) expect(L.S, s.name).toBeGreaterThanOrEqual(38);
      // Mela, trotting behind him, stays on screen
      expect(L.hx - (melaBehind(L) + 0.65) * L.S, s.name).toBeGreaterThanOrEqual(s.insets.left - 1);
      // the bubble button: a finger wide, inside the safe area and the 16 px edges, clear of the dock's row
      const b = buttonRect(L);
      expect(auditTargets([{ label: 'bubble', ...b }], s.w, s.h, s.insets), s.name).toEqual([]);
      expect(Math.min(b.w, b.h), s.name).toBeGreaterThanOrEqual(56);
      expect(b.x, s.name).toBeGreaterThanOrEqual(s.insets.left + EDGE - 0.5);
      expect(b.x + b.w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - EDGE + 0.5);
      expect(b.y + b.h, s.name).toBeLessThanOrEqual(s.h - DOCK_ROW);
      // upright: under the street, in the thumb zone
      if (L.tall) {
        expect(L.btn.y - L.btn.r, s.name).toBeGreaterThan(L.gy);
        expect(b.y, s.name).toBeGreaterThanOrEqual(s.h * (1 - THUMB));
        expect(s.h - s.insets.bottom - L.gy, s.name).toBeGreaterThanOrEqual(120);
      }
      // Mela's box: under the street, left of the button, room for two lines at least
      expect(L.talk.y, s.name).toBeGreaterThan(L.gy);
      expect(L.talk.y + L.talk.h, s.name).toBeLessThanOrEqual(s.h - s.insets.bottom);
      expect(L.talk.x, s.name).toBeGreaterThanOrEqual(s.insets.left + EDGE);
      expect(L.talk.x + L.talk.w, s.name).toBeLessThanOrEqual(b.x);
      expect(L.talk.h, s.name).toBeGreaterThanOrEqual(2 * 18 + 8);
    }
  });

  it('reports the bubble button while he runs and a card once it takes a tap, finger-sized and in the safe area, at every checked size', () => {
    for (const s of CHECK_SIZES) {
      // running: the button only
      const run = phoneGame(RETURNING, s.insets);
      run.game.resize(s.w, s.h, 2);
      run.game.start();
      const clock = { t: 0 };
      play(run.game, clock, 0.5);
      let tg = run.game.targets!();
      expect(tg.map(x => x.label), s.name).toEqual(['bubble button']);
      expect(auditTargets(tg, s.w, s.h, s.insets), s.name).toEqual([]);
      // the tally at the finish palm: the card, the button gone under it
      run.sim.hero.place(run.sim.world.finish.x - 3, 0, RULES.run);
      play(run.game, clock, 2.6);
      expect(run.sim.stage, s.name).toBe('tally');
      play(run.game, clock, 1.3);
      tg = run.game.targets!();
      expect(tg.map(x => x.label), s.name).toEqual(['tally card']);
      expect(auditTargets(tg, s.w, s.h, s.insets), `${s.name}: tally`).toEqual([]);
      expect(Math.min(tg[0].w, tg[0].h), s.name).toBeGreaterThanOrEqual(MIN_TAP);
      // the opening story card of a first session
      const first = phoneGame({ giftDay: DAY }, s.insets);
      first.game.resize(s.w, s.h, 2);
      first.game.start();
      play(first.game, { t: 0 }, 0.6);
      expect(first.sim.stage, s.name).toBe('story');
      expect(first.game.targets!(), s.name).toEqual([]);
      play(first.game, { t: 0.6 }, 0.8);
      tg = first.game.targets!();
      expect(tg.map(x => x.label), s.name).toEqual(['story card']);
      expect(auditTargets(tg, s.w, s.h, s.insets), `${s.name}: story`).toEqual([]);
      // a tap on it goes on, and the button is back
      first.game.pointer!({ type: 'down', x: tg[0].x + tg[0].w / 2, y: tg[0].y + tg[0].h / 2, id: 1 });
      first.game.pointer!({ type: 'up', x: tg[0].x + tg[0].w / 2, y: tg[0].y + tg[0].h / 2, id: 1 });
      expect(first.sim.stage, s.name).toBe('run');
      expect(first.game.targets!().map(x => x.label), s.name).toEqual(['bubble button']);
    }
  });

  it('a press on the bubble button rewinds while bubbles last, and is a jump when it cannot rewind (never swallowed)', () => {
    const s = CHECK_SIZES[0];
    const { game, sim } = phoneGame(RETURNING, s.insets);
    game.resize(s.w, s.h, 3);
    game.start();
    sim.world = flatWorld();
    sim.hero.place(5, 0, RULES.run);
    const clock = { t: 0 };
    play(game, clock, 1.5);
    const b = buttonRect(layout(s.w, s.h, s.insets));
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const had = sim.bubbles;
    expect(had).toBeGreaterThan(0);
    game.pointer!({ type: 'down', x: cx, y: cy, id: 1 });
    game.pointer!({ type: 'up', x: cx, y: cy, id: 1 });
    expect(sim.stage).toBe('bubble');
    expect(sim.bubbles).toBe(had - 1);
    // in the bubble the button is not a target; a tap anywhere pops it
    expect(game.targets!()).toEqual([]);
    play(game, clock, RULES.floatSec + RULES.autoPop + 0.2);
    expect(sim.stage).toBe('run');
    // no bubbles left: the same press jumps
    sim.bubbles = 0;
    play(game, clock, 0.6);
    expect(sim.hero.ground).toBe(true);
    game.pointer!({ type: 'down', x: cx, y: cy, id: 2 });
    play(game, clock, 0.05);
    expect(sim.hero.ground).toBe(false);
    expect(sim.stage).toBe('run');
    game.pointer!({ type: 'up', x: cx, y: cy, id: 2 });
    // a touch on the signal dock plays at the canvas's last row: a jump, never the button
    play(game, clock, 1);
    sim.bubbles = 2;
    game.pointer!({ type: 'down', x: cx, y: s.h - 1, id: 3 });
    expect(sim.stage).toBe('run');
    expect(sim.bubbles).toBe(2);
    game.pointer!({ type: 'up', x: cx, y: s.h - 1, id: 3 });
  });

  it('draws no play text under 13 px on the smallest phone (cards, Mela, the strip, the button, words over the street)', () => {
    const texts = new Map<string, number>();
    const s = CHECK_SIZES[0];
    // a first session: the opening card, Mela's first lines, the coach marks, a level's tally
    const { game, sim } = phoneGame({ giftDay: DAY }, s.insets, { texts, planned: 120 });
    game.resize(s.w, s.h, 3);
    game.start();
    const clock = { t: 0 };
    let tapped = 0;
    play(game, clock, 70, tt => (sim.signal().want === 'focus' ? FOCUSED : tt > 40 ? CALM : frame({ level: 0.6 })), i => {
      if (i % 30 === 0) game.pointer!({ type: 'down', x: 200, y: 300, id: 1 });
      if (i % 30 === 9) game.pointer!({ type: 'up', x: 200, y: 300, id: 1 });
      if (i === 60 * 20 && !tapped++) sim.hero.place(sim.world.finish.x - 3, 0, RULES.run);
    });
    // the band's delay tag over the skyline is a secondary label (12 px); everything else reads at 13+
    const small = [...texts].filter(([k, px]) => px < MIN_READ && !k.startsWith('≈'));
    expect(small).toEqual([]);
    expect([...texts].filter(([, px]) => px < MIN_TEXT)).toEqual([]);
    expect(texts.size).toBeGreaterThan(15);
    // Mela spoke, the opening card and a tally showed
    expect(sim.talk.said.length).toBeGreaterThan(0);
    expect(texts.has(t('story.tap'))).toBe(true);
    expect(texts.has(t('tally.tap'))).toBe(true);
    expect(texts.has(`${t('mela')}:`)).toBe(true);
  });

  it('speaks to a finger: the how-to and the coach marks name keys only on a desktop', () => {
    const how = zacheusz.howto!();
    expect(how.hands.map(h => h.gesture)).toEqual(['tap', 'hold', 'tap', 'keys']);
    const KEYS = /Spac|Space|Leertaste|mellanslag|↑|←|WASD|klaw|Taste|tangent|\bkey|klik|click|mysz|mouse|Maus|\bmus\b/i;
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[lang] as Record<string, unknown>;
      for (const k of Object.keys(cat)) {
        if (k.endsWith('.keys') || !/^(how|hint|say|story|tally|panel)\./.test(k)) continue;
        expect(String(cat[k]), `${lang} ${k}`).not.toMatch(KEYS);
      }
      expect(String(cat['how.keys']), lang).toMatch(/↑/);
      expect(String(cat['hint.tap.keys']), lang).toMatch(/Spac|Space|Leertaste|mellanslag/i);
    }
    // the coach marks: a finger's words on a phone, the keys named on a desktop
    for (const touch of [true, false]) {
      const { game, hints } = phoneGame({ giftDay: DAY, opened: true }, CHECK_SIZES[touch ? 0 : 7].insets, { touch });
      game.resize(touch ? 360 : 1280, touch ? 500 : 672, 2);
      game.start();
      play(game, { t: 0 }, 3);
      expect(hints, String(touch)).toContain(t(touch ? 'hint.tap' : 'hint.tap.keys'));
      if (touch) for (const h of hints) expect(h).not.toMatch(/Spac|↑|←/);
    }
  });
});
