/**
 * Czujna straż (src/arcade/straz, DESIGN §24): the library is whole and well-formed for the engine (checkLibrary),
 * it scores in the app smoke's 40 s session — first ever and returning — and grows nothing without focus; every
 * picture draws at every growth without a broken coordinate; its words keep this game's tone (calm precision, not
 * war; a meditation, never a promise; no blame) and every number it puts on screen appears as sourced in the design
 * notes, in all four languages.
 */
import { describe, expect, it } from 'vitest';
import { LANGS, type Lang, type Msg } from '../src/i18n';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib';
import { LIBRARY } from '../src/arcade/straz/library';
import { CATALOGS } from '../src/arcade/straz/i18n';
import { cloneGen, memoryLeft } from '../src/arcade/straz/world-node';
import { checkedCount } from '../src/arcade/straz/world-tissue';

const text = (l: Lang, key: string): string => {
  const m = (CATALOGS[l] as Readonly<Record<string, Msg>>)[key];
  return typeof m === 'string' ? m : m ? Object.values(m).join(' ') : '';
};
const all = (l: Lang): string => Object.keys(CATALOGS.pl).map(k => text(l, k)).join('\n');
const NB = ' ';

describe('Czujna straż — the library', () => {
  it('is whole and well-formed (checkLibrary)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });

  it('has six meditations and eighteen scenes, the last one the whole watch', () => {
    expect(LIBRARY.meds.map(m => m.id)).toEqual(['patrol', 'rozpoznanie', 'precyzja', 'hamulce', 'pamiec', 'cala']);
    expect(LIBRARY.meds.reduce((n, m) => n + m.scenes.length, 0)).toBe(18);
    expect(LIBRARY.root).toBe('psa121.4');
    expect(new Set(LIBRARY.meds.map(m => m.verse)).size).toBe(6);
  });

  it('dives deeper only into a deeper world, from a place inside the shallower view', () => {
    const scenes = LIBRARY.meds.flatMap(m => m.scenes);
    const depth = (s: string) => LIBRARY.worlds[LIBRARY.scenes[s].world].depth;
    for (const a of scenes) {
      for (const b of scenes) {
        const p = LIBRARY.portal?.(a, b) ?? null;
        if (depth(b) <= depth(a)) expect(p, `${a}→${b}`).toBeNull();
        else expect(p, `${a}→${b}`).not.toBeNull();
      }
    }
  });
});

describe('Czujna straż — the session', () => {
  it('scores in a 40 s first-ever session', () => {
    expect(simSession(LIBRARY).score).toBeGreaterThan(0);
  });
  it('scores in a 40 s returning session', () => {
    expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);
  });
  it('grows nothing without focus (no signal, or a signal without focus)', () => {
    for (const focus of ['none', 'unfocused'] as const) {
      const s = simSession(LIBRARY, { focus, sec: 300, planned: 300, returning: true });
      expect(s.grownSec, focus).toBe(0);
      expect(s.score, focus).toBe(0);
    }
  });
  it('walks the whole library in a long session at a strong signal', () => {
    const s = simSession(LIBRARY, { planned: 1800, returning: true });
    expect(s.scenes).toBeGreaterThan(18);
    expect(s.meds).toBeGreaterThanOrEqual(1);
  });
});

