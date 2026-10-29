/**
 * Glina's "Postępy" card in the lobby, from the app's existing .arcade-* classes: the numbers, the
 * street (each household's story, n/4, lit once its house came alive), the Book of Vessels (a tile
 * per form with the player's best vessel drawn small, how many and the tallest; a silhouette until
 * its page opens), the verse of the newest page that has one (one at most), the glazes, the form of
 * the day and the day's gift at the gate, and the published kiln-gift odds folded to one line.  It
 * stays short on a phone: the odds are a tap away and the book's tiles are small.
 */
import { h } from '../../ui/dom';
import { dayKey, daySeed } from '../kit/progress';
import { verseCard } from '../kit/scripture';
import { FORM, FORMS, GIFT_ODDS, GLAZES, GLAZE_NAME, HOUSES, HOUSE_NAME, MARK_NAME, DAY_GIFT_NAME, type Form } from './content';
import { cap, cmText, pctText, t } from './i18n';
import { dailyForm, dayGift, type GlinaProgress } from './meta';
import { recLook } from './scene';
import { drawVessel, look } from './vessel';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const tileLook = look();

function stat(k: string, v: string, unit = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
}

/** A book tile: the best vessel of the form, drawn small, or its silhouette until the page opens. */
function tile(p: GlinaProgress, f: Form): HTMLElement {
  const page = p.book[f.id];
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (page) {
      const rec = page.best;
      let maxQ = 0;
      for (const q of rec.q) maxQ = Math.max(maxQ, q / 100);
      const scale = Math.min(34 / Math.max(1, rec.h), 21 / Math.max(0.5, maxQ * rec.h));
      drawVessel(ctx, recLook(tileLook, rec, 26, 37, scale, 30));
    } else silhouette(ctx, f);
  }
  const marks = page ? MARK_NAME.filter(([bit]) => page.marks & bit).map(([, name]) => name) : [];
  const title = page ? [cap(f.name), f.use, ...marks].join(' · ') : t('panel.tileHidden');
  const cls = page ? (page.best.stars === 3 ? 'on epic' : page.best.gift === 'moon' ? 'on legend' : page.best.gift ? 'on rare' : 'on') : null;
  return h('div', { class: cls, title }, c, page ? cap(f.name) : '?',
    h('small', null, page ? t('panel.page', { n: page.n, cm: cmText(page.tall ?? page.best.h) }) : ''));
}

/** An unopened page: the form's outline in faint chalk. */
function silhouette(ctx: CanvasRenderingContext2D, f: Form): void {
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

export function progressPanel(p: GlinaProgress): HTMLElement {
  const day = dayKey();
  const open = FORMS.filter(f => p.book[f.id]).length;
  const parts: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.vessels'), String(p.vessels)),
      stat(t('panel.best'), p.sessions > 0 ? String(p.bestSession) : '—', p.sessions > 0 ? 'cm' : ''),
      stat(t('panel.tallest'), p.tallest > 0 ? cmText(p.tallest).replace(/\s*cm$/, '') : '—', p.tallest > 0 ? 'cm' : ''),
      stat(t('panel.forms'), String(open), '/12')),
    h('div', { class: 'arcade-sub' }, t('panel.street')),
    h('div', { class: 'arcade-chips' }, HOUSES.map(x => h('span', { class: p.steps[x] >= 4 ? 'on' : null },
      p.steps[x] >= 4 ? t('panel.alive', { house: HOUSE_NAME[x] }) : t('panel.steps', { house: HOUSE_NAME[x], n: p.steps[x] })))),
    h('div', { class: 'arcade-sub' }, t('panel.book', { n: open })),
    h('div', { class: 'arcade-album' }, FORMS.map(f => tile(p, f))),
  ];
  // the newest page's verse, when it has one (one verse at most)
  const newest = p.newest ? FORM[p.newest] : null;
  if (newest?.verse) parts.push(verseCard(newest.verse));
  parts.push(h('div', { class: 'arcade-sub' }, t('panel.glazes')),
    h('div', { class: 'arcade-chips' }, GLAZES.map(g => h('span', { class: p.glazes.includes(g) ? 'on' : null }, cap(GLAZE_NAME[g])))));
  // the form of the day, the same for every potter today, and the day's gift
  const daily = dailyForm(daySeed('glina', day));
  const doneDaily = p.dailyDay === day;
  parts.push(h('div', { class: doneDaily ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('panel.daily')),
      h('p', null, t('panel.dailyForm', { form: FORM[daily.f].name })),
      h('p', null, doneDaily ? t('panel.dailyDone', { pct: pctText(p.dailyBest / 100) }) : t('panel.dailyTodo'))),
    h('span', { class: doneDaily ? 'badge ok' : 'badge' }, doneDaily ? '1/1' : '0/1')));
  const gift = dayGift(day), got = p.giftDay === day;
  parts.push(h('p', { class: 'muted' }, t('panel.gift', { gift: DAY_GIFT_NAME[gift] }), ' — ', t(got ? 'panel.giftDone' : 'panel.giftTodo')));
  // the published odds, a tap away
  parts.push(h('details', null, h('summary', { class: 'muted' }, `${t('panel.oddsFold')} ▾`),
    h('p', { class: 'muted mt10' }, t('panel.odds', { a: pct(GIFT_ODDS.blush), b: pct(GIFT_ODDS.speckle), c: pct(GIFT_ODDS.moon) }))));
  if (p.seconds > 0) parts.push(h('p', { class: 'muted' }, `${t('panel.seconds')}: ${p.seconds}`));
  return h('div', { class: 'arcade-panel' }, parts);
}
