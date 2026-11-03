/**
 * A small QR Code encoder (ISO/IEC 18004:2015, model 2, byte mode) for pairing: the laptop draws the phone's
 * local-network address (http://192.168.…:8420/…) as an SVG QR code, so pairing works offline and the address
 * is never sent to a third-party QR service.
 *
 * It follows the standard's encoding procedure (§7.1):
 *   1. data codewords: mode 0100, byte count, the UTF-8 bytes, terminator, pad bytes 0xEC 0x11 …   (§7.4)
 *   2. Reed–Solomon error correction for each block, then the blocks interleaved                   (§7.5, §7.6)
 *   3. function patterns, and the codewords placed in the two-column zigzag                         (§6.3, §7.7)
 *   4. all eight data masks scored with the four penalty rules; the lowest score wins               (§7.8)
 *   5. format information, and version information from version 7 on                                (§7.9, §7.10)
 *
 * The smallest version that fits is used.  There is no ECI header: URLs are ASCII, and phone readers detect
 * UTF-8 in byte mode anyway.  The output is plain data (`qrMatrix`) plus one SVG path (`qrPath`).
 */

export type Ecc = 'L' | 'M' | 'Q' | 'H';

/** Format-information bits of each error-correction level (§7.9.1). */
const ECC_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Error correction characteristics (Table 9), indexed by version − 1: ECC codewords per block, and number of blocks.
const ECC_PER_BLOCK: Record<Ecc, readonly number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
    28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
    26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30,
    28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28,
    30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const BLOCKS: Record<Ecc, readonly number[]> = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8,
    8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
    17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20,
    23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
    25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

/** The eight data masks (§7.8.2): a module of the encoding region at (row r, column c) is flipped where it holds. */
const MASKS: readonly ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  r => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

const sizeOf = (version: number): number => 17 + 4 * version;

/** Modules left for codewords (and 0–7 remainder bits) once the function patterns of `version` are drawn. */
const rawModules = (version: number): number => {
  let n = (16 * version + 128) * version + 64; // size² − finders with separators − timing − format info − dark module
  if (version >= 2) {
    const k = Math.floor(version / 7) + 2; // alignment patterns per row and column
    n -= (25 * k - 10) * k - 55; // k² − 3 patterns of 25 modules, less 5 for each of the 2(k − 2) on a timing pattern
    if (version >= 7) n -= 36; // two 6×3 version-information blocks
  }
  return n;
};

const dataCodewords = (version: number, ecc: Ecc): number =>
  (rawModules(version) >>> 3) - ECC_PER_BLOCK[ecc][version - 1] * BLOCKS[ecc][version - 1];

/** Most bytes a byte-mode segment can carry: 4 bits of mode and an 8-bit (16 from version 10) byte count first. */
const maxBytes = (version: number, ecc: Ecc): number => (dataCodewords(version, ecc) * 8 - 4 - (version < 10 ? 8 : 16)) >>> 3;

// GF(256) with the QR field polynomial x⁸ + x⁴ + x³ + x² + 1, as exp/log tables of α = 2 (EXP doubled to skip a mod 255).
const EXP = new Uint8Array(510);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = EXP[i + 255] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
}
const mul = (a: number, b: number): number => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** The Reed–Solomon generator ∏ (x − αⁱ), i < degree, as coefficients from the highest power down (leading 1 included). */
const rsGenerator = (degree: number): number[] => {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(g.length + 1).fill(0);
    g.forEach((coef, j) => {
      next[j] ^= coef; // g · x
      next[j + 1] ^= mul(coef, EXP[i]); // g · αⁱ (subtraction is XOR)
    });
    g = next;
  }
  return g;
};

/** The ECC codewords of one block: the remainder of data(x) · x^degree divided by the generator. */
const rsRemainder = (data: Uint8Array, gen: readonly number[]): number[] => {
  const rem = new Array<number>(gen.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ (rem.shift() ?? 0);
    rem.push(0);
    for (let j = 0; j < rem.length; j++) rem[j] ^= mul(gen[j + 1], factor);
  }
  return rem;
};

