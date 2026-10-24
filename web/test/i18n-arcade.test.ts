import { afterEach, describe, expect, it, vi } from 'vitest';
import { LANGS, catalogProblems, type Lang, type Msg } from '../src/i18n';
import { CATALOGS, t } from '../src/i18n/arcade';
import { ARCADE } from '../src/arcade/registry';

const texts = (m: Msg): string[] => (typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string'));
const all = (l: Lang): [string, string][] => Object.entries(CATALOGS[l]).flatMap(([k, m]) => texts(m).map(s => [k, s] as [string, string]));

/** The arcade's texts in another language: the language is settled when the modules load. */
async function inLang(l: Lang) {
  localStorage.setItem('brainlink.lang', l);
  vi.resetModules();
  const cat = await import('../src/i18n/arcade');
  const reg = await import('../src/arcade/registry');
  return { t: cat.t, ARCADE: reg.ARCADE };
}

describe('the arcade catalog', () => {
  afterEach(() => { localStorage.setItem('brainlink.lang', 'pl'); });

  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('leaves no Polish, no old name and no technique-for-a-band in the other languages', () => {
    for (const l of LANGS) {
      for (const [k, s] of all(l)) {
        expect(s, `${l}.${k}`).not.toMatch(/BrainLink|Frontosaurus|Synapster|fNIRS|EEG|narzędzi/);
        if (l !== 'pl') expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
      }
    }
  });

  it('quotes in each language’s own marks', () => {
    const quoted = (l: Lang) => all(l).map(([, s]) => s).filter(s => /[„“”"]/.test(s));
    for (const s of quoted('pl')) expect(s).toMatch(/„[^„”"“]+”/);
    for (const s of quoted('de')) expect(s).toMatch(/„[^„”"“]+“/);
    for (const s of quoted('sv')) expect(s).toMatch(/”[^„”"“]+”/);
    for (const s of quoted('en')) expect(s).toMatch(/“[^„”"“]+”/);
  });

  it('suggests strategies in the tips, never to concentrate harder', () => {
    for (const l of LANGS) {
      for (const [k, s] of all(l).filter(([k]) => /\.(tip|how)\d$/.test(k))) {
        expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
  });

  it('counts days in Polish with all three plural forms', () => {
    expect(t('sum.streak', { n: 1 })).toBe('Seria 1 dzień');
    expect(t('sum.streak', { n: 3 })).toBe('Seria 3 dni');
    expect(t('sum.streak', { n: 12 })).toBe('Seria 12 dni');
    expect(t('sum.streak', { n: 22 })).toBe('Seria 22 dni');
  });

  it('keeps the Polish registry texts (the source)', () => {
    expect(ARCADE.map(a => a.title)).toEqual(['Geoda', 'Latarnik', 'Motylarnia', 'Arka', 'Urodzaj', 'Wzlot', 'Glina', 'Źródła']);
    expect(ARCADE.map(a => a.unit)).toEqual(['ct', 'łodzi', 'mm', 'par', 'pkt', 'm', 'cm', 'dzbanów']);
    for (const a of ARCADE) {
      expect(a.how).toHaveLength(3);
      expect(a.tips.length).toBeGreaterThanOrEqual(5);
      for (const s of [a.title, a.tagline, a.text, ...a.how, ...a.tips]) expect(s.trim()).not.toBe('');
    }
  });

  it('gives the games the glossary’s titles and the runner its words in English, German and Swedish', async () => {
    const titles: Record<Exclude<Lang, 'pl'>, string[]> = {
      en: ['Geode', 'Lighthouse Keeper', 'Butterfly House', 'The Ark', 'Harvest', 'Updraft', 'Clay', 'Wellsprings'],
      de: ['Geode', 'Leuchtturmwärter', 'Schmetterlingshaus', 'Die Arche', 'Ernte', 'Aufwind', 'Töpferton', 'Quellen'],
      sv: ['Geod', 'Fyrvaktaren', 'Fjärilshuset', 'Arken', 'Skörd', 'Uppvind', 'Lera', 'Källorna'],
    };
    const words = {
      en: { streak: '2-day streak', best: 'Best: 12 boats', parts: 'Commitment 40/70 · performance 9/30', again: 'Play again' },
      de: { streak: 'Serie: 2 Tage', best: 'Bestwert: 12 Boote', parts: 'Engagement 40/70 · Leistung 9/30', again: 'Nochmal' },
      sv: { streak: 'Svit: 2 dagar', best: 'Rekord: 12 båtar', parts: 'Engagemang 40/70 · prestation 9/30', again: 'Spela igen' },
    };
    for (const l of ['en', 'de', 'sv'] as const) {
      const x = await inLang(l);
      expect(x.ARCADE.map(a => a.title.replace(/\u00ad/g, '')), l).toEqual(titles[l]);
      expect(x.t('sum.streak', { n: 2 }), l).toBe(words[l].streak);
      expect(x.t('sum.best', { score: 12, unit: x.ARCADE[1].unit }), l).toBe(words[l].best);
      expect(x.t('sum.dayParts', { commitment: 40, performance: 9 }), l).toBe(words[l].parts);
      expect(x.t('sum.again'), l).toBe(words[l].again);
    }
    expect((await inLang('en')).t('sum.streak', { n: 1 })).toBe('1-day streak');
    expect((await inLang('de')).t('lobby.kicker2', { a: 'Mendi', b: 'HALO' })).toBe('Spiel · Mendi oder HALO');
    // German and Swedish keep the number and its % together with a no-break space
    expect((await inLang('sv')).t('sum.pct', { v: '+1,5' })).toBe('+1,5\u00a0%');
    expect((await inLang('en')).t('sum.pct', { v: '+1.5' })).toBe('+1.5%');
  });
});
