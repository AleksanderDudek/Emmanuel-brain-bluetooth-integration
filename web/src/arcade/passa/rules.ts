/**
 * Every number of Złota passa in one place, the session's plan and the day-streak's arithmetic (DESIGN.md §26), pure
 * and deterministic.
 *
 * One day walked down one street over the session's length T (3–60 minutes, or a test of a minute or less):
 *
 *   intro     dawn on the street, the root verse (a first-ever session: the story card — what the game is)   free
 *   moments   one after another, each a fixed run of blocks:
 *               arrive   the card comes down the street (a few seconds of real time: the turn's telegraph)    free
 *               name     a heavy moment only: the hurt said plainly, whole breaths (Ps 34:18)                 rest
 *               without  a given moment only (round 25): the thing greys away, "imagine without", a breath  rest
 *               turn     the push: the hand picks the reframe, only focus turns the card grey → gold          push
 *               after    whole breaths: the light flies up into the garland (savor) — or, a card focus did     rest
 *                        not turn, it goes gently into the pocket (carry); the band rests either way
 *   evening   the street darkens, the garland of the day's wins lights it, the identity (rest) · the prayer of
 *             thanks (rest) · the close: "for what most?", the closing verse (free) — ending at T
 *
 * Every block has a planned start and end, so the day always reaches its evening and the session's end.  By design (the
 * dials untouched) the push and the after-rest grow with the session's length (`design`); a player who moved a dial
 * keeps it — the session fits as many moments as their rhythm allows and the evening takes what is left (always less
 * than one moment, up to `momentsMax` moments: past half an hour a rhythm that would hold more is lengthened within the
 * dials, `stretchFrom`; an hour of the longest dials leaves an evening of about four minutes).
 *
 * Only real focus turns a card (§18.3–18.4): in a sighted push past its lead-in, with a reliable signal, while focused,
 * at `focusRate` (the level averaged over one whole breath).  The rests are receptive.
 *
 * Round 25 (life.ts, DESIGN.md §29): the plan mixes the kinds of a day — the cards of round 22 (a joy, a trouble, the
 * player's own, one carried back), **sense** moments (a mini session of attention on one sense: a turn of the rhythm's
 * push) and **given** moments (a thing taken for granted: a whole breath of rest first — "imagine without" — then the
 * turn), about a quarter and a fifth of the day, within the sets there are; the first moment is always a card.  A
 * session whose age group was never chosen asks for it at the intro's end (`ask`).
 */
