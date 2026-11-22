import { describe, expect, it } from 'vitest';
import {
  ALL_IDS, LISTS, LOOP, LOOPS, MOMENTS, SOURCES, VARIANTS, count, elFact, elGuide, elName, elSource, linesOf, loopValueAt, rangeText,
  valueText, type Element, type VariantId,
} from '../src/arcade/swiatlo/content';
import { CATALOGS, t, unit } from '../src/arcade/swiatlo/i18n';
import { WORDS } from '../src/arcade/swiatlo/words';
import { bestOf, choose, freshProgress, litIn, migrate, restart, startAt, type SwiatloProgress } from '../src/arcade/swiatlo/meta';
import { RULES, readSec } from '../src/arcade/swiatlo/rules';
import { ROOT, SwiatloSim, VERSE, fillMult, restFor, warmFor, type SimEvent } from '../src/arcade/swiatlo/sim';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CHECK_SIZES, MIN_TAP, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { songProblems } from '../src/arcade/kit/song';
import { coachText, howto } from '../src/arcade/swiatlo/index';
import { CTRLS, elementCam, figCam, hitTest, layout, pickerRect, storyRect, tapTargets } from '../src/arcade/swiatlo/layout';
import { geoBox } from '../src/arcade/swiatlo/figure';
import { buildSong } from '../src/arcade/swiatlo/lullaby';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 12, calm: 0.05 });
const MID = frame({ level: 0.55, activity: 2.5, focused: true, hold: 2, calm: 0.3 });
const LOW = frame({ level: 0.2, activity: -1, focused: false, calm: 0.7 });
const NONE = frame({ reliable: false, activity: null, level: 0, focused: false, calm: 0 });

const ALL_SEEN = ['s.open', 's.news', 'c.fill', 'c.rest', 'c.nav', 'c.blind', 'c.stay'];

type SimOpts = { progress?: Partial<SwiatloProgress>; planned?: number; seed?: number; mouse?: boolean };

