// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_TAP, auditTargets } from '../src/arcade/kit/mobile';
import { passage } from '../src/arcade/kit/scripture';
import { ALL_VERSES, OWN_LEN, OWN_MAX, SET_LEN, VERSES, WORD_SETS, cleanWord, cleanWords, verseFor } from '../src/arcade/kintsugi/content';
import { HEART, buildHeart, clothSpots, inHeart, seamFill } from '../src/arcade/kintsugi/heart';
import { CATALOGS, linesOf, t, unit } from '../src/arcade/kintsugi/i18n';
import { howto, kintsugiRhythm } from '../src/arcade/kintsugi/index';
import { guideHeight, layout } from '../src/arcade/kintsugi/layout';
import { addWeight, bestOf, forgetOwn, freshProgress, migrate, setOwn, type KintsugiProgress } from '../src/arcade/kintsugi/meta';
import { forecastLines, progressPanel } from '../src/arcade/kintsugi/panel';
import { RULES, focusRate, piecesFor, planFor } from '../src/arcade/kintsugi/rules';
import { KintsugiSim, wordsFor, type SimEvent } from '../src/arcade/kintsugi/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, LANGS } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { arcadeEntry } from '../src/arcade/registry';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 30;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const DAY = '2026-11-24';
const CYC = breathCycle(BREATH_PRESETS.even);

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
/** the average player: a little above the threshold, held a while */
const AVG = frame({ level: 0.62, activity: 3, focused: true, hold: 6, calm: 0.2 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });

type SimOpts = { progress?: Partial<KintsugiProgress>; planned?: number; seed?: number; eeg?: boolean; rhythm?: { focus: number; rest: number; custom: boolean } | null };

function makeSim(o: SimOpts = {}): KintsugiSim {
  const sim = new KintsugiSim({
    progress: { ...freshProgress(), sessions: 4, seen: ['c.lift', 'c.wash', 'c.gold', 'c.tap'], ...o.progress } as KintsugiProgress,
    rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null, day: DAY,
  });
  sim.start();
  return sim;
}

type FrameFn = (t: number, sim: KintsugiSim) => FocusFrame;
/** Play `sec` seconds: focus in the push blocks (the frame given), rest elsewhere. */
function drive(sim: KintsugiSim, sec: number, f: FocusFrame | FrameFn, clock = { t: 0 }, out: SimEvent[] = []): SimEvent[] {
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}
/** A player who focuses in the push blocks with `push` and rests in the rest blocks. */
const player = (push: FocusFrame): FrameFn => (_t, s) => (s.pushBlock ? push : LOW);
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

describe('Złote serce — the plan', () => {
  const lens = [...SESSION_MINUTES.map(m => m * 60), 40, 60];

  it('fills every session length 3–30 min and a ≤ 60 s test: stages in order, ending at T', () => {
    for (const T of lens) {
      const p = planFor({ plannedSec: T, cyc: CYC, eeg: false });
      expect(p.arriveEnd, `${T}`).toBeGreaterThan(0);
      expect(p.gatherEnd).toBeGreaterThan(p.arriveEnd);
      expect(p.goldEnd).toBeGreaterThan(p.gatherEnd);
      expect(p.beatEnd).toBeGreaterThan(p.goldEnd);
      expect(p.radianceEnd).toBeGreaterThan(p.beatEnd);
      expect(p.radianceEnd).toBeLessThan(T);
      const close = T - p.radianceEnd;
      if (T > RULES.testSec) {
        expect(close).toBeGreaterThanOrEqual(RULES.close.min - 1e-6);
        expect(close).toBeLessThanOrEqual(RULES.close.max + 1e-6);
        expect(p.arriveEnd).toBeGreaterThanOrEqual(RULES.arrive.min - CYC);
        expect(p.arriveEnd).toBeLessThanOrEqual(RULES.arrive.max + CYC);
        // the gathering is about half the session, the gold about a fifth
        expect((p.gatherEnd - p.arriveEnd) / T).toBeGreaterThan(0.38);
        expect((p.goldEnd - p.gatherEnd) / T).toBeGreaterThan(0.14);
      }
    }
  });

  it('breaks the heart into more pieces as the session grows, and fits the average player’s share to the rhythm', () => {
    expect(piecesFor(180)).toBe(4);
    expect(piecesFor(300)).toBe(5);
    expect(piecesFor(1800)).toBe(13);
    expect(piecesFor(40)).toBe(RULES.piecesTest);
    let prev = 0;
    for (const m of SESSION_MINUTES) {
      const p = planFor({ plannedSec: m * 60, cyc: CYC, eeg: false });
      expect(p.pieces).toBeGreaterThanOrEqual(prev);
      prev = p.pieces;
      expect(p.planned).toBeGreaterThanOrEqual(1);
      expect(p.planned).toBeLessThanOrEqual(p.pieces);
      expect(p.taskNeed).toBeGreaterThan(0);
      // from 15 minutes the average player gathers every piece with care
      if (m >= 15) expect(p.planned).toBe(p.pieces);
      // by design a short session washes in one breath, a long one in two
      expect(p.wash).toBe(m * 60 < RULES.shortSec ? 1 : RULES.rest.def);
    }
  });

  it('keeps the player’s washes and fits fewer pieces to longer lift-and-lay blocks', () => {
    const own = planFor({ plannedSec: 300, cyc: CYC, eeg: false, focus: 20, rest: 3, custom: true });
    expect(own.wash).toBeLessThanOrEqual(3);
    const short = planFor({ plannedSec: 900, cyc: CYC, eeg: false, focus: 15, rest: 2, custom: true });
    const long = planFor({ plannedSec: 900, cyc: CYC, eeg: false, focus: 45, rest: 2, custom: true });
    expect(long.planned).toBeLessThanOrEqual(short.planned);
  });

  it('only real focus moves anything: no rate without focus', () => {
    expect(focusRate(0.9, false, 10)).toBe(0);
    expect(focusRate(0.5, true, 0)).toBeGreaterThan(0);
    expect(focusRate(0.9, true, 12)).toBeGreaterThan(focusRate(0.55, true, 0));
  });
});

