/** The exercises (Trening) and the games (Gry), each with the tools it works with (DESIGN.md §2). */
import type { HubStatus } from '../hub';
import type { SceneId } from '../settings';
import type { Tool } from '../tools';
import { drawScenePreview } from '../training/scene';
import { GAMES } from './games';
import { $, h } from './dom';

export interface Activity {
  id: 'focus' | 'balance' | 'holyholyholy' | 'holyholyholy3d';
  title: string;
  text: string;
  href: string;
  cta: string;
  art: string;
  /** tools whose band drives it */
  tools: Tool[];
  /** usable without a band of these tools (the games) */
  optional?: boolean;
  /** a picture from the game's own build, relative to the app's base */
  img?: string;
}

/** The game's picture over its card's gradient; it simply stays away when the game is not built (dev server). */
export function artImage(a: Activity): HTMLImageElement | null {
  if (!a.img) return null;
  const img = h('img', { class: `art-img art-img-${a.id}`, src: `${import.meta.env.BASE_URL}${a.img}`, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.remove(), { once: true });
  return img;
}

export const ACTIVITIES: Activity[] = [
  {
    id: 'focus', title: 'Trening skupienia', href: '#trening/focus', cta: 'Przygotuj sesję', art: 'art-orb', tools: ['fnirs', 'eeg'],
    text: 'Kula unosi się, gdy kora przedczołowa pracuje mocniej niż na początku sesji. 3–15 minut, punkty za utrzymanie, wynik dnia i seria — jak w treningu Mendi.',
  },
  {
    id: 'balance', title: 'Równowaga półkul', href: '#trening/balance', cta: 'Otwórz', art: 'art-balance', tools: ['fnirs'],
    text: 'Zadania słowne, przestrzenne i uważność dobierane do tego, która strona kory przeważa.',
  },
  {
    id: 'holyholyholy', title: GAMES.holyholyholy.title, href: '#gra/holyholyholy', cta: 'Graj', art: 'art-holy', tools: ['fnirs'], optional: true,
    img: 'holyholyholy/icon.svg',
    text: GAMES.holyholyholy.text,
  },
  {
    id: 'holyholyholy3d', title: GAMES.holyholyholy3d.title, href: '#gra/holyholyholy3d', cta: 'Graj', art: 'art-holy3d', tools: ['fnirs'], optional: true,
    img: 'holyholyholy3d/michal.webp',
    text: GAMES.holyholyholy3d.text,
  },
];

export const EXERCISES = (): Activity[] => ACTIVITIES.filter(a => !a.optional);
export const GAME_ACTIVITIES = (): Activity[] => ACTIVITIES.filter(a => a.optional);

const TAG: Record<Tool, string> = { fnirs: 'fNIRS', eeg: 'EEG' };

/** Why an activity cannot use the current tool (null = it can). */
export function whyNot(a: Activity, tool: Tool | null): string | null {
  if (!tool || a.tools.includes(tool)) return null;
  return a.optional ? 'Z EEG gra działa bez opaski — opaskę Mendi czyta po przełączeniu na fNIRS.' : 'Wymaga opaski fNIRS (Mendi) — przełącz narzędzie u góry.';
}

export class ActivitiesView {
  private tool: Tool | null | undefined = undefined;
  private scene: SceneId | null = null;
  private readonly cards = new Map<Activity['id'], { el: HTMLAnchorElement; why: HTMLElement }>();

  /** @param containerId where the cards go; @param list which activities */
  constructor(containerId: string, list: Activity[]) {
    $(containerId).replaceChildren(...list.map(a => {
      const art = h('div', { class: `art ${a.art}` }, artImage(a));
      if (a.id === 'focus') art.append(h('canvas', { class: 'scene-art', 'aria-hidden': 'true' }));
      const why = h('p', { class: 'why' });
      const el = h('a', { class: 'activity' + (a.id === 'focus' ? ' feature' : ''), href: a.href, 'data-activity': a.id },
        art,
        h('div', { class: 'body' },
          h('div', { class: 'tags' }, a.tools.map(t => h('span', { class: 'badge' }, a.optional ? `${TAG[t]} · opcjonalnie` : TAG[t]))),
          h('h2', null, a.title), h('p', null, a.text), why,
          h('span', { class: 'btn cta' + (a.id === 'focus' || a.optional ? ' primary' : '') }, `${a.cta} →`)));
      this.cards.set(a.id, { el, why });
      return el;
    }));
  }

  render(st: HubStatus, scene: SceneId): void {
    if (st.tool !== this.tool) {
      this.tool = st.tool;
      for (const a of ACTIVITIES) {
        const c = this.cards.get(a.id);
        if (!c) continue;
        const why = whyNot(a, st.tool);
        c.why.textContent = why ?? '';
        c.el.setAttribute('aria-disabled', String(!!why && !a.optional));
      }
    }
    if (scene !== this.scene) {
      this.scene = scene;
      const canvas = this.cards.get('focus')?.el.querySelector('canvas');
      if (canvas) requestAnimationFrame(() => drawScenePreview(canvas, scene));
    }
  }

  /** Redraw the art after the view became visible (a hidden canvas has no size). */
  shown(): void { this.scene = null; }
}
