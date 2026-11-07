import { describe, expect, it } from 'vitest';
import { RANKS, ROOM, ZMORY } from '../src/arcade/aniol/content';
import { CATALOGS, t, unit } from '../src/arcade/aniol/i18n';
import {
  bestOf, buyUp, canBuy, chapterOf, freshProgress, giftPool, migrate, nextRankAt, nightInChapter, rankOf, roomItems, upPrice, type AniolProgress,
} from '../src/arcade/aniol/meta';
import { RULES } from '../src/arcade/aniol/rules';
import { AURA_MARK, AniolSim, auraDps, auraFor, comboMult, comboRung, finaleFor, kindMix, levelNeed, planBlocks, type SimEvent, type Zmora } from '../src/arcade/aniol/sim';
import { LINES, line, type Moment } from '../src/arcade/aniol/talk';
import { CHAPTERS } from '../src/arcade/aniol/content';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-03';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });

type SimOpts = { progress?: Partial<AniolProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): AniolSim {
  const sim = new AniolSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no day's gift): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, pushes: 1, ...o.progress } });

function drive(sim: AniolSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** An empty room with no Zmora coming for a while (the rules one at a time). */
function quiet(sim: AniolSim): void {
  sim.zmory.length = 0;
  (sim as unknown as { spawnT: number }).spawnT = 999;
}

function toBlock(sim: AniolSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

const place = (sim: AniolSim, kind: Zmora['kind'], side: -1 | 1, d: number): Zmora => {
  const z = sim.spawn(kind, side, d, true);
  sim.take();
  return z;
};

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a lullaby, the finale left to Koszmar', () => {
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
    expect(finaleFor(300)).toBe(RULES.finale.long);
    expect(finaleFor(40)).toBe(RULES.finale.short);
  });

  it('telegraphs the next block 4 s ahead and ends the blocks with Koszmar', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    const evs = drive(sim, 60 - finaleFor(60) + 0.1, frame(), clock);
    const tele = ofType(evs, 'telegraph');
    expect(tele.length).toBeGreaterThanOrEqual(2);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('finale');
    expect(sim.zmory.some(z => z.kind === 'koszmar')).toBe(true);
  });
});

describe('the strike (touch)', () => {
  it('hits the nearest Zmora in reach on the tapped side, and banishes a Mara with one hit', () => {
    const sim = later();
    quiet(sim);
    const near = place(sim, 'mara', -1, 2.2);
    const far = place(sim, 'mara', -1, 2.6);
    const other = place(sim, 'mara', 1, 2.0);
    sim.strike(-1);
    const evs = sim.take();
    expect(ofType(evs, 'banish').map(e => e.id)).toEqual([near.id]);
    expect(sim.score).toBe(1);
    expect(far.state).toBe('walk');
    expect(other.state).toBe('walk');
    expect(sim.facing).toBe(-1);
  });

  it('strikes the nearer side from the middle (the smoke\'s tap and Space)', () => {
    const sim = later();
    quiet(sim);
    place(sim, 'mara', -1, 2.6);
    const right = place(sim, 'mara', 1, 2.1);
    sim.strike(0);
    expect(ofType(sim.take(), 'banish').map(e => e.id)).toEqual([right.id]);
    sim.key(' ', true);
    expect(ofType(sim.take(), 'banish')).toHaveLength(1);
    sim.key(' ', false);
  });

  it('whiffs at nothing: a 0.25 s recovery, the combo resets, a tap during it waits and lands', () => {
    const sim = later();
    quiet(sim);
    sim.combo = 7;
    sim.strike(1);
    expect(ofType(sim.take(), 'whiff')).toHaveLength(1);
    expect(sim.combo).toBe(0);
    expect(sim.recover).toBeCloseTo(RULES.whiff);
    const z = place(sim, 'mara', 1, 2.0);
    sim.strike(1);
    expect(z.state).toBe('walk');
    drive(sim, 0.3, frame());
    expect(sim.score).toBe(1);
  });

  it('misses a Skoczek in the air; it is hit as it lands', () => {
    const sim = later();
    quiet(sim);
    const s = place(sim, 'skoczek', 1, 2.3);
    s.z = 0.9;
    sim.strike(1);
    expect(s.state).toBe('walk');
    expect(ofType(sim.take(), 'whiff')).toHaveLength(1);
    s.z = 0;
    sim.recover = 0;
    sim.strike(1);
    expect(sim.score).toBe(1);
  });

  it('needs two hits for a Widmo, which slips back after the first', () => {
    const sim = later();
    quiet(sim);
    const w = place(sim, 'widmo', -1, 2.0);
    sim.strike(-1);
    expect(w.state).toBe('walk');
    expect(w.d).toBeGreaterThan(2.0);
    drive(sim, 0.2, frame());
    w.d = 2.0;
    sim.strike(-1);
    expect(sim.score).toBe(1);
  });

  it('breaks a Rój into three shades, each banished on its own', () => {
    const sim = later();
    quiet(sim);
    place(sim, 'roj', 1, 2.2);
    sim.strike(1);
    expect(ofType(sim.take(), 'split')).toHaveLength(1);
    expect(sim.score).toBe(0);
    expect(sim.zmory.filter(z => z.kind === 'cien' && z.state === 'walk')).toHaveLength(RULES.swarm);
  });

  it('climbs a combo ladder ×2 from 8 hits, ×3 from 20, ×4 from 40, ×5 from 70 (feathers, not the count)', () => {
    expect([0, 7, 8, 19, 20, 39, 40, 70, 200].map(comboMult)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 5]);
    expect(comboRung(4)).toEqual({ next: 8, k: 0.5 });
    expect(comboRung(80).next).toBeNull();
    const sim = later();
    quiet(sim);
    sim.combo = 7;
    place(sim, 'mara', 1, 2.0);
    sim.strike(1);
    const evs = sim.take();
    expect(ofType(evs, 'combo')[0]).toMatchObject({ n: 8, mult: 2 });
    expect(ofType(evs, 'banish')[0].feathers).toBe(2);
    expect(sim.score).toBe(1);
  });

  it('holds the world still for a moment on a hit (hit-stop)', () => {
    const sim = later();
    quiet(sim);
    place(sim, 'mara', 1, 2.0);
    sim.strike(1);
    const other = place(sim, 'mara', -1, 4);
    drive(sim, STEP, frame());
    expect(sim.timeScale).toBe(0);
    expect(other.d).toBe(4);
  });
});

