/**
 * The health visualisations' engine (src/arcade/kit/healthlib, DESIGN §24): Każdy włos's rules generalised and run on
 * a small fixture library (test/fixtures/healthlib.ts) — growth only from focus, blind pushes, the walk and the
 * modes, resume, the meta, the rhythm, the 40 s smoke session, checkLibrary catching each kind of problem, the
 * engine's own words, and the layout and its text at every checked size (a fake canvas records what is drawn).
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, makeHealthModule, simSession } from '../src/arcade/kit/healthlib';
import { FORBIDDEN, maxLen, requiredKeys, toneProblems } from '../src/arcade/kit/healthlib/check';
import { coachText, howto, rhythm } from '../src/arcade/kit/healthlib/index';
import { ENGINE } from '../src/arcade/kit/healthlib/i18n';
import { MODES, libOf, translatorFor } from '../src/arcade/kit/healthlib/lib';
import { CONTROLS, hitAt, layout, pickerLayout, storyRect, tapTargets } from '../src/arcade/kit/healthlib/layout';
import { bestOf, choose, cleanPos, foreignSave, freshProgress, markSeen, medsDone, migrate, scenesGrown, setLook, setMode, type HealthProgress } from '../src/arcade/kit/healthlib/meta';
import { HealthView } from '../src/arcade/kit/healthlib/render';
import { BREATH, RULES } from '../src/arcade/kit/healthlib/rules';
import { HealthSim, finaleFor, growMult, planBlocks, resumeFrom, type SimEvent } from '../src/arcade/kit/healthlib/sim';
import type { HealthLibrary, SceneSpec } from '../src/arcade/kit/healthlib/spec';
import { ALL_SEEN, FRAMES } from '../src/arcade/kit/healthlib/testing';
import { wordsGuide } from '../src/arcade/kit/healthlib/hud';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { rhythmOf } from '../src/arcade/kit/rhythm';
import { passage } from '../src/arcade/kit/scripture';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TAP, MIN_TEXT, auditTargets, screenKind } from '../src/arcade/kit/mobile';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, type Catalog, type Lang } from '../src/i18n';
import { FIXTURE } from './fixtures/healthlib';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };
const { high: HIGH, mid: MID, unfocused: UNFOCUSED, calm: CALM, none: NONE } = FRAMES;
const LIB = libOf(FIXTURE);

type SimOpts = { lib?: HealthLibrary; progress?: Partial<HealthProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; rhythm?: { focus: number; rest: number } | null };

function makeSim(o: SimOpts = {}): HealthSim {
  const lib = o.lib ?? FIXTURE;
  const sim = new HealthSim({
    lib, progress: { ...freshProgress(lib), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: o.tuning ?? TUNING, rhythm: o.rhythm,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

/** Close any story card as a player would (a tap after it has been up a moment). */
const reader = (sim: HealthSim) => () => { if (sim.story && sim.story.t > 1) sim.stay(); };

