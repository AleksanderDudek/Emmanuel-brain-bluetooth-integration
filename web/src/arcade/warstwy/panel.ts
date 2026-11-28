/**
 * Warstwy światła's "Postępy" card in the lobby (DESIGN §28), from the app's shared classes (styles.css):
 *
 *   the numbers     the most threads of light, sessions, threads in all, layers brought into the light
 *   the way         how it goes, and this session's forecast for the lobby's length ("Na 10 min: siedem warstw, na każdej
 *                   3 rzeczy do oddania; odpoczynek: 2 oddechy" — the plan the session follows, rules.ts), and that each
 *                   thing fits the player's pace
 *   seven layers    each with its plain name, the tradition's name and what clings to it
 *   Co dziś oddajesz?  one short line per layer, kept only on this device (show in the session / don't; forget them)
 *   the breath      the rests' breath as presets (5 · 5 by default)
 *   care            not therapy, not a treatment, not a prayer of deliverance; a priest or a pastor; the help lines
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen.  Built with h(); a choice saves the progress and redraws the card.  Text the player types is set
 * as a value, never as markup.
 */
import { fmtNum } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { BREATH_PRESETS, breathCycle, sameBreath } from '../kit/breath';
import { LAYERS, OWN_LEN, type LayerId } from './content';
import { t, type Key } from './i18n';
import { bestOf, forgetOwn, ownCount, setBreath, setOwn, type WarstwyProgress } from './meta';
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

/** The session length the lobby has chosen (s): the checked minutes, else the last session's, else 10 minutes. */
export function sessionSec(p: WarstwyProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 600;
}

/** This session's forecast in words for a session of `sec` s (the design's rhythm, the player's breath and pace). */
export function forecastLines(p: WarstwyProgress, sec: number): string[] {
  const plan = planFor({ plannedSec: sec, cyc: breathCycle(p.breath), eeg: false, pace: p.pace });
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  const rest = plan.restBreaths > 0 ? t('restIn', { n: plan.restBreaths }) : '—';
  const out = [t('panel.fc', { min, things: t('things', { n: plan.hooks }), rest })];
  if (p.pace !== null) out.push(t('panel.pace'));
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
  box.addEventListener('click', () => refresh?.());
}

export function progressPanel(p: WarstwyProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, fc, () => {
      save();
      render();
    })) root.appendChild(el);
    fc.textContent = forecastLines(p, sessionSec(p)).join(' ');
  };
  render();
  refresh = () => { if (fc.isConnected) fc.textContent = forecastLines(p, sessionSec(p)).join(' '); };
  hookLength();
  return root;
}

function build(p: WarstwyProgress, fc: HTMLElement, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  out.push(h('div', { class: 'arcade-stats' },
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.sessions'), fmtNum(p.sessions)),
    stat(t('panel.threads'), fmtNum(p.threads)),
    stat(t('panel.layers'), fmtNum(p.layers))));
  out.push(h('p', { class: 'muted' }, t('panel.rules')), fc);

  // ── the seven layers ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.layersTitle')));
  out.push(h('ol', { class: 'warstwy-layers' }, LAYERS.map((L, i) => {
    const li = h('li', { class: `warstwy-layer warstwy-l${i}` },
      t('panel.layerLine', { i: i + 1, name: t(`layer.${L.id}` as Key), trad: t(`trad.${L.id}` as Key), thing: t(`thing.${L.thing}` as Key) }));
    return li;
  })));

  // ── what you give today ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.own')), h('p', { class: 'muted' }, t('panel.ownNote')));
  const inputs = new Map<LayerId, HTMLInputElement>();
  const fields = h('div', { class: 'warstwy-own' }, LAYERS.map(L => {
    const input = h('input', {
      type: 'text', maxlength: String(OWN_LEN), placeholder: t('panel.ownPh'), 'aria-label': t(`layer.${L.id}` as Key), autocomplete: 'off',
    }) as HTMLInputElement;
    input.value = p.own[L.id];
    input.style.minHeight = '44px';
    inputs.set(L.id, input);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); keep(); } });
    return h('label', { class: 'f' }, h('span', null, t(`layer.${L.id}` as Key)), input);
  }));
  const keep = (): void => {
    for (const [id, input] of inputs) setOwn(p, id, input.value);
    changed();
  };
  out.push(fields);
  const row = h('div', { class: 'row' }, button(t('panel.save'), keep, 'btn primary'));
  if (ownCount(p)) row.append(button(t('panel.forget'), () => { forgetOwn(p); changed(); }, 'btn ghost'));
  out.push(row);
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.own') },
    button(t('panel.ownShow'), () => { p.ownOn = true; changed(); }, p.ownOn ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(p.ownOn) }),
    button(t('panel.ownHide'), () => { p.ownOn = false; changed(); }, !p.ownOn ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(!p.ownOn) })));

  // ── the breath ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.breath')), h('p', { class: 'muted' }, t('panel.breathNote')));
  out.push(h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.breath') },
    (Object.entries(BREATH_PRESETS) as [keyof typeof BREATH_PRESETS, (typeof BREATH_PRESETS)['even']][]).map(([k, pat]) => {
      const on = sameBreath(p.breath, pat);
      return button(t(`preset.${k}` as Key), () => { setBreath(p, pat); changed(); }, on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(on) });
    })));

  // ── care ──
  out.push(h('p', { class: 'muted' }, t('panel.care')), h('p', { class: 'muted' }, t('panel.privacy')));
  return out;
}
