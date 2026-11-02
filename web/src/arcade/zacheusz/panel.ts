/**
 * Zacheusz's "Postępy" card in the lobby, from the app's shared .arcade-* classes: the denarii
 * given back to Jericho, the session record, the courses run and the figs; the town map of twelve
 * households (restored ones warm, the next one's sum as a meter); the twelve courses with their
 * special set (silver, gold, purple); the three missions; the day's course and the day's gift.
 * Built with h() and createElement; the tiles paint their houses and coins.  No verse here: the
 * lobby already shows the game's root passage.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { HOMES, course, missionById } from './content';
import { cap, grouped, t, unit } from './i18n';
import { bestOf, courseRec, coursesDone, homesRestored, tierOf, toNextHome, unlocked, type ZacheuszProgress } from './meta';
import { paintCoin, paintHome } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string, small = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, small ? h('small', null, small) : null));
}

function canvasTile(w: number, hh: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(ctx);
  }
  return c;
}

export function progressPanel(p: ZacheuszProgress): HTMLElement {
  const today = dayKey();
  const best = bestOf(p);
  const restored = homesRestored(p.denarii);
  // the town: twelve households
  const town = h('div', { class: 'arcade-album zz-town' }, HOMES.map(home => {
    const on = home.index < restored;
    return h('div', { class: on ? 'on' : null, title: on ? `${home.name}: ${home.fix}` : `${home.name} · ${grouped(home.at)}` },
      canvasTile(52, 40, ctx => paintHome(ctx, home.index, 0, 0, 52, 40, on)),
      on ? home.name : '?', h('small', null, on ? home.fix : grouped(home.at)));
  }));
  const next = toNextHome(p.denarii);
  const bar = h('i');
  bar.style.width = `${next ? Math.round((next.have / next.need) * 100) : 100}%`;
  const meter = h('div', { class: 'arcade-meter' },
    h('span', null, next ? t('panel.toNext', { name: next.home.name, have: grouped(next.have), need: grouped(next.need) }) : t('panel.allHomes'),
      h('b', null, t('denarii', { n: p.denarii }))),
    h('i', null, bar));
  // the courses: open in turn, then their special sets
  const open = unlocked(p);
  const courses = h('div', { class: 'arcade-album zz-courses' }, Array.from({ length: RULES.courses }, (_, i) => {
    const rec = courseRec(p, i);
    const c = course(i);
    if (i >= open) return h('div', { title: t('panel.locked') }, canvasTile(52, 40, ctx => paintCoin(ctx, 26, 20, 11, 'silver', 0, true)), '?', h('small', null, String(i + 1)));
    const tier = tierOf(rec);
    const got = rec.tier >= 3 ? RULES.specials : rec.got;
    const cls = rec.tier >= 3 ? 'on legend' : rec.tier === 2 ? 'on epic' : rec.tier === 1 ? 'on rare' : rec.done ? 'on' : null;
    return h('div', { class: cls, title: c.name },
      canvasTile(52, 40, ctx => {
        for (let k = 0; k < RULES.specials; k++) paintCoin(ctx, 7 + k * 9.5, 20, 4.4, tier, 0, k >= got);
      }),
      c.name, h('small', null, t('panel.set', { tier: cap(t(`tier.${tier}`)), got })));
  }));
  // the missions
  const log = h('div', { class: 'arcade-chips' }, p.missions.map(id => h('span', null, missionById(id)?.name ?? id)));
  const rules = h('details', null, h('summary', { class: 'muted' }, `${t('panel.rulesTitle')} ▾`), h('p', { class: 'muted mt10' }, t('panel.rules')));
  // the day's course and the day's gift
  const ran = p.dailyDay === today;
  const daily = h('div', { class: ran ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')), h('p', null, ran ? t('daily.done', { n: p.dailyCoins, unit: unit(p.dailyCoins) }) : t('daily.todo'))),
    h('span', { class: ran ? 'badge ok' : 'badge' }, ran ? '1/1' : '0/1'));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { n: RULES.giftPay }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.denarii'), grouped(p.denarii)),
      stat(t('panel.best'), best === null ? '—' : grouped(best)),
      stat(t('panel.courses'), `${coursesDone(p)}/${RULES.courses}`),
      stat(t('panel.figs'), fmtNum(p.figs))),
    h('div', { class: 'arcade-sub' }, t('panel.town', { have: restored, total: HOMES.length })), meter, town,
    h('div', { class: 'arcade-sub' }, t('panel.map', { have: coursesDone(p), total: RULES.courses })), courses, rules,
    h('div', { class: 'arcade-sub' }, t('panel.missions', { n: p.missionsDone })), log,
    daily, gift);
}
