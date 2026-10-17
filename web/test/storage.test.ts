import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { Frame } from '../src/core/proto';
import type { Derived, FNIRSConfig } from '../src/core/types';
import { SessionDB } from '../src/storage/db';
import { FolderStore } from '../src/storage/folder';
import { CSV_HEADER, chunkToCsv, packChunk } from '../src/storage/format';
import { SessionLibrary } from '../src/storage/library';
import { Recorder } from '../src/storage/recorder';

const CONFIG = { red_nm: 660, ir_nm: 850 } as unknown as FNIRSConfig;
let dbs: SessionDB[] = [];
let n = 0;

async function openDb(): Promise<SessionDB> {
  const db = await SessionDB.open(`test-${n++}`);
  dbs.push(db);
  return db;
}
afterEach(() => { dbs.forEach(d => d.close()); dbs = []; });

function frames(count: number, t0 = 1000): Frame[] {
  return Array.from({ length: count }, (_, i) => new Frame({
    timestamp: t0 + i / 30.6, ir_l: 50000 + i, red_l: 30000, amb_l: 900, ir_r: 49000, red_r: 29000, amb_r: 950,
    ir_p: 61000, red_p: 38000, amb_p: 700, acc_x: -10, acc_y: 16000, acc_z: 300, ang_x: 1, ang_y: -2, ang_z: 3, temp: 33.4567,
  }));
}

/** Feed `total` frames in batches of `batch` (like the 10 Hz engine); the first `nanFrames` have no derived values. */
function feed(rec: Recorder, total: number, batch = 5, nanFrames = 0): void {
  for (let i = 0; i < total; i += batch) {
    const k = Math.min(batch, total - i);
    const d = derived(k, Math.max(0, Math.min(k, nanFrames - i)));
    rec.add(frames(k, 1000 + i / 30.6), d);
  }
}

function derived(count: number, nanUntil = 0): Derived {
  const mk = (v: number) => Float64Array.from({ length: count }, (_, i) => (i < nanUntil ? Number.NaN : v + i * 1e-3));
  return { hbo_left: mk(0.123456789), hbr_left: mk(-0.05), hbo_right: mk(0.2), hbr_right: mk(-0.01) };
}

/** In-memory stand-in for a FileSystemDirectoryHandle. */
function memDir(perm: PermissionState = 'granted') {
  const files = new Map<string, string>();
  const fileHandle = (name: string) => ({
    kind: 'file' as const, name,
    getFile: async () => new File([files.get(name) ?? ''], name),
    createWritable: async () => {
      let buf = '';
      return { write: async (t: string) => { buf += t; }, close: async () => { files.set(name, buf); }, abort: async () => undefined };
    },
  });
  const dir = {
    kind: 'directory' as const, name: 'sesje',
    queryPermission: async () => perm,
    requestPermission: async () => perm,
    getFileHandle: async (name: string, opts?: { create?: boolean }) => {
      if (!files.has(name)) {
        if (!opts?.create) throw new DOMException('not found', 'NotFoundError');
        files.set(name, '');
      }
      return fileHandle(name);
    },
    removeEntry: async (name: string) => { files.delete(name); },
    async *entries() { for (const name of [...files.keys()]) yield [name, fileHandle(name)] as const; },
  };
  return { dir: dir as unknown as FileSystemDirectoryHandle, files };
}

class MemFolder extends FolderStore {
  constructor(db: SessionDB, private readonly h: FileSystemDirectoryHandle | null) { super(db); }
  override async getHandle() { return this.h; }
}

describe('format', () => {
  it('writes CSV rows like the Python recorder', () => {
    const c = packChunk('abc', 0, 10, frames(2), [[0.123456789, -0.05, 0.2, -0.01], [NaN, NaN, NaN, NaN]],
      [{ i: 1, label: 'a|b,c' }]);
    const lines = chunkToCsv(c).trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    const row = lines[0].split(',');
    expect(row).toHaveLength(CSV_HEADER.length);
    expect(row.slice(0, 3)).toEqual(['1000', '10', '50000']);
    expect(row[CSV_HEADER.indexOf('temp')]).toBe('33.457');
    expect(row[CSV_HEADER.indexOf('hbo_left')]).toBe('0.12346');
    expect(lines[1].endsWith(',,,,"a|b,c"')).toBe(true);   // NaN → empty, marker quoted
  });
});

