/**
 * Balance trainer tab (same behaviour as dashboard/fnirs-balance.js):
 * gauge + trend of the smoothed asymmetry, a task card driven by the
 * BalanceTracker's recommendation, session stats and settings.
 * Ingest runs every frame (history, task changes); rendering only while visible.
 */
import type { BalanceConfig, BalanceState, Recommendation } from '../core/types';
import type { Engine, EngineFrame } from '../engine';
import { fmtNum } from '../i18n';
import { t as tr } from '../i18n/training';
import { cssVar } from './charts';
import { $, fmtDur, h, run, toast } from './dom';
import { checkAnswer, makeTask, type Task } from './tasks';

const AUTO_NEXT_SEC: Partial<Record<Task['kind'], number>> = { open: 20, reveal: 25 };
const ZONE_TXT: Record<string, string> = { left_dominant: tr('bal.zoneLeft'), right_dominant: tr('bal.zoneRight'), balanced: tr('bal.zoneBalanced') };
const REC: Record<Recommendation, { kicker: string; title: string; cls: string }> = {
  train_left: { kicker: tr('bal.zoneRight'), title: tr('bal.trainLeft'), cls: 'left' },
  train_right: { kicker: tr('bal.zoneLeft'), title: tr('bal.trainRight'), cls: 'right' },
  focus: { kicker: tr('bal.zoneBalanced'), title: tr('bal.trainFocus'), cls: 'focus' },
};
const PAUSE_TXT: Record<string, string> = {
  waiting: tr('pause.waiting'),
  warming_up: tr('pause.warming_up'),
  motion: tr('pause.motion'),
  poor_signal: tr('pause.poor_signal'),
  no_data: tr('pause.no_data'),
  off: tr('pause.off'),
};
const TREND_SEC = 90;

export class BalanceView {
  private active = false;
  private task: Task | null = null;
  private lastRec: Recommendation | null | undefined = undefined;
  private last: BalanceState | null = null;
  private recording = false;
  private taskElapsed = 0;
  private lastTick = 0;
  private pausedSig = '';
  private streakText = '';
  private cfgLoaded = false;
  private feedbackEl: HTMLElement | null = null;
  private answerEl: HTMLInputElement | null = null;
  private streakEl: HTMLElement | null = null;
  private readonly history: { t: number; a: number | null }[] = [];
  private readonly el = {
    badge: $('balZoneBadge'), band: $('balBand'), marker: $('balMarker'), raw: $('balRaw'), value: $('balValue'),
    status: $('balStatus'), trend: $<HTMLCanvasElement>('balTrend'), announce: $('balAnnounce'), card: $('balTaskCard'),
    kicker: $('balTaskKicker'), title: $('balTaskTitle'), body: $('balTaskBody'), actions: $('balTaskActions'),
    timer: $('balTaskTimer'), stats: $('balStats'), low: $<HTMLInputElement>('balLow'), high: $<HTMLInputElement>('balHigh'),
    dwell: $<HTMLInputElement>('balDwell'), smooth: $<HTMLInputElement>('balSmooth'),
  };

  constructor(private readonly engine: Engine, private readonly onConfigChanged: () => void) {
    $('balSave').addEventListener('click', run(() => this.saveConfig({
      low: +this.el.low.value, high: +this.el.high.value, dwell_sec: +this.el.dwell.value, smoothing_sec: +this.el.smooth.value })));
    $('balDefaults').addEventListener('click', run(() => this.saveConfig({ low: 0.47, high: 0.53, dwell_sec: 5, smoothing_sec: 4 })));
    $('balReset').addEventListener('click', () => { this.engine.resetBalanceStats(); toast(tr('bal.statsReset')); });
  }

  private saveConfig(c: Partial<BalanceConfig>): void {
    this.loadConfig(this.engine.setBalanceConfig(c).config);
    this.onConfigChanged();
    toast(tr('bal.saved'));
  }

  private loadConfig(c: BalanceConfig): void {
    this.el.low.value = String(c.low); this.el.high.value = String(c.high);
    this.el.dwell.value = String(c.dwell_sec); this.el.smooth.value = String(c.smoothing_sec);
    this.cfgLoaded = true;
  }

  // ── task card ─────────────────────────────────────────────────────
  private newTask(rec: Recommendation | null): void {
    this.task = rec ? makeTask(rec, this.task?.prompt) : null;
    this.taskElapsed = 0;
    this.renderTask();
  }

  private btn(label: string, act: string): HTMLButtonElement {
    return h('button', { class: 'btn', type: 'button', on: { click: () => this.onAction(act) } }, label);
  }

