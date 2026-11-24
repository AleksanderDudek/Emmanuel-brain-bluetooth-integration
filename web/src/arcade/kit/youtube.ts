/**
 * A YouTube player for the session's music (kit/music.ts TrackPlayer), with no Google script in the
 * app: one privacy-enhanced embed (youtube-nocookie.com) in an iframe, driven over postMessage — the
 * same messages the official IFrame API script sends, without loading that script into our origin
 * (the CSP keeps `script-src 'self'`; only `frame-src` names the embed's origin).
 *
 * YouTube's terms for embeds (DESIGN.md §21.5): the player stays visible while it plays (at least
 * 200 × 200 CSS px, nothing over it), the sound is never separated from the picture, the player's own
 * controls stay.  One iframe serves the whole session: the next track loads into it, which also keeps
 * a browser's "tap to play" (iOS) satisfied after the first tap.
 */
import type { PlayerState, TrackPlayer } from './music';

export const YT_ORIGIN = 'https://www.youtube-nocookie.com';

/** An 11-character YouTube video id. */
export const isVideoId = (s: string): boolean => /^[A-Za-z0-9_-]{11}$/.test(s);

/**
 * The video id in a YouTube link: watch?v=…, youtu.be/…, /embed/…, /shorts/…, /live/…, music.youtube.com,
 * m.youtube.com, with or without extra parameters (?si=…, &t=…); a bare id too.  Null when it is not one.
 */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (isVideoId(s)) return s;
  let u: URL;
  try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'watch') id = u.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v', 'e'].includes(parts[0] ?? '')) id = parts[1] ?? null;
  }
  return id && isVideoId(id) ? id : null;
}

/** The link that opens a video on YouTube itself (the lobby's "listen" link). */
export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

const STATES: Record<number, PlayerState> = { [-1]: 'unstarted', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' };

interface Incoming { event?: string; info?: unknown }

/**
 * The player.  `host` is the element it lives in (the game's card); `title` the iframe's accessible
 * name.  Messages are taken only from this iframe's window and the embed's origin.
 */
export class YouTubePlayer implements TrackPlayer {
  readonly frame: HTMLIFrameElement;
  state: PlayerState = 'none';
  time = 0;
  duration = 0;
  error: number | null = null;
  blocked = false;
  /** the player answered the handshake */
  ready = false;
  private queued: [string, unknown[]][] = [];
  private listenTimer: ReturnType<typeof setInterval> | null = null;
  private id: string | null = null;
  private onMessage = (e: MessageEvent) => this.receive(e);

  constructor(host: HTMLElement, title: string, private origin = location.origin) {
    const f = document.createElement('iframe');
    f.title = title;
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.referrerPolicy = 'strict-origin-when-cross-origin';   // the embed refuses to play without its page's origin (error 153)
    f.setAttribute('allowfullscreen', '');
    f.className = 'yt-frame';
    this.frame = f;
    host.appendChild(f);
    window.addEventListener('message', this.onMessage);
  }

  load(id: string): void {
    this.error = null;
    this.blocked = false;
    this.time = 0;
    this.duration = 0;
    this.id = id;
    if (!this.frame.src) {
      const q = new URLSearchParams({
        enablejsapi: '1', origin: this.origin, autoplay: '0', playsinline: '1', rel: '0', iv_load_policy: '3', fs: '0', widgetid: '1',
      });
      this.state = 'unstarted';
      this.frame.addEventListener('load', () => this.listen(), { once: true });
      this.frame.src = `${YT_ORIGIN}/embed/${encodeURIComponent(id)}?${q}`;
      // started by command once the player answers, after the volume the director set (no blare at full volume)
      this.command('playVideo');
      return;
    }
    this.state = 'unstarted';
    this.command('loadVideoById', [id, 0]);
  }

  play(): void { this.command('playVideo'); }
  pause(): void { this.command('pauseVideo'); }
  setVolume(v: number): void { this.command('setVolume', [Math.max(0, Math.min(100, Math.round(v)))]); }

  destroy(): void {
    window.removeEventListener('message', this.onMessage);
    if (this.listenTimer) clearInterval(this.listenTimer);
    this.listenTimer = null;
    this.frame.remove();
  }

  /** The handshake: say "listening" until the player answers (the official script does the same). */
  private listen(): void {
    let tries = 0;
    const hello = () => {
      if (this.ready || ++tries > 40) { if (this.listenTimer) clearInterval(this.listenTimer); this.listenTimer = null; return; }
      this.post({ event: 'listening', id: 1, channel: 'widget' });
    };
    hello();
    this.listenTimer = setInterval(hello, 250);
  }

  private command(func: string, args: unknown[] = []): void {
    if (!this.ready) {
      // before the handshake only the latest of each command matters (the volume, play/pause)
      this.queued = this.queued.filter(([f]) => f !== func);
      this.queued.push([func, args]);
      return;
    }
    this.post({ event: 'command', func, args, id: 1, channel: 'widget' });
  }

  private post(msg: object): void {
    try { this.frame.contentWindow?.postMessage(JSON.stringify(msg), YT_ORIGIN); } catch { /* the frame is gone */ }
  }

  private receive(e: MessageEvent): void {
    if (e.origin !== YT_ORIGIN || e.source !== this.frame.contentWindow) return;
    let m: Incoming;
    try { m = typeof e.data === 'string' ? JSON.parse(e.data) as Incoming : e.data as Incoming; } catch { return; }
    if (!m || typeof m !== 'object') return;
    switch (m.event) {
      case 'onReady':
      case 'initialDelivery':
        if (!this.ready) {
          this.ready = true;
          for (const ev of ['onStateChange', 'onError', 'onAutoplayBlocked']) this.post({ event: 'command', func: 'addEventListener', args: [ev], id: 1, channel: 'widget' });
          const q = this.queued;
          this.queued = [];
          for (const [f, a] of q) this.command(f, a);
        }
        this.info(m.info);
        return;
      case 'infoDelivery':
        this.info(m.info);
        return;
      case 'onStateChange':
        if (typeof m.info === 'number') this.setState(m.info);
        return;
      case 'onError':
        this.error = typeof m.info === 'number' ? m.info : 5;
        return;
      case 'onAutoplayBlocked':
        this.blocked = true;
        return;
      default:
    }
  }

  private info(info: unknown): void {
    if (!info || typeof info !== 'object') return;
    const i = info as { playerState?: unknown; currentTime?: unknown; duration?: unknown; videoData?: { video_id?: unknown } };
    // a delivery about the previous video (just after loadVideoById) says nothing about this one
    const vid = i.videoData?.video_id;
    if (typeof vid === 'string' && this.id && vid !== this.id) return;
    if (typeof i.playerState === 'number') this.setState(i.playerState);
    if (typeof i.currentTime === 'number' && Number.isFinite(i.currentTime)) this.time = i.currentTime;
    if (typeof i.duration === 'number' && Number.isFinite(i.duration) && i.duration > 0) this.duration = i.duration;
  }

  private setState(n: number): void {
    const s = STATES[n];
    if (!s) return;
    this.state = s;
    if (s === 'playing') this.blocked = false;
  }
}
