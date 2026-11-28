import { writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BEASTS, COMPANIONS, GUARDS, HAND_LINES, LANDS, LINES, LINE_COUNT, MOMENTS, QUESTS, TAUNTS, linesFor } from '../src/arcade/dawid/content';
import { Hud } from '../src/arcade/dawid/hud';
import { CATALOGS, t, unit } from '../src/arcade/dawid/i18n';
import dawid from '../src/arcade/dawid/index';
import { EDGE, layout, pacerAt } from '../src/arcade/dawid/layout';
import { pacerProblems, pacerSize } from '../src/arcade/kit/pacerspot';
import { SANS, SERIF, font } from '../src/arcade/dawid/paint';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_TEXT, THUMB, auditTargets, screenKind } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import {
  abilityCost, abilityWhy, bagCap, bestOf, build, buyAbility, forge, freshProgress, guardHp, join, landAt, landK, migrate, partyNow, partySlots,
  stars, toggleParty, weaponCost, weaponLevel, xpNeed, type DawidProgress,
} from '../src/arcade/dawid/meta';
import { RULES } from '../src/arcade/dawid/rules';
import { DawidSim, finaleFor, multFor, planBlocks, questsOf, statsOf, type SimEvent } from '../src/arcade/dawid/sim';
import { AREA_W, MAPS, allSpots, areaAt, spotArea } from '../src/arcade/dawid/lands';
import { storyIds } from '../src/arcade/dawid/chains';
import { STORY, WHO } from '../src/arcade/dawid/story';
import { DIFFICULTIES, recordKey } from '../src/arcade/kit/difficulty';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { hourFrames, mean } from './longframe';
import { catalogProblems, fmtNum } from '../src/i18n';

const DAY = '2026-11-11';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<DawidProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; rhythm?: { focus: number; rest: number } };

function makeSim(o: SimOpts = {}): DawidSim {
  const sim = new DawidSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, rhythm: o.rhythm,
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

  it('follows the rhythm the player set in the lobby: longer Proca, shorter Harfa, the jitter scaled', () => {
    const mean = (bs: { dur: number }[]) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
    for (const planned of [300, 1800]) {
      for (const r of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }, { focus: 90, rest: 15 }]) {
        const plan = planBlocks(planned, false, mulberry32(5), r);
        const push = plan.filter(b => b.kind === 'push'), rest = plan.filter(b => b.kind === 'rest');
        // the shares the player asked for (a 10 s harp is lifted to the 12 s floor)
        const k = mean(push) / mean(rest) / (r.focus / r.rest);
        expect(k).toBeGreaterThan(0.75);
        expect(k).toBeLessThan(1.25);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan.at(-1)!.kind).toBe('rest');
      }
    }
    // no rhythm: the designed one, the harp a third of the session or less
    const plan = planBlocks(600, false, mulberry32(5));
    const share = plan.filter(b => b.kind === 'rest').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.34);
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
    // one dozing beast out of the sling's reach (the land's own may already stand in it): David walks to it
    quiet(sim);
    place(sim, 'szakal', 8, 0).state = 'idle';
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
    expect(p.ver).toBe(2);
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

// ── long sessions: 15, 20, 25 and 30 minutes ───────────────────────
describe('long sessions (15–30 min)', () => {
  it('plans 15, 20, 25 and 30 minutes like the short ones: Proca and Harfa in turn up to the last stretch, no block too long or too short', () => {
    for (const planned of [900, 1200, 1500, 1800]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned + (first ? 1 : 0)));
        if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        const blocks = first ? plan.slice(1) : plan;
        blocks.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(blocks.at(-1)!.kind).toBe('rest');
        expect(finaleFor(planned)).toBe(RULES.finale.long);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        const left = planned - finaleFor(planned) - (first ? RULES.warm.long : 0);
        expect(blocks.length / 2).toBe(Math.round(left / (RULES.push[0] + RULES.rest[0])));
        for (const b of blocks) {
          const [nominal, jitter] = b.kind === 'push' ? RULES.push : RULES.rest;
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
          expect(b.dur).toBeLessThanOrEqual((nominal + jitter) * 1.05);
        }
      }
    }
  });

  /** A typical player (as the pacing bot): taps the story on, buys in camp, follows the quest, hunts, goes home with a full bag. */
  function typical(sim: DawidSim, step: number): () => void {
    let tap = 0;
    return () => {
      if (sim.story && sim.story.t > 1) sim.tap();
      if ((tap += step) < 1) return;
      tap = 0;
      if (sim.inCamp) {
        for (const tab of ['bd', 'wp', 'ab'] as const) {
          sim.setTab(tab);
          for (let k = 0; k < 6; k++) { const i = sim.tiles().findIndex(x => x.why === 'ok' && x.kind !== 'cave'); if (i < 0) break; sim.campTap(i); }
        }
      }
      const q = sim.questTarget();
      const atCamp = q && Math.hypot(q.x - sim.campX, q.y - sim.campY) < 1;
      if (sim.bagFull || atCamp) { if (!sim.inCamp) sim.goHome(); }
      else if (q && sim.quest?.kind !== 'hunt' && sim.quest?.kind !== 'level' && Math.hypot(q.x - sim.david.x, q.y - sim.david.y) > 3) sim.tap(q.x, q.y);
      else if (sim.mode === 'none' || sim.mode === 'go') sim.tap();
    };
  }

  it('plays any rhythm the player sets to its finale: 3 and 10 minutes, long days or long evenings; the XP still grows, David stays on his feet', () => {
    // (30 minutes of each, run once by hand in round 15: all to the finale, David never down, the score 52 k–900 k)
    const runs: [number, { focus: number; rest: number } | undefined][] = [
      [180, undefined], [180, { focus: 120, rest: 10 }], [180, { focus: 20, rest: 40 }],
      [600, undefined], [600, { focus: 120, rest: 10 }], [600, { focus: 20, rest: 40 }],
    ];
    for (const [planned, rhythm] of runs) {
      const name = `${planned} ${rhythm ? `${rhythm.focus}/${rhythm.rest}` : 'designed'}`;
      const sim = later({ planned, seed: 3, rhythm });
      const step = 1 / 20, bot = typical(sim, step);
      let at = -1, downs = 0;
      for (let tt = step; tt < planned + RULES.settle + 1 && !sim.canStop(); tt += step) {
        const b = sim.block;
        const f = sim.phase !== 'play' || !b ? frame({ level: 0.4 })
          : b.kind === 'push' ? frame({ level: 0.68, focused: true, hold: sim.blockT > 8 ? sim.blockT - 8 : 0, activity: 3 })
            : b.kind === 'rest' ? frame({ level: 0.2, calm: 0.75, activity: -1 }) : frame({ level: 0.4 });
        sim.update(step, f, tt);
        bot();
        sim.take();
        if (sim.david.down > 0) downs++;
        if (at < 0 && tt >= planned * 2 / 3) at = sim.score;
      }
      expect(sim.phase, name).toBe('done');
      expect(sim.score, name).toBeGreaterThan(at);
      expect(downs, name).toBe(0);
      expect(JSON.stringify(sim.result()), name).not.toMatch(/undefined|NaN|Infinity/);
    }
  });

  it('a first 30-minute session plays to its finale and keeps giving: levels, quests and guardians to the end, the numbers finite, nothing piling up', () => {
    const sim = makeSim({ planned: 1800, seed: 3 });
    const p = sim.p, step = 1 / 30, bot = typical(sim, step);
    const f = (): FocusFrame => {
      const b = sim.block;
      if (sim.phase !== 'play' || !b) return frame({ level: 0.4 });
      if (b.kind === 'push') return frame({ level: 0.68, focused: true, hold: sim.blockT > 8 ? sim.blockT - 8 : 0, activity: 3 });
      if (b.kind === 'rest') return frame({ level: 0.2, calm: 0.75, activity: -1 });
      return frame({ level: 0.4 });
    };
    let finale = 0, done = 0, bad = 0, at20 = -1, lvl20 = 0;
    const most = { coins: 0, chests: 0, beasts: 0, shots: 0, prints: 0, fx: 0 };
    for (let tt = step; tt < 1800 + RULES.settle + 1 && !sim.canStop(); tt += step) {
      sim.update(step, f(), tt);
      bot();
      for (const e of sim.take()) {
        if (e.type === 'finale') finale++;
        else if (e.type === 'done') done++;
      }
      most.coins = Math.max(most.coins, sim.coins.length);
      most.chests = Math.max(most.chests, sim.chests.length);
      most.beasts = Math.max(most.beasts, sim.beasts.length);
      most.shots = Math.max(most.shots, sim.shots.length);
      most.prints = Math.max(most.prints, sim.prints.length);
      most.fx = Math.max(most.fx, sim.puffs.length + sim.rings.length + sim.notes.length + sim.zones.length);
      const d = sim.david;
      if (![sim.score, d.x, d.y, d.hp, d.max, sim.charge, p.xp, p.silver, p.wood, p.stone, sim.stats.dmg].every(Number.isFinite)) bad++;
      if (at20 < 0 && tt >= 1200) { at20 = sim.score; lvl20 = p.level; }
    }
    expect(bad).toBe(0);
    expect([finale, done, sim.phase]).toEqual([1, 1, 'done']);
    expect(sim.blockIndex).toBe(sim.plan.length - 1);
    // the last ten minutes still pay: XP, levels; the road moved through more than one land
    expect(sim.score).toBeGreaterThan(at20 * 1.2);
    expect(p.level).toBeGreaterThan(lvl20);
    expect(p.land).toBeGreaterThanOrEqual(2);
    expect(sim.guardsNow.length).toBeGreaterThanOrEqual(2);
    // bounded
    expect(most.coins).toBeLessThanOrEqual(RULES.coinCap);
    expect(most.chests).toBeLessThan(12);
    expect(most.beasts).toBeLessThan(80);
    expect(most.shots).toBeLessThan(40);
    expect(most.prints).toBeLessThan(400);
    expect(most.fx).toBeLessThan(100);
    expect(sim.talk.said.length).toBeLessThanOrEqual(120);
    const r = sim.result();
    expect(Number.isFinite(r.score)).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/undefined|NaN|Infinity/);
    expect(p.best['1800']).toBe(sim.score);
  });

  it('a 30-minute session with a strong focus deep on a later circle stays sane: finite, bounded, still levelling', () => {
    const sim = makeSim({ planned: 1800, seed: 5, progress: { sessions: 60, seen: SEEN, land: 8, level: 80 } });
    const p = sim.p, step = 1 / 30, bot = typical(sim, step);
    const level0 = p.level;
    let bad = 0, most = 0;
    for (let tt = step; tt < 1800 + RULES.settle + 1 && !sim.canStop(); tt += step) {
      sim.update(step, sim.block?.kind === 'rest' ? CALM : HIGH, tt);
      bot();
      sim.take();
      most = Math.max(most, sim.coins.length + sim.chests.length + sim.beasts.length + sim.shots.length);
      if (![sim.score, sim.david.x, sim.david.hp, p.xp, p.silver].every(Number.isFinite)) bad++;
    }
    expect(bad).toBe(0);
    expect(sim.phase).toBe('done');
    expect(p.level).toBeGreaterThan(level0);
    expect(most).toBeLessThan(RULES.coinCap + 150);
    expect(JSON.stringify(sim.result())).not.toMatch(/undefined|NaN|Infinity/);
  });
});

