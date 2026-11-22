import { describe, expect, it } from 'vitest';
import {
  ALL_PASSAGES, CLOSING, LAY_VERSES, LIFT_VERSES, MOMENTS, PLACES, PLACE_AT, ROOT, STEP_SIGNAL, nearestPlace,
} from '../src/arcade/dlonie/content';
import { CATALOGS, linesOf, t, unit, whoName } from '../src/arcade/dlonie/i18n';
import {
  addName, bestOf, cleanName, freshProgress, migrate, placeOf, removeName, setPlace, walkOf, type DlonieProgress,
} from '../src/arcade/dlonie/meta';
import { RULES, breathsFor, prayersFor, readSec } from '../src/arcade/dlonie/rules';
import { DlonieSim, Smooth, growMult, type SimEvent } from '../src/arcade/dlonie/sim';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CHECK_SIZES, MIN_TAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { CTRLS, hitTest, layout, pickerRect, scene, storyRect, tapTargets } from '../src/arcade/dlonie/layout';
import { coachText, howto } from '../src/arcade/dlonie/index';
import { CATALOGS as ARCADE_CATALOGS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS } from '../src/i18n/arcade-mouse';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 12, calm: 0.05 });
const LOW = frame({ level: 0.2, activity: -1, focused: false, calm: 0.7 });
const NONE = frame({ reliable: false, activity: null, level: 0, focused: false, calm: 0 });
const CALM = frame({ level: 0.15, activity: -2, focused: false, calm: 0.8 });

const ALL_SEEN = ['s.open', 'c.rub', 'c.breathe', 'c.ball', 'c.who', 'c.offer', 'c.lay', 'c.blind'];

type SimOpts = { progress?: Partial<DlonieProgress>; planned?: number; seed?: number; mouse?: boolean; eeg?: boolean };

function makeSim(o: SimOpts = {}): DlonieSim {
  const p = { ...freshProgress(), ...o.progress };
  const sim = new DlonieSim({ progress: p, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false, tuning: TUNING, mouse: o.mouse });
  sim.start();
  return sim;
}

/** A returning player (no opening card, no coach marks, not yet blind). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: DlonieSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: () => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    each?.();
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Focus in a push, calm in rest (a strong player). */
const ideal = (sim: DlonieSim) => () => (sim.restBlock ? CALM : HIGH);
/** An average player: in a push, focused 6 s out of every 10 at a moderate level; calm-ish in rest. */
const average = (sim: DlonieSim) => (t: number) => {
  if (sim.restBlock) return frame({ level: 0.3, activity: 0.5, focused: false, calm: 0.6 });
  const k = t % 10;
  return k < 6 ? frame({ level: 0.6, activity: 3, focused: true, hold: k, calm: 0.2 }) : frame({ level: 0.35, activity: 1, focused: false, calm: 0.4 });
};

/** Run a whole session; the times (s) each prayer was offered. */
function session(sim: DlonieSim, player: (sim: DlonieSim) => (t: number) => FocusFrame, clock = { t: 0 }): { offered: number[]; evs: SimEvent[] } {
  const offered: number[] = [];
  const evs: SimEvent[] = [];
  const f = player(sim);
  const n = Math.round((sim.plannedSec + 6) / STEP);
  for (let i = 0; i < n && sim.phase !== 'done'; i++) {
    clock.t += STEP;
    sim.update(STEP, f(clock.t), clock.t);
    for (const e of sim.take()) {
      evs.push(e);
      if (e.type === 'offered') offered.push(clock.t);
    }
  }
  return { offered, evs };
}

