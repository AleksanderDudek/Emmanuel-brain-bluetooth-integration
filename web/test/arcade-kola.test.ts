// @vitest-environment happy-dom
/**
 * Koła światła (DESIGN.md §28): the plan at every length 3–60 min and a test of a minute or less, the session (only
 * focus brings a wheel true; the rests and the field are receptive; the valve; the rounds; the full field), the work
 * fitted to the player's pace (a sim grid), the progress, the words in four languages (the names Rzeki's, the
 * tradition named once, no energy, no healing, no gendered Polish), the registry, the layout and the lobby's card.
 */
import { describe, expect, it } from 'vitest';
import { BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import {
  ALL_VERSES, CENTRES, MOMENTS, PETALS, ROOT, ROUND_PETALS, VERSES, WHEELS, WHEEL_IDS, WHEEL_VERSE, partnerOf, stepsOf, verseFor,
} from '../src/arcade/kola/content';
import { eggOf, frameBox, wheelGeom } from '../src/arcade/kola/figure';
import { CATALOGS, linesOf, t, unit } from '../src/arcade/kola/i18n';
import { howto, kolaRhythm } from '../src/arcade/kola/index';
import { guideHeight, layout } from '../src/arcade/kola/layout';
import { freshProgress, migrate, setPosture, type KolaProgress } from '../src/arcade/kola/meta';
import { forecast, progressPanel } from '../src/arcade/kola/panel';
import { RULES, focusRate, groupsOf, learnPace, needPer, paceNow, planFor, restInFor, type Plan } from '../src/arcade/kola/rules';
import { KolaSim, faultOf, type SimEvent } from '../src/arcade/kola/sim';
import { CATALOGS as RZEKI } from '../src/arcade/rzeki/i18n';
import { ARCADE, arcadeEntry } from '../src/arcade/registry';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, LANGS, type Lang } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 10;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const LENGTHS = SESSION_MINUTES.map(m => m * 60);
/** the breath presets' cycles: 10 s (4 · 6, 5 · 5), 16 s (the box), 19 s (4 · 7 · 8) */
const CYCLES = [...new Set(Object.values(BREATH_PRESETS).map(breathCycle))];

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });

type FrameFn = (t: number, sim: KolaSim) => FocusFrame;
type Opts = { progress?: Partial<KolaProgress>; planned?: number; seed?: number; eeg?: boolean; rhythm?: { focus: number; rest: number; custom: boolean } | null; first?: boolean };

function makeSim(o: Opts = {}): KolaSim {
  const base: KolaProgress = o.first ? freshProgress() : { ...freshProgress(), sessions: 4, pace: 0.6, seen: ['c.tap', 'c.push', 'c.rest', 'c.petal'] };
  const progress = { ...base, ...o.progress } as KolaProgress;
  const sim = new KolaSim({ progress, rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null });
  sim.start();
  return sim;
}

/** Play the whole session (and a second past its end) with the frame given; the events in order. */
function play(sim: KolaSim, f: FocusFrame | FrameFn, out: SimEvent[] = [], until = sim.T + 1): SimEvent[] {
  for (let t = STEP; t <= until; t += STEP) {
    sim.update(STEP, typeof f === 'function' ? f(t, sim) : f, t);
    out.push(...sim.take());
  }
  return out;
}
/** A player who focuses in the pushes with `push` and rests elsewhere. */
const player = (push: FocusFrame): FrameFn => (_t, s) => (s.pushBlock ? push : LOW);

/** A player model for the sim grid: focused stretches and lapses of random length in the pushes. */
function model(kind: 'strong' | 'threshold' | 'weak', seed: number): FrameFn {
  const rng = mulberry32(seed);
  const onMean = { strong: 30, threshold: 8, weak: 5 }[kind], offMean = { strong: 2, threshold: 4, weak: 7 }[kind];
  const lvl = { strong: 0.85, threshold: 0.6, weak: 0.55 }[kind];
  let on = false, left = 0, hold = 0;
  return (_t, sim) => {
    if (!sim.pushBlock) { on = false; hold = 0; left = 0; return LOW; }
    left -= STEP;
    if (left <= 0) { on = !on; left = -Math.log(1 - rng() * 0.999) * (on ? onMean : offMean); }
    hold = on ? hold + STEP : 0;
    return frame({ focused: on, level: on ? lvl : 0.35, hold, calm: 0.2 });
  };
}