function drive(sim: HealthSim, sec: number, f: FocusFrame | ((t: number, sim: HealthSim) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Run until a sighted push has begun (its lead-in passed) with the scene growing, returns the clock. */
function untilSighted(sim: HealthSim, clock = { t: 0 }, f: FocusFrame = MID): { t: number } {
  let guard = 0;
  while (!(sim.sighted && sim.stage === 'at') && guard++ < 4000) drive(sim, 0.05, (_t, s) => (s.restBlock ? CALM : f), clock, reader(sim));
  return clock;
}

/** A copy of the fixture with some of it changed (for checkLibrary's cases). */
function variant(change: (lib: { -readonly [K in keyof HealthLibrary]: HealthLibrary[K] }, words: Record<Lang, Record<string, unknown>>) => void): HealthLibrary {
  const words = Object.fromEntries((['pl', 'en', 'de', 'sv'] as const).map(l => [l, { ...FIXTURE.words[l] }])) as Record<Lang, Record<string, unknown>>;
  const lib = { ...FIXTURE, meds: FIXTURE.meds.map(m => ({ ...m, scenes: [...m.scenes] })), scenes: { ...FIXTURE.scenes }, worlds: { ...FIXTURE.worlds }, words: words as unknown as HealthLibrary['words'] };
  change(lib, words);
  return lib;
}

const problems = (lib: HealthLibrary, allow?: { text: string; why: string }[]) => checkLibrary(lib, { allow }).join('\n');

// ── a fake canvas: records every text drawn with its font size ──────
// node has no Path2D (the lens's outline): a path that remembers nothing is enough here
if (typeof (globalThis as { Path2D?: unknown }).Path2D === 'undefined') {
  (globalThis as { Path2D?: unknown }).Path2D = class {
    moveTo(): void {}
    lineTo(): void {}
    arcTo(): void {}
    arc(): void {}
    closePath(): void {}
    quadraticCurveTo(): void {}
    bezierCurveTo(): void {}
    rect(): void {}
    roundRect(): void {}
    ellipse(): void {}
  };
}

interface Drawn { text: string; px: number }
function fakeCtx(): { ctx: CanvasRenderingContext2D; texts: Drawn[] } {
  const texts: Drawn[] = [];
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1 };
  const pxOf = (f: unknown) => Number(String(f).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
  const ctx = new Proxy(state, {
    get(t, k) {
      if (k === 'measureText') return (s: string) => ({ width: [...s].length * pxOf(t.font) * 0.55 });
      if (k === 'fillText' || k === 'strokeText') return (s: string) => { if (k === 'fillText' && String(s).trim()) texts.push({ text: String(s), px: pxOf(t.font) }); };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'getTransform') return () => ({ a: 1, d: 1 });
      if (k in t) return t[k];
      return () => {};
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

/** A verse's reference line ("Ps 139,13–14 · Biblia Gdańska") may be 11 px; everything else read is 13 px and more. */
const isRef = (s: string) => / · /.test(s) && /\d/.test(s) && !/^\d+\/\d+/.test(s);

// ── the library as the engine reads it ─────────────────────────────
describe('the library (lib.ts)', () => {
  it('lists the meditations and scenes in order and walks them round, both ways', () => {
    expect(LIB.meds).toEqual(['jeden', 'dwa', 'trzy', 'cale']);
    expect(LIB.scenes).toHaveLength(10);
    expect(LIB.step('jeden', 1, 1)).toEqual({ med: 'dwa', i: 0 });
    expect(LIB.step('jeden', 0, -1)).toEqual({ med: 'cale', i: 2 });
    expect(LIB.step('cale', 2, 1)).toEqual({ med: 'jeden', i: 0 });
    expect(LIB.medOf('b3')).toBe('dwa');
    expect(LIB.sceneAt('dwa', 9)).toBe('b3');
    expect(LIB.focusAt('a1', 1)).toEqual([50, 40]);
    expect(LIB.focusAt('a2', 0.5)).toEqual([50, 50]);
  });

  it('translates the game’s keys first, then the engine’s; bends the unit; reads the narrator’s lines', () => {
    expect(LIB.t('mode.order')).toBe('Po kolei');
    expect(LIB.unitsText(5)).toBe('5 iskier');
    expect(LIB.unit(3)).toBe('iskry');
    expect(LIB.unit(1)).toBe('iskra');
    const over = translatorFor({ ...FIXTURE.words, pl: { ...FIXTURE.words.pl, 'mode.order': 'Kolejno' } as Catalog<string> }, 'pl');
    expect(over.t('mode.order')).toBe('Kolejno');
    expect(over.t('ctl.next')).toBe('Następna scena');
    expect(libOf(FIXTURE, 'de').t('story.care')).toBe('Im Alltag');
    expect(libOf(FIXTURE, 'sv').unitsText(2)).toBe('2 gnistor');
    expect(LIB.linesOf('open')).toHaveLength(3);
    expect(LIB.linesOf('at.a1')).toHaveLength(1);
    expect(LIB.linesOf('rest')[0]).toMatch(/odpocznij/i);
    expect(LIB.medCare('jeden')).toMatch(/7–9/);
    expect(LIB.hasTune).toBe(false);
  });

  it('asks for the scene’s picture in a push, and every third push the counting strategy', () => {
    expect(LIB.pushTip('a1', 0)).toBe(LIB.t('tip.a1'));
    expect(LIB.pushTip('a1', 2)).toBe(LIB.t('tip.count'));
  });
});

// ── checkLibrary ────────────────────────────────────────────────────
describe('checkLibrary (check.ts)', () => {
  it('passes the fixture', () => {
    expect(checkLibrary(FIXTURE)).toEqual([]);
    expect(requiredKeys(FIXTURE)).toContain('med.cale.care');
    expect(requiredKeys(FIXTURE)).toContain('part.edge');
    expect(requiredKeys(FIXTURE)).toContain('look.dark');
  });

  it('catches the shape: 4–6 meditations of 2–4 scenes, each scene in exactly one, worlds, views, perScene', () => {
    expect(problems(variant(l => { l.meds = l.meds.slice(0, 3); }))).toMatch(/3 meditations/);
    expect(problems(variant(l => { l.meds = l.meds.map((m, i) => (i === 1 ? { ...m, scenes: ['b1', 'b2', 'b3', 'a1', 'a2'] } : m)); }))).toMatch(/med.dwa: 5 scenes[\s\S]*in jeden and dwa/);
    expect(problems(variant(l => { l.meds = l.meds.map((m, i) => (i === 0 ? { ...m, scenes: ['a1'] } : m)); }))).toMatch(/1 scenes[\s\S]*scene.a2: in no meditation/);
    expect(problems(variant(l => { l.meds = l.meds.map((m, i) => (i === 0 ? { ...m, scenes: ['a1', 'zz'] } : m)); }))).toMatch(/scene.zz: named by jeden but not in scenes/);
    expect(problems(variant(l => { l.scenes = { ...l.scenes, a1: { ...l.scenes.a1, world: 'moon' } }; }))).toMatch(/world “moon” does not exist/);
    const out = (sc: SceneSpec): SceneSpec => ({ ...sc, labels: [{ part: 'core', at: [140, 20], side: 1, from: 0.2 }], focus: [-5, 50] });
    expect(problems(variant(l => { l.scenes = { ...l.scenes, b1: out(l.scenes.b1) }; }))).toMatch(/growing point[\s\S]*label “core” at \[140, 20\] is outside/);
    expect(problems(variant(l => { l.worlds = { ...l.worlds, body: { ...l.worlds.body, focusAt: () => [200, 0] } }; }))).toMatch(/focusAt\(0\)/);
    expect(problems(variant(l => { l.perScene = 0; }))).toMatch(/perScene/);
    expect(problems(variant(l => { l.id = 'Bad Id'; }))).toMatch(/registry id/);
  });

  it('catches verses that are not in all four editions', () => {
    expect(problems(variant(l => { l.meds = l.meds.map((m, i) => (i === 2 ? { ...m, verse: 'nope1.1' as never } : m)); }))).toMatch(/med.trzy.verse: passage “nope1.1”/);
    expect(problems(variant(l => { l.root = 'nope2.2' as never; l.closers = ['nope3.3' as never]; }))).toMatch(/root[\s\S]*closers/);
  });

  it('catches missing and extra keys, placeholders, the unit’s plural, and lengths', () => {
    expect(problems(variant((_l, w) => { delete w.de['med.trzy.care']; }))).toMatch(/de.med.trzy.care: missing/);
    expect(problems(variant((_l, w) => { delete w.pl['say.at.c2.1']; delete w.en['say.at.c2.1']; delete w.de['say.at.c2.1']; delete w.sv['say.at.c2.1']; }))).toMatch(/pl.say.at.c2.1: missing/);
    expect(problems(variant((_l, w) => { w.sv['extra.key'] = 'x'; }))).toMatch(/sv.extra.key: not in pl/);
    // an engine key a game overrides in pl must be in en, de and sv too
    expect(problems(variant((_l, w) => { w.pl['panel.look'] = 'Odcień'; w.en['panel.look'] = 'Shade'; }))).toMatch(/de.panel.look: missing[\s\S]*sv.panel.look: missing/);
    expect(problems(variant((_l, w) => { delete w.de['med.trzy.care']; })).match(/de\.med\.trzy\.care: missing/g)).toHaveLength(1);
    expect(problems(variant((_l, w) => { w.en['scene.a1'] = 'Scene {x}'; }))).toMatch(/en.scene.a1: placeholders/);
    expect(problems(variant((_l, w) => { w.pl.unit = 'iskry'; }))).toMatch(/pl.unit: a plural/);
    const long = (n: number) => 'a '.repeat(n).slice(0, n);
    for (const [key, n] of [['say.open.1', 91], ['part.core', 23], ['teach.a1', 221], ['tip.a1', 121], ['med.jeden.care', 141]] as const) {
      expect(maxLen(key)).toBe(n - 1);
      expect(problems(variant((_l, w) => { w.en[key] = long(n); })), key).toMatch(new RegExp(`en.${key.replace(/\./g, '\\.')}: ${n} characters`));
    }
  });

  it('catches the forbidden words in each language and the Polish gendered second person; allows a phrase with its reason', () => {
    const cases: [Lang, string, RegExp][] = [
      ['pl', 'Ta medytacja uleczy Twoje kości.', /heal you/], ['pl', 'Szkliwo odrośnie.', /regrow/], ['pl', 'Odmłodzi skórę.', /reverse ageing/],
      ['pl', 'Pole energii wokół ciała.', /energy field/], ['pl', 'Wibracje komórek.', /vibration/], ['pl', 'Aktywuj komórki.', /activate/], ['pl', 'Detoks dla wątroby.', /detox/],
      ['en', 'This will cure it.', /cure/], ['en', 'It heals your spine.', /heal you/], ['en', 'Reverse ageing now.', /reverse ageing/], ['en', 'Discs regrow.', /regrow/],
      ['en', 'Activate your cells.', /activate/], ['en', 'Manifest health.', /manifest/],
      ['de', 'Das heilt dich.', /heal you/], ['de', 'Die Haut verjüngt sich.', /reverse ageing/], ['de', 'Zähne wachsen nach.', /regrow/], ['de', 'Ein Energiefeld.', /energy field/],
      ['sv', 'Det läker dig.', /heal you/], ['sv', 'Huden föryngras.', /reverse ageing/], ['sv', 'Ett energifält.', /energy field/], ['sv', 'En detox.', /detox/],
    ];
    for (const [l, text, what] of cases) expect(toneProblems({ [l]: { 'teach.x': text } }).join('\n'), `${l}: ${text}`).toMatch(what);
    // words that merely contain a forbidden word are fine; so is "not a treatment"
    expect(toneProblems({ en: { a: 'A secure, curious picture.' }, pl: { a: 'To wizualizacja, nie leczenie.' }, de: { a: 'Keine Behandlung.' }, sv: { a: 'Inte behandling.' } })).toEqual([]);
    for (const s of ['Gdy już zrobiłeś krok…', 'Czy jesteś gotowy/a?', 'Jesteś gotowa.', 'Zobaczyłaś to.']) {
      expect(toneProblems({ pl: { 'say.x': s } }).join('\n'), s).toMatch(/gendered/);
    }
    expect(toneProblems({ pl: { 'teach.x': 'Szkliwo nie odrasta; chroni je fluor.' } }).join('\n')).toMatch(/regrow/);
    expect(toneProblems({ pl: { 'teach.x': 'Szkliwo nie odrasta; chroni je fluor.' } }, [{ text: 'Szkliwo nie odrasta', why: 'the myth corrected' }])).toEqual([]);
    expect(problems(variant((_l, w) => { w.pl['teach.a1'] = 'Szkliwo nie odrasta.'; }), [{ text: 'szkliwo nie odrasta', why: 'the myth corrected' }])).toBe('');
    for (const l of ['pl', 'en', 'de', 'sv'] as const) expect(FORBIDDEN[l].length).toBeGreaterThanOrEqual(9);
  });
});

// ── the engine's own words ─────────────────────────────────────────
describe('the engine’s words (i18n.ts)', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(ENGINE)).toEqual([]);
  });

  it('keeps its own tone: no forbidden word, no gendered Polish, the narrator within a caption, no part of the body', () => {
    expect(toneProblems(ENGINE as unknown as Record<Lang, Catalog<string>>)).toEqual([]);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, m] of Object.entries(ENGINE[l])) {
        const max = maxLen(k);
        if (max !== null && typeof m === 'string') expect(m.length, `${l}.${k}`).toBeLessThanOrEqual(max);
        const s = typeof m === 'string' ? m : m.other;
        expect(s, `${l}.${k}`).not.toMatch(/włos|hair|Haar|hårstr/i);
      }
    }
    expect(ENGINE.pl['story.care']).toBe('Na co dzień');
    expect(ENGINE.en['story.care']).toBe('Every day');
    expect(ENGINE.de['story.care']).toBe('Im Alltag');
    expect(ENGINE.sv['story.care']).toBe('I vardagen');
  });

  it('speaks to the hand the player has: a finger never hears of keys, a mouse clicks and has keys', () => {
    const touch = howto(LIB, true), keys = howto(LIB, false);
    expect(touch.hands.every(hd => hd.gesture !== 'keys')).toBe(true);
    expect(keys.hands.some(hd => hd.gesture === 'keys')).toBe(true);
    expect(keys.hands[0].text).toMatch(/^Kliknij/);
    expect(touch.hands[0].text).toMatch(/^Stuknij/);
    expect(touch.goal).toBe(LIB.t('howto.goal'));
    expect(touch.tips).toEqual([LIB.t('howto.tip1'), LIB.t('howto.tip2')]);
    expect(coachText(LIB, 'nav', true)).not.toMatch(/klawisz|←/);
    expect(coachText(LIB, 'nav', false)).toMatch(/←/);
    expect(coachText(LIB, 'pick', false)).toMatch(/M/);
  });
});

