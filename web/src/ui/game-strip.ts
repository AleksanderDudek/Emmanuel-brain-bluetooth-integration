/**
 * Games in every menu (DESIGN §14.4): a row of game tiles that scrolls sideways, in the views that are not
 * about games — Trening, Sygnał, Sesje, Ustawienia — and under a game's lobby ("Więcej gier"), each with its
 * own choice of games.  The tiles are Start's (`activityTile`); on a desktop two buttons page the row.
 */
import { arcadeEntry } from '../arcade/registry';
import { t } from '../i18n/shell';
import type { Tool } from '../tools';
import { activityTile, drawArcadeCards, GAME_ACTIVITIES, type Activity } from './activities';
import { h } from './dom';

/** Which menu a strip stands in: it decides the strip's title and its choice of games. */
export type StripKind = 'training' | 'signal' | 'again' | 'settings' | 'more';

export interface StripContext {
  /** the game of the day's id */
  today: string;
  /** the games played, most recent first (ids, no repeats) */
  recent: readonly string[];
  /** the game whose lobby the strip stands under (left out of it) */
  current?: string | null;
}

/**
 * The games a strip shows, in order, at most `max`:
 *  - training: the game of the day, then the visualisation and body games not played yet, then the recent ones;
 *  - signal:   the game of the day, then the recent ones, then the rest;
 *  - again:    the recent ones first ("Zagraj ponownie"), then the game of the day, then the unplayed;
 *  - settings: the recent ones, then the game of the day;
 *  - more:     the current game's section first (its neighbours), then the game of the day and the recent ones.
 * Every list is topped up with the remaining arcade games, so a strip is never short.
 */
export function pickGames(kind: StripKind, all: readonly Activity[], ctx: StripContext, max = 10): Activity[] {
  const arcade = all.filter(a => a.arcade);
  const byId = new Map(all.map(a => [a.id, a]));
  const played = new Set(ctx.recent);
  const recent = ctx.recent.map(id => byId.get(id)).filter((a): a is Activity => !!a);
  const today = byId.get(ctx.today);
  const out: Activity[] = [];
  const add = (a: Activity | undefined) => {
    if (a && a.id !== ctx.current && !out.includes(a)) out.push(a);
  };
  switch (kind) {
    case 'training':
      add(today);
      arcade.filter(a => (a.arcade?.kind === 'vision' || a.arcade?.kind === 'body') && !played.has(a.id)).forEach(add);
      recent.forEach(add);
      break;
    case 'signal':
      add(today);
      recent.forEach(add);
      break;
    case 'again':
      recent.forEach(add);
      add(today);
      arcade.filter(a => !played.has(a.id)).forEach(add);
      break;
    case 'settings':
      recent.forEach(add);
      add(today);
      break;
    case 'more': {
      const section = ctx.current ? arcadeEntry(ctx.current)?.kind : undefined;
      if (section) arcade.filter(a => a.arcade?.kind === section).forEach(add);
      add(today);
      recent.forEach(add);
      break;
    }
  }
  arcade.forEach(add);
  return out.slice(0, max);
}

export class GameStrip {
  readonly el: HTMLElement;
  private readonly row: HTMLElement;
  private sig = '';

  constructor(private readonly kind: StripKind) {
    this.row = h('div', { class: 'game-strip' });
    const page = (dir: number) => () => this.row.scrollBy({ left: dir * this.row.clientWidth * 0.9, behavior: 'smooth' });
    const prev = h('button', { class: 'icon-btn strip-nav', type: 'button', 'aria-label': t('strip.prev'), on: { click: page(-1) } }, '‹');
    const next = h('button', { class: 'icon-btn strip-nav', type: 'button', 'aria-label': t('strip.next'), on: { click: page(1) } }, '›');
    this.el = h('section', { class: 'strip-section', 'data-strip': kind },
      h('div', { class: 'row-title' },
        h('h2', { class: 'section-title' }, t(`strip.${kind}`)),
        h('span', { class: 'strip-tools' }, prev, next, h('a', { class: 'more', href: '#gry' }, t('strip.all')))),
      this.row);
  }

  /** Show the strip's games for this band and history (cheap when nothing changed). */
  render(tool: Tool | null, ctx: StripContext): void {
    const list = pickGames(this.kind, GAME_ACTIVITIES(), ctx);
    const sig = `${tool}|${ctx.today}|${ctx.current ?? ''}|${list.map(a => a.id).join(',')}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.row.replaceChildren(...list.map(a => activityTile(a, tool, ctx.today, ' tile-game')));
    this.row.scrollLeft = 0;
    drawArcadeCards(this.row, list);
  }
}