describe('the aura (the live gauge)', () => {
  it('has radius auraMin + level × auraExtra, the dotted mark at level 0.5, and no light at or below it', () => {
    expect(auraFor(0)).toBe(RULES.auraMin);
    expect(auraFor(1)).toBe(RULES.auraMin + RULES.auraExtra);
    expect(auraFor(-1)).toBe(RULES.auraMin);
    expect(AURA_MARK).toBe(RULES.auraMin + RULES.auraExtra / 2);
    expect(auraDps(0.5)).toBe(0);
    expect(auraDps(0.3)).toBe(0);
    expect(auraDps(1)).toBe(RULES.auraDps);
    // the threshold ring lies beyond the strike's reach: focus meets the Zmory before the hands do
    expect(AURA_MARK).toBeGreaterThan(RULES.reach);
  });

  it('answers the level only in a sighted Czuwanie past its lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      quiet(sim);
      expect(sim.block.kind).toBe('push');
      drive(sim, sim.leadIn - 0.5, HIGH);
      expect(sim.auraLook).toBe('wait');
      expect(sim.auraR).toBeLessThan(RULES.auraMin + 0.2);
      drive(sim, 3, HIGH);
      expect(sim.auraLook).toBe('live');
      expect(sim.auraR).toBeGreaterThan(AURA_MARK);
    }
  });

  it('rests small and grey while the signal is unreliable — never a loss', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 8, HIGH);
    drive(sim, 3, frame({ reliable: false, activity: null, level: 0.9 }));
    expect(sim.auraLook).toBe('grey');
    expect(sim.auraR).toBeLessThan(RULES.auraMin + 0.2);
  });

  it('slows the Zmory inside it and wounds them above the threshold; below it only slows', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 7, HIGH);
    const z = place(sim, 'mara', 1, 3.6);
    drive(sim, 1.2, HIGH);
    expect(z.state).toBe('gone');
    expect(sim.score).toBe(1);
    const sim2 = later();
    quiet(sim2);
    drive(sim2, 7, frame({ level: 0.45 }));
    const z2 = place(sim2, 'mara', 1, 2.6);
    drive(sim2, 0.5, frame({ level: 0.45 }));
    expect(z2.inAura).toBe(true);
    expect(z2.hp).toBe(1);
    expect(z2.d).toBeGreaterThan(2.6 - z2.speed * 0.5 * 0.7);
  });

  it('cracks armour only above the threshold; until then strikes bounce and throw it back', () => {
    const sim = later();
    quiet(sim);
    const p = place(sim, 'pancerna', -1, 2.4);
    sim.strike(-1);
    expect(ofType(sim.take(), 'bounce')).toHaveLength(1);
    expect(p.armoured).toBe(true);
    drive(sim, 0.4, frame());
    expect(p.d).toBeGreaterThan(2.4);
    // past the lead-in, the aura at the threshold: no crack
    quiet(sim);
    drive(sim, 7, frame({ level: 0.48 }));
    const q = place(sim, 'pancerna', -1, 2.6);
    drive(sim, 1, frame({ level: 0.48 }));
    expect(q.inAura).toBe(true);
    expect(q.armoured).toBe(true);
    const evs = drive(sim, 1.4, HIGH);
    expect(ofType(evs, 'crack')).toHaveLength(1);
    expect(q.armoured).toBe(false);
  });
});

describe('the Płomień (hold)', () => {
  it('after a hold of 5 s (Mendi) banishes every Zmora; 3 s on HALO; never before the lead-in', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      quiet(sim);
      const need = eeg ? 3 : 5;
      let hold = 0;
      const held = () => frame({ ...HIGH, level: 0.55, hold: (hold += STEP) });
      // a hold already long before the lead-in ends does nothing until it has passed
      drive(sim, Math.min(need, sim.leadIn) - 0.1, held);
      expect(sim.flames).toBe(0);
      drive(sim, Math.max(0, need - sim.leadIn) - 0.1, held);
      expect(sim.flames, `eeg ${eeg}`).toBe(0);
      for (const [side, d] of [[-1, 4], [1, 5], [1, 3.5]] as const) place(sim, 'mara', side, d);
      const armour = place(sim, 'pancerna', -1, 5);
      const evs = drive(sim, 0.4, held);
      const fl = ofType(evs, 'flame');
      expect(fl, `eeg ${eeg}`).toHaveLength(1);
      expect(fl[0].n).toBe(4);
      expect(armour.state).toBe('gone');
      expect(sim.flames).toBe(1);
      expect(sim.flameCharge).toBeLessThan(0.2);
    }
  });
});

