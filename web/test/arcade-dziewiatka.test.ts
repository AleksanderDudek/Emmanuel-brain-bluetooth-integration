import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/arcade/dziewiatka/battle';
import {
  BOONS, CAMPAIGN, CHAPTERS, DIN, HEROES, HERO_IDS, LINES, LINE_COUNT, MISSIONS_PER_CHAPTER, MOMENTS, START_TEAM, campaignMission, towerFloor,
} from '../src/arcade/dziewiatka/content';
import { CATALOGS, t, unit } from '../src/arcade/dziewiatka/i18n';
import {
  addNotes, addXp, bestOf, equip, equipAll, familyBonus, freshProgress, growth, migrate, powerOf, swapIn, xpNeed,
  type DziewiatkaProgress,
} from '../src/arcade/dziewiatka/meta';
import { CHOICE_GUARD, layout, slotAt, targetsFor } from '../src/arcade/dziewiatka/layout';
import { font } from '../src/arcade/dziewiatka/paint';
import { RULES } from '../src/arcade/dziewiatka/rules';
import { DziewiatkaSim, autoTeam, finaleFor, multFor, planBlocks, starsFor, type SimEvent } from '../src/arcade/dziewiatka/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_TAP, MIN_TEXT, TAP_GAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
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

type SimOpts = { progress?: Partial<DziewiatkaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

const SEEN = ['ult', 'tap', 'mult', 'bell', 'well', 'boon', 'wind', 'split', 'swell', 'shield', 'steal', 'rush', 'yawn', 'copy', 'whisper', 'boss'];

function makeSim(o: SimOpts = {}): DziewiatkaSim {
  const progress = migrate(mergeSaved(freshProgress(), { ...freshProgress(), ...o.progress }));
  const sim = new DziewiatkaSim({
    progress, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, every explanation seen). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...SEEN], ...o.progress } });

function drive(sim: DziewiatkaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Take every boon offered (the choice holds the world). */
function pickAll(sim: DziewiatkaSim): void {
  for (let i = 0; i < 4 && sim.choice; i++) {
    sim.choice.t = 1;
    sim.pick(0);
  }
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** No waves come (a quiet street for one rule). */
function quiet(sim: DziewiatkaSim): void {
  (sim as unknown as { missionFrame: () => void }).missionFrame = () => {};
  sim.battle.din.length = 0;
}

/** A bare battle with the start team at growth 1. */
function bareBattle(team: string[] = [...START_TEAM]): { b: Battle; evs: BattleEvent[] } {
  const evs: BattleEvent[] = [];
  const b = new Battle(e => evs.push(e), mulberry32(3));
  b.setTeam(team.map(k => ({ kind: k as never, power: 1, rank: 0 })));
  for (const h of b.heroes) h.x = h.home;
  return { b, evs };
}

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates push and rest, ending on a rest', () => {
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
    const sim = later();
    const b = sim.block;
    expect(b.kind).toBe('push');
    const evs = drive(sim, b.dur - 2, frame());
    expect(sim.telegraphed).toBe(true);
    expect(ofType(evs, 'telegraph')[0].next!.kind).toBe('rest');
  });

  it('makes every 4th push blind from the 3rd session ("a fog of noise"), never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock, () => { if (sim.choice) sim.pick(0); });
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
  });
});

describe('energy (Hero Wars\' rules) and the band', () => {
  it('gives +100 per attack, +10 per 1 % of health lost, +300 per hush', () => {
    const { b } = bareBattle();
    const h = b.heroes[0];
    b.gain(h, RULES.perAttack);
    expect(h.energy).toBe(100);
    b.hurtHero(h, h.max * 0.1 / ((1 - h.armor)), null);
    expect(h.energy).toBeCloseTo(100 + 100, 0);
    const d = b.spawn('rozproszek', 1, 0, { x: 7, y: 0.5 });
    const before = b.heroes[4].energy;
    b.hurtDin(d, 1e6, b.heroes[4]);
    expect(b.din).toHaveLength(0);
    expect(b.heroes[4].energy - before).toBeCloseTo(RULES.perHush, 5);
    expect(b.hushed).toBe(DIN.rozproszek.worth);
  });

  it('multiplies every gain ×1 … ×3 by the level (×2 at the threshold)', () => {
    expect(multFor(0)).toBe(1);
    expect(multFor(0.5)).toBe(2);
    expect(multFor(1)).toBe(3);
    const { b } = bareBattle();
    b.mult = multFor(0.75);
    b.gain(b.heroes[0], 100);
    expect(b.heroes[0].energy).toBeCloseTo(250, 5);
  });

  it('drives the multiplier only in a sighted push past its lead-in, with a reliable signal; ×1 otherwise', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 2, HIGH);
    expect(sim.mult).toBe(1);
    expect(sim.meter()).toBeNull();
    drive(sim, RULES.leadIn.fnirs + 1, HIGH);
    expect(sim.mult).toBeCloseTo(multFor(0.95), 5);
    expect(sim.meter()!).toBeGreaterThan(0.8);
    drive(sim, 0.5, NONE);
    expect(sim.mult).toBe(1);
    expect(sim.meter()).toBeNull();
  });

  it('focus is the push block\'s peak: more ultimates and more hushed than with a flat signal', () => {
    const run = (f: FocusFrame) => {
      const sim = later({ seed: 5 });
      const evs = drive(sim, 150, f, { t: 0 }, () => pickAll(sim));
      return { ults: ofType(evs, 'ult').filter(e => !e.chord).length, score: sim.score };
    };
    const focused = run(HIGH), flat = run(frame({ level: 0.05 }));
    expect(focused.ults).toBeGreaterThan(flat.ults);
    expect(focused.score).toBeGreaterThan(flat.score * 1.25);
  });
});