function makeSim(o: SimOpts = {}): SwiatloSim {
  const p = { ...freshProgress(), ...o.progress };
  const sim = new SwiatloSim({ progress: p, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 600, eeg: false, tuning: TUNING, mouse: o.mouse });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: SwiatloSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: () => void): SimEvent[] {
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

/** Focus in a push, calm in rest (an ideal player). */
const ideal = (sim: SwiatloSim) => () => (sim.restBlock ? frame({ level: 0.1, activity: -2, focused: false, calm: 0.85 }) : HIGH);

const POLISH = /[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/;

describe('the five meditations (content.ts, words-*.ts)', () => {
  it('has the five variants with many elements each, in a sensible order', () => {
    expect(VARIANTS).toEqual(['narzady', 'miesnie', 'mozg', 'konczyny', 'rownowaga']);
    expect(VARIANTS.map(count)).toEqual([19, 19, 21, 28, 9]);
    expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length);
    const ids = (v: VariantId) => LISTS[v].map(e => e.id.split('.').slice(1).join('.'));
    expect(ids('narzady')).toEqual(['brain', 'eyes', 'thyroid', 'lungs', 'heart', 'liver', 'gall', 'stomach', 'spleen', 'pancreas', 'adrenals', 'kidneys',
      'small', 'large', 'bladder', 'bones', 'marrow', 'nodes', 'skin']);
    // the muscles: down the front, a turn, up the back
    const views = LISTS.miesnie.map(e => e.view);
    expect(views.indexOf('back')).toBe(12);
    expect(views.slice(12).every(v => v === 'back')).toBe(true);
    expect(ids('miesnie')).toContain('gluteus');
    expect(ids('miesnie')).toContain('diaphragm');
    // the brain: its lateral face first (9), then the cut through the middle (12)
    expect(LISTS.mozg.slice(0, 9).every(e => e.view === 'lat')).toBe(true);
    expect(LISTS.mozg.slice(9).every(e => e.view === 'med')).toBe(true);
    expect(ids('mozg')).toEqual(['prefrontal', 'broca', 'motor', 'sensory', 'parietal', 'wernicke', 'temporal', 'occipital', 'insula', 'cingulate', 'callosum',
      'thalamus', 'basal', 'hippocampus', 'amygdala', 'hypothalamus', 'pituitary', 'midbrain', 'pons', 'medulla', 'cerebellum']);
    // the limbs: the left leg from the toes, the right leg, the left arm from the fingers, the right arm
    expect(ids('konczyny').slice(0, 7)).toEqual(['L.toes', 'L.foot', 'L.ankle', 'L.shin', 'L.knee', 'L.thigh', 'L.hip']);
    expect(ids('konczyny').slice(7, 14)).toEqual(['R.toes', 'R.foot', 'R.ankle', 'R.shin', 'R.knee', 'R.thigh', 'R.hip']);
    expect(ids('konczyny').slice(14, 21)).toEqual(['L.fingers', 'L.hand', 'L.wrist', 'L.forearm', 'L.elbow', 'L.arm', 'L.shoulder']);
    expect(ids('konczyny').slice(21)).toEqual(['R.fingers', 'R.hand', 'R.wrist', 'R.forearm', 'R.elbow', 'R.arm', 'R.shoulder']);
    expect(ids('rownowaga')).toEqual([...LOOPS]);
  });

  it('places the elements where they are: the leg segments head down the leg, the person’s left at the viewer’s right', () => {
    const at = (id: string) => LISTS.narzady.concat(LISTS.konczyny).find(e => e.id === id)!.geo.c;
    expect(at('o.heart')[0]).toBeGreaterThan(0);
    expect(at('o.liver')[0]).toBeLessThan(0);
    expect(at('o.spleen')[0]).toBeGreaterThan(0);
    expect(at('o.gall')[0]).toBeLessThan(0);
    for (const side of ['L', 'R'] as const) {
      const leg = LISTS.konczyny.filter(e => e.side === side && ['toes', 'foot', 'ankle', 'shin', 'knee', 'thigh', 'hip'].includes(e.part!));
      for (let i = 1; i < leg.length; i++) expect(leg[i].geo.c[1], leg[i].id).toBeLessThan(leg[i - 1].geo.c[1]);
      for (const e of LISTS.konczyny.filter(x => x.side === side)) expect(Math.sign(e.geo.c[0]), e.id).toBe(side === 'L' ? 1 : -1);
    }
    // the brain: the frontal pole on the left of the picture, the cerebellum at the back and below
    const b = (id: string) => LISTS.mozg.find(e => e.id === id)!.geo.c;
    expect(b('b.prefrontal')[0]).toBeLessThan(b('b.motor')[0]);
    expect(b('b.motor')[0]).toBeLessThan(b('b.sensory')[0]);
    expect(b('b.occipital')[0]).toBeGreaterThan(b('b.parietal')[0]);
    expect(b('b.cerebellum')[1]).toBeGreaterThan(b('b.thalamus')[1]);
    expect(b('b.pons')[1]).toBeGreaterThan(b('b.midbrain')[1]);
    expect(b('b.medulla')[1]).toBeGreaterThan(b('b.pons')[1]);
  });

  it('gives every element a shape of its own, a colour, its Latin, a guidance line and a fact with its source in four languages', () => {
    for (const e of VARIANTS.flatMap(v => LISTS[v])) {
      expect(e.geo.shapes.length, e.id).toBeGreaterThan(0);
      expect(e.hue, e.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(e.latin.length, e.id).toBeGreaterThan(2);
      expect(e.src.length, e.id).toBeGreaterThan(8);
      const [x0, y0, x1, y1] = geoBox(e.geo);
      expect(x1 > x0 && y1 > y0, e.id).toBe(true);
      if (e.loop) continue;
      for (const l of ['pl', 'en', 'de', 'sv'] as const) {
        const W = WORDS[l];
        const name = W.name[e.id], guide = W.guide[e.part ? `l.${e.part}` : e.id], fact = W.fact[e.id];
        expect(name, `${l} ${e.id} name`).toBeTruthy();
        expect(guide, `${l} ${e.id} guide`).toBeTruthy();
        expect(fact, `${l} ${e.id} fact`).toBeTruthy();
        expect(fact.length, `${l} ${e.id} fact`).toBeLessThanOrEqual(190);
        expect(guide.length, `${l} ${e.id} guide`).toBeLessThanOrEqual(110);
        if (l !== 'pl') for (const s of [name, guide, fact]) expect(s, `${l} ${e.id}`).not.toMatch(POLISH);
      }
    }
    // the limbs' two sides tell different facts
    for (const part of ['toes', 'knee', 'hand', 'shoulder']) expect(WORDS.pl.fact[`l.L.${part}`]).not.toBe(WORDS.pl.fact[`l.R.${part}`]);
  });

  it('keeps every fact true to its source and plain: no promises, a no-break space before units, the verified numbers', () => {
    const all = (['pl', 'en', 'de', 'sv'] as const).flatMap(l => Object.entries(WORDS[l].fact).map(([k, v]) => [`${l}.${k}`, v] as const));
    for (const [k, v] of all) {
      expect(v, k).not.toMatch(/uzdraw|leczy|heals?\b|cures?\b|heilt|botar/i);
      expect(v, k).not.toMatch(/\d (ml|mL|g|m|m²|mln|milion|miliard|million|billion|Million|Milliard|miljon|miljard|litr|liter|Liter|%)(?=[\s.,;)]|$)/);
    }
    // a few of the checked numbers (StatPearls / PubMed): the brain 2 % / 20 %, 206 bones, 86 billion neurons, 26 foot bones
    expect(WORDS.en.fact['o.brain']).toMatch(/2%.*20%/);
    expect(WORDS.en.fact['o.bones']).toMatch(/206/);
    expect(WORDS.en.fact['b.cerebellum']).toMatch(/69 of its 86/);
    expect(WORDS.en.fact['l.L.toes']).toMatch(/26 bones; 14/);
    expect(WORDS.en.fact['m.gluteus']).toMatch(/largest of the buttock muscles/);
    expect(WORDS.pl.fact['m.gluteus']).toMatch(/Największy z mięśni pośladka/);
  });

  it('keeps Równowaga’s loops: the value comes home as the light fills, inside the range only when full', () => {
    for (const id of LOOPS) {
      const L = LOOP[id];
      for (const kick of L.kicks) {
        const v0 = loopValueAt(id, kick, 0), v1 = loopValueAt(id, kick, 1);
        expect(v0, `${id}.${kick.id}`).toBeCloseTo(kick.v0, 6);
        expect(v1 >= L.lo && v1 <= L.hi, `${id}.${kick.id}`).toBe(true);
        expect(kick.v0 < L.lo || kick.v0 > L.hi, `${id}.${kick.id} starts out of range`).toBe(true);
        // monotone toward the set point
        let prev = Math.abs(v0 - L.set);
        for (let f = 0.1; f <= 1.0001; f += 0.1) {
          const d = Math.abs(loopValueAt(id, kick, f) - L.set);
          expect(d).toBeLessThanOrEqual(prev + 1e-9);
          prev = d;
        }
      }
      expect(rangeText(L).length).toBeGreaterThan(2);
      for (const d of [1, 2, 3]) {
        const e = LISTS.rownowaga.find(x => x.loop === id)!;
        expect(elFact(e, d).length, `${id}.${d}`).toBeGreaterThan(10);
        expect(elSource(e, d).length).toBeGreaterThan(5);
      }
    }
    expect(valueText(LOOP.brain, 37.8)).toBe('37,8 °C');
    expect(Object.keys(SOURCES).length).toBe(36);
  });
});

describe('only real focus fills (the round’s rule)', () => {
  it('fills nothing without focus — below the threshold, without a signal, in rest — and loses nothing', () => {
    for (const f of [LOW, NONE]) {
      const sim = later({ progress: { variant: 'narzady' } });
      drive(sim, 240, f);
      expect(sim.litNow, String(f.reliable)).toEqual([]);
      expect(sim.fill).toBe(0);
      expect(sim.fillSec).toBe(0);
    }
  });

  it('fills the element in the light with focus, faster in strong focus, and never lets the fill go back', () => {
    expect(fillMult(HIGH)).toBeGreaterThan(fillMult(MID));
    const sim = later();
    let prev = 0;
    const rng = mulberry32(7);
    drive(sim, 200, () => (rng() < 0.5 ? HIGH : rng() < 0.5 ? LOW : NONE), { t: 0 }, () => {
      if (sim.stage === 'at' && sim.idx === 0 && sim.litNow.length === 0) {
        expect(sim.fill).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = sim.fill;
      }
    });
    expect(sim.litNow.length).toBeGreaterThan(0);
  });

  it('lights an element in about 14 focused seconds at the threshold, 11–12 in strong focus (after the 5 s lead-in)', () => {
    const at = (f: FocusFrame) => {
      const sim = later();
      const clock = { t: 0 };
      while (!sim.litNow.length && clock.t < 60) drive(sim, 0.1, f, clock);
      return clock.t;
    };
    const mid = at(frame({ level: 0.5, activity: 2, focused: true, hold: 0 }));
    const high = at(HIGH);
    expect(mid).toBeGreaterThan(5 + 13);
    expect(mid).toBeLessThan(5 + 16);
    expect(high).toBeLessThan(mid);
    expect(high).toBeGreaterThan(5 + 10);
  });

  it('the hands never fill: taps, Space, walking and the picker add no light', () => {
    const sim = later();
    drive(sim, 10, LOW, { t: 0 }, () => { sim.stay(); sim.key(' ', true); });
    expect(sim.fill).toBe(0);
    sim.next();
    sim.prev();
    sim.openPicker();
    sim.closePicker();
    drive(sim, 5, LOW);
    expect(sim.fill).toBe(0);
    expect(sim.litNow).toEqual([]);
  });
});

describe('the blocks: a push fills one element, a rest of whole breaths follows', () => {
  it('ends a push when its element is full, then rests in whole breaths (4 in · 6 out), then pushes the next element', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 300, ideal(sim), clock);
    const done = sim.blocks.filter(b => b.end !== undefined);
    const kinds = done.map(b => b.kind);
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    for (const b of done.filter(x => x.kind === 'rest')) expect(Math.round(b.dur) % 10).toBe(0);
    expect(restFor(600)).toBe(20);
    // each push ended on a lit element (an ideal player never needs the valve)
    expect(done.filter(b => b.kind === 'push').every(b => b.dur < RULES.maxPush)).toBe(true);
    expect(sim.litNow.length).toBeGreaterThanOrEqual(done.filter(b => b.kind === 'push').length);
    expect(sim.litNow[0]).toBe('o.brain');
    expect(sim.litNow[1]).toBe('o.eyes');
  });

  it('a push that cannot fill ends after maxPush with a kind line; the element keeps its light', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 10, MID, clock);
    const kept = sim.fill;
    expect(kept).toBeGreaterThan(0);
    expect(kept).toBeLessThan(1);
    drive(sim, RULES.maxPush - 10 + 0.2, LOW, clock);
    expect(sim.restBlock).toBe(true);
    expect(sim.fill).toBeCloseTo(kept, 6);
    expect(sim.blocks[0].dur).toBeCloseTo(RULES.maxPush, 0);
  });

  it('judges each block once at its end, not a push under judgeMin, and pays a block judged well', () => {
    const sim = later({ progress: { pos: { ...freshProgress().pos, narzady: { idx: 0, fill: 0.95 } } } });
    const evs = drive(sim, 120, ideal(sim));
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBeGreaterThan(2);
    const short = ends.find(e => e.block.kind === 'push' && e.block.dur < RULES.judgeMin);
    if (short) expect(short.verdict).toBeNull();
    expect(ends.some(e => e.verdict === true)).toBe(true);
  });

  it('makes every 4th push blind from the 3rd session, never the first of a session; a blind push hides the gauge and shows its fill at the end', () => {
    const sim = later({ progress: { sessions: 3, pushes: 2 } });
    const blinds: boolean[] = [];
    let metered = false;
    drive(sim, 400, ideal(sim), { t: 0 }, () => {
      if (sim.pushBlock && sim.blockT < 0.04) blinds.push(sim.block.blind);
      if (sim.blind && sim.meter() !== null) metered = true;
    });
    expect(blinds[0]).toBe(false);
    expect(blinds.some(Boolean)).toBe(true);
    expect(metered).toBe(false);
    const fresh = later({ progress: { sessions: 1, pushes: 3 } });
    drive(fresh, 300, ideal(fresh));
    expect(fresh.blocks.some(b => b.blind)).toBe(false);
  });

  it('opens a first-ever session with the story card and a warm-up that fills at half the rate', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.story?.kind).toBe('open');
    expect(sim.block.kind).toBe('warmup');
    expect(sim.block.dur).toBe(warmFor(300));
    sim.story!.t = 1;
    sim.stay();
    sim.story!.t = 1;
    sim.stay();
    expect(sim.story).toBeNull();
    drive(sim, 4, HIGH);
    const r = sim.fillRate(HIGH);
    expect(r).toBeCloseTo((fillMult(HIGH) / RULES.elementSec) * RULES.warmK, 6);
  });

  it('scores with the smoke test’s crude input (40 s, focus on, a centre tap every 0.65 s, Space every third): lux > 0 within 22 s', () => {
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    let n = 0, next = 0.65;
    drive(sim, 22, HIGH, clock, () => {
      if (clock.t >= next) {
        next += 0.65;
        n++;
        sim.stay();
        if (n % 3 === 0) sim.key(' ', true);
      }
    });
    expect(sim.score).toBeGreaterThan(0);
    drive(sim, 25, HIGH, clock);
    expect(sim.phase).toBe('done');
  });
});

