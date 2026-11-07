/**
 * The standard HUD every arcade game shares (DESIGN.md §10.2), so the band reads the same in all of them:
 *
 *   the Mendi panel   top left: the block (Skupienie / Odpoczynek / Na wyczucie / Swobodnie) with its
 *                     seconds, the gauge of what the band drives in this game with the threshold at its
 *                     middle, what to do in the head, and the verdict in plain words
 *   the score         top right: the game's headline number, its unit, one short line under it
 *   the coach mark    a bubble a game points at something with (tutorials, first-time explanations)
 *   how to play       the card on the calibration screen and behind the "?" button: the goal, the hands,
 *                     what focus and rest drive, how the gauge works
 *
 * The runner owns these (src/arcade/runner.ts); a game only says what goes in them (kit/types.ts:
 * `signal()`, `meter()`, `headline()`, `env.hint()`, the module's `howto()`).  The dock under the game
 * keeps the history: the chart, the last block's verdict, the session's contrast.
 */
import { fmtNum } from '../i18n';
import { t } from '../i18n/arcade';
import type { Tool } from '../tools';
import { h } from '../ui/dom';
import type { CoachState } from './kit/coach';
import { STATE_TONE } from './kit/coach';
import type { Gesture, HowTo } from './kit/types';
import type { TracePhase } from './kit/trace';
import type { ArcadeEntry } from './registry';

/** What the panel shows this frame (the runner gathers it from the game, the dock and the focus). */
export interface PanelState {
  want: TracePhase;
  blind: boolean;
  /** seconds into the block, and left in it when the game says */
  sec: number;
  left: number | null;
  next: TracePhase | null;
  /** the gauge 0..1 (0.5 = the threshold), null = hidden (blind, no signal) */
  meter: number | null;
  /** the gauge is "on": above the threshold in focus, calm enough in rest */
  on: boolean;
  task: string;
  state: CoachState;
  stateText: string;
}

const GESTURE_PATH: Record<Gesture, string> = {
  // 24×24 line icons: a fingertip and what it does
  tap: 'M12 13a2 2 0 1 0 0-.01M12 5v2M6.3 7.3l1.4 1.4M17.7 7.3l-1.4 1.4M5 13h2M17 13h2',
  hold: 'M12 14a3 3 0 1 0 0-.01M12 4a10 10 0 1 1-.01 0',
  drag: 'M6 16a2 2 0 1 0 0-.01M8 16h9M14 13l3 3-3 3M6 8h0',
  swipe: 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4',
  steer: 'M12 12a2 2 0 1 0 0-.01M12 3a9 9 0 1 1-.01 0M12 3v4M21 12h-4M12 21v-4M3 12h4',
  keys: 'M3 7h18v10H3zM7 11h0M11 11h0M15 11h0M7 14h10',
};

function gestureIcon(g: Gesture): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', GESTURE_PATH[g]);
  svg.append(p);
  return svg;
}

