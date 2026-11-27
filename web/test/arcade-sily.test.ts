/**
 * Nowe siły (src/arcade/sily, DESIGN §28) on the health visualisations' engine: the library passes the engine's check;
 * a 40 s test session scores, the first time and after; nothing grows without focus; the session's arc (the engine's
 * round-24 addition, WorldState.arc) renews the tired figure fully in a well-focused session of 3, 10, 30, 45 and 60
 * minutes and leaves it partial without focus — the fit grid holds ≥ 90 % for weak, threshold and strong players; the
 * renewal never falls and keeps what earlier scenes gave; the numbers stand as cited in all four languages; the tone
 * (a visualisation, never a promise of healing); and every picture paints at every growth, in every look, without a
 * NaN or a negative radius.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import { FRAMES } from '../src/arcade/kit/healthlib/testing';
import { ARC } from '../src/arcade/kit/healthlib/sim';
import type { FocusFrame } from '../src/arcade/kit/focus';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { LIBRARY, MEDS, SCENES, medOf } from '../src/arcade/sily/library';
import { tc } from '../src/arcade/sily/i18n';
import { buildTune } from '../src/arcade/sily/tune';
import { LOOKS, geoOf, paintFigure, quant, skinOf } from '../src/arcade/sily/figure';
import { LEAD_K, LEAD_MAX, PARAMS, RENEWED, SERVES, TIRED, overall, renewal } from '../src/arcade/sily/renew';
import { ARCADE } from '../src/arcade/registry';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const text = (l: Lang, k: string): string => {
  const m = W[l][k as keyof typeof W.pl];
  return typeof m === 'string' ? m : m ? Object.values(m).join(' ') : '';
};
const flat = (s: string): string => s.replace(/[  ]/g, ' ');
const all = (l: Lang): [string, string][] =>
  Object.entries(W[l]).map(([k, m]) => [k, typeof m === 'string' ? m : Object.values(m).join(' ')]);

/** a player who focuses `on` seconds of every `cycle` at `level` (the band reads calm in rest) */
const player = (on: number, cycle: number, level: number) => (t: number): FocusFrame => {
  const x = t % cycle, f = x < on;
  return { ...FRAMES.mid, level: f ? level : 0.35, focused: f, hold: f ? x : 0, activity: f ? 2.4 : 1 };
};
const PLAYERS = { weak: player(6, 10, 0.5), threshold: player(6, 8, 0.6), strong: (): FocusFrame => FRAMES.high };
const returning = (n: number) => (n > 1 ? { returning: true, progress: { sessions: n - 1, pushes: (n - 1) * 6 } } : {});

describe('Nowe siły — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('has five meditations of fourteen scenes, the figure and the tissue alternating, each serving a parameter', () => {
    expect(MEDS.map(m => m.id)).toEqual(['zrodlo', 'skora', 'sila', 'noc', 'cala']);
    expect(Object.keys(SCENES)).toHaveLength(14);
    for (const m of MEDS) {
      const worlds = m.scenes.map(s => SCENES[s].world);
      expect(worlds.includes('postac'), `${m.id} shows the person`).toBe(true);
      expect(worlds.some(w => w !== 'postac'), `${m.id} looks under the lens`).toBe(true);
      expect(SERVES[m.id]?.length, `${m.id} serves a parameter`).toBeGreaterThan(0);
    }
    expect(new Set(Object.values(SERVES).flat())).toEqual(new Set(PARAMS));
    expect(LIBRARY.looks).toEqual(['f1', 'f2', 'f3', 'm1', 'm2', 'm3']);
    expect(LIBRARY.root).toBe('isa40.31');
  });

  it('is in the registry as a health visualisation right before Rozkwit, with its unit and tune', () => {
    const i = ARCADE.findIndex(a => a.id === 'sily');
    const g = ARCADE[i];
    expect(g?.kind).toBe('health');
    expect(g?.title).toBe('Nowe siły');
    expect(g?.unit).toBe('nowych komórek');
    expect(g?.root).toBe('isa40.31');
    expect(g?.tools).toEqual(['fnirs', 'eeg']);
    expect(ARCADE[i + 1]?.id).toBe('rozkwit');
    expect(g?.tips[4]).toMatch(/nie leczenie/);
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(song.parts.every(p => p.notes.every(n => Number.isFinite(n.at) && Number.isFinite(n.deg) && n.at + n.len <= song.beats + 1e-9))).toBe(true);
  });
});

