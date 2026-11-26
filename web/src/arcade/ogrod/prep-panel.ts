/**
 * Ogród o świcie's lobby section "Twoja droga" (DESIGN.md §23): the way and what the player brings to each station —
 * a conscious, symbolic preparation that also works with no effort at all (good defaults are chosen, so "Graj" right
 * away gives a whole session).  DOM, built with h(), mobile first:
 *
 *   the way       "Polecana droga na {n} min" or "Moja droga"; the seven stations as a vertical path of compact rows
 *                 (a glyph, the name, one line on what it is, a switch), in the way's order; the dawn last, always on;
 *                 what fits the lobby's length (stations.ts `stationRoom`, `stationsFor`) — a row that will not fit
 *                 says so, never hidden
 *   each station  a one-line summary of the player's choice and "Zmień", which opens its choices (one at a time):
 *                 feelings, the kind word (a pair or alone, or own), the unsent letter (letter.ts — never saved), what
 *                 reopens the wound and the week's boundary, the stones ("not yet" is a choice), the lanterns' names
 *                 and the one who hurt (off by default), the seeds, the name the dawn calls
 *   before        "Jak ciężko jest dziś twojemu sercu?" 0–10 (optional; the session asks again at dawn)
 *   care          not therapy, the help lines; what stays on the device; "Zapomnij moje słowa"
 *
 * Every change saves at once (`save()`) and redraws the section (never the lobby around it), keeping the keyboard
 * focus on the control that was used (`data-k`).  Typing never redraws: the letter goes to letter.ts as it is typed (and
 * nowhere else), the name into the progress in memory and is saved when the field is left.  Text the player types is
 * set as text, never as markup.
 *
 * CONTRACT (lead): builder A's panel.ts (the game's lobby card) appends `prepPanel(progress.prep, save, sessionSec)` as
 * one section, and `weekCard(progress.prep, progress.week)` where the card shows what the last session left for the week.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { LETTER_MAX, peekLetter, setLetter } from './letter';
import {
  addFriend, addOwnWord, forgetWords, hasKey, limitsOf, pairOf, removeFriend, removeWord, setBefore, setIntention, setName,
  setOf, setOwnKind, setPair, setReady, setWayMode, setWithHarsh, toggleKey, toggleStation, wayOf, weekLines, wordOf,
  type Change, type GardenPrep, type ListKey,
} from './prep';
import { t } from './prep-i18n';
import { STATIONS, stationsFor, type StationId } from './stations';
import { FRIENDS_MAX, OWN_LEN, PAIRS, WORDS, stationName, stationWhat, wordText } from './words';

/** What the last session left for the week (kept by A's meta.ts after a session; B's card shows it in the lobby). */
export interface Week {
  /** the day of the session (YYYY-MM-DD) */
  day: string;
  /** the boundary chosen for the week (a set's key), the friends' names to reach out to, the seeds to tend */
  intention: string | null;
  friends: string[];
  seeds: string[];
}

type Place = StationId | 'swit';

// ── small pieces ────────────────────────────────────────────────

const SVG = 'http://www.w3.org/2000/svg';

/** Each place's glyph: a few strokes on a 24-px grid (a drop, a heart, a paper boat, an arched gate, a stone, a
 * lantern, a sprout, the sun on the horizon). */
