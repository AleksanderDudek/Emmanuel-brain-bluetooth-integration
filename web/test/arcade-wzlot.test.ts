import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, RoundJudge, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { inTurn, passage } from '../src/arcade/kit/scripture';
import { MISSIONS, STAGES, TIPS, VISTAS } from '../src/arcade/wzlot/content';
import { Eaglet, liftAt, sinkRate, type FlightEvent } from '../src/arcade/wzlot/flight';
import { CATALOGS, km, metres, t } from '../src/arcade/wzlot/i18n';
import {
  bestFor, drawVista, freshProgress, newChance, nextMissing, pityDue, stageOf, toNextStage, turnPages, type WzlotProgress,
} from '../src/arcade/wzlot/meta';
import { RULES } from '../src/arcade/wzlot/rules';
import { WzlotSim, climbFor, followFor, median, planBlocks, wingsFor, type SimEvent } from '../src/arcade/wzlot/sim';
import { Terrain, type RidgeSpec } from '../src/arcade/wzlot/terrain';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-10-25';
const STEP = 1 / 60;
const DT = RULES.step;
const DEG = Math.PI / 180;

/** The session's tuning as the runner builds it: the kit's defaults, Wzlot's entry, and a beginner's on top. */
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

type SimOpts = { progress?: Partial<WzlotProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): WzlotSim {
  const sim = new WzlotSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player's session (no warm-up, no day's ridge): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, lastVistaSession: 5, dailyDay: DAY, giftDay: DAY, lekcje: 1, ...o.progress } });

