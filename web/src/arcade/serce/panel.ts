/**
 * Z głowy do serca's "Postępy" card in the lobby (DESIGN.md §18.5, round 16), from the app's shared classes (styles.css):
 *
 *   the numbers     the most lights, sessions, whole ways, stages walked
 *   stage length    "Długość etapu" 2:00 · 2:30 · 3:00 · 3:30 · 4:00 — each stage at least that long, longer when the
 *                   light needs more time (the one place it is set; the Rytm row sets a push's length and the rests)
 *   your way        the nine stages (✓ walked, ◉ next, ○ waiting, – ring 4 left out today), a tap makes one the next
 *                   session's start; this session's forecast for the chosen session length and stage length
 *                   ("W 10 min: Serce · Ja · Rodzina — dalej następnym razem"), the same rules the session follows
 *   Twoje kręgi     names or initials for rings 1–4 (comma-separated, up to 8 a ring, 24 characters each), plain text,
 *                   kept only on this device; ring 4 with its care note and "leave this circle out today"
 *   the heart word  the Jesus Prayer, "Jezu", "Abba, Ojcze", "Maranatha", or own words (≤ 60 characters)
 *   the breath      the rests' breath as presets (5 · 5 by default)
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes from it and redraws its forecast
 * when another is chosen.  Built with h(); a choice saves the progress and redraws the card.  Text the player types is
 * set as text, never as markup.
 */
import { fmtNum } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, sameBreath } from '../kit/breath';
import { dayKey } from '../kit/progress';
import { WAY_LEN, WORDS, cleanOwn, ringName, stageLabel, stageTitle, wordName, type Ring } from './content';
import { t, type Key } from './i18n';
import {
  bestOf, namesOf, setBreath, setNames, setOwn, setSkip4, setStageSec, setStart, setWord, skip4Today, startStage, type SerceProgress,
} from './meta';
import { forecast, resolveStart } from './plan';
import { RULES } from './rules';
import { pageTime } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string | Node[], onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, ...(Array.isArray(text) ? text : [text]));
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  b.style.minHeight = '44px';
  b.style.minWidth = '44px';
  return b;
}

/** "3:00" */
const minSec = (s: number): string => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** The session length the lobby has chosen (s): its ?trainingSec, the checked minutes, else the last session's. */
export function sessionSec(p: SerceProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s ("W 10 min: Serce · Ja · Rodzina — dalej następnym razem."). */
export function forecastLine(p: SerceProgress, sec: number, day: string = dayKey()): string {
  const first = p.sessions === 0;
  const card = first && !p.seen.includes('s.open') && sec > 60 ? pageTime(0) + pageTime(1) + RULES.telegraph + 2 : 0;
  const fc = forecast({ plannedSec: sec, stageSec: p.stageSec, next: startStage(p), firstEver: first, skip4: skip4Today(p, day), pattern: p.breath, eeg: false, warmSec: card });
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  const more = fc.slots.some(s => s.kind === 'more');
  if (fc.whole && fc.start === 0) return t(more ? 'panel.fcAllMore' : 'panel.fcAll', { min });
  const names = fc.slots.filter(s => s.kind !== 'reentry' && s.kind !== 'more' && s.way !== null).map(s => stageLabel(s.way!));
  if (more) names.push(t('panel.fcMore'));
  const list = `${fc.reentry ? `${t('panel.fcEnter')} ` : ''}${names.join(' · ')}`;
  return t(fc.whole ? 'panel.fcEnd' : 'panel.fc', { min, list });
}

/** The card whose forecast follows the lobby's session length (the latest one built). */
let refresh: (() => void) | null = null;
let hooked = false;
function hookLength(): void {
  if (hooked || typeof document === 'undefined') return;
  const box = document.getElementById('arcadeLen');
  if (!box) return;
  hooked = true;
  // the lobby marks the chosen length on the button first; this runs as the click bubbles
  box.addEventListener('click', () => refresh?.());
}

export function progressPanel(p: SerceProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, fc, () => {
      save();
      render();
    })) root.appendChild(el);
    fc.textContent = forecastLine(p, sessionSec(p));
  };
  render();
  refresh = () => { if (fc.isConnected) fc.textContent = forecastLine(p, sessionSec(p)); };
  hookLength();
  return root;
}

