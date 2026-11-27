// @vitest-environment happy-dom
/**
 * Złota passa (builder A's half, DESIGN.md §26): the plan, the day (only focus turns a card; a card not turned is
 * carried, never counted; a heavy moment only when asked for, named first, trust always offered and a win), the
 * player's own moments (first, never in the result), the day-streak with its grace across month and year ends, the
 * progress (fresh, broken, hostile saves), the words in four languages (complete, the forbidden words out, no gendered
 * Polish second person, every passage in four editions), the choices at every checked size, the registry, the lobby's
 * card.  Builder B's half (the street, the layout, the sound) has its own tests.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_TAP, auditTargets } from '../src/arcade/kit/mobile';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { ALL_VERSES, HEAVIES, JOYS, ROOT, SAYS, SETS, SNAGS, VERSES, verseFor } from '../src/arcade/passa/content';
import { aboveCard, choiceAt, choiceTargets } from '../src/arcade/passa/hud';
import { CATALOGS, linesOf, signText, t, unit, type Key } from '../src/arcade/passa/i18n';
import mod, { howto, passaRhythm } from '../src/arcade/passa/index';
import { cardFor, choiceRects, layout } from '../src/arcade/passa/layout';
import { addOwn, editOwn, forgetOwn, freshProgress, migrate, removeOwn, type PassaProgress } from '../src/arcade/passa/meta';
import { HEAVY_MAX, MOTIFS } from '../src/arcade/passa/moments';
import { forecastLines, progressPanel, streakLine } from '../src/arcade/passa/panel';
import {
  RULES, daysBetween, designFor, focusRate, graceFree, needFor, planFor, readTime, restInFor, streakAfter, streakNow,
  type BlockWhat, type Plan, type Streak,
} from '../src/arcade/passa/rules';
import { OWN_WINS, SET_TEXTS, TRUST } from '../src/arcade/passa/sets';
import { PassaSim, labelsOf, type SimEvent } from '../src/arcade/passa/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, LANGS, type Lang } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { ARCADE, arcadeEntry } from '../src/arcade/registry';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const DAY = '2026-11-26';
const LENGTHS = SESSION_MINUTES.map(m => m * 60);

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
/** the average player: a little above the threshold, held a while */
const AVG = frame({ level: 0.62, activity: 3, focused: true, hold: 6, calm: 0.2 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });
const UNRELIABLE = frame({ reliable: false, level: 0.9, activity: null, focused: true, hold: 14 });

type Opts = { progress?: Partial<PassaProgress>; planned?: number; seed?: number; eeg?: boolean; first?: boolean; day?: string; rhythm?: { focus: number; rest: number; custom: boolean } | null };

function makeSim(o: Opts = {}): PassaSim {
  const base: PassaProgress = o.first ? freshProgress() : { ...freshProgress(), sessions: 4, seen: ['c.turn', 'c.choose', 'c.savor', 'c.carry'] };
  const progress = { ...base, ...o.progress } as PassaProgress;
  const sim = new PassaSim({
    progress, rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null, day: o.day ?? DAY,
  });
  sim.start();
  return sim;
}

type FrameFn = (t: number, sim: PassaSim) => FocusFrame;
/** Play `sec` seconds with the frame given (or a function of the time and the sim). */
function drive(sim: PassaSim, sec: number, f: FocusFrame | FrameFn, clock = { t: 0 }, out: SimEvent[] = []): SimEvent[] {
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}
/** Play the whole session (to T and a second past). */
const play = (sim: PassaSim, f: FocusFrame | FrameFn, out: SimEvent[] = []): SimEvent[] => drive(sim, sim.T + 1, f, { t: 0 }, out);
/** A player who focuses in the pushes with `push` and rests elsewhere. */
const player = (push: FocusFrame): FrameFn => (_t, s) => (s.pushBlock ? push : LOW);
/** app:smoke's simulator: focus on about half the time (2 s on, 2 s off). */
const HALF: FrameFn = (t, s) => (s.pushBlock && Math.floor(t / 2) % 2 === 0 ? AVG : LOW);
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

const SHAPE: Readonly<Record<BlockWhat, string>> = { intro: 'I', arrive: 'a', name: 'n', turn: 't', after: 'r', garland: 'G', prayer: 'P', close: 'C' };
const shapeOf = (p: Plan): string => p.blocks.map(b => SHAPE[b.what]).join('');