describe('ultimates: the tap and the semi-auto', () => {
  it('a portrait tap fires that hero when the bar is full; not ready, it does nothing but say so', () => {
    const sim = later();
    drive(sim, 4, frame());
    const h = sim.battle.heroes[1];
    h.energy = 500;
    expect(sim.tapSlot(1)).toBe(false);
    expect(ofType(sim.take(), 'nope')).toHaveLength(1);
    h.energy = RULES.energyMax;
    expect(sim.tapSlot(1)).toBe(true);
    expect(h.energy).toBe(0);
    expect(sim.battle.stop).toBeGreaterThan(0);
  });

  it('a tap on the street (or Space) fires the hero who waited longest', () => {
    const sim = later();
    drive(sim, 4, frame());
    const [a, b] = sim.battle.heroes;
    a.energy = b.energy = RULES.energyMax;
    a.readyT = 0.2;
    b.readyT = 1.0;
    sim.key(' ', true);
    expect(b.energy).toBe(0);
    expect(a.energy).toBe(RULES.energyMax);
  });

  it('goes by itself after the role\'s wait while shadows are on the street', () => {
    const sim = later();
    quiet(sim);
    for (const h of sim.battle.heroes) h.x = h.home;
    sim.battle.spawn('leniwiec', 3, 0, { x: 9, y: 0.5 });
    const h = sim.battle.heroes.find(x => x.kind === 'dobroc')!;
    sim.battle.gain(h, RULES.energyMax);
    const evs = drive(sim, RULES.autoWait.marksman + 0.5, frame());
    expect(ofType(evs, 'ult').some(e => e.kind === 'dobroc' && e.auto)).toBe(true);
  });

  it('Patience\'s Wall draws every shadow to her and answers with what she took', () => {
    const { b, evs } = bareBattle();
    for (let i = 0; i < 3; i++) b.spawn('klotniak', 1, 0, { x: 9 + i, y: 0.5 });
    const p = b.heroes.find(h => h.kind === 'cierpliwosc')!;
    p.energy = RULES.energyMax;
    expect(b.fire(p)).toBe(true);
    expect(b.din.every(d => d.tauntBy === p.id)).toBe(true);
    for (let i = 0; i < 60 * (RULES.ult.wallSec + 0.5); i++) b.update(STEP);
    expect(evs.some(e => e.type === 'wallAnswer')).toBe(true);
  });

  it('Kindness\'s tea and Gentleness\'s lullaby break a wind-up; the shadow is dazed', () => {
    const { b, evs } = bareBattle(['cierpliwosc', 'uprzejmosc', 'radosc', 'pokoj', 'dobroc']);
    const g = b.spawn('gniewosz', 1, 0, { x: 7.4, y: 0.5 });
    g.swell = RULES.swellMax - 1;
    b.hurtDin(g, 1, null);
    expect(g.windT).toBeGreaterThanOrEqual(0);
    const u = b.heroes.find(h => h.kind === 'uprzejmosc')!;
    u.energy = RULES.energyMax;
    b.fire(u);
    expect(g.windT).toBe(-1);
    expect(g.daze).toBeGreaterThan(0);
    expect(g.tea).toBeGreaterThan(0);
    expect(evs.some(e => e.type === 'interrupt')).toBe(true);
  });

  it('Goodness\'s beam goes through a mirror; basic hits only wear the mirror down', () => {
    const { b } = bareBattle();
    const s = b.spawn('pyszalek', 1, 0, { x: 8, y: 0.5 });
    const hp = s.hp;
    b.hurtDin(s, 20, null, { basic: true });
    expect(s.hp).toBe(hp);
    expect(s.mirror).toBeLessThan(s.mirrorMax);
    const d = b.heroes.find(h => h.kind === 'dobroc')!;
    d.energy = RULES.energyMax;
    b.fire(d);
    expect(s.hp).toBeLessThan(hp);
  });

  it('a Kłótniak split in two counts as hushed and leaves two little ones', () => {
    const { b, evs } = bareBattle();
    const k = b.spawn('klotniak', 1, 0, { x: 8, y: 0.5 });
    b.hurtDin(k, k.max * 0.6 / (1 - k.armor), null);
    expect(b.din.filter(d => d.kind === 'klotniaczek')).toHaveLength(RULES.splitN);
    expect(b.hushed).toBe(1);
    expect(evs.some(e => e.type === 'split')).toBe(true);
  });

  it('a Rozproszek\'s bite takes energy', () => {
    const { b, evs } = bareBattle();
    for (const h of b.heroes) h.energy = 0;
    b.heroes[2].energy = 600;
    b.heroes[2].shield = 1e6;
    const r = b.spawn('rozproszek', 1, 0, { x: b.heroes[2].x + 0.5, y: 0.5 });
    r.atkT = 0;
    b.update(STEP);
    expect(evs.some(e => e.type === 'steal')).toBe(true);
    expect(b.heroes[2].energy).toBeLessThan(600);
  });

  it('Faithfulness brings back the one who fell last', () => {
    const { b } = bareBattle(['wiernosc', 'milosc', 'radosc', 'pokoj', 'dobroc']);
    const fallen = b.heroes[3];
    b.hurtHero(fallen, 1e6, null);
    expect(fallen.down).toBe(true);
    const w = b.heroes[0];
    w.energy = RULES.energyMax;
    b.spawn('rozproszek', 1, 0, { x: 9, y: 0.5 });
    b.fire(w);
    expect(fallen.down).toBe(false);
    expect(fallen.hp).toBe(Math.round(fallen.max * RULES.ult.reviveHp));
  });
});

