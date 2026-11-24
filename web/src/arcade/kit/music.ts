/**
 * The session's music, live: walks a plan (kit/playlist.ts) on the session clock — the ambient music
 * first, then each track in its turn with a bridge of ambient between two, then the ambient to the end.
 *
 * Real playback never keeps to a plan exactly (a track buffers, an advert plays first, the player
 * pauses a track by hand), so the director follows what the player reports, not the planned times:
 * a track starts when the one before has ended and its bridge is over, and only if it can still end
 * before the close.  When a track cannot play — the network is gone, the video is blocked, the
 * browser wants a tap first and the player gives none — the ambient simply carries on: never silence,
 * never an error on screen.  No DOM here: the player is an interface (kit/youtube.ts implements it).
 */
import type { MusicPlan, Slot } from './playlist';

export type PlayerState = 'none' | 'unstarted' | 'cued' | 'buffering' | 'playing' | 'paused' | 'ended';

/** What the director needs from a track player (kit/youtube.ts YouTubePlayer; a fake in tests). */
export interface TrackPlayer {
  /** load a track and start it */
  load(id: string): void;
  play(): void;
  pause(): void;
  /** 0..100 */
  setVolume(v: number): void;
  readonly state: PlayerState;
  /** seconds into the current track, and its length (0 while unknown) */
  readonly time: number;
  readonly duration: number;
  /** the player's error code for the current track (YouTube: 2, 5, 100, 101, 150, 153), or null */
  readonly error: number | null;
  /** the browser refused to start the track without a tap on the player itself */
  readonly blocked: boolean;
}

/** The game's ambient music: how loud it is against the tracks (1 = alone, 0 = silent behind a track). */
export interface AmbientBus { mix(level: number, seconds: number): void }

export type MusicPhase = 'ambient' | 'loading' | 'blocked' | 'track' | 'closing' | 'done';

export interface MusicOptions {
  /** the session's planned length (s) */
  total: number;
  /** the tracks' loudness, 0..1 (the app's game volume) */
  volume: number;
  /** told when the track changes (null: the ambient alone) and when a tap is needed */
  onChange?(now: MusicNow): void;
}

export interface MusicNow {
  phase: MusicPhase;
  /** the track playing or about to play */
  id: string | null;
  /** the player must be on screen: a track is loading, playing, or waits for a tap */
  show: boolean;
  /** the browser waits for a tap on the player to start the music */
  tap: boolean;
}

/** Whatever the plan said, a track ends at least this long before the session does (s). */
export const CLOSE_MIN = 20;
/** How long the tracks fade in (s), and the ambient fades out under them / back in after them. */
const FADE_IN = 3, AMBIENT_OUT = 5, AMBIENT_IN = 4;
/** Waiting for a track to start: then it counts as blocked (a tap needed) or failed. */
const START_WAIT = 8, LOAD_GIVE_UP = 25, TAP_WAIT = 40, STALL_GIVE_UP = 45;
/** A track counts as heard (for the rotation) after this much of it, or at its end. */
const HEARD = 30;

export class MusicDirector {
  private queue: Slot[];
  private phase: MusicPhase = 'ambient';
  private cur: Slot | null = null;
  private nextAt: number;
  private since = 0;
  private lastTime = -1;
  private lastMove = 0;
  private vol = -1;
  private volAt = -1;
  private closeFrom = 0;
  private handPaused = false;
  private heard = new Set<string>();
  private failed = new Set<string>();
  private paused = false;
  private tapAsked = false;

  constructor(private plan: MusicPlan, private player: TrackPlayer | null, private ambient: AmbientBus, private o: MusicOptions) {
    this.queue = player ? plan.slots.slice() : [];
    this.nextAt = plan.slots[0]?.at ?? Infinity;
    ambient.mix(1, 2);
  }

  get now(): MusicNow {
    const p = this.phase;
    return { phase: p, id: this.cur?.id ?? null, show: p === 'loading' || p === 'blocked' || p === 'track' || p === 'closing', tap: p === 'blocked' };
  }

  /** The tracks heard this session (for the rotation: kit/playlist.ts ageRecent). */
  get played(): string[] { return [...this.heard]; }
  /** The tracks that could not play this session. */
  get skipped(): string[] { return [...this.failed]; }

