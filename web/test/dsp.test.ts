import { describe, expect, it } from 'vitest';
import {
  CausalFilter, butter, findPeaks, mean, pyRound, sosfilt, sosfiltZi, sosfiltfilt, std, type Sos,
} from '../src/core/dsp';
import { DEFAULT_FNIRS_CONFIG, bandpassSos, hemoSos } from '../src/core/pipeline';
import dspJson from './fixtures/dsp.json?raw';

// Fixtures: scripts/make_fixtures.py (SciPy is the reference)
interface Stage { order: number; wn: number | [number, number]; btype: 'low' | 'high' | 'band' }
interface FilterCase {
  name: string;
  fs: number;
  stages: Stage[];
  sos: number[][];
  zi: number[][];
  padlen: number;
  x: number[];
  sosfilt: number[];
  sosfilt_zf: number[][];
  sosfilt_zi: number[];
  sosfilt_zi_zf: number[][];
  sosfiltfilt: number[];
  sosfiltfilt_short: number[];
}
interface PeakCase { name: string; x: number[]; distance: number | null; prominence: number | null; indices: number[] }
const fixture = JSON.parse(dspJson) as { filters: FilterCase[]; peaks: PeakCase[]; round: [number, number, number][] };

const SIGNAL_TOL = 1e-8;
const COEFF_TOL = 1e-12;

/** Largest absolute difference; lengths must match. */
function maxAbsError(actual: ArrayLike<number>, expected: ArrayLike<number>): number {
  expect(actual.length).toBe(expected.length);
  let err = 0;
  for (let i = 0; i < expected.length; i++) err = Math.max(err, Math.abs(actual[i] - expected[i]));
  return err;
}

