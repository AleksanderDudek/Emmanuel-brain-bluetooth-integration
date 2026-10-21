import { describe, expect, it, vi } from 'vitest';
import { HaloDecoder, HaloDevice, HALO_CHR, STREAM_CONFIG, SVC_CONTROL } from '../src/ble/halo';
import { sosfiltZi } from '../src/core/dsp';
import { EegDsp, detrend, iirnotch, welch } from '../src/core/eeg/dsp';
import { FeatureEngine, type FeatureResult } from '../src/core/eeg/features';
import { EEGSimulator } from '../src/core/eeg/simulator';
import { EEG_CHANNELS, type BandPowers, type EegChannel } from '../src/core/eeg/types';
import { EegEngine } from '../src/eeg-engine';
import { FakeChar, sleep } from './helpers';
import eegJson from './fixtures/eeg.json?raw';

// Fixtures: scripts/make_fixtures.py eeg (brainlink/dsp.py, features.py, halo_ble.py + SciPy)
interface Checkpoint { tick: number; len: number; tail: Record<EegChannel, number[]>; band_powers?: BandPowers; blinks?: number }
type FeatureCase = { t: number; band_powers: BandPowers; blinks: number } & FeatureResult;
const fx = JSON.parse(eegJson) as {
  notch_sos: number[][];
  welch: { x: number[]; freqs: number[]; psd: number[] }[];
  chunks: Record<EegChannel, number[]>[];
  checkpoints: Checkpoint[];
  features: FeatureCase[];
  halo: { packets: number[][]; outputs: Record<EegChannel, number[]>[] };
};

const close = (a: number, b: number, rel = 1e-9, abs = 1e-9) => Math.abs(a - b) <= abs + rel * Math.abs(b);

