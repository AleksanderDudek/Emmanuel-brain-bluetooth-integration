/**
 * Rzeki żywej wody's seven places (DESIGN.md §13.14): where each sits on the figure, its glass, its rose
 * window, its gift, its verse and its bell — and the words the session asks for: the prayer of each place,
 * its thanksgiving, the strategies for the head, the narrator's moments.
 *
 * The places run from the crown to the feet.  Their glass goes from white at the crown, through sky and
 * periwinkle, the rose of the heart, the champagne gold of the breath and the honey of the inner well, to
 * the copper of the feet on the rock — warm at the base, cool and white at the crown, like the light of a
 * church window from top to bottom.  Nothing here is a chakra: no names but the body's own, no symbols,
 * no "energy"; each place gets the gift Scripture names for it (the Spirit is a Person, not a force).
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { RULES } from './rules';

export const PLACES = ['mind', 'eyes', 'mouth', 'heart', 'breath', 'inner', 'feet'] as const;
export type PlaceId = (typeof PLACES)[number];

/** A petal's outline in a ring of the rose window. */
export type PetalShape = 'lobe' | 'lancet' | 'drop' | 'arch';

/** A rose window's tracery: an inner ring of petals around a centre, an outer ring, their glass. */
export interface Rose {
  inner: number;
  innerShape: PetalShape;
  outer: number;
  outerShape: PetalShape;
  /** the outer ring turned by this share of a petal (0.5: its petals sit between the inner ones) */
  twist: number;
  /** the glass: the centre, the inner petals, the outer petals (each "#rrggbb") */
  glass: readonly [string, string, string];
}

export interface PlaceSpec {
  /** height on the figure (0 the crown … 1 the soles), on the midline */
  y: number;
  /** the place's own light (the orb, its glow) and a deep tone of it */
  hue: string;
  deep: string;
  rose: Rose;
  /** the place's verse: going down, and going up (the same where Scripture gives one) */
  verse: { down: PassageId; up: PassageId };
  /** the bell's step on the pentatonic ladder (the feet lowest, the crown highest) */
  bell: number;
}

export const PLACE: Readonly<Record<PlaceId, PlaceSpec>> = {
  mind: {
    y: -0.022, hue: '#f4f7ff', deep: '#7f8bbd', bell: 6,
    rose: { inner: 12, innerShape: 'lobe', outer: 12, outerShape: 'lancet', twist: 0.5, glass: ['#fff4d0', '#ffffff', '#c9d6ff'] },
    verse: { down: 'php4.7', up: 'php4.7' },
  },
  eyes: {
    y: 0.062, hue: '#a6dcff', deep: '#3d6f9e', bell: 5,
    rose: { inner: 8, innerShape: 'lancet', outer: 16, outerShape: 'lobe', twist: 0, glass: ['#fff3c4', '#bfe6ff', '#58aef2'] },
    verse: { down: 'eph1.18', up: 'eph1.18' },
  },
  mouth: {
    y: 0.166, hue: '#a7b6ff', deep: '#47509c', bell: 4,
    rose: { inner: 6, innerShape: 'lobe', outer: 12, outerShape: 'drop', twist: 0.5, glass: ['#f4f2ff', '#a9b4ff', '#6a78e8'] },
    verse: { down: 'psa141.3', up: 'psa141.3' },
  },
  heart: {
    y: 0.27, hue: '#ff9fc4', deep: '#a33f6c', bell: 3,
    rose: { inner: 5, innerShape: 'lobe', outer: 10, outerShape: 'arch', twist: 0.5, glass: ['#ffe2a8', '#ff9fc4', '#e9587f'] },
    verse: { down: 'rom5.5', up: 'rom5.5' },
  },
  breath: {
    y: 0.345, hue: '#ffdc86', deep: '#a8782a', bell: 2,
    rose: { inner: 3, innerShape: 'lobe', outer: 9, outerShape: 'lancet', twist: 0, glass: ['#fffaf0', '#ffdc86', '#ffb35c'] },
    verse: { down: 'jhn20.22', up: 'eph3.16' },
  },
  inner: {
    y: 0.455, hue: '#ffb46a', deep: '#a05c22', bell: 1,
    rose: { inner: 6, innerShape: 'drop', outer: 12, outerShape: 'arch', twist: 0.5, glass: ['#bff4ff', '#ffb46a', '#7fdcef'] },
    verse: { down: 'jhn7.38-39', up: 'jhn7.38-39' },
  },
  feet: {
    y: 0.985, hue: '#ff9858', deep: '#8f4a22', bell: 0,
    rose: { inner: 4, innerShape: 'lobe', outer: 8, outerShape: 'arch', twist: 0.5, glass: ['#ffe9b8', '#ff9858', '#ffc27a'] },
    verse: { down: 'psa40.2', up: 'psa18.32' },
  },
};

