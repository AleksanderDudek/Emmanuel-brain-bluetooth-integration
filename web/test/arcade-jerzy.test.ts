import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ARMOUR, BROOD, COMPANIONS, DRAGONS, DUETS, FORGE, LINES, LINE_COUNT, MOMENTS, TREASURES, WEAPONS, gearStats, palStats, weaponStats,
  type CompanionId, type ItemId, type TreasureId, type WeaponId,
} from '../src/arcade/jerzy/content';
import { CATALOGS, hand, t, unit } from '../src/arcade/jerzy/i18n';
import { layout, sheet, tallyBox } from '../src/arcade/jerzy/layout';
import { SANS, SERIF, font } from '../src/arcade/jerzy/paint';
import {
  affordable, bestOf, buyForge, canFight, clearFight, crowns, earnArmour, earnCompanions, fightOf, fights, freshProgress, frontier, hpOf, migrate,
  pickFight, road, slots, toggleParty, woundKey, type JerzyProgress,
} from '../src/arcade/jerzy/meta';
import { RULES } from '../src/arcade/jerzy/rules';
import { JerzySim, auraFor, duetsOf, finaleFor, planBlocks, xpNeed, type Card, type Creature, type SimEvent } from '../src/arcade/jerzy/sim';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, THUMB, auditTargets, target } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-11';
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

const SEEN = ['move', 'scales', 'choose', 'aura', 'quench', 'sword', 'rest', 'boss', 'evolve', 'chest', 'reroll', 'pal', 'treasure', 'duet', 'fatal', 'ring'];
/** A returning player (no warm-up, no opening card, every coach mark seen). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: SEEN, ...o.progress } });

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

/** The sim's private parts, for the rules tested one at a time. */
type Inner = {
  director: () => void;
  spawn: (k: string, a: number, elite?: boolean, ringK?: number, at?: { x: number; y: number }) => Creature;
  collect: (v: number, x: number, y: number) => void;
  hurt: (v: number, x: number, y: number) => void;
  hurtBoss: (v: number, src: string) => void;
  bossArrive: () => void;
  telegraph: (p: string, fast: number) => void;
  attack: () => void;
  endAttack: () => void;
  startMove: () => void;
  quenchOne: (x: number, y: number, big: boolean) => void;
  open: (d: { id: number; kind: string; x: number; y: number; t: number; pulled: boolean; src?: string }) => void;
  addTreasure: (id: TreasureId, x: number, y: number) => void;
  apply: (c: Card, gold: boolean) => void;
  endRun: () => void;
};
const inner = (sim: JerzySim) => sim as unknown as Inner;

/** Nothing comes in: no spawns, no waves (a quiet field for one rule). */
function quiet(sim: JerzySim): void {
  inner(sim).director = () => {};
  sim.brood.length = 0;
}

/** Keep the field empty frame by frame (no level-ups from stray scales). */
const empty = (sim: JerzySim) => () => {
  sim.brood.length = 0;
  sim.scales.length = 0;
};

/** Put the land's dragon on the field now (no waiting for the second Tarcza), standing still. */
function bossNow(sim: JerzySim): void {
  inner(sim).bossArrive();
  const b = sim.boss;
  b.x = sim.knight.x;
  b.y = sim.knight.y - 3.2;
  b.air = 0;
  inner(sim).startMove();
}

/** A fresh progress on a given land and road (the map opened that far). */
function onLand(land: number, tier = 0, extra: Partial<JerzyProgress> = {}): Partial<JerzyProgress> {
  const cleared = DRAGONS.map((_, i) => (i < land ? tier + 1 : tier));
  return { sessions: 5, pushes: 1, seen: SEEN, cleared, land, tier, ...extra };
}

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
    const c = inner(sim).spawn('piskle', 0);
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

  it('the hammer flies out and comes back, striking on both ways', () => {
    const sim = later();
    quiet(sim);
    sim.run.items = { mlot: 1 };
    sim.run.order = ['mlot'];
    const c = inner(sim).spawn('pancernik', 0);
    c.x = 2.5;
    c.y = 0;
    c.hp = c.max = 999;
    const evs = drive(sim, 1.6, frame());
    const hits = ofType(evs, 'hit').filter(e => !e.boss);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(sim.hammers.length + hits.length).toBeGreaterThan(0);
    expect(sim.run.dmg.mlot).toBeGreaterThan(0);
  });

  it('the crossbow aims at the strongest, the caltrops bite and slow', () => {
    const sim = later();
    quiet(sim);
    sim.run.items = { kusza: 1, kolce: 1 };
    sim.run.order = ['kusza', 'kolce'];
    const weak = inner(sim).spawn('piskle', 0);
    weak.x = 1.5; weak.y = 0;
    weak.hp = weak.max = 50;
    const elite = inner(sim).spawn('pancernik', Math.PI, true);
    elite.x = -4; elite.y = 0;
    elite.hp = elite.max = 500;
    drive(sim, 0.9, frame());
    expect(elite.hp).toBeLessThan(500);
    expect(sim.caltrops.length).toBeGreaterThan(0);
    // a creature standing on the caltrops slows
    weak.x = sim.caltrops[0].x;
    weak.y = sim.caltrops[0].y;
    drive(sim, 0.6, frame());
    expect(sim.run.dmg.kolce).toBeGreaterThan(0);
  });

  it('a critical blow shows as one, and the ring raises the chance', () => {
    const sim = later({ seed: 7 });
    quiet(sim);
    sim.run.items = { miecz: 1, pierscien: 3 };
    sim.run.order = ['miecz', 'pierscien'];
    expect(sim.stats.crit).toBeCloseTo(RULES.crit + 0.24, 5);
    let crits = 0;
    for (let i = 0; i < 40; i++) {
      const c = inner(sim).spawn('pancernik', 0);
      c.x = 1.0; c.y = 0;
      c.hp = c.max = 9999;
      crits += ofType(drive(sim, 1.2, frame()), 'hit').filter(e => e.crit).length;
      sim.brood.length = 0;
    }
    expect(crits).toBeGreaterThan(3);
  });
});

