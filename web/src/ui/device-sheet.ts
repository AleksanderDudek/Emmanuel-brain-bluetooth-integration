/**
 * The device sheet: the one place to pick the signal source of the active
 * tool (its band, the simulator, off), connect and disconnect, drive the
 * simulator, start a new baseline and get Bluetooth help.
 */
import type { HaloInfo } from '../ble/halo';
import type { MendiInfo } from '../ble/mendi';
import { HALO_NAMES, MENDI_NAMES } from '../ble/platform';
import { EEG_SCENARIOS, EEG_STATES } from '../core/eeg/simulator';
import { FNIRS_SCENARIOS, FNIRS_STATES } from '../core/simulator';
import type { Hub, HubStatus } from '../hub';
import { REASON_TEXT, WARNING_TEXT } from '../hub';
import { TOOL_INFO, type Tool } from '../tools';
import { BluetoothUi } from './bluetooth';
import { $, fill, h, run, toast } from './dom';

const SIM_LABELS: Record<string, string> = {
  rest: 'spoczynek', task: 'zadanie', high_load: 'duże obciążenie', relax: 'relaks', motion: 'ruch', poor_contact: 'słaby kontakt',
  lateral_left: 'lewa przeważa', lateral_right: 'prawa przeważa',
  baseline: 'spoczynek', focus: 'skupienie', stress: 'stres', flow: 'flow', eyes_closed: 'oczy zamknięte', panic_spike: 'panika',
};
const SCENARIO_LABELS: Record<string, string> = {
  block_design: 'bloki zadanie/odpoczynek', n_back: 'n-back', meditation: 'medytacja', balance: 'równowaga',
  gaming_session: 'sesja gry', horror_game: 'horror', meditation_trainer: 'medytacja', crafting_focus: 'skupienie',
};

export class DeviceSheet {
  readonly bt: BluetoothUi;
  private readonly dialog = $<HTMLDialogElement>('deviceSheet');
  private simFor: Tool | null = null;
  private lastSig = '';

  constructor(private readonly hub: Hub) {
    this.bt = new BluetoothUi(() => this.connect(), () => (hub.tool === 'eeg' ? HALO_NAMES : MENDI_NAMES));
    $('sheetClose').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', e => { if (e.target === this.dialog) this.dialog.close(); });   // backdrop
    document.querySelectorAll<HTMLButtonElement>('#sourcePick [data-src]').forEach(b => b.addEventListener('click', run(async () => {
      const src = b.dataset.src;
      if (src === 'device') {
        if (!hub.active?.device.isConnected) return this.connect();
        await hub.connect();
      } else if (src === 'simulator') await hub.useSimulator();
      else await hub.turnOff();
      toast(src === 'simulator' ? 'Symulator włączony' : src === 'off' ? 'Źródło wyłączone' : 'Opaska jest źródłem sygnału');
    })));
    $('btnConnect').addEventListener('click', () => this.connect());
    $('btnDisconnect').addEventListener('click', run(async () => {
      await hub.disconnect();
      toast('Rozłączono');
    }));
    $('btnBaseline').addEventListener('click', () => {
      hub.baselineReset();
      toast('Nowa linia bazowa — siedź spokojnie');
    });
    hub.addEventListener('tool', () => this.renderStatic());
    this.renderStatic();
  }

  open(): void {
    if (!this.dialog.open) this.dialog.showModal();
  }

  /** Must run straight from a click: the browser only shows its chooser for a user gesture. */
  connect = (): void => {
    if (!this.hub.tool) {
      toast('Najpierw wybierz opaskę: fNIRS lub EEG', true);
      return;
    }
    if (this.bt.status === 'unsupported' || this.bt.status === 'insecure') return this.bt.open();
    this.hub.connect()
      .then(() => toast(this.hub.tool === 'fnirs' ? 'Połączono — zbieranie linii bazowej' : 'Połączono — rozgrzewanie sygnału'))
      .catch(e => this.bt.handleError(e));
  };

