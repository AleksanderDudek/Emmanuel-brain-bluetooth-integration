/**
 * Dolina's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and the sparks, the pilgrim's look with the sparks to the next (a portrait of each), the
 * era the next run starts in (every era whose guardian a run has met is open), the upgrades with
 * their next level for sparks, and the day's gift.  A choice changes the progress, calls `save()`
 * and redraws the card in place.  Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { ERAS, LOOKS, UPGRADES, eraName, upName, upText, type UpId } from './content';
import { sparks as sparksText, t } from './i18n';
import { bestOf, buyUp, lookOf, nextLookAt, startEraOf, startEras, upLevel, upPrice, type DolinaProgress } from './meta';
import { paintPortrait, paintUpIcon } from './paint';
import { RULES } from './rules';

const metres = (n: string): string => t('metres', { n });

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

function build(p: DolinaProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const look = lookOf(p.sparksAll);
  const next = nextLookAt(p.sparksAll);
  const from = RULES.looks[look];
  const bar = h('i');
  bar.style.width = `${next === null ? 100 : Math.round(((p.sparksAll - from) / (next - from)) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, t('panel.look', { name: LOOKS[look] }),
      h('b', null, next === null ? t('panel.lookMax') : t('panel.toLook', { have: fmtNum(p.sparksAll), need: fmtNum(next) }))),
    h('i', null, bar));
  const looks = h('div', { class: 'arcade-album' }, LOOKS.map((name, i) => {
    const own = i <= look;
    return h('div', { class: own ? 'on' : null, title: name }, canvas(52, 40, ctx => paintPortrait(ctx, 52, 40, i, own)), own ? name : '?');
  }));
  // the era the next run starts in
  const open = startEras(p);
  const cur = startEraOf(p);
  const eras = h('div', { class: 'arcade-chips' }, ERAS.map((era, i) => {
    const can = i < open.length;
    const b = button(eraName(era), can && i !== cur, false, { 'data-era': era, 'aria-pressed': String(i === cur), title: can ? eraName(era) : t('panel.locked') }, () => {
      p.startEra = i;
      changed();
    });
    if (i === cur) b.classList.add('primary');
    return b;
  }));
  // the upgrades
  const ups = UPGRADES.map((id: UpId) => {
    const lv = upLevel(p, id), price = upPrice(id, lv);
    const right = price === null
      ? h('span', { class: 'badge ok' }, t('panel.upMax'))
      : button(t('panel.buy', { sparks: sparksText(price) }), p.sparks >= price, true, { 'data-up': id }, () => {
        if (buyUp(p, id)) changed();
      });
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' }, canvas(36, 36, ctx => paintUpIcon(ctx, id, 18, 18, 14, lv)),
      h('div', null, h('b', null, `${upName(id)} · ${t('panel.level', { n: lv, max: RULES.upMax[id] })}`), h('p', null, upText(id))), right);
  });
  const today = dayKey();
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daygift.title')), h('p', null, gifted ? t('daygift.done') : t('daygift.todo', { sparks: sparksText(RULES.dayGift) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), metres(fmtNum(p.total))),
      stat(t('panel.best'), best === null ? '—' : metres(fmtNum(best))),
      stat(t('panel.guards'), fmtNum(p.guards)),
      stat(t('panel.sparks'), fmtNum(p.sparks))),
    meter,
    looks,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.start')),
    eras,
    h('p', { class: 'muted' }, t('panel.startHint')),
    h('div', { class: 'arcade-sub' }, t('panel.ups')),
    ...ups,
    gift,
  ];
}