// ── growth ──────────────────────────────────────────────────────────
describe('growth only from real focus (the founder’s rule)', () => {
  it('grows a scene in a sighted push only while the band reads focus', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, UNFOCUSED);
    const g0 = sim.g;
    drive(sim, 4, UNFOCUSED, clock);
    expect(sim.g).toBe(g0);
    expect(sim.growing).toBe(false);
    drive(sim, 4, MID, clock);
    expect(sim.g).toBeGreaterThan(g0);
    expect(sim.growing).toBe(true);
  });

  it('never grows in the lead-in, in rest, without a signal, or under a story card — and never takes back', () => {
    const sim = later();
    drive(sim, RULES.leadIn.fnirs - 0.5, HIGH);
    expect(sim.g).toBe(0);
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 3, NONE, clock);
    const kept = sim.g;
    drive(sim, 3, NONE, clock);
    expect(sim.g).toBe(kept);
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    const atRest = sim.g;
    const d0 = sim.deep;
    drive(sim, 12, CALM, clock);
    expect(sim.g).toBe(atRest);
    expect(sim.deep).toBeGreaterThan(d0);
    expect(sim.meter()).toBeCloseTo(sim.calmShown, 9);
    const first = makeSim({ tuning: BEGINNER });
    expect(first.story?.kind).toBe('open');
    drive(first, 10, HIGH);
    expect(first.g).toBe(0);
  });

  it('counts the library’s units with growth only: perScene a scene at the rate of focus', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    const u0 = sim.units, g0 = sim.g;
    drive(sim, 5, HIGH, clock);
    expect(sim.units - u0).toBeCloseTo((sim.g - g0) * FIXTURE.perScene, 6);
    const u1 = sim.units;
    drive(sim, 3, UNFOCUSED, clock);
    expect(sim.units).toBe(u1);
    expect(sim.growRate(HIGH)).toBeCloseTo(growMult(HIGH) / RULES.sceneSec, 9);
    expect(sim.growRate(UNFOCUSED)).toBe(0);
    expect(sim.growRate(NONE)).toBe(0);
  });

  it('a blind push grows unseen, keeps the headline still, and shows it all at its end (carry ≤ 0.6)', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    while (sim.blind && (sim.blockT < sim.leadIn + 0.5 || sim.stage !== 'at')) drive(sim, 0.1, HIGH, clock, reader(sim));
    const shown = sim.g, score = sim.score;
    drive(sim, 4, HIGH, clock, reader(sim));
    expect(sim.blind).toBe(true);
    expect(sim.meter()).toBeNull();
    expect(sim.songLevel(HIGH)).toBeNull();
    expect(sim.g).toBe(shown);
    expect(sim.score).toBe(score);
    expect(sim.hidden).toBeGreaterThan(0);
    expect(sim.hidden).toBeLessThanOrEqual(1 - shown + RULES.blindCarry + 1e-9);
    const evs: SimEvent[] = [];
    let guard = 0;
    while (sim.blind && guard++ < 2000) evs.push(...drive(sim, 0.1, HIGH, clock, reader(sim)));
    const end = ofType(evs, 'blindEnd')[0];
    expect(end).toBeTruthy();
    expect(end.units).toBeGreaterThan(0);
    expect(end.gained).toBeGreaterThan(0);
    drive(sim, RULES.revealSec + 0.3, CALM, clock, reader(sim));
    expect(sim.score).toBeGreaterThan(score);
    expect(sim.g).toBeGreaterThan(shown);
  });

  it('the warm-up of a first session grows at half the rate (it is real focus too)', () => {
    const sim = makeSim({ tuning: BEGINNER });
    sim.story = null;
    expect(sim.block.kind).toBe('warmup');
    drive(sim, RULES.moveSec + 0.1, HIGH);
    expect(sim.growRate(HIGH)).toBeCloseTo((growMult(HIGH) / RULES.sceneSec) * RULES.warmK, 9);
  });

  it('scores in the smoke test’s 40 s session, first-ever and returning; nothing at all without focus', () => {
    const first = simSession(FIXTURE);
    const back = simSession(FIXTURE, { returning: true });
    expect(first.score).toBeGreaterThan(0);
    expect(back.score).toBeGreaterThan(first.score * 0.5);
    expect(first.progress.sessions).toBe(1);
    for (const focus of ['none', 'unfocused', 'calm'] as const) {
      for (const returning of [false, true]) {
        const r = simSession(FIXTURE, { focus, returning, restFocus: true });
        expect(r.score, `${focus} ${returning}`).toBe(0);
        expect(r.grownSec).toBe(0);
        expect(r.scenes).toBe(0);
      }
    }
    // without taps a first-ever player reads the opening card and the picture waits for it
    expect(simSession(FIXTURE, { taps: false, planned: 20 }).score).toBe(0);
    expect(simSession(FIXTURE, { eeg: true, returning: true }).score).toBeGreaterThan(0);
  });

  it('measured: a scene in about two push blocks at a moderate signal; a 5-minute session pays a few perScene', () => {
    const sim = later({ planned: 300 });
    drive(sim, 300, (_t, s) => (s.restBlock ? CALM : MID), { t: 0 }, reader(sim));
    let n = 0;
    for (const s of LIB.scenes) if (sim.grownThis(s)) n++;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(7);
    expect(sim.score).toBeGreaterThan(1.5 * FIXTURE.perScene);
    expect(sim.score).toBeLessThan(7 * FIXTURE.perScene);
  });
});

