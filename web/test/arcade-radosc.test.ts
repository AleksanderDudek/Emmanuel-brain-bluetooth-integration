/**
 * Pełnia radości (src/arcade/radosc, DESIGN §24) on the health visualisations' engine: the library passes the engine's
 * check; a 40 s test session scores, the first time and after; nothing grows without focus; the numbers the game cites
 * stand as cited in all four languages (and in the counts drawn on the pictures); its own tone rules — effects said as
 * modest as they are, the dopamine myth corrected, no promise of happiness, not therapy with the help lines; and every
 * picture paints at every growth without a NaN or a negative radius.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { LIBRARY, MEDS, SCENES } from '../src/arcade/radosc/library';
import { tc } from '../src/arcade/radosc/i18n';
import { buildTune } from '../src/arcade/radosc/tune';
import { ARCADE } from '../src/arcade/registry';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const text = (l: Lang, k: string): string => {
  const m = W[l][k];
  return typeof m === 'string' ? m : m ? m.other : '';
};
const flat = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ');
const all = (l: Lang): [string, string][] =>
  Object.entries(W[l]).map(([k, m]) => [k, typeof m === 'string' ? m : Object.values(m).join(' ')]);

describe('Pełnia radości — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('has six meditations, sixteen scenes, the last walking the whole with the library’s own pictures', () => {
    expect(MEDS.map(m => m.id)).toEqual(['ziarno', 'wdziecznosc', 'dobroc', 'wiezi', 'spirala', 'pelnia']);
    expect(Object.keys(SCENES)).toHaveLength(16);
    const worlds = new Set(MEDS.slice(0, 5).flatMap(m => m.scenes.map(s => SCENES[s].world)));
    for (const s of MEDS[5].scenes) expect(worlds.has(SCENES[s].world)).toBe(true);
    expect(LIBRARY.root).toBe('psa16.11');
  });

  it('is in the registry as a health visualisation with its unit and tune', () => {
    const g = ARCADE.find(a => a.id === 'radosc');
    expect(g?.kind).toBe('health');
    expect(g?.title).toBe('Pełnia radości');
    expect(g?.unit).toBe('iskier');
    expect(g?.root).toBe('psa16.11');
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(song.parts.every(p => p.notes.every(n => Number.isFinite(n.at) && Number.isFinite(n.deg) && n.at + n.len <= song.beats + 1e-9))).toBe(true);
  });
});

describe('Pełnia radości — progress only from focus', () => {
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

describe('Pełnia radości — the numbers stand as cited', () => {
  /** key → the numbers it must carry; every language carries the same (sources: DESIGN §24, the "radosc" table). */
  const CITED: Readonly<Record<string, readonly string[]>> = {
    'teach.dostrzec': ['20', '4805'], // Chen et al. 2026: 20 RCTs, 4805 people
    'teach.trwac': ['64'], // Heller et al. 2013: N = 64
    'teach.trzy': ['2005'], // Seligman et al. 2005
    'teach.korzenie': ['145', '24 804', '28'], // Choi et al. 2025
    'teach.list': ['2018'], // Kumar & Epley 2018 (three experiments)
    'teach.dar': ['5', '20', '2008', '2020'], // Dunn et al. 2008; Aknin et al. 2020
    'teach.powrot': ['27', '4045'], // Curry et al. 2018
    'teach.bliscy': ['1938', '724'], // the Harvard Study of Adult Development
    'teach.stopnie': ['20', '4739'], // Fowler & Christakis 2008
    'teach.smiech': ['30', '2017'], // Provine & Fischer 1989; Manninen et al. 2017
    'teach.szerzej': ['2005'], // Fredrickson & Branigan 2005
    'teach.buduje': ['5', '138'], // Fredrickson & Joiner 2002
    'teach.cialo': ['701', '2014'], // Nummenmaa et al. 2014
    'teach.plynie': ['2010'], // Fowler & Christakis 2010
    'med.spirala.care': ['2'], // White et al. 2019: ≥ 120 min a week
    'count.korzenie': ['145', '24 804'],
    'count.powrot': ['27', '4045'],
    'count.bliscy': ['1938', '724'],
    'count.stopnie': ['4739', '20'],
    'count.trwac': ['64'],
    'count.cialo': ['701'],
    'count.buduje': ['138', '5'],
    'count.szerzej': ['104'],
    'count.smiech': ['30'],
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
    for (const l of LANGS) {
      for (const [k, s] of all(l)) {
        expect(/\d (osób|osoby|badań|prac|krajów|dolarów|roku|razy|tygodni|godzin|people|studies|trials|papers|countries|weeks|hours|times|Personen|Menschen|Studien|Arbeiten|Ländern|Wochen|Stunden|Dollar|personer|studier|arbeten|länder|veckor|timmar|dollar|gånger)\b/.test(s), `${l} ${k}: ${s}`).toBe(false);
      }
    }
  });

  it('counts the evening’s good things as they open', () => {
    const c = (g: number) => LIBRARY.worlds.ogrod.counter?.('trzy', g) ?? '';
    expect(c(0.1)).toBe('');
    expect(flat(c(1))).toContain('3');
    expect(flat(tc('count.trzy', 1, 'pl'))).toBe('1 dobra rzecz');
    expect(flat(tc('count.trzy', 3, 'pl'))).toBe('3 dobre rzeczy');
  });
});

