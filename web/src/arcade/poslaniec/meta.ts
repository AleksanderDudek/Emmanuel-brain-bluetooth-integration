/**
 * What Posłaniec remembers between sessions and the pure rules of its meta game: the road to the
 * seven churches (metres add up across sessions; Ephesus is where the letters set out, each next
 * city is a leg further, and after Laodicea a second journey begins), the drachma jar for the saints
 * in Jerusalem (Romans 15:26) whose milestones dress the messenger, the three open errands, the
 * records per session length, the day's road and the day's gift.  No DOM.
 */
import { CITIES, CLOAKS, MISSIONS, type MissionId } from './content';
import { RULES } from './rules';

export interface PoslaniecProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** metres run, all time: the road to the churches */
  metres: number;
  /** drachmas gathered, all time (the jar) */
  drachmas: number;
  /** the cloak worn (index into CLOAKS; the newest earned unless the player chose another) */
  cloak: number;
  /** push blocks begun, all time: every 4th is blind ("Mgła na przełęczy") from the 3rd session */
  pushes: number;
  /** the errands: the three open ones, how many were done, the next to open */
  missions: MissionId[];
  missionsDone: number;
  missionNext: number;
  /** records: metres per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  bestCombo: number;
  /** the longest time on the heights in one session (s) and the most fires lit in one */
  heightsBest: number;
  firesBest: number;
  /** the day's road: the day it was run and its metres; the day's gift */
  dailyDay: string;
  dailyMetres: number;
  giftDay: string;
}

export function freshProgress(): PoslaniecProgress {
  return {
    v: 1, sessions: 0, metres: 0, drachmas: 0, cloak: 0, pushes: 0,
    missions: MISSIONS.slice(0, 3).map(m => m.id), missionsDone: 0, missionNext: 3,
    best: {}, lastLen: 0, bestCombo: 0, heightsBest: 0, firesBest: 0, dailyDay: '', dailyMetres: 0, giftDay: '',
  };
}

// ── the road to the seven churches ───────────────────────────────
/** One journey's length: Ephesus to Laodicea (m). */
export const LAP = RULES.legs.reduce((s, l) => s + l, 0);

export interface RouteAt {
  /** the journey (1 = the first; 2 = "the second journey" …) */
  lap: number;
  /** the last city reached (0 = Ephesus, where every journey sets out) and the next (null: none) */
  city: number;
  next: number;
  /** metres into the leg toward `next`, and the leg's length */
  into: number;
  leg: number;
}

/** Where `metres` (all time) put the messenger on the road. */
export function routeAt(metres: number): RouteAt {
  const m = Math.max(0, Math.floor(metres));
  const lap = Math.floor(m / LAP) + 1;
  let rest = m % LAP;
  let city = 0;
  for (const leg of RULES.legs) {
    if (rest < leg) return { lap, city, next: city + 1, into: rest, leg };
    rest -= leg;
    city++;
  }
  return { lap, city: 0, next: 1, into: 0, leg: RULES.legs[0] };
}

/** The cities reached between two totals, in order ({lap, city}); Laodicea closes a journey. */
export function citiesBetween(from: number, to: number): { lap: number; city: number }[] {
  const out: { lap: number; city: number }[] = [];
  if (to <= from) return out;
  const marks: number[] = [];
  let acc = 0;
  for (const leg of RULES.legs) marks.push((acc += leg));
  const lap0 = Math.floor(Math.max(0, from) / LAP);
  for (let lap = lap0; lap * LAP < to; lap++) {
    marks.forEach((mk, i) => {
      const at = lap * LAP + mk;
      if (at > from && at <= to) out.push({ lap: lap + 1, city: i + 1 });
    });
  }
  return out;
}

/** The postcards owned: every city reached on any journey (Ephesus from the start). */
export function postcards(metres: number): boolean[] {
  const r = routeAt(metres);
  return CITIES.map((_, i) => r.lap > 1 || i <= r.city);
}

// ── the jar ──────────────────────────────────────────────────────
/** The cloaks earned by a jar of `drachmas` (the first is always worn). */
export const cloaksEarned = (drachmas: number): number => CLOAKS.filter(c => drachmas >= c.at).length;

/** Drachmas toward the next cloak (null: all earned). */
export function toNextCloak(drachmas: number): { have: number; need: number; index: number } | null {
  const n = cloaksEarned(drachmas);
  if (n >= CLOAKS.length) return null;
  return { have: drachmas - CLOAKS[n - 1].at, need: CLOAKS[n].at - CLOAKS[n - 1].at, index: n };
}

/** The cloak to wear: the chosen one if earned, else the newest earned. */
export const cloakOf = (p: PoslaniecProgress): number => {
  const n = cloaksEarned(p.drachmas);
  return p.cloak >= 0 && p.cloak < n ? p.cloak : n - 1;
};

// ── the errands ──────────────────────────────────────────────────
/** After a session: every done errand gives its place to the next not yet open. */
export function turnPages(p: PoslaniecProgress, done: readonly MissionId[]): MissionId[] {
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

/** The record for a session length (null: none yet). */
export function bestFor(p: PoslaniecProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never run). */
export function bestOf(p: PoslaniecProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
