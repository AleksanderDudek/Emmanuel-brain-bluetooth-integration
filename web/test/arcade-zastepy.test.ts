import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { Battle, type BattleEvent, type Control } from '../src/arcade/zastepy/battle';
import { CATALOGS, t, unit } from '../src/arcade/zastepy/i18n';
import {
  bestOf, buyGate, buyUnit, cardsAt, freshProgress, gatePrice, isSmok, nextCardGate, unitPrice, wallsFor, type ZastepyProgress,
} from '../src/arcade/zastepy/meta';
import { DEMONS, HOST, RULES, type HostId } from '../src/arcade/zastepy/rules';
import { ZastepySim, flowMult, planBlocks, type SimEvent } from '../src/arcade/zastepy/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-03';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const LV1: Record<HostId, number> = { straznik: 1, lucznik: 1, tarczownik: 1, jezdziec: 1, serafin: 1, archaniol: 1 };
const lv = (n: number): Record<HostId, number> => ({ straznik: n, lucznik: n, tarczownik: n, jezdziec: n, serafin: n, archaniol: n });

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

type SimOpts = { progress?: Partial<ZastepyProgress>; planned?: number; seed?: number; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ZastepySim {
  const sim = new ZastepySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no gift): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, calls: 1, ...o.progress } });

