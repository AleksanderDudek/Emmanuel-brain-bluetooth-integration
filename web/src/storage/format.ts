/**
 * Session data format, shared with the Python recorder (brainlink/fnirs_recorder.py):
 * same CSV columns and rounding, same metadata keys, so files recorded in the
 * browser open in the same analysis scripts as server recordings.
 *
 * In IndexedDB a session is a metadata record plus chunks of typed arrays
 * (~88 bytes per frame, ≈ 9.7 MB per hour at 30.6 Hz).
 */
import type { Frame } from '../core/proto';
import type { FNIRSConfig } from '../core/types';

export const RAW_INT_FIELDS = [
  'ir_l', 'red_l', 'amb_l', 'ir_r', 'red_r', 'amb_r', 'ir_p', 'red_p', 'amb_p',
  'acc_x', 'acc_y', 'acc_z', 'ang_x', 'ang_y', 'ang_z',
] as const;
export const RAW_FIELDS = [...RAW_INT_FIELDS, 'temp'] as const;
export const DERIVED_FIELDS = ['hbo_left', 'hbr_left', 'hbo_right', 'hbr_right'] as const;
export const CSV_HEADER = ['timestamp', 'sample_idx', ...RAW_FIELDS, ...DERIVED_FIELDS, 'marker'];

export interface Marker { label: string; time: number; t_sec: number }

export type StorageTarget = 'browser' | 'folder';

export interface SessionMeta {
  session_id: string;
  modality: 'fnirs';
  device: string;
  name: string;
  source: string;
  duration_sec: number;
  start_time: number;          // epoch seconds
  end_time: number | null;
  sample_count: number;
  columns: string[];
  pipeline_config: FNIRSConfig;
  markers: Marker[];
  notes: string;
  // web-only
  sample_rate: number;
  storage: StorageTarget;
  /** chunks still in IndexedDB (false once moved to a folder) */
  in_browser: boolean;
  folder_files?: { csv: string; meta: string };
  app: string;
}

/** One block of consecutive frames. */
export interface Chunk {
  session_id: string;
  seq: number;
  start_idx: number;
  n: number;
  t: Float64Array;             // timestamps, epoch seconds
  raw: Int32Array;             // n × RAW_INT_FIELDS
  temp: Float32Array;          // n
  derived: Float32Array;       // n × DERIVED_FIELDS, NaN while the baseline is collected
  markers: { i: number; label: string }[];
}

/** Pack frames (with their per-frame derived values, NaN = none yet) into a chunk. */
export function packChunk(sessionId: string, seq: number, startIdx: number, frames: Frame[],
                          derivedRows: ArrayLike<number>[], markers: { i: number; label: string }[]): Chunk {
  const n = frames.length, nr = RAW_INT_FIELDS.length, nd = DERIVED_FIELDS.length;
  const t = new Float64Array(n), raw = new Int32Array(n * nr), temp = new Float32Array(n);
  const derived = new Float32Array(n * nd).fill(Number.NaN);
  frames.forEach((f, i) => {
    t[i] = f.timestamp;
    for (let j = 0; j < nr; j++) raw[i * nr + j] = f[RAW_INT_FIELDS[j]];
    temp[i] = f.temp;
    const d = derivedRows[i];
    if (d) for (let j = 0; j < nd; j++) derived[i * nd + j] = d[j];
  });
  return { session_id: sessionId, seq, start_idx: startIdx, n, t, raw, temp, derived, markers };
}

const r = (v: number, d: number) => {
  const p = 10 ** d;
  return Math.round(v * p) / p;
};
const csvField = (s: string) => (/[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);

/** CSV rows for one chunk (no header), formatted like the Python recorder. */
export function chunkToCsv(c: Chunk): string {
  const marks = new Map(c.markers.map(m => [m.i, m.label]));
  const nr = RAW_INT_FIELDS.length, nd = DERIVED_FIELDS.length;
  const lines: string[] = [];
  for (let i = 0; i < c.n; i++) {
    const row: (string | number)[] = [r(c.t[i], 4), c.start_idx + i];
    for (let j = 0; j < nr; j++) row.push(c.raw[i * nr + j]);
    row.push(r(c.temp[i], 3));
    for (let j = 0; j < nd; j++) {
      const v = c.derived[i * nd + j];
      row.push(Number.isNaN(v) ? '' : r(v, 5));
    }
    row.push(csvField(marks.get(i) ?? ''));
    lines.push(row.join(','));
  }
  return lines.length ? lines.join('\n') + '\n' : '';
}

export const csvHeaderLine = () => CSV_HEADER.join(',') + '\n';

export function newSessionId(): string {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');   // 12 hex chars, like the server
}

export const fileNames = (id: string) => ({ csv: `${id}_fnirs.csv`, meta: `${id}_meta.json` });