  /** Texts and simulator buttons that depend on the tool only. */
  private renderStatic(): void {
    const tool = this.hub.tool;
    $('sheetKicker').textContent = tool ? `${TOOL_INFO[tool].label} · źródło sygnału` : 'Źródło sygnału';
    $('sheetTitle').textContent = tool ? TOOL_INFO[tool].device : 'Wybierz opaskę';
    $('srcDeviceName').textContent = tool ? TOOL_INFO[tool].device : 'Opaska';
    $('devNote').textContent = !tool ? 'Najpierw wybierz opaskę przełącznikiem u góry: fNIRS (Mendi) albo EEG (HALO).'
      : tool === 'eeg' ? 'Zamknij aplikację BrainAccess — opaska obsługuje jedno połączenie Bluetooth naraz.'
      : 'Zamknij aplikację Mendi na telefonie — opaska obsługuje jedno połączenie Bluetooth naraz.';
    if (tool === this.simFor) return;
    this.simFor = tool;
    const states = tool === 'eeg' ? [...EEG_STATES] : Object.keys(FNIRS_STATES);
    const scenarios = tool === 'eeg' ? Object.keys(EEG_SCENARIOS) : Object.keys(FNIRS_SCENARIOS);
    const btn = (label: string, state: string) => h('button', {
      class: 'btn', type: 'button', 'data-sim': state, on: { click: run(() => this.hub.setSimState(state)) },
    }, label);
    $('simStates').replaceChildren(...states.map(k => btn(SIM_LABELS[k] ?? k, k)));
    $('simScenarios').replaceChildren(...scenarios.map(k => btn(`▶ ${SCENARIO_LABELS[k] ?? k}`, `auto:${k}`)), btn('■ stop', 'auto_stop'));
    this.lastSig = '';
  }

  render(s: HubStatus, sim: { state: string; auto: { scenario: string; current?: string; text: string } | null } | null): void {
    if (!this.dialog.open) return;
    const tool = s.tool;
    document.querySelectorAll<HTMLButtonElement>('#sourcePick [data-src]').forEach(b => {
      b.setAttribute('aria-checked', String(b.dataset.src === s.source));
      b.disabled = !tool;
    });
    $('srcDeviceText').textContent = s.device.connected ? 'Połączona — użyj jej' : 'Połącz przez Bluetooth';
    $('simCard').hidden = s.source !== 'simulator';
    if (sim) {
      $('simInfo').textContent = sim.auto ? sim.auto.text : `stan: ${SIM_LABELS[sim.state] ?? sim.state}`;
      document.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach(b =>
        b.classList.toggle('on', sim.auto ? b.dataset.sim === `auto:${sim.auto.scenario}` : b.dataset.sim === sim.state));
    }
    const d = s.device;
    const badge = $('devBadge');
    badge.textContent = !d.connected ? (d.reconnecting ? 'ponowne łączenie…' : 'rozłączona') : d.streaming ? (d.stale ? 'brak danych' : 'strumień') : 'połączona';
    badge.className = 'badge' + (d.connected && d.streaming && !d.stale ? ' ok' : d.connected || d.reconnecting ? ' warn' : '');
    const sg = s.signal;
    $('devSignal').textContent = s.source !== 'device' ? ''
      : sg.reliable ? (sg.warning ? WARNING_TEXT[sg.warning] : 'sygnał dobry') + (sg.detail ? ` (${sg.detail})` : '')
      : sg.reason ? REASON_TEXT[sg.reason] : '';
    $<HTMLButtonElement>('btnConnect').hidden = d.connected || d.reconnecting;
    $<HTMLButtonElement>('btnConnect').disabled = !tool;
    $<HTMLButtonElement>('btnDisconnect').hidden = !d.connected && !d.reconnecting;   // also stops a reconnect loop
    $<HTMLButtonElement>('btnBaseline').disabled = s.source === 'off';
  }

  /** Band details (key–value list), from the engine's own info. */
  renderDetails(info: MendiInfo | HaloInfo | null): void {
    if (!this.dialog.open) return;
    const sig = JSON.stringify(info);
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    if (!info || !info.connected) return fill($('devKv'));
    const kv = (k: string, v: string) => [h('span', null, k), h('span', null, v)];
    if ('sensor_woken' in info) {
      const d = info;
      const bat = d.battery ? `${d.battery.percent}% (${(d.battery.voltage / 1000).toFixed(2)} V)${d.battery.charging ? ' · ładowanie' : ''}` : '—';
      const diag = d.diagnostics ? `IMU ${d.diagnostics.imu_ok ? 'OK' : 'błąd'} · sensor ${d.diagnostics.sensor_ok ? 'OK' : 'błąd'}` : '—';
      fill($('devKv'),
        kv('nazwa', d.device_name ?? 'Mendi'), kv('bateria', bat), kv('firmware', `${d.firmware} · ${d.hardware}`),
        kv('diagnostyka', diag), kv('czujnik', d.sensor_woken ? 'wybudzony przez aplikację' : 'samodzielny'),
        kv('utracone', `${d.frames_dropped} · błędne ${d.frames_invalid}`));
    } else {
      const d = info;
      fill($('devKv'),
        kv('nazwa', d.device_name ?? 'HALO'), kv('bateria', d.battery_percent === null ? '—' : `${d.battery_percent}%`),
        kv('model', `${d.model} · ${d.manufacturer}`), kv('firmware', `${d.firmware} · ${d.hardware}`),
        kv('pakiety', `${d.packets} · błędne ${d.packets_invalid}`), kv('utracone próbki', String(d.samples_dropped)));
    }
  }
}