const mmss = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export class MendiPanel {
  readonly el: HTMLElement;
  readonly score: HTMLElement;
  readonly hint: HTMLElement;
  private readonly chip: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly next: HTMLElement;
  private readonly meterName: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly value: HTMLElement;
  private readonly task: HTMLElement;
  private readonly state: HTMLElement;
  private readonly scoreNum: HTMLElement;
  private readonly scoreUnit: HTMLElement;
  private readonly scoreSub: HTMLElement;
  private readonly hintText: HTMLElement;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private memo: Record<string, string> = {};
  private lastScore = NaN;

  constructor(readonly entry: ArcadeEntry, private readonly unitOf: (n: number) => string) {
    this.chip = h('b', { class: 'mp-chip' });
    this.clock = h('span', { class: 'mp-clock mono' });
    this.next = h('span', { class: 'mp-next' });
    this.meterName = h('span', { class: 'mp-name' });
    this.fill = h('i');
    this.bar = h('span', { class: 'mp-bar' }, this.fill, h('em'));
    this.value = h('b', { class: 'mp-val mono' });
    this.task = h('p', { class: 'mp-task' });
    this.state = h('p', { class: 'mp-state' });
    this.el = h('section', { class: 'arcade-mendi', 'aria-label': t('mp.label'), 'data-want': 'free' },
      h('div', { class: 'mp-row' }, this.chip, this.clock, this.next),
      h('div', { class: 'mp-meter' }, this.meterName, this.bar, this.value),
      this.task, this.state);
    this.scoreNum = h('b', { class: 'mono' });
    this.scoreUnit = h('span');
    this.scoreSub = h('small');
    this.score = h('div', { class: 'arcade-headline', 'aria-live': 'off' }, h('p', null, this.scoreNum, this.scoreUnit), this.scoreSub);
    this.hintText = h('span');
    this.hint = h('div', { class: 'arcade-hint', role: 'status', 'aria-live': 'polite', hidden: true }, this.hintText);
  }

  private put(key: string, el: HTMLElement, text: string): void {
    if (this.memo[key] === text) return;
    this.memo[key] = text;
    el.textContent = text;
  }

  private attr(key: string, el: HTMLElement, name: string, v: string): void {
    if (this.memo[key] === v) return;
    this.memo[key] = v;
    el.setAttribute(name, v);
  }

  /** Before play: the block reads "calibration", the gauge waits. */
  idle(): void {
    this.attr('want', this.el, 'data-want', 'free');
    this.put('chip', this.chip, t('mp.calib'));
    this.put('clock', this.clock, '');
    this.put('next', this.next, '');
    this.put('name', this.meterName, this.entry.brain.meter);
    this.put('val', this.value, '—');
    this.fill.style.width = '0%';
    this.put('task', this.task, '');
    this.put('state', this.state, '');
  }

  update(s: PanelState): void {
    const want = s.blind && s.want === 'focus' ? 'blind' : s.want;
    this.attr('want', this.el, 'data-want', want);
    this.put('chip', this.chip, t(want === 'blind' ? 'ban.blind' : want === 'focus' ? 'ban.focus' : want === 'rest' ? 'ban.rest' : 'mp.free'));
    this.put('clock', this.clock, s.want === 'free' ? '' : s.left !== null ? mmss(s.left) : mmss(s.sec));
    const nx = s.next && s.next !== s.want ? t('mp.next', { block: t(s.next === 'focus' ? 'ban.focus' : s.next === 'rest' ? 'ban.rest' : 'mp.free') }) : '';
    this.put('next', this.next, nx);
    this.put('name', this.meterName, s.want === 'rest' ? this.entry.brain.meterRest : this.entry.brain.meter);
    const shown = s.meter !== null && Number.isFinite(s.meter);
    const v = shown ? Math.max(0, Math.min(1, s.meter!)) : 0;
    const w = `${(v * 100).toFixed(1)}%`;
    if (this.memo.w !== w) { this.memo.w = w; this.fill.style.width = w; }
    this.attr('on', this.bar, 'data-on', String(shown && s.on));
    this.put('val', this.value, shown ? `${Math.round(v * 100)}%` : '—');
    this.put('task', this.task, s.task ? `${t('task.label')}: ${s.task}` : '');
    this.attr('tone', this.state, 'data-tone', STATE_TONE[s.state]);
    this.put('state', this.state, s.stateText);
  }

  /** The game's headline (`null`: the game gives none; the corner hides). */
  setScore(v: { value: number; sub?: string } | null): void {
    this.score.hidden = v === null;
    if (!v) return;
    if (v.value !== this.lastScore) {
      const grew = v.value > this.lastScore;
      this.lastScore = v.value;
      this.put('sn', this.scoreNum, fmtNum(v.value, Number.isInteger(v.value) ? 0 : 1));
      this.put('su', this.scoreUnit, this.unitOf(v.value));
      if (grew) {
        this.score.classList.remove('bump');
        void this.score.offsetWidth;
        this.score.classList.add('bump');
      }
    }
    this.put('ss', this.scoreSub, v.sub ?? '');
  }

  /** The coach mark: a bubble at a canvas point (CSS px), or centred over the play area. */
  showHint(text: string, at: { x: number; y: number } | null | undefined, ms: number, canvas: HTMLCanvasElement): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    if (!text) { this.hint.hidden = true; return; }
    this.hintText.textContent = text;
    this.hint.hidden = false;
    const cw = canvas.clientWidth || 1, ch = canvas.clientHeight || 1;
    if (at) {
      // the bubble sits above the point (below it when the point is near the top), its arrow on the point
      const below = at.y < ch * 0.3;
      this.hint.dataset.at = below ? 'below' : 'above';
      this.hint.style.left = `${Math.max(12, Math.min(cw - 12, at.x))}px`;
      this.hint.style.top = `${at.y}px`;
    } else {
      this.hint.dataset.at = 'centre';
      this.hint.style.left = `${cw / 2}px`;
      this.hint.style.top = `${ch * 0.42}px`;
    }
    this.hint.classList.remove('show');
    void this.hint.offsetWidth;
    this.hint.classList.add('show');
    this.hintTimer = setTimeout(() => { this.hint.hidden = true; }, Math.max(1200, ms));
  }

  destroy(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
  }
}

/**
 * The standard "how to play" block: the goal, the hands (gesture icons), what focus and rest drive
 * (the registry's words), and how the gauge reads.  The same in every game.
 */
export function howToPlay(entry: ArcadeEntry, howto: HowTo | null, tool: Tool): HTMLElement {
  const row = (kind: string, chip: string, body: Node | string, icon?: SVGSVGElement) =>
    h('li', { 'data-kind': kind }, h('b', { class: 'ban-chip' }, icon ?? null, chip), h('span', null, body));
  const hands = howto?.hands.length
    ? howto.hands.map(c => row('hands', t(`gest.${c.gesture}`), c.text, gestureIcon(c.gesture)))
    : [row('hands', t('cal.handsTitle'), entry.how[2] ?? '')];
  return h('div', { class: 'arcade-howbrain' },
    h('p', { class: 'eyebrow' }, t('how.title')),
    howto?.goal ? h('p', { class: 'how-goal' }, howto.goal) : null,
    h('ul', null,
      hands,
      row('focus', t('ban.focus'), `→ ${entry.brain.focus}`),
      row('rest', t('ban.rest'), `→ ${entry.brain.rest}`)),
    howto?.tips?.length ? h('ul', { class: 'how-tips' }, howto.tips.slice(0, 2).map(x => h('li', null, x))) : null,
    h('p', { class: 'muted' }, t(tool === 'eeg' ? 'how.meterEeg' : 'how.meter', { meter: entry.brain.meter })));
}
