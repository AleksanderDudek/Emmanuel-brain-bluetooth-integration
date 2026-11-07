/**
 * Dolina's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * level the next run starts at, the record, the stars and the lambs; the valley's map (the levels
 * around the current one on a climbing path, coloured by era, a guardian's level marked, the stars
 * won under each); the pilgrim's look with the sparks to the next (a portrait of each); the upgrades
 * with their next level for sparks; and the day's gift.  A purchase changes the progress, calls
 * `save()` and redraws the card in place.  Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { ERAS, UPGRADES, eraOfLevel, guardLevel, lookName, upName, upText, type UpId } from './content';
import { sparks as sparksText, t } from './i18n';
import { bestOf, buyUp, lookOf, migrate, nextLookAt, starTotal, starsOf, upLevel, upPrice, type DolinaProgress } from './meta';
import { C, PAL, SANS, TAU, font, paintPortrait, paintUpIcon, rgb } from './paint';
import { RULES } from './rules';

const metres = (n: string): string => t('metres', { n });

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvas(w: number, hh: number, draw: (ctx: CanvasRenderingContext2D) => void, cls?: string): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true', class: cls ?? null });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
  }
  return c;
}

/** A button that changes the progress: disabled when it cannot. */
function button(label: string, can: boolean, primary: boolean, data: Record<string, string>, onClick: () => void): HTMLButtonElement {
  const b = h('button', { class: primary && can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled', ...data }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onClick();
  });
  return b;
}

export function progressPanel(p: DolinaProgress, save: () => void): HTMLElement {
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

/** The valley's map: nine levels around the current one on a climbing path. */
export function paintMap(ctx: CanvasRenderingContext2D, w: number, hh: number, p: DolinaProgress): void {
  const cur = Math.max(1, p.level);
  const first = Math.max(1, cur - 4), n = 9;
  const bg = ctx.createLinearGradient(0, 0, 0, hh);
  bg.addColorStop(0, '#2a2440');
  bg.addColorStop(1, '#16131f');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, hh, 12);
  ctx.fill();
  const pos = (i: number) => {
    const k = i / (n - 1);
    return { x: 22 + k * (w - 44), y: hh - 26 - k * (hh - 56) + Math.sin(i * 1.9) * 8 };
  };
  // the path climbing out of the valley
  ctx.strokeStyle = 'rgba(255,226,170,.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const q = pos(i);
    if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < n; i++) {
    const lv = first + i, q = pos(i);
    const era = ERAS[eraOfLevel(lv)];
    const done = lv < cur, here = lv === cur;
    const r = here ? 11 : guardLevel(lv) ? 10 : 8;
    ctx.fillStyle = done || here ? rgb(PAL[era].accent) : 'rgba(255,255,255,.12)';
    ctx.beginPath();
    if (guardLevel(lv)) {
      // a guardian's level: a diamond
      ctx.moveTo(q.x, q.y - r);
      ctx.lineTo(q.x + r, q.y);
      ctx.lineTo(q.x, q.y + r);
      ctx.lineTo(q.x - r, q.y);
      ctx.closePath();
    } else ctx.arc(q.x, q.y, r, 0, TAU);
    ctx.fill();
    if (here) {
      ctx.strokeStyle = '#fff1c4';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.fillStyle = done || here ? '#16131f' : 'rgba(255,241,196,.5)';
    ctx.font = font(800, 10, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(lv), q.x, q.y + 0.5);
    const stars = starsOf(p, lv);
    for (let s = 0; s < 3 && (done || stars > 0); s++) {
      ctx.fillStyle = s < stars ? C.gold : 'rgba(255,255,255,.18)';
      ctx.beginPath();
      ctx.arc(q.x - 8 + s * 8, q.y + r + 7, 2.6, 0, TAU);
      ctx.fill();
    }
  }
}

function build(p: DolinaProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const look = lookOf(p.sparksAll);
  const next = nextLookAt(p.sparksAll);
  const from = RULES.looks[look];
  const bar = h('i');
  bar.style.width = `${next === null ? 100 : Math.round(((p.sparksAll - from) / (next - from)) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.look', { name: lookName(look) }),
      h('b', null, next === null ? t('panel.lookMax') : t('panel.toLook', { have: fmtNum(p.sparksAll), need: fmtNum(next) }))),
    h('i', null, bar));
  const looks = h('div', { class: 'arcade-album' }, [0, 1, 2, 3].map(i => {
    const own = i <= look, name = lookName(i);
    return h('div', { class: own ? 'on' : null, title: name }, canvas(52, 40, ctx => paintPortrait(ctx, 52, 40, i, own)), own ? name : '?');
  }));
  const map = canvas(320, 120, ctx => paintMap(ctx, 320, 120, p));
  map.style.width = '100%';
  map.style.maxWidth = '420px';
  map.style.height = 'auto';
  const ups = UPGRADES.map((id: UpId) => {
    const lv = upLevel(p, id), price = upPrice(id, lv);
    const right = price === null
      ? h('span', { class: 'badge ok' }, t('panel.upMax'))
      : button(t('panel.buy', { sparks: sparksText(price) }), p.sparks >= price, true, { 'data-up': id }, () => {
        if (buyUp(p, id)) changed();
      });
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' }, canvas(36, 36, ctx => paintUpIcon(ctx, id, 18, 18, 14, lv)),
      h('div', null, h('b', null, `${upName(id)} · ${t('panel.upLevel', { n: lv, max: RULES.upMax[id] })}`), h('p', null, upText(id))), right);
  });
  const today = dayKey();
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daygift.title')), h('p', null, gifted ? t('daygift.done') : t('daygift.todo', { sparks: sparksText(RULES.dayGift) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.level'), fmtNum(Math.max(1, p.level))),
      stat(t('panel.best'), best === null ? '—' : metres(fmtNum(best))),
      stat(t('panel.stars'), fmtNum(starTotal(p))),
      stat(t('panel.lambs'), fmtNum(p.lambs)),
      stat(t('panel.sparks'), fmtNum(p.sparks))),
    h('div', { class: 'arcade-sub' }, t('panel.map')),
    map,
    h('p', { class: 'muted' }, t('panel.mapHint', { n: Math.max(1, p.level) })),
    meter,
    looks,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.ups')),
    ...ups,
    gift,
  ];
}
