import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import {
  CHUNKS, FINISH, HOMES, MISSIONS, REVEAL, SHADE, TIPS, WARM, chunkById, course, courseChunks, dailyCourse, type ChunkDef, type Item,
} from '../src/arcade/zacheusz/content';
import { Hero, type HeroEvent } from '../src/arcade/zacheusz/hero';
import { CATALOGS, t, unit } from '../src/arcade/zacheusz/i18n';
import {
  bestOf, finishCourse, freshProgress, homesRestored, pickCourse, tierOf, toNextHome, turnPages, unlocked, type ZacheuszProgress,
} from '../src/arcade/zacheusz/meta';
import { RULES } from '../src/arcade/zacheusz/rules';
import { ZacheuszSim, branchFor, figsFor, planBlocks, specialSlots, type SimEvent } from '../src/arcade/zacheusz/sim';
import { World } from '../src/arcade/zacheusz/world';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-02';
const STEP = 1 / 60;
const DT = RULES.step;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

type SimOpts = { progress?: Partial<ZacheuszProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ZacheuszSim {
  const sim = new ZacheuszSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player's session (no warm-up, no day's course, the gift taken). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, dailyDay: DAY, giftDay: DAY, pushes: 1, ...o.progress } });

function drive(sim: ZacheuszSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** A tapping hand: a quick tap every `every` s (the smoke test's rhythm). */
const tapper = (sim: ZacheuszSim, every = 0.65) => {
  let acc = 0;
  return () => {
    if ((acc += STEP) >= every) {
      acc -= every;
      sim.pointer('down', 1);
      sim.pointer('up', 1);
    }
  };
};

// ── the run: a street of our own ─────────────────────────────────
const def = (items: Item[], w = 40): ChunkDef => ({ id: 'test', w, diff: 0, zone: 'course', items });

function street(items: Item[], w = 40) {
  const world = new World();
  world.lay(def(items, w), { course: 0 });
  const ev: HeroEvent[] = [];
  const hero = new Hero(e => ev.push(e));
  hero.place(1, 0, RULES.run);
  const run = (sec: number, each?: (t: number) => void) => {
    for (let i = 0, n = Math.round(sec / DT); i < n; i++) {
      each?.(i * DT);
      hero.step(DT, world);
    }
  };
  return { world, hero, ev, run };
}

/** The highest point of one jump, holding for `hold` s. */
function jumpPeak(hold: number): number {
  const s = street([]);
  s.hero.press();
  let peak = 0, held = true;
  s.run(1.2, t => {
    if (held && t >= hold) { s.hero.release(); held = false; }
    peak = Math.max(peak, s.hero.y);
  });
  return peak;
}

describe('the run', () => {
  it('runs right on his own at the street\'s pace', () => {
    const s = street([]);
    s.run(2);
    expect(s.hero.x).toBeGreaterThan(1 + RULES.run * 1.9);
    expect(s.hero.ground).toBe(true);
  });

  it('jumps about 1.3 u on a tap and up to about 2.9 u on a held press (Mario\'s variable jump)', () => {
    const tap = jumpPeak(0), mid = jumpPeak(0.12), full = jumpPeak(1);
    expect(tap).toBeGreaterThan(1.2);
    expect(tap).toBeLessThan(1.45);
    expect(mid).toBeGreaterThan(tap + 0.3);
    expect(full).toBeGreaterThan(2.7);
    expect(full).toBeLessThan(3.1);
    expect(jumpPeak(2)).toBeCloseTo(full, 6);   // holding longer than a quarter second adds nothing
  });

  it('vaults baskets, chickens and dogs on his own, without a tap', () => {
    const s = street([{ t: 'vault', x: 5, k: 'chicken' }, { t: 'vault', x: 9, k: 'dog' }]);
    s.run(2.5);
    expect(s.ev.filter(e => e.type === 'vault')).toHaveLength(2);
    expect(s.world.vaults.every(v => v.done)).toBe(true);
    expect(s.hero.x).toBeGreaterThan(11);
  });

  it('stops at a wall he cannot step over, and a neighbour gives him a leg-up after a while', () => {
    const s = street([{ t: 'box', a: 5, b: 6, h: 2.4, k: 'wall', ladder: false }]);
    s.run(0.9);
    expect(s.hero.x).toBeLessThan(5);
    expect(s.hero.wall).not.toBeNull();
    s.run(RULES.legUp + 1.5);
    expect(s.ev.some(e => e.type === 'legUp')).toBe(true);
    expect(s.hero.x).toBeGreaterThan(6);
  });

  it('kicks off a wall upward on a tap in the air, and repeated taps climb it', () => {
    const s = street([{ t: 'box', a: 5, b: 6, h: 3.2, k: 'wall', ladder: false }]);
    let taps = 0;
    s.run(4, t => {
      // tap when at the wall: on the street, then against it in the air
      if (s.hero.wall && Math.round(t / DT) % 30 === 0 && taps < 8) { s.hero.press(); s.hero.release(); taps++; }
    });
    expect(s.ev.some(e => e.type === 'wallJump')).toBe(true);
    expect(s.ev.some(e => e.type === 'legUp')).toBe(false);
    expect(s.hero.x).toBeGreaterThan(6);
  });

  it('pulls himself onto a ledge within reach of his hands (a low wall needs only a tap)', () => {
    const s = street([{ t: 'box', a: 5, b: 7, h: 1.4, k: 'wall', ladder: false }]);
    s.run(3, t => { if (Math.abs(t - 0.45) < DT / 2) { s.hero.press(); s.hero.release(); } });
    expect(s.ev.some(e => e.type === 'mantle')).toBe(true);
    expect(s.hero.x).toBeGreaterThan(8);
  });

  it('bounces off awnings, higher while the press is held', () => {
    const bounce = (held: boolean) => {
      const s = street([{ t: 'plat', a: 4, b: 6, y: 1.2, k: 'awning' }]);
      s.hero.place(4.5, 2, RULES.run);
      s.hero.ground = false;
      if (held) s.hero.held = true;
      let peak = 0;
      s.run(1.2, () => { peak = Math.max(peak, s.hero.y); });
      return { peak, n: s.ev.filter(e => e.type === 'bounce').length };
    };
    const a = bounce(false), b = bounce(true);
    expect(a.n).toBe(1);
    expect(a.peak).toBeGreaterThan(1.2 + 1.4);
    expect(b.peak).toBeGreaterThan(a.peak + 0.4);
  });

  it('climbs a ladder on a house\'s near side by himself and runs on over the roof', () => {
    const s = street([{ t: 'box', a: 5, b: 30, h: 2.6, k: 'house', ladder: true }]);
    s.run(2);
    expect(s.ev.some(e => e.type === 'ladder')).toBe(true);
    s.run(1);
    expect(s.hero.y).toBeCloseTo(2.6, 6);
    expect(s.hero.x).toBeGreaterThan(6);
  });

  it('falls through a high piece that is only an outline, and stands on a solid one', () => {
    for (const state of ['outline', 'solid'] as const) {
      const s = street([{ t: 'plat', a: 3, b: 8, y: 1, k: 'bridge' }]);
      s.world.plats[0].state = state;
      s.hero.place(4, 1.5, RULES.run);
      s.hero.ground = false;
      s.run(0.5);
      expect(s.hero.y).toBeCloseTo(state === 'solid' ? 1 : 0, 6);
    }
  });

  it('touching the sycamore\'s trunk reports where his feet are', () => {
    const s = street([{ t: 'box', a: 6, b: 7, h: 7, k: 'trunk', ladder: false }]);
    s.run(2);
    const e = s.ev.find(x => x.type === 'trunk');
    expect(e && e.type === 'trunk' && e.y).toBe(0);
    expect(branchFor(0)).toBe(1);
    expect(branchFor(2.3)).toBe(3);
    expect(branchFor(9)).toBe(5);
  });
});

// ── the street ───────────────────────────────────────────────────
describe('the street and its courses', () => {
  it('lays chunks with the street everywhere but in their pits, and coins on the ground path', () => {
    const w = new World();
    w.lay(chunkById('rowek')!, { course: 0 });
    expect(w.pits).toHaveLength(1);
    expect(w.topAt(7.5, 8.2)).toBe(-Infinity);
    expect(w.topAt(3, 3.2)).toBe(0);
    for (const c of CHUNKS) {
      const ground = c.items.filter(it => it.t === 'coins' && it.y <= 0.5);
      expect(ground.length, c.id).toBeGreaterThan(0);
    }
  });

  it('puts every high piece over safe street (never over a pit), and a ladder on every house of the high way', () => {
    for (const c of [...CHUNKS, ...WARM, REVEAL]) {
      const pits = c.items.filter((it): it is Extract<Item, { t: 'pit' }> => it.t === 'pit');
      for (const it of c.items) {
        if (it.t !== 'plat' || !['bridge', 'frond', 'roofawn'].includes(it.k)) continue;
        for (const p of pits) expect(it.b <= p.a || it.a >= p.b, `${c.id}`).toBe(true);
      }
      for (const it of c.items) if (it.t === 'box' && it.k === 'house' && c.items.some(x => x.t === 'plat' && x.k === 'bridge')) expect(it.ladder, c.id).toBe(true);
    }
    for (const c of SHADE) expect(c.items.some(it => it.t === 'pit')).toBe(false);
  });

  it('builds each course the same for everyone: 11 to 15 chunks, a high way every third, at least five special places', () => {
    expect(course(3)).toEqual(course(3));
    expect(course(3).chunks).not.toEqual(course(4).chunks);
    for (let i = 0; i < RULES.courses; i++) {
      const c = course(i);
      expect(c.chunks.length).toBeGreaterThanOrEqual(11);
      expect(c.chunks.length).toBeLessThanOrEqual(15);
      const sp = c.chunks.reduce((s, id) => s + chunkById(id)!.items.filter(it => it.t === 'sp').length, 0);
      expect(sp, `course ${i}`).toBeGreaterThanOrEqual(RULES.specials);
      const w = c.chunks.reduce((s, id) => s + chunkById(id)!.w, 0) + FINISH.w;
      expect(w / RULES.run).toBeGreaterThan(38);
      expect(w / RULES.run).toBeLessThan(75);
      expect(c.chunks.filter((_, k) => k % 3 === 1).every(id => ['dachy', 'palmy', 'dachy2'].includes(id))).toBe(true);
    }
    expect(dailyCourse(77)).toEqual(dailyCourse(77));
    expect(courseChunks(5, 12, 0).every(id => chunkById(id)!.diff <= 1 || ['dachy', 'palmy', 'dachy2'].includes(id) === false)).toBe(true);
  });

  it('spreads the five specials over a course', () => {
    expect(specialSlots(5)).toEqual([0, 1, 2, 3, 4]);
    expect(specialSlots(9)).toEqual([0, 2, 4, 6, 8]);
    expect(specialSlots(3)).toEqual([0, 1, 2]);
  });
});

// ── the session ──────────────────────────────────────────────────
describe('the block plan', () => {
  it('fits any session: blocks sum to the time before the walk home, none under 12 s', () => {
    for (const planned of [40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(3));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        if (planned > 60) expect(sum).toBeCloseTo(planned - RULES.finale, 6);
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        expect(plan[plan.length - 1].kind).toBe('rest');
      }
    }
    expect(planBlocks(300, true, mulberry32(1))[0].dur).toBe(30);
    expect(planBlocks(40, true, mulberry32(1))[0].dur).toBe(6);
  });

  it('makes every 4th push blind from the 3rd session on, never the session\'s first', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 }, planned: 600 });
    const evs = drive(sim, 590, frame());
    const pushes = ofType(evs, 'blockStart').filter(e => e.block.kind === 'push');
    expect(pushes[0].block.blind).toBe(false);
    expect(pushes.map(e => e.block.blind)).toContain(true);
    const blindIdx = pushes.findIndex(e => e.block.blind);
    expect((2 + blindIdx + 1) % RULES.blindEvery).toBe(0);
    expect(ofType(evs, 'blindReveal')).toHaveLength(pushes.filter(e => e.block.blind).length);
    const early = later({ progress: { sessions: 1, pushes: 2 }, planned: 600 });
    expect(ofType(drive(early, 590, frame()), 'blockStart').some(e => e.block.blind)).toBe(false);
  });
});