describe('content, the walk and the progress (content.ts, meta.ts)', () => {
  it('lays the six places on the shared figure, from the head down, and finds the nearest one', () => {
    expect(PLACES).toEqual(['head', 'throat', 'chest', 'belly', 'back', 'joint']);
    const y = (k: typeof PLACES[number]) => PLACE_AT[k][1];
    expect(y('head')).toBeLessThan(y('throat'));
    expect(y('throat')).toBeLessThan(y('chest'));
    expect(y('chest')).toBeLessThan(y('back'));
    expect(y('back')).toBeLessThan(y('belly'));
    expect(y('belly')).toBeLessThan(y('joint'));
    for (const p of PLACES) expect(nearestPlace(PLACE_AT[p][0], PLACE_AT[p][1])).toBe(p);
    expect(nearestPlace(0.3, 0.9)).toBeNull();
  });

  it('walks someone dear → me → the world without names, the names → me → the world with them', () => {
    const p = freshProgress();
    expect(walkOf(p).map(w => w.kind)).toEqual(['dear', 'self', 'world']);
    expect(addName(p, '  Anna  ')).toBe(true);
    expect(addName(p, 'anna')).toBe(false);
    expect(addName(p, 'Marek')).toBe(true);
    expect(walkOf(p).map(w => w.kind)).toEqual(['name', 'name', 'self', 'world']);
    expect(whoName(p, walkOf(p)[1])).toBe('Marek');
    // a prayer for oneself lays a hand (the chest unless chosen); a name with a place too; the rest are lifted up
    expect(placeOf(p, { kind: 'self', i: 0 })).toBe('chest');
    expect(placeOf(p, { kind: 'name', i: 0 })).toBeNull();
    expect(setPlace(p, 0, 'head')).toBe(true);
    expect(placeOf(p, { kind: 'name', i: 0 })).toBe('head');
    expect(placeOf(p, { kind: 'world', i: 0 })).toBeNull();
    expect(setPlace(p, -1, 'joint')).toBe(true);
    expect(placeOf(p, { kind: 'self', i: 0 })).toBe('joint');
    expect(removeName(p, 0)).toBe(true);
    expect(p.names.map(n => n.name)).toEqual(['Marek']);
  });

  it('keeps names short, plain and at most twelve', () => {
    expect(cleanName('  a\u0007b <c>\n d ')).toBe('a b c d');
    expect([...cleanName('x'.repeat(80))].length).toBe(RULES.nameLen);
    const p = freshProgress();
    for (let i = 0; i < 15; i++) addName(p, `N${i}`);
    expect(p.names).toHaveLength(RULES.namesMax);
  });

  it('survives garbage and a wrong version', () => {
    const p = { ver: 1, sessions: 'x', names: [{ name: 'Ola', place: 'nose' }, 5, { name: '' }], walk: 99, carry: { grow: 3, rise: -1 }, breath: 'fast', offered: null, best: { 600: -4, 300: 12 } } as unknown as DlonieProgress;
    migrate(p);
    expect(p.sessions).toBe(0);
    expect(p.names).toEqual([{ name: 'Ola', place: null }]);
    expect(p.walk).toBeLessThan(walkOf(p).length);
    expect(p.carry).toEqual({ grow: 1, rise: 0 });
    expect(p.breath).toBe('even');
    expect(p.offered).toEqual({ others: 0, self: 0, world: 0 });
    expect(bestOf(p)).toBe(12);
    const q = { ver: 7, hello: 1 } as unknown as DlonieProgress;
    expect(migrate(q)).toEqual(freshProgress());
    expect(migrate(migrate(freshProgress()))).toEqual(freshProgress());
  });

  it('names every passage it reads, each of them real', () => {
    expect(ROOT).toBe('psa141.2');
    expect(LAY_VERSES).toEqual(['jer17.14', 'jas5.16', 'mrk10.16']);
    expect(CLOSING).toEqual(['mat5.14-16', 'psa134.2']);
    expect(LIFT_VERSES).toContain('psa141.2');
    for (const id of ALL_PASSAGES) expect(passage(id).text.length, id).toBeGreaterThan(10);
  });
});