function drive(sim: ZastepySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

function toBlock(sim: ZastepySim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

// ── headless battles ───────────────────────────────────────────────
type Policy = 'idle' | 'space' | 'mixed';

/**
 * A battle played by a policy: idle (no taps), space (the cheapest ready card every `every` s), or
 * mixed (a decent player: a shield-bearer or two in front, archers behind, swords, the heavy cards
 * when they are ready).  `band`: a player whose focus works — the flow ×1.6 in the Natarcie halves,
 * calm 0.6 in the Cisza halves, the trumpet whenever it would be charged (every 30 s).
 */
function playBattle(o: { battle: number; gate: number; units?: Record<HostId, number>; policy: Policy; every?: number; band?: boolean; seed?: number; maxSec?: number }) {
  const b = new Battle({ battle: o.battle, gate: o.gate, units: o.units ?? LV1, retreats: 0, seed: o.seed ?? 7 });
  const every = o.every ?? 3, dt = 1 / 30;
  let acc = 0, firstKill = -1, lastTrumpet = 0;
  const evs: BattleEvent[] = [];
  for (let t = 0; t < (o.maxSec ?? 400); t += dt) {
    const rest = Math.floor(t / 24) % 2 === 1;
    const ctl: Control = { flow: rest || !o.band ? 1 : 1.6, rest, calm: rest && o.band ? 0.6 : 0 };
    b.step(dt, ctl);
    evs.push(...b.take());
    if (firstKill < 0 && b.beaten > 0) firstKill = b.t;
    if (o.band && !rest && t - lastTrumpet >= 30) {
      lastTrumpet = t;
      b.trumpet();
    }
    if ((acc += dt) >= every) {
      acc -= every;
      if (o.policy === 'space') {
        const id = b.cheapestReady();
        if (id) b.send(id);
      } else if (o.policy === 'mixed') {
        const shields = b.fighters.filter(f => f.kind === 'tarczownik' && f.state !== 'gone').length;
        const order: HostId[] = ['archaniol', 'serafin', 'jezdziec', 'tarczownik', 'lucznik', 'straznik'];
        for (const id of order) if (b.ready(id) && (id !== 'tarczownik' || shields < 2)) { b.send(id); break; }
      }
    }
    if (b.outcome) break;
  }
  return { outcome: b.outcome, t: b.t, beaten: b.beaten, gold: b.gold, firstKill, walls: b.walls, evs };
}

describe('the battle on the road', () => {
  it('sends a unit for its light, then the card cools down; a card not ready does nothing', () => {
    const b = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 1 });
    const light = b.light;
    expect(b.send('straznik')).toBe(true);
    expect(b.light).toBe(light - HOST.straznik.cost);
    expect(b.send('straznik')).toBe(false);
    expect(b.cool.straznik).toBeGreaterThan(0);
    expect(b.send('jezdziec')).toBe(false);   // the rider's card opens at gate level 2
    expect(b.take().filter(e => e.type === 'sent')).toHaveLength(1);
  });

  it('flows light at the base rate, faster with the multiplier, never past the bar', () => {
    const a = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 1 });
    const c = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 1 });
    a.light = c.light = 0;
    for (let i = 0; i < 60; i++) {
      a.step(1 / 60, { flow: 1, rest: false, calm: 0 });
      c.step(1 / 60, { flow: RULES.flowTop, rest: false, calm: 0 });
    }
    expect(a.light).toBeCloseTo(RULES.flow, 1);
    expect(c.light).toBeCloseTo(RULES.flow * RULES.flowTop, 1);
    for (let i = 0; i < 60 * 60; i++) a.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    expect(a.light).toBe(a.lightMax);
  });

  it('picks the cheapest ready card for Space', () => {
    const b = new Battle({ battle: 0, gate: 3, units: LV1, retreats: 0, seed: 1 });
    b.light = 100;
    expect(b.cheapestReady()).toBe('straznik');
    b.send('straznik');
    expect(b.cheapestReady()).toBe('lucznik');
    b.light = 10;
    expect(b.cheapestReady()).toBeNull();
  });

  it('lets a ground blade pass under a flier; bows and the beam reach it', () => {
    const b = new Battle({ battle: 2, gate: 1, units: LV1, retreats: 0, seed: 1 });
    b.light = 200;
    b.send('straznik');
    const s = b.fighters[0];
    s.x = 10;
    // a flier straight ahead of the blade
    (b as unknown as { spawn(id: string): void }).spawn('skrzydlak');
    const w = b.fighters[1];
    w.x = 10.5;
    w.cd = 99;
    b.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    expect(s.state).toBe('walk');
    b.send('lucznik');
    const a = b.fighters.find(f => f.kind === 'lucznik')!;
    a.x = 7;
    for (let i = 0; i < 60; i++) b.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    expect(w.hp).toBeLessThan(w.maxHp);
  });

  it('beats the first imp before it reaches the gate, with the beam alone', () => {
    const r = playBattle({ battle: 0, gate: 1, policy: 'idle', maxSec: 40 });
    expect(r.beaten).toBeGreaterThanOrEqual(1);
    expect(r.firstKill).toBeLessThan(25);
  });

  it('slows the demons in a Cisza; calm mends the walls and lays shields on the front line', () => {
    const go = (rest: boolean) => {
      const b = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 3 });
      for (let i = 0; i < 60 * 5; i++) b.step(1 / 60, { flow: 1, rest, calm: 0 });
      return b.fighters.filter(f => f.side === -1).map(f => f.x)[0];
    };
    expect(go(true)).toBeGreaterThan(go(false));
    const b = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 3 });
    b.walls = b.wallsMax / 2;
    b.send('straznik');
    for (let i = 0; i < 60 * 4; i++) b.step(1 / 60, { flow: 1, rest: true, calm: 1 });
    expect(b.walls).toBeCloseTo(b.wallsMax / 2 + RULES.mend * b.wallsMax * 4, 0);
    const s = b.fighters.find(f => f.side === 1)!;
    expect(s.shield).toBeGreaterThan(30);
    expect(s.shield).toBeLessThanOrEqual(s.maxHp * RULES.shieldMax + 1e-9);
  });

  it('throws the demons back and wounds them with the trumpet', () => {
    const b = new Battle({ battle: 1, gate: 1, units: LV1, retreats: 0, seed: 3 });
    for (let i = 0; i < 60 * 12; i++) b.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    const d = b.fighters.filter(f => f.side === -1 && f.state !== 'gone');
    expect(d.length).toBeGreaterThan(0);
    const before = d.map(f => ({ x: f.x, hp: f.hp }));
    expect(b.trumpet()).toBe(d.length);
    for (let i = 0; i < 30; i++) b.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    d.forEach((f, i) => {
      expect(f.hp).toBeLessThan(before[i].hp);
      if (f.state !== 'gone') expect(f.x).toBeGreaterThan(before[i].x);
    });
  });

  it('sends the Smok only in the tenth battle of a circle; its gate is sealed until it falls', () => {
    expect([0, 8, 9, 10, 19].map(isSmok)).toEqual([false, false, true, false, true]);
    const r = playBattle({ battle: 5, gate: 4, policy: 'idle', maxSec: 30 });
    expect(r.evs.some(e => e.type === 'smok')).toBe(false);
    const s = new Battle({ battle: 9, gate: 6, units: lv(3), retreats: 0, seed: 1 });
    for (let i = 0; i < 60 * (RULES.smokAt + 1); i++) s.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    expect(s.smok).not.toBeNull();
    expect(s.take().some(e => e.type === 'smok')).toBe(true);
    // a host at the sealed gate: no damage
    s.light = 500;
    s.send('straznik');
    const g = s.fighters.find(f => f.side === 1)!;
    g.x = s.road - 0.5;
    for (const f of s.fighters) if (f.side === -1) f.x = 1;
    for (let i = 0; i < 60; i++) s.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    expect(s.ash).toBe(s.ashMax);
    expect(s.take().some(e => e.type === 'sealed')).toBe(true);
    // the Smok falls: the battle is won
    for (const f of s.fighters) if (f.side === -1 && f !== s.smok) { f.state = 'gone'; f.goneT = 0; }
    s.smok!.hp = 1;
    s.smok!.x = 2;
    for (let i = 0; i < 120 && !s.outcome; i++) s.step(1 / 60, { flow: 1, rest: false, calm: 0 });
    expect(s.outcome).toBe('won');
  });
});

