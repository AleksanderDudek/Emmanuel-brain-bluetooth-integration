/**
 * Geoda's "Postępy" card in the lobby, from the shared .arcade-* blocks: the records (the best over
 * every session length, and per length once there are several), the Gablota (nine specimens, each
 * drawn small at the tier found), the depth level's meter, the daily geode, and the published odds
 * of a specimen.
 */
import { h } from '../../ui/dom';
import { dayKey } from '../kit/progress';
import { drawSpecimen } from './art';
import { CRAFT_DUST, MINERALS, NEW_FIRST, PITY, TIER_ODDS, TIERS } from './content';
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
  const note = !known ? null : i === 0 && tier === 0 ? 'kalibracja' : TIERS[tier];
  return h('div', { class: known ? TIER_CLASS[tier] : '', title: known ? `${m.title}: ${TIERS[tier]}${i === 0 && tier === 0 ? ' (za kalibrację)' : ''}` : 'Jeszcze nie znaleziony' },
    c, known ? m.title : '?', note ? h('small', null, note) : null);
}

/** The daily geode's line: it starts with the second session (the first one teaches on its own wall). */
function dailyText(p: GeodaProgress, done: boolean): string {
  if (done) return `Zagrana: ${p.dailyBest} ct. Jutro nowa ściana.`;
  if (p.sessions === 0) return 'Od drugiej sesji: codziennie ta sama ściana i nasiona dla wszystkich.';
  return 'Ta sama ściana i nasiona dla wszystkich. Twoja następna sesja zagra dzisiejszą.';
}

export function progressPanel(p: GeodaProgress): HTMLElement {
  const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
  const best = bestCarats(p);
  const d = depth(p.xp);
  const fill = h('i');
  fill.style.width = `${Math.round((100 * (p.xp - d.from)) / Math.max(1, d.to - d.from))}%`;
  const dailyDone = p.dailyDay === dayKey();
  const odds = TIER_ODDS.map((o, t) => `${TIERS[t]} ${Math.round(o * 100)}%`).join(', ');
  // records per length, once the player has played more than one
  const perLength = LENGTHS.filter(s => p.best[String(s)] !== undefined).map(s => `${s / 60} min: ${p.best[String(s)]} ct`);
  return h('div', { class: 'arcade-panel' },
    h('div', { class: 'arcade-stats' },
      stat('Rekord', best === null ? '—' : String(best), best === null ? '' : 'ct'),
      stat('Najdłuższa ciągłość', String(p.longestCont), 's'),
      stat('Gablota', `${found(p)}/${MINERALS.length}`),
      stat('Głębokość', String(d.level))),
    perLength.length > 1 ? h('p', { class: 'muted' }, `Rekordy: ${perLength.join(' · ')}`) : null,
    h('div', { class: 'arcade-meter' },
      h('span', null, `Głębokość ${d.level + 1}`, h('b', null, `${p.xp - d.from}/${d.to - d.from} XP`)), h('i', null, fill)),
    h('div', { class: 'arcade-sub' }, `Gablota${p.biggest ? ` · największy okaz ${p.biggest.toFixed(1)} cm` : ''} · pył ${p.dust}/${CRAFT_DUST}`),
    h('div', { class: 'arcade-album' }, MINERALS.map((_, i) => specimenTile(i, p.gablota[i]))),
    h('div', { class: `arcade-daily${dailyDone ? ' done' : ''}` },
      h('div', null, h('b', null, 'Geoda dnia'), h('p', null, dailyText(p, dailyDone))),
      h('span', { class: `badge${dailyDone ? ' ok' : ''}` }, dailyDone ? '1/1' : '0/1')),
    h('p', { class: 'muted' }, `Szanse okazu: ${odds} — lepsze za czyste kryształy. `
      + `Piękny najpóźniej co ${PITY[1]} sesji, rzadki co ${PITY[2]}, muzealny co ${PITY[3]}. `
      + `Minerał: w pierwszych ${NEW_FIRST} geodach zawsze nowy, potem każdy 1 na ${MINERALS.length}.`));
}
