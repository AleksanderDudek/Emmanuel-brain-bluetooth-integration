import { describe, expect, it } from 'vitest';
import {
  ALL_CARDS, DEPTHS, FACT_SRC, LINE_COUNT, MOMENTS, ORGAN, ORGANS, SOURCES, TIPS, cortisolCurve, dayOrgan, devOf, factText, linesOf,
  rangeText, valOf, valueText,
} from '../src/arcade/swiatlo/content';
import { CATALOGS, t, unit } from '../src/arcade/swiatlo/i18n';
import {
  bestOf, freshProgress, lightMap, mapLit, meetCard, migrate, openDeeper, scanDepth, scanStars, type SwiatloProgress,
} from '../src/arcade/swiatlo/meta';
import { BREATH, RULES } from '../src/arcade/swiatlo/rules';
import { SwiatloSim, finaleFor, loopDev, loopValue, planBlocks, type SimEvent } from '../src/arcade/swiatlo/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { songProblems } from '../src/arcade/kit/song';
import { coachText, howto } from '../src/arcade/swiatlo/index';
import { FIG_HALF, bubbleRect, figPt, layout, panelRect, storyRect, tapTargets } from '../src/arcade/swiatlo/layout';
import { organAt } from '../src/arcade/swiatlo/figure';
import { font, fontPx } from '../src/arcade/swiatlo/paint';
import { pulseText } from '../src/arcade/swiatlo/hud';
import { buildSong } from '../src/arcade/swiatlo/lullaby';

const DAY = '2026-11-12';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const LOW = frame({ level: 0.15, activity: -1, calm: 0.7 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.help', 'c.loop', 'c.band', 'c.card', 'c.beat', 'c.bubbles', 'c.breath', 'c.pulse', 'c.typical', 'c.blind'];

type SimOpts = { progress?: Partial<SwiatloProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; hour?: number };

function makeSim(o: SimOpts = {}): SwiatloSim {
  const sim = new SwiatloSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: 4242,
    plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, hour: o.hour ?? 9,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: SwiatloSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void, hr: number | null = null): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t, hr);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run to the next block of a kind (returns the clock). */
function until(sim: SwiatloSim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

/** Run until the band arrives at an organ (returns the events). */
function untilAt(sim: SwiatloSim, o: string, f: FocusFrame, clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  let guard = 0;
  while (sim.loop?.organ !== o && guard++ < 3000) out.push(...drive(sim, 0.1, f, clock));
  return out;
}

describe('the physiology (content.ts)', () => {
  it('scans nine organs from the crown to the soles, in order', () => {
    expect(ORGANS).toHaveLength(9);
    for (let i = 1; i < ORGANS.length; i++) expect(ORGAN[ORGANS[i]].v).toBeGreaterThan(ORGAN[ORGANS[i - 1]].v);
    expect(ORGAN.brain.v).toBeGreaterThan(RULES.startV);
    expect(ORGAN.bone.v).toBeLessThan(RULES.endV);
  });

  it('keeps every set point inside its healthy range and every everyday push outside it', () => {
    for (const o of ORGANS) {
      const s = ORGAN[o];
      expect(s.lo).toBeLessThan(s.set);
      expect(s.hi).toBeGreaterThan(s.set);
      expect(s.kicks.length).toBeGreaterThan(0);
      for (const k of s.kicks) {
        const d = Math.abs(devOf(s, k.v0));
        expect(d, `${o}.${k.id}`).toBeGreaterThan(1.1);
        expect(d, `${o}.${k.id}`).toBeLessThan(6);
        expect(t(`kick.${o}.${k.id}` as never)).not.toMatch(/^kick\./);
        expect(t(`fix.${o}.${k.id}` as never)).not.toMatch(/^fix\./);
      }
      // the value and the deviation are inverse
      for (const d of [-2, -1, -0.4, 0, 0.5, 1.7]) expect(devOf(s, valOf(s, d))).toBeCloseTo(d, 9);
    }
  });

  it('uses the real ranges with sources (37 ± 0.5 °C, pH 7.35–7.45, 60–100/min, 70–99 mg/dL, Na 135–145, Ca 2.2–2.6)', () => {
    expect([ORGAN.brain.lo, ORGAN.brain.hi]).toEqual([36.5, 37.5]);
    expect([ORGAN.lungs.lo, ORGAN.lungs.hi]).toEqual([7.35, 7.45]);
    expect([ORGAN.heart.lo, ORGAN.heart.hi]).toEqual([60, 100]);
    expect([ORGAN.liver.lo, ORGAN.liver.hi]).toEqual([70, 99]);
    expect([ORGAN.kidney.lo, ORGAN.kidney.hi]).toEqual([135, 145]);
    expect([ORGAN.bone.lo, ORGAN.bone.hi]).toEqual([2.2, 2.6]);
    for (const o of ORGANS) for (const s of ORGAN[o].src) expect(SOURCES[s], `${o}: ${s}`).toBeTruthy();
    for (const o of ORGANS) for (const s of FACT_SRC[o]) expect(SOURCES[s], `${o}: ${s}`).toBeTruthy();
  });

  it('writes the values the way each language reads them, with a no-break space before the unit', () => {
    expect(valueText(ORGAN.brain, 37.84)).toBe('37,8 °C');
    expect(valueText(ORGAN.lungs, 7.312)).toBe('pH 7,31');
    expect(valueText(ORGAN.heart, 117.6)).toBe('118/min');
    expect(valueText(ORGAN.liver, 138)).toBe('138 mg/dl');
    expect(valueText(ORGAN.kidney, 147.6)).toBe('148 mmol/l');
    expect(valueText(ORGAN.bone, 2.153)).toBe('2,15 mmol/l');
    expect(valueText(ORGAN.adrenal, 1.4)).toBeNull();
    expect(valueText(ORGAN.gut, 80)).toBeNull();
    for (const o of ORGANS) expect(rangeText(ORGAN[o]).length).toBeGreaterThan(3);
  });

  it('draws cortisol’s day: highest in the morning, lowest after midnight', () => {
    const peak = cortisolCurve(8), night = cortisolCurve(2), evening = cortisolCurve(21);
    expect(peak).toBeGreaterThan(evening);
    expect(evening).toBeGreaterThan(night - 0.05);
    let lo = Infinity, at = 0;
    for (let h = 0; h < 24; h += 0.25) if (cortisolCurve(h) < lo) { lo = cortisolCurve(h); at = h; }
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThanOrEqual(4);
  });

  it('has a Wiedza card for every organ at every depth, with a number in it', () => {
    expect(ALL_CARDS).toHaveLength(27);
    for (const o of ORGANS) for (const d of DEPTHS) expect(factText(o, d), `${o}.${d}`).toMatch(/\d/);
  });

  it('chooses the day’s organ the same for everyone', () => {
    expect(dayOrgan(4242)).toBe(dayOrgan(4242));
    expect(ORGANS).toContain(dayOrgan(123456));
  });
});

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates Skan and Odpoczynek, ending on a rest', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) {
        expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(b.dur).toBeLessThanOrEqual(31);
      }
    }
  });

  it('fits a short test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeLessThanOrEqual(Math.max(planned, 8) + 1e-6);
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
    expect(sim.tip.length).toBeGreaterThan(10);
  });

  it('makes every 4th push blind from the 3rd session, never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock);
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
    const young = later({ planned: 600, progress: { sessions: 1, pushes: 2 } });
    const c2 = { t: 0 };
    for (let i = 0; i < 6; i++) {
      expect(young.blind).toBe(false);
      drive(young, young.block.dur + 0.05, frame(), c2);
    }
  });

  it('judges each block once at its end, from its last 15 s', () => {
    const sim = later();
    const evs = drive(sim, sim.block.dur + 0.1, HIGH);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].verdict).toBe(true);
  });

  it('asks for imagery of the scene, with one counting and one recall strategy in the rotation', () => {
    const push = TIPS.push.map(k => t(k)).join(' ');
    expect(push).toMatch(/Wyobraź|Zobacz|Poczuj/);
    expect(push).toMatch(/Licz/);
    expect(push).toMatch(/Przypomnij/);
  });
});

