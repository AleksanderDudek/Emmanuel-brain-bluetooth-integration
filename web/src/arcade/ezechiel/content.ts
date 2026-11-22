/**
 * Rzeka Ezechiela's content (DESIGN §18): the way of one session, the four marks of the water (Ezekiel 47:3-5), the
 * places on the figure where a leaf is laid in prayer, the passages of each moment (ids only — the texts come from
 * src/content/scripture.ts), the strategies for the head ("W głowie") and the narrator's moments.  No DOM, no clock.
 *
 *   Próg               dawn over a dry valley, the temple's east gate, water trickling from under its threshold (47:1)
 *   Wznoszenie         the water rises up the figure only while focus is held: ankles (47:3), knees, hips (47:4),
 *                      a river to swim in (47:5); at each mark a measuring line of light, then a rest
 *   Obmycie            a gentle current from the crown to the feet rinses the grey dust (Ps 51:7, Ezek 36:25)
 *   Drzewa             the trees on both banks put out leaves one by one (47:12, Rev 22:2); their fruit ripens
 *   Liść               a leaf laid where body or heart needs God: "Panie, Ty znasz to miejsce. Dotknij go."
 *   Spoczynek          the figure floats on the river, whole breaths
 *   Gdzie płynie rzeka far downstream the dead sea turns fresh (47:9, the root)
 */
import { PLACE, footCentre, palmCentre, type P } from '../kit/figure';
import type { PassageId } from '../kit/scripture';

/** The stages of the way, in order (the words band names them). */
export const STAGES = ['prog', 'rise', 'wash', 'trees', 'lay', 'float', 'close'] as const;
export type StageId = (typeof STAGES)[number];

/** The four marks of the water: 0 is the trickle at the feet; 1 ankles, 2 knees, 3 hips, 4 a river to swim in. */
export const MARKS = 4;
export type MarkId = 1 | 2 | 3 | 4;
export const MARK_KEYS = ['', 'ankles', 'knees', 'hips', 'river'] as const;
export type MarkKey = Exclude<(typeof MARK_KEYS)[number], ''>;

/**
 * Where the water's surface meets the figure at each mark (figure units, y down from the crown, 1 = the soles): the
 * trickle is a film over the feet; the ankles, the knees, the hips (Polish "aż do biódr"), a river up to the chest.
 */
export const MARK_Y: readonly number[] = [0.985, 0.935, 0.752, 0.5, 0.3];

/** The waterline on the figure for a level 0..4 (piecewise between the marks). */
export function waterY(level: number): number {
  const l = Math.max(0, Math.min(MARKS, level));
  const i = Math.min(MARKS - 1, Math.floor(l));
  const k = l - i;
  return MARK_Y[i] + (MARK_Y[i + 1] - MARK_Y[i]) * k;
}

/** The passage of each mark (Ezekiel 47:3, 47:4 twice — the knees and the hips are one verse — and 47:5). */
export const MARK_VERSE: Readonly<Record<MarkId, PassageId>> = { 1: 'ezk47.3', 2: 'ezk47.4', 3: 'ezk47.4', 4: 'ezk47.5' };

// ── the places of a leaf ─────────────────────────────────────────

/** Where a leaf may be laid: the body's places (front view), and "a matter of the heart" with an optional label. */
export const PLACES = ['head', 'throat', 'heart', 'back', 'belly', 'hands', 'knees', 'feet', 'matter'] as const;
export type PlaceId = (typeof PLACES)[number];

/** The places a tap on the figure can choose (a matter of the heart is chosen in the list). */
export const BODY_PLACES: readonly PlaceId[] = PLACES.filter(p => p !== 'matter');

/** The label of a matter of the heart: at most this many characters, kept only on the device. */
export const LABEL_MAX = 40;

/**
 * A place's points on the figure (figure units): one, or two for the pairs (both hands, both knees, both feet).  The
 * back is seen from the front, so its leaf rests behind the shoulder blades and shows at the side (drawn behind the
 * figure).  The heart of the body sits a little to the figure's left (`heartOrgan`); a matter of the heart is held at
 * the middle of the chest, the place of prayer of the heart.
 */
