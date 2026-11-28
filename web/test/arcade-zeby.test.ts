/**
 * Mocne zęby (src/arcade/zeby, DESIGN §24.4) on the health visualisations' engine: the library passes the engine's
 * check (with its one whitelisted truth, "enamel does not grow back"); a 40 s test session scores, the first time and
 * after; nothing grows without focus; the numbers the game cites stand as cited in all four languages and agree with
 * the pictures (the pH curve, the ligament, the tubules, the pairs); its own tone rules; and every picture paints at
 * every growth without a NaN or a negative radius.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { songProblems } from '../src/arcade/kit/song';
import { CEM_W, PDL_W } from '../src/arcade/zeby/geo';
import { LIBRARY, MEDS, SCENES } from '../src/arcade/zeby/library';
import { buildTune } from '../src/arcade/zeby/tune';
import { dayPh, stephan } from '../src/arcade/zeby/world-surface';
import { ARCADE } from '../src/arcade/registry';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const text = (l: Lang, k: string): string => {
  const m = W[l][k];
  return typeof m === 'string' ? m : m ? m.other : '';
};
const flat = (s: string): string => s.replace(/[ \u00a0]/g, ' ');

/** The one forbidden root the game must say, negated: the truth told kindly (DESIGN §24.4). */
export const ALLOW = [
  { text: 'Szkliwo nie odrasta', why: 'the truth said plainly: enamel cannot regrow (ameloblasts are lost at eruption)' },
  { text: 'Enamel does not grow back', why: 'the same truth in English' },
  { text: 'Schmelz wächst nicht nach', why: 'the same truth in German' },
  { text: 'Emaljen växer inte ut igen', why: 'the same truth in Swedish' },
];

describe('Mocne zęby — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY, { allow: ALLOW })).toEqual([]);
  });

  it('without its whitelist the check catches exactly the negated truth (nothing else)', () => {
    const p = checkLibrary(LIBRARY);
    expect(p.length).toBeGreaterThan(0);
    expect(p.every(x => /odras|grow back|nach|växer/i.test(x)), p.join('\n')).toBe(true);
  });

  it('has six meditations of three scenes, the last walking the whole', () => {
    expect(MEDS.map(m => m.id)).toEqual(['slina', 'posilek', 'szkliwo', 'zebina', 'korzen', 'usmiech']);
    expect(MEDS.every(m => m.scenes.length === 3)).toBe(true);
    expect(Object.keys(SCENES)).toHaveLength(18);
    // the whole smile reuses the face and the tooth, and adds the arch of pairs (its root verse's picture)
    const before = new Set(MEDS.slice(0, 5).flatMap(m => m.scenes.map(s => SCENES[s].world)));
    expect(before.has(SCENES.kapiel.world) && before.has(SCENES.caly.world)).toBe(true);
    expect(SCENES.pary.world).toBe('arch');
    expect(LIBRARY.root).toBe('sng4.2');
    expect(MEDS[5].verse).toBe('sng4.2');
  });

  it('is in the registry as a health visualisation with its unit and a sound tune', () => {
    const g = ARCADE.find(a => a.id === 'zeby');
    expect(g?.kind).toBe('health');
    expect(g?.unit).toBe('kryształów');
    expect((W.pl.unit as { many: string }).many).toContain('kryształów');
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(songProblems(song)).toEqual([]);
  });
});

describe('Mocne zęby — progress only from focus', () => {
  it('scores in a 40 s test session, the first time and after', () => {
    expect(simSession(LIBRARY).score).toBeGreaterThan(0);
    expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);
  });

  it('grows nothing without focus', () => {
    for (const focus of ['none', 'unfocused'] as const) {
      const r = simSession(LIBRARY, { returning: true, focus, planned: 120 });
      expect(r.grownSec, focus).toBe(0);
      expect(r.score, focus).toBe(0);
    }
  });
});

