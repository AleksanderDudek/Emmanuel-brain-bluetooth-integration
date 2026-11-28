import { describe, expect, it } from 'vitest';
import { BREATH_DEFAULT, BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import {
  CLOSE_VERSES, FRUIT, FRUITS, LAYERS, MOMENTS, REST_VERSES, SEASONS, fruitAt, layersFor, seasonOfDay, treePart,
} from '../src/arcade/drzewo/content';
import { CATALOGS, FRUIT_KEYS, fruitList, t, unit } from '../src/arcade/drzewo/i18n';
import { bestOf, freshProgress, migrate, setNext, setPosture, setSeason, type DrzewoProgress } from '../src/arcade/drzewo/meta';
import { RULES, focusRate, planFor, readTime } from '../src/arcade/drzewo/rules';
import { pageTime } from '../src/arcade/drzewo/sim';
import { DrzewoSim, pageOf, type SimEvent } from '../src/arcade/drzewo/sim';
import { ALWAYS } from '../src/arcade/drzewo/talk';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { camFor, crownRect, layout, pickerParts, previewLayout, tapTargets, type Layout } from '../src/arcade/drzewo/layout';
import { worldTop as worldTopOf } from '../src/arcade/drzewo/tree';
import { BOTTOM, DEPTH, SEATED_OUTLINE, branchesFor, crownOf, fruitPlace, grownTo, leavesFor, rootsFor, stonesFor, tipsAt } from '../src/arcade/drzewo/tree';
import { OUTLINE } from '../src/arcade/kit/figure';
import { drzewoRhythm, howto } from '../src/arcade/drzewo/index';
import { restKept, restsIn, rhythmOf } from '../src/arcade/kit/rhythm';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 20, calm: 0.05 });
const MID = frame({ level: 0.55, activity: 2.2, focused: true, hold: 4, calm: 0.4 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.grow', 'c.breath', 'c.tap', 'c.menu', 'c.blind'];

type SimOpts = {
  progress?: Partial<DrzewoProgress>; planned?: number; seed?: number; eeg?: boolean; day?: string;
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
};

function makeSim(o: SimOpts = {}): DrzewoSim {
  const sim = new DrzewoSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: TUNING, day: o.day ?? '2026-11-22', rhythm: o.rhythm,
  });
  sim.start();
  return sim;
}

/** A returning player: no opening card, no coach marks. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: DrzewoSim, sec: number, f: FocusFrame | ((t: number, sim: DrzewoSim) => FocusFrame), clock = { t: 0 }): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    out.push(...sim.take());
    if (sim.story && sim.story.t > 1.5) sim.stay();
  }
  return out;
}

/** Play a whole session to its end. */
function playAll(sim: DrzewoSim, f: FocusFrame | ((t: number, sim: DrzewoSim) => FocusFrame)): { events: SimEvent[]; clock: { t: number } } {
  const clock = { t: 0 };
  const events = drive(sim, sim.plannedSec + 8, f, clock);
  return { events, clock };
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/**
 * An average player: in a push past its lead-in, focused about 7 s in every 10 (a little above the threshold, the
 * hold building through each stretch), then 3 s below it; calm in rest.
 */
function average(_: number, sim: DrzewoSim): FocusFrame {
  if (sim.pushBlock) {
    const x = (sim.blockT - sim.lead) % 10;
    if (sim.blockT < sim.lead || x >= 7) return frame({ level: 0.38, activity: 1.4, focused: false, hold: 0, calm: 0.4 });
    return frame({ level: 0.62, activity: 2.8, focused: true, hold: x, calm: 0.25 });
  }
  return frame({ level: 0.3, activity: 0.5, focused: false, calm: 0.62 });
}

describe('the fruits, the soil, the passages (content.ts)', () => {
  it('has the nine fruits of the Spirit in Galatians’ order, each its own colour and shape', () => {
    expect(FRUITS).toEqual(['love', 'joy', 'peace', 'patience', 'kindness', 'goodness', 'faithfulness', 'gentleness', 'control']);
    expect(new Set(FRUITS.map(f => FRUIT[f].color)).size).toBe(9);
    expect(new Set(FRUITS.map(f => FRUIT[f].shape)).size).toBe(9);
    expect(fruitAt(9)).toBe('love');
    expect(fruitAt(-1)).toBe('control');
  });

  it('names every fruit in the four languages with natural words, and the verse quotes each edition', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const k of FRUIT_KEYS) expect((CATALOGS[l] as Record<string, unknown>)[k], `${l}.${k}`).toBeTruthy();
    }
    expect(CATALOGS.pl['fruit.control.name']).toBe('opanowanie');
    expect(CATALOGS.en['fruit.control.name']).toBe('self-control');
    expect(passage('gal5.22-23', 'pl').text).toContain('owoc Ducha');
  });

  it('goes through more layers of soil in a longer session, the deepest above the stream', () => {
    expect(layersFor(2)).toEqual(['humus', 'stones']);
    expect(layersFor(6)).toEqual([...LAYERS]);
    for (let n = 2; n <= 6; n++) expect(layersFor(n)).toHaveLength(n);
  });

  it('rests on passages that exist, and closes with Jer 17:7 or Ps 92:12-13', () => {
    for (const list of Object.values(REST_VERSES)) for (const id of list) expect(passage(id, 'pl').text.length).toBeGreaterThan(10);
    expect(CLOSE_VERSES).toEqual(['jer17.7', 'psa92.12-13']);
    expect(pageOf('open', 0).verse).toBe('psa1.3');
  });

  it('knows the calendar’s season and the tree’s parts', () => {
    expect(seasonOfDay('2026-11-22')).toBe('autumn');
    expect(seasonOfDay('2026-01-05')).toBe('winter');
    expect(seasonOfDay('2026-04-05')).toBe('spring');
    expect(seasonOfDay('2026-07-05')).toBe('summer');
    expect(SEASONS).toHaveLength(4);
    expect(treePart(0.1)).toBe('trunk');
    expect(treePart(0.5)).toBe('branches');
    expect(treePart(0.9)).toBe('crown');
  });
});