import { clamp } from '../kit/juice';
import { SENSE_MAX, SENSE_MIN } from './life';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a push before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** focus-seconds a second past the lead-in for the average player (the plan's yardstick) */
  avgYield: 0.75,
  /** the average player turns a card in this share of its sighted time */
  fill: 0.85,
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)); `above` = (mean level − 0.5) / 0.5 */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the level the rate reads is averaged over one whole breath (s, §18.4) */
  meanSec: 10,
  /** what is shown follows the truth with this time constant (s) */
  showTau: 0.9,
  /** a first-ever session's first card asks this share of the need */
  firstNeed: 0.5,
  /**
   * a test session's card asks this share (app:smoke plays 40 s with the simulator's focus on about half the time and
   * must turn a card — Ogród's `testNeed`; a real session is never a test)
   */
  testNeed: 0.4,

  // ── the rhythm (kit/rhythm.ts): the turn's seconds (lead-in included), the after-rest's whole breaths ──
  focus: { def: 20, min: 15, max: 40, step: 5 },
  rest: { def: 1, min: 1, max: 4 },
  /**
   * by design (dials untouched): from a session of this many seconds, the push (s) and the after-rest (breaths) — round
   * 24: 45 minutes take 35 s and 4 breaths (32 moments: every set moment once), an hour the dials' longest, 40 s and 4
   */
  design: [[0, 20, 1], [600, 20, 2], [1200, 25, 2], [1500, 30, 3], [2700, 35, 4], [3300, 40, 4]] as readonly (readonly [number, number, number])[],
  /** the breath of every rest: 4 · 0 · 6 · 0 (the runner's pacer) — one whole breath (s) */
  cyc: 10,

  // ── the day ────────────────────────────────────────────────────
  /** a card coming down the street (s of real time; the push's telegraph) */
  arriveSec: 3,
  /** a heavy moment's name: at least this many whole breaths (the after-rest's when longer) */
  nameBreaths: 2,
  /** a push never shorter than the lead-in plus this (s) */
  pushMinSighted: 8,
  intro: { share: 0.05, min: 12, max: 30 },
  /** a first-ever session's intro is longer by this (s): the story card */
  storySec: 8,
  evening: { share: 0.12, min: 36, max: 120 },
  /** shares of the evening: the garland and the identity, the prayer (whole breaths); the close takes the rest */
  garland: 0.42,
  prayer: 0.26,
  closeMin: 14,
  /** the close's "for what most?" stays open to this share of the close (then the closing verse comes anyway) */
  pickUntil: 0.6,
  /** at most this many moments in a session */
  momentsMax: 40,
  /**
   * past this length (s) a day the player's dials would fill with more moments than `momentsMax` lengthens their
   * rhythm within the dials' ranges — the rests first, then the turns — so the moments fill the day, not the evening
   * (round 24: dials of 15 s and one breath left 37 minutes of evening in an hour); 30 minutes and less as before
   */
  stretchFrom: 1800,
  /**
   * a day longer than the sets (an hour: 40 moments, 32 in the sets) meets a set moment again only this many moments
   * after it (round 24: an hour's day once met the same card again four moments later; 12 moments ≈ 16 minutes)
   */
  againAfter: 12,
  /** a heavy moment needs this many moments around it (never the first, never the last) */
  heavyMinMoments: 3,
  /** where in the day a heavy moment stands (share of the moments) */
  heavyAt: 0.6,

  // ── round 25: the film of a day (life.ts) ───────────────────────
  /** about this share of a day's moments are sense moments (a mini session of attention on one sense) */
  senseShare: 0.25,
  /** about this share are given moments (a thing taken for granted), each with its rest first */
  givenShare: 0.2,
  /** a given moment's rest before its turn ("imagine without"): whole breaths */
  givenBreaths: 1,
  /** the opening card that asks for the age group when none was chosen (s, at the intro's end) */
  askSec: 12,
  /** after a pick the card stays this long with the chosen chip lit and its line, then closes (s) */
  askShowSec: 1.8,
  /**
   * the day's light at the moments' end (round 22: 0.78): the film's day has its evening at home too — about a fifth of
   * the moments in the evening's light, the lamps lit (the sets' evening moments: the table, the window, a warm bed) —
   * and the garland's night after it
   */
  momentsLight: 0.9,
  /** a sense moment's guide lines begin this far into its push (s): the arrive's line is read first */
  guideFrom: 2.5,
  /** a moment's place may stand this many steps of the day's route past where the route expects the film at its slot */
  routeAhead: 2.5,

  // ── a test session (≤ testSec: app:smoke plays 40 s and must turn a card) ──
  testSec: 60,
  test: { intro: 0.1, evening: 0.2, arrive: 2, after: 0.2 },

  // ── a moment ───────────────────────────────────────────────────
  /** the gold words write themselves from this share of the turn on (the card shows its gold side from ~half) */
  writeFrom: 0.35,
  /** the gold words never write faster than this (share a second) and finish at it once the card turned */
  writeRate: 0.7,
  /** the first choice is shown on the gold side from this share of the turn when none was picked */
  autoPick: 0.45,
  /** a turned card's glow keeps abiding: one sparkle for each this many focus-seconds held after the turn (no score) */
  sparkleSec: 4,
  sparkleMax: 4,
  /** a push with no progress this long (s, sighted) asks gently once */
  waitSec: 10,
  /** the light's flight from the card into the garland (s), the pocket's slide (s) */
  flySec: 1.8,
  carrySec: 3.2,
  /** the narrator names a run at these lengths */
  runSay: [3, 5, 7, 10, 15, 20, 30] as readonly number[],
  /** a run's banner stays this long (s) */
  runBanner: 2.6,

  // ── the player's own day, the carried cards, the habit ──────────
  ownMax: 8,
  ownLen: 64,
  winLen: 56,
  /** cards carried that come back next session */
  carryKeep: 3,
  /**
   * set moments remembered as played lately (they come later in the order) — round 25: about a week of short days, so
   * the group's sets come round before a moment comes again
   */
  recentMax: 48,
  /** a single missed day is forgiven at most once in this many days */
  graceEvery: 7,

  // ── voice and cards ────────────────────────────────────────────
  telegraph: 3,
  bannerSec: 5,
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.5,
  hintGap: 1.2,
} as const;

