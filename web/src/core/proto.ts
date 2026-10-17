/**
 * Minimal protobuf codec for the Mendi V4 BLE wire protocol.
 * TypeScript port of brainlink/mendi_proto.py (field numbers: see there and
 * device_v4.proto in https://github.com/eugenehp/mendi, MIT).
 *
 * Only the wire types the device uses are handled: varint (0), fixed64 (1,
 * skipped), length-delimited (2) and fixed32 (5).  int32 values arrive
 * sign-extended to 64 bits; only the low 32 bits matter, so varints are
 * accumulated as 32-bit integers.
 */

const WT_VARINT = 0;
const WT_I64 = 1;
const WT_LEN = 2;
const WT_I32 = 5;

export class ProtoDecodeError extends Error {}

interface Field {
  fnum: number;
  wtype: number;
  /** varint: low 32 bits (unsigned); fixed32 / len: the raw bytes */
  varint: number;
  bytes: Uint8Array;
}

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let lo = 0;
  for (let i = 0; i < 10; i++) {
    if (pos >= buf.length) throw new ProtoDecodeError('truncated varint');
    const b = buf[pos++];
    if (i < 5) lo |= (b & 0x7f) << (7 * i); // bits past 32 are dropped by the shift
    if (!(b & 0x80)) return [lo >>> 0, pos];
  }
  throw new ProtoDecodeError('varint too long');
}

function* iterFields(buf: Uint8Array): Generator<Field> {
  let pos = 0;
  const empty = new Uint8Array(0);
  while (pos < buf.length) {
    let key: number;
    [key, pos] = readVarint(buf, pos);
    const fnum = key >>> 3;
    const wtype = key & 7;
    if (fnum === 0) throw new ProtoDecodeError('field number 0');
    if (wtype === WT_VARINT) {
      let v: number;
      [v, pos] = readVarint(buf, pos);
      yield { fnum, wtype, varint: v, bytes: empty };
    } else if (wtype === WT_I32 || wtype === WT_I64) {
      const n = wtype === WT_I32 ? 4 : 8;
      if (pos + n > buf.length) throw new ProtoDecodeError(`truncated fixed${n * 8}`);
      yield { fnum, wtype, varint: 0, bytes: buf.subarray(pos, pos + n) };
      pos += n;
    } else if (wtype === WT_LEN) {
      let ln: number;
      [ln, pos] = readVarint(buf, pos);
      if (pos + ln > buf.length) throw new ProtoDecodeError('truncated length-delimited field');
      yield { fnum, wtype, varint: 0, bytes: buf.subarray(pos, pos + ln) };
      pos += ln;
    } else {
      throw new ProtoDecodeError(`unsupported wire type ${wtype}`);
    }
  }
}

const f32 = (b: Uint8Array): number => new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true);
const u32 = (b: Uint8Array): number => new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);

function encVarint(v: number | bigint): number[] {
  // Negative int32 → 10-byte two's-complement varint, as protobuf does
  let x = BigInt.asUintN(64, BigInt(v));
  const out: number[] = [];
  do {
    const b = Number(x & 0x7fn);
    x >>= 7n;
    out.push(x ? b | 0x80 : b);
  } while (x);
  return out;
}

const encKey = (fnum: number, wtype: number): number[] => encVarint((fnum << 3) | wtype);

function encF32(v: number): number[] {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return [...b];
}

function encU32(v: number): number[] {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v >>> 0, true);
  return [...b];
}

// ─── Frame (0xABB1) ──────────────────────────────────────────────────

export const FRAME_INT_FIELDS: Record<number, keyof FrameData> = {
  1: 'acc_x', 2: 'acc_y', 3: 'acc_z',
  4: 'ang_x', 5: 'ang_y', 6: 'ang_z',
  8: 'ir_l', 9: 'red_l', 10: 'amb_l',
  11: 'ir_r', 12: 'red_r', 13: 'amb_r',
  14: 'ir_p', 15: 'red_p', 16: 'amb_p',
};

