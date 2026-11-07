import { describe, expect, it } from 'vitest';
import { ARMOURY, DRAGONS, LINES, LINE_COUNT, SKILLS } from '../src/arcade/jerzy/content';
import { CATALOGS, t, unit } from '../src/arcade/jerzy/i18n';
import { armouryOf, bestOf, dragonAt, freshProgress, hpOf, phaseAt, phasesOf, type JerzyProgress } from '../src/arcade/jerzy/meta';
import { RULES } from '../src/arcade/jerzy/rules';
import { JerzySim, SHIELD_MARK, finaleFor, levelNeed, planBlocks, shieldFor, type SimEvent } from '../src/arcade/jerzy/sim';
import { Talk } from '../src/arcade/jerzy/talk';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<JerzyProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): JerzySim {
  const sim = new JerzySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, ...o.progress } });

function drive(sim: JerzySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** The dragon stands still at (x, y), facing the knight, attacking nothing for a long while. */
function still(sim: JerzySim, x = 5, y = 3, clear = true): void {
  const d = sim.dragon;
  Object.assign(d, { x, y, tx: x, ty: y, state: 'flaw', st: 0, dur: 999, air: 0, under: false, pattern: null });
  sim.zones.length = 0;
  if (clear) {
    sim.flames.length = 0;
    sim.balls.length = 0;
  }
  sim.story = null;
}

/** The knight stands at (x, y), not walking. */
function stand(sim: JerzySim, x = 5, y = 6): void {
  Object.assign(sim.knight, { x, y, tx: x, ty: y, walking: false, engage: false, rollT: 0, safe: 0, down: 0, face: -Math.PI / 2 });
}

/** Into a block, keeping the dragon out of the way of the rule under test. */
function toBlock(sim: JerzySim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a Postój, the last clash at the end', () => {
    for (const planned of [40, 60, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const total = plan.reduce((s, b) => s + b.dur, 0);
        expect(total + finaleFor(planned)).toBeCloseTo(planned, 0);
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[plan.length - 1].kind).toBe('rest');
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
      }
    }
  });

  it('telegraphs the next block 4 s ahead and ends with the last clash, then the fight is over', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    const evs = drive(sim, 60 - finaleFor(60) + 0.1, frame(), clock);
    expect(ofType(evs, 'telegraph').length).toBeGreaterThanOrEqual(2);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('finale');
    const end = drive(sim, finaleFor(60), frame(), clock);
    expect(ofType(end, 'done')).toHaveLength(1);
    expect(sim.canStop()).toBe(true);
  });

  it('reports each block to the dock: focus, rest, free in the warm-up and the last clash', () => {
    const sim = makeSim({ planned: 180 });
    expect(sim.block.kind).toBe('warmup');
    toBlock(sim, 1);
    expect(sim.pushBlock).toBe(true);
    toBlock(sim, 2);
    expect(sim.restBlock).toBe(true);
  });
});

describe('the knight (touch)', () => {
  it('walks where tapped, and goes after the dragon when the tap is on it', () => {
    const sim = later();
    still(sim, 5, 2.5);
    stand(sim, 2, 6);
    sim.tap(8, 6);
    drive(sim, 2, frame());
    expect(sim.knight.x).toBeCloseTo(8, 1);
    expect(sim.knight.walking).toBe(false);
    sim.tap(5, 2.5);
    expect(sim.knight.engage).toBe(true);
    drive(sim, 2, frame());
    expect(sim.gap).toBeLessThanOrEqual(sim.reach + 1e-6);
  });

  it('strikes by himself when the dragon is in reach: a scale a strike, live in the headline', () => {
    const sim = later();
    still(sim, 5, 3);
    stand(sim, 5, 3 + sim.dragon.spec.r + RULES.knightR + 0.5);
    const evs = drive(sim, 2, frame(), { t: 0 }, () => still(sim, 5, 3));
    const strikes = ofType(evs, 'strike');
    expect(strikes.length).toBeGreaterThanOrEqual(3);
    expect(sim.score).toBe(ofType(evs, 'scales').reduce((s, e) => s + e.n, 0));
    expect(sim.score).toBeGreaterThan(0);
  });

  it('does not strike out of reach', () => {
    const sim = later();
    still(sim, 5, 2);
    stand(sim, 5, 7);
    const evs = drive(sim, 1.5, frame(), { t: 0 }, () => still(sim, 5, 2));
    expect(ofType(evs, 'strike')).toHaveLength(0);
  });

  it('rolls: a quick dodge, invulnerable for a moment, then a cooldown', () => {
    const sim = later();
    still(sim, 5, 2);
    stand(sim, 5, 6);
    expect(sim.roll(1, 0)).toBe(true);
    expect(sim.knight.safe).toBeGreaterThan(0);
    expect(sim.roll(1, 0)).toBe(false);
    drive(sim, RULES.rollSec + 0.05, frame());
    expect(sim.knight.x).toBeCloseTo(5 + RULES.rollDist, 1);
    drive(sim, RULES.rollCool, frame());
    expect(sim.roll()).toBe(true);
  });
});