describe('Złota passa — the plan', () => {
  it('fills every length 3–30 min and a ≤ 60 s test: blocks contiguous, in order, ending at T, rests in whole breaths', () => {
    for (const T of [...LENGTHS, 40, 60]) for (const eeg of [false, true]) for (const heavy of [false, true]) for (const first of [false, true]) {
      const p = planFor({ plannedSec: T, eeg, heavy, first });
      const name = `${T} s ${eeg ? 'eeg' : 'fnirs'} heavy=${heavy} first=${first}`;
      expect(p.blocks[0].t0).toBe(0);
      for (let i = 1; i < p.blocks.length; i++) expect(Math.abs(p.blocks[i].t0 - p.blocks[i - 1].t1), name).toBeLessThan(1e-9);
      for (const b of p.blocks) expect(b.t1, name).toBeGreaterThan(b.t0);
      expect(Math.abs(p.blocks[p.blocks.length - 1].t1 - T), name).toBeLessThan(1e-6);
      // the intro, each moment (arrive, [name,] turn, after), the evening
      const moments = Array.from({ length: p.n }, (_, i) => (i === p.heavyAt ? 'antr' : 'atr')).join('');
      expect(shapeOf(p), name).toBe(`I${moments}G${p.test ? '' : 'P'}C`);
      for (const b of p.blocks) expect(b.kind, `${name} ${b.what}`).toBe(b.what === 'turn' ? 'push' : b.what === 'intro' || b.what === 'arrive' || b.what === 'close' ? 'free' : 'rest');
      if (p.test) {
        // one moment whose push sees well past the lead-in
        expect(p.n).toBe(1);
        expect(p.heavyAt).toBe(-1);
        expect(p.push - p.lead, name).toBeGreaterThanOrEqual(12);
        continue;
      }
      for (const b of p.blocks) {
        if (b.kind === 'rest') expect((b.t1 - b.t0) / p.cyc, `${name} ${b.what}`).toBeCloseTo(Math.round((b.t1 - b.t0) / p.cyc), 9);
        if (b.what === 'turn') expect(b.t1 - b.t0 - p.lead, name).toBeGreaterThanOrEqual(RULES.pushMinSighted);
      }
      expect(T - p.prayerEnd, name).toBeGreaterThanOrEqual(Math.min(RULES.closeMin, 0.4 * (T - p.eveningStart)) - 1e-6);
      // more moments with more time; a heavy one only when asked, never the first nor the last
      expect(p.n, name).toBeGreaterThanOrEqual(3);
      if (!heavy) expect(p.heavyAt).toBe(-1);
      else {
        expect(p.heavyAt, name).toBeGreaterThanOrEqual(1);
        expect(p.heavyAt, name).toBeLessThanOrEqual(p.n - 2);
      }
      // the evening gets what the moments leave: never a moment's worth more than its frame
      const eve = T - p.eveningStart;
      expect(eve, name).toBeGreaterThanOrEqual(RULES.evening.min - 1e-6);
    }
    const n = LENGTHS.map(T => planFor({ plannedSec: T, eeg: false }).n);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeGreaterThanOrEqual(n[i - 1] - 1);
    expect(n[0]).toBe(4);
    expect(n[n.length - 1]).toBeGreaterThanOrEqual(20);
  });

  it('keeps the player’s dials (and says what a session keeps), and by design lengthens them with the session', () => {
    // (up to half an hour; past it a rhythm that would hold more than momentsMax moments is lengthened: '45–60 minutes')
    for (const T of LENGTHS.filter(s => s <= RULES.stretchFrom)) for (const focus of [15, 20, 30, 40]) for (const rest of [1, 2, 3, 4]) {
      const p = planFor({ plannedSec: T, eeg: false, focus, rest, custom: true });
      expect(p.push, `${T} ${focus}/${rest}`).toBe(focus);
      expect(p.breaths, `${T} ${focus}/${rest}`).toBe(rest);
      expect(restInFor(focus, rest, T)).toBe(rest);
      for (const b of p.blocks.filter(x => x.what === 'after')) expect(b.t1 - b.t0).toBeCloseTo(rest * RULES.cyc, 9);
    }
    expect(designFor(180)).toEqual({ push: 20, breaths: 1 });
    expect(designFor(600)).toEqual({ push: 20, breaths: 2 });
    expect(designFor(1200)).toEqual({ push: 25, breaths: 2 });
    expect(designFor(1800)).toEqual({ push: 30, breaths: 3 });
    // out-of-range dials are clamped to the dial's range
    const p = planFor({ plannedSec: 300, eeg: false, focus: 99, rest: 0, custom: true });
    expect(p.push).toBe(RULES.focus.max);
    expect(p.breaths).toBe(RULES.rest.min);
    // the lobby's rhythm: 20 s and 1 breath by design, the ranges, restIn
    const r = passaRhythm();
    expect([r.focus.def, r.focus.min, r.focus.max, r.focus.step]).toEqual([20, 15, 40, 5]);
    expect([r.rest.def, r.rest.min, r.rest.max]).toEqual([1, 1, 4]);
    expect(r.restIn!({ focus: 40, rest: 4 }, 180)).toBe(4);
  });

  it('asks the average player to turn a card near the window’s end; a first-ever first card half, a test 0.4', () => {
    const P = planFor({ plannedSec: 300, eeg: false });
    const need = needFor(P.push, P.lead);
    expect(need).toBeCloseTo(0.75 * (20 - 5) * 0.85, 9);
    // the average player's rate over the sighted part fills it before the end
    const rate = focusRate(0.62, true, 6);
    expect(rate * (P.push - P.lead)).toBeGreaterThan(need);
    expect(rate * (P.push - P.lead) * 0.75).toBeLessThan(need);
    const first = makeSim({ first: true });
    expect(first.runs[0].need).toBeCloseTo(need * RULES.firstNeed, 9);
    expect(first.runs[1].need).toBeCloseTo(need, 9);
    const test = makeSim({ planned: 40 });
    expect(test.runs[0].need).toBeCloseTo(needFor(test.plan.push, test.plan.lead) * RULES.testNeed, 9);
    expect(focusRate(0.9, false, 10)).toBe(0);
  });
});

