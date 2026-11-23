/**
 * Every number of Z głowy do serca in one place (DESIGN.md §18): what focus drives (the light's rate), how the way
 * is spread over the session (plan.ts reads these), the blocks, the camera, the words.  Tuning moves a number here
 * and nowhere else; the tests read the same object.
 *
 * The light moves **only from real focus**: in a push past its lead-in, with a reliable signal, while the focus is
 * above the threshold (`frame.focused`) — faster the further above it and the longer it is held.  Nothing moves in
 * rest, the warm-up, the finale, without a signal, below the threshold, or from taps; what is gained stays.
 */
export const RULES = {
  // ── the light (what focus drives) ────────────────────────────
  /**
   * Held units a second while focused in a push past its lead-in: (rateLo + rateK × above) × (1 + holdK × min(1,
   * hold / holdFull)), above = clamp((level − 0.5) / 0.5) — 0.75 at the threshold, up to ~1.6 in a strong, held focus.
   */
  rateLo: 0.75,
  rateK: 0.5,
  holdK: 0.3,
  holdFull: 12,
  /**
   * The plan's average player (an adaptive threshold keeps ~60 % of the time above it): held units per second of a
   * push past its lead-in.  `margin` keeps the way just inside the time for that player.
   */
  avgYield: 0.5,
  margin: 0.9,
  /** the shown glow follows the focus level over ≥ 10 s (time constant), so paced breathing does not pulse it */
  glowTau: 5,
  /** the glow shown while the brain drives nothing (warm-up, lead-in, no signal), and in rest */
  baseGlow: 0.42,
  restGlow: 0.6,

  // ── the blocks ───────────────────────────────────────────────
  /** the lead-in before the brain acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the next block is announced this long ahead (s); a push's rest when its last step is this full */
  telegraph: 4,
  telegraphAt: 0.85,
  /** a push shorter than this is not judged (s) */
  minPush: 10,
  /** the safety valve: this long without any light gained, or this long in all while not nearly done (s) */
  valveStall: 60,
  valveSec: 150,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the runner's banner covers the first seconds of a block */
  bannerSec: 5,
  /** the first-ever session's warm-up (s) */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,

  // ── the plan (plan.ts) ───────────────────────────────────────
  /**
   * under this (s): rings 1–3 share one push and one rest, the closing steps merge into ring 5's push.  Round 15 (the
   * founder: "dlaczego jest tak często?"): 330, not 270 — a 5-minute session (the lobby's default) walks this compact
   * way too: 5 rests, about one a minute, where the full way gave it 8, one every ~37 s
   */
  shortBelow: 330,
  /** from this (s): stops on the descent (the mouth, the throat) and the sun's own rest */
  stopsFrom: 540,
  /** from this (s): ring 5's named arcs of light */
  arcsFrom: 900,
  /** from this (s): the rings' pushes are split in two with one breath of the heart word between */
  splitFrom: 1080,
  /** the share of a session (after the warm-up and the finale) the rests aim at */
  restShare: 0.34,
  /**
   * The rest's rhythm in the lobby (round 15, kit/rhythm.ts): a blessing after 1…circlesMax circles (1 by design);
   * each rest 1…restBreathsMax whole breaths (by design the budget's share: about 2 breaths of 5 · 5 a blessing in
   * sessions of 5 minutes and more); the player's rests never more than restCap of the session.
   */
  circlesMax: 3,
  restBreathsDef: 2,
  restBreathsMax: 6,
  restCap: 0.55,
  /** about how long a circle's push takes, its lead-in included (s), for the lobby's count of rests a session */
  circleSec: 40,
  /** the push weights of the way's stages (the held units each needs, in proportion) */
  weight: { descent: 14, heart: 6, field: 12, ring: 11, ring4: 13, ring5: 12, ring5Long: 14, sun: 4, pervade: 3, back: 6, more: 7 },
  /** the rest weights (their share of the rest budget; each rest is whole breaths, at least one) */
  restWeight: { stop: 0.6, grat: 1, bless: 1, bless4: 1.4, bless5: 1.2, sun: 0.8, amen: 1.2, word: 0.5, more: 0.8 },
  /** the share of a ring's push that is the reach (the field widening to it); the rest kindles its lamps */
  reachShare: 0.3,
  /** the descent's places in order along the midline (kit/figure PLACE), and where its stops are */
  descentPlaces: ['brow', 'eyes', 'mouth', 'throat', 'heart'] as const,

  // ── the world ────────────────────────────────────────────────
  /** the radius of the field round the figure (ring 0) and of rings 1–4, in figure units from the heart */
  ringR: [0.86, 1.3, 1.78, 2.3, 2.86] as const,
  /** the Earth's radius (figure units); its limb runs under the figure's feet */
  earthR: 5.2,
  /** lamps per ring at 10 minutes (rings 1–4; ring 5 = the world's city clusters), scaled with the length */
  lamps: [0, 8, 10, 16, 8, 24] as const,
  /** lights the "more" rounds add to the world, each */
  moreLights: 6,

  // ── the camera and the hands ─────────────────────────────────
  cameraTau: 1.3,
  /** the words glow again after a tap (s) */
  reshowSec: 2.4,

  // ── cards and the voice ──────────────────────────────────────
  pageSec: 9,
  tapAfter: 0.6,
  /** reading time (the round-11 clarity rule): readSec + readPerChar × characters, at least readMin */
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.6,
  hintGap: 1.2,
  /** no light gained this long in a sighted push (with a signal): the narrator says how it moves (once a session) */
  waitSec: 10,
  /** the light moving this long: the narrator says so */
  goodSec: 6,

  // ── the player's own words ───────────────────────────────────
  ownMax: 60,
  nameMax: 24,
  namesMax: 8,
} as const;

/** How long a line of `text` stays on screen to be read twice (s). */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

/**
 * The light's rate (held units a second) for a focus frame: only while focused, faster above the threshold and as a
 * focused stretch is held.  The sim calls it only in a push past its lead-in with a reliable signal.
 */
export function focusRate(level: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = Math.max(0, Math.min(1, (level - 0.5) / 0.5));
  return (R.rateLo + R.rateK * above) * (1 + R.holdK * Math.min(1, Math.max(0, hold) / R.holdFull));
}

/** The first-ever session's warm-up (s). */
export function warmFor(plannedSec: number): number {
  if (plannedSec <= 60) return Math.min(RULES.warm.test, Math.max(8, plannedSec - finaleFor(plannedSec)) / 3);
  return plannedSec >= 300 ? RULES.warm.long : RULES.warm.short;
}

/** The last stretch without a block (s). */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** How many lamps a ring (1–5) holds for a session of this length: fewer in 3 minutes, more in 30. */
export function lampsFor(ring: number, plannedSec: number): number {
  const base = RULES.lamps[ring] ?? 0;
  if (!base) return 0;
  const k = Math.max(0.6, Math.min(1.6, 0.55 + 0.45 * (plannedSec / 600)));
  return Math.max(ring === 1 ? 4 : 5, Math.round(base * k));
}
