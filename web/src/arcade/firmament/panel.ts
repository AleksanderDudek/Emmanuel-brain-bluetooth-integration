/**
 * Firmament's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the saga map of the constellation the player is in (every level a star, gold with the
 * stars won, the current one ringed), the tools carried into the next night, and how the band earns
 * them.  Built with h() and createElement.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { constName, toolName, type ToolKind } from './content';
import { drawFigure } from './hud';
import { t } from './i18n';
import { bestOf, constStars, migrate, starsTotal, type FirmamentProgress } from './meta';
import { C, paintStar, paintToolIcon } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

const dpr = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** The constellation's map: its figure, every level a star, the stars won under each. */
function mapCanvas(p: FirmamentProgress, c: number): HTMLElement {
  const W = 300, H = 160, k = dpr();
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
  const stars = constStars(p, c);
  const lit = stars.filter(s => s > 0).length;
  drawFigure(ctx, c, { x: 18, y: 12, w: W - 36, h: H - 34 }, Math.max(lit, p.level - c * RULES.perConst), 0, -1);
  // the stars won per level, in a row
  stars.forEach((s, i) => {
    for (let q = 0; q < 3; q++) paintStar(ctx, 22 + i * ((W - 40) / RULES.perConst) + q * 8, H - 12, 3.4, q < s ? 1 : 0, C.gold);
  });
  return el;
}

function toolChip(tool: ToolKind): HTMLElement {
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
  return h('span', { class: 'on' }, c, toolName(tool));
}

export function progressPanel(raw: FirmamentProgress): HTMLElement {
  const p = migrate(raw);
  const best = bestOf(p);
  const c = Math.floor(p.level / RULES.perConst);
  const kit = p.kit.length ? h('div', { class: 'arcade-chips' }, p.kit.map(toolChip)) : h('p', { class: 'muted' }, t('panel.none'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.stars'), fmtNum(starsTotal(p))),
      stat(t('panel.level'), String(p.level + 1))),
    h('div', { class: 'arcade-sub' }, t('panel.map', { name: constName(c), n: (p.level % RULES.perConst) + 1, all: RULES.perConst })),
    mapCanvas(p, c),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.kit')), kit);
}
