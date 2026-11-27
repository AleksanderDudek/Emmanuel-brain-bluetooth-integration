// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BREATH_DEFAULT, BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import {
  AREAS, CHOICES, CLOSE_VERSES, EMO, EMOS, LIBRARY, MOMENTS, OWN_CHARS, OWN_VERSES, PATTERNS, QUIET_VERSES, THOUGHT_CHARS, VALVE_VERSES,
  blend, cleanText, dominant, fits, flameTones, isMixed, needsCare, normMix, ownMix,
} from '../src/arcade/mysli/content';
import { CATALOGS, LIBRARY_KEYS, emoList, emoNames, t, unit } from '../src/arcade/mysli/i18n';
import {
  addPair, addSet, bestOf, chooseSet, chooseWar, editPair, forgetSets, freshProgress, migrate, removePair, removeSet, restoreSkipped, setBefore,
  setEmotion, setFirst, skipThought, toggleArea, type MysliProgress,
} from '../src/arcade/mysli/meta';
import {
  GT_VERSES, PAIRS_MAX, PAIR_CHARS, SETS_MAX, SET_NAME_CHARS, TRUTH_CHARS, WAR_PAIRS, WAR_SIZE, cleanPlace, freshPlace, isOcd, setOrder, stoneSlots,
  type OwnSet,
} from '../src/arcade/mysli/sets';
import { WAROWNIE, WAROWNIA_GROUPS } from '../src/arcade/kit/warownie';
import { coursesFor, wallStones } from '../src/arcade/mysli/paint';
import { progressPanel } from '../src/arcade/mysli/panel';
import { setNameOf } from '../src/arcade/mysli/i18n';
import { RULES, cleanRhythm, focusRate, planFor, readTime, splitNeed } from '../src/arcade/mysli/rules';
import { MysliSim, fallVerseFor, libraryOrder, pageOf, pageTime, type SimEvent } from '../src/arcade/mysli/sim';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { guideH, layout, previewLayout, scaleParts, tapTargets } from '../src/arcade/mysli/layout';
import mod, { howto, rhythm } from '../src/arcade/mysli/index';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 20, calm: 0.05 });
const MID = frame({ level: 0.55, activity: 2.2, focused: true, hold: 4, calm: 0.4 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.burn', 'c.skip', 'c.breath', 'c.blind', 'c.truth'];

type SimOpts = { progress?: Partial<MysliProgress>; planned?: number; seed?: number; eeg?: boolean; rhythm?: { focus?: number; rest?: number } };

function makeSim(o: SimOpts = {}): MysliSim {
  const sim = new MysliSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: TUNING, rhythm: o.rhythm ?? null, day: '2026-11-23',
  });
  sim.start();
  return sim;
}

/** A returning player: no opening card, no coach marks. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: MysliSim, sec: number, f: FocusFrame | ((t: number, sim: MysliSim) => FocusFrame), clock = { t: 0 }): SimEvent[] {
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

function playAll(sim: MysliSim, f: FocusFrame | ((t: number, sim: MysliSim) => FocusFrame)): { events: SimEvent[]; clock: { t: number } } {
  const clock = { t: 0 };
  const events = drive(sim, sim.plannedSec + 8, f, clock);
  return { events, clock };
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** An average player: in a focus block past its lead-in, focused about 7 s in every 10 (a little above the threshold); calm in rest. */
function average(_: number, sim: MysliSim): FocusFrame {
  if (sim.focusBlock) {
    const x = (sim.blockT - sim.lead) % 10;
    if (sim.blockT < sim.lead || x >= 7) return frame({ level: 0.38, activity: 1.4, focused: false, hold: 0, calm: 0.4 });
    return frame({ level: 0.62, activity: 2.8, focused: true, hold: x, calm: 0.25 });
  }
  return frame({ level: 0.3, activity: 0.5, focused: false, calm: 0.62 });
}

const LANGS = ['pl', 'en', 'de', 'sv'] as const;

/** Polish first person that would give the player a gender: -łem/-łam, -łbym, sam/sama, "jestem / czuję się + adjective". */
const GENDERED = /\p{L}+(łem|łam|łabym|łbym)(?!\p{L})|(?<!\p{L})(sam|sama|samotny|samotna|głupi|głupia|beznadziejny|beznadziejna)(?!\p{L})|(?<!\p{L})(jestem|czuję się|zostaję|zostanę|być)\s+(\p{L}{2,}(ny|na|ty|ta|wy|wa|ły|ła|ry|ra|by|ba))(?!\p{L})/iu;
const pairsOf = (l: (typeof LANGS)[number], id: string): [string, string][] => Array.from({ length: WAR_SIZE }, (_, k) => {
  const cat = CATALOGS[l] as Record<string, string>;
  return [cat[`w.${id}.${k + 1}.lie`], cat[`w.${id}.${k + 1}.truth`]];
});

describe('the library (content.ts)', () => {
  it('holds eight areas of seven thoughts, each with a whole mix, a pattern and a passage that exists', () => {
    expect(AREAS).toHaveLength(8);
    expect(LIBRARY).toHaveLength(56);
    for (const a of AREAS) expect(LIBRARY.filter(d => d.area === a)).toHaveLength(7);
    expect(new Set(LIBRARY.map(d => d.id)).size).toBe(LIBRARY.length);
    for (const d of LIBRARY) {
      expect(d.mix[0] + d.mix[1] + d.mix[2]).toBeCloseTo(1, 9);
      expect(PATTERNS).toContain(d.pattern);
      expect(passage(d.verse, 'pl').text.length, d.id).toBeGreaterThan(10);
    }
    // each emotion leads in a fair share, mixtures among them
    for (const e of EMOS) expect(LIBRARY.filter(d => dominant(d.mix) === e).length, e).toBeGreaterThanOrEqual(14);
    expect(LIBRARY.filter(d => isMixed(d.mix)).length).toBeGreaterThanOrEqual(12);
    // every choice of emotion finds enough thoughts
    for (const c of CHOICES) expect(LIBRARY.filter(d => fits(d.mix, c)).length, c).toBeGreaterThanOrEqual(15);
  });

  it('has no empty or too long line in any language, and a true word for every thought', () => {
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, string>;
      for (const d of LIBRARY) {
        const th = cat[`th.${d.id}`], tw = cat[`tw.${d.id}`], tr = cat[`tr.${d.id}`];
        expect(th?.trim(), `${l} th.${d.id}`).toBeTruthy();
        expect(tw?.trim(), `${l} tw.${d.id}`).toBeTruthy();
        expect(tr?.trim(), `${l} tr.${d.id}`).toBeTruthy();
        expect([...th].length, `${l} th.${d.id}`).toBeLessThanOrEqual(THOUGHT_CHARS);
        expect([...tw].length, `${l} tw.${d.id}`).toBeLessThanOrEqual(140);
        expect([...tr].length, `${l} tr.${d.id}`).toBeLessThanOrEqual(TRUTH_CHARS);
      }
    }
    expect(LIBRARY_KEYS).toHaveLength(168);
  });

  it('writes the Polish thoughts and truths without gendered forms, and holds no thought of self-harm', () => {
    for (const d of LIBRARY) {
      for (const k of ['th', 'tr']) {
        const s = CATALOGS.pl[`${k}.${d.id}` as keyof typeof CATALOGS.pl] as string;
        expect(s, `${k}.${d.id}`).not.toMatch(GENDERED);
      }
    }
    for (const l of LANGS) {
      for (const d of LIBRARY) {
        for (const k of ['th', 'tw', 'tr']) {
          const s = (CATALOGS[l] as Record<string, string>)[`${k}.${d.id}`];
          expect(needsCare(s), `${l} ${k}.${d.id}`).toBe(false);
          expect(s, `${l} ${k}.${d.id}`).not.toMatch(/ciężarem|a burden|eine Last für|en börda för|zauważy, że mnie nie ma|notice if I/i);
        }
      }
    }
  });

  it('blends a mixture’s colours: a pure thought keeps its emotion’s colour, a mixture lies between, two tones in its flame', () => {
    expect(blend([1, 0, 0])).toBe(EMO.fear.color);
    expect(blend([0, 0, 1])).toBe(EMO.anger.color);
    const m = normMix([0, 0.5, 0.5]);
    const c = blend(m);
    expect(c).not.toBe(EMO.sadness.color);
    expect(c).not.toBe(EMO.anger.color);
    // between the two in every channel
    const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
    for (let i = 0; i < 3; i++) {
      const lo = Math.min(ch(EMO.sadness.color, i), ch(EMO.anger.color, i)), hi = Math.max(ch(EMO.sadness.color, i), ch(EMO.anger.color, i));
      expect(ch(c, i)).toBeGreaterThanOrEqual(lo);
      expect(ch(c, i)).toBeLessThanOrEqual(hi);
    }
    expect(flameTones(m)).toEqual([EMO.sadness.ember, EMO.anger.ember].sort((a, b) => (a === EMO.sadness.ember ? -1 : b === EMO.sadness.ember ? 1 : 0)));
    expect(new Set(flameTones(m)).size).toBe(2);
    expect(new Set(flameTones([1, 0, 0])).size).toBe(1);
    expect(normMix([0, 0, 0])).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(emoNames(normMix([0.6, 0, 0.4]))).toBe('lęk i złość');
    expect(emoNames(normMix([0.9, 0.1, 0]))).toBe('lęk');
  });

  it('keeps own thoughts as plain text of at most 80 characters, and notices words that ask for a human', () => {
    expect(cleanText(' a\u0000b <i>x</i>  ')).toBe('a b i x /i');
    expect([...cleanText('x'.repeat(200))].length).toBe(OWN_CHARS);
    expect(needsCare('Nie chcę już żyć')).toBe(true);
    expect(needsCare('I want to die')).toBe(true);
    expect(needsCare('Ich will nicht mehr leben')).toBe(true);
    expect(needsCare('Jag vill inte leva')).toBe(true);
    expect(needsCare('Boję się jutra')).toBe(false);
    expect(ownMix('mixed')).toEqual([1 / 3, 1 / 3, 1 / 3]);
    for (const list of Object.values(OWN_VERSES)) for (const id of list) expect(passage(id, 'pl').text.length).toBeGreaterThan(10);
    for (const id of [...VALVE_VERSES, ...QUIET_VERSES, ...CLOSE_VERSES]) expect(passage(id, 'pl').text.length).toBeGreaterThan(10);
    expect(pageOf('open', 0).verse).toBe('2co10.5');
    expect(pageOf('open', 1).verse).toBe('isa61.3');
  });
});