describe('the balance (headless battles)', () => {
  it('an idle player still holds for a while: the gate\'s beam beats the first waves', () => {
    for (const seed of [1, 2, 3]) {
      const r = playBattle({ battle: 0, gate: 1, policy: 'idle', seed });
      expect(r.outcome).toBe('lost');
      expect(r.t, `seed ${seed}`).toBeGreaterThan(60);
      expect(r.beaten).toBeGreaterThan(3);
    }
  });

  it('a player who spends light every few seconds wins the first battle, in about a minute or two', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = playBattle({ battle: 0, gate: 1, policy: 'mixed', every: 3, seed });
      expect(r.outcome, `seed ${seed}`).toBe('won');
      expect(r.t).toBeGreaterThan(50);
      expect(r.t).toBeLessThan(200);
      const s = playBattle({ battle: 0, gate: 1, policy: 'space', every: 2, seed });
      expect(s.outcome, `space, seed ${seed}`).toBe('won');
    }
  });

  it('the Smok is beatable by an upgraded host whose band works', () => {
    for (const seed of [1, 2, 3]) {
      const r = playBattle({ battle: 9, gate: 6, units: lv(3), policy: 'mixed', band: true, seed });
      expect(r.outcome, `seed ${seed}`).toBe('won');
      expect(r.evs.some(e => e.type === 'beaten' && e.kind === 'smok')).toBe(true);
    }
  });
});

