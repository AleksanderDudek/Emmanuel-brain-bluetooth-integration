/**
 * Kocia straż's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and the golden fish, the abbey's map (the places kept safe, the one the watch is in, the ones
 * to come, and the year), the cats (on the wall or in the kitchen — a tap moves them — and those still
 * to come, with what brings them), the toys' highest grades, the brother's notebook of pests, and the
 * lasting perks bought with golden fish.  Built with h(); a choice saves and redraws the card.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import {
  CATS, FAM_IDS, PERKS, PEST_IDS, PLACES, bossName, catBio, catName, famName, giftText, gradeName, joinText, perkCost, perkName, perkText,
  pestName, placeName, stageInfo, type CatId, type PlaceId,
} from './content';
import { t } from './i18n';
import { bestOf, buyPerk, perkLevel, sendTrip, slotCount, toggleWall, type KotyProgress } from './meta';
import { GROUND, paintGrapes, paintPest } from './paint';
import { RULES } from './rules';
import { starText } from './sim';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** A little tile of a place: its ground, and a grape bunch when it is safe. */
function tile(id: PlaceId, state: 'done' | 'now' | 'later'): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = GROUND[id];
    const gr = ctx.createLinearGradient(0, 0, 0, 40);
    gr.addColorStop(0, g.top);
    gr.addColorStop(1, g.bottom);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 52, 40);
    ctx.globalAlpha = state === 'later' ? 0.4 : 1;
    const pest = PLACES.find(p => p.id === id)!.pests[0][0];
    paintPest(ctx, 26, 30, 22, pest, { dir: 1, t: 0, hit: 0, flee: false, doze: state === 'done' ? 1 : 0, frozen: false, elite: false, move: 0, seed: 1 });
    if (state === 'done') paintGrapes(ctx, 44, 16, 6);
    ctx.globalAlpha = 1;
  }
  return c;
}

function button(label: string, can: boolean, onClick: () => void, primary = true): HTMLButtonElement {
  const b = h('button', { class: can && primary ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onClick();
  });
  return b;
}

export function progressPanel(p: KotyProgress, save: () => void): HTMLElement {
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

function build(p: KotyProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const info = stageInfo(p.stage);
  // the abbey's map: the places of this year's round
  const map = h('div', { class: 'arcade-album' }, PLACES.map((pl, i) => {
    const state = i < info.placeIdx ? 'done' : i === info.placeIdx ? 'now' : 'later';
    const stars = p.stars[pl.id] ?? 0;
    const sub = state === 'now' ? `${t('panel.now')} · ${t('hud.stage', { n: p.stage })}` : state === 'done' ? t('panel.done') : t('panel.later');
    const starLine = stars > 0 ? h('small', null, starText(stars)) : null;
    return h('div', { class: state === 'later' ? null : 'on', title: `${placeName(pl.id)}: ${bossName(pl.boss)}` }, tile(pl.id, state), placeName(pl.id), h('small', null, sub), starLine);
  }));
  // the cats
  const room = slotCount(p);
  const have = CATS.filter(c => p.cats.includes(c.id));
  const cats = have.map(c => {
    const id: CatId = c.id;
    const on = p.squad.indexOf(id);
    const wall = on >= 0 && on < room;
    const away = p.trips.includes(id);
    const where = away ? t('panel.away') : wall ? t('panel.wall') : t('panel.kitchen');
    const right = h('div', { class: 'arcade-chips' });
    right.style.marginLeft = 'auto';
    right.style.flexWrap = 'nowrap';
    if (!away) {
      right.append(button(wall ? t('panel.toKitchen') : t('panel.toWall'), !(wall && p.squad.length <= 1), () => {
        toggleWall(p, id);
        changed();
      }, !wall));
      if (!wall) right.append(button(t('panel.trip'), true, () => {
        if (sendTrip(p, id)) changed();
      }, false));
    }
    return h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, `${catName(id)} · ${where}`), h('p', null, `${giftText(c.gift)} — ${catBio(id)}`)), right);
  });
  const kitchen = have.some(c => !p.squad.slice(0, room).includes(c.id));
  const locked = CATS.filter(c => !p.cats.includes(c.id));
  const lockedChips = locked.length
    ? h('div', { class: 'arcade-chips' }, locked.map(c => h('span', { class: 'muted' }, `${t('panel.locked')} · ${joinText(c.join)}`)))
    : null;
  // the toys' highest grades and the notebook
  const toys = h('div', { class: 'arcade-chips' }, FAM_IDS.map(f => {
    const g = p.toyBook[f] ?? 0;
    return h('span', { class: g > 0 ? 'on' : 'muted' }, g > 0 ? `${famName(f)} ${g} · ${gradeName(g)}` : `${famName(f)} · —`);
  }));
  const seen = PEST_IDS.filter(id => (p.notebook[id] ?? 0) > 0);
  const notebook = h('div', { class: 'arcade-chips' }, PEST_IDS.map(id => {
    const n = p.notebook[id] ?? 0;
    return h('span', { class: n > 0 ? 'on' : 'muted' }, n > 0 ? `${pestName(id)} · ${fmtNum(n)}` : '?');
  }));
  // the perks
  const perks = PERKS.map(k => {
    const lv = perkLevel(p, k.id), cost = perkCost(k.id, lv);
    const right = cost === null
      ? h('span', { class: 'badge ok' }, t('panel.max'))
      : button(t('panel.buy', { cost: fmtNum(cost) }), p.gold >= cost, () => {
        if (buyPerk(p, k.id)) changed();
      });
    right.style.marginLeft = 'auto';
    return h('div', { class: 'arcade-daily' }, h('div', null, h('b', null, `${perkName(k.id)} · ${lv}/${k.max}`), h('p', null, perkText(k.id))), right);
  });
  const out: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.stage'), `${p.stage}`),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.bestStage'), fmtNum(p.bestStage)),
      stat(t('panel.gold'), fmtNum(p.gold))),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, `${t('panel.map')} · ${t('panel.round', { n: info.round + 1 })}`), map,
    h('div', { class: 'arcade-sub' }, t('panel.cats', { have: have.length, all: CATS.length })), ...cats,
    kitchen || p.trips.length ? h('p', { class: 'muted' }, t('panel.trips')) : null, lockedChips,
    h('div', { class: 'arcade-sub' }, t('panel.toys')), toys,
    h('div', { class: 'arcade-sub' }, t('panel.pests', { have: seen.length, all: PEST_IDS.length })), notebook,
    h('div', { class: 'arcade-sub' }, `${t('panel.perks')} · ${t('panel.years')}: ${p.years}`),
    ...(p.years === 0 && p.gold === 0
      // before the first vintage: what the golden fish will buy, in one glance
      ? [h('p', { class: 'muted' }, t('panel.vintage', { n: RULES.vintageFrom })),
        h('div', { class: 'arcade-chips' }, PERKS.map(k => h('span', { class: 'muted', title: perkText(k.id) }, perkName(k.id))))]
      : perks),
  ];
  return out.filter((x): x is HTMLElement => !!x);
}
