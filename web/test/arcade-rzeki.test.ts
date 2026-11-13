import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  LINE_COUNT, MOMENTS, PLACE, PLACES, TIPS, cleanOwn, legs, lineAt, linesOf, pushTip, route, tierName, verseOf, windowTier, type PlaceId,
} from '../src/arcade/rzeki/content';
import { CATALOGS, t, unit } from '../src/arcade/rzeki/i18n';
import {
  bestOf, countPlace, freshProgress, mapGlow, migrate, placesLit, setOwn, setWay, tierOf, timesLit, type RzekiProgress,
} from '../src/arcade/rzeki/meta';
import { BREATH, RULES } from '../src/arcade/rzeki/rules';
import { LIT_DOWN, LIT_UP, RzekiSim, finaleFor, petalCount, petalTotal, petalsOpen, planBlocks, secText, type SimEvent } from '../src/arcade/rzeki/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, auditTargets } from '../src/arcade/kit/mobile';
import { coachText, howto } from '../src/arcade/rzeki/index';
import { layout, litR, storyRect, tapTargets, windowR } from '../src/arcade/rzeki/layout';
import { font, fontPx } from '../src/arcade/rzeki/paint';
import { RING, openness, partPath, petalAngle, pieces } from '../src/arcade/rzeki/rose';
import { buildHymn } from '../src/arcade/rzeki/hymn';
import { songProblems } from '../src/arcade/kit/song';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.55, activity: 2.2, focused: true, hold: 1, calm: 0.4 });
const LOW = frame({ level: 0.15, activity: -1, calm: 0.7 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.tap', 'c.light', 'c.petals', 'c.breath', 'c.drops', 'c.blind'];

type SimOpts = { progress?: Partial<RzekiProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): RzekiSim {
  const sim = new RzekiSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

/** Close any story card as a player would (a tap after it has been up a moment). */
const reader = (sim: RzekiSim) => () => { if (sim.story && sim.story.t > 1) sim.stay(); };

function drive(sim: RzekiSim, sec: number, f: FocusFrame | ((t: number, sim: RzekiSim) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run until the light is at a place of the way (stage `at`), returns the clock. */
function untilAt(sim: RzekiSim, place: PlaceId, f: FocusFrame | ((t: number, sim: RzekiSim) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (!(sim.stage === 'at' && sim.place === place) && guard++ < 6000) drive(sim, 0.1, f, clock, reader(sim));
  return clock;
}

describe('the seven places (content.ts)', () => {
  it('runs from the crown to the feet on the midline, warm at the base and white at the crown', () => {
    expect(PLACES).toEqual(['mind', 'eyes', 'mouth', 'heart', 'breath', 'inner', 'feet']);
    for (let i = 1; i < PLACES.length; i++) expect(PLACE[PLACES[i]].y).toBeGreaterThan(PLACE[PLACES[i - 1]].y);
    // the bells: the crown highest, the feet lowest — a scale that descends going down and rises going up
    for (let i = 1; i < PLACES.length; i++) expect(PLACE[PLACES[i]].bell).toBeLessThan(PLACE[PLACES[i - 1]].bell);
    const warmth = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
    expect(warmth(PLACE.feet.hue)).toBeGreaterThan(80);
    expect(warmth(PLACE.mind.hue)).toBeLessThanOrEqual(0);
    // never the chakra code: no green heart, no violet crown
    const g = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const [hr, hg] = g(PLACE.heart.hue);
    expect(hr).toBeGreaterThan(hg);
    const [cr, cg, cb] = g(PLACE.mind.hue);
    expect(Math.min(cr, cg, cb)).toBeGreaterThan(220);
  });

  it('gives each place a rose window of church glass with its own tracery', () => {
    const seen = new Set<string>();
    for (const p of PLACES) {
      const r = PLACE[p].rose;
      expect(r.inner).toBeGreaterThanOrEqual(3);
      expect(r.outer).toBeGreaterThanOrEqual(r.inner);
      for (const c of r.glass) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      seen.add(`${r.inner}${r.innerShape}${r.outer}${r.outerShape}`);
    }
    expect(seen.size).toBe(7);
  });

  it('names a verse that exists for every place, both ways', () => {
    for (const p of PLACES) for (const d of ['down', 'up'] as const) expect(passage(verseOf(p, d)).text.length).toBeGreaterThan(10);
    expect(verseOf('inner', 'down')).toBe('jhn7.38-39');
    expect(verseOf('breath', 'down')).toBe('jhn20.22');
    expect(verseOf('breath', 'up')).toBe('eph3.16');
    expect(verseOf('feet', 'up')).toBe('psa18.32');
  });

  it('walks down from the crown and up from the feet; both is down then up', () => {
    expect(route('down')[0]).toBe('mind');
    expect(route('up')[0]).toBe('feet');
    expect(route('up').at(-1)).toBe('mind');
    expect(legs('both')).toEqual(['down', 'up']);
    expect(legs('up')).toEqual(['up']);
  });

  it('prays the founder’s form at each place going down, gives thanks going up, and takes own words instead', () => {
    expect(lineAt('heart', 'down')).toBe('Przez Jezusa Chrystusa, Duchu Święty, wypełnij moje serce i niech popłynie miłość.');
    expect(lineAt('mind', 'down')).toBe('Przez Jezusa Chrystusa, Duchu Święty, wypełnij mój umysł i niech popłynie pokój.');
    expect(lineAt('inner', 'down')).toMatch(/wypełnij moje wnętrze i niech popłynie żywa woda\.$/);
    expect(lineAt('feet', 'down')).toMatch(/wypełnij moje kroki i niech popłynie siła\.$/);
    for (const p of PLACES) {
      expect(lineAt(p, 'down')).toMatch(/^Przez Jezusa Chrystusa, Duchu Święty, wypełnij .+ i niech popłynie .+\.$/);
      expect(lineAt(p, 'up')).toMatch(/^Dziękuję, Duchu Święty, za /);
    }
    const own = 'przez Jezusa Chrystusa Duchu święty wypełnij to miejsce';
    expect(lineAt('eyes', 'down', own)).toBe(own);
    expect(lineAt('eyes', 'up', own)).toBe(own);
    // German never says "Geist" twice in one prayer
    for (const p of PLACES) expect((CATALOGS.de[`pray.${p}` as 'pray.mind'] as string).match(/Geist/g)).toHaveLength(1);
  });

  it('keeps own words plain text: no markup, no control characters, at most 120 characters', () => {
    expect(cleanOwn('  <b>Duchu</b>\n\tŚwięty  ')).toBe('b Duchu /b Święty');
    expect(cleanOwn(42)).toBe('');
    expect([...cleanOwn('ą'.repeat(300))]).toHaveLength(RULES.ownMax);
    // any whitespace (a no-break space too) folds into one plain space
    expect(cleanOwn('a\u0000b c')).toBe('a b c');
  });

  it('asks for the place’s own picture, the slow repetition every third push, and the rising picture going up', () => {
    expect(pushTip('eyes', 'down', 0)).toBe(TIPS.place.eyes);
    expect(pushTip('eyes', 'down', 1)).toBe(TIPS.place.eyes);
    expect(pushTip('eyes', 'down', 2)).toBe(TIPS.repeat);
    expect(pushTip('heart', 'up', 1)).toBe(TIPS.rise);
    expect(pushTip('heart', 'up', 5)).toBe(TIPS.repeat);
    expect(t(TIPS.place.eyes)).toMatch(/między brwiami od środka/);
    expect(t(TIPS.place.heart)).toMatch(/ciepłą wodę, która wypełnia serce/);
    expect(t(TIPS.repeat)).toMatch(/słowo po słowie/);
  });
});

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates light and abiding, ending on a rest', () => {
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
      drive(sim, sim.block.dur + 0.05, frame(), clock, reader(sim));
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
    const young = later({ planned: 600, progress: { sessions: 1, pushes: 2 } });
    const c2 = { t: 0 };
    for (let i = 0; i < 6; i++) {
      expect(young.blind).toBe(false);
      drive(young, young.block.dur + 0.05, frame(), c2, reader(young));
    }
  });

  it('judges each block once at its end, from its last 15 s', () => {
    const sim = later();
    const evs = drive(sim, sim.block.dur + 0.1, HIGH);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].verdict).toBe(true);
  });

  it('gives the strategy of the place the light is at, and the breath in rest', () => {
    const sim = later();
    untilAt(sim, 'mind', MID);
    expect(sim.tip).toBe(t(TIPS.place.mind));
    const clock = { t: sim.t };
    untilAt(sim, 'eyes', HIGH, clock);
    if (sim.pushBlock) expect(sim.tip).toBe(t(TIPS.place.eyes));
    while (!sim.restBlock) drive(sim, 0.5, MID, clock, reader(sim));
    expect(TIPS.rest.map(k => t(k))).toContain(sim.tip);
  });
});