/** The share of the planned work a session did (every planned round's steps). */
function workShare(sim: KolaSim): number {
  let all = 0, done = 0;
  for (const w of sim.wheels) for (const r of sim.plan.rounds) {
    const rr = w.r[r.round - 1];
    all += rr.p.length;
    done += rr.done ? rr.p.length : rr.p.reduce((s, x) => s + x, 0);
  }
  return done / all;
}

// ── the plan ────────────────────────────────────────────────────────

describe('Koła światła — the plan', () => {
  const check = (p: Plan, T: number, cyc: number): void => {
    // every round walks the twelve once, from the base up, front and back of a centre together (but one by one)
    for (const r of p.rounds) {
      const gs = p.groups.filter(g => g.round === r.round);
      expect(gs.flatMap(g => g.wheels), `${T} ${cyc} round ${r.round}`).toEqual([...WHEEL_IDS]);
      for (const g of gs) {
        expect(g.push).toBeGreaterThan(p.lead);
        if (!p.test) expect(g.breaths).toBeGreaterThanOrEqual(1);
      }
      if (r.grouping !== 12) for (const g of gs) for (const id of g.wheels) { const q = partnerOf(id); if (q) expect(g.wheels).toContain(q); }
    }
    expect(p.rounds.map(r => r.round)).toEqual(p.rounds.map((_, i) => i + 1));
    // the frame: the arrival in whole breaths, the field before the close, the close to the end
    expect(p.arriveEnd).toBeGreaterThan(0);
    if (!p.test) expect(p.arriveEnd / cyc).toBeCloseTo(Math.round(p.arriveEnd / cyc), 6);
    expect(p.fieldStart).toBeGreaterThan(p.arriveEnd);
    expect(p.closeStart).toBeGreaterThan(p.fieldStart);
    expect(p.closeStart).toBeLessThan(T);
    // the plan's time fits the room between the arrival and the field
    expect(p.used).toBeLessThanOrEqual(p.room + 1e-6);
  };

  it('fits every length 3–60 min with every breath, Mendi and HALO; rounds grow with the length', () => {
    for (const cyc of CYCLES) for (const eeg of [false, true]) for (const T of LENGTHS) check(planFor({ plannedSec: T, cyc, eeg }), T, cyc);
    const at = (m: number) => planFor({ plannedSec: m * 60, cyc: 10, eeg: false });
    expect(at(3).rounds).toHaveLength(1);
    expect(at(3).rounds[0].grouping).toBeLessThan(7);
    expect(at(5).rounds[0].grouping).toBe(7);
    for (const m of [10, 15, 20]) expect(at(m).rounds.map(r => r.grouping), `${m}`).toEqual([12]);
    expect(at(30).rounds).toHaveLength(2);
    for (const m of [45, 60]) expect(at(m).rounds).toHaveLength(3);
    // steps per wheel grow with the time a wheel has
    expect(at(3).rounds[0].steps).toBeLessThan(at(15).rounds[0].steps);
    expect(at(15).rounds[0].steps).toBe(5);
  });

  it('plays a test of a minute or less as one push for all twelve, one step each', () => {
    for (const T of [40, 60]) {
      const p = planFor({ plannedSec: T, cyc: 10, eeg: false });
      expect(p.test).toBe(true);
      expect(p.groups).toHaveLength(1);
      expect(p.groups[0].wheels).toHaveLength(12);
      expect(p.rounds[0].steps).toBe(1);
      check(p, T, 10);
    }
  });

  it('keeps the player’s dials where they fit, and says the rest a short session keeps', () => {
    const p = planFor({ plannedSec: 1800, cyc: 10, eeg: false, focus: 30, rest: 3, custom: true });
    expect(p.breaths).toBe(3);
    const pushes = p.groups.map(g => g.push);
    expect(pushes.reduce((s, x) => s + x, 0) / pushes.length).toBeLessThanOrEqual(31);
    expect(restInFor(30, 3, 1800, 10)).toBe(3);
    // three minutes hold one push of 60 s and a rest of five breaths of 10 s — but not of 19 s: one breath then
    expect(restInFor(60, 5, 180, 10)).toBe(5);
    expect(planFor({ plannedSec: 180, cyc: 10, eeg: false, focus: 60, rest: 5, custom: true }).groups).toHaveLength(1);
    expect(restInFor(60, 5, 180, 19)).toBe(1);
    const spec = kolaRhythm();
    expect(spec.focus.def).toBe(RULES.focus.def);
    expect(spec.rest.def).toBe(RULES.rest.def);
    expect(spec.restIn!({ focus: 30, rest: 3 }, 1800)).toBe(3);
  });

  it('groups by centre: each wheel, each centre, or centres together', () => {
    expect(groupsOf(12)).toHaveLength(12);
    expect(groupsOf(7).map(g => g.length)).toEqual([1, 2, 2, 2, 2, 2, 1]);
    expect(groupsOf(1)[0]).toEqual([...WHEEL_IDS]);
    for (const g of [4, 3, 2] as const) expect(groupsOf(g).flat()).toEqual([...WHEEL_IDS]);
  });
});