describe('the length of a session (DESIGN §17)', () => {
  it('holds 2 prayers in 3 minutes, 4 in 10, 11 in 30; long sessions breathe deeper', () => {
    expect([180, 300, 600, 900, 1200, 1500, 1800].map(prayersFor)).toEqual([2, 3, 4, 6, 8, 9, 11]);
    expect(prayersFor(40)).toBe(1);
    expect(breathsFor(180).rest).toBeLessThan(breathsFor(600).rest);
    expect(breathsFor(600).rest).toBeLessThan(breathsFor(1800).rest);
    expect(breathsFor(1800).breathe).toBeGreaterThan(breathsFor(180).breathe);
  });

  for (const [min, planned] of [[3, 180], [5, 300], [10, 600], [30, 1800]] as const) {
    it(`walks an average player through ${min} minutes: the arc ends near the end, not at 40 %`, () => {
      const sim = later({ planned, seed: 3 });
      const { offered } = session(sim, average);
      const n = prayersFor(planned);
      expect(offered.length).toBeGreaterThanOrEqual(n - 1);
      expect(offered.length).toBeLessThanOrEqual(n + 1);
      const last = offered[offered.length - 1];
      expect(last / planned).toBeGreaterThan(0.7);
      expect(last / planned).toBeLessThan(0.98);
      // the arc is spread out: by 40 % of the session no more than half of it was offered
      expect(offered.filter(x => x <= 0.4 * planned).length).toBeLessThanOrEqual(Math.ceil(n / 2));
      expect(sim.phase).toBe('done');
      expect(sim.result().score).toBeGreaterThan(0);
    });
  }

  it('lets a strong player pray more, never ends the session early, and keeps the summary to one line per kind', () => {
    const sim = later({ planned: 600, seed: 4, progress: { names: [{ name: 'Anna', place: null }, { name: 'Jan', place: 'head' }] } });
    const { offered } = session(sim, ideal);
    expect(offered.length).toBeGreaterThanOrEqual(prayersFor(600));
    expect(sim.t).toBeGreaterThanOrEqual(600);
    const r = sim.result();
    const all = JSON.stringify(r);
    expect(all).not.toContain('Anna');
    expect(all).not.toContain('Jan');
    const line = r.stats.find(([k]) => k === t('stat.prayers'))![1];
    expect(line.split(' · ').length).toBeLessThanOrEqual(3);
  });

  it('keeps every collection bounded and every step in its bounds for half an hour, even when focus never comes', () => {
    const sim = later({ planned: 1800, seed: 5 });
    const { offered, evs } = session(sim, () => () => LOW);
    expect(offered).toEqual([]);
    expect(sim.grow).toBe(0);
    for (const b of sim.blocks) if (b.kind === 'push' && b.end !== undefined) expect(b.end - b.t0).toBeLessThanOrEqual(RULES.maxPush + 0.1);
    expect(sim.blocks.length).toBeLessThan(200);
    expect(sim.talk.said.length).toBeLessThan(300);
    expect(ofType(evs, 'done')).toHaveLength(1);
    expect(sim.result().highlights.length).toBeLessThanOrEqual(5);
  });
});

describe('light only from real focus (the series’ rule)', () => {
  it('grows nothing without focus — below the threshold, without a signal, in rest — and never goes back', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 40, () => (sim.restBlock ? CALM : LOW), clock);
    expect(sim.step).toBe('ball');
    expect(sim.grow).toBe(0);
    drive(sim, 8, HIGH, clock);
    const g = sim.grow;
    expect(g).toBeGreaterThan(0);
    let min = Infinity;
    drive(sim, 15, NONE, clock, () => { min = Math.min(min, sim.grow); });
    expect(min).toBeCloseTo(g, 9);
    drive(sim, 5, LOW, clock);
    expect(sim.grow).toBeCloseTo(g, 9);
  });

  it('shows the growth through a 10 s average: never past the real growth, never back, and the 0.1 Hz wave stays out', () => {
    const s = new Smooth();
    let real = 0, last = 0;
    const shownRate: number[] = [];
    for (let i = 0; i < 60 / STEP; i++) {
      const tt = i * STEP;
      // the rate swings with a 10 s period (a Mayer wave riding on held focus)
      const dg = (0.02 + 0.018 * Math.sin((2 * Math.PI * tt) / 10)) * STEP;
      real += dg;
      const v = s.step(STEP, dg, real);
      expect(v).toBeLessThanOrEqual(real + 1e-12);
      expect(v).toBeGreaterThanOrEqual(last - 1e-12);
      if (tt > 20) shownRate.push((v - last) / STEP);
      last = v;
    }
    const lo = Math.min(...shownRate), hi = Math.max(...shownRate);
    // the real rate swings ±90 %; the shown one stays within a few per cent of the mean
    expect((hi - lo) / 0.02).toBeLessThan(0.1);
  });

  it('grows the ball with held focus, faster in strong focus, after the 5 s lead-in (2 s with HALO)', () => {
    expect(growMult({ level: 1, hold: 30 })).toBeCloseTo(1.5);
    expect(growMult({ level: 0.5, hold: 0 })).toBeCloseTo(1);
    for (const [eeg, lead] of [[false, 5], [true, 2]] as const) {
      const sim = later({ planned: 600, eeg });
      const clock = { t: 0 };
      drive(sim, 60, () => (sim.step === 'ball' ? LOW : CALM), clock);
      expect(sim.step).toBe('ball');
      const t0 = sim.stepT;
      drive(sim, Math.max(0, lead - t0 - 0.2), HIGH, clock);
      expect(sim.grow).toBe(0);
      drive(sim, 1, HIGH, clock);
      expect(sim.grow).toBeGreaterThan(0);
    }
  });

  it('the hands never grow anything: taps, Space, choosing and the picker add no light', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 50, () => (sim.restBlock ? CALM : LOW), clock);
    for (let i = 0; i < 20; i++) {
      sim.stay(); sim.next(); sim.prev(); sim.openPicker(); sim.pick(1); sim.key(' ', true); sim.key('ArrowRight', true);
      drive(sim, 0.5, LOW, clock);
    }
    expect(sim.grow).toBe(0);
    expect(sim.rise).toBe(0);
  });
});