describe('Złota passa — the day', () => {
  it('a test session (≤ 60 s; app:smoke plays 40 s with half focus) turns at least one card — first-ever and returning, Mendi and HALO', () => {
    for (const T of [40, 60]) for (const eeg of [false, true]) for (const first of [true, false]) for (const f of [HALF, player(AVG), HIGH]) {
      const sim = makeSim({ planned: T, eeg, first });
      play(sim, f);
      expect(sim.wins, `${T} ${eeg} ${first}`).toBeGreaterThanOrEqual(1);
      expect(sim.canStop()).toBe(true);
      expect(sim.phase).toBe('end');
    }
  });

  it('turns a card only with real focus: none without it, none before the lead-in, none unreliable, none in the rests', () => {
    for (const eeg of [false, true]) {
      const none = makeSim({ eeg });
      play(none, LOW);
      expect(none.wins).toBe(0);
      expect(none.carried).toBe(none.met);
      expect(none.runs.every(r => r.p === 0)).toBe(true);
      // focus only inside the lead-in of each push
      const early = makeSim({ eeg });
      // (the frame is chosen on the last frame's clock: a frame's margin before the lead-in ends)
      play(early, (_t, s) => (s.pushBlock && s.blockT < s.lead - 2 * STEP ? HIGH : LOW));
      expect(early.wins).toBe(0);
      expect(early.runs.every(r => r.p === 0)).toBe(true);
      // focused but unreliable
      const unrel = makeSim({ eeg });
      play(unrel, (_t, s) => (s.pushBlock ? UNRELIABLE : LOW));
      expect(unrel.wins).toBe(0);
      // focus only in the rests and the free parts
      const rests = makeSim({ eeg });
      play(rests, (_t, s) => (s.pushBlock ? LOW : HIGH));
      expect(rests.wins).toBe(0);
      // taps choose, never turn
      const taps = makeSim({ eeg });
      drive(taps, taps.T + 1, (t, s) => {
        if (Math.floor(t * 3) % 2 === 0) { s.choose(0); s.key(' ', true); }
        return LOW;
      });
      expect(taps.wins).toBe(0);
    }
  });

  it('the average player turns most cards, a strong one all, and a carried card never counts', () => {
    for (const T of [180, 600, 1800]) {
      const avg = makeSim({ planned: T });
      play(avg, player(AVG));
      expect(avg.wins / avg.met, `${T}`).toBeGreaterThanOrEqual(0.9);
      const strong = makeSim({ planned: T });
      const ev = play(strong, player(HIGH));
      expect(strong.wins).toBe(strong.met);
      expect(strong.bestRun).toBe(strong.met);
      expect(ofType(ev, 'turned')).toHaveLength(strong.wins);
      // a weak one (focused a third of the push): some carried, never counted
      const weak = makeSim({ planned: T, seed: 3 });
      const evw = play(weak, (t, s) => (s.pushBlock && Math.floor(t / 3) % 3 === 0 ? AVG : LOW));
      expect(weak.wins + weak.carried).toBe(weak.met);
      expect(ofType(evw, 'carried')).toHaveLength(weak.carried);
      expect(weak.result().score).toBe(weak.wins);
      expect(weak.runs.filter(r => r.done === 'win')).toHaveLength(weak.wins);
      for (const r of weak.runs.filter(x => x.done === 'carry')) expect(r.p).toBeLessThan(1);
    }
  });

  it('a carried card goes into the pocket (no false win): the run ends quietly, the garland keeps its lights', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    // turn the first two, carry the third, turn the rest
    drive(sim, sim.T + 1, (_t, s) => (s.pushBlock && s.block.slot !== 2 ? HIGH : LOW), clock);
    expect(sim.runs[2].done).toBe('carry');
    expect(sim.wins).toBe(sim.met - 1);
    expect(sim.bestRun).toBe(Math.max(2, sim.met - 3));
    expect(sim.carried).toBe(1);
    expect(sim.view().lights).toBe(sim.wins);
    expect(sim.p.carried).toEqual([]);
    sim.finish();
    // a set card carried comes back next time
    if (sim.runs[2].setId) expect(sim.p.carried).toContain(sim.runs[2].setId);
  });

  it('the view through a moment: arrive, turn, savor (the light flies up, then counts), carry (into the pocket), the evening', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, sim.plan.introEnd + 0.5, LOW, clock);
    let v = sim.view();
    expect(v.phase).toBe('arrive');
    expect(v.card!.near).toBeLessThan(0.5);
    expect(v.card!.kind).toBe('joy');
    expect(v.choices).toEqual([]);
    expect(v.card!.win).not.toBe('');
    until(sim, s => s.block.what === 'turn' && s.blockT > s.lead + 0.5, LOW, clock);
    v = sim.view();
    expect(v.phase).toBe('turn');
    expect(v.card!.near).toBe(1);
    until(sim, s => s.cur?.done === 'win', HIGH, clock);
    expect(sim.view().card!.turn).toBeGreaterThan(0.3);
    until(sim, s => s.block.what === 'after', HIGH, clock);
    v = sim.view();
    expect(v.phase).toBe('savor');
    expect(v.flying).not.toBeNull();
    expect(v.lights).toBe(0);
    drive(sim, RULES.flySec + 0.2, LOW, clock);
    v = sim.view();
    expect(v.flying).toBeNull();
    expect(v.lights).toBe(1);
    expect(v.card!.write).toBe(1);
    // the next card is not turned: carried
    until(sim, s => s.block.what === 'after' && s.block.slot === 1, LOW, clock);
    v = sim.view();
    expect(v.phase).toBe('carry');
    expect(v.carried).toBe(1);
    drive(sim, RULES.carrySec + 0.1, LOW, clock);
    expect(sim.view().card).toBeNull();
    until(sim, s => s.block.what === 'garland', LOW, clock);
    drive(sim, 1.5, LOW, clock);
    v = sim.view();
    expect(v.phase).toBe('evening');
    expect(v.banner).toBe(t('banner.identity'));
    expect(v.day).toBeGreaterThan(0.75);
    expect(v.sign).toBe(signText(sim.days));
  });

  it('a heavy moment only when asked for: at most one, its name a rest before its push, trust always offered and a win', () => {
    for (const seed of [1, 2, 3, 4, 5]) for (const T of LENGTHS) {
      const off = makeSim({ planned: T, seed });
      expect(off.runs.filter(r => r.kind === 'heavy'), `${T}`).toHaveLength(0);
      const on = makeSim({ planned: T, seed, progress: { hard: true } });
      const heavies = on.runs.filter(r => r.kind === 'heavy');
      expect(heavies.length).toBeLessThanOrEqual(HEAVY_MAX);
      expect(heavies).toHaveLength(1);
      const h = heavies[0];
      expect(h.slot).toBe(on.plan.heavyAt);
      expect(labelsOf(h)).toContain(TRUST.pl);
      expect(labelsOf(h)[labelsOf(h).length - 1]).toBe(TRUST.pl);
      // the name is a rest, just before its push
      const i = on.plan.blocks.findIndex(b => b.what === 'turn' && b.slot === h.slot);
      expect(on.plan.blocks[i - 1].what).toBe('name');
      expect(on.plan.blocks[i - 1].kind).toBe('rest');
    }
    // trust chosen and turned by focus is a win of its own
    const sim = makeSim({ planned: 300, progress: { hard: true } });
    const h = sim.runs.find(r => r.kind === 'heavy')!;
    const clock = { t: 0 };
    until(sim, s => s.block.what === 'name', HIGH, clock);
    expect(sim.choiceLabels).toEqual([]);
    expect(sim.view().phase).toBe('name');
    until(sim, s => s.block.what === 'turn' && s.block.slot === h.slot, LOW, clock);
    expect(sim.choiceLabels).toEqual(labelsOf(h));
    expect(sim.choose(labelsOf(h).length - 1)).toBe(true);
    expect(sim.view().choices.at(-1)!.trust).toBe(true);
    const ev = drive(sim, sim.plan.push, HIGH, clock);
    expect(h.done).toBe('win');
    expect(sim.trustWins).toBe(1);
    expect(ofType(ev, 'turned').find(e => e.slot === h.slot)!.trust).toBe(true);
    expect(sim.view().card?.trust).toBe(true);
    play(sim, player(HIGH), []);
    const r = sim.result();
    expect(r.highlights).toContain(t('hl.trust'));
    expect(r.highlights).toContain(t('hl.heavy'));
    expect(VERSES.closeHeavy).toContain(r.verse);
  });

  it('the choice: changeable until the card turns, the first goes with none, keys 1–4 and Space', () => {
    const sim = makeSim({ planned: 600, seed: 11 });
    const clock = { t: 0 };
    until(sim, s => s.block.what === 'turn' && !!s.cur && s.cur.kind === 'snag', HIGH, clock);
    const r = sim.cur!;
    expect(sim.choiceLabels.length).toBeGreaterThanOrEqual(2);
    expect(sim.key('2', true)).toBe(true);
    expect(r.chosen).toBe(1);
    expect(sim.key(' ', true)).toBe(true);
    expect(r.chosen).toBe((1 + 1) % sim.choiceLabels.length);
    expect(sim.choose(0)).toBe(true);
    expect(sim.choose(9)).toBe(false);
    until(sim, () => r.done === 'win', HIGH, clock);
    expect(sim.choiceLabels).toEqual([]);
    expect(sim.choose(1)).toBe(false);
    expect(sim.view().card!.win).toBe(r.wins[0]);
    // no choice made: the first goes
    const none = makeSim({ planned: 600, seed: 11 });
    play(none, player(HIGH));
    for (const x of none.runs) expect(x.chosen).toBe(0);
  });

  it('the evening: the identity, the prayer, "for what most?" among the day’s wins (never in the result), the closing verse', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    until(sim, s => s.block.what === 'prayer', player(HIGH), clock);
    drive(sim, 1, LOW, clock);
    expect(sim.view().say).toBe(t('prayer.1'));
    until(sim, s => s.block.what === 'close', LOW, clock);
    drive(sim, 0.2, LOW, clock);
    const v = sim.view();
    expect(v.say).toBe(t('pick.q'));
    expect(v.choices.length).toBeGreaterThanOrEqual(2);
    expect(v.choices.length).toBeLessThanOrEqual(4);
    expect(sim.choose(1)).toBe(true);
    drive(sim, 0.5, LOW, clock);
    expect(sim.view().say).toContain(v.choices[1].label);
    expect(sim.view().choices).toEqual([]);
    expect(sim.verse?.id).toBe(sim.closingVerse);
    expect(JSON.stringify(sim.result())).not.toContain(v.choices[1].label);
    // no pick made: the question closes quietly at 60 % of the close and the closing verse comes
    const lapse = makeSim({ planned: 300 });
    play(lapse, player(HIGH));
    expect(lapse.pickSlots.length).toBeGreaterThanOrEqual(2);
    expect(lapse.picked).toBe(-1);
    expect(lapse.verse?.id).toBe(lapse.closingVerse);
    expect(lapse.talk.said).toContain(t('say.close.1'));
    // a day with no win: a quiet evening, no pick
    const quiet = makeSim({ planned: 300 });
    play(quiet, LOW);
    expect(quiet.view().banner).toBe(t('banner.quiet'));
    expect(quiet.pickSlots).toEqual([]);
    expect(quiet.result().highlights).toContain(t('hl.quiet'));
  });

  it('own moments come first, the trouble and hard ones with their own win, and never reach the result', () => {
    const p = freshProgress();
    p.sessions = 3;
    p.hard = true;
    expect(addOwn(p, 'Kawa z Anią o siódmej', 'joy', 'Dziękuję za Anię')).toBe('ok');
    expect(addOwn(p, 'Spóźniony tramwaj na Mokotów', 'snag', 'Więcej czasu z książką Ani')).toBe('ok');
    expect(addOwn(p, 'Rozmowa z lekarzem o mamie', 'heavy')).toBe('ok');
    const sim = makeSim({ planned: 600, progress: p });
    expect(sim.runs[0].what).toBe('Kawa z Anią o siódmej');
    expect(sim.runs[0].wins).toEqual(['Dziękuję za Anię']);
    expect(sim.runs[1].what).toBe('Spóźniony tramwaj na Mokotów');
    expect(sim.runs[1].wins[0]).toBe('Więcej czasu z książką Ani');
    const h = sim.runs.find(r => r.kind === 'heavy')!;
    expect(h.own).toBe(true);
    expect(h.slot).toBe(sim.plan.heavyAt);
    expect(labelsOf(h)).toEqual([...OWN_WINS.pl.heavy, TRUST.pl]);
    play(sim, player(HIGH));
    sim.finish();
    const json = JSON.stringify(sim.result());
    for (const w of ['Ani', 'Mokotów', 'lekarz', 'mamie', 'tramwaj', 'Kawa']) expect(json).not.toContain(w);
    // the own words stay in the progress on this device
    expect(sim.p.own.map(o => o.text)).toContain('Kawa z Anią o siódmej');
    // with the hard switch off, an own hard moment waits
    const off = makeSim({ planned: 600, progress: { ...p, hard: false, own: p.own.map(o => ({ ...o })) } });
    expect(off.runs.some(r => r.kind === 'heavy')).toBe(false);
  });

  it('own moments come in turn, carried set cards come back after them, and the heavy set turns session by session', () => {
    const p = freshProgress();
    p.sessions = 2;
    for (let i = 1; i <= 8; i++) addOwn(p, `Chwila ${i}`, i % 2 ? 'joy' : 'snag');
    const a = makeSim({ planned: 180, progress: p });
    expect(a.runs.map(r => r.what)).toEqual(['Chwila 1', 'Chwila 2', 'Chwila 3', 'Chwila 4']);
    play(a, player(HIGH));
    a.finish();
    expect(a.p.ownNext).toBe(4);
    const b = makeSim({ planned: 180, progress: a.p });
    expect(b.runs.map(r => r.what)).toEqual(['Chwila 5', 'Chwila 6', 'Chwila 7', 'Chwila 8']);
    // carried cards come back, said by the narrator
    const c = makeSim({ planned: 300, progress: { carried: ['rain', 'queue'], streak: { days: 2, last: '2026-11-25', grace: '', best: 2 } } });
    expect(c.runs[0].setId).toBe('rain');
    expect(c.runs[0].back).toBe('yesterday');
    expect(c.runs[1].setId).toBe('queue');
    const lately = makeSim({ planned: 300, progress: { carried: ['rain'], streak: { days: 2, last: '2026-11-20', grace: '', best: 2 } } });
    expect(lately.runs[0].back).toBe('lately');
    const evs = drive(c, c.plan.introEnd + 2, LOW);
    void evs;
    expect(c.talk.said).toContain(t('say.backYesterday.1'));
    // the heavy set turns
    const h1 = makeSim({ planned: 300, progress: { hard: true, heavyNext: 0 } });
    play(h1, player(HIGH));
    h1.finish();
    expect(h1.runs.find(r => r.kind === 'heavy')!.setId).toBe(HEAVIES[0].id);
    expect(h1.p.heavyNext).toBe(1);
  });

  it('a set day mixes joys and troubles (the first a joy, never three troubles in a row), by the part of the day where it can', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) for (const T of [300, 900, 1800]) {
      const sim = makeSim({ planned: T, seed });
      const kinds = sim.runs.map(r => r.kind);
      expect(kinds[0], `${seed} ${T}`).toBe('joy');
      expect(kinds.join(','), `${seed} ${T}`).not.toMatch(/snag,snag,snag/);
      const ids = sim.runs.map(r => r.id);
      expect(new Set(ids).size, `${seed} ${T}`).toBe(ids.length);
      for (const r of sim.runs) expect(MOTIFS).toContain(r.motif);
    }
    const sim = makeSim({ planned: 1800, seed: 2 });
    const joys = sim.runs.filter(r => r.kind === 'joy').length;
    expect(joys).toBeGreaterThanOrEqual(sim.runs.length * 0.4);
    const parts = sim.runs.map(r => r.part);
    expect(parts[0]).toBe('morning');
    expect(parts[parts.length - 1]).toBe('evening');
  });

  it('what the band is asked: the turn is focus, the name and the rests are rest, the rest free; the arrive telegraphs the turn', () => {
    const sim = makeSim({ planned: 300, progress: { hard: true } });
    const seen = new Map<string, string>();
    drive(sim, sim.T, (_t, s) => {
      seen.set(s.block.what, s.block.kind);
      if (s.block.what === 'arrive') expect(s.telegraphed && s.nextKind !== 'free').toBe(true);
      if (s.block.what === 'turn' && s.blockT < s.lead) expect(s.meter()).toBeNull();
      if (s.restBlock) expect(s.breath).not.toBeNull();
      return LOW;
    });
    expect(Object.fromEntries(seen)).toEqual({ intro: 'free', arrive: 'free', name: 'rest', turn: 'push', after: 'rest', garland: 'rest', prayer: 'rest', close: 'free' });
  });

  it('the result is idempotent, records only rise, the narrator speaks lines long enough to read', () => {
    const sim = makeSim({ planned: 300, progress: { best: 2, wins: 10, bestRun: 2, sessions: 4 } });
    play(sim, player(HIGH));
    sim.finish();
    const a = JSON.stringify(sim.result());
    sim.finish();
    expect(JSON.stringify(sim.result())).toBe(a);
    expect(sim.p.best).toBe(sim.wins);
    expect(sim.p.wins).toBe(10 + sim.wins);
    expect(sim.p.bestRun).toBe(sim.wins);
    expect(sim.p.sessions).toBe(5);
    expect(sim.result().record).toBe(true);
    const r = sim.result();
    expect(r.score).toBe(sim.wins);
    expect(r.unit).toBe(unit(sim.wins));
    expect(r.stats.map(s => s[0])).toEqual([t('stat.wins'), t('stat.run'), t('stat.days'), t('stat.contrast')]);
    expect(r.highlights).toContain(t('hl.run', { n: sim.bestRun }));
    // a weaker day later never lowers a record
    const later = makeSim({ planned: 300, progress: sim.p });
    play(later, LOW);
    later.finish();
    expect(later.p.best).toBe(sim.wins);
    expect(later.p.bestRun).toBe(sim.wins);
    for (const s of sim.talk.said) expect([...s].length).toBeLessThanOrEqual(110);
    expect(readTime('x'.repeat(40))).toBeCloseTo(Math.max(RULES.readMin, 2.5 + 0.07 * 40), 9);
  });
});

