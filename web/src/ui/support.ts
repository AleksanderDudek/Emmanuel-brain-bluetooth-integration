/**
 * Supporting the author and reaching the author (DESIGN.md §12), the same system as in Teleo:
 *
 * - **the ribbon** (`#supportRibbon` in index.html): one gilded line at the top of every screen,
 *   one tap to the coffee jar.  Sessions and games run in full-screen layers above it, so it never
 *   shows while someone trains or plays;
 * - **the window** (`[data-support]` at the end of every tab): a thought for today (the same all
 *   day, a different one tomorrow, worth reading on its own), then the coffee, then the author's
 *   Instagram, LinkedIn and Facebook.
 *
 * The jar follows the interface language: Polish readers go to buycoffee.to (a Polish service),
 * everyone else to buymeacoffee.com.  Every link opens in a new tab and nothing
 * is loaded from those sites until it is tapped (no widgets, no tracking).
 */
import { lang, type Lang } from '../i18n';
import { t } from '../i18n/support';
import { dayKey } from '../arcade/kit/progress';
import { h, icon } from './dom';

export const SUPPORT_URLS: Readonly<Record<Lang, string>> = {
  pl: 'https://buycoffee.to/uriel',
  en: 'https://buymeacoffee.com/atd_uriel',
  de: 'https://buymeacoffee.com/atd_uriel',
  sv: 'https://buymeacoffee.com/atd_uriel',
};

export const supportUrl = (l: Lang): string => SUPPORT_URLS[l];
/** The jar's domain, as the note and the link's label name it. */
export const supportSite = (l: Lang): string => new URL(SUPPORT_URLS[l]).hostname.replace(/^www\./, '');

export interface ContactLink { id: 'instagram' | 'linkedin' | 'facebook'; name: string; url: string }

export const CONTACTS: readonly ContactLink[] = [
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/aleksanderdudek' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/in/aleksanderdudek/' },
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/aleksander.tadeusz.dudek' },
];

const TIPS = [
  'support.tip1', 'support.tip2', 'support.tip3', 'support.tip4', 'support.tip5',
  'support.tip6', 'support.tip7', 'support.tip8', 'support.tip9', 'support.tip10',
] as const;

/** The thought for a local day ("YYYY-MM-DD"): the same all day long, the next one tomorrow. */
export function tipOfTheDay(day: string): (typeof TIPS)[number] {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const i = Number.isFinite(days) ? days : 0;
  return TIPS[((i % TIPS.length) + TIPS.length) % TIPS.length]!;
}

const external = { target: '_blank', rel: 'noopener noreferrer' };

function window_(day: string, n: number): Node[] {
  const titleId = `supportTitle${n}`;
  const site = supportSite(lang);
  return [
    h('div', { class: 'support-grid' },
      h('div', { class: 'support-thought' },
        h('p', { class: 'support-rubric' }, t('support.rubric')),
        h('p', { class: 'support-tip' }, t(tipOfTheDay(day)))),
      h('div', { class: 'support-ask' },
        h('h2', { id: titleId }, t('support.title')),
        h('p', null, t('support.line')),
        h('a', { class: 'support-coffee', href: supportUrl(lang), ...external, 'aria-label': t('support.aria', { site }) },
          icon('coffee'), t('support.button')),
        h('p', { class: 'support-note' }, t('support.note', { site })))),
    h('div', { class: 'contact' },
      h('div', { class: 'contact-text' },
        h('h3', null, t('contact.title')),
        h('p', null, t('contact.line'))),
      h('ul', { class: 'contact-links' }, CONTACTS.map(c => h('li', null,
        h('a', { href: c.url, ...external, 'data-contact': c.id, 'aria-label': t('contact.aria', { site: c.name }) },
          icon(c.id), h('span', null, c.name)))))),
  ];
}

export class Support {
  private day = '';

  /** Fill the ribbon and every window; again only when the day has changed (the thought moves on at midnight). */
  render(day = dayKey()): void {
    if (day === this.day) return;
    this.day = day;
    const ribbon = document.getElementById('supportRibbon');
    if (ribbon instanceof HTMLAnchorElement) {
      ribbon.href = supportUrl(lang);
      ribbon.setAttribute('aria-label', t('support.aria', { site: supportSite(lang) }));
      ribbon.replaceChildren(icon('coffee'), h('span', { class: 'ribbon-long' }, t('support.ribbon')),
        h('span', { class: 'ribbon-short' }, t('support.ribbonShort')), icon('caret', 'caret'));
    }
    document.querySelectorAll<HTMLElement>('[data-support]').forEach((root, n) => {
      root.replaceChildren(...window_(day, n));
      root.setAttribute('aria-labelledby', `supportTitle${n}`);
      root.hidden = false;
    });
  }
}
