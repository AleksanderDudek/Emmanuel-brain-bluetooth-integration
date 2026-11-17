/**
 * Rzeki żywej wody's stations (DESIGN.md §13.14, the founder's decision of 2026-11-17): every centre of the two
 * pictures the founder sent — picture 1, the chart "Energy centres & the subtle system" (seven centres on the spine
 * with their Sanskrit names and numbers, the sacrum bone, the Void, the three channels, the hand map), and picture 2,
 * the twelve-point map (the seven, the soul, solar and earth stars, two shells around the body) — and the hands and
 * the feet the founder asked for.  Each station has its place on the figure, its glass (the pictures' colours), its
 * rose window's tracery, the gift Scripture names for it, a verse going down and going up, and a bell.
 *
 * The names are the maps' names, shown as labels (the word "czakra" only where a name has it); nothing here says
 * that energy flows or heals.  The prayer keeps the founder's form ("Przez Jezusa Chrystusa, Duchu Święty,
 * wypełnij … i niech popłynie …") with the gift of each station: the Spirit is a Person, not a force.
 *
 * The four maps (the lobby's card chooses; all by default) order the stations from the top down; a way down walks
 * a map's list in order (the light received from above), a way up walks it reversed (thanks rising).
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { RULES } from './rules';

export const STATIONS = [
  'gateway', 'galactic', 'solar', 'soul', 'crown', 'channels', 'brow', 'throat', 'heart', 'hands', 'plexus', 'void', 'sacral', 'sacrum',
  'root', 'feet', 'earth',
] as const;
export type StationId = (typeof STATIONS)[number];

/**
 * How a station is drawn:
 *   point     a rose window on the midline (its glass opens petal by petal)
 *   shell     an egg-shaped outline of light around the whole figure: its glass segments light in turn from a
 *             keystone window at its apex (the two shells of picture 2)
 *   channels  three lancets of glass along the body — Pingala gold on the viewer's left (a sun at its top), Sushumna
 *             white on the midline, Ida silver on the viewer's right (a crescent moon)
 *   ring      a ring of sea-green glass around the middle of the body (picture 1's green circle, the Void)
 *   bone      the triangular sacrum of pearl glass, with a spiral of light (3½ turns) that draws itself
 *   hands     both hands become stained glass: the wrist, the five fingers, the palm — the hand map 1…7
 *   feet      both feet become glass, their soles lighting the ground
 */
export type StationKind = 'point' | 'shell' | 'channels' | 'ring' | 'bone' | 'hands' | 'feet';

/** Where the camera looks while a station is the current one (layout.ts `FRAMES`). */
export type Framing = 'body' | 'sky' | 'heavens' | 'hands' | 'ground';

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
  /** a colour for each inner petal (the hands: the five fingers' glass; the channels: gold, white, silver) */
  innerEach?: readonly string[];
  /** a colour for each outer petal (the crown: picture 1's many-coloured crown) */
  outerEach?: readonly string[];
}

export interface StationSpec {
  kind: StationKind;
  /** the station's anchor on the figure (figure units: x across, the viewer's left negative; y 0 the crown … 1 the soles) */
  x: number;
  y: number;
  /** the station's own light and a deep tone of it */
  hue: string;
  deep: string;
  rose: Rose;
  /** the verse: going down, and going up */
  verse: { down: PassageId; up: PassageId };
  /** the bell's step on the pentatonic ladder (strictly falling along the full map's way down) */
  bell: number;
  frame: Framing;
  /** picture 1's Sanskrit name (as the chart spells it) and number, where the chart has the centre */
  sanskrit?: string;
  num?: number;
  /** on picture 2's twelve-point map */
  map12: boolean;
  /** the current window's size (1: 0.105 H open in full) */
  size: number;
}

