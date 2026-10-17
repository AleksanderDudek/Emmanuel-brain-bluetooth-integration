/**
 * Optional local-folder storage via the File System Access API
 * (Chrome/Edge desktop 86+, Chrome Android 132+; not Firefox/Safari).
 *
 * The directory handle is kept in IndexedDB.  Browsers re-ask for permission
 * after a restart, and `requestPermission` must run inside a user gesture,
 * so the UI calls `permission(true)` from a click.
 */
import type { SessionDB } from './db';
import { chunkToCsv, csvHeaderLine, fileNames, type Chunk, type SessionMeta } from './format';

const HANDLE_KEY = 'folder_handle';

export const folderSupported = (): boolean => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export type FolderPermission = PermissionState | 'none';

export class FolderStore {
  constructor(private readonly db: SessionDB) {}

  async getHandle(): Promise<FileSystemDirectoryHandle | null> {
    return (await this.db.getSetting<FileSystemDirectoryHandle>(HANDLE_KEY)) ?? null;
  }

  /** Let the user choose (or create) the sessions folder. Must be called from a user gesture. */
  async pick(): Promise<FileSystemDirectoryHandle> {
    const h = await window.showDirectoryPicker({ id: 'brainlink-sessions', mode: 'readwrite', startIn: 'documents' });
    await this.db.setSetting(HANDLE_KEY, h);
    return h;
  }

  async forget(): Promise<void> { await this.db.deleteSetting(HANDLE_KEY); }

  /** Current read-write permission; `request` prompts the user (needs a user gesture). */
  async permission(request = false): Promise<FolderPermission> {
    const h = await this.getHandle();
    if (!h) return 'none';
    const opts = { mode: 'readwrite' as const };
    let st = await h.queryPermission(opts);
    if (st === 'prompt' && request) st = await h.requestPermission(opts);
    return st;
  }

  private async granted(): Promise<FileSystemDirectoryHandle> {
    const h = await this.getHandle();
    if (!h) throw new Error('Nie wybrano folderu');
    if ((await h.queryPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Brak dostępu do folderu');
    return h;
  }

  /** Stream a session to `<id>_fnirs.csv` + `<id>_meta.json` (same format as the Python recorder). */
  async writeSession(meta: SessionMeta, forEachChunk: (visit: (c: Chunk) => Promise<void>) => Promise<void>): Promise<SessionMeta> {
    const dir = await this.granted();
    const names = fileNames(meta.session_id);
    const w = await (await dir.getFileHandle(names.csv, { create: true })).createWritable();
    try {
      await w.write(csvHeaderLine());
      await forEachChunk(async c => {
        const text = chunkToCsv(c);
        if (text) await w.write(text);
      });
      await w.close();   // the file appears atomically on close
    } catch (e) {
      await w.abort().catch(() => undefined);
      throw e;
    }
    const out: SessionMeta = { ...meta, storage: 'folder', in_browser: false, folder_files: names };
    await this.writeText(dir, names.meta, JSON.stringify(out, null, 2));
    return out;
  }

  /** Sessions found in the folder (also ones recorded by the Python server or another browser). */
  async listSessions(): Promise<SessionMeta[]> {
    const h = await this.getHandle();
    if (!h || (await h.queryPermission({ mode: 'read' })) !== 'granted') return [];
    const out: SessionMeta[] = [];
    for await (const [name, entry] of h.entries()) {
      if (entry.kind !== 'file' || !name.endsWith('_meta.json')) continue;
      try {
        const meta = JSON.parse(await (await (entry as FileSystemFileHandle).getFile()).text()) as SessionMeta;
        if (meta.modality !== 'fnirs' || !meta.session_id) continue;
        out.push({ ...meta, storage: 'folder', in_browser: false, folder_files: meta.folder_files ?? fileNames(meta.session_id) });
      } catch {
        // unreadable or foreign JSON: not ours, skip
      }
    }
    return out;
  }

  async readFile(name: string): Promise<File> {
    const h = await this.getHandle();
    if (!h) throw new Error('Nie wybrano folderu');
    return (await h.getFileHandle(name)).getFile();
  }

  async deleteSession(meta: SessionMeta): Promise<void> {
    const dir = await this.granted();
    const names = meta.folder_files ?? fileNames(meta.session_id);
    for (const n of [names.csv, names.meta]) await dir.removeEntry(n).catch(() => undefined);
  }

  get folderName(): Promise<string | null> {
    return this.getHandle().then(h => h?.name ?? null);
  }

  private async writeText(dir: FileSystemDirectoryHandle, name: string, text: string): Promise<void> {
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(text);
    await w.close();
  }
}
