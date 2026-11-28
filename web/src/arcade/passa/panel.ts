/**
 * Złota passa's "Postępy" card in the lobby (DESIGN.md §26), from the app's shared classes (styles.css), mobile first:
 *
 *   the habit      the day-streak now ("Dzień passy"), the longest, the most wins in a session, wins in all — and a
 *                  line on the streak: none yet, it goes on, today already played, or kept by grace (one missed day)
 *   the group      (round 25) the age group as five chips (11–19 · 20–26 · 27–35 · 36–50 · 50+) — the day is told for
 *                  it; shared with Stop-klatka (kit/ages.ts); until one is chosen, a line says the session will ask
 *   how it works   one line, and this session's forecast for the lobby's length (the plan the session follows: the
 *                  moments, and among them the sense and the given ones)
 *   Mój dzień      the player's own moments: a line, its kind (dobre / drobny kłopot / trudne), optionally their own
 *                  win; add, change, remove (≤ 8); "Zapomnij moje słowa" — kept only on this device, never in a result
 *   the hard       "Także to, co trudne" (off by default) with a line on what it means
 *   the source     where the exercise comes from (named once), and the care line with the help lines
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen.  Built with h(); text the player typed is set as text, never as markup; sizes on the CSSOM (the
 * CSP).  Typing never redraws the card; adding, changing and removing do (the focus kept on the control used).
 */
import { fmtNum } from '../../i18n';
import { t as at } from '../../i18n/arcade';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { AGES, AGE_SPAN } from '../kit/ages';
import { dayKey } from '../kit/progress';
import { lifeCounts } from './content';
import { t, type Key } from './i18n';
import { KINDS, addOwn, bestOf, editOwn, forgetOwn, removeOwn, setAge, setHard, type Change, type PassaProgress } from './meta';
import type { MomentKind } from './moments';
import { RULES, planFor, streakNow } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  b.style.minHeight = '44px';
  b.style.minWidth = '44px';
  return b;
}

function textInput(value: string, max: number, label: string, ph: string, key: string): HTMLInputElement {
  const input = h('input', { type: 'text', maxlength: String(max), placeholder: ph, 'aria-label': label, autocomplete: 'off', 'data-k': key }) as HTMLInputElement;
  input.value = value;
  input.style.minHeight = '44px';
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  return input;
}

/** The session length the lobby has chosen (s): the checked minutes, else the last session's, else 5 minutes. */
export function sessionSec(p: PassaProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s (the design's rhythm; a heavy moment when asked for). */
export function forecastLines(p: PassaProgress, sec: number): string[] {
  const plan = planFor({ plannedSec: sec, eeg: false, first: p.sessions === 0, heavy: p.hard, ...lifeCounts(), ask: !p.ageSet });
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  const out = [t('panel.fc', { min, moments: t('moments', { n: plan.n }), push: Math.round(plan.push), rest: t('breaths', { n: plan.breaths }) })];
  if (plan.nSense > 0 && plan.nGiven > 0) out.push(t('panel.fcLife', { sense: t('senseN', { n: plan.nSense }), given: t('givenN', { n: plan.nGiven }) }));
  if (p.hard) out.push(t(plan.heavyAt >= 0 ? 'panel.fcHeavy' : 'panel.fcNoHeavy'));
  return out;
}

/** The streak's line for the lobby on `day`. */
export function streakLine(p: PassaProgress, day: string): string {
  const now = streakNow(p.streak, day);
  if (now.days <= 0) return t('panel.streakNone');
  if (now.grace) return t('panel.streakGrace');
  const days = t('days', { n: now.days });
  return p.streak.last === day ? t('panel.streakToday', { days }) : t('panel.streakOk', { days });
}

/** The card whose forecast follows the lobby's session length (the latest one built). */
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

/** The card's own state between redraws (not saved): the moment being changed, the kind of a new one, the last message. */
interface Ui { editing: string | null; kind: MomentKind; msg: string }

export function progressPanel(p: PassaProgress, save: () => void, day = dayKey()): HTMLElement {
  const root = h('div', { class: 'arcade-panel', 'data-passa': 'panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const ui: Ui = { editing: null, kind: 'joy', msg: '' };
  const fill = (): void => { fc.textContent = forecastLines(p, sessionSec(p)).join(' '); };
  const render = (focus?: string): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, ui, fc, day, (f?: string) => { save(); render(f); })) root.appendChild(el);
    fill();
    ui.msg = '';
    if (focus) root.querySelector<HTMLElement>(`[data-k="${focus}"]`)?.focus({ preventScroll: true });
  };
  render();
  refresh = () => { if (fc.isConnected) fill(); };
  hookLength();
  return root;
}

const said = (c: Change): string => (c === 'dup' ? t('ed.dup') : c === 'empty' ? t('ed.empty') : c === 'max' ? t('ed.max') : '');

function build(p: PassaProgress, ui: Ui, fc: HTMLElement, day: string, changed: (focus?: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  const now = streakNow(p.streak, day);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.days'), fmtNum(now.days)),
    stat(t('panel.bestDays'), fmtNum(p.streak.best)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.wins'), fmtNum(p.wins))));
  out.push(h('p', null, streakLine(p, day)));

  // ── the group (round 25; shared with Stop-klatka) ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.age')));
  out.push(h('div', { class: 'seg passa-ages', role: 'radiogroup', 'aria-label': t('panel.age') },
    AGES.map(a => {
      const on = p.ageSet && p.age === a;
      return button(AGE_SPAN[a], () => { if (setAge(p, a)) changed(`age-${a}`); }, on ? 'btn on' : 'btn', {
        role: 'radio', 'aria-checked': String(on), 'aria-label': t('age.label', { span: AGE_SPAN[a] }), 'data-k': `age-${a}`, 'data-age': a,
      });
    })));
  out.push(h('p', { class: 'muted' }, t(p.ageSet ? 'panel.ageNote' : 'panel.ageAsk')));

  out.push(h('p', { class: 'muted' }, t('panel.rules')), fc);

  // ── Mój dzień ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.myday')), h('p', { class: 'muted' }, t('panel.mydayNote')));
  if (!p.own.length) out.push(h('p', { class: 'muted' }, t('panel.none')));
  const list = h('ul', { 'data-passa': 'own' });
  list.style.listStyle = 'none';
  list.style.margin = '0';
  list.style.padding = '0';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';
  for (const o of p.own) {
    if (ui.editing === o.id) {
      list.appendChild(h('li', null, form(p, ui, changed, o.id)));
      continue;
    }
    const words = h('div', null, h('b', null, o.text), o.win ? h('div', { class: 'muted' }, `→ ${o.win}`) : null);
    words.style.flex = '1';
    words.style.minWidth = '8em';
    words.style.overflowWrap = 'anywhere';
    const chip = h('span', { class: 'muted' }, t(`kind.${o.kind}` as Key));
    chip.style.fontSize = '13px';
    chip.style.whiteSpace = 'nowrap';
    const row = h('li', { class: 'row', 'data-own': o.id }, words, chip,
      button(t('panel.edit'), () => { ui.editing = o.id; ui.kind = o.kind; changed(`text-${o.id}`); }, 'btn', { 'data-k': `edit-${o.id}` }),
      button('✕', () => { removeOwn(p, o.id); changed('text-new'); }, 'btn ghost', { 'aria-label': t('panel.remove', { text: o.text }), title: t('panel.remove', { text: o.text }) }));
    row.style.paddingTop = '6px';
    row.style.borderTop = '1px solid var(--line)';
    list.appendChild(row);
  }
  if (p.own.length) out.push(list);
  if (!p.hard && p.own.some(o => o.kind === 'heavy')) out.push(h('p', { class: 'muted' }, t('panel.heavyWaits')));
  if (ui.editing === null) {
    if (p.own.length < RULES.ownMax) out.push(form(p, ui, changed, null));
    else out.push(h('p', { class: 'muted' }, t('panel.full')));
  }
  if (ui.msg) out.push(h('p', { class: 'muted', role: 'status' }, ui.msg));
  if (p.own.length) {
    out.push(h('div', { class: 'row' }, button(t('panel.forget'), () => {
      forgetOwn(p);
      ui.editing = null;
      ui.msg = t('panel.forgotten');
      changed('text-new');
    }, 'btn ghost', { 'data-passa': 'forget' })));
  }

  // ── the hard things ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.hard')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.hard') },
    button(t('panel.off'), () => { if (setHard(p, false)) changed('hard-off'); }, p.hard ? 'btn' : 'btn on', { role: 'radio', 'aria-checked': String(!p.hard), 'data-k': 'hard-off' }),
    button(t('panel.on'), () => { if (setHard(p, true)) changed('hard-on'); }, p.hard ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.hard), 'data-k': 'hard-on', 'data-passa': 'hard-on' })));
  out.push(h('p', { class: 'muted' }, t('panel.hardNote')));

  // ── the source and the care ──
  out.push(h('p', { class: 'muted' }, t('panel.source')));
  out.push(h('p', { class: 'muted' }, at('passa.tip5')));
  void fc;
  return out;
}

