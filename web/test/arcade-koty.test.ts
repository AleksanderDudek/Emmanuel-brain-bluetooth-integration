import { describe, expect, it } from 'vitest';
import {
  BOSSES, BOSS_IDS, CATS, FAMS, FAM_IDS, LINES, LINE_COUNT, MOMENTS, PERKS, PESTS, PLACES, big, perkCost, stageInfo, toyDps, toyHit,
} from '../src/arcade/koty/content';
import { CATALOGS, t, unit } from '../src/arcade/koty/i18n';
import {
  aimMult, buyPerk, canVintage, catEarned, freshProgress, holdVintage, joinCats, migrate, perks, sendTrip, shopGrade, slotCount, toggleWall,
  upCost, vintageGold, type KotyProgress,
} from '../src/arcade/koty/meta';
import { RULES } from '../src/arcade/koty/rules';
import { BOSS_TARGET, KotySim, bossCourage, courage, cushionX, finaleFor, planBlocks, starText, waveSize, type SimEvent } from '../src/arcade/koty/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, TAP_GAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { coachText, howto } from '../src/arcade/koty/index';
import { BUYS, cellRect, layout, tapTargets, wallRow } from '../src/arcade/koty/layout';
import { BADGE_MIN, fitFont, font, fontPx } from '../src/arcade/koty/paint';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-11';
const STEP = 1 / 60;
const NOW = Date.UTC(2026, 10, 11, 9, 0, 0);
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['squad', 'merge', 'merge2', 'equip', 'upgrade', 'eye', 'hunt', 'nap', 'boss', 'paw', 'target', 'pet', 'vintage', 'dusk', 'full'];

type SimOpts = { progress?: Partial<KotyProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; now?: number };