/** The hand map's colours (picture 1, both hands alike): 1 the wrist … 7 the palm's centre. */
export const HAND_COLOURS = {
  wrist: '#ff5a5a', thumb: '#ff9a3c', middle: '#ffe066', little: '#5fe39a', index: '#5fb2ff', ring: '#7f7bff', palm: '#b98cff',
} as const;
export type HandPart = keyof typeof HAND_COLOURS;
/** The hand map's numbers (Sahaja Yoga's chart decoding the centres on the hands): 1 wrist, 2 thumb, 3 middle, 4 little, 5 index, 6 ring, 7 palm. */
export const HAND_ORDER: readonly HandPart[] = ['wrist', 'thumb', 'middle', 'little', 'index', 'ring', 'palm'];

/** The crown's many-coloured petals (picture 1): a rainbow around the violet. */
const RAINBOW = ['#ff6b6b', '#ff9a3c', '#ffd34d', '#8be36a', '#45d6b4', '#5fb2ff', '#7f7bff', '#b98cff', '#ff7ad9', '#ff6b9a', '#ffb86b', '#9fe6ff'] as const;

export const STATION: Readonly<Record<StationId, StationSpec>> = {
  gateway: {
    kind: 'shell', x: 0, y: -0.585, hue: '#fff1cf', deep: '#b08a3e', bell: 16, frame: 'heavens', map12: true, size: 0.62,
    rose: { inner: 6, innerShape: 'arch', outer: 12, outerShape: 'lancet', twist: 0.5, glass: ['#ffffff', '#ffe9b0', '#f3c86a'] },
    verse: { down: 'gen28.17', up: 'jhn10.9' },
  },
  galactic: {
    kind: 'shell', x: 0, y: -0.465, hue: '#7cc4f0', deep: '#2a2f7a', bell: 15, frame: 'heavens', map12: true, size: 0.62,
    rose: { inner: 8, innerShape: 'drop', outer: 16, outerShape: 'lancet', twist: 0.5, glass: ['#eef8ff', '#5aa7d8', '#4446b0'] },
    verse: { down: 'psa8.3-4', up: 'psa19.1' },
  },
  solar: {
    kind: 'point', x: 0, y: -0.33, hue: '#ffb347', deep: '#a8581c', bell: 14, frame: 'sky', map12: true, size: 0.84,
    rose: { inner: 8, innerShape: 'lobe', outer: 16, outerShape: 'lancet', twist: 0.5, glass: ['#fff3cf', '#ffc65a', '#ff8f2e'] },
    verse: { down: 'jas1.17', up: 'isa60.19' },
  },
  soul: {
    kind: 'point', x: 0, y: -0.175, hue: '#eef1ff', deep: '#8d96bf', bell: 13, frame: 'sky', map12: true, size: 0.84,
    rose: { inner: 7, innerShape: 'lobe', outer: 14, outerShape: 'drop', twist: 0.5, glass: ['#ffffff', '#f1f3ff', '#c3cdee'] },
    verse: { down: 'psa23.3', up: 'psa42.1' },
  },
  crown: {
    kind: 'point', x: 0, y: -0.022, hue: '#b98cff', deep: '#5b2fa8', bell: 12, frame: 'body', sanskrit: 'Sahastrara', num: 7, map12: true, size: 1,
    rose: { inner: 12, innerShape: 'lobe', outer: 12, outerShape: 'lancet', twist: 0.5, glass: ['#fff3ff', '#b98cff', '#ff9ad6'], outerEach: RAINBOW },
    verse: { down: 'php4.7', up: 'php4.7' },
  },
  channels: {
    kind: 'channels', x: 0, y: 0.028, hue: '#f4f2ff', deep: '#7b7fae', bell: 11, frame: 'body', sanskrit: 'Ida · Sushumna · Pingala', map12: false, size: 1,
    rose: { inner: 3, innerShape: 'lancet', outer: 6, outerShape: 'arch', twist: 0.5, glass: ['#ffffff', '#ffffff', '#c9d6f5'], innerEach: ['#ffd166', '#ffffff', '#b9d4ff'] },
    verse: { down: 'isa30.21', up: 'psa121.6' },
  },
  brow: {
    kind: 'point', x: 0, y: 0.062, hue: '#8a86ff', deep: '#2e2a8c', bell: 10, frame: 'body', sanskrit: 'Agnya', num: 6, map12: true, size: 1,
    rose: { inner: 8, innerShape: 'lancet', outer: 16, outerShape: 'lobe', twist: 0, glass: ['#ece9ff', '#8a86ff', '#4a44c4'] },
    verse: { down: 'eph1.18', up: 'eph1.18' },
  },
  throat: {
    kind: 'point', x: 0, y: 0.166, hue: '#5fb2ff', deep: '#1f5aa8', bell: 9, frame: 'body', sanskrit: 'Vishuddhi', num: 5, map12: true, size: 1,
    rose: { inner: 6, innerShape: 'lobe', outer: 12, outerShape: 'drop', twist: 0.5, glass: ['#e6f6ff', '#6cc0ff', '#2f7fe0'] },
    verse: { down: 'psa141.3', up: 'heb13.15' },
  },
  heart: {
    kind: 'point', x: 0, y: 0.27, hue: '#5fe39a', deep: '#1d8a4e', bell: 8, frame: 'body', sanskrit: 'Anahata', num: 4, map12: true, size: 1,
    rose: { inner: 5, innerShape: 'lobe', outer: 10, outerShape: 'arch', twist: 0.5, glass: ['#f0fff4', '#6ee8a4', '#22b46a'] },
    verse: { down: 'rom5.5', up: 'rom5.5' },
  },
  hands: {
    kind: 'hands', x: 0, y: 0.53, hue: '#e4d0ff', deep: '#7a5bb5', bell: 7, frame: 'hands', map12: false, size: 1,
    rose: {
      inner: 5, innerShape: 'lobe', outer: 10, outerShape: 'drop', twist: 0.5, glass: [HAND_COLOURS.palm, HAND_COLOURS.middle, HAND_COLOURS.wrist],
      innerEach: [HAND_COLOURS.thumb, HAND_COLOURS.index, HAND_COLOURS.middle, HAND_COLOURS.ring, HAND_COLOURS.little],
    },
    verse: { down: 'psa90.17', up: 'psa63.4' },
  },
  plexus: {
    kind: 'point', x: 0, y: 0.352, hue: '#ffe066', deep: '#a88a1a', bell: 6, frame: 'body', sanskrit: 'Nabhi', num: 3, map12: true, size: 1,
    rose: { inner: 3, innerShape: 'lobe', outer: 9, outerShape: 'lancet', twist: 0, glass: ['#fffbe6', '#ffe36a', '#f5b829'] },
    verse: { down: 'jhn20.22', up: 'eph3.16' },
  },
  void: {
    kind: 'ring', x: 0, y: 0.383, hue: '#45d6b4', deep: '#13806a', bell: 5, frame: 'body', sanskrit: 'Bhavsagar', map12: false, size: 1,
    rose: { inner: 8, innerShape: 'drop', outer: 16, outerShape: 'lobe', twist: 0.5, glass: ['#e6fff8', '#5ee0c0', '#1fa58a'] },
    verse: { down: 'psa107.29', up: 'psa46.4' },
  },
  sacral: {
    kind: 'point', x: 0, y: 0.43, hue: '#ff9a3c', deep: '#a8501a', bell: 4, frame: 'body', sanskrit: 'Swadhisthana', num: 2, map12: true, size: 1,
    rose: { inner: 6, innerShape: 'drop', outer: 12, outerShape: 'arch', twist: 0.5, glass: ['#fff1dc', '#ffa64d', '#f0741f'] },
    verse: { down: 'jhn7.38-39', up: 'jhn7.38-39' },
  },
  sacrum: {
    kind: 'bone', x: 0, y: 0.49, hue: '#dbe6ff', deep: '#6f82b5', bell: 3, frame: 'body', sanskrit: 'Mooladhara', map12: false, size: 1,
    rose: { inner: 3, innerShape: 'lancet', outer: 9, outerShape: 'drop', twist: 0.5, glass: ['#ffffff', '#e2eaff', '#9fb6e8'] },
    verse: { down: 'ezk37.5-6', up: 'rom8.11' },
  },
  root: {
    kind: 'point', x: 0, y: 0.56, hue: '#ff5a5a', deep: '#a01e2a', bell: 2, frame: 'body', sanskrit: 'Mooladhara', num: 1, map12: true, size: 1,
    rose: { inner: 4, innerShape: 'lobe', outer: 8, outerShape: 'arch', twist: 0.5, glass: ['#ffe6e0', '#ff6464', '#d8283a'] },
    verse: { down: 'col2.7', up: 'eph3.17' },
  },
  feet: {
    kind: 'feet', x: 0, y: 0.975, hue: '#ec9a5e', deep: '#8a4a22', bell: 1, frame: 'ground', map12: false, size: 1,
    rose: { inner: 4, innerShape: 'lobe', outer: 8, outerShape: 'lancet', twist: 0.5, glass: ['#ffe6cf', '#f0a066', '#c46a2e'] },
    verse: { down: 'psa40.2', up: 'psa18.32' },
  },
  earth: {
    kind: 'point', x: 0, y: 1.08, hue: '#c49062', deep: '#5a3a22', bell: 0, frame: 'ground', map12: true, size: 0.72,
    rose: { inner: 4, innerShape: 'lancet', outer: 8, outerShape: 'drop', twist: 0.5, glass: ['#ffe6a8', '#c08a5a', '#7a4f2e'] },
    verse: { down: 'psa85.11', up: 'isa6.3' },
  },
};