describe('the queue: own thoughts first, then the library by what weighs today', () => {
  it('brings the own set chosen first in today’s mode, in its order, with its truths (or generic ones)', () => {
    const sets: OwnSet[] = [{ name: 'Szkoła', pairs: [{ lie: 'Jutro egzamin', truth: 'Zrobię, co mogę — reszta w Bożych rękach', emo: 'fear' }, { lie: 'Kłótnia z bratem', truth: '', emo: 'anger' }], place: freshPlace() }];
    const sim = later({ planned: 600, progress: { sets, first: 0 } });
    const clock = { t: 0 };
    const seen: string[] = [];
    const evs = drive(sim, 240, HIGH, clock);
    for (const e of ofType(evs, 'arrive')) seen.push(e.thought.text);
    expect(seen.slice(0, 2)).toEqual(['Jutro egzamin', 'Kłótnia z bratem']);
    expect(ofType(evs, 'arrive')[2].thought.src).toBe('lib');
    const given = ofType(evs, 'gilded').map(e => e.thought);
    expect(given[0].truth).toBe('Zrobię, co mogę — reszta w Bożych rękach');
    expect(given[1].truth).toBe(t('gt.anger.2'));
    // the result never carries their words, nor the set's name
    const r = sim.result();
    expect(JSON.stringify(r)).not.toMatch(/Jutro egzamin|Kłótnia z bratem|Zrobię, co mogę|Szkoła/);
    // today's mode: no stronghold
    expect(sim.set).toBeNull();
  });

  it('orders the library: today’s emotion and areas first, single emotions before mixtures, last time’s thoughts last, never one set aside', () => {
    const p = { ...freshProgress(), emotion: 'anger' as const, areas: ['work' as const, 'close' as const], recent: ['work.credit'], skipped: ['close.forgive'] };
    const order = libraryOrder(p, mulberry32(3));
    const head = order.filter(d => fits(d.mix, 'anger') && (d.area === 'work' || d.area === 'close'));
    expect(order.slice(0, head.length).map(d => d.id).sort()).toEqual(head.map(d => d.id).sort());
    const firstMixed = head.findIndex(d => isMixed(d.mix));
    const pure = head.filter(d => !isMixed(d.mix));
    expect(firstMixed === -1 || firstMixed >= pure.length - 0).toBe(true);
    expect(order.map(d => d.id)).not.toContain('close.forgive');
    expect(order).toHaveLength(LIBRARY.length - 1);
    // the recent one goes to its group's end
    const g = order.slice(0, head.length).filter(d => !isMixed(d.mix));
    expect(g[g.length - 1].id).toBe('work.credit');
    // deterministic for a seed
    expect(libraryOrder(p, mulberry32(3)).map(d => d.id)).toEqual(order.map(d => d.id));
  });

  it('sets a thought aside ("nie moja"): it drifts away uncounted and never comes back', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + 0.5, LOW, clock);
    expect(sim.pushBlock).toBe(true);
    const first = sim.cur!;
    expect(sim.skip()).toBe(true);
    drive(sim, RULES.leaveSec + 0.2, LOW, clock);
    expect(sim.cur?.seq).toBe(1);
    expect(sim.canSkip).toBe(true);
    expect(sim.burnedNow).toBe(0);
    expect(sim.p.skipped).toContain(first.id);
    expect(libraryOrder(sim.p, mulberry32(9)).map(d => d.id)).not.toContain(first.id);
    restoreSkipped(sim.p);
    expect(sim.p.skipped).toEqual([]);
  });
});

describe('light only from real focus', () => {
  it('burns only while focused: faster above the threshold and as the focus is held', () => {
    expect(focusRate(0.9, false, 20)).toBe(0);
    expect(focusRate(0.5, true, 0)).toBeCloseTo(1, 5);
    expect(focusRate(0.9, true, 0)).toBeGreaterThan(focusRate(0.5, true, 0));
    expect(focusRate(0.6, true, 20)).toBeGreaterThan(focusRate(0.6, true, 0));
  });

  it('burns nothing in the settling, the lead-in, while the thought drifts in, in rest, without a signal or below the threshold', () => {
    const sim = later({ planned: 600 });
    drive(sim, 3 * sim.plan.cueSec - 0.2, HIGH);
    expect(sim.settleBlock).toBe(true);
    expect(sim.burn).toBe(0);
    const clock = { t: 3 * sim.plan.cueSec - 0.2 };
    drive(sim, 0.4, HIGH, clock);
    expect(sim.pushBlock).toBe(true);
    drive(sim, sim.lead - 0.5, HIGH, clock);
    expect(sim.burn).toBe(0);
    drive(sim, 20, LOW, clock);
    expect(sim.burn).toBe(0);
    drive(sim, 20, NONE, clock);
    expect(sim.burn).toBe(0);
    drive(sim, 2, MID, clock);
    expect(sim.burn).toBeGreaterThan(0);
  });

  it('never burns a thought from taps: a tap shows the words again', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + sim.lead + 3, LOW, clock);
    for (let i = 0; i < 40; i++) {
      sim.stay();
      drive(sim, 0.5, LOW, clock);
    }
    expect(sim.burn).toBe(0);
    expect(sim.burnedNow).toBe(0);
    expect(sim.reshow).toBeGreaterThan(0);
  });

  it('a thought waits without focus: it never comes closer, nothing goes back', () => {
    const rnd = mulberry32(7);
    const sim = later({ planned: 900 });
    let last = { burned: 0, burn: 0, seq: -1 };
    const clock = { t: 0 };
    for (let i = 0; i < 900 * 3; i++) {
      const v = rnd();
      const f = v < 0.15 ? NONE : v < 0.45 ? LOW : v < 0.8 ? MID : HIGH;
      const before = sim.burnedNow;
      drive(sim, 1 / 3, f, clock);
      expect(sim.burnedNow).toBeGreaterThanOrEqual(last.burned);
      // the same thought: its burning only grows
      if (sim.cur && sim.cur.seq === last.seq && sim.burnedNow === before) expect(sim.burn).toBeGreaterThanOrEqual(last.burn - 1e-9);
      if (f === LOW || f === NONE) expect(sim.ring).toBeLessThan(0.75);
      last = { burned: sim.burnedNow, burn: sim.burn, seq: sim.cur?.seq ?? -1 };
    }
  });
});

