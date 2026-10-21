/**
 * The Mendi band inside the game, reusing BrainLink's tested modules:
 * Web Bluetooth adapter (incl. the firmware-1.0.1 sensor wake), the fNIRS
 * pipeline (ΔHbO/ΔHbR, activation, asymmetry, heart rate, quality, motion)
 * and the hemispheric balance tracker.  Nothing leaves the device.
 *
 * Opened by the BrainLink app (embedded, `?hub=1`), the band is the app's:
 * a HubDevice lends its frames (or its simulator's), so nothing is paired twice.
 */
import { MendiDevice } from '../../../src/ble/mendi';
import { embeddedInHub, HubDevice, type NeuroDevice } from '../../../src/hub/link';
import { BalanceTracker } from '../../../src/core/balance';
import { FNIRSPipeline } from '../../../src/core/pipeline';
import { HEMO_CHANNELS } from '../../../src/core/types';
import { NO_BAND, type NeuroState } from './effects';

const TICK_MS = 100;
const STALE_SEC = 1.5;

const defaultDevice = (): NeuroDevice => (embeddedInHub() ? new HubDevice() : new MendiDevice());

export class NeuroBridge extends EventTarget {
  readonly device: NeuroDevice;
  // activation is judged against the last five minutes (BrainLink uses one): held focus stays above its
  // reference instead of becoming the new normal, which the focus multiplier needs
  private pipeline = new FNIRSPipeline({ activation_window_sec: 300 });
  private readonly balance = new BalanceTracker();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFramesAt: number | null = null;
  private wasStreaming = false;
  state: NeuroState = NO_BAND;

  constructor(device: NeuroDevice = defaultDevice()) {
    super();
    this.device = device;
    this.device.addEventListener('change', () => this.onDeviceChange());
  }

  static supported(): boolean { return embeddedInHub() || MendiDevice.supported(); }

  /** The band is lent by the BrainLink app this game is embedded in. */
  get viaHub(): boolean { return this.device instanceof HubDevice; }

  /** Embedded and the app has an fNIRS signal ready to lend: connecting needs no chooser. */
  get hubReady(): boolean {
    const hub = this.device instanceof HubDevice ? this.device.hub : null;
    return !!hub && hub.tool === 'fnirs' && hub.streaming;
  }

  /**
   * Embedded in BrainLink: take the app's signal as soon as it has one — the player chose the band (or the
   * simulator) there already.  Only once: after the player disconnects here, the game stays without it.
   */
  followHub(): void {
    if (!(this.device instanceof HubDevice)) return;
    const join = () => {
      if (this.timer || this.declined || this.joining || !this.hubReady) return;
      this.joining = true;
      this.connect().catch(() => undefined).finally(() => { this.joining = false; });
    };
    this.device.addEventListener('change', join);
    join();
  }

  private joining = false;
  private declined = false;

  /** Show the browser's chooser and start streaming. Must run from a user gesture. */
  async connect(): Promise<void> {
    this.declined = false;
    await this.device.request();
    await this.device.startStream();
    this.restartBaseline();
    this.start();
  }

  async disconnect(): Promise<void> {
    this.declined = true;
    this.stop();
    await this.device.disconnect();
    this.state = NO_BAND;
    this.emitChange();
  }

  /** A fresh baseline, e.g. at the start of the invocation (the calibration moment). */
  restartBaseline(): void {
    this.pipeline.reset();
    this.balance.resetStats();
    this.lastFramesAt = null;
  }

  private start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private onDeviceChange(): void {
    const streaming = this.device.isStreaming;
    if (streaming && !this.wasStreaming) this.restartBaseline();   // reconnected: new signal, new baseline
    this.wasStreaming = streaming;
    this.emitChange();
  }

  private tick(): void {
    const frames = this.device.isStreaming ? this.device.drain() : [];
    this.pipeline.push(frames);
    this.pipeline.adaptRate();
    const now = performance.now() / 1000;
    if (frames.length) this.lastFramesAt = now;
    const stale = this.lastFramesAt === null || now - this.lastFramesAt > STALE_SEC;
    const snap = this.pipeline.snapshot();
    // only a band off the skin counts as no signal: low SCI or room light is noisier but usable (as in BrainLink)
    const poor = HEMO_CHANNELS.some(ch => snap.quality[ch].label === 'no_signal');
    const hold = stale ? 'no_data' : snap.motion ? 'motion' : poor ? 'poor_signal' : null;
    const b = this.balance.update(snap.metrics.asymmetry, now, hold);
    const info = this.device.info;
    this.state = {
      source: 'band',
      connected: info.connected,
      streaming: info.streaming,
      reliable: !hold && snap.baseline_ready && b.paused === null,
      baselineProgress: snap.baseline_progress,
      baselineReady: snap.baseline_ready,
      activation: snap.metrics.activation,
      asymmetry: b.asymmetry,
      balanced: b.zone === 'balanced' && b.paused === null,
      balanceStreak: b.streak_sec,
      recommendation: b.recommendation,
      heartRate: snap.heart_rate_bpm,
      motion: snap.motion,
      paused: b.paused,
    };
    this.emitChange();
  }

  private emitChange(): void { this.dispatchEvent(new Event('change')); }
}