const GLYPH: Readonly<Record<Place | 'dot', string>> = {
  lzy: 'M12 3.2c3.6 4.6 6 7.8 6 10.9a6 6 0 0 1-12 0c0-3.1 2.4-6.3 6-10.9z',
  dlon: 'M12 20s-7-4.3-7-9.8A4 4 0 0 1 12 7.6a4 4 0 0 1 7 2.6C19 15.7 12 20 12 20z',
  list: 'M3 15.5h18l-2.6 4H5.6z M11.5 4v11.5 M11.5 5l6 9.5h-6',
  furtka: 'M5 21V11a7 7 0 0 1 14 0v10z M12 4v17 M9.6 14h.01 M14.4 14h.01',
  kamienie: 'M4.5 15.5c0-3.8 3.4-7.5 8-7.5s7.5 3 7.5 6.3-3 4.7-7.6 4.7-7.9-.3-7.9-3.5z M2.5 21h19',
  latarnie: 'M9 4.5h6 M12 2.5v2 M8 7h8l1.2 2v7L16 18H8l-1.2-2V9z M10 20.5h4 M12 10.5v4',
  nasiona: 'M12 21v-8 M12 13c0-4 3-6.2 7-6.2 0 4-3 6.2-7 6.2z M12 15.5c0-3-2.6-5-6-5 0 3 2.6 5 6 5z M7 21h10',
  swit: 'M2.5 17.5h19 M7 17.5a5 5 0 0 1 10 0 M12 6.5v3 M5.2 10.2l2 2 M18.8 10.2l-2 2 M6 21h12',
  dot: 'M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
};

function glyph(id: Place | 'dot', cls = 'og-glyph'): HTMLElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', GLYPH[id]);
  svg.append(path);
  return h('span', { class: cls }, svg);
}

function button(text: string | (Node | string | null)[], onClick: () => void, cls: string, extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, ...(Array.isArray(text) ? text : [text]));
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** "5", "1,5" — minutes for a line of text. */
const minutes = (sec: number): string => fmtNum(sec / 60, sec % 60 ? 1 : 0);

/** What a refused change says (`max`: the list's limit). */
function said(c: Change, max: number): string {
  if (c === 'max') return t('ed.max', { n: max });
  if (c === 'min') return t('ed.min');
  if (c === 'dup') return t('ed.dup');
  return '';
}

// ── the section ─────────────────────────────────────────────────

/** The section shown last (its length line follows the lobby's #arcadeLen). */
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

/** The section's own state between redraws (not saved): the station whose choices are open, the last message. */
interface Ui { open: Place | null; msg: { at: string; text: string } | null }

interface Ctx {
  p: GardenPrep;
  ui: Ui;
  sec: number;
  /** saved, redrawn, the focus back on `focus` (a data-k) */
  changed: (focus?: string) => void;
  /** saved only (a field already shows what was typed; a redraw would swallow the tap that left it) */
  saved: () => void;
  /** a refused change: its words under the control (`max`: the limit it met), the focus kept */
  refused: (at: string, c: Change, max: number, focus?: string) => void;
}

/**
 * The lobby section: `save()` after every change; `sessionSec()` reads the lobby's chosen length (as serce/panel.ts
 * sessionSec does) so the way can say what fits.
 */
export function prepPanel(p: GardenPrep, save: () => void, sessionSec: () => number): HTMLElement {
  const root = h('section', { class: 'og-prep', 'aria-label': t('p.head') });
  const ui: Ui = { open: null, msg: null };
  const total = (): number => {
    const s = Number(sessionSec());
    return Number.isFinite(s) && s > 0 ? s : 300;
  };
  const focusOn = (k?: string): void => {
    if (k) root.querySelector<HTMLElement>(`[data-k="${k}"]`)?.focus({ preventScroll: true });
  };
  const render = (focus?: string): void => {
    const cx: Ctx = {
      p, ui, sec: total(),
      changed: f => { save(); render(f); },
      saved: () => save(),
      refused: (at, c, max, f) => {
        ui.msg = { at, text: at === 'way' && c === 'min' ? t('p.lastOne') : said(c, max) };
        render(f);
      },
    };
    root.replaceChildren(...build(cx));
    ui.msg = null;
    focusOn(focus);
  };
  render();
  refresh = () => { if (root.isConnected) render(); };
  hookLength();
  return root;
}

