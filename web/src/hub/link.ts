/**
 * Game side of `brainlink-hub` (./protocol.ts): a stand-in for MendiDevice
 * that takes its frames from the Emmanuel app embedding the game, so the
 * game reuses the app's band connection (or its simulator) instead of
 * pairing again.  It offers what the games' NeuroBridge uses — `isStreaming`,
 * `isConnected`, `drain()`, `info`, `request()`, `startStream()`,
 * `disconnect()` and 'change' events — and the game keeps its own pipeline,
 * baseline and balance tracker.
 *
 * Its messages show inside the HolyHolyHoly games, which are Polish only: they stay Polish here.
 */
import type { MendiInfo } from '../ble/mendi';
import { Frame } from '../core/proto';
import { HUB_PARAM, hubMessage, isHubMessage, type HubStatusMsg } from './protocol';

/** The surface of MendiDevice a game's NeuroBridge needs. */
export interface NeuroDevice extends EventTarget {
  readonly isConnected: boolean;
  readonly isStreaming: boolean;
  readonly info: MendiInfo;
  request(): Promise<MendiInfo>;
  startStream(): Promise<void>;
  disconnect(): Promise<void>;
  drain(): Frame[];
}

/** True when this page was opened by Emmanuel as an embedded game (`?hub=1` inside a same-origin frame). */
export function embeddedInHub(win: Window = window): boolean {
  try {
    return new URLSearchParams(win.location.search).has(HUB_PARAM) && win.parent !== win
      && win.parent.location.origin === win.location.origin;   // throws for a cross-origin parent
  } catch {
    return false;
  }
}

const OFFLINE_INFO: MendiInfo = {
  connected: false, streaming: false, reconnecting: false, device_name: null, id: null, model: 'Mendi', firmware: 'unknown',
  hardware: 'unknown', battery: null, diagnostics: null, calibration: null, frames_dropped: 0, frames_invalid: 0,
  data_stale: false, sensor_woken: false,
};

export class HubError extends Error {
  override name = 'HubError';
}

export class HubDevice extends EventTarget implements NeuroDevice {
  private status: HubStatusMsg | null = null;
  private frames: Frame[] = [];
  private attached = false;
  private restarting = false;
  private dropped = 0;
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  private readonly cap: number;

  constructor(private readonly win: Window = window, cap = 31 * 300) {
    super();
    this.cap = cap;
    win.addEventListener('message', this.onMessage);
    const hello = () => win.parent.postMessage(hubMessage('hello', {}), win.location.origin);
    hello();
    // the app may still be wiring its listener: repeat until it answers
    this.helloTimer = setInterval(() => (this.status ? this.stopHello() : hello()), 500);
  }

  static supported(): boolean { return true; }

  private stopHello(): void {
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.helloTimer = null;
  }

  private onMessage = (e: MessageEvent): void => {
    if (e.source !== this.win.parent || e.origin !== this.win.location.origin || !isHubMessage(e.data)) return;
    const m = e.data;
    if (m.type === 'welcome' || m.type === 'status') {
      const prev = this.status;
      const { tool, source, streaming, epoch, device } = m;
      this.status = { tool, source, streaming, epoch, device };
      this.stopHello();
      if (prev && prev.epoch !== epoch) {
        // a new signal: report a stop first, so NeuroBridge takes a new baseline when it resumes
        this.frames = [];
        this.restarting = true;
        this.emit();
        this.restarting = false;
      }
      this.emit();
    } else if (m.type === 'frames') {
      if (!this.attached || !this.status || m.epoch !== this.status.epoch) return;
      for (const f of m.frames) this.frames.push(new Frame(f));
      if (this.frames.length > this.cap) {
        this.dropped += this.frames.length - this.cap;
        this.frames.splice(0, this.frames.length - this.cap);
      }
    }
  };

  /** The app has an fNIRS signal to lend (the band or its simulator). */
  private get lendable(): boolean {
    return !!this.status && this.status.tool === 'fnirs' && this.status.streaming;
  }

  get isConnected(): boolean { return this.attached && this.lendable && !this.restarting; }
  get isStreaming(): boolean { return this.isConnected; }

  get info(): MendiInfo {
    const s = this.status;
    if (!s || !this.isConnected) return { ...OFFLINE_INFO, frames_dropped: this.dropped };
    const name = s.source === 'simulator' ? 'Symulator (Emmanuel)' : `${s.device?.device_name ?? 'Mendi'} (Emmanuel)`;
    return { ...(s.device ?? OFFLINE_INFO), connected: true, streaming: true, device_name: name, frames_dropped: this.dropped };
  }

  /** "Connect": take the app's signal. Rejects with guidance when the app has none to lend. */
  async request(): Promise<MendiInfo> {
    const s = this.status;
    if (!s) throw new HubError('Emmanuel nie odpowiada — zamknij grę i otwórz ją ponownie.');
    if (s.tool !== 'fnirs') throw new HubError('Emmanuel używa teraz opaski HALO (EEG). Ta gra czyta tylko opaskę Mendi — przełącz opaskę u góry na Mendi.');
    if (!s.streaming) throw new HubError('Połącz opaskę Mendi albo włącz symulator w Emmanuelu (przycisk opaski u góry).');
    this.attached = true;
    this.frames = [];
    this.win.parent.postMessage(hubMessage('want', {}), this.win.location.origin);
    this.emit();
    return this.info;
  }

  async startStream(): Promise<void> {
    if (!this.attached) throw new HubError('Najpierw połącz opaskę');
  }

  async disconnect(): Promise<void> {
    this.attached = false;
    this.frames = [];
    this.win.parent.postMessage(hubMessage('bye', {}), this.win.location.origin);
    this.emit();
  }

  drain(): Frame[] {
    const out = this.frames;
    this.frames = [];
    return out;
  }

  /** What the app says right now (for the game's UI). */
  get hub(): HubStatusMsg | null { return this.status; }

  close(): void {
    this.stopHello();
    this.win.removeEventListener('message', this.onMessage);
  }

  private emit(): void { this.dispatchEvent(new Event('change')); }
}