describe('the scan and the loops', () => {
  it('travels to the hypothalamus first and pushes its temperature out of range by an everyday thing', () => {
    const sim = later();
    const evs = untilAt(sim, 'brain', MID);
    const arrive = ofType(evs, 'arrive')[0];
    expect(arrive.organ).toBe('brain');
    const l = sim.loop!;
    expect(Math.abs(loopDev(l))).toBeGreaterThan(1);
    expect(['bath', 'cold']).toContain(l.kick);
    expect(sim.scanV).toBeCloseTo(ORGAN.brain.v, 5);
  });

  it('brings the value home as a first-order approach: faster in gold light than at the base', () => {
    // the lungs: the second organ, reached after the push block's lead-in (the brain's loop runs mostly inside it)
    const time = (f: FocusFrame) => {
      const sim = later();
      const clock = { t: 0 };
      untilAt(sim, 'lungs', f, clock);
      const t0 = clock.t;
      let guard = 0;
      while (!sim.loop?.settled && guard++ < 4000) drive(sim, 0.05, f, clock);
      return clock.t - t0;
    };
    const lit = time(HIGH), base = time(NONE);
    expect(lit).toBeLessThan(base * 0.8);
    expect(lit).toBeGreaterThan(3);
    expect(base).toBeLessThan(20);
  });

  it('moves the value monotonically toward the set point and holds it inside the range once settled', () => {
    const sim = later();
    const clock = { t: 0 };
    untilAt(sim, 'brain', MID, clock);
    const o = ORGAN.brain;
    let prev = Math.abs(loopValue(sim.loop!) - o.set);
    let guard = 0;
    while (!sim.loop!.balanced && guard++ < 2000) {
      drive(sim, 0.1, MID, clock);
      const d = Math.abs(loopValue(sim.loop!) - o.set);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    const v = loopValue(sim.loop!);
    expect(v).toBeGreaterThanOrEqual(o.lo);
    expect(v).toBeLessThanOrEqual(o.hi);
  });

  it('settles every organ in turn, lights it, pays lux and opens its Wiedza card the first time', () => {
    const sim = later({ progress: { cards: [] } });
    const evs = drive(sim, 90, HIGH);
    const bal = ofType(evs, 'balanced');
    expect(bal.length).toBeGreaterThanOrEqual(4);
    expect(bal.map(e => e.organ).slice(0, 4)).toEqual(['brain', 'lungs', 'heart', 'liver']);
    for (const e of bal) expect(e.lux).toBeGreaterThan(0);
    expect(bal.every(e => e.fresh)).toBe(true);
    expect(sim.p.cards.length).toBe(bal.length);
    expect(ofType(evs, 'card').length).toBe(bal.length);
  });

  it('stays a little longer at an organ whose card just opened, and gives the panel back when the next organ comes', () => {
    const sim = later({ progress: { cards: [] } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.loop?.balanced && guard++ < 3000) drive(sim, 0.05, HIGH, clock);
    expect(sim.card?.fresh).toBe(true);
    expect(sim.loop!.linger).toBeGreaterThan(RULES.linger);
    untilAt(sim, 'lungs', HIGH, clock);
    drive(sim, RULES.cardAfterArrive + 0.1, HIGH, clock);
    expect(sim.card).toBeNull();
  });

  it('rates an organ golden when it settles quickly in gold light, never in a blind or signal-less push', () => {
    const lit = later();
    const ev1 = drive(lit, 40, HIGH);
    expect(ofType(ev1, 'balanced').some(e => e.rating === 3)).toBe(true);
    const dark = later();
    const ev2 = drive(dark, 40, NONE);
    expect(ofType(ev2, 'balanced').every(e => e.rating < 3)).toBe(true);
  });

  it('helps with the hands: taps push the value home, with diminishing returns for a flurry', () => {
    const withTaps = later(), without = later();
    const c1 = { t: 0 }, c2 = { t: 0 };
    untilAt(withTaps, 'brain', NONE, c1);
    untilAt(without, 'brain', NONE, c2);
    let next = 0.65;
    drive(withTaps, 4, NONE, c1, tt => { if (tt >= next) { next += 0.65; withTaps.help(); } });
    drive(without, 4, NONE, c2);
    expect(withTaps.loop!.s).toBeLessThan(without.loop!.s - 0.05);
    // a burst of ten taps does less than ten times one tap
    const burst = later(), one = later();
    untilAt(burst, 'brain', NONE);
    untilAt(one, 'brain', NONE);
    const s0 = burst.loop!.s;
    for (let i = 0; i < 10; i++) burst.help();
    one.help();
    expect(s0 - burst.loop!.s).toBeLessThan(10 * (s0 - one.loop!.s));
  });

  it('at the heart a tap on the beat helps twice, off the beat half', () => {
    const sim = later({ progress: { cards: [...ALL_CARDS] } });
    expect(sim.pushBlock).toBe(true);
    const clock = { t: 0 };
    untilAt(sim, 'heart', HIGH, clock);
    // wait for a beat, then tap right on it
    let guard = 0;
    while (sim.sinceBeat > 0.02 && guard++ < 500) drive(sim, STEP, HIGH, clock);
    const s0 = sim.loop!.s;
    sim.help();
    const onBeat = s0 - sim.loop!.s;
    expect(ofType(sim.take(), 'help')[0]).toMatchObject({ kind: 'beat', good: true });
    // half a beat later: off the beat
    drive(sim, sim.beatPeriod / 2 - sim.sinceBeat, HIGH, clock);
    const s1 = sim.loop!.s;
    sim.help();
    const off = s1 - sim.loop!.s;
    expect(off).toBeLessThan(onBeat);
  });

  it('at the lungs the hands breathe out CO₂ bubbles', () => {
    const sim = later({ progress: { cards: [...ALL_CARDS] } });
    const clock = { t: 0 };
    untilAt(sim, 'lungs', MID, clock);
    drive(sim, 2, MID, clock);
    const live = sim.bubbles.filter(b => b.pop === 0).length;
    expect(live).toBeGreaterThan(0);
    sim.help();
    expect(sim.bubbles.filter(b => b.pop === 0).length).toBe(live - 1);
  });

  it('a tap on the body always helps (never a card by mistake); the settled organ in the band opens its card and keeps the band', () => {
    const sim = later({ progress: { cards: [...ALL_CARDS] } });
    const clock = { t: 0 };
    untilAt(sim, 'lungs', HIGH, clock);
    expect(sim.lit.brain).toBeGreaterThan(0);
    const s0 = sim.loop!.s;
    sim.tapOrgan('brain');   // a lit organ elsewhere: it helps the lungs
    expect(sim.card).toBeNull();
    expect(sim.loop!.s).toBeLessThan(s0);
    let guard = 0;
    while (!sim.loop?.settled && guard++ < 2000) drive(sim, 0.05, HIGH, clock);
    while (!sim.loop?.balanced && guard++ < 4000) drive(sim, 0.05, HIGH, clock);
    const linger = sim.loop!.linger;
    sim.tapOrgan('lungs');
    expect(sim.card?.organ).toBe('lungs');
    expect(sim.loop!.linger).toBeGreaterThan(linger);
  });

  it('steps the band on between organs (a tap and Space move the scan)', () => {
    const sim = later();
    const v0 = sim.scanV;
    sim.key(' ', true);
    expect(sim.scanV).toBeGreaterThan(v0);
  });

  it('finishes a whole scan: a story card, stars, the map lit, the next depth opened and a deeper scan', () => {
    const sim = later({ planned: 600, progress: { depth: 1, map: {}, cards: [] } });
    const evs = drive(sim, 260, () => (sim.restBlock ? CALM : HIGH), { t: 0 }, () => { if (sim.story && sim.story.t > 1) sim.help(); });
    const done = ofType(evs, 'scanDone');
    expect(done.length).toBeGreaterThanOrEqual(1);
    expect(done[0].deeper).toBe(true);
    expect(done[0].stars).toBeGreaterThanOrEqual(1);
    expect(sim.p.depth).toBeGreaterThanOrEqual(2);
    expect(mapLit(sim.p).lit).toBeGreaterThanOrEqual(9);
    const starts = ofType(evs, 'scanStart').filter(e => e.scan >= 2);
    expect(starts.length).toBeGreaterThanOrEqual(1);
    expect(starts[0].depth).toBe(2);
    expect(ofType(evs, 'story').some(e => e.kind === 'scan')).toBe(true);
  });
});

describe('the band and the signal', () => {
  it('drives the light with focus in a sighted push past its lead-in; the gauge shows it', () => {
    const sim = later();
    drive(sim, 1, HIGH);
    expect(sim.meter()).toBeNull();   // the lead-in (Mendi: 5 s)
    drive(sim, 7, HIGH);
    expect(sim.light).toBeGreaterThan(0.85);
    expect(sim.meter()).toBeGreaterThan(0.85);
    expect(sim.goldOn).toBe(true);
    const low = later();
    drive(low, 8, LOW);
    expect(low.light).toBeLessThan(0.3);
    expect(low.goldOn).toBe(false);
  });

  it('freezes at the neutral base without a signal: no gauge, no gold, never below the base', () => {
    const sim = later();
    drive(sim, 10, NONE);
    expect(sim.meter()).toBeNull();
    expect(sim.light).toBeCloseTo(RULES.baseLight, 2);
    expect(sim.goldOn).toBe(false);
    expect(sim.padLevel(NONE)).toBeNull();
    expect(sim.score).toBeGreaterThan(0);
  });

  it('a blind push hides the gauge and the song, holds the light at its base, and tells its share at the end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.blind && guard++ < 400) drive(sim, 0.5, HIGH, clock);
    expect(sim.blind).toBe(true);
    drive(sim, 8, HIGH, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.songLevel(HIGH)).toBeNull();
    expect(sim.padLevel(HIGH)).toBeNull();
    expect(sim.light).toBeCloseTo(RULES.baseLight, 2);
    const evs = drive(sim, sim.block.dur, HIGH, clock);
    const end = ofType(evs, 'blindEnd')[0];
    expect(end.share).toBeGreaterThan(0.5);
    expect(end.lux).toBeGreaterThan(0);
  });

  it('rest: the band dims, the breath guide turns in 4 / out 6, calm pours lux and the organ still settles', () => {
    const sim = later();
    const clock = { t: 0 };
    until(sim, 'rest', MID, clock);
    const lux0 = sim.lux;
    const evs = drive(sim, 12, CALM, clock);
    expect(sim.light).toBeLessThan(0.3);
    expect(BREATH).toBe(10);
    const turns = ofType(evs, 'breathTurn');
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(sim.meter()).toBeGreaterThan(0.6);
    expect(sim.lux - lux0).toBeGreaterThan(12);
    expect(sim.songLevel(CALM)).toBeCloseTo(0.32, 5);
  });

  it('a tap on the breath’s turn is “with the breath”', () => {
    const sim = later();
    const clock = { t: 0 };
    until(sim, 'rest', MID, clock);
    drive(sim, RULES.inhale + 0.1, CALM, clock);   // just after the turn to the out-breath
    sim.help();
    expect(ofType(sim.take(), 'breathTap')[0].good).toBe(true);
    drive(sim, 2.2, CALM, clock);   // the middle of the out-breath
    sim.help();
    expect(ofType(sim.take(), 'breathTap')[0].good).toBe(false);
  });
});

describe('the heart and the player’s pulse', () => {
  it('beats at the player’s real pulse when Mendi gives one, and says it is theirs', () => {
    const sim = later({ progress: { seen: ALL_SEEN.filter(s => s !== 'c.pulse'), pulseSeen: false } });
    const evs = drive(sim, 3, MID, { t: 0 }, undefined, 66);
    expect(sim.heartBpm()).toEqual({ bpm: 66, real: true });
    expect(ofType(evs, 'pulse')[0].bpm).toBe(66);
    expect(ofType(evs, 'coach').map(e => e.what)).toContain('pulse');
    expect(sim.p.pulseSeen).toBe(true);
    const beats = ofType(evs, 'beat');
    expect(beats.length).toBeGreaterThanOrEqual(2);
    expect(beats.every(b => b.real)).toBe(true);
  });

  it('without a reading draws a typical heart — never “yours” — that slows with calm in rest', () => {
    const sim = later();
    drive(sim, 2, MID);
    expect(sim.heartBpm().real).toBe(false);
    expect(sim.heartBpm().bpm).toBe(RULES.typical);
    const clock = { t: 0 };
    // a rest away from the heart's own loop (there the heart shows the loop's story value)
    let guard = 0;
    while (!(sim.restBlock && sim.blockT < 2 && sim.lit.heart > 0 && sim.loop?.organ !== 'heart') && guard++ < 4000) drive(sim, 0.25, sim.restBlock ? CALM : HIGH, clock);
    drive(sim, 6, CALM, clock);
    const r = sim.heartBpm();
    expect(r.real).toBe(false);
    expect(r.bpm).toBeLessThan(RULES.typical);
  });

  it('labels the pulse honestly: “Twoje tętno” only for a real reading, else the typical rate said to be typical', () => {
    expect(pulseText({ pulse: 66 })).toBe('Twoje tętno: 66/min');
    expect(pulseText({ pulse: null })).toBe(`typowo ~${RULES.typical}/min · bez pomiaru`);
    // at the heart's own loop (a story value of ~110) the label still says the typical rate
    const sim = later({ progress: { cards: [...ALL_CARDS] } });
    untilAt(sim, 'heart', MID);
    expect(sim.heartBpm().bpm).toBeGreaterThan(100);
    expect(pulseText(sim)).toContain(String(RULES.typical));
    for (const l of ['en', 'de', 'sv'] as const) expect((CATALOGS[l] as Record<string, string>)['hud.typical']).toMatch(/~\{n\}/);
  });

  it('notices a pulse that slowed in rest, and only when it really did', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, sim.block.dur - 0.1, HIGH, clock, undefined, 78);
    until(sim, 'rest', HIGH, clock);
    drive(sim, sim.block.dur, CALM, clock, undefined, 70);
    expect(sim.result().highlights.some(h => /zwolniło o 8/.test(h))).toBe(true);
    const flat = later();
    const c2 = { t: 0 };
    drive(flat, flat.block.dur - 0.1, HIGH, c2, undefined, 70);
    until(flat, 'rest', HIGH, c2);
    drive(flat, flat.block.dur, CALM, c2, undefined, 70);
    expect(flat.result().highlights.some(h => /zwolniło/.test(h))).toBe(false);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER, planned: 60 });
    let next = 0.65, space = 2;
    const clock = { t: 0 };
    const seen: number[] = [];
    drive(sim, 22, HIGH, clock, tt => {
      if (tt >= next) {
        next += 0.65;
        sim.tapOrgan(null);
      }
      if (tt >= space) {
        space += 2;
        sim.key(' ', true);
        sim.key(' ', false);
      }
      if (Math.abs(tt - Math.round(tt)) < STEP / 2) seen.push(sim.score);
    });
    expect(sim.result().score).toBeGreaterThan(0);
    // the headline accrues live
    expect(seen.at(-1)!).toBeGreaterThan(seen[3]);
    expect(sim.balancedNow).toBeGreaterThanOrEqual(1);
  });

  it('opens the first session with the story card and the root verse’s line, and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story?.kind).toBe('open');
    expect(sim.block.kind).toBe('warmup');
    const evs = drive(sim, 60, MID, { t: 0 }, () => { if (sim.story && sim.story.t > 1) sim.help(); });
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('help');
    expect(coach).toContain('loop');
    expect(coach).toContain('card');
    // a returning player hears nothing twice
    const again = makeSim({ progress: { ...sim.p } });
    const ev2 = drive(again, 60, MID);
    expect(ofType(ev2, 'coach').map(e => e.what)).not.toContain('help');
  });

  it('keeps Zofia quiet while a coach mark is up (never two bubbles), and lets her speak after', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 6, MID, clock);   // past the runner's banner
    sim.hintUntil = clock.t + 3;
    sim.talk.ask('good', 5, 10);
    drive(sim, 2.5, MID, clock);
    expect(sim.talk.line).toBeNull();
    drive(sim, 3, MID, clock);
    expect(sim.talk.said.length).toBeGreaterThan(0);
  });

  it('gives result() idempotently and the record only with Math.max', () => {
    const sim = later();
    drive(sim, 30, HIGH);
    const a = sim.result();
    const b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best[String(300)]).toBe(a.score);
    const sessions = sim.p.sessions;
    sim.result();
    expect(sim.p.sessions).toBe(sessions);
    expect(a.unit).toBe(unit(a.score));
  });

  it('settles once at the end (or early), counting the session and its scans', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, MID);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
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
    for (const id of ['mat6.22', 'psa139.13-14', '1co6.19-20', 'pro16.24', 'pro3.7-8', 'pro4.20-22'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    expect(makeSim().closingVerse()).toBe('psa139.13-14');
  });

  it('says what happened in the summary: readable stats and highlights', () => {
    const sim = later();
    drive(sim, 60, HIGH);
    const r = sim.result();
    expect(r.stats.length).toBeGreaterThanOrEqual(6);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
  });

  it('keeps the pace calm: a whole scan takes about 2–4 minutes of a 5-minute session with average focus', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    const evs = drive(sim, 400, () => (sim.restBlock ? frame({ calm: 0.5, level: 0.4 }) : frame({ level: 0.55, activity: 2.2 })), clock,
      () => { if (sim.story && sim.story.t > 1) sim.help(); });
    const done = ofType(evs, 'scanDone');
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.length).toBeLessThanOrEqual(4);
  });

  it('pays a 5-minute session roughly 600–3000 lux with mid focus and some taps', () => {
    const sim = later({ planned: 300 });
    let next = 1.5;
    drive(sim, 300, () => (sim.restBlock ? frame({ calm: 0.6 }) : MID), { t: 0 }, tt => {
      if (tt >= next) { next += 1.5; sim.help(); }
      if (sim.story && sim.story.t > 1) sim.help();
    });
    expect(sim.score).toBeGreaterThan(600);
    expect(sim.score).toBeLessThan(3000);
  });
});

