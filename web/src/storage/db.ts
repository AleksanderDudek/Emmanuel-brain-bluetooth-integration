/**
 * IndexedDB access: session metadata, recorded chunks and small settings.
 *
 * IndexedDB is available in every target browser (incl. iOS Safari), stores
 * typed arrays natively and survives crashes chunk by chunk, so it is the
 * default home for sessions and the journal for everything being recorded.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Chunk, SessionMeta } from './format';

interface BrainLinkDB extends DBSchema {
  sessions: { key: string; value: SessionMeta; indexes: { by_start: number } };
  chunks: { key: [string, number]; value: Chunk; indexes: { by_session: string } };
  settings: { key: string; value: unknown };
}

export class SessionDB {
  private constructor(private readonly db: IDBPDatabase<BrainLinkDB>) {}

  static async open(name = 'brainlink'): Promise<SessionDB> {
    const db = await openDB<BrainLinkDB>(name, 1, {
      upgrade(d) {
        d.createObjectStore('sessions', { keyPath: 'session_id' }).createIndex('by_start', 'start_time');
        d.createObjectStore('chunks', { keyPath: ['session_id', 'seq'] }).createIndex('by_session', 'session_id');
        d.createObjectStore('settings');
      },
    });
    return new SessionDB(db);
  }

  close(): void { this.db.close(); }

  // ── sessions ─────────────────────────────────────────────────────
  putMeta(meta: SessionMeta): Promise<string> { return this.db.put('sessions', meta); }
  getMeta(id: string): Promise<SessionMeta | undefined> { return this.db.get('sessions', id); }

  async listMeta(): Promise<SessionMeta[]> {
    return (await this.db.getAllFromIndex('sessions', 'by_start')).reverse();   // newest first
  }

  async deleteSession(id: string): Promise<void> {
    const tx = this.db.transaction(['sessions', 'chunks'], 'readwrite');
    await tx.objectStore('sessions').delete(id);
    await tx.objectStore('chunks').delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    await tx.done;
  }

  // ── chunks ───────────────────────────────────────────────────────
  putChunk(chunk: Chunk): Promise<[string, number]> { return this.db.put('chunks', chunk); }

  /** Visit a session's chunks in order without loading them all into memory. */
  async forEachChunk(id: string, visit: (c: Chunk) => void | Promise<void>): Promise<void> {
    let seq = 0;
    for (;;) {
      // one short transaction per chunk: awaiting `visit` inside a cursor would let the transaction expire
      const c = await this.db.get('chunks', IDBKeyRange.bound([id, seq], [id, Number.MAX_SAFE_INTEGER]));
      if (!c) return;
      await visit(c);
      seq = c.seq + 1;
    }
  }

  async countChunks(id: string): Promise<number> {
    return this.db.countFromIndex('chunks', 'by_session', id);
  }

  async deleteChunks(id: string): Promise<void> {
    await this.db.delete('chunks', IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
  }

  // ── settings ─────────────────────────────────────────────────────
  async getSetting<T>(key: string): Promise<T | undefined> { return (await this.db.get('settings', key)) as T | undefined; }
  async setSetting(key: string, value: unknown): Promise<void> { await this.db.put('settings', value, key); }
  async deleteSetting(key: string): Promise<void> { await this.db.delete('settings', key); }
}

export interface StorageInfo { usage: number | null; quota: number | null; persisted: boolean | null }

export async function storageInfo(): Promise<StorageInfo> {
  const s = navigator.storage;
  if (!s) return { usage: null, quota: null, persisted: null };
  const [est, persisted] = await Promise.all([
    s.estimate ? s.estimate().catch(() => ({} as StorageEstimate)) : Promise.resolve({} as StorageEstimate),
    s.persisted ? s.persisted().catch(() => null) : Promise.resolve(null),
  ]);
  return { usage: est.usage ?? null, quota: est.quota ?? null, persisted };
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
