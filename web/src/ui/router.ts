/**
 * Hash routes of the app (DESIGN.md §2): five destinations in the rail, plus
 * the activities under Trening.  Old links (#balance, #sessions, #monitor)
 * still land where they used to.
 */

export type ViewId = 'start' | 'trening' | 'focus' | 'balance' | 'sygnal' | 'sesje' | 'ustawienia';
export type NavId = 'start' | 'trening' | 'sygnal' | 'sesje' | 'ustawienia';
export type GameId = 'holyholyholy' | 'holyholyholy3d';

export interface Route { view: ViewId; nav: NavId; game: GameId | null; hash: string }

const LEGACY: Record<string, string> = { balance: 'trening/balance', sessions: 'sesje', monitor: 'sygnal', '': 'start' };
const GAMES: readonly GameId[] = ['holyholyholy', 'holyholyholy3d'];

export function parseRoute(hash: string): Route {
  let h = hash.replace(/^#/, '');
  h = LEGACY[h] ?? h;
  const [head, sub] = h.split('/');
  if (head === 'trening' && sub === 'focus') return { view: 'focus', nav: 'trening', game: null, hash: h };
  if (head === 'trening' && sub === 'balance') return { view: 'balance', nav: 'trening', game: null, hash: h };
  if (head === 'gra' && GAMES.includes(sub as GameId)) return { view: 'trening', nav: 'trening', game: sub as GameId, hash: h };
  if (head === 'start' || head === 'trening' || head === 'sygnal' || head === 'sesje' || head === 'ustawienia') {
    return { view: head, nav: head, game: null, hash: head };
  }
  return { view: 'start', nav: 'start', game: null, hash: 'start' };
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