describe('Sen and grace', () => {
  it('a Zmora at the bed only dims Sen; when it runs out the child stirs and Sen comes back to half', () => {
    const sim = later();
    quiet(sim);
    sim.combo = 5;
    const z = place(sim, 'mara', 1, RULES.bedHalf + ZMORY.mara.r + 0.05);
    drive(sim, 0.2, frame());
    expect(z.state).toBe('gone');
    expect(sim.sen).toBeCloseTo(1 - ZMORY.mara.dim);
    expect(sim.score).toBe(0);
    sim.sen = 0.05;
    const near = place(sim, 'mara', -1, 3);
    place(sim, 'mara', 1, RULES.bedHalf + ZMORY.mara.r + 0.05);
    const evs = drive(sim, 0.2, frame());
    expect(ofType(evs, 'stir')).toHaveLength(1);
    expect(sim.sen).toBe(RULES.senBack);
    expect(sim.combo).toBe(0);
    expect(near.state === 'back' || near.state === 'gone').toBe(true);
  });

  it('never ends the night early, however many Zmory reach the bed', () => {
    const sim = later({ planned: 60 });
    drive(sim, 59, frame());
    expect(sim.stirs).toBeGreaterThan(0);
    expect(sim.phase).not.toBe('play');
  });
});

describe('Kołysanka: the lullaby', () => {
  it('sends the Zmory back into the dark, lights stars from calm after the lead-in and refills Sen', () => {
    const sim = later();
    quiet(sim);
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.kind).toBe('rest');
    place(sim, 'mara', 1, 3);
    sim.zmory.forEach(z => { z.state = 'back'; });
    sim.sen = 0.4;
    const evs = drive(sim, 12, CALM, clock);
    expect(ofType(evs, 'star').length).toBeGreaterThanOrEqual(5);
    expect(sim.sen).toBeGreaterThan(0.6);
    expect(sim.feathers).toBeGreaterThanOrEqual(10);
  });

  it('turns a strike at nothing into a note of the harp (no whiff, no lost combo)', () => {
    const sim = later();
    toBlock(sim, 1);
    quiet(sim);
    sim.combo = 4;
    sim.strike(-1);
    const evs = sim.take();
    expect(ofType(evs, 'harp')).toHaveLength(1);
    expect(ofType(evs, 'whiff')).toHaveLength(0);
    expect(sim.combo).toBe(4);
  });

  it('pays a passed lullaby with feathers; without enough signal there is no verdict (never a loss)', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = toBlock(sim, 2, CALM, clock);
    const end = ofType(evs, 'blockEnd').find(e => e.block.kind === 'rest')!;
    expect(end.verdict).toBe(true);
    expect(ofType(evs, 'restPass')).toHaveLength(1);
    const sim2 = later();
    const c2 = { t: 0 };
    toBlock(sim2, 1, frame(), c2);
    const ev2 = toBlock(sim2, 2, frame({ reliable: false, activity: null }), c2);
    expect(ofType(ev2, 'blockEnd').find(e => e.block.kind === 'rest')!.verdict).toBeNull();
  });
});

describe('levels and gifts', () => {
  it('opens a choice of three different gifts at a level-up; the night goes on at 30 %; 1–3 pick', () => {
    expect(levelNeed(0)).toBe(RULES.levelBase);
    const sim = later();
    quiet(sim);
    const got: SimEvent[] = [];
    for (let i = 0; i < RULES.levelBase && !sim.choice; i++) {
      place(sim, 'mara', 1, 2.0);
      sim.recover = 0;
      sim.strike(1);
      got.push(...sim.take());
    }
    const lv = ofType(got, 'level');
    expect(lv).toHaveLength(1);
    expect(new Set(lv[0].options).size).toBe(3);
    const z = place(sim, 'mara', -1, 4);
    drive(sim, 0.5, frame());
    expect(sim.timeScale).toBeCloseTo(RULES.choiceSlow);
    expect(4 - z.d).toBeLessThan(z.speed * 0.5 * 0.5);
    const want = sim.choice!.options[1];
    sim.key('2', true);
    expect(sim.choice).toBeNull();
    expect(sim.taken[want]).toBe(1);
  });

  it('takes the first gift by itself after 5 s, so play never stalls', () => {
    const sim = later();
    quiet(sim);
    sim.feathers = 0;
    (sim as unknown as { gain(n: number): void }).gain(RULES.levelBase);
    const first = sim.choice!.options[0];
    const evs = drive(sim, RULES.choiceSec + 0.1, frame());
    expect(ofType(evs, 'gift')[0]).toMatchObject({ id: first, auto: true });
    expect(sim.choice).toBeNull();
  });

  it('gives what each gift says: reach, a double strike, a spear through a line, a wing shield', () => {
    const sim = later();
    quiet(sim);
    sim.taken.reach = 1;
    expect(sim.reach).toBeCloseTo(RULES.reach + RULES.reachStep);
    sim.taken.double = 1;
    const w = place(sim, 'widmo', 1, 2.0);
    sim.strike(1);
    expect(w.state).toBe('gone');
    sim.taken.spear = 1;
    for (const d of [2.0, 2.5, 3.2]) place(sim, 'mara', -1, d);
    sim.strike(-1);
    expect(ofType(sim.take(), 'banish').length).toBe(3);
    sim.shieldReady = true;
    sim.taken.shield = 1;
    const before = sim.sen;
    place(sim, 'mara', 1, RULES.bedHalf + ZMORY.mara.r + 0.02);
    const evs = drive(sim, 0.3, frame());
    expect(ofType(evs, 'shield')).toHaveLength(1);
    expect(sim.sen).toBe(before);
  });

  it('draws gifts from the rank\'s pool, which grows with the rank', () => {
    expect(giftPool(0).map(g => g.id)).not.toContain('spear');
    expect(giftPool(1).map(g => g.id)).toContain('spear');
    expect(giftPool(3).map(g => g.id)).toContain('lamp');
    const sim = later({ progress: { feathers: 0 } });
    for (let i = 0; i < 20; i++) for (const id of sim.giftOptions()) expect(giftPool(0).map(g => g.id)).toContain(id);
  });
});

