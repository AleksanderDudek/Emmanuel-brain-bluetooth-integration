/**
 * The arcade games' full-screen run (DESIGN.md §9): calibration as the game's intro, a countdown,
 * play with the session clock, pause, the signal banners and the simulator's focus switch, then
 * saving (the training result and the game's progress) and the summary with the day score.
 * The game itself only draws and plays (src/arcade/kit/types.ts).
 */
import type { Hub, HubSample } from '../hub';
import { REASON_TEXT, WARNING_TEXT } from '../hub';
import { mulberry32 } from '../core/random';
import { fmtNum, fmtSigned } from '../i18n';
import { BAND_NAME, t } from '../i18n/arcade';
import type { AppSettings } from '../settings';
import type { SessionDB } from '../storage/db';
import { TOOL_INFO, type Tool } from '../tools';
import { dayScore, newMilestones, type TrainingResult } from '../training/score';
import { $, fmtDur, h, run, toast } from '../ui/dom';
import { drawOverview } from '../ui/focus';
import { SignalDock, stateText, type BlockStart } from './dock';
import { ArcadeAudio } from './kit/audio';
import { BEGINNER_SESSIONS, BEGINNER_TUNING, DEFAULT_TUNING, type FocusTuning } from './kit/focus';
import { reducedMotion } from './kit/juice';
import { dayKey, daySeed, saveProgress } from './kit/progress';
import { ArcadeSession, type CarriedCalibration } from './kit/session';
import { NO_INSETS, coarsePointer, safeAreas } from './kit/mobile';
import { FREE_PHASE, type ArcadeGame, type ArcadeModule, type ArcadeOutcome, type Insets, type SignalPhase, type TapTarget } from './kit/types';
import { MendiPanel, howToPlay } from './mendi';
import type { ArcadeEntry } from './registry';
import { verseSlot } from './verse';

const SVGNS = 'http://www.w3.org/2000/svg';
const icon = (id: string) => {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVGNS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
};

/** How long a block's instruction stays over the game (ms). */
const BANNER_MS = 4200;

/**
 * Adaptive resolution: over each window of play (s), the mean frame time (ms) above which the window
 * counts as slow; after two slow windows in a row the canvas drops half a device pixel (2 → 1.5 → 1).
 * A phone's fill rate is the usual limit, and a sharper picture is not worth a stuttering game.
 */
const PERF_WINDOW_SEC = 2.5;
const PERF_SLOW_MS = 24;

/** Longest a game may keep a finished session going to resolve its current move (s). */
const OVERTIME_SEC = 30;
const COUNTDOWN = ['3', '2', '1', t('run.go')];

export interface ArcadeDeps {
  hub: Hub;
  db: SessionDB;
  settings: AppSettings;
  /** markers into a running recording (no-op otherwise) */
  mark: (label: string) => void;
  onSaved: (r: TrainingResult) => void;
  /** back to the game's lobby */
  onExit: () => void;
  /** the saved trainings so far (newest first): beginners get a gentler threshold */
  history: () => readonly TrainingResult[];
  /** the device sheet (a modal dialog, so it opens above the game): reconnect mid-session */
  openSheet: () => void;
  /** persist the settings (the signal dock's switch) */
  save: () => unknown;
}

type Stage = 'calibration' | 'countdown' | 'play' | 'summary';

export class ArcadeRunner {
  private readonly root = $('arcadeLayer');
  active = false;
  private entry: ArcadeEntry | null = null;
  private mod: ArcadeModule | null = null;
  private progress: object | null = null;
  private session: ArcadeSession | null = null;
  private game: ArcadeGame | null = null;
  private audio: ArcadeAudio | null = null;
  private carry: CarriedCalibration | null = null;
  /** the game's best before this session */
  private bestBefore: number | null = null;
  /** the progress as it was at the start (JSON), restored when the session is abandoned */
  private progressBefore = '';
  private stage: Stage = 'calibration';
  private raf = 0;
  private lastFrame = 0;
  private lastSampleAt = 0;
  private calT = 0;
  private overtime = 0;
  private completing = false;
  private simFocus = false;
  private broken = false;
  private ui: {
    wrap: HTMLElement; canvas: HTMLCanvasElement; hud: HTMLElement; overlay: HTMLElement;
    time: HTMLElement; clock: HTMLElement; hold: HTMLElement; pause: HTMLButtonElement;
    chip: HTMLElement | null; chipBar: HTMLElement | null; chipHold: HTMLElement | null; sim: HTMLButtonElement | null;
    dock: SignalDock; dockBtn: HTMLButtonElement; banner: HTMLElement; panel: MendiPanel; marks: HTMLElement;
    cal?: { bar: HTMLElement; text: HTMLElement; reason: HTMLElement; tip: HTMLElement };
  } | null = null;
  private tipTimer: ReturnType<typeof setInterval> | null = null;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * The coach mark and the block banner never show at once (on a phone they would cover each other): a hint
   * asked for while the banner is up waits for it, and one on screen when a banner comes is shown again after.
   */
  private hintNow: { text: string; at: { x: number; y: number } | null; ms: number; until: number } | null = null;
  private hintLater: { text: string; at: { x: number; y: number } | null; ms: number } | null = null;
  private countTimer: ReturnType<typeof setTimeout> | null = null;
  /** a pause asked for during the countdown: it takes effect when play begins */
  private pauseAtStart = false;
  /** keys and pointers the game saw go down: released for it when play pauses or the window loses focus */
  private readonly keysDown = new Set<string>();
  private readonly pointersDown = new Map<number, { x: number; y: number }>();
  private lastPct = -1;
  /** the game's block as of the last sample (the Mendi panel reads it every frame) */
  private phase: SignalPhase = FREE_PHASE;
  /** the primary input is a finger (read when a session starts) */
  private touch = false;
  /** the device's safe areas (re-read on every resize) */
  private safeArea: Insets = NO_INSETS;
  /** the canvas resolution's ceiling (device pixels per CSS px): adaptive resolution lowers it on a slow phone */
  private dprCap = 2;
  /** frame times over the current window of play, and the slow windows in a row */
  private perf = { sum: 0, n: 0, slow: 0 };
  /** the game's own update + draw time per frame (ms, smoothed), for the debug view */
  private frameMs = 0;
  /** what the canvas was last laid out for: a resize that changes nothing is not passed to the game */
  private sizeKey = '';
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  /** this session put the page in full screen (a phone): leaving the game takes it out again */
  private fullscreen = false;

