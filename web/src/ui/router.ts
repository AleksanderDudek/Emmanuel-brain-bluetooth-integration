/**
 * Hash routes of the app (DESIGN.md §2): six destinations in the rail, the
 * exercises under Trening and the games under Gry — the arcade games' lobbies
 * (#gra/<id>) and the embedded HolyHolyHoly games.  Old links (#balance,
 * #sessions, #monitor) still land where they used to.
 */
import { ARCADE } from '../arcade/registry';

export type ViewId = 'start' | 'trening' | 'focus' | 'balance' | 'gry' | 'arcade' | 'sygnal' | 'sesje' | 'ustawienia';
export type NavId = 'start' | 'trening' | 'gry' | 'sygnal' | 'sesje' | 'ustawienia';
export type GameId = 'holyholyholy' | 'holyholyholy3d';

export interface Route {
  view: ViewId;
  nav: NavId;
  /** an embedded game (the full-screen layer over Gry) */
  game: GameId | null;
  /** an arcade game whose lobby is shown */
  arcade: string | null;
  hash: string;
}

const LEGACY: Record<string, string> = { balance: 'trening/balance', sessions: 'sesje', monitor: 'sygnal', '': 'start' };
const GAMES: readonly GameId[] = ['holyholyholy', 'holyholyholy3d'];

export function parseRoute(hash: string): Route {
  let h = hash.replace(/^#/, '');
  h = LEGACY[h] ?? h;
  const [head, sub] = h.split('/');
  const none = { game: null, arcade: null };
  if (head === 'trening' && sub === 'focus') return { view: 'focus', nav: 'trening', ...none, hash: h };
  if (head === 'trening' && sub === 'balance') return { view: 'balance', nav: 'trening', ...none, hash: h };
  if (head === 'gra' && GAMES.includes(sub as GameId)) return { view: 'gry', nav: 'gry', game: sub as GameId, arcade: null, hash: h };
  if (head === 'gra' && ARCADE.some(a => a.id === sub)) return { view: 'arcade', nav: 'gry', game: null, arcade: sub, hash: h };
  if (head === 'start' || head === 'trening' || head === 'gry' || head === 'sygnal' || head === 'sesje' || head === 'ustawienia') {
    return { view: head, nav: head, ...none, hash: head };
  }
  return { view: 'start', nav: 'start', ...none, hash: 'start' };
}

/** Shows one view at a time; calls `onRoute` after every change (also for the first one). */
export class Router {
  current: Route = parseRoute('');

  constructor(private readonly onRoute: (r: Route, prev: Route | null) => void) {
    window.addEventListener('hashchange', () => this.apply());
  }

  start(): void { this.apply(true); }

  go(hash: string): void {
    if (location.hash === `#${hash}`) this.apply();
    else location.hash = hash;
  }

  private apply(first = false): void {
    const prev = first ? null : this.current;
    const r = parseRoute(location.hash);
    if (`#${r.hash}` !== location.hash) history.replaceState(null, '', `#${r.hash}`);
    this.current = r;
    for (const el of document.querySelectorAll<HTMLElement>('.view')) {
      const on = el.id === `view-${r.view}`;
      if (on && el.hidden) {
        el.hidden = false;
        el.classList.remove('enter');
        void el.offsetWidth;   // restart the reveal animation
        el.classList.add('enter');
      } else if (!on) el.hidden = true;
    }
    for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-nav]')) {
      if (a.dataset.nav === r.nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    if (prev && prev.view !== r.view) {
      window.scrollTo({ top: 0 });
      document.getElementById('main')?.focus({ preventScroll: true });
    }
    this.onRoute(r, prev);
  }
}