describe('Mgła snu: the blind Czuwanie', () => {
  const blindSim = () => makeSim({ planned: 600, progress: { sessions: 4, giftDay: DAY, pushes: 2 } });

  it('comes every 4th Czuwanie from the 3rd session, never a session\'s first', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    expect(sim.plan[0].blind).toBe(false);
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    expect(sim.blind).toBe(true);
    const young = makeSim({ planned: 600, progress: { sessions: 1, giftDay: DAY, pushes: 2 } });
    toBlock(young, 2, frame(), { t: 0 });
    expect(young.block.blind).toBe(false);
  });

  it('shows no aura and veils the trace; at its end it reveals and bursts by the judged share', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    quiet(sim);
    drive(sim, 8, HIGH, clock);
    expect(sim.auraLook).toBe('blind');
    expect(sim.auraR).toBeLessThan(RULES.auraMin);
    expect(sim.trace.latest?.veiled).toBe(true);
    while (sim.blockT < sim.block.dur - 0.5) drive(sim, STEP, HIGH, clock);
    place(sim, 'mara', 1, 3.5);
    const evs = toBlock(sim, 3, HIGH, clock);
    const b = ofType(evs, 'burst');
    expect(b).toHaveLength(1);
    expect(b[0].share).toBeGreaterThan(0.8);
    expect(b[0].n).toBeGreaterThanOrEqual(1);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
  });
});

describe('Koszmar and the dawn', () => {
  it('attacks from alternating sides in phases and dissolves at dawn when banished', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, 300 - finaleFor(300) + 0.05, frame(), clock);
    expect(sim.phase).toBe('finale');
    const k = sim.zmory.find(z => z.kind === 'koszmar')!;
    const side0 = k.side;
    const turns: number[] = [];
    let guard = 0;
    while (sim.phase === 'finale' && guard++ < 4000) {
      if (k.d - k.r <= sim.reach && !k.turning) {
        sim.recover = 0;
        sim.strike(k.side);
      }
      const evs = drive(sim, STEP, frame(), clock);
      if (ofType(evs, 'boss').some(e => e.what === 'turn')) turns.push(k.side);
    }
    expect(turns.length).toBeGreaterThanOrEqual(1);
    expect(turns[0]).toBe(-side0);
    expect(sim.koszmar).toBe('banished');
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('flees at the night\'s end if not banished (never a loss); the dawn settles the night', () => {
    const sim = later({ planned: 60 });
    drive(sim, 61, frame());
    expect(sim.koszmar).toBe('fled');
    expect(sim.phase).toBe('done');
    expect(sim.p.sessions).toBe(6);
  });
});

describe('the meta', () => {
  it('ranks the angel by all feathers ever and furnishes the room with each rank', () => {
    expect(rankOf(0)).toBe(0);
    expect(rankOf(RULES.ranks[1])).toBe(1);
    expect(rankOf(99999)).toBe(RULES.ranks.length - 1);
    expect(nextRankAt(0)).toBe(RULES.ranks[1]);
    expect(nextRankAt(99999)).toBeNull();
    expect(roomItems(0)).toEqual([]);
    expect(roomItems(3)).toEqual(ROOM.slice(0, 3));
    expect(RANKS).toHaveLength(RULES.ranks.length);
  });

  it('settles once: sessions, the total, feathers with the day\'s gift, a new rank', () => {
    const sim = makeSim({ planned: 40, progress: { feathers: RULES.ranks[1] - 5 } });
    drive(sim, 10, frame());
    sim.finish();
    const evs = sim.take();
    expect(ofType(evs, 'dayGift')).toHaveLength(1);
    expect(ofType(evs, 'rank')).toHaveLength(1);
    const p = sim.p;
    expect(p.sessions).toBe(1);
    expect(p.feathers).toBe(RULES.ranks[1] - 5 + sim.feathers + RULES.dayGift);
    expect(p.wallet).toBe(sim.feathers + RULES.dayGift);
    expect(p.night).toBe(1);
    expect(p.stars[0]).toBeGreaterThanOrEqual(1);
    expect(p.giftDay).toBe(DAY);
    const before = JSON.stringify(p);
    sim.finish();
    sim.result();
    sim.result();
    expect(p.sessions).toBe(1);
    expect(p.total).toBe(sim.score);
    expect(JSON.parse(before).feathers).toBe(p.feathers);
  });
});

