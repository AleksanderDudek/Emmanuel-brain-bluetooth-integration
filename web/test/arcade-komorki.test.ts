/**
 * Każda komórka (src/arcade/komorki, DESIGN §24): the library is whole and well-formed for the engine
 * (checkLibrary), it scores in the app smoke's 40 s session — first ever and returning — and grows nothing without
 * focus; every number it puts on screen appears exactly as sourced (the design notes' table) in all four languages;
 * its words keep the round's tone (a meditation, never a promise; energy is ATP; the mouse data said as such; "not a
 * treatment" plainly); and each of its ten worlds bakes and draws every scene at any growth without a stray number.
 */
import { describe, expect, it } from 'vitest';
import { checkLibrary, simSession } from '../src/arcade/kit/healthlib';
import type { WorldState } from '../src/arcade/kit/healthlib/spec';
import { CATALOGS } from '../src/i18n/arcade';
import { LIBRARY } from '../src/arcade/komorki/library';
import { WORDS } from '../src/arcade/komorki/i18n';
import type { Lang } from '../src/i18n';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const text = (l: Lang, k: string): string => {
  const m = (WORDS[l] as Record<string, unknown>)[k];
  return typeof m === 'string' ? m : JSON.stringify(m);
};
/** The numbers in a text, decimal commas read as points ("4,5" → "4.5"). */
const numbers = (s: string): string[] => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(n => n.replace(',', '.'));

describe('Każda komórka — the library', () => {
  it('is whole and well-formed (checkLibrary)', () => {
    expect(checkLibrary(LIBRARY)).toEqual([]);
  });
  it('has six meditations and eighteen scenes, the last meditation walking the whole', () => {
    expect(LIBRARY.meds.map(m => m.id)).toEqual(['energia', 'sprzatanie', 'naprawa', 'odnowa', 'noc', 'cala']);
    expect(LIBRARY.meds.reduce((n, m) => n + m.scenes.length, 0)).toBe(18);
    // "Cała komórka" reuses the library's own pictures: the cell and the body
    const last = LIBRARY.meds[5].scenes.map(s => LIBRARY.scenes[s].world);
    expect(last).toEqual(['cell', 'body']);
  });
  it('roots in Psalm 103:5 and closes with verses of renewal', () => {
    expect(LIBRARY.root).toBe('psa103.5');
    expect(LIBRARY.closers).toEqual(['2co4.16', 'isa40.31', 'psa104.24', 'psa16.9']);
  });
});

describe('Każda komórka — the session', () => {
  it('scores in a 40 s first-ever session', () => {
    expect(simSession(LIBRARY).score).toBeGreaterThan(0);
  });
  it('scores in a 40 s returning session', () => {
    expect(simSession(LIBRARY, { returning: true }).score).toBeGreaterThan(0);
  });
  it('grows nothing without focus (300 s, returning)', () => {
    const s = simSession(LIBRARY, { focus: 'none', sec: 300, returning: true });
    expect(s.grownSec).toBe(0);
    expect(s.score).toBe(0);
  });
  it('grows nothing in an unfocused session either', () => {
    expect(simSession(LIBRARY, { focus: 'unfocused', sec: 120, returning: true }).grownSec).toBe(0);
  });
});

/**
 * Every number on screen, as sourced (DESIGN §24, the komorki table): the key and its numbers, the same in every
 * language.  A new number must be added here with its source in the design notes.
 */