describe('the way', () => {
  it('comes down from the open heaven to the crown, then lights each place in turn and flows on', () => {
    const sim = later();
    expect(sim.stage).toBe('enter');
    expect(sim.dir).toBe('down');
    const clock = { t: 0 };
    const evs = drive(sim, RULES.heavenSec + 0.1, MID, clock);
    expect(ofType(evs, 'arrive')[0]).toMatchObject({ place: 'mind', dir: 'down', idx: 0 });
    const more = drive(sim, 60, HIGH, clock);
    const fulls = ofType(more, 'full').map(e => e.place);
    expect(fulls.slice(0, 2)).toEqual(['mind', 'eyes']);
    const flows = ofType(more, 'flow');
    expect(flows[0]).toMatchObject({ from: 'mind', to: 'eyes', dir: 'down' });
    expect(sim.lit.mind & LIT_DOWN).toBeTruthy();
  });

  it('opens the rose window petal by petal: the inner ring first, then the outer petals', () => {
    for (const p of PLACES) {
      expect(petalCount(p, 0)).toBe(0);
      expect(petalCount(p, 1)).toBe(petalTotal(p));
      const half = petalsOpen(p, RULES.innerShare);
      expect(half.inner).toBeCloseTo(PLACE[p].rose.inner, 9);
      expect(half.outer).toBe(0);
      let prev = 0;
      for (let f = 0; f <= 1.0001; f += 0.01) {
        const n = petalCount(p, f);
        expect(n).toBeGreaterThanOrEqual(prev);
        prev = n;
      }
    }
    const sim = later();
    const evs = drive(sim, 40, HIGH);
    const petals = ofType(evs, 'petal').filter(e => e.place === 'mind').map(e => e.n);
    expect(petals).toEqual(Array.from({ length: petalTotal('mind') }, (_, i) => i + 1));
  });

  it('takes about 20–40 s a place at a moderate signal, faster in gold light, slower but moving without it', () => {
    /** seconds per place lit over the first 300 s of a 10-minute session (rests and the blind block included) */
    const pace = (f: (sim: RzekiSim) => FocusFrame, seed = 1) => {
      const sim = later({ planned: 600, seed });
      drive(sim, 300, () => f(sim), { t: 0 }, reader(sim));
      return 300 / Math.max(1, sim.placesNow);
    };
    const mean = (f: (sim: RzekiSim) => FocusFrame) => [1, 2, 3].reduce((s, seed) => s + pace(f, seed), 0) / 3;
    const moderate = mean(sim => (sim.restBlock ? frame({ calm: 0.55, level: 0.35 }) : frame({ level: 0.55, activity: 2.2 })));
    const golden = mean(sim => (sim.restBlock ? frame({ calm: 0.7, level: 0.3 }) : frame({ level: 0.9, activity: 5 })));
    const low = mean(sim => (sim.restBlock ? frame({ calm: 0.4, level: 0.4 }) : frame({ level: 0.15, activity: -1 })));
    const none = mean(() => NONE);
    expect(moderate).toBeGreaterThan(20);
    expect(moderate).toBeLessThan(40);
    expect(golden).toBeLessThan(moderate * 0.9);
    expect(low).toBeGreaterThan(moderate * 1.15);
    // without control or without a signal the way still goes on: a place in about a minute at most
    expect(low).toBeLessThan(65);
    expect(none).toBeLessThan(60);
  });

  it('fills a place in a sighted push ~1.4× faster in gold light than at the threshold, ~3× faster than at a low signal', () => {
    const rate = (f: FocusFrame) => {
      const sim = later();
      drive(sim, 12, f);
      return sim.fillRate();
    };
    const gold = rate(frame({ level: 0.9, activity: 5 })), mid = rate(frame({ level: 0.5, activity: 2 })), low = rate(LOW);
    expect(gold / mid).toBeGreaterThan(1.35);
    expect(gold / low).toBeGreaterThan(2.7);
    // ≈ 15 s of push at the threshold for a whole place
    expect(1 / mid).toBeGreaterThan(12);
    expect(1 / mid).toBeLessThan(18);
  });

  it('carries the light gathered in the dark into the next place', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : LOW), clock, reader(sim));
    while (sim.blind) drive(sim, 0.1, HIGH, clock, reader(sim));
    // the reveal fills the place; the stream flows on; the next place starts with what was left over
    let guard = 0;
    const evs: SimEvent[] = [];
    while (ofType(evs, 'arrive').length === 0 && guard++ < 400) evs.push(...drive(sim, 0.1, CALM, clock, reader(sim)));
    expect(ofType(evs, 'full').length).toBe(1);
    expect(sim.fill).toBeGreaterThan(0.2);
  });

  it('walks down, shows the closing card (Luke 11:13), then up with thanksgiving, then the ascent’s card', () => {
    const sim = later({ planned: 900 });
    const clock = { t: 0 };
    const evs = drive(sim, 600, (_t, s) => (s.restBlock ? CALM : HIGH), clock, reader(sim));
    const wholes = ofType(evs, 'whole').map(e => e.dir);
    expect(wholes.slice(0, 2)).toEqual(['down', 'up']);
    const stories = ofType(evs, 'story').map(e => e.kind);
    expect(stories).toContain('down');
    expect(stories).toContain('up');
    const arrivals = ofType(evs, 'arrive');
    const firstUp = arrivals.find(a => a.dir === 'up')!;
    expect(firstUp.place).toBe('feet');
    // thanked places carry both bits until a new round begins
    expect(sim.descentsNow).toBeGreaterThanOrEqual(1);
    expect(sim.ascentsNow).toBeGreaterThanOrEqual(1);
  });

  it('walks only up when the card says so, and starts again after a whole way', () => {
    const sim = later({ planned: 900, progress: { way: 'up' } });
    expect(sim.dir).toBe('up');
    const clock = { t: 0 };
    const evs = drive(sim, 500, (_t, s) => (s.restBlock ? CALM : HIGH), clock, reader(sim));
    expect(ofType(evs, 'arrive')[0].place).toBe('feet');
    expect(ofType(evs, 'whole').every(e => e.dir === 'up')).toBe(true);
    expect(ofType(evs, 'again').length).toBeGreaterThanOrEqual(1);
    expect(sim.lit.feet & LIT_UP || sim.round > 1).toBeTruthy();
  });

  it('shows own words at every place instead of the prayer', () => {
    const sim = later({ progress: { own: '  Przez Jezusa Chrystusa, Duchu Święty, wypełnij to miejsce  ' } });
    drive(sim, RULES.heavenSec + 0.2, MID);
    expect(sim.line).toBe('Przez Jezusa Chrystusa, Duchu Święty, wypełnij to miejsce');
    const plain = later();
    drive(plain, RULES.heavenSec + 0.2, MID);
    expect(plain.line).toBe(lineAt('mind', 'down'));
  });
});

