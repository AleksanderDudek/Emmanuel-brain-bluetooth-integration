/**
 * Scoring of the focus training (DESIGN.md §5): points ("Tlen"), the longest
 * steady hold ("Kontrola"), the mean activity, the per-second session curve,
 * and across sessions the day score (Commitment + Performance), streak and
 * milestones — modelled on Mendi's.
 */
import { LANGS } from '../i18n';
import { CATALOGS, t } from '../i18n/training';
import type { Tool } from '../tools';

/** activity (%) from which the signal counts as elevated */
export const ELEVATED_PCT = 1;
/** dips shorter than this keep the hold going */
export const HOLD_GRACE_SEC = 1.5;
export const POINTS_PER_STAR = 10;

export interface TickResult {
  /** points earned this tick */
  points: number;
  /** a star was earned this tick */
  star: boolean;
}

export class SessionScorer {
  points = 0;
  stars = 0;
  /** longest hold (s) */
  control = 0;
  /** the hold under way (s) */
  hold = 0;
  playedSec = 0;
  reliableSec = 0;
  maxActivity = -Infinity;
  private actSum = 0;
  private below = 0;
  private secAcc = 0;
  private secSum = 0;
  private secN = 0;
  /** activity per second of play (mean of the reliable ticks; null for a second without any) */
  readonly series: (number | null)[] = [];

  tick(activity: number | null, reliable: boolean, dt: number): TickResult {
    this.playedSec += dt;
    let earned = 0;
    let star = false;
    const usable = reliable && activity !== null;
    if (usable) {
      this.reliableSec += dt;
      this.actSum += activity * dt;
      this.maxActivity = Math.max(this.maxActivity, activity);
      this.secSum += activity;
      this.secN++;
      if (activity >= ELEVATED_PCT) {
        earned = (1 + 2 * Math.min(1, activity / 10)) * dt;
        const before = Math.floor(this.points / POINTS_PER_STAR);
        this.points += earned;
        if (Math.floor(this.points / POINTS_PER_STAR) > before) {
          this.stars++;
          star = true;
        }
      }
    }
    if (usable && activity >= ELEVATED_PCT) {
      this.below = 0;
      this.hold += dt;
    } else {
      this.below += dt;
      if (this.below > HOLD_GRACE_SEC) this.hold = 0;
    }
    this.control = Math.max(this.control, this.hold);
    this.secAcc += dt;
    while (this.secAcc >= 1 - 1e-9) {   // 10 × 0.1 s sums to 0.999…
      this.secAcc -= 1;
      this.series.push(this.secN ? Math.round((this.secSum / this.secN) * 10) / 10 : null);
      this.secSum = 0;
      this.secN = 0;
    }
    return { points: earned, star };
  }

  /** mean activity (%) over the reliable part, null if there was none */
  get meanActivity(): number | null {
    return this.reliableSec > 0 ? this.actSum / this.reliableSec : null;
  }
}

// ── across sessions ────────────────────────────────────────────────

/** The feeling words of the mood check, in the order they are offered. */
export const FEELINGS = ['calm', 'energy', 'focus', 'joy', 'gratitude', 'curiosity', 'tiredness', 'stress', 'unease', 'tension',
  'distraction', 'sadness'] as const;
export type Feeling = (typeof FEELINGS)[number];

/** `words`: the feeling words as the player saw them, in the language of that session (Polish before there were others). */
export interface Mood { face: 1 | 2 | 3 | 4 | 5; words: string[] }

/** each feeling word of every language → its feeling */
const FEELING_OF = new Map<string, Feeling>(FEELINGS.flatMap(f => LANGS.map(l => [String(CATALOGS[l][`feel.${f}`]).toLowerCase(), f] as const)));

/** A saved feeling word in the page's language (a word it does not know stays as it is). */
export function feelingText(word: string): string {
  const f = FEELING_OF.get(word.toLowerCase());
  return f ? t(`feel.${f}`) : word;
}

/** What an arcade game adds to a session's training numbers (src/arcade). */
export interface GameResult {
  /** the arcade game's id */
  id: string;
  title: string;
  /** the game's headline number for this session, and its unit ("pięter", "pkt") */
  score: number;
  unit: string;
  /** the game's best before this session (null: the first one) */
  best: number | null;
  /** a few lines for the summary and Sesje: [label, value] */
  stats: [string, string][];
}

export interface TrainingResult {
  id: string;
  /** 'focus' = the focus training; 'game' = an arcade game (its own numbers in `game`) */
  kind: 'focus' | 'game';
  tool: Tool;
  source: 'device' | 'simulator';
  device: string;
  /** epoch seconds */
  start_time: number;
  end_time: number;
  planned_sec: number;
  played_sec: number;
  breathwork_sec: number;
  completed: boolean;
  mood: Mood | null;
  scene: string;
  points: number;
  control_sec: number;
  activity_avg_pct: number | null;
  activity_max_pct: number | null;
  reliable_pct: number;
  /** share of the reliable time with a weak-signal warning (low SCI, room light) */
  weak_signal_pct?: number;
  /** activity % per second of play */
  series: (number | null)[];
  game?: GameResult;
}

