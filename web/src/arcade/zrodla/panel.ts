/**
 * Źródła's "Postępy" card in the lobby, from the app's shared .arcade-* classes: the records, the
 * road of the Songs of Ascents (fifteen stations, the current one and its valley), and the stars of
 * the valleys walked so far.  Built with h().
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { psalmOf, stationName } from './content';
import { t, unit } from './i18n';
import { bestOf, migrate, roadDone, stationsDone, totalStars, type ZrodlaProgress } from './meta';
import { RULES, stationOf } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

export function progressPanel(p: ZrodlaProgress): HTMLElement {
  migrate(p);
  const best = bestOf(p);
  const st = Math.min(RULES.stations - 1, stationOf(p.valley));
  const done = stationsDone(p);
  const chips: HTMLElement[] = [];
  for (let i = 0; i < RULES.stations; i++) {
    const on = i < done, cur = i === st && !roadDone(p);
    chips.push(h('span', { class: on ? 'on' : null, title: `${stationName(i)} · Ps ${psalmOf(i)}` }, `${on ? '✓' : cur ? '→' : '·'} ${psalmOf(i)}`));
  }
  // the last valleys' stars
  const from = Math.max(0, p.valley - 7);
  const vals: HTMLElement[] = [];
  for (let v = from; v <= p.valley; v++) {
    const s = p.stars[v] ?? 0;
    vals.push(h('span', { class: v < p.valley ? 'on' : null }, `${t('panel.valley', { n: v + 1 })} ${v < p.valley ? '★'.repeat(Math.max(1, s)) + '☆'.repeat(3 - Math.max(1, s)) : '→'}`));
  }
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : `${fmtNum(best)} ${unit(best)}`),
      stat(t('panel.stars'), fmtNum(totalStars(p))),
      stat(t('panel.flowers'), fmtNum(p.flowers)),
      stat(t('panel.longest'), p.longest ? fmtNum(p.longest) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.road')),
    h('p', { class: 'muted' }, roadDone(p) ? t('panel.done') : p.sessions === 0 ? t('panel.new') : t('panel.station', { n: st + 1, name: stationName(st) })),
    h('div', { class: 'arcade-chips' }, chips),
    p.valley > 0 ? h('div', { class: 'arcade-chips' }, vals) : null);
}
