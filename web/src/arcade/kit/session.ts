/**
 * One arcade game session without the DOM (DESIGN.md §9): the focus training's calibration and
 * scoring (FocusSession: the reference, Tlen points, Control, the activity curve), the game-ready
 * focus (FocusInput), the session clock, and a pause.
 *
 * Every game session is a full neurofeedback session: it is saved with the trainings, counts
 * toward the day score and the streak, and reports the same activity, control and Tlen numbers
 * as the focus training — the game's own score comes on top.
 */
import type { HubSample } from '../../hub';
import type { GameResult, TrainingResult } from '../../training/score';
import { FocusSession } from '../../training/session';
import type { Tool } from '../../tools';
import { FocusInput, NEUTRAL_FRAME, type FocusFrame, type FocusTuning } from './focus';

/** A reference taken on this signal moments ago: the next session may start without calibrating again. */
export interface CarriedCalibration { tool: Tool; epoch: number; ref: number; at: number }

/** How long a calibration stays good for the next session (s). */
export const CARRY_SEC = 300;

export interface ArcadeTick {
  frame: FocusFrame;
  /** the calibration finished on this tick */
  calibrated: boolean;
  /** the focus training's star (10 Tlen points) was earned on this tick */
  star: boolean;
}

export class ArcadeSession {
  readonly core: FocusSession;
  readonly focus: FocusInput;
  frame: FocusFrame = NEUTRAL_FRAME;
  paused = false;
  private epoch: number | null = null;
  /** when the reference last followed the signal (epoch s): a carried calibration is as old as this */
  private liveAt: number | null = null;

  constructor(readonly tool: Tool, readonly plannedSec: number, tuning?: FocusTuning) {
    // the core never ends by itself: the game decides when time up may stop it (not mid-move)
    this.core = new FocusSession(tool, Number.MAX_SAFE_INTEGER);
    this.focus = new FocusInput(tuning);
  }

  /** The calibration screen is up; with a fresh carried reference on the same signal the game starts at once. */
  begin(carry: CarriedCalibration | null, epochNow: number, nowSec = Date.now() / 1000): boolean {
    this.core.beginCalibration();
    const fresh = !!carry && carry.tool === this.tool && carry.epoch === epochNow && nowSec - carry.at < CARRY_SEC;
    if (fresh) this.core.meter.adopt(carry.ref);
    return fresh;
  }

  get phase(): 'calibration' | 'play' | 'done' {
    const p = this.core.phase;
    return p === 'game' ? 'play' : p === 'done' ? 'done' : 'calibration';
  }

  /** Seconds of play so far (stops while paused). */
  get t(): number { return this.core.gameT; }
  get timeUp(): boolean { return this.core.gameT >= this.plannedSec; }
  get progress(): number { return Math.min(1, this.core.gameT / this.plannedSec); }
  get recalibrating(): boolean { return this.core.recalibrating; }

  onSample(s: HubSample, nowSec = Date.now() / 1000): ArcadeTick {
    // a paused session, or a sample of the other band (the tool switched under us), changes nothing
    if (this.paused || this.phase === 'done' || s.tool !== this.tool) return { frame: this.frame, calibrated: false, star: false };
    this.epoch = s.epoch;
    this.liveAt = nowSec;
    const was = this.core.phase;
    const out = this.core.onSample(s);
    const c = this.core;
    if (was === 'game') this.frame = this.focus.push(c.level, c.reliable && !c.recalibrating, s.dt);
    return { frame: this.frame, calibrated: out.calibrated, star: out.star };
  }

  /** What the next session may reuse (null while uncalibrated or after a change of signal); dated by the last live sample. */
  carry(nowSec = Date.now() / 1000): CarriedCalibration | null {
    const ref = this.core.meter.reference;
    return ref === null || this.epoch === null || this.core.recalibrating ? null
      : { tool: this.tool, epoch: this.epoch, ref, at: this.liveAt ?? nowSec };
  }

  finish(): void { this.core.finish(); }

  /** Worth keeping: at least 30 s of play. */
  get worthSaving(): boolean { return this.core.worthSaving; }

  toResult(meta: { id: string; source: 'device' | 'simulator'; device: string }, game: GameResult): TrainingResult {
    const r = this.core.toResult({ ...meta, scene: game.id });
    return { ...r, kind: 'game', planned_sec: this.plannedSec, completed: this.core.gameT >= this.plannedSec - 0.5, game };
  }
}
