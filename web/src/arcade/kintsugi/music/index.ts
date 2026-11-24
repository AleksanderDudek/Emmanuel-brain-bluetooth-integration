/**
 * Złote serce's music (DESIGN.md §21) — the contract between the meditation (../index.ts, ../sim.ts,
 * ../panel.ts) and its music.
 *
 *   prefs        what the player chose in the lobby: tracks + ambient / ambient only / silence, the one-time
 *                YouTube consent, the tracks switched off, own YouTube tracks, the rotation's memory (prefs.ts)
 *   musicPanel   the lobby's "Muzyka" section (DOM, panel.ts)
 *   SessionMusic the session's sound: the ambient heart music (ambient.ts on score.ts, Web Audio through
 *                env.audio.out), the YouTube tracks (kit/youtube.ts + kit/music.ts on a kit/playlist.ts plan) and their
 *                on-screen player card (card.ts)
 *
 * The tracks play only when the player chose them, agreed to YouTube once, the device is online and the app's sound
 * is on — and when at least one fits the session whole.  Otherwise the ambient plays alone (or, in "silence", only
 * the meditation's small cues).  Nothing the player typed and no track id goes into the session's result except the
 * rotation's memory, which stays in the progress on this device.
 */
import { mulberry32 } from '../../../core/random';
import { MusicDirector, type AmbientBus, type MusicNow, type TrackPlayer } from '../../kit/music';
import { ageRecent, planMusic, type MusicPlan, type Recent } from '../../kit/playlist';
import { YouTubePlayer } from '../../kit/youtube';
import type { GameEnv } from '../../kit/types';
import { HeartAmbient } from './ambient';
import { PlayerCard } from './card';
import { t } from './i18n';
import { activeTracks, cleanMusic, type MusicMode, type MusicPrefs, type OwnTrack } from './prefs';
import { builtin } from './tracks';
import type { MusicCue, MusicMood, Rect } from './types';

export { cleanMusic, freshMusic, type MusicMode, type MusicPrefs, type OwnTrack } from './prefs';
export { musicPanel } from './panel';
export type { MusicCue, MusicMood, MusicStage, Rect } from './types';

/** A track player the session can own (kit/youtube.ts YouTubePlayer; a fake in tests). */
export interface SessionPlayer extends TrackPlayer { destroy(): void }
export type PlayerFactory = (host: HTMLElement, title: string) => SessionPlayer;

export interface MusicDeps {
  /** the track player (default: a YouTube embed in the card) */
  player?: PlayerFactory;
  /** is the device online (default: navigator.onLine) */
  online?: () => boolean;
}

const NO_BUS: AmbientBus = { mix: () => undefined };
const DONE: MusicNow = { phase: 'done', id: null, show: false, tap: false };

const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

export class SessionMusic {
  /** the plan of the tracks this session (null: the ambient alone) */
  readonly plan: MusicPlan | null;
  private readonly base: Recent;
  private readonly mode: MusicMode;
  private readonly own: readonly OwnTrack[];
  private readonly rng: () => number;
  private ambient: HeartAmbient | null = null;
  private director: MusicDirector | null = null;
  private player: SessionPlayer | null = null;
  private card: PlayerCard | null = null;
  private rect: Rect | null = null;
  private started = false;
  private ended = false;
  private heard: string[] = [];

  constructor(private env: GameEnv<object>, prefs: MusicPrefs, private deps: MusicDeps = {}) {
    const p = cleanMusic(prefs);
    this.base = { ...p.recent };
    this.mode = p.mode;
    this.own = p.own;
    // one draw from the session's randomness seeds the music's own (the meditation's sequence barely moves)
    this.rng = mulberry32((Math.floor((env.rng?.() ?? Math.random()) * 0x100000000) ^ 0x6d2b79f5) >>> 0);
    const level = env.audio?.level ?? 0;
    const online = (deps.online ?? isOnline)();
    const tracks = activeTracks(p);
    let plan: MusicPlan | null = null;
    if (p.mode === 'tracks' && p.youtube && online && level > 0 && tracks.length && env.hud) {
      const total = Math.max(0, env.plannedSec || 0);
      plan = planMusic({ total, tracks, rng: this.rng, recent: this.base });
      if (!plan.slots.length) plan = null;
    }
    this.plan = plan;
  }