function build(cx: Ctx): HTMLElement[] {
  const { p, ui, sec } = cx;
  const out: HTMLElement[] = [];
  out.push(h('div', { class: 'arcade-sub' }, t('p.head')), h('p', { class: 'og-lede' }, t('p.lede')));

  // ── the way: recommended or own ──
  const own = p.way !== null;
  out.push(h('div', { class: 'og-ways', role: 'radiogroup', 'aria-label': t('p.way.label') },
    button(t('p.way.rec', { min: minutes(sec) }), () => { setWayMode(p, false, sec); cx.changed('way-rec'); }, own ? 'btn' : 'btn on', {
      role: 'radio', 'aria-checked': String(!own), 'data-k': 'way-rec',
    }),
    button(t('p.way.own'), () => { setWayMode(p, true, sec); cx.changed('way-own'); }, own ? 'btn on' : 'btn', {
      role: 'radio', 'aria-checked': String(own), 'data-k': 'way-own',
    })));
  const way = wayOf(p, sec);
  const walked = stationsFor(sec, way);
  out.push(h('p', { class: 'og-note' }, t(own ? 'p.way.ownNote' : 'p.way.recNote')));
  out.push(h('p', { class: 'og-fit', 'aria-live': 'polite' },
    t(way.length > walked.length ? 'p.fit.over' : 'p.fit.all', { min: minutes(sec), n: walked.length })));
  if (ui.msg?.at === 'way') out.push(h('p', { class: 'og-msg', role: 'status' }, ui.msg.text));

  // ── the path ──
  const path = h('ol', { class: 'og-path' });
  for (const id of STATIONS) path.append(stationRow(cx, id, way.includes(id), walked.includes(id)));
  path.append(dawnRow(cx));
  out.push(path);

  // ── before ──
  out.push(beforeBlock(cx));

  // ── care, privacy ──
  out.push(h('p', { class: 'og-care' }, t('p.care')));
  const forget = button(t('p.forget'), () => {
    forgetWords(p);
    setLetter('');
    ui.open = null;
    ui.msg = { at: 'forget', text: t('p.forgotten') };
    cx.changed('forget');
  }, 'btn ghost og-forget', { 'data-k': 'forget' });
  out.push(h('div', { class: 'og-privacy' }, h('p', null, t('p.privacy')), forget));
  if (ui.msg?.at === 'forget') out.push(h('p', { class: 'og-msg', role: 'status' }, ui.msg.text));
  return out;
}

/** One station: glyph · name / what it is / "no room" · switch; when on, its summary and "Zmień"; when open, its choices. */
function stationRow(cx: Ctx, id: StationId, on: boolean, fits: boolean): HTMLElement {
  const { p, ui, sec } = cx;
  const name = stationName(id);
  const open = on && ui.open === id;
  const cls = ['og-st', on ? 'on' : 'off', on && !fits ? 'nofit' : '', open ? 'open' : ''].filter(Boolean).join(' ');
  const sw = button('', () => {
    const c = toggleStation(p, id, sec);
    if (c !== 'ok') { cx.refused('way', c, STATIONS.length, `sw-${id}`); return; }
    if (ui.open === id) ui.open = null;
    cx.changed(`sw-${id}`);
  }, 'og-sw', { role: 'switch', 'aria-checked': String(on), 'aria-label': name, 'data-k': `sw-${id}` });
  const text = h('div', { class: 'og-st-text' },
    h('span', { class: 'og-st-name' }, name),
    h('span', { class: 'og-st-what' }, stationWhat(id)),
    on && !fits ? h('span', { class: 'og-st-warn' }, t('p.noFit', { min: minutes(sec) })) : null);
  const li = h('li', { class: cls, 'data-st': id }, h('div', { class: 'og-st-row' }, glyph(id), text, sw));
  if (on) {
    li.append(summaryRow(cx, id, summaryOf(p, id)));
    if (open) li.append(editor(cx, id));
  }
  return li;
}

