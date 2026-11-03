/**
 * A session's numbers (src/cards/DESIGN.md §4.8), from its trial records.
 *
 * Reaction times are summarised by the median of the correct trials — reaction-time
 * distributions have a long right tail, and the median is what the literature reports.  Errors
 * are not timed.  A per-minute rate (correct answers, colours entered, stops passed, targets
 * found) is each game's headline: it rewards speed and accuracy together, and it compares across
 * sessions of different lengths.  The memory strip's headline is the longest strip copied.
 */
import type { GameId, TrialRecord } from './types';

export interface SessionStats {
  trials: number;
  correct: number;
  /** 0..1 */
  accuracy: number;
  errors: number;
  timeouts: number;
  /** median reaction time of the correct trials (ms) */
  medianRt: number | null;
  /** interquartile range of those (ms): how steady the player was */
  iqrRt: number | null;
  /** the headline rate: units per minute of play (see `unitOf`) */
  perMin: number;
  levelMax: number;
  levelEnd: number;
  /** Bez koloru: median RT incongruent − congruent (ms) */
  interference?: number | null;
  /** Obie ręce: median gap between the two hands (ms) */
  asyncMs?: number | null;
  /** Powtórz pasek: the longest strip copied, and the mean length of the copied ones */
  spanMax?: number;
  spanMean?: number | null;
}

export function quantile(sorted: readonly number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (xs: readonly number[]): number | null => quantile([...xs].sort((a, b) => a - b), 0.5);

/** What the headline counts: single trials, or the units inside them. */
export function unitOf(game: GameId): 'answers' | 'colors' | 'stops' | 'targets' | 'span' {
  if (game === 'sekwencja') return 'span';
  if (game === 'kod') return 'colors';
  if (game === 'szlak') return 'stops';
  if (game === 'szukaj') return 'targets';
  return 'answers';
}

/** @param playedSec seconds of play (the clock, not counting pauses) */
export function sessionStats(game: GameId, trials: readonly TrialRecord[], playedSec: number): SessionStats {
  const ok = trials.filter(t => t.ok);
  const rts = ok.map(t => t.rt).filter((x): x is number => x !== null).sort((a, b) => a - b);
  const q1 = quantile(rts, 0.25), q3 = quantile(rts, 0.75);
  const min = Math.max(playedSec, 1) / 60;
  const unit = unitOf(game);
  // colours, stops and targets count inside every trial, finished or not: a code broken at its fifth digit still entered four
  const units = unit === 'answers' ? ok.length : trials.reduce((s, t) => s + (t.done ?? 0), 0);
  const s: SessionStats = {
    trials: trials.length, correct: ok.length, accuracy: trials.length ? ok.length / trials.length : 0,
    errors: trials.reduce((n, t) => n + t.errors, 0), timeouts: trials.filter(t => t.timeout).length,
    medianRt: quantile(rts, 0.5), iqrRt: q1 !== null && q3 !== null ? q3 - q1 : null,
    perMin: Math.round((units / min) * 10) / 10,
    levelMax: trials.reduce((m, t) => Math.max(m, t.level), 0), levelEnd: trials.length ? trials[trials.length - 1].level : 0,
  };
  if (game === 'stroop') {
    const by = (c: 0 | 1) => ok.filter(t => t.cong === c && t.rt !== null).map(t => t.rt!);
    const inc = median(by(1)), con = median(by(0));
    s.interference = inc !== null && con !== null ? Math.round(inc - con) : null;
  }
  if (game === 'obie') s.asyncMs = median(ok.map(t => t.async).filter((x): x is number => x !== undefined));
  if (game === 'sekwencja') {
    const spans = ok.map(t => t.n ?? 0);
    s.spanMax = spans.length ? Math.max(...spans) : 0;
    s.spanMean = spans.length ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10 : null;
  }
  return s;
}

/** The headline number of a session (what progress is drawn with; higher is better). */
export const headline = (game: GameId, s: SessionStats): number => (game === 'sekwencja' ? s.spanMax ?? 0 : s.perMin);
