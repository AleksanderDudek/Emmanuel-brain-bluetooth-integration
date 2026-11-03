import { describe, expect, it } from 'vitest';
import { qrMatrix, qrMatrixWith, qrPath, type Ecc } from '../src/cards/duo/qr';
import qrJson from './fixtures/qr.json?raw';

// Fixture: two independent encoders, byte mode, no ECI (the generator script is not kept in the repo).
//  - rows, versions and sweep digests: python-qrcode 8.2 — QRCode(version=v, error_correction=…, mask_pattern=m,
//    border=0), add_data(QRData(text.encode('utf-8'), mode=MODE_8BIT_BYTE)), make(fit=False); `version` is what
//    make(fit=True) picks.  segno 1.6.6 gives the same matrices at every forced mask.
//  - autoMask: segno's own mask choice, qrcodeMask: python-qrcode's (QRCode.best_mask_pattern).  segno 1.6.6 writes an
//    extra 0x00 codeword before the pad bytes in byte mode, so it was given the standard padding for this.
interface Case {
  name: string;
  text: string;
  ecc: Ecc;
  version: number;
  mask: number;
  autoMask: number;
  qrcodeMask: number;
  rows: string[];
}
/** One symbol per version and level, filled to capacity with `sweepText`, at a forced mask. */
interface SweepEntry { version: number; ecc: Ecc; mask: number; bytes: number; fnv: number }
const fx = JSON.parse(qrJson) as { generator: Record<string, string>; cases: Case[]; sweep: SweepEntry[] };

const rowsOf = (m: boolean[][]): string[] => m.map(row => row.map(d => (d ? '1' : '0')).join(''));

/** 32-bit FNV-1a of an ASCII string. */
const fnv1a = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
};

const SWEEP_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const sweepText = (version: number, n: number): string =>
  Array.from({ length: n }, (_, i) => SWEEP_ALPHABET[(7 * i + version) % 62]).join('');

/** The mask a matrix was drawn with: the forced-mask matrix it equals. */
const maskOf = (m: boolean[][], c: Case): number | undefined =>
  [0, 1, 2, 3, 4, 5, 6, 7].find(k => rowsOf(qrMatrixWith(c.text, c.ecc, c.version, k)).join() === rowsOf(m).join());

describe('QR code matrix (parity with python-qrcode and segno)', () => {
  it('matches python-qrcode module for module at a given version and mask', () => {
    for (const c of fx.cases) expect(rowsOf(qrMatrixWith(c.text, c.ecc, c.version, c.mask)), c.name).toEqual(c.rows);
  });

  it('picks the smallest version that fits, as python-qrcode does', () => {
    for (const c of fx.cases) expect(qrMatrix(c.text, c.ecc).length, c.name).toBe(17 + 4 * c.version);
  });

  // Rule 3 of Table 11 scores each dark-light-dark-dark-dark-light-dark pattern with 4 light modules before or after
  // it, the quiet zone counting as light; segno reads it so (as does ZXing), and its choice is the reference.  (segno
  // misses a pattern that overlaps the one before it, which happens rarely and changes none of these cases.)
  // python-qrcode scores rule 3 on 11-module windows inside the symbol instead: a pattern by the quiet zone never
  // counts, one with light on both sides counts twice.  Rules 1, 2 and 4 agree exactly (and all three encoders score
  // the symbol before the format and version information go in), but that one rule changes python-qrcode's pick for
  // about 4 texts in 10 — here in all but ascii-L, emoji-M and long-Q — so its matrices are compared only at forced
  // masks (above).
  it('picks the lowest-penalty mask, as segno does', () => {
    for (const c of fx.cases) expect(maskOf(qrMatrix(c.text, c.ecc), c), c.name).toBe(c.autoMask);
  });

  it('matches python-qrcode at every version and level, filled to capacity', () => {
    expect(fx.sweep).toHaveLength(160);
    for (const s of fx.sweep) {
      const text = sweepText(s.version, s.bytes);
      const what = `version ${s.version}-${s.ecc}`;
      expect(fnv1a(rowsOf(qrMatrixWith(text, s.ecc, s.version, s.mask)).join('\n')), what).toBe(s.fnv);
      expect(() => qrMatrixWith(`${text}0`, s.ecc, s.version), what).toThrow(/do not fit/);
    }
  });

  it('counts UTF-8 bytes, not characters', () => {
    // 'ż' is two bytes: 13 of them fill version 2-M (26 bytes), 14 need version 3
    expect(qrMatrix('ż'.repeat(13), 'M')).toHaveLength(25);
    expect(qrMatrix('ż'.repeat(14), 'M')).toHaveLength(29);
  });

  it('throws when the text does not fit in version 40', () => {
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      const max = fx.sweep.find(s => s.version === 40 && s.ecc === ecc)!.bytes;
      expect(qrMatrix('x'.repeat(max), ecc)).toHaveLength(177);
      expect(() => qrMatrix('x'.repeat(max + 1), ecc)).toThrow(`QR code: ${max + 1} bytes do not fit in version 40 at level ${ecc}`);
    }
    expect(() => qrMatrix('ż'.repeat(1166))).toThrow(/2332 bytes/); // 2331 is the most at level M
  });

  it('rejects a version or mask out of range', () => {
    expect(() => qrMatrixWith('a', 'M', 0)).toThrow(/no version 0/);
    expect(() => qrMatrixWith('a', 'M', 41)).toThrow(/no version 41/);
    expect(() => qrMatrixWith('a', 'M', 1, 8)).toThrow(/no mask 8/);
    expect(() => qrMatrixWith('a', 'M', 1, 1.5)).toThrow(/no mask 1.5/);
  });
});

describe('QR code SVG path', () => {
  /** Paint the path's rectangles into a size × size grid; every module must be painted at most once. */
  const paint = (d: string, size: number): boolean[][] => {
    const grid = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    const rect = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g;
    expect(d.replace(rect, '')).toBe(''); // nothing but rectangles
    for (const [, x, y, w, back] of d.matchAll(rect)) {
      expect(back).toBe(w);
      for (let i = 0; i < Number(w); i++) {
        expect(grid[Number(y)][Number(x) + i]).toBe(false);
        grid[Number(y)][Number(x) + i] = true;
      }
    }
    return grid;
  };

  it('covers exactly the dark modules, offset by the quiet zone', () => {
    const m = qrMatrix('http://192.168.1.20:8420/app/pad.html#r=K7QM&v=relay');
    const dark = m.flat().filter(Boolean).length;
    for (const quiet of [4, 0, 2]) {
      const { size, d } = qrPath(m, quiet);
      expect(size).toBe(m.length + 2 * quiet);
      const grid = paint(d, size);
      expect(grid.flat().filter(Boolean).length).toBe(dark);
      const shifted = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => m[y - quiet]?.[x - quiet] === true));
      expect(grid).toEqual(shifted);
    }
  });

  it('merges each horizontal run of dark modules into one rectangle', () => {
    const m = qrMatrix('Zażółć gęślą jaźń', 'Q');
    const runs = m.reduce((n, row) => n + row.filter((d, c) => d && !row[c - 1]).length, 0);
    expect(qrPath(m).d.match(/M/g)).toHaveLength(runs);
  });
});