describe('Harmony (the bell)', () => {
  it('fills from a held focus in a sighted push; rung, all five fire at once and the fallen get up', () => {
    const sim = later();
    const evs = drive(sim, RULES.leadIn.fnirs + 0.5 + 1 / RULES.harmonyRate + 1, HIGH);
    expect(ofType(evs, 'harmonyReady')).toHaveLength(1);
    expect(sim.harmonyReady || ofType(evs, 'harmony').length > 0).toBe(true);
    if (sim.harmonyReady) {
      const h = sim.battle.heroes[2];
      sim.battle.hurtHero(h, 1e6, null);
      expect(h.down).toBe(true);
      sim.tapBell();
      const after = sim.take();
      expect(ofType(after, 'harmony')).toHaveLength(1);
      expect(ofType(after, 'ult').filter(e => e.chord).length).toBe(5);
      expect(h.down).toBe(false);
    }
  });

  it('never fills without a hold, without signal or at the well', () => {
    const sim = later();
    drive(sim, 20, frame({ level: 0.9, hold: 1 }));
    expect(sim.harmony).toBe(0);
    drive(sim, 4, NONE);
    expect(sim.harmony).toBe(0);
  });

  it('a blind push keeps ×1 in sight and pays its share into Harmony at its end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, frame(), clock);
    pickAll(sim);
    drive(sim, sim.block.dur + 0.05, CALM, clock);
    pickAll(sim);
    expect(sim.block.blind).toBe(true);
    const before = sim.harmony;
    drive(sim, 8, HIGH, clock);
    expect(sim.mult).toBe(1);
    expect(sim.meter()).toBeNull();
    const evs = drive(sim, sim.block.dur - 8 + 0.1, HIGH, clock);
    expect(ofType(evs, 'fog')).toHaveLength(1);
    expect(sim.harmony + (sim.harmonyReady ? 1 : 0)).toBeGreaterThan(before);
  });
});

