/**
 * Ogień, ogień, ogień's data: the ladder of seven fires (what the hands do at each, its verse, the
 * frame's size as a power of ten for the "Powers of Ten" zoom, its variants), the strategies under a
 * block's name and Ignacy's moments.  The words live in the catalog (i18n.ts), in this page's language.
 *
 * The ladder (DESIGN §13.6): a spark in cupped hands → a candle in a window → a bonfire on a hill →
 * the pillar of fire over Israel's camp (the founder's "???": the first fire no hand lit, a column from the
 * sand to the clouds over a whole people — Exodus 13:21) → a star → a hypergiant in its nebula → Pentecost,
 * the Spirit sent down as tongues of fire (Acts 2:3): there the zoom turns around and comes down from the
 * sky, because that fire is a gift that meets the player's, never a product of it (§13.4).
 */
import type { PassageId } from '../kit/scripture';
import { CATALOGS, t, type Key } from './i18n';

export type RungId = 'iskra' | 'swieca' | 'ognisko' | 'slup' | 'gwiazda' | 'mega' | 'zeslanie';
/** the hands' small task at each scale */
export type TaskKind = 'blow' | 'shield' | 'feed' | 'tents' | 'fuse' | 'gather' | 'pass';

export interface RungSpec {
  id: RungId;
  task: TaskKind;
  /** the passage of its card and of the summary when it is the session's highest fire */
  verse: PassageId;
  /** the frame's width as a power of ten in metres (the zoom's counter); null: the camera comes down */
  pow: number | null;
  /** how many pictures it has (variant 0 the first; the next ones unlock with play) */
  variants: number;
}

export const RUNGS: readonly RungSpec[] = [
  { id: 'iskra', task: 'blow', verse: 'isa42.3', pow: -1, variants: 2 },
  { id: 'swieca', task: 'shield', verse: 'pro20.27', pow: 0, variants: 2 },
  { id: 'ognisko', task: 'feed', verse: 'luk24.32', pow: 2, variants: 2 },
  { id: 'slup', task: 'tents', verse: 'exo13.21', pow: 4, variants: 2 },
  { id: 'gwiazda', task: 'fuse', verse: 'dan12.3', pow: 9, variants: 2 },
  { id: 'mega', task: 'gather', verse: 'isa60.19', pow: 15, variants: 2 },
  { id: 'zeslanie', task: 'pass', verse: 'act2.3', pow: null, variants: 2 },
];

export const RUNG_IDS: readonly RungId[] = RUNGS.map(r => r.id);

/** The passages of a long burn (a long session, a long-held fire): Jeremiah 20:9, Song of Songs 8:7. */
export const LONG_BURN: readonly PassageId[] = ['jer20.9', 'sng8.7'];
/** The root (the lobby, the opening card): 2 Timothy 1:6, "fan into flame the gift of God". */
export const ROOT: PassageId = '2ti1.6';

export const rungName = (r: number): string => t(`rung.${RUNGS[clampRung(r)].id}` as Key);
/** A short name for tight places (the headline's line): Pentecost's long Polish name shortens. */
export const rungShort = (r: number): string => (RUNGS[clampRung(r)].id === 'zeslanie' ? t('short.zeslanie') : rungName(r));
export const rungDesc = (r: number): string => t(`desc.${RUNGS[clampRung(r)].id}` as Key);
export const variantName = (r: number, v: number): string => t(`var.${RUNGS[clampRung(r)].id}.${v % RUNGS[clampRung(r)].variants}` as Key);
export const scaleName = (r: number): string => t(`scale.${RUNGS[clampRung(r)].id}` as Key);
export const actName = (task: TaskKind): string => t(`act.${task}` as Key);
export const clampRung = (r: number): number => Math.max(0, Math.min(RUNGS.length - 1, Math.floor(r)));

const SUP: Readonly<Record<string, string>> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** "10⁹ m" — the frame's width as a power of ten. */
export const powText = (pow: number): string => `10${String(Math.round(pow)).split('').map(c => SUP[c] ?? c).join('')} m`;

// ── the words of a block and Ignacy's moments ───────────────────
const keysOf = (prefix: string): string[] => Object.keys(CATALOGS.pl).filter(k => k.startsWith(prefix));
const linesOf = (prefix: string): string[] => keysOf(prefix).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(k => t(k as Key));

/** The strategies: imagery of each scene (two each), a counting or recalling one in turn, blind, rest. */
export const TIPS = {
  warmup: t('tip.warmup'),
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
  push: Object.fromEntries(RUNG_IDS.map(id => [id, linesOf(`tip.push.${id}.`)])) as Record<RungId, string[]>,
  count: linesOf('tip.count.'),
  blind: linesOf('tip.blind.'),
  rest: linesOf('tip.rest.'),
};

export const MOMENTS = [
  'open', 'warm', 'push', 'blind', 'rest', 'good', 'near', 'light', 'reveal', 'pushGood', 'restGood', 'record', 'cycle', 'end',
  'calm', 'wait', 'blow', 'shield', 'gust', 'log', 'tent', 'fuse', 'gather', 'pass',
  'at.iskra', 'at.swieca', 'at.ognisko', 'at.slup', 'at.gwiazda', 'at.mega', 'at.zeslanie',
] as const;
export type Moment = (typeof MOMENTS)[number];

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, linesOf(`say.${m}.`)]),
) as unknown as Record<Moment, readonly string[]>;

/** How many lines Ignacy has (the tests check that each moment has at least three). */
export const LINE_COUNT = MOMENTS.reduce((s, m) => s + LINES[m].length, 0);

/** The moment of arriving at a fire. */
export const arrival = (r: number): Moment => `at.${RUNGS[clampRung(r)].id}` as Moment;

/** The task's own moment (what Ignacy says when the hands did it). */
export const TASK_MOMENT: Readonly<Record<TaskKind, Moment>> = {
  blow: 'blow', shield: 'shield', feed: 'log', tents: 'tent', fuse: 'fuse', gather: 'gather', pass: 'pass',
};
