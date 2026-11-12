/**
 * Every number of Odporność's rules in one place (DESIGN.md §13.9): the world, the cells and the
 * pathogens, the six stages of a loop, the band (the alarm, the respiratory burst, healing), the
 * power-ups, the blocks, the meta.  Tuning moves a number here and nowhere else; the tests read it.
 *
 * The world is a slice of skin in logical units, the same height everywhere: the epidermis above
 * (y −10…0, the wound and the splinter in it), the dermis (y 0…100) where the hunt happens, and the
 * venule along the bottom (its wall at y 100, the lumen to y 113).  Its width follows the screen,
 * between `minW` and `maxW` units; the view maps it with one uniform scale, so circles stay round.
 *
 * Real speeds are compressed — minutes and days become seconds — and every stage card says so.
 */
export const RULES = {
  // ── the world (units) ────────────────────────────────────────
  /** the dermis's depth, the vessel's wall and lumen, the epidermis above */
  H: 100,
  wallY: 100,
  lumenTop: 101.5,
  lumenBot: 113,
  skinTop: -10,
  /** below the lumen a strip of tissue (the view's bottom margin) */
  floor: 116,
  /** the world's width follows the screen's shape, within these */
  minW: 80,
  maxW: 240,
  /** a phone's width, for tests and before the first resize */
  defaultW: 136,

  // ── the cells (radius in units, speed in units/s) ────────────
  neut: { r: 4.2, speed: 30, accel: 90, sniff: 17, appetite: 8, wrap: 0.42, digest: 1.5, hold: 3, spentSec: 4.5, bodySec: 26 },
  mac: { r: 8.5, speed: 13, accel: 30, sense: 26, wrap: 0.9, digest: 2.2, hold: 4, sniff: 24 },
  dc: { r: 5, speed: 26 },
  tcell: { r: 3.9, speed: 21, accel: 70, dock: 0.9, fold: 1.5, rest: 0.7, sniff: 30 },
  nk: { r: 4.3, speed: 22, accel: 60, sniff: 46 },
  /** a stage shows at most this many new "Wiedza" cards (the rest wait for the next time): the collection spans sessions */
  factsPerStage: 2,
  /** at most this many neutrophils at once (a readable swarm; the rest wait in the blood) */
  swarmCap: 22,
  /** flocking: keep apart within this (× radius), stick together within cohesion (units) */
  sepK: 2.3,
  cohesion: 30,
  /** the finger's lead: the swarm gathers around it within this radius (units) */
  leadSpread: 13,
  /** a tap marks this many free neutrophils (or half the swarm) to the bacterium tapped */
  tapSend: 5,
  /** a tap reaches the nearest bacterium within this (units); a tap on bare tissue looks this far */
  tapPick: 15,
  tapLook: 60,
  /** a tap on bare tissue leads the swarm there this long (s) */
  tapLead: 1.4,

  // ── pathogens ────────────────────────────────────────────────
  /** bacteria (radius / half-length in units; drift in units/s; a swimmer's run) */
  bug: { coccus: 2.1, rod: 2.8, rodW: 1.2, sink: 0.5, drift: 2.4, swim: 13, run: 0.8, tumble: 0.45 },
  /** lab doubling ~20–30 min (Gibson 2018), compressed to seconds: base ± spread, faster each loop */
  divide: [11, 3] as const,
  divideLoop: 0.1,
  /** bacteria alive at once (the wave's rest waits outside) */
  bugCap: 40,
  /** the T-cell stage's epithelium: cells across the world, the virus's replication (s) and burst */
  epi: { w: 10.5, y: 9, h: 15, replicate: 14, replicateLoop: 0.08, ifn: 0.22, protect: 5, burst: 5, virionSec: 4.5, virionSpeed: 9, infectR: 6 },
  /** antibodies: drift speed (units/s) and how far a Y looks for a bacterium */
  ab: { speed: 20, look: 70, rate: 2.2 },
  /** a tagged bacterium is engulfed this much faster (and counts double in a combo) */
  tagK: 3,

  // ── the six stages (goals, soft caps in s: the body finishes the job) ──
  /** Alarm: pads lit on the vessel wall; the first bacteria, their trickle while the splinter is in (at most `live` at once) */
  alarm: { pads: 5, cap: 60, start: 6, trickle: 2.4, live: 9, padHits: 4 },
  /** Rekrutacja: neutrophils through the wall (+ per loop) */
  recruit: { need: 12, needLoop: 2, cap: 75, flow: 0.42, capture: 0.55, roll: 5.5, autoArrest: [3.5, 6.5] as const, crawl: 0.9, squeeze: 1.3 },
  /** Łowy: the wave (× the loop's difficulty), the splinter's last trickle */
  hunt: { wave: 24, cap: 90, burst: 10 },
  /** Przeciwciała: the wave, the share in capsules, the dendritic cell's trip (s) */
  antibodies: { wave: 20, cap: 90, capsule: 0.35, capsuleLoop: 0.1, trip: 6.5, memoryTrip: 2.5 },
  /** Limfocyty T: infected cells at the start (+ per loop), T cells, a hidden share once NK cells come */
  tcells: { infected: 6, infectedLoop: 1, cells: 3, cap: 90, hidden: 0.3 },
  /** Gojenie: the wound's closure (0..1): rest's calm, touch, the base, the battle's rests before it */
  heal: { cap: 85, calmRate: 0.045, base: 0.007, stroke: 0.028, tidy: 0.02, stragglers: 4, pre: 0.35, preRate: 0.012 },
  /** a stage's stars: done by the player within these shares of its cap (★★★, ★★), else ★ */
  stars: [0.5, 0.78] as const,
  /** the loop's difficulty: waves and division grow by this a loop */
  loopK: 0.22,
  /** a stage card stays this long (s), a tap closes it after 0.6 s; the first story card longer */
  cardSec: 5.5,
  storySec: 9,
  cardTap: 0.6,

  // ── the band ─────────────────────────────────────────────────
  /** the lead-in before the band acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the alarm eases toward the focus level over this (s) */
  alarmTau: 1.2,
  /** the cytokine signal's reach (units) = base × (1 + reachK × alarm); its rings, every ringEvery s */
  reach: 50,
  reachK: 1,
  ringEvery: 1.6,
  /** a gulp makes the macrophage send a stronger ring (phagocytosis sets off the cytokines) */
  gulpRing: 1.6,
  ringGrow: 1.5,
  /** recruitment from the blood (neutrophils/s) = base × (1 + recruitK × alarm) in a push block */
  recruitBase: 0.22,
  recruitK: 1.6,
  /** engulfing and digesting speed × (1 + eatK × alarm) */
  eatK: 0.9,
  /** chemotaxis: the sniff radius × (1 + sniffK × alarm) */
  sniffK: 0.7,
  /** the respiratory burst: a held focus this long (s) fills it at holdRate a second; + per engulf in a push; + a trickle */
  holdNeed: { fnirs: 5, eeg: 3 },
  holdRate: 0.085,
  eatCharge: 0.01,
  baseCharge: 0.004,
  /** a ready burst goes off by itself after this long (s); it lasts burstSec */
  burstAuto: 6,
  burstSec: 6,
  /** the burst: engulfing at once, digesting × this, sniffing × this */
  burstEat: 4,
  burstSniff: 1.8,
  /** rest: calm refreshes the swarm (fresh neutrophils/s) and settles the inflammation (per s) */
  restRecruit: 0.45,
  inflamUp: 0.012,
  inflamDown: 0.05,
  /** a rest's breathing guide: in for this long, out for that long (s): six breaths a minute (§13.1) */
  breathIn: 4,
  breathOut: 6,
  /** the calm's lead-in in a rest block (s): Mendi / HALO */
  restLead: { fnirs: 4, eeg: 2 },

  // ── power-ups ────────────────────────────────────────────────
  /** NETs: a charge every comboNet engulfs in one combo; at most nets (+1 with the unlock) */
  comboGap: 1.7,
  comboNet: 8,
  nets: 1,
  net: { r: 15, life: 8, dissolve: 3.2 },

  // ── the session ──────────────────────────────────────────────
  /** push and rest: nominal length ± jitter (s); no block under minBlock */
  push: [26, 4] as const,
  rest: [22, 3] as const,
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: cards and Neo wait it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 28 in 5 and 10 min, 20 in 3, 6 in a 40 s test */
  warm: { long: 28, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 4,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,
  /** a blind block's share of time above the threshold becomes this much burst charge */
  blindCharge: 0.7,

  // ── Neo's lines ──────────────────────────────────────────────
  talkMin: 2.2,
  talkMax: 4,
  talkGap: 2.4,
  /** the alarm above the threshold this long (s) before Neo cheers it */
  goodSec: 4,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;

/** The loop's difficulty factor (1 in the first loop). */
export const loopK = (loop: number): number => 1 + RULES.loopK * (Math.max(1, Math.floor(loop)) - 1);
