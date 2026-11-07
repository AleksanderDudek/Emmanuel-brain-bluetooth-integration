/**
 * Every number of Źródła's rules in one place: the valleys (grid sizes, rocks, the distance goal,
 * the countdown and the water's pace rising valley by valley, after Pipe Mania), the dispenser, the
 * scoring (a cell, a loop, a pool, an old aqueduct, the cells past the goal, fast flow), the band's
 * sluice (push: the water's pressure drops and it flows slower; a held focus fills the "Cisza wód",
 * a few seconds of still water), the gardens of the rest blocks, the blocks and the companion.
 * Tuning moves a number here and nowhere else; the tests read the same object.
 */
export const RULES = {
  // ── the valley ───────────────────────────────────────────────
  /** the grid at the first valley and at most (columns × rows) */
  gridStart: [7, 5] as readonly [number, number],
  gridMax: [8, 7] as readonly [number, number],
  /** rocks: at the first valley, more per valley, at most */
  rockStart: 0,
  rockStep: 0.45,
  rockMax: 7,
  /** the distance goal (cells): the first valley, more per valley, at most; garden valleys ask less */
  goalStart: 6,
  goalStep: 0.8,
  goalMax: 30,
  gardenGoal: 0.75,
  /** a station of the road holds this many valleys; the last of each ends in a garden */
  perStation: 4,
  stations: 15,
  /** the countdown before the water starts (s): the first valley, less per valley, at least */
  countStart: 11,
  countStep: 0.35,
  countMin: 8,
  /** seconds the water needs for one cell at base pressure: the first valley, less per valley, at least */
  cellStart: 2.3,
  cellStep: 0.045,
  cellMin: 1.25,
  /** the spring's own half cell, as a share of a cell's time */
  springPart: 0.5,
  /** a pool fills this many times slower than a pipe */
  poolSlow: 3,
  /** old aqueduct stones (fixed, +bonus) from this valley; one-way stones from this one */
  aqueductFrom: 3,
  onewayFrom: 9,
  /** pools in the dispenser from this valley */
  poolFrom: 2,

  // ── the dispenser ────────────────────────────────────────────
  queueLen: 5,
  /** weights: straights, bends, the cross, the pool */
  wStraight: 1.15,
  wBend: 1,
  wCross: 0.75,
  wPool: 0.4,
  /** the gentle dealer (first valleys, rest blocks, the warm-up): this share of pieces fit the path's open end */
  helpShare: 0.5,
  helpUntil: 3,
  /** replacing a dry piece ("the frog shovels it out") blocks the hands this long (s); an input meanwhile waits */
  bombSec: 0.35,

  // ── scoring (jars) ───────────────────────────────────────────
  perCell: 10,
  /** water through a cross the second time */
  loopBonus: 50,
  /** five loops in one valley */
  fiveLoops: 500,
  poolBonus: 100,
  aqueductBonus: 50,
  /** each cell past the goal at the valley's end */
  extraCell: 20,
  /** each star of a won valley */
  starBonus: 50,
  /** fast flow: the water runs this many times quicker and every cell counts ×2 */
  fastSpeed: 7,
  fastMult: 2,
  /** stars: the goal, the goal + 4, the goal + 8 */
  starStep: 4,

  // ── the sluice (push blocks): the band slows the water ─────────
  /** the lead-in before the band moves the sluice (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** how fast the sluice follows the level (s) */
  sluiceTau: 1.1,
  /** at a full sluice the water runs this much slower (0.55 → 45 % of its pace) */
  slowMax: 0.55,
  /** the charge of the "Cisza wód" per second above the threshold: at the threshold and at a full sluice */
  chargeLo: 0.045,
  chargeHi: 0.1,
  /** a passed push adds this much charge */
  passCharge: 0.35,
  /** the still water lasts this long (s) */
  stillSec: 5,

  // ── the gardens (rest blocks) ──────────────────────────────────
  restLead: { fnirs: 4, eeg: 2 },
  /** growth per second at calm 1, shared by the greening front (the first few wet cells not yet in bloom) */
  growRate: 0.42,
  growFront: 3,
  bloomBonus: 30,
  /** a passed rest: every wet cell's garden grows this much at once */
  passGrow: 0.35,
  /** in a rest block the water runs at this share of its pace (the Sela is gentle) */
  restPace: 0.85,

  // ── the session ─────────────────────────────────────────────
  push: [24, 4] as readonly [number, number],
  rest: [22, 3] as readonly [number, number],
  minBlock: 12,
  telegraph: 4,
  bannerSec: 5,
  warm: { long: 30, short: 20, test: 6 },
  blindEvery: 4,
  blindFrom: 3,
  minReliable: 8,

  // ── feel ────────────────────────────────────────────────────
  /** the valley's tally card (s); the spill card (s); the station card (s); the opening card (s) */
  tallySec: 3.2,
  spillSec: 2.6,
  stationSec: 4.2,
  openSec: 9,
  /** a card can be tapped away after this long (s) */
  cardMin: 0.7,
  /** the water's front this close (in cells) to the path's open end: "near" */
  nearCells: 1.2,
  /** without input this long (s) in the first session, the coach points at Space */
  idleHint: 6,

  // ── Kumka's lines ───────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 3,
  /** the sluice above the threshold this long (s) before she cheers it */
  goodSec: 4,
} as const;