// ── the session ─────────────────────────────────────────────────────

describe('Koła światła — the session', () => {
  it('turns all twelve true and reaches the full field at good focus in every length, Mendi and HALO', () => {
    for (const eeg of [false, true]) for (const T of LENGTHS) {
      const sim = makeSim({ planned: T, eeg, seed: T });
      const ev = play(sim, player(HIGH));
      expect(sim.trueCount, `${T} ${eeg}`).toBe(12);
      expect(sim.roundsDone, `${T} ${eeg}`).toBe(sim.plan.rounds.length);
      expect(sim.fieldReached, `${T}`).toBe(true);
      expect(ev.some(e => e.type === 'whole'), `${T}`).toBe(true);
      expect(sim.whole, `${T}`).toBeGreaterThan(0.99);
      expect(sim.canStop()).toBe(true);
      sim.finish();
      expect(sim.result().highlights[0]).toBe(t('hl.field'));
    }
  });

  it('turns nothing true without focus: not in rests, not unfocused, not without a signal', () => {
    // focus only in the rests and the field
    const a = makeSim({ planned: 600 });
    play(a, (_t, s) => (s.pushBlock ? LOW : HIGH));
    expect(a.score).toBe(0);
    expect(a.trueCount).toBe(0);
    expect(a.wheels.every(w => w.r.every(r => r.p.every(x => x === 0)))).toBe(true);
    // a high level that is not focused
    const b = makeSim({ planned: 300 });
    play(b, frame({ level: 0.95, focused: false, hold: 0 }));
    expect(b.score).toBe(0);
    // focused, but the signal is unreliable
    const c = makeSim({ planned: 300 });
    play(c, frame({ ...HIGH, reliable: false }));
    expect(c.score).toBe(0);
    // with no focus at all the field still comes (shining faintly), and the summary says the wheels waited
    expect(a.fieldReached).toBe(true);
    expect(a.whole).toBe(0);
    a.finish();
    expect(a.result().highlights).toContain(t('hl.quiet'));
  });

  it('never loses what focus gave (random signal, dips and losses)', () => {
    const rng = mulberry32(3);
    const sim = makeSim({ planned: 900 });
    let last = 0;
    let lastTrue = 0;
    play(sim, () => frame({ reliable: rng() > 0.2, focused: rng() > 0.4, level: rng(), hold: rng() * 20 }), [], 900);
    for (let t = 900; t < 901; t += STEP) {
      sim.update(STEP, LOW, t);
      expect(sim.score).toBeGreaterThanOrEqual(last);
      expect(sim.trueCount).toBeGreaterThanOrEqual(lastTrue);
      last = sim.score;
      lastTrue = sim.trueCount;
    }
    expect(sim.score).toBeGreaterThan(0);
  });

  it('scores in a 40 s test at half focus (app:smoke), Mendi and HALO, first-ever and returning', () => {
    for (const eeg of [false, true]) for (const first of [true, false]) for (const T of [40, 60]) {
      const sim = makeSim({ planned: T, eeg, first });
      play(sim, t => frame({ focused: Math.floor(t / 3) % 2 === 0, level: 0.55, hold: t % 3, calm: 0.3 }));
      expect(sim.score, `${T} ${eeg} ${first}`).toBeGreaterThan(0);
      expect(sim.fieldReached).toBe(true);
    }
  });

  it('brings a wheel true quality by quality, clockwise and even at the end', () => {
    const sim = makeSim({ planned: 900 });
    const ev = play(sim, player(HIGH), [], 200);
    const root = sim.run('root');
    expect(root.r[0].done).toBe(true);
    expect(root.r[0].steps).toHaveLength(5);
    for (const q of ['axis', 'turn', 'petals', 'colour', 'size'] as const) expect(sim.quality(root, q)).toBe(1);
    expect(ev.filter(e => e.type === 'step' && e.wheel === 'root')).toHaveLength(4);
    expect(root.lit[0]).toBe(PETALS.root);
    // a front and its back balance: a pair event once both are true
    const pairs = ev.filter((e): e is Extract<SimEvent, { type: 'pair' }> => e.type === 'pair');
    expect(pairs.map(p => p.centre)).toContain('sacral');
  });

  it('rests after each wheel with the place’s prayer, then its passage', () => {
    const sim = makeSim({ planned: 900 });
    const seen: string[] = [];
    let verse = '';
    play(sim, (_t, s) => {
      if (s.block.what === 'rest' && s.restShows === 'prayer' && !seen.includes(s.prayer)) seen.push(s.prayer);
      if (s.block.what === 'rest' && s.prayFor?.wheel === 'heartB' && s.card) verse = s.card.id;
      return s.pushBlock ? HIGH : LOW;
    }, [], 600);
    expect(seen[0]).toBe(t('pray.root'));
    expect(seen).toContain(t('pray.heartB'));
    expect(verse).toBe(WHEEL_VERSE.heartB);
  });

  it('walks finer rounds in a long session: thanks, then entrusting; the inner ring and the rays', () => {
    const sim = makeSim({ planned: 2700 });
    const prayers = new Set<string>();
    const said: string[] = [];
    play(sim, (_t, s) => {
      if (s.block.what === 'rest' && s.restShows === 'prayer') prayers.add(s.prayer);
      return s.pushBlock ? HIGH : LOW;
    });
    said.push(...sim.talk.said);
    expect(sim.plan.rounds).toHaveLength(3);
    expect(prayers.has(t('thank.heart'))).toBe(true);
    expect(prayers.has(t('offer.crown'))).toBe(true);
    const heart = sim.run('heartF');
    expect(sim.quality(heart, 'inner')).toBe(1);
    expect(sim.quality(heart, 'rays')).toBe(1);
    expect(said.some(s => linesOf('round2').includes(s))).toBe(true);
  });

  it('stays alive at 45 and 60 minutes: no narrator line or prayer comes back within ten minutes, the summary short', () => {
    for (const T of [2700, 3600]) {
      const sim = makeSim({ planned: T, seed: 11 });
      const seen = new Map<string, number>();
      const early: string[] = [];
      let last: unknown = null, lastPrayer = '';
      const focus = model('threshold', T);
      play(sim, (t, s) => {
        const ln = s.talk.line;
        if (ln && ln !== last) {
          const at = seen.get(ln.text);
          if (at !== undefined && t - at < 600) early.push(`${T} ${Math.round(t)} s: "${ln.text}" again after ${Math.round(t - at)} s`);
          seen.set(ln.text, t);
        }
        last = ln;
        if (s.block.what === 'rest' && s.restShows === 'prayer' && s.prayer !== lastPrayer) {
          lastPrayer = s.prayer;
          const at = seen.get(s.prayer);
          if (at !== undefined && t - at < 600) early.push(`${T} ${Math.round(t)} s: prayer again after ${Math.round(t - at)} s`);
          seen.set(s.prayer, t);
        }
        return focus(t, s);
      });
      expect(early, `${T}`).toEqual([]);
      const r = sim.result();
      expect(r.stats.length).toBeLessThanOrEqual(3);
      expect(r.highlights.length).toBeLessThanOrEqual(3);
    }
  });

  it('rests through the valve when a push cannot finish; the wheel keeps its light and waits', () => {
    const sim = makeSim({ planned: 900 });
    const ev: SimEvent[] = [];
    // focus for 4 s past the first push's lead-in, then nothing
    play(sim, (_t, s) => (s.pushBlock && s.block.t0 < s.plan.arriveEnd + 1 && s.blockT > s.lead && s.blockT < s.lead + 4 ? HIGH : LOW), ev, 200);
    const valves = ev.filter(e => e.type === 'block' && e.what === 'rest');
    expect(valves.length).toBeGreaterThan(0);
    expect(sim.talk.said.some(x => linesOf('valve').includes(x))).toBe(true);
    const root = sim.run('root');
    const kept = root.r[0].p.reduce((s, x) => s + x, 0);
    expect(kept).toBeGreaterThan(0);
    expect(root.r[0].done).toBe(false);
  });

  it('keeps the result honest and idempotent, the records only rising, the pace learnt', () => {
    const sim = makeSim({ planned: 600, first: true });
    play(sim, player(HIGH));
    const a = sim.result();
    const b = sim.result();
    expect(a).toEqual(b);
    expect(a.score).toBe(sim.score);
    expect(a.verse).toBe(VERSES.close[0]);
    sim.finish();
    sim.finish();
    expect(sim.p.sessions).toBe(1);
    expect(sim.p.best).toBe(sim.score);
    expect(sim.p.petals).toBe(sim.score);
    expect(sim.p.fields).toBe(1);
    expect(sim.p.wheels).toBe(12);
    expect(sim.p.pace).toBeGreaterThan(0.8);
    // a weaker session later never lowers the best
    const next = makeSim({ planned: 180, progress: { ...sim.p } });
    play(next, LOW);
    next.finish();
    expect(next.p.best).toBe(sim.p.best);
  });
});

