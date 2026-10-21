/** Ustawienia: where sessions are stored, the MBLL parameters, exporting the training results. */
import { EXTINCTION } from '../core/pipeline';
import type { Engine } from '../engine';
import type { AppSettings } from '../settings';
import { requestPersistence, storageInfo, type SessionDB } from '../storage/db';
import { folderSupported, type FolderStore } from '../storage/folder';
import { download } from '../storage/library';
import { $, fmtBytes, h, run, toast } from './dom';

export class SettingsView {
  constructor(private readonly engine: Engine, private readonly folder: FolderStore, private readonly settings: AppSettings,
              private readonly save: () => Promise<void>, db: SessionDB) {
    this.initStorage();
    this.initConfig();
    $('btnExportTrainings').addEventListener('click', run(async () => {
      const all = await db.listTrainings();
      if (!all.length) throw new Error('Nie ma jeszcze żadnych treningów');
      const stamp = new Date().toISOString().slice(0, 10);
      download(new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' }), `brainlink_treningi_${stamp}.json`);
    }));
  }

  private initStorage(): void {
    const folderBtn = $<HTMLButtonElement>('btnStoreFolder');
    if (!folderSupported()) {
      folderBtn.disabled = true;
      $<HTMLButtonElement>('btnPickFolder').hidden = true;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-store]').forEach(b => b.addEventListener('click', run(async () => {
      if (b.dataset.store === 'folder') {
        if (!(await this.folder.getHandle())) await this.folder.pick();
        if ((await this.folder.permission(true)) !== 'granted') throw new Error('Nie przyznano dostępu do folderu');
      }
      this.settings.storageTarget = b.dataset.store as AppSettings['storageTarget'];
      await this.save();
      await this.renderStorage();
      toast(this.settings.storageTarget === 'folder' ? 'Nowe sesje trafią do folderu' : 'Nowe sesje zostaną w przeglądarce');
    })));
    $('btnPickFolder').addEventListener('click', run(async () => {
      await this.folder.pick();
      await this.folder.permission(true);
      await this.renderStorage();
    }));
    $('btnFolderAccess').addEventListener('click', run(async () => {
      await this.folder.permission(true);
      await this.renderStorage();
    }));
    $('btnPersist').addEventListener('click', run(async () => {
      toast((await requestPersistence()) ? 'Dane chronione przed automatycznym usunięciem' : 'Przeglądarka odmówiła — zainstaluj aplikację lub dodaj zakładkę');
      await this.renderStorage();
    }));
  }

  async renderStorage(): Promise<void> {
    document.querySelectorAll<HTMLButtonElement>('[data-store]').forEach(b =>
      b.setAttribute('aria-checked', String(b.dataset.store === this.settings.storageTarget)));
    const [info, name, perm] = await Promise.all([storageInfo(), this.folder.folderName, this.folder.permission(false)]);
    const kv = (k: string, v: string) => [h('span', null, k), h('span', null, v)];
    const el = $('storeKv');
    el.replaceChildren(...[
      kv('przeglądarka', info.usage === null ? '—' : `${fmtBytes(info.usage)} z ${fmtBytes(info.quota)}`),
      kv('ochrona', info.persisted === null ? '—' : info.persisted ? 'trwała' : 'zwykła (może zostać usunięta przy braku miejsca)'),
      folderSupported() ? kv('folder', name ? `${name}${perm === 'granted' ? '' : ' · brak dostępu'}` : 'nie wybrano') : [],
    ].flat());
    $('btnFolderAccess').hidden = perm !== 'prompt';
    $('btnPersist').hidden = info.persisted !== false;
    $('storeHint').textContent = folderSupported()
      ? 'Godzina nagrania fNIRS zajmuje ok. 10 MB. W trybie „Folder” sesja zapisuje się najpierw w przeglądarce, a po zakończeniu trafia do folderu jako CSV + JSON.'
      : 'Ta przeglądarka nie zapisuje do folderów (działa w Chrome/Edge na komputerze i Androidzie). Sesje zostają w przeglądarce — pobierzesz je jako CSV w „Sesjach”.';
  }

  private initConfig(): void {
    const wl = Object.keys(EXTINCTION).map(Number).sort((a, b) => a - b);
    const c = this.engine.pipeline.config;
    const opts = (sel: number) => wl.map(n => h('option', { value: n, selected: n === sel }, String(n)));
    $('cfgRed').replaceChildren(...opts(c.red_nm));
    $('cfgIr').replaceChildren(...opts(c.ir_nm));
    $<HTMLInputElement>('cfgSep').value = String(c.separation_cm);
    $<HTMLInputElement>('cfgDpf').value = String(c.dpf_ir);
    $<HTMLInputElement>('cfgLp').value = String(c.lp_hz);
    $<HTMLInputElement>('cfgHp').value = String(c.hp_hz);
    $('btnCfg').addEventListener('click', run(async () => {
      const num = (id: string) => Number($<HTMLInputElement>(id).value);
      const dpf = num('cfgDpf');
      this.engine.setFnirsConfig({ red_nm: num('cfgRed'), ir_nm: num('cfgIr'), separation_cm: num('cfgSep'),
                                   dpf_red: dpf, dpf_ir: dpf, lp_hz: num('cfgLp'), hp_hz: num('cfgHp') });
      await this.save();
      toast('Zastosowano — zbieranie nowej linii bazowej');
    }));
  }
}
