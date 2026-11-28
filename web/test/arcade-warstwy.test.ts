// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { BREATH_PRESETS, breathCycle } from '../src/arcade/kit/breath';
import { DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { ALL_VERSES, LAYERS, cleanOwn } from '../src/arcade/warstwy/content';
import { EGGS, EGG_BOTTOM, EGG_HALF, EGG_TOP, placeHooks } from '../src/arcade/warstwy/egg';
import { figPt, layout } from '../src/arcade/warstwy/layout';
import { CHECK_SIZES, MIN_READ } from '../src/arcade/kit/mobile';
import { howto, warstwyRhythm } from '../src/arcade/warstwy/index';
import { forecastLines } from '../src/arcade/warstwy/panel';
import { CATALOGS, linesOf, t, unit } from '../src/arcade/warstwy/i18n';
import { freshProgress, migrate, setOwn, type WarstwyProgress } from '../src/arcade/warstwy/meta';
import { RULES, fillFor, focusRate, hooksFor, learnPace, planFor } from '../src/arcade/warstwy/rules';
import { WarstwySim, type SimEvent } from '../src/arcade/warstwy/sim';
import { arcadeEntry } from '../src/arcade/registry';
import { mulberry32 } from '../src/core/random';
import { catalogProblems, LANGS } from '../src/i18n';
import { CATALOGS as ARCADE_TEXTS } from '../src/i18n/arcade';
import { MOUSE_CATALOGS as MOUSE_TEXTS } from '../src/i18n/arcade-mouse';
import { SESSION_MINUTES } from '../src/settings';

const STEP = 1 / 20;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const CYC = breathCycle(BREATH_PRESETS.even);
const LENGTHS = SESSION_MINUTES.map(m => m * 60);

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.9, activity: 6, focused: true, hold: 14, calm: 0.05 });
const LOW = frame({ level: 0.3, activity: 1, focused: false, calm: 0.6 });
const HALF = frame({ level: 0.5, activity: 2, focused: true, hold: 2, calm: 0.3 });

type SimOpts = { progress?: Partial<WarstwyProgress>; planned?: number; seed?: number; eeg?: boolean; rhythm?: { focus: number; rest: number; custom: boolean } | null };

function makeSim(o: SimOpts = {}): WarstwySim {
  const sim = new WarstwySim({
    progress: { ...freshProgress(), sessions: 4, seen: ['c.draw', 'c.rest', 'c.tap'], ...o.progress } as WarstwyProgress,
    rng: mulberry32(o.seed ?? 7), plannedSec: o.planned ?? 600, eeg: o.eeg ?? false, tuning: TUNING, rhythm: o.rhythm ?? null,
  });
  sim.start();
  return sim;
}

type FrameFn = (t: number, sim: WarstwySim) => FocusFrame;
function drive(sim: WarstwySim, sec: number, f: FocusFrame | FrameFn, clock = { t: 0 }, out: SimEvent[] = []): SimEvent[] {
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}
/** A player who focuses in the push blocks with `push` and rests in the rest blocks. */
const player = (push: FocusFrame | FrameFn): FrameFn => (tt, s) => (s.pushBlock ? (typeof push === 'function' ? push(tt, s) : push) : LOW);
/**
 * The weaker player: focused about 6 s of every 10, in 2-s stretches that come and go at random (a hash of the time and
 * the session, so no push lines up with the focus by chance), a little above the threshold, the hold growing in each
 * stretch.
 */
const weak = (seed: number): FrameFn => tt => {
  const on = (i: number) => {
    const x = Math.sin(i * 127.1 + seed * 311.7 + 17.3) * 43758.5453;
    return x - Math.floor(x) < 0.6;
  };
  const i = Math.floor(tt / 2);
  if (!on(i)) return frame({ level: 0.42, activity: 1.5, focused: false, calm: 0.4 });
  let run = tt - i * 2;
  for (let j = i - 1; j >= 0 && on(j) && run < 12; j--) run += 2;
  return frame({ level: 0.58, activity: 2.5, focused: true, hold: run, calm: 0.2 });
};
/** The threshold player: focused, the hold growing over each 12 s stretch. */
const THRESH: FrameFn = tt => frame({ level: 0.56, activity: 2.4, focused: true, hold: tt % 12, calm: 0.2 });
const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

