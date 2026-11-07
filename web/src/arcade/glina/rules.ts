/**
 * Every number of Glina's rules in one place (DESIGN.md §6, Glina v2): the clay on the wheel and its
 * shaping, the match against the order, the master's hand, the glazing, the kiln's needle, the
 * prices and tips, the band's steadiness and even heat, the blocks and the companion.  Tuning moves
 * a number here and nowhere else; the tests read the same object.
 */
export const RULES = {
  // ── the clay on the wheel ───────────────────────────────────────
  /** the lump: its height (× the order's height) and its radius (× the order's mean radius) */
  lumpH: 0.55,
  lumpR: 1.12,
  /** the height may go from / to (× the order's height) */
  hMin: 0.35,
  hMax: 1.5,
  /** the thinnest wall's radius (cm) and the widest (× the order's widest radius) */
  rMin: 0.9,
  rMax: 1.6,
  /** the finger's brush (a Gaussian over the height, σ in u) */
  brush: 0.11,
  /** how fast the wall follows the finger (1/s) at steadiness 0 and 1 */
  follow: [5, 11],
  /** how fast the height follows the finger at the rim (1/s) */
  followH: 9,
  /** the rim zone: a touch this close (px) to the rim or above it moves the height */
  rimPx: 26,
  /** the wobble's roughness in a stroke (cm at full wobble) and its smoothing per second at full steadiness */
  rough: 0.55,
  trueRate: 1.4,
  /** the foot and the rim keep some body: the foot ≥ this share of the widest ring */
  foot: 0.35,
  /** a lump settles after this many seconds before shaping helps (the slap onto the wheel) */
  lumpSec: 0.5,

  // ── the match ───────────────────────────────────────────────────
  /** match = 1 − ringW·mean ring error − heightW·height error (errors relative) */
  ringW: 1.5,
  heightW: 1.1,
  /** shape stars: ★★ and ★★★ from these matches */
  shapeStars: [0.72, 0.88],
  /** the master's hand (Space, "Gotowe" with a poor shape): it shapes toward the order to this share */
  assist: 0.72,
  /** …plus this much more at full steadiness */
  assistSteady: 0.18,
  assistSec: 1.0,
  /** a piece is done this long after "Gotowe" (the wire cuts it off the wheel) */
  cutSec: 0.55,

  // ── the master's hand (push: held focus) ───────────────────────
  /** focused seconds to fill it, Mendi / HALO */
  chargeSec: { fnirs: 11, eeg: 7 },
  /** a passed push block adds this much charge */
  passCharge: 0.35,
  /** the master's spin: how long it trues the piece (s) */
  spinSec: 1.6,
  /** its tip factor */
  spinTip: 1.5,

  // ── steadiness (push) ──────────────────────────────────────────
  /** the lead-in before the band moves the level (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** how fast steadiness follows the level (s) */
  steadyTau: 1.1,
  /** steadiness without the band's say (warm-up, rest, no signal): the threshold */
  neutral: 0.5,
  /** the wheel upgrades lower the base wobble: steadiness + this per level */
  wheelStep: 0.05,
  /** the guide line shows from this steadiness, the magnet snaps strokes from this one */
  guideAt: 0.5,
  magnetAt: 0.7,
  /** a stroke within this share of the target radius snaps to it under the magnet */
  magnet: 0.12,

  // ── glazing ────────────────────────────────────────────────────
  /** bands per piece at most, and the smallest gap between two (u) */
  bandsMax: 4,
  bandGap: 0.1,
  /** a band paints in over this long while the pot turns (s) */
  bandSec: 0.45,
  /** decoration score: the body's colour right, a requested band's colour, its pattern */
  decoBody: 0.6,
  decoBodyWrong: 0.2,
  decoBandColor: 0.25,
  decoBandPattern: 0.15,

  // ── the kiln ───────────────────────────────────────────────────
  /** the needle sweeps 0..1 and back; its speed (/s) at even heat 0 and 1 */
  needle: [1.15, 0.55],
  /** an uneven fire makes the needle surge: amplitude of its speed's wobble at heat 0 */
  surge: 0.45,
  /** the green zone: its centre and width at even heat 0 and 1 (+ per kiln level) */
  zoneC: 0.62,
  zoneW: [0.14, 0.32],
  kilnZone: 0.025,
  /** the gold heart of the zone: this share of its width */
  gold: 0.34,
  /** how fast even heat follows calm (s), and its lead-in in rest (s) */
  heatTau: 1.4,
  restLead: { fnirs: 4, eeg: 2 },
  /** the kiln comes to heat at this share of a rest block, but no sooner / later than (s, s before the end) */
  heatAt: 0.58,
  heatMin: 7,
  heatEnd: 8,
  /** the firing window closes this long before the rest ends; then the kiln opens */
  fireEnd: 3.4,
  /** in a free stretch the kiln heats this long (s) */
  freeHeat: 1.2,
  /** firing quality: perfect, good, soft/hot */
  fireQ: { perfect: 1, good: 0.75, off: 0.4 },
  fireMult: { perfect: 1.25, good: 1, off: 0.85 },
  /** the kiln opens: each piece's sale takes this long (s) */
  saleSec: 1.15,
  openSec: 0.9,

  // ── prices ─────────────────────────────────────────────────────
  /** a piece's quality: shape, decoration, firing */
  qShape: 0.6,
  qDeco: 0.25,
  qFire: 0.15,
  /** overall stars from the quality */
  stars: [0.68, 0.86],
  /** price = base × (pFloor + quality) × fire; tips by stars */
  pFloor: 0.5,
  tips: [0, 0.1, 0.3],
  /** a regular adds this tip (sykli) */
  regularTip: 3,
  /** a market piece sells for this share, no tip */
  market: 0.5,
  /** the streak of ★★★ sales: ×(1 + step·(n − 1)) up to max */
  streakStep: 0.1,
  streakMax: 1.5,
  /** a passed push: the batch's pieces sell for this much more */
  passPush: 0.15,
  /** a passed rest: the kiln's gift adds this per piece fired (sykli) */
  giftCoins: 6,
  /** a blind push's reveal: bonus sykli per percent above the need */
  blindCoins: 0.4,

  // ── the session ────────────────────────────────────────────────
  push: [25, 4],
  rest: [25, 3],
  minBlock: 14,
  telegraph: 4,
  bannerSec: 4.5,
  /** the first-ever session's warm-up (s): long, short, a 40 s test */
  warm: { long: 45, short: 32, test: 12 },
  blindEvery: 4,
  blindFrom: 3,
  minReliable: 8,
  /** the kiln shelf holds this many pieces at kiln level 0 (+1 per level) */
  shelf: 3,
  /** a new customer walks in this long (s) */
  walkSec: 0.7,
  /** the opening story card (first session), at most (s) */
  openCard: 8,
  /** a card between blocks (s) */
  cardSec: 2.6,

  // ── the cat's lines ───────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 3,
  /** steadiness above the threshold this long (s) before he notices */
  goodSec: 4,
} as const;

