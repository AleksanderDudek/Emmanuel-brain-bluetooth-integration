/** App bar: the tool switch, the device chip (opens the device sheet) and the recording pill. */
import type { Hub, HubStatus } from '../hub';
import { REASON_TEXT } from '../hub';
import { TOOL_INFO, isTool, type Tool } from '../tools';
import { $, fmtDur, run, toast } from './dom';

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

  /** Switch tools, asking first when it would cut a connection or a recording. */
  async switchTo(tool: Tool): Promise<boolean> {
    if (!isTool(tool) || tool === this.hub.tool) return true;
    if (this.hub.busy) {
      const prev = this.hub.tool ? TOOL_INFO[this.hub.tool].device : 'opaska';
      const rec = this.hub.fnirs.recorder.recording ? ' Trwające nagranie zostanie zakończone i zapisane.' : '';
      if (!confirm(`Przełączyć na ${TOOL_INFO[tool].label} (${TOOL_INFO[tool].device})? ${prev} zostanie rozłączona.${rec}`)) {
        this.renderTool();
        return false;
      }
    }
    await this.hub.setTool(tool);
    toast(`${TOOL_INFO[tool].label} · ${TOOL_INFO[tool].device}`);
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
      title = 'Wybierz opaskę';
      sub = '';
    } else if (s.source === 'off') {
      title = s.device.connected ? `${s.device.name ?? TOOL_INFO[s.tool].device}` : TOOL_INFO[s.tool].device;
      sub = s.device.connected ? 'połączona · źródło wyłączone' : 'niepołączona';
    } else {
      title = s.source === 'simulator' ? 'Symulator' : (s.device.name ?? TOOL_INFO[s.tool].device);
      const bat = s.source === 'device' && s.device.battery !== null ? ` · ${s.device.battery}%` : '';
      if (sig.reliable && sig.warning) {
        cls = 'wait';
        sub = (sig.warning === 'light_leak' ? 'dużo światła' : 'sygnał słaby') + bat;
      } else if (sig.reliable) {
        cls = 'live';
        sub = (sig.quality === 'fair' ? 'sygnał średni' : 'sygnał dobry') + bat;
      } else if (sig.reason === 'baseline') {
        cls = 'wait';
        sub = `linia bazowa ${Math.round(sig.progress * 100)}%${bat}`;
      } else {
        cls = sig.reason === 'no_device' || sig.reason === 'no_data' ? 'bad' : 'wait';
        sub = (sig.reason ? REASON_TEXT[sig.reason].split(' — ')[0].toLowerCase() : '') + bat;
      }
    }
    dot.className = `dot ${cls}`;
    if (name.textContent !== title) name.textContent = title;
    if (meta.textContent !== sub) meta.textContent = sub;
    $('devChip').setAttribute('aria-label', `Opaska: ${title}${sub ? ', ' + sub : ''}. Otwórz ustawienia połączenia.`);
    const rec = s.recording?.recording ?? false;
    $('recPill').hidden = !rec;
    if (rec) $('recPillText').textContent = `REC ${fmtDur(s.recording!.elapsed_sec)}`;
  }
}
