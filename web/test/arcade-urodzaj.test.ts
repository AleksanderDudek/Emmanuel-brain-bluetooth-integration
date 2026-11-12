import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets } from '../src/arcade/kit/types';
import { hintText, howto } from '../src/arcade/urodzaj/index';
import { FONT, SERIF, font } from '../src/arcade/urodzaj/paint';
import { DROP_TIERS, FESTIVALS, FRUITS, LINES, LINE_COUNT, MAX_TIER, MOMENTS, festivalAt, fruit, missionText, tierFromU } from '../src/arcade/urodzaj/content';
import { CATALOGS, t, unit } from '../src/arcade/urodzaj/i18n';
import { computeLayout, sx, sy, worldX } from '../src/arcade/urodzaj/layout';
import { festFeed, freshProgress, migrate, reached, starsFor, type UrodzajProgress } from '../src/arcade/urodzaj/meta';
import { PHYS, World } from '../src/arcade/urodzaj/physics';
import { BASKET, RULES } from '../src/arcade/urodzaj/rules';
import { UrodzajSim, chainMult, chargeRate, finaleFor, mergePoints, planBlocks, type SimEvent } from '../src/arcade/urodzaj/sim';
import { Talk } from '../src/arcade/urodzaj/talk';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.5, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, calm: 0.05 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

type SimOpts = { progress?: Partial<UrodzajProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; day?: string };

function makeSim(o: SimOpts = {}): UrodzajSim {
  const sim = new UrodzajSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player who played today already (no warm-up, no opening card, no daily seed). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, dailyDay: DAY, ...o.progress } });