describe('the shield (the live gauge)', () => {
  it('has radius shieldMin + level × shieldExtra, the dotted mark at level 0.5', () => {
    expect(shieldFor(0)).toBeCloseTo(RULES.shieldMin);
    expect(shieldFor(1)).toBeCloseTo(RULES.shieldMin + RULES.shieldExtra);
    expect(SHIELD_MARK).toBeCloseTo(RULES.shieldMin + RULES.shieldExtra / 2);
  });

  it('answers the level only in a sighted Tarcza past its lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      drive(sim, RULES.leadIn[eeg ? 'eeg' : 'fnirs'] - 0.3, HIGH);
      expect(sim.shieldLook).toBe('wait');
      expect(sim.shieldR).toBeLessThan(RULES.shieldMin + 0.05);
      drive(sim, 3, HIGH);
      expect(sim.shieldLook).toBe('live');
      expect(sim.shieldR).toBeGreaterThan(SHIELD_MARK);
    }
  });

  it('rests at the buckler while the signal is unreliable — never smaller', () => {
    const sim = later();
    drive(sim, 8, HIGH);
    drive(sim, 3, NONE);
    expect(sim.shieldLook).toBe('grey');
    expect(sim.shieldR).toBeCloseTo(sim.buckler, 1);
    expect(sim.shieldR).toBeGreaterThanOrEqual(RULES.shieldMin - 1e-9);
  });

  it('puts out fire that meets it (charging the Miecz); flames past a small one cost heart', () => {
    const big = later();
    still(big, 5, 2);
    stand(big, 5, 6);
    drive(big, 8, HIGH, { t: 0 }, () => still(big, 5, 2));
    big.flames.push({ id: 900, x: 5, y: 4, vx: 0, vy: 6, r: RULES.blobR, life: 2 });
    big.flames.push({ id: 901, x: 5.6, y: 4, vx: 0, vy: 6, r: RULES.blobR, life: 2 });
    const e1 = drive(big, 0.6, HIGH);
    expect(ofType(e1, 'quench')).toHaveLength(2);
    expect(big.charge).toBeCloseTo(2 * RULES.quenchBlob, 3);
    expect(big.knight.heart).toBe(1);

    const small = later();
    still(small, 5, 2);
    stand(small, 5, 6);
    drive(small, 1, frame({ level: 0 }), { t: 0 }, () => still(small, 5, 2));
    small.flames.push({ id: 902, x: 5.45, y: 4, vx: 0, vy: 6, r: RULES.blobR, life: 2 });
    const e2 = drive(small, 0.6, frame({ level: 0 }));
    expect(ofType(e2, 'quench')).toHaveLength(0);
    expect(ofType(e2, 'burn')).toHaveLength(1);
    expect(small.knight.heart).toBeCloseTo(1 - RULES.hurt.blob);
  });

  it('a fireball landing on the shield is put out; one landing by the knight splashes him', () => {
    const sim = later();
    still(sim, 5, 2);
    stand(sim, 5, 6);
    drive(sim, 8, HIGH, { t: 0 }, () => still(sim, 5, 2));
    sim.balls.push({ id: 910, x0: 5, y0: 2, x1: 5, y1: 5.7, t: 0, dur: 0.2, drop: false });
    const e1 = drive(sim, 0.3, HIGH);
    expect(ofType(e1, 'quench').filter(e => e.big)).toHaveLength(1);
    const small = later();
    still(small, 5, 2);
    stand(small, 5, 6);
    drive(small, 1, frame({ level: 0 }), { t: 0 }, () => still(small, 5, 2));
    small.balls.push({ id: 911, x0: 5, y0: 2, x1: 5, y1: 6.6, t: 0, dur: 0.2, drop: false });
    const e2 = drive(small, 0.3, frame({ level: 0 }));
    expect(ofType(e2, 'burn').map(e => e.what)).toEqual(['ball']);
  });
});

