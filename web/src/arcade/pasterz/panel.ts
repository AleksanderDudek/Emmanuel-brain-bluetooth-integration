/**
 * Pasterz's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the hundred (the flock toward a hundred sheep and its seasons), the twelve lambs with
 * a name (each painted with its bell, or a silhouette not yet found), the three open missions, the
 * day's hill and the day's gift.  Built with h() and createElement.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { LAMBS, missionById, type Lamb } from './content';
import { sheep, t } from './i18n';
import { bestOf, type PasterzProgress } from './meta';
import { paintLambTile } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function tile(p: PasterzProgress, l: Lamb): HTMLElement {
  const own = p.lambs.includes(l.index);
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLambTile(ctx, 52, 40, l.bell, own);
  }
  return h('div', { class: own ? 'on' : null, title: own ? l.name : t('panel.tileHidden') }, c, own ? l.name : '?');
}

export function progressPanel(p: PasterzProgress): HTMLElement {
  const today = dayKey();
  const best = bestOf(p);
  const bar = h('i');
  bar.style.width = `${Math.round((p.flock / RULES.hundred) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.hundred', { n: p.season + 1 }), h('b', null, t('panel.toHundred', { have: p.flock, need: RULES.hundred }))),
    h('i', null, bar));
  const album = h('div', { class: 'arcade-album' }, LAMBS.map(l => tile(p, l)));
  const log = h('div', { class: 'arcade-chips' }, p.missions.map(id => h('span', null, missionById(id)?.name ?? id)));
  const walked = p.dailyDay === today;
  const daily = h('div', { class: walked ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')), h('p', null, walked ? t('daily.done', { sheep: sheep(p.dailyGathered) }) : t('daily.todo'))),
    h('span', { class: walked ? 'badge ok' : 'badge' }, walked ? '1/1' : '0/1'));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { sheep: sheep(RULES.giftSheep) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.lambs'), fmtNum(p.lambsFound)),
      stat(t('panel.stars'), p.bestStars ? fmtNum(p.bestStars) : '—')),
    meter,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.collection', { have: p.lambs.length, total: LAMBS.length })), album,
    h('div', { class: 'arcade-sub' }, t('panel.log', { n: p.missionsDone })), log,
    daily, gift);
}
