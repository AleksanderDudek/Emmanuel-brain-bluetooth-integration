import { describe, expect, it } from 'vitest';
import { ARMOUR, BROOD, DRAGONS, FORGE, LINES, LINE_COUNT, MOMENTS, WEAPONS, gearStats, weaponStats } from '../src/arcade/jerzy/content';
import { CATALOGS, t, unit } from '../src/arcade/jerzy/i18n';
import { affordable, bestOf, buyForge, dragonAt, earnArmour, freshProgress, hpOf, migrate, type JerzyProgress } from '../src/arcade/jerzy/meta';
import { RULES } from '../src/arcade/jerzy/rules';
import { JerzySim, auraFor, finaleFor, planBlocks, xpNeed, type SimEvent } from '../src/arcade/jerzy/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
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

/** A returning player (no warm-up, no opening card). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: ['move', 'scales', 'choose', 'aura', 'quench', 'sword', 'rest', 'boss', 'evolve', 'chest'], ...o.progress } });

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

/** Nothing comes in: no spawns, no waves (a quiet field for one rule). */
function quiet(sim: JerzySim): void {
  (sim as unknown as { director: () => void }).director = () => {};
  sim.brood.length = 0;
}

/** Keep the field empty frame by frame (no level-ups from stray scales). */
const empty = (sim: JerzySim) => () => {
  sim.brood.length = 0;
  sim.scales.length = 0;
};

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates Tarcza and Postój, ending on a Postój', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      const sum = plan.reduce((s, b) => s + b.dur, 0);
      expect(sum).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the dock the block, its seconds left, and the next one during the telegraph', () => {
    const sim = later({ planned: 300 });
    const b = sim.block;
    expect(b.kind).toBe('push');
    drive(sim, b.dur - 2, frame());
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('rest');
  });

  it('makes every 4th Tarcza blind from the 3rd session (Dym), never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock);
    }
    // pushes counted 3, 4 … : the 4th overall (this session's 2nd) is blind
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
  });
});

describe('the knight and the joystick', () => {
  it('walks where the stick points, at the walk speed; a tap without a ready sword does nothing', () => {
    const sim = later();
    quiet(sim);
    sim.steer(1, 0);
    drive(sim, 1, frame());
    expect(sim.knight.x).toBeCloseTo(RULES.walk, 1);
    sim.steer(0, 0);
    const x = sim.knight.x;
    expect(sim.tap()).toBe(false);
    drive(sim, 0.5, frame());
    expect(sim.knight.x).toBeCloseTo(x, 5);
  });

  it('walks with WASD and the arrows', () => {
    const sim = later();
    quiet(sim);
    sim.key('ArrowDown', true);
    drive(sim, 0.5, frame());
    sim.key('ArrowDown', false);
    expect(sim.knight.y).toBeGreaterThan(1.5);
    sim.key('a', true);
    drive(sim, 0.5, frame());
    expect(sim.knight.x).toBeLessThan(-1.5);
  });
});

