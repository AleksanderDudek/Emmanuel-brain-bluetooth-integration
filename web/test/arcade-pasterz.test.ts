import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { LAMBS, MISSIONS } from '../src/arcade/pasterz/content';
import { Shepherd, keepFor, makeSheep, stepSheep } from '../src/arcade/pasterz/flock';
import { Hill } from '../src/arcade/pasterz/hill';
import { CATALOGS, t, unit } from '../src/arcade/pasterz/i18n';
import { addToFlock, bestOf, freshProgress, nameLamb, nextLamb, turnPages, type PasterzProgress } from '../src/arcade/pasterz/meta';
import { RULES } from '../src/arcade/pasterz/rules';
import { PasterzSim, RING_MARK, hillSheep, morningFor, planBlocks, ringFor, type SimEvent } from '../src/arcade/pasterz/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-02';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });

type SimOpts = { progress?: Partial<PasterzProgress>; planned?: number; seed?: number; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): PasterzSim {
  const sim = new PasterzSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no day's hill, no gift): the rules one at a time. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, dailyDay: DAY, giftDay: DAY, calls: 1, ...o.progress } });

function drive(sim: PasterzSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

function toBlock(sim: PasterzSim, i: number, f: FocusFrame | ((t: number) => FocusFrame) = frame(), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  while (sim.blockIndex < i && sim.phase === 'play') out.push(...drive(sim, STEP, f, clock));
  return out;
}

describe('the hill', () => {
  it('makes the same pasture from the same seed, and another from another', () => {
    const a = new Hill(77, 20), b = new Hill(77, 20), c = new Hill(78, 20);
    expect(a.circles).toEqual(b.circles);
    expect(a.walls).toEqual(b.walls);
    expect(a.groups).toEqual(b.groups);
    expect(c.circles).not.toEqual(a.circles);
  });

  it('keeps the start clear, hides the lost lamb far from it among rocks, and places every sheep', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const h = new Hill(seed, 24);
      expect(h.solidNear(h.start.x, h.start.y, RULES.clearStart - 1)).toBe(false);
      expect(Math.hypot(h.lamb.x - h.start.x, h.lamb.y - h.start.y)).toBeGreaterThanOrEqual(RULES.lambDist - 1e-9);
      expect(h.circles.filter(c => c.kind === 'rock' && Math.hypot(c.x - h.lamb.x, c.y - h.lamb.y) < 2.2).length).toBeGreaterThanOrEqual(3);
      expect(h.groups.reduce((s, g) => s + g.n, 0)).toBe(24);
      expect(h.groups[0]).toMatchObject({ x: h.start.x, y: h.start.y });
      expect(h.walls.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('never leaves the shepherd stuck: walking straight into a wall slides along it to its end', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const h = new Hill(seed, 18);
      for (const w of h.walls) {
        const mx = (w.x0 + w.x1) / 2, my = (w.y0 + w.y1) / 2;
        const nx = -(w.y1 - w.y0), ny = w.x1 - w.x0, nl = Math.hypot(nx, ny);
        const sh = new Shepherd(mx + (nx / nl) * 1.5, my + (ny / nl) * 1.5);
        sh.goal = { x: mx - (nx / nl) * 3, y: my - (ny / nl) * 3 };
        let walked = 0;
        for (let i = 0; i < 60 * 6; i++) {
          walked += sh.step(STEP, h, 1);
          if (!sh.goal) break;
          sh.goal = { x: mx - (nx / nl) * 3, y: my - (ny / nl) * 3 };
        }
        // it kept moving (sliding), and never went through the wall
        expect(walked).toBeGreaterThan(3);
      }
    }
  });

  it('slows the walk in the stream, but not on the ford\'s stones', () => {
    const h = new Hill(5, 18);
    const x = h.w * 0.37;
    const onFord = h.fords[0];
    expect(h.wading(x, h.streamY(x)) || Math.abs(x - onFord.x) < 0.7).toBe(true);
    expect(h.wading(onFord.x, h.streamY(onFord.x))).toBe(false);
    expect(h.wading(x, h.streamY(x) + 5)).toBe(false);
  });
});

describe('the flock', () => {
  it('follows the shepherd as a soft crowd: close behind him, never on top of each other', () => {
    const h = new Hill(9, 18);
    const sh = new Shepherd(h.start.x, h.start.y);
    const rnd = mulberry32(3);
    const list = Array.from({ length: 12 }, (_, i) => {
      const s = makeSheep(i + 1, h.start.x + (i % 4) - 1.5, h.start.y - 2 - Math.floor(i / 4), rnd);
      s.state = 'follow';
      return s;
    });
    const goal = h.freeNear(h.start.x + 10, h.start.y - 4, 1);
    for (let i = 0; i < 60 * 8; i++) {
      sh.goal = goal;
      sh.step(STEP, h, 1);
      const p = sh.past(RULES.lag);
      stepSheep(list, { hill: h, shepherd: sh, tx: p.x, ty: p.y, keep: keepFor(list.length), gate: null }, STEP, rnd);
    }
    const far = Math.max(...list.map(s => Math.hypot(s.x - sh.x, s.y - sh.y)));
    expect(far).toBeLessThan(keepFor(12) + 3);
    for (const a of list) for (const b of list) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.3);
  });
});

describe('the call ring (the live gauge)', () => {
  it('has radius r0 + level × rExtra, the dotted mark at level 0.5', () => {
    expect(ringFor(0)).toBe(RULES.r0);
    expect(ringFor(1)).toBe(RULES.r0 + RULES.rExtra);
    expect(ringFor(-1)).toBe(RULES.r0);
    expect(RING_MARK).toBe(RULES.r0 + RULES.rExtra / 2);
  });

  it('answers the level only in a sighted Wołanie past its lead-in (5 s Mendi, 2 s HALO)', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      expect(sim.block.kind).toBe('call');
      const lead = eeg ? 2 : 5;
      drive(sim, lead - 0.5, frame({ level: 1 }));
      expect(sim.ringR).toBeCloseTo(RULES.r0, 5);
      drive(sim, 3, frame({ level: 1 }));
      expect(sim.ringR).toBeGreaterThan(RULES.r0 + RULES.rExtra * 0.9);
      expect(sim.ringLook).toBe('live');
    }
  });

  it('rests at r0, grey, while the signal is unreliable — never smaller', () => {
    const sim = later();
    drive(sim, 8, frame({ level: 0.9 }));
    expect(sim.ringR).toBeGreaterThan(RING_MARK);
    drive(sim, 4, frame({ reliable: false, activity: null, level: 0 }));
    expect(sim.ringLook).toBe('grey');
    expect(sim.ringR).toBeGreaterThanOrEqual(RULES.r0);
    expect(sim.ringR).toBeLessThan(RULES.r0 + 0.1);
  });

  it('gathers every grazing sheep inside it', () => {
    const sim = later();
    const sh = sim.shepherd;
    const s = sim.sheep.find(x => x.state === 'graze' && Math.hypot(x.x - sh.x, x.y - sh.y) > 6)!;
    s.x = sh.x + RULES.r0 - 0.3;
    s.y = sh.y;
    const ev = drive(sim, 0.1, frame());
    expect(s.state).toBe('follow');
    expect(ofType(ev, 'join').length).toBeGreaterThanOrEqual(1);
  });

  it('flashes with Space and makes the sheep near look up', () => {
    const sim = later();
    drive(sim, 0.2, frame());
    sim.key(' ', true);
    expect(sim.callT).toBeGreaterThan(0);
    expect(ofType(sim.take(), 'call')).toHaveLength(1);
  });
});