describe('the band in the session', () => {
  it('×1 up to the threshold and never below, ×2.2 at the top', () => {
    expect(flowMult(0)).toBe(1);
    expect(flowMult(0.5)).toBe(1);
    expect(flowMult(1)).toBeCloseTo(RULES.flowTop, 9);
    expect(flowMult(0.75)).toBeCloseTo(1 + (RULES.flowTop - 1) / 2, 9);
  });

  it('speeds the flow only in a sighted Natarcie past its lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      expect(sim.block.kind).toBe('push');
      drive(sim, (eeg ? 2 : 5) - 0.5, frame({ level: 1 }));
      expect(sim.mult).toBe(1);
      drive(sim, 1, frame({ level: 1 }));
      expect(sim.mult).toBeCloseTo(RULES.flowTop, 5);
    }
  });

  it('keeps the base flow while the signal is unreliable — never less', () => {
    const sim = later();
    drive(sim, 8, frame({ level: 0.9 }));
    expect(sim.mult).toBeGreaterThan(1.5);
    drive(sim, 1, frame({ reliable: false, activity: null, level: 0 }));
    expect(sim.mult).toBe(1);
    expect(sim.battle.flowNow).toBe(sim.battle.flowBase);
  });

  it('charges the trumpet with a held focus (5 s Mendi, 3 s HALO); a broken hold starts again', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, RULES.leadIn.fnirs, frame(), clock);
    let ev = drive(sim, 3, frame({ level: 0.8, focused: true }), clock);
    expect(sim.charge).toBeGreaterThan(0.5);
    drive(sim, 0.2, frame({ level: 0.2, focused: false }), clock);
    expect(sim.charge).toBe(0);
    ev = drive(sim, 5.2, frame({ level: 0.8, focused: true }), clock);
    expect(ofType(ev, 'trumpetReady')).toHaveLength(1);
    expect(sim.ready).toBe(true);
    // a full trumpet waits for the tap
    drive(sim, 2, frame({ focused: false }), clock);
    expect(sim.ready).toBe(true);
    expect(sim.key('t', true)).toBe(true);
    expect(sim.charge).toBe(0);
    expect(sim.trumpetsNow).toBe(1);
    const eeg = later({ eeg: true });
    drive(eeg, 2 + 3.2, frame({ level: 0.8, focused: true }));
    expect(eeg.ready).toBe(true);
  });

  it('mends the walls with calm in a Cisza past its lead-in; a passed Cisza mends at once and pays gold', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.kind).toBe('rest');
    sim.battle.walls = sim.battle.wallsMax * 0.4;
    drive(sim, 2, frame({ calm: 0.9 }), clock);
    expect(sim.calmNow).toBe(0);
    drive(sim, 4, frame({ calm: 0.9, activity: -2 }), clock);
    expect(sim.calmNow).toBeCloseTo(0.9, 5);
    expect(sim.battle.walls).toBeGreaterThan(sim.battle.wallsMax * 0.4);
    const gold = sim.p.gold;
    const ev = toBlock(sim, 2, frame({ calm: 0.9, activity: -3 }), clock);
    expect(ofType(ev, 'blockEnd').find(e => e.block.kind === 'rest')!.verdict).toBe(true);
    expect(ofType(ev, 'restPass')).toHaveLength(1);
    expect(sim.p.gold).toBeGreaterThanOrEqual(gold + RULES.restGold);
  });

  it('has no verdict without enough signal (never a loss)', () => {
    const sim = later();
    toBlock(sim, 1);
    const ev = toBlock(sim, 2, frame({ reliable: false, activity: null, calm: 0 }));
    const end = ofType(ev, 'blockEnd').find(e => e.block.kind === 'rest')!;
    expect(end.verdict).toBeNull();
    expect(ofType(ev, 'restPass')).toHaveLength(0);
  });
});

describe('Mgła bitewna: the blind Natarcie', () => {
  /** A session whose second Natarcie is the 4th of all time: blind. */
  const blindSim = () => later({ progress: { sessions: 4, calls: 2 }, planned: 600 });

  it('comes every 4th Natarcie from the 3rd session, never a session\'s first', () => {
    const sim = blindSim();
    expect(sim.block.blind).toBe(false);
    toBlock(sim, 2);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    const young = makeSim({ progress: { sessions: 1, calls: 2, giftDay: DAY }, planned: 600 });
    toBlock(young, 2);
    expect(young.block.blind).toBe(false);
  });

  it('pays no extra light while it runs and veils the trace; at its end it pays the judged share at once', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    drive(sim, 8, frame({ level: 1, activity: 6, threshold: 2, focused: true }), clock);
    expect(sim.mult).toBe(1);
    expect(sim.wantMult).toBeCloseTo(RULES.flowTop, 5);
    expect(sim.charge).toBe(0);
    expect(sim.trace.latest?.veiled).toBe(true);
    expect(sim.padLevel(frame())).toBeNull();
    const ev = toBlock(sim, 3, frame({ level: 1, activity: 6, threshold: 2 }), clock);
    const pay = ofType(ev, 'blindPay')[0];
    expect(pay.share).toBeGreaterThan(0.9);
    expect(pay.light).toBeGreaterThan(50);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
    expect(sim.trace.samples.some(s => s.revealedAt !== null)).toBe(true);
  });
});