describe('the brood and the weapons', () => {
  it('the sword strikes by itself; a beaten creature dissolves into smoke and leaves a scale', () => {
    const sim = later();
    quiet(sim);
    const c = (sim as unknown as { spawn: (k: string, a: number) => { x: number; y: number; hp: number } }).spawn('piskle', 0);
    c.x = 1.2;
    c.y = 0;
    const evs = drive(sim, 2, frame());
    expect(ofType(evs, 'swing').length).toBeGreaterThan(0);
    expect(ofType(evs, 'gone')).toHaveLength(1);
    expect(sim.score).toBeGreaterThanOrEqual(BROOD.piskle.xp);
  });

  it('comes in growing waves', () => {
    const sim = later({ planned: 600 });
    drive(sim, 10, frame(), { t: 0 }, () => sim.knight.hearts = sim.knight.max);
    const early = sim.brood.length;
    const clock = { t: 10 };
    drive(sim, 60, frame(), clock, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    expect(sim.run.t).toBeGreaterThan(60);
    expect(sim.brood.length + sim.score).toBeGreaterThan(early);
  });
});

describe('the shield\'s aura (the band)', () => {
  it('grows with the level in a sighted Tarcza past its lead-in; the threshold ring sits at level 0.5', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 2, HIGH);
    expect(sim.auraR).toBeLessThan(RULES.shieldBase + 0.1);   // the lead-in: not yet
    drive(sim, 6, HIGH);
    expect(sim.auraR).toBeGreaterThan(auraFor(0.9));
    expect(sim.auraMark).toBeCloseTo(auraFor(0.5), 5);
    expect(sim.meter()!).toBeGreaterThan(0.85);
  });

  it('stays at its base without signal, in a Postój and in Dym, never below it', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 10, NONE);
    expect(sim.auraR).toBeCloseTo(RULES.shieldBase, 2);
    expect(sim.meter()).toBeNull();
    drive(sim, sim.block.dur, CALM);
    expect(sim.block.kind).toBe('rest');
    expect(sim.auraR).toBeCloseTo(RULES.shieldBase, 1);
    expect(sim.meter()!).toBeGreaterThan(0.5);
  });

  it('puts out fire inside it and charges the Miecz światła; outside it the fire hurts', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 8, HIGH);
    sim.balls.push({ id: 900, x: 2.5, y: 0, vx: -4, vy: 0, r: 0.2, life: 3 });
    const evs = drive(sim, 0.4, HIGH);
    expect(ofType(evs, 'quench').length).toBeGreaterThan(0);
    expect(sim.charge).toBeGreaterThan(0);
    const sim2 = later();
    quiet(sim2);
    drive(sim2, sim2.block.dur + 1, CALM);   // a Postój: the aura at its base
    sim2.brood.length = 0;
    sim2.balls.length = 0;
    sim2.knight.safe = 0;
    const h = sim2.knight.hearts;
    sim2.balls.push({ id: 901, x: 2.5, y: 0, vx: -4, vy: 0, r: 0.2, life: 3 });
    drive(sim2, 1, CALM);
    expect(sim2.knight.hearts).toBeLessThan(h);
  });

  it('the Tarcza is the peak: spitters hatch as the aura wakes, and a focused knight standing still puts out their fire', () => {
    const sim = later({ seed: 4 });
    const evs = drive(sim, 24, HIGH, { t: 0 }, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    expect(sim.brood.filter(c => c.kind === 'plujka').length + ofType(evs, 'gone').filter(e => e.kind === 'plujka').length).toBeGreaterThanOrEqual(RULES.pushSpitters);
    expect(sim.quenched).toBeGreaterThan(0);
    expect(sim.charge + sim.swords).toBeGreaterThan(0);
  });

  it('beats and throws the brood inside it out', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 8, HIGH);
    const c = (sim as unknown as { spawn: (k: string, a: number) => { x: number; y: number; hp: number; kx: number } }).spawn('pancernik', 0);
    c.x = 1.5;
    c.y = 0;
    c.hp = 999;
    const evs = drive(sim, RULES.pulseSec + 0.1, HIGH);
    expect(ofType(evs, 'pulse').some(e => e.n > 0)).toBe(true);
  });

  it('the Miecz światła: charged by a held focus, released by a tap, dissolves the brood on screen', () => {
    const sim = later();
    quiet(sim);
    sim.charge = 0.99;
    drive(sim, 7, HIGH);
    expect(sim.swordReady).toBe(true);
    for (let i = 0; i < 5; i++) (sim as unknown as { spawn: (k: string, a: number) => unknown }).spawn('piskle', i);
    for (const c of sim.brood) { c.x = c.x * 0.3; c.y = c.y * 0.3; }
    expect(sim.tap()).toBe(true);
    const evs = sim.take();
    expect(ofType(evs, 'sword')).toHaveLength(1);
    expect(sim.brood).toHaveLength(0);
    expect(sim.swords).toBe(1);
  });

  it('a blind Tarcza keeps the base and pays the block\'s share into the Miecz at its end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    quiet(sim);
    const clock = { t: 0 };
    while (!(sim.block.kind === 'push' && sim.block.blind)) drive(sim, sim.block.dur + 0.02, frame(), clock, empty(sim));
    drive(sim, 8, HIGH, clock, empty(sim));
    expect(sim.auraLook).toBe('smoke');
    expect(sim.meter()).toBeNull();
    expect(sim.auraR).toBeLessThan(sim.stats.base + 0.05);
    const before = sim.charge;
    const evs = drive(sim, sim.block.dur - sim.blockT + 0.05, HIGH, clock, empty(sim));
    expect(ofType(evs, 'smoke')).toHaveLength(1);
    expect(sim.charge).toBeGreaterThan(before);
  });
});