// ── the work fits the session ───────────────────────────────────────

describe('Koła światła — the work fits the session (sim grid)', () => {
  it('a threshold player finishes ≥ 90 % at every length once the pace is learnt; a strong one always', () => {
    const rows: string[] = [];
    for (const kind of ['threshold', 'strong'] as const) {
      for (const T of LENGTHS) {
        let p: KolaProgress = freshProgress();
        for (let s = 1; s <= 3; s++) {
          const sim = new KolaSim({ progress: p, rng: mulberry32(s * 31 + T), plannedSec: T, eeg: false, tuning: TUNING });
          sim.start();
          play(sim, model(kind, s * 7 + T));
          const share = workShare(sim);
          sim.finish();
          p = sim.p;
          if (kind === 'strong' || s >= 2) if (share < (kind === 'strong' ? 0.999 : 0.9)) rows.push(`${kind} ${T / 60} min s${s}: ${Math.round(share * 100)} %`);
        }
      }
    }
    expect(rows).toEqual([]);
  });

  it('sizes a step to the pace over the target, with the margin and the bounds', () => {
    expect(needPer(0.6, 20, 4)).toBeCloseTo((0.6 * 20 * RULES.fill) / 4, 6);
    expect(needPer(0.6, 0, 4)).toBe(RULES.needMin);
    expect(needPer(1.4, 500, 1)).toBe(RULES.needMax);
    expect(paceNow(0, 0, 0)).toBe(RULES.paceDef);
    expect(paceNow(0.5, 100, 100)).toBeCloseTo((0.5 * RULES.paceWeight + 100) / (RULES.paceWeight + 100), 6);
    expect(learnPace(0, 10, 20, false)).toBe(0);
    expect(learnPace(0, 30, 50, false)).toBeCloseTo(0.6, 6);
    expect(learnPace(0.4, 50, 50, true)).toBeCloseTo(0.7, 6);
    expect(focusRate(0.9, false, 10)).toBe(0);
    expect(focusRate(0.9, true, 12)).toBeGreaterThan(focusRate(0.55, true, 0));
  });

  it('starts every wheel out of true in its own way, new each session', () => {
    const a = faultOf('heartF', mulberry32(1)), b = faultOf('heartF', mulberry32(2));
    expect(a).not.toEqual(b);
    expect(a.petalLen).toHaveLength(PETALS.heart);
    const spins = WHEEL_IDS.map((id, i) => faultOf(id, mulberry32(100 + i)).spin);
    expect(spins.some(s => s < 0)).toBe(true);
    expect(spins.some(s => s > 1.5 || (s > 0 && s < 0.4))).toBe(true);
    for (const id of WHEEL_IDS) {
      const f = faultOf(id, mulberry32(9));
      expect(f.size < 0.7 || f.size > 1.3).toBe(true);
      expect(f.wobble).toBeGreaterThan(0.4);
    }
  });
});

