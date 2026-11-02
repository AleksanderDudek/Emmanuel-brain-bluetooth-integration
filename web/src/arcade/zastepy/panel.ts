/**
 * Zastępy's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and the gold, the battle reached in its circle of ten (the tenth is the Smok), the gate of
 * light with its next level for gold, the host with each unit's level and its next level for gold,
 * and the day's gift.  A purchase changes the progress, calls `save()` and redraws the card in place.
 * Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { HOST_NAME } from './content';
import { gold as goldText, t } from './i18n';
import {
  bestOf, buyGate, buyUnit, circleOf, gateLevel, gatePrice, isSmok, nextCardGate, unitLevel, unitPrice, type ZastepyProgress,
} from './meta';
import { POSE, paintHost } from './paint';
import { HOST, HOST_IDS, RULES, type HostId } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function portrait(id: HostId, own: boolean): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(44 * dpr)), height: String(Math.round(44 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = own ? 1 : 0.35;
    const big = id === 'jezdziec' || id === 'archaniol' || id === 'serafin';
    paintHost(ctx, id, 22, 40, big ? 18 : 24, { ...POSE, seed: 3 });
  }
  return c;
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
  const { circle, local } = circleOf(p.battle);
  const gl = gateLevel(p);
  // the circle of ten: the battle reached, the Smok at its end
  const bar = h('i');
  bar.style.width = `${Math.round((local / RULES.circle) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.battle', { n: local + 1, c: circle + 1 }), h('b', null, isSmok(p.battle) ? t('panel.smokNext') : p.smoks ? t('panel.smoks', { n: p.smoks }) : '')),
    h('i', null, bar));
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
    return h('div', { class: 'arcade-daily' }, portrait(id, open),
      h('div', null, h('b', null, HOST_NAME[id]), h('p', null, t('panel.level', { n: lv }))), right);
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
    meter,
    gate,
    h('div', { class: 'arcade-sub' }, t('panel.host')),
    ...rows,
    gift,
  ];
}
