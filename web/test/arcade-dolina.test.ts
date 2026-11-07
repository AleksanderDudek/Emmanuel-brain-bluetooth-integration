import { describe, expect, it } from 'vitest';
import { SAY, lineSec } from '../src/arcade/dolina/companion';
import { ERAS, LOOKS, SEQ, UPGRADES } from '../src/arcade/dolina/content';
import { CATALOGS, t } from '../src/arcade/dolina/i18n';
import { bestOf, buyUp, freshProgress, lookOf, startEraOf, startEras, upLevel, upPrice, type DolinaProgress } from '../src/arcade/dolina/meta';
import { RULES } from '../src/arcade/dolina/rules';
import {
  DolinaSim, LAMP_MARK, assignGuards, comboMult, finaleFor, guardHpFor, harmFor, lampFor, lightDps, planBlocks, swordFor,
  type SimEvent, type Shadow,
} from '../src/arcade/dolina/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<DolinaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): DolinaSim {
  const sim = new DolinaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no day's gift): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, giftDay: DAY, pushes: 1, ...o.progress } });

function drive(sim: DolinaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** An empty road with nothing coming for a while (the rules one at a time). */
function quiet(sim: DolinaSim): void {
  sim.shadows.length = 0;
  sim.features.length = 0;
  sim.shots.length = 0;
  (sim as unknown as { roadX: number }).roadX = 1e9;
}

function toBlock(sim: DolinaSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

const place = (sim: DolinaSim, kind: Shadow['kind'], ahead: number): Shadow => {
  const s = sim.spawn(kind, sim.px + ahead);
  s.state = 'walk';
  sim.take();
  return s;
};

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a meadow, the finale left to the run toward the dawn', () => {
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
  });

  it('brings a guardian in the last push of each era\'s stretch (every push when there are fewer)', () => {
    const plan = planBlocks(600, false, mulberry32(3));
    assignGuards(plan, 3);
    const push = plan.filter(b => b.kind === 'push');
    expect(push.filter(b => b.guard)).toHaveLength(3);
    expect(push[push.length - 1].guard).toBe(true);
    const short = planBlocks(40, false, mulberry32(3));
    assignGuards(short, 3);
    expect(short.filter(b => b.guard)).toHaveLength(1);
  });

  it('telegraphs the next block 4 s ahead and ends with the run toward the dawn', () => {
    const sim = later({ planned: 60 });
    const evs = drive(sim, 61, frame());
    expect(ofType(evs, 'telegraph').length).toBeGreaterThanOrEqual(2);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(ofType(evs, 'done')).toHaveLength(1);
    expect(sim.canStop()).toBe(true);
  });
});

describe('the run', () => {
  it('counts the metres live and never takes them back', () => {
    const sim = later();
    quiet(sim);
    let last = 0;
    drive(sim, 6, frame(), { t: 0 }, () => {
      expect(sim.score).toBeGreaterThanOrEqual(last);
      last = sim.score;
    });
    expect(sim.score).toBeGreaterThan(20);
    expect(sim.result().score).toBe(sim.score);
  });

  it('walks in the meadow and runs in the light', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 4, frame(), clock);
    expect(sim.speed).toBeGreaterThan(RULES.run * 0.9);
    toBlock(sim, 1, frame(), clock);
    drive(sim, 3, frame(), clock);
    expect(sim.restBlock).toBe(true);
    expect(sim.speed).toBeLessThan(RULES.walk * 1.1);
  });

  it('jumps over a pit; standing on, he falls in and climbs out on the far rim with less oil', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 1, frame());
    sim.features.push({ kind: 'pit', x0: sim.px + 1.2, x1: sim.px + 3, hit: false, passed: false });
    sim.jump();
    let evs = drive(sim, 1.2, frame());
    expect(ofType(evs, 'pit')).toHaveLength(0);
    expect(ofType(evs, 'dodge').map(e => e.what)).toContain('jump');
    sim.features.push({ kind: 'pit', x0: sim.px + 1.2, x1: sim.px + 3, hit: false, passed: false });
    const far = sim.features[sim.features.length - 1].x1;
    evs = drive(sim, 2, frame());
    expect(ofType(evs, 'pit')).toHaveLength(1);
    expect(ofType(evs, 'climb')).toHaveLength(1);
    expect(sim.px).toBeGreaterThan(far);
    expect(sim.oil).toBeCloseTo(1 - RULES.harm.pit, 5);
  });

  it('jumps a moment after leaving the edge (coyote time) and from a press just before landing (buffer)', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 1, frame());
    sim.jump();
    drive(sim, 0.58, frame());
    expect(sim.grounded).toBe(false);
    sim.jump();   // buffered: lands, then jumps at once
    const evs = drive(sim, 0.2, frame());
    expect(ofType(evs, 'jump')).toHaveLength(1);
  });

  it('slides under a beam; standing up, it costs oil and a stumble', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 1, frame());
    sim.features.push({ kind: 'beam', x0: sim.px + 0.6, x1: sim.px + 1.05, hit: false, passed: false });
    sim.slide();
    let evs = drive(sim, 0.6, frame());
    expect(ofType(evs, 'harm')).toHaveLength(0);
    expect(ofType(evs, 'dodge').map(e => e.what)).toContain('slide');
    drive(sim, 0.5, frame());
    sim.features.push({ kind: 'beam', x0: sim.px + 0.6, x1: sim.px + 1.05, hit: false, passed: false });
    evs = drive(sim, 0.6, frame());
    expect(ofType(evs, 'harm').map(e => e.kind)).toEqual(['beam']);
  });
});