describe('Warstwy światła — the plan', () => {
  it('fills every session length 3–60 min and a ≤ 60 s test: the stages in order, ending at T', () => {
    for (const T of [40, 60, ...LENGTHS]) {
      for (const eeg of [false, true]) {
        for (const cyc of [CYC, 19]) {
          const p = planFor({ plannedSec: T, cyc, eeg });
          const at = `${T} s, ${eeg ? 'eeg' : 'fnirs'}, ${cyc} s breath`;
          expect(p.arriveEnd, at).toBeGreaterThan(0);
          expect(p.layersEnd, at).toBeGreaterThan(p.arriveEnd);
          expect(p.wholeEnd, at).toBeGreaterThanOrEqual(p.layersEnd - 1e-6);
          expect(p.wholeEnd, at).toBeLessThan(T);
          expect(p.test).toBe(T <= 60);
          // the pushes and the rests between them fill the layers' time exactly, each push past its lead-in
          expect(p.pushes * p.push + (p.pushes - 1) * p.rest, at).toBeCloseTo(p.layersEnd - p.arriveEnd, 6);
          expect(p.push - p.lead, at).toBeGreaterThanOrEqual(p.test ? 10 : RULES.sightMin - 1e-6);
          expect(p.win, at).toBeCloseTo(p.sighted / 7, 9);
          // a short session keeps its sighted time: every layer has a few seconds of it
          expect(p.win, at).toBeGreaterThanOrEqual(p.test ? 2 : 6);
        }
      }
    }
  });

  it('puts more things on each layer and deeper rests as the session grows', () => {
    const n = LENGTHS.map(hooksFor);
    expect(n[0]).toBe(2);
    expect(n[n.length - 1]).toBe(7);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeGreaterThanOrEqual(n[i - 1]);
    expect(planFor({ plannedSec: 180, cyc: CYC, eeg: false }).restBreaths).toBe(1);
    expect(planFor({ plannedSec: 3600, cyc: CYC, eeg: false }).restBreaths).toBe(3);
    expect(planFor({ plannedSec: 600, cyc: CYC, eeg: false, rest: 4, custom: true }).restBreaths).toBe(4);
  });

  it('fits the focus a thing asks to the pace: a faster pace asks more of each', () => {
    const slow = planFor({ plannedSec: 900, cyc: CYC, eeg: false, pace: 0.4 });
    const fast = planFor({ plannedSec: 900, cyc: CYC, eeg: false, pace: 1.2 });
    expect(fast.need).toBeGreaterThan(slow.need);
    expect(slow.need * slow.hooks).toBeLessThanOrEqual(slow.win * 0.4 * RULES.fill + 1e-6);
    // a short layer keeps more room: a few unlucky seconds weigh more there
    expect(fillFor(12)).toBeLessThan(fillFor(60));
    expect(fillFor(600)).toBe(RULES.fill);
  });

  it('learns the pace half-way, only from a session with enough sighted time', () => {
    expect(learnPace(null, 5, RULES.paceSec - 1)).toBeNull();
    expect(learnPace(null, 100, 100)).toBeCloseTo((RULES.paceFirst + 1) / 2, 3);
    expect(learnPace(0.8, 0, 100)).toBeCloseTo((0.8 + RULES.paceMin) / 2, 3);
  });

  it('only real focus moves anything: no rate without focus', () => {
    expect(focusRate(0.9, false, 10)).toBe(0);
    expect(focusRate(0.9, true, 12)).toBeGreaterThan(focusRate(0.55, true, 0));
  });
});