// ── the walk and the modes ─────────────────────────────────────────
describe('choose, walk, repeat', () => {
  it('walks back and on across meditations; only scenes grown by focus count', () => {
    const sim = later();
    drive(sim, 1, NONE);
    expect(sim.scene).toBe('a1');
    expect(sim.prevScene()).toBe(true);
    expect(sim.med).toBe('cale');
    expect(sim.scene).toBe('d3');
    expect(sim.nextScene()).toBe(true);
    expect(sim.nextScene()).toBe(true);
    expect(sim.scene).toBe('a2');
    for (const s of LIB.scenes) expect(sim.grownThis(s)).toBe(false);
    expect(sim.key('ArrowRight', true)).toBe(true);
    expect(sim.scene).toBe('b1');
    expect(sim.key('ArrowLeft', true)).toBe(true);
    expect(sim.scene).toBe('a2');
  });

  it('keeps a scene’s growth when walked back to, and grows it again from the start with “again”', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 4, HIGH, clock);
    const g = sim.g;
    expect(g).toBeGreaterThan(0.05);
    sim.nextScene();
    drive(sim, 0.5, HIGH, clock);
    sim.prevScene();
    expect(sim.g).toBeCloseTo(g, 5);
    const units = sim.score;
    expect(sim.key('r', true)).toBe(true);
    expect(sim.g).toBe(0);
    expect(sim.score).toBe(units);
  });

  it('opens the picker (≡ or M), picks a meditation (1–n, beyond n nothing), switches the mode', () => {
    const sim = later();
    drive(sim, 1, NONE);
    expect(sim.key('m', true)).toBe(true);
    expect(sim.picker).toBe(true);
    expect(sim.talkBlocked).toBe(true);
    expect(sim.key('5', true)).toBe(false);
    expect(sim.picker).toBe(true);
    expect(sim.key('3', true)).toBe(true);
    expect(sim.picker).toBe(false);
    expect(sim.med).toBe('trzy');
    expect(sim.idx).toBe(0);
    sim.togglePicker();
    expect(sim.setMode('repeat')).toBe(true);
    expect(sim.p.mode).toBe('repeat');
    expect(sim.pick('dwa')).toBe(true);
    expect(sim.pick('nope')).toBe(false);
    expect(sim.scene).toBe('b1');
    expect(sim.p.chosen).toBe('dwa');
    sim.togglePicker();
    sim.stay();
    expect(sim.picker).toBe(false);
    sim.togglePicker();
    sim.key('ArrowRight', true);
    expect(sim.picker).toBe(false);
    expect(sim.scene).toBe('b2');
  });

  it('in order: a meditation grown whole closes with its card (and its everyday step) and the next one begins', () => {
    const sim = later({ planned: 900 });
    const evs = drive(sim, 400, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(sim));
    expect(ofType(evs, 'whole')[0]?.med).toBe('jeden');
    expect(ofType(evs, 'story').map(e => e.kind)).toContain('whole');
    expect(ofType(evs, 'scene').some(e => e.med === 'dwa' && e.via === 'auto')).toBe(true);
  });

  it('repeat: the same meditation again from its first scene; just this one: it stays with its picture', () => {
    const rep = later({ planned: 900, progress: { mode: 'repeat', chosen: 'trzy', pos: { med: 'trzy', scene: 0, g: 0 } } });
    const evs = drive(rep, 500, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(rep));
    expect([...new Set(ofType(evs, 'scene').map(e => e.med))]).toEqual(['trzy']);
    expect(ofType(evs, 'whole').length).toBeGreaterThanOrEqual(2);
    const one = later({ planned: 900, progress: { mode: 'one', chosen: 'jeden', pos: { med: 'jeden', scene: 0, g: 0 } } });
    drive(one, 300, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(one));
    expect(one.med).toBe('jeden');
    expect(one.stage).toBe('after');
    const u = one.score;
    drive(one, 40, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 300 }, reader(one));
    expect(one.score).toBeGreaterThanOrEqual(u);
  });

  it('fills 30 minutes in order round the library and round again', () => {
    const sim = later({ planned: 1800 });
    const clock = { t: 0 };
    const evs: SimEvent[] = [];
    while (sim.phase !== 'done' && clock.t < 1810) evs.push(...drive(sim, 10, (_t, s) => (s.restBlock ? CALM : HIGH), clock, reader(sim)));
    expect(sim.phase).toBe('done');
    const wholes = ofType(evs, 'whole').map(e => e.med);
    expect(new Set(wholes).size).toBe(4);
    expect(wholes.length).toBeGreaterThan(4);
  }, 60_000);

  it('resumes where it stopped: a scene still growing keeps its growth; a grown one hands on', () => {
    expect(resumeFrom(LIB, 'dwa', 1, 0.4, 'order')).toEqual({ med: 'dwa', scene: 1, g: 0.4 });
    expect(resumeFrom(LIB, 'dwa', 1, 1, 'order')).toEqual({ med: 'dwa', scene: 2, g: 0 });
    expect(resumeFrom(LIB, 'dwa', 2, 1, 'order')).toEqual({ med: 'trzy', scene: 0, g: 0 });
    expect(resumeFrom(LIB, 'cale', 2, 1, 'order')).toEqual({ med: 'jeden', scene: 0, g: 0 });
    expect(resumeFrom(LIB, 'dwa', 2, 1, 'repeat')).toEqual({ med: 'dwa', scene: 0, g: 0 });
    const sim = later({ planned: 120 });
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 5, HIGH, clock);
    sim.finish();
    expect(sim.p.pos.med).toBe('jeden');
    expect(sim.p.pos.scene).toBe(0);
    expect(sim.p.pos.g).toBeGreaterThan(0.1);
    // the saved progress, through the runner's merge and the migration, starts the next session there
    const saved = JSON.parse(JSON.stringify(sim.p));
    const p = migrate(mergeSaved(freshProgress(FIXTURE), saved), FIXTURE);
    expect(p.sessions).toBe(6);
    const next = new HealthSim({ lib: FIXTURE, progress: p, rng: mulberry32(2), plannedSec: 300, eeg: false, tuning: TUNING });
    next.start();
    expect(next.scene).toBe('a1');
    expect(next.g).toBeCloseTo(sim.p.pos.g, 5);
  });
});