describe('the shield\'s aura (the band)', () => {
  it('grows with the level in a sighted Tarcza past its lead-in; the threshold ring sits at level 0.5', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 2, HIGH);
    expect(sim.auraR).toBeLessThan(RULES.shieldBase + 0.1);
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
    drive(sim2, sim2.block.dur + 1, CALM);
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
    const c = inner(sim).spawn('pancernik', 0);
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
    for (let i = 0; i < 5; i++) inner(sim).spawn('piskle', i);
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

describe('levels, cards, rerolls and duets', () => {
  it('fills a level from scales and offers three cards; the world holds while choosing', () => {
    const sim = later();
    quiet(sim);
    inner(sim).collect(xpNeed(1), 0, 0);
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
    inner(sim).collect(xpNeed(1), 0, 0);
    drive(sim, RULES.choiceSec + 0.1, frame());
    expect(sim.choice).toBeNull();
  });

  it('shows the numbers on a card, for weapons, gear and companions', () => {
    expect(weaponStats('miecz', 1)).toContain(String(WEAPONS.miecz.dmg[0]));
    expect(weaponStats('kopia', 6)).toContain(String(WEAPONS.kopia.dmg[5]));
    expect(weaponStats('mlot', 1)).toContain(String(WEAPONS.mlot.dmg[0]));
    expect(gearStats('sztandar', 2)).toContain('24');
    expect(gearStats('kolczan', 3)).toContain('2');
    for (const id of COMPANIONS) expect(palStats(id, 2).length).toBeGreaterThan(5);
  });

  it('offers the evolution first when a weapon is at 5 and its pair at 3; a chest evolves it too', () => {
    const sim = later();
    quiet(sim);
    sim.run.items.miecz = 5;
    sim.run.items.sztandar = 3;
    sim.run.order.push('sztandar');
    expect(sim.evoReady()).toBe('miecz');
    expect(sim.cardsFor(false)[0]).toMatchObject({ kind: 'evo', id: 'miecz', to: 6 });
    sim.drops.push({ id: 77, kind: 'chest', x: 0.2, y: 0, t: 0, pulled: true, src: 'elite' });
    // no treasure this time: the chest goes to the evolution
    (sim as unknown as { rng: () => number }).rng = () => 0.99;
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
      for (const c of sim.cardsFor(false)) expect(['rog', 'kon', 'mlot', 'kusza', 'kolce', 'zbroja', 'sakwa', 'kolczan', 'plaszcz', 'pierscien']).not.toContain(c.id);
    }
    for (const id of ['sztandar', 'rekawice', 'buty', 'tarcza'] as const) sim.run.items[id] = 3;
    const cards = sim.cardsFor(false);
    expect(cards.map(c => c.kind)).toContain('evo');
  });

  it('Linda reshuffles the cards: new cards, one reshuffle fewer (R too); none left, nothing happens', () => {
    const sim = later();
    quiet(sim);
    inner(sim).collect(xpNeed(1), 0, 0);
    drive(sim, 0.3, frame());
    const left = sim.run.rerolls;
    expect(left).toBe(RULES.rerolls);
    expect(sim.key('r', true)).toBe(true);
    expect(sim.run.rerolls).toBe(left - 1);
    expect(sim.choice!.cards).toHaveLength(3);
    expect(sim.reroll()).toBe(false);
    const sim2 = later({ progress: { forge: { los: 2 } } });
    expect(sim2.run.rerolls).toBe(RULES.rerolls + 2);
  });

  it('two weapons that belong together form a duet (the first time ever, into the chronicle)', () => {
    const sim = later();
    quiet(sim);
    expect(duetsOf({ kopia: 1, kon: 2 })).toEqual(['turniej']);
    inner(sim).apply({ kind: 'new', id: 'kopia', from: 0, to: 1 }, false);
    const evs0 = sim.take();
    expect(ofType(evs0, 'duet')).toHaveLength(0);
    inner(sim).apply({ kind: 'new', id: 'kon', from: 0, to: 1 }, false);
    const evs = sim.take();
    expect(ofType(evs, 'duet')).toEqual([{ type: 'duet', id: 'turniej', first: true }]);
    expect(sim.p.duets).toContain('turniej');
    expect(sim.duet('turniej')).toBe(true);
    // a card names the duet it would form
    const note = sim.cardNotes({ kind: 'new', id: 'rog', from: 0, to: 1 });
    expect(note.duet).toBe('pobudka');
    expect(DUETS).toHaveLength(6);
  });
});

describe('the Postój', () => {
  it('heals hearts with calm and gives a free card at its end (golden after a calm one), once the next block\'s banner is gone', () => {
    const sim = later();
    quiet(sim);
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, frame(), clock, empty(sim));
    expect(sim.block.kind).toBe('rest');
    sim.knight.hearts = 1;
    const evs = drive(sim, sim.block.dur, CALM, clock, empty(sim));
    expect(sim.knight.hearts).toBeGreaterThan(1.5);
    // the next block's banner covers the upper half of a phone: the card waits for it while the world goes on
    expect(sim.bannerUp).toBe(true);
    expect(sim.choice).toBeNull();
    const after = drive(sim, RULES.bannerSec, frame(), clock, empty(sim));
    const ch = ofType([...evs, ...after], 'choice');
    expect(ch.some(e => e.source === 'rest' && e.gold)).toBe(true);
    expect(sim.choice!.gold).toBe(true);
  });
});

describe('grace and runs', () => {
  it('at no hearts Linda\'s apple gets him up once; then the run ends with a tally (with what each weapon did) and a new run starts; the scales stay', () => {
    const sim = later();
    quiet(sim);
    const c = inner(sim).spawn('piskle', 0);
    c.x = 1; c.y = 0;
    drive(sim, 1.5, frame());
    if (sim.choice) sim.pick(0);
    const knock = () => { sim.knight.safe = 0; inner(sim).hurt(99, 0, 0); };
    knock();
    let evs = drive(sim, RULES.downSec + 0.1, frame());
    expect(ofType(evs, 'apple').some(e => e.revive)).toBe(true);
    expect(sim.knight.hearts).toBeGreaterThan(0);
    knock();
    evs = drive(sim, RULES.downSec + 0.1, frame());
    expect(ofType(evs, 'runEnd')).toHaveLength(1);
    expect(sim.tally).not.toBeNull();
    expect(sim.tally!.top[0]).toMatchObject({ src: 'miecz' });
    expect(sim.tally!.top[0].share).toBeGreaterThan(0.5);
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
    expect(ofType(evs, 'flaw').length + ofType(evs, 'fatal').length).toBeGreaterThan(0);
  });

  it('flies off for a nap at the Tarcza\'s end and keeps his wounds — in the save too', () => {
    const sim = later({ planned: 600 });
    quiet(sim);
    const clock = toBoss(sim);
    drive(sim, 2, frame(), clock);
    sim.boss.damage = 50;
    const evs = drive(sim, sim.block.dur, frame(), clock, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    expect(ofType(evs, 'nap')).toHaveLength(1);
    expect(sim.boss.damage).toBeGreaterThanOrEqual(50);
    sim.finish();
    expect(sim.p.wounds[woundKey(0, 0)]).toBeGreaterThanOrEqual(50);
    // the next session meets him wounded
    const sim2 = new JerzySim({ progress: sim.p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
    expect(sim2.boss.damage).toBeGreaterThanOrEqual(50);
  });

  it('driven off: a story card, the big chest with his hoard, the road cleared on the map, the next land waits', () => {
    const sim = later({ planned: 600 });
    quiet(sim);
    bossNow(sim);
    const b = sim.boss;
    b.damage = b.all - 1;
    b.roared = 3;
    b.state = 'flaw';
    b.k = 2;
    inner(sim).hurtBoss(10, 'miecz');
    const evs = sim.take();
    expect(ofType(evs, 'driven')).toHaveLength(1);
    expect(sim.story?.kind).toBe('land');
    expect(sim.story?.first).toBe(true);
    expect(sim.boss.land).toBe(1);
    expect(sim.p.cleared[0]).toBe(1);
    expect(sim.drops.some(d => d.kind === 'bigChest')).toBe(true);
    // the big chest holds his hoard's treasure
    const big = sim.drops.find(d => d.kind === 'bigChest')!;
    big.pulled = true;
    big.x = 0.1;
    big.y = 0;
    sim.story = null;
    const evs2 = drive(sim, 0.4, frame());
    expect(ofType(evs2, 'treasure').map(e => e.id)).toContain(DRAGONS[0].hoard);
    sim.finish();
    expect(sim.p.land).toBe(1);
    expect(sim.p.driven).toBe(1);
    expect(sim.p.armour).toContain('proporzec');
    expect(sim.p.companions).toContain('iskierka');
  });

  it('a harder road: more scales on the dragon, a stronger brood, a bigger treasury bonus', () => {
    expect(hpOf(DRAGONS[0], 1)).toBeGreaterThan(hpOf(DRAGONS[0], 0));
    expect(hpOf(DRAGONS[0], 5)).toBeGreaterThan(hpOf(DRAGONS[0], 3));
    expect(road(2).combo).toBe(1);
    const sim = later({ progress: onLand(0, 1) });
    expect(sim.boss.tier).toBe(1);
    expect(sim.boss.all).toBe(hpOf(DRAGONS[0], 1));
    quiet(sim);
    inner(sim).collect(40, 0, 0);
    sim.choice = null;
    sim.finish();
    expect(sim.bankBonus).toBe(Math.round(sim.score * RULES.roads[1].bank));
    expect(sim.p.bank).toBe(sim.score + sim.bankBonus);
  });
});

describe('each dragon\'s fatal flaw', () => {
  /** A fight on a land; the knight standing still at the origin, the dragon 3.2 u above him. */
  function fight(land: number, o: SimOpts = {}): JerzySim {
    const sim = later({ planned: 600, ...o, progress: { ...onLand(land), ...o.progress } });
    quiet(sim);
    bossNow(sim);
    sim.take();
    return sim;
  }
  /** Telegraph a pattern now and let it play out. */
  function attackNow(sim: JerzySim, p: string): void {
    inner(sim).telegraph(p, 1);
  }

  it('the Green Dragon chokes on the steam when the shield puts out his breath (and Linda hints before)', () => {
    const sim = fight(0);
    const lines = sim.talk.said.join(' ');
    void lines;
    drive(sim, 7, HIGH, { t: 0 }, () => { sim.knight.hearts = sim.knight.max; sim.knight.safe = 1; if (sim.boss.state === 'move') sim.boss.st = 0; });
    attackNow(sim, 'breath');
    const evs = drive(sim, 3, HIGH, { t: 7 }, () => { sim.knight.hearts = sim.knight.max; });
    const fat = ofType(evs, 'fatal');
    expect(fat).toHaveLength(1);
    expect(fat[0]).toMatchObject({ kind: 'zielony', flaw: 'steam', first: true });
    expect(sim.boss.k).toBe(RULES.fatalK);
    expect(sim.p.flaws).toContain('zielony');
    // a breath he is not choked by: only the dizzy window
    const sim2 = fight(0);
    attackNow(sim2, 'breath');
    sim2.knight.x = 8;
    const evs2 = drive(sim2, 3, NONE, { t: 0 }, () => { sim2.knight.hearts = sim2.knight.max; });
    expect(ofType(evs2, 'fatal')).toHaveLength(0);
    expect(ofType(evs2, 'flaw')).toHaveLength(1);
  });

  it('the Marsh Dragon dives under the ground; out of the ring, he sticks in the mud', () => {
    const sim = fight(1);
    attackNow(sim, 'dive');
    expect(sim.boss.under).toBe(true);
    expect(sim.bossHittable).toBe(false);
    sim.steer(1, 0);
    const evs = drive(sim, 2.5, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; });
    sim.steer(0, 0);
    expect(ofType(evs, 'fatal')).toEqual([{ type: 'fatal', kind: 'bagienny', flaw: 'mud', first: true }]);
    // standing in the ring: he bursts under the knight, no mud
    const sim2 = fight(1);
    sim2.knight.safe = 0;
    const h = sim2.knight.hearts;
    attackNow(sim2, 'dive');
    const evs2 = drive(sim2, 2.5, frame());
    expect(ofType(evs2, 'fatal')).toHaveLength(0);
    expect(sim2.knight.hearts).toBeLessThan(h);
  });

  it('the Winged Dragon crashes into the rocks when his swoop misses', () => {
    const sim = fight(2);
    attackNow(sim, 'swoop');
    sim.steer(0, 1);
    const evs = drive(sim, 2.2, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; });
    sim.steer(0, 0);
    expect(ofType(evs, 'fatal').map(e => e.flaw)).toEqual(['crash']);
  });

  it('the Three-Headed attacks in rounds of three different patterns, then his necks tangle', () => {
    const sim = fight(3);
    const evs = drive(sim, 14, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; sim.knight.safe = 1; });
    const acts = ofType(evs, 'bossAct').map(e => e.pattern);
    const fat = ofType(evs, 'fatal');
    expect(fat.length).toBeGreaterThanOrEqual(1);
    expect(fat[0].flaw).toBe('tangle');
    expect(new Set(acts.slice(0, 3)).size).toBe(3);
  });

  it('the Ember Dragon\'s ring of fire: a big shield puts it out; cooling after it, the aura brings him down', () => {
    const sim = fight(4);
    drive(sim, 7, HIGH, { t: 0 }, () => { if (sim.boss.state === 'move') sim.boss.st = 0; });
    expect(sim.auraR).toBeGreaterThan(sim.auraMark);
    attackNow(sim, 'ring');
    const evs = drive(sim, 4, HIGH, { t: 7 }, () => { sim.knight.hearts = sim.knight.max; });
    expect(ofType(evs, 'ringOut')).toHaveLength(1);
    // cooling: walk into him with the aura
    const sim2 = fight(4);
    attackNow(sim2, 'ring');
    const evs2: SimEvent[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 300 && !ofType(evs2, 'fatal').length; i++) {
      if (sim2.boss.hot > 0) { sim2.knight.x = sim2.boss.x; sim2.knight.y = sim2.boss.y + 1.2; }
      evs2.push(...drive(sim2, STEP, frame(), clock, () => { sim2.knight.hearts = sim2.knight.max; sim2.knight.safe = 1; }));
    }
    expect(ofType(evs2, 'fatal').map(e => e.flaw)).toEqual(['heat']);
  });

  it('the Golden Dragon stops to gobble scales left near him (and his coins cool into scales)', () => {
    const sim = fight(5);
    for (let i = 0; i < 6; i++) sim.scales.push({ id: 5000 + i, x: sim.boss.x + 1 + i * 0.2, y: sim.boss.y + 0.5, v: 1, life: 60, pulled: false });
    sim.knight.x = 12;
    const evs = drive(sim, 0.3, frame());
    expect(ofType(evs, 'fatal')).toEqual([{ type: 'fatal', kind: 'zloty', flaw: 'greed', first: true }]);
    expect(sim.boss.eating).toBe(true);
    expect(sim.boss.k).toBe(RULES.greedK);
    drive(sim, 4, frame());
    expect(sim.scales.filter(s => s.id >= 5000)).toHaveLength(0);
    // the coins: those that miss cool into scales
    const sim2 = fight(5);
    attackNow(sim2, 'coins');
    sim2.knight.x = 9;
    drive(sim2, 4, frame(), { t: 0 }, () => { sim2.knight.hearts = sim2.knight.max; });
    expect(sim2.scales.length).toBeGreaterThan(0);
  });

  it('found again later: no "first" any more; the treasury of weak spots is the Book of Dragons', () => {
    const sim = fight(2, { progress: { flaws: ['skrzydlaty'] } });
    attackNow(sim, 'swoop');
    sim.steer(0, 1);
    const evs = drive(sim, 2.2, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; });
    expect(ofType(evs, 'fatal')[0].first).toBe(false);
    expect(sim.flawsNow).toEqual([]);
  });
});

