/**
 * Glina's "Postępy" card in the lobby, from the app's shared .arcade-* classes: the purse and the
 * records, the workshop's shop (the next few items on sale, each a button that spends the purse —
 * glazes, patterns, a smoother wheel, a bigger kiln), the shelf (the best piece of every form,
 * drawn small; an outline until it is made; the stars to the next form), the neighbours' stories
 * (n/4 each), and the glazes and patterns owned.
 */
import { h } from '../../ui/dom';
import { fmtNum } from '../../i18n';
import { CUSTOMER_NAME, FORMS, GLAZES, GLAZE_NAME, HOUSES, PATTERNS, PATTERN_NAME, type Form, type ShopItem } from './content';
import { cap, coinsText, t } from './i18n';
import { buy, migrate, shelfCount, starsToNext, window_, type GlinaProgress } from './meta';
import { GLAZE } from './paint';
import { recLook } from './scene';
import { drawVessel, look } from './vessel';

const tileLook = look();

function stat(k: string, v: string, unit = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
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

/** A shelf tile: the best piece of the form, or its outline until it is made. */
function tile(p: GlinaProgress, f: Form): HTMLElement {
  const rec = p.shelf[f.id];
  const c = canvas(52, 40, ctx => {
    if (rec) {
      let maxQ = 0;
      for (const q of rec.q) maxQ = Math.max(maxQ, q / 100);
      const scale = Math.min(34 / Math.max(1, rec.h), 21 / Math.max(0.5, maxQ * rec.h));
      drawVessel(ctx, recLook(tileLook, rec, 26, 37, scale, 30));
    } else outline(ctx, f);
  });
  const cls = rec ? (rec.stars === 3 ? 'on epic' : rec.gift ? 'on rare' : 'on') : null;
  return h('div', { class: cls, title: cap(f.name) }, c, rec ? cap(f.name) : '?', h('small', null, rec ? '★'.repeat(rec.stars) : ''));
}

function outline(ctx: CanvasRenderingContext2D, f: Form): void {
  let maxQ = 0;
  for (const q of f.q) maxQ = Math.max(maxQ, q);
  const s = Math.min(34 / f.N, 21 / (maxQ * f.N));
  ctx.strokeStyle = 'rgba(160,150,140,.55)';
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 0; k < 16; k++) ctx.lineTo(26 - f.q[k] * f.N * s, 37 - (k / 15) * f.N * s);
  for (let k = 15; k >= 0; k--) ctx.lineTo(26 + f.q[k] * f.N * s, 37 - (k / 15) * f.N * s);
  ctx.closePath();
  ctx.stroke();
}

function itemName(it: ShopItem): string {
  switch (it.kind) {
    case 'glaze': return cap(GLAZE_NAME[it.ref]);
    case 'pattern': return cap(PATTERN_NAME[it.ref]);
    case 'wheel': return `${t('shop.wheel')} ${it.ref}`;
    case 'kiln': return `${t('shop.kiln')} ${it.ref}`;
  }
}

function itemNote(it: ShopItem): string {
  return t(it.kind === 'glaze' ? 'shop.glazeNote' : it.kind === 'pattern' ? 'shop.patternNote' : it.kind === 'wheel' ? 'shop.wheelNote' : 'shop.kilnNote');
}

function itemIcon(it: ShopItem): HTMLCanvasElement {
  return canvas(32, 32, ctx => {
    if (it.kind === 'glaze') {
      ctx.fillStyle = GLAZE[it.ref].c;
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath();
      ctx.arc(12, 12, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === 'pattern') {
      ctx.fillStyle = '#B07A55';
      ctx.fillRect(2, 10, 28, 12);
      ctx.strokeStyle = '#2C4E9E';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) ctx.lineTo(3 + i * 2.2, 16 + Math.sin(i * 1.3) * 3);
      ctx.stroke();
    } else {
      ctx.fillStyle = it.kind === 'wheel' ? '#8E6A50' : '#9C5B3B';
      ctx.beginPath();
      if (it.kind === 'wheel') ctx.ellipse(16, 18, 13, 5, 0, 0, Math.PI * 2);
      else { ctx.moveTo(4, 28); ctx.quadraticCurveTo(4, 4, 16, 4); ctx.quadraticCurveTo(28, 4, 28, 28); }
      ctx.fill();
      ctx.fillStyle = '#F2C230';
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(it.ref), 16, it.kind === 'wheel' ? 14 : 24);
    }
  });
}

/** A button that spends the purse: disabled when it does not reach. */
function button(label: string, can: boolean, onClick: () => void): HTMLButtonElement {
  const b = h('button', { class: can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onClick();
  });
  return b;
}

export function progressPanel(p: GlinaProgress, save: () => void): HTMLElement {
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

function build(p: GlinaProgress, changed: () => void): HTMLElement[] {
  const next = starsToNext(p);
  const shop = window_(p, 4).map(it => {
    const right = button(`${t('panel.buy')} · ${fmtNum(it.price)}`, p.purse >= it.price, () => {
      if (buy(p, it.id)) changed();
    });
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' }, itemIcon(it), h('div', null, h('b', null, itemName(it)), h('p', null, itemNote(it))), right);
  });
  const out: HTMLElement[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.purse'), coinsText(p.purse)),
      stat(t('panel.best'), p.sessions > 0 ? coinsText(p.best) : '—'),
      stat(t('panel.stars'), fmtNum(p.stars)),
      stat(t('panel.streak'), p.bestStreak ? fmtNum(p.bestStreak) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.shop')),
    ...(shop.length ? shop : [h('p', { class: 'muted' }, t('panel.soldOut'))]),
    h('div', { class: 'arcade-sub' }, `${t('panel.shelf')} · ${t('panel.shelfN', { n: shelfCount(p) })}`),
    h('div', { class: 'arcade-album' }, FORMS.map(f => tile(p, f))),
    h('p', { class: 'muted' }, next === null ? t('panel.allForms') : t('panel.next', { n: next })),
    h('div', { class: 'arcade-sub' }, t('panel.stories')),
    h('div', { class: 'arcade-chips' }, HOUSES.map(x => h('span', { class: p.steps[x] >= 4 ? 'on' : null }, `${cap(CUSTOMER_NAME[x])} ${p.steps[x]}/4`))),
    h('div', { class: 'arcade-chips' },
      GLAZES.filter(g => p.glazes.includes(g)).map(g => h('span', { class: 'on' }, cap(GLAZE_NAME[g]))),
      PATTERNS.filter(x => p.patterns.includes(x)).map(x => h('span', null, cap(PATTERN_NAME[x])))),
    h('p', { class: 'muted' }, `${t('panel.wheel')} · ${t('panel.level', { n: p.wheel })} · ${t('panel.kiln')} · ${t('panel.level', { n: p.kiln })}`),
  ];
  if (p.legacyCm > 0) out.push(h('p', { class: 'muted' }, `${t('panel.legacy')}: ${fmtNum(p.legacyCm)}`));
  return out;
}