describe('the summary', () => {
  it('result() is idempotent and the record uses Math.max', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 2 } } });
    drive(sim, 10, frame(), { t: 0 }, () => { sim.strike(0); });
    const r1 = sim.result(), r2 = sim.result();
    expect(r2).toEqual(r1);
    expect(sim.p.best['40']).toBe(Math.max(2, sim.score));
    expect(r1.record).toBe(sim.score > 2);
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    for (const id of ['mat18.10', 'psa34.7', 'jhn1.5', 'psa91.5', 'pro3.24', 'psa121.4', 'psa4.8', 'heb1.14', 'psa127.2'] as const) {
      expect(passage(id).text.length).toBeGreaterThan(10);
    }
    expect(makeSim().closingVerse()).toBe('mat18.10');
    const sim = later();
    expect(sim.closingVerse()).toBe('psa127.2');
    sim.flames = 1;
    expect(['psa34.7', 'psa127.2']).toContain(sim.closingVerse());
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 zmora, 3 zmory, 5 zmór)', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['zmora', 'zmory', 'zmór', 'zmory', 'zmór']);
    expect(t('zmory', { n: 12 })).toBe('12 zmór');
    expect(CATALOGS.en.zmory).toEqual({ one: '{n} nightmare', other: '{n} nightmares' });
  });

  it('never asks to concentrate harder, never uses holiness words or "hack"', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/]) {
        expect(all).not.toMatch(word);
      }
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the canvas centre every 0.65 s (strikes the nearer side), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<AniolProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, inReachAt = Infinity, at22 = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.strike(0);
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
      if (inReachAt === Infinity && sim.zmory.some(z => z.d - z.r <= sim.reach)) inReachAt = t;
      at22 = sim.result().score;
    }
    return { inReachAt, at22 };
  }

  it('brings the first Zmora in reach within ~4 s and banishes some by 22 s, on either band', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 8; seed++) {
        const r = smoke({}, seed, eeg);
        expect(r.inReachAt, `eeg ${eeg}, seed ${seed}`).toBeLessThan(4);
        expect(r.at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(3);
      }
    }
    expect(smoke({ sessions: 6, giftDay: DAY }, 3, false, 300).at22).toBeGreaterThan(3);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/aniol/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(30);
    p.lastLen = 600;
    expect(mod.best(p)).toBe(45);
    expect(mod.unit!(2)).toBe('zmory');
    expect(mod.unit!(5)).toBe('zmór');
  });

  it('builds the progress card from elements: the rank, the room\'s seven things, the dreams, the tree', async () => {
    const { progressPanel } = await import('../src/arcade/aniol/panel');
    const p = { ...freshProgress(), sessions: 3, feathers: RULES.ranks[2] + 1, total: 120, wallet: 60, night: 4, stars: [1, 2, 3, 1] };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(ROOM.length);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(2);
    expect(el.textContent).toContain(RANKS[2]);
    expect(el.querySelectorAll('[data-up]')).toHaveLength(6);
    const buy = el.querySelector<HTMLButtonElement>('[data-up="reach"] button')!;
    expect(buy.disabled).toBe(false);
    buy.click();
    expect(p.up.reach).toBe(1);
    expect(p.wallet).toBe(60 - RULES.upCost[0]);
    expect(saved).toBe(1);
    const locked = el.querySelector<HTMLButtonElement>('[data-up="flame"] button');
    expect(locked?.disabled ?? true).toBe(true);
  });

  it('teaches how to play in four languages: a goal, three controls, two tips', async () => {
    const mod = (await import('../src/arcade/aniol/index')).default;
    const h = mod.howto!();
    expect(h.goal.length).toBeGreaterThan(10);
    expect(h.hands.map(x => x.gesture)).toEqual(['tap', 'tap', 'keys']);
    expect(h.tips).toHaveLength(2);
  });
});

describe('v2: the perfect window, close calls, armour without the band', () => {
  it('a hit as the Zmora enters the reach is perfect: +2 on the combo and a feather more', () => {
    const sim = later();
    quiet(sim);
    const z = place(sim, 'mara', 1, sim.reach + ZMORY.mara.r - 0.1);
    sim.strike(1);
    const hit = ofType(sim.take(), 'hit')[0];
    expect(hit.perfect).toBe(true);
    expect(z.state).toBe('gone');
    expect(sim.combo).toBe(2);
    expect(sim.perfects).toBe(1);
    place(sim, 'mara', 1, 1.8);
    sim.strike(1);
    expect(ofType(sim.take(), 'hit')[0].perfect).toBe(false);
    expect(sim.combo).toBe(3);
  });

  it('counts a Zmora struck right at the bed as a close call', () => {
    const sim = later();
    quiet(sim);
    place(sim, 'mara', -1, RULES.bedHalf + ZMORY.mara.r + 0.2);
    sim.strike(-1);
    expect(ofType(sim.take(), 'close')).toHaveLength(1);
    expect(sim.closeCalls).toBe(1);
  });

  it('cracks armour after three bounces even with no signal at all', () => {
    const sim = later();
    quiet(sim);
    const p = place(sim, 'pancerna', 1, 2.0);
    for (let i = 0; i < RULES.crackBounces; i++) {
      p.d = 2.0;
      sim.recover = 0;
      sim.strike(1);
    }
    expect(p.armoured).toBe(false);
    p.d = 2.0;
    sim.strike(1);
    sim.strike(1);
    expect(p.state).toBe('gone');
  });

  it('a touch at the bed breaks the combo', () => {
    const sim = later();
    quiet(sim);
    sim.combo = 12;
    place(sim, 'mara', 1, RULES.bedHalf + ZMORY.mara.r + 0.02);
    drive(sim, 0.1, frame());
    expect(sim.combo).toBe(0);
  });
});

