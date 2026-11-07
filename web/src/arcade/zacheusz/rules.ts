/**
 * Every number of Zacheusz's rules in one place (sim.ts re-exports it): the run and its hands
 * (Super Mario Run's verbs), the creatures, the blocks, the bubbles, the finish palm, the style, the
 * band's light road, the fig orchard, the session's blocks and the meta.  Tuning moves a number here
 * and nowhere else; the tests read the same object.
 *
 * World units (u): x to the right, y up, the street's top at y = 0; Zacchaeus is a short man, about
 * 1 u tall.  A landscape screen shows about 16 u across, an upright phone about 9 u.
 */
export const RULES = {
  // ── the run ──────────────────────────────────────────────────
  /** the physics' fixed step (s): the same inputs give the same run on every device */
  step: 1 / 120,
  /** forward speed (u/s): running, on the light road, in the orchard, the ▶ dash */
  run: 5.2,
  roadRun: 6.2,
  walk: 2.9,
  dash: 8.6,
  dashSec: 0.9,
  /** how fast the speed reaches its target (u/s²) */
  accel: 18,
  /** Zacchaeus' box: half its width and its height (u) */
  halfW: 0.24,
  height: 0.95,
  /** a ledge this low is stepped up without a jump (u) */
  stepUp: 0.3,

  // ── the jump ─────────────────────────────────────────────────
  /** take-off speed (u/s); gravity while held (up to holdMax s) and otherwise (u/s²): tap ≈ 1.3 u, hold ≈ 2.8 u */
  jumpV: 10,
  gHold: 12,
  holdMax: 0.26,
  g: 38,
  maxFall: 16,
  /** a tap this early before landing still jumps, and this long after leaving a ledge (s) */
  buffer: 0.12,
  coyote: 0.09,
  /** the mid-air spin (a tap in the air, once a flight): a lift (u/s) and its style */
  spinV: 4.2,
  /** against a wall in the air: the slide's speed (u/s); a tap kicks off up and back */
  wallSlide: 2.4,
  wallV: 9.6,
  wallKick: 2.6,
  /** the hands reach a ledge this far above the feet: he pulls himself up (u); a pit's far rim only this close */
  mantle: 0.5,
  rimMantle: 0.25,
  /** pressed against a wall on the street this long (s): a neighbour gives him a leg-up */
  legUp: 1.4,
  legUpV: 14,
  /** an awning bounces him at this speed (u/s), more while held; a spring of light */
  bounceV: 11.2,
  bounceHeld: 13,
  springV: 17.5,
  /** the ▶ block's long jump: up and across (u/s) */
  longV: 9,
  longVx: 10.5,
  /** the ◀ block: he runs back this long (s) */
  backSec: 1.5,
  /** the pause stone: he waits for a tap, at most this long (s) */
  pauseMax: 8,

  // ── the creatures (geese and goats: bonked, never harmful) ───
  /** height and half width (u) */
  goose: { h: 0.62, hw: 0.3, vault: 7.4 },
  goat: { h: 0.92, hw: 0.4, vault: 9 },
  /** he vaults on his own when one is this close ahead on the ground (u) */
  vaultAhead: 0.5,
  /** a bonk from above: the bounce (u/s), more while held */
  bonkV: 10.6,
  bonkHeld: 13.2,
  /** a bonk's hit-stop (s) */
  bonkStop: 0.05,
  /** denarii for bonks in a row without touching the ground: 1, 2, 4, 4 … */
  bonkPay: [1, 2, 4],
  /** geese waddle this fast (u/s) back and forth over this much (u) */
  waddle: 0.6,
  waddleSpan: 1.2,

  // ── coins ────────────────────────────────────────────────────
  /** a denarius is picked within this distance of his middle (u) */
  pick: 0.62,
  /** coins this close in time (s) make a chain (rising notes) */
  chainGap: 0.9,
  /** a special denarius counts this much; five a level; a whole set in one run pays a bonus */
  specialValue: 3,
  specials: 5,
  setBonus: 10,

  // ── the bubble (Mario's) and the rope ────────────────────────
  /** below this (u) he has fallen */
  fallY: -2.2,
  /** bubbles at a level's start, and at most */
  bubbles: 2,
  bubbleMax: 5,
  /** a bubble rewinds this far back in time (s); its float back (s); it pops by itself after (s) */
  rewind: 3,
  floatSec: 1.1,
  autoPop: 2.6,
  /** history kept for the rewind (s) and its sampling (s) */
  history: 6,
  historyEvery: 0.05,
  /** without a bubble the neighbour's rope pulls him out on the far rim (s) */
  ropeSec: 1.1,

  // ── the finish (the palm, or the sycamore at a world's end) ──
  /** where he grabs the trunk (feet, u) for bands 1..5 */
  bandAt: [0, 1, 2, 3, 4.2],
  bandPay: [1, 3, 5, 8, 12],
  /** the slide down and the walk-off (s), then the tally card (s), then the next level */
  slideSec: 1.2,
  tallySec: 3.4,
  /** a world's story card holds (s) — a tap skips it */
  storySec: 5,

  // ── style (Toad Rally's cheers) ──────────────────────────────
  /** points per trick; points in one flight multiply by the chain; denarii at the tally per point */
  style: { spin: 10, vaultSpin: 25, wall: 20, bonk: 15, chain: 10, long: 15, spring: 10, top: 40 },
  styleToCoins: 0.04,

  // ── the band: the light road (push) ──────────────────────────
  /** its height over the street (u) */
  lane: 3.6,
  /** the lead-in before the road answers (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the road's reach ahead of him (u) for a level: minReach + level × reachSpan; it builds only above the threshold */
  minReach: 2,
  reachSpan: 12,
  /** one plank's length (u); a light coin every this far (u); a spring every this far under the road (u) */
  plank: 1.25,
  coinEvery: 1.6,
  springEvery: 8,
  /** the first spring stands this far ahead (u) */
  springAhead: 5,
  /** a plank's last moments: it fades this long after he passes it (s) */
  plankFade: 2.5,
  /** a held focus this long (s), Mendi / HALO, is a "Widok": a burst of light coins on the road */
  view: { fnirs: 6, eeg: 4 },
  viewAgain: 8,
  viewMax: 3,
  viewCoins: 10,

  // ── the fig orchard (rest) ───────────────────────────────────
  /** ripeness R: dR/dt = gain × calm − leak, after the lead-in (s), Mendi / HALO */
  rGain: 0.08,
  rLeak: 0.012,
  rLeadIn: { fnirs: 4, eeg: 2 },
  /** the neutral floor of R for a block with too few reliable seconds */
  rFloor: 0.4,
  /** a tree every this far (u); five figs; the k-th ripe once R ≥ figAt[k]; a full tree gives a bubble */
  treeEvery: 7,
  figAt: [0.12, 0.28, 0.45, 0.62, 0.8],
  /** the orchard's gate stands at least this far ahead of him (u); the search for a safe cut reaches this far (u) */
  cutAhead: 7,
  cutSearch: 40,
  /** a passed rest: a basket of figs; a passed push: a shower of light coins */
  basketPay: 8,
  passPay: 6,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the blind block (Tłum): its last 15 s of focus become this much road at most (u) */
  revealMax: 18,

  // ── the session ──────────────────────────────────────────────
  push: [24, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 22 in 3, 8 in a 40 s test */
  warm: { long: 30, short: 22, test: 8 },
  /** canStop() waits at most this long (s) for a bubble or a finish to land */
  settle: 4,
  blindEvery: 4,
  blindFrom: 3,
  /** hold this long (s) counts as a long view (the closing verse) */
  longHold: 12,

  // ── the meta ─────────────────────────────────────────────────
  /** twelve households: the all-time denarii at which each is restored */
  homes: [40, 110, 200, 320, 460, 620, 800, 1000, 1220, 1460, 1720, 2000],
  missionPay: 15,
  giftPay: 20,
  /** three worlds of four levels */
  worlds: 3,
  perWorld: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