describe('the sword (touch)', () => {
  it('cuts a shadow in its arc ahead, not one beyond it', () => {
    const sim = later();
    quiet(sim);
    const near = place(sim, 'glinianek', 1.2);
    const far = place(sim, 'glinianek', 5);
    sim.slash();
    const evs = sim.take();
    expect(ofType(evs, 'kill').map(e => e.id)).toEqual([near.id]);
    expect(far.state).toBe('walk');
    expect(sim.kills).toBe(1);
    expect(sim.sparks).toBe(1);
  });

  it('keeps the arc going for a moment: a shadow walking into it is cut', () => {
    const sim = later();
    quiet(sim);
    const s = place(sim, 'glinianek', swordFor(0, false) + RULES.halfW + s0r() + 0.15);
    sim.slash();
    drive(sim, RULES.slashActive, frame());
    expect(s.state).toBe('gone');
  });

  it('breaks a squire\'s soot shield first; the second slash cuts', () => {
    const sim = later();
    quiet(sim);
    const g = place(sim, 'giermek', 1.0);
    sim.slash();
    let evs = sim.take();
    expect(ofType(evs, 'shieldBreak')).toHaveLength(1);
    expect(g.state).toBe('walk');
    g.x = sim.px + 9;
    drive(sim, 0.4, frame());
    g.x = sim.px + 1.0;
    sim.slash();
    evs = sim.take();
    expect(ofType(evs, 'kill').map(e => e.id)).toEqual([g.id]);
  });

  it('cuts a thrown brick out of the air', () => {
    const sim = later();
    quiet(sim);
    const c = place(sim, 'ceglomiot', 4);
    c.throwT = 0;
    let evs = drive(sim, 0.1, frame());
    expect(ofType(evs, 'throw')).toHaveLength(1);
    evs = [];
    for (let i = 0; i < 80 && sim.shots.length; i++) {
      if (sim.shots[0].x - sim.px < 1.3) sim.slash();
      evs.push(...drive(sim, STEP, frame()));
    }
    expect(ofType(evs, 'shotBreak').map(e => e.via)).toContain('slash');
    expect(ofType(evs, 'harm')).toHaveLength(0);
  });

  it('builds a combo: sparks ×2 from 8 kills, ×3 from 20; a hit taken resets it', () => {
    expect([0, 7, 8, 19, 20].map(comboMult)).toEqual([1, 1, 2, 2, 3]);
    const sim = later();
    quiet(sim);
    sim.combo = 7;
    place(sim, 'glinianek', 1);
    sim.slash();
    const evs = sim.take();
    expect(ofType(evs, 'combo')[0]?.mult).toBe(2);
    expect(ofType(evs, 'kill')[0].sparks).toBe(2);
    drive(sim, 0.3, frame());
    place(sim, 'glinianek', 0.1);
    drive(sim, 0.3, frame());
    expect(sim.combo).toBe(0);
  });

  it('holds the world still for a moment on a kill (hit-stop)', () => {
    const sim = later();
    quiet(sim);
    place(sim, 'glinianek', 1);
    sim.slash();
    sim.take();
    const x = sim.px;
    drive(sim, RULES.stopKill * 0.8, frame());
    expect(sim.px).toBe(x);
  });
});