describe('the light and the signal', () => {
  it('drives the light with focus in a sighted push past its lead-in; the gauge shows it', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 2, HIGH, clock);
    expect(sim.meter()).toBeNull();
    drive(sim, 6, HIGH, clock);
    expect(sim.light).toBeGreaterThan(0.85);
    expect(sim.meter()).toBeCloseTo(sim.light, 9);
    expect(sim.goldOn).toBe(true);
    const low = later();
    drive(low, 8, LOW);
    expect(low.light).toBeLessThan(0.3);
    expect(low.goldOn).toBe(false);
  });

  it('freezes at the neutral base without a signal: no gauge, no gold, the place still fills', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 12, NONE, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.goldOn).toBe(false);
    expect(sim.light).toBeCloseTo(RULES.baseLight, 2);
    expect(sim.fill + sim.placesNow).toBeGreaterThan(0.3);
  });

  it('a blind push hides the gauge and the song, gathers unseen and shows it at the block’s end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    // wait for the light to arrive at a place inside the dark block
    while (sim.blind && sim.stage !== 'at') drive(sim, 0.1, HIGH, clock, reader(sim));
    const shown = sim.fill;
    const scoreAt = sim.score;
    drive(sim, 4, HIGH, clock, reader(sim));
    if (sim.blind) {
      expect(sim.meter()).toBeNull();
      expect(sim.songLevel(HIGH)).toBeNull();
      expect(sim.padLevel(HIGH)).toBeNull();
      expect(sim.fill).toBe(shown);
      expect(sim.hidden).toBeGreaterThan(0);
      // the headline flows at the base: no leak of the hidden light
      expect(sim.score - scoreAt).toBeLessThanOrEqual(Math.ceil(4 * RULES.dropPush * (0.5 + RULES.baseLight)) + 1);
    }
    let guard = 0;
    const evs: SimEvent[] = [];
    while (sim.blind && guard++ < 2000) evs.push(...drive(sim, 0.1, HIGH, clock, reader(sim)));
    const end = ofType(evs, 'blindEnd')[0];
    expect(end).toBeTruthy();
    expect(end.share).toBeGreaterThan(0.5);
    drive(sim, RULES.revealSec + 0.2, CALM, clock, reader(sim));
    expect(sim.fill).toBeGreaterThan(shown);
  });

  it('rest: the light glows steadily, the breath turns in 4 / out 6, calm gathers drops and abiding', () => {
    const sim = later();
    const clock = { t: 0 };
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    const s0 = sim.score;
    const evs = drive(sim, 12, CALM, clock, reader(sim));
    const turns = ofType(evs, 'breathTurn');
    expect(turns.length).toBeGreaterThanOrEqual(2);
    expect(BREATH).toBe(10);
    expect(sim.meter()).toBeCloseTo(sim.calmShown, 9);
    expect(sim.light).toBeCloseTo(RULES.restLight, 1);
    expect(sim.score - s0).toBeGreaterThan(12);
    expect(sim.abideNow).toBeGreaterThan(5);
    expect(sim.longestNow).toBeGreaterThan(5);
    // calm pays more than a restless rest
    const restless = later();
    const c2 = { t: 0 };
    while (!restless.restBlock) drive(restless, 0.25, MID, c2, reader(restless));
    const r0 = restless.score;
    drive(restless, 12, frame({ calm: 0.1, level: 0.8, activity: 4 }), c2, reader(restless));
    expect(restless.score - r0).toBeLessThan(sim.score - s0);
    expect(restless.abideNow).toBe(0);
  });

  it('the hands stay with the place: a little light, less for a flurry, the prayer shown again', () => {
    const sim = later();
    const clock = { t: 0 };
    untilAt(sim, 'mind', NONE, clock);
    const f0 = sim.fill;
    sim.stay();
    const one = sim.fill - f0;
    expect(one).toBeCloseTo(RULES.tap, 3);
    expect(sim.reshow).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) sim.stay();
    const f1 = sim.fill;
    sim.stay();
    expect(sim.fill - f1).toBeLessThan(one * 0.3);
    // Space does the same
    drive(sim, 6, NONE, clock);
    const f2 = sim.fill;
    expect(sim.key(' ', true)).toBe(true);
    expect(sim.fill).toBeGreaterThan(f2);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    for (const fresh of [true, false]) {
      const sim = fresh ? makeSim({ tuning: BEGINNER, planned: 60 }) : later({ planned: 60 });
      let next = 0.65, space = 2;
      const clock = { t: 0 };
      const seen: number[] = [];
      const evs = drive(sim, 22, HIGH, clock, tt => {
        if (tt >= next) {
          next += 0.65;
          sim.stay();
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
      expect(ofType(evs, 'tap').length).toBeGreaterThan(10);
      expect(sim.placesNow).toBeGreaterThanOrEqual(1);
    }
  });

  it('opens the first session with the two-page story card and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story).toMatchObject({ kind: 'open', page: 0, pages: 2 });
    expect(sim.block.kind).toBe('warmup');
    const clock = { t: 0 };
    const evs = drive(sim, 1, MID, clock);
    sim.stay();
    expect(sim.story!.page).toBe(1);
    evs.push(...drive(sim, 1, MID, clock));
    sim.stay();
    expect(sim.story).toBeNull();
    evs.push(...drive(sim, 90, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim)));
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('tap');
    expect(coach).toContain('light');
    expect(coach).toContain('petals');
    expect(coach).toContain('breath');
    // a returning player hears nothing twice
    const again = makeSim({ progress: { ...sim.p } });
    expect(again.story).toBeNull();
    const ev2 = drive(again, 60, MID);
    expect(ofType(ev2, 'coach').map(e => e.what)).not.toContain('tap');
  });

  it('keeps the narrator quiet while a coach mark is up, and lets it speak after', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 6, MID, clock);
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

  it('settles once at the end (or early), counting the session, its places and ways', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, HIGH, { t: 0 }, reader(sim));
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    expect(timesLit(sim.p, 'mind')).toBeGreaterThanOrEqual(1);
    expect(sim.p.drops).toBe(sim.score);
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
    for (const id of ['jhn7.38-39', 'act2.17', 'isa11.2', 'luk11.13', 'psa141.2', 'php4.7'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    const way = later({ planned: 900 });
    drive(way, 520, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(way));
    const v = way.closingVerse();
    expect(['psa141.2', 'luk11.13', 'php4.7', 'act2.17', 'isa11.2', 'jhn7.38-39']).toContain(v);
    expect(makeSim().closingVerse()).toBe('jhn7.38-39');
  });

  it('says what happened in the summary: readable stats and highlights', () => {
    const sim = later({ planned: 600 });
    drive(sim, 300, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(sim));
    const r = sim.result();
    expect(r.stats.length).toBeGreaterThanOrEqual(6);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
    expect(r.highlights[0]).toBe(t('hl.down'));
  });

  it('pays a 5-minute session roughly 500–2000 drops with mid focus and some taps', () => {
    const sim = later({ planned: 300 });
    let next = 2;
    drive(sim, 300, (_t, s) => (s.restBlock ? frame({ calm: 0.6 }) : MID), { t: 0 }, tt => {
      if (tt >= next) { next += 2; sim.stay(); }
      if (sim.story && sim.story.t > 1) sim.stay();
    });
    expect(sim.score).toBeGreaterThan(500);
    expect(sim.score).toBeLessThan(2000);
  });

  it('lets the rivers from the pool grow with the drops', () => {
    const sim = later();
    expect(sim.river).toBe(0);
    drive(sim, 60, MID, { t: 0 }, reader(sim));
    expect(sim.river).toBeGreaterThan(0);
    expect(sim.river).toBeLessThanOrEqual(1);
  });
});

