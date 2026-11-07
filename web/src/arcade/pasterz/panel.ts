/**
 * Pasterz's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and crowns, the home flock toward a hundred (Luke 15:4), the hills map (eight hills in
 * turn, each with its crowns, the next one marked), the lost lambs with a name (a collection of
 * twelve), and the wardrobe — cloaks, crooks and Łatek's coats, each owned piece a button that
 * wears it (the choice saves and redraws the card in place).  Built with h(); no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { HILLS, LAMBS, SKINS, hillAt, type Lamb, type SkinKind } from './content';
import { sheep, t } from './i18n';
import { bestOf, migrate, nextUnlock, owns, wear, type PasterzProgress } from './meta';
import { PLAIN, paintCrown, paintDog, paintLambTile, paintShepherd } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvas(w: number, hh: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx);
  }
  return c;
}

function lambTile(p: PasterzProgress, l: Lamb): HTMLElement {
  const own = p.lambs.includes(l.index);
  return h('div', { class: own ? 'on' : null, title: own ? l.name : t('panel.tileHidden') },
    canvas(52, 40, ctx => paintLambTile(ctx, 52, 40, l.bell, own)), own ? l.name : '?');
}

/** A piece of the wardrobe painted small: the shepherd in a cloak, a crook, or Łatek's coat. */
function swatch(kind: SkinKind, index: number, own: boolean): HTMLCanvasElement {
  const s = SKINS[kind][index];
  return canvas(52, 40, ctx => {
    ctx.fillStyle = own ? '#b9c274' : '#cfc8b6';
    ctx.fillRect(0, 0, 52, 40);
    if (!own) ctx.globalAlpha = 0.35;
    if (kind === 'cloak') paintShepherd(ctx, 26, 21, 40, -Math.PI / 2, 0, 0, false, { ...PLAIN, mantle: s.colors[0], stripe: s.colors[1] });
    else if (kind === 'crook') paintShepherd(ctx, 22, 22, 36, 0, 0, 0, false, { ...PLAIN, staff: s.colors[0], tip: s.colors[1] });
    else paintDog(ctx, 26, 21, 40, -0.3, 0, 0, s.colors[0], s.colors[1]);
    ctx.globalAlpha = 1;
  });
}

export function progressPanel(p: PasterzProgress, save: () => void): HTMLElement {
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

function build(p: PasterzProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const bar = h('i');
  bar.style.width = `${Math.round((p.flock / RULES.hundred) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.hundred', { n: p.season + 1 }), h('b', null, t('panel.toHundred', { have: p.flock, need: RULES.hundred }))),
    h('i', null, bar));
  // the hills map: eight in turn, the next one marked, crowns on each
  const next = hillAt(p.hill).index;
  const map = h('div', { class: 'arcade-album' }, HILLS.map(hl => {
    const crowns = p.hillCrowns[hl.index] ?? 0;
    const c = canvas(52, 40, ctx => {
      const g = ctx.createLinearGradient(0, 0, 0, 40);
      g.addColorStop(0, hl.grass[0]);
      g.addColorStop(1, hl.grass[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 52, 40);
      if (hl.river !== 'none') {
        ctx.strokeStyle = '#6e9fb0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if (hl.river === 'v') { ctx.moveTo(24, 0); ctx.bezierCurveTo(34, 14, 16, 26, 28, 40); } else { ctx.moveTo(0, 22); ctx.bezierCurveTo(16, 12, 34, 32, 52, 18); }
        ctx.stroke();
      }
      ctx.strokeStyle = '#a4937a';
      ctx.lineWidth = 2;
      for (let i = 0; i < hl.pens; i++) {
        ctx.beginPath();
        ctx.arc(10 + i * 11, 30 - (i % 2) * 16, 4, 0.5, Math.PI * 2 - 0.2);
        ctx.stroke();
      }
      if (crowns > 0) paintCrown(ctx, 44, 13, 12);
    });
    const label = crowns > 0 ? `${hl.name} · ${crowns}` : hl.name;
    return h('div', { class: hl.index === next ? 'on' : null, title: hl.story }, c, h('small', null, label));
  }));
  const album = h('div', { class: 'arcade-album' }, LAMBS.map(l => lambTile(p, l)));
  // the wardrobe
  const nu = nextUnlock(p);
  const rows: HTMLElement[] = [];
  for (const kind of ['cloak', 'crook', 'dog'] as const) {
    rows.push(h('div', { class: 'arcade-sub' }, t(`panel.${kind}`)));
    rows.push(h('div', { class: 'arcade-album' }, SKINS[kind].map(s => {
      const own = owns(p, kind, s.index);
      const on = p.wear[kind] === s.index;
      const tile = h('div', { class: on ? 'on' : null, title: own ? s.name : t('panel.locked') }, swatch(kind, s.index, own), own ? s.name : '?');
      if (own && !on) {
        tile.setAttribute('role', 'button');
        tile.setAttribute('tabindex', '0');
        const pick = () => {
          if (wear(p, kind, s.index)) changed();
        };
        tile.addEventListener('click', pick);
        tile.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
      }
      return tile;
    })));
  }
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.crowns'), fmtNum(p.crowns)),
      stat(t('panel.lambs'), fmtNum(p.lambsFound))),
    meter,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, `${t('panel.map')} · ${t('panel.mapNext', { hill: hillAt(p.hill).name })}`), map,
    h('div', { class: 'arcade-sub' }, t('panel.collection', { have: p.lambs.length, total: LAMBS.length })), album,
    h('div', { class: 'arcade-sub' }, `${t('panel.wardrobe')} · ${nu ? t('panel.next', { sheep: sheep(nu.left) }) : t('panel.full')}`),
    ...rows,
  ];
}
