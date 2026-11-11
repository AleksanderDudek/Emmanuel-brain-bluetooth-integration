/**
 * Chleby i ryby's "Postępy" card in the lobby (v3), from the app's shared .arcade-* classes
 * (styles.css): the records and the bank; the path of hillsides (the chapter's four levels with
 * their stars, the glutton who waits at its end); the league of stars and the way to its next tier;
 * the cards in play and the whole collection kind by kind (tap an owned card to take it into play;
 * a card not found yet shows the village level that brings it); the published odds of a bundle; the
 * village of Betsaida with its buildings and what each next level costs; the three missions; the
 * day's weather and its gift.  A choice changes the progress, calls `save()` and redraws the card in
 * place.  Built with h() and createElement; no markup strings.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey, daySeed } from '../kit/progress';
import { CARDS, KINDS, cardLevel, evoOf, nextCopies, oddsWith, owned, type CardDef, type CardKind } from './cards';
import { CHAPTERS, bossName, buildName, buildText, cardName, cardText, dayName, dayText, missionText, tierName } from './content';
import { bossOf, placeOf } from './field';
import { baskets as basketsText, t } from './i18n';
import {
  BUILDINGS, VILLAGE_MAX, bestOf, build, buildLevel, buildPrice, dayOf, equip, giftOf, levelStars, luckOf, maxBuild, migrate, nextUnlocks,
  starsTotal, tierFloor, tierOf, villageLevel, type ChlebyProgress,
} from './meta';
import { RULES } from './rules';
import { paintCardArt, paintVillage } from './sprites';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvas(w: number, hh: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx);
  }
  return c;
}

/** A button that spends baskets: disabled when the bank does not reach. */
function buyButton(label: string, can: boolean, onBuy: () => void): HTMLButtonElement {
  const b = h('button', { class: can ? 'btn primary' : 'btn', type: 'button', disabled: can ? null : 'disabled' }, label);
  b.style.marginLeft = 'auto';
  b.addEventListener('click', e => {
    e.preventDefault();
    if (can) onBuy();
  });
  return b;
}

const meter = (left: string, right: string, share: number): HTMLElement => {
  const bar = h('i');
  bar.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;
  return h('div', { class: 'arcade-meter' }, h('span', null, left, h('b', null, right)), h('i', null, bar));
};

const pct = (v: number): string => t('pct', { n: fmtNum(Math.round(v * 1000) / 10, v < 0.1 ? 1 : 0) });

/** One card of the collection: its picture, name and level; tap to take it into play. */
function cardTile(p: ChlebyProgress, c: CardDef, changed: () => void): HTMLElement {
  const copies = p.cards[c.id] ?? 0, lv = cardLevel(p.cards, c.id);
  const inPlay = (p.loadout as Record<CardKind, string>)[c.kind] === c.id;
  const have = copies >= 1;
  const locked = !have && c.unlock > villageLevel(p);
  const next = nextCopies(c.id, copies);
  const sub = !have ? (locked ? t('panel.locked', { n: c.unlock }) : '?')
    : `${t('panel.lv', { n: lv })}${'★'.repeat(evoOf(lv))} · ${next === null ? t('panel.max') : `${copies}/${next}`}`;
  const cls = [inPlay ? 'on' : '', c.rarity === 'common' ? '' : c.rarity].filter(Boolean).join(' ') || null;
  const tile = h('div', {
    class: cls, title: have ? `${cardName(c.id)} — ${cardText(c.id)} (${t(`rar.${c.rarity}` as 'rar.rare')})` : t(`rar.${c.rarity}` as 'rar.rare'),
    role: have ? 'button' : null, tabindex: have ? '0' : null, 'aria-pressed': have ? String(inPlay) : null,
  }, canvas(52, 40, ctx => {
    if (have) paintCardArt(ctx, c.id, c.kind, 26, 24, 22, 0.3);
  }), have ? cardName(c.id) : '?', h('small', null, inPlay ? `${sub} · ${t('panel.loadout')}` : sub));
  if (!have) tile.style.opacity = '0.5';
  if (have && !inPlay) {
    const pick = () => { if (equip(p, c.id)) changed(); };
    tile.style.cursor = 'pointer';
    tile.addEventListener('click', pick);
    tile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  }
  return tile;
}

export function progressPanel(p: ChlebyProgress, save: () => void): HTMLElement {
  migrate(p);
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    root.replaceChildren(...build_(p, () => {
      save();
      render();
    }));
  };
  render();
  return root;
}