/** How long a line of `text` stays on screen to be read twice (s): ≥ 2.5 s + 70 ms a character. */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/**
 * How fast a card turns per second for a frame, in focus-seconds: only while focused, faster above the threshold (the
 * level averaged over a whole breath) and as a focused stretch is held.  (The sim calls it only in a sighted push past
 * its lead-in with a reliable signal.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

/** Focus-seconds a card of a push `push` s long asks of the average player (before the first-ever / test shares). */
export const needFor = (push: number, lead: number): number => Math.max(0.5, RULES.avgYield * Math.max(1, push - lead) * RULES.fill);

/** A focus dial value in range (the design's when absent). */
export const dialFocus = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v ?? F.def, F.def) / F.step) * F.step, F.min, F.max);
};
export const dialRest = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v ?? R.def, R.def)), R.min, R.max);
};

/** The design's push (s) and after-rest (breaths) for a session of T seconds. */
export function designFor(T: number): { push: number; breaths: number } {
  let push: number = RULES.design[0][1], breaths: number = RULES.design[0][2];
  for (const [sec, p, b] of RULES.design) if (T >= sec - 1) { push = p; breaths = b; }
  return { push, breaths };
}

export type BlockKind = 'rest' | 'push' | 'free';
/** What a block is about. */
export type BlockWhat = 'intro' | 'arrive' | 'name' | 'without' | 'turn' | 'after' | 'garland' | 'prayer' | 'close';

/**
 * What a slot of the day holds (round 25): a card (a joy or a trouble from the sets, the player's own, one carried
 * back — the sim picks), a sense moment, a given moment (its rest first), or the heavy moment (its name first).
 */
export type SlotKind = 'card' | 'sense' | 'given' | 'heavy';

/** One block of the schedule: planned start and end (s of play), and the moment (slot) it belongs to (−1: none). */
export interface PlanBlock { kind: BlockKind; what: BlockWhat; t0: number; t1: number; slot: number }

export interface PlanOpts {
  plannedSec: number;
  eeg: boolean;
  /** the rhythm: the turn's seconds and the after-rest's whole breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  /** the player moved a dial (kit/rhythm.ts `custom`): their push and rest are kept */
  custom?: boolean;
  /** a first-ever session: the intro holds the story card */
  first?: boolean;
  /** the player asked for the hard things too ("Także to, co trudne"): one heavy moment when the day is long enough */
  heavy?: boolean;
  /** (round 25) the sense and given moments the sets hold for the player's group (0 / absent: none — round 22's day) */
  sense?: number;
  given?: number;
  /** (round 25) the age group was never chosen: the intro ends with the card that asks for it (never in a test) */
  ask?: boolean;
}

export interface Plan {
  T: number;
  lead: number;
  cyc: number;
  test: boolean;
  /** the push (s, lead-in included) and the after-rest (whole breaths; a test: a share of one) */
  push: number;
  breaths: number;
  /** a heavy moment's name (whole breaths) */
  nameBreaths: number;
  /** the moments of the day, and the slot of the heavy one (−1: none) */
  n: number;
  heavyAt: number;
  /** (round 25) each slot's kind, how many sense and given moments, a sense moment's push (s), a given's rest (breaths) */
  kinds: SlotKind[];
  nSense: number;
  nGiven: number;
  sensePush: number;
  givenBreaths: number;
  introEnd: number;
  /** (round 25) the age card in the intro: from, to (0, 0: none) */
  askT0: number;
  askEnd: number;
  /** the evening's start, the garland's and the prayer's ends; the close ends at T */
  eveningStart: number;
  garlandEnd: number;
  prayerEnd: number;
  blocks: PlanBlock[];
}

