/**
 * The lobby's "Muzyka" section of Złote serce (DOM, built with h(), mobile first):
 *
 *   the way       tracks with the ambient / the ambient only / silence (three radio buttons, 44 px), each with a line
 *                 that says what it means
 *   consent       with tracks chosen and no consent yet, a clear box: the tracks play from YouTube
 *                 (youtube-nocookie.com), when one starts YouTube receives the device's IP address and may show an
 *                 advert, nothing connects before that, offline the ambient plays alone — "Włącz utwory z YouTube" or
 *                 "Tylko muzyka tła"; afterwards a small link withdraws it
 *   what fits     for the lobby's chosen length (#arcadeLen, re-read when it changes): how many tracks fit whole, from
 *                 the same plan the session makes (kit/playlist.ts), or why none does
 *   the list      the founder's eleven in his order, then the player's own: a switch, the title, the performer and a
 *                 note on what it is, the length (dimmed with "nie zmieści się w 5 min" when it cannot fit — never
 *                 hidden), a "▶ YouTube" link to listen first on YouTube itself; all / none; on a phone the first six
 *                 and "Pokaż wszystkie"
 *   own tracks    a YouTube link, a length the player types ("4:39"), an optional name; ≤ 12, each removable, kept on
 *                 this device only
 *
 * No request goes to YouTube from here: no thumbnails, no embeds, only links that open YouTube in a new tab.  Every
 * change saves at once (`save()`); the section redraws itself, never the lobby around it.
 */
import { fmtNum } from '../../../i18n';
import { MAX_SESSION_SEC, SESSION_MINUTES } from '../../../settings';
import { h } from '../../../ui/dom';
import { longestFit, mmss, planMusic, type Recent, type Track } from '../../kit/playlist';
import { watchUrl } from '../../kit/youtube';
import { mulberry32 } from '../../../core/random';
import { t } from './i18n';
import {
  MODES, OWN_MAX, activeTracks, addOwn, isOn, removeOwn, setAll, setMode, setOn, tooLong, type MusicPrefs,
} from './prefs';
import { BUILTIN } from './tracks';

/** "5", "1,5" — minutes for a line of text. */
const minutes = (sec: number): string => fmtNum(sec / 60, sec % 60 ? 1 : 0);

export type Fit =
  | { kind: 'empty' }
  | { kind: 'none'; from: number }
  | { kind: 'never' }
  | { kind: 'some'; lo: number; hi: number };

/**
 * How many of `tracks` fit a session of `total` s — the least and the most over many draws of the same plan the
 * session makes — or why none does (none on, none short enough now — and from which length one would — or none
 * short enough for any session).
 */
export function fitOf(tracks: readonly Track[], total: number, recent: Recent = {}): Fit {
  if (!tracks.length) return { kind: 'empty' };
  const shortest = Math.min(...tracks.map(x => x.sec));
  if (shortest > longestFit(total)) {
    const from = SESSION_MINUTES.find(m => longestFit(m * 60) >= shortest && m * 60 > total);
    return from ? { kind: 'none', from } : { kind: 'never' };
  }
  let lo = Infinity, hi = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const n = planMusic({ total, tracks, rng: mulberry32(seed * 7919), recent, samples: 80 }).slots.length;
    lo = Math.min(lo, n);
    hi = Math.max(hi, n);
  }
  return { kind: 'some', lo: Math.max(1, lo), hi: Math.max(1, hi) };
}

/** The fit in one line of text. */
export function fitLine(f: Fit, total: number): string {
  const min = minutes(total);
  switch (f.kind) {
    case 'empty': return t('fit.empty');
    case 'never': return t('fit.never', { max: MAX_SESSION_SEC / 60 });
    case 'none': return t('fit.none', { min, from: f.from });
    default: return f.lo === f.hi ? t('fit.exact', { min, n: f.hi }) : t('fit.range', { min, lo: f.lo, n: f.hi });
  }
}

/** A row's words: the title, who sings, what it is. */
interface Row { id: string; sec: number; title: string; by: string; own: boolean }

function rows(m: MusicPrefs): Row[] {
  return [
    ...BUILTIN.map(b => ({ id: b.id, sec: b.sec, title: b.titleKey ? `${t(b.titleKey)} (${b.title})` : b.title, by: [b.by, b.note ? t(b.note) : ''].filter(Boolean).join(' · '), own: false })),
    ...m.own.map(o => ({ id: o.id, sec: o.sec, title: o.title, by: t('list.own'), own: true })),
  ];
}

/** The rows shown before "Pokaż wszystkie" on a phone. */
const FIRST = 6;

