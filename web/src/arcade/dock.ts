/**
 * The signal dock (DESIGN.md §7.7): a strip under every arcade game with the band's signal as a plain
 * chart and what it means in words.  The games draw the signal in their own world (kit/trace.ts);
 * the dock is the same truth without the metaphor, for the player who asks "is what I am doing
 * reaching my brain?" —
 *
 *   the chart     the last CHART_SEC of activity % against the calibration (0), the adaptive
 *                 threshold dashed, gold above it, the blocks as bands, gaps where the signal
 *                 failed, a veil over a blind block, the band's delay bracketed at "now"
 *   now           the block and its seconds, a verdict in plain words (kit/coach.ts), the numbers
 *   the block     whether the block that just ended moved the brain against the one before
 *   the session   focus − rest so far
 *
 * The runner feeds it every tick of play; it holds no game state of its own.
 */
import { fmtSigned } from '../i18n';
import { BAND_NAME, t } from '../i18n/arcade';
import type { Tool } from '../tools';
import { h } from '../ui/dom';
import { SignalCoach, STATE_TONE, type BlockReport, type CoachState } from './kit/coach';
import type { FocusFrame } from './kit/focus';
import { LAG_SEC, SignalTrace, drawTrace, type TraceStyle } from './kit/trace';
import type { SignalPhase } from './kit/types';

/** Seconds of history on the chart. */
export const CHART_SEC = 45;

/** What the dock's text shows; set() writes only what changed. */
interface DockText { eyebrow: string; state: string; tone: string; nums: string; block: string; session: string }

const pct = (v: number) => t('sum.pct', { v: fmtSigned(v, 1) });

const STYLE = (lag: number): TraceStyle => ({
  line: '#eef0f7', above: '#ffd27a', lineWidth: 2, aboveFill: 'rgba(255,210,122,.26)', threshold: 'rgba(255,210,122,.85)',
  focusBand: 'rgba(255,160,80,.10)', restBand: 'rgba(110,170,255,.13)', gap: 'rgba(255,255,255,.4)', veil: 'rgba(40,34,58,.94)',
  now: '#ffffff', glow: 'rgba(255,255,255,.22)',
  lag: { sec: lag, color: 'rgba(255,255,255,.6)' },
});

export class SignalDock {
  readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly eyebrow: HTMLElement;
  private readonly state: HTMLElement;
  private readonly nums: HTMLElement;
  private readonly block: HTMLElement;
  private readonly session: HTMLElement;
  private readonly trace = new SignalTrace(CHART_SEC, 0.1);
  readonly coach: SignalCoach;
  private readonly lag: number;
  private readonly style: TraceStyle;
  private w = 0;
  private hh = 0;
  private dpr = 1;
  private now = 0;
  private wasBlind = false;
  private playing = false;
  private text: DockText = { eyebrow: '', state: '', tone: '', nums: '', block: '', session: '' };

  constructor(readonly tool: Tool) {
    this.lag = LAG_SEC[tool];
    this.coach = new SignalCoach(this.lag);
    this.style = STYLE(this.lag);
    this.canvas = h('canvas', { role: 'img', 'aria-label': t('dock.chart', { n: CHART_SEC }) });
    this.ctx = this.canvas.getContext('2d');
    this.eyebrow = h('p', { class: 'dock-eyebrow' });
    this.state = h('p', { class: 'dock-state', role: 'status' });
    this.nums = h('p', { class: 'dock-nums mono' });
    this.block = h('p', { class: 'dock-block' });
    this.session = h('p', { class: 'dock-session' });
    this.el = h('section', { class: 'arcade-dock', 'aria-label': t('dock.title', { band: BAND_NAME[tool] }) },
      h('div', { class: 'dock-chart' }, this.canvas),
      h('div', { class: 'dock-text' }, this.eyebrow, this.state, this.nums, this.block, this.session));
    this.idle();
  }

  /** Before play (calibration, countdown): the chart is empty and says when it starts. */
  idle(): void {
    this.playing = false;
    this.set({ eyebrow: t('dock.title', { band: BAND_NAME[this.tool] }), state: t('dock.cal'), tone: 'idle', nums: '', block: '', session: '' });
  }