describe('v2: the new nightmares', () => {
  it('Fikołek: after the first hit it somersaults over the bed and is struck on the other side', () => {
    const sim = later();
    quiet(sim);
    const f = place(sim, 'fikolek', -1, 2.0);
    sim.strike(-1);
    expect(ofType(sim.take(), 'flip')).toHaveLength(1);
    expect(f.flip).toBeGreaterThan(0);
    // over the bed it cannot be struck and does not touch the bed
    drive(sim, RULES.flipSec / 2, frame());
    expect(f.z).toBeGreaterThan(RULES.airHit);
    const sen = sim.sen;
    drive(sim, RULES.flipSec / 2 + 0.05, frame());
    expect(sim.sen).toBe(sen);
    expect(f.side).toBe(1);
    expect(f.d).toBeGreaterThan(RULES.flipTo - 0.3);
    f.d = 2.0;
    sim.recover = 0;
    sim.strike(1);
    expect(f.state).toBe('gone');
    expect(sim.score).toBe(1);
  });

  it('Kleks: stops out of reach, puffs and spits; the drop struck back banishes it, a drop at the bed dims Sen', () => {
    const sim = later();
    quiet(sim);
    const k = place(sim, 'kleks', 1, RULES.kleksStop + 0.3);
    let evs = drive(sim, 4, frame());
    expect(k.d - k.r).toBeGreaterThan(sim.reach);
    expect(ofType(evs, 'spit').length).toBeGreaterThanOrEqual(1);
    // strike when the drop is in reach
    let guard = 0;
    while (!sim.drops.some(o => o.dir < 0 && o.d <= sim.reach) && guard++ < 600) evs = drive(sim, STEP, frame());
    sim.recover = 0;
    sim.strike(1);
    expect(ofType(sim.take(), 'deflect')).toHaveLength(1);
    evs = drive(sim, 1, frame());
    expect(k.state).toBe('gone');
    expect(ofType(evs, 'banish').some(e => e.via === 'deflect')).toBe(true);
    // a drop left alone splashes the dream
    const k2 = place(sim, 'kleks', -1, RULES.kleksStop);
    k2.spitT = 0;
    const before = sim.sen;
    evs = drive(sim, 3, frame());
    expect(ofType(evs, 'splash').length).toBeGreaterThanOrEqual(1);
    expect(sim.sen).toBeLessThan(before);
  });

  it('Ciągutek: at the bed it holds on and dims Sen slowly until three quick hits free it', () => {
    const sim = later();
    quiet(sim);
    const c = place(sim, 'ciagutek', 1, RULES.bedHalf + ZMORY.ciagutek.r + 0.02);
    let evs = drive(sim, 0.1, frame());
    expect(ofType(evs, 'grab')).toHaveLength(1);
    expect(c.grab).toBe(true);
    const s0 = sim.sen;
    drive(sim, 2, frame());
    expect(sim.sen).toBeLessThan(s0);
    expect(sim.sen).toBeGreaterThan(s0 - 0.2);
    for (let i = 0; i < 3; i++) {
      sim.recover = 0;
      sim.strike(1);
      evs = drive(sim, 0.1, frame());
    }
    expect(c.state).toBe('gone');
  });

  it('every new kind comes in with its dream (one or two a dream)', () => {
    const kinds = (night: number) => kindMix(night, 1, false).map(m => m[0]);
    expect(kinds(0)).not.toContain('kleks');
    expect(kinds(3)).toContain('kleks');
    expect(kinds(6)).toContain('fikolek');
    expect(kinds(7)).toContain('szept');
    expect(kinds(9)).toContain('ciagutek');
    expect(chapterOf(0)).toBe(0);
    expect(chapterOf(3)).toBe(1);
    expect(chapterOf(99)).toBe(CHAPTERS.length - 1);
    expect(nightInChapter(4)).toBe(2);
  });
});

describe('v2: Płomień gives Skrzydła ognia', () => {
  it('for a few seconds every strike pierces its side and hits double', () => {
    const sim = later();
    quiet(sim);
    (sim as unknown as { flame(): void }).flame();
    expect(sim.glory).toBeCloseTo(RULES.glorySec);
    sim.take();
    for (const d of [2.0, 3.0, 4.2]) place(sim, 'widmo', 1, d);
    sim.strike(1);
    expect(ofType(sim.take(), 'banish')).toHaveLength(3);
    const evs = drive(sim, RULES.glorySec + 0.5, frame());
    expect(ofType(evs, 'glory').some(e => !e.on)).toBe(true);
  });
});