describe('recorder + library', () => {
  it('records in chunks, joins markers, exports CSV', async () => {
    const db = await openDb();
    let now = 1_000_000;
    const rec = new Recorder(db, 50, () => now);
    await rec.start({ name: 'test', durationSec: 600, source: 'simulator', device: 'Simulator', config: CONFIG, sampleRate: 30.6, storage: 'browser' });
    expect(rec.mark('x')).not.toBeNull();
    rec.mark('y');
    feed(rec, 70, 5, 5);
    now += 2000;
    const meta = await rec.stop();
    expect(meta.sample_count).toBe(70);
    expect(meta.end_time).toBe(now / 1000);
    expect(meta.markers.map(m => m.label)).toEqual(['x', 'y']);
    expect(await db.countChunks(meta.session_id)).toBe(2);   // one full chunk of 50 + the rest at stop

    const lib = new SessionLibrary(db, new MemFolder(db, null));
    const csv = await (await lib.exportCsv(meta)).text();
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines).toHaveLength(71);
    expect(lines[1].endsWith(',,,,,x|y')).toBe(true);        // first frame: no derived yet, both markers
    expect(lines.slice(2).every(l => !l.endsWith('x|y'))).toBe(true);
    expect(lines[70].split(',')[1]).toBe('69');                // continuous sample_idx across chunks

    expect((await lib.list()).map(m => m.session_id)).toEqual([meta.session_id]);
    await lib.delete(meta);
    expect(await lib.list()).toEqual([]);
    expect(await db.countChunks(meta.session_id)).toBe(0);
  });

  it('refuses markers when idle and expires at the duration', async () => {
    const db = await openDb();
    let now = 0;
    const rec = new Recorder(db, 50, () => now);
    expect(rec.mark('early')).toBeNull();
    await rec.start({ name: 't', durationSec: 10, source: 's', device: 'd', config: CONFIG, sampleRate: 30.6, storage: 'browser' });
    expect(rec.expired).toBe(false);
    now = 10_500;
    expect(rec.expired).toBe(true);
    rec.add(frames(5), derived(5));   // ignored once expired
    expect((await rec.stop()).sample_count).toBe(0);
  });

  it('closes out sessions interrupted by a crash', async () => {
    const db = await openDb();
    const rec = new Recorder(db, 10, () => 5_000_000);
    await rec.start({ name: 'crash', durationSec: 600, source: 's', device: 'd', config: CONFIG, sampleRate: 30.6, storage: 'browser' });
    feed(rec, 25, 5);                           // two chunks of 10 flushed, five frames still in memory
    await new Promise(r => setTimeout(r, 50));  // let the writes land, then "crash"
    const lib = new SessionLibrary(db, new MemFolder(db, null));
    expect(await lib.recoverInterrupted()).toBe(1);
    const [m] = await db.listMeta();
    expect(m.sample_count).toBe(20);
    expect(m.end_time).toBeCloseTo(1000 + 19 / 30.6, 3);
    expect(m.notes).toContain('przerwane');
  });
});