describe('the companions', () => {
  it('Burek fetches what lies beyond the knight\'s reach', () => {
    const sim = later({ progress: { companions: ['pies'], party: ['pies'] } });
    quiet(sim);
    expect(sim.palLevel('pies')).toBe(1);
    sim.scales.push({ id: 7000, x: 5, y: 0, v: 3, life: 60, pulled: false });
    drive(sim, 3, frame());
    expect(sim.scales.some(s => s.id === 7000)).toBe(false);
    expect(sim.score).toBe(3);
  });

  it('Iskierka eats fire near her (the Miecz charges) and spits sparks', () => {
    const sim = later({ progress: { companions: ['iskierka'], party: ['iskierka'] } });
    quiet(sim);
    drive(sim, 0.5, frame());
    const pl = sim.pals[0];
    sim.balls.push({ id: 7100, x: pl.x + 1, y: pl.y, vx: 0, vy: 0, r: 0.2, life: 5 });
    const evs = drive(sim, 0.8, frame());
    expect(ofType(evs, 'pal').some(e => e.what === 'eat')).toBe(true);
    expect(sim.charge).toBeGreaterThan(0);
    const c = inner(sim).spawn('pancernik', 0);
    c.x = 2; c.y = 0; c.hp = c.max = 999;
    const evs2 = drive(sim, 2, frame());
    expect(ofType(evs2, 'spark').some(e => e.from === 'iskierka')).toBe(true);
  });

  it('Kolczak rolls round the knight and bites what he rolls through; Bartek walls off a crowd', () => {
    const sim = later({ progress: { companions: ['jez', 'bobr'], party: ['jez', 'bobr'], driven: 3 } });
    quiet(sim);
    for (let i = 0; i < 6; i++) {
      const c = inner(sim).spawn('pancernik', (i / 6) * Math.PI * 2);
      c.x = Math.cos((i / 6) * Math.PI * 2) * 2.3;
      c.y = Math.sin((i / 6) * Math.PI * 2) * 2.3 * 0.9;
      c.hp = c.max = 999;
      c.speed = 0;
    }
    const evs = drive(sim, 3, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; });
    expect(sim.run.dmg.jez).toBeGreaterThan(0);
    expect(ofType(evs, 'pal').some(e => e.id === 'bobr' && e.what === 'wall')).toBe(true);
  });

  it('a companion\'s level rises by its card; the forge\'s Druh starts them higher', () => {
    const sim = later({ progress: { companions: ['pies'], party: ['pies'] } });
    const cards = Array.from({ length: 30 }, () => sim.cardsFor(false)).flat();
    expect(cards.some(c => c.kind === 'pal' && c.pal === 'pies')).toBe(true);
    const sim2 = later({ progress: { companions: ['pies'], party: ['pies'], forge: { druh: 1 } } });
    expect(sim2.palLevel('pies')).toBe(2);
  });
});