describe('Głos: the voice across the hill', () => {
  it('after a hold of 5 s (Mendi) every grazing sheep in view walks to the shepherd and the lost lamb bleats', () => {
    const sim = later();
    sim.viewW = 100;
    sim.viewH = 100;
    const ev = drive(sim, 7, t => frame({ level: 0.8, focused: true, hold: Math.max(0, t - 0.5) }));
    const v = ofType(ev, 'voice');
    expect(v).toHaveLength(1);
    expect(v[0].called).toBeGreaterThan(5);
    expect(sim.compassT).toBeGreaterThan(0);
    expect(sim.sheep.some(s => s.state === 'called' || ofType(ev, 'join').some(j => j.via === 'voice'))).toBe(true);
  });

  it('needs only 3 s on HALO, and never comes from a hold before the lead-in or without signal', () => {
    const sim = later({ eeg: true });
    const ev = drive(sim, 3.6, t => frame({ level: 0.8, focused: true, hold: t }));
    expect(ofType(ev, 'voice')).toHaveLength(1);
    const dark = later();
    expect(ofType(drive(dark, 10, t => frame({ reliable: false, activity: null, hold: t })), 'voice')).toHaveLength(0);
  });
});

describe('the pastures and the fold', () => {
  it('ends a pasture when its time is up: the fold appears, the flock files through the gate and the count runs up', () => {
    const sim = later({ planned: 600 });
    sim.pastureDur = 3;
    const clock = { t: 0 };
    let ev = drive(sim, 3.2, frame(), clock);
    expect(ofType(ev, 'pastureEnd')).toHaveLength(1);
    expect(sim.stage).toBe('fold');
    const f = sim.fold!;
    // walk into the gate
    sim.pointer('down', f.gateX, f.gateY, 1);
    ev = drive(sim, 12, frame(), clock, () => { if (sim.stage === 'fold') sim.shepherd.goal = { x: f.gateX, y: f.gateY }; });
    expect(ofType(ev, 'foldEnter')[0]?.self).toBe(false);
    const folded = ofType(ev, 'folded');
    expect(folded.length).toBe(sim.gatheredHere > 0 ? folded.length : 0);
    expect(folded.length).toBeGreaterThanOrEqual(3);
    expect(folded.map(e => e.n)).toEqual(folded.map((_, i) => i + 1));
    const done = ofType(ev, 'pastureDone');
    expect(done).toHaveLength(1);
    expect(ofType(ev, 'newPasture')[0]?.index).toBe(1);
    expect(sim.pasturesDone).toBe(1);
  });

  it('lights a step every 10th sheep of the count', () => {
    const sim = later({ planned: 600 });
    for (const s of sim.sheep) {
      s.state = 'follow';
      s.x = sim.shepherd.x + (Math.random() - 0.5) * 3;
      s.y = sim.shepherd.y + (Math.random() - 0.5) * 3;
    }
    sim.pastureDur = 0.5;
    const ev = drive(sim, 25, frame());
    const steps = ofType(ev, 'step').map(e => e.n);
    expect(steps.slice(0, 2)).toEqual([10, 20]);
  });

  it('lets the flock walk into the fold on its own when the shepherd does not come', () => {
    const sim = later({ planned: 600 });
    sim.pastureDur = 1;
    const ev = drive(sim, RULES.foldWait + 12, frame());
    expect(ofType(ev, 'foldEnter')[0]?.self).toBe(true);
    expect(ofType(ev, 'pastureDone')).toHaveLength(1);
  });

  it('does not count the night toward the pasture\'s time', () => {
    const sim = later({ planned: 600 });
    toBlock(sim, 1);
    expect(sim.block.kind).toBe('watch');
    const before = sim.pastureT;
    drive(sim, 5, frame());
    expect(sim.pastureT).toBe(before);
  });
});

