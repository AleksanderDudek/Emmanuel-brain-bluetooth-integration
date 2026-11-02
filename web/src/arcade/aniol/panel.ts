/**
 * Anioł Stróż's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records, the angel's rank and the feathers to the next, the child's room with its seven cosy
 * things (each painted, or a silhouette until its rank), the gifts the night can offer at this rank,
 * and the day's gift.  Built with h() and createElement.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { RANKS, ROOM, roomName, type RoomItem } from './content';
import { feathers, t } from './i18n';
import { bestOf, giftPool, nextRankAt, rankOf, roomItems, type AniolProgress } from './meta';
import { paintRoomTile } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function tile(item: RoomItem, own: boolean): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintRoomTile(ctx, 52, 40, item, own);
  }
  const name = roomName(item);
  return h('div', { class: own ? 'on' : null, title: own ? name : t('panel.itemHidden') }, c, own ? name : '?');
}

export function progressPanel(p: AniolProgress): HTMLElement {
  const today = dayKey();
  const best = bestOf(p);
  const rank = rankOf(p.feathers);
  const next = nextRankAt(p.feathers);
  const from = RULES.ranks[rank];
  const bar = h('i');
  bar.style.width = `${next === null ? 100 : Math.round(((p.feathers - from) / (next - from)) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.rank', { name: RANKS[rank] }),
      h('b', null, next === null ? t('panel.rankMax') : t('panel.toRank', { have: fmtNum(p.feathers), need: fmtNum(next) }))),
    h('i', null, bar));
  const own = roomItems(rank);
  const album = h('div', { class: 'arcade-album' }, ROOM.map(item => tile(item, own.includes(item))));
  const gifts = h('div', { class: 'arcade-chips' }, giftPool(rank).map(g => h('span', { title: g.text }, g.name)));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daygift.title')), h('p', null, gifted ? t('daygift.done') : t('daygift.todo', { feathers: feathers(RULES.dayGift) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.koszmary'), fmtNum(p.koszmary)),
      stat(t('panel.combo'), p.bestCombo ? fmtNum(p.bestCombo) : '—')),
    meter,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.room', { have: own.length, total: ROOM.length })), album,
    h('div', { class: 'arcade-sub' }, t('panel.gifts')), gifts,
    gift);
}
