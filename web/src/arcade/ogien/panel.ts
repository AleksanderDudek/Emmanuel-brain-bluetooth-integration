/**
 * Ogień's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the records, the
 * player's night sky (one star a session, as bright as the fire it reached), the gallery of fire (every fire
 * and its pictures, the ones still ahead muted, each with how often it was reached and its fastest change),
 * and the verses of the ladder for the fires already reached.  Built with h(); nothing here changes the
 * progress, so there is nothing to save.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { verseCard } from '../kit/scripture';
import { RUNGS, rungName, rungShort, variantName } from './content';
import { t } from './i18n';
import { allForms, bestOf, fireOf, roundOf, skyPlace, starLook, type OgienProgress } from './meta';
import { CANDLE, FIRE, SPIRIT, drawBlaze, drawFlame, drawGlow, seeded } from './paint';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvas(w: number, hh: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D | null } {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true' });
  const g = c.getContext('2d');
  g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, g };
}

/** The player's night sky: every session's star in its fixed place. */
function skyCanvas(p: OgienProgress): HTMLCanvasElement {
  const W = 640, H = 170;
  const { c, g } = canvas(W, H);
  c.classList.add('ogien-sky');
  c.style.width = '100%';
  c.style.height = 'auto';
  c.style.borderRadius = '12px';
  c.style.display = 'block';
  if (!g) return c;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#05061a');
  bg.addColorStop(1, '#1d1636');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const rnd = seeded(9);
  for (let i = 0; i < 180; i++) {
    g.fillStyle = `rgba(230,230,255,${(0.12 + rnd() * 0.35).toFixed(3)})`;
    g.fillRect(rnd() * W, rnd() * H, 1, 1);
  }
  g.globalCompositeOperation = 'lighter';
  for (const st of p.sky) {
    const pl = skyPlace(st.n), look = starLook(st.top);
    const x = 20 + pl.x * (W - 40), y = 12 + pl.y * (H - 24), r = 1.8 + 4.6 * look.size;
    drawGlow(g, x, y, r * 3.4, look.rgb, 0.5);
    drawGlow(g, x, y, r, [255, 252, 240], 0.95, 0.6);
  }
  g.globalCompositeOperation = 'source-over';
  return c;
}

/** A form's little picture: the fire as an icon on its scene's colour. */
function formTile(rung: number, variant: number, on: boolean): HTMLCanvasElement {
  const W = 52, H = 40;
  const { c, g } = canvas(W, H);
  if (!g) return c;
  const BG: readonly (readonly [string, string])[] = [
    ['#2b1712', '#0a0608'], ['#132050', '#2a1a22'], ['#0d1638', '#08080f'], ['#14123e', '#141024'],
    ['#0c0a20', '#020208'], ['#2a0e2a', '#06030c'], ['#4a4686', '#f4ae7c'],
  ];
  const bgc = variant > 0 && rung === 4 ? ['#081228', '#020208'] : BG[rung];
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, bgc[0]);
  gr.addColorStop(1, bgc[1]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = on ? 1 : 0.35;
  g.globalCompositeOperation = 'lighter';
  const x = W / 2, y = H * 0.78;
  switch (rung) {
    case 0: drawGlow(g, x, y - 6, 9, [255, 170, 80], 0.9); break;
    case 1: drawGlow(g, x, y - 14, 12, [255, 200, 120], 0.6); break;
    case 4: drawGlow(g, x, H / 2, 16, variant ? [170, 200, 255] : [255, 210, 130], 0.9, 0.4); break;
    case 5: drawGlow(g, x, H / 2, 19, variant ? [120, 160, 255] : [255, 110, 70], 0.9, 0.3); break;
    default: drawGlow(g, x, y - 10, 16, [255, 150, 70], 0.6); break;
  }
  g.globalCompositeOperation = 'source-over';
  if (rung === 0) drawFlame(g, x, y - 4, 6, 10, 1, 0.5, FIRE, 0, 1);
  else if (rung === 1) {
    g.fillStyle = '#f4e8cc';
    g.fillRect(x - 3, y - 10, 6, 12);
    drawFlame(g, x, y - 10, 5, 12, 1, 0.5, CANDLE, 0, 2);
  } else if (rung === 2) drawBlaze(g, x, y, 16, 20, 1, 0.6, FIRE, 4, 0, 3);
  else if (rung === 3) drawBlaze(g, x, y, 7, 30, 1, 0.6, FIRE, 2, 0, 4);
  else if (rung === 6) {
    for (const dx of [-12, 0, 12]) drawFlame(g, x + dx, y - 12, 4, 9, 1 + dx, 0.6, SPIRIT, 0, dx);
    g.fillStyle = '#2a1e30';
    g.fillRect(4, y - 4, W - 8, 8);
  }
  g.globalAlpha = 1;
  return c;
}

export function progressPanel(p: OgienProgress): HTMLElement {
  const best = bestOf(p);
  const top = p.bestTop >= 0 ? `${rungShort(fireOf(p.bestTop))}${roundOf(p.bestTop) > 0 ? ` · ${t('card.cycle', { n: roundOf(p.bestTop) + 1 })}` : ''}` : '—';
  const forms = allForms();
  const have = forms.filter(f => p.forms.includes(f.key)).length;
  const gallery = h('div', { class: 'arcade-album' }, forms.map(f => {
    const on = p.forms.includes(f.key);
    const n = p.reached[f.id] ?? 0;
    const fast = p.fastest[f.id];
    // a tile is small: the fire's name, then how often (or its second picture's mark); the rest in its title
    const sub = !on ? '?' : f.variant === 0 ? `${n}×${fast !== undefined ? ` · ${t('sec', { n: Math.round(fast) })}` : ''}` : '✦';
    const tip = [rungName(f.rung), variantName(f.rung, f.variant), on && f.variant === 0 ? t('panel.reached', { n }) : on ? '' : t('panel.locked'),
      on && f.variant === 0 && fast !== undefined ? t('panel.fastest', { sec: t('sec', { n: Math.round(fast) }) }) : ''].filter(Boolean).join(' · ');
    return h('div', { class: on ? (f.variant > 0 ? 'on rare' : 'on') : null, title: tip },
      formTile(f.rung, f.variant, on), rungShort(f.rung), h('small', null, sub));
  }));
  // the verses of the fires reached so far, in a fold
  const reached = RUNGS.map((r, i) => ({ r, i })).filter(x => (p.reached[x.r.id] ?? 0) > 0);
  const verses = reached.length
    ? h('details', null, h('summary', null, t('panel.verses')), ...reached.map(x => h('div', null, h('p', { class: 'muted' }, rungName(x.i)), verseCard(x.r.verse))))
    : null;
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.top'), top),
      stat(t('panel.sessions'), fmtNum(p.sessions)),
      stat(t('panel.total'), fmtNum(p.total))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.sky', { n: p.sky.length })),
    skyCanvas(p),
    h('p', { class: 'muted' }, p.sky.length ? t('panel.skyNote') : t('panel.skyEmpty')),
    h('div', { class: 'arcade-sub' }, t('panel.gallery', { have, all: forms.length })),
    gallery,
    p.cycles > 0 ? h('p', { class: 'muted' }, t('panel.cycles', { n: p.cycles })) : null,
    verses,
  ];
  const root = h('div', { class: 'arcade-panel' });
  for (const el of out) if (el) root.appendChild(el);
  return root;
}
