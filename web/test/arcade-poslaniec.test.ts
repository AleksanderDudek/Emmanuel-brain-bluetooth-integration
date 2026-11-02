import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { CITIES, CLOAKS, MISSIONS, TIPS } from '../src/arcade/poslaniec/content';
import { CATALOGS, km, metres, t } from '../src/arcade/poslaniec/i18n';
import { Gestures, keyMove, swipe, tapAt } from '../src/arcade/poslaniec/input';
import {
  LAP, bestFor, bestOf, citiesBetween, cloakOf, cloaksEarned, freshProgress, postcards, routeAt, toNextCloak, turnPages, type PoslaniecProgress,
} from '../src/arcade/poslaniec/meta';
import { GRAVITY, RULES, jumpV } from '../src/arcade/poslaniec/rules';
import { PoslaniecSim, blindBonus, difficultyFor, planBlocks, speedFor, type SimEvent } from '../src/arcade/poslaniec/sim';
import { PASS, Track, groundAt, type ObKind, type Obstacle } from '../src/arcade/poslaniec/track';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-02';
const STEP = 1 / 60;

const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const focused = (hold: number, level = 0.8): FocusFrame => frame({ activity: 6, level, focused: true, hold, calm: 0.1 });
const calm = (c = 0.8): FocusFrame => frame({ activity: -3, level: 0.1, focused: false, hold: 0, calm: c });

type SimOpts = { progress?: Partial<PoslaniecProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): PoslaniecSim {
  const sim = new PoslaniecSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player's session (no warm-up, not the day's first): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, dailyDay: DAY, giftDay: DAY, pushes: 1, ...o.progress } });

