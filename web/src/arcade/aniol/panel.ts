/**
 * Anioł Stróż's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records; the child's dreams (five dreams of three nights, each night's stars, the next night
 * marked); the angel's rank and the feathers to the next; the tree of gifts bought with feathers
 * (three branches, two upgrades each, four levels, the numbers shown); the child's room with its seven
 * cosy things; the gifts a night can offer at this rank; the day's gift.  Built with h() and
 * createElement; a purchase rebuilds the card and saves.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { CHAPTERS, RANKS, ROOM, UPS, chapterName, roomName, type RoomItem, type UpId } from './content';
import { feathers, t } from './i18n';
import { bestOf, buyUp, canBuy, chapterOf, giftPool, nextRankAt, nightInChapter, rankOf, roomItems, starsTotal, upPrice, upShare, type AniolProgress } from './meta';
import { C, SANS, font, paintRoomTile, paintStar } from './paint';
import { RULES } from './rules';

const TAU = Math.PI * 2;

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvas(w: number, hh: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx);
  }
  return c;
}

function tile(item: RoomItem, own: boolean): HTMLElement {
  const name = roomName(item);
  return h('div', { class: own ? 'on' : null, title: own ? name : t('panel.itemHidden') }, canvas(52, 40, ctx => paintRoomTile(ctx, 52, 40, item, own)), own ? name : '?');
}

/** The dreams' colours (the attic's wood, the forest's moss, the sea, the clouds). */
const DREAM_COL = ['#3b3a72', '#6b4630', '#2f4a35', '#1f3270', '#7a6ab8'];

/** The child's dreams: a medallion for each, three nights' stars under it, the next night ringed. */
function paintMap(ctx: CanvasRenderingContext2D, w: number, hh: number, p: AniolProgress): void {
  const n = CHAPTERS.length, step = w / n, cy = hh * 0.4, r = Math.min(step * 0.32, hh * 0.3);
  const now = chapterOf(p.night);
  for (let i = 0; i < n; i++) {
    const x = step * (i + 0.5);
    if (i < n - 1) {
      ctx.strokeStyle = i < now ? 'rgba(245,201,106,.7)' : 'rgba(255,255,255,.15)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + r + 3, cy);
      ctx.lineTo(x + step - r - 3, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const open = i <= now;
    ctx.fillStyle = open ? DREAM_COL[i] : '#2a2a40';
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.fill();
    if (i === now) {
      ctx.strokeStyle = C.goldLight;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = open ? '#fff3c4' : 'rgba(255,255,255,.3)';
    ctx.font = font(800, 11, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, cy + 0.5);
    for (let k = 0; k < RULES.nightsPer; k++) {
      const stars = p.stars[i * RULES.nightsPer + k] ?? 0;
      for (let s = 0; s < 3; s++) {
        paintStar(ctx, x - 14 + k * 14 + (s - 1) * 4, cy + r + 9 + (s === 1 ? -2 : 0), 2.4, 1, s < stars ? C.gold : 'rgba(255,255,255,.18)');
      }
    }
    ctx.fillStyle = open ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)';
    ctx.font = font(650, 9.5, SANS);
    ctx.fillText(open ? chapterName(CHAPTERS[i].id) : '?', x, cy + r + 24);
  }
}

/** A button that changes the progress: disabled when it cannot. */
function button(label: string, can: boolean, onClick: () => void): HTMLButtonElement {
  const b = h('button', { class: can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.addEventListener('click', () => { if (can) onClick(); });
  return b;
}

const pct = (v: number): number => Math.round(v * 100);

function build(p: AniolProgress, changed: () => void): HTMLElement[] {
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
  const map = canvas(340, 100, ctx => paintMap(ctx, 340, 100, p));
  map.style.width = '100%';
  map.style.maxWidth = '460px';
  map.style.height = 'auto';
  const ch = CHAPTERS[chapterOf(p.night)];
  // the tree of gifts: a row per upgrade, its numbers now and after the next level
  const ups = UPS.map(u => {
    const lvl = p.up[u.id] ?? 0, price = upPrice(p, u.id);
    const now = pct(upShare(u.id, lvl)), after = pct(upShare(u.id, lvl + 1));
    const needs = u.needs && (p.up[u.needs] ?? 0) < 1 ? u.needs : null;
    const right = price === null
      ? h('span', { class: 'badge ok' }, t('panel.max'))
      : needs ? h('span', { class: 'badge' }, t('panel.needs', { name: t(`up.${needs}`) }))
        : button(t('panel.buy', { n: fmtNum(price) }), canBuy(p, u.id), () => { if (buyUp(p, u.id as UpId)) changed(); });
    right.style.marginLeft = 'auto';
    // the number now, and after the next level: "Zasięg ciosu +5→10%"
    const text = t(`up.${u.id}.text`, { n: price === null ? String(now) : `${now}→${after}` });
    return h('div', { class: 'arcade-daily', 'data-up': u.id },
      h('div', null, h('b', null, `${t(`branch.${u.branch}`)} · ${t(`up.${u.id}`)} · ${lvl}/${RULES.upMax}`), h('p', null, text)), right);
  });
  const own = roomItems(rank);
  const album = h('div', { class: 'arcade-album' }, ROOM.map(item => tile(item, own.includes(item))));
  const gifts = h('div', { class: 'arcade-chips' }, giftPool(rank).map(g => h('span', { title: g.text }, g.name)));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daygift.title')), h('p', null, gifted ? t('daygift.done') : t('daygift.todo', { feathers: feathers(RULES.dayGift) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.koszmary'), fmtNum(p.koszmary)),
      stat(t('panel.combo'), p.bestCombo ? fmtNum(p.bestCombo) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.map')),
    map,
    h('p', { class: 'muted' }, `${t('panel.next', { dream: chapterName(ch.id), n: nightInChapter(p.night) })} · ${t('panel.stars', { n: starsTotal(p) })}`),
    meter,
    h('div', { class: 'arcade-sub' }, `${t('panel.tree')} · ${t('panel.wallet', { n: fmtNum(p.wallet) })}`),
    ...ups,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.room', { have: own.length, total: ROOM.length })), album,
    h('div', { class: 'arcade-sub' }, t('panel.gifts')), gifts,
    gift,
  ];
}

export function progressPanel(p: AniolProgress, save: () => void = () => {}): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const changed = () => {
    root.replaceChildren(...build(p, changed));
    save();
  };
  root.replaceChildren(...build(p, changed));
  return root;
}