describe('choose, walk, go on (meta.ts)', () => {
  it('remembers each meditation’s own place, and the next session goes on there', () => {
    const p = { ...freshProgress(), sessions: 5, pushes: 1, seen: [...ALL_SEEN] };
    const a = new SwiatloSim({ progress: p, rng: mulberry32(2), plannedSec: 300, eeg: false, tuning: TUNING });
    a.start();
    drive(a, 120, ideal(a));
    const at = a.idx;
    a.finish();
    expect(p.pos.narzady.idx).toBeGreaterThanOrEqual(at);
    expect(p.sessions).toBe(6);
    const b = new SwiatloSim({ progress: p, rng: mulberry32(3), plannedSec: 300, eeg: false, tuning: TUNING });
    b.start();
    expect(b.idx).toBe(p.pos.narzady.idx);
  });

  it('keeps the light gathered at the element where a session stopped', () => {
    const p = { ...freshProgress(), sessions: 5, pushes: 1, seen: [...ALL_SEEN] };
    const a = new SwiatloSim({ progress: p, rng: mulberry32(2), plannedSec: 300, eeg: false, tuning: TUNING });
    a.start();
    drive(a, 10, HIGH);
    const f = a.fill;
    expect(f).toBeGreaterThan(0);
    a.finish();
    expect(p.pos.narzady).toEqual({ idx: 0, fill: f });
    const b = new SwiatloSim({ progress: p, rng: mulberry32(3), plannedSec: 300, eeg: false, tuning: TUNING });
    b.start();
    expect(b.fill).toBeCloseTo(f, 6);
  });

  it('chooses a meditation, starts it over, or starts it at a chosen element (the album)', () => {
    const p = freshProgress();
    expect(choose(p, 'mozg')).toBe(true);
    expect(choose(p, 'nope')).toBe(false);
    expect(p.variant).toBe('mozg');
    expect(startAt(p, 'konczyny', 14)).toBe(true);
    expect(p.variant).toBe('konczyny');
    expect(p.pos.konczyny).toEqual({ idx: 14, fill: 0 });
    expect(startAt(p, 'konczyny', 99)).toBe(false);
    restart(p, 'konczyny');
    expect(p.pos.konczyny).toEqual({ idx: 0, fill: 0 });
    const sim = later({ progress: { variant: 'konczyny', pos: { ...freshProgress().pos, konczyny: { idx: 15, fill: 0 } } } });
    expect(sim.element.id).toBe('l.L.hand');
  });

  it('switches meditations in the picker, each going on where it stopped; walks round with ◀ ▶', () => {
    const sim = later();
    drive(sim, 3, LOW);
    sim.next();
    sim.next();
    expect(sim.idx).toBe(2);
    sim.openPicker();
    expect(sim.picker).toBe(true);
    sim.pick('mozg');
    expect(sim.variant).toBe('mozg');
    expect(sim.stage).toBe('dive');
    expect(sim.p.pos.narzady.idx).toBe(2);
    sim.pick('narzady');
    expect(sim.idx).toBe(2);
    sim.prev(); sim.prev(); sim.prev();
    expect(sim.idx).toBe(count('narzady') - 1);
  });

  it('turns the figure between the front and the back muscles, and the brain between its face and its middle', () => {
    const m = later({ progress: { variant: 'miesnie', pos: { ...freshProgress().pos, miesnie: { idx: 11, fill: 0 } } } });
    drive(m, 2, LOW);
    m.next();
    expect(m.stage).toBe('turn');
    expect(m.view).toBe('back');
    const b = later({ progress: { variant: 'mozg', pos: { ...freshProgress().pos, mozg: { idx: 8, fill: 0 } } } });
    expect(b.stage).toBe('dive');
    drive(b, 3.5, LOW);
    b.next();
    expect(b.stage).toBe('turn');
    expect(b.view).toBe('med');
  });

  it('reads a first-version save: its sessions, records and song stay, its map becomes Równowaga’s album', () => {
    const v1 = { ver: 1, sessions: 7, pushes: 20, scans: 2, map: { 'brain:1': 3, 'brain:2': 1, 'heart:1': 2, 'junk:9': 3 }, cards: ['brain:1'], depth: 2,
      best: { 300: 900 }, balanced: 12, golden: 3, bestScan: 4, fastest: 100, breaths: 9, pulseSeen: true, song: false, seen: ['s.open'], lastLen: 300 };
    const p = migrate(mergeSaved(freshProgress(), v1) as SwiatloProgress);
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.pushes).toBe(20);
    expect(bestOf(p)).toBe(900);
    expect(p.song).toBe(false);
    expect(p.lit).toEqual({ 'r.brain': 2, 'r.heart': 1 });
    expect(p.whole.rownowaga).toBe(2);
    expect(p.variant).toBe('narzady');
    // a returning player hears what changed, once
    const sim = new SwiatloSim({ progress: p, rng: mulberry32(1), plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.story?.kind).toBe('news');
    // Równowaga's next card for the brain is one level deeper (lit at two depths before)
    const s2 = later({ progress: { ...p, variant: 'rownowaga', seen: [...ALL_SEEN] } });
    const lit = ofType(drive(s2, 60, ideal(s2)), 'lit');
    expect(lit[0].id).toBe('r.brain');
    expect(lit[0].times).toBe(3);
  });

  it('survives garbage', () => {
    const p = migrate({ ver: 2, sessions: 'x', variant: 'nope', pos: { mozg: { idx: 999, fill: 7 } }, lit: { 'o.heart': 2, bogus: 4 }, whole: 5, best: null } as unknown as SwiatloProgress);
    expect(p.sessions).toBe(0);
    expect(p.variant).toBe('narzady');
    expect(p.pos.mozg).toEqual({ idx: count('mozg') - 1, fill: 0 });
    expect(p.lit).toEqual({ 'o.heart': 2 });
    expect(litIn(p, 'narzady')).toBe(1);
    expect(migrate(migrate(p))).toEqual(p);
  });
});