  constructor(private readonly d: ArcadeDeps) {
    d.hub.addEventListener('sample', e => this.onSample((e as CustomEvent<HubSample>).detail));
    // a phone turned on its side: the first resize may come before the browser's bars settle, so look again
    const relayout = () => {
      this.resize();
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => { this.resizeTimer = null; this.resize(); }, 260);
    };
    window.addEventListener('resize', relayout);
    screen.orientation?.addEventListener?.('change', relayout);
    document.addEventListener('visibilitychange', () => {
      if (!this.active) return;
      if (document.hidden) {
        this.requestPause();
        this.audio?.suspend();
      } else if (!this.session?.paused || this.stage !== 'play') this.audio?.resume();
    });
    window.addEventListener('blur', () => this.releaseInputs());
    // the browser's back button changes the route under the game: stop the clock, the player decides
    window.addEventListener('hashchange', () => this.requestPause());
    document.addEventListener('keydown', e => this.onKey(e, true));
    document.addEventListener('keyup', e => this.onKey(e, false));
  }

  /**
   * From the "Graj" click: audio may only start inside the gesture, so it starts before any await.
   * `mod` and `progress` come from the lobby, which loaded them already.
   */
  start(entry: ArcadeEntry, mod: ArcadeModule, progress: object): void {
    if (this.active) return;
    const tool = this.d.hub.tool;
    if (!tool) throw new Error(t('run.noBand'));
    const prefs = this.d.settings.arcade;
    this.audio = new ArcadeAudio(prefs.volume, prefs.sound);
    this.audio.start();
    this.touch = coarsePointer();
    // a phone plays in full screen where the browser allows it (Android; an installed app already is): the
    // request must come inside the "Graj" tap, like the audio
    this.enterFullscreen();
    this.active = true;
    this.stage = 'calibration';
    this.entry = entry;
    this.mod = mod;
    this.progress = progress;
    this.completing = false;
    this.broken = false;
    this.overtime = 0;
    this.simFocus = false;
    this.pauseAtStart = false;
    this.keysDown.clear();
    this.pointersDown.clear();
    this.dprCap = 2;
    this.perf = { sum: 0, n: 0, slow: 0 };
    this.frameMs = 0;
    this.sizeKey = '';
    try {
      this.begin(entry, mod, progress, tool);
    } catch (e) {
      // game code failed before play: take the layer down again, so the app stays usable
      this.stopRun();
      this.session = null;
      this.leave();
      throw e;
    }
  }

  private begin(entry: ArcadeEntry, mod: ArcadeModule, progress: object, tool: Tool): void {
    const prefs = this.d.settings.arcade;
    this.bestBefore = mod.best(progress);
    // ?trainingSec=40 shortens a session (tests and demos), as in the focus training
    const override = Number(new URLSearchParams(location.search).get('trainingSec'));
    const planned = Number.isFinite(override) && override >= 10 ? Math.min(900, override) : prefs.minutes * 60;
    const beginner = this.d.history().length < BEGINNER_SESSIONS;
    const tuning: FocusTuning = { ...DEFAULT_TUNING, ...entry.tuning, ...(beginner ? BEGINNER_TUNING : {}) };
    const session = new ArcadeSession(tool, planned, tuning);
    // an abandoned session leaves no trace: what the game changes during play is undone on "Porzuć"
    this.progressBefore = JSON.stringify(progress);
    this.session = session;
    this.root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    // the layer is modal: the app underneath can be neither tabbed to nor clicked (the device sheet is outside it)
    document.querySelector('.app')?.setAttribute('inert', '');
    this.build();
    const day = dayKey();
    const env = {
      canvas: this.ui!.canvas, hud: this.ui!.hud, audio: this.audio!, progress, rng: mulberry32((Date.now() ^ 0x5bd1e995) >>> 0),
      day, daySeed: daySeed(entry.id, day), plannedSec: planned, tool, simulated: this.d.hub.status.source === 'simulator',
      reducedMotion: reducedMotion(), haptics: prefs.haptics, tuning,
      hint: (text: string, at?: { x: number; y: number } | null, ms = 3500) => this.hint(text, at ?? null, ms),
      hudTop: () => this.hudTop(),
      insets: () => this.insets(),
      touch: this.touch,
    };
    this.game = mod.create(env);
    this.resize();
    const epoch = tool === 'eeg' ? this.d.hub.eeg.epoch : this.d.hub.fnirs.epoch;
    const fresh = session.begin(this.carry, epoch);
    this.d.mark(`arcade:${entry.id}:start`);
    this.calT = 0;
    if (fresh) this.countdown(); else this.calibration();
    this.lastFrame = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  // ── the stage ───────────────────────────────────────────────────
  private build(): void {
    const entry = this.entry!;
    const canvas = h('canvas', { 'aria-hidden': 'true' });
    const hud = h('div', { class: 'arcade-hud' });
    const overlay = h('div', { class: 'arcade-overlay' });
    const timeBar = h('i');
    const clock = h('span', { class: 'arcade-clock mono' });
    const pause = h('button', { class: 'icon-btn arcade-pause', type: 'button', 'aria-label': t('run.pause') }, icon('i-pause'));
    pause.addEventListener('click', e => {
      e.stopPropagation();
      if (this.stage === 'play') this.setPaused(!this.session?.paused); else this.requestPause();
    });
    // the signal dock under the game: the band's chart in plain sight, switched in the top bar
    // the strategies start somewhere new each session, so the first block is not always the same task
    const dock = new SignalDock(this.session!.tool, entry.brain, Math.floor(Date.now() / 60_000) % 40);
    const banner = h('div', { class: 'arcade-banner', role: 'status', 'aria-live': 'polite', hidden: true });
    dock.onBlock = b => this.showBanner(b);
    const docked = this.d.settings.arcade.signal;
    const dockBtn = h('button', { class: 'icon-btn arcade-dock-btn', type: 'button', 'aria-label': t('dock.toggle'), title: t('dock.toggle'), 'aria-pressed': String(docked) }, icon('i-signal'));
    dockBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.setDocked(!this.d.settings.arcade.signal);
      wrap.focus({ preventScroll: true });
    });
    // how to play, any time: pauses and shows the same card as the calibration screen
    const help = h('button', { class: 'icon-btn arcade-help', type: 'button', 'aria-label': t('how.open'), title: t('how.open') }, '?');
    help.addEventListener('click', e => {
      e.stopPropagation();
      this.openHelp();
    });
    // the standard HUD (src/arcade/mendi.ts): the band's panel, the score, the coach mark
    const mod = this.mod!;
    const panel = new MendiPanel(entry, n => mod.unit?.(n) ?? entry.unit);
    panel.idle();
    const marks = h('div', { class: 'arcade-marks' }, panel.hint);
    const hold = h('div', { class: 'hold', hidden: true, role: 'status' });
    let chip: HTMLElement | null = null, chipBar: HTMLElement | null = null, chipHold: HTMLElement | null = null;
    if (entry.focusChip) {
      chipBar = h('i');
      chipHold = h('small');
      chip = h('div', { class: 'arcade-chip', title: t('run.chip') },
        icon('i-brain'), h('span', { class: 'arcade-chip-bar' }, chipBar, h('b')), chipHold);
    }
    // the simulator's switch sits in the top bar, so the bottom of the screen (a thumb's reach) is the game's
    let sim: HTMLButtonElement | null = null;
    if (this.d.hub.status.source === 'simulator') {
      sim = h('button', { class: 'btn sim-focus', type: 'button', 'aria-pressed': 'false', 'aria-label': t('run.simulate') },
        h('span', { class: 'sim-long' }, `▲ ${t('run.simulate')}`), h('span', { class: 'sim-short', 'aria-hidden': 'true' }, `▲ ${t('run.simulateShort')}`));
      sim.addEventListener('click', e => {
        e.stopPropagation();
        this.toggleSim();
        wrap.focus({ preventScroll: true });   // else Space and Enter (the games' keys) would press this button again
      });
    }
    const top = h('div', { class: 'arcade-top' },
      h('div', { class: 'arcade-time', role: 'progressbar', 'aria-label': t('run.time'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, timeBar),
      clock, sim, help, dockBtn, pause);
    const wrap = h('div', { class: docked ? 'arcade docked' : 'arcade', role: 'application', tabindex: '-1', 'aria-label': t('run.keys', { title: entry.title }) },
      canvas, hud, marks, panel.el, panel.score, dock.el, top, chip, hold, banner, overlay);
    if (this.touch) wrap.classList.add('touch');
    // a touch that began on the signal dock plays shifted onto the canvas's edge (see below), all its way
    const shift = new Map<number, { dx: number; dy: number }>();
    const pos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect(), s = shift.get(e.pointerId);
      return { x: e.clientX - r.left + (s?.dx ?? 0), y: e.clientY - r.top + (s?.dy ?? 0), id: e.pointerId };
    };
    const send = (type: 'down' | 'move' | 'up') => (e: PointerEvent) => {
      if (type === 'up') {
        const p = pos(e);
        shift.delete(e.pointerId);
        this.deliver('up', e, p, wrap, canvas);
      } else this.deliver(type, e, pos(e), wrap, canvas);
    };
    canvas.addEventListener('pointerdown', send('down'));
    canvas.addEventListener('pointermove', send('move'));
    canvas.addEventListener('pointerup', send('up'));
    canvas.addEventListener('pointercancel', send('up'));
    // On an upright phone the dock is where the thumb rests: a touch there (never the mouse, which reads the
    // chart) plays as a touch on the nearest point of the canvas's edge — a jump, a joystick, an aim — and the
    // whole gesture keeps that shift, so a tap stays a tap.  The dock has nothing of its own to press.
    dock.el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || this.stage !== 'play' || this.session?.paused || !this.game?.pointer) return;
      const r = canvas.getBoundingClientRect();
      const x0 = e.clientX - r.left, y0 = e.clientY - r.top;
      const x = Math.min(r.width - 1, Math.max(0, x0)), y = Math.min(r.height - 1, Math.max(0, y0));
      shift.set(e.pointerId, { dx: x - x0, dy: y - y0 });
      this.deliver('down', e, pos(e), wrap, canvas);
    });
    // (should the canvas not have taken the pointer over, its end still clears the shift)
    for (const end of ['pointerup', 'pointercancel'] as const) dock.el.addEventListener(end, e => { shift.delete(e.pointerId); });
    this.root.replaceChildren(wrap);
    this.ui = { wrap, canvas, hud, overlay, time: timeBar, clock, hold, pause, chip, chipBar, chipHold, sim, dock, dockBtn, banner, panel, marks };
    wrap.focus({ preventScroll: true });
  }

  /** A pointer event to the game (only during play), its capture on the canvas, and the record of what is down. */
  private deliver(type: 'down' | 'move' | 'up', e: PointerEvent, p: { x: number; y: number; id: number }, wrap: HTMLElement, canvas: HTMLCanvasElement): void {
    if (this.stage !== 'play' || this.session?.paused || !this.game?.pointer) return;
    if (type === 'down') {
      wrap.focus({ preventScroll: true });
      try { canvas.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
      this.pointersDown.set(p.id, p);
    } else if (type === 'move') {
      if (this.pointersDown.has(p.id)) this.pointersDown.set(p.id, p);
    } else this.pointersDown.delete(p.id);
    this.safe(() => this.game!.pointer!({ type, ...p }));
  }

  private resize(): void {
    if (!this.active || !this.ui || !this.game) return;
    const ui = this.ui;
    this.safeArea = safeAreas(ui.wrap);
    // the top bar's width (a phone on its side puts the score left of it) and the HUD's lower edge, for the
    // CSS that sits under it (the banner, the signal note, the dock's column)
    const bar = ui.pause.parentElement;
    if (bar) ui.wrap.style.setProperty('--top-w', `${Math.round(bar.getBoundingClientRect().width)}px`);
    const top = this.hudTop();
    ui.wrap.style.setProperty('--hud-b', `${top}px`);
    const r = ui.canvas.getBoundingClientRect();
    const dpr = Math.min(this.dprCap, window.devicePixelRatio || 1);
    const w = Math.max(1, r.width), hh = Math.max(1, r.height);
    const ins = this.insets();
    const key = `${w}x${hh}@${dpr}|${ins.top},${ins.right},${ins.bottom},${ins.left}`;
    if (key === this.sizeKey) return;
    this.sizeKey = key;
    ui.canvas.width = Math.round(w * dpr);
    ui.canvas.height = Math.round(hh * dpr);
    this.safe(() => this.game!.resize(w, hh, dpr));
    if (ui.wrap.classList.contains('docked')) ui.dock.resize();
    // a resized canvas is blank: while paused the loop does not draw, so draw the frame once here
    if (this.session?.paused) this.safe(() => this.game!.draw());
  }

  /** What covers the canvas's edges (GameEnv.insets): the HUD band at the top, the device's safe areas elsewhere. */
  private insets(): Insets {
    const ui = this.ui, sa = this.safeArea;
    if (!ui) return NO_INSETS;
    // an edge the dock covers (its strip below, or its column on the right of a phone on its side) is not the
    // device's edge: the dock keeps the home indicator's and the notch's room itself
    const c = ui.canvas.getBoundingClientRect(), w = ui.wrap.getBoundingClientRect();
    return {
      top: this.hudTop(),
      right: c.right < w.right - 1 ? 0 : sa.right,
      bottom: c.bottom < w.bottom - 1 ? 0 : sa.bottom,
      left: sa.left,
    };
  }

  /** Full screen for a phone's session where the browser has it (not on an iPhone; an installed app already is). */
  private enterFullscreen(): void {
    if (!this.touch || navigator.webdriver || document.fullscreenElement) return;
    const el = document.documentElement;
    if (typeof el.requestFullscreen !== 'function') return;
    try {
      if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return;
    } catch { /* no display-mode queries: ask anyway */ }
    this.fullscreen = true;
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { this.fullscreen = false; });
  }

  private exitFullscreen(): void {
    if (this.fullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    this.fullscreen = false;
  }

  /**
   * Adaptive resolution (PERF_*): a frame of play goes into the window; a window that ran slow twice in a
   * row lowers the canvas resolution by half a device pixel, down to 1.  It never goes back up in the
   * session, so the picture does not flicker between the two.
   */
  private watchFrames(dtMs: number): void {
    const p = this.perf;
    p.sum += dtMs;
    p.n++;
    if (p.sum < PERF_WINDOW_SEC * 1000) return;
    const mean = p.sum / p.n;
    p.sum = 0;
    p.n = 0;
    p.slow = mean > PERF_SLOW_MS ? p.slow + 1 : 0;
    const dpr = window.devicePixelRatio || 1;
    if (p.slow >= 2 && Math.min(this.dprCap, dpr) > 1) {
      p.slow = 0;
      this.dprCap = Math.max(1, Math.min(this.dprCap, dpr) - 0.5);
      this.resize();
    }
  }

  /** A game's coach mark (GameEnv.hint), held back while a block's banner is on screen. */
  private hint(text: string, at: { x: number; y: number } | null, ms: number): void {
    const ui = this.ui;
    if (!ui || this.stage !== 'play') return;
    if (text && !ui.banner.hidden) {
      this.hintLater = { text, at, ms };
      return;
    }
    if (!text) this.hintLater = null;
    this.hintNow = text ? { text, at, ms, until: performance.now() + ms } : null;
    ui.panel.showHint(text, at, ms, ui.canvas);
  }

  /** The canvas band the standard HUD covers at the top (CSS px from the canvas top). */
  private hudTop(): number {
    const ui = this.ui;
    if (!ui) return 0;
    const c = ui.canvas.getBoundingClientRect().top;
    const b = Math.max(ui.panel.el.getBoundingClientRect().bottom, ui.panel.score.getBoundingClientRect().bottom);
    return Math.max(0, Math.round(b - c + 6));
  }

  /** The "?" button: pause, and show how to play (the same card as on the calibration screen). */
  private openHelp(): void {
    const ui = this.ui, entry = this.entry, ses = this.session;
    if (!ui || !entry || !ses) return;
    if (this.stage !== 'play') return;
    if (!ses.paused) this.setPaused(true);
    const back = h('button', { class: 'btn primary big', type: 'button', on: { click: () => this.setPaused(false) } }, t('pause.resume'));
    ui.overlay.replaceChildren(h('div', { class: 'arcade-card arcade-help-card' },
      h('p', { class: 'eyebrow' }, t('how.eyebrow')),
      h('h2', null, entry.title),
      howToPlay(entry, this.mod?.howto?.() ?? null, ses.tool, this.touch),
      back));
    back.focus();
  }

  private toggleSim(): void {
    const ses = this.session;
    if (!ses || !this.ui?.sim) return;
    this.simFocus = !this.simFocus;
    this.ui.sim.setAttribute('aria-pressed', String(this.simFocus));
    this.ui.sim.classList.toggle('on', this.simFocus);
    const eeg = ses.tool === 'eeg';
    this.d.hub.setSimState(this.simFocus ? (eeg ? 'focus' : 'task') : (eeg ? 'baseline' : 'rest'));
  }

  /**
   * A push or rest block began: say over the game what to do in the head and what the band drives
   * (DESIGN §7.8), for a few seconds, never in the way of a tap (pointer-events: none).
   */
  private showBanner(b: BlockStart): void {
    const ui = this.ui;
    if (!ui) return;
    const title = b.want === 'rest' ? t('ban.rest') : b.blind ? t('ban.blind') : t('ban.focus');
    ui.banner.dataset.kind = b.want;
    ui.banner.replaceChildren(
      h('b', { class: 'ban-chip' }, title),
      h('p', { class: 'ban-task' }, `${t('task.label')}: ${b.task}`),
      h('p', { class: 'ban-link' }, `→ ${b.blind ? t('ban.blindNote') : b.effect}`));
    ui.banner.hidden = false;
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
    // a coach mark on screen steps aside for the banner and comes back after it
    const now = performance.now();
    if (this.hintNow && this.hintNow.until > now + 600) {
      this.hintLater = { ...this.hintNow, ms: this.hintNow.until - now };
      this.hintNow = null;
      ui.panel.showHint('', null, 0, ui.canvas);
    }
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      this.bannerTimer = null;
      if (this.ui !== ui) return;
      ui.banner.hidden = true;
      const later = this.hintLater;
      this.hintLater = null;
      if (later) this.hint(later.text, later.at, Math.max(1800, later.ms));
    }, BANNER_MS);
  }

  /** Show or hide the signal dock (a setting kept across sessions); the game's canvas takes the room. */
  private setDocked(on: boolean): void {
    const ui = this.ui;
    if (!ui) return;
    this.d.settings.arcade.signal = on;
    void this.d.save();
    ui.wrap.classList.toggle('docked', on);
    ui.dockBtn.setAttribute('aria-pressed', String(on));
    this.resize();
  }

  // ── calibration and countdown ──────────────────────────────────
  private setStage(stage: Stage): void {
    this.stage = stage;
    if (this.ui) this.ui.wrap.dataset.stage = stage;
  }

  private calibration(): void {
    this.setStage('calibration');
    const ui = this.ui!, entry = this.entry!;
    const bar = h('div'), text = h('p', { class: 'muted' }), reason = h('p', { class: 'calib-reason', role: 'status' });
    const tip = h('p', { class: 'arcade-tip', 'aria-live': 'polite' });
    ui.cal = { bar, text, reason, tip };
    ui.overlay.replaceChildren(h('div', { class: 'arcade-card' },
      h('p', { class: 'eyebrow' }, t('cal.eyebrow')),
      h('h2', null, t(this.session!.tool === 'fnirs' ? 'cal.fnirs' : 'cal.eeg')),
      h('div', { class: 'progress calib-bar' }, bar), text,
      h('p', { class: 'muted' }, t('cal.still')),
      tip, reason, howToPlay(entry, this.mod?.howto?.() ?? null, this.session!.tool, this.touch),
      h('button', { class: 'btn ghost', type: 'button', on: { click: () => this.cancel() } }, t('cal.back'))));
    let i = 0;
    const showTip = () => { tip.textContent = entry.tips[i++ % entry.tips.length]; };
    showTip();
    if (this.tipTimer) clearInterval(this.tipTimer);
    this.tipTimer = setInterval(showTip, 5000);
    this.renderCalibration();
  }

  private renderCalibration(): void {
    const ses = this.session!, cal = this.ui?.cal;
    if (!cal) return;
    const c = ses.core, st = this.d.hub.status.signal;
    const baseline = c.calStage === 'baseline';
    const p = baseline ? st.progress * 0.4 : 0.4 + c.calProgress * 0.6;
    cal.bar.style.width = `${Math.round(p * 100)}%`;
    cal.text.textContent = baseline ? t('cal.baseline', { pct: Math.round(st.progress * 100) }) : t('cal.reference', { pct: Math.round(c.calProgress * 100) });
    const r = c.reason && c.reason !== 'baseline' ? REASON_TEXT[c.reason] : c.warning ? WARNING_TEXT[c.warning] : '';
    if (cal.reason.textContent !== r) cal.reason.textContent = r;
    this.calT = p;
  }

  private countdown(): void {
    this.setStage('countdown');
    if (this.tipTimer) clearInterval(this.tipTimer);
    this.tipTimer = null;
    const ui = this.ui!, ses = this.session!;
    ui.cal = undefined;
    // the session clock (and its Tlen points) waits for "Start!", so a game's first block is whole
    ses.paused = true;
    const num = h('b', { class: 'arcade-count', 'aria-live': 'assertive' });
    ui.overlay.replaceChildren(num);
    this.d.mark(`arcade:${this.entry!.id}:calibrated`);
    let k = 0;
    const step = () => {
      this.countTimer = null;
      if (!this.active || this.stage !== 'countdown') return;
      if (k >= COUNTDOWN.length) {
        ui.overlay.replaceChildren();
        ses.paused = false;
        this.setStage('play');
        this.lastFrame = performance.now();
        this.safe(() => this.game!.start());
        if (this.pauseAtStart || document.hidden) {
          this.pauseAtStart = false;
          this.setPaused(true);
        }
        return;
      }
      num.textContent = COUNTDOWN[k];
      num.classList.remove('pop');
      void num.offsetWidth;
      num.classList.add('pop');
      this.audio?.tone(k < 3 ? 660 : 990, 0.18, { type: 'triangle', gain: 0.08 });
      k++;
      this.countTimer = setTimeout(step, k === COUNTDOWN.length ? 450 : 650);
    };
    step();
  }

  // ── the loop ───────────────────────────────────────────────────
  private loop = (ms: number): void => {
    if (!this.active || this.stage === 'summary') return;
    const rawMs = Math.max(0, ms - this.lastFrame);
    const dt = Math.min(0.05, rawMs / 1000);
    this.lastFrame = ms;
    const ses = this.session!, game = this.game!;
    const paused = ses.paused;
    const t0 = performance.now();
    if (this.stage === 'calibration' || this.stage === 'countdown') this.safe(() => game.intro(dt, this.stage === 'countdown' ? 1 : this.calT));
    else if (this.stage === 'play' && !paused) {
      const now = ses.t + Math.min(0.15, (ms - this.lastSampleAt) / 1000);
      this.safe(() => game.update(dt, ses.frame, now));
    }
    if (!paused || this.stage !== 'play') this.safe(() => game.draw());
    if (this.stage === 'play' && !paused && !document.hidden) {
      const cost = performance.now() - t0;
      this.frameMs = this.frameMs ? this.frameMs * 0.95 + cost * 0.05 : cost;
      // a frame after a pause, a hidden tab or a hitch of the browser says nothing about the game's pace
      if (rawMs < 250) this.watchFrames(rawMs);
    }
    if (this.ui?.wrap.classList.contains('docked')) this.ui.dock.draw();
    this.renderTop();
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Run game code; a failure ends the session gracefully instead of freezing the screen. */
  private safe(fn: () => void): void {
    if (this.broken) return;
    try {
      fn();
    } catch (e) {
      this.broken = true;
      console.error(e);
      toast(t('run.gameError', { msg: e instanceof Error ? e.message : String(e) }), true);
      if (this.session?.phase === 'play' && this.session.worthSaving) void this.complete();
      else this.cancel();
    }
  }

  private renderTop(): void {
    const ui = this.ui, ses = this.session;
    if (!ui || !ses) return;
    ui.time.style.width = `${(ses.progress * 100).toFixed(1)}%`;
    const pct = Math.round(ses.progress * 100);
    if (pct !== this.lastPct) {
      this.lastPct = pct;
      ui.time.parentElement?.setAttribute('aria-valuenow', String(pct));
    }
    const left = Math.max(0, ses.plannedSec - ses.t);
    const txt = this.stage !== 'play' ? '' : ses.timeUp ? t('run.overtime') : fmtDur(left);
    if (ui.clock.textContent !== txt) ui.clock.textContent = txt;
    if (this.stage === 'play') this.renderPanel();
    if (ui.chipBar) {
      const f = ses.frame;
      ui.chipBar.style.width = `${Math.round(f.level * 100)}%`;
      ui.chip!.classList.toggle('on', f.reliable && f.focused);
      ui.chip!.classList.toggle('off', !f.reliable);
      const hold = f.reliable && f.focused && f.hold >= 3 ? `${Math.floor(f.hold)} s` : '';
      if (ui.chipHold!.textContent !== hold) ui.chipHold!.textContent = hold;
    }
  }

  /** The Mendi panel and the score corner, every frame of play (they write only what changed). */
  private renderPanel(): void {
    const ui = this.ui, ses = this.session, game = this.game;
    if (!ui || !ses || !game) return;
    const f = ses.frame, ph = this.phase, c = ui.dock.coach;
    const rest = ph.want === 'rest';
    let meter: number | null = f.reliable && !ph.blind ? (rest ? f.calm : f.level) : null;
    // the game's own quantity; a null from it while the signal is fine and in sight (a lead-in, a card)
    // keeps the plain level or calm, so the gauge never reads "—" in a working block
    if (game.meter && meter !== null) this.safe(() => { const m = game.meter!(); if (m !== null && Number.isFinite(m)) meter = m; });
    const on = meter !== null && (rest ? !f.focused && meter >= 0.5 : meter >= 0.5);
    ui.panel.update({
      want: ph.want, blind: ph.blind, sec: c.blockSec, left: ph.left ?? null, next: ph.next ?? null,
      meter, on, task: ui.dock.strategy, state: c.state,
      stateText: stateText(c.state, c.activity !== null ? c.activity - c.threshold : 0, c.lagSec),
    });
    if (game.headline) this.safe(() => ui.panel.setScore(game.headline!()));
    else ui.panel.setScore(null);
  }

  private renderHold(): void {
    const ses = this.session!, ui = this.ui;
    if (!ui) return;
    const c = ses.core;
    const reason = c.recalibrating ? t('note.recalibrating', { pct: Math.round(c.meter.calProgressNow * 100) })
      : c.reliable ? '' : c.reason ? REASON_TEXT[c.reason] : t('note.waiting');
    const note = reason || (c.warning ? WARNING_TEXT[c.warning].split(';')[0] : '');
    ui.hold.hidden = !note;
    ui.hold.classList.toggle('soft', !reason && !!note);
    if (ui.hold.textContent !== note) ui.hold.textContent = note;
  }

  private onSample(s: HubSample): void {
    const ses = this.session;
    if (!this.active || !ses || this.stage === 'summary') return;
    const tick = ses.onSample(s);
    this.lastSampleAt = performance.now();
    if (this.stage === 'calibration') {
      if (tick.calibrated) this.countdown(); else this.renderCalibration();
      return;
    }
    if (this.stage !== 'play' || ses.paused) return;
    if (this.ui) {
      let phase = FREE_PHASE;
      if (this.game?.signal) this.safe(() => { phase = this.game!.signal!(); });
      this.phase = phase;
      this.ui.dock.push(ses.t, tick.frame, phase, s.dt);
    }
    let pad: number | null = tick.frame.reliable ? tick.frame.level : 0;
    if (this.game?.padLevel) this.safe(() => { pad = this.game!.padLevel!(tick.frame); });
    if (pad !== null && Number.isFinite(pad)) this.audio?.focus(pad);
    this.renderHold();
    if (ses.timeUp && !this.completing) {
      this.overtime += s.dt;
      let stop = this.overtime >= OVERTIME_SEC;
      if (!stop) this.safe(() => { stop = this.game!.canStop(); });
      if (stop) void this.complete();
    }
  }

  // ── pause, keys ────────────────────────────────────────────────
  /** Pause if playing; during the countdown, pause as soon as play begins (a hidden tab, Escape, the back button). */
  private requestPause(): void {
    if (!this.active) return;
    this.releaseInputs();
    if (this.stage === 'countdown') this.pauseAtStart = true;
    else if (this.stage === 'play' && !this.session?.paused) this.setPaused(true);
  }

  /** Tell the game that every key and pointer it saw go down is up again (it would not hear it while paused). */
  private releaseInputs(): void {
    const game = this.game;
    if (game && this.stage === 'play') {
      for (const k of this.keysDown) this.safe(() => { game.key?.(k, false); });
      for (const [id, p] of this.pointersDown) this.safe(() => game.pointer?.({ type: 'up', x: p.x, y: p.y, id }));
    }
    this.keysDown.clear();
    this.pointersDown.clear();
  }

  private setPaused(on: boolean): void {
    const ses = this.session, ui = this.ui;
    if (!ses || !ui || this.stage === 'summary' || this.completing) return;
    if (this.stage !== 'play') {
      if (on && this.stage === 'calibration') this.cancel();   // the pause button during calibration means "back"
      else if (this.stage === 'countdown') this.pauseAtStart = on;
      return;
    }
    if (on) this.releaseInputs();
    ses.paused = on;
    this.safe(() => this.game?.pause?.(on));
    if (on) {
      this.audio?.suspend();
      const keep = ses.worthSaving;
      ui.overlay.replaceChildren(h('div', { class: 'arcade-card' },
        h('p', { class: 'eyebrow' }, t('pause.eyebrow')),
        h('h2', null, this.entry!.title),
        h('p', { class: 'muted' }, t(keep ? 'pause.played' : 'pause.playedShort', { played: fmtDur(ses.t), planned: fmtDur(ses.plannedSec) })),
        h('div', { class: 'row center' },
          h('button', { class: 'btn primary big', type: 'button', on: { click: () => this.setPaused(false) } }, t('pause.resume')),
          keep ? h('button', { class: 'btn big', type: 'button', on: { click: () => void this.complete() } }, t('pause.save')) : null,
          h('button', { class: 'btn ghost big', type: 'button', on: { click: () => this.cancel() } }, t(keep ? 'pause.discard' : 'pause.leave'))),
        h('button', { class: 'btn ghost', type: 'button', on: { click: () => this.d.openSheet() } }, icon('i-bt'), t('pause.band', { band: BAND_NAME[ses.tool] }))));
      (ui.overlay.querySelector('.btn.primary') as HTMLButtonElement | null)?.focus();
    } else {
      ui.overlay.replaceChildren();
      this.audio?.resume();
      this.lastFrame = performance.now();
      ui.wrap.focus({ preventScroll: true });
    }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (!this.active || this.stage === 'summary') return;
    // the device sheet (a modal dialog) is open over the game: its keys, its Escape
    if (document.querySelector('dialog[open]')) return;
    // keys aimed at something outside the layer (a field somewhere under it) are not the game's
    const target = e.target instanceof Element ? e.target : null;
    if (target && target !== document.body && target !== document.documentElement && !this.root.contains(target)) return;
    if (e.key === 'Escape') {
      if (down) {
        e.preventDefault();
        if (this.stage === 'play') this.setPaused(!this.session?.paused);
        else this.setPaused(true);   // calibration: back to the lobby; countdown: pause once play begins
      }
      return;
    }
    if (this.stage !== 'play' || this.session?.paused || !this.game?.key) return;
    if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;   // a focused button gets its own click
    if (down) this.keysDown.add(e.key); else if (!this.keysDown.delete(e.key)) return;   // an up without its down
    let used = false;
    this.safe(() => { used = this.game!.key!(e.key, down); });
    if (used) e.preventDefault();
  }

  // ── the end ────────────────────────────────────────────────────
  private stopRun(): void {
    cancelAnimationFrame(this.raf);
    if (this.tipTimer) clearInterval(this.tipTimer);
    this.tipTimer = null;
    if (this.countTimer) clearTimeout(this.countTimer);
    this.countTimer = null;
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = null;
    this.hintNow = null;
    this.hintLater = null;
    this.ui?.panel.destroy();
    this.keysDown.clear();
    this.pointersDown.clear();
    try { this.game?.destroy(); } catch (e) { console.error(e); }
    this.game = null;
    this.audio?.stop();
    this.audio = null;
    if (this.simFocus) {
      this.d.hub.setSimState(this.session?.tool === 'eeg' ? 'baseline' : 'rest');
      this.simFocus = false;
    }
  }

  /** For the smoke test and the console (?debug): where the run is. */
  get debug(): {
    stage: Stage; t: number; level: number; reliable: boolean; outcome: ArcadeOutcome | null;
    targets: TapTarget[] | null; insets: Insets; touch: boolean; dpr: number; frameMs: number;
  } | null {
    const ses = this.session;
    if (!this.active || !ses) return null;
    let outcome: ArcadeOutcome | null = null;
    try { outcome = this.game?.result() ?? null; } catch { /* mid-update */ }
    let targets: TapTarget[] | null = null;
    try { targets = this.game?.targets?.() ?? null; } catch { /* mid-update */ }
    const dpr = this.ui ? this.ui.canvas.width / Math.max(1, this.ui.canvas.getBoundingClientRect().width) : 0;
    return {
      stage: this.stage, t: ses.t, level: ses.frame.level, reliable: ses.frame.reliable, outcome,
      targets, insets: this.insets(), touch: this.touch, dpr: Math.round(dpr * 100) / 100, frameMs: Math.round(this.frameMs * 100) / 100,
    };
  }

  /** Leave without saving (calibration "Wróć", pause "Porzuć" / "Wyjdź"). */
  cancel(): void {
    if (!this.active || this.completing) return;
    const ses = this.session;
    if (ses && ses.phase === 'play') this.d.mark(`arcade:${this.entry!.id}:end`);
    this.carry = ses?.carry() ?? this.carry;
    this.stopRun();
    this.restoreProgress();
    this.session = null;
    this.leave();
  }

  /** Undo what the abandoned session changed in the game's progress (the lobby holds the same object). */
  private restoreProgress(): void {
    const p = this.progress as Record<string, unknown> | null;
    if (!p || !this.progressBefore) return;
    for (const k of Object.keys(p)) delete p[k];
    Object.assign(p, JSON.parse(this.progressBefore));
  }

  private leave(): void {
    this.active = false;
    this.ui = null;
    this.exitFullscreen();
    this.root.hidden = true;
    this.root.replaceChildren();
    document.documentElement.style.overflow = '';
    document.querySelector('.app')?.removeAttribute('inert');
    this.d.onExit();
  }

  private async complete(): Promise<void> {
    const ses = this.session, entry = this.entry!;
    if (!ses || this.completing) return;
    this.completing = true;
    let outcome: ArcadeOutcome = { score: 0, unit: entry.unit, record: false, stats: [], highlights: [] };
    const game = this.game;
    if (game && !this.broken) {
      try { game.finish?.(); } catch (e) { console.error(e); }
      try { outcome = game.result(); } catch (e) { console.error(e); }
    }
    // a game that failed mid-play may have left its progress half-changed: keep the training, not that
    if (this.broken) this.restoreProgress();
    const best = this.bestBefore;
    ses.finish();
    this.carry = ses.carry();
    this.stopRun();
    this.d.mark(`arcade:${entry.id}:end`);
    const st = this.d.hub.status;
    const before = await this.d.db.listTrainings().catch(() => [] as TrainingResult[]);
    const result = ses.toResult({
      id: `game_${entry.id}_${Date.now()}`, source: st.source === 'device' ? 'device' : 'simulator',
      device: st.source === 'device' ? (st.device.name ?? TOOL_INFO[ses.tool].device) : t('run.simulator'),
    }, { id: entry.id, title: entry.title.replace(/\u00ad/g, ''), score: outcome.score, unit: outcome.unit, best, stats: outcome.stats });
    try {
      await Promise.all([this.d.db.putTraining(result), saveProgress(this.d.db, entry.id, this.progress!)]);
    } catch (e) {
      toast(t('run.saveError', { msg: e instanceof Error ? e.message : String(e) }), true);
    }
    const all = [result, ...before];
    this.d.onSaved(result);
    this.summary(result, outcome, dayScore(all), newMilestones(before, result));
  }

  private summary(r: TrainingResult, o: ArcadeOutcome, day: ReturnType<typeof dayScore>, miles: { title: string }[]): void {
    this.setStage('summary');
    const entry = this.entry!, mod = this.mod!, progress = this.progress!;
    const signPct = (v: number | null) => (v === null ? '—' : t('sum.pct', { v: fmtSigned(v, 1) }));
    /** a count, or a score with decimals should a game ever give one */
    const num = (v: number) => fmtNum(v, Number.isInteger(v) ? 0 : 1);
    const stat = (k: string, v: string, unit = '') => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
    const ring = h('div', { class: 'ring', role: 'img', 'aria-label': t('sum.ring', { score: day.score }) }, h('b', null, String(day.score)));
    ring.style.setProperty('--p', String(day.score));
    const overview = h('canvas', { class: 'overview', 'aria-label': t('sum.curve') });
    const again = h('button', { class: 'btn primary big', type: 'button' }, t('sum.again'));
    again.addEventListener('click', run(() => {
      this.active = false;
      this.ui = null;
      this.start(entry, mod, progress);
    }));
    const el = h('div', { class: 'summary arcade-summary' }, h('div', { class: 'summary-inner' },
      h('div', { class: 'arcade-score' },
        h('p', { class: 'eyebrow' }, entry.title),
        h('div', { class: 'arcade-big' }, h('b', null, num(o.score)), h('span', null, o.unit)),
        o.record ? h('p', { class: 'arcade-record' }, icon('i-star'), t('sum.record'))
          : r.game?.best !== null && r.game?.best !== undefined
            ? h('p', { class: 'muted' }, t('sum.best', { score: num(r.game.best), unit: mod.unit?.(r.game.best) ?? entry.unit })) : null),
      o.highlights.map(line => h('div', { class: 'milestone' }, icon('i-star'), line)),
      o.verse ? verseSlot(o.verse) : null,
      o.stats.length ? h('div', { class: 'summary-grid' }, o.stats.slice(0, 8).map(([k, v]) => stat(k, v))) : null,
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, t('sum.training'), h('span', { class: 'hint' }, t('sum.trainingHint'))),
        h('div', { class: 'summary-grid' },
          stat(t('sum.activity'), signPct(r.activity_avg_pct)), stat(t('sum.control'), num(r.control_sec), 's'),
          stat(t('sum.oxygen'), num(r.points), t('sum.points')), stat(t('sum.session'), fmtDur(r.played_sec), 'min')),
        overview),
      h('div', { class: 'summary-top' }, ring, h('div', null,
        h('p', { class: 'eyebrow' }, t('sum.day')),
        h('h2', null, day.label),
        h('p', { class: 'muted' }, t(r.source === 'simulator' ? 'sum.dayPartsSim' : 'sum.dayParts', { commitment: day.commitment, performance: day.performance })),
        day.streak > 0 ? h('p', { class: 'streak mt8' }, icon('i-flame'), t('sum.streak', { n: day.streak })) : null,
        day.rested ? h('p', { class: 'muted' }, t('sum.rested')) : null)),
      miles.map(m => h('div', { class: 'milestone' }, icon('i-star'), t('sum.milestone', { title: m.title }))),
      h('div', { class: 'row arcade-again' }, again,
        h('button', { class: 'btn big', type: 'button', on: { click: () => { this.session = null; this.leave(); } } }, t('sum.done')))));
    this.root.replaceChildren(el);
    again.focus({ preventScroll: true });
    requestAnimationFrame(() => drawOverview(overview, r.series, entry.fill));
  }
}