// ── the progress ────────────────────────────────────────────────────

describe('Koła światła — the progress', () => {
  it('repairs broken and hostile saves', () => {
    const p = migrate({ ver: 1, sessions: 3.7, best: -4, petals: 'x', wheels: 12, fields: 2, pace: 99, posture: 'lie', breath: { in: 99 }, seen: ['a', 'a', 3], lastLen: 600 } as unknown as KolaProgress);
    expect(p.sessions).toBe(3);
    expect(p.best).toBe(0);
    expect(p.petals).toBe(0);
    expect(p.pace).toBe(RULES.paceMax);
    expect(p.posture).toBe('stand');
    expect(p.seen).toEqual(['a']);
    const q = migrate({ sessions: 5, junk: true } as unknown as KolaProgress);
    expect(q).toEqual({ ...freshProgress(), sessions: 5 });
    expect(setPosture(q, 'sit')).toBe(true);
    expect(setPosture(q, 'sit')).toBe(false);
  });
});

// ── the words ───────────────────────────────────────────────────────

const textsOf = (cat: Record<string, unknown>, keep: (k: string) => boolean = () => true): [string, string][] =>
  Object.entries(cat).filter(([k]) => keep(k)).flatMap(([k, m]) => (typeof m === 'string' ? [[k, m]] : Object.values(m as object).map(s => [k, s])) as [string, string][]);
