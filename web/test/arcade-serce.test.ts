import { describe, expect, it } from 'vitest';
import {
  ALL_VERSES, BLESS_LINES, RINGS, VERSES, cleanName, cleanOwn, heartWord, pushTip, stageRing, verseFor, type Ring,
} from '../src/arcade/serce/content';
import { CATALOGS, breathWords, t, unit } from '../src/arcade/serce/i18n';
import {
  bestOf, clearStart, freshProgress, migrate, namesCount, setBreath, setNames, setSkip4, skip4Today, startRing, type SerceProgress,
} from '../src/arcade/serce/meta';
import { PLACE_AT, buildPlan, planSeconds, type Plan, type PushStep, type RestStep } from '../src/arcade/serce/plan';
import { RULES, focusRate, lampsFor, readTime } from '../src/arcade/serce/rules';
import { SerceSim, linesOf, pageTime, secText, type SimEvent } from '../src/arcade/serce/sim';
import { BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, auditTargets } from '../src/arcade/kit/mobile';
import { EARTH, cameraFor, easeCam, frameBox, layout, storyTarget, toScreen } from '../src/arcade/serce/layout';
import { cityOrder, earth, project } from '../src/arcade/serce/earth';
import { howto } from '../src/arcade/serce/index';
import { progressPanel } from '../src/arcade/serce/panel';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const DAY = '2026-11-22';

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.light', 'c.breath', 'c.tap', 'c.ring4', 'c.names'];

type SimOpts = { progress?: Partial<SerceProgress>; planned?: number; seed?: number; eeg?: boolean; day?: string };

function makeSim(o: SimOpts = {}): SerceSim {
  const sim = new SerceSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false,
    tuning: TUNING, day: o.day ?? DAY,
  });
  sim.start();
  return sim;
}
/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 4, seen: [...ALL_SEEN], ...o.progress } });