function makeSim(o: SimOpts = {}): KotySim {
  const sim = new KotySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, now: o.now ?? NOW,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: KotySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Run to the next block of a kind (returns the clock). */
function until(sim: KotySim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates Czujność and Drzemka, ending on a nap', () => {
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

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later({ planned: 300 });
    const b = sim.block;
    expect(b.kind).toBe('push');
    drive(sim, b.dur - 2, frame());
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('rest');
  });

  it('makes every 4th push blind (dusk) from the 3rd session, never the first of a session', () => {
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

describe('the field and the squad', () => {
  it('places the cushions on both sides of the gatehouse, inside the field', () => {
    for (let n = 1; n <= RULES.slotsMax; n++) {
      const xs = Array.from({ length: n }, (_, i) => cushionX(i, n));
      for (const x of xs) {
        expect(x).toBeGreaterThan(0.3);
        expect(x).toBeLessThan(RULES.FW - 0.3);
        expect(Math.abs(x - RULES.FW / 2)).toBeGreaterThan(0.8);
      }
      for (let i = 1; i < n; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('brings pests in a wave; the cats fire by themselves, chase them off and the brother pays in fish', () => {
    const sim = later();
    const evs = drive(sim, 25, frame());
    expect(ofType(evs, 'spawn').length).toBeGreaterThan(3);
    expect(ofType(evs, 'shot').length).toBeGreaterThan(10);
    const chased = ofType(evs, 'chased');
    expect(chased.length).toBeGreaterThan(2);
    expect(sim.score).toBe(chased.length);
    expect(sim.p.fish).toBeGreaterThan(0);
    expect(sim.p.notebook.liszka ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('clears a stage when its wave is chased off and moves on, opening cushions at the milestones', () => {
    const sim = later({ progress: { slots: [{ fam: 'proca', g: 6 }, { fam: 'proca', g: 6 }, null, null, null, null] } });
    const evs = drive(sim, 25, frame());
    const stages = ofType(evs, 'stage');
    expect(stages.length).toBeGreaterThanOrEqual(1);
    expect(sim.p.stage).toBeGreaterThanOrEqual(3);
    expect(slotCount(sim.p)).toBe(3);
    expect(ofType(evs, 'cushion').length).toBeGreaterThanOrEqual(1);
    // Kluska joins with the third cushion
    expect(sim.p.cats).toContain('kluska');
    expect(sim.cushions[2].cat).toBe('kluska');
  });

  it('grows a stage harder: more courage, more fish, bigger waves inside a place', () => {
    expect(courage(10, 'liszka')).toBeGreaterThan(courage(1, 'liszka') * 4);
    expect(waveSize(4)).toBeGreaterThan(waveSize(1));
    expect(waveSize(5)).toBe(RULES.bossWave);
    expect(stageInfo(5).boss).toBe(true);
    expect(stageInfo(6).place.id).toBe('spichlerz');
    expect(stageInfo(31).place.id).toBe('winnica');
    expect(stageInfo(31).round).toBe(1);
  });

  it('chooses the pest nearest the wall, or the player’s target; a tap on empty grass goes “psst!”', () => {
    const sim = later();
    drive(sim, 4, frame());
    const pe = sim.pests.find(x => x.state !== 'flee')!;
    expect(pe).toBeTruthy();
    expect(sim.aim(pe.x, pe.y)).toBe(true);
    expect(sim.target).toBe(pe.id);
    expect(sim.aim(-5, -5)).toBe(false);
    const before = pe.hp;
    const hit = sim.clap(pe.x + 0.3, pe.y);
    expect(hit).toBe(true);
    expect(pe.hp).toBeLessThan(before);
    // too soon after: nothing
    expect(sim.clap(pe.x, pe.y)).toBe(false);
  });

  it('pets a cat: it purrs and fires faster for a while, then needs a rest', () => {
    const sim = later();
    const c = sim.cushions[0];
    const pace = sim.paceOf(c);
    expect(sim.pet(0)).toBe(true);
    expect(sim.paceOf(c)).toBeCloseTo(pace * RULES.purrK, 5);
    expect(sim.pet(0)).toBe(false);
    drive(sim, RULES.petCool + 0.1, frame());
    expect(sim.pet(0)).toBe(true);
  });

  it('gives each toy family its own way of firing, all of a similar single-target strength', () => {
    const base = toyDps({ fam: 'proca', g: 1 });
    for (const f of FAM_IDS) {
      const d = toyDps({ fam: f, g: 1 });
      expect(d / base).toBeGreaterThan(0.75);
      expect(d / base).toBeLessThan(1.15);
    }
    expect(toyHit({ fam: 'proca', g: 2 }) / toyHit({ fam: 'proca', g: 1 })).toBeCloseTo(RULES.gradeK, 5);
    expect(new Set(FAM_IDS.map(f => FAMS[f].pattern)).size).toBe(FAM_IDS.length);
  });

  it('splashes, bounces and pierces: one shot moves several pests', () => {
    for (const fam of ['banki', 'klebek', 'sikawka', 'katapulta', 'konewka'] as const) {
      const sim = later({ seed: 7, progress: { slots: [{ fam, g: 1 }, null, null, null, null, null], squad: ['mruczek'] } });
      // a crowd in the middle of the field
      sim.pests.length = 0;
      for (let i = 0; i < 5; i++) {
        const pe = sim.spawnPest('mysz', false, 0, { x: 4.6 + i * 0.25, y: 6 + (i % 2) * 0.3 });
        pe.hp = pe.max = 1000;
        pe.state = 'nibble';
        pe.tx = pe.x; pe.ty = pe.y;
      }
      sim.wave = { all: 0, spawned: 0, chased: 0 };
      const evs = drive(sim, 3, frame());
      const hitIds = new Set(sim.pests.filter(x => x.hp < x.max).map(x => x.id));
      expect(hitIds.size, fam).toBeGreaterThanOrEqual(2);
      expect(ofType(evs, 'hit').length, fam).toBeGreaterThan(2);
    }
  });
});

describe('toys: the chest, the merge, the cushions', () => {
  it('merges two toys of a grade into one random toy of the next grade, where it was dropped', () => {
    const sim = later();
    sim.p.chest = Array.from({ length: RULES.chest }, () => null);
    sim.p.chest[0] = { fam: 'proca', g: 2 };
    sim.p.chest[1] = { fam: 'banki', g: 2 };
    expect(sim.drop({ kind: 'chest', i: 0 }, { kind: 'chest', i: 1 })).toBe(true);
    expect(sim.p.chest[0]).toBeNull();
    expect(sim.p.chest[1]!.g).toBe(3);
    expect(sim.merges).toBe(1);
    expect(sim.p.toyBook[sim.p.chest[1]!.fam]).toBeGreaterThanOrEqual(3);
  });

  it('swaps toys of different grades, moves onto an empty place, and hands a toy to a cat (its old one comes back)', () => {
    const sim = later();
    sim.p.chest = Array.from({ length: RULES.chest }, () => null);
    sim.p.chest[0] = { fam: 'konewka', g: 3 };
    const old = sim.p.slots[0]!;
    expect(sim.drop({ kind: 'chest', i: 0 }, { kind: 'slot', i: 0 })).toBe(true);
    expect(sim.p.slots[0]).toEqual({ fam: 'konewka', g: 3 });
    expect(sim.p.chest[0]).toEqual(old);
    expect(sim.cushions[0].toy).toEqual({ fam: 'konewka', g: 3 });
    expect(sim.drop({ kind: 'chest', i: 0 }, { kind: 'chest', i: 5 })).toBe(true);
    expect(sim.p.chest[5]).toEqual(old);
    // a closed cushion takes nothing
    expect(sim.drop({ kind: 'chest', i: 5 }, { kind: 'slot', i: 5 })).toBe(false);
  });

  it('never merges past the top grade (it swaps)', () => {
    const sim = later();
    sim.p.chest = Array.from({ length: RULES.chest }, () => null);
    sim.p.chest[0] = { fam: 'proca', g: RULES.grades };
    sim.p.chest[1] = { fam: 'banki', g: RULES.grades };
    sim.drop({ kind: 'chest', i: 0 }, { kind: 'chest', i: 1 });
    expect(sim.p.chest[0]).toEqual({ fam: 'banki', g: RULES.grades });
    expect(sim.merges).toBe(0);
  });

  it('a tap on a toy merges it with its mate, else hands it to the weakest cat when it is better', () => {
    const sim = later();
    sim.p.chest = Array.from({ length: RULES.chest }, () => null);
    sim.p.chest[3] = { fam: 'proca', g: 1 };
    // the mate sits on a cushion: the merge lands there
    expect(sim.p.slots[0]!.g).toBe(1);
    expect(sim.autoPlace({ kind: 'chest', i: 3 })).toBe(true);
    expect(sim.p.chest[3]).toBeNull();
    expect(sim.p.slots.filter(x => x && x.g === 2).length).toBe(1);
    sim.p.chest[4] = { fam: 'lusterko', g: 4 };
    expect(sim.autoPlace({ kind: 'chest', i: 4 })).toBe(true);
    expect(sim.p.slots.some(x => x?.g === 4)).toBe(true);
  });

  it('the helping paw merges the first pair, then hands out the best toy, then buys the cheapest', () => {
    const sim = later();
    sim.p.chest = Array.from({ length: RULES.chest }, () => null);
    sim.p.slots = [{ fam: 'proca', g: 2 }, { fam: 'proca', g: 3 }, null, null, null, null];
    sim.p.chest[0] = { fam: 'banki', g: 1 };
    sim.p.chest[1] = { fam: 'banki', g: 1 };
    expect(sim.paw()).toBe('merge');
    // now a grade-2 in the chest and one on a cushion: that pair merges onto the cushion
    expect(sim.paw()).toBe('merge');
    expect(sim.p.slots[0]!.g === 3 || sim.p.slots[1]!.g === 3).toBe(true);
    sim.p.fish = 0;
    sim.p.chest[2] = { fam: 'konewka', g: 1 };
    sim.p.slots = [{ fam: 'proca', g: 5 }, { fam: 'proca', g: 6 }, null, null, null, null];
    expect(sim.paw()).toBe(null);
    sim.p.fish = 1e6;
    expect(sim.paw()).toBe('buy');
  });

  it('the helping paw never leaves a cat empty-pawed: a cat without a toy is armed first, two cushions merge only with a spare', () => {
    const sim = later();
    sim.p.fish = 0;
    sim.p.chest = Array.from({ length: RULES.chest }, () => null);
    sim.p.slots = [{ fam: 'proca', g: 2 }, { fam: 'banki', g: 2 }, null, null, null, null];
    expect(sim.paw()).toBe(null);
    expect(sim.p.slots[0]).toBeTruthy();
    expect(sim.p.slots[1]).toBeTruthy();
    sim.p.chest[4] = { fam: 'lusterko', g: 1 };
    expect(sim.paw()).toBe('merge');
    const empty = sim.p.slots.slice(0, 2).findIndex(x => !x);
    expect(empty).toBeGreaterThanOrEqual(0);
    expect(sim.paw()).toBe('equip');
    expect(sim.p.slots[empty]).toEqual({ fam: 'lusterko', g: 1 });
  });

  it('arms a new cat with a toy from the trunk when its cushion opens', () => {
    const sim = later({ progress: { stage: 2, bestStage: 2, slots: [{ fam: 'proca', g: 6 }, { fam: 'proca', g: 6 }, null, null, null, null] } });
    drive(sim, 25, frame());
    expect(sim.p.stage).toBeGreaterThanOrEqual(3);
    expect(sim.cushions[2].cat).toBe('kluska');
    expect(sim.cushions[2].toy).toBeTruthy();
  });

  it('a tap on the eye before the hunt is ready goes “psst!” at the pest nearest the wall', () => {
    const sim = later();
    drive(sim, 5, frame());
    const near = sim.pests.filter(p => p.state !== 'flee').sort((a, b) => b.y - a.y)[0];
    expect(near).toBeTruthy();
    const hp = near.hp;
    expect(sim.releaseHunt()).toBe(false);
    expect(sim.clapNearest()).toBe(true);
    expect(near.hp < hp || near.state === 'flee').toBe(true);
  });

  it('buys upgrades and toys along the bottom: the price climbs, the bowl pays, the full chest refuses a toy', () => {
    const sim = later();
    sim.p.fish = 0;
    expect(sim.buy('aim')).toBe(false);
    sim.p.fish = 1e4;
    const c0 = upCost('aim', 0)!;
    expect(sim.buy('aim')).toBe(true);
    expect(sim.p.up.aim).toBe(1);
    expect(sim.p.fish).toBeCloseTo(1e4 - c0, 5);
    expect(upCost('aim', 1)!).toBeGreaterThan(c0);
    expect(aimMult(25)).toBeCloseTo((1 + 2.5) * 2, 5);
    sim.p.chest = Array.from({ length: RULES.chest }, () => ({ fam: 'proca' as const, g: 1 }));
    expect(sim.buy('toy')).toBe(false);
    sim.p.chest[9] = null;
    expect(sim.buy('toy')).toBe(true);
    expect(sim.p.chest[9]!.g).toBe(shopGrade(sim.p));
    expect(upCost('paws', RULES.paws.max)).toBeNull();
  });

  it('lets gifts wait for room when the chest is full, and drops them in when a pair is merged', () => {
    const sim = later();
    sim.p.chest = Array.from({ length: RULES.chest }, (_, i) => ({ fam: 'proca' as const, g: 1 + (i % 5) }));
    sim.give({ fam: 'banki', g: 2 }, 'nap');
    expect(sim.gifts.length).toBe(1);
    expect(sim.paw()).toBe('merge');
    expect(sim.gifts.length).toBe(0);
    expect(sim.p.chest.some(x => x?.fam === 'banki' && x.g === 2)).toBe(true);
  });
});

describe('the band: alertness, the Great Hunt, the nap, dusk', () => {
  it('drives the squad’s pace ×1…×3 with focus in a sighted push past its lead-in, and the eyes turn gold', () => {
    const sim = later();
    expect(sim.block.kind).toBe('push');
    drive(sim, RULES.leadIn.fnirs - 0.5, HIGH);
    expect(sim.alert).toBeCloseTo(1, 5);
    drive(sim, 4, HIGH);
    expect(sim.alert).toBeGreaterThan(2.6);
    expect(sim.alert).toBeLessThanOrEqual(3 + 1e-9);
    expect(sim.golden).toBe(true);
    expect(sim.meter()).toBeGreaterThan(0.85);
    drive(sim, 3, MID);
    expect(sim.alert).toBeCloseTo(2, 1);
  });

  it('freezes at neutral without a signal: ×1, no gauge, never a loss', () => {
    const sim = later();
    drive(sim, 10, HIGH);
    drive(sim, 4, NONE);
    expect(sim.alert).toBeLessThan(1.1);
    expect(sim.meter()).toBeNull();
    expect(sim.golden).toBe(false);
  });

  it('fills the Great Hunt from a held focus; Space releases it and the cats pounce, chasing pests', () => {
    const sim = later();
    const clock = { t: 0 };
    let evs = drive(sim, 14, HIGH, clock);
    if (!sim.huntReady) evs = evs.concat(drive(sim, 8, HIGH, clock));
    expect(sim.huntReady || ofType(evs, 'hunt').length > 0).toBe(true);
    if (sim.huntReady) {
      expect(sim.key(' ', true)).toBe(true);
      evs = drive(sim, 2, HIGH, clock);
    } else evs = evs.concat(drive(sim, 1, HIGH, clock));
    expect(sim.hunts).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'pounce').length).toBeGreaterThan(0);
  });

  it('releases a ready hunt by itself after a while', () => {
    const sim = later();
    sim.charge = 0.999;
    // ready once alertness wakes (past the lead-in), then it waits RULES.huntAuto for a tap
    drive(sim, RULES.leadIn.fnirs + 0.5, HIGH);
    expect(sim.huntReady).toBe(true);
    drive(sim, RULES.huntAuto + 0.2, HIGH);
    expect(sim.hunts).toBeGreaterThanOrEqual(1);
  });

  it('naps in a rest block: no new pests, the cats rest, calm ripens fish and the nap ends with a toy', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    const shotsBefore = sim.shots.length;
    const fish0 = sim.p.fish;
    const spawns = ofType(drive(sim, 6, CALM, clock), 'spawn');
    expect(spawns.length).toBe(0);
    expect(sim.napK).toBeGreaterThan(0.9);
    expect(sim.shots.length).toBeLessThanOrEqual(shotsBefore);
    expect(sim.meter()).toBeGreaterThan(0.6);
    drive(sim, 8, CALM, clock);
    expect(sim.p.fish).toBeGreaterThan(fish0);
    const toyEvs = ofType(drive(sim, sim.block.dur - sim.blockT + 0.1, CALM, clock), 'napEnd');
    expect(toyEvs.length).toBe(1);
    expect(toyEvs[0].toy!.g).toBeGreaterThanOrEqual(shopGrade(sim.p));
  });

  it('ripens a little in a nap even without a signal (the base), more with calm', () => {
    const a = later(), b = later();
    const ca = until(a, 'rest', MID), cb = until(b, 'rest', MID);
    const fa = a.p.fish, fb = b.p.fish;
    drive(a, 12, NONE, ca);
    drive(b, 12, CALM, cb);
    expect(a.p.fish - fa).toBeGreaterThan(0);
    expect(b.p.fish - fb).toBeGreaterThan((a.p.fish - fa) * 1.8);
  });

  it('dusk: the gauge hides, the squad stays ×1, and the end tells the share and fills the hunt', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, MID, clock);
    drive(sim, sim.block.dur + 0.05, MID, clock);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    drive(sim, 8, HIGH, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.alert).toBeCloseTo(1, 5);
    const ch = sim.charge;
    const evs = drive(sim, sim.block.dur - sim.blockT + 0.1, HIGH, clock);
    const dusk = ofType(evs, 'dusk');
    expect(dusk.length).toBe(1);
    expect(dusk[0].share).toBeGreaterThan(0.5);
    expect(sim.charge > ch || sim.huntReady || sim.hunts > 0).toBe(true);
  });

  it('judges each block once at its end, from its last 15 s', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = drive(sim, sim.block.dur + 0.1, HIGH, clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBe(1);
    expect(ends[0].verdict).toBe(true);
  });
});

describe('the chiefs', () => {
  const bossReady = (o: SimOpts = {}) => later({
    ...o, progress: {
      stage: 5, bestStage: 5, slots: [{ fam: 'proca', g: 9 }, { fam: 'proca', g: 9 }, { fam: 'lusterko', g: 9 }, null, null, null],
      squad: ['mruczek', 'rudy', 'kluska'], cats: ['mruczek', 'rudy', 'kluska'], ...o.progress,
    },
  });

  it('comes after the boss stage’s short wave, and chased off he opens the next place, a story card and a new cat', () => {
    const sim = bossReady();
    const clock = { t: 0 };
    const evs = drive(sim, 30, MID, clock, () => { if (sim.story) sim.tap(); });
    expect(ofType(evs, 'boss').length).toBeGreaterThanOrEqual(1);
    const ch = ofType(evs, 'bossChased');
    expect(ch.length).toBe(1);
    expect(ch[0].first).toBe(true);
    expect(sim.p.bosses.lis).toBe(1);
    expect(sim.p.stage).toBeGreaterThanOrEqual(6);
    expect(stageInfo(sim.p.stage).place.id).toBe('spichlerz');
    expect(ofType(evs, 'story').some(e => e.kind === 'place')).toBe(true);
    expect(sim.p.cats).toContain('psotka');
    expect(sim.score).toBeGreaterThanOrEqual(5);
    // a strong squad chases him at his first visit with patience to spare: three stars for the vineyard
    expect(ch[0].stars).toBe(3);
    expect(sim.p.stars.winnica).toBe(3);
    expect(starText(2)).toBe('★★☆');
  });

  it('loses patience when the squad is too weak: he backs off, a few pests come, then he is back (nothing lost)', () => {
    const sim = later({ progress: { stage: 5, bestStage: 5, slots: [{ fam: 'proca', g: 1 }, null, null, null, null, null], squad: ['mruczek'] } });
    const clock = { t: 0 };
    let evs: SimEvent[] = [];
    for (let i = 0; i < 12 && !ofType(evs, 'bossBacks').length; i++) evs = evs.concat(drive(sim, 10, frame({ level: 0.2 }), clock));
    expect(ofType(evs, 'bossBacks').length).toBe(1);
    const stage = sim.p.stage;
    evs = [];
    for (let i = 0; i < 12 && ofType(evs, 'boss').length === 0; i++) evs = evs.concat(drive(sim, 10, frame({ level: 0.2 }), clock));
    expect(ofType(evs, 'boss').length).toBeGreaterThanOrEqual(1);
    expect(sim.p.stage).toBe(stage);
    expect(sim.boss!.visits).toBeGreaterThanOrEqual(2);
  });

  it('pauses his patience while everyone naps', () => {
    const sim = bossReady({ progress: { slots: [{ fam: 'proca', g: 1 }, null, null, null, null, null], squad: ['mruczek'] } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.boss && guard++ < 400) drive(sim, 0.25, MID, clock);
    expect(sim.boss).toBeTruthy();
    until(sim, 'rest', MID, clock);
    drive(sim, 1, CALM, clock);
    const pat = sim.boss!.patience;
    drive(sim, 6, CALM, clock);
    expect(sim.boss!.patience).toBeCloseTo(pat, 5);
  });

  it('has a courage that grows with the place, and every chief a trick of his own', () => {
    expect(bossCourage(10, 'krol')).toBeGreaterThan(bossCourage(5, 'lis') * 2);
    expect(new Set(BOSS_IDS.map(id => BOSSES[id].trick)).size).toBe(BOSS_IDS.length);
    for (const pl of PLACES) expect(BOSSES[pl.boss].place).toBe(pl.id);
  });

  it('can be the squad’s target', () => {
    const sim = bossReady({ progress: { slots: [{ fam: 'proca', g: 1 }, null, null, null, null, null], squad: ['mruczek'] } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.bossHere && guard++ < 400) drive(sim, 0.25, frame(), clock);
    const b = sim.boss!;
    expect(sim.aim(b.x, b.y)).toBe(true);
    expect(sim.target).toBe(BOSS_TARGET);
  });
});

describe('the meta: cats, the vintage, offline', () => {
  it('opens cushions at the furthest stage’s milestones and lets cats join by their milestones', () => {
    const p = freshProgress();
    expect(slotCount(p)).toBe(2);
    p.bestStage = 16;
    expect(slotCount(p)).toBe(6);
    expect(catEarned(p, 'kluska')).toBe(true);
    expect(catEarned(p, 'psotka')).toBe(false);
    p.bosses.lis = 1;
    expect(joinCats(p)).toEqual(['kluska', 'psotka']);
    expect(p.squad).toEqual(['mruczek', 'rudy', 'kluska', 'psotka']);
    toggleWall(p, 'rudy');
    expect(p.squad).not.toContain('rudy');
    toggleWall(p, 'rudy');
    expect(p.squad).toContain('rudy');
  });

  it('holds the vintage once the year has come round: golden fish, the year starts over, toys and cats stay', () => {
    const p = freshProgress();
    p.stage = RULES.vintageFrom - 1;
    expect(canVintage(p)).toBe(false);
    expect(holdVintage(p)).toBe(0);
    p.stage = 36;
    p.yearBest = 36;
    p.fish = 5000;
    p.up = { aim: 12, paws: 5, bowl: 7 };
    p.slots[0] = { fam: 'banki', g: 7 };
    const gold = holdVintage(p);
    expect(gold).toBe(vintageGold(36));
    expect(gold).toBeGreaterThan(5);
    expect(p.stage).toBe(1);
    expect(p.fish).toBe(0);
    expect(p.up).toEqual({ aim: 0, paws: 0, bowl: 0 });
    expect(p.slots[0]).toEqual({ fam: 'banki', g: 7 });
    expect(p.years).toBe(1);
    expect(joinCats(p)).toContain('mila');
    expect(buyPerk(p, 'skrot')).toBe(true);
    expect(perks(p).start).toBe(3);
  });

  it('asks before the vintage; a yes empties the field and starts the year over in the session', () => {
    const sim = later({ progress: { stage: 32, yearBest: 32, bestStage: 32 } });
    drive(sim, 3, frame());
    expect(sim.askVintage()).toBe(true);
    expect(sim.confirm).toBeTruthy();
    sim.answerVintage(true);
    expect(sim.p.stage).toBe(1);
    expect(sim.p.gold).toBeGreaterThan(0);
    expect(sim.vintageGold).toBeGreaterThan(0);
    expect(sim.story?.kind).toBe('year');
  });

  it('sends a kitchen cat on a trip; it comes back at the next session with fish and a toy (never a wall cat)', () => {
    const p = freshProgress();
    p.bestStage = 16;
    p.bosses = { lis: 1, krol: 1, hrabina: 1, kret: 1 };
    joinCats(p);
    expect(p.cats.length).toBeGreaterThan(slotCount(p));
    const kitchen = p.cats.find(c => !p.squad.slice(0, slotCount(p)).includes(c))!;
    expect(sendTrip(p, 'mruczek')).toBe(false);
    expect(sendTrip(p, kitchen)).toBe(true);
    expect(sendTrip(p, kitchen)).toBe(false);
    toggleWall(p, kitchen);
    expect(p.squad).not.toContain(kitchen);
    const chest = p.chest.filter(Boolean).length;
    const sim = new KotySim({ progress: p, rng: mulberry32(5), day: DAY, daySeed: 1, plannedSec: 180, eeg: false, tuning: TUNING, now: NOW });
    sim.start();
    expect(p.trips).toEqual([]);
    expect(sim.tripBack).toEqual([kitchen]);
    expect(p.chest.filter(Boolean).length).toBe(chest + 1);
    expect(p.fish).toBeGreaterThan(0);
    expect(['trip', 'open', 'away']).toContain(sim.story?.kind);
  });

  it('prices the perks and stops them at their top', () => {
    for (const k of PERKS) {
      expect(perkCost(k.id, 0)).toBeGreaterThan(0);
      expect(perkCost(k.id, k.max)).toBeNull();
    }
  });

  it('pays the watch kept while away: modest, capped, with a toy after an hour', () => {
    const p: Partial<KotyProgress> = { sessions: 3, lastSeen: NOW - 3 * 3600_000, seen: [...ALL_SEEN] };
    const sim = makeSim({ progress: p });
    expect(sim.story?.kind).toBe('away');
    expect(sim.awayFish).toBeGreaterThan(0);
    const long = makeSim({ progress: { ...p, lastSeen: NOW - 300 * 3600_000 } });
    const cap = makeSim({ progress: { ...p, lastSeen: NOW - RULES.awayCapH * 3600_000 } });
    expect(long.awayFish).toBe(cap.awayFish);
    // never more than a share of what fighting would have brought
    expect(cap.awayFish).toBeLessThanOrEqual(cap.fightIncome() * RULES.awayCapH * 3600 * RULES.awayShare + 1);
    expect(long.p.chest.filter(Boolean).length).toBeGreaterThan(freshProgress().chest.filter(Boolean).length);
    const soon = makeSim({ progress: { ...p, lastSeen: NOW - 30_000 } });
    expect(soon.awayFish).toBe(0);
    expect(soon.story).toBeNull();
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER });
    let next = 0.65, space = 2;
    const clock = { t: 0 };
    drive(sim, 22, HIGH, clock, t => {
      if (t >= next) {
        next += 0.65;
        if (!sim.tap()) sim.clap(5, 6);
      }
      if (t >= space) {
        space += 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
    });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.score).toBeGreaterThan(3);
  });

  it('scores within 22 s with no input at all (the squad fires by itself; the opening card closes by itself)', () => {
    const sim = makeSim();
    drive(sim, 22, HIGH);
    expect(sim.score).toBeGreaterThan(0);
  });

  it('opens the first session with the story card and the root verse, and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story?.kind).toBe('open');
    expect(sim.block.kind).toBe('warmup');
    const clock = { t: 0 };
    const evs = drive(sim, 40, MID, clock, () => { if (sim.story && sim.story.t > 1) sim.tap(); });
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('squad');
    expect(coach).toContain('merge');
  });

  it('gives result() idempotently and the record only with Math.max', () => {
    const sim = later();
    drive(sim, 30, HIGH);
    const a = sim.result();
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best[String(300)]).toBe(a.score);
    const total = sim.p.total;
    sim.result();
    expect(sim.p.total).toBe(total);
  });

  it('settles once at the end (or early) and remembers when it ended', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 46, MID, clock);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.lastSeen).toBeGreaterThan(NOW);
    const early = later({ planned: 300 });
    drive(early, 20, MID);
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('closes with a passage that exists, fitting what happened', () => {
    const sim = later();
    drive(sim, 20, HIGH);
    const r = sim.result();
    expect(r.verse).toBeTruthy();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    for (const id of ['sng2.15', 'pro27.18', 'pro6.6-8', 'isa11.6', 'pro12.10', 'mat6.26', 'job12.7'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    expect(makeSim().closingVerse()).toBe('sng2.15');
  });

  it('says what the headline means and keeps the stats readable', () => {
    const sim = later();
    drive(sim, 20, HIGH);
    const r = sim.result();
    expect(r.unit).toBe(unit(r.score));
    expect(r.stats.length).toBeGreaterThanOrEqual(6);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
  });

  it('keeps the progress pace in a fair band over a week of 5-minute sessions (simulated play)', () => {
    // a plain policy: the helping paw every 2 s, focus that comes and goes
    let p = freshProgress();
    const stages: number[] = [];
    for (let s = 0; s < 7; s++) {
      const sim = new KotySim({ progress: p, rng: mulberry32(11 + s), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING, now: NOW + s * 86400_000 });
      sim.start();
      let paw = 2;
      const clock = { t: 0 };
      drive(sim, 304, t => (Math.floor(t / 13) % 2 ? MID : HIGH), clock, t => {
        if (sim.story) sim.tap();
        if (t >= paw) {
          paw += 2;
          sim.paw();
          if (sim.huntReady) sim.releaseHunt();
        }
      });
      sim.result();
      p = sim.p;
      stages.push(p.stage);
    }
    // the first session reaches the first chief, the week opens the vintage, and nothing runs away
    expect(stages[0]).toBeGreaterThanOrEqual(6);
    expect(stages[0]).toBeLessThanOrEqual(26);
    expect(stages[6]).toBeGreaterThanOrEqual(RULES.vintageFrom);
    expect(stages[6]).toBeLessThanOrEqual(80);
    // and it slows down: the last session gains less than the first
    expect(stages[6] - stages[5]).toBeLessThan(stages[0]);
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ sessions: n }) and starts the watch fresh, keeping the count', () => {
    const p = mergeSaved(freshProgress(), { sessions: 4 }) as KotyProgress;
    migrate(p);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.stage).toBe(1);
    expect(p.slots.filter(Boolean).length).toBe(2);
    expect(migrate(p)).toBe(p);
  });

  it('keeps a realistic version-1 save and repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, stage: 23, fish: 123456.7, up: { aim: 31, paws: 'x', bowl: 12 }, bought: 41,
      slots: [{ fam: 'banki', g: 7 }, { fam: 'nope', g: 3 }, { fam: 'proca', g: 99 }, null, 'junk', null],
      chest: [{ fam: 'proca', g: 2 }, null, null], yearBest: 24, cats: ['mruczek', 'rudy', 'kluska', 'ghost'], squad: ['kluska', 'rudy', 'ghost'],
      gold: 12, goldTotal: 30, perks: { oczy: 3, kufer: 'no' }, years: 2, bestStage: 31, bosses: { lis: 3, krol: 2 }, notebook: { liszka: 300 },
      toyBook: { banki: 7 }, bestGrade: 7, hunts: 9, merges: 120, total: 2400, best: { '300': 180 }, lastLen: 300, lastSeen: NOW - 7200_000,
      seen: ['merge', 3],
    };
    const p = mergeSaved(freshProgress(), saved) as KotyProgress;
    migrate(p);
    expect(p.stage).toBe(23);
    expect(p.up).toEqual({ aim: 31, paws: 0, bowl: 12 });
    expect(p.slots[0]).toEqual({ fam: 'banki', g: 7 });
    expect(p.slots[1]).toBeNull();
    expect(p.slots[2]).toEqual({ fam: 'proca', g: RULES.grades });
    expect(p.slots[4]).toBeNull();
    expect(p.slots.length).toBe(RULES.slotsMax);
    expect(p.chest.length).toBe(RULES.chest);
    expect(p.cats).not.toContain('ghost');
    expect(p.squad).toEqual(['kluska', 'rudy']);
    expect(p.perks).toEqual({ oczy: 3 });
    expect(p.seen).toEqual(['merge']);
    expect(p.bestGrade).toBe(RULES.grades);
    // and it plays
    const sim = new KotySim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 180, eeg: true, tuning: TUNING, now: NOW });
    sim.start();
    expect(sim.story?.kind).toBe('away');
    drive(sim, 10, MID, { t: 0 }, () => { if (sim.story) sim.tap(); });
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, slots: 'x', chest: 5, cats: null, best: [] }]) {
      const p = mergeSaved(freshProgress(), junk) as KotyProgress;
      migrate(p);
      expect(p.ver).toBe(1);
      expect(Array.isArray(p.slots)).toBe(true);
      expect(p.cats.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Brother Anselm at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
    expect(LINE_COUNT).toBeGreaterThan(70);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps Polish letters and Polish words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
  });

  it('suggests strategies, never to concentrate harder', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip|howto)\./.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
  });

  it('bends the headline’s unit and writes big numbers', () => {
    expect(unit(1)).toBe('szkodnik');
    expect(unit(3)).toBe('szkodniki');
    expect(unit(5)).toBe('szkodników');
    expect(t('pests', { n: 22 })).toBe('22 szkodniki');
    expect(big(950)).toBe('950');
    expect(big(1250)).toBe('1,25K');
    expect(big(125_000)).toBe('125K');
    expect(big(3.4e12)).toBe('3,40T');
    expect(big(5e15)).toBe('5,00aa');
  });

  it('covers every pest, chief, cat and place with names', () => {
    for (const id of Object.keys(PESTS)) expect(t(`pest.${id}` as never)).not.toMatch(/^pest\./);
    for (const id of BOSS_IDS) expect(t(`boss.${id}` as never)).not.toMatch(/^boss\./);
    for (const c of CATS) {
      expect(t(`cat.${c.id}` as never)).not.toMatch(/^cat\./);
      expect(t(`cat.${c.id}.bio` as never).length).toBeGreaterThan(20);
    }
    for (const pl of PLACES) expect(t(`place.${pl.id}` as never)).not.toMatch(/^place\./);
  });
});