// ── the session ─────────────────────────────────────────────────────
describe('the session', () => {
  it('opens the first session with the two-page card (the root, then what this is not) and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story).toMatchObject({ kind: 'open', page: 0, pages: 2 });
    const clock = { t: 0 };
    drive(sim, 1, MID, clock);
    sim.stay();
    expect(sim.story!.page).toBe(1);
    drive(sim, 1, MID, clock);
    sim.stay();
    expect(sim.story).toBeNull();
    const evs = drive(sim, 120, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    const coach = ofType(evs, 'coach').map(e => e.what);
    for (const c of ['grow', 'nav', 'pick', 'breath'] as const) expect(coach).toContain(c);
    expect(makeSim({ progress: { ...sim.p } }).story).toBeNull();
  });

  it('gives result() idempotently and the record only with Math.max; settles once', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 8, HIGH, clock);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best['300']).toBe(a.score);
    expect(a.unit).toBe(LIB.unit(a.score));
    sim.finish();
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.units).toBe(a.score);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('closes with a passage that exists — the root the first time, then the meditation’s and the closers — and says what happened', () => {
    expect(makeSim().closingVerse()).toBe(FIXTURE.root);
    const seen = new Set<string>();
    for (let n = 1; n <= 4; n++) seen.add(later({ progress: { sessions: n } }).closingVerse());
    expect([...seen]).toEqual(expect.arrayContaining(['psa139.13-14', 'lam3.22-23', '2co4.16']));
    const sim = later({ planned: 600 });
    drive(sim, 300, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(sim));
    const r = sim.result();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    expect(r.stats.length).toBe(6);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h).not.toMatch(/\{\w+\}/);
  });

  it('keeps the narrator quiet while a coach mark is up, and says the scene’s line on arriving', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 8, MID, clock);
    expect(sim.talk.said.length).toBeGreaterThan(0);
    expect(sim.talk.said).toContain(LIB.t('say.at.a1.1'));
    sim.hintUntil = clock.t + 3;
    sim.talk.ask('good', 5, 10);
    drive(sim, 2.5, MID, clock);
    expect(sim.talk.line).toBeNull();
  });
});