/** The dawn: always last, always on; its summary is the name it calls. */
function dawnRow(cx: Ctx): HTMLElement {
  const { p, ui } = cx;
  const open = ui.open === 'swit';
  const li = h('li', { class: open ? 'og-st on dawn open' : 'og-st on dawn', 'data-st': 'swit' },
    h('div', { class: 'og-st-row' }, glyph('swit'),
      h('div', { class: 'og-st-text' },
        h('span', { class: 'og-st-name' }, stationName('swit')),
        h('span', { class: 'og-st-what' }, stationWhat('swit')),
        h('span', { class: 'og-always' }, t('p.always'))),
      h('span', { 'aria-hidden': 'true' })));
  li.append(summaryRow(cx, 'swit', p.name ? t('sum.name', { name: p.name }) : t('sum.noName')));
  if (open) li.append(editor(cx, 'swit'));
  return li;
}

function summaryRow(cx: Ctx, id: Place, text: string): HTMLElement {
  const { ui } = cx;
  const open = ui.open === id;
  const name = stationName(id);
  const change = button(open ? t('p.done') : t('p.change'), () => {
    ui.open = open ? null : id;
    cx.changed(`ch-${id}`);
  }, 'btn ghost og-change', { 'aria-expanded': String(open), 'aria-label': open ? `${t('p.done')}: ${name}` : t('p.changeLabel', { station: name }), 'data-k': `ch-${id}` });
  return h('div', { class: 'og-sum' }, h('span', { class: 'og-sum-text', 'data-sum': id }, text), change);
}

/** A station's choices in one line. */
export function summaryOf(p: GardenPrep, id: StationId): string {
  const list = (l: ListKey): string => (l === 'stones' ? p.stones.map(s => s.w) : p[l]).map(w => wordOf(setOf(l), w)).join(' · ');
  switch (id) {
    case 'lzy': return list('feelings');
    case 'dlon': {
      const kind = wordOf('kind', p.kind.kind);
      return p.kind.harsh ? t('sum.dlon', { harsh: wordOf('harsh', p.kind.harsh), kind }) : t('sum.dlonKind', { kind });
    }
    case 'list': {
      const n = [...peekLetter()].length;
      return n ? t('sum.list', { n }) : t('sum.listNone');
    }
    case 'furtka': {
      const b = list('bounds');
      return p.intention ? `${b} · ${t('sum.intention', { text: wordText('int', p.intention) })}` : b;
    }
    case 'kamienie':
      return p.stones.map(s => (s.ready ? wordOf('stone', s.w) : t('sum.notYet', { text: wordOf('stone', s.w) }))).join(' · ');
    case 'latarnie':
      return [t('sum.me'), ...p.friends, ...(p.hurt ? [t('sum.hurt')] : []), t('sum.all')].join(' · ');
    case 'nasiona': return list('seeds');
    default: return '';
  }
}

// ── the editors ─────────────────────────────────────────────────

function editor(cx: Ctx, id: Place): HTMLElement {
  const box = h('div', { class: 'og-ed', role: 'group', 'aria-label': stationName(id) });
  switch (id) {
    case 'lzy': box.append(q(t('ed.lzy.q')), note(t('ed.lzy.note')), ...chips(cx, 'feelings', t('ed.lzy.ph'))); break;
    case 'dlon': box.append(...kindEditor(cx)); break;
    case 'list': box.append(...letterEditor(cx)); break;
    case 'furtka': box.append(...gateEditor(cx)); break;
    case 'kamienie': box.append(...stoneEditor(cx)); break;
    case 'latarnie': box.append(...lanternEditor(cx)); break;
    case 'nasiona': box.append(q(t('ed.nas.q')), note(t('ed.nas.note')), ...chips(cx, 'seeds', t('ed.nas.ph'))); break;
    case 'swit': box.append(...nameEditor(cx)); break;
    default: break;
  }
  return box;
}

