/** App bar: the band switch, the device chip (opens the device sheet) and the recording pill. */
import type { Hub, HubStatus, SignalReason } from '../hub';
import { t } from '../i18n/shell';
import { TOOL_INFO, isTool, type Tool } from '../tools';
import { $, fmtDur, run, toast } from './dom';

/** The chip's short line for a signal that is not usable yet (the baseline shows its progress instead). */
const REASON_CHIP: Record<Exclude<SignalReason, 'baseline'>, string> = {
  no_tool: t('chip.no_tool'), off: t('chip.off'), no_device: t('chip.no_device'), connecting: t('chip.connecting'),
  no_data: t('chip.no_data'), motion: t('chip.motion'), poor_signal: t('chip.poor_signal'),
};

export class AppBar {
  private lastTool: Tool | null | undefined = undefined;

  constructor(private readonly hub: Hub, private readonly openSheet: () => void) {
    document.querySelectorAll<HTMLButtonElement>('.toolswitch [data-tool]').forEach(b =>
      b.addEventListener('click', run(() => this.switchTo(b.dataset.tool as Tool))));
    // arrow keys move within the radio group
    document.querySelector('.toolswitch')!.addEventListener('keydown', e => {
      const k = (e as KeyboardEvent).key;
      if (k !== 'ArrowLeft' && k !== 'ArrowRight') return;
      e.preventDefault();
      const next: Tool = hub.tool === 'fnirs' ? 'eeg' : 'fnirs';
      void this.switchTo(next).then(() => document.querySelector<HTMLButtonElement>(`.toolswitch [data-tool="${next}"]`)?.focus());
    });
    $('devChip').addEventListener('click', () => this.openSheet());
    hub.addEventListener('tool', () => this.renderTool());
    this.renderTool();
  }

  /** Switch bands, asking first when it would cut a connection or a recording. */
  async switchTo(tool: Tool): Promise<boolean> {
    if (!isTool(tool) || tool === this.hub.tool) return true;
    if (this.hub.busy) {
      const ask = [t('bar.switchAsk', { band: TOOL_INFO[tool].device })];
      if (this.hub.tool) ask.push(t('bar.willDisconnect', { prev: TOOL_INFO[this.hub.tool].device }));
      if (this.hub.fnirs.recorder.recording) ask.push(t('common.recStops'));
      if (!confirm(ask.join(' '))) {
        this.renderTool();
        return false;
      }
    }
    await this.hub.setTool(tool);
    toast(`${TOOL_INFO[tool].device} (${TOOL_INFO[tool].label})`);
    return true;
  }

  private renderTool(): void {
    const tool = this.hub.tool;
    if (tool === this.lastTool) return;
    this.lastTool = tool;
    document.body.dataset.tool = tool ?? 'none';
    document.querySelectorAll<HTMLButtonElement>('.toolswitch [data-tool]').forEach(b => {
      const on = b.dataset.tool === tool;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on || (!tool && b.dataset.tool === 'fnirs') ? 0 : -1;
    });
  }

  render(s: HubStatus): void {
    this.renderTool();
    const dot = $('chipDot'), name = $('chipName'), meta = $('chipMeta');
    const sig = s.signal;
    let cls = '', title: string, sub: string;
    if (!s.tool) {
      title = t('common.chooseBand');
      sub = '';
    } else if (s.source === 'off') {
      title = s.device.connected ? `${s.device.name ?? TOOL_INFO[s.tool].device}` : TOOL_INFO[s.tool].device;
      sub = s.device.connected ? t('chip.connectedOff') : t('chip.notConnected');
    } else {
      title = s.source === 'simulator' ? t('common.simulator') : (s.device.name ?? TOOL_INFO[s.tool].device);
      const bat = s.source === 'device' && s.device.battery !== null ? ` · ${t('fmt.pct', { pct: s.device.battery })}` : '';
      if (sig.reliable && sig.warning) {
        cls = 'wait';
        sub = (sig.warning === 'light_leak' ? t('chip.light') : t('chip.weak')) + bat;
      } else if (sig.reliable) {
        cls = 'live';
        sub = (sig.quality === 'fair' ? t('chip.fair') : t('chip.good')) + bat;
      } else if (sig.reason === 'baseline') {
        cls = 'wait';
        sub = t('chip.baseline', { pct: Math.round(sig.progress * 100) }) + bat;
      } else {
        cls = sig.reason === 'no_device' || sig.reason === 'no_data' ? 'bad' : 'wait';
        sub = (sig.reason ? REASON_CHIP[sig.reason] : '') + bat;
      }
    }
    dot.className = `dot ${cls}`;
    if (name.textContent !== title) name.textContent = title;
    if (meta.textContent !== sub) meta.textContent = sub;
    $('devChip').setAttribute('aria-label', sub ? t('chip.ariaSub', { title, sub }) : t('chip.aria', { title }));
    const rec = s.recording?.recording ?? false;
    $('recPill').hidden = !rec;
    if (rec) $('recPillText').textContent = `REC ${fmtDur(s.recording!.elapsed_sec)}`;
  }
}