describe('Złota passa — the day-streak', () => {
  const S = (days: number, last: string, grace = '', best = days): Streak => ({ days, last, grace, best });

  it('adds a day the next day, keeps it the same day, forgives one missed day at most once a week, else begins again', () => {
    expect(streakAfter(S(0, ''), '2026-11-26')).toEqual(S(1, '2026-11-26', '', 1));
    expect(streakAfter(S(3, '2026-11-26'), '2026-11-26').days).toBe(3);
    expect(streakAfter(S(3, '2026-11-25'), '2026-11-26').days).toBe(4);
    const g = streakAfter(S(3, '2026-11-24'), '2026-11-26');
    expect(g.days).toBe(4);
    expect(g.grace).toBe('2026-11-26');
    // a second missed day within the week breaks it; a week later grace is free again
    expect(streakAfter(S(5, '2026-11-28', '2026-11-26'), '2026-11-30').days).toBe(1);
    expect(streakAfter(S(9, '2026-12-01', '2026-11-26'), '2026-12-03').days).toBe(10);
    expect(streakAfter(S(5, '2026-11-20'), '2026-11-26').days).toBe(1);
    expect(streakAfter(S(5, '2026-11-20', '', 7), '2026-11-26').best).toBe(7);
    // a clock set back or garbage begins again / changes nothing
    expect(streakAfter(S(5, '2026-11-27'), '2026-11-26').days).toBe(1);
    expect(streakAfter(S(5, '2026-11-25'), 'nonsense').days).toBe(5);
  });

  it('works across month and year ends and a leap day', () => {
    expect(daysBetween('2026-11-30', '2026-12-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2028-02-28', '2028-02-29')).toBe(1);
    expect(streakAfter(S(4, '2026-12-31'), '2027-01-01').days).toBe(5);
    expect(streakAfter(S(4, '2026-12-30'), '2027-01-01').days).toBe(5);
    expect(streakAfter(S(4, '2027-02-27'), '2027-03-01').days).toBe(5);
    expect(streakAfter(S(4, '2028-02-28'), '2028-03-01').days).toBe(5);
    expect(streakAfter(S(4, '2028-02-27'), '2028-03-01').days).toBe(1);
    expect(daysBetween('2026-13-01', '2026-12-01')).toBeNaN();
  });

  it('the lobby’s view of it: alive, alive by grace, gone; the sign and the session count today', () => {
    expect(streakNow(S(4, '2026-11-25'), '2026-11-26')).toEqual({ days: 4, grace: false });
    expect(streakNow(S(4, '2026-11-26'), '2026-11-26')).toEqual({ days: 4, grace: false });
    expect(streakNow(S(4, '2026-11-24'), '2026-11-26')).toEqual({ days: 4, grace: true });
    expect(streakNow(S(4, '2026-11-24', '2026-11-22'), '2026-11-26')).toEqual({ days: 0, grace: false });
    expect(streakNow(S(4, '2026-11-20'), '2026-11-26')).toEqual({ days: 0, grace: false });
    expect(graceFree(S(4, '2026-11-24', '2026-11-19'), '2026-11-26')).toBe(true);
    const sim = makeSim({ planned: 60, progress: { streak: S(4, '2026-11-25') } });
    expect(sim.days).toBe(5);
    play(sim, HIGH);
    sim.finish();
    expect(sim.p.streak).toEqual(S(5, DAY, '', 5));
    expect(sim.result().highlights).toContain(t('hl.days', { n: 5 }));
    expect(sim.talk.said).toContain(t('say.days', { n: 5 }));
    expect(signText(1)).toBe(t('sign.first'));
    expect(signText(5)).toBe(t('sign.days', { n: 5 }));
  });
});