// ── the maps ──────────────────────────────────────────────────────

export const MAPS = ['all', 'twelve', 'subtle', 'seven'] as const;
export type MapId = (typeof MAPS)[number];

/** Each map's stations from the top down, and the picture it comes from (0: both, and the founder's hands and feet). */
export const MAP: Readonly<Record<MapId, { stations: readonly StationId[]; picture: 0 | 1 | 2 }>> = {
  all: { stations: STATIONS, picture: 0 },
  twelve: { stations: ['gateway', 'galactic', 'solar', 'soul', 'crown', 'brow', 'throat', 'heart', 'plexus', 'sacral', 'root', 'earth'], picture: 2 },
  subtle: { stations: ['crown', 'channels', 'brow', 'throat', 'heart', 'hands', 'plexus', 'void', 'sacral', 'sacrum', 'root'], picture: 1 },
  seven: { stations: ['crown', 'brow', 'throat', 'heart', 'hands', 'plexus', 'sacral', 'root', 'feet'], picture: 0 },
};

export type Dir = 'down' | 'up';
export type Way = 'down' | 'up' | 'both';
export const WAYS: readonly Way[] = ['down', 'up', 'both'];

/** A map's stations in the order a way visits them: down from the top, up from the bottom. */
export const route = (map: MapId, dir: Dir): readonly StationId[] => (dir === 'down' ? MAP[map].stations : [...MAP[map].stations].reverse());

