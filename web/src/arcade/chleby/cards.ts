/**
 * Chleby i ryby's collection (v3, after Mob Control's armory): twenty-one cards in four kinds — the
 * basket the boy pours from (the cannon), the bread that runs (the mob), the champion the ring
 * launches, and the help (the ultimate) — each with a rarity, a level from the copies found (1..9)
 * and evolutions at levels 3, 6 and 9 that grow the card's special.  Cards come only from bundles
 * won by play (a level, three stars, a mission, a boss, a tier of the league): published odds, a
 * card never found comes first half the time, an epic or a legend at least every twelve cards, and
 * a copy past the top becomes crumbs.  Nothing is bought.  No DOM; the randomness is the caller's.
 */
import { RULES } from './rules';

export type CardKind = 'kosz' | 'chleb' | 'mistrz' | 'pomoc';
export type Rarity = 'common' | 'rare' | 'epic' | 'legend';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legend'];

export type KoszId = 'mama' | 'dwojak' | 'przetak' | 'niespodzianka' | 'trojak' | 'rybacki' | 'piec';
export type ChlebId = 'bochenek' | 'bulka' | 'podplomyk' | 'placek' | 'bochen';
export type MistrzId = 'kosz' | 'osiol' | 'woz' | 'olbrzym' | 'wielblad';
export type PomocId = 'mewy' | 'siec' | 'bramka' | 'wiatr';
export type CardId = KoszId | ChlebId | MistrzId | PomocId;

export interface CardDef {
  id: CardId;
  kind: CardKind;
  rarity: Rarity;
  /** the village level that brings it into the bundles' pool */
  unlock: number;
}

/** The cards, kind by kind, in the order the lobby shows them. */
export const CARDS: readonly CardDef[] = [
  { id: 'mama', kind: 'kosz', rarity: 'common', unlock: 0 },
  { id: 'dwojak', kind: 'kosz', rarity: 'common', unlock: 1 },
  { id: 'przetak', kind: 'kosz', rarity: 'rare', unlock: 3 },
  { id: 'niespodzianka', kind: 'kosz', rarity: 'rare', unlock: 5 },
  { id: 'trojak', kind: 'kosz', rarity: 'epic', unlock: 8 },
  { id: 'rybacki', kind: 'kosz', rarity: 'epic', unlock: 11 },
  { id: 'piec', kind: 'kosz', rarity: 'legend', unlock: 14 },
  { id: 'bochenek', kind: 'chleb', rarity: 'common', unlock: 0 },
  { id: 'bulka', kind: 'chleb', rarity: 'common', unlock: 0 },
  { id: 'placek', kind: 'chleb', rarity: 'rare', unlock: 2 },
  { id: 'podplomyk', kind: 'chleb', rarity: 'rare', unlock: 4 },
  { id: 'bochen', kind: 'chleb', rarity: 'epic', unlock: 9 },
  { id: 'kosz', kind: 'mistrz', rarity: 'common', unlock: 0 },
  { id: 'osiol', kind: 'mistrz', rarity: 'rare', unlock: 2 },
  { id: 'woz', kind: 'mistrz', rarity: 'rare', unlock: 6 },
  { id: 'olbrzym', kind: 'mistrz', rarity: 'epic', unlock: 10 },
  { id: 'wielblad', kind: 'mistrz', rarity: 'legend', unlock: 13 },
  { id: 'mewy', kind: 'pomoc', rarity: 'common', unlock: 0 },
  { id: 'siec', kind: 'pomoc', rarity: 'rare', unlock: 3 },
  { id: 'bramka', kind: 'pomoc', rarity: 'rare', unlock: 7 },
  { id: 'wiatr', kind: 'pomoc', rarity: 'epic', unlock: 12 },
];

export const KINDS: readonly CardKind[] = ['kosz', 'chleb', 'mistrz', 'pomoc'];
const BY_ID = new Map(CARDS.map(c => [c.id, c]));
export const cardDef = (id: string): CardDef | undefined => BY_ID.get(id as CardId);
export const isCard = (id: unknown): id is CardId => typeof id === 'string' && BY_ID.has(id as CardId);
export const ofKind = (k: CardKind): CardDef[] => CARDS.filter(c => c.kind === k);

/** The cards a fresh player owns (one copy each), and the loadout they start with. */
export const STARTER = { kosz: 'mama', chleb: 'bochenek', mistrz: 'kosz', pomoc: 'mewy' } as const;
export type Loadout = { kosz: KoszId; chleb: ChlebId; mistrz: MistrzId; pomoc: PomocId };
export const starterCards = (): Record<string, number> => ({ mama: 1, bochenek: 1, kosz: 1, mewy: 1 });

