/** The exercises (Trening) and the games (Gry), each with the tools it works with (DESIGN.md §2). */
import { drawArcadeArt } from '../arcade/art';
import { ARCADE, type ArcadeEntry } from '../arcade/registry';
import type { HubStatus } from '../hub';
import type { SceneId } from '../settings';
import type { Tool } from '../tools';
import { drawScenePreview } from '../training/scene';
import { GAMES } from './games';
import { $, h } from './dom';

export interface Activity {
  id: string;
  /** Trening (exercises) or Gry (games) */
  group: 'train' | 'game';
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
  /** an arcade game: the art is a still from its own preview */
  arcade?: ArcadeEntry;
}

/** The game's picture over its card's gradient; it simply stays away when the game is not built (dev server). */
export function artImage(a: Activity): HTMLImageElement | null {
  if (!a.img) return null;
  const img = h('img', { class: `art-img art-img-${a.id}`, src: `${import.meta.env.BASE_URL}${a.img}`, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.remove(), { once: true });
  return img;
}

/** An arcade game's card, from the registry. */
const arcadeActivity = (a: ArcadeEntry): Activity => ({
  id: a.id, group: 'game', title: a.title, text: a.text, href: `#gra/${a.id}`, cta: 'Graj', art: a.art, tools: a.tools, arcade: a,
});

export const ACTIVITIES: Activity[] = [
  {
    id: 'focus', group: 'train', title: 'Trening skupienia', href: '#trening/focus', cta: 'Przygotuj sesję', art: 'art-orb', tools: ['fnirs', 'eeg'],
    text: 'Kula unosi się, gdy kora przedczołowa pracuje mocniej niż na początku sesji. 3–15 minut, punkty za utrzymanie, wynik dnia i seria — jak w treningu Mendi.',
  },
  {
    id: 'balance', group: 'train', title: 'Równowaga półkul', href: '#trening/balance', cta: 'Otwórz', art: 'art-balance', tools: ['fnirs'],
    text: 'Zadania słowne, przestrzenne i uważność dobierane do tego, która strona kory przeważa.',
  },
  ...ARCADE.map(arcadeActivity),
  {
    id: 'holyholyholy', group: 'game', title: GAMES.holyholyholy.title, href: '#gra/holyholyholy', cta: 'Graj', art: 'art-holy', tools: ['fnirs'], optional: true,
    img: 'holyholyholy/icon.svg',
    text: GAMES.holyholyholy.text,
  },
  {
    id: 'holyholyholy3d', group: 'game', title: GAMES.holyholyholy3d.title, href: '#gra/holyholyholy3d', cta: 'Graj', art: 'art-holy3d', tools: ['fnirs'], optional: true,
    img: 'holyholyholy3d/michal.webp',
    text: GAMES.holyholyholy3d.text,
  },
];

export const EXERCISES = (): Activity[] => ACTIVITIES.filter(a => a.group === 'train');
export const GAME_ACTIVITIES = (): Activity[] => ACTIVITIES.filter(a => a.group === 'game');

const TAG: Record<Tool, string> = { fnirs: 'fNIRS', eeg: 'EEG' };

/** Why an activity cannot use the current tool (null = it can). */
export function whyNot(a: Activity, tool: Tool | null): string | null {
  if (!tool || a.tools.includes(tool)) return null;
  return a.optional ? 'Z EEG gra działa bez opaski — opaskę Mendi czyta po przełączeniu na fNIRS.' : 'Wymaga opaski fNIRS (Mendi) — przełącz narzędzie u góry.';
}

/** Draw the arcade cards' art in `root` (after it is laid out: a hidden canvas has no size). */
export function drawArcadeCards(root: HTMLElement, list: Activity[]): void {
  requestAnimationFrame(() => {
    for (const a of list) {
      const c = a.arcade && root.querySelector<HTMLCanvasElement>(`[data-activity="${a.id}"] canvas.arcade-art`);
      if (c && a.arcade) void drawArcadeArt(c, a.arcade);
    }
  });
}

export class ActivitiesView {
  private tool: Tool | null | undefined = undefined;
  private scene: SceneId | null = null;
  private artDrawn = false;
  private readonly cards = new Map<Activity['id'], { el: HTMLAnchorElement; why: HTMLElement }>();

  /** @param containerId where the cards go; @param list which activities */
  constructor(private readonly containerId: string, private readonly list: Activity[]) {
    $(containerId).replaceChildren(...list.map(a => {
      const art = h('div', { class: `art ${a.art}` }, artImage(a));
      if (a.id === 'focus') art.append(h('canvas', { class: 'scene-art', 'aria-hidden': 'true' }));
      if (a.arcade) art.append(h('canvas', { class: 'scene-art arcade-art', 'aria-hidden': 'true' }));
      const why = h('p', { class: 'why' });
      const el = h('a', { class: 'activity' + (a.id === 'focus' ? ' feature' : ''), href: a.href, 'data-activity': a.id },
        art,
        h('div', { class: 'body' },
          h('div', { class: 'tags' }, a.tools.map(t => h('span', { class: 'badge' }, a.optional ? `${TAG[t]} · opcjonalnie` : TAG[t]))),
          h('h2', null, a.title), h('p', null, a.text), why,
          h('span', { class: 'btn cta' + (a.id === 'focus' || a.group === 'game' ? ' primary' : '') }, `${a.cta} →`)));
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
    if (!this.artDrawn) {
      this.artDrawn = true;
      drawArcadeCards($(this.containerId), this.list);
    }
  }

  /** Redraw the art after the view became visible (a hidden canvas has no size). */
  shown(): void {
    this.scene = null;
    this.artDrawn = false;
  }
}