describe('Złota passa — the progress', () => {
  it('migrates fresh, broken and hostile saves (only the known fields, every one repaired)', () => {
    const fresh = migrate(freshProgress());
    expect(fresh).toEqual(freshProgress());
    expect(migrate(mergeSaved(freshProgress(), null))).toEqual(freshProgress());
    // an old or broken save keeps its session count only
    const broken = migrate({ ver: 7, sessions: 5, best: 'x' } as unknown as PassaProgress);
    expect(broken).toEqual({ ...freshProgress(), sessions: 5 });
    const hostile = migrate(mergeSaved(freshProgress(), {
      ver: 1, sessions: -3, best: 1e9, wins: 'many', bestRun: 99, trusts: 50, moments: NaN, hard: 'yes', ownNext: 77,
      streak: { days: 'x', last: '2026-99-99', grace: 12, best: -1 },
      own: [
        { id: 'o1', text: '<img src=x onerror=alert(1)>Kawa\u0000‮ z Anią', kind: 'joy', win: 'x'.repeat(500) },
        { id: '__proto__', text: 'Deszcz', kind: 'evil' },
        { id: 'o1', text: 'Duplikat id', kind: 'snag' },
        { text: '' }, 'junk', null, ...Array.from({ length: 20 }, (_, i) => ({ text: `Wpis ${i}`, kind: 'heavy' })),
      ],
      carried: ['rain', 'nope', 42, 'rain', 'queue', 'parking', 'smile'], recent: Array.from({ length: 50 }, () => 'coffee'),
      seen: ['a', 3, 'a'], letter: 'secret', __proto__: { polluted: true }, extra: { x: 1 },
    }));
    expect(hostile.sessions).toBe(0);
    expect(hostile.best).toBe(1e9);
    expect(hostile.wins).toBe(1e9);
    expect(hostile.hard).toBe(false);
    expect(hostile.streak).toEqual({ days: 0, last: '', grace: '', best: 0 });
    expect(hostile.own).toHaveLength(RULES.ownMax);
    expect(hostile.own[0].text).toBe('img src=x onerror=alert(1) Kawa z Anią');
    expect(hostile.own[0].text).not.toMatch(/[<>\u0000-\u001f‮]/);
    expect(hostile.own[0].win.length).toBeLessThanOrEqual(RULES.winLen);
    expect(hostile.own[1].kind).toBe('joy');
    expect(new Set(hostile.own.map(o => o.id)).size).toBe(hostile.own.length);
    for (const o of hostile.own) expect(o.id).toMatch(/^o\d+$/);
    expect(hostile.ownNext).toBeLessThan(hostile.own.length);
    expect(hostile.carried).toEqual(['queue', 'parking', 'smile'].slice(-RULES.carryKeep));
    expect(hostile.recent).toEqual(['coffee']);
    expect(hostile.seen).toEqual(['a']);
    expect('letter' in hostile || 'extra' in hostile || 'polluted' in hostile).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    // idempotent
    expect(migrate(JSON.parse(JSON.stringify(hostile)))).toEqual(hostile);
  });

  it('Mój dzień: add, change, remove, forget — cleaned, ≤ 8, no duplicates', () => {
    const p = freshProgress();
    expect(addOwn(p, '   ', 'joy')).toBe('empty');
    expect(addOwn(p, 'Słońce rano', 'joy')).toBe('ok');
    expect(addOwn(p, 'słońce rano', 'snag')).toBe('dup');
    expect(addOwn(p, 'Korek', 'weird')).toBe('ok');
    expect(p.own[1].kind).toBe('joy');
    expect(editOwn(p, p.own[1].id, { kind: 'snag', win: 'Muzyka w aucie' })).toBe('ok');
    expect(p.own[1]).toMatchObject({ text: 'Korek', kind: 'snag', win: 'Muzyka w aucie' });
    expect(editOwn(p, p.own[1].id, { text: '' })).toBe('empty');
    expect(editOwn(p, 'o99', { text: 'x' })).toBe('none');
    for (let i = 0; i < 10; i++) addOwn(p, `Chwila ${i}`, 'joy');
    expect(p.own).toHaveLength(RULES.ownMax);
    expect(addOwn(p, 'Jeszcze jedna', 'joy')).toBe('max');
    expect(removeOwn(p, p.own[0].id)).toBe('ok');
    expect(p.own).toHaveLength(RULES.ownMax - 1);
    forgetOwn(p);
    expect(p.own).toEqual([]);
    expect(p.ownNext).toBe(0);
  });
});