describe('Nowe siły — progress only from focus', () => {
  it('scores in a 40 s test session, the first time and after', () => {
    expect(simSession(LIBRARY).score).toBeGreaterThan(0);
    expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);
    expect(simSession(LIBRARY).sim.arc).toBeGreaterThan(0);
  });

  it('grows nothing without focus — and the figure stays tired', () => {
    for (const focus of ['none', 'unfocused'] as const) {
      const r = simSession(LIBRARY, { returning: true, focus, planned: 120 });
      expect(r.grownSec).toBe(0);
      expect(r.score).toBe(0);
      expect(r.sim.arc).toBe(0);
      expect(renewal(r.sim.arc, r.sim.sessionGrowth, medOf)).toEqual(TIRED);
    }
  });
});

describe('Nowe siły — the figure recovers over the session', () => {
  for (const min of [3, 10, 30, 45, 60]) {
    it(`a well-focused ${min}-minute session ends with the figure fully renewed`, () => {
      let at = -1;
      const r = simSession(LIBRARY, { planned: min * 60, returning: true, focus: 'high', each: (t, s) => { if (at < 0 && s.arc >= 1) at = t; } });
      expect(r.sim.arc).toBe(1);
      const R = renewal(r.sim.arc, r.sim.sessionGrowth, medOf);
      for (const p of PARAMS) expect(R[p], `${p} at ${min} min`).toBeGreaterThan(0.999);
      // renewed a little before the end, not at the first minute
      expect(at / (min * 60)).toBeGreaterThan(0.5);
      expect(at / (min * 60)).toBeLessThan(0.97);
    }, 60_000);
  }

  it('stays partial with only a few focused moments (2 s in 20)', () => {
    for (const min of [3, 10, 30]) {
      const r = simSession(LIBRARY, { planned: min * 60, returning: true, focus: player(2, 20, 0.5) });
      expect(r.sim.arc, `${min} min`).toBeGreaterThan(0);
      expect(r.sim.arc, `${min} min`).toBeLessThan(0.6);
      expect(overall(renewal(r.sim.arc, r.sim.sessionGrowth, medOf))).toBeLessThan(0.75);
    }
  }, 60_000);

  it('fits the session: ≥ 90 % for weak, threshold and strong players at 3–60 min, sessions 1, 2, 5 and 13', () => {
    const low: string[] = [];
    for (const min of [3, 10, 30, 60]) {
      for (const [name, f] of Object.entries(PLAYERS)) {
        for (const n of [1, 2, 5, 13]) {
          const r = simSession(LIBRARY, { planned: min * 60, focus: f, ...returning(n) });
          if (r.sim.arc < 0.9) low.push(`${min} min ${name} s${n}: ${r.sim.arc.toFixed(2)}`);
        }
      }
    }
    expect(low).toEqual([]);
  }, 240_000);

  it('the arc never falls within a session and starts tired every session', () => {
    let last = 0, fell = false;
    const r = simSession(LIBRARY, {
      planned: 600, returning: true, focus: player(8, 14, 0.7),
      each: (_t, s) => { if (s.arc < last - 1e-12) fell = true; last = s.arc; },
    });
    expect(fell).toBe(false);
    expect(r.sim.arc).toBeGreaterThan(0.5);
    // the next session (the same progress) starts at nothing again
    const next = simSession(LIBRARY, { planned: 60, progress: r.progress, focus: 'none' });
    expect(next.sim.arc).toBe(0);
  }, 60_000);

  it('a blind push’s growth reaches the arc at its end (sessions from the third)', () => {
    const r = simSession(LIBRARY, { planned: 600, returning: true, progress: { sessions: 4, pushes: 3 }, focus: 'high' });
    expect(r.events.some(e => e.type === 'blindEnd')).toBe(true);
    expect(r.sim.arc).toBe(1);
  }, 60_000);

  it('ARC constants are the documented ones', () => {
    expect(ARC.margin).toBeCloseTo(0.88);
    expect(ARC.floor).toBeLessThan(ARC.prior);
  });
});