// ── the meta ────────────────────────────────────────────────────────
describe('the meta', () => {
  it('chooses a meditation (resuming where it stopped when it is the same), a mode, a look', () => {
    const p = freshProgress(FIXTURE);
    expect(p.look).toBe('light');
    expect(p.chosen).toBe('jeden');
    p.pos = { med: 'dwa', scene: 1, g: 0.3 };
    expect(choose(FIXTURE, p, 'dwa')).toBe(true);
    expect(p.pos).toEqual({ med: 'dwa', scene: 1, g: 0.3 });
    expect(choose(FIXTURE, p, 'trzy')).toBe(true);
    expect(p.pos).toEqual({ med: 'trzy', scene: 0, g: 0 });
    expect(choose(FIXTURE, p, 'nope')).toBe(false);
    expect(setMode(p, 'one')).toBe(true);
    expect(setMode(p, 'sideways')).toBe(false);
    expect(setLook(FIXTURE, p, 'dark')).toBe(true);
    expect(setLook(FIXTURE, p, 'green')).toBe(false);
    expect(markSeen(p, 'x')).toBe(true);
    expect(markSeen(p, 'x')).toBe(false);
    expect(freshProgress({ ...FIXTURE, looks: [] }).look).toBe('');
  });

  it('counts the scenes grown and the meditations completed', () => {
    const p = freshProgress(FIXTURE);
    expect(scenesGrown(FIXTURE, p, 'dwa')).toBe(0);
    p.grown.b1 = 2;
    p.grown.b3 = 1;
    expect(scenesGrown(FIXTURE, p, 'dwa')).toBe(2);
    p.whole.dwa = 1;
    expect(medsDone(FIXTURE, p)).toBe(1);
    expect(bestOf(p)).toBeNull();
  });

  it('repairs a save: wrong types, a place or a scene no longer in the library, garbage', () => {
    const saved = { ver: 1, game: 'fixture', sessions: 3, mode: 'x', chosen: 'trzy', look: 'blue', pos: { med: 'trzy', scene: 9, g: 4 }, grown: { b2: 2, gone: 5 }, whole: { gone: 1 }, best: { 300: 400, 60: 'x' }, units: 12.7, song: 'no', seen: ['c.nav', 4] };
    const p = migrate(mergeSaved(freshProgress(FIXTURE), saved), FIXTURE);
    expect(p.mode).toBe('order');
    expect(p.chosen).toBe('trzy');
    expect(p.look).toBe('light');
    expect(p.pos).toEqual({ med: 'trzy', scene: 1, g: 0 });
    expect(p.grown.b2).toBe(2);
    expect(Object.keys(p.grown)).toEqual([...LIB.scenes]);
    expect(Object.keys(p.whole)).toEqual([...LIB.meds]);
    expect(p.best).toEqual({ 300: 400 });
    expect(p.units).toBe(12);
    expect(p.song).toBe(true);
    expect(p.seen).toEqual(['c.nav']);
    expect(cleanPos(FIXTURE, { med: 'x', scene: 2 })).toEqual({ med: 'jeden', scene: 0, g: 0 });
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, pos: 'x', grown: 5, best: [], seen: null, whole: 'x' }]) {
      const q = migrate(mergeSaved(freshProgress(FIXTURE), junk), FIXTURE);
      expect(q.ver).toBe(1);
      expect(LIB.meds).toContain(q.pos.med);
      const sim = new HealthSim({ lib: FIXTURE, progress: q, rng: mulberry32(1), plannedSec: 60, eeg: true, tuning: TUNING });
      sim.start();
      drive(sim, 5, MID);
    }
  });

  it('starts fresh from a save of another shape (the placeholder that loaded Każdy włos), keeping sessions and pushes', () => {
    const wlosySave = { ver: 1, sessions: 4, pushes: 9, mode: 'repeat', chosen: 'korzen', colour: 'grey', pos: { med: 'korzen', scene: 2, g: 0.5 }, grown: { petla: 2 }, hairs: 800, seen: ['s.open'] };
    const merged = mergeSaved(freshProgress(FIXTURE), wlosySave);
    expect(foreignSave(FIXTURE, merged as unknown as Record<string, unknown>)).toBe(true);
    const p = migrate(merged, FIXTURE);
    expect(p).toEqual({ ...freshProgress(FIXTURE), sessions: 4, pushes: 9 });
    expect(foreignSave(FIXTURE, { ...freshProgress(FIXTURE), game: 'zeby' } as unknown as Record<string, unknown>)).toBe(true);
    expect(foreignSave(FIXTURE, freshProgress(FIXTURE) as unknown as Record<string, unknown>)).toBe(false);
  });

  it('makes the runner’s module: fresh progress, the best, the unit, the rhythm, its own breath guide', () => {
    const mod = makeHealthModule(FIXTURE);
    const p = mod.freshProgress();
    expect(p.game).toBe('fixture');
    expect(mod.best(p)).toBeNull();
    p.sessions = 2;
    p.best = { 300: 140, 600: 260 };
    expect(mod.best(p)).toBe(260);
    expect(mod.unit!(5)).toBe('iskier');
    expect(mod.ownBreath).toBe(true);
    expect(mod.howto!().goal).toBe(LIB.t('howto.goal'));
  });
});