describe('light only from real focus', () => {
  it('grows only while focused: faster above the threshold and as the focus is held', () => {
    expect(focusRate(0.9, false, 20)).toBe(0);
    expect(focusRate(0.5, true, 0)).toBeCloseTo(1, 5);
    expect(focusRate(0.9, true, 0)).toBeGreaterThan(focusRate(0.5, true, 0));
    expect(focusRate(0.6, true, 20)).toBeGreaterThan(focusRate(0.6, true, 0));
    expect(focusRate(1, true, 999)).toBeCloseTo(1.5, 5);
  });

  it('grows nothing in the posture, the lead-in, rest, without a signal or below the threshold', () => {
    const sim = later({ planned: 600 });
    drive(sim, 3 * sim.plan.cueSec - 0.2, HIGH);
    expect(sim.postureBlock).toBe(true);
    expect(sim.rootG).toBe(0);
    const clock = { t: 3 * sim.plan.cueSec - 0.2 };
    drive(sim, 0.4, HIGH, clock);
    expect(sim.pushBlock).toBe(true);
    drive(sim, sim.lead - 0.5, HIGH, clock);
    expect(sim.rootG).toBe(0);
    drive(sim, 20, LOW, clock);
    expect(sim.rootG).toBe(0);
    drive(sim, 20, NONE, clock);
    expect(sim.rootG).toBe(0);
    drive(sim, 3, MID, clock);
    expect(sim.rootG).toBeGreaterThan(0);
  });

  it('never grows from taps: a tap shows the words again', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + sim.lead + 1, LOW, clock);
    for (let i = 0; i < 40; i++) {
      sim.stay();
      drive(sim, 0.5, LOW, clock);
    }
    expect(sim.rootG).toBe(0);
    expect(sim.reshow).toBeGreaterThan(0);
  });

  it('never goes back: under random signal the roots, the tree and the fruits only grow', () => {
    const rnd = mulberry32(7);
    const sim = later({ planned: 900 });
    let last = { r: 0, g: 0, f: 0 };
    const clock = { t: 0 };
    for (let i = 0; i < 900 * 3; i++) {
      const v = rnd();
      const f = v < 0.15 ? NONE : v < 0.45 ? LOW : v < 0.8 ? MID : HIGH;
      drive(sim, 1 / 3, f, clock);
      const now = { r: sim.rootG, g: sim.treeG, f: sim.fruitsNow };
      expect(now.r).toBeGreaterThanOrEqual(last.r - 1e-9);
      expect(now.g).toBeGreaterThanOrEqual(last.g - 1e-9);
      expect(now.f).toBeGreaterThanOrEqual(last.f);
      last = now;
    }
  });
});

describe('the plan fits the whole arc into any length (DESIGN §17)', () => {
  for (const min of [3, 5, 10, 15, 20, 25, 30]) {
    it(`walks an average player through ${min} minutes: stream, crown, the planned fruits — near the end, never at 40 %`, () => {
      const sim = later({ planned: min * 60 });
      playAll(sim, average);
      const T = min * 60;
      expect(sim.phase).toBe('done');
      expect(sim.streamReached).toBe(true);
      expect(sim.crownWhole).toBe(true);
      expect(sim.fruitsNow).toBeGreaterThanOrEqual(min <= 3 ? 3 : min <= 5 ? 5 : 9);
      // the planned arc's last fruit ripens in the session's last part, not early
      const lastPlanned = sim.ripeAt[sim.plan.fruits - 1];
      expect(lastPlanned / T).toBeGreaterThan(0.6);
      expect(lastPlanned / T).toBeLessThan(0.97);
      // the stream and the crown come in their order, neither at the very start nor at the end
      expect(sim.streamAt).toBeLessThan(sim.crownAt);
      expect(sim.crownAt / T).toBeLessThan(0.6);
      // the wind's rest closes it, then the finale
      const wind = sim.blocks.findIndex(b => b.rest === 'wind');
      expect(wind).toBeGreaterThan(0);
      expect(sim.blocks.filter(b => b.rest === 'wind')).toHaveLength(1);
    });
  }

  it('deepens long sessions: more soil, more stations, more breaths, fruits in two steps', () => {
    const p3 = planFor(180, BREATH_DEFAULT), p10 = planFor(600, BREATH_DEFAULT), p30 = planFor(1800, BREATH_DEFAULT);
    expect(p3.layers).toBeLessThan(p10.layers);
    expect(p10.layers).toBeLessThan(p30.layers);
    expect(p3.roots).toBeLessThan(p30.roots);
    expect(p3.trunk).toBeLessThan(p30.trunk);
    expect(p3.steps).toBe(1);
    expect(p30.steps).toBe(2);
    expect(p3.restCycles).toBeLessThan(p30.restCycles);
    for (const p of [p3, p10, p30]) {
      for (const n of [p.needRoot, p.needTrunk, p.needFruit]) {
        expect(n).toBeGreaterThanOrEqual(RULES.needMin);
        expect(n).toBeLessThanOrEqual(RULES.needMax);
      }
    }
  });
});