describe('Nowe siły — the renewal, parameter by parameter', () => {
  it('is tired at 0 and fully renewed at 1, in a fixed order', () => {
    expect(renewal(0, undefined, medOf)).toEqual(TIRED);
    expect(renewal(1, undefined, medOf)).toEqual(RENEWED);
    const mid = renewal(0.35, undefined, medOf);
    // colour comes first, the smile last
    expect(mid.kolor).toBeGreaterThan(mid.skora);
    expect(mid.skora).toBeGreaterThanOrEqual(mid.oczy);
    expect(mid.usmiech).toBe(0);
  });

  it('lets the walked meditation’s parameter lead, and keeps what earlier scenes gave', () => {
    const r = renewal(0.05, { sen: 1, naprawa: 1 }, medOf);
    expect(r.oczy).toBeCloseTo(Math.min(LEAD_MAX, 2 * LEAD_K));
    expect(r.oczy).toBeGreaterThan(r.kolor);
    // the hair and the skin both answer „Nowa skóra”
    const s = renewal(0, { twarz: 0.5 }, medOf);
    expect(s.skora).toBeCloseTo(0.5 * LEAD_K);
    expect(s.wlosy).toBeCloseTo(0.5 * LEAD_K);
    expect(s.postawa).toBe(0);
  });

  it('never falls as the arc and the session grow', () => {
    let prev = renewal(0, {}, medOf);
    const sess: Record<string, number> = {};
    const scenes = Object.keys(SCENES);
    for (let i = 1; i <= 200; i++) {
      const sc = scenes[i % scenes.length];
      sess[sc] = (sess[sc] ?? 0) + 0.07;
      const now = renewal(i / 200, sess, medOf);
      for (const p of PARAMS) expect(now[p]).toBeGreaterThanOrEqual(prev[p] - 1e-12);
      prev = now;
    }
  });

  it('the figure changes with each parameter: colour, posture, quantised in small steps', () => {
    for (const tone of [1, 2, 3] as const) expect(skinOf(tone, TIRED).base).not.toBe(skinOf(tone, RENEWED).base);
    expect(skinOf(1, TIRED).lip).not.toBe(skinOf(1, RENEWED).lip);
    for (const sex of ['f', 'm'] as const) {
      const tired = geoOf(sex, 0), up = geoOf(sex, 1);
      expect(up.sy).toBeLessThan(tired.sy);
      expect(up.sx).toBeGreaterThan(tired.sx);
      expect(up.cy).toBeLessThan(tired.cy);
    }
    const q = quant({ ...TIRED, kolor: 0.51 });
    expect(q.kolor * 24).toBeCloseTo(Math.round(0.51 * 24));
  });
});