describe('long sessions (45–60 min)', () => {
  /** A typical player (as the pacing bot): taps the story on, buys in camp, follows the quest, hunts, goes home with a full bag. */
  function typical(sim: DawidSim, step: number): () => void {
    let tap = 0;
    return () => {
      if (sim.story && sim.story.t > 1) sim.tap();
      if ((tap += step) < 1) return;
      tap = 0;
      if (sim.inCamp) {
        for (const tab of ['bd', 'wp', 'ab'] as const) {
          sim.setTab(tab);
          for (let k = 0; k < 6; k++) { const i = sim.tiles().findIndex(x => x.why === 'ok' && x.kind !== 'cave'); if (i < 0) break; sim.campTap(i); }
        }
      }
      const q = sim.questTarget();
      const atCamp = q && Math.hypot(q.x - sim.campX, q.y - sim.campY) < 1;
      if (sim.bagFull || atCamp) { if (!sim.inCamp) sim.goHome(); }
      else if (q && sim.quest?.kind !== 'hunt' && sim.quest?.kind !== 'level' && Math.hypot(q.x - sim.david.x, q.y - sim.david.y) > 3) sim.tap(q.x, q.y);
      else if (sim.mode === 'none' || sim.mode === 'go') sim.tap();
    };
  }

  /** The pacing bot's focus: a steady push, a calm rest. */
  const steady = (sim: DawidSim) => (): FocusFrame => {
    const b = sim.block;
    if (sim.phase !== 'play' || !b) return frame({ level: 0.4 });
    if (b.kind === 'push') return frame({ level: 0.68, focused: true, hold: sim.blockT > 8 ? sim.blockT - 8 : 0, activity: 3 });
    if (b.kind === 'rest') return frame({ level: 0.2, calm: 0.75, activity: -1 });
    return frame({ level: 0.4 });
  };

  it('plans 45 and 60 minutes like the short ones: Proca and Harfa in turn up to the last stretch, no block too long or too short', () => {
    for (const planned of [2700, 3600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned + (first ? 1 : 0)));
        if (first) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        const blocks = first ? plan.slice(1) : plan;
        blocks.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(blocks.at(-1)!.kind).toBe('rest');
        expect(finaleFor(planned)).toBe(RULES.finale.long);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
        const left = planned - finaleFor(planned) - (first ? RULES.warm.long : 0);
        expect(blocks.length / 2).toBe(Math.round(left / (RULES.push[0] + RULES.rest[0])));
        for (const b of blocks) {
          const [nominal, jitter] = b.kind === 'push' ? RULES.push : RULES.rest;
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
          expect(b.dur).toBeLessThanOrEqual((nominal + jitter) * 1.05);
        }
      }
    }
  }, 300_000);

  it('a first 60-minute session plays to its finale and keeps giving: levels, quests and guardians to the end, the numbers finite and fitting, nothing piling up', () => {
    const sim = makeSim({ planned: 3600, seed: 3 });
    const p = sim.p, step = 1 / 30, bot = typical(sim, step), f = steady(sim);
    let finale = 0, done = 0, bad = 0, at40 = -1, lvl40 = 0, end = 0;
    const most = { coins: 0, chests: 0, beasts: 0, shots: 0, prints: 0, fx: 0 };
    for (let tt = step; tt < 3600 + RULES.settle + 1 && !sim.canStop(); tt += step) {
      end = tt;
      sim.update(step, f(), tt);
      bot();
      for (const e of sim.take()) {
        if (e.type === 'finale') finale++;
        else if (e.type === 'done') done++;
      }
      most.coins = Math.max(most.coins, sim.coins.length);
      most.chests = Math.max(most.chests, sim.chests.length);
      most.beasts = Math.max(most.beasts, sim.beasts.length);
      most.shots = Math.max(most.shots, sim.shots.length);
      most.prints = Math.max(most.prints, sim.prints.length);
      most.fx = Math.max(most.fx, sim.puffs.length + sim.rings.length + sim.notes.length + sim.zones.length);
      const d = sim.david;
      if (![sim.score, d.x, d.y, d.hp, d.max, sim.charge, p.xp, p.silver, p.wood, p.stone, sim.stats.dmg].every(Number.isFinite)) bad++;
      if (at40 < 0 && tt >= 2400) { at40 = sim.score; lvl40 = p.level; }
    }
    expect(bad).toBe(0);
    expect([finale, done, sim.phase]).toEqual([1, 1, 'done']);
    expect(end).toBeLessThan(3600 + RULES.settle);
    expect(sim.blockIndex).toBe(sim.plan.length - 1);
    // the last twenty minutes still pay: XP, levels; the road went round the six lands and on into the second circle
    expect(sim.score).toBeGreaterThan(at40 * 1.2);
    expect(p.level).toBeGreaterThan(lvl40);
    expect(p.land).toBeGreaterThanOrEqual(6);
    expect(sim.guardsNow.length).toBeGreaterThanOrEqual(6);
    // bounded as at 30 minutes
    expect(most.coins).toBeLessThanOrEqual(RULES.coinCap);
    expect(most.chests).toBeLessThan(12);
    expect(most.beasts).toBeLessThan(80);
    expect(most.shots).toBeLessThan(40);
    expect(most.prints).toBeLessThan(400);
    expect(most.fx).toBeLessThan(100);
    expect(sim.talk.said.length).toBeLessThanOrEqual(120);
    const r = sim.result();
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.highlights.length).toBeLessThanOrEqual(6);
    for (const h of r.highlights) expect(h.length, h).toBeLessThanOrEqual(90);
    // the second circle multiplies everything by 45: an hour's XP takes eight figures (the score corner and the
    // summary take their smaller size from eight characters) — but stays within thirteen, what a phone's summary holds
    expect(fmtNum(r.score).length).toBeGreaterThanOrEqual(8);
    expect(fmtNum(r.score).length).toBeLessThanOrEqual(13);
    for (const [, v] of r.stats) expect(v.length, v).toBeLessThanOrEqual(16);
    expect(JSON.stringify(r)).not.toMatch(/undefined|NaN|Infinity/);
    expect(p.best['3600']).toBe(sim.score);
  }, 300_000);

  it('a 60-minute session deep on a later circle stays sane: finite, bounded, still levelling', () => {
    const sim = makeSim({ planned: 3600, seed: 5, progress: { sessions: 60, seen: SEEN, land: 8, level: 80 } });
    const p = sim.p, step = 1 / 30, bot = typical(sim, step);
    const level0 = p.level;
    let bad = 0, most = 0, at40 = -1;
    for (let tt = step; tt < 3600 + RULES.settle + 1 && !sim.canStop(); tt += step) {
      sim.update(step, sim.block?.kind === 'rest' ? CALM : HIGH, tt);
      bot();
      sim.take();
      most = Math.max(most, sim.coins.length + sim.chests.length + sim.beasts.length + sim.shots.length);
      if (![sim.score, sim.david.x, sim.david.hp, p.xp, p.silver].every(Number.isFinite)) bad++;
      if (at40 < 0 && tt >= 2400) at40 = sim.score;
    }
    expect(bad).toBe(0);
    expect(sim.phase).toBe('done');
    expect(p.level).toBeGreaterThan(level0);
    expect(sim.score).toBeGreaterThan(at40);
    expect(most).toBeLessThan(RULES.coinCap + 150);
    const r = sim.result();
    expect(fmtNum(r.score).length).toBeLessThanOrEqual(13);
    expect(JSON.stringify(r)).not.toMatch(/undefined|NaN|Infinity/);
  }, 300_000);

  it('costs a frame at the hour what it cost in the first minutes (nothing drawn piles up)', () => {
    const simOf = (game: unknown) => (game as { sim: DawidSim }).sim;
    let bot: (() => void) | null = null, f: (() => FocusFrame) | null = null;
    const { early, late } = hourFrames({
      module: dawid, progress: { ...dawid.freshProgress(), sessions: 5, pushes: 1, seen: SEEN }, tuning: TUNING,
      setup: game => { bot = typical(simOf(game), 0.05); f = steady(simOf(game)); },
      frame: () => f!(),
      each: () => bot!(),
    });
    expect(late.length).toBeGreaterThan(200);
    expect(mean(late)).toBeLessThan(mean(early) * 1.5);
    expect(Math.max(...late)).toBeLessThan(Math.max(...early) * 1.5);
  }, 300_000);
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
          const atCamp = q && Math.hypot(q.x - sim.campX, q.y - sim.campY) < 1;
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
/**
 * Every string the game drew on a canvas since the last clear, at its largest size (CSS px) — as the mobile audit
 * reads it (scripts/arcade-mobile.mjs): a floater's pop-in (kit/juice.ts) passes through small sizes on its way up.
 */