describe('Mocne zęby — the numbers stand as cited', () => {
  /** key → the numbers it must carry in each language (as written there). */
  const CITED: Readonly<Record<string, Readonly<Record<Lang, readonly string[]>>>> = {
    'teach.zrodla': { pl: ['600–1000', '0,5–1,5 l', '⅔'], en: ['600–1,000', '0.5–1.5 l', '⅔'], de: ['600–1000', '0,5–1,5 l', '⅔'], sv: ['600–1 000', '0,5–1,5 l', '⅔'] },
    'teach.plukanie': { pl: ['99 %'], en: ['99%'], de: ['99 %'], sv: ['99 %'] },
    'teach.kwas': { pl: ['5,5'], en: ['5.5'], de: ['5,5'], sv: ['5,5'] },
    'teach.powrot': { pl: ['20–40 minut'], en: ['20–40 minutes'], de: ['20–40 Minuten'], sv: ['20–40 minuter'] },
    'teach.pryzmaty': { pl: ['96 %', '5 µm'], en: ['96%', '5 µm'], de: ['96 %', '5 µm'], sv: ['96 %', '5 µm'] },
    'teach.fluor': { pl: ['4,5', '5,5'], en: ['4.5', '5.5'], de: ['4,5', '5,5'], sv: ['4,5', '5,5'] },
    'teach.kanaliki': { pl: ['70 %', '45 000', '20 000'], en: ['70%', '45,000', '20,000'], de: ['70 %', '45 000', '20 000'], sv: ['70 %', '45 000', '20 000'] },
    'teach.wiezadlo': { pl: ['0,15–0,35 mm'], en: ['0.15–0.35 mm'], de: ['0,15–0,35 mm'], sv: ['0,15–0,35 mm'] },
    'teach.dziaslo': { pl: ['4–6 dni'], en: ['4–6 days'], de: ['4–6 Tagen'], sv: ['4–6 dagar'] },
    'teach.kapiel': { pl: ['0,3–0,4 ml', '0,1 ml'], en: ['0.3–0.4 ml', '0.1 ml'], de: ['0,3–0,4 ml', '0,1 ml'], sv: ['0,3–0,4 ml', '0,1 ml'] },
    'teach.pary': { pl: ['32', '20'], en: ['32', '20'], de: ['32', '20'], sv: ['32', '20'] },
    'med.szkliwo.care': { pl: ['2 minuty', '1350–1500 ppm'], en: ['2 minutes', '1,350–1,500 ppm'], de: ['2 Minuten', '1350–1500 ppm'], sv: ['2 minuter', '1 350–1 500 ppm'] },
    'med.zebina.care': { pl: ['3–24'], en: ['3–24'], de: ['3–24'], sv: ['3–24'] },
  };
  for (const [key, by] of Object.entries(CITED)) {
    it(key, () => {
      for (const l of LANGS) for (const n of by[l]) expect(flat(text(l, key)), `${l} ${key}`).toContain(n);
    });
  }

  it('a number stays with its unit (a no-break space) wherever one is cited', () => {
    for (const l of LANGS) for (const [k, v] of Object.entries(W[l])) {
      const s = typeof v === 'string' ? v : v.other;
      expect(/\d (mm|µm|nm|ml|l|ppm|min|minut|minutes|Minuten|minuter|dni|days|Tagen|dagar|Tage)\b/.test(s), `${l} ${k}: ${s}`).toBe(false);
    }
  });

  it('the pH curve drawn is the one taught: falls within a minute, below ≈ 5.5, back to rest in ≈ 20–40 min', () => {
    expect(stephan(0)).toBe(7);
    expect(stephan(2)).toBeLessThan(6.5);
    const low = Math.min(...Array.from({ length: 400 }, (_, i) => stephan(i / 10)));
    expect(low).toBeGreaterThan(4.6);
    expect(low).toBeLessThan(5.3);
    expect(stephan(15)).toBeGreaterThan(5.5);
    expect(stephan(25)).toBeGreaterThan(6.5);
    expect(stephan(40)).toBeGreaterThan(6.9);
    // a day of three meals spends far longer above the line than a day of eight snacks
    const above = (meals: number[]) => Array.from({ length: 1600 }, (_, i) => 7 + i / 100).filter(h => dayPh(h, meals) >= 5.5).length;
    expect(above([8, 13, 19])).toBeGreaterThan(above([8, 10, 11.5, 13, 15, 16.5, 19, 21]));
  });

  it('the ligament is drawn 0.2 mm wide, inside the cited 0.15–0.35 mm', () => {
    expect(PDL_W).toBeGreaterThanOrEqual(0.15);
    expect(PDL_W).toBeLessThanOrEqual(0.35);
    expect(CEM_W).toBeLessThan(PDL_W);
  });
});