describe('the Miecz światła', () => {
  it('fills from a held focus (5 s Mendi) and makes the next strike a great one', () => {
    const sim = later();
    still(sim, 5, 2);
    stand(sim, 5, 7.6);
    const hold = (t: number) => frame({ level: 0.9, activity: 6, focused: true, hold: t, calm: 0.05 });
    const evs = drive(sim, 21, hold, { t: 0 }, () => still(sim, 5, 2));
    expect(ofType(evs, 'swordReady')).toHaveLength(1);
    expect(sim.swordReady).toBe(true);
    // walk into reach: the first strike is the sword
    stand(sim, 5, 2 + sim.dragon.spec.r + RULES.knightR + 0.4);
    const before = sim.score;
    const e2 = drive(sim, 0.2, HIGH, { t: 21 }, () => still(sim, 5, 2));
    const s = ofType(e2, 'strike')[0];
    expect(s.sword).toBe(true);
    expect(sim.score - before).toBe(Math.min(RULES.swordScales, sim.dragon.phases[0]));
    expect(sim.swordReady).toBe(false);
    expect(sim.swords).toBe(1);
  });

  it('never charges from the hold before the lead-in or without signal', () => {
    const sim = later();
    const quiet = () => { still(sim, 5, 1); stand(sim, 5, 7.5); };
    drive(sim, 4, frame({ level: 0.9, hold: 6, focused: true }), { t: 0 }, quiet);
    expect(sim.charge).toBe(0);
    drive(sim, 6, frame({ reliable: false, level: 0.9, hold: 6 }), { t: 4 }, quiet);
    expect(sim.charge).toBe(0);
  });
});

describe('the dragon', () => {
  it('telegraphs every attack at least 0.8 s before it lands', () => {
    const sim = later();
    let at = -1, last = '';
    const gaps: number[] = [];
    drive(sim, 30, frame(), { t: 0 }, t => {
      sim.knight.safe = 1;
      if (sim.choice) sim.pick(0);
      for (const e of (sim as unknown as { events: SimEvent[] }).events) {
        if (e.type === 'tele') { at = t; last = e.pattern; }
        if (e.type === 'attack') {
          expect(e.pattern).toBe(last);
          gaps.push(t - at);
        }
      }
    });
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(0.8 * RULES.teleFast ** 2 - 0.02);
    for (const p of Object.keys(RULES.tele) as (keyof typeof RULES.tele)[]) expect(RULES.tele[p]).toBeGreaterThanOrEqual(0.8 - 1e-9);
  });

  it('roars into a new phase when its scales run out, and flies off over the hills after the last', () => {
    const sim = later();
    const d = sim.dragon;
    still(sim, 5, 3);
    d.left = 1;
    stand(sim, 5, 3 + d.spec.r + RULES.knightR + 0.4);
    const evs = drive(sim, 0.7, frame(), { t: 0 }, () => { if (sim.dragon.state !== 'roar') still(sim, 5, 3); });
    expect(ofType(evs, 'phase')).toHaveLength(1);
    expect(sim.dragon.phase).toBe(1);
    // the last phase
    still(sim, 5, 3);
    sim.dragon.left = 1;
    stand(sim, 5, 3 + d.spec.r + RULES.knightR + 0.4);
    const e2 = drive(sim, 0.8, frame());
    expect(ofType(e2, 'driven').map(e => e.kind)).toEqual(['zielony']);
    expect(sim.dragon.state).toBe('leave');
    const e3 = drive(sim, 6, frame());
    expect(sim.dragon.spec.kind).toBe('bagienny');
    expect(ofType(e3, 'arrive')).toHaveLength(1);
    expect(sim.drivenNow).toEqual(['zielony']);
  });

  it('is open after its flaw pattern; with Linda\'s tip strikes there knock off twice the scales', () => {
    const sim = later();
    still(sim, 5, 3);
    stand(sim, 5, 3 + sim.dragon.spec.r + RULES.knightR + 0.4);
    sim.tipActive = true;
    Object.assign(sim.dragon, { state: 'flaw', st: 0, dur: 2 });
    const evs = drive(sim, 0.7, frame());
    const s = ofType(evs, 'strike');
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s[0].flaw).toBe(true);
    expect(s[0].n).toBe(2);
  });
});