/** The session's plan (see the module's comment). */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= R.testSec;
  const cyc = R.cyc;
  const lead = leadOf(o.eeg);
  const custom = !!o.custom;
  let intro: number, arrive: number, push: number, breaths: number, after: number;
  let n: number, heavyAt = -1, nGiven = 0, nSense = 0, askSec = 0;
  const nameB = (b: number): number => Math.max(R.nameBreaths, b);
  const W = R.givenBreaths * cyc;

  if (test) {
    // the shares only: one moment, an after-rest of a share of a breath, the rest a push (well past the lead-in)
    intro = T * R.test.intro;
    const evening = T * R.test.evening;
    arrive = R.test.arrive;
    const M = Math.max(1, T - intro - evening);
    after = Math.min(cyc, M * R.test.after);
    push = Math.max(lead + 1, M - arrive - after);
    breaths = 1;
    n = 1;
  } else {
    askSec = o.ask ? R.askSec : 0;
    intro = clamp(T * R.intro.share, R.intro.min, R.intro.max) + (o.first ? R.storySec : 0) + askSec;
    const eve0 = clamp(T * R.evening.share, R.evening.min, R.evening.max);
    const M = Math.max(1, T - intro - eve0);
    arrive = R.arriveSec;
    if (custom) {
      push = dialFocus(o.focus);
      breaths = dialRest(o.rest);
    } else ({ push, breaths } = designFor(T));
    const cost = (): number => arrive + push + breaths * cyc;
    /** moments that fit with `g` given moments (each a breath of rest more) and the heavy one's name */
    const fitG = (g: number, heavy: boolean): number => Math.floor((M - g * W - (heavy ? nameB(breaths) * cyc : 0) + 1e-6) / cost());
    const fit = (heavy: boolean): number => fitG(0, heavy);
    // a session too short for the dials (never at 3 minutes and up, kept for odd lengths): rests, then pushes shrink
    while (fit(false) < 1 && breaths > 1) breaths--;
    if (fit(false) < 1) push = Math.max(lead + R.pushMinSighted, M - arrive - breaths * cyc);
    // a long session too long for the dials' moments: the rhythm lengthens within the dials (see `stretchFrom`)
    if (T > R.stretchFrom) {
      while (fit(false) > R.momentsMax && breaths < R.rest.max) breaths++;
      while (fit(false) > R.momentsMax && push < R.focus.max) push = Math.min(R.focus.max, push + R.focus.step);
    }
    n = Math.min(R.momentsMax, Math.max(1, fit(false)));
    const hv = !!o.heavy && Math.min(R.momentsMax, fit(true)) >= R.heavyMinMoments;
    if (hv) n = Math.min(R.momentsMax, fit(true));
    // round 25: the given moments — about a fifth of the day, within the sets, each a breath of rest more (so a day
    // keeps as many as still leave a fifth; the cards always keep the first slot, the sense moments theirs)
    const senseOf = (k: number): number => (push < SENSE_MIN ? 0 : Math.min(Math.max(0, Math.floor(fin(o.sense ?? 0, 0))), Math.round(R.senseShare * k)));
    let g = Math.min(Math.max(0, Math.floor(fin(o.given ?? 0, 0))), Math.round(R.givenShare * n));
    for (;;) {
      const k = Math.min(R.momentsMax, Math.max(1, fitG(g, hv)));
      if (g > 0 && (g > Math.round(R.givenShare * k) || k - g - (hv ? 1 : 0) - senseOf(k) < 1 || (hv && k < R.heavyMinMoments))) {
        g--;
        continue;
      }
      n = k;
      break;
    }
    if (hv && n >= R.heavyMinMoments) heavyAt = clamp(Math.round(n * R.heavyAt), 1, n - 2);
    nGiven = g;
    nSense = Math.max(0, Math.min(senseOf(n), n - nGiven - (heavyAt >= 0 ? 1 : 0) - 1));
    after = breaths * cyc;
  }
  const kinds = slotKinds(n, heavyAt, nSense, nGiven);
  const sensePush = Math.min(push, SENSE_MAX);

  // the schedule (the evening takes what the moments leave: less than one moment)
  const blocks: PlanBlock[] = [];
  let t = 0;
  const add = (kind: BlockKind, what: BlockWhat, dur: number, slot = -1): void => {
    if (!(dur > 1e-9)) return;
    blocks.push({ kind, what, t0: t, t1: t + dur, slot });
    t += dur;
  };
  add('free', 'intro', intro);
  for (let i = 0; i < n; i++) {
    add('free', 'arrive', arrive, i);
    if (i === heavyAt) add('rest', 'name', nameB(breaths) * cyc, i);
    if (kinds[i] === 'given') add('rest', 'without', W, i);
    add('push', 'turn', kinds[i] === 'sense' ? sensePush : push, i);
    add('rest', 'after', after, i);
  }
  const eveningStart = t;
  const E = Math.max(1, T - eveningStart);
  let garland: number, prayer: number;
  if (test) {
    garland = E * 0.5;
    prayer = 0;
  } else {
    // the receptive parts in whole breaths; the rounding never eats the close
    const whole = (x: number): number => Math.max(1, Math.round(x / cyc)) * cyc;
    garland = whole(E * R.garland);
    prayer = whole(E * R.prayer);
    const least = Math.min(R.closeMin, E * 0.4);
    while (E - garland - prayer < least - 1e-6 && garland + prayer > 0) {
      if (garland >= prayer && garland > cyc) garland -= cyc;
      else if (prayer > cyc) prayer -= cyc;
      else if (prayer > 0) prayer = 0;
      else garland = Math.max(0, E - least);
    }
  }
  add('rest', 'garland', garland);
  add('rest', 'prayer', prayer);
  const garlandEnd = eveningStart + garland, prayerEnd = garlandEnd + prayer;
  add('free', 'close', T - t);
  return {
    T, lead, cyc, test, push, breaths, nameBreaths: nameB(breaths), n, heavyAt, kinds, nSense, nGiven, sensePush, givenBreaths: R.givenBreaths,
    introEnd: intro, askT0: askSec ? intro - askSec : 0, askEnd: askSec ? intro : 0, eveningStart, garlandEnd, prayerEnd, blocks,
  };
}