describe('one prayer: rub, breathe, ball, name, offer, rest', () => {
  it('walks the steps in order, each with its signal, and the next prayer begins with the rub', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, 260, ideal(sim));
    const steps = ofType(evs, 'step').map(e => e.step);
    expect(steps.slice(0, 8)).toEqual(['rub', 'breathe', 'ball', 'name', 'offer', 'rest', 'rub', 'breathe']);
    expect(STEP_SIGNAL).toMatchObject({ rub: 'free', breathe: 'rest', ball: 'focus', name: 'rest', offer: 'focus', rest: 'rest', wait: 'rest' });
    expect(ofType(evs, 'spark').length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'grown').length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'named').length).toBeGreaterThanOrEqual(1);
  });

  it('rests in whole breaths of the chosen pattern, each from an in-breath (5 · 5 by default, 4 · 6 calm)', () => {
    for (const [breath, cyc] of [['even', 10], ['calm', 10]] as const) {
      const sim = later({ planned: 600, progress: { breath } });
      expect(sim.cycle).toBe(cyc);
      const evs = drive(sim, 400, ideal(sim));
      const rests = sim.blocks.filter(b => b.kind === 'rest' && b.end !== undefined);
      expect(rests.length).toBeGreaterThan(3);
      for (const b of rests) expect(b.dur % cyc).toBeCloseTo(0, 6);
      expect(ofType(evs, 'breath')[0].phase).toBe('in');
    }
  });

  it('ends a push that cannot finish after maxPush with a rest, then the same step again — nothing lost', () => {
    const sim = later({ planned: 900 });
    const clock = { t: 0 };
    drive(sim, 40, () => (sim.restBlock ? CALM : LOW), clock);
    expect(sim.step).toBe('ball');
    drive(sim, 3, HIGH, clock);
    drive(sim, 7, HIGH, clock);
    const g = sim.grow;
    const evs = drive(sim, RULES.maxPush, LOW, clock);
    expect(ofType(evs, 'step').map(e => e.step)).toContain('wait');
    expect(sim.grow).toBeCloseTo(g, 9);
    drive(sim, RULES.waitBreaths * sim.cycle + 0.5, CALM, clock);
    expect(sim.step).toBe('ball');
    expect(sim.grow).toBeCloseTo(g, 9);
  });

  it('lifts a prayer for someone into the light, lays one for oneself where it hurts, and reads the right passage', () => {
    const sim = later({ planned: 900, progress: { walk: 0 } });
    const clock = { t: 0 };
    const evs = drive(sim, 120, ideal(sim), clock);
    const first = ofType(evs, 'offered')[0];
    expect(first).toMatchObject({ lay: false, tally: 'others' });
    expect(LIFT_VERSES).toContain(sim.verse);
    // the walk goes on to oneself: a hand laid on the chosen place
    const evs2 = drive(sim, 160, ideal(sim), clock);
    const second = ofType(evs2, 'offered')[0];
    expect(second).toMatchObject({ lay: true, tally: 'self', place: 'chest' });
  });

  it('chooses whom with ◀ ▶ and the picker until the prayer is offered, then the next prayer’s; a tap on the figure moves the hand', () => {
    const sim = later({ planned: 900, progress: { names: [{ name: 'Ola', place: null }, { name: 'Piotr', place: null }] } });
    expect(sim.who).toEqual({ kind: 'name', i: 0 });
    expect(sim.next()).toBe(true);
    expect(sim.who).toEqual({ kind: 'name', i: 1 });
    expect(sim.openPicker()).toBe(true);
    expect(sim.pick(2)).toBe(true);
    expect(sim.picker).toBe(false);
    expect(sim.who.kind).toBe('self');
    expect(sim.lay).toBe(true);
    expect(sim.setPlace('throat')).toBe(true);
    expect(sim.p.selfPlace).toBe('throat');
    expect(sim.prev()).toBe(true);
    expect(sim.lay).toBe(false);
    expect(sim.setPlace('head')).toBe(false);
    // offered: the hands now choose the next prayer, and this one keeps its name
    const clock = { t: 0 };
    drive(sim, 200, ideal(sim), clock, () => { if (sim.offeredNow) clock.t = clock.t; });
    let tries = 0;
    while (!sim.offeredNow && tries++ < 3000) drive(sim, STEP, ideal(sim), clock);
    expect(sim.offeredNow).toBe(true);
    const who = sim.who;
    const nextBefore = sim.p.walk;
    expect(sim.next()).toBe(true);
    expect(sim.who).toEqual(who);
    expect(sim.p.walk).not.toBe(nextBefore);
  });

  it('opens a first-ever session with the opening card; the rub waits under it; a tap closes it', () => {
    const sim = makeSim({ planned: 600 });
    expect(sim.story).not.toBeNull();
    drive(sim, 5, LOW);
    expect(sim.step).toBe('rub');
    expect(sim.stepT).toBe(0);
    expect(sim.signal().want).toBe('free');
    sim.stay();
    expect(sim.story).toBeNull();
    drive(sim, RULES.rubFirst + 0.5, LOW);
    expect(sim.step).toBe('breathe');
  });

  it('makes every 3rd ball blind from the 3rd session (never a session’s first): no gauge, shown at the end', () => {
    const sim = later({ planned: 1200, progress: { sessions: 4, balls: 1 } });
    const clock = { t: 0 };
    let sawBlind = false, meterWhileBlind: (number | null)[] = [];
    const evs = drive(sim, 600, ideal(sim), clock, () => {
      if (sim.blind) { sawBlind = true; meterWhileBlind.push(sim.meter()); }
    });
    expect(sawBlind).toBe(true);
    expect(meterWhileBlind.every(m => m === null)).toBe(true);
    expect(ofType(evs, 'blindEnd').length).toBeGreaterThanOrEqual(1);
    const balls = sim.blocks.filter(b => b.step === 'ball');
    expect(balls[0].blind).toBe(false);
    meterWhileBlind = [];
  });

  it('keeps an unfinished prayer for the next session, with what focus grew', () => {
    const p = { ...freshProgress(), sessions: 1, seen: [...ALL_SEEN] };
    const a = new DlonieSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: false, tuning: TUNING });
    a.start();
    const clock = { t: 0 };
    drive(a, 30, () => (a.restBlock ? CALM : LOW), clock);
    drive(a, 9, HIGH, clock);
    a.finish();
    expect(p.carry).not.toBeNull();
    const kept = p.carry!.grow;
    expect(kept).toBeGreaterThan(0);
    const b = new DlonieSim({ progress: p, rng: mulberry32(3), plannedSec: 180, eeg: false, tuning: TUNING });
    b.start();
    expect(b.grow).toBeCloseTo(kept, 9);
    expect(b.growShown).toBeCloseTo(kept, 9);
  });

  it('scores with the smoke test’s crude input (focus on, a centre tap every 0.65 s, Space now and then): flames within 25 s', () => {
    const sim = makeSim({ planned: 120 });
    const clock = { t: 0 };
    let n = 0, at = -1;
    drive(sim, 40, () => frame({ level: 0.75, activity: 4, focused: true, hold: 5, calm: 0.1 }), clock, () => {
      n++;
      if (n % 20 === 0) sim.stay();
      if (n % 60 === 0) sim.key(' ', true);
      if (at < 0 && sim.score > 0) at = clock.t;
    });
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(25);
  });

  it('gives result() idempotently, the record with Math.max, a closing passage in turn', () => {
    const sim = later({ planned: 180 });
    session(sim, ideal);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(CLOSING).toContain(a.verse);
    expect(sim.p.best['180']).toBe(a.score);
    expect(unit(1)).not.toBe(unit(5));
  });
});