// ── what each card does ──────────────────────────────────────────
export type Pattern = 'one' | 'two' | 'fan' | 'three';

/**
 * The baskets (cannons): shots per second as a share of the stream, runners per shot and their
 * spread (u), the shots of a tap's burst, the pattern, how many loaves each runner carries, and the
 * special by evolution (Przetak: the fan; Niespodzianka: the chance of a golden loaf; Rybacki: the
 * weight; Piec: seconds of embers).
 */
export const KOSZ: Readonly<Record<KoszId, { shots: number; per: number; spread: number; burst: number; pattern: Pattern; heavy: number; special: readonly number[] }>> = {
  mama: { shots: 1, per: 1, spread: 0.25, burst: 3, pattern: 'one', heavy: 1, special: [0, 0, 0, 0] },
  dwojak: { shots: 0.58, per: 2, spread: 0.55, burst: 2, pattern: 'two', heavy: 1, special: [0, 0, 0, 0] },
  przetak: { shots: 0.24, per: 5, spread: 1.6, burst: 1, pattern: 'fan', heavy: 1, special: [5, 6, 7, 8] },
  niespodzianka: { shots: 1, per: 1, spread: 0.25, burst: 3, pattern: 'one', heavy: 1, special: [1 / 7, 1 / 6, 1 / 5, 1 / 4] },
  trojak: { shots: 1.3, per: 1, spread: 1.3, burst: 3, pattern: 'three', heavy: 1, special: [0, 0, 0, 0] },
  rybacki: { shots: 0.36, per: 1, spread: 0.25, burst: 1, pattern: 'one', heavy: 3, special: [3, 3, 4, 4] },
  piec: { shots: 1, per: 1, spread: 0.25, burst: 3, pattern: 'one', heavy: 1, special: [5, 6, 7, 9] },
};
/** a golden loaf (Niespodzianka) feeds this many; a warm loaf (Piec) feeds twice its bread */
export const GOLD_LOAF = 4;
/** each evolution of a basket without a special number adds this to its shots */
export const EVO_SHOTS = 0.08;

/** The breads (mobs): speed up the hill, people each feeds, the shot rate's factor, flat (slips under grey gates and jars). */
export const CHLEB: Readonly<Record<ChlebId, { speed: number; worth: number; rate: number; flat: boolean }>> = {
  bochenek: { speed: 4.6, worth: 1, rate: 1, flat: false },
  bulka: { speed: 6.2, worth: 1, rate: 1.1, flat: false },
  placek: { speed: 3.6, worth: 2, rate: 0.55, flat: false },
  podplomyk: { speed: 5, worth: 1, rate: 1, flat: true },
  bochen: { speed: 2.8, worth: 3, rate: 0.4, flat: false },
};
/** each evolution of a bread adds this share of speed */
export const EVO_SPEED = 0.05;

// ── levels and evolutions ────────────────────────────────────────
export const MAX_LEVEL = RULES.copies.length;

/** Copies a card of `rarity` needs for `level` (1..9). */
export function copiesFor(level: number, rarity: Rarity): number {
  const L = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return Math.max(L, Math.round(RULES.copies[L - 1] * RULES.rarityCopies[rarity]));
}

/** A card's level from its copies (0: not found yet). */
export function levelOf(id: CardId, copies: number): number {
  const def = cardDef(id);
  if (!def || !(copies >= 1)) return 0;
  let L = 0;
  for (let l = 1; l <= MAX_LEVEL; l++) if (copies >= copiesFor(l, def.rarity)) L = l;
  return L;
}

/** Evolutions reached at a level: 0..3 (at 3, 6 and 9). */
export const evoOf = (level: number): number => RULES.evolveAt.filter(l => level >= l).length;

/** The card's main number grows by perLevel for each level above the first. */
export const power = (level: number): number => 1 + RULES.perLevel * Math.max(0, level - 1);

/** The copies a card's next level needs (null at the top). */
export function nextCopies(id: CardId, copies: number): number | null {
  const def = cardDef(id);
  if (!def) return null;
  const L = levelOf(id, copies);
  return L >= MAX_LEVEL ? null : copiesFor(L + 1, def.rarity);
}

export const cardLevel = (cards: Readonly<Record<string, number>>, id: CardId): number => levelOf(id, cards[id] ?? 0);

/** Evolutions over the whole collection (each one counts a star in the league). */
export const evolutions = (cards: Readonly<Record<string, number>>): number =>
  CARDS.reduce((s, c) => s + evoOf(levelOf(c.id, cards[c.id] ?? 0)), 0);