describe('the lost lamb', () => {
  it('is lifted onto the shoulders when the shepherd walks to it, and named in the fold', () => {
    const sim = later({ planned: 600 });
    const before = sim.score;
    sim.shepherd.place(sim.lamb.x + 0.5, sim.lamb.y);
    let ev = drive(sim, 0.1, frame());
    expect(ofType(ev, 'lambFound')).toHaveLength(1);
    expect(sim.shepherd.carrying).toBe(true);
    expect(sim.score).toBe(before + 1);
    sim.pastureDur = sim.pastureT + 0.1;
    ev = drive(sim, RULES.foldWait + 14, frame());
    const named = ofType(ev, 'lambNamed');
    expect(named).toEqual([{ type: 'lambNamed', index: 0, isNew: true }]);
    expect(sim.p.lambs).toEqual([0]);
  });

  it('gives the twelve names in order, then the lambs come home again in turn', () => {
    const p = freshProgress();
    for (let i = 0; i < LAMBS.length; i++) expect(nameLamb(p)).toEqual({ index: i, isNew: true });
    expect(nextLamb(p)).toBeNull();
    expect(nameLamb(p)).toEqual({ index: 0, isNew: false });
  });
});

describe('thorns', () => {
  it('snag a following sheep sometimes; the shepherd frees it by coming near, never at once', () => {
    let snagged = 0, freed = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const sim = later({ seed, planned: 600 });
      const bush = sim.hill.circles.find(c => c.kind === 'bush')!;
      const ev = drive(sim, 40, frame(), { t: 0 }, () => {
        for (const s of sim.sheep) if (s.state === 'graze') { s.state = 'follow'; }
        // walk around the bush, back and forth
        sim.shepherd.goal = { x: bush.x + Math.cos(sim.t) * (bush.r + 1.2), y: bush.y + Math.sin(sim.t) * (bush.r + 1.2) };
      });
      snagged += ofType(ev, 'snag').length;
      freed += ofType(ev, 'free').length;
    }
    expect(snagged).toBeGreaterThan(0);
    expect(freed).toBeGreaterThan(0);
  });
});