  private renderTask(): void {
    this.feedbackEl = this.answerEl = this.streakEl = null;
    this.pausedSig = this.streakText = '';
    const t = this.task;
    if (!t) return;
    const r = REC[t.rec];
    this.el.card.dataset.rec = r.cls;
    this.el.kicker.textContent = r.kicker;
    this.el.title.textContent = r.title;
    const kids: Node[] = [];
    if (t.kind === 'focus') {
      this.streakEl = h('div', { class: 'muted' });
      kids.push(h('div', { class: 'focus-dot', 'aria-hidden': 'true' }), h('p', { class: 'task-prompt' }, t.prompt),
                h('ul', { class: 'focus-steps' }, (t.steps ?? []).map(s => h('li', null, s))), this.streakEl);
    } else {
      kids.push(h('p', { class: 'task-prompt' + (t.kind === 'answer' ? ' big' : '') }, t.prompt));
      if (t.kind === 'answer') {
        this.answerEl = h('input', { type: 'number', inputmode: 'numeric', 'aria-label': tr('bal.answerLabel'), placeholder: tr('bal.answerPlaceholder'),
                                     on: { keydown: (e: Event) => { if ((e as KeyboardEvent).key === 'Enter') this.onAction('check'); } } });
        kids.push(h('div', { class: 'row' }, this.answerEl, this.btn(tr('bal.check'), 'check'), this.btn(tr('bal.showResult'), 'show')));
      } else if (t.kind === 'reveal') {
        kids.push(h('div', { class: 'row' }, this.btn(tr('bal.showAnswer'), 'show')));
      } else if (t.kind === 'rotation') {
        const glyph = h('div', { class: 'rot-glyph', role: 'img', 'aria-label': tr('bal.rotated') }, t.letter ?? '');
        glyph.style.transform = `rotate(${t.angle}deg)${t.mirrored ? ' scaleX(-1)' : ''}`;
        kids.push(glyph, h('div', { class: 'row center' }, this.btn(tr('bal.normal'), 'normal'), this.btn(tr('bal.mirrored'), 'mirror')));
      } else if (t.hint) {
        kids.push(h('p', { class: 'muted' }, t.hint));
      }
      if (t.kind !== 'open') {
        this.feedbackEl = h('div', { class: 'task-feedback', role: 'status' });
        kids.push(this.feedbackEl);
      }
    }
    this.el.body.replaceChildren(...kids);
    this.el.actions.replaceChildren(...(t.kind === 'focus' ? [] : [this.btn(tr('bal.next'), 'next')]));
    if (this.active) this.el.announce.textContent = `${r.title}. ${t.prompt}`;
  }

  private feedback(ok: boolean | null, text: string): void {
    if (!this.feedbackEl) return;
    this.feedbackEl.textContent = text;
    this.feedbackEl.className = 'task-feedback' + (ok === true ? ' ok' : ok === false ? ' bad' : '');
  }

  private nextLater(ms: number): void {
    const id = this.task?.id;
    setTimeout(() => { if (this.task && this.task.id === id) this.newTask(this.task.rec); }, ms);
  }

  private onAction(act: string): void {
    const t = this.task;
    if (!t) return;
    if (act === 'next') return this.newTask(t.rec);
    if (act === 'show') return this.feedback(null, tr('bal.answer', { answer: String(t.answer) }));
    if (act === 'check') {
      const ok = checkAnswer(t, this.answerEl?.value ?? '');
      this.feedback(ok, ok ? tr('bal.right') : tr('bal.tryAgain'));
      if (ok) this.nextLater(1200);
      return;
    }
    if (act === 'normal' || act === 'mirror') {
      const ok = checkAnswer(t, act);
      this.feedback(ok, ok ? tr('bal.right') : tr(t.mirrored ? 'bal.wasMirrored' : 'bal.wasNormal'));
      this.nextLater(1500);
    }
  }

  private renderPaused(b: BalanceState): void {
    const left = b.paused === 'warming_up' && b.warmup_left_sec != null ? Math.ceil(b.warmup_left_sec) : null;
    const sig = `${b.paused}|${left}`;
    if (sig === this.pausedSig) return;   // rebuild only on change (screen readers, focus)
    const first = !this.pausedSig.startsWith(`${b.paused}|`);
    this.pausedSig = sig;
    this.el.card.dataset.rec = 'paused';
    this.el.kicker.textContent = tr('bal.paused');
    this.el.title.textContent = PAUSE_TXT[b.paused ?? ''] ?? tr('bal.waitingData');
    this.el.body.replaceChildren(...(left !== null ? [h('p', { class: 'muted' }, tr('bal.secondsLeft', { sec: left }))] : []));
    this.el.actions.replaceChildren();
    if (first) this.el.announce.textContent = this.el.title.textContent;
  }

