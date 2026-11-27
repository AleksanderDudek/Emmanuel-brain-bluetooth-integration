import { describe, expect, it } from 'vitest';
import {
  ALL_VERSES, ARCS, BLESS_LINES, MORE_VERSES, RINGS, VERSES, WAY, cleanName, cleanOwn, heartWord, pushTip, stageOf, stageRing, stageTitle, verseFor,
} from '../src/arcade/serce/content';
import { CATALOGS, breathWords, t, unit } from '../src/arcade/serce/i18n';
import {
  bestOf, clearStart, freshProgress, migrate, namesCount, setBreath, setNames, setSkip4, setStageSec, skip4Today, startStage, type SerceProgress,
} from '../src/arcade/serce/meta';
import {
  PLACE_AT, closeMin, forecast, leadOf, reentrySec, restNeed, restSeq, stageCap, stageLen, stagePlan, stageSeconds,
  type PushStep, type RestStep, type StagePlan,
} from '../src/arcade/serce/plan';
import { RULES, focusRate, lampsFor, readTime } from '../src/arcade/serce/rules';
import { SerceSim, linesOf, pageTime, secText, type SimEvent, type StageRun } from '../src/arcade/serce/sim';
import { ALWAYS } from '../src/arcade/serce/talk';
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
import { howto, serceRhythm } from '../src/arcade/serce/index';
import { restsIn, rhythmOf } from '../src/arcade/kit/rhythm';
import { forecastLine, progressPanel } from '../src/arcade/serce/panel';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const DAY = '2026-11-22';
const EVEN = BREATH_PRESETS.even;
const CYC = breathCycle(EVEN);
const LENS = RULES.stageLens;
/** a stage still starts with this much left before the close (s) */
const FLOOR = RULES.stageFloor - RULES.stageSlack;

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.5 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['s.open', 'c.light', 'c.breath', 'c.tap', 'c.ring4', 'c.names'];

type SimOpts = {
  progress?: Partial<SerceProgress>; planned?: number; seed?: number; eeg?: boolean; day?: string;
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
};