describe('Złote serce — the heart', () => {
  it('breaks into n pieces inside the heart, with seams the gold reaches from the notch', () => {
    for (const n of [2, 3, 4, 7, 10, 13, 14]) {
      const g = buildHeart(n, mulberry32(n));
      expect(g.pieces).toHaveLength(n);
      expect(g.order.slice().sort((a, b) => a - b)).toEqual(g.pieces.map(p => p.id));
      for (const p of g.pieces) expect(inHeart(p.cx, p.cy), `${n}: piece ${p.id}`).toBe(true);
      expect(g.seams.length).toBeGreaterThanOrEqual(n - 1);
      expect(g.reach).toBeGreaterThan(0);
      // the first seam begins at the notch (the crack down the middle)
      expect(g.seams[0].start).toBeLessThan(0.05);
      expect(Math.abs(g.seams[0].pts[0].x)).toBeLessThan(0.12);
      for (const s of g.seams) {
        expect(seamFill(s, 0)).toBeLessThanOrEqual(seamFill(s, g.reach));
        expect(seamFill(s, g.reach)).toBeGreaterThan(0.999);
        expect(s.a).not.toBe(s.b);
      }
    }
  });

  it('is the same heart for the same seed, and lays the pieces from the tip up', () => {
    const a = buildHeart(9, mulberry32(3)), b = buildHeart(9, mulberry32(3));
    expect(a.pieces.map(p => [p.cx, p.cy])).toEqual(b.pieces.map(p => [p.cx, p.cy]));
    const ys = a.order.map(id => a.pieces[id].cy);
    expect(ys[0]).toBeGreaterThanOrEqual(ys[ys.length - 1]);
  });

  it('lays the broken pieces on the cloth under the heart, left to right as they belong', () => {
    const g = buildHeart(8, mulberry32(5));
    const cloth = { x0: -1.4, x1: 1.4, y0: HEART.bottom + 0.1, y1: HEART.bottom + 0.9 };
    const spots = clothSpots(g.pieces, cloth, 99);
    for (const sp of spots) {
      expect(sp.x).toBeGreaterThanOrEqual(cloth.x0);
      expect(sp.x).toBeLessThanOrEqual(cloth.x1);
      expect(sp.y).toBeGreaterThanOrEqual(cloth.y0 - 1e-9);
      expect(sp.y).toBeLessThanOrEqual(cloth.y1 + 1e-9);
    }
  });
});

