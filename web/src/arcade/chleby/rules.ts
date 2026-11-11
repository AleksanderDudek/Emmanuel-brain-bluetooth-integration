/**
 * Every number of Chleby i ryby (v3, after Mob Control) in one place: the terrace up the hill, the
 * basket-cannon and its stream of bread-bearers, the gates and the lane's elements (pebble arrows,
 * the brook, boulders, the jar), the golden gate, the champions, the helps, the gull waves, the four
 * bosses and their arenas, the tables of the hungry, the levels and chapters, the blocks, the
 * collection of cards, the village, the league of stars, the missions and the day.  Tuning moves a
 * number here and nowhere else; the tests read the same object.
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
  /** a held press pours this many runners a second, + per Piekarnia level (the village's bakery) */
  stream: 5,
  streamPerLevel: 1.2,
  /** a press fires a burst at once (a tap = a burst of shots over burstSec) */
  burst: 3,
  burstSec: 0.2,
  /** bursts no closer than this (s) */
  burstGap: 0.5,
  /** a press held longer than this starts the stream (s) */
  holdAfter: 0.22,
  /** a gull that reaches the basket pecks it: the stream jams this long (s) */
  jamSec: 0.7,

  // ── the runners (bread-bearers: a loaf on little legs) ───────
  /** the base speed of a loaf (u/s); a fish (the harbour's) runs at fishSpeed */
  loafSpeed: 4.6,
  fishSpeed: 6.4,
  /** sideways wander (u/s) and the pull toward the nearest hungry table in the top rows */
  wander: 0.7,
  pullFrom: 13,
  pull: 2.6,
  /** collision radii (u) */
  runnerR: 0.26,
  bigR: 0.85,
  /** live runners at most: past this a multiplying gate makes runners heavier instead (a stack of loaves) */
  maxRunners: 240,
  /** every n-th runner is a fish (worth one more than its bread) by Przystań level 0..3 (0: none) */
  fishEvery: [0, 7, 5, 3],

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
  /** the start gate (the village's Brama): a ×2 gate just above the basket, its half width by level 1..3 */
  startY: 2.2,
  startHalf: [0, 0.9, 1.3, 1.8],
  /** the Dzban (a jar gate): drinks this many loaves (+ per level / 2), then opens as ×jarMult for jarOpen s */
  jarNeed: 8,
  jarMult: 3,
  jarOpen: 8,
  jarHalf: 1.2,
  /** honey ×4 gates appear from this level */
  fourFrom: 10,

  // ── the lane's elements (v3) ─────────────────────────────────
  /** pebble arrows laid by the disciples: runners on them sprint straight up at ×sprint */
  sprint: 1.8,
  sprintFrom: 2,
  /** the Dzban from this level, boulders from rocksFrom, the brook from brookFrom */
  jarFrom: 5,
  rocksFrom: 7,
  brookFrom: 9,
  /** the brook pushes runners sideways (u/s) unless they are on a stepping stone or flat */
  brookSpeed: 1.35,

  // ── the champions (one is chosen in the loadout; the ring launches it) ─
  /** a held focus this long (s) in a sighted Rozdawanie fills the ring, Mendi / HALO */
  bigHold: { fnirs: 6, eeg: 3 },
  /** pouring alone fills it too, slowly: this share per runner fired (+ per Wikliniarnia level) */
  bigPerShot: 1 / 500,
  bigPerShotLevel: 1 / 2000,
  /** the Wikliniarnia (basket-weaver's) adds this share of every champion's worth per level */
  champPerLevel: 0.15,
  /** each champion: speed (u/s), worth (people it feeds) and its special number (by evolution 0..3) */
  champ: {
    /** Wielki kosz: spills `spill` loaves per point of a gate's multiplier above 1 */
    kosz: { speed: 2.3, worth: 30, spill: [5, 6, 7, 8] },
    /** Osiołek: gulls within `reach` u eat crumbs from his panniers and fly `carry` loaves up to the tables */
    osiol: { speed: 2.6, worth: 16, reach: [1.6, 1.9, 2.2, 2.6], carry: [1, 1, 2, 2] },
    /** Wóz: the fastest; shoos the gulls in `reach`, spills `spill` per point; pushes a boss back for `stun` s */
    woz: { speed: 6.5, worth: 22, reach: [1.3, 1.45, 1.6, 1.8], spill: [3, 3, 4, 5], stun: 2.5 },
    /** Wielki bochen: a tap (or `fuse` s, or the tables) bursts it into `burst` loaves; each gate adds perGate per point */
    olbrzym: { speed: 3.2, worth: 8, fuse: 5, burst: [28, 34, 40, 48], perGate: 6, shoo: 3 },
    /** Wielbłąd: slow, gulls bounce off him; a gate adds `perGate` worth per point of its multiplier */
    wielblad: { speed: 1.7, worth: 70, perGate: [6, 7, 8, 10], bonusEvo: 15 },
  },

  // ── the helps (the Pomoc card: charged by people fed, readied by a passed rest) ─
  /** people fed that fill the help once (× (1 − studniaPerLevel × Studnia level)) */
  helpNeed: 90,
  studniaPerLevel: 0.18,
  help: {
    /** Mewy Mirki: `gulls` gulls fly in from the lake, each with `each` loaves for the hungriest table */
    mewy: { gulls: [5, 6, 7, 8], each: 4 },
    /** Sieć rybaków: every gull on the lane flies off; the boss stops for `stun` s */
    siec: { stun: [4, 5, 6, 7] },
    /** Wiatr od jeziora: `sec` s of runners at ×speed and walking gulls blown back up the hill */
    wiatr: { sec: [6, 7, 8, 9], speed: 1.6, push: 1.2 },
    /** Bramka uczniów: a ×mult gate by the basket, `half` wide, for `sec` s */
    bramka: { mult: [3, 3, 4, 4], half: [1.9, 2.1, 2.3, 2.5], sec: [9, 10.5, 12, 14], y: 2.9 },
  },
  /** carriers (gulls with a loaf, flying to a table) fly at this speed (u/s) */
  carrierSpeed: 7,

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

  // ── the bosses (each chapter's last level ends in a boss arena) ─
  /** the pouch: base + per chapter (circles count as six chapters more), × the boss's own share */
  pelikanPouch: 40,
  pelikanPerChapter: 12,
  pouchShare: { pelikan: 1, koziol: 0.9, czapla: 0.8, kormorany: 1 },
  /** Pelikan: walks down from bossY to pelikanStop, swaying */
  bossY: 16,
  pelikanStop: 6.5,
  pelikanSpeed: 0.32,
  pelikanR: 1.35,
  pelikanSway: 0.45,
  /** Kozioł Zenek: stands at koziolY in one of three columns, aims for aim s, charges down to koziolLow */
  koziolY: 16.4,
  koziolLow: 8.6,
  koziolR: 1.05,
  koziolAim: 1.2,
  koziolCharge: 8,
  koziolBack: 3,
  koziolStand: [2.6, 3.8],
  /** a butted runner rolls back this far down the hill (never lost) */
  butt: 3.5,
  columns: [2.2, 5, 7.8],
  /** Czapla Klara: stands in the brook at one of the columns; stabs a runner in reach every stabGap s */
  czaplaReach: 1.3,
  czaplaStab: 0.24,
  czaplaStand: 3.6,
  czaplaRipple: 1,
  /** Kormorany: two birds; a shadow darkens for aim s, the dive grabs within diveR, then they dry for dry s */
  kormoranAim: 1.4,
  kormoranDry: 1.6,
  kormoranAir: [1.6, 2.8],
  diveR: 1.45,
  /** distracted by the net or the cart: a boss stops acting for that long; a dozing boss still munches */

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
  /** grace: after this long on a terrace the disciples help (hunger and a boss's pouch fall by helpRate/s, growing) */
  helpAfter: 40,
  helpRate: 1.2,
  helpGrow: 0.15,
  /** Posiłki: at each terrace's start this many loaves pour out by themselves (+ per Spichlerz level) */
  reinforce: 6,
  reinforcePerLevel: 3,

  // ── a level ──────────────────────────────────────────────────
  /** terraces in a level: 1, 2 from level twoTerraces, 3 from level threeTerraces */
  twoTerraces: 2,
  threeTerraces: 8,
  /** levels in a chapter (the last one ends in a boss arena); six chapters, then round again harder */
  chapter: 4,
  chapters: 6,
  /** the climb between terraces (s), the celebration after a level (s), the village card (auto-continue s) */
  climb: 1.6,
  wonHold: 2.2,
  cardSec: 6,
  /** the village card shows at most once in this long (s), so short levels flow on */
  cardGap: 60,
  /** the reveal of the bundles earned since the last break: seconds per card, at most revealMax cards shown, at most packMax s */
  packCard: 0.45,
  revealMax: 8,
  packMax: 4.5,
  /** three stars: a level done within par (s) = 3, within starSlow × par = 2, else 1; par = Σ (parBase + hunger / parRate) */
  parBase: 6,
  parRate: 22,
  starSlow: 1.6,
  /** the session ends: a terrace fed at least this share counts as done by the disciples */
  finishShare: 0.5,

  // ── Na trawie (rest) and the crumbs bank ─────────────────────
  /** calm 1 fills a basket of crumbs in this long (s); the brain's lead-in in a rest (s) */
  basketSec: 12,
  calmLead: { fnirs: 4, eeg: 2 },
  /** a snatched or swallowed loaf leaves this much of a basket in crumbs */
  crumbPerLoaf: 0.012,
  /** baskets for a finished level (one more for three stars); for a sated boss */
  basketsLevel: 1,
  basketsThree: 1,
  basketsBoss: 2,
  /** the day's gift (baskets, + per Spichlerz level) */
  giftBaskets: 3,

  // ── the collection (cards.ts holds the cards) ────────────────
  /** copies a card needs for levels 1..9 (× the rarity's factor), evolutions at these levels */
  copies: [1, 3, 7, 13, 21, 31, 44, 60, 80],
  rarityCopies: { common: 1, rare: 0.75, epic: 0.55, legend: 0.4 },
  evolveAt: [3, 6, 9],
  /** each level above the first: this much more of the card's main number */
  perLevel: 0.05,
  /** the odds of a bundle's open slot, by rarity (published in the lobby) */
  odds: { common: 0.64, rare: 0.26, epic: 0.08, legend: 0.02 },
  /** a bundle's first card is a card never found yet with this chance (while there are any) */
  newFirst: 0.5,
  /** after this many cards without an epic or a legend, the next one is one */
  pity: 12,
  /** a copy past the top level becomes this much of a basket of crumbs */
  dustPerCopy: 0.25,
  /** the Spichlerz adds this to the odds of everything above common, per level */
  luckPerLevel: 0.03,

  // ── the league of stars ──────────────────────────────────────
  /** stars for each tier; past the last, a new tier every tierStep stars */
  tiers: [0, 15, 40, 80, 140, 220],
  tierStep: 70,

  // ── the missions ─────────────────────────────────────────────
  missions: 3,

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

/** The golden gate's multiplier for a level: ×1 below the threshold (never less), ×2 at it, up to ×5; in halves. */
export function goldMult(level: number): number {
  if (!(level >= 0.5)) return 1;
  const k = Math.min(1, (level - 0.5) / (RULES.goldTop - 0.5));
  return Math.round((RULES.goldAt + (RULES.goldMax - RULES.goldAt) * k) * 2) / 2;
}