/** The ways one round of a session walks: down, up, or down and then up. */
export const legs = (way: Way): readonly Dir[] => (way === 'both' ? ['down', 'up'] : [way]);

/** The verse of a station on a way. */
export const verseOf = (s: StationId, dir: Dir): PassageId => STATION[s].verse[dir];

/**
 * The places of the first version (seven on the midline) and the stations they became, for a version-1 save:
 * the head is the crown, the eyes the brow, the mouth the throat, the breath the solar plexus, the inner well the
 * sacral centre; the heart and the feet stay.
 */
export const V1_PLACES: Readonly<Record<string, StationId>> = {
  mind: 'crown', eyes: 'brow', mouth: 'throat', heart: 'heart', breath: 'plexus', inner: 'sacral', feet: 'feet',
};

/**
 * A window's glass grows richer the more often its station is lit, across sessions (the meta loop, shown in
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

/** A station's own name ("Serce", "Gwiazda duszy"). */
export const stationName = (s: StationId): string => t(`name.${s}` as Key);
/** What the maps call it beside its name: picture 1's Sanskrit name and number, or picture 2's map, or the hand map. */
export function stationTag(s: StationId): string {
  const st = STATION[s];
  if (s === 'hands') return t('tag.hands');
  if (st.sanskrit) return st.num ? `${st.sanskrit} (${st.num})` : st.sanskrit;
  return st.map12 ? t('tag.map12') : '';
}
/** The name with its tag: „Serce · Anahata (4)”, „Gwiazda duszy · mapa 12 centrów”, „Stopy”. */
export function stationLabel(s: StationId): string {
  const tag = stationTag(s);
  return tag ? `${stationName(s)} · ${tag}` : stationName(s);
}
export const stationWhere = (s: StationId): string => t(`where.${s}` as Key);
export const giftName = (s: StationId): string => t(`gift.${s}` as Key);
/** "from the station", as the summary and the card say where the way goes on ("od Serca", "from the Heart"). */
export const fromText = (s: StationId): string => t(`from.${s}` as Key);
export const mapName = (m: MapId): string => t(`map.${m}` as Key);
export const mapPicture = (m: MapId): string => t(`map.${m}.pic` as Key);

