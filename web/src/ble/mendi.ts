/**
 * Web Bluetooth adapter for the Mendi fNIRS headband.
 * Port of brainlink/mendi_ble.py; protocol from the reverse-engineered client
 * github.com/eugenehp/mendi (MIT) plus what was found on real hardware:
 *
 *  - firmware 1.0.1 leaves the optical front-end's timing engine off, so after
 *    subscribing only one self-test frame arrives.  If no frames flow within
 *    `graceMs`, set TIMEREN in register 0x1E (TI AFE4404-style layout) and put
 *    the original value back on stop.  The setting survives a disconnect and
 *    would drain the battery, so the original value is also persisted (per
 *    device) before the write and restored on the next connection if the
 *    tab was closed or crashed while the sensor was woken.
 *  - Diagnostics (0xABB5) is notify-only on that firmware.
 *
 * GATT operations are serialised: Chromium rejects overlapping ones.  A
 * generation counter, bumped by connect()/disconnect(), stops stale reconnect
 * loops from touching a newer connection.  The Nordic DFU service is
 * deliberately not requested (never write to it).
 */
import {
  SENSOR_DISABLE_PAYLOAD, SENSOR_ENABLE_PAYLOAD, decodeAdc, decodeCalibration, decodeDiagnostics, decodeFrame,
  decodeSensor, encodeCalibration, encodeSensor, type Adc, type Calibration, type Diagnostics, type Frame, type Sensor,
} from '../core/proto';
import { t } from '../i18n/signal';

export const mendiUuid = (short: number): string => `fc3e${short.toString(16).padStart(4, '0')}-c6c4-49e6-922a-6e551c455af5`;
export const SVC_MENDI = mendiUuid(0xabb0);
export const CHR = {
  frame: mendiUuid(0xabb1),
  sensor: mendiUuid(0xabb2),
  imu: mendiUuid(0xabb3),
  adc: mendiUuid(0xabb4),
  diagnostics: mendiUuid(0xabb5),
  calibration: mendiUuid(0xabb6),
} as const;
export const AFE_CONTROL1 = 0x1e;
export const AFE_TIMEREN = 0x000100;

export const REQUEST_OPTIONS: RequestDeviceOptions = {
  filters: [{ namePrefix: 'Mendi' }, { services: [SVC_MENDI] }],
  optionalServices: [SVC_MENDI, 'device_information'],
};

export interface MendiInfo {
  connected: boolean;
  streaming: boolean;
  reconnecting: boolean;
  device_name: string | null;
  id: string | null;
  model: 'Mendi';
  firmware: string;
  hardware: string;
  battery: Adc | null;
  diagnostics: { imu_ok: boolean; sensor_ok: boolean; voltage_mv: number | null } | null;
  calibration: Calibration | null;
  frames_dropped: number;
  frames_invalid: number;
  data_stale: boolean;
  sensor_woken: boolean;
}

/** Where the pre-wake CONTROL1 value is kept between page loads (per device id). */
export interface AfeMemory {
  get(deviceId: string): number | null;
  set(deviceId: string, value: number): void;
  clear(deviceId: string): void;
}

export const localAfeMemory: AfeMemory = {
  get(id) {
    try {
      const v = localStorage.getItem(`brainlink.afe.${id}`);
      return v === null ? null : Number(v);
    } catch {
      return null;
    }
  },
  set(id, value) { try { localStorage.setItem(`brainlink.afe.${id}`, String(value)); } catch { /* storage blocked */ } },
  clear(id) { try { localStorage.removeItem(`brainlink.afe.${id}`); } catch { /* storage blocked */ } },
};

export interface MendiOptions {
  bufferFrames?: number;
  graceMs?: number;
  reconnectDelaysMs?: number[];
  bluetooth?: Bluetooth;
  afeMemory?: AfeMemory;
}