describe('the lamp (the live gauge)', () => {
  it('reaches lampMin + level × lampExtra, the dotted mark at level 0.5, no light at or below it', () => {
    expect(lampFor(0)).toBe(RULES.lampMin);
    expect(lampFor(1)).toBeCloseTo(RULES.lampMin + RULES.lampExtra);
    expect(LAMP_MARK).toBeCloseTo(RULES.lampMin + RULES.lampExtra / 2);
    expect(lightDps(0.5)).toBe(0);
    expect(lightDps(1)).toBeCloseTo(RULES.lightDps);
    expect(swordFor(0.95, true)).toBeGreaterThan(swordFor(0.95, false));
    expect(swordFor(0.4, true)).toBe(swordFor(0.4, false));
  });

  it('answers the level only in a sighted Światło past its lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      quiet(sim);
      drive(sim, eeg ? 1.5 : 4.5, HIGH);
      expect(sim.lampLook).toBe('wait');
      drive(sim, 3, HIGH);
      expect(sim.lampLook).toBe('live');
      expect(sim.lampR).toBeGreaterThan(LAMP_MARK);
    }
  });

  it('rests small and grey while the signal is unreliable — never a loss', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 8, NONE);
    expect(sim.lampLook).toBe('grey');
    expect(sim.lampR).toBeCloseTo(RULES.lampMin, 1);
    expect(sim.oil).toBe(1);
  });

  it('slows the shadows in its light and burns them above the threshold; below it only slows', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 6, HIGH);
    const s = place(sim, 'glinianek', 3);
    s.hp = 50;
    drive(sim, 0.5, HIGH);
    expect(s.inLight).toBe(true);
    expect(s.burn).toBeGreaterThan(0.3);
    const low = later();
    quiet(low);
    drive(low, 6, frame({ level: 0.45 }));
    const s2 = place(low, 'glinianek', 2.2);
    s2.hp = 50;
    const x0 = s2.x;
    drive(low, 0.3, frame({ level: 0.45 }));
    expect(s2.inLight).toBe(true);
    expect(s2.burn).toBe(0);
    expect(x0 - s2.x).toBeLessThan(SHADOWS_SPEED * 0.3 * 0.7);
  });

  it('cracks a squire\'s shield in the light above the threshold', () => {
    const sim = later();
    quiet(sim);
    drive(sim, 6, HIGH);
    const g = place(sim, 'giermek', 6.2);
    const evs = drive(sim, 0.95, HIGH);
    expect(g.shield).toBe(false);
    expect(ofType(evs, 'shieldBreak').map(e => e.via)).toContain('light');
  });
});

describe('the Świt (hold)', () => {
  it('after a hold of 5 s (Mendi) dissolves every shadow on screen; 3 s on HALO; never before the lead-in', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      quiet(sim);
      const clock = { t: 0 };
      const hold = (tt: number) => frame({ level: 0.9, activity: 6, focused: true, hold: Math.max(0, tt - sim.leadIn) });
      drive(sim, sim.leadIn + 0.2, hold, clock);
      const a = place(sim, 'glinianek', 14);
      const b = place(sim, 'kruk', 16);
      a.hp = b.hp = 99;
      const evs = drive(sim, sim.dawnNeed + 0.1, hold, clock);
      expect(ofType(evs, 'dawn'), `eeg ${eeg}`).toHaveLength(1);
      expect(a.state).toBe('gone');
      expect(b.state).toBe('gone');
      expect(sim.dawns).toBe(1);
    }
  });
});

describe('the Świt counts only the block\'s own hold', () => {
  it('a focus held through the meadow before it does not light a Świt at the lead-in (HALO: 2 s lead-in, 3 s hold)', () => {
    const sim = later({ eeg: true });
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const start = clock.t;
    // a hold that began 20 s before the block
    const held = (tt: number) => frame({ level: 0.9, activity: 6, focused: true, hold: 20 + tt - start });
    expect(ofType(drive(sim, sim.leadIn + 0.5, held, clock), 'dawn')).toHaveLength(0);
    expect(ofType(drive(sim, 1, held, clock), 'dawn')).toHaveLength(1);
  });
});