/** Matrix comparison scaled by magnitude (coefficients span 1e-4 … 3). */
function expectMatrixClose(actual: number[][], expected: number[][], tol: number, what: string): void {
  expect(actual.length, what).toBe(expected.length);
  actual.forEach((row, i) => {
    expect(row.length, what).toBe(expected[i].length);
    row.forEach((v, j) => {
      const e = expected[i][j];
      expect(Math.abs(v - e), `${what}[${i}][${j}] = ${v}, expected ${e}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(e)));
    });
  });
}

const design = (stages: Stage[]): Sos => stages.flatMap(s => butter(s.order, s.wn, s.btype));
const scaled = (zi: number[][], k: number): number[][] => zi.map(r => r.map(v => v * k));

describe('butter / sosfilt / sosfiltfilt parity with SciPy', () => {
  for (const c of fixture.filters) {
    describe(c.name, () => {
      const sos = design(c.stages);

      it('designs the same sections (pairing, ordering, gain)', () => {
        expectMatrixClose(sos, c.sos, COEFF_TOL, 'sos');
        expectMatrixClose(sosfiltZi(sos), c.zi, 1e-10, 'zi');
      });

      it('sosfilt from rest and from the steady state', () => {
        const rest = sosfilt(sos, c.x);
        expect(maxAbsError(rest.y, c.sosfilt)).toBeLessThan(SIGNAL_TOL);
        expectMatrixClose(rest.zf, c.sosfilt_zf, 1e-9, 'zf');
        const steady = sosfilt(sos, c.x, scaled(sosfiltZi(sos), c.x[0]));
        expect(maxAbsError(steady.y, c.sosfilt_zi)).toBeLessThan(SIGNAL_TOL);
        expectMatrixClose(steady.zf, c.sosfilt_zi_zf, 1e-9, 'zf');
      });

      it('sosfiltfilt, including the minimum length', () => {
        expect(maxAbsError(sosfiltfilt(sos, c.x), c.sosfiltfilt)).toBeLessThan(SIGNAL_TOL);
        const short = c.x.slice(0, c.padlen + 1);
        expect(maxAbsError(sosfiltfilt(sos, short), c.sosfiltfilt_short)).toBeLessThan(SIGNAL_TOL);
        expect(() => sosfiltfilt(sos, c.x.slice(0, c.padlen))).toThrow(RangeError);
        expect(() => sosfiltfilt(sos, c.x.slice(0, c.padlen))).toThrow(`which is ${c.padlen}`);
      });

      it('CausalFilter streams in chunks like one steady-state sosfilt call', () => {
        const f = new CausalFilter(sos);
        const parts: number[] = [];
        for (let i = 0, k = 0; i < c.x.length; k++) {
          const n = [1, 3, 0, 7, 2, 30][k % 6];
          parts.push(...f.process(c.x.slice(i, i + n)));
          i += n;
        }
        expect(maxAbsError(parts, c.sosfilt_zi)).toBeLessThan(SIGNAL_TOL);
      });
    });
  }

  it('the pipeline builds the SciPy sections it was designed with', () => {
    for (const fs of [30.6, 25.0]) {
      const byName = (name: string) => fixture.filters.find(c => c.name === `${name}@${fs.toFixed(1)}`)!.sos;
      expectMatrixClose(hemoSos(DEFAULT_FNIRS_CONFIG, fs), byName('hemo_lp'), COEFF_TOL, 'hemo lp');
      expectMatrixClose(hemoSos({ ...DEFAULT_FNIRS_CONFIG, hp_hz: 0.01 }, fs), byName('hemo_hp'), COEFF_TOL, 'hemo hp');
      expectMatrixClose(bandpassSos(0.7, 3.5, fs, 3), byName('band_0.7-3.5'), COEFF_TOL, 'heart band');
      expectMatrixClose(bandpassSos(0.5, 2.5, fs, 3), byName('band_0.5-2.5'), COEFF_TOL, 'SCI band');
    }
  });
});

describe('butter', () => {
  it('has unit DC gain (low-pass) and zero DC gain (high-pass, band-pass)', () => {
    const dcGain = (sos: Sos) => sos.reduce((g, r) => g * (r[0] + r[1] + r[2]) / (r[3] + r[4] + r[5]), 1);
    expect(dcGain(butter(3, 0.1, 'low'))).toBeCloseTo(1, 12);
    expect(dcGain(butter(1, 0.01, 'high'))).toBe(0);
    expect(Math.abs(dcGain(butter(3, [0.05, 0.2], 'band')))).toBeLessThan(1e-12);
  });

  it('rejects invalid critical frequencies and orders like SciPy', () => {
    expect(() => butter(3, 1.0, 'low')).toThrow('Digital filter critical frequencies must be 0 < Wn < 1');
    expect(() => butter(3, 0, 'low')).toThrow('filter critical frequencies must be greater than 0');
    expect(() => butter(3, Number.NaN, 'low')).toThrow('greater than 0');
    expect(() => butter(3, [0.3, 0.2], 'band')).toThrow('Wn[0] must be less than Wn[1]');
    expect(() => butter(3, 0.2, 'band')).toThrow('start and stop frequencies');
    expect(() => butter(3, [0.1, 0.2], 'low')).toThrow('single critical frequency');
    expect(() => butter(2.5, 0.2, 'low')).toThrow('nonnegative integer');
  });
});

describe('findPeaks parity with SciPy', () => {
  for (const c of fixture.peaks) {
    it(c.name, () => {
      const opts = { distance: c.distance ?? undefined, prominence: c.prominence ?? undefined };
      expect(findPeaks(c.x, opts)).toEqual(c.indices);
    });
  }

  it('applies distance before prominence, as SciPy does', () => {
    // Peak 3 sits on the shoulder of peak 7 (prominence 0.2) but is taller than peak 1:
    // the distance rule removes 1 first, then the prominence rule removes 3 (SciPy → [7])
    const x = [0, 2, 0, 5, 4.8, 6, 8, 10, 0];
    expect(findPeaks(x, { distance: 3 })).toEqual([3, 7]);
    expect(findPeaks(x, { prominence: 1 })).toEqual([1, 7]);
    expect(findPeaks(x, { distance: 3, prominence: 1 })).toEqual([7]);
  });

  it('rejects distance < 1', () => {
    expect(() => findPeaks([0, 1, 0], { distance: 0.5 })).toThrow('`distance` must be greater or equal to 1');
  });
});

describe('numeric helpers', () => {
  it("pyRound matches Python's round() (exact value, ties to even)", () => {
    let mismatches = 0;
    for (const [x, nd, expected] of fixture.round) {
      if (pyRound(x, nd) !== expected) mismatches++;
    }
    expect(mismatches).toBe(0);
    expect([pyRound(0.125, 2), pyRound(2.675, 2), pyRound(0.15, 1), pyRound(1.0005, 3), pyRound(0.0005, 3)])
      .toEqual([0.12, 2.67, 0.1, 1.0, 0.001]);
    expect(pyRound(Number.NaN, 2)).toBeNaN();
  });

  it('mean and population std', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(std([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(1.25), 15);
  });
});