export type Dir = 'down' | 'up';
export type Way = 'down' | 'up' | 'both';
export const WAYS: readonly Way[] = ['down', 'up', 'both'];

/** The places in the order a way visits them: down from the crown, up from the feet. */
export const route = (dir: Dir): readonly PlaceId[] => (dir === 'down' ? PLACES : [...PLACES].reverse());

/** The ways one round of a session walks: down, up, or down and then up. */
export const legs = (way: Way): readonly Dir[] => (way === 'both' ? ['down', 'up'] : [way]);

/** The verse of a place on a way. */
export const verseOf = (p: PlaceId, dir: Dir): PassageId => PLACE[p].verse[dir];

/**
 * A window's glass grows richer the more often its place is lit, across sessions (the meta loop, shown in
 * the art itself): gilded at 3 times, a crown of glass at 10, golden tracery at 25.
 */
export const TIERS: readonly number[] = [3, 10, 25];
export type Tier = 0 | 1 | 2 | 3;
export function windowTier(times: number): Tier {
  let k = 0;
  for (const n of TIERS) if (times >= n) k++;
  return k as Tier;
}
export const tierName = (k: Tier): string => (k > 0 ? t(`tier.${k}` as Key) : '');

// ── the words ─────────────────────────────────────────────────────

export const placeName = (p: PlaceId): string => t(`place.${p}` as Key);
export const placeWhere = (p: PlaceId): string => t(`where.${p}` as Key);
export const giftName = (p: PlaceId): string => t(`gift.${p}` as Key);

/**
 * The own words, as plain text: control characters and angle brackets out, spaces folded, at most
 * RULES.ownMax characters (counted as the reader sees them).  Never markup: the game sets it as text.
 */
export function cleanOwn(s: unknown): string {
  if (typeof s !== 'string') return '';
  const flat = s.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...flat].slice(0, RULES.ownMax).join('').trim();
}

/** The line said at a place: the player's own words when they wrote some, else the prayer (down) or the thanks (up). */
export function lineAt(p: PlaceId, dir: Dir, own = ''): string {
  const mine = cleanOwn(own);
  if (mine) return mine;
  return t(`${dir === 'down' ? 'pray' : 'thank'}.${p}` as Key);
}

// ── what to do in the head (the panel's "W głowie") ──────────────

/** The push strategies: each place's own imagery or attention, one slow repetition, one rising picture for the way up. */
export const TIPS = {
  place: Object.fromEntries(PLACES.map(p => [p, `tip.place.${p}`])) as Readonly<Record<PlaceId, Key>>,
  repeat: 'tip.repeat' as Key,
  rise: 'tip.rise' as Key,
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3', 'tip.rest.4'] as readonly Key[],
  blind: ['tip.blind.1', 'tip.blind.2'] as readonly Key[],
  warmup: 'tip.warmup' as Key,
};

/**
 * The strategy of a push block at a place: the place's own picture, but every RULES.repeatEvery-th push the
 * slow repetition of the prayer (the counting/recall strategy for those who do not picture easily), and on
 * the way up every other one the rising picture of thanksgiving.
 */
export function pushTip(p: PlaceId, dir: Dir, pushIndex: number): Key {
  if ((pushIndex + 1) % RULES.repeatEvery === 0) return TIPS.repeat;
  if (dir === 'up' && pushIndex % 2 === 1) return TIPS.rise;
  return TIPS.place[p];
}

// ── the narrator's moments ────────────────────────────────────────

export const MOMENTS = [
  'open', 'warm', 'down', 'up', 'again', 'own',
  'at.mind', 'at.eyes', 'at.mouth', 'at.heart', 'at.breath', 'at.inner', 'at.feet',
  'rise', 'full', 'good', 'rest', 'blind', 'blindEnd', 'nosignal', 'wayDown', 'wayUp', 'end', 'tier',
] as const;
export type Moment = (typeof MOMENTS)[number];

/** How many lines each moment has in the catalogs (`say.<moment>.<n>`). */
export const LINE_COUNT: Readonly<Record<Moment, number>> = Object.fromEntries(MOMENTS.map(m => [m, 3])) as Record<Moment, number>;

/** The narrator's lines for a moment, in the page's language. */
export function linesOf(m: Moment): string[] {
  const out: string[] = [];
  for (let i = 1; i <= LINE_COUNT[m]; i++) out.push(t(`say.${m}.${i}` as Key));
  return out;
}