/** The size in a canvas font string. */
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);

/** A canvas context that measures text as 0.6 em per character (enough to test fitting). */
function measuring(): CanvasRenderingContext2D {
  const ctx = { font: '10px sans-serif', measureText(text: string) { return { width: text.length * pxOf(this.font) * 0.6 } as TextMetrics; } };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('mobile first (DESIGN §11.9, §12)', () => {
  it('gives every control a finger-sized target inside the insets, clear of the others, at every checked size and state', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (let n = 1; n <= RULES.slotsMax; n++) {
        for (const vintage of [false, true]) {
          const ts = tapTargets(L, { slots: n, vintage, card: null });
          expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: ${n} cushions${vintage ? ', the vintage' : ''}`).toEqual([]);
          expect(ts.length).toBe(RULES.chest + n + 1 + BUYS.length + 1 + (vintage ? 1 : 0));
        }
      }
      // under a card: a story takes any tap on it, the vintage's question has two answers (on a card of any height)
      expect(auditTargets(tapTargets(L, { slots: 6, vintage: true, card: 'story' }), c.w, c.h, c.insets), `${c.name}: a story`).toEqual([]);
      for (const h of [L.card.h, 230, 180]) {
        const box = { ...L.card, y: L.anchor === 'bottom' ? L.card.y + L.card.h - h : L.card.y + (L.card.h - h) / 2, h };
        const ts = tapTargets(L, { slots: 6, vintage: true, card: 'confirm', cardBox: box });
        expect(ts.map(x => x.label)).toEqual(['vintage: yes', 'vintage: no']);
        expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: the vintage's question, ${h} px`).toEqual([]);
      }
    }
  });

  it('puts the chest and the buttons in the thumb zone of a phone upright: big cells, tall buttons, off the edges, no empty band', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode, c.name).toBe('tall');
      expect(L.u).toBeLessThan(1.1);
      expect(L.cell, c.name).toBeGreaterThanOrEqual(56);
      const zone = c.h * (1 - THUMB);
      for (let i = 0; i < RULES.chest; i++) expect(cellRect(L, i).y, `${c.name}: cell ${i}`).toBeGreaterThanOrEqual(zone);
      for (const r of [...BUYS.map(id => L.ups[id]), L.paw]) {
        expect(r.h).toBeGreaterThanOrEqual(48);
        expect(r.y).toBeGreaterThanOrEqual(zone);
        expect(r.x).toBeGreaterThanOrEqual(c.insets.left + 16 - 0.01);
        expect(r.x + r.w).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
      }
      // the buttons sit on the bottom (over the home indicator), the chest right above them, the field takes the rest
      expect(c.h - c.insets.bottom - (L.paw.y + L.paw.h)).toBeLessThanOrEqual(10);
      expect(L.ups.aim.y - (L.chest.y + L.chest.h)).toBeLessThanOrEqual(12);
      expect(L.field.y).toBe(c.insets.top);
      expect(L.field.h, c.name).toBeGreaterThanOrEqual(110);
      // the bar and the brother stay under the HUD, the field's top is the bar's
      expect(L.bar.y).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.brother.y - L.brother.r).toBeGreaterThanOrEqual(L.bar.y + L.bar.h);
    }
  });

  it('keeps six cats and the eye apart on the narrowest wall: every cat at least 44 px wide, 6 px between them', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (let n = 1; n <= RULES.slotsMax; n++) {
        const row = wallRow(L, n);
        expect(row.x).toHaveLength(n);
        const boxes = [...row.hit, ...(row.eye ? [row.eye] : [])].sort((a, b) => a.x - b.x);
        for (const b of boxes) expect(b.w, `${c.name}: ${n}`).toBeGreaterThanOrEqual(MIN_TAP);
        for (let i = 1; i < boxes.length; i++) expect(boxes[i].x - (boxes[i - 1].x + boxes[i - 1].w), `${c.name}: ${n}`).toBeGreaterThanOrEqual(TAP_GAP - 0.01);
        // the cats read left to right, the left group left of the eye
        for (let i = 1; i < n; i++) expect(row.x[i]).toBeGreaterThan(row.x[i - 1]);
        expect(row.x[Math.ceil(n / 2) - 1]).toBeLessThan(L.eye.x);
        expect(row.eye, c.name).not.toBeNull();
      }
    }
  });

  it('lays a phone on its side out in three columns: the chest under the left thumb, the field, the buttons under the right', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode).toBe('short');
      expect(L.cols * L.rows).toBe(RULES.chest);
      expect(L.chest.x + L.chest.w).toBeLessThan(L.field.x);
      for (const r of [...BUYS.map(id => L.ups[id]), L.paw]) {
        expect(r.x).toBeGreaterThan(L.field.x + L.field.w);
        expect(r.h).toBeGreaterThanOrEqual(MIN_TAP + 4);
        expect(r.y).toBeGreaterThanOrEqual(c.insets.top);
      }
      expect(L.chest.y).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.field.w).toBeGreaterThan(c.w * 0.5);
      expect(L.field.h).toBeGreaterThan(200);
    }
  });

  it('grows on a tablet and a desktop, never past 1.3', () => {
    for (const c of CHECK_SIZES.filter(x => Math.min(x.w, x.h) > 600)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.u).toBeGreaterThan(1);
      expect(L.u).toBeLessThanOrEqual(1.3);
      expect(L.cell).toBeGreaterThanOrEqual(56);
      expect(L.rich).toBe(true);
    }
  });

  it('never draws text under 11 px: the font helper has a floor, fitting never shrinks under it, badges hold their number', () => {
    for (const px of [0, 3, 6.4, 8, 10.4, 10.99, 11, 12.3, 13, 30]) expect(pxOf(font(px))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fontPx(4)).toBe(MIN_TEXT);
    expect(pxOf(font(14.2, 800, true))).toBe(14);
    const ctx = measuring();
    expect(fitFont(ctx, 'Zwinne łapy · poz. 12', 20, 14, 6)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fitFont(ctx, 'Łapa', 200, 13, 11)).toBe(13);
    expect(BADGE_MIN * 1.15).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(MIN_READ).toBe(13);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['howto.goal', 'howto.drag', 'howto.tap', 'howto.paw', 'coach.hunt', 'coach.paw', 'coach.merge', 'coach.upgrade', 'coach.target', 'coach.pet', 'story.tap']) {
        expect(c[k], `${l}.${k}`).toBeTypeOf('string');
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      expect(c['coach.hunt.keys'], `${l}.coach.hunt.keys`).toMatch(KEYS);
      expect(c['coach.paw.keys'], `${l}.coach.paw.keys`).toMatch(KEYS);
      expect(c['howto.keys'], `${l}.howto.keys`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(touch.hands).toHaveLength(3);
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
    for (const what of ['hunt', 'paw', 'merge', 'merge2', 'upgrade'] as const) expect(coachText(what, true)).not.toMatch(KEYS);
    expect(coachText('hunt', false)).toMatch(KEYS);
  });
});
