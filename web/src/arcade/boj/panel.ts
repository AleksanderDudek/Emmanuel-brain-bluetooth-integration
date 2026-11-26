/**
 * Dobry bój's "Postępy" card in the lobby (DESIGN.md §25), from the app's shared classes (styles.css), mobile first:
 *
 *   the numbers    fights won, knockouts, the most landed strikes in a session, landed strikes in all (belts when won)
 *   next           the next opponent on the ladder: the ring name and a line on how they fight
 *   the fighter    the style (Boks / MMA, with what it allows), the division (Zawodniczka / Zawodnik), the skin tone
 *                  (five swatches) and the hair — the lobby's hero shows the choice at once
 *   the forecast   for the lobby's length: the rounds, their length, the corner (the same plan the session follows)
 *   how it works   the read → the slow motion → the choice and the focus, in three lines
 *   the spirit     a sport with rules and respect
 *
 * The session length is the lobby's (#arcadeLen): the card reads the chosen minutes and redraws its forecast when
 * another is chosen.  Built with h(); a choice saves the progress and redraws the card.  No inline style attributes
 * (the CSP): sizes and the swatches' colours are set on the elements' CSSOM.
 */
import { fmtNum } from '../../i18n';
import { SESSION_MINUTES, plannedSeconds } from '../../settings';
import { h } from '../../ui/dom';
import { HAIRS, LADDER, SKIN_SWATCH, ladderOf } from './content';
import { t, type Key } from './i18n';
import { SEXES, bestOf, setHair, setSex, setSkin, setStyle, type BojProgress } from './meta';
import { STYLES } from './moves';
import { fightPlan, planFor } from './rules';
import { foeName } from './sim';

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
export function sessionSec(p: BojProgress): number {
  const box = typeof document !== 'undefined' ? document.getElementById('arcadeLen') : null;
  const i = box ? [...box.querySelectorAll('button')].findIndex(b => b.getAttribute('aria-checked') === 'true') : -1;
  const m = i >= 0 ? SESSION_MINUTES[i] : undefined;
  if (m) return plannedSeconds(m);
  return p.lastLen > 0 ? p.lastLen : 300;
}

/** This session's forecast in words for a session of `sec` s (the design's rhythm): the first fight's rounds. */
export function forecastLines(sec: number): string[] {
  const plan = planFor({ plannedSec: sec, eeg: false });
  const f = fightPlan(plan, plan.intro);
  const min = fmtNum(sec / 60, sec % 60 ? 1 : 0);
  const words = { min, rounds: t('rounds', { n: f.rounds }), len: Math.round(f.len), corner: Math.round(plan.corner) };
  const out = [t(f.rounds > 1 ? 'panel.fc' : 'panel.fcOne', words)];
  if (!f.last || sec >= 600) out.push(t('panel.fcMore'));
  return out;
}

let refresh: (() => void) | null = null;
let hooked = false;
function hookLength(): void {
  if (hooked || typeof document === 'undefined') return;
  const box = document.getElementById('arcadeLen');
  if (!box) return;
  hooked = true;
  box.addEventListener('click', () => refresh?.());
}

export function progressPanel(p: BojProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const fc = h('p', { class: 'muted', 'aria-live': 'polite' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, fc, () => { save(); render(); })) root.appendChild(el);
    fc.textContent = forecastLines(sessionSec(p)).join(' ');
  };
  render();
  refresh = () => { if (fc.isConnected) fc.textContent = forecastLines(sessionSec(p)).join(' '); };
  hookLength();
  return root;
}

function seg(label: string, items: { text: string; on: boolean; pick: () => void }[]): HTMLElement {
  const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label },
    items.map(it => button(it.text, it.pick, it.on ? 'btn on' : 'btn', { role: 'radio', 'aria-checked': String(it.on) })));
  el.style.flexWrap = 'wrap';
  return el;
}

function build(p: BojProgress, fc: HTMLElement, changed: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const best = bestOf(p);
  const stats = [
    stat(t('panel.wins'), `${fmtNum(p.wins)} / ${fmtNum(p.fights)}`),
    stat(t('panel.kos'), fmtNum(p.kos)),
    stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
    stat(t('panel.strikes'), fmtNum(p.strikes)),
  ];
  if (p.titles > 0) stats.push(stat(t('panel.titles'), fmtNum(p.titles)));
  out.push(h('div', { class: 'arcade-stats' }, ...stats));

  // ── the next opponent ──
  const foe = ladderOf(p.ladder);
  const champ = foe.id === LADDER[LADDER.length - 1].id;
  out.push(h('div', { class: 'arcade-sub' }, t('panel.next')),
    h('p', null, h('strong', null, foeName(foe, p.sex)), champ ? ` · ${t('panel.champ')}` : '', ` — ${t(`foeLine.${foe.id}` as Key)}`));

  // ── the fighter ──
  out.push(h('div', { class: 'arcade-sub' }, t('panel.style')));
  out.push(seg(t('panel.style'), STYLES.map(s => ({ text: t(`style.${s}` as Key), on: p.style === s, pick: () => { if (setStyle(p, s)) changed(); } }))));
  out.push(h('p', { class: 'muted' }, t(p.style === 'mma' ? 'panel.mmaNote' : 'panel.boksNote')));
  out.push(h('div', { class: 'arcade-sub' }, t('panel.fighter')));
  out.push(seg(t('panel.fighter'), SEXES.map(s => ({ text: t(`sex.${s}` as Key), on: p.sex === s, pick: () => { if (setSex(p, s)) changed(); } }))));
  out.push(h('div', { class: 'arcade-sub' }, t('panel.skin')));
  const skins = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('panel.skin') },
    SKIN_SWATCH.map((c, i) => {
      const on = p.skin === i;
      const b = button('', () => { if (setSkin(p, i)) changed(); }, on ? 'btn on' : 'btn', {
        role: 'radio', 'aria-checked': String(on), 'aria-label': t('skin.n', { n: i + 1 }), title: t('skin.n', { n: i + 1 }),
      });
      b.style.width = '44px';
      b.style.padding = '0';
      b.style.background = c;
      b.style.borderRadius = '50%';
      b.style.outline = on ? '3px solid currentColor' : '';
      b.style.outlineOffset = '2px';
      return b;
    }));
  skins.style.flexWrap = 'wrap';
  skins.style.gap = '10px';
  out.push(skins);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.hair')));
  out.push(seg(t('panel.hair'), Array.from({ length: HAIRS }, (_, i) => ({ text: t(`hair.${i}` as Key), on: p.hair === i, pick: () => { if (setHair(p, i)) changed(); } }))));

  // ── the forecast, how it works, the spirit ──
  out.push(fc);
  out.push(h('div', { class: 'arcade-sub' }, t('panel.how')));
  const how = h('ol', { class: 'muted' }, h('li', null, t('panel.how1')), h('li', null, t('panel.how2')), h('li', null, t('panel.how3')));
  out.push(how);
  out.push(h('p', { class: 'muted' }, t('panel.spirit')));
  return out;
}
