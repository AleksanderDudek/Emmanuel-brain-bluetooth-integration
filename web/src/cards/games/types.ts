/**
 * The contract between the two-screen runner (src/cards/board/runner.ts) and a game engine
 * (src/cards/games/*.ts).  An engine is pure: no DOM, no clock of its own.  The runner shows
 * what the engine asks for, takes the stimulus onset from the frame it was drawn in, converts
 * every tap to milliseconds since that onset, and asks the engine for a verdict.
 *
 * A *trial* is one task: a single tap (a colour → its finger), two taps (both hands), or many
 * (a strip to copy, a trail, a search).  The engine says when a trial is done; the runner
 * enforces the deadline.  Difficulty adapts between trials (adaptive.ts): every engine has
 * levels, and the level a player ends a session on is where the next one begins.
 */
import type { Arrange, PadItem, PadLayout } from '../duo/protocol';

export type GameId = 'palce' | 'gesty' | 'znaki' | 'cwiartki' | 'obie' | 'stroop' | 'sekwencja' | 'kod' | 'szlak' | 'szukaj';
export const GAME_IDS: readonly GameId[] = ['palce', 'gesty', 'znaki', 'cwiartki', 'obie', 'stroop', 'sekwencja', 'kod', 'szlak', 'szukaj'];

/** What a game mainly asks of the player (the lobby's tag, the daily workout's mix). */
export type SkillId = 'speed' | 'rules' | 'coordination' | 'memory' | 'inhibition' | 'attention';

/** What the board draws for a trial. */
export type Stim =
  /** one cue, `count` times in a row (card 13: two teal dots = the gesture twice) */
  | { kind: 'item'; item: PadItem; count?: number }
  /** two cues at once, one per hand: a tile split on the diagonal (card 10), two dots, a coloured shape… */
  | { kind: 'pair'; left: PadItem; right: PadItem; joined: 'split' | 'apart' | 'one' }
  /** a strip of colours (cards 04, 09, 12): `lit` = the one being shown (null: none), `shown` = how many have been */
  | { kind: 'strip'; items: PadItem[]; lit: number | null; shown: number; reverse?: boolean }
  /** a number code (card 29): `pos` = how many digits are entered */
  | { kind: 'code'; digits: number[]; pos: number }
  /** the colour(s) to find (card 17) */
  | { kind: 'target'; items: PadItem[]; found: number; total: number }
  /** the trail's next stop (cards 08, 19) */
  | { kind: 'trail'; next: PadItem | null; done: number; total: number }
  | { kind: 'blank' };

/** The rule shown on the board: each cue and its answer ("koralowy → dłoń"). */
export interface Legend { rows: { cue: PadItem; answer: PadItem }[] }

export interface TrialSpec {
  stim: Stim;
  /** the pad for this trial, when it changes (a reshuffled wheel, a new trail); else the level's layout stays */
  layout?: PadLayout;
  /** the rule on the board; null when this level plays it from memory */
  legend: Legend | null;
  /** time to complete the trial, counted from when input opens (ms) */
  deadlineMs: number;
  /**
   * A presentation before input (a strip shown colour by colour): the board steps through `frames`
   * at their times (ms from the trial's start), and input opens at `inputAt`.  Reaction times count from there.
   */
  frames?: { at: number; stim: Stim }[];
  inputAt?: number;
  /** a word over the stimulus for this trial ("Od końca!") */
  cue?: 'reverse' | 'switch' | null;
}

export interface TapIn {
  item: string;
  panel: number;
  /** ms since input opened, on the board's clock */
  t: number;
}

export interface TapOut {
  /** the verdict; null = not part of the task (a tap on something already done): no flash, no count */
  ok: boolean | null;
  /** this tap ended the trial */
  done: boolean;
  /** leave the item marked done on the pad (a found target, a passed trail stop) */
  keep?: boolean;
  /** the stimulus after this tap (progress through a strip, a code, a trail) */
  stim?: Stim;
}

/** One trial as saved (src/cards/store.ts): small, ids only, so a session reads in any language. */
export interface TrialRecord {
  /** index in the session */
  i: number;
  level: number;
  ok: boolean;
  /** time to complete (ms from input open; null when not completed) */
  rt: number | null;
  /** taps that counted, and how many of them were wrong */
  taps: number;
  errors: number;
  /** the cue, and what the player answered (single-tap games) */
  cue?: string;
  resp?: string;
  /** Stroop: 0 congruent, 1 incongruent, 2 neutral */
  cong?: 0 | 1 | 2;
  /** both hands: |left − right| (ms) */
  async?: number;
  /** strips and codes: the length; trails and searches: the stops/targets in the trial */
  n?: number;
  /** how many of those were done correctly */
  done?: number;
  /** the trial ran out of time */
  timeout?: boolean;
  /** board time of input open, ms since the session's play began (for aligning with the band) */
  at: number;
}

export interface GameEngine {
  readonly id: GameId;
  /** the current level, 1 … maxLevel */
  readonly level: number;
  readonly maxLevel: number;
  /** the pad's layout at the current level */
  layout(): PadLayout;
  /** the rule at the current level (for the practice screen, even when play hides it) */
  rule(): Legend | null;
  /** begin the next trial */
  start(): TrialSpec;
  tap(t: TapIn): TapOut;
  /** the deadline passed */
  timeout(): void;
  /** the trial is over (done or timed out): its record; the level adapts here */
  finish(i: number, at: number): TrialRecord;
}

export interface EngineOptions {
  rng: () => number;
  /** where to start (clamped to the engine's range) */
  level: number;
  /** practice trials: the level never changes */
  fixed?: boolean;
}

/** Helpers to build pad items. */
export const dot = (color: PadItem['color'], id: string = color ?? 'dot'): PadItem => ({ id, color });
export const panel = (arrange: Arrange, items: PadItem[], extra: { cols?: number; caption?: string; aspect?: number } = {}): PadLayout =>
  ({ panels: [{ arrange, items, ...extra }] });

/** Pick from `list`, avoiding the same pick as `prev` three times running (runs feel like a glitch). */
export function pickCue<T>(rng: () => number, list: readonly T[], history: T[]): T {
  for (let k = 0; k < 8; k++) {
    const c = list[Math.floor(rng() * list.length)];
    const n = history.length;
    if (!(n >= 2 && history[n - 1] === c && history[n - 2] === c)) return c;
  }
  return list[Math.floor(rng() * list.length)];
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(rng: () => number, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