describe('the meta', () => {
  it('counts the places lit each way and glows them on the lobby’s figure', () => {
    const p = freshProgress();
    expect(placesLit(p)).toBe(0);
    expect(mapGlow(p, 'heart')).toBe(0);
    countPlace(p, 'heart', 'down');
    countPlace(p, 'heart', 'up', 2);
    expect(timesLit(p, 'heart')).toBe(3);
    expect(placesLit(p)).toBe(1);
    expect(mapGlow(p, 'heart')).toBeGreaterThan(0.35);
    countPlace(p, 'heart', 'down', 100);
    expect(mapGlow(p, 'heart')).toBeLessThanOrEqual(1);
  });

  it('makes a window richer the more often its place is lit: gilded at 3, a crown of glass at 10, golden tracery at 25', () => {
    expect([0, 2, 3, 9, 10, 24, 25, 400].map(windowTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    const p = freshProgress();
    countPlace(p, 'heart', 'down', 2);
    expect(tierOf(p, 'heart')).toBe(0);
    countPlace(p, 'heart', 'up', 1);
    expect(tierOf(p, 'heart')).toBe(1);
    for (const k of [1, 2, 3] as const) expect(tierName(k).length).toBeGreaterThan(3);
    expect(tierName(0)).toBe('');
    // in play: the crown lit for the third time earns its gilding, said once, kept in the summary
    const sim = later({ progress: { down: { mind: 2, eyes: 0, mouth: 0, heart: 0, breath: 0, inner: 0, feet: 0 } } });
    expect(sim.tiers.mind).toBe(0);
    const evs = drive(sim, 40, HIGH, { t: 0 }, reader(sim));
    const tiers = ofType(evs, 'tier');
    expect(tiers[0]).toMatchObject({ place: 'mind', tier: 1 });
    expect(sim.tiers.mind).toBe(1);
    expect(sim.result().highlights.join(' ')).toMatch(new RegExp(tierName(1)));
  });

  it('chooses the way and keeps own words as plain text', () => {
    const p = freshProgress();
    expect(p.way).toBe('both');
    expect(setWay(p, 'up')).toBe(true);
    expect(p.way).toBe('up');
    expect(setWay(p, 'sideways')).toBe(false);
    expect(p.way).toBe('up');
    expect(setOwn(p, '<i>Moje</i> słowa')).toBe('i Moje /i słowa');
    expect(setOwn(p, '   ')).toBe('');
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and keeps the count', () => {
    const p = mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as RzekiProgress;
    migrate(p);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.way).toBe('both');
    expect(p.own).toBe('');
    expect(p.song).toBe(true);
    expect(migrate(p)).toBe(p);
    expect(bestOf(p)).toBeNull();
    // and it plays
    const sim = new RzekiSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: true, tuning: TUNING });
    sim.start();
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('keeps a realistic version-1 save and repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, way: 'down', own: 'Moje <słowa>\n', down: { heart: 3, mind: 'x', ghost: 4 }, up: [1, 2], descents: 2,
      ascents: 'many', best: { '300': 840, '180': 'x' }, drops: 2400.7, abideBest: 24.5, abideAll: -3, song: false, seen: ['c.tap', 3], lastLen: 300,
    };
    const p = mergeSaved(freshProgress(), saved) as RzekiProgress;
    migrate(p);
    expect(p.way).toBe('down');
    expect(p.own).toBe('Moje słowa');
    expect(p.down.heart).toBe(3);
    expect(p.down.mind).toBe(0);
    expect(Object.keys(p.down)).toEqual([...PLACES]);
    expect(p.up.heart).toBe(0);
    expect(p.descents).toBe(2);
    expect(p.ascents).toBe(0);
    expect(p.best).toEqual({ 300: 840 });
    expect(p.drops).toBe(2400);
    expect(p.abideBest).toBe(24.5);
    expect(p.abideAll).toBe(0);
    expect(p.song).toBe(false);
    expect(p.seen).toEqual(['c.tap']);
    expect(bestOf(p)).toBe(840);
    const sim = new RzekiSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.dir).toBe('down');
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, down: 'x', up: 5, best: [], seen: null, way: 7, own: { a: 1 } }]) {
      const p = mergeSaved(freshProgress(), junk) as RzekiProgress;
      migrate(p);
      expect(p.ver).toBe(1);
      expect(typeof p.down).toBe('object');
      expect(p.way).toBe('both');
      expect(p.own).toBe('');
      expect(Array.isArray(p.seen)).toBe(true);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator at least three lines a moment, each fitting a caption (90 characters)', () => {
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

  it('suggests strategies, never to concentrate harder; no chakra words, no “energy”, no promise of healing', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          if (/^(tip|howto)\./.test(k)) expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
          expect(s, `${l}.${k}`).not.toMatch(/czakr|chakra|Chakra|tschakra|kundalini|energi|energy|Energie|uzdrawia|heals you|cures|heilt dich|botar dig|trzecie oko|third eye|dritte Auge|tredje ögat/i);
        }
      }
    }
  });

  it('bends the headline’s unit (1 kropla, 3 krople, 5 kropli) and writes seconds with a no-break space', () => {
    expect(unit(1)).toBe('kropla');
    expect(unit(3)).toBe('krople');
    expect(unit(5)).toBe('kropli');
    expect(unit(22)).toBe('krople');
    expect(secText(42)).toBe('42 s');
    expect(secText(102)).toBe('1:42');
  });
});

