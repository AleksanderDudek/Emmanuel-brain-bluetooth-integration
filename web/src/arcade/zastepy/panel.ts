/**
 * Zastępy's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and the gold; the campaign map's chapter (its five battles with their stars, the fifth a
 * boss gate) and the age of the fortress; the gate of light with its next level for gold; the pillar
 * of cloud with its next level; the host with each unit's level, the shade it is the bane of and its
 * next level for gold; and the day's gift.  A purchase changes the progress, calls `save()` and
 * redraws the card in place.  Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { AGES, DEMON_NAME, HOST_NAME } from './content';
import { gold as goldText, t } from './i18n';
import {
  ageOf, bestOf, bossOf, buyGate, buyHero, buyUnit, chapterOf, chapterStars, gateLevel, gatePrice, heroLevel, heroPrice, isBossBattle,
  migrate, nextCardGate, pillarFor, unitLevel, unitPrice, type ZastepyProgress,
} from './meta';
import { POSE, paintHost } from './paint';
import { BANE, HOST, HOST_IDS, RULES, type HostId } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function portrait(id: HostId, own: boolean, age: number): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(44 * dpr)), height: String(Math.round(44 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = own ? 1 : 0.35;
    const big = id === 'jezdziec' || id === 'archaniol' || id === 'serafin';
    paintHost(ctx, id, 22, 40, big ? 18 : 24, { ...POSE, seed: 3, age });
  }
  return c;
}

/** The chapter's five battles as a little map: stars on the won ones, the boss gate at the end, "you are here". */
function chapterMap(p: ZastepyProgress, chapter: number): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const W = 300, H = 46;
  const c = h('canvas', { width: String(Math.round(W * dpr)), height: String(Math.round(H * dpr)), 'aria-hidden': 'true' });
  c.style.width = '100%';
  c.style.maxWidth = `${W}px`;
  c.style.height = 'auto';
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = RULES.chapter, x0 = 22, step = (W - 44) / (n - 1), y = 20;
  ctx.strokeStyle = 'rgba(185,127,31,.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + step * (n - 1), y);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < n; i++) {
    const b = chapter * n + i, x = x0 + step * i;
    const here = b === p.battle, done = b < p.battle, boss = i === n - 1;
    ctx.fillStyle = boss ? (done ? '#b97f1f' : '#3a2c3c') : done ? '#e8b04a' : here ? '#fff1c9' : '#efe6d6';
    ctx.strokeStyle = here ? '#b97f1f' : 'rgba(42,31,46,.35)';
    ctx.lineWidth = here ? 3 : 1;
    ctx.beginPath();
    ctx.arc(x, y, boss ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const stars = p.stars[b] ?? 0;
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = s < stars ? '#e8b04a' : 'rgba(42,31,46,.15)';
      star(ctx, x - 9 + s * 9, y + 18, 3.6);
    }
    if (boss) {
      ctx.fillStyle = done ? '#fff8e8' : '#ff8a3d';
      ctx.beginPath();
      ctx.arc(x - 3, y - 1, 1.6, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 1, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** A button that spends gold: disabled when the gold does not reach. */
function buyButton(label: string, can: boolean, onBuy: () => void): HTMLButtonElement {
  const b = h('button', { class: can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.style.marginLeft = 'auto';
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onBuy();
  });
  return b;
}

export function progressPanel(p: ZastepyProgress, save: () => void): HTMLElement {
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

function build(p: ZastepyProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const { chapter, local } = chapterOf(p.battle);
  const age = ageOf(p.battle);
  const gl = gateLevel(p);
  // the campaign: the chapter, its age, the map of its five battles
  const map = h('div', { class: 'arcade-daily' },
    h('div', null,
      h('b', null, t('panel.chapter', { c: chapter + 1, age: AGES[age] })),
      h('p', null, isBossBattle(p.battle)
        ? t('panel.bossNext', { boss: DEMON_NAME[bossOf(p.battle)] })
        : `${t('panel.battle', { n: local + 1, of: RULES.chapter })} · ${t('panel.stars', { n: chapterStars(p, chapter), of: 3 * RULES.chapter })}`),
      chapterMap(p, chapter),
      p.bosses ? h('p', null, t('panel.bosses', { n: p.bosses })) : null));
  // the gate of light
  const gp = gatePrice(gl);
  const next = nextCardGate(gl);
  const gate = h('div', { class: 'arcade-daily' },
    h('div', null,
      h('b', null, t('panel.gate', { n: gl })),
      h('p', null, gp === null ? t('panel.gateMax') : next ? `${t('panel.gateRules')} ${t('panel.nextCard', { n: next.gate, name: HOST_NAME[next.id] })}` : t('panel.gateRules'))),
    gp === null ? h('span', { class: 'badge ok' }, `${gl}/${RULES.gateMax}`) : buyButton(t('panel.gateUp', { gold: goldText(gp) }), p.gold >= gp, () => {
      if (buyGate(p)) changed();
    }));
  // the pillar of cloud
  const hl = heroLevel(p), hp = heroPrice(hl), ps = pillarFor(hl);
  const hero = h('div', { class: 'arcade-daily' },
    h('div', null,
      h('b', null, t('panel.hero', { n: hl })),
      h('p', null, t('panel.heroRules', { sec: fmtNum(ps.sec, ps.sec % 1 ? 1 : 0), cool: fmtNum(ps.cool, ps.cool % 1 ? 1 : 0) }))),
    hp === null ? h('span', { class: 'badge ok' }, t('panel.unitMax')) : buyButton(t('panel.unitUp', { gold: goldText(hp) }), p.gold >= hp, () => {
      if (buyHero(p)) changed();
    }));
  // the host
  const rows = HOST_IDS.map(id => {
    const open = HOST[id].gate <= gl;
    const lv = unitLevel(p, id), price = unitPrice(id, lv);
    let right: HTMLElement;
    if (!open) right = h('span', { class: 'badge' }, t('panel.unitLocked', { n: HOST[id].gate }));
    else if (price === null) right = h('span', { class: 'badge ok' }, t('panel.unitMax'));
    else right = buyButton(t('panel.unitUp', { gold: goldText(price) }), p.gold >= price, () => {
      if (buyUnit(p, id)) changed();
    });
    const bane = BANE[id];
    const line = bane ? `${t('panel.level', { n: lv })} · ${t('panel.bane', { demon: DEMON_NAME[bane] })}` : t('panel.level', { n: lv });
    return h('div', { class: 'arcade-daily' }, portrait(id, open, age),
      h('div', null, h('b', null, HOST_NAME[id]), h('p', null, line)), right);
  });
  const today = dayKey();
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { gold: goldText(RULES.giftGold) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.won'), fmtNum(p.won)),
      stat(t('panel.gold'), fmtNum(p.gold))),
    map,
    gate,
    hero,
    h('div', { class: 'arcade-sub' }, t('panel.host')),
    ...rows,
    gift,
  ];
}
