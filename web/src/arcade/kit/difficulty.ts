/**
 * Difficulty levels for the games with foes (DESIGN.md §29): the founder, 2026-11-27 — "Make different difficulty
 * levels for games like David, Hosts — they should be like STARTING, REGULAR, ADVANCED, HARDCORE".
 *
 * What a level changes is **the game's challenge, never the training**: the band's threshold, the push and rest
 * blocks, what focus is worth and how calm is read stay the same at every level — a harder level asks more of the same
 * focus (stronger foes, fewer helps), an easier one forgives more.  REGULAR is each game exactly as it was before
 * levels came (a returning player's game does not change unless they choose), and the default.
 *
 * Each game maps the shared scale to its own knobs (foes' health, damage, numbers and speed; the player's health and
 * helps; rewards) in its own rules — `scaleFor(level)` is the common reference, a game may bend it where its genre
 * needs (a tower defence's waves, a runner's road).  Records (bests) are kept per level, so a STARTING record never
 * beats a HARDCORE one; the summary names the level.  The lobby shows the four as one row of chips with a line under
 * them saying what the chosen one means in this game (`DifficultyPanel` in kit/difficultypanel.ts — the games' panels
 * call it).
 */
export const DIFFICULTIES = ['start', 'regular', 'advanced', 'hardcore'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DEFAULT_DIFFICULTY: Difficulty = 'regular';

export const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);

/** A saved level, or the default (an old save has none: REGULAR, the game as it was). */
export const difficultyOf = (v: unknown): Difficulty => (isDifficulty(v) ? v : DEFAULT_DIFFICULTY);

/**
 * The shared scale (multipliers on REGULAR).  `foe` scales foes' health and damage together; `count` their numbers or
 * waves; `speed` how fast they act; `self` the player's own health/armour; `helps` the game's helps (auto-aim, revives,
 * hints, grace) — 1 as designed, > 1 more, < 1 fewer, 0 none; `reward` what a win pays (so an easier level still
 * levels up, a harder one a little faster).
 */
export interface DifficultyScale { foe: number; count: number; speed: number; self: number; helps: number; reward: number }

export const SCALE: Readonly<Record<Difficulty, DifficultyScale>> = {
  start:    { foe: 0.6,  count: 0.75, speed: 0.85, self: 1.5,  helps: 1.5, reward: 0.9 },
  regular:  { foe: 1,    count: 1,    speed: 1,    self: 1,    helps: 1,   reward: 1 },
  advanced: { foe: 1.4,  count: 1.25, speed: 1.1,  self: 0.85, helps: 0.6, reward: 1.15 },
  hardcore: { foe: 2,    count: 1.5,  speed: 1.2,  self: 0.7,  helps: 0,   reward: 1.3 },
};

export const scaleFor = (d: Difficulty): DifficultyScale => SCALE[d];

/** A record's key per level (REGULAR keeps the old key, so the records before levels came stay REGULAR's). */
export const recordKey = (base: string, d: Difficulty): string => (d === 'regular' ? base : `${base}@${d}`);