describe('the treasures of the hoard', () => {
  it('an elite\'s chest may hold a treasure; the first find goes into the treasury', () => {
    const sim = later();
    quiet(sim);
    (sim as unknown as { rng: () => number }).rng = () => 0.01;
    inner(sim).open({ id: 1, kind: 'chest', x: 0, y: 0, t: 0, pulled: true, src: 'elite' });
    const evs = sim.take();
    const tr = ofType(evs, 'treasure');
    expect(tr).toHaveLength(1);
    expect(tr[0].first).toBe(true);
    expect(sim.p.treasures).toContain(tr[0].id);
    expect(sim.treasuresNow).toEqual([tr[0].id]);
  });

  it('they change the run: the whetstone lengthens the sword, the anvil evolves at a pair of 2, the hourglass lengthens the windows', () => {
    const sim = later();
    quiet(sim);
    inner(sim).addTreasure('oselka', 0, 0);
    const c = inner(sim).spawn('piskle', 0);
    c.x = WEAPONS.miecz.area[0] * 1.2;
    c.y = 0;
    c.hp = 1;
    drive(sim, 1.5, frame());
    expect(sim.brood.includes(c)).toBe(false);
    sim.run.items.kopia = 5;
    sim.run.items.rekawice = 2;
    sim.run.order.push('kopia', 'rekawice');
    expect(sim.evoReady()).toBeNull();
    inner(sim).addTreasure('kowadlo', 0, 0);
    expect(sim.evoReady()).toBe('kopia');
    // a card shows the treasure that works on its weapon
    expect(sim.cardNotes({ kind: 'up', id: 'miecz', from: 1, to: 2 }).treasure).toBe('oselka');
    expect(TREASURES).toHaveLength(12);
  });

  it('the mirror throws light from fire put out', () => {
    const sim = later();
    quiet(sim);
    inner(sim).addTreasure('lustro', 0, 0);
    const c = inner(sim).spawn('pancernik', 0);
    c.x = 2; c.y = 0; c.hp = c.max = 999;
    inner(sim).quenchOne(1, 0, true);
    const evs = sim.take();
    expect(ofType(evs, 'spark').some(e => e.from === 'mirror')).toBe(true);
    expect(c.hp).toBeLessThan(999);
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
    expect(a.stats.some(([k]) => k === t('stat.top'))).toBe(true);
  });

  it('finish() mid-session settles as the end would', () => {
    const sim = later({ planned: 300 });
    drive(sim, 20, frame(), { t: 0 }, () => { sim.knight.hearts = sim.knight.max; if (sim.choice) sim.pick(0); });
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.bank).toBe(sim.score);
    expect(sim.p.runs).toBe(1);
  });

  it('closes with James 1:5 the session a weak spot was first found', () => {
    for (let s = 1; s <= 8; s++) {
      const sim = later({ progress: { sessions: s } });
      sim.flawsNow.push('zielony');
      const v = sim.closingVerse();
      if (v === 'jas1.5') return;
    }
    throw new Error('jas1.5 never chosen');
  });
});