describe('recorder edge cases', () => {
  const opts = { name: 'e', durationSec: 600, source: 's', device: 'd', config: CONFIG, sampleRate: 30.6, storage: 'browser' as const };

  it('refuses a second start immediately (double click)', async () => {
    const db = await openDb();
    const rec = new Recorder(db, 10);
    const first = rec.start(opts);
    await expect(rec.start(opts)).rejects.toThrow(/już trwa/);
    await first;
    await rec.stop();
    expect(await db.listMeta()).toHaveLength(1);
  });

  it('lets a new session start while the previous one is still being finalised', async () => {
    const db = await openDb();
    const rec = new Recorder(db, 10);
    await rec.start({ ...opts, name: 'one' });
    feed(rec, 12, 3);
    const stopping = rec.stop();
    await rec.start({ ...opts, name: 'two' });
    feed(rec, 6, 3);
    const one = await stopping;
    expect(one.name).toBe('one');
    expect(one.sample_count).toBe(12);
    expect(rec.meta?.name).toBe('two');
    const two = await rec.stop();
    expect(two.sample_count).toBe(6);
    expect(two.session_id).not.toBe(one.session_id);
  });

  it('keeps a marker set after the last frame', async () => {
    const db = await openDb();
    const rec = new Recorder(db, 100);
    await rec.start(opts);
    feed(rec, 9, 3);
    rec.mark('koniec');
    const meta = await rec.stop();
    const lib = new SessionLibrary(db, new MemFolder(db, null));
    const lines = (await (await lib.exportCsv(meta)).text()).trimEnd().split('\n');
    expect(lines[lines.length - 1].endsWith(',koniec')).toBe(true);
  });

  it('reports lost chunks instead of overstating the sample count', async () => {
    const db = await openDb();
    const rec = new Recorder(db, 10);
    await rec.start(opts);
    const put = db.putChunk.bind(db);
    let calls = 0;
    db.putChunk = async c => { if (++calls === 2) throw new DOMException('quota', 'QuotaExceededError'); return put(c); };
    feed(rec, 36, 3);                      // chunks of 12: the second one fails
    await rec.checkpoint();
    expect(rec.info().error).toMatch(/quota/);
    const meta = await rec.stop();
    expect(meta.sample_count).toBe(24);
    expect(meta.error).toMatch(/quota/);
    expect(meta.notes).toContain('niekompletne');
  });
});

describe('folder storage', () => {
  async function recorded(db: SessionDB, storage: 'browser' | 'folder' = 'folder') {
    const rec = new Recorder(db, 20, () => 7_000_000);
    await rec.start({ name: 'f', durationSec: 600, source: 's', device: 'Mendi', config: CONFIG, sampleRate: 30.6, storage });
    feed(rec, 45, 3);
    return rec.stop();
  }

  it('moves a finished session to the folder and frees the browser copy', async () => {
    const db = await openDb();
    const { dir, files } = memDir();
    const lib = new SessionLibrary(db, new MemFolder(db, dir));
    const meta = await recorded(db);
    const res = await lib.finalize(meta);
    expect(res.movedToFolder).toBe(true);
    expect(res.meta.in_browser).toBe(false);
    expect(await db.countChunks(meta.session_id)).toBe(0);
    const csv = files.get(`${meta.session_id}_fnirs.csv`)!;
    expect(csv.trimEnd().split('\n')).toHaveLength(46);
    expect(JSON.parse(files.get(`${meta.session_id}_meta.json`)!).sample_count).toBe(45);
    // still listed once, and exportable from the folder
    const list = await lib.list();
    expect(list).toHaveLength(1);
    expect(await (await lib.exportCsv(list[0])).text()).toBe(csv);
  });

  it('keeps the session in the browser when folder access is not granted', async () => {
    const db = await openDb();
    const { dir, files } = memDir('prompt');
    const lib = new SessionLibrary(db, new MemFolder(db, dir));
    const meta = await recorded(db);
    const res = await lib.finalize(meta);
    expect(res.movedToFolder).toBe(false);
    expect(res.error).toMatch(/dostępu/);
    expect(res.meta.in_browser).toBe(true);
    expect(await db.countChunks(meta.session_id)).toBeGreaterThan(0);
    expect(files.size).toBe(0);
  });

  it('lists sessions that exist only in the folder (e.g. recorded by the server)', async () => {
    const db = await openDb();
    const { dir, files } = memDir();
    files.set('deadbeef0001_meta.json', JSON.stringify({ session_id: 'deadbeef0001', modality: 'fnirs', name: 'serwer', start_time: 5 }));
    files.set('notes.json', '{"x": 1}');
    files.set('broken_meta.json', '{oops');
    const lib = new SessionLibrary(db, new MemFolder(db, dir));
    const list = await lib.list();
    expect(list.map(m => m.name)).toEqual(['serwer']);
    expect(list[0].in_browser).toBe(false);
  });
});