/** Cards found (owned) and all. */
export const owned = (cards: Readonly<Record<string, number>>): number => CARDS.filter(c => (cards[c.id] ?? 0) >= 1).length;

// ── bundles ──────────────────────────────────────────────────────
export type PackKind = 'wezelek' | 'tobolek' | 'skrzynka';
/** cards in a bundle, and the rarity its last card is at least */
export const PACK: Readonly<Record<PackKind, { n: number; floor: Rarity }>> = {
  wezelek: { n: 2, floor: 'common' },
  tobolek: { n: 3, floor: 'rare' },
  skrzynka: { n: 5, floor: 'epic' },
};

export interface Drop {
  id: CardId;
  /** a card never found before */
  fresh: boolean;
  /** its level after this copy, and whether the copy raised it / reached an evolution */
  level: number;
  up: boolean;
  evo: boolean;
  /** crumbs (in baskets) from a copy past the top */
  dust: number;
}

const rank = (r: Rarity): number => RARITIES.indexOf(r);

/** The odds of each rarity with the Spichlerz's luck (`luck` added to everything above common, from common's share). */
export function oddsWith(luck: number): Record<Rarity, number> {
  const o = { ...RULES.odds } as Record<Rarity, number>;
  const add = Math.max(0, Math.min(0.3, luck));
  const up = o.rare + o.epic + o.legend;
  for (const r of ['rare', 'epic', 'legend'] as const) o[r] += (add * o[r]) / up;
  o.common = Math.max(0, 1 - o.rare - o.epic - o.legend);
  return o;
}

function rollRarity(rnd: () => number, luck: number): Rarity {
  const o = oddsWith(luck);
  let x = rnd();
  for (const r of ['legend', 'epic', 'rare'] as const) {
    if (x < o[r]) return r;
    x -= o[r];
  }
  return 'common';
}

export interface PackOpts {
  /** the village level (the pool) */
  village: number;
  /** the Spichlerz's luck */
  luck: number;
  /** cards since the last epic or legend */
  pity: number;
  /** extra cards (a market day) */
  extra?: number;
}

/**
 * Open a bundle into `cards` (copies by id, mutated): its cards and the pity counter after it.
 * The same randomness gives the same bundle (a seeded `rnd`).
 */
export function rollPack(cards: Record<string, number>, kind: PackKind, rnd: () => number, o: PackOpts): { drops: Drop[]; pity: number } {
  const pool = CARDS.filter(c => c.unlock <= Math.max(0, o.village));
  const n = PACK[kind].n + Math.max(0, Math.floor(o.extra ?? 0));
  const drops: Drop[] = [];
  let pity = Math.max(0, Math.floor(o.pity));
  for (let i = 0; i < n; i++) {
    let def: CardDef | undefined;
    const unowned = pool.filter(c => !((cards[c.id] ?? 0) >= 1) && !drops.some(d => d.id === c.id));
    if (i === 0 && unowned.length && rnd() < RULES.newFirst) {
      // the cheapest-to-find first: a common before a legend
      const low = Math.min(...unowned.map(c => rank(c.rarity)));
      const list = unowned.filter(c => rank(c.rarity) === low);
      def = list[Math.floor(rnd() * list.length) % list.length];
    } else {
      let r = rollRarity(rnd, o.luck);
      if (i === n - 1 && rank(r) < rank(PACK[kind].floor)) r = PACK[kind].floor;
      if (pity >= RULES.pity && rank(r) < rank('epic')) r = 'epic';
      for (let k = rank(r); k >= 0 && !def; k--) {
        const list = pool.filter(c => c.rarity === RARITIES[k]);
        if (list.length) def = list[Math.floor(rnd() * list.length) % list.length];
      }
    }
    if (!def) continue;
    pity = rank(def.rarity) >= rank('epic') ? 0 : pity + 1;
    const before = Math.max(0, Math.floor(cards[def.id] ?? 0));
    const top = copiesFor(MAX_LEVEL, def.rarity);
    const lv0 = levelOf(def.id, before);
    let dust = 0;
    if (before >= top) dust = RULES.dustPerCopy;
    else cards[def.id] = before + 1;
    const lv1 = levelOf(def.id, cards[def.id] ?? 0);
    drops.push({ id: def.id, fresh: before === 0, level: lv1, up: lv1 > lv0 && before > 0, evo: evoOf(lv1) > evoOf(lv0), dust });
  }
  return { drops, pity };
}