describe('Pełnia radości — the tone', () => {
  it('says the effects as modest as they are', () => {
    const modest: Record<Lang, RegExp> = { pl: /mały|skromnie|mały/, en: /small|modestly/, de: /klein|bescheiden/, sv: /liten|måttligt/ };
    for (const l of LANGS) {
      expect(text(l, 'teach.korzenie')).toMatch(modest[l]);
      expect(text(l, 'teach.powrot')).toMatch(modest[l]);
      expect(text(l, 'story.open2.text')).toMatch(modest[l]);
      // the replication of the giving study is told with its smaller effect
      expect(text(l, 'teach.dar')).toMatch(/2020/);
    }
  });

  it('corrects the myth that dopamine is pleasure itself', () => {
    const corr: Record<Lang, RegExp> = { pl: /niż samą przyjemność/, en: /more than pleasure itself/, de: /als die Lust selbst/, sv: /än själva njutningen/ };
    for (const l of LANGS) expect(text(l, 'teach.nagroda')).toMatch(corr[l]);
  });

  it('never promises happiness, in any language', () => {
    const banned = /gwarant|zapewni ci szczęści|uszczęśliwi|będziesz szczęśliw|guarantee|will make you happy|you will be happy|garantier|macht dich glücklich|wirst glücklich|garanter|gör dig lycklig|kommer att bli lycklig/i;
    for (const l of LANGS) {
      for (const [k, s] of all(l)) expect(banned.test(s), `${l} ${k}: ${s}`).toBe(false);
    }
  });

  it('says plainly it is not therapy, with a doctor after two weeks and the help lines', () => {
    const notTherapy: Record<Lang, RegExp> = { pl: /nie terapia/, en: /not therapy/, de: /keine Therapie/, sv: /ingen terapi/ };
    const twoWeeks: Record<Lang, RegExp> = { pl: /dwa tygodnie/, en: /two weeks/, de: /zwei Wochen/, sv: /två veckor/ };
    const doctor: Record<Lang, RegExp> = { pl: /lekarz/, en: /doctor/, de: /Ärzt/, sv: /läkare|vården/ };
    const lines: Record<Lang, RegExp> = { pl: /116 123.*112/, en: /emergency number|crisis line/, de: /0800 111 0 111.*112/, sv: /1177.*90101.*112/ };
    for (const l of LANGS) {
      for (const k of ['panel.not', 'story.open2.text']) {
        expect(text(l, k), `${l} ${k}`).toMatch(notTherapy[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(twoWeeks[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(doctor[l]);
      }
      expect(text(l, 'panel.not')).toMatch(lines[l]);
      const reg = ARCADE.find(a => a.id === 'radosc');
      expect(reg?.tips[4]).toMatch(/nie terapia/);
    }
  });

  it('the narrator thanks; the closing card is a thanks, not a promise', () => {
    expect(text('pl', 'story.whole.text')).toMatch(/^Dziękuję/);
    expect(text('en', 'story.whole.text')).toMatch(/^Thank/);
    expect(text('de', 'story.whole.text')).toMatch(/^Danke/);
    expect(text('sv', 'story.whole.text')).toMatch(/^Tack/);
  });

  it('names people without a gender in Polish (kto daje, kto czyta)', () => {
    for (const k of ['part.daje', 'part.przyjmuje', 'part.pisze', 'part.czyta']) expect(text('pl', k)).toMatch(/^kto /);
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
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Pełnia radości — the pictures', () => {
  it('every scene bakes and draws at every growth, rest and push, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const [id, sc] of Object.entries(SCENES)) {
      const w = LIBRARY.worlds[sc.world];
      w.bake(ctx, sc.variant ?? '', '');
      for (const g of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1, 1.4]) {
        for (const [breath, growing, reduced] of [[0.5, true, false], [0.1, false, false], [0.9, false, true]] as const) {
          const st: WorldState = { scene: id, g, deep: 0.6, light: 0.7, growing, time: 7.3 + g * 3, after: g >= 1 ? 2 : 0, breath, blind: false, reduced, px: 3, look: '' };
          w.draw(ctx, st);
        }
        const f = w.focusAt?.(id, g) ?? sc.focus;
        expect(Number.isFinite(f[0]) && Number.isFinite(f[1]), `${id} focus at ${g}`).toBe(true);
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('dives into the head at the brow and into the heart for the garden', () => {
    const into = (a: string, b: string) => LIBRARY.portal?.(a, b) ?? null;
    for (const [a, b] of [['dostrzec', 'nagroda'], ['cialo', 'ogrod'], ['list', 'korzenie'], ['plynie', 'ogrod'], ['szerzej', 'trwac']] as const) {
      expect(LIBRARY.worlds[SCENES[a].world].depth).toBeLessThan(LIBRARY.worlds[SCENES[b].world].depth);
      const p = into(a, b);
      expect(p, `${a} → ${b}`).toBeTruthy();
      const v = SCENES[a].view;
      expect(p![0] >= v.x && p![0] <= v.x + v.w && p![1] >= v.y && p![1] <= v.y + v.h, `${a} → ${b} portal in view`).toBe(true);
    }
  });
});

describe('Pełnia radości — 45–60 minutes (round 24)', () => {
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
