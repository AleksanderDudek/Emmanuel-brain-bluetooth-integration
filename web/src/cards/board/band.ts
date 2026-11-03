/**
 * The headband during a card session (src/cards/DESIGN.md §6): the band does not steer these
 * games — it is recorded alongside them, the way a lab records fNIRS or EEG during a task.
 *
 * The protocol is a block design.  A short rest at the start sets the reference (the focus
 * training's calibration: 20 s of reliable signal, src/training/meter.ts); then play blocks and,
 * between games of the daily workout, rest blocks.  The prefrontal response to a task needs a
 * few seconds to rise and to fall again (haemodynamics), so the useful number is the contrast:
 * activity while playing against activity while resting, both relative to the same reference.
 * Every second of play is kept (aligned with the trials' times), so a session can be read trial
 * by trial afterwards.  The numbers are relative and consumer-grade; the summary says so.
 */
import type { HubSample, SignalReason, SignalWarning } from '../../hub';
import type { Tool } from '../../tools';
import { ActivityMeter, EEG_METER, FNIRS_METER } from '../../training/meter';
import { SessionScorer, type TrainingResult } from '../../training/score';

export type BandPhase = 'off' | 'baseline' | 'rest' | 'play';

export interface BandBlock {
  game: string;
  /** seconds of play (index into the series) */
  from: number;
  to: number;
  /** mean activity % over the block's reliable seconds (null: none) */
  mean: number | null;
}

/** What a saved card session keeps of the band. */
export interface BandRecord {
  tool: Tool;
  source: 'device' | 'simulator';
  device: string;
  /** activity % per second of play (null for a second without reliable signal) */
  series: (number | null)[];
  blocks: BandBlock[];
  /** mean activity % in rest blocks after the baseline (null: no rest block, or no reliable second in one) */
  restMean: number | null;
  /** share of play with a reliable signal, % */
  reliablePct: number;
}

export class BandTrack {
  readonly meter: ActivityMeter;
  readonly scorer = new SessionScorer();
  phase: BandPhase = 'off';
  reliable = false;
  reason: SignalReason | null = null;
  warning: SignalWarning | null = null;
  /** the engine began a new baseline mid-session: the reference is being taken again */
  recalibrating = false;
  readonly startedAt = Date.now() / 1000;
  playStartedAt: number | null = null;
  private epoch: number | null = null;
  private restSum = 0;
  private restN = 0;
  private readonly blocks: BandBlock[] = [];
  private open: { game: string; from: number } | null = null;

  constructor(readonly tool: Tool) {
    this.meter = new ActivityMeter(tool === 'eeg' ? EEG_METER : FNIRS_METER);
  }

  get calibrated(): boolean { return this.meter.calibrated; }
  get calProgress(): number { return this.meter.calProgressNow; }

  /** The resting baseline begins; with a fresh reference from moments ago on the same signal, it is already done. */
  startBaseline(carried: number | null = null): void {
    this.meter.reset();
    if (carried !== null) this.meter.adopt(carried);
    this.phase = 'baseline';
  }

  setPhase(p: Exclude<BandPhase, 'baseline'>): void {
    if (p === 'play' && this.playStartedAt === null) this.playStartedAt = Date.now() / 1000;
    this.phase = p;
  }

  /** A game's block of play starts / ends (the series index marks where). */
  blockStart(game: string): void {
    this.open = { game, from: this.scorer.series.length };
    this.setPhase('play');
  }

  blockEnd(): void {
    if (!this.open) return;
    const to = this.scorer.series.length;
    const vals = this.scorer.series.slice(this.open.from, to).filter((v): v is number => v !== null);
    this.blocks.push({ ...this.open, to, mean: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null });
    this.open = null;
    this.setPhase('rest');
  }

  /** One hub tick; returns whether the baseline finished on it. */
  onSample(s: HubSample): boolean {
    if (this.phase === 'off' || s.tool !== this.tool) return false;
    this.reason = s.reason;
    this.warning = s.warning;
    if (this.epoch !== null && s.epoch !== this.epoch) {
      this.meter.reset();
      this.recalibrating = this.phase !== 'baseline';
    }
    this.epoch = s.epoch;
    const was = this.meter.calibrated;
    const r = this.meter.push(s.x, s.reliable, s.dt);
    if (this.recalibrating && r.phase === 'active') this.recalibrating = false;
    this.reliable = r.reliable;
    const usable = r.reliable && r.activity !== null && !this.recalibrating;
    if (this.phase === 'play') this.scorer.tick(usable ? r.activity : null, usable, s.dt);
    else if (this.phase === 'rest' && usable) {
      this.restSum += r.activity!;
      this.restN++;
    }
    return !was && this.meter.calibrated && this.phase === 'baseline';
  }

  record(meta: { source: 'device' | 'simulator'; device: string }): BandRecord {
    const s = this.scorer;
    return {
      tool: this.tool, source: meta.source, device: meta.device, series: [...s.series], blocks: [...this.blocks],
      restMean: this.restN ? Math.round((this.restSum / this.restN) * 10) / 10 : null,
      reliablePct: s.playedSec > 0 ? Math.round((100 * s.reliableSec) / s.playedSec) : 0,
    };
  }

  /**
   * The session as one of the app's training results (Sesje, the day score, the streak): the
   * band's numbers as the focus training reports them, the game's headline in `game`.
   */
  toResult(meta: { id: string; source: 'device' | 'simulator'; device: string; plannedSec: number },
           game: NonNullable<TrainingResult['game']>): TrainingResult {
    const s = this.scorer;
    const r1 = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
    return {
      id: meta.id, kind: 'game', tool: this.tool, source: meta.source, device: meta.device,
      start_time: this.playStartedAt ?? this.startedAt, end_time: Date.now() / 1000,
      planned_sec: meta.plannedSec, played_sec: Math.round(s.playedSec), breathwork_sec: 0,
      completed: s.playedSec >= meta.plannedSec - 1, mood: null, scene: game.id,
      points: Math.floor(s.points), control_sec: Math.round(s.control),
      activity_avg_pct: r1(s.meanActivity), activity_max_pct: r1(s.maxActivity === -Infinity ? null : s.maxActivity),
      reliable_pct: s.playedSec > 0 ? Math.round((100 * s.reliableSec) / s.playedSec) : 0,
      series: [...s.series], game,
    };
  }
}