const FONT_LOG = new Map<string, number>();

/** A canvas context that draws nothing, keeps what is set and measures text at 0.56 em a character. */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * Number(String(target.font).match(PX)?.[1] ?? 10) * 0.56 });
      if (prop === 'fillText' || prop === 'strokeText') {
        return (s: string) => {
          const px = Number(String(target.font).match(PX)?.[1] ?? 10), k = String(s);
          if (k.trim()) FONT_LOG.set(k, Math.max(FONT_LOG.get(k) ?? 0, px));
        };
      }
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

  /** The real game on a canvas of w × h with the runner's insets, a few frames in (a finger's, or a mouse's). */
  const playAs = (size: Size, progress: Partial<DawidProgress> = RETURNING, touch = true): Played => play(size, progress, touch);
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
      // 1 on a phone up to 390 px across (a bigger phone a hair more), never under 1, at most 1.3 — growing past it
      // only on a big screen (DESIGN §14), up to DESK_MAX
      if (Math.min(s.w, s.h) <= 390) expect(L.u, s.name).toBe(1);
      expect(L.u, s.name).toBeGreaterThanOrEqual(1);
      expect(L.u, s.name).toBeLessThanOrEqual(s.w >= 1024 && Math.min(s.w, s.h) >= DESK_BIG ? DESK_MAX : 1.3);
      expect(L.desk, `${s.name}: a finger keeps the phone's family`).toBe(false);
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
    // with a finger (the phone's family at every size) and with a mouse (a desktop-sized canvas: the desktop family)
    for (const [base, touch] of CHECK_SIZES.flatMap(c => [[c, true], [c, false]] as const)) {
      const s = { ...base, name: `${base.name}${touch ? '' : ' (mouse)'}` };
      const play = (sz: Size, progress: Partial<DawidProgress> = RETURNING) => playAs(sz, progress, touch);
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
    // from the area's fire: the nearest jackals are farther than the sling's reach
    a.david.x = a.campX;
    a.david.y = a.campY;
    const den = a.questTarget()!;
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
      for (const k of ['coach.move.keys', 'coach.hunt.keys', 'coach.bag.keys', 'coach.camp.keys', 'coach.quest.keys', 'coach.stone.keys', 'story.tap.keys', 'story.next.keys', 'howto.keys',
        'howto.move.keys', 'howto.tap.keys', 'hover.stone', 'hover.stoneWait', 'hover.bag', 'hover.quest']) {
        expect(typeof cat[k], `${l} ${k}`).toBe('string');
      }
      // a mouse's words name the mouse and the keys; its how-to is shorter than a finger's (the big screen's side column)
      expect(String(cat['howto.tap.keys']), l).not.toMatch(/stuk|\btap|tipp|tryck på skärmen/i);
      const mouse = ['howto.move.keys', 'howto.tap.keys', 'howto.keys'].reduce((n, k) => n + String(cat[k]).length, 0);
      const finger = ['howto.move', 'howto.tap', 'howto.camp', 'howto.keys'].reduce((n, k) => n + String(cat[k]).length, 0);
      expect(mouse, l).toBeLessThan(finger * 0.85);
      expect(String(cat['hover.bag']), l).toMatch(/\bB\b/);
      expect(String(cat['hover.quest']), l).toMatch(/\bQ\b/);
    }
    // the how-to card: a mouse's three rows (no matchMedia here: no coarse pointer)
    const how = dawid.howto!();
    expect(how.hands.map(c => c.gesture)).toEqual(['drag', 'tap', 'keys']);
    expect(how.hands[0].text).toBe(t('howto.move.keys'));
    expect(how.goal).toBe(t('howto.goalShort'));
    // the lamb: every line that speaks of a finger has a mouse's variant (a bubble's 90 characters at most)
    const FINGER = { pl: /stuk|palc/i, en: /\btap|finger/i, de: /tipp|finger/i, sv: /tryck|finger/i } as const;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const m of MOMENTS) {
        for (let i = 1; i <= LINE_COUNT[m]; i++) {
          const k = `say.${m}.${i}`;
          if (!HAND_LINES.has(k)) {
            expect(String(cat[k]), `${l} ${k}`).not.toMatch(FINGER[l]);
            continue;
          }
          const v = String(cat[`${k}.keys`]);
          expect(v.length, `${l} ${k}.keys`).toBeLessThanOrEqual(90);
          expect(v, `${l} ${k}.keys`).not.toMatch(l === 'sv' ? /finger/i : FINGER[l]);
        }
      }
    }
    expect(linesFor(false).warm[0]).toBe(t('say.warm.1.keys'));
    expect(linesFor(true)).toBe(LINES);
  });

  // ── a big screen and a mouse (DESIGN.md §14) ─────────────────────────
  const BIG = CHECK_SIZES.filter(c => screenKind(c.w, c.h, false) === 'big');
  const FULLHD = CHECK_SIZES.find(c => c.name.startsWith('Full HD'))!;

  it('a mouse on a desktop gets its own layout: the world zooms on a big screen, the action bar under David, the hero’s frame bottom left', () => {
    expect(BIG.map(c => c.w)).toEqual([1190, 1587]);
    for (const s of CHECK_SIZES) {
      const kind = screenKind(s.w, s.h, false);
      const L = layout(s.w, s.h, s.insets, false);
      expect(L.desk, s.name).toBe(kind === 'desktop' || kind === 'big');
      if (!L.desk) continue;
      const phone = layout(s.w, s.h, s.insets, true);
      // the great stone and the bag side by side right under David, bigger than a phone's
      expect(Math.abs((L.stone.x + L.bag.x) / 2 - L.kx), s.name).toBeLessThan(1);
      expect(L.stone.y, s.name).toBeGreaterThan(L.ky + L.s * 2.5);
      expect(L.stone.r * 2, s.name).toBeGreaterThanOrEqual(64);
      expect(L.bag.hit.x, s.name).toBeGreaterThanOrEqual(L.stone.hit.x + L.stone.hit.w + 6);
      // the hero's frame at the bottom left: health and the level's bar never run across the whole screen
      expect(L.hp.w, s.name).toBeLessThanOrEqual(340 * L.u + 0.5);
      expect(L.hp.x + L.hp.w, s.name).toBeLessThan(L.stone.hit.x);
      expect(L.xp.x + L.xp.w, s.name).toBeLessThan(L.stone.hit.x);
      expect(L.lv.y + L.lv.h, s.name).toBeLessThanOrEqual(L.bottom);
      // David in the field, the sling's reach in sight across
      expect(L.ky, s.name).toBeGreaterThan(L.field.top);
      expect(L.ky, s.name).toBeLessThan(L.field.bottom);
      expect(L.halfW, s.name).toBeGreaterThanOrEqual(RULES.slingRange);
      // the camp's sheet from the right, leaving the field its left
      expect(L.sheet.dock, s.name).toBe('right');
      expect(L.sheet.x / s.w, s.name).toBeGreaterThanOrEqual(0.4);
      expect(L.campKx, s.name).toBeLessThan(L.sheet.x);
      if (kind === 'big') {
        // the camera zooms in: ≥ 78 px a u (a phone's map stops at 66), about 14.5 u across instead of 18–24
        expect(L.s, s.name).toBeGreaterThanOrEqual(78);
        expect(L.s, s.name).toBeGreaterThanOrEqual(1.18 * phone.s);
        expect(2 * L.halfW, s.name).toBeLessThanOrEqual(16);
        // type and controls grow with the screen; a larger minimap
        expect(L.u, s.name).toBeGreaterThanOrEqual(1.35);
        expect(L.mini!.w, s.name).toBeGreaterThanOrEqual(150 * 1.35 - 0.01);
      } else {
        // a desktop under the top HUD: the world as close as the phone's family showed it there
        expect(L.s, s.name).toBeGreaterThanOrEqual(phone.s * 0.97);
      }
    }
    expect(layout(1587, 1300, BIG[1].insets, false).u).toBeCloseTo(1587 / 880, 3);
  });

  it('a big screen keeps the font floor and grows the type with the screen (playing, a tooltip, the camp, a story card)', () => {
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const sizesOf = (s: Size, touch: boolean): number[] => {
      FONT_LOG.clear();
      const p = play(s, RETURNING, touch);
      p.game.pointer!({ type: 'move', ...mid(p.view.L.bag.hit), id: 1 });
      frames(p, 40);
      toCamp(p);
      for (const tab of ['ab', 'bd', 'wp', 'party'] as const) {
        p.sim.setTab(tab);
        frames(p, 2);
      }
      play(s, {}, touch);
      return [...FONT_LOG.values()];
    };
    const phone = sizesOf(CHECK_SIZES[0], true);
    expect(Math.min(...phone)).toBeGreaterThanOrEqual(MIN_TEXT);
    for (const s of CHECK_SIZES.filter(c => screenKind(c.w, c.h, false) !== 'phone' && screenKind(c.w, c.h, false) !== 'phone-side')) {
      const desk = sizesOf(s, false);
      expect(Math.min(...desk), s.name).toBeGreaterThanOrEqual(MIN_TEXT);
      if (screenKind(s.w, s.h, false) === 'big') expect(median(desk), s.name).toBeGreaterThanOrEqual(median(phone) * 1.3);
    }
    expect(median(sizesOf(BIG[1], false))).toBeGreaterThanOrEqual(median(phone) * 1.7);
  });

  it('a mouse: what is under it answers — a lit control, a hand, a tooltip with its key, a ring where a click sends David; a finger has none of it', () => {
    const p = play(FULLHD, RETURNING, false);
    quiet(p.sim);
    const L = p.view.L, view = p.view as unknown as { hoverMark: { kind: string } | null; tip: { text: string } | null };
    const canvas = (p.game as unknown as { env: GameEnv<DawidProgress> }).env.canvas;
    expect(L.desk).toBe(true);
    const move = (at: { x: number; y: number }, n = 1) => {
      p.game.pointer!({ type: 'move', ...at, id: 1 });
      frames(p, n);
    };
    // the bag: lit and a hand at once, its tooltip (with its key) after a moment's rest
    move(mid(L.bag.hit));
    expect(p.view.hud.hover).toEqual({ kind: 'bag', i: 0 });
    expect(canvas.style.cursor).toBe('pointer');
    expect(view.tip).toBeNull();
    frames(p, 40);
    expect(view.tip?.text).toMatch(/\bB\b/);
    // the field next to David: a click hunts (a ring round him); farther: a ring where he would walk
    move({ x: L.kx + L.s * 0.6, y: L.ky });
    expect(p.view.hud.hover).toBeNull();
    expect(view.tip).toBeNull();
    expect(view.hoverMark?.kind).toBe('hunt');
    move({ x: L.kx + L.s * 5, y: L.ky - L.s * 2 });
    expect(view.hoverMark?.kind).toBe('go');
    // the great stone ready with a mark in sight: a click throws it — its mark shows, the cursor is a crosshair
    place(p.sim, 'szakal', 2.5, 0);
    p.sim.stoneReady = true;
    p.sim.charge = 1;
    frames(p, 1);
    expect(view.hoverMark?.kind).toBe('stone');
    expect(canvas.style.cursor).toBe('crosshair');
    // in camp: the tiles and the tabs light up under the mouse
    toCamp(p);
    const g = p.view.hud.sheetShown!;
    move(mid(g.tiles[1]));
    expect(p.view.hud.hover).toEqual({ kind: 'tile', i: 1 });
    move(mid(g.tabs[2]));
    expect(p.view.hud.hover).toEqual({ kind: 'tab', i: 2 });
    expect(canvas.style.cursor).toBe('pointer');
    // a finger: no hover, no rings, no cursor
    const f = play(FULLHD, RETURNING, true);
    f.game.pointer!({ type: 'move', ...mid(f.view.L.bag.hit), id: 1 });
    frames(f, 40);
    expect(f.view.hud.hover).toBeNull();
    expect((f.view as unknown as { hoverMark: unknown }).hoverMark).toBeNull();
  });

  it('keys on a desktop: B sends David home with the bag, Q follows the quest (the buttons’ own answers)', () => {
    const p = play(FULLHD, RETURNING, false);
    p.sim.mode = 'none';
    expect(p.game.key!('b', true)).toBe(true);
    p.game.key!('b', false);
    expect(p.sim.mode).toBe('home');
    p.sim.mode = 'none';
    p.sim.p.quest = 0;   // hunt four jackals
    frames(p, 2);
    expect(p.game.key!('Q', true)).toBe(true);
    expect(['go', 'hunt']).toContain(p.sim.mode);
    // a story card swallows them (a tap or Space moves it on)
    const first = play(FULLHD, {}, false);
    first.sim.mode = 'none';
    expect(first.game.key!('b', true)).toBe(true);
    expect(first.sim.mode).toBe('none');
  });
});

