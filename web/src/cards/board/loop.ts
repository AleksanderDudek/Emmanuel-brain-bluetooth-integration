/**
 * The board's trial loop (src/cards/DESIGN.md §5.2), without the DOM: practice, countdown, play,
 * pause and the end of a game, trial by trial, on the board's clock.  The UI calls `tick(now)` on
 * every animation frame with the frame's timestamp and draws whatever the loop asks for in that
 * same frame — so the moment a cue is drawn is the frame's timestamp, and that is when its
 * reaction time starts.  Taps come in with their time already on the board's clock (clock.ts).
 *
 * Inside play, each trial goes: wait (a random pause, so the cue cannot be anticipated) →
 * present (a strip shown colour by colour, when the game has one) → input (until done or the
 * deadline) → after (the verdict stays on screen a moment) → the next wait.
 */
import type { FeedbackMsg, PadLayout, PadState } from '../duo/protocol';
import type { GameMeta } from '../games';
import type { GameEngine, Legend, Stim, TrialRecord, TrialSpec } from '../games/types';

export type LoopPhase = 'idle' | 'practice' | 'countdown' | 'play' | 'paused' | 'done';

export interface LoopOutput {
  /** draw this cue (and the rule, or none) now; `cue` = a word over it */
  show(stim: Stim, legend: Legend | null, cue: TrialSpec['cue'] | null): void;
  layout(layout: PadLayout): void;
  feedback(fb: FeedbackMsg): void;
  padState(state: PadState, input: boolean, text?: string): void;
  /** the countdown's number (3, 2, 1, then 0 = go) */
  countdown(n: number): void;
  level(level: number, change: -1 | 1): void;
  trial(rec: TrialRecord): void;
  /** the board's own verdict on the trial, for its stage (a ring of green or red) */
  verdict(ok: boolean | null): void;
  end(): void;
}

export interface LoopOptions {
  rng: () => number;
  /** the level to start on */
  level: number;
  plannedSec: number;
  /** run the game's practice trials first */
  practice: boolean;
}

/** How long a verdict stays before the next pause (ms), and the countdown's step. */
export const AFTER_MS = 380;
export const COUNT_STEP_MS = 800;
/** A first tap sooner than this after the cue is a guess, not a reaction (ms). */
export const ANTICIPATION_MS = 100;
/** A trial times out this long after its deadline, so a tap made in time but still on its way can land (ms). */
export const GRACE_MS = 150;

type Inner = 'wait' | 'present' | 'input' | 'after';

export class TrialLoop {
  phase: LoopPhase = 'idle';
  readonly trials: TrialRecord[] = [];
  /** taps that came too early to be reactions */
  early = 0;
  private engine: GameEngine;
  private practiceEngine: GameEngine | null = null;
  private practiceLeft = 0;
  private inner: Inner = 'wait';
  private spec: TrialSpec | null = null;
  private frameIdx = 0;
  private trialStart = 0;
  private onset = 0;
  private nextAt = 0;
  private countAt = 0;
  private countN = 3;
  private playStart = 0;
  private pausedAt = 0;
  private pausedFrom: LoopPhase = 'play';
  private pausedMs = 0;
  private tapsThisTrial = 0;
  private layoutSeq = 0;
  private lastNow = 0;
  private endedPlayed: number | null = null;

  constructor(readonly meta: GameMeta, private readonly o: LoopOptions, private readonly out: LoopOutput) {
    this.engine = meta.create({ rng: o.rng, level: o.level });
  }