describe('Warstwy światła — the session', () => {
  it('draws a thing only while focused, past the lead-in, and waits without focus', () => {
    const sim = makeSim({ planned: 600 });
    const clock = { t: 0 };
    drive(sim, sim.plan.arriveEnd + 0.5, LOW, clock);
    expect(sim.stage).toBe('layers');
    expect(sim.block.what).toBe('draw');
    drive(sim, 20, LOW, clock);
    expect(sim.layers[0].hooks.every(h => h.p === 0)).toBe(true);
    const evs = drive(sim, 25, HIGH, clock);
    expect(ofType(evs, 'drawn').filter(e => !e.grace).length).toBeGreaterThan(0);
    expect(sim.score).toBeGreaterThan(0);
  });

  it('nothing is drawn without focus at any length: the Light takes it all and every layer still closes', () => {
    for (const T of [40, 180, 600, 3600]) {
      const sim = makeSim({ planned: T, seed: T });
      drive(sim, T + 0.5, LOW);
      expect(sim.score, `${T}`).toBe(0);
      expect(sim.cleared, `${T}`).toBe(7);
      expect(sim.graceN).toBe(sim.total);
      expect(sim.stage).toBe('close');
    }
  });

  it('a half-drawn thing waits on its thread through a rest — nothing is lost', () => {
    const sim = makeSim({ planned: 1800, seed: 3 });
    const clock = { t: 0 };
    drive(sim, sim.plan.arriveEnd + sim.lead + 0.2, LOW, clock);
    // focus for a moment only: the first thing loosens a little
    drive(sim, 2, HIGH, clock);
    const h = sim.active()!;
    const p = h.p;
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
    drive(sim, 15, LOW, clock);
    expect(h.p).toBe(p);
  });

  it('closes every layer and reaches the whole and the close at every length, with any focus', () => {
    for (const T of [40, 60, ...LENGTHS]) {
      for (const f of [LOW, player(HALF), player(HIGH)]) {
        const sim = makeSim({ planned: T, seed: T + 1 });
        const evs = drive(sim, T + 0.3, f);
        expect(sim.stage, `${T}`).toBe('close');
        expect(sim.cleared, `${T}`).toBe(7);
        expect(ofType(evs, 'healed')).toHaveLength(7);
        expect(sim.layers.every(L => L.hooks.every(h => h.state === 'gone'))).toBe(true);
        expect(sim.canStop()).toBe(true);
      }
    }
  });

  it('a test session (≤ 60 s; app:smoke plays 40 s at half focus) scores', () => {
    for (const T of [40, 60]) {
      for (const eeg of [false, true]) {
        for (const f of [HALF, HIGH, player(HALF)]) {
          const sim = makeSim({ planned: T, seed: T, eeg });
          drive(sim, T * 0.8, f);
          expect(sim.score, `${T} s ${eeg ? 'eeg' : 'fnirs'}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('a strong player draws every thing of all seven layers at every length, the first session too', () => {
    for (const T of LENGTHS) {
      const sim = makeSim({ planned: T, seed: T + 2, progress: { pace: null } });
      drive(sim, T + 0.3, player(HIGH));
      expect(sim.graceN, `${T}`).toBe(0);
      expect(sim.score, `${T}`).toBe(sim.total);
    }
  });
});

/** Sessions in a row with the pace carried: completion (drawn with focus / all) of each; `f(s)` plays session s. */
function series(T: number, f: (s: number) => FrameFn, n: number, seed = 1): number[] {
  const p = { ...freshProgress(), seen: ['c.draw', 'c.rest', 'c.tap'] } as WarstwyProgress;
  const out: number[] = [];
  for (let s = 0; s < n; s++) {
    const sim = new WarstwySim({ progress: p, rng: mulberry32(seed + s), plannedSec: T, eeg: false, tuning: TUNING, rhythm: null });
    sim.start();
    drive(sim, T + 0.3, player(f(s)));
    sim.finish();
    out.push(sim.score / sim.total);
  }
  return out;
}

describe('Warstwy światła — the work fits the session (§24.4b)', () => {
  it('weak, threshold and strong players draw ≥ 90 % once the pace is learnt, at every length', () => {
    const rows: string[] = [];
    const fails: string[] = [];
    const RUNS = 3;
    for (const T of LENGTHS) {
      const kinds: [string, (r: number) => (s: number) => FrameFn][] = [
        ['weak', r => s => weak(r * 100 + s)], ['threshold', () => () => THRESH], ['strong', () => () => () => HIGH],
      ];
      for (const [name, mk] of kinds) {
        // each cell: the mean of a few series (the weak player's focus differs every session)
        const runs = Array.from({ length: RUNS }, (_, r) => series(T, mk(r), 13, T + r * 7));
        const c = runs[0].map((_, i) => runs.reduce((sum, x) => sum + x[i], 0) / RUNS);
        rows.push(`${T / 60} min ${name}: ${[0, 1, 4, 12].map(i => Math.round(c[i] * 100)).join(' / ')}`);
        for (const i of [4, 12]) if (c[i] < 0.9) fails.push(`${T / 60} min ${name} session ${i + 1}: ${Math.round(c[i] * 100)} %`);
      }
    }
    // the grid (sessions 1 / 2 / 5 / 13), for the design notes
    console.log(rows.join('\n'));
    expect(fails).toEqual([]);
  }, 240_000);
});

describe('Warstwy światła — the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('keeps the narrator short and every moment voiced', () => {
    for (const m of ['arrive', ...LAYERS.map(L => `begin.${L.id}`), 'drawn', 'wait', 'healed', 'grace', 'rest', 'whole', 'close']) {
      const lines = linesOf(m);
      expect(lines.length, m).toBeGreaterThan(0);
      for (const s of lines) expect([...s].length, s).toBeLessThanOrEqual(90);
    }
  });

  it('speaks of light, not energy — no promise of healing, no magic, no power of one’s own (in four languages)', () => {
    const FORBID: Record<string, RegExp> = {
      pl: /energi|wibrac|aktywuj|manifest|uzdrawia|uzdrowi|\b(u|wy)?leczy|czakr|kundalini|magi[aię]|zaklęci|\bmocą\b|oczyszczam/i,
      en: /energy|vibration|\bheal(s|ing|ed)?\b|\bcures?\b|chakra|kundalini|\bactivate|\bmanifest|\bmagic|\bspell\b|by my power/i,
      de: /energie|schwingung|heilt|heilung|chakra|kundalini|aktivier|manifest|magie|zauber/i,
      sv: /energi|vibration|\bhelar\b|helande|läker|chakra|kundalini|aktiver|manifest|magi|trollformel/i,
    };
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(CATALOGS[l])) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
      }
      for (const [k, m] of Object.entries(ARCADE_TEXTS[l]).filter(([k]) => k.startsWith('warstwy.'))) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m as object)) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
      }
      for (const [k, s] of Object.entries(MOUSE_TEXTS[l]).filter(([k]) => k.startsWith('warstwy.'))) expect(s, `${l}.${k}`).not.toMatch(FORBID[l]);
    }
  });

  it('names the aura once, in the lobby text only, says plainly it is not therapy nor deliverance, and points to a priest', () => {
    for (const l of LANGS) {
      const a = ARCADE_TEXTS[l] as Record<string, string>;
      expect(a['warstwy.text'].match(/aur/gi), l).toHaveLength(1);
      for (const [k, s] of Object.entries(a).filter(([k]) => k.startsWith('warstwy.') && k !== 'warstwy.text')) expect(s, `${l}.${k}`).not.toMatch(/\baur/i);
      for (const [k, m] of Object.entries(CATALOGS[l])) for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(s, `${l}.${k}`).not.toMatch(/\baur/i);
      expect(a['warstwy.tip5']).toMatch(/terapi|therapy|Therapie/);
      expect(a['warstwy.tip5']).toMatch(/uwolnienie|deliverance|Befreiungsgebet|befrielsebön/);
      expect(a['warstwy.tip5']).toMatch(/kapłan|priest|Priester|präst/);
      expect((CATALOGS[l] as Record<string, string>)['panel.care']).toMatch(/kapłan|priest|Priester|präst/);
      // the founder asked for the etheric and the astral bodies named
      expect(a['warstwy.text']).toMatch(/eteryczn|etheric|ätherisch|eterisk/);
      expect(a['warstwy.text']).toMatch(/astraln|astral/);
    }
    expect((MOUSE_TEXTS.pl as Record<string, string>)['warstwy.how3']).toMatch(/kliknij/);
  });

  it('keeps the Polish second person free of gendered forms', () => {
    // "Jezus zabiera sam" speaks of Jesus, not of the player
    const him = (s: string) => s.replace(/Jezus (zabiera|zabrał) sam/g, '');
    const GENDERED = /(?<!\p{L})\p{L}+(łeś|łaś|łbyś|łabyś)(?!\p{L})|(?<!\p{L})gotow[ya](?!\p{L})|(?<!\p{L})sam[ao]?(?!\p{L})|(?<!\p{L})cał[ya](?!\p{L})|\p{L}\/a(?!\p{L})|bądź spokojn/iu;
    for (const [k, m] of Object.entries(CATALOGS.pl)) for (const s of typeof m === 'string' ? [m] : Object.values(m)) expect(him(s), k).not.toMatch(GENDERED);
    for (const [k, s] of Object.entries(ARCADE_TEXTS.pl).filter(([k]) => k.startsWith('warstwy.'))) expect(him(s as string), k).not.toMatch(GENDERED);
  });

  it('counts threads of light in Polish with all forms', () => {
    expect(unit(1)).toBe('nić światła');
    expect(unit(3)).toBe('nici światła');
    expect(unit(5)).toBe('nici światła');
    expect(t('threads', { n: 22 })).toBe('22 nici światła');
  });

  it('quotes only verified passages, each in four languages', () => {
    for (const id of ALL_VERSES) for (const l of LANGS) expect(passage(id, l).text.length, `${id} ${l}`).toBeGreaterThan(10);
    expect(arcadeEntry('warstwy')?.root).toBe('1th5.23');
    expect(arcadeEntry('warstwy')?.kind).toBe('heart');
  });
});

describe('Warstwy światła — the progress and privacy', () => {
  it('migrates fresh, broken and hostile saves field by field', () => {
    const broken = migrate({ ver: 3, sessions: 4 } as unknown as WarstwyProgress);
    expect(broken.sessions).toBe(4);
    expect(broken.pace).toBeNull();
    const hostile = migrate({ ...freshProgress(), best: -3, pace: 'x', own: { cialo: 42, duch: 'a\u0000b'.repeat(40) }, seen: [1, 'a', 'a'] } as unknown as WarstwyProgress);
    expect(hostile.best).toBe(0);
    expect(hostile.pace).toBeNull();
    expect(hostile.own.cialo).toBe('');
    expect([...hostile.own.duch].length).toBeLessThanOrEqual(40);
    expect(hostile.seen).toEqual(['a']);
    expect(cleanOwn('  lęk \n o   jutro ')).toBe('lęk o jutro');
  });

  it('shows own lines with their layer only, and never puts them into the result', () => {
    const p = { ...freshProgress(), sessions: 4, seen: ['c.draw', 'c.rest', 'c.tap'] } as WarstwyProgress;
    setOwn(p, 'cialo', 'ZMĘCZENIE-PRYWATNE');
    setOwn(p, 'duch', 'SEKRET-DUCHA');
    const sim = makeSim({ planned: 600, progress: p });
    const clock = { t: 0 };
    let seen = false;
    drive(sim, 600.3, (_t, s) => {
      if (s.own.includes('ZMĘCZENIE')) {
        seen = true;
        expect(s.stage).toBe('layers');
        expect(s.restLayer.id).toBe('cialo');
      }
      return s.pushBlock ? HIGH : LOW;
    }, clock);
    expect(seen).toBe(true);
    sim.finish();
    const json = JSON.stringify(sim.result());
    expect(json).not.toMatch(/ZMĘCZENIE|SEKRET/);
  });

  it('settles once: the result is idempotent, records only rise', () => {
    const sim = makeSim({ planned: 600 });
    drive(sim, 600.3, player(HIGH));
    sim.finish();
    const a = JSON.stringify(sim.result());
    sim.finish();
    expect(JSON.stringify(sim.result())).toBe(a);
    expect(sim.p.sessions).toBe(5);
    expect(sim.p.best).toBe(sim.score);
    expect(sim.p.pace).not.toBeNull();
  });
});

describe('Warstwy światła — the geometry', () => {
  it('nests the eggs and keeps every thing inside its own layer', () => {
    for (let k = 1; k < 7; k++) {
      expect(EGGS[k].a).toBeGreaterThan(EGGS[k - 1].a);
      expect(EGGS[k].b).toBeGreaterThan(EGGS[k - 1].b);
    }
    for (let k = 0; k < 7; k++) {
      const spots = placeHooks(k, 7, mulberry32(k + 1));
      expect(spots).toHaveLength(7);
      for (const s of spots) {
        expect(Math.abs(s.x)).toBeLessThanOrEqual(EGGS[6].a * 1.1);
        expect(s.y).toBeGreaterThan(-0.3);
        expect(s.y).toBeLessThan(1.3);
      }
    }
  });
});

describe('Warstwy światła — the layout and the lobby', () => {
  it('keeps the words inside the insets and the egg below the HUD, whole and clear of the words, at every size', () => {
    for (const size of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(size.w, size.h, size.insets, touch);
        const at = `${size.name} ${touch ? 'touch' : 'mouse'}`;
        const B = L.band;
        expect(B.x, at).toBeGreaterThanOrEqual(size.insets.left);
        expect(B.y, at).toBeGreaterThanOrEqual(size.insets.top);
        expect(B.x + B.w, at).toBeLessThanOrEqual(size.w - size.insets.right + 0.5);
        expect(B.y + B.h, at).toBeLessThanOrEqual(size.h - size.insets.bottom + 0.5);
        expect(B.h, at).toBeGreaterThanOrEqual(110);
        const top = figPt(L, 0, EGG_TOP), bottom = figPt(L, 0, EGG_BOTTOM);
        const left = figPt(L, -EGG_HALF, 0.5), right = figPt(L, EGG_HALF, 0.5);
        expect(top.y, at).toBeGreaterThanOrEqual(size.insets.top);
        expect(bottom.y, at).toBeLessThanOrEqual(L.stage.y + L.stage.h + 0.5);
        expect(left.x, at).toBeGreaterThanOrEqual(L.stage.x - 0.5);
        expect(right.x, at).toBeLessThanOrEqual(L.stage.x + L.stage.w + 0.5);
        // the egg and the words never overlap
        const egg = { x: left.x, y: top.y, w: right.x - left.x, h: bottom.y - top.y };
        const overlap = Math.min(egg.x + egg.w, B.x + B.w) - Math.max(egg.x, B.x) > 1 && Math.min(egg.y + egg.h, B.y + B.h) - Math.max(egg.y, B.y) > 1;
        expect(overlap, at).toBe(false);
        expect(L.fig.H, at).toBeGreaterThanOrEqual(120);
        for (const px of Object.values(L.font)) expect(px).toBeGreaterThanOrEqual(MIN_READ - 1);
      }
    }
  });

  it('gives the lobby its rhythm, its how-to and a forecast for the chosen length', () => {
    const r = warstwyRhythm();
    expect(r.focus.def).toBe(RULES.focus.def);
    expect(r.rest.def).toBe(RULES.rest.def);
    expect(r.restSec?.(2)).toBe(2 * CYC);
    expect(howto(true).hands).toHaveLength(1);
    expect(howto(false).hands).toHaveLength(2);
    const fc = forecastLines(freshProgress(), 600).join(' ');
    expect(fc).toMatch(/10/);
    expect(fc).toMatch(/3\u00a0rzeczy do oddania/);
  });
});