describe('Złota passa — the words', () => {
  /** Every text of the game: its catalog, the moment sets, trust, the own wins and its registry lines. */
  function ownTexts(l: Lang): [string, string][] {
    const out: [string, string][] = [];
    for (const [k, v] of Object.entries(CATALOGS[l])) {
      if (typeof v === 'string') out.push([`passa.${k}`, v]);
      else for (const [f, s] of Object.entries(v)) if (s) out.push([`passa.${k}.${f}`, s]);
    }
    for (const [id, w] of Object.entries(SET_TEXTS[l])) {
      out.push([`set.${id}.what`, w.what]);
      w.wins.forEach((s, i) => out.push([`set.${id}.win${i}`, s]));
    }
    out.push(['trust', TRUST[l]]);
    for (const [k, list] of Object.entries(OWN_WINS[l])) list.forEach((s, i) => out.push([`own.${k}${i}`, s]));
    for (const [k, v] of Object.entries(ARCADE_TEXTS[l])) if (k.startsWith('passa.')) out.push([`arcade.${k}`, String(v)]);
    for (const [k, v] of Object.entries(MOUSE_TEXTS[l])) if (k.startsWith('passa.')) out.push([`mouse.${k}`, String(v)]);
    return out;
  }

  it('are complete in four languages: the catalogs, the moment sets with the same wins, the limits, the narrator', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    for (const l of LANGS) {
      expect(Object.keys(SET_TEXTS[l]).sort(), l).toEqual(SETS.map(m => m.id).sort());
      for (const m of SETS) {
        const w = SET_TEXTS[l][m.id as keyof (typeof SET_TEXTS)['pl']];
        const pl = SET_TEXTS.pl[m.id as keyof (typeof SET_TEXTS)['pl']];
        expect(w.wins.length, `${l} ${m.id}`).toBe(pl.wins.length);
        expect([...w.what].length, `${l} ${m.id}`).toBeLessThanOrEqual(RULES.ownLen);
        for (const s of w.wins) expect([...s].length, `${l} ${m.id}: ${s}`).toBeLessThanOrEqual(52);
        if (m.kind === 'joy') expect(w.wins, `${l} ${m.id}`).toHaveLength(1);
        else expect(w.wins.length, `${l} ${m.id}`).toBeGreaterThanOrEqual(2);
        expect(w.wins.length, `${l} ${m.id}`).toBeLessThanOrEqual(3);
      }
      expect(OWN_WINS[l].joy).toHaveLength(1);
      expect(OWN_WINS[l].snag).toHaveLength(3);
      expect(OWN_WINS[l].heavy).toHaveLength(3);
      for (const s of [TRUST[l], ...OWN_WINS[l].snag, ...OWN_WINS[l].heavy]) expect([...s].length).toBeLessThanOrEqual(52);
    }
    expect(JOYS.length).toBeGreaterThanOrEqual(16);
    expect(SNAGS.length).toBeGreaterThanOrEqual(16);
    expect(HEAVIES.length).toBeGreaterThanOrEqual(8);
    for (const m of SETS) expect(MOTIFS).toContain(m.motif);
    // every narrator moment has its lines, each ≤ 80 characters, in all four languages
    const orig = linesOf;
    for (const s of SAYS) expect(orig(s).length, s).toBeGreaterThan(0);
    for (const l of LANGS) for (const [k, v] of Object.entries(CATALOGS[l])) {
      if (k.startsWith('say.') && typeof v === 'string') expect([...v].length, `${l}.${k}`).toBeLessThanOrEqual(80);
      if (k.startsWith('banner.') && typeof v === 'string') expect([...v].length, `${l}.${k}`).toBeLessThanOrEqual(60);
      if (k.startsWith('prayer.')) expect([...String(v)].length, `${l}.${k}`).toBeLessThanOrEqual(110);
    }
    // the plurals of the unit
    expect([unit(1), unit(3), unit(5)]).toEqual(['zwycięstwo', 'zwycięstwa', 'zwycięstw']);
  });

  it('keep the forbidden words out (no "universe", "attraction", "manifest", "energy", "vibration", reward promises, "nothing bad")', () => {
    const FORBID: Record<Lang, RegExp> = {
      pl: /wszechświat|przyciągan|manifest|energi|wibracj|bóg ci da|bóg da ci|nic złego|dlatego cię to spotkało|uzdrowi|wyleczy/i,
      en: /universe|attraction|manifest|energy|vibration|god will give you|nothing bad|that is why it happened|will heal|cure/i,
      de: /universum|anziehung|manifest|energie|schwingung|gott wird dir geben|nichts schlimmes|nichts böses|wird heilen/i,
      sv: /universum|attraktion|manifest|energi|vibration|gud kommer att ge dig|inget ont|inget dåligt|kommer att hela|bota/i,
    };
    for (const l of LANGS) for (const [k, s] of ownTexts(l)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
  });

  it('never gives the player a gender in Polish', () => {
    const GENDERED = /\p{L}+(łeś|łaś|łem|łam|łbyś|łabyś|łbym|łabym)(?!\p{L})|(?<!\p{L})(sam|sama|samotny|samotna|gotowy|gotowa|gotów|zraniony|zraniona|kochany|kochana|zmęczony|zmęczona|pewny|pewna|silny|silna|szczęśliwy|szczęśliwa|wdzięczny|wdzięczna)(?!\p{L})|\p{L}+(y|i)\/a(?!\p{L})|\p{L}+\((a|aś|na)\)|(?<!\p{L})(jesteś|jestem|czujesz się|czuję się|zostaniesz|zostanę|będziesz|byłeś|byłaś)\s+\p{L}{2,}(ny|na|ty|ta|wy|wa|ły|ła)(?!\p{L})/giu;
    const hits: string[] = [];
    for (const [k, s] of ownTexts('pl')) for (const m of s.matchAll(GENDERED)) hits.push(`${k}: "${m[0]}" in ${s}`);
    expect(hits).toEqual([]);
  });

  it('quotes only verified passages, each in four languages: the root, the dawn, the name, the garland, the prayer, the close', () => {
    expect(ROOT).toBe('rom8.28');
    for (const id of ALL_VERSES) for (const l of LANGS) {
      const p = passage(id, l);
      expect(p.text.length, `${id} ${l}`).toBeGreaterThan(10);
      expect(p.ref.length, `${id} ${l}`).toBeGreaterThan(2);
    }
    for (const id of ['1th5.18', 'gen50.20', 'jas1.2-4', 'rom5.3-5', 'psa23.6', 'psa16.6', 'eph5.20', '2co4.17', 'psa118.24', 'lam3.22-23', 'psa34.18']) expect(ALL_VERSES).toContain(id);
    // Joseph's word and the passages on trials close only a day that met a heavy moment
    for (const id of ['gen50.20', 'rom5.3-5', 'jas1.2-4', '2co4.17']) {
      expect(VERSES.close as readonly string[]).not.toContain(id);
      expect(VERSES.closeHeavy as readonly string[]).toContain(id);
    }
    expect(verseFor('close', 1)).toBe(VERSES.close[0]);
    expect(verseFor('close', 1 + VERSES.close.length)).toBe(VERSES.close[0]);
    for (let n = 1; n < 12; n++) {
      const sim = makeSim({ planned: 60, progress: { sessions: n } });
      expect(VERSES.close).toContain(sim.closingVerse);
    }
  });

  it('the registry entry: a vision game after Rzeki on Rom 8:28 for Mendi and HALO; texts, the help lines and the mouse twin', () => {
    const e = arcadeEntry('passa')!;
    expect(e.kind).toBe('vision');
    expect(e.root).toBe('rom8.28');
    expect(e.tools).toEqual(['fnirs', 'eeg']);
    expect(e.focusChip).toBe(false);
    expect(e.tuning).toEqual({ adapt: 0.08 });
    expect(e.art).toBe('art-passa');
    const ids = ARCADE.map(a => a.id);
    expect(ids.indexOf('passa')).toBe(ids.indexOf('rzeki') + 1);
    for (const l of LANGS) {
      const A = ARCADE_TEXTS[l] as Record<string, string>;
      // the help lines exactly as Złote serce's and Każda myśl's tip 5
      expect(A['passa.tip5'], l).toBe(A['kintsugi.tip5']);
      // the source named once, in the lobby text
      expect(A['passa.text'], l).toMatch(/Emmons/);
      expect(A['passa.text'], l).toMatch(/Seligman/);
      expect(Object.entries(A).filter(([k, v]) => k.startsWith('passa.') && /Emmons/.test(v)).length, l).toBe(1);
      expect((MOUSE_TEXTS[l] as Record<string, string>)['passa.how3'], l).toBeTruthy();
    }
    const titles = { pl: 'Złota passa', en: 'Winning Streak', de: 'Siegesserie', sv: 'Vinnarsvit' };
    for (const l of LANGS) expect((ARCADE_TEXTS[l] as Record<string, string>)['passa.title']).toBe(titles[l]);
    expect(mod.best(freshProgress())).toBeNull();
    expect(howto(true).hands.map(x => x.gesture)).toEqual(['tap']);
    expect(howto(false).hands.map(x => x.gesture)).toEqual(['tap', 'keys']);
  });
});