function build_(p: ChlebyProgress, changed: () => void): HTMLElement[] {
  const best = bestOf(p);
  const { chapter, local } = placeOf(p.level);
  // the chapter's four levels: done ones show their stars
  const first = p.level - local;
  const stars = Array.from({ length: RULES.chapter }, (_, i) => {
    const L = first + i, n = p.stars?.[L] ?? 0;
    return h('span', { class: L === p.level ? 'on' : null, title: t('head.levelOne', { n: L + 1 }) }, `${L + 1} ${'★'.repeat(n)}${'☆'.repeat(L < p.level ? 3 - n : 0)}`.trim());
  });
  const path = meter(t('panel.path', { n: p.level + 1, name: CHAPTERS[chapter] }),
    local === RULES.chapter - 1 ? t('panel.bossNext', { name: bossName(bossOf(chapter)) }) : t('panel.stars', { n: levelStars(p) }), local / RULES.chapter);
  // the league
  const all = starsTotal(p), tier = tierOf(all), lo = tierFloor(tier), hi = tierFloor(tier + 1);
  const league = meter(t('panel.league', { name: tierName(tier) }), t('panel.toTier', { have: fmtNum(all), need: fmtNum(hi), name: tierName(tier + 1) }), (all - lo) / Math.max(1, hi - lo));
  // the cards in play, and the collection kind by kind
  const loadout = h('div', { class: 'arcade-album' }, KINDS.map(k => {
    const id = (p.loadout as Record<CardKind, string>)[k];
    const c = CARDS.find(x => x.id === id) ?? CARDS.find(x => x.kind === k)!;
    return cardTile(p, c, changed);
  }));
  const kinds = KINDS.flatMap(k => [
    h('div', { class: 'arcade-sub' }, t(`kind.${k}` as 'kind.kosz')),
    h('div', { class: 'arcade-album' }, CARDS.filter(c => c.kind === k).map(c => cardTile(p, c, changed))),
  ]);
  const o = oddsWith(luckOf(p));
  const odds = h('p', { class: 'muted' }, t('panel.odds', { c: pct(o.common), r: pct(o.rare), e: pct(o.epic), l: pct(o.legend) }));
  // the village
  const vl = villageLevel(p);
  const village = canvas(340, 110, ctx => paintVillage(ctx, 340, 110, p.village, 0.4));
  village.style.width = '100%';
  village.style.maxWidth = '460px';
  village.style.height = 'auto';
  const rows = BUILDINGS.map(b => {
    const lv = buildLevel(p, b), price = buildPrice(b, lv);
    const right = price === null ? h('span', { class: 'badge ok' }, t('panel.max'))
      : buyButton(t('panel.buy', { baskets: basketsText(price) }), p.bank >= price, () => {
        if (build(p, b)) changed();
      });
    return h('div', { class: 'arcade-daily' },
      h('div', null, h('b', null, `${buildName(b)} · ${t('panel.lv', { n: `${lv}/${maxBuild(b)}` })}`), h('p', null, buildText(b))), right);
  });
  const next = nextUnlocks(p);
  const unlock = next.length ? h('p', { class: 'muted' }, t('panel.unlock', { n: next[0].unlock, names: next.map(c => cardName(c.id)).join(', ') })) : null;
  // the missions
  const missions = p.missions.map(m => h('div', { class: 'arcade-daily' },
    h('div', null, h('b', null, missionText(m.kind, m.goal)), h('p', null, t('panel.missionRule'))),
    h('span', { class: 'badge' }, `${fmtNum(m.have)}/${fmtNum(m.goal)}`)));
  // the day
  const today = dayKey();
  const day = dayOf(daySeed('chleby', today));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')),
      h('p', null, gifted ? t('gift.done') : t('gift.todo', { baskets: basketsText(giftOf(p)) })),
      h('p', null, t('panel.today', { name: dayName(day), text: dayText(day) }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.levels'), fmtNum(p.levels)),
      stat(t('panel.bank'), fmtNum(p.bank))),
    path,
    h('div', { class: 'arcade-chips' }, stars),
    league,
    h('p', { class: 'muted' }, t('panel.leagueRules')),
    h('div', { class: 'arcade-sub' }, t('panel.loadout')),
    loadout,
    h('p', { class: 'muted' }, t('panel.equip')),
    h('div', { class: 'arcade-sub' }, t('panel.collection', { have: owned(p.cards), all: CARDS.length })),
    ...kinds,
    odds,
    h('div', { class: 'arcade-sub' }, `${t('panel.village', { n: `${vl}/${VILLAGE_MAX}` })} · ${t('panel.build')}`),
    village,
    ...rows,
    unlock,
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.missions')),
    ...missions,
    gift,
  ].filter((x): x is HTMLElement => x !== null);
}
