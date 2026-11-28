/**
 * The session's music, live: walks a plan (kit/playlist.ts) on the session clock — a short ambient opening, then the
 * tracks one after another with a gentle transition between two, the last faded out under the session's close when
 * it runs past it (DESIGN.md §28; §21.4's bridges of ambient between tracks are gone).
 *
 * Real playback never keeps to a plan exactly (a track buffers, an advert plays first, the player pauses a track by
 * hand), so the director follows what the players report, not the planned times: the next track is made ready on a
 * second player (`cue`) while the one before plays, and starts as that one ends.  Three ways to pass from one track
 * to the next, chosen by what the device and the screen allow:
 *
 *   cross-fade    two players, and room on screen for both cards (`overlap()`): the next starts FADE seconds before
 *                 the end, rises while the one before falls — each player visible, nothing over it (YouTube's terms)
 *   fade-through  two players, one place: the ending track falls to silence over its last seconds while the ambient
 *                 swells softly; the next (already cued) starts in the same place the moment it ends and rises
 *   ambient swell one player whose volume no script can set (iOS): the ambient swells over the last seconds, the next
 *                 track loads into the same player (so the one tap given keeps counting) and the ambient falls under it
 *
 * When a track cannot play — the network is gone, the video is blocked, the browser wants a tap first and the player
 * gives none — the ambient simply carries on: never silence, never an error on screen.  No DOM here: a player is an
 * interface (kit/youtube.ts implements it).
 */
import { CLOSE_FADE, FADE, TAIL_MAX, type MusicPlan, type Slot } from './playlist';

export type PlayerState = 'none' | 'unstarted' | 'cued' | 'buffering' | 'playing' | 'paused' | 'ended';

/** What the director needs from a track player (kit/youtube.ts YouTubePlayer; a fake in tests). */
export interface TrackPlayer {
  /** load a track and start it */
  load(id: string): void;
  /** load a track and keep it ready, not playing (the next one); absent: the player cannot, `load` it at its turn */
  cue?(id: string): void;
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
  /** the player has answered (its handshake is done); absent = always ready (a fake in tests) */
  readonly ready?: boolean;
}

/** The game's ambient music: how loud it is against the tracks (1 = alone, 0 = silent behind a track). */
export interface AmbientBus { mix(level: number, seconds: number): void }

export type MusicPhase = 'ambient' | 'loading' | 'blocked' | 'track' | 'closing' | 'done';

export interface MusicOptions {
  /** the session's planned length (s) */
  total: number;
  /** the tracks' loudness, 0..1 (the app's game volume) */
  volume: number;
  /** a script can set the players' volume (false on iOS: there the ambient bridges each change of track) */
  fades?: boolean;
  /** may two players be on screen at once just now (a second place for a card that covers nothing)? */
  overlap?: () => boolean;
  /** told when the track changes (null: the ambient alone) and when a tap is needed */
  onChange?(now: MusicNow): void;
}

export interface MusicNow {
  phase: MusicPhase;
  /** the track playing or about to play */
  id: string | null;
  /** the player it plays on (0 or 1) */
  deck: number;
  /** the player must be on screen: a track is loading, playing, or waits for a tap */
  show: boolean;
  /** the browser waits for a tap on the player to start the music */
  tap: boolean;
  /** a cross-fade: the next track already plays on the other player, whose card shows in the second place */
  next: { id: string; deck: number } | null;
}

/** How long a track rises at its start (s) when it did not come in under a cross-fade. */
const FADE_IN = 4;
/** The ambient falls under a track (s), and swells back over a track's last seconds or after it (s). */
const AMBIENT_OUT = 5, AMBIENT_IN = 3;
/** The ambient's level while it bridges two tracks (it swells, softly, never to its full level). */
const BRIDGE = 0.75;
/** The next track is made ready this long before the one before ends (s). */
const PREP = 25;
/** Under a cross-fade the next is asked to start this long before its planned moment (it takes a moment to begin). */
const LEAD = 1;
/** After a session pause the player reports "paused" for a moment while it starts again: not a pause by hand. */
const RESUME_SETTLE = 2;
/** Waiting for a track to start (counted from the player's handshake): then it counts as blocked (a tap needed) or failed. */
const START_WAIT = 8, LOAD_GIVE_UP = 25, TAP_WAIT = 40, STALL_GIVE_UP = 45;
/** A track counts as heard (for the rotation) after this much of it, or at its end. */
const HEARD = 30;
/** Under a cross-fade the ambient bridges only if the next has not begun this long before the one before ends (s). */
const LATE = 2;
/** A video ends up to this long before the length its player reports (s): the fade-out reaches silence by then. */
const END_SLACK = 0.8;
/** After a track that could not play, the ambient carries this long before the next is tried (s). */
const SKIP_BRIDGE = 6;