describe('Nowe siły — the numbers stand as cited', () => {
  /** key → the numbers it must carry; every language carries the same (sources: DESIGN §28, the "sily" table). */
  const CITED: Readonly<Record<string, readonly string[]>> = {
    'teach.nisza': ['50', '200'], // Lee-Six et al. 2018: 50,000–200,000 HSCs
    'teach.krwinki': ['200', '2'], // Dzierzak & Philipsen 2013: ~2 × 10^11 a day
    'teach.warstwa': ['39'], // Weinstein et al. 1984
    'teach.mieszek': ['35'], // ≈ 0.35 mm a day (StatPearls; Loussouarn 2001)
    'teach.satelity': ['1961'], // Mauro 1961
    'teach.sen': ['2000', '149'], // Van Cauter et al. 2000: 149 men
    'teach.poranek': ['40', '2013'], // Sundelin et al. 2013: 40 raters
    'teach.zrodla': ['330', '90', '2021'], // Sender & Milo 2021
    'teach.jelito': ['3', '5', '2014'], // Darwich et al. 2014: 3.48 days
    'med.noc.care': ['7', '9'],
    'count.nisza': ['50', '200'],
    'count.krwinki': ['2'],
    'count.mieszek': ['35'],
    'count.jelito': ['3', '5'],
  };
  for (const [key, nums] of Object.entries(CITED)) {
    it(`${key}: ${nums.join(', ')}`, () => {
      for (const l of LANGS) {
        const t = flat(text(l, key));
        for (const n of nums) expect(t.includes(n), `${l} ${key} lacks “${n}”: ${t}`).toBe(true);
      }
    });
  }

  it('keeps a number with its unit by a no-break space', () => {
    const unit = /\d (dni|dnia|godzin|mm|mln|mld|tys|miliony|mężczyzn|oceniających|days|hours|million|billion|men|raters|Tage|Tagen|Stunden|Millionen|Mrd|Mio|Männer|Beurteilende|dagar|timmar|miljoner|miljarder|män|bedömare)\b/;
    for (const l of LANGS) for (const [k, s] of all(l)) expect(unit.test(s), `${l} ${k}: ${s}`).toBe(false);
  });

  it('counts the epidermis’s days as the scene grows', () => {
    const c = (g: number) => LIBRARY.worlds.naskorek.counter?.('warstwa', g) ?? null;
    expect(c(0.1)).toBeNull();
    expect(flat(c(1) ?? '')).toContain('39');
    expect(flat(tc('count.warstwa', 12, 'pl'))).toBe('dzień 12 z ok. 39');
  });
});