describe('grace', () => {
  it('at no heart the knight is knocked down, gets Linda\'s apple and stands up with half; the dragon backs off', () => {
    const sim = later();
    still(sim, 5, 2);
    stand(sim, 5, 6);
    sim.knight.heart = 0.02;
    sim.flames.push({ id: 920, x: 5.5, y: 5.5, vx: 0, vy: 3, r: RULES.blobR, life: 2 });
    const evs = drive(sim, 0.4, frame({ level: 0 }));
    expect(ofType(evs, 'down')).toHaveLength(1);
    expect(sim.dragon.state).toBe('breather');
    const e2 = drive(sim, RULES.downSec + 0.2, frame());
    expect(ofType(e2, 'up')).toHaveLength(1);
    expect(sim.knight.heart).toBeCloseTo(RULES.heartBack, 1);
  });

  it('never ends the fight early, however often he falls', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    drive(sim, 40, frame({ level: 0 }), clock, () => { if (sim.knight.down <= 0) sim.knight.heart = 0.01; });
    expect(sim.phase).not.toBe('done');
    expect(sim.downs).toBeGreaterThan(0);
  });
});

describe('the Postój', () => {
  it('sends the dragon to its cave, restores heart from calm and fills Linda\'s tip; a passed one marks the flaw', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    const evs = toBlock(sim, 1, frame(), clock);
    expect(sim.restBlock).toBe(true);
    sim.knight.heart = 0.3;
    drive(sim, 4, CALM, clock);
    expect(ofType(evs, 'nap')).toHaveLength(1);
    expect(['toCave', 'nap']).toContain(sim.dragon.state);
    const before = sim.knight.heart;
    const e2 = toBlock(sim, 2, CALM, clock);
    expect(sim.knight.heart).toBe(1);
    expect(before).toBeLessThan(1);
    expect(ofType(e2, 'restPass')).toHaveLength(1);
    expect(ofType(e2, 'tip')).toHaveLength(1);
    expect(sim.tipActive).toBe(true);
    expect(ofType(e2, 'wake')).toHaveLength(1);
  });

  it('gives no verdict without signal — never a loss', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = toBlock(sim, 2, NONE, clock);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBeNull();
    expect(sim.knight.heart).toBeGreaterThan(0);
  });
});

describe('levels and skills', () => {
  it('opens a choice of three different skills at a level-up; the fight slows; 1–3 pick', () => {
    const sim = later();
    still(sim, 5, 3);
    stand(sim, 5, 3 + sim.dragon.spec.r + RULES.knightR + 0.4);
    const evs = drive(sim, 10, frame(), { t: 0 }, () => { if (sim.dragon.state !== 'flaw') still(sim, 5, 3); });
    const lv = ofType(evs, 'level');
    expect(lv.length).toBeGreaterThanOrEqual(1);
    expect(new Set(lv[0].options).size).toBe(3);
    expect(sim.choice).not.toBeNull();
    expect(sim.timeScale).toBeLessThan(0.2);
    const id = sim.choice!.options[1];
    sim.key('2', true);
    expect(sim.taken[id]).toBe(1);
  });

  it('takes the first skill by itself after 6 s, so play never stalls', () => {
    const sim = later();
    (sim as unknown as { gain: (n: number) => void }).gain(levelNeed(0));
    expect(sim.choice).not.toBeNull();
    const evs = drive(sim, RULES.choiceSec + 0.1, frame());
    expect(ofType(evs, 'skill')[0].auto).toBe(true);
    expect(sim.choice).toBeNull();
  });

  it('gives what each skill says: a bigger buckler, reach, faster swings, Linda\'s apple', () => {
    const sim = later();
    const b0 = sim.buckler, r0 = sim.reach, s0 = sim.swing;
    sim.taken.bigShield = 1;
    sim.taken.reach = 1;
    sim.taken.swift = 1;
    expect(sim.buckler).toBeCloseTo(b0 + RULES.shieldUp);
    expect(sim.reach).toBeCloseTo(r0 + RULES.reachUp);
    expect(sim.swing).toBeCloseTo(s0 * RULES.swiftK);
    sim.knight.heart = 0.2;
    sim.choice = { options: ['apple', 'apple', 'apple'], t: 0 };
    sim.pick(0);
    expect(sim.knight.heart).toBe(1);
  });

  it('the squire puts out the nearest fire, the lance knocks off scales by itself', () => {
    const sim = later();
    still(sim, 5, 2);
    stand(sim, 5, 7.5);
    sim.taken.squire = 1;
    sim.taken.lance = 1;
    sim.flames.push({ id: 930, x: 6.5, y: 7.4, vx: 0, vy: 0, r: RULES.blobR, life: 9 });
    const evs = drive(sim, 7, frame({ level: 0 }), { t: 0 }, () => { still(sim, 5, 2, false); });
    expect(ofType(evs, 'squire').length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'scales').filter(e => e.via === 'lance').length).toBeGreaterThanOrEqual(1);
  });

  it('starts every fight with the armoury\'s skills', () => {
    const sim = later({ progress: { driven: 2 } });
    expect(sim.taken.bigShield).toBe(1);
    expect(sim.taken.squire).toBe(1);
    expect(sim.taken.lance).toBeUndefined();
  });
});