/** The data codewords: one byte-mode segment, the terminator, zero bits to a byte boundary, then pad bytes. */
const encodeData = (bytes: Uint8Array, version: number, ecc: Ecc): Uint8Array => {
  const out = new Uint8Array(dataCodewords(version, ecc));
  let bit = 0;
  const put = (value: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--, bit++) if ((value >>> i) & 1) out[bit >>> 3] |= 0x80 >>> (bit & 7);
  };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) put(byte, 8);
  // the terminator (up to four 0 bits) and the bits up to the next byte boundary are zeros already
  const start = Math.ceil(Math.min(bit + 4, out.length * 8) / 8);
  for (let i = start; i < out.length; i++) out[i] = (i - start) % 2 ? 0x11 : 0xec;
  return out;
};

/** The final codeword sequence (§7.6): data split into blocks, each with its ECC, both interleaved column by column. */
const interleave = (data: Uint8Array, version: number, ecc: Ecc): number[] => {
  const blocks = BLOCKS[ecc][version - 1];
  const eccLen = ECC_PER_BLOCK[ecc][version - 1];
  const total = rawModules(version) >>> 3;
  const short = blocks - (total % blocks); // the first `short` blocks have one data codeword less than the rest
  const shortLen = Math.floor(total / blocks) - eccLen;
  const gen = rsGenerator(eccLen);
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: number[][] = [];
  for (let b = 0, at = 0; b < blocks; b++) {
    const len = shortLen + (b < short ? 0 : 1);
    const block = data.subarray(at, at + len);
    at += len;
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, gen));
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen; i++) for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  for (let i = 0; i < eccLen; i++) for (const block of eccBlocks) out.push(block[i]);
  return out;
};

/** Centres of the alignment patterns along each axis (Annex E): 6, then evenly spaced back from size − 7. */
const alignmentCentres = (version: number): number[] => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2; // even; the gap next to 6 takes the slack
  const out = [6];
  for (let pos = sizeOf(version) - 7; out.length < count; pos -= step) out.splice(1, 0, pos);
  return out;
};

interface Grid {
  dark: boolean[][];
  /** function modules: never masked, skipped by the codeword placement */
  fixed: boolean[][];
}

/**
 * Finder patterns with separators, timing patterns and alignment patterns.  The format and version areas and
 * the dark module are reserved, but stay light until the mask is chosen: the procedure adds them after masking.
 */
const functionGrid = (version: number): Grid => {
  const n = sizeOf(version);
  const dark = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const fixed = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (r: number, c: number, d: boolean): void => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    dark[r][c] = d;
    fixed[r][c] = true;
  };
  for (let i = 0; i < n; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // 7×7 finders (rings at Chebyshev distance 0–3 from the centre: dark, dark, light, dark) and the light separator at 4
  for (const [r0, c0] of [[3, 3], [3, n - 4], [n - 4, 3]]) {
    for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      set(r0 + dr, c0 + dc, ring !== 2 && ring !== 4);
    }
  }
  const centres = alignmentCentres(version);
  const last = centres.length - 1;
  centres.forEach((r0, i) => centres.forEach((c0, j) => {
    if ((i === 0 && (j === 0 || j === last)) || (i === last && j === 0)) return; // these three sit on the finders
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) set(r0 + dr, c0 + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }));
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      set(8, i, false); // format information beside the top-left finder (around the timing modules at 6)…
      set(i, 8, false);
    }
    if (i < 8) {
      set(8, n - 1 - i, false); // …under the top-right finder…
      set(n - 1 - i, 8, false); // …and beside the bottom-left one, with the dark module at (n − 8, 8)
    }
  }
  if (version >= 7) for (let i = 0; i < 18; i++) {
    set(Math.floor(i / 3), n - 11 + (i % 3), false);
    set(n - 11 + (i % 3), Math.floor(i / 3), false);
  }
  return { dark, fixed };
};

