/**
 * Rzeka Ezechiela's "Postępy" card in the lobby (DESIGN §18), from the app's shared classes (styles.css):
 *
 *   the numbers    the most leaves, sessions, all the leaves, the leaves laid in prayer
 *   what it is     how it goes, and plainly what it is not (not a treatment; a doctor for what hurts or worries)
 *   the places     where the leaves are laid, in turn (chips that toggle; at least one), how many were laid at each
 *   the label      a matter of the heart in a few words (≤ 40 characters, kept only on this device)
 *   the breath     the rest's pattern: presets, four steppers (0–15 s), one breath's length (the breaths in a rest
 *                  and the step's length: the lobby's Rytm row, round 15)
 *
 * Built with h(); a choice saves the progress and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { BREATH_PHASES, BREATH_PRESETS, breathCycle, sameBreath, type BreathPhase } from '../kit/breath';
import { LABEL_MAX, PLACES, type MarkId } from './content';
import { markName, placeName, t, type Key } from './i18n';
import {
  bestOf, breathOf, laidAll, setBreath, setLabel, stepBreathOf, togglePlace, type EzechielProgress,
} from './meta';
import { secText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function button(text: string, onClick: () => void, cls = 'btn', extra: Record<string, unknown> = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, text);
  b.addEventListener('click', e => {
    e.preventDefault();
    onClick();
  });
  return b;
}

/** A finger-sized button (≥ 44 px each way: the app's .btn is 36 px tall, so the size is set on it). */
function big(b: HTMLButtonElement): HTMLButtonElement {
  b.style.minWidth = '44px';
  b.style.minHeight = '44px';
  return b;
}

export function progressPanel(p: EzechielProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  let note = '';
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    }, note, msg => {
      note = msg;
      render();
      note = '';
    })) root.appendChild(el);
  };
  render();
  return root;
}

function build(p: EzechielProgress, changed: () => void, note: string, refuse: (msg: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.leaves'), fmtNum(p.leaves)),
    stat(t('panel.laid'), fmtNum(laidAll(p)))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), h('p', null, t('panel.not')));
  if (p.deepest > 0) {
    out.push(h('p', { class: 'muted' }, `${t('panel.deepest', { water: markName(p.deepest as MarkId) })} · ${t('panel.rivers', { n: p.rivers })}`));
  }

  // ── the places ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.places')), h('p', { class: 'muted' }, t('panel.placesNote')));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.places') });
  for (const pl of PLACES) {
    const on = p.places.includes(pl);
    const n = p.laid[pl] ?? 0;
    const text = n > 0 ? `${placeName(pl)} · ${n}` : placeName(pl);
    seg.append(big(button(text, () => { if (togglePlace(p, pl)) changed(); }, on ? 'btn on' : 'btn', { 'aria-pressed': String(on) })));
  }
  out.push(seg);

  // ── a matter of the heart ──
  const input = h('input', { type: 'text', maxlength: String(LABEL_MAX), placeholder: t('panel.labelPh'), 'aria-label': t('panel.label') }) as HTMLInputElement;
  input.value = p.label;
  input.style.minHeight = '44px';
  input.style.width = '100%';
  input.addEventListener('change', () => { if (setLabel(p, input.value)) changed(); });
  out.push(h('div', { class: 'arcade-sub' }, t('panel.label')), input, h('p', { class: 'muted' }, t('panel.labelNote')));

  // ── the breath ──
  out.push(...breathCard(p, changed, note, refuse));
  if (p.abideBest > 0) out.push(h('p', null, `${t('panel.longest')}: ${secText(p.abideBest)}`));
  return out;
}

/**
 * The rest's breath: the presets as chips, four steppers (each phase 0…15 s) and one breath's length (how many
 * breaths a rest lasts is the lobby's Rytm row since round 15).  A step that would leave a breath under 2 s is
 * refused, and says why.
 */
function breathCard(p: EzechielProgress, changed: () => void, note: string, refuse: (msg: string) => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const b = breathOf(p);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t('panel.breathNote')));
  const presets = h('div', { class: 'seg', role: 'group', 'aria-label': t('panel.presets') });
  for (const [k, pat] of Object.entries(BREATH_PRESETS)) {
    const on = sameBreath(b, pat);
    presets.append(big(button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { 'aria-pressed': String(on) })));
  }
  out.push(presets);
  for (const ph of BREATH_PHASES) {
    const name = t(`panel.ph.${ph}` as Key);
    const step = (d: number) => () => {
      if (stepBreathOf(p, ph as BreathPhase, d)) changed();
      else refuse(t('panel.tooShort'));
    };
    const less = big(button('−', step(-1), 'btn', { 'aria-label': t('panel.less', { what: name }), disabled: b[ph] <= 0 ? '' : null }));
    const more = big(button('+', step(1), 'btn', { 'aria-label': t('panel.more', { what: name }), disabled: b[ph] >= 15 ? '' : null }));
    out.push(h('div', { class: 'row', role: 'group', 'aria-label': name },
      h('span', { class: 'grow' }, name), less, h('output', { 'aria-live': 'polite' }, t('secs', { n: b[ph] })), more));
  }
  if (note) out.push(h('p', { class: 'task-feedback bad', role: 'alert' }, note));
  // one breath's length; how many breaths a rest lasts, and how long a step of the way, is the lobby's Rytm row
  // (kit/rhythm.ts, round 15) — one place for the rest's rhythm in every game
  out.push(h('p', null, t('panel.cycle', { sec: secText(breathCycle(b)) })), h('p', { class: 'muted' }, t('panel.restRhythm')));
  return out;
}
