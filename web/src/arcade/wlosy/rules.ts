/**
 * Every number of Każdy włos's rules in one place (DESIGN.md §15): how a scene grows (only with real focus),
 * the hairs it grows, the light on the picture (what the gauge shows), the deepening of rest, the moves between
 * scenes, the blocks, the voice and the cards.  Tuning moves a number here and nowhere else; the tests read the
 * same object.
 *
 * A scene's `growth` runs 0 → 1 and only moves while the band reads focus (the founder's rule of 2026-11-17:
 * "progress only from real concentration; what was gained stays").  The `light` is the live brightness of the
 * growing point, 0..1 with 0.5 at the threshold: the gauge.
 */
export const RULES = {
  // ── growth (only with focus) ─────────────────────────────────
  /** focused seconds a scene takes at a multiplier of 1 */
  sceneSec: 30,
  /** the multiplier: growBase + growLevel × level + growHold × min(1, hold / holdFull) */
  growBase: 0.75,
  growLevel: 0.5,
  growHold: 0.25,
  holdFull: 20,
  /** the first-ever session's warm-up grows at this share of the rate (real focus, a gentle start) */
  warmK: 0.5,
  /** hairs a scene's whole growth is worth: 4 a second of focused growth at a multiplier of 1 */
  hairsPerScene: 120,
  /** a blind block's growth may run past the scene's end by this much (the next scene starts with it) */
  blindCarry: 0.6,
  /** a blind block's growth is shown at its end over this long (s) */
  revealSec: 1.6,

  // ── the light at the growing point (the gauge) ───────────────
  /** without the brain (the lead-in, a blind block, no signal): just under the threshold */
  baseLight: 0.45,
  lightTau: 0.8,
  /** drawn in rest (calm shows in the deepening instead) */
  restLight: 0.3,
  /** gold from here (above the threshold) */
  gold: 0.5,

  // ── rest: the picture deepens, never advances ────────────────
  /** the deepening follows calm in rest with this time constant (s), and fades slowly elsewhere */
  deepTau: 3,
  deepFade: 25,
  /** the breath guide: in 4, out 6 — six breaths a minute */
  inhale: 4,
  exhale: 6,
  /** calm held at least this much in rest counts as abiding */
  abideCalm: 0.5,

  // ── the way through a meditation ─────────────────────────────
  /** the camera moves to a scene (s); growth waits for it */
  moveSec: 2.2,
  /** a grown scene's moment before the next one (s) */
  holdSec: 2.4,
  /** a whole meditation's moment before its closing card (s) */
  wholeSec: 2.6,
  /** the scene's line glows again after a tap on the picture (s) */
  reshowSec: 2.4,
  /** the meditation picker closes by itself after this long untouched (s) */
  pickerIdle: 20,

  // ── the session ──────────────────────────────────────────────
  /** the lead-in before the brain acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /**
   * push (Wzrost: the picture grows with focus): nominal length ± jitter (s) — 40 ± 5 by design since round 15 (24 ± 3
   * with 26 s rests made rest more than half the session, one every ~50 s); the player sets the mean 20–120 s in the
   * lobby, the jitter scales with it
   */
  push: [40, 5] as readonly [number, number],
  /**
   * a rest (Głębia: the picture deepens with calm and the breath): whole breaths of the guide — 3 by design (30 s: still
   * a meditation led by rest, the longest rest of the series), the player sets 1–6 in the lobby; a session too short
   * for its pushes gives back breaths, down to one
   */
  restBreaths: 3,
  restBreathsDial: { min: 1, max: 6 },
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a short test */
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
  /** gold light this long (s) before the narrator says so */
  goodSec: 5,
  /** a sighted push without focus this long (s) before the narrator says the picture waits (once a block) */
  stillSec: 9,
  /** every repeatEvery-th push asks to count instead of picturing (for those who do not picture easily) */
  repeatEvery: 3,

  // ── cards and the voice ──────────────────────────────────────
  /** the opening card's pages close themselves after pageSec each; a closing card after closeSec */
  pageSec: 11,
  closeSec: 9,
  tapAfter: 0.6,
  /** the narrator: each line 2–4 s by its length, a pause between two */
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** the first-time explanations (coach marks): one at a time, this far apart (s) */
  hintGap: 1.2,
} as const;

/** The breath guide's cycle (s): in + out. */
export const BREATH = RULES.inhale + RULES.exhale;

/** Hairs per second of focused growth at a multiplier of 1. */
export const HAIRS_PER_SEC = RULES.hairsPerScene / RULES.sceneSec;