  /** The dock's size changed (it was shown, the window resized). */
  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(0, r.width);
    this.hh = Math.max(0, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.hh * this.dpr);
    this.draw();
  }

  /** One tick of play: `t` = seconds of play, `phase` = the game's block. */
  push(tSec: number, f: FocusFrame, phase: SignalPhase, dt: number): void {
    this.playing = true;
    this.now = tSec;
    if (this.wasBlind && !phase.blind) this.trace.unveil(tSec);
    this.wasBlind = phase.blind;
    this.trace.push(tSec, f, phase.want, phase.blind);
    this.coach.push(tSec, f, phase, dt);
    this.render();
  }

  private render(): void {
    const c = this.coach;
    const sec = Math.floor(c.blockSec);
    const eyebrow = c.want === 'free' ? t('want.free') : t(c.blind ? 'want.blind' : c.want === 'focus' ? 'want.focus' : 'want.rest', { s: sec });
    const tone = STATE_TONE[c.state];
    const nums = c.blind ? '' : c.activity === null || c.state === 'nosignal'
      ? t('dock.nowNone', { th: pct(c.threshold) })
      : t('dock.now', { v: pct(c.activity), th: pct(c.threshold) });
    const con = c.contrast.contrast;
    this.set({
      eyebrow, tone, nums,
      state: stateText(c.state, c.activity !== null ? c.activity - c.threshold : 0, this.lag),
      block: reportText(c.report),
      session: con === null ? t('sess.none') : t('sess', { d: pct(con) }),
    });
  }

  private set(x: DockText): void {
    const o = this.text;
    if (o.eyebrow !== x.eyebrow) this.eyebrow.textContent = x.eyebrow;
    if (o.state !== x.state) this.state.textContent = x.state;
    if (o.tone !== x.tone) this.state.dataset.tone = x.tone;
    if (o.nums !== x.nums) this.nums.textContent = x.nums;
    if (o.block !== x.block) this.block.textContent = x.block;
    if (o.session !== x.session) this.session.textContent = x.session;
    this.text = x;
  }

  /** Every animation frame. */
  draw(): void {
    const ctx = this.ctx, w = this.w, hh = this.hh;
    if (!ctx || w < 20 || hh < 20) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const box = { x: 40, y: 14, w: w - 40 - 34, h: hh - 14 - 14 };
    if (box.w < 40 || box.h < 16) return;
    const font = (wt: number, px: number) => `${wt} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    if (!this.playing || this.trace.samples.length < 2) {
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + box.h / 2);
      ctx.lineTo(box.x + box.w, box.y + box.h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    const L = this.trace.layout(box, this.now, { span: CHART_SEC, minSpan: 4 });

    // the calibration's 0, when it is in sight: where this session started from
    ctx.font = font(600, 10);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const yHi = box.y + 5, yLo = box.y + box.h - 5;
    let y0: number | null = null;
    if (L.lo < 0 && L.hi > 0) {
      y0 = L.yOf(0);
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath();
      ctx.moveTo(box.x, y0);
      ctx.lineTo(box.x + box.w, y0);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillText('0', box.x - 6, y0);
    }
    // the scale: the top and bottom of the window, where the 0 leaves them room
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    if (y0 === null || Math.abs(y0 - yHi) > 11) ctx.fillText(axis(L.hi), box.x - 6, yHi);
    if (y0 === null || Math.abs(y0 - yLo) > 11) ctx.fillText(axis(L.lo), box.x - 6, yLo);

    drawTrace(ctx, L, this.style);
    const last = L.points[L.points.length - 1];
    if (!last) return;

    // over the chart: the delay's name, right-aligned on its bracket, then the bands' names where there is room
    ctx.font = font(650, 10);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    const lagText = t('dock.lag', { n: this.lag });
    ctx.fillText(lagText, last.x, box.y - 1);
    const lagLeft = last.x - ctx.measureText(lagText).width - 8;
    ctx.textAlign = 'left';
    for (const b of L.bands) {
      const name = b.veiled ? t('dock.veil') : b.phase === 'focus' ? t('dock.focus') : b.phase === 'rest' ? t('dock.rest') : '';
      if (!name) continue;
      const x = Math.max(box.x, b.x0) + 2;
      const wName = ctx.measureText(name).width;
      if (x + wName > Math.min(b.x1, lagLeft)) continue;
      ctx.fillStyle = b.veiled ? 'rgba(220,210,255,.75)' : b.phase === 'focus' ? 'rgba(255,190,120,.9)' : 'rgba(150,195,255,.9)';
      ctx.fillText(name, x, box.y - 1);
    }

    // the threshold's name at its right end, the time under the chart
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,210,122,.95)';
    ctx.fillText(t('dock.threshold'), box.x + box.w + 4, Math.min(box.y + box.h - 6, Math.max(box.y + 6, last.ty)));
    ctx.font = font(600, 10);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.textBaseline = 'top';
    ctx.fillText(`−${CHART_SEC}\u00a0s`, box.x, box.y + box.h + 2);
    ctx.textAlign = 'right';
    ctx.fillText(t('dock.nowMark'), box.x + box.w, box.y + box.h + 2);
  }
}

/** A scale label: "+3%" or "+2.5%" as the language writes it (one decimal only for a narrow window). */
function axis(v: number): string {
  return t('sum.pct', { v: fmtSigned(v, Math.abs(v) < 10 ? 1 : 0) });
}

export function stateText(s: CoachState, overThreshold: number, lag: number): string {
  switch (s) {
    case 'above': return t('st.above', { d: pct(overThreshold) });
    case 'freeAbove': return t('st.freeAbove', { d: pct(overThreshold) });
    case 'wait': return t('st.wait', { n: lag });
    case 'restWait': return t('st.restWait', { n: lag });
    default: return t(`st.${s}`);
  }
}

export function reportText(r: BlockReport | null): string {
  if (!r) return t('rep.none');
  if (r.verdict === 'unjudged' || r.delta === null) return t('rep.unjudged');
  const text = t(`rep.${r.kind}.${r.verdict}`, { d: pct(r.delta), ref: t(`ref.${r.against}`) });
  return r.blind ? t('rep.blind', { text }) : text;
}
