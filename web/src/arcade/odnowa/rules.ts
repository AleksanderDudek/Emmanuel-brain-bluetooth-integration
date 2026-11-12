/**
 * Every number of Odnowa's rules in one place (sim.ts re-exports it): the blocks, the engine (the proton
 * gradient, the turbine, ATP, the full power), the DNA lane (the scan, the lesions, the repairs), the
 * clean-up (autophagy), the division and its recipe, the meta's milestones and the voice.  Tuning moves a
 * number here and nowhere else; the tests read the same object.
 *
 * The real numbers behind the picture (DESIGN.md §13.12, with sources): the mammalian ATP synthase's c-ring
 * has 8 subunits, so 8 protons turn it once and one turn makes 3 ATP (Watt et al. 2010, PNAS); the real
 * motor turns about 100 times a second — the game turns it about a hundred times slower, and runs repair
 * and recycling thousands of times faster than a cell does, so all of it fits a few minutes.
 */
export const RULES = {
  // ── the blocks (the brief's §2 rules: 20–30 s with jitter, a 3–4 s telegraph) ──────
  /** push and rest blocks: mean and jitter (s) */
  push: [26, 4] as const,
  rest: [22, 3] as const,
  /** no block shorter than this (s) */
  minBlock: 12,
  /** the first-ever session's warm-up (s): 5 and 10 min / 3 min / a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  telegraph: 3.5,
  /** the runner's block banner covers the top of the play for this long (the voice waits) */
  bannerSec: 4.5,
  /** the band's delay before it can act in a push (s) and before calm counts in a rest */
  leadIn: { fnirs: 5, eeg: 2 },
  restLead: { fnirs: 4, eeg: 1.5 },
  /** a held focus this long (s) starts charging the full power */
  holdNeed: { fnirs: 3, eeg: 1.5 },
  /** blind pushes: every n-th push, from this session on, never the first push of a session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 6,
  /** time-up may wait this long for a division to finish (s) */
  settle: 8,

  // ── the engine: the proton gradient and the ATP synthase ──────────────
  /** the gradient (0..1, 0.5 at the threshold): neutral in a push, idle in a rest, and how fast it follows (s) */
  gradNeutral: 0.36,
  gradRest: 0.22,
  gradTau: 1.4,
  /** turns per second of the turbine: base + k · gradient (0.9 at neutral, 1.25 at the threshold, 2.4 at full) */
  spinBase: 0.1,
  spinK: 2.3,
  /** how fast the shown spin follows its target (s): a heavy rotor, it never jumps */
  spinTau: 0.55,
  /** ATP per turn (three catalytic β subunits) and protons per turn (the c8 ring) — Watt et al. 2010 */
  atpPerTurn: 3,
  protonsPerTurn: 8,
  /** each extra mitochondrion (biogenesis, the meta) adds this share of the big turbine's output */
  mitoShare: 0.25,
  /** a tap on the turbine: one proton's step (1/8 turn), at most this often (s) */
  kickCool: 0.3,
  /** the full power: charge from a held focus (per s), from a repair at combo ≥ 3, the blind share's weight */
  holdRate: 1 / 16,
  comboCharge: 0.035,
  blindCharge: 0.7,
  /** the full power: its length (s), the spin's ×, how long a ready one waits for a tap before it goes by itself */
  surgeSec: 6,
  surgeK: 2.5,
  surgeAuto: 8,

  // ── the DNA lane (logical units: 10 across the visible lane) ─────────
  laneU: 10,
  /** the scan's speed (units/s): no open lesion on the lane / at least one (the scanner waits for repairs) */
  scanFast: 1.15,
  scanSlow: 0.5,
  /** the gate on the left: an open lesion stops the helix there and the cell's own crew repairs it after this (s) */
  gateU: 1.1,
  gateFix: 3,
  /** lesions come in from the right edge at gaps of this many units (scaled by the block's damage rate) */
  gap: [2.7, 5.6] as const,
  /** damage often comes in clusters (an oxidative burst): this chance of a second lesion this far behind (units) */
  cluster: 0.32,
  clusterGap: [0.9, 1.6] as const,
  /** the damage rate's scale in a rest block and in the warm-up (fewer lesions to tap in the calm) */
  restGapK: 1.7,
  warmGapK: 1.25,
  /** a tap on the lane picks the open lesion nearest its x within this reach (units); farther: the most urgent */
  tapReach: 2.4,
  /** a repair's crew and steps (s, before the enzymes' level and focus): arrival, then each step */
  crewIn: 0.22,
  step: 0.3,
  /** focus speeds the crews: steps × (fast + slow · gradient)⁻¹ */
  stepFocus: [0.8, 0.8] as const,
  /** repairs started by taps within this window chain into a combo */
  comboSec: 4.5,
  comboMax: 12,
  /** a double-strand break: from this stage on, at most once a stage, this chance per lesion */
  dsbFrom: 2,
  dsbChance: 0.12,
  /** at most this many lesions on the lane at once */
  laneCap: 4,

  // ── the clean-up: autophagy (rest) ─────────────────────────────
  /** spots in the city where worn parts appear (the view places them) and lysosomes they go to */
  spots: 4,
  lysos: 2,
  /** at most this many worn parts in progress at once */
  partCap: 2,
  /** the phases' lengths (s): tagging (ubiquitin), sealed and waiting, travel, fusion, digestion */
  tagSec: 0.9,
  travelSec: 2.4,
  fuseSec: 0.6,
  digestSec: 2.4,
  /** wrapping (0..1 per s): base · (neutral share + calm share · calm) — without a signal the neutral share */
  wrapRate: 0.21,
  wrapNeutral: 0.35,
  /** a new worn part this long after a spot frees in a rest block (s) */
  partEvery: 1.2,

  // ── the division (one per stage) ───────────────────────────────
  /** the recipe of stage s: ATP made, building material, genome scanned (units) */
  atpNeed: [95, 1.17, 420] as const,
  matNeed: [5, 1, 12] as const,
  scanNeed: [38, 5, 75] as const,
  /** the mitosis' phases (s): prophase, metaphase, anaphase, telophase and cytokinesis, the daughter leaves */
  mitosis: [1.3, 1.2, 1.2, 1.5, 1.1] as const,
  /** the new cell's card stays this long (s) */
  cellCard: 3.6,
  /** the first-ever story card (s; a tap closes it after a moment) */
  openSec: 9,

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

  // ── the voice ───────────────────────────────────────────────
  talkMin: 2.2,
  talkMax: 4,
  talkGap: 1.6,
} as const;

/** A stage's need from [base, growth, cap]: multiplicative growth (ATP) or additive growth (the others). */
export function need(spec: readonly [number, number, number], stage: number, mult: boolean): number {
  const s = Math.max(1, Math.floor(stage));
  const v = mult ? spec[0] * spec[1] ** (s - 1) : spec[0] + spec[1] * (s - 1);
  return Math.round(Math.min(spec[2], v));
}