function drive(sim: UrodzajSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: sim.t }, each?: (t: number) => void): SimEvent[] {
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

/** Skip to the start of block i (the clock jumps; nothing is judged). */
function toBlock(sim: UrodzajSim, i: number): { t: number } {
  let start = 0;
  for (let k = 0; k < i; k++) start += sim.plan[k].dur;
  const clock = { t: start };
  (sim as unknown as { startBlock(i: number): void }).startBlock(i);
  sim.t = start;
  sim.take();
  return clock;
}

describe('the fruit ladder (Suika\'s circle)', () => {
  it('has eleven fruits, growing, with Suika\'s triangular points 1, 3, 6 … 66', () => {
    expect(FRUITS).toHaveLength(11);
    expect(MAX_TIER).toBe(11);
    for (let i = 1; i < FRUITS.length; i++) expect(FRUITS[i].r).toBeGreaterThan(FRUITS[i - 1].r);
    expect(FRUITS.map(f => f.pts)).toEqual([1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]);
    expect(mergePoints(2)).toBe(3);
    expect(mergePoints(11)).toBe(66);
  });

  it('drops only the five smallest', () => {
    for (let u = 0; u < 1; u += 0.01) {
      const k = tierFromU(u);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(DROP_TIERS);
    }
    const sim = later();
    for (let n = 0; n < 200; n++) expect(sim.drawTier(n)).toBeLessThanOrEqual(5);
  });

  it('chains: ×1, ×1.25, ×1.5 … capped at ×3', () => {
    expect(chainMult(0)).toBe(1);
    expect(chainMult(1)).toBe(1.25);
    expect(chainMult(4)).toBe(2);
    expect(chainMult(20)).toBe(RULES.chainCap);
  });
});

describe('the physics', () => {
  it('two alike fruits that touch merge into the next one at their midpoint', () => {
    const w = new World();
    const r = fruit(3).r;
    w.add(3, -r, r);
    w.add(3, r + 0.0005, r);
    for (let i = 0; i < 20; i++) w.stepOnce();
    expect(w.merges).toHaveLength(1);
    expect(w.merges[0].tier).toBe(4);
    expect(Math.abs(w.merges[0].x)).toBeLessThan(0.01);
    expect(w.count).toBe(1);
  });

  it('different fruits stack and settle inside the walls without merging', () => {
    const w = new World();
    for (let i = 0; i < 18; i++) w.add(1 + (i % 5), ((i * 37) % 9) / 10 - 0.4, 0.3 + i * 0.12);
    for (let i = 0; i < 120 * 8; i++) w.stepOnce();
    for (const b of w.bodies) {
      expect(b.x - b.r).toBeGreaterThan(-BASKET.half - 0.01);
      expect(b.x + b.r).toBeLessThan(BASKET.half + 0.01);
      expect(b.y - b.r).toBeGreaterThan(-0.01);
    }
    expect(w.energy()).toBeLessThan(0.01);
  });

  it('two great clusters leave on the pole', () => {
    const w = new World();
    const r = fruit(11).r;
    w.add(11, -r, r);
    w.add(11, r + 0.0005, r);
    for (let i = 0; i < 10; i++) w.stepOnce();
    expect(w.poles).toHaveLength(1);
    expect(w.count).toBe(0);
  });

  it('the wind\'s shake sways the heap and wakes it, then ends', () => {
    const w = new World();
    w.add(4, 0, fruit(4).r);
    for (let i = 0; i < 240; i++) w.stepOnce();
    w.shake(0.5, RULES.shakeAcc, RULES.shakeHz);
    expect(w.shaking).toBe(true);
    let moved = 0;
    for (let i = 0; i < 60; i++) {
      const x = w.bodies[0].x;
      w.stepOnce();
      moved += Math.abs(w.bodies[0].x - x);
    }
    expect(moved).toBeGreaterThan(0.005);
    for (let i = 0; i < 60; i++) w.stepOnce();
    expect(w.shaking).toBe(false);
  });

  it('runs fixed steps of 1/120 s, at most six a frame', () => {
    const w = new World();
    expect(w.advance(1 / 60)).toBe(2);
    expect(w.advance(1)).toBe(PHYS.maxSteps);
  });
});

describe('the dropper', () => {
  it('a release drops the fruit where the finger is; the next one hangs after the cooldown', () => {
    const sim = later();
    const first = sim.cur, next = sim.next;
    sim.pointerDown(0.2);
    sim.pointerUp(0.2);
    const evs = sim.take();
    expect(ofType(evs, 'drop')).toEqual([{ type: 'drop', tier: first, x: expect.closeTo(0.2, 5) }]);
    expect(sim.cur).toBe(next);
    sim.pointerUp(0);
    expect(ofType(sim.take(), 'drop')).toHaveLength(0);
    drive(sim, RULES.cooldown + 0.05, frame());
    sim.keyDrop();
    expect(ofType(sim.take(), 'drop')).toHaveLength(1);
  });

  it('keeps the fruit inside the walls', () => {
    const sim = later();
    sim.pointerUp(5);
    const d = ofType(sim.take(), 'drop')[0];
    expect(d.x + fruit(d.tier).r).toBeLessThanOrEqual(BASKET.half);
  });

  it('a drop asked just before the cooldown ends is kept (buffer)', () => {
    const sim = later();
    sim.keyDrop();
    drive(sim, RULES.cooldown - RULES.buffer + 0.05, frame());
    sim.keyDrop();
    const evs = drive(sim, RULES.buffer, frame());
    expect(ofType(evs, 'drop')).toHaveLength(1);
  });

  it('← → move the aim; Kosz dnia drops the same fruit for everyone', () => {
    const sim = later();
    sim.keyAim(1);
    drive(sim, 0.5, frame());
    expect(sim.aim).toBeGreaterThan(0.1);
    const a = makeSim({ progress: { sessions: 4 }, seed: 1 }), b = makeSim({ progress: { sessions: 9 }, seed: 99 });
    expect(a.daily && b.daily).toBe(true);
    for (let n = 0; n < 20; n++) expect(a.drawTier(n)).toBe(b.drawTier(n));
  });

  it('the first session opens with a story card; a tap closes it without dropping, and the first drops pair up', () => {
    const sim = makeSim();
    expect(sim.firstEver && sim.story?.kind).toBe('open');
    sim.pointerDown(0);
    sim.pointerUp(0);
    expect(sim.story).toBeNull();
    expect(ofType(sim.take(), 'drop')).toHaveLength(0);
    expect([sim.drawTier(0), sim.drawTier(1), sim.drawTier(2), sim.drawTier(3)]).toEqual([1, 1, 2, 2]);
  });
});

describe('merging and the basket', () => {
  it('scores Suika\'s points for a merge, live in the headline score', () => {
    const sim = later();
    const r = fruit(2).r;
    sim.world.add(2, -r - 0.001, r);
    sim.world.add(2, r + 0.001, r);
    const evs = drive(sim, 0.5, frame());
    const m = ofType(evs, 'merge');
    expect(m).toHaveLength(1);
    expect(m[0].tier).toBe(3);
    expect(sim.score).toBe(6);
    expect(sim.basket.score).toBe(6);
  });

  it('a fruit over the rim for 2 s carries the basket to the table; a new one comes, the points stay', () => {
    const sim = later();
    sim.score = 40;
    sim.basket.score = 40;
    // a tower of alike-free fruit higher than the rim, held up by a pillar
    let y = 0;
    const tiers = [9, 8, 9, 8, 9];
    for (const k of tiers) {
      const r = fruit(k).r;
      sim.world.add(k, 0, y + r);
      y += 2 * r;
    }
    const evs = drive(sim, 6, frame());
    const end = ofType(evs, 'basketEnd');
    expect(end.length).toBeGreaterThanOrEqual(1);
    expect(end[0].score).toBeGreaterThanOrEqual(40);
    expect(ofType(evs, 'basketNew')[0].index).toBe(2);
    expect(sim.score).toBeGreaterThanOrEqual(40);
    expect(sim.basket.index).toBe(2);
  });

  it('gives stars by the basket\'s score', () => {
    expect(starsFor(0, RULES.stars)).toBe(0);
    expect(starsFor(RULES.stars[0], RULES.stars)).toBe(1);
    expect(starsFor(RULES.stars[2] + 1, RULES.stars)).toBe(3);
  });
});

describe('the block plan', () => {
  it('fits any session ≥ 10 s: blocks of 12 s or more ending in a rest, the evening at the end', () => {
    for (const planned of [10, 40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        if (planned >= 60) expect(sum).toBeCloseTo(planned - finaleFor(planned), 3);
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(plan[plan.length - 1].kind).toBe('rest');
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
      }
    }
  });

  it('reports the block to the runner\'s panel: focus, rest, its seconds left, the next during the telegraph', () => {
    const sim = later();
    expect(sim.block.kind).toBe('push');
    const evs = drive(sim, sim.block.dur - RULES.telegraph + 0.1, frame());
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
    expect(sim.telegraphed).toBe(true);
    drive(sim, RULES.telegraph, frame());
    expect(sim.block.kind).toBe('rest');
  });

  it('blind pushes come every 4th from the 3rd session, never a session\'s first', () => {
    const sim = later({ progress: { sessions: 3, pushes: 2 }, planned: 600 });
    expect(sim.plan[0].blind).toBe(false);
    const clock = toBlock(sim, 2);
    expect(sim.block.kind).toBe('push');
    expect(sim.block.blind).toBe(true);
    expect(sim.meter()).toBeNull();
    void clock;
  });
});

describe('Wiatr żniwny (push: the charge)', () => {
  it('the wind follows the level only past the lead-in (5 s Mendi, 2 s HALO); the panel reads it', () => {
    for (const eeg of [false, true]) {
      const sim = later({ eeg });
      drive(sim, sim.lead - 0.3, HIGH);
      expect(sim.charge).toBe(0);
      drive(sim, 2, HIGH);
      expect(sim.w).toBeGreaterThan(0.6);
      expect(sim.charge).toBeGreaterThan(0);
      expect(sim.meter()).toBeCloseTo(sim.w, 5);
    }
  });

  it('fills at chargeRate(w): nothing at or below 0.4, about 9 s to full at a strong focus', () => {
    expect(chargeRate(0.3)).toBe(0);
    expect(chargeRate(0.4)).toBe(0);
    expect(1 / chargeRate(1)).toBeLessThan(10);
    expect(1 / chargeRate(0.6)).toBeGreaterThan(15);
  });

  it('a full charge blows the harvest wind: the shake, then alike neighbours drawn together and merged', () => {
    const sim = later();
    const r = fruit(3).r;
    sim.world.add(3, -0.3, r);
    sim.world.add(3, -0.3 + 2 * r + r * 0.5, r);
    sim.world.add(5, 0.3, fruit(5).r);
    sim.charge = 0.99;
    const evs = drive(sim, 6 + RULES.windUp + RULES.shakeSec + 1, HIGH);
    expect(ofType(evs, 'windUp')).toHaveLength(1);
    const wind = ofType(evs, 'wind');
    expect(wind).toHaveLength(1);
    expect(wind[0].pairs).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'merge').some(m => m.tier === 4)).toBe(true);
    expect(sim.winds).toBe(1);
  });

  it('without signal the wind and the charge freeze — never a loss, never shown low', () => {
    const sim = later();
    drive(sim, 7, HIGH);
    const w = sim.w, c = sim.charge;
    drive(sim, 4, NONE);
    expect(sim.w).toBeCloseTo(w, 6);
    expect(sim.charge).toBeCloseTo(c, 6);
    expect(sim.meter()).toBeNull();
  });

  it('a blind block hides the wind; at its end the veil lifts and the gathered charge blows at once', () => {
    const sim = later({ progress: { sessions: 3, pushes: 2 }, planned: 600 });
    const clock = toBlock(sim, 2);
    expect(sim.blind).toBe(true);
    const evs = drive(sim, sim.block.dur + 0.2, HIGH, clock);
    expect(ofType(evs, 'reveal')).toHaveLength(1);
    expect(ofType(evs, 'windUp')[0]?.hidden).toBe(true);
  });

  it('a passed push block adds charge at its end', () => {
    const sim = later();
    const evs = drive(sim, sim.block.dur + 0.1, HIGH);
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBe(true);
    expect(sim.winds + sim.charge).toBeGreaterThan(0.35);
  });
});