describe('the blocks: a rest of whole breaths after every station', () => {
  it('opens every session with the three posture cues (not gated), then the roots', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, 1, LOW);
    expect(sim.postureBlock).toBe(true);
    expect(ofType(evs, 'cue')).toHaveLength(1);
    expect(sim.line).toBe(t('cue.sit.1'));
    drive(sim, sim.plan.cueSec, LOW);
    expect(sim.line).toBe(t('cue.sit.2'));
    drive(sim, 2 * sim.plan.cueSec, LOW);
    expect(sim.pushBlock).toBe(true);
    expect(sim.kind).toBe('roots');
  });

  it('rests after each full station in whole breaths of the saved pattern, the water after the stream, a fruit’s reflection after a fruit', () => {
    for (const pat of [BREATH_DEFAULT, BREATH_PRESETS.box]) {
      const sim = later({ planned: 600, progress: { breath: { ...pat } } });
      const { events } = playAll(sim, HIGH);
      const rests = sim.blocks.filter(b => b.kind === 'rest');
      expect(rests.length).toBeGreaterThan(5);
      for (const r of rests) {
        expect(r.dur / breathCycle(pat)).toBeCloseTo(Math.round(r.dur / breathCycle(pat)), 6);
        expect(r.cycles).toBeGreaterThanOrEqual(1);
      }
      const kinds = rests.map(r => r.rest);
      expect(kinds).toContain('water');
      expect(kinds).toContain('crown');
      expect(kinds).toContain('fruit');
      expect(kinds[kinds.length - 1]).toBe('wind');
      expect(kinds.indexOf('water')).toBeLessThan(kinds.indexOf('crown'));
      expect(ofType(events, 'stream')).toHaveLength(1);
    }
  });

  it('opens the safety valve for a push that cannot grow: a rest, the station keeps what it had', () => {
    const sim = later({ planned: 900 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + sim.lead + 3, MID, clock);
    const had = sim.rootG;
    expect(had).toBeGreaterThan(0);
    const evs = drive(sim, RULES.valveStall + 2, LOW, clock);
    expect(ofType(evs, 'valve')).toHaveLength(1);
    expect(sim.restKind).toBe('valve');
    expect(sim.rootG).toBeCloseTo(had, 9);
  });

  it('makes every 4th push blind from the 3rd session, never the first; a blind push grows unseen and shows it at its end', () => {
    const sim = later({ planned: 900, progress: { sessions: 4, pushes: 2 } });
    const { events } = playAll(sim, HIGH);
    const pushes = sim.blocks.filter(b => b.kind === 'push');
    expect(pushes[0].blind).toBe(false);
    expect(pushes.filter(b => b.blind).length).toBeGreaterThan(0);
    pushes.forEach((b, i) => expect(b.blind).toBe(i > 0 && (2 + i + 1) % 4 === 0));
    expect(ofType(events, 'blindEnd').some(e => e.gained > 0)).toBe(true);
    const first = later({ planned: 900, progress: { sessions: 1, pushes: 3 } });
    playAll(first, HIGH);
    expect(first.blocks.some(b => b.blind)).toBe(false);
  });

  it('judges each push and rest once at its end; a push under 10 s is not judged', () => {
    const sim = later({ planned: 600 });
    const { events } = playAll(sim, HIGH);
    const ends = ofType(events, 'blockEnd');
    expect(ends.length).toBe(sim.blocks.filter(b => b.len > 0).length);
    for (const e of ends) if (e.block.kind === 'push' && e.block.len < RULES.judgeMin) expect(e.verdict).toBeNull();
  });

  it('gives the strategy of the stage in a push (imagery, the fruit’s own picture), the breath in rest — never “concentrate harder”', () => {
    const sim = later({ planned: 600 });
    const tips = new Set<string>();
    const clock = { t: 0 };
    for (let i = 0; i < 600 * 2; i++) { drive(sim, 0.5, HIGH, clock); if (sim.tip) tips.add(sim.tip); }
    expect([...tips].some(s => s === t('tip.roots.1') || s === t('tip.roots.2') || s === t('tip.roots.3'))).toBe(true);
    expect([...tips].some(s => FRUITS.some(f => s === t(`fruit.${f}.task` as never)))).toBe(true);
    for (const s of tips) expect(s).not.toMatch(/mocniej|bardziej się skup|harder/i);
  });

  it('says what to do now in one line that changes only with the action', () => {
    const sim = later({ planned: 600 });
    const seen = new Set<string>();
    const clock = { t: 0 };
    for (let i = 0; i < 600 * 2; i++) { drive(sim, 0.5, i % 40 < 30 ? HIGH : LOW, clock); seen.add(sim.now); }
    for (const w of ['posture', 'roots', 'trunk', 'fruit', 'rest', 'wind', 'end']) expect(seen.has(w as never), w).toBe(true);
  });
});