/**
 * Each slot's kind (round 25): the first a card; the heavy one at its place; the sense moments spread from early in the
 * day (a short day meets one at its second moment), then the given ones evenly over the slots left; the rest cards.
 */
export function slotKinds(n: number, heavyAt: number, nSense: number, nGiven: number): SlotKind[] {
  const kinds: SlotKind[] = Array.from({ length: Math.max(0, n) }, () => 'card');
  if (heavyAt >= 0 && heavyAt < n) kinds[heavyAt] = 'heavy';
  const free = (): number[] => kinds.map((k, i) => (i > 0 && k === 'card' ? i : -1)).filter(i => i > 0);
  const spread = (count: number, kind: SlotKind, off: number): void => {
    const f = free();
    const c = Math.min(count, f.length);
    const at = Array.from({ length: c }, (_, i) => f[Math.min(f.length - 1, Math.floor(((i + off) * f.length) / c))]);
    for (const i of at) kinds[i] = kind;
  };
  spread(nSense, 'sense', 0.25);
  spread(nGiven, 'given', 0.5);
  return kinds;
}

/** The after-rest a session of `sec` really keeps for the player's dials (whole breaths): the lobby's `restIn`. */
export function restInFor(focus: number, rest: number, sec: number): number {
  return planFor({ plannedSec: sec, eeg: false, focus, rest, custom: true }).breaths;
}

// ── the day-streak (the habit) ───────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whole calendar days from `a` to `b` ('YYYY-MM-DD'; NaN when either is not a day). */
export function daysBetween(a: string, b: string): number {
  const ma = typeof a === 'string' ? a.match(DAY_RE) : null;
  const mb = typeof b === 'string' ? b.match(DAY_RE) : null;
  if (!ma || !mb) return NaN;
  const ua = utcDay(ma), ub = utcDay(mb);
  return Number.isFinite(ua) && Number.isFinite(ub) ? Math.round((ub - ua) / 86_400_000) : NaN;
}

