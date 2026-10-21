/**
 * The app's processing loop — the browser counterpart of the server's
 * `fnirs_tick` (brainlink/fnirs_api.py): pull frames from the simulator or the
 * band, run the pipeline, feed the recorder and the balance tracker, and emit
 * one frame object per tick (same shape as the server's WebSocket frames).
 */
import { MendiDevice, type MendiInfo } from './ble/mendi';
import { BalanceTracker } from './core/balance';
import { FNIRSPipeline } from './core/pipeline';
import { FNIRSSimulator } from './core/simulator';
import type { Frame } from './core/proto';
import { HEMO_CHANNELS, type BalanceConfig, type BalanceState, type Derived, type FNIRSConfig, type Snapshot } from './core/types';
import type { SessionMeta } from './storage/format';
import type { SessionLibrary } from './storage/library';
import type { Recorder, RecorderInfo } from './storage/recorder';
import type { AppSettings } from './settings';

export type Source = 'simulator' | 'device' | 'off';
export const STREAM_HZ = 10;
export const STALE_SEC = 1.5;   // no frames for this long → balance feedback is held

export interface SimulatorInfo {
  state: string;
  auto: { scenario: string; elapsed_sec: number; total_sec: number; state: string } | null;
}

export interface EngineFrame extends Partial<Snapshot> {
  ts: number;
  source: Source;
  device: MendiInfo;
  simulator: SimulatorInfo | null;
  recording: RecorderInfo;
  balance?: BalanceState;
  frames_this_tick?: number;
}

export interface SavedEvent { meta: SessionMeta; movedToFolder: boolean; error?: string }

export interface TickFrames { frames: Frame[]; derived: Derived }

function holdFor(snap: Snapshot): string | null {
  if (snap.motion) return 'motion';
  if (HEMO_CHANNELS.some(ch => ['poor', 'light_leak', 'no_signal'].includes(snap.quality[ch].label))) return 'poor_signal';
  return null;
}

/**
 * Events: 'frame' (CustomEvent<EngineFrame>, 10 Hz), 'frames' (CustomEvent<{ frames, derived }>, the
 * raw frames and their ΔHb of a tick, when there were any), 'device' (band state changed),
 * 'saved' (CustomEvent<SavedEvent>, a recording was finalised), 'error' (CustomEvent<string>).
 */
export class Engine extends EventTarget {
  readonly pipeline: FNIRSPipeline;
  readonly simulator: FNIRSSimulator;
  readonly balance: BalanceTracker;
  readonly device: MendiDevice;
  source: Source = 'simulator';
  /** bumped whenever the signal starts afresh (new source, new baseline): consumers re-baseline too */
  epoch = 0;
  private lastFramesAt: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wasStreaming = false;
  private reportedError: string | null = null;