  update(t: number): void {
    const pl = this.player;
    if (!pl || this.phase === 'done' || this.paused) return;
    const total = this.o.total;
    switch (this.phase) {
      case 'ambient': {
        if (t < this.nextAt || !this.queue.length) return;
        const i = this.queue.findIndex(s => t + s.sec <= total - CLOSE_MIN);
        if (i < 0) { this.queue = []; this.set('done', null); return; }
        const [slot] = this.queue.splice(0, i + 1).slice(-1);
        this.cur = slot;
        this.since = t;
        this.vol = -1;
        this.setVolume(0, t, true);
        pl.load(slot.id);
        this.set('loading', slot);
        return;
      }
      case 'loading': {
        if (pl.state === 'playing') { this.begin(t); return; }
        if (pl.error !== null) { this.skip(t); return; }
        if (pl.blocked || (t - this.since > START_WAIT && (pl.state === 'unstarted' || pl.state === 'cued' || pl.state === 'paused'))) {
          if (this.tapAsked) { this.skip(t); this.quit(); return; }   // asked once already: the ambient alone, no nagging
          this.tapAsked = true;
          this.since = t;
          this.set('blocked', this.cur);
          return;
        }
        if (t - this.since > LOAD_GIVE_UP) this.skip(t);
        return;
      }
      case 'blocked': {
        if (pl.state === 'playing') { this.begin(t); return; }
        if (pl.error !== null) { this.skip(t); return; }
        if (t - this.since > TAP_WAIT) { this.skip(t); this.quit(); return; }   // no tap: the ambient alone, asked once
        if (t + (this.cur?.sec ?? 0) > total - CLOSE_MIN) this.skip(t);         // too late for this one to end in time
        return;
      }
      case 'track': {
        const cur = this.cur!;
        if (pl.time >= HEARD) this.heard.add(cur.id);
        const ended = pl.state === 'ended' || (pl.duration > 0 && pl.time >= pl.duration - 0.25);
        if (ended) { this.heard.add(cur.id); this.afterTrack(t); return; }
        if (pl.error !== null) { this.skip(t); return; }
        // the player paused the track by hand: the ambient comes back softly until it plays again
        const hand = pl.state === 'paused';
        if (hand !== this.handPaused) { this.handPaused = hand; this.ambient.mix(hand ? 0.7 : 0, hand ? AMBIENT_IN : AMBIENT_OUT); }
        // a stall (the network) that does not clear: let it go
        if (pl.time !== this.lastTime) { this.lastTime = pl.time; this.lastMove = t; }
        else if (!hand && t - this.lastMove > STALL_GIVE_UP) { this.skip(t); return; }
        // the session closes: never a song running into the summary — fade it out
        if (t >= total - 6) { this.closeFrom = t; this.set('closing', cur); this.ambient.mix(1, AMBIENT_IN); return; }
        this.setVolume(Math.min(1, (t - this.since) / FADE_IN), t);
        return;
      }
      case 'closing': {
        const k = 1 - (t - this.closeFrom) / 5;
        if (k <= 0) { pl.pause(); this.set('done', null); return; }
        this.setVolume(k, t);
        return;
      }
      default:
    }
  }

  /** The session paused (or resumed): the track pauses with it; the runner suspends the ambient itself. */
  pause(on: boolean): void {
    if (this.paused === on) return;
    this.paused = on;
    const pl = this.player;
    if (!pl) return;
    if (this.phase === 'track' || this.phase === 'loading' || this.phase === 'closing') {
      if (on) pl.pause(); else if (!this.handPaused) pl.play();
    }
  }

  /** The session ends now (time is up, "Zakończ i zapisz"): stop the track; the ambient fades with the runner. */
  finish(): void {
    if (this.player && this.phase !== 'done' && this.phase !== 'ambient') { this.player.setVolume(0); this.player.pause(); }
    this.queue = [];
    this.set('done', null);
  }

  /** May the session stop?  Not while a track's last seconds fade (at most a few seconds). */
  canStop(): boolean { return this.phase !== 'closing'; }

  private begin(t: number): void {
    this.since = t;
    this.lastTime = -1;
    this.lastMove = t;
    this.handPaused = false;
    this.ambient.mix(0, AMBIENT_OUT);
    this.set('track', this.cur);
  }

  private afterTrack(t: number): void {
    this.ambient.mix(1, AMBIENT_IN);
    this.nextAt = t + this.plan.gap;
    this.cur = null;
    this.set(this.queue.length ? 'ambient' : 'done', null);
  }

  private skip(t: number): void {
    if (this.cur) this.failed.add(this.cur.id);
    this.player?.setVolume(0);
    this.player?.pause();
    this.ambient.mix(1, AMBIENT_IN);
    this.nextAt = t + Math.min(8, this.plan.gap);
    this.cur = null;
    this.set(this.queue.length ? 'ambient' : 'done', null);
  }

  /** No more tracks this session (the browser wants a tap the player did not give). */
  private quit(): void {
    this.queue = [];
    this.set('done', null);
  }

  private setVolume(k: number, t: number, force = false): void {
    const v = Math.round(Math.max(0, Math.min(1, k)) * Math.max(0, Math.min(1, this.o.volume)) * 100);
    if (!force && (v === this.vol || t - this.volAt < 0.12)) return;
    this.vol = v;
    this.volAt = t;
    this.player?.setVolume(v);
  }

  private set(phase: MusicPhase, slot: Slot | null): void {
    const changed = phase !== this.phase || (slot?.id ?? null) !== (this.cur?.id ?? null);
    this.phase = phase;
    if (phase === 'done' || phase === 'ambient') this.cur = slot;
    if (changed || phase === 'loading' || phase === 'blocked') this.o.onChange?.(this.now);
  }
}