/** Run the sim for `sec` at 60 fps; `f` may depend on the play time; `hands` presses the wings now and then. */
function drive(sim: WzlotSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Make the block running now last `sec` (the plan's lengths vary with the seed). */
const lasting = (sim: WzlotSim, sec: number) => { sim.block.dur = sec; };

/** Play to the start of block i (the block clock runs on, whatever the band does). */
function toBlock(sim: WzlotSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

// ── the ground ─────────────────────────────────────────────────
const spec = (seed: number, o: Partial<RidgeSpec> = {}): RidgeSpec => ({ seed, gentle: false, wide: false, daily: false, ...o });
const terrain = (seed = 1, o: Partial<RidgeSpec> = {}) => {
  const rs = mulberry32(seed);
  const T = new Terrain(i => spec((rs() * 2 ** 32) >>> 0, i === 0 ? o : {}));
  T.ensure(40);
  return T;
};

describe('the hills', () => {
  it('makes the same ridge from the same seed, on any device', () => {
    const a = new Terrain(() => spec(99)), b = new Terrain(() => spec(99)), c = new Terrain(() => spec(100));
    a.ensure(20);
    b.ensure(20);
    c.ensure(20);
    const ka = a.keys(0, 20).map(k => [k.x, k.y]), kb = b.keys(0, 20).map(k => [k.x, k.y]);
    expect(ka).toEqual(kb);
    expect(c.keys(0, 20).map(k => [k.x, k.y])).not.toEqual(ka);
  });

  it('is smooth: height and slope are continuous everywhere, the slope zero at every crest and trough', () => {
    const T = terrain(3);
    for (let x = 0.01; x < 30; x += 0.013) {
      expect(Math.abs(T.height(x + 1e-5) - T.height(x))).toBeLessThan(1e-3);
      expect(Math.abs(T.slope(x + 1e-5) - T.slope(x))).toBeLessThan(1e-2);
    }
    for (const k of T.keys(0.5, 30)) expect(Math.abs(T.slope(k.x))).toBeLessThan(1e-6);
  });

  it('builds ridges of 16 hills that end at a crag over a wadi; the next ridge starts at the far rim', () => {
    const T = terrain(4);
    const [r0, r1] = T.ridges;
    expect(r0.troughs).toHaveLength(RULES.hillsPerRidge);
    expect(r0.crag).toBe(r0.wadiX0);
    expect(r1.x0).toBeCloseTo(r0.wadiX1, 9);
    // the crag is a crest, the wadi's floor drops far below the line under which the parent catches
    expect(T.slope(r0.crag - 0.05)).toBeGreaterThan(0);
    expect(T.slope(r0.crag + 0.05)).toBeLessThan(0);
    expect(T.height((r0.wadiX0 + r0.wadiX1) / 2)).toBeLessThan(r0.catchY);
    expect(r0.rimY).toBeCloseTo(r0.cragY - RULES.rimDrop, 9);
    const width = r0.wadiX1 - r0.wadiX0;
    expect(width).toBeGreaterThanOrEqual(RULES.wadiWidth[0]);
    expect(width).toBeLessThanOrEqual(RULES.wadiWidth[1]);
  });

  it('keeps hill slopes and sizes within the rules, and the land near the nest\'s level', () => {
    const T = terrain(5);
    const run = (x: number) => T.ridges.some(r => x > r.crag - 1 && x < r.wadiX1);   // the crag's run-up may be steeper
    for (let x = 0.01; x < T.ridges[1].wadiX0; x += 0.01) {
      if (run(x)) continue;
      expect(Math.abs(T.slope(x))).toBeLessThanOrEqual(RULES.slopeMax + 1e-9);
    }
    for (const r of T.ridges) expect(Math.abs(r.cragY)).toBeLessThan(1);
  });

  it('makes the warm-up ridge gentle with a shallow dip nobody is caught in, and the stretch\'s valley wide', () => {
    const gentle = new Terrain(() => spec(7, { gentle: true }));
    gentle.ensure(20);
    const g = gentle.ridges[0];
    const floor = gentle.height((g.wadiX0 + g.wadiX1) / 2);
    expect(floor).toBeGreaterThan(g.catchY);
    const wide = new Terrain(() => spec(7, { wide: true }));
    wide.ensure(20);
    expect(wide.ridges[0].wadiX1 - wide.ridges[0].wadiX0).toBeGreaterThanOrEqual(RULES.wideWidth[0]);
  });

  it('is made ahead and forgotten behind', () => {
    const T = terrain(6);
    T.ensure(200);
    expect(T.end).toBeGreaterThanOrEqual(200);
    const h = T.height(150);
    T.trim(140);
    expect(T.height(150)).toBe(h);
    expect(T.ridges[0].wadiX1).toBeGreaterThan(140 - 20);
  });
});

// ── the flight ─────────────────────────────────────────────────
/** An eaglet in the air at (x, height above the ground), flying at `speed` along `deg` (negative: down). */
function flying(T: Terrain, x: number, h: number, speed: number, deg: number, ev: FlightEvent[] = []): Eaglet {
  const e = new Eaglet(T, x => ev.push(x));
  e.mode = 'air';
  e.x = e.maxX = x;
  e.y = T.height(x) + h;
  e.vx = speed * Math.cos(deg * DEG);
  e.vy = speed * Math.sin(deg * DEG);
  e.airT = 1;
  return e;
}
const open = { held: false, W: RULES.wNeutral, draft: 0, soaring: false };
const tuck = { held: true, W: RULES.wNeutral, draft: 0, soaring: false };

/** The middle of a downslope and of an upslope of the first ridge, with their angles. */
function slopes(T: Terrain) {
  const ks = T.keys(0, T.ridges[0].crag - 1);
  let down = 0, up = 0;
  for (let i = 1; i < ks.length - 1 && (!down || !up); i++) {
    const mid = (ks[i].x + ks[i + 1].x) / 2;
    if (!down && ks[i + 1].y < ks[i].y - 0.12) down = mid;
    if (!up && ks[i + 1].y > ks[i].y + 0.12 && i > 2) up = mid;
  }
  return { down, up, downDeg: Math.atan(T.slope(down)) / DEG, upDeg: Math.atan(T.slope(up)) / DEG };
}

/** Fly with `inp` until the first landing (or a catch). */
function landing(e: Eaglet, ev: FlightEvent[], inp = open): Extract<FlightEvent, { type: 'land' }> | null {
  for (let i = 0; i < 2000; i++) {
    e.step(DT, inp);
    const l = ev.find(x => x.type === 'land' || x.type === 'catch');
    if (l) return l.type === 'land' ? l : null;
  }
  return null;
}

describe('the flight', () => {
  it('starts sliding down off the nest at 0.9 sh/s, so the distance grows from the first moment', () => {
    const T = terrain(1);
    const e = new Eaglet(T, () => undefined);
    expect(e.mode).toBe('ground');
    expect(e.s).toBe(RULES.startV);
    expect(T.slope(e.x)).toBeLessThan(0);
    for (let i = 0; i < 60; i++) e.step(DT, open);
    expect(e.maxX).toBeGreaterThan(RULES.startX + 0.3);
  });

  it('folds the wings to dive at 2.2 g and opens them to glide at g (1 − 0.5 W) down to their sink rate', () => {
    const T = terrain(1);
    const high = (deg: number) => flying(T, 3, 3, 1.5, deg);
    const a = high(0), b = high(0);
    a.step(DT, tuck);
    b.step(DT, open);
    expect(a.vy).toBeCloseTo(-RULES.g * RULES.dive * DT, 3);
    expect(b.vy).toBeCloseTo(-RULES.g * (1 - 0.5 * liftAt(RULES.wNeutral, b.vx)) * DT, 3);
    // open wings never sink faster than their rate: lift and speed both make it gentler
    const c = high(-60);
    for (let i = 0; i < 240; i++) c.step(DT, open);
    expect(c.vy).toBeCloseTo(-sinkRate(RULES.wNeutral, c.vx), 2);
    expect(sinkRate(0.85, 2)).toBeLessThan(sinkRate(0.55, 2));
    expect(sinkRate(0.55, 2.5)).toBeLessThan(sinkRate(0.55, 1));
    // the band's lift works with the airspeed: crawling, the wings are nearly neutral
    expect(liftAt(0.85, 0.5)).toBeLessThan(0.6);
    expect(liftAt(0.85, 2)).toBeCloseTo(0.85, 9);
  });

  it('launches from a crest by its own momentum, and hugs it with the wings folded', () => {
    const T = terrain(2);
    const ks = T.keys(1, 10);
    const crest = ks.find((k, i) => i > 0 && k.y > ks[i - 1].y && k.y > (ks[i + 1]?.y ?? Infinity))!;
    const run = (held: boolean, v: number) => {
      const ev: FlightEvent[] = [];
      const e = new Eaglet(T, x => ev.push(x));
      e.x = e.maxX = crest.x - 0.2;
      e.y = T.height(e.x);
      e.s = v;
      for (let i = 0; i < 60 && e.x < crest.x + 0.1; i++) e.step(DT, { ...open, held });
      return ev.some(x => x.type === 'launch');
    };
    expect(run(false, 2.4)).toBe(true);
    expect(run(true, 1)).toBe(false);
  });

  it('lands smoothly within 10° of a downslope (+6 %), shows the honest margin up to 12°, and is rough beyond', () => {
    const T = terrain(2);
    const { down, downDeg } = slopes(T);
    const at = (off: number) => {
      const ev: FlightEvent[] = [];
      const e = flying(T, down, 0.004, 1.8, downDeg + off, ev);
      e.vy -= 0;   // already pointing at the slope
      const l = landing(e, ev)!;
      return { l, s: e.s };
    };
    const smooth = at(-4);
    expect(smooth.l.cls).toBe('smooth');
    expect(smooth.l.deg).toBeLessThanOrEqual(RULES.smooth);
    expect(smooth.s).toBeGreaterThan(1.8 * Math.cos(smooth.l.deg * DEG));      // the bonus on top of the slide
    const near = at(-11);
    expect(near.l.cls).toBe('near');
    expect(near.l.deg).toBeGreaterThan(RULES.smooth);
    expect(near.l.deg).toBeLessThanOrEqual(RULES.near);
    expect(at(-20).l.cls).toBe('rough');
  });

  it('stalls more than 35° into an upslope (speed × 0.55), and is only rough at a gentler angle', () => {
    const T = terrain(2);
    const { up, upDeg } = slopes(T);
    const ev: FlightEvent[] = [];
    const e = flying(T, up, 0.004, 1.6, upDeg - 45, ev);
    const l = landing(e, ev)!;
    expect(l.cls).toBe('stall');
    expect(e.s).toBeCloseTo(l.speed, 9);
    expect(l.speed).toBeCloseTo(1.6 * RULES.stallKeep, 1);
    const ev2: FlightEvent[] = [];
    expect(landing(flying(T, up, 0.004, 1.6, upDeg - 20, ev2), ev2)!.cls).toBe('rough');
  });

  it('lines a dive up with a downslope just under it (the tucked eaglet swoops onto the hill)', () => {
    const T = terrain(2);
    const { down, downDeg } = slopes(T);
    // steeply down from a little above the slope: open wings land rough, a dive settles onto it
    const ev: FlightEvent[] = [];
    const glide = landing(flying(T, down - 0.15, 0.3, 1.8, downDeg - 35, ev), ev);
    const ev2: FlightEvent[] = [];
    const dive = landing(flying(T, down - 0.15, 0.3, 1.8, downDeg - 35, ev2), ev2, tuck);
    expect(glide!.deg).toBeGreaterThan(RULES.smooth);
    expect(dive!.cls).toBe('smooth');
  });

  it('never counts a hop over a crest as a landing', () => {
    const T = terrain(2);
    const { down, downDeg } = slopes(T);
    const ev: FlightEvent[] = [];
    const e = flying(T, down, 0.002, 1.5, downDeg - 30, ev);
    e.airT = 0;
    e.step(DT, open);
    e.step(DT, open);
    expect(e.mode).toBe('ground');
    expect(ev.some(x => x.type === 'land')).toBe(false);
  });

  it('is deterministic: the same hands give the same flight', () => {
    const fly = () => {
      const T = terrain(9);
      const e = new Eaglet(T, () => undefined);
      const r = mulberry32(3);
      let held = false;
      for (let i = 0; i < 120 * 30; i++) {
        if (i % 20 === 0) held = r() < 0.4;
        T.ensure(e.x + 4);
        e.step(DT, { ...open, held });
      }
      return [e.x, e.y, e.maxX, e.mode];
    };
    expect(fly()).toEqual(fly());
  });
});

describe('the catch', () => {
  it('rolling back 0.8 s calls the parent, who carries the eaglet over the next crest; no distance is lost', () => {
    const T = terrain(2);
    const { up } = slopes(T);
    const ev: FlightEvent[] = [];
    const e = new Eaglet(T, x => ev.push(x));
    e.x = up;
    e.maxX = up + 0.05;
    e.y = T.height(up);
    e.s = -0.3;
    e.stun = 5;
    let maxX = e.maxX, t = 0;
    while (!ev.some(x => x.type === 'catch') && t < 3) {
      e.step(DT, open);
      t += DT;
      expect(e.maxX).toBeGreaterThanOrEqual(maxX);
      maxX = e.maxX;
    }
    expect(ev.find(x => x.type === 'catch')).toEqual({ type: 'catch', why: 'roll' });
    expect(t).toBeGreaterThanOrEqual(RULES.rollBack - 0.02);
    expect(t).toBeLessThan(RULES.rollBack + 0.1);
    const crest = T.crestAfter(maxX);
    while (!ev.some(x => x.type === 'carried')) {
      e.step(DT, open);
      expect(e.maxX).toBeGreaterThanOrEqual(maxX);
      maxX = e.maxX;
    }
    expect(e.x).toBeGreaterThan(crest.x);
    expect(e.mode).toBe('air');
    // set down gently: the first touchdown after a carry is no landing
    ev.length = 0;
    while (e.mode === 'air') e.step(DT, open);
    expect(ev.some(x => x.type === 'land')).toBe(false);
    expect(e.s).toBeGreaterThanOrEqual(RULES.releaseV - 0.01);
  });

  it('catches an eaglet that drops into a wadi and carries it over the far rim', () => {
    const T = terrain(2);
    const r = T.ridges[0];
    const ev: FlightEvent[] = [];
    const e = flying(T, r.wadiX0 + 0.05, 0, 0.6, -30, ev);
    e.y = r.cragY - 0.1;
    while (!ev.some(x => x.type === 'carried')) e.step(DT, open);
    expect(ev.find(x => x.type === 'catch')).toEqual({ type: 'catch', why: 'wadi' });
    expect(e.x).toBeGreaterThan(r.wadiX1);
  });

  it('lets the eaglet ride the gorge on the ground no more than in the air', () => {
    const T = terrain(2);
    const r = T.ridges[0];
    const ev: FlightEvent[] = [];
    const e = new Eaglet(T, x => ev.push(x));
    e.x = e.maxX = r.wadiX0 + 0.02;
    e.y = T.height(e.x);
    e.s = 0.3;
    for (let i = 0; i < 240 && !ev.length; i++) e.step(DT, tuck);
    expect(ev.some(x => x.type === 'catch' && x.why === 'wadi')).toBe(true);
  });
});

/** The harness's hands: hold on downslopes and let go on upslopes (the doc's scripted policy), or a random tapper. */
type Hands = (e: Eaglet, t: number, T: Terrain) => boolean;
const scripted: Hands = (e, _t, T) => T.slope(e.x) < 0;
function randomTapper(seed: number): Hands {
  const r = mulberry32(seed);
  let until = 0, next = 0;
  return (_e, t) => {
    if (t >= next) {
      until = t + 0.05 + r() * 0.5;
      next = until + 0.2 + r() * 1.2;
    }
    return t < until;
  };
}
function feel(hands: Hands, seed: number, sec: number, gentle: boolean, W: number = RULES.wNeutral) {
  const rs = mulberry32(seed);
  const T = new Terrain(() => spec((rs() * 2 ** 32) >>> 0, { gentle }));
  T.ensure(5);
  const ev: FlightEvent[] = [];
  const e = new Eaglet(T, x => ev.push(x));
  let land = 0, smooth = 0, catches = 0;
  for (let t = 0; t < sec; t += DT) {
    T.ensure(e.x + 4);
    e.step(DT, { held: hands(e, t, T), W, draft: 0, soaring: false });
    for (const x of ev) {
      if (x.type === 'land') {
        land++;
        if (x.cls === 'smooth') smooth++;
      } else if (x.type === 'catch') catches++;
    }
    ev.length = 0;
  }
  const ridges = Math.max(0.5, e.maxX / (T.ridges[0].wadiX1 - T.ridges[0].x0));
  return { smoothShare: smooth / Math.max(1, land), land, catchesPerRidge: catches / ridges };
}

describe('the feel (the headless harness)', () => {
  it('lands ≥ 60 % smooth on gentle ridges for a player who holds on downslopes and lets go on upslopes', () => {
    let land = 0, smooth = 0;
    for (const seed of [1, 2, 3, 4]) {
      const r = feel(scripted, seed, 60, true);
      land += r.land;
      smooth += r.smoothShare * r.land;
    }
    expect(land).toBeGreaterThan(100);
    expect(smooth / land).toBeGreaterThanOrEqual(0.6);
  });

  it('keeps a random tapper under one catch per ridge, and more lift never makes it worse', () => {
    // a random tapper's catches are wadis it happens to dive into, whatever the wings: over 120
    // seeds lift 0.85 changes them by −0.02 ± 0.02 a ridge (0.53 neutral), while one seed varies by
    // ±0.24, so six seeds could order the two either way.  The rules promise that the band adds
    // (airtime, height), never that it takes: the lifted rate stays within the noise of the neutral.
    const seeds = Array.from({ length: 48 }, (_, i) => i + 1);
    const avg = (W: number) => seeds.reduce((s, seed) => s + feel(randomTapper(seed), seed, 120, false, W).catchesPerRidge, 0) / seeds.length;
    const neutral = avg(RULES.wNeutral), lifted = avg(0.85);
    expect(neutral).toBeLessThan(1);
    expect(lifted).toBeLessThan(1);
    expect(lifted).toBeLessThanOrEqual(neutral + 0.1);
  });
});

// ── the band ───────────────────────────────────────────────────
describe('Lekcja lotu: the wings, the follow steps, the returns', () => {
  it('opens the wings with L only after the lead-in (5 s Mendi, 2 s HALO), never below the neutral 0.55', () => {
    expect(wingsFor(0)).toBe(RULES.wNeutral);
    expect(wingsFor(0.42)).toBeCloseTo(RULES.wNeutral, 2);
    expect(wingsFor(0.5)).toBeCloseTo(0.6, 9);
    expect(wingsFor(0.88)).toBeCloseTo(0.828, 9);
    expect(wingsFor(1)).toBeCloseTo(0.9, 9);
    for (const [eeg, lead] of [[false, 5], [true, 2]] as const) {
      const sim = later({ eeg });
      expect(sim.block.kind).toBe('lekcja');
      const clock = { t: 0 };
      drive(sim, lead - 0.3, frame({ level: 1, focused: true }), clock);
      expect(sim.W).toBe(RULES.wNeutral);
      drive(sim, 4, frame({ level: 1, focused: true }), clock);
      expect(sim.W).toBeGreaterThan(0.7);
      expect(sim.wShown).toBeGreaterThan(0.65);
    }
  });

  it('smooths the level again with τ 2.5 s on Mendi and 0.8 s on HALO', () => {
    const climb = (eeg: boolean) => {
      const sim = later({ eeg });
      sim.L = 0;
      drive(sim, 1, frame({ level: 1 }));
      return sim.L;
    };
    expect(climb(false)).toBeCloseTo(1 - Math.exp(-1 / 2.5), 1);
    expect(climb(true)).toBeCloseTo(1 - Math.exp(-1 / 0.8), 1);
  });

  it('adds a follow step every full 6 s of hold (+4 % up to +12 % at 18 s), easing off over 3 s', () => {
    expect([0, 5.9, 6, 12, 18, 30].map(followFor)).toEqual([0, 0, 0.04, 0.08, 0.12, 0.12]);
    const sim = later();
    lasting(sim, 40);
    const clock = { t: 0 };
    drive(sim, RULES.leadIn.fnirs, frame(), clock);
    const start = clock.t;
    const evs = drive(sim, 19, t => frame({ level: 0.9, focused: true, hold: t - start }), clock);
    expect(ofType(evs, 'step').map(e => e.bonus)).toEqual([0.04, 0.08, 0.12]);
    expect(sim.follow).toBeCloseTo(0.12, 9);
    drive(sim, 1.5, frame({ level: 0.3 }), clock);
    expect(sim.follow).toBeCloseTo(0.06, 2);
    drive(sim, 2, frame({ level: 0.3 }), clock);
    expect(sim.follow).toBe(0);
  });

  /** A Lekcja on a band where focus breaks at `off` for `lapse` s, then holds again. */
  function lapseAndReturn(eeg: boolean, lapse: number, holdAfter = 6) {
    const sim = later({ eeg });
    lasting(sim, 40);
    const clock = { t: 0 };
    const lead = RULES.leadIn[eeg ? 'eeg' : 'fnirs'];
    drive(sim, lead + 1, frame({ focused: true, hold: 3 }), clock);
    const evs = drive(sim, lapse, frame({ focused: false }), clock);
    const back = clock.t;
    evs.push(...drive(sim, holdAfter, t => frame({ focused: true, hold: t - back }), clock));
    return { sim, evs };
  }

  it('celebrates a return after a lapse of ≥ 6 s with a hold of ≥ 4 s on Mendi (≥ 4 s and ≥ 3 s on HALO), gold within 10 s', () => {
    const r = lapseAndReturn(false, 7);
    expect(ofType(r.evs, 'lapse')).toHaveLength(1);
    const ret = ofType(r.evs, 'return');
    expect(ret).toHaveLength(1);
    expect(ret[0].lapse).toBeCloseTo(7, 1);
    expect(ret[0].gold).toBe(true);
    expect(r.sim.draft).toBeCloseTo(RULES.retBonus, 9);
    expect(ofType(lapseAndReturn(false, 12).evs, 'return')[0].gold).toBe(false);
    expect(ofType(lapseAndReturn(false, 5).evs, 'return')).toHaveLength(0);     // too short for Mendi
    expect(ofType(lapseAndReturn(true, 4.5).evs, 'return')).toHaveLength(1);    // long enough for HALO
    expect(ofType(lapseAndReturn(false, 7, 3.5).evs, 'return')).toHaveLength(0); // not held long enough yet
  });

  it('never rewards the lapse itself, and celebrates at most three returns a block', () => {
    const sim = later({ planned: 600 });
    lasting(sim, 70);
    const clock = { t: 0 };
    drive(sim, 6, frame({ focused: true, hold: 3 }), clock);
    const lapse = drive(sim, 7, frame({ focused: false }), clock);
    expect(lapse.filter(e => e.type === 'step' || e.type === 'return' || e.type === 'feather')).toHaveLength(0);
    expect(sim.draft).toBe(0);
    expect(sim.parent).toBe('circling');
    let returns = 0;
    for (let k = 0; k < 5 && sim.block.kind === 'lekcja'; k++) {
      const back = clock.t;
      returns += ofType(drive(sim, 4.5, t => frame({ focused: true, hold: t - back }), clock), 'return').length;
      drive(sim, 6.5, frame({ focused: false }), clock);
    }
    expect(returns).toBeLessThanOrEqual(RULES.retMax);
    expect(sim.returns.length).toBeLessThanOrEqual(RULES.retMax);
  });

  it('pauses the lapse clock while the signal is unreliable: a gap never counts as a lapse', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 6, frame({ focused: true, hold: 3 }), clock);
    const evs = drive(sim, 9, frame({ reliable: false, activity: null, focused: false, level: 0, calm: 0 }), clock);
    expect(ofType(evs, 'lapse')).toHaveLength(0);
    expect(sim.lapse).toBe('none');
  });
});

describe('Wznoszenie: the thermals', () => {
  it('builds T from calm after the lead-in: dT/dt = 0.07 × calm − 0.015', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    expect(sim.block.kind).toBe('wzn');
    drive(sim, RULES.tLeadIn.fnirs - 0.2, frame({ calm: 1 }), clock);
    expect(sim.T).toBe(0);
    drive(sim, 10.2, frame({ calm: 1 }), clock);
    expect(sim.T).toBeCloseTo((0.07 - 0.015) * 10, 1);
    const calm = sim.T;
    drive(sim, 2, frame({ reliable: false, activity: null, calm: 0 }), clock);
    expect(sim.T).toBe(calm);                                            // a gap holds it
  });

  it('lifts (0.6 + 1.4 T) sh/s for (1 + 2 T) s: about 1.2 screens at T 0.2 and 4.5 at T 0.8', () => {
    const lift = (T: number) => climbFor(T).rate * climbFor(T).dur;
    expect(lift(0.2)).toBeCloseTo(1.23, 2);
    expect(lift(0.8)).toBeCloseTo(4.5, 1);
  });

  it('raises 2–3 thermals a block ahead of the eaglet; gliding into one with open wings climbs it', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const evs = drive(sim, sim.block.dur - 0.5, frame({ calm: 0.9 }), clock);
    const rose = ofType(evs, 'thermalRise');
    expect(rose.length).toBeGreaterThanOrEqual(2);
    expect(rose.length).toBeLessThanOrEqual(RULES.thermalMax);
    for (const r of rose) expect(r.thermal.x).toBeGreaterThan(0);
    expect(ofType(evs, 'thermal').length).toBeGreaterThanOrEqual(1);    // the idle eaglet glides into them
    expect(sim.thermalsRidden).toBeGreaterThanOrEqual(1);
  });

  it('lets a press fold the wings and drop out of a climb', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    while (sim.eaglet.mode !== 'climb' && sim.block.kind === 'wzn') drive(sim, STEP, frame({ calm: 0.9 }), clock);
    expect(sim.eaglet.mode).toBe('climb');
    sim.pointer('down', 1);
    drive(sim, 0.1, frame(), clock);
    expect(sim.eaglet.mode).not.toBe('climb');
    sim.pointer('up', 1);
  });
});

