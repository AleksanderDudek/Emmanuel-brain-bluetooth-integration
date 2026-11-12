import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BEASTS, COMPANIONS, GUARDS, LANDS, LINES, LINE_COUNT, MOMENTS, QUESTS, TAUNTS } from '../src/arcade/dawid/content';
import { Hud } from '../src/arcade/dawid/hud';
import { CATALOGS, t, unit } from '../src/arcade/dawid/i18n';
import dawid from '../src/arcade/dawid/index';
import { EDGE, layout } from '../src/arcade/dawid/layout';
import { SANS, SERIF, font } from '../src/arcade/dawid/paint';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import {
  abilityCost, abilityWhy, bagCap, bestOf, build, buyAbility, forge, freshProgress, guardHp, join, landAt, landK, migrate, partyNow, partySlots,
  stars, toggleParty, weaponCost, weaponLevel, xpNeed, type DawidProgress,
} from '../src/arcade/dawid/meta';
import { RULES } from '../src/arcade/dawid/rules';
import { DawidSim, finaleFor, multFor, planBlocks, questsOf, type SimEvent } from '../src/arcade/dawid/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-11';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<DawidProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): DawidSim {
  const sim = new DawidSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

const SEEN = ['move', 'hunt', 'coins', 'bag', 'camp', 'quest', 'sling', 'stone', 'harp', 'guard', 'bearer', 'thief', 'level', 'gate', 'cave', 'moved', 'hunted'];
/** A returning player (no warm-up, no opening card). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: SEEN, ...o.progress } });

function drive(sim: DawidSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Nothing on the field: no beasts, no dens refilling, no surprises. */
function quiet(sim: DawidSim): void {
  sim.beasts.length = 0;
  sim.dens = [];
  (sim as unknown as { surprises: () => void }).surprises = () => {};
}

/** A beast of a kind placed at (x, y) relative to David. */
function place(sim: DawidSim, kind: keyof typeof BEASTS, dx: number, dy: number) {
  const b = (sim as unknown as { spawnBeast: (den: number, fresh: boolean, cave: { kind: string; x: number; y: number; k: number }) => DawidSim['beasts'][number] })
    .spawnBeast(0, false, { kind, x: sim.david.x + dx, y: sim.david.y + dy, k: 1 });
  b.den = -1;
  return b;
}

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates Proca and Harfa, ending on a Harfa', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
  });

  it('fits a 40 s test session and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the dock the block, its seconds left and the next one during the telegraph', () => {
    const sim = later();
    expect(sim.block.kind).toBe('push');
    drive(sim, sim.block.dur - 2, frame());
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('rest');
  });

  it('makes every 4th push blind from the 3rd session (a moonless night), never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock, () => { sim.david.hp = sim.david.max; });
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
  });

  it('judges each block once at its end and pays a passed rest with the fire’s gift', () => {
    const sim = later();
    quiet(sim);
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.1, HIGH, clock);
    const rested0 = sim.p.rested;
    const evs = drive(sim, sim.block.dur + 0.1, CALM, clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].block.kind).toBe('rest');
    expect(ends[0].verdict).toBe(true);
    expect(ofType(evs, 'restGift')).toHaveLength(1);
    expect(sim.p.rested).toBeGreaterThan(rested0);
  });
});

describe('the sling’s whirl (the band)', () => {
  it('multiplies ×1 below the threshold, ×2 at it, ×4 high above, in halves', () => {
    expect(multFor(0)).toBe(1);
    expect(multFor(0.49)).toBe(1);
    expect(multFor(0.5)).toBe(2);
    expect(multFor(0.75)).toBe(3);
    expect(multFor(1)).toBe(4);
    for (let l = 0; l <= 1; l += 0.01) expect(multFor(l) * 2).toBe(Math.round(multFor(l) * 2));
  });

  it('whirls with the level in a sighted push past its lead-in; the panel’s gauge is the whirl', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 2, HIGH);
    expect(sim.meter()).toBeNull();          // the lead-in
    expect(sim.mult).toBe(1);
    drive(sim, 6, HIGH);
    expect(sim.ringLook).toBe('live');
    expect(sim.mult).toBe(4);
    expect(sim.meter()!).toBeGreaterThan(0.8);
  });

  it('stays at its base without signal (never a penalty, the gauge hidden) and in a moonless night', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 10, NONE);
    expect(sim.mult).toBe(1);
    expect(sim.meter()).toBeNull();
    expect(sim.ringLook).toBe('grey');
  });

  it('golden stones multiply the damage and the XP of a beast driven off', () => {
    const run = (f: FocusFrame) => {
      const sim = later();
      quiet(sim);
      drive(sim, 7, f);
      const b = place(sim, 'szakal', 2, 0);
      b.state = 'chase';
      const evs = drive(sim, 4, f, { t: 7 }, () => { sim.david.hp = sim.david.max; });
      return ofType(evs, 'driven')[0];
    };
    const plain = run(frame({ level: 0.3 })), gold = run(HIGH);
    expect(plain.mult).toBe(1);
    expect(gold.mult).toBe(4);
    expect(gold.xp).toBeGreaterThan(plain.xp * 3);
  });

  it('a held focus polishes the great stone; a tap throws it at the strongest target and scatters a pack', () => {
    const sim = later();
    quiet(sim);
    const evs = drive(sim, 18, HIGH);
    expect(ofType(evs, 'stoneReady').length).toBeGreaterThanOrEqual(1);
    expect(sim.stoneReady).toBe(true);
    for (let i = 0; i < 4; i++) place(sim, 'wilk', 5 + (i % 2) * 0.6, i * 0.4).state = 'idle';
    expect(sim.tap()).toBe(true);
    const evs2 = drive(sim, 1.5, HIGH, { t: 18 });
    const hit = ofType(evs2, 'stoneHit');
    expect(hit).toHaveLength(1);
    expect(hit[0].n).toBeGreaterThanOrEqual(3);
    expect(sim.stones).toBe(1);
  });

  it('throws the great stone by itself after a while, at most twice a block', () => {
    const sim = later();
    quiet(sim);
    const each = () => { if (!sim.beasts.some(b => b.state !== 'flee')) place(sim, 'szakal', 4, 0); sim.david.hp = sim.david.max; };
    const evs = drive(sim, sim.block.dur - 1, HIGH, { t: 0 }, each);
    const thrown = ofType(evs, 'throw').filter(e => e.kind === 'great');
    expect(thrown.length).toBeGreaterThanOrEqual(1);
    expect(thrown.length).toBeLessThanOrEqual(RULES.stonesPerBlock);
  });
});

