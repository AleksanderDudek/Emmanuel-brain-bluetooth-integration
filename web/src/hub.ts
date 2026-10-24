/**
 * The app's single point of contact with the headbands (DESIGN.md §3).
 *
 * It owns both engines — fNIRS (Mendi) and EEG (HALO) — runs the one for the
 * chosen tool, and turns their very different frames into one `HubStatus`
 * (device, signal readiness and the reason it is not ready) and one training
 * `HubSample` per tick, so the app bar, Start, the trainings and the embedded
 * games never branch on the tool.  It also lends the fNIRS frames to an
 * embedded game through the GameHost.
 */
import type { Engine, EngineFrame, Source, TickFrames } from './engine';
import type { EegEngine, EegFrame } from './eeg-engine';
import type { AppSettings } from './settings';
import type { RecorderInfo } from './storage/recorder';
import { GameHost } from './hub/host';
import type { HubStatusMsg } from './hub/protocol';
import type { Frame } from './core/proto';
import { HEMO_CHANNELS, type Derived } from './core/types';
import { fmtNum } from './i18n';
import { t } from './i18n/signal';
import { TOOL_INFO, type Tool } from './tools';

export interface DeviceSummary {
  kind: 'mendi' | 'halo';
  connected: boolean;
  streaming: boolean;
  reconnecting: boolean;
  name: string | null;
  battery: number | null;
  charging: boolean;
  stale: boolean;
}

/** Why the signal cannot be used right now (null = it can). */
export type SignalReason = 'no_tool' | 'off' | 'no_device' | 'connecting' | 'no_data' | 'baseline' | 'motion' | 'poor_signal';

/**
 * Usable, but worth fixing: weak optode coupling (low SCI: little heartbeat in the forehead channels),
 * strong room light, or a noisy EEG electrode.  Nothing is paused for these — Mendi's own app trains
 * through them too; a band that is actually off the skin is `poor_signal` and does pause.
 */
export type SignalWarning = 'weak_contact' | 'light_leak' | 'noisy';

export interface HubStatus {
  tool: Tool | null;
  source: Source;
  device: DeviceSummary;
  signal: {
    reliable: boolean;
    reason: SignalReason | null;
    /** baseline / warm-up progress, 0..1 */
    progress: number;
    quality: 'good' | 'fair' | 'poor' | null;
    warning: SignalWarning | null;
    /** per-channel numbers behind the quality, for the curious (e.g. "L: SCI 0,42 · P: SCI 0,37"), in the page's language */
    detail: string | null;
    heartRate: number | null;
  };
  recording: RecorderInfo | null;
}

/** One training input per tick: fNIRS mean(ΔHbO − ΔHbR) in µM, or EEG ln(frontal β/α). */
export interface HubSample {
  tool: Tool;
  x: number | null;
  reliable: boolean;
  reason: SignalReason | null;
  warning: SignalWarning | null;
  dt: number;
  /** the engine's signal epoch: a change means a new baseline, so earlier references no longer hold */
  epoch: number;
}

const REASONS: readonly SignalReason[] = ['no_tool', 'off', 'no_device', 'connecting', 'no_data', 'baseline', 'motion', 'poor_signal'];
const WARNINGS: readonly SignalWarning[] = ['weak_contact', 'light_leak', 'noisy'];

/** Why the signal is not usable, as a sentence (in the page's language). */
export const REASON_TEXT = Object.fromEntries(REASONS.map(r => [r, t(`reason.${r}`)])) as Record<SignalReason, string>;

/** What to do about a weak signal; the part before ";" is short enough for a game's HUD. */
export const WARNING_TEXT = Object.fromEntries(WARNINGS.map(w => [w, t(`warn.${w}`)])) as Record<SignalWarning, string>;

const STALE_SEC = 1.5;

/** Mean oxygenation over a tick's samples (NaN while a side is still warming up is skipped). */
export function oxygenation(d: Derived): number | null {
  let sum = 0, n = 0;
  for (let i = 0; i < d.hbo_left.length; i++) {
    const v = ((d.hbo_left[i] - d.hbr_left[i]) + (d.hbo_right[i] - d.hbr_right[i])) / 2;
    if (Number.isFinite(v)) { sum += v; n++; }
  }
  return n ? sum / n : null;
}