describe('Mocne zęby — the tone', () => {
  it('never says a tooth regrows, a cavity closes or that focus heals, in any language', () => {
    const bad = /regener|odbuduje się ząb|ubytek się zamknie|cavity (will )?close|grows? back(?<!not grow back)|zahn wächst|lagar (hål|karies)|odrośnie/i;
    for (const l of LANGS) for (const [k, v] of Object.entries(W[l])) {
      const s = (typeof v === 'string' ? v : v.other).replace(/(Szkliwo nie odrasta|Enamel does not grow back|Schmelz wächst nicht nach|Emaljen växer inte ut igen)/gi, '');
      expect(bad.test(s), `${l} ${k}: ${s}`).toBe(false);
    }
  });

  it('says plainly that enamel does not grow back — and that it remineralises', () => {
    expect(text('pl', 'story.open2.text')).toContain('Szkliwo nie odrasta');
    expect(text('pl', 'teach.wapn')).toContain('Szkliwo nie odrasta');
    expect(text('pl', 'story.open2.text')).toContain('remineralizuje');
    expect(text('en', 'teach.wapn')).toContain('Enamel does not grow back');
  });

  it('says plainly what it is not, with the dentist', () => {
    const dentist: Readonly<Record<Lang, RegExp>> = { pl: /dentyst/, en: /dentist/, de: /Zahnarzt/, sv: /tandläkar/ };
    const not: Readonly<Record<Lang, RegExp>> = { pl: /nie leczenie/, en: /not a treatment/, de: /keine Behandlung/, sv: /inte behandling/ };
    for (const l of LANGS) {
      for (const k of ['panel.not', 'story.open2.text']) {
        expect(text(l, k), `${l} ${k}`).toMatch(dentist[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(not[l]);
      }
    }
  });

  it('the narrator thanks; the closing card is a thanks, not a promise', () => {
    expect(text('pl', 'story.whole.text')).toMatch(/^Dziękuję/);
    expect(text('en', 'story.whole.text')).toMatch(/^Thank You/);
    expect(text('de', 'story.whole.text')).toMatch(/^Danke/);
    expect(text('sv', 'story.whole.text')).toMatch(/^Tack/);
  });

  it('every meditation has an everyday step, and each is a real one (brush, fluoride, between, sugar, check-ups, water)', () => {
    const want: Readonly<Record<string, RegExp>> = { slina: /wod|gum/, posilek: /posiłk/, szkliwo: /fluor/, zebina: /przegląd/, korzen: /międzyzęb|nici/, usmiech: /przed snem/ };
    for (const m of MEDS) expect(text('pl', `med.${m.id}.care`), m.id).toMatch(want[m.id]);
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
    addPath(): void {}
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
          return { addColorStop(o: number) { if (!(o >= 0 && o <= 1)) problems.push(`addColorStop(${o})`); } };
        };
      }
      if (k === 'getTransform') return () => ({ a: 3, b: 0, c: 0, d: 3, e: 0, f: 0 });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        if (a.some(v => typeof v === 'number' && !Number.isFinite(v))) problems.push(`${String(k)}(${a.join(',')})`);
        if ((k === 'ellipse' || k === 'arc') && ((a[2] as number) < 0 || (k === 'ellipse' && (a[3] as number) < 0))) problems.push(`${String(k)} negative radius`);
      };
    },
    set(t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) problems.push(`${String(k)} = ${v}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Mocne zęby — the pictures', () => {
  it('every scene bakes and draws at every growth, rest and push, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const [id, sc] of Object.entries(SCENES)) {
      const w = LIBRARY.worlds[sc.world];
      w.bake(ctx, sc.variant ?? '', '');
      for (const g of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
        for (const [breath, growing, reduced] of [[0.5, true, false], [0.1, false, false], [0.9, false, true]] as const) {
          const st: WorldState = { scene: id, g, deep: 0.6, light: 0.7, growing, time: 7.3 + g * 3, after: g >= 1 ? 2 : 0, breath, blind: false, reduced, px: 3, look: '' };
          w.draw(ctx, st);
        }
        const f = w.focusAt?.(id, g) ?? sc.focus;
        expect(Number.isFinite(f[0]) && Number.isFinite(f[1]), `${id} focus at ${g}`).toBe(true);
        const v = sc.view;
        expect(f[0] >= v.x && f[0] <= v.x + v.w && f[1] >= v.y && f[1] <= v.y + v.h, `${id} focus in view at ${g}`).toBe(true);
        const c = w.counter?.(id, g);
        if (c) expect(c).not.toMatch(/cnt\.|\{/);
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('dives from a shallower picture into a deeper one at a real place', () => {
    const order = MEDS.flatMap(m => m.scenes);
    for (let i = 0; i < order.length; i++) {
      const a = order[i], b = order[(i + 1) % order.length];
      const da = LIBRARY.worlds[SCENES[a].world].depth, db = LIBRARY.worlds[SCENES[b].world].depth;
      const [sh, dp] = da <= db ? [a, b] : [b, a];
      if (da === db) continue;
      const p = LIBRARY.portal?.(sh, dp);
      expect(p, `${sh} → ${dp}`).toBeTruthy();
      const v = SCENES[sh].view;
      expect(p![0] >= v.x && p![0] <= v.x + v.w && p![1] >= v.y && p![1] <= v.y + v.h, `${sh} → ${dp} portal in view`).toBe(true);
    }
  });
});

describe('Mocne zęby — 45–60 minutes (round 24)', () => {
  it('fills 45 and 60 minutes in every mode: scenes grown to the last minutes, the narrator still there, a short clean result', () => {
    for (const planned of [2700, 3600]) {
      for (const mode of ['order', 'one', 'repeat'] as const) {
        let lateGrow = 0, late = 0, lastLine: unknown = null;
        const run = simSession(LIBRARY, {
          planned, returning: true, focus: 'mid', progress: { mode },
          each: (t, s) => {
            if (t > planned - 600 && s.growing) lateGrow += 1 / 60;
            if (s.talk.line && s.talk.line !== lastLine && t > planned - 600) late++;
            lastLine = s.talk.line;
          },
        });
        const tag = `${planned} ${mode}`;
        expect(run.sim.phase, tag).toBe('done');
        for (const v of [run.score, run.grownSec, run.sim.g, run.sim.light, run.sim.afterSec]) expect(Number.isFinite(v), tag).toBe(true);
        // round and round the library: measured ~40 scenes in 45 minutes, ~53 in an hour (just this one: its picture
        // lives on and still grows)
        if (mode !== 'one') expect(run.scenes, tag).toBeGreaterThanOrEqual(planned / 120);
        expect(lateGrow, tag).toBeGreaterThan(60);
        expect(late, tag).toBeGreaterThan(0);
        const r = run.outcome;
        expect(String(r.score).length, tag).toBeLessThanOrEqual(7);
        expect(run.progress.best[String(planned)], tag).toBe(r.score);
        expect(r.highlights.length, tag).toBeLessThanOrEqual(5);
        expect(new Set(r.highlights).size, tag).toBe(r.highlights.length);
        for (const [k, v] of r.stats) expect(`${k} ${v}`, tag).not.toMatch(/undefined|NaN|Infinity/);
        for (const h of r.highlights) expect(h, tag).not.toMatch(/undefined|NaN|\{\w+\}/);
      }
    }
  }, 300_000);
});
