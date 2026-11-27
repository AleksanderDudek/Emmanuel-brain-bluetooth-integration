import { describe, expect, it } from 'vitest';
import {
  ALL_VERSES, BODY_PLACES, LABEL_MAX, LINE_COUNT, MARKS, MARK_Y, MOMENTS, PLACES, ROOT, nearestPlace, placePoints, waterY,
} from '../src/arcade/ezechiel/content';
import { CATALOGS, linesOf, t, unit } from '../src/arcade/ezechiel/i18n';
import {
  autoBreaths, bestOf, cleanLabel, freshProgress, migrate, placeAt, restOf, setBreath, setLabel, setRestBreaths, stepBreathOf, togglePlace, type EzechielProgress,
} from '../src/arcade/ezechiel/meta';
import { RULES, curve, finaleFor, mult, planWay, riseCuts } from '../src/arcade/ezechiel/rules';
import { EzechielSim, type SimEvent } from '../src/arcade/ezechiel/sim';
import { ALWAYS } from '../src/arcade/ezechiel/talk';
import { BTN, figRect, hitTest, layout, pickerRect, storyRect, tapTargets } from '../src/arcade/ezechiel/layout';
import { coachText, ezechielRhythm, howto } from '../src/arcade/ezechiel/index';
import { progressPanel } from '../src/arcade/ezechiel/panel';
import { restsIn, rhythmOf } from '../src/arcade/kit/rhythm';
import { BREATH_DEFAULT, BREATH_PRESETS, breathCycle, type BreathPattern } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, auditTargets } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import { FIG_HALF } from '../src/arcade/kit/figure';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.rise', 'c.breath', 'c.place', 'c.blind', 'c.leaf'];

type SimOpts = {
  progress?: Partial<EzechielProgress>; planned?: number; seed?: number; eeg?: boolean;
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
};

