import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { Battle, type BattleEvent, type Control } from '../src/arcade/zastepy/battle';
import { LINES } from '../src/arcade/zastepy/content';
import { CATALOGS, t, unit } from '../src/arcade/zastepy/i18n';
import {
  ageOf, bestOf, bossOf, buyGate, buyHero, buyUnit, cardsAt, chapterOf, freshProgress, gatePrice, heroPrice, isBossBattle, migrate,
  nextCardGate, pillarFor, starsFor, unitPrice, unitStats, wallsFor, type ZastepyProgress,
} from '../src/arcade/zastepy/meta';
import { ANSWER, BANE, DEMONS, HOST, HOST_IDS, RULES, WAVE_IDS, type HostId } from '../src/arcade/zastepy/rules';
import { ZastepySim, flowMult, planBlocks, type SimEvent } from '../src/arcade/zastepy/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-03';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const lv = (n: number): Record<HostId, number> => Object.fromEntries(HOST_IDS.map(id => [id, n])) as Record<HostId, number>;
const LV1 = lv(1);
const STILL: Control = { flow: 1, rest: false, calm: 0 };

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

/** A returning player (no warm-up, no gift, the story seen, the hands taught): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, calls: 1, seen: 31, taught: 127, ...o.progress } });

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

const spawn = (b: Battle, id: string, x?: number) => (b as unknown as { spawn(id: string, x?: number): void }).spawn(id, x);

// ── headless battles ───────────────────────────────────────────────
type Policy = 'idle' | 'space' | 'mixed' | 'counter';

/**
 * A battle played by a policy: idle (no taps), space (the cheapest ready card every `every` s), mixed
 * (a decent player: a shield-bearer or two in front, archers behind, swords, the heavy cards when they
 * are ready), or counter (mixed, but the answer to the coming wave first, and the pillar when ready).
 * `band`: a player whose focus works — the flow ×1.6 in the Natarcie halves, calm 0.6 in the Cisza
 * halves, the trumpet whenever it would be charged (every 30 s).
 */
function playBattle(o: { battle: number; gate: number; units?: Record<HostId, number>; hero?: number; policy: Policy; every?: number; band?: boolean; seed?: number; maxSec?: number }) {
  const b = new Battle({ battle: o.battle, gate: o.gate, units: o.units ?? LV1, hero: o.hero ?? 1, retreats: 0, seed: o.seed ?? 7 });
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
    if (o.policy === 'counter' && b.pillarReady && b.count(-1) >= 2) b.raisePillar();
    if ((acc += dt) >= every) {
      acc -= every;
      if (o.policy === 'space') {
        const id = b.cheapestReady();
        if (id) b.send(id);
      } else if (o.policy === 'mixed' || o.policy === 'counter') {
        const shields = b.fighters.filter(f => f.kind === 'tarczownik' && f.state !== 'gone').length;
        const order: HostId[] = ['archaniol', 'serafin', 'jezdziec', 'tarczownik', 'wlocznik', 'lucznik', 'straznik'];
        const lead = o.policy === 'counter' ? b.fighters.find(f => f.side === -1 && f.state !== 'gone' && f.kind in ANSWER) : undefined;
        if (lead) order.unshift(ANSWER[lead.kind as keyof typeof ANSWER]);
        for (const id of order) if (b.ready(id) && (id !== 'tarczownik' || shields < 2)) { b.send(id); break; }
      }
    }
    if (b.outcome) break;
  }
  return { outcome: b.outcome, t: b.t, beaten: b.beaten, gold: b.gold, firstKill, walls: b.walls, evs, banes: b.banes };
}