describe('the words', () => {
  it('says what to do now in one short line, the breath and its count in a rest', () => {
    const sim = later({ planned: 600 });
    const seen = new Set<string>();
    drive(sim, 200, ideal(sim), { t: 0 }, () => { const n = sim.doNow(); if (n) seen.add(n.text); });
    expect(seen.size).toBeGreaterThan(5);
    for (const s of seen) expect(s.length, s).toBeLessThanOrEqual(48);
    expect([...seen].some(s => /^Spoczynek · (wdech|wydech) · oddech \d z \d$/.test(s))).toBe(true);
  });

  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator two lines a moment, each fitting one line (90 characters), readable long enough', () => {
    for (const m of MOMENTS) expect(linesOf(m).length, m).toBe(2);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
    expect(readSec('x'.repeat(10))).toBe(RULES.readMin);
  });

  it('keeps the forbidden words out in every language: light and prayer, never energy, healing power, chakras', () => {
    const FORBID: Record<string, RegExp> = {
      pl: /energi|uzdrawia|leczy|czakr|kundalini|w[ąę]ż|węż/i,
      en: /energy|heal(s|ing)? power|\bcures?\b|chakra|kundalini|serpent/i,
      de: /energie|heilt|chakra|kundalini|schlange/i,
      sv: /energi|\bhelar\b|chakra|kundalini|\borm(ar|en)?\b/i,
    };
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v as Record<string, string>);
        for (const s of texts) expect(FORBID[l].test(s), `${l}.${k}: ${s}`).toBe(false);
      }
      // the lobby's own lines (the registry's dlonie.* keys and their mouse twins); the origin note — the lobby
      // text's last sentence, the one place the tradition's own term may stand — is left out of the scope by key
      const lobby = Object.entries(ARCADE_CATALOGS[l]).filter(([k]) => k.startsWith('dlonie.'));
      expect(lobby.length).toBeGreaterThan(10);
      for (const [k, v] of lobby) {
        const s = typeof v === 'string' ? v : Object.values(v as unknown as Record<string, string>).join(' ');
        const scope = k === 'dlonie.text' ? s.split(/(?<=[.!?])\s+/).slice(0, -1).join(' ') : s;
        expect(FORBID[l].test(scope), `${l}.${k}: ${scope}`).toBe(false);
      }
      for (const [k, v] of Object.entries(MOUSE_CATALOGS[l]).filter(([key]) => key.startsWith('dlonie.'))) expect(FORBID[l].test(String(v)), `${l}.${k}`).toBe(false);
    }
    // and the verbs the series avoids: channel, send, activate, generate
    for (const [k, v] of Object.entries(CATALOGS.en)) if (typeof v === 'string') expect(/\b(channel|activat|generat)/i.test(v), k).toBe(false);
  });

  it('keeps Polish out of the other languages, prays through Jesus Christ in the Spirit, and the last tip says what this is', () => {
    const POLISH = /[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(się|albo|oraz)\b/;
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (typeof v === 'string') expect(POLISH.test(v), `${l}.${k}`).toBe(false);
    }
    expect(CATALOGS.pl['pray.name']).toContain('Jezusa Chrystusa');
    expect(CATALOGS.pl['pray.name']).toContain('Duchu Świętym');
    expect(CATALOGS.de['pray.name']).toContain('Heiligen Geist');
    expect(CATALOGS.pl['howto.tip2']).toMatch(/uwag/);
    expect(CATALOGS.en['howto.tip2']).toMatch(/does not replace/);
    expect(JSON.stringify(CATALOGS)).not.toMatch(/Gott mit uns/);
  });
});

