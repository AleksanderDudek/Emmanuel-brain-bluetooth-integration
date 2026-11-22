/**
 * Connecting the band from wherever the player is (web/DESIGN.md §14): the next step Start shows — choose a band,
 * connect it or use the simulator, wait for the baseline, fix a weak contact — computed once here and shown with
 * its buttons on Start, in the device sheet (the app bar's band button opens it over any view), and as a small
 * panel in the training setups, every game lobby, the Trening tab and the signal view.  Nobody has to walk back
 * to Start to connect, and nobody is sent there afterwards: the player stays where they were.
 */
import type { HubStatus } from '../hub';
import { REASON_TEXT, WARNING_TEXT } from '../hub';
import { t } from '../i18n/shell';
import { TOOL_INFO, type Tool } from '../tools';
import { h } from './dom';

/** Where the player is on the way to a session: no band chosen, no signal, the baseline running, ready. */
export type ConnectStep = 'tool' | 'signal' | 'baseline' | 'ready';

export function connectStep(st: HubStatus): ConnectStep {
  if (!st.tool) return 'tool';
  if (st.source === 'off' || st.signal.reason === 'no_device' || st.signal.reason === 'connecting' || st.signal.reason === 'no_data') return 'signal';
  if (st.signal.reason === 'baseline') return 'baseline';
  return 'ready';
}

/** What the buttons do (main.ts wires them to the hub, the app bar and the device sheet). */
export interface ConnectActions {
  pickTool: (tool: Tool) => void;
  /** straight from a click: opens the browser's Bluetooth chooser */
  connect: () => void;
  simulator: () => void;
  openSheet: () => void;
}

/** One button of a step: a function, or a link (a view's hash). */
export interface NextAction { label: string; go: (() => void) | string; primary?: boolean }

export interface NextStep {
  step: ConnectStep;
  title: string;
  text: string;
  /** the baseline's progress (0..1) while it runs */
  progress: number | null;
  actions: NextAction[];
}

/**
 * The next step and its buttons.  `start`: the Start view (ready links on to the training, the games and the signal);
 * `sheet`: inside the device sheet (no "band settings" — it is open — and "Done" closes it when ready); `panel`: a
 * setup screen or a lobby (the panel hides when ready: the screen's own Start/Play button is the next step).
 */
export function nextStep(st: HubStatus, a: ConnectActions, where: 'start' | 'sheet' | 'panel', close?: () => void): NextStep {
  const step = connectStep(st);
  const tool = st.tool;
  const settings: NextAction[] = where === 'sheet' ? [] : [{ label: t('next.bandSettings'), go: a.openSheet }];
  if (!tool) {
    return {
      step, title: t('connect.pickTitle'), text: t('connect.pickText'), progress: null,
      actions: [{ label: TOOL_INFO.fnirs.device, go: () => a.pickTool('fnirs'), primary: true }, { label: TOOL_INFO.eeg.device, go: () => a.pickTool('eeg') }],
    };
  }
  const info = TOOL_INFO[tool];
  if (step === 'signal') {
    if (st.signal.reason === 'connecting') {
      return { step, title: t('next.reconnectTitle'), text: t('next.reconnectText'), progress: null, actions: settings };
    }
    return {
      step, progress: null,
      title: st.device.connected ? t('next.connected', { band: info.device }) : t('next.putOn', { band: info.device }),
      text: st.device.connected ? t('next.connectedOff') : info.fit,
      actions: [{ label: st.device.connected ? t('next.useBand') : t('common.connectBand'), go: a.connect, primary: true }, { label: t('common.useSim'), go: a.simulator }],
    };
  }
  if (step === 'baseline') {
    return {
      step, progress: st.signal.progress,
      title: tool === 'fnirs' ? t('next.baselineFnirs') : t('next.warmupEeg'),
      text: t('next.baselineText', { pct: Math.round(st.signal.progress * 100) }),
      actions: where === 'start' ? [{ label: t('common.liveSignal'), go: '#sygnal' }] : [],
    };
  }
  if (st.signal.reliable) {
    const title = st.source === 'simulator' ? t('next.simReady') : st.signal.warning ? t('next.readyWeak') : t('next.allReady');
    const text = st.source === 'simulator' ? t('next.simText')
      : st.signal.warning ? `${WARNING_TEXT[st.signal.warning]}.${st.signal.detail ? ` (${st.signal.detail})` : ''}`
      : t('next.goodText');
    const actions: NextAction[] = where === 'start'
      ? [{ label: t('common.focusTraining'), go: '#trening/focus', primary: true }, { label: t('common.games'), go: '#gry' }, { label: t('common.liveSignal'), go: '#sygnal' }]
      : where === 'sheet' && close ? [{ label: t('connect.done'), go: close, primary: true }] : [];
    return { step, title, text, progress: null, actions };
  }
  return {
    step, progress: null,
    title: st.signal.reason ? REASON_TEXT[st.signal.reason] : t('next.waiting'),
    text: st.signal.reason === 'poor_signal' ? info.fit : t('next.pausedText'),
    actions: where === 'start' ? [{ label: t('common.liveSignal'), go: '#sygnal' }, ...settings] : settings,
  };
}

