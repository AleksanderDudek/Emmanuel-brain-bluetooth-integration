/**
 * The contract between the arcade runner (src/arcade/runner.ts) and a game module
 * (src/arcade/<id>/index.ts).  The runner owns the session — calibration, the clock, pause,
 * the signal banners, saving, the summary — and the game owns its canvas and its rules.
 */
import type { Tool } from '../../tools';
import type { ArcadeAudio } from './audio';
import type { BodySignals } from './body';
import type { FocusFrame, FocusTuning } from './focus';
import type { PassageId } from './scripture';
import type { TracePhase } from './trace';

/**
 * What the current block asks of the brain (ArcadeGame.signal).  `task`: the game's own strategy for
 * the block — the runner's Mendi panel, dock and banner then show the same words.  `left`: seconds
 * left in this block (the panel counts down; without it the panel counts the block's seconds up).
 * `next`: the block that follows, during its 3–4 s telegraph (the panel says "Za chwilę: …").
 */
export interface SignalPhase { want: TracePhase; blind: boolean; task?: string; left?: number; next?: TracePhase | null }

/** How a control is done, for the standard "how to play" card (the runner draws the icon). */
export type Gesture = 'tap' | 'hold' | 'drag' | 'swipe' | 'steer' | 'keys';

/**
 * The game's "how to play" (ArcadeModule.howto), shown the same way in every game: on the
 * calibration card, and from the "?" button during play (which pauses).  The brain's part — what
 * focus and rest drive — comes from the registry's `brain` texts, so it is never repeated here.
 */
export interface HowTo {
  /** one sentence: what the player is trying to do ("Doprowadź pielgrzyma jak najdalej doliną") */
  goal: string;
  /** one to three controls, each a gesture and a short line ("Stuknij — skok; w powietrzu drugi raz") */
  hands: { gesture: Gesture; text: string }[];
  /** at most two short pro tips */
  tips?: string[];
}

/** The game's headline in the runner's standard score corner (top right). */
export interface Headline {
  /** the number (the unit comes from the module's `unit(n)` or the registry entry) */
  value: number;
  /** a short second line under it ("×3 combo", "Poziom 4", "rekord 1 240") */
  sub?: string;
}

export const FREE_PHASE: SignalPhase = { want: 'free', blind: false };

/** What covers each edge of the canvas (CSS px): see GameEnv.insets(). */
export interface Insets { top: number; right: number; bottom: number; left: number }

/** A control the player can tap right now, for the mobile audit and tests (ArcadeGame.targets). */
export interface TapTarget { label: string; x: number; y: number; w: number; h: number }

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
  /**
   * The standard coach mark (one at a time, pointer-events none): a short line in the runner's own
   * bubble, pointing at a spot on the canvas (CSS px) or, without one, centred over the play area.
   * For tutorials and first-time explanations ("Stuknij, gdy promień dotknie łodzi"); a game's
   * companion talks in its own drawn bubbles instead.  `ms` defaults to 3500; an empty text hides it.
   */
  hint(text: string, at?: { x: number; y: number } | null, ms?: number): void;
  /**
   * The canvas band the runner's standard HUD covers at the top (the Mendi panel on the left, the
   * score on the right), in CSS px from the canvas top — keep the play's important parts below it.
   * Read it in `resize()`; it changes only with the window.
   */
  hudTop(): number;
  /**
   * What covers each edge of the canvas (CSS px from that edge), re-read in `resize()`: `top` is the
   * runner's HUD band (= hudTop()), `bottom` the home indicator of a phone without a home button,
   * `left`/`right` the notch and the rounded corners of a phone on its side.  The scene may run under
   * them; controls and text stay inside.  The runner puts nothing of its own at the bottom, so the
   * thumb zone is the game's (kit/mobile.ts).
   */
  insets(): Insets;
  /**
   * The primary input is a finger (a phone, a tablet; CSS `pointer: coarse`): say "tap" and "drag",
   * never keys, and keep every control at least MIN_TAP px (kit/mobile.ts).  Read once per session.
   */
  touch: boolean;
  /**
   * The band's side readings this frame (kit/body.ts): the balance of the two prefrontal halves
   * (0..1, 0.5 even) and Mendi's pulse (bpm).  Each is null while unknown or unreliable — show "no
   * reading", never a made-up value.  For games about the body (DESIGN.md §13); optional in test envs.
   */
  body?(): BodySignals;
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
   * What the current block asks of the brain, for the runner's signal dock (its chart's bands and
   * its plain-words verdict): 'focus' in a push block, 'rest' in a rest block, 'free' in a warm-up,
   * a finale or between blocks; `blind` while a blind block hides the signal (the dock veils it too,
   * and reveals it when the block ends).  Without this method the dock reads the whole session as 'free'.
   */
  signal?(): SignalPhase;
  /**
   * The game's own quantity the focus drives right now, 0..1 with 0.5 at the threshold ("lamp reach"),
   * for the runner's Mendi panel gauge (named by the registry's `brain.meter`, or `brain.meterRest` in
   * a rest block); null hides the value (a blind block, no signal).  Without it the gauge shows
   * the focus `level` (and `calm` in a rest block).
   */
  meter?(): number | null;
  /** The headline for the runner's standard score corner, every frame (cheap; no side effects). */
  headline?(): Headline;
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
  /**
   * The controls the player can tap right now (CSS px hit rectangles, as the game tests them), for the
   * mobile audit (scripts/arcade-mobile.mjs) and tests: each at least MIN_TAP on its short side, inside
   * the insets, clear of each other (kit/mobile.ts).  Cheap, no side effects; the free play area (a
   * drag anywhere, a tap on the field) is not a target.
   */
  targets?(): TapTarget[];
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
  /** How to play, in this page load's language (see HowTo); without it the card uses the registry's `how` lines. */
  howto?(): HowTo;
}
