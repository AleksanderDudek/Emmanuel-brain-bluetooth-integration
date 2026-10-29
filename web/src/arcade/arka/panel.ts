/**
 * Arka's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the homestead and its next stage, "Nowa ziemia" (the twelve kinds as tiles: each drawn
 * in profile with its pairs and its young, or a silhouette still in the ark), the next kind to come
 * out, the olive leaves in store and the day's hold.  It stays short on a phone: the tiles carry the
 * collection, everything else is a line.
 */
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { KIND, KINDS, STAGES, kindsAt, nextKind, type KindId } from './content';
import { cap, t, unit } from './i18n';
import { MAX_LEAVES, hasYoung, homestead, settledOf, type ArkaProgress } from './meta';
import { paintProfile } from './paint';

function stat(k: string, v: string, u = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, u ? h('small', null, u) : null));
}

/** A kind's tile: its picture (a silhouette while still in the ark), its name, its pairs. */
function tile(p: ArkaProgress, k: KindId, out: boolean): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  const n = settledOf(p, k), young = hasYoung(p, k);
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = out ? 'rgba(127,179,90,.35)' : 'rgba(255,255,255,.06)';
    ctx.fillRect(4, 33, 44, 2);
    paintProfile(ctx, k, young ? 22 : 26, 34, 27, 1, 0);
    if (young) paintProfile(ctx, k, 40, 34, 27, -1, 1, true);
    if (!out) {
      // still in the ark: a silhouette
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#2c2a33';
      ctx.fillRect(0, 0, 52, 40);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const kind = KIND[k];
  const name = cap(kind.name);
  const title = out ? (young ? t('panel.tileYoung', { name, habitat: kind.habitat, young: kind.young }) : t('panel.tile', { name, habitat: kind.habitat })) : t('panel.unknown');
  const cls = out ? (young ? 'on rare' : 'on') : null;
  return h('div', { class: cls, title }, c, out ? name : '?', h('small', null, out ? (n ? t('pairs', { n }) : kind.habitat) : t('panel.unknown')));
}

export function progressPanel(p: ArkaProgress): HTMLElement {
  const home = homestead(p.home);
  const bar = h('i');
  bar.style.width = `${home.next ? Math.round((home.have / home.need) * 100) : 100}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, home.next ? t('panel.next', { name: home.next.name }) : t('panel.homeDone'),
      h('b', null, home.next ? `${home.have}/${home.need}` : `${STAGES.length}/${STAGES.length}`)),
    h('i', null, bar));
  const stages = h('div', { class: 'arcade-chips' }, STAGES.map((s, i) => h('span', { class: i < home.built ? 'on' : null, title: cap(s.name) }, s.short)));
  // the kinds out so far: those of the sessions played (a new player sees the first three waiting)
  const out = p.sessions > 0 ? kindsAt(p.sessions) : 0;
  const found = KINDS.filter((k, i) => i < out || settledOf(p, k) > 0).length;
  const album = h('div', { class: 'arcade-album' }, KINDS.map((k, i) => tile(p, k, i < out || settledOf(p, k) > 0)));
  const nk = nextKind(Math.max(0, p.sessions));
  const next = p.sessions === 0 ? null
    : nk ? (nk.in === 1 ? t('panel.nextKind', { name: KIND[nk.kind].name }) : t('panel.nextKindIn', { n: nk.in, name: KIND[nk.kind].name }))
      : t('panel.allKinds');
  const today = dayKey();
  const done = p.dailyDay === today;
  const daily = h('div', { class: done ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')),
      h('p', null, done ? t('daily.done', { stars: '★'.repeat(p.dailyStars) + '☆'.repeat(Math.max(0, 3 - p.dailyStars)), sec: p.dailySec }) : t('daily.todo'))),
    h('span', { class: done ? 'badge ok' : 'badge' }, done ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.pairs'), String(p.pairs), unit(p.pairs)),
      stat(t('panel.best'), String(p.bestSession), unit(p.bestSession)),
      stat(t('panel.chain'), String(p.bestChain)),
      stat(t('panel.olives'), String(p.olives))),
    h('div', { class: 'arcade-sub' }, t('panel.home')), meter, stages,
    h('div', { class: 'arcade-sub' }, t('panel.land', { n: found, all: KINDS.length })), album,
    next ? h('p', { class: 'muted' }, next) : null,
    h('p', { class: 'muted' }, t('panel.leaves', { n: p.leaves, max: MAX_LEAVES })),
    daily);
}