  get level(): number { return this.engine.level; }
  get startLevel(): number { return this.o.level; }
  get rule(): Legend | null { return this.engine.rule(); }
  /** ms of play so far (pauses excluded) */
  playedMs(now = this.lastNow): number {
    if (this.endedPlayed !== null) return this.endedPlayed;
    if (this.phase === 'idle' || this.phase === 'practice' || this.phase === 'countdown') return 0;
    if (this.phase === 'paused' && this.pausedFrom !== 'play') return 0;
    const end = this.phase === 'paused' ? this.pausedAt : now;
    return Math.max(0, end - this.playStart - this.pausedMs);
  }
  get inputOpen(): boolean { return (this.phase === 'play' || this.phase === 'practice') && this.inner === 'input'; }
  private get current(): GameEngine { return this.phase === 'practice' && this.practiceEngine ? this.practiceEngine : this.engine; }

  begin(now: number): void {
    this.lastNow = now;
    if (this.o.practice && this.meta.practice > 0) {
      this.phase = 'practice';
      this.practiceEngine = this.meta.create({ rng: this.o.rng, level: this.o.level, fixed: true });
      this.practiceLeft = this.meta.practice;
      this.sendLayout(this.practiceEngine.layout());
      this.out.padState('practice', false);
      this.inner = 'wait';
      this.nextAt = now + 600;
    } else this.startCountdown(now);
  }

  private startCountdown(now: number): void {
    this.phase = 'countdown';
    this.countN = 3;
    this.countAt = now;
    this.sendLayout(this.engine.layout());
    this.out.show({ kind: 'blank' }, this.engine.rule(), null);
    this.out.countdown(3);
    this.out.padState('countdown', false, '3');
  }

  private sendLayout(l: PadLayout): void {
    this.layoutSeq++;
    this.out.layout(l);
  }

  get seq(): number { return this.layoutSeq; }

  tick(now: number): void {
    this.lastNow = now;
    if (this.phase === 'countdown') {
      if (now - this.countAt >= COUNT_STEP_MS) {
        this.countAt = now;
        this.countN--;
        this.out.countdown(this.countN);
        if (this.countN > 0) this.out.padState('countdown', false, String(this.countN));
        else {
          this.phase = 'play';
          this.playStart = now;
          this.pausedMs = 0;
          this.out.padState('play', false);
          this.inner = 'wait';
          this.nextAt = now + 300;
        }
      }
      return;
    }
    if (this.phase !== 'play' && this.phase !== 'practice') return;
    switch (this.inner) {
      case 'wait':
        if (now >= this.nextAt) {
          if (this.phase === 'play' && this.playedMs(now) >= this.o.plannedSec * 1000) return this.finishGame();
          this.startTrial(now);
        }
        break;
      case 'present': {
        const s = this.spec!;
        const frames = s.frames ?? [];
        while (this.frameIdx < frames.length && now - this.trialStart >= frames[this.frameIdx].at) {
          this.out.show(frames[this.frameIdx].stim, s.legend, s.cue ?? null);
          this.frameIdx++;
        }
        if (now - this.trialStart >= (s.inputAt ?? 0)) this.openInput(now);
        break;
      }
      case 'input':
        if (now - this.onset > this.spec!.deadlineMs + GRACE_MS) {
          this.current.timeout();
          this.out.verdict(false);
          this.endTrial(now);
        }
        break;
      case 'after':
        if (now >= this.nextAt) {
          if (this.phase === 'practice' && this.practiceLeft <= 0) {
            this.practiceEngine = null;
            this.startCountdown(now);
            return;
          }
          const [lo, hi] = this.meta.iti;
          this.inner = 'wait';
          this.nextAt = now + lo + this.o.rng() * (hi - lo);
          this.out.show({ kind: 'blank' }, this.phase === 'practice' ? this.current.rule() : this.spec?.legend ?? null, null);
          if (this.phase === 'play' && this.playedMs(now) >= this.o.plannedSec * 1000) this.finishGame();
        }
        break;
    }
  }

  private startTrial(now: number): void {
    const eng = this.current;
    const spec = eng.start();
    // practice always shows the rule: it is there to learn it
    if (this.phase === 'practice' && !spec.legend) spec.legend = eng.rule();
    this.spec = spec;
    this.trialStart = now;
    this.frameIdx = 0;
    this.tapsThisTrial = 0;
    if (spec.layout) this.sendLayout(spec.layout);
    this.out.show(spec.stim, spec.legend, spec.cue ?? null);
    if (spec.frames?.length || spec.inputAt) {
      this.inner = 'present';
      this.tick(now);
    } else this.openInput(now);
  }

