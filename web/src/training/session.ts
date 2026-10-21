/**
 * One focus-training session, without the DOM: calibration on the hub's
 * samples, then the game clock, the activity curve and the score.  The UI
 * (src/ui/focus.ts) only draws what this holds.
 */
import type { HubSample, SignalReason } from '../hub';
import type { Tool } from '../tools';
import { ActivityMeter, EEG_METER, FNIRS_METER, type MeterConfig } from './meter';
import { HISTORY_SEC, type HistoryPoint } from './scene';
import { SessionScorer, type Mood, type TrainingResult } from './score';

/** 'prep' = mood check and breathwork: the signal is not used yet */
export type FocusPhase = 'prep' | 'calibration' | 'game' | 'done';

export interface TickOutcome { star: boolean; calibrated: boolean; finished: boolean }

export class FocusSession {
  phase: FocusPhase = 'prep';
  readonly meter: ActivityMeter;
  readonly scorer = new SessionScorer();
  readonly history: HistoryPoint[] = [];
  /** seconds into the game */
  gameT = 0;
  /** the current activity %, held through unreliable ticks (null before the first reading) */
  level: number | null = null;
  reliable = false;
  reason: SignalReason | null = null;
  /** engine baseline (0..1) while it is still being collected, then the meter's calibration */
  calProgress = 0;
  calStage: 'baseline' | 'reference' = 'baseline';
  readonly startedAt = Date.now() / 1000;
  gameStartedAt: number | null = null;
  mood: Mood | null = null;
  breathworkSec = 0;
  /** the engine started a new baseline mid-game: the reference is being taken again (no points meanwhile) */
  recalibrating = false;
  private epoch: number | null = null;

  constructor(readonly tool: Tool, readonly plannedSec: number, meter?: MeterConfig) {
    this.meter = new ActivityMeter(meter ?? (tool === 'eeg' ? EEG_METER : FNIRS_METER));
  }

  /** The calibration screen is up: from now on the samples count, starting with a fresh reference. */
  beginCalibration(): void {
    if (this.phase !== 'prep') return;
    this.meter.reset();
    this.phase = 'calibration';
  }

  /** One hub tick. */
  onSample(s: HubSample): TickOutcome {
    const out: TickOutcome = { star: false, calibrated: false, finished: false };
    if (this.phase === 'prep' || this.phase === 'done' || s.tool !== this.tool) return out;
    this.reason = s.reason;
    if (this.epoch !== null && s.epoch !== this.epoch) {
      // ΔHb (or the EEG buffers) start again from a new baseline: the old reference means nothing now
      this.meter.reset();
      if (this.phase === 'game') this.recalibrating = true;
    }
    this.epoch = s.epoch;
    const r = this.meter.push(s.x, s.reliable, s.dt);
    if (this.recalibrating && r.phase === 'active') this.recalibrating = false;
    this.reliable = r.reliable;
    if (this.phase === 'calibration') {
      // the engine's own baseline comes first; it may already be there
      this.calStage = s.reason === 'baseline' ? 'baseline' : 'reference';
      this.calProgress = r.calProgress;
      if (r.phase === 'active') {
        this.phase = 'game';
        this.gameStartedAt = Date.now() / 1000;
        this.level = r.activity;
        out.calibrated = true;
      }
      return out;
    }
    if (r.activity !== null && r.reliable) this.level = r.activity;
    const usable = r.reliable && r.activity !== null && !this.recalibrating;
    const res = this.scorer.tick(usable ? r.activity : null, usable, s.dt);
    this.gameT += s.dt;
    this.history.push({ t: this.gameT, a: this.level ?? 0, reliable: usable, star: res.star || undefined });
    while (this.history.length && this.gameT - this.history[0].t > HISTORY_SEC + 4) this.history.shift();
    out.star = res.star;
    if (this.gameT >= this.plannedSec) {
      this.phase = 'done';
      out.finished = true;
    }
    return out;
  }

  /** Progress of the game, 0..1. */
  get progress(): number { return Math.min(1, this.gameT / this.plannedSec); }

  /** Worth keeping: at least 30 s of play. */
  get worthSaving(): boolean { return this.gameT >= 30; }

  finish(): void { this.phase = 'done'; }

  toResult(meta: { id: string; source: 'device' | 'simulator'; device: string; scene: string }): TrainingResult {
    const s = this.scorer;
    const round1 = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
    return {
      id: meta.id, kind: 'focus', tool: this.tool, source: meta.source, device: meta.device,
      start_time: this.gameStartedAt ?? this.startedAt, end_time: Date.now() / 1000,
      planned_sec: this.plannedSec, played_sec: Math.round(this.gameT), breathwork_sec: this.breathworkSec,
      completed: this.gameT >= this.plannedSec - 0.5, mood: this.mood, scene: meta.scene,
      points: Math.floor(s.points), control_sec: Math.round(s.control),
      activity_avg_pct: round1(s.meanActivity), activity_max_pct: round1(s.maxActivity === -Infinity ? null : s.maxActivity),
      reliable_pct: s.playedSec > 0 ? Math.round((100 * s.reliableSec) / s.playedSec) : 0,
      series: s.series,
    };
  }
}