describe('what the light pays', () => {
  const firstBalance = (sim: SwiatloSim) => {
    const evs = drive(sim, 40, HIGH);
    return ofType(evs, 'balanced')[0];
  };

  it('pays the day’s organ double', () => {
    // find a day seed whose organ is the hypothalamus (the first station) and one whose organ is not
    let dayBrain = 0, dayOther = 0;
    for (let s = 1; s < 200 && (!dayBrain || !dayOther); s++) {
      if (dayOrgan(s) === 'brain') dayBrain ||= s; else dayOther ||= s;
    }
    const mk = (daySeed: number) => {
      const sim = new SwiatloSim({ progress: { ...freshProgress(), sessions: 5, pushes: 1, seen: [...ALL_SEEN], cards: [...ALL_CARDS] }, rng: mulberry32(1), day: DAY, daySeed, plannedSec: 300, eeg: false, tuning: TUNING, hour: 9 });
      sim.start();
      return sim;
    };
    const a = firstBalance(mk(dayBrain)), b = firstBalance(mk(dayOther));
    expect(a.organ).toBe('brain');
    expect(a.day).toBe(true);
    expect(b.day).toBe(false);
    expect(a.lux).toBe(b.lux * RULES.dayK);
  });

  it('pays deeper scans more', () => {
    const shallow = later({ progress: { depth: 1, map: {}, cards: [...ALL_CARDS] } });
    const deep = later({ progress: { depth: 3, map: Object.fromEntries(ALL_CARDS.filter(c => !c.endsWith(':3')).map(c => [c, 1])), cards: [...ALL_CARDS] } });
    expect(deep.depth).toBe(3);
    const a = firstBalance(shallow), b = firstBalance(deep);
    expect(a.rating).toBe(b.rating);
    expect(b.lux).toBeGreaterThan(a.lux);
  });

  it('never rates golden in a blind block (no light to judge by), and the song follows the focus only in a sighted push', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2, cards: [...ALL_CARDS] } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.blind && guard++ < 400) drive(sim, 0.5, HIGH, clock);
    expect(sim.blind).toBe(true);
    const evs = drive(sim, sim.block.dur - sim.blockT - 0.1, HIGH, clock);
    for (const e of ofType(evs, 'balanced')) expect(e.rating).toBeLessThan(3);
    const sighted = later();
    drive(sighted, 8, HIGH);
    expect(sighted.sighted).toBe(true);
    expect(sighted.songLevel(HIGH)).toBeCloseTo(HIGH.level, 5);
    expect(sighted.songLevel(NONE)).toBeNull();
  });
});