/** A step's buttons as elements. */
export function actionButtons(actions: NextAction[]): HTMLElement[] {
  return actions.map(x => (typeof x.go === 'string'
    ? h('a', { class: `btn${x.primary ? ' primary' : ''}`, href: x.go }, x.label)
    : h('button', { class: `btn${x.primary ? ' primary' : ''}`, type: 'button', on: { click: x.go } }, x.label)));
}

/**
 * The small connect panel in a setup screen or a lobby (or, with `where: 'sheet'`, at the top of the device sheet):
 * the step's title, its line, the baseline's bar and the buttons.  Rendered on every hub status; it redraws only
 * when what it says changes, and a panel hides itself when the band is ready.
 */
export class ConnectPanel {
  private sig = '';

  constructor(
    readonly el: HTMLElement,
    private readonly actions: ConnectActions,
    private readonly where: 'sheet' | 'panel' = 'panel',
    private readonly close?: () => void,
    /** leave out the fitting line (a setup whose tips already say how to put the band on) */
    private readonly brief = false,
  ) {
    el.classList.add('connect-panel');
    el.setAttribute('role', 'status');
  }

  render(st: HubStatus): void {
    const n = nextStep(st, this.actions, this.where, this.close);
    const hide = this.where === 'panel' && n.step === 'ready' && !n.actions.length;
    const sig = `${hide}|${n.step}|${n.title}|${n.text}|${n.progress === null ? '' : Math.round(n.progress * 20)}|${n.actions.map(x => x.label).join(',')}`;
    if (sig === this.sig) return;
    this.sig = sig;
    this.el.hidden = hide;
    if (hide) return;
    this.el.dataset.step = n.step;
    let bar: HTMLElement | null = null;
    if (n.progress !== null) {
      // the width through the CSSOM: the page's CSP (style-src 'self') blocks a style attribute
      const fill = h('div');
      fill.style.width = `${Math.round(n.progress * 100)}%`;
      bar = h('div', { class: 'progress' }, fill);
    }
    this.el.replaceChildren(
      h('p', { class: 'connect-title' }, h('i', { class: `dot ${n.step === 'ready' ? 'live' : n.step === 'signal' || n.step === 'tool' ? 'bad' : 'wait'}` }), n.title),
      ...(this.brief && n.step === 'signal' && n.actions.length ? [] : [h('p', { class: 'muted connect-text' }, n.text)]),
      ...(bar ? [bar] : []),
      ...(n.actions.length ? [h('div', { class: 'row connect-actions' }, ...actionButtons(n.actions))] : []),
    );
  }
}