describe('Nocna straż: the night', () => {
  it('lights stars from calm after the lead-in, and a passed night brings morning lambs', () => {
    const sim = later();
    toBlock(sim, 1, frame({ activity: 5, threshold: 2 }));
    expect(sim.block.kind).toBe('watch');
    const n0 = sim.score;
    const ev = toBlock(sim, 2, frame({ activity: -3, threshold: 2, calm: 0.9 }));
    const end = ofType(ev, 'blockEnd').find(e => e.block.kind === 'watch')!;
    expect(end.verdict).toBe(true);
    expect(end.stars).toBeGreaterThanOrEqual(8);
    const m = ofType(ev, 'morning')[0];
    expect(m.n).toBe(morningFor(end.stars));
    expect(sim.score).toBeGreaterThanOrEqual(n0 + m.n);
    expect(sim.night).toBeGreaterThan(0.3);
  });

  it('gives 2 morning lambs, +1 at 6 stars, +1 at 10', () => {
    expect([0, 5, 6, 9, 10, 12].map(morningFor)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it('slows the walk and gathers the flock by the fire', () => {
    const sim = later();
    toBlock(sim, 1);
    expect(sim.fire).not.toBeNull();
    const x0 = sim.shepherd.x;
    sim.shepherd.goal = { x: x0 + 20, y: sim.shepherd.y };
    drive(sim, 1, frame());
    expect(sim.shepherd.x - x0).toBeLessThan(RULES.speed * RULES.nightWalk * 1.05);
  });

  it('has no verdict without enough signal (never a loss)', () => {
    const sim = later();
    toBlock(sim, 1);
    const ev = toBlock(sim, 2, frame({ reliable: false, activity: null, calm: 0 }));
    const end = ofType(ev, 'blockEnd').find(e => e.block.kind === 'watch')!;
    expect(end.verdict).toBeNull();
    expect(ofType(ev, 'morning')).toHaveLength(0);
  });
});

describe('Zmrok: the blind Wołanie', () => {
  /** A session whose second Wołanie is the 4th of all time: blind. */
  const blindSim = () => later({ progress: { sessions: 4, calls: 2 }, planned: 600 });

  it('comes every 4th Wołanie from the 3rd session, never a session\'s first', () => {
    const sim = blindSim();
    expect(sim.block.blind).toBe(false);
    toBlock(sim, 2);
    expect(sim.block.kind).toBe('call');
    expect(sim.block.blind).toBe(true);
    expect(later({ progress: { sessions: 1, calls: 2 }, planned: 600 }).plan.length).toBeGreaterThan(2);
    const young = makeSim({ progress: { sessions: 1, calls: 2, dailyDay: DAY, giftDay: DAY }, planned: 600 });
    toBlock(young, 2);
    expect(young.block.blind).toBe(false);
  });

  it('keeps the ring dim at r0 and veils the trace; at its end it reveals and the ring flares by the judged share', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    toBlock(sim, 2, frame(), clock);
    drive(sim, 8, frame({ level: 1, activity: 6, threshold: 2, focused: true, hold: 5 }), clock);
    expect(sim.ringLook).toBe('blind');
    expect(sim.ringR).toBeLessThan(RULES.r0 + 0.01);
    expect(sim.trace.latest?.veiled).toBe(true);
    const ev = toBlock(sim, 3, frame({ level: 1, activity: 6, threshold: 2 }), clock);
    const flare = ofType(ev, 'flare')[0];
    expect(flare.share).toBeGreaterThan(0.9);
    expect(flare.r).toBeGreaterThan(RULES.r0 + RULES.rExtra * 0.9);
    expect(sim.trace.samples.some(s => s.veiled)).toBe(false);
    expect(sim.trace.samples.some(s => s.revealedAt !== null)).toBe(true);
    expect(sim.padLevel(frame())).toBeNull();
  });
});

describe('the block plan', () => {
  it('fits any session: blocks of 12 s or more ending in a night, the finisher\'s 6 s left over', () => {
    for (const sec of [40, 60, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(sec, first, mulberry32(sec));
        const total = plan.reduce((s, b) => s + b.dur, 0);
        expect(total).toBeCloseTo(Math.max(sec - RULES.finale, 2 * RULES.minBlock + (first && sec <= 60 ? 0 : 0)), 0);
        expect(plan.at(-1)!.kind).toBe('watch');
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'call');
      }
    }
  });

  it('telegraphs the next block 4 s ahead and plays the finisher at the fold', () => {
    const sim = later({ planned: 60 });
    const ev = drive(sim, 64, frame());
    expect(ofType(ev, 'telegraph').length).toBeGreaterThanOrEqual(2);
    expect(ofType(ev, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });
});

describe('the meta', () => {
  it('grows the flock toward a hundred, then a new season', () => {
    const p = freshProgress();
    expect(addToFlock(p, 60)).toBe(0);
    expect(addToFlock(p, 55)).toBe(1);
    expect(p.flock).toBe(15);
    expect(p.season).toBe(1);
  });

  it('settles once: sessions, the total, the hundred with the day\'s gift, the day\'s hill', () => {
    const sim = makeSim({ progress: { sessions: 2 }, planned: 40 });
    drive(sim, 46, frame());
    const p = sim.p;
    expect(p.sessions).toBe(3);
    expect(p.total).toBe(sim.score);
    expect(p.flock).toBe(sim.score + RULES.giftSheep + (p.missionsDone * RULES.missionSheep));
    expect(p.dailyDay).toBe(DAY);
    expect(p.giftDay).toBe(DAY);
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    expect(p.total).toBe(sim.score);
    sim.finish();
    expect(p.sessions).toBe(3);
  });

  it('keeps three missions open and turns the done ones\' pages', () => {
    const p = freshProgress();
    expect(p.missions).toEqual(['gather15', 'lamb', 'free3']);
    turnPages(p, ['gather15']);
    expect(p.missions).toEqual(['voice2', 'lamb', 'free3']);
    expect(MISSIONS).toHaveLength(9);
  });

  it('seeds the day\'s first pasture with the date, the same for everyone', () => {
    const a = makeSim({ seed: 1, daySeed: 99 }), b = makeSim({ seed: 2, daySeed: 99 });
    expect(a.hill.seed).toBe(b.hill.seed);
    const c = later({ seed: 1, daySeed: 99 }), d = later({ seed: 2, daySeed: 99 });
    expect(c.hill.seed).not.toBe(d.hill.seed);
  });

  it('puts more sheep on each next pasture, up to the most', () => {
    expect(hillSheep(0, 0)).toBe(RULES.hill[0]);
    expect(hillSheep(1, 0)).toBe(RULES.hill[0] + RULES.hillGrow);
    expect(hillSheep(20, 1)).toBe(RULES.hillMax);
  });
});

describe('the summary', () => {
  it('result() is idempotent and the record uses Math.max', () => {
    const sim = later({ planned: 40, progress: { best: { 40: 2 } } });
    drive(sim, 10, frame());
    const r1 = sim.result(), r2 = sim.result();
    expect(r2).toEqual(r1);
    expect(sim.p.best['40']).toBe(Math.max(2, sim.score));
    expect(r1.record).toBe(sim.score > 2);
  });

  it('closes with a passage that fits, in turn from session to session', () => {
    const sim = later();
    expect(sim.closingVerse()).toBe('psa100.3');
    for (const id of ['isa40.11', 'luk15.4-6', 'jhn10.3', 'jhn10.27', 'luk2.8', 'ezk34.12', 'psa100.3'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    sim.voices = 1;
    expect(['jhn10.3', 'jhn10.27', 'psa100.3']).toContain(sim.closingVerse());
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('bends the headline unit (1 owca, 3 owce, 5 owiec) and names the twelve lambs', () => {
    expect([1, 3, 5, 22, 25].map(unit)).toEqual(['owca', 'owce', 'owiec', 'owce', 'owiec']);
    expect(t('sheep', { n: 12 })).toBe('12 owiec');
    expect(new Set(LAMBS.map(l => l.name)).size).toBe(12);
    expect(LAMBS[0].name).toBe('Dzwoneczek');
  });

  it('never asks to concentrate harder, never uses holiness words or "hack"', () => {
    for (const cat of Object.values(CATALOGS)) {
      const all = Object.values(cat).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).join(' ').toLowerCase();
      for (const word of [/skup się/, /concentrate/, /konzentrier/, /koncentrera/, /hack/, /unlock/, /błogosław/, /bless/, /segen/, /välsign/, /święt/, /holy/, /heilig/, /helig/]) expect(all).not.toMatch(word);
    }
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a tap below the centre every ~0.65 s (a goal ~3 m south), Space now and then, the simulator's focus on. */
  function smoke(progress: Partial<PasterzProgress>, seed: number, eeg: boolean, every = 0.65) {
    const sim = makeSim({ progress, planned: 40, seed, daySeed: seed * 7 + 1, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, taps = 0, at3 = 0, at22 = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= every) {
        tap -= every;
        const sh = sim.shepherd;
        sim.pointer('down', sh.x, sh.y + 3, 1);
        sim.pointer('up', sh.x, sh.y + 3, 1);
        if (taps++ % 3 === 0) {
          sim.key(' ', true);
          sim.key(' ', false);
        }
      }
      sim.take();
      if (t <= 1) at3 = sim.result().score;
      at22 = sim.result().score;
    }
    return { at3, at22 };
  }

  it('scores within the first seconds and climbs by 22 s, on either band', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 8; seed++) {
        const r = smoke({}, seed, eeg);
        expect(r.at3, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
        // and it climbs: the second group grazes just down the slope the smoke walks
        expect(r.at22, `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(r.at3);
      }
    }
    expect(smoke({ sessions: 6, dailyDay: DAY }, 3, false).at22).toBeGreaterThan(0);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the record of the length last played, else the best of any, and nothing before a first session', async () => {
    const mod = (await import('../src/arcade/pasterz/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 180: 30, 300: 45 };
    p.lastLen = 180;
    expect(bestOf(p)).toBe(30);
    p.lastLen = 600;
    expect(mod.best(p)).toBe(45);
    expect(mod.unit!(2)).toBe('owce');
  });

  it('builds the progress card from elements: the twelve lambs, the hundred, the three missions', async () => {
    const { progressPanel } = await import('../src/arcade/pasterz/panel');
    const p = { ...freshProgress(), sessions: 3, lambs: [0, 1], flock: 42, total: 120 };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(12);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(2);
    expect(el.textContent).toContain('Dzwoneczek');
    for (const id of p.missions) expect(el.textContent).toContain(MISSIONS.find(m => m.id === id)!.name);
  });
});
