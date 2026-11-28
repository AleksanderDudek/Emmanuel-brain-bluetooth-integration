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
import { BORROWS, CARE, HAIR, LOOK_FOR, LOOK_KEYS, OLD_LOOK, RADOSC, SILY } from '../src/arcade/rozkwit/sources';
import { CITY, NARAZ, PEOPLE_AT, START, cityLit, duskAt, heartAt, personLit, renewalAt, visionOf } from '../src/arcade/rozkwit/naraz';
import { FRIENDS, WINDOWS } from '../src/arcade/rozkwit/world-naraz';
import { FEET, HK, paintFront, paintSide, sidePose } from '../src/arcade/rozkwit/person';
import ROZKWIT, { migrateLook } from '../src/arcade/rozkwit/index';
import { freshProgress } from '../src/arcade/kit/healthlib/meta';
import { FRAMES, type FocusScript } from '../src/arcade/kit/healthlib/testing';
import { layout, pickerLayout, tapTargets } from '../src/arcade/kit/healthlib/layout';
import { MODES } from '../src/arcade/kit/healthlib/lib';
import { CHECK_SIZES, auditTargets } from '../src/arcade/kit/mobile';
import type { FocusFrame } from '../src/arcade/kit/focus';
import { PARAMS } from '../src/arcade/sily/renew';
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
  it('passes the engine check (shape, verses, words in four languages, lengths, tone) — seven meditations', () => {
    // Rozkwit has seven since round 25 („Wszystko naraz” first, the six of round 20 kept); the engine's rule allows 4–7
    // and the picker is checked for seven below
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('keeps the picker’s every part finger-sized, inside the insets and apart for its seven meditations', () => {
    const meds = MEDS.map(m => m.id);
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        const tg = tapTargets(L, { story: null, picker: true, live: true, meds });
        const id = `${s.name} · ${touch}`;
        expect(tg, id).toHaveLength(1 + MODES.length + meds.length);
        expect(auditTargets(tg, s.w, s.h, L.ins), id).toEqual([]);
        const P = pickerLayout(L, meds.length);
        expect(P.card.y, id).toBeGreaterThanOrEqual(L.top);
        expect(P.card.y + P.card.h, id).toBeLessThanOrEqual(L.bottom + 0.5);
        for (const r of P.items) {
          expect(r.x + r.w, id).toBeLessThanOrEqual(P.card.x + P.card.w + 0.5);
          expect(r.y + r.h, id).toBeLessThanOrEqual(P.card.y + P.card.h + 0.5);
        }
      }
    }
  });

  it('opens with „Wszystko naraz”, then walks the whole person: the last one its own picture where everything shines at once', () => {
    expect(MEDS.map(m => m.id)).toEqual(['naraz', 'komorki', 'postawa', 'sylwetka', 'skora', 'radosc', 'cale']);
    expect(MEDS.flatMap(m => m.scenes)).toHaveLength(22);
    expect(MEDS[0].scenes).toEqual([...NARAZ]);
    expect(MEDS[0].scenes.map(s => SCENES[s].world)).toEqual(['naraz.whole', 'naraz.face', 'naraz.side', 'naraz.town']);
    expect(MEDS[0].verse).toBe('mat5.14-16');
    expect(MEDS[6].scenes.map(s => SCENES[s].world)).toEqual(['whole', 'whole']);
    expect(LIBRARY.root).toBe('psa139.13-14');
    // the looks are Nowe siły's: a woman or a man in three skin tones (its words, copied)
    expect(LIBRARY.looks).toEqual(['f1', 'f2', 'f3', 'm1', 'm2', 'm3']);
    expect(LIBRARY.looks).toEqual(SILY.looks);
    // a new player begins with „Wszystko naraz”, in order (the rest follows as the deeper walk)
    const fresh = LIBRARY.meds[0];
    expect(fresh.id).toBe('naraz');
    expect(simSession(LIBRARY, { planned: 60 }).events.find(e => e.type === 'scene')).toMatchObject({ med: 'naraz', scene: 'naraz' });
    // every other scene is borrowed: from the engine's games or from Każdy włos (through the adapter)
    for (const s of MEDS.slice(1, 6).flatMap(m => m.scenes)) expect(BORROWS[s] || HAIR[s], s).toBeTruthy();
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

  it('each meditation’s everyday step is a source game’s own line, word for word; the looks’ words are Nowe siły’s', () => {
    for (const m of MEDS) {
      const c = CARE[m.id];
      expect(c, m.id).toBeTruthy();
      for (const l of LANGS) expect(text(l, `med.${m.id}.care`)).toBe(flatMsg((c.lib.words[l] as Record<string, Msg>)[c.key]));
    }
    for (const k of LOOK_KEYS) for (const l of LANGS) expect(text(l, k)).toBe(flatMsg((SILY.words[l] as Record<string, Msg>)[k]));
    expect(LOOK_KEYS.map(k => k.slice(5))).toEqual([...LIBRARY.looks]);
    // the note under the looks is Rozkwit's own (Nowe siły's speaks of a tired person)
    for (const l of LANGS) expect(text(l, 'panel.lookNote')).not.toBe(flatMsg((SILY.words[l] as Record<string, Msg>)['panel.lookNote']));
    // seven different steps: joy told, sleep, getting up, strength, the sun, three good things, movement that brings joy
    expect(new Set(MEDS.map(m => text('pl', `med.${m.id}.care`))).size).toBe(7);
    expect(CARE.naraz).toEqual({ lib: RADOSC, key: 'med.pelnia.care' });
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
    // the real ones: Lekkość i siła gets the silhouette, Żywa skóra the nearest skin tone it has, the others none
    for (const l of ['m1', 'm2', 'm3', 'on']) expect(LOOK_FOR.ksztalt(l), l).toBe('on');
    for (const l of ['f1', 'f2', 'f3', 'ona']) expect(LOOK_FOR.ksztalt(l), l).toBe('ona');
    for (const l of LIBRARY.looks) expect(BORROWS.kolagen.lib.looks).toContain(LOOK_FOR.skora(l));
    expect(LIBRARY.looks.map(l => LOOK_FOR.skora(l))).toEqual(['medium', 'olive', 'dark', 'medium', 'olive', 'dark']);
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
    naraz: { pl: ['330'], en: ['330'] },
    oblicze: { pl: ['23'], en: ['23'] },
    profil: { pl: ['74'], en: ['74'] },
    miasto: { pl: ['4739', '20', '25%'], en: ['4739', '20', '25%'] },
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

// ── „Wszystko naraz” (round 25) ──────────────────────────────────
/** a player who focuses `on` seconds of every `cycle` at `level` (the band reads calm in rest) — Nowe siły's players */
const player = (on: number, cycle: number, level: number) => (t: number): FocusFrame => {
  const x = t % cycle, f = x < on;
  return { ...FRAMES.mid, level: f ? level : 0.35, focused: f, hold: f ? x : 0, activity: f ? 2.4 : 1 };
};
const PLAYERS = { weak: player(6, 10, 0.5), threshold: player(6, 8, 0.6), strong: (): FocusFrame => FRAMES.high };
const returning = (n: number) => (n > 1 ? { returning: true, progress: { sessions: n - 1, pushes: (n - 1) * 6 } } : {});
const isNarazScene = (s: string): boolean => (NARAZ as readonly string[]).includes(s);

/** The vision as the world sees it while one of the meditation's scenes is on screen (the most it showed), and at the end. */
function visionRun(planned: number, focus: FocusScript, extra: Record<string, unknown> = {}, sec?: number) {
  let seen = 0, seenAt = -1;
  const run = simSession(LIBRARY, {
    planned, focus, sec, ...extra,
    each: (t, s) => {
      if (!isNarazScene(s.scene)) return;
      const v = visionOf({ arc: s.arc, session: s.sessionGrowth, g: s.g });
      if (v > seen) seen = v;
      if (seenAt < 0 && v >= 0.999) seenAt = t;
    },
  });
  const end = visionOf({ arc: run.sim.arc, session: run.sim.sessionGrowth, g: run.sim.g });
  return { run, seen, seenAt, end };
}

describe('Rozkwit — „Wszystko naraz”: the whole person, all at once', () => {
  it('the vision: the session’s arc or the meditation walked, whichever is further; outside play the scene’s own growth', () => {
    expect(visionOf({ g: 0.37 })).toBeCloseTo(0.37);
    expect(visionOf({ g: 2 })).toBe(1);
    expect(visionOf({ arc: 0, session: {}, g: 0.9 })).toBe(0);
    expect(visionOf({ arc: 0.4, session: { naraz: 1 }, g: 0 })).toBe(0.4);
    expect(visionOf({ arc: 0.1, session: { naraz: 1, oblicze: 1, profil: 0.5 }, g: 0 })).toBeCloseTo(0.625);
    // this meditation's growth counts (a blind push's lands in the scene current at its end); the others' not at all
    expect(visionOf({ arc: 0, session: { naraz: 0.4, profil: 1.6, energia: 9 }, g: 0 })).toBeCloseTo(0.5);
    expect(visionOf({ arc: 0.2, session: { naraz: 1, oblicze: 1, profil: 1, miasto: 1 }, g: 0 })).toBe(1);
    expect(visionOf({ arc: Number.NaN, session: {}, g: 0 })).toBe(0);
  });

  it('every aspect moves together — colour, skin, eyes, posture, hair, the smile — from where it starts to whole', () => {
    expect(renewalAt(0)).toEqual(START);
    for (const p of PARAMS) expect(renewalAt(1)[p]).toBeCloseTo(1, 9);
    for (const v of [0.1, 0.3, 0.5, 0.8]) {
      const r = renewalAt(v);
      const shares = PARAMS.map(p => (r[p] - START[p]) / (1 - START[p]));
      for (const k of shares) expect(k).toBeCloseTo(shares[0], 9);
    }
    // an ordinary person at the end of a day, never drawn as unwell: the skin starts nearer renewed than Nowe siły's
    // tired person; the posture has the most to straighten
    expect(START.skora).toBeGreaterThanOrEqual(0.5);
    expect(START.postawa).toBeLessThan(0.1);
    // the side straightens: the ear comes back over the shoulder, the hip and the ankle (the plumb line, x = 0)
    const ear = (k: number): number => sidePose('f', k).head[0] + 2.8 * HK;
    const up = sidePose('f', 1);
    for (const x of [ear(1), up.shoulder[0], up.hip[0], up.ankle[0]]) expect(Math.abs(x)).toBeLessThan(1.5);
    expect(ear(0)).toBeLessThan(-4);
    expect(sidePose('f', 0).shoulder[0] - ear(0)).toBeGreaterThan(1.5);
    for (let k = 0; k < 1; k += 0.1) expect(ear(k + 0.1)).toBeGreaterThan(ear(k));
  });

  it('nothing moves without focus: the person stays where it starts, no one is lit, the town stays dark', () => {
    for (const focus of ['none', 'unfocused'] as const) {
      const r = simSession(LIBRARY, { returning: true, focus, planned: 120 });
      const v = visionOf({ arc: r.sim.arc, session: r.sim.sessionGrowth, g: r.sim.g });
      expect(v, focus).toBe(0);
      expect(renewalAt(v)).toEqual(START);
      expect(FRIENDS.map((_f, i) => personLit(v, i))).toEqual(FRIENDS.map(() => 0));
      expect(cityLit(v, WINDOWS.length)).toBe(0);
    }
    // a 40 s test session (the app smoke's), first-ever and returning, scores in „Wszystko naraz” and moves the vision
    for (const returningPlayer of [false, true]) {
      const r = simSession(LIBRARY, { returning: returningPlayer });
      expect(r.score).toBeGreaterThan(0);
      expect(r.sim.med).toBe('naraz');
      expect(visionOf({ arc: r.sim.arc, session: r.sim.sessionGrowth, g: r.sim.g })).toBeGreaterThan(0);
    }
  });

  for (const min of [3, 10, 30, 45, 60]) {
    it(`a well-focused ${min}-minute session shows the whole vision — the person renewed, everyone lit, the whole town`, () => {
      // after the meditation is walked (by the tenth minute even for a weak player) nothing changes the vision: a long
      // session is followed for 15 minutes
      const { seen, seenAt, run } = visionRun(min * 60, 'high', { returning: true }, Math.min(min * 60 + 4, 900));
      expect(seen, `${min} min`).toBeGreaterThan(0.999);
      expect(seenAt, `${min} min`).toBeGreaterThan(30);
      for (const p of PARAMS) expect(renewalAt(seen)[p]).toBeGreaterThan(0.999);
      expect(FRIENDS.every((_f, i) => personLit(seen, i) > 0.999)).toBe(true);
      expect(cityLit(seen, WINDOWS.length)).toBe(WINDOWS.length);
      expect(duskAt(seen)).toBeGreaterThan(0.99);
      expect(run.score).toBeGreaterThan(0);
    }, 120_000);
  }

  it('fits the session: ≥ 90 % of the vision seen for weak, threshold and strong players at 3–60 min, sessions 1, 2, 5 and 13', () => {
    const low: string[] = [];
    for (const min of [3, 10, 30, 60]) {
      for (const [name, f] of Object.entries(PLAYERS)) {
        for (const n of [1, 2, 5, 13]) {
          const { seen } = visionRun(min * 60, f, returning(n), Math.min(min * 60 + 4, 900));
          if (seen < 0.9) low.push(`${min} min ${name} s${n}: ${seen.toFixed(2)}`);
        }
      }
    }
    expect(low).toEqual([]);
  }, 300_000);

  it('stays partial with only a few focused moments (2 s in 20): the town barely begins', () => {
    const { seen } = visionRun(180, player(2, 20, 0.5), { returning: true });
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(0.6);
    expect(cityLit(seen, WINDOWS.length)).toBeLessThan(WINDOWS.length / 4);
  }, 60_000);

  it('joy multiplies: the heart first, then the people one by one, then the town’s windows — one, two, four … all', () => {
    expect(heartAt(0)).toBeGreaterThan(0);
    expect(heartAt(1)).toBeCloseTo(1);
    // the people light in order, each after the one before
    for (let v = 0; v <= 1; v += 0.02) for (let i = 1; i < FRIENDS.length; i++) expect(personLit(v, i)).toBeLessThanOrEqual(personLit(v, i - 1));
    expect(PEOPLE_AT).toHaveLength(FRIENDS.length);
    expect(personLit(PEOPLE_AT[0] - 0.01, 0)).toBe(0);
    // the town begins once the people are lit, with one window, and doubles in equal steps of the vision
    const N = WINDOWS.length;
    expect(N).toBeGreaterThan(200);
    expect(cityLit(CITY.from, N)).toBe(0);
    expect(cityLit(CITY.from + 1e-6, N)).toBe(1);
    expect(cityLit(CITY.to, N)).toBe(N);
    const step = (CITY.to - CITY.from) * Math.LN2 / Math.log(N);
    let last = 0;
    for (let v = CITY.from + 3 * step; v < CITY.to - step; v += step) {
      const n0 = cityLit(v, N), n1 = cityLit(v + step, N);
      expect(n1 / n0).toBeGreaterThan(1.7);
      expect(n1 / n0).toBeLessThan(2.3);
      expect(n0).toBeGreaterThanOrEqual(last);
      last = n0;
    }
    // and the evening comes with it, so the lights can be seen
    expect(duskAt(0)).toBe(0);
    expect(duskAt(1)).toBe(1);
  });

  it('the counts on the picture’s corner: new cells a second, the study of joy', () => {
    const w = LIBRARY.worlds;
    expect(w['naraz.whole'].counter?.('naraz', 0.5)).toBe(text('pl', 'count.naraz'));
    expect(w['naraz.town'].counter?.('miasto', 0.5)).toBe(text('pl', 'count.miasto'));
    expect(w['naraz.whole'].counter?.('naraz', 0)).toBeNull();
    for (const l of LANGS) {
      expect(text(l, 'count.naraz')).toMatch(/4/);
      expect(text(l, 'count.miasto')).toMatch(/4739/);
    }
  });

  it('old saves keep their figure: Lekkość i siła’s ona/on become the first tone of a woman or a man', () => {
    expect(OLD_LOOK).toEqual({ ona: 'f1', on: 'm1' });
    expect(migrateLook({ look: 'on' })).toEqual({ look: 'm1' });
    expect(migrateLook({ look: 'ona' })).toEqual({ look: 'f1' });
    expect(migrateLook({ look: 'f3' })).toEqual({ look: 'f3' });
    // through the module, before the engine repairs the save (which would give everyone the first look)
    for (const [old, now] of [['on', 'm1'], ['ona', 'f1'], ['m2', 'm2'], ['nonsense', 'f1']] as const) {
      const p = { ...freshProgress(LIBRARY), look: old, sessions: 2, best: { '600': 140 } };
      expect(ROZKWIT.best(p)).toBe(140);
      expect(p.look, old).toBe(now);
    }
  });

  it('words: true and kind — the body’s own work, thanks, joy shared; never “younger”', () => {
    const banned = /młodsz|odmład|younger|rejuven|jünger|verjüng|yngre|föryng|uzdraw|ulecz|heals? you/iu;
    for (const l of LANGS) {
      for (const k of ['med.naraz', 'med.naraz.line', 'word.naraz.1', 'word.naraz.2', 'word.naraz.3', ...NARAZ.flatMap(s => [`scene.${s}`, `teach.${s}`, `tip.${s}`, `say.at.${s}.1`, `say.at.${s}.2`])]) {
        const t = text(l, k);
        expect(t, `${l}.${k}`).not.toBe('');
        expect(t, `${l}.${k}`).not.toMatch(banned);
      }
      expect(text(l, 'say.at.miasto.3')).not.toBe('');
    }
    expect(text('pl', 'med.naraz')).toBe('Wszystko naraz');
    expect(text('en', 'med.naraz')).toBe('All at Once');
    expect(text('de', 'med.naraz')).toBe('Alles zugleich');
    expect(text('sv', 'med.naraz')).toBe('Allt på en gång');
    // the source of the multiplying joy is named in the teaching (4739 people, three degrees)
    expect(text('pl', 'teach.miasto')).toMatch(/trzech stopni/);
    expect(text('en', 'teach.miasto')).toMatch(/three degrees/);
  });

  it('the whole person paints from the front and the side in every look at every renewal, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const look of LIBRARY.looks) {
      for (const v of [0, 0.33, 0.66, 1]) {
        paintFront(ctx, look, renewalAt(v));
        paintSide(ctx, look, renewalAt(v));
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
    expect(FEET).toBeGreaterThan(80);
  });

  it('its scenes paint in play too (the session’s arc and walk), in every look, without NaN', () => {
    const problems: string[] = [];
    const ctx = strictCtx(problems);
    for (const look of ['f1', 'm3']) {
      for (const id of NARAZ) {
        const sc = SCENES[id];
        const w = LIBRARY.worlds[sc.world];
        w.bake(ctx, sc.variant ?? '', look);
        for (const [arc, g] of [[0, 0], [0.3, 0.5], [0.7, 1], [1, 0.2]] as const) {
          const st: WorldState = { scene: id, g, deep: 0.5, light: 0.7, growing: true, time: 3.1, after: 0, breath: 0.3, blind: false, reduced: arc > 0.5, px: 3, look, arc, session: { naraz: arc, oblicze: g } };
          w.draw(ctx, st);
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });
});