describe('mobile first and the desk (DESIGN §12, §14)', () => {
  const desks = CHECK_SIZES.filter(c => c.w >= 1000);

  it('gives every control a finger-sized target inside the insets, clear of the others, at every size — the list of 14, the card, the figure', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        const sc = scene(L, 1);
        const fig = { x: sc.fig.x - 6, y: sc.fig.y - 4, w: Math.max(44, sc.fig.w + 12), h: sc.fig.h + 8 };
        const states = [
          { story: null, picker: null, fig: null },
          { story: null, picker: null, fig },
          { story: null, picker: 3, fig: null },
          { story: null, picker: 14, fig: null },
          { story: storyRect(L, 300), picker: null, fig: null },
        ];
        for (const s of states) expect(auditTargets(tapTargets(L, s), c.w, c.h, L.ins, MIN_TAP), `${c.name} ${touch ? 'touch' : 'mouse'} ${JSON.stringify(s.picker)}`).toEqual([]);
      }
    }
  });

  it('puts the buttons in the thumb zone of an upright phone, below the hands’ light, and hit-tests them', () => {
    for (const c of CHECK_SIZES.filter(x => x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets, true);
      expect(L.shape).toBe('tall');
      for (const id of CTRLS) {
        const b = L.ctrl[id];
        expect(b.y, `${c.name} ${id}`).toBeGreaterThan(c.h * (1 - THUMB));
        expect(hitTest(L, { story: null, picker: null, fig: null }, b.x, b.y)).toEqual({ kind: 'ctrl', id });
      }
      const sc = scene(L);
      // the ball between the palms clears the buttons; the hands fill the lower part
      expect(sc.ballY + sc.R, c.name).toBeLessThan(L.ctrl.menu.hit.y + 4);
      expect(sc.L, c.name).toBeGreaterThan(70);
      expect(sc.lightY).toBeGreaterThan(L.top);
      expect(sc.lightY).toBeLessThan(sc.ballY);
    }
  });

  it('keeps the words readable: the name large, the text 13 px and more, a passage’s reference never under 11', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        expect(L.font.text, c.name).toBeGreaterThanOrEqual(13);
        expect(L.font.small, c.name).toBeGreaterThanOrEqual(13);
        expect(L.font.cap, c.name).toBeGreaterThanOrEqual(12);
        expect(L.font.name, c.name).toBeGreaterThanOrEqual(22);
        expect(L.words.w, c.name).toBeGreaterThan(180);
      }
    }
  });

  it('lays a desk out in three columns with the keys’ names; a small figure fits beside the hands when a hand is laid', () => {
    for (const c of desks) {
      const L = layout(c.w, c.h, c.insets, false);
      expect(L.shape).toBe('desk');
      expect(L.keys).toBe(true);
      expect(L.words.x + L.words.w).toBeLessThanOrEqual(L.stage.x);
      expect(L.ctrl.menu.x).toBeGreaterThan(L.stage.x + L.stage.w);
      const sc = scene(L, 1);
      expect(sc.fig.x + sc.fig.w).toBeLessThanOrEqual(L.stage.x + L.stage.w + 1);
      expect(sc.fig.w).toBeGreaterThanOrEqual(44);
    }
    // a narrow desktop window keeps the phone's shapes
    expect(layout(700, 800, undefined, false).shape).toBe('tall');
  });

  it('opens the picker as a grid that fits the band, and the opening card inside it', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      const P = pickerRect(L, 14);
      expect(P.box.y + P.box.h, c.name).toBeLessThanOrEqual(L.bottom + 0.5);
      expect(P.box.y, c.name).toBeGreaterThanOrEqual(L.top - 0.5);
      const r = storyRect(L, 2000);
      expect(r.y + r.h).toBeLessThanOrEqual(L.bottom);
    }
  });

  it('speaks to a mouse in clicks and to a finger in taps, never of keys to a finger', () => {
    expect(coachText('who', true)).not.toMatch(/klikn|←/i);
    expect(coachText('who', false)).toMatch(/Klikn/);
    const hTouch = howto(true), hMouse = howto(false);
    expect(hTouch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(hMouse.hands.some(x => x.gesture === 'keys')).toBe(true);
    expect(hTouch.tips?.length).toBe(2);
  });
});
