/**
 * Every number of Arka (v2, after Arrows – Puzzle Escape) in one place: the deck and its animals,
 * the slide and the bump, the hearts, the stars, the dove's help, the flood's mist (the push block's
 * sight), the rainbow (the rest block's calm), the blocks and the companion.  Tuning moves a number
 * here and nowhere else; the tests read the same object.
 *
 * Board units are cells; directions are 0 N, 1 E, 2 S, 3 W (the painter turns an animal by them).
 */
export const RULES = {
  // ── the slide and the bump ───────────────────────────────────
  /** an animal sent out slides this many cells a second (its file follows the leader's path) */
  slide: 15,
  /** a bump: the leader runs to the blocker and springs back (s) */
  bumpSec: 0.34,
  /** tapping the same blocked animal again within this long costs no second heart (s) */
  bumpGrace: 1.4,
  /** the pause the world takes on a bump (hit-stop, s) */
  hitStop: 0.07,

  // ── the level ────────────────────────────────────────────────
  hearts: 3,
  /** the board drops in (input waits this long, s) */
  dropSec: 0.45,
  /** the stars card after a cleared board (s; a tap skips it after 0.6 s) */
  clearSec: 2.3,
  /** no hearts left: Noah leads everyone back and the board starts again after this long (s) */
  restartSec: 1.5,
  /** par time of a level: base + per animal (s); ★★★ needs no bump, no dove and the par */
  parBase: 8,
  parPer: 2.4,

  // ── the dove (the hint) ──────────────────────────────────────
  /** Space or the dove button: the dove shows a free animal and sends it; then it rests this long (s) */
  doveRest: 4,
  /** an idle player gets the dove's button pointed out after this long (s) */
  idleHint: 7,
  /** nothing on the board can move (a turning goat stuck): the goats look round every this long (s) */
  stuckTurn: 1.6,

  // ── the mist (push: sight) ───────────────────────────────────
  /** the clear circle's radius at no focus and at full focus, in shares of the farthest corner's distance from the door */
  sightMin: 0.3,
  sightMax: 1.06,
  /** how fast the circle follows the focus (s); the kit already smooths the level over ~2 s */
  sightTau: 0.6,
  /** the mist rolls in and out over this long (s) */
  mistFade: 1.4,

  // ── the rainbow (rest: calm) ─────────────────────────────────
  /** at full calm the rainbow fills in this many seconds (half as fast at calm 0.75; nothing at or under 0.5) */
  rainbowSec: 9,
  /** at most this many rainbows in one rest block */
  rainbowMax: 2,
  /** a safe move the rainbow's end shows stays lit this long (s) */
  shineSec: 7,

  // ── the session ──────────────────────────────────────────────
  /** Mgła and Tęcza blocks: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4] as const,
  rest: [22, 3] as const,
  minBlock: 12,
  telegraph: 4,
  finale: 5,
  /** the first-ever session's warm-up (s): 34 in 5 and 10 min, 22 in 3, 8 in a short test */
  warm: { long: 34, short: 22, test: 8 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 3,
  /** the lead-in before the band moves the mist or the rainbow (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 } as const,
  /** Mgła blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,

  // ── the companion ────────────────────────────────────────────
  /** a line of the raven stays 2–4 s by its length; at most one at a time, then a breath (s) */
  sayGap: 1.2,
  /** the same kind of remark again only after this long (s) */
  sayEvery: 9,
} as const;

export type Dir = 0 | 1 | 2 | 3;
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];

/** Stars for a cleared board: ★★★ no bump, no dove, within par; ★★ at most one bump; ★ otherwise. */
export function starsFor(bumps: number, doves: number, sec: number, par: number): 1 | 2 | 3 {
  if (bumps === 0 && doves === 0 && sec <= par) return 3;
  return bumps <= 1 ? 2 : 1;
}

/** A level's par time (s) for `animals` pieces on the board. */
export const parFor = (animals: number): number => Math.round(RULES.parBase + RULES.parPer * animals);

/** The clear circle's radius as a share of the farthest corner: `m` 0..1 (0.5 = the threshold). */
export const sightShare = (m: number): number => RULES.sightMin + (RULES.sightMax - RULES.sightMin) * Math.max(0, Math.min(1, m));