/** One ring's names: a text field (comma-separated) with its count, saved on Enter or "Zapisz". */
function namesField(p: SerceProgress, r: Ring, changed: () => void): HTMLElement[] {
  const input = h('input', {
    type: 'text', maxlength: String(RULES.namesMax * (RULES.nameMax + 2)), placeholder: t('panel.namesPh'), 'aria-label': `${t('panel.circles')}: ${ringName(r)}`,
    autocomplete: 'off', autocapitalize: 'words',
  }) as HTMLInputElement;
  input.value = namesOf(p, r).join(', ');
  const count = h('span', { class: 'muted' }, t('panel.namesCount', { n: namesOf(p, r).length }));
  const keep = () => {
    setNames(p, r, input.value);
    changed();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
  input.addEventListener('change', keep);
  const row = h('div', { class: 'row' }, button(t('panel.save'), keep, 'btn primary'));
  if (namesOf(p, r).length) row.append(button(t('panel.clear'), () => { setNames(p, r, ''); changed(); }, 'btn ghost'));
  return [h('label', { class: 'f' }, h('span', null, `${r} · ${ringName(r)} — `, count), input), row];
}

/** The nine stages as a list to pick the next session's start from (✓ walked, ◉ next, ○ waiting, – left out today). */
function wayList(p: SerceProgress, day: string, changed: () => void): HTMLElement {
  const next = resolveStart(startStage(p), skip4Today(p, day));
  const list = h('div', { role: 'radiogroup', 'aria-label': t('panel.way') });
  list.style.display = 'grid';
  list.style.gap = '6px';
  list.style.maxWidth = '520px';
  for (let i = 0; i < WAY_LEN; i++) {
    const out = i === 6 && skip4Today(p, day);
    const state = out ? 'out' : i === next ? 'next' : i < next ? 'done' : 'wait';
    const mark = { out: '–', next: '◉', done: '✓', wait: '○' }[state];
    const word = t(`panel.way${state === 'out' ? 'Out' : state === 'next' ? 'Next' : state === 'done' ? 'Done' : 'Wait'}` as Key);
    const markEl = h('span', { 'aria-hidden': 'true' }, mark);
    markEl.style.width = '1.2em';
    markEl.style.flex = 'none';
    const label = h('span', null, `${i + 1}. ${stageTitle(i)}`);
    label.style.flex = '1';
    label.style.textAlign = 'left';
    const small = h('small', { class: 'muted' }, word);
    small.style.flex = 'none';
    const b = button([markEl, label, small], () => { setStart(p, i); changed(); }, 'btn', {
      role: 'radio', 'aria-checked': String(state === 'next'), 'aria-label': `${i + 1}. ${stageTitle(i)} — ${word}`,
    });
    b.style.justifyContent = 'flex-start';
    b.style.width = '100%';
    if (state === 'out') b.style.opacity = '0.6';
    list.append(b);
  }
  return list;
}

function build(p: SerceProgress, fc: HTMLElement, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.ways'), fmtNum(p.ways)),
    stat(t('panel.stagesAll'), fmtNum(p.stages))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')));
  const day = dayKey();

  // ── the stage length (the one place it is set) ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.stageLen')));
  // five equal columns: one row on a 360-px phone
  const lens = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.stageLen') },
    RULES.stageLens.map(sec => {
      const b = button(minSec(sec), () => { setStageSec(p, sec); changed(); }, p.stageSec === sec ? 'btn on' : 'btn', {
        role: 'radio', 'aria-checked': String(p.stageSec === sec),
      });
      b.style.paddingLeft = '0';
      b.style.paddingRight = '0';
      return b;
    }));
  lens.style.display = 'grid';
  lens.style.gridTemplateColumns = `repeat(${RULES.stageLens.length}, minmax(0, 1fr))`;
  lens.style.maxWidth = '420px';
  out.push(lens);
  out.push(h('p', { class: 'muted' }, t('panel.stageLenNote')));

  // ── your way: the forecast, the nine stages ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.way')), fc, wayList(p, day, changed), h('p', { class: 'muted' }, t('panel.wayNote')));

  // ── your circles ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.circles')), h('p', { class: 'muted' }, t('panel.circlesNote')));
  for (const r of [1, 2, 3] as Ring[]) out.push(...namesField(p, r, changed));
  // ring 4, with care
  const skip = skip4Today(p, day);
  out.push(h('p', null, t('panel.ring4Note')));
  out.push(...namesField(p, 4, changed));
  const box = h('input', { type: 'checkbox', 'aria-label': t('panel.skip4') }) as HTMLInputElement;
  box.checked = skip;
  box.addEventListener('change', () => {
    setSkip4(p, day, box.checked);
    changed();
  });
  out.push(h('label', { class: 'switch' }, box, h('span', null, t('panel.skip4'))));
  if (skip) out.push(h('p', { class: 'muted' }, t('panel.skip4On')));

  // ── the words of the heart ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.word')), h('p', { class: 'muted' }, t('panel.wordNote')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.word') },
    WORDS.map(w => button(wordName(w), () => { setWord(p, w); changed(); }, p.word === w ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.word === w) }))));
  if (p.word === 'own') {
    const input = h('input', { type: 'text', maxlength: String(RULES.ownMax), placeholder: t('panel.ownPh'), 'aria-label': wordName('own'), autocomplete: 'off' }) as HTMLInputElement;
    input.value = p.own;
    const count = h('span', null, t('panel.ownCount', { n: [...input.value].length }));
    input.addEventListener('input', () => { count.textContent = t('panel.ownCount', { n: [...cleanOwn(input.value)].length }); });
    const keep = () => { setOwn(p, input.value); changed(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
    out.push(h('p', { class: 'muted' }, t('panel.ownNote')), h('label', { class: 'f' }, count, input), h('div', { class: 'row' }, button(t('panel.save'), keep, 'btn primary')));
  }

  // ── the breath ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t('panel.breathNote')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
    (Object.entries(BREATH_PRESETS) as [keyof typeof BREATH_PRESETS, (typeof BREATH_PRESETS)['even']][]).map(([k, pat]) => {
      const on = sameBreath(p.breath, pat);
      return button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
    })));
  out.push(h('p', { class: 'muted' }, t('panel.privacy')));
  return out;
}