describe('Pokłosie (rest: the gleaners)', () => {
  it('calm sets the gleaners\' pace: they take the smallest fruit to the table, for points', () => {
    const sim = later();
    const clock = toBlock(sim, 1);
    expect(sim.block.kind).toBe('rest');
    sim.world.add(1, -0.3, fruit(1).r);
    sim.world.add(4, 0.2, fruit(4).r);
    drive(sim, 0.5, CALM, clock);
    const evs = drive(sim, 8, CALM, clock);
    const g = ofType(evs, 'glean');
    expect(g.length).toBeGreaterThanOrEqual(1);
    expect(g[0].tier).toBe(1);
    expect(g[0].pts).toBe(fruit(1).pts * RULES.gleanMult);
    expect(sim.world.bodies.some(b => b.tier === 4)).toBe(true);
    expect(sim.meter()).toBeCloseTo(CALM.calm, 5);
  });

  it('gathers nothing without signal', () => {
    const sim = later();
    const clock = toBlock(sim, 1);
    sim.world.add(1, -0.3, fruit(1).r);
    const evs = drive(sim, 10, NONE, clock);
    expect(ofType(evs, 'glean')).toHaveLength(0);
    expect(sim.glean).toBe(0);
  });
});

describe('the end of a session', () => {
  it('ends with the last basket\'s tally and may stop soon after; result() is idempotent', () => {
    const sim = later({ planned: 40 });
    const evs = drive(sim, 40.2, frame());
    expect(ofType(evs, 'end')).toHaveLength(1);
    expect(ofType(evs, 'basketEnd').some(e => e.final)).toBe(true);
    expect(sim.canStop()).toBe(false);
    drive(sim, 2, frame());
    expect(sim.canStop()).toBe(true);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.progress.sessions).toBe(6);
  });

  it('finish() settles an early end once', () => {
    const sim = later();
    drive(sim, 3, frame());
    sim.finish();
    sim.finish();
    expect(sim.phase).toBe('done');
    expect(ofType(sim.take(), 'end')).toHaveLength(1);
  });

  it('records with Math.max and closes with a fitting passage that exists', () => {
    const sim = later({ progress: { bestSession: 1000 } });
    sim.score = 10;
    const r = sim.result();
    expect(sim.progress.bestSession).toBe(1000);
    expect(r.record).toBe(false);
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
  });
});

