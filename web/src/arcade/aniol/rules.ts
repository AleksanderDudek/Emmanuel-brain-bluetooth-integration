/**
 * Every number of Anioł Stróż's rules in one place (sim.ts re-exports it): the room, the strike,
 * the Zmory, the aura, the Płomień, Sen and the lullaby, the levels and gifts of a night, the
 * blocks and the meta.  Tuning moves a number here and nowhere else; the tests read the same object.
 *
 * The world is one line across the room: `d` is a Zmora's distance from the bed's centre (u, about
 * a metre), on the left (side −1, the wardrobe's shadow) or the right (side +1, the door ajar).
 */
export const RULES = {
  // ── the room ─────────────────────────────────────────────────
  /** the bed's half width (u): a Zmora touches the bed when d − r ≤ bedHalf */
  bedHalf: 1.0,
  /** where the Zmory step out of the dark (u), and the room's walls */
  edge: 5.8,
  wall: 6.3,
  /** the night's first Zmora steps out this close (u), this soon (s): in reach within the first seconds */
  firstAt: 3.9,
  firstDelay: 0.35,

  // ── the strike (touch: anything under 2 s) ───────────────────
  /** the sweep of light reaches this far from the bed's centre (u), to a Zmora's near edge */
  reach: 2.4,
  /** a strike with nothing in reach: recovery (s); a tap during it lands the moment it ends */
  whiff: 0.25,
  /** a Skoczek in the air higher than this (u) is out of the sweep: hit it as it lands */
  airHit: 0.28,
  /** a hit throws a Zmora back (u/s, the push's decay in s); a bounce off armour throws it further */
  knock: 3.2,
  bounceKnock: 8,
  knockTau: 0.12,
  /** hit-stop: the world holds its breath this long (s) */
  stopHit: 0.045,
  stopBanish: 0.075,
  stopFlame: 0.2,
  stopKoszmar: 0.28,
  /** the combo ladder: feathers ×2 from 8 hits, ×3 from 20, ×4 from 40, ×5 from 70 */
  comboAt: [8, 20, 40, 70],
  /** the perfect window: a hit whose target's near edge is in the reach's outer band this wide (u) */
  perfect: 0.45,
  /** a perfect hit counts twice on the combo and pays this many feathers more */
  perfectFeathers: 1,
  /** a Zmora struck this close to the bed (u, past its edge) is a close call ("o włos") */
  closeCall: 0.4,
  /** strikes on armour crack it too: this many bounces break it (the aura only does it sooner) */
  crackBounces: 3,

  // ── the Zmory ────────────────────────────────────────────────
  /** the Fikołek: a hit throws it over the bed in this long (s), to this far on the other side (u), this high (u) */
  flipSec: 0.62,
  flipTo: 2.7,
  flipHigh: 1.5,
  /** the Kleks: stops this far (u), spits every (s) after a wind-up (s); its ink drop's speed in and back (u/s) and what it dims */
  kleksStop: 3.45,
  spitEvery: 2.9,
  spitWind: 0.75,
  dropSpeed: 1.9,
  dropBack: 7,
  dropDim: 0.06,
  /** the Ciągutek: a hit barely moves it (knock u/s); at the bed it holds on and dims Sen this much a second */
  stickyKnock: 0.9,
  grabDim: 0.05,
  /** speeds grow over the night (× 1 + nightRamp × share of the night) and over the nights played */
  nightRamp: 0.18,
  nightsRamp: 0.03,
  nightsMax: 10,
  /** the Skoczek: on the ground (s), in the air (s), how high (u) and how far a leap carries (u) */
  hopGround: 0.75,
  hopAir: 0.7,
  hopHigh: 1.1,
  hopFar: 1.35,
  /** the Widmo flickers: a hit makes it slip back this far (u) */
  slip: 0.6,
  /** the Rój breaks into this many small shades, spread this far (u) */
  swarm: 3,
  swarmSpread: 0.35,
  /** a Zmora steps out of the dark over this long (s); the lullaby sends them back at this speed (u/s) */
  emerge: 0.45,
  backSpeed: 3.2,

  // ── the aura (the live gauge: Czuwanie) ──────────────────────
  /** radius = auraMin + level × auraExtra (u) in a sighted Czuwanie past the lead-in; the candle otherwise */
  candle: 1.25,
  auraMin: 1.4,
  auraExtra: 3.0,
  /** how fast the drawn and acting aura follows its target (s) */
  auraTau: 0.35,
  /** inside a live aura the Zmory walk at this share of their speed */
  auraSlow: 0.55,
  /** light damage per second at the top of the level (hp/s), in proportion to (level − 0.5) / 0.5 */
  auraDps: 1.4,
  /** armour cracks while the level stands above the threshold inside the aura (per s; cracked at 1) */
  crackRate: 0.9,
  /** the lead-in before the band moves the aura (s), Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },

  // ── the Płomień (hold) ───────────────────────────────────────
  /** a held focus this long (s) fills it; again after as long once more; at most `flameMax` a block */
  flameHold: { fnirs: 5, eeg: 3 },
  flameMax: 3,
  /** after a Płomień, Skrzydła ognia: this long (s) every strike pierces its whole side and hits double */
  glorySec: 5,

  // ── Sen and the lullaby (Kołysanka) ──────────────────────────
  /** a stir brings Sen back to this */
  senBack: 0.5,
  /** a stir scatters the Zmory this close to the bed (u) back to the dark */
  scatter: 3.6,
  /** stars: d(stars)/dt = starGain × calm after the lead-in (s); at most starMax a lullaby */
  starGain: 0.7,
  starMax: 12,
  starLead: { fnirs: 4, eeg: 2 },
  /** each star: feathers and Sen; calm also refills Sen slowly (per s at calm 1) */
  starFeathers: 2,
  starSen: 0.05,
  senGain: 0.02,
  /** a passed lullaby ("spokojny sen"): a feather bonus */
  restBonus: 10,

  // ── spawning ─────────────────────────────────────────────────
  /** seconds between Zmory: the warm-up, a Czuwanie from its start to the night's end, a lullaby's trickle */
  spawnWarm: 2.3,
  spawnPush: [1.7, 1.15],
  spawnRest: 5.5,
  /** a lullaby's Zmory walk at this share of their speed */
  restSlow: 0.6,
  /** no more than this many from one side in a row */
  sameSide: 3,

  // ── levels and gifts (one night) ─────────────────────────────
  /** feathers to the next level: levelBase + levelStep × level */
  levelBase: 10,
  levelStep: 7,
  /** the choice of gifts: the night goes on at this speed, the first is taken after this long (s) */
  choiceSlow: 0.3,
  choiceSec: 5,
  /** the gifts' numbers */
  reachStep: 0.45,
  auraWide: 1.3,
  flameFast: 0.7,
  shieldSec: 12,
  spearReach: 1.4,
  lampR: 2.1,
  lampDps: 0.35,

  // ── the finale: the dream's great nightmare ──────────────────
  /** the finale's length (s): sessions of 2 min and more / shorter */
  finale: { long: 22, short: 9 },
  /** a boss's light (hits) and, for Koszmar, hits per phase (then it turns to the other side) */
  koszmarHp: { long: 12, short: 6 },
  koszmarPhase: { long: 4, short: 3 },
  /** it comes back from the other side after this long (s); touching the bed throws it back here (u) */
  koszmarTurn: 1.2,
  koszmarBack: 3.4,
  /** the second phase begins at this share of the boss's light; it is this much quicker */
  phaseAt: 0.5,
  phaseFast: 1.35,
  /** the Wilk's dash: it waits (s), crouches (the tell, s), dashes in (s) and stays open for a strike (s); a counter hits for 2 */
  dashIdle: 0.7,
  dashWind: 0.95,
  dashGo: 0.28,
  dashOpen: 0.6,
  dashFrom: 4.3,
  counter: 2,
  /** a boss that waits out of reach (Kufer, Ośmiornica) stands here (u); a hop to the other side takes (s) */
  bossStand: 3.7,
  hopSec: 0.8,
  /** the Ośmiornica's arms: one every (s), both sides at once in its second phase */
  armEvery: 2.4,
  /** a boss's touch dims Sen this much */
  bossDim: 0.1,

  // ── the session ──────────────────────────────────────────────
  /** Czuwanie and Kołysanka: nominal length ± jitter (s); no block under minBlock */
  push: [24, 4],
  rest: [22, 3],
  minBlock: 12,
  telegraph: 4,
  /** the first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** the warm-up's ghost hand shows after this long without a touch (s) */
  idleHint: 3,
  /** Czuwanie blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** the blind block's dawn burst lasts this long (s) */
  burstSec: 1.6,
  /** a hold this long (s) counts as a long vigil (the closing verse) */
  longHold: 12,
  /** this many banished in a night count as many (the closing verse) */
  many: 40,

  // ── the companion and the coach marks ────────────────────────
  /** at least this long between two of Pan Guzik's lines (s), each on screen this long (s); a block's first seconds stay quiet */
  sayGap: 7,
  sayFor: 3.4,
  quietStart: 5,
  /** at least this long between two coach marks (s) */
  coachGap: 3.6,
  /** the night's stars: a combo this long (and Sen never out) is the third */
  starCombo: 15,

  // ── the meta ─────────────────────────────────────────────────
  /** the dreams: nights in each before the next one comes (the last one goes on) */
  nightsPer: 3,
  chapters: 5,
  /** the upgrade tree: a level's price in feathers (level 1..4) */
  upCost: [25, 55, 95, 150],
  upMax: 4,
  /** what one level of each upgrade gives */
  up: { reach: 0.12, perfect: 0.1, aura: 0.07, flame: 0.08, sen: 0.1, lull: 0.12 },
  /** a version-1 save starts the wallet with up to this many of its feathers */
  welcome: 150,
  /** the angel's rank by all feathers ever */
  ranks: [0, 40, 120, 250, 450, 750, 1150, 1700],
  /** the day's gift (feathers, the same for everyone who comes) */
  dayGift: 20,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