describe('the lamp\'s burst (left tap)', () => {
  it('stuns the nearest shadow ahead, then needs 3 s', () => {
    const sim = later();
    quiet(sim);
    const s = place(sim, 'glinianek', 3);
    sim.burst();
    let evs = sim.take();
    expect(ofType(evs, 'burst')[0]).toMatchObject({ stunned: 1, ready: true });
    const x = s.x;
    drive(sim, 0.5, frame());
    expect(s.x).toBe(x);
    sim.burst();
    evs = sim.take();
    expect(ofType(evs, 'burst')[0].ready).toBe(false);
    drive(sim, RULES.burstCd, frame());
    sim.burst();
    expect(ofType(sim.take(), 'burst')[0].ready).toBe(true);
  });
});

describe('oil and grace', () => {
  it('drains oil on a touch; with none he falls and rises at a lantern post with half — the run goes on', () => {
    const sim = later();
    quiet(sim);
    sim.oil = 0.1;
    place(sim, 'glinianek', 0.5);
    let evs = drive(sim, 0.3, frame());
    expect(ofType(evs, 'harm')).toHaveLength(1);
    expect(ofType(evs, 'fall')).toHaveLength(1);
    const x = sim.px;
    evs = drive(sim, RULES.fallSec + 0.2, frame());
    expect(ofType(evs, 'rise')).toHaveLength(1);
    expect(sim.oil).toBe(RULES.riseOil);
    expect(sim.px).toBeGreaterThanOrEqual(x);
    expect(sim.phase).toBe('play');
    expect(sim.falls).toBe(1);
  });

  it('never ends the run early however much harm comes', () => {
    const sim = later({ planned: 60 });
    const clock = { t: 0 };
    drive(sim, 50, frame(), clock, () => { if (sim.shadows.length < 3) place(sim, 'glinianek', 0.4); });
    expect(sim.phase).not.toBe('done');
    expect(sim.falls).toBeGreaterThan(0);
    drive(sim, 12, frame(), clock);
    expect(sim.phase).toBe('done');
  });

  it('spills less oil with the jar upgrades', () => {
    expect(harmFor('shadow', 2)).toBeCloseTo(RULES.harm.shadow * 0.8);
  });
});

describe('Pastwisko: the meadow', () => {
  it('clears the road, refills oil and drops oil from calm after the lead-in; a passed one fills the flask', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    sim.oil = 0.4;
    drive(sim, 1, CALM, clock);
    expect(sim.shadows.filter(s => s.state === 'walk' && s.x > sim.px + 1)).toHaveLength(0);
    const evs = toBlock(sim, 2, CALM, clock);
    expect(ofType(evs, 'drop').length).toBeGreaterThan(3);
    expect(ofType(evs, 'restPass')).toHaveLength(1);
    expect(sim.oil).toBe(1);
    const end = evs.findIndex(e => e.type === 'blockEnd');
    expect(ofType(evs.slice(0, end), 'spawn')).toHaveLength(0);
  });

  it('gives no verdict without enough signal (never a loss)', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = toBlock(sim, 2, NONE, clock);
    expect(ofType(evs, 'blockEnd')[0].verdict).toBeNull();
  });
});

describe('Mgła: the blind Światło', () => {
  const blindSim = () => later({ progress: { sessions: 4, pushes: 2 } });

  it('comes every 4th Światło from the 3rd session, never a session\'s first', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    expect(sim.block.blind).toBe(false);
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    expect(later({ progress: { sessions: 1, pushes: 3 } }).plan.some(b => b.blind)).toBe(false);
  });

  it('keeps the lamp a small flame and veils the trace; at its end it reveals and flashes by the judged share', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    drive(sim, 8, HIGH, clock);
    expect(sim.lampLook).toBe('blind');
    expect(sim.lampR).toBeLessThan(RULES.flame + 0.01);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(true);
    const evs = toBlock(sim, 3, HIGH, clock);
    const fl = ofType(evs, 'flash');
    expect(fl).toHaveLength(1);
    expect(fl[0].share).toBeGreaterThan(0.8);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
  });
});

