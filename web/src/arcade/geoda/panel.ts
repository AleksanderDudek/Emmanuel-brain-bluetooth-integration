/**
 * Geoda's "Postępy" card in the lobby, from the app's shared .arcade-* classes: the records, the
 * mode (Wyprawa or Klasyka: a choice that changes the progress, saves and redraws the card), the
 * map of the chambers with their stars, and the cabinet (nine minerals, each drawn small at the
 * tier polished so far).  Built with h() and createElement.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { drawSpecimen } from './art';
import { chamberName, MINERALS, TIERS } from './content';
import { t } from './i18n';
import { bestOf, found, migrate, totalStars, type GeodaProgress, type Mode } from './meta';

const TIER_CLASS = ['on', 'on rare', 'on epic', 'on legend'];

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function specimenTile(i: number, tier: number | null): HTMLElement {
  const m = MINERALS[i];
  const known = tier !== null;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSpecimen(ctx, 26, 19, 30, i, known ? tier : 0, 1.3);
    if (!known) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#2b2433';
      ctx.fillRect(0, 0, 52, 40);
    }
  }
  const title = known ? t('panel.tile', { mineral: m.title, tier: TIERS[tier] }) : t('panel.notFound');
  return h('div', { class: known ? TIER_CLASS[tier] : '', title }, c, known ? m.title : '?', known ? h('small', null, TIERS[tier]) : null);
}

function modeButton(p: GeodaProgress, mode: Mode, changed: () => void): HTMLButtonElement {
  const on = p.mode === mode;
  const b = h('button', { class: on ? 'btn primary' : 'btn', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'data-mode': mode },
    t(mode === 'adventure' ? 'panel.adventure' : 'panel.classic'));
  b.addEventListener('click', e => {
    e.preventDefault();
    if (p.mode === mode) return;
    p.mode = mode;
    changed();
  });
  return b;
}

/** The chambers so far and the next one: a small strip of stars. */
function chamberMap(p: GeodaProgress): HTMLElement {
  const shown = Math.max(4, Math.min(p.level + 2, 12));
  const from = Math.max(0, p.level + 2 - shown);
  const tiles: HTMLElement[] = [];
  for (let i = from; i < from + shown; i++) {
    const stars = p.stars[i] ?? 0;
    const state = i < p.level ? 'done' : i === p.level ? 'next' : 'later';
    tiles.push(h('span', { title: chamberName(i), class: state === 'done' ? 'on' : null },
      `${i + 1} · ${state === 'later' ? '…' : state === 'next' ? '→' : '★'.repeat(Math.max(1, stars)) + '☆'.repeat(3 - Math.max(1, stars))}`));
  }
  return h('div', { class: 'arcade-chips' }, tiles);
}

export function progressPanel(p: GeodaProgress, save: () => void): HTMLElement {
  migrate(p);
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

function build(p: GeodaProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : `${fmtNum(best)} ct`),
      stat(t('panel.sessions'), fmtNum(p.sessions)),
      stat(t('panel.stars'), fmtNum(totalStars(p))),
      stat(t('panel.bestBoard'), p.bestBoard ? `${fmtNum(p.bestBoard)} ct` : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.mode')),
    h('div', { class: 'seg' }, modeButton(p, 'adventure', changed), modeButton(p, 'classic', changed)),
    h('p', { class: 'muted' }, t(p.mode === 'adventure' ? 'panel.modeAdv' : 'panel.modeClassic')),
    h('div', { class: 'arcade-sub' }, t('panel.map')),
    chamberMap(p),
    h('p', { class: 'muted' }, t('panel.next', { name: chamberName(p.level) })),
    h('div', { class: 'arcade-sub' }, t('panel.cabinet', { have: found(p), total: MINERALS.length })),
    h('div', { class: 'arcade-album' }, MINERALS.map((_, i) => specimenTile(i, p.cabinet[i] ?? null))),
    h('p', { class: 'muted' }, t('panel.rules')),
  ];
}