describe('the harp by the fire (rest)', () => {
  it('David sits and plays, every beast dozes, calm heals and fills rested XP', () => {
    const sim = later();
    quiet(sim);
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.1, frame(), clock);
    expect(sim.block.kind).toBe('rest');
    const b = place(sim, 'wilk', 2, 0);
    b.state = 'chase';
    (sim as unknown as { dozeAll: () => void }).dozeAll();
    sim.david.hp = sim.david.max * 0.3;
    drive(sim, 1, CALM, clock);
    const x = sim.david.x;
    sim.steer(1, 0);
    drive(sim, 9, CALM, clock);
    expect(sim.sitting).toBe(true);
    expect(sim.david.x).toBeCloseTo(x, 5);       // the hands rest too
    expect(b.state).toBe('doze');
    expect(sim.david.hp).toBeGreaterThan(sim.david.max * 0.5);
    expect(sim.p.rested).toBeGreaterThan(0);
    expect(sim.meter()!).toBeGreaterThan(0.7);
    expect(sim.notes.length).toBeGreaterThan(0);
  });

  it('rested XP doubles the next XP until it is used up', () => {
    const sim = later();
    quiet(sim);
    sim.p.rested = 1000;
    const gain = (sim as unknown as { gainXp: (v: number, x: number, y: number) => number }).gainXp.bind(sim);
    expect(gain(50, 0, 0)).toBe(100);
    expect(sim.p.rested).toBe(950);
    sim.p.rested = 0;
    expect(gain(50, 0, 0)).toBe(50);
  });

  it('a moonless night reveals its share at dawn as XP and a charge of the great stone', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    quiet(sim);
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, frame(), clock);
    drive(sim, sim.block.dur + 0.05, CALM, clock);
    expect(sim.block.blind).toBe(true);
    expect(sim.ringLook).toBe('night');
    const each = () => { if (!sim.beasts.some(b => b.state !== 'flee')) place(sim, 'szakal', 3, 0); sim.david.hp = sim.david.max; };
    const evs = drive(sim, sim.block.dur + 0.05, HIGH, clock, each);
    const dawn = ofType(evs, 'dawn');
    expect(dawn).toHaveLength(1);
    expect(dawn[0].share).toBeGreaterThan(0.9);
    expect(dawn[0].xp).toBeGreaterThan(0);
  });
});

