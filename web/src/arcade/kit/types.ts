/**
 * The contract between the arcade runner (src/arcade/runner.ts) and a game module
 * (src/arcade/<id>/index.ts).  The runner owns the session — calibration, the clock, pause,
 * the signal banners, saving, the summary — and the game owns its canvas and its rules.
 */
import type { Tool } from '../../tools';
import type { ArcadeAudio } from './audio';
import type { FocusFrame, FocusTuning } from './focus';
import type { PassageId } from './scripture';

/** What the runner gives a game. */
export interface GameEnv<P extends object> {
  canvas: HTMLCanvasElement;
  /** a DOM layer over the canvas for the game's own HUD (pointer-events: none) */
  hud: HTMLElement;
  audio: ArcadeAudio;
  /** the game's saved progress: mutate it during play; the runner saves it when the session ends */
  progress: P;
  /** seeded randomness for this session */
  rng: () => number;
  /** today ("YYYY-MM-DD") and its seed: the same daily challenge for everyone */
  day: string;
  daySeed: number;
  plannedSec: number;
  tool: Tool;
  /** the signal comes from the app's simulator ("Symuluj skupienie" drives it) */
  simulated: boolean;
  reducedMotion: boolean;
  haptics: boolean;
  /**
   * The focus tuning this session runs with (the kit's defaults, the game's entry, a beginner's
   * bias on top): build block judges with `RoundJudge.from(env.tuning)` so their verdicts stay fair.
   */
  tuning: FocusTuning;
}

export interface PointerInput { type: 'down' | 'move' | 'up'; x: number; y: number; id: number }

export interface ArcadeOutcome {
  /** the headline number of the session and its unit ("pięter", "kg", "pkt") */
  score: number;
  unit: string;
  /** beat the game's best */
  record: boolean;
  /** a few [label, value] lines for the summary and Sesje */
  stats: [string, string][];
  /** moments worth a line of their own ("Nowy gatunek: szczupak") */
  highlights: string[];
  /** a passage to close the session with (kit/scripture.ts); the summary shows it under the headline */
  verse?: PassageId;
}

export interface ArcadeGame {
  /** the canvas changed size (CSS px, device pixel ratio already applied to the backing store) */
  resize(w: number, h: number, dpr: number): void;
  /** while the reference is taken: the intro scene (no input expected); `p` = calibration 0..1 */
  intro(dt: number, p: number): void;
  /** play begins (after the countdown) */
  start(): void;
  /** every animation frame of play; `f` = the latest focus, `t` = seconds of play */
  update(dt: number, f: FocusFrame, t: number): void;
  draw(): void;
  /** taps, clicks and drags in canvas CSS px (only during play) */
  pointer?(e: PointerInput): void;
  /** keys during play; return true when handled */
  key?(key: string, down: boolean): boolean;
  /** time is up: may the session stop now?  False keeps it going (a fish on the line), at most 30 s */
  canStop(): boolean;
  pause?(paused: boolean): void;
  /**
   * What the ambient pad's brightness follows this frame (0..1), or null to hold it still — for rest
   * and blind blocks, where the brain's live feedback must not leak through the sound.  Without
   * this method the pad follows `level` (and goes dark while the signal is unreliable).
   */
  padLevel?(f: FocusFrame): number | null;
  /**
   * The session ends before the game's own ending ("Zakończ i zapisz", the overtime limit): settle
   * now (credit the session, roll what the ending would have rolled).  Called once, right before
   * the final result(); never by the debug view.
   */
  finish?(): void;
  /**
   * The session's numbers.  May be called more than once (the debug view during play, the final
   * save), so it must be idempotent: records go into the progress with Math.max, never `+=`.
   */
  result(): ArcadeOutcome;
  destroy(): void;
}

export interface ArcadeModule<P extends object = object> {
  freshProgress(): P;
  create(env: GameEnv<P>): ArcadeGame;
  /** the best headline score so far (null: never played) */
  best(p: P): number | null;
  /** the headline unit for a given number, where the language bends it (1 łódź, 3 łodzie, 5 łodzi); defaults to the entry's unit */
  unit?(n: number): string;
  /** the lobby's "Postępy" card content; call `save()` after the panel itself changed the progress (a choice the player made) */
  progressPanel(p: P, save: () => void): HTMLElement;
  /**
   * The lobby's animated hero picture and the card art; `t` in seconds.  `p` is the player's progress
   * in the lobby (show their world), absent on the cards (a generic picture).
   */
  preview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: P): void;
}
