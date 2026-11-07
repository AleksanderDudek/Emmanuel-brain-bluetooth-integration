/**
 * Arka's "Postępy" card in the lobby (v2), from the app's shared .arcade-* classes (styles.css): the
 * saga (the level to play, the stars, the chapter) with the last levels as chips showing their
 * stars, the records, the homestead raised by the stars and its next stage, and "Nowa ziemia" (the
 * twelve kinds as tiles: each drawn in profile with its pairs and its young, or a silhouette still
 * in the ark).  It stays short on a phone: the tiles carry the collection, the rest is a line.
 */
import { h } from '../../ui/dom';
import { KIND, KINDS, STAGES, chapter, chapterOf, kindsAt, type KindId } from './content';
import { cap, t, unit } from './i18n';
import { hasYoung, homestead, levelsDone, settledOf, totalStars, type ArkaProgress } from './meta';
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
  const stars = totalStars(p);
  const home = homestead(stars);
  const bar = h('i');
  bar.style.width = `${home.next ? Math.round((home.have / home.need) * 100) : 100}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, home.next ? t('panel.next', { name: home.next.name, have: home.have, need: home.need }) : t('panel.homeDone'),
      h('b', null, home.next ? `${home.have}/${home.need}` : `${STAGES.length}/${STAGES.length}`)),
    h('i', null, bar));
  const stages = h('div', { class: 'arcade-chips' }, STAGES.map((s, i) => h('span', { class: i < home.built ? 'on' : null, title: cap(s.name) }, s.short)));
  // the saga: the last eight levels played and the next one
  const from = Math.max(1, p.level - 8);
  const saga = h('div', { class: 'arcade-chips' }, Array.from({ length: p.level - from + 1 }, (_, i) => {
    const n = from + i, s = p.stars[n - 1] ?? 0;
    return h('span', { class: n < p.level ? 'on' : null, title: t('hud.level', { n }) }, n < p.level ? `${n} ${'★'.repeat(s)}` : `${n} ›`);
  }));
  const ch = chapter(chapterOf(p.level));
  // the kinds met so far: those of the levels reached
  const out = kindsAt(Math.max(1, p.level));
  const seen = (k: KindId, i: number) => i < out || settledOf(p, k) > 0;
  const found = KINDS.filter(seen).length;
  const album = h('div', { class: 'arcade-album' }, KINDS.map((k, i) => tile(p, k, seen(k, i))));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.level'), String(p.level)),
      stat(t('panel.stars'), `${stars} ★`),
      stat(t('panel.best'), String(p.bestSession), unit(p.bestSession)),
      stat(t('panel.pairs'), String(p.pairs), unit(p.pairs))),
    h('div', { class: 'arcade-sub' }, t('panel.chapter', { n: chapterOf(p.level) + 1, title: ch.title })), saga,
    levelsDone(p) === 0 ? h('p', { class: 'muted' }, t('card.open.text')) : null,
    h('div', { class: 'arcade-sub' }, t('panel.home')), meter, stages,
    h('div', { class: 'arcade-sub' }, t('panel.land', { n: found, all: KINDS.length })), album);
}
