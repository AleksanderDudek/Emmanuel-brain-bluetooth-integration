import { describe, expect, it } from 'vitest';
import { SAY, lineSec, speakerOf } from '../src/arcade/dolina/companion';
import {
  COMPS, ERAS, GEAR, KEEPERS, MISSIONS, SEQ, TRIALS, UPGRADES, compName, compText, eraName, eraOfLevel, guardLevel, missionText, powerName, powerOf, weaponName,
} from '../src/arcade/dolina/content';
import { Hud, weaponLabel } from '../src/arcade/dolina/hud';
import { CATALOGS, t } from '../src/arcade/dolina/i18n';
import dolina, { SWIPE, UNDO_SEC } from '../src/arcade/dolina/index';
import { EDGE, ROOM, layout } from '../src/arcade/dolina/layout';
import { font } from '../src/arcade/dolina/paint';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, auditTargets } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import {
  addGear, applyChest, bestOf, bondLevel, buyUp, clockTime, completeMission, freshProgress, lookOf, migrate, nightOf, partyFor, rollChest, setStars,
  slotsFor, starTotal, starsOf, strengthOf, toggleParty, upLevel, upPrice, type DolinaProgress,
} from '../src/arcade/dolina/meta';
import { floorKind, keeperFloor, towerPlan } from '../src/arcade/dolina/plan';
import { RULES } from '../src/arcade/dolina/rules';
import {
  DolinaSim, LAMP_MARK, WARM_PLAN, answerFor, chargeRate, comboMult, cooldownFor, finaleFor, harmFor, harmWith, hukFor, lampFor, ledgeFor, pendAt,
  planBlocks, stagePlan, starsFor, stepsFor, stoneHp, strikeGapFor,
  type SimEvent, type Stone,
} from '../src/arcade/dolina/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 0, calm: 0.4 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<DolinaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): DolinaSim {
  const sim = new DolinaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no day's gift, everything already explained). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, pushes: 1, seen: ['tide', 'meadow', 'guard', 'open', 'fog', 'dawn', 'stairs'], ...o.progress } });