describe('clarity: what to do now, words long enough to read, the summary', () => {
  it('says what to do now in one short line that changes only with the action', () => {
    const sim = later();
    const seen = new Set<string>();
    drive(sim, 120, ideal(sim), { t: 0 }, () => { const d = sim.doNow(); if (d) seen.add(`${d.icon} ${d.text}`); });
    expect([...seen].some(s => s.startsWith('◎') && s.includes(elName(LISTS.narzady[0])))).toBe(true);
    expect([...seen].some(s => s.startsWith('☾'))).toBe(true);
    for (const s of seen) expect(s.length).toBeLessThanOrEqual(60);
  });

  it('keeps captions up long enough to read twice: ≥ 2.5 s + 70 ms a character, never under 4.5 s', () => {
    expect(readSec('krótko')).toBe(4.5);
    const long = 'x'.repeat(80);
    expect(readSec(long)).toBeCloseTo(2.5 + 0.07 * 80, 6);
    const sim = later();
    drive(sim, 60, ideal(sim), { t: 0 }, () => {
      const l = sim.talk.line;
      if (l) expect(l.dur).toBeGreaterThanOrEqual(readSec(l.text) - 1e-9);
    });
  });

  it('shows the fact card in the rest that follows, as long as it takes to read it', () => {
    const sim = later();
    let shownFor = 0;
    drive(sim, 60, ideal(sim), { t: 0 }, () => { if (sim.factShown && sim.restBlock) shownFor += STEP; });
    const f = elFact(LISTS.narzady[0]);
    expect(shownFor).toBeGreaterThanOrEqual(readSec(f) - 0.2);
  });

  it('gives the push’s strategy as the element’s own guidance, every third push a counting one', () => {
    const sim = later();
    expect(sim.tip).toBe(elGuide(LISTS.narzady[0]));
    const tips: string[] = [];
    drive(sim, 300, ideal(sim), { t: 0 }, () => { if (sim.pushBlock && sim.blockT < 0.04) tips.push(sim.tip); });
    expect(tips.some(x => [1, 2, 3].map(i => t(`tip.count.${i}` as 'tip.count.1')).includes(x))).toBe(true);
  });

  it('gives result() idempotently, the record with Math.max, a passage that exists', () => {
    const sim = later();
    drive(sim, 120, ideal(sim));
    sim.finish();
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(a.unit).toBe(unit(a.score));
    expect(() => passage(a.verse!)).not.toThrow();
    for (const v of VARIANTS) expect(() => passage(VERSE[v])).not.toThrow();
    expect(() => passage(ROOT)).not.toThrow();
    expect(a.highlights.length).toBeGreaterThan(0);
    expect(a.stats.length).toBe(6);
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Zofia three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(linesOf(m).length, m).toBe(3);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps Polish letters and words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(POLISH);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
          expect(s, `${l}.${k}`).not.toMatch(/Gott mit uns/);
        }
      }
      for (const s of Object.values(WORDS[l].fact)) if (/[„“”"]/.test(s)) expect(s).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
  });

  it('suggests strategies, never to concentrate harder, never claims to heal; the last tip says the band measures attention', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (typeof v !== 'string') continue;
        if (/^(tip|howto|now)\./.test(k)) expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
        expect(v, `${l}.${k}`).not.toMatch(/uzdrawia|leczy Cię|heals you|cures|heilt dich|botar dig/i);
      }
    }
    expect(CATALOGS.pl['howto.tip2']).toMatch(/mierzy uwagę.*nie leczenie/);
    expect(CATALOGS.en['howto.tip2']).toMatch(/measures attention.*not a treatment/);
    expect(CATALOGS.de['howto.tip2']).toMatch(/misst Aufmerksamkeit.*keine Behandlung/);
    expect(CATALOGS.sv['howto.tip2']).toMatch(/mäter uppmärksamhet.*inte behandling/);
  });

  it('glosses the loops’ terms in plain words', () => {
    expect(CATALOGS.pl['fix.kidney.salty']).toMatch(/ADH, hormon oszczędzania wody/);
    expect(CATALOGS.pl['fix.heart.stairs']).toMatch(/„hamulec” serca/);
    expect(CATALOGS.en['fix.liver.meal']).toMatch(/\(as glycogen\)/);
  });

  it('bends the headline’s unit (1 luks, 3 luksy, 5 luksów)', () => {
    expect(unit(1)).toBe('luks');
    expect(unit(3)).toBe('luksy');
    expect(unit(5)).toBe('luksów');
  });

  it('speaks to a mouse in clicks and to a finger in taps', () => {
    const CLICK = /klik|click|klick/i;
    expect(howto(false).hands.filter(x => x.gesture === 'tap').every(x => CLICK.test(x.text))).toBe(true);
    expect(howto(true).hands.some(x => CLICK.test(x.text))).toBe(false);
    expect(coachText('nav', false)).toMatch(CLICK);
    expect(coachText('nav', true)).not.toMatch(CLICK);
    expect(howto(false).hands.some(x => x.gesture === 'keys')).toBe(true);
  });
});