type Clock = { t: number };
function drive(sim: PoslaniecSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock: Clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** An empty road from here on (nothing more is made), for placing obstacles by hand. */
function emptyRoad(sim: PoslaniecSim): void {
  sim.track.obstacles.length = 0;
  sim.track.coins.length = 0;
  sim.track.powers.length = 0;
  sim.track.cursor = 1e9;
}

let obId = 1e6;
function place(sim: PoslaniecSim, kind: ObKind, lane: number, ahead: number, len?: number, o: Partial<Obstacle> = {}): Obstacle {
  const ob: Obstacle = {
    id: ++obId, kind, lane, width: 1, z: sim.z + ahead, len: len ?? (kind === 'cart' ? 5 : kind === 'wagon' ? 18 : 0.7),
    ramp: kind === 'wagon', dir: 1, walking: false, hit: false, cleared: false, born: 0, look: 0, ...o,
  };
  sim.track.obstacles.push(ob);
  return ob;
}

/** Play to the start of block i. */
function toBlock(sim: PoslaniecSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock: Clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

// ── the moves ─────────────────────────────────────────────────────
describe('the moves', () => {
  it('jumps a 0.7 s arc to about 1.45 m, and higher in sandals', () => {
    expect(2 * jumpV(RULES.jumpTop) / GRAVITY).toBeCloseTo(RULES.jumpSec, 5);
    const sim = later();
    emptyRoad(sim);
    const clock = { t: 0 };
    drive(sim, 0.2, frame(), clock);
    sim.act('jump');
    let air = 0, top = 0;
    while (sim.airborne && air < 3) {
      drive(sim, STEP, frame(), clock);
      air += STEP;
      top = Math.max(top, sim.y);
    }
    expect(air).toBeGreaterThan(0.66);
    expect(air).toBeLessThan(0.74);
    expect(top).toBeCloseTo(RULES.jumpTop, 1);
    sim.sandalsT = 5;
    sim.act('jump');
    top = 0;
    drive(sim, 1.2, frame(), clock, () => { top = Math.max(top, sim.y); });
    expect(top).toBeGreaterThan(2.4);
  });

  it('slides for 0.7 s; a slide in the air slams down and slides on landing', () => {
    const sim = later();
    emptyRoad(sim);
    const clock = { t: 0 };
    sim.act('slide');
    expect(sim.sliding).toBe(true);
    drive(sim, 0.65, frame(), clock);
    expect(sim.sliding).toBe(true);
    drive(sim, 0.1, frame(), clock);
    expect(sim.sliding).toBe(false);
    sim.act('jump');
    drive(sim, 0.15, frame(), clock);
    sim.act('slide');
    let down = 0;
    while (sim.airborne && down < 1) { drive(sim, STEP, frame(), clock); down += STEP; }
    expect(down).toBeLessThan(0.15);
    expect(sim.sliding).toBe(true);
  });

  it('changes lanes over about 0.15 s, never past the road\'s edge', () => {
    const sim = later();
    emptyRoad(sim);
    const clock = { t: 0 };
    sim.act('left');
    expect(sim.lane).toBe(-1);
    drive(sim, 0.15, frame(), clock);
    expect(Math.abs(sim.x + 1)).toBeLessThan(0.06);
    const evs = drive(sim, 0.05, frame(), clock, () => undefined);
    sim.act('left');
    expect(sim.lane).toBe(-1);
    expect(ofType([...evs, ...sim.take()], 'bump').length).toBe(1);
  });

  it('is deterministic: the same seed and the same hands give the same run', () => {
    const run = () => {
      const sim = later({ seed: 7 });
      drive(sim, 30, frame(), { t: 0 }, tt => { if (Math.round(tt * 60) % 47 === 0) sim.act(tt % 2 < 1 ? 'left' : 'right'); });
      return [sim.z, sim.x, sim.coins, sim.stumbles];
    };
    expect(run()).toEqual(run());
  });
});

// ── the road ──────────────────────────────────────────────────────
describe('the road', () => {
  /** every slice of road has a lane the runner can pass: free, or a jump, a slide, a wagon's ramp or roof */
  function passable(tr: Track, to: number): number {
    let worst = 3;
    for (let z = 0; z < to; z += 0.5) {
      let ok = 0;
      for (const lane of [-1, 0, 1]) {
        const here = tr.obstacles.filter(o => o.kind !== 'goat' && Math.abs(o.lane - lane) <= (o.width - 1) / 2 + 0.01 && z >= o.z && z <= o.z + o.len);
        if (here.every(o => PASS[o.kind] !== 'lane' || o.kind === 'wagon')) ok++;
      }
      worst = Math.min(worst, ok);
    }
    return worst;
  }

  it('always leaves a passable line, at every difficulty', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const d of [0, 0.4, 1]) {
        const tr = new Track(seed * 977, 0);
        tr.fill(3000, d);
        expect(tr.rowsMade).toBeGreaterThan(20);
        expect(passable(tr, 3000), `seed ${seed}, d ${d}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('makes the same road from the same seed, on any device', () => {
    const a = new Track(99, 0), b = new Track(99, 0), c = new Track(100, 0);
    for (const tr of [a, b, c]) tr.fill(800, 0.5);
    const sig = (tr: Track) => tr.obstacles.map(o => `${o.kind}${o.lane}@${o.z.toFixed(2)}`).join();
    expect(sig(a)).toBe(sig(b));
    expect(sig(a)).not.toBe(sig(c));
  });

  it('grows harder gently with distance: closer rows, more of them filled', () => {
    expect(difficultyFor(0)).toBeCloseTo(RULES.d0);
    expect(difficultyFor(2000)).toBeGreaterThan(0.5);
    expect(difficultyFor(8000)).toBeLessThan(1);
    const count = (d: number) => { const tr = new Track(5, 0); tr.fill(2000, d); return tr.obstacles.length; };
    expect(count(1)).toBeGreaterThan(count(0) * 1.3);
    expect(speedFor(0)).toBe(RULES.vMin);
    expect(speedFor(3000)).toBeGreaterThan(11.5);
    expect(speedFor(1e6)).toBeLessThanOrEqual(RULES.vMax);
  });

  it('teaches the first-ever session: a wall, an arch and a cart in the middle lane, with hints', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.block.kind).toBe('warmup');
    const first = sim.track.obstacles.slice().sort((a, b) => a.z - b.z).slice(0, 3);
    expect(first.map(o => o.kind)).toEqual(['wall', 'arch', 'cart']);
    expect(first.every(o => o.lane === 0)).toBe(true);
    const hints = new Set<string>();
    const acted = new Set<number>();
    drive(sim, 14, frame(), { t: 0 }, () => {
      const hint = sim.lessonHint;
      if (!hint) return;
      hints.add(hint);
      const ob = sim.track.obstacles.find(o => !o.hit && !o.cleared && o.z > sim.z && o.lane === sim.lane);
      if (!ob || acted.has(ob.id)) return;
      const lead = hint === 'jump' ? sim.v * 0.3 : hint === 'slide' ? sim.v * 0.15 : 10;
      if (ob.z - sim.z <= lead) {
        acted.add(ob.id);
        sim.act(hint);
      }
    });
    expect(sim.stumbles).toBe(0);
    expect([...hints].sort()).toEqual(['jump', 'right', 'slide']);
  });

  it('lifts the runner up a wagon\'s ramp onto its roof, and counts the wagon', () => {
    const sim = later();
    emptyRoad(sim);
    place(sim, 'wagon', 0, 6, 18);
    const clock = { t: 0 };
    let top = 0;
    drive(sim, 2.2, frame(), clock, () => { top = Math.max(top, sim.y); });
    expect(top).toBeCloseTo(RULES.wagonTop, 1);
    expect(sim.stumbles).toBe(0);
    expect(sim.wagons).toBe(1);
    expect(groundAt(sim.track.obstacles, 0, sim.track.obstacles[0].z + 2)).toBeCloseTo(RULES.wagonTop / 2, 5);
  });
});

// ── grace ─────────────────────────────────────────────────────────
describe('stumbles, never an ending', () => {
  it('a wall not jumped is a stumble: a second slowed, the combo reset, the run goes on', () => {
    const sim = later();
    emptyRoad(sim);
    sim.combo = 12;
    place(sim, 'wall', 0, 8);
    const clock = { t: 0 };
    const z0 = sim.z;
    const evs = drive(sim, 1.2, frame(), clock);
    expect(ofType(evs, 'stumble').length).toBe(1);
    expect(sim.combo).toBe(0);
    expect(sim.stumbleT).toBeGreaterThan(0);
    drive(sim, 2, frame(), clock);
    expect(sim.z - z0).toBeGreaterThan(20);
    expect(sim.score).toBeGreaterThan(20);
  });

  it('a jump clears a wall and a goat, a slide an arch; a jump under an arch is a stumble', () => {
    const sim = later();
    emptyRoad(sim);
    const clock = { t: 0 };
    const pass = (kind: ObKind, move: 'jump' | 'slide') => {
      const ob = place(sim, kind, 0, 14, undefined, { dir: 0 });
      while (ob.z - sim.z > sim.v * (move === 'jump' ? 0.3 : 0.15)) drive(sim, STEP, frame(), clock);
      sim.act(move);
      return ofType(drive(sim, 1.6, frame(), clock), 'clear').length;
    };
    expect(pass('wall', 'jump')).toBe(1);
    expect(pass('goat', 'jump')).toBe(1);
    expect(pass('arch', 'slide')).toBe(1);
    expect(pass('column', 'jump')).toBe(1);
    expect(sim.jumps).toBe(3);
    expect(sim.slides).toBe(1);
    expect(sim.stumbles).toBe(0);
    pass('branch', 'jump');
    expect(sim.stumbles).toBe(1);
  });

  it('a cart beside the runner holds a lane change back until it has passed', () => {
    const sim = later();
    emptyRoad(sim);
    const cart = place(sim, 'cart', 1, -1, 4);
    const clock = { t: 0 };
    sim.act('right');
    expect(sim.lane).toBe(0);
    const evs = drive(sim, 0.45, frame(), clock);
    expect(sim.lane).toBe(1);
    expect(ofType(evs, 'lane').length).toBe(1);
    expect(cart.hit).toBe(false);
    expect(sim.stumbles).toBe(0);
  });

  it('two stumbles within 8 s call the mule cart: the road ahead clears and the messenger rides', () => {
    const sim = later();
    emptyRoad(sim);
    const clock = { t: 0 };
    place(sim, 'wall', 0, 6);
    place(sim, 'wall', 0, 30);
    const evs = drive(sim, 4.5, frame(), clock);
    expect(ofType(evs, 'stumble').length).toBe(2);
    expect(ofType(evs, 'mule').length).toBe(1);
    expect(sim.muleT).toBeGreaterThan(0);
    expect(sim.safe).toBe(true);
    expect(sim.track.obstacles.filter(o => o.z > sim.z + 2).length).toBe(0);
    const evs2 = drive(sim, RULES.muleSec, frame(), clock);
    expect(ofType(evs2, 'muleEnd').length).toBe(1);
    expect(sim.mules).toBe(1);
  });
});

// ── drachmas and power-ups ────────────────────────────────────────
describe('drachmas and the road\'s gifts', () => {
  it('picks up drachmas in the lane; the satchel reaches every lane; every 25 in a row pay 5 more', () => {
    const sim = later();
    emptyRoad(sim);
    const c = (lane: number, ahead: number) => sim.track.coins.push({ id: ++obId, lane, z: sim.z + ahead, y: 0.6, taken: false, high: false });
    c(0, 5);
    c(1, 6);
    const clock = { t: 0 };
    drive(sim, 1, frame(), clock);
    expect(sim.coins).toBe(1);
    sim.satchelT = 5;
    c(1, 5);
    c(-1, 6);
    drive(sim, 1, frame(), clock);
    expect(sim.coins).toBe(4);
    sim.combo = 24;
    c(0, 4);
    const evs = drive(sim, 1, frame(), clock);
    expect(ofType(evs, 'combo')[0]?.bonus).toBe(RULES.comboBonus);
    expect(sim.drachmaGain).toBe(5 + RULES.comboBonus);
  });

  it('puts sandals and a satchel on the road for everyone, band or not', () => {
    const tr = new Track(3, 0);
    tr.fill(2000, 0.5);
    const kinds = new Set(tr.powers.map(p => p.kind));
    expect(kinds).toEqual(new Set(['sandals', 'satchel']));
    const sim = later();
    emptyRoad(sim);
    sim.track.powers.push({ id: 1, kind: 'sandals', lane: 0, z: sim.z + 4, taken: false });
    drive(sim, 1, frame({ reliable: false, activity: null }));
    expect(sim.sandalsT).toBeGreaterThan(8);
  });
});

// ── the band: Na wyżyny ───────────────────────────────────────────
describe('Na wyżyny: the glow, the ladder and the heights', () => {
  it('lights the glow with the level only after the lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const [eeg, lead] of [[false, 5], [true, 2]] as const) {
      const sim = later({ eeg });
      const clock = { t: 0 };
      drive(sim, lead - 0.3, frame({ level: 0.9 }), clock);
      expect(sim.glow).toBe(0);
      drive(sim, 1.5, frame({ level: 0.9 }), clock);
      expect(sim.glow).toBeGreaterThan(0.5);
    }
  });

  it('widens the drachmas\' reach with the level in a sighted push', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 7, frame({ level: 1 }), clock);
    emptyRoad(sim);
    sim.track.coins.push({ id: 1, lane: sim.lane + 1 > 1 ? sim.lane - 1 : sim.lane + 1, z: sim.z + 4, y: 0.6, taken: false, high: false });
    const before = sim.coins;
    drive(sim, 0.8, frame({ level: 1 }), clock);
    expect(sim.coins).toBe(before + 1);
  });

  it('climbs a rung a second of hold and rises onto the heights at the top: 5 s Mendi, 3 s HALO', () => {
    for (const [eeg, lead, need] of [[false, 5, 5], [true, 2, 3]] as const) {
      const sim = later({ eeg });
      const clock = { t: 0 };
      const evs = drive(sim, lead + need + 0.5, tt => focused(tt), clock);
      const rungs = ofType(evs, 'rung').map(e => e.n);
      expect(rungs).toEqual(Array.from({ length: need }, (_, i) => i + 1));
      const h = ofType(evs, 'heights');
      expect(h.length, `eeg ${eeg}`).toBe(1);
      expect(h[0].bonus).toBe(false);
    }
  });

  it('stays on the heights while focused (at most 12 s), free of obstacles and rich in drachmas, then glides down onto a clear stretch', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 10.5, tt => focused(tt), clock);
    expect(sim.onHeights).toBe(true);
    drive(sim, 1, tt => focused(tt), clock);
    expect(sim.heights).toBe('high');
    expect(sim.y).toBeCloseTo(RULES.heightsY, 1);
    const coins0 = sim.coins, stumbles0 = sim.stumbles;
    const evs = drive(sim, 13, tt => focused(tt), clock);
    expect(sim.coins - coins0).toBeGreaterThan(40);
    expect(sim.stumbles).toBe(stumbles0);
    const glide = evs.findIndex(e => e.type === 'glide');
    expect(glide).toBeGreaterThan(-1);
    expect(sim.heightsSec).toBeLessThan(RULES.heightsMax + RULES.riseSec + RULES.glideSec + 0.2);
    // the clear stretch: nothing within 1.5 s of running after the landing
    drive(sim, 1.5, tt => focused(tt), clock);
    expect(sim.track.obstacles.filter(o => o.z > sim.z && o.z < sim.z + sim.v * 1.2).length).toBe(0);
  });

  it('leaves the heights when focus leaves (past the kit\'s grace), and holds them through a bad signal', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 12, tt => focused(tt), clock);
    expect(sim.heights).toBe('high');
    drive(sim, 2, frame({ reliable: false, activity: null }), clock);
    expect(sim.heights).toBe('high');
    const evs = drive(sim, 0.2, frame({ focused: false }), clock);
    expect(ofType(evs, 'glide').length).toBe(1);
  });

  it('keeps the ladder\'s rungs through a bad signal, and never shows them falling for it', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 8, tt => focused(tt), clock);
    const rungs = sim.rungs;
    expect(rungs).toBeGreaterThanOrEqual(2);
    drive(sim, 2, frame({ reliable: false, activity: null, hold: 0 }), clock);
    expect(sim.rungs).toBe(rungs);
  });
});

// ── the band: Strażnice ───────────────────────────────────────────
describe('Strażnice: the watchtowers', () => {
  it('has no obstacles, runs slower, and passes a pair of towers every ~2.5 s', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.kind).toBe('rest');
    drive(sim, 1, calm(), clock);
    const ahead = sim.track.obstacles.filter(o => !o.hit && o.z > sim.z + 1);
    expect(ahead.length).toBe(0);
    expect(sim.v).toBeLessThan(speedFor(sim.z));
    const evs = drive(sim, 9, calm(), clock);
    const towers = ofType(evs, 'tower');
    expect(towers.length).toBeGreaterThanOrEqual(3);
    expect(towers.length).toBeLessThanOrEqual(5);
  });

  it('kindles each tower by calm as it passes (after the lead-in); a bad signal lights it at a neutral glow, not counted', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, 12, tt => (tt % 4 < 2 ? calm(0.9) : frame({ reliable: false, activity: null, calm: 0 })), clock);
    const towers = ofType(evs, 'tower');
    for (const e of towers) {
      if (e.tower.measured) expect(e.tower.fire).toBeCloseTo(0.9, 5);
      else expect(e.tower.fire).toBe(RULES.fireNeutral);
      expect(e.lit).toBe(e.tower.measured && e.tower.fire! > RULES.fireLit);
    }
    expect(towers.some(e => e.tower.measured)).toBe(true);
    expect(sim.firesLit).toBe(towers.filter(e => e.lit).length);
  });
});

// ── verdicts and the blind block ──────────────────────────────────
describe('the verdicts', () => {
  it('judges each block at its end: a passed push pays drachmas, a passed rest is the watchmen\'s song', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    const evs = drive(sim, 40, tt => (sim.block.kind === 'push' ? focused(tt) : calm()), clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends.map(e => [e.block.kind, e.verdict])).toEqual([['push', true], ['rest', true]]);
    expect(ends[0].pay).toBe(RULES.pushPay);
    expect(ends[1].pay).toBe(RULES.songPay);
    expect(sim.songs).toBe(1);
    expect(ends[0].t1).toBeGreaterThan(ends[0].t0);
  });

  it('has no verdict for a block with fewer than 8 reliable seconds', () => {
    const sim = later({ planned: 40 });
    const evs = drive(sim, 25, frame({ reliable: false, activity: null }));
    expect(ofType(evs, 'blockEnd')[0].verdict).toBeNull();
  });
});

describe('Mgła na przełęczy: the blind push', () => {
  /** a session whose second push is the 4th of the player's life */
  const blindSession = () => later({ planned: 300, progress: { sessions: 4, pushes: 2 } });

  it('comes every 4th push from the 3rd session, never a session\'s first', () => {
    const sim = blindSession();
    const clock = { t: 0 };
    expect(sim.block.blind).toBe(false);
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    expect(later({ progress: { sessions: 1, pushes: 3 } }).block.blind).toBe(false);
  });

  it('veils the ribbon and opens no heights; at its end the veil lifts and the judged share becomes heights (at least 2 s)', () => {
    const sim = blindSession();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const evs = drive(sim, sim.block.dur + 0.2, tt => focused(tt), clock);
    expect(ofType(evs, 'heights').filter(e => !e.bonus).length).toBe(0);
    expect(ofType(evs, 'rung').length).toBe(0);
    const reveal = ofType(evs, 'blindReveal')[0];
    expect(reveal.sec).toBe(Math.round(blindBonus(reveal.share, true)));
    expect(ofType(evs, 'heights').filter(e => e.bonus).length).toBe(1);
    expect(sim.trace.samples.every(s => !s.veiled)).toBe(true);
    expect(blindBonus(0, true)).toBe(RULES.blindMin);
    expect(blindBonus(1, true)).toBe(RULES.heightsMax);
    expect(blindBonus(0.9, false)).toBe(0);
  });

  it('holds the pad and the glow still in rest and blind blocks', () => {
    const sim = blindSession();
    const clock = { t: 0 };
    drive(sim, 8, frame({ level: 0.9 }), clock);
    expect(sim.padLevel(frame({ level: 0.9 }))).toBeCloseTo(sim.glow, 5);
    toBlock(sim, 1, frame(), clock);
    expect(sim.padLevel(frame())).toBeNull();
    toBlock(sim, 2, frame(), clock);
    drive(sim, 8, frame({ level: 0.9 }), clock);
    expect(sim.padLevel(frame({ level: 0.9 }))).toBeNull();
    expect(sim.glow).toBe(0);
    expect(makeSim().padLevel(frame())).toBe(0.5);
  });
});

// ── the plan ──────────────────────────────────────────────────────
describe('the block plan', () => {
  it('plays 40 s as warm-up 6, push 14.5, rest 14.5 (else push 21, rest 14), and alternates longer sessions, ending in rest', () => {
    expect(planBlocks(40, true, () => 0.5).map(b => [b.kind, b.dur])).toEqual([['warmup', 6], ['push', 14.5], ['rest', 14.5]]);
    expect(planBlocks(40, false, () => 0.5).map(b => [b.kind, b.dur])).toEqual([['push', 21], ['rest', 14]]);
    for (const sec of [180, 300, 600]) {
      const p = planBlocks(sec, sec === 300, mulberry32(sec));
      expect(p.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec - RULES.finale, 6);
      expect(p[p.length - 1].kind).toBe('rest');
      expect(p.every(b => b.dur >= RULES.minBlock - 1e-9)).toBe(true);
    }
    expect(planBlocks(300, true, () => 0.5)[0]).toEqual({ kind: 'warmup', dur: 30, blind: false });
    expect(planBlocks(180, true, () => 0.5)[0].dur).toBe(20);
  });

  it('telegraphs the next block 4 s ahead, then the finisher at the inn; may stop once done or 3 s after time', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    const evs = drive(sim, 42, frame(), clock);
    const tele = ofType(evs, 'telegraph');
    expect(tele.length).toBe(1);
    expect(ofType(evs, 'finale').length).toBe(1);
    expect(ofType(evs, 'inn').length).toBe(1);
    expect(sim.canStop()).toBe(true);
    const s2 = later({ planned: 40 });
    drive(s2, 36, frame());
    expect(s2.canStop()).toBe(false);
  });
});

// ── the meta ──────────────────────────────────────────────────────
describe('the road to the seven churches, the jar, the errands', () => {
  it('lays the seven cities 2–4.5 km apart from Ephesus, then a second journey', () => {
    expect(CITIES.map(c => c.id)).toEqual(['efez', 'smyrna', 'pergamon', 'tiatyra', 'sardes', 'filadelfia', 'laodycea']);
    expect(LAP).toBe(19500);
    expect(routeAt(0)).toEqual({ lap: 1, city: 0, next: 1, into: 0, leg: 2000 });
    expect(routeAt(2100)).toMatchObject({ city: 1, next: 2, into: 100, leg: 2500 });
    expect(routeAt(LAP + 10)).toMatchObject({ lap: 2, city: 0, into: 10 });
    expect(citiesBetween(1900, 2100)).toEqual([{ lap: 1, city: 1 }]);
    expect(citiesBetween(LAP - 100, LAP + 2100)).toEqual([{ lap: 1, city: 6 }, { lap: 2, city: 1 }]);
    expect(postcards(0)).toEqual([true, false, false, false, false, false, false]);
    expect(postcards(4600).filter(Boolean).length).toBe(3);
    expect(postcards(LAP + 1).every(Boolean)).toBe(true);
    for (const c of CITIES) expect(c.ref).toMatch(/^Ap [23],\d+–\d+$/);
  });

  it('delivers a letter the moment a city is reached, and closes with Romans 10:15', () => {
    const sim = later({ planned: 40, progress: { metres: 1950, sessions: 4 } });
    const evs = drive(sim, 40, frame());
    const city = ofType(evs, 'city');
    expect(city).toEqual([{ type: 'city', city: 1, lap: 1 }]);
    expect(sim.closingVerse()).toBe('rom10.15');
    expect(sim.result().highlights[0]).toContain('Smyrny');
    expect(sim.p.metres).toBe(1950 + sim.score);
  });

  it('dresses the messenger from the jar: cloaks at 0, 250, 800 and 2000 drachmas', () => {
    expect(CLOAKS.map(c => c.at)).toEqual([0, 250, 800, 2000]);
    expect(cloaksEarned(0)).toBe(1);
    expect(cloaksEarned(800)).toBe(3);
    expect(toNextCloak(300)).toEqual({ have: 50, need: 550, index: 2 });
    expect(toNextCloak(5000)).toBeNull();
    const p = { ...freshProgress(), drachmas: 900, cloak: 1 };
    expect(cloakOf(p)).toBe(1);
    p.cloak = 3;
    expect(cloakOf(p)).toBe(2);
    const sim = later({ progress: { drachmas: 249 } });
    emptyRoad(sim);
    sim.track.coins.push({ id: 1, lane: 0, z: sim.z + 3, y: 0.6, taken: false, high: false });
    const evs = drive(sim, 1, frame());
    expect(ofType(evs, 'cloak')).toEqual([{ type: 'cloak', index: 1 }]);
  });

  it('keeps three errands open; a done one pays and its page turns after the session', () => {
    const p = freshProgress();
    expect(p.missions).toEqual(['slide10', 'coins300', 'heights20']);
    expect(MISSIONS.length).toBeGreaterThanOrEqual(8);
    const opened = turnPages(p, ['coins300']);
    expect(opened).toEqual(['jump15']);
    expect(p.missions).toEqual(['slide10', 'jump15', 'heights20']);
    const sim = later({ planned: 40, progress: { missions: ['km2', 'slide10', 'coins300'], missionNext: 3 } });
    sim.z = 1999.5;
    const evs = drive(sim, 1, frame());
    expect(ofType(evs, 'mission').map(e => e.id)).toEqual(['km2']);
    expect(ofType(evs, 'drachmas').some(e => e.why === 'mission' && e.n === RULES.missionPay)).toBe(true);
  });

  it('runs the day\'s road on the day\'s first session (the same for everyone), and gives the day\'s gift once', () => {
    const a = makeSim({ progress: { sessions: 4, pushes: 1 }, seed: 1 });
    const b = makeSim({ progress: { sessions: 9, pushes: 1 }, seed: 2 });
    const sig = (s: PoslaniecSim) => s.track.obstacles.map(o => `${o.kind}${o.lane}@${o.z.toFixed(1)}`).join();
    expect(a.daily && b.daily).toBe(true);
    expect(sig(a)).toBe(sig(b));
    expect(sig(later({ seed: 1 }))).not.toBe(sig(later({ seed: 2 })));
    const sim = makeSim({ planned: 40, progress: { sessions: 4, pushes: 1 } });
    const evs = drive(sim, 42, frame());
    expect(ofType(evs, 'gift')).toEqual([{ type: 'gift', n: RULES.giftPay }]);
    expect(sim.p.giftDay).toBe(DAY);
    expect(sim.p.dailyDay).toBe(DAY);
    sim.result();
    expect(sim.p.dailyMetres).toBe(sim.score);
  });
});

// ── the summary ───────────────────────────────────────────────────
describe('the summary', () => {
  it('result() is idempotent: records with Math.max, the total once, when settled', () => {
    const sim = later({ planned: 40, progress: { metres: 500 } });
    drive(sim, 42, frame());
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.metres).toBe(500 + sim.score);
    expect(bestFor(sim.p, 40)).toBe(a.score);
    expect(a.unit).toBe('m');
    expect(a.stats.length).toBeLessThanOrEqual(8);
    expect(sim.p.sessions).toBe(6);
  });

  it('settles an early end once: the open block is judged, the session counted', () => {
    const sim = later({ planned: 300 });
    drive(sim, 10, frame());
    sim.finish();
    sim.finish();
    expect(sim.phase).toBe('done');
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.metres).toBe(sim.score);
    expect(sim.result().score).toBe(sim.score);
  });

  it('closes with a passage the session fits, in turn from session to session, never the root', () => {
    const sim = later({ planned: 40 });
    drive(sim, 42, tt => (sim.block.kind === 'push' ? focused(tt) : calm()));
    const v = sim.closingVerse();
    expect(['hab3.19', 'isa52.8']).toContain(v);
    expect(v).not.toBe('isa52.7');
    expect(passage(v).text.length).toBeGreaterThan(10);
    const quiet = later({ planned: 40, progress: { sessions: 6 } });
    drive(quiet, 42, frame({ reliable: false, activity: null }));
    expect(['pro25.25', '2th3.1']).toContain(quiet.closingVerse());
  });

  it('marks a record against the same session length only, and shows it in the lobby', async () => {
    const sim = later({ planned: 40, progress: { best: { 40: 50, 300: 9999 }, lastLen: 40 } });
    drive(sim, 42, frame());
    expect(sim.result().record).toBe(true);
    expect(bestOf(sim.p)).toBe(sim.score);
    const mod = (await import('../src/arcade/poslaniec/index')).default;
    expect(mod.best(freshProgress())).toBeNull();
    expect(mod.best(sim.p)).toBe(sim.score);
  });
});

// ── the hands ─────────────────────────────────────────────────────
describe('the hands', () => {
  it('reads swipes by their main direction once longer than 30 px, taps by thirds, keys by arrows, WASD and Space', () => {
    expect(swipe(10, 5)).toBeNull();
    expect(swipe(-40, 10)).toBe('left');
    expect(swipe(40, -10)).toBe('right');
    expect(swipe(5, -40)).toBe('jump');
    expect(swipe(5, 40)).toBe('slide');
    expect(tapAt(50, 390)).toBe('left');
    expect(tapAt(195, 390)).toBe('jump');
    expect(tapAt(380, 390)).toBe('right');
    expect(['ArrowLeft', 'a', 'ArrowRight', 'D', 'ArrowUp', 'w', ' ', 'ArrowDown', 's', 'Enter'].map(keyMove))
      .toEqual(['left', 'left', 'right', 'right', 'jump', 'jump', 'jump', 'slide', 'slide', null]);
    const g = new Gestures(390);
    expect(g.pointer('down', 1, 200, 400, 0)).toBeNull();
    expect(g.pointer('move', 1, 200, 360, 0.05)).toBe('jump');
    expect(g.pointer('up', 1, 200, 300, 0.1)).toBeNull();
    g.pointer('down', 2, 20, 400, 1);
    expect(g.pointer('up', 2, 22, 402, 1.1)).toBe('left');
    g.pointer('down', 3, 20, 400, 2);
    expect(g.pointer('up', 3, 22, 402, 3)).toBeNull();
  });
});

// ── the smoke path ────────────────────────────────────────────────
describe('the smoke path', () => {
  /** The smoke test's input: a tap at the centre every ~0.65 s (a jump), Space now and then, the simulator's focus on. */
  function smoke(progress: Partial<PoslaniecProgress>, seed: number, eeg: boolean) {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    const g = new Gestures(1280);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at1 = 0, at22 = 0;
    for (let tt = 0; tt < 22 + 1e-9; tt += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-tt / 4)), true, 0.1);
      }
      sim.update(STEP, f, tt);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        g.pointer('down', 1, 640, 480, tt);
        const m = g.pointer('up', 1, 640, 480, tt + 0.05);
        if (m) sim.act(m);
        if (taps++ % 3 === 0) sim.act(keyMove(' ')!);
      }
      sim.take();
      if (tt <= 1) at1 = sim.result().score;
      at22 = sim.result().score;
    }
    return { at1, at22, sim };
  }

  it('scores within the first second and keeps scoring at 22 s, on either band, through any stumbles', () => {
    for (const eeg of [false, true]) {
      for (const seed of [1, 2, 3]) {
        const r = smoke({}, seed, eeg);
        expect(r.at1, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        expect(r.at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(150);
      }
    }
    expect(smoke({ sessions: 6, dailyDay: DAY }, 3, false).at22).toBeGreaterThan(150);
  });
});

// ── the texts ─────────────────────────────────────────────────────
describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('names every city, cloak and errand, and writes distances and seconds with a no-break space', () => {
    for (const c of CITIES) expect(c.name.length).toBeGreaterThan(3);
    for (const m of MISSIONS) expect(m.name.length).toBeGreaterThan(5);
    expect(CLOAKS.map(c => c.name)).toEqual(['Surowa wełna', 'Czerwień marzanny', 'Indygo', 'Purpura z Tiatyry']);
    expect(metres(1234)).toBe('1 234 m');
    expect(km(1234)).toBe('1,2 km');
    expect(t('sec', { n: 5 })).toBe('5 s');
    expect(TIPS.push.length).toBe(5);
    for (const cat of Object.values(CATALOGS)) {
      for (const m of Object.values(cat)) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s).not.toMatch(/\d (s|m|km)\b/);
      }
    }
  });

  it('never asks to concentrate harder, and names verdicts in craft and nature words', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentr/, /koncentrera/, /hack/, /odblok/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /\bbóg\b/, /\bgod\b/, /\bgott\b/, /\bgud\b/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the lobby (panel.ts)', () => {
  it('builds the progress card from elements: seven postcards, the jar\'s cloaks to choose from, three errands', async () => {
    const { progressPanel } = await import('../src/arcade/poslaniec/panel');
    const p = { ...freshProgress(), sessions: 3, metres: 4600, drachmas: 900, cloak: 2, best: { 300: 2100 }, lastLen: 300 };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    expect(el.querySelectorAll('.arcade-album > div').length).toBe(7);
    expect(el.querySelectorAll('.arcade-album > div.on').length).toBe(3);
    expect(el.textContent).toContain('Tiatyry');
    const chips = [...el.querySelectorAll<HTMLElement>('[role="button"]')];
    expect(chips.length).toBe(3);
    expect(chips[2].classList.contains('on')).toBe(true);
    chips[0].click();
    expect(p.cloak).toBe(0);
    expect(saved).toBe(1);
    expect(chips[0].classList.contains('on')).toBe(true);
  });
});