describe('Wypatrywanie: the high way', () => {
  /** A returning player in a 300 s session, the band at a given level; plays to the middle of the first push. */
  function pushAt(level: number, o: Partial<FocusFrame> = {}) {
    const sim = later();
    const f = frame({ level, focused: level >= 0.5, hold: 0, ...o });
    let hold = 0;
    const evs = drive(sim, 20, () => ({ ...f, hold: f.focused ? (hold += STEP) : 0 }), { t: 0 }, tapper(sim));
    return { sim, evs };
  }

  it('locks each piece once, 1.5 s ahead of him: solid at or above the threshold after the lead-in', () => {
    const { sim, evs } = pushAt(0.8);
    const locks = ofType(evs, 'lock');
    expect(locks.length).toBeGreaterThan(0);
    const late = locks.filter(e => e.plat.lockedAt >= RULES.leadIn.fnirs + 0.5);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every(e => e.plat.state === 'solid')).toBe(true);
    // never changes after the lock
    for (const e of locks) expect(e.plat.lockedAt).toBeGreaterThanOrEqual(0);
    const ids = locks.map(e => e.plat.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sim.hero.highSec).toBeGreaterThanOrEqual(0);
  });

  it('leaves the pieces as outlines below the threshold, and as mist while the band has no signal', () => {
    expect(ofType(pushAt(0.2).evs, 'lock').every(e => e.plat.state === 'outline')).toBe(true);
    expect(ofType(pushAt(0.9, { reliable: false }).evs, 'lock').every(e => e.plat.state === 'mist')).toBe(true);
  });

  it('decides a piece before he can reach it: no piece he stands on is ever still undecided', () => {
    const sim = later();
    let bad = 0;
    drive(sim, 60, t => frame({ level: 0.5 + 0.4 * Math.sin(t), focused: true }), { t: 0 }, () => {
      const on = sim.hero.on;
      if (on && 'high' in on && on.high && on.state === 'live') bad++;
      for (const p of sim.world.plats) if (p.high && p.state === 'live' && p.x0 < sim.hero.x + 2) bad++;
    });
    expect(bad).toBe(0);
  });

  it('opens a Widok after 6 s of held focus (4 s on HALO): a burst of denarii ahead', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      let hold = 0;
      const evs = drive(sim, 22, t => frame({ level: 0.8, focused: true, hold: t > 1 ? (hold += STEP) : 0 }));
      const views = ofType(evs, 'view');
      expect(views.length).toBeGreaterThanOrEqual(1);
      expect(views.length).toBeLessThanOrEqual(RULES.viewMax);
      expect(views[0].n).toBe(RULES.viewCoins);
      expect(sim.world.coins.filter(c => c.born >= 0).length).toBeGreaterThanOrEqual(RULES.viewCoins);
      expect(sim.dust).toBeGreaterThan(0.3);
    }
    const low = later();
    expect(ofType(drive(low, 22, frame({ level: 0.3 })), 'view')).toHaveLength(0);
  });
});