describe('mobile first and the desk (DESIGN §12, §14)', () => {
  const sizes = CHECK_SIZES;

  it('gives every control a finger-sized target inside the insets, clear of the others, at every size, for the figure and the brain', () => {
    for (const s of sizes) for (const brain of [false, true]) for (const touch of [true, false]) {
      const L = layout(s.w, s.h, s.insets, touch, brain);
      const name = `${s.name} brain=${brain} touch=${touch}`;
      expect(auditTargets(tapTargets(L, { story: null, picker: false }), s.w, s.h, s.insets), name).toEqual([]);
      expect(auditTargets(tapTargets(L, { story: null, picker: true }), s.w, s.h, s.insets), `${name} picker`).toEqual([]);
      const st = storyRect(L, 300);
      expect(auditTargets(tapTargets(L, { story: st, picker: false }), s.w, s.h, s.insets), `${name} story`).toEqual([]);
      // the card, the stage and the buttons do not overlap
      const c = L.card;
      for (const id of CTRLS) {
        const b = L.ctrl[id].hit;
        const ox = Math.min(c.x + c.w, b.x + b.w) - Math.max(c.x, b.x), oy = Math.min(c.y + c.h, b.y + b.h) - Math.max(c.y, b.y);
        expect(ox > 1 && oy > 1, `${name} card × ${id}`).toBe(false);
      }
      expect(c.h, `${name} card height`).toBeGreaterThanOrEqual(brain ? 130 : 180);
      expect(L.stage.w > 80 && L.stage.h > 120, `${name} stage`).toBe(true);
      // text never under the floor; reading text ≥ 13
      for (const [k, v] of Object.entries(L.font)) expect(v, `${name} ${k}`).toBeGreaterThanOrEqual(k === 'latin' || k === 'small' ? 12 : 13);
      expect(Math.min(...Object.values(L.font))).toBeGreaterThanOrEqual(MIN_TEXT);
    }
  });

  it('puts the buttons in the thumb zone of an upright phone, and hit-tests them', () => {
    for (const s of sizes.filter(x => x.h > x.w && x.w < 600)) {
      const L = layout(s.w, s.h, s.insets, true);
      for (const id of CTRLS) {
        const b = L.ctrl[id];
        expect(b.y, `${s.name} ${id}`).toBeGreaterThan(s.h * (1 - THUMB));
        expect(Math.min(b.hit.w, b.hit.h)).toBeGreaterThanOrEqual(MIN_TAP);
        expect(hitTest(L, { story: null, picker: false }, b.x, b.y)).toEqual({ kind: 'ctrl', id });
      }
      const P = pickerRect(L);
      expect(hitTest(L, { story: null, picker: true }, P.rows[2].x + 10, P.rows[2].y + 10)).toEqual({ kind: 'pick', i: 2 });
      expect(hitTest(L, { story: null, picker: true }, P.close.x + 5, P.close.y + 5)).toEqual({ kind: 'close' });
    }
  });

  it('zooms toward the element in the light within limits, never smaller than the whole figure', () => {
    const s = sizes[0];
    const L = layout(s.w, s.h, s.insets, true);
    const whole = figCam(L);
    for (const e of [...LISTS.narzady, ...LISTS.konczyny, ...LISTS.miesnie] as Element[]) {
      const c = elementCam(L, geoBox(e.geo), 3.2);
      expect(c.s, e.id).toBeGreaterThanOrEqual(whole.s - 1e-9);
      expect(c.s, e.id).toBeLessThanOrEqual(whole.s * 3.2 + 1e-9);
    }
  });

  it('lays a desk out in three columns with the keys’ names, and a narrow window keeps the phone’s shapes', () => {
    const d = layout(1280, 800, { top: 192, right: 0, bottom: 0, left: 0 }, false);
    expect(d.shape).toBe('desk');
    expect(d.keys).toBe(true);
    expect(d.card.x + d.card.w).toBeLessThan(d.stage.x);
    expect(d.ctrl.menu.x).toBeGreaterThan(d.stage.x + d.stage.w);
    expect(layout(360, 500, { top: 134, right: 0, bottom: 0, left: 0 }, true).shape).toBe('tall');
    expect(layout(844, 390, { top: 68, right: 47, bottom: 21, left: 47 }, true).shape).toBe('side');
  });
});