export type Band = keyof typeof RULES.leadIn;

const lerpTo = (start: number, step: number, lim: number, v: number, up: boolean): number =>
  up ? Math.min(lim, start + step * v) : Math.max(lim, start - step * v);

/** The station (0-based) of valley `v`, and the valley's place within it. */
export const stationOf = (v: number): number => Math.floor(v / RULES.perStation);
export const placeOf = (v: number): number => v % RULES.perStation;
/** The last valley of each station ends in a garden. */
export const isGarden = (v: number): boolean => placeOf(v) === RULES.perStation - 1;

/** The distance goal of valley `v` (cells the water must run through). */
export function goalOf(v: number): number {
  const g = Math.round(lerpTo(RULES.goalStart, RULES.goalStep, RULES.goalMax, v, true));
  // a roller-coaster: the station's first valley is a breather, the garden asks for less
  const breather = placeOf(v) === 0 && v > 0 ? -2 : 0;
  return Math.max(RULES.goalStart, isGarden(v) ? Math.round(g * RULES.gardenGoal) : g + breather);
}

export const countdownOf = (v: number): number => lerpTo(RULES.countStart, RULES.countStep, RULES.countMin, v, false);
export const cellSecOf = (v: number): number => lerpTo(RULES.cellStart, RULES.cellStep, RULES.cellMin, v, false);
export const rocksOf = (v: number): number => Math.floor(lerpTo(RULES.rockStart, RULES.rockStep, RULES.rockMax, v, true));

/** The grid of valley `v`: it grows a column, then a row, every two valleys, up to the maximum. */
export function gridOf(v: number): [number, number] {
  const [c0, r0] = RULES.gridStart, [cm, rm] = RULES.gridMax;
  let c = c0, r = r0;
  for (let k = 0; k < Math.floor(v / 2); k++) {
    if (k % 2 === 0 && c < cm) c++;
    else if (r < rm) r++;
    else if (c < cm) c++;
  }
  return [c, r];
}

/** Stars for a valley won with `cells` (0 when the goal was missed). */
export function starsFor(cells: number, goal: number): number {
  if (cells < goal) return 0;
  return cells >= goal + 2 * RULES.starStep ? 3 : cells >= goal + RULES.starStep ? 2 : 1;
}

/** The water's pace factor for a sluice value 0..1 (1 at and below the threshold, down to 1 − slowMax). */
export const paceOf = (sluice: number): number => 1 - RULES.slowMax * Math.max(0, Math.min(1, (sluice - 0.5) / 0.5));