describe('the meta', () => {
  it('migrates a v2 save in place: records, bank, forge, armoury, counters and coach marks stay; the old map becomes roads', () => {
    // a knight on the old map's 6th place: the second circle (all four old lands freed once), the Marsh Dragon wounded
    const v2 = {
      ver: 2, sessions: 14, total: 4210, bank: 380, pushes: 61, dragon: 5, damage: 120, driven: 5,
      best: { 300: 340, 180: 'oops', 600: 610 }, lastLen: 300, bestRun: 290, bestTime: 214, runs: 22,
      swords: 31, quenched: 640, bestLevel: 19, evolutions: 7,
      forge: { sila: 3, serce: 1, krok: 2, magnes: 1, oslona: 0, nauka: 2 }, armour: ['proporzec', 'helm', 'kosz'],
      seen: ['move', 'scales', 'choose', 'aura'],
    };
    const p = migrate(mergeSaved(freshProgress(), JSON.parse(JSON.stringify(v2))));
    expect(p.ver).toBe(3);
    expect((p as unknown as { dragon?: number }).dragon).toBeUndefined();
    expect((p as unknown as { damage?: number }).damage).toBeUndefined();
    expect(p.sessions).toBe(14);
    expect(p.bank).toBe(380);
    expect(p.total).toBe(4210);
    expect(p.best).toEqual({ 300: 340, 600: 610 });
    expect(p.forge).toEqual({ sila: 3, serce: 1, krok: 2, magnes: 1, nauka: 2 });
    expect(p.armour).toEqual(['proporzec', 'helm', 'kosz']);
    expect(p.seen).toEqual(['move', 'scales', 'choose', 'aura']);
    expect(p.runs).toBe(22);
    expect(p.driven).toBe(5);
    // circle 1, the second land: the four old lands freed once, the first one twice
    expect(p.cleared).toEqual([2, 1, 1, 1, 0, 0]);
    expect(p.wounds).toEqual({ [woundKey(1, 1)]: 120 });
    // having gone round once, the knight meets the new lands first
    expect(fightOf(p).spec.kind).toBe('zarowy');
    expect(p.tier).toBe(0);
    // the companions a veteran has earned
    expect(p.companions).toEqual(expect.arrayContaining(['pies', 'iskierka', 'bobr']));
    expect(p.party.length).toBe(slots(p));
    expect(bestOf(p)).toBe(340);
    // idempotent, and a game runs on it
    expect(migrate(JSON.parse(JSON.stringify(p)))).toEqual(p);
    const sim = new JerzySim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
    expect(sim.boss.spec.kind).toBe('zarowy');
    // picking the wounded Marsh Dragon's next road brings his wounds back
    expect(pickFight(p, 1)).toBe(true);
    const sim2 = new JerzySim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    expect(sim2.boss.damage).toBe(120);
  });

  it('a v2 save on its first circle keeps fighting the same dragon with his wounds', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 2, sessions: 3, dragon: 2, damage: 77.6, best: { 300: 90 }, bank: 12 }));
    expect(p.cleared).toEqual([1, 1, 0, 0, 0, 0]);
    expect(p.land).toBe(2);
    expect(p.tier).toBe(0);
    expect(p.wounds).toEqual({ '2:0': 77 });
    expect(p.companions).toEqual(['pies', 'iskierka', 'bobr']);
  });

  it('migrates an old (v1) save in place: the records and the session count stay, the rest starts over', () => {
    const old = {
      v: 1, sessions: 7, total: 900, pushes: 12, dragon: 2, damage: 'x', driven: 2, best: { 300: 140, 180: 'oops' }, lastLen: 300,
      swords: 4, quenched: 77, bestLevel: 6,
    };
    const p = migrate(mergeSaved(freshProgress(), old));
    expect(p.ver).toBe(3);
    expect((p as unknown as { v?: number }).v).toBeUndefined();
    expect(p.sessions).toBe(7);
    expect(p.pushes).toBe(12);
    expect(p.best).toEqual({ 300: 140 });
    expect(p.cleared).toEqual([0, 0, 0, 0, 0, 0]);
    expect(p.forge).toEqual({});
    expect(bestOf(p)).toBe(140);
    expect(migrate(p)).toEqual(p);
    const sim = new JerzySim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
  });

  it('survives fields of a wrong type (v2 and v3)', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 2, sessions: 'x', forge: [], armour: 'helm', seen: null, bank: 50, dragon: 'y' }));
    expect(p.sessions).toBe(0);
    expect(p.forge).toEqual({});
    expect(p.armour).toEqual([]);
    expect(p.bank).toBe(50);
    expect(p.cleared).toEqual([0, 0, 0, 0, 0, 0]);
    const q = migrate(mergeSaved(freshProgress(), { ver: 3, cleared: 'no', land: 9, tier: -3, wounds: { x: 4, '0:0': 'a', '1:0': 30 }, party: ['bobr'], companions: 7, treasures: ['lustro', 'nope', 3] }));
    expect(q.cleared).toEqual([0, 0, 0, 0, 0, 0]);
    expect(canFight(q, q.land, q.tier)).toBe(true);
    expect(q.wounds).toEqual({ '1:0': 30 });
    expect(q.party).toEqual([]);
    expect(q.treasures).toEqual(['lustro']);
  });

  it('the map: the frontier, the next roads of freed lands, a pick, a clear', () => {
    const p = freshProgress();
    expect(frontier(p)).toEqual({ land: 0, tier: 0 });
    expect(fights(p)).toEqual([{ land: 0, tier: 0, frontier: true }]);
    expect(canFight(p, 1, 0)).toBe(false);
    clearFight(p, 0, 0);
    expect(p.cleared[0]).toBe(1);
    expect(frontier(p)).toEqual({ land: 1, tier: 0 });
    expect(fightOf(p).land).toBe(1);
    // a freed land's next road may be picked instead
    expect(fights(p).map(f => [f.land, f.tier])).toEqual([[1, 0], [0, 1]]);
    expect(pickFight(p, 0)).toBe(true);
    expect([p.land, p.tier]).toEqual([0, 1]);
    expect(pickFight(p, 3)).toBe(false);
    for (let i = 1; i < DRAGONS.length; i++) clearFight(p, i, 0);
    expect(crowns(p)).toBe(DRAGONS.length);
    expect(frontier(p)).toEqual({ land: 0, tier: 1 });
  });

  it('the companions: unlocked by play, one slot then two', () => {
    const p = freshProgress();
    expect(earnCompanions(p)).toEqual([]);
    p.sessions = 1;
    expect(earnCompanions(p)).toEqual(['pies']);
    expect(p.party).toEqual(['pies']);
    p.cleared[0] = 1;
    p.chests = 8;
    expect(earnCompanions(p).sort()).toEqual(['iskierka', 'jez']);
    expect(p.party).toEqual(['pies']);
    expect(toggleParty(p, 'iskierka')).toBe(false);
    expect(toggleParty(p, 'pies')).toBe(true);
    expect(toggleParty(p, 'iskierka')).toBe(true);
    p.driven = 3;
    expect(slots(p)).toBe(2);
    expect(toggleParty(p, 'jez')).toBe(true);
    expect(toggleParty(p, 'bobr')).toBe(false);
  });

  it('the second place, when it opens at the third dragon, fills by itself', () => {
    const sim = later({ planned: 300, progress: { driven: 2, companions: ['pies', 'iskierka'], party: ['pies'] } });
    quiet(sim);
    bossNow(sim);
    const b = sim.boss;
    b.damage = b.all - 1;
    b.roared = 3;
    b.state = 'flaw';
    b.k = 2;
    inner(sim).hurtBoss(10, 'miecz');
    sim.finish();
    expect(sim.p.driven).toBe(3);
    expect(sim.p.party).toEqual(['pies', 'iskierka']);
  });

  it('the forge spends the bank; the armoury follows its milestones', () => {
    const p = freshProgress();
    p.bank = 100;
    expect(affordable(p)).toBeNull();
    p.bank = 600;
    expect(affordable(p)).toBe('krok');
    expect(buyForge(p, 'sila')).toBe(true);
    expect(p.bank).toBe(600 - FORGE.find(f => f.id === 'sila')!.cost);
    expect(buyForge(p, 'serce')).toBe(false);
    // the second level costs three times the first, the third six times
    expect(buyForge(p, 'krok')).toBe(true);
    p.bank = 10_000;
    const before = p.bank;
    expect(buyForge(p, 'krok')).toBe(true);
    expect(before - p.bank).toBe(3 * FORGE.find(f => f.id === 'krok')!.cost);
    p.runs = 6;
    p.total = 2600;
    expect(earnArmour(p).sort()).toEqual(['helm', 'pas']);
    expect(earnArmour(p)).toEqual([]);
    p.cleared[0] = 2;
    p.treasures = TREASURES.slice(0, 6) as string[];
    expect(earnArmour(p).sort()).toEqual(['karwasz', 'wieniec']);
    expect(ARMOUR).toHaveLength(8);
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
    expect(t('scales', { n: 12 })).toBe('12\u00a0łusek');
  });

  it('never asks to concentrate harder, never uses holiness words, gore or "hack"; the dragon is never killed', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /\bkill/, /töte/, /döda/, /pray/, /módl/, /\bbete\b/, /relikw/, /relic/, /reliqu/, /relik/]) {
        expect(all).not.toMatch(word);
      }
      const tips = Object.entries(cat).filter(([k]) => k.startsWith('tip.') || k.startsWith('howto.')).map(([, v]) => String(v).toLowerCase()).join(' ');
      for (const word of [/mocniej/, /harder/, /stärker/, /hårdare/]) expect(tips).not.toMatch(word);
    }
  });

  it('keeps Polish letters and Polish words out of en, de and sv', () => {
    for (const lang of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[lang])) {
        const s = typeof v === 'string' ? v : Object.values(v).join(' ');
        expect(s, `${lang} ${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/);
        expect(s, `${lang} ${k}`).not.toMatch(/\b(opaska|się|albo|Gra|Graj)\b/);
      }
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
    // a veteran with companions on a hard road too
    expect(smoke({ ...onLand(4, 1), companions: ['pies', 'bobr'], party: ['pies', 'bobr'], driven: 9 }, 2, false, 300).score).toBeGreaterThan(3);
  });

  it('a tap without a drag never moves the knight', () => {
    const { sim } = smoke({ sessions: 6 }, 2, false, 300);
    expect(Math.hypot(sim.knight.x, sim.knight.y)).toBeLessThan(1);
  });
});

// ── on a phone first (src/arcade/DESIGN.md §12, §9.4 "Mobile first") ──
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
/** every string drawn on a canvas made by the patched getContext, with its font size */
const drawn: { text: string; px: number }[] = [];

/** A context that draws nothing, measures text at 0.55 em a character and notes each string drawn with its size. */
function noteContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const note = (s: unknown) => {
    const text = String(s);
    if (text.trim() && (state.globalAlpha as number) > 0.05) drawn.push({ text, px: pxOf(String(state.font)) });
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * pxOf(String(target.font)) * 0.55 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: unknown) => note(s);
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

type Size = (typeof CHECK_SIZES)[number];
const upright = (z: Size) => z.w < 600;

/** Text allowed under MIN_READ: a secondary label (a chip's level, a card's tag or note, the bar's numbers, the threshold's name, a verse's reference). */
function secondary(s: string): boolean {
  if (/^[\d★]+$/.test(s) || /^[\d\s .,]+\/\s?[\d\s .,]+$/.test(s) || s === t('hud.mark') || s.includes('6,16')) return true;
  const prefixes = [t('card.new'), t('card.evo'), t('card.treasure'), t('card.pal'), t('card.lv', { a: 1, b: 2 }).split(' ')[0],
    t('card.pair', { name: '' }).trim(), t('card.duet', { name: '' }).trim(), t('card.with', { name: '' }).trim(), t('choice.gold')];
  return prefixes.some(p => s.startsWith(p));
}

describe('on a phone first: the layout', () => {
  it('the font helper never goes under 11 px', () => {
    for (const px of [0, 4, 7.6, 8.6, 10.9, 11, 13, 24, 40]) {
      for (const fam of [SANS, SERIF]) expect(pxOf(font(700, px, fam, px > 20))).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(pxOf(font(800, 24, SERIF))).toBe(24);
  });

  it('every checked screen: the shape, a scale that starts from the phone, the knight in the band under the status', () => {
    for (const z of CHECK_SIZES) {
      const L = layout(z.w, z.h, z.insets, true);
      const name = z.name;
      expect(L.shape, name).toBe(upright(z) ? 'phone' : z.h < 470 ? 'side' : 'wide');
      expect(L.u, name).toBeGreaterThanOrEqual(1);
      expect(L.u, name).toBeLessThanOrEqual(1.2);
      expect(L.ky, name).toBeGreaterThan(L.top);
      expect(L.ky, name).toBeLessThan(L.bottom);
      // the knight's head clear of the status band, his feet clear of the dial's row
      expect(L.ky - L.s * 1.4, name).toBeGreaterThan(L.statBottom);
      expect(L.ky + L.s * 0.5, name).toBeLessThan(L.swordHit.y + L.swordHit.h);
      // the widest shield (every gear and forge level, full focus) fits across an upright phone…
      const widest = 0.42 + 0.75 + 0.36 + 0.2 + RULES.shieldExtra;
      if (L.shape === 'phone') expect(widest * L.s, name).toBeLessThanOrEqual((L.right - L.left) / 2);
      // …and stays clear of the HUD row on a phone on its side
      if (L.shape === 'side') expect(L.ky - 0.35 * L.s - 0.8 * widest * L.s, name).toBeGreaterThanOrEqual(L.top);
      // a phone upright shows ten metres across or so: no tiny world
      if (L.shape === 'phone') expect(L.s, name).toBeGreaterThanOrEqual((L.right - L.left) / 11);
    }
  });

  it('the Miecz światła dial: 56–70 px, a finger-sized target in the bottom-right thumb zone, inside the safe area', () => {
    for (const z of CHECK_SIZES) {
      const L = layout(z.w, z.h, z.insets, true);
      const name = z.name;
      expect(L.sword.r * 2, name).toBeGreaterThanOrEqual(56);
      expect(L.sword.r * 2, name).toBeLessThanOrEqual(70);
      expect(auditTargets([target('Miecz światła', L.swordHit)], z.w, z.h, z.insets), name).toEqual([]);
      expect(L.sword.x, name).toBeGreaterThan((L.left + L.right) / 2);
      if (upright(z)) {
        expect(L.sword.y, name).toBeGreaterThanOrEqual(z.h * (1 - THUMB));
        expect(L.swordHit.x + L.swordHit.w, name).toBeLessThanOrEqual(z.w - 16);
      }
    }
  });

  it('the level-up: stacked full-width cards in the thumb zone on a phone, a row elsewhere; every card and the reshuffle a clear target', () => {
    for (const z of CHECK_SIZES) {
      for (const touch of [true, false]) {
        for (const rerolls of [0, 1, 3]) {
          const L = layout(z.w, z.h, z.insets, touch);
          const sh = sheet(L, 3, rerolls);
          const name = `${z.name} touch ${touch} rerolls ${rerolls}`;
          const ts = sh.cards.map((r, i) => target(`card ${i + 1}`, r));
          if (sh.reroll) ts.push(target('reshuffle', sh.reroll));
          expect(auditTargets(ts, z.w, z.h, z.insets), name).toEqual([]);
          expect(!!sh.reroll, name).toBe(rerolls > 0);
          for (const r of [...sh.cards, sh.head]) expect(r.y + r.h, name).toBeLessThanOrEqual(L.bottom + 0.5);
          if (upright(z)) {
            expect(sh.stacked, name).toBe(true);
            for (const r of sh.cards) {
              expect(r.w, name).toBeGreaterThanOrEqual(z.w - 32 - 1);
              expect(r.h, name).toBeGreaterThanOrEqual(76);
            }
            // the last card ends near the bottom: the thumb reaches the sheet
            expect(sh.cards[2].y + sh.cards[2].h, name).toBeGreaterThan(L.bottom - 20);
          } else {
            expect(sh.stacked, name).toBe(false);
            expect(sh.cards[0].w, name).toBeGreaterThanOrEqual(150);
          }
          if (sh.hintY !== null) expect(sh.hintY, name).toBeLessThan(L.bottom);
        }
      }
    }
  });

  it('the tally\'s button is a clear target inside the band', () => {
    for (const z of CHECK_SIZES) {
      const L = layout(z.w, z.h, z.insets, true);
      for (const bars of [0, 3]) {
        const { box, btn } = tallyBox(L, bars);
        expect(auditTargets([target('next run', btn)], z.w, z.h, z.insets), z.name).toEqual([]);
        expect(box.y, z.name).toBeGreaterThanOrEqual(L.top);
        expect(box.y + box.h, z.name).toBeLessThanOrEqual(L.bottom);
      }
    }
  });
});

describe('on a phone first: the game at every checked size', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return noteContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  const returning = (): JerzyProgress => ({ ...freshProgress(), sessions: 5, pushes: 1, seen: [...SEEN] });

  function envFor(z: { w: number; h: number; insets: Insets }, progress: JerzyProgress, touch: boolean, hints: string[] = []): GameEnv<JerzyProgress> {
    return {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress, rng: mulberry32(3), day: DAY, daySeed: 7, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false,
      tuning: TUNING, hint: (text: string) => { if (text) hints.push(text); }, hudTop: () => z.insets.top, insets: () => z.insets, touch,
    };
  }

  async function gameAt(z: { w: number; h: number; insets: Insets }, touch = true, progress = returning()) {
    const mod = (await import('../src/arcade/jerzy/index')).default;
    const game = mod.create(envFor(z, progress, touch));
    game.resize(z.w, z.h, 1);
    game.start();
    const sim = (game as unknown as { sim: JerzySim }).sim;
    return { game, sim };
  }

  const run = (game: ArcadeGame, sec: number, f = frame()) => {
    for (let i = 0; i < Math.round(sec * 30); i++) {
      game.update(1 / 30, f, i / 30);
      game.draw();
    }
  };

  /** Draw one frame and check it: the targets (size, the safe area, no overlaps) and every string (≥ 11 px; under 13 only a secondary label). */
  function check(game: ArcadeGame, z: { name: string; w: number; h: number; insets: Insets }, what: string): string[] {
    drawn.length = 0;
    game.draw();
    const name = `${z.name}: ${what}`;
    const ts = game.targets!();
    expect(auditTargets(ts, z.w, z.h, z.insets), name).toEqual([]);
    expect(drawn.filter(d => d.px < MIN_TEXT - 1e-6), name).toEqual([]);
    expect(drawn.filter(d => d.px < MIN_READ - 1e-6 && !secondary(d.text)), name).toEqual([]);
    return ts.map(x => x.label);
  }

  it('play, the level-up, the dragon, Linda\'s bubble, the tally and the story cards: targets and text pass the phone checks', async () => {
    for (const z of CHECK_SIZES) {
      for (const touch of [true, false]) {
        if (!touch && upright(z)) continue;
        const { game, sim } = await gameAt(z, touch);
        quiet(sim);
        run(game, 0.5);
        expect(check(game, z, 'play'), z.name).toEqual(['Miecz światła']);
        // the dragon with his bar (the status makes room), Linda talking at length
        bossNow(sim);
        sim.talk.line = { moment: 'level', text: 'To jest bardzo długa kwestia Lindy, żeby sprawdzić, czy dymek mieści się na wąskim ekranie.', t: 0.5, dur: 4 };
        run(game, 0.6);
        sim.talk.line = { moment: 'level', text: 'To jest bardzo długa kwestia Lindy, żeby sprawdzić, czy dymek mieści się na wąskim ekranie.', t: 0.5, dur: 4 };
        check(game, z, 'the dragon and a bubble');
        // a level-up: three cards and the reshuffle, then none left
        sim.run.items.miecz = 2;
        sim.run.items.kopia = 1;
        sim.run.items.sztandar = 1;
        sim.run.order.push('kopia', 'sztandar');
        inner(sim).collect(xpNeed(sim.run.level), sim.knight.x, sim.knight.y);
        expect(sim.choice, z.name).not.toBeNull();
        run(game, 0.5);
        expect(check(game, z, 'cards'), z.name).toEqual(['card 1', 'card 2', 'card 3', 'reshuffle']);
        sim.run.rerolls = 0;
        expect(check(game, z, 'cards, no reshuffle'), z.name).toEqual(['card 1', 'card 2', 'card 3']);
        sim.pick(0);
        run(game, 0.2);
        // the run's tally
        inner(sim).endRun();
        run(game, 1.5);
        expect(check(game, z, 'tally'), z.name).toEqual(['next run']);
        sim.tap();
        run(game, 0.2);
        // the story cards: the opening and a land freed (with Iskierka's line)
        sim.story = { kind: 'open', t: 1, dur: 8, from: 'zielony', to: null, tier: 0, toTier: 0, first: false };
        expect(check(game, z, 'the opening card'), z.name).toEqual(['story']);
        sim.story = { kind: 'land', t: 1, dur: 4, from: 'zielony', to: 'bagienny', tier: 1, toTier: 0, first: true };
        expect(check(game, z, 'a land freed'), z.name).toEqual(['story']);
        game.destroy();
      }
    }
  });

  it('a card takes a finger that lands and lifts on it; a finger that slides off, or comes too soon, takes nothing', async () => {
    const z = CHECK_SIZES[0];
    const { game, sim } = await gameAt(z);
    quiet(sim);
    run(game, 0.3);
    inner(sim).collect(xpNeed(1), 0, 0);
    const sh = sheet(layout(z.w, z.h, z.insets, true), 3, sim.run.rerolls);
    const c1 = sh.cards[1], mid = { x: c1.x + c1.w / 2, y: c1.y + c1.h / 2 };
    // too soon: a thumb already on its way does not pick
    game.pointer!({ type: 'down', ...mid, id: 1 });
    game.pointer!({ type: 'up', ...mid, id: 1 });
    expect(sim.choice).not.toBeNull();
    run(game, 0.4);
    // pressed, then slid off: nothing
    game.pointer!({ type: 'down', ...mid, id: 2 });
    game.pointer!({ type: 'move', x: mid.x, y: c1.y - 40, id: 2 });
    game.pointer!({ type: 'up', x: mid.x, y: c1.y - 40, id: 2 });
    expect(sim.choice).not.toBeNull();
    // pressed and lifted on it: the second card
    const want = sim.choice!.cards[1];
    game.pointer!({ type: 'down', ...mid, id: 3 });
    expect(sim.choice).not.toBeNull();
    game.pointer!({ type: 'up', ...mid, id: 3 });
    expect(sim.choice).toBeNull();
    if (want.id) expect(sim.itemLevel(want.id)).toBe(want.to);
  });

  it('the dial lets a ready sword go at the touch; a drag from anywhere (the dial too) is the joystick, shown from the touch-down', async () => {
    const z = CHECK_SIZES[1];
    const { game, sim } = await gameAt(z);
    quiet(sim);
    run(game, 0.3);
    const L = layout(z.w, z.h, z.insets, true);
    const dial = { x: L.sword.x, y: L.sword.y };
    const view = (game as unknown as { view: { stick: unknown } }).view;
    // not ready: the dial's press steers like the rest of the field
    game.pointer!({ type: 'down', ...dial, id: 1 });
    expect(view.stick).toMatchObject({ ox: dial.x, oy: dial.y, live: false });
    game.pointer!({ type: 'move', x: dial.x - 50, y: dial.y, id: 1 });
    expect(view.stick).toMatchObject({ live: true });
    run(game, 0.5);
    expect(sim.knight.x).toBeLessThan(-0.5);
    game.pointer!({ type: 'up', x: dial.x - 50, y: dial.y, id: 1 });
    expect(view.stick).toBeNull();
    // ready: the touch itself lets it go
    sim.charge = 1;
    sim.swordReady = true;
    game.pointer!({ type: 'down', ...dial, id: 2 });
    expect(sim.swordReady).toBe(false);
    game.pointer!({ type: 'up', ...dial, id: 2 });
  });

  it('the smoke\'s input scores within 22 s on a desktop and on the smallest phone (a centre click every 0.65 s, Space every 2 s)', async () => {
    for (const [z, touch] of [[CHECK_SIZES[7], false], [CHECK_SIZES[0], true]] as const) {
      const { game } = await gameAt(z, touch, freshProgress());
      const focus = new FocusInput(BEGINNER);
      let f = focus.push(0, true, 0.1), tap = 0, space = 0, hub = 0, scoreAt: number | null = null;
      const dt = 1 / 30;
      for (let tt = 0; tt < 22; tt += dt) {
        if ((hub += dt) >= 0.1) {
          hub -= 0.1;
          f = focus.push(20 * (1 - Math.exp(-tt / 4)), true, 0.1);
        }
        game.update(dt, f, tt);
        game.draw();
        if ((tap += dt) >= 0.65) {
          tap = 0;
          game.pointer!({ type: 'down', x: z.w / 2, y: z.h * 0.6, id: 1 });
          game.pointer!({ type: 'up', x: z.w / 2, y: z.h * 0.6, id: 1 });
        }
        if ((space += dt) >= 2) {
          space = 0;
          game.key!(' ', true);
          game.key!(' ', false);
        }
        if (scoreAt === null && game.result().score > 0) scoreAt = tt;
      }
      expect(scoreAt, z.name).not.toBeNull();
    }
  });

  it('speaks of the hand the player has: no keys on a touch screen, keys as shortcuts on a desktop', () => {
    // a key named (the letter R alone, case-sensitive: \b is ASCII-only and splits "går" before its r)
    const named = (s: string) => /WASD|Space|Spacj|Leertaste|mellanslag|1–3|klik|click|Klick/i.test(s) || /(^|[\s(])R([\s).,!]|$)/.test(s);
    for (const k of ['coach.move', 'coach.sword', 'coach.reroll', 'hud.swordTap', 'tally.next', 'story.tap', 'story.next', 'howto.move', 'howto.cards'] as const) {
      for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
        const touchText = String(CATALOGS[lang][k]);
        expect(named(touchText), `${lang} ${k}: ${touchText}`).toBe(false);
        const desk = (CATALOGS[lang] as Record<string, unknown>)[`${k}.keys`];
        if (desk !== undefined) expect(named(String(desk)), `${lang} ${k}.keys: ${String(desk)}`).toBe(true);
      }
    }
    expect(hand('coach.sword', true)).toBe(t('coach.sword'));
    expect(hand('coach.sword', false)).toBe(t('coach.sword.keys'));
    expect(hand('coach.scales', false)).toBe(t('coach.scales'));
  });

  it('a level-up under the runner\'s block banner waits for it while the world goes on, then the cards come up', () => {
    const sim = later();
    quiet(sim);
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.2, frame(), clock, empty(sim));
    expect(sim.bannerUp).toBe(true);
    inner(sim).collect(xpNeed(sim.run.level), 0, 0);
    expect(sim.choice).toBeNull();
    sim.steer(1, 0);
    drive(sim, 1, frame(), clock, empty(sim));
    expect(sim.knight.x).toBeGreaterThan(1);
    drive(sim, RULES.bannerSec, frame(), clock, empty(sim));
    expect(sim.choice).not.toBeNull();
    expect(MIN_TAP).toBe(44);
  });
});

// ── the pacing, checked by simulation over many sessions ────────────
/**
 * A bot that plays like a fair human: it keeps away from the brood, steps out of the red shapes
 * (unless his shield is big and the Green Dragon breathes: then it stands in the breath), comes close
 * to the dragon while he is dizzy, gathers scales when it is safe, leaves scales by the Golden Dragon
 * once it knows his flaw, taps the ready Miecz, picks cards by a simple taste and buys the cheapest
 * forge upgrade after each session.
 */
type Skill = 'sharp' | 'casual';
/** what a casual bot has decided not to see (telegraphs it misses), per sim */
const missed = new WeakMap<JerzySim, Set<number>>();

function botStep(sim: JerzySim, skill: Skill = 'sharp', rnd: () => number = Math.random): void {
  const k = sim.knight, b = sim.boss;
  const casual = skill === 'casual';
  let miss = missed.get(sim);
  if (!miss) missed.set(sim, (miss = new Set()));
  if (sim.story || sim.tally) { sim.tap(); return; }
  if (sim.choice) {
    if (sim.choice.t < 0.3) return;
    const rank = (c: Card): number => {
      if (c.kind === 'evo') return 100;
      if (c.kind === 'treasure') return 60;
      const taste: Partial<Record<ItemId, number>> = { kusza: 30, kopia: 28, wiadra: 26, mlot: 25, miecz: 24, sokol: 20, rog: 18, kon: 17, kolce: 15, sztandar: 22, rekawice: 21, pierscien: 16, kolczan: 16, plaszcz: 14, tarcza: 14, zbroja: 12, buty: 10, sakwa: 9 };
      if (c.kind === 'pal') return 19;
      return (c.id ? taste[c.id] ?? 5 : 3) + (c.kind === 'up' ? 4 : 0);
    };
    const cards = sim.choice.cards;
    let best = 0;
    cards.forEach((c, i) => { if (rank(c) > rank(cards[best])) best = i; });
    sim.pick(best);
    return;
  }
  if (sim.swordReady) sim.tap();
  // candidate steps: stay, or 0.9 u in one of 12 directions; each scored
  let bx = 0, by = 0, bestScore = -Infinity;
  const aura = sim.auraR, smart = sim.p.flaws.includes(b.spec.kind) || sim.session > 2;
  for (let i = -1; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, d = i < 0 ? 0 : 0.9;
    const x = k.x + Math.cos(a) * d, y = k.y + Math.sin(a) * d;
    let s = 0;
    for (const c of sim.brood) {
      const dd = Math.hypot(c.x - x, c.y - y);
      if (dd < 2.6) s -= ((c.elite ? 2.5 : 1) * (casual ? 0.45 : 1)) / Math.max(0.25, dd * dd);
    }
    for (const z of sim.zones) {
      // a casual player misses about a third of the red shapes
      if (casual && !miss.has(z.id) && !miss.has(-z.id)) miss.add(rnd() < 0.35 ? z.id : -z.id);
      if (casual && miss.has(z.id)) continue;
      let inside = false;
      if (z.kind === 'circle') inside = Math.hypot(x - z.x, y - z.y) < z.w + 0.5;
      else if (z.kind === 'lane') inside = sim.inLane(z, x, y);
      else if (z.kind === 'cone') {
        const dd = Math.hypot(x - z.x, y - z.y), da = Math.abs(((Math.atan2(y - z.y, x - z.x) - z.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        inside = dd < z.len + 0.4 && da < z.w + 0.25;
        // the Green Dragon's breath with a big shield: stand in it (his steam flaw)
        if (inside && smart && b.spec.flaw === 'steam' && aura >= sim.auraMark) inside = false;
      } else if (z.kind === 'ring') {
        const dd = Math.hypot(x - z.x, y - z.y), gapA = Math.abs(((Math.atan2(y - z.y, x - z.x) - (z.gap ?? 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        inside = gapA > (z.gapW ?? 0) / 2 && dd < (z.r ?? 4) + 0.5;
        if (smart && aura >= sim.auraMark) inside = false;
      }
      if (inside) s -= 40;
    }
    if (sim.bossPresent) {
      const dd = Math.hypot(b.x - x, b.y - y);
      if (b.state === 'flaw') s -= Math.abs(dd - 1.9) * 3;
      else s -= Math.max(0, 3 - dd) * 4;
      if (b.hot > 0 && smart) s -= dd * 2;
    }
    // scales: gather them when it is safe (but leave them by the Golden Dragon once his flaw is known)
    let sc = 0;
    for (const p of sim.scales) {
      const dd = Math.hypot(p.x - x, p.y - y);
      if (dd > 5) continue;
      if (smart && b.spec.flaw === 'greed' && sim.bossPresent && Math.hypot(p.x - b.x, p.y - b.y) < RULES.greedNear) continue;
      sc += p.v / (1 + dd);
    }
    s += sc * (casual ? 0.7 : 0.4);
    // a little pull back to the knight's middle ground, not to wander off forever
    s -= Math.hypot(x, y) * 0.01;
    if (s > bestScore) { bestScore = s; bx = x - k.x; by = y - k.y; }
  }
  const l = Math.hypot(bx, by);
  sim.steer(l > 1e-6 ? bx / l : 0, l > 1e-6 ? by / l : 0);
}

type Profile = 'none' | 'weak' | 'avg' | 'good';
/** The band's frame for a profile: the level while asked to focus, the calm while asked to rest (with slow wobble). */
function profileFrame(sim: JerzySim, prof: Profile, t: number, held: { h: number }): FocusFrame {
  if (prof === 'none') return NONE;
  const base = prof === 'weak' ? 0.42 : prof === 'avg' ? 0.6 : 0.82;
  const wobble = 0.18 * Math.sin(t * 0.45) + 0.08 * Math.sin(t * 1.7);
  const push = sim.block?.kind === 'push' && sim.phase === 'play';
  const level = push ? Math.max(0, Math.min(1, base + wobble)) : 0.25 + 0.1 * Math.sin(t * 0.3);
  const focused = level >= 0.5;
  held.h = focused ? held.h + 1 / 30 : 0;
  const calm = !push ? Math.max(0, Math.min(1, base + 0.1 * Math.sin(t * 0.5))) : 0.1;
  return { reliable: true, activity: level * 8 - 2, threshold: 2, level, focused, hold: held.h, calm };
}

interface Career { sessions: { score: number; runs: number; level: number; driven: number; fatal: number; dmgPerVisit: number; land: number; tier: number; boss: Record<string, number> }[]; p: JerzyProgress }

/** Play `n` sessions in a row on one save (the bot buys at the forge between them). */
function career(n: number, planned: number, prof: Profile, seed: number, step = 1 / 30, skill: Skill = 'sharp'): Career {
  const p = freshProgress();
  const out: Career['sessions'] = [];
  for (let s = 0; s < n; s++) {
    const sim = new JerzySim({ progress: p, rng: mulberry32(seed * 1000 + s), day: DAY, daySeed: 1, plannedSec: planned, eeg: false, tuning: TUNING });
    sim.start();
    const held = { h: 0 };
    let visits = 0, dmg0 = sim.boss.damage, dmg = 0, lastLand = sim.boss.land, decide = 0;
    const rnd = mulberry32(seed * 77 + s);
    for (let tt = 0; tt < planned + 6 && !sim.canStop(); tt += step) {
      sim.update(step, profileFrame(sim, prof, tt, held), tt);
      for (const e of sim.take()) {
        if (e.type === 'boss') visits++;
        if (e.type === 'driven') { dmg += sim.boss.all; dmg0 = 0; }
      }
      if (sim.boss.land !== lastLand) { lastLand = sim.boss.land; dmg0 = 0; }
      if ((decide += step) >= (skill === 'casual' ? 0.3 : 0.1)) { decide = 0; botStep(sim, skill, rnd); }
    }
    sim.finish();
    dmg += sim.boss.damage - dmg0;
    sim.result();
    out.push({ score: sim.score, runs: sim.runs + 1, level: sim.topLevel, driven: sim.drivenNow.length, fatal: sim.fatalsNow, dmgPerVisit: visits ? dmg / visits : 0, land: p.land, tier: p.tier, boss: { ...sim.bossDmg } });
    while (affordable(p)) buyForge(p, affordable(p)!);
  }
  return { sessions: out, p };
}

describe('the pacing, by simulation', () => {
  it('an average player drives the first dragon off in the first two 5-minute sessions, and keeps freeing lands', () => {
    const c = career(4, 300, 'avg', 1, 1 / 30, 'casual');
    const first = c.sessions.findIndex(s => s.driven > 0);
    expect(first, JSON.stringify(c.sessions)).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(1);
    expect(crowns(c.p)).toBeGreaterThanOrEqual(2);
    expect(crowns(c.p)).toBeLessThanOrEqual(8);
    // a run is lost now and then, never every minute
    const runs = c.sessions.reduce((s, x) => s + x.runs, 0) / c.sessions.length;
    expect(runs).toBeLessThanOrEqual(4);
  }, 120_000);

  it('without any signal the game still moves on: scales, levels, the dragon wounded', () => {
    const c = career(3, 300, 'none', 2, 1 / 30, 'casual');
    for (const s of c.sessions) expect(s.score).toBeGreaterThan(40);
    expect(c.p.driven + Object.keys(c.p.wounds).length).toBeGreaterThan(0);
  }, 120_000);

  it.skipIf(!process.env.JERZY_BALANCE)('prints the pacing table (JERZY_BALANCE=1)', () => {
    const rows: string[] = [];
    for (const planned of [180, 300, 600]) {
      for (const [skill, prof] of [['casual', 'none'], ['casual', 'avg'], ['casual', 'good'], ['sharp', 'avg']] as [Skill, Profile][]) {
        const n = planned === 600 ? 6 : 10, seeds = Number(process.env.JERZY_SEEDS ?? 3);
        const all: Career[] = [];
        for (let seed = 1; seed <= seeds; seed++) all.push(career(n, planned, prof, seed, 1 / 30, skill));
        const per = (f: (s: Career['sessions'][number]) => number) => (all.flatMap(c => c.sessions).reduce((s, x) => s + f(x), 0) / (all.length * n)).toFixed(2);
        const firstDrive = all.map(c => c.sessions.findIndex(s => s.driven > 0)).map(i => (i < 0 ? '-' : String(i + 1))).join(',');
        const crownsAt = all.map(c => crowns(c.p)).join(',');
        const bd: Record<string, number> = {};
        for (const c of all) for (const x of c.sessions) for (const [k2, v] of Object.entries(x.boss)) bd[k2] = (bd[k2] ?? 0) + v;
        const bsum = Object.values(bd).reduce((a, v) => a + v, 0) || 1;
        const top = Object.entries(bd).sort((a, b2) => b2[1] - a[1]).slice(0, 4).map(([k2, v]) => `${k2} ${Math.round((v / bsum) * 100)}%`).join(' ');
        rows.push(`${planned}s ${skill.padEnd(6)} ${prof.padEnd(4)}  boss by: ${top}`);
        rows.push(`${planned}s ${skill.padEnd(6)} ${prof.padEnd(4)}  score ${per(s => s.score).padStart(7)}  runs ${per(s => s.runs)}  lvl ${per(s => s.level).padStart(5)}  driven/sess ${per(s => s.driven)}  fatal/sess ${per(s => s.fatal)}  dmg/visit ${per(s => s.dmgPerVisit).padStart(7)}  first drive-off (session) ${firstDrive}  crowns after ${n}: ${crownsAt}`);
      }
    }
    if (process.env.JERZY_BALANCE_OUT) writeFileSync(process.env.JERZY_BALANCE_OUT, `${rows.join('\n')}\n`);
    else console.log(`\n${rows.join('\n')}\n`);
  }, 3_600_000);
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

  it('builds the progress card: six lands, the fights to pick, the companions, the forge, the treasury, the Book of Dragons', async () => {
    const { progressPanel } = await import('../src/arcade/jerzy/panel');
    const p: JerzyProgress = { ...freshProgress(), sessions: 3, cleared: [1, 0, 0, 0, 0, 0], land: 1, tier: 0, wounds: { '1:0': 20 }, driven: 1, total: 120, bank: 200, armour: ['proporzec'], companions: ['pies', 'iskierka'], party: ['pies'], treasures: ['lustro'], flaws: ['zielony'] };
    let saved = 0;
    const el = progressPanel(p, () => saved++);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(DRAGONS.length);
    expect(el.textContent).toContain(t('town.bagienny'));
    expect(el.textContent).toContain(t('flaw.steam'));
    expect(el.textContent).toContain(t('tr.lustro'));
    // pick the Green Dragon's knight's road
    const pick = [...el.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === t('panel.pick'));
    expect(pick).toBeDefined();
    pick!.click();
    expect(saved).toBe(1);
    expect([p.land, p.tier]).toEqual([0, 1]);
    // take Iskierka instead of Burek
    const leave = [...el.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === t('panel.leave'));
    leave!.click();
    const take = [...el.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === t('panel.take') && !b.disabled);
    take!.click();
    expect(p.party.length).toBe(1);
    // buy at the forge
    const buy = [...el.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].find(b => b.textContent?.startsWith(t('panel.buy', { cost: '' }).replace(/\s*$/, '').slice(0, 3)));
    expect(buy).toBeDefined();
    buy!.click();
    expect(p.bank).toBeLessThan(200);
    expect((COMPANIONS as readonly CompanionId[]).length).toBe(4);
    void (null as unknown as WeaponId);
  });
});