const isKola = (k: string): boolean => k.startsWith('kola.');
const ownTexts = (l: Lang): [string, string][] => [
  ...textsOf(CATALOGS[l]).map(([k, s]) => [`kola.${k}`, s] as [string, string]),
  ...textsOf(ARCADE_TEXTS[l] as Record<string, unknown>, isKola).map(([k, s]) => [`arcade.${k}`, s] as [string, string]),
  ...textsOf(MOUSE_TEXTS[l] as Record<string, unknown>, isKola).map(([k, s]) => [`mouse.${k}`, s] as [string, string]),
];

describe('Koła światła — the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    const pl = CATALOGS.pl as Record<string, unknown>;
    for (const w of WHEELS) expect(pl[`pray.${w.id}`], w.id).toBeTypeOf('string');
    for (const c of CENTRES) for (const k of [`name.${c}`, `gift.${c}`, `thank.${c}`, `offer.${c}`]) expect(pl[k], k).toBeTypeOf('string');
    for (const r of [1, 2, 3] as const) for (const step of stepsOf(r, 9)) for (const q of step) for (const k of [`q.${q}`, `task.${q}`]) expect(pl[k], k).toBeTypeOf('string');
  });

  it('names the wheels as Rzeki żywej wody does, in every language', () => {
    for (const l of LANGS) for (const c of CENTRES) {
      expect((CATALOGS[l] as Record<string, unknown>)[`name.${c}`], `${l} ${c}`).toBe((RZEKI[l] as Record<string, unknown>)[`name.${c}`]);
      expect((CATALOGS[l] as Record<string, unknown>)[`gift.${c}`], `${l} ${c}`).toBe((RZEKI[l] as Record<string, unknown>)[`gift.${c}`]);
    }
  });

  it('keeps every narrator line short, and every moment has its lines', () => {
    for (const l of LANGS) for (const [k, s] of textsOf(CATALOGS[l])) if (k.startsWith('say.')) expect([...s].length, `${l} ${k}`).toBeLessThanOrEqual(90);
    for (const m of MOMENTS) expect(linesOf(m).length, m).toBeGreaterThan(0);
  });

  it('counts petals in Polish with all three forms', () => {
    expect(unit(1)).toBe('płatek');
    expect(unit(3)).toBe('płatki');
    expect(unit(5)).toBe('płatków');
    expect(unit(22)).toBe('płatki');
    expect(t('petals', { n: 128 })).toBe('128 płatków');
    expect(ROUND_PETALS).toBe(128);
  });

  it('has the arcade texts in four languages, with the help lines, the tradition named once and a mouse twin', () => {
    const want = Object.keys(ARCADE_TEXTS.pl).filter(k => k.startsWith('ogrod.')).map(k => k.slice('ogrod.'.length)).sort();
    const TRADITION: Record<Lang, RegExp> = { pl: /czakr/gi, en: /chakra/gi, de: /chakr/gi, sv: /chakra/gi };
    for (const l of LANGS) {
      const a = ARCADE_TEXTS[l] as Record<string, string>;
      const have = Object.keys(a).filter(isKola).map(k => k.slice('kola.'.length)).sort();
      expect(have, l).toEqual(want);
      for (const k of have) expect(a[`kola.${k}`]?.trim(), `${l} kola.${k}`).toBeTruthy();
      expect(a['kola.tip5']).toMatch(l === 'pl' ? /116 123.*116 111.*112/ : l === 'de' ? /0800 111 0 111.*112/ : l === 'sv' ? /90101.*112/ : /emergency number|crisis line/);
      for (const k of ['kola.tip5', 'kola.text']) expect(a[k], `${l} ${k}`).toMatch(/terapi|therapy|Therapie/);
      // the tradition's word once, in the lobby's text only (de and sv keep Rzeki's name "Sakralchakra" for the place)
      expect(a['kola.text'].match(TRADITION[l]), l).toHaveLength(1);
      for (const [k, s] of ownTexts(l)) if (k !== 'arcade.kola.text' && k !== 'kola.name.sacral') expect(s, `${l} ${k}`).not.toMatch(TRADITION[l]);
      expect(a['kola.title']).toBe({ pl: 'Koła światła', en: 'Wheels of Light', de: 'Räder des Lichts', sv: 'Ljusets hjul' }[l]);
    }
    for (const l of LANGS) {
      const a = ARCADE_TEXTS[l] as Record<string, string>, m = MOUSE_TEXTS[l] as Record<string, string>;
      for (const [k, s] of Object.entries(a)) if (isKola(k) && /stukn|\btap\b|tippe|\btryck/i.test(s)) expect(m[k], `${l} ${k}`).toBeTypeOf('string');
    }
    expect((MOUSE_TEXTS.pl as Record<string, string>)['kola.how3']).toMatch(/kliknij/);
  });

  it('speaks of light, prayer and the wheels — no energy, no promise of healing, no magic — in every language', () => {
    const FORBID: Record<Lang, RegExp> = {
      pl: /energi|wibrac|uzdrawia|uzdrow|(?<!\p{L})(u|wy)?lecz(y|ę|ysz)(?!\p{L})|uleczen|kundalini|aktywuj|aktywacj|udrażni|balansuj|magi[aię]|zaklęci|manifest|detoks|rozkręc/iu,
      en: /energy|vibrat|heal|\bcures?\b|kundalini|activat|unblock|\bbalanc(e|ing) (your|the)|\bmagic|\bspell\b|manifest|detox/i,
      de: /energie|schwingung|heil(t|ung|en|e)?\b|kundalini|aktivier|magie|zauber|manifest|entgift|detox/i,
      sv: /energi|vibration|\bhelar\b|helande|läk|kundalini|aktiver|magi|trollformel|manifest|detox/i,
    };
    for (const l of LANGS) for (const [k, s] of ownTexts(l)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
    // the prayer has a Thou: every place's prayer speaks to the Father, through Jesus, in the Spirit
    const THOU: Record<Lang, RegExp> = { pl: /Ojcze.*Jezusa.*Duchu Świętym/, en: /Father.*Jesus.*Holy Spirit/, de: /Vater.*Jesus.*Heiligen Geist/, sv: /Fader.*Jesus.*helige Ande/ };
    for (const l of LANGS) for (const [k, s] of textsOf(CATALOGS[l])) if (/^(pray|thank|offer|prayer)\./.test(k)) expect(s, `${l} ${k}`).toMatch(THOU[l]);
  });

  it('never gives the player a gender in Polish', () => {
    const GENDERED = /\p{L}+(łeś|łaś|łem|łam|łbyś|łabyś|łbym|łabym)(?!\p{L})|(?<!\p{L})(sam|sama|samotny|samotna|gotowy|gotowa|gotów|zraniony|zraniona|kochany|kochana|zmęczony|zmęczona|pewny|pewna|silny|silna)(?!\p{L})|\p{L}+(y|i)\/a(?!\p{L})|\p{L}+\((a|aś|na)\)|(?<!\p{L})(jesteś|jestem|czujesz się|czuję się|zostaniesz|zostanę|będziesz)\s+\p{L}{2,}(ny|na|ty|ta|wy|wa|ły|ła)(?!\p{L})/giu;
    // "sam" said of a thing: the plan fits itself to the length
    const OF_A_THING = /^kola\.rhythm\.note$/;
    const hits: string[] = [];
    for (const [k, s] of ownTexts('pl')) {
      for (const m of s.matchAll(GENDERED)) {
        if (/^sam$/i.test(m[0]) && OF_A_THING.test(k)) continue;
        hits.push(`${k}: "${m[0]}" in ${s}`);
      }
    }
    expect(hits).toEqual([]);
    expect(ownTexts('pl').some(([k, s]) => OF_A_THING.test(k) && /(?<!\p{L})sam(?!\p{L})/u.test(s))).toBe(true);
  });

  it('quotes only verified passages, each in four languages, and turns the closing verse session by session', () => {
    expect(ROOT).toBe('eph4.16');
    for (const id of ALL_VERSES) for (const l of LANGS) {
      const p = passage(id, l);
      expect(p.text.length, `${id} ${l}`).toBeGreaterThan(10);
      expect(p.ref.length, `${id} ${l}`).toBeGreaterThan(2);
    }
    for (const id of ['1co12.12', 'rom12.4-5'] as const) expect(ALL_VERSES).toContain(id);
    expect(verseFor('close', 1)).toBe(VERSES.close[0]);
    expect(verseFor('close', 1 + VERSES.close.length)).toBe(VERSES.close[0]);
  });

  it('stands in the registry after Warstwy światła: a heart practice on Eph 4:16 for Mendi and HALO', async () => {
    const e = arcadeEntry('kola')!;
    expect(e.kind).toBe('heart');
    expect(e.root).toBe('eph4.16');
    expect([...e.tools].sort()).toEqual(['eeg', 'fnirs']);
    expect(e.focusChip).toBe(false);
    expect(e.tuning).toEqual({ adapt: 0.08 });
    expect(e.art).toBe('art-kola');
    expect(ARCADE.findIndex(a => a.id === 'kola')).toBe(ARCADE.findIndex(a => a.id === 'warstwy') + 1);
    const mod = await e.load();
    expect(mod.ownBreath).toBe(true);
    expect(mod.best(freshProgress())).toBe(null);
    expect(howto(true).hands[0].text).toBe(t('howto.tap'));
    expect(howto(false).hands.map(h => h.gesture)).toEqual(['tap', 'keys']);
  });
});

