/**
 * Wzlot's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records (the best session, the best day, the farthest flight), the nest (its level, which is the
 * points' multiplier, its chicks and eggs, painted), the three flight lessons open now, and the
 * plumage the nest has grown.  Built with h(); no verse here (the lobby shows the root passage).
 */
import { h } from '../../ui/dom';
import { lessonText } from './content';
import { fmtInt, metres, t, type Key } from './i18n';
import { migrate, multOf, openLessons, plumageOf, type WzlotProgress } from './meta';
import { paintNestFamily } from './paint';
import { RULES } from './rules';

export { bestOf } from './meta';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

/** The nest, painted with its eggs and chicks. */
function nestPicture(p: WzlotProgress): HTMLElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(120 * dpr)), height: String(Math.round(54 * dpr)), 'aria-hidden': 'true' });
  c.style.width = '120px';
  c.style.height = '54px';
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintNestFamily(ctx, 60, 34, 70, p.nest, p.eggs, p.chicks, 0.3);
  }
  return c;
}

export function progressPanel(p: WzlotProgress): HTMLElement {
  migrate(p);
  const plum = plumageOf(p);
  const lessons = openLessons(p);
  const list = h('div', { class: 'arcade-chips' }, lessons.map(o =>
    h('span', { class: o.done ? 'on' : null }, `${o.done ? '✓ ' : ''}${lessonText(o.lesson)}`)));
  const chips = h('div', { class: 'arcade-chips' }, [1, 2, 3].map(i =>
    h('span', { class: i <= plum ? 'on' : null }, t(`plumage.${i}` as Key))));
  const nextAt = plum < 3 ? RULES.plumage[plum - 1] : null;
  return h('div', { class: 'arcade-panel' },
    p.sessions === 0 ? h('p', { class: 'muted' }, t('panel.none')) : null,
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), p.bestTotal > 0 ? `${fmtInt(p.bestTotal)} ${t('unit')}` : '—'),
      stat(t('panel.bestDay'), p.bestDay > 0 ? `${fmtInt(p.bestDay)} ${t('unit')}` : '—'),
      stat(t('panel.far'), p.farthest > 0 ? (p.bestGran > 0 ? t('panel.farVal', { m: metres(p.farthest), n: p.bestGran }) : metres(p.farthest)) : '—'),
      stat(t('panel.nest'), t('panel.nestVal', { n: multOf(p) }))),
    h('div', { class: 'arcade-sub' }, t('panel.nest')), nestPicture(p),
    p.chicks > 0 ? h('p', { class: 'muted' }, `${t('panel.chicks')}: ${p.chicks}`) : null,
    h('div', { class: 'arcade-sub' }, t('panel.lessons', { n: p.set + 1 })), list,
    h('div', { class: 'arcade-sub' }, t('panel.plumage')), chips,
    nextAt !== null ? h('p', { class: 'muted' }, t('panel.nextPlumage', { n: nextAt })) : null);
}