/** The form of a new own moment (`id` null) or of one being changed. */
function form(p: PassaProgress, ui: Ui, changed: (focus?: string) => void, id: string | null): HTMLElement {
  const o = id ? p.own.find(x => x.id === id) ?? null : null;
  const key = id ?? 'new';
  const box = h('div', { role: 'group', 'aria-label': o ? t('panel.edit') : t('panel.myday'), 'data-passa': o ? 'edit' : 'new' });
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '8px';
  const text = textInput(o?.text ?? '', RULES.ownLen, t('panel.what'), t('panel.whatPh'), `text-${key}`);
  const win = textInput(o?.win ?? '', RULES.winLen, t('panel.win'), t('panel.winPh'), `win-${key}`);
  const msg = h('p', { class: 'muted', role: 'status' });
  msg.hidden = true;
  const kinds = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.kind') },
    KINDS.map(k => {
      const b = button(t(`kind.${k}` as Key), () => {
        ui.kind = k;
        for (const x of kinds.querySelectorAll('button')) {
          const on = x.getAttribute('data-kind') === k;
          x.className = on ? 'btn on' : 'btn';
          x.setAttribute('aria-checked', String(on));
        }
      }, ui.kind === k ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(ui.kind === k), 'data-kind': k });
      return b;
    }));
  const commit = (): void => {
    const c = o ? editOwn(p, o.id, { text: text.value, kind: ui.kind, win: win.value }) : addOwn(p, text.value, ui.kind, win.value);
    if (c === 'ok') {
      ui.editing = null;
      ui.kind = 'joy';
      changed(o ? `edit-${o.id}` : 'text-new');
      return;
    }
    msg.textContent = said(c);
    msg.hidden = !msg.textContent;
    text.focus();
  };
  for (const inp of [text, win]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
  const label = (s: string, el: HTMLElement): HTMLElement => h('label', { class: 'f' }, h('span', null, s), el);
  box.append(label(t('panel.what'), text), kinds, label(t('panel.win'), win), msg);
  const actions = h('div', { class: 'row' }, button(o ? t('panel.save') : t('panel.add'), commit, 'btn primary', { 'data-passa': o ? 'save' : 'add' }));
  if (o) actions.append(button(t('panel.cancel'), () => { ui.editing = null; ui.kind = 'joy'; changed(`edit-${o.id}`); }, 'btn ghost'));
  box.append(actions);
  return box;
}