type NextState = 'none' | 'cued' | 'starting' | 'playing';

export class MusicDirector {
  private queue: Slot[];
  private readonly decks: TrackPlayer[];
  private phase: MusicPhase = 'ambient';
  /** the deck the current track plays on */
  private a = 0;
  private cur: Slot | null = null;
  /** the next track, made ready on the other deck */
  private nxt: Slot | null = null;
  private nxtState: NextState = 'none';
  private nxtFrom = 0;
  private nextAt: number;
  private since = 0;
  /** the current track came in under a cross-fade: its rise was the fade's */
  private rise = FADE_IN;
  private lastTime = -1;
  private lastMove = 0;
  private vols: number[] = [-1, -1];
  private volAt: number[] = [-1, -1];
  private closeFrom = 0;
  private closeLen = CLOSE_FADE;
  private handPaused = false;
  private swelled = false;
  private heard = new Set<string>();
  /** each deck has played a track this session (so the browser allows it) */
  private went = [false, false];
  /** what onChange last told: the phase, the track and its deck */
  private told = '';
  private failed = new Set<string>();
  private paused = false;
  private tapAsked = false;
  /** the second deck is not used any more (a tap was needed: the next tracks load into the deck the player tapped) */
  private single: boolean;
  /** the start wait counts from here: the player's handshake, never across a resume */
  private waitFrom = 0;
  private resumed = false;
  private resumeAt = -Infinity;

  constructor(plan: MusicPlan, players: TrackPlayer | readonly TrackPlayer[] | null, private ambient: AmbientBus, private o: MusicOptions) {
    this.decks = players === null ? [] : Array.isArray(players) ? [...players] : [players as TrackPlayer];
    this.single = this.decks.length < 2 || o.fades === false;
    this.queue = this.decks.length ? plan.slots.slice() : [];
    this.nextAt = plan.slots[0]?.at ?? Infinity;
    ambient.mix(1, 2);
  }

  get now(): MusicNow {
    const p = this.phase;
    const next = this.nxt && (this.nxtState === 'starting' || this.nxtState === 'playing') ? { id: this.nxt.id, deck: 1 - this.a } : null;
    return {
      phase: p, id: this.cur?.id ?? null, deck: this.a,
      show: p === 'loading' || p === 'blocked' || p === 'track' || p === 'closing', tap: p === 'blocked', next,
    };
  }

  /** The tracks heard this session (for the rotation: kit/playlist.ts ageRecent). */
  get played(): string[] { return [...this.heard]; }
  /** The tracks that could not play this session. */
  get skipped(): string[] { return [...this.failed]; }

  private get fades(): boolean { return this.o.fades !== false; }
  private get pl(): TrackPlayer { return this.decks[this.a]; }
  private get other(): TrackPlayer | null { return this.single ? null : this.decks[1 - this.a] ?? null; }

