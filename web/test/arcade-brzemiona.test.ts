import { describe, expect, it } from 'vitest';
import {
  CIRCLES, CIRCLE_VERSES, CLOSE_VERSES, DEFAULT_LIST, FINALE_VERSE, KINDS, LEAVE_VERSE, LINE_COUNT, LIST_MAX, MOMENTS, NAME_MAX, REST_VERSES, ROOT,
  allCirclesOf, circlesOf, cleanItem, cleanList, cleanName, itemKey, type Item,
} from '../src/arcade/brzemiona/content';
import { CATALOGS, addressOf, circleLabel, linesOf, prayerOf, t, unit, whoName } from '../src/arcade/brzemiona/i18n';
import {
  addItem, addPerson, bestOf, breathOf, freshProgress, migrate, moveItem, queueOf, removeItem, restOf, setKind, setStart, startOf, stepBreathOf,
  type BrzProgress,
} from '../src/arcade/brzemiona/meta';
import { RULES, WindowMean, depthFor, needFor, readTime, restTargetFor, turnRate } from '../src/arcade/brzemiona/rules';
import { BrzSim, pageTime, secText, warmFor, type SimEvent } from '../src/arcade/brzemiona/sim';
import { BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems, type Lang } from '../src/i18n';
import { CATALOGS as ARCADE_CATALOGS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS } from '../src/i18n/arcade-mouse';
import { arcadeEntry } from '../src/arcade/registry';
import { CHECK_SIZES, auditTargets } from '../src/arcade/kit/mobile';
import { chooserLayout, hitAt, laneAt, lanes, layout, manyCount, stageOf, tapTargets } from '../src/arcade/brzemiona/layout';
import { howto } from '../src/arcade/brzemiona/index';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.cross', 'c.breath', 'c.controls', 'c.tap', 'c.rest'];

type SimOpts = { progress?: Partial<BrzProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): BrzSim {
  const sim = new BrzSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 3, seen: [...ALL_SEEN], ...o.progress } });

const reader = (sim: BrzSim) => () => { if (sim.story && sim.story.t > 1) sim.stay(); };

