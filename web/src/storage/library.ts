/**
 * The session library: one list over the browser (IndexedDB) and the optional
 * local folder, plus export, move-to-folder, delete and crash recovery.
 */
import type { SessionDB } from './db';
import type { FolderStore } from './folder';
import { chunkToCsv, csvHeaderLine, type SessionMeta } from './format';
import { t } from '../i18n/signal';

export class SessionLibrary {
  constructor(private readonly db: SessionDB, private readonly folder: FolderStore) {}

  /** Browser sessions plus folder sessions not already known (newest first). */
  async list(): Promise<SessionMeta[]> {
    const local = await this.db.listMeta();
    const known = new Set(local.map(m => m.session_id));
    const inFolder = (await this.folder.listSessions().catch(() => [])).filter(m => !known.has(m.session_id));
    return [...local, ...inFolder].sort((a, b) => b.start_time - a.start_time);
  }

  async exportCsv(meta: SessionMeta): Promise<Blob> {
    if (meta.in_browser) {
      const parts: string[] = [csvHeaderLine()];
      await this.db.forEachChunk(meta.session_id, c => { parts.push(chunkToCsv(c)); });
      return new Blob(parts, { type: 'text/csv' });
    }
    return this.folder.readFile(meta.folder_files!.csv);
  }

  metaJson(meta: SessionMeta): Blob {
    return new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
  }

  /** Write a browser session to the folder, then free the browser copy of its frames. */
  async moveToFolder(meta: SessionMeta): Promise<SessionMeta> {
    const written = await this.folder.writeSession(meta, visit => this.db.forEachChunk(meta.session_id, visit));
    await this.db.putMeta(written);          // keep the entry so the list shows where it went
    await this.db.deleteChunks(meta.session_id);
    return written;
  }

  /** After a recording: honour the chosen target; keep it in the browser if the folder is not writable. */
  async finalize(meta: SessionMeta): Promise<{ meta: SessionMeta; movedToFolder: boolean; error?: string }> {
    if (meta.storage !== 'folder') return { meta, movedToFolder: false };
    try {
      if ((await this.folder.permission(false)) !== 'granted') {
        return { meta, movedToFolder: false, error: t('folder.keptInBrowser') };
      }
      return { meta: await this.moveToFolder(meta), movedToFolder: true };
    } catch (e) {
      return { meta, movedToFolder: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async delete(meta: SessionMeta): Promise<void> {
    if (!meta.in_browser || meta.storage === 'folder') await this.folder.deleteSession(meta).catch(() => undefined);
    await this.db.deleteSession(meta.session_id);
  }

  /** Sessions left without an end time by a crash or a closed tab: close them out. */
  async recoverInterrupted(activeId: string | null = null): Promise<number> {
    let fixed = 0;
    for (const m of await this.db.listMeta()) {
      if (m.end_time !== null || m.session_id === activeId || !m.in_browser) continue;
      let count = 0, last = m.start_time;
      await this.db.forEachChunk(m.session_id, c => {
        count += c.n;
        if (c.n) last = c.t[c.n - 1];
      });
      await this.db.putMeta({ ...m, end_time: last, sample_count: count, notes: (m.notes ? m.notes + ' ' : '') + t('rec.interrupted') });
      fixed++;
    }
    return fixed;
  }
}

/** Trigger a download of a Blob (works in every browser, incl. iOS Safari). */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