describe('the plan fits the whole arc into any length (DESIGN §17)', () => {
  for (const min of [3, 5, 10, 15, 20, 25, 30]) {
    it(`walks an average player through ${min} minutes: the planned thoughts near the end, never at 40 %, then the close`, () => {
      const sim = later({ planned: min * 60 });
      playAll(sim, average);
      const T = min * 60;
      expect(sim.phase).toBe('done');
      expect(sim.doneNow).toBeGreaterThanOrEqual(Math.round(sim.plan.thoughts * 0.85));
      const lastPlanned = sim.doneAt[Math.round(sim.plan.thoughts * 0.85) - 1];
      expect(lastPlanned / T).toBeGreaterThan(0.55);
      expect(lastPlanned / T).toBeLessThan(0.97);
      // the last rest, the quiet (10 minutes and more) and the close come at the end
      const kinds = sim.blocks.map(b => (b.kind === 'rest' ? `rest:${b.rest}` : b.kind));
      expect(kinds[0]).toBe('settle');
      expect(kinds).toContain('rest:last');
      if (min >= 10) expect(kinds[kinds.length - 1]).toBe('quiet');
      else expect(kinds[kinds.length - 1]).toBe('rest:last');
      // rest stays under a third of the session
      const rest = sim.blocks.filter(b => b.kind === 'rest').reduce((s, b) => s + b.len, 0);
      expect(rest / T).toBeLessThan(0.34);
    });
  }

  it('goes deeper in a long session: more thoughts, mixtures, the quiet', () => {
    const short = planFor(180, BREATH_DEFAULT, cleanRhythm(null));
    const long = planFor(1800, BREATH_DEFAULT, cleanRhythm(null));
    expect(long.thoughts).toBeGreaterThan(short.thoughts * 4);
    expect(short.quietSec).toBe(0);
    expect(long.quietSec).toBeGreaterThanOrEqual(60);
    const sim = later({ planned: 1800 });
    playAll(sim, average);
    expect(sim.doneAt.length).toBeGreaterThan(20);
    expect(sim.quietNow).toBeGreaterThan(20);
  });

  it('reads the player’s rhythm: thoughts before a rest and breaths in a rest', () => {
    const one = later({ planned: 600, rhythm: { focus: 1, rest: 3 } });
    playAll(one, average);
    const pushes = one.blocks.filter(b => b.kind === 'push');
    expect(one.plan.perPush).toBe(1);
    expect(one.plan.restCycles).toBe(3);
    // a push gives one pair (one given before the push's least length takes the next along)
    expect(one.doneNow).toBeLessThanOrEqual(2 * pushes.length);
    expect(one.doneNow).toBeGreaterThanOrEqual(Math.round(one.plan.thoughts * 0.85));
    for (const b of one.blocks.filter(x => x.kind === 'rest' && x.rest === 'thought')) expect(b.cycles).toBe(3);
    const six = later({ planned: 600, rhythm: { focus: 6, rest: 1 } });
    playAll(six, average);
    expect(six.blocks.filter(b => b.kind === 'push').length).toBeLessThan(pushes.length);
    expect(cleanRhythm({ focus: 99, rest: -3 })).toEqual({ focus: RULES.focus.max, rest: RULES.rest.min });
    expect(cleanRhythm(null)).toEqual({ focus: 3, rest: 2 });
  });

  it('rests in whole breaths of the saved pattern', () => {
    const sim = later({ planned: 600, progress: { breath: { ...BREATH_PRESETS.box } } });
    playAll(sim, average);
    const cyc = breathCycle(BREATH_PRESETS.box);
    for (const b of sim.blocks.filter(x => x.kind === 'rest')) expect(Math.abs(b.dur / cyc - Math.round(b.dur / cyc))).toBeLessThan(1e-6);
  });
});