describe('the guardians', () => {
  /** The first guardian of a run from Babel, already fighting. */
  function fight(o: SimOpts = {}) {
    const sim = later(o);
    quiet(sim);
    sim.summon();
    sim.take();
    drive(sim, 2.5, frame());
    return sim;
  }

  it('come in the push block planned for them, with a telegraph and a hint', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    const gi = sim.plan.findIndex(b => b.guard);
    const evs = toBlock(sim, gi, frame(), clock);
    evs.push(...drive(sim, sim.block.dur * 0.6, frame(), clock));
    expect(ofType(evs, 'guard').map(e => e.what)).toContain('come');
    expect(sim.guard?.id).toBe('wieza');
  });

  it('turn slashes away (a clink) until the weak point is open; then every slash counts', () => {
    const sim = fight();
    const g = sim.guard!;
    expect(sim.guardOpen).toBe(false);
    sim.slash();
    expect(ofType(sim.take(), 'clink')).toHaveLength(1);
    expect(g.hp).toBe(g.maxHp);
    g.i = g.seq.indexOf('open');
    g.moveT = 0;
    g.begun = false;
    drive(sim, 0.4, frame());
    expect(sim.guardOpen).toBe(true);
    sim.slash();
    expect(ofType(sim.take(), 'guardHit')).toHaveLength(1);
    expect(g.hp).toBe(g.maxHp - 1);
  });

  it('opens the weak point for 3 s on a Świt', () => {
    const sim = fight();
    const clock = { t: 0 };
    const hold = (tt: number) => frame({ level: 0.9, activity: 6, focused: true, hold: tt });
    const evs = drive(sim, 5.5, hold, clock);
    expect(ofType(evs, 'dawn')[0]?.guard).toBe(true);
    expect(sim.guard!.dawnOpen).toBeGreaterThan(2);
    expect(sim.guardOpen).toBe(true);
  });

  it('the tower rains bricks that a slash breaks', () => {
    const sim = fight();
    let broke = 0;
    for (let i = 0; i < 60 * 4; i++) {
      const rain = sim.shots.find(s => s.kind === 'rain' && s.wait === 0 && s.y < 2.3);
      if (rain) sim.slash();
      broke += ofType(drive(sim, STEP, frame()), 'shotBreak').filter(e => e.via === 'slash').length;
    }
    expect(broke).toBeGreaterThanOrEqual(2);
    expect(sim.oil).toBeGreaterThan(0.6);
  });

  it('the knight\'s blows are parried by a slash as they land', () => {
    const sim = later({ progress: { startEra: 1, reached: 1 } });
    quiet(sim);
    expect(sim.era).toBe('twierdza');
    sim.summon();
    sim.take();
    drive(sim, 2.5, frame());
    const g = sim.guard!;
    expect(g.id).toBe('rycerz');
    let parries = 0;
    for (let i = 0; i < 60 * 4; i++) {
      if (g.seq[g.i] === 'strike' && !g.acted && g.moveT >= RULES.moves.strike.tele - 0.1) sim.slash();
      parries += ofType(drive(sim, STEP, frame()), 'parry').length;
    }
    expect(parries).toBeGreaterThanOrEqual(2);
  });

  it('beaten, it dissolves and the next era begins; the third opens the dawn gate and a new lap', () => {
    const sim = fight();
    const g = sim.guard!;
    g.hp = 1;
    g.dawnOpen = 2;
    sim.slash();
    let evs = sim.take();
    expect(ofType(evs, 'guard').map(e => e.what)).toContain('beaten');
    expect(sim.era).toBe('twierdza');
    expect(sim.guardsBeaten).toEqual(['wieza']);
    drive(sim, 2, frame());
    expect(sim.guard).toBeNull();
    for (const id of ['rycerz', 'ekran']) {
      quiet(sim);
      (sim as unknown as { blockGuardDone: boolean }).blockGuardDone = false;
      sim.summon();
      drive(sim, 2.2, frame());
      expect(sim.guard!.id).toBe(id);
      sim.guard!.hp = 1;
      sim.guard!.dawnOpen = 2;
      drive(sim, 0.3, frame());
      sim.slash();
      evs = drive(sim, 2, frame());
    }
    expect(ofType(evs, 'gate')).toHaveLength(1);
    expect(sim.lap).toBe(1);
    expect(sim.era).toBe('babel');
    expect(guardHpFor(0, 300, 1)).toBeGreaterThan(guardHpFor(0, 300, 0));
  });

  it('withdraws unbeaten when its block ends, keeping its damage, and comes back in the next push', () => {
    const sim = later({ planned: 300 });
    const clock = { t: 0 };
    const gi = sim.plan.findIndex(b => b.guard);
    toBlock(sim, gi, frame(), clock);
    while (!sim.guard) drive(sim, STEP, frame(), clock);
    sim.guard.hp -= 2;
    const hp = sim.guard.hp;
    const evs = toBlock(sim, gi + 1, frame(), clock);
    expect(ofType(evs, 'guard').map(e => e.what)).toContain('leave');
    toBlock(sim, gi + 2, frame(), clock);
    drive(sim, sim.leadIn + 1.5, frame(), clock);
    expect(sim.guard?.hp).toBeCloseTo(hp, 0);
  });
});

