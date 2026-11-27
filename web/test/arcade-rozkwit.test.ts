/**
 * Rozkwit (src/arcade/rozkwit, DESIGN §24) on the health visualisations' engine — the capstone that walks the whole
 * person in the other games' own pictures: the library passes the engine's check; a 40 s test session scores, the
 * first time and after; nothing grows without focus; what is borrowed is the sources' own (scenes, worlds, the names
 * of the parts, the everyday steps, the figure's words) and each borrowed world is told its own scene id and look;
 * the numbers stand as cited in all four languages and agree with the source games; the tone rules of its own; and
 * every picture paints at every growth in both silhouettes without a NaN.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldPainter, WorldState } from '../src/arcade/kit/healthlib/spec';
import { BORROWS, CARE, HAIR, KSZTALT, LOOK_FOR, LOOK_KEYS } from '../src/arcade/rozkwit/sources';
import { borrowedWorld } from '../src/arcade/rozkwit/borrow';
import { LIBRARY, MEDS, SCENES, portal } from '../src/arcade/rozkwit/library';
import { OWN } from '../src/arcade/rozkwit/i18n';
import { BLOOM_VIEW, BODY_VIEW, PEOPLE, shine } from '../src/arcade/rozkwit/world-whole';
import { buildTune } from '../src/arcade/rozkwit/tune';
import { CATALOGS as HAIR_WORDS } from '../src/arcade/wlosy/i18n';
import { SCENE as HAIR_SCENE } from '../src/arcade/wlosy/content';
import { ARCADE } from '../src/arcade/registry';
import type { Lang, Msg } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const W = LIBRARY.words;
const flatMsg = (m: Msg | undefined): string => (typeof m === 'string' ? m : m ? m.other : '');
const text = (l: Lang, k: string): string => flatMsg((W[l] as Record<string, Msg | undefined>)[k]);
const NBSP = ' ';

describe('Rozkwit — the library', () => {
  it('passes the engine check (shape, verses, words in four languages, lengths, tone)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('walks the whole person: six meditations, the last one its own picture where everything shines at once', () => {
    expect(MEDS.map(m => m.id)).toEqual(['komorki', 'postawa', 'sylwetka', 'skora', 'radosc', 'cale']);
    expect(MEDS.flatMap(m => m.scenes)).toHaveLength(18);
    expect(MEDS[5].scenes.map(s => SCENES[s].world)).toEqual(['whole', 'whole']);
    expect(LIBRARY.root).toBe('psa139.13-14');
    expect(LIBRARY.looks).toEqual(['ona', 'on']);
    // every other scene is borrowed: from the engine's games or from Każdy włos (through the adapter)
    for (const s of MEDS.slice(0, 5).flatMap(m => m.scenes)) expect(BORROWS[s] || HAIR[s], s).toBeTruthy();
    // it reaches every game of the founder's whole-person wish: cells, the watch, spine, figure, skin, hair, joy
    const sources = new Set([...Object.values(BORROWS).map(b => b.lib.id), ...(Object.keys(HAIR).length ? ['wlosy'] : [])]);
    expect([...sources].sort()).toEqual(['komorki', 'kregoslup', 'ksztalt', 'radosc', 'skora', 'straz', 'wlosy']);
  });

  it('scores in a 40 s test session, the first time and after; nothing grows without focus', () => {
    expect(simSession(LIBRARY).score).toBeGreaterThan(0);
    expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);
    const none = simSession(LIBRARY, { focus: 'none' });
    expect(none.grownSec).toBe(0);
    expect(none.score).toBe(0);
    const unfocused = simSession(LIBRARY, { focus: 'unfocused', returning: true });
    expect(unfocused.grownSec).toBe(0);
  });

  it('its quiet tune is a whole song', () => {
    const song = buildTune();
    expect(song.beats).toBe(64);
    expect(song.parts.length).toBeGreaterThanOrEqual(4);
    for (const p of song.parts) for (const n of p.notes) expect(n.at + n.len).toBeLessThanOrEqual(song.beats + 0.01);
  });
});

describe('Rozkwit — reuse, not redraw', () => {
  it('a borrowed scene is its source’s picture: the same world, view, growing point and variant', () => {
    for (const [id, b] of Object.entries(BORROWS)) {
      const src = b.lib.scenes[b.scene];
      expect(src, `${b.lib.id}.${b.scene}`).toBeTruthy();
      const mine = SCENES[id];
      expect(mine.world).toBe(`${b.lib.id}.${src.world}`);
      expect(mine.view).toEqual(b.view ?? src.view);
      expect(mine.focus).toEqual(b.focus ?? src.focus);
      expect(mine.variant).toBe(src.variant);
      // the borrowed world keeps its depth and its lens
      expect(LIBRARY.worlds[mine.world].depth).toBe(b.lib.worlds[src.world].depth);
      expect(LIBRARY.worlds[mine.world].lens).toBe(b.lib.worlds[src.world].lens);
    }
    for (const [id, theirs] of Object.entries(HAIR)) {
      expect(SCENES[id].view).toEqual(HAIR_SCENE[theirs].view);
      expect(SCENES[id].world).toBe(`wlosy.${HAIR_SCENE[theirs].world}`);
    }
  });

  it('the names of the parts are the sources’ own words, in every language', () => {
    for (const b of Object.values(BORROWS)) {
      for (const lb of b.lib.scenes[b.scene].labels) {
        if (b.parts && !b.parts.includes(lb.part)) continue;
        for (const l of LANGS) {
          const theirs = flatMsg((b.lib.words[l] as Record<string, Msg | undefined>)[`part.${lb.part}`]);
          expect(text(l, `part.${b.lib.id}_${lb.part}`), `${l} ${b.lib.id}.${lb.part}`).toBe(theirs);
        }
      }
    }
    for (const theirs of Object.values(HAIR)) {
      for (const lb of HAIR_SCENE[theirs].labels) {
        for (const l of LANGS) expect(text(l, `part.wlosy_${lb.part}`)).toBe(flatMsg((HAIR_WORDS[l] as Record<string, Msg>)[`part.${lb.part}`]));
      }
    }
  });

  it('each meditation’s everyday step is a source game’s own line, word for word; the figure’s words are Lekkość i siła’s', () => {
    for (const m of MEDS) {
      const c = CARE[m.id];
      expect(c, m.id).toBeTruthy();
      for (const l of LANGS) expect(text(l, `med.${m.id}.care`)).toBe(flatMsg((c.lib.words[l] as Record<string, Msg>)[c.key]));
    }
    for (const k of LOOK_KEYS) for (const l of LANGS) expect(text(l, k)).toBe(flatMsg((KSZTALT.words[l] as Record<string, Msg>)[k]));
    // six different steps: sleep, getting up, strength, the sun, three good things, movement that brings joy
    expect(new Set(MEDS.map(m => text('pl', `med.${m.id}.care`))).size).toBe(6);
  });

  it('a borrowed world is told its source’s scene id and a look it knows', () => {
    const seen: { scene: string; look: string }[] = [];
    const spy: WorldPainter = {
      depth: 1, lens: true,
      bake: (_c, _v, look) => { seen.push({ scene: 'bake', look }); },
      draw: (_c, st) => { seen.push({ scene: st.scene, look: st.look }); },
      focusAt: s => (s === 'theirs' ? [1, 2] : [9, 9]),
      counter: s => (s === 'theirs' ? 'n' : null),
    };
    const w = borrowedWorld(spy, new Map([['mine', 'theirs']]), l => (l === 'on' ? 'dark' : 'light'));
    const st = { scene: 'mine', look: 'on' } as unknown as WorldState;
    w.draw({} as CanvasRenderingContext2D, st);
    w.bake({} as CanvasRenderingContext2D, '', 'ona');
    expect(seen).toEqual([{ scene: 'theirs', look: 'dark' }, { scene: 'bake', look: 'light' }]);
    expect(w.focusAt?.('mine', 0.5)).toEqual([1, 2]);
    expect(w.counter?.('mine', 0.5)).toBe('n');
    // the real ones: Lekkość i siła gets the figure, Żywa skóra a skin tone it has, the others none
    expect(LOOK_FOR.ksztalt('on')).toBe('on');
    expect(LOOK_FOR.ksztalt('ona')).toBe('ona');
    for (const l of LIBRARY.looks) expect(BORROWS.kolagen.lib.looks).toContain(LOOK_FOR.skora(l));
    for (const b of Object.values(BORROWS)) if (!b.lib.looks.length) expect(LOOK_FOR[b.lib.id], b.lib.id).toBeUndefined();
    for (const b of Object.values(BORROWS)) if (b.lib.looks.length) expect(LOOK_FOR[b.lib.id], b.lib.id).toBeDefined();
  });

  it('dives open where each picture lies in the body', () => {
    for (const m of MEDS) for (const s of m.scenes) {
      const p = portal('rozkwit', s);
      if (SCENES[s].world === 'whole') continue;
      expect(p, s).not.toBeNull();
      const [x, y] = p!;
      expect(x >= BLOOM_VIEW.x && x <= BLOOM_VIEW.x + BLOOM_VIEW.w && y >= BLOOM_VIEW.y && y <= BLOOM_VIEW.y + BLOOM_VIEW.h, s).toBe(true);
    }
    // within one game's pictures, that game's own portal
    expect(portal('dyski', 'gorset')).toEqual(BORROWS.dyski.lib.portal?.('noc', 'gorset') ?? null);
    // from the head down into the follicle: at the crown
    expect(portal('glowa', 'wlos')).not.toBeNull();
  });
});

describe('Rozkwit — the words', () => {
  /** The numbers each scene teaches, as written in pl (de and sv the same, en with a point and a comma for thousands). */
  const CITED: Record<string, { pl: string[]; en: string[] }> = {
    energia: { pl: ['100'], en: ['100'] },
    straz: { pl: ['5–20%'], en: ['5–20%'] },
    dyski: { pl: ['1%'], en: ['1%'] },
    wydech: { pl: ['84%', '16%'], en: ['84%', '16%'] },
    miesien: { pl: ['112%'], en: ['112%'] },
    postac: { pl: ['400', '40%'], en: ['400', '40%'] },
    naskorek: { pl: ['39'], en: ['39'] },
    kolagen: { pl: ['¾', '15'], en: ['¾', '15'] },
    wlos: { pl: ['0,35'], en: ['0.35'] },
    glowa: { pl: [`100${NBSP}000`, '2–7'], en: ['100,000', '2–7'] },
    ziarno: { pl: ['20', '4805'], en: ['20', '4805'] },
    wdziecznosc: { pl: ['2005'], en: ['2005'] },
    plynie: { pl: ['2010'], en: ['2010'] },
    cialo: { pl: ['30', '330'], en: ['30', '330'] },
    rozkwit: { pl: ['701'], en: ['701'] },
  };
  const deSv = (s: string): string => s.replace(/(\d)%/, `$1${NBSP}%`);

  it('the numbers stand as cited in all four languages', () => {
    for (const [scene, c] of Object.entries(CITED)) {
      for (const n of c.pl) expect(text('pl', `teach.${scene}`), `pl ${scene} ${n}`).toContain(n);
      for (const n of c.en) expect(text('en', `teach.${scene}`), `en ${scene} ${n}`).toContain(n);
      for (const l of ['de', 'sv'] as const) for (const n of c.pl) expect(text(l, `teach.${scene}`), `${l} ${scene} ${n}`).toContain(deSv(n));
    }
  });

  it('the numbers agree with the games whose pictures they stand in', () => {
    const src = (scene: string, key: string, l: Lang = 'pl'): string => flatMsg((BORROWS[scene].lib.words[l] as Record<string, Msg>)[key]);
    expect(src('energia', 'teach.wirnik')).toMatch(/100/);
    expect(src('wydech', 'teach.oddech') + src('wydech', 'teach.mitochondrium')).toMatch(/84/);
    expect(src('naskorek', 'teach.wedrowka')).toMatch(/39/);
    expect(src('kolagen', 'teach.lata')).toMatch(/15/);
    expect(flatMsg((BORROWS.energia.lib.words.pl as Record<string, Msg>)['teach.szpik'])).toMatch(/330/);
    expect(flatMsg((HAIR_WORDS.pl as Record<string, Msg>)['teach.skos'])).toMatch(/0,35/);
  });

  it('a number keeps its unit on the same line (a no-break space)', () => {
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(OWN[l]) as [string, Msg][]) {
        for (const s of typeof m === 'string' ? [m] : Object.values(m)) {
          if (typeof s !== 'string') continue;
          // a digit, a plain space, then a unit word or a per-cent sign: never (phone numbers and "Psalm 139" aside)
          const bad = s.match(/\d (?:%|razy|times|Mal|varv|lat|years|Jahre|år|dni|days|Tage|dagar|mm|godzin|hours|Stunden|timmar|bilionów|trillion|Billionen|biljoner|miliardów|billion|Milliarden|miljarder|mięśni|muscles|Muskeln|muskler|badań|trials|Studien|studier|osób|people|Menschen|personer|stopni|degrees|Grade|led)\b/u);
          expect(bad, `${l}.${k}`).toBeNull();
        }
      }
    }
    expect(text('pl', 'unit').length).toBeGreaterThan(0);
    expect(flatMsg(W.pl.unit)).toContain(NBSP);
  });

  it('beauty as health and a gift — never a promise of youth, a figure or a cure; youth named only to say so', () => {
    const youth: Record<Lang, RegExp> = { pl: /młod/iu, en: /\byouth|young/iu, de: /jugend|jung/iu, sv: /ungdom|ung\b/iu };
    const denied: Record<Lang, RegExp> = { pl: /nie obietnica młodości|ani obietnica młodości/u, en: /not a promise of youth|or a promise of youth/u, de: /kein Versprechen von Jugend/u, sv: /inget löfte om ungdom/u };
    for (const l of LANGS) {
      for (const [k, m] of Object.entries(OWN[l]) as [string, Msg][]) {
        const s = typeof m === 'string' ? m : Object.values(m).join(' ');
        if (youth[l].test(s)) expect(s, `${l}.${k}`).toMatch(denied[l]);
        // no comparison with others, no "ideal" body
        expect(s, `${l}.${k}`).not.toMatch(/ideal(?:ne|na|ny|n[ae]j)? (?:ciało|sylwetk)|ideal body|perfect body|Idealkörper|idealkropp/iu);
      }
      // "not a treatment" plainly in the opening card's second page and the lobby card
      expect(text(l, 'story.open2.text')).toMatch(/nie leczenie|not a treatment|keine Behandlung|ingen behandling/u);
      expect(text(l, 'panel.not')).toMatch(/nie leczenie|not a treatment|keine Behandlung|ingen behandling/u);
      // the eating-disorder note where the figure appears
      expect(text(l, 'panel.not')).toMatch(/116 123|eating-disorder|Essstörungen|Frisk & Fri/u);
    }
  });

  it('the narrator thanks; the closing card is a thanks', () => {
    expect(text('pl', 'story.whole.text')).toMatch(/^Dziękuję/);
    expect(text('en', 'story.whole.text')).toMatch(/^Thank/);
    expect(text('de', 'story.whole.text')).toMatch(/^Danke/);
    expect(text('sv', 'story.whole.text')).toMatch(/^Tack/);
    for (const s of MEDS.flatMap(m => m.scenes)) expect(text('pl', `say.at.${s}.1`), s).toMatch(/^Dziękuję/);
  });

  it('stands in the Games tab after the other health visualisations, with its unit and root', () => {
    const e = ARCADE.find(a => a.id === 'rozkwit');
    expect(e?.kind).toBe('health');
    expect(e?.root).toBe('psa139.13-14');
    expect(e?.unit).toBe('płatków');
    const health = ARCADE.filter(a => a.kind === 'health').map(a => a.id);
    expect(health[health.length - 1]).toBe('rozkwit');
    expect(e?.tips[4]).toMatch(/nie leczenie/);
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
          return { addColorStop(o: number, c: string) { if (!(o >= 0 && o <= 1)) problems.push(`addColorStop(${o})`); if (/NaN/.test(c)) problems.push(`colour ${c}`); } };
        };
      }
      if (k === 'getTransform') return () => ({ a: 3, b: 0, c: 0, d: 3, e: 0, f: 0 });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k === 'canvas') return { width: 600, height: 800 };
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

describe('Rozkwit — the pictures', () => {
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

  it('the whole person lights part by part, then all at once with joy — and never steps back between the two', () => {
    const a = shine('cialo', 0.1), b = shine('cialo', 0.5), c = shine('cialo', 1);
    expect(a.cells).toBeGreaterThan(a.hair);
    expect(b.spine).toBeGreaterThan(b.strength);
    for (const k of ['cells', 'spine', 'hair', 'skin', 'strength'] as const) expect(c[k]).toBe(1);
    expect(c.joy).toBe(0);
    const r0 = shine('rozkwit', 0), r1 = shine('rozkwit', 1);
    for (const k of ['cells', 'spine', 'hair', 'skin', 'strength'] as const) expect(r0[k]).toBeGreaterThanOrEqual(0.5);
    expect(r0.joy).toBe(0);
    expect(r1.joy).toBe(1);
    // the people near and far stand within the picture
    for (const p of PEOPLE) expect(Math.abs(p.x) + 18 * p.s).toBeLessThan(-BLOOM_VIEW.x);
    expect(BODY_VIEW.h).toBeGreaterThan(100);
  });
});

describe('Rozkwit — 45–60 minutes (round 24)', () => {
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