describe('v2: the dreams\' great nightmares', () => {
  /** Plays a finale with a striker that waits for the right moment (a drop in reach, a boss at the bed). */
  function finale(night: number, planned = 300) {
    const sim = later({ planned, progress: { night } });
    const clock = { t: 0 };
    let all: SimEvent[] = [];
    while (sim.phase === 'play') all.push(...drive(sim, STEP, frame(), clock));
    all = all.slice(all.findIndex(e => e.type === 'finale'));
    // the plain angel (no gifts of the night): only the boss's openings reach it
    for (const k of Object.keys(sim.taken)) delete sim.taken[k as keyof typeof sim.taken];
    sim.choice = null;
    let guard = 0;
    while (sim.phase === 'finale' && guard++ < 60 * 30) {
      for (const side of [-1, 1] as const) {
        const drop = sim.drops.some(o => o.dir < 0 && o.side === side && o.d <= sim.reach);
        const z = sim.zmory.some(x => x.side === side && x.state === 'walk' && x.d - x.r <= sim.reach && x.z <= RULES.airHit && x.flip <= 0 && !x.turning
          && !(x.boss && sim.boss && (sim.boss.move === 'sea' || sim.boss.move === 'hop')));
        if ((drop || z) && sim.recover <= 0) sim.strike(side);
      }
      all.push(...drive(sim, STEP, frame(), clock));
    }
    return { sim, all };
  }

  it('each dream has its own: Koszmar, Kufer, Wilk, Ośmiornica, Burza', () => {
    expect(CHAPTERS.map(c => c.boss)).toEqual(['koszmar', 'kufer', 'wilk', 'osmiornica', 'burza']);
    for (const c of CHAPTERS) expect(passage(c.verse).text.length).toBeGreaterThan(10);
  });

  it('a well-timed defence banishes every one of them, through its second phase', () => {
    for (const night of [0, 3, 6, 9, 12]) {
      const { sim, all } = finale(night);
      const boss = ofType(all, 'boss');
      expect(boss.some(e => e.what === 'phase'), `night ${night}`).toBe(true);
      expect(sim.koszmar, `night ${night}`).toBe('banished');
      expect(sim.phase).toBe('done');
      expect(sim.nightStars).toBeGreaterThanOrEqual(2);
    }
  });

  it('telegraphs its moves: the Wilk crouches before it dashes; the Kufer winds up before it spits', () => {
    const w = finale(6).all.filter(e => e.type === 'boss').map(e => (e as { what: string }).what);
    const firstDash = w.indexOf('dash');
    expect(firstDash).toBeGreaterThan(0);
    expect(w.slice(0, firstDash)).toContain('wind');
    const k = finale(3).all;
    const i = k.findIndex(e => e.type === 'spit');
    expect(k.slice(0, i).some(e => e.type === 'boss' && e.what === 'wind')).toBe(true);
  });

  it('the Ośmiornica reaches with arms from both sides; banished arms hurt it', () => {
    const { all } = finale(9);
    const sides = new Set(ofType(all, 'spawn').filter(e => e.kind === 'ramie').map(e => e.side));
    expect(sides.size).toBe(2);
    expect(ofType(all, 'boss').some(e => e.what === 'hurt')).toBe(true);
  });

  it('flees at dawn when not banished, never a loss', () => {
    const sim = later({ planned: 300, progress: { night: 6 } });
    drive(sim, 301, frame());
    expect(sim.koszmar).toBe('fled');
    expect(sim.phase).toBe('done');
    expect(sim.nightStars).toBeGreaterThanOrEqual(1);
  });
});

describe('v2: the standard HUD (signal, meter, headline)', () => {
  it('says the block, its seconds left and the next block during the telegraph', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, 1, frame(), clock);
    let s = sim.signal();
    expect(s.want).toBe('focus');
    expect(s.left).toBeCloseTo(sim.block.dur - 1, 0);
    expect(s.next).toBeNull();
    expect(s.task!.length).toBeGreaterThan(5);
    while (sim.blockT < sim.block.dur - 2) drive(sim, STEP, frame(), clock);
    s = sim.signal();
    expect(s.next).toBe('rest');
  });

  it('the gauge is the aura\'s reach in a Czuwanie (0.5 at the dotted ring), calm in the lullaby, hidden when blind or without signal', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 1, HIGH);
    expect(sim.meter()).toBeNull();   // the band's delay
    drive(sim, 8, frame({ level: 0.5 }));
    expect(sim.meter()!).toBeCloseTo(0.5, 1);
    drive(sim, 4, HIGH);
    expect(sim.meter()!).toBeGreaterThan(0.8);
    drive(sim, 1, frame({ reliable: false, activity: null }));
    expect(sim.meter()).toBeNull();
    toBlock(sim, 1, CALM);
    drive(sim, 3, CALM);
    expect(sim.meter()!).toBeGreaterThan(0.6);
  });

  it('the headline is the live score (the same as result().score) with a combo or the night under it', () => {
    const sim = later();
    quiet(sim);
    expect(sim.headline().sub).toContain(t('ch.pokoj'));
    for (let i = 0; i < 3; i++) {
      place(sim, 'mara', 1, 2.0);
      sim.recover = 0;
      sim.strike(1);
    }
    expect(sim.headline().value).toBe(3);
    expect(sim.result().score).toBe(3);
    expect(sim.headline().sub).toBe(t('sub.combo', { n: 3, m: 1 }));
  });
});