describe('the meta', () => {
  it('lights the map with the best rating and meets each card once', () => {
    const p = freshProgress();
    expect(lightMap(p, 'heart', 1, 2)).toBe(true);
    expect(lightMap(p, 'heart', 1, 1)).toBe(false);
    expect(p.map['heart:1']).toBe(2);
    lightMap(p, 'heart', 1, 3);
    expect(p.map['heart:1']).toBe(3);
    expect(meetCard(p, 'gut', 2)).toBe(true);
    expect(meetCard(p, 'gut', 2)).toBe(false);
    expect(mapLit(p)).toEqual({ lit: 1, golden: 1, all: 27 });
  });

  it('goes deeper scan by scan: organs, then cells, then systems, opened by whole scans', () => {
    const p = freshProgress();
    expect(scanDepth(p, 1)).toBe(1);
    expect(scanDepth(p, 2)).toBe(1);
    expect(openDeeper(p, 1)).toBe(true);
    expect(scanDepth(p, 2)).toBe(2);
    expect(openDeeper(p, 1)).toBe(false);
    for (const o of ORGANS) lightMap(p, o, 1, 1);
    expect(scanDepth(p, 1)).toBe(2);
    openDeeper(p, 2);
    expect(scanDepth(p, 2)).toBe(3);
    expect(scanDepth(p, 5)).toBe(3);
  });

  it('gives a scan its stars by golden organs', () => {
    expect([0, 3, 4, 6, 7, 9].map(scanStars)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and keeps the count', () => {
    const p = mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as SwiatloProgress;
    migrate(p);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.song).toBe(true);
    expect(p.depth).toBe(1);
    expect(migrate(p)).toBe(p);
    expect(bestOf(p)).toBeNull();
  });

  it('keeps a realistic version-1 save and repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, scans: 5, map: { 'heart:1': 3, 'gut:2': 9, 'nope:1': 2, 'brain:1': 'x' }, cards: ['heart:1', 'heart:1', 'ghost:2', 7],
      depth: 7, best: { '300': 1240, '180': 'x' }, balanced: 40, golden: 'many', bestScan: 99, fastest: -3, breaths: 12, pulseSeen: 'yes', song: false,
      seen: ['c.help', 3], lastLen: 300,
    };
    const p = mergeSaved(freshProgress(), saved) as SwiatloProgress;
    migrate(p);
    expect(p.map).toEqual({ 'heart:1': 3, 'gut:2': 3 });
    expect(p.cards).toEqual(['heart:1']);
    expect(p.depth).toBe(3);
    expect(p.best).toEqual({ 300: 1240 });
    expect(p.golden).toBe(0);
    expect(p.bestScan).toBe(9);
    expect(p.fastest).toBe(0);
    expect(p.pulseSeen).toBe(false);
    expect(p.song).toBe(false);
    expect(p.seen).toEqual(['c.help']);
    expect(bestOf(p)).toBe(1240);
    // and it plays
    const sim = new SwiatloSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 180, eeg: true, tuning: TUNING, hour: 22 });
    sim.start();
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, map: 'x', cards: 5, best: [], seen: null, depth: -1 }]) {
      const p = mergeSaved(freshProgress(), junk) as SwiatloProgress;
      migrate(p);
      expect(p.ver).toBe(1);
      expect(Array.isArray(p.cards)).toBe(true);
      expect(p.depth).toBeGreaterThanOrEqual(1);
      expect(typeof p.map).toBe('object');
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Zofia at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) {
      expect(LINE_COUNT[m], m).toBeGreaterThanOrEqual(3);
      expect(linesOf(m).every(s => s.length > 5), m).toBe(true);
    }
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

  it('suggests strategies, never to concentrate harder, and never claims to heal', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (typeof v !== 'string') continue;
        if (/^(tip|howto)\./.test(k)) expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
        expect(v, `${l}.${k}`).not.toMatch(/uzdrawia|leczy Cię|heals you|cures|heilt dich|botar dig/i);
      }
    }
    // the how-to's last tip says it plainly, in every language
    expect(CATALOGS.pl['howto.tip2']).toMatch(/nie zastępuje leczenia/);
    expect(CATALOGS.en['howto.tip2']).toMatch(/does not replace/);
    expect(CATALOGS.de['howto.tip2']).toMatch(/ersetzt keine/);
    expect(CATALOGS.sv['howto.tip2']).toMatch(/ersätter inte/);
  });

  it('bends the headline’s unit (1 luks, 3 luksy, 5 luksów) and keeps a no-break space before units', () => {
    expect(unit(1)).toBe('luks');
    expect(unit(3)).toBe('luksy');
    expect(unit(5)).toBe('luksów');
    expect(unit(22)).toBe('luksy');
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (typeof v !== 'string' || !k.startsWith('fact.')) continue;
        expect(v, `${l}.${k}`).not.toMatch(/\d (°C|mg|mmol|mm\b|m²|g(?=[\s.,;)]|$)|%|litr|Liter|liter|mln|Million|million|miljon)/);
      }
    }
  });
});

