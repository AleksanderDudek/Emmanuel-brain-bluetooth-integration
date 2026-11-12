/**
 * Every number of Ja jestem…'s rules in one place (DESIGN §13.8): the window and its picture, the
 * mosaic, the colour that focus pours, the glow that calm gathers, the aura's rays and rings, the blocks,
 * the finale and the voice.  Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * Units: the picture lives in its own space, PW × PH (the window's rectangle; the round arch cuts its top
 * corners).  Colour is poured in "units": a cell of the mean size holds one unit (`capacity`), so the rates
 * below read as "mean cells per second".
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

  // ── the mosaic ───────────────────────────────────────────────
  /** cells in a window: at least, at most, and the first session's */
  cellsMin: 24,
  cellsMax: 64,
  /** the pace (mean cells lit per second of pouring) a newcomer is planned for, and its bounds */
  pace0: 1 / 4.2,
  paceMin: 1 / 8,
  paceMax: 1 / 1.8,
  /** how much of a session's pace goes into the next plan (exponential average) */
  paceMix: 0.4,
  /** the plan aims to finish the picture at this share of the pouring time */
  planShare: 0.95,
  /** Lloyd relaxation steps for the mosaic */
  relax: 2,
  /** a cell's capacity (units): 0.55 + 0.45 × its area / the mean area, clamped */
  capBase: 0.55,
  capArea: 0.45,
  capMin: 0.6,
  capMax: 1.6,
  /** an own picture is cut into this many fragments: N / fragPer, within these bounds */
  fragPer: 8,
  fragMin: 3,
  fragMax: 6,

  // ── the colour (push blocks and the warm-up) ──────────────────
  /** units per second in the warm-up (the first session teaches the hands, quickly) */
  warmRate: 0.3,
  /** a push block: base + span × shape(level) — shape rises from `levelLo` to full at `levelLo + levelSpan` */
  baseRate: 0.12,
  spanRate: 0.34,
  levelLo: 0.15,
  levelSpan: 0.75,
  shapePow: 1.3,
  /** the band's delay before it acts in a push (s): fNIRS answers 4–6 s late, EEG at once */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a tap on the cell being coloured (or Space): a drop of colour, at most this often */
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
  /** the breath that leads a rest: in, out (s) — six breaths a minute */
  breathIn: 4,
  breathOut: 6,

  // ── the aura ─────────────────────────────────────────────────
  /** a passed push block adds a ray, a passed rest block a ring */
  raysMax: 6,
  ringsMax: 5,

  // ── the blocks ───────────────────────────────────────────────
  /** the first-ever session's warm-up (s): long sessions (≥ 300 s), shorter ones, a ≤ 60 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** push and rest blocks: mean and jitter (s) */
  push: [26, 4] as const,
  rest: [22, 3] as const,
  minBlock: 12,
  /** the telegraph before a block ends (s) */
  telegraph: 3.5,
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
  storySec: 9,
  storyAsk: 14,
  /** a tap closes it only after this (s), so a stray tap does not skip it */
  storyMinTap: 1.2,

  // ── the voice ────────────────────────────────────────────────
  talkMin: 2.2,
  talkMax: 4,
  talkGap: 2.5,
  /** the voice says something about a lit cell at most this often (s) */
  litTalkEvery: 14,
  /** a focus held above the threshold this long (s) in a push earns a word */
  goodSec: 8,
} as const;

export type Rules = typeof RULES;
