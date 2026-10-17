/** Sessions tab: everything saved in the browser and in the chosen folder. */
import type { SessionMeta } from '../storage/format';
import { folderSupported, type FolderStore } from '../storage/folder';
import { download, type SessionLibrary } from '../storage/library';
import { $, fmtDur, h, run, toast } from './dom';

const where = (m: SessionMeta): string => {
  if (!m.in_browser) return 'folder';
  return m.storage === 'folder' ? 'przeglądarka (czeka na zapis do folderu)' : 'przeglądarka';
};

export class SessionsView {
  constructor(private readonly library: SessionLibrary, private readonly folder: FolderStore,
              private readonly activeId: () => string | null) {
    $('btnRefreshSessions').addEventListener('click', run(() => this.refresh()));
  }

  async refresh(): Promise<void> {
    const list = await this.library.list();
    const rows = list.map(m => this.row(m));
    $('sessionList').replaceChildren(...(rows.length ? rows : [h('p', { class: 'muted' }, 'Brak zapisanych sesji. Nagraj pierwszą w panelu „Nagrywanie”.')]));
    const perm = await this.folder.permission(false);
    $('sessionsHint').textContent = perm === 'prompt'
      ? 'Sesje z folderu pojawią się po przyznaniu dostępu (panel „Przechowywanie sesji”).'
      : 'CSV ma te same kolumny co nagrania serwera BrainLink (surowe ramki, ΔHbO/ΔHbR, znaczniki).';
  }

  private row(m: SessionMeta): HTMLElement {
    const dur = m.end_time ? m.end_time - m.start_time : null;
    const date = new Date(m.start_time * 1000).toLocaleString();
    const btn = (label: string, fn: () => unknown, cls = 'btn') => h('button', { class: cls, type: 'button', on: { click: run(fn) } }, label);
    if (m.session_id === this.activeId()) {
      return h('div', { class: 'session' }, h('div', { class: 'name' }, m.name || m.session_id),
        h('div', { class: 'meta' }, `${date} · nagrywanie w toku…`), h('div', { class: 'actions' }));
    }
    const actions = [
      btn('CSV', async () => download(await this.library.exportCsv(m), `${safe(m.name) || m.session_id}_fnirs.csv`)),
      btn('JSON', () => download(this.library.metaJson(m), `${m.session_id}_meta.json`)),
    ];
    if (m.in_browser && folderSupported()) {
      actions.push(btn('Do folderu', async () => {
        if ((await this.folder.permission(true)) !== 'granted') throw new Error('Najpierw wybierz folder i przyznaj dostęp');
        await this.library.moveToFolder(m);
        toast('Przeniesiono do folderu');
        await this.refresh();
      }));
    }
    actions.push(btn('Usuń', async () => {
      if (!confirm(`Usunąć sesję „${m.name}”? Tego nie da się cofnąć.`)) return;
      await this.library.delete(m);
      toast('Usunięto sesję');
      await this.refresh();
    }, 'btn danger'));
    return h('div', { class: 'session' },
      h('div', { class: 'name' }, m.name || m.session_id),
      h('div', { class: 'meta' }, `${date} · ${dur === null ? 'w toku / przerwana' : fmtDur(dur)} · ${m.sample_count} ramek · ` +
        `${m.markers?.length ?? 0} znaczników · ${m.device} · ${where(m)}${m.notes ? ' · ' + m.notes : ''}`),
      h('div', { class: 'actions' }, actions));
  }
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);
