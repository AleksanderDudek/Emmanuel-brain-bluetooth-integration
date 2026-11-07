/**
 * Every number of Chleby i ryby in one place (sim.ts and hill.ts re-export it): the hillside lane,
 * the basket and its stream, the bread, the gates and the golden gate, the gulls and the Pelikan,
 * the groups of the hungry, the levels and chapters, the blocks and the meta game.  Tuning moves a
 * number here and nowhere else; the tests read the same object.
 *
 * World units ("u", about a metre) on the lane up the hill: x across it (0..laneW), y up the hill
 * from the boy's basket (0) to the row of the hungry (laneH).
 */
export const RULES = {
  // ── the lane ─────────────────────────────────────────────────
  laneW: 10,
  laneH: 20,
  /** bread keeps this far from the lane's edges (it bounces back) */
  edge: 0.35,

  // ── the basket and the stream ────────────────────────────────
  /** the basket slides toward the finger at this speed (u/s); arrows move it at keySpeed */
  aimSpeed: 26,
  keySpeed: 9,
  /** a held press pours this many pieces a second, + per stream level */
  stream: 5,
  streamPerLevel: 1,
  /** a press pours a volley at once (a tap = a short volley), this many pieces over volleySec */
  volley: 4,
  volleySec: 0.22,
  /** a press held longer than this starts the stream (s) */
  holdAfter: 0.25,
  /** every n-th piece is a fish: by fish level 0..3 */
  fishEvery: [6, 5, 4, 3],
  /** the bread's speed up the hill (u/s) and its sideways spread (u/s) */
  loafSpeed: 7.2,
  fishSpeed: 11,
  bigSpeed: 3.4,
  spread: 0.9,
  /** live pieces at most: past this a multiplying gate makes a piece heavier (it feeds more) instead */
  maxPieces: 260,

  // ── the gates ────────────────────────────────────────────────
  /** a gate's depth (u): a piece passes it when it crosses its line inside its width */
  gateDepth: 0.4,
  /** a grey gate swallows pieces until its count is used up, then breaks for this long (s) */
  greyBack: 5,
  /** the golden gate: ×1 below the threshold (never less), ×2 at it, ×5 at goldTop and above; in halves */
  goldAt: 2,
  goldMax: 5,
  goldTop: 0.9,
  /** the start gate (an upgrade): a ×2 gate near the basket, its width by level 1..4 */
  startY: 2.4,
  startW: [0, 1.5, 2.1, 2.7, 3.3],

  // ── the big basket (hold) ────────────────────────────────────
  /** a held focus this long (s) fills it, Mendi / HALO; a broken hold lets an unfilled charge sink at this share of the fill rate */
  bigHold: { fnirs: 6, eeg: 3 },
  bigSink: 0.5,
  /** it splits into this many loaves (+ per big-basket level) at the top or at a gate */
  bigLoaves: 20,
  bigPerLevel: 5,

  // ── the gulls ────────────────────────────────────────────────
  /** a gull every gap s (− per level, at least gullMin), a flock of three every 3rd from level 2; Mirka once a level from level 1 */
  gullFirst: 7,
  gullGap: 7,
  gullGapPerLevel: 0.25,
  gullMin: 3.6,
  gullSpeed: 3.3,
  gullR: 0.62,
  flockFrom: 2,
  mirkaFrom: 1,
  mirkaAt: 14,
  mirkaTakes: 5,
  /** the band the gulls cross (u up the hill) */
  gullY: [6, 15.5],

  // ── the Pelikan (each chapter's last level) ──────────────────
  pelikanY: 9.6,
  pelikanR: 1.45,
  pelikanPouch: 70,
  pelikanPerChapter: 25,
  pelikanSlide: 2.6,

  // ── the hungry ───────────────────────────────────────────────
  /** groups in a level: 4, + 0.8 a level, at most 12; a group is 50 or 100 (Mark 6:40) */
  groups: 4,
  groupsPerLevel: 0.8,
  groupsMax: 12,
  /** how likely a group is a hundred: + per level, at most */
  hundred: 0.15,
  hundredPerLevel: 0.08,
  hundredMax: 0.6,
  /** the front row holds this many groups at most; the next row steps in when it is fed */
  rowMax: 3,

  // ── a level ──────────────────────────────────────────────────
  /** its time: base + per person (s); when it runs out the disciples feed the rest (at half) */
  timeBase: 20,
  timePerPerson: 0.12,
  /** levels in a chapter (the last one is the Pelikan's); chapters before the hills come round again (harder) */
  chapter: 4,
  chapters: 6,
  /** the hunger grows by this share each time round */
  circleHunger: 0.3,
  /** three stars: fed by the player with this share of the time left, or this many baskets in the level */
  starTime: 0.35,
  starBaskets: 3,
  /** between levels: the celebration (s), the card of upgrades (s, auto-continue), the next level's card */
  wonHold: 2.6,
  upgradeSec: 4.5,
  /** the card of upgrades shows at most once in this long (s), so short levels flow on */
  upgradeGap: 40,
  /** the session ends: a level at least this much fed is finished by the disciples */
  finishShare: 0.5,

  // ── Na trawie (rest) ─────────────────────────────────────────
  /** calm 1 fills a basket of crumbs in this long (s); at most this many in a level; the brain's lead-in */
  basketSec: 5.5,
  basketsMax: 12,
  calmLead: { fnirs: 4, eeg: 2 },

  // ── the meta: grain for the upgrades ─────────────────────────
  grainPerStar: 8,
  grainPerBasket: 4,
  grainPelikan: 20,
  giftGrain: 30,
  /** upgrade prices by level (the next level's price is at the current level's index) */
  prices: {
    stream: [30, 60, 100, 150],
    start: [40, 75, 120, 180],
    fish: [30, 60, 100],
    big: [45, 80, 130, 190],
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
  /** a blind block pours this many loaves per second of its judged window spent above the threshold */
  blindLoaves: 2.6,
  /** the warm-up's hint shows after this long without a press (s) */
  idleHint: 3,
} as const;

export type Upgrade = keyof typeof RULES.prices;
export const UPGRADES: readonly Upgrade[] = ['stream', 'start', 'fish', 'big'];

/** The golden gate's multiplier for a level: ×1 below the threshold (never less), ×2 at it, up to ×5; in halves. */
export function goldMult(level: number): number {
  if (!(level >= 0.5)) return 1;
  const k = Math.min(1, (level - 0.5) / (RULES.goldTop - 0.5));
  return Math.round((RULES.goldAt + (RULES.goldMax - RULES.goldAt) * k) * 2) / 2;
}