export const ACCEL_SCALE_G = 2.0 / 32768.0; // ±2 g, int16
export const GYRO_SCALE_DPS = 125.0 / 32768.0; // ±125 °/s, int16

export interface FrameData {
  acc_x: number; acc_y: number; acc_z: number;
  ang_x: number; ang_y: number; ang_z: number;
  temp: number;
  ir_l: number; red_l: number; amb_l: number;
  ir_r: number; red_r: number; amb_r: number;
  ir_p: number; red_p: number; amb_p: number;
  /** host receive time in seconds (not on the wire) */
  timestamp: number;
}

export class Frame implements FrameData {
  acc_x = 0; acc_y = 0; acc_z = 0;
  ang_x = 0; ang_y = 0; ang_z = 0;
  temp = 0;
  ir_l = 0; red_l = 0; amb_l = 0;
  ir_r = 0; red_r = 0; amb_r = 0;
  ir_p = 0; red_p = 0; amb_p = 0;
  timestamp = 0;

  constructor(init: Partial<FrameData> = {}) {
    Object.assign(this, init);
  }

  get accel_g(): [number, number, number] {
    return [this.acc_x * ACCEL_SCALE_G, this.acc_y * ACCEL_SCALE_G, this.acc_z * ACCEL_SCALE_G];
  }

  get gyro_dps(): [number, number, number] {
    return [this.ang_x * GYRO_SCALE_DPS, this.ang_y * GYRO_SCALE_DPS, this.ang_z * GYRO_SCALE_DPS];
  }

  encode(): Uint8Array {
    const out: number[] = [];
    for (const [k, name] of Object.entries(FRAME_INT_FIELDS)) {
      const fnum = Number(k);
      if (fnum === 8 && this.temp) out.push(...encKey(7, WT_I32), ...encF32(this.temp)); // keep field order
      const v = this[name] as number;
      if (v) out.push(...encKey(fnum, WT_VARINT), ...encVarint(v));
    }
    return Uint8Array.from(out);
  }
}

/** Anything holding bytes: ArrayBuffer, typed array or DataView (also over a SharedArrayBuffer). */
export type Bytes = ArrayBufferLike | ArrayBufferView;

const toBytes = (data: Bytes): Uint8Array =>
  data instanceof Uint8Array ? data
    : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

/** Decode a Frame notification. Returns null if empty or corrupt (like the Mendi app). */
export function decodeFrame(data: Bytes): Frame | null {
  const buf = toBytes(data);
  if (!buf.length) return null;
  const f = new Frame();
  try {
    for (const fld of iterFields(buf)) {
      if (fld.fnum === 7 && fld.wtype === WT_I32) f.temp = f32(fld.bytes);
      else if (fld.fnum in FRAME_INT_FIELDS && fld.wtype === WT_VARINT) {
        (f as unknown as Record<string, number>)[FRAME_INT_FIELDS[fld.fnum]] = fld.varint | 0;
      }
    }
  } catch (e) {
    if (e instanceof ProtoDecodeError) return null;
    throw e;
  }
  return f;
}

// ─── Adc (0xABB4) / Diagnostics (0xABB5) ─────────────────────────────

export const ADC_V_MIN_MV = 3600; // same mapping as the Mendi app: 3.6 V → 0 %
export const ADC_V_MAX_MV = 4100; // 4.1 V → 100 %

export interface Adc { voltage: number; charging: boolean; usb: boolean; percent: number }

