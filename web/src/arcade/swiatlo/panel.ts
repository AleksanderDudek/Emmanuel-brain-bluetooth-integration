/**
 * Światło ciała's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, how the game works in one paragraph (with its honesty: a typical body, sped up, sources; the
 * only reading is the pulse), the day's organ, the body map (nine organs, three depths each, golden ones
 * ringed), the Wiedza cards met (each with its number and source) and the song's switch.  Built with h();
 * the switch saves at once.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { ALL_CARDS, DEPTHS, ORGAN, ORGANS, dayOrgan, depthName, factSource, factText, organName, type Depth, type OrganId } from './content';
import { ORGAN_SHAPES, ORGAN_SPOT, spline, type Shape } from './figure';
import { t } from './i18n';
import { bestOf, mapLit, mapRating, type SwiatloProgress } from './meta';
import { daySeed } from '../kit/progress';
import { rgbaPrefix } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** An organ's shapes for a tile: a pair shows its right-hand one, bigger. */
function tileShapes(o: OrganId): readonly Shape[] {
  const all = ORGAN_SHAPES[o];
  if (!ORGAN_SPOT[o].pair) return all;
  const meanX = (s: Shape) => (s.kind === 'ellipse' ? s.x : s.pts.reduce((a, q) => a + q[0], 0) / s.pts.length);
  return all.filter(s => meanX(s) > 0);
}

/** The extent of shapes in figure units. */
function extent(shapes: readonly Shape[]): { cx: number; cy: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes) {
    const pts = s.kind === 'ellipse' ? [[s.x - s.rx, s.y - s.ry], [s.x + s.rx, s.y + s.ry]] : s.pts;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(0.01, x1 - x0), h: Math.max(0.01, y1 - y0) };
}

/** A little tile of an organ: its shape, lit in its colour when it was ever lit (a gold frame when golden). */
function tile(o: OrganId, p: SwiatloProgress): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (!ctx || typeof Path2D === 'undefined') return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b1430';
  ctx.fillRect(0, 0, 52, 40);
  const best = Math.max(...DEPTHS.map(d => mapRating(p, o, d)));
  const spec = ORGAN[o];
  const shapes = tileShapes(o);
  const box = extent(shapes);
  const k = Math.min(40 / box.w, 28 / box.h);
  const map = (x: number, y: number): [number, number] => [26 + (x - box.cx) * k, 20 + (y - box.cy) * k];
  const lit = best > 0;
  const fill = new Path2D();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of shapes) {
    if (s.kind === 'blob') spline(fill, s.pts, map, true);
    else if (s.kind === 'ellipse') {
      const [x, y] = map(s.x, s.y);
      fill.moveTo(x + s.rx * k, y);
      fill.ellipse(x, y, s.rx * k, s.ry * k, s.rot ?? 0, 0, Math.PI * 2);
    } else {
      const line = new Path2D();
      spline(line, s.pts, map, false);
      ctx.strokeStyle = lit ? spec.hue : `${rgbaPrefix(spec.deep)}.95)`;
      ctx.lineWidth = Math.max(2, s.width * k);
      ctx.stroke(line);
    }
  }
  ctx.fillStyle = lit ? spec.hue : `${rgbaPrefix(spec.deep)}.85)`;
  ctx.fill(fill);
  ctx.strokeStyle = lit ? 'rgba(255,255,255,.85)' : `${rgbaPrefix(spec.hue)}.45)`;
  ctx.lineWidth = 1;
  ctx.stroke(fill);
  if (best >= 3) {
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1.5, 1.5, 49, 37);
  }
  return c;
}

export function progressPanel(p: SwiatloProgress, save: () => void): HTMLElement {
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

function build(p: SwiatloProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const lit = mapLit(p);
  const today = dayOrgan(daySeed('swiatlo'));
  // the body map: an album of the nine organs, three depths each
  const map = h('div', { class: 'arcade-album' }, ORGANS.map(o => {
    const marks = DEPTHS.map(d => {
      const r = mapRating(p, o, d);
      return r >= 3 ? '★' : r > 0 ? '●' : '○';
    }).join('');
    const any = DEPTHS.some(d => mapRating(p, o, d) > 0);
    return h('div', { class: any ? 'on' : null, title: `${organName(o)}: ${DEPTHS.map(d => depthName(d)).join(' · ')}` }, tile(o, p), organName(o), h('small', null, marks));
  }));
  // the Wiedza cards met, newest first
  const met = [...p.cards].reverse().filter(id => ALL_CARDS.includes(id));
  const cards = met.map(id => {
    const [o, d] = id.split(':') as [OrganId, string];
    const depth = Number(d) as Depth;
    return h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, `${organName(o)} · ${depthName(depth)}`), h('p', null, factText(o, depth)), h('p', { class: 'muted' }, t('hud.source', { s: factSource(o, depth) }))));
  });
  // the song's switch
  const input = h('input', { type: 'checkbox', 'aria-label': t('panel.song') }) as HTMLInputElement;
  input.checked = p.song;
  input.addEventListener('change', () => {
    p.song = input.checked;
    changed();
  });
  const song = h('label', { class: 'switch' }, input, h('span', null, t('panel.song')));
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.scans'), fmtNum(p.scans)),
      stat(t('panel.golden'), fmtNum(p.golden)),
      stat(t('panel.depth'), depthName(Math.min(3, Math.max(1, p.depth)) as Depth))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('p', null, t('panel.day', { organ: organName(today) })),
    h('p', { class: 'muted' }, t('panel.pulse')),
    h('div', { class: 'arcade-sub' }, `${t('panel.map')} · ${lit.lit}/${lit.all}`),
    map,
    h('p', { class: 'muted' }, t('panel.mapNote')),
    h('div', { class: 'arcade-sub' }, t('panel.cards', { have: p.cards.length, all: ALL_CARDS.length })),
    ...(cards.length ? cards : [h('p', { class: 'muted' }, t('panel.locked'))]),
    h('div', { class: 'arcade-sub' }, t('panel.song')),
    song,
    h('p', { class: 'muted' }, t('panel.songNote')),
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
