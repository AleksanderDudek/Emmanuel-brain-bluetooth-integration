/** Sidebar: source, band, baseline, simulator, recording, storage and MBLL settings. */
import type { MendiInfo } from '../ble/mendi';
import { EXTINCTION } from '../core/pipeline';
import { FNIRS_SCENARIOS, FNIRS_STATES } from '../core/simulator';
import type { Engine, EngineFrame, Source } from '../engine';
import type { AppSettings } from '../settings';
import { requestPersistence, storageInfo } from '../storage/db';
import { folderSupported, type FolderStore } from '../storage/folder';
import type { BluetoothUi } from './bluetooth';
import { $, fill, fmtBytes, h, run, toast } from './dom';

const SIM_LABELS: Record<string, string> = {
  rest: 'spoczynek', task: 'zadanie', high_load: 'duże obciąż.', relax: 'relaks', motion: 'ruch', poor_contact: 'słaby kontakt',
  lateral_left: 'lewa przeważa', lateral_right: 'prawa przeważa',
};
const SOURCE_LABELS: Record<Source, string> = { simulator: 'Symulator', device: 'Mendi na żywo', off: 'Wyłączone' };

export class Controls {
  private lastSource: Source | null = null;
  private lastRecording: boolean | null = null;

  constructor(private readonly engine: Engine, private readonly folder: FolderStore, private readonly settings: AppSettings,
              private readonly save: () => Promise<void>, private readonly bt: BluetoothUi) {}

  init(): void {
    this.initSource();
    this.initDevice();
    this.initSimulator();
    this.initRecording();
    this.initStorage();
    this.initConfig();
    $('btnBaseline').addEventListener('click', () => { this.engine.baselineReset(); toast('Linia bazowa zresetowana'); });
  }

