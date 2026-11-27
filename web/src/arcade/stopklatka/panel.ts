/**
 * Stop-klatka's "Postępy" card in the lobby (DESIGN.md §28), from the app's shared classes (styles.css), mobile first:
 *
 *   the records     moments mastered in all, the most in one session, stories told
 *   the group       the age group as five chips (11–19 · 20–26 · 27–35 · 36–50 · 50+) — the stories are told for it;
 *                   until one is chosen, a line says the first session will ask
 *   the session     the next story's title and this session's forecast for the lobby's length (stories, the freeze)
 *   the harder      "Także trudniejsze sytuacje" (off by default) with a line on what it means
 *   named           the feelings named most often (by the player's own tap)
 *   why it works    the card of the "why" (why.ts): what anger does, why a pause works, the four steps and their
 *                   evidence, what it is not — in a <details>, closed
 *   the care        the help lines and "not therapy"
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen.  Built with h(); sizes on the CSSOM (the CSP).
 */
import { fmtNum, lang } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { feelWord, list, t } from './i18n';
import { bestOf, setAge, setHeavy, startIn, topNamed, type StopProgress } from './meta';
import { planOf } from './sim';
import { STORIES, storiesFor, storyText } from './stories';
import { AGES, AGE_SPAN } from './story';
import { WHY } from './why';

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

/** The session length the lobby has chosen (s): the checked minutes, else the last session's, else 5 minutes. */
export function sessionSec(p: StopProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s (the design's freeze for the player's sessions). */
export function forecastLine(p: StopProgress, sec: number): string {
  const plan = planOf(p, { plannedSec: sec, eeg: false });
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  return t('panel.fc', { min, stories: t('stories', { n: plan.slots.length }), f: Math.round(plan.freeze) });
}

/** The next story's title for the player's group. */
export function nextTitle(p: StopProgress): string | null {
  const order = storiesFor(p.age, p.heavy);
  if (!order.length) return null;
  return storyText(order[startIn(p, order)]).title;
}

/** The "why" card's paragraphs in the page's language (falling back to Polish), and its title and sources. */
export function whyCard(l = lang): { title: string; paras: string[]; src: string; not: string } {
  const w = WHY[l] ?? {}, pl = WHY.pl ?? {};
  const g = (k: string): string => (typeof w[k] === 'string' && w[k].trim() ? w[k] : typeof pl[k] === 'string' ? pl[k] : '');
  const paras: string[] = [];
  for (let i = 1; i <= 16; i++) {
    const v = g(`card.${i}`);
    if (!v) break;
    paras.push(v);
  }
  return { title: g('card.title') || t('panel.why'), paras, src: g('card.src'), not: g('card.not') };
}

/** The card whose forecast follows the lobby's session length (the latest one built). */
let refresh: (() => void) | null = null;
let hooked: HTMLElement | null = null;
function hookLength(): void {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('arcadeLen');
  if (!box || box === hooked) return;
  hooked = box;
  box.addEventListener('click', () => refresh?.());
}

export function progressPanel(p: StopProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel', 'data-stop': 'panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const fill = (): void => { fc.textContent = forecastLine(p, sessionSec(p)); };
  const render = (focus?: string): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, fc, (f?: string) => { save(); render(f); })) root.appendChild(el);
    fill();
    if (focus) root.querySelector<HTMLElement>(`[data-k="${focus}"]`)?.focus({ preventScroll: true });
  };
  render();
  refresh = () => { if (fc.isConnected) fill(); };
  hookLength();
  return root;
}

function build(p: StopProgress, fc: HTMLElement, changed: (focus?: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.mastered'), fmtNum(p.mastered)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.told'), fmtNum(p.told))));

  // ── the group ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.age')));
  const chips = h('div', { class: 'seg stopklatka-ages', role: 'radiogroup', 'aria-label': t('panel.age') },
    AGES.map(a => {
      const on = p.ageSet && p.age === a;
      return button(AGE_SPAN[a], () => { if (setAge(p, a)) changed(`age-${a}`); }, on ? 'btn on' : 'btn', {
        role: 'radio', 'aria-checked': String(on), 'aria-label': t('age.label', { span: AGE_SPAN[a] }), 'data-k': `age-${a}`, 'data-age': a,
      });
    }));
  out.push(chips);
  out.push(h('p', { class: 'muted' }, t(p.ageSet ? 'panel.ageNote' : 'panel.ageAsk')));
  const next = nextTitle(p);
  if (next) out.push(h('p', null, t('panel.next', { title: next })));
  out.push(fc);

  // ── the harder situations ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.heavy')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.heavy') },
    button(t('panel.off'), () => { if (setHeavy(p, false)) changed('heavy-off'); }, p.heavy ? 'btn' : 'btn on', { role: 'radio', 'aria-checked': String(!p.heavy), 'data-k': 'heavy-off' }),
    button(t('panel.on'), () => { if (setHeavy(p, true)) changed('heavy-on'); }, p.heavy ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.heavy), 'data-k': 'heavy-on', 'data-stop': 'heavy-on' })));
  const heavies = STORIES[p.age].filter(s => s.heavy).length;
  out.push(h('p', { class: 'muted' }, t(heavies || !STORIES[p.age].length ? 'panel.heavyNote' : 'panel.heavyNone')));

  // ── what the player named most ──
  const top = topNamed(p);
  if (top.length) out.push(h('p', { class: 'muted' }, t('panel.named', { list: list(top.map(f => feelWord(f))) })));

  // ── why it works ──
  const why = whyCard();
  if (why.paras.length) {
    const d = h('details', { class: 'stopklatka-why' }, h('summary', null, why.title), ...why.paras.map(s => h('p', null, s)));
    if (why.src) d.appendChild(h('p', { class: 'muted' }, why.src));
    out.push(d);
  }
  if (why.not) out.push(h('p', { class: 'muted' }, why.not));

  // ── the care ──
  out.push(h('p', { class: 'muted' }, t('panel.help')));
  if (!why.not) out.push(h('p', { class: 'muted' }, t('panel.not')));
  return out;
}