describe('missions, stars and grace', () => {
  it('stars by who fell: 3, 2, 1', () => {
    expect([0, 1, 2, 4].map(starsFor)).toEqual([3, 2, 1, 1]);
  });

  it('wins missions of three waves, moves on through the town and keeps the stars', () => {
    const sim = later({ planned: 600 });
    drive(sim, 200, HIGH, { t: 0 }, () => pickAll(sim));
    expect(sim.missionsWon).toBeGreaterThanOrEqual(2);
    expect(sim.p.mission).toBe(sim.missionsWon);
    expect(sim.p.stars.slice(0, sim.missionsWon).every(s => s >= 1 && s <= 3)).toBe(true);
    expect(sim.score).toBeGreaterThan(20);
  });

  it('a wipe is a stumble: a tally, the team gets up, the score stays, the session goes on', () => {
    const sim = later();
    drive(sim, 6, frame());
    const score = sim.score;
    for (const h of sim.battle.heroes) sim.battle.hurtHero(h, 1e7, null);
    const evs = drive(sim, 0.2, frame());
    expect(ofType(evs, 'wipe')).toHaveLength(1);
    expect(sim.tally).not.toBeNull();
    drive(sim, RULES.wipeSec + 0.2, frame());
    expect(sim.tally).toBeNull();
    expect(sim.battle.heroes.every(h => !h.down && h.hp > 0)).toBe(true);
    expect(sim.score).toBeGreaterThanOrEqual(score);
    expect(sim.phase).toBe('play');
  });

  it('the Din is shy against a team behind its pace, never below the floor', () => {
    const sim = later({ progress: { mission: 20 } });
    expect(sim.mission.shy).toBeLessThan(1);
    expect(sim.mission.shy).toBeGreaterThanOrEqual(RULES.shyFloor);
  });

  it('a district\'s boss in the fifth mission; the campaign then the Bell Tower', () => {
    expect(campaignMission(4, RULES.powerStep).boss).toBe('krzykacz');
    expect(campaignMission(29, RULES.powerStep).boss).toBe('zgielk');
    expect(campaignMission(3, RULES.powerStep).boss).toBeNull();
    expect(campaignMission(0, RULES.powerStep).waves[0].kinds.every(k => k === 'rozproszek')).toBe(true);
    const f = towerFloor(5, 3, RULES.towerStep);
    expect(f.boss).not.toBeNull();
    expect(towerFloor(6, 3, RULES.towerStep).power).toBeGreaterThan(f.power);
    const sim = later({ progress: { mission: CAMPAIGN, floor: 4 } });
    expect(sim.mission.spec.floor).toBe(4);
  });

  it('a newcomer before the first boss, a district cleared with its card; newcomers join the five at the next mission', () => {
    const sim = later({ progress: { mission: 3 } });
    const evs: SimEvent[] = [];
    drive(sim, 240, HIGH, { t: 0 }, () => {
      pickAll(sim);
      evs.push(...sim.take());
    });
    expect(ofType(evs, 'chapter').map(e => e.index)).toContain(0);
    expect(sim.p.owned).toContain('uprzejmosc');
    expect(sim.p.owned).toContain('lagodnosc');
    expect(ofType(evs, 'join').map(e => e.hero)).toEqual(expect.arrayContaining(['uprzejmosc', 'lagodnosc']));
    expect(sim.p.team).toContain('uprzejmosc');
    expect(sim.team).toContain('uprzejmosc');
    // the first boss comes with an interrupter in the five
    expect(HEROES.uprzejmosc.joins).toBeLessThan(MISSIONS_PER_CHAPTER - 1);
  });
});

describe('the well (rest)', () => {
  it('the team sits at the well, calm heals and the fallen stand; the end offers three boons, golden after a calm rest', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, frame(), clock);
    expect(sim.atWell).toBe(true);
    for (const h of sim.battle.heroes) h.hp = h.max * 0.3;
    const fallen = sim.battle.heroes[1];
    sim.battle.hurtHero(fallen, 1e7, null);
    const evs = drive(sim, sim.block.dur + 0.05, CALM, clock);
    expect(fallen.down).toBe(false);
    expect(sim.battle.heroes.every(h => h.hp > h.max * 0.5)).toBe(true);
    const c = ofType(evs, 'choice');
    expect(c).toHaveLength(1);
    expect(c[0].gold).toBe(true);
    expect(sim.choice!.ids).toHaveLength(3);
    // Space takes the first; the team goes back to the line
    sim.choice!.t = 1;
    sim.key(' ', true);
    expect(sim.choice).toBeNull();
    expect(sim.atWell).toBe(false);
  });

  it('heals with no signal too (never a penalty), only less', () => {
    const run = (f: FocusFrame) => {
      const sim = later();
      const clock = { t: 0 };
      drive(sim, sim.block.dur + 0.05, frame(), clock);
      for (const h of sim.battle.heroes) h.hp = h.max * 0.2;
      drive(sim, 12, f, clock);
      return sim.battle.heroes[0].hp / sim.battle.heroes[0].max;
    };
    const none = run(NONE), calm = run(CALM);
    expect(none).toBeGreaterThan(0.2);
    expect(calm).toBeGreaterThan(none);
  });

  it('a tap at the well sews a piece onto the hero closest to a new rank; six make the rank', () => {
    const sim = later({ progress: { bag: [3, 3, 3, 3, 3, 3] } });
    const clock = { t: 0 };
    drive(sim, sim.block.dur + 0.05, frame(), clock);
    expect(sim.atWell).toBe(true);
    const p = sim.p;
    const id = sim.battle.heroes[0].kind;
    for (let i = 0; i < 6; i++) sim.tapSlot(0);
    expect(growth(p, id).rank).toBe(1);
    expect(growth(p, id).slots).toBe(0);
    const evs = sim.take();
    expect(ofType(evs, 'equip').some(e => e.rankUp)).toBe(true);
    // a tap on the street sews onto whoever is closest
    expect(sim.tap()).toBe(true);
  });

  it('boons change the numbers: soup lifts health, gingerbread damage, the key Harmony', () => {
    const sim = later();
    const h = sim.battle.heroes[0];
    const max = h.max;
    (sim as unknown as { applyBoon: (id: string, gold: boolean) => void }).applyBoon('zupa', false);
    expect(h.max).toBe(Math.round(max * (1 + BOONS.zupa[0] / 100)));
    (sim as unknown as { applyBoon: (id: string, gold: boolean) => void }).applyBoon('pierniki', true);
    expect(sim.battle.mods.dmg).toBeCloseTo(BOONS.pierniki[1] / 100 + familyBonus(sim.p.team, 'dlonie'), 5);
    (sim as unknown as { applyBoon: (id: string, gold: boolean) => void }).applyBoon('klucz', false);
    expect(sim.harmony).toBeCloseTo(BOONS.klucz[0] / 100, 5);
  });
});