describe('the verdicts', () => {
  it('judges each block with the session\'s tuning: a passed block grows a feather; a fail shows the honest margin', () => {
    const sim = later({ progress: { missions: ['follow', 'km8', 'high3'] } });
    const clock = { t: 0 };
    const feathers = sim.p.feathers;
    let evs = toBlock(sim, 1, frame({ activity: 8, level: 0.9, focused: true, hold: 10 }), clock);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBe(true);
    expect(end.need).toBeCloseTo(RoundJudge.from(TUNING).need('focus'), 9);
    expect(sim.p.feathers).toBe(feathers + 1);
    evs = toBlock(sim, 2, frame({ activity: 8, level: 0.9, calm: 0.1 }), clock);
    const fail = ofType(evs, 'blockEnd')[0];
    expect(fail.verdict).toBe(false);
    expect(fail.share).toBeLessThan(fail.need);
    expect(sim.p.feathers).toBe(feathers + 1);
  });

  it('makes the next Wznoszenie\'s first thermal strong (+0.2 T) after a passed one', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    toBlock(sim, 3, frame({ activity: -3, level: 0.1, calm: 0.9 }), clock);
    expect(sim.block.kind).toBe('wzn');
    const rose = ofType(drive(sim, RULES.thermalFirst + 0.2, frame({ calm: 0 }), clock), 'thermalRise');
    expect(rose[0].thermal.bonus).toBeCloseTo(RULES.tPassBonus, 9);
    expect(sim.strengthOf(rose[0].thermal)).toBeGreaterThanOrEqual(RULES.tPassBonus - 1e-9);
  });

  it('has no verdict for a block with fewer than 8 reliable seconds, and floors its thermals at 0.4', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    const gap = frame({ reliable: false, activity: null, calm: 0, level: 0 });
    const evs = drive(sim, 7, gap, clock);
    const th = ofType(evs, 'thermalRise')[0]?.thermal;
    expect(th).toBeDefined();
    expect(sim.strengthOf(th!)).toBeCloseTo(RULES.tFloor, 9);
    const end = ofType(toBlock(sim, 2, gap, clock), 'blockEnd')[0];
    expect(end.verdict).toBeNull();
  });

  it('leans further toward a beginner (their judge needs less)', () => {
    expect(RoundJudge.from(BEGINNER).need('focus')).toBeLessThan(RoundJudge.from(TUNING).need('focus'));
  });
});

