/**
 * Every number of Rzeki żywej wody's rules in one place (DESIGN.md §13.14): the light at a station (what focus
 * drives), the fill that opens its glass, the flow to the next station, the abiding of rest (the breath guide, the
 * drops of living water), the blocks, the voice and the cards.  Tuning moves a number here and nowhere else; the
 * tests read the same object.
 *
 * A station's `fill` runs 0 → 1: its glass opens piece by piece, and at 1 the light flows on.  Since the
 * founder's word of 2026-11-17 the glass loads **only from real concentration** — in a sighted push past its
 * lead-in, with a reliable signal, while the focus is above the threshold (`frame.focused`) — and more slowly than
 * before: about 30 s of focused time a station at the threshold, about 20 s at a high level.  Nothing fills in
 * rest, the warm-up, the finale, without a signal, below the threshold, or from taps; what is gained stays.
 */
export const RULES = {
  // ── the light (what focus drives) ────────────────────────────
  /** the light drawn while the brain drives nothing (the warm-up, the lead-in, a blind block, no signal) */
  baseLight: 0.45,
  /** the light follows its target with this time constant (s) */
  lightTau: 0.8,
  /** the light drawn in rest (the window glows steadily; calm shows in the breath and the aura instead) */
  restLight: 0.3,

  // ── the fill (the glass opening) ─────────────────────────────
  /**
   * While focused in a sighted push: fillFocus × (focusLo + focusK × clamp((level − 0.5) / 0.5)) ×
   * (1 + holdK × min(1, hold / holdFull)) per second — sustained concentration loads faster (the founder's rule).
   */
  fillFocus: 0.036,
  focusLo: 0.6,
  focusK: 0.8,
  holdK: 0.5,
  holdFull: 12,
  /** focus while the light rests in a full station or flows on loads the next station, up to this much */
  preMax: 0.25,
  /** the share of a rose window that is its inner ring (it opens first; then the outer petals) */
  innerShare: 0.3,
  /** a blind block's unseen light is shown at its end over this long (s) */
  revealSec: 1.6,
  /** light gathered in the dark past the station's full carries into the next station, up to this much */
  blindCarry: 0.6,

  // ── the way ──────────────────────────────────────────────────
  /** a full station holds a moment in its light, then the stream flows to the next station (s) */
  holdSec: 0.7,
  flowSec: 3,
  /** after the last station of a way: the whole figure in light before the closing card (s) */
  wholeSec: 2.4,
  /** the light comes down from the open heaven (or up from the pool) at the start of a way (s) */
  heavenSec: 2.2,
  /** the camera eases between its framings with this time constant (s) */
  cameraTau: 0.9,

  // ── the hands ────────────────────────────────────────────────
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
  /** in a sighted push while the light loads: dropPush × (0.5 + level) per second (nothing while unfocused) */
  dropPush: 1.6,
  /** in rest with a signal: dropRest × (restDropLo + calm) × (1 + litK × lit share) per second */
  dropRest: 1.6,
  restDropLo: 0.4,
  litK: 0.6,
  /** a station lit (the light flows on), a whole way (down or up), a block judged well, a blind block (× its share) */
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
  /** the light loading this long (s) before the narrator says so */
  goodSec: 5,
  /** a sighted push this long past its lead-in without the light loading: the narrator says how it loads (once a session) */
  waitSec: 9,
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

/**
 * The founder's fill rule: how fast a station's light loads per second for a focus frame — only while focused,
 * faster above the threshold and faster again as a focused stretch is held.  (The sim calls it only in a sighted
 * push past its lead-in with a reliable signal.)
 */
export function focusRate(level: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = Math.max(0, Math.min(1, (level - 0.5) / 0.5));
  return R.fillFocus * (R.focusLo + R.focusK * above) * (1 + R.holdK * Math.min(1, Math.max(0, hold) / R.holdFull));
}
