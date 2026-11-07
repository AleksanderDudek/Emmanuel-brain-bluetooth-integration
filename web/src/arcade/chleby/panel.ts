/**
 * Chleby i ryby's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css):
 * the records and the grain, the level reached on the path of hillsides (the chapter's four levels
 * with their stars, the Pelikan's last), the four upgrades with each one's next level for grain,
 * and the day's gift.  A purchase changes the progress, calls `save()` and redraws the card in
 * place.  Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { CHAPTERS, UP_NAME, UP_TEXT } from './content';
import { placeOf } from './hill';
import { grain as grainText, t } from './i18n';
import { bestOf, buyUp, maxLevel, starsAll, upLevel, upPrice, type ChlebyProgress } from './meta';
import { RULES, UPGRADES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** A button that spends grain: disabled when the grain does not reach. */
function buyButton(label: string, can: boolean, onBuy: () => void): HTMLButtonElement {
  const b = h('button', { class: can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.style.marginLeft = 'auto';
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onBuy();
  });
  return b;
}

export function progressPanel(p: ChlebyProgress, save: () => void): HTMLElement {
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

function build(p: ChlebyProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const { chapter, local } = placeOf(p.level);
  // the chapter's four levels: done ones show their stars
  const first = p.level - local;
  const bar = h('i');
  bar.style.width = `${Math.round((local / RULES.chapter) * 100)}%`;
  const stars = Array.from({ length: RULES.chapter }, (_, i) => {
    const L = first + i, n = p.stars?.[L] ?? 0;
    return h('span', { title: t('hud.level', { n: L + 1 }) }, `${L + 1} ${'★'.repeat(n)}${'☆'.repeat(L < p.level ? 3 - n : 0)}`.trim());
  });
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.path', { n: p.level + 1, name: CHAPTERS[chapter] }),
      h('b', null, local === RULES.chapter - 1 ? t('panel.pelikanNext') : t('panel.stars', { n: starsAll(p) }))),
    h('i', null, bar));
  const rows = UPGRADES.map(u => {
    const lv = upLevel(p, u), price = upPrice(u, lv);
    const right = price === null ? h('span', { class: 'badge ok' }, t('panel.max'))
      : buyButton(t('panel.buy', { grain: grainText(price) }), p.grain >= price, () => {
        if (buyUp(p, u)) changed();
      });
    return h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, `${UP_NAME[u]} · ${t('panel.lv', { n: `${lv}/${maxLevel(u)}` })}`), h('p', null, UP_TEXT[u])), right);
  });
  const today = dayKey();
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { grain: grainText(RULES.giftGrain) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.levels'), fmtNum(p.levels)),
      stat(t('panel.grain'), fmtNum(p.grain))),
    meter,
    h('div', { class: 'arcade-chips' }, stars),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.ups')),
    ...rows,
    gift,
  ];
}
