/**
 * Web Bluetooth adapter for the BrainAccess HALO EEG headband.
 * Port of brainlink/halo_ble.py (UUIDs from the official libbacore.so and
 * real-device discovery):
 *
 *  - write the stream config (gain ×8 on all four channels, 250 Hz),
 *    subscribe to the data characteristic, write 0x01 to start (0x00 stops);
 *  - each notification = N × 6-byte records + a 6-byte footer; a record holds
 *    six int8 deltas whose running sum is the raw signal; bytes 2–5 are
 *    Fp1, Fp2, O1, O2, scaled by 0.0671 µV/count;
 *  - the first record of a notification carries a resync step beyond the
 *    int8 range, so it is clamped to ±127 (see the Python adapter).
 *
 * GATT operations are serialised (Chromium rejects overlapping ones) and a
 * generation counter stops stale reconnect loops, as in ./mendi.ts.  The
 * serial number is not read: Web Bluetooth blocks that characteristic.
 */
import { EEG_CHANNELS, EEG_SAMPLE_RATE, type EegChannel } from '../core/eeg/types';
import { t } from '../i18n/signal';

export const SVC_CONTROL = 'ace20bb6-5d39-45de-9f21-b101acf45b9b';
export const HALO_CHR = {
  command: '49beba02-5f6b-4ca2-b3c9-2e6b71aa9392',
  data: 'a12f7c4b-9e8d-6a53-1e0f-c274815b36d7',
  config: '3467e3a2-4511-ae66-7515-b26fce099337',
} as const;
export const EEG_SCALE_UV = 0.0671;
/** [impedance_mode, gain ch0..3 (×8), enable mask, rate (250 Hz)] */
export const STREAM_CONFIG = Uint8Array.from([0x00, 0x04, 0x04, 0x04, 0x04, 0x0f, 0x06]);
const RECORD = 6;
const FOOTER = 6;
const CH_BYTES = [2, 3, 4, 5];   // record bytes → Fp1, Fp2, O1, O2

export const HALO_REQUEST_OPTIONS: RequestDeviceOptions = {
  filters: [{ namePrefix: 'BA ' }, { namePrefix: 'HALO' }, { namePrefix: 'BrainAccess' }, { services: [SVC_CONTROL] }],
  optionalServices: [SVC_CONTROL, 'battery_service', 'device_information'],
};

export interface HaloInfo {
  connected: boolean;
  streaming: boolean;
  reconnecting: boolean;
  device_name: string | null;
  id: string | null;
  model: string;
  firmware: string;
  hardware: string;
  manufacturer: string;
  battery_percent: number | null;
  packets: number;
  packets_invalid: number;
  samples_dropped: number;
  data_stale: boolean;
}

export interface HaloOptions {
  /** per channel; 5 min at 250 Hz — a hidden tab drains on a throttled timer */
  bufferSamples?: number;
  reconnectDelaysMs?: number[];
  bluetooth?: Bluetooth;
}

const bytesOf = (dv: DataView): Uint8Array => new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Delta decoder for HALO notifications; keeps the running sums between packets.
 * Returns µV per channel (empty for a footer-only packet), or null for a packet of an unexpected size.
 */
export class HaloDecoder {
  private accum = new Float64Array(RECORD);

  reset(): void { this.accum = new Float64Array(RECORD); }

  decode(data: Uint8Array): Record<EegChannel, Float64Array> | null {
    const body = data.length - FOOTER;
    if (body < 0 || body % RECORD !== 0) return null;
    const n = body / RECORD;
    const out = Object.fromEntries(EEG_CHANNELS.map(ch => [ch, new Float64Array(n)])) as Record<EegChannel, Float64Array>;
    for (let r = 0; r < n; r++) {
      const off = r * RECORD;
      for (let i = 0; i < RECORD; i++) {
        let d = data[off + i] < 128 ? data[off + i] : data[off + i] - 256;
        if (r === 0) d = Math.max(-127, Math.min(127, d));   // notification-rebase artefact
        this.accum[i] += d;
      }
      CH_BYTES.forEach((b, k) => { out[EEG_CHANNELS[k]][r] = this.accum[b] * EEG_SCALE_UV; });
    }
    return out;
  }
}