describe('the meta', () => {
  it('buys upgrades with sparks, each level dearer, up to its top', () => {
    const p = freshProgress();
    p.sparks = 1000;
    expect(upPrice('sword', 0)).toBe(RULES.priceBase);
    expect(buyUp(p, 'sword')).toBe(true);
    expect(upLevel(p, 'sword')).toBe(1);
    expect(p.sparks).toBe(1000 - RULES.priceBase);
    expect(upPrice('sword', 1)).toBeGreaterThan(RULES.priceBase);
    p.ups.dawn = RULES.upMax.dawn;
    expect(buyUp(p, 'dawn')).toBe(false);
    p.sparks = 0;
    expect(buyUp(p, 'lamp')).toBe(false);
  });

  it('changes the pilgrim\'s looks by all sparks ever, and opens later eras as starts', () => {
    expect(RULES.looks.map(lookOf)).toEqual([0, 1, 2, 3]);
    expect(LOOKS).toHaveLength(4);
    const p = freshProgress();
    expect(startEras(p)).toEqual(['babel']);
    p.reached = 1;
    p.startEra = 1;
    expect(startEras(p)).toEqual(['babel', 'twierdza']);
    expect(startEraOf(p)).toBe(1);
    p.startEra = 2;
    expect(startEraOf(p)).toBe(1);
  });

  it('settles once: sessions, metres, sparks with the day\'s gift, the eras met', () => {
    const sim = makeSim({ planned: 40 });
    drive(sim, 42, frame());
    const p = sim.p;
    expect(p.sessions).toBe(1);
    expect(p.total).toBe(sim.score);
    expect(p.sparks).toBe(sim.sparks + RULES.dayGift);
    expect(p.giftDay).toBe(DAY);
    expect(p.reached).toBeGreaterThanOrEqual(0);
    sim.finish();
    expect(p.sessions).toBe(1);
    expect(p.total).toBe(sim.score);
  });

  it('starts the run in the chosen era with its own shadows', () => {
    const sim = later({ progress: { reached: 2, startEra: 2 } });
    expect(sim.era).toBe('miasto');
    const evs = drive(sim, 10, frame());
    const kinds = new Set(ofType(evs, 'spawn').map(e => e.kind));
    for (const k of kinds) expect(['pling', 'przewijacz']).toContain(k);
    expect(sim.plan.filter(b => b.guard)).toHaveLength(1);
  });
});

describe('the summary', () => {
  it('result() is idempotent and the record uses Math.max', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 2 } } });
    drive(sim, 10, frame(), { t: 0 }, () => { sim.slash(); });
    const r1 = sim.result(), r2 = sim.result();
    expect(r2).toEqual(r1);
    expect(sim.p.best['40']).toBe(Math.max(2, sim.score));
    expect(r1.record).toBe(sim.score > 2);
    expect(r1.unit).toBe('m');
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    for (const id of ['psa23.4', 'mic7.8', 'jhn8.12', '1pe2.9', 'psa119.105', 'psa23.1-3', 'psa139.12'] as const) {
      expect(passage(id).text.length).toBeGreaterThan(10);
    }
    expect(makeSim().closingVerse()).toBe('psa23.4');
    const sim = later();
    expect(sim.closingVerse()).toBe('psa139.12');
    sim.dawns = 1;
    expect(['jhn8.12', 'psa139.12']).toContain(sim.closingVerse());
  });

  it('ends the highlights with the story\'s closing line', () => {
    const sim = later({ planned: 40 });
    drive(sim, 42, frame());
    const hl = sim.result().highlights;
    expect(hl[hl.length - 1]).toBe(t('close.walk'));
  });
});

