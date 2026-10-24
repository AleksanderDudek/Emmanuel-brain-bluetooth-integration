import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HubStatus } from '../src/hub';
import { applyTexts, catalogProblems, detectLang, type Msg } from '../src/i18n';
import { CATALOGS as PAGE, hasPageText, pageText } from '../src/i18n/page';
import { CATALOGS as SHELL } from '../src/i18n/shell';
import { ACTIVITIES, bandTags, polishNote, whyNot } from '../src/ui/activities';
import { BuyBox, SHOP_URL, buyMode } from '../src/ui/buy';
import { reloadTarget, switchQuestion } from '../src/ui/language';

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const page = () => new DOMParser().parseFromString(html, 'text/html');
const activity = (id: string) => ACTIVITIES.find(a => a.id === id)!;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('the shell catalogs', () => {
  it('give every text in all four languages, with the same placeholders and the plural forms each needs', () => {
    expect(catalogProblems(PAGE)).toEqual([]);
    expect(catalogProblems(SHELL)).toEqual([]);
  });

  it('cover every data-i18n key of index.html, and index.html uses every page text', () => {
    const doc = page();
    const used = new Set<string>();
    for (const el of doc.querySelectorAll<HTMLElement>('[data-i18n]')) used.add(el.dataset.i18n!);
    for (const el of doc.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
      for (const pair of el.dataset.i18nAttr!.split(/\s+/)) used.add(pair.split(':')[1]);
    }
    expect([...used].filter(k => !hasPageText(k))).toEqual([]);
    // app.docTitle goes to document.title (main.ts), not through an attribute
    expect(Object.keys(PAGE.pl).filter(k => !used.has(k) && k !== 'app.docTitle')).toEqual([]);
  });

  it('fill index.html without a warning, and in Polish leave its texts as they were', () => {
    const warn = vi.spyOn(console, 'warn');
    const doc = page();
    const before = [...doc.querySelectorAll('[data-i18n]')].map(el => el.textContent);
    applyTexts(doc, pageText, hasPageText);
    expect(warn).not.toHaveBeenCalled();
    expect([...doc.querySelectorAll('[data-i18n]')].map(el => el.textContent)).toEqual(before);
  });

  it('name the app Emmanuel and keep the earlier names out of player-facing texts', () => {
    const textsOf = (cats: Readonly<Record<string, Readonly<Record<string, Msg>>>>): string[] => Object.values(cats)
      .flatMap(cat => Object.values(cat)).flatMap(m => (typeof m === 'string' ? [m] : [m.one, m.few, m.many, m.other].filter((x): x is string => !!x)));
    const all = [...textsOf(PAGE), ...textsOf(SHELL)].join('\n');
    expect(all).not.toMatch(/BrainLink|Frontosaurus|Synapster/);
    expect(PAGE.en['app.docTitle']).toContain('Emmanuel');
    expect(html).toContain('Emmanu<span>el</span>');
    expect(html).not.toMatch(/BrainLink|Frontosaurus|Synapster/);
    // the tagline in each language; in German never „Gott mit uns“ (the Wehrmacht's belt-buckle motto)
    expect([SHELL.pl, SHELL.en, SHELL.de, SHELL.sv].map(c => c['app.tagline'])).toEqual(['Bóg z nami.', 'God with us.', 'Gott ist mit uns.', 'Gud är med oss.']);
    expect(all).not.toMatch(/Gott\s+mit\s+uns/i);
  });
});

describe('detectLang', () => {
  it('takes ?lang= first, then the saved choice, then the browser, else English', () => {
    expect(detectLang('?lang=de', 'sv', ['pl-PL'])).toBe('de');
    expect(detectLang('?lang=xx', 'sv', ['pl-PL'])).toBe('sv');
    expect(detectLang('', null, ['de-AT', 'en-US'])).toBe('de');
    expect(detectLang('', 'nope', ['fr-FR', 'sv-FI'])).toBe('sv');
    expect(detectLang('', null, ['nb-NO'])).toBe('sv');
    expect(detectLang('', null, ['fr-FR', 'es'])).toBe('en');
    expect(detectLang('', null, [])).toBe('en');
  });
});