describe('W chmurze: the blind Lekcja', () => {
  /** A returning player whose next Lekcja is the 4th one counted (blind), from the 3rd session on. */
  const blindSession = () => later({ progress: { sessions: 4, lekcje: 2 }, planned: 300 });

  it('comes every 4th Lekcja across sessions from the 3rd session, never a session\'s first', () => {
    const sim = blindSession();
    const clock = { t: 0 };
    expect(sim.block.blind).toBe(false);                 // the session's first Lekcja (the 3rd counted)
    toBlock(sim, 2, frame(), clock);
    expect(sim.block.kind).toBe('lekcja');
    expect(sim.block.blind).toBe(true);                  // the 4th
    const early = later({ progress: { sessions: 1, lekcje: 2 }, planned: 300 });
    toBlock(early, 2, frame(), { t: 0 });
    expect(early.block.blind).toBe(false);               // the 2nd session: never blind
  });

  it('shows nothing and changes nothing: neutral wings, no steps, no returns, the pad held still', () => {
    const sim = blindSession();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const start = clock.t;
    const evs = drive(sim, 14, t => frame({ activity: 8, level: 0.95, focused: t - start < 3 || t - start > 10, hold: Math.max(0, t - start - 10) }), clock);
    expect(sim.W).toBe(RULES.wNeutral);
    expect(evs.filter(e => e.type === 'step' || e.type === 'return' || e.type === 'lapse')).toHaveLength(0);
    expect(sim.padLevel(frame({ level: 0.9 }))).toBeNull();
    expect(sim.parent).toBe('cloud');
  });

  it('reveals its focus at the exit ("W chmurze: 11 s skupienia") and opens a bonus thermal of that strength', () => {
    const sim = blindSession();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    const dur = sim.block.dur;
    const start = clock.t;
    const evs = toBlock(sim, 3, t => frame({ activity: 8, level: 0.9, focused: t - start > dur - 11 }), clock);
    const reveal = ofType(evs, 'blindReveal')[0];
    expect(reveal.sec).toBeGreaterThanOrEqual(10);
    expect(reveal.sec).toBeLessThanOrEqual(12);
    expect(t('blind.reveal', { n: reveal.sec })).toBe(`W chmurze: ${reveal.sec} s skupienia`);
    const bonus = ofType(evs, 'thermalRise').find(e => e.thermal.fixed !== null)!;
    expect(bonus.thermal.fixed).toBeCloseTo(reveal.T, 9);
    expect(reveal.T).toBeCloseTo(reveal.sec / 15, 1);
  });
});