function drive(sim: BrzSim, sec: number, f: FocusFrame | ((t: number, sim: BrzSim) => FocusFrame), clock = { t: sim.t }, each?: (t: number) => void): SimEvent[] {
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

/** Focus in the push blocks (held from the lead-in on), calm in the rest blocks: a player at a steady level. */
const steady = (level: number) => (_t: number, s: BrzSim): FocusFrame => (s.pushBlock
  ? frame({ level, activity: 3, focused: level >= 0.5, hold: Math.max(0, s.blockT - s.leadIn), calm: 0.2 })
  : frame({ level: 0.3, activity: 0, focused: false, calm: 0.6 }));

/** Run until a condition holds (a tenth of a second at a time). */
function until(sim: BrzSim, cond: () => boolean, f: FocusFrame | ((t: number, s: BrzSim) => FocusFrame), clock = { t: sim.t }, max = 3000): SimEvent[] {
  const evs: SimEvent[] = [];
  for (let i = 0; i < max && !cond(); i++) evs.push(...drive(sim, 0.1, f, clock, reader(sim)));
  return evs;
}

const anna: Item = { who: 'person', name: 'Anna', kind: 'illness' };
const piotr: Item = { who: 'person', name: 'Piotr', kind: null };

describe('whom the player prays for (content.ts)', () => {
  it('knows six kinds of burden (kinds, never diagnoses) and three circles: the one, all who carry it, the whole world', () => {
    expect([...KINDS]).toEqual(['illness', 'sadness', 'loneliness', 'fear', 'grief', 'conflict']);
    expect([...CIRCLES]).toEqual(['one', 'many', 'world']);
    expect(DEFAULT_LIST.map(itemKey)).toEqual(['k:illness', 'k:sadness', 'k:loneliness', 'k:fear', 'k:grief', 'k:conflict', 'world']);
  });

  it('widens each burden as far as the session allows; the whole world as an entry is one circle', () => {
    expect(circlesOf(anna, 1)).toEqual(['one']);
    expect(circlesOf(anna, 2)).toEqual(['one', 'world']);
    expect(circlesOf(anna, 3)).toEqual(['one', 'many', 'world']);
    expect(circlesOf({ who: 'world', name: '', kind: null }, 3)).toEqual(['world']);
    expect(allCirclesOf(anna)).toEqual(['one', 'many', 'world']);
    expect(depthFor(180)).toBe(1);
    expect(depthFor(300)).toBe(2);
    expect(depthFor(600)).toBe(3);
    expect(depthFor(1800)).toBe(3);
  });

  it('keeps names plain text, short, and the list clean: valid entries, no duplicates, at most 12', () => {
    expect(cleanName('  Anna <b>\u0007Kowalska</b>  ')).toBe('Anna b Kowalska /b');
    expect([...cleanName('x'.repeat(90))].length).toBe(NAME_MAX);
    expect(cleanName(42)).toBe('');
    expect(cleanItem({ who: 'person', name: '   ' })).toBeNull();
    expect(cleanItem({ who: 'kind', kind: 'nope' })).toBeNull();
    expect(cleanItem({ who: 'me', kind: 'fear' })).toEqual({ who: 'me', name: '', kind: 'fear' });
    const many = Array.from({ length: 20 }, (_, i) => ({ who: 'person', name: `N${i}` }));
    expect(cleanList([...many, { who: 'person', name: 'N1' }]).length).toBe(LIST_MAX);
    expect(cleanList([anna, anna, { who: 'world' }, 'garbage', null]).map(itemKey)).toEqual(['p:Anna', 'world']);
  });

  it('names only passages that exist, the root first in the lobby', () => {
    expect(ROOT).toBe('gal6.2');
    expect(arcadeEntry('brzemiona')?.root).toBe(ROOT);
    const ids = [...Object.values(CIRCLE_VERSES).flat(), ...REST_VERSES, LEAVE_VERSE, FINALE_VERSE, ...CLOSE_VERSES];
    for (const id of ids) expect(passage(id).text.length, id).toBeGreaterThan(10);
    expect(LEAVE_VERSE).toBe('1pe5.7');
    expect(FINALE_VERSE).toBe('mat11.29-30');
    expect([...CLOSE_VERSES].sort()).toEqual(['2co1.3-4', 'mat11.28']);
  });
});

describe('the exchange: light only from real focus (rules.ts, sim.ts)', () => {
  it('turns only while focused: faster above the threshold and as the focus is held', () => {
    const need = needFor(600);
    expect(need).toBe(RULES.needSec);
    expect(turnRate(0.9, false, 10, need)).toBe(0);
    const at = turnRate(0.5, true, 0, need), high = turnRate(0.9, true, 0, need), held = turnRate(0.5, true, 12, need);
    expect(at).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(at);
    expect(held).toBeGreaterThan(at);
    // a short test session needs less, never under its floor
    expect(needFor(30)).toBeCloseTo(RULES.needSec * RULES.needMinShare, 5);
    expect(needFor(120)).toBeLessThan(needFor(180));
  });

  it('reads the level averaged over one whole breath, so a 0.1 Hz wave (a 5 · 5 breath, the Mayer wave) averages out', () => {
    const m = new WindowMean(10);
    for (let t = 0; t < 40; t += 0.02) m.push(0.6 + 0.3 * Math.sin(2 * Math.PI * 0.1 * t), 0.02);
    expect(m.value!).toBeGreaterThan(0.58);
    expect(m.value!).toBeLessThan(0.62);
    expect(m.span).toBeCloseTo(10, 5);
    const sim = later();
    expect(sim.meanLevel).toBeNull();
  });

  it('turns nothing in the warm-up, the lead-in, rest, the finale, without a signal, unfocused, or from taps', () => {
    const fresh = makeSim({ tuning: BEGINNER });
    expect(fresh.block.kind).toBe('warmup');
    drive(fresh, 4, HIGH);
    expect(fresh.x).toBe(0);
    const sim = later({ planned: 600 });
    drive(sim, sim.leadIn - 0.3, HIGH);
    expect(sim.x).toBe(0);
    drive(sim, 20, NONE);
    expect(sim.x).toBe(0);
    drive(sim, 20, LOW, undefined, () => sim.stay());
    expect(sim.x).toBe(0);
    expect(sim.tapsNow).toBeGreaterThan(100);
    // to a rest: nothing turns there
    until(sim, () => sim.restBlock, HIGH);
    const x0 = sim.x, circles = sim.circlesNow;
    drive(sim, 5, HIGH);
    expect(sim.x).toBe(x0);
    expect(sim.circlesNow).toBe(circles);
    // the finale
    const end = later({ planned: 120 });
    until(end, () => end.phase === 'finale', LOW);
    const xf = end.x;
    drive(end, 3, HIGH);
    expect(end.x).toBe(xf);
  });

  it('never loses what was turned: x only grows through dips, lost signals and rests (within a circle)', () => {
    const sim = later({ planned: 600, seed: 3 });
    const rnd = mulberry32(9);
    let last = sim.x, circle = sim.circle, key = sim.curKey, stage = sim.stage;
    drive(sim, 240, () => (rnd() < 0.15 ? NONE : rnd() < 0.5 ? LOW : HIGH), undefined, () => {
      if (sim.circle === circle && sim.curKey === key && stage !== 'peace' && stage !== 'leave' && sim.stage !== 'peace' && sim.stage !== 'leave') {
        expect(sim.x).toBeGreaterThanOrEqual(last - 1e-12);
      }
      last = sim.x;
      circle = sim.circle;
      key = sim.curKey;
      stage = sim.stage;
    });
    expect(sim.circlesNow).toBeGreaterThan(0);
  });

  it('lets the smoke wait at the Cross without focus: one puff at most, never back, never more', () => {
    const sim = later({ planned: 600 });
    let max = 0, prev = 0;
    drive(sim, 40, LOW, undefined, () => {
      expect(sim.waiting).toBeGreaterThanOrEqual(prev - 1e-12);   // it never drifts back
      prev = sim.waiting;
      max = Math.max(max, sim.waiting);
    });
    expect(sim.x).toBe(0);
    expect(max).toBeGreaterThan(RULES.puff * 0.9);
    expect(max).toBeLessThanOrEqual(RULES.puff + 1e-9);
    // with focus it turns gold at the Cross, and the waiting smoke is taken from
    const w0 = sim.waiting;
    drive(sim, 3, HIGH);
    expect(sim.x).toBeGreaterThan(0);
    expect(sim.gold + sim.x).toBeGreaterThan(0);
    expect(sim.waiting).toBeLessThanOrEqual(w0 + 1e-9);
  });

  it('the light-only variant lifts no smoke at all', () => {
    const sim = later({ planned: 600, progress: { lightOnly: true } });
    expect(sim.lightOnly).toBe(true);
    drive(sim, 40, (_t, s) => (s.blockT > 20 ? HIGH : LOW));
    expect(sim.waiting).toBe(0);
    expect(sim.x).toBeGreaterThan(0);
  });

  it('shows the band’s averaged level on the gauge in the exchange, calm in rest, nothing in the lead-in or without a signal', () => {
    const sim = later({ planned: 600 });
    drive(sim, 1, HIGH);
    expect(sim.meter()).toBeNull();
    drive(sim, 8, HIGH);
    expect(sim.meter()!).toBeGreaterThan(0.5);
    drive(sim, 1, NONE);
    expect(sim.meter()).toBeNull();
    until(sim, () => sim.restBlock, HIGH);
    drive(sim, 3, CALM);
    expect(sim.meter()!).toBeGreaterThan(0.5);
  });
});

describe('the steps of a burden: call, circles, rests of whole breaths', () => {
  it('opens a first-ever session with a warm-up under the two-page card, then the exchange', () => {
    const sim = makeSim({ tuning: BEGINNER, planned: 600 });
    expect(sim.story?.pages).toBe(2);
    expect(sim.block.kind).toBe('warmup');
    expect(sim.stage).toBe('call');
    const evs = until(sim, () => sim.pushBlock, LOW, undefined, 1000);
    expect(ofType(evs, 'story').length).toBeGreaterThanOrEqual(1);
    expect(sim.story).toBeNull();
    expect(sim.stage).toBe('pray');
    for (const k of [0, 1]) expect(pageTime('open', k)).toBeGreaterThanOrEqual(RULES.pageSec);
    expect(warmFor(600)).toBe(RULES.warm.long);
    expect(warmFor(180)).toBe(RULES.warm.short);
  });

  it('rests after every circle in whole breaths of the saved pattern, longer after the burden’s last circle', () => {
    const sim = later({ planned: 600, progress: { list: [anna, piotr] } });
    expect(sim.depth).toBe(3);
    const evs = until(sim, () => sim.carriedNow >= 1 && sim.pushBlock, steady(0.7));
    const circles = ofType(evs, 'circle');
    expect(circles.map(c => c.circle)).toEqual(['one', 'many', 'world']);
    expect(circles.map(c => c.carried)).toEqual([false, false, true]);
    const rests = sim.blocks.filter(b => b.kind === 'rest');
    const cyc = breathCycle(BREATH_PRESETS.even);
    for (const r of rests) expect(r.dur % cyc).toBeCloseTo(0, 6);
    expect(rests.at(-1)!.leave).toBe(true);
    expect(rests.at(-1)!.cycles).toBe(rests[0].cycles + RULES.leaveExtra);
    // the next burden follows: Piotr, called
    expect(sim.item.name).toBe('Piotr');
    expect(sim.circle).toBe('one');
    expect(ofType(evs, 'carried')[0].item.name).toBe('Anna');
  });

  it('widens to more figures, then the whole world, each a push gated by focus', () => {
    const sim = later({ planned: 900, progress: { list: [anna] } });
    const evs = until(sim, () => sim.carriedNow >= 1, steady(0.6));
    expect(ofType(evs, 'widen').map(e => e.circle)).toEqual(['many', 'world']);
    expect(sim.widestNow).toBe(2);
  });

  it('opens the safety valve for a push that cannot finish: a rest; the circle keeps its light', () => {
    const sim = later({ planned: 900 });
    drive(sim, 12, HIGH);
    const x = sim.x;
    expect(x).toBeGreaterThan(0);
    const evs = until(sim, () => sim.restBlock, LOW, undefined, 900);
    expect(ofType(evs, 'valve').length).toBe(1);
    expect(sim.block.why).toBe('valve');
    expect(sim.x).toBe(x);
    expect(sim.now).toBe('valve');
    until(sim, () => sim.pushBlock, CALM);
    expect(sim.stage).toBe('pray');
    expect(sim.x).toBe(x);
  });

  it('says what to do now in one line that changes only with the action', () => {
    const sim = later({ planned: 600 });
    expect(sim.now).toBe('call');
    drive(sim, 6, HIGH);
    expect(sim.now).toBe('focus');
    until(sim, () => sim.restBlock, HIGH);
    expect(['rest', 'leave']).toContain(sim.now);
  });

  it('gives each push a strategy of imagery or slow words, never "concentrate harder", and the breath in rest', () => {
    const sim = later({ planned: 900 });
    const tips = new Set<string>();
    drive(sim, 400, steady(0.6), undefined, () => tips.add(sim.tip));
    expect(tips.size).toBeGreaterThanOrEqual(3);
    for (const tip of tips) expect(tip).not.toMatch(/mocniej|bardziej się skup/i);
    expect([...tips].some(x => /wdech 5 s, wydech 5 s/.test(x))).toBe(true);
  });
});

describe('the hands: ≡ whom, ◎ widen, ▶ next, a tap stays', () => {
  it('chooses whom now in a push (the one left keeps its light for this session), and for the next push in a rest', () => {
    const sim = later({ planned: 900, progress: { list: [anna, piotr, { who: 'world', name: '', kind: null }] } });
    drive(sim, 15, HIGH);
    const xa = sim.x;
    expect(xa).toBeGreaterThan(0);
    expect(sim.openChooser()).toBe(true);
    expect(sim.chooser).not.toBeNull();
    expect(sim.choose(1)).toBe(true);
    expect(sim.chooser).toBeNull();
    expect(sim.item.name).toBe('Piotr');
    expect(sim.stage).toBe('call');
    expect(sim.x).toBe(0);
    sim.choose(0);
    expect(sim.item.name).toBe('Anna');
    expect(sim.x).toBeCloseTo(xa, 9);
    // in a rest: queued for the next push
    until(sim, () => sim.restBlock, HIGH);
    sim.choose(2);
    expect(sim.queuedItem?.who).toBe('world');
    expect(sim.item.name).toBe('Anna');
    until(sim, () => sim.pushBlock, CALM);
    expect(sim.item.who).toBe('world');
    expect(sim.circle).toBe('world');
  });

  it('widens by hand keeping the light turned, and moves on with ▶; keys M, W, N, 1–9, Space, Escape', () => {
    const sim = later({ planned: 900, progress: { list: [anna, piotr] } });
    drive(sim, 12, HIGH);
    const x = sim.x;
    expect(sim.widen()).toBe(true);
    expect(sim.circle).toBe('many');
    expect(sim.stage).toBe('widen');
    expect(sim.x).toBe(x);
    expect(sim.key('n', true)).toBe(true);
    expect(sim.item.name).toBe('Piotr');
    expect(sim.key('m', true)).toBe(true);
    expect(sim.chooser).not.toBeNull();
    expect(sim.key('Escape', true)).toBe(true);
    expect(sim.chooser).toBeNull();
    sim.key('M', true);
    expect(sim.key('1', true)).toBe(true);
    expect(sim.item.name).toBe('Anna');
    expect(sim.circle).toBe('many');
    expect(sim.key('w', true)).toBe(true);
    expect(sim.circle).toBe('world');
    expect(sim.widen()).toBe(false);
    const taps = sim.tapsNow;
    expect(sim.key(' ', true)).toBe(true);
    expect(sim.tapsNow).toBe(taps + 1);
    expect(sim.reshow).toBeGreaterThan(0);
    expect(sim.key('x', true)).toBe(false);
  });

  it('after a circle turned whole, another chosen in the rest; the first, chosen again, goes on with its next circle', () => {
    const sim = later({ planned: 900, progress: { list: [anna, piotr] } });
    until(sim, () => sim.restBlock && sim.stage === 'peace', HIGH);
    expect(sim.circle).toBe('one');
    sim.choose(1);
    until(sim, () => sim.pushBlock, CALM);
    expect(sim.item.name).toBe('Piotr');
    sim.choose(0);
    expect(sim.item.name).toBe('Anna');
    expect(sim.circle).toBe('many');
    expect(sim.x).toBe(0);
    expect(sim.circlesNow).toBe(1);
  });

  it('closes the chooser after a while untouched, and pages it when the list is long', () => {
    const list = Array.from({ length: 10 }, (_, i): Item => ({ who: 'person', name: `Osoba ${i + 1}`, kind: null }));
    const sim = later({ planned: 600, progress: { list } });
    expect(sim.pages).toBe(2);
    sim.openChooser();
    sim.turnPage(1);
    expect(sim.chooser!.page).toBe(1);
    sim.key('2', true);
    expect(sim.item.name).toBe('Osoba 8');
    sim.openChooser();
    drive(sim, RULES.chooserIdle + 1, LOW);
    expect(sim.chooser).toBeNull();
  });
});

describe('the pace: the arc fits 3, 10 and 30 minutes (an average player)', () => {
  /** an average player: the activity rises ~2 % in a push (with the lag), noise and the Mayer wave, the kit's own focus input */
  const player = (planned: number, amp: number, seed: number) => {
    const sim = later({ planned, seed });
    const fi = new FocusInput(TUNING);
    const rnd = mulberry32(seed * 7 + 1);
    let act = 0, noise = 0;
    const carried: number[] = [];
    drive(sim, planned + 5, (tt, s) => {
      act += ((s.pushBlock ? amp : 0) - act) * (1 - Math.exp(-STEP / 4));
      noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
      return fi.push(act + noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
    }, { t: 0 }, () => {
      for (const e of sim.take()) if (e.type === 'carried') carried.push(sim.t);
      reader(sim)();
    });
    return { sim, carried };
  };

  it('3 minutes ≈ 2–3 burdens, 10 minutes ≈ 3, 30 minutes ≈ 8–10, the last carried near the end (not at 40 %)', () => {
    const want: Record<number, [number, number]> = { 180: [2, 3], 600: [3, 4], 1800: [8, 10] };
    for (const planned of [180, 600, 1800]) {
      for (const seed of [1, 2]) {
        const { sim, carried } = player(planned, 2, seed);
        expect(sim.phase).toBe('done');
        const [lo, hi] = want[planned];
        expect(sim.carriedNow, `${planned} s, seed ${seed}`).toBeGreaterThanOrEqual(lo);
        expect(sim.carriedNow, `${planned} s, seed ${seed}`).toBeLessThanOrEqual(hi);
        expect(carried.at(-1)!).toBeGreaterThan(planned * 0.7);
        expect(carried[0]).toBeLessThan(planned * 0.6);
        // nothing piles up at the start: the burdens are spread over the session
        expect(carried.filter(t => t < planned * 0.4).length).toBeLessThanOrEqual(Math.ceil(sim.carriedNow * 0.6));
      }
    }
  });

  it('a steady player at the threshold takes about the need of focus a circle; a stronger focus carries more', () => {
    const pace = (level: number) => {
      const sim = later({ planned: 600, seed: 2 });
      let load = 0;
      drive(sim, 600, steady(level), { t: 0 }, () => { if (sim.loading) load += STEP; });
      return { sim, per: load / Math.max(1, sim.circlesNow) };
    };
    const at = pace(0.5), high = pace(0.8);
    expect(at.per).toBeGreaterThan(RULES.needSec * 0.9);
    expect(at.per).toBeLessThan(RULES.needSec * 1.35);
    expect(high.sim.circlesNow).toBeGreaterThan(at.sim.circlesNow);
  });

  it('with no rise in the pushes nothing turns; the valve rests every stuck push; 30 minutes never stick', () => {
    for (const seed of [1, 2]) {
      const sim = later({ planned: 600, seed });
      const fi = new FocusInput(TUNING);
      const rnd = mulberry32(seed);
      let noise = 0;
      drive(sim, 605, tt => {
        noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
        return fi.push(noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
      }, { t: 0 }, reader(sim));
      expect(sim.carriedNow).toBe(0);
      expect(sim.valvesNow).toBeGreaterThanOrEqual(4);
    }
    const long = later({ planned: 1800, seed: 3 });
    drive(long, 1805, (_t, s) => (s.pushBlock ? LOW : CALM), { t: 0 });
    expect(long.phase).toBe('done');
    expect(long.carriedNow).toBe(0);
    for (const b of long.blocks.filter(x => x.kind === 'push')) expect(b.len).toBeLessThanOrEqual(RULES.valveSec + 0.5);
    long.blocks.forEach((b, i) => { if (i) expect(b.kind).not.toBe(long.blocks[i - 1].kind); });
  });

  it('deepens long sessions: more circles a burden and more breaths a rest, not just more time', () => {
    expect(restTargetFor(180)).toBeLessThan(14);
    expect(restTargetFor(600)).toBeGreaterThan(18);
    expect(restTargetFor(1800)).toBeCloseTo(30, 5);
    const p = freshProgress();
    expect(restOf(p, 180).cycles).toBe(1);
    expect(restOf(p, 1800).cycles).toBe(3);
    expect(restOf(p, 600, 1).cycles).toBe(restOf(p, 600).cycles + 1);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on) within 22 s', () => {
    for (const fresh of [true, false]) {
      const sim = fresh ? makeSim({ tuning: BEGINNER, planned: 40 }) : later({ planned: 40 });
      let next = 0.65, space = 2;
      const seen: number[] = [];
      drive(sim, 22, HIGH, { t: 0 }, tt => {
        if (tt >= next) { next += 0.65; sim.stay(); }
        if (tt >= space) { space += 2; sim.key(' ', true); sim.key(' ', false); }
        if (Math.abs(tt - Math.round(tt)) < STEP / 2) seen.push(sim.score);
      });
      expect(sim.result().score, fresh ? 'first-ever' : 'later').toBeGreaterThan(0);
      expect(seen.at(-1)!).toBeGreaterThan(seen[3]);
    }
  });

  it('gives result() idempotently and keeps the best with Math.max', () => {
    const sim = later({ planned: 120 });
    drive(sim, 125, steady(0.8));
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(sim.p.best['120']).toBe(a.score);
    for (const [k, v] of a.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
    expect(a.highlights.length).toBeGreaterThan(0);
    expect(a.highlights.length).toBeLessThanOrEqual(5);
    for (const h of a.highlights) expect(h.length).toBeLessThan(140);
    expect(passage(a.verse!).text.length).toBeGreaterThan(10);
  });

  it('settles once (at the end or early) and the next session goes on with the burden in progress', () => {
    const p: BrzProgress = { ...freshProgress(), sessions: 4, seen: [...ALL_SEEN], list: [anna, piotr] };
    const sim = new BrzSim({ progress: p, rng: mulberry32(1), plannedSec: 900, eeg: false, tuning: TUNING });
    sim.start();
    drive(sim, 14, HIGH);
    const x = sim.x;
    expect(x).toBeGreaterThan(0);
    sim.finish();
    sim.finish();
    expect(p.sessions).toBe(5);
    expect(p.pos).toEqual({ key: 'p:Anna', circle: 0, x: Math.min(0.99, x) });
    const next = new BrzSim({ progress: p, rng: mulberry32(2), plannedSec: 900, eeg: false, tuning: TUNING });
    next.start();
    expect(next.resumed).toBe(true);
    expect(next.item.name).toBe('Anna');
    expect(next.x).toBeCloseTo(Math.min(0.99, x), 9);
    // a burden carried: the next session begins with the next entry
    const q: BrzProgress = { ...freshProgress(), sessions: 4, seen: [...ALL_SEEN], list: [anna, piotr] };
    const s2 = new BrzSim({ progress: q, rng: mulberry32(1), plannedSec: 180, eeg: false, tuning: TUNING });
    s2.start();
    until(s2, () => s2.carriedNow >= 1, HIGH);
    s2.finish();
    expect(q.pos).toBeNull();
    expect(q.next).toBe(1);
    expect(q.carried).toBe(1);
    expect(q.tally.illness + q.tally.person).toBeGreaterThanOrEqual(1);
  });

  it('closes with Mt 11:28 the first time, then 2 Cor 1:3-4 and Mt 11:28 in turn', () => {
    expect(makeSim({ planned: 60 }).closingVerse()).toBe('mat11.28');
    const v = [6, 7].map(n => later({ progress: { sessions: n - 1 } }).closingVerse());
    expect(new Set(v)).toEqual(new Set(['2co1.3-4', 'mat11.28']));
  });

  it('teaches with coach marks once each, never under the story card', () => {
    const p = freshProgress();
    const sim = new BrzSim({ progress: p, rng: mulberry32(1), plannedSec: 600, eeg: false, tuning: BEGINNER });
    sim.start();
    const evs = drive(sim, 120, steady(0.7), { t: 0 }, reader(sim));
    const marks = ofType(evs, 'coach').map(e => e.what);
    expect(marks).toContain('tap');
    expect(marks).toContain('cross');
    expect(marks).toContain('breath');
    expect(new Set(marks).size).toBe(marks.length);
    for (const m of marks) expect(sim.coachWords(m, true).length).toBeGreaterThan(10);
  });

  it('walks 15 and 30 minutes without a gap: blocks alternate, rests are whole breaths, the finale at the end', () => {
    for (const planned of [900, 1800]) {
      const sim = later({ planned, seed: 2 });
      let finale = -1;
      drive(sim, planned + 5, steady(0.55), { t: 0 }, () => { for (const e of sim.take()) if (e.type === 'finale') finale = sim.t; });
      expect(sim.phase).toBe('done');
      expect(finale).toBeGreaterThan(planned - RULES.finale.long - 0.5);
      sim.blocks.forEach((b, i) => { if (i) expect(b.kind).not.toBe(sim.blocks[i - 1].kind); });
      for (const v of [sim.x, sim.shown, sim.glow, sim.gold, sim.waiting]) expect(Number.isFinite(v)).toBe(true);
      expect(sim.carriedNow).toBeGreaterThanOrEqual(planned === 900 ? 4 : 8);
      const r = sim.result();
      expect(r.highlights.join(' ')).not.toMatch(/undefined|NaN/);
    }
  });
});

describe('the meta', () => {
  it('reads the placeholder’s save and garbage, and keeps a good save', () => {
    const ph = mergeSaved(freshProgress(), { best: null }) as BrzProgress;
    (ph as unknown as Record<string, unknown>).ver = undefined;
    migrate(ph);
    expect(ph.ver).toBe(1);
    expect(ph.list).toEqual([]);
    const bad = { ver: 1, sessions: 'x', list: [anna, { who: 'evil' }], next: -3, pos: { key: 5 }, breath: { in: 99, holdIn: -1, out: 'a' }, tally: 7, best: { '600': 3, x: 1 } };
    const m = migrate(bad as unknown as BrzProgress);
    expect(m.sessions).toBe(0);
    expect(m.list.map(itemKey)).toEqual(['p:Anna']);
    expect(m.next).toBe(0);
    expect(m.pos).toBeNull();
    expect(breathOf(m).in).toBe(15);
    expect(m.best).toEqual({ '600': 3 });
    expect(m.tally.world).toBe(0);
    expect(migrate(migrate(freshProgress()))).toEqual(freshProgress());
  });

  it('edits the list: add (no duplicates, 12 at most), remove, move, what a person carries; the default list when empty', () => {
    const p = freshProgress();
    expect(queueOf(p).length).toBe(DEFAULT_LIST.length);
    expect(addPerson(p, 'Anna', 'illness')).toBe(true);
    expect(addPerson(p, 'Anna')).toBe(false);
    expect(addPerson(p, '   ')).toBe(false);
    expect(addItem(p, { who: 'me', name: '', kind: null })).toBe(true);
    expect(addItem(p, { who: 'world', name: '', kind: null })).toBe(true);
    expect(queueOf(p).map(whoName)).toEqual(['Anna', 'Ja', 'Cały świat']);
    expect(moveItem(p, 2, -1)).toBe(true);
    expect(p.list.map(itemKey)).toEqual(['p:Anna', 'world', 'me']);
    expect(setKind(p, 2, 'fear')).toBe(true);
    expect(setKind(p, 1, 'fear')).toBe(false);
    p.pos = { key: 'world', circle: 2, x: 0.3 };
    expect(startOf(p)).toEqual({ index: 1, circle: 2, x: 0.3, resumed: true });
    expect(removeItem(p, 1)).toBe(true);
    expect(p.pos).toBeNull();
    for (let i = 0; i < 20; i++) addPerson(p, `N${i}`);
    expect(p.list.length).toBe(LIST_MAX);
    expect(setStart(p, 3)).toBe(true);
    expect(startOf(p).index).toBe(3);
    expect(setStart(p, 99)).toBe(false);
  });

  it('keeps the breath at 5 · 5 by default and refuses a breath under 2 s', () => {
    const p = freshProgress();
    expect(breathOf(p)).toEqual(BREATH_PRESETS.even);
    p.breath = { in: 1, holdIn: 0, out: 1, holdOut: 0 };
    expect(stepBreathOf(p, 'in', -1)).toBe(false);
    expect(stepBreathOf(p, 'out', 3)).toBe(true);
    expect(bestOf(freshProgress())).toBeNull();
  });
});

describe('the words', () => {
  const texts = (m: unknown): string[] => (typeof m === 'string' ? [m] : Object.values(m as object).filter((v): v is string => typeof v === 'string'));
  const all = (l: Lang) => Object.entries(CATALOGS[l]).flatMap(([k, m]) => texts(m).map(s => [k, s] as [string, string]));

  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator three lines a moment, each fitting a caption (90 characters)', () => {
    for (const m of MOMENTS) {
      const lines = linesOf(m);
      expect(lines.length).toBe(LINE_COUNT);
      for (const l of LANGS) for (let i = 1; i <= LINE_COUNT; i++) {
        const s = (CATALOGS[l] as Record<string, unknown>)[`say.${m}.${i}`] as string;
        expect(s.length, `${l} say.${m}.${i}`).toBeLessThanOrEqual(90);
      }
    }
  });

  it('speaks of light, peace and mercy — no energy, no healing power, no chakras (the origin note aside)', () => {
    const bad: Record<Lang, RegExp> = {
      pl: /energi|uzdrawia|leczy|czakr|kundalini|w[ąę]ż/i,
      en: /energy|heal(s|ing)? power|cures|chakra|kundalini|serpent/i,
      de: /energie|heilt|chakra|kundalini|schlange/i,
      sv: /energi|helar|chakra|kundalini|\borm\b/i,
    };
    const regKeys = ['tagline', 'how1', 'how2', 'how3', 'tip1', 'tip2', 'tip3', 'tip4', 'tip5', 'brainFocus', 'brainRest', 'meter', 'meterRest', 'unit', 'title'];
    for (const l of LANGS) {
      for (const [k, s] of all(l)) expect(s, `${l}.${k}`).not.toMatch(bad[l]);
      for (const k of regKeys) {
        const s = (ARCADE_CATALOGS[l] as Record<string, string>)[`brzemiona.${k}`];
        expect(s, `${l}.brzemiona.${k}`).toBeTruthy();
        expect(s, `${l}.brzemiona.${k}`).not.toMatch(bad[l]);
      }
      const mouse = (MOUSE_CATALOGS[l] as Record<string, string>)['brzemiona.how3'];
      expect(mouse).not.toMatch(bad[l]);
      // the origin note: the registry text names the tradition once and how it is prayed here
      const text = (ARCADE_CATALOGS[l] as Record<string, string>)['brzemiona.text'];
      expect(text).toMatch(/tonglen/i);
    }
  });

  it('never sends, channels or generates: the verbs of prayer', () => {
    for (const [k, s] of all('pl')) expect(s, k).not.toMatch(/wysyła|kanaliz|generuj|aktywuj/i);
    for (const [k, s] of all('en')) expect(s, k).not.toMatch(/\bchannel|\bgenerate|\bactivate|\bsend (energy|light)/i);
  });

  it('keeps Polish letters and words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) for (const [k, s] of all(l)) {
      expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(się|albo|Panie|krzyż)\b/);
    }
    const quoted = (l: Lang) => all(l).map(([, s]) => s).filter(s => /[„“”"]/.test(s));
    for (const s of quoted('pl')) expect(s).toMatch(/„[^„”"“]+”/);
    for (const s of quoted('de')) expect(s).toMatch(/„[^„”"“]+“/);
    for (const s of quoted('sv')) expect(s).toMatch(/”[^„”"“]+”/);
    for (const s of quoted('en')) expect(s).toMatch(/“[^„”"“]+”/);
  });

  it('bends the headline’s unit (1 brzemię, 3 brzemiona, 5 brzemion) and writes seconds with a no-break space', () => {
    expect(unit(1)).toBe('brzemię');
    expect(unit(3)).toBe('brzemiona');
    expect(unit(5)).toBe('brzemion');
    expect(secText(42)).toBe('42 s');
    expect(secText(102)).toBe('1:42');
    expect(t('hl.carried', { n: 4, circle: 'cały świat' })).toBe('4 brzemiona zaniesione do krzyża · krąg: cały świat');
    expect(readTime('x'.repeat(100))).toBeCloseTo(RULES.readSec + RULES.readPerChar * 100, 9);
  });

  it('addresses each one without declining a name, and prays on the breath', () => {
    expect(addressOf(anna, 'one', false)).toBe('Panie Jezu, przynoszę Ci to, co niesie Anna: chorobę.');
    expect(addressOf(piotr, 'one', false)).toBe('Panie Jezu, przynoszę Ci to, co niesie Piotr.');
    expect(addressOf({ who: 'me', name: '', kind: null }, 'one', false)).toBe('Panie Jezu, przynoszę Ci mój własny ciężar.');
    expect(addressOf({ who: 'kind', name: '', kind: 'grief' }, 'one', false)).toBe('Panie Jezu, przynoszę Ci kogoś w żałobie.');
    expect(addressOf(anna, 'many', true)).toBe('Panie Jezu, przynoszę Ci też wszystkich chorych.');
    expect(addressOf(piotr, 'many', true)).toMatch(/podobny ciężar/);
    expect(addressOf(anna, 'world', true)).toMatch(/cały świat/);
    expect(circleLabel(anna, 'many')).toBe('Wszyscy chorzy');
    expect(prayerOf('in', 'one', false)).toBe('Panie Jezu, weź ten ciężar.');
    expect(prayerOf('in', 'one', true)).not.toMatch(/ciężar/);
    for (const k of KINDS) expect(whoName({ who: 'kind', name: '', kind: k }).length).toBeGreaterThan(2);
  });

  it('carries the helpline in the care texts of every language', () => {
    for (const l of LANGS) {
      const c = CATALOGS[l] as Record<string, string>;
      expect(c['panel.careNote']).toMatch(/\d{3}/);
      expect(c['story.care.text']).toMatch(/\d{3}/);
      expect((ARCADE_CATALOGS[l] as Record<string, string>)['brzemiona.tip5']).toMatch(/\d{3}/);
    }
  });
});

describe('mobile first and the desk (layout.ts)', () => {
  it('gives every control a finger-sized target inside the insets at every checked size, clear of each other', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        const live = tapTargets(L, { story: null, chooser: null, live: true });
        expect(auditTargets(live, c.w, c.h, L.ins), `${c.name} ${touch ? 'touch' : 'mouse'}`).toEqual([]);
        for (const pages of [1, 2]) for (const count of [1, 4, 6]) {
          const ch = tapTargets(L, { story: null, chooser: { count, pages }, live: true });
          expect(auditTargets(ch, c.w, c.h, L.ins), `${c.name} chooser ${count}/${pages}`).toEqual([]);
        }
        // the controls sit in the thumb zone on an upright phone, never in the middle of the picture
        if (touch && c.h > c.w) for (const r of Object.values(L.ctl)) expect(r.y + r.h / 2).toBeGreaterThan(c.h * 0.6);
        // the picture, the band and the controls do not overlap; the band at least 112 px tall on a phone
        expect(L.pic.y + L.pic.h).toBeLessThanOrEqual(L.shape === 'tall' ? L.words.y : c.h);
        if (L.shape === 'tall') expect(L.words.y + L.words.h).toBeLessThanOrEqual(L.ctl.list.y);
        expect(L.words.h).toBeGreaterThanOrEqual(L.shape === 'side' ? 90 : 112);
        expect(L.pic.y).toBeGreaterThanOrEqual(L.ins.top);
      }
    }
  });

  it('runs the triptych across on the smallest phone and down on a tall one; both keep the three apart', () => {
    const small = layout(360, 500, CHECK_SIZES[0].insets, true);
    expect(small.orient).toBe('across');
    const tall = layout(390, 844, CHECK_SIZES[2].insets, true);
    expect(tall.orient).toBe('down');
    for (const L of [small, tall, layout(1280, 800, CHECK_SIZES[8].insets, false), layout(1190, 960, CHECK_SIZES[10].insets, false)]) {
      const S = stageOf(L, manyCount(L));
      const P = L.pic;
      for (const f of [S.person, S.player]) {
        expect(f.x).toBeGreaterThan(P.x);
        expect(f.x).toBeLessThan(P.x + P.w);
        expect(f.y - f.H).toBeGreaterThan(P.y - 1);
        expect(f.y).toBeLessThanOrEqual(P.y + P.h + 1);
        expect(f.H).toBeGreaterThan(40);
      }
      if (L.orient === 'across') {
        expect(S.person.x).toBeLessThan(S.cross.x - S.cross.arm);
        expect(S.player.x).toBeGreaterThan(S.cross.x + S.cross.arm);
        for (const m of S.many) expect(m.x).toBeLessThan(S.cross.x - S.cross.arm * 0.6);
      } else {
        expect(S.person.y).toBeLessThan(S.cross.cy - S.cross.h * 0.3);
        expect(S.player.y - S.player.H).toBeGreaterThan(S.cross.y - 2);
      }
    }
  });

  it('never lets a lane of the exchange reach the player: smoke ends at the Cross, light at the one prayed for', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, true);
      const S = stageOf(L, manyCount(L));
      for (const world of [false, true]) {
        const { smoke, light } = lanes(S, L.orient, world);
        expect(Math.hypot(smoke.x1 - S.cross.cx, smoke.y1 - S.cross.cy)).toBeLessThan(S.cross.arm * 0.2 + 1);
        const target = world ? S.globe : { x: S.person.x, y: S.person.y - S.person.H * 0.62 };
        expect(Math.hypot(light.x1 - target.x, light.y1 - target.y)).toBeLessThan(1);
        // every point of both lanes keeps away from the player's figure
        for (let u = 0; u <= 1.0001; u += 0.05) {
          for (const l of [smoke, light]) {
            const [x, y] = laneAt(l, u);
            const dx = Math.abs(x - S.player.x), inFig = y > S.player.y - S.player.H && y < S.player.y;
            expect(inFig && dx < S.player.H * 0.3, `${c.name} lane at ${u.toFixed(2)}`).toBe(false);
          }
        }
      }
    }
  });

  it('sets text at 13 px or more for what is read (the kit’s 11 px floor nowhere crossed), growing on a big screen', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, c.w >= 1024 ? false : true);
      for (const [k, v] of Object.entries(L.font)) expect(v, `${c.name} ${k}`).toBeGreaterThanOrEqual(k === 'key' ? 12 : 13);
      expect(L.font.prayer).toBeGreaterThanOrEqual(15);
    }
    const big = layout(1587, 1300, CHECK_SIZES[11].insets, false);
    expect(big.u).toBeGreaterThan(1.3);
    expect(big.font.prayer).toBeGreaterThan(layout(360, 500, CHECK_SIZES[0].insets, true).font.prayer);
  });

  it('routes a tap: the chooser’s parts, a control, or the picture (stay)', () => {
    const L = layout(360, 500, CHECK_SIZES[0].insets, true);
    const st = { story: null, chooser: null, live: true };
    const r = L.ctl.next;
    expect(hitAt(L, st, r.x + r.w / 2, r.y + r.h / 2)).toBe('next');
    expect(hitAt(L, st, L.pic.x + L.pic.w / 2, L.pic.y + L.pic.h / 2)).toBeNull();
    const C = chooserLayout(L, 6, 2);
    const chs = { story: null, chooser: { count: 6, pages: 2 }, live: true };
    expect(hitAt(L, chs, C.items[3].x + 5, C.items[3].y + 5)).toBe('item:3');
    expect(hitAt(L, chs, C.close.x + 5, C.close.y + 5)).toBe('close');
    expect(hitAt(L, chs, 2, L.top + 2)).toBe('outside');
    expect(C.items.length).toBe(6);
    expect(C.cols).toBe(2);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const touch = howto(true), mouse = howto(false);
    expect(touch.hands.map(h => h.gesture)).toEqual(['tap']);
    expect(mouse.hands.map(h => h.gesture)).toEqual(['tap', 'keys']);
    expect(JSON.stringify(touch)).not.toMatch(/Spacj|klawisz|\bM\b —/);
    expect(touch.tips!.join(' ')).toMatch(/wdech 5 s, wydech 5 s/);
    const sim = later();
    expect(sim.coachWords('controls', true)).not.toMatch(/\(M\)/);
    expect(sim.coachWords('controls', false)).toMatch(/\(M\)/);
  });
});