describe('Dawid: the breath pacer in a Harfa stands in the open field (pacerAt)', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  it('keeps the pill whole under the HUD band, clear of the quest pill, the minimap, the bottom band\'s controls and David, at every size', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const env: GameEnv<DawidProgress> = {
          canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
          progress: { ...freshProgress(), sessions: 5, pushes: 1, seen: SEEN }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300,
          tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
          hudTop: () => c.insets.top, insets: () => c.insets, touch,
        };
        const game = dawid.create(env);
        game.resize(c.w, c.h, 1);
        game.start();
        for (let i = 0; i < 10; i++) { game.update(1 / 30, frame(), (i + 1) / 30); game.draw(); }
        const L = (game as unknown as { view: { L: ReturnType<typeof layout> } }).view.L;
        const at = game.pacerAt!();
        const name = `${c.name}${touch ? '' : ' (mouse)'}`;
        expect(at, name).not.toBeNull();
        expect(at, name).toEqual(pacerAt(L, false));
        const s = L.s;
        const keep = [
          ...game.targets!(),
          { label: 'quest pill', ...L.quest }, ...(L.mini ? [{ label: 'minimap', ...L.mini }] : []),
          { label: 'health', ...L.hp }, { label: 'level', ...L.xp },
          { label: 'David', x: L.kx - s * 0.6, y: L.ky - s * 1.3, w: s * 1.2, h: s * 1.3 },
        ];
        expect(pacerProblems(at, c.w, c.h, c.insets, keep, pacerSize(L.kind === 'big')), name).toEqual([]);
      }
    }
  });

  it('keeps off the camp\'s sheet while it is open', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      const at = pacerAt(L, true);
      expect(at, c.name).not.toBeNull();
      expect(pacerProblems(at, c.w, c.h, c.insets, [{ label: 'sheet', ...L.sheet }, { label: 'quest pill', ...L.quest }]), c.name).toEqual([]);
    }
  });
});

// ── round 25: the lands as levels, the story, the difficulty (DESIGN §29) ──────────────────

