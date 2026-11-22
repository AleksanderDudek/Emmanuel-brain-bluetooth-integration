import { describe, expect, it, vi } from 'vitest';
import type { HubStatus } from '../src/hub';
import { ConnectPanel, connectStep, nextStep, type ConnectActions } from '../src/ui/connect';

const status = (over: Partial<HubStatus> & { streaming?: boolean; connected?: boolean } = {}): HubStatus => ({
  tool: null, source: 'off', recording: null,
  device: { kind: 'mendi', connected: !!(over.connected ?? over.streaming), streaming: !!over.streaming, reconnecting: false, name: null, battery: null, charging: false, stale: false },
  signal: { reliable: false, reason: 'off', progress: 0, quality: null, warning: null, detail: null, heartRate: null },
  ...over,
});
const sig = (over: Partial<HubStatus['signal']>): HubStatus['signal'] => ({ ...status().signal, ...over });

const actions = (): ConnectActions & Record<string, ReturnType<typeof vi.fn>> => {
  const a = { pickTool: vi.fn(), connect: vi.fn(), simulator: vi.fn(), openSheet: vi.fn() };
  return a as never;
};
const labels = (n: { actions: { label: string }[] }) => n.actions.map(x => x.label);

describe('connecting from any view (ui/connect.ts)', () => {
  it('names the step: no band, no signal, the baseline, ready', () => {
    expect(connectStep(status())).toBe('tool');
    expect(connectStep(status({ tool: 'fnirs' }))).toBe('signal');
    expect(connectStep(status({ tool: 'fnirs', source: 'device', signal: sig({ reason: 'no_device' }) }))).toBe('signal');
    expect(connectStep(status({ tool: 'fnirs', source: 'device', signal: sig({ reason: 'connecting' }) }))).toBe('signal');
    expect(connectStep(status({ tool: 'eeg', source: 'device', streaming: true, signal: sig({ reason: 'baseline', progress: 0.4 }) }))).toBe('baseline');
    expect(connectStep(status({ tool: 'fnirs', source: 'simulator', signal: sig({ reliable: true, reason: null }) }))).toBe('ready');
    expect(connectStep(status({ tool: 'fnirs', source: 'device', streaming: true, signal: sig({ reason: 'poor_signal' }) }))).toBe('ready');
  });

  it('offers the band choice anywhere, and connect or the simulator once a band is chosen', () => {
    const a = actions();
    const pick = nextStep(status(), a, 'panel');
    expect(labels(pick)).toEqual(['Mendi', 'BrainAccess HALO']);
    (pick.actions[1].go as () => void)();
    expect(a.pickTool).toHaveBeenCalledWith('eeg');
    const off = nextStep(status({ tool: 'fnirs' }), a, 'panel');
    expect(off.title).toContain('Mendi');
    expect(labels(off)).toEqual(['Połącz opaskę', 'Użyj symulatora']);
    (off.actions[0].go as () => void)();
    (off.actions[1].go as () => void)();
    expect(a.connect).toHaveBeenCalledTimes(1);
    expect(a.simulator).toHaveBeenCalledTimes(1);
    // a band connected but its source off: use it
    expect(labels(nextStep(status({ tool: 'fnirs', connected: true }), a, 'panel'))[0]).toBe('Użyj opaski');
  });

  it('does not send the player to Start: a panel opens the sheet, the sheet has no button to itself and closes when ready', () => {
    const a = actions();
    const close = vi.fn();
    const recon = status({ tool: 'fnirs', source: 'device', signal: sig({ reason: 'connecting' }) });
    expect(labels(nextStep(recon, a, 'panel'))).toEqual(['Ustawienia opaski']);
    expect(nextStep(recon, a, 'sheet').actions).toEqual([]);
    const ready = status({ tool: 'fnirs', source: 'device', streaming: true, signal: sig({ reliable: true, reason: null }) });
    expect(nextStep(ready, a, 'panel').actions).toEqual([]);
    const done = nextStep(ready, a, 'sheet', close);
    expect(labels(done)).toEqual(['Gotowe']);
    (done.actions[0].go as () => void)();
    expect(close).toHaveBeenCalled();
    // Start keeps its links on to the training, the games and the signal
    expect(nextStep(ready, a, 'start').actions.map(x => x.go)).toEqual(['#trening/focus', '#gry', '#sygnal']);
    for (const where of ['panel', 'sheet', 'start'] as const) {
      for (const st of [status(), status({ tool: 'eeg' }), recon, ready]) {
        expect(nextStep(st, a, where, close).actions.some(x => x.go === '#start')).toBe(false);
      }
    }
  });

  it('shows the baseline as a bar', () => {
    const n = nextStep(status({ tool: 'fnirs', source: 'device', streaming: true, signal: sig({ reason: 'baseline', progress: 0.55 }) }), actions(), 'panel');
    expect(n.step).toBe('baseline');
    expect(n.progress).toBeCloseTo(0.55);
    expect(n.text).toContain('55%');
  });

  it('a panel draws its buttons, redraws only on change, and hides when the band is ready', () => {
    const el = document.createElement('div');
    const a = actions();
    const p = new ConnectPanel(el, a);
    p.render(status({ tool: 'fnirs' }));
    expect(el.hidden).toBe(false);
    expect(el.classList.contains('connect-panel')).toBe(true);
    const buttons = [...el.querySelectorAll('button')];
    expect(buttons.map(b => b.textContent)).toEqual(['Połącz opaskę', 'Użyj symulatora']);
    buttons[0].click();
    expect(a.connect).toHaveBeenCalled();
    const first = el.firstElementChild;
    p.render(status({ tool: 'fnirs' }));
    expect(el.firstElementChild).toBe(first);
    p.render(status({ tool: 'fnirs', source: 'simulator', signal: sig({ reliable: true, reason: null }) }));
    expect(el.hidden).toBe(true);
    p.render(status({ tool: 'fnirs', source: 'device', streaming: true, signal: sig({ reason: 'baseline', progress: 0.2 }) }));
    expect(el.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.progress div')!.style.width).toBe('20%');
  });
});
