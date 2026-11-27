// @vitest-environment happy-dom
/**
 * Stop-klatka (DESIGN.md §28): the stories (their shape against the contract, every language complete), the plan for
 * every length 3–60 min and a ≤ 60 s test, the freeze's bounds, the heavy stories only with the switch, honest
 * neurofeedback (nothing charges without focus; a 40 s test scores at half focus), the work fitted to the player's pace
 * (a sim grid), long sessions alive and bounded, the age group saved and the place kept, nothing of the player's in the
 * result, the words (complete, no gendered Polish second person, the heart series' forbidden words out), the controls at
 * every checked size, the registry.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, auditTargets } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import { Hud } from '../src/arcade/stopklatka/hud';
import { CATALOGS, t } from '../src/arcade/stopklatka/i18n';
import mod, { howto, stopRhythm } from '../src/arcade/stopklatka/index';
import { layout } from '../src/arcade/stopklatka/layout';
import { freshProgress, migrate, setAge, setHeavy, startIn, type StopProgress } from '../src/arcade/stopklatka/meta';
import { forecastLine, progressPanel, whyCard } from '../src/arcade/stopklatka/panel';
import { RULES, freezeFor, planFor, type Plan } from '../src/arcade/stopklatka/rules';
import { CLOSE_VERSES, ROOT, StopSim, openPages, type SimEvent } from '../src/arcade/stopklatka/sim';
import { ALL_STORIES, STORIES, TRANSLATIONS, sourceKeys, storiesFor, storyKeys, storyText } from '../src/arcade/stopklatka/stories';
import { AGES, FEELINGS, FREEZE_MAX, FREEZE_MIN, MOODS, PEOPLE, PLACES, PROPS, type Age, type Story } from '../src/arcade/stopklatka/story';
import { WHY } from '../src/arcade/stopklatka/why';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { ARCADE, arcadeEntry } from '../src/arcade/registry';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 20;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const LENGTHS = SESSION_MINUTES.map(m => m * 60);

const frame = (p: Partial<FocusFrame> = {}): FocusFrame => ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
/** a player a little above the threshold, held a while */
const AVG = frame({ level: 0.62, activity: 3, focused: true, hold: 6, calm: 0.2 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });
const UNRELIABLE = frame({ reliable: false, level: 0.9, activity: null, focused: true, hold: 14 });

