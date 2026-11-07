/**
 * Urodzaj's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the circle of fruits (the eleven tiers, each lit once reached), the festival now with its
 * three missions, the table's decorations, and Kosz dnia.  Built with h() and createElement only.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { DECORS, FRUITS, decorName, festName, festivalAt, missionText } from './content';
import { cap, t } from './i18n';
import { decorCount, migrate, missionDone, reached, type UrodzajProgress } from './meta';
import { paintFruit, paintSilhouette } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function fruitTile(tier: number, on: boolean): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.min(17, 6 + tier * 1.05);
    if (on) paintFruit(ctx, null, tier, 26, 21, R, 0, 0, 'calm');
    else paintSilhouette(ctx, tier, 26, 21, R);
  }
  const f = FRUITS[tier - 1];
  return h('div', { class: on ? 'on' : null, title: on ? cap(f.name) : '?' }, c, on ? cap(f.name) : '?');
}

export function progressPanel(raw: UrodzajProgress): HTMLElement {
  const p = migrate(raw);
  const got = reached(p);
  const fest = festivalAt(p.fest);
  const missions = h('div', { class: 'arcade-chips' }, fest.missions.map((m, i) => {
    const done = missionDone(m, p.festProg[i] ?? 0);
    return h('span', { class: done ? 'on' : null }, `${done ? '✓' : '○'} ${missionText(m)}`);
  }));
  const decor = DECORS.slice(0, decorCount(p));
  const today = dayKey();
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), p.sessions > 0 ? fmtNum(p.bestSession) : '—'),
      stat(t('panel.basket'), p.bestBasket > 0 ? fmtNum(p.bestBasket) : '—'),
      stat(t('panel.harvest'), fmtNum(p.harvest)),
      stat(t('panel.baskets'), fmtNum(p.baskets))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.ring', { n: got, total: FRUITS.length })),
    h('div', { class: 'arcade-album' }, FRUITS.map(f => fruitTile(f.tier, f.tier <= got))),
    h('div', { class: 'arcade-sub' }, t('panel.fest', { fest: festName(fest) })),
    missions,
    h('div', { class: 'arcade-sub' }, t('panel.table', { n: decor.length, total: DECORS.length })),
    decor.length
      ? h('div', { class: 'arcade-chips' }, decor.map(d => h('span', null, cap(decorName(d)))))
      : h('p', { class: 'muted' }, t('panel.tableEmpty')),
    h('p', { class: 'muted' }, p.dailyDay === today ? t('panel.dailyDone', { n: p.dailyScore }) : t('panel.daily')));
}
