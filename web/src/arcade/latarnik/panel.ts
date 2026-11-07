/**
 * Latarnik's "Postępy" card in the lobby: records, the map of nights with their stars and the next
 * night's goal, the workshop (the player picks what the crates buy next), the village lit by the
 * stars, the amber album, the newest letter from the bottle, and the day's "Noc dnia".  Built with h() from
 * the shared .arcade-* classes (styles.css); the album tiles draw their amber.  It stays short on
 * a phone: the set being collected is open and the other folds to one line, the published odds
 * and the rules fold to one muted line, and the letter shows three lines with the rest a tap away.
 */
import { dayKey } from '../kit/progress';
import { h } from '../../ui/dom';
import { AMBER, CRAFT_OKRUCHY, DUPLICATE_OKRUCHY, LETTERS, SETS, TIERS, TIER_CLASS, TIER_FEAT, TIER_NAME, UPGRADE_NAME, UPGRADE_WHAT, VILLAGE, type AmberPiece } from './content';
import { cap, goalText, nightName, t, unit } from './i18n';
import { costOf, newChance, owned, starsOf, village, workshopTarget, type LatarnikProgress } from './meta';
import { nightSpec } from './nights';
import { UPGRADES, UPGRADE_MAX, type Upgrade } from './rules';
import { paintAmber } from './paint';

function stat(k: string, v: string, unit = ''): HTMLElement {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
}

function tile(p: LatarnikProgress, a: AmberPiece): HTMLElement {
  const own = owned(p, a.index);
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = h('canvas', { width: String(Math.round(52 * dpr)), height: String(Math.round(40 * dpr)), 'aria-hidden': 'true' });
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintAmber(ctx, 26, 20, 46, 36, own ? a.inclusion : null, SETS[a.set].tone, a.index * 1.7 + 0.3, own);
  }
  const cls = own ? `on ${TIER_CLASS[a.tier]}`.trim() : null;
  const name = cap(a.name), tier = TIER_NAME[a.tier];
  return h('div', { class: cls, title: own ? t('panel.tile', { name, tier }) : t('panel.tileHidden', { tier }) }, c, own ? name : '?', h('small', null, tier));
}

/** A fold: one line (`summary`) until tapped. */
function fold(summary: string, cls: string, ...kids: (Node | null)[]): HTMLElement {
  return h('details', null, h('summary', { class: cls }, `${summary} ▾`), h('div', { class: 'arcade-panel mt10' }, ...kids));
}

/** Show at most `lines` lines of `el` (null: all of it); CSSOM only, the CSP forbids style attributes. */
function clampLines(el: HTMLElement, lines: number | null): void {
  const s = el.style;
  s.display = lines ? '-webkit-box' : 'block';
  s.setProperty('-webkit-box-orient', 'vertical');
  if (lines) s.setProperty('-webkit-line-clamp', String(lines));
  else s.removeProperty('-webkit-line-clamp');
  s.overflow = lines ? 'hidden' : '';
}

/** The newest letter: three lines, the whole letter a tap away (a native <details>). */
function letterFold(text: string): HTMLElement {
  const body = h('span', { class: 'lede' }, t('panel.quote', { text }));
  const sign = h('span', { class: 'muted' }, t('panel.sign'));
  sign.style.display = 'block';
  sign.style.marginTop = '4px';
  clampLines(body, 3);
  const d = h('details', null, h('summary', null, body, sign));
  d.addEventListener('toggle', () => {
    clampLines(body, d.open ? null : 3);
    sign.textContent = t(d.open ? 'panel.signed' : 'panel.sign');
  });
  return d;
}

/** A workshop button: the upgrade, its level, and whether the crates go to it now. */
function upgradeButton(p: LatarnikProgress, u: Upgrade, changed: () => void): HTMLButtonElement {
  const target = workshopTarget(p);
  const on = target === u;
  const top = costOf(p, u) === null;
  const b = h('button', {
    class: on ? 'btn primary' : 'btn', type: 'button', 'aria-pressed': on ? 'true' : 'false', title: cap(UPGRADE_WHAT[u]),
    disabled: top ? 'true' : null,
  }, `${cap(UPGRADE_NAME[u])} ${t('panel.level', { lv: p.upgrades[u], max: UPGRADE_MAX[u] })}`);
  b.addEventListener('click', e => {
    e.preventDefault();
    if (top || p.focus === u) return;
    p.focus = u;
    changed();
  });
  return b;
}

/** The nights so far and the next one: a strip of stars (a squall marked ⚡). */
function nightMap(p: LatarnikProgress): HTMLElement {
  const shown = Math.max(5, Math.min(p.night + 2, 10));
  const from = Math.max(0, p.night + 2 - shown);
  const tiles: HTMLElement[] = [];
  for (let i = from; i < from + shown; i++) {
    const spec = nightSpec(i), stars = p.nightStars[i] ?? 0;
    const state = i < p.night ? 'done' : i === p.night ? 'next' : 'later';
    const mark = state === 'later' ? '…' : state === 'next' ? '→' : '★'.repeat(Math.max(1, stars)) + '☆'.repeat(3 - Math.max(1, stars));
    tiles.push(h('span', { title: `${nightName(spec.kind)} · ${goalText(spec.kind, spec.goal)}`, class: state === 'done' ? 'on' : null },
      `${spec.boss ? '⚡' : ''}${i + 1} · ${mark}`));
  }
  return h('div', { class: 'arcade-chips' }, tiles);
}