  update(t: number): void {
    if (!this.decks.length || this.phase === 'done' || this.paused) return;
    const pl = this.pl;
    if (this.resumed) { this.resumed = false; this.resumeAt = t; }
    const settling = t - this.resumeAt < RESUME_SETTLE;
    const total = this.o.total;
    switch (this.phase) {
      case 'ambient': {
        if (t < this.nextAt) return;
        const slot = this.takeNext(t);
        if (!slot) { this.set('done', null); return; }
        this.cur = slot;
        this.startLoading(t);
        this.rise = FADE_IN;
        this.setVol(this.a, 0, t, true);
        pl.load(slot.id);
        this.set('loading', slot);
        return;
      }
      case 'loading': {
        if (pl.state === 'playing') { this.begin(t); return; }
        if (pl.error !== null) { this.skip(t); return; }
        // a slow network's handshake, or the moment after a resume, is not a browser that wants a tap
        if (pl.ready === false || settling) {
          this.waitFrom = t;
          if (t - this.since > LOAD_GIVE_UP) this.skip(t);
          return;
        }
        if (pl.blocked || (t - this.waitFrom > START_WAIT && (pl.state === 'unstarted' || pl.state === 'cued' || pl.state === 'paused'))) {
          // the second player wants a tap of its own: the first one (already tapped or allowed) takes the tracks on
          if (!this.single && !this.went[this.a] && this.went[1 - this.a]) { this.toSingle(t); return; }
          if (this.tapAsked) { this.skip(t); this.quit(); return; }   // asked once already: the ambient alone, no nagging
          this.tapAsked = true;
          this.since = t;
          this.set('blocked', this.cur);
          return;
        }
        if (t - this.waitFrom > LOAD_GIVE_UP) this.skip(t);   // answered, but only buffers
        return;
      }
      case 'blocked': {
        if (pl.state === 'playing') {
          // a tap started it: the next tracks go into this player, which the browser now allows
          this.dropOther();
          this.begin(t);
          return;
        }
        if (pl.error !== null) { this.skip(t); return; }
        if (t - this.since > TAP_WAIT) { this.skip(t); this.quit(); return; }   // no tap: the ambient alone, asked once
        if (total - t <= TAIL_MAX) { this.skip(t); this.quit(); }                 // too late for a track to be worth it
        return;
      }
      case 'track': {
        const cur = this.cur!;
        if (pl.time >= HEARD) this.heard.add(cur.id);
        const dur = pl.duration > 0 ? pl.duration : cur.sec;
        const left = Math.max(0, dur - pl.time);
        const ended = pl.state === 'ended' || (pl.duration > 0 && pl.time >= pl.duration - 0.25);
        // under a cross-fade the one before may stop a breath before its very end: its sound is already gone
        if (ended || (this.nxtState === 'playing' && left <= 0.3)) { this.heard.add(cur.id); this.afterTrack(t); return; }
        if (pl.error !== null) { this.skip(t); return; }
        // the player paused the track by hand: the ambient comes back softly until it plays again
        const hand = pl.state === 'paused' && !settling;
        if (hand !== this.handPaused) { this.handPaused = hand; this.ambient.mix(hand ? 0.7 : 0, hand ? AMBIENT_IN : AMBIENT_OUT); }
        // a stall (the network) that does not clear: let it go
        if (pl.time !== this.lastTime) { this.lastTime = pl.time; this.lastMove = t; }
        else if (!hand && t - this.lastMove > STALL_GIVE_UP) { this.skip(t); return; }
        // the session closes before the track does: it fades out under the close (never a song into the summary)
        if (t >= total - CLOSE_FADE && left > total - t + 0.5) {
          this.dropNext();
          this.closeFrom = t;
          this.closeLen = Math.max(1, total - t);
          this.set('closing', cur);
          // (where no script sets a player's volume the ambient rises over the whole close, and the track stops under it)
          this.ambient.mix(1, this.fades ? Math.min(4, this.closeLen) : this.closeLen);
          return;
        }
        this.prepare(t, left);
        this.followNext(t, left);
        // the track's own loudness: its rise, and its last seconds falling (to the next track, or to the ambient) —
        // silent at its true end (YouTube rounds a length up: a video ends up to a second before it)
        this.setVol(this.a, Math.min(1, (t - this.since) / this.rise, Math.max(0, left - END_SLACK) / FADE), t);
        // unless the next already rises (a cross-fade), the ambient swells softly over the last seconds and bridges —
        // under a cross-fade only when the next is late to begin
        const swellAt = this.nxtState === 'starting' ? LATE : this.fades ? FADE : AMBIENT_IN;
        if (!this.swelled && this.nxtState !== 'playing' && left <= swellAt) {
          this.swelled = true;
          this.ambient.mix(this.queue.length || this.nxt ? BRIDGE : 1, AMBIENT_IN);
        }
        return;
      }
      case 'closing': {
        const k = 1 - (t - this.closeFrom) / this.closeLen;
        if (k <= 0 || pl.state === 'ended') { pl.pause(); this.set('done', null); return; }
        this.setVol(this.a, Math.min(k, this.vols[this.a] / 100 / Math.max(0.01, this.o.volume)), t);
        return;
      }
      default:
    }
  }