describe('levels and cards', () => {
  it('fills a level from scales and offers three cards; the world holds while choosing', () => {
    const sim = later();
    quiet(sim);
    (sim as unknown as { collect: (v: number, x: number, y: number) => void }).collect(xpNeed(1), 0, 0);
    expect(sim.choice).not.toBeNull();
    expect(sim.choice!.cards).toHaveLength(3);
    sim.steer(1, 0);
    drive(sim, 1, frame());
    expect(sim.knight.x).toBe(0);
    const card = sim.choice!.cards[1];
    drive(sim, 0.3, frame());
    sim.tap(1);
    expect(sim.choice).toBeNull();
    if (card.id) expect(sim.itemLevel(card.id)).toBe(card.to);
  });

  it('takes the first card by itself after a while (and Space takes the first)', () => {
    const sim = later();
    quiet(sim);
    (sim as unknown as { collect: (v: number, x: number, y: number) => void }).collect(xpNeed(1), 0, 0);
    drive(sim, RULES.choiceSec + 0.1, frame());
    expect(sim.choice).toBeNull();
  });

  it('shows the numbers on a card', () => {
    expect(weaponStats('miecz', 1)).toContain(String(WEAPONS.miecz.dmg[0]));
    expect(weaponStats('kopia', 6)).toContain(String(WEAPONS.kopia.dmg[5]));
    expect(gearStats('sztandar', 2)).toContain('24');
  });

  it('offers the evolution first when a weapon is at 5 and its pair at 3; a chest evolves it too', () => {
    const sim = later();
    quiet(sim);
    sim.run.items.miecz = 5;
    sim.run.items.sztandar = 3;
    sim.run.order.push('sztandar');
    expect(sim.evoReady()).toBe('miecz');
    expect(sim.cardsFor(false)[0]).toMatchObject({ kind: 'evo', id: 'miecz', to: 6 });
    sim.drops.push({ id: 77, kind: 'chest', x: 0.2, y: 0, t: 0, pulled: true });
    const evs = drive(sim, 0.5, frame());
    expect(ofType(evs, 'evolve')).toEqual([{ type: 'evolve', id: 'miecz' }]);
    expect(sim.itemLevel('miecz')).toBe(6);
  });

  it('never offers more than 4 weapons; fills with apples and scales when everything is full', () => {
    const sim = later();
    for (const id of ['miecz', 'kopia', 'sokol', 'wiadra'] as const) sim.run.items[id] = 5;
    for (const id of ['sztandar', 'rekawice', 'buty', 'tarcza'] as const) sim.run.items[id] = 2;
    sim.run.order.splice(0, sim.run.order.length, 'miecz', 'kopia', 'sokol', 'wiadra', 'sztandar', 'rekawice', 'buty', 'tarcza');
    for (let i = 0; i < 10; i++) {
      for (const c of sim.cardsFor(false)) expect(['rog', 'kon', 'zbroja', 'sakwa']).not.toContain(c.id);
    }
    for (const id of ['sztandar', 'rekawice', 'buty', 'tarcza'] as const) sim.run.items[id] = 3;
    const cards = sim.cardsFor(false);
    expect(cards.map(c => c.kind)).toContain('evo');
  });
});

describe('the Postój', () => {
  it('heals hearts with calm and gives a free card at its end (golden after a calm one)', () => {
    const sim = later();
    quiet(sim);
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, frame(), clock, empty(sim));
    expect(sim.block.kind).toBe('rest');
    sim.knight.hearts = 1;
    const evs = drive(sim, sim.block.dur, CALM, clock, empty(sim));
    expect(sim.knight.hearts).toBeGreaterThan(1.5);
    const ch = ofType(evs, 'choice');
    expect(ch.some(e => e.source === 'rest' && e.gold)).toBe(true);
    expect(sim.choice!.gold).toBe(true);
  });
});

describe('grace and runs', () => {
  it('at no hearts Linda\'s apple gets him up once; then the run ends with a tally and a new run starts; the scales stay', () => {
    const sim = later();
    quiet(sim);
    (sim as unknown as { collect: (v: number, x: number, y: number) => void }).collect(3, 0, 0);
    if (sim.choice) sim.pick(0);
    const knock = () => { sim.knight.safe = 0; (sim as unknown as { hurt: (v: number, x: number, y: number) => void }).hurt(99, 0, 0); };
    knock();
    let evs = drive(sim, RULES.downSec + 0.1, frame());
    expect(ofType(evs, 'apple').some(e => e.revive)).toBe(true);
    expect(sim.knight.hearts).toBeGreaterThan(0);
    knock();
    evs = drive(sim, RULES.downSec + 0.1, frame());
    expect(ofType(evs, 'runEnd')).toHaveLength(1);
    expect(sim.tally).not.toBeNull();
    const score = sim.score;
    evs = drive(sim, RULES.tallySec + 0.1, frame());
    expect(ofType(evs, 'newRun')).toEqual([{ type: 'newRun', n: 2 }]);
    expect(sim.score).toBe(score);
    expect(sim.run.level).toBe(1);
    expect(sim.knight.hearts).toBe(sim.knight.max);
  });
});