  private openInput(now: number): void {
    this.inner = 'input';
    this.onset = now;
    this.out.padState(this.phase === 'practice' ? 'practice' : 'play', true);
  }

  /** A tap at `tb` on the board's clock (null: the pad has no clock estimate yet, use `now`). */
  tap(item: string, panel: number, tb: number | null, now = performance.now()): void {
    if (!this.inputOpen || !this.spec) return;
    const at = tb ?? now;
    const t = at - this.onset;
    if (t < 0) return;   // touched before the cue was on screen: not an answer to it
    if (t > this.spec.deadlineMs) return;   // touched after the deadline (and arrived before the timeout): too late
    if (this.tapsThisTrial === 0 && t < ANTICIPATION_MS) {
      if (this.phase === 'play') this.early++;
      return;
    }
    const v = this.current.tap({ item, panel, t });
    if (v.ok === null) return;
    this.tapsThisTrial++;
    this.out.feedback({ t: 'fb', item, ok: v.ok, panel, ...(v.keep ? { keep: true } : {}) });
    if (v.stim) this.out.show(v.stim, this.spec.legend, this.spec.cue ?? null);
    if (v.done) {
      this.out.verdict(v.ok);
      this.endTrial(now);
    }
  }

  private endTrial(now: number): void {
    const eng = this.current;
    const before = eng.level;
    const rec = eng.finish(this.trials.length, Math.round(this.onset - this.playStart - this.pausedMs));
    this.inner = 'after';
    this.nextAt = now + AFTER_MS;
    this.out.padState(this.phase === 'practice' ? 'practice' : 'play', false);
    if (this.phase === 'practice') {
      this.practiceLeft--;
      return;
    }
    this.trials.push(rec);
    this.out.trial(rec);
    if (eng.level !== before) {
      this.out.level(eng.level, eng.level > before ? 1 : -1);
      this.sendLayout(eng.layout());
    }
  }

  pause(now: number): void {
    if (this.phase !== 'play' && this.phase !== 'practice' && this.phase !== 'countdown') return;
    this.pausedFrom = this.phase;
    this.pausedAt = now;
    this.phase = 'paused';
    // a trial cut by a pause is dropped, not judged: it would carry the pause in its time
    if (this.inner === 'input' || this.inner === 'present') {
      this.inner = 'wait';
      this.spec = null;
    }
    this.out.show({ kind: 'blank' }, null, null);
    this.out.padState('pause', false);
  }

  resume(now: number): void {
    if (this.phase !== 'paused') return;
    const from = this.pausedFrom;
    if (from === 'countdown') {
      this.startCountdown(now);
      return;
    }
    if (from === 'play') this.pausedMs += now - this.pausedAt;
    // paused on the last practice trial's verdict: practice is over
    if (from === 'practice' && this.practiceLeft <= 0) {
      this.practiceEngine = null;
      this.startCountdown(now);
      return;
    }
    this.phase = from;
    this.inner = 'wait';
    this.nextAt = now + 900;
    this.out.padState(from === 'practice' ? 'practice' : 'play', false);
    this.out.show({ kind: 'blank' }, from === 'practice' ? this.current.rule() : null, null);
  }

  /** End now (the player stopped, or the session's time is up). */
  stop(): void {
    if (this.phase === 'done') return;
    this.finishGame();
  }

  private finishGame(): void {
    const wasPlaying = this.phase === 'play' || (this.phase === 'paused' && this.pausedFrom === 'play');
    this.endedPlayed = wasPlaying ? this.playedMs(this.lastNow) : 0;
    this.phase = 'done';
    this.out.padState('done', false);
    this.out.end();
  }
}