  // ── source + band ─────────────────────────────────────────────────
  private initSource(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-src]').forEach(b => b.addEventListener('click', run(async () => {
      const src = b.dataset.src as Source;
      if (src === 'device') {
        if (!this.engine.device.isConnected) return this.connect();
        await this.engine.useDevice();
      } else {
        this.engine.setSource(src);
      }
      toast(`Źródło: ${b.textContent}`);
    })));
  }

  /** Must run straight from a click: the browser only shows its chooser for a user gesture. */
  connect = (): void => {
    if (this.bt.status === 'unsupported' || this.bt.status === 'insecure') return this.bt.open();
    this.engine.connectDevice()
      .then(() => toast('Połączono — zbieranie linii bazowej'))
      .catch(e => this.bt.handleError(e));
  };

  private initDevice(): void {
    $('btnConnect').addEventListener('click', this.connect);
    $('btnDisconnect').addEventListener('click', run(async () => {
      await this.engine.disconnectDevice();
      toast('Rozłączono');
    }));
    this.engine.addEventListener('device', () => this.renderDevice(this.engine.device.info));
    this.renderDevice(this.engine.device.info);
  }

  renderDevice(d: MendiInfo): void {
    const b = $('devBadge');
    if (!d.connected) {
      b.textContent = d.reconnecting ? 'ponowne łączenie…' : 'rozłączona';
      b.className = 'badge' + (d.reconnecting ? ' warn' : '');
      fill($('devKv'));
      return;
    }
    b.textContent = d.streaming ? (d.data_stale ? 'brak danych' : 'strumień') : 'połączona';
    b.className = 'badge ' + (d.streaming && !d.data_stale ? 'ok' : 'warn');
    const bat = d.battery ? `${d.battery.percent}% (${(d.battery.voltage / 1000).toFixed(2)} V)${d.battery.charging ? ' · ładowanie' : ''}` : '—';
    const diag = d.diagnostics ? `IMU ${d.diagnostics.imu_ok ? 'OK' : 'błąd'} · sensor ${d.diagnostics.sensor_ok ? 'OK' : 'błąd'}` : '—';
    const kv = (k: string, v: string) => [h('span', null, k), h('span', null, v)];
    fill($('devKv'),
      kv('nazwa', d.device_name ?? 'Mendi'), kv('bateria', bat), kv('firmware', `${d.firmware} · ${d.hardware}`),
      kv('diagnostyka', diag), kv('czujnik', d.sensor_woken ? 'wybudzony przez aplikację' : 'samodzielny'),
      kv('utracone', `${d.frames_dropped} · błędne ${d.frames_invalid}`));
  }

  // ── simulator ─────────────────────────────────────────────────────
  private initSimulator(): void {
    const btn = (label: string, state: string) => h('button', {
      class: 'btn', type: 'button', 'data-sim': state,
      on: { click: run(() => this.engine.setSimState(state)) },
    }, label);
    $('simStates').replaceChildren(...Object.keys(FNIRS_STATES).map(k => btn(SIM_LABELS[k] ?? k, k)));
    $('simScenarios').replaceChildren(...Object.keys(FNIRS_SCENARIOS).map(k => btn(`▶ ${k}`, `auto:${k}`)), btn('■', 'auto_stop'));
  }

  // ── recording + markers ───────────────────────────────────────────
  private initRecording(): void {
    const dur = $<HTMLInputElement>('recDur');
    dur.value = String(this.settings.recordingDurationSec);
    $('btnRec').addEventListener('click', run(async () => {
      if (this.settings.storageTarget === 'folder' && (await this.folder.permission(true)) !== 'granted') {
        toast('Brak dostępu do folderu — sesja zostanie w przeglądarce', true);
      }
      this.settings.recordingDurationSec = Number(dur.value) || 600;
      await this.save();
      await this.engine.startRecording($<HTMLInputElement>('recName').value, this.settings.recordingDurationSec);
      toast('Nagrywanie rozpoczęte');
    }));
    $('btnRecStop').addEventListener('click', run(async () => {
      if (!this.engine.recorder.recording) throw new Error('Nic nie jest nagrywane');
      await this.engine.stopRecording();
    }));
    const mark = (label: string) => {
      if (!label) return;
      toast(this.engine.mark(label) ? `Znacznik: ${label}` : 'Znaczniki zapisują się tylko podczas nagrywania', !this.engine.recorder.recording);
    };
    document.querySelectorAll<HTMLButtonElement>('[data-mark]').forEach(b => b.addEventListener('click', () => mark(b.dataset.mark!)));
    $('btnMark').addEventListener('click', () => {
      const input = $<HTMLInputElement>('markCustom');
      mark(input.value.trim());
      input.value = '';
    });
  }

  // ── storage ───────────────────────────────────────────────────────
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
    fill($('storeKv'),
      kv('przeglądarka', info.usage === null ? '—' : `${fmtBytes(info.usage)} z ${fmtBytes(info.quota)}`),
      kv('ochrona', info.persisted === null ? '—' : info.persisted ? 'trwała' : 'zwykła (może zostać usunięta przy braku miejsca)'),
      folderSupported() ? kv('folder', name ? `${name}${perm === 'granted' ? '' : ' · brak dostępu'}` : 'nie wybrano') : null);
    $('btnFolderAccess').hidden = perm !== 'prompt';
    $('btnPersist').hidden = info.persisted !== false;
    $('storeHint').textContent = folderSupported()
      ? 'Godzina nagrania zajmuje ok. 10 MB. W trybie „Folder” sesja zapisuje się najpierw w przeglądarce, a po zakończeniu trafia do folderu jako CSV + JSON.'
      : 'Ta przeglądarka nie zapisuje do folderów (działa w Chrome/Edge na komputerze i Androidzie). Sesje zostają w przeglądarce — pobierzesz je jako CSV w zakładce „Sesje”.';
  }

  // ── MBLL config ───────────────────────────────────────────────────
  private initConfig(): void {
    const wl = Object.keys(EXTINCTION).map(Number).sort((a, b) => a - b);
    const load = () => {
      const c = this.engine.pipeline.config;
      const opts = (sel: number) => wl.map(n => h('option', { value: n, selected: n === sel }, String(n)));
      $('cfgRed').replaceChildren(...opts(c.red_nm));
      $('cfgIr').replaceChildren(...opts(c.ir_nm));
      $<HTMLInputElement>('cfgSep').value = String(c.separation_cm);
      $<HTMLInputElement>('cfgDpf').value = String(c.dpf_ir);
      $<HTMLInputElement>('cfgLp').value = String(c.lp_hz);
      $<HTMLInputElement>('cfgHp').value = String(c.hp_hz);
    };
    load();
    $('btnCfg').addEventListener('click', run(async () => {
      const num = (id: string) => Number($<HTMLInputElement>(id).value);
      const dpf = num('cfgDpf');
      this.engine.setFnirsConfig({ red_nm: num('cfgRed'), ir_nm: num('cfgIr'), separation_cm: num('cfgSep'),
                                   dpf_red: dpf, dpf_ir: dpf, lp_hz: num('cfgLp'), hp_hz: num('cfgHp') });
      await this.save();
      toast('Zastosowano — zbieranie nowej linii bazowej');
    }));
  }

  // ── per frame ─────────────────────────────────────────────────────
  renderFrame(f: EngineFrame): void {
    const rec = f.recording.recording;
    $('dot').className = 'dot ' + (rec ? 'rec' : f.source !== 'off' ? 'live' : '');
    $('statusText').textContent = SOURCE_LABELS[f.source];
    $('rateText').textContent = f.measured_rate ? `${f.measured_rate} Hz` : '';
    if (f.source !== this.lastSource) {
      document.querySelectorAll<HTMLButtonElement>('[data-src]').forEach(b => b.classList.toggle('on', b.dataset.src === f.source));
      $('simCard').style.opacity = f.source === 'simulator' ? '1' : '.5';
      this.lastSource = f.source;
    }
    if (f.simulator) {
      const a = f.simulator.auto;
      $('simInfo').textContent = a ? `Scenariusz ${a.scenario}: ${a.state} (${Math.round(a.elapsed_sec)}/${a.total_sec} s)` : `Stan: ${f.simulator.state}`;
      document.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach(b =>
        b.classList.toggle('on', a ? b.dataset.sim === `auto:${a.scenario}` : b.dataset.sim === f.simulator!.state));
    }
    const badge = $('recBadge');
    if (rec) {
      badge.textContent = `REC ${Math.floor(f.recording.elapsed_sec)} s · ${f.recording.markers} zn.`;
      badge.className = 'badge warn';
    } else {
      badge.textContent = 'gotowe';
      badge.className = 'badge';
    }
    if (rec !== this.lastRecording) {
      document.querySelectorAll<HTMLButtonElement>('[data-mark], #btnMark').forEach(x => {
        x.disabled = !rec;
        x.title = rec ? '' : 'Znaczniki zapisują się tylko podczas nagrywania';
      });
      this.lastRecording = rec;
    }
  }
}
