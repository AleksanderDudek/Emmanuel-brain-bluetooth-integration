/**
 * Every number of Chleby i ryby (v2, after Mob Control) in one place: the terrace up the hill, the
 * basket-cannon and its stream of bread-bearers, the gates, the golden gate, the Big Basket (the
 * champion), the gull waves, Gerwazy and the Pelikan, the tables of the hungry, the levels and
 * chapters, the blocks and the meta game.  Tuning moves a number here and nowhere else; the tests
 * read the same object.
 *
 * World units ("u", about a metre) on one terrace of the hillside: x across it (0..laneW), y up the
 * hill from the boy's basket (0) to the tables of the hungry (laneH).
 */
export const RULES = {
  // ── the terrace ──────────────────────────────────────────────
  laneW: 10,
  laneH: 20,
  /** runners keep this far from the lane's edges */
  edge: 0.4,

  // ── the basket-cannon ────────────────────────────────────────
  /** the basket slides toward the finger at this speed (u/s); the arrows move it at keySpeed */
  aimSpeed: 30,
  keySpeed: 10,
  /** a held press pours this many runners a second, + per Strumień level */
  stream: 5,
  streamPerLevel: 1.2,
  /** a press fires a burst at once (a tap = a burst of `burst` runners over burstSec) */
  burst: 3,
  burstSec: 0.2,
  /** bursts no closer than this (s) */
  burstGap: 0.5,
  /** a press held longer than this starts the stream (s) */
  holdAfter: 0.22,
  /** a gull that reaches the basket pecks it: the stream jams this long (s) */
  jamSec: 0.7,

  // ── the runners (bread-bearers: a loaf on little legs) ───────
  /** speed up the hill (u/s): a loaf, a fish (Ryby upgrade), the Big Basket */
  loafSpeed: 4.6,
  fishSpeed: 6.4,
  bigSpeed: 2.3,
  /** sideways wander (u/s) and the pull toward the nearest hungry table in the top rows */
  wander: 0.7,
  pullFrom: 13,
  pull: 2.6,
  /** collision radii (u) */
  runnerR: 0.26,
  bigR: 0.85,
  /** live runners at most: past this a multiplying gate makes runners heavier instead (a stack of loaves) */
  maxRunners: 240,
  /** every n-th runner is a fish (worth fishW) by Ryby level 0..3 (0: none) */
  fishEvery: [0, 7, 5, 3],
  fishW: 2,

  // ── the gates ────────────────────────────────────────────────
  /** half width of a gate (u) by kind, and how fast gates slide (rad/s base, + per level) */
  gateHalf: 1.35,
  goldHalf: 1.6,
  slideBase: 0.55,
  slidePerLevel: 0.04,
  slideMax: 1.25,
  /** a green +N gate pops N runners when touched, then recharges this long (s) */
  addBack: 1.1,
  /** a grey −N gate swallows N runners, then breaks for this long (s) */
  greyBack: 4.5,
  /** the golden gate: ×1 below the threshold (never less), ×2 at it, ×5 at goldTop and above; in halves */
  goldAt: 2,
  goldMax: 5,
  goldTop: 0.9,
  /** the start gate (Bramka startowa): a ×2 gate just above the basket, its half width by level 1..3 */
  startY: 2.2,
  startHalf: [0, 0.9, 1.3, 1.8],
  /** the Big Basket spills this many runners per point of a gate's multiplier above 1 */
  bigSpill: 5,

  // ── the Big Basket (the champion) ─────────────────────────────
  /** a held focus this long (s) in a sighted Rozdawanie fills it, Mendi / HALO */
  bigHold: { fnirs: 6, eeg: 3 },
  /** pouring alone fills it too, slowly: this share per runner fired (+ per Wielki kosz level) */
  bigPerShot: 1 / 500,
  bigPerShotLevel: 1 / 2000,
  /** its weight (people it feeds): base + per Wielki kosz level */
  bigW: 30,
  bigWPerLevel: 10,

  // ── the gulls (the opposing waves) ───────────────────────────
  /** the first wave after this long on a terrace (s), then every gap s (− per level, at least waveMin) */
  waveFirst: 6,
  waveFirstEver: 13,
  waveGap: 7,
  waveGapPerLevel: 0.25,
  waveMin: 4,
  /** a wave's size: base + per level, at most */
  waveN: 5,
  wavePerLevel: 1.6,
  waveMax: 36,
  /** waddle speed down the hill (u/s), and their radius */
  gullSpeed: 1.5,
  gullR: 0.36,
  /** Gerwazy, the fat gull: worth this many, from this level, every n-th wave */
  fatW: 6,
  fatFrom: 3,
  fatEvery: 3,
  fatR: 0.6,
  /** Mirka leads a wave now and then (worth mirkaW), from this level, every n-th wave */
  mirkaW: 4,
  mirkaFrom: 1,
  mirkaEvery: 4,
  /** after a rest block the next wave waits this long (s) */
  waveAfterRest: 4,

  // ── the Pelikan (each chapter's last level, on its last terrace) ─
  pelikanY: 16,
  pelikanStop: 6.5,
  pelikanSpeed: 0.32,
  pelikanR: 1.35,
  pelikanPouch: 40,
  pelikanPerChapter: 12,
  pelikanSway: 0.45,

  // ── the tables of the hungry (the "base") ────────────────────
  /** a terrace's hunger: base + per level, × (1 + circle growth) for each time round the path */
  hunger: 110,
  hungerPerLevel: 28,
  hungerMax: 900,
  circleHunger: 0.3,
  /** a boss terrace is this much hungrier */
  bossHunger: 1.15,
  /** two tables (left and right) on a terrace from this level, on every other terrace */
  twoFrom: 2,
  /** grace: after this long on a terrace the disciples help (hunger falls by helpRate/s, growing) */
  helpAfter: 40,
  helpRate: 1.2,
  helpGrow: 0.15,

  // ── a level ──────────────────────────────────────────────────
  /** terraces in a level: 1, 2 from level twoTerraces, 3 from level threeTerraces */
  twoTerraces: 2,
  threeTerraces: 8,
  /** levels in a chapter (the last one is the Pelikan's); the path has six chapters, then comes round harder */
  chapter: 4,
  chapters: 6,
  /** the climb between terraces (s), the celebration after a level (s), the card of upgrades (auto-continue s) */
  climb: 1.6,
  wonHold: 2.6,
  cardSec: 6,
  /** the card of upgrades shows at most once in this long (s), so short levels flow on */
  cardGap: 40,
  /** three stars: a level done within par (s) = 3, within starSlow × par = 2, else 1; par = Σ (parBase + hunger / parRate) */
  parBase: 6,
  parRate: 22,
  starSlow: 1.6,
  /** the session ends: a terrace fed at least this share counts as done by the disciples */
  finishShare: 0.5,

  // ── Na trawie (rest) and the crumbs bank ─────────────────────
  /** calm 1 fills a basket of crumbs in this long (s); the brain's lead-in in a rest (s) */
  basketSec: 8,
  calmLead: { fnirs: 4, eeg: 2 },
  /** a snatched or swallowed loaf leaves this much of a basket in crumbs */
  crumbPerLoaf: 0.012,
  /** baskets for a finished level (one more for three stars); for a sated Pelikan */
  basketsLevel: 1,
  basketsThree: 1,
  basketsPelikan: 2,
  /** the day's gift (baskets) */
  giftBaskets: 3,
  /** upgrade prices in baskets by level (the next level's price is at the current level's index) */
  prices: {
    rate: [4, 7, 11, 16],
    fish: [4, 8, 13],
    big: [5, 9, 14, 20],
    start: [5, 9, 14],
  },

  // ── the session ──────────────────────────────────────────────
  /** Rozdawanie and Na trawie: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [23, 3],
  minBlock: 12,
  telegraph: 4,
  finale: 6,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** the lead-in before the band moves the golden gate (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** Rozdawanie blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** a blind block pours this many runners per second of its judged window spent above the threshold */
  blindRunners: 2.4,
  /** a coach mark is repeated at most this often (s) until its control is done, at most hintTimes times */
  hintEvery: 9,
  hintTimes: 3,
} as const;

export type Upgrade = keyof typeof RULES.prices;
export const UPGRADES: readonly Upgrade[] = ['rate', 'fish', 'big', 'start'];

/** The golden gate's multiplier for a level: ×1 below the threshold (never less), ×2 at it, up to ×5; in halves. */
export function goldMult(level: number): number {
  if (!(level >= 0.5)) return 1;
  const k = Math.min(1, (level - 0.5) / (RULES.goldTop - 0.5));
  return Math.round((RULES.goldAt + (RULES.goldMax - RULES.goldAt) * k) * 2) / 2;
}
