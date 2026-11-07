/**
 * Posłaniec's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records and the multiplier, the open mission set (a full set raises the multiplier), the day's
 * word, the upgrades the drachmas buy (the player chooses here; the card calls `save()`), and the
 * road to the seven churches with a postcard per city — painted when reached, a sketch while ahead.
 * Built with h() and createElement; no verse here (the lobby already shows the root passage).
 */
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { CITIES, UP_IDS, dayWord, missionText, upPrice } from './content';
import { grouped, metres, road, t } from './i18n';
import { buyUp, multOf, openSet, postcards, powerSecFor, flightSecFor, routeAt, type PoslaniecProgress } from './meta';
import { paintPostcard } from './paint';
import { RULES } from './rules';
import { daySeed } from '../kit/progress';

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
  return h('div', { class: owned ? 'on' : null, title: owned ? `${c.name} · ${c.ref}` : '?' },
    cv, owned ? c.name : '?', h('small', null, c.ref));
}

const lapName = (lap: number): string => (lap === 1 ? t('lap.1') : lap === 2 ? t('lap.2') : t('lap.n', { n: lap }));

/** One upgrade's row: its name, its level and length, and the button that buys the next level. */
function upgradeRow(p: PoslaniecProgress, id: typeof UP_IDS[number], save: () => void, refresh: () => void): HTMLElement {
  const level = p.ups[id] ?? 0;
  const price = upPrice(level);
  const sec = id === 'wings' ? flightSecFor(level) : powerSecFor(level);
  const btn = h('button', { class: 'btn small', type: 'button' }, price === null ? t('panel.max') : t('panel.buy', { n: grouped(price) }));
  btn.style.marginLeft = 'auto';
  if (price === null || p.drachmas < price) btn.setAttribute('disabled', '');
  btn.addEventListener('click', () => {
    if (buyUp(p, id)) {
      save();
      refresh();
    }
  });
  return h('div', { class: 'arcade-daily' },
    h('div', null, h('b', null, t(`up.${id}`)), h('p', null, `${t('panel.level', { n: level, max: RULES.upMax })} · ${t('sec', { n: Math.round(sec * 10) / 10 })}`)),
    btn);
}

export function progressPanel(p: PoslaniecProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = () => {
    const today = dayKey();
    // the mission set
    const set = openSet(p);
    const missions = h('div', { class: 'arcade-chips' }, set.map((m, i) => {
      const have = Math.min(m.target, p.mprog[i] ?? 0);
      const done = have >= m.target;
      return h('span', { class: done ? 'on' : null }, `${done ? '✓ ' : ''}${missionText(m)} · ${grouped(have)}/${grouped(m.target)}`);
    }));
    // the day's word
    const word = dayWord(daySeed('poslaniec', today));
    const fresh = p.wordDay !== today;
    const got = fresh ? 0 : p.wordGot;
    const done = !fresh && p.wordDone;
    const letters = word.split('').map((ch, i) => (i < got ? ch : '_')).join(' ');
    const daily = h('div', { class: done ? 'arcade-daily done' : 'arcade-daily' },
      h('div', null, h('b', null, t('panel.word')), h('p', null, done ? t('panel.wordDone', { n: p.wordStreak }) : t('panel.wordLeft', { got, of: word.length }))),
      h('span', { class: done ? 'badge ok' : 'badge' }, letters));
    // the upgrades
    const ups = UP_IDS.map(id => upgradeRow(p, id, save, render));
    // the road to the seven churches
    const r = routeAt(p.metres);
    const next = CITIES[r.next % CITIES.length];
    const routeMeter = meter(t('panel.next', { city: next.to, left: road(r.leg - r.into) }), lapName(r.lap), r.into / r.leg);
    const owned = postcards(p.metres);
    const album = h('div', { class: 'arcade-album' }, CITIES.map((_, i) => postcard(i, owned[i])));
    root.replaceChildren(
      h('div', { class: 'arcade-stats' },
        stat(t('panel.best'), p.sessions ? t('pts', { n: grouped(p.best) }) : '—'),
        stat(t('panel.bestRun'), p.bestRun ? t('pts', { n: grouped(p.bestRun) }) : '—'),
        stat(t('panel.bestMetres'), p.bestMetres ? metres(p.bestMetres) : '—'),
        stat(t('stat.mult'), `×${multOf(p)}`)),
      h('div', { class: 'arcade-sub' }, t('panel.missions')), missions,
      daily,
      h('div', { class: 'arcade-sub' }, `${t('panel.ups')} · ${t('panel.drachmas', { n: grouped(p.drachmas) })}`), ...ups,
      h('div', { class: 'arcade-sub' }, t('panel.route')), routeMeter, album);
  };
  render();
  return root;
}