const q = (text: string): HTMLElement => h('p', { class: 'og-q' }, text);
const note = (text: string): HTMLElement => h('p', { class: 'og-note' }, text);

function msgLine(cx: Ctx, at: string): HTMLElement | null {
  return cx.ui.msg?.at === at && cx.ui.msg.text ? h('p', { class: 'og-msg', role: 'status' }, cx.ui.msg.text) : null;
}

/** A list's chips: the set's words (pressed when chosen) and the player's own (pressed, with ✕), then "Własne słowo". */
function chips(cx: Ctx, list: ListKey, ph: string): HTMLElement[] {
  const { p } = cx;
  const set = setOf(list);
  const box = h('div', { class: 'og-chips' });
  for (const k of WORDS[set]) {
    const on = hasKey(p, list, k);
    box.append(button(wordText(set, k), () => {
      const c = toggleKey(p, list, k);
      if (c === 'ok') cx.changed(`w-${list}-${k}`); else cx.refused(list, c, limitsOf(list)[1], `w-${list}-${k}`);
    }, 'og-chip', { 'aria-pressed': String(on), 'data-k': `w-${list}-${k}` }));
  }
  const words = list === 'stones' ? p.stones.map(s => s.w) : p[list];
  words.forEach((w, i) => {
    if (!('o' in w)) return;
    box.append(button([w.o, h('span', { class: 'og-x', 'aria-hidden': 'true' }, '✕')], () => {
      const c = removeWord(p, list, i);
      if (c === 'ok') cx.changed(`own-${list}`); else cx.refused(list, c, limitsOf(list)[1], `ownw-${list}-${i}`);
    }, 'og-chip own', { 'aria-pressed': 'true', 'aria-label': t('ed.remove', { w: w.o }), 'data-k': `ownw-${list}-${i}` }));
  });
  return [box, ownField(cx, `own-${list}`, ph, text => addOwnWord(p, list, text), list, limitsOf(list)[1]), msgLine(cx, list)]
    .filter((x): x is HTMLElement => !!x);
}