describe('EEG DSP (parity with brainlink/dsp.py)', () => {
  it('designs the 50 Hz notch like iirnotch + tf2sos', () => {
    const sos = iirnotch(50, 30, 250);
    sos[0].forEach((v, i) => expect(close(v, fx.notch_sos[0][i], 1e-12, 1e-14)).toBe(true));
  });

  it('computes Welch PSDs like scipy.signal.welch', () => {
    for (const c of fx.welch) {
      const { freqs, psd } = welch(c.x, 250, Math.min(128, c.x.length));
      expect(freqs.length).toBe(c.freqs.length);
      freqs.forEach((f, k) => expect(close(f, c.freqs[k])).toBe(true));
      psd.forEach((p, k) => expect(close(p, c.psd[k], 1e-8, 1e-12)).toBe(true));
    }
  });

  it('replays the server pipeline: buffers, band powers, blinks', () => {
    const dsp = new EegDsp();
    let checked = 0;
    fx.chunks.forEach((chunk, i) => {
      dsp.push(chunk);
      const cp = fx.checkpoints[i];
      expect(dsp.buffers.Fp1.length).toBe(cp.len);
      for (const ch of EEG_CHANNELS) {
        const tail = Array.from(dsp.buffers[ch].subarray(-8));
        tail.forEach((v, k) => expect(close(v, cp.tail[ch][k], 1e-8, 1e-8)).toBe(true));
      }
      expect(dsp.hasEnough()).toBe(!!cp.band_powers);
      if (cp.band_powers) {
        const bp = dsp.bandPowers();
        for (const ch of EEG_CHANNELS) {
          for (const [band, v] of Object.entries(cp.band_powers[ch])) expect(close(bp[ch][band as 'alpha'], v, 1e-7, 1e-9)).toBe(true);
        }
        expect(dsp.blinks()).toBe(cp.blinks);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(100);
  });

  it('keeps notch state continuous across chunks', () => {
    const zi = sosfiltZi(iirnotch(50, 30, 250));
    expect(zi).toHaveLength(1);
  });

  it('detrends like np.polyfit(t, w, 1)', () => {
    const y = detrend([1, 3, 5, 7, 9].map((v, i) => v + (i === 2 ? 2 : 0)));
    expect(y.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12);
    expect(detrend([2, 4, 6, 8]).every(v => Math.abs(v) < 1e-12)).toBe(true);
  });
});

describe('EEG metrics (parity with brainlink/features.py)', () => {
  it('normalises, smooths and detects combos the same way', () => {
    let t = 0;
    const eng = new FeatureEngine(() => t);
    const seen = new Set<string>();
    for (const c of fx.features) {
      t = c.t;
      const r = eng.compute(c.band_powers, c.blinks);
      for (const [k, v] of Object.entries(c.metrics)) expect(r.metrics[k as 'focus']).toBe(v);
      expect(r.active_combos).toEqual(c.active_combos);
      expect(r.combo_timers).toEqual(c.combo_timers);
      c.active_combos.forEach(x => seen.add(x));
    }
    expect([...seen].sort()).toEqual(['berserker', 'panic', 'super_flow', 'zen_heal']);
  });
});

describe('HALO decoder (parity with brainlink/halo_ble.py)', () => {
  it('delta-decodes packets, clamps the first record, skips bad sizes', () => {
    const dec = new HaloDecoder();
    fx.halo.packets.forEach((p, i) => {
      const out = dec.decode(Uint8Array.from(p));
      const exp = fx.halo.outputs[i];
      if (!out) {
        expect(exp.Fp1).toEqual([]);
        return;
      }
      for (const ch of EEG_CHANNELS) {
        expect(out[ch].length).toBe(exp[ch].length);
        out[ch].forEach((v, k) => expect(close(v, exp[ch][k], 1e-9, 1e-9)).toBe(true));
      }
    });
  });
});

describe('EEG simulator', () => {
  it('raises frontal beta/alpha in focus and occipital alpha with eyes closed', () => {
    const bp = (state: string) => {
      const sim = new EEGSimulator(7);
      sim.setState(state);
      sim.generate(500);   // let the blend settle
      const dsp = new EegDsp();
      for (let i = 0; i < 20; i++) dsp.push(sim.generate(25));
      return dsp.bandPowers();
    };
    const base = bp('baseline'), focus = bp('focus'), closed = bp('eyes_closed');
    const ratio = (b: BandPowers) => (b.Fp1.beta + b.Fp2.beta) / (b.Fp1.alpha + b.Fp2.alpha);
    expect(ratio(focus)).toBeGreaterThan(ratio(base) * 2);
    expect(closed.O1.alpha).toBeGreaterThan(base.O1.alpha * 3);
  });

  it('plays scenarios and loops them', () => {
    const sim = new EEGSimulator(1);
    sim.setState('auto:gaming_session');
    expect(sim.autoProgress?.current_state).toBe('baseline');
    for (let i = 0; i < 90; i++) sim.generate(25);   // 9 s: past the 8 s baseline step
    expect(sim.autoProgress?.step_idx).toBe(1);
    sim.setState('auto_stop');
    expect(sim.autoProgress).toBeNull();
  });
});

/** A HALO that answers the config/start writes with delta packets. */
function fakeHalo() {
  let timer: ReturnType<typeof setInterval> | null = null;
  const data = new FakeChar(HALO_CHR.data);
  const command = new FakeChar(HALO_CHR.command, b => {
    if (b[0] === 1 && !timer) timer = setInterval(() => data.notify(Uint8Array.from([...Array.from({ length: 60 }, (_, i): number => (i % 6 === 2 ? 3 : 0)), 15, 0, 0, 0, 0, 0])), 20);
    if (b[0] === 0 && timer) { clearInterval(timer); timer = null; }
  });
  const config = new FakeChar(HALO_CHR.config);
  const chars: Record<string, FakeChar> = { [HALO_CHR.data]: data, [HALO_CHR.command]: command, [HALO_CHR.config]: config };
  const svc = { getCharacteristic: async (u: string) => chars[u] };
  const battery = new FakeChar('battery_level', undefined, () => Uint8Array.of(77));
  const gatt = {
    connected: false,
    connect: async () => {
      gatt.connected = true;
      return {
        getPrimaryService: async (u: string) => {
          if (u === SVC_CONTROL) return svc;
          if (u === 'battery_service') return { getCharacteristic: async () => battery };
          throw new DOMException('no service', 'NotFoundError');
        },
      };
    },
    disconnect: () => { gatt.connected = false; if (timer) clearInterval(timer); timer = null; },
  };
  const device = Object.assign(new EventTarget(), { name: 'BA HALO 042', id: 'halo-1', gatt }) as unknown as BluetoothDevice;
  const bluetooth = { requestDevice: async () => device } as unknown as Bluetooth;
  return { bluetooth, chars, gatt };
}

describe('HaloDevice over (fake) Web Bluetooth', () => {
  it('configures, starts, decodes and stops the stream', async () => {
    const f = fakeHalo();
    const dev = new HaloDevice({ bluetooth: f.bluetooth });
    const info = await dev.request();
    expect(info.connected).toBe(true);
    expect(info.battery_percent).toBe(77);
    await dev.startStream();
    expect(Array.from(f.chars[HALO_CHR.config].writes[0])).toEqual(Array.from(STREAM_CONFIG));
    expect(Array.from(f.chars[HALO_CHR.command].writes[0])).toEqual([1]);
    await sleep(70);
    const d = dev.drain();
    expect(d.Fp1.length).toBeGreaterThanOrEqual(20);
    expect(d.Fp1[1] - d.Fp1[0]).toBeCloseTo(3 * 0.0671, 9);
    expect(d.Fp2.every(v => v === 0)).toBe(true);
    await dev.disconnect();
    expect(Array.from(f.chars[HALO_CHR.command].writes.at(-1)!)).toEqual([0]);
    expect(dev.info.streaming).toBe(false);
  });
});

describe('EegEngine', () => {
  it('runs the simulator through DSP and metrics', () => {
    let ms = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => ms);
    const eng = new EegEngine(new HaloDevice({ bluetooth: undefined }), new EEGSimulator(3, () => ms));
    eng.setSource('simulator');
    eng.setSimState('focus');
    let f = eng.tick();
    expect(f.ready).toBe(false);
    for (let i = 0; i < 30; i++) { ms += 100; f = eng.tick(); }
    expect(f.ready).toBe(true);
    expect(f.metrics?.focus).toBeGreaterThan(0.3);
    expect(f.preview?.Fp1.length).toBeGreaterThan(100);
    expect(f.contact.Fp1.label).toBe('good');
    expect(f.reliable).toBe(true);
    eng.setSource('off');
    expect(eng.tick().metrics).toBeNull();
    vi.restoreAllMocks();
  });
});