function makeSim(o: SimOpts = {}): EzechielSim {
  const sim = new EzechielSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: TUNING,
    rhythm: o.rhythm,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: EzechielSim, sec: number, f: FocusFrame | ((t: number, s: EzechielSim) => FocusFrame), clock = { t: sim.t }, each?: () => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n && sim.phase !== 'done'; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    if (sim.story && sim.story.t > 1) sim.stay();
    each?.();
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Focus in the push blocks from the lead-in on, calm in rest: a player at a steady level. */
const steady = (level: number) => (_t: number, s: EzechielSim): FocusFrame => (s.pushBlock
  ? frame({ level, activity: 3, focused: level >= 0.5, hold: Math.max(0, s.blockT - s.leadIn), calm: 0.2 })
  : frame({ level: 0.3, activity: 0, focused: false, calm: 0.7 }));

/** A player whose activity rises by `amp` % in the push blocks (with the haemodynamic lag), with noise and Mayer waves — the kit's own FocusInput. */
function player(sim: EzechielSim, amp: number, seed: number): void {
  const fi = new FocusInput(TUNING);
  const rnd = mulberry32(seed * 7 + 1);
  let act = 0, noise = 0;
  drive(sim, sim.plannedSec + 10, (tt, s) => {
    act += ((s.pushBlock ? amp : 0) - act) * (1 - Math.exp(-STEP / 4));
    noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
    return fi.push(act + noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
  });
}

describe('the way: the marks, the places, the passages (content.ts)', () => {
  it('raises the water from a trickle at the feet to the ankles, the knees, the hips and a river at the chest', () => {
    expect(MARK_Y).toHaveLength(MARKS + 1);
    for (let i = 1; i < MARK_Y.length; i++) expect(MARK_Y[i]).toBeLessThan(MARK_Y[i - 1]);
    expect(waterY(0)).toBe(MARK_Y[0]);
    expect(waterY(4)).toBe(MARK_Y[4]);
    expect(waterY(2.5)).toBeCloseTo((MARK_Y[2] + MARK_Y[3]) / 2, 6);
    expect(waterY(9)).toBe(MARK_Y[4]);
    expect(waterY(-1)).toBe(MARK_Y[0]);
  });

  it('names every passage it uses by id, each in all four editions, the root Ezekiel 47:9', () => {
    expect(ROOT).toBe('ezk47.9');
    for (const id of ALL_VERSES) {
      for (const l of ['pl', 'en', 'de', 'sv'] as const) {
        const p = passage(id, l);
        expect(p.text.length, `${id} ${l}`).toBeGreaterThan(10);
        expect(p.ref.length).toBeGreaterThan(2);
      }
    }
    for (const id of ['ezk47.1', 'ezk47.3', 'ezk47.4', 'ezk47.5', 'ezk47.12', 'rev22.2', 'psa51.7', 'ezk36.25', 'jer17.14', 'psa147.3', 'exo15.26']) {
      expect(ALL_VERSES).toContain(id);
    }
  });

  it('finds each body place from a tap on it, the pairs on both sides, and nothing far from the figure', () => {
    for (const p of BODY_PLACES) {
      for (const [x, y] of placePoints(p)) expect(nearestPlace(x, y), p).toBe(p);
    }
    expect(placePoints('hands')).toHaveLength(2);
    expect(placePoints('knees')[0][0]).toBeCloseTo(-placePoints('knees')[1][0], 6);
    expect(nearestPlace(0.6, 0.5)).toBeNull();
    expect(BODY_PLACES).not.toContain('matter');
    expect(PLACES).toHaveLength(9);
  });
});

describe('the plan: the whole way fits any length from 3 to 30 minutes (rules.ts)', () => {
  const plan = (P: number, first = false, breath: BreathPattern = BREATH_DEFAULT) => planWay(P, { firstEver: first, eeg: false, breath });

  it('reaches the river and lays a leaf in three minutes; ten and thirty go deeper', () => {
    for (const first of [false, true]) {
      const w = plan(180, first);
      expect(w.steps.filter(s => s.kind === 'rise').reduce((m, s) => Math.max(m, s.to), 0)).toBe(MARKS);
      expect(w.steps.some(s => s.kind === 'trees')).toBe(true);
      expect(w.steps.filter(s => s.kind === 'wash').length).toBeGreaterThanOrEqual(1);
    }
    const w10 = plan(600), w30 = plan(1800), w3 = plan(180);
    expect(w10.steps.filter(s => s.kind === 'rise')).toHaveLength(4);
    expect(w30.steps.filter(s => s.kind === 'wash').length).toBeGreaterThan(w3.steps.filter(s => s.kind === 'wash').length);
    expect(w30.steps.filter(s => s.kind === 'trees').length).toBeGreaterThan(w10.steps.filter(s => s.kind === 'trees').length);
    expect(w30.rest.cycles).toBeGreaterThan(w3.rest.cycles);
    expect(w30.float.sec).toBeGreaterThan(w3.float.sec);
    expect(w30.treeLeaves).toBeGreaterThan(w3.treeLeaves);
  });

  it('cuts the rise into four pushes when there is room, never skipping a mark, and the steps keep their order', () => {
    expect(riseCuts(4)).toEqual([1, 1, 1, 1]);
    expect(riseCuts(2)).toEqual([2, 2]);
    expect(riseCuts(1)).toEqual([4]);
    for (const P of [60, 120, 180, 300, 600, 900, 1200, 1500, 1800]) {
      for (const breath of Object.values(BREATH_PRESETS)) {
        const w = plan(P, false, breath);
        let level = 0, seen = 0;
        for (const s of w.steps) {
          if (s.kind === 'rise') {
            expect(s.from).toBe(level);
            level = s.to;
          } else expect(level, `${P}`).toBe(MARKS);
          const rank = s.kind === 'rise' ? 0 : s.kind === 'wash' ? 1 : 2;
          expect(rank).toBeGreaterThanOrEqual(seen);
          seen = rank;
          expect(s.work).toBeGreaterThanOrEqual(RULES.minWork);
        }
        expect(level).toBe(MARKS);
        // the planned pushes, rests and the end fit the session
        const fixed = finaleFor(P) + w.float.sec;
        expect(w.steps.length * w.pushSec + (w.steps.length - 1) * w.rest.sec + fixed, `${P}`).toBeLessThanOrEqual(Math.max(P, w.pushSec + fixed) + 1e-6);
      }
    }
  });

  it('gives a rest the player’s own number of breaths when set', () => {
    const w = planWay(600, { firstEver: false, eeg: false, breath: BREATH_PRESETS.box, restBreaths: 3 });
    expect(w.rest).toEqual({ cycles: 3, sec: 48 });
    expect(curve([1, 2, 3], 100)).toBe(1);
    expect(curve([1, 2, 3], 390)).toBeCloseTo(1.5, 6);
    expect(curve([1, 2, 3], 9999)).toBe(3);
  });
});

describe('light only from real focus: the water rises only while focus is held', () => {
  it('stands still in rest, in the lead-in, without a signal and below the threshold — and moves with focus', () => {
    const sim = later();
    drive(sim, sim.leadIn - 0.2, HIGH);
    expect(sim.water).toBe(0);
    const w0 = sim.water;
    drive(sim, 6, LOW);
    expect(sim.water).toBe(w0);
    drive(sim, 6, NONE);
    expect(sim.water).toBe(w0);
    drive(sim, 4, HIGH);
    expect(sim.water).toBeGreaterThan(w0);
    expect(sim.rising).toBe(true);
    // taps never move it
    const w1 = sim.water;
    for (let i = 0; i < 20; i++) sim.stay();
    drive(sim, 0.5, LOW);
    expect(sim.water).toBe(w1);
  });

  it('never lets the water fall, the dust come back or the leaves go, whatever the signal does', () => {
    for (const seed of [1, 2, 3]) {
      const sim = later({ planned: 600, seed });
      const rnd = mulberry32(seed + 40);
      let water = 0, dust = 1, leaves = 0;
      drive(sim, 600, () => {
        const r = rnd();
        return r < 0.2 ? NONE : r < 0.55 ? HIGH : r < 0.75 ? LOW : CALM;
      }, { t: 0 }, () => {
        expect(sim.water).toBeGreaterThanOrEqual(water - 1e-9);
        const d = Math.max(sim.dust.above, sim.dust.below);
        expect(d).toBeLessThanOrEqual(dust + 1e-9);
        expect(sim.leaves).toBeGreaterThanOrEqual(leaves);
        water = sim.water;
        dust = d;
        leaves = sim.leaves;
      });
    }
  });

  it('rests by the safety valve when focus never comes, keeps what it gained, and ends on time', () => {
    const sim = later({ planned: 300 });
    const evs = drive(sim, 310, LOW);
    expect(sim.water).toBe(0);
    expect(sim.leaves).toBe(0);
    expect(sim.valves).toBeGreaterThanOrEqual(2);
    expect(ofType(evs, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.result().highlights.some(h => /czekała/.test(h))).toBe(true);
  });

  it('lets a strong focus finish a push in about its planned length, and lays the measuring line at each mark', () => {
    const sim = later({ planned: 600 });
    const evs = drive(sim, 200, steady(0.75));
    const marks = ofType(evs, 'mark').map(e => e.mark);
    expect(marks).toEqual([1, 2, 3, 4]);
    const rests = ofType(evs, 'blockStart').filter(e => e.block.kind === 'rest').map(e => e.block.why);
    expect(rests.slice(0, 4)).toEqual(['mark', 'mark', 'mark', 'mark']);
  });
});

describe('the blocks go by the water: a rest of whole breaths after every step', () => {
  it('rests in whole breaths of the player’s pattern, and the telegraph comes before every turn', () => {
    for (const breath of Object.values(BREATH_PRESETS)) {
      const sim = later({ planned: 900, progress: { breath: { ...breath } } });
      const evs = drive(sim, 600, steady(0.7));
      const rests = ofType(evs, 'blockStart').filter(e => e.block.kind === 'rest');
      expect(rests.length).toBeGreaterThan(3);
      for (const r of rests) {
        expect(r.block.dur / breathCycle(breath)).toBeCloseTo(r.block.cycles, 6);
        expect(r.block.cycles).toBeGreaterThanOrEqual(1);
      }
      expect(ofType(evs, 'telegraph').length).toBeGreaterThanOrEqual(rests.length);
    }
  });

  it('washes the dust in passes and lays a leaf after each trees push, on the chosen places in turn', () => {
    const sim = later({ planned: 900, progress: { places: ['knees', 'heart'] } });
    const evs = drive(sim, 900, steady(0.75));
    expect(sim.passes).toBe(sim.washes);
    expect(sim.dust.above).toBe(0);
    const lays = ofType(evs, 'lay');
    expect(lays.length).toBeGreaterThanOrEqual(3);
    expect(lays.slice(0, 4).map(l => l.place)).toEqual(['knees', 'heart', 'knees', 'heart'].slice(0, Math.min(4, lays.length)));
    expect(sim.fruits).toBeGreaterThanOrEqual(1);
  });

  it('lets the player choose the next leaf’s place, and turn the leaf on its way to another place', () => {
    const sim = later({ planned: 600 });
    drive(sim, 2, LOW);
    expect(sim.choose('feet')).toBe(true);
    expect(sim.nextPlace).toBe('feet');
    // run until the first leaf is laid, then turn it while it is on its way
    let guard = 0;
    while (!sim.laid.length && guard++ < 20000) drive(sim, 0.2, steady(0.8));
    expect(sim.laid[0].place).toBe('feet');
    expect(sim.choose('hands')).toBe(true);
    expect(sim.laid[0].place).toBe('hands');
    expect(sim.choose('nowhere' as never)).toBe(false);
  });

  it('veils a blind push in mist: the water goes on unseen and shows when the mist lifts', () => {
    const sim = later({ planned: 900, progress: { sessions: 5, pushes: 2 } });
    let guard = 0;
    while (!sim.blind && guard++ < 6000) drive(sim, 0.1, steady(0.8));
    expect(sim.blind).toBe(true);
    const k0 = sim.stepK;
    drive(sim, sim.leadIn + 4, steady(0.8));
    expect(sim.stepK).toBe(k0);
    expect(sim.meter()).toBeNull();
    const evs = drive(sim, 40, steady(0.8));
    const end = ofType(evs, 'blindEnd');
    expect(end.length).toBeGreaterThanOrEqual(1);
    expect(end[0].gained).toBeGreaterThan(0);
  });

  it('opens with the threshold the first time: a card of two pages, a warm-up without progress', () => {
    const sim = makeSim({ planned: 300 });
    expect(sim.firstEver).toBe(true);
    expect(sim.block.kind).toBe('warmup');
    expect(sim.story?.pages).toBe(2);
    expect(sim.stage).toBe('prog');
    drive(sim, 10, HIGH);
    expect(sim.water).toBe(0);
  });
});

describe('the whole arc fits the session: an average player through 3, 10 and 30 minutes', () => {
  it('completes the way near the end, not at 40 %, then floats and ends on time', () => {
    for (const P of [180, 600, 1800]) {
      for (const seed of [1, 2]) {
        for (const amp of [1, 2]) {
          const sim = later({ planned: P, seed });
          const evs: SimEvent[] = [];
          const fi = new FocusInput(TUNING);
          const rnd = mulberry32(seed * 7 + 1);
          let act = 0, noise = 0, floatAt = -1;
          drive(sim, P + 10, (tt, s) => {
            act += ((s.pushBlock ? amp : 0) - act) * (1 - Math.exp(-STEP / 4));
            noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
            return fi.push(act + noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
          }, { t: 0 }, () => {
            for (const e of sim.take()) evs.push(e);
            if (floatAt < 0 && sim.floatK > 0.05) floatAt = sim.t;
          });
          const label = `${P}s seed ${seed} amp ${amp}`;
          expect(sim.arcAt, label).toBeGreaterThan(0.6 * P);
          expect(sim.arcAt, label).toBeLessThan(0.95 * P);
          expect(sim.markReached, label).toBe(MARKS);
          expect(sim.laid.length, label).toBeGreaterThanOrEqual(1);
          expect(floatAt, label).toBeGreaterThan(0.75 * P);
          expect(sim.phase, label).toBe('done');
          expect(sim.t, label).toBeLessThanOrEqual(P + 0.1);
        }
      }
    }
  });

  it('keeps the summary short at 30 minutes: one line per kind, a few highlights, bounded collections', () => {
    const sim = later({ planned: 1800, seed: 3 });
    player(sim, 3, 3);
    const r = sim.result();
    expect(r.stats).toHaveLength(6);
    for (const [, v] of r.stats) expect(v.length, v).toBeLessThanOrEqual(10);
    expect(r.highlights.length).toBeLessThanOrEqual(5);
    for (const h of r.highlights) expect(h.length).toBeLessThan(90);
    expect(sim.laid.length).toBeGreaterThan(10);
    expect(sim.laidLine().split(',').length).toBeLessThanOrEqual(3);
    expect(sim.fruits).toBe(RULES.fruitsMax);
    expect(sim.talk.said.length).toBeLessThan(400);
  });

  it('with no rise at all, nothing grows: the water waits at the feet, the valve rests, the river still flows on at the end', () => {
    for (const P of [180, 600]) {
      const sim = later({ planned: P });
      player(sim, 0, 1);
      expect(sim.water).toBe(0);
      expect(sim.leaves).toBe(0);
      expect(sim.valves).toBeGreaterThanOrEqual(1);
      expect(sim.phase).toBe('done');
      expect(sim.farK).toBeGreaterThan(0.5);
    }
  });
});

describe('the session’s numbers', () => {
  it('reports the leaves, the water, the leaves laid — idempotent, records with Math.max, settled once', () => {
    const p = { ...freshProgress(), sessions: 5, seen: [...ALL_SEEN] };
    const sim = new EzechielSim({ progress: p, rng: mulberry32(2), plannedSec: 300, eeg: true, tuning: TUNING });
    sim.start();
    drive(sim, 305, steady(0.8));
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(a.score).toBe(sim.leaves);
    expect(a.unit).toBe(unit(sim.leaves));
    expect(a.verse).toBeTruthy();
    expect(p.sessions).toBe(6);
    expect(p.leaves).toBe(sim.leaves);
    expect(bestOf(p)).toBe(sim.leaves);
    expect(p.deepest).toBe(4);
    expect(p.rivers).toBe(1);
    sim.finish();
    expect(p.sessions).toBe(6);
  });

  it('speaks to the runner: focus in a push, rest in a rest, a meter only when sighted', () => {
    const sim = later();
    expect(sim.pushBlock).toBe(true);
    drive(sim, sim.leadIn + 1, HIGH);
    expect(sim.meter()).not.toBeNull();
    expect(sim.padLevel(HIGH)).not.toBeNull();
    drive(sim, 1, NONE);
    expect(sim.meter()).toBeNull();
    expect(mult(0.5, 0)).toBeCloseTo(1, 6);
    expect(mult(1, 40)).toBeCloseTo(1.5, 6);
  });
});

describe('the meta: places, the label, the breath (meta.ts)', () => {
  it('repairs any save and keeps at least one place', () => {
    const bad = { ver: 1, sessions: 'x', places: ['heart', 'liver', 'heart', 7], label: 42, breath: { in: 99 }, laid: { heart: -3, knees: 2.7 }, best: { 300: 'a', 600: 12 } } as unknown as EzechielProgress;
    migrate(bad);
    expect(bad.sessions).toBe(0);
    expect(bad.places).toEqual(['heart']);
    expect(bad.label).toBe('');
    expect(bad.breath.in).toBe(15);
    expect(bad.laid.heart).toBe(0);
    expect(bad.laid.knees).toBe(2);
    expect(bad.best).toEqual({ 600: 12 });
    const old = { ver: 0, sessions: 3, pushes: 9, junk: 1 } as unknown as EzechielProgress;
    migrate(old);
    expect(old.sessions).toBe(3);
    expect((old as unknown as Record<string, unknown>).junk).toBeUndefined();
    expect(migrate(migrate(freshProgress()))).toEqual(freshProgress());
  });

  it('toggles places but never empties the list, takes them in turn', () => {
    const p = freshProgress();
    expect(togglePlace(p, 'heart')).toBe(false);
    expect(togglePlace(p, 'knees')).toBe(true);
    expect(togglePlace(p, 'heart')).toBe(true);
    expect(p.places).toEqual(['knees']);
    expect(togglePlace(p, 'nope')).toBe(false);
    togglePlace(p, 'matter');
    expect([0, 1, 2, 3].map(n => placeAt(p, n))).toEqual(['knees', 'matter', 'knees', 'matter']);
  });

  it('keeps a matter of the heart to 40 characters on one line', () => {
    expect(cleanLabel('  pojednanie\n z bratem  ')).toBe('pojednanie z bratem');
    expect([...cleanLabel('x'.repeat(80))]).toHaveLength(LABEL_MAX);
    expect([...cleanLabel('🌿'.repeat(50))]).toHaveLength(LABEL_MAX);
    const p = freshProgress();
    expect(setLabel(p, 'mama')).toBe(true);
    expect(setLabel(p, 'mama')).toBe(false);
  });

  it('sets the breath, refuses one too short, and counts the rest in whole breaths', () => {
    const p = freshProgress();
    expect(setBreath(p, BREATH_PRESETS.box)).toBe(true);
    expect(restOf(p, 600).sec % 16).toBe(0);
    expect(setBreath(p, { in: 1, holdIn: 0, out: 0, holdOut: 0 })).toBe(false);
    const q = freshProgress();
    q.breath = { in: 1, holdIn: 0, out: 1, holdOut: 0 };
    expect(stepBreathOf(q, 'in', -1)).toBe(false);
    setRestBreaths(q, 30);
    expect(q.restBreaths).toBe(RULES.restBreathsMax);
    setRestBreaths(q, 0);
    // 30 minutes: two breaths (round 15: 24 s aimed at, it was 30 — three)
    expect(autoBreaths(freshProgress(), 1800)).toBe(2);
  });
});

describe('the words (i18n.ts)', () => {
  it('has every text in four languages with the same placeholders, three lines a moment, each a caption', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    for (const m of MOMENTS) expect(linesOf(m)).toHaveLength(LINE_COUNT);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('talk.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
    expect(unit(1)).toBe('liść');
    expect(unit(5)).toBe('liści');
    expect(t('leaves', { n: 3 })).toBe('3\u00a0liście');
  });

  it('speaks of water, light and prayer — no energy, no healing power, no chakras (the lobby’s origin note aside)', () => {
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
      for (const [k, v] of Object.entries(ARCADE_TEXTS[l])) if (k.startsWith('ezechiel.') && k !== 'ezechiel.text') all.push([k, v as string]);
      for (const [k, v] of Object.entries(MOUSE_TEXTS[l] ?? {})) if (k.startsWith('ezechiel.') && k !== 'ezechiel.text') all.push([k, v as string]);
      for (const [k, s] of all) {
        expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
        expect(s, `${l}.${k}`).not.toMatch(VERBS[l]);
        if (/^(tip|howto)\./.test(k)) expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
      // the lobby's text: its last sentence is the origin note (it names the source once); the rest speaks of water and prayer
      const text = ARCADE_TEXTS[l]['ezechiel.text'] as string;
      const sentences = text.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻÄÖÜÅ])/);
      expect(sentences.length).toBeGreaterThan(2);
      expect(sentences[sentences.length - 1]).toMatch(/Simonton/);
      expect(sentences.slice(0, -1).join(' ')).not.toMatch(FORBID[l]);
    }
    // the how-to's last tip and the registry's last tip: attention, not treatment
    expect(t('howto.tip2')).toMatch(/mierzy uwagę/);
    expect(t('howto.tip2')).toMatch(/nie leczenie/);
    expect(ARCADE_TEXTS.pl['ezechiel.tip5']).toMatch(/nie leczenie/);
    // the prayer at the leaf is a prayer, and names no promise
    expect(t('pray.lay')).toBe('Panie, Ty znasz to miejsce. Dotknij go.');
  });

  it('keeps Polish letters out of the other languages, never “Gott mit uns”, a no-break space before a unit', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźż]/i);
          expect(s, `${l}.${k}`).not.toMatch(/Gott mit uns/);
        }
      }
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const k of ['secs', 'br.in', 'br.out'] as const) expect(CATALOGS[l][k] as string, `${l}.${k}`).toMatch(/ s/);
    }
  });

  it('speaks to the hand the player has: a finger never hears of keys', () => {
    const touch = howto(true), keys = howto(false);
    expect(touch.hands.every(hd => hd.gesture !== 'keys')).toBe(true);
    expect(keys.hands.some(hd => hd.gesture === 'keys')).toBe(true);
    expect(touch.tips!.length).toBeLessThanOrEqual(2);
    expect(coachText('place', true)).not.toMatch(/klik|\(M\)/i);
    expect(coachText('place', false)).toMatch(/Kliknij/);
    expect(touch.hands[0].text).toMatch(/^Stuknij/);
    expect(keys.hands[0].text).toMatch(/^Kliknij/);
  });
});