describe('the battle on the road', () => {
  it('sends a unit for its light, then the card cools down; a card not ready does nothing', () => {
    const b = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 1 });
    const light = b.light;
    expect(b.send('straznik')).toBe(true);
    expect(b.light).toBe(light - HOST.straznik.cost);
    expect(b.send('straznik')).toBe(false);
    expect(b.cool.straznik).toBeGreaterThan(0);
    expect(b.send('wlocznik')).toBe(false);   // the spearman's card opens at gate level 2
    expect(b.take().filter(e => e.type === 'sent')).toHaveLength(1);
  });

  it('flows light at the base rate, faster with the multiplier, never past the bar', () => {
    const a = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 1 });
    const c = new Battle({ battle: 0, gate: 1, units: LV1, retreats: 0, seed: 1 });
    a.light = c.light = 0;
    for (let i = 0; i < 60; i++) {
      a.step(1 / 60, STILL);
      c.step(1 / 60, { flow: RULES.flowTop, rest: false, calm: 0 });
    }
    expect(a.light).toBeCloseTo(RULES.flow, 1);
    expect(c.light).toBeCloseTo(RULES.flow * RULES.flowTop, 1);
    for (let i = 0; i < 60 * 60; i++) a.step(1 / 60, STILL);
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
    spawn(b, 'skrzydlak');
    const w = b.fighters[1];
    w.x = 10.5;
    w.cd = 99;
    b.step(1 / 60, STILL);
    expect(s.state).toBe('walk');
    b.send('lucznik');
    const a = b.fighters.find(f => f.kind === 'lucznik')!;
    a.x = 7;
    for (let i = 0; i < 60; i++) b.step(1 / 60, STILL);
    expect(w.hp).toBeLessThan(w.maxHp);
  });

  it('beats the first shade before it reaches the gate, with the beam alone', () => {
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
    for (let i = 0; i < 60 * 12; i++) b.step(1 / 60, STILL);
    const d = b.fighters.filter(f => f.side === -1 && f.state !== 'gone');
    expect(d.length).toBeGreaterThan(0);
    const before = d.map(f => ({ x: f.x, hp: f.hp }));
    expect(b.trumpet()).toBe(d.length);
    for (let i = 0; i < 30; i++) b.step(1 / 60, STILL);
    d.forEach((f, i) => {
      expect(f.hp).toBeLessThan(before[i].hp);
      if (f.state !== 'gone') expect(f.x).toBeGreaterThan(before[i].x);
    });
  });

  it('announces each wave ahead, leaning on one kind', () => {
    const b = new Battle({ battle: 3, gate: 1, units: LV1, retreats: 0, seed: 5 });
    const evs: BattleEvent[] = [];
    for (let i = 0; i < 60 * 40; i++) {
      b.step(1 / 60, STILL);
      evs.push(...b.take());
    }
    const soon = evs.filter((e): e is Extract<BattleEvent, { type: 'waveSoon' }> => e.type === 'waveSoon');
    expect(soon.length).toBeGreaterThan(2);
    for (const w of soon) {
      expect(w.kinds.length).toBeGreaterThan(0);
      for (const k of w.kinds) expect(DEMONS[k].from).toBeLessThanOrEqual(3);
    }
    // the first spawn after an announcement is of a kind it named
    const i = evs.findIndex(e => e.type === 'waveSoon');
    const sp = evs.slice(i).find((e): e is Extract<BattleEvent, { type: 'spawn' }> => e.type === 'spawn')!;
    expect((evs[i] as Extract<BattleEvent, { type: 'waveSoon' }>).kinds).toContain(sp.kind);
  });
});

describe('the counters (rock, paper, scissors)', () => {
  it('every shade has its answer, and every answer is that angel\'s bane', () => {
    for (const d of WAVE_IDS) expect(BANE[ANSWER[d]]).toBe(d);
    expect(new Set(Object.values(ANSWER)).size).toBe(WAVE_IDS.length);
  });

  it('a bane strikes ×2; the hound hits an archer ×1.6; a shield-bearer turns darts aside', () => {
    const hit = (host: HostId, demon: string, hostStrikes: boolean) => {
      const b = new Battle({ battle: 8, gate: 10, units: LV1, retreats: 0, seed: 1 });
      b.light = 999;
      b.send(host);
      const h = b.fighters[0];
      spawn(b, demon);
      const d = b.fighters[1];
      d.armor = 0;
      h.armor = 0;
      h.x = 10;
      d.x = 10.4;
      h.cd = hostStrikes ? 0 : 99;
      d.cd = hostStrikes ? 99 : 0;
      d.hp = d.maxHp = 1e6;
      h.hp = h.maxHp = 1e6;
      b.step(1 / 60, STILL);
      return { host: h, demon: d, evs: b.take() };
    };
    const bane = hit('straznik', 'cien', true);
    const plain = hit('straznik', 'chochlik', true);
    expect(1e6 - bane.demon.hp).toBeCloseTo((1e6 - plain.demon.hp) * RULES.bane, 3);
    expect(bane.evs.some(e => e.type === 'strike' && e.bane)).toBe(true);
    const hound = hit('lucznik', 'ogar', false), cut = hit('straznik', 'ogar', false);
    expect(1e6 - hound.host.hp).toBeCloseTo((1e6 - cut.host.hp) * RULES.demonBane, 3);
    const dart = hit('tarczownik', 'miotacz', false), dart2 = hit('straznik', 'miotacz', false);
    expect((1e6 - dart.host.hp) / (1e6 - dart2.host.hp)).toBeCloseTo(RULES.shieldRanged, 3);
  });

  it('a player who answers the waves (and raises the pillar) wins where one who does not withdraws', () => {
    let worse = 0;
    for (const seed of [1, 2, 3]) {
      const a = playBattle({ battle: 5, gate: 4, units: lv(2), policy: 'counter', seed });
      const m = playBattle({ battle: 5, gate: 4, units: lv(2), policy: 'mixed', seed });
      expect(a.outcome, `seed ${seed}`).toBe('won');
      if (m.outcome !== 'won' || m.t > a.t) worse++;
    }
    expect(worse).toBeGreaterThanOrEqual(2);
  });
});

