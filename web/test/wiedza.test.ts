import { describe, expect, it } from 'vitest';
import de from '../src/content/wiedza/pfc-de';
import en from '../src/content/wiedza/pfc-en';
import pl from '../src/content/wiedza/pfc-pl';
import sv from '../src/content/wiedza/pfc-sv';
import { REFS } from '../src/content/wiedza/refs';
import { SECTION_IDS, type Article, type Point } from '../src/content/wiedza/types';
import { CATALOGS as SHELL } from '../src/i18n/shell';
import { parseRoute } from '../src/ui/router';
import { citeOrder, linkLabel, renderArticle, tieShortWords } from '../src/ui/wiedza';

const ARTICLES: Record<string, Article> = { pl, en, de, sv };

/** Every text of an article, with where it is, for the "no empty string" check. */
function texts(a: Article): [string, string][] {
  const out: [string, string][] = [
    ['kicker', a.kicker], ['title', a.title], ['lede', a.lede], ['band.title', a.band.title], ['band.intro', a.band.intro],
    ['band.fnirs.title', a.band.fnirs.title], ['band.fnirs.text', a.band.fnirs.text], ['band.eeg.title', a.band.eeg.title],
    ['band.eeg.text', a.band.eeg.text], ['limits.title', a.limits.title], ['reviewed', a.reviewed],
  ];
  const pts = (where: string, ps: readonly Point[]) => ps.forEach((p, i) => out.push([`${where}[${i}]`, p.text]));
  pts('band.points', a.band.points);
  pts('limits.points', a.limits.points);
  for (const s of a.sections) {
    out.push([`${s.id}.title`, s.title], [`${s.id}.short`, s.short], [`${s.id}.forYou`, s.forYou]);
    pts(`${s.id}.body`, s.body);
    pts(`${s.id}.points`, s.points);
  }
  return out;
}
const allPoints = (a: Article): Point[] => [...a.band.points, ...a.sections.flatMap(s => [...s.body, ...s.points]), ...a.limits.points];

describe('Wiedza: the sources', () => {
  it('each has a key once, a numeric PMID, a DOI, a year and a known type', () => {
    const keys = REFS.map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(REFS.map(r => r.pmid)).size).toBe(REFS.length);
    for (const r of REFS) {
      expect(r.pmid, r.key).toMatch(/^\d{6,9}$/);
      expect(r.doi, r.key).toMatch(/^10\.\d{4,9}\/\S+$/);
      expect(r.year, r.key).toBeGreaterThanOrEqual(1990);
      expect(r.year, r.key).toBeLessThanOrEqual(2026);
      expect(['meta', 'sysrev', 'review', 'study'], r.key).toContain(r.type);
      for (const f of [r.authors, r.title, r.journal]) expect(f.trim(), r.key).not.toBe('');
    }
  });

  it('leans on syntheses: meta-analyses and systematic reviews are the largest group, single studies few', () => {
    const n = (t: string) => REFS.filter(r => r.type === t).length;
    expect(n('meta') + n('sysrev')).toBeGreaterThan(REFS.length / 2);
    expect(n('study')).toBeLessThanOrEqual(5);
    expect(REFS.length).toBeGreaterThanOrEqual(30);
  });
});

describe('Wiedza: the article in four languages', () => {
  it('has the same section ids, in the same order, in every language', () => {
    for (const [l, a] of Object.entries(ARTICLES)) expect(a.sections.map(s => s.id), l).toEqual([...SECTION_IDS]);
  });

  it('has no empty string anywhere', () => {
    for (const [l, a] of Object.entries(ARTICLES)) {
      expect(texts(a).filter(([, s]) => !s.trim()).map(([w]) => `${l}.${w}`)).toEqual([]);
    }
  });

  it('cites only sources that exist, and every source is cited', () => {
    const known = new Set(REFS.map(r => r.key));
    for (const [l, a] of Object.entries(ARTICLES)) {
      const cited = allPoints(a).flatMap(p => p.refs);
      expect(cited.filter(k => !known.has(k)).map(k => `${l}: ${k}`)).toEqual([]);
      expect(REFS.filter(r => !cited.includes(r.key)).map(r => `${l}: ${r.key} never cited`)).toEqual([]);
    }
  });

  it('cites the same sources in each part as the Polish source text does', () => {
    const shape = (a: Article) => ({
      band: a.band.points.map(p => p.refs),
      sections: a.sections.map(s => [s.body.map(p => p.refs), s.points.map(p => p.refs), s.strength ?? null, s.link ?? null]),
      limits: a.limits.points.map(p => p.refs),
      reviewed: a.reviewed,
    });
    for (const l of ['en', 'de', 'sv']) expect(shape(ARTICLES[l]), l).toEqual(shape(pl));
  });

  it('gives every section 2–4 paragraphs and 3–6 research points, each point citing a source', () => {
    for (const [l, a] of Object.entries(ARTICLES)) {
      for (const s of a.sections) {
        expect(s.body.length, `${l}.${s.id}`).toBeGreaterThanOrEqual(2);
        expect(s.body.length, `${l}.${s.id}`).toBeLessThanOrEqual(4);
        expect(s.points.length, `${l}.${s.id}`).toBeGreaterThanOrEqual(3);
        expect(s.points.length, `${l}.${s.id}`).toBeLessThanOrEqual(6);
        for (const p of s.points) expect(p.refs.length, `${l}.${s.id}: ${p.text}`).toBeGreaterThan(0);
      }
      for (const p of a.band.points) expect(p.refs.length, `${l}.band: ${p.text}`).toBeGreaterThan(0);
    }
  });

  it('links only into views and games that exist', () => {
    for (const s of pl.sections) {
      if (!s.link) continue;
      expect(parseRoute(s.link).view, s.link).not.toBe('start');
      expect(linkLabel(s.link), s.link).not.toBe('');
    }
  });

  it('writes numbers the way each language does (decimal comma in pl, de, sv; point in en)', () => {
    const effect = (a: Article) => allPoints(a).map(p => p.text).join(' ').match(/g = −?0[.,]\d+/g) ?? [];
    expect(effect(pl).every(x => x.includes(','))).toBe(true);
    expect(effect(en).every(x => x.includes('.'))).toBe(true);
    for (const a of [de, sv]) expect(effect(a).every(x => x.includes(','))).toBe(true);
    expect(effect(pl).length).toBeGreaterThan(0);
  });
});