describe('Cień sykomory and the blind block', () => {
  it('ripens the figs with calm and picks them as he passes the trees; a passed rest is a basket', () => {
    expect(figsFor(0)).toBe(0);
    expect(figsFor(0.5)).toBe(3);
    expect(figsFor(1)).toBe(5);
    const sim = later({ planned: 40 });
    const evs = drive(sim, 40, t => (t < 20 ? frame({ level: 0.2 }) : frame({ level: 0.1, calm: 0.95, activity: -3, threshold: 2 })));
    const figs = ofType(evs, 'figs');
    expect(figs.length).toBeGreaterThan(0);
    expect(sim.figs).toBeGreaterThan(0);
    expect(ofType(evs, 'basket').length).toBe(1);
  });

  it('holds R at a floor of 0.4 when a rest block had a bad signal', () => {
    const sim = later({ planned: 40 });
    drive(sim, 26, t => (t < 20 ? frame() : frame({ reliable: false, activity: null })));
    expect(sim.resting).toBe(true);
    expect(sim.ripe).toBeGreaterThanOrEqual(RULES.rFloor);
  });

  it('veils the palms in the crowd and turns its last 15 s of focus into solid rooftops at its end', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    const tap = tapper(sim);
    drive(sim, 0, frame(), clock);
    while (sim.blockIndex < 2) drive(sim, STEP, frame(), clock, tap);
    expect(sim.plan[0].blind).toBe(false);
    expect(sim.block.blind).toBe(true);
    const t0 = clock.t;
    let veiled = false;
    const evs: SimEvent[] = [];
    while (sim.blockIndex === 2) {
      evs.push(...drive(sim, STEP, frame({ level: 0.9, focused: true, hold: 10 }), clock, () => { if (sim.blind && sim.trace.latest?.veiled) veiled = true; }));
      tap();
    }
    expect(veiled).toBe(true);
    const r = ofType(evs, 'blindReveal')[0];
    expect(r.sec).toBe(15);
    expect(r.solid).toBe(RULES.revealMax);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
    // no piece unfolded during the crowd
    expect(ofType(evs, 'lock').filter(e => e.plat.lockedAt > t0 && e.plat.lockedAt < clock.t - 0.1).every(e => e.plat.state !== 'solid')).toBe(true);
    drive(sim, 1, frame(), clock);
    const reveal = sim.world.zones.find(z => z.chunk === 'tlum');
    expect(reveal).toBeTruthy();
    expect(sim.world.plats.filter(p => p.high && p.x0 >= reveal!.x0 && p.x1 <= reveal!.x1 && p.state === 'solid')).toHaveLength(RULES.revealMax);
  });
});

