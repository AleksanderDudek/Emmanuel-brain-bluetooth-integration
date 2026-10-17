/** Test doubles for Web Bluetooth: a fake Mendi that behaves like firmware 1.0.1. */
import { AFE_CONTROL1, AFE_TIMEREN, CHR, SVC_MENDI } from '../src/ble/mendi';
import { Frame, decodeSensor, encodeSensor } from '../src/core/proto';

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const toBytes = (v: BufferSource) => (v instanceof Uint8Array ? v : new Uint8Array(v as ArrayBuffer));

export class FakeChar extends EventTarget {
  value: DataView | null = null;
  notifying = false;
  writes: Uint8Array[] = [];
  constructor(readonly uuid: string, private readonly onWrite?: (b: Uint8Array) => void, private readonly reader?: () => Uint8Array) {
    super();
  }
  async startNotifications() { this.notifying = true; return this; }
  async stopNotifications() { this.notifying = false; return this; }
  failWrites = false;
  async writeValueWithResponse(v: BufferSource) {
    if (this.failWrites) throw new DOMException('GATT Server is disconnected.', 'NetworkError');
    const b = Uint8Array.from(toBytes(v));
    this.writes.push(b);
    this.onWrite?.(b);
  }
  async readValue() {
    if (!this.reader) throw new DOMException('GATT Protocol Error: Read Not Permitted', 'NotSupportedError');
    const b = this.reader();
    return new DataView(b.buffer);
  }
  notify(b: Uint8Array) {
    if (!this.notifying) return;
    this.value = new DataView(Uint8Array.from(b).buffer);
    this.dispatchEvent(new Event('characteristicvaluechanged'));
  }
}

/** Behaves like the real band on firmware 1.0.1: frames only after TIMEREN is set. */
export function fakeMendi({ streamsOnItsOwn = false } = {}) {
  const regs = new Map<number, number>([[AFE_CONTROL1, 0]]);
  let timer: ReturnType<typeof setInterval> | null = null;
  const startFrames = () => {
    if (timer) return;
    timer = setInterval(() => chars[CHR.frame].notify(new Frame({ ir_l: 50000, red_l: 30000, temp: 30 }).encode()), 10);
  };
  const stopFrames = () => { if (timer) clearInterval(timer); timer = null; };
  const chars: Record<string, FakeChar> = {
    [CHR.frame]: new FakeChar(CHR.frame),
    [CHR.adc]: new FakeChar(CHR.adc),
    [CHR.calibration]: new FakeChar(CHR.calibration),
    [CHR.diagnostics]: new FakeChar(CHR.diagnostics),   // notify-only, like fw 1.0.1
    [CHR.sensor]: new FakeChar(CHR.sensor, b => {
      const s = decodeSensor(b)!;
      if (s.read) {
        setTimeout(() => chars[CHR.sensor].notify(encodeSensor({ read: true, address: s.address, data: regs.get(s.address) ?? 0xffffff })), 1);
      } else {
        regs.set(s.address, s.data);
        if (s.address === AFE_CONTROL1) (s.data & AFE_TIMEREN ? startFrames : stopFrames)();
      }
    }),
  };
  const text = (t: string) => new TextEncoder().encode(t);
  const dis = {
    getCharacteristic: async (n: string) => new FakeChar(n, undefined, () => text(n === 'firmware_revision_string' ? '1.0.1' : 'r2.1b-ty1')),
  };
  const svc = { getCharacteristic: async (u: string) => { if (!chars[u]) throw new DOMException('nf', 'NotFoundError'); return chars[u]; } };
  const device = new EventTarget() as EventTarget & { name: string; id: string; gatt: unknown };
  const stats = { connectCalls: 0 };
  const gatt = {
    connected: false,
    connect: async () => {
      stats.connectCalls++;
      gatt.connected = true;
      setTimeout(() => chars[CHR.diagnostics].notify(Uint8Array.from([0x0a, 0x03, 0x08, 0xba, 0x1d, 0x10, 0x01, 0x18, 0x01])), 1);
      // like the hardware: the AFE keeps sampling while TIMEREN is set, also across reconnects
      if (streamsOnItsOwn || (regs.get(AFE_CONTROL1)! & AFE_TIMEREN)) setTimeout(startFrames, 1);
      return { getPrimaryService: async (u: string) => (u === SVC_MENDI ? svc : dis) };
    },
    disconnect: () => { gatt.connected = false; stopFrames(); },
  };
  Object.assign(device, { name: 'Mendi', id: 'dev-1', gatt });
  const drop = () => { gatt.connected = false; stopFrames(); device.dispatchEvent(new Event('gattserverdisconnected')); };
  /** Deliver `n` frame notifications right now (deterministic alternative to the 10 ms emitter). */
  const pushFrames = (n: number, init: Partial<Frame> = {}) => {
    for (let i = 0; i < n; i++) chars[CHR.frame].notify(new Frame({ ir_l: 50000, red_l: 30000, amb_l: 900, ir_r: 49000, red_r: 29000,
      amb_r: 950, ir_p: 61000, red_p: 38000, amb_p: 700, acc_z: 16384, temp: 33, ...init }).encode());
  };
  const bluetooth = { requestDevice: async () => device } as unknown as Bluetooth;
  return { device: device as unknown as BluetoothDevice, chars, regs, drop, stopFrames, pushFrames, bluetooth, stats };
}

