import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogProblems } from '../src/i18n';
import { CATALOGS } from '../src/i18n/support';
import { CONTACTS, Support, supportSite, supportUrl, tipOfTheDay } from '../src/ui/support';

const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

/** The parts of index.html the support system fills: the ribbon and the windows at the end of the tabs. */
function mountPage(): void {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...[doc.getElementById('supportRibbon')!, ...doc.querySelectorAll('[data-support]')]
    .map(n => document.importNode(n, true)));
}

afterEach(() => document.body.replaceChildren());

describe('support and contact', () => {
  it('gives every text in all four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('sends Polish readers to buycoffee.to and everyone else to buymeacoffee.com', () => {
    expect(supportUrl('pl')).toBe('https://buycoffee.to/uriel');
    for (const l of ['en', 'de', 'sv'] as const) expect(supportUrl(l)).toBe('https://buymeacoffee.com/atd_uriel');
    expect(supportSite('pl')).toBe('buycoffee.to');
    expect(supportSite('de')).toBe('buymeacoffee.com');
  });

  it('links the author on Instagram, LinkedIn and Facebook over https', () => {
    expect(CONTACTS.map(c => c.url)).toEqual([
      'https://www.instagram.com/aleksanderdudek',
      'https://www.linkedin.com/in/aleksanderdudek/',
      'https://www.facebook.com/aleksander.tadeusz.dudek',
    ]);
  });

  it('keeps one thought for a whole day and moves on the next day', () => {
    expect(tipOfTheDay('2026-11-08')).toBe(tipOfTheDay('2026-11-08'));
    expect(tipOfTheDay('2026-11-09')).not.toBe(tipOfTheDay('2026-11-08'));
    const tenDays = Array.from({ length: 10 }, (_, i) => tipOfTheDay(`2026-12-${String(i + 1).padStart(2, '0')}`));
    expect(new Set(tenDays).size).toBe(10);
    expect(tipOfTheDay('not a day')).toBe('support.tip1');
  });

  it('has a window at the end of each of the six tabs, after where to buy a band', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tabs = ['start', 'trening', 'gry', 'sygnal', 'sesje', 'ustawienia'];
    for (const tab of tabs) {
      const last = doc.querySelector(`#view-${tab}`)!.lastElementChild!;
      expect(last.matches('[data-support]'), tab).toBe(true);
      expect(last.previousElementSibling!.matches('[data-buy]'), tab).toBe(true);
    }
    expect(doc.querySelectorAll('[data-support]')).toHaveLength(tabs.length);
    // the ribbon sticks with the app bar, above it
    expect(doc.querySelector('.topbar > .support-ribbon + .appbar')).not.toBeNull();
  });

  it('fills the ribbon and every window with the jar, the thought for today and the contact links', () => {
    mountPage();
    new Support().render('2026-11-08');
    const ribbon = document.getElementById('supportRibbon') as HTMLAnchorElement;
    expect(ribbon.href).toBe('https://buycoffee.to/uriel');   // tests run in Polish (test/setup.ts)
    expect(ribbon.querySelector('.ribbon-long')!.textContent).toBe('Emmanuel jest darmowy · postaw autorowi kawę');
    expect(ribbon.querySelector('.ribbon-short')!.textContent).toBe('Postaw autorowi kawę');   // a phone shows only the ask
    expect(ribbon.getAttribute('aria-label')).toContain('buycoffee.to');

    const windows = [...document.querySelectorAll<HTMLElement>('[data-support]')];
    expect(windows).toHaveLength(6);
    for (const [i, w] of windows.entries()) {
      expect(w.hidden).toBe(false);
      expect(document.getElementById(w.getAttribute('aria-labelledby')!)?.textContent).toBe('Pomóż Emmanuelowi trwać');
      expect(w.querySelector('.support-tip')!.textContent).toBe(CATALOGS.pl[tipOfTheDay('2026-11-08')]);
      expect(w.querySelector<HTMLAnchorElement>('.support-coffee')!.href).toBe('https://buycoffee.to/uriel');
      expect([...w.querySelectorAll<HTMLAnchorElement>('[data-contact]')].map(a => a.href)).toEqual(CONTACTS.map(c => c.url));
      for (const a of w.querySelectorAll('a')) {
        expect(a.target, `window ${i}`).toBe('_blank');
        expect(a.rel).toBe('noopener noreferrer');
        expect(a.getAttribute('aria-label')).toBeTruthy();
      }
    }
  });

  it('renders again only when the day changes', () => {
    mountPage();
    const support = new Support();
    support.render('2026-11-08');
    const tip = () => document.querySelector('.support-tip')!.textContent;
    const first = document.querySelector('.support-tip');
    support.render('2026-11-08');
    expect(document.querySelector('.support-tip')).toBe(first);
    support.render('2026-11-09');
    expect(tip()).toBe(CATALOGS.pl[tipOfTheDay('2026-11-09')]);
  });
});
