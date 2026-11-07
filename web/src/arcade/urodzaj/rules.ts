/**
 * Every number of Urodzaj's rules in one place (sim.ts and physics.ts read it; the tests read the same
 * object).  Tuning moves a number here and nowhere else.
 *
 * Lengths are W (the basket's inner width), y points up and the basket's floor is y = 0; times in
 * seconds.  The basket is a box `BASKET.rim` W tall; its rim is the overflow line (Suika's top line).
 */
export const RULES = {
  // ── the dropper (Feliks the sparrow carries the next fruit along the twine) ──
  /** a press eases the aim to the finger over this long (s) */
  aimSnap: 0.05,
  /** ← → move the aim this fast (W/s), ramping up to keyMax while held */
  keySpeed: 0.55,
  keyMax: 1.5,
  keyRamp: 0.5,
  /** after a drop the next fruit hangs after this long (s); a drop asked in the last `buffer` s waits for it */
  cooldown: 0.5,
  buffer: 0.25,
  /** the hanging fruit sways ±sway W at swayHz, so no two drops land dead centre on each other (a tower of circles would balance) */
  sway: 0.006,
  swayHz: 1.3,

  // ── merging and points (Suika's ladder) ──
  /** a merge within this long of the previous one is a link of the same chain (s) */
  chainWindow: 0.7,
  /** the chain's multiplier: ×(1 + chainStep · link), at most chainCap */
  chainStep: 0.25,
  chainCap: 3,
  /** two great clusters carried off on the pole: their bonus */
  poleBonus: 100,
  /** hit-stop on a merge into tier ≥ stopTier, and on the wind and the pole (s) */
  stopTier: 7,
  stopSmall: 0.05,
  stopBig: 0.09,

  // ── the overflow line (the rim) ──
  /** a fruit over the rim this long (s, it builds while any is over and drains at half speed) ends the basket */
  overflowSec: 2,
  /** a fruit younger than this (s) or still falling never counts as over */
  overExempt: 0.9,
  overSpeed: 0.35,
  /** the rim warns when the heap's top is this close below it (W) */
  warnGap: 0.12,
  /** a basket change: the tally shows for `tally` s, then the new basket slides in over `slide` s */
  tally: 2.4,
  slide: 0.9,
  /** stars for a basket's score */
  stars: [150, 500, 1200] as readonly number[],

  // ── the block plan ──
  push: [24, 4] as readonly [number, number],
  rest: [24, 3] as readonly [number, number],
  warm: { test: 6, short: 20, long: 30 },
  minBlock: 12,
  telegraph: 4,
  finale: { short: 6, long: 10 },
  /** blind pushes: every 4th from the 3rd session, never a session's first */
  blindFrom: 3,
  blindEvery: 4,
  /** the lead-in before the band acts in a block (s): Mendi, HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** a block with fewer reliable seconds than this gets no verdict */
  minReliable: 6,

  // ── Wiatr żniwny (push: the charge) ──
  /** the wind's strength follows the level with this time constant (s); neutral without signal */
  windTau: 0.8,
  windNeutral: 0.4,
  /** the charge fills at chargeRate · clamp((w − chargeFrom) / chargeSpan) per second */
  chargeFrom: 0.4,
  chargeSpan: 0.4,
  chargeRate: 0.115,
  /** a passed push block adds this much charge at its end */
  passCharge: 0.35,
  /** a blind block's charge may build up to this (each full 1 is a wind at the reveal) */
  blindCap: 2,
  /** the wind: the gathering wind-up (s), then the shake (s), its sway (W/s²) and frequency (Hz) */
  windUp: 0.9,
  shakeSec: 1.3,
  shakeAcc: 2.6,
  shakeHz: 3.2,
  /** during the shake: friction and gravity scales (the heap settles) */
  shakeMu: 0.45,
  shakeG: 0.75,
  /** then the wind pulls alike neighbours together: gap up to windGap × their radius, at most windPairs */
  windGap: 0.9,
  windPairs: 6,
  windPull: 0.35,
  windClear: 0.8,

  // ── Pokłosie (rest: the gleaners) ──
  /** the gleaners' step fills at gleanRate · calm per second; each full step takes one small fruit */
  gleanRate: 0.36,
  /** fruit up to this tier are theirs (the smallest first) */
  gleanTier: 3,
  /** a fruit carried to the table: its flight (s), its points ×gleanMult of its tier's own */
  gleanFlight: 0.8,
  gleanMult: 2,
  /** a passed rest block: the gleaners take this many more */
  passGlean: 2,
  /** the lead-in of a rest block (s): Mendi, HALO */
  restLead: { fnirs: 4, eeg: 2 },

  // ── Feliks talks ──
  talkMin: 2,
  talkMax: 4,
  talkGap: 1.2,
  /** the warm-up's coach marks: an idle player gets the aim hint again after this long (s) */
  idleHint: 6,
} as const;

/** The basket in W: its half-width, the rim (the overflow line), the twine Feliks flies along. */
export const BASKET = { half: 0.5, rim: 1.2, hang: 1.36 } as const;