describe('beasts, the bag and the camp', () => {
  it('the sling throws by itself; a beast loses heart and runs off, leaving XP, silver and a tally', () => {
    const sim = later();
    quiet(sim);
    const b = place(sim, 'szakal', 2.5, 0);
    const evs = drive(sim, 4, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    expect(ofType(evs, 'throw').length).toBeGreaterThan(0);
    expect(ofType(evs, 'driven')).toHaveLength(1);
    expect(sim.beasts.includes(b)).toBe(false);
    expect(sim.score).toBeGreaterThan(0);
    expect(sim.p.tally.szakal).toBe(1);
    expect(sim.bag.silver + sim.coins.reduce((s, c) => s + c.v, 0)).toBeGreaterThan(0);
  });

  it('dens refill out of David’s way; the camp is safe ground', () => {
    const sim = later();
    const den = sim.dens[0];
    const before = sim.beasts.filter(b => b.den === 0).length;
    sim.beasts.splice(0, sim.beasts.length, ...sim.beasts.filter(b => b.den !== 0));
    drive(sim, BEASTS[den.kind].respawn + 1, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    expect(sim.beasts.filter(b => b.den === 0).length).toBe(before);
  });

  it('the bag fills and then holds no more; the camp empties it into the treasury', () => {
    const sim = later();
    quiet(sim);
    sim.bag.silver = sim.bagCap;
    const evs = drive(sim, 0.5, frame());
    expect(ofType(evs, 'bagFull')).toHaveLength(1);
    (sim as unknown as { dropCoins: (x: number, y: number, k: string, v: number) => void }).dropCoins(sim.david.x + 0.5, sim.david.y, 'silver', 9);
    drive(sim, 1.5, frame(), { t: 0.5 });
    expect(sim.coins.length).toBeGreaterThan(0);   // they wait on the grass
    const silver = sim.p.silver;
    sim.david.x = sim.land.camp[0];
    sim.david.y = sim.land.camp[1];
    const evs2 = drive(sim, 0.3, frame(), { t: 2 });
    expect(ofType(evs2, 'deliver')).toHaveLength(1);
    expect(sim.p.silver).toBeGreaterThanOrEqual(silver + sim.bagCap - 1);
    expect(sim.bagLoad).toBe(0);
    expect(sim.inCamp).toBe(true);
  });

  it('a tap near David sends him hunting; far away, he walks there; dragging steers', () => {
    const sim = later();
    const x0 = sim.david.x;
    expect(sim.tap(sim.david.x, sim.david.y)).toBe(true);
    expect(sim.mode).toBe('hunt');
    drive(sim, 3, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    expect(Math.abs(sim.david.x - x0) + Math.abs(sim.david.y - sim.land.camp[1])).toBeGreaterThan(1);
    sim.tap(sim.david.x - 6, sim.david.y);
    expect(sim.mode).toBe('go');
    sim.steer(1, 0);
    expect(sim.mode).toBe('none');
  });

  it('a stumble wakes David at the camp’s fire, the bag whole', () => {
    const sim = later();
    quiet(sim);
    sim.bag.silver = 20;
    sim.david.x += 10;
    sim.david.safe = 0;
    (sim as unknown as { hurtDavid: (v: number, x: number, y: number) => void }).hurtDavid(1e6, 0, 0);
    expect(sim.david.down).toBeGreaterThan(0);
    const evs = drive(sim, RULES.downSec + 0.2, frame());
    expect(ofType(evs, 'wake')).toHaveLength(1);
    expect(sim.david.hp).toBe(sim.david.max);
    expect(Math.hypot(sim.david.x - sim.land.camp[0], sim.david.y - sim.land.camp[1])).toBeLessThan(RULES.campR);
  });
});

describe('quests, the camp card and the meta', () => {
  it('the first land’s chain: four jackals, then the bonfire; rewards reach the treasury', () => {
    const sim = later({ progress: { quest: 0 } });
    expect(sim.quest!.kind).toBe('hunt');
    quiet(sim);
    const evs: SimEvent[] = [];
    for (let i = 0; i < 4; i++) {
      place(sim, 'szakal', 2, 0);
      evs.push(...drive(sim, 4, frame(), { t: i * 4 }, () => { sim.david.hp = sim.david.max; }));
    }
    expect(ofType(evs, 'questDone')).toHaveLength(1);
    expect(sim.quest!.kind).toBe('build');
    expect(sim.p.silver).toBeGreaterThanOrEqual(10);
    sim.david.x = sim.land.camp[0];
    sim.david.y = sim.land.camp[1];
    drive(sim, 0.2, frame(), { t: 20 });
    expect(sim.inCamp).toBe(true);
    expect(sim.campTab).toBe('bd');
    const i = sim.tiles().findIndex(x => x.id === 'ognisko');
    expect(sim.campTap(i)).toBe(true);
    expect(sim.p.bd.ognisko).toBe(1);
    expect(sim.quest!.kind).toBe('buy');
  });

  it('the ladders are steep and capped by the bonfire and the forge', () => {
    const p = freshProgress();
    expect(abilityWhy(p, 'sila')).toBe('need');
    p.bd.ognisko = 1;
    p.silver = 10_000;
    expect(abilityCost('sila', 10)).toBeGreaterThan(abilityCost('sila', 1) * 3);
    for (let i = 0; i < 30; i++) buyAbility(p, 'sila');
    expect(p.ab.sila).toBe(25);
    expect(abilityWhy(p, 'sila')).toBe('cap');
    expect(abilityWhy(p, 'potrojny')).toBe('need');
    expect(weaponLevel(p, 'kij')).toBe(0);
    p.wood = 50;
    p.stone = 50;
    expect(build(p, 'kuznia')).toBe(true);
    expect(forge(p, 'kij')).toBe(true);
    for (let i = 0; i < 20; i++) forge(p, 'proca');
    expect(weaponLevel(p, 'proca')).toBe(10);
    expect(weaponCost('proca', 5)![1]).toBeGreaterThan(0);   // an evolution asks for wood and stone
    expect(forge(p, 'luk')).toBe(false);                        // Jonathan's gift, never forged
  });

  it('the bag grows with Torba and the storehouse', () => {
    const p = freshProgress();
    const base = bagCap(p);
    p.ab.torba = 5;
    expect(bagCap(p)).toBeGreaterThan(base * 2);
    p.bd.spichlerz = 2;
    expect(bagCap(p)).toBeGreaterThan(base * 3);
  });

  it('companions join through the story; slots grow with the road; stars come with friendship', () => {
    const p = freshProgress();
    expect(partySlots(p)).toBe(1);
    join(p, 'asahel');
    join(p, 'abiszaj');
    expect(partyNow(p)).toEqual(['asahel']);
    toggleParty(p, 'abiszaj');
    expect(partyNow(p)).toEqual(['abiszaj']);
    p.land = 2;
    expect(partySlots(p)).toBe(2);
    expect(stars(p, 'asahel')).toBe(1);
    p.friend.asahel = 3200;
    expect(stars(p, 'asahel')).toBe(3);
    expect(COMPANIONS).toHaveLength(6);
  });

  it('the road goes round six lands, each guardian stronger, then a stronger circle', () => {
    expect(landAt(0).spec.id).toBe('pastwiska');
    expect(landAt(2).spec.guard).toBe('goliat');
    expect(landAt(7)).toMatchObject({ idx: 1, circle: 1 });
    expect(landK(6)).toBeGreaterThan(landK(5));
    expect(guardHp(1)).toBeGreaterThan(guardHp(0));
    for (const l of LANDS) expect(QUESTS[l.id].at(-1)!.kind).toBe('gate');
    expect(questsOf(6).some(q => q.kind === 'visit')).toBe(false);
  });
});

describe('the guardians', () => {
  /** A returning player at a land's guard quest, the beasts away. */
  function atGuard(land: number) {
    const qi = questsOf(land).findIndex(q => q.kind === 'guard');
    const sim = later({ progress: { land, quest: qi, level: 30 } });
    quiet(sim);
    return sim;
  }

  it('sleeps until its quest comes, then wakes, telegraphs, strikes and reels', () => {
    const early = later({ progress: { quest: 0 } });
    quiet(early);
    early.david.x = early.guard.hx - 3;
    early.david.y = early.guard.hy;
    drive(early, 2, frame());
    expect(early.guard.state).toBe('sleep');
    const sim = atGuard(0);
    sim.david.x = sim.guard.hx - 4;
    sim.david.y = sim.guard.hy;
    sim.david.safe = 99;
    const evs = drive(sim, 8, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    expect(ofType(evs, 'guardWake')).toHaveLength(1);
    expect(ofType(evs, 'guardTele').length).toBeGreaterThan(0);
    expect(ofType(evs, 'daze').length).toBeGreaterThan(0);
  });

  it('keeps its wounds when David leaves; driven off, it opens the gate to the next land', () => {
    const sim = atGuard(0);
    sim.david.x = sim.guard.hx - 4;
    sim.david.y = sim.guard.hy;
    sim.david.safe = 99;
    drive(sim, 2, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    sim.guard.hp = sim.guard.max * 0.6;
    (sim as unknown as { strikeGuard: (d: number, m: number, c: boolean) => void }).strikeGuard(1, 1, false);
    expect(sim.p.wounds).toBeGreaterThan(sim.guard.max * 0.3);
    (sim as unknown as { strikeGuard: (d: number, m: number, c: boolean) => void }).strikeGuard(1e9, 1, false);
    expect(sim.guard.state).toBe('driven');
    expect(sim.quest!.kind).toBe('gate');
    expect(sim.gateOpen).toBe(true);
    expect(sim.guardsNow).toEqual(['lew']);
    sim.story = null;
    sim.david.x = sim.land.gate[0];
    sim.david.y = sim.land.gate[1];
    const evs = drive(sim, 0.5, frame(), { t: 3 });
    expect(ofType(evs, 'land')).toHaveLength(1);
    expect(sim.p.land).toBe(1);
    expect(sim.land.id).toBe('wzgorza');
    expect(sim.p.quest).toBe(0);
  });

  it('Goliath’s shield-bearer stops stones from the front; the great stone flies over it', () => {
    const sim = atGuard(2);
    const g = sim.guard;
    expect(g.kind).toBe('goliat');
    sim.david.x = g.hx - 4;
    sim.david.y = g.hy;
    sim.david.safe = 99;
    drive(sim, 1.5, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    expect(sim.blockedFrom(sim.david.x, sim.david.y)).toBe(true);
    expect(sim.blockedFrom(g.x, g.y + 4)).toBe(false);
    const evs = drive(sim, 3, frame(), { t: 1.5 }, () => { sim.david.hp = sim.david.max; if (g.state === 'daze') g.state = 'move'; });
    expect(ofType(evs, 'blocked').length).toBeGreaterThan(0);
    sim.stoneReady = true;
    sim.throwGreat();
    const hp = g.hp;
    drive(sim, 1, frame(), { t: 4.5 }, () => { sim.david.hp = sim.david.max; });
    expect(g.hp).toBeLessThan(hp);
  });

  it('the guardians and the six lands are all there', () => {
    expect(Object.keys(GUARDS)).toHaveLength(6);
    expect(LANDS.map(l => l.guard)).toEqual(['lew', 'niedzwiedzica', 'goliat', 'tur', 'lampart', 'olbrzym']);
    for (const l of LANDS) for (const [kind, x, y] of l.camps) {
      expect(BEASTS[kind]).toBeTruthy();
      expect(x).toBeGreaterThan(0);
      expect(y).toBeLessThan(l.h);
    }
  });
});

describe('levels, the cave, the end and the result', () => {
  it('levels come with a full heal and a chest every fifth level', () => {
    const sim = later({ progress: { level: 4, xp: 0 } });
    quiet(sim);
    sim.david.hp = 10;
    const gain = (sim as unknown as { gainXp: (v: number, x: number, y: number) => number }).gainXp.bind(sim);
    gain(xpNeed(4) + 1, 0, 0);
    expect(sim.p.level).toBe(5);
    expect(sim.david.hp).toBe(sim.david.max);
    expect(sim.chests.some(c => c.kind === 'reward')).toBe(true);
  });

  it('the cave of Adullam: floors of 30 s; a cleared floor goes deeper; time out comes home', () => {
    const sim = later({ progress: { land: 2, bd: { ognisko: 1, jaskinia: 1 } } });
    sim.david.x = sim.land.camp[0];
    sim.david.y = sim.land.camp[1];
    drive(sim, 0.2, frame());
    sim.setTab('bd');
    const i = sim.tiles().findIndex(x => x.kind === 'cave');
    expect(i).toBeGreaterThanOrEqual(0);
    sim.campTap(i);
    expect(sim.inCave).toBe(true);
    for (const b of sim.beasts) b.hp = 0.1;
    const evs = drive(sim, 6, frame({ level: 0.3 }), { t: 1 }, () => { sim.david.hp = sim.david.max; });
    expect(ofType(evs, 'floor').length).toBeGreaterThanOrEqual(1);
    expect(sim.p.floor).toBeGreaterThanOrEqual(1);
    sim.cave!.t = RULES.floorSec;
    const evs2 = drive(sim, 0.2, frame(), { t: 8 });
    expect(ofType(evs2, 'caveOut')).toHaveLength(1);
    expect(sim.inCave).toBe(false);
  });

  it('settles once; result() is idempotent and keeps records with max; the bag comes home', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, frame({ level: 0.6 }), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    expect(sim.bagLoad).toBe(0);
    const silver = sim.p.silver;
    sim.finish();
    sim.result();
    expect(sim.p.silver).toBe(silver);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.best['40']).toBe(sim.score);
    expect(passage(a.verse!).text.length).toBeGreaterThan(10);
  });

  it('finish() mid-session settles as the end would, the bag delivered', () => {
    const sim = later({ planned: 300 });
    drive(sim, 20, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; });
    sim.bag.silver += 7;
    const before = sim.p.silver;
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.silver).toBeGreaterThanOrEqual(before + 7);
    expect(sim.phase).toBe('done');
  });
});

describe('old saves', () => {
  it('reads the round-5 placeholder ({ sessions }) as a fresh save keeping its count', () => {
    const p = migrate(mergeSaved(freshProgress(), { sessions: 4 }));
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.level).toBe(1);
    expect(p.wp.proca).toBe(1);
    expect(migrate(p)).toEqual(p);
    const sim = new DawidSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
    expect(sim.session).toBe(5);
  });

  it('repairs a v1 save with wrong types and unknown names', () => {
    const p = migrate(mergeSaved(freshProgress(), {
      ver: 1, sessions: 'x', level: -3, xp: 'lots', silver: 50, ab: [], bd: { ognisko: 'yes', kuznia: 2 }, wp: null,
      joined: ['asahel', 'goliat', 7], party: ['goliat', 'asahel'], seen: null, best: { 300: 900, 180: 'oops' }, land: 2.7, friend: 'x',
    }));
    expect(p.sessions).toBe(0);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.silver).toBe(50);
    expect(p.ab).toEqual({});
    expect(p.bd).toEqual({ kuznia: 2 });
    expect(p.wp).toEqual({ proca: 1 });
    expect(p.joined).toEqual(['asahel']);
    expect(p.party).toEqual(['asahel']);
    expect(p.best).toEqual({ 300: 900 });
    expect(p.land).toBe(2);
    expect(bestOf(p)).toBe(900);
    const sim = new DawidSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 300, eeg: true, tuning: TUNING });
    sim.start();
    drive(sim, 5, frame());
    expect(sim.land.id).toBe('ela');
  });
});