describe('a bad signal: everything brain-driven holds at neutral', () => {
  it('fills the valleys with mist, eases the wings to neutral through the kit\'s fade and keeps the block clock running', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 9, frame({ level: 1, focused: true }), clock);
    expect(sim.W).toBeGreaterThan(0.8);
    const block = sim.blockT;
    // the kit's level fades to zero during a long gap
    drive(sim, 6, t => frame({ reliable: false, activity: null, level: Math.max(0, 1 - (t - 9) / 2), calm: 0 }), clock);
    expect(sim.fog).toBeGreaterThan(0.9);
    expect(sim.W).toBeCloseTo(RULES.wNeutral, 2);
    expect(sim.blockT).toBeCloseTo(block + 6, 1);
    expect(sim.padLevel(frame({ reliable: false }))).toBeNull();
  });

  it('lets nothing fall for a while after a long dropout, while the band climbs back', () => {
    const sim = later();
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    drive(sim, 10, frame({ calm: 1 }), clock);
    const T = sim.T;
    drive(sim, 3, frame({ reliable: false, activity: null, calm: 0 }), clock);
    drive(sim, 3, frame({ calm: 0.05 }), clock);
    expect(sim.T).toBeGreaterThanOrEqual(T);
  });
});

describe('the pad', () => {
  it('follows the wings in a sighted Lekcja, glows mid in the warm-up and holds still in rest, blind blocks and the finisher', () => {
    const first = makeSim({ planned: 300 });
    expect(first.block.kind).toBe('warmup');
    expect(first.padLevel(frame())).toBe(0.5);
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 9, frame({ level: 1, focused: true }), clock);
    expect(sim.padLevel(frame())).toBeGreaterThan(0.4);
    toBlock(sim, 1, frame(), clock);
    expect(sim.padLevel(frame())).toBeNull();
    sim.finish();
    expect(sim.padLevel(frame())).toBeNull();
  });
});

