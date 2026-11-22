/**
 * Every number of Ja jestem…'s rules in one place (DESIGN §13.8): the window and its picture, the
 * mosaic, the colour that focus pours, the glow that calm gathers, the aura's rays and rings, the blocks,
 * the finale and the voice.  Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * Units: a declaration's picture lives in its own space, PW × PH (the window's rectangle; the round arch cuts
 * its top corners); an own photo keeps its own shape (its aspect within 9:16…16:9) over about the same area.
 * Colour is poured in "units": a cell of the mean size holds `capUnit` units, so a push of 3–5 cells lasts
 * about 20–30 s of focus at the threshold (round 11: the rest comes after the cells, not after a clock).
 */
export const RULES = {
  // ── the window and its picture ────────────────────────────────
  /** the picture's own space (the window's rectangle) */
  PW: 600,
  PH: 700,
  /** the round arch over the window: its radius as a share of the width (the arch cuts the top corners) */
  archR: 0.78,
  /** a tile counts as part of the window when at least this share of it lies inside the arch */
  inside: 0.35,
  /** an own photo's shape: its aspect (width / height) is held within these (the rest is cropped, centred) */
  aspectMin: 9 / 16,
  aspectMax: 16 / 9,

  // ── the mosaic ───────────────────────────────────────────────
  /** cells in a window: at least, at most (round 11: "more pieces of the mosaic") */
  cellsMin: 48,
  cellsMax: 144,
  /**
   * sessions over 15 minutes (round 12: up to 30) may take finer windows, up to this many cells — reached at
   * `cellsLongAt` seconds of push and rest, grown from `cellsLongFrom` — so a strong player is not done colouring
   * a third of the way in; 15 minutes and less keep 48–144 exactly
   */
  cellsLongMax: 216,
  cellsLongFrom: 900,
  cellsLongAt: 1350,
  /** the pace (cells lit per minute of push and rest) a newcomer is planned for, and its bounds */
  pace0: 5.3,
  paceMin: 2,
  paceMax: 14,
  /** how much of a session's pace goes into the next plan (exponential average) */
  paceMix: 0.4,
  /**
   * the window holds this many times the cells a session is expected to light: the player's focus colours the
   * picture from its heart outward, and the finale's light completes the rest
   */
  planSpread: 1.4,
  /** Lloyd relaxation steps for the mosaic */
  relax: 2,
  /** a cell's capacity (units): capUnit × (0.55 + 0.45 × its area / the mean area, clamped) */
  capUnit: 1.23,
  capBase: 0.55,
  capArea: 0.45,
  capMin: 0.6,
  capMax: 1.6,
  /** an own picture is cut into this many fragments: N / fragPer, within these bounds */
  fragPer: 8,
  fragMin: 3,
  fragMax: 6,

  // ── the colour (push blocks and the warm-up) ──────────────────
  /** units per second in the warm-up while focused (the first session teaches the hands, quickly) */
  warmRate: 0.3,
  /**
   * a push block, while focused past the lead-in: base + span × shape(level) — shape rises from `levelLo` to full
   * at `levelLo + levelSpan` (≈ 0.25 u/s at the threshold, 0.46 at full); without focus nothing flows
   */
  baseRate: 0.12,
  spanRate: 0.34,
  levelLo: 0.15,
  levelSpan: 0.75,
  shapePow: 1.3,
  /** the band's delay before it acts in a push (s): fNIRS answers 4–6 s late, EEG at once */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a tap on the cell being coloured (or Space): a drop of colour joins the flowing colour, at most this often */
  splash: 0.06,
  splashCool: 0.6,
  /** a tap chooses the unlit cell nearest the finger within this distance (picture units), else the nearest anywhere */
  pickRadius: 160,
  /** a drag lays a path of at most this many cells */
  pathMax: 12,
  /** the smoothing of the stream's width (the gauge) (s) */
  meterTau: 0.6,

  // ── the glow (rest blocks) and the light pass ─────────────────
  /** glow per second in a rest: (glowBase + glowCalm × calm) / glowSec */
  glowSec: 30,
  glowBase: 0.3,
  glowCalm: 0.7,
  /** a cell's glow when it lights */
  glowFresh: 0.12,
  /** the light pass (every cell lit before the end): glow per second in a push, (base + level) / lightSec */
  lightSec: 22,
  lightBase: 0.3,
  /** a rest: about this many seconds of whole breaths (kit/breath, 4 · 0 · 6 · 0 → 2 breaths, 20 s), at least `restMin` */
  restTarget: 22,
  restMin: 12,

  // ── the aura ─────────────────────────────────────────────────
  /** a passed push block adds a ray, a passed rest block a ring */
  raysMax: 6,
  ringsMax: 5,

  // ── the blocks ───────────────────────────────────────────────
  /** the first-ever session's warm-up (s): long sessions (≥ 300 s), shorter ones, a ≤ 60 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** a push ends when this many of its cells light: the first push's, and the bounds (the player's pace moves it) */
  pushCells: 3,
  pushCellsMin: 3,
  pushCellsMax: 5,
  /** a push shorter than this (s) asks one cell more next time; one longer (or cut at its cap) one fewer */
  pushQuick: 24,
  pushSlow: 34,
  /** a push never lasts longer than this (s): without focus the rest still comes */
  pushMax: 40,
  /** the shortest push worth starting (s) before the finale; a ≤ 60 s test session's */
  pushRoom: 16,
  pushRoomTest: 5,
  /** the telegraph: when the push's last cell is this full, or this long (s) before a block's end */
  teleShare: 0.6,
  telegraph: 3.5,
  /** once telegraphed, a push ends within this (s) even if its last cell is not yet full */
  teleMax: 8,
  /** the runner's block banner (s): the voice keeps quiet under it */
  bannerSec: 4.5,
  /** blind pushes ("Noc"): every n-th push from this session on, never a session's first push */
  blindEvery: 4,
  blindFrom: 3,
  /** a block's verdict needs this many reliable seconds */
  minReliable: 6,

  // ── the finale ───────────────────────────────────────────────
  /** the finale's length (s) by the planned session length */
  finale: { long: 20, mid: 14, short: 8 },
  /** the grace wash takes this long to reach the last unlit cell (s) */
  graceSec: 2.6,
  /** a session may run over its plan by this much to finish the finale (s) */
  settle: 4,

  // ── the opening card ─────────────────────────────────────────
  /** the first session's story card closes by itself after this (s); with the form question, after `storyAsk` */
  storySec: 11,
  storyAsk: 16,
  /** a tap closes it only after this (s), so a stray tap does not skip it */
  storyMinTap: 1.2,

  // ── the voice and the words on screen ─────────────────────────
  /** a line stays long enough to read twice: base + per character (s), never under `readMin` (round 11) */
  readBase: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.5,
  /** the voice says something about a lit cell at most this often (s) */
  litTalkEvery: 14,
  /** a focus held above the threshold this long (s) in a push earns a word */
  goodSec: 8,
} as const;

export type Rules = typeof RULES;

/** How long a line stays on screen (s): long enough to read it twice — 2.5 s + 70 ms a character, never under 4.5 s. */
export const readSec = (text: string): number =>
  Math.max(RULES.readMin, RULES.readBase + RULES.readPerChar * [...text].length);