const dayKey = (epochSec: number): string => {
  const d = new Date(epochSec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const DAY = 86400;

/** A streak survives one missed day in any FREEZE_DAYS (a "streak freeze", as in Duolingo): life happens. */
export const FREEZE_DAYS = 7;

/**
 * Days with a session in the current streak, counting back from today (or from yesterday if today
 * has none yet).  A single missed day between two session days is forgiven once per FREEZE_DAYS;
 * it keeps the streak going but does not count as a day.
 */
export function streakDays(results: readonly TrainingResult[], nowSec = Date.now() / 1000): number {
  const days = new Set(results.map(r => dayKey(r.start_time)));
  let t = nowSec;
  // today may still bring a session: until it does, a missed yesterday can already be the frozen day
  // (otherwise the morning after a gap would read 0 and the next session would re-announce milestones)
  const pending = !days.has(dayKey(t));
  if (pending) t -= DAY;
  let n = 0, walked = 0, frozeAt = -Infinity;
  for (;;) {
    if (days.has(dayKey(t))) n++;
    else if ((n > 0 || (pending && walked === 0)) && walked - frozeAt >= FREEZE_DAYS && days.has(dayKey(t - DAY))) frozeAt = walked;
    else break;
    t -= DAY;
    walked++;
  }
  return n;
}

/**
 * Today has a session, yesterday none, and the day before one: the streak walks back from today, so
 * yesterday is its first gap and always the forgiven one (FREEZE_DAYS) — a day of rest that kept it.
 */
export function restedYesterday(results: readonly TrainingResult[], nowSec = Date.now() / 1000): boolean {
  const days = new Set(results.map(r => dayKey(r.start_time)));
  return days.has(dayKey(nowSec)) && !days.has(dayKey(nowSec - DAY)) && days.has(dayKey(nowSec - 2 * DAY));
}

export interface DayScore {
  score: number; commitment: number; performance: number; label: string; minutes: number; streak: number;
  /** yesterday was the streak's forgiven day: the summary calls it a day of rest, so it reads as rest, not luck */
  rested: boolean;
}

export const SCORE_LABELS: [number, string][] = [
  [85, t('score.master')], [70, t('score.great')], [50, t('score.solid')], [30, t('score.momentum')], [0, t('score.start')],
];

/** The day score (0–100) after today's sessions: Commitment ≤ 70 + Performance ≤ 30. */
export function dayScore(results: readonly TrainingResult[], nowSec = Date.now() / 1000): DayScore {
  const today = dayKey(nowSec);
  const todays = results.filter(r => dayKey(r.start_time) === today);
  const minutes = todays.reduce((s, r) => s + r.played_sec, 0) / 60;
  const week = new Set(results.filter(r => r.start_time > nowSec - 7 * DAY).map(r => dayKey(r.start_time))).size;
  const streak = streakDays(results, nowSec);
  const commitment = Math.min(40, minutes * 4) + Math.min(20, (week * 20) / 7) + Math.min(10, streak * 2);
  let wSum = 0, aSum = 0;
  for (const r of todays) {
    if (r.activity_avg_pct === null) continue;
    const w = (r.played_sec * r.reliable_pct) / 100;
    wSum += w;
    aSum += r.activity_avg_pct * w;
  }
  const mean = wSum > 0 ? aSum / wSum : 0;
  const performance = Math.max(0, Math.min(30, (mean / 20) * 30));
  const score = Math.round(Math.min(100, commitment + performance));
  return {
    score, commitment: Math.round(commitment), performance: Math.round(performance),
    label: SCORE_LABELS.find(([min]) => score >= min)![1], minutes, streak, rested: restedYesterday(results, nowSec),
  };
}

export interface Milestone { id: string; title: string }

const MILESTONES: { id: string; title: string; reached: (all: readonly TrainingResult[], streak: number) => boolean }[] = [
  { id: 'first', title: t('mile.first'), reached: all => all.length >= 1 },
  { id: 'streak3', title: t('mile.streak', { n: 3 }), reached: (_, s) => s >= 3 },
  { id: 'streak7', title: t('mile.streak', { n: 7 }), reached: (_, s) => s >= 7 },
  { id: 'streak30', title: t('mile.streak', { n: 30 }), reached: (_, s) => s >= 30 },
  { id: 'sessions10', title: t('mile.sessions', { n: 10 }), reached: all => all.length >= 10 },
  { id: 'sessions50', title: t('mile.sessions', { n: 50 }), reached: all => all.length >= 50 },
  { id: 'hour', title: t('mile.hour'), reached: all => all.reduce((s, r) => s + r.played_sec, 0) >= 3600 },
];

/** Milestones reached by adding `latest` to `before`. */
export function newMilestones(before: readonly TrainingResult[], latest: TrainingResult, nowSec = Date.now() / 1000): Milestone[] {
  const after = [...before, latest];
  const s0 = streakDays(before, nowSec), s1 = streakDays(after, nowSec);
  return MILESTONES.filter(m => !m.reached(before, s0) && m.reached(after, s1)).map(({ id, title }) => ({ id, title }));
}

/** Whether `latest` is the best session of its day so far (by points). */
export function isTopSession(results: readonly TrainingResult[], latest: TrainingResult): boolean {
  const day = dayKey(latest.start_time);
  return results.filter(r => r.id !== latest.id && dayKey(r.start_time) === day).every(r => r.points < latest.points);
}