describe('the blocks', () => {
  it('opens with the three settling cues (not gated), then the thoughts', () => {
    const sim = later({ planned: 300 });
    const evs = drive(sim, 3 * sim.plan.cueSec + 1, LOW);
    expect(sim.blocks[0].kind).toBe('settle');
    expect(sim.pushBlock).toBe(true);
    expect(ofType(evs, 'arrive')).toHaveLength(1);
  });

  it('rests after the push’s thoughts with the true word of the last one burned, and now and then its passage', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    while (!sim.restBlock) drive(sim, 0.5, HIGH, clock);
    expect(sim.restKind).toBe('thought');
    expect(sim.doneNow).toBeGreaterThanOrEqual(3);
    expect(sim.restWord).toBe(sim.lastBurned!.word);
    expect(sim.restVerseId).toBe(sim.lastBurned!.verse);
    const pages = new Set<string>();
    for (let i = 0; i < 400 && sim.phase === 'play'; i++) {
      drive(sim, 0.5, sim.restBlock ? CALM : HIGH, clock);
      if (sim.restBlock && sim.restKind === 'thought') pages.add(sim.restPage);
    }
    expect([...pages].sort()).toEqual(['verse', 'word']);
  });

  it('opens the safety valve for a push that cannot burn: a rest, the thought keeps what it had', () => {
    const sim = later({ planned: 900 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + sim.lead + 4, MID, clock);
    const had = sim.burn;
    expect(had).toBeGreaterThan(0);
    const evs = drive(sim, RULES.valveStall + 2, LOW, clock);
    expect(ofType(evs, 'valve')).toHaveLength(1);
    expect(sim.restKind).toBe('valve');
    expect(sim.burn).toBeCloseTo(had, 9);
  });

  it('makes every 4th push blind from the 3rd session, never the first; a blind push burns unseen and shows it at its end', () => {
    const sim = later({ planned: 900, progress: { sessions: 4, pushes: 2 } });
    const { events } = playAll(sim, HIGH);
    const pushes = sim.blocks.filter(b => b.kind === 'push');
    expect(pushes[0].blind).toBe(false);
    expect(pushes.some(b => b.blind)).toBe(true);
    const ends = ofType(events, 'blindEnd');
    expect(ends.length).toBeGreaterThan(0);
    expect(ends.some(e => e.gained > 0)).toBe(true);
    expect(later({ planned: 900, progress: { sessions: 1 } }).blocks.some(b => b.blind)).toBe(false);
  });

  it('judges each block once at its end; says what to do now in one line', () => {
    const sim = later({ planned: 300 });
    const { events } = playAll(sim, average);
    const ends = ofType(events, 'blockEnd');
    expect(ends.length).toBe(sim.blocks.length);
    const nows = new Set<string>();
    const s2 = later({ planned: 600 });
    const clock = { t: 0 };
    for (let i = 0; i < 1300 && s2.phase !== 'done'; i++) {
      drive(s2, 0.5, average, clock);
      nows.add(s2.now);
    }
    for (const k of ['settle', 'arrive', 'burn', 'truth', 'rest', 'last', 'quiet', 'end']) expect(nows, k).toContain(k);
    for (const k of nows) expect(t(`now.${k}` as never)).toMatch(/\S/);
  });

  it('gives strategies in a push (imagery, slow words), never “concentrate harder”', () => {
    for (const l of LANGS) {
      for (const [k, s] of Object.entries(CATALOGS[l])) {
        if (!/^tip\./.test(k) || typeof s !== 'string') continue;
        expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
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

  it('is deterministic: the same seed and input give the same session', () => {
    const run = () => {
      const sim = later({ planned: 600, seed: 42 });
      const { events } = playAll(sim, average);
      return { burned: sim.burnedNow, at: sim.burnAt.map(x => Math.round(x * 10)), ids: ofType(events, 'arrive').map(e => e.thought.id), said: sim.talk.said };
    };
    expect(run()).toEqual(run());
  });

  it('opens the first session with the two-page story card, and asks how heavy it is in the finale', () => {
    const sim = makeSim({ planned: 300, progress: { before: 7 } });
    expect(sim.story?.kind).toBe('open');
    expect(sim.story?.pages).toBe(2);
    const clock = { t: 0 };
    while (sim.phase === 'play') drive(sim, 0.5, MID, clock);
    expect(sim.asking).toBe(true);
    expect(sim.rate10(4)).toBe(true);
    drive(sim, 20, MID, clock);
    expect(sim.phase).toBe('done');
    expect(sim.weightText).toBe('7 → 4');
    expect(sim.result().stats.find(s => s[1] === '7 → 4')).toBeTruthy();
    expect(sim.p.history.at(-1)).toEqual({ day: '2026-11-23', before: 7, after: 4 });
    // the lobby's "before" was this session's: the next one asks again
    expect(sim.p.before).toBeNull();
    expect(sim.p.seen).toContain('s.open');
  });

  it('waits a little for the answer, then ends without one', () => {
    const sim = later({ planned: 300 });
    const { clock } = playAll(sim, MID);
    expect(sim.phase).toBe('done');
    expect(sim.after).toBeNull();
    expect(clock.t).toBeGreaterThanOrEqual(300);
    expect(sim.p.history).toEqual([]);
    expect(sim.weightText).toBeNull();
  });

  it('gives result() idempotently, the record only with Math.max, and settles once', () => {
    const sim = later({ planned: 300, progress: { best: { 300: 2 } } });
    playAll(sim, HIGH);
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.best['300']).toBe(Math.max(2, sim.doneNow));
    expect(a.record).toBe(sim.doneNow > 2);
    expect(a.score).toBe(sim.doneNow);
    const burned = sim.p.burned;
    sim.finish();
    expect(sim.p.burned).toBe(burned);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.byEmo.fear + sim.p.byEmo.sadness + sim.p.byEmo.anger).toBe(sim.burnedNow);
    expect(sim.p.truths).toBe(sim.doneNow);
  });

  it('closes with a passage that exists, and keeps the summary short even at 30 minutes', () => {
    const sim = later({ planned: 1800 });
    playAll(sim, HIGH);
    const r = sim.result();
    expect(passage(r.verse!, 'pl').text.length).toBeGreaterThan(10);
    expect(r.highlights.length).toBeLessThanOrEqual(5);
    for (const h of r.highlights) expect(h.length).toBeLessThan(120);
    expect(r.stats.length).toBeLessThanOrEqual(6);
    expect(emoList(sim.byEmoNow)).toMatch(/\d/);
  });

  it('remembers the library thoughts burned (they go last next time), and counts the own lies burned', () => {
    const sets: OwnSet[] = [{ name: '', pairs: [{ lie: 'Moja myśl', truth: '', emo: 'sadness' }], place: freshPlace() }];
    const sim = later({ planned: 300, progress: { sets, first: 0 } });
    playAll(sim, HIGH);
    expect(sim.p.recent.length).toBeGreaterThan(0);
    expect(sim.p.recent.length).toBeLessThanOrEqual(RULES.recentMax);
    expect(sim.p.sets[0].pairs).toHaveLength(1);
    expect(sim.p.ownBurned).toBe(1);
  });

  it('works with HALO (a 2 s lead-in) as with Mendi', () => {
    const sim = later({ planned: 600, eeg: true });
    expect(sim.lead).toBe(2);
    playAll(sim, average);
    expect(sim.doneNow).toBeGreaterThanOrEqual(Math.round(sim.plan.thoughts * 0.85));
  });
});

describe('the meta', () => {
  it('reads the placeholder’s save and garbage as a fresh progress, repairing every field of a wrong type', () => {
    const fromPlaceholder = migrate(mergeSaved(freshProgress(), { best: null }) as MysliProgress);
    expect(fromPlaceholder).toEqual(freshProgress());
    const broken = migrate({
      ver: 2, sessions: 'x', emotion: 'joy', areas: ['work', 'moon', 'work'], sets: [{ name: 7, pairs: [{ lie: '  a  ', emo: 'x' }, 'no', { lie: '' }], place: { burned: [0, 5, 'x'], gilded: [3] } }, 'no'],
      first: 4, set: 0, mode: 'war', war: 'moon', places: { rejection: { burned: [1, 9], gilded: [1, 2], falls: 2.6 }, moon: {} }, recent: ['work.lose', 'nope'],
      skipped: 5, before: 14, history: [{ day: 3, after: 4 }, { after: 'x' }], best: { 300: 'a', 600: 4 }, seen: [1, 'a', 'a'], byEmo: { fear: -2 },
    } as unknown as MysliProgress);
    expect(broken.sessions).toBe(0);
    expect(broken.emotion).toBe('unknown');
    expect(broken.areas).toEqual(['work']);
    expect(broken.sets).toEqual([{ name: '', pairs: [{ lie: 'a', truth: '', emo: 'mixed' }], place: { burned: [], gilded: [], falls: 0 } }]);
    expect(broken.first).toBe(-1);
    expect(broken.war).toBeNull();
    expect(broken.places).toEqual({ rejection: { burned: [1], gilded: [1], falls: 2 } });
    expect(broken.recent).toEqual(['work.lose']);
    expect(broken.skipped).toEqual([]);
    expect(broken.before).toBe(10);
    expect(broken.history).toEqual([{ day: '', before: null, after: 4 }]);
    expect(broken.best).toEqual({ 600: 4 });
    expect(broken.seen).toEqual(['a']);
    expect(broken.byEmo.fear).toBe(0);
    expect(bestOf(broken)).toBe(4);
    expect(migrate(migrate({ ...broken }))).toEqual(broken);
  });

  it('chooses what weighs and the areas, and keeps the 0–10 and the set-aside list', () => {
    const p = freshProgress();
    expect(setEmotion(p, 'mixed')).toBe(true);
    expect(setEmotion(p, 'joy')).toBe(false);
    expect(toggleArea(p, 'work')).toBe(true);
    expect(p.areas).toEqual(['work']);
    toggleArea(p, 'work');
    expect(p.areas).toEqual([]);
    for (const a of AREAS) toggleArea(p, a);
    expect(p.areas).toEqual([]);
    setBefore(p, 6.4);
    expect(p.before).toBe(6);
    setBefore(p, null);
    expect(p.before).toBeNull();
    expect(skipThought(p, 'work.lose')).toBe(true);
    expect(skipThought(p, 'work.lose')).toBe(false);
    expect(skipThought(p, 'nope')).toBe(false);
  });
});

/** The words the series never says (DESIGN §18.3), per language. */
const FORBIDDEN: Readonly<Record<(typeof LANGS)[number], RegExp>> = {
  // round 16 (the warownie): never a spirit (but the Holy Spirit), a demon, a curse, binding, casting out
  pl: /energi|uzdrawia|\b(u|wy)?leczy|czakr|kundalini|\bw[ąę]ż|magi[aię]|zaklęci|duch(?!\w*\s+Święt)|demon|przeklin|związuj|wyrzucam|egzorcy|opęta/i,
  en: /energy|heal(s|ing)? power|\bcures?\b|\bheals\b|chakra|kundalini|serpent|\bmagic|\bspell\b|(?<!Holy )\bspirits?\b|demon|\bcurse|cast out|deliverance|possess(ed|ion)/i,
  de: /energie|heilt|chakra|kundalini|schlange|magie|zauber|böse[nrs]? Geist|Dämon|verfluch|\bFluch|austreib|besessen/i,
  sv: /energi|\bhelar\b|chakra|kundalini|\borm(en|ar)?\b|magi|trollformel|ond(a|e)? ande|demon|förbann|driva ut|besatt/i,
};

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator three lines a moment, each fitting a caption (90 characters)', () => {
    for (const l of LANGS) {
      for (const m of MOMENTS) for (let i = 1; i <= 3; i++) {
        const s = (CATALOGS[l] as Record<string, string>)[`say.${m}.${i}`];
        expect(s, `${l} say.${m}.${i}`).toBeTruthy();
        expect([...s].length, `${l} say.${m}.${i}`).toBeLessThanOrEqual(90);
      }
    }
  });

  it('keeps the series’ forbidden words out of every text — the game’s and the registry’s, but for the origin note', async () => {
    const arcade = await import('../src/i18n/arcade');
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(FORBIDDEN[l]);
      }
      for (const [k, m] of Object.entries(arcade.CATALOGS[l] as Record<string, unknown>)) {
        if (!k.startsWith('mysli.') || typeof m !== 'string') continue;
        const s = k === 'mysli.text' ? m.replace(/[^.!?]*[.!?]\s*$/, '') : m;
        expect(s, `${l}.${k}`).not.toMatch(FORBIDDEN[l]);
      }
    }
  });

  it('prays to Jesus and closes to the Father, through Jesus, in the Holy Spirit; says it is not therapy, with a help line', () => {
    for (const k of ['pray.fear', 'pray.sadness', 'pray.anger', 'pray.mixed', 'pray.quiet'] as const) expect(CATALOGS.pl[k]).toMatch(/Jezu/);
    expect(CATALOGS.pl['close.text']).toMatch(/Ojcze.*Jezusa.*Duchu/);
    expect(CATALOGS.en['close.text']).toMatch(/Father.*Jesus.*Spirit/);
    for (const l of LANGS) expect(CATALOGS[l]['howto.tip2']).toMatch(/terapi|therap/i);
    expect(CATALOGS.pl['panel.careNote']).toMatch(/116 123.*116 111.*112/);
    expect(CATALOGS.de['panel.careNote']).toMatch(/0800 111 0 111.*112/);
    expect(CATALOGS.sv['panel.careNote']).toMatch(/90101.*112/);
    expect(CATALOGS.en['panel.careNote']).toMatch(/emergency number|crisis line/);
  });

  it('quotes in each language’s own marks and leaves no Polish in the other languages', () => {
    const quoted = (l: (typeof LANGS)[number]) => Object.values(CATALOGS[l]).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))).filter(s => /[„“”"]/.test(s));
    for (const s of quoted('pl')) expect(s).toMatch(/„[^„”"“]+”/);
    for (const s of quoted('de')) expect(s).toMatch(/„[^„”"“]+“/);
    for (const s of quoted('sv')) expect(s).toMatch(/”[^„”"“]+”/);
    for (const s of quoted('en')) expect(s).toMatch(/“[^„”"“]+”/);
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(się|albo|myśl)\b/);
      }
    }
  });

  it('bends the headline’s unit (1 myśl, 3 myśli, 5 myśli) and keeps a number with its unit', () => {
    expect(unit(1)).toBe('myśl');
    expect(unit(3)).toBe('myśli');
    expect(unit(5)).toBe('myśli');
    expect(t('secs', { n: 4 })).toBe('4 s');
  });

  it('speaks to the player without gendered forms in Polish', () => {
    for (const [k, m] of Object.entries(CATALOGS.pl)) {
      for (const s of typeof m === 'string' ? [m] : Object.values(m)) {
        expect(s, k).not.toMatch(/\p{L}+(łeś|łaś)(?!\p{L})|(?<!\p{L})sama? (jeden|jedna)(?!\p{L})|(jestem|zostaję|czujesz się|jesteś) (sama?|gotow[ya]|spokojn[ya])(?!\p{L})/u);
      }
    }
  });
});

describe('rest, calm and reading time', () => {
  it('counts calm only in rest with a signal, and its longest stretch', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, 3 * sim.plan.cueSec + 10, HIGH, clock);
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

describe('mobile first (DESIGN §12) and the desk (§14)', () => {
  it('keeps every control finger-sized, inside the insets and apart, at every checked size, with a finger and a mouse', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        expect(auditTargets(tapTargets(L, { story: null, skip: true, scale: false }), c.w, c.h, L.ins), `${c.name} skip`).toEqual([]);
        const sc = tapTargets(L, { story: null, skip: false, scale: true });
        expect(sc).toHaveLength(11);
        expect(auditTargets(sc, c.w, c.h, L.ins), `${c.name} scale`).toEqual([]);
        expect(auditTargets(tapTargets(L, { story: L.story, skip: true, scale: false }), c.w, c.h, L.ins), `${c.name} story`).toEqual([]);
      }
    }
  });

  it('lays out the slip above the flame, the guide in the slip’s place, the words and “Nie moja” clear of them', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      const S = L.stage;
      const slipTop = L.slip.cy - L.slip.maxH / 2, slipBottom = L.slip.cy + L.slip.maxH / 2;
      expect(slipTop, c.name).toBeGreaterThanOrEqual(L.top - 1);
      expect(L.slip.w, c.name).toBeLessThanOrEqual(S.w + 1);
      // the flame's tip below the slip; the flame inside the stage
      expect(L.fy - 2 * L.fs, c.name).toBeGreaterThan(slipBottom - 1);
      expect(L.fy + L.fs, c.name).toBeLessThanOrEqual(S.y + S.h + 1);
      // the guide inside the stage, under the HUD, its bottom above the flame's point
      const gh = guideH(L.guide.r);
      expect(L.guide.cy - gh / 2, c.name).toBeGreaterThanOrEqual(L.top - 1);
      expect(L.guide.cy + gh / 2, c.name).toBeLessThanOrEqual(L.fy + 1);
      // the band and "Nie moja" inside the safe area, neither over the flame
      expect(L.band.y + L.band.h, c.name).toBeLessThanOrEqual(L.bottom);
      expect(L.skip.y + L.skip.h, c.name).toBeLessThanOrEqual(L.bottom);
      const overFlame = L.skip.x < L.fx + L.fs && L.skip.x + L.skip.w > L.fx - L.fs && L.skip.y < L.fy + L.fs && L.skip.y + L.skip.h > L.fy - 2 * L.fs;
      expect(overFlame, c.name).toBe(false);
      // the finale's card and row inside
      const P = scaleParts(L);
      for (const b of P.buttons) expect(b.y + b.h, c.name).toBeLessThanOrEqual(L.bottom + 1);
      expect(L.close.h, c.name).toBeGreaterThan(60);
    }
    for (const c of CHECK_SIZES.filter(s => s.w < s.h && s.w < 500)) {
      const L = layout(c.w, c.h, c.insets, true);
      expect(L.shape).toBe('tall');
      expect(L.skip.y).toBeGreaterThanOrEqual(c.h * (1 - THUMB) - 1);
      expect(L.stage.y + L.stage.h).toBeLessThanOrEqual(L.band.y);
      expect(L.band.h).toBeGreaterThanOrEqual(118);
    }
    const big = CHECK_SIZES.find(s => s.name.startsWith('Full HD'))!;
    expect(layout(big.w, big.h, big.insets, false).desk).toBe(true);
    const pv = previewLayout(600, 300);
    expect(pv.fx).toBeGreaterThan(300);
  });

  it('reads at 13 px and more (the prayer 15 px, the thoughts 14 px), never under 11', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      expect(L.font.label).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.now).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.caption).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.lineMin).toBeGreaterThanOrEqual(15);
      expect(L.font.slipMin).toBeGreaterThanOrEqual(14);
      expect(L.font.slip).toBeGreaterThanOrEqual(L.font.slipMin);
      expect(Math.min(...Object.values(L.font))).toBeGreaterThanOrEqual(MIN_TEXT);
    }
  });

  it('says how to play for the hand the player has, the last tip that it is not therapy', () => {
    const touch = howto(true, BREATH_DEFAULT), mouse = howto(false, BREATH_DEFAULT);
    expect(touch.hands.map(h => h.gesture)).toEqual(['tap']);
    expect(mouse.hands.map(h => h.gesture)).toEqual(['tap', 'keys']);
    expect(touch.tips?.[0]).toContain('4');
    expect(touch.tips?.[1]).toMatch(/terapia/);
  });

  it('gives the lobby its rhythm in thoughts and breaths, and draws its own breath guide', () => {
    const r = rhythm(BREATH_PRESETS.box);
    expect([r.focus.def, r.focus.min, r.focus.max]).toEqual([3, 1, 6]);
    expect([r.rest.def, r.rest.min, r.rest.max]).toEqual([2, 1, 6]);
    expect(r.focus.format(3)).toBe('3\u00a0myśli');
    expect(r.focus.format(1)).toBe('1\u00a0myśl');
    expect(r.restSec!(2)).toBe(2 * breathCycle(BREATH_PRESETS.box));
    expect(r.focusSec!(3)).toBeGreaterThan(30);
    expect(r.focusSec!(3)).toBeLessThan(80);
    expect(mod.ownBreath).toBe(true);
    expect(mod.unit!(1)).toBe('myśl');
    expect(mod.unit!(7)).toBe('myśli');
  });
});