describe('the lands as levels: three areas each, bigger than round 5’s maps', () => {
  it('each land is a wide map of three named areas with their fires, dens, heaps, chests, people and landmarks; passes between them', () => {
    expect(MAPS.map(m => m.id)).toEqual(LANDS.map(l => l.id));
    for (const m of MAPS) {
      expect(m.areas.length, m.id).toBeGreaterThanOrEqual(3);
      expect(m.w * m.h, m.id).toBeGreaterThan(64 * 42 * 2);
      m.areas.forEach((a, i) => {
        const name = `${m.id}/${a.id}`;
        expect(a.x1 - a.x0, name).toBeGreaterThanOrEqual(AREA_W);
        expect(a.x0, name).toBe(i ? m.areas[i - 1].x1 : 0);
        if (i < m.areas.length - 1) expect(a.pass, name).toBeTruthy();
        expect(a.dens.length, name).toBeGreaterThanOrEqual(4);
        expect(a.nodes.filter(n => n[0] === 'wood').length, name).toBeGreaterThanOrEqual(3);
        expect(a.nodes.filter(n => n[0] === 'stone').length, name).toBeGreaterThanOrEqual(3);
        expect(a.landmarks.length, name).toBeGreaterThanOrEqual(1);
        const inside = (x: number, y: number) => x > a.x0 + 0.5 && x < a.x1 - 0.5 && y > 0.5 && y < m.h - 0.5;
        for (const [, x, y] of a.dens) expect(inside(x, y), `${name} den ${x},${y}`).toBe(true);
        for (const [, x, y] of a.nodes) expect(inside(x, y), `${name} heap ${x},${y}`).toBe(true);
        for (const [id, [x, y]] of Object.entries(a.spots)) expect(inside(x, y), `${name} spot ${id}`).toBe(true);
        expect(inside(...a.camp), `${name} camp`).toBe(true);
        expect(inside(...a.chest), `${name} chest`).toBe(true);
        // the fire is safe ground: no den sits on it
        for (const [, x, y] of a.dens) expect(Math.hypot(x - a.camp[0], y - a.camp[1]), `${name} den by the fire`).toBeGreaterThan(RULES.campR + 4);
      });
      expect(areaAt(m, m.lair[0]), `${m.id} lair`).toBe(m.areas.length - 1);
    }
  });

  it('every chain place exists, each area has a chain, the kinds of the new quests are all there', () => {
    const kinds = new Set<string>();
    for (const m of MAPS) {
      const chain = QUESTS[m.id], spots = allSpots(m);
      expect(chain.at(-1)!.kind).toBe('gate');
      expect(chain.filter(q => q.kind === 'pass').length, m.id).toBe(m.areas.length - 1);
      for (let a = 0; a < m.areas.length; a++) expect(chain.filter(q => q.area === a).length, `${m.id} area ${a}`).toBeGreaterThanOrEqual(3);
      for (const q of chain) {
        kinds.add(q.kind);
        for (const sp of [q.at, q.to, ...(q.spots ?? [])]) if (sp && sp !== 'camp') expect(spots[sp], `${m.id} ${q.kind} ${sp}`).toBeTruthy();
        if (q.kind === 'hunt') expect(m.areas[q.area!].dens.some(d => d[0] === q.what), `${m.id} hunt ${q.what} in area ${q.area}`).toBe(true);
        if (q.at && q.kind !== 'deliver' && q.at !== 'camp') expect(spotArea(m, q.at), `${m.id} ${q.id}`).toBe(q.area);
      }
      // the areas follow one another along the chain
      const areas = chain.map(q => q.area ?? 0);
      for (let i = 1; i < areas.length; i++) expect(areas[i], `${m.id} #${i}`).toBeGreaterThanOrEqual(areas[i - 1]);
    }
    for (const k of ['find', 'rescue', 'escort', 'deliver', 'defend', 'talk', 'word', 'visit', 'pass']) expect(kinds.has(k), k).toBe(true);
  });

  it('fences hold David on his side of a closed pass; through an open pass only by its gap', () => {
    const sim = later({ progress: { quest: 0 } });
    quiet(sim);
    const A = sim.land.areas[0], bx = A.x1, gy = A.pass!.y;
    expect(sim.gapOpen(0)).toBe(false);
    sim.david.x = bx - 1;
    sim.david.y = gy;
    sim.steer(1, 0);
    drive(sim, 2, frame());
    expect(sim.david.x).toBeLessThan(bx);
    // the chain's pass: the gap opens, a walk through it goes on into the next area
    const pi = QUESTS.pastwiska.findIndex(q => q.kind === 'pass');
    const s2 = later({ progress: { quest: pi } });
    quiet(s2);
    expect(s2.gapOpen(0)).toBe(true);
    s2.david.x = bx - 1;
    s2.david.y = gy + 6;   // off the gap: the wall holds
    s2.steer(1, 0);
    drive(s2, 1.5, frame());
    expect(s2.david.x).toBeLessThan(bx);
    s2.david.y = gy;
    s2.steer(1, 0);
    const evs = drive(s2, 2, frame());
    expect(s2.david.x).toBeGreaterThan(bx);
    expect(s2.area).toBe(1);
    expect(ofType(evs, 'area')).toHaveLength(1);
    expect(s2.p.quest).toBe(pi + 1);
    expect(s2.areasOpen).toBe(2);
  });

  it('the auto-pilot walks through the passes to a place in another area', () => {
    const pi = QUESTS.pastwiska.findIndex(q => q.kind === 'pass');
    const sim = later({ progress: { quest: pi + 1 } });   // the well, in the second area; David starts at its fire
    quiet(sim);
    const back = sim.campOf(0);
    sim.david.x = back[0] + 4;
    sim.david.y = back[1];
    (sim as unknown as { area: number }).area = 0;
    expect(sim.followQuest()).toBe(true);
    drive(sim, 25, frame(), { t: 0 }, () => { sim.david.hp = sim.david.max; if (sim.story) sim.story = null; });
    expect(sim.area).toBe(1);
    expect(sim.p.quest).toBeGreaterThan(pi + 1);   // the talk at the well is done
  });

  it('only David’s area and the next open one keep live dens (the far ones cost nothing)', () => {
    const sim = later({ progress: { quest: QUESTS.pastwiska.length - 2, sessions: 5 } });   // the guard: all three open
    expect(sim.areasOpen).toBe(3);
    const live = new Set(sim.dens.filter(d => d.live).map(d => d.area));
    expect(live.has(sim.area)).toBe(true);
    for (const a of live) expect(Math.abs(a - sim.area)).toBeLessThanOrEqual(1);
    for (const b of sim.beasts) expect(Math.abs(b.area - sim.area)).toBeLessThanOrEqual(1);
  });
});