describe('v2: coach marks, Pan Guzik and the story', () => {
  it('teaches the first session one mark at a time, each once ever', () => {
    const sim = makeSim({ planned: 300 });
    const evs = drive(sim, 25, frame(), { t: 0 }, () => { if (sim.zmory.some(z => z.d - z.r <= sim.reach)) sim.strike(0); });
    const marks = ofType(evs, 'coach');
    expect(marks[0].key).toBe('coach.tap');
    expect(marks[0].at).toHaveProperty('z');
    expect(marks.map(m => m.key)).toContain('coach.middle');
    expect(new Set(marks.map(m => m.key)).size).toBe(marks.length);
    // the next night: none of those again
    const next = makeSim({ planned: 300, progress: { ...sim.p, sessions: 1 } });
    const again = ofType(drive(next, 25, frame(), { t: 0 }, () => next.strike(0)), 'coach').map(m => m.key);
    for (const m of marks) expect(again).not.toContain(m.key);
  });

  it('opens with the story card (the first night, then the dream\'s), and the bear talks one line at a time, never over the banner', () => {
    const sim = makeSim({ planned: 300 });
    const story = ofType(sim.take(), 'story');
    expect(story[0]).toMatchObject({ kind: 'open', chapter: 0 });
    const clock = { t: 0 };
    let says = 0;
    drive(sim, 200, frame(), clock, () => {
      for (const e of sim.take()) {
        if (e.type !== 'say') continue;
        says++;
        const b = sim.block;
        if (sim.phase === 'play' && b.kind !== 'warmup' && e.moment !== 'open') {
          expect(sim.blockT, e.moment).toBeGreaterThanOrEqual(RULES.quietStart - 0.01);
        }
      }
    });
    expect(says).toBeGreaterThanOrEqual(4);
    const later2 = makeSim({ planned: 300, progress: { sessions: 3, night: 3, seen: ['story.open'] } });
    expect(ofType(later2.take(), 'story')[0]).toMatchObject({ kind: 'chapter', chapter: 1 });
  });

  it('has three or more lines a moment, each short enough for a bubble, in every language', () => {
    for (const m of Object.keys(LINES) as Moment[]) {
      expect(LINES[m]).toBeGreaterThanOrEqual(3);
      for (const cat of Object.values(CATALOGS)) {
        for (let i = 1; i <= LINES[m]; i++) {
          const v = (cat as Record<string, unknown>)[`say.${m}.${i}`];
          expect(typeof v, `${m}.${i}`).toBe('string');
          expect((v as string).length, `${m}.${i}: ${v}`).toBeLessThanOrEqual(90);
        }
      }
      expect(line(m, 1)).not.toBe(line(m, 2));
    }
  });
});

describe('v2: the meta (old saves, the tree, the dreams)', () => {
  it('migrates a version-1 save from a device: records, sessions and feathers kept, the dreams start, a welcome in the wallet', () => {
    // a real version-1 save, merged over the fresh defaults the way the app loads it (mergeSaved)
    const v1 = {
      v: 1, sessions: 7, total: 213, feathers: 640, pushes: 15, best: { 180: 31, 300: 44, junk: 'x' }, lastLen: 300,
      bestCombo: 27, bestLevel: 5, koszmary: 3, flames: 4, calmNights: 2, giftDay: '2026-11-05',
    };
    const p = { ...freshProgress(), ...v1 } as unknown as AniolProgress;
    migrate(p);
    expect(p.ver).toBe(2);
    expect('v' in p).toBe(false);
    expect(p.sessions).toBe(7);
    expect(p.best).toEqual({ 180: 31, 300: 44 });
    expect(p.feathers).toBe(640);
    expect(p.wallet).toBe(RULES.welcome);
    expect(p.night).toBe(0);
    expect(p.up).toEqual({ reach: 0, perfect: 0, aura: 0, flame: 0, sen: 0, lull: 0 });
    expect(bestOf(p)).toBe(44);
    // a migrated save plays a night
    const sim = makeSim({ progress: p, planned: 40 });
    drive(sim, 41, frame());
    expect(sim.p.sessions).toBe(8);
    // a second migrate keeps a version-2 save as it is
    const copy = JSON.parse(JSON.stringify(sim.p));
    migrate(sim.p);
    expect(sim.p).toEqual(copy);
  });

  it('never crashes on fields of a wrong type', () => {
    const bad = { ...freshProgress(), ver: 2, up: 'nope', stars: { 0: 3 }, seen: [1, 'coach.tap'], wallet: '12', night: -3, best: [5] } as unknown as AniolProgress;
    migrate(bad);
    expect(bad.up.reach).toBe(0);
    expect(bad.stars).toEqual([]);
    expect(bad.seen).toEqual(['coach.tap']);
    expect(bad.wallet).toBe(0);
    expect(bad.night).toBe(0);
    expect(bad.best).toEqual({});
  });

  it('the tree: prices climb, a branch\'s second node needs the first, the numbers act in the night', () => {
    const p = { ...freshProgress(), wallet: 1000 };
    expect(upPrice(p, 'reach')).toBe(RULES.upCost[0]);
    expect(canBuy(p, 'perfect')).toBe(false);
    expect(buyUp(p, 'reach')).toBe(true);
    expect(canBuy(p, 'perfect')).toBe(true);
    expect(upPrice(p, 'reach')).toBe(RULES.upCost[1]);
    for (let i = 0; i < 5; i++) buyUp(p, 'reach');
    expect(p.up.reach).toBe(RULES.upMax);
    expect(upPrice(p, 'reach')).toBeNull();
    expect(p.wallet).toBe(1000 - RULES.upCost.reduce((s, c) => s + c, 0));
    const poor = { ...freshProgress(), wallet: 5 };
    expect(buyUp(poor, 'aura')).toBe(false);
    const sim = later({ progress: { up: { reach: 2, perfect: 0, aura: 1, flame: 1, sen: 3, lull: 0 } } });
    expect(sim.reach).toBeCloseTo(RULES.reach + 2 * RULES.up.reach);
    expect(sim.auraWide).toBeCloseTo(1 + RULES.up.aura);
    expect(sim.flameNeed).toBeCloseTo(5 * (1 - RULES.up.flame));
  });

  it('moves the campaign a night on with each session and keeps the best stars', () => {
    const sim = later({ planned: 60, progress: { night: 2, stars: [3, 2, 3] } });
    expect(sim.chapterIndex).toBe(0);
    drive(sim, 61, frame());
    expect(sim.p.night).toBe(3);
    expect(sim.p.stars[2]).toBe(3);
    const r = sim.result();
    expect(r.highlights[r.highlights.length - 1]).toBe(t('hl.nextDream', { dream: t('ch.strych') }));
  });
});