const bytesOf = (dv: DataView): Uint8Array => new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Emits 'change' whenever `info` changes (connect, battery, stream state, …). */
export class MendiDevice extends EventTarget {
  device: BluetoothDevice | null = null;
  private chars = new Map<string, BluetoothRemoteGATTCharacteristic>();
  private listeners = new Map<string, EventListener>();
  private frames: Frame[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private gen = 0;
  private connected = false;
  private streaming = false;
  private reconnecting = false;
  private resumeAfterReconnect = false;
  private userDisconnect = false;
  private firmware = 'unknown';
  private hardware = 'unknown';
  private battery: Adc | null = null;
  private diagnostics: MendiInfo['diagnostics'] = null;
  private calibration: Calibration | null = null;
  private dropped = 0;
  private invalid = 0;
  private frameTotal = 0;
  private lastFrameAt: number | null = null;
  private afeRestore: number | null = null;
  private sensorWoken = false;
  private sensorReply: { address: number; resolve: (s: Sensor) => void } | null = null;
  private readonly bufferFrames: number;
  private readonly graceMs: number;
  private readonly reconnectDelays: number[];
  private readonly bt: Bluetooth | undefined;
  private readonly afeMemory: AfeMemory;

  constructor(opts: MendiOptions = {}) {
    super();
    // 5 min at ~31 Hz: hidden tabs get their timers throttled hard, and the engine drains on a timer
    this.bufferFrames = opts.bufferFrames ?? 31 * 300;
    this.graceMs = opts.graceMs ?? 1000;
    this.reconnectDelays = opts.reconnectDelaysMs ?? [1000, 2000, 4000, 8000, 15000];
    this.bt = opts.bluetooth ?? (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined);
    this.afeMemory = opts.afeMemory ?? localAfeMemory;
  }

  static supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  /** Show the browser's device chooser and connect. Must be called from a user gesture. */
  async request(): Promise<MendiInfo> {
    if (!this.bt) throw Object.assign(new Error(t('err.noBluetooth')), { name: 'NotSupportedError' });
    const device = await this.bt.requestDevice(REQUEST_OPTIONS);
    return this.connect(device);
  }

  async connect(device: BluetoothDevice): Promise<MendiInfo> {
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
    const svc = await server.getPrimaryService(SVC_MENDI);
    this.chars.clear();
    for (const uuid of Object.values(CHR)) {
      try {
        this.chars.set(uuid, await svc.getCharacteristic(uuid));
      } catch {
        // characteristic missing on this firmware
      }
    }
    try {
      const dis = await server.getPrimaryService('device_information');
      const text = async (c: string) => new TextDecoder().decode(bytesOf(await (await dis.getCharacteristic(c)).readValue())).replace(/\0+$/, '').trim();
      this.firmware = await text('firmware_revision_string').catch(() => 'unknown');
      this.hardware = await text('hardware_revision_string').catch(() => 'unknown');
    } catch {
      // Device Information is optional
    }
    const subs: [string, (b: Uint8Array) => void][] = [
      [CHR.adc, b => { const a = decodeAdc(b); if (a) { this.battery = a; this.emit(); } }],
      [CHR.calibration, b => { const c = decodeCalibration(b); if (c) { this.calibration = c; this.emit(); } }],
      [CHR.sensor, b => this.onSensor(b)],
      [CHR.diagnostics, b => this.onDiagnostics(b)],
    ];
    for (const [uuid, handler] of subs) {
      const ch = this.chars.get(uuid);
      if (!ch) continue;
      // after a reconnect Chromium may hand back the same objects: never stack listeners
      const old = this.listeners.get(uuid);
      if (old) ch.removeEventListener('characteristicvaluechanged', old);
      const listener: EventListener = e => handler(bytesOf((e.target as BluetoothRemoteGATTCharacteristic).value!));
      this.listeners.set(uuid, listener);
      try {
        ch.addEventListener('characteristicvaluechanged', listener);
        await this.op(() => ch.startNotifications());
      } catch {
        // notify not permitted on this characteristic
      }
    }
    const diag = this.chars.get(CHR.diagnostics);
    if (diag) await this.op(() => diag.readValue()).then(v => this.onDiagnostics(bytesOf(v))).catch(() => undefined);  // fw 1.0.1: notify-only
    this.connected = true;
    await this.restoreLeftoverWake();
    this.emit();
  }

  /** A previous page (closed tab, crash) woke the sensor and never put it back: do it now. */
  private async restoreLeftoverWake(): Promise<void> {
    const id = this.device?.id;
    if (!id || this.afeRestore !== null) return;
    const original = this.afeMemory.get(id);
    if (original === null) return;
    const ctrl1 = await this.readSensorReg(AFE_CONTROL1);
    if (ctrl1 === null) return;   // try again next time
    if (ctrl1 & AFE_TIMEREN && !(original & AFE_TIMEREN)) {
      try {
        await this.writeSensor(encodeSensor({ read: false, address: AFE_CONTROL1, data: original }));
      } catch {
        return;
      }
    }
    this.afeMemory.clear(id);
  }

  private onDiagnostics(b: Uint8Array): void {
    const d: Diagnostics | null = decodeDiagnostics(b);
    if (!d) return;
    this.diagnostics = { imu_ok: d.imu_ok, sensor_ok: d.sensor_ok, voltage_mv: d.adc?.voltage ?? null };
    if (d.adc && !this.battery) this.battery = d.adc;
    this.emit();
  }

  private onSensor(b: Uint8Array): void {
    const s = decodeSensor(b);
    if (s && this.sensorReply && s.address === this.sensorReply.address) {
      this.sensorReply.resolve(s);
      this.sensorReply = null;
    }
  }

  private onFrame = (e: Event): void => {
    const f = decodeFrame(bytesOf((e.target as BluetoothRemoteGATTCharacteristic).value!));
    if (!f) {
      this.invalid++;
      return;
    }
    f.timestamp = Date.now() / 1000;
    if (this.frames.length >= this.bufferFrames) {
      this.frames.shift();
      this.dropped++;
    }
    this.frames.push(f);
    this.lastFrameAt = f.timestamp;
    this.frameTotal++;
  };

  async startStream(): Promise<void> {
    const myGen = this.gen;
    const ch = this.chars.get(CHR.frame);
    if (!this.connected || !ch) throw new Error(t('err.notConnected'));
    this.frames = [];
    ch.removeEventListener('characteristicvaluechanged', this.onFrame);
    ch.addEventListener('characteristicvaluechanged', this.onFrame);
    await this.op(() => ch.startNotifications());
    await this.writeSensor(SENSOR_ENABLE_PAYLOAD).catch(() => undefined);  // what the app sends; harmless if refused
    await this.wakeSensor();
    if (myGen !== this.gen || !this.connected) return;   // disconnected while starting
    this.streaming = true;
    this.emit();
  }

  /** Start the optical front-end if the firmware left it idle (see the module comment). */
  private async wakeSensor(): Promise<void> {
    const n0 = this.frameTotal;
    await sleep(this.graceMs);
    if (this.frameTotal - n0 >= 5) return;          // streams on its own: leave its registers alone
    const ctrl1 = await this.readSensorReg(AFE_CONTROL1);
    if (ctrl1 === null || ctrl1 & AFE_TIMEREN) return;
    // remember the original before writing, so even a drop mid-write can be undone
    this.afeRestore ??= ctrl1;
    if (this.device?.id) this.afeMemory.set(this.device.id, this.afeRestore);
    await this.writeSensor(encodeSensor({ read: false, address: AFE_CONTROL1, data: ctrl1 | AFE_TIMEREN }));
    this.sensorWoken = true;
  }

  /** Put CONTROL1 back. Keeps the pending value if the write fails, so a later attempt can retry. */
  private async restoreAfe(): Promise<void> {
    if (this.afeRestore === null) return;
    try {
      await this.writeSensor(encodeSensor({ read: false, address: AFE_CONTROL1, data: this.afeRestore }));
      this.afeRestore = null;
      if (this.device?.id) this.afeMemory.clear(this.device.id);
    } catch {
      // link gone: the persisted value lets the next connection finish the job
    }
  }

  private async readSensorReg(address: number, timeoutMs = 1000): Promise<number | null> {
    const reply = new Promise<Sensor>(resolve => { this.sensorReply = { address, resolve }; });
    try {
      await this.writeSensor(encodeSensor({ read: true, address }));
      const s = await Promise.race([reply, sleep(timeoutMs).then(() => null)]);
      return s ? s.data : null;
    } catch {
      return null;
    } finally {
      this.sensorReply = null;
    }
  }

  private writeSensor(payload: Uint8Array): Promise<void> {
    const ch = this.chars.get(CHR.sensor);
    if (!ch) return Promise.reject(new Error('no sensor characteristic'));
    return this.op(() => ch.writeValueWithResponse(payload as BufferSource));
  }

  async stopStream(): Promise<void> {
    const ch = this.chars.get(CHR.frame);
    await this.restoreAfe();   // the setting survives a disconnect; leaving it on drains the battery
    await this.writeSensor(SENSOR_DISABLE_PAYLOAD).catch(() => undefined);
    if (ch) {
      await this.op(() => ch.stopNotifications()).catch(() => undefined);
      ch.removeEventListener('characteristicvaluechanged', this.onFrame);
    }
    this.streaming = false;
    this.emit();
  }

  async setCalibration(c: Calibration): Promise<void> {
    const ch = this.chars.get(CHR.calibration);
    if (!ch) throw new Error(t('err.notConnected'));
    await this.op(() => ch.writeValueWithResponse(encodeCalibration(c) as BufferSource));
  }

  async disconnect(): Promise<void> {
    this.gen++;
    this.userDisconnect = true;
    this.reconnecting = false;
    this.resumeAfterReconnect = false;
    if (this.device?.gatt?.connected) {
      if (this.streaming) await this.stopStream();
      else await this.restoreAfe();   // e.g. disconnect during the wake grace period
    }
    this.device?.gatt?.disconnect();
    this.connected = false;
    this.streaming = false;
    this.emit();
  }

  /** Return and clear the frames received since the last call. */
  drain(): Frame[] {
    const out = this.frames;
    this.frames = [];
    return out;
  }

  private onGattDisconnected = (): void => {
    if (this.streaming) this.resumeAfterReconnect = true;
    this.connected = false;
    this.streaming = false;
    this.sensorReply = null;
    this.emit();
    // one loop at a time: a drop during a reconnect attempt just makes that attempt fail
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
          if (myGen !== this.gen) return;   // a newer connect() owns the device now
          // TIMEREN survives the drop, so the stream usually resumes without a new wake;
          // afeRestore still holds the original value for stopStream()
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

  get info(): MendiInfo {
    return {
      connected: this.connected, streaming: this.isStreaming, reconnecting: this.reconnecting,
      device_name: this.device?.name ?? null, id: this.device?.id ?? null, model: 'Mendi',
      firmware: this.firmware, hardware: this.hardware, battery: this.battery, diagnostics: this.diagnostics,
      calibration: this.calibration, frames_dropped: this.dropped, frames_invalid: this.invalid,
      data_stale: this.lastFrameAt !== null && Date.now() / 1000 - this.lastFrameAt > 3,
      sensor_woken: this.sensorWoken,
    };
  }

  private emit(): void { this.dispatchEvent(new Event('change')); }
}