export type Band = keyof typeof RULES.leadIn;

/** Shape stars (1..3) for a match 0..1. */
export function shapeStars(m: number): 1 | 2 | 3 {
  return m >= RULES.shapeStars[1] - 1e-9 ? 3 : m >= RULES.shapeStars[0] - 1e-9 ? 2 : 1;
}

/** Overall stars (1..3) for a quality 0..1. */
export function starsOf(q: number): 1 | 2 | 3 {
  return q >= RULES.stars[1] - 1e-9 ? 3 : q >= RULES.stars[0] - 1e-9 ? 2 : 1;
}

export type FireGrade = 'perfect' | 'good' | 'soft' | 'hot';

/** The kiln's green zone [lo, hi] and its gold heart for an even heat 0..1 and a kiln level. */
export function zoneOf(heat: number, kiln = 0): { lo: number; hi: number; glo: number; ghi: number } {
  const R = RULES;
  const h = Math.min(1, Math.max(0, heat));
  const w = R.zoneW[0] + (R.zoneW[1] - R.zoneW[0]) * h + R.kilnZone * kiln;
  const g = w * R.gold;
  return { lo: R.zoneC - w / 2, hi: R.zoneC + w / 2, glo: R.zoneC - g / 2, ghi: R.zoneC + g / 2 };
}

/** Where the needle stopped, graded. */
export function gradeAt(x: number, heat: number, kiln = 0): FireGrade {
  const z = zoneOf(heat, kiln);
  if (x >= z.glo && x <= z.ghi) return 'perfect';
  if (x >= z.lo && x <= z.hi) return 'good';
  return x < z.lo ? 'soft' : 'hot';
}

/** The needle's speed (/s) for an even heat 0..1. */
export const needleSpeed = (heat: number): number => RULES.needle[0] + (RULES.needle[1] - RULES.needle[0]) * Math.min(1, Math.max(0, heat));