/**
 * The own words, as plain text: control characters and angle brackets out, spaces folded, at most
 * RULES.ownMax characters (counted as the reader sees them).  Never markup: the game sets it as text.
 */
export function cleanOwn(s: unknown): string {
  if (typeof s !== 'string') return '';
  const flat = s.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...flat].slice(0, RULES.ownMax).join('').trim();
}

/** The line said at a station: the player's own words when they wrote some, else the prayer (down) or the thanks (up). */
export function lineAt(s: StationId, dir: Dir, own = ''): string {
  const mine = cleanOwn(own);
  if (mine) return mine;
  return t(`${dir === 'down' ? 'pray' : 'thank'}.${s}` as Key);
}

// ── what to do in the head (the panel's "W głowie") ──────────────

/** The push strategies: each station's own imagery or attention, one slow repetition, one rising picture for the way up. */
export const TIPS = {
  place: Object.fromEntries(STATIONS.map(s => [s, `tip.place.${s}`])) as Readonly<Record<StationId, Key>>,
  repeat: 'tip.repeat' as Key,
  rise: 'tip.rise' as Key,
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3', 'tip.rest.4'] as readonly Key[],
  blind: ['tip.blind.1', 'tip.blind.2'] as readonly Key[],
  warmup: 'tip.warmup' as Key,
};

/**
 * The strategy of a push block at a station: its own picture, but every RULES.repeatEvery-th push the slow
 * repetition of the prayer (the counting/recall strategy for those who do not picture easily), and on the way
 * up every other one the rising picture of thanksgiving.
 */
export function pushTip(s: StationId, dir: Dir, pushIndex: number): Key {
  if ((pushIndex + 1) % RULES.repeatEvery === 0) return TIPS.repeat;
  if (dir === 'up' && pushIndex % 2 === 1) return TIPS.rise;
  return TIPS.place[s];
}

// ── the narrator's moments ────────────────────────────────────────

export const MOMENTS = [
  'open', 'warm', 'down', 'up', 'again', 'own', 'resume',
  ...STATIONS.map(s => `at.${s}` as const),
  'rise', 'full', 'good', 'rest', 'valve', 'blind', 'blindEnd', 'nosignal', 'wayDown', 'wayUp', 'end', 'tier', 'wait',
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