// ── the session ────────────────────────────────────────────────
describe('the block plan', () => {
  const sum = (plan: { dur: number }[]) => plan.reduce((s, b) => s + b.dur, 0);
  it.each([40, 180, 300, 600])('fills %i s, ends with a Wznoszenie and leaves 6 s for the finisher; no block under 12 s', sec => {
    for (const first of [true, false]) {
      for (let seed = 1; seed <= 5; seed++) {
        const plan = planBlocks(sec, first, mulberry32(seed));
        expect(sum(plan)).toBeCloseTo(sec - RULES.finale, 6);
        expect(plan[plan.length - 1].kind).toBe('wzn');
        expect(plan[0].kind).toBe(first ? 'warmup' : 'lekcja');
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        for (let i = 1; i < plan.length; i++) if (plan[i].kind !== 'warmup') expect(plan[i].kind).not.toBe(plan[i - 1].kind);
        expect(plan.filter(b => b.stretch)).toHaveLength(sec >= 300 ? 1 : 0);
      }
    }
  });

  it('plays 40 s as warm-up 6, Lekcja 14, Wznoszenie 14 (else Lekcja 20, Wznoszenie 14), and warms up 30 / 20 s', () => {
    expect(planBlocks(40, true, mulberry32(1)).map(b => [b.kind, b.dur])).toEqual([['warmup', 6], ['lekcja', 14], ['wzn', 14]]);
    expect(planBlocks(40, false, mulberry32(1)).map(b => [b.kind, b.dur])).toEqual([['lekcja', 20], ['wzn', 14]]);
    expect(planBlocks(300, true, mulberry32(1))[0].dur).toBe(30);
    expect(planBlocks(600, true, mulberry32(1))[0].dur).toBe(30);
    expect(planBlocks(180, true, mulberry32(1))[0].dur).toBe(20);
  });

  it('opens the stretch\'s wide valley in its Lekcja ("Długi przelot")', () => {
    const sim = later({ planned: 300 });
    const i = sim.plan.findIndex(b => b.stretch);
    const clock = { t: 0 };
    toBlock(sim, i, frame(), clock);
    expect(sim.tip).toBe(TIPS.stretch);
    drive(sim, sim.block.dur - 0.5, frame(), clock);
    const wide = sim.terrain.ridges.find(r => r.spec.wide);
    expect(wide).toBeDefined();
    expect(wide!.wadiX1 - wide!.wadiX0).toBeGreaterThanOrEqual(RULES.wideWidth[0]);
  });

  it('telegraphs the next block 4 s ahead (the parent appears before a Lekcja) and plays the finisher to the nest', () => {
    const sim = later({ planned: 180 });
    const clock = { t: 0 };
    const evs = toBlock(sim, 2, frame(), clock);
    const tele = ofType(evs, 'telegraph');
    expect(tele.map(e => e.next.kind)).toEqual(['wzn', 'lekcja']);
    expect(sim.parent).toBe('ahead');
    const rest = drive(sim, 200, frame(), clock);
    expect(ofType(rest, 'finale')).toHaveLength(1);
    expect(ofType(rest, 'nest')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('may not stop mid-finisher, and gives up waiting 4 s after time is up', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 36, frame(), clock);
    expect(sim.phase).toBe('finale');
    expect(sim.canStop()).toBe(false);
    drive(sim, 5, frame(), clock);
    expect(sim.canStop()).toBe(true);
  });
});

describe('the plumage, the vistas, the flight log', () => {
  it('grows plumage from showing up: stages at 12 and 30 feathers; three per saved session', () => {
    expect([0, 11, 12, 29, 30, 99].map(stageOf)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(toNextStage(5)).toEqual({ have: 5, need: 12 });
    expect(toNextStage(20)).toEqual({ have: 8, need: 18 });
    expect(toNextStage(30)).toBeNull();
    const sim = later({ planned: 40 });
    const f = sim.p.feathers;
    sim.finish();
    expect(sim.p.feathers).toBe(f + RULES.featherSession);
  });

  it('gives first feathers +5 % base lift and flight feathers one wingbeat per ridge', () => {
    const two = later({ progress: { feathers: 12 } });
    drive(two, 1, frame());
    expect(two.W).toBeCloseTo(RULES.wNeutral * 1.05, 9);
    const one = later();
    expect(one.wingbeat()).toBe(false);
    const three = later({ progress: { feathers: 30 } });
    const clock = { t: 0 };
    drive(three, 1, frame(), clock);
    expect(three.wingbeat()).toBe(true);
    expect(three.eaglet.mode).toBe('air');
    expect(three.wingbeat()).toBe(false);                // once per ridge
    // a double tap (two downs within 0.32 s) is a wingbeat too, on the next ridge
    while (three.terrain.ridgeAt(three.eaglet.x)!.index === 0) drive(three, STEP, frame(), clock);
    three.pointer('down', 1);
    three.pointer('up', 1);
    drive(three, 0.1, frame(), clock);
    three.pointer('down', 1);
    expect(ofType(three.take(), 'wingbeat')).toHaveLength(1);
    expect(three.held).toBe(false);                      // the beat took that press
    three.pointer('up', 1);
  });

  it('draws a vista evenly among the four of the sky\'s light; duplicates give down, 10 down craft the next missing one', () => {
    const p = freshProgress();
    expect(newChance(p, 'dawn')).toBe(1);
    const counts = [0, 0, 0, 0, 0, 0, 0, 0];
    const rnd = mulberry32(5);
    for (let i = 0; i < 4000; i++) {
      const q = freshProgress();
      counts[drawVista(q, 'dusk', rnd).index]++;
    }
    for (let i = 0; i < 4; i++) expect(counts[i]).toBe(0);
    for (let i = 4; i < 8; i++) expect(counts[i] / 4000).toBeCloseTo(0.25, 1);
    const q = { ...freshProgress(), vistas: [0, 1, 2, 3] };
    expect(newChance(q, 'dawn')).toBe(0);
    const dup = drawVista(q, 'dawn', mulberry32(1));
    expect(dup.isNew).toBe(false);
    expect(q.down).toBe(RULES.dupDown);
    const again = drawVista(q, 'dawn', mulberry32(2));
    expect(again.crafted).toEqual([4]);                    // the missing one, of the other light
    expect(q.down).toBe(0);
    expect(nextMissing({ ...freshProgress(), vistas: VISTAS.map(v => v.index) })).toBeNull();
  });

  it('pities two dry sessions: the next climb above 100 m opens a new vista', () => {
    const p = { ...freshProgress(), vistas: [0], lastVistaSession: 2 };
    expect(pityDue(p, 4)).toBe(false);
    expect(pityDue(p, 5)).toBe(true);
    const forced = drawVista({ ...p, vistas: [0, 1, 2] }, 'dawn', () => 0, true);
    expect(forced.isNew).toBe(true);
    expect(forced.index).toBe(3);
    expect(RULES.vistaAltPity * RULES.mPerSh).toBeCloseTo(100, 6);
    expect(RULES.vistaAlt * RULES.mPerSh).toBeCloseTo(150, 6);
  });

  it('pays a climb\'s vista at the block\'s end, never during it', () => {
    const sim = later({ progress: { lastVistaSession: 6 }, seed: 3 });
    const clock = { t: 0 };
    toBlock(sim, 1, frame(), clock);
    sim.T = 1;                                            // a deep calm already: the first thermal lifts high
    const during = drive(sim, sim.block.dur - 0.3, frame({ calm: 1 }), clock);
    expect(ofType(during, 'vistaSeen').length).toBeGreaterThanOrEqual(1);
    expect(ofType(during, 'vista')).toHaveLength(0);
    const after = drive(sim, 0.5, frame(), clock);
    expect(ofType(after, 'vista').length).toBeGreaterThanOrEqual(1);
    expect(after.findIndex(e => e.type === 'vista')).toBeLessThan(after.findIndex(e => e.type === 'blockEnd'));
  });

  it('keeps three missions open; a done one gives a feather and its page turns after the session', () => {
    expect(freshProgress().missions).toEqual(MISSIONS.slice(0, 3).map(m => m.id));
    const p = freshProgress();
    turnPages(p, ['thermals2']);
    expect(p.missions).toEqual(['soar', 'chain5', 'km3']);
    expect(p.missionNext).toBe(4);
    for (const m of MISSIONS) expect(['chain', 'thermals', 'metres', 'glideHills', 'altitude', 'ridges', 'smooth', 'soarSec', 'glideLen', 'follow']).toContain(m.kind);
    const sim = later({ planned: 180, progress: { missions: ['km3', 'chain5', 'glide3'] } });
    const f = sim.p.feathers;
    const evs = drive(sim, 120, frame());
    expect(ofType(evs, 'mission').map(e => e.id)).toContain('km3');
    expect(sim.p.feathers).toBeGreaterThanOrEqual(f + 1);
    sim.finish();
    expect(sim.p.missions).not.toContain('km3');
  });

  it('seeds the day\'s first session\'s first ridge with the date, the same for everyone, and keeps its metres in the air', () => {
    const a = makeSim({ progress: { sessions: 3 }, daySeed: 777, seed: 1 });
    const b = makeSim({ progress: { sessions: 9 }, daySeed: 777, seed: 2 });
    const ka = a.terrain.keys(0, a.terrain.ridges[0].wadiX1).map(k => k.y);
    expect(b.terrain.keys(0, b.terrain.ridges[0].wadiX1).map(k => k.y)).toEqual(ka);
    expect(a.daily).toBe(true);
    const c = later({ daySeed: 777 });
    expect(c.daily).toBe(false);
    expect(c.terrain.keys(0, c.terrain.ridges[0].wadiX1).map(k => k.y)).not.toEqual(ka);
    // a first-ever session warms up on the gentle ridge first: the day's ridge is its second
    const first = makeSim({ daySeed: 777 });
    expect(first.dailyRidge).toBe(1);
    drive(a, 30, frame());
    a.finish();
    expect(a.p.dailyDay).toBe(DAY);
    expect(a.p.dailyAir).toBeGreaterThan(0);
  });

  it('gives the day\'s gift to the day\'s first session whatever the score, once', () => {
    const sim = makeSim({ progress: { sessions: 2, giftDay: '2026-10-24', lekcje: 2 }, planned: 40 });
    const f = sim.p.feathers;
    sim.finish();
    expect(sim.p.feathers).toBe(f + RULES.featherSession + RULES.featherGift);
    expect(sim.p.giftDay).toBe(DAY);
    const again = makeSim({ progress: { ...sim.p }, planned: 40 });
    const g = again.p.feathers;
    again.finish();
    expect(again.p.feathers).toBe(g + RULES.featherSession);
  });
});

describe('the summary', () => {
  it('closes with a passage the session fits, in turn from session to session, never the root', () => {
    const verse = (o: Partial<WzlotSim>) => {
      const sim = later({ progress: { sessions: 0 } });   // the first session takes the best fit
      Object.assign(sim, o);
      return sim.closingVerse();
    };
    expect(verse({ catches: 1 })).toBe('psa91.4');
    expect(verse({ maxClimb: 4 })).toBe('isa40.31');
    expect(verse({ stageNow: 3 })).toBe('psa103.5');
    expect(verse({})).toBe('exo19.4');
    expect(inTurn(['psa91.4', 'exo19.4'], 2)).toBe('exo19.4');
    for (const id of ['psa91.4', 'isa40.31', 'psa103.5', 'exo19.4'] as const) expect(passage(id).text.length).toBeGreaterThan(20);
    const sim = later({ planned: 40 });
    drive(sim, 10, frame());
    expect(sim.result().verse).not.toBe('deu32.11');
  });

  it('result() is idempotent: records with Math.max, counters once, when the session is settled', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 20, frame(), clock);
    const mid = sim.result();
    expect(sim.p.sessions).toBe(5);                        // not counted before it is settled
    drive(sim, 25, frame(), clock);
    sim.finish();
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    expect(a.score).toBeGreaterThanOrEqual(mid.score);
    expect(sim.p.sessions).toBe(6);
    const metres = sim.p.metres, feathers = sim.p.feathers;
    sim.finish();
    sim.result();
    expect(sim.p.metres).toBe(metres);
    expect(sim.p.feathers).toBe(feathers);
    expect(bestFor(sim.p, 40)).toBe(a.score);
    expect(a.stats.length).toBeLessThanOrEqual(8);
    expect(a.unit).toBe('m');
  });

  it('adds the finale glide to the total flown: the total grows by exactly the session\'s score', () => {
    const sim = later({ planned: 40 });
    const before = sim.p.metres;
    const clock = { t: 0 };
    drive(sim, 40 + RULES.settle + 5, frame(), clock);
    const o = sim.result();
    expect(sim.p.metres - before).toBe(o.score);
    sim.result();
    expect(sim.p.metres - before).toBe(o.score);
  });

  it('marks a record against the same session length only', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 10, 300: 99999 } } });
    drive(sim, 30, frame());
    sim.finish();
    expect(sim.result().record).toBe(true);
    expect(sim.p.best['300']).toBe(99999);
  });

  it('counts a session only when it is settled: an abandoned first attempt leaves the next one the first', () => {
    const p = freshProgress();
    const a = new WzlotSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
    a.start();
    drive(a, 10, frame());
    a.result();
    expect(p.sessions).toBe(0);
    const b = new WzlotSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 300, eeg: false, tuning: TUNING });
    expect(b.session).toBe(1);
    expect(b.plan[0].kind).toBe('warmup');
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('names every vista, mission and stage, and writes distances with a no-break space', () => {
    for (const v of VISTAS) expect(v.name).toMatch(/świcie|zmierzchu/);
    for (const m of MISSIONS) expect(m.name.length).toBeGreaterThan(5);
    expect(STAGES.map(s => s.name)).toEqual(['Puch', 'Pierwsze pióra', 'Lotki']);
    expect(metres(1234)).toBe(`1 234 m`);
    expect(km(1234)).toBe('1,2 km');
  });

  it('never calls the parent anything but an eagle, and never asks to concentrate harder', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /energ/, /transcend/, /\bflow\b/, /\bbóg\b/, /\bgod\b/, /\bgott\b/, /\bgud\b/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap at the centre every ~0.65 s, Space after every third one, the simulator's focus on. */
  function smoke(progress: Partial<WzlotProgress>, seed: number, eeg: boolean, every = 0.65) {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at1 = 0, at22 = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);   // activity rises to about +20 % in ~10 s
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= every) {
        tap -= every;
        sim.pointer('down', 1);
        sim.pointer('up', 1);
        if (taps++ % 3 === 0) {
          sim.key(' ', true);
          sim.key(' ', false);
        }
      }
      sim.take();
      if (t <= 1) at1 = sim.result().score;
      at22 = sim.result().score;
    }
    return { at1, at22 };
  }

  it('scores within the first second and keeps scoring at 22 s, on either band, any tap rhythm', () => {
    for (const eeg of [false, true]) {
      for (const every of [0.65, 0.7]) {
        for (let seed = 1; seed <= 12; seed++) {
          const r = smoke({}, seed, eeg, every);
          expect(r.at1, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
          expect(r.at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(400);
        }
      }
    }
    expect(smoke({ sessions: 6, dailyDay: DAY }, 3, false).at22).toBeGreaterThan(400);
  });

  it('medians the return times only from three returns', () => {
    expect(median([7, 3, 9])).toBe(7);
    expect(median([4, 6])).toBe(5);
    expect(median([])).toBeNull();
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first flight', async () => {
    const { bestOf } = await import('../src/arcade/wzlot/panel');
    const mod = (await import('../src/arcade/wzlot/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 900, 300: 1500 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(900);
    p.lastLen = 600;
    expect(bestOf(p)).toBe(1500);
    expect(mod.best(p)).toBe(1500);
  });

  it('builds the progress card from elements: the eight vistas, the plumage, the three pages of the flight log', async () => {
    const { progressPanel } = await import('../src/arcade/wzlot/panel');
    const p = { ...freshProgress(), sessions: 3, feathers: 14, vistas: [0, 5], metres: 12_400 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(VISTAS.length);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(2);
    expect(el.textContent).toContain('Pierwsze pióra');
    expect(el.textContent).toContain(km(12_400));
    for (const id of p.missions) expect(el.textContent).toContain(MISSIONS.find(m => m.id === id)!.name);
  });
});