/** "Własne słowo": a field and "Dodaj" (Enter adds too); a refusal is said under `at` (`max`: the limit). */
function ownField(cx: Ctx, k: string, ph: string, add: (text: string) => Change, at: string, max: number, label = t('ed.own')): HTMLElement {
  const input = h('input', {
    type: 'text', maxlength: String(OWN_LEN), placeholder: ph, 'aria-label': label, autocomplete: 'off', 'data-k': k, enterkeyhint: 'done',
  }) as HTMLInputElement;
  const go = (): void => {
    const c = add(input.value);
    if (c === 'ok') cx.changed(k);
    else if (c !== 'empty') cx.refused(at, c, max, k);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return h('div', { class: 'og-own' }, input, button(t('ed.add'), go, 'btn og-add', { 'data-k': `${k}-add` }));
}

/** Dłoń na sercu: with the harsh word or the kind one alone; the eight pairs; own words. */
function kindEditor(cx: Ctx): HTMLElement[] {
  const { p, ui } = cx;
  const chosen = pairOf(p);
  const own = chosen < 0;
  const withHarsh = p.kind.harsh !== null;
  const out: HTMLElement[] = [q(t('ed.dlon.q')), note(t('ed.dlon.note'))];
  if (!own) {
    out.push(h('div', { class: 'og-seg', role: 'radiogroup', 'aria-label': t('ed.dlon.q') },
      ...([true, false] as const).map(v => button(t(v ? 'ed.dlon.pair' : 'ed.dlon.kindOnly'), () => { setWithHarsh(p, v); cx.changed(`harsh-${v}`); },
        withHarsh === v ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(withHarsh === v), 'data-k': `harsh-${v}` }))));
  }
  const list = h('div', { class: 'og-pairs', role: 'radiogroup', 'aria-label': t('ed.dlon.q') });
  PAIRS.forEach(([hk, kk], i) => {
    const on = i === chosen;
    list.append(button([
      withHarsh || own ? h('span', { class: 'og-harsh' }, wordText('harsh', hk)) : null,
      h('span', { class: 'og-kind' }, wordText('kind', kk)),
    ], () => { setPair(p, i, own ? true : withHarsh); cx.changed(`pair-${i}`); }, 'og-pair', { role: 'radio', 'aria-checked': String(on), 'data-k': `pair-${i}` }));
  });
  out.push(list);
  // own words: two fields; the kind one is needed
  const harsh = h('input', {
    type: 'text', maxlength: String(OWN_LEN * 2), placeholder: t('ed.dlon.ownHarshPh'), autocomplete: 'off', 'data-k': 'own-harsh',
  }) as HTMLInputElement;
  const kind = h('input', {
    type: 'text', maxlength: String(OWN_LEN * 2), placeholder: t('ed.dlon.ownKindPh'), autocomplete: 'off', 'data-k': 'own-kind', enterkeyhint: 'done',
  }) as HTMLInputElement;
  if (own) {
    harsh.value = p.kind.harsh && 'o' in p.kind.harsh ? p.kind.harsh.o : '';
    kind.value = 'o' in p.kind.kind ? p.kind.kind.o : '';
  }
  const keep = (): void => { if (setOwnKind(p, harsh.value, kind.value) === 'ok') cx.changed('own-kind'); else kind.focus(); };
  for (const f of [harsh, kind]) f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
  const box = h('details', { class: 'og-ownkind' });
  if (own || ui.msg?.at === 'own-kind') box.setAttribute('open', '');
  box.append(
    h('summary', { 'data-k': 'own-kind-open' }, `＋ ${t('ed.dlon.own')}`),
    h('label', { class: 'og-field' }, h('span', null, t('ed.dlon.ownHarsh')), harsh),
    h('label', { class: 'og-field' }, h('span', null, t('ed.dlon.ownKind')), kind),
    h('div', { class: 'og-row' },
      button(t('ed.dlon.ownSave'), keep, 'btn primary og-add', { 'data-k': 'own-kind-save' }),
      own ? button(t('ed.dlon.ownForget'), () => { setPair(p, 0, true); cx.changed('pair-0'); }, 'btn ghost', { 'data-k': 'own-kind-back' }) : null));
  out.push(box);
  return out;
}

/** List bez adresu: the letter, typed into letter.ts only (never the progress), its count, "Wyczyść list". */
function letterEditor(cx: Ctx): HTMLElement[] {
  const area = h('textarea', {
    class: 'og-letter', maxlength: String(LETTER_MAX), rows: '7', placeholder: t('ed.list.ph'), 'aria-label': t('ed.list.q'),
    autocomplete: 'off', 'data-k': 'letter',
  }) as HTMLTextAreaElement;
  area.value = peekLetter();
  const count = h('span', { class: 'og-count', 'aria-live': 'off' });
  const clear = button(t('ed.list.clear'), () => {
    setLetter('');
    area.value = '';
    sync();
    area.focus({ preventScroll: true });
  }, 'btn ghost', { 'data-k': 'letter-clear' });
  const sync = (): void => {
    const n = [...area.value].length;
    count.textContent = t('ed.list.count', { n, max: LETTER_MAX });
    clear.hidden = n === 0;
    // the summary above follows as the player types (no redraw, no save: the letter is not the progress')
    const sum = area.closest('.og-st')?.querySelector<HTMLElement>('[data-sum="list"]');
    if (sum) sum.textContent = n ? t('sum.list', { n }) : t('sum.listNone');
  };
  area.addEventListener('input', () => {
    setLetter(area.value);
    if (area.value !== peekLetter()) area.value = peekLetter();
    sync();
  });
  count.textContent = t('ed.list.count', { n: [...area.value].length, max: LETTER_MAX });
  clear.hidden = !area.value;
  void cx;
  return [
    q(t('ed.list.q')), note(t('ed.list.note')), area,
    h('div', { class: 'og-row og-letter-foot' }, count, clear),
    h('p', { class: 'og-note og-private' }, t('ed.list.private')),
    note(t('ed.list.none')),
  ];
}