describe('the fruits go on next session', () => {
  it('saves the next fruit, the light gathered in it and the round of nine; the next session ripens on from there', () => {
    const sim = later({ planned: 180 });
    playAll(sim, average);
    const p = sim.p;
    expect(p.sessions).toBe(6);
    expect(p.next).toBe(sim.fruitsNow % 9);
    expect(p.ripe.filter(Boolean)).toHaveLength(sim.fruitsNow);
    const next = new DrzewoSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: false, tuning: TUNING, day: '2026-11-22' });
    next.start();
    expect(next.fruit).toBe(fruitAt(p.next));
    // the fruits ripe in the round hang on the tree from the start (shown once the crown has grown)
    expect(next.hang.filter(h => h.before)).toHaveLength(sim.fruitsNow);
    playAll(next, average);
    expect(next.ripened[0]).toBe(fruitAt(sim.fruitsNow));
  });

  it('completes a round of nine as a harvest, then ripens second fruits (much fruit)', () => {
    const sim = later({ planned: 900, progress: { next: 6, ripe: [true, true, true, true, true, true, false, false, false] } });
    const { events } = playAll(sim, HIGH);
    expect(ofType(events, 'harvest').length).toBeGreaterThanOrEqual(1);
    expect(sim.p.harvests).toBeGreaterThanOrEqual(1);
    expect(sim.hang.filter(h => h.fruit === 'love').length).toBeGreaterThanOrEqual(2);
  });

  it('starts from a chosen fruit (the album) and keeps posture, season and breath', () => {
    const p = freshProgress();
    expect(setNext(p, 3)).toBe(true);
    expect(setNext(p, 9)).toBe(false);
    expect(setPosture(p, 'stand')).toBe(true);
    expect(setPosture(p, 'lie')).toBe(false);
    expect(setSeason(p, 'winter')).toBe(true);
    expect(setSeason(p, 'monsoon')).toBe(false);
    const sim = new DrzewoSim({ progress: p, rng: mulberry32(1), plannedSec: 300, eeg: false, tuning: TUNING });
    expect(sim.fruit).toBe('patience');
    expect(sim.posture).toBe('stand');
    expect(sim.season).toBe('winter');
  });

  it('turns the year through a long session on auto; a short one takes the calendar’s season', () => {
    expect(later({ planned: 300, day: '2026-07-01' }).season).toBe('summer');
    const sim = later({ planned: 1200 });
    const seen = new Set<string>();
    const clock = { t: 0 };
    for (let i = 0; i < 1210 * 2; i++) { drive(sim, 0.5, HIGH, clock); seen.add(sim.season); }
    expect([...seen]).toEqual(['spring', 'summer', 'autumn', 'winter']);
  });
});

describe('the hands', () => {
  it('opens a ripe fruit’s card (its reflection; again: the second), closes it with a tap; the picker opens and closes', () => {
    const sim = later({ planned: 300 });
    drive(sim, 2, LOW);
    expect(sim.openFruit('joy')).toBe(true);
    expect(sim.card?.page).toBe(1);
    sim.openFruit('joy');
    expect(sim.card?.page).toBe(2);
    sim.stay();
    expect(sim.card).toBeNull();
    sim.openPicker();
    expect(sim.picker).toBe(true);
    drive(sim, RULES.pickerIdle + 1, LOW);
    expect(sim.picker).toBe(false);
    expect(sim.key('m', true)).toBe(true);
    expect(sim.picker).toBe(true);
    sim.key('Escape', true);
    expect(sim.picker).toBe(false);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space now and then, focus on) within 22 s of 40', () => {
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    for (let i = 0; i < 34 && sim.score === 0; i++) {
      drive(sim, 0.65, HIGH, clock);
      sim.stay();
      if (i % 3 === 0) sim.key(' ', true);
    }
    expect(sim.score).toBeGreaterThan(0);
    expect(clock.t).toBeLessThan(22);
  });

  it('opens the first session with the two-page story card, and the closing card in the finale', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.story?.kind).toBe('open');
    expect(sim.story?.pages).toBe(2);
    const { events } = playAll(sim, MID);
    expect(ofType(events, 'story').some(e => e.kind === 'close')).toBe(true);
    expect(ofType(events, 'finale')).toHaveLength(1);
    expect(sim.p.seen).toContain('s.open');
  });

  it('gives result() idempotently, the record only with Math.max, and settles once', () => {
    const sim = later({ planned: 300, progress: { best: { 300: 2 } } });
    playAll(sim, HIGH);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.best['300']).toBe(Math.max(2, sim.fruitsNow));
    expect(a.record).toBe(sim.fruitsNow > 2);
    const fruits = sim.p.fruits;
    sim.finish();
    expect(sim.p.fruits).toBe(fruits);
    expect(sim.p.sessions).toBe(6);
  });

  it('closes with a passage that exists, and keeps the summary short even at 30 minutes', () => {
    const sim = later({ planned: 1800 });
    playAll(sim, HIGH);
    const r = sim.result();
    expect(passage(r.verse!, 'pl').text.length).toBeGreaterThan(10);
    expect(r.highlights.length).toBeLessThanOrEqual(5);
    for (const h of r.highlights) expect(h.length).toBeLessThan(120);
    expect(r.stats.length).toBeLessThanOrEqual(6);
    expect(fruitList(sim.ripened)).toMatch(/\+\d+$/);
    expect(sim.hang.length).toBeLessThanOrEqual(9 * 4);
  });

  it('works with HALO (a 2 s lead-in) as with Mendi', () => {
    const sim = later({ planned: 600, eeg: true });
    expect(sim.lead).toBe(2);
    playAll(sim, average);
    expect(sim.fruitsNow).toBeGreaterThanOrEqual(9);
  });
});

describe('the meta', () => {
  it('reads the placeholder’s save and garbage as a fresh progress, repairing every field of a wrong type', () => {
    const fromPlaceholder = migrate(mergeSaved(freshProgress(), { best: null }) as DrzewoProgress);
    expect(fromPlaceholder).toEqual(freshProgress());
    const broken = migrate({ ver: 1, sessions: 'x', posture: 'lie', season: 7, next: 41, nextFill: 5, ripe: 'yes', count: { love: -3 }, best: { 300: 'a', 600: 4 }, seen: [1, 'a', 'a'] } as unknown as DrzewoProgress);
    expect(broken.sessions).toBe(0);
    expect(broken.posture).toBe('sit');
    expect(broken.season).toBe('auto');
    expect(broken.next).toBe(41 % 9);
    expect(broken.nextFill).toBe(0.99);
    expect(broken.ripe).toEqual(FRUITS.map(() => false));
    expect(broken.count.love).toBe(0);
    expect(broken.best).toEqual({ 600: 4 });
    expect(broken.seen).toEqual(['a']);
    expect(bestOf(broken)).toBe(4);
    expect(migrate(migrate({ ...broken }))).toEqual(broken);
  });
});

