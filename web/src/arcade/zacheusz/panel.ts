/**
 * Zacheusz's "Postępy" card in the lobby, from the app's shared .arcade-* classes: the denarii given
 * back to Jericho, the session record, the levels finished and the stars; the level map (three
 * worlds of four, Super Mario Run's World Tour select) — each open level shows its stars and its
 * special set, and a tap on it makes it the level the next session starts from (the progress is
 * saved at once); the town of twelve households (restored ones warm, the next one's sum as a meter);
 * the three missions; the day's gift.  Built with h(); the tiles paint their coins and houses.  No
 * verse here: the lobby already shows the game's root passage.
 */
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { HOMES, LEVELS, levelCode, levelName, missionById, worldName } from './content';
import { cap, grouped, t } from './i18n';
import { bestOf, homesRestored, levelsDone, starsAll, tierIndex, tierOf, toNextHome, unlocked, type ZacheuszProgress } from './meta';
import { paintCoin, paintHome } from './paint';
import { RULES } from './rules';

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
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

const starText = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

export function progressPanel(p: ZacheuszProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    const today = dayKey();
    const best = bestOf(p);
    const restored = homesRestored(p.denarii);
    const open = unlocked(p);
    // the level map: three worlds of four
    const pickLine = h('p', { class: 'muted' }, p.pick >= 0 && p.pick < open
      ? t('panel.picked', { code: levelCode(p.pick), name: levelName(p.pick) }) : t('panel.auto'));
    const worlds = Array.from({ length: RULES.worlds }, (_, wi) => {
      const tiles = LEVELS.slice(wi * RULES.perWorld, (wi + 1) * RULES.perWorld).map(lv => {
        const i = lv.index, rec = p.levels[i];
        if (i >= open) {
          return h('div', { title: t('panel.locked') },
            canvasTile(52, 40, ctx => paintCoin(ctx, 26, 20, 11, 'silver', 0, true)), levelCode(i), h('small', null, '🔒'));
        }
        const tier = tierOf(rec);
        const got = rec.tier >= 3 ? RULES.specials : rec.got;
        const picked = p.pick === i;
        const cls = [picked ? 'on legend' : rec.done ? 'on' : '', rec.tier >= 2 ? 'epic' : rec.tier === 1 ? 'rare' : ''].join(' ').trim() || null;
        const choose = () => {
          p.pick = picked ? -1 : i;
          save();
          render();
        };
        return h('div', {
          class: cls, title: `${levelCode(i)} ${levelName(i)}`, role: 'button', tabindex: '0', 'aria-pressed': String(picked),
          on: { click: choose, keydown: (e: Event) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); choose(); } } },
        },
        canvasTile(52, 40, ctx => {
          for (let k = 0; k < RULES.specials; k++) paintCoin(ctx, 7 + k * 9.5, 24, 4.4, tier, 0, k >= got);
        }),
        `${levelCode(i)} ${starText(rec.stars)}`, h('small', null, levelName(i)));
      });
      return [h('div', { class: 'arcade-sub' }, `${wi + 1}. ${worldName(wi)}`), h('div', { class: 'arcade-album' }, tiles)];
    }).flat();
    // the town: twelve households
    const town = h('div', { class: 'arcade-album' }, HOMES.map(home => {
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
    const log = h('div', { class: 'arcade-chips' }, p.missions.map(id => h('span', null, missionById(id)?.name ?? id)));
    const rules = h('details', null, h('summary', { class: 'muted' }, `${t('panel.rulesTitle')} ▾`), h('p', { class: 'muted mt10' }, t('panel.rules')));
    const gifted = p.giftDay === today;
    const gift = h('div', { class: gifted ? 'arcade-daily done' : 'arcade-daily' },
      h('div', null, h('b', null, t('gift.title')), h('p', null, gifted ? t('gift.done') : t('gift.todo', { n: RULES.giftPay }))),
      h('span', { class: gifted ? 'badge ok' : 'badge' }, gifted ? '1/1' : '0/1'));
    // the set each level shows, for the tier names
    void tierIndex;
    root.replaceChildren(
      h('div', { class: 'arcade-stats' },
        stat(t('panel.denarii'), grouped(p.denarii)),
        stat(t('panel.best'), best === null ? '—' : grouped(best)),
        stat(t('panel.levels'), `${levelsDone(p)}/${LEVELS.length}`),
        stat(t('panel.stars'), `${starsAll(p)}/${LEVELS.length * 3}`)),
      h('div', { class: 'arcade-sub' }, t('panel.map')), pickLine, ...worlds, rules,
      h('div', { class: 'arcade-sub' }, t('panel.town', { have: restored, total: HOMES.length })), meter, town,
      h('div', { class: 'arcade-sub' }, t('panel.missions', { n: p.missionsDone })), log,
      gift);
    void cap;
  };
  render();
  return root;
}