  /** play begins (after the countdown): the ambient rises; the first track waits for its turn in the plan */
  start(): void {
    if (this.started || this.ended) return;
    this.started = true;
    const env = this.env;
    // in "silence" the ambient plays no music, only the meditation's small cues
    this.ambient = HeartAmbient.create(env.audio, { music: this.mode !== 'silence', rng: this.rng });
    this.ambient?.start();
    if (!this.plan) return;
    try {
      this.card = new PlayerCard({ hud: env.hud, insets: () => env.insets(), touch: !!env.touch }, () => this.ambientOnly());
      this.card.place(this.rect);
      const make = this.deps.player ?? ((host: HTMLElement, title: string) => new YouTubePlayer(host, title));
      this.player = make(this.card.frame, t('player.frame'));
      this.director = new MusicDirector(this.plan, this.player, this.ambient ?? NO_BUS, {
        total: env.plannedSec,
        volume: env.audio?.level ?? 0,
        onChange: now => this.card?.show(now, this.titleOf(now.id)),
      });
    } catch (e) {
      // never an error on screen: without a player the ambient carries the session
      console.error(e);
      this.dropTracks();
    }
  }

  update(t: number, dt: number, mood: MusicMood): void {
    if (!this.started || this.ended) return;
    this.ambient?.update(dt, mood);
    const d = this.director;
    if (!d) return;
    d.update(t);
    this.card?.show(d.now, this.titleOf(d.now.id));
    this.heard = d.played;
  }

  cue(c: MusicCue): void { this.ambient?.cue(c); }

  /** where the player card goes while a track plays (canvas CSS px; at least 200 × 200 + its title line), from the layout */
  place(r: Rect | null): void {
    this.rect = r ? { ...r } : null;
    this.card?.place(this.rect);
  }

  pause(on: boolean): void { this.director?.pause(on); }

  canStop(): boolean { return this.director ? this.director.canStop() : true; }

  /** the session ends now: the track stops (the ambient fades with the runner) */
  finish(): void {
    if (this.director) {
      this.heard = this.director.played;
      this.director.finish();
      this.card?.show(this.director.now, '');
    }
  }

  destroy(): void {
    this.finish();
    this.ended = true;
    this.dropTracks();
    this.ambient?.stop();
    this.ambient = null;
  }

  get now(): MusicNow { return this.director?.now ?? DONE; }

  /** tracks heard this session */
  get played(): string[] { return [...(this.director?.played ?? this.heard)]; }

  /** the rotation's memory after this session (idempotent: the same value however often it is read) */
  recentAfter(): Recent { return ageRecent(this.base, this.played); }

  /** The summary's line about the music: ["Muzyka", "3 utwory i muzyka tła" | "muzyka tła" | "cisza"]. */
  stat(): [string, string] {
    const n = this.played.length;
    if (n) return [t('head'), t('stat.withAmbient', { tracks: t('stat.tracks', { n }) })];
    return [t('head'), t(this.mode === 'silence' ? 'stat.silence' : 'stat.ambient')];
  }

  /** "Tylko muzyka tła" on the card: no more tracks this session. */
  private ambientOnly(): void {
    if (this.director) this.heard = this.director.played;
    this.director?.finish();
    this.ambient?.mix(1, 3);
    this.dropTracks();
  }

  private dropTracks(): void {
    if (this.director) this.heard = this.director.played;
    this.director = null;
    try { this.player?.destroy(); } catch { /* gone */ }
    this.player = null;
    this.card?.remove();
    this.card = null;
  }

  private titleOf(id: string | null): string {
    if (!id) return '';
    const b = builtin(id);
    if (b) return `${b.titleKey ? t(b.titleKey) : b.title} — ${b.by}`;
    return this.own.find(o => o.id === id)?.title ?? '';
  }
}
