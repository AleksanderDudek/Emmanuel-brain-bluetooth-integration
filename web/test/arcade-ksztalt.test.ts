/**
 * Lekkość i siła (src/arcade/ksztalt, DESIGN §24) on the health visualisations' engine: the library passes the
 * engine's check; a 40 s test session scores, the first time and after; nothing grows without focus; the numbers the
 * game cites stand as cited in all four languages (and the pictures agree); its own care for anyone for whom food,
 * weight or the body's look is hard (no numbers about the player, no diet but as "not a diet", the help lines, no
 * fat-burning promise, no comparison); and every picture paints in both silhouettes at every growth without a NaN.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { LIBRARY } from '../src/arcade/ksztalt/library';
import { CURVE } from '../src/arcade/ksztalt/world-fibre';
import { frontOutline, profileOutline } from '../src/arcade/ksztalt/geo';
import { buildTune } from '../src/arcade/ksztalt/tune';
import { ARCADE } from '../src/arcade/registry';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const MEDS = LIBRARY.meds;
const SCENES = LIBRARY.scenes;
const text = (l: Lang, k: string): string => {
  const m = W[l][k];
  return typeof m === 'string' ? m : m ? Object.values(m).join(' ') : '';
};
const flat = (s: string): string => s.replace(/[  ]/g, ' ');
const all = (l: Lang): [string, string][] => Object.keys(W[l]).map(k => [k, flat(text(l, k))]);

describe('Lekkość i siła — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('has six meditations, 18 scenes, the last walking the whole with the library’s own pictures', () => {
    expect(MEDS.map(m => m.id)).toEqual(['wydech', 'komorka', 'miesien', 'postawa', 'talia', 'cale']);
    expect(Object.keys(SCENES)).toHaveLength(18);
    const worlds = new Set(MEDS.slice(0, 5).flatMap(m => m.scenes.map(s => SCENES[s].world)));
    for (const s of MEDS[5].scenes) expect(worlds.has(SCENES[s].world)).toBe(true);
    expect(LIBRARY.root).toBe('1co6.19-20');
    expect(LIBRARY.looks).toEqual(['ona', 'on']);
  });

  it('is in the registry as a health visualisation, right after Sprężysty kręgosłup, with its unit and tune', () => {
    const i = ARCADE.findIndex(a => a.id === 'ksztalt');
    expect(ARCADE[i]?.kind).toBe('health');
    expect(ARCADE[i]?.unit).toBe('wydechów');
    expect(ARCADE[i - 1]?.id).toBe('kregoslup');
    expect(ARCADE[i]?.root).toBe('1co6.19-20');
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(song.parts.every(p => p.notes.every(n => Number.isFinite(n.at) && Number.isFinite(n.deg)))).toBe(true);
    // the bell line fills its 64 beats exactly
    const bell = song.parts.find(p => p.voice === 'lead')!.notes;
    expect(bell.reduce((n, x) => n + x.len, 0)).toBe(64);
  });
});

describe('Lekkość i siła — progress only from focus', () => {
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

describe('Lekkość i siła — the numbers stand as cited', () => {
  /** key → the numbers it must carry; every language carries the same (a percent with or without a space). */
  const CITED: Readonly<Record<string, readonly string[]>> = {
    'teach.albumina': ['7'],
    'teach.oddech': ['480', '84%'],
    'teach.odnowa': ['10%'],
    'teach.sen': ['18%', '28%'],
    'teach.bodziec': ['112%', '3', '65%', '34%'],
    'teach.budowa': ['18%'],
    'teach.wyprost': ['8'],
    'teach.wszedzie': ['6'],
    'teach.trzewny': ['6%'],
    'teach.lekkosc': ['400', '40%'],
    'teach.postac': ['150–300', '2', '7–9'],
    'med.wydech.care': ['150–300'],
    'med.komorka.care': ['7–9'],
    'med.miesien.care': ['2'],
    'count.oddech': ['84%'],
    'count.odnowa': ['10%'],
  };
  for (const [key, nums] of Object.entries(CITED)) {
    it(`${key}: ${nums.join(', ')}`, () => {
      for (const l of LANGS) {
        const t = flat(text(l, key)).replace(/(\d) %/g, '$1%');
        for (const n of nums) expect(t.includes(n), `${l} ${key} lacks “${n}”: ${t}`).toBe(true);
      }
    });
  }

  it('the curve under the fibre is the study’s (Phillips et al. 1997) and the counts follow it', () => {
    expect(CURVE).toEqual([[0, 0], [3, 112], [24, 65], [48, 34]]);
    const c = (g: number) => flat(LIBRARY.worlds.fibre.counter?.('bodziec', g) ?? '').replace(/(\d) %/g, '$1%');
    expect(c(0.3)).toContain('+112%');
    expect(c(0.7)).toContain('+65%');
    expect(c(1)).toContain('+34%');
    expect(flat(LIBRARY.worlds.body.counter?.('oddech', 1) ?? '').replace(/(\d) %/g, '$1%')).toContain('84%');
  });
});