/** Furtka: what reopens the wound (chips), and the week's boundary (one or none). */
function gateEditor(cx: Ctx): HTMLElement[] {
  const { p } = cx;
  const out: HTMLElement[] = [q(t('ed.furtka.q')), note(t('ed.furtka.note')), ...chips(cx, 'bounds', t('ed.furtka.ph'))];
  out.push(q(t('ed.furtka.int')), note(t('ed.furtka.intNote')));
  const opts = h('div', { class: 'og-opts', role: 'radiogroup', 'aria-label': t('ed.furtka.int') });
  for (const k of [...WORDS.int, null]) {
    const on = p.intention === k;
    opts.append(button(k ? wordText('int', k) : t('ed.furtka.intNone'), () => { setIntention(p, k); cx.changed(`int-${k ?? 'none'}`); },
      k ? 'og-opt' : 'og-opt none', { role: 'radio', 'aria-checked': String(on), 'data-k': `int-${k ?? 'none'}` }));
  }
  out.push(opts);
  return out;
}

/** Kamienie: the stones (chips), and for each chosen one "Gotowe, by puścić" / "Jeszcze nie teraz". */
function stoneEditor(cx: Ctx): HTMLElement[] {
  const { p } = cx;
  const out: HTMLElement[] = [q(t('ed.kam.q')), note(t('ed.kam.note')), ...chips(cx, 'stones', t('ed.kam.ph'))];
  const rows = h('ul', { class: 'og-stones' });
  p.stones.forEach((s, i) => {
    const text = wordOf('stone', s.w);
    const seg = h('div', { class: 'og-seg', role: 'radiogroup', 'aria-label': text },
      ...([true, false] as const).map(v => button(t(v ? 'ed.kam.ready' : 'ed.kam.notYet'), () => { setReady(p, i, v); cx.changed(`ready-${i}-${v}`); },
        s.ready === v ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(s.ready === v), 'data-k': `ready-${i}-${v}` })));
    rows.append(h('li', { class: s.ready ? 'og-stone' : 'og-stone held' }, glyph('kamienie', 'og-glyph small'),
      h('div', { class: 'og-stone-text' }, h('span', null, text),
        'k' in s.w && s.w.k === 'zal-bog' ? h('span', { class: 'og-note' }, t('ed.kam.god')) : null),
      seg));
  });
  out.push(rows);
  if (p.stones.some(s => !s.ready)) out.push(note(t('ed.kam.notYetNote')));
  return out;
}

/** Latarnie: me and all always; the names (≤ 5); the one who hurt (only if chosen). */
function lanternEditor(cx: Ctx): HTMLElement[] {
  const { p } = cx;
  const out: HTMLElement[] = [q(t('ed.lat.q')), note(t('ed.lat.note'))];
  const box = h('div', { class: 'og-chips' });
  box.append(h('span', { class: 'og-chip fixed' }, glyph('latarnie', 'og-glyph small'), t('lan.me')));
  p.friends.forEach((n, i) => {
    box.append(button([n, h('span', { class: 'og-x', 'aria-hidden': 'true' }, '✕')], () => { removeFriend(p, i); cx.changed('own-friend'); },
      'og-chip own', { 'aria-pressed': 'true', 'aria-label': t('ed.remove', { w: n }), 'data-k': `friend-${i}` }));
  });
  if (p.hurt) box.append(h('span', { class: 'og-chip fixed' }, glyph('latarnie', 'og-glyph small'), t('lan.hurt')));
  box.append(h('span', { class: 'og-chip fixed' }, glyph('latarnie', 'og-glyph small'), t('lan.all')));
  out.push(box);
  out.push(h('p', { class: 'og-q small' }, t('ed.lat.names')),
    ownField(cx, 'own-friend', t('ed.lat.ph'), text => addFriend(p, text), 'friends', FRIENDS_MAX, t('ed.lat.names')));
  const m = msgLine(cx, 'friends');
  if (m) out.push(m);
  const sw = button('', () => { p.hurt = !p.hurt; cx.changed('hurt'); }, 'og-sw', {
    role: 'switch', 'aria-checked': String(p.hurt), 'aria-labelledby': 'og-hurt-label', 'data-k': 'hurt',
  });
  out.push(h('div', { class: 'og-toggle' }, h('span', { id: 'og-hurt-label', class: 'og-toggle-text' }, t('ed.lat.hurt')), sw));
  out.push(note(t('ed.lat.hurtNote')), note(t('ed.lat.reach')));
  return out;
}

