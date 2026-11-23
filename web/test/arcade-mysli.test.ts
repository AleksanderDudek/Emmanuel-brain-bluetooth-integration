import { describe, expect, it } from 'vitest';
import { BREATH_DEFAULT, BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import {
  AREAS, CHOICES, CLOSE_VERSES, EMO, EMOS, LIBRARY, MOMENTS, OWN_CHARS, OWN_MAX, OWN_VERSES, PATTERNS, QUIET_VERSES, THOUGHT_CHARS, VALVE_VERSES,
  blend, cleanText, dominant, fits, flameTones, isMixed, needsCare, normMix, ownMix,
} from '../src/arcade/mysli/content';
import { CATALOGS, LIBRARY_KEYS, emoList, emoNames, t, unit } from '../src/arcade/mysli/i18n';
import {
  addOwn, bestOf, forgetOwn, freshProgress, migrate, removeOwn, restoreSkipped, setBefore, setEmotion, skipThought, toggleArea, type MysliProgress,
} from '../src/arcade/mysli/meta';
import { RULES, cleanRhythm, focusRate, planFor, readTime } from '../src/arcade/mysli/rules';
import { MysliSim, libraryOrder, pageOf, pageTime, type SimEvent } from '../src/arcade/mysli/sim';
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

const ALL_SEEN = ['s.open', 'c.burn', 'c.skip', 'c.breath', 'c.blind'];

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
        const th = cat[`th.${d.id}`], tw = cat[`tw.${d.id}`];
        expect(th?.trim(), `${l} th.${d.id}`).toBeTruthy();
        expect(tw?.trim(), `${l} tw.${d.id}`).toBeTruthy();
        expect([...th].length, `${l} th.${d.id}`).toBeLessThanOrEqual(THOUGHT_CHARS);
        expect([...tw].length, `${l} tw.${d.id}`).toBeLessThanOrEqual(140);
      }
    }
    expect(LIBRARY_KEYS).toHaveLength(112);
  });

  it('writes the Polish thoughts without gendered forms, and holds no thought of self-harm', () => {
    for (const d of LIBRARY) {
      const s = CATALOGS.pl[`th.${d.id}` as keyof typeof CATALOGS.pl] as string;
      expect(s, d.id).not.toMatch(/\p{L}+(łem|łam|łabym|łbym)(?!\p{L})|(?<!\p{L})(sam|sama|samotny|samotna|głupi|głupia|beznadziejny|beznadziejna)(?!\p{L})/u);
    }
    for (const l of LANGS) {
      for (const d of LIBRARY) {
        for (const k of ['th', 'tw']) {
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
  it('brings the player’s own thoughts first, in their order', () => {
    const sim = later({ planned: 600, progress: { own: [{ text: 'Jutro egzamin', emo: 'fear' }, { text: 'Kłótnia z bratem', emo: 'anger' }] } });
    const clock = { t: 0 };
    const seen: string[] = [];
    const evs = drive(sim, 200, HIGH, clock);
    for (const e of ofType(evs, 'arrive')) seen.push(e.thought.text);
    expect(seen.slice(0, 2)).toEqual(['Jutro egzamin', 'Kłótnia z bratem']);
    expect(ofType(evs, 'arrive')[2].thought.own).toBe(-1);
    // their true words are the generic ones of their emotion, and the result never carries their text
    expect(ofType(evs, 'burned')[0].thought.word).toMatch(/\S/);
    const r = sim.result();
    expect(JSON.stringify(r)).not.toMatch(/Jutro egzamin|Kłótnia z bratem/);
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
      expect(sim.burnedNow).toBeGreaterThanOrEqual(Math.round(sim.plan.thoughts * 0.85));
      const lastPlanned = sim.burnAt[Math.round(sim.plan.thoughts * 0.85) - 1];
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
    const mixedBurned = sim.burnAt.length;
    expect(mixedBurned).toBeGreaterThan(20);
    expect(sim.quietNow).toBeGreaterThan(20);
  });

  it('reads the player’s rhythm: thoughts before a rest and breaths in a rest', () => {
    const one = later({ planned: 600, rhythm: { focus: 1, rest: 3 } });
    playAll(one, average);
    const pushes = one.blocks.filter(b => b.kind === 'push');
    expect(one.plan.perPush).toBe(1);
    expect(one.plan.restCycles).toBe(3);
    // a push burns one thought (one burned before the push's least length takes the next along)
    expect(one.burnedNow).toBeLessThanOrEqual(2 * pushes.length);
    expect(one.burnedNow).toBeGreaterThanOrEqual(Math.round(one.plan.thoughts * 0.85));
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
    expect(sim.burnedNow).toBeGreaterThanOrEqual(3);
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
    for (const k of ['settle', 'arrive', 'burn', 'rest', 'last', 'quiet', 'end']) expect(nows, k).toContain(k);
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
    expect(sim.p.best['300']).toBe(Math.max(2, sim.burnedNow));
    expect(a.record).toBe(sim.burnedNow > 2);
    const burned = sim.p.burned;
    sim.finish();
    expect(sim.p.burned).toBe(burned);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.byEmo.fear + sim.p.byEmo.sadness + sim.p.byEmo.anger).toBe(sim.burnedNow);
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

  it('remembers the library thoughts burned (they go last next time), and forgets burned own thoughts when asked', () => {
    const sim = later({ planned: 300, progress: { own: [{ text: 'Moja myśl', emo: 'sadness' }], forgetBurned: true } });
    playAll(sim, HIGH);
    expect(sim.p.recent.length).toBeGreaterThan(0);
    expect(sim.p.recent.length).toBeLessThanOrEqual(RULES.recentMax);
    expect(sim.p.own).toEqual([]);
    expect(sim.p.ownBurned).toBe(1);
  });

  it('works with HALO (a 2 s lead-in) as with Mendi', () => {
    const sim = later({ planned: 600, eeg: true });
    expect(sim.lead).toBe(2);
    playAll(sim, average);
    expect(sim.burnedNow).toBeGreaterThanOrEqual(Math.round(sim.plan.thoughts * 0.85));
  });
});

describe('the meta', () => {
  it('reads the placeholder’s save and garbage as a fresh progress, repairing every field of a wrong type', () => {
    const fromPlaceholder = migrate(mergeSaved(freshProgress(), { best: null }) as MysliProgress);
    expect(fromPlaceholder).toEqual(freshProgress());
    const broken = migrate({
      ver: 1, sessions: 'x', emotion: 'joy', areas: ['work', 'moon', 'work'], own: [{ text: '  a  ', emo: 'x' }, 'no', { text: '' }], recent: ['work.lose', 'nope'],
      skipped: 5, before: 14, history: [{ day: 3, after: 4 }, { after: 'x' }], best: { 300: 'a', 600: 4 }, seen: [1, 'a', 'a'], byEmo: { fear: -2 },
    } as unknown as MysliProgress);
    expect(broken.sessions).toBe(0);
    expect(broken.emotion).toBe('unknown');
    expect(broken.areas).toEqual(['work']);
    expect(broken.own).toEqual([{ text: 'a', emo: 'mixed' }]);
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

  it('chooses what weighs, the areas, own thoughts (at most 8, no doubles), and forgets them on request', () => {
    const p = freshProgress();
    expect(setEmotion(p, 'mixed')).toBe(true);
    expect(setEmotion(p, 'joy')).toBe(false);
    expect(toggleArea(p, 'work')).toBe(true);
    expect(p.areas).toEqual(['work']);
    toggleArea(p, 'work');
    expect(p.areas).toEqual([]);
    for (const a of AREAS) toggleArea(p, a);
    expect(p.areas).toEqual([]);
    for (let i = 0; i < 12; i++) addOwn(p, `Myśl ${i}`, 'fear');
    expect(p.own).toHaveLength(OWN_MAX);
    expect(addOwn(p, 'Myśl 0')).toBe(false);
    expect(addOwn(p, '   ')).toBe(false);
    expect(removeOwn(p, 0)).toBe(true);
    expect(addOwn(p, 'x'.repeat(200))).toBe(true);
    expect([...p.own[p.own.length - 1].text].length).toBe(OWN_CHARS);
    forgetOwn(p);
    expect(p.own).toEqual([]);
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
  pl: /energi|uzdrawia|\b(u|wy)?leczy|czakr|kundalini|\bw[ąę]ż|magi[aię]|zaklęci/i,
  en: /energy|heal(s|ing)? power|\bcures?\b|\bheals\b|chakra|kundalini|serpent|\bmagic|\bspell\b/i,
  de: /energie|heilt|chakra|kundalini|schlange|magie|zauber/i,
  sv: /energi|\bhelar\b|chakra|kundalini|\borm(en|ar)?\b|magi|trollformel/i,
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
