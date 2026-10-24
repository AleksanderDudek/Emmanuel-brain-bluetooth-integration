/**
 * What Geoda remembers between sessions (saved by the runner under "arcade:geoda"): records, the
 * Gablota (nine minerals, each at the best tier found; the first one comes with the calibration),
 * pył from duplicates that crafts the next missing specimen, the pity counters, the depth level
 * from XP, and the daily geode.  A session credits its counters as it goes (SessionCredit), so
 * ending it early keeps what it earned; its specimen is rolled at the end, from published odds
 * that improve with clarity and the longest hold, with a pity guarantee per tier and a new
 * mineral in each of the first geodes — the band never decides a roll on its own, and nothing is
 * for sale.
 */
import { clamp } from '../kit/juice';
import { CRAFT_DUST, DUST, MINERALS, NEW_FIRST, PITY, SIZES, TIER_BONUS, TIER_ODDS, TIERS } from './content';

export interface Specimen { m: number; tier: number; cm: number }

export interface GeodaProgress {
  v: 1;
  /** sessions played past their first block (the first one is the tutorial) */
  sessions: number;
  xp: number;
  /** best carats per session length (planned seconds) */
  best: Record<string, number>;
  /** the longest continuity of focus (s) */
  longestCont: number;
  /** the biggest specimen (cm) */
  biggest: number;
  /** the tier of each mineral in the cabinet (null: not found yet) */
  gablota: (number | null)[];
  dust: number;
  /** rolls since the last specimen of tier ≥ T (index T; 0 unused) */
  pity: number[];
  /** geodes cracked so far (the first NEW_FIRST hold a missing mineral) */
  cracks: number;
  /** the day the daily geode was last played, and its best carats */
  dailyDay: string;
  dailyBest: number;
  fullGeodes: number;
  lines: number;
  /** the finest specimen so far (the lobby shows it) */
  star: Specimen | null;
}

export function freshProgress(): GeodaProgress {
  return {
    v: 1, sessions: 0, xp: 0, best: {}, longestCont: 0, biggest: 0,
    gablota: MINERALS.map((_, i) => (i === 0 ? 0 : null)),   // the amethyst "za kalibrację"
    dust: 0, pity: [0, 0, 0, 0], cracks: 0, dailyDay: '', dailyBest: 0, fullGeodes: 0, lines: 0, star: null,
  };
}

// ── depth ───────────────────────────────────────────────────────

/** XP needed to reach depth `level`: 0, 60, 200, 420, 720, 1100, … (level 2 after a first session). */
export const xpFor = (level: number): number => 60 * (level - 1) + 40 * (level - 1) * (level - 2);

export function depth(xp: number): { level: number; from: number; to: number } {
  let level = 1;
  while (xp >= xpFor(level + 1)) level++;
  return { level, from: xpFor(level), to: xpFor(level + 1) };
}

/** XP of a session: reliable seconds on the asked side of the threshold plus carats / 10. */
export const sessionXp = (zoneSec: number, carats: number): number => Math.round(zoneSec + carats / 10);

// ── specimens ───────────────────────────────────────────────────

/** The specimen's size from the session's carats (cm). */
export const specimenCm = (carats: number): number => Math.round((1 + 0.9 * Math.sqrt(Math.max(0, carats))) * 10) / 10;

/** The size class for the carats so far (an index into SIZES) and the carats the next one needs (null at the top). */
export function sizeClass(carats: number): { size: number; need: number | null } {
  let i = 0;
  while (i < SIZES.length - 1 && carats >= SIZES[i + 1].ct) i++;
  const n = SIZES[i + 1];
  return { size: i, need: n ? n.ct - carats : null };
}

/** How fine the session was for the roll: 0.6 × the share of clear cells + 0.4 × the longest hold over 30 s. */
export const quality = (clearShare: number | null, longest: number): number =>
  clamp(0.6 * (clearShare ?? 0) + 0.4 * clamp(longest / 30));

/** The published odds of each tier for a session of quality `q` (0..1); they sum to 1. */
export function tierOdds(q: number): number[] {
  const k = clamp(q);
  const o = TIER_ODDS.map((p, t) => p + TIER_BONUS[t] * k);
  o[0] = 1 - o[1] - o[2] - o[3];
  return o;
}

/** A tier from the odds; the pity counters guarantee tier T (or better) on the PITY[T]-th roll without one. */
export function rollTier(rng: () => number, odds: readonly number[], pity: readonly number[]): number {
  let floor = 0;
  for (let t = 1; t < TIERS.length; t++) if (pity[t] + 1 >= PITY[t]) floor = t;
  const total = odds.slice(floor).reduce((s, v) => s + v, 0);
  let r = rng() * total, t = floor;
  while (t < TIERS.length - 1 && r >= odds[t]) r -= odds[t], t++;
  return t;
}

export interface Roll {
  specimen: Specimen;
  /** a new mineral in the cabinet, a better tier of one, or a duplicate turned into pył */
  outcome: 'new' | 'upgrade' | 'dust';
  dust: number;
}

