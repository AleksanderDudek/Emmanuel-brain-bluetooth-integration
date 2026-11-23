/**
 * Every number of Odnowa's rules in one place (sim.ts re-exports it): the blocks, the three needs of a division
 * (energy from focus, DNA repairs from the hands, building material from calm), the reveal of the first session,
 * the captions' reading time, the meta's milestones and the voice.  Tuning moves a number here and nowhere else;
 * the tests read the same object.
 *
 * The real numbers behind the picture (DESIGN.md §13.12, with sources): the mammalian ATP synthase's c-ring has
 * 8 subunits, so 8 protons turn it once and one turn makes 3 ATP (Watt et al. 2010, PNAS); the real motor turns
 * about 100 times a second — the game turns it about a hundred times slower, and runs repair and recycling
 * thousands of times faster than a cell does, so all of it fits a few minutes.
 *
 * Round 11 (2026-11-17, the founder: "nie rozumiem kompletnie co robię"): one source per need, and progress only
 * from the real thing — the turbine turns only while the player is focused, the clean-up wraps only with calm,
 * a repair only from a tap.  Without a signal nothing moves and nothing is lost.
 */
export const RULES = {
  // ── the blocks (the brief's §2 rules with a 3–4 s telegraph; round 15's rhythm, DESIGN §19) ──────
  /**
   * push blocks ("Energia": the turbine turns): mean and jitter (s) — 40 ± 6 by design since round 15 (26 ± 4 made the
   * rests nearly half the session, one every ~45 s); the player sets the mean 20–120 s in the lobby, the jitter scales
   */
  push: [40, 6] as const,
  /**
   * a rest ("Sprzątanie": the cell clears out old parts, only with calm): whole breaths of the breath pattern
   * (kit/breath, 4 in, 6 out) — 2 by design (20 s), the player sets 1–4 in the lobby; a session too short for its
   * pushes gives back breaths, down to one
   */
  restBreaths: 2,
  restBreathsDial: { min: 1, max: 4 },
  /** no block shorter than this (s) */
  minBlock: 12,
  /** the first-ever session's warm-up (s): 5 and 10 min / 3 min / a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  telegraph: 3.5,
  /** the runner's block banner covers the top of the play for this long (the voice waits) */
  bannerSec: 4.5,
  /** a held focus this long (s) turns the turbine gold */
  holdNeed: { fnirs: 3, eeg: 1.5 },
  /** blind pushes: every n-th push, from this session on, never the first push of a session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 6,
  /** time-up may wait this long for a division to finish (s) */
  settle: 8,

  // ── energy: the ATP synthase, only with focus ──────────────────────
  /**
   * The turbine's drive (0..1) while the player is focused: `driveMin` at the threshold, 1 at `level` 0.5 + `driveSpan`
   * and above; 0 without focus (and without a signal).
   */
  driveMin: 0.3,
  driveSpan: 0.4,
  /** how fast the drive follows (s) */
  driveTau: 0.7,
  /** turns a second at full drive (a turn makes 3 ATP) */
  spinMax: 1.5,
  /** how fast the shown spin follows its target (s): a heavy rotor, it never jumps */
  spinTau: 0.55,
  /** a held focus: the turbine turns gold, its output × (1 + goldK); gold eases in and out over this (s) */
  goldK: 0.4,
  goldTau: 0.8,
  /** ATP per turn (three catalytic β subunits) and protons per turn (the c8 ring) — Watt et al. 2010 */
  atpPerTurn: 3,
  protonsPerTurn: 8,
  /** each extra mitochondrion (biogenesis, the meta) adds this share of the big turbine's output */
  mitoShare: 0.25,

  // ── DNA: damage that waits for a tap ─────────────────────────────
  /** the lane's logical width (units across the visible lane) and where damage may appear on it */
  laneU: 10,
  spawnU: [2.4, 8.6] as const,
  /** two open lesions keep at least this far apart (units) */
  spawnGap: 1.7,
  /** at most this many lesions open at once */
  laneCap: 2,
  /** the first lesion after the lane is revealed (s), then one every [min, max] s while a push (or the warm-up) runs */
  firstLesion: 0.8,
  lesionEvery: [4.5, 7.5] as const,
  lesionEveryWarm: [3.5, 5.5] as const,
  /** a tap on the lane picks the open lesion nearest its x within this reach (units); farther: the oldest */
  tapReach: 2.4,
  /** a crew's arrival, then each step of the pathway (s, before the enzymes' level); a double-strand break is slower */
  crewIn: 0.22,
  step: 0.32,
  dsbK: 1.5,
  /** the helix scrolls on (units/s) only while no damage is open: the scanner moves on along a clean strand */
  scanV: 0.7,
  /** in a rest, the cell's own crew mends an open lesion after this many seconds of calm (calm-weighted) */
  cellFix: 5,
  /** a double-strand break: from this stage on, at most once a stage, this chance per lesion */
  dsbFrom: 2,
  dsbChance: 0.15,

  // ── the clean-up: autophagy, only with calm ──────────────────────
  /** spots in the city where worn parts appear (the view places them) and lysosomes they go to */
  spots: 4,
  lysos: 2,
  /** at most this many worn parts in progress at once */
  partCap: 2,
  /** the phases' lengths (s): tagging (ubiquitin), sealed, travel, fusion, digestion */
  tagSec: 0.9,
  sealSec: 0.5,
  travelSec: 2,
  fuseSec: 0.6,
  digestSec: 2,
  /** wrapping (0..1 per s) at full calm; it is `wrapRate · calm` — no calm, no wrapping */
  wrapRate: 0.3,
  /** a new worn part this long after a spot frees in a rest block (s), the first one sooner */
  partEvery: 1.2,
  partFirst: 0.6,
  /** a rest judged calm leaves this much extra building material */
  calmBonus: 2,

  // ── the division (one per stage): the three needs ─────────────────────
  /** stage s needs: ATP made [base, growth ×, cap], DNA repairs [base, + per stage, cap], building material [base, +, cap] */
  atpNeed: [60, 1.15, 300] as const,
  dnaNeed: [3, 1, 8] as const,
  matNeed: [5, 1, 12] as const,
  /** the mitosis' phases (s): prophase, metaphase, anaphase, telophase and cytokinesis, the daughter leaves */
  mitosis: [1.3, 1.2, 1.2, 1.5, 1.1] as const,

  // ── the first session: one system at a time ───────────────────────
  /** the DNA lane opens once the turbine has been shown this long and made `dnaAtp` ATP — or after `dnaMax` s anyway */
  dnaAfter: 8,
  dnaAtp: 6,
  dnaMax: 16,
  /** the division is explained once the clean-up has been shown this long (or two needs are full) */
  divideAfter: 10,
  /** a later session's quick reveal: one system every this many seconds, from `stagger0` */
  stagger0: 0.5,
  stagger: 2,

  // ── words on screen ───────────────────────────────────────────
  /** a caption stays ≥ readBase + readPerChar × characters, never under readMin (s) — read twice */
  readBase: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  /** the "what to do now" line: a change holds at least this long (s); the damage prompt waits for a lesion this long */
  nowHold: 2.5,
  nowDna: 1.5,
  /** the band's signal gone this long (s): the line says so */
  noSignal: 2,
  /** the opening card closes by itself after its reading time, at most this long (s) */
  openMax: 16,

  // ── the meta: milestones of the lifetime ──────────────────────────
  /** extra mitochondria (biogenesis) at these lifetime ATP */
  mitoAt: [1400, 4500, 11000] as const,
  /** faster enzymes at these lifetime repairs */
  enzymeAt: [25, 80, 180] as const,
  /** more lysosomes at these lifetime recycled parts */
  lysoAt: [8, 24, 50] as const,
  /** each enzyme level: steps × this (faster) */
  enzymeK: 0.82,
  /** each lysosome level: wrapping and digestion × this (faster) */
  lysoK: 1.15,
  /** the niches open at these lifetime divisions (gut from the start) */
  nicheAt: { gut: 0, skin: 2, blood: 5 } as const,
  /** a patch of tissue is this many cells */
  patch: 12,
  /** the best repair streak a save may hold (older saves) */
  comboMax: 12,

  // ── the voice ───────────────────────────────────────────────
  talkGap: 1.6,
} as const;

/** A stage's need from [base, growth, cap]: multiplicative growth (ATP) or additive growth (the others). */
export function need(spec: readonly [number, number, number], stage: number, mult: boolean): number {
  const s = Math.max(1, Math.floor(stage));
  const v = mult ? spec[0] * spec[1] ** (s - 1) : spec[0] + spec[1] * (s - 1);
  return Math.round(Math.min(spec[2], v));
}

/** How long a caption of this text stays on screen (s): long enough to read it twice (round 11's rule). */
export function readSec(text: string): number {
  return Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * [...text].length);
}