// ── the rhythm ──────────────────────────────────────────────────────
describe('the rest’s rhythm and the breath guide', () => {
  it('offers seconds of Wzrost (40: 20–120) and whole breaths of Głębia (3: 1–6) in the lobby', () => {
    const spec = rhythm(LIB);
    expect([spec.focus.def, spec.focus.min, spec.focus.max, spec.focus.step]).toEqual([40, 20, 120, 5]);
    expect([spec.rest.def, spec.rest.min, spec.rest.max]).toEqual([3, 1, 6]);
    expect(spec.focus.name).toBe('Wzrost');
    expect(spec.rest.name).toBe('Głębia');
    expect(spec.restSec!(3)).toBe(30);
    expect(rhythmOf(spec, { focus: 1, rest: 99 })).toEqual({ focus: 20, rest: 6, custom: true });
  });

  it('plans the player’s pushes and whole-breath rests, and any length from 10 s gets a push and a rest', () => {
    for (const [focus, rest] of [[20, 1], [40, 3], [90, 4], [120, 6]] as const) {
      for (const sec of [180, 600, 1800]) {
        const plan = planBlocks(sec, false, mulberry32(sec), { focus, rest });
        const pushes = plan.filter(b => b.kind === 'push');
        const id = `${focus}/${rest} · ${sec}`;
        const mean = pushes.reduce((s, b) => s + b.dur, 0) / pushes.length;
        expect(Math.abs(mean - focus), id).toBeLessThanOrEqual(Math.max(12, focus * 0.45));
        for (const b of plan.filter(x => x.kind === 'rest')) expect(b.dur % BREATH, id).toBeCloseTo(0, 6);
        expect(plan.reduce((s, b) => s + b.dur, 0), id).toBeCloseTo(sec - finaleFor(sec), 5);
      }
    }
    for (const planned of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.at(-1)!.kind).toBe('rest');
      }
    }
    const sim = later({ planned: 600, rhythm: { focus: 20, rest: 1 } });
    const clock = { t: 0 };
    while (sim.phase !== 'done' && clock.t < 620) drive(sim, 5, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    expect(sim.phase).toBe('done');
    expect(clock.t).toBeLessThanOrEqual(600 + RULES.settle + 5.1);
  });

  it('guides the rest from its start with the kit’s guide in the words band, at every checked size', () => {
    const sim = later({ rhythm: { focus: 40, rest: 2 } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.restBlock && guard++ < 400) drive(sim, 0.5, MID, clock, reader(sim));
    expect(sim.restBlock).toBe(true);
    expect(sim.breaths).toBe(2);
    expect(sim.breathNow!.phase).toBe('in');
    const { ctx } = fakeCtx();
    for (const touch of [true, false]) {
      for (const c of CHECK_SIZES) {
        const L = layout(c.w, c.h, c.insets, touch);
        const g = wordsGuide(ctx, L, sim)!;
        const id = `${c.name} · ${touch ? 'touch' : 'mouse'}`;
        expect(g, id).not.toBeNull();
        expect(g.o.r, id).toBeGreaterThanOrEqual(26);
        expect(g.box.x, id).toBeGreaterThanOrEqual(L.words.x - 0.5);
        expect(g.box.x + g.box.w, id).toBeLessThanOrEqual(L.words.x + L.words.w + 0.5);
        expect(g.box.y + g.box.h, id).toBeLessThanOrEqual(L.words.y + L.words.h + 0.5);
      }
    }
  });
});

