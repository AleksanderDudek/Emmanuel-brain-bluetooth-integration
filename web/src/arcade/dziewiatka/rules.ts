/**
 * Every number of Dziewiątka's rules in one place (sim.ts and battle.ts re-export it): the field, the
 * heroes' energy (Hero Wars' own rules: 1000 to fire the ultimate, +100 per attack or skill, +1 % per
 * 1 % of health lost, +300 for a hush), the band's multiplier and Harmony, the semi-auto, the Din's
 * shadows and their wind-ups, missions, waves and stars, the well (the rest), boons, growth (levels,
 * colour ranks from six pieces of gear, stars from notes), the blocks and the companion's lines.
 * Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * The field is a side view in u (about a metre each): x to the right, our heroes stand on the left
 * (x 2–7), the Din comes in from the right edge (x 16+).  `y` is a depth row 0..1 (drawn as a little
 * height on the street), it never changes who reaches whom.
 */
export const RULES = {
  // ── the field ────────────────────────────────────────────────
  /** the street the view shows (u): x from 0 to fieldW */
  fieldW: 14.5,
  /** the Din walks in from here (u) when it comes from beyond the street */
  spawnX: 15.6,
  /** a wave's shadows form out of the noise on the street, between these (u), each in this long (s) */
  formX: [10.4, 13.2],
  formSec: 0.55,
  /** heroes stand by their line: front, mid, back (u); the five form a staggered line this far apart (u) */
  home: { front: 6.2, mid: 4.7, back: 3.2 },
  spacing: 1.05,
  /** a melee hero steps at most this far forward of home to reach a target (u): the five stay in each other's reach */
  reach: 1.2,
  /** the well (the rest) stands here; Klara here */
  wellX: 4.4,
  klaraX: 1.25,
  /** a ranged hit flies at this speed (u/s) */
  shot: 15,
  /** a knockback slides this fast (u/s) and fades (1/s) */
  knock: 6,
  knockDrag: 5,

  // ── energy (Hero Wars' rules) ────────────────────────────────
  energyMax: 1000,
  perAttack: 100,
  /** per 1 % of max health lost */
  perPct: 10,
  perHush: 300,
  /** a hero's ultimate costs the full bar */
  /** the first-ever session's warm-up charges faster, so the first ultimate comes soon */
  warmBoost: 1.7,

  // ── the band ─────────────────────────────────────────────────
  /** energy × (1 + multK × level) in a sighted push block past its lead-in: ×1 … ×3, ×2 at the threshold */
  multK: 2,
  /** the lead-in before the band moves anything (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** Harmony: a held focus this long (s) fills it this much per second; a blind push pays its share × blindPay */
  holdNeed: { fnirs: 5, eeg: 3 },
  harmonyRate: 0.085,
  blindPay: 0.7,
  /** Harmony goes by itself after this long ready (s) while the Din is on the field */
  harmonyAuto: 6,
  /** the chord: the world holds this long (s); its wave of quiet hits every shadow for this many × the team's mean attack */
  harmonyStop: 0.9,
  harmonyHit: 3,
  /** the chord also lifts the fallen to this share of their health */
  harmonyLift: 0.3,
  /** a push block's surge: as the lead-in ends, this many small shadows join the wave; then, while the
   * multiplier is gold (above the threshold), one more forms every surgeEvery s, at most surgeCap a block */
  surge: 2,
  surgeEvery: 2.2,
  surgeCap: 9,
  /** the Din sends one more shadow per wave in a push block */
  pushExtra: 1,

  // ── ultimates and the semi-auto ──────────────────────────────
  /** the world holds while an ultimate is cast (s) — Hero Wars' freeze: a tap's, the semi-auto's */
  castStop: 0.24,
  castStopAuto: 0.08,
  /** an ultimate ready this long goes by itself (s), per role; healers and control wait for a reason, then go anyway */
  autoWait: { tank: 3, guard: 3.5, striker: 2.5, support: 3, control: 6, bard: 3, marksman: 2.5, healer: 6.5 } as Record<string, number>,
  /** a healer waits for an ally under this share of health; control waits for a wind-up */
  healerAt: 0.65,
  /** a portrait tapped while not ready: nothing but a wobble */

  // ── the heroes' ultimates (numbers on the effect) ────────────
  ult: {
    /** Patience's Wall: taunts and takes less for this long; answers with a share of what it took and × attack */
    wallSec: 5, wallCut: 0.6, wallBack: 0.4, wallHit: 2,
    /** Faithfulness: the fallen one gets up with this share; else a shield (share of max) and a guard (s) */
    reviveHp: 0.5, guardShield: 0.35, guardSec: 6, guardShare: 0.5, guardHit: 2,
    /** Self-control's One stroke: × attack, × more on a winding shadow */
    strokeHit: 7, strokeWind: 2,
    /** Love's Bond: seconds, damage up, heal share */
    bondSec: 6, bondUp: 0.25, bondHeal: 0.1,
    /** Kindness's tea: seconds, shadows served (more from the blue rank) */
    teaSec: 4, teaN: 2, teaNBlue: 3,
    /** Joy's song: energy to the others, haste (× attack speed) and its seconds */
    songEnergy: 300, songHaste: 1.3, songSec: 5,
    /** Goodness's beam: × attack to every shadow, through shields */
    beamHit: 4,
    /** Gentleness's lullaby: seconds asleep; damage wakes only after this long */
    sleepSec: 3, sleepFirm: 1.2,
    /** Peace's stillness: heal share, and debuffs washed away */
    stillHeal: 0.3,
  },

  // ── skills (green from rank 1, blue from rank 3) ─────────────
  skill: {
    greenRank: 1,
    blueRank: 3,
    /** blue skills' cooldowns (s) */
    blueCd: { cierpliwosc: 9, wiernosc: 10, opanowanie: 9, milosc: 12, uprzejmosc: 10, radosc: 11, dobroc: 8, lagodnosc: 12, pokoj: 9 } as Record<string, number>,
  },

  // ── statuses ─────────────────────────────────────────────────
  /** a Leniwiec's yawn slows attacks to this share for this long (s) */
  yawnSlow: 0.7, yawnSec: 3, yawnEvery: 8,
  /** a Plotka's whisper silences (no ultimate) for this long (s) */
  hushSec: 3,
  /** an interrupted shadow is dazed this long (s) and takes this much more */
  dazeSec: 1.6, dazeK: 1.5,
  /** a Gniewosz swells by a hit (most this many), each swell × attack; full = the outburst */
  swellMax: 5, swellAtk: 0.15,
  /** a Kłótniak splits under this share of health into this many Kłótniaczki */
  splitAt: 0.5, splitN: 2,
  /** a Rozproszek's bite takes this much energy from its hero, if the bar is at least this full */
  stealEnergy: 60,
  stealFrom: 500,
  /** a Zazdrośnik copies a buff it sees within this distance (u) */
  copyReach: 5,
  /** a broken mirror of a boss grows back after this long (s) to this share */
  mirrorBack: 14, mirrorRegrow: 0.6,
  /** the Din tires: a wave fought longer than this (s) loses this share of max health per second */
  tireAfter: 35, tireRate: 0.015,
  /** the specials' damage (× the shadow's attack) */
  specialHit: { outburst: 3.6, shout: 3.4, roll: 3.9, hubbub: 1.8, honk: 3.9, lookAtMe: 2.8 } as Record<string, number>,

  // ── missions and waves ───────────────────────────────────────
  /** shadows of a wave come in one by one, this far apart (s); the next wave after a breather (s) */
  spawnGap: 0.35,
  waveGap: 1.0,
  /** a mission's card (s) and the pause before the next mission */
  missionGap: 2.2,
  /** the Din's power grows by this factor per mission of the campaign, per floor of the tower */
  powerStep: 1.07,
  towerStep: 1.055,
  /** the Din is shy against a weaker team: at most this much weaker (the floor of the soft difficulty) */
  shyFloor: 0.62,
  /** a wipe: the tally card (s); the team gets up with this share; the wave loses heart (× health) */
  wipeSec: 2.6,
  wipeUp: 0.5,
  wipeHeart: 0.85,
  /** stars: 3 with nobody fallen, 2 with one, 1 with two or more */

  // ── the well (rest) ──────────────────────────────────────────
  /** health per second (share of max): always, and more with calm; after this lead-in (s) */
  healBase: 0.02,
  healCalm: 0.045,
  restLead: { fnirs: 4, eeg: 2 },
  /** a fallen hero stands up at this share; at the rest's end everybody stands with at least this */
  standAt: 0.2,
  /** the boons' choice: the first is taken by itself after this long (s) */
  choiceSec: 6,

  // ── growth ───────────────────────────────────────────────────
  /** XP per cleared wave to each of the five: base + per mission index */
  xpWave: 8,
  xpStep: 2,
  /** XP from level L to L+1: base + step × (L − 1) */
  xpNeed: 24,
  xpNeedStep: 12,
  levelMax: 60,
  /** health and attack per level, per colour rank, per star */
  perLevel: 0.07,
  perRank: 0.15,
  perStar: 0.12,
  rankMax: 9,
  /** notes (shards) to each star from 1★: 2★ … 6★ */
  starNotes: [10, 20, 30, 45, 60],
  /** gear: a wave drops a piece with this chance; a mission one, +1 for three stars, +2 for a boss */
  pieceWave: 0.35,
  /** notes: a mission gives 2 + stars of its hero's notes; a wave one note to someone in the five */

  // ── the session ──────────────────────────────────────────────
  /** push and rest: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: Klara waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the opening card (the first session): at most this long (s), a tap closes it after 0.6 s */
  openSec: 9,
  /** a chapter's card, a new hero's card (s) */
  storySec: 5,
  /** closing verses: a hold this long (s), interrupts this many */
  longHold: 12,

  // ── Klara's lines ────────────────────────────────────────────
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.4,
  /** the multiplier stays gold this long (s) before she cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