describe('mobile first (DESIGN §12, §13.14)', () => {
  it('gives the current place a finger-sized target inside the insets at every checked size, for every place and fill', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets, true);
      for (const p of PLACES) {
        for (const fill of [0, 0.4, 1]) {
          const tg = tapTargets(L, { story: null, place: p, fill });
          expect(tg).toHaveLength(1);
          expect(auditTargets(tg, s.w, s.h, L.ins), `${s.name} ${p} ${fill}`).toEqual([]);
        }
      }
      // a story card takes every tap: the card is the only target
      const card = storyRect(L, 300);
      expect(auditTargets(tapTargets(L, { story: card, place: 'heart', fill: 0.5 }), s.w, s.h, L.ins), s.name).toEqual([]);
      // between ways there is nothing to tap
      expect(tapTargets(L, { story: null, place: null, fill: 0 })).toEqual([]);
    }
  });

  it('lays a phone upright out tall: the figure in the middle, the prayer below it, nothing under the HUD or off the band', () => {
    for (const s of CHECK_SIZES.filter(c => c.h > c.w)) {
      const L = layout(s.w, s.h, s.insets, true);
      expect(L.shape, s.name).toBe('tall');
      expect(L.fig.cx).toBeCloseTo((L.left + L.right) / 2, 5);
      // the feet and the pool stand above the prayer band, the crown below the HUD
      expect(L.fig.top + 1.06 * L.fig.H, s.name).toBeLessThanOrEqual(L.prayer.y + 0.5);
      expect(L.fig.top + PLACE.mind.y * L.fig.H - windowR(L, 0.5), s.name).toBeGreaterThanOrEqual(L.top - 0.5);
      expect(L.prayer.y + L.prayer.h, s.name).toBeLessThanOrEqual(L.bottom);
      expect(L.prayer.x).toBeGreaterThanOrEqual(L.left + 16);
      expect(L.prayer.h).toBeGreaterThanOrEqual(100);
      // the figure is big enough to read its places even on the smallest phone
      expect(L.fig.H, s.name).toBeGreaterThan(200);
      // the head's three places are apart on the figure
      expect((PLACE.eyes.y - PLACE.mind.y) * L.fig.H).toBeGreaterThan(14);
      expect((PLACE.mouth.y - PLACE.eyes.y) * L.fig.H).toBeGreaterThan(14);
      // and their lit windows never touch: the crown above the head, the eyes at the brow, the throat on the neck
      for (const [a, b2] of [['mind', 'eyes'], ['eyes', 'mouth'], ['mouth', 'heart']] as const) {
        expect((PLACE[b2].y - PLACE[a].y) * L.fig.H, `${s.name} ${a}–${b2}`).toBeGreaterThan(2 * litR(L) + 2);
      }
      expect(PLACE.mind.y).toBeLessThan(0);
    }
  });

  it('lays a phone on its side and a desktop out wide: the figure on the left, the caption and the prayer beside it', () => {
    for (const s of CHECK_SIZES.filter(c => c.w > c.h)) {
      const L = layout(s.w, s.h, s.insets, false);
      expect(['side', 'wide'], s.name).toContain(L.shape);
      expect(L.prayer.x, s.name).toBeGreaterThan(L.fig.cx + 0.25 * L.fig.H);
      expect(L.prayer.x + L.prayer.w, s.name).toBeLessThanOrEqual(L.right - 15.5);
      expect(L.prayer.y + L.prayer.h, s.name).toBeLessThanOrEqual(L.bottom);
      expect(L.caption.y, s.name).toBeGreaterThanOrEqual(L.top);
      expect(L.caption.y + L.caption.h, s.name).toBeLessThanOrEqual(L.prayer.y);
      // the egg of light fits beside the left edge
      expect(L.fig.cx - 0.33 * L.fig.H, s.name).toBeGreaterThanOrEqual(L.left);
      expect(L.fig.top + L.fig.H, s.name).toBeLessThanOrEqual(L.bottom);
    }
  });

  it('grows on a tablet and a desktop, never past 1.3', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets, true);
      expect(L.u).toBeGreaterThanOrEqual(1);
      expect(L.u).toBeLessThanOrEqual(1.3);
    }
    const tablet = layout(820, 1052, { top: 192, right: 0, bottom: 0, left: 0 }, true);
    expect(tablet.shape).toBe('tall');
    expect(tablet.fig.H).toBeGreaterThan(500);
  });

  it('never draws text under 11 px; the prayer is at least 15 px and what is read at least 13', () => {
    for (const px of [4, 9, 10.9, 11, 13, 17]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(6)).toMatch(/ 11px /);
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets, true);
      expect(L.font.prayerMin).toBeGreaterThanOrEqual(15);
      expect(L.font.prayer).toBeGreaterThanOrEqual(15);
      expect(L.font.label).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.caption).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.small).toBeGreaterThanOrEqual(MIN_TEXT);
    }
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const touch = howto(true), keys = howto(false);
    expect(touch.hands.every(hd => hd.gesture !== 'keys')).toBe(true);
    expect(keys.hands.some(hd => hd.gesture === 'keys')).toBe(true);
    expect(touch.tips!.length).toBeLessThanOrEqual(2);
    expect(coachText('tap', true)).not.toMatch(/spacj|klik/i);
    expect(coachText('tap', false)).toMatch(/spacj/i);
    for (const w of ['light', 'petals', 'breath', 'drops', 'blind'] as const) expect(coachText(w, true).length).toBeGreaterThan(10);
  });
});

