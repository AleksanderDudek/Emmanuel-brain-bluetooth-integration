/**
 * Every number of Dolina's rules in one place (sim.ts re-exports it): the run, the hands (slash,
 * jump, slide, the lamp's burst), the shadows of the eras, the guardians, the lamp (the live gauge),
 * the Świt (hold), the oil and the meadow (rest), the blocks and the meta.  Tuning moves a number
 * here and nowhere else; the tests read the same object.
 *
 * World units (u, about a metre): x to the right along the valley, y up, the road's top at y = 0.
 * The pilgrim is about 1 u tall; a landscape screen shows about 16 u, an upright phone about 10 u.
 * The headline is metres: one u is one metre of the valley.
 */
export const RULES = {
  // ── the run ──────────────────────────────────────────────────
  /** forward speed (u/s): running in the dark, the warm-up's easier pace, the meadow's walk, beside a guardian, toward the dawn */
  run: 5.4,
  warmRun: 4.4,
  walk: 2.3,
  fight: 1.3,
  dawnRun: 6.2,
  /** how fast the speed reaches its target (s) */
  speedTau: 0.35,
  /** each lap of the valley (after the dawn gate) runs this much quicker (u/s) */
  lapRun: 0.45,
  /** the pilgrim's box: half its width, standing and sliding height (u) */
  halfW: 0.24,
  height: 1.05,
  slideHeight: 0.5,

  // ── the jump and the slide (touch: anything under 2 s) ───────
  /** take-off speed (u/s) and gravity (u/s²): apex ≈ 1.5 u, ≈ 0.63 s in the air */
  jumpV: 9.6,
  g: 30,
  /** a swipe down in the air pulls him down this fast (u/s) */
  dropV: 14,
  /** a jump this early before landing still jumps, and this long after leaving the ground (s) */
  buffer: 0.14,
  coyote: 0.09,
  /** the slide lasts this long (s) */
  slideSec: 0.62,

  // ── the slash ────────────────────────────────────────────────
  /** the sword's arc: its reach ahead (u) at the base, its extra at the top of the level, per sword upgrade; how high it covers */
  swordReach: 1.4,
  swordExtra: 0.9,
  swordStep: 0.14,
  swordHigh: 2.3,
  /** the arc's whole swing, the part of it that hits (s), and the earliest next slash (s) */
  slashSec: 0.25,
  slashActive: 0.14,
  slashGap: 0.17,
  /** hit-stop: the world holds its breath this long on a hit, a kill, a guardian's hit and its fall (s) */
  stopHit: 0.035,
  stopKill: 0.06,
  stopGuard: 0.08,
  stopBeaten: 0.3,
  /** the combo: kills without a hit taken; it also lapses after this long without a kill (s); sparks ×2 from 8, ×3 from 20 */
  comboLapse: 3.2,
  comboAt: [8, 20],

  // ── the lamp's burst (a tap on the left third) ───────────────
  burstCd: 3,
  /** it stuns the nearest shadow this close ahead (u) for this long (s), and clears projectiles this close (u) */
  burstReach: 5.5,
  stunSec: 1.6,
  burstClear: 3.2,
  /** on a guardian: the next attack waits this much longer (s) */
  burstDelay: 1,

  // ── the lamp: the live gauge (Światło) ───────────────────────
  /** the steady small flame outside push blocks (u) */
  flame: 1.6,
  /** in a sighted push block past the lead-in: reach = lampMin + level × lampExtra (u); per lamp upgrade */
  lampMin: 1.9,
  lampExtra: 4.6,
  lampStep: 0.35,
  /** how fast the drawn and acting reach follows its target (s) */
  lampTau: 0.4,
  /** inside a live light the shadows move at this share of their speed */
  lightSlow: 0.55,
  /** light damage per second at the top of the level (hp/s), in proportion to (level − 0.5) / 0.5 */
  lightDps: 1.4,
  /** a squire's soot shield cracks while the level stands above the threshold in the light (per s; cracked at 1) */
  crackRate: 1.2,
  /** a guardian in a live light: its clock slows to this at the top of the level, and it burns this much (hp/s) */
  guardSlow: 0.72,
  guardDps: 0.22,
  /** the lead-in before the band moves the lamp (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── the Świt (hold) ──────────────────────────────────────────
  /** a held focus this long (s) fills it; again after as long once more; at most dawnMax a block; per Świt upgrade × */
  dawnHold: { fnirs: 5, eeg: 3 },
  dawnMax: 3,
  dawnFast: 0.88,
  /** on a guardian a Świt opens the weak point this long (s) */
  dawnOpen: 3,
  /** the blind block's Świt: the light's flash (s) */
  flashSec: 1.4,

  // ── the oil (health) and grace ───────────────────────────────
  /** oil lost to a hit of each kind of harm; per oil upgrade the losses shrink by this share */
  harm: { shadow: 0.12, brick: 0.1, crow: 0.1, pling: 0.07, squire: 0.14, scroll: 0.06, pit: 0.12, beam: 0.1, guard: 0.15 },
  oilStep: 0.1,
  /** after a hit nothing hurts for this long (s); a stumble slows the run this long (s) */
  safeSec: 0.9,
  stumbleSec: 0.45,
  /** a fall into a pit: the climb out on the far rim takes this long (s) */
  pitSec: 0.85,
  /** the scroll's pull: the run held back this long (s) */
  pullSec: 1.4,
  /** no oil: he falls and rises at a lantern post (s), with half oil; the shadows this close step back (u) */
  fallSec: 2,
  riseOil: 0.5,
  clearNear: 5,

  // ── the meadow (Pastwisko: rest) ─────────────────────────────
  /** calm refills the oil (per s at calm 1) after the lead-in, and drops of oil fall: d(drops)/dt = dropGain × calm, at most dropMax a rest */
  oilGain: 0.03,
  dropGain: 0.55,
  dropMax: 12,
  dropOil: 0.04,
  dropSparks: 2,
  restLead: { fnirs: 4, eeg: 2 },
  /** a passed meadow: a full flask and sparks; a passed push block: sparks */
  restBonus: 10,
  pushBonus: 8,

  // ── the road ahead ───────────────────────────────────────────
  /** the road is laid this far ahead of him (u) and forgotten this far behind (u) */
  ahead: 22,
  behind: 8,
  /** gaps between things on the road (u): the start of a session (s) and its end; the warm-up's */
  gap: [5.6, 3.6],
  /** shares of what comes: a shadow of the era, a pit, a beam */
  mix: { shadow: 0.62, pit: 0.2, beam: 0.18 },
  /** a pit's width (u) and a beam's lower and upper edge (u) */
  pitW: [1.5, 2.3],
  beamLow: 0.62,
  beamTop: 1.7,
  /** a lantern post every this far (u) */
  postEvery: 26,
  /** the first thing of a push block comes this far ahead (u) */
  firstAhead: 9,

  // ── the guardians ────────────────────────────────────────────
  /** a guardian stands this far ahead of him (u, its front edge) and comes in from this far */
  guardGap: 1.15,
  guardEnter: 9,
  /** in a guardian's block it comes at this share of the block (never before the lead-in + 1 s, never later than 9 s before the end) */
  guardAt: 0.3,
  guardLate: 9,
  /** a guardian's light (hits) by era; sessions under 70 s; × per lap */
  guardHp: [8, 10, 12],
  guardShort: 0.6,
  guardLap: 0.25,
  /** at this share of its light it grows angrier: its clock runs this much faster */
  angryAt: 0.5,
  angry: 1.3,
  /** the knight's parry window before his blow lands (s) */
  parry: 0.3,
  /** each move of a guardian: its telegraph and its whole length (s, on the guardian's clock) */
  moves: {
    rain: { tele: 0.85, len: 1.05 },
    roll: { tele: 0.6, len: 0.95 },
    strike: { tele: 0.7, len: 0.95 },
    heavy: { tele: 0.9, len: 1.35 },
    plings: { tele: 0.5, len: 1.9 },
    sweep: { tele: 0.85, len: 1.35 },
    open: { tele: 0, len: 2.6 },
  },
  /** a falling brick starts this high (u) and falls this fast (u/s); a rolling one rolls this fast (u/s) */
  rainY: 4.4,
  rainV: 6.5,
  rollV: 4.2,
  /** the screen's notifications drift toward him this fast (u/s) */
  plingV: 1.1,
  /** the screen's beam and the knight's heavy blow hurt this long (s) */
  sweepSec: 0.3,
  /** a thrown brick flies this long (s); the thrower throws every this often (s), from this far (u) */
  throwSec: 0.9,
  throwEvery: 2.2,
  throwFrom: [2.6, 8],
  /** a crow dives when it is this close (u), down to this height (u), over this long (s) */
  diveAt: 3.4,
  diveY: 0.95,
  diveSec: 0.45,
  /** a notification pops up when he is this close (u) */
  popAt: 3.6,
  /** a dodge this close (u) is a near miss */
  nearMiss: 0.3,
  /** sparks for a guardian */
  guardSparks: 25,

  // ── the session ──────────────────────────────────────────────
  /** Światło and Pastwisko: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4],
  rest: [20, 3],
  minBlock: 12,
  telegraph: 4,
  /** the run toward the dawn at the end (s): sessions of 2 min and more / shorter */
  finale: { long: 8, short: 4 },
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 22 in 3, 8 in a 40 s test */
  warm: { long: 30, short: 22, test: 8 },
  /** the opening story card holds the first shadow back this long (s) */
  storySec: 6,
  /** canStop() waits at most this long after time is up for a slash or a fall to land (s) */
  settle: 2,
  /** Światło blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** a hold this long (s) counts as a long push with a wide lamp (the closing verse) */
  longHold: 12,

  // ── the meta ─────────────────────────────────────────────────
  /** the pilgrim's looks by all sparks ever: cloak, traveller, lamplighter, keeper of the dawn */
  looks: [0, 120, 400, 1000],
  /** upgrades: price of level L+1 = base × growth^L; their top levels */
  priceBase: 40,
  priceGrowth: 1.6,
  upMax: { sword: 4, lamp: 4, oil: 4, boots: 4, dawn: 3 },
  /** boots: run speed per level (u/s) */
  bootsStep: 0.25,
  /** the day's gift (sparks, the same for everyone who comes) */
  dayGift: 15,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
