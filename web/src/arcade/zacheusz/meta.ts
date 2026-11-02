/**
 * What Zacheusz remembers between sessions and the pure rules of its meta game: "Czterokrotnie"
 * (Luke 19:8) — every denarius ever gathered goes back to Jericho's twelve households, each
 * restored when the all-time sum reaches its mark (nothing is ever spent or chosen); the twelve
 * courses that open in turn and are then replayed for their special denarii (silver, gold, purple);
 * three missions; the records per session length; the day's course and the day's gift.  No DOM.
 */
import { HOMES, MISSIONS, TIERS, type Home, type MissionId, type Tier } from './content';
import { RULES } from './rules';

/** A course's record: finished at least once; the special sets completed (0..3) and the most of the current set in one run; the best branch. */
export interface CourseRec { done: boolean; tier: number; got: number; branch: number }

export interface ZacheuszProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** every denarius gathered for Jericho, all time (play, missions, the day's gift) */
  denarii: number;
  /** ripe figs picked, all time */
  figs: number;
  /** Wypatrywanie blocks begun, all time: every 4th is blind ("Tłum") from the 3rd session */
  pushes: number;
  courses: CourseRec[];
  /** the course the last session ended in (the replays rotate after it) */
  lastCourse: number;
  missions: MissionId[];
  missionsDone: number;
  missionNext: number;
  /** records: denarii per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  bestBranch: number;
  /** "Trasa dnia": the day it was run and its denarii; the day's gift */
  dailyDay: string;
  dailyCoins: number;
  giftDay: string;
}

const freshCourse = (): CourseRec => ({ done: false, tier: 0, got: 0, branch: 0 });

export function freshProgress(): ZacheuszProgress {
  return {
    v: 1, sessions: 0, denarii: 0, figs: 0, pushes: 0,
    courses: Array.from({ length: RULES.courses }, freshCourse), lastCourse: -1,
    missions: MISSIONS.slice(0, 3).map(m => m.id), missionsDone: 0, missionNext: 3,
    best: {}, lastLen: 0, bestBranch: 0, dailyDay: '', dailyCoins: 0, giftDay: '',
  };
}

/** A saved progress may be older or damaged: twelve course records, always. */
export function courseRec(p: ZacheuszProgress, i: number): CourseRec {
  if (!Array.isArray(p.courses)) p.courses = [];
  while (p.courses.length < RULES.courses) p.courses.push(freshCourse());
  const r = p.courses[i];
  if (!r || typeof r !== 'object') return (p.courses[i] = freshCourse());
  return r;
}

// ── the households ───────────────────────────────────────────────
/** How many households the all-time denarii have restored. */
export const homesRestored = (denarii: number): number => RULES.homes.filter(at => denarii >= at).length;

/** The next household and the denarii toward it (null: all twelve restored). */
export function toNextHome(denarii: number): { home: Home; have: number; need: number } | null {
  const i = homesRestored(denarii);
  if (i >= HOMES.length) return null;
  const prev = i ? RULES.homes[i - 1] : 0;
  return { home: HOMES[i], have: Math.max(0, denarii - prev), need: RULES.homes[i] - prev };
}

// ── the courses ──────────────────────────────────────────────────
export const coursesDone = (p: ZacheuszProgress): number => p.courses.filter(c => c?.done).length;

/** Courses open to play: the finished ones and the next (they open in turn). */
export const unlocked = (p: ZacheuszProgress): number => Math.min(RULES.courses, coursesDone(p) + 1);

/** The set of special denarii a course shows now: silver, then gold, then purple (purple stays once all are done). */
export const tierOf = (rec: CourseRec): Tier => TIERS[Math.min(TIERS.length - 1, Math.max(0, rec.tier))];

/**
 * The next course to run: the first one never finished (they open in turn); once all twelve are,
 * the replays — the fewest special sets first, in turn after the last one played.  `skip` are the
 * courses already laid this session (a session never runs the same course twice while others wait).
 */
export function pickCourse(p: ZacheuszProgress, skip: readonly number[] = []): number {
  const n = RULES.courses;
  for (let i = 0; i < n; i++) if (!courseRec(p, i).done && !skip.includes(i)) return i;
  let best = -1, bestTier = Infinity;
  for (let k = 1; k <= n; k++) {
    const i = (((p.lastCourse + k) % n) + n) % n;
    if (skip.includes(i)) continue;
    const tier = courseRec(p, i).tier;
    if (tier < bestTier) { best = i; bestTier = tier; }
  }
  if (best >= 0) return best;
  return (((p.lastCourse + 1 + skip.length) % n) + n) % n;
}

/**
 * A course finished: recorded; all five specials of its set in one run complete the set and
 * show the next on the next replay.  Returns whether it was the first finish and the set completed.
 */
export function finishCourse(p: ZacheuszProgress, index: number, specials: number, branch: number): { first: boolean; completed: Tier | null } {
  const rec = courseRec(p, index);
  const first = !rec.done;
  rec.done = true;
  rec.branch = Math.max(rec.branch, branch);
  let completed: Tier | null = null;
  if (specials >= RULES.specials && rec.tier < TIERS.length) {
    completed = tierOf(rec);
    rec.tier++;
    rec.got = 0;
  } else rec.got = Math.max(rec.got, specials);
  p.bestBranch = Math.max(p.bestBranch, branch);
  return { first, completed };
}

// ── the missions ─────────────────────────────────────────────────
/** After a session: every done mission gives its place to the next not yet open. */
export function turnPages(p: ZacheuszProgress, done: readonly MissionId[]): MissionId[] {
  const opened: MissionId[] = [];
  p.missions = p.missions.map(id => {
    if (!done.includes(id)) return id;
    for (let k = 0; k < MISSIONS.length; k++) {
      const next = MISSIONS[(p.missionNext + k) % MISSIONS.length];
      if (!p.missions.includes(next.id) && !opened.includes(next.id) && !done.includes(next.id)) {
        p.missionNext = (p.missionNext + k + 1) % MISSIONS.length;
        opened.push(next.id);
        return next.id;
      }
    }
    return id;
  });
  return opened;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

export function bestFor(p: ZacheuszProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ZacheuszProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