describe('mobile first, then the desk (layout.ts)', () => {
  it('keeps every target finger-sized, inside the insets and clear of the others at every checked size', () => {
    for (const sz of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(sz.w, sz.h, sz.insets, touch);
        for (const lift of [0, 0.06]) expect(auditTargets(tapTargets(L, { story: null, picker: false, lift }), sz.w, sz.h, L.ins), `${sz.name}`).toEqual([]);
        expect(auditTargets(tapTargets(L, { story: null, picker: true }), sz.w, sz.h, L.ins), `${sz.name} picker`).toEqual([]);
        expect(auditTargets(tapTargets(L, { story: storyRect(L, 240), picker: false }), sz.w, sz.h, L.ins), `${sz.name} story`).toEqual([]);
        expect(pickerRect(L).chips.every(c => c.r.h >= MIN_TAP)).toBe(true);
      }
    }
  });

  it('stands the figure inside the picture, below the HUD band, and the words band inside the insets', () => {
    for (const sz of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(sz.w, sz.h, sz.insets, touch);
        const label = `${sz.name} ${touch}`;
        expect(L.fig.top, label).toBeGreaterThanOrEqual(L.top - 0.5);
        expect(L.fig.top + L.fig.H, label).toBeLessThanOrEqual(L.stage.y + L.stage.h + 0.5);
        expect(L.fig.cx - FIG_HALF * L.fig.H, label).toBeGreaterThanOrEqual(L.stage.x - 0.5);
        expect(L.fig.cx + FIG_HALF * L.fig.H, label).toBeLessThanOrEqual(L.list.x + 0.5);
        expect(L.band.y, label).toBeGreaterThanOrEqual(sz.insets.top - 0.5);
        expect(L.band.y + L.band.h, label).toBeLessThanOrEqual(sz.h - sz.insets.bottom + 0.5);
        expect(L.band.x, label).toBeGreaterThanOrEqual(sz.insets.left - 0.5);
        expect(L.band.x + L.band.w, label).toBeLessThanOrEqual(sz.w - sz.insets.right + 0.5);
        expect(L.band.h, label).toBeGreaterThanOrEqual(110);
        expect(L.fig.H, label).toBeGreaterThan(160);
        expect(L.list.w).toBeGreaterThanOrEqual(BTN);
      }
    }
  });

  it('reads at 13 px and more (15 for the prayer); phones upright are tall, desks put the words beside the valley', () => {
    for (const sz of CHECK_SIZES) {
      const L = layout(sz.w, sz.h, sz.insets, true);
      expect(L.font.prayer).toBeGreaterThanOrEqual(15);
      for (const k of ['label', 'now', 'verse', 'chip'] as const) expect(L.font[k]).toBeGreaterThanOrEqual(MIN_READ);
      expect(L.font.small).toBeGreaterThanOrEqual(11);
      if (sz.h > sz.w) expect(L.shape).toBe('tall');
    }
    const desk = layout(1190, 960, { top: 98, right: 0, bottom: 0, left: 0 }, false);
    expect(desk.shape).toBe('desk');
    expect(desk.band.x).toBeGreaterThan(desk.fig.cx + 0.3 * desk.fig.H);
    expect(desk.band.w).toBeLessThanOrEqual(19 * desk.font.prayer + 1);
  });

  it('tells a tap on the figure which place it chose, on the ≡, on a chip, outside the chooser', () => {
    const L = layout(390, 844, { top: 173, right: 0, bottom: 34, left: 0 }, true);
    const at = (x: number, y: number) => ({ x: L.fig.cx + x * L.fig.H, y: L.fig.top + y * L.fig.H });
    const k = placePoints('knees')[0], h = placePoints('head')[0];
    let p = at(k[0], k[1]);
    expect(hitTest(L, { story: null, picker: false }, p.x, p.y)).toBe('figure:knees');
    p = at(h[0], h[1]);
    expect(hitTest(L, { story: null, picker: false }, p.x, p.y)).toBe('figure:head');
    expect(hitTest(L, { story: null, picker: false }, L.list.x + 10, L.list.y + 10)).toBe('list');
    const P = pickerRect(L);
    expect(hitTest(L, { story: null, picker: true }, P.chips[7].r.x + 5, P.chips[7].r.y + 5)).toBe(`chip:${PLACES[7]}`);
    expect(hitTest(L, { story: null, picker: true }, 2, L.h - 2)).toBe('outside');
    const fr = figRect(L);
    expect(fr.w).toBeGreaterThanOrEqual(MIN_TAP);
  });
});