// a 2D context and Path2D that accept everything and fail on a broken coordinate
class FakePath {
  constructor(..._a: unknown[]) {}
}
const check = (name: string, args: unknown[]) => {
  for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${name}(${args.join(', ')})`);
};
for (const m of ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'ellipse', 'arcTo', 'closePath', 'rect']) {
  (FakePath.prototype as unknown as Record<string, unknown>)[m] = function (...args: unknown[]) {
    check(m, args);
  };
}
function fakeContext(): CanvasRenderingContext2D {
  const grad = { addColorStop: (o: number, c: string) => { check('addColorStop', [o]); if (/NaN/.test(c)) throw new Error(`colour ${c}`); } };
  const target: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1 };
  return new Proxy(target, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return (...a: unknown[]) => { check(k, a); return grad; };
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      return (...a: unknown[]) => check(k, a);
    },
    set(t, k: string, v: unknown) {
      if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`${k} = ${v}`);
      if (typeof v === 'string' && /NaN|undefined/.test(v)) throw new Error(`${k} = ${v}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('Czujna straż — the pictures', () => {
  it('every scene bakes and draws at every growth, in rest and in a push, without a broken number', () => {
    const g0 = globalThis as unknown as { Path2D?: unknown };
    const had = g0.Path2D;
    g0.Path2D = FakePath;
    try {
      for (const m of LIBRARY.meds) {
        for (const scene of m.scenes) {
          const sc = LIBRARY.scenes[scene], w = LIBRARY.worlds[sc.world];
          w.bake(fakeContext(), sc.variant ?? '', '');
          for (const g of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]) {
            for (const growing of [true, false]) {
              const st: WorldState = {
                scene, g, deep: growing ? 0 : 0.8, light: 0.7, growing, time: 12.3, after: g >= 1 ? 3 : 0, breath: 0.4,
                blind: false, reduced: !growing, px: 3, look: '',
              };
              expect(() => w.draw(fakeContext(), st), `${scene} @ ${g}`).not.toThrow();
              const f = w.focusAt?.(scene, g) ?? sc.focus;
              expect(Number.isFinite(f[0]) && Number.isFinite(f[1]), `${scene} focus @ ${g}`).toBe(true);
              const c = w.counter?.(scene, g) ?? null;
              if (c !== null) expect(c, `${scene} counter @ ${g}`).not.toMatch(/NaN|undefined|\{/);
            }
          }
        }
      }
    } finally {
      g0.Path2D = had;
    }
  });

  it('counts true to the sources on the picture’s corner', () => {
    expect(cloneGen(0)).toEqual({ k: 0, n: 1 });
    expect(cloneGen(1)).toEqual({ k: 14, n: 16384 }); // more than 14 divisions in a week (Blattman 2002)
    expect(memoryLeft(0)).toBe(1);
    expect(memoryLeft(1)).toBeCloseTo(0.05, 3); // about 5 % stay as memory (Blattman 2002)
    expect(checkedCount('patrol', 0)).toBe(0);
    expect(checkedCount('patrol', 1)).toBeGreaterThan(8);
    expect(checkedCount('skan', 1)).toBeGreaterThan(5);
    expect(checkedCount('synapsa', 1)).toBeNull();
  });
});

describe('Czujna straż — the words', () => {
  // calm precision, not war: the watch recognises, removes, tidies, keeps watch — never fights, kills or destroys
  const WAR: Readonly<Record<Lang, RegExp>> = {
    pl: /(?<![\p{L}])(walcz|zabij|zabi[ćt]|zabój|niszcz|wojn|wro?g|atak|bitw|broń|żołnierz)/iu,
    en: /(?<![\p{L}])(fight|kill|destroy|war(?!m)|enem|attack|battle|soldier|weapon)/iu,
    de: /(?<![\p{L}])(kämpf|kampf|töte|tötet|zerstör|krieg|feind|angriff|angreif|soldat|waffe)/iu,
    sv: /(?<![\p{L}])(kämpa|kamp|döda|dödar|förstör|krig|fiend|attack|soldat|vapen)/iu,
  };
  it('speaks of the watch without war, in all four languages', () => {
    for (const l of LANGS) {
      for (const key of Object.keys(CATALOGS.pl)) {
        const hit = text(l, key).match(WAR[l]);
        expect(hit?.[0] ?? null, `${l}.${key}`).toBeNull();
      }
    }
  });

  it('never names an NK cell a killer, never says “activate”', () => {
    for (const l of LANGS) expect(all(l), l).not.toMatch(/killer|natural kill|natürliche Kill|naturlig mördar|aktyw|activat|aktivier|aktiver/i);
  });

  it('says plainly what this is and is not, and puts no burden on the player', () => {
    const NOT: Readonly<Record<Lang, string>> = { pl: 'nie leczenie', en: 'not a treatment', de: 'keine Behandlung', sv: 'inte behandling' };
    const ALONGSIDE: Readonly<Record<Lang, RegExp>> = { pl: /towarzyszyć leczeniu/, en: /accompany treatment/, de: /Behandlung begleiten/, sv: /följa med behandlingen/ };
    const NO_BLAME: Readonly<Record<Lang, RegExp>> = {
      pl: /nie zależy od siły skupienia ani nastawienia/, en: /does not depend on how hard you focus or on your attitude/,
      de: /hängt nicht davon ab, wie stark du dich konzentrierst/, sv: /beror inte på hur väl du fokuserar/,
    };
    const NO_TUMOUR: Readonly<Record<Lang, RegExp>> = { pl: /nie ma dowodów/, en: /no evidence/, de: /nicht belegt/, sv: /inget visar/ };
    for (const l of LANGS) {
      for (const key of ['story.open2.text', 'panel.not', 'howto.tip2']) expect(text(l, key), `${l}.${key}`).toContain(NOT[l]);
      expect(text(l, 'story.open2.text'), l).toMatch(ALONGSIDE[l]);
      expect(text(l, 'story.open2.text'), l).toMatch(NO_BLAME[l]);
      expect(text(l, 'panel.not'), l).toMatch(NO_TUMOUR[l]);
      // a person may skip any scene
      expect(text(l, 'story.open2.text'), l).toContain('▶');
    }
  });

  it('puts every number on screen as sourced (DESIGN §24, the physiology table), in all four languages', () => {
    const SOURCED: readonly [key: string, per: Readonly<Record<Lang, string>>][] = [
      ['teach.patrol', { pl: `5–20%`, en: '5–20%', de: `5–20${NB}%`, sv: `5–20${NB}%` }], // Abel 2018
      ['teach.porzadek', { pl: 'setki miliardów', en: 'hundreds of billions', de: 'Hunderte Milliarden', sv: 'hundratals miljarder' }], // Sender & Milo 2021
      ['teach.probka', { pl: '1973', en: '1973', de: '1973', sv: '1973' }], // Steinman & Cohn 1973
      ['teach.probka', { pl: 'Nobel 2011', en: 'Nobel Prize 2011', de: 'Nobelpreis 2011', sv: 'Nobelpriset 2011' }],
      ['teach.droga', { pl: 'kilkaset', en: 'several hundred', de: 'mehrere hundert', sv: 'flera hundra' }], // Willard-Mack 2006
      ['teach.dopasowanie', { pl: 'setek, a nawet tysięcy', en: 'hundreds, even thousands', de: 'Hunderte, ja Tausende', sv: 'hundratals, ja tusentals' }], // Bousso 2003; Miller 2004
      ['teach.dopasowanie', { pl: 'dziesiątki tysięcy, a nawet milion', en: 'tens of thousands, even a million', de: 'Zehntausenden, ja einer Million', sv: 'tiotusentals, ja en miljon' }], // Alanio 2010
      ['teach.klony', { pl: `14${NB}podziałów`, en: `14${NB}divisions`, de: `14${NB}Teilungen`, sv: `14${NB}delningar` }], // Blattman 2002
      ['teach.synapsa', { pl: `30${NB}s`, en: `30${NB}s`, de: `30${NB}s`, sv: `30${NB}s` }], // Lopez 2013
      ['teach.synapsa', { pl: `2${NB}minuty`, en: `2${NB}minutes`, de: `2${NB}Minuten`, sv: `2${NB}minuter` }],
      ['say.at.synapsa.1', { pl: `2${NB}do 16${NB}komórek`, en: `2${NB}to 16${NB}cells`, de: `2${NB}bis 16${NB}Zellen`, sv: `2${NB}till 16${NB}celler` }], // Halle 2016
      ['teach.lek', { pl: '2018', en: '2018', de: '2018', sv: '2018' }], // Nobel Prize 2018
      ['teach.pamiec', { pl: '95%', en: '95%', de: `95${NB}%`, sv: `95${NB}%` }], // Blattman 2002
      ['teach.pamiec', { pl: `8–15${NB}lat`, en: `8–15${NB}years`, de: `8–15${NB}Jahren`, sv: `8–15${NB}år` }], // Hammarlund 2003
      ['teach.rezydenci', { pl: `20${NB}mld`, en: `20${NB}billion`, de: `20${NB}Mrd.`, sv: `20${NB}miljarder` }], // Clark 2006
      ['teach.rezydenci', { pl: 'miliona na każdy cm²', en: 'a million in every cm²', de: 'eine Million pro cm²', sv: 'en miljon per cm²' }],
      ['med.precyzja.care', { pl: `150–300${NB}minut`, en: `150–300${NB}minutes`, de: `150–300${NB}Minuten`, sv: `150–300${NB}minuter` }], // WHO 2020
      ['med.pamiec.care', { pl: `7–9${NB}godzin`, en: `7–9${NB}hours`, de: `7–9${NB}Stunden`, sv: `7–9${NB}timmar` }], // NSF 2015
    ];
    for (const [key, per] of SOURCED) for (const l of LANGS) expect(text(l, key), `${l}.${key}`).toContain(per[l]);
    // and no other figure sneaks in: every number in the teaching lines is one of those
    const allowedNums = new Set(['1', '2', '5', '20', '30', '14', '16', '95', '8', '15', '1973', '2011', '2018', '4', '6', '10']);
    for (const l of LANGS) {
      for (const key of Object.keys(CATALOGS.pl).filter(k => k.startsWith('teach.') || k.startsWith('say.') || k.endsWith('.care'))) {
        for (const n of text(l, key).match(/\d+/g) ?? []) {
          if (key.endsWith('.care')) continue;
          expect(allowedNums.has(n), `${l}.${key}: ${n}`).toBe(true);
        }
      }
    }
  });

  it('keeps the counts on the pictures short and filled', () => {
    for (const l of LANGS) {
      for (const key of ['count.checked', 'count.gen', 'count.fit', 'count.left', 'count.skin']) {
        expect(text(l, key).length, `${l}.${key}`).toBeLessThanOrEqual(32);
      }
    }
  });
});
