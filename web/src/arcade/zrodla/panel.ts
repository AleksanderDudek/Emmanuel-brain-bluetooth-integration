/**
 * Źródła's "Postępy" card in the lobby: the all-time numbers, the road (the stage being walked and
 * the five stages as chips), the album "Studnie i źródła" with its six places (the published odds,
 * the drops and the depth words' credit folded to one muted line), the day's trees, "Dolina dnia",
 * and the records folded.  Built with h() from the shared .arcade-* classes (styles.css); the album
 * tiles draw their places.  No verse here: the lobby already shows the game's root passage.
 */
import { fmtNum } from '../../i18n';
import { dayKey } from '../kit/progress';
import { h } from '../../ui/dom';
import { ALBUM, DEPTH_NAME, ROAD_LENGTH, STAGES, TREES, VALLEYS_PER_STAGE } from './content';
import { cap, t } from './i18n';
import { DROPS_PER_CARD, type ZrodlaProgress } from './meta';
import { paintPlace } from './paint';

function stat(k: string, v: string, unit = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
}

/** A fold: one line (`summary`) until tapped. */
function fold(summary: string, cls: string, ...kids: (Node | null)[]): HTMLElement {
  return h('details', null, h('summary', { class: cls }, `${summary} ▾`), h('div', { class: 'arcade-panel mt10' }, ...kids));
}

function tile(p: ZrodlaProgress, id: number): HTMLElement {
  const own = p.album.includes(id), dawn = p.dawn.includes(id), card = ALBUM[id];
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintPlace(ctx, id, 0, 0, 52, 40, dawn, own);
  }
  const cls = own ? (dawn ? 'on legend' : 'on') : null;
  const title = own ? `${t('panel.tile', { name: card.name, ref: card.ref })}${dawn ? ` · ✦ ${t('panel.dawn')}` : ''}\n${card.caption}` : t('panel.tileHidden');
  return h('div', { class: cls, title }, c, own ? card.name : '?', h('small', null, own ? (dawn ? `✦ ${card.ref}` : card.ref) : '—'));
}

export function progressPanel(p: ZrodlaProgress): HTMLElement {
  const today = dayKey();
  const sec = (s: number) => t('sec', { n: fmtNum(s) });
  // the road: the stage being walked, its valleys, the five stages as chips
  const idx = Math.max(0, p.roadIndex), done = idx >= ROAD_LENGTH;
  const stage = Math.min(STAGES.length - 1, Math.floor(idx / VALLEYS_PER_STAGE)), inStage = done ? VALLEYS_PER_STAGE : idx % VALLEYS_PER_STAGE;
  const bar = h('i');
  bar.style.width = `${Math.round((inStage / VALLEYS_PER_STAGE) * 100)}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, done ? t('panel.roadDone', { n: idx - ROAD_LENGTH }) : t('panel.stageOf', { n: stage + 1, name: STAGES[stage].name }),
      h('b', null, `${inStage}/${VALLEYS_PER_STAGE}`)),
    h('i', null, bar));
  const chips = h('div', { class: 'arcade-chips' }, STAGES.map((s, i) => h('span', { class: (i + 1) * VALLEYS_PER_STAGE <= idx ? 'on' : null, title: `Ps ${s.psalm}` }, s.name)));
  // the album and its published rules, folded
  const album = h('div', { class: 'arcade-album' }, ALBUM.map(c => tile(p, c.id)));
  const odds = fold(t('panel.odds'), 'muted',
    h('p', { class: 'muted' }, t('panel.oddsText')),
    h('p', { class: 'muted' }, t('panel.drops', { n: Math.min(p.drops, DROPS_PER_CARD) })),
    h('p', { class: 'muted' }, t('panel.depths')));
  // the day's trees
  const planted = p.trees.length ? p.trees[p.trees.length - 1] : null;
  const treeLine = h('p', { class: 'muted' }, t('panel.trees', { n: p.trees.length }),
    planted && planted.d === today ? ` · ${t('panel.treeToday', { tree: TREES[planted.k % TREES.length].name })}` : '');
  // "Dolina dnia"
  const played = p.dailyDay === today;
  const dailyText = p.sessions < 1 ? t('daily.first')
    : !played ? t('daily.todo')
      : p.dailySec > 0 ? t('daily.done', { sec: sec(p.dailySec), best: sec(p.dailyBest || p.dailySec) }) : t('daily.open');
  const daily = h('div', { class: played && p.dailySec > 0 ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')), h('p', null, dailyText)),
    h('span', { class: 'badge' }, played && p.dailySec > 0 ? '1/1' : '0/1'));
  // the records, folded
  const records = fold(t('panel.records'), 'arcade-sub',
    h('div', { class: 'arcade-stats' },
      stat(t('stat.fastest'), p.fastest ? sec(p.fastest) : '—'),
      stat(t('stat.steady'), p.steady ? sec(p.steady) : '—'),
      stat(t('stat.rytm'), p.rytm === null ? '—' : t('pct', { n: `${p.rytm > 0 ? '+' : p.rytm < 0 ? '−' : ''}${fmtNum(Math.abs(p.rytm), 1)}` })),
      stat(t('panel.deepestJars'), p.deepestJars ? fmtNum(p.deepestJars) : '—')));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.jars'), fmtNum(p.jars)),
      stat(t('panel.valleys'), fmtNum(p.valleys)),
      stat(t('panel.nests'), fmtNum(p.nests)),
      stat(t('panel.deepest'), p.deepest ? cap(DEPTH_NAME[p.deepest]) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.road')), meter, chips,
    h('div', { class: 'arcade-sub' }, t('panel.album', { have: p.album.length, total: ALBUM.length })), album, odds,
    treeLine, daily, records);
}
