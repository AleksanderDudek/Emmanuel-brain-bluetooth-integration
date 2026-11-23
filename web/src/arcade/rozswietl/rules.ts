/**
 * Every number of Rozświetl in one place (DESIGN §13.7).  Units: seconds, the mosaic's own units (a
 * picture is 100 tall and 100 × aspect wide), pressure in shares of a tile's need (1 = it bursts).
 */
export const RULES = {
  // ── the mosaic ───────────────────────────────────────────────
  /** the mosaic's height in its own units (its width is this × the frame's aspect) */
  MH: 100,
  /** the frame's aspect is kept inside this range (a phone upright 3:4 … a desktop 2:1) */
  aspect: [0.72, 2.05] as const,
  /**
   * "Auto": tiles per picture by the sessions saved before this one (the last entry from then on).  The founder,
   * 2026-11-17: "więcej elementów mozaiki" — 16 in the first session, 72 from the tenth (it was 7 → 36); a tile's need
   * scales with its area, so a picture takes about as long as before (see picBase, picPerTile)
   */
  tiles: [16, 20, 24, 28, 32, 40, 48, 56, 64, 72] as const,
  /** the 2nd and later pictures of a session take this many tiles more (up to tilesMax) — in "Auto" only */
  tilesLater: [0, 4, 8] as const,
  tilesMax: 96,
  /** what the progress card offers: 0 is "Auto" (the table above), else a fixed count */
  tileChoices: [0, 16, 24, 32, 48, 64, 96] as const,
  /** a saved count the card no longer offers (8 and 12, before 2026-11-17) becomes the smallest one it does */
  tilesOld: [8, 12] as const,
  /** Lloyd steps that even the tiles out */
  relax: 2,
  /** a tile's need grows with its size: (area / mean)^needPow */
  needPow: 0.6,

  // ── the light (push) ─────────────────────────────────────────
  /**
   * Only held focus breaks a tile (the founder, 2026-11-17: "the flare must happen only with sustained concentration").
   * Without it — the base light, a knock, a rest's reserve, a warm-up — light presses a tile up to this share of its
   * need: the cracks glow and grow, nothing bursts.
   */
  baseCap: 0.35,
  /** held focus: the band's `focused` for at least this long (s) — then the light presses past the cap and tiles burst */
  focusHold: 1.5,
  /**
   * A picture at the base light's pace takes picBase + picPerTile × tiles seconds of light (held focus: ×1.57 … ×3).
   * 1.1 a tile until 2026-11-17 (7 → 36 tiles: 103 → 135 s); with twice the pieces 0.6, so every session's picture
   * takes as long as it did or a little longer (16 → 72 tiles: 105 → 138 s), never less
   */
  picBase: 95,
  picPerTile: 0.6,
  /** the light's multiplier: 1 + lightGain × clamp((light − lightFrom) / (1 − lightFrom)) — ×1.57 at the threshold, ×3 at full */
  lightGain: 2,
  lightFrom: 0.3,
  /** the first-ever session's warm-up teaches with a kinder light (× this) */
  warmLight: 1.6,
  /** the light eases toward the band's level over this (s) */
  lightTau: 1.2,
  /** the lead-in before the band acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** the halo's radius in mean tile radii: haloMin + haloSpan × light (the threshold ring at light 0.5: the neighbours) */
  haloMin: 1,
  haloSpan: 2,
  /** tiles inside the halo besides the aimed one get this share of the light, falling off to its edge */
  spill: 0.35,
  /** a tap on a dark tile knocks: this many seconds of base light at once, less when knocks come quick */
  knockSec: 0.6,
  /** knocks closer than this (s) are weaker in proportion */
  knockGap: 1.2,
  /** the player's aim holds this long (s) before the light may wander to the most cracked tile */
  aimHold: 10,
  /**
   * A burst passes pass (+ passLight × the band's light while it acts) of a neighbour's need to each dark
   * neighbour (× its gold), less with each link: under one tile's worth in all, so a chain needs tiles the
   * halo or the gold has already cracked — focus and gazing make the chains
   */
  pass: 0.1,
  passLight: 0.08,
  passDecay: 0.7,
  /** a chain's links follow each other this far apart (s): slow enough to see the light pass (0.12 before 2026-11-17) */
  chainGap: 0.3,
  /** a dark tile touching gold cracks faster: × (1 + goldPull × its share of gilded edges) */
  goldPull: 1,
  /** the last tiles go together: when this share (or fewer than finishMin tiles) is left dark, finishGap s apart */
  finishShare: 0.1,
  finishMin: 1,
  finishGap: 0.4,

  // ── a tile breaking (the founder, 2026-11-17: "wolniejszy rozpad") ─────────────────
  /**
   * A burst is a slow break, not a pop: the cracks run across the whole tile (breakCrack s), then its pieces loosen
   * and fall away one after another (breakStagger s apart, the whole stagger at most breakSpread s), each falling for
   * breakFall s with gravity breakGravity px/s², spinning slowly, fading to motes — the bright picture shows through
   * as they go.  A tile takes breakCrack + spread + fall ≈ 1.6–2.4 s.  At most breakCap pieces fall at once.
   */
  breakCrack: 0.42,
  breakStagger: 0.17,
  breakSpread: 0.85,
  breakFall: [0.95, 1.2] as const,
  breakGravity: 300,
  breakSpin: 1.8,
  breakCap: 220,
  /** pieces cut in one frame at most (a sprite each): past it a burst that frame gets one piece, fading in place */
  breakFrame: 27,

  // ── shards (the headline) ────────────────────────────────────
  /** shards of a burst: 3 + 6 × sqrt(area / (frame / 7)), 3..9, plus one per chain link */
  shardMin: 3,
  shardMax: 9,

  // ── the flare (Rozbłysk) ─────────────────────────────────────
  /** held focus (focused ≥ flareHold s) in a sighted push fills it in flareSec seconds; a break in the focus drains it */
  flareSec: 12,
  flareHold: 1.5,
  flareDrain: 1 / 30,
  /** a ready flare goes off only in held focus: a tap or Space, or by itself after this many seconds of held focus */
  flareAuto: 3,
  /**
   * The wave's reach in mean tile radii (× √(tiles / flareTiles) past flareTiles tiles, so a mosaic of smaller pieces
   * is not a smaller flare: it covers the same share of the picture as on 36 tiles) and its strength at the centre
   * (need shares, falling off outward)
   */
  flareReach: 2.2,
  flareTiles: 36,
  flarePower: 0.8,
  /** a wave bursts at most max(flareMinBurst, round(flareShare × tiles)) of the nearest tiles; the rest only crack */
  flareShare: 0.12,
  flareMinBurst: 2,
  /** the wave's other tiles crack up to this share: under 1 − (pass + passLight), so its bursts start no chain there */
  waveKeep: 0.8,
  /** the wave runs from its centre outward: a tile at distance d bursts or cracks waveLead + waveSec × d / reach s after */
  waveLead: 0.12,
  waveSec: 1.3,
  /** bursts this soon after a flare (s) count double (the wave's own always do) */
  flareDouble: 2.4,

  // ── gazing (rest) ────────────────────────────────────────────
  /** the lead-in before calm acts in a rest block (s): Mendi / HALO */
  restLead: { fnirs: 4, eeg: 2 },
  /** gold flows along a seam at base + calmGold × calm per second (a seam holds 1) */
  goldBase: 0.035,
  calmGold: 0.13,
  /** an open tile warms at base + calmWarm × calm per second in rest, warmIdle elsewhere */
  warmBase: 0.04,
  calmWarm: 0.12,
  warmIdle: 0.008,
  /** a tap on an open tile in rest pours this much gold into its seams */
  tapGold: 0.25,
  /** a rest with nothing open banks this much light (need shares for every tile) for the next push, at full calm */
  reserveMax: 0.18,
  /** the calm the gauge shows eases over this (s) */
  calmTau: 1.5,

  // ── the session ──────────────────────────────────────────────
  /**
   * push and rest: nominal length ± jitter (s); no block under minBlock.  The designed rhythm (round 15, DESIGN
   * §19.2): 40 s of light breaking through, then 20 s of gazing at what it uncovered — two slow breaths of the
   * pacer (4 in, 6 out) while the gold runs in the seams; rest a third of the session (26 / 22 s made it nearly
   * half, every 25 s).  A picture still takes ~105–140 s of light: about three light blocks instead of four.  The
   * player sets both in the lobby (kit/rhythm.ts); the jitter scales with them.
   */
  push: [40, 6] as const,
  rest: [20, 3] as const,
  minBlock: 12,
  telegraph: 4,
  /** the runner's banner covers the first seconds of a block: the voice and the cards wait it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): long sessions / short / a 40 s test */
  warm: { long: 30, short: 20, test: 6 },
  /** the last stretch without a block (s): sessions of 2 min and more / shorter */
  finale: { long: 12, short: 6 },
  /** canStop() waits at most this long after time is up (s) */
  settle: 3,
  /** push blocks counted across sessions: every blindEvery-th is blind from the blindFrom-th session */
  blindEvery: 4,
  blindFrom: 3,
  /** a block needs this many reliable seconds for a verdict */
  minReliable: 8,

  // ── pictures ─────────────────────────────────────────────────
  /** a picture done: the bloom (s) before the next one assembles, which takes assembleSec */
  bloomSec: 3.6,
  assembleSec: 1.3,
  /** the card comes this long (s) into the bloom: after the last tile's pieces have fallen */
  cardAt: 2.5,
  /**
   * A card waits for the player (the founder, 2026-11-17: the next picture only after a click on the card): a tap
   * on it, its button, Enter or Space close it — never time.  Taps in its first cardMin s are not taken (a finger
   * still tapping the last tiles must not skip it).  While it waits the light rests and the block's seconds under it
   * are not judged; a block more than cardJudge of whose time a card covered gets no verdict at all.
   */
  cardMin: 1.2,
  cardJudge: 0.5,

  // ── the voice ────────────────────────────────────────────────
  /** a line stays long enough to read twice: talkBase + talkPerChar × its characters, never under talkMin (s) */
  talkBase: 2.5,
  talkPerChar: 0.07,
  talkMin: 4.5,
  talkGap: 3,
  /** the "what to do now" line changes only after the new action has held this long (s) */
  nowSettle: 0.8,
  /** the light above the threshold this long (s) before the firefly says so */
  goodSec: 5,
} as const;

/** a + (b − a) × t for a [lo, hi] pair. */
export const span = (r: readonly [number, number], t: number): number => r[0] + (r[1] - r[0]) * t;
