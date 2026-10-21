/**
 * App side of `brainlink-hub` (./protocol.ts): answers an embedded game's
 * hello, keeps it told about the tool, source and band, and forwards the raw
 * fNIRS frames every tick while the game wants them.  No DOM here beyond the
 * game's window, so it is unit-tested with a fake frame.
 */
import type { FrameData } from '../core/proto';
import { hubMessage, isHubMessage, type HubStatusMsg } from './protocol';

export class GameHost {
  private game: Window | null = null;
  private wantsFrames = false;
  private lastSig = '';
  /** frames sent to the current game (for the overlay's status line and the tests) */
  sent = 0;

  constructor(private readonly status: () => HubStatusMsg, private readonly win: Window = window) {
    win.addEventListener('message', this.onMessage);
  }

  /** The game's window (the iframe's contentWindow) — null when the game is closed. */
  attach(game: Window | null): void {
    this.game = game;
    this.wantsFrames = false;
    this.lastSig = '';
    this.sent = 0;
  }

  get attached(): boolean { return this.game !== null; }
  get connected(): boolean { return this.game !== null && this.lastSig !== ''; }

  private post(msg: unknown): void {
    this.game?.postMessage(msg, this.win.location.origin);
  }

  private onMessage = (e: MessageEvent): void => {
    if (!this.game || e.source !== this.game || e.origin !== this.win.location.origin || !isHubMessage(e.data)) return;
    if (e.data.type === 'hello') {
      const s = this.status();
      this.lastSig = sig(s);
      this.post(hubMessage('welcome', s));
    } else if (e.data.type === 'want') {
      this.wantsFrames = true;
    } else if (e.data.type === 'bye') {
      this.wantsFrames = false;
    }
  };

  /** Call every tick: sends a status when something changed, then the tick's frames. */
  tick(frames: readonly FrameData[]): void {
    if (!this.game || !this.lastSig) return;
    const s = this.status();
    const now = sig(s);
    if (now !== this.lastSig) {
      this.lastSig = now;
      this.post(hubMessage('status', s));
    }
    if (this.wantsFrames && s.streaming && frames.length) {
      this.post(hubMessage('frames', { epoch: s.epoch, frames: frames.map(f => ({ ...f })) }));
      this.sent += frames.length;
    }
  }

  close(): void {
    this.attach(null);
    this.win.removeEventListener('message', this.onMessage);
  }
}

/** What the game must hear about: everything except the fast-changing counters. */
function sig(s: HubStatusMsg): string {
  const d = s.device;
  return JSON.stringify([s.tool, s.source, s.streaming, s.epoch, d?.connected, d?.streaming, d?.device_name, d?.battery?.percent]);
}