const CITED: Readonly<Record<string, readonly string[]>> = {
  'teach.grzebienie': ['90'], // Rolfe & Brown 1997
  'teach.wirnik': ['100', '3'], // Watt et al. 2010; Törnroth-Horsefield & Neutze 2008 (the body weight, no number)
  'teach.nowe': ['1'], // PGC-1α (Pilegaard et al. 2003)
  'teach.otoczenie': ['2016'], // the Nobel Prize to Ohsumi
  'teach.lizosom': ['4.5', '5', '60'], // Mindell 2012; Xu & Ren 2015
  'teach.ksiega': ['2', '6'], // Piovesan et al. 2019 ("tens of thousands" a day: Tubbs & Nussenzweig 2017)
  'say.at.odcinek.2': ['2015'], // the Nobel Prize to Lindahl, Modrich, Sancar
  'teach.jelito': ['3.5'], // Darwich et al. 2014
  'teach.szpik': ['115', '120', '330', '90'], // Franco 2012; Sender & Milo 2021
  'say.at.szpik.1': ['3.8'], // 0.33 × 10¹² a day ÷ 86 400 s
  'teach.tempo': ['7', '1'], // the myth; Bergmann et al. 2009
  'teach.fale': ['90'], // StatPearls, Sleep Stages
  'teach.mozg': ['60'], // Xie et al. 2013 (mice)
  'teach.cialo': ['70', '30'], // Sender, Fuchs & Milo 2016
  'med.energia.care': ['150', '300'], // WHO 2020 (Bull et al.)
  'med.noc.care': ['7', '9'], // Hirshkowitz et al. 2015
  'part.cycle': ['90'],
  'count.grzebienie': ['90'],
  'count.wirnik': ['100', '3'],
  'count.lizosom': ['4.5', '5', '60'],
  'count.ksiega': ['2', '6'],
  'count.jelito': ['3.5'],
  'count.szpik': ['330'],
  'count.fale': ['90'],
  'count.cialo': ['30'],
};

describe('Każda komórka — the numbers', () => {
  it('says every cited number exactly as sourced, in all four languages', () => {
    for (const [k, want] of Object.entries(CITED)) for (const l of LANGS) expect(numbers(text(l, k)), `${l} ${k}`).toEqual(want);
  });
  it('puts no other number in what it teaches, tells or counts', () => {
    const keys = Object.keys(WORDS.pl).filter(k => /^(teach|say|tip|count|med)\./.test(k));
    for (const k of keys) {
      if (k in CITED) continue;
      for (const l of LANGS) expect(numbers(text(l, k)), `${l} ${k}`).toEqual([]);
    }
  });
  it('keeps a number with its unit by a no-break space', () => {
    const units = /\d (?:m|kg|min|minut|minutes|Minuten|minuter|dni|days|Tage|dagar|godzin|hours|Stunden|timmars|miliard|billion|Milliard|miljard|bilion|trillion|Billion|biljon|%)/;
    for (const l of LANGS) for (const k of Object.keys(WORDS.pl)) expect(units.test(text(l, k)), `${l} ${k}`).toBe(false);
  });
});

describe('Każda komórka — the words', () => {
  it('never promises: no healing, no youth regained, no "energy field", no detox, in any language', () => {
    const bad = [/odmł[ao]d/i, /młodsz/i, /younger/i, /jünger/i, /yngre/i, /rejuven/i, /anti-?ag/i, /pole energ/i, /energy field/i, /energiefeld/i, /energifält/i, /detox|detoks/i, /uleczy|uzdrowi|wylecz/i, /\bheal(?!th)/i, /\bcure/i, /heilt/i, /läker/i, /aktywuj|activat|aktivier|aktiver/i];
    for (const l of LANGS) for (const k of Object.keys(WORDS.pl)) for (const re of bad) expect(re.test(text(l, k)), `${l} ${k} ${re}`).toBe(false);
  });
  it('says plainly what it is not — in the lobby card, the opening card and the registry tip', () => {
    const not: Readonly<Record<Lang, RegExp>> = { pl: /nie leczenie/, en: /not a treatment/, de: /keine Behandlung/, sv: /ingen behandling/ };
    for (const l of LANGS) {
      expect(text(l, 'panel.not'), l).toMatch(not[l]);
      expect(text(l, 'story.open2.text'), l).toMatch(not[l]);
      expect(String((CATALOGS[l] as Record<string, unknown>)['komorki.tip5']), l).toMatch(not[l]);
    }
  });
  it('says the brain-clearing picture comes from mice, and that it is contested', () => {
    expect(text('pl', 'teach.mozg')).toMatch(/myszy.*przeczy/);
    expect(text('en', 'teach.mozg')).toMatch(/mice.*disagrees/);
    expect(text('de', 'teach.mozg')).toMatch(/Mäusen.*widerspricht/);
    expect(text('sv', 'teach.mozg')).toMatch(/möss.*säger emot/);
  });
  it('corrects the "every seven years" myth rather than repeating it', () => {
    expect(text('pl', 'teach.tempo')).toMatch(/^To mit/);
    expect(text('en', 'teach.tempo')).toMatch(/myth/);
    expect(text('de', 'teach.tempo')).toMatch(/Mythos/);
    expect(text('sv', 'teach.tempo')).toMatch(/myt/);
  });
  it('thanks, in the closing card, in every language', () => {
    expect(text('pl', 'story.whole.text')).toBe('Dziękuję za każdą komórkę.');
    expect(text('en', 'story.whole.text')).toBe('Thank you for every cell.');
    expect(text('de', 'story.whole.text')).toBe('Danke für jede Zelle.');
    expect(text('sv', 'story.whole.text')).toBe('Tack för varje cell.');
  });
});