describe('mobile first (DESIGN §12, §13.10)', () => {
  const bands = (L: ReturnType<typeof layout>) => [0.06, 0.25, 0.45, 0.62, 0.95].map(v => L.fig.top + v * L.fig.H);

  it('gives every control a finger-sized target inside the insets, clear of the others, at every checked size and state', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const y of bands(L)) {
        for (const ph of [120, 180, 240, 400]) {
          const panel = panelRect(L, y, ph);
          const ts = tapTargets(L, { story: null, panel });
          expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}: panel ${ph} px at ${Math.round(y)}`).toEqual([]);
        }
      }
      const story = storyRect(L, 320);
      expect(auditTargets(tapTargets(L, { story, panel: null }), c.w, c.h, c.insets), `${c.name}: a story`).toEqual([]);
      expect(tapTargets(L, { story, panel: panelRect(L, L.fig.top, 150) }).map(x => x.label)).toEqual(['story']);
    }
  });

  it('puts the round button in the thumb zone of a phone upright, big and off the edges; the panel never reaches it', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.shape, c.name).toBe('tall');
      expect(L.u).toBeLessThanOrEqual(1.1);
      const b = L.buttonHit;
      expect(b.y).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
      expect(L.button.r * 2).toBeGreaterThanOrEqual(56);
      expect(b.x).toBeGreaterThanOrEqual(c.insets.left + 16 - 6.01);
      expect(b.x + b.w).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
      expect(b.y + b.h).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.01);
      for (const y of bands(L)) {
        const r = panelRect(L, y, 600);
        expect(r.y + r.h, c.name).toBeLessThanOrEqual(b.y - 6);
        expect(r.y).toBeGreaterThanOrEqual(c.insets.top);
        expect(r.w).toBeGreaterThanOrEqual(148);
      }
      // the figure stands in the band: crown under the HUD (and the sing-along line), soles over the bottom
      expect(L.fig.top).toBeGreaterThanOrEqual(L.line.y + L.line.h);
      expect(L.fig.top + L.fig.H).toBeLessThanOrEqual(c.h - c.insets.bottom);
      expect(L.fig.H).toBeGreaterThanOrEqual(300);
      // the figure's arms stay on screen and clear of the panel's column
      expect(L.fig.cx - FIG_HALF * L.fig.H).toBeGreaterThanOrEqual(0);
      expect(L.fig.cx + FIG_HALF * L.fig.H).toBeLessThanOrEqual(L.panel.x);
      expect(L.line.y).toBeGreaterThanOrEqual(c.insets.top);
    }
  });

  it('keeps Zofia’s bubble at the end of its column away from the band', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      const high = bubbleRect(L, L.fig.top + L.fig.H * 0.1, 90), low = bubbleRect(L, L.fig.top + L.fig.H * 0.9, 90);
      expect(high.y, c.name).toBeGreaterThan(low.y);
      for (const r of [high, low]) {
        expect(r.y).toBeGreaterThanOrEqual(c.insets.top);
        expect(r.y + r.h).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.01);
        expect(r.x).toBeGreaterThanOrEqual(c.insets.left);
        expect(r.x + r.w).toBeLessThanOrEqual(c.w - c.insets.right + 0.01);
      }
    }
  });

  it('lays a phone on its side out in three columns: the panel, the standing figure, the bubble and the button', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.shape).toBe('side');
      expect(L.panel.x + L.panel.w).toBeLessThanOrEqual(L.fig.cx - FIG_HALF * L.fig.H);
      expect(L.bubble.x).toBeGreaterThanOrEqual(L.fig.cx + FIG_HALF * L.fig.H);
      expect(L.buttonHit.x).toBeGreaterThan(L.fig.cx + FIG_HALF * L.fig.H);
      expect(L.panel.w).toBeGreaterThanOrEqual(170);
      expect(L.fig.H).toBeGreaterThanOrEqual(220);
    }
  });

  it('grows on a tablet and a desktop, never past 1.3: a tablet upright keeps the tall layout with a big figure', () => {
    for (const c of CHECK_SIZES.filter(x => Math.min(x.w, x.h) > 600)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.u).toBeGreaterThan(1);
      expect(L.u).toBeLessThanOrEqual(1.3);
      expect(L.shape, c.name).toBe(c.w > c.h ? 'wide' : 'tall');
      expect(L.panel.w).toBeGreaterThanOrEqual(240);
      if (L.shape === 'wide') expect(L.bubble.w).toBeGreaterThanOrEqual(240);
      // the figure takes most of the band's height
      expect(L.fig.H, c.name).toBeGreaterThanOrEqual(0.75 * (c.h - c.insets.top - c.insets.bottom - 40));
    }
  });

  it('maps the figure and finds the organ under a finger', () => {
    const L = layout(390, 564, CHECK_SIZES[1].insets);
    const h = figPt(L, 0.012, 0.268);
    expect(organAt((h.x - L.fig.cx) / L.fig.H, (h.y - L.fig.top) / L.fig.H)).toBe('heart');
    expect(organAt(-0.05, 0.39)).toBe('kidney');
    expect(organAt(0.168, 0.522)).toBe('skin');
    expect(organAt(0.3, 0.9)).toBeNull();
  });

  it('never draws text under 11 px: the font helper has a floor', () => {
    for (const px of [0, 3, 6.4, 8, 10.4, 10.99, 11, 12.3, 13, 30]) {
      const m = font(px).match(/(\d+(?:\.\d+)?)px/);
      expect(Number(m![1])).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    expect(fontPx(4)).toBe(MIN_TEXT);
    expect(MIN_READ).toBe(13);
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const v of Object.values(L.font)) expect(v).toBeGreaterThanOrEqual(MIN_TEXT);
      expect(L.font.bubble).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.caption).toBeGreaterThanOrEqual(MIN_READ);
    }
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus|enter/i;
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['howto.goal', 'howto.help', 'howto.card', 'coach.help', 'coach.card', 'coach.beat', 'coach.bubbles', 'coach.breath', 'story.tap', 'story.next']) {
        expect(c[k], `${l}.${k}`).toBeTypeOf('string');
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      expect(c['howto.keys'], `${l}.howto.keys`).toMatch(KEYS);
      expect(c['coach.help.keys'], `${l}.coach.help.keys`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
    expect(touch.tips!.at(-1)).toMatch(/nie zastępuje leczenia/);
    expect(coachText('help', true)).not.toMatch(KEYS);
    expect(coachText('help', false)).toMatch(KEYS);
  });
});

describe('the song (kit/song.ts)', () => {
  it('is a well-formed lullaby: the series’ refrain around two verses of its own, slow, with lines in the page’s language', () => {
    const s = buildSong();
    expect(songProblems(s)).toEqual([]);
    expect(s.bpm).toBeLessThanOrEqual(72);
    expect(s.beats).toBe(128);
    expect(s.lines.map(l => l.text)).toContain(t('song.a.1'));
    expect(s.lines.map(l => l.text)).toContain(t('song.b.4'));
    expect(s.lines.some(l => /Weź moc/.test(l.text))).toBe(true);
    // no snare or hat in a lullaby; the refrain keeps its kick as a heartbeat
    expect(s.parts.some(p => p.voice === 'snare' || p.voice === 'hat')).toBe(false);
    expect(s.parts.some(p => p.voice === 'lead' && p.layer === 1)).toBe(true);
    expect(s.parts.some(p => p.layer === 0)).toBe(true);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) for (const k of ['song.a.1', 'song.a.2', 'song.a.3', 'song.a.4', 'song.b.1', 'song.b.2', 'song.b.3', 'song.b.4']) {
      expect((CATALOGS[l] as Record<string, string>)[k].length, `${l}.${k}`).toBeLessThanOrEqual(44);
    }
  });
});