describe('the pillar of cloud (the hero power)', () => {
  it('is ready after a moment, stands where it is raised, holds the shades and burns them, then cools down', () => {
    const b = new Battle({ battle: 1, gate: 1, units: LV1, retreats: 0, seed: 2 });
    expect(b.pillarReady).toBe(false);
    for (let i = 0; i < 60 * (RULES.pillarFirst + 0.1); i++) b.step(1 / 60, STILL);
    expect(b.pillarReady).toBe(true);
    spawn(b, 'cien', 20);
    const d = b.fighters.find(f => f.side === -1)!;
    d.hp = d.maxHp = 1e5;
    expect(b.raisePillar(15)).toBe(true);
    expect(b.raisePillar(10)).toBe(false);
    const st = pillarFor(1);
    for (let i = 0; i < 60 * (st.sec - 0.2); i++) b.step(1 / 60, STILL);
    expect(d.x).toBeGreaterThanOrEqual(15 + RULES.pillarHalf - 0.06);
    expect(d.hp).toBeLessThan(d.maxHp);
    for (let i = 0; i < 60; i++) b.step(1 / 60, STILL);
    expect(b.pillar).toBeNull();
    expect(b.pillarReady).toBe(false);
    for (let i = 0; i < 60 * (st.cool + 0.5); i++) b.step(1 / 60, STILL);
    expect(b.pillarReady).toBe(true);
  });

  it('grows with its level: longer, sooner, hotter', () => {
    const a = pillarFor(1), c = pillarFor(RULES.heroMax);
    expect(c.sec).toBeGreaterThan(a.sec);
    expect(c.cool).toBeLessThan(a.cool);
    expect(c.burn).toBeGreaterThan(a.burn);
    expect(heroPrice(RULES.heroMax)).toBeNull();
  });
});