export function placePoints(p: PlaceId): readonly P[] {
  switch (p) {
    case 'head': return [[0, 0.068]];
    case 'throat': return [PLACE.throat];
    case 'heart': return [PLACE.heartOrgan];
    case 'back': return [[0.086, 0.3]];
    case 'belly': return [PLACE.belly];
    case 'hands': return [palmCentre(-1), palmCentre(1)];
    case 'knees': return [[-0.046, PLACE.knees[1]], [0.046, PLACE.knees[1]]];
    case 'feet': return [footCentre(-1), footCentre(1)];
    case 'matter': return [[0, 0.232]];
  }
}

/** The place nearest a point on the figure (figure units), or null when none is near enough (`reach`). */
export function nearestPlace(x: number, y: number, reach = 0.09): PlaceId | null {
  let best: PlaceId | null = null, bd = reach;
  for (const p of BODY_PLACES) {
    for (const [px, py] of placePoints(p)) {
      const d = Math.hypot(px - x, py - y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
  }
  return best;
}

// ── passages ──────────────────────────────────────────────────────

export const ROOT: PassageId = 'ezk47.9';
export const OPEN_VERSE: PassageId = 'ezk47.1';
/** The washing's rests, in turn (Ps 51:7 "wash me", Ezek 36:25 "I will sprinkle clean water"). */
export const WASH_VERSES: readonly PassageId[] = ['psa51.7', 'ezk36.25'];
/**
 * The leaf's rests, in turn: the leaves "for healing" (Ezek 47:12) first, then the prayers for health of Scripture —
 * Jer 17:14 "Heal me, O LORD", Ps 147:3, Rev 22:2, Ex 15:26, Isa 58:11.  The words name God as the one who heals; the
 * game never says the leaf or the water does.
 */
export const LAY_VERSES: readonly PassageId[] = ['ezk47.12', 'jer17.14', 'rev22.2', 'psa147.3', 'exo15.26', 'isa58.11'];
/** The floating rest, in turn by session (Isa 43:2 "when you pass through the waters, I will be with you"…). */
export const FLOAT_VERSES: readonly PassageId[] = ['isa43.2', 'psa46.4', 'jhn7.38-39'];
/** Every passage the game names (the tests check each exists in all four editions). */
export const ALL_VERSES: readonly PassageId[] = [
  ROOT, OPEN_VERSE, ...new Set(Object.values(MARK_VERSE)), ...WASH_VERSES, ...LAY_VERSES, ...FLOAT_VERSES,
];

// ── the strategies for the head ("W głowie") ─────────────────────

/** The i18n keys of each kind of block's strategies (the sim takes them in turn). */
export const TIPS = {
  warm: ['tip.warm'],
  rise: { ankles: 'tip.rise.ankles', knees: 'tip.rise.knees', hips: 'tip.rise.hips', river: 'tip.rise.river' } as const,
  count: 'tip.count',
  wash: ['tip.wash.1', 'tip.wash.2'],
  trees: ['tip.trees.1', 'tip.trees.2'],
  blind: ['tip.blind.1', 'tip.blind.2'],
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3'],
  lay: ['tip.lay'],
  float: ['tip.float'],
  close: 'tip.close',
} as const;

// ── the narrator's moments ───────────────────────────────────────

/** Each moment has a few lines (i18n `talk.<moment>.1…n`); the narrator says one at a time. */
export const MOMENTS = [
  'open', 'warm', 'ankles', 'knees', 'hips', 'river', 'mark', 'good', 'still', 'nosignal', 'rest', 'release', 'wash',
  'washed', 'trees', 'leaf', 'lay', 'fruit', 'float', 'end', 'blind', 'blindEnd', 'valve', 'more',
] as const;
export type Moment = (typeof MOMENTS)[number];
/** How many lines each moment has in every language (the catalogs keep to it; a test checks). */
export const LINE_COUNT = 3;
