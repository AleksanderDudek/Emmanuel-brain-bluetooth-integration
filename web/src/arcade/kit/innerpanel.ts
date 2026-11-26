/**
 * "Ciało słucha" in a health visualisation's lobby card (DESIGN.md §27, kit/inner.ts): one section, one code for all
 * nine games (the eight on kit/healthlib and Każdy włos), its choices shared by all of them and kept on this device:
 *
 *   the lead       two lines — calm, the word and sleep reach the body; it supports, it does not replace treatment —
 *                  and the link to the Wiedza's section (#wiedza/body)
 *   the word       the switch "Słowo na wydech" (off: the rests keep the meditation's verse, as before)
 *   the intention  up to three of eight chips (a fourth drops the oldest; a muted note says so), and the player's own
 *                  sentence (≤ 80 characters, on this device only, never in a result)
 *   the cue        the word of peace: Pokój · Abba · Jezus · Maranatha · own (≤ 20 characters)
 *   the night      the switch "Przed snem"
 *
 * Built with h() and the app's classes (.switch, .seg, .btn, .field; the few `inner-` rules at the end of
 * styles.css).  A switch or a chip saves at once and redraws the section; typing saves without a redraw (the focus
 * stays in the field).
 */
import { lang as pageLang, translator, type Lang } from '../../i18n';
import { h } from '../../ui/dom';
import { CUES, CUE_OWN_MAX, INTENTS, MAX_INTENTS, OWN_MAX, cleanInner, loadInner, saveInner, toggleIntent, type Cue, type InnerPrefs } from './inner';
import { INNER, type InnerKey } from './inner-i18n';

const tr = translator<InnerKey>(INNER);

/** The section's words in a language (the page's by default; the tests ask for others). */
function words(l: Lang): (key: InnerKey) => string {
  if (l === pageLang) return key => tr(key);
  const cat = INNER[l] as Readonly<Record<InnerKey, string>>;
  return key => String(cat[key] ?? INNER.pl[key]);
}

export interface InnerPanelOpts {
  /** the language (the page's by default) */
  lang?: Lang;
  /** after a saved change (a game may redraw its own card) */
  onChange?: (p: InnerPrefs) => void;
}