describe('the boss gates', () => {
  it('a chapter is five battles, the fifth a boss gate; bosses come in turn; each chapter is a new age', () => {
    expect([0, 3, 4, 5, 9, 14].map(isBossBattle)).toEqual([false, false, true, false, true, true]);
    expect([4, 9, 14, 19].map(bossOf)).toEqual(['kolos', 'szarancza', 'smok', 'kolos']);
    expect([0, 4, 5, 10, 20, 40].map(ageOf)).toEqual([0, 0, 1, 2, 4, 4]);
    expect(chapterOf(12)).toEqual({ chapter: 2, local: 2 });
  });

  it('the boss steps out; its gate is sealed until it falls; its special is telegraphed, then lands', () => {
    const s = new Battle({ battle: 4, gate: 4, units: lv(3), retreats: 0, seed: 1 });
    const evs: BattleEvent[] = [];
    for (let i = 0; i < 60 * (RULES.bossAt + 1); i++) { s.step(1 / 60, STILL); evs.push(...s.take()); }
    expect(s.boss?.kind).toBe('kolos');
    expect(evs.some(e => e.type === 'boss')).toBe(true);
    // a host at the sealed gate: no damage
    s.light = 500;
    s.send('straznik');
    const g = s.fighters.find(f => f.side === 1)!;
    g.x = s.road - 0.5;
    for (const f of s.fighters) if (f.side === -1) f.x = 1;
    for (let i = 0; i < 60; i++) s.step(1 / 60, STILL);
    expect(s.ash).toBe(s.ashMax);
    expect(s.take().some(e => e.type === 'sealed')).toBe(true);
    // the stomp: telegraphed, then it lands on the host in front of the Colossus
    const k = s.boss!;
    k.x = 20;
    k.hp = k.maxHp = 1e6;
    k.cd = 99;
    g.x = 18;
    g.hp = g.maxHp = 1e5;
    for (const f of s.fighters) if (f.side === -1 && f !== k) { f.state = 'gone'; f.goneT = 0; }
    const run: BattleEvent[] = [];
    for (let i = 0; i < 60 * (RULES.specialEvery + RULES.specialWarn + 0.5); i++) { k.cd = 99; s.step(1 / 60, STILL); run.push(...s.take()); }
    const warn = run.findIndex(e => e.type === 'warn'), land = run.findIndex(e => e.type === 'special');
    expect(warn).toBeGreaterThanOrEqual(0);
    expect(land).toBeGreaterThan(warn);
    expect((run[land] as Extract<BattleEvent, { type: 'special' }>).hit).toBeGreaterThanOrEqual(1);
    expect(g.hp).toBeLessThan(g.maxHp);
    // the boss falls: the battle is won
    k.hp = 1;
    k.x = 2;
    for (let i = 0; i < 120 && !s.outcome; i++) s.step(1 / 60, STILL);
    expect(s.outcome).toBe('won');
  });

  it('the trumpet breaks a special off; the pillar takes it for the host behind it', () => {
    const setup = () => {
      const s = new Battle({ battle: 14, gate: 6, units: lv(3), retreats: 0, seed: 1 });
      for (let i = 0; i < 60 * (RULES.bossAt + 0.1); i++) s.step(1 / 60, STILL);
      for (const f of s.fighters) if (f.side === -1 && f !== s.boss) { f.state = 'gone'; f.goneT = 0; }
      const k = s.boss!;
      k.x = 20;
      k.hp = k.maxHp = 1e6;
      s.light = 500;
      s.send('tarczownik');
      const g = s.fighters.find(f => f.side === 1)!;
      g.x = 16;
      g.hp = g.maxHp = 1e5;
      g.speed = 0;
      s.take();
      return { s, k, g };
    };
    // the trumpet in the wind-up: no breath
    const a = setup();
    const evA: BattleEvent[] = [];
    for (let i = 0; i < 60 * (RULES.specialEvery + 0.3); i++) { a.k.cd = 99; a.s.step(1 / 60, STILL); evA.push(...a.s.take()); }
    expect(a.s.special).not.toBeNull();
    a.s.trumpet();
    for (let i = 0; i < 60 * 3; i++) { a.k.cd = 99; a.s.step(1 / 60, STILL); evA.push(...a.s.take()); }
    expect(evA.some(e => e.type === 'cancel')).toBe(true);
    expect(evA.some(e => e.type === 'special')).toBe(false);
    // the pillar between: blocked, the shield-bearer behind it untouched
    const b = setup();
    b.s.pillarCd = 0;
    const evB: BattleEvent[] = [];
    for (let i = 0; i < 60 * (RULES.specialEvery + 0.3); i++) { b.k.cd = 99; b.s.step(1 / 60, STILL); evB.push(...b.s.take()); }
    b.s.raisePillar(18);
    const hp = b.g.hp;
    for (let i = 0; i < 60 * 2.5; i++) { b.k.cd = 99; b.s.step(1 / 60, STILL); evB.push(...b.s.take()); }
    const sp = evB.find((e): e is Extract<BattleEvent, { type: 'special' }> => e.type === 'special')!;
    expect(sp.blocked).toBe(true);
    expect(b.g.hp).toBe(hp);
  });

  it('the Locust calls a swarm of fliers', () => {
    const s = new Battle({ battle: 9, gate: 6, units: lv(3), retreats: 0, seed: 1 });
    const evs: BattleEvent[] = [];
    for (let i = 0; i < 60 * (RULES.bossAt + RULES.specialEvery + RULES.specialWarn + 0.5); i++) { s.step(1 / 60, STILL); evs.push(...s.take()); }
    expect(s.boss?.kind).toBe('szarancza');
    const sp = evs.find((e): e is Extract<BattleEvent, { type: 'special' }> => e.type === 'special')!;
    expect(sp.special.kind).toBe('swarm');
    expect(s.fighters.filter(f => f.kind === 'skrzydlak').length).toBeGreaterThanOrEqual(RULES.swarmN);
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

  it('each boss is beatable by an upgraded host whose band works', () => {
    for (const [battle, gate, units] of [[4, 3, 2], [9, 5, 3], [14, 7, 3]] as const) {
      for (const seed of [1, 2, 3]) {
        const r = playBattle({ battle, gate, units: lv(units), hero: 2, policy: 'counter', band: true, seed });
        expect(r.outcome, `battle ${battle}, seed ${seed}`).toBe('won');
        expect(r.evs.some(e => e.type === 'beaten' && e.kind === bossOf(battle))).toBe(true);
      }
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

  it('keeps the base flow while the signal is unreliable — never less; the gauge hides', () => {
    const sim = later();
    drive(sim, 8, frame({ level: 0.9 }));
    expect(sim.mult).toBeGreaterThan(1.5);
    expect(sim.meter()).toBeCloseTo(0.9, 5);
    drive(sim, 1, frame({ reliable: false, activity: null, level: 0 }));
    expect(sim.mult).toBe(1);
    expect(sim.battle.flowNow).toBe(sim.battle.flowBase);
    expect(sim.meter()).toBeNull();
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
    expect(sim.meter()).toBeCloseTo(0.9, 5);
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

describe('the standard HUD: signal, meter, headline', () => {
  it('says the block, its seconds left and, in the telegraph, the next one; the task is a strategy', () => {
    const sim = later();
    const s0 = sim.signal();
    expect(s0.want).toBe('focus');
    expect(s0.left).toBeCloseTo(sim.block.dur, 0);
    expect(s0.next).toBeUndefined();
    expect(s0.task!.length).toBeGreaterThan(10);
    drive(sim, sim.block.dur - RULES.telegraph + 0.2, frame());
    expect(sim.signal().next).toBe('rest');
    toBlock(sim, 1);
    expect(sim.signal().want).toBe('rest');
  });

  it('hides the gauge in a blind block; free in the warm-up', () => {
    const sim = makeSim();
    expect(sim.signal().want).toBe('free');
    const blind = later({ progress: { sessions: 4, calls: 2 }, planned: 600 });
    toBlock(blind, 2);
    drive(blind, 1, frame({ level: 0.9 }));
    expect(blind.blind).toBe(true);
    expect(blind.meter()).toBeNull();
    expect(blind.signal().blind).toBe(true);
  });

  it('the headline is the live score with the map under it, or the record within reach', () => {
    const sim = later();
    expect(sim.headline()).toEqual({ value: 0, sub: t('head.battle', { c: 1, n: 1, of: 5 }) });
    const boss = later({ progress: { battle: 9 } });
    expect(boss.headline().sub).toContain(t('demon.szarancza'));
    const near = later({ planned: 300, progress: { best: { 300: 10 } } });
    near.score = 8;
    expect(near.headline().sub).toBe(t('head.record', { n: 2 }));
  });
});

describe('Mgła bitewna: the blind Natarcie', () => {
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
  });
});

describe('battles in a session', () => {
  const win = (sim: ZastepySim) => {
    sim.battle.ash = 1;
    sim.battle.light = 200;
    sim.send('straznik');
    sim.battle.fighters.find(f => f.side === 1)!.x = sim.battle.road - 0.5;
  };

  it('a won battle pays gold and stars, moves on the map, and the card between battles goes on by itself', () => {
    const sim = later({ planned: 600 });
    win(sim);
    const gold = sim.p.gold;
    let ev = drive(sim, 2, frame());
    expect(ofType(ev, 'won')).toHaveLength(1);
    const pay = ofType(ev, 'winGold')[0];
    expect(pay.stars).toBe(3);
    expect(pay.fresh).toBe(3);
    expect(sim.p.stars[0]).toBe(3);
    expect(sim.p.battle).toBe(1);
    expect(sim.p.won).toBe(1);
    expect(sim.p.gold).toBe(gold + RULES.winGold + 3 * RULES.starGold);
    ev = drive(sim, RULES.wonHold + 0.2, frame());
    expect(sim.stage).toBe('upgrade');
    expect(sim.offers.map(o => o.what)).toEqual(['gate', 'hero', 'straznik']);
    ev = drive(sim, RULES.upgradeSec + 0.2, frame());
    expect(sim.stage).toBe('battle');
    expect(ofType(ev, 'battleStart')[0]).toMatchObject({ battle: 1, retry: 0 });
  });

  it('stars: one for winning, two with half the walls, three with four fifths', () => {
    expect([0.1, 0.5, 0.79, 0.8, 1].map(starsFor)).toEqual([1, 2, 2, 3, 3]);
  });

  it('a fallen gate of light is a withdrawal: the gold stays, the battle starts again with stronger walls', () => {
    const sim = later({ planned: 600 });
    const walls0 = sim.battle.wallsMax;
    sim.battle.walls = 0.5;
    spawn(sim.battle, 'cien');
    const d = sim.battle.fighters.find(f => f.side === -1)!;
    d.x = 0.5;
    d.hp = 9999;
    const ev = drive(sim, RULES.lostHold + RULES.upgradeSec + 1, frame());
    expect(ofType(ev, 'lost')).toHaveLength(1);
    expect(sim.p.battle).toBe(0);
    expect(sim.battle.wallsMax).toBe(walls0 + RULES.wallsPerRetreat);
    expect(ofType(ev, 'battleStart').at(-1)).toMatchObject({ battle: 0, retry: 1 });
  });

  it('buys on the card between battles: keys 1–3 buy, Space goes on', () => {
    const sim = later({ planned: 600, progress: { gold: 500 } });
    win(sim);
    drive(sim, RULES.wonHold + 2.5, frame());
    expect(sim.stage).toBe('upgrade');
    const g = sim.p.gold;
    expect(sim.key('1', true)).toBe(true);
    expect(sim.p.gate).toBe(2);
    expect(sim.p.gold).toBe(g - gatePrice(1)!);
    expect(sim.offers[1].what).toBe('hero');
    sim.key('2', true);
    expect(sim.p.hero).toBe(2);
    sim.key(' ', true);
    drive(sim, 0.1, frame());
    expect(sim.stage).toBe('battle');
    expect(sim.battle.gate).toBe(2);
    expect(sim.battle.pillarStats.sec).toBe(pillarFor(2).sec);
  });

  it('offers the answer to a shade that marches for the first time in the next battle', () => {
    const sim = later({ planned: 600, progress: { battle: 2, gate: 3, gold: 999 } });
    win(sim);
    drive(sim, RULES.wonHold + 1.5, frame());
    expect(sim.stage).toBe('upgrade');
    // battle 3 brings the slingers: the rider answers them
    expect(sim.offers.at(-1)!.what).toBe(ANSWER.miotacz);
  });

  it('raises the pillar with a tap on the road (or H) when ready', () => {
    const sim = later();
    expect(sim.raise(10)).toBe(false);
    drive(sim, RULES.pillarFirst + 0.1, frame());
    expect(sim.key('h', true)).toBe(true);
    expect(sim.pillarsNow).toBe(1);
    expect(sim.battle.pillar).not.toBeNull();
  });

  it('a new chapter is a new age: its story card shows once, and the battle waits while it is up', () => {
    const sim = later({ planned: 600, progress: { battle: 4, seen: 1 } });
    win(sim);
    sim.battle.bossBattle;
    // the boss battle is won when its boss falls: force it
    (sim.battle as unknown as { end(o: string): void }).end('won');
    let ev = drive(sim, RULES.wonHold + RULES.upgradeSec + 0.5, frame());
    const story = ofType(ev, 'story');
    expect(story).toEqual([{ type: 'story', kind: 'age', age: 1 }]);
    expect(sim.p.seen & 2).toBe(2);
    sim.cardOn = true;
    const t0 = sim.battle.t;
    drive(sim, 2, frame());
    expect(sim.battle.t).toBe(t0);
    sim.cardOn = false;
    ev = drive(sim, 1, frame());
    expect(sim.battle.t).toBeGreaterThan(t0);
  });

  it('counts the demons beaten live: the headline is the score', () => {
    const sim = later();
    drive(sim, 30, frame());
    expect(sim.score).toBe(sim.battle.beaten);
    expect(sim.result().score).toBe(sim.score);
    expect(sim.headline().value).toBe(sim.score);
  });
});

describe('the first session teaches, Tymek talks', () => {
  it('opens with the story card and teaches the card, then the pillar; a later session teaches nothing done', () => {
    const first = makeSim({ planned: 300 });
    const all: SimEvent[] = [];
    // the opening's events were emitted at start()
    all.push(...first.take());
    expect(ofType(all, 'story')[0]).toMatchObject({ kind: 'open' });
    const clock = { t: 0 };
    all.push(...drive(first, 12, frame(), clock));
    const teach = ofType(all, 'teach');
    expect(teach[0].what).toBe('card');
    first.battle.light = 200;
    first.send('straznik');
    all.push(...drive(first, 20, frame(), clock));
    expect(ofType(all, 'teach').some(e => e.what === 'pillar')).toBe(true);
    first.raise();
    first.finish();
    const back = makeSim({ progress: { ...first.p, giftDay: DAY }, planned: 300 });
    const evs = [...back.take(), ...drive(back, 20, frame())];
    expect(ofType(evs, 'teach').filter(e => e.what === 'card' || e.what === 'pillar')).toHaveLength(0);
    expect(ofType(evs, 'story')).toHaveLength(0);
  });

  it('talks at the opening and at a block start, a line at a time, never over the block banner', () => {
    const sim = later({ planned: 300 });
    const ev = drive(sim, 40, frame({ level: 0.9, focused: true }));
    const says = ofType(ev, 'say');
    expect(says.length).toBeGreaterThanOrEqual(2);
    expect(says[0].moment).toBe('open');
    for (const s of says) expect(s.text.length).toBeLessThanOrEqual(90);
    // never two at once
    const at: number[] = [];
    let tt = 0;
    const sim2 = later({ planned: 300 });
    drive(sim2, 60, frame({ level: 0.9 }), { t: 0 }, t => { tt = t; for (const e of sim2.take()) if (e.type === 'say') at.push(tt); });
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThan(2);
  });

  it('has at least three variants for every moment, each under 90 characters, in every language', () => {
    for (const [m, list] of Object.entries(LINES)) {
      expect(list.length, m).toBeGreaterThanOrEqual(3);
    }
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, k).toBeLessThanOrEqual(90);
    }
  });
});

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a Cisza, the finale\'s 6 s left over', () => {
    for (const sec of [40, 60, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(sec, first, mulberry32(sec));
        const total = plan.reduce((s, b) => s + b.dur, 0);
        expect(total).toBeCloseTo(sec - RULES.finale, 0);
        expect(plan.at(-1)!.kind).toBe('rest');
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
      }
    }
  });

  it('a very short test session (10 s) still has a push and a rest', () => {
    for (const first of [false, true]) {
      const plan = planBlocks(10, first, mulberry32(1));
      expect(plan.some(b => b.kind === 'push')).toBe(true);
      expect(plan.at(-1)!.kind).toBe('rest');
      expect(plan.every(b => b.dur > 0)).toBe(true);
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
  it('prices the gate, the units and the pillar; opens cards by the gate\'s level', () => {
    expect(gatePrice(1)).toBe(RULES.gatePrice);
    expect(gatePrice(RULES.gateMax)).toBeNull();
    expect(unitPrice('straznik', RULES.unitMaxLevel)).toBeNull();
    expect(heroPrice(1)).toBe(RULES.heroPrice);
    expect(cardsAt(1)).toEqual(['straznik', 'lucznik', 'tarczownik']);
    expect(cardsAt(10)).toHaveLength(7);
    expect(nextCardGate(1)).toEqual({ id: 'wlocznik', gate: 2 });
    expect(wallsFor(3, 1)).toBe(RULES.walls + 2 * RULES.wallsPerLevel + RULES.wallsPerRetreat);
  });

  it('an age makes the host stronger', () => {
    const a = unitStats('straznik', 1, 0), b = unitStats('straznik', 1, 2), c = unitStats('straznik', 2, 0);
    expect(b.hp).toBeGreaterThan(a.hp);
    expect(b.dmg).toBeGreaterThan(a.dmg);
    expect(c.dmg).toBeGreaterThan(a.dmg);
  });

  it('buys with gold only: a gate level, a unit level of an open card, the pillar', () => {
    const p = { ...freshProgress(), gold: 30 };
    expect(buyGate(p)).toBe(false);
    p.gold = 1000;
    expect(buyGate(p)).toBe(true);
    expect(p.gate).toBe(2);
    expect(buyUnit(p, 'serafin')).toBe(false);
    expect(buyUnit(p, 'straznik')).toBe(true);
    expect(p.units.straznik).toBe(2);
    expect(buyHero(p)).toBe(true);
    expect(p.hero).toBe(2);
    expect(p.gold).toBe(1000 - gatePrice(1)! - unitPrice('straznik', 1)! - heroPrice(1)!);
  });

  it('migrates a v1 save in place: keeps what it means, adds the new, never crashes on odd fields', () => {
    const v1 = {
      v: 1, sessions: 7, total: 312, won: 9, smoks: 1, trumpets: 4, battle: 11, gold: 140, goldAll: 900, gate: 4,
      units: { straznik: 3, lucznik: 2, tarczownik: 2, jezdziec: 1, serafin: 1, archaniol: 1 }, calls: 14,
      best: { 300: 61, 600: 'x' }, lastLen: 300, giftDay: '2026-11-02',
    };
    const p = migrate(v1 as unknown as ZastepyProgress);
    expect(p.ver).toBe(2);
    expect('v' in p).toBe(false);
    expect(p.sessions).toBe(7);
    expect(p.best).toEqual({ 300: 61 });
    expect(bestOf(p)).toBe(61);
    expect(p.gold).toBe(140);
    expect(p.gate).toBe(4);
    expect(p.battle).toBe(11);
    expect(p.bosses).toBe(1);
    expect(p.units.straznik).toBe(3);
    expect(p.units.wlocznik).toBe(1);
    expect(p.hero).toBe(1);
    expect(p.stars).toEqual([]);
    expect(p.seen & 1).toBe(1);
    // idempotent
    expect(migrate(p)).toEqual({ ...p });
    // odd fields of the wrong type are reset, not trusted
    const odd = migrate({ ver: 2, sessions: 'many', units: [1, 2], stars: { a: 1 }, gold: NaN, best: null } as unknown as ZastepyProgress);
    expect(odd.sessions).toBe(0);
    expect(odd.units.straznik).toBe(1);
    expect(odd.stars).toEqual([]);
    expect(odd.gold).toBe(0);
    expect(odd.best).toEqual({});
    // a session runs on a migrated save
    const sim = makeSim({ progress: v1 as unknown as ZastepyProgress });
    drive(sim, 20, frame());
    expect(sim.battle.battle).toBe(11);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
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

  it('result() keeps the record with Math.max; the summary ends on the chronicle', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 2 } } });
    drive(sim, 20, frame());
    const r1 = sim.result(), r2 = sim.result();
    expect(r2).toEqual(r1);
    expect(sim.p.best['40']).toBe(Math.max(2, sim.score));
    expect(r1.record).toBe(sim.score > 2);
    expect(r1.highlights.at(-1)).toBe(t('hl.chronicle', { c: 1, n: 1 }));
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
    sim.bossNow = 1;
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
      const tips = Object.entries(cat).filter(([k]) => k.startsWith('tip.')).map(([, v]) => String(v).toLowerCase()).join(' ');
      for (const word of [/mocniej/, /harder/, /stärker/, /hårdare/]) expect(tips).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap at the canvas centre every 0.65 s (the road: the pillar), Space every third tap, the simulator's focus on. */
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
        sim.raise(15);
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
        expect(smoke({ sessions: 6, giftDay: DAY, battle: 4, gate: 3, seen: 31 }, seed, eeg), `later, eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
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
    const how = mod.howto!();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
  });

  it('builds the progress card from elements and buys with gold: the gate, a unit; save() after each', async () => {
    const { progressPanel } = await import('../src/arcade/zastepy/panel');
    const p = { ...freshProgress(), sessions: 3, gold: 200, total: 90, won: 2, battle: 2 };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    expect(el.textContent).toContain('Brama światła · poziom 1');
    expect(el.textContent).toContain('Strażnik');
    expect(el.textContent).toContain(t('age.0'));
    const buttons = () => [...el.querySelectorAll('button')] as HTMLButtonElement[];
    const gateBtn = buttons().find(b => b.textContent!.startsWith('Podnieś bramę'))!;
    gateBtn.click();
    expect(p.gate).toBe(2);
    expect(saved).toBe(1);
    expect(el.textContent).toContain('Brama światła · poziom 2');
    const unitBtn = buttons().find(b => b.textContent!.startsWith('+1'))!;
    unitBtn.click();
    expect(saved).toBe(2);
    p.gold = 0;
    const poor = progressPanel(p, () => { saved++; });
    (poor.querySelector('button') as HTMLButtonElement).click();
    expect(saved).toBe(2);
  });

  it('opens an old v1 save in the lobby without crashing', async () => {
    const mod = (await import('../src/arcade/zastepy/index')).default;
    const { progressPanel } = await import('../src/arcade/zastepy/panel');
    const v1 = { v: 1, sessions: 3, total: 50, won: 2, smoks: 0, trumpets: 1, battle: 3, gold: 60, goldAll: 200, gate: 2, units: { straznik: 2 }, calls: 5, best: { 300: 20 }, lastLen: 300, giftDay: '' };
    expect(mod.best(v1 as unknown as ZastepyProgress)).toBe(20);
    expect(() => progressPanel(v1 as unknown as ZastepyProgress, () => {})).not.toThrow();
  });
});