// ── the pictures: each world bakes and draws every scene at any growth, every number finite ─────
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
    roundRect(): void {}
    ellipse(): void {}
  };
}

/** A canvas that draws nothing and remembers any call given a number that is not finite. */
function fakeCtx(): { ctx: CanvasRenderingContext2D; bad: string[] } {
  const bad: string[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1 };
  const check = (name: string, args: unknown[]): void => {
    for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.map(String).join(', ')})`);
  };
  const ctx = new Proxy(state, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a: unknown[]) => (check(String(k), a), { addColorStop() {} });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 6 });
      if (k in t) return t[k];
      return (...a: unknown[]) => check(String(k), a);
    },
    set(t, k, v) {
      if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${String(k)} = ${v}`);
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, bad };
}

describe('Każda komórka — the pictures', () => {
  it('bakes and draws every scene at growths 0 … 1, in rest and after, without a stray number', () => {
    for (const [id, sc] of Object.entries(LIBRARY.scenes)) {
      const w = LIBRARY.worlds[sc.world];
      const { ctx, bad } = fakeCtx();
      w.bake(ctx, sc.variant ?? '', '');
      for (const g of [0, 0.01, 0.25, 0.5, 0.75, 0.99, 1]) {
        for (const [time, deep, after] of [[0, 0, 0], [3.7, 0.6, 0], [120.4, 1, 6]] as const) {
          const st: WorldState = { scene: id, g, deep, light: 0.6, growing: g > 0 && g < 1, time, after, breath: 0.4, blind: false, reduced: false, px: 3, look: '' };
          w.draw(ctx, st);
        }
        const f = w.focusAt?.(id, g) ?? sc.focus;
        expect(Number.isFinite(f[0]) && Number.isFinite(f[1]), `${id} focus at ${g}`).toBe(true);
        w.counter?.(id, g);
      }
      expect(bad, id).toEqual([]);
    }
  });
  it('dives between worlds of different depth through a place on the shallower picture', () => {
    expect(LIBRARY.portal?.('komorka', 'ksiega')).toEqual(expect.any(Array));
    expect(LIBRARY.portal?.('grzebienie', 'lancuch')).toEqual(expect.any(Array));
    expect(LIBRARY.portal?.('tempo', 'jelito')).toEqual(expect.any(Array));
    expect(LIBRARY.portal?.('hormon', 'mozg')).toEqual(expect.any(Array));
    // a portal point lies inside the shallower scene's view
    for (const [a, b] of [['komorka', 'ksiega'], ['grzebienie', 'lancuch'], ['tempo', 'jelito'], ['hormon', 'mozg'], ['nowe', 'grzebienie']] as const) {
      const p = LIBRARY.portal?.(a, b);
      if (!p) continue;
      const v = LIBRARY.scenes[a].view;
      expect(p[0] >= v.x && p[0] <= v.x + v.w && p[1] >= v.y && p[1] <= v.y + v.h, `${a} → ${b}`).toBe(true);
    }
  });
});