/** Events: 'status' (CustomEvent<HubStatus>, every tick), 'sample' (CustomEvent<HubSample>), 'tool' (the tool changed). */
export class Hub extends EventTarget {
  tool: Tool | null;
  readonly games: GameHost;
  private tickFrames: Frame[] = [];
  private tickOxy: number | null = null;
  private lastDataAt: Record<Tool, number | null> = { fnirs: null, eeg: null };
  /** the last training input, carried through ticks that brought no data while the stream is still fresh */
  private lastX: Record<Tool, number | null> = { fnirs: null, eeg: null };
  private lastTickAt: number | null = null;
  status: HubStatus;

  constructor(readonly fnirs: Engine, readonly eeg: EegEngine, readonly settings: AppSettings, private readonly save: () => Promise<void>) {
    super();
    this.tool = settings.tool;
    this.games = new GameHost(() => this.gameStatus());
    this.status = this.idleStatus();
    fnirs.addEventListener('frames', e => {
      const { frames, derived } = (e as CustomEvent<TickFrames>).detail;
      this.tickFrames = frames;
      this.tickOxy = oxygenation(derived);
    });
    fnirs.addEventListener('frame', e => this.onFnirs((e as CustomEvent<EngineFrame>).detail));
    eeg.addEventListener('frame', e => this.onEeg((e as CustomEvent<EegFrame>).detail));
  }

  /** Start the engines for the saved tool, on the saved source (the band always needs a click). */
  start(): void {
    this.fnirs.setSource(this.tool === 'fnirs' && this.settings.simulator.fnirs ? 'simulator' : 'off');
    this.fnirs.start();
    if (this.tool === 'eeg') {
      this.eeg.setSource(this.settings.simulator.eeg ? 'simulator' : 'off');
      this.eeg.start();
    }
  }

  private engineOf(tool: Tool): Engine | EegEngine { return tool === 'fnirs' ? this.fnirs : this.eeg; }

  get active(): Engine | EegEngine | null { return this.tool ? this.engineOf(this.tool) : null; }

  /** The active tool's band is connected (or reconnecting), or a recording is running: switching needs a confirmation. */
  get busy(): boolean {
    const d = this.active?.device;
    return !!d && (d.isConnected || d.info.reconnecting) || this.fnirs.recorder.recording;
  }

  private switching: Promise<void> = Promise.resolve();

  /** Switch tools; calls are serialised, so quick clicks land in order and the last one wins. */
  setTool(tool: Tool): Promise<void> {
    const run = this.switching.then(() => this.doSetTool(tool));
    this.switching = run.catch(() => undefined);
    return run;
  }

  private async doSetTool(tool: Tool): Promise<void> {
    if (tool === this.tool) return;
    const prev = this.tool;
    // a band that is only reconnecting is released too: otherwise it would come back streaming for a tool nobody uses
    const release = (d: { isConnected: boolean; info: { reconnecting: boolean } }) => d.isConnected || d.info.reconnecting;
    if (prev === 'eeg') {
      if (release(this.eeg.device)) await this.eeg.disconnectDevice();
      this.eeg.setSource('off');
      this.eeg.stop();
    } else if (prev === 'fnirs') {
      if (this.fnirs.recorder.recording) await this.fnirs.stopRecording();
      if (release(this.fnirs.device)) await this.fnirs.disconnectDevice();
      this.fnirs.setSource('off');
    }
    this.tool = tool;
    this.settings.tool = tool;
    await this.save();
    const sim = this.settings.simulator[tool];
    if (tool === 'eeg') {
      this.eeg.setSource(sim ? 'simulator' : 'off');
      this.eeg.start();
    } else {
      this.fnirs.setSource(sim ? 'simulator' : 'off');
    }
    this.lastDataAt[tool] = null;
    this.dispatchEvent(new Event('tool'));
  }