/** The words the series never says (DESIGN §18.3), per language. */
const FORBIDDEN: Readonly<Record<'pl' | 'en' | 'de' | 'sv', RegExp>> = {
  pl: /energi|uzdrawia|\b(u|wy)?leczy|czakr|kundalini|\bw[ąę]ż/i,
  en: /energy|heal(s|ing)? power|\bcures?\b|\bheals\b|chakra|kundalini|serpent/i,
  de: /energie|heilt|chakra|kundalini|schlange/i,
  sv: /energi|\bhelar\b|chakra|kundalini|\borm(en|ar)?\b/i,
};

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator three lines a moment, each fitting a caption (90 characters)', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const m of MOMENTS) for (let i = 1; i <= 3; i++) {
        const s = (CATALOGS[l] as Record<string, string>)[`say.${m}.${i}`];
        expect(s, `${l} say.${m}.${i}`).toBeTruthy();
        expect([...s].length, `${l} say.${m}.${i}`).toBeLessThanOrEqual(90);
      }
    }
  });

  it('keeps the series’ forbidden words out of every text — the game’s and the registry’s, but for the origin note', async () => {
    const arcade = await import('../src/i18n/arcade');
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(FORBIDDEN[l]);
      }
      for (const [k, m] of Object.entries(arcade.CATALOGS[l] as Record<string, unknown>)) {
        if (!k.startsWith('drzewo.') || typeof m !== 'string') continue;
        // the origin note is the registry text's last sentence: the tradition's own term may stand there once
        const s = k === 'drzewo.text' ? m.replace(/[^.!?]*[.!?]\s*$/, '') : m;
        expect(s, `${l}.${k}`).not.toMatch(FORBIDDEN[l]);
      }
    }
  });

  it('prays to the Father, through Jesus, in the Holy Spirit; addresses God and never promises healing', () => {
    expect(CATALOGS.pl['pray.roots']).toMatch(/Jezu/);
    expect(CATALOGS.pl['pray.trunk']).toMatch(/Ojcze/);
    expect(CATALOGS.pl['pray.fruit']).toMatch(/Duchu Święty/);
    expect(CATALOGS.pl['story.close.text']).toMatch(/Ojcze.*Jezusa.*Duchu/);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) expect(CATALOGS[l]['howto.tip2']).toMatch(/leczenie|treatment|Behandlung|behandling/);
  });

  it('bends the headline’s unit (1 owoc, 3 owoce, 5 owoców) and keeps a number with its unit', () => {
    expect(unit(1)).toBe('owoc');
    expect(unit(3)).toBe('owoce');
    expect(unit(5)).toBe('owoców');
    expect(t('secs', { n: 4 })).toBe('4 s');
  });

  it('speaks to the player without gendered forms in Polish', () => {
    for (const [k, m] of Object.entries(CATALOGS.pl)) {
      if (k.startsWith('panel.times')) continue;
      for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, k).not.toMatch(/\b(chciałeś|chciałaś|byłeś|byłaś|zakorzeniony|zakorzeniona|wierny|wierna)\b/);
    }
  });
});

describe('the geometry (tree.ts)', () => {
  const stones = stonesFor([1, 1.5, 7, 1.5], 3);
  const roots = rootsFor(5, stones);

  it('grows the main roots from the feet to the stream, steering round the stones; laterals and rootlets from them', () => {
    const mains = roots.filter(r => r.order === 0);
    expect(mains).toHaveLength(4);
    for (const r of mains) {
      expect(r.pts[0][1]).toBe(1);
      expect(r.pts[r.pts.length - 1][1]).toBeGreaterThanOrEqual(1 + DEPTH);
      expect(r.ts[r.ts.length - 1]).toBe(1);
      for (let i = 1; i < r.ts.length; i++) expect(r.ts[i]).toBeGreaterThanOrEqual(r.ts[i - 1]);
      // through no stone's middle
      for (const [x, y] of r.pts) for (const st of stones) expect(Math.hypot((x - st.x) / st.rx, (y - st.y) / st.ry)).toBeGreaterThan(0.6);
    }
    expect(roots.filter(r => r.order === 1).length).toBeGreaterThan(8);
    expect(roots.filter(r => r.order === 2).length).toBeGreaterThan(4);
    expect(grownTo(mains[0], 0)).toBeNull();
    expect(grownTo(mains[0], 1)?.i).toBe(mains[0].pts.length - 1);
    expect(tipsAt(roots, 0.5).length).toBeGreaterThan(3);
    expect(tipsAt(roots, 1)).toHaveLength(0);
    // the same seed, the same roots
    expect(rootsFor(5, stones)).toEqual(roots);
  });

  it('keeps the crown off the face and the fruits apart on its arc, for both postures', () => {
    for (const ps of ['sit', 'stand'] as const) {
      const d = ps === 'sit' ? 0.2 : 0;
      for (const lf of leavesFor(ps)) expect(Math.abs(lf.x) < 0.075 && lf.y > -0.03 + d && lf.y < 0.2 + d).toBe(false);
      const places = FRUITS.map((_, i) => fruitPlace(i, 0, ps));
      for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) expect(Math.hypot(places[i][0] - places[j][0], places[i][1] - places[j][1])).toBeGreaterThan(0.1);
      const c = crownOf(ps);
      for (const [x, y] of places) expect(Math.hypot((x - c.cx) / c.rx, (y - c.cy) / c.ry)).toBeLessThan(1.05);
      expect(branchesFor(ps).length).toBeGreaterThan(10);
    }
  });

  it('seats the figure: kit/figure’s outline lowered, the feet on the ground, symmetric', () => {
    const ys = SEATED_OUTLINE.map(p => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(0.2, 5);
    expect(Math.max(...ys)).toBeLessThan(1);
    const n = SEATED_OUTLINE.length;
    expect(n % 2).toBe(1);
    for (let i = 1; i < (n + 1) / 2; i++) expect(SEATED_OUTLINE[n - i][0]).toBeCloseTo(-SEATED_OUTLINE[i][0], 9);
    expect(SEATED_OUTLINE[0]).toEqual(OUTLINE[0].map((v, i) => (i ? v + 0.2 : v)));
  });
});