type FrameFn = (t: number, sim: StopSim) => FocusFrame;
function makeSim(o: { progress?: Partial<StopProgress>; planned?: number; eeg?: boolean; seed?: number; rhythm?: { focus: number; rest: number; custom: boolean } | null } = {}): StopSim {
  const progress = { ...freshProgress(), sessions: 4, ageSet: true, seen: ['c.tap', 'c.focus', 'c.name', 'c.choose'], ...o.progress } as StopProgress;
  const sim = new StopSim({ progress, rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null, day: '2026-11-27' });
  sim.start();
  return sim;
}
function drive(sim: StopSim, sec: number, f: FocusFrame | FrameFn, clock = { t: 0 }, out: SimEvent[] = [], step = STEP): SimEvent[] {
  const n = Math.round(sec / step);
  for (let i = 0; i < n; i++) {
    clock.t += step;
    sim.update(step, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}
const play = (sim: StopSim, f: FocusFrame | FrameFn, step = STEP): SimEvent[] => drive(sim, sim.T + 1, f, { t: 0 }, [], step);
const player = (push: FocusFrame): FrameFn => (_t, s) => (s.pushBlock ? push : LOW);
/** app:smoke's simulator: focus on about half the time (2 s on, 2 s off) */
const HALF: FrameFn = (t, s) => (s.pushBlock && Math.floor(t / 2) % 2 === 0 ? AVG : LOW);
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
const len = (s?: string): number => (s ? [...s].length : 0);

// ── the stories ───────────────────────────────────────────────────

describe('Stop-klatka — the stories', () => {
  it('has twelve stories for every group, ids unique and `<age>.<slug>`, 0–2 heavy, a light one to open each group', () => {
    const ids = new Set<string>();
    for (const a of AGES) {
      expect(STORIES[a], a).toHaveLength(12);
      const heavy = STORIES[a].filter(s => s.heavy).length;
      expect(heavy, a).toBeLessThanOrEqual(2);
      expect(STORIES[a][0].heavy, a).toBeFalsy();
      for (const s of STORIES[a]) {
        expect(s.age).toBe(a);
        expect(s.id.startsWith(`${a}.`), s.id).toBe(true);
        expect(ids.has(s.id), s.id).toBe(false);
        ids.add(s.id);
      }
    }
    expect(ALL_STORIES).toHaveLength(60);
  });

  it('keeps every story to the contract: 3–5 beats, the lists, the limits, heat rising to the trigger, a calm outcome', () => {
    const bad: string[] = [];
    const check = (ok: boolean, what: string): void => { if (!ok) bad.push(what); };
    for (const s of ALL_STORIES) {
      const id = s.id;
      check(s.beats.length >= 3 && s.beats.length <= 5, `${id}: ${s.beats.length} beats`);
      check(len(s.title) <= 40 && len(s.title) > 0, `${id}.title`);
      for (const [i, b] of [...s.beats, s.outcome].entries()) {
        const k = i < s.beats.length ? `b${i + 1}` : 'outcome';
        check((PLACES as readonly string[]).includes(b.place), `${id}.${k}.place ${b.place}`);
        for (const f of b.people ?? []) {
          check((PEOPLE as readonly string[]).includes(f.who), `${id}.${k} who ${f.who}`);
          check((MOODS as readonly string[]).includes(f.mood), `${id}.${k} mood ${f.mood}`);
        }
        if (b.prop) check((PROPS as readonly string[]).includes(b.prop), `${id}.${k}.prop ${b.prop}`);
        check(len(b.text) > 0 && len(b.text) <= 140, `${id}.${k}.text ${len(b.text)}`);
        check(len(b.say) <= 90, `${id}.${k}.say ${len(b.say)}`);
        check(len(b.screen) <= 60, `${id}.${k}.screen ${len(b.screen)}`);
        check(b.heat >= 0 && b.heat <= 1, `${id}.${k}.heat`);
        if (b.from !== undefined) check(Number.isInteger(b.from) && b.from >= 0 && b.from < (b.people?.length ?? 0), `${id}.${k}.from`);
      }
      for (let i = 1; i < s.beats.length; i++) check(s.beats[i].heat >= s.beats[i - 1].heat, `${id}: heat falls at b${i + 1}`);
      check(s.beats[s.beats.length - 1].heat >= 0.6, `${id}: the trigger's beat is not hot`);
      check(s.outcome.heat <= 0.3, `${id}: outcome heat ${s.outcome.heat}`);
      check(len(s.trigger) > 0 && len(s.trigger) <= 110, `${id}.trigger ${len(s.trigger)}`);
      check(len(s.urge) > 0 && len(s.urge) <= 90, `${id}.urge ${len(s.urge)}`);
      check(s.feel.length >= 1 && s.feel.every(f => (FEELINGS as readonly string[]).includes(f)), `${id}.feel`);
      check(s.second.length >= 2 && s.second.length <= 3 && s.second.every(l => len(l) > 0 && len(l) <= 110), `${id}.second`);
      check(len(s.answer) > 0 && len(s.answer) <= 140, `${id}.answer ${len(s.answer)}`);
      check(len(s.answerSay) <= 90, `${id}.answerSay ${len(s.answerSay)}`);
      check(len(s.lesson) > 0 && len(s.lesson) <= 90, `${id}.lesson ${len(s.lesson)}`);
      if (s.verse) check(!!passage(s.verse).text, `${id}.verse ${s.verse}`);
    }
    expect(bad).toEqual([]);
  });

  it('has every story in en, de and sv: exactly the Polish keys, none empty, the same limits', () => {
    const bad: string[] = [];
    const LIMIT = (k: string): number => (/\.title$/.test(k) ? 40 : /\.(say|answerSay)$/.test(k) ? 90 : /\.screen$/.test(k) ? 60 : /\.(urge|lesson)$/.test(k) ? 90 : /\.(trigger|second\.\d)$/.test(k) ? 110 : 140);
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const a of AGES) {
        const tr = TRANSLATIONS[l][a];
        const want = new Set(STORIES[a].flatMap(storyKeys));
        for (const k of want) {
          const v = tr[k];
          if (typeof v !== 'string' || !v.trim()) bad.push(`${l}: ${k} missing`);
          else if (len(v) > LIMIT(k)) bad.push(`${l}: ${k} ${len(v)} > ${LIMIT(k)}`);
        }
        for (const k of Object.keys(tr)) if (!want.has(k)) bad.push(`${l}: ${k} is not a Polish key`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('looks a story up in a language, falling back to the Polish for a missing key', () => {
    const s = STORIES.teen[0];
    const en = storyText(s, 'en');
    expect(en.title).toBe(TRANSLATIONS.en.teen[`${s.id}.title`]);
    expect(storyText(s, 'pl').title).toBe(s.title);
    expect(sourceKeys(s)[`${s.id}.lesson`]).toBe(s.lesson);
    const fake: Story = { ...s, id: 'teen.zz-none' };
    expect(storyText(fake, 'de').lesson).toBe(s.lesson);
  });

  it('gives only heavy stories with the switch, and opens each group in its own order', () => {
    for (const a of AGES) {
      expect(storiesFor(a, false).some(s => s.heavy)).toBe(false);
      expect(storiesFor(a, true)).toHaveLength(12);
    }
    // a session with the switch off never meets a heavy story, even at 60 minutes
    for (const a of AGES) {
      const sim = makeSim({ planned: 3600, progress: { age: a, heavy: false } });
      expect(sim.runs.some(r => r.story.heavy), a).toBe(false);
      const on = makeSim({ planned: 3600, progress: { age: a, heavy: true } });
      if (STORIES[a].some(s => s.heavy)) expect(on.runs.some(r => r.story.heavy), a).toBe(true);
    }
  });
});

// ── the plan ──────────────────────────────────────────────────────

const SHAPE: Record<string, string> = { intro: 'I', tell: 't', freeze: 'f', after: 'a', close: 'C' };
const shapeOf = (p: Plan): string => p.blocks.map(b => SHAPE[b.what]).join('');

describe('Stop-klatka — the plan', () => {
  it('fills every length 3–60 min and a ≤ 60 s test: blocks contiguous, ending at T, a story is tell · freeze · after', () => {
    for (const a of AGES) for (const T of [...LENGTHS, 40, 60]) for (const eeg of [false, true]) for (const sessions of [0, 1, 5, 20]) for (const heavy of [false, true]) {
      const order = storiesFor(a, heavy);
      const p = planFor({ plannedSec: T, eeg, order, sessions, open: sessions === 0 ? 4 : 0, ask: sessions === 0 });
      const name = `${a} ${T} s ${eeg ? 'eeg' : 'fnirs'} s=${sessions} heavy=${heavy}`;
      expect(p.blocks[0].t0).toBe(0);
      for (let i = 1; i < p.blocks.length; i++) expect(Math.abs(p.blocks[i].t0 - p.blocks[i - 1].t1), name).toBeLessThan(1e-6);
      for (const b of p.blocks) expect(b.t1, name).toBeGreaterThan(b.t0);
      expect(Math.abs(p.blocks[p.blocks.length - 1].t1 - T), name).toBeLessThan(1e-6);
      expect(shapeOf(p), name).toBe(`I${'tfa'.repeat(p.slots.length)}C`);
      for (const b of p.blocks) expect(b.kind, `${name} ${b.what}`).toBe(b.what === 'freeze' ? 'push' : b.what === 'tell' || b.what === 'after' ? 'rest' : 'free');
      expect(p.slots.length, name).toBeGreaterThanOrEqual(1);
      if (p.test) {
        expect(p.slots).toHaveLength(1);
        expect(p.freeze, name).toBeLessThanOrEqual(20);
        expect(p.freeze - p.lead, name).toBeGreaterThanOrEqual(12);
        continue;
      }
      // the freeze within the founder's bounds; the close a few lines' time, never most of the session
      expect(p.freeze, name).toBeGreaterThanOrEqual(FREEZE_MIN);
      expect(p.freeze, name).toBeLessThanOrEqual(FREEZE_MAX);
      const close = T - p.closeStart;
      expect(close, name).toBeGreaterThanOrEqual(RULES.close.min - 1e-6);
      expect(close, name).toBeLessThanOrEqual(Math.max(90, T * 0.12));
      // every slot holds its story's whole telling, the freeze, and the longest after with its lesson
      for (const sl of p.slots) {
        expect(sl.freezeEnd - sl.tellEnd, name).toBeCloseTo(p.freeze, 6);
        expect(sl.t1 - sl.freezeEnd, name).toBeGreaterThanOrEqual(sl.away + sl.answer + sl.outcome + Math.max(sl.lesson, sl.breaths * p.cyc) - 1e-6);
      }
    }
  });

  it('tells more stories with more time, never more than the cap, and repeats only after a whole round', () => {
    for (const a of AGES) {
      const order = storiesFor(a, false);
      let last = 0;
      for (const T of LENGTHS) {
        const p = planFor({ plannedSec: T, eeg: false, order, sessions: 13 });
        expect(p.slots.length, `${a} ${T}`).toBeGreaterThanOrEqual(last);
        expect(p.slots.length).toBeLessThanOrEqual(RULES.storiesMax);
        last = p.slots.length;
        // no story twice within one round
        const first = p.slots.slice(0, order.length).map(s => s.id);
        expect(new Set(first).size).toBe(first.length);
        p.slots.forEach((s, i) => expect(s.round).toBe(Math.floor(i / order.length)));
      }
      expect(planFor({ plannedSec: 180, eeg: false, order, sessions: 0 }).slots.length).toBeGreaterThanOrEqual(1);
      expect(planFor({ plannedSec: 3600, eeg: false, order, sessions: 13 }).slots.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('fits the freeze to the session and the player: near 20 s at first, up to 60 in long sessions of an experienced player', () => {
    expect(freezeFor(180, 0)).toBe(20);
    expect(freezeFor(3600, 0)).toBeLessThanOrEqual(25);
    expect(freezeFor(3600, 13)).toBe(60);
    expect(freezeFor(2700, 13)).toBe(55);
    for (const T of LENGTHS) for (const n of [0, 1, 2, 3, 5, 8, 13, 40]) {
      const f = freezeFor(T, n);
      expect(f).toBeGreaterThanOrEqual(FREEZE_MIN);
      expect(f).toBeLessThanOrEqual(FREEZE_MAX);
      expect(freezeFor(T, n + 1)).toBeGreaterThanOrEqual(f);
    }
    // the player's own dial is kept (in range)
    const order = storiesFor('adult', false);
    expect(planFor({ plannedSec: 1200, eeg: false, order, focus: 45, rest: 3, custom: true }).freeze).toBe(45);
    expect(planFor({ plannedSec: 1200, eeg: false, order, focus: 200, rest: 3, custom: true }).freeze).toBe(60);
    expect(planFor({ plannedSec: 1200, eeg: false, order, focus: 5, rest: 3, custom: true }).freeze).toBe(20);
  });

  it('lets a tap on the last beat of the telling start the freeze early, never longer than 60 s', () => {
    const sim = makeSim({ planned: 600, progress: { sessions: 20 } });
    const clock = { t: 0 };
    drive(sim, sim.plan.introEnd + 0.2, LOW, clock);
    expect(sim.block.what).toBe('tell');
    // the beats go on at once; the last one holds until the freeze would not pass 60 s
    let guard = 0, early = false;
    while (sim.block.what === 'tell' && guard++ < 400) {
      const before = sim.block.t1;
      if (sim.next() && (sim.block.what as string) === 'freeze') early = before - clock.t > 0.2;
      drive(sim, 0.2, LOW, clock);
    }
    expect(early).toBe(true);
    expect(sim.block.what).toBe('freeze');
    expect(sim.block.t1 - sim.block.t0).toBeLessThanOrEqual(FREEZE_MAX + 1e-6);
    expect(sim.block.t1 - sim.block.t0).toBeGreaterThanOrEqual(sim.plan.freeze - 1e-6);
  });
});

// ── the session ───────────────────────────────────────────────────

describe('Stop-klatka — the session', () => {
  it('scores in a 40 s test at half focus (app:smoke), with Mendi and with HALO', () => {
    for (const eeg of [false, true]) for (const fresh of [false, true]) {
      const sim = makeSim({ planned: 40, eeg, progress: fresh ? { sessions: 0, ageSet: false, seen: [] } : {} });
      expect(sim.plan.test).toBe(true);
      play(sim, HALF);
      expect(sim.result().score, `eeg=${eeg} fresh=${fresh}`).toBeGreaterThan(0);
    }
  });

  it('charges nothing without focus: rest, an unreliable signal, focus outside the freeze', () => {
    for (const f of [LOW, UNRELIABLE] as FocusFrame[]) {
      const sim = makeSim({ planned: 600 });
      const ev = play(sim, f);
      expect(sim.mastered).toBe(0);
      expect(ofType(ev, 'charged')).toHaveLength(0);
      for (const r of sim.runs) expect(r.clarity).toBe(0);
    }
    // focus only in the rests (the telling and the after) charges nothing either
    const sim = makeSim({ planned: 600 });
    play(sim, (_t, s) => (s.pushBlock ? LOW : HIGH));
    expect(sim.mastered).toBe(0);
  });

  it('charges with focus: every freeze of a strong player, the steps in order, the ways chosen, the lessons told', () => {
    const sim = makeSim({ planned: 900 });
    const ev = play(sim, player(HIGH));
    expect(sim.met).toBe(sim.runs.length);
    expect(sim.mastered).toBe(sim.met);
    expect(ofType(ev, 'freeze')).toHaveLength(sim.met);
    expect(ofType(ev, 'flow')).toHaveLength(sim.met);
    for (const r of sim.runs) {
      expect(r.named).not.toBeNull();
      expect(r.way).not.toBeNull();
      expect(r.lines).toBe(r.story.second.length);
      expect(r.charged).toBe(true);
      expect(r.chargedAt).toBeLessThan(r.fzT1 - r.fzT0);
    }
    expect(ofType(ev, 'part').filter(e => e.part === 'lesson')).toHaveLength(sim.met);
    const res = sim.result();
    expect(res.score).toBe(sim.mastered);
    expect(res.verse && passage(res.verse).text).toBeTruthy();
  });

  it('names, chooses and reads on by the hand; a story told again offers the other way first', () => {
    const sim = makeSim({ planned: 3600, progress: { sessions: 20 } });
    const clock = { t: 0 };
    let tapped = false, chosenAway = false;
    const evs: SimEvent[] = [];
    while (clock.t < sim.T) {
      drive(sim, 0.25, (_t, s) => (s.pushBlock ? AVG : LOW), clock, evs);
      if (sim.chips.length) tapped = sim.nameAt(sim.chips.length - 1) || tapped;
      if (sim.ways.length && !sim.cur?.way) chosenAway = sim.choose(1) || chosenAway;
    }
    expect(tapped).toBe(true);
    expect(chosenAway).toBe(true);
    expect(ofType(evs, 'named').some(e => e.by === 'player')).toBe(true);
    // the second round offered the other way first
    const again = sim.runs.filter(r => r.plan.round > 0);
    expect(again.length).toBeGreaterThan(0);
    const firstRound = new Map(sim.runs.filter(r => r.plan.round === 0).map(r => [r.story.id, r.way]));
    for (const r of again.filter(x => x.plan.round === 1)) expect(r.firstWay).not.toBe(firstRound.get(r.story.id));
    // the player's named feelings are counted in the progress (their own taps only)
    expect(Object.values(sim.p.named).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('asks the age on the first card when the lobby was not touched, keeps the pick, and plans its stories', () => {
    const sim = makeSim({ planned: 600, progress: { sessions: 0, ageSet: false, age: 'adult', seen: [] } });
    expect(sim.plan.askEnd).toBeGreaterThan(0);
    const clock = { t: 0 };
    drive(sim, sim.plan.openEnd + 0.5, LOW, clock);
    expect(sim.askOpen).toBe(true);
    expect(sim.pickAge(0)).toBe(true);
    expect(sim.p.age).toBe('teen');
    expect(sim.p.ageSet).toBe(true);
    expect(sim.runs.every(r => r.story.age === 'teen')).toBe(true);
    // the plan stays whole: contiguous, ending at T
    for (let i = 1; i < sim.plan.blocks.length; i++) expect(Math.abs(sim.plan.blocks[i].t0 - sim.plan.blocks[i - 1].t1)).toBeLessThan(1e-6);
    play(sim, player(AVG));
    sim.finish();
    expect(sim.p.ageSet).toBe(true);
    // a lobby that set the age: no card
    expect(makeSim({ planned: 600, progress: { sessions: 0, ageSet: true, age: 'mid' } }).plan.askEnd).toBe(0);
    // a test never asks
    expect(makeSim({ planned: 40, progress: { sessions: 0, ageSet: false } }).plan.askEnd).toBe(0);
  });

  it('continues the next session where this one stopped (no repeat until all are told)', () => {
    const p: StopProgress = { ...freshProgress(), sessions: 3, ageSet: true, age: 'young' };
    const told: string[] = [];
    for (let s = 0; s < 4; s++) {
      const sim = new StopSim({ progress: p, rng: mulberry32(s), plannedSec: 300, eeg: false, tuning: TUNING, day: '2026-11-27' });
      sim.start();
      play(sim, player(AVG));
      sim.finish();
      told.push(...sim.runs.filter(r => r.met).map(r => r.story.id));
    }
    const order = storiesFor('young', false).map(s => s.id);
    expect(told.slice(0, order.length)).toEqual([...order, ...order].slice(0, Math.min(told.length, order.length)));
    expect(startIn(p, storiesFor('young', false))).toBe(told.length % order.length);
  });

  it('fits the work to the player: ≥ 90 % of the freezes charged once the pace is learned (3–60 min × weak/threshold/strong × sessions)', () => {
    const players: Record<string, FrameFn> = {
      strong: player(HIGH),
      threshold: player(AVG),
      // focused 6 s of every 10
      weak: (t, s) => (s.pushBlock && t % 10 < 6 ? AVG : LOW),
    };
    const report: string[] = [];
    for (const [name, fn] of Object.entries(players)) {
      for (const T of [180, 600, 1800, 3600]) {
        const p: StopProgress = { ...freshProgress(), ageSet: true, age: 'adult' };
        const rates: number[] = [];
        for (let s = 1; s <= 13; s++) {
          const sim = new StopSim({ progress: p, rng: mulberry32(s), plannedSec: T, eeg: false, tuning: TUNING, day: '2026-11-27' });
          sim.start();
          play(sim, fn, 0.1);
          sim.finish();
          if ([1, 2, 5, 13].includes(s)) rates.push(sim.met ? sim.mastered / sim.met : 1);
        }
        report.push(`${name} ${T / 60} min: ${rates.map(r => Math.round(r * 100)).join('/')} %`);
        // learned (sessions 5 and 13)
        expect(rates[2], `${name} ${T}`).toBeGreaterThanOrEqual(0.9);
        expect(rates[3], `${name} ${T}`).toBeGreaterThanOrEqual(0.9);
      }
    }
    console.log(report.join('\n'));
  }, 60_000);

  it('stays alive and bounded at 45 and 60 minutes: stories to the end, few summary lines, a clean result', () => {
    for (const T of [2700, 3600]) for (const a of AGES) {
      const sim = makeSim({ planned: T, progress: { age: a, sessions: 20, heavy: true } });
      play(sim, player(AVG), 0.1);
      sim.finish();
      expect(sim.met, `${a} ${T}`).toBe(sim.runs.length);
      expect(sim.runs.length).toBeLessThanOrEqual(RULES.storiesMax);
      // the last story ends near the session's end (the close a minute or so)
      expect(T - sim.plan.closeStart).toBeLessThanOrEqual(Math.max(90, T * 0.12));
      const res = sim.result();
      expect(res.stats.length).toBeLessThanOrEqual(5);
      expect(res.highlights.length).toBeLessThanOrEqual(6);
      expect(Number.isFinite(res.score)).toBe(true);
    }
  }, 60_000);

  it('keeps nothing of the player in the result, and repairs a hostile save', () => {
    const hostile = { ...freshProgress(), ver: 1, sessions: 3, note: 'MOJE TAJNE SŁOWA', age: 'mid', ageSet: true, next: { mid: 'nope', teen: 7 }, named: { anger: 'x', hurt: 2 }, pace: 99, seen: 'x' } as unknown as StopProgress;
    migrate(hostile);
    expect(JSON.stringify(hostile)).not.toContain('TAJNE');
    expect(hostile.next.mid).toBe('');
    expect(hostile.named.anger).toBe(0);
    expect(hostile.named.hurt).toBe(2);
    expect(hostile.pace).toBe(RULES.paceMax);
    const sim = makeSim({ planned: 300, progress: hostile });
    play(sim, player(AVG));
    sim.finish();
    const res = JSON.stringify(sim.result());
    expect(res).not.toContain('TAJNE');
    // a broken save keeps its session count only
    const broken = { ver: 0, sessions: 5, age: 'xx' } as unknown as StopProgress;
    migrate(broken);
    expect(broken.sessions).toBe(5);
    expect(broken.age).toBe('adult');
    expect(broken.ageSet).toBe(false);
    // setters reject the wrong types
    const p = freshProgress();
    expect(setAge(p, 'old')).toBe(false);
    expect(setAge(p, 'senior')).toBe(true);
    expect(p.ageSet).toBe(true);
    expect(setHeavy(p, 'yes')).toBe(false);
    expect(setHeavy(p, true)).toBe(true);
  });

  it('uses only passages that exist; the root and the closing ones in four editions', () => {
    for (const id of [ROOT, ...CLOSE_VERSES]) for (const l of LANGS) expect(passage(id, l).text, `${id} ${l}`).toBeTruthy();
  });
});

// ── the words ────────────────────────────────────────────────────

const ownTexts = (l: 'pl' | 'en' | 'de' | 'sv'): [string, string][] => {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(CATALOGS[l])) out.push([k, typeof v === 'string' ? v : Object.values(v).join(' ')]);
  for (const [k, v] of Object.entries(ARCADE_TEXTS[l])) if (k.startsWith('stopklatka.')) out.push([k, String(v)]);
  for (const [k, v] of Object.entries(MOUSE_TEXTS[l])) if (k.startsWith('stopklatka.')) out.push([k, String(v)]);
  return out;
};

describe('Stop-klatka — the words', () => {
  it('has every word in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    for (const l of LANGS) {
      for (const k of ['title', 'tagline', 'text', 'how1', 'how2', 'how3', 'tip1', 'tip2', 'tip3', 'tip4', 'tip5', 'unit', 'brainFocus', 'brainRest', 'meter', 'meterRest']) {
        expect((ARCADE_TEXTS[l] as Record<string, string>)[`stopklatka.${k}`], `${l}.${k}`).toBeTruthy();
      }
      expect((MOUSE_TEXTS[l] as Record<string, string>)['stopklatka.how3'], l).toBeTruthy();
    }
  });

  it('never gives the player a gender in Polish (the game\'s words and the stories\' narration)', () => {
    const GENDERED = /\p{L}+(łeś|łaś|łbyś|łabyś)(?!\p{L})|(?<!\p{L})(gotowy|gotowa|gotów|zmęczony|zmęczona|wdzięczny|wdzięczna|zły|zła)\s+(jesteś)|(?<!\p{L})jesteś\s+\p{L}{2,}(ny|na|ty|ta|wy|wa)(?!\p{L})|\p{L}+(y|i)\/a(?!\p{L})/giu;
    const hits: string[] = [];
    for (const [k, s] of ownTexts('pl')) for (const m of s.matchAll(GENDERED)) hits.push(`${k}: "${m[0]}"`);
    for (const s of ALL_STORIES) {
      for (const txt of [...s.beats.map(b => b.text), s.trigger, s.urge, ...s.second, s.answer, s.outcome.text, s.lesson]) {
        for (const m of txt.matchAll(GENDERED)) hits.push(`${s.id}: "${m[0]}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('keeps the heart series\' forbidden words out: light and prayer, never energy, healing power, chakras', () => {
    const FORBID: Record<string, RegExp> = {
      pl: /energi|uzdrawia|leczy|czakr|kundalini/i,
      en: /energy|heal(s|ing)? power|\bcures?\b|chakra|kundalini/i,
      de: /energie|heilt|chakra|kundalini/i,
      sv: /energi|\bhelar\b|chakra|kundalini/i,
    };
    for (const l of LANGS) for (const [k, s] of ownTexts(l)) expect(FORBID[l].test(s), `${l}.${k}: ${s}`).toBe(false);
  });

  it('says the band measures attention and that this is not therapy, with the help lines', () => {
    for (const l of LANGS) {
      const tip5 = (ARCADE_TEXTS[l] as Record<string, string>)['stopklatka.tip5'];
      expect(tip5).toMatch(/116 111|112/);
      expect(CATALOGS[l]['panel.help']).toMatch(/116 111/);
    }
    expect(CATALOGS.pl['panel.help']).toMatch(/116 123/);
  });

  it('has the "why" with its opening pages and its card in four languages', () => {
    for (const l of LANGS) {
      const w = WHY[l];
      expect(Object.keys(w).length, l).toBeGreaterThan(0);
      expect(openPages(l).length, l).toBeGreaterThanOrEqual(1);
      for (const p of openPages(l)) expect(len(p), `${l}: ${p}`).toBeLessThanOrEqual(160);
      expect(whyCard(l).paras.length, l).toBeGreaterThan(2);
    }
  });

  it('names the unit by the number', () => {
    expect(mod.unit!(1)).toBe('opanowana chwila');
    expect(mod.unit!(3)).toBe('opanowane chwile');
    expect(mod.unit!(5)).toBe('opanowanych chwil');
  });
});

// ── the screen ───────────────────────────────────────────────────

describe('Stop-klatka — the controls at every size', () => {
  it('keeps the age chips, the feelings and the ways ≥ 44 px, inside the band, apart', () => {
    for (const size of CHECK_SIZES) for (const touch of [true, false]) {
      const l = layout(size.w, size.h, size.insets, touch);
      const hud = new Hud();
      hud.resize(l, null);
      // the age card
      const ask = makeSim({ planned: 600, progress: { sessions: 0, ageSet: false, seen: [] } });
      drive(ask, ask.plan.openEnd + 0.5, LOW);
      expect(ask.askOpen).toBe(true);
      const insets = { ...size.insets };
      expect(auditTargets(hud.targets(ask), size.w, size.h, insets), `${size.name} ask`).toEqual([]);
      // a freeze's feelings, then its ways
      const sim = makeSim({ planned: 600 });
      const clock = { t: 0 };
      while (!sim.chips.length && clock.t < sim.T) drive(sim, 0.25, LOW, clock);
      expect(sim.chips.length).toBeGreaterThan(0);
      expect(hud.targets(sim).length).toBe(sim.chips.length);
      expect(auditTargets(hud.targets(sim), size.w, size.h, insets), `${size.name} chips`).toEqual([]);
      while (!sim.ways.length && clock.t < sim.T) drive(sim, 0.25, LOW, clock);
      expect(sim.ways.length).toBe(2);
      expect(auditTargets(hud.targets(sim), size.w, size.h, insets), `${size.name} ways`).toEqual([]);
      // a tap on a target hits it
      const tg = hud.targets(sim)[1];
      expect(hud.hit(sim, tg.x + tg.w / 2, tg.y + tg.h / 2)).toEqual({ kind: 'way', i: 1 });
    }
  });
});

// ── the lobby and the registry ───────────────────────────────────

describe('Stop-klatka — the lobby and the registry', () => {
  it('stands in the heart series right after Każda myśl, rooted in Proverbs 16:32', () => {
    const e = arcadeEntry('stopklatka')!;
    expect(e).toBeTruthy();
    expect(e.kind).toBe('heart');
    expect(e.root).toBe('pro16.32');
    expect(e.tools).toEqual(['fnirs', 'eeg']);
    expect(e.tuning).toEqual({ adapt: 0.08 });
    const ids = ARCADE.map(a => a.id);
    expect(ids[ids.indexOf('mysli') + 1]).toBe('stopklatka');
  });

  it('builds its card: the five age chips (saved), the heavy switch, the forecast, the why, the help lines', () => {
    const p = freshProgress();
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    const chips = el.querySelectorAll('[data-age]');
    expect(chips).toHaveLength(5);
    (chips[4] as HTMLButtonElement).click();
    expect(saved).toBe(1);
    expect(p.age).toBe('senior');
    expect(p.ageSet).toBe(true);
    (el.querySelector('[data-stop="heavy-on"]') as HTMLButtonElement).click();
    expect(p.heavy).toBe(true);
    expect(el.textContent).toContain('116 111');
    expect(el.querySelector('details')).toBeTruthy();
    expect(forecastLine(p, 600)).toMatch(/10/);
    expect(mod.best(freshProgress())).toBeNull();
  });

  it('offers the rhythm dials and the how-to', () => {
    const r = stopRhythm();
    expect(r.focus.min).toBe(FREEZE_MIN);
    expect(r.focus.max).toBe(FREEZE_MAX);
    expect(r.rest.min).toBe(1);
    expect(howto(true).hands).toHaveLength(1);
    expect(howto(false).hands).toHaveLength(2);
    expect(t('intro.title')).toBe('Stop-klatka');
    void (null as unknown as Age);
  });
});