describe('the end and the result', () => {
  it('settles once; result() is idempotent and keeps records with max', () => {
    const sim = later({ planned: 60 });
    const evs = drive(sim, 70, frame({ level: 0.7, hold: 6 }), { t: 0 }, () => pickAll(sim));
    expect(ofType(evs, 'done')).toHaveLength(1);
    const p = sim.p;
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(p.best['60']).toBe(sim.score);
    const total = p.total;
    sim.result();
    expect(p.total).toBe(total);
    expect(p.sessions).toBe(6);
    expect(sim.canStop()).toBe(true);
    expect(passage(a.verse!).text.length).toBeGreaterThan(10);
  });

  it('finish() mid-session settles as the end would, without opening a choice', () => {
    const sim = later();
    drive(sim, 30, frame());
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.choice).toBeNull();
    expect(sim.phase).toBe('done');
    const total = sim.p.total;
    sim.finish();
    expect(sim.p.total).toBe(total);
  });

  it('keeps the last boon of a session for the next one', () => {
    const sim = later({ planned: 60 });
    drive(sim, 70, frame(), { t: 0 }, () => pickAll(sim));
    expect(sim.p.boon).not.toBe('');
    const next = makeSim({ progress: { ...sim.p } });
    expect(next.p.boon).toBe('');
  });
});

describe('the meta', () => {
  it('reads the foundation\'s placeholder save ({ sessions }) in place: the count stays, the rest is fresh', () => {
    const p = migrate(mergeSaved(freshProgress(), { sessions: 3 }));
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(3);
    expect(p.team).toEqual([...START_TEAM]);
    expect(p.heroes.milosc.lv).toBe(1);
    expect(bestOf(p)).toBeNull();
  });

  it('repairs a v1 save with wrong types and keeps what still means something', () => {
    const p = migrate(mergeSaved(freshProgress(), {
      ver: 1, sessions: 'x', mission: 7, stars: [3, 2, 'z', 9], owned: ['milosc', 'nobody', 'uprzejmosc'], team: ['uprzejmosc', 'uprzejmosc', 5],
      heroes: { milosc: { lv: 9, xp: 'a', rank: 99 }, dobroc: null }, bag: 'many', boon: 'zupa', best: { 300: 40, 600: 'x' }, seen: [1, 'ult'],
    }));
    expect(p.sessions).toBe(0);
    expect(p.mission).toBe(7);
    expect(p.stars).toEqual([3, 2, 0, 3]);
    expect(p.owned).toContain('uprzejmosc');
    expect(p.owned).not.toContain('nobody');
    expect(p.team).toHaveLength(5);
    expect(new Set(p.team).size).toBe(5);
    expect(p.team[0]).toBe('uprzejmosc');
    expect(p.heroes.milosc.lv).toBe(9);
    expect(p.heroes.milosc.rank).toBe(RULES.rankMax);
    expect(p.heroes.dobroc.lv).toBe(1);
    expect(p.bag).toEqual([0, 0, 0, 0, 0, 0]);
    expect(p.boon).toBe('zupa');
    expect(p.best).toEqual({ 300: 40 });
    expect(p.seen).toEqual(['ult']);
    expect(migrate(p)).toEqual(p);
  });

  it('levels, notes and gear grow a hero; six pieces make the next colour', () => {
    const g = freshProgress().heroes.radosc;
    expect(addXp(g, xpNeed(1) + xpNeed(2))).toBe(2);
    expect(g.lv).toBe(3);
    expect(addNotes(g, RULES.starNotes[0])).toBe(1);
    expect(g.stars).toBe(2);
    expect(powerOf(g)).toBeGreaterThan(1);
    const p = freshProgress();
    p.bag = [1, 1, 1, 1, 1, 1];
    for (let i = 0; i < 5; i++) expect(equip(p, 'radosc')!.rankUp).toBe(false);
    expect(equip(p, 'radosc')!.rankUp).toBe(true);
    expect(p.heroes.radosc.rank).toBe(1);
    expect(equip(p, 'radosc')).toBeNull();
    p.bag = [2, 2, 2, 2, 2, 2];
    expect(equipAll(p).length).toBe(12);
  });

  it('families of two or three in the five give their bonus', () => {
    expect(familyBonus(['milosc', 'radosc', 'pokoj', 'cierpliwosc', 'dobroc'], 'serce')).toBe(160);
    expect(familyBonus(['milosc', 'radosc', 'uprzejmosc', 'cierpliwosc', 'dobroc'], 'dlonie')).toBe(0.2);
    expect(familyBonus(['milosc', 'radosc', 'uprzejmosc', 'cierpliwosc', 'wiernosc'], 'korzenie')).toBe(0);
  });

  it('newcomers take the flexible places of the five; the lobby swaps a hero in', () => {
    expect(autoTeam([...START_TEAM])).toEqual(['cierpliwosc', 'milosc', 'radosc', 'pokoj', 'dobroc']);
    expect(autoTeam([...START_TEAM, 'uprzejmosc'])).toEqual(['cierpliwosc', 'radosc', 'uprzejmosc', 'pokoj', 'dobroc']);
    const p = freshProgress();
    p.owned.push('lagodnosc');
    expect(swapIn(p, 'lagodnosc', 'milosc')).toBe(true);
    expect(p.team).toContain('lagodnosc');
    expect(p.team).not.toContain('milosc');
    expect(swapIn(p, 'opanowanie')).toBe(false);
  });

  it('the nine are the fruit of the Spirit in Galatians\' order, in three families of three', () => {
    expect(HERO_IDS).toHaveLength(9);
    for (const f of ['serce', 'dlonie', 'korzenie']) expect(HERO_IDS.filter(id => HEROES[id].family === f)).toHaveLength(3);
    expect(CHAPTERS).toHaveLength(6);
  });
});