/**
 * One cracked geode into the cabinet (mutates the progress: pity, cabinet, pył, the count).  The
 * mineral is one of the nine at 1 in 9 — in the first NEW_FIRST geodes one the cabinet still misses.
 */
export function crack(p: GeodaProgress, rng: () => number, q: number, carats: number): Roll {
  const missing = p.gablota.map((t, i) => (t === null || t === undefined ? i : -1)).filter(i => i >= 0);
  const pool = p.cracks < NEW_FIRST && missing.length ? missing : MINERALS.map((_, i) => i);
  const m = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  p.cracks++;
  const tier = rollTier(rng, tierOdds(q), p.pity);
  for (let t = 1; t < TIERS.length; t++) p.pity[t] = tier >= t ? 0 : p.pity[t] + 1;
  const specimen = { m, tier, cm: specimenCm(carats) };
  const had = p.gablota[m];
  let outcome: Roll['outcome'] = 'dust', dust = 0;
  if (had === null || had === undefined) {
    p.gablota[m] = tier;
    outcome = 'new';
  } else if (tier > had) {
    p.gablota[m] = tier;
    outcome = 'upgrade';
  } else {
    dust = DUST[tier];
    p.dust += dust;
  }
  if (!p.star || tier > p.star.tier || (tier === p.star.tier && specimen.cm > p.star.cm)) p.star = specimen;
  p.biggest = Math.max(p.biggest, specimen.cm);
  return { specimen, outcome, dust };
}

/** Pył crafts the next missing mineral (in cabinet order); with the set complete, it lifts the plainest one a tier. */
export function craft(p: GeodaProgress): number[] {
  const made: number[] = [];
  while (p.dust >= CRAFT_DUST) {
    let m = p.gablota.findIndex(t => t === null || t === undefined);
    if (m >= 0) p.gablota[m] = 0;
    else {
      const low = Math.min(...p.gablota.map(t => t ?? 0));
      if (low >= TIERS.length - 1) break;
      m = p.gablota.findIndex(t => (t ?? 0) === low);
      p.gablota[m] = low + 1;
    }
    p.dust -= CRAFT_DUST;
    made.push(m);
  }
  return made;
}

export const found = (p: GeodaProgress): number => p.gablota.filter(t => t !== null && t !== undefined).length;

/** A session's running totals. */
export interface SessionTally {
  carats: number;
  /** reliable seconds on the asked side of the threshold */
  zoneSec: number;
  lines: number;
  fullGeodes: number;
}

/**
 * A session's account with the progress, credited at the end of every block rather than only at
 * the crack, so a session ended early ("Zakończ i zapisz") keeps what it earned: the session itself
 * and the daily geode count once, from the first block's end; XP, lines and full geodes move by
 * what is new since the last credit.
 */
export class SessionCredit {
  /** the session has counted (its first block ended) */
  counted = false;
  /** the depth level before the session (the summary's "Głębokość N") */
  readonly levelBefore: number;
  private xp = 0;
  private lines = 0;
  private fullGeodes = 0;

  constructor(private readonly p: GeodaProgress, private readonly day: string, private readonly daily: boolean) {
    this.levelBefore = depth(p.xp).level;
  }

  add(s: SessionTally): void {
    const p = this.p;
    if (!this.counted) {
      this.counted = true;
      p.sessions++;
      if (this.daily) {
        p.dailyDay = this.day;
        p.dailyBest = 0;
      }
    }
    const xp = sessionXp(s.zoneSec, s.carats);
    p.xp += xp - this.xp;
    p.lines += s.lines - this.lines;
    p.fullGeodes += s.fullGeodes - this.fullGeodes;
    this.xp = xp;
    this.lines = s.lines;
    this.fullGeodes = s.fullGeodes;
  }
}

export interface Cracked {
  rolls: Roll[];
  /** minerals pył crafted afterwards */
  crafted: number[];
}

/**
 * "Rozłup geodę" (once, at the end of a session): its geode cracks — plus one more for every Pełna
 * geoda — into the cabinet, and pył crafts what it can.
 */
export function crackGeodes(p: GeodaProgress, rng: () => number, s: { carats: number; clearShare: number | null; longest: number; geodes: number }): Cracked {
  const q = quality(s.clearShare, s.longest);
  const rolls: Roll[] = [];
  for (let i = 0; i < s.geodes; i++) rolls.push(crack(p, rng, q, s.carats));
  return { rolls, crafted: craft(p) };
}

/**
 * The records of a session, idempotently (Math.max): best carats for its length, the longest
 * continuity, and the daily geode's best when this session is `daily`'s.
 */
export function record(p: GeodaProgress, plannedSec: number, carats: number, longest: number, daily?: string): void {
  const key = String(Math.round(plannedSec));
  p.best[key] = Math.max(p.best[key] ?? 0, carats);
  p.longestCont = Math.max(p.longestCont, Math.round(longest));
  if (daily !== undefined && p.dailyDay === daily) p.dailyBest = Math.max(p.dailyBest, carats);
}

/** The best headline so far over all lengths (null: never played). */
export function bestCarats(p: GeodaProgress): number | null {
  const v = Object.values(p.best ?? {});
  return v.length ? Math.max(...v) : null;
}