/** Codeword bits, most significant first, in the zigzag (§7.7.3): upward and downward in two-column strips from the right. */
const placeCodewords = (grid: Grid, codewords: readonly number[]): void => {
  const n = grid.dark.length;
  let bit = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing pattern takes a whole column
    const upward = ((right + 1) & 2) === 0;
    for (let k = 0; k < n; k++) {
      const r = upward ? n - 1 - k : k;
      for (const c of [right, right - 1]) {
        if (grid.fixed[r][c]) continue;
        // past the last codeword come the remainder bits, which are 0
        grid.dark[r][c] = bit < codewords.length * 8 && ((codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
    }
  }
};

const FINDER_LIKE = [true, false, true, true, true, false, true];

/** Penalty rules 1 and 3 along one row or column. */
const linePenalty = (line: readonly boolean[]): number => {
  const n = line.length;
  let score = 0;
  // rule 1: a run of 5 + i modules of one colour scores 3 + i
  for (let i = 0, run = 0; i < n; i++) {
    run = i > 0 && line[i] === line[i - 1] ? run + 1 : 1;
    if (run === 5) score += 3;
    else if (run > 5) score += 1;
  }
  // rule 3: each dark-light-dark-dark-dark-light-dark with 4 light modules before or after it, the quiet zone counting
  // as light (Table 11 as ZXing and segno read it; python-qrcode only looks at 11-module windows inside the symbol)
  const light = (from: number, to: number): boolean => {
    for (let i = Math.max(from, 0); i < Math.min(to, n); i++) if (line[i]) return false;
    return true;
  };
  for (let i = 0; i + 7 <= n; i++) {
    let k = 0;
    while (k < 7 && line[i + k] === FINDER_LIKE[k]) k++;
    if (k === 7 && (light(i - 4, i) || light(i + 7, i + 11))) score += 40;
  }
  return score;
};

/** The penalty score of a masked symbol (§7.8.3.1, Table 11); the lowest score picks the mask. */
const penalty = (m: readonly boolean[][]): number => {
  const n = m.length;
  let score = 0;
  for (let i = 0; i < n; i++) score += linePenalty(m[i]) + linePenalty(m.map(row => row[i]));
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c]) dark++;
      // rule 2: every 2×2 block of one colour scores 3 (an m×n block thus 3·(m − 1)·(n − 1))
      if (r + 1 < n && c + 1 < n && m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
    }
  }
  // rule 4: 10 points for each full 5 % that the dark share is away from 50 % (n² is odd, so it never lands on a step)
  return score + 10 * Math.floor(Math.abs(20 * dark - 10 * n * n) / (n * n));
};

/** `value` followed by its n-bit BCH remainder modulo the generator `gen` (§7.9.1, §7.10). */
const bch = (value: number, gen: number, n: number): number => {
  let rem = value;
  for (let i = 0; i < n; i++) rem = (rem << 1) ^ ((rem >>> (n - 1)) * gen);
  return (value << n) | rem;
};

/** Format information (level, mask) in its two copies, plus the dark module. */
const drawFormat = (m: boolean[][], ecc: Ecc, mask: number): void => {
  const n = m.length;
  const bits = bch((ECC_BITS[ecc] << 3) | mask, 0x537, 10) ^ 0x5412; // the XOR keeps the word from being all light
  for (let i = 0; i < 15; i++) {
    const d = ((bits >>> i) & 1) === 1;
    // around the top-left finder: bits 0–7 down column 8, then 8–14 leftwards along row 8 (both skip the timing at 6)
    if (i < 6) m[i][8] = d;
    else if (i < 8) m[i + 1][8] = d;
    else if (i === 8) m[8][7] = d;
    else m[8][14 - i] = d;
    // the copy: bits 0–7 leftwards along row 8 under the top-right finder, 8–14 down column 8 by the bottom-left one
    if (i < 8) m[8][n - 1 - i] = d;
    else m[n - 15 + i][8] = d;
  }
  m[n - 8][8] = true;
};

