/**
 * Every number of Synapsy's rules in one place: the brain's scale, wiring (Hebb), growth (the band's push),
 * thoughts and their paths, myelin and Oli, the BDNF bloom, rest (replay, pruning, the glymphatic wash),
 * the bridge between the halves, the lessons, the blocks and the voice.  Tuning moves a number here and
 * nowhere else; the tests read the same object.
 *
 * The brain lives in normalised units: x from −1 (the left hemisphere's outer edge) to +1, y from −1 (the
 * frontal pole, at the top of the screen — where the headband sits) to +1 (the occipital pole).  Two units
 * are an adult brain's length front to back (~167 mm), which turns a link's length into millimetres and a
 * path's speed into a real conduction time (DESIGN §13.11, sources there).
 */
export const RULES = {
  // ── the brain ─────────────────────────────────────────────────
  /** front to back (mm) = 2 units: an adult brain's length */
  brainMm: 167,
  /** the longest link a neuron can grow (units, ≈ 42 mm) */
  reach: 0.5,
  /** links one neuron can keep at once (the puzzle's budget; pruning frees them) */
  perNeuron: 5,
  /** the per-player jitter of the template's neurons (units) */
  jitter: 0.03,

  // ── wiring: fire together, wire together ─────────────────────
  /** two neurons fired within this many seconds of each other wire (or thicken) */
  hebbSec: 1.6,
  /** a second tap on the empty field this soon after the hint wires the lesson's pair (a phone's Space) (s) */
  hintHelpSec: 4,
  /** a new link grows from one neuron to the other in this many seconds (before the growth multiplier) */
  sproutSec: 1.7,
  /** synapses one link can hold */
  synMax: 6,
  /** growth toward the next synapse: a pair fired by the hands, a thought that crossed, a replay */
  tapGrow: 0.55,
  thoughtGrow: 0.16,
  replayGrow: 0.05,
  /** a pair fired within this many beats of the song's beat is "in rhythm": its growth × beatBonus */
  beatWindow: 0.16,
  beatBonus: 1.5,
  /** one synapse passes a thought with this chance; n synapses: 1 − (1 − p)^n */
  release: 0.5,

  // ── the band: growth in a push block ─────────────────────────
  /** before the brain acts in a block (s): the haemodynamic lag of fNIRS, a beat of EEG */
  leadFnirs: 5,
  leadEeg: 2,
  /** growth × (1 + growK · level) in a sighted push past its lead-in */
  growK: 2,
  /** growth per second on the lesson route's links, × level, in a sighted push (focus = growth) */
  pathGrow: 0.07,
  /** the BDNF bloom: charge per second at full focus, nothing under `bloomFloor` */
  bloomRate: 0.085,
  bloomFloor: 0.35,
  /** a pruned link's material returns to the bloom's charge */
  pruneGift: 0.08,
  /** what a blind push's hidden growth pays at its end: the share above the threshold × this charge */
  blindBloom: 0.6,

  // ── myelin (Oli, the oligodendrocyte) ────────────────────────
  /** myelin per second at base: a full sheath in ~18 s; focus × (1 + growK · level) */
  wrap: 0.055,
  /** × on an axon that carried a thought in the last `activeSec` (activity-dependent myelination) */
  wrapActive: 1.5,
  activeSec: 6,
  /** conduction speed (m/s) from a bare axon to a full sheath: v = vBare + (vMax − vBare) · myelin² */
  vBare: 1,
  vMax: 100,
  /** how fast Oli floats to her axon (units/s) */
  oliSpeed: 0.9,

  // ── thoughts ─────────────────────────────────────────────────
  /** the song's tempo: the inputs fire on its beats (music.ts plays at the same tempo) */
  bpm: 112,
  /** a pulse on screen: units per second on a bare axon, × (1 + pulseMyelin · myelin) — slowed for the eye */
  pulseSpeed: 0.95,
  pulseMyelin: 5,
  /** the lesson's input fires every this many beats; a learned path's input every `habitEvery` */
  inputEvery: 2,
  habitEvery: 4,
  /** at most this many pulses in the field at once */
  maxPulses: 26,
  /** a thought shown lost at a dead end or a weak synapse fades this long (s) */
  lostSec: 0.9,

  // ── rest: consolidation ──────────────────────────────────────
  /** seconds between two replays at calm 0 and at calm 1 */
  replayGap: [3.0, 1.1] as const,
  /** consolidation a replay adds to each link on its path, × (0.6 + 0.8 · calm) */
  replayGain: 0.22,
  /** a replay races this many times faster than a thought (sleep's replay is ~20× compressed) */
  replaySpeed: 7,
  /** a weak link idle this long (s) may be pruned in a rest block */
  pruneIdle: 22,
  /** seconds between two prunings, and how long one takes to fade */
  pruneGap: 3.4,
  pruneSec: 2.4,
  /** waste (0..1) gathers while the network works and the wash clears it in rest */
  wasteBase: 0.004,
  wastePulse: 0.0012,
  washBase: 0.02,
  washCalm: 0.08,
  /** a clean brain grows faster: growth × (1 + clarityK · (1 − waste)) */
  clarityK: 0.3,
  /** the breath in rest: in for 4 s, out for 6 s */
  breathIn: 4,
  breathOut: 6,

  // ── the bridge (corpus callosum) ─────────────────────────────
  /** the halves in step must last this long (s) before the bridge lights */
  stepOn: 1,
  /** in step: links that cross toward the other half grow × this, and the bridge passes every thought */
  stepGrow: 1.5,
  /** the bridge's own myelin at start (the callosum is largely myelinated) and its synapses */
  bridgeMyelin: 0.55,
  bridgeSyn: 4,

  // ── lessons ──────────────────────────────────────────────────
  /** thoughts a lesson asks for, + this per round of the ladder */
  needRound: 2,
  /** a fast lesson's conduction limit (ms), by round */
  speedMs: [10, 5, 2.5] as const,
  /** a lesson card stays this long unless tapped (s); the opening story up to `storyMax` */
  cardSec: 4.5,
  storyMax: 12,

  // ── blocks ───────────────────────────────────────────────────
  /** push and rest blocks: mean and jitter (s) */
  push: [26, 4] as const,
  rest: [22, 3] as const,
  minBlock: 12,
  /** the first-ever session's warm-up (s): 5–10 min, 3 min, a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s) */
  finale: { long: 12, short: 6 },
  telegraph: 3.5,
  /** the runner's block banner covers the start of a block this long (s) */
  bannerSec: 4.5,
  /** blind pushes: every `blindEvery`-th push from the `blindFrom`-th session */
  blindFrom: 3,
  blindEvery: 4,
  /** a block with fewer reliable seconds than this gets no verdict */
  minReliable: 5,
  /** after time is up the session may run this long to settle (s) */
  settle: 2,

  // ── the voice ────────────────────────────────────────────────
  talkGap: 2.4,
  talkMin: 2.2,
  talkMax: 4,

  // ── saving ───────────────────────────────────────────────────
  /** links kept between sessions (the consolidated ones, strongest first) */
  keepLinks: 90,
} as const;

/** A link's conduction speed (m/s) for its myelin (0..1). */
export const speedOf = (myelin: number): number => {
  const m = Math.max(0, Math.min(1, myelin));
  return RULES.vBare + (RULES.vMax - RULES.vBare) * m * m;
};

/** One link's chance to pass a thought with `syn` synapses. */
export const passChance = (syn: number): number => (syn <= 0 ? 0 : 1 - (1 - RULES.release) ** syn);

/** Units to millimetres. */
export const mmOf = (units: number): number => (units * RULES.brainMm) / 2;