type FrameFn = (t: number, sim: SerceSim) => FocusFrame;
function drive(sim: SerceSim, sec: number, f: FocusFrame | FrameFn, clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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
/** Close a story card as a player would. */
const reader = (sim: SerceSim) => () => { if (sim.story && sim.story.t > 1) sim.stay(); };

/**
 * The plan's average player: in a push, focused in stretches — 6 s on, 4 s off — a little over the threshold while on
 * (the adaptive threshold keeps ~60 % of the time above it); calm in rest.
 */
const average: FrameFn = (_t, s) => {
  if (!s.pushBlock) return frame({ level: 0.35, activity: 0.5, focused: false, calm: 0.6 });
  const ph = s.blockT % 10;
  const on = ph < 6;
  return frame({ level: on ? 0.62 : 0.4, activity: on ? 2.6 : 1.2, focused: on, hold: on ? ph : 0, calm: on ? 0.2 : 0.4 });
};
/** A weak session: focused a third of the time, just over the threshold. */
const weak: FrameFn = (_t, s) => {
  if (!s.pushBlock) return frame({ calm: 0.5 });
  const ph = s.blockT % 12;
  const on = ph < 3.5;
  return frame({ level: on ? 0.55 : 0.35, activity: on ? 2.2 : 1, focused: on, hold: on ? ph : 0 });
};
/** A strong player: focused and high in every push. */
const strong: FrameFn = (_t, s) => (s.pushBlock ? frame({ level: 0.92, activity: 6, focused: true, hold: Math.max(0, s.blockT - s.leadIn), calm: 0.05 }) : frame({ calm: 0.85, level: 0.1 }));

/** Run a whole session; returns when the way was whole (seconds of play, or null) and the events. */
function session(sim: SerceSim, f: FrameFn, extra = 6): { wayAt: number | null; evs: SimEvent[] } {
  const clock = { t: 0 };
  let wayAt: number | null = null;
  const evs: SimEvent[] = [];
  const total = sim.plannedSec + extra;
  while (clock.t < total && sim.phase !== 'done') {
    const e = drive(sim, 1, f, clock, reader(sim));
    if (wayAt === null && e.some(x => x.type === 'way')) wayAt = clock.t;
    evs.push(...e);
  }
  return { wayAt, evs };
}

const plan = (T: number, o: Partial<Parameters<typeof buildPlan>[0]> = {}): Plan =>
  buildPlan({ plannedSec: T, eeg: false, firstEver: false, skip4: false, startRing: 1, pattern: BREATH_PRESETS.even, ...o });
const pushes = (p: Plan) => p.steps.filter((s): s is PushStep => s.kind === 'push');
const rests = (p: Plan) => p.steps.filter((s): s is RestStep => s.kind === 'rest');

describe('the way over a session (plan.ts)', () => {
  it('walks head → heart → field → rings 1–5 → sun → the four dimensions → back, and ends with the closing blessing', () => {
    for (const T of [180, 300, 600, 900, 1200, 1800]) {
      const p = plan(T);
      const stages = [...new Set(pushes(p).map(s => s.stage))];
      expect(stages, String(T)).toEqual(['descent', 'heart', 'field', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back']);
      expect(p.steps[0]).toMatchObject({ kind: 'push', stage: 'descent', from: 0 });
      expect(p.steps.at(-1)).toMatchObject({ kind: 'rest', rest: 'amen' });
      // each stage's steps cover it whole, in order, without gaps
      for (const st of stages) {
        const parts = pushes(p).filter(s => s.stage === st);
        expect(parts[0].from).toBe(0);
        expect(parts.at(-1)!.to).toBe(1);
        for (let i = 1; i < parts.length; i++) expect(parts[i].from).toBeCloseTo(parts[i - 1].to, 9);
      }
      // gratitude after the heart, ring 0's blessing after the field; every rest whole breaths, at least one
      const idx = (pred: (s: (typeof p.steps)[number]) => boolean) => p.steps.findIndex(pred);
      expect(idx(s => s.kind === 'rest' && s.rest === 'grat')).toBe(idx(s => s.kind === 'push' && s.stage === 'heart') + 1);
      expect(p.steps[idx(s => s.kind === 'push' && s.stage === 'field') + 1]).toMatchObject({ kind: 'rest', rest: 'bless', rings: [0] });
      for (const r of rests(p)) expect(Number.isInteger(r.cycles) && r.cycles >= 1).toBe(true);
      // never two rests in a row
      for (let i = 1; i < p.steps.length; i++) expect(p.steps[i].kind === 'rest' && p.steps[i - 1].kind === 'rest').toBe(false);
    }
  });

  it('keeps every ring in 3 minutes but short: rings 1–3 share a push and a rest (a breath each), the closing steps ride ring 5', () => {
    const p = plan(180);
    const shared = rests(p).find(r => r.rest === 'bless' && r.rings.length === 3)!;
    expect(shared.rings).toEqual([1, 2, 3]);
    expect(shared.cycles).toBeGreaterThanOrEqual(3);
    expect(rests(p).map(r => r.rest)).toEqual(['grat', 'bless', 'bless', 'bless', 'amen']);
    expect(p.pushBlocks).toBe(5);
    expect(rests(p).find(r => r.rest === 'amen')!.rings).toEqual([5]);
  });

  it('deepens long sessions: stops on the descent from 9 minutes, the arcs from 15, split ring pushes from 18, more lamps and breaths', () => {
    const p10 = plan(600), p15 = plan(900), p30 = plan(1800);
    expect(rests(plan(300)).some(r => r.rest === 'stop')).toBe(false);
    expect(rests(p10).filter(r => r.rest === 'stop').map(r => r.place)).toEqual(['mouth', 'throat']);
    expect(rests(p10).some(r => r.rest === 'sun')).toBe(true);
    expect(pushes(p10).filter(s => s.stage === 'descent').map(s => [s.from, s.to])).toEqual([[0, PLACE_AT.mouth], [PLACE_AT.mouth, PLACE_AT.throat], [PLACE_AT.throat, 1]]);
    expect(p10.arcs).toBe(false);
    expect(p15.arcs).toBe(true);
    expect(pushes(p15).filter(s => s.stage === 'ring2')).toHaveLength(1);
    expect(pushes(p30).filter(s => s.stage === 'ring2')).toHaveLength(2);
    expect(rests(p30).filter(r => r.rest === 'word')).toHaveLength(5);
    for (const r of RINGS) expect(p30.lamps[r]).toBeGreaterThanOrEqual(p10.lamps[r]);
    expect(p10.lamps[3]).toBeGreaterThan(plan(180).lamps[3]);
    const blessCycles = (p: Plan, r: Ring) => rests(p).find(x => x.rest === 'bless' && x.rings.includes(r))!.cycles;
    expect(blessCycles(p30, 2)).toBeGreaterThan(blessCycles(p10, 2));
    // ring 4 gets more breaths than its neighbours
    expect(blessCycles(p10, 4)).toBeGreaterThan(blessCycles(p10, 3));
    expect(blessCycles(p30, 4)).toBeGreaterThan(blessCycles(p30, 3));
    // the pushes stay short even in 30 minutes (an average player: under ~2 minutes of wall time a block)
    for (const s of pushes(p30)) expect(s.need / RULES.avgYield, s.stage).toBeLessThan(120);
  });

  it('leaves ring 4 out today when asked, and goes on from a saved ring', () => {
    const skip = plan(600, { skip4: true });
    expect(pushes(skip).some(s => s.stage === 'ring4')).toBe(false);
    expect(rests(skip).some(r => r.rings.includes(4))).toBe(false);
    const from3 = plan(600, { startRing: 3 });
    expect([...new Set(pushes(from3).map(s => s.stage))]).toEqual(['descent', 'heart', 'field', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back']);
    expect(from3.rings).toEqual([3, 4, 5]);
  });

  it('spends the session: rests about a third, the plan’s expected time inside the session for an average player', () => {
    for (const T of [180, 300, 600, 900, 1800]) {
      for (const firstEver of [false, true]) {
        const p = plan(T, { firstEver });
        const avg = planSeconds(p, BREATH_PRESETS.even, false, RULES.avgYield);
        expect(avg, `${T} ${firstEver}`).toBeLessThan(T - p.finale + 1);
        expect(avg, `${T} ${firstEver}`).toBeGreaterThan(T * 0.8);
        expect(p.restSec / T, String(T)).toBeGreaterThan(0.22);
        expect(p.restSec / T, String(T)).toBeLessThan(0.6);
      }
    }
  });

  it('gives each ring its lamps (fewer in 3 minutes, more in 30), never under four', () => {
    for (const T of [180, 600, 1800]) for (const r of RINGS) expect(lampsFor(r, T)).toBeGreaterThanOrEqual(4);
    expect(lampsFor(3, 180)).toBeLessThan(lampsFor(3, 600));
    expect(lampsFor(5, 1800)).toBeGreaterThan(lampsFor(5, 600));
  });
});

describe('light only from real focus', () => {
  it('moves the light only in a push past its lead-in, with a signal, while focused', () => {
    expect(focusRate(0.9, false, 10)).toBe(0);
    expect(focusRate(0.5, true, 0)).toBeCloseTo(RULES.rateLo, 6);
    expect(focusRate(1, true, 12)).toBeCloseTo((RULES.rateLo + RULES.rateK) * (1 + RULES.holdK), 6);
    const sim = later();
    drive(sim, RULES.leadIn.fnirs - 0.2, HIGH);
    expect(sim.prog.descent).toBe(0);
    drive(sim, 2, HIGH);
    expect(sim.prog.descent).toBeGreaterThan(0);
    for (const f of [LOW, NONE]) {
      const s = later();
      drive(s, 60, f);
      expect(s.prog.descent, JSON.stringify(f)).toBe(0);
      expect(s.score).toBe(0);
    }
  });

  it('never goes back and never moves from taps; waits without focus', () => {
    const sim = later({ planned: 600 });
    const rng = mulberry32(7);
    let last = 0;
    const clock = { t: 0 };
    for (let i = 0; i < 400; i++) {
      drive(sim, 0.5, () => (rng() < 0.5 ? HIGH : rng() < 0.5 ? LOW : NONE), clock);
      const sum = Object.values(sim.prog).reduce((a, b) => a + b, 0) - sim.prog.more;
      expect(sum).toBeGreaterThanOrEqual(last - 1e-9);
      last = sum;
    }
    const tapper = later();
    const c2 = { t: 0 };
    for (let i = 0; i < 200; i++) {
      drive(tapper, 0.3, LOW, c2);
      tapper.stay();
      tapper.key(' ', true);
    }
    expect(tapper.prog.descent).toBe(0);
    expect(tapper.score).toBe(0);
  });

  it('kindles the lights in order: the places of the descent, the heart, the field, the lamps of each ring', () => {
    const sim = later({ planned: 600 });
    const { evs } = session(sim, strong);
    const places = ofType(evs, 'place').map(e => e.place);
    expect(places).toEqual(['eyes', 'mouth', 'throat', 'heart']);
    const order = evs.filter(e => ['kindled', 'whole', 'reach', 'ringDone', 'sunUp', 'pervaded', 'home', 'way'].includes(e.type))
      .map(e => (e.type === 'reach' || e.type === 'ringDone' ? `${e.type}${e.ring}` : e.type));
    expect(order.slice(0, 15)).toEqual(['kindled', 'whole', 'reach1', 'ringDone1', 'reach2', 'ringDone2', 'reach3', 'ringDone3', 'reach4', 'ringDone4', 'reach5', 'ringDone5', 'sunUp', 'pervaded', 'home']);
    expect(order).toContain('way');
    for (const r of RINGS) {
      const lamps = ofType(evs, 'lamp').filter(e => e.ring === r);
      expect(lamps.map(e => e.i)).toEqual(lamps.map((_, i) => i));
      expect(lamps.length).toBe(sim.lampTotal(r));
    }
    // the headline counts every light: places, heart, me, lamps, the sun, and more for the world
    const lamps = RINGS.reduce((n, r) => n + sim.lampTotal(r), 0);
    expect(sim.score).toBe(4 + 1 + 1 + lamps + 1 + sim.moreLights);
    expect(sim.moreLights).toBeGreaterThan(0);
  });
});

describe('after the way', () => {
  it('lights more of the world for one group of people at a time, and blesses them', () => {
    const sim = later({ planned: 900 });
    session(sim, strong);
    const more = sim.steps.filter(s => s.kind === 'rest' && s.rest === 'more') as RestStep[];
    expect(more.length).toBeGreaterThan(1);
    expect(more.slice(0, 5).map(s => s.arc)).toEqual(['suffer', 'lonely', 'sick', 'dying', 'born'].slice(0, Math.min(5, more.length)));
    expect(sim.restItems(more[1]).map(i => i.text ?? (i.word ? 'word' : ''))).toEqual([t('more.lonely'), 'word']);
    expect(t('more.lonely')).toBe('Panie, błogosław samotnym.');
  });
});

describe('the arc fits the session (3, 10 and 30 minutes)', () => {
  for (const T of [180, 600, 1800]) {
    it(`walks the whole way near the end of ${T / 60} minutes for an average player, part-way for a weak one`, () => {
      const avg = later({ planned: T });
      const a = session(avg, average);
      expect(a.wayAt, 'average').not.toBeNull();
      expect(a.wayAt! / T).toBeGreaterThan(0.7);
      expect(a.wayAt! / T).toBeLessThan(1);
      const w = later({ planned: T, seed: 3 });
      const b = session(w, weak);
      expect(b.wayAt, 'weak').toBeNull();
      expect(w.reachedNow).toBeGreaterThanOrEqual(T >= 600 ? 1 : 0);
      // a first-ever session (warm-up, opening card) still fits for the average player
      const first = makeSim({ planned: T, seed: 5 });
      const c = session(first, average);
      expect(c.wayAt, 'first').not.toBeNull();
      // a strong player finishes early and lights more of the world, never before 40 % of the time
      const st = later({ planned: T, seed: 9 });
      const d = session(st, strong);
      expect(d.wayAt! / T).toBeGreaterThan(0.4);
      expect(st.moreLights).toBeGreaterThan(0);
    });
  }

  it('says where the next session goes on, and the next session goes on from there', () => {
    const p = { ...freshProgress(), sessions: 3, seen: [...ALL_SEEN] };
    const sim = new SerceSim({ progress: p, rng: mulberry32(2), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
    sim.start();
    const clock = { t: 0 };
    // until ring 2 is done, then nothing more
    while (sim.reachedNow < 2 && clock.t < 600) drive(sim, 0.5, strong, clock);
    while (clock.t < 610 && sim.phase !== 'done') drive(sim, 0.5, LOW, clock);
    sim.finish();
    expect(p.pos).toEqual({ ring: 3 });
    expect(sim.result().highlights).toContain(t('hl.next', { from: t('from.3') }));
    expect(t('hl.next', { from: t('from.2') })).toBe('Następnym razem: od kręgu przyjaciół.');
    const next = new SerceSim({ progress: p, rng: mulberry32(3), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
    expect(next.from).toBe(3);
    expect(next.plan.rings).toEqual([3, 4, 5]);
    expect(next.remembered(1) && next.remembered(2) && !next.remembered(3)).toBe(true);
    // a whole way clears it
    next.start();
    session(next, strong);
    expect(p.pos).toBeNull();
    expect(p.ways).toBe(1);
    expect(startRing(p)).toBe(1);
  });
});

describe('blocks: rests of whole breaths, the valve, judging', () => {
  it('rests after the heart (gratitude), after the field (me) and after every ring, each whole breaths of the pattern', () => {
    const sim = later({ planned: 600 });
    const { evs } = session(sim, strong);
    const restBlocks = sim.blocks.filter(b => b.kind === 'rest' && b.why !== 'valve' && b.len > 0 && b.why !== 'time');
    const cyc = breathCycle(BREATH_PRESETS.even);
    for (const b of restBlocks) {
      expect(b.dur).toBeCloseTo(b.cycles * cyc, 6);
      if (b.len < b.dur - 0.1) continue;   // cut by the finale
      expect(b.len).toBeCloseTo(b.dur, 0);
    }
    const kinds = restBlocks.map(b => `${b.step!.rest}${b.step!.rings.join('')}`);
    expect(kinds.slice(0, 11)).toEqual(['stop', 'stop', 'grat', 'bless0', 'bless1', 'bless2', 'bless3', 'bless4', 'bless5', 'sun', 'amen']);
    // the rest comes when the ring is done: its lamps all lit before its blessing begins
    const starts = ofType(evs, 'blockStart');
    expect(starts[0].block.kind).toBe('push');
  });

  it('shows a blessing one line per breath, then its verse', () => {
    const sim = later({ planned: 1200 });
    const st: RestStep = { kind: 'rest', rest: 'bless', rings: [4], cycles: 5 };
    const items = sim.restItems(st);
    expect(items.slice(0, 3).map(i => i.text)).toEqual([t('bless.4.1'), t('bless.4.2'), t('bless.4.3')]);
    expect(items.at(-1)!.verse).toBe(verseFor('ring4', sim.session));
    expect(sim.restItemAt(st, 0).text).toBe(t('bless.4.1'));
    expect(sim.restItemAt(st, 4).verse).toBeDefined();
    // a breath per ring in 3 minutes: the first line of each, no verse
    const shared: RestStep = { kind: 'rest', rest: 'bless', rings: [1, 2, 3], cycles: 3 };
    expect(sim.restItems(shared).map(i => i.text)).toEqual([t('bless.1.1'), t('bless.2.1'), t('bless.3.1')]);
    // the closing always ends with the Aaronic blessing
    const amen: RestStep = { kind: 'rest', rest: 'amen', rings: [5], cycles: 2 };
    expect(sim.restItemAt(amen, 0).text).toBe(t('bless.5.1'));
    expect(sim.restItemAt(amen, 1).verse).toBe('num6.24-26');
    // the words: every ring's blessing lines exist
    for (const r of [0, 1, 2, 3, 4, 5] as const) for (let i = 0; i < BLESS_LINES[r]; i++) expect(t(`bless.${r}.${i + 1}` as never)).not.toMatch(/^bless/);
  });

  it('opens a rest of the heart word when a push cannot finish; the step keeps its light', () => {
    const sim = later({ planned: 900 });
    const clock = { t: 0 };
    drive(sim, RULES.leadIn.fnirs + 1.5, HIGH, clock);
    const got = sim.prog.descent;
    expect(got).toBeGreaterThan(0);
    expect(sim.pushBlock).toBe(true);
    const evs = drive(sim, RULES.valveStall + 2, LOW, clock);
    expect(ofType(evs, 'valve')).toHaveLength(1);
    expect(sim.restBlock).toBe(true);
    expect(sim.block.why).toBe('valve');
    expect(sim.prog.descent).toBe(got);
    drive(sim, sim.block.dur + 0.5, LOW, clock);
    expect(sim.pushBlock).toBe(true);
    drive(sim, 10, HIGH, clock);
    expect(sim.prog.descent).toBeGreaterThan(got);
  });

  it('telegraphs the rest when the ring is nearly done and the next push before the rest ends; judges each block once', () => {
    const sim = later({ planned: 600 });
    const { evs } = session(sim, average);
    const tel = ofType(evs, 'telegraph');
    expect(tel.length).toBeGreaterThan(8);
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBe(sim.blocks.filter(b => b.len > 0).length);
    expect(ends.some(e => e.verdict === true)).toBe(true);
  });

  it('runs a first-ever session with a warm-up and the opening card, which never hides the first push', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.block.kind).toBe('warmup');
    expect(sim.story).not.toBeNull();
    const clock = { t: 0 };
    drive(sim, 5, HIGH, clock);
    expect(sim.prog.descent).toBe(0);
    let guard = 0;
    while (sim.story && guard++ < 400) drive(sim, 0.25, HIGH, clock, reader(sim));
    expect(sim.story).toBeNull();
    expect(pageTime(0)).toBeGreaterThanOrEqual(RULES.pageSec);
    drive(sim, 40, HIGH, clock);
    expect(sim.prog.descent).toBeGreaterThan(0);
  });

  it('scores with the smoke test’s crude input (taps, the simulator’s focus on)', () => {
    const sim = makeSim({ planned: 60 });
    const clock = { t: 0 };
    for (let i = 0; i < 90; i++) {
      drive(sim, 0.65, () => frame({ level: 0.75, activity: 4, focused: true, hold: 5 }), clock);
      sim.stay();
    }
    expect(sim.score).toBeGreaterThan(0);
  });
});

describe('the summary and the progress', () => {
  it('settles once, keeps records with Math.max, says the furthest ring and a closing verse that fits', () => {
    const p = { ...freshProgress(), sessions: 2, seen: [...ALL_SEEN] };
    const sim = new SerceSim({ progress: p, rng: mulberry32(4), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
    sim.start();
    session(sim, strong);
    const r1 = sim.result(), r2 = sim.result();
    expect(r1).toEqual(r2);
    expect(p.sessions).toBe(3);
    expect(p.best['600']).toBe(sim.score);
    expect(r1.unit).toBe(unit(sim.score));
    expect(r1.stats.length).toBeLessThanOrEqual(6);
    expect(r1.highlights.length).toBeLessThanOrEqual(5);
    expect(r1.highlights[0]).toBe(t('hl.way'));
    expect(VERSES.closing as readonly string[]).toContain(sim.closingVerse() === 'num6.24-26' ? 'col3.14' : sim.closingVerse());
    // part-way: the furthest ring's verse
    const q = later({ planned: 600 });
    const clock = { t: 0 };
    while (q.reachedNow < 2 && clock.t < 500) drive(q, 0.5, strong, clock);
    drive(q, 1, LOW, clock);
    expect(q.closingVerse()).toBe(verseFor('ring2', q.session));
  });

  it('keeps summaries short at 30 minutes and its collections bounded', () => {
    const sim = later({ planned: 1800 });
    const { evs } = session(sim, strong);
    const r = sim.result();
    expect(r.highlights.length).toBeLessThanOrEqual(5);
    for (const [, v] of r.stats) expect(v.length).toBeLessThan(40);
    expect(sim.steps.length).toBeLessThan(sim.plan.steps.length + 80);
    expect(sim.talk.said.length).toBeLessThan(200);
    expect(evs.filter(e => e.type === 'lamp').length).toBeLessThan(400);
  });

  it('migrates the placeholder’s save and garbage; names stay plain, at most 8 a ring, 24 characters each', () => {
    const old = mergeSaved(freshProgress(), { best: null });
    migrate(old);
    expect(old.ver).toBe(1);
    expect(old.best).toEqual({});
    expect(bestOf(old)).toBeNull();
    const junk = migrate({ sessions: 'x', best: { 600: 12, nope: 3, 300: -1 }, names: [['  Ania ', 3, '<b>x</b>'], 'no'], word: 'om', skip4: 'today', breath: { in: 0, out: 0 }, pos: { ring: 9 }, reach: 99 } as unknown as SerceProgress);
    expect(junk.sessions).toBe(0);
    expect(junk.best).toEqual({ 600: 12 });
    expect(junk.names[0]).toEqual(['Ania', 'b x /b']);
    expect(junk.names[1]).toEqual([]);
    expect(junk.word).toBe('jesus');
    expect(junk.skip4).toBe('');
    expect(junk.pos).toBeNull();
    expect(junk.reach).toBe(5);
    expect(breathCycle(junk.breath)).toBeGreaterThanOrEqual(2);
    const p = freshProgress();
    expect(setNames(p, 2, 'Ola, Kuba,  Ewa ,,' + ',x'.repeat(20))).toHaveLength(8);
    expect(setNames(p, 1, 'A'.repeat(40))[0]).toHaveLength(RULES.nameMax);
    expect(setNames(p, 5, 'Nobody')).toEqual([]);
    expect(namesCount(p)).toBe(9);
    expect(cleanName('  Jan\u0007 Kowalski ')).toBe('Jan Kowalski');
    expect(cleanOwn('x'.repeat(80))).toHaveLength(RULES.ownMax);
    expect(setBreath(p, { in: 0, holdIn: 0, out: 1, holdOut: 0 })).toBe(false);
    clearStart(p);
    expect(startRing(p)).toBe(1);
  });

  it('leaves ring 4 out only on the day it was asked', () => {
    const p = freshProgress();
    setSkip4(p, DAY, true);
    expect(skip4Today(p, DAY)).toBe(true);
    expect(skip4Today(p, '2026-11-23')).toBe(false);
    const sim = new SerceSim({ progress: { ...p, sessions: 1, seen: [...ALL_SEEN] }, rng: mulberry32(1), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
    expect(sim.plan.rings).toEqual([1, 2, 3, 5]);
    expect(sim.ringOut(4)).toBe(true);
    const tomorrow = new SerceSim({ progress: { ...p, sessions: 1 }, rng: mulberry32(1), plannedSec: 600, eeg: false, tuning: TUNING, day: '2026-11-23' });
    expect(tomorrow.plan.rings).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('the words', () => {
  it('splits the words of the heart on the breath', () => {
    expect(heartWord('jesus', '')).toEqual({ in: 'Panie Jezu Chryste, Synu Boży,', out: 'zmiłuj się nade mną.' });
    expect(heartWord('own', 'Jezu, ufam Tobie')).toEqual({ in: 'Jezu,', out: 'ufam Tobie' });
    expect(heartWord('own', 'Abba')).toEqual({ in: 'Abba', out: 'Abba' });
    expect(heartWord('own', '   ')).toEqual(heartWord('jesus', ''));
    expect(CATALOGS.de['word.jesus.out']).toBe('erbarme dich meiner.');
    expect(CATALOGS.sv['word.jesus.in']).toBe('Herre Jesus Kristus, Guds Son,');
    expect(CATALOGS.en['word.jesus.in'] + ' ' + CATALOGS.en['word.jesus.out']).toBe('Lord Jesus Christ, Son of God, have mercy on me.');
  });

  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator two lines or more a moment, each fitting a caption (90 characters)', () => {
    for (const m of ['open', 'resume', 'descend', 'settle', 'heart', 'field', 'whole', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back', 'home', 'more', 'wait', 'good', 'nosignal', 'valve', 'end'] as const) {
      expect(linesOf(m).length, m).toBeGreaterThanOrEqual(2);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('speaks of light, warmth, love and peace — no energy, no healing power, no chakras (the lobby’s origin note aside)', () => {
    const FORBID: Record<string, RegExp> = {
      pl: /energi|uzdrawia|leczy|czakr|kundalini|w[ąę]ż/i,
      en: /energy|heal(s|ing)? power|\bcures?\b|chakra|kundalini|serpent/i,
      de: /energie|heilt|chakra|kundalini|schlange/i,
      sv: /energi|\bhelar\b|chakra|kundalini|\borm\b/i,
    };
    const VERBS: Record<string, RegExp> = { pl: /\bwysyła|aktywuj|generuj|kanałuj/i, en: /\bchannel|\bgenerate|\bactivate|\bsend (energy|light)/i, de: /aktivier|kanalisier|\bsende/i, sv: /aktiver|kanaliser|\bskicka/i };
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const all: [string, string][] = [];
      for (const [k, v] of Object.entries(CATALOGS[l])) for (const s of typeof v === 'string' ? [v] : Object.values(v)) all.push([k, s as string]);
      // the registry's lines for this game (the lobby's text keeps its one origin sentence out of scope)
      for (const [k, v] of Object.entries(ARCADE_TEXTS[l])) if (k.startsWith('serce.') && k !== 'serce.text') all.push([k, v as string]);
      for (const [k, v] of Object.entries(MOUSE_TEXTS[l] ?? {})) if (k.startsWith('serce.') && k !== 'serce.text') all.push([k, v as string]);
      for (const [k, s] of all) {
        expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
        expect(s, `${l}.${k}`).not.toMatch(VERBS[l]);
        if (/^(tip|howto)\./.test(k)) expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
      // the origin note names the tradition once, the rest of the lobby text speaks of light
      const text = ARCADE_TEXTS[l]['serce.text'] as string;
      expect(text).toMatch(/metta/i);
      expect(text.replace(/[^.!?]*metta[^.!?]*[.!?]/i, '')).not.toMatch(FORBID[l]);
    }
    // the how-to's last tip: attention, not treatment
    expect(t('howto.tip2')).toMatch(/mierzy uwagę/);
    expect(t('howto.tip2')).toMatch(/nie leczenie/);
  });

  it('keeps Polish letters out of the other languages, quotes in each language’s marks, never “Gott mit uns”', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
    for (const v of Object.values(CATALOGS.de)) if (typeof v === 'string') expect(v).not.toMatch(/Gott mit uns/);
  });

  it('names every passage by id, each present', () => {
    for (const id of ALL_VERSES) expect(passage(id).text.length, id).toBeGreaterThan(10);
    expect(ALL_VERSES).toContain('1jn4.16');
    expect(ALL_VERSES).toContain('mat5.44-45');
    expect(ALL_VERSES).toContain('num6.24-26');
  });

  it('bends the unit and writes seconds with a no-break space; the breath in words', () => {
    expect(unit(1)).toBe('światło');
    expect(unit(3)).toBe('światła');
    expect(unit(5)).toBe('świateł');
    expect(secText(42)).toBe('42 s');
    expect(secText(102)).toBe('1:42');
    expect(breathWords(BREATH_PRESETS.even)).toBe('wdech 5 s, wydech 5 s');
    expect(readTime('x'.repeat(10))).toBe(RULES.readMin);
  });

  it('gives every stage a strategy for the head, never "harder"', () => {
    for (const s of ['descent', 'heart', 'field', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back', 'more'] as const) {
      const tip = pushTip(s, 'mouth', 1);
      expect(tip.length, s).toBeGreaterThan(10);
      expect(tip).not.toMatch(/^tip\./);
    }
    expect(stageRing('ring3')).toBe(3);
    expect(stageRing('sun')).toBeNull();
  });
});

describe('mobile first, then the desk (layout.ts)', () => {
  it('lays the "now" line, the picture and the words card inside the insets at every checked size, with a finger and a mouse', () => {
    for (const touch of [true, false]) {
      for (const c of CHECK_SIZES) {
        const L = layout(c.w, c.h, c.insets, touch);
        const name = `${c.name} ${touch ? 'touch' : 'mouse'}`;
        for (const [k, r] of [['now', L.now], ['card', L.card], ['pic', L.pic], ['story', L.story]] as const) {
          expect(r.x, `${name} ${k}`).toBeGreaterThanOrEqual(c.insets.left - 0.5);
          expect(r.y, `${name} ${k}`).toBeGreaterThanOrEqual(c.insets.top - 0.5);
          expect(r.x + r.w, `${name} ${k}`).toBeLessThanOrEqual(c.w - c.insets.right + 0.5);
          expect(r.y + r.h, `${name} ${k}`).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
          expect(r.w, `${name} ${k}`).toBeGreaterThan(40);
        }
        expect(L.card.h, name).toBeGreaterThanOrEqual(110);
        expect(L.pic.h, name).toBeGreaterThanOrEqual(110);
        // the picture never runs under the card (tall: above it; side and desk: beside it)
        if (L.kind === 'tall') expect(L.pic.y + L.pic.h).toBeLessThanOrEqual(L.card.y);
        else expect(L.pic.x + L.pic.w <= L.card.x || L.card.x + L.card.w <= L.pic.x, name).toBe(true);
        expect(L.fs.now).toBeGreaterThanOrEqual(MIN_READ);
        expect(L.fs.caption).toBeGreaterThanOrEqual(MIN_READ);
        expect(L.fs.label).toBeGreaterThanOrEqual(MIN_TEXT);
        expect(L.fs.head).toBeGreaterThanOrEqual(12);
        expect(auditTargets([storyTarget(L.story)], c.w, c.h, c.insets), name).toEqual([]);
      }
    }
    expect(layout(360, 500, CHECK_SIZES[0].insets, true).kind).toBe('tall');
    expect(layout(601, 360, CHECK_SIZES[4].insets, true).kind).toBe('side');
    expect(layout(1280, 672, CHECK_SIZES[7].insets, false).kind).toBe('desk');
  });

  it('fits every framing into the picture: the head and chest, the figure, each ring, the world with the whole Earth', () => {
    const L = layout(390, 564, CHECK_SIZES[1].insets, true);
    for (const f of ['body', 'figure', 'ring1', 'ring2', 'ring3', 'ring4', 'world', 'home'] as const) {
      const c = cameraFor(L, f), b = frameBox(f);
      const a = toScreen(L, c, b.cx - b.hx, b.cy - b.hy), z = toScreen(L, c, b.cx + b.hx, b.cy + b.hy);
      expect(a.x, f).toBeGreaterThanOrEqual(L.pic.x - 0.5);
      expect(a.y, f).toBeGreaterThanOrEqual(L.pic.y - 0.5);
      expect(z.x, f).toBeLessThanOrEqual(L.pic.x + L.pic.w + 0.5);
      expect(z.y, f).toBeLessThanOrEqual(L.pic.y + L.pic.h + 0.5);
    }
    // the rings fit their framings; the world holds the Earth and ring 4 above it
    for (const k of [1, 2, 3, 4] as const) expect(frameBox(`ring${k}`).hx).toBeGreaterThan(RULES.ringR[k]);
    const w = frameBox('world');
    expect(w.cy + w.hy).toBeGreaterThan(EARTH.cy + EARTH.r);
    expect(w.cy - w.hy).toBeLessThan(-RULES.ringR[4]);
    // the camera eases evenly and arrives
    let cam = cameraFor(L, 'body');
    const to = cameraFor(L, 'world');
    for (let i = 0; i < 400; i++) cam = easeCam(cam, to, 0.05);
    expect(cam.s).toBeCloseTo(to.s, 3);
    expect(cam.y).toBeCloseTo(to.y, 3);
  });

  it('draws the Earth from its own outlines: enough cities facing us for 30 minutes, kindled nearest first', () => {
    const E = earth();
    expect(E.cities.length).toBeGreaterThanOrEqual(lampsFor(5, 1800));
    expect(E.dust.length).toBeGreaterThan(150);
    const order = cityOrder(lampsFor(5, 600));
    for (let i = 1; i < order.length; i++) expect(order[i].d).toBeGreaterThanOrEqual(order[i - 1].d);
    // Warsaw faces us, near the top limb where the figure stands
    const w = project(21, 52.2);
    expect(w.front).toBe(true);
    expect(w.y).toBeLessThan(-0.8);
    for (const c of E.cities) expect(Math.hypot(c.at[0] - EARTH.cx, c.at[1] - EARTH.cy)).toBeLessThanOrEqual(EARTH.r + 1e-9);
  });

  it('says how to play for the hand the player has, the last tip that it measures attention', () => {
    const touch = howto(true), mouse = howto(false);
    expect(touch.hands).toHaveLength(1);
    expect(touch.hands[0].text).toMatch(/Stuknij/);
    expect(mouse.hands.map(h => h.gesture)).toEqual(['tap', 'keys']);
    expect(touch.tips!.at(-1)).toMatch(/mierzy uwagę, nie modlitwę/);
    expect(touch.tips![0]).toMatch(/wdech 5 s, wydech 5 s/);
  });
});

describe('the lobby’s card (panel.ts)', () => {
  it('keeps the circles’ names, the heart word, the breath and “leave this circle out today”, all saved at once', () => {
    const p = freshProgress();
    let saves = 0;
    const root = progressPanel(p, () => { saves++; });
    const text = () => root.textContent ?? '';
    expect(text()).toContain('Twoje kręgi');
    expect(text()).toContain('zostają tylko na tym urządzeniu');
    const inputs = () => [...root.querySelectorAll('input[type="text"]')] as HTMLInputElement[];
    expect(inputs()).toHaveLength(4);
    inputs()[0].value = 'Mama, Tata,  Ania ';
    inputs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(p.names[0]).toEqual(['Mama', 'Tata', 'Ania']);
    expect(saves).toBe(1);
    expect(inputs()[0].value).toBe('Mama, Tata, Ania');
    // ring 4: its care note and the switch for today only
    expect(text()).toContain('Zacznij od kogoś, kto zranił Cię lekko');
    const box = root.querySelector('input[type="checkbox"]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(p.skip4).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(text()).toContain('jutro wróci');
    // the words of the heart: five choices; own words open a field
    const btn = (label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label) as HTMLButtonElement;
    for (const w of ['Modlitwa Jezusowa', 'Jezu', 'Abba, Ojcze', 'Maranatha', 'Własne słowa']) expect(btn(w), w).toBeDefined();
    btn('Własne słowa').click();
    expect(p.word).toBe('own');
    const own = inputs().at(-1)!;
    own.value = 'Jezu, ufam Tobie';
    own.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(p.own).toBe('Jezu, ufam Tobie');
    // the breath: the presets, 5 · 5 chosen
    expect(btn('5 · 5 równy').getAttribute('aria-checked')).toBe('true');
    btn('4 · 6 spokojny').click();
    expect(p.breath).toEqual(BREATH_PRESETS.calm);
    for (const b of root.querySelectorAll('button')) expect(b.style.minHeight).toBe('44px');
    // where it goes on
    p.pos = { ring: 2 };
    const again = progressPanel(p, () => undefined);
    expect(again.textContent).toContain('Dalej od kręgu przyjaciół');
  });
});