// ── round 16: every thought answered by its truth, the warownie, the own warownie (DESIGN §20) ──

const RISK = /ciężarem|a burden|eine Last für|en börda för|zauważy, że mnie nie ma|notice if I|lepiej beze mnie|better off without me|besser ohne mich|bättre utan mig/i;

/** Play until a predicate holds (or the session ends); returns the events seen. */
function until(sim: MysliSim, f: FocusFrame | ((t: number, sim: MysliSim) => FocusFrame), done: () => boolean, clock = { t: 0 }, max = 2000): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < max && !done() && sim.phase !== 'done'; i++) out.push(...drive(sim, 0.25, f, clock));
  return out;
}

const warSim = (id: string, o: SimOpts = {}) => later({ ...o, progress: { mode: 'war', war: id as never, ...o.progress } });

describe('round 16: the truth after the lie, held in focus', () => {
  it('unfolds the truth where the lie burned (not gated), gilds it only from focus, and it waits without — never fading', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    until(sim, HIGH, () => sim.curState === 'unfold', clock);
    expect(sim.burnedNow).toBe(1);
    expect(sim.doneNow).toBe(0);
    const seq = sim.cur!.seq;
    // the unfolding runs its time whatever the focus; nothing gilds meanwhile
    drive(sim, RULES.unfoldSec * 0.5, HIGH, clock);
    expect(sim.gild).toBe(0);
    drive(sim, RULES.unfoldSec * 0.6, LOW, clock);
    expect(sim.curState).toBe('truth');
    expect(sim.truthUp).toBe(true);
    expect(sim.cur!.truth).toBe(t(`tr.${sim.cur!.id}` as never));
    // without focus it waits: no gilding, the same truth, still there
    for (const f of [LOW, NONE, CALM]) {
      drive(sim, 15, f, clock);
      expect(sim.gild).toBe(0);
      expect(sim.cur?.seq).toBe(seq);
      expect(sim.curState).toBe('truth');
    }
    expect(sim.canSkip).toBe(false);
    expect(sim.now).toBe(sim.restBlock ? sim.now : 'truth');
    // with focus (in a push) light fills it; gilded, the pair counts
    until(sim, MID, () => sim.doneNow > 0, clock);
    expect(sim.doneNow).toBe(1);
    expect(sim.doneAt).toHaveLength(1);
    expect(sim.burnAt.length).toBeGreaterThanOrEqual(1);
  });

  it('says what to do now and prays the truth: “Przyjmij prawdę — patrz na nią”, “Jezu, przyjmuję Twoją prawdę.”', () => {
    const sim = later({ planned: 600 });
    until(sim, HIGH, () => sim.truthReady);
    expect(sim.now).toBe('truth');
    expect(t('now.truth')).toBe('Przyjmij prawdę — patrz na nią');
    expect(sim.line).toBe('Jezu, przyjmuję Twoją prawdę.');
    expect(sim.thoughtLabel).toBe(t('lab.truth'));
  });

  it('splits a pair’s focus: the truth ~45 % and at least 6 focus-s (read slowly twice), at every length', () => {
    for (const min of [3, 5, 10, 15, 20, 25, 30]) {
      const pl = planFor(min * 60, BREATH_DEFAULT, cleanRhythm(null));
      expect(pl.needLie + pl.needTruth, `${min}`).toBeCloseTo(pl.need, 9);
      expect(pl.needTruth, `${min}`).toBeGreaterThanOrEqual(RULES.truthMin);
      expect(pl.needLie, `${min}`).toBeGreaterThanOrEqual(RULES.lieMin);
      // an average player holds the truth long enough to read a 64-character truth twice
      expect(pl.needTruth / RULES.avgRate, `${min}`).toBeGreaterThanOrEqual(readTime('x'.repeat(TRUTH_CHARS)));
    }
    expect(splitNeed(20).truth).toBeCloseTo(9, 9);
    expect(splitNeed(9).truth).toBe(6);
    expect(splitNeed(2, true).truth + splitNeed(2, true).lie).toBeCloseTo(2, 9);
  });

  it('in the dark gilds unseen and shows it at the push’s end', () => {
    const sim = later({ planned: 900, progress: { sessions: 4, pushes: 2 } });
    const { events } = playAll(sim, HIGH);
    expect(ofType(events, 'blindEnd').some(e => e.gained > 0)).toBe(true);
    expect(sim.doneNow).toBeGreaterThan(5);
  });
});

