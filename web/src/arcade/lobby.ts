/**
 * A game's lobby (#gra/<id>, DESIGN.md §9): the game's animated picture, how the band plays it,
 * the passage the game takes root in, the player's progress (records, collection), the session
 * length and sound, and the readiness of the signal with the one button that starts.
 */
import type { HubStatus } from '../hub';
import { BAND_NAME, t } from '../i18n/arcade';
import { t as tr } from '../i18n/rhythm';
import { SESSION_MINUTES, plannedSeconds, type AppSettings, type ArcadePrefs } from '../settings';
import type { SessionDB } from '../storage/db';
import { $, h, run } from '../ui/dom';
import { readiness } from '../ui/focus';
import { coarsePointer } from './kit/mobile';
import { loadProgress, saveProgress } from './kit/progress';
import { REST_SETTLE, restKept, restsIn, rhythmOf, stepDial, type RhythmDial, type RhythmSpec } from './kit/rhythm';
import type { ArcadeModule } from './kit/types';
import { arcadeEntry, forHands, type ArcadeEntry } from './registry';
import { verseSlot } from './verse';

const LENGTHS = SESSION_MINUTES;

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
      class: 'btn', type: 'button', role: 'radio', 'aria-checked': String(p.minutes === m), 'aria-label': t('lobby.minutes', { n: m }),
      on: { click: () => this.set({ minutes: m }) },
    }, h('b', null, String(m)), h('small', null, 'min'))));
    const bind = (id: string, key: 'sound' | 'haptics') => {
      const el = $<HTMLInputElement>(id);
      el.checked = p[key];
      el.addEventListener('change', () => this.set({ [key]: el.checked }));
    };
    bind('arcadeSound', 'sound');
    bind('arcadeHaptics', 'haptics');
    $('btnArcadePlay').addEventListener('click', run(() => {
      if (!this.entry || !this.mod || !this.progress) throw new Error(t('lobby.notReady'));
      this.d.onPlay(this.entry, this.mod, this.progress);
    }));
    window.addEventListener('resize', () => { if (this.visible) this.sizeHero(); });
  }

  private set(patch: Partial<ArcadePrefs>): void {
    Object.assign(this.d.settings.arcade, patch);
    void this.d.save();
    const m = this.d.settings.arcade.minutes;
    $('arcadeLen').querySelectorAll<HTMLButtonElement>('button').forEach((b, i) => b.setAttribute('aria-checked', String(LENGTHS[i] === m)));
    // the rhythm's count ("about 6 rests a session") follows the length
    if ('minutes' in patch) this.renderRhythm();
  }

  /**
   * The rest's rhythm (kit/rhythm.ts, DESIGN §19.2): the game's two dials in its own words with − and +, how many
   * rests that makes in a session of the chosen length, a reset to the game's design, and why rests exist at all.
   * Hidden for a game without dials.
   */
  private renderRhythm(): void {
    const box = $('arcadeRhythm');
    const id = this.entry?.id;
    let spec: RhythmSpec | undefined;
    try {
      spec = this.mod?.rhythm?.(this.progress ?? undefined);
    } catch (e) {
      console.error(e);
    }
    if (!id || !spec) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    const s = spec;
    const prefs = this.d.settings.arcade;
    const r = rhythmOf(s, prefs.rhythm?.[id])!;
    const save = (focus: number, rest: number) => {
      const all = { ...(prefs.rhythm ?? {}) };
      if (focus === s.focus.def && rest === s.rest.def) delete all[id];
      else all[id] = { focus, rest };
      prefs.rhythm = all;
      void this.d.save();
      this.renderRhythm();
      // keep the keyboard where it was: the same button after the redraw
      box.querySelector<HTMLButtonElement>(`[data-dial="${this.lastDial}"]`)?.focus({ preventScroll: true });
    };
    const dial = (key: 'focus' | 'rest', d: RhythmDial, v: number) => {
      const out = h('output', { class: 'rh-val mono', 'aria-live': 'polite' }, d.format(v));
      const btn = (dir: -1 | 1) => {
        const next = stepDial(d, v, dir);
        return h('button', {
          class: 'btn rh-step', type: 'button', 'data-dial': `${key}${dir}`, disabled: next === v,
          'aria-label': tr(dir < 0 ? 'rhythm.minus' : 'rhythm.plus', { name: d.name }),
          on: { click: () => { this.lastDial = `${key}${dir}`; save(key === 'focus' ? next : r.focus, key === 'rest' ? next : r.rest); } },
        }, dir < 0 ? '−' : '+');
      };
      return h('div', { class: 'rh-dial', role: 'group', 'aria-label': d.name }, h('span', { class: 'rh-name' }, d.name), btn(-1), out, btn(1));
    };
    const count = restsIn(s, r, plannedSeconds(prefs.minutes));
    // the player's rest longer than the session's way leaves room for: what the session keeps
    const kept = restKept(s, r, plannedSeconds(prefs.minutes));
    const line = [s.note, count ? tr('rhythm.count', { n: count.rests }) : '', count ? tr('rhythm.share', { pct: Math.round(count.share * 100) }) : '']
      .filter(Boolean).join(' · ');
    const restSec = s.restSec?.(r.rest);
    const why = h('details', { class: 'rh-why' },
      h('summary', null, tr('rhythm.why')),
      h('p', null, tr('rhythm.why1')), h('p', null, tr('rhythm.why2')),
      h('a', { href: '#wiedza/neurofeedback' }, tr('rhythm.whyLink')));
    const kids: (HTMLElement | null)[] = [
      h('div', { class: 'rh-head' },
        h('span', null, tr('rhythm.title')),
        h('small', { class: r.custom ? 'rh-tag custom' : 'rh-tag' }, tr(r.custom ? 'rhythm.custom' : 'rhythm.default')),
        r.custom ? h('button', { class: 'btn ghost rh-reset', type: 'button', on: { click: () => { this.lastDial = ''; save(s.focus.def, s.rest.def); } } }, tr('rhythm.reset')) : null),
      dial('focus', s.focus, r.focus), dial('rest', s.rest, r.rest),
      line ? h('p', { class: 'muted rh-line' }, line) : null,
      kept !== null ? h('p', { class: 'rh-warn rh-kept' }, tr('rhythm.kept', { rest: s.rest.format(kept), minutes: prefs.minutes })) : null,
      restSec !== undefined && restSec < REST_SETTLE ? h('p', { class: 'rh-warn' }, tr('rhythm.short')) : null,
      why];
    box.replaceChildren(...kids.filter((n): n is HTMLElement => n !== null));
    box.hidden = false;
  }

  private lastDial = '';

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
      $('arcadeRhythm').hidden = true;
      $('arcadeTitle').textContent = entry.title;
      $('arcadeTagline').textContent = entry.tagline;
      const [a, b] = entry.tools.map(tool => BAND_NAME[tool]);
      $('arcadeKicker').textContent = b ? t('lobby.kicker2', { a, b }) : t('lobby.kicker', { band: a });
      // a finger's lines on a touch screen, their mouse-and-keyboard twins at a desktop
      $('arcadeHow').replaceChildren(...forHands(entry, coarsePointer()).how.map(line => h('li', null, line)));
      $('arcadeRoot').replaceChildren(verseSlot(entry.root));
      $('arcadeProgressBody').replaceChildren(h('p', { class: 'muted' }, t('lobby.loading')));
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
    this.renderRhythm();
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
    const save = () => {
      void saveProgress(this.d.db, id, progress).catch(e => console.error(e));
      // a choice in the card may change the rhythm's dials (a breath pattern sets how long a breath is)
      this.renderRhythm();
    };
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
        // a rAF timestamp can fall a hair before t0 on the first frame: a preview never sees negative time
        this.mod.preview(ctx, c.width / dpr, c.height / dpr, Math.max(0, now - this.t0) / 1000, this.progress ?? undefined);
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
    let { text, label, cls, can, note } = readiness(st, t('lobby.simNote', { button: t('run.simulate') }));
    if (!supported) {
      // the band this game reads (all three read both today; a one-band game names its band)
      text = t('lobby.otherBand', { band: BAND_NAME[this.entry.tools[0]] });
      label = t('lobby.otherBandBadge'); cls = 'badge warn'; can = false; note = '';
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
    $('arcadeHint').textContent = loaded ? note : t('lobby.loadingGame');
  }
}