describe('mobile first (DESIGN §12) and the desk (§14)', () => {
  const STATES = (L: Layout, ps: 'sit' | 'stand') => (['whole', 'tree', 'roots', 'water'] as const).flatMap(f => {
    const oy = camFor(L, f, ps);
    const crown = crownRect(L, oy, ps);
    return [
      tapTargets(L, { story: null, picker: false, card: false, crown, menu: true }),
      tapTargets(L, { story: null, picker: false, card: true, crown, menu: true }),
    ];
  });

  it('keeps every control finger-sized, inside the insets and apart, at every checked size, with a finger and a mouse', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        for (const ps of ['sit', 'stand'] as const) {
          for (const tg of STATES(L, ps)) expect(auditTargets(tg, c.w, c.h, L.ins), `${c.name} ${ps}`).toEqual([]);
        }
        const pick = tapTargets(L, { story: null, picker: true, card: false, crown: null, menu: true });
        expect(pick).toHaveLength(8);
        expect(auditTargets(pick, c.w, c.h, L.ins), `${c.name} picker`).toEqual([]);
        const story = tapTargets(L, { story: L.story, picker: false, card: false, crown: null, menu: true });
        expect(auditTargets(story, c.w, c.h, L.ins), `${c.name} story`).toEqual([]);
      }
    }
  });

  it('lays a phone upright out tall: the words band and ≡ in the thumb zone, the stage between the HUD and the band', () => {
    for (const c of CHECK_SIZES.filter(s => s.w < s.h && s.w < 500)) {
      const L = layout(c.w, c.h, c.insets, true);
      expect(L.shape).toBe('tall');
      expect(L.menu.y).toBeGreaterThanOrEqual(c.h * (1 - THUMB) - 1);
      expect(L.band.y + L.band.h).toBeLessThanOrEqual(L.bottom);
      expect(L.stage.y).toBeGreaterThanOrEqual(L.top);
      expect(L.stage.y + L.stage.h).toBeLessThanOrEqual(L.band.y);
      expect(L.band.h).toBeGreaterThanOrEqual(118);
      // the tree fits across, the crown under the HUD never
      expect(L.H * 0.98).toBeLessThanOrEqual(L.stage.w + 1);
      for (const ps of ['sit', 'stand'] as const) {
        const oy = camFor(L, 'tree', ps);
        expect(oy + (crownOf(ps).cy - crownOf(ps).ry) * L.H).toBeGreaterThanOrEqual(L.top - 1);
      }
    }
  });

  it('never shows below the rock, and shows the whole cross-section on a big screen', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, false);
      for (const f of ['whole', 'tree', 'roots', 'water'] as const) expect(camFor(L, f, 'sit') + BOTTOM * L.H).toBeGreaterThanOrEqual(L.stage.y + L.stage.h - 1);
    }
    const big = CHECK_SIZES.find(s => s.name.startsWith('Full HD'))!;
    expect(layout(big.w, big.h, big.insets, false).pan).toBe(false);
    expect(layout(big.w, big.h, big.insets, false).desk).toBe(true);
    const pv = previewLayout(600, 400);
    expect(camFor(pv, 'tree', 'stand') + worldTopOf('stand') * pv.H).toBeGreaterThanOrEqual(0);
    expect(camFor(pv, 'tree', 'stand') + 1.0 * pv.H).toBeLessThanOrEqual(400 * 0.66);
  });

  it('reads at 13 px and more (the prayer 15 px), never under 11', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      expect(L.font.label).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.now).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.caption).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.lineMin).toBeGreaterThanOrEqual(15);
      expect(L.font.small).toBeGreaterThanOrEqual(12);
      expect(Math.min(...Object.values(L.font))).toBeGreaterThanOrEqual(MIN_TEXT);
      const p = pickerParts(L);
      expect(p.card.y + p.card.h).toBeLessThanOrEqual(L.bottom + 1);
    }
  });

  it('says how to play for the hand the player has, the last tip that it is not a treatment', () => {
    const touch = howto(true, BREATH_DEFAULT), mouse = howto(false, BREATH_DEFAULT);
    expect(touch.hands.map(h => h.gesture)).toEqual(['tap']);
    expect(mouse.hands.map(h => h.gesture)).toEqual(['tap', 'keys']);
    expect(touch.tips?.[0]).toContain('4');
    expect(touch.tips?.[1]).toMatch(/leczenie/);
  });
});

describe('rest, calm and reading time', () => {
  it('counts calm only in rest with a signal, and its longest stretch', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + 40, HIGH, clock);
    expect(sim.calmNow).toBe(0);
    while (!sim.restBlock) drive(sim, 0.5, HIGH, clock);
    drive(sim, 8, CALM, clock);
    expect(sim.calmNow).toBeGreaterThan(5);
    expect(sim.longestNow).toBeGreaterThan(5);
    const before = sim.calmNow;
    drive(sim, 2, NONE, clock);
    expect(sim.calmNow).toBeCloseTo(before, 6);
  });

  it('keeps every card up long enough to read twice', () => {
    expect(readTime('x')).toBe(RULES.readMin);
    expect(pageTime('open', 0)).toBeGreaterThanOrEqual(RULES.pageSec);
    expect(pageTime('open', 1)).toBeGreaterThan(readTime(t('story.open2.text')));
  });
});