describe('the meta', () => {
  it('migrates an old (v1, mosaic) save in place: the best and the session count stay, the rest starts over', () => {
    const old = {
      v: 1, sessions: 7, harvest: 5321, loaves: 3, loafDay: '2026-10-01', zbiory: 9, rosy: 9, bestSession: 812, bestBasket: 300, bestTier: 8,
      bestChain: 4, bestDew: 77, greatClusters: 1, guests: ['rut', 'piekarka'], grain: 12, lastNewSession: 5, ruthAt: 2, naomiAt: 3,
      dailyDay: '2026-10-01', dailyScore: 400, dailyBest: 600, lastDay: '2026-10-01',
    };
    const p = { ...freshProgress(), ...old } as unknown as UrodzajProgress;
    migrate(p);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.bestSession).toBe(812);
    expect(p.harvest).toBe(0);
    expect(p.made).toHaveLength(MAX_TIER);
    expect((p as unknown as Record<string, unknown>).guests).toBeUndefined();
    expect(migrate(p)).toEqual(p);
    // and it plays
    const sim = new UrodzajSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 2, frame());
    expect(sim.firstEver).toBe(false);
  });

  it('never crashes on fields of a different type', () => {
    const p = { ...freshProgress(), made: 'x', festProg: null, harvest: 'lots', dailyDay: 5 } as unknown as UrodzajProgress;
    migrate(p);
    expect(p.made).toHaveLength(MAX_TIER);
    expect(p.festProg).toEqual([0, 0, 0]);
    expect(p.harvest).toBe(0);
    expect(p.dailyDay).toBe('');
  });

  it('festivals: three missions each, sums add up and feats keep the best; all three done set a decoration and the next begins', () => {
    const p = freshProgress();
    const f = FESTIVALS[0];
    expect(festFeed(p, 'make', 3)).toEqual([]);
    expect(festFeed(p, 'make', f.missions[0].n)[0].kind).toBe('mission');
    for (let i = 0; i < f.missions[1].n - 1; i++) festFeed(p, 'merges', 1);
    expect(p.festProg[1]).toBe(f.missions[1].n - 1);
    festFeed(p, 'merges', 1);
    const evs = festFeed(p, 'basket', f.missions[2].n);
    expect(evs.map(e => e.kind)).toEqual(['mission', 'festival']);
    expect(p.fest).toBe(1);
    expect(p.festProg).toEqual([0, 0, 0]);
    expect(festivalAt(10).missions).toHaveLength(3);
    for (const fe of FESTIVALS) for (const m of fe.missions) expect(missionText(m).length).toBeGreaterThan(3);
  });

  it('the circle counts the five droppable fruits once played, then the biggest made', () => {
    expect(reached(freshProgress())).toBe(0);
    expect(reached({ ...freshProgress(), sessions: 1, bestTier: 3 })).toBe(5);
    expect(reached({ ...freshProgress(), sessions: 1, bestTier: 9 })).toBe(9);
  });
});