describe('battles in a session', () => {
  it('a won battle pays gold, moves to the next battle, and the card between battles goes on by itself', () => {
    const sim = later({ planned: 600 });
    sim.battle.ash = 1;
    sim.battle.light = 200;
    sim.send('straznik');
    sim.battle.fighters.find(f => f.side === 1)!.x = sim.battle.road - 0.5;
    const gold = sim.p.gold;
    let ev = drive(sim, 2, frame());
    expect(ofType(ev, 'won')).toHaveLength(1);
    expect(sim.p.battle).toBe(1);
    expect(sim.p.won).toBe(1);
    expect(sim.p.gold).toBeGreaterThanOrEqual(gold + RULES.winGold);
    ev = drive(sim, RULES.wonHold + 0.2, frame());
    expect(sim.stage).toBe('upgrade');
    expect(sim.offers[0].what).toBe('gate');
    ev = drive(sim, RULES.upgradeSec + 0.2, frame());
    expect(sim.stage).toBe('battle');
    expect(ofType(ev, 'battleStart')[0]).toMatchObject({ battle: 1, retry: 0 });
  });

  it('a fallen gate of light is a withdrawal: the gold stays, the battle starts again with stronger walls', () => {
    const sim = later({ planned: 600 });
    const walls0 = sim.battle.wallsMax;
    sim.battle.walls = 0.5;
    (sim.battle as unknown as { spawn(id: string): void }).spawn('cien');
    const d = sim.battle.fighters.find(f => f.side === -1)!;
    d.x = 0.5;
    d.hp = 9999;
    const ev = drive(sim, RULES.lostHold + RULES.upgradeSec + 1, frame());
    expect(ofType(ev, 'lost')).toHaveLength(1);
    expect(sim.p.battle).toBe(0);
    expect(sim.battle.wallsMax).toBe(walls0 + RULES.wallsPerRetreat);
    expect(ofType(ev, 'battleStart').at(-1)).toMatchObject({ battle: 0, retry: 1 });
  });

  it('buys on the card between battles: Space goes on, keys 1–3 buy', () => {
    const sim = later({ planned: 600, progress: { gold: 500 } });
    sim.battle.ash = 1;
    sim.battle.light = 200;
    sim.send('straznik');
    sim.battle.fighters.find(f => f.side === 1)!.x = sim.battle.road - 0.5;
    drive(sim, RULES.wonHold + 2.5, frame());
    expect(sim.stage).toBe('upgrade');
    const g = sim.p.gold;
    expect(sim.key('1', true)).toBe(true);
    expect(sim.p.gate).toBe(2);
    expect(sim.p.gold).toBe(g - gatePrice(1)!);
    sim.key(' ', true);
    drive(sim, 0.1, frame());
    expect(sim.stage).toBe('battle');
    expect(sim.battle.gate).toBe(2);
  });

  it('counts the demons beaten live: the headline is the score', () => {
    const sim = later();
    drive(sim, 30, frame());
    expect(sim.score).toBe(sim.battle.beaten);
    expect(sim.result().score).toBe(sim.score);
  });
});

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a Cisza, the finale\'s 6 s left over', () => {
    for (const sec of [40, 60, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(sec, first, mulberry32(sec));
        const total = plan.reduce((s, b) => s + b.dur, 0);
        expect(total).toBeCloseTo(Math.max(sec - RULES.finale, 2 * RULES.minBlock), 0);
        expect(plan.at(-1)!.kind).toBe('rest');
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
      }
    }
  });

  it('telegraphs the next block 4 s ahead and plays the finale', () => {
    const sim = later({ planned: 60 });
    const ev = drive(sim, 64, frame());
    expect(ofType(ev, 'telegraph').length).toBeGreaterThanOrEqual(2);
    expect(ofType(ev, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });
});

