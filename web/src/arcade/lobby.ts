/**
 * A game's lobby (#gra/<id>, DESIGN.md §9): the game's animated picture, how the band plays it,
 * the player's progress (records, collection), the session length and sound, and the readiness
 * of the signal with the one button that starts.
 */
import type { HubStatus } from '../hub';
import type { AppSettings, ArcadePrefs } from '../settings';
import type { SessionDB } from '../storage/db';
import { $, h, run } from '../ui/dom';
import { readiness } from '../ui/focus';
import { loadProgress, saveProgress } from './kit/progress';
import type { ArcadeModule } from './kit/types';
import { arcadeEntry, type ArcadeEntry } from './registry';

const LENGTHS: ArcadePrefs['minutes'][] = [3, 5, 10];

export interface LobbyDeps {
  db: SessionDB;
  settings: AppSettings;
  save: () => Promise<void>;
  onPlay: (entry: ArcadeEntry, mod: ArcadeModule, progress: object) => void;
}

export class ArcadeLobby {
  private entry: ArcadeEntry | null = null;
  private mod: ArcadeModule | null = null;
  private progress: object | null = null;
  private loading: string | null = null;
  private raf = 0;
  private t0 = 0;
  private visible = false;
  private playing = false;
  private sig = '';

  constructor(private readonly d: LobbyDeps) {
    const p = d.settings.arcade;
    $('arcadeLen').replaceChildren(...LENGTHS.map(m => h('button', {
      class: 'btn', type: 'button', role: 'radio', 'aria-checked': String(p.minutes === m), on: { click: () => this.set({ minutes: m }) },
    }, `${m} min`)));
    const bind = (id: string, key: 'sound' | 'haptics') => {
      const el = $<HTMLInputElement>(id);
      el.checked = p[key];
      el.addEventListener('change', () => this.set({ [key]: el.checked }));
    };
    bind('arcadeSound', 'sound');
    bind('arcadeHaptics', 'haptics');
    $('btnArcadePlay').addEventListener('click', run(() => {
      if (!this.entry || !this.mod || !this.progress) throw new Error('Gra jeszcze się wczytuje');
      this.d.onPlay(this.entry, this.mod, this.progress);
    }));
    window.addEventListener('resize', () => { if (this.visible) this.sizeHero(); });
  }

  private set(patch: Partial<ArcadePrefs>): void {
    Object.assign(this.d.settings.arcade, patch);
    void this.d.save();
    const m = this.d.settings.arcade.minutes;
    $('arcadeLen').querySelectorAll<HTMLButtonElement>('button').forEach((b, i) => b.setAttribute('aria-checked', String(LENGTHS[i] === m)));
  }

  /** The route opened this game's lobby. */
  async show(id: string): Promise<void> {
    const entry = arcadeEntry(id);
    if (!entry) return;
    this.visible = true;
    this.sig = '';
    if (this.entry?.id !== id) {
      this.entry = entry;
      this.mod = null;
      this.progress = null;
      $('arcadeTitle').textContent = entry.title;
      $('arcadeTagline').textContent = entry.tagline;
      $('arcadeKicker').textContent = `Gra · ${entry.tools.map(t => (t === 'fnirs' ? 'Mendi' : 'HALO')).join(' lub ')}`;
      $('arcadeHow').replaceChildren(...entry.how.map(t => h('li', null, t)));
      $('arcadeProgressBody').replaceChildren(h('p', { class: 'muted' }, 'Wczytuję…'));
      document.body.dataset.arcade = entry.id;
    }
    if (!this.mod && this.loading !== id) {
      this.loading = id;
      try {
        const mod = await entry.load();
        const progress = await loadProgress(this.d.db, id, () => mod.freshProgress());
        if (this.entry?.id !== id) return;
        this.mod = mod;
        this.progress = progress;
      } finally {
        this.loading = null;
      }
    }
    this.renderProgress();
    this.sizeHero();
    cancelAnimationFrame(this.raf);
    this.t0 = performance.now();
    if (!this.playing) this.raf = requestAnimationFrame(this.animate);
  }

  hide(): void {
    this.visible = false;
    cancelAnimationFrame(this.raf);
  }

  /** A game runs full screen over the lobby: stop drawing the hero underneath it. */
  suspend(): void {
    this.playing = true;
    cancelAnimationFrame(this.raf);
  }

  /** Back from the game: the progress changed, the hero runs again, and focus returns to "Graj". */
  resume(): void {
    this.playing = false;
    this.renderProgress();
    if (!this.visible) return;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.animate);
    $('btnArcadePlay').focus({ preventScroll: true });
  }

  /** After a session: the same progress object was updated by the game. */
  renderProgress(): void {
    if (!this.mod || !this.progress) return;
    const id = this.entry!.id, progress = this.progress;
    const save = () => { void saveProgress(this.d.db, id, progress).catch(e => console.error(e)); };
    $('arcadeProgressBody').replaceChildren(this.mod.progressPanel(progress, save));
  }

  private sizeHero(): void {
    const c = $<HTMLCanvasElement>('arcadeHero');
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
  }

  private animate = (now: number): void => {
    if (!this.visible || this.playing) return;
    const c = $<HTMLCanvasElement>('arcadeHero');
    const ctx = c.getContext('2d');
    if (ctx && this.mod && c.width > 1) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try {
        this.mod.preview(ctx, c.width / dpr, c.height / dpr, (now - this.t0) / 1000, this.progress ?? undefined);
      } catch (e) {
        console.error(e);
        return;
      }
    }
    this.raf = requestAnimationFrame(this.animate);
  };

  render(st: HubStatus): void {
    if (!this.visible || !this.entry) return;
    const tool = st.tool;
    const supported = !tool || this.entry.tools.includes(tool);
    let { text, label, cls, can, note } = readiness(st, 'Na symulatorze skupieniem sterujesz przyciskiem „Symuluj skupienie” w trakcie gry.');
    if (!supported) {
      text = 'Ta gra czyta opaskę Mendi (fNIRS) — przełącz narzędzie u góry.';
      label = 'inna opaska'; cls = 'badge warn'; can = false; note = '';
    }
    const loaded = !!this.mod && !!this.progress;
    const sig = `${text}|${label}|${can}|${note}|${loaded}`;
    if (sig === this.sig) return;
    this.sig = sig;
    $('arcadeReady').textContent = text;
    const badge = $('arcadeBadge');
    badge.textContent = label;
    badge.className = cls;
    $<HTMLButtonElement>('btnArcadePlay').disabled = !can || !loaded;
    $('arcadeHint').textContent = loaded ? note : 'Wczytuję grę…';
  }
}