describe('Nowe siły — the tone', () => {
  it('never says that focus heals, cures or makes anyone younger, in any language', () => {
    const banned: Record<Lang, RegExp> = {
      pl: /uzdraw|uzdrow|ulecz|wylecz|odmład|młodsz|cudown|gwarant/i,
      en: /\bheal(s|ed|ing)?\b|\bcure|rejuven|younger|miracul|guarantee/i,
      de: /\bheilt\b|heilen|verjüng|jünger|wunder|garantier/i,
      sv: /\bläk(er|te|ning)\b|föryng|yngre|mirakel|garanter/i,
    };
    for (const l of LANGS) for (const [k, s] of all(l)) expect(banned[l].test(s), `${l} ${k}: ${s}`).toBe(false);
  });

  it('says plainly it is not a treatment, and names a doctor', () => {
    const notT: Record<Lang, RegExp> = { pl: /nie leczenie/, en: /not a treatment/, de: /keine Behandlung/, sv: /ingen behandling/ };
    const doctor: Record<Lang, RegExp> = { pl: /lekarz/, en: /doctor/, de: /Ärzt|Arzt/, sv: /läkare/ };
    for (const l of LANGS) {
      for (const k of ['panel.not', 'story.open2.text']) {
        expect(text(l, k), `${l} ${k}`).toMatch(notT[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(doctor[l]);
      }
      expect(text(l, 'howto.tip2')).toMatch(notT[l]);
    }
  });

  it('the narrator thanks; the closing card is a thanks, not a promise', () => {
    expect(text('pl', 'story.whole.text')).toMatch(/^Dziękuję/);
    expect(text('en', 'story.whole.text')).toMatch(/^Thank/);
    expect(text('de', 'story.whole.text')).toMatch(/^Danke/);
    expect(text('sv', 'story.whole.text')).toMatch(/^Tack/);
  });

  it('has the words for the body (Ciało słucha) in all four languages', () => {
    for (const m of MEDS) for (let i = 1; i <= 3; i++) for (const l of LANGS) expect(text(l, `word.${m.id}.${i}`).length, `${l} word.${m.id}.${i}`).toBeGreaterThan(10);
  });

  it('names the looks in all four languages', () => {
    for (const look of LOOKS) for (const l of LANGS) expect(text(l, `look.${look}`).length).toBeGreaterThan(3);
  });
});

// ── the pictures paint (a fake canvas that objects to NaN and negative radii) ──
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
    ellipse(): void {}
  };
}
function strictCtx(problems: string[]): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1 };
  return new Proxy(state, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return (...a: number[]) => {
          if (a.some(v => !Number.isFinite(v))) problems.push(`${String(k)}(${a.join(',')})`);
          if (k === 'createRadialGradient' && (a[2] < 0 || a[5] < 0)) problems.push(`${String(k)} negative radius`);
          return { addColorStop(o: number, c: string) { if (!(o >= 0 && o <= 1)) problems.push(`addColorStop(${o})`); if (typeof c !== 'string' || /NaN|undefined/.test(c)) problems.push(`colour ${c}`); } };
        };
      }
      if (k === 'getTransform') return () => ({ a: 3, b: 0, d: 3 });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        if (a.some(v => typeof v === 'number' && !Number.isFinite(v))) problems.push(`${String(k)}(${a.join(',')})`);
        if ((k === 'ellipse' || k === 'arc') && ((a[2] as number) < 0 || (k === 'ellipse' && (a[3] as number) < 0))) problems.push(`${String(k)} negative radius`);
      };
    },
    set(t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) problems.push(`${String(k)} = ${v}`);
      if (typeof v === 'string' && /NaN|undefined/.test(v)) problems.push(`${String(k)} = ${v}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Nowe siły — the pictures', () => {
  it('every scene bakes and draws at every growth, in play and in the lobby, in every look, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const look of LOOKS) {
      for (const [id, sc] of Object.entries(SCENES)) {
        const w = LIBRARY.worlds[sc.world];
        w.bake(ctx, sc.variant ?? '', look);
        for (const g of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1, 1.4]) {
          for (const [breath, growing, reduced, arc] of [[0.5, true, false, undefined], [0.1, false, false, g], [0.9, false, true, 1]] as const) {
            const st: WorldState = {
              scene: id, g, deep: 0.6, light: 0.7, growing, time: 7.3 + g * 3, after: g >= 1 ? 2 : 0, breath, blind: false, reduced, px: 3, look,
              ...(arc === undefined ? {} : { arc, session: { [id]: g, kosci: 0.4 } }),
            };
            w.draw(ctx, st);
          }
          const f = w.focusAt?.(id, g) ?? sc.focus;
          expect(Number.isFinite(f[0]) && Number.isFinite(f[1]), `${id} focus at ${g}`).toBe(true);
          const v = sc.view;
          expect(f[0] >= v.x && f[0] <= v.x + v.w && f[1] >= v.y && f[1] <= v.y + v.h, `${id} focus in view at ${g}`).toBe(true);
        }
      }
      paintFigure(ctx, look, TIRED, { closed: true, night: true });
      paintFigure(ctx, look, RENEWED);
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('dives from the person into the bone, the cheek, the hairline, the shoulder and the belly — inside the view', () => {
    for (const m of MEDS) {
      for (let i = 1; i < m.scenes.length; i++) {
        const [a, b] = [m.scenes[i - 1], m.scenes[i]];
        const da = LIBRARY.worlds[SCENES[a].world].depth, db = LIBRARY.worlds[SCENES[b].world].depth;
        if (da === db) continue;
        const shallow = da < db ? a : b, deep = da < db ? b : a;
        const p = LIBRARY.portal?.(shallow, deep) ?? null;
        expect(p, `${shallow} → ${deep}`).toBeTruthy();
        const v = SCENES[shallow].view;
        expect(p![0] >= v.x && p![0] <= v.x + v.w && p![1] >= v.y && p![1] <= v.y + v.h, `${shallow} → ${deep} portal in view`).toBe(true);
      }
    }
  });
});

describe('Nowe siły — 45 and 60 minutes', () => {
  it('a 60-minute session plays to its end with a short summary and bounded growth', () => {
    const r = simSession(LIBRARY, { planned: 3600, returning: true, focus: player(10, 14, 0.7) });
    expect(r.outcome.score).toBeGreaterThan(0);
    expect(Number.isFinite(r.outcome.score)).toBe(true);
    expect(r.outcome.highlights.length).toBeLessThanOrEqual(5);
    expect(Object.keys(r.sim.sessionGrowth).length).toBeLessThanOrEqual(14);
    expect(r.sim.arc).toBe(1);
    expect(r.meds).toBeGreaterThan(3);
  }, 120_000);
});