// ── mobile first and the desk ──────────────────────────────────────
describe('mobile first and the desk (DESIGN §12, §14)', () => {
  const MEDS6 = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

  it('keeps the four controls finger-sized, inside the insets and apart at every checked size', () => {
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        const ts = { story: null, picker: false, live: true, meds: LIB.meds };
        const tg = tapTargets(L, ts);
        expect(tg.map(x => x.label)).toEqual([...CONTROLS]);
        expect(auditTargets(tg, s.w, s.h, L.ins), `${s.name} ${touch}`).toEqual([]);
        expect(hitAt(L, ts, s.w / 2, s.h * 0.6), s.name).toBeNull();
      }
    }
  });

  it('keeps the picker’s every part finger-sized, inside the insets and apart for 4, 5 and 6 meditations', () => {
    for (const n of [4, 5, 6]) {
      const meds = MEDS6.slice(0, n);
      for (const s of CHECK_SIZES) {
        for (const touch of [true, false]) {
          const L = layout(s.w, s.h, s.insets, touch);
          const tg = tapTargets(L, { story: null, picker: true, live: true, meds });
          const id = `${n} · ${s.name} · ${touch}`;
          expect(tg, id).toHaveLength(1 + MODES.length + n);
          expect(auditTargets(tg, s.w, s.h, L.ins), id).toEqual([]);
          const P = pickerLayout(L, n);
          expect(P.card.y, id).toBeGreaterThanOrEqual(L.top);
          expect(P.card.y + P.card.h, id).toBeLessThanOrEqual(L.bottom + 0.5);
          for (const r of P.items) expect(r.x + r.w, id).toBeLessThanOrEqual(P.card.x + P.card.w + 0.5);
        }
        const L = layout(s.w, s.h, s.insets, true);
        expect(auditTargets(tapTargets(L, { story: storyRect(L, 300), picker: false, live: true, meds }), s.w, s.h, L.ins), s.name).toEqual([]);
      }
    }
    // an odd last tile spans the card's row
    const L = layout(390, 844, { top: 173, right: 0, bottom: 34, left: 0 }, true);
    const P = pickerLayout(L, 5);
    expect(P.items[4].w).toBeGreaterThan(1.9 * P.items[0].w);
  });

  it('puts the controls in the thumb zone of an upright phone, the words above them, the picture above the words', () => {
    for (const s of CHECK_SIZES.filter(c => c.h > c.w)) {
      const L = layout(s.w, s.h, s.insets, true);
      expect(L.shape, s.name).toBe('tall');
      expect(L.ctl.next.y, s.name).toBeGreaterThan(L.top + 0.55 * (L.bottom - L.top));
      expect(L.words.y + L.words.h, s.name).toBeLessThanOrEqual(L.ctl.next.y);
      expect(L.pic.y + L.pic.h, s.name).toBeLessThanOrEqual(L.words.y);
      expect(L.pic.h, s.name).toBeGreaterThan(150);
    }
  });

  it('lays a phone on its side and a desk out with the picture left and its words and controls in a column', () => {
    for (const s of CHECK_SIZES.filter(c => c.w > c.h)) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        expect(L.words.x, s.name).toBeGreaterThanOrEqual(L.pic.x + L.pic.w);
        expect(L.words.x + L.words.w, s.name).toBeLessThanOrEqual(L.right - 8);
        expect(L.pic.y + L.pic.h, s.name).toBeLessThanOrEqual(L.bottom + 0.5);
      }
    }
    for (const s of CHECK_SIZES.filter(c => c.w > c.h && ['desktop', 'big'].includes(screenKind(c.w, c.h, false)))) {
      expect(layout(s.w, s.h, s.insets, false).desk, s.name).toBe(true);
      expect(layout(s.w, s.h, s.insets, true).desk).toBe(false);
    }
  });

  it('never sets a read text under 13 px; it grows on a big screen', () => {
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        expect(L.u).toBeLessThanOrEqual(Math.min(s.w, s.h) >= DESK_BIG && s.w >= 1024 ? DESK_MAX : 1.3);
        expect(L.font.teachMin).toBeGreaterThanOrEqual(15);
        for (const px of [L.font.label, L.font.caption, L.font.verse, L.font.part, L.font.key]) expect(px).toBeGreaterThanOrEqual(MIN_READ);
        expect(L.font.small).toBeGreaterThanOrEqual(MIN_TEXT);
        for (const c of CONTROLS) expect(Math.min(L.ctl[c].w, L.ctl[c].h)).toBeGreaterThanOrEqual(MIN_TAP);
      }
    }
    expect(layout(1587, 1300, { top: 118, right: 0, bottom: 0, left: 0 }, false).font.teach).toBeGreaterThanOrEqual(30);
  });

  it('draws every moment at every checked size with text of 13 px and more (a verse’s reference 11), the closing card with its everyday step', () => {
    /** A session at a moment: push with names, rest with the guide, the picker, the opening card, the closing card. */
    const moments: [string, (sim: HealthSim, clock: { t: number }) => void][] = [
      ['push', (sim, clock) => { untilSighted(sim, clock, HIGH); drive(sim, 9, HIGH, clock); }],
      ['rest', (sim, clock) => { while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim)); drive(sim, 2, CALM, clock); }],
      ['picker', (sim, clock) => { drive(sim, 3, MID, clock); sim.togglePicker(); }],
      ['whole', (sim, clock) => { let g = 0; while (sim.story?.kind !== 'whole' && g++ < 4000) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : HIGH), clock, reader(sim)); drive(sim, 0.5, MID, clock); }],
    ];
    let sawCare = 0;
    for (const touch of [true, false]) {
      for (const c of CHECK_SIZES) {
        for (const [name, go] of [...moments, ['open', () => {}] as [string, (sim: HealthSim, clock: { t: number }) => void]]) {
          const sim = name === 'open' ? makeSim({ planned: 600 }) : later({ planned: 600 });
          const clock = { t: 0 };
          go(sim, clock);
          const { ctx, texts } = fakeCtx();
          const view = new HealthView({ getContext: () => ctx, style: {} } as unknown as HTMLCanvasElement, { reducedMotion: false, touch });
          view.resize(c.w, c.h, 1, c.insets);
          for (const e of sim.take()) view.on(e, sim);
          view.update(0.5, sim);
          view.draw(sim);
          const id = `${name} · ${c.name} · ${touch ? 'touch' : 'mouse'}`;
          expect(texts.length, id).toBeGreaterThan(0);
          for (const tx of texts) expect(tx.px, `${id}: “${tx.text}”`).toBeGreaterThanOrEqual(isRef(tx.text) ? MIN_TEXT : MIN_READ);
          expect(auditTargets(view.targets(sim), c.w, c.h, view.L.ins), id).toEqual([]);
          if (name === 'whole') {
            expect(sim.story?.kind, id).toBe('whole');
            const care = texts.find(tx => tx.text === LIB.t('story.care'));
            expect(care, id).toBeTruthy();
            expect(texts.some(tx => LIB.medCare(sim.story!.med).startsWith(tx.text)), id).toBe(true);
            const r = view.storyRect!;
            expect(r.y, id).toBeGreaterThanOrEqual(view.L.top - 0.5);
            expect(r.y + r.h, id).toBeLessThanOrEqual(view.L.bottom + 0.5);
            sawCare++;
          }
          if (name === 'push') expect(texts.some(tx => tx.text === LIB.partName('core')), id).toBe(true);
          if (name === 'picker') expect(texts.some(tx => tx.text.includes(LIB.medName('cale'))), id).toBe(true);
        }
      }
    }
    expect(sawCare).toBe(2 * CHECK_SIZES.length);
  }, 120_000);
});