describe('round 16: the warownie of the series as themed sets', () => {
  it('holds the 24 of the kit in its order, six pairs each, mixes whole, passages that exist', () => {
    expect(Object.keys(WAR_PAIRS)).toEqual(WAROWNIE.map(w => w.id));
    expect(WAROWNIE).toHaveLength(24);
    for (const w of WAROWNIE) {
      expect(WAR_PAIRS[w.id], w.id).toHaveLength(WAR_SIZE);
      for (const d of WAR_PAIRS[w.id]) {
        expect(d.mix[0] + d.mix[1] + d.mix[2], w.id).toBeCloseTo(1, 1);
        expect(passage(d.verse, 'pl').text.length, `${w.id} ${d.verse}`).toBeGreaterThan(10);
      }
      expect(passage(w.verse, 'pl').text.length).toBeGreaterThan(10);
    }
    for (const list of Object.values(GT_VERSES)) for (const id of list) expect(passage(id, 'pl').text.length).toBeGreaterThan(10);
    expect(WAROWNIA_GROUPS).toHaveLength(5);
  });

  it('writes every lie (≤ 60), truth (≤ 64) and line in four languages: gender-neutral Polish, no risk phrasing, no forbidden word', () => {
    for (const w of WAROWNIE) {
      for (const l of LANGS) {
        const cat = CATALOGS[l] as Record<string, string>;
        const line = cat[`w.${w.id}.line`];
        expect(line?.trim(), `${l} ${w.id}.line`).toBeTruthy();
        expect([...line].length, `${l} ${w.id}.line`).toBeLessThanOrEqual(96);
        const pairs = pairsOf(l, w.id);
        expect(new Set(pairs.map(x => x[0])).size, `${l} ${w.id}`).toBe(WAR_SIZE);
        for (const [k, [lie, truth]] of pairs.entries()) {
          const at = `${l} ${w.id}.${k + 1}`;
          expect(lie?.trim(), at).toBeTruthy();
          expect(truth?.trim(), at).toBeTruthy();
          expect([...lie].length, `${at} lie`).toBeLessThanOrEqual(THOUGHT_CHARS);
          expect([...truth].length, `${at} truth`).toBeLessThanOrEqual(TRUTH_CHARS);
          for (const x of [lie, truth]) {
            expect(needsCare(x), at).toBe(false);
            expect(x, at).not.toMatch(RISK);
            expect(x, at).not.toMatch(FORBIDDEN[l]);
            if (l === 'pl') expect(x, at).not.toMatch(GENDERED);
          }
        }
        if (l === 'pl') expect(line, w.id).not.toMatch(GENDERED);
        expect(line, `${l} ${w.id}`).not.toMatch(FORBIDDEN[l]);
      }
    }
    for (const e of ['fear', 'sadness', 'anger', 'mixed']) for (let k = 1; k <= 3; k++) for (const l of LANGS) {
      const s = (CATALOGS[l] as Record<string, string>)[`gt.${e}.${k}`];
      expect([...s].length, `${l} gt.${e}.${k}`).toBeLessThanOrEqual(TRUTH_CHARS);
      if (l === 'pl') expect(s).not.toMatch(GENDERED);
    }
  });

  it('gives a care note where the kit asks for one, with the help line for a crisis; the compulsions set never offers daily repetition', () => {
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, string>;
      for (const k of ['care.ocd', 'care.crisis', 'care.medical', 'care.addiction']) expect(cat[k]?.trim(), `${l} ${k}`).toBeTruthy();
      expect(cat['care.ocd'], l).toMatch(/OCD/);
      expect(cat['war.dailyOcd'], l).not.toMatch(/codzien|co dzień|every day|daily|\btäglich|jeden Tag|varje dag|dagligen/i);
      expect(cat['fall.ocd'], l).not.toMatch(/codzien|co dzień|every day|daily|\btäglich|jeden Tag|varje dag|dagligen|jutro|tomorrow|morgen|i morgon/i);
      for (const [, truth] of pairsOf(l, 'compulsions')) expect(truth).not.toMatch(/codzien|co dzień|every day|daily|\btäglich|jeden Tag|varje dag|dagligen/i);
    }
    expect(CATALOGS.pl['care.crisis']).toMatch(/116 123.*116 111.*112/);
    expect(CATALOGS.de['care.crisis']).toMatch(/0800 111 0 111.*112/);
    expect(CATALOGS.sv['care.crisis']).toMatch(/90101.*112/);
    expect(isOcd('compulsions')).toBe(true);
    expect(WAROWNIE.filter(w => isOcd(w.id)).map(w => w.id)).toEqual(['compulsions']);
  });

  it('opens a warownia’s session with its card: “Warownia · 2 Kor 10,4”, its name, its line, its opening verse', () => {
    const sim = warSim('rejection');
    expect(sim.set?.war?.id).toBe('rejection');
    expect(sim.story?.pages).toBe(1);
    const pg = sim.storyPage!;
    expect(pg.kicker).toBe('Warownia · 2 Kor 10,4');
    expect(pg.title).toBe('Odrzucenie');
    expect(pg.text).toContain(t('w.rejection.line'));
    expect(pg.verse).toBe('isa53.3');
  });

  it('loosens one stone per burned lie, falls once when all are burned (counted), then gives the truths again, truth only', () => {
    const sim = warSim('rejection', { planned: 1200 });
    const clock = { t: 0 };
    const events: SimEvent[] = [];
    const counts: number[] = [];
    for (let i = 0; i < 6000 && sim.phase !== 'done'; i++) {
      const evs = drive(sim, 0.25, HIGH, clock);
      events.push(...evs);
      for (const e of evs) if (e.type === 'burned') counts.push(sim.fellNow ? WAR_SIZE : sim.set!.place.burned.length);
      if (ofType(events, 'fall').length && ofType(events, 'arrive').filter(e => e.thought.kind === 'daily').length >= 7) break;
    }
    // one stone per lie, in order of burning, and the fall exactly once, at the sixth
    expect(counts.slice(0, WAR_SIZE)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ofType(events, 'fall')).toHaveLength(1);
    expect(sim.set!.place.falls).toBe(1);
    expect(sim.set!.place.burned).toEqual([]);
    expect(sim.fellNow).toBe(true);
    // after the fall: the set's truths, truth only, every one of them, never the same twice in a row
    const daily = ofType(events, 'arrive').map(e => e.thought).filter(x => x.kind === 'daily');
    expect(daily.length).toBeGreaterThanOrEqual(7);
    const truths = pairsOf('pl', 'rejection').map(x => x[1]);
    for (const d of daily) {
      expect(d.text).toBe('');
      expect(truths).toContain(d.truth);
    }
    expect(new Set(daily.slice(0, 6).map(d => d.pair)).size).toBe(6);
    for (let i = 1; i < daily.length; i++) expect(daily[i].pair).not.toBe(daily[i - 1].pair);
  });

  it('says the fall gently and counts it as “zburzona 2×”, never a score; the compulsions set goes on with the library instead', () => {
    const sim = warSim('rejection', { planned: 900, progress: { places: { rejection: { burned: [0, 1, 2, 3, 4], gilded: [0, 1, 2, 3, 4], falls: 1 } } } });
    const evs = until(sim, HIGH, () => sim.fellNow && sim.cur?.kind === 'daily');
    expect(ofType(evs, 'fall')).toHaveLength(1);
    expect(sim.set!.place.falls).toBe(2);
    playAll(sim, HIGH);
    expect(sim.result().highlights.join(' ')).toContain('zburzona już 2×');
    // a set's session closes with the series' own sentence, to the Father, through Jesus, in the Holy Spirit
    expect(sim.closeText).toMatch(/^Ojcze, przez Jezusa Chrystusa, w Duchu Świętym: w miejsce każdego kłamstwa przyjmuję Twoją prawdę\.$/);
    expect(later().closeText).toBe(t('close.text'));
    const ocd = warSim('compulsions', { planned: 900 });
    const evs2 = until(ocd, HIGH, () => ocd.fellNow && ocd.cur !== null && ocd.curState === 'wait');
    expect(ofType(evs2, 'fall')).toHaveLength(1);
    expect(ocd.cur!.src).toBe('lib');
    const after = until(ocd, HIGH, () => ocd.phase === 'done');
    expect(ofType(after, 'arrive').some(e => e.thought.kind === 'daily')).toBe(false);
    expect(ocd.line).not.toMatch(/codzien/);
    expect(t('fall.ocd')).toMatch(/Nie musisz/);
  });

  it('keeps the set’s place when a session ends early, and the next one goes on (truths waiting first, then the unburned lies)', () => {
    const first = warSim('fears', { planned: 600 });
    drive(first, 50, HIGH);
    // the player stops early: what burned stays burned
    first.finish();
    const pl = first.p.places.fears!;
    expect(pl.burned.length).toBeGreaterThan(0);
    expect(pl.burned.length).toBeLessThan(WAR_SIZE);
    // the next session reads the same place (saved as JSON and loaded again)
    const again = new MysliSim({ progress: migrate(JSON.parse(JSON.stringify(first.p))), rng: mulberry32(5), plannedSec: 600, eeg: false, tuning: TUNING, rhythm: null });
    expect(again.set?.place.burned).toEqual(pl.burned);
    // a place with a truth still waiting: it comes first, truth only; then the next lie
    expect(setOrder(WAR_SIZE, { burned: [0, 1, 2], gilded: [0, 1], falls: 0 })).toEqual({ pending: [2], fresh: [3, 4, 5] });
    const s2 = warSim('fears', { planned: 600, progress: { places: { fears: { burned: [0, 1, 2], gilded: [0, 1], falls: 0 } } } });
    const arr = ofType(until(s2, HIGH, () => s2.burnedNow >= 1), 'arrive').map(e => e.thought);
    expect(arr[0].kind).toBe('pending');
    expect(arr[0].pair).toBe(2);
    expect(arr[0].text).toBe('');
    expect(arr[1].kind).toBe('pair');
    expect(arr[1].pair).toBe(3);
    expect(fallVerseFor(1)).toBe('jhn8.32');
    expect(fallVerseFor(2)).toBe('2co10.4');
  });

  it('sets a warownia’s lie aside for this session only (“nie moja”), never for good', () => {
    const sim = warSim('greed', { planned: 600 });
    const clock = { t: 0 };
    until(sim, LOW, () => sim.ready, clock);
    const pair = sim.cur!.pair;
    expect(sim.skip()).toBe(true);
    expect(sim.p.skipped).toEqual([]);
    const evs = until(sim, HIGH, () => sim.phase === 'done', clock);
    expect(ofType(evs, 'arrive').some(e => e.thought.pair === pair && e.thought.src === 'war')).toBe(false);
    expect(ofType(evs, 'fall')).toHaveLength(0);
  });

  it('builds the wall of as many stones as pairs, each with its slot', () => {
    for (let n = 1; n <= PAIRS_MAX; n++) {
      expect(coursesFor(n).reduce((a, b) => a + b, 0), `${n}`).toBe(n);
      const st = wallStones(n, 200, 240, 7);
      expect(st).toHaveLength(n);
      for (const x of st) {
        expect(x.x).toBeGreaterThanOrEqual(0);
        expect(x.x + x.w).toBeLessThanOrEqual(200 + 1e-6);
        expect(x.y).toBeGreaterThanOrEqual(0);
        expect(x.y + x.h).toBeLessThanOrEqual(240 + 1e-6);
      }
      expect([...stoneSlots(n, 99)].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      expect(L.fort.w, c.name).toBeGreaterThan(30);
      expect(L.fort.y, c.name).toBeGreaterThanOrEqual(L.top - 1);
      expect(L.fort.y + L.fort.h, c.name).toBeLessThanOrEqual(L.stage.y + L.stage.h + 1);
    }
  });
});