  // ── sources (of the active tool) ──────────────────────────────────
  private requireTool(): Tool {
    if (!this.tool) throw new Error(t('err.noTool'));
    return this.tool;
  }

  async useSimulator(): Promise<void> {
    const tool = this.requireTool();
    this.engineOf(tool).setSource('simulator');
    this.settings.simulator[tool] = true;
    await this.save();
  }

  async turnOff(): Promise<void> {
    const tool = this.requireTool();
    this.engineOf(tool).setSource('off');
    this.settings.simulator[tool] = false;
    await this.save();
  }

  /** Show the browser's chooser and stream. Call straight from a click. */
  async connect(): Promise<void> {
    const tool = this.requireTool();
    const eng = this.engineOf(tool);
    if (eng.device.isConnected) await eng.useDevice();
    else await eng.connectDevice();
    this.settings.simulator[tool] = false;
    await this.save();
  }

  async disconnect(): Promise<void> {
    await this.active?.disconnectDevice();
  }

  setSimState(state: string): void { this.active?.setSimState(state); }

  baselineReset(): void { this.active?.baselineReset(); }

  // ── per tick ─────────────────────────────────────────────────────
  private dt(): number {
    const now = performance.now() / 1000;
    const dt = this.lastTickAt === null ? 0.1 : Math.min(1, Math.max(0, now - this.lastTickAt));
    this.lastTickAt = now;
    return dt;
  }

  private fresh(tool: Tool, gotData: boolean): boolean {
    const now = performance.now() / 1000;
    if (gotData) this.lastDataAt[tool] = now;
    const t = this.lastDataAt[tool];
    return t !== null && now - t <= STALE_SEC;
  }

  private onFnirs(f: EngineFrame): void {
    const frames = this.tickFrames, oxy = this.tickOxy;
    this.tickFrames = [];
    this.tickOxy = null;
    this.games.tick(frames);
    if (this.tool !== 'fnirs' && this.tool !== null) return;
    const d = f.device;
    const device: DeviceSummary = {
      kind: 'mendi', connected: d.connected, streaming: d.streaming, reconnecting: d.reconnecting, name: d.device_name,
      battery: d.battery?.percent ?? null, charging: !!d.battery?.charging, stale: d.data_stale,
    };
    const fresh = this.fresh('fnirs', (f.frames_this_tick ?? 0) > 0);
    const q = f.quality;
    const labels = q ? HEMO_CHANNELS.map(ch => q[ch].label) : [];
    const offSkin = labels.includes('no_signal');
    const warning: SignalWarning | null = labels.includes('light_leak') ? 'light_leak' : labels.includes('poor') ? 'weak_contact' : null;
    const quality = !f.baseline_ready || !labels.length ? null
      : offSkin || warning ? 'poor' : labels.includes('fair') ? 'fair' : 'good';
    const detail = q && q.left.sci !== null ? HEMO_CHANNELS.map(ch => {
      const c = q[ch];
      const side = t(ch === 'left' ? 'sig.left' : 'sig.right'), sci = c.sci === null ? '—' : fmtNum(c.sci, 2);
      return c.ambient_ratio !== null && c.ambient_ratio > 0.2
        ? t('sig.sciLight', { side, sci, light: Math.round(c.ambient_ratio * 100) }) : t('sig.sci', { side, sci });
    }).join(' · ') : null;
    let reason: SignalReason | null = null;
    if (!this.tool) reason = 'no_tool';
    else if (f.source === 'off') reason = 'off';
    else if (f.source === 'device' && d.reconnecting) reason = 'connecting';
    else if (f.source === 'device' && !d.connected) reason = 'no_device';
    else if (!fresh) reason = 'no_data';
    else if (!f.baseline_ready) reason = 'baseline';
    else if (f.motion) reason = 'motion';
    else if (offSkin) reason = 'poor_signal';
    this.publish({
      tool: this.tool, source: f.source, device, recording: f.recording,
      signal: { reliable: reason === null, reason, progress: f.baseline_ready ? 1 : f.baseline_progress ?? 0, quality,
                warning: reason === null ? warning : null, detail, heartRate: f.heart_rate_bpm ?? null },
    }, oxy);
  }