describe('Klara talks, and the texts in four languages', () => {
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

  it('bends the headline unit (1 uciszony, 3 uciszone, 5 uciszonych)', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['uciszony', 'uciszone', 'uciszonych', 'uciszone', 'uciszonych']);
    expect(t('hushed', { n: 12 })).toBe('12 uciszonych');
  });

  it('leaves no Polish letters in the other languages, and quotes in each language\'s own marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const s of Object.values(CATALOGS.pl).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m)))) {
      if (/[„“”"]/.test(s)) expect(s).toMatch(/„[^„”"“]+”/);
    }
  });

  it('never asks to concentrate harder, never uses holiness words, gore, "faith" for a hero or "hack"; the shadows are never killed', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /zabij/, /\bkill/, /töte/, /döda/, /pray/, /módl/, /\bbete\b/, /power of the spirit/, /mocą ducha/]) {
        expect(all).not.toMatch(word);
      }
      const tips = Object.entries(cat).filter(([k]) => k.startsWith('tip.') || k.startsWith('howto.')).map(([, v]) => String(v).toLowerCase()).join(' ');
      for (const word of [/mocniej/, /harder/, /stärker/, /hårdare/]) expect(tips).not.toMatch(word);
    }
    // Faithfulness is the virtue's name, never "faith"
    expect(CATALOGS.en['hero.wiernosc']).toBe('Faithfulness');
    expect(CATALOGS.de['hero.wiernosc']).toBe('Treue');
    expect(CATALOGS.pl['hero.wiernosc']).toBe('Wierność');
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the centre every 0.65 s (on the street), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<DziewiatkaProgress>, seed: number, eeg: boolean, planned = 40) {
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
        sim.tap();
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

  it('hushes shadows by 22 s on either band, first session or later, and the headline climbs live', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) {
        const { score, seen } = smoke({}, seed, eeg);
        expect(score, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(2);
        expect(seen.at(-1)!).toBeGreaterThan(seen[1] ?? 0);
      }
    }
    expect(smoke({ sessions: 6 }, 3, false, 300).score).toBeGreaterThan(3);
  });

  it('the taps fire ultimates: specials happen in the first 22 s', () => {
    const { sim } = smoke({}, 2, false, 300);
    expect(sim.ultsNow).toBeGreaterThan(0);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/dziewiatka/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(30);
    p.lastLen = 600;
    expect(mod.best(p)).toBe(45);
    expect(mod.unit!(1)).toBe('uciszony');
    expect(mod.unit!(5)).toBe('uciszonych');
    const how = mod.howto!();
    // a finger's card (the runner drops the keys' row on touch) has one to three controls and no keys in its words
    const finger = how.hands.filter(c => c.gesture !== 'keys');
    expect(finger.length).toBeGreaterThanOrEqual(1);
    expect(finger.length).toBeLessThanOrEqual(3);
    for (const c of finger) expect(c.text).not.toMatch(/spacj|klawisz|space|\bkey|leertaste|taste|mellanslag|tangent|klik|click|mysz|mouse/i);
    expect(how.hands.filter(c => c.gesture === 'keys')).toHaveLength(1);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
    // the placeholder's save survives the module's own entry points
    const old = { sessions: 4 } as unknown as DziewiatkaProgress;
    expect(mod.best(old)).toBeNull();
    expect(old.team).toHaveLength(5);
  });

  it('builds the progress card from elements: the town\'s six districts, the nine; a tap swaps a hero into the five', async () => {
    const { progressPanel } = await import('../src/arcade/dziewiatka/panel');
    const p = { ...freshProgress(), sessions: 3, mission: 6, stars: [3, 3, 2, 3, 1, 3], owned: [...START_TEAM, 'uprzejmosc'], total: 120 };
    let saved = 0;
    const el = progressPanel(p, () => saved++);
    const albums = el.querySelectorAll('.arcade-album');
    expect(albums[0].children).toHaveLength(CHAPTERS.length);
    expect(albums[0].querySelectorAll(':scope > div.on')).toHaveLength(2);
    expect(albums[1].children).toHaveLength(HERO_IDS.length);
    expect(el.textContent).toContain(t('hero.uprzejmosc'));
    // pick Love in the five, then Kindness from the bench: she takes Love's place
    const tile = (id: string) => [...el.querySelectorAll<HTMLElement>('.arcade-album')[1].children].find(c => c.getAttribute('title')?.startsWith(t(`hero.${id}` as never))) as HTMLElement;
    tile('milosc').click();
    tile('uprzejmosc').click();
    expect(saved).toBe(1);
    expect(p.team).toContain('uprzejmosc');
    expect(p.team).not.toContain('milosc');
    expect(p.seen).toContain('teamSet');
  });
});

