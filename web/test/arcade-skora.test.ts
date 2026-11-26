/**
 * Żywa skóra (src/arcade/skora, DESIGN §24.3) on the health visualisations' engine: the library passes the engine's
 * check; a 40 s test session scores, the first time and after; nothing grows without focus; the numbers the game
 * cites stand as cited in all four languages (and the counts on the pictures end at them); its own tone rules (no
 * wrinkles promised away, no "younger", the "28 days" only as the myth corrected); the five skin tones; and every
 * picture paints at every growth and in every tone without a NaN or a negative radius.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { LIBRARY, MEDS, SCENES } from '../src/arcade/skora/library';
import { LOOKS, TONES } from '../src/arcade/skora/tone';
import { buildTune } from '../src/arcade/skora/tune';
import { ARCADE } from '../src/arcade/registry';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const text = (l: Lang, k: string): string => {
  const m = W[l][k];
  return typeof m === 'string' ? m : m ? m.other : '';
};
/** no-break spaces as spaces, and thousands written together (1 200, 1,200 → 1200) */
const flat = (s: string): string => s.replace(/[  ]/g, ' ').replace(/(\d)[ ,](\d{3})\b/g, '$1$2');
/** a decimal written the language's way (4,7 in pl, de and sv; 4.7 in en) */
const num = (l: Lang, s: string): string => (l === 'en' ? s : s.replace(/(\d)\.(\d)/g, '$1,$2'));

describe('Żywa skóra — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('has six meditations, eighteen scenes, every one a verse', () => {
    expect(MEDS.map(m => m.id)).toEqual(['odnowa', 'bariera', 'kolagen', 'gojenie', 'melanina', 'krazenie']);
    expect(MEDS.map(m => m.scenes.length)).toEqual([3, 3, 3, 4, 3, 2]);
    expect(Object.keys(SCENES)).toHaveLength(18);
    expect(MEDS.map(m => m.verse)).toEqual(['lam3.22-23', 'psa91.4', 'psa139.13-14', 'psa147.3', 'psa121.6', 'psa36.9']);
    // the library ends with the whole hand in light (the lobby's picture before a first session)
    expect(SCENES[MEDS[5].scenes[1]].world).toBe('hand');
    expect(LIBRARY.root).toBe('job10.11');
  });

  it('is in the registry as a health visualisation, its unit "nowych komórek", with its tune', () => {
    const g = ARCADE.find(a => a.id === 'skora');
    expect(g?.kind).toBe('health');
    expect(g?.unit).toBe('nowych komórek');
    expect(g?.root).toBe('job10.11');
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(song.parts.every(p => p.notes.every(n => Number.isFinite(n.at) && Number.isFinite(n.deg) && n.at >= 0 && n.at < song.beats))).toBe(true);
  });

  it('offers five skin tones with neutral names, light to dark, each with more melanin than the last', () => {
    expect(LIBRARY.looks).toEqual(['light', 'medium', 'olive', 'brown', 'dark']);
    const mel = LOOKS.map(l => TONES[l].mel);
    for (let i = 1; i < mel.length; i++) expect(mel[i]).toBeGreaterThan(mel[i - 1]);
    for (const l of LANGS) for (const look of LOOKS) expect(text(l, `look.${look}`).length).toBeGreaterThan(2);
  });
});

describe('Żywa skóra — progress only from focus', () => {
  it('scores in a 40 s test session, the first time and after', () => {
    expect(simSession(LIBRARY).score).toBeGreaterThan(0);
    expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);
  });

  it('grows nothing without focus', () => {
    for (const focus of ['none', 'unfocused'] as const) {
      const r = simSession(LIBRARY, { returning: true, focus, planned: 120 });
      expect(r.grownSec).toBe(0);
      expect(r.score).toBe(0);
    }
  });
});

describe('Żywa skóra — the numbers stand as cited', () => {
  /** key → the numbers it must carry (written with "." for a decimal); every language carries the same. */
  const CITED: Readonly<Record<string, readonly string[]>> = {
    'teach.podzial': ['1200'],
    'teach.wedrowka': ['39', '28'],
    'teach.luszczenie': ['2–3'],
    'teach.cegly': ['10–20', '10–20 µm'],
    'teach.zaprawa': ['50 %', '25 %', '15 %'],
    'teach.plaszcz': ['4.7'],
    'teach.elastyna': ['2–4 %'],
    'teach.lata': ['15', '1 %'],
    'teach.sploty': ['1–1.5 mm'],
    'teach.cieplo': ['250 ml', '6–8'],
    'teach.przebudowa': ['3', '20 %', '80 %'],
    'teach.melanocyty': ['36'],
    'med.kolagen.care': ['30'],
  };
  for (const [key, nums] of Object.entries(CITED)) {
    it(`${key}: ${nums.join(', ')}`, () => {
      for (const l of LANGS) {
        // a number keeps its unit with a no-break space; the cited forms are written with a plain one
        const t = flat(text(l, key)).replace(/\u00a0/g, ' ');
        for (const n of nums) {
          const want = num(l, n);
          expect(t.includes(want), `${l} ${key} lacks “${want}”: ${t}`).toBe(true);
        }
      }
    });
  }

  it('says collagen is about three-quarters of the skin’s dry weight, mostly type I', () => {
    const frac: Record<Lang, RegExp> = { pl: /¾/, en: /three-quarters/, de: /drei Viertel/, sv: /tre fjärdedelar/ };
    for (const l of LANGS) {
      expect(text(l, 'teach.fibroblast')).toMatch(frac[l]);
      expect(text(l, 'teach.fibroblast')).toMatch(/\bI\b/);
    }
  });

  it('the counts drawn on the pictures end at the true numbers', () => {
    const c = (scene: string, g: number) => flat(LIBRARY.worlds[SCENES[scene].world].counter?.(scene, g) ?? '');
    expect(c('wedrowka', 1)).toContain('39');
    expect(c('melanocyty', 1)).toContain('36');
    expect(c('podzial', 1)).toContain('1200');
    expect(c('cegly', 1)).toMatch(/\b10\b/);
    expect(c('plaszcz', 1)).toMatch(/4[.,]7/);
    expect(c('lata', 1)).toContain('15');
    expect(c('przebudowa', 0)).toContain('20');
    expect(c('przebudowa', 1)).toContain('80');
    expect(c('naprawa', 1)).toContain('4/4');
    // nothing is counted before a scene has begun to grow
    for (const s of ['wedrowka', 'melanocyty', 'podzial', 'cegly', 'plaszcz', 'lata', 'naprawa']) {
      const n = Number(c(s, 0).match(/\d+/)?.[0] ?? 0);
      expect(n, s).toBe(0);
    }
  });
});