// ── the picture ─────────────────────────────────────────────────────

describe('Koła światła — the figure and the layout', () => {
  it('opens the first wheel down, the seventh up, the others to the front and the back from the spine', () => {
    for (const posture of ['stand', 'sit'] as const) {
      for (const w of WHEELS) {
        const g = wheelGeom(w.id, posture);
        if (w.side === 'down') expect(g.ay).toBeGreaterThan(0.95);
        if (w.side === 'up') expect(g.ay).toBeLessThan(-0.95);
        if (w.side === 'front') expect(g.ax).toBeGreaterThan(0.95);
        if (w.side === 'back') expect(g.ax).toBeLessThan(-0.95);
        // every mouth inside the field's egg
        const e = eggOf(posture);
        const k = ((g.mouth[0] - e.cx) / e.rx) ** 2 + ((g.mouth[1] - e.cy) / e.ry) ** 2;
        expect(k, `${posture} ${w.id}`).toBeLessThan(1);
      }
      for (const c of CENTRES) {
        const b = frameBox(c, posture);
        expect(b.x1 - b.x0).toBeGreaterThan(0.2);
      }
    }
  });

  it('keeps the stage, the name card, the band and the guide on the screen at every checked size', () => {
    const inside = (r: { x: number; y: number; w: number; h: number }, w: number, h: number, ins: { top: number; right: number; bottom: number; left: number }) =>
      r.x >= ins.left - 0.5 && r.y >= ins.top - 0.5 && r.x + r.w <= w - ins.right + 0.5 && r.y + r.h <= h - ins.bottom + 0.5;
    for (const size of CHECK_SIZES) {
      const { w, h, insets } = size;
      const l = layout(w, h, insets);
      const name = `${size.name} (${l.kind})`;
      for (const [k, r] of Object.entries({ stage: l.stage, frame: l.frame, title: l.title, band: l.band })) expect(inside(r, w, h, insets), `${name} ${k} ${JSON.stringify(r)}`).toBe(true);
      expect(l.band.h, name).toBeGreaterThanOrEqual(56);
      expect(l.frame.h, name).toBeGreaterThanOrEqual(60);
      expect(l.font, name).toBeGreaterThanOrEqual(MIN_READ);
      // the guide on the screen, under the band
      const gh = guideHeight(l.guide.r, l.guide.layout);
      expect(l.guide.cy + gh / 2, name).toBeLessThanOrEqual(h - insets.bottom + 2);
      expect(l.guide.cy - l.guide.r, name).toBeGreaterThanOrEqual(l.band.y + l.band.h - 1);
      // the band never over the frame where the wheels stand
      const over = l.band.x < l.frame.x + l.frame.w && l.frame.x < l.band.x + l.band.w && l.band.y < l.frame.y + l.frame.h && l.frame.y < l.band.y + l.band.h;
      expect(over, name).toBe(false);
    }
  });
});

describe('Koła światła — the lobby card', () => {
  it('shows the numbers, the forecast for the lobby’s length, the posture and the breath', () => {
    const p = { ...freshProgress(), sessions: 2, best: 90, petals: 200, fields: 1 };
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    document.body.append(el);
    expect(el.textContent).toContain(t('panel.best'));
    expect(el.textContent).toContain(forecast(p, 300));
    expect(forecast(p, 600)).toBe(t('panel.fc', { min: '10', how: t('grp.12'), rounds: t('rounds', { n: 1 }), steps: t('steps', { n: 4 }), rest: t('breaths', { n: 2 }) }));
    const sit = [...el.querySelectorAll('button')].find(b => b.textContent === t('posture.sit'))!;
    sit.click();
    expect(p.posture).toBe('sit');
    expect(saves).toBe(1);
    el.remove();
  });
});
