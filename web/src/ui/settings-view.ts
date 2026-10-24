/** Ustawienia: where sessions are stored, the MBLL parameters, exporting the training results. (The language card: language.ts.) */
import { EXTINCTION } from '../core/pipeline';
import type { Engine } from '../engine';
import { fmtNum } from '../i18n';
import { t } from '../i18n/shell';
import type { AppSettings } from '../settings';
import { requestPersistence, storageInfo, type SessionDB } from '../storage/db';
import { folderSupported, type FolderStore } from '../storage/folder';
import { download } from '../storage/library';
import { $, h, run, toast } from './dom';

/** A byte count in this language's number style ("1,5 MB"). */
const bytes = (b: number | null): string => {
  if (b === null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${fmtNum(v, v < 10 && i ? 1 : 0)} ${u[i]}`;
};

export class SettingsView {
  constructor(private readonly engine: Engine, private readonly folder: FolderStore, private readonly settings: AppSettings,
              private readonly save: () => Promise<void>, db: SessionDB) {
    this.initStorage();
    this.initConfig();
    $('btnExportTrainings').addEventListener('click', run(async () => {
      const all = await db.listTrainings();
      if (!all.length) throw new Error(t('ust.noResults'));
      const stamp = new Date().toISOString().slice(0, 10);
      download(new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' }), `emmanuel_${t('ust.exportFile')}_${stamp}.json`);
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
        if ((await this.folder.permission(true)) !== 'granted') throw new Error(t('ust.noAccess'));
      }
      this.settings.storageTarget = b.dataset.store as AppSettings['storageTarget'];
      await this.save();
      await this.renderStorage();
      toast(this.settings.storageTarget === 'folder' ? t('ust.toFolder') : t('ust.toBrowser'));
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
      toast((await requestPersistence()) ? t('ust.persisted') : t('ust.persistRefused'));
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
      kv(t('ust.kvBrowser'), info.usage === null ? '—' : t('ust.usage', { used: bytes(info.usage), quota: bytes(info.quota) })),
      kv(t('ust.kvProtection'), info.persisted === null ? '—' : info.persisted ? t('ust.persistent') : t('ust.bestEffort')),
      folderSupported() ? kv(t('ust.kvFolder'), name ? (perm === 'granted' ? name : t('ust.folderNoAccess', { name })) : t('ust.notChosen')) : [],
    ].flat());
    $('btnFolderAccess').hidden = perm !== 'prompt';
    $('btnPersist').hidden = info.persisted !== false;
    $('storeHint').textContent = folderSupported() ? t('ust.hintFolder') : t('ust.hintNoFolder');
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
      toast(t('ust.applied'));
    }));
  }
}