describe('Ćma, the companion', () => {
  it('has every line in the catalog, each at most 90 characters', () => {
    for (const cat of Object.values(CATALOGS)) {
      for (const [m, n] of Object.entries(SAY)) {
        for (let i = 1; i <= n; i++) {
          const line = (cat as Record<string, unknown>)[`say.${m}.${i}`];
          expect(typeof line, `say.${m}.${i}`).toBe('string');
          expect((line as string).length, `say.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('speaks one line at a time, never repeats one in a session, and keeps quiet over a telegraph and the banner', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    let quietSpoken = 0;
    const rnd = mulberry32(9);
    drive(sim, 400, (tt: number) => (Math.floor(tt / 20) % 2 ? CALM : HIGH), clock, () => {
      const c = sim.talk.current;
      if (c && c.t < 0.02 && sim.quiet) quietSpoken++;
      if (sim.shadows.length < 2 && rnd() < 0.02) place(sim, 'glinianek', 0.3);
    });
    const said = sim.talk.said.map(l => l.text);
    expect(said.length).toBeGreaterThan(6);
    expect(new Set(said).size).toBe(said.length);
    expect(quietSpoken).toBe(0);
    expect(lineSec('Tak.')).toBe(2);
    expect(lineSec('x'.repeat(90))).toBeLessThanOrEqual(4);
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('names the eras, guardians, upgrades and looks in every language', () => {
    expect(ERAS).toHaveLength(3);
    expect(UPGRADES).toHaveLength(5);
    expect(Object.keys(SEQ)).toEqual(['wieza', 'rycerz', 'ekran']);
    expect(t('sparks', { n: 5 })).toBe('5 iskier');
  });

  it('never asks to concentrate harder, never uses holiness words, "hell" or "hack"', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/, /demon/, /blood/, /krew/, /piekł/, /hölle/, /helvete/]) {
        expect(all).not.toMatch(word);
      }
    }
    expect(Object.values(CATALOGS.en).join(' ').toLowerCase()).not.toMatch(/\bhell\b/);
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at (w/2, h·0.6) every 0.65 s (a slash), Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<DolinaProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, at22 = 0;
    for (let tt = 0; tt < 22 + 1e-9; tt += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-tt / 4)), true, 0.1);
      }
      sim.update(STEP, f, tt);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.slash();
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      sim.take();
      at22 = sim.result().score;
    }
    return { at22, kills: sim.kills };
  }

  it('runs on and counts metres by 22 s, on either band, first-ever or not', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) {
        const r = smoke({}, seed, eeg);
        expect(r.at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(40);
      }
    }
    const r = smoke({ sessions: 6, giftDay: DAY }, 3, false, 300);
    expect(r.at22).toBeGreaterThan(60);
    expect(r.kills).toBeGreaterThan(0);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first run', async () => {
    const mod = (await import('../src/arcade/dolina/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 300, 300: 450 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(300);
    p.lastLen = 600;
    expect(mod.best(p)).toBe(450);
  });

  it('builds the progress card from elements: the look, the start eras, the upgrades that buy', async () => {
    const { progressPanel } = await import('../src/arcade/dolina/panel');
    const p = { ...freshProgress(), sessions: 3, sparks: 100, sparksAll: RULES.looks[1] + 5, reached: 1, total: 1200 };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    expect(el.textContent).toContain(LOOKS[1]);
    expect(el.querySelectorAll('[data-era]')).toHaveLength(3);
    const buy = el.querySelector<HTMLButtonElement>('[data-up="sword"]')!;
    buy.click();
    expect(saved).toBe(1);
    expect(p.ups.sword).toBe(1);
    expect(p.sparks).toBe(100 - RULES.priceBase);
    el.querySelector<HTMLButtonElement>('[data-era="twierdza"]')!.click();
    expect(p.startEra).toBe(1);
  });
});

const SHADOWS_SPEED = 1.0;
function s0r(): number { return 0.32; }
