import { describe, expect, it } from 'vitest';
import {
  Frame, SENSOR_DISABLE_PAYLOAD, SENSOR_ENABLE_PAYLOAD, adcPercent, decodeAdc, decodeCalibration,
  decodeDiagnostics, decodeFrame, decodeSensor, encodeCalibration, encodeSensor,
} from '../src/core/proto';

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map(b => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map(x => x.toString(16).padStart(2, '0')).join('');

describe('Frame', () => {
  it('round-trips negative and large values', () => {
    const f = new Frame({ acc_x: -1234, acc_y: 5, acc_z: 16384, ang_x: -1, temp: 33.25, ir_l: 52000, red_l: 31000,
      amb_l: 900, ir_r: 49000, red_r: -7, amb_r: 0, ir_p: 551911, red_p: 38000, amb_p: 700 });
    const g = decodeFrame(f.encode())!;
    for (const k of ['acc_x', 'acc_y', 'acc_z', 'ang_x', 'ir_l', 'red_l', 'amb_l', 'ir_r', 'red_r', 'amb_r', 'ir_p', 'red_p', 'amb_p'] as const) {
      expect(g[k], k).toBe(f[k]);
    }
    expect(g.temp).toBeCloseTo(33.25, 5);
  });

  it('decodes hand-encoded bytes (10-byte negative varint, float, varint)', () => {
    const data = Uint8Array.from([0x08, ...Array(9).fill(0xff), 0x01, 0x3d, 0, 0, 0xc0, 0x3f, 0x40, 0xac, 0x02]);
    const f = decodeFrame(data)!;
    expect([f.acc_x, f.temp, f.ir_l]).toEqual([-1, 1.5, 300]);
  });

  it('rejects empty and corrupt payloads', () => {
    expect(decodeFrame(new Uint8Array())).toBeNull();
    expect(decodeFrame(Uint8Array.from([0x40]))).toBeNull();
    expect(decodeFrame(Uint8Array.from([0x3d, 0, 0]))).toBeNull();
  });

  it('skips unknown fields', () => {
    expect(decodeFrame(Uint8Array.from([0x40, 0x05, 0xa8, 0x06, 0x07]))!.ir_l).toBe(5);
  });

  it('decodes a real Mendi notification (fw 1.0.1, hw r2.1b-ty1)', () => {
    const f = decodeFrame(hex(
      '08809cffffffffffffff011090d2ffffffffffffff0118bda9ffffffffffffff0120861e28dfe5ff' +
      'ffffffffffff0130aaf8ffffffffffffff013d00809841408eeb0348d3b10150880b58b9d10260a1' +
      '860168e02470e7d7217887b1148001ff08'))!;
    expect([f.acc_x, f.acc_y, f.acc_z]).toEqual([-12800, -5872, -11075]);
    expect([f.ang_x, f.ang_y, f.ang_z]).toEqual([3846, -3361, -982]);
    expect(f.temp).toBeCloseTo(19.0625, 6);
    expect([f.ir_l, f.red_l, f.amb_l]).toEqual([62862, 22739, 1416]);
    expect([f.ir_r, f.red_r, f.amb_r]).toEqual([43193, 17185, 4704]);
    expect([f.ir_p, f.red_p, f.amb_p]).toEqual([551911, 333959, 1151]);
    expect(Math.hypot(...f.accel_g)).toBeCloseTo(1.09, 1);
  });

  it('matches the Python encoder byte for byte', () => {
    // bytes from brainlink.mendi_proto.Frame(acc_x=-1, temp=1.5, ir_l=300).encode()
    expect(toHex(new Frame({ acc_x: -1, temp: 1.5, ir_l: 300 }).encode()))
      .toBe('08ffffffffffffffffff013d0000c03f40ac02');
  });
});

describe('status messages', () => {
  it('decodes ADC and diagnostics, including the real ones', () => {
    const a = decodeAdc(Uint8Array.from([0x08, 0xb6, 0x1b, 0x10, 0x01]))!;
    expect(a).toMatchObject({ voltage: 3510, charging: true, usb: false, percent: 0 });
    expect(adcPercent(3850)).toBe(50);
    expect(decodeAdc(hex('08b91d'))!.voltage).toBe(3769);
    const d = decodeDiagnostics(hex('0a0308ba1d10011801'))!;
    expect(d.imu_ok && d.sensor_ok).toBe(true);
    expect(d.adc!.voltage).toBe(3770);
  });

  it('round-trips calibration and sensor messages', () => {
    const c = decodeCalibration(encodeCalibration({ offset_l: 1.5, offset_r: -2, offset_p: 0, enable: true, low_power_mode: false }))!;
    expect(c).toEqual({ offset_l: 1.5, offset_r: -2, offset_p: 0, enable: true, low_power_mode: false });
    const s = decodeSensor(encodeSensor({ read: false, address: 0x11, data: 0xabcdef }))!;
    expect(s).toEqual({ read: false, address: 0x11, data: 0xabcdef });
    expect(toHex(SENSOR_ENABLE_PAYLOAD)).toBe('0801');
    expect(SENSOR_DISABLE_PAYLOAD.length).toBe(0);
    // reply the real band sent to the enable payload, and the TIMEREN write used to wake it
    expect(decodeSensor(hex('08011dffffff00'))).toEqual({ read: true, address: 0, data: 0xffffff });
    expect(toHex(encodeSensor({ read: false, address: 0x1e, data: 0x000100 }))).toBe('101e1d00010000');
  });
});
