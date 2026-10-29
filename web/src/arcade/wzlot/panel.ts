/**
 * Wzlot's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the plumage and the feathers to its next stage, "Widoki ziemi" (the eight vistas as
 * tiles, each painted in its light, or a dark silhouette not yet found) with the published odds and
 * rules folded, the flight log's three open pages, the day's ridge and the day's feather.  Built
 * with h() and createElement; the tiles paint their vistas.  No verse here: the lobby already
 * shows the game's root passage.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { LIGHTS, STAGES, VISTAS, missionById, type Vista } from './content';
import { km, metres, t } from './i18n';
import { bestFor, newChance, owned, stageOf, toNextStage, type WzlotProgress } from './meta';
import { paintVista } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string, unit = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
}

/** A fold: one line (`summary`) until tapped. */
function fold(summary: string, cls: string, ...kids: (Node | null)[]): HTMLElement {
  return h('details', null, h('summary', { class: cls }, `${summary} ▾`), h('div', { class: 'arcade-panel mt10' }, ...kids));
}

function tile(p: WzlotProgress, v: Vista): HTMLElement {
  const own = owned(p, v.index);
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintVista(ctx, v.land, v.light, 0, 0, 52, 40, own);
  }
  const light = t(`panel.light.${v.light}`);
  return h('div', { class: own ? (v.light === 'dusk' ? 'on rare' : 'on') : null, title: own ? v.name : t('panel.tileHidden') },
    c, own ? t(`land.${v.land}`) : '?',
    h('small', null, light));
}

/** The best headline for the length last played, else the best of any length (null: never flown). */
export function bestOf(p: WzlotProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}

export function progressPanel(p: WzlotProgress): HTMLElement {
  const today = dayKey();
  const best = bestOf(p);
  // the plumage: its stage and the feathers to the next
  const stage = stageOf(p.feathers);
  const next = toNextStage(p.feathers);
  const bar = h('i');
  bar.style.width = `${next ? Math.round((next.have / next.need) * 100) : 100}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, next ? t('panel.toNext', { name: STAGES[stage].name, have: next.have, need: next.need }) : t('panel.stageTop', { name: STAGES[stage - 1].name, n: t('feathers', { n: p.feathers }) }),
      h('b', null, t('feathers', { n: p.feathers }))),
    h('i', null, bar));
  const chips = h('div', { class: 'arcade-chips' }, STAGES.map((s, i) => h('span', { class: i < stage ? 'on' : null, title: s.skill }, s.name)));
  // the vistas, their odds and rules
  const album = h('div', { class: 'arcade-album' }, VISTAS.map(v => tile(p, v)));
  const odds = fold(t('panel.odds', { down: Math.min(p.down, RULES.craftDown), craft: RULES.craftDown }), 'muted',
    h('div', { class: 'arcade-chips' }, LIGHTS.map(l => h('span', null, t('panel.oddsChip', { light: t(`panel.light.${l}`), n: Math.round(newChance(p, l) * 100) })))),
    h('p', { class: 'muted' }, t('panel.rules', {
      alt: metres(RULES.vistaAlt * RULES.mPerSh), dup: RULES.dupDown, craft: RULES.craftDown, pity: metres(RULES.vistaAltPity * RULES.mPerSh),
    })));
  // the flight log's open pages
  const log = h('div', { class: 'arcade-chips' }, p.missions.map(id => h('span', null, missionById(id)?.name ?? id)));
  // the day's ridge and the day's feather
  const flown = p.dailyDay === today;
  const daily = h('div', { class: flown ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')), h('p', null, flown ? t('daily.done', { m: metres(p.dailyAir) }) : t('daily.todo'))),
    h('span', { class: flown ? 'badge ok' : 'badge' }, flown ? '1/1' : '0/1'));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { n: RULES.featherGift }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.metres'), p.metres >= 10_000 ? km(p.metres) : metres(p.metres)),
      stat(t('panel.best'), best === null ? '—' : metres(best)),
      stat(t('panel.chain'), fmtNum(p.bestChain)),
      stat(t('panel.high'), p.highest ? metres(p.highest) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.plumage')), meter, chips,
    h('div', { class: 'arcade-sub' }, t('panel.vistas', { have: p.vistas.length, total: VISTAS.length })), album, odds,
    h('div', { class: 'arcade-sub' }, t('panel.log', { n: p.missionsDone })), log,
    daily, gift);
}
