import { describe, expect, it } from 'vitest';
import { SAY, lineSec } from '../src/arcade/dolina/companion';
import { ERAS, SEQ, UPGRADES, eraOfLevel, guardLevel, powerOf, weaponName } from '../src/arcade/dolina/content';
import { CATALOGS, t } from '../src/arcade/dolina/i18n';
import {
  bestOf, buyUp, freshProgress, lookOf, migrate, setStars, starTotal, starsOf, upLevel, upPrice, type DolinaProgress,
} from '../src/arcade/dolina/meta';
import { RULES } from '../src/arcade/dolina/rules';
import {
  DolinaSim, LAMP_MARK, WARM_PLAN, answerFor, comboMult, finaleFor, harmFor, lampFor, ledgeFor, planBlocks, stagePlan, starsFor, stepsFor, stoneHp,
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
    expect(what.every(w => ['tide', 'meadow', 'guard', 'open', 'fog', 'dawn', 'stairsJump', 'stairsDouble', 'stairsClimb'].includes(w))).toBe(true);
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
    expect(p.ver).toBe(2);
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
});