describe('the rose windows (rose.ts)', () => {
  // happy-dom has no Path2D: a stand-in that takes the calls (the geometry, not the pixels, is under test)
  const g = globalThis as { Path2D?: unknown };
  const had = !!g.Path2D;
  beforeAll(() => {
    if (!had) g.Path2D = class { moveTo() {} lineTo() {} arc() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} ellipse() {} };
  });
  afterAll(() => {
    if (!had) delete g.Path2D;
  });

  it('builds the oculus, the inner and outer petals and a foil between the outer ones', () => {
    for (const p of PLACES) {
      const r = PLACE[p].rose;
      const all = pieces(r, 40);
      expect(all.filter(x => x.ring === 'c')).toHaveLength(1);
      expect(all.filter(x => x.ring === 'i')).toHaveLength(r.inner);
      expect(all.filter(x => x.ring === 'o')).toHaveLength(r.outer);
      expect(all.filter(x => x.ring === 'f')).toHaveLength(r.outer);
      for (const pc of all) {
        expect(pc.r1).toBeLessThanOrEqual(40 * RING.o + 1e-9);
        expect(pc.r0).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('opens the oculus first, then petal by petal, each filling from its base; nothing is opening when full', () => {
    const r = PLACE.heart.rose;
    expect(openness(r, 0)).toEqual({ oculus: 0, inner: 0, outer: 0 });
    expect(openness(r, 0.05).oculus).toBeGreaterThan(0.5);
    expect(partPath(r, 40, 1)).toBeNull();
    expect(partPath(r, 40, RULES.innerShare * 0.5)).not.toBeNull();
    expect(openness(r, 1)).toEqual({ oculus: 1, inner: r.inner, outer: r.outer });
    expect(petalAngle(0, 4)).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('the chorale (kit/song.ts)', () => {
  it('is a well-formed slow hymn without words or drums, in the key of the place bells', () => {
    const song = buildHymn();
    expect(songProblems(song)).toEqual([]);
    expect(song.bpm).toBeLessThanOrEqual(60);
    expect(song.lines).toEqual([]);
    expect(song.parts.some(p => p.voice === 'kick' || p.voice === 'snare' || p.voice === 'hat')).toBe(false);
    expect(song.parts.find(p => p.layer === 0)?.voice).toBe('pad');
    // D major: the root is a D (146.83 Hz, D3), the bells' D5 two octaves up
    expect(song.root).toBeCloseTo(146.83, 2);
  });

  it('follows the light in a sighted push, rests at a gentle level, and holds still in a blind block', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    drive(sim, 8, HIGH, clock);
    expect(sim.songLevel(HIGH)).toBeCloseTo(HIGH.level, 9);
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    expect(sim.songLevel(CALM)).toBeCloseTo(0.34, 9);
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    expect(sim.songLevel(HIGH)).toBeNull();
  });
});