  /** The session paused (or resumed): the tracks pause with it; the runner suspends the ambient itself. */
  pause(on: boolean): void {
    if (this.paused === on) return;
    this.paused = on;
    if (!on) this.resumed = true;
    if (!this.decks.length) return;
    if (this.phase === 'track' || this.phase === 'loading' || this.phase === 'closing') {
      if (on) this.pl.pause(); else if (!this.handPaused) this.pl.play();
    }
    const o = this.other;
    if (o && (this.nxtState === 'starting' || this.nxtState === 'playing')) { if (on) o.pause(); else o.play(); }
  }

  /** The session ends now (time is up, "Zakończ i zapisz"): stop the tracks; the ambient fades with the runner. */
  finish(): void {
    if (this.decks.length && this.phase !== 'done' && this.phase !== 'ambient') { this.pl.setVolume(0); this.pl.pause(); }
    this.dropNext();
    this.queue = [];
    this.set('done', null);
  }

  /** May the session stop?  Not while a track's last seconds fade under the close (at most CLOSE_FADE). */
  canStop(): boolean { return this.phase !== 'closing'; }

  /** The next slot worth beginning now: one that can still play more than TAIL_MAX before the end. */
  private takeNext(t: number): Slot | null {
    if (!this.queue.length || this.o.total - t <= TAIL_MAX) { this.queue = []; return null; }
    return this.queue.shift() ?? null;
  }

  /** The next track made ready on the other deck, at volume 0, PREP seconds before this one ends. */
  private prepare(t: number, left: number): void {
    const o = this.other;
    if (!o || this.nxt || !this.queue.length || left > PREP) return;
    // the next would begin about now + left − FADE: only if it is still worth beginning then
    const slot = this.takeNext(t + Math.max(0, left - FADE));
    if (!slot) return;
    this.nxt = slot;
    this.nxtState = 'cued';
    const b = 1 - this.a;
    this.vols[b] = -1;
    this.setVol(b, 0, t, true);
    if (o.cue) o.cue(slot.id);
    else { o.load(slot.id); o.pause(); }
  }

  /** Under a cross-fade: start the next on time, and let it rise while this one falls. */
  private followNext(t: number, left: number): void {
    const o = this.other;
    if (!o || !this.nxt) return;
    const b = 1 - this.a;
    if (this.nxtState === 'cued' && left <= FADE + LEAD && this.fades && (this.o.overlap?.() ?? false)) {
      this.nxtState = 'starting';
      this.setVol(b, 0, t, true);
      o.play();
      this.o.onChange?.(this.now);
      return;
    }
    if (this.nxtState === 'starting') {
      if (o.error !== null) { this.dropNext(); return; }
      if (o.state === 'playing' && o.time > 0) {
        this.nxtState = 'playing';
        this.nxtFrom = t;
        this.ambient.mix(0, AMBIENT_IN);
      }
      return;
    }
    if (this.nxtState === 'playing') this.setVol(b, Math.min(1, (t - this.nxtFrom) / FADE), t);
  }

  private startLoading(t: number): void {
    this.since = t;
    this.waitFrom = t;
  }

  private begin(t: number): void {
    this.since = t;
    this.lastTime = -1;
    this.lastMove = t;
    this.handPaused = false;
    this.swelled = false;
    this.went[this.a] = true;
    this.ambient.mix(0, AMBIENT_OUT);
    this.set('track', this.cur);
  }