describe('the rest’s rhythm, set in the lobby (round 15, kit/rhythm.ts)', () => {
  it('offers a rest after 1–3 stages (1 by design) and its whole breaths of the player’s pattern (2)', () => {
    const spec = drzewoRhythm(freshProgress());
    expect(spec.focus).toMatchObject({ def: 1, min: 1, max: RULES.restAfterMax, name: 'Odpoczynek po' });
    expect([1, 2, 3].map(n => spec.focus.format(n))).toEqual(['1\u00a0etapie', '2\u00a0etapach', '3\u00a0etapach']);
    expect(spec.rest).toMatchObject({ def: RULES.restDef, min: 1, max: RULES.restBreathsMax, name: 'Odpoczynek' });
    expect(spec.rest.format(2)).toBe('2\u00a0oddechy · 20\u00a0s');
    const n = restsIn(spec, rhythmOf(spec, undefined)!, 600)!;
    expect(n.rests).toBeGreaterThanOrEqual(10);
    expect(n.rests).toBeLessThanOrEqual(12);
  });

  it('tells the lobby the rest a session really keeps: the player’s breaths where they fit, fewer in a short session', () => {
    const spec = drzewoRhythm(freshProgress());
    // the design fits by itself: nothing to say
    expect(restKept(spec, rhythmOf(spec, undefined)!, 300)).toBeNull();
    // 8 breaths after every stage do not fit 5 or 10 minutes: the plan keeps fewer — what a session with them walks
    for (const min of [5, 10]) {
      const r = { focus: 1, rest: 8, custom: true };
      const kept = restKept(spec, r, min * 60)!;
      expect(kept, `${min} min`).toBeGreaterThanOrEqual(1);
      expect(kept, `${min} min`).toBeLessThan(8);
      const sim = later({ planned: min * 60, rhythm: r });
      expect(sim.plan.restCycles, `${min} min`).toBe(kept);
    }
    // a rest that fits stands
    expect(restKept(spec, { focus: 3, rest: 2, custom: true }, 1800)).toBeNull();
  });

  it('with a rest after 2 stages the light flows on within the push; the water and the whole crown still rest', () => {
    const sim = later({ planned: 900, rhythm: { focus: 2, rest: 3, custom: true } });
    const { events } = playAll(sim, average);
    const rests = sim.blocks.filter(b => b.kind === 'rest' && b.rest !== 'wind' && b.rest !== 'valve');
    for (const b of rests) expect(b.cycles).toBe(b.rest === 'water' ? 3 + sim.plan.extra : 3);
    expect(rests.some(b => b.rest === 'water')).toBe(true);
    expect(rests.some(b => b.rest === 'crown')).toBe(true);
    // fewer rests than stages done (two stages a push on the fruits)
    const fulls = ofType(events, 'full').length;
    expect(rests.length).toBeLessThan(fulls - 2);
    const design = later({ planned: 900 });
    playAll(design, average);
    expect(design.blocks.filter(b => b.kind === 'rest').length).toBeGreaterThan(sim.blocks.filter(b => b.kind === 'rest').length);
  });

  for (const min of [3, 10, 30]) {
    it(`walks an average player through ${min} minutes with the dials at their extremes: the arc closes near the end`, () => {
      for (const rhythm of [{ focus: 1, rest: 1 }, { focus: RULES.restAfterMax, rest: RULES.restBreathsMax }, { focus: 2, rest: 2 }]) {
        const sim = later({ planned: min * 60, rhythm: { ...rhythm, custom: true } });
        playAll(sim, average);
        const T = min * 60, tag = `${min} min ${JSON.stringify(rhythm)}`;
        expect(sim.phase, tag).toBe('done');
        expect(sim.streamReached, tag).toBe(true);
        expect(sim.crownWhole, tag).toBe(true);
        expect(sim.fruitsNow, tag).toBeGreaterThanOrEqual(min <= 3 ? 2 : 6);
        const last = sim.ripeAt[Math.min(sim.plan.fruits, sim.fruitsNow) - 1];
        expect(last / T, tag).toBeGreaterThan(min <= 3 ? 0.45 : 0.55);
        expect(sim.blocks.filter(b => b.rest === 'wind'), tag).toHaveLength(1);
        // pushes and rests alternate (the wind's rest may follow a rest: the end is reserved for it)
        sim.blocks.forEach((b, i) => { if (i && b.rest !== 'wind') expect(b.kind, tag).not.toBe(sim.blocks[i - 1].kind); });
      }
    });
  }
});