describe('grace: the rope', () => {
  it('rewinds a fall into a pit about 3 s and lays a plank after the second fall into it', () => {
    const sim = later();
    const clock = { t: 0 };
    // no taps at all: he walks into the first pit
    const evs = drive(sim, 40, frame(), clock);
    const ropes = ofType(evs, 'rope');
    expect(ropes.length).toBeGreaterThan(0);
    const r = ropes[0];
    expect(r.fromX - r.toX).toBeGreaterThan(RULES.run * 1.5);
    expect(r.fromX - r.toX).toBeLessThan(RULES.run * 4);
    expect(ofType(evs, 'plank').length).toBeGreaterThan(0);
    // never stuck: he keeps going
    expect(sim.hero.x).toBeGreaterThan(100);
    expect(sim.score).toBeGreaterThan(10);
  });
});

describe('the sycamore and the courses', () => {
  it('finishes a course at the trunk, pays its branch, records it and starts the next', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, 150, frame(), { t: 0 }, tapper(sim));
    const fin = ofType(evs, 'finish');
    expect(fin.length).toBeGreaterThanOrEqual(1);
    expect(fin[0].course.index).toBe(0);
    expect(fin[0].pay).toBe(RULES.branchPay[fin[0].branch - 1]);
    expect(sim.p.courses[0].done).toBe(true);
    expect(ofType(evs, 'courseStart').map(e => e.course.index).slice(0, 2)).toEqual([0, 1]);
  });

  it('starts the day\'s first session with the day\'s course', () => {
    const sim = makeSim({ progress: { sessions: 3 }, planned: 300 });
    expect(sim.daily).toBe(true);
    const evs = drive(sim, 5, frame());
    expect(ofType(evs, 'courseStart')[0].course.index).toBe(-1);
  });
});