describe('Wiedza: a mind that helps the body (round 23, #wiedza/body)', () => {
  const body = (a: Article) => a.sections.find(s => s.id === 'body')!;
  const words = (a: Article) => { const s = body(a); return [s.title, s.short, s.forYou, ...s.body.map(p => p.text), ...s.points.map(p => p.text)].join(' '); };

  it('follows prayer, meditation and breath, opens at #wiedza/body and leads to the games', () => {
    expect(SECTION_IDS.indexOf('body')).toBe(SECTION_IDS.indexOf('prayer') + 1);
    expect(parseRoute('#wiedza/body')).toMatchObject({ view: 'wiedza', wiedza: 'body', hash: 'wiedza/body' });
    for (const a of Object.values(ARTICLES)) expect(body(a).link).toBe('#gry');
  });

  it('never promises: it says "never instead of treatment" and none of the words §24.3 keeps out', () => {
    const treatment: Record<string, RegExp> = { pl: /nigdy nie zastępują leczenia/, en: /never replace treatment/, de: /ersetzen nie eine Behandlung/, sv: /ersätter aldrig behandling/ };
    const never = /odmł|rejuvenat|verjüng|föryng|aktyw|activat|aktivier|aktiver|energ(y|ie)[- ]?(field|feld)|pole energ|vibrat|wibrac|schwingung|manifest|deto(x|ks)|entgift|wszechświat|universe|universum|programuj|subconscious|podświadom|unterbewusst|undermedvet/i;
    for (const [l, a] of Object.entries(ARTICLES)) {
      expect(body(a).forYou, l).toMatch(treatment[l]);
      expect(words(a).match(never), l).toBeNull();
    }
  });

  it('speaks Polish without gendered forms', () => {
    expect(words(pl).match(/łeś|łaś|\bgotow[ya]\b|\w\/a\b/)).toBeNull();
  });
});

describe('Wiedza: the view', () => {
  it('numbers sources by first citation and lists each once', () => {
    const order = citeOrder(pl);
    expect(new Set(order).size).toBe(order.length);
    expect(order.length).toBe(REFS.length);
    expect(order[0]).toBe(pl.band.points[0].refs[0]);
  });

  it('renders every section, a number for every citation and a PubMed link for every source', () => {
    const { el } = renderArticle(pl, REFS, () => {}, () => {}, 'pl');
    document.body.append(el);
    for (const id of SECTION_IDS) expect(el.querySelector(`#wz-${id}`), id).not.toBeNull();
    const cites = [...el.querySelectorAll<HTMLAnchorElement>('.wiedza-cite')];
    expect(cites.length).toBe(allPoints(pl).reduce((n, p) => n + p.refs.length, 0));
    for (const c of cites) expect(el.querySelector(`#wz-ref-${c.dataset.ref}`), c.dataset.ref).not.toBeNull();
    const links = [...el.querySelectorAll<HTMLAnchorElement>('.wiedza-reflinks a')];
    expect(links.filter(a => a.href.startsWith('https://pubmed.ncbi.nlm.nih.gov/')).length).toBe(REFS.length);
    for (const a of links) {
      expect(a.target).toBe('_blank');
      expect(a.rel).toBe('noopener');
    }
    expect(el.querySelectorAll('[style]').length).toBe(0);   // the CSP allows no inline styles
    el.remove();
  });

  it('ties Polish one-letter words to the next word, and leaves other languages alone', () => {
    expect(tieShortWords('Kora i zakręt w mózgu', 'pl')).toBe('Kora i zakręt w mózgu');
    expect(tieShortWords('i w ciele', 'pl')).toBe('i w ciele');
    expect(tieShortWords('a cat', 'en')).toBe('a cat');
  });

  it('has its interface texts in all four languages', () => {
    const keys = Object.keys(SHELL.pl).filter(k => k.startsWith('wiedza.'));
    expect(keys.length).toBeGreaterThan(20);
    for (const l of ['en', 'de', 'sv'] as const) for (const k of keys) expect((SHELL[l] as Record<string, unknown>)[k], `${l}.${k}`).toBeTruthy();
  });
});

describe('Wiedza: routes', () => {
  it('parses #wiedza and #wiedza/<part>, and keeps the old routes', () => {
    expect(parseRoute('#wiedza')).toMatchObject({ view: 'wiedza', nav: 'wiedza', wiedza: null, hash: 'wiedza' });
    expect(parseRoute('#wiedza/emotion')).toMatchObject({ view: 'wiedza', nav: 'wiedza', wiedza: 'emotion', hash: 'wiedza/emotion' });
    expect(parseRoute('#wiedza/refs')).toMatchObject({ view: 'wiedza', wiedza: 'refs' });
    expect(parseRoute('#wiedza/')).toMatchObject({ view: 'wiedza', wiedza: null, hash: 'wiedza' });
    expect(parseRoute('#sesje')).toMatchObject({ view: 'sesje', wiedza: null });
    expect(parseRoute('#balance')).toMatchObject({ view: 'balance', hash: 'trening/balance' });
  });
});