/** The section whose fit follows the lobby's length (the latest one built). */
let refresh: (() => void) | null = null;
let hooked: HTMLElement | null = null;
function hookLength(): void {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('arcadeLen');
  if (!box || box === hooked) return;
  hooked = box;
  // the lobby marks the chosen length on its button first; this runs as the click bubbles up
  box.addEventListener('click', () => refresh?.());
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/**
 * The lobby's music section.  `sessionSec()` reads the lobby's chosen length (as serce/panel.ts sessionSec does),
 * so the section can say what fits; `save()` after every change.
 */
export function musicPanel(m: MusicPrefs, save: () => void, sessionSec: () => number): HTMLElement {
  const root = h('section', { class: 'kin-music', 'aria-label': t('head') });
  // the section's own state between redraws (not saved): the list opened, the add form opened, its last message
  let open = false, adding = false, said = '';
  const total = (): number => {
    const s = Number(sessionSec());
    return Number.isFinite(s) && s > 0 ? s : 300;
  };
  const changed = (focus?: string): void => {
    save();
    render();
    if (focus) root.querySelector<HTMLElement>(`[data-k="${focus}"]`)?.focus({ preventScroll: true });
  };

  const fitEl = h('p', { class: 'kin-music-fit', 'aria-live': 'polite' });
  let listEl: HTMLElement | null = null;
  const marks = (): void => {
    const sec = total();
    fitEl.textContent = fitLine(fitOf(activeTracks(m), sec, m.recent), sec);
    if (!listEl) return;
    const room = longestFit(sec);
    for (const row of listEl.querySelectorAll<HTMLElement>('.kin-music-row')) {
      const len = Number(row.dataset.sec);
      const warn = row.querySelector<HTMLElement>('.kin-music-warn')!;
      const never = tooLong(len);
      const no = never || len > room;
      row.classList.toggle('nofit', no);
      warn.textContent = never ? t('list.tooLong', { max: MAX_SESSION_SEC / 60 }) : no ? t('list.noFit', { min: minutes(sec) }) : '';
      warn.hidden = !no;
    }
  };

  const render = (): void => {
    const out: (HTMLElement | null)[] = [];
    out.push(h('div', { class: 'arcade-sub' }, t('head')));

    // ── the way ──
    const ways = h('div', { class: 'kin-music-modes', role: 'radiogroup', 'aria-label': t('mode.label') },
      MODES.map(mode => button(t(`mode.${mode}`), () => { setMode(m, mode); changed(`mode-${mode}`); }, m.mode === mode ? 'btn on' : 'btn', {
        role: 'radio', 'aria-checked': String(m.mode === mode), 'data-k': `mode-${mode}`,
      })));
    out.push(ways, h('p', { class: 'kin-music-note' }, t(`mode.${m.mode}Note`)));

    listEl = null;
    if (m.mode === 'tracks') {
      // ── consent ──
      if (!m.youtube) {
        out.push(h('div', { class: 'kin-music-consent', role: 'group', 'aria-label': t('consent.head') },
          h('b', null, t('consent.head')),
          h('p', null, t('consent.text')),
          h('div', { class: 'kin-music-consent-row' },
            button(t('consent.yes'), () => { m.youtube = true; changed('withdraw'); }, 'btn primary', { 'data-k': 'consent' }),
            button(t('mode.ambient'), () => { setMode(m, 'ambient'); changed('mode-ambient'); }, 'btn'))));
      }

      // ── what fits ──
      out.push(fitEl);

      // ── the list ──
      const list = rows(m);
      const on = list.filter(r => isOn(m, r.id)).length;
      out.push(h('div', { class: 'kin-music-head' },
        h('span', { class: 'kin-music-count' }, `${t('list.head')} · ${t('list.count', { on, all: list.length })}`),
        button(t('list.all'), () => { setAll(m, true); changed('all'); }, 'btn ghost', { 'aria-label': t('list.allLabel'), 'data-k': 'all', disabled: on === list.length }),
        button(t('list.none'), () => { setAll(m, false); changed('none'); }, 'btn ghost', { 'aria-label': t('list.noneLabel'), 'data-k': 'none', disabled: on === 0 })));
      const ul = h('ul', { class: open ? 'kin-music-list open' : 'kin-music-list' });
      list.forEach((r, i) => ul.append(rowEl(m, r, i >= FIRST, changed, text => { adding = true; said = text; })));
      listEl = ul;
      out.push(ul);
      if (list.length > FIRST + 1) {
        out.push(button(open ? t('list.less') : t('list.more', { n: list.length }), () => { open = !open; render(); root.querySelector<HTMLElement>('[data-k="more"]')?.focus({ preventScroll: true }); },
          'btn ghost kin-music-all', { 'aria-expanded': String(open), 'data-k': 'more' }));
      }
      out.push(h('p', { class: 'kin-music-note' }, t('list.mantras')));

      // ── own tracks ──
      out.push(addForm(m, adding, said, (o, s) => { adding = o; said = s; }, changed));

      if (m.youtube) {
        out.push(h('p', { class: 'kin-music-note' }, t('consent.on'), ' ',
          button(t('consent.withdraw'), () => { m.youtube = false; changed('consent'); }, 'kin-music-link', { 'data-k': 'withdraw' })));
      }
    }
    root.replaceChildren(...out.filter((x): x is HTMLElement => x !== null));
    marks();
  };

  render();
  refresh = () => { if (root.isConnected) marks(); };
  hookLength();
  return root;
}

/** One track: switch · title / performer · note / the warning · length / ▶ YouTube (· remove, for an own one). */
function rowEl(m: MusicPrefs, r: Row, extra: boolean, changed: (focus?: string) => void, say: (text: string) => void): HTMLElement {
  const on = isOn(m, r.id);
  const sw = button('', () => { setOn(m, r.id, !on); changed(`sw-${r.id}`); }, 'kin-music-sw', {
    role: 'switch', 'aria-checked': String(on), 'aria-label': `${r.title} — ${r.by}`, 'data-k': `sw-${r.id}`,
  });
  const text = h('div', { class: 'kin-music-text' },
    h('span', { class: 'kin-music-name' }, r.title),
    h('span', { class: 'kin-music-by' }, r.by),
    h('span', { class: 'kin-music-warn', hidden: true }));
  const side = h('div', { class: 'kin-music-side' },
    h('span', { class: 'kin-music-len mono' }, mmss(r.sec)),
    h('a', { class: 'kin-music-yt', href: watchUrl(r.id), target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('list.listenLabel', { title: r.title }) }, t('list.listen')));
  const cls = ['kin-music-row', on ? '' : 'off', extra ? 'kin-music-extra' : '', r.own ? 'own' : ''].filter(Boolean).join(' ');
  const li = h('li', { class: cls, 'data-sec': String(r.sec), 'data-id': r.id }, sw, text, side);
  if (r.own) {
    li.append(button('✕', () => { removeOwn(m, r.id); say(t('own.removed', { title: r.title })); changed('own-open'); }, 'kin-music-x', { 'aria-label': t('list.remove', { title: r.title }) }));
  }
  return li;
}

/** Adding an own track: the link, the length, a name; a clear message when something is wrong. */
function addForm(m: MusicPrefs, open: boolean, said: string, keep: (open: boolean, said: string) => void, changed: (focus?: string) => void): HTMLElement {
  const box = h('details', { class: 'kin-music-add' });
  if (open) box.setAttribute('open', '');
  box.addEventListener('toggle', () => keep(box.open, ''));
  const summary = h('summary', { 'data-k': 'own-open' }, `＋ ${t('own.open')}`);
  const field = (label: string, ph: string, k: string, extra: Record<string, unknown> = {}) => {
    const input = h('input', { type: 'text', placeholder: ph, autocomplete: 'off', spellcheck: 'false', 'data-k': k, ...extra }) as HTMLInputElement;
    return { input, el: h('label', { class: 'f' }, h('span', null, label), input) };
  };
  const link = field(t('own.link'), t('own.linkPh'), 'own-link', { inputmode: 'url', autocapitalize: 'off' });
  const len = field(t('own.len'), t('own.lenPh'), 'own-len', { inputmode: 'text', maxlength: '12' });
  const name = field(t('own.name'), t('own.namePh'), 'own-name', { maxlength: '80' });
  const msg = h('p', { class: 'kin-music-msg', role: 'status', 'aria-live': 'polite' }, said);
  const full = m.own.length >= OWN_MAX;
  const add = (): void => {
    for (const f of [link, len]) f.input.removeAttribute('aria-invalid');
    const res = addOwn(m, link.input.value, len.input.value, name.input.value, id => t('own.untitled', { id }));
    if (!res.ok) {
      const bad = res.error === 'length' ? len : res.error === 'full' ? null : link;
      msg.textContent = { link: t('own.errLink'), length: t('own.errLen'), dup: t('own.errDup'), full: t('own.errFull', { n: OWN_MAX }) }[res.error];
      msg.classList.add('bad');
      if (bad) { bad.input.setAttribute('aria-invalid', 'true'); bad.input.focus(); }
      return;
    }
    keep(true, res.tooLong ? t('own.addedLong', { title: res.track.title, max: MAX_SESSION_SEC / 60 }) : t('own.added', { title: res.track.title }));
    changed('own-link');
  };
  for (const f of [link, len, name]) f.input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  const addBtn = button(t('own.add'), add, 'btn primary', { disabled: full, 'data-k': 'own-add' });
  const lenRow = h('div', { class: 'kin-music-addrow' }, len.el, name.el);
  box.append(summary, h('p', { class: 'kin-music-note' }, t('own.note')), link.el, lenRow, h('div', { class: 'row' }, addBtn), msg);
  if (full && !said) msg.textContent = t('own.errFull', { n: OWN_MAX });
  return box;
}
