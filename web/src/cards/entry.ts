/**
 * Where the exercise cards meet the app (src/cards/DESIGN.md §1): the card in Trening and the tile
 * on Start, the module's view (#karty…) and its lazy loading.  This file stays small — the module
 * itself (its views, games, texts and styles) is a chunk of its own, loaded the first time a
 * #karty route opens, so the app's start-up does not pay for it.
 */
import type { Hub, HubStatus } from '../hub';
import type { SessionDB } from '../storage/db';
import type { TrainingResult } from '../training/score';
import './entry.css';
import { te } from './i18n-entry';

/** What Trening and Start show about the cards (the fields of src/ui/activities.ts Activity). */
export const CARDS_ACTIVITY = {
  id: 'karty', group: 'train' as const, title: te('act.title'), text: te('act.text'), href: '#karty', cta: te('act.cta'), art: 'art-cards',
  tools: ['fnirs', 'eeg'] as ('fnirs' | 'eeg')[], optional: true, tile: te('act.tile'),
};

export interface CardsEntryDeps {
  hub: Hub;
  db: SessionDB;
  onTraining: (r: TrainingResult) => void;
  mark: (label: string) => void;
  record: { start: (name: string, sec: number) => Promise<boolean>; stop: () => Promise<void> };
  openSheet: () => void;
}

type Module = import('./view').CardsModule;

export class CardsEntry {
  readonly section: HTMLElement;
  private mod: Module | null = null;
  private loading: Promise<Module> | null = null;
  private wanted: string | null | undefined = undefined;

  constructor(private readonly d: CardsEntryDeps) {
    // the view's section joins the app's others (the router shows one .view at a time)
    const s = document.createElement('section');
    s.className = 'view';
    s.id = 'view-karty';
    s.hidden = true;
    s.setAttribute('aria-label', te('act.title'));
    document.getElementById('main')?.append(s);
    this.section = s;
  }

  /** A session or a paper run is open (the app keeps the screen awake). */
  get active(): boolean { return !!this.mod?.active; }
  /** …and leaving now would lose something (the app asks first); not while pairing or on a saved summary */
  get busy(): boolean { return !!this.mod?.busy; }

  private load(): Promise<Module> {
    this.loading ??= (async () => {
      const [{ CardsModule }, { CardStore }] = await Promise.all([import('./view'), import('./store'), import('./cards.css')]);
      const store = await CardStore.open();
      const mod = new CardsModule({ ...this.d, store }, this.section);
      await mod.init();
      this.mod = mod;
      return mod;
    })();
    return this.loading;
  }

  show(sub: string | null): void {
    this.wanted = sub;
    if (this.mod) { this.mod.show(sub); return; }
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = te('act.loading');
    this.section.replaceChildren(p);
    this.load().then(m => { if (this.wanted !== undefined) m.show(this.wanted); m.renderStatus(this.d.hub.status); })
      .catch(e => { p.textContent = te('act.failed', { error: e instanceof Error ? e.message : String(e) }); this.loading = null; });
  }

  hide(): void { this.wanted = undefined; }

  renderStatus(s: HubStatus): void { this.mod?.renderStatus(s); }
}