describe('Złota passa — the choices and the lobby', () => {
  it('B’s layout: the open choices are tap targets at every checked size (≥ 44 px, inside, clear of each other) and hit-test', () => {
    for (const s of CHECK_SIZES) for (const touch of [true, false]) {
      const l = layout(s.w, s.h, s.insets, touch);
      for (let n = 1; n <= 4; n++) {
        const labels = Array.from({ length: n }, (_, i) => `choice ${i + 1}`);
        const rects = choiceRects(l, n);
        expect(rects, `${s.name} ${n}`).toHaveLength(n);
        const targets = choiceTargets({ ...l, choices: rects }, labels);
        expect(auditTargets(targets, s.w, s.h, s.insets, MIN_TAP), `${s.name} ${n}`).toEqual([]);
        for (let i = 0; i < n; i++) {
          const r = rects[i];
          expect(choiceAt({ ...l, choices: rects }, n, r.x + r.w / 2, r.y + r.h / 2), `${s.name} ${n} ${i}`).toBe(i);
        }
      }
      // a heavy moment's verse (the name) stands above its card, under the HUD, clear of the card
      const a = aboveCard(l), c = cardFor(l, 0);
      expect(a, s.name).not.toBeNull();
      expect(a!.y, s.name).toBeGreaterThanOrEqual(s.insets.top);
      expect(a!.y + a!.h, s.name).toBeLessThanOrEqual(c.y);
      expect(a!.h, s.name).toBeGreaterThanOrEqual(80);
    }
  });

  it('the lobby card: the streak, the forecast, Mój dzień (add, change, remove, forget), the hard switch, the source and help lines', () => {
    const p = freshProgress();
    let saves = 0;
    const el = progressPanel(p, () => { saves++; }, DAY);
    document.body.appendChild(el);
    expect(el.textContent).toContain(t('panel.streakNone'));
    expect(el.textContent).toContain(t('panel.myday'));
    expect(el.textContent).toContain(t('panel.source').slice(0, 30));
    expect(el.textContent).toContain('116 123');
    // add one: a line, its kind, a win
    const box = el.querySelector('[data-passa="new"]')!;
    const [what, win] = [...box.querySelectorAll('input')];
    what.value = 'Kawa <b>z</b> Anią';
    win.value = 'Dziękuję za Anię';
    (box.querySelector('[data-kind="snag"]') as HTMLButtonElement).click();
    (el.querySelector('[data-passa="add"]') as HTMLButtonElement).click();
    expect(p.own).toEqual([{ id: 'o1', text: 'Kawa b z /b Anią', kind: 'snag', win: 'Dziękuję za Anię' }]);
    expect(saves).toBe(1);
    expect(el.querySelector('[data-own="o1"]')!.textContent).toContain('Kawa b z /b Anią');
    expect(el.innerHTML).not.toContain('<b>z</b>');
    // a duplicate is said, not saved
    const box2 = el.querySelector('[data-passa="new"]')!;
    box2.querySelector('input')!.value = 'kawa b z /b anią';
    (el.querySelector('[data-passa="add"]') as HTMLButtonElement).click();
    expect(p.own).toHaveLength(1);
    expect(el.textContent).toContain(t('ed.dup'));
    // change it
    (el.querySelector('[data-k="edit-o1"]') as HTMLButtonElement).click();
    const ed = el.querySelector('[data-passa="edit"]')!;
    ed.querySelector('input')!.value = 'Kawa z przyjaciółką';
    (ed.querySelector('[data-kind="joy"]') as HTMLButtonElement).click();
    (el.querySelector('[data-passa="save"]') as HTMLButtonElement).click();
    expect(p.own[0]).toMatchObject({ text: 'Kawa z przyjaciółką', kind: 'joy' });
    // the hard switch, and an own hard moment waiting while it is off
    addOwn(p, 'Trudna rozmowa', 'heavy');
    const el2 = progressPanel(p, () => { saves++; }, DAY);
    expect(el2.textContent).toContain(t('panel.heavyWaits'));
    (el2.querySelector('[data-passa="hard-on"]') as HTMLButtonElement).click();
    expect(p.hard).toBe(true);
    expect(el2.textContent).not.toContain(t('panel.heavyWaits'));
    // forget
    (el2.querySelector('[data-passa="forget"]') as HTMLButtonElement).click();
    expect(p.own).toEqual([]);
    expect(el2.textContent).toContain(t('panel.forgotten'));
    // the streak's lines
    expect(streakLine({ ...p, streak: { days: 3, last: '2026-11-25', grace: '', best: 3 } }, DAY)).toBe(t('panel.streakOk', { days: t('days', { n: 3 }) }));
    expect(streakLine({ ...p, streak: { days: 3, last: DAY, grace: '', best: 3 } }, DAY)).toBe(t('panel.streakToday', { days: t('days', { n: 3 }) }));
    expect(streakLine({ ...p, streak: { days: 3, last: '2026-11-24', grace: '', best: 3 } }, DAY)).toBe(t('panel.streakGrace'));
    // the forecast follows the plan
    const fc = forecastLines({ ...p, hard: true }, 300).join(' ');
    expect(fc).toContain(t('moments', { n: planFor({ plannedSec: 300, eeg: false, heavy: true }).n }));
    expect(fc).toContain(t('panel.fcHeavy'));
    document.body.removeChild(el);
  });

  it('the lobby keys exist in all four languages (the panel uses only its catalog and the arcade’s tip 5)', () => {
    for (const k of ['panel.myday', 'panel.hard', 'panel.hardNote', 'panel.source', 'kind.joy', 'kind.snag', 'kind.heavy'] as Key[]) {
      for (const l of LANGS) expect(String(CATALOGS[l][k]).length, `${l}.${k}`).toBeGreaterThan(1);
    }
  });
});