describe('the meta', () => {
  it('prices the gate and the units, opens cards by the gate\'s level', () => {
    expect(gatePrice(1)).toBe(RULES.gatePrice);
    expect(gatePrice(RULES.gateMax)).toBeNull();
    expect(unitPrice('straznik', RULES.unitMaxLevel)).toBeNull();
    expect(cardsAt(1)).toEqual(['straznik', 'lucznik', 'tarczownik']);
    expect(cardsAt(10)).toHaveLength(6);
    expect(nextCardGate(1)).toEqual({ id: 'jezdziec', gate: 2 });
    expect(wallsFor(3, 1)).toBe(RULES.walls + 2 * RULES.wallsPerLevel + RULES.wallsPerRetreat);
  });

  it('buys with gold only: a gate level, a unit level of an open card', () => {
    const p = { ...freshProgress(), gold: 30 };
    expect(buyGate(p)).toBe(false);
    p.gold = 1000;
    expect(buyGate(p)).toBe(true);
    expect(p.gate).toBe(2);
    expect(buyUnit(p, 'serafin')).toBe(false);
    expect(buyUnit(p, 'straznik')).toBe(true);
    expect(p.units.straznik).toBe(2);
    expect(p.gold).toBe(1000 - gatePrice(1)! - unitPrice('straznik', 1)!);
  });

  it('settles once: sessions, the total, the day\'s gift; result() is idempotent', () => {
    const sim = makeSim({ progress: { sessions: 2 }, planned: 40 });
    drive(sim, 46, frame());
    const p = sim.p;
    expect(p.sessions).toBe(3);
    expect(p.total).toBe(sim.score);
    expect(p.giftDay).toBe(DAY);
    expect(p.gold).toBe(sim.goldNow);
    expect(sim.goldNow).toBeGreaterThanOrEqual(RULES.giftGold);
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    sim.finish();
    expect(p.sessions).toBe(3);
    expect(p.total).toBe(sim.score);
  });

  it('result() keeps the record with Math.max', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 2 } } });
    drive(sim, 20, frame());
    const r1 = sim.result(), r2 = sim.result();
    expect(r2).toEqual(r1);
    expect(sim.p.best['40']).toBe(Math.max(2, sim.score));
    expect(r1.record).toBe(sim.score > 2);
  });

  it('finish() settles a session ended early', () => {
    const sim = later({ planned: 300 });
    drive(sim, 30, frame());
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.phase).toBe('done');
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    const sim = later();
    expect(sim.closingVerse()).toBe('rev12.7-8');
    for (const id of ['rev12.7-8', 'eph6.10-11', 'rom12.21', '1jn4.4', 'jas4.7', '2co10.4', 'exo14.14'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    sim.smokNow = 1;
    expect(['1jn4.4', 'rev12.7-8']).toContain(sim.closingVerse());
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 demon, 3 demony, 5 demonów)', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['demon', 'demony', 'demonów', 'demony', 'demonów']);
    expect(t('demons', { n: 12 })).toBe('12 demonów');
  });

  it('never asks to concentrate harder, never uses holiness words, "hack" or a prayer power', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /modlitw/, /prayer/, /gebet/, /bön/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap at the canvas centre every 0.65 s (no harm: the road), Space every third tap, the simulator's focus on. */
  function smoke(progress: Partial<ZastepyProgress>, seed: number, eeg: boolean) {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at22 = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        if (taps++ % 3 === 0) {
          sim.key(' ', true);
          sim.key(' ', false);
        }
      }
      sim.take();
      at22 = sim.result().score;
    }
    return at22;
  }

  it('beats a demon by 22 s on either band, first session or later', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 8; seed++) {
        expect(smoke({}, seed, eeg), `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        expect(smoke({ sessions: 6, giftDay: DAY, battle: 4, gate: 3 }, seed, eeg), `later, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the numbers stay sane', () => {
  it('every unit and demon has positive stats; cards cost light and cool down', () => {
    for (const s of Object.values(HOST)) {
      expect(s.hp).toBeGreaterThan(0);
      expect(s.cost).toBeGreaterThan(0);
      expect(s.cool).toBeGreaterThan(0);
    }
    for (const s of Object.values(DEMONS)) expect(s.hp * s.dmg * s.speed).toBeGreaterThan(0);
    expect(bestOf(freshProgress())).toBeNull();
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/zastepy/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(30);
    p.lastLen = 600;
    expect(mod.best(p)).toBe(45);
    expect(mod.unit!(2)).toBe('demony');
  });

  it('builds the progress card from elements and buys with gold: the gate, a unit; save() after each', async () => {
    const { progressPanel } = await import('../src/arcade/zastepy/panel');
    const p = { ...freshProgress(), sessions: 3, gold: 200, total: 90, won: 2, battle: 2 };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    expect(el.textContent).toContain('Brama światła · poziom 1');
    expect(el.textContent).toContain('Strażnik');
    const buttons = () => [...el.querySelectorAll('button')] as HTMLButtonElement[];
    const gateBtn = buttons().find(b => b.textContent!.startsWith('Podnieś bramę'))!;
    gateBtn.click();
    expect(p.gate).toBe(2);
    expect(saved).toBe(1);
    expect(el.textContent).toContain('Brama światła · poziom 2');
    const unitBtn = buttons().find(b => b.textContent!.startsWith('+1'))!;
    unitBtn.click();
    expect(p.units.straznik).toBe(2);
    expect(saved).toBe(2);
    // a button the gold does not reach does nothing
    p.gold = 0;
    const poor = progressPanel(p, () => { saved++; });
    (poor.querySelector('button') as HTMLButtonElement).click();
    expect(saved).toBe(2);
  });
});