describe('mobile first (DESIGN.md §11.7, kit/mobile.ts): the layout on every checked size', () => {
  const states = ['play', 'choice', 'story'] as const;

  for (const c of CHECK_SIZES) {
    it(`${c.name} (${c.w}×${c.h}): the five, the bell, the boons and the story card are finger-sized, inside the insets and apart`, () => {
      const L = layout(c.w, c.h, c.insets);
      for (const st of states) expect(auditTargets(targetsFor(L, st), c.w, c.h, c.insets), `${c.name} · ${st}`).toEqual([]);
      // the portraits are the main control: big cards (an upright phone ≥ 84 px tall, on its side ≥ 64), a gap apart
      for (const r of L.slots) {
        expect(r.h).toBeGreaterThanOrEqual(L.shape === 'portrait' ? 84 : 64);
        expect(r.w).toBeGreaterThanOrEqual(MIN_TAP);
      }
      for (let i = 1; i < 5; i++) expect(L.slots[i].x - (L.slots[i - 1].x + L.slots[i - 1].w)).toBeGreaterThanOrEqual(TAP_GAP - 0.01);
      // no empty band under the strip (the old simulator reserve): the five sit on the bottom inset
      const low = Math.max(...L.slots.map(r => r.y + r.h));
      expect(c.h - c.insets.bottom - low).toBeLessThanOrEqual(16);
      // the street takes what is left above the controls, from the HUD down
      expect(L.fieldBottom - L.top).toBeGreaterThanOrEqual((c.h - c.insets.top - c.insets.bottom) * 0.5);
      // passive information right under the HUD; the story card inside the band
      expect(L.pill.y).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.pill.y).toBeLessThan(c.insets.top + 12);
      expect(L.story.y).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.story.y + L.story.h).toBeLessThanOrEqual(c.h - c.insets.bottom);
    });
  }

  it('an upright phone keeps every recurring control in the thumb zone, 16 px clear of the side edges', () => {
    for (const c of CHECK_SIZES.filter(s => s.h > s.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.shape, c.name).toBe('portrait');
      for (const tg of targetsFor(L, 'play')) {
        expect(tg.y, `${c.name} · ${tg.label}`).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
        expect(tg.x).toBeGreaterThanOrEqual(16);
        expect(tg.x + tg.w).toBeLessThanOrEqual(c.w - 16);
      }
      // the dial and the bell share a row over the five; the bell is a primary control (≥ 48 px)
      expect(L.dial.y + L.dial.h).toBeLessThanOrEqual(L.slots[0].y);
      expect(Math.min(L.bell.w, L.bell.h)).toBeGreaterThanOrEqual(48);
      // the boons: three stacked full-width cards in a bottom sheet, each a big tap target
      expect(L.sheet).not.toBeNull();
      for (const r of L.cards) {
        expect(r.w).toBeGreaterThanOrEqual(Math.min(c.w - L.padL - L.padR, 520 * L.u) - 0.5);
        expect(L.padL).toBeLessThanOrEqual(24);
        expect(r.h).toBeGreaterThanOrEqual(72);
        expect(r.y).toBeGreaterThanOrEqual(c.h * 0.3);
      }
      for (let i = 1; i < 3; i++) expect(L.cards[i].y).toBeGreaterThan(L.cards[i - 1].y + L.cards[i - 1].h);
    }
  });

  it('a phone on its side puts the dial, the five and the bell in one strip along the bottom; a desktop the same, grown', () => {
    for (const c of CHECK_SIZES.filter(s => s.w > s.h)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.shape, c.name).toBe(c.h - c.insets.top < 330 ? 'side' : 'wide');
      const y = L.slots[0].y;
      expect(L.dial.y).toBeCloseTo(y);
      expect(L.bell.y).toBeCloseTo(y);
      expect(L.dial.x + L.dial.w).toBeLessThan(L.slots[0].x);
      expect(L.bell.x).toBeGreaterThan(L.slots[4].x + L.slots[4].w);
      // the boons in a row, under the HUD
      expect(L.sheet).toBeNull();
      expect(L.cards[1].y).toBeCloseTo(L.cards[0].y);
      expect(L.cardsTitle - 24).toBeGreaterThanOrEqual(c.insets.top);
    }
    const phone = layout(601, 360, { top: 68, right: 0, bottom: 0, left: 0 });
    const desk = layout(1280, 672, { top: 192, right: 0, bottom: 0, left: 0 });
    expect(phone.u).toBe(1);
    expect(desk.u).toBeGreaterThan(1.2);
    expect(desk.slots[0].h).toBeGreaterThan(phone.slots[0].h);
  });

  it('a finger in the gap between two portraits means the nearer one; the street and the dial are not portraits', () => {
    const L = layout(360, 500, { top: 134, right: 0, bottom: 0, left: 0 });
    const [a, b] = [L.slots[1], L.slots[2]];
    const gapX = a.x + a.w + L.gap / 2;
    expect(slotAt(L, a.x + a.w / 2, a.y + a.h / 2)).toBe(1);
    expect(slotAt(L, gapX - 1, a.y + 20)).toBe(1);
    expect(slotAt(L, gapX + 1, a.y + 20)).toBe(2);
    expect(slotAt(L, b.x + 2, b.y + b.h - 2)).toBe(2);
    expect(slotAt(L, 180, (L.top + L.fieldBottom) / 2)).toBe(-1);
    expect(slotAt(L, L.dial.x + 10, L.dial.y + 10)).toBe(-1);
    // a boon card takes a finger only after the sheet has been up a moment
    expect(CHOICE_GUARD).toBeGreaterThanOrEqual(0.3);
  });

  it('Klara waits while a coach mark is up, so her bubble never stacks on the runner\'s', () => {
    const run = (coach: boolean) => {
      const sim = later();
      for (let i = 0; i < 12 * 60; i++) {
        if (coach && i % 60 === 0) sim.coachT = 1.2;
        sim.update(STEP, frame(), i * STEP);
        if (coach) expect(sim.talk.line).toBeNull();
      }
      return sim.talk.said.length;
    };
    expect(run(false)).toBeGreaterThan(0);
    expect(run(true)).toBe(0);
  });

  it('never draws a text under 11 px: the font helper floors every size', () => {
    for (const px of [0, 1, 5.4, 8, 10.4, 10.6, -3, Number.NaN]) {
      const m = font(px).match(/ (\d+)px /);
      expect(Number(m?.[1]), String(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(font(16, 800)).toContain('800 16px');
  });

  it('fits a text into lines, shrinking to its floor and then cutting with "…", never under 11 px', async () => {
    const { fitLines } = await import('../src/arcade/dziewiatka/hud');
    // a stand-in context: every glyph half the font's size wide
    const fake = { font: '', measureText: (s: string) => ({ width: s.length * Number((fake.font.match(/(\d+)px/) ?? ['', '10'])[1]) * 0.5 }) };
    const ctx = fake as unknown as CanvasRenderingContext2D;
    const short = fitLines(ctx, 'Ciepła zupa', 200, 2, 16, 13);
    expect(short).toEqual({ lines: ['Ciepła zupa'], px: 16 });
    const long = fitLines(ctx, 'kto upadnie, wstanie z 80% zdrowia (raz) i pójdzie dalej przez cały rynek', 120, 2, 16, 13);
    expect(long.px).toBeGreaterThanOrEqual(13);
    expect(long.lines.length).toBeLessThanOrEqual(2);
    expect(long.lines[1].endsWith('…')).toBe(true);
    const tiny = fitLines(ctx, 'Selbstbeherrschung', 40, 1, 14, 3);
    expect(tiny.px).toBe(MIN_TEXT);
  });
});