describe('Lekkość i siła — care for anyone for whom food, weight or the body is hard', () => {
  /** words that turn a meditation into a diet, a target or a comparison, per language */
  const BANNED: Record<Lang, RegExp> = {
    pl: /\b(kg|kilo\w*|kcal|kalori\w*|BMI|idealn\w*|spalani\w* tłuszcz\w*|spal\w* tłuszcz|odchudz\w*|przed i po|chud\w*)\b/i,
    en: /\b(kg|kilo\w*|kcal|calori\w*|BMI|ideal\w*|fat[- ]burn\w*|burn\w* fat|slim\w*|weight loss|lose weight|before and after|thin)\b/i,
    de: /\b(kg|Kilo\w*|kcal|Kalorie\w*|BMI|ideal\w*|Fettverbrennung|Fett verbrenn\w*|abnehm\w*|schlank\w*|vorher und nachher|dünn)\b/i,
    sv: /\b(kg|kilo\w*|kcal|kalori\w*|BMI|ideal\w*|fettförbränning|bränn\w* fett|banta\w*|smal\w*|före och efter)\b/i,
  };
  it('no weight, calorie or BMI number, no ideal, no fat-burning promise, no before/after — in any language', () => {
    for (const l of LANGS) for (const [k, s] of all(l)) expect(BANNED[l].test(s), `${l} ${k}: ${s}`).toBe(false);
  });

  it('a diet is named only to say this is not one', () => {
    const diet: Record<Lang, [RegExp, RegExp]> = {
      pl: [/diet\w*/gi, /nie diet\w*/gi], en: [/\bdiet\b/gi, /not a diet/gi], de: [/Diät/g, /keine Diät/g], sv: [/\bdiet\b/gi, /ingen diet/gi],
    };
    for (const l of LANGS) {
      for (const [k, s] of all(l)) {
        const [any, neg] = diet[l];
        expect((s.match(any) ?? []).length, `${l} ${k}: ${s}`).toBe((s.match(neg) ?? []).length);
      }
    }
  });

  it('says plainly what it is not, with a doctor and the help lines, on the opening card and in the lobby', () => {
    const doctor: Record<Lang, RegExp> = { pl: /lekarz/, en: /doctor/i, de: /Ärzt/, sv: /läkare/ };
    const notTreat: Record<Lang, RegExp> = { pl: /nie leczenie i nie dieta/, en: /not a treatment and not a diet/, de: /keine Behandlung und keine Diät/, sv: /inte behandling och ingen diet/ };
    const line: Record<Lang, RegExp> = { pl: /116 123/, en: /eating-disorder helpline/, de: /0221 892031/, sv: /1177/ };
    for (const l of LANGS) {
      for (const k of ['panel.not', 'story.open2.text']) {
        const s = flat(text(l, k));
        expect(s, `${l} ${k}`).toMatch(notTreat[l]);
        expect(s, `${l} ${k}`).toMatch(doctor[l]);
        expect(s, `${l} ${k}`).toMatch(line[l]);
      }
    }
  });

  it('tells the truth about the breath: most of the fat leaves as CO₂, and breathing faster does not hurry it', () => {
    const faster: Record<Lang, RegExp> = { pl: /Szybszy oddech tego nie przyspiesza/, en: /Breathing faster does not speed it up/, de: /Schnelleres Atmen beschleunigt das nicht/, sv: /Att andas snabbare skyndar inte på det/ };
    for (const l of LANGS) expect(flat(text(l, 'teach.oddech'))).toMatch(faster[l]);
  });

  it('never promises that exercise shapes the breast: the muscle beneath, not the breast’s own tissue', () => {
    const not: Record<Lang, RegExp> = { pl: /nie zmienia tkanki samej piersi/, en: /does not change the breast’s own tissue/, de: /verändert es nicht/, sv: /ändrar inte bröstets egen vävnad/ };
    for (const l of LANGS) expect(flat(text(l, 'teach.piersiowy'))).toMatch(not[l]);
  });

  it('the narrator thanks; the closing card is a thanks, not a promise', () => {
    expect(text('pl', 'story.whole.text')).toMatch(/^Dziękuję/);
    expect(text('en', 'story.whole.text')).toMatch(/^Thank/);
    expect(text('de', 'story.whole.text')).toMatch(/^Danke/);
    expect(text('sv', 'story.whole.text')).toMatch(/^Tack/);
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
          return { addColorStop(o: number, c: string) { if (!(o >= 0 && o <= 1)) problems.push(`addColorStop(${o})`); if (/NaN/.test(c)) problems.push(`colour ${c}`); } };
        };
      }
      if (k === 'getTransform') return () => ({ a: 3, d: 3 });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k in t) return t[k];
      return (...a: unknown[]) => {
        if (a.some(v => typeof v === 'number' && !Number.isFinite(v))) problems.push(`${String(k)}(${a.join(',')})`);
        if ((k === 'ellipse' || k === 'arc') && ((a[2] as number) < 0 || (k === 'ellipse' && (a[3] as number) < 0))) problems.push(`${String(k)} negative radius`);
      };
    },
    set(t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) problems.push(`${String(k)} = ${v}`);
      if (typeof v === 'string' && /NaN/.test(v)) problems.push(`${String(k)} = ${v}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Lekkość i siła — the pictures', () => {
  it('every scene bakes and draws in both silhouettes at every growth, rest and push, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const look of LIBRARY.looks) {
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

  it('the two silhouettes differ where the body differs, and the figure stays featureless and modest', () => {
    const half = (look: 'ona' | 'on', y0: number, y1: number) => Math.max(...frontOutline(look).filter(([, y]) => y > y0 && y < y1).map(([x]) => Math.abs(x)));
    // a man's shoulders broader, a woman's waist narrower and hips fuller (relative to the shoulders)
    expect(half('on', 0.19, 0.21)).toBeGreaterThan(half('ona', 0.19, 0.21));
    expect(half('ona', 0.36, 0.4) / half('ona', 0.44, 0.5)).toBeLessThan(half('on', 0.36, 0.4) / half('on', 0.44, 0.5));
    // in profile the bust and the chest stay within a modest line (no more than a little beyond the chest wall)
    for (const look of ['ona', 'on'] as const) {
      const front = Math.min(...profileOutline(look, 1).filter(([, y]) => y > 0.2 && y < 0.32).map(([x]) => x));
      expect(front).toBeGreaterThan(-0.075);
    }
  });

  it('dives from a shallower picture into a deeper one at a place on the screen', () => {
    const ids = Object.keys(SCENES);
    for (const a of ids) {
      for (const b of ids) {
        if (LIBRARY.worlds[SCENES[a].world].depth >= LIBRARY.worlds[SCENES[b].world].depth) continue;
        const p = LIBRARY.portal?.(a, b);
        expect(p, `${a} → ${b}`).toBeTruthy();
        const v = SCENES[a].view;
        expect(p![0] >= v.x && p![0] <= v.x + v.w && p![1] >= v.y && p![1] <= v.y + v.h, `${a} → ${b} portal in view`).toBe(true);
      }
    }
  });
});

describe('Lekkość i siła — 45–60 minutes (round 24)', () => {
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
