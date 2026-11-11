/**
 * Every number of Nehemiasz's rules in one place (sim.ts re-exports it): the world (a stretch of
 * Jerusalem's wall with the city inside and the hills outside), Nehemiah's walk and the build verb,
 * the wall's tiers, the city's buildings and jobs, the day's work (the rest block: calm sets the
 * builders' rhythm), the night's watch (the push block: the watch fires' reach, the towers, the
 * guards, the ram's horn), the raiders, the calendar (52 days through ten gates), the blocks and the
 * meta.  Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * The world is 18 × 12 u (about a metre and a half each), x to the right, y down: the hills and the
 * three roads at the top, the wall across at y = 4.6, the city below it.
 */
export const RULES = {
  // ── the world ────────────────────────────────────────────────
  worldW: 18,
  worldH: 10.4,
  /** the view shows the world from here down (the roads come from beyond the ridge above it) */
  viewTop: 0.9,
  /** the wall's centre line and its faces (u) */
  wallY: 4.6,
  wallOut: 4.3,
  wallIn: 4.9,
  /** Nehemiah walks the wall walk and the city: never above this line (u) */
  walkTop: 4.45,
  /** the foot of the wall: raiders this close to its outer face are seen by the guards anyway (u) */
  footBand: 0.85,

  // ── Nehemiah (touch: anything under 2 s) ────────────────────
  /** walking speed (u/s) at a full joystick, and when he goes somewhere by himself (a tap) */
  walk: 3.4,
  autoWalk: 3.6,
  /** the joystick: full speed this far from where the finger went down (px), nothing under the dead zone (px) */
  stickPx: 56,
  stickDead: 9,
  /** a tap: up within this long (s) and this close (px) to the press */
  tapSec: 0.32,
  tapPx: 14,
  /** a tap this close to a marker (u) means that marker */
  tapMarker: 0.55,
  /** standing this close to a marker (u) builds it; the build takes this long (s) while the stones fly */
  standR: 0.42,
  buildSec: 0.75,
  /** a finished build lays the first course at once (cubits), so the press answers at once */
  foundation: 2,

  // ── the wall ─────────────────────────────────────────────────
  /** cubits of wall in each tier of a section, of the gate (index = the tier being laid: higher courses take more) */
  segCubits: [0, 40, 60, 80],
  gateCubits: [0, 30, 45, 60],
  /** integrity per tier of height (hp) */
  hpTier: 16,
  gateHpTier: 24,
  /** a section lower than this is open (u of tier), a breach is hp ≤ 0 */
  openBelow: 0.5,
  /** a half wall (height under this) is climbed over by anyone in climbLow s; a ladder climbs a higher one in climbLadder s */
  lowBelow: 1.5,
  climbLow: 2.4,
  climbLadder: 3.2,
  /** a parapet (height from this) throws ladders off where guards stand near */
  parapetFrom: 2.5,

  // ── the day's work (rest: calm = the builders' rhythm) ───────
  /** the rhythm = 1 + calm × rhythmExtra past the rest lead-in, 1 otherwise (never below the base) */
  rhythmExtra: 1.2,
  restLead: { fnirs: 4, eeg: 2 },
  /** a builder lays this many cubits a second at rhythm 1 and full strength */
  lay: 0.32,
  /** a cubit of a builder's work mends this much hp */
  mendK: 2.2,
  /** strength's share in the work: × (sBase + (1 − sBase) × strength) */
  sBase: 0.55,
  /** a quarryman's stone, a baker's bread, an idle builder's rubble (per s at rhythm 1) */
  quarry: 0.28,
  bake: 0.24,
  rubble: 0.12,
  /** the well: a water carrier's strength per s; mortar: builders × (1 + mortar × the well's level) */
  water: 0.006,
  mortar: 0.1,
  /** at least this share of the people builds the wall (job slots fill only up to the rest) */
  minBuilders: 0.35,

  // ── the stores and the people ────────────────────────────────
  start: { stone: 12, timber: 6, bread: 16, people: 8, strength: 0.8 },
  /** store caps: stone (the yard's level adds), bread (the granary's level adds) */
  stoneCap: [40, 60, 90, 130],
  breadCap: [32, 60, 90, 130],
  /** the camp's tents hold this many; each house level this many more */
  tents: 10,
  housePer: 4,
  /** dawn: timber from the king's forest, stone from the rubble heaps */
  dawnTimber: 5,
  dawnStone: 2,
  /** builders with no tier to lay dress stones (cubits of work, at most this many), laid at once when a tier is ordered */
  dressedCap: 40,
  /** newcomers at dawn: base + day / perDay, only with room and bread for half of the people */
  newBase: 2,
  newPerDays: 8,
  /** dusk: each person eats a loaf; hunger lowers strength by this × the unfed share */
  hunger: 0.25,
  fed: 0.05,
  /** a night held without a breach, a looter escaping, Nehemiah's word at dawn after a hard night */
  heldBonus: 0.05,
  lootFear: 0.025,
  word: 0.08,
  strengthMin: 0.2,

  // ── the night's watch (push: focus = the watch fires' reach) ─
  /** the fires' light (u): base and extra by level (index = level); radius = base + level × extra in a sighted night past the lead-in */
  fireBase: [0, 1.1, 1.4, 1.7],
  fireExtra: [0, 3.2, 3.7, 4.2],
  /** how fast the drawn and acting light follows its target (s) */
  fireTau: 0.45,
  /** a slinger's stone dims a fire this much (share), and the dimming fades at this rate (per s) */
  dimHit: 0.3,
  dimFade: 0.12,
  /** Tirza's lamp (u) */
  lamp: 1.0,
  /** the lead-in before the band moves the fires (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** in strong light (a fire above the threshold) raiders hesitate: speed × this */
  hesitate: 0.78,

  /** towers: range (u) and the time between two stones per slinger (s) by level, the stone's courage blow */
  towerRange: [0, 3.0, 3.0, 3.4],
  towerFar: 1.4,
  towerEvery: [0, 1.25, 1.25, 1.1],
  towerQuick: 0.62,
  towerSlingers: [0, 2, 2, 3],
  stone: 1,
  farStone: 1.35,
  /** a pebble's flight (s) */
  flight: 0.32,
  /** guard posts: guards by level, reach from the post (u), a jab's blow and its time (s) */
  postGuards: [0, 2, 3, 4],
  guardReach: 2.1,
  jab: 1,
  jabShield: 1.4,
  jabEvery: 0.95,
  /** guards chase a raider inside the city this far from their post (u) */
  chase: 3.2,
  /** Nehemiah at night: raiders this close lose heart (courage per s); defenders this close strike faster (×) */
  nearR: 1.8,
  nearHeart: 1.1,
  cheerR: 2.6,
  cheer: 1.4,

  /** the ram's horn: a held focus this long (s) charges it this much a second; a raider driven off in the light adds this */
  holdNeed: { fnirs: 5, eeg: 3 },
  hornRate: 0.1,
  hornDriven: 0.03,
  /** blown by a tap or Space, by itself after this long ready (s) */
  hornAuto: 6,
  /** every raider this close to Nehemiah loses heart (u); the towers' volley (stones each); the rally (s, guards' speed ×) */
  hornR: 5,
  volley: 3,
  rallySec: 6,
  rallyK: 2,
  /** a night held (its judge passed) keeps this share of the horn for the next night */
  hornKeep: 0.3,

  // ── the raiders (men: struck, they lose heart and run; nobody dies) ──
  /** courage, speed (u/s), prying (hp/s) per kind */
  courage: { rabus: 3, procarz: 2, drabina: 5, taran: 9, kapitan: 14 },
  speed: { rabus: 0.92, procarz: 0.85, drabina: 0.72, taran: 0.52, kapitan: 0.7 },
  pry: { rabus: 1.2, procarz: 0, drabina: 0.7, taran: 5, kapitan: 0 },
  /** courage grows with the gate and the year: × (1 + perGate × gate + perYear × year) */
  perGate: 0.08,
  perYear: 0.3,
  /** slingers stop this far from the wall's outer face (u) and throw every this long (s) */
  slingAt: 2.0,
  slingEvery: 2.6,
  /** the captain stops here (y, u); raiders near him (u) take this share of the blows */
  captainStop: 3.0,
  captainR: 2.5,
  captainGuard: 0.6,
  /** fleeing speed (u/s); loot carried out (stone or bread); grabbing takes this long (s) */
  flee: 2.3,
  loot: 3,
  grab: 1.4,
  /** at most this share of a store is lost in a night */
  lootCap: 0.25,
  /** the night's raiders: (base + perDay × day of the gate + perGate2 × gate) × (1 + yearUp × year), × night length / 24 s */
  nightBase: 5,
  nightPerDay: 1.5,
  nightPerGate: 0.7,
  yearUp: 0.25,
  /** the waves come at these seconds of the night; the raiders of a wave this far apart (s) */
  waves: [1.2, 7.5, 13.5],
  waveGap: 0.55,
  /** the first night ever is gentle */
  firstNight: 3,

  // ── the calendar ─────────────────────────────────────────────
  /** days per gate (sum 52: Nehemiah 6:15) */
  gateDays: [5, 5, 5, 6, 5, 5, 5, 6, 5, 5],
  /** a decree card at the dawn of every this-th day */
  decreeEvery: 3,

  // ── the session ──────────────────────────────────────────────
  /** night (push) and day (rest): nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [24, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: Tirza waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (the next dawn) (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** nights counted across sessions: every blindEvery-th is moonless from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** a day judged calm pays a bonus at its end */
  dayBonus: 4,
  /** cards: the opening (s, a tap closes it after minCard), a chapter's card, a choice (the first is taken after choiceSec) */
  openSec: 9,
  storySec: 6,
  minCard: 0.6,
  choiceSec: 12,
  /** the raiders' preview shows this long before the night (s) */
  previewSec: 9,
  /** the villains come out on the hill at this share of a day */
  sneerAt: 0.35,
  /** the invitation to Ono: from this gate, at this second of a night, answered by a held focus this long (s) */
  onoFrom: 1,
  onoAt: 9,
  onoHold: 5,
  onoMax: 4,
  onoBonus: 0.25,
  /** closing verses: a long hold (s), many raiders driven off */
  longHold: 12,
  manyDriven: 12,

  // ── Tirza's lines ────────────────────────────────────────────
  /** a line stays 2–4 s (by its length), at least this long between two (s) */
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** the fires stay above the threshold this long (s) before she cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
