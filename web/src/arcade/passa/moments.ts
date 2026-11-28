/**
 * Złota passa's moments (DESIGN.md §26): the lead's contract between the game (rules.ts, sim.ts, content.ts: builder A)
 * and the street (scene.ts, render.ts: builder B).  Pure types and the few rules every part must share.
 *
 * The founder's inspiration (a reel): a man diagnosed with a brain tumour starts a game with himself, "the winning
 * streak" — the coffee that costs two dollars is a win, the green light is a win, the far parking spot is a win (more
 * steps), and once he *identifies* as someone on a winning streak he keeps finding the reasons that confirm it, until
 * even the hard things become "the reason why…".  The app keeps that — noticing, reframing, an identity that looks
 * for the evidence — and roots it where a Christian can stand: not "the universe conspires for me", but *"we know that
 * all things work together for good to them that love God"* (Rom 8:28); not "nothing bad has ever happened to me", but
 * Joseph's *"you meant evil against me; God meant it for good"* (Gen 50:20) — the evil is named as evil, the hurt as
 * hurt, and the good God brings out of it is hoped for, not pretended.
 *
 * A session is one day walked down a street from morning to evening.  Its moments come one after another:
 *
 *   joy     a small good thing (the coffee, the sun, a green light, a kind word) — the win is to *see* it and give
 *           thanks: focus brings it to light
 *   snag    a small trouble (the far parking spot, rain, a queue, a delay, spilled coffee) — the card has two sides:
 *           the grey one as it happened, the gold one as a win; the player picks (or brings) the reframe, focus turns
 *           the card
 *   heavy   something that really hurts (a diagnosis, a loss, a lost job, a body that is not as hoped) — offered only
 *           when the player asks for it in the lobby; the rest comes *first* (the hurt is named, Ps 34:18), then the
 *           push asks "what can God bring out of this?" — gentle hopes, never a promise — and "not yet; I trust"
 *           is always a choice, and a win of its own (trust)
 *
 * Every card turned by focus is a win: a light lit in the garland strung over the street (the streak).  A card focus
 * did not turn is never turned for the player: it "goes with you" — no false win, no blame.  The day's last light is
 * the identity: "Jestem na złotej passie — wszystko współdziała ku dobremu."
 *
 * Round 25 (life.ts) adds the age group's day as a film of life, and two kinds of moment: `sense` and `given`.
 */
import { LIFE_MOTIFS, type LifeMotif } from './life';

export type MomentKind = 'joy' | 'snag' | 'heavy';

/** The day's time where a moment happens (the street's light follows it): morning → evening. */
export type DayPart = 'morning' | 'noon' | 'afternoon' | 'evening';
export const DAY_PARTS: readonly DayPart[] = ['morning', 'noon', 'afternoon', 'evening'];

/**
 * What a moment's card shows, picked by the street's art (B draws one small picture per motif): a cup, a traffic
 * light, a car far from the door, rain, a queue, a clock, a spilled cup, a phone, a smile, the sun, a bird, a letter,
 * a bus, a medical card, an empty desk, a scale, a broken heart, a closed door, a seed, a hand.
 */
export type Motif =
  | 'cup' | 'light' | 'car' | 'rain' | 'queue' | 'clock' | 'spill' | 'phone' | 'smile' | 'sun' | 'bird' | 'letter'
  | 'bus' | 'clinic' | 'desk' | 'scale' | 'heart' | 'door' | 'seed' | 'hand'
  // round 25 (life.ts `LIFE_MOTIFS`): the things of a sense or a given moment, and the group sets' cards
  | LifeMotif;

/** Every motif a card may carry: round 22's twenty, then (round 25) the twenty of life.ts. */
export const MOTIFS: readonly Motif[] = [
  'cup', 'light', 'car', 'rain', 'queue', 'clock', 'spill', 'phone', 'smile', 'sun', 'bird', 'letter',
  'bus', 'clinic', 'desk', 'scale', 'heart', 'door', 'seed', 'hand',
  ...LIFE_MOTIFS,
];

/** (round 25) The same list under the name the round's code uses. */
export const ALL_MOTIFS: readonly Motif[] = MOTIFS;

/** One moment of the day, as the sim plays it (the words already in the page's language). */
export interface Moment {
  id: string;
  kind: MomentKind;
  motif: Motif;
  part: DayPart;
  /** the grey side: what happened ("Jedyne wolne miejsce — na końcu parkingu") */
  what: string;
  /**
   * the gold side's choices (1–3): the reframes the player may pick; a joy has one ("Dziękuję za tę kawę"), a snag two
   * or three, a heavy two or three hopes plus `trust`
   */
  wins: readonly string[];
  /** a heavy moment's "not yet — I trust" (always offered there; picking it is a win of trust) */
  trust?: string;
  /** the player's own moment from the lobby ("Mój dzień") — never in the result */
  own: boolean;
}

/** How many moments a session may hold at most of each kind (a heavy one only when the player asks for it). */
export const HEAVY_MAX = 1;

/** The garland's lights: one per win (the streak); the street shows at most this many bulbs, then they double up. */
export const GARLAND_MAX = 40;