  // ── gauge / stats / trend ─────────────────────────────────────────
  private renderGauge(b: BalanceState): void {
    const c = b.config, e = this.el;
    e.band.style.left = `${c.low * 100}%`;
    e.band.style.width = `${(c.high - c.low) * 100}%`;
    e.marker.style.display = b.asymmetry == null ? 'none' : 'block';
    e.raw.style.display = b.raw == null ? 'none' : 'block';
    if (b.asymmetry != null) e.marker.style.left = `${b.asymmetry * 100}%`;
    if (b.raw != null) e.raw.style.left = `${b.raw * 100}%`;
    e.value.textContent = b.asymmetry == null ? '—' : fmtNum(b.asymmetry, 3);
    e.badge.textContent = b.paused ? tr('bal.pausedBadge') : (ZONE_TXT[b.zone ?? ''] ?? '—');
    e.badge.className = 'badge zone-' + (b.paused ? 'paused' : (b.zone ?? 'none'));
    let s: string;
    if (b.paused) {
      s = PAUSE_TXT[b.paused] ?? '';
      if (b.paused === 'warming_up' && b.warmup_left_sec != null) s = tr('bal.warmupLeft', { text: s, sec: Math.ceil(b.warmup_left_sec) });
      if (this.task) s = tr('bal.taskWaits', { text: s.replace(/\.$/, '') });
    } else {
      s = [ZONE_TXT[b.zone ?? ''] ?? '—',
           b.recommendation ? tr('bal.since', { dur: fmtDur(b.recommendation_sec) }) : '',
           b.pending ? tr('bal.pending', { title: REC[b.pending.recommendation].title, sec: Math.ceil(b.pending.in_sec) }) : '',
      ].filter(Boolean).join(' · ');
    }
    e.status.textContent = s;
  }

  private renderStats(s: BalanceState['stats']): void {
    const cell = (k: string, v: string, unit = '') =>
      h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, unit ? h('small', null, unit) : null));
    this.el.stats.replaceChildren(
      cell(tr('bal.statBalancedPct'), s.balanced_pct == null ? '—' : String(Math.round(s.balanced_pct)), s.balanced_pct == null ? '' : '%'),
      cell(tr('bal.statBestStreak'), fmtDur(s.best_streak_sec)),
      cell(tr('bal.statSession'), fmtDur(s.session_sec)),
      cell(tr('bal.statLeft'), fmtDur(s.left_dominant_sec)),
      cell(tr('bal.statRight'), fmtDur(s.right_dominant_sec)),
      cell(tr('bal.statBalanced'), fmtDur(s.balanced_sec)));
  }

  private renderTrend(c: BalanceConfig): void {
    const cv = this.el.trend, r = cv.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr; cv.height = r.height * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, hh = r.height, top = 16, bot = 4, y = (v: number) => top + (hh - top - bot) * (1 - v);
    ctx.clearRect(0, 0, w, hh);
    ctx.fillStyle = 'rgba(0,229,160,0.12)';
    ctx.fillRect(0, y(c.high), w, y(c.low) - y(c.high));
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(0, y(0.5)); ctx.lineTo(w, y(0.5)); ctx.stroke();
    const now = Date.now(), span = TREND_SEC * 1000;
    ctx.strokeStyle = cssVar('--purple');
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let pen = false;
    for (const p of this.history) {
      if (p.a == null) { pen = false; continue; }   // gap: lift the pen
      const x = w * (1 - (now - p.t) / span);
      if (pen) ctx.lineTo(x, y(p.a)); else ctx.moveTo(x, y(p.a));
      pen = true;
    }
    ctx.stroke();
  }

  // ── frame loop ────────────────────────────────────────────────────
  update(f: EngineFrame): void {
    this.recording = f.recording.recording;
    let b = f.balance ?? null;
    if (!b && f.source === 'off' && this.last) {
      b = { ...this.last, paused: 'off', asymmetry: null, raw: null, zone: null, recommendation: null, pending: null };
    }
    if (!b) return;
    this.last = b;
    this.ingest(b);
    if (this.active) this.render(b);
  }

  private ingest(b: BalanceState): void {
    const now = Date.now(), last = this.history[this.history.length - 1];
    if (b.asymmetry != null) this.history.push({ t: now, a: b.asymmetry });
    else if (last && last.a != null) this.history.push({ t: now, a: null });
    while (this.history.length && now - this.history[0].t > TREND_SEC * 1000) this.history.shift();
    if (!this.cfgLoaded) this.loadConfig(b.config);
    if (b.recommendation !== this.lastRec) {
      // markers record what the trainer showed, so only while the tab is open
      if (this.active && this.recording && b.recommendation) this.engine.mark(`balance:${b.recommendation}`);
      this.lastRec = b.recommendation;
      this.newTask(b.recommendation);
    }
  }

  private render(b: BalanceState): void {
    const now = Date.now();
    if (this.task && !b.paused && this.lastTick) this.taskElapsed += Math.min(1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    this.renderGauge(b);
    this.renderStats(b.stats);
    this.renderTrend(b.config);
    if (!this.task) this.renderPaused(b);
    const lim = this.task ? AUTO_NEXT_SEC[this.task.kind] : undefined;
    if (lim && this.taskElapsed > lim) this.newTask(this.task!.rec);
    this.el.timer.style.width = lim ? `${Math.min(100, (100 * this.taskElapsed) / lim)}%` : '0%';
    if (this.streakEl) {
      const txt = tr('bal.streak', { dur: fmtDur(b.streak_sec), best: fmtDur(b.stats.best_streak_sec) });
      if (txt !== this.streakText) { this.streakEl.textContent = txt; this.streakText = txt; }
    }
  }

  setActive(on: boolean): void {
    this.active = on;
    this.lastTick = 0;   // time spent hidden does not count toward the task timer
    if (on && this.last) {
      this.renderTask();
      this.render(this.last);
    }
  }
}