export function progressPanel(p: LatarnikProgress, save: () => void = () => {}): HTMLElement {
  const root = h('div', { class: 'arcade-panel' });
  const render = (): void => {
    while (root.firstChild) root.removeChild(root.firstChild);
    for (const el of build(p, () => {
      save();
      render();
    })) root.appendChild(el);
  };
  render();
  return root;
}

function build(p: LatarnikProgress, changed: () => void): HTMLElement[] {
  const stars = starsOf(p);
  const v = village(stars);
  const bar = h('i');
  bar.style.width = `${v.next ? Math.round((v.have / v.need) * 100) : 100}%`;
  const port = h('div', { class: 'arcade-meter' },
    h('span', null, v.next ? t('panel.villageNext', { name: v.next.name, have: v.have, need: v.need }) : t('panel.villageDone'),
      h('b', null, `${v.built}/${VILLAGE.length}`)),
    h('i', null, bar));
  const steps = h('div', { class: 'arcade-chips' }, VILLAGE.map((s, i) => h('span', { class: i < v.built ? 'on' : null, title: cap(s.name) }, s.short)));

  // the workshop: what the crates go to (the player's pick), and the chest toward it
  const target = workshopTarget(p);
  const cost = target ? costOf(p, target) : null;
  const chest = h('i');
  chest.style.width = `${cost ? Math.min(100, Math.round((p.chest / cost) * 100)) : 100}%`;
  const workshop = h('div', { class: 'arcade-meter' },
    h('span', null, target ? `${cap(UPGRADE_NAME[target])}: ${UPGRADE_WHAT[target]}` : t('panel.allBought'),
      h('b', null, cost ? t('panel.chest', { have: p.chest, need: cost }) : '')),
    h('i', null, chest));

  // the album: the set being collected (the incomplete one with more pieces), the other folded to one line
  const sets = SETS.map((_, si) => AMBER.filter(a => a.set === si));
  const have = sets.map(ps => ps.filter(a => owned(p, a.index)).length);
  const done = (si: number) => have[si] === sets[si].length;
  const cur = done(0) !== done(1) ? (done(0) ? 1 : 0) : have[1] > have[0] ? 1 : 0;
  const other = 1 - cur;
  const grid = (si: number) => h('div', { class: 'arcade-album' }, sets[si].map(a => tile(p, a)));
  const odds = fold(t('panel.odds', { crumbs: t('crumbs', { n: p.okruchy }) }), 'muted',
    h('div', { class: 'arcade-chips' }, TIERS.map(tier =>
      h('span', { title: t('panel.oddsHint') }, t('panel.oddsChip', { tier: cap(TIER_NAME[tier]), feat: TIER_FEAT[tier], n: Math.round(newChance(p, tier) * 100) })))),
    h('p', { class: 'muted' }, t('panel.rules', { dup: t('crumbs', { n: DUPLICATE_OKRUCHY }), craft: t('crumbs', { n: CRAFT_OKRUCHY }) })));

  const letter = p.letters > 0 ? LETTERS[p.letters - 1].replace(/\s*Hania$/, '') : null;
  const today = dayKey();
  const playedToday = p.dailyDay === today;
  const daily = h('div', { class: playedToday ? 'arcade-daily done' : 'arcade-daily' },
    h('div', null, h('b', null, t('daily.title')),
      h('p', null, playedToday ? t('daily.done', { boats: t('boats', { n: p.dailyScore }) }) : t('daily.todo'))),
    h('span', { class: 'badge' }, playedToday ? '1/1' : '0/1'));
  const next = nightSpec(p.night);

  return [
    h('div', { class: 'arcade-stats' },
      stat(t('panel.inPort'), String(p.boats), unit(p.boats)),
      stat(t('stat.streak'), String(p.bestStreak)),
      stat(t('stat.farthest'), String(p.farthest), '%'),
      stat(t('panel.whales'), String(p.whales))),
    h('div', { class: 'arcade-sub' }, t('panel.nights', { stars })), nightMap(p),
    h('p', { class: 'muted' }, `${t('panel.nightNext', { n: next.n + 1, name: nightName(next.kind) })} · ${goalText(next.kind, next.goal)}`),
    h('p', { class: 'muted' }, t('stars.rule')),
    h('div', { class: 'arcade-sub' }, t('panel.workshop')),
    h('div', { class: 'seg' }, UPGRADES.map(u => upgradeButton(p, u, changed))),
    workshop,
    h('p', { class: 'muted' }, t('panel.pick')),
    h('div', { class: 'arcade-sub' }, t('panel.village', { built: v.built, total: VILLAGE.length })), port, steps,
    h('div', { class: 'arcade-sub' }, t('panel.amber', { set: SETS[cur].name, have: have[cur], total: sets[cur].length })), grid(cur),
    fold(`${SETS[other].name} · ${have[other]}/${sets[other].length}`, 'arcade-sub', grid(other)),
    odds,
    h('div', { class: 'arcade-sub' }, t('panel.letters', { n: p.letters, total: LETTERS.length })),
    letter ? letterFold(letter) : h('p', { class: 'muted' }, t('panel.noLetter')),
    daily,
  ];
}