  private onEeg(f: EegFrame): void {
    if (this.tool !== 'eeg') return;
    const d = f.device;
    const device: DeviceSummary = {
      kind: 'halo', connected: d.connected, streaming: d.streaming, reconnecting: d.reconnecting, name: d.device_name,
      battery: d.battery_percent, charging: false, stale: d.data_stale,
    };
    const fresh = this.fresh('eeg', f.samples_this_tick > 0);
    const labels = Object.values(f.contact).map(c => c.label);
    const flat = labels.includes('flat');
    const noisy = labels.includes('noisy');
    let reason: SignalReason | null = null;
    if (f.source === 'off') reason = 'off';
    else if (f.source === 'device' && d.reconnecting) reason = 'connecting';
    else if (f.source === 'device' && !d.connected) reason = 'no_device';
    else if (!fresh) reason = 'no_data';
    else if (!f.ready) reason = 'baseline';
    else if (flat) reason = 'poor_signal';
    const bp = f.band_powers;
    const x = bp && f.samples_this_tick > 0
      ? Math.log(Math.max((bp.Fp1.beta + bp.Fp2.beta) / 2, 1e-6) / Math.max((bp.Fp1.alpha + bp.Fp2.alpha) / 2, 1e-6)) : null;
    this.publish({
      tool: 'eeg', source: f.source, device, recording: null,
      signal: { reliable: reason === null, reason, progress: f.ready ? 1 : f.warmup_progress,
                quality: !f.ready ? null : flat || noisy ? 'poor' : 'good', warning: reason === null && noisy ? 'noisy' : null,
                detail: f.ready ? Object.entries(f.contact).map(([ch, c]) => `${ch}: ${c.sd === null ? '—' : `${fmtNum(c.sd, 1)} µV`}`).join(' · ') : null,
                heartRate: null },
    }, x);
  }

  private publish(status: HubStatus, x: number | null): void {
    this.status = status;
    if (status.tool) {
      // BLE arrives in bursts: an empty tick inside a fresh stream is no reason to doubt the signal
      if (x !== null) this.lastX[status.tool] = x;
      else if (status.signal.reason === null) x = this.lastX[status.tool];
      if (status.signal.reason === 'off' || status.signal.reason === 'baseline') this.lastX[status.tool] = null;
    }
    this.dispatchEvent(new CustomEvent<HubStatus>('status', { detail: status }));
    if (status.tool) {
      const s = status.signal;
      const epoch = status.tool === 'eeg' ? this.eeg.epoch : this.fnirs.epoch;
      this.dispatchEvent(new CustomEvent<HubSample>('sample', {
        detail: { tool: status.tool, x, reliable: s.reliable, reason: s.reason, warning: s.warning, dt: this.dt(), epoch },
      }));
    }
  }

  private idleStatus(): HubStatus {
    return {
      tool: this.tool, source: 'off', recording: null,
      device: { kind: this.tool === 'eeg' ? 'halo' : 'mendi', connected: false, streaming: false, reconnecting: false, name: null, battery: null, charging: false, stale: false },
      signal: { reliable: false, reason: this.tool ? 'off' : 'no_tool', progress: 0, quality: null, warning: null, detail: null, heartRate: null },
    };
  }

  /** What an embedded game hears (GameHost). */
  private gameStatus(): HubStatusMsg {
    const src = this.tool === 'fnirs' ? this.fnirs.source : 'off';
    const streaming = this.tool === 'fnirs' && (src === 'simulator' || (src === 'device' && this.fnirs.device.isStreaming));
    return { tool: this.tool ?? 'fnirs', source: src, streaming, epoch: this.fnirs.epoch, device: this.fnirs.device.info };
  }

  /** "Mendi" / "BrainAccess HALO" for messages. */
  get deviceLabel(): string { return this.tool ? TOOL_INFO[this.tool].device : t('sig.headband'); }
}