/** Świt: the name the dawn calls (optional; kept in memory as it is typed, saved when the field is left). */
function nameEditor(cx: Ctx): HTMLElement[] {
  const { p } = cx;
  const input = h('input', {
    type: 'text', maxlength: String(OWN_LEN), placeholder: t('ed.swit.ph'), 'aria-label': t('ed.swit.label'), autocomplete: 'off',
    autocapitalize: 'words', 'data-k': 'name', enterkeyhint: 'done',
  }) as HTMLInputElement;
  input.value = p.name;
  const sum = (): void => {
    const s = input.closest('.og-st')?.querySelector<HTMLElement>('[data-sum="swit"]');
    if (s) s.textContent = p.name ? t('sum.name', { name: p.name }) : t('sum.noName');
  };
  input.addEventListener('input', () => { setName(p, input.value); sum(); });
  input.addEventListener('change', () => { setName(p, input.value); cx.saved(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  return [q(t('ed.swit.q')), note(t('ed.swit.note')), input];
}

/** "Jak ciężko jest dziś twojemu sercu?" 0–10, tapped again (or "Bez odpowiedzi") to clear. */
function beforeBlock(cx: Ctx): HTMLElement {
  const { p } = cx;
  const grid = h('div', { class: 'og-scale', role: 'radiogroup', 'aria-label': t('p.before') },
    ...Array.from({ length: 11 }, (_, n) => button(String(n), () => { setBefore(p, p.before === n ? null : n); cx.changed(`before-${n}`); },
      p.before === n ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.before === n), 'data-k': `before-${n}` })));
  const box = h('div', { class: 'og-before' }, h('p', { class: 'og-q' }, t('p.before')), note(t('p.beforeNote')), grid);
  const was = p.before;
  if (was !== null) box.append(button(t('p.beforeClear'), () => { setBefore(p, null); cx.changed(`before-${was}`); }, 'btn ghost og-clear', { 'data-k': 'before-clear' }));
  return box;
}

// ── the week's card ─────────────────────────────────────────────

const ITEM_GLYPH: Readonly<Record<'int' | 'friends' | 'seeds' | 'start', Place | 'dot'>> = { int: 'furtka', friends: 'latarnie', seeds: 'nasiona', start: 'dot' };

/** The week's card (null: nothing to show — no week, or one older than 7 days). */
export function weekCard(p: GardenPrep, week: Week | null): HTMLElement | null {
  void p;
  const w = weekLines(week);
  if (!w) return null;
  return h('section', { class: 'og-week', 'aria-label': w.head },
    h('div', { class: 'og-week-head' }, glyph('swit'), h('div', null, h('p', { class: 'og-week-title' }, w.head), h('p', { class: 'og-week-day' }, w.day))),
    h('ul', { class: 'og-week-list' }, ...w.items.map(it => h('li', { class: `og-week-item ${it.kind}` }, glyph(ITEM_GLYPH[it.kind], 'og-glyph small'), h('span', null, it.text)))));
}