describe('the story: chapter cards, scenes, choices, the quest kinds, the log', () => {
  it('a first session opens with the chapter card and the anointing scene; a tap goes on line by line, Pomiń closes', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.story?.kind).toBe('open');
    expect(sim.story?.title).toContain(t('land.pastwiska'));
    drive(sim, 0.7, frame());
    sim.tap();
    expect(sim.story?.kind).toBe('scene');
    expect(sim.story?.scene).toBe('open');
    const n = sim.story!.lines!.length;
    expect(n).toBeGreaterThanOrEqual(3);
    drive(sim, 0.4, frame(), { t: 1 });
    sim.tap();
    expect(sim.story?.i).toBe(1);
    expect(sim.frozen).toBe(true);
    expect(sim.skipScene()).toBe(true);
    expect(sim.story).toBeNull();
  });

  it('untapped, a scene goes on by itself (its reading time), its passage last', () => {
    const sim = makeSim({ planned: 600 });
    let shown = 0;
    for (let i = 0; i < 120 * 60 && (sim.story || shown === 0); i++) {
      if (sim.story?.kind === 'scene') shown++;
      sim.update(STEP, frame(), i * STEP);
    }
    expect(shown).toBeGreaterThan(0);
    expect(sim.story).toBeNull();
    expect(shown * STEP).toBeLessThan(60);
  });

  it('a session of a minute or less shows the chapter’s title for a moment and no scene: play comes first', () => {
    for (const planned of [40, 60]) {
      const sim = makeSim({ planned });
      expect(sim.quick).toBe(true);
      expect(sim.story?.kind).toBe('open');
      expect(sim.story?.dur).toBeLessThanOrEqual(2.5);
      let scene = 0;
      drive(sim, 3, frame(), { t: 0 }, () => { if (sim.story?.kind === 'scene') scene++; });
      expect(sim.story).toBeNull();
      expect(scene).toBe(0);
    }
  });

  it('a choice: two answers, each with its reply and its gift; Space takes the first; never a dead end', () => {
    const wi = QUESTS.pastwiska.findIndex(q => q.id === 'well');
    for (const pick of ['a', 'b'] as const) {
      const sim = later({ progress: { quest: wi } });
      quiet(sim);
      const at = sim.spot('well')!;
      sim.david.x = at.x;
      sim.david.y = at.y + 0.5;
      const silver0 = sim.p.silver;
      drive(sim, 0.2, frame());
      expect(sim.story?.kind).toBe('scene');
      // to the last line, where the answers wait
      for (let i = 0; i < 12 && sim.story && !(sim.story.i === sim.story.lines!.length - 1); i++) { drive(sim, 0.4, frame()); sim.tap(); }
      expect(sim.story?.choice).toBeTruthy();
      const rested0 = sim.p.rested;
      const silverMid = sim.p.silver;
      if (pick === 'a') { drive(sim, 0.4, frame()); expect(sim.key(' ', true)).toBe(true); }
      else expect(sim.choose('b')).toBe(true);
      expect(sim.p.choices.well).toBe(pick);
      if (pick === 'a') expect(sim.p.silver).toBeGreaterThan(silverMid);
      else expect(sim.p.rested).toBeGreaterThan(rested0);
      expect(sim.p.silver).toBeGreaterThan(silver0);   // the quest's own reward
      for (let i = 0; i < 10 && sim.story; i++) { drive(sim, 0.4, frame()); sim.tap(); }
      expect(sim.story).toBeNull();
      expect(sim.quest!.kind).toBe('gather');
    }
  });

  it('find, deliver, escort, rescue, defend, a word: each completes where the story says', () => {
    const at = (land: number, id: string) => questsOf(land).findIndex(q => q.id === id);
    const walk = (sim: DawidSim, x: number, y: number, sec = 0.3) => { sim.david.x = x; sim.david.y = y; drive(sim, sec, frame(), { t: sim.t }, () => { sim.david.hp = sim.david.max; if (sim.story) sim.story = null; }); };
    // find: the five smooth stones, one by one
    const f = later({ progress: { land: 2, quest: at(2, 'stones') } });
    quiet(f);
    const c0 = f.charge;
    for (const sp of ['s1', 's2', 's3', 's4', 's5']) { const p = f.spot(sp)!; walk(f, p.x, p.y); }
    expect(f.quest!.kind).not.toBe('find');
    expect(f.charge).toBeGreaterThanOrEqual(Math.max(c0, 0.6));
    // deliver: the jar from the well to the old shepherd
    const d = later({ progress: { quest: at(0, 'jar') } });
    quiet(d);
    const well = d.spot('well')!, old = d.spot('starzec')!;
    walk(d, well.x, well.y);
    expect(d.p.questN).toBe(1);
    walk(d, old.x, old.y);
    expect(d.quest!.id).toBe('asahel');
    // escort: Jesse's donkey walks with David to the milestone
    const e = later({ progress: { land: 1, quest: at(1, 'donkey') } });
    quiet(e);
    drive(e, 0.1, frame());
    expect(e.escort).toBeTruthy();
    walk(e, e.escort!.x + 0.5, e.escort!.y);
    expect(e.escort!.follow).toBe(true);
    const ms = e.spot('milestone')!;
    e.mode = 'go';
    e.goal = { x: ms.x, y: ms.y };
    drive(e, 40, frame(), { t: e.t }, () => { e.david.hp = e.david.max; if (e.story) e.story = null; });
    expect(e.quest!.id).not.toBe('donkey');
    // rescue: the pack comes out when David is near, the ewe is saved when it has run off
    const r = later({ progress: { quest: at(0, 'ewe'), level: 30 } });
    quiet(r);
    const ewe = r.spot('ewe')!;
    walk(r, ewe.x - 4, ewe.y, 0.2);
    expect(r.beasts.filter(b => b.den === -2).length).toBe(4);
    drive(r, 30, frame(), { t: r.t }, () => { r.david.hp = r.david.max; if (r.story) r.story = null; if (r.mode === 'none') r.hunt(); });
    expect(r.p.quest).toBeGreaterThan(at(0, 'ewe'));
    // defend: the vineyard holds against the boars' waves
    const v = later({ progress: { land: 1, quest: at(1, 'vines'), level: 40 } });
    quiet(v);
    const vin = v.spot('vines')!;
    walk(v, vin.x, vin.y, 0.2);
    expect(v.defending).toBe(true);
    drive(v, 60, frame(), { t: v.t }, () => { v.david.hp = v.david.max; if (v.story) v.story = null; if (v.mode === 'none') v.hunt(); });
    expect(v.quest!.kind).toBe('pass');
    // a word: out of the cave and up the hill
    const w = later({ progress: { land: 4, quest: at(4, 'call') } });
    quiet(w);
    const cave = w.spot('cave')!, hill = w.spot('hill')!;
    walk(w, cave.x, cave.y);
    expect(w.p.questN).toBe(1);
    walk(w, hill.x, hill.y);
    expect(w.quest!.id).toBe('water');
  });

  it('the quest log: the chapter, the areas and the chain; it holds the world; a tap closes it', () => {
    const wi = QUESTS.pastwiska.findIndex(q => q.id === 'well');
    const sim = later({ progress: { quest: wi } });
    const log = sim.log();
    expect(log.title).toContain(t('land.pastwiska'));
    expect(log.areas.map(a => a.state)).toEqual(['done', 'here', 'shut']);
    expect(log.quests.filter(q => q.state === 'now')).toHaveLength(1);
    expect(log.quests.at(-1)!.state).toBe('next');
    expect(log.quests.filter(q => q.state === 'done')).toHaveLength(wi);
    expect(sim.toggleLog(true)).toBe(true);
    expect(sim.frozen).toBe(true);
    const x = sim.david.x;
    sim.steer(1, 0);
    drive(sim, 1, frame());
    expect(sim.david.x).toBe(x);
    sim.tap();
    expect(sim.logOpen).toBe(false);
    expect(sim.key('l', true)).toBe(true);
    expect(sim.logOpen).toBe(true);
  });

  it('a typical player goes through all six lands of the first circle: every quest done in order, the scenes played', () => {
    const p = freshProgress();
    const done: string[] = [];
    let scenes = 0, stuck = 0;
    for (let s = 0; s < 8 && p.land < 6; s++) {
      const sim = new DawidSim({ progress: p, rng: mulberry32(40 + s), day: DAY, daySeed: 1, plannedSec: 1200, eeg: false, tuning: TUNING });
      sim.start();
      const step = 1 / 30;
      let tap = 0, lastQ = `${p.land}:${p.quest}`, since = 0;
      for (let tt = step; tt < 1200 + RULES.settle + 1 && !sim.canStop(); tt += step) {
        const b = sim.block;
        const f = sim.phase !== 'play' || !b ? frame({ level: 0.4 }) : b.kind === 'push' ? frame({ level: 0.68, focused: true, hold: sim.blockT > 8 ? sim.blockT - 8 : 0, activity: 3 }) : b.kind === 'rest' ? frame({ level: 0.2, calm: 0.75, activity: -1 }) : frame({ level: 0.4 });
        sim.update(step, f, tt);
        if (sim.story && sim.story.t > 0.5) { if (sim.story.choice && !sim.story.choice.picked && sim.story.i === sim.story.lines!.length - 1) sim.choose(sim.t % 2 < 1 ? 'a' : 'b'); else sim.tap(); }
        if ((tap += step) >= 1) {
          tap = 0;
          if (sim.inCamp) for (const tab of ['bd', 'wp', 'ab'] as const) {
            sim.setTab(tab);
            for (let k = 0; k < 6; k++) { const i = sim.tiles().findIndex(x => x.why === 'ok' && x.kind !== 'cave'); if (i < 0) break; sim.campTap(i); }
          }
          const q = sim.questTarget();
          const atCamp = q && Math.hypot(q.x - sim.campX, q.y - sim.campY) < 1;
          if (sim.bagFull || atCamp) { if (!sim.inCamp) sim.goHome(); }
          else if (q && sim.quest?.kind !== 'hunt' && sim.quest?.kind !== 'level' && Math.hypot(q.x - sim.david.x, q.y - sim.david.y) > 3) sim.tap(q.x, q.y);
          else if (sim.mode === 'none' || sim.mode === 'go') sim.tap();
        }
        for (const e of sim.take()) {
          if (e.type === 'questDone' && p.land < 6) done.push(`${landAt(p.land).spec.id}:${sim.quests[p.quest - 1]?.kind ?? 'gate'}`);
          if (e.type === 'story' && sim.story?.kind === 'scene') scenes++;
        }
        const key = `${p.land}:${p.quest}`;
        if (key !== lastQ) { lastQ = key; since = 0; } else if ((since += step) > 600) stuck++;
      }
      sim.finish();
    }
    expect(p.land, done.slice(-3).join(' ')).toBeGreaterThanOrEqual(6);
    expect(stuck).toBe(0);
    const total = MAPS.reduce((n, m) => n + QUESTS[m.id].length, 0);
    expect(done.length).toBeGreaterThanOrEqual(total - 1);   // the last gate counts as the road goes on (land 6)
    expect(scenes).toBeGreaterThanOrEqual(30);
    expect(Object.keys(p.choices).length).toBeGreaterThanOrEqual(6);
    expect(p.joined.sort()).toEqual(['abigail', 'abiszaj', 'asahel', 'benajasz', 'jonatan', 'szamma']);
  }, 300_000);
});