export function adcPercent(voltage: number): number {
  const pct = ((voltage - ADC_V_MIN_MV) * 100) / (ADC_V_MAX_MV - ADC_V_MIN_MV);
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function decodeAdc(data: Bytes): Adc | null {
  const a = { voltage: 0, charging: false, usb: false };
  try {
    for (const f of iterFields(toBytes(data))) {
      if (f.wtype !== WT_VARINT) continue;
      if (f.fnum === 1) a.voltage = f.varint;
      else if (f.fnum === 2) a.charging = f.varint !== 0;
      else if (f.fnum === 3) a.usb = f.varint !== 0;
    }
  } catch (e) {
    if (e instanceof ProtoDecodeError) return null;
    throw e;
  }
  return { ...a, percent: adcPercent(a.voltage) };
}

export interface Diagnostics { adc: Adc | null; imu_ok: boolean; sensor_ok: boolean }

export function decodeDiagnostics(data: Bytes): Diagnostics | null {
  const d: Diagnostics = { adc: null, imu_ok: false, sensor_ok: false };
  try {
    for (const f of iterFields(toBytes(data))) {
      if (f.fnum === 1 && f.wtype === WT_LEN) d.adc = decodeAdc(f.bytes);
      else if (f.fnum === 2 && f.wtype === WT_VARINT) d.imu_ok = f.varint !== 0;
      else if (f.fnum === 3 && f.wtype === WT_VARINT) d.sensor_ok = f.varint !== 0;
    }
  } catch (e) {
    if (e instanceof ProtoDecodeError) return null;
    throw e;
  }
  return d;
}

// ─── Calibration (0xABB6) ────────────────────────────────────────────

export interface Calibration {
  offset_l: number; offset_r: number; offset_p: number; // mA, ±127
  enable: boolean;
  low_power_mode: boolean;
}

export function encodeCalibration(c: Calibration): Uint8Array {
  const out: number[] = [];
  ([[1, c.offset_l], [2, c.offset_r], [3, c.offset_p]] as const).forEach(([fnum, v]) => {
    if (v) out.push(...encKey(fnum, WT_I32), ...encF32(v));
  });
  if (c.enable) out.push(...encKey(4, WT_VARINT), 1);
  if (c.low_power_mode) out.push(...encKey(5, WT_VARINT), 1);
  return Uint8Array.from(out);
}

export function decodeCalibration(data: Bytes): Calibration | null {
  const c: Calibration = { offset_l: 0, offset_r: 0, offset_p: 0, enable: false, low_power_mode: false };
  const names: Record<number, 'offset_l' | 'offset_r' | 'offset_p'> = { 1: 'offset_l', 2: 'offset_r', 3: 'offset_p' };
  try {
    for (const f of iterFields(toBytes(data))) {
      if (f.fnum in names && f.wtype === WT_I32) c[names[f.fnum]] = f32(f.bytes);
      else if (f.fnum === 4 && f.wtype === WT_VARINT) c.enable = f.varint !== 0;
      else if (f.fnum === 5 && f.wtype === WT_VARINT) c.low_power_mode = f.varint !== 0;
    }
  } catch (e) {
    if (e instanceof ProtoDecodeError) return null;
    throw e;
  }
  return c;
}

// ─── Sensor (0xABB2) ─────────────────────────────────────────────────

/** Optical-sensor register access: read=true asks for `address`, read=false writes `data` (24-bit). */
export interface Sensor { read: boolean; address: number; data: number }

export function encodeSensor(s: Partial<Sensor>): Uint8Array {
  const out: number[] = [];
  if (s.read) out.push(...encKey(1, WT_VARINT), 1);
  if (s.address) out.push(...encKey(2, WT_VARINT), ...encVarint(s.address));
  if (s.data) out.push(...encKey(3, WT_I32), ...encU32(s.data));
  return Uint8Array.from(out);
}

export function decodeSensor(data: Bytes): Sensor | null {
  const s: Sensor = { read: false, address: 0, data: 0 };
  try {
    for (const f of iterFields(toBytes(data))) {
      if (f.fnum === 1 && f.wtype === WT_VARINT) s.read = f.varint !== 0;
      else if (f.fnum === 2 && f.wtype === WT_VARINT) s.address = f.varint;
      else if (f.fnum === 3 && f.wtype === WT_I32) s.data = u32(f.bytes);
    }
  } catch (e) {
    if (e instanceof ProtoDecodeError) return null;
    throw e;
  }
  return s;
}

/** What the Mendi app sends (per upstream); on the wire a read / a zero-write of register 0. */
export const SENSOR_ENABLE_PAYLOAD = encodeSensor({ read: true });
export const SENSOR_DISABLE_PAYLOAD = encodeSensor({ read: false });
