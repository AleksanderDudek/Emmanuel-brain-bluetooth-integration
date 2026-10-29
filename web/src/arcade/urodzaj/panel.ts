/**
 * Urodzaj's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * harvest and the records, the village table (its next step and the eight steps as chips), the
 * guests at the table as an album (each drawn small, or "still on the way" with how far they come
 * from), the line about Ruth and Naomi until they have come, the published odds and rules folded a
 * tap away, and "Kosz dnia".  Built with createElement only; the meter's width is set through CSSOM.
 */
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { CRAFT_GRAIN, DUPLICATE_GRAIN, GUESTS, STORY_NAME, TABLE_STEPS, TIERS, TIER_CLASS, TIER_FEAT, TIER_NAME, fruit, type Guest } from './content';
import { cap, t, unit } from './i18n';
import { atTable, newChance, tablePoints, tableState, type UrodzajProgress } from './meta';
import { paintGuest } from './table';

function stat(k: string, v: string, u = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, u ? h('small', null, u) : null));
}

/** A guest's tile: the figure (a dim shape while still on the way), the name, how far they came. */
function tile(p: UrodzajProgress, g: Guest): HTMLElement {
  const here = atTable(p, g.id);
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintGuest(ctx, g.look, 26, 39, 36, 1);
    if (!here) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#2c2a33';
      ctx.fillRect(0, 0, 52, 40);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const tier = g.tier ? TIER_NAME[g.tier] : STORY_NAME;
  const title = here ? t('panel.tile', { name: cap(g.name), tier }) : t('panel.tileHidden', { tier });
  const cls = [here ? 'on' : '', g.tier ? TIER_CLASS[g.tier] : 'rare'].filter(Boolean).join(' ') || null;
  return h('div', { class: cls, title }, c, here ? cap(g.name) : '?', h('small', null, tier));
}

export function progressPanel(p: UrodzajProgress): HTMLElement {
  const st = tableState(tablePoints(p));
  const bar = h('i');
  bar.style.width = `${st.next ? Math.round((st.have / st.need) * 100) : 100}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, st.next ? t('panel.setting', { name: st.next.name }) : t('panel.tableDone'),
      h('b', null, st.next ? t('panel.ptsOf', { have: st.have, need: st.need }) : `${TABLE_STEPS.length}/${TABLE_STEPS.length}`)),
    h('i', null, bar));
  const steps = h('div', { class: 'arcade-chips' }, TABLE_STEPS.map((s, i) => h('span', { class: i < st.built ? 'on' : null, title: cap(s.name) }, s.short)));
  const here = GUESTS.filter(g => atTable(p, g.id)).length;
  const album = h('div', { class: 'arcade-album' }, GUESTS.map(g => tile(p, g)));
  const parts: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.harvest'), String(p.harvest), unit(p.harvest)),
      stat(t('panel.best'), p.sessions > 0 ? String(p.bestSession) : '—', p.sessions > 0 ? unit(p.bestSession) : ''),
      stat(t('panel.bestBasket'), p.bestBasket > 0 ? String(p.bestBasket) : '—', p.bestBasket > 0 ? unit(p.bestBasket) : ''),
      stat(t('panel.highest'), cap(fruit(Math.max(1, p.bestTier)).name))),
    h('div', { class: 'arcade-sub' }, t('panel.table')), meter, steps,
    h('div', { class: 'arcade-sub' }, t('panel.guests', { have: here, total: GUESTS.length })), album,
  ];
  if (!p.ruthAt || !p.naomiAt) parts.push(h('p', { class: 'muted' }, t('panel.story')));
  // the published odds and the album's rules, a tap away
  parts.push(h('details', null,
    h('summary', { class: 'muted' }, `${t('panel.odds', { grain: t('grain', { n: p.grain }) })} ▾`),
    h('div', { class: 'arcade-chips mt10' }, TIERS.map(tier => h('span', { title: t('panel.oddsHint') },
      t('panel.oddsChip', { tier: cap(TIER_NAME[tier]), feat: TIER_FEAT[tier], n: Math.round(newChance(p, tier) * 100) })))),
    h('p', { class: 'muted mt10' }, t('panel.rules', { dup: t('grain', { n: DUPLICATE_GRAIN }), craft: t('grain', { n: CRAFT_GRAIN }) }))));
  // "Kosz dnia": the same fruit for everyone today, and the day's loaf for whoever comes
  const done = p.dailyDay === dayKey();
  parts.push(h('div', { class: done ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')),
      h('p', null, done ? t('daily.done', { pts: t('pts', { n: p.dailyScore }) }) : t('daily.todo')),
      p.dailyBest > 0 ? h('p', null, t('daily.best', { pts: t('pts', { n: p.dailyBest }) })) : null),
    h('span', { class: done ? 'badge ok' : 'badge' }, done ? '1/1' : '0/1')));
  return h('div', { class: 'arcade-panel' }, parts);
}
