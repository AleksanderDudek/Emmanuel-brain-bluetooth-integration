/**
 * The EEG processing loop — the browser counterpart of the server's
 * `eeg_loop` (server.py): pull samples from the simulator or the HALO band,
 * run the DSP and the metric engine, and emit one frame per tick (10 Hz),
 * with the same keys as the server's WebSocket frames where they overlap.
 */
import { HaloDevice, type HaloInfo } from './ble/halo';
import { EegDsp } from './core/eeg/dsp';
import { FeatureEngine, type ComboTimer } from './core/eeg/features';
import { EEGSimulator, type EegAutoProgress } from './core/eeg/simulator';
import { EEG_CHANNELS, EEG_SAMPLE_RATE, WINDOW_SAMPLES, type BandPowers, type EegChannel, type EegMetrics } from './core/eeg/types';
import { std } from './core/dsp';
import type { Source } from './engine';

export const EEG_STREAM_HZ = 10;
const STALE_SEC = 1.5;
const PREVIEW_SEC = 2;

/** Contact per channel from the spread of the last second (a heuristic: HALO reports no impedance over BLE). */
export type EegContact = 'good' | 'flat' | 'noisy' | 'warming_up';
export const FLAT_UV = 0.5;
export const NOISY_UV = 80;

export interface EegFrame {
  ts: number;
  source: Source;
  device: HaloInfo;
  simulator: { state: string; auto: EegAutoProgress | null } | null;
  /** one full analysis window buffered */
  ready: boolean;
  warmup_progress: number;
  band_powers: BandPowers | null;
  blink_count: number | null;
  metrics: EegMetrics | null;
  active_combos: string[];
  combo_timers: Record<string, ComboTimer>;
  /** last 2 s per channel, filtered and detrended, ~125 points */
  preview: Record<EegChannel, number[]> | null;
  contact: Record<EegChannel, { label: EegContact; sd: number | null }>;
  /** fresh data, all channels in contact */
  reliable: boolean;
  samples_this_tick: number;
}

function contactOf(dsp: EegDsp): EegFrame['contact'] {
  return Object.fromEntries(EEG_CHANNELS.map(ch => {
    const buf = dsp.buffers[ch];
    if (buf.length < WINDOW_SAMPLES) return [ch, { label: 'warming_up' as const, sd: null }];
    const sd = std(buf.subarray(-WINDOW_SAMPLES));
    const label: EegContact = sd < FLAT_UV ? 'flat' : sd > NOISY_UV ? 'noisy' : 'good';
    return [ch, { label, sd: Math.round(sd * 10) / 10 }];
  })) as EegFrame['contact'];
}

/** Events: 'frame' (CustomEvent<EegFrame>), 'device' (band state changed), 'error' (CustomEvent<string>). */
export class EegEngine extends EventTarget {
  readonly device: HaloDevice;
  readonly simulator: EEGSimulator;
  dsp = new EegDsp();
  readonly features = new FeatureEngine();
  source: Source = 'off';
  /** bumped whenever the signal starts afresh (as Engine.epoch) */
  epoch = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSamplesAt: number | null = null;
  private wasStreaming = false;
  /** the last computed metrics, kept for ticks that bring no samples */
  private last: { bandPowers: BandPowers; blinks: number; metrics: EegMetrics; combos: string[]; timers: Record<string, ComboTimer> } | null = null;

  constructor(device: HaloDevice = new HaloDevice(), simulator: EEGSimulator = new EEGSimulator()) {
    super();
    this.device = device;
    this.simulator = simulator;
    this.device.addEventListener('change', () => this.onDeviceChange());
  }

  get running(): boolean { return this.timer !== null; }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.dispatchEvent(new CustomEvent<EegFrame>('frame', { detail: this.tick() }));
      } catch (e) {
        console.error(e);
        this.dispatchEvent(new CustomEvent('error', { detail: String(e) }));
      }
    }, 1000 / EEG_STREAM_HZ);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  tick(): EegFrame {
    const base = { ts: Date.now(), source: this.source, device: this.device.info, active_combos: [], combo_timers: {} };
    if (this.source === 'off') {
      return { ...base, simulator: null, ready: false, warmup_progress: 0, band_powers: null, blink_count: null, metrics: null,
               preview: null, contact: contactOf(this.dsp), reliable: false, samples_this_tick: 0 };
    }
    const data = this.source === 'device'
      ? (this.device.isStreaming ? this.device.drain() : null)
      : this.simulator.generateRealtime();
    const n = data ? data.Fp1.length : 0;
    if (data && n) this.dsp.push(data);
    const now = performance.now() / 1000;
    if (n) this.lastSamplesAt = now;
    const stale = this.lastSamplesAt === null || now - this.lastSamplesAt > STALE_SEC;
    const ready = this.dsp.hasEnough();
    const contact = contactOf(this.dsp);
    let bandPowers: BandPowers | null = null, blinks: number | null = null, metrics: EegMetrics | null = null;
    let combos: string[] = [], timers: Record<string, ComboTimer> = {};
    if (ready && n) {
      bandPowers = this.dsp.bandPowers();
      blinks = this.dsp.blinks();
      const f = this.features.compute(bandPowers, blinks);
      ({ metrics } = f);
      combos = f.active_combos;
      timers = f.combo_timers;
      this.last = { bandPowers, blinks, metrics, combos, timers };
    } else if (ready && this.last) {
      ({ bandPowers, blinks, metrics, combos, timers } = this.last);
    }
    const step = Math.max(1, Math.round(EEG_SAMPLE_RATE / 62.5));
    const preview = Object.fromEntries(Object.entries(this.dsp.preview(EEG_SAMPLE_RATE * PREVIEW_SEC))
      .map(([ch, v]) => [ch, v.filter((_, i) => i % step === 0).map(x => Math.round(x * 100) / 100)])) as Record<EegChannel, number[]>;
    const fill = Math.min(...EEG_CHANNELS.map(ch => this.dsp.buffers[ch].length));
    return {
      ...base, active_combos: combos, combo_timers: timers,
      simulator: this.source === 'simulator' ? { state: this.simulator.state, auto: this.simulator.autoProgress } : null,
      ready, warmup_progress: Math.min(1, fill / WINDOW_SAMPLES), band_powers: bandPowers, blink_count: blinks, metrics, preview,
      contact, reliable: ready && !stale && EEG_CHANNELS.every(ch => contact[ch].label === 'good'), samples_this_tick: n,
    };
  }

  /** Fresh buffers and smoothing: a new signal must not be judged on the old one. */
  private restart(): void {
    this.epoch++;
    this.dsp = new EegDsp();
    this.features.reset();
    this.last = null;
    this.lastSamplesAt = null;
  }

  setSource(name: Source, force = false): void {
    if (force || name !== this.source) {
      this.restart();
      this.simulator.resync();
      if (name === 'device') this.device.drain();
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
  async connectDevice(): Promise<HaloInfo> {
    const info = await this.device.request();
    await this.device.startStream();
    this.setSource('device', true);
    return info;
  }

  async disconnectDevice(): Promise<void> {
    if (this.source === 'device') this.setSource('off');
    await this.device.disconnect();
  }

  setSimState(state: string): void { this.simulator.setState(state); }

  baselineReset(): void { this.restart(); }

  private onDeviceChange(): void {
    const streaming = this.device.isStreaming;
    if (streaming && !this.wasStreaming && this.source === 'device') this.setSource('device', true);
    this.wasStreaming = streaming;
    this.dispatchEvent(new Event('device'));
  }
}