describe('round 16: my own warownie', () => {
  it('keeps the limits: 6 sets, a name of 32, 10 pairs, a lie and a truth of 80; no doubles; an empty lie is refused', () => {
    const p = freshProgress();
    for (let i = 0; i < 9; i++) addSet(p, `Zestaw ${i}`);
    expect(p.sets).toHaveLength(SETS_MAX);
    expect(addSet(p)).toBe(-1);
    removeSet(p, 5);
    expect(addSet(p, 'x'.repeat(100))).toBe(5);
    expect([...p.sets[5].name].length).toBe(SET_NAME_CHARS);
    for (let k = 0; k < 14; k++) addPair(p, 0, `Kłamstwo ${k}`, k % 2 ? '' : `Prawda ${k}`, 'fear');
    expect(p.sets[0].pairs).toHaveLength(PAIRS_MAX);
    expect(addPair(p, 1, 'Kłamstwo', '', 'anger')).toBe(true);
    expect(addPair(p, 1, 'kłamstwo')).toBe(false);
    expect(addPair(p, 1, '   ')).toBe(false);
    expect(addPair(p, 1, 'y'.repeat(200), 'z'.repeat(200))).toBe(true);
    expect([...p.sets[1].pairs[1].lie].length).toBe(PAIR_CHARS);
    expect([...p.sets[1].pairs[1].truth].length).toBe(PAIR_CHARS);
    expect(editPair(p, 1, 0, { lie: '' })).toBe(false);
    expect(editPair(p, 1, 0, { truth: 'Bóg jest ze mną', emo: 'mixed' })).toBe(true);
    expect(p.sets[1].pairs[0]).toEqual({ lie: 'Kłamstwo', truth: 'Bóg jest ze mną', emo: 'mixed' });
    // removing a pair moves the place's indices with it
    p.sets[0].place = { burned: [1, 3, 5], gilded: [1, 5], falls: 1 };
    removePair(p, 0, 3);
    expect(p.sets[0].place).toEqual({ burned: [1, 4], gilded: [1, 4], falls: 1 });
    // forgetting a set moves the chosen ones with it
    chooseSet(p, 4);
    setFirst(p, 2);
    removeSet(p, 2);
    expect(p.set).toBe(3);
    expect(p.first).toBe(-1);
    forgetSets(p);
    expect(p.sets).toEqual([]);
    expect(p.mode).toBe('today');
    expect(chooseWar(p, 'nope')).toBe(false);
    expect(chooseWar(p, 'lies')).toBe(true);
    expect(p.mode).toBe('war');
    expect(cleanPlace({ burned: [0, 1, 2], gilded: [0, 1, 2] }, 3)).toEqual({ burned: [], gilded: [], falls: 0 });
  });

  it('migrates round 15’s own thoughts into one own set “Moje myśli” with empty truths, coming first in today’s mode', () => {
    const v1 = mergeSaved(freshProgress(), {
      ver: 1, sessions: 3, own: [{ text: 'Jutro egzamin', emo: 'fear' }, { text: 'Kłótnia z bratem', emo: 'anger' }, { text: 'jutro egzamin', emo: 'fear' }],
      forgetBurned: true, burned: 12, best: { 300: 5 },
    }) as MysliProgress;
    const p = migrate(v1);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(3);
    expect(p.burned).toBe(12);
    expect(p.sets).toEqual([{ name: '', pairs: [{ lie: 'Jutro egzamin', truth: '', emo: 'fear' }, { lie: 'Kłótnia z bratem', truth: '', emo: 'anger' }], place: freshPlace() }]);
    expect(setNameOf(p.sets, 0)).toBe('Moje myśli');
    expect(p.first).toBe(0);
    expect(p.mode).toBe('today');
    expect('own' in p).toBe(false);
    expect('forgetBurned' in p).toBe(false);
    expect(migrate(migrate({ ...p }))).toEqual(p);
    // a second unnamed set: "Moje myśli 2"
    addSet(p);
    expect(setNameOf(p.sets, 1)).toBe('Moje myśli 2');
  });

  it('plays an own set as a stronghold: its lies burn, empty truths are answered by the feeling’s generic truth; nothing own reaches result()', () => {
    const sets: OwnSet[] = [{
      name: 'Tajna nazwa', place: freshPlace(),
      pairs: [{ lie: 'Szef mnie zwolni', truth: 'Moja wartość nie zależy od posady', emo: 'fear' }, { lie: 'Nigdy nie zdążę', truth: '', emo: 'sadness' }, { lie: 'Brat mnie wkurza', truth: '', emo: 'anger' }],
    }];
    const sim = later({ planned: 900, progress: { sets, mode: 'own', set: 0 } });
    expect(sim.set?.kind).toBe('own');
    expect(sim.set?.size).toBe(3);
    expect(sim.storyPage?.title).toBe('Tajna nazwa');
    const { events } = playAll(sim, HIGH);
    const truths = ofType(events, 'gilded').map(e => e.thought);
    expect(truths[0].truth).toBe('Moja wartość nie zależy od posady');
    expect(truths[1].truth).toBe(t('gt.sadness.2'));
    expect(truths[2].truth).toBe(t('gt.anger.3'));
    expect(ofType(events, 'fall')).toHaveLength(1);
    expect(sim.p.sets[0].place.falls).toBe(1);
    const r = sim.result();
    expect(JSON.stringify(r)).not.toMatch(/Tajna nazwa|Szef mnie|Nigdy nie zdążę|Brat mnie|Moja wartość nie zależy/);
    expect(r.highlights.join(' ')).toContain(t('hl.fallOwn'));
  });

  it('brings the help line forward when an own lie or truth sounds like a crisis', () => {
    const p = freshProgress();
    addSet(p, '');
    addPair(p, 0, 'Nie chcę już żyć', '', 'sadness');
    chooseSet(p, 0);
    const el = progressPanel(p, () => {});
    expect(el.textContent).toContain(t('panel.careOwn'));
  });
});