function makeSim(o: SimOpts = {}): SerceSim {
  const sim = new SerceSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false,
    tuning: TUNING, day: o.day ?? DAY, rhythm: o.rhythm,
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

/** The way stages a session ran (not the re-entry, the "more" stages or the close). */
const wayRuns = (sim: SerceSim): StageRun[] => sim.runs.filter(r => r.kind !== 'reentry' && r.kind !== 'more' && r.kind !== 'close');
const sp = (kind: (typeof WAY)[number] | 'more', min: number, o: Partial<Parameters<typeof stagePlan>[0]> = {}): StagePlan =>
  stagePlan({ kind, way: kind === 'more' ? null : WAY.indexOf(kind), min, push: RULES.pushDial.def, breaths: RULES.restBreathsDef, pattern: EVEN, eeg: false, session: 1, arc: 'lonely', ...o });
const pushes = (p: StagePlan) => p.steps.filter((s): s is PushStep => s.kind === 'push');
const rests = (p: StagePlan) => p.steps.filter((s): s is RestStep => s.kind === 'rest');
const fc = (T: number, o: Partial<Parameters<typeof forecast>[0]> = {}) =>
  forecast({ plannedSec: T, stageSec: RULES.stageDef, next: 0, firstEver: false, skip4: false, pattern: EVEN, eeg: false, ...o });

// ── the stages ──────────────────────────────────────────────────

describe('the way in nine stages (plan.ts)', () => {
  it('names the nine stages in order, each with its title card', () => {
    expect(WAY).toEqual(['descent', 'heart', 'field', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun']);
    expect(WAY.map((_, i) => stageTitle(i))).toEqual([
      'Zejście', 'Serce', 'Krąg 0 — Ja', 'Krąg 1 — Rodzina', 'Krąg 2 — Przyjaciele', 'Krąg 3 — Ludzie, których spotykam',
      'Krąg 4 — Ci, którzy mnie zranili', 'Krąg 5 — Cały świat', 'Jedno słońce i cała szerokość',
    ]);
    expect(`${stageOf(3)} · ${stageTitle(3)}`).toBe('Etap 4 z 9 · Krąg 1 — Rodzina');
  });

  it('walks each stage’s light whole, in order, and ends it with its closing blessing — at every stage length', () => {
    const closing: Record<string, string> = { descent: 'arrive', heart: 'grat', field: 'bless', sun: 'pervade', more: 'more' };
    for (const S of LENS) {
      for (const kind of [...WAY, 'more'] as const) {
        const p = sp(kind, S);
        const tag = `${kind} ${S}`;
        // its light: each stage key from 0 to 1, without gaps
        for (const key of new Set(pushes(p).map(s => s.stage))) {
          const parts = pushes(p).filter(s => s.stage === key);
          expect(parts[0].from, tag).toBe(0);
          expect(parts.at(-1)!.to, tag).toBe(1);
          for (let i = 1; i < parts.length; i++) expect(parts[i].from, tag).toBeCloseTo(parts[i - 1].to, 9);
        }
        expect(pushes(p)[0].stage, tag).toBe(kind);
        // the closing rest: its kind, its lines one a breath, its verse, the heart word
        const last = p.steps.at(-1) as RestStep;
        expect(last.kind, tag).toBe('rest');
        expect(last.closing, tag).toBe(true);
        expect(last.rest, tag).toBe(closing[kind] ?? 'bless');
        if (last.rest === 'bless') expect(last.rings, tag).toEqual([kind === 'field' ? 0 : stageRing(kind as never)]);
        expect(last.cycles, tag).toBe(restNeed(last, 1));
        const seq = restSeq(last, 1);
        expect(seq.at(-1)!.word, tag).toBe(true);
        expect(seq.some(i => i.verse), tag).toBe(true);
        // whole breaths, never two rests in a row, each push at least its lead-in and 12 s
        for (const r of rests(p)) expect(Number.isInteger(r.cycles) && r.cycles >= 1, tag).toBe(true);
        for (let i = 1; i < p.steps.length; i++) expect(p.steps[i].kind === 'rest' && p.steps[i - 1].kind === 'rest', tag).toBe(false);
        for (const s of pushes(p)) expect(s.min, tag).toBeGreaterThanOrEqual(leadOf(false) + RULES.pushSighted - 1e-9);
        // it lasts at least its length, and no more than its length and a minute (a long blessing)
        expect(p.len, tag).toBeGreaterThanOrEqual(S - 1e-6);
        expect(p.len, tag).toBeLessThanOrEqual(S + 60);
        // its light gets at least 80 % of it
        expect((p.len - last.cycles * CYC) / S, tag).toBeGreaterThanOrEqual(RULES.lightShare - 1e-9);
      }
    }
  });

  it('stops on the descent at the mouth and the throat, raises the sun before the four dimensions, gives circle 4 more breaths', () => {
    const d = sp('descent', 180);
    expect(pushes(d).map(s => [s.from, s.to])).toEqual([[0, PLACE_AT.mouth], [PLACE_AT.mouth, PLACE_AT.throat], [PLACE_AT.throat, 1]]);
    expect(rests(d).map(r => [r.rest, r.place ?? ''])).toEqual([['stop', 'mouth'], ['stop', 'throat'], ['arrive', '']]);
    const d2 = sp('descent', 120);
    expect(rests(d2).filter(r => r.rest === 'stop').map(r => r.place)).toEqual(['throat']);
    const s = sp('sun', 180);
    expect(pushes(s)[0]).toMatchObject({ stage: 'sun', from: 0, to: 1 });
    expect(pushes(s).slice(1).every(x => x.stage === 'pervade')).toBe(true);
    expect(rests(s)[0].rest).toBe('sun');
    const close = (k: (typeof WAY)[number]) => (sp(k, 180).steps.at(-1) as RestStep).cycles;
    expect(close('ring4')).toBeGreaterThan(close('ring3'));
    expect(close('ring4')).toBeGreaterThan(close('ring1'));
    // the stage's pushes are about the player's push length; fewer, longer ones with a longer push length
    for (const S of LENS) for (const p of pushes(sp('ring1', S))) expect(p.min).toBeLessThan(2 * RULES.pushDial.def);
    expect(pushes(sp('ring1', 240)).length).toBeGreaterThanOrEqual(pushes(sp('ring1', 120)).length);
    expect(pushes(sp('ring1', 240, { push: 90 })).length).toBeLessThan(pushes(sp('ring1', 240)).length);
  });

  it('calibrates the light for the average player: a stage lasting its length, a weaker one’s longer', () => {
    for (const S of LENS) {
      for (const kind of WAY) {
        const p = sp(kind, S);
        expect(stageSeconds(p.steps, EVEN, false, 0.56), `${kind} ${S}`).toBeLessThanOrEqual(p.len + 1);
        expect(stageSeconds(p.steps, EVEN, false, 0.25), `${kind} ${S}`).toBeGreaterThan(p.len * 1.2);
      }
    }
  });

  it('gives each ring its lamps by the stage length (fewer at 2:00, more at 4:00), never under four', () => {
    for (const S of LENS) for (const r of RINGS) expect(lampsFor(r, S)).toBeGreaterThanOrEqual(4);
    expect(lampsFor(3, 120)).toBeLessThan(lampsFor(3, 180));
    expect(lampsFor(5, 240)).toBeGreaterThan(lampsFor(5, 180));
    expect([1, 2, 3, 4, 5].map(r => lampsFor(r, 180))).toEqual([8, 10, 16, 8, 24]);
  });

  it('shows a rest’s lines one a breath, then its verse, then the heart word — and shortens it gracefully', () => {
    const b4: RestStep = { kind: 'rest', rest: 'bless', rings: [4], cycles: 6, closing: true };
    const items = restSeq(b4, 1);
    expect(items.slice(0, 3).map(i => i.text)).toEqual([t('bless.4.1'), t('bless.4.2'), t('bless.4.3')]);
    expect(items[3].verse).toBe(verseFor('ring4', 1));
    expect(items.at(-1)!.word).toBe(true);
    expect(items.reduce((a, i) => a + i.breaths, 0)).toBe(6);
    // fewer breaths: the word goes first, then the verse
    expect(restSeq({ ...b4, cycles: 4 }, 1).map(i => (i.text ? 'l' : i.verse ? 'v' : 'w'))).toEqual(['l', 'l', 'l', 'v']);
    expect(restSeq({ ...b4, cycles: 2 }, 1).map(i => i.text)).toEqual([t('bless.4.1'), t('bless.4.2')]);
    // more breaths: the heart word stays
    expect(restSeq({ ...b4, cycles: 9 }, 1).at(-1)).toMatchObject({ word: true, breaths: 4 });
    // the close: "zbierz to wszystko", then the heart word; after a whole way the Aaronic blessing, kept when short
    const amen: RestStep = { kind: 'rest', rest: 'amen', rings: [], cycles: 3, closing: true };
    expect(restSeq(amen, 1).map(i => i.text ?? (i.word ? 'word' : i.verse))).toEqual([t('amen.1'), 'word']);
    expect(restSeq({ ...amen, whole: true }, 1).map(i => i.text ?? i.verse)).toEqual([t('amen.1'), 'num6.24-26']);
    expect(restSeq({ ...amen, whole: true, cycles: 1 }, 1).map(i => i.verse)).toEqual(['num6.24-26']);
    for (const r of [0, 1, 2, 3, 4, 5] as const) for (let i = 0; i < BLESS_LINES[r]; i++) expect(t(`bless.${r}.${i + 1}` as never)).not.toMatch(/^bless/);
  });
});

// ── the session ─────────────────────────────────────────────────

describe('a session walks as many stages as fit (forecast and sim)', () => {
  it('never starts a stage with less than 2:00 left; each stage at least 2:00 (the first aside); the close always fits', () => {
    for (const m of SESSION_MINUTES) {
      for (const S of LENS) {
        for (const next of [0, 3, 7]) {
          for (const firstEver of [false, true]) {
            const T = m * 60;
            const f = fc(T, { stageSec: S, next, firstEver, warmSec: firstEver ? 60 : 0 });
            const end = T - f.finale, cm = closeMin(EVEN, false);
            const tag = `${m} min, S ${S}, from ${next}${firstEver ? ', first' : ''}`;
            const stages = f.slots.filter(s => s.kind !== 'reentry');
            expect(stages.length, tag).toBeGreaterThanOrEqual(1);
            stages.forEach((s, i) => {
              if (i > 0) {
                expect(end - cm - s.at, tag).toBeGreaterThanOrEqual(FLOOR - 1e-6);
                expect(s.min, tag).toBeGreaterThanOrEqual(FLOOR - 1e-6);
              }
              // only the session's last stage may take a little of the close's time: never past 4:00, the close calm
              expect(s.min, tag).toBeLessThanOrEqual(Math.min(S + RULES.stageStretch, 240));
              if (s.min > S + 1e-6) {
                expect(i, tag).toBe(stages.length - 1);
                expect(end - cm - (s.at + s.min), tag).toBeGreaterThanOrEqual(RULES.closeCalm - 1e-6);
              }
              expect(s.len, tag).toBeGreaterThanOrEqual(s.min - 1e-6);
            });
            expect(f.close.min, tag).toBeGreaterThanOrEqual(cm - 1e-6);
            expect(f.close.at + f.close.min, tag).toBeCloseTo(end, 6);
            if (next > 0) expect(f.slots[0].kind, tag).toBe('reentry');
          }
        }
      }
    }
  });

  it('a 5-minute session at 3:00 gives its one stage the spare half-minute, not a long close', () => {
    const fresh = fc(300, { stageSec: 180 });
    expect(fresh.slots.map(s => s.kind)).toEqual(['descent']);
    expect(fresh.slots[0].min).toBe(210);
    const resumed = fc(300, { stageSec: 180, next: 4 });
    expect(resumed.slots.map(s => s.kind)).toEqual(['reentry', 'ring2']);
    expect(resumed.slots[1].min).toBeGreaterThan(180);
    // a stage with time for another after it is never stretched
    expect(stageLen(400, 180, false)).toBe(180);
    expect(stageLen(240, 240, false)).toBe(240);
  });

  it('holds the founder’s examples: 3 min one stage, 5 min two at 2:00, 10 min three, 30 min the whole way — not at 4:00', () => {
    const names = (f: ReturnType<typeof fc>) => f.slots.map(s => s.kind);
    expect(names(fc(180))).toEqual(['descent']);
    expect(names(fc(180, { stageSec: 240 }))).toEqual(['descent']);
    expect(names(fc(300, { stageSec: 120 }))).toEqual(['descent', 'heart']);
    expect(names(fc(600))).toEqual(['descent', 'heart', 'field']);
    expect(fc(600).nextAfter).toBe(3);
    expect(names(fc(600, { next: 3 })).slice(0, 3)).toEqual(['reentry', 'ring1', 'ring2']);
    expect(fc(1800).whole).toBe(true);
    expect(fc(1800, { stageSec: 240 }).whole).toBe(false);
    expect(fc(1800, { stageSec: 240, next: fc(1800, { stageSec: 240 }).nextAfter }).whole).toBe(true);
    // a resumed 3-minute session still reaches one stage of 2:00
    const r3 = fc(180, { next: 4 });
    expect(names(r3)).toEqual(['reentry', 'ring2']);
    expect(r3.slots[1].min).toBeGreaterThanOrEqual(FLOOR);
    // a resumed 5-minute session at 2:00 still holds two stages
    expect(names(fc(300, { stageSec: 120, next: 4 }))).toEqual(['reentry', 'ring2', 'ring3']);
    // after the whole way with time left: stages for the world's people
    expect(names(fc(1800, { stageSec: 120 })).filter(k => k === 'more').length).toBeGreaterThanOrEqual(3);
  });

  it('sizes the re-entry: short in a short session (its least), 45–90 s from 10 minutes', () => {
    const least = leadOf(false) + RULES.reentrySighted + CYC;
    expect(reentrySec(180, 180 - 12 - closeMin(EVEN, false), 180, EVEN, false)).toBe(least);
    for (const T of [600, 900, 1800]) {
      const R = fc(T, { next: 4 }).reentry;
      expect(R, String(T)).toBeGreaterThanOrEqual(45);
      expect(R, String(T)).toBeLessThanOrEqual(90);
    }
    // the stage after it: what is left, between 2:00 and S
    expect(stageLen(150, 180, false)).toBe(150);
    expect(stageLen(100, 180, false)).toBeNull();
    expect(stageLen(40, 180, true)).toBe(40);
    // a long blessing never costs the next stage
    expect(stageCap(300, 180)).toBe(183);
    expect(stageCap(200, 180)).toBe(200);
  });

  for (const T of [180, 300, 600, 1800]) {
    it(`walks stages of at least their length at ${T / 60} minutes — average, weak and strong`, () => {
      const f = fc(T);
      const avg = later({ planned: T });
      session(avg, average);
      const strongSim = later({ planned: T, seed: 9 });
      session(strongSim, strong);
      const weakSim = later({ planned: T, seed: 3 });
      session(weakSim, weak);
      const want = f.slots.map(s => s.kind);
      // the average walks what the forecast said, each stage done; the strong one the very same (it abides)
      expect(avg.runs.filter(r => r.kind !== 'close').map(r => r.kind), 'average').toEqual(want);
      expect(strongSim.runs.filter(r => r.kind !== 'close').map(r => r.kind), 'strong').toEqual(want);
      for (const sim of [avg, strongSim, weakSim]) {
        for (const r of sim.runs) {
          if (r.kind === 'close' || r.t1 === null || !r.goal) continue;
          expect(r.t1 - r.t0, `${r.kind}`).toBeGreaterThanOrEqual(r.min - 0.1);
        }
        // the close ends every session, the finale after it
        expect(sim.runs.at(-1)!.kind).toBe('close');
        expect(sim.phase).toBe('done');
      }
      for (const r of wayRuns(avg)) {
        expect(r.goal, r.kind).toBe(true);
        expect(r.t1! - r.t0, r.kind).toBeLessThanOrEqual(RULES.stageDef + 60);
      }
      // the strong player never runs ahead: its stages last as long as the average's
      wayRuns(strongSim).forEach((r, i) => expect(Math.abs((r.t1! - r.t0) - (wayRuns(avg)[i].t1! - wayRuns(avg)[i].t0))).toBeLessThan(5));
      // the weak player walks fewer (or as many) — its stages longer
      expect(weakSim.walkedNow.length).toBeLessThanOrEqual(avg.walkedNow.length);
      // no stage began with less than 2:00 left before the close (the first aside)
      for (const sim of [avg, strongSim, weakSim]) {
        const closeAt = T - sim.plan.finale - closeMin(EVEN, false);
        sim.runs.filter(r => r.kind !== 'close' && r.kind !== 'reentry').slice(1).forEach(r => expect(closeAt - r.t0).toBeGreaterThanOrEqual(FLOOR - 0.1));
      }
    });
  }

  it('reaches each stage’s goal at about 75–85 % of its length for the average player (3:00 and 4:00 stages)', () => {
    for (const S of [180, 240]) {
      const sim = later({ planned: 1800, progress: { stageSec: S } });
      session(sim, average);
      const full = wayRuns(sim).filter(r => r.min === S);
      expect(full.length).toBeGreaterThanOrEqual(6);
      for (const r of full) {
        const k = (r.tGoal! - r.t0) / S;
        expect(k, `${r.kind} ${S}`).toBeGreaterThan(0.74);
        expect(k, `${r.kind} ${S}`).toBeLessThan(0.87);
      }
    }
  });

  it('walks the whole way in 30 minutes at 3:00 for an average player, then blesses the world’s people; two sessions at 4:00', () => {
    const a = later({ planned: 1800 });
    const { wayAt } = session(a, average);
    expect(wayAt).not.toBeNull();
    expect(a.wayDone).toBe(true);
    expect(a.p.next).toBe(0);
    const b = later({ planned: 1800, progress: { stageSec: 240 } });
    session(b, average);
    expect(b.wayDone).toBe(false);
    expect(b.p.next).toBeGreaterThan(5);
    const c = new SerceSim({ progress: b.p, rng: mulberry32(2), plannedSec: 1800, eeg: false, tuning: TUNING, day: DAY });
    c.start();
    session(c, average);
    expect(c.runs[0].kind).toBe('reentry');
    expect(c.wayDone).toBe(true);
    const more = later({ planned: 1800, progress: { stageSec: 120 } });
    session(more, strong);
    const groups = more.runs.filter(r => r.kind === 'more').map(r => r.arc);
    expect(groups.slice(0, 3)).toEqual(['suffer', 'lonely', 'sick']);
    expect(more.moreLights).toBeGreaterThan(0);
    const lonely = more.steps.find((s): s is RestStep => s.kind === 'rest' && s.rest === 'more' && s.arc === 'lonely')!;
    expect(more.restItems(lonely).map(i => i.text ?? (i.word ? 'word' : 'verse'))).toEqual([t('more.lonely'), 'verse', 'word']);
    expect(t('more.lonely')).toBe('Panie, błogosław samotnym.');
  });

  for (const T of [180, 600, 1800]) {
    it(`resumes with the re-entry at ${T / 60} minutes, then goes on at the saved stage`, () => {
      const sim = later({ planned: T, progress: { next: 4 } });
      session(sim, average);
      const [re, first] = sim.runs;
      expect(re.kind).toBe('reentry');
      expect(re.way).toBe(4);
      expect(first.kind).toBe('ring2');
      expect(first.min).toBeGreaterThanOrEqual(FLOOR);
      expect(first.goal).toBe(true);
      // the re-entry walks the light from the brow to the heart and round the person — by focus, briefly
      expect(sim.prog.descent).toBe(1);
      expect(sim.prog.heart).toBe(1);
      expect(sim.prog.field).toBe(1);
      const len = re.t1! - re.t0;
      if (T <= 180) expect(len).toBeLessThanOrEqual(30);
      else {
        expect(len).toBeGreaterThanOrEqual(45);
        expect(len).toBeLessThanOrEqual(95);
      }
      // the earlier rings shine as remembered; circle 2 is walked now
      expect(sim.remembered(1)).toBe(true);
      expect(sim.remembered(2)).toBe(false);
    });
  }

  it('re-enters only what comes before the saved stage among the first three', () => {
    const stages = (s: SerceSim) => s.steps.filter((x): x is PushStep => x.kind === 'push').map(x => x.stage);
    expect(stages(later({ planned: 600, progress: { next: 1 } }))).toEqual(['descent']);
    expect(stages(later({ planned: 600, progress: { next: 2 } }))).toEqual(['descent', 'heart']);
    expect(later({ planned: 600 }).runs[0].kind).toBe('descent');
  });

  it('saves where the way goes on: the stage it was in, or the next one when the last finished; tells the summary', () => {
    const p = { ...freshProgress(), sessions: 3, seen: [...ALL_SEEN] };
    const sim = new SerceSim({ progress: p, rng: mulberry32(2), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
    sim.start();
    session(sim, average);
    expect(sim.walkedNow).toEqual([0, 1, 2]);
    expect(p.next).toBe(3);
    expect(p.stages).toBe(3);
    expect(sim.result().highlights).toContain('Następnym razem: Krąg 1 — Rodzina.');
    expect(sim.result().highlights[0]).toBe('Dziś: Zejście · Serce · Ja.');
    // a weak player's stage cut by the close: saved as it was
    const q = { ...freshProgress(), sessions: 3, seen: [...ALL_SEEN], next: 3 };
    const w = new SerceSim({ progress: q, rng: mulberry32(3), plannedSec: 300, eeg: false, tuning: TUNING, day: DAY });
    w.start();
    session(w, weak);
    expect(w.walkedNow).toEqual([]);
    expect(q.next).toBe(3);
    // a whole way clears it
    const r = { ...freshProgress(), sessions: 3, seen: [...ALL_SEEN], next: 8 };
    const z = new SerceSim({ progress: r, rng: mulberry32(4), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY });
    z.start();
    session(z, average);
    expect(z.wayDone).toBe(true);
    expect(r.next).toBe(0);
    expect(r.ways).toBe(1);
    expect(startStage(r)).toBe(0);
    // the close after a whole way: the Aaronic blessing
    const amen = z.steps.at(-1) as RestStep;
    expect(amen.whole).toBe(true);
    expect(z.restItems(amen).some(i => i.verse === 'num6.24-26')).toBe(true);
  });

  it('leaves circle 4 out today only: the way goes from circle 3 to circle 5, and circle 4 waits for another day', () => {
    const p = freshProgress();
    setSkip4(p, DAY, true);
    expect(skip4Today(p, DAY)).toBe(true);
    expect(skip4Today(p, '2026-11-23')).toBe(false);
    expect(fc(1800, { next: 5, skip4: true }).slots.map(s => s.kind).slice(0, 4)).toEqual(['reentry', 'ring3', 'ring5', 'sun']);
    const sim = later({ planned: 600, progress: { skip4: p.skip4, next: 5 } });
    session(sim, average);
    expect(sim.ringOut(4)).toBe(true);
    expect(sim.runs.map(r => r.kind)).not.toContain('ring4');
    expect(sim.wayState(6)).toBe('out');
    expect(sim.result().highlights).toContain(t('hl.skip4'));
    // saved at circle 4 while it was out: today it goes on from circle 5, tomorrow from circle 4
    const q = { ...freshProgress(), sessions: 2, seen: [...ALL_SEEN], next: 6, skip4: DAY };
    expect(new SerceSim({ progress: q, rng: mulberry32(1), plannedSec: 600, eeg: false, tuning: TUNING, day: DAY }).from).toBe(7);
    expect(new SerceSim({ progress: q, rng: mulberry32(1), plannedSec: 600, eeg: false, tuning: TUNING, day: '2026-11-23' }).from).toBe(6);
  });

  it('abides when the light is met early: nothing moves, no more lamps, held focus deepens the glow — never ahead', () => {
    const sim = later({ planned: 600, progress: { next: 3 } });
    const clock = { t: 0 };
    while (sim.run?.kind === 'reentry' && clock.t < 200) drive(sim, 0.5, strong, clock);
    let seen = false;
    for (let i = 0; i < 400 && !seen; i++) {
      drive(sim, 0.25, strong, clock);
      if (sim.abiding && sim.blockT < sim.blockMin - 3) seen = true;
    }
    expect(seen).toBe(true);
    const lit = sim.lit[1], prog = sim.prog.ring1, run = sim.run;
    drive(sim, 1.5, strong, clock);
    expect(sim.lit[1]).toBe(lit);
    expect(sim.prog.ring1).toBe(prog);
    expect(sim.run).toBe(run);
    expect(sim.deep).toBeGreaterThan(0);
    expect(sim.now).toBe('abide');
    expect(sim.moving).toBe(false);
    const d = sim.deep;
    drive(sim, 1, LOW, clock);
    expect(sim.deep).toBeLessThan(d);
    expect(t('now.abide')).toMatch(/Zostań tu/);
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
    // the re-entry is a push like any other
    const r = later({ progress: { next: 5 } });
    drive(r, 40, LOW);
    expect(r.prog.descent).toBe(0);
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
    const sim = later({ planned: 1800 });
    const { evs } = session(sim, strong);
    expect(ofType(evs, 'place').map(e => e.place)).toEqual(['eyes', 'mouth', 'throat', 'heart']);
    const order = evs.filter(e => ['kindled', 'whole', 'reach', 'ringDone', 'sunUp', 'pervaded', 'way'].includes(e.type))
      .map(e => (e.type === 'reach' || e.type === 'ringDone' ? `${e.type}${e.ring}` : e.type));
    expect(order.slice(0, 15)).toEqual(['kindled', 'whole', 'reach1', 'ringDone1', 'reach2', 'ringDone2', 'reach3', 'ringDone3', 'reach4', 'ringDone4', 'reach5', 'ringDone5', 'sunUp', 'pervaded', 'way']);
    for (const r of RINGS) {
      const lamps = ofType(evs, 'lamp').filter(e => e.ring === r);
      expect(lamps.map(e => e.i)).toEqual(lamps.map((_, i) => i));
      expect(lamps.length).toBe(sim.lampTotal(r));
    }
    // the headline counts every light: places, heart, me, lamps, the sun, and more for the world
    const lamps = RINGS.reduce((n, r) => n + sim.lampTotal(r), 0);
    expect(sim.score).toBe(4 + 1 + 1 + lamps + 1 + sim.moreLights);
    // each stage opened with its title card
    expect(ofType(evs, 'stageOpen').map(e => e.run.kind).slice(0, 9)).toEqual([...WAY]);
  });
});

describe('blocks: rests of whole breaths, the valve, judging', () => {
  it('rests in whole breaths of the pattern; each stage ends with its blessing', () => {
    const sim = later({ planned: 600 });
    session(sim, strong);
    const restBlocks = sim.blocks.filter(b => b.kind === 'rest' && b.why !== 'valve' && b.len > 0);
    for (const b of restBlocks) {
      expect(b.dur).toBeCloseTo(b.cycles * CYC, 6);
      if (b.len < b.dur - 0.1) continue;   // cut by the close or the finale
      expect(b.len).toBeCloseTo(b.dur, 0);
    }
    const kinds = restBlocks.map(b => `${b.step!.rest}${b.step!.place ?? ''}${b.step!.rings.join('')}`);
    expect(kinds.slice(0, 7)).toEqual(['stopmouth', 'stopthroat', 'arrive', 'word', 'grat', 'word', 'bless0']);
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

  it('telegraphs the rest and the next push; judges each block once', () => {
    const sim = later({ planned: 600 });
    const { evs } = session(sim, average);
    expect(ofType(evs, 'telegraph').length).toBeGreaterThan(8);
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
    // a first 3-minute session (the card takes its time): the descent still comes, the close after it
    const first3 = makeSim({ planned: 180, seed: 5 });
    session(first3, average);
    expect(first3.runs.map(r => r.kind)).toEqual(['descent', 'close']);
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

  it('works with HALO (a 2-second lead-in) and the slow breath (4 · 7 · 8)', () => {
    for (const o of [{ eeg: true }, { progress: { breath: { ...BREATH_PRESETS.relax } } }] as SimOpts[]) {
      const sim = later({ planned: 600, ...o });
      session(sim, average);
      expect(sim.walkedNow.length, JSON.stringify(o)).toBeGreaterThanOrEqual(2);
      expect(sim.runs.at(-1)!.kind).toBe('close');
    }
  });
});

describe('the summary and the progress', () => {
  it('settles once, keeps records with Math.max, says the stages today, the way so far and a closing verse that fits', () => {
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
    const stats = Object.fromEntries(r1.stats);
    expect(stats['Etapy dziś']).toMatch(/^3 × 3:\d\d$/);
    // mid-session, a walked stage still saying its blessing counts up to now (never "× 0 s")
    const mid = later({ planned: 600 });
    const c = { t: 0 };
    while (!mid.runs[0]?.goal && c.t < 300) drive(mid, 1, average, c);
    drive(mid, 2, average, c);
    expect(Object.fromEntries(mid.result().stats)['Etapy dziś']).toMatch(/^1 × \d:\d\d$/);
    expect(stats['Droga']).toBe('3 z 9');
    expect(sim.closingVerse()).toBe(verseFor('ring0', sim.session));
    const w = later({ planned: 1800 });
    session(w, average);
    expect(w.result().highlights[0]).toBe(t('hl.way'));
    expect(Object.fromEntries(w.result().stats)['Droga']).toBe('9 z 9');
    expect(VERSES.closing as readonly string[]).toContain(w.closingVerse() === 'num6.24-26' ? 'col3.14' : w.closingVerse());
  });

  it('keeps summaries short at 30 minutes and its collections bounded', () => {
    const sim = later({ planned: 1800, progress: { stageSec: 120 } });
    const { evs } = session(sim, strong);
    const r = sim.result();
    expect(r.highlights.length).toBeLessThanOrEqual(5);
    for (const [, v] of r.stats) expect(v.length).toBeLessThan(40);
    expect(sim.steps.length).toBeLessThan(200);
    expect(sim.talk.said.length).toBeLessThan(200);
    expect(evs.filter(e => e.type === 'lamp').length).toBeLessThan(400);
  });

  it('a test-length session (?trainingSec ≤ 60) keeps only a breath for the close, so held focus still kindles light', () => {
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    while (clock.t < 46 && sim.phase !== 'done') drive(sim, 0.5, strong, clock, reader(sim));
    expect(sim.score).toBeGreaterThan(0);
    // a real session keeps its return into the heart
    expect(closeMin(EVEN, false, 180)).toBeGreaterThan(closeMin(EVEN, false, 40));
  });

  it('migrates a round-15 save (its ring → its stage) and the placeholder’s, repairs garbage; names stay plain', () => {
    const r15 = migrate({
      ver: 1, sessions: 4, pushes: 30, best: { 600: 40 }, lights: 120, ways: 0, reach: 2, pos: { ring: 2 }, names: [['Ania'], [], [], []], word: 'abba', own: '',
      skip4: '', breath: { ...BREATH_PRESETS.calm }, seen: ['s.open'], lastLen: 600,
    } as unknown as SerceProgress);
    expect(r15.ver).toBe(2);
    expect(r15.next).toBe(4);
    expect(stageTitle(r15.next)).toBe('Krąg 2 — Przyjaciele');
    expect(r15.stageSec).toBe(RULES.stageDef);
    expect(r15.stages).toBe(0);
    expect((r15 as unknown as { pos?: unknown }).pos).toBeUndefined();
    expect(r15.names[0]).toEqual(['Ania']);
    expect(r15.word).toBe('abba');
    expect(r15.breath).toEqual(BREATH_PRESETS.calm);
    expect(migrate({ ...r15 })).toEqual(r15);
    expect(migrate({ ...freshProgress(), pos: null } as unknown as SerceProgress).next).toBe(0);
    // the real load path: the kit merges the round-15 save over a fresh progress (next: 0) before migrating
    const loaded = migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 4, pos: { ring: 3 } }));
    expect(loaded.next).toBe(5);
    expect(stageTitle(loaded.next)).toBe('Krąg 3 — Ludzie, których spotykam');
    expect(migrate(mergeSaved(freshProgress(), JSON.parse(JSON.stringify(loaded)))).next).toBe(5);
    const old = mergeSaved(freshProgress(), { best: null });
    migrate(old);
    expect(old.ver).toBe(2);
    expect(old.best).toEqual({});
    expect(bestOf(old)).toBeNull();
    const junk = migrate({ sessions: 'x', best: { 600: 12, nope: 3, 300: -1 }, names: [['  Ania ', 3, '<b>x</b>'], 'no'], word: 'om', skip4: 'today', breath: { in: 0, out: 0 }, pos: { ring: 9 }, reach: 99, next: 42, stageSec: 'long' } as unknown as SerceProgress);
    expect(junk.sessions).toBe(0);
    expect(junk.best).toEqual({ 600: 12 });
    expect(junk.names[0]).toEqual(['Ania', 'b x /b']);
    expect(junk.names[1]).toEqual([]);
    expect(junk.word).toBe('jesus');
    expect(junk.skip4).toBe('');
    expect(junk.next).toBe(0);
    expect(junk.stageSec).toBe(180);
    expect(junk.reach).toBe(5);
    expect(breathCycle(junk.breath)).toBeGreaterThanOrEqual(2);
    expect(migrate({ ...freshProgress(), stageSec: 200 }).stageSec).toBe(210);
    const p = freshProgress();
    expect(setNames(p, 2, 'Ola, Kuba,  Ewa ,,' + ',x'.repeat(20))).toHaveLength(8);
    expect(setNames(p, 1, 'A'.repeat(40))[0]).toHaveLength(RULES.nameMax);
    expect(setNames(p, 5, 'Nobody')).toEqual([]);
    expect(namesCount(p)).toBe(9);
    expect(cleanName('  Jan\u0007 Kowalski ')).toBe('Jan Kowalski');
    expect(cleanOwn('x'.repeat(80))).toHaveLength(RULES.ownMax);
    expect(setBreath(p, { in: 0, holdIn: 0, out: 1, holdOut: 0 })).toBe(false);
    setStageSec(p, 240);
    expect(p.stageSec).toBe(240);
    p.next = 5;
    clearStart(p);
    expect(startStage(p)).toBe(0);
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
    for (const m of ['open', 'resume', 'descend', 'settle', 'heart', 'field', 'whole', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back', 'home', 'more', 'wait', 'good', 'nosignal', 'valve', 'end', 'abide', 'abideRing', 'close'] as const) {
      expect(linesOf(m).length, m).toBeGreaterThanOrEqual(2);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
    expect(linesOf('abideRing')).toContain('Zostań tu. Nie spiesz się — ten krąg ma swój czas.');
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
    expect(secText(42)).toBe('42\u00a0s');
    expect(secText(102)).toBe('1:42');
    expect(breathWords(BREATH_PRESETS.even)).toBe('wdech 5\u00a0s, wydech 5\u00a0s');
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

  it('names the stage in the HUD’s sub-line and on its title card; a quiet line fills with its time', () => {
    const sim = later({ planned: 600, progress: { next: 3 } });
    expect(sim.subLine).toBe('Wejście do serca');
    expect(sim.titleOf()).toMatchObject({ title: 'Wejście do serca', sub: 'potem: Etap 4 z 9 · Krąg 1 — Rodzina' });
    const clock = { t: 0 };
    while (sim.run?.kind === 'reentry' && clock.t < 200) drive(sim, 0.5, average, clock);
    drive(sim, 0.3, average, clock);
    expect(sim.subLine).toBe('Etap 4 z 9 · Krąg 1');
    expect(sim.titleOf()).toMatchObject({ kicker: 'Etap 4 z 9', title: 'Krąg 1 — Rodzina' });
    expect(sim.titleK).toBeGreaterThan(0);
    expect(sim.talkBlocked).toBe(true);
    drive(sim, 8, average, clock);
    expect(sim.titleK).toBe(0);
    expect(sim.stageK).toBeGreaterThan(0);
    expect(sim.stageK).toBeLessThan(0.2);
    expect(sim.wayState(2)).toBe('done');
    expect(sim.wayState(3)).toBe('now');
    expect(sim.wayState(4)).toBe('wait');
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
    for (const k of [1, 2, 3, 4] as const) expect(frameBox(`ring${k}`).hx).toBeGreaterThan(RULES.ringR[k]);
    const w = frameBox('world');
    expect(w.cy + w.hy).toBeGreaterThan(EARTH.cy + EARTH.r);
    expect(w.cy - w.hy).toBeLessThan(-RULES.ringR[4]);
    let cam = cameraFor(L, 'body');
    const to = cameraFor(L, 'world');
    for (let i = 0; i < 400; i++) cam = easeCam(cam, to, 0.05);
    expect(cam.s).toBeCloseTo(to.s, 3);
    expect(cam.y).toBeCloseTo(to.y, 3);
  });

  it('draws the Earth from its own outlines: enough cities facing us for 4-minute stages, kindled nearest first', () => {
    const E = earth();
    expect(E.cities.length).toBeGreaterThanOrEqual(lampsFor(5, 240));
    expect(E.dust.length).toBeGreaterThan(150);
    const order = cityOrder(lampsFor(5, 180));
    for (let i = 1; i < order.length; i++) expect(order[i].d).toBeGreaterThanOrEqual(order[i - 1].d);
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
    expect(touch.tips![0]).toMatch(/wdech 5\u00a0s, wydech 5\u00a0s/);
  });
});

describe('the lobby’s card (panel.ts)', () => {
  const wayOf = (root: HTMLElement) => [...root.querySelectorAll('[role="radiogroup"][aria-label="Twoja droga"] button')] as HTMLButtonElement[];

  it('sets the stage length, shows the way and this session’s forecast, and starts the next session at a tapped stage', () => {
    const p = freshProgress();
    let saves = 0;
    const root = progressPanel(p, () => { saves++; });
    const text = () => root.textContent ?? '';
    const btn = (label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label) as HTMLButtonElement;
    expect(text()).toContain('Długość etapu');
    expect(text()).toContain('Każdy etap trwa co najmniej tyle — dłużej, jeśli światło potrzebuje więcej czasu.');
    for (const l of ['2:00', '2:30', '3:00', '3:30', '4:00']) expect(btn(l), l).toBeDefined();
    expect(btn('3:00').getAttribute('aria-checked')).toBe('true');
    btn('2:00').click();
    expect(p.stageSec).toBe(120);
    expect(saves).toBe(1);
    // the way: nine stages, the first the next one
    expect(wayOf(root)).toHaveLength(9);
    expect(wayOf(root)[0].getAttribute('aria-checked')).toBe('true');
    expect(wayOf(root)[0].textContent).toMatch(/^◉1\. Zejście/);
    wayOf(root)[4].click();
    expect(p.next).toBe(4);
    expect(wayOf(root)[3].textContent).toMatch(/^✓/);
    expect(wayOf(root)[4].getAttribute('aria-checked')).toBe('true');
    // the forecast for a session length (the same rules the session follows)
    p.next = 1;
    p.stageSec = 180;
    p.sessions = 3;
    expect(forecastLine(p, 600, DAY)).toBe('W 10 min: wejście do serca, potem Serce · Ja · Rodzina — dalej następnym razem.');
    p.next = 0;
    expect(forecastLine(p, 600, DAY)).toBe('W 10 min: Zejście · Serce · Ja — dalej następnym razem.');
    expect(forecastLine(p, 1800, DAY)).toBe('W 30 min: cała droga — dziewięć etapów.');
    p.stageSec = 240;
    expect(forecastLine(p, 1800, DAY)).toMatch(/— dalej następnym razem\.$/);
    for (const b of root.querySelectorAll('button')) expect(b.style.minHeight).toBe('44px');
  });

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
    expect(text()).toContain('Zacznij od kogoś, kto zranił Cię lekko');
    const box = root.querySelector('input[type="checkbox"]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(p.skip4).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(text()).toContain('jutro wróci');
    expect(wayOf(root)[6].textContent).toMatch(/^–/);
    const btn = (label: string) => [...root.querySelectorAll('button')].find(b => b.textContent === label) as HTMLButtonElement;
    for (const w of ['Modlitwa Jezusowa', 'Jezu', 'Abba, Ojcze', 'Maranatha', 'Własne słowa']) expect(btn(w), w).toBeDefined();
    btn('Własne słowa').click();
    expect(p.word).toBe('own');
    const own = inputs().at(-1)!;
    own.value = 'Jezu, ufam Tobie';
    own.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(p.own).toBe('Jezu, ufam Tobie');
    expect(btn('5 · 5 równy').getAttribute('aria-checked')).toBe('true');
    btn('4 · 6 spokojny').click();
    expect(p.breath).toEqual(BREATH_PRESETS.calm);
  });
});

describe('the rest’s rhythm, set in the lobby (kit/rhythm.ts)', () => {
  it('offers a stage’s push length 50–90 s (50 by design) and each rest’s whole breaths of the player’s pattern', () => {
    const spec = serceRhythm(freshProgress());
    expect(spec.focus).toMatchObject({ def: 50, min: 50, max: 90, step: 5, name: 'Skupienie' });
    expect(spec.focus.format(50)).toBe('50 s');
    expect(spec.rest).toMatchObject({ def: 2, min: 1, max: RULES.restBreathsMax });
    expect(spec.rest.format(2)).toBe('2 oddechy · 20 s');
    expect(serceRhythm({ ...freshProgress(), breath: { ...BREATH_PRESETS.box } }).rest.format(2)).toBe('2 oddechy · 32 s');
    expect(rhythmOf(spec, undefined)).toEqual({ focus: 50, rest: 2, custom: false });
    // 10 minutes: about nine rests, about a third of the time
    const n = restsIn(spec, rhythmOf(spec, undefined)!, 600)!;
    expect(n.rests).toBeGreaterThanOrEqual(8);
    expect(n.rests).toBeLessThanOrEqual(10);
    expect(n.share).toBeCloseTo(0.29, 1);
  });

  it('reads a round-15 save (a blessing after 1–3 circles) as the design, not as a surprising setting', () => {
    const spec = serceRhythm(freshProgress());
    for (const focus of [1, 2, 3]) expect(rhythmOf(spec, { focus, rest: 2 }), String(focus)).toEqual({ focus: 50, rest: 2, custom: false });
    // a moved rest dial stays the player's
    expect(rhythmOf(spec, { focus: 3, rest: 4 })).toEqual({ focus: 50, rest: 4, custom: true });
    // and the game plays a raw old value as the design too
    expect(later({ planned: 600, rhythm: { focus: 2, rest: 2, custom: true } }).plan.push).toBe(50);
  });

  it('plays the player’s rhythm: longer pushes fewer, more breaths longer rests — each stage still at least its length', () => {
    const design = later({ planned: 900 });
    const mine = later({ planned: 900, rhythm: { focus: 90, rest: 4, custom: true } });
    expect(mine.restBreaths).toBe(4);
    const pushesOf = (s: SerceSim) => s.steps.slice(s.runs[0].i0, s.runs[0].i1).filter(x => x.kind === 'push').length;
    expect(pushesOf(mine)).toBeLessThan(pushesOf(design));
    for (const rhythm of [{ focus: 90, rest: 1 }, { focus: 50, rest: 6 }]) {
      const sim = later({ planned: 900, rhythm: { ...rhythm, custom: true } });
      session(sim, average);
      const tag = JSON.stringify(rhythm);
      expect(sim.walkedNow.length, tag).toBeGreaterThanOrEqual(3);
      for (const r of wayRuns(sim)) if (r.goal && r.t1 !== null) expect(r.t1 - r.t0, tag).toBeGreaterThanOrEqual(r.min - 0.1);
      expect(sim.phase, tag).toBe('done');
    }
  });
});

describe('45–60 minutes (round 24)', () => {
  it('the plan to its finale: the whole way, then the world’s people in turn — every stage in its bounds, the close fitting', () => {
    for (const T of [2700, 3600]) {
      for (const S of LENS) {
        for (const next of [0, 3, 7]) {
          const f = fc(T, { stageSec: S, next });
          const tag = `${T / 60} min, S ${S}, from ${next}`;
          const end = T - f.finale, cm = closeMin(EVEN, false);
          expect(f.whole, tag).toBe(true);
          const stages = f.slots.filter(x => x.kind !== 'reentry');
          stages.forEach((x, i) => {
            if (i > 0) expect(end - cm - x.at, tag).toBeGreaterThanOrEqual(FLOOR - 1e-6);
            expect(x.min, tag).toBeLessThanOrEqual(240);
            expect(x.len, tag).toBeGreaterThanOrEqual(x.min - 1e-6);
          });
          expect(f.close.min, tag).toBeGreaterThanOrEqual(cm - 1e-6);
          expect(f.close.at + f.close.min, tag).toBeCloseTo(end, 6);
          // the people after the way, in turn — an hour holds up to four rounds of them
          const more = f.slots.filter(x => x.kind === 'more');
          more.forEach((x, i) => expect(x.arc, tag).toBe(ARCS[i % ARCS.length]));
          expect(f.slots.length, tag).toBeLessThan(40);
        }
      }
    }
    // an hour at 3:00 after a fresh start: the nine stages, then ten stages for the world's people
    expect(fc(3600).slots.filter(x => x.kind === 'more')).toHaveLength(10);
  });

  for (const T of [2700, 3600]) {
    it(`a whole headless session of ${T / 60} minutes: the forecast walked, a clean close, bounded, a short summary`, () => {
      const avg = later({ planned: T });
      session(avg, average);
      const strongSim = later({ planned: T, seed: 9 });
      session(strongSim, strong);
      const weakSim = later({ planned: T, seed: 3 });
      session(weakSim, weak);
      const want = fc(T).slots.map(x => x.kind);
      expect(avg.runs.filter(r => r.kind !== 'close').map(r => r.kind)).toEqual(want);
      expect(strongSim.runs.filter(r => r.kind !== 'close').map(r => r.kind)).toEqual(want);
      expect(avg.wayDone).toBe(true);
      // a weak player walks most of the way (its stages longer), never past the close
      expect(weakSim.walkedNow.length).toBeGreaterThanOrEqual(7);
      for (const sim of [avg, strongSim, weakSim]) {
        expect(sim.phase).toBe('done');
        expect(sim.runs.at(-1)!.kind).toBe('close');
        for (const r of sim.runs) if (r.kind !== 'close' && r.t1 !== null && r.goal) expect(r.t1 - r.t0, r.kind).toBeGreaterThanOrEqual(r.min - 0.1);
        expect(sim.steps.length).toBeLessThan(200);
        expect(sim.blocks.length).toBeLessThan(200);
        expect(sim.talk.said.length).toBeLessThan(400);
        const res = sim.result();
        expect(res.score).toBeGreaterThan(0);
        expect(res.highlights.length).toBeLessThanOrEqual(5);
        for (const h of res.highlights) expect(h.length).toBeLessThan(140);
        expect(res.stats.length).toBeLessThanOrEqual(6);
        for (const [, v] of res.stats) expect(v.length, v).toBeLessThanOrEqual(12);
      }
      for (const r of wayRuns(avg)) expect(r.goal, r.kind).toBe(true);
    });
  }

  it('from the second round of the people each group’s blessing has its own verse, back only after ten minutes', () => {
    const sim = later({ planned: 3600, progress: { stageSec: 120 } });
    session(sim, strong);
    const more = sim.runs.filter(r => r.kind === 'more');
    expect(more.length).toBeGreaterThanOrEqual(15);
    const seen = new Map<string, number>();
    more.forEach((r, i) => {
      const closing = sim.steps.slice(r.i0, r.i1).find((x): x is RestStep => x.kind === 'rest' && x.rest === 'more' && !!x.closing)!;
      const verse = sim.restItems(closing).find(it => it.verse)?.verse;
      const tag = `${i}: ${r.arc}`;
      if (i < ARCS.length) {
        // the first round as in a half-hour session: the circle of the whole world's verse
        expect(closing.again, tag).toBeUndefined();
        expect(verse, tag).toBe(verseFor('ring5', sim.session));
      } else {
        expect(closing.again, tag).toBe(true);
        expect(verse, tag).toBe(MORE_VERSES[r.arc!]);
        const last = seen.get(verse!);
        if (last !== undefined) expect(r.t0 - last, tag).toBeGreaterThanOrEqual(600);
        seen.set(verse!, r.t0);
      }
    });
    for (const id of Object.values(MORE_VERSES)) expect(ALL_VERSES).toContain(id);
    // a half-hour session never reaches a second round from a fresh start: it is as it was
    for (const S of LENS) expect(fc(1800, { stageSec: S }).slots.filter(x => x.kind === 'more').length, String(S)).toBeLessThanOrEqual(ARCS.length);
  });

  it('an hour’s narrator: no line again within ten minutes, still speaking in the last quarter; half an hour as before', () => {
    expect(later({ planned: 1800 }).talk.fresh).toBe(0);
    expect(later({ planned: 2700 }).talk.fresh).toBe(RULES.talkFresh);
    const sim = later({ planned: 3600 });
    const lines: [number, string, string][] = [];
    let last: unknown = null;
    drive(sim, 3606, average, { t: 0 }, tt => {
      reader(sim)();
      const l = sim.talk.line;
      if (l && l !== last) { last = l; lines.push([tt, l.moment, l.text]); }
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