function drive(sim: DolinaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

type Inner = { genOn: boolean; roadX: number; tideOn: boolean; tideX: number };
const inner = (sim: DolinaSim) => sim as unknown as Inner;

/** A flat empty road from here on, nothing laid, no tide (the rules one at a time). */
function flatRoad(sim: DolinaSim, y = 0): void {
  inner(sim).genOn = false;
  inner(sim).tideOn = false;
  sim.segs.length = 0;
  sim.segs.push({ x0: sim.px - 30, x1: sim.px + 400, y, kind: 'road' });
  sim.stonesOnRoad.length = 0;
  sim.gates.length = 0;
  sim.shadows.length = 0;
  sim.shots.length = 0;
  sim.walls.length = 0;
  sim.steps.length = 0;
  sim.py = y;
  sim.vy = 0;
  sim.grounded = true;
  sim.floorY = y;
  sim.exitX = Infinity;
}

const stone = (sim: DolinaSim, x: number, o: Partial<Stone> = {}): Stone => {
  const s: Stone = { id: 900 + sim.stonesOnRoad.length, x, y: 0, w: RULES.blockW, h: RULES.blockH[0], hp: 6, max: 6, stones: 2, tall: false, pen: false, alive: true, hitT: 0, lit: false, level: 1, ...o };
  sim.stonesOnRoad.push(s);
  return s;
};

/** Settle into a push block well past its lead-in (a returning player's first block is a push). */
function intoPush(sim: DolinaSim, clock = { t: 0 }, f: FocusFrame = LOW): SimEvent[] {
  return drive(sim, sim.leadIn + 0.5, f, clock);
}

describe('Dolina: the blocks', () => {
  it('plans a warm-up for the first session and push/rest pairs that end on time', () => {
    for (const sec of [180, 300, 600]) {
      const plan = planBlocks(sec, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const total = plan.reduce((s, b) => s + b.dur, 0) + finaleFor(sec);
      expect(total).toBeCloseTo(sec, 5);
      for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      expect(plan[plan.length - 1].kind).toBe('rest');
    }
    const later = planBlocks(300, false, mulberry32(3));
    expect(later[0].kind).toBe('push');
    expect(later.filter(b => b.kind === 'push').length).toBe(later.filter(b => b.kind === 'rest').length);
  });

  it('fits a 40 s test session (and anything from 10 s)', () => {
    for (const sec of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const plan = planBlocks(sec, first, mulberry32(2));
        expect(plan.length).toBeGreaterThanOrEqual(2);
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('judges each block once at its end, with the session’s tuning', () => {
    const sim = later({ planned: 300 });
    const evs = drive(sim, 120, () => (sim.block.kind === 'push' ? HIGH : CALM));
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBeGreaterThanOrEqual(3);
    for (const e of ends) expect(e.verdict).toBe(true);
    expect(ofType(evs, 'pushPass').length).toBeGreaterThan(0);
    expect(ofType(evs, 'restPass').length).toBeGreaterThan(0);
    void sim;
    const beginner = later({ tuning: BEGINNER });
    expect(beginner.plan.length).toBeGreaterThan(0);
  });

  it('gives no verdict without signal, and never a loss', () => {
    const sim = later({ planned: 120 });
    const evs = drive(sim, 60, NONE);
    for (const e of ofType(evs, 'blockEnd')) expect(e.verdict).toBeNull();
    expect(sim.meter()).toBeNull();
    expect(sim.lampLook === 'grey' || sim.lampLook === 'flame').toBe(true);
  });

  it('makes every 4th push block blind from the 3rd session, revealing a flash at its end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const evs = drive(sim, 200, () => (sim.block.kind === 'push' ? HIGH : CALM));
    const blind = ofType(evs, 'blockStart').filter(e => e.block.blind);
    expect(blind.length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'flash').length).toBeGreaterThanOrEqual(1);
    expect(sim.blindShare).toBeGreaterThanOrEqual(0);
  });

  it('telegraphs the next block and reports seconds left and what comes next', () => {
    const sim = later({ planned: 300 });
    const evs = drive(sim, sim.block.dur - 2, LOW);
    const tel = ofType(evs, 'telegraph');
    expect(tel).toHaveLength(1);
    expect(tel[0].next?.kind).toBe('rest');
    expect(sim.block.dur - sim.blockT).toBeCloseTo(2, 1);
  });
});

describe('Dolina: the jump and the double jump', () => {
  it('jumps about 1.7 u with one jump and about 3 u with both', () => {
    const sim = later();
    flatRoad(sim);
    sim.press();
    let top = 0;
    drive(sim, 0.8, LOW, { t: 0 }, () => { top = Math.max(top, sim.py); });
    expect(top).toBeGreaterThan(1.55);
    expect(top).toBeLessThan(1.8);
    expect(sim.grounded).toBe(true);
    // both: the second press at the apex
    sim.press();
    let top2 = 0;
    drive(sim, 0.32, LOW, { t: 1 }, () => { top2 = Math.max(top2, sim.py); });
    sim.press();
    drive(sim, 1.2, LOW, { t: 2 }, () => { top2 = Math.max(top2, sim.py); });
    expect(top2).toBeGreaterThan(2.85);
    expect(top2).toBeLessThan(3.15);
    expect(sim.doubles).toBe(1);
  });

  it('allows one air jump, restored on landing; a third press is remembered for the landing (buffer)', () => {
    const sim = later();
    flatRoad(sim);
    sim.press();
    drive(sim, 0.2, LOW);
    sim.press();
    expect(sim.airUsed).toBe(1);
    const vy = sim.vy;
    // no third jump in the air
    drive(sim, 0.05, LOW);
    sim.press();
    expect(sim.vy).toBeLessThan(vy);
    // land, the buffered press jumps at once if it was close enough to the ground
    const evs: SimEvent[] = [];
    let landed = false;
    for (let i = 0; i < 200 && !landed; i++) {
      sim.update(STEP, LOW, 3 + i * STEP);
      for (const e of sim.take()) { evs.push(e); if (e.type === 'land') landed = true; }
      // press just before landing
      if (!landed && sim.vy < 0 && sim.py < 0.4 && sim.py > 0.05 && !evs.some(e => e.type === 'jump' && e.air === false && e.y === 0)) sim.press();
    }
    expect(landed).toBe(true);
    expect(sim.airUsed).toBe(0);
    expect(sim.grounded).toBe(false);   // the buffered jump went off on landing
  });

  it('cuts the jump short when the press lets go early (variable height)', () => {
    const sim = later();
    flatRoad(sim);
    sim.press();
    drive(sim, 0.06, LOW);
    sim.releasePress();
    let top = 0;
    drive(sim, 0.8, LOW, { t: 0 }, () => { top = Math.max(top, sim.py); });
    expect(top).toBeLessThan(1.0);
    expect(top).toBeGreaterThan(0.3);
  });

  it('forgives a late jump just after an edge (coyote time) and keeps the double jump', () => {
    const sim = later();
    flatRoad(sim);
    sim.segs[0].x1 = sim.px + 0.4;
    sim.segs.push({ x0: sim.px + 6, x1: sim.px + 300, y: 0, kind: 'road' });
    let left = false;
    for (let i = 0; i < 120 && !left; i++) {
      sim.update(STEP, LOW, i * STEP);
      sim.take();
      if (!sim.grounded) left = true;
    }
    expect(left).toBe(true);
    sim.update(0.05, LOW, 3);
    sim.press();
    expect(sim.vy).toBeCloseTo(RULES.jumpV, 5);
    expect(sim.airUsed).toBe(0);
  });

  it('stomps a shadow from above and gets the double jump back', () => {
    const sim = later();
    flatRoad(sim);
    drive(sim, 1, LOW);
    sim.shadows.push({ id: 77, kind: 'glinianek', x: sim.px + 3.1, y: 0, r: 0.32, h: 0.95, hp: 5, max: 5, state: 'walk', age: 0, hitT: 0, stun: 99, inLight: false, burn: 0, throwT: 9, bob: 0 });
    sim.press();
    sim.airUsed = 1;   // as if the double jump were spent
    const evs = drive(sim, 1, LOW);
    expect(sim.airUsed).toBe(0);
    const st = ofType(evs, 'stomp');
    expect(st.length).toBe(1);
    expect(ofType(evs, 'kill')[0].via).toBe('stomp');
    expect(sim.stomps).toBe(1);
  });

  it('has keys: Space / ↑ jump (held for higher), ↓ stomps; others are not taken', () => {
    const sim = later();
    flatRoad(sim);
    expect(sim.key(' ', true)).toBe(true);
    expect(sim.grounded).toBe(false);
    expect(sim.key('ArrowDown', true)).toBe(true);
    expect(sim.vy).toBe(-RULES.stompV);
    expect(sim.key('x', true)).toBe(false);
    sim.key(' ', false);
    sim.key('ArrowDown', false);
  });
});

describe('Dolina: stones, stairs, gates, lambs', () => {
  it('cuts blocks to the weapon a floor expects, a little tougher every level', () => {
    expect(stoneHp(1, 1, false)).toBe(RULES.strikes[0] * powerOf(2));
    expect(stoneHp(1, 1, true)).toBeGreaterThan(stoneHp(1, 1, false));
    expect(stoneHp(10, 1, false)).toBeGreaterThan(stoneHp(1, 1, false));
    expect(powerOf(13)).toBeGreaterThan(powerOf(12));
    expect(weaponName(1)).toMatch(/ I$/);
  });

  it('strikes a block by itself until it breaks, and the stones go into the pack', () => {
    const sim = later();
    flatRoad(sim);
    const s = stone(sim, sim.px + 2, { hp: 3 * sim.power, max: 3 * sim.power, stones: 3 });
    const evs = drive(sim, 2.5, LOW);
    expect(s.alive).toBe(false);
    expect(ofType(evs, 'strike').length).toBe(3);
    expect(ofType(evs, 'break')).toHaveLength(1);
    expect(sim.stones).toBe(3);
    expect(sim.px).toBeGreaterThan(s.x + 1);
  });

  it('jumps over a small block (no stones) and lands on a tall one only with both jumps', () => {
    const sim = later();
    flatRoad(sim);
    drive(sim, 1, LOW);
    const s = stone(sim, sim.px + 2.4);
    sim.press();
    drive(sim, 1.2, LOW);
    expect(s.alive).toBe(true);
    expect(sim.px).toBeGreaterThan(s.x + s.w);
    expect(sim.stones).toBe(0);
  });

  it('merges the weapon at a gate; the high gate only with both jumps', () => {
    const sim = later();
    flatRoad(sim);
    drive(sim, 1, LOW);
    const tier = sim.tier;
    sim.gates.push({ id: 1, x: sim.px + 3, y: 0, high: false, plus: 1, taken: false }, { id: 2, x: sim.px + 3, y: 0, high: true, plus: 2, taken: false });
    drive(sim, 1.2, LOW);
    expect(sim.tier).toBe(tier + 1);
    // the high one: jump, double jump at the apex just before it
    sim.gates.push({ id: 3, x: sim.px + 3.1, y: 0, high: false, plus: 1, taken: false }, { id: 4, x: sim.px + 3.1, y: 0, high: true, plus: 2, taken: false });
    sim.press();
    drive(sim, 0.3, LOW);
    sim.press();
    const evs = drive(sim, 1.4, LOW);
    expect(ofType(evs, 'gate')[0].high).toBe(true);
    expect(sim.tier).toBe(tier + 3);
  });

  it('needs steps by height and says what the top of a stair asks', () => {
    expect(stepsFor(3.2)).toBe(Math.ceil((3.2 - RULES.stepUp) / RULES.stepH));
    expect(answerFor(3.2, stepsFor(3.2))).toBe('walk');
    expect(answerFor(3.2, 4)).toBe('jump');
    expect(answerFor(4.2, 3)).toBe('double');
    expect(answerFor(4.4, 0)).toBe('climb');
    expect(ledgeFor(1)).toBeLessThan(ledgeFor(9));
  });

  it('builds a stair from the pack at a ledge; a double jump from its top takes him up', () => {
    const sim = later();
    flatRoad(sim);
    sim.segs[0].x1 = sim.px + 12;
    sim.segs.push({ x0: sim.px + 12, x1: sim.px + 300, y: 3.6, kind: 'ledge' });
    sim.walls.push({ id: 5, x: sim.px + 12, y0: 0, top: 3.6, level: sim.level, stage: 1, need: stepsFor(3.6), built: 0, plan: 0, buildT: 0, started: false, passed: false });
    sim.stones = 3;
    let pressed = 0;
    const evs = drive(sim, 6, LOW, { t: 0 }, () => {
      if (sim.blocked === 'wall' && sim.grounded && pressed === 0) { sim.press(); pressed = 1; }
      else if (pressed === 1 && sim.vy < 1 && !sim.grounded) { sim.press(); pressed = 2; }
    });
    const st = ofType(evs, 'stairs')[0];
    expect(st.n).toBe(3);
    expect(st.answer).toBe('double');
    expect(ofType(evs, 'step')).toHaveLength(3);
    expect(sim.stones).toBe(0);
    expect(sim.py).toBeCloseTo(3.6, 3);
    expect(ofType(evs, 'stage').some(e => e.stage === 2)).toBe(true);
    expect(ofType(evs, 'climb')).toHaveLength(0);
  });

  it('climbs a ledge by hand when nothing is pressed: progress never stops', () => {
    const sim = later();
    flatRoad(sim);
    sim.segs[0].x1 = sim.px + 9;
    sim.segs.push({ x0: sim.px + 9, x1: sim.px + 300, y: 4.4, kind: 'ledge' });
    sim.walls.push({ id: 6, x: sim.px + 9, y0: 0, top: 4.4, level: sim.level, stage: 1, need: stepsFor(4.4), built: 0, plan: 0, buildT: 0, started: false, passed: false });
    const evs = drive(sim, 9, LOW);
    expect(ofType(evs, 'climb')).toHaveLength(1);
    expect(sim.py).toBeCloseTo(4.4, 3);
    expect(sim.px).toBeGreaterThan(sim.walls[0]?.x ?? 0);
  });

  it('climbs a high ledge even while short hops keep coming (the smoke test’s taps)', () => {
    const sim = later();
    flatRoad(sim);
    sim.segs[0].x1 = sim.px + 9;
    sim.segs.push({ x0: sim.px + 9, x1: sim.px + 300, y: 4.4, kind: 'ledge' });
    const wx = sim.px + 9;
    sim.walls.push({ id: 7, x: wx, y0: 0, top: 4.4, level: sim.level, stage: 1, need: stepsFor(4.4), built: 0, plan: 0, buildT: 0, started: false, passed: false });
    let tap = 0;
    drive(sim, 12, LOW, { t: 0 }, t => {
      if (t - tap >= 0.65) { tap = t; sim.press(); sim.releasePress(); }
    });
    expect(sim.py).toBeGreaterThanOrEqual(4.4 - 1e-6);
    expect(sim.px).toBeGreaterThan(wx + 1);
  });

  it('frees a lamb from a pen; it follows him; stars count the lambs, the top and the tide', () => {
    const sim = later();
    flatRoad(sim);
    stone(sim, sim.px + 2, { pen: true, stones: 0, hp: 2, max: 2 });
    const evs = drive(sim, 2, LOW);
    expect(ofType(evs, 'lamb')).toHaveLength(1);
    expect(sim.lambs).toHaveLength(1);
    expect(sim.lambs[0].x).toBeLessThan(sim.px);
    expect(starsFor(2, 2, false)).toBe(3);
    expect(starsFor(1, 2, false)).toBe(2);
    expect(starsFor(0, 0, true)).toBe(2);
  });

  it('lifts him out of a pit to the far rim (a little oil), never ending the run', () => {
    const sim = later();
    flatRoad(sim);
    sim.segs[0].x1 = sim.px + 1;
    sim.segs.push({ x0: sim.px + 5, x1: sim.px + 300, y: 0, kind: 'road' });
    const evs = drive(sim, 3, LOW);
    expect(ofType(evs, 'pit')).toHaveLength(1);
    expect(ofType(evs, 'lift')).toHaveLength(1);
    expect(sim.oil).toBeLessThan(1);
    expect(sim.px).toBeGreaterThan(sim.segs[1].x0);
  });

  it('a wide gap is crossed with both jumps, a narrow one with one', () => {
    for (const [w, both] of [[2, false], [4, true]] as const) {
      const sim = later();
      flatRoad(sim);
      sim.segs[0].x1 = sim.px + 1.2;
      sim.segs.push({ x0: sim.px + 1.2 + w, x1: sim.px + 300, y: 0, kind: 'road' });
      let n = 0;
      const evs = drive(sim, 2.5, LOW, { t: 0 }, () => {
        if (n === 0 && sim.px > sim.segs[0].x1 - 0.5) { sim.press(); n = 1; }
        else if (both && n === 1 && sim.vy < 0.5) { sim.press(); n = 2; }
      });
      expect(ofType(evs, 'pit')).toHaveLength(0);
    }
  });
});

describe('Dolina: the band', () => {
  it('widens the lamp with the level in a sighted push, the threshold at its ring', () => {
    expect(lampFor(0.5)).toBe(LAMP_MARK);
    expect(lampFor(1)).toBeGreaterThan(LAMP_MARK);
    const sim = later();
    flatRoad(sim);
    intoPush(sim, { t: 0 }, HIGH);
    drive(sim, 3, HIGH);
    expect(sim.lampLook).toBe('live');
    expect(sim.lampR).toBeGreaterThan(LAMP_MARK);
    expect(sim.meter()!).toBeGreaterThan(0.5);
    const low = later();
    flatRoad(low);
    drive(low, 9, LOW);
    expect(low.meter()!).toBeLessThan(0.5);
  });

  it('waits out the lead-in (5 s Mendi, 2 s HALO) before the band moves the lamp', () => {
    const sim = later();
    flatRoad(sim);
    drive(sim, 3, HIGH);
    expect(sim.lampLook).toBe('wait');
    expect(sim.meter()).toBeNull();
    const eeg = later({ eeg: true });
    flatRoad(eeg);
    drive(eeg, 3, HIGH);
    expect(eeg.lampLook).toBe('live');
  });

  it('burns shadows in the light above the threshold', () => {
    const sim = later();
    flatRoad(sim);
    intoPush(sim, { t: 0 }, HIGH);
    drive(sim, 2, HIGH);
    sim.shadows.push({ id: 5, kind: 'ceglomiot', x: sim.px + 3, y: 0, r: 0.36, h: 1.15, hp: 100, max: 100, state: 'walk', age: 0, hitT: 0, stun: 0, inLight: false, burn: 0, throwT: 99, bob: 0 });
    const s = sim.shadows[sim.shadows.length - 1];
    sim.update(0.02, HIGH, 99);
    expect(s.inLight).toBe(true);
    drive(sim, 0.5, HIGH, { t: 99 });
    expect(s.burn).toBeGreaterThan(10);
  });

  it('the tide follows; the lamp above the threshold pushes it back; a catch costs stones, never the run', () => {
    const sim = later();
    flatRoad(sim);
    inner(sim).tideOn = true;
    inner(sim).tideX = sim.px - 3;
    sim.speed = 0;
    const evs = drive(sim, 0.3, LOW, { t: 0 }, () => { sim.px -= sim.speed * STEP; });
    void evs;
    sim.stones = 10;
    inner(sim).tideX = sim.px - 0.1;
    const caught = drive(sim, 0.1, LOW);
    expect(ofType(caught, 'caught')).toHaveLength(1);
    expect(sim.stones).toBe(7);
    expect(sim.caught).toBe(1);
    // the lamp: the tide inside the light is pushed back
    const lit = later();
    flatRoad(lit);
    intoPush(lit, { t: 0 }, HIGH);
    drive(lit, 2, HIGH);
    inner(lit).tideOn = true;
    inner(lit).tideX = lit.px - 2;
    const before = lit.px - inner(lit).tideX;
    lit.update(0.05, HIGH, 50);
    lit.update(0.5, HIGH, 50.5);
    expect(lit.px - inner(lit).tideX).toBeGreaterThan(before);
  });

  it('lights the Świt after a held focus: shadows dissolve, blocks burst into stones, the tide falls back', () => {
    const sim = later();
    flatRoad(sim);
    const clock = { t: 0 };
    intoPush(sim, clock, HIGH);
    stone(sim, sim.px + 6, { stones: 4, hp: 999, max: 999 });
    sim.shadows.push({ id: 9, kind: 'giermek', x: sim.px + 8, y: 0, r: 0.36, h: 1.1, hp: 999, max: 999, state: 'walk', age: 0, hitT: 0, stun: 99, inLight: false, burn: 0, throwT: 99, bob: 0 });
    let hold = 0;
    const evs = drive(sim, 6, () => { hold += STEP; return frame({ level: 0.9, activity: 5, focused: true, hold }); }, clock);
    const dawn = ofType(evs, 'dawn');
    expect(dawn.length).toBeGreaterThanOrEqual(1);
    expect(dawn[0].stones).toBe(4);
    expect(sim.dawns).toBeGreaterThanOrEqual(1);
  });

  it('gathers smooth stones from the brook and refills the oil in a calm meadow', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.1, LOW, clock);
    expect(sim.block.kind).toBe('rest');
    sim.oil = 0.4;
    const s0 = sim.stones;
    const evs = drive(sim, 12, CALM, clock);
    expect(ofType(evs, 'brook').length).toBeGreaterThan(2);
    expect(sim.stones).toBeGreaterThan(s0 + 2);
    expect(sim.oil).toBeGreaterThan(0.5);
    expect(sim.meter()!).toBeGreaterThan(0.8);
    expect(sim.shadows.filter(s => s.state === 'walk' && s.x > sim.px && s.x < sim.meadowTo).length).toBe(0);
  });

  it('follows the lamp with the pad only in a sighted push; holds it still elsewhere', () => {
    const sim = later();
    drive(sim, 7, HIGH);
    expect(sim.padLevel(HIGH)).not.toBeNull();
    expect(sim.padLevel(NONE)).toBeNull();
  });
});

describe('Dolina: levels and guardians', () => {
  it('lays three floors a level, gates and pens on them; every third level ends at a guardian', () => {
    for (let lv = 1; lv <= 9; lv++) {
      const plan = stagePlan(lv, 3, mulberry32(lv));
      expect(plan.filter(b => b === 'pen')).toHaveLength(2);
      expect(plan.filter(b => b === 'gate' || b === 'gate2').length).toBe(2);
    }
    expect(stagePlan(1, 1, mulberry32(1)).filter(b => b === 'pen')).toHaveLength(0);
    expect(guardLevel(3)).toBe(true);
    expect(guardLevel(4)).toBe(false);
    expect(eraOfLevel(1)).toBe(0);
    expect(eraOfLevel(4)).toBe(1);
    expect(eraOfLevel(7)).toBe(2);
    expect(eraOfLevel(10)).toBe(0);
    expect(WARM_PLAN).toContain('pitW');
    expect(WARM_PLAN).toContain('gate2');
  });

  it('runs through levels on its own: floors, the way out, stars saved', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, 240, () => (sim.block.kind === 'push' ? HIGH : CALM), { t: 0 }, () => {
      // a player who jumps whenever something is ahead and doubles at the apex
      if (sim.grounded && (sim.blocked === 'wall' || sim.stonesOnRoad.some(s => s.alive && s.tall && s.x - sim.px < 1.6 && s.x > sim.px))) sim.press();
      else if (!sim.grounded && sim.airUsed === 0 && sim.vy < 0.5 && sim.vy > -1 && sim.blocked === 'wall') sim.press();
    });
    expect(ofType(evs, 'stage').length).toBeGreaterThan(2);
    const lv = ofType(evs, 'level');
    expect(lv.length).toBeGreaterThanOrEqual(1);
    expect(lv[0].stars).toBeGreaterThanOrEqual(1);
    sim.finish();
    sim.result();
    expect(sim.p.level).toBeGreaterThan(1);
    expect(starsOf(sim.p, 1)).toBeGreaterThanOrEqual(1);
  });

  it('a guardian comes in a push block at its arena, throws telegraphed moves, opens, and is beaten', () => {
    const sim = later({ planned: 600, progress: { level: 3 } });
    flatRoad(sim);
    sim.arena = { x: sim.px + 1, y: 0, level: 3, guard: null, done: false };
    const clock = { t: 0 };
    const evs: SimEvent[] = [];
    // a player who jumps every throw and double-jumps onto the open weak point
    evs.push(...drive(sim, 60, HIGH, clock, () => {
      const g = sim.guard;
      if (!g || g.state !== 'fight') return;
      const near = sim.shots.find(s => s.alive && s.x - sim.px < 1.6 && s.x - sim.px > 0.3);
      if (near && sim.grounded && near.kind !== 'high') sim.press();
      if (near && !sim.grounded && sim.airUsed === 0 && near.kind === 'wall' && sim.vy < 3) sim.press();
      if (sim.guardOpen && sim.grounded) sim.press();
      if (sim.guardOpen && !sim.grounded && sim.airUsed === 0 && sim.vy < 1) sim.press();
    }));
    expect(ofType(evs, 'guard').some(e => e.what === 'come')).toBe(true);
    expect(ofType(evs, 'move').some(e => e.act)).toBe(true);
    expect(ofType(evs, 'guardHit').length).toBeGreaterThan(0);
    expect(SEQ.wieza.calm).toContain('open');
  });

  it('even a player who never taps wears a guardian down within a few push blocks (never stuck)', () => {
    const sim = later({ planned: 600, progress: { level: 3 } });
    flatRoad(sim);
    sim.arena = { x: sim.px + 1, y: 0, level: 3, guard: null, done: false };
    const evs = drive(sim, 150, () => (sim.block.kind === 'push' ? LOW : CALM));
    expect(ofType(evs, 'guard').some(e => e.what === 'beaten')).toBe(true);
    expect(ofType(evs, 'level').length).toBe(1);
  });

  it('a guardian left standing at the push block’s end withdraws, keeping its damage', () => {
    const sim = later({ planned: 300, progress: { level: 3 } });
    flatRoad(sim);
    sim.arena = { x: sim.px + 0.5, y: 0, level: 3, guard: null, done: false };
    const clock = { t: 0 };
    drive(sim, 2, HIGH, clock);
    sim.guard!.hp = sim.guard!.max = 1e6;
    const evs = drive(sim, sim.block.dur - 1.5, HIGH, clock);
    expect(ofType(evs, 'guard').some(e => e.what === 'leave')).toBe(true);
    expect(sim.guard?.hp).toBeLessThan(sim.guard!.max);
  });
});

