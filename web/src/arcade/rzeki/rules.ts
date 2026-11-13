/**
 * Every number of Rzeki żywej wody's rules in one place (DESIGN.md §13.14): the light at a place (what
 * focus drives), the fill that unfolds the rose window, the flow to the next place, the abiding of rest
 * (the breath guide, the drops of living water), the hands, the blocks, the voice and the cards.  Tuning
 * moves a number here and nowhere else; the tests read the same object.
 *
 * A place's `fill` runs 0 → 1: the rose window unfolds with it petal by petal, and at 1 the light flows on.
 * The `light` is the place's live brightness, 0..1 with 0.5 at the threshold: the gauge.
 */
export const RULES = {
  // ── the light (what focus drives) ────────────────────────────
  /** the light without the brain (the warm-up, the lead-in, a blind block, no signal): just under the threshold */
  baseLight: 0.45,
  /** the light follows its target with this time constant (s) */
  lightTau: 0.8,
  /** the light drawn in rest (the orb glows steadily; calm shows in the breath and the aura instead) */
  restLight: 0.3,
  /** the light counts as gold (above the threshold) from here */
  gold: 0.5,

  // ── the fill (the rose window unfolding) ─────────────────────
  /** in a push block: fillBase + fillFocus × light per second (≈ 15 s of push at the threshold) */
  fillBase: 0.022,
  fillFocus: 0.095,
  /** in the warm-up and the finale (no brain): a gentle pace */
  fillFree: 0.05,
  /** in rest (abiding): fillRest × (restLo + (1 − restLo) × calm) per second — the light still deepens a little */
  fillRest: 0.018,
  restLo: 0.3,
  /** the share of the rose window that is its inner ring (it unfolds first; then the outer petals) */
  innerShare: 0.3,
  /** a blind block's unseen light is shown at its end over this long (s) */
  revealSec: 1.6,
  /** light gathered in the dark past the place's full carries into the next place, up to this much */
  blindCarry: 0.6,

  // ── the way ──────────────────────────────────────────────────
  /** the light arrives at a place (the prayer fades in; the fill already runs) (s) */
  arriveSec: 1.4,
  /** a full place holds a moment in its light, then the stream flows to the next place (s) */
  holdSec: 0.7,
  flowSec: 3,
  /** after the last place of a way: the whole body in light before the closing card (s) */
  wholeSec: 2.4,
  /** the light comes down from the open heaven to the crown at the start of a descent (s) */
  heavenSec: 2.2,

  // ── the hands ────────────────────────────────────────────────
  /** a tap stays with the place: + tap × effect of fill; effect = 1 / (1 + fervourK × fervour) */
  tap: 0.02,
  fervourK: 0.6,
  /** each tap adds 1 to the fervour, which fades exponentially with this time constant (s) */
  fervourTau: 1.5,
  /** the prayer re-shown by a tap glows for this long (s) */
  reshowSec: 2.4,

  // ── rest (abiding) ───────────────────────────────────────────
  /** the breath guide: in for 4 s, out for 6 s — six breaths a minute */
  inhale: 4,
  exhale: 6,
  /** abiding counts while calm is at least this (reliable signal, in a rest block) */
  abideCalm: 0.5,

  // ── drops of living water (the headline) ─────────────────────
  /** in the warm-up, the finale and between blocks (per second) */
  dropFree: 1.2,
  /** in a push block: dropPush × (0.5 + light) per second */
  dropPush: 1.6,
  /** in rest: dropRest × (restDropLo + calm) × (1 + litK × lit places / 7) per second */
  dropRest: 1.6,
  restDropLo: 0.4,
  litK: 0.6,
  /** a place lit (the light flows on), a whole way (down or up), a block judged well, a blind block (× its share) */
  dropPlace: 15,
  dropWay: 60,
  dropBlock: 20,
  dropBlind: 60,
  /** the rest's drops are counted aloud (a floating "+n") every this many seconds */
  restTick: 3,
  /** the two rivers from the pool reach the edges of the picture at this many drops in a session */
  riverFull: 700,

  // ── the session ──────────────────────────────────────────────
  /** the lead-in before the brain acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** push and rest: nominal length ± jitter (s) — rest a little longer: a meditation, led by rest */
  push: [24, 3] as readonly [number, number],
  rest: [26, 3] as readonly [number, number],
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
  /** the light above the threshold this long (s) before the narrator says so */
  goodSec: 5,
  /** the push tasks: every repeatEvery-th push block asks to repeat the prayer word by word */
  repeatEvery: 3,

  // ── cards and the voice ──────────────────────────────────────
  /** the opening card's two pages close themselves after pageSec each; a tap turns a page after tapAfter */
  pageSec: 9,
  /** a closing card (after a way) stays this long unless tapped */
  closeSec: 8,
  tapAfter: 0.6,
  /** the narrator: each line 2–4 s by its length, a pause between two */
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.6,
  /** the first-time explanations (coach marks): one at a time, this far apart (s) */
  hintGap: 1.2,
  /** own words: at most this many characters */
  ownMax: 120,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The breath guide's cycle (s): in + out. */
export const BREATH = RULES.inhale + RULES.exhale;