describe('Dym: the blind Tarcza', () => {
  const blindSim = () => later({ progress: { sessions: 5, pushes: 2 } });

  it('comes every 4th Tarcza from the 3rd session, never a session\'s first', () => {
    const sim = blindSim();
    expect(sim.block.blind).toBe(false);
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.blind).toBe(true);
    expect(sim.blind).toBe(true);
  });

  it('keeps the buckler and veils the trace; at its end the judged share fills the Miecz', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    drive(sim, 8, HIGH, clock);
    expect(sim.shieldLook).toBe('smoke');
    expect(sim.shieldR).toBeCloseTo(sim.buckler, 1);
    expect(sim.trace.latest?.veiled).toBe(true);
    const evs = toBlock(sim, 3, HIGH, clock);
    const smoke = ofType(evs, 'smoke')[0];
    expect(smoke.share).toBeGreaterThan(0.9);
    expect(sim.swordReady).toBe(true);
    expect(sim.trace.latest?.veiled).toBe(false);
  });
});

describe('the end of a fight', () => {
  it('a dragon not beaten flies to its cave and keeps its damage for the next fight', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    drive(sim, 62, frame(), clock, () => { if (sim.hittable && sim.dragon.left > 2) sim.knight.x = sim.knight.x; });
    expect(sim.phase).toBe('done');
    const p = sim.p;
    expect(p.dragon).toBe(0);
    expect(p.damage).toBe(sim.dragon.damage);
    expect(p.sessions).toBe(6);
    const next = makeSim({ progress: { ...p } });
    expect(next.dragon.damage).toBe(p.damage);
  });

  it('settles once: the total, the map, the counters', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 45, frame(), clock, () => {});
    const total = sim.p.total;
    sim.finish();
    sim.result();
    expect(sim.p.total).toBe(total);
    expect(total).toBe(sim.score);
  });
});

describe('the meta', () => {
  it('walks the map through the four dragons, circle after circle, each circle stronger', () => {
    expect(dragonAt(0).spec.kind).toBe('zielony');
    expect(dragonAt(3).spec.kind).toBe('trzyglowy');
    expect(dragonAt(4)).toEqual({ spec: DRAGONS[0], circle: 1 });
    expect(hpOf(DRAGONS[0], 1)).toBeGreaterThan(hpOf(DRAGONS[0], 0));
    const ph = phasesOf(DRAGONS[1], 0);
    expect(phaseAt(ph, 0)).toEqual({ phase: 0, left: ph[0] });
    expect(phaseAt(ph, ph[0] + 3)).toEqual({ phase: 1, left: ph[1] - 3 });
  });

  it('keeps one skill in the armoury for each dragon driven off', () => {
    expect(armouryOf(0)).toEqual([]);
    expect(armouryOf(2)).toEqual(ARMOURY.slice(0, 2));
    expect(armouryOf(99)).toEqual([...ARMOURY]);
    for (const id of ARMOURY) expect(SKILLS.some(s => s.id === id)).toBe(true);
  });
});

describe('the summary', () => {
  it('result() is idempotent and the record uses Math.max', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 2 } } });
    drive(sim, 10, frame());
    const r1 = sim.result(), r2 = sim.result();
    expect(r2).toEqual(r1);
    expect(sim.p.best['40']).toBe(Math.max(2, sim.score));
    expect(r1.record).toBe(sim.score > 2);
    expect(r1.highlights.length).toBeGreaterThanOrEqual(1);
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    for (const id of ['jos1.9', 'psa91.13', 'eph6.17', 'eph6.16', '2ti4.7', '1co16.13'] as const) {
      expect(passage(id).text.length).toBeGreaterThan(10);
    }
    expect(makeSim().closingVerse()).toBe('jos1.9');
    const sim = later({ planned: 180 });
    expect(sim.closingVerse()).toBe('eph6.16');
    sim.swords = 1;
    expect(['eph6.17', 'eph6.16']).toContain(sim.closingVerse());
  });
});

