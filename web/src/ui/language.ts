/**
 * Choosing the app's language: a card in Ustawienia and a compact row on the first-run Start
 * (every `[data-lang-pick]` container).  The choice is saved and the app reloads in it; when a
 * band is connected, a recording runs or a session is in progress, it asks first (in the current
 * language), then saves the recording and releases the band before the reload.
 */
import { lang, LANG_NAMES, LANGS, saveLang, type Lang } from '../i18n';
import { t } from '../i18n/shell';
import { h } from './dom';

/** What a reload would interrupt right now. */
export interface LanguageState { band: boolean; recording: boolean; session: boolean }

export interface LanguageDeps {
  state: () => LanguageState;
  /** stop what can stop cleanly (save the recording, release the band) right before the reload */
  release: () => Promise<void>;
}

/** The question to ask before switching to `to`, or null when nothing would be lost. */
export function switchQuestion(to: Lang, s: LanguageState): string | null {
  if (!s.band && !s.recording && !s.session) return null;
  return [t('lang.restarts'), s.band ? t('lang.bandOff') : '', s.recording ? t('common.recStops') : '',
          s.session ? t('lang.sessionLost') : '', t('lang.ask', { name: LANG_NAMES[to] })].filter(Boolean).join(' ');
}

/** The address that loads the app in the saved language (null: just reload): a `?lang=` would win over the choice, so it goes. */
export function reloadTarget(href: string): string | null {
  const url = new URL(href);
  const parts = url.search.replace(/^\?/, '').split('&').filter(Boolean);
  const kept = parts.filter(p => decodeURIComponent(p.split('=')[0]) !== 'lang');
  if (kept.length === parts.length) return null;
  url.search = kept.join('&');   // the other parameters exactly as they were (?debug stays ?debug)
  return url.href;
}

export class LanguagePicker {
  private busy = false;

  constructor(private readonly deps: LanguageDeps) {
    for (const root of document.querySelectorAll<HTMLElement>('[data-lang-pick]')) {
      const row = root.dataset.langPick === 'row';   // the compact row on Start; otherwise the buttons of the card
      root.replaceChildren(...(row ? [globe()] : []), ...LANGS.map(l => h('button', {
        type: 'button', class: row ? 'lang-btn' : 'btn', lang: l, 'aria-current': l === lang ? 'true' : null,
        on: { click: () => void this.choose(l) },
      }, LANG_NAMES[l])));
    }
  }

  async choose(l: Lang): Promise<void> {
    if (l === lang || this.busy) return;
    const question = switchQuestion(l, this.deps.state());
    if (question && !confirm(question)) return;
    this.busy = true;
    await this.deps.release().catch(e => console.error(e));
    saveLang(l);
    const target = reloadTarget(location.href);
    if (target) location.replace(target);
    else location.reload();
  }
}

/** The globe icon of the sprite (an SVG element needs its namespace: `h()` makes HTML ones). */
function globe(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', '#i-globe');
  svg.append(use);
  return svg;
}