  constructor(readonly recorder: Recorder, readonly library: SessionLibrary, readonly settings: AppSettings,
              device: MendiDevice = new MendiDevice()) {
    super();
    this.pipeline = new FNIRSPipeline(settings.fnirsConfig);
    this.simulator = new FNIRSSimulator({ config: this.pipeline.config });
    this.balance = new BalanceTracker(settings.balanceConfig);
    this.device = device;
    this.device.addEventListener('change', () => this.onDeviceChange());
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.dispatchEvent(new CustomEvent<EngineFrame>('frame', { detail: this.tick() }));
      } catch (e) {
        console.error(e);
        this.dispatchEvent(new CustomEvent('error', { detail: String(e) }));
      }
    }, 1000 / STREAM_HZ);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(): EngineFrame {
    if (this.recorder.recording && this.recorder.expired) void this.stopRecording();   // stop() clears `recording` at once
    const err = this.recorder.error;
    if (err && this.recorder.meta?.session_id !== this.reportedError) {
      this.reportedError = this.recorder.meta?.session_id ?? null;
      this.fail(`Zapis nagrania nie powiódł się: ${err.message}`);
    }
    if (this.source === 'off') {
      return { ts: Date.now(), source: 'off', device: this.device.info, simulator: null, recording: this.recorder.info() };
    }
    const frames = this.source === 'device'
      ? (this.device.isStreaming ? this.device.drain() : [])
      : this.simulator.generateFrames();
    const derived = this.pipeline.push(frames);
    if (this.source === 'device' && this.pipeline.adaptRate()) {
      this.epoch++;
      console.info(`fNIRS sample rate set to measured ${this.pipeline.fs} Hz (baseline restarted)`);
    }
    if (frames.length && this.recorder.recording) this.recorder.add(frames, derived);
    if (frames.length) this.dispatchEvent(new CustomEvent<TickFrames>('frames', { detail: { frames, derived } }));

    const now = performance.now() / 1000;
    if (frames.length) this.lastFramesAt = now;
    const stale = this.lastFramesAt === null || now - this.lastFramesAt > STALE_SEC;
    const snap = this.pipeline.snapshot();
    // a stalled stream leaves the last values in place; never give feedback on them
    const balance = this.balance.update(snap.metrics.asymmetry, now, stale ? 'no_data' : holdFor(snap));
    return {
      ...snap, balance, source: this.source, device: this.device.info,
      simulator: this.source === 'simulator' ? { state: this.simulator.state, auto: this.simulator.autoProgress } : null,
      recording: this.recorder.info(), frames_this_tick: frames.length,
    };
  }

  /** Change source. A new signal, or a restarted stream, needs a new baseline. */
  setSource(name: Source, force = false): void {
    if (force || name !== this.source) {
      this.epoch++;
      if (name === 'simulator' && this.pipeline.fs !== this.simulator.fs) this.pipeline.setRate(this.simulator.fs);
      else this.pipeline.reset();
      this.simulator.resync();
      if (name === 'device') this.device.drain();   // drop frames buffered while another source was active
    }
    this.source = name;
  }

  async useDevice(): Promise<void> {
    if (!this.device.isConnected) throw new Error('Najpierw połącz opaskę');
    let restarted = false;
    if (!this.device.isStreaming) {
      await this.device.startStream();
      restarted = true;
    }
    this.setSource('device', restarted);
  }

  /** Show the chooser, connect, stream. Must run from a user gesture (click). */
  async connectDevice(): Promise<MendiInfo> {
    const info = await this.device.request();
    await this.device.startStream();
    this.setSource('device', true);
    return info;
  }

  async disconnectDevice(): Promise<void> {
    if (this.source === 'device') this.setSource('off');
    await this.device.disconnect();
  }

  private onDeviceChange(): void {
    const streaming = this.device.isStreaming;
    // the adapter reconnected and resumed by itself: same source, but a new baseline
    if (streaming && !this.wasStreaming && this.source === 'device') this.setSource('device', true);
    this.wasStreaming = streaming;
    this.dispatchEvent(new Event('device'));
  }

  setSimState(state: string): void { this.simulator.setState(state); }

  baselineReset(): void {
    this.pipeline.reset();
    this.epoch++;
  }

  setFnirsConfig(overrides: Partial<FNIRSConfig>): FNIRSConfig {
    const cfg = this.pipeline.setConfig(overrides);
    this.epoch++;
    this.simulator.cfg = cfg;
    this.settings.fnirsConfig = cfg;
    return cfg;
  }

  setBalanceConfig(overrides: Partial<BalanceConfig>): BalanceState {
    this.settings.balanceConfig = this.balance.setConfig(overrides);
    return this.balance.state();
  }

  resetBalanceStats(): BalanceState {
    this.balance.resetStats();
    return this.balance.state();
  }

  async startRecording(name: string, durationSec: number): Promise<RecorderInfo> {
    return this.recorder.start({
      name: name.trim() || `fnirs_${Math.floor(Date.now() / 1000)}`,
      durationSec: Math.max(10, Math.min(7200, Math.round(durationSec) || 600)),
      source: this.source,
      device: this.source === 'device' ? (this.device.info.device_name ?? 'Mendi') : 'Simulator',
      config: this.pipeline.config,
      sampleRate: this.pipeline.fs,
      storage: this.settings.storageTarget,
    });
  }

  mark(label: string): boolean { return this.recorder.mark(label.slice(0, 64)) !== null; }

  /** Stop and finalise; a new recording may start while this one is still being moved to the folder. */
  async stopRecording(): Promise<void> {
    if (!this.recorder.recording) return;
    try {
      const { error, ...meta } = await this.recorder.stop();
      const res = await this.library.finalize(meta);
      const detail = error ? { ...res, error: [`Część danych nie została zapisana (${error})`, res.error].filter(Boolean).join('. ') } : res;
      this.dispatchEvent(new CustomEvent<SavedEvent>('saved', { detail }));
    } catch (e) {
      this.fail(`Nie udało się zakończyć nagrania: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private fail(message: string): void {
    this.dispatchEvent(new CustomEvent<string>('error', { detail: message }));
  }
}
