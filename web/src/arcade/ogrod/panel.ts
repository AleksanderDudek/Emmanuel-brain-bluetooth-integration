/**
 * Ogród o świcie's "Postępy" card in the lobby (DESIGN.md §23), from the app's shared classes (styles.css):
 *
 *   the week       "Na ten tydzień" — what the last session left (builder B's `weekCard`), when there is one
 *   the numbers    the most flowers in a session, sessions, flowers in all, ways walked to the dawn
 *   the way        how it goes (only focus does the acts; the settles are whole breaths; what time leaves is finished
 *                  gently, a stone never) and this session's forecast for the lobby's length — "Na 10 min: 6 stacji,
 *                  9 aktów, odpoczynek 3 oddechy" (the same plan the session follows, rules.ts)
 *   the breath     the settles' breath as presets (5 · 5 by default)
 *   Twoja droga    builder B's section (`prepPanel`): the stations and the player's words for each, the 0–10 before,
 *                  its care and privacy lines last — they end the card
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen or the way changes.  Built with h(); text the player typed is set as text, never as markup.
 */
import { fmtNum } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, breathCycle, sameBreath } from '../kit/breath';
import { t, type Key } from './i18n';
import { bestOf, setBreath, type OgrodProgress } from './meta';
import { prepView } from './prep';
import { prepPanel, weekCard } from './prep-panel';
import { planFor } from './rules';

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
export function sessionSec(p: OgrodProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s (the design's rhythm, the player's breath and way). */
export function forecastLines(p: OgrodProgress, sec: number): string[] {
  const v = prepView(p.prep);
  const plan = planFor({
    plannedSec: sec, cyc: breathCycle(p.breath), eeg: false, way: p.prep.way,
    counts: { feelings: v.feelings.length, stones: v.stones.length, lanterns: v.lanterns.length, seeds: v.seeds.length },
  });
  const acts = plan.stations.reduce((n, s) => n + s.acts.length, 0);
  // the settle most acts have (the middle one)
  const all = plan.stations.flatMap(s => s.acts.map(a => a.breaths)).sort((a, b) => a - b);
  const rest = all.length ? all[Math.floor(all.length / 2)] : plan.breaths;
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  const out = [t('panel.fc', { min, stations: t('stations', { n: plan.stations.length }), acts: t('acts', { n: acts }), rest: t('breaths', { n: rest }) })];
  if (plan.short) out.push(t('panel.fcShort'));
  return out;
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

export function progressPanel(p: OgrodProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const fill = (): void => { fc.textContent = forecastLines(p, sessionSec(p)).join(' '); };
  // the lobby's length button and the way's changes redraw it while the card is shown (an old card's never)
  const update = (): void => { if (fc.isConnected) fill(); };
  // the way's section keeps its own state between redraws of the card; a change there redraws the forecast
  const way = prepPanel(p.prep, () => { save(); update(); }, () => sessionSec(p));
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    const week = weekCard(p.prep, p.week);
    if (week) root.appendChild(week);
    for (const el of build(p, fc, () => { save(); render(); })) root.appendChild(el);
    // the card is built before the lobby shows it: the forecast is filled now, not on the first change
    fill();
    // the breath before the way, so the way's care, privacy and "Zapomnij moje słowa" end the card
    for (const el of breathRow(p, () => { save(); render(); })) root.appendChild(el);
    root.appendChild(way);
  };
  render();
  refresh = update;
  hookLength();
  return root;
}

function build(p: OgrodProgress, fc: HTMLElement, changed: () => void): HTMLElement[] {
  void changed;
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.flowers'), fmtNum(p.flowers)),
    stat(t('panel.ways'), fmtNum(p.ways))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), fc);
  const last = p.history[p.history.length - 1];
  if (last && last.before !== null) out.push(h('p', { class: 'muted' }, t('panel.hurtLast', { a: last.before, b: last.after })));
  return out;
}

/** The settles' breath, as presets. */
function breathRow(p: OgrodProgress, changed: () => void): HTMLElement[] {
  return [
    h('div', { class: 'arcade-sub' }, t('panel.breath')),
    h('p', { class: 'muted' }, t('panel.breathNote')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
      (Object.entries(BREATH_PRESETS) as [keyof typeof BREATH_PRESETS, (typeof BREATH_PRESETS)['even']][]).map(([k, pat]) => {
        const on = sameBreath(p.breath, pat);
        return button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
      })),
  ];
}