describe('Złote serce — the session', () => {
  it('lifts a piece only while focused, past the lead-in, and waits without focus', () => {
    const sim = makeSim({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, sim.plan.arriveEnd + 0.5, LOW, clock);
    expect(sim.stage).toBe('gather');
    expect(sim.block.what).toBe('move');
    // no focus: the piece in the hands does not rise
    drive(sim, 20, LOW, clock);
    expect(sim.held).not.toBeNull();
    expect(sim.pieces[sim.held!].p).toBe(0);
    // focus: it rises, is held, and the wash (a rest) comes
    const evs = drive(sim, 30, HIGH, clock);
    expect(ofType(evs, 'held')).toHaveLength(1);
    expect(sim.block.what === 'wash' || sim.pieces.some(p => p.state === 'clean' || p.state === 'lay')).toBe(true);
  });

  it('washes in whole breaths without focus, then lays the piece only with focus', () => {
    const sim = makeSim({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, sim.plan.arriveEnd + 0.5, LOW, clock);
    // focus until the first wash begins
    for (let i = 0; i < 3000 && sim.block.what !== 'wash'; i++) drive(sim, STEP, HIGH, clock);
    expect(sim.block.what).toBe('wash');
    const pc = sim.pieces[sim.held!];
    // a wash runs its breaths even with no focus at all
    drive(sim, sim.plan.wash * CYC + 0.5, LOW, clock);
    expect(pc.washed).toBe(1);
    expect(pc.state).toBe('lay');
    drive(sim, 15, LOW, clock);
    expect(pc.state).toBe('lay');
    expect(pc.p).toBe(0);
    const evs = drive(sim, 25, HIGH, clock);
    expect(ofType(evs, 'placed').some(e => e.id === pc.id && !e.grace)).toBe(true);
  });

  it('gathers what is left by grace when the gathering’s time ends, so the heart is whole for the gold', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    const evs = drive(sim, sim.plan.gatherEnd + 12, LOW, clock);
    expect(ofType(evs, 'grace')).toHaveLength(1);
    expect(sim.pieces.every(p => p.state === 'home')).toBe(true);
    expect(sim.pieces.every(p => p.grace)).toBe(true);
    expect(sim.stage).toBe('gold');
  });

  it('pours gold only from focus: none without it, all seams with a strong player', () => {
    const weak = makeSim({ planned: 300, seed: 3 });
    const c1 = { t: 0 };
    drive(weak, 300, LOW, c1);
    expect(weak.poured).toBe(0);
    expect(weak.score).toBe(0);
    const strong = makeSim({ planned: 300, seed: 3 });
    const c2 = { t: 0 };
    drive(strong, 300, player(HIGH), c2);
    expect(strong.score).toBe(strong.geo.seams.length);
    expect(strong.gilded).toBe(true);
  });

  it('a stronger player gathers more pieces with care than an average one', () => {
    const avg = makeSim({ planned: 600, seed: 11 });
    drive(avg, 600, player(AVG));
    const strong = makeSim({ planned: 600, seed: 11 });
    drive(strong, 600, player(HIGH));
    expect(strong.gathered.care).toBeGreaterThanOrEqual(avg.gathered.care);
    expect(avg.gathered.care).toBeGreaterThanOrEqual(Math.max(1, avg.plan.planned - 1));
  });

  it('a test session (≤ 60 s, app:smoke plays 40 s) pours gold and scores before its close', () => {
    for (const T of [40, 60]) {
      for (const eeg of [false, true]) {
        for (const f of [HIGH, player(HIGH)]) {
          const sim = makeSim({ planned: T, seed: T, eeg });
          drive(sim, T * 0.85, f);
          expect(sim.score, `${T} s ${eeg ? 'eeg' : 'fnirs'}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('always reaches the close and its end, at every length, with any focus — a test session too', () => {
    for (const T of [40, 60, 180, 300, 600, 1200, 1800]) {
      for (const f of [LOW, player(AVG), player(HIGH)]) {
        const sim = makeSim({ planned: T, seed: T });
        const clock = { t: 0 };
        drive(sim, T + 0.2, f, clock);
        expect(sim.stage, `${T}`).toBe('close');
        expect(sim.pieces.every(p => p.state === 'home')).toBe(true);
        expect(sim.canStop()).toBe(false);
        drive(sim, RULES.rateWait + 0.5, LOW, clock);
        expect(sim.canStop()).toBe(true);
      }
    }
  });

  it('beats at the band’s pulse when it is plausible, else a calm 60, and turns golden as far as the gold poured', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    drive(sim, sim.plan.goldEnd + 1, player(HIGH), clock);
    expect(sim.stage).toBe('beat');
    for (let i = 0; i < 900; i++) sim.setPulse(72);
    expect(Math.round(sim.bpm)).toBe(72);
    const evs = drive(sim, 10, LOW, clock);
    expect(ofType(evs, 'beat').filter(e => e.strong).length).toBeGreaterThanOrEqual(10);
    expect(sim.tint).toBeGreaterThan(0);
    const calm = makeSim({ planned: 300 });
    for (let i = 0; i < 900; i++) calm.setPulse(250);
    expect(Math.round(calm.bpm)).toBe(RULES.bpmCalm);
  });

  it('settles once: the result is idempotent, records only rise', () => {
    const p = { ...freshProgress(), sessions: 2, best: 1 } as KintsugiProgress;
    const sim = new KintsugiSim({ progress: p, rng: mulberry32(5), plannedSec: 300, eeg: false, tuning: TUNING, day: DAY });
    sim.start();
    drive(sim, 300.5, player(HIGH));
    sim.rate10(3);
    sim.finish();
    sim.finish();
    const a = JSON.stringify(sim.result()), b = JSON.stringify(sim.result());
    expect(a).toBe(b);
    expect(p.sessions).toBe(3);
    expect(p.best).toBe(sim.score);
    expect(p.seams).toBe(sim.score);
    expect(p.history).toHaveLength(1);
    expect(p.before).toBeNull();
    expect(sim.result().record).toBe(true);
    expect(sim.result().verse).toBe(sim.closingVerse);
  });

  it('never puts own words into the result', () => {
    const own = ['moja tajemnica', 'Anna'];
    const sim = makeSim({ planned: 300, progress: { words: 'own', own, before: 8 } });
    expect(sim.pieces.map(p => p.word)).toEqual(expect.arrayContaining(own));
    drive(sim, 300.5, player(AVG));
    sim.rate10(4);
    sim.finish();
    const txt = JSON.stringify(sim.result());
    for (const w of own) expect(txt).not.toContain(w);
    expect(txt).toContain('8 → 4');
  });

  it('asks the band for focus in lifts, lays and pours, and for rest in washes, the beat and the radiance', () => {
    const sim = makeSim({ planned: 300 });
    const kinds = new Map<string, Set<string>>();
    drive(sim, 300, (_t, s) => {
      const set = kinds.get(s.block.what) ?? new Set();
      set.add(s.block.kind);
      kinds.set(s.block.what, set);
      return s.pushBlock ? HIGH : LOW;
    });
    for (const w of ['move', 'pour']) expect([...(kinds.get(w) ?? [])]).toEqual(['push']);
    for (const w of ['arrive', 'wash', 'beat', 'radiance']) expect([...(kinds.get(w) ?? [])]).toEqual(['rest']);
  });
});

describe('Złote serce — the progress', () => {
  it('migrates fresh, broken and hostile saves field by field', () => {
    expect(migrate(freshProgress())).toEqual(freshProgress());
    for (const bad of [{}, { best: null }, { ver: 3, sessions: 4 }, { ver: 1, sessions: 'x', best: -3, words: 'hack', own: 'a, b, ' + 'x'.repeat(60), breath: null, before: 99, history: [{ after: 4, before: 'x' }, 7], music: 'no', seen: [1, 'a'] }]) {
      const p = migrate(bad as unknown as KintsugiProgress);
      expect(p.ver).toBe(1);
      expect(Number.isInteger(p.sessions) && p.sessions >= 0).toBe(true);
      expect(['heart', 'loss', 'betrayal', 'rejection', 'self', 'own', 'none']).toContain(p.words);
      expect(p.own.length).toBeLessThanOrEqual(OWN_MAX);
      for (const w of p.own) expect([...w].length).toBeLessThanOrEqual(OWN_LEN);
      expect(p.before === null || (p.before >= 0 && p.before <= 10)).toBe(true);
      expect(typeof p.music.mode).toBe('string');
      expect(Array.isArray(p.music.off)).toBe(true);
      expect(Array.isArray(p.seen)).toBe(true);
    }
    expect(migrate({ sessions: 5 } as unknown as KintsugiProgress).sessions).toBe(5);
    expect(migrate({ ver: 1, before: 12.7 } as unknown as KintsugiProgress).before).toBe(10);
  });

  it('keeps own words clean, distinct and few; forgetting them returns to a set', () => {
    expect(cleanWord('  a\u0000b   c ')).toBe('a b c');
    expect(cleanWords('a, A, b;c\nd')).toEqual(['a', 'b', 'c', 'd']);
    expect(cleanWords(Array.from({ length: 30 }, (_, i) => `w${i}`))).toHaveLength(OWN_MAX);
    const p = freshProgress();
    p.words = 'own';
    setOwn(p, 'samotność, rozstanie');
    expect(p.own).toEqual(['samotność', 'rozstanie']);
    forgetOwn(p);
    expect(p.own).toEqual([]);
    expect(p.words).toBe('heart');
    addWeight(p, DAY, 7, 3);
    expect(p.history).toEqual([{ day: DAY, before: 7, after: 3 }]);
    expect(bestOf(freshProgress())).toBeNull();
  });

  it('writes the words of a set on the pieces, own words in order, or none', () => {
    const p = freshProgress();
    const w = wordsFor(p, 5, mulberry32(1));
    expect(w.filter(Boolean)).toHaveLength(5);
    p.words = 'none';
    expect(wordsFor(p, 5, mulberry32(1)).every(x => x === '')).toBe(true);
    p.words = 'own';
    p.own = ['x', 'y'];
    expect(wordsFor(p, 4, mulberry32(1))).toEqual(['x', 'y', '', '']);
    p.words = 'self';
    expect(wordsFor(p, 14, mulberry32(1)).filter(Boolean)).toHaveLength(SET_LEN);
  });
});

describe('Złote serce — the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('writes each set of pain words, twelve gentle words in every language that fit under a piece', () => {
    for (const l of LANGS) for (const set of WORD_SETS) for (let i = 1; i <= SET_LEN; i++) {
      const w = (CATALOGS[l] as Record<string, unknown>)[`w.${set}.${i}`];
      expect(typeof w, `${l} w.${set}.${i}`).toBe('string');
      expect([...(w as string)].length, `${l} w.${set}.${i}`).toBeLessThanOrEqual(28);
    }
  });

  it('keeps the narrator short and every moment voiced', () => {
    for (const m of ['arrive', 'lift', 'liftFirst', 'wash', 'lay', 'wait', 'grace', 'gold', 'goldWait', 'goldDone', 'beat', 'radiance', 'close']) {
      const lines = linesOf(m);
      expect(lines.length, m).toBeGreaterThan(0);
      for (const s of lines) expect([...s].length, s).toBeLessThanOrEqual(90);
    }
  });

  it('speaks of light, care and gold — no energy, no promise of healing, no magic (the lobby’s kintsugi note aside)', () => {
    const FORBID: Record<string, RegExp> = {
      pl: /energi|wibrac|uzdrawia|\b(u|wy)?leczy|czakr|kundalini|aktywuj|magi[aię]|zaklęci/i,
      en: /energy|vibration|heal(s|ing)?\b|\bcures?\b|chakra|kundalini|\bactivate|\bmagic|\bspell\b/i,
      de: /energie|schwingung|heilt|heilung|chakra|kundalini|aktivier|magie|zauber/i,
      sv: /energi|vibration|\bhelar\b|helande|chakra|kundalini|aktiver|magi|trollformel/i,
    };
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
      }
      for (const [k, m] of Object.entries(ARCADE_TEXTS[l]).filter(([k]) => k.startsWith('kintsugi.'))) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m as object)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
      }
    }
  });

  it('names kintsugi once in the lobby text, carries the help lines and says it is not therapy', () => {
    for (const l of LANGS) {
      const a = ARCADE_TEXTS[l] as Record<string, string>;
      expect(a['kintsugi.text'].match(/kintsugi/gi), l).toHaveLength(1);
      expect(a['kintsugi.tip5']).toMatch(l === 'pl' ? /116 123.*116 111.*112/ : l === 'de' ? /0800 111 0 111.*112/ : l === 'sv' ? /90101.*112/ : /emergency number|crisis line/);
      expect(a['kintsugi.tip5']).toMatch(/terapi|therapy|Therapie/);
      expect((CATALOGS[l] as Record<string, string>)['panel.care']).toMatch(/terapi|therapy|Therapie/);
    }
    expect((MOUSE_TEXTS.pl as Record<string, string>)['kintsugi.how3']).toMatch(/kliknij/);
  });

  it('counts golden seams in Polish with all three forms', () => {
    expect(unit(1)).toBe('złota spoina');
    expect(unit(3)).toBe('złote spoiny');
    expect(unit(5)).toBe('złotych spoin');
    expect(t('seams', { n: 22 })).toBe('22 złote spoiny');
  });

  it('quotes only verified passages, each in four languages', () => {
    for (const id of ALL_VERSES) for (const l of LANGS) expect(passage(id, l).text.length, `${id} ${l}`).toBeGreaterThan(10);
    expect(verseFor('close', 1)).toBe(VERSES.close[0]);
    expect(verseFor('close', 2)).toBe(VERSES.close[1]);
    expect(arcadeEntry('kintsugi')?.root).toBe('psa147.3');
  });

  it('gives the lobby its rhythm and how-to', () => {
    const r = kintsugiRhythm();
    expect(r.focus.def).toBe(RULES.focus.def);
    expect(r.rest.def).toBe(RULES.rest.def);
    expect(r.restSec?.(2)).toBe(2 * CYC);
    expect(howto(true).hands).toHaveLength(1);
    expect(howto(false).hands).toHaveLength(2);
  });
});

describe('Złote serce — the layout and the lobby', () => {
  it('keeps the 0–10 row tappable and the player card’s place free, inside the insets and under the HUD', () => {
    for (const size of CHECK_SIZES) {
      for (const tracks of [false, true]) {
        const l = layout(size.w, size.h, size.insets, tracks);
        const targets = l.rate.map((r, i) => ({ label: String(i), ...r }));
        expect(auditTargets(targets, size.w, size.h, size.insets), `${size.name} ${tracks}`).toEqual([]);
        for (const r of l.rate) expect(Math.min(r.w, r.h)).toBeGreaterThanOrEqual(MIN_TAP);
        expect(l.s).toBeGreaterThan(20);
        if (tracks) {
          const m = l.music!;
          expect(m.w).toBeGreaterThanOrEqual(200);
          expect(m.h).toBeGreaterThanOrEqual(228);
          expect(m.y).toBeGreaterThanOrEqual(size.insets.top);
          expect(m.x).toBeGreaterThanOrEqual(size.insets.left);
          expect(m.x + m.w).toBeLessThanOrEqual(size.w - size.insets.right + 0.5);
          expect(m.y + m.h).toBeLessThanOrEqual(size.h - size.insets.bottom + 0.5);
          // the words' band (the quality word and its verse too) and the breath guide's ring never under the card
          const hit = (r: { x: number; y: number; w: number; h: number }) => r.x < m.x + m.w && m.x < r.x + r.w && r.y < m.y + m.h && m.y < r.y + r.h;
          expect(hit(l.band), `${size.name} band`).toBe(false);
          const g = l.guide;
          expect(hit({ x: g.cx - g.r, y: g.cy - g.r, w: 2 * g.r, h: 2 * g.r }), `${size.name} guide`).toBe(false);
          // never over the heart
          const heart = { x: l.cx - l.s, y: l.cy + HEART.top * l.s, w: 2 * l.s, h: (HEART.bottom - HEART.top) * l.s };
          const heartC = { ...heart, y: l.cyC + HEART.top * l.s };
          for (const hb of [heart, heartC]) {
            const overlap = hb.x < m.x + m.w && m.x < hb.x + hb.w && hb.y < m.y + m.h && m.y < hb.y + hb.h;
            expect(overlap, `${size.name}`).toBe(false);
          }
        } else expect(l.music).toBeNull();
        // the breath guide stays on the screen
        const gh = guideHeight(l.guide.r, l.guide.layout);
        expect(l.guide.cy + gh / 2 - 6).toBeLessThanOrEqual(size.h - size.insets.bottom + 1);
      }
    }
  });

  it('builds the card: the numbers, what hurts, the 0–10, the breath, the care note and the forecast', () => {
    const p = freshProgress();
    let saves = 0;
    const el = progressPanel(p, () => { saves++; });
    document.body.append(el);
    expect(el.textContent).toContain(t('panel.words'));
    expect(el.textContent).toContain(t('panel.care'));
    const own = [...el.querySelectorAll('button')].find(b => b.textContent === t('set.own'))!;
    own.click();
    expect(p.words).toBe('own');
    expect(saves).toBe(1);
    const four = [...el.querySelectorAll('button')].find(b => b.textContent === '4')!;
    four.click();
    expect(p.before).toBe(4);
    for (const b of el.querySelectorAll('button')) if (!b.closest('.kin-music')) expect((b as HTMLElement).style.minHeight).toBe('44px');
    expect(forecastLines(p, 600)[0]).toMatch(/10 min/);
    el.remove();
  });
});