describe('Feliks talks', () => {
  it('one line at a time, never while blocked, no repeats until a moment has used them all', () => {
    const talk = new Talk(LINES, mulberry32(3));
    talk.ask('wind', 2, 5);
    talk.update(0.1, 0.1, true);
    expect(talk.line).toBeNull();
    talk.update(0.1, 0.2, false);
    expect(talk.line?.moment).toBe('wind');
    expect(talk.line!.dur).toBeGreaterThanOrEqual(RULES.talkMin);
    expect(talk.line!.dur).toBeLessThanOrEqual(RULES.talkMax);
    let now = 0.2;
    for (let i = 0; i < LINE_COUNT - 1; i++) {
      now += 10;
      talk.update(10, now, false);
      talk.ask('wind', 2, 5);
      talk.update(0.1, now + 0.1, false);
      talk.update(2, now + 2, false);
    }
    expect(new Set(talk.said).size).toBe(talk.said.length);
  });

  it('every line fits a bubble (90 characters) in all four languages; every moment has 3+ variants', () => {
    for (const m of MOMENTS) {
      expect(LINES[m].length).toBeGreaterThanOrEqual(3);
      for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
        for (let i = 1; i <= LINE_COUNT; i++) {
          const s = CATALOGS[lang][`say.${m}.${i}` as keyof typeof CATALOGS.pl] as string;
          expect(s.length, `${lang} say.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('never asks to concentrate harder, never uses holiness words or "hack"', () => {
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
      const all = Object.values(CATALOGS[lang]).map(v => (typeof v === 'string' ? v : Object.values(v).join(' '))).join(' ').toLowerCase();
      for (const bad of ['mocniej', 'harder', 'stärker', 'hack', 'unlock', 'blessing', 'błogosław', 'segen', 'välsign', 'prayer power']) expect(all, `${lang}: ${bad}`).not.toContain(bad);
    }
  });

  it('bends the unit and keeps a no-break space with the number', () => {
    expect(unit(5)).toBe('pkt');
    expect(t('pts', { n: 12 })).toBe('12 pkt');
  });
});

describe('the layout', () => {
  it('keeps the basket below the runner\'s HUD on a phone, and inside the canvas on desktop', () => {
    const phone = computeLayout(390, 640, 120);
    expect(sy(phone, BASKET.hang) - phone.S * 0.2).toBeGreaterThanOrEqual(120 - 1);
    expect(sx(phone, -BASKET.half)).toBeGreaterThan(0);
    expect(sx(phone, BASKET.half)).toBeLessThan(390);
    expect(phone.ground).toBeLessThan(640);
    const desk = computeLayout(1280, 620, 140);
    expect(desk.wide).toBe(true);
    expect(sy(desk, BASKET.hang) - desk.S * 0.24).toBeGreaterThanOrEqual(0);
    expect(desk.ground).toBeLessThanOrEqual(620);
    expect(worldX(desk, desk.cx)).toBe(0);
    const land = computeLayout(844, 280, 120);
    expect(land.ground).toBeLessThanOrEqual(280);
  });
});

describe('the smoke path', () => {
  /** The smoke test's input: a click at the canvas centre every 0.65 s, Space every ~2 s, the simulator's focus on. */
  function smoke(progress: Partial<UrodzajProgress>, seed: number, eeg: boolean, planned = 40) {
    const sim = makeSim({ progress, planned, seed, tuning: BEGINNER, eeg });
    const focus = new FocusInput(BEGINNER);
    let f = focus.push(0, true, 0.1), hub = 0, tap = 0, space = 0, score = 0;
    for (let t = 0; t < 22 + 1e-9; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      sim.update(STEP, f, t);
      if ((tap += STEP) >= 0.65) {
        tap -= 0.65;
        sim.pointerDown(0);
        sim.pointerUp(0);
      }
      if ((space += STEP) >= 2) {
        space -= 2;
        sim.keyDrop();
      }
      sim.take();
      score = sim.result().score;
    }
    return score;
  }

  it('scores by 22 s on either band, first session or later', () => {
    for (const eeg of [false, true]) {
      for (let seed = 1; seed <= 6; seed++) expect(smoke({}, seed, eeg), `eeg ${eeg}, seed ${seed}`).toBeGreaterThan(0);
    }
    expect(smoke({ sessions: 6, dailyDay: DAY }, 3, false, 300)).toBeGreaterThan(0);
  });
});

describe('the lobby (index.ts, panel.ts)', () => {
  it('shows the best day, nothing before a first session, and how to play', async () => {
    const mod = (await import('../src/arcade/urodzaj/index')).default;
    const p = freshProgress();
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.bestSession = 420;
    expect(mod.best(p)).toBe(420);
    const how = mod.howto!();
    expect(how.hands.length).toBeGreaterThanOrEqual(1);
    expect(how.hands.length).toBeLessThanOrEqual(3);
    expect((how.tips ?? []).length).toBeLessThanOrEqual(2);
  });

  it('builds the progress card from elements: the circle of eleven fruits, the festival\'s missions', async () => {
    const { progressPanel } = await import('../src/arcade/urodzaj/panel');
    const p = { ...freshProgress(), sessions: 3, bestTier: 7, fest: 1, festProg: [6, 0, 0] };
    const el = progressPanel(p);
    expect(el.querySelectorAll('.arcade-album > div')).toHaveLength(MAX_TIER);
    expect(el.querySelectorAll('.arcade-album > div.on')).toHaveLength(7);
    expect(el.textContent).toContain(t('decor.obrus').charAt(0).toUpperCase());
  });
});

// ── on a phone first (src/arcade/DESIGN.md §12, §6 "Mobile first") ──
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);
type Size = (typeof CHECK_SIZES)[number];
const upright = (z: Size) => z.w < 600 && z.h > z.w;

describe('on a phone first: the layout', () => {
  it('the font helper never goes under 11 px', () => {
    for (const px of [0, 4, 9.5, 10, 10.9, 11, 13, 34]) for (const fam of [FONT, SERIF]) expect(pxOf(font(700, px, fam))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(font(800, 34))).toBe(34);
  });

  it('every checked size: the basket under the HUD and inside the edges, the next fruit\'s bubble big with a 13 px label clear of Feliks, the circle in the band', () => {
    for (const z of CHECK_SIZES) {
      const L = computeLayout(z.w, z.h, z.insets);
      const name = z.name;
      expect(L.u, name).toBeGreaterThanOrEqual(1);
      expect(L.u, name).toBeLessThanOrEqual(1.3);
      // Feliks's head (0.24 W over the twine) under the HUD, the ground over the home indicator
      expect(sy(L, BASKET.hang + 0.24), name).toBeGreaterThanOrEqual(L.top - 0.5);
      expect(L.ground, name).toBeLessThanOrEqual(z.h - z.insets.bottom);
      // the walls inside the canvas and the notches
      expect(sx(L, -BASKET.half) - L.S * 0.05, name).toBeGreaterThanOrEqual(z.insets.left);
      expect(sx(L, BASKET.half) + L.S * 0.05, name).toBeLessThanOrEqual(z.w - z.insets.right);
      // the next fruit: 44 px and up, "Następny" at 13 px under the HUD and inside the canvas, clear of the walls
      const n = L.next;
      expect(2 * n.r, name).toBeGreaterThanOrEqual(44);
      expect(n.label, name).toBeGreaterThanOrEqual(MIN_READ);
      expect(n.labelY - n.label, name).toBeGreaterThanOrEqual(z.insets.top);
      expect(n.x + n.r, name).toBeLessThanOrEqual(z.w - z.insets.right);
      if (n.beside) expect(n.x - n.r, name).toBeGreaterThan(sx(L, BASKET.half) + L.S * 0.05);
      else expect(n.y + n.r, name).toBeLessThan(sy(L, BASKET.hang + 0.24));
      if (upright(z)) expect(L.wide, name).toBe(false);
      if (!L.wide) {
        // the circle of fruits: a strip along the bottom, 16 px off the edges, icons 20 px and up, under the basket
        expect(L.ring.strip, name).toBe(true);
        expect(L.ring.y, name).toBeGreaterThanOrEqual(z.h * (1 - THUMB));
        expect(L.ring.x - L.ring.w / 2, name).toBeGreaterThanOrEqual(z.insets.left + 16 - 0.01);
        expect(L.ring.x + L.ring.w / 2, name).toBeLessThanOrEqual(z.w - z.insets.right - 16 + 0.01);
        expect(2 * L.ring.r, name).toBeGreaterThanOrEqual(20);
        expect(L.ring.y - L.ring.r, name).toBeGreaterThan(L.ground);
        expect(L.ring.y + L.ring.r, name).toBeLessThanOrEqual(z.h - Math.max(8, z.insets.bottom + 4));
        // a basket that uses the band: at least half the width and three fifths of the height
        expect(L.S * 1.09, name).toBeGreaterThanOrEqual(z.w * 0.5);
        expect((ABOVE_W + 0.07) * L.S, name).toBeGreaterThanOrEqual((z.h - z.insets.top - z.insets.bottom) * 0.6);
        // the lower half of the basket lies in the thumb zone: a thumb there aims, the fruit hangs above it
        expect(L.floor, name).toBeGreaterThan(z.h * (1 - THUMB));
        expect(sy(L, BASKET.hang), name).toBeLessThan(z.h * (1 - THUMB));
      } else {
        expect(L.ring.strip, name).toBe(false);
        expect(L.ring.x - L.ring.r, name).toBeGreaterThanOrEqual(z.insets.left);
        expect(L.ring.y - L.ring.r, name).toBeGreaterThanOrEqual(z.insets.top);
      }
    }
  });
});
const ABOVE_W = BASKET.hang + 0.24;

/** every string drawn on a canvas made by the patched getContext, with its font size */
const drawn: { text: string; px: number }[] = [];

/** A context that draws nothing, measures text at 0.55 em a character and notes each string drawn with its size. */
function noteContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined };
  const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
  const note = (s: unknown) => {
    const text = String(s);
    if (text.trim() && (state.globalAlpha as number) > 0.05) drawn.push({ text, px: pxOf(String(state.font)) });
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (s: string) => ({ width: String(s).length * pxOf(String(target.font)) * 0.55 });
      if (prop === 'fillText' || prop === 'strokeText') return (s: unknown) => note(s);
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
      if (prop === 'createPattern') return () => null;
      if (prop === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('on a phone first: the game at every checked size', () => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  beforeAll(() => { proto.getContext = function (this: HTMLCanvasElement) { return noteContext(this); }; });
  afterAll(() => { proto.getContext = original; });

  function envFor(z: { w: number; h: number; insets: Insets }, progress: UrodzajProgress, touch: boolean, hints: string[] = []): GameEnv<UrodzajProgress> {
    return {
      canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
      progress, rng: mulberry32(3), day: DAY, daySeed: 7, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true, haptics: false,
      tuning: TUNING, hint: (text: string) => { if (text) hints.push(text); }, hudTop: () => z.insets.top, insets: () => z.insets, touch,
    };
  }

  async function gameAt(z: { w: number; h: number; insets: Insets }, touch = true, progress: UrodzajProgress = freshProgress(), hints: string[] = []) {
    const mod = (await import('../src/arcade/urodzaj/index')).default;
    const game = mod.create(envFor(z, progress, touch, hints));
    game.resize(z.w, z.h, 1);
    game.start();
    const sim = (game as unknown as { sim: UrodzajSim }).sim;
    const clock = { t: 0 };
    const run = (sec: number, f = frame()) => {
      for (let i = 0; i < Math.round(sec * 30); i++) {
        clock.t += 1 / 30;
        game.update(1 / 30, f, clock.t);
        game.draw();
      }
    };
    return { game, sim, run };
  }

  /** Text allowed at 11–13 px: the verse's reference line (the kit draws it at 62 % of the verse, never under 11). */
  const secondary = (s: string): boolean => s.startsWith(passage('deu8.10').ref);

  function check(game: ArcadeGame, z: Size, what: string): string[] {
    drawn.length = 0;
    game.draw();
    const name = `${z.name}: ${what}`;
    const ts = game.targets!();
    expect(auditTargets(ts, z.w, z.h, z.insets), name).toEqual([]);
    expect(drawn.filter(d => d.px < MIN_TEXT - 1e-6), name).toEqual([]);
    expect(drawn.filter(d => d.px < MIN_READ - 1e-6 && !secondary(d.text)), name).toEqual([]);
    return ts.map(x => x.label);
  }

  it('the story card, play, Feliks at length, the gleaners, a festival, the tally: targets and text pass the phone checks', async () => {
    type Inner = { endBasket(final: boolean): void };
    for (const z of CHECK_SIZES) {
      for (const touch of [true, false]) {
        if (!touch && upright(z)) continue;
        const { game, sim, run } = await gameAt(z, touch);
        run(0.5);
        // the first session opens with the story card: it is the one target (a tap anywhere on it closes it)
        expect(check(game, z, 'the opening card'), z.name).toEqual(['story card']);
        sim.story = null;
        for (const [tier, x] of [[6, -0.3], [5, 0.25], [3, -0.05], [4, 0.36], [2, 0.1], [1, -0.4]] as const) sim.world.add(tier, x, 0.4);
        run(1.5);
        // play: no buttons, a finger anywhere aims
        expect(check(game, z, 'play'), z.name).toEqual([]);
        // Feliks at length, mid-basket and at the side
        for (const aim of [0, 0.4, -0.4]) {
          sim.aim = sim.aimTarget = aim;
          sim.talk.line = { moment: 'open', text: 'To jest bardzo długa kwestia Feliksa, żeby sprawdzić, czy dymek mieści się na wąskim ekranie.', t: 0.5, dur: 4 } as typeof sim.talk.line;
          run(0.3);
          check(game, z, `Feliks talks (aim ${aim})`);
        }
        sim.talk.line = null;
        // a rest block past its lead-in: the gleaners and their word
        const ri = sim.plan.findIndex(b => b.kind === 'rest');
        sim.blockIndex = ri;
        sim.blockT = 8;
        run(0.5);
        check(game, z, 'the gleaners');
        // a festival's card (a tap closes it: the target) and a basket's tally
        sim.story = { kind: 'fest', t: 0.5, dur: 3.2, fest: 0 };
        run(0.2);
        expect(check(game, z, 'a festival'), z.name).toEqual(['story card']);
        sim.story = null;
        (sim as unknown as Inner).endBasket(false);
        run(0.6);
        check(game, z, 'the tally');
        game.destroy();
      }
    }
  }, 30_000);

  it('a finger anywhere aims, the release drops where it is, the fruit hangs above it; a press shows at once', async () => {
    const z = CHECK_SIZES[0];
    const { game, sim, run } = await gameAt(z, true, { ...freshProgress(), sessions: 4, dailyDay: DAY });
    run(0.5);
    const L = computeLayout(z.w, z.h, z.insets);
    // a thumb low in the thumb zone, at the basket's right
    const fx = sx(L, 0.3), fy = z.h - 60;
    game.pointer!({ type: 'down', x: fx, y: fy, id: 1 });
    expect((game as unknown as { view: { touchAt: unknown } }).view.touchAt).not.toBeNull();
    game.pointer!({ type: 'move', x: fx, y: fy - 5, id: 1 });
    run(0.3);
    expect(sim.hangX).toBeGreaterThan(0.2);
    expect(sy(L, BASKET.hang)).toBeLessThan(fy - 100);
    const before = sim.drops;
    game.pointer!({ type: 'up', x: fx, y: fy - 5, id: 1 });
    expect(sim.drops).toBe(before + 1);
    // a second finger while the first is down is ignored
    run(1);
    game.pointer!({ type: 'down', x: sx(L, -0.3), y: fy, id: 2 });
    game.pointer!({ type: 'down', x: sx(L, 0.3), y: fy, id: 3 });
    game.pointer!({ type: 'up', x: sx(L, 0.3), y: fy, id: 3 });
    expect(sim.drops).toBe(before + 1);
    game.pointer!({ type: 'up', x: sx(L, -0.3), y: fy, id: 2 });
    expect(sim.drops).toBe(before + 2);
  });

  it('the smoke\'s input scores within 22 s on a desktop and on the smallest phone (a centre tap every 0.65 s, Space every 2 s)', async () => {
    for (const [z, touch] of [[CHECK_SIZES[7], false], [CHECK_SIZES[0], true]] as const) {
      const { game } = await gameAt(z, touch, { ...freshProgress(), sessions: 4, dailyDay: DAY });
      const focus = new FocusInput(BEGINNER);
      let f = focus.push(0, true, 0.1), tap = 0, space = 0, hub = 0, scoreAt: number | null = null;
      const dt = 1 / 30;
      for (let tt = 0; tt < 22; tt += dt) {
        if ((hub += dt) >= 0.1) {
          hub -= 0.1;
          f = focus.push(20 * (1 - Math.exp(-tt / 4)), true, 0.1);
        }
        game.update(dt, f, tt);
        game.draw();
        if ((tap += dt) >= 0.65) {
          tap = 0;
          game.pointer!({ type: 'down', x: z.w / 2, y: z.h * 0.6, id: 1 });
          game.pointer!({ type: 'up', x: z.w / 2, y: z.h * 0.6, id: 1 });
        }
        if ((space += dt) >= 2) {
          space = 0;
          game.key!(' ', true);
          game.key!(' ', false);
        }
        if (scoreAt === null && game.result().score > 0) scoreAt = tt;
      }
      expect(scoreAt, z.name).not.toBeNull();
    }
  });

  it('speaks to the hand the player has: a finger never hears of keys, clicks or a mouse; a keyboard keeps its shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|klick|mysz[ąy]|mouse|maus|musen|←|→/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['hint.aim', 'hint.drop', 'hint.next', 'hint.merge', 'how.goal', 'how.aim', 'how.drop', 'how.tap', 'story.tap']) {
        expect(c[k], `${l}.${k}`).toBeTypeOf('string');
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      for (const k of ['hint.aim.keys', 'hint.drop.keys', 'how.aim.keys', 'how.drop.keys', 'how.keys', 'story.tap.keys']) expect(c[k], `${l}.${k}`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(touch.hands).toHaveLength(3);
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
    expect(hintText('aim', true)).not.toMatch(KEYS);
    expect(hintText('aim', false)).toMatch(KEYS);
    expect(hintText('merge', false)).toBe(t('hint.merge'));
  });

  it('teaches a phone\'s first session in a finger\'s words', async () => {
    const hints: string[] = [];
    const { run, sim, game } = await gameAt(CHECK_SIZES[1], true, freshProgress(), hints);
    run(0.5);
    game.pointer!({ type: 'down', x: 195, y: 400, id: 1 });
    game.pointer!({ type: 'up', x: 195, y: 400, id: 1 });
    run(6);
    expect(sim.story).toBeNull();
    expect(hints.length).toBeGreaterThan(0);
    for (const h of hints) expect(h).not.toMatch(/spacj|mysz|←|→/i);
  });
});
