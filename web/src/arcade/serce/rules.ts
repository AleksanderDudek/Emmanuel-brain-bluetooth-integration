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
   * push past its lead-in.  A stage's push asks for `avgYield × margin` a second (round 16): the simulated average
   * (about 0.56) meets it at about 85 % of each push, so an average stage lasts its length; a stronger player abides
   * inside the push, a weaker one's push runs longer (the valve rests it) and the later stages shift.
   */
  avgYield: 0.5,
  margin: 0.95,
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
  /**
   * the safety valve: this long without any light gained, or this long in all while not nearly done (s) — a stage's
   * push: `valveK` × its least length, at least `valveMin` (a weak player's push rests and goes on)
   */
  valveStall: 60,
  valveSec: 150,
  valveK: 2,
  valveMin: 90,
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

  // ── the way in stages (plan.ts, round 16) ───────────────────
  /**
   * The founder (round 16): "Każdy etap powinien trwać od 2 do 4 minut."  The stage length the player chooses in the
   * lobby (s), its choices and default; a stage starts only with at least `stageFloor` left before the close.
   */
  stageLens: [120, 150, 180, 210, 240] as const,
  stageDef: 180,
  stageFloor: 120,
  /** a stage still starts this much under the floor (s): a session's blocks end on whole frames, not to the millisecond */
  stageSlack: 3,
  /**
   * The session's last stage (no further one would fit after it) takes up to `stageStretch` s of what only the close
   * would get — never past 4:00, always leaving the close `closeCalm` s beyond its least: a calmer last stage rather
   * than a long close (a 5-minute session at 3:00: 3:30 and a close of ~1:10, not 3:00 and 1:44).
   */
  stageStretch: 30,
  closeCalm: 20,
  /**
   * The Rytm row's focus dial: a push of a stage about this long (s, its lead-in included).  The default is the
   * dial's minimum on purpose: a round-15 save (a blessing after 1–3 circles) clamps to the minimum, so it reads as the
   * design, not as a surprising "30 s · Twój rytm".  A stage fits its pushes to its length around this: at 50 s a
   * 3-minute stage holds two pushes of about a minute, the heart word between and its blessing — rest about a third.
   */
  pushDial: { def: 50, min: 50, max: 90, step: 5 },
  /** each rest 1…restBreathsMax whole breaths (the Rytm row's rest dial; by design 2, the heart word on the breath) */
  restBreathsDef: 2,
  restBreathsMax: 6,
  /** a push of a stage is at least its lead-in and this long (s) */
  pushSighted: 12,
  /** the most pushes a stage holds: the descent (its stops at the mouth and the throat), the sun's, the others' */
  pushesMax: { descent: 3, sun: 4, other: 5 },
  /** the descent keeps both its stops while its pushes stay this long (s), one stop (the throat) below */
  descentPush: 30,
  /** the closing rest of a stage at most this share of its length (breaths are whole; the pushes keep the rest) */
  closingShare: 0.5,
  /**
   * The light of a stage (its pushes and the rests between) gets at least this share of its length; its closing rest
   * follows.  So an average player reaches the stage's goal at about 80 % of it, and a stage whose blessing is long
   * (circle 4's, 2-minute stages) lasts a little longer than its length — never past the time left before the close.
   */
  lightShare: 0.8,
  /**
   * The re-entry of a resumed session (Wejście do serca): its whole length (s, its rest included) by session length —
   * under 4 min, under 7.5, under 15, longer — shrunk toward its least (lead-in + `reentrySighted` + one breath; from
   * 10 minutes `reentryLong.min`) when that lets one more stage fit.  Its push walks quickly what comes before the
   * saved stage among the first three.
   */
  reentry: [[240, 25], [450, 40], [900, 60], [Infinity, 75]] as const,
  reentrySighted: 10,
  /** from 10 minutes the re-entry keeps at least this (s): a long session is not short of a calm way in */
  reentryLong: { from: 600, min: 45 },
  /** the re-entry's push: the descent's, the heart's and the field's shares of its light */
  reentryWeight: { descent: 0.45, heart: 0.2, field: 0.35 },
  /**
   * The close (every session's end): the return into the heart — a short push, at least its lead-in and
   * `closeSighted` s, needing `backNeed` held units (about 4 s of held focus at the threshold) — and the closing rest,
   * at least one breath ("Panie, zbierz to wszystko w moim sercu"; the Aaronic blessing after a whole way).  Spare
   * time before the finale becomes a quiet abiding (from `quietFrom` s: an abiding push and the heart word), more
   * breaths of the heart word, a longer return.
   */
  closeSighted: 8,
  backNeed: 2,
  quietFrom: 45,
  closePushMax: 35,
  /** the first stage of a session always starts, at least this long (s) even when less is left */
  firstMin: 30,
  /** the held-focus depth of an abiding push fills over this long (s) and fades over `deepFade` */
  deepSec: 20,
  deepFade: 40,
  /** the share of a ring's push that is the reach (the field widening to it); the rest kindles its lamps */
  reachShare: 0.3,
  /** the descent's places in order along the midline (kit/figure PLACE), and where its stops are */
  descentPlaces: ['brow', 'eyes', 'mouth', 'throat', 'heart'] as const,

  // ── the world ────────────────────────────────────────────────
  /** the radius of the field round the figure (ring 0) and of rings 1–4, in figure units from the heart */
  ringR: [0.86, 1.3, 1.78, 2.3, 2.86] as const,
  /** the Earth's radius (figure units); its limb runs under the figure's feet */
  earthR: 5.2,
  /** lamps per ring at a 3-minute stage (rings 1–4; ring 5 = the world's city clusters), scaled with its length */
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
  /** sessions over talkFrom s (45 and 60 minutes): a narrator's line comes back only after talkFresh s (round 24) */
  talkFrom: 1800,
  talkFresh: 600,
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

/** How many lamps a ring (1–5) holds for stages of this length (s): fewer at 2:00, more at 4:00 (round 16). */
export function lampsFor(ring: number, stageSec: number): number {
  const base = RULES.lamps[ring] ?? 0;
  if (!base) return 0;
  const k = Math.max(0.6, Math.min(1.4, 0.4 + 0.6 * (stageSec / 180)));
  return Math.max(ring === 1 ? 4 : 5, Math.round(base * k));
}

/** A stage length the lobby offers (s): the nearest of `stageLens`; anything unreadable gives the default. */
export function cleanStageSec(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : RULES.stageDef;
  return RULES.stageLens.reduce<number>((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), RULES.stageDef);
}
