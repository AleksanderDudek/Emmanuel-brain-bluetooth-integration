/**
 * Sprężysty kręgosłup (src/arcade/kregoslup, DESIGN §24.5) on the health visualisations' engine: the library passes
 * the engine's check; a 40 s test session scores, the first time and after; nothing grows without focus; the numbers
 * the game cites stand as cited in all four languages (and agree with the pictures' geometry); its own tone rules;
 * and every picture paints at every growth without a NaN or a negative radius.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { LIBRARY, MEDS, SCENES } from '../src/arcade/kregoslup/library';
import { DISCS, SEGS, VERTS } from '../src/arcade/kregoslup/geo';
import { EVENING_THIN, NIGHT_GAIN } from '../src/arcade/kregoslup/world-spine';
import { buildTune } from '../src/arcade/kregoslup/tune';
import { ARCADE } from '../src/arcade/registry';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const text = (l: Lang, k: string): string => {
  const m = W[l][k];
  return typeof m === 'string' ? m : m ? m.other : '';
};
/** A number written the language's way (0,24 in pl, de and sv; 0.24 in en), with any space before a unit. */
const num = (l: Lang, s: string): string => (l === 'en' ? s : s.replace('.', ','));
const flat = (s: string): string => s.replace(/[  ]/g, ' ');

describe('Sprężysty kręgosłup — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('has six meditations of three scenes, the last walking the whole', () => {
    expect(MEDS.map(m => m.id)).toEqual(['os', 'dysk', 'nocna', 'ruch', 'miesnie', 'prosto']);
    expect(MEDS.every(m => m.scenes.length === 3)).toBe(true);
    expect(Object.keys(SCENES)).toHaveLength(18);
    // the last meditation reuses the library's own pictures
    const worlds = new Set(MEDS.slice(0, 5).flatMap(m => m.scenes.map(s => SCENES[s].world)));
    for (const s of MEDS[5].scenes) expect(worlds.has(SCENES[s].world)).toBe(true);
    expect(LIBRARY.root).toBe('psa145.14');
  });

  it('is in the registry as a health visualisation with its unit and tune', () => {
    const g = ARCADE.find(a => a.id === 'kregoslup');
    expect(g?.kind).toBe('health');
    expect(g?.unit).toBe('łyków');
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(song.parts.every(p => p.notes.every(n => Number.isFinite(n.at) && Number.isFinite(n.deg)))).toBe(true);
  });
});