/** The lobby's "Ciało słucha" section: a root element that redraws itself on a change. */
export function innerPanel(o: InnerPanelOpts = {}): HTMLElement {
  const t = words(o.lang ?? pageLang);
  const root = h('section', { class: 'inner-panel', 'aria-label': t('inner.title') });
  let p = loadInner();
  /** "own" chosen but no word typed yet: the field shows, the choice waits for a word */
  let cueOpen = p.cue === 'own';
  const save = (redraw: boolean): void => {
    saveInner(p);
    p = loadInner();
    o.onChange?.(p);
    if (!redraw) return;
    // the section is rebuilt: the control just used keeps the keyboard's focus (a switch, a chip)
    const doc = root.ownerDocument;
    const active = doc?.activeElement instanceof HTMLElement && root.contains(doc.activeElement) ? doc.activeElement : null;
    const key = active?.closest('[data-k]')?.getAttribute('data-k') ?? null;
    render();
    if (key) root.querySelector<HTMLElement>(`[data-k="${key}"]`)?.focus();
  };
  const button = (text: string, attrs: Record<string, unknown>, onClick: () => void): HTMLButtonElement => {
    const b = h('button', { class: 'btn inner-chip', type: 'button', ...attrs }, text);
    b.addEventListener('click', e => {
      e.preventDefault();
      onClick();
    });
    return b;
  };
  const toggle = (key: string, name: string, on: boolean, flip: (v: boolean) => void): HTMLElement => {
    const box = h('input', { type: 'checkbox', 'aria-label': name, 'data-k': key }) as HTMLInputElement;
    box.checked = on;
    box.addEventListener('change', () => {
      flip(box.checked);
      save(true);
    });
    return h('label', { class: 'switch' }, box, h('span', null, name));
  };
  const text = (max: number, value: string, placeholder: string, label: string, onInput: (v: string) => void): HTMLInputElement => {
    const inp = h('input', { type: 'text', maxlength: String(max), placeholder, 'aria-label': label, autocomplete: 'off', spellcheck: 'true', class: 'inner-text' }) as HTMLInputElement;
    inp.value = value;
    inp.addEventListener('input', () => onInput(inp.value));
    return inp;
  };

  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    root.append(
      h('div', { class: 'arcade-sub' }, t('inner.title')),
      h('p', null, t('inner.lead')),
      h('p', { class: 'inner-why' }, h('a', { href: '#wiedza/body', class: 'inner-link' }, t('inner.link'))),
      toggle('words', t('inner.words'), p.words, v => { p.words = v; }),
      h('p', { class: 'muted' }, t('inner.wordsNote')),
    );
    if (p.words) {
      // ── the intention: up to three chips, and an own sentence ──
      const chips = h('div', { class: 'seg inner-chips', role: 'group', 'aria-label': t('inner.intents') },
        INTENTS.map(i => button(t(`intent.${i}` as InnerKey), { 'aria-pressed': String(p.intents.includes(i)), 'data-intent': i, 'data-k': `intent-${i}` }, () => {
          toggleIntent(p, i);
          save(true);
        })));
      root.append(
        h('div', { class: 'inner-h' }, t('inner.intents')),
        chips,
        h('p', { class: 'muted' }, p.intents.length >= MAX_INTENTS ? `${t('inner.intentsNote')} ${t('inner.intentsMax')}` : t('inner.intentsNote')),
        h('label', { class: 'field inner-own' }, h('span', null, t('inner.own')),
          text(OWN_MAX, p.own, t('inner.ownPh'), t('inner.own'), v => {
            p.own = v;
            saveInner(p);
            o.onChange?.(loadInner());
          })),
        h('p', { class: 'muted' }, t('inner.ownNote')),
      );
      // ── the word of peace ──
      const cueOn = (c: Cue): boolean => (c === 'own' ? cueOpen || p.cue === 'own' : !cueOpen && p.cue === c);
      const cues = h('div', { class: 'seg inner-cues', role: 'radiogroup', 'aria-label': t('inner.cue') },
        CUES.map(c => button(c === 'own' ? t('inner.cueOwn') : t(`cue.${c}` as InnerKey), { role: 'radio', 'aria-checked': String(cueOn(c)), 'data-cue': c, 'data-k': `cue-${c}` }, () => {
          if (c === 'own') {
            cueOpen = true;
            if (p.cueOwn) p.cue = 'own';
          } else {
            cueOpen = false;
            p.cue = c;
          }
          save(true);
          if (c === 'own') root.querySelector<HTMLInputElement>('.inner-cue-own input')?.focus();
        })));
      root.append(h('div', { class: 'inner-h' }, t('inner.cue')), cues);
      if (cueOpen || p.cue === 'own') {
        root.append(h('label', { class: 'field inner-own inner-cue-own' }, h('span', null, t('inner.cueOwn')),
          text(CUE_OWN_MAX, p.cueOwn, t('inner.cueOwnPh'), t('inner.cueOwnPh'), v => {
            p.cueOwn = v;
            // a typed word is the cue; an emptied field keeps the last built-in one until a word comes
            p.cue = cleanInner({ ...p, cue: 'own' }).cue === 'own' ? 'own' : p.cue === 'own' ? 'peace' : p.cue;
            saveInner(p);
            o.onChange?.(loadInner());
          })),
        h('p', { class: 'muted' }, t('inner.local')));
      }
      root.append(h('p', { class: 'muted' }, t('inner.cueNote')));
    }
    // ── before sleep ──
    root.append(toggle('night', t('inner.night'), p.night, v => { p.night = v; }), h('p', { class: 'muted' }, t('inner.nightNote')));
  };
  render();
  return root;
}
