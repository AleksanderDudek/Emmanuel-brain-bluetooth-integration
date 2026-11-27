/**
 * Koła światła's "Postępy" card in the lobby (DESIGN.md §28), from the app's shared classes (styles.css):
 *
 *   the numbers    the most petals in a session, sessions, petals in all, full fields reached
 *   the way        how it goes (one wheel after another, only focus brings each true, a prayer after each, the work
 *                  fitted to the session and the player's pace) and this session's forecast for the lobby's length —
 *                  "Na 10 min: każde koło osobno, 1 runda, 4 kroki na koło, modlitwa 2 oddechy." (the plan the
 *                  session follows, rules.ts)
 *   the posture    standing (as the chart) or seated on a low stool
 *   the breath     the rests' breath as presets (5 · 5 by default)
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen.  Built with h().
 */
import { fmtNum } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, breathCycle, sameBreath } from '../kit/breath';
import { t, type Key } from './i18n';
import { POSTURES, bestOf, setBreath, setPosture, type KolaProgress } from './meta';
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
export function sessionSec(p: KolaProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s (the design's rhythm, the player's breath). */
export function forecast(p: KolaProgress, sec: number): string {
  const plan = planFor({ plannedSec: sec, cyc: breathCycle(p.breath), eeg: false });
  const r1 = plan.rounds[0];
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  return t('panel.fc', {
    min, how: t(`grp.${r1.grouping}` as Key), rounds: t('rounds', { n: plan.rounds.length }), steps: t('steps', { n: r1.steps }),
    rest: t('breaths', { n: Math.max(1, plan.breaths) }),
  });
}

/** The card whose forecast follows the lobby's session length (the latest one built). */
let refresh: (() => void) | null = null;
let hooked = false;
function hookLength(): void {
  if (hooked || typeof document === 'undefined') return;
  const box = document.getElementById('arcadeLen');
  if (!box) return;
  hooked = true;
  box.addEventListener('click', () => refresh?.());
}

export function progressPanel(p: KolaProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const fill = (): void => { fc.textContent = forecast(p, sessionSec(p)); };
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    const best = bestOf(p);
    root.appendChild(h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.sessions'), fmtNum(p.sessions)),
      stat(t('panel.petals'), fmtNum(p.petals)),
      stat(t('panel.fields'), fmtNum(p.fields))));
    root.appendChild(h('p', { class: 'muted' }, t('panel.rules')));
    root.appendChild(fc);
    fill();
    const changed = (): void => { save(); render(); };
    root.appendChild(h('div', { class: 'arcade-sub' }, t('panel.posture')));
    root.appendChild(h('p', { class: 'muted' }, t('panel.postureNote')));
    root.appendChild(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.posture') },
      POSTURES.map(ps => {
        const on = p.posture === ps;
        return button(t(`posture.${ps}` as Key), () => { if (setPosture(p, ps)) changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
      })));
    root.appendChild(h('div', { class: 'arcade-sub' }, t('panel.breath')));
    root.appendChild(h('p', { class: 'muted' }, t('panel.breathNote')));
    root.appendChild(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
      (Object.entries(BREATH_PRESETS) as [keyof typeof BREATH_PRESETS, (typeof BREATH_PRESETS)['even']][]).map(([k, pat]) => {
        const on = sameBreath(p.breath, pat);
        return button(t(`preset.${k}` as Key), () => { if (setBreath(p, pat)) changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
      })));
  };
  render();
  refresh = () => { if (fc.isConnected) fill(); };
  hookLength();
  return root;
}