describe('Sprężysty kręgosłup — progress only from focus', () => {
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

describe('Sprężysty kręgosłup — the numbers stand as cited', () => {
  /** key → the numbers it must carry (written with "." for a decimal); every language carries the same. */
  const CITED: Readonly<Record<string, readonly string[]>> = {
    'teach.kregi': ['33', '7', '12', '5', '4'],
    'teach.dyski': ['23', 'C2–C3', 'L5–S1'],
    'teach.jadro': ['80'],
    'teach.pierscien': ['15–25', '60°'],
    'teach.plytki': ['1 mm'],
    'teach.dzien': ['L4–L5', '0.5 MPa', '1 %'],
    'teach.noc': ['0.1 MPa', '0.24 MPa'],
    'teach.poranek': ['19 mm', '1 %'],
    'teach.dyfuzja': ['8 mm'],
    'teach.macierz': ['5000', '12'],
    'teach.oddech': ['1–1.5 cm'],
    'say.at.pierscien.1': ['7–10 mm', '4 cm'],
    'med.os.care': ['150–300'],
    'med.nocna.care': ['7–9'],
    'med.ruch.care': ['30–60'],
  };
  for (const [key, nums] of Object.entries(CITED)) {
    it(`${key}: ${nums.join(', ')}`, () => {
      for (const l of LANGS) {
        const t = flat(text(l, key));
        for (const n of nums) {
          // German and Swedish write "1 %" and Polish "1 %"; English "1%" — a percent may stand with or without a space
          const want = num(l, n);
          const ok = t.includes(want) || (want.endsWith(' %') && t.includes(want.replace(' %', '%')));
          expect(ok, `${l} ${key} lacks “${want}”: ${t}`).toBe(true);
        }
      }
    });
  }

  it('the pictures agree: 33 vertebrae, 23 discs (C2–C3 … L5–S1), discs ≈ ¼–⅓ of the spine above the sacrum', () => {
    expect(VERTS).toHaveLength(33);
    expect(DISCS).toHaveLength(23);
    expect(DISCS[0].id).toBe('C2–C3');
    expect(DISCS[22].id).toBe('L5–S1');
    expect(VERTS.filter(v => v.region === 'C')).toHaveLength(7);
    expect(VERTS.filter(v => v.region === 'T')).toHaveLength(12);
    expect(VERTS.filter(v => v.region === 'L')).toHaveLength(5);
    expect(VERTS.filter(v => v.region === 'S')).toHaveLength(5);
    expect(VERTS.filter(v => v.region === 'Co')).toHaveLength(4);
    const discs = DISCS.reduce((n, d) => n + d.s1 - d.s0, 0);
    const presacral = SEGS.filter(g => (g.region !== 'S' && g.region !== 'Co') && g.id !== 'L5–S1').reduce((n, g) => n + g.s1 - g.s0, 0);
    expect(discs / presacral).toBeGreaterThan(0.24);
    expect(discs / presacral).toBeLessThan(0.34);
    // the morning's 19.3 mm (Tyrrell et al. 1985) in units of 4 mm, shared by the discs
    expect(NIGHT_GAIN * 4).toBeCloseTo(19.3, 5);
    expect(EVENING_THIN).toBeGreaterThan(0.05);
    expect(EVENING_THIN).toBeLessThan(0.2);
  });

  it('the counts drawn on the pictures end at the true numbers', () => {
    const c = (scene: string, g: number) => LIBRARY.worlds[SCENES[scene].world].counter?.(scene, g) ?? '';
    expect(flat(c('kregi', 1))).toContain('33');
    expect(flat(c('dyski', 1))).toContain('23');
    expect(flat(c('poranek', 1))).toContain('19');
    expect(flat(c('jadro', 1))).toContain('80');
    expect(flat(c('noc', 1))).toMatch(/0[.,]24/);
    expect(flat(c('noc', 0))).toMatch(/0[.,]1/);
    expect(flat(c('dzien', 0.5))).toMatch(/0[.,]5/);
    const layers = Number(flat(c('pierscien', 1)).match(/\d+/)?.[0]);
    expect(layers).toBeGreaterThanOrEqual(15);
    expect(layers).toBeLessThanOrEqual(25);
  });
});

describe('Sprężysty kręgosłup — the tone', () => {
  it('never says a disc regenerates or regrows, in any language', () => {
    const banned = /regener|odbud|rebuil|wieder ?aufgebaut|återupp?bygg|nowy dysk|new disc/i;
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(W[l])) {
        const s = typeof m === 'string' ? m : Object.values(m).join(' ');
        expect(banned.test(s), `${l} ${k}: ${s}`).toBe(false);
      }
    }
  });

  it('says plainly what it is not, with the right doctor', () => {
    const doctor: Record<Lang, RegExp> = { pl: /lekarz/, en: /doctor/i, de: /Ärzt/, sv: /läkare/ };
    const notTreat: Record<Lang, RegExp> = { pl: /nie leczenie/, en: /not a treatment/, de: /keine Behandlung/, sv: /inte behandling/ };
    for (const l of LANGS) {
      for (const k of ['panel.not', 'story.open2.text']) {
        expect(text(l, k), `${l} ${k}`).toMatch(notTreat[l]);
        expect(text(l, k), `${l} ${k}`).toMatch(doctor[l]);
      }
    }
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
          return { addColorStop(o: number) { if (!(o >= 0 && o <= 1)) problems.push(`addColorStop(${o})`); } };
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
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Sprężysty kręgosłup — the pictures', () => {
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
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });

  it('dives from a shallower picture into a deeper one at a real place', () => {
    for (const [a, b] of [['kregi', 'plytki'], ['plytki', 'jadro'], ['dyfuzja', 'macierz'], ['napojone', 'gorset'], ['oddech', 'napojone']] as const) {
      const p = LIBRARY.portal?.(a, b);
      if (LIBRARY.worlds[SCENES[a].world].depth < LIBRARY.worlds[SCENES[b].world].depth) {
        expect(p, `${a} → ${b}`).toBeTruthy();
        const v = SCENES[a].view;
        expect(p![0] >= v.x && p![0] <= v.x + v.w && p![1] >= v.y && p![1] <= v.y + v.h, `${a} → ${b} portal in view`).toBe(true);
      }
    }
  });
});

describe('Sprężysty kręgosłup — 45–60 minutes (round 24)', () => {
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