/** Emits 'change' whenever `info` changes. */
export class HaloDevice extends EventTarget {
  device: BluetoothDevice | null = null;
  private chars = new Map<string, BluetoothRemoteGATTCharacteristic>();
  private readonly decoder = new HaloDecoder();
  private chunks: Record<EegChannel, Float64Array>[] = [];
  private buffered = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private gen = 0;
  private connected = false;
  private streaming = false;
  private reconnecting = false;
  private resumeAfterReconnect = false;
  private userDisconnect = false;
  private model = 'HALO';
  private firmware = 'unknown';
  private hardware = 'unknown';
  private manufacturer = 'unknown';
  private battery: number | null = null;
  private packets = 0;
  private invalid = 0;
  private dropped = 0;
  private lastPacketAt: number | null = null;
  private readonly bufferSamples: number;
  private readonly reconnectDelays: number[];
  private readonly bt: Bluetooth | undefined;

  constructor(opts: HaloOptions = {}) {
    super();
    this.bufferSamples = opts.bufferSamples ?? EEG_SAMPLE_RATE * 300;
    this.reconnectDelays = opts.reconnectDelaysMs ?? [1000, 2000, 4000, 8000, 15000];
    this.bt = opts.bluetooth ?? (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined);
  }

  static supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  /** Show the browser's device chooser and connect. Must be called from a user gesture. */
  async request(): Promise<HaloInfo> {
    if (!this.bt) throw Object.assign(new Error(t('err.noBluetooth')), { name: 'NotSupportedError' });
    return this.connect(await this.bt.requestDevice(HALO_REQUEST_OPTIONS));
  }

  async connect(device: BluetoothDevice): Promise<HaloInfo> {
    if (this.device && this.device !== device) await this.disconnect();
    this.gen++;
    this.device = device;
    this.userDisconnect = false;
    this.reconnecting = false;
    this.resumeAfterReconnect = false;
    device.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
    device.addEventListener('gattserverdisconnected', this.onGattDisconnected);
    await this.setup();
    return this.info;
  }

  private op<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async setup(): Promise<void> {
    const server = await this.device!.gatt!.connect();
    const svc = await server.getPrimaryService(SVC_CONTROL);
    this.chars.clear();
    for (const uuid of Object.values(HALO_CHR)) this.chars.set(uuid, await svc.getCharacteristic(uuid));
    try {
      const dis = await server.getPrimaryService('device_information');
      const text = async (c: string) => new TextDecoder().decode(bytesOf(await (await dis.getCharacteristic(c)).readValue())).replace(/\0+$/, '').trim();
      this.model = await text('model_number_string').catch(() => 'HALO');
      this.firmware = await text('firmware_revision_string').catch(() => 'unknown');
      this.hardware = await text('hardware_revision_string').catch(() => 'unknown');
      this.manufacturer = await text('manufacturer_name_string').catch(() => 'unknown');
    } catch {
      // Device Information is optional
    }
    try {
      const bat = await (await server.getPrimaryService('battery_service')).getCharacteristic('battery_level');
      this.battery = bytesOf(await this.op(() => bat.readValue()))[0] ?? null;
      bat.removeEventListener('characteristicvaluechanged', this.onBattery);
      bat.addEventListener('characteristicvaluechanged', this.onBattery);
      await this.op(() => bat.startNotifications()).catch(() => undefined);
    } catch {
      // no Battery Service
    }
    this.connected = true;
    this.emit();
  }