describe('the rest’s rhythm, set in the lobby (round 15, kit/rhythm.ts)', () => {
  it('offers one step of 20–90 s (30 by design) and the rest after it in whole breaths of the player’s pattern (2)', () => {
    const spec = ezechielRhythm(freshProgress());
    expect(spec.focus).toMatchObject({ def: RULES.focusDef, min: RULES.focusMin, max: RULES.focusMax, step: 5, name: 'Jeden krok' });
    expect(spec.rest).toMatchObject({ def: RULES.restDef, min: 1, max: RULES.restBreathsMax, name: 'Odpoczynek' });
    expect(spec.rest.format(2)).toBe('2\u00a0oddechy · 20\u00a0s');
    expect(ezechielRhythm({ ...freshProgress(), breath: { ...BREATH_PRESETS.box } }).restSec!(2)).toBe(32);
    const n = restsIn(spec, rhythmOf(spec, undefined)!, 600)!;
    expect(n.rests).toBe(12);
    expect(n.share).toBeCloseTo(20 / 50, 2);
  });

  it('plans the way with the player’s step and rest when a dial moved, by its curves as designed', () => {
    const design = later({ planned: 600, rhythm: { focus: 30, rest: 2, custom: false } });
    expect(design.way).toEqual(planWay(600, { firstEver: false, eeg: false, breath: BREATH_DEFAULT, restBreaths: 0 }));
    const long = later({ planned: 600, rhythm: { focus: 60, rest: 4, custom: true } });
    expect(long.way.pushSec).toBe(60);
    expect(long.way.rest).toEqual({ cycles: 4, sec: 40 });
    expect(long.way.steps.length).toBeLessThan(design.way.steps.length);
    expect(long.valveMax).toBeGreaterThanOrEqual(90);
    // the old panel's count of breaths is read only without the lobby's rhythm (a test, an old runner)
    const old = later({ planned: 600, progress: { restBreaths: 5 } });
    expect(old.way.rest.cycles).toBe(5);
    const now = later({ planned: 600, progress: { restBreaths: 5 }, rhythm: { focus: 30, rest: 2, custom: false } });
    expect(now.way.rest.cycles).toBe(design.way.rest.cycles);
  });

  it('reaches the river near the end of 3, 10 and 30 minutes with the dials at their extremes (an average player)', () => {
    for (const P of [180, 600, 1800]) {
      for (const rhythm of [{ focus: RULES.focusMin, rest: 1 }, { focus: RULES.focusMax, rest: 6 }, { focus: 45, rest: 3 }]) {
        const sim = later({ planned: P, seed: 2, rhythm: { ...rhythm, custom: true } });
        const fi = new FocusInput(TUNING);
        const rnd = mulberry32(15);
        let act = 0, noise = 0;
        const evs = drive(sim, P + 10, (tt, s) => {
          act += ((s.pushBlock ? 2 : 0) - act) * (1 - Math.exp(-STEP / 4));
          noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
          return fi.push(act + noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
        }, { t: 0 });
        const label = `${P}s ${JSON.stringify(rhythm)}`;
        expect(sim.phase, label).toBe('done');
        expect(sim.markReached, label).toBeGreaterThanOrEqual(P >= 600 || rhythm.focus < 60 ? MARKS : 2);
        if (P >= 600) {
          expect(sim.arcAt, label).toBeGreaterThan(0.5 * P);
          expect(sim.arcAt, label).toBeLessThan(0.97 * P);
        }
        // every rest after a step is the player's count of breaths (the floating rest at the end is the way's own)
        const rests = ofType(evs, 'blockStart').map(e => e.block).filter(x => x.kind === 'rest' && !x.last && x.why !== 'valve' && x.why !== 'float');
        expect(rests.length, label).toBeGreaterThan(0);
        for (const b of rests) expect(b.cycles, label).toBe(rhythm.rest);
      }
    }
  });

  it('leaves the breaths in a rest to the lobby’s Rytm row: the card keeps the pattern and says where the rest is set', () => {
    const p = freshProgress();
    const root = progressPanel(p, () => undefined);
    const text = root.textContent ?? '';
    expect(text).toContain('Jeden oddech: 10\u00a0s');
    expect(text).toContain('„Rytm”');
    expect(text).not.toContain('auto');
  });
});

describe('45–60 minutes (round 24)', () => {
  it('the plan to its finale: the rise, three washings, then the trees — every push fitting the session', () => {
    for (const P of [2700, 3600]) {
      for (const breath of Object.values(BREATH_PRESETS)) {
        const w = planWay(P, { firstEver: false, eeg: false, breath });
        const kinds = (k: string) => w.steps.filter(x => x.kind === k).length;
        expect(kinds('rise'), `${P}`).toBe(4);
        expect(kinds('wash'), `${P}`).toBe(3);
        // more trees than half an hour holds: the leaves go on, the way's arc stays (the rise, the washings)
        expect(kinds('trees'), `${P}`).toBeGreaterThan(planWay(1800, { firstEver: false, eeg: false, breath }).steps.filter(x => x.kind === 'trees').length);
        const fixed = finaleFor(P) + w.float.sec;
        expect(w.steps.length * w.pushSec + (w.steps.length - 1) * w.rest.sec + fixed, `${P}`).toBeLessThanOrEqual(P + 1e-6);
        // the longest session's curve: the push and the rests as at half an hour
        expect(w.pushSec).toBe(planWay(1800, { firstEver: false, eeg: false, breath }).pushSec);
      }
    }
  });

  it('a whole headless hour: the arc near the end, then the float; bounded, a short summary, the rosette of leaves held', () => {
    for (const P of [2700, 3600]) {
      for (const amp of [1, 2]) {
        const sim = later({ planned: P, seed: 2 });
        let floatAt = -1;
        const fi = new FocusInput(TUNING);
        const rnd = mulberry32(9);
        let act = 0, noise = 0;
        drive(sim, P + 10, (tt, s) => {
          act += ((s.pushBlock ? amp : 0) - act) * (1 - Math.exp(-STEP / 4));
          noise += ((rnd() - 0.5) * 1.6 - noise) * (1 - Math.exp(-STEP / 1.5));
          return fi.push(act + noise + 0.5 * Math.sin(tt * 2 * Math.PI * 0.1), true, STEP);
        }, { t: 0 }, () => { sim.take(); if (floatAt < 0 && sim.floatK > 0.05) floatAt = sim.t; });
        const tag = `${P}s amp ${amp}`;
        expect(sim.phase, tag).toBe('done');
        expect(sim.t, tag).toBeLessThanOrEqual(P + 0.1);
        expect(sim.arcAt, tag).toBeGreaterThan(0.6 * P);
        expect(sim.arcAt, tag).toBeLessThan(0.95 * P);
        expect(floatAt, tag).toBeGreaterThan(0.75 * P);
        expect(sim.markReached, tag).toBe(MARKS);
        expect(sim.fruits, tag).toBe(RULES.fruitsMax);
        expect(sim.laid.length, tag).toBeGreaterThan(30);
        expect(sim.laid.length, tag).toBeLessThan(120);
        expect(sim.talk.said.length, tag).toBeLessThan(600);
        const r = sim.result();
        expect(r.stats, tag).toHaveLength(6);
        for (const [, v] of r.stats) expect(v.length, v).toBeLessThanOrEqual(10);
        expect(r.highlights.length, tag).toBeLessThanOrEqual(5);
        for (const h of r.highlights) expect(h.length, h).toBeLessThan(90);
        expect(sim.laidLine().split(',').length).toBeLessThanOrEqual(3);
      }
    }
    // the rosette round a place grows up to what half an hour lays there, then holds its size
    const half = later({ planned: 1800, seed: 3 });
    player(half, 4, 3);
    expect(half.laid.length).toBeLessThanOrEqual(RULES.laidRing);
  });

  it('an hour’s narrator: no line again within ten minutes, still speaking in the last quarter; half an hour as before', () => {
    expect(later({ planned: 1800 }).talk.fresh).toBe(0);
    expect(later({ planned: 2700 }).talk.fresh).toBe(RULES.talkFresh);
    const sim = later({ planned: 3600, seed: 2 });
    const lines: [number, string, string][] = [];
    let last: unknown = null;
    const clock = { t: 0 };
    drive(sim, 3610, steady(0.7), clock, () => {
      sim.take();
      const l = sim.talk.line;
      if (l && l !== last) { last = l; lines.push([clock.t, l.moment, l.text]); }
    });
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
