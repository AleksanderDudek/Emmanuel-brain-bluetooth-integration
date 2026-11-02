/**
 * Firmament's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records, the constellation the player is in (its map, the stars of each level), the
 * instruments open and still to come, and the day's gift.  Built with h() and createElement.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import type { ToolKind } from './board';
import { TOOL_NAME, constName } from './content';
import { t } from './i18n';
import { figureOf, toolsFor, traySize } from './levels';
import { bestOf, constStars, starsTotal, type FirmamentProgress } from './meta';
import { C, paintStar, paintToolIcon } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

const dpr = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** The constellation's map: its figure, every level a star (gold with the stars won), the current one ringed. */
function mapCanvas(p: FirmamentProgress, c: number): HTMLElement {
  const W = 300, H = 150, k = dpr();
  const el = h('canvas', { width: String(Math.round(W * k)), height: String(Math.round(H * k)), 'aria-hidden': 'true' });
  el.style.width = '100%';
  el.style.maxWidth = `${W}px`;
  el.style.height = 'auto';
  const ctx = el.getContext('2d');
  if (!ctx) return el;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.night0);
  g.addColorStop(1, C.night2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 12);
  ctx.fill();
  const fig = figureOf(c), stars = constStars(p, c);
  const bx = 18, by = 14, bw = W - 36, bh = H - 28;
  ctx.strokeStyle = 'rgba(158,197,255,.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const [a, b] of fig.lines) {
    ctx.moveTo(bx + fig.pts[a][0] * bw, by + fig.pts[a][1] * bh);
    ctx.lineTo(bx + fig.pts[b][0] * bw, by + fig.pts[b][1] * bh);
  }
  ctx.stroke();
  fig.pts.forEach(([px, py], i) => {
    const x = bx + px * bw, y = by + py * bh, s = stars[i];
    const now = c * RULES.perConst + i === p.level;
    paintStar(ctx, x, y, s ? 6 + s : 5, s ? 1 : 0.35, s ? C.gold : '#dfe6f8');
    if (now) {
      ctx.strokeStyle = 'rgba(255,236,170,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  return el;
}

function toolChip(tool: ToolKind, open: boolean, from: number): HTMLElement {
  const k = dpr();
  const c = h('canvas', { width: String(Math.round(22 * k)), height: String(Math.round(22 * k)), 'aria-hidden': 'true' });
  c.style.width = '22px';
  c.style.height = '22px';
  c.style.verticalAlign = 'middle';
  c.style.marginRight = '6px';
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(0, 0, 22, 22, 6);
    ctx.fill();
    paintToolIcon(ctx, tool, 11, 11, 8, 0.6);
  }
  return h('span', { class: open ? 'on' : null, title: open ? TOOL_NAME[tool] : t('panel.locked', { n: from + 1 }) }, c, open ? TOOL_NAME[tool] : `${TOOL_NAME[tool]} · ${t('panel.locked', { n: from + 1 })}`);
}

export function progressPanel(p: FirmamentProgress): HTMLElement {
  const best = bestOf(p);
  const c = Math.floor(p.level / RULES.perConst);
  const open = toolsFor(c);
  const all: [ToolKind, number][] = [['comet', 0], ['ray', 0], ['swap', 1], ['nova', 2]];
  const chips = h('div', { class: 'arcade-chips' }, all.map(([tool, from]) => toolChip(tool, open.includes(tool), from)), toolChip('pulsar', true, 0));
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const gifted = p.giftDay === day;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo'))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.stars'), fmtNum(starsTotal(p))),
      stat(t('panel.level'), String(p.level + 1))),
    h('div', { class: 'arcade-sub' }, t('panel.map', { name: constName(c), n: (p.level % RULES.perConst) + 1, all: RULES.perConst })),
    mapCanvas(p, c),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.tools', { n: traySize(c) })), chips,
    gift);
}