/** A matched 'YYYY-MM-DD' as UTC milliseconds, NaN for a day that does not exist (2026-13-01, 2027-02-29). */
function utcDay(m: RegExpMatchArray): number {
  const y = +m[1], mo = +m[2], d = +m[3];
  const u = Date.UTC(y, mo - 1, d);
  const back = new Date(u);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? u : NaN;
}

/** A day string 'YYYY-MM-DD' or ''. */
export const cleanDay = (v: unknown): string => {
  if (typeof v !== 'string') return '';
  const s = v.slice(0, 10);
  return Number.isFinite(daysBetween(s, s)) ? s : '';
};

export interface Streak {
  /** session days in the current streak (0: none yet) */
  days: number;
  /** the last day with a session ('' none) */
  last: string;
  /** the day a single missed day was last forgiven ('' never) */
  grace: string;
  /** the longest streak so far */
  best: number;
}

/** Whether a single missed day may be forgiven on `day` (no grace in the last `graceEvery` days). */
export function graceFree(s: Streak, day: string): boolean {
  if (!s.grace) return true;
  const d = daysBetween(s.grace, day);
  return !Number.isFinite(d) || d >= RULES.graceEvery || d < 0;
}

/**
 * The streak after a session on `day`: the same day changes nothing; the next day adds one; one missed day between is
 * forgiven (at most once in `graceEvery` days — "His mercies are new every morning"), so it adds one too; anything else
 * begins again at 1.  Pure: returns a new streak.
 */
export function streakAfter(s: Streak, day: string): Streak {
  const today = cleanDay(day);
  if (!today) return { ...s };
  if (!s.last || s.days <= 0) return { days: 1, last: today, grace: s.grace, best: Math.max(s.best, 1) };
  const gap = daysBetween(s.last, today);
  let days = s.days, grace = s.grace;
  if (!Number.isFinite(gap) || gap < 0) days = 1;
  else if (gap === 0) days = Math.max(1, s.days);
  else if (gap === 1) days = s.days + 1;
  else if (gap === 2 && graceFree(s, today)) {
    days = s.days + 1;
    grace = today;
  } else days = 1;
  return { days, last: today, grace, best: Math.max(s.best, days) };
}

/**
 * The streak as the lobby sees it on `day` before a session: alive (the days so far), alive only by grace (one day was
 * missed — a session today keeps it), or gone (0).
 */
export function streakNow(s: Streak, day: string): { days: number; grace: boolean } {
  if (!s.last || s.days <= 0) return { days: 0, grace: false };
  const today = cleanDay(day);
  const gap = daysBetween(s.last, today);
  if (!Number.isFinite(gap) || gap < 0) return { days: 0, grace: false };
  if (gap <= 1) return { days: s.days, grace: false };
  if (gap === 2 && graceFree(s, today)) return { days: s.days, grace: true };
  return { days: 0, grace: false };
}

/** The part of the day for the day's light (0 dawn … 1 night). */
export function partOf(day: number): 'morning' | 'noon' | 'afternoon' | 'evening' {
  return day < 0.28 ? 'morning' : day < 0.5 ? 'noon' : day < 0.74 ? 'afternoon' : 'evening';
}

/**
 * The day's light at `t` s of a plan: dawn in the intro, morning → evening over the moments (to `momentsLight`: the
 * evening at home), night over the garland.
 */
export function dayAt(p: Plan, t: number): number {
  const E = RULES.momentsLight;
  if (t < p.introEnd) return 0.02 + 0.03 * clamp(t / Math.max(1, p.introEnd));
  if (t < p.eveningStart) return 0.06 + (E - 0.06) * clamp((t - p.introEnd) / Math.max(1, p.eveningStart - p.introEnd));
  const k = clamp((t - p.eveningStart) / Math.max(1, p.garlandEnd - p.eveningStart));
  return E + (1 - E) * (0.5 - 0.5 * Math.cos(Math.PI * k));
}