describe('round 16: the card — one clear first choice', () => {
  const click = (el: Element | null) => { (el as HTMLElement).click(); };

  it('asks “Co dziś?”: today’s mode first; the warownie chooser opens when chosen — five groups, chips with their place', () => {
    const p = freshProgress();
    p.places = { rejection: { burned: [0, 1, 2], gilded: [0], falls: 0 }, humiliation: { burned: [], gilded: [], falls: 2 } };
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    expect(el.textContent).toContain(t('panel.what'));
    expect(el.querySelectorAll('[data-mysli-mode]')).toHaveLength(3);
    expect(el.querySelector('[data-mysli-war]')).toBeNull();
    click(el.querySelector('[data-mysli-mode="war"]'));
    expect(p.mode).toBe('war');
    expect(el.querySelectorAll('[data-mysli-group]')).toHaveLength(5);
    click(el.querySelector('[data-mysli-group="wounds"]'));
    const chips = [...el.querySelectorAll('[data-mysli-war]')];
    expect(chips.map(c => c.getAttribute('data-mysli-war'))).toEqual(['rejection', 'isolation', 'humiliation', 'pessimism']);
    expect(chips[0].textContent).toContain('3/6');
    expect(chips[2].textContent).toContain('zburzona 2×');
    for (const c of chips) expect((c as HTMLElement).style.minHeight).toBe('44px');
    click(el.querySelector('[data-mysli-war="humiliation"]'));
    expect(p.war).toBe('humiliation');
    expect(el.querySelector('[data-mysli="war-chosen"]')?.textContent).toContain(t('care.crisis'));
    expect(el.querySelector('[data-mysli-war]')).toBeNull();
    expect(saves).toBeGreaterThan(2);
    // the compulsions set: its OCD note, and no daily repetition offered
    click(el.querySelector('[data-mysli="war-change"]'));
    click(el.querySelector('[data-mysli-group="unrest"]'));
    click(el.querySelector('[data-mysli-war="compulsions"]'));
    const box = el.querySelector('[data-mysli="war-chosen"]')!.textContent!;
    expect(box).toContain(t('care.ocd'));
    expect(box).toContain(t('war.dailyOcd'));
    expect(box).not.toContain(t('war.daily'));
  });

  it('makes an own warownia in the card: “+ Nowa warownia”, a pair as a block (the lie, its truth under it), “Gotowe”', () => {
    const p = freshProgress();
    const el = progressPanel(p, () => {});
    click(el.querySelector('[data-mysli-mode="own"]'));
    click(el.querySelector('[data-mysli="own-new"]'));
    expect(p.sets).toHaveLength(1);
    expect(p.mode).toBe('own');
    const lie = el.querySelector('[data-mysli="new-lie"]') as HTMLInputElement;
    const truth = el.querySelector('[data-mysli="new-truth"]') as HTMLInputElement;
    lie.value = 'Nie poradzę sobie z tym projektem';
    truth.value = 'Krok po kroku — nie w pojedynkę';
    click(el.querySelector('[data-mysli="own-add"]'));
    expect(p.sets[0].pairs).toEqual([{ lie: 'Nie poradzę sobie z tym projektem', truth: 'Krok po kroku — nie w pojedynkę', emo: 'mixed' }]);
    click(el.querySelector('[data-mysli="own-done"]'));
    expect(el.querySelector('[data-mysli="own-editor"]')).toBeNull();
    expect(el.querySelector('[data-mysli="own-chosen"]')?.textContent).toContain('Nie poradzę sobie z tym projektem');
  });
});

describe('45–60 minutes (round 24)', () => {
  /** A whole session with the arrivals (their text and truth) and the narrator's lines, each with its time. */
  const hour = (planned: number, f: (t: number, sim: MysliSim) => FocusFrame, o: SimOpts = {}) => {
    const sim = later({ ...o, planned });
    const arrivals: [number, string][] = [];
    const lines: [number, string][] = [];
    const clock = { t: 0 };
    let prev: unknown = null, most = 0;
    for (let i = 0; i < Math.round((planned + 8) / STEP); i++) {
      clock.t += STEP;
      sim.update(STEP, f(clock.t, sim), clock.t);
      const evs = sim.take();
      most = Math.max(most, evs.length);
      for (const e of evs) if (e.type === 'arrive') arrivals.push([clock.t, `${e.thought.text}|${e.thought.truth}`]);
      if (sim.story && sim.story.t > 1.5) sim.stay();
      const l = sim.talk.line;
      if (l && l !== prev) lines.push([clock.t, l.text]);
      prev = l;
    }
    return { sim, arrivals, lines, most };
  };
  const repeatGap = (xs: [number, string][]): number => {
    const at = new Map<string, number>();
    let gap = Infinity;
    for (const [t0, s] of xs) { const a = at.get(s); if (a !== undefined) gap = Math.min(gap, t0 - a); at.set(s, t0); }
    return gap;
  };

  it('the plan goes deeper at 45 and 60 minutes (more pairs, a longer quiet); 30 minutes and less as they were', () => {
    const at = (T: number) => planFor(T, BREATH_DEFAULT, cleanRhythm(null));
    expect([at(1800).thoughts, at(1800).quietSec]).toEqual([34, 90]);
    expect([at(2700).thoughts, at(2700).quietSec]).toEqual([46, 120]);
    expect([at(3600).thoughts, at(3600).quietSec]).toEqual([56, 150]);
    // each pair still worth about what it is at 30 minutes (never the 30-minute row's 30 focus-s cap all hour)
    expect(at(2700).need).toBeGreaterThan(at(1800).need);
    expect(at(2700).need).toBeLessThan(RULES.needMax);
    expect(at(3600).need).toBeLessThanOrEqual(RULES.needMax);
    // the 60-minute plan fits the library: no planned pair needs a thought twice
    expect(at(3600).thoughts).toBeLessThanOrEqual(LIBRARY.length);
    // the rhythm dials still shape it
    expect(planFor(3600, BREATH_DEFAULT, cleanRhythm({ focus: 1, rest: 6 })).thoughts).toBeLessThanOrEqual(at(3600).thoughts);
  });

  for (const min of [45, 60]) {
    it(`walks an average player through ${min} minutes: the planned pairs near the end (never at 40 %), the quiet and the close`, () => {
      const T = min * 60;
      const { sim, arrivals, lines, most } = hour(T, average);
      expect(sim.phase).toBe('done');
      // the fit (§24.4b): the average player gives the planned pairs (≥ 85 %; ~110 % measured)
      expect(sim.doneNow).toBeGreaterThanOrEqual(Math.round(sim.plan.thoughts * 0.9));
      const lastPlanned = sim.doneAt[Math.round(sim.plan.thoughts * 0.85) - 1];
      expect(lastPlanned / T).toBeGreaterThan(0.55);
      expect(lastPlanned / T).toBeLessThan(0.97);
      const kinds = sim.blocks.map(b => (b.kind === 'rest' ? `rest:${b.rest}` : b.kind));
      expect(kinds).toContain('rest:last');
      expect(kinds[kinds.length - 1]).toBe('quiet');
      const rest = sim.blocks.filter(b => b.kind === 'rest').reduce((s, b) => s + b.len, 0);
      expect(rest / T).toBeLessThan(0.34);
      // a thought comes back only after the whole library (never within 10 minutes); the narrator's lines likewise
      expect(repeatGap(arrivals)).toBeGreaterThanOrEqual(600);
      expect(repeatGap(lines)).toBeGreaterThanOrEqual(RULES.talkFresh - 0.5);
      expect(lines.filter(([t0]) => t0 > T * 0.75).length).toBeGreaterThan(2);
      // bounded: the blocks, the events of a frame, the records the progress keeps
      expect(sim.blocks.length).toBeLessThan(T / 30);
      expect(most).toBeLessThan(12);
      expect(sim.p.recent.length).toBeLessThanOrEqual(RULES.recentMax);
      // a clean, short summary; numbers that fit
      const r = sim.result();
      expect(r).toEqual(sim.result());
      expect(r.stats.length).toBeLessThanOrEqual(6);
      for (const [k, v] of r.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
      expect(r.highlights.length).toBeLessThanOrEqual(5);
      for (const h of r.highlights) expect(h.length).toBeLessThan(120);
      expect(String(r.score).length).toBeLessThanOrEqual(3);
    });
  }

  it('a strong player at 60 minutes and a warownia at 60: still a clean hour', () => {
    const strong = hour(3600, () => HIGH);
    expect(strong.sim.phase).toBe('done');
    expect(strong.sim.doneNow).toBeGreaterThan(strong.sim.plan.thoughts);
    // past the library's 56 thoughts they come round again — never sooner than 10 minutes
    expect(repeatGap(strong.arrivals)).toBeGreaterThanOrEqual(600);
    expect(strong.sim.result().highlights.length).toBeLessThanOrEqual(5);
    // a warownia falls early in an hour; its truths come round again (by design, "Prawda na co dzień"), never twice in a row
    const war = hour(3600, average, { progress: { mode: 'war', war: 'fears' } });
    expect(war.sim.phase).toBe('done');
    expect(war.sim.fellNow).toBe(true);
    expect(war.sim.dailyNow).toBeGreaterThan(WAR_SIZE);
    for (let i = 1; i < war.arrivals.length; i++) expect(war.arrivals[i][1]).not.toBe(war.arrivals[i - 1][1]);
    expect(repeatGap(war.lines)).toBeGreaterThanOrEqual(RULES.talkFresh - 0.5);
    // 30 minutes and less keep the narrator as it was (no wait)
    for (const planned of [180, 600, 1800]) expect((later({ planned }).talk as unknown as { fresh: number }).fresh).toBe(0);
  });
});