describe('device-first naming', () => {
  it('tags cards with bands, not techniques', () => {
    expect(bandTags(activity('focus'))).toEqual(['Mendi', 'HALO']);
    expect(bandTags(activity('balance'))).toEqual(['Mendi']);
    expect(bandTags(activity('holyholyholy'))).toEqual(['Mendi', 'bez opaski też']);
  });

  it('with HALO chosen, HolyHolyHoly says which band it reads without mixing in a technique', () => {
    const why = whyNot(activity('holyholyholy'), 'eeg')!;
    expect(why).toBe('Ta gra czyta tylko opaskę Mendi. Z HALO zagrasz bez opaski — albo przełącz opaskę u góry na Mendi.');
    expect(whyNot(activity('holyholyholy3d'), 'eeg', true)).toBe('Z HALO zagrasz bez opaski.');
    expect(whyNot(activity('balance'), 'eeg')).toContain('Mendi');
    for (const a of ACTIVITIES) {
      for (const short of [false, true]) expect(whyNot(a, 'eeg', short) ?? '').not.toMatch(/EEG|fNIRS/);
      expect(whyNot(a, 'fnirs')).toBeNull();
      expect(whyNot(a, null)).toBeNull();
    }
  });

  it('marks the Polish-only games only on pages in other languages', () => {
    expect(activity('holyholyholy').polishOnly).toBe(true);
    expect(polishNote(activity('holyholyholy'))).toBeNull();   // the tests run in Polish
    expect(SHELL.en['tag.inPolish']).toBe('In Polish');
    expect(SHELL.de['tag.inPolish']).toBe('Auf Polnisch');
    expect(SHELL.sv['tag.inPolish']).toBe('På polska');
  });
});

const status = (over: Partial<HubStatus> & { streaming?: boolean } = {}): HubStatus => ({
  tool: null, source: 'off', recording: null,
  device: { kind: 'mendi', connected: !!over.streaming, streaming: !!over.streaming, reconnecting: false, name: null, battery: null, charging: false, stale: false },
  signal: { reliable: false, reason: 'off', progress: 0, quality: null, warning: null, detail: null, heartRate: null },
  ...over,
});

describe('where to buy', () => {
  const mount = (n: number) => {
    for (let i = 0; i < n; i++) {
      const aside = document.createElement('aside');
      aside.setAttribute('data-buy', '');
      aside.hidden = true;
      document.body.append(aside);
    }
    return [...document.querySelectorAll<HTMLElement>('[data-buy]')];
  };

  it('is a card until a real band streams, then one line', () => {
    expect(buyMode(status())).toBe('card');
    expect(buyMode(status({ tool: 'fnirs', source: 'simulator' }))).toBe('card');
    expect(buyMode(status({ tool: 'fnirs', source: 'off' }))).toBe('card');
    expect(buyMode(status({ tool: 'fnirs', source: 'device' }))).toBe('card');
    expect(buyMode(status({ tool: 'eeg', source: 'device', streaming: true }))).toBe('line');
  });

  it('shows both bands with the makers\' shops in a new tab, the chosen band first, no prices', () => {
    const roots = mount(6);
    const box = new BuyBox();
    box.render(status({ tool: 'eeg', source: 'simulator' }));
    for (const root of roots) {
      expect(root.hidden).toBe(false);
      expect(root.className).toBe('buy card');
      const bands = [...root.querySelectorAll<HTMLElement>('.buy-band')];
      expect(bands.map(b => b.dataset.band)).toEqual(['eeg', 'fnirs']);
      expect(bands[0].classList.contains('on')).toBe(true);
      expect(bands[1].classList.contains('on')).toBe(false);
      const links = [...root.querySelectorAll('a')];
      expect(links.map(a => a.getAttribute('href'))).toEqual([SHOP_URL.eeg, SHOP_URL.fnirs]);
      for (const a of links) {
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      }
      expect(root.textContent).toContain('nic nie zarabia');
      expect(root.textContent).not.toMatch(/[$€£]|\bzł\b|\bkr\b|SEK|PLN|EUR|USD/);
    }
    expect(SHOP_URL).toEqual({ fnirs: 'https://www.mendi.io/products/mendi', eeg: 'https://www.brainaccess.ai/shop/brainaccess-halo/' });

    box.render(status());
    expect([...roots[0].querySelectorAll<HTMLElement>('.buy-band')].map(b => b.dataset.band)).toEqual(['fnirs', 'eeg']);
    expect(roots[0].querySelector('.buy-band.on')).toBeNull();

    box.render(status({ tool: 'fnirs', source: 'device', streaming: true }));
    for (const root of roots) {
      expect(root.className).toBe('buy line');
      expect([...root.querySelectorAll('a')].map(a => [a.getAttribute('href'), a.getAttribute('rel')])).toEqual([
        [SHOP_URL.fnirs, 'noopener noreferrer'], [SHOP_URL.eeg, 'noopener noreferrer']]);
    }
  });
});

describe('the language picker', () => {
  it('asks only when switching would cut something off, and says what', () => {
    expect(switchQuestion('de', { band: false, recording: false, session: false })).toBeNull();
    const q = switchQuestion('de', { band: true, recording: true, session: false })!;
    expect(q).toContain('Deutsch');
    expect(q).toContain('rozłączona');
    expect(q).toContain('nagranie');
    expect(q).not.toContain('sesja');
    expect(switchQuestion('sv', { band: false, recording: false, session: true })).toContain('sesja');
  });

  it('drops ?lang= so the saved choice applies after the reload', () => {
    expect(reloadTarget('http://x/app/?debug&lang=de#gry')).toBe('http://x/app/?debug#gry');
    expect(reloadTarget('http://x/app/?lang=en')).toBe('http://x/app/');
    expect(reloadTarget('http://x/app/#start')).toBeNull();
  });
});