describe('the land\'s dragon', () => {
  function toBoss(sim: JerzySim, clock = { t: 0 }) {
    for (let i = 0; i < 12 && !sim.bossOn; i++) {
      drive(sim, sim.block.dur + 0.02, frame(), clock, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    }
    return clock;
  }

  it('comes on a Tarcza once the run is old enough, telegraphs, attacks and is dizzy after', () => {
    const sim = later({ planned: 600 });
    quiet(sim);
    const clock = toBoss(sim);
    expect(sim.bossOn).toBe(true);
    expect(sim.block.kind).toBe('push');
    const evs = drive(sim, 9, frame(), clock, () => { sim.knight.hearts = sim.knight.max; });
    expect(ofType(evs, 'bossTele').length).toBeGreaterThan(0);
    expect(ofType(evs, 'bossAct').length).toBeGreaterThan(0);
    expect(ofType(evs, 'flaw').length).toBeGreaterThan(0);
  });

  it('flies off for a nap at the Tarcza\'s end and keeps his wounds', () => {
    const sim = later({ planned: 600 });
    quiet(sim);
    const clock = toBoss(sim);
    drive(sim, 2, frame(), clock);
    sim.boss.damage = 50;
    const evs = drive(sim, sim.block.dur, frame(), clock, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    expect(ofType(evs, 'nap')).toHaveLength(1);
    expect(sim.boss.damage).toBeGreaterThanOrEqual(50);
  });

  it('driven off: a story card, a big chest, the next land waits on the map', () => {
    const sim = later({ planned: 600 });
    quiet(sim);
    const clock = toBoss(sim);
    drive(sim, 2, frame(), clock);
    const b = sim.boss;
    b.damage = b.all - 1;
    b.roared = 3;
    b.state = 'flaw';
    (sim as unknown as { hurtBoss: (v: number, w: boolean) => void }).hurtBoss(10, true);
    const evs = sim.take();
    expect(ofType(evs, 'driven')).toHaveLength(1);
    expect(sim.story?.kind).toBe('land');
    expect(sim.boss.idx).toBe(1);
    expect(sim.drops.some(d => d.kind === 'bigChest')).toBe(true);
    sim.finish();
    expect(sim.p.dragon).toBe(1);
    expect(sim.p.damage).toBe(0);
    expect(sim.p.driven).toBe(1);
    expect(sim.p.armour).toContain('proporzec');
  });
});

describe('the end and the result', () => {
  it('settles once; result() is idempotent and keeps records with max', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, frame({ level: 0.6 }), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    const p = sim.p;
    const total = p.total;
    sim.finish();
    sim.result();
    expect(p.total).toBe(total);
    expect(p.sessions).toBe(6);
    expect(p.best['40']).toBe(sim.score);
    expect(passage(a.verse!).text.length).toBeGreaterThan(10);
  });

  it('finish() mid-session settles as the end would', () => {
    const sim = later({ planned: 300 });
    drive(sim, 20, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.bank).toBe(sim.score);
    expect(sim.p.runs).toBe(1);
  });
});

describe('the meta', () => {
  it('migrates an old (v1) save in place: the records and the session count stay, the rest starts over', () => {
    const old = {
      v: 1, sessions: 7, total: 900, pushes: 12, dragon: 2, damage: 'x', driven: 2, best: { 300: 140, 180: 'oops' }, lastLen: 300,
      swords: 4, quenched: 77, bestLevel: 6,
    };
    const p = migrate(mergeSaved(freshProgress(), old));
    expect(p.ver).toBe(2);
    expect((p as unknown as { v?: number }).v).toBeUndefined();
    expect(p.sessions).toBe(7);
    expect(p.pushes).toBe(12);
    expect(p.best).toEqual({ 300: 140 });
    expect(p.dragon).toBe(0);
    expect(p.damage).toBe(0);
    expect(p.forge).toEqual({});
    expect(p.armour).toEqual([]);
    expect(bestOf(p)).toBe(140);
    expect(migrate(p)).toEqual(p);
    // a game runs on it
    const sim = new JerzySim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
  });

  it('repairs a v2 save with wrong types', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 2, sessions: 'x', forge: [], armour: 'helm', seen: null, bank: 50 }));
    expect(p.sessions).toBe(0);
    expect(p.forge).toEqual({});
    expect(p.armour).toEqual([]);
    expect(p.bank).toBe(50);
  });

  it('the forge spends the bank; the armoury follows its milestones', () => {
    const p = freshProgress();
    p.bank = 100;
    expect(affordable(p)).toBe('krok');
    expect(buyForge(p, 'sila')).toBe(true);
    expect(p.bank).toBe(100 - FORGE.find(f => f.id === 'sila')!.cost);
    expect(buyForge(p, 'serce')).toBe(false);
    p.runs = 6;
    p.total = 2600;
    expect(earnArmour(p).sort()).toEqual(['helm', 'pas']);
    expect(earnArmour(p)).toEqual([]);
    expect(ARMOUR).toHaveLength(6);
  });

  it('the map goes round the four lands, each circle stronger', () => {
    expect(dragonAt(0).spec.kind).toBe('zielony');
    expect(dragonAt(5)).toMatchObject({ circle: 1 });
    expect(hpOf(DRAGONS[0], 1)).toBeGreaterThan(hpOf(DRAGONS[0], 0));
  });
});