describe('45–60 minutes (round 24)', () => {
  /** A weak session: focused a third of the time, just over the threshold. */
  const weak = (_: number, sim: DrzewoSim): FocusFrame => {
    if (!sim.pushBlock) return frame({ calm: 0.5 });
    const x = (sim.blockT - sim.lead) % 12;
    return sim.blockT >= sim.lead && x < 3.5 ? frame({ level: 0.55, activity: 2.2, focused: true, hold: x }) : frame({ level: 0.35, activity: 1 });
  };

  it('paces the plan for more fruit (the nine, then again): 14 in 45 minutes, 18 in an hour — half an hour as it was', () => {
    expect(planFor(1800, BREATH_DEFAULT).fruits).toBe(9);
    expect(planFor(2700, BREATH_DEFAULT).fruits).toBe(14);
    expect(planFor(3600, BREATH_DEFAULT).fruits).toBe(18);
    for (const T of [2700, 3600]) {
      for (const pat of Object.values(BREATH_PRESETS)) {
        const p = planFor(T, pat);
        // every fruit still asks for real focus — no need held up at its least, none past its most
        expect(p.needFruit, `${T}`).toBeGreaterThan(RULES.needMin);
        for (const n of [p.needRoot, p.needTrunk, p.needFruit]) expect(n).toBeLessThanOrEqual(RULES.needMax);
        expect(p.steps).toBe(2);
      }
    }
  });

  it('never takes a long rest dial’s breaths for the extra fruit: the rest the nine would keep, fewer fruit instead', () => {
    for (const T of [2700, 3600]) {
      for (const rest of [1, 2, 4, 6, 8]) {
        for (const focus of [1, 2, 3]) {
          const p = planFor(T, BREATH_DEFAULT, false, { restAfter: focus, restBreaths: rest });
          const nine = planFor(1800 + 300, BREATH_DEFAULT, false, { restAfter: focus, restBreaths: rest });
          expect(p.fruits, `${T} ${focus}/${rest}`).toBeGreaterThanOrEqual(9);
          expect(nine.fruits).toBe(9);
          const spec = drzewoRhythm(freshProgress());
          const kept = restKept(spec, { focus, rest, custom: true }, T);
          expect(kept === null ? rest : kept, `${T} ${focus}/${rest}`).toBe(p.restCycles);
        }
      }
    }
    // 8 breaths after every stage keep 5 in 45 minutes and 7 in an hour, as nine fruits alone would
    expect(planFor(2700, BREATH_DEFAULT, false, { restAfter: 1, restBreaths: 8 }).restCycles).toBe(5);
    expect(planFor(3600, BREATH_DEFAULT, false, { restAfter: 1, restBreaths: 8 }).restCycles).toBe(7);
  });

  for (const min of [45, 60]) {
    it(`walks an average player through ${min} minutes: the stream, the crown, every planned fruit — the last near the end`, () => {
      const T = min * 60;
      for (const rhythm of [undefined, { focus: 1, rest: 1 }, { focus: RULES.restAfterMax, rest: RULES.restBreathsMax }, { focus: 1, rest: RULES.restBreathsMax }]) {
        const sim = later({ planned: T, rhythm: rhythm ? { ...rhythm, custom: true } : undefined });
        const { events } = playAll(sim, average);
        const tag = `${min} min ${JSON.stringify(rhythm)}`;
        expect(sim.phase, tag).toBe('done');
        expect(sim.streamReached, tag).toBe(true);
        expect(sim.crownWhole, tag).toBe(true);
        expect(sim.streamAt, tag).toBeLessThan(sim.crownAt);
        // the fit (DESIGN §24.4b): the average player ripens every planned fruit
        expect(sim.fruitsNow, tag).toBeGreaterThanOrEqual(sim.plan.fruits);
        const last = sim.ripeAt[sim.plan.fruits - 1] / T;
        expect(last, tag).toBeGreaterThan(rhythm ? 0.7 : 0.8);
        expect(last, tag).toBeLessThan(0.97);
        expect(sim.blocks.filter(b => b.rest === 'wind'), tag).toHaveLength(1);
        expect(ofType(events, 'finale'), tag).toHaveLength(1);
      }
    });
  }

  it('a whole hour: a strong player ripens more, a weak one fewer; bounded, a short summary', () => {
    const strong = later({ planned: 3600 });
    playAll(strong, (_t, s) => (s.pushBlock ? HIGH : CALM));
    const weakSim = later({ planned: 3600 });
    playAll(weakSim, weak);
    expect(strong.fruitsNow).toBeGreaterThan(strong.plan.fruits);
    expect(weakSim.fruitsNow).toBeGreaterThanOrEqual(6);
    expect(weakSim.fruitsNow).toBeLessThan(weakSim.plan.fruits);
    for (const sim of [strong, weakSim]) {
      expect(sim.phase).toBe('done');
      expect(sim.blocks.length).toBeLessThan(200);
      expect(sim.hang.length).toBeLessThanOrEqual(sim.fruitsNow + 9);
      expect(sim.talk.said.length).toBeLessThan(300);
      const r = sim.result();
      expect(r.highlights.length).toBeLessThanOrEqual(5);
      for (const h of r.highlights) expect(h.length).toBeLessThan(120);
      expect(r.stats.length).toBeLessThanOrEqual(6);
    }
    expect(fruitList(strong.ripened)).toMatch(/\+\d+$/);
  });

  it('an hour’s narrator: no line again within ten minutes, still speaking in the last quarter; half an hour as before', () => {
    expect(later({ planned: 1800 }).talk.fresh).toBe(0);
    expect(later({ planned: 2700 }).talk.fresh).toBe(RULES.talkFresh);
    const sim = later({ planned: 3600 });
    const lines: [number, string, string][] = [];
    let last: unknown = null;
    for (let tt = STEP; tt <= 3608; tt += STEP) {
      sim.update(STEP, average(tt, sim), tt);
      sim.take();
      if (sim.story && sim.story.t > 1.5) sim.stay();
      const l = sim.talk.line;
      if (l && l !== last) { last = l; lines.push([tt, l.moment, l.text]); }
    }
    expect(sim.phase).toBe('done');
    // no line again within ten minutes (the warnings and the help when stuck aside), and still a voice at the end
    const at = new Map<string, number>();
    for (const [tt, m, text] of lines) {
      if ((ALWAYS as readonly string[]).includes(m)) continue;
      const p = at.get(text);
      if (p !== undefined) expect(tt - p, text).toBeGreaterThanOrEqual(RULES.talkFresh - 1e-6);
      at.set(text, tt);
    }
    expect(lines.filter(([tt, m]) => tt > 0.75 * 3600 && !(ALWAYS as readonly string[]).includes(m)).length).toBeGreaterThan(0);
  });
});