describe('Linda talks', () => {
  it('one line at a time, 2–4 s, never while blocked, no repeats until a moment has used them all', () => {
    const talk = new Talk(LINES, mulberry32(3));
    talk.ask('good');
    talk.update(0.1, 0, true);
    expect(talk.line).toBeNull();
    talk.update(0.1, 0.1, false);
    expect(talk.line?.moment).toBe('good');
    expect(talk.line!.dur).toBeGreaterThanOrEqual(RULES.talkMin);
    expect(talk.line!.dur).toBeLessThanOrEqual(RULES.talkMax);
    talk.ask('quench');
    talk.update(0.1, 0.2, false);
    expect(talk.line?.moment).toBe('good');
    // a telegraph cuts the line
    talk.update(0.1, 0.3, true);
    expect(talk.line).toBeNull();
    let now = 0.3;
    for (let i = 0; i < 4; i++) {
      talk.ask('good', 1, 99);
      for (let k = 0; k < 400 && !(talk.line?.moment === 'good'); k++) talk.update(0.05, (now += 0.05), false);
      for (let k = 0; k < 200 && talk.line; k++) talk.update(0.05, (now += 0.05), false);
    }
    const goods = talk.said.filter(s => LINES.good.includes(s));
    expect(new Set(goods.slice(0, LINE_COUNT.good)).size).toBe(Math.min(goods.length, LINE_COUNT.good));
  });

  it('every line fits a bubble (90 characters) in all four languages, and every moment has 3+ variants', () => {
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) {
        if (k.startsWith('say.')) expect((v as string).length, k).toBeLessThanOrEqual(90);
      }
    }
    for (const [m, n] of Object.entries(LINE_COUNT)) expect(n, m).toBeGreaterThanOrEqual(3);
  });

  it('stays quiet under the runner\'s block banner and the block telegraph', () => {
    const sim = later({ planned: 180 });
    drive(sim, 2, frame());
    expect(sim.talkBlocked).toBe(true);
    drive(sim, 5, frame());
    expect(sim.talkBlocked).toBe(false);
    const clock = { t: 7 };
    while (sim.blockT < sim.block.dur - RULES.telegraph + 0.1) drive(sim, STEP, frame(), clock);
    expect(sim.talkBlocked).toBe(true);
    expect(sim.talk.line).toBeNull();
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 łuska, 3 łuski, 5 łusek)', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['łuska', 'łuski', 'łusek', 'łuski', 'łusek']);
    expect(t('scales', { n: 12 })).toBe('12 łusek');
    expect(CATALOGS.en.scales).toEqual({ one: '{n} scale', other: '{n} scales' });
  });

  it('never asks to concentrate harder, never uses holiness words, gore or "hack"; the dragon is never killed', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /\bkill/, /töte/, /döda/, /pray/, /módl/, /\bbete/, /\bbe till/]) {
        expect(all).not.toMatch(word);
      }
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at (w/2, h·0.6) every 0.65 s (a tap there), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<JerzyProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, at22 = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        if (sim.choice) sim.pick(1);
        else sim.tap(RULES.arenaW / 2, RULES.arenaH * 0.55);
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
      at22 = sim.result().score;
    }
    return at22;
  }

  it('knocks off scales by 22 s on either band, first session or later', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 8; seed++) expect(smoke({}, seed, eeg), `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(3);
    }
    expect(smoke({ sessions: 6 }, 3, false, 300)).toBeGreaterThan(3);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/jerzy/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(30);
    p.lastLen = 600;
    expect(mod.best(p)).toBe(45);
    expect(mod.unit!(2)).toBe('łuski');
    expect(mod.unit!(5)).toBe('łusek');
  });

  it('builds the progress card from elements: the map of four towns, the armoury', async () => {
    const { progressPanel } = await import('../src/arcade/jerzy/panel');
    const p = { ...freshProgress(), sessions: 3, dragon: 1, damage: 20, driven: 1, total: 120 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(DRAGONS.length);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(2);
    expect(el.querySelectorAll('.arcade-chips span')).toHaveLength(1);
    expect(el.textContent).toContain(t('town.bagienny'));
  });
});