/** Version information (version ≥ 7): 18 bits in a 6×3 block by the top-right finder, transposed by the bottom-left. */
const drawVersion = (m: boolean[][], version: number): void => {
  const n = m.length;
  const bits = bch(version, 0x1f25, 12);
  for (let i = 0; i < 18; i++) {
    const d = ((bits >>> i) & 1) === 1;
    m[Math.floor(i / 3)][n - 11 + (i % 3)] = d;
    m[n - 11 + (i % 3)][Math.floor(i / 3)] = d;
  }
};

const encode = (bytes: Uint8Array, ecc: Ecc, version: number, forcedMask?: number): boolean[][] => {
  const grid = functionGrid(version);
  placeCodewords(grid, interleave(encodeData(bytes, version, ecc), version, ecc));
  const masked = (mask: number): boolean[][] =>
    grid.dark.map((row, r) => row.map((d, c) => (grid.fixed[r][c] || !MASKS[mask](r, c) ? d : !d)));
  let mask = forcedMask ?? 0;
  if (forcedMask === undefined) {
    // scored as the procedure has it: after masking, before the format and version information are added
    let best = Infinity;
    for (let i = 0; i < MASKS.length; i++) {
      const score = penalty(masked(i));
      if (score < best) { // ties keep the lower mask
        best = score;
        mask = i;
      }
    }
  }
  const m = masked(mask);
  drawFormat(m, ecc, mask);
  if (version >= 7) drawVersion(m, version);
  return m;
};

/**
 * The QR code of `text` (UTF-8, byte mode) as rows of modules, `true` = dark, without the quiet zone.
 * Uses the smallest version that fits at level `ecc`; throws when even version 40 is too small.
 */
export function qrMatrix(text: string, ecc: Ecc = 'M'): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  for (let version = 1; version <= 40; version++) if (bytes.length <= maxBytes(version, ecc)) return encode(bytes, ecc, version);
  throw new Error(`QR code: ${bytes.length} bytes do not fit in version 40 at level ${ecc} (at most ${maxBytes(40, ecc)})`);
}

/** `qrMatrix` at a given version (1–40) and mask (0–7; omitted = the lowest-penalty one), for tests. */
export function qrMatrixWith(text: string, ecc: Ecc, version: number, mask?: number): boolean[][] {
  if (!Number.isInteger(version) || version < 1 || version > 40) throw new Error(`QR code: no version ${version} (1–40)`);
  if (mask !== undefined && !(Number.isInteger(mask) && mask >= 0 && mask < 8)) throw new Error(`QR code: no mask ${mask} (0–7)`);
  const bytes = new TextEncoder().encode(text);
  const max = maxBytes(version, ecc);
  if (bytes.length > max) {
    throw new Error(`QR code: ${bytes.length} bytes do not fit in version ${version} at level ${ecc} (at most ${max})`);
  }
  return encode(bytes, ecc, version, mask);
}

/**
 * The dark modules of `m` as one SVG path in module units, shifted by a light border of `quiet` modules (the
 * standard asks for 4).  Runs along a row are merged into one rectangle each.  Draw it as
 * `<svg viewBox="0 0 {size} {size}" shape-rendering="crispEdges"><path d="{d}"/></svg>` on a light background.
 */
export function qrPath(m: boolean[][], quiet = 4): { size: number; d: string } {
  let d = '';
  m.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let run = 1;
      while (row[c + run]) run++;
      d += `M${c + quiet} ${r + quiet}h${run}v1h-${run}z`;
      c += run - 1;
    }
  });
  return { size: m.length + 2 * quiet, d };
}