/** Play until `done` (at most `max` s). */
function until(sim: PassaSim, done: (s: PassaSim) => boolean, f: FocusFrame | FrameFn, clock: { t: number }, out: SimEvent[] = [], max = 4000): SimEvent[] {
  for (let i = 0; i < max / STEP && !done(sim); i++) drive(sim, STEP, f, clock, out);
  return out;
}

describe('Złota passa — 45–60 minutes (round 24)', () => {
  it('fills 45 and 60 minutes with moments, not with the evening: by design 35 s / 4 breaths (32 moments) and 40 / 4 (40)', () => {
    expect(designFor(2700)).toEqual({ push: 35, breaths: 4 });
    expect(designFor(3600)).toEqual({ push: 40, breaths: 4 });
    expect(planFor({ plannedSec: 2700, eeg: false }).n).toBe(SETS.length - HEAVIES.length);
    expect(planFor({ plannedSec: 3600, eeg: false }).n).toBe(RULES.momentsMax);
    for (const T of [2700, 3600]) for (const eeg of [false, true]) for (const heavy of [false, true]) for (const first of [false, true]) {
      for (const dials of [null, [15, 1], [20, 2], [30, 3], [40, 4]] as const) {
        const p = planFor({ plannedSec: T, eeg, heavy, first, ...(dials ? { focus: dials[0], rest: dials[1], custom: true } : {}) });
        const name = `${T} s ${eeg ? 'eeg' : 'fnirs'} heavy=${heavy} first=${first} ${dials ?? 'design'}`;
        for (let i = 1; i < p.blocks.length; i++) expect(Math.abs(p.blocks[i].t0 - p.blocks[i - 1].t1), name).toBeLessThan(1e-9);
        expect(Math.abs(p.blocks[p.blocks.length - 1].t1 - T), name).toBeLessThan(1e-6);
        expect(p.n, name).toBeLessThanOrEqual(RULES.momentsMax);
        expect(p.n, name).toBeGreaterThanOrEqual(28);
        // the evening about as long a share as half an hour's (two to four minutes; before: up to 41 minutes)
        const eve = T - p.eveningStart;
        expect(eve, name).toBeGreaterThanOrEqual(RULES.evening.min);
        expect(eve, name).toBeLessThanOrEqual(0.075 * T);
        expect(T - p.prayerEnd, name).toBeGreaterThanOrEqual(RULES.closeMin - 1e-6);
        // the dials only ever lengthen, within their ranges
        if (dials) {
          expect(p.push, name).toBeGreaterThanOrEqual(dials[0]);
          expect(p.breaths, name).toBeGreaterThanOrEqual(dials[1]);
        }
        expect(p.push, name).toBeLessThanOrEqual(RULES.focus.max);
        expect(p.breaths, name).toBeLessThanOrEqual(RULES.rest.max);
        for (const b of p.blocks) if (b.kind === 'rest') expect((b.t1 - b.t0) / p.cyc, `${name} ${b.what}`).toBeCloseTo(Math.round((b.t1 - b.t0) / p.cyc), 9);
      }
    }
    // a rhythm that fits keeps its dials also in an hour; 30 minutes and less never stretch
    expect(planFor({ plannedSec: 2700, eeg: false, focus: 40, rest: 4, custom: true })).toMatchObject({ push: 40, breaths: 4, n: 30 });
    expect(planFor({ plannedSec: 1800, eeg: false, focus: 15, rest: 1, custom: true })).toMatchObject({ push: 15, breaths: 1 });
  });

  it('a 45-minute day meets every set moment once; an hour’s day lets a few come again, later in the day', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const day45 = makeSim({ planned: 2700, seed }).runs.map(r => r.id);
      expect(new Set(day45).size, `${seed}`).toBe(day45.length);
      const sim = makeSim({ planned: 3600, seed });
      const ids = sim.runs.map(r => r.id);
      const seen = new Map<string, number>();
      ids.forEach((id, i) => {
        // never more than twice, and never again within the first half of the day
        if (seen.has(id)) expect(i - seen.get(id)!, `${seed} ${id}`).toBeGreaterThanOrEqual(8);
        seen.set(id, i);
      });
      for (const id of new Set(ids)) expect(ids.filter(x => x === id).length, `${seed} ${id}`).toBeLessThanOrEqual(2);
      expect(new Set(ids).size, `${seed}`).toBe(SETS.length - HEAVIES.length);
      expect(sim.runs.map(r => r.kind).join(','), `${seed}`).not.toMatch(/snag,snag,snag/);
    }
  });

  it('plays an hour through: every moment met, the garland past its forty bulbs, a clean result, the narrator still speaking', () => {
    for (const push of [AVG, HIGH]) {
      const sim = makeSim({ planned: 3600, seed: 3, progress: { hard: true } });
      let late = 0, last: unknown = null;
      drive(sim, sim.T + 1, (tt, s) => {
        const line = s.talk.line;
        if (line && line !== last && tt > 3000) late++;
        last = line;
        return s.pushBlock ? push : LOW;
      });
      sim.finish();
      expect(sim.runs.every(r => r.met)).toBe(true);
      expect(sim.wins).toBeGreaterThanOrEqual(sim.runs.length * 0.9);
      expect(late).toBeGreaterThan(3);
      const v = sim.view();
      expect(v.lights).toBe(sim.wins);
      const r = sim.result();
      expect(r.score).toBe(sim.wins);
      expect(r.stats.length).toBeLessThanOrEqual(5);
      expect(r.highlights.length).toBeLessThanOrEqual(6);
      for (const [k, s] of r.stats) expect(`${k} ${s}`).not.toMatch(/undefined|NaN|Infinity/);
      for (const h of r.highlights) expect(h).not.toMatch(/undefined|NaN|\{/);
      expect(passage(r.verse!).text.length).toBeGreaterThan(10);
      expect(sim.p.carried.length).toBeLessThanOrEqual(RULES.carryKeep);
      expect(sim.p.recent.length).toBeLessThanOrEqual(RULES.recentMax);
    }
  }, 120_000);
});