describe('the lamb talks, and the texts in four languages', () => {
  it('has at least 3 variants per moment, each fits a bubble (90 characters)', () => {
    for (const m of MOMENTS) {
      expect(LINE_COUNT[m]).toBeGreaterThanOrEqual(3);
      for (const l of LINES[m]) expect(l.length, l).toBeLessThanOrEqual(90);
    }
    for (const cat of Object.values(CATALOGS)) {
      for (const [k, v] of Object.entries(cat)) if (k.startsWith('say.') || k.startsWith('taunt.')) expect((v as string).length, `${k}: ${v}`).toBeLessThanOrEqual(90);
    }
    expect(TAUNTS).toHaveLength(4);
  });

  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('keeps the unit XP (EP in German) and quotes in each language’s own marks', () => {
    expect(unit(5)).toBe('XP');
    expect(CATALOGS.de.unit).toBe('EP');
    const quoted = (l: keyof typeof CATALOGS) => Object.values(CATALOGS[l]).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).filter(s => /[„“”"]/.test(s));
    for (const s of quoted('pl')) expect(s).toMatch(/„[^„”"“]+”/);
    for (const s of quoted('de')) expect(s).toMatch(/„[^„”"“]+“/);
    for (const s of quoted('sv')) expect(s).toMatch(/”[^„”"“]+”/);
    for (const s of quoted('en')) expect(s).toMatch(/“[^„”"“]+”/);
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
      }
    }
  });

  it('never asks to concentrate harder; no holiness words, no killing, no blood, no prayer to David', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /zabił/, /\bkill/, /töte/, /getötet/, /döda/, /dödar/, /pray/, /módl/, /\bbete\b/, /\bdead\b/, /\bdies\b/, /martw/, /umar/]) {
        expect(all, String(word)).not.toMatch(word);
      }
      const tips = Object.entries(cat).filter(([k]) => k.startsWith('tip.') || k.startsWith('howto.')).map(([, v]) => String(v).toLowerCase()).join(' ');
      for (const word of [/mocniej/, /harder/, /stärker/, /hårdare/]) expect(tips).not.toMatch(word);
    }
  });

  it('bends the counted words (4 szakale, 5 szakali) and formats big numbers', () => {
    expect(t('beasts.szakal', { n: 4 })).toBe('4 szakale');
    expect(t('beasts.szakal', { n: 5 })).toBe('5 szakali');
    expect(t('beasts.zmija', { n: 1 })).toBe('1 żmiję');
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the centre every 0.65 s (a tap: no drag), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<DawidProgress>, seed: number, eeg: boolean, planned = 40) {
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
        // the centre of the canvas sits about a metre below David on screen
        sim.tap(sim.david.x, sim.david.y + 1);
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

  it('earns XP by 22 s on either band, first session or later, and the headline climbs live', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 5; seed++) {
        const { score, seen } = smoke({}, seed, eeg);
        expect(score, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        expect(seen.at(-1)!).toBeGreaterThan(seen[1] ?? 0);
      }
    }
    expect(smoke({ sessions: 6, seen: SEEN }, 3, false, 300).score).toBeGreaterThan(0);
    expect(smoke({ sessions: 6, seen: SEEN, land: 3, level: 30 }, 4, false, 300).score).toBeGreaterThan(0);
  });
});

/** A typical player over many sessions (DAWID_PACING=12 DAWID_OUT=/tmp/pace.txt npx vitest run test/arcade-dawid.test.ts -t pacing). */
describe.runIf(process.env.DAWID_PACING)('pacing (manual)', () => {
  it('plays sessions like a typical player and prints the road', () => {
    const p = freshProgress();
    for (let s = 0; s < Number(process.env.DAWID_PACING); s++) {
      const sim = new DawidSim({ progress: p, rng: mulberry32(10 + s), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
      sim.start();
      const clock = { t: 0 };
      let tap = 0;
      const each = () => {
        if (sim.story && sim.story.t > 1) sim.tap();
        if ((tap += STEP) >= 1) {
          tap = 0;
          if (sim.inCamp) {
            for (const tab of ['bd', 'wp', 'ab'] as const) {
              sim.setTab(tab);
              for (let k = 0; k < 6; k++) { const i = sim.tiles().findIndex(x => x.why === 'ok' && x.kind !== 'cave'); if (i < 0) break; sim.campTap(i); }
            }
          }
          const q = sim.questTarget();
          const atCamp = q && Math.hypot(q.x - sim.land.camp[0], q.y - sim.land.camp[1]) < 1;
          if (sim.bagFull || atCamp) { if (!sim.inCamp) sim.goHome(); }
          else if (q && sim.quest?.kind !== 'hunt' && sim.quest?.kind !== 'level' && Math.hypot(q.x - sim.david.x, q.y - sim.david.y) > 3) sim.tap(q.x, q.y);
          else if (sim.mode === 'none' || sim.mode === 'go') sim.tap();
        }
      };
      const f = (t: number) => {
        const b = sim.block;
        if (sim.phase !== 'play' || !b) return frame({ level: 0.4 });
        if (b.kind === 'push') return frame({ level: 0.68, focused: true, hold: sim.blockT > 8 ? sim.blockT - 8 : 0, activity: 3 });
        if (b.kind === 'rest') return frame({ level: 0.2, calm: 0.75, activity: -1 });
        return frame({ level: 0.4 + 0 * t });
      };
      drive(sim, 304, f, clock, each);
      sim.finish();
      const r = sim.result();
      (globalThis as { __pace?: string[] }).__pace = [...((globalThis as { __pace?: string[] }).__pace ?? []), `session ${s + 1}: XP ${r.score} · level ${p.level} · land ${p.land} q${p.quest} · silver ${p.silver} wood ${p.wood} stone ${p.stone} · guards ${p.guards} · driven ${sim.driven} · hp ${Math.round(sim.david.max)} dmg ${Math.round(sim.stats.dmg)} · ab ${JSON.stringify(p.ab)} bd ${JSON.stringify(p.bd)} wp ${JSON.stringify(p.wp)} · party ${p.party.join(',')} · wounds ${p.wounds}/${Math.round(sim.guard.max)} · floor ${p.floor}`];
    }
    if (process.env.DAWID_OUT) writeFileSync(process.env.DAWID_OUT, ((globalThis as { __pace?: string[] }).__pace ?? []).join('\n'));
  });
});

// ── phone first (src/arcade/DESIGN.md §12) ──────────────────────────

const PX = /(\d+(?:\.\d+)?)px/;

/** A canvas context that draws nothing, keeps what is set and measures text at 0.56 em a character. */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * Number(String(target.font).match(PX)?.[1] ?? 10) * 0.56 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0 });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

interface Played { game: ArcadeGame; sim: DawidSim; view: { L: ReturnType<typeof layout>; hud: Hud; campOpen: number } }
type Size = { name: string; w: number; h: number; insets: Insets };

describe('phone first (DESIGN.md §12)', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  const RETURNING: Partial<DawidProgress> = { sessions: 5, pushes: 1, seen: SEEN };

  /** The real game on a canvas of w × h with the runner's insets, a few frames in. */
  function play(size: Size, progress: Partial<DawidProgress> = RETURNING, touch = true): Played {
    const env: GameEnv<DawidProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), ...progress }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    const game = dawid.create(env);
    game.resize(size.w, size.h, 1);
    game.start();
    const inner = game as unknown as { sim: DawidSim; view: Played['view'] };
    const p: Played = { game, sim: inner.sim, view: inner.view };
    frames(p, 20);
    return p;
  }

  function frames(p: Played, n: number, f: FocusFrame = frame()): void {
    for (let i = 0; i < n; i++) {
      p.game.update(STEP, f, p.sim.t + STEP);
      p.game.draw();
    }
  }

  /** David in his camp with the beasts gone: the sheet comes up. */
  function toCamp(p: Played): void {
    quiet(p.sim);
    p.sim.david.x = p.sim.land.camp[0];
    p.sim.david.y = p.sim.land.camp[1];
    frames(p, 60);
  }

  const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const tap = (p: Played, at: { x: number; y: number }, id = 1) => {
    p.game.pointer!({ type: 'down', ...at, id });
    p.game.pointer!({ type: 'up', ...at, id });
    p.game.draw();
  };
  const audit = (p: Played, s: Size, what: string) => {
    const ts = p.game.targets!();
    expect(ts.length, `${s.name}: ${what}`).toBeGreaterThan(0);
    expect(auditTargets(ts, s.w, s.h, s.insets), `${s.name}: ${what}`).toEqual([]);
    return ts;
  };

  it('never sets a canvas font under 11 px', () => {
    for (const size of [0, 1, 6.8, 9.5, 10.99, 11, 13.37, 40]) {
      for (const fam of [SANS, SERIF]) expect(Number(font(800, size, fam).match(PX)![1])).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(font(700, 13.37, SANS)).toBe(`700 13.4px ${SANS}`);
    expect(font(800, 22, SERIF, true)).toBe(`italic 800 22px ${SERIF}`);
  });

  it('lays out for the phone first: u = 1 on a phone, the great stone and the bag in the thumb zone, David in the field', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets);
      // 1 on a phone up to 390 px across (a bigger phone a hair more), never under 1, at most 1.3
      if (Math.min(s.w, s.h) <= 390) expect(L.u, s.name).toBe(1);
      expect(L.u, s.name).toBeGreaterThanOrEqual(1);
      expect(L.u, s.name).toBeLessThanOrEqual(1.3);
      for (const b of [L.bag, L.stone]) {
        expect(b.r * 2, s.name).toBeGreaterThanOrEqual(56);
        expect(b.hit.x, s.name).toBeGreaterThanOrEqual(EDGE - 0.5);
        expect(b.hit.x + b.hit.w, s.name).toBeLessThanOrEqual(s.w - EDGE + 0.5);
        expect(b.hit.y + b.hit.h, s.name).toBeLessThanOrEqual(s.h - s.insets.bottom + 0.5);
        // upright: in the bottom 45 % of the screen, where the thumb reaches
        if (s.h > s.w) expect(b.hit.y, s.name).toBeGreaterThanOrEqual(s.h * (1 - THUMB));
      }
      // the field between the top band and the bottom band: David stands in it, the sling's reach in sight across
      expect(L.field.bottom - L.field.top, s.name).toBeGreaterThanOrEqual(170);
      expect(L.ky, s.name).toBeGreaterThan(L.field.top);
      expect(L.ky, s.name).toBeLessThan(L.field.bottom);
      expect(L.halfW, s.name).toBeGreaterThanOrEqual(RULES.slingRange);
      // the camp's sheet: two columns at least, finger-sized tabs and tiles, room left for David
      const S = L.sheet;
      expect(S.cols, s.name).toBeGreaterThanOrEqual(2);
      expect(S.tileH, s.name).toBeGreaterThanOrEqual(48);
      for (const tb of S.tabs) expect(tb.h, s.name).toBeGreaterThanOrEqual(48);
      expect(S.view.h, s.name).toBeGreaterThanOrEqual(S.tileH);
      if (S.dock === 'bottom') {
        expect(S.head.y - L.field.top, s.name).toBeGreaterThanOrEqual(80);
        expect(L.campKy, s.name).toBeLessThan(S.head.y);
      } else {
        // on its side the sheet takes the right and leaves the field its left
        expect(S.x / s.w, s.name).toBeGreaterThanOrEqual(0.4);
        expect(L.campKx, s.name).toBeLessThan(S.x);
      }
    }
    // upright phones dock the sheet at the bottom, phones on their side and desktops on the right
    expect(layout(360, 500, CHECK_SIZES[0].insets).sheet.dock).toBe('bottom');
    expect(layout(601, 360, CHECK_SIZES[4].insets).sheet.dock).toBe('right');
  });

  it('every control is finger-sized, inside the insets and clear of the others at every size: playing, in camp (each tab, scrolled), a story card', () => {
    for (const s of CHECK_SIZES) {
      const p = play(s);
      expect(audit(p, s, 'play').map(x => x.label)).toEqual(expect.arrayContaining(['stone', 'bag', 'quest']));
      // into the camp: while the sheet slides in, nothing of it (nor the buttons under it) is offered for a tap
      quiet(p.sim);
      p.sim.david.x = p.sim.land.camp[0];
      p.sim.david.y = p.sim.land.camp[1];
      for (let i = 0; i < 12; i++) {
        frames(p, 1);
        const ts = p.game.targets!();
        expect(auditTargets(ts, s.w, s.h, s.insets), `${s.name}: sliding in, frame ${i}`).toEqual([]);
        if (p.view.campOpen >= 0.5 && p.view.campOpen < 0.98) expect(ts.map(x => x.label), `${s.name}: sliding`).toEqual(['quest']);
      }
      toCamp(p);
      expect(p.view.campOpen, s.name).toBeGreaterThan(0.98);
      for (const tab of ['ab', 'bd', 'wp', 'party'] as const) {
        p.sim.setTab(tab);
        frames(p, 2);
        const ts = audit(p, s, `camp ${tab}`);
        expect(ts.some(x => x.label.startsWith('tile')), `${s.name} ${tab}`).toBe(true);
        expect(ts.some(x => x.label === 'hunt'), `${s.name} ${tab}`).toBe(true);
        // the bag and the great stone are under the sheet
        expect(ts.some(x => x.label === 'bag' || x.label === 'stone'), `${s.name} ${tab}`).toBe(false);
        p.view.hud.scroll = 1e4;
        frames(p, 2);
        audit(p, s, `camp ${tab}, scrolled to its end`);
        p.view.hud.scroll = 0;
      }
      // the first session opens with a story card: a tap anywhere moves on
      const first = play(s, {});
      expect(audit(first, s, 'story').map(x => x.label)).toEqual(['story']);
    }
  });

  it('a button shows pressed on touch-down and acts on lift; a thumb that slides off it steers instead', () => {
    const s = CHECK_SIZES[0];
    const p = play(s);
    quiet(p.sim);
    const b = mid(p.view.L.bag.hit);
    p.game.pointer!({ type: 'down', ...b, id: 1 });
    expect(p.view.hud.pressed?.kind).toBe('bag');
    expect(p.sim.mode).not.toBe('home');
    p.game.pointer!({ type: 'up', ...b, id: 1 });
    expect(p.view.hud.pressed).toBeNull();
    expect(p.sim.mode).toBe('home');
    // a drag that starts on the bag walks David the drag's way, and never home
    p.sim.mode = 'none';
    p.game.pointer!({ type: 'down', ...b, id: 2 });
    p.game.pointer!({ type: 'move', x: b.x - 60, y: b.y - 8, id: 2 });
    frames(p, 4);
    expect(p.sim.david.mx).toBeLessThan(-0.5);
    p.game.pointer!({ type: 'up', x: b.x - 60, y: b.y - 8, id: 2 });
    expect(p.sim.mode).toBe('none');
  });

  it('a finger on the field shows the joystick at once; a tap near David sends him hunting, farther walks him there', () => {
    const p = play(CHECK_SIZES[1]);
    quiet(p.sim);
    const L = p.view.L;
    p.game.pointer!({ type: 'down', x: L.kx, y: L.ky, id: 1 });
    const view = p.view as unknown as { stick: { on: boolean } | null };
    expect(view.stick).not.toBeNull();
    expect(view.stick!.on).toBe(false);
    p.game.pointer!({ type: 'up', x: L.kx, y: L.ky, id: 1 });
    expect(p.sim.mode).toBe('hunt');
    expect(view.stick).toBeNull();
    tap(p, { x: L.kx + L.s * 4, y: L.ky - L.s * 1 });
    expect(p.sim.mode).toBe('go');
  });

  it('the great stone not ready says so (no hunt from that tap); ready, a tap throws it', () => {
    const p = play(CHECK_SIZES[0]);
    quiet(p.sim);
    p.sim.mode = 'none';
    const st = mid(p.view.L.stone.hit), stones = p.sim.stones;
    tap(p, st);
    expect(p.sim.mode).toBe('none');
    expect(p.sim.stones).toBe(stones);
    place(p.sim, 'szakal', 2.5, 0);
    p.sim.stoneReady = true;
    p.sim.charge = 1;
    tap(p, st);
    expect(p.sim.stones).toBe(stones + 1);
  });

  it('in camp a tap buys a tile, a drag scrolls the tiles and buys nothing, a tab switches, "Na łowy" sends David out', () => {
    for (const s of [CHECK_SIZES[0], CHECK_SIZES[4]]) {
      const p = play(s, { ...RETURNING, silver: 1e6, bd: { ognisko: 3 } });
      toCamp(p);
      p.sim.setTab('ab');
      frames(p, 2);
      const g = p.view.hud.sheetShown!;
      expect(g, s.name).not.toBeNull();
      const before = p.sim.p.ab.sila ?? 0;
      tap(p, mid(g.tiles[0]));
      expect(p.sim.p.ab.sila ?? 0, s.name).toBe(before + 1);
      // a drag up the tiles scrolls them and buys nothing
      const spent = p.sim.p.silver, at = mid(g.tiles[1]);
      p.game.pointer!({ type: 'down', ...at, id: 3 });
      p.game.pointer!({ type: 'move', x: at.x, y: at.y - 40, id: 3 });
      p.game.pointer!({ type: 'up', x: at.x, y: at.y - 40, id: 3 });
      expect(p.sim.p.silver, s.name).toBe(spent);
      expect(p.view.hud.scroll, s.name).toBeGreaterThan(0);
      // a tab
      tap(p, mid(p.view.hud.sheetShown!.tabs[1]));
      expect(p.sim.campTab, s.name).toBe('bd');
      frames(p, 2);
      expect(p.view.hud.scroll, s.name).toBe(0);
      // "Na łowy"
      p.sim.mode = 'none';
      tap(p, mid(p.view.hud.sheetShown!.hunt));
      expect(p.sim.mode, s.name).toBe('hunt');
    }
  });

  it('the quest pill follows the quest: to the beasts it wants, or home for a purchase', () => {
    const p = play(CHECK_SIZES[1]);
    const box = p.view.hud.questBox!;
    expect(box).not.toBeNull();
    p.sim.p.quest = 0;   // hunt four jackals
    p.sim.mode = 'none';
    tap(p, mid(box));
    expect(['go', 'hunt']).toContain(p.sim.mode);
  });

  it('the quest pill walks David short of the beasts (the hunt takes over), right up to a person, home for a purchase', () => {
    const qs = questsOf(0);
    // a hunt: to the sling's reach of the den, then the hunt
    const a = later({ progress: { quest: qs.findIndex(q => q.kind === 'hunt') } });
    const den = a.questTarget()!;
    a.david.x = den.x + 20 > a.land.w - 1 ? den.x - 20 : den.x + 20;
    a.david.y = den.y;
    expect(a.followQuest()).toBe(true);
    expect(a.mode).toBe('go');
    expect(Math.hypot(a.goal.x - den.x, a.goal.y - den.y)).toBeGreaterThan(3);
    // a visit: right to the person
    const vi = qs.findIndex(q => q.kind === 'visit');
    const b = later({ progress: { quest: vi } });
    const at = b.questTarget()!;
    expect(b.followQuest()).toBe(true);
    expect(b.mode).toBe('go');
    expect(Math.hypot(b.goal.x - at.x, b.goal.y - at.y)).toBeLessThan(0.01);
    // a building the treasury can pay: home
    const bi = qs.findIndex(q => q.kind === 'build');
    const c = later({ progress: { quest: bi, silver: 1e6, wood: 999, stone: 999 } });
    expect(c.followQuest()).toBe(true);
    expect(c.mode).toBe('home');
    // by the harp, or in a story: nothing
    const d = later();
    d.story = { kind: 'land', t: 1, dur: 5, title: '', text: '' };
    expect(d.followQuest()).toBe(false);
  });

  it('speaks of tapping to a finger and of clicks and keys to a mouse, in every language', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['howto.move', 'howto.tap', 'howto.camp', 'coach.move', 'coach.hunt', 'coach.bag', 'coach.camp', 'coach.quest', 'coach.stone', 'story.tap', 'story.next']) {
        // (the quest's arrow on the field is no key: "strzałka", "the arrow", "der Pfeil", "pilen")
        expect(String(cat[k]), `${l} ${k}`).not.toMatch(/WASD|Spacj|Space|Leertaste|mellanslag|klik|click|Klick|klicka|mysz|mouse|Maus|musen|strzałki|strzałkami|\barrows\b|Pfeiltaste|piltangent/i);
      }
      for (const k of ['coach.move.keys', 'coach.hunt.keys', 'coach.bag.keys', 'coach.camp.keys', 'coach.quest.keys', 'coach.stone.keys', 'story.tap.keys', 'story.next.keys', 'howto.keys']) {
        expect(typeof cat[k], `${l} ${k}`).toBe('string');
      }
    }
  });
});
