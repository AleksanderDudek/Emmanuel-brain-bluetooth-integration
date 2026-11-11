/**
 * Dziewiątka's "Postępy" card in the lobby, from the app's shared .arcade-* classes (styles.css): the
 * records, the map of Zacisze (six districts: quiet with their stars, the one now, the ones later; then
 * the Bell Tower's best floor), the five (each hero a portrait tile with level, colour rank and stars;
 * a tap swaps a hero in — always five), the families in the five with their bonuses, the bag of gear
 * and a boon kept from the last session.  Built with h() and createElement; a change saves and redraws.
 */
import { fmtNum } from '../../i18n';
import { h } from '../../ui/dom';
import {
  CHAPTERS, FAMILIES, HERO_IDS, HEROES, MISSIONS_PER_CHAPTER, RANK_COLOR,
  boonName, chapterName, familyBonusText, familyName, heroName, heroText, rankName, roleName, ultName, type HeroId,
} from './content';
import { t } from './i18n';
import { activeFamilies, bestOf, campaignDone, chapterStars, familyCounts, growth, isBoonId, starsTotal, swapIn, type DziewiatkaProgress } from './meta';
import { paintFace } from './paint';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v));
}

function canvasTile(w: number, hh: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(w * dpr)), height: String(Math.round(hh * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { draw(ctx); } catch { /* a canvas without 2D in a test */ }
  }
  return c;
}

export function progressPanel(p: DziewiatkaProgress, save: () => void): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  let out: HeroId | null = null;
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, out, (id, inFive) => {
      if (inFive) {
        out = out === id ? null : id;
        render();
        return;
      }
      if (swapIn(p, id, out ?? undefined)) {
        if (!p.seen.includes('teamSet')) p.seen.push('teamSet');
        out = null;
        save();
      }
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

function build(p: DziewiatkaProgress, out: HeroId | null, tap: (id: HeroId, inFive: boolean) => void): HTMLElement[] {
  const best = bestOf(p);
  const done = campaignDone(p);
  const nowCh = Math.min(CHAPTERS.length - 1, Math.floor(p.mission / MISSIONS_PER_CHAPTER));
  const map = h('div', { class: 'arcade-album' }, CHAPTERS.map((c, i) => {
    const state = done || i < nowCh ? 'done' : i === nowCh ? 'now' : 'later';
    const stars = chapterStars(p, i), all = MISSIONS_PER_CHAPTER * 3;
    const label = state === 'later' ? `${cap(chapterName(c.id))} · ${t('panel.later')}` : `${cap(chapterName(c.id))} · ${t(state === 'done' ? 'panel.done' : 'panel.now', { stars, all })}`;
    const tile = canvasTile(52, 40, ctx => {
      const g = ctx.createLinearGradient(0, 0, 0, 40);
      g.addColorStop(0, c.sky[0]);
      g.addColorStop(1, c.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 52, 40);
      ctx.fillStyle = c.wall;
      for (let k = 0; k < 4; k++) ctx.fillRect(2 + k * 13, 14 + (k % 2) * 4, 11, 22);
      ctx.fillStyle = c.ground;
      ctx.fillRect(0, 34, 52, 6);
      if (state === 'later') {
        ctx.fillStyle = 'rgba(40,34,50,.55)';
        ctx.fillRect(0, 0, 52, 40);
      }
      if (state === 'now') {
        ctx.fillStyle = 'rgba(70,58,92,.6)';
        for (let k = 0; k < 6; k++) ctx.fillRect(28 + (k % 3) * 7, 8 + Math.floor(k / 3) * 9, 5, 2);
      }
    });
    return h('div', { class: state === 'later' ? null : 'on', title: cap(chapterName(c.id)) }, tile, label);
  }));
  const heroes = h('div', { class: 'arcade-album' }, HERO_IDS.map(id => {
    const owned = p.owned.includes(id);
    const inFive = p.team.includes(id);
    const g = growth(p, id);
    // one canvas (the shared CSS sizes album canvases 52 × 40): the face in its colour rank's ring
    const tile = canvasTile(52, 40, ctx => {
      paintFace(ctx, id, 26, 20, 16, 0, !owned);
      ctx.strokeStyle = owned ? RANK_COLOR[g.rank] ?? '#fff' : 'rgba(255,255,255,.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(26, 20, 17.5, 0, Math.PI * 2);
      ctx.stroke();
    });
    const label = owned
      ? `${heroName(id)} · ${t('panel.lv', { n: g.lv })} · ${'★'.repeat(g.stars)}`
      : `${heroName(id)} · ${t('panel.locked', { m: `${Math.floor(HEROES[id].joins / MISSIONS_PER_CHAPTER) + 1}-${(HEROES[id].joins % MISSIONS_PER_CHAPTER) + 1}` })}`;
    const title = owned ? `${heroName(id)} — ${roleName(HEROES[id].role)}, ${rankName(g.rank)}. ${ultName(id)}: ${heroText(id)}` : heroName(id);
    const cls = [inFive ? 'on legend' : owned ? 'on' : null, out === id ? 'rare' : null].filter(Boolean).join(' ') || null;
    const el = h('div', { class: cls, title, role: owned ? 'button' : null, tabindex: owned ? '0' : null, 'aria-pressed': owned ? String(inFive) : null },
      tile, label, inFive ? h('small', null, t('panel.in')) : null);
    if (owned) {
      const go = (e: Event) => { e.preventDefault(); tap(id, inFive); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(e); });
    }
    return el;
  }));
  const fams = activeFamilies(p.team);
  const counts = familyCounts(p.team);
  const famRows = FAMILIES.map(f => h('span', { class: fams.includes(f) ? 'on' : 'muted', title: familyBonusText(f) },
    `${familyName(f)} ${counts[f]}/3${fams.includes(f) ? ` · ${familyBonusText(f)}` : ''}`));
  const bag = p.bag.reduce((s, v) => s + v, 0);
  const out2: (HTMLElement | null)[] = [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.best'), best === null ? '—' : fmtNum(best)),
      stat(t('panel.total'), fmtNum(p.total)),
      stat(t('panel.stars'), `${starsTotal(p)}★`),
      stat(t('panel.heroes'), `${p.owned.length}/${HERO_IDS.length}`)),
    h('p', { class: 'muted' }, t('panel.rules')),
    h('div', { class: 'arcade-sub' }, t('panel.map')), map,
    done || p.towerBest > 0 ? h('p', { class: 'muted' }, t('panel.tower', { n: p.towerBest })) : null,
    h('div', { class: 'arcade-sub' }, t('panel.team')), heroes,
    h('p', { class: 'muted' }, t('panel.teamHint')),
    h('div', { class: 'arcade-sub' }, t('panel.families')), h('div', { class: 'arcade-chips' }, famRows),
    bag > 0 ? h('p', { class: 'muted' }, t('panel.bag', { n: bag })) : null,
    isBoonId(p.boon) ? h('div', { class: 'arcade-daily done' }, h('div', null, h('b', null, t('panel.boonKept', { name: boonName(p.boon) })))) : null,
  ];
  return out2.filter((x): x is HTMLElement => !!x);
}
