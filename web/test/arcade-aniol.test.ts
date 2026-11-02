import { describe, expect, it } from 'vitest';
import { RANKS, ROOM, ZMORY } from '../src/arcade/aniol/content';
import { CATALOGS, t, unit } from '../src/arcade/aniol/i18n';
import { bestOf, freshProgress, giftPool, nextRankAt, rankOf, roomItems, type AniolProgress } from '../src/arcade/aniol/meta';
import { RULES } from '../src/arcade/aniol/rules';
import { AURA_MARK, AniolSim, auraDps, auraFor, comboMult, finaleFor, levelNeed, planBlocks, type SimEvent, type Zmora } from '../src/arcade/aniol/sim';
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

  it('builds a combo ×2 from 10 hits and ×3 from 25 (feathers, not the count)', () => {
    expect([0, 9, 10, 24, 25, 60].map(comboMult)).toEqual([1, 1, 2, 2, 3, 3]);
    const sim = later();
    quiet(sim);
    sim.combo = 9;
    place(sim, 'mara', 1, 2.0);
    sim.strike(1);
    const evs = sim.take();
    expect(ofType(evs, 'combo')[0]).toMatchObject({ n: 10, mult: 2 });
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
    for (let i = 0; i < RULES.levelBase; i++) {
      place(sim, 'mara', 1, 2.0);
      sim.recover = 0;
      sim.strike(1);
    }
    const lv = ofType(sim.take(), 'level');
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
      if (ofType(evs, 'koszmar').some(e => e.what === 'turn')) turns.push(k.side);
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

  it('builds the progress card from elements: the rank, the room\'s seven things, the gifts', async () => {
    const { progressPanel } = await import('../src/arcade/aniol/panel');
    const p = { ...freshProgress(), sessions: 3, feathers: RULES.ranks[2] + 1, total: 120 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(ROOM.length);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(2);
    expect(el.textContent).toContain(RANKS[2]);
  });
});