describe('Żywa skóra — the tone', () => {
  it('promises no younger look: no wrinkles taken away, no "younger", nothing turned back', () => {
    const banned = /zmarszcz|wrinkl|Falte|rynk|młodsz|odmł|younger|jünger|yngre|anti-?ag|verjüng|föryng/i;
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(W[l])) {
        const s = typeof m === 'string' ? m : Object.values(m).join(' ');
        expect(banned.test(s), `${l} ${k}: ${s}`).toBe(false);
      }
    }
  });

  it('names "28 days" only as the myth corrected', () => {
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(W[l])) {
        const s = typeof m === 'string' ? m : Object.values(m).join(' ');
        if (/\b28\b/.test(s)) {
          expect(k, `${l} ${k}`).toBe('teach.wedrowka');
          expect(s).toMatch(/\b39\b/);
        }
      }
    }
  });

  it('says plainly what it is not, with the right doctor, and points to a changing mole and a wound that will not heal', () => {
    const doctor: Record<Lang, RegExp> = { pl: /lekarz/, en: /doctor/i, de: /Ärzt/, sv: /läkare/ };
    const notTreat: Record<Lang, RegExp> = { pl: /nie leczenie/, en: /not a treatment/, de: /keine Behandlung/, sv: /ingen behandling/ };
    const mole: Record<Lang, RegExp> = { pl: /Znamię/, en: /mole/, de: /Muttermal/, sv: /födelsemärke/ };
    for (const l of LANGS) {
      for (const k of ['panel.not', 'story.open2.text']) {
        expect(text(l, k), `${l} ${k}`).toMatch(notTreat[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(doctor[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(mole[l]);
      }
      expect(text(l, 'med.melanina.care')).toMatch(doctor[l]);
      expect(text(l, 'med.gojenie.care')).toMatch(doctor[l]);
    }
  });

  it('the narrator thanks; the closing card is a thanks, not a promise', () => {
    expect(text('pl', 'story.whole.text')).toMatch(/^Dziękuję/);
    expect(text('en', 'story.whole.text')).toMatch(/^Thank/);
    expect(text('de', 'story.whole.text')).toMatch(/^Danke/);
    expect(text('sv', 'story.whole.text')).toMatch(/^Tack/);
  });

  it('every skin tone is named in every language without a word of value (better, normal, beautiful…)', () => {
    const value = /lepsz|ładn|normal|better|pretty|beautiful|schön|besser|vacker|bättre/i;
    for (const l of LANGS) for (const look of LOOKS) expect(value.test(text(l, `look.${look}`))).toBe(false);
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
          return { addColorStop(o: number) { if (!(o >= 0 && o <= 1)) problems.push(`addColorStop(${o})`); } };
        };
      }
      if (k === 'getTransform') return () => ({ a: 3, d: 3, e: 500, f: 300 });
      if (k === 'canvas') return { width: 1000, height: 600 };
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

describe('Żywa skóra — the pictures', () => {
  it('every scene bakes and draws at every growth, in every tone, rest and push, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const look of ['', ...LOOKS]) {
      for (const [id, sc] of Object.entries(SCENES)) {
        const w = LIBRARY.worlds[sc.world];
        w.bake(ctx, sc.variant ?? '', look);
        for (const g of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
          for (const [breath, growing, reduced] of [[0.5, true, false], [0.1, false, false], [0.9, false, true]] as const) {
            const st: WorldState = { scene: id, g, deep: 0.6, light: 0.7, growing, time: 7.3 + g * 3, after: g >= 1 ? 2 : 0, breath, blind: false, reduced, px: 3, look };
            w.draw(ctx, st);
          }
          const f = w.focusAt?.(id, g) ?? sc.focus;
          expect(Number.isFinite(f[0]) && Number.isFinite(f[1]), `${id} focus at ${g}`).toBe(true);
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('dives from a shallower picture into a deeper one at a real place in view', () => {
    const order = MEDS.flatMap(m => m.scenes);
    const pairs: [string, string][] = order.map((s, i) => [s, order[(i + 1) % order.length]]);
    for (const [x, y] of pairs) {
      const da = LIBRARY.worlds[SCENES[x].world].depth, db = LIBRARY.worlds[SCENES[y].world].depth;
      if (da === db) continue;
      const [a, b] = da < db ? [x, y] : [y, x];
      const p = LIBRARY.portal?.(a, b);
      expect(p, `${a} → ${b}`).toBeTruthy();
      const v = SCENES[a].view;
      expect(p![0] >= v.x && p![0] <= v.x + v.w && p![1] >= v.y && p![1] <= v.y + v.h, `${a} → ${b} portal in view`).toBe(true);
    }
  });
});
