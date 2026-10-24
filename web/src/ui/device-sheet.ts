/**
 * The device sheet: the one place to pick the signal source of the chosen
 * band (the band itself, the simulator, off), connect and disconnect, drive the
 * simulator, start a new baseline and get Bluetooth help.
 */
import type { HaloInfo } from '../ble/halo';
import type { MendiInfo } from '../ble/mendi';
import { HALO_NAMES, MENDI_NAMES } from '../ble/platform';
import { EEG_SCENARIOS, EEG_STATES } from '../core/eeg/simulator';
import { FNIRS_SCENARIOS, FNIRS_STATES } from '../core/simulator';
import type { Hub, HubStatus } from '../hub';
import { REASON_TEXT, WARNING_TEXT } from '../hub';
import { fmtNum } from '../i18n';
import { t } from '../i18n/shell';
import { TOOL_INFO, type Tool } from '../tools';
import { BluetoothUi } from './bluetooth';
import { $, fill, h, run, toast } from './dom';

/** The simulators' states (fNIRS and EEG) by their ids. */
const SIM_LABELS: Record<string, string> = {
  rest: t('sim.rest'), task: t('sim.task'), high_load: t('sim.high_load'), relax: t('sim.relax'), motion: t('sim.motion'),
  poor_contact: t('sim.poor_contact'), lateral_left: t('sim.lateral_left'), lateral_right: t('sim.lateral_right'),
  baseline: t('sim.rest'), focus: t('sim.focus'), stress: t('sim.stress'), flow: t('sim.flow'), eyes_closed: t('sim.eyes_closed'),
  panic_spike: t('sim.panic_spike'),
};
const SCENARIO_LABELS: Record<string, string> = {
  block_design: t('scen.block_design'), n_back: t('scen.n_back'), meditation: t('scen.meditation'), balance: t('scen.balance'),
  gaming_session: t('scen.gaming_session'), horror_game: t('scen.horror_game'), meditation_trainer: t('scen.meditation'), crafting_focus: t('sim.focus'),
};
/** A simulator state's or scenario's name (its id when there is none). */
export const simStateLabel = (id: string): string => SIM_LABELS[id] ?? id;
export const simScenarioLabel = (id: string): string => SCENARIO_LABELS[id] ?? id;

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
      toast(src === 'simulator' ? t('common.simOn') : src === 'off' ? t('sheet.offToast') : t('sheet.bandToast'));
    })));
    $('btnConnect').addEventListener('click', () => this.connect());
    $('btnDisconnect').addEventListener('click', run(async () => {
      await hub.disconnect();
      toast(t('sheet.disconnected'));
    }));
    $('btnBaseline').addEventListener('click', () => {
      hub.baselineReset();
      toast(t('sheet.baselineToast'));
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
      toast(t('sheet.chooseFirst'), true);
      return;
    }
    if (this.bt.status === 'unsupported' || this.bt.status === 'insecure') return this.bt.open();
    this.hub.connect()
      .then(() => toast(this.hub.tool === 'fnirs' ? t('sheet.connectedFnirs') : t('sheet.connectedEeg')))
      .catch(e => this.bt.handleError(e));
  };

  /** Texts and simulator buttons that depend on the band only. */
  private renderStatic(): void {
    const tool = this.hub.tool;
    $('sheetKicker').textContent = tool ? t('sheet.kicker', { tech: TOOL_INFO[tool].label }) : t('sheet.kickerNone');
    $('sheetTitle').textContent = tool ? TOOL_INFO[tool].device : t('common.chooseBand');
    $('srcDeviceName').textContent = tool ? TOOL_INFO[tool].device : t('sheet.band');
    $('devNote').textContent = !tool ? t('sheet.noteNone') : tool === 'eeg' ? t('sheet.noteHalo') : t('sheet.noteMendi');
    if (tool === this.simFor) return;
    this.simFor = tool;
    const states = tool === 'eeg' ? [...EEG_STATES] : Object.keys(FNIRS_STATES);
    const scenarios = tool === 'eeg' ? Object.keys(EEG_SCENARIOS) : Object.keys(FNIRS_SCENARIOS);
    const btn = (label: string, state: string) => h('button', {
      class: 'btn', type: 'button', 'data-sim': state, on: { click: run(() => this.hub.setSimState(state)) },
    }, label);
    $('simStates').replaceChildren(...states.map(k => btn(simStateLabel(k), k)));
    $('simScenarios').replaceChildren(...scenarios.map(k => btn(`▶ ${simScenarioLabel(k)}`, `auto:${k}`)), btn(t('scen.stop'), 'auto_stop'));
    this.lastSig = '';
  }

  render(s: HubStatus, sim: { state: string; auto: { scenario: string; current?: string; text: string } | null } | null): void {
    if (!this.dialog.open) return;
    const tool = s.tool;
    document.querySelectorAll<HTMLButtonElement>('#sourcePick [data-src]').forEach(b => {
      b.setAttribute('aria-checked', String(b.dataset.src === s.source));
      b.disabled = !tool;
    });
    $('srcDeviceText').textContent = s.device.connected ? t('sheet.srcConnected') : t('sheet.srcConnect');
    $('simCard').hidden = s.source !== 'simulator';
    if (sim) {
      $('simInfo').textContent = sim.auto ? sim.auto.text : t('sheet.simState', { state: simStateLabel(sim.state) });
      document.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach(b =>
        b.classList.toggle('on', sim.auto ? b.dataset.sim === `auto:${sim.auto.scenario}` : b.dataset.sim === sim.state));
    }
    const d = s.device;
    const badge = $('devBadge');
    badge.textContent = !d.connected ? (d.reconnecting ? t('badge.reconnecting') : t('badge.disconnected'))
      : d.streaming ? (d.stale ? t('badge.noData') : t('badge.stream')) : t('badge.connected');
    badge.className = 'badge' + (d.connected && d.streaming && !d.stale ? ' ok' : d.connected || d.reconnecting ? ' warn' : '');
    const sg = s.signal;
    $('devSignal').textContent = s.source !== 'device' ? ''
      : sg.reliable ? (sg.warning ? WARNING_TEXT[sg.warning] : t('chip.good')) + (sg.detail ? ` (${sg.detail})` : '')
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
    const ok = (good: boolean) => (good ? 'OK' : t('kv.error'));
    if ('sensor_woken' in info) {
      const d = info;
      const bat = d.battery
        ? t(d.battery.charging ? 'kv.batteryCharging' : 'kv.batteryVal', { pct: d.battery.percent, v: fmtNum(d.battery.voltage / 1000, 2) }) : '—';
      const diag = d.diagnostics ? t('kv.diagVal', { imu: ok(d.diagnostics.imu_ok), sensor: ok(d.diagnostics.sensor_ok) }) : '—';
      fill($('devKv'),
        kv(t('kv.name'), d.device_name ?? 'Mendi'), kv(t('kv.battery'), bat), kv(t('kv.firmware'), `${d.firmware} · ${d.hardware}`),
        kv(t('kv.diag'), diag), kv(t('kv.sensor'), d.sensor_woken ? t('kv.woken') : t('kv.standalone')),
        kv(t('kv.lost'), t('kv.countInvalid', { lost: d.frames_dropped, bad: d.frames_invalid })));
    } else {
      const d = info;
      fill($('devKv'),
        kv(t('kv.name'), d.device_name ?? 'HALO'), kv(t('kv.battery'), d.battery_percent === null ? '—' : t('fmt.pct', { pct: d.battery_percent })),
        kv(t('kv.model'), `${d.model} · ${d.manufacturer}`), kv(t('kv.firmware'), `${d.firmware} · ${d.hardware}`),
        kv(t('kv.packets'), t('kv.countInvalid', { lost: d.packets, bad: d.packets_invalid })), kv(t('kv.lostSamples'), String(d.samples_dropped)));
    }
  }
}