describe('Linda talks, and the texts in four languages', () => {
  it('has at least 3 variants per moment, each fits a bubble (90 characters)', () => {
    for (const m of MOMENTS) {
      expect(LINE_COUNT[m]).toBeGreaterThanOrEqual(3);
      for (const l of LINES[m]) expect(l.length, l).toBeLessThanOrEqual(90);
    }
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) if (k.startsWith('say.')) expect((v as string).length, `${k}: ${v}`).toBeLessThanOrEqual(90);
    }
  });

  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 łuska, 3 łuski, 5 łusek)', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['łuska', 'łuski', 'łusek', 'łuski', 'łusek']);
    expect(t('scales', { n: 12 })).toBe('12 łusek');
  });

  it('never asks to concentrate harder, never uses holiness words, gore or "hack"; the dragon is never killed', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /\bkill/, /töte/, /döda/, /pray/, /módl/, /\bbete\b/]) {
        expect(all).not.toMatch(word);
      }
      const tips = Object.entries(cat).filter(([k]) => k.startsWith('tip.') || k.startsWith('howto.')).map(([, v]) => String(v).toLowerCase()).join(' ');
      for (const word of [/mocniej/, /harder/, /stärker/, /hårdare/]) expect(tips).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the centre every 0.65 s (a tap: no drag), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<JerzyProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, score = 0;
    const seen: number[] = [];
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.steer(0, 0);
        sim.tap(1);
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
      score = sim.result().score;
      if (Math.round(t * 60) % 300 === 0) seen.push(score);
    }
    return { score, seen, sim };
  }

  it('gathers scales by 22 s on either band, first session or later, and the headline climbs live', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) {
        const { score, seen } = smoke({}, seed, eeg);
        expect(score, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(3);
        expect(seen.at(-1)!).toBeGreaterThan(seen[1] ?? 0);
      }
    }
    expect(smoke({ sessions: 6 }, 3, false, 300).score).toBeGreaterThan(3);
  });

  it('a tap without a drag never moves the knight', () => {
    const { sim } = smoke({ sessions: 6 }, 2, false, 300);
    expect(Math.hypot(sim.knight.x, sim.knight.y)).toBeLessThan(1);
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
    const how = mod.howto!();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
  });

  it('builds the progress card from elements: the map of four lands, the forge, the armoury', async () => {
    const { progressPanel } = await import('../src/arcade/jerzy/panel');
    const p = { ...freshProgress(), sessions: 3, dragon: 1, damage: 20, driven: 1, total: 120, bank: 200, armour: ['proporzec'] };
    let saved = 0;
    const el = progressPanel(p, () => saved++);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(DRAGONS.length);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(2);
    expect(el.textContent).toContain(t('town.bagienny'));
    const buy = el.querySelector<HTMLButtonElement>('button:not([disabled])');
    expect(buy).not.toBeNull();
    buy!.click();
    expect(saved).toBe(1);
    expect(p.bank).toBeLessThan(200);
  });
});