describe('the song (kit/song.ts)', () => {
  it('is a well-formed lullaby around the series’ refrain', () => {
    const s = buildSong();
    expect(songProblems(s)).toEqual([]);
    expect(s.bpm).toBeLessThanOrEqual(72);
    expect(s.parts.some(p => p.voice === 'snare' || p.voice === 'hat')).toBe(false);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) for (const k of ['song.a.1', 'song.a.2', 'song.a.3', 'song.a.4', 'song.b.1', 'song.b.2', 'song.b.3', 'song.b.4']) {
      expect((CATALOGS[l] as Record<string, string>)[k].length, `${l}.${k}`).toBeLessThanOrEqual(44);
    }
  });
});

describe('long sessions (15–30 minutes)', () => {
  it('walks a meditation round and round in 30 minutes: whole after whole, each with its card, no throw, the finale at the end', () => {
    for (const variant of ['rownowaga', 'narzady'] as const) {
      const sim = later({ planned: 1800, progress: { variant } });
      const clock = { t: 0 };
      const go = ideal(sim);
      let finale = false, wholes = 0, maxStory = 0, storyT = 0;
      for (let i = 0; i < 1805 / STEP; i++) {
        clock.t += STEP;
        sim.update(STEP, go(), clock.t);
        for (const e of sim.take()) {
          if (e.type === 'finale') finale = true;
          if (e.type === 'whole') wholes++;
        }
        storyT = sim.story ? storyT + STEP : 0;
        maxStory = Math.max(maxStory, storyT);
      }
      expect(finale).toBe(true);
      expect(sim.phase).toBe('done');
      for (const v of [sim.lux, sim.fill, sim.light, sim.fillSec, sim.calmSec]) expect(Number.isFinite(v), variant).toBe(true);
      // an element in ~12 s of strong focus and a rest of 20 s: the nine loops go round five times or more, the 19 organs twice
      expect(wholes, variant).toBeGreaterThanOrEqual(variant === 'rownowaga' ? 4 : 2);
      expect(sim.round).toBe(wholes);
      expect(sim.wholeNow).toHaveLength(wholes);
      expect(sim.litNow.length).toBeLessThanOrEqual(count(variant));
      // a closing card never holds the session: it closes by itself
      expect(maxStory).toBeLessThanOrEqual(RULES.closeSec + 1);
      const r = sim.result();
      expect(r.score).toBe(sim.score);
      for (const [k, v] of r.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
      for (const h of r.highlights) expect(h).not.toMatch(/undefined|NaN/);
      expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    }
  });

  it('keeps every push and rest in its bounds for half an hour, even when focus never comes (the valve)', () => {
    const sim = later({ planned: 1800 });
    const clock = { t: 0 };
    const starts: { kind: string; t: number }[] = [];
    for (let i = 0; i < 1805 / STEP; i++) {
      clock.t += STEP;
      sim.update(STEP, LOW, clock.t);
      for (const e of sim.take()) if (e.type === 'blockStart') starts.push({ kind: e.block.kind, t: clock.t });
    }
    expect(sim.phase).toBe('done');
    expect(sim.fill).toBe(0);
    starts.forEach((s, i) => { if (i) expect(s.kind).not.toBe(starts[i - 1].kind); });
    for (let i = 1; i < starts.length; i++) expect(starts[i].t - starts[i - 1].t).toBeLessThanOrEqual(RULES.maxPush + 0.5);
    // the last block ends within its own length of the finale: no dead tail
    expect(1800 - RULES.finale.long - starts.at(-1)!.t).toBeLessThanOrEqual(RULES.maxPush + 0.5);
    expect(starts.length).toBeGreaterThan(2 * Math.floor(1800 / (RULES.maxPush + RULES.restTarget + 4)) - 2);
  });
});