  private onBattery = (e: Event): void => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (v) { this.battery = v.getUint8(0); this.emit(); }
  };

  private onData = (e: Event): void => {
    const samples = this.decoder.decode(bytesOf((e.target as BluetoothRemoteGATTCharacteristic).value!));
    if (!samples) {
      this.invalid++;
      return;
    }
    this.packets++;
    this.lastPacketAt = Date.now() / 1000;
    if (!samples.Fp1.length) return;
    this.chunks.push(samples);
    this.buffered += samples.Fp1.length;
    while (this.buffered > this.bufferSamples && this.chunks.length > 1) {
      const old = this.chunks.shift()!;
      this.buffered -= old.Fp1.length;
      this.dropped += old.Fp1.length;
    }
  };

  async startStream(): Promise<void> {
    const myGen = this.gen;
    const data = this.chars.get(HALO_CHR.data);
    if (!this.connected || !data) throw new Error(t('err.notConnected'));
    this.chunks = [];
    this.buffered = 0;
    this.decoder.reset();
    await this.op(() => this.chars.get(HALO_CHR.config)!.writeValueWithResponse(STREAM_CONFIG as BufferSource));
    data.removeEventListener('characteristicvaluechanged', this.onData);
    data.addEventListener('characteristicvaluechanged', this.onData);
    await this.op(() => data.startNotifications());
    await this.op(() => this.chars.get(HALO_CHR.command)!.writeValueWithResponse(Uint8Array.of(0x01) as BufferSource));
    if (myGen !== this.gen || !this.connected) return;   // disconnected while starting
    this.streaming = true;
    this.emit();
  }

  async stopStream(): Promise<void> {
    const cmd = this.chars.get(HALO_CHR.command), data = this.chars.get(HALO_CHR.data);
    if (cmd) await this.op(() => cmd.writeValueWithResponse(Uint8Array.of(0x00) as BufferSource)).catch(() => undefined);
    if (data) {
      await this.op(() => data.stopNotifications()).catch(() => undefined);
      data.removeEventListener('characteristicvaluechanged', this.onData);
    }
    this.streaming = false;
    this.emit();
  }

  async disconnect(): Promise<void> {
    this.gen++;
    this.userDisconnect = true;
    this.reconnecting = false;
    this.resumeAfterReconnect = false;
    if (this.device?.gatt?.connected && this.streaming) await this.stopStream();
    this.device?.gatt?.disconnect();
    this.connected = false;
    this.streaming = false;
    this.emit();
  }

  /** Return and clear the samples received since the last call (µV per channel). */
  drain(): Record<EegChannel, Float64Array> {
    const n = this.buffered;
    const out = Object.fromEntries(EEG_CHANNELS.map(ch => [ch, new Float64Array(n)])) as Record<EegChannel, Float64Array>;
    let off = 0;
    for (const c of this.chunks) {
      for (const ch of EEG_CHANNELS) out[ch].set(c[ch], off);
      off += c.Fp1.length;
    }
    this.chunks = [];
    this.buffered = 0;
    return out;
  }

  private onGattDisconnected = (): void => {
    if (this.streaming) this.resumeAfterReconnect = true;
    this.connected = false;
    this.streaming = false;
    this.emit();
    if (!this.userDisconnect && !this.reconnecting) void this.reconnect();
  };

  private async reconnect(): Promise<void> {
    const myGen = this.gen;
    this.reconnecting = true;
    this.emit();
    try {
      for (const delay of this.reconnectDelays) {
        await sleep(delay);
        if (myGen !== this.gen || this.userDisconnect || !this.device) return;
        try {
          await this.setup();
          if (this.userDisconnect) {
            this.device?.gatt?.disconnect();
            return;
          }
          if (myGen !== this.gen) return;
          if (this.resumeAfterReconnect) await this.startStream();
          this.resumeAfterReconnect = false;
          return;
        } catch {
          // out of range: try again after the next delay
        }
      }
    } finally {
      if (myGen === this.gen) {
        this.reconnecting = false;
        this.emit();
      }
    }
  }

  get isConnected(): boolean { return this.connected; }
  get isStreaming(): boolean { return this.streaming && this.connected; }

  get info(): HaloInfo {
    return {
      connected: this.connected, streaming: this.isStreaming, reconnecting: this.reconnecting,
      device_name: this.device?.name ?? null, id: this.device?.id ?? null, model: this.model, firmware: this.firmware,
      hardware: this.hardware, manufacturer: this.manufacturer, battery_percent: this.battery, packets: this.packets,
      packets_invalid: this.invalid, samples_dropped: this.dropped,
      data_stale: this.lastPacketAt !== null && Date.now() / 1000 - this.lastPacketAt > 3,
    };
  }

  private emit(): void { this.dispatchEvent(new Event('change')); }
}
