/**
 * Geoda's "Postępy" card in the lobby, from the shared .arcade-* blocks: the records (the best over
 * every session length, and per length once there are several), the Gablota (nine specimens, each
 * drawn small at the tier found), the depth level's meter, the daily geode, and the published odds
 * of a specimen.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { drawSpecimen } from './art';
import { CRAFT_DUST, MINERALS, NEW_FIRST, PITY, TIER_ODDS, TIERS } from './content';
import { pct, t } from './i18n';
import { bestCarats, depth, found, type GeodaProgress } from './meta';

const TIER_CLASS = ['on', 'on rare', 'on epic', 'on legend'];
/** the session lengths the lobby offers (s) */
const LENGTHS = [180, 300, 600];

function specimenTile(i: number, tier: number | null | undefined): HTMLElement {
  const m = MINERALS[i];
  const known = tier !== null && tier !== undefined;
  const c = h('canvas', { width: '104', height: '80', 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(2, 2);
    drawSpecimen(ctx, 26, 19, 30, i, known ? tier : 0, 1.3);
    if (!known) {
      // not found yet: only its silhouette
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#2b2433';
      ctx.fillRect(0, 0, 52, 40);
    }
  }
  // the amethyst comes with the calibration; the note is short (10 characters fit a desktop tile)
  const calib = known && i === 0 && tier === 0;
  const note = !known ? null : calib ? t('panel.calib') : tier === TIERS.length - 1 ? t('panel.museumShort') : TIERS[tier];
  const title = !known ? t('panel.notFound') : t(calib ? 'panel.tileCalib' : 'panel.tile', { mineral: m.title, tier: TIERS[tier] });
  return h('div', { class: known ? TIER_CLASS[tier] : '', title },
    c, known ? m.title : '?', note ? h('small', null, note) : null);
}

/** The daily geode's line: it starts with the second session (the first one teaches on its own wall). */
function dailyText(p: GeodaProgress, done: boolean): string {
  if (done) return t('panel.dailyDone', { ct: p.dailyBest });
  if (p.sessions === 0) return t('panel.dailyLater');
  return t('panel.dailyNext');
}

export function progressPanel(p: GeodaProgress): HTMLElement {
  const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
  const best = bestCarats(p);
  const d = depth(p.xp);
  const fill = h('i');
  fill.style.width = `${Math.round((100 * (p.xp - d.from)) / Math.max(1, d.to - d.from))}%`;
  const dailyDone = p.dailyDay === dayKey();
  const odds = TIER_ODDS.map((o, tier) => t('panel.oddsItem', { tier: TIERS[tier], pct: pct(Math.round(o * 100)) })).join(', ');
  // records per length, once the player has played more than one
  const perLength = LENGTHS.filter(s => p.best[String(s)] !== undefined).map(s => `${s / 60} min: ${p.best[String(s)]} ct`);
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : String(best), best === null ? '' : 'ct'),
      stat(t('word.longest'), String(p.longestCont), 's'),
      stat(t('word.cabinet'), `${found(p)}/${MINERALS.length}`),
      stat(t('panel.depth'), String(d.level))),
    perLength.length > 1 ? h('p', { class: 'muted' }, t('panel.bests', { list: perLength.join(' · ') })) : null,
    h('div', { class: 'arcade-meter' },
      h('span', null, t('panel.nextDepth', { level: d.level + 1 }), h('b', null, `${p.xp - d.from}/${d.to - d.from} XP`)), h('i', null, fill)),
    h('div', { class: 'arcade-sub' }, p.biggest
      ? t('panel.cabinetLineBiggest', { cm: fmtNum(p.biggest, 1), dust: p.dust, need: CRAFT_DUST })
      : t('panel.cabinetLine', { dust: p.dust, need: CRAFT_DUST })),
    h('div', { class: 'arcade-album' }, MINERALS.map((_, i) => specimenTile(i, p.gablota[i]))),
    h('div', { class: `arcade-daily${dailyDone ? ' done' : ''}` },
      h('div', null, h('b', null, t('panel.daily')), h('p', null, dailyText(p, dailyDone))),
      h('span', { class: `badge${dailyDone ? ' ok' : ''}` }, dailyDone ? '1/1' : '0/1')),
    h('p', { class: 'muted' }, [
      t('panel.odds', { odds }),
      t('panel.pity', { fine: PITY[1], rare: PITY[2], museum: PITY[3] }),
      t('panel.newRule', { first: NEW_FIRST, all: MINERALS.length }),
    ].join(' ')));
}