// ── the meta ─────────────────────────────────────────────────────
describe('the households, the courses, the missions', () => {
  it('restores the twelve households from the all-time sum, never by spending', () => {
    expect(homesRestored(0)).toBe(0);
    expect(homesRestored(RULES.homes[0])).toBe(1);
    expect(homesRestored(99999)).toBe(12);
    expect(toNextHome(50)).toEqual({ home: HOMES[1], have: 50 - RULES.homes[0], need: RULES.homes[1] - RULES.homes[0] });
    expect(toNextHome(99999)).toBeNull();
    const sim = later({ progress: { denarii: RULES.homes[0] - 3 } });
    const evs = drive(sim, 10, frame());
    expect(ofType(evs, 'home')[0].home.index).toBe(0);
    expect(sim.p.denarii).toBeGreaterThanOrEqual(RULES.homes[0]);
  });

  it('opens the courses in turn, then replays them for their special sets: silver, gold, purple', () => {
    const p = freshProgress();
    expect(pickCourse(p)).toBe(0);
    expect(unlocked(p)).toBe(1);
    expect(finishCourse(p, 0, 3, 2)).toEqual({ first: true, completed: null });
    expect(p.courses[0].got).toBe(3);
    expect(pickCourse(p)).toBe(1);
    expect(pickCourse(p, [1])).toBe(2);
    expect(finishCourse(p, 0, 5, 4)).toEqual({ first: false, completed: 'silver' });
    expect(tierOf(p.courses[0])).toBe('gold');
    for (let i = 0; i < 12; i++) finishCourse(p, i, 0, 1);
    expect(unlocked(p)).toBe(12);
    p.lastCourse = 0;
    expect(pickCourse(p)).toBe(1);   // the fewest sets first, in turn after the last one
    finishCourse(p, 0, 5, 1);
    finishCourse(p, 0, 5, 1);
    expect(tierOf(p.courses[0])).toBe('purple');
    expect(p.courses[0].tier).toBe(3);
    expect(finishCourse(p, 0, 5, 1).completed).toBeNull();
  });

  it('turns a done mission\'s page after the session', () => {
    const p = freshProgress();
    const opened = turnPages(p, [p.missions[0]]);
    expect(opened).toEqual([MISSIONS[3].id]);
    expect(p.missions).toHaveLength(3);
  });

  it('gives the day\'s gift once a day, for the households, the same for everyone', () => {
    const sim = makeSim({ progress: { sessions: 2, dailyDay: DAY }, planned: 40 });
    const evs = drive(sim, 46, frame());
    expect(ofType(evs, 'gift')).toEqual([{ type: 'gift', pay: RULES.giftPay }]);
    expect(sim.p.giftDay).toBe(DAY);
  });
});