describe('the story’s words (the writer’s files): four languages, one shape', () => {
  const FORBIDDEN = [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /zabił/, /\bkill/, /töte/, /getötet/, /döda/, /dödar/, /pray/, /módl/, /\bbete\b/, /\bdead\b/, /\bdies\b/, /martw/, /umar/];
  it('every id of the chains has its words in pl, en, de and sv, with the same speakers and as many lines', () => {
    for (const m of MAPS) {
      const ids = storyIds(m.id);
      const pl = STORY[m.id].pl;
      for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
        const w = STORY[m.id][lang], name = `${m.id}.${lang}`;
        expect(w.chapter.length, name).toBeGreaterThan(20);
        for (const a of m.areas) {
          expect(w.areas[a.id]?.name, `${name} area ${a.id}`).toBeTruthy();
          expect(w.areas[a.id].name.length, `${name} area ${a.id}`).toBeLessThanOrEqual(28);
        }
        for (const q of ids.quests) {
          expect(w.quests[q], `${name} quest ${q}`).toBeTruthy();
          expect(w.quests[q].length, `${name} quest ${q}`).toBeLessThanOrEqual(44);
        }
        for (const sc of ids.scenes) {
          const lines = w.scenes[sc];
          expect(lines?.length, `${name} scene ${sc}`).toBeGreaterThan(0);
          expect(lines.length, `${name} scene ${sc}`).toBeLessThanOrEqual(6);
          expect(lines.map(l => l[0]), `${name} scene ${sc}`).toEqual(pl.scenes[sc].map(l => l[0]));
          for (const [who, text] of lines) {
            expect(WHO, `${name} ${sc}`).toContain(who);
            expect(text.length, `${name} ${sc}: ${text}`).toBeLessThanOrEqual(110);
          }
        }
        for (const c of ids.choices) {
          const ch = w.choices[c];
          expect(ch, `${name} choice ${c}`).toBeTruthy();
          for (const b of [ch.a, ch.b]) expect(b.length, `${name} ${c}`).toBeLessThanOrEqual(36);
          expect(ch.ra.map(l => l[0]), `${name} ${c}`).toEqual(pl.choices[c].ra.map(l => l[0]));
          expect(ch.rb.map(l => l[0]), `${name} ${c}`).toEqual(pl.choices[c].rb.map(l => l[0]));
        }
        const all = JSON.stringify(w).toLowerCase();
        expect(JSON.stringify(w), name).not.toMatch(/\bTODO\b/);
        for (const re of FORBIDDEN) expect(all, `${name} ${re}`).not.toMatch(re);
      }
      // Polish without the gendered second person
      expect(JSON.stringify(pl), m.id).not.toMatch(/\b\w+(łeś|łaś)\b/);
    }
  });

  it('the speakers have a name in four languages and a portrait', () => {
    for (const who of WHO) for (const l of ['pl', 'en', 'de', 'sv'] as const) expect(CATALOGS[l][`who.${who}` as keyof typeof CATALOGS.pl], `${l} ${who}`).toBeTruthy();
  });
});

describe('difficulty levels (kit/difficulty.ts): Na start · Zwykły · Zaawansowany · Hardcore', () => {
  const at = (difficulty: DawidProgress['difficulty'], o: SimOpts = {}) => later({ ...o, progress: { ...o.progress, difficulty } });

  it('REGULAR is the game as it was: the same beasts, guardians, David and helps; an old save (no level) plays identically', () => {
    const a = at('regular', { seed: 9 });
    const b = later({ seed: 9 });   // no difficulty in the save: REGULAR
    expect(b.difficulty).toBe('regular');
    for (const bs of a.beasts) {
      const spec = BEASTS[bs.kind], dn = a.dens[bs.den];
      expect(bs.max).toBe(spec.hp * dn.k);
      expect(bs.atk).toBe(spec.atk * dn.k);
      expect(bs.xp).toBe(spec.xp * dn.k);
      expect(bs.silver).toBe(spec.silver * dn.k);
      expect(bs.speed).toBe(spec.speed);
    }
    for (const dn of a.dens) expect(dn.n).toBe(a.land.camps.find(c => c[1] === dn.x && c[2] === dn.y)![3]);
    expect(a.guard.max).toBe(guardHp(a.p.land));
    expect(a.david.max).toBe(statsOfHp(a));
    expect(a.huntSeek).toBe(RULES.huntSeek);
    expect(a.floorSec).toBe(RULES.floorSec);
    const f = (tt: number) => (tt % 60 < 45 ? HIGH : CALM);
    drive(a, 120, f, { t: 0 }, () => { if (a.mode === 'none') a.hunt(); });
    drive(b, 120, f, { t: 0 }, () => { if (b.mode === 'none') b.hunt(); });
    expect(a.score).toBe(b.score);
    expect(a.p.silver).toBe(b.p.silver);
    expect(a.result().stats.map(s => s[0])).not.toContain(t('stat.difficulty'));
  });

  it('the plan and the training are the same at every level (3–60 min and ≤ 60 s)', () => {
    for (const planned of [40, 60, 180, 300, 600, 1800, 2700, 3600]) {
      const plans = DIFFICULTIES.map(d => JSON.stringify(makeSim({ planned, seed: 4, progress: { difficulty: d } }).plan));
      expect(new Set(plans).size, String(planned)).toBe(1);
    }
  });

  it('scales foes, numbers, David and the helps in order: STARTING < REGULAR < ADVANCED < HARDCORE', () => {
    const sims = DIFFICULTIES.map(d => at(d, { seed: 2, progress: { quest: QUESTS.pastwiska.length - 2 } }));
    const hp = sims.map(s => s.guard.max), dhp = sims.map(s => s.david.max), seek = sims.map(s => s.huntSeek), beasts = sims.map(s => s.dens.reduce((n, d) => n + d.n, 0));
    for (let i = 1; i < 4; i++) {
      expect(hp[i]).toBeGreaterThan(hp[i - 1]);
      expect(dhp[i]).toBeLessThan(dhp[i - 1]);
      expect(seek[i]).toBeLessThan(seek[i - 1]);
      expect(beasts[i]).toBeGreaterThanOrEqual(beasts[i - 1]);
    }
    expect(sims[0].floorSec).toBeGreaterThan(RULES.floorSec);
    expect(sims[3].floorSec).toBeLessThan(RULES.floorSec);
  });

  it('harder levels hurt more at the same focus: harm taken and time to drive off the lion, measured', () => {
    const run = (d: DawidProgress['difficulty']) => {
      const qi = questsOf(0).findIndex(q => q.kind === 'guard');
      const sim = at(d, { seed: 6, progress: { quest: qi, level: 8 } });
      quiet(sim);
      sim.david.x = sim.guard.hx - 4;
      sim.david.y = sim.guard.hy;
      let harm = 0, last = sim.david.hp, tDriven = Infinity;
      drive(sim, 120, frame({ level: 0.95, activity: 6, focused: true, hold: 0, calm: 0.05 }), { t: 0 }, tt => {
        if (sim.david.hp < last) harm += last - sim.david.hp;
        if (sim.david.down > 0) { sim.david.down = 0; sim.david.hp = sim.david.max; }
        last = sim.david.hp;
        if (sim.story) sim.story = null;
        if (sim.mode === 'none') sim.hunt();
        if (tDriven === Infinity && (sim.guard.state === 'driven' || sim.guard.state === 'gone')) tDriven = tt;
      });
      return { harm: harm / sim.david.max, tDriven };
    };
    const r = DIFFICULTIES.map(run);
    expect(r[0].tDriven).toBeLessThan(r[1].tDriven);
    expect(r[1].tDriven).toBeLessThan(r[2].tDriven);
    expect(r[2].tDriven).toBeLessThan(r[3].tDriven);
    expect(r[0].harm).toBeLessThan(r[3].harm);
    expect(r[3].tDriven).toBeLessThan(120);   // hard but fair: a focused player still drives it off
  });

  it('a 40 s test session scores at every level, first session or later, on either band', () => {
    for (const d of DIFFICULTIES) for (const eeg of [false, true]) for (const prog of [{}, { sessions: 6, seen: SEEN }, { sessions: 6, seen: SEEN, land: 3, level: 30 }]) {
      const sim = makeSim({ planned: 40, seed: 3, eeg, tuning: BEGINNER, progress: { ...prog, difficulty: d } });
      const focus = new FocusInput(BEGINNER);
      let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0;
      for (let tt = 0; tt < 22; tt += STEP) {
        if ((hub += STEP) >= 0.1) { hub -= 0.1; f = focus.push(20 * (1 - Math.exp(-tt / 4)), true, 0.1); }
        sim.update(STEP, f, tt);
        if ((tap += STEP) >= 0.65) { tap -= 0.65; sim.steer(0, 0); sim.tap(sim.david.x, sim.david.y + 1); }
        if ((space += STEP) >= 2) { space -= 2; sim.key(' ', true); sim.key(' ', false); }
        sim.take();
      }
      expect(sim.result().score, `${d} eeg ${eeg} ${JSON.stringify(prog)}`).toBeGreaterThan(0);
    }
  });

  it('records per level (REGULAR keeps the old key); the summary names a level that is not REGULAR', () => {
    const h = at('hardcore', { planned: 180 });
    drive(h, 30, HIGH, { t: 0 }, () => { if (h.mode === 'none') h.hunt(); });
    const r = h.result();
    expect(h.p.best[recordKey('180', 'hardcore')]).toBe(h.score);
    expect(h.p.best['180']).toBeUndefined();
    expect(r.stats[0]).toEqual([t('stat.difficulty'), 'Hardcore']);
    expect(bestOf(h.p, 'hardcore')).toBe(h.score);
    expect(bestOf(h.p, 'regular')).toBeNull();
    const g = at('regular', { planned: 180, progress: { best: { 180: 5 } } });
    drive(g, 30, HIGH, { t: 0 }, () => { if (g.mode === 'none') g.hunt(); });
    g.result();
    expect(g.p.best['180']).toBe(Math.max(5, g.score));
  });

  it('the save keeps the level (absent or unknown: REGULAR); the lobby card opens with the four chips', () => {
    expect(migrate(mergeSaved(freshProgress(), { ver: 2, difficulty: 'nope' })).difficulty).toBe('regular');
    expect(migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 3 })).difficulty).toBe('regular');
    expect(migrate(mergeSaved(freshProgress(), { ver: 2, difficulty: 'advanced' })).difficulty).toBe('advanced');
    const p = { ...freshProgress(), sessions: 2 };
    let saved = 0;
    const el = dawid.progressPanel!(p, () => { saved++; });
    const chips = [...el.querySelectorAll('[data-difficulty]')] as HTMLButtonElement[];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(el.textContent).toContain(t('diff.regular'));
    chips[3].click();
    expect(p.difficulty).toBe('hardcore');
    expect(saved).toBe(1);
  });
});

