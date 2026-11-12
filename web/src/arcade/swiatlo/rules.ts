/**
 * Every number of Światło ciała's rules in one place: the scan (the band's pace and light), the loops
 * (how fast an organ returns to its range, what the hands add), the rest (the breath guide, the
 * settling), the light gathered (lux), the blocks, the voice and the cards.  Tuning moves a number here
 * and nowhere else; the tests read the same object.
 *
 * The scan runs on the figure's own axis: v = 0 at the crown, 1 at the soles.  A loop's state is its
 * deviation `d` from the set point in half-ranges: |d| ≤ 1 is inside the healthy range, `balance` (a
 * little inside it) counts as settled.  The physiology (set points, ranges, what perturbs them) lives in
 * content.ts with its sources; here is only how fast the picture moves — compressed, as the game says.
 */
export const RULES = {
  // ── the scan ─────────────────────────────────────────────────
  /** the band's travel between organs (v per second): × (travelLo + travelHi × light) in a push block */
  travel: 0.05,
  travelLo: 0.6,
  travelHi: 1.4,
  /** the travel in the warm-up and the finale (× travel) */
  travelFree: 0.8,
  /** the band starts at the crown and the scan ends past the soles */
  startV: 0.012,
  endV: 0.985,
  /** after an organ settles the band lingers this long (s); a tap on its panel adds `stay`, up to `stayMax` */
  linger: 1.6,
  stay: 2.5,
  stayMax: 6,
  /** …and longer when its Wiedza card has just opened (stay and read); the card closes this soon after the next organ arrives */
  lingerCard: 3.4,
  cardAfterArrive: 0.9,
  /** the light sweeping back up the body when a scan is whole (s) */
  sweepSec: 2.6,

  // ── the light (what focus drives) ────────────────────────────
  /** the band's light without the brain (warm-up, the lead-in, a blind block, no signal): just under the threshold */
  baseLight: 0.45,
  /** the light follows the target with this time constant (s) */
  lightTau: 0.8,
  /** the light drawn in a rest block (the band dims; calm shows in the glow instead) */
  restLight: 0.22,
  /** the light counts as gold (above the threshold) from here */
  gold: 0.5,

  // ── the loops ────────────────────────────────────────────────
  /** the body's own return rate (1/s): × (1 + lightK × light) while the band is on the organ */
  k0: 0.07,
  lightK: 1.6,
  /** in a rest block the organ still settles: k0 × (restLo + restHi × calm) */
  restLo: 0.6,
  restHi: 1.0,
  /** a loop counts as settled inside |d| ≤ balance, held this long (s) */
  balance: 0.8,
  holdSec: 1.0,
  /** the start of a loop: |d0| in [kickLo, kickHi] half-ranges outside the set point (content.ts gives the side) */
  kickLo: 2.0,
  kickHi: 2.4,
  /** a little life in the value while it is far from home (half-ranges) */
  wobble: 0.05,
  /** one help (a tap): d × (1 − tapK × effect); the effect falls with the taps of the last seconds */
  tapK: 0.055,
  /** the "fervour" a tap adds and how fast it fades (1/s): effect = 1 / (1 + fervourK × fervour) */
  fervourAdd: 1,
  fervourFade: 1,
  fervourK: 0.5,
  /** the heart's task: a tap within this share of a beat's period around the beat is "in rhythm" (× rhythmK) */
  beatWindow: 0.24,
  rhythmK: 2,
  offBeatK: 0.5,
  /** the lungs' task: CO₂ bubbles in the alveoli (at most), new ones every bubbleSec while the loop is out */
  bubbles: 7,
  bubbleSec: 0.45,
  /** a rating: golden when settled within goldSec with the light gold at least goldShare of the time; bright within brightSec */
  goldSec: 9,
  goldShare: 0.6,
  brightSec: 13,

  // ── the rest (the vagus' rest) ───────────────────────────────
  /** the breath guide: in for 4 s, out for 6 s — six breaths a minute */
  inhale: 4,
  exhale: 6,
  /** a tap within this many seconds of a turn of the breath is "with the breath" */
  breathWindow: 0.7,
  /** the typical heart drawn without a reading (bpm): calm slows it to typicalRest; the breath moves it ± rsa */
  typical: 70,
  typicalRest: 64,
  rsa: 4,

  // ── the light gathered (lux, the headline) ───────────────────
  /** while the band shines on the organ in a push block: luxBand × (0.5 + light) a second */
  luxBand: 3,
  /** in the warm-up and the finale: a gentle flow */
  luxFree: 1.6,
  /** in a rest block: luxRest × (0.3 + calm) × (1 + lit organs / 9) a second */
  luxRest: 2,
  /** an organ settled: soft / bright / golden, × the depth (1, 1.25, 1.5), × 2 for the day's organ */
  luxOrgan: [24, 36, 50] as readonly number[],
  depthK: [1, 1.25, 1.5] as readonly number[],
  dayK: 2,
  /** a whole scan */
  luxScan: 100,
  /** a tap in rhythm (heart, breath) */
  luxRhythm: 2,
  /** a block judged well (its end) */
  luxBlock: 30,
  /** a blind block: its share on the asked side × this */
  luxBlind: 100,

  // ── the session ──────────────────────────────────────────────
  /** the lead-in before the brain acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** push and rest: nominal length ± jitter (s) — rest a little longer: a calm game, led by rest */
  push: [24, 3] as readonly [number, number],
  rest: [26, 3] as readonly [number, number],
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the voice waits it out */
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
  /** the band's light above the threshold this long (s) before the voice cheers it */
  goodSec: 5,

  // ── cards and the voice ──────────────────────────────────────
  /** the opening story card: closes itself after openSec, a tap closes it after 0.6 s */
  openSec: 9,
  storySec: 5,
  tapAfter: 0.6,
  /** a Wiedza card stays this long (s) unless tapped */
  cardSec: 6.5,
  /** the voice: each line 2–4 s by its length, a pause between two */
  talkMin: 2,
  talkMax: 4,
  talkGap: 2.4,
  /** the first-time explanations (coach marks): one at a time, this far apart (s) */
  hintGap: 1.2,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The breath guide's cycle (s): in + out. */
export const BREATH = RULES.inhale + RULES.exhale;