describe('the summary', () => {
  it('closes with a passage the session fits, never the root', () => {
    const verse = (o: Partial<ZacheuszSim>) => {
      const sim = later({ progress: { sessions: 0 } });
      Object.assign(sim, o);
      return sim.closingVerse();
    };
    expect(verse({ bestBranch: 5 })).toBe('luk19.5');
    expect(verse({ views: 1 })).toBe('heb12.2');
    expect(verse({ ropes: 2 })).toBe('luk19.10');
    expect(verse({})).toBe('luk19.6');
    for (const id of ['luk19.5', 'luk19.8', 'heb12.2', 'psa34.5', 'luk19.10', 'luk19.6'] as const) expect(passage(id).text.length).toBeGreaterThan(20);
  });

  it('result() is idempotent: records with Math.max, counters once, when the session is settled', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    const tap = tapper(sim);
    drive(sim, 20, frame(), clock, tap);
    const mid = sim.result();
    expect(sim.p.sessions).toBe(5);
    drive(sim, 25, frame(), clock, tap);
    sim.finish();
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    expect(a.score).toBeGreaterThanOrEqual(mid.score);
    expect(sim.p.sessions).toBe(6);
    const den = sim.p.denarii;
    sim.finish();
    sim.result();
    expect(sim.p.denarii).toBe(den);
    expect(bestOf(sim.p)).toBe(a.score);
    expect(a.stats.length).toBeLessThanOrEqual(8);
    expect(a.unit).toBe(unit(a.score));
  });

  it('walks home at the end and may stop once he is at his door', () => {
    const sim = later({ planned: 40 });
    const evs = drive(sim, 40 + RULES.settle + 0.2, frame(), { t: 0 }, tapper(sim));
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.canStop()).toBe(true);
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline\'s unit: 1 denar, 2 denary, 5 denarów', () => {
    expect(unit(1)).toBe('denar');
    expect(unit(3)).toBe('denary');
    expect(unit(5)).toBe('denarów');
    expect(unit(22)).toBe('denary');
    expect(t('denarii', { n: 12 })).toBe('12 denarów');
  });

  it('names every course, home and mission; no "concentrate harder", no holiness words, Jesus never a figure', () => {
    for (let i = 0; i < 12; i++) expect(course(i).name.length).toBeGreaterThan(3);
    for (const h of HOMES) expect(h.fix.length).toBeGreaterThan(2);
    expect(TIPS.push.length).toBe(5);
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /energ/, /błogosław/, /bless/, /segen/, /välsign/, /jezus/, /jesus/, /\bgod\b/, /\bbóg\b/, /hack/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap at the centre every ~0.65 s, Space after every third one, the simulator's focus on. */
  function smoke(progress: Partial<ZacheuszProgress>, seed: number, eeg: boolean, every = 0.65) {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at22 = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
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
      at22 = sim.result().score;
    }
    return { at22, x: sim.hero.x };
  }

  it('gathers denarii live and keeps running at 22 s, on either band, any tap rhythm, new or returning', () => {
    for (const eeg of [false, true]) {
      for (const every of [0.65, 0.7]) {
        for (let seed = 1; seed <= 6; seed++) {
          const r = smoke({}, seed, eeg, every);
          expect(r.at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(15);
          expect(r.x).toBeGreaterThan(60);
        }
      }
    }
    expect(smoke({ sessions: 6, dailyDay: DAY }, 3, false).at22).toBeGreaterThan(15);
    expect(smoke({ sessions: 6 }, 4, true).at22).toBeGreaterThan(15);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, and nothing before a first run', async () => {
    const mod = (await import('../src/arcade/zacheusz/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 90, 300: 150 };
    p.lastLen = 180;
    expect(mod.best(p)).toBe(90);
    expect(mod.unit?.(1)).toBe('denar');
  });

  it('builds the progress card from elements: the town of twelve homes, the courses, the missions', async () => {
    const { progressPanel } = await import('../src/arcade/zacheusz/panel');
    const p = { ...freshProgress(), sessions: 3, denarii: 130 };
    p.courses[0].done = true;
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-album.zz-town > div')).toHaveLength(12);
    expect(el.querySelectorAll('.arcade-album.zz-town > div.on')).toHaveLength(2);
    expect(el.querySelectorAll('.arcade-album.zz-courses > div')).toHaveLength(12);
    for (const id of p.missions) expect(el.textContent).toContain(MISSIONS.find(m => m.id === id)!.name);
  });
});