  /** A track ended: the next goes on at once — already rising (cross-fade), cued in the other deck, or loaded here. */
  private afterTrack(t: number): void {
    const done = this.a;
    const nx = this.nxt, st = this.nxtState;
    this.nxt = null;
    this.nxtState = 'none';
    if (nx && st !== 'none' && !this.single) {
      this.decks[done].pause();
      this.setVol(done, 0, t, true);
      this.a = 1 - done;
      this.cur = nx;
      if (st === 'playing') {
        // it came in under the cross-fade: it plays on, its rise continues where the fade left it
        this.went[this.a] = true;
        this.since = this.nxtFrom;
        this.rise = FADE;
        this.lastTime = -1;
        this.lastMove = t;
        this.handPaused = false;
        this.swelled = false;
        this.set('track', nx);
        return;
      }
      // the next was not rising yet: the ambient bridges until it plays
      if (!this.swelled) { this.swelled = true; this.ambient.mix(BRIDGE, AMBIENT_IN); }
      this.startLoading(t);
      this.rise = FADE_IN;
      if (st === 'cued') this.pl.play();
      this.set('loading', nx);
      return;
    }
    // one deck: the next loads into the same player (the ambient already swells over the change)
    const slot = this.takeNext(t);
    if (!slot) {
      this.ambient.mix(1, AMBIENT_IN);
      this.cur = null;
      this.set('done', null);
      return;
    }
    this.cur = slot;
    this.startLoading(t);
    this.rise = FADE_IN;
    this.setVol(this.a, 0, t, true);
    this.pl.load(slot.id);
    this.set('loading', slot);
  }

  private skip(t: number): void {
    if (this.cur) this.failed.add(this.cur.id);
    this.pl.setVolume(0);
    this.pl.pause();
    // a next already made ready on the other deck takes the turn at once
    if (this.nxt && !this.single) {
      if (this.nxtState !== 'playing' && !this.swelled) { this.swelled = true; this.ambient.mix(BRIDGE, AMBIENT_IN); }
      this.afterTrack(t);
      return;
    }
    // else the ambient carries a moment before the next is tried
    this.ambient.mix(1, AMBIENT_IN);
    this.cur = null;
    this.nextAt = t + SKIP_BRIDGE;
    this.set(this.queue.length ? 'ambient' : 'done', null);
  }

  /** The second deck wants a tap of its own: from now on one deck, the one the browser already allows. */
  private toSingle(t: number): void {
    const id = this.cur?.id;
    this.pl.pause();
    this.single = true;
    this.a = 1 - this.a;
    if (!id) { this.skip(t); return; }
    this.startLoading(t);
    this.setVol(this.a, 0, t, true);
    this.pl.load(id);
    this.set('loading', this.cur);
  }

  /** After a tap on the first deck the second one is not used (it would ask for a tap of its own). */
  private dropOther(): void {
    this.dropNext();
    this.single = true;
  }

  /** The next track made ready is let go (the close comes first, or it failed): it goes back to the queue's head. */
  private dropNext(): void {
    const o = this.decks[1 - this.a];
    if (this.nxt && o && this.decks.length > 1) {
      if (this.nxtState === 'starting' || this.nxtState === 'playing') { o.setVolume(0); o.pause(); }
      if (this.phase !== 'closing' && this.nxtState !== 'playing') this.queue.unshift(this.nxt);
    }
    this.nxt = null;
    this.nxtState = 'none';
  }

  /** No more tracks this session (the browser wants a tap the player did not give). */
  private quit(): void {
    this.dropNext();
    this.queue = [];
    this.set('done', null);
  }

  private setVol(deck: number, k: number, t: number, force = false): void {
    const p = this.decks[deck];
    if (!p) return;
    const v = Math.round(Math.max(0, Math.min(1, k)) * Math.max(0, Math.min(1, this.o.volume)) * 100);
    if (!force && (v === this.vols[deck] || t - this.volAt[deck] < 0.12)) return;
    this.vols[deck] = v;
    this.volAt[deck] = t;
    p.setVolume(v);
  }

  private set(phase: MusicPhase, slot: Slot | null): void {
    this.phase = phase;
    if (phase === 'done' || phase === 'ambient') this.cur = slot;
    const told = `${phase}|${this.cur?.id ?? ''}|${this.a}`;
    if (told !== this.told || phase === 'loading' || phase === 'blocked') { this.told = told; this.o.onChange?.(this.now); }
  }
}
