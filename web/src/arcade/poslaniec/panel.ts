/**
 * Posłaniec's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the road to the seven churches (the journey, the leg to the next city, a postcard per city
 * — painted when reached, a sketch while ahead — with its letter's reference), the jar for the saints
 * in Jerusalem with its cloaks (the player may wear any earned one), the three errands, the day's
 * road and the day's gift.  Built with h() and createElement; no verse here (the lobby already shows
 * the root passage).
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { CITIES, CLOAKS, missionById } from './content';
import { grouped, metres, road, t } from './i18n';
import { bestOf, cloakOf, cloaksEarned, postcards, routeAt, toNextCloak, type PoslaniecProgress } from './meta';
import { paintPostcard } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function meter(label: string, value: string, k: number): HTMLElement {
  const bar = h('i');
  bar.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`;
  return h('div', { class: 'arcade-meter' }, h('span', null, label, h('b', null, value)), h('i', null, bar));
}

function postcard(index: number, owned: boolean): HTMLElement {
  const c = CITIES[index];
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const cv = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = cv.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintPostcard(ctx, c.id, index, 0, 0, 52, 40, owned);
  }
  return h('div', { class: owned ? 'on' : null, title: owned ? `${c.name} · ${c.ref}` : t('panel.postcardHidden') },
    cv, owned ? c.name : '?', h('small', null, c.ref));
}

const lapName = (lap: number): string => (lap === 1 ? t('lap.1') : lap === 2 ? t('lap.2') : t('lap.n', { n: lap }));

export function progressPanel(p: PoslaniecProgress, save: () => void): HTMLElement {
  const today = dayKey();
  const best = bestOf(p);
  // the road to the seven churches
  const r = routeAt(p.metres);
  const next = CITIES[r.next];
  const routeMeter = meter(t('panel.next', { city: next.to, left: road(r.leg - r.into) }), lapName(r.lap), r.into / r.leg);
  const owned = postcards(p.metres);
  const album = h('div', { class: 'arcade-album' }, CITIES.map((_, i) => postcard(i, owned[i])));
  // the jar and its cloaks
  const nextCloak = toNextCloak(p.drachmas);
  const jar = meter(
    nextCloak ? t('panel.jarNext', { name: CLOAKS[nextCloak.index].name, have: grouped(nextCloak.have), need: grouped(nextCloak.need) }) : t('panel.jarTop'),
    t('drachmas', { n: p.drachmas }), nextCloak ? nextCloak.have / nextCloak.need : 1);
  const earned = cloaksEarned(p.drachmas);
  const chips = h('div', { class: 'arcade-chips' });
  const wearing = () => cloakOf(p);
  const paintChips = () => {
    [...chips.children].forEach((el, i) => el.classList.toggle('on', i === wearing()));
  };
  CLOAKS.forEach((c, i) => {
    const chip = h('span', { title: i < earned ? c.name : `${c.name} · ${grouped(c.at)}` }, i < earned ? c.name : `${c.name} · ${grouped(c.at)}`);
    if (i < earned) {
      chip.setAttribute('role', 'button');
      chip.tabIndex = 0;
      const choose = () => {
        p.cloak = i;
        paintChips();
        save();
      };
      chip.addEventListener('click', choose);
      chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    } else chip.style.opacity = '0.55';
    chips.append(chip);
  });
  paintChips();
  // the errands
  const log = h('div', { class: 'arcade-chips' }, p.missions.map(id => h('span', null, missionById(id)?.name ?? id)));
  // the day's road and the day's gift
  const ran = p.dailyDay === today;
  const daily = h('div', { class: ran ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')), h('p', null, ran ? t('daily.done', { m: metres(p.dailyMetres) }) : t('daily.todo'))),
    h('span', { class: ran ? 'badge ok' : 'badge' }, ran ? '1/1' : '0/1'));
  const gifted = p.giftDay === today;
  const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { n: RULES.giftPay }))),
    h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.metres'), road(p.metres)),
      stat(t('panel.best'), best === null ? '—' : metres(best)),
      stat(t('panel.combo'), fmtNum(p.bestCombo)),
      stat(t('panel.heights'), p.heightsBest ? t('sec', { n: p.heightsBest }) : '—')),
    h('div', { class: 'arcade-sub' }, t('panel.route')), routeMeter, album,
    h('div', { class: 'arcade-sub' }, t('panel.jar')), jar, chips,
    h('div', { class: 'arcade-sub' }, t('panel.missions', { n: p.missionsDone })), log,
    daily, gift);
}