describe('a round-5 save on the new road (version 1 → 2)', () => {
  it('keeps the land, the guardian’s wounds and the gate; never skips a companion not yet met', () => {
    const v1 = (o: Record<string, unknown>) => migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 9, ...o }));
    // in land 3 (Gibeah) at the guardian, wounded: still there
    const a = v1({ land: 3, quest: 5, wounds: 500, joined: ['asahel', 'abiszaj', 'jonatan'], wp: { proca: 5, luk: 1 } });
    expect(a.land).toBe(3);
    expect(questsOf(3)[a.quest].kind).toBe('guard');
    expect(a.wounds).toBe(500);
    // at the gate: still at the gate
    expect(questsOf(1)[v1({ land: 1, quest: 9, joined: ['asahel', 'abiszaj'] }).quest].kind).toBe('gate');
    // after Goliath, Jonathan's visit: still Jonathan
    const j = v1({ land: 2, quest: 7, joined: ['asahel', 'abiszaj'] });
    expect(questsOf(2)[j.quest].id).toBe('jonatan');
    // mid-chain in the pastures before Asahel: never past his visit
    const b = v1({ land: 0, quest: 9 });
    expect(b.quest).toBeLessThanOrEqual(questsOf(0).findIndex(q => q.id === 'asahel'));
    const c = v1({ land: 0, quest: 9, joined: ['asahel'], party: ['asahel'] });
    expect(c.quest).toBeGreaterThan(questsOf(0).findIndex(q => q.id === 'asahel'));
    expect(c.joined).toEqual(['asahel']);
    // a later circle keeps its index
    expect(v1({ land: 8, quest: 2 }).quest).toBe(2);
    // idempotent
    expect(migrate(structuredClone(c))).toEqual(c);
    // the game opens it at the chain's area
    const sim = new DawidSim({ progress: c, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.area).toBe(sim.quest!.area);
  });
});

/** David's health from the rules alone (REGULAR's). */
function statsOfHp(sim: DawidSim): number {
  return statsOf(sim.p, partyNow(sim.p)).hp;
}

describe('the story on a phone: the scene card, its answers and skip, the log, the minimap', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return fakeContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  function game(size: (typeof CHECK_SIZES)[number], progress: Partial<DawidProgress>, touch: boolean) {
    const env: GameEnv<DawidProgress> = {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress: { ...freshProgress(), ...progress }, rng: mulberry32(7), day: DAY, daySeed: 1, plannedSec: 300, tool: 'fnirs',
      simulated: true, reducedMotion: true, haptics: false, tuning: TUNING, hint: () => undefined,
      hudTop: () => size.insets.top, insets: () => size.insets, touch,
    };
    const g = dawid.create(env);
    g.resize(size.w, size.h, 1);
    g.start();
    const sim = (g as unknown as { sim: DawidSim }).sim;
    const frames = (n: number) => { for (let i = 0; i < n; i++) { g.update(STEP, frame(), sim.t + STEP); g.draw(); } };
    frames(5);
    return { g, sim, frames };
  }
  const tapAt = (g: ArcadeGame, r: { x: number; y: number; w: number; h: number }) => {
    const at = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    g.pointer!({ type: 'down', ...at, id: 1 });
    g.pointer!({ type: 'up', ...at, id: 1 });
    g.draw();
  };

  it('every control of a scene, a choice and the log is finger-sized and apart, at every size; the minimap opens the log', () => {
    for (const size of CHECK_SIZES) for (const touch of [true, false]) {
      const name = `${size.name}${touch ? '' : ' (mouse)'}`;
      // the first session: the chapter card, then the anointing scene
      const a = game(size, {}, touch);
      a.frames(40);
      a.g.pointer!({ type: 'down', x: size.w / 2, y: size.h / 2, id: 1 });
      a.g.pointer!({ type: 'up', x: size.w / 2, y: size.h / 2, id: 1 });
      a.frames(30);
      expect(a.sim.story?.kind, name).toBe('scene');
      const ts = a.g.targets!();
      expect(ts.map(x => x.label), name).toEqual(['story', 'skip']);
      expect(auditTargets(ts, size.w, size.h, size.insets), name).toEqual([]);
      tapAt(a.g, ts.find(x => x.label === 'skip')!);
      expect(a.sim.story, name).toBeNull();
      // a choice: the two answers and the skip
      const wi = QUESTS.pastwiska.findIndex(q => q.id === 'well');
      const b = game(size, { sessions: 5, pushes: 1, seen: [...SEEN, 'log'], quest: wi }, touch);
      quiet(b.sim);
      const well = b.sim.spot('well')!;
      b.sim.david.x = well.x;
      b.sim.david.y = well.y + 0.5;
      b.frames(20);
      for (let i = 0; i < 12 && b.sim.story && b.sim.story.i! < b.sim.story.lines!.length - 1; i++) { b.frames(25); b.sim.tap(); }
      b.frames(25);
      const cs = b.g.targets!();
      expect(cs.map(x => x.label), name).toEqual(['skip', 'choice a', 'choice b']);
      expect(auditTargets(cs, size.w, size.h, size.insets), name).toEqual([]);
      tapAt(b.g, cs.find(x => x.label === 'choice b')!);
      expect(b.sim.p.choices.well, name).toBe('b');
      b.sim.skipScene();
      b.frames(5);
      // the minimap is a control; it opens the log, a tap closes it
      const ms = b.g.targets!().find(x => x.label === 'mini');
      if (!ms) continue;   // a short screen has no minimap (and L opens the log)
      expect(auditTargets(b.g.targets!(), size.w, size.h, size.insets), name).toEqual([]);
      tapAt(b.g, ms);
      expect(b.sim.logOpen, name).toBe(true);
      b.frames(2);
      const ls = b.g.targets!();
      expect(ls.map(x => x.label), name).toEqual(['log']);
      expect(auditTargets(ls, size.w, size.h, size.insets), name).toEqual([]);
      tapAt(b.g, ls[0]);
      expect(b.sim.logOpen, name).toBe(false);
    }
  });

  it('never draws text under 11 px in a scene, a choice or the log', () => {
    FONT_LOG.clear();
    const size = CHECK_SIZES[0];
    const wi = QUESTS.pastwiska.findIndex(q => q.id === 'well');
    const b = game(size, { sessions: 5, pushes: 1, seen: SEEN, quest: wi }, true);
    quiet(b.sim);
    const well = b.sim.spot('well')!;
    b.sim.david.x = well.x;
    b.sim.david.y = well.y + 0.5;
    for (let i = 0; i < 14 && b.sim.story; i++) { b.frames(25); b.sim.tap(); }
    b.sim.toggleLog(true);
    b.frames(3);
    const sizes = [...FONT_LOG.values()];
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_TEXT);
  });
});