describe('Dolina: the session', () => {
  it('makes progress with only centre taps every 0.65 s and Space every ~2 s (the smoke test), score > 0 live', () => {
    for (const first of [true, false]) {
      const sim = first ? makeSim({ planned: 40, seed: 5 }) : later({ planned: 40, seed: 5 });
      let tap = 0, space = 0;
      const clock = { t: 0 };
      const scores: number[] = [];
      drive(sim, 26, LOW, clock, t => {
        if (t - tap >= 0.65) { tap = t; sim.press(); sim.releasePress(); }
        if (t - space >= 2) { space = t; sim.key(' ', true); sim.key(' ', false); }
        scores.push(sim.score);
      });
      expect(sim.score).toBeGreaterThan(40);
      expect(scores[scores.length - 1]).toBeGreaterThan(scores[Math.floor(scores.length / 3)]);
      expect(sim.result().score).toBeGreaterThan(0);
    }
  });

  it('teaches the hands with coach marks in the first session, one thing at a time', () => {
    const sim = makeSim({ planned: 300, seed: 2 });
    const evs = drive(sim, 34, LOW, { t: 0 });
    const what = ofType(evs, 'teach').map(e => e.what);
    expect(what).toContain('jump');
    expect(what.length).toBeGreaterThanOrEqual(3);
    for (const w of new Set(what)) expect(what.filter(x => x === w).length).toBeLessThanOrEqual(2);
  });

  it('later sessions explain only new things, once ever', () => {
    const sim = makeSim({ planned: 300, progress: { sessions: 3, giftDay: DAY } });
    const evs = drive(sim, 60, () => (sim.block.kind === 'push' ? LOW : CALM));
    const what = ofType(evs, 'teach').map(e => e.what);
    const news = ['tide', 'meadow', 'guard', 'open', 'fog', 'dawn', 'stairsJump', 'stairsDouble', 'stairsClimb', 'cage', 'mate', 'power', 'tower', 'bridge', 'pend', 'barrier', 'chest'];
    expect(what.every(w => news.includes(w))).toBe(true);
    for (const w of new Set(what)) expect(what.filter(x => x === w).length).toBe(1);
    expect(sim.p.seen).toContain('meadow');
  });

  it('keeps result() idempotent: records with Math.max, counters settled once', () => {
    const sim = later({ planned: 60 });
    drive(sim, 70, () => (sim.block?.kind === 'push' ? HIGH : CALM));
    const a = sim.result();
    const p1 = JSON.stringify(sim.p);
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(JSON.stringify(sim.p)).toBe(p1);
    expect(sim.canStop()).toBe(true);
    expect(a.unit).toBe(t('unit'));
    expect(a.highlights.length).toBeGreaterThanOrEqual(1);
    expect(passage(a.verse!)).toBeTruthy();
  });

  it('settles an early end once (finish), with the day’s gift and the level reached', () => {
    const sim = makeSim({ planned: 300, progress: { sessions: 2 } });
    drive(sim, 20, LOW);
    sim.finish();
    sim.finish();
    const r = sim.result();
    expect(sim.p.sessions).toBe(3);
    expect(sim.p.giftDay).toBe(DAY);
    expect(sim.p.sparks).toBeGreaterThanOrEqual(RULES.dayGift);
    expect(r.score).toBeGreaterThan(0);
  });

  it('holds the companion quiet over a telegraph and keeps her lines short', () => {
    for (const lang of Object.keys(CATALOGS) as (keyof typeof CATALOGS)[]) {
      for (const [m, n] of Object.entries(SAY)) {
        for (let i = 1; i <= n; i++) {
          const s = (CATALOGS[lang] as Record<string, unknown>)[`say.${m}.${i}`];
          expect(typeof s, `${lang} say.${m}.${i}`).toBe('string');
          expect((s as string).length, `${lang} say.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
    expect(lineSec('x')).toBeGreaterThanOrEqual(2);
    const sim = later({ planned: 300 });
    drive(sim, sim.block.dur - 2, LOW);
    expect(sim.quiet).toBe(true);
  });

  it('closes with passages that exist, the root verse in the first session', () => {
    const sim = makeSim({ planned: 60 });
    drive(sim, 70, LOW);
    const r = sim.result();
    expect(r.verse).toBe('psa23.4');
    for (const id of ['psa23.4', 'luk15.4-6', 'rom12.21', 'mic7.8', 'jhn1.5', 'hab3.19', 'psa119.105', 'psa23.1-3', 'psa139.12'] as const) expect(passage(id)).toBeTruthy();
  });

  it('drives a full session against the real focus input without errors', () => {
    const sim = makeSim({ planned: 180, seed: 9 });
    const input = new FocusInput(TUNING);
    let tap = 0;
    drive(sim, 190, t => input.push(Math.sin(t / 7) * 4 + 2, true, STEP), { t: 0 }, t => {
      if (t - tap > 0.9) { tap = t; sim.press(); sim.releasePress(); }
    });
    expect(sim.phase).toBe('done');
    expect(sim.score).toBeGreaterThan(200);
  });
});

describe('Dolina: the meta', () => {
  it('prices upgrades and buys them with sparks', () => {
    const p = freshProgress();
    expect(upPrice('stone', 0)).toBe(RULES.priceBase);
    expect(buyUp(p, 'stone')).toBe(false);
    p.sparks = 1000;
    expect(buyUp(p, 'stone')).toBe(true);
    expect(upLevel(p, 'stone')).toBe(1);
    expect(UPGRADES).toHaveLength(5);
    for (const id of UPGRADES) expect(upPrice(id, RULES.upMax[id])).toBeNull();
  });

  it('keeps the best stars per level and the looks by sparks ever', () => {
    const p = freshProgress();
    setStars(p, 4, 2);
    setStars(p, 4, 1);
    expect(starsOf(p, 4)).toBe(2);
    expect(starTotal(p)).toBe(2);
    expect(lookOf(0)).toBe(0);
    expect(lookOf(RULES.looks[3])).toBe(3);
  });

  it('migrates a version-1 save in place: the best scores and the session count stay, the rest starts over', () => {
    const old = {
      v: 1, sessions: 7, total: 4210, sparks: 333, sparksAll: 900, ups: { sword: 3, lamp: 2, oil: 1, boots: 4, dawn: 2 },
      reached: 2, startEra: 1, guards: 4, gates: 1, dawns: 9, pushes: 18, best: { '300': 812, '180': 'x', '600': 1500 }, lastLen: 300, bestCombo: 22, giftDay: '2026-11-01',
    };
    // the runner loads saves as mergeSaved(fresh, saved)
    const p = { ...freshProgress(), ...old, ups: { ...freshProgress().ups, ...old.ups } } as unknown as DolinaProgress;
    migrate(p);
    expect(p.ver).toBe(3);
    expect(p.sessions).toBe(7);
    expect(p.best).toEqual({ '300': 812, '600': 1500 });
    expect(bestOf(p)).toBe(812);
    expect(p.level).toBe(1);
    expect(p.sparks).toBe(0);
    expect(p.ups).toEqual(freshProgress().ups);
    expect((p as unknown as Record<string, unknown>).reached).toBeUndefined();
    // and it plays
    const sim = new DolinaSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 10, LOW);
    expect(sim.score).toBeGreaterThan(0);
    // a broken version-2 save never crashes either
    const broken = { ...freshProgress(), stars: 'x', seen: 5, ups: null, level: 'nine', best: [1, 2] } as unknown as DolinaProgress;
    migrate(broken);
    expect(broken.level).toBe(1);
    expect(broken.seen).toEqual([]);
    expect(broken.stars).toEqual({});
    expect(migrate(broken)).toBe(broken);
  });

  it('names eras, the harm and the combo', () => {
    expect(ERAS).toHaveLength(3);
    expect(harmFor('shadow', 2)).toBeLessThan(harmFor('shadow', 0));
    expect(comboMult(0)).toBe(1);
    expect(comboMult(RULES.comboAt[1])).toBe(3);
  });

  it('has every text in all four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('keeps Polish letters and Polish words out of the other languages', () => {
    for (const lang of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[lang])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v as Record<string, string>);
        for (const s of texts) {
          expect(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/.test(s), `${lang} ${k}: ${s}`).toBe(false);
          expect(/\b(opaska|się|albo|Gra|Graj)\b/.test(s), `${lang} ${k}: ${s}`).toBe(false);
        }
      }
    }
  });
});

// ── version 3 ─────────────────────────────────────────────────────
/** A sim with a party already found (and its slots), on a flat empty road. */
function withParty(ids: DolinaProgress['found'], o: SimOpts = {}): DolinaSim {
  const sim = later({ ...o, progress: { found: ids, party: ids, guards: Math.max(0, ids.length - 1), ...o.progress } });
  flatRoad(sim);
  return sim;
}

describe('Dolina v3: the companions', () => {
  it('opens a slot for each of the first two guardians and keeps the pick to the slots', () => {
    expect(slotsFor(0)).toBe(1);
    expect(slotsFor(1)).toBe(2);
    expect(slotsFor(2)).toBe(3);
    expect(slotsFor(9)).toBe(3);
    const p = freshProgress();
    p.found = ['glaz', 'babcia', 'bobr'];
    p.guards = 1;
    expect(partyFor(p)).toEqual(['glaz', 'babcia']);
    p.party = ['bobr'];
    expect(partyFor(p)).toEqual(['bobr', 'glaz']);
    toggleParty(p, 'babcia');
    expect(partyFor(p)).toEqual(['glaz', 'babcia']);
    toggleParty(p, 'glaz');
    expect(p.party).toEqual(['babcia']);
    toggleParty(p, 'kozica');   // not found: nothing changes
    expect(p.party).toEqual(['babcia']);
  });

  it('frees a companion from a cage of smoke: found for good, into the party', () => {
    const sim = later({ planned: 300 });
    flatRoad(sim);
    expect(sim.party).toHaveLength(0);
    const cage = stone(sim, sim.px + 2, { cage: 'glaz', h: 3.2, w: 1.3, hp: 4 * sim.power, max: 4 * sim.power, stones: 0 });
    const evs = drive(sim, 3, LOW);
    expect(cage.alive).toBe(false);
    expect(ofType(evs, 'mate')[0]).toMatchObject({ what: 'join', id: 'glaz' });
    expect(sim.p.found).toEqual(['glaz']);
    expect(sim.party.map(m => m.id)).toEqual(['glaz']);
    expect(sim.freedNow).toEqual(['glaz']);
    expect(sim.result().verse).toBeTruthy();
  });

  it('lays the next companion’s cage on a level’s second floor (and catches up for old saves)', () => {
    const sim = later({ planned: 600, progress: { level: 7 } });
    let seen = false;
    drive(sim, 150, () => (sim.block.kind === 'push' ? HIGH : CALM), { t: 0 }, () => {
      if (sim.stonesOnRoad.some(s => s.cage === 'glaz')) seen = true;
      if (sim.grounded && (sim.blocked === 'wall' || sim.stonesOnRoad.some(s => s.alive && s.tall && !s.cage && s.x - sim.px < 1.6 && s.x > sim.px))) sim.press();
      else if (!sim.grounded && sim.airUsed === 0 && sim.vy < 0.5 && sim.vy > -1 && sim.blocked === 'wall') sim.press();
    });
    expect(seen).toBe(true);
    expect(sim.p.found[0]).toBe('glaz');
  });

  it('charges powers faster in the lamp’s light above the threshold (never slower without it)', () => {
    expect(chargeRate(true, 1)).toBe(2);
    expect(chargeRate(true, 0.3)).toBe(1);
    expect(chargeRate(false, 1)).toBe(1);
    expect(cooldownFor('glaz', 5)).toBeLessThan(cooldownFor('glaz', 1));
    const lit = withParty(['babcia']);
    intoPush(lit, { t: 0 }, HIGH);
    lit.party[0].charge = 0;
    lit.shieldHits = 9;   // keep the umbrella from firing
    drive(lit, 3, HIGH, { t: 10 });
    const dim = withParty(['babcia']);
    intoPush(dim, { t: 0 }, LOW);
    dim.party[0].charge = 0;
    dim.shieldHits = 9;
    drive(dim, 3, LOW, { t: 10 });
    expect(lit.party[0].charge).toBeGreaterThan(dim.party[0].charge * 1.5);
    expect(dim.party[0].charge).toBeGreaterThan(0.15);
  });

  it('Huk: Głaz’s hammer hits the block ahead for eight blows', () => {
    const sim = withParty(['glaz']);
    const big = stone(sim, sim.px + 3, { hp: 999, max: 999 });
    sim.party[0].charge = 1;
    const evs = drive(sim, 0.2, LOW);
    const pw = ofType(evs, 'power')[0];
    expect(pw).toMatchObject({ id: 'glaz', power: 'huk' });
    expect(pw.n).toBe(Math.round(sim.power * hukFor(1)));
    expect(big.hp).toBeLessThan(999 - sim.power * 7);
    expect(sim.party[0].charge).toBeLessThan(0.1);
  });

  it('Parasol: Babcia’s umbrella takes a hit, even the tide’s', () => {
    const sim = withParty(['babcia']);
    sim.party[0].charge = 1;
    drive(sim, 0.1, LOW);
    expect(sim.shieldHits).toBe(1);
    sim.shadows.push({ id: 7, kind: 'glinianek', x: sim.px + 0.3, y: 0, r: 0.32, h: 0.95, hp: 99, max: 99, state: 'walk', age: 0, hitT: 0, stun: 0, inLight: false, burn: 0, throwT: 9, bob: 0 });
    const evs = drive(sim, 0.3, LOW);
    expect(ofType(evs, 'shield')).toHaveLength(1);
    expect(sim.oil).toBe(1);
    // the tide's catch: thrown back, nothing spilled, the star kept
    const t2 = withParty(['babcia']);
    t2.party[0].charge = 1;
    drive(t2, 0.1, LOW);
    t2.stones = 10;
    inner(t2).tideOn = true;
    inner(t2).tideX = t2.px - 0.1;
    const c = drive(t2, 0.1, LOW);
    expect(ofType(c, 'caught')).toHaveLength(0);
    expect(t2.stones).toBe(10);
    expect(t2.caught).toBe(0);
  });

  it('Rusztowanie: Bóbr adds wooden steps to a stair as it starts', () => {
    const sim = withParty(['bobr']);
    sim.segs[0].x1 = sim.px + 12;
    sim.segs.push({ x0: sim.px + 12, x1: sim.px + 300, y: 4.4, kind: 'ledge' });
    sim.walls.push({ id: 9, x: sim.px + 12, y0: 0, top: 4.4, level: sim.level, stage: 1, need: stepsFor(4.4), built: 0, plan: 0, buildT: 0, started: false, passed: false });
    sim.stones = 2;
    sim.party[0].charge = 1;
    const evs = drive(sim, 2, LOW);
    const st = ofType(evs, 'stairs')[0];
    expect(st.n).toBe(2 + RULES.comp.scaffold[0]);
    expect(sim.walls[0].wood).toBe(RULES.comp.scaffold[0]);
    expect(ofType(evs, 'power')[0]).toMatchObject({ id: 'bobr', n: RULES.comp.scaffold[0] });
  });

  it('Pauza: the watchmaker slows a throw coming at him', () => {
    const sim = withParty(['zegar']);
    sim.shots.push({ id: 3, kind: 'roll', x: sim.px + 6, y0: 0, y1: 0.55, w: 0.5, vx: -RULES.rollV, alive: true, passed: false, guard: false, t: 0 });
    sim.party[0].charge = 1;
    const px0 = sim.px;
    const stay = () => { sim.px = px0; sim.speed = 0; };
    stay();
    drive(sim, 0.05, LOW, { t: 0 }, stay);
    expect(sim.slowT).toBeGreaterThan(2.5);
    const x0 = sim.shots[0].x;
    drive(sim, 0.5, LOW, { t: 1 }, stay);
    const moved = x0 - sim.shots[0].x;
    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(RULES.rollV * 0.5 * 0.5);
  });

  it('Szarża: the goat charges through the shadows ahead and pushes the tide back', () => {
    const sim = withParty(['kozica']);
    for (const dx of [2, 3.5]) sim.shadows.push({ id: 50 + dx, kind: 'glinianek', x: sim.px + dx, y: 0, r: 0.32, h: 0.95, hp: 99, max: 99, state: 'walk', age: 0, hitT: 0, stun: 99, inLight: false, burn: 0, throwT: 9, bob: 0 });
    sim.party[0].charge = 1;
    const evs = drive(sim, 0.05, LOW);
    expect(ofType(evs, 'kill').length).toBe(2);
    expect(sim.dashT).toBeGreaterThan(1);
  });

  it('Zapasy: the squirrel digs up stones and gives back what the tide spilled', () => {
    const sim = withParty(['wiewiorka']);
    sim.party[0].charge = 0;
    sim.stones = 10;
    inner(sim).tideOn = true;
    inner(sim).tideX = sim.px - 0.1;
    drive(sim, 0.05, LOW);
    expect(sim.stones).toBe(7);
    sim.party[0].charge = 1;
    drive(sim, 0.05, LOW);
    expect(sim.stones).toBe(7 + RULES.comp.stash[0] + 3);
  });

  it('companions strike the block he is stopped at with him', () => {
    const alone = later();
    flatRoad(alone);
    const a = stone(alone, alone.px + 2, { hp: 40 * alone.power, max: 40 * alone.power });
    drive(alone, 4, LOW);
    const two = withParty(['glaz', 'babcia'], { progress: { guards: 1 } });
    two.party.forEach(m => { m.charge = 0; });
    two.shieldHits = 9;
    const b = stone(two, two.px + 2, { hp: 40 * two.power, max: 40 * two.power });
    const evs = drive(two, 4, LOW, { t: 0 }, () => { two.party[0].charge = 0; });
    expect(ofType(evs, 'assist').length).toBeGreaterThan(4);
    expect(b.hp).toBeLessThan(a.hp);
  });

  it('the meadow’s calm fills their powers; their bond is settled once and levels them up', () => {
    const sim = later({ planned: 300, progress: { found: ['glaz'], party: ['glaz'] } });
    const clock = { t: 0 };
    drive(sim, sim.block.dur + sim.restLeadIn + 0.5, LOW, clock);
    expect(sim.block.kind).toBe('rest');
    sim.party[0].charge = 0;
    drive(sim, 6, CALM, clock);
    expect(sim.party[0].charge).toBeGreaterThan(0.2);
    // a level: bond for breaks (three short of the second level)
    sim.p.bond = { glaz: RULES.comp.bond[1] - 3 };
    sim.party[0].bondRun = 0;
    sim.party[0].lv = 1;
    flatRoad(sim);
    for (let i = 0; i < 4; i++) stone(sim, sim.px + 2 + i * 2.4, { hp: 1, max: 1 });
    const evs = drive(sim, 6, LOW, clock);
    expect(ofType(evs, 'mateLevel').length).toBeGreaterThanOrEqual(1);
    const run = sim.party[0].bondRun;
    sim.finish();
    sim.result();
    sim.result();
    expect(sim.p.bond.glaz).toBe(RULES.comp.bond[1] - 3 + run);
    expect(bondLevel(sim.p.bond.glaz)).toBeGreaterThanOrEqual(2);
  });

  it('gives every companion moment its own lines, and says who speaks', () => {
    for (const id of COMPS) {
      expect(SAY[`m.${id}.join`]).toBeGreaterThanOrEqual(2);
      expect(SAY[`m.${id}.power`]).toBeGreaterThanOrEqual(3);
      expect(speakerOf(`m.${id}.quip`)).toBe(id);
      expect(speakerOf(`c.${id}`)).toBe('cma');
    }
    expect(speakerOf('tower')).toBe('cma');
  });
});

describe('Dolina v3: the clock tower', () => {
  it('keeps a keeper every fifth floor and four different trials between them', () => {
    expect(keeperFloor(5)).toBe(true);
    expect(keeperFloor(6)).toBe(false);
    expect([1, 2, 3, 4].map(floorKind)).toEqual(['quarry', 'bridge', 'gates', 'pendulum']);
    for (let band = 1; band < 6; band++) {
      const kinds = [1, 2, 3, 4].map(i => floorKind(band * 5 + i));
      expect(new Set(kinds).size).toBe(4);
      for (const k of kinds) expect(TRIALS).toContain(k);
      expect(floorKind(band * 5 + 5)).toBe('keeper');
    }
    for (const k of TRIALS) expect(towerPlan(7, k, mulberry32(3)).length).toBeGreaterThan(2);
    expect(towerPlan(3, 'gates', mulberry32(1)).at(-1)).toBe('giant');
    expect(towerPlan(2, 'bridge', mulberry32(1))).toContain('bridge');
    expect(towerPlan(4, 'pendulum', mulberry32(1)).filter(b => b === 'pend')).toHaveLength(3);
    expect(towerPlan(5, 'keeper', mulberry32(1))).toEqual([]);
  });

  it('moves the clock six minutes a floor, from midnight to the dawn, then a new night', () => {
    expect(clockTime(1)).toBe('00:00');
    expect(clockTime(11)).toBe('01:00');
    expect(clockTime(60)).toBe('05:54');
    expect(clockTime(61)).toBe('00:00');
    expect(nightOf(60)).toBe(1);
    expect(nightOf(61)).toBe(2);
  });

  it('opens only after the first guardian; a tower run climbs floors and saves the floor', () => {
    expect(later({ progress: { mode: 'tower' } }).mode).toBe('valley');
    const sim = later({ planned: 600, progress: { mode: 'tower', guards: 1, tower: { floor: 1, best: 0, night: 0 } } });
    expect(sim.mode).toBe('tower');
    const evs = drive(sim, 200, () => (sim.block.kind === 'push' ? HIGH : CALM), { t: 0 }, () => {
      if (sim.grounded && (sim.blocked === 'wall' || sim.stonesOnRoad.some(s => s.alive && s.tall && !s.cage && s.x - sim.px < 1.6 && s.x > sim.px))) sim.press();
      else if (!sim.grounded && sim.airUsed === 0 && sim.vy < 0.5 && sim.vy > -1 && sim.blocked === 'wall') sim.press();
    });
    expect(ofType(evs, 'floor')[0]).toMatchObject({ floor: 1, kind: 'quarry', time: '00:00' });
    const done = ofType(evs, 'floorDone');
    expect(done.length).toBeGreaterThanOrEqual(2);
    sim.finish();
    sim.result();
    expect(sim.p.tower.floor).toBe(sim.floor);
    expect(sim.p.tower.best).toBe(sim.floor - 1);
    expect(sim.result().stats[0][1]).toContain('→');
  });

  it('a keeper guards every fifth floor: Kukułka on the twentieth; beaten, it pays a chest and the floor', () => {
    expect(KEEPERS[3]).toBe('kukulka');
    expect(SEQ.kukulka.calm).toContain('open');
    const sim = later({ planned: 600, progress: { mode: 'tower', guards: 3, tower: { floor: 20, best: 19, night: 0 } } });
    flatRoad(sim);
    sim.arena = { x: sim.px + 1, y: 0, level: 20, guard: null, done: false, keeper: 'kukulka' };
    const evs = drive(sim, 200, () => (sim.block.kind === 'push' ? LOW : CALM));
    expect(ofType(evs, 'guard').find(e => e.what === 'come')?.id).toBe('kukulka');
    expect(ofType(evs, 'guard').some(e => e.what === 'beaten')).toBe(true);
    expect(ofType(evs, 'chest').some(e => e.source === 'keeper')).toBe(true);
    expect(ofType(evs, 'floorDone')[0].floor).toBe(20);
  });

  it('scores live in the tower with only the smoke test’s taps', () => {
    const sim = later({ planned: 40, seed: 7, progress: { mode: 'tower', guards: 1 } });
    let tap = 0, space = 0;
    drive(sim, 26, LOW, { t: 0 }, t => {
      if (t - tap >= 0.65) { tap = t; sim.press(); sim.releasePress(); }
      if (t - space >= 2) { space = t; sim.key(' ', true); sim.key(' ', false); }
    });
    expect(sim.score).toBeGreaterThan(40);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
  });
});

describe('Dolina v3: bridges, weights, curtains', () => {
  it('a trodden plank falls behind him; running across is safe, stopping on one is a fall Ćma lifts him from', () => {
    const sim = later();
    flatRoad(sim);
    const x = sim.px + 2;
    sim.segs[0].x1 = x;
    for (let i = 0; i < 10; i++) sim.segs.push({ x0: x + i * 0.55, x1: x + (i + 1) * 0.55 - 0.04, y: 0, kind: 'bridge', crumble: -1 });
    sim.segs.push({ x0: x + 5.5, x1: x + 300, y: 0, kind: 'road' });
    const evs = drive(sim, 3, LOW);
    expect(ofType(evs, 'plank').length).toBeGreaterThan(5);
    expect(ofType(evs, 'pit')).toHaveLength(0);
    expect(sim.px).toBeGreaterThan(x + 5.5);
    // stopped on a bridge: the plank gives way
    const st = later();
    flatRoad(st);
    st.segs.length = 0;
    st.segs.push({ x0: st.px - 30, x1: st.px - 0.3, y: 0, kind: 'road' });
    for (let i = 0; i < 4; i++) st.segs.push({ x0: st.px - 0.3 + i * 0.55, x1: st.px - 0.3 + (i + 1) * 0.55 - 0.04, y: 0, kind: 'bridge', crumble: -1 });
    st.segs.push({ x0: st.px + 8, x1: st.px + 300, y: 0, kind: 'road' });
    stone(st, st.px + 0.4, { hp: 1e6, max: 1e6, h: 3.2 });
    const e2 = drive(st, 3, LOW);
    expect(ofType(e2, 'pit').length).toBe(1);
    expect(ofType(e2, 'lift').length).toBe(1);
  });

  it('a swinging weight hurts him when it meets him low; a jump over it at its lowest clears it', () => {
    const c = pendAt({ x: 10, y: 0, ph: 0 });
    expect(c.x).toBeCloseTo(10, 5);
    expect(c.y).toBeCloseTo(RULES.pend.low, 5);
    expect(pendAt({ x: 10, y: 0, ph: Math.PI / 2 }).y).toBeGreaterThan(c.y);
    const sim = later();
    flatRoad(sim);
    sim.speed = 0;
    sim.pends.push({ id: 1, x: sim.px, y: 0, ph: 0, hitT: 0 });
    const evs = drive(sim, 0.1, LOW, { t: 0 }, () => { sim.speed = 0; });
    expect(ofType(evs, 'harm')[0]?.kind).toBe('pend');
    expect(harmWith('pend', 0, 0, false)).toBe(RULES.harm.pend);
  });

  it('a smoke curtain takes half the sword, all of a power, and burns in the light above the threshold', () => {
    const sim = later();
    flatRoad(sim);
    const cur = stone(sim, sim.px + 2, { barrier: true, h: RULES.barrier.h, w: RULES.barrier.w, hp: 100 * sim.power, max: 100 * sim.power, stones: 2 });
    drive(sim, 1.5, LOW);
    const strikes = Math.round((100 * sim.power - cur.hp) / (sim.power * RULES.barrier.sword));
    expect(strikes).toBeGreaterThan(2);
    // a power bites in full: Głaz's hammer
    const g = withParty(['glaz']);
    const c1 = stone(g, g.px + 3, { barrier: true, h: RULES.barrier.h, w: RULES.barrier.w, hp: 999, max: 999, stones: 2 });
    g.party[0].charge = 1;
    drive(g, 0.1, LOW);
    expect(999 - c1.hp).toBeCloseTo(g.power * hukFor(1), 0);
    // the light burns it
    const lit = later();
    flatRoad(lit);
    intoPush(lit, { t: 0 }, HIGH);
    drive(lit, 1, HIGH, { t: 8 });
    const c2 = stone(lit, lit.px + 2.2, { barrier: true, h: RULES.barrier.h, w: RULES.barrier.w, hp: 6, max: 6, stones: 2 });
    lit.speed = 0;
    const evs = drive(lit, 4, HIGH, { t: 9 }, () => { lit.speed = 0; lit.px = c2.x - 2.2; });
    expect(c2.alive).toBe(false);
    expect(ofType(evs, 'break')[0]).toMatchObject({ what: 'barrier', via: 'light' });
  });
});

describe('Dolina v3: gear, chests, provisions, missions, forms', () => {
  it('puts a better piece on, turns an equal one into shards that merge into the next tier', () => {
    const p = freshProgress();
    expect(addGear(p, 'cloak', 2)).toMatchObject({ tier: 2, before: 0, merged: false });
    expect(addGear(p, 'cloak', 1)).toMatchObject({ tier: 2, shards: 1 });
    addGear(p, 'cloak', 2);
    const r = addGear(p, 'cloak', 2);   // 1 + 2 + 2 = 5 ≥ 6? no — then 2 more
    expect(r.tier).toBe(2);
    const m = addGear(p, 'cloak', 2);
    expect(m.merged).toBe(true);
    expect(m.tier).toBe(3);
    p.gear.lamp = { tier: RULES.gear.top, shards: 0 };
    expect(addGear(p, 'lamp', 6).tier).toBe(RULES.gear.top);
    expect(strengthOf(p)).toBeGreaterThan(0);
  });

  it('gear works in the run: the blade strikes faster, the cloak takes less harm, the sandals run faster', () => {
    expect(strikeGapFor(6, false)).toBeLessThan(strikeGapFor(0, false));
    expect(strikeGapFor(0, true)).toBeLessThan(strikeGapFor(0, false));
    expect(harmWith('shadow', 0, 6, false)).toBeLessThan(harmWith('shadow', 0, 0, false));
    expect(harmWith('shadow', 0, 0, true)).toBeLessThan(harmWith('shadow', 0, 0, false));
    const slow = later();
    flatRoad(slow);
    drive(slow, 5, LOW);
    const fast = later({ progress: { gear: { ...freshProgress().gear, sandals: { tier: 6, shards: 0 } } } });
    flatRoad(fast);
    drive(fast, 5, LOW);
    expect(fast.px).toBeGreaterThan(slow.px + 1);
  });

  it('rolls a chest from the play’s own luck, the same for the same seed, and opens it into the progress', () => {
    const p = freshProgress();
    const a = rollChest(p, 'guard', mulberry32(4)), b = rollChest(p, 'guard', mulberry32(4));
    expect(a).toEqual(b);
    const kinds = new Set<string>();
    const rnd = mulberry32(11);
    p.found = ['glaz'];
    for (let i = 0; i < 200; i++) {
      const d = rollChest(p, 'keeper', rnd);
      kinds.add(d.kind);
      if (d.kind === 'gear') expect(d.tier).toBeGreaterThanOrEqual(2);
      applyChest(p, d);
    }
    expect(kinds).toEqual(new Set(['gear', 'bond', 'buff']));
    expect(p.chests).toBe(200);
    expect(GEAR.some(s => p.gear[s].tier > 0)).toBe(true);
  });

  it('a guardian beaten opens a chest and a slot', () => {
    const sim = later({ planned: 600, progress: { level: 3, found: ['glaz', 'babcia'], party: ['glaz'] } });
    flatRoad(sim);
    expect(sim.slots).toBe(1);
    sim.arena = { x: sim.px + 1, y: 0, level: 3, guard: null, done: false };
    const evs = drive(sim, 150, () => (sim.block.kind === 'push' ? LOW : CALM));
    expect(ofType(evs, 'chest').some(e => e.source === 'guard')).toBe(true);
    expect(ofType(evs, 'slot')[0].n).toBe(2);
    expect(sim.party.map(m => m.id)).toContain('babcia');
    // the first guardian ever: the clock tower opens, and the summary says where to find it
    expect(ofType(evs, 'towerOpen')).toHaveLength(1);
    expect(sim.result().highlights).toContain(t('hl.towerOpen'));
  });

  it('eats one run of each provision once, however often the result is read', () => {
    const sim = later({ planned: 60, progress: { buffs: { honey: 3, raisins: 0, dates: 1 } } });
    expect([...sim.buffs].sort()).toEqual(['dates', 'honey']);
    drive(sim, 70, LOW);
    sim.result();
    sim.result();
    expect(sim.p.buffs).toEqual({ honey: 2, raisins: 0, dates: 0 });
  });

  it('offers three different missions it can ask now; done ones pay, climb a rung, and every third brings a chest', () => {
    const p = freshProgress();
    expect(p.missions).toHaveLength(3);
    expect(new Set(p.missions.map(m => m.kind)).size).toBe(3);
    expect(p.missions.some(m => m.kind === 'floors' || m.kind === 'powers')).toBe(false);
    const m = p.missions[0];
    const chest = completeMission(p, m);
    expect(chest).toBe(false);
    expect(p.missions).toHaveLength(3);
    expect(p.rungs[m.kind]).toBe(1);
    // in the run: a blocks mission done by breaking blocks
    const sim = later({ progress: { missions: [{ kind: 'blocks', goal: 2, have: 0, rung: 0 }, { kind: 'lambs', goal: 5, have: 0, rung: 0 }, { kind: 'doubles', goal: 8, have: 0, rung: 0 }], missionsDone: 2 } });
    flatRoad(sim);
    stone(sim, sim.px + 2, { hp: 1, max: 1 });
    stone(sim, sim.px + 4.5, { hp: 1, max: 1 });
    const evs = drive(sim, 2.5, LOW);
    const done = ofType(evs, 'mission');
    expect(done).toHaveLength(1);
    expect(done[0].chest).toBe(true);
    expect(ofType(evs, 'chest').some(e => e.source === 'mission')).toBe(true);
    expect(sim.p.missions.some(x => x.kind === 'blocks' && x.have > 0)).toBe(false);
    expect(MISSIONS.length).toBeGreaterThan(8);
  });

  it('forms bring perks: the stomp shakes, the light quickens the sword, the flap rings out', () => {
    expect(lookOf(RULES.looks[5])).toBe(5);
    // the traveller's stomp shakes a block beside the shadow
    const sim = later({ progress: { sparksAll: RULES.looks[1] } });
    flatRoad(sim);
    drive(sim, 1, LOW);
    sim.shadows.push({ id: 71, kind: 'glinianek', x: sim.px + 3.1, y: 0, r: 0.32, h: 0.95, hp: 5, max: 5, state: 'walk', age: 0, hitT: 0, stun: 99, inLight: false, burn: 0, throwT: 9, bob: 0 });
    const near = stone(sim, sim.px + 3.9, { hp: 999, max: 999 });
    sim.press();
    const evs = drive(sim, 1, LOW);
    expect(ofType(evs, 'shock').length).toBe(1);
    expect(near.hp).toBeLessThan(999);
    // the master of the lamp: the double jump's ring
    const m = later({ progress: { sparksAll: RULES.looks[5] } });
    flatRoad(m);
    m.shadows.push({ id: 72, kind: 'kruk', x: m.px + 2, y: 1.2, r: 0.3, h: 0.45, hp: 99, max: 99, state: 'walk', age: 0, hitT: 0, stun: 99, inLight: false, burn: 0, throwT: 9, bob: 0 });
    m.press();
    drive(m, 0.2, LOW);
    m.press();
    const e2 = m.take();
    expect(ofType(e2, 'flameRing').length).toBe(1);
  });

  it('migrates a version-2 save in place: everything it saved stays, the new fields come fresh, and it plays', () => {
    const v2 = {
      ver: 2, sessions: 14, total: 9120, sparks: 412, sparksAll: 1680, ups: { stone: 3, forge: 2, income: 1, lamp: 2, oil: 1 }, level: 8, top: 7,
      stars: { '1': 3, '2': 2, '3': 3, '4': 1, '5': 2, '6': 3, '7': 1 }, lambs: 31, guards: 2, dawns: 6, pushes: 40,
      best: { '300': 1450, '180': 980 }, lastLen: 300, bestCombo: 27, seen: ['tide', 'meadow', 'guard', 'open', 'stairs'], giftDay: '2026-11-08',
    };
    // the runner loads a save as mergeSaved(fresh, saved): fresh v3 fields, the save's own over them
    const p = { ...freshProgress(), ...v2, ups: { ...freshProgress().ups, ...v2.ups } } as unknown as DolinaProgress;
    migrate(p);
    expect(p.ver).toBe(3);
    for (const k of ['sessions', 'total', 'sparks', 'sparksAll', 'level', 'top', 'lambs', 'guards', 'dawns', 'pushes', 'lastLen', 'bestCombo', 'giftDay'] as const) {
      expect(p[k]).toBe(v2[k]);
    }
    expect(p.ups).toEqual(v2.ups);
    expect(p.stars).toEqual(v2.stars);
    expect(p.best).toEqual(v2.best);
    expect(p.seen).toEqual(v2.seen);
    expect(p.mode).toBe('valley');
    expect(p.tower).toEqual({ floor: 1, best: 0, night: 0 });
    expect(p.found).toEqual([]);
    expect(p.missions).toHaveLength(3);
    expect(lookOf(p.sparksAll)).toBe(3);
    expect(slotsFor(p.guards)).toBe(3);
    expect(migrate(p)).toBe(p);
    expect(p.ver).toBe(3);
    // it plays at its level, and the first companion's cage stands on the way (catch-up)
    const sim = new DolinaSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 600, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.level).toBe(8);
    expect(sim.form).toBe(3);
    let cage = false;
    drive(sim, 120, () => (sim.block.kind === 'push' ? HIGH : CALM), { t: 0 }, () => {
      if (sim.stonesOnRoad.some(s => s.cage)) cage = true;
      if (sim.grounded && (sim.blocked === 'wall' || sim.stonesOnRoad.some(s => s.alive && s.tall && !s.cage && s.x - sim.px < 1.6 && s.x > sim.px))) sim.press();
      else if (!sim.grounded && sim.airUsed === 0 && sim.vy < 0.5 && sim.vy > -1 && sim.blocked === 'wall') sim.press();
    });
    expect(cage).toBe(true);
    // a damaged version-3 save never crashes
    const broken = { ...freshProgress(), found: ['glaz', 'nobody', 'glaz', 7], party: ['kozica', 'glaz'], gear: { blade: { tier: 99 }, cloak: 'x' }, tower: null, mode: 'moon', missions: [{ kind: 'nope' }, { kind: 'lambs', goal: 'x' }], buffs: 3 } as unknown as DolinaProgress;
    migrate(broken);
    expect(broken.found).toEqual(['glaz']);
    expect(broken.party).toEqual(['glaz']);
    expect(broken.gear.blade.tier).toBe(RULES.gear.top);
    expect(broken.gear.cloak).toEqual({ tier: 0, shards: 0 });
    expect(broken.tower).toEqual({ floor: 1, best: 0, night: 0 });
    expect(broken.mode).toBe('valley');
    expect(broken.missions).toHaveLength(3);
    expect(broken.buffs).toEqual({ honey: 0, raisins: 0, dates: 0 });
  });
});

// ── mobile first (DESIGN §12) ─────────────────────────────────────
const PX = /(\d+(?:\.\d+)?)px/;
const pxOf = (f: unknown): number => Number(String(f).match(PX)?.[1] ?? 10);

/**
 * A 2D context that draws nothing: it measures text at 0.56 em a character and notes every string it is
 * asked to write at its largest size (as the mobile audit does), so the view and the HUD run in a test.
 */
function fakeCtx(texts = new Map<string, number>()): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, lineWidth: 1 };
  const grad = { addColorStop: () => undefined };
  const note = (s: unknown) => {
    const k = String(s), px = pxOf(state.font);
    if (k.trim()) texts.set(k, Math.max(texts.get(k) ?? 0, px));
  };
  const fns: Record<string, (...a: unknown[]) => unknown> = {
    measureText: (s: unknown) => ({ width: String(s).length * pxOf(state.font) * 0.56 }),
    fillText: note, strokeText: () => undefined,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(state, {
    get: (o, k) => (typeof k === 'string' && k in fns ? fns[k] : k in o ? o[k] : () => undefined),
    set: (o, k, v) => { o[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

const silent = new Proxy({ on: false }, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => undefined) }) as unknown as ArcadeAudio;

/** The game as the runner makes it, on a canvas that draws nothing (a phone: touch, the insets of a CHECK_SIZES entry). */
function phoneGame(progress: Partial<DolinaProgress>, ins: Insets, texts?: Map<string, number>): { game: ArcadeGame; sim: DolinaSim; hints: string[] } {
  const ctx = fakeCtx(texts);
  const hints: string[] = [];
  const env = {
    canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement, hud: document.createElement('div'), audio: silent,
    progress: { ...freshProgress(), ...progress }, rng: mulberry32(5), day: DAY, daySeed: 4242, plannedSec: 300, tool: 'fnirs' as const,
    simulated: true, reducedMotion: false, haptics: false, tuning: TUNING,
    hint: (text: string) => { hints.push(text); }, hudTop: () => ins.top, insets: () => ins, touch: true,
  } satisfies GameEnv<DolinaProgress>;
  const game = dolina.create(env);
  return { game, sim: (game as unknown as { sim: DolinaSim }).sim, hints };
}

const RETURNING: Partial<DolinaProgress> = { sessions: 5, giftDay: DAY, pushes: 1, seen: ['tide', 'meadow', 'guard', 'open', 'fog', 'dawn', 'stairs', 'cage', 'mate', 'power', 'chest', 'tower', 'bridge', 'pend', 'barrier'] };

/** Every kind of card and toast the play shows, with its real words. */
function showAll(hud: Hud): (() => void)[] {
  return [
    () => hud.card('story', t('story.title'), t('story.text'), RULES.storySec, { verse: 'psa23.4' }),
    () => hud.card('story', t('tower.title'), t('tower.text'), RULES.storySec, { verse: 'php3.14' }),
    () => hud.card('level', t('level.done', { n: 12 }), '+48 iskier', RULES.cardSec, {
      stars: 2, lines: [[t('level.star.top'), true], [t('level.star.lambs', { a: 1, b: 2 }), false], [t('level.star.tide'), true]],
    }),
    () => hud.card('level', eraName('twierdza'), t('era.twierdza.text'), 3.2, { lines: [[t('era.lap', { n: 2 }), false]] }),
    () => hud.card('level', t('card.found'), compText('babcia'), 3.4, { portrait: 'babcia', sub2: compName('babcia'), sub3: t('card.power', { power: powerName('babcia') }) }),
    () => hud.card('finale', t('finale.title'), t('finale.sub', { metres: t('metres', { n: 1240 }) }), 6),
    () => hud.card('toast', t('fx.dawn'), t('fx.dawnSub'), 2.4),
    () => hud.card('toast', t('fx.chest'), 'Srebrne ostrze · +1 do pancerza', 3, { icon: 'chest' }),
    () => hud.card('toast', t('fx.mission', { text: missionText('stairs', 11) }), '+55 iskier', 2.6, { icon: 'check' }),
  ];
}

describe('Dolina: mobile first', () => {
  it('never asks for canvas text under 11 px', () => {
    for (const size of [0, 4, 8, 10.9, 11, 13, 22]) expect(pxOf(font(800, size, 'x'))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(font(560, 22, 'x', true))).toBe(22);
  });

  it('lays out every checked screen phone first: room to climb, the road ahead, the pack under the road, clear of the HUD', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets);
      const phone = Math.min(s.w, s.h) <= 430;
      expect(L.u, s.name).toBeGreaterThanOrEqual(1);
      expect(L.u, s.name).toBeLessThanOrEqual(1.3);
      if (phone) expect(L.u, s.name).toBeLessThan(1.1);
      expect(L.tall, s.name).toBe(s.w < s.h);
      // a ledge's top, both jumps and the gate in the air fit between the HUD and the floor
      expect(L.floorLine - L.top - 8, s.name).toBeGreaterThanOrEqual(ROOM * L.S - 0.5);
      // the double jump's apex with his head stays under the HUD (on its side: the 68 px row)
      expect(L.floorLine - (RULES.reach2 + 1.5) * L.S, s.name).toBeGreaterThanOrEqual(L.top);
      // more than a second of road ahead at his speed, and room behind him for the party
      expect((s.w - L.runX) / L.S / RULES.run, s.name).toBeGreaterThan(1.2);
      expect(L.runX - L.left, s.name).toBeGreaterThanOrEqual(1.8 * L.S);
      // the pack's row: under the road, inside the safe area, above the home indicator, a finger tall
      expect(L.pack.y, s.name).toBeGreaterThan(L.floorLine);
      expect(L.pack.y + L.pack.h, s.name).toBeLessThanOrEqual(s.h - s.insets.bottom);
      expect(L.pack.x, s.name).toBeGreaterThanOrEqual(s.insets.left + EDGE);
      expect(L.pack.x + L.pack.w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - EDGE);
      expect(L.pack.h, s.name).toBeGreaterThanOrEqual(36);
      // upright, a thumb's pad stays free under the pack
      if (L.tall) expect(s.h - s.insets.bottom - (L.pack.y + L.pack.h), s.name).toBeGreaterThanOrEqual(50);
      // cards fit the width with the 16 px edges, under the HUD
      expect(L.cardW, s.name).toBeLessThanOrEqual(s.w - s.insets.left - s.insets.right - 2 * EDGE);
      expect(L.cardTop, s.name).toBeGreaterThanOrEqual(s.insets.top);
    }
  });

  it('makes every card and toast a finger-sized tap target inside the safe area, at every checked size', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets);
      const hud = new Hud(fakeCtx());
      hud.resize(L);
      for (const show of showAll(hud)) {
        expect(hud.targets(), s.name).toEqual([]);
        show();
        hud.update(0.7, 0, 1);
        const tg = hud.targets();
        expect(tg, s.name).toHaveLength(1);
        expect(auditTargets(tg, s.w, s.h, s.insets), `${s.name}: ${tg[0].label}`).toEqual([]);
        // nothing to press in the outer 16 px of the screen's sides
        expect(tg[0].x, s.name).toBeGreaterThanOrEqual(s.insets.left + EDGE - 0.5);
        expect(tg[0].x + tg[0].w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - EDGE + 0.5);
        expect(Math.min(tg[0].w, tg[0].h), s.name).toBeGreaterThanOrEqual(MIN_TAP);
        // a card in play (not the opening story, which runs on a quiet road) leaves the pilgrim's floor in sight
        if (!tg[0].label.includes('story')) expect(tg[0].y + tg[0].h, `${s.name}: ${tg[0].label}`).toBeLessThan(L.floorLine);
        // a tap on it closes it
        expect(hud.tap(tg[0].x + tg[0].w / 2, tg[0].y + tg[0].h / 2)).toBe(true);
        hud.update(0.3, 0, 1);
        expect(hud.targets(), s.name).toEqual([]);
      }
    }
  });

  it('keeps Ćma quiet over a coach mark the runner holds under its block banner (one voice at a time)', () => {
    const sim = later({ progress: { seen: ['tide', 'guard', 'open', 'fog', 'dawn', 'stairs'] } });
    const clock = { t: 0 };
    let at = -1;
    for (let i = 0; i < 60 * 80 && at < 0; i++) {
      clock.t += STEP;
      sim.update(STEP, LOW, clock.t);
      for (const e of sim.take()) if (e.type === 'teach' && e.what === 'meadow') at = sim.blockT;
    }
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(RULES.bannerSec);
    // past the block's own quiet start (5.6 s) the coach mark is still on screen: she waits for it
    drive(sim, 5.9 - sim.blockT, CALM, clock);
    expect(sim.bannerLeft).toBe(0);
    expect(sim.quiet).toBe(true);
    drive(sim, RULES.bannerSec + 3.6 - sim.blockT, CALM, clock);
    expect(sim.quiet).toBe(false);
  });

  it('waits with its cards while the runner’s block banner covers the top band', () => {
    const hud = new Hud(fakeCtx());
    hud.resize(layout(360, 500, CHECK_SIZES[0].insets));
    hud.card('toast', t('fx.dawn'), t('fx.dawnSub'), 2.4);
    hud.update(3, 0, 1, true);
    expect(hud.targets()).toEqual([]);
    hud.update(0.7, 0, 1, false);
    expect(hud.targets()).toHaveLength(1);
  });

  it('keeps the sword’s number when a phone has to cut its name', () => {
    const ctx = fakeCtx();
    for (const tier of [1, 5, 12]) {
      const full = weaponName(tier);
      expect(weaponLabel(ctx, tier, 400, 15)).toBe(full);
      const cut = weaponLabel(ctx, tier, 60, 15);
      expect(cut.endsWith(full.split(' ').pop()!)).toBe(true);
      expect(pxOf(ctx.font)).toBeGreaterThanOrEqual(MIN_READ);
    }
  });

  it('draws no play text under 13 px on the smallest phone (cards, bubbles, the pack, numbers, signs)', () => {
    const texts = new Map<string, number>();
    const ins = CHECK_SIZES[0].insets;
    const { game, sim } = phoneGame({ ...RETURNING, sparksAll: RULES.looks[2], found: ['glaz', 'babcia'], party: ['glaz', 'babcia'], guards: 2 }, ins, texts);
    game.resize(360, 500, 3);
    game.start();
    const hud = (game as unknown as { view: { hud: Hud } }).view.hud;
    let tt = 0;
    for (let i = 0; i < 60 * 70; i++) {
      tt += STEP;
      const live = sim.block.kind === 'push' ? HIGH : CALM;
      game.update(STEP, live, tt);
      if (i % 40 === 0) game.pointer!({ type: 'down', x: 220, y: 440, id: 1 });
      if (i % 40 === 8) game.pointer!({ type: 'up', x: 220, y: 440, id: 1 });
      if (i % 600 === 300) for (const show of showAll(hud)) show();
      game.draw();
    }
    const small = [...texts].filter(([, px]) => px < MIN_READ);
    expect(small).toEqual([]);
    expect(texts.size).toBeGreaterThan(12);
  });

  it('reads a tap as a jump and a swipe down as a stomp; the swipe takes back the double jump its own press made', () => {
    const { game, sim } = phoneGame(RETURNING, CHECK_SIZES[0].insets);
    game.resize(360, 500, 3);
    game.start();
    flatRoad(sim);
    let tt = 0;
    const run = (sec: number) => { for (let i = 0; i < Math.round(sec / STEP); i++) { tt += STEP; game.update(STEP, LOW, tt); } };
    run(0.5);
    // a tap with a finger's wobble: a jump, no stomp
    game.pointer!({ type: 'down', x: 200, y: 440, id: 1 });
    expect(sim.grounded).toBe(false);
    game.pointer!({ type: 'move', x: 203, y: 446, id: 1 });
    expect(sim.stomping).toBe(false);
    run(0.12);
    game.pointer!({ type: 'up', x: 203, y: 446, id: 1 });
    // a second press in the air is the double jump; the same finger swiping down at once makes it a stomp
    run(0.1);
    game.pointer!({ type: 'down', x: 200, y: 420, id: 2 });
    expect(sim.airUsed).toBe(1);
    expect(sim.doubles).toBe(1);
    run(0.05);
    game.pointer!({ type: 'move', x: 204, y: 420 + SWIPE + 2, id: 2 });
    expect(sim.stomping).toBe(true);
    expect(sim.airUsed).toBe(0);
    expect(sim.doubles).toBe(0);
    game.pointer!({ type: 'up', x: 204, y: 450, id: 2 });
    run(1);
    expect(sim.grounded).toBe(true);
    // a sideways drag is not a stomp; a slow swipe long after a double jump keeps the jump counted
    game.pointer!({ type: 'down', x: 200, y: 440, id: 3 });
    game.pointer!({ type: 'up', x: 200, y: 440, id: 3 });
    run(0.15);
    game.pointer!({ type: 'down', x: 200, y: 400, id: 4 });
    expect(sim.doubles).toBe(1);
    game.pointer!({ type: 'move', x: 240, y: 400 + SWIPE, id: 4 });
    expect(sim.stomping).toBe(false);
    run(UNDO_SEC + 0.05);
    game.pointer!({ type: 'move', x: 200, y: 400 + SWIPE + 30, id: 4 });
    expect(sim.stomping || sim.grounded).toBe(true);
    expect(sim.doubles).toBe(1);
    game.pointer!({ type: 'up', x: 200, y: 440, id: 4 });
    expect(SWIPE).toBeGreaterThanOrEqual(20);
  });

  it('reports a card as its only target; a tap on it closes it and still jumps', () => {
    const { game, sim } = phoneGame(RETURNING, CHECK_SIZES[0].insets);
    game.resize(360, 500, 3);
    game.start();
    flatRoad(sim);
    const view = (game as unknown as { view: { hud: Hud } }).view;
    let tt = 0;
    const run = (sec: number) => { for (let i = 0; i < Math.round(sec / STEP); i++) { tt += STEP; game.update(STEP, LOW, tt); } };
    run(9);
    expect(game.targets!()).toEqual([]);
    view.hud.card('level', eraName('miasto'), t('era.miasto.text'), 3.2);
    run(0.6);
    const tg = game.targets!();
    expect(tg).toHaveLength(1);
    expect(auditTargets(tg, 360, 500, CHECK_SIZES[0].insets)).toEqual([]);
    game.pointer!({ type: 'down', x: tg[0].x + tg[0].w / 2, y: tg[0].y + tg[0].h / 2, id: 9 });
    expect(sim.grounded).toBe(false);
    run(0.4);
    expect(game.targets!()).toEqual([]);
  });

  it('speaks to a finger in the how-to: the keys only in their own row (left out on a phone)', () => {
    const how = dolina.howto!();
    expect(how.hands.map(h => h.gesture)).toEqual(['tap', 'hold', 'swipe', 'keys']);
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[lang] as Record<string, unknown>;
      for (const k of ['how.tap', 'how.hold', 'how.down', 'how.goal', 'how.tip1', 'how.tip2']) {
        expect(String(cat[k]), `${lang} ${k}`).not.toMatch(/Spac|Space|Leertaste|mellanslag|↑|↓|WASD|klaw|Taste|tangent|\bkey/i);
      }
      expect(String(cat['how.keys']), lang).toMatch(/↑/);
    }
  });
});
