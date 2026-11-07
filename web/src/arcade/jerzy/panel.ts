/**
 * Jerzy i smok's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records, the kingdom's map (the four towns — freed, held now with the share of scales already
 * knocked off, or later), the circle when the dragons come back stronger, and the armoury's skills
 * kept for good.  Built with h() and createElement.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { ARMOURY, DRAGONS, dragonName, skillById, townName, type DragonSpec } from './content';
import { t } from './i18n';
import { armouryOf, bestOf, dragonAt, hpOf, type JerzyProgress } from './meta';
import { paintTownTile } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function town(spec: DragonSpec, state: 'done' | 'now' | 'later', pct: number): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintTownTile(ctx, 52, 40, spec.kind, spec.arena, state);
  }
  const label = state === 'now' ? `${townName(spec.kind)} · ${t('panel.now', { pct })}` : `${townName(spec.kind)} · ${state === 'done' ? t('panel.done') : t('panel.later')}`;
  return h('div', { class: state === 'later' ? null : 'on', title: `${townName(spec.kind)}: ${dragonName(spec.kind)}` }, c, label);
}

export function progressPanel(p: JerzyProgress): HTMLElement {
  const best = bestOf(p);
  const { spec, circle } = dragonAt(p.dragon);
  const at = p.dragon % DRAGONS.length;
  const pct = Math.round((p.damage / Math.max(1, hpOf(spec, circle))) * 100);
  const map = h('div', { class: 'arcade-album' }, DRAGONS.map((d, i) => town(d, i < at ? 'done' : i === at ? 'now' : 'later', pct)));
  const own = armouryOf(p.driven);
  const armoury = own.length
    ? h('div', { class: 'arcade-chips' }, own.map(id => h('span', { title: skillById(id).text }, skillById(id).name)))
    : h('p', { class: 'muted' }, t('panel.armouryHidden'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.driven'), fmtNum(p.driven)),
      stat(t('panel.swords'), fmtNum(p.swords))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.map')), map,
    circle > 0 ? h('p', { class: 'muted' }, t('panel.circle', { n: circle + 1 })) : null,
    h('div', { class: 'arcade-sub' }, t('panel.armoury', { have: own.length, total: ARMOURY.length })), armoury);
}
