/**
 * Brzemiona's content (DESIGN.md §18): whom the player prays for, the circles a burden widens through, the verses
 * of each step, the strategies for the head, and the narrator's moments.  No canvas, no DOM.
 *
 *   an item       one entry of the prayer list: a person by name (what they carry optional), the player ("ja", only
 *                 when they put themselves on the list), a kind of burden (the sick, the sad, the lonely, the
 *                 afraid, the grieving, those in conflict — kinds, never diagnoses) or the whole world
 *   a circle      how wide the prayer is: the one ("one"), all who carry a burden like it ("many"), the whole
 *                 world ("world"); a session widens each burden as far as its length allows (rules.ts `depthFor`)
 *   the two ways  (round 16) "Moje brzemiona" (`own`): the player gives their own burdens to the Cross — each a topic
 *                 they named ("praca", "zdrowie mamy"), drawn as a closed bundle beside them; its circles are
 *                 "Oddaję" (`give`: smoke from the bundle to the Cross, light back to the player) and, from 10 minutes,
 *                 "Przyjmuję" (`receive`: the light-only exchange, the Cross's peace to the player — the great
 *                 exchange).  "Za innych" (`others`): the intercession as it was.
 *
 * The prayer goes to Jesus and through Him to the Father, in the Spirit; a burden is carried to the Cross, never
 * into the one who prays, and what returns to the one prayed for is received mercy (Gal 6:2, Mt 11:28-30,
 * 1 Pet 5:7, Isa 53:4).  Verses only as passage ids (kit/scripture.ts).
 */
import type { PassageId } from '../kit/scripture';

/** The kinds of burden a list item may carry (kinds, never diagnoses). */
export const KINDS = ['illness', 'sadness', 'loneliness', 'fear', 'grief', 'conflict'] as const;
export type KindId = (typeof KINDS)[number];

/** Who an item is: a person, the player, a kind of burden, the whole world — or (the own way) a topic of the player's. */
export type Who = 'person' | 'me' | 'kind' | 'world' | 'topic';

/** The game's two ways: the player's own burdens given to the Cross, or the intercession for others. */
export type Way = 'own' | 'others';
export const WAYS: readonly Way[] = ['own', 'others'];

export interface Item {
  who: Who;
  /** a person's name, or the own way's topic, as the player wrote it ('' for the others) */
  name: string;
  /** what they carry (a person, the player), or the kind itself (a kind); null: not said */
  kind: KindId | null;
}

/** How wide a burden's prayer is (the intercession's ladder). */
export const CIRCLES = ['one', 'many', 'world'] as const;
/** The own way's ladder: "Oddaję" (give it to the Cross), then "Przyjmuję" (receive His peace in exchange). */
export const OWN_CIRCLES = ['give', 'receive'] as const;
export type Circle = (typeof CIRCLES)[number] | (typeof OWN_CIRCLES)[number];

/** A circle's place on its own ladder (one 0, many 1, world 2; give 0, receive 1). */
export const circleIndex = (c: Circle): number => (c === 'give' || c === 'receive' ? OWN_CIRCLES.indexOf(c) : CIRCLES.indexOf(c));

/** The list holds at most this many entries; a name at most this many characters. */
export const LIST_MAX = 12;
export const NAME_MAX = 40;
/** The own way's topic: at most this many characters (a nominative phrase written by the bundle and in the address). */
export const TOPIC_MAX = 32;

/** The list of a first session (and of anyone who saved none): the six kinds, then the whole world. */
export const DEFAULT_LIST: readonly Item[] = [
  ...KINDS.map(k => ({ who: 'kind' as const, name: '', kind: k })),
  { who: 'world', name: '', kind: null },
];

/** An item's key: the same entry across sessions (a burden in progress resumes by it). */
export function itemKey(it: Item): string {
  if (it.who === 'person') return `p:${it.name}`;
  if (it.who === 'kind') return `k:${it.kind}`;
  if (it.who === 'topic') return `t:${it.name}`;
  return it.who;
}

/**
 * A name as kept: plain text — no markup, no control characters, single spaces, at most NAME_MAX characters.  (It is
 * drawn on a canvas and set as text in the card, never as markup; still, nothing odd is kept.)
 */
export function cleanName(v: unknown, max = NAME_MAX): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, max).join('').trim();
}

/** A topic of the own way as kept: plain text, single spaces, at most TOPIC_MAX characters. */
export const cleanTopic = (v: unknown): string => cleanName(v, TOPIC_MAX);

/** The same topic, whatever its case or spacing (no two on a list). */
export const topicKey = (s: string): string => cleanTopic(s).toLocaleLowerCase();

/** A topic as an item of the session's queue. */
export const topicItem = (name: string): Item => ({ who: 'topic', name, kind: null });

const isKind = (v: unknown): v is KindId => typeof v === 'string' && (KINDS as readonly string[]).includes(v);

/** An item from anything saved: null when it does not hold. */
export function cleanItem(v: unknown): Item | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = isKind(o.kind) ? o.kind : null;
  if (o.who === 'person') {
    const name = cleanName(o.name);
    return name ? { who: 'person', name, kind } : null;
  }
  if (o.who === 'me') return { who: 'me', name: '', kind };
  if (o.who === 'kind') return kind ? { who: 'kind', name: '', kind } : null;
  if (o.who === 'world') return { who: 'world', name: '', kind: null };
  if (o.who === 'topic') {
    const name = cleanTopic(o.name);
    return name ? topicItem(name) : null;
  }
  return null;
}

/** A saved list, cleaned: valid items (never a topic: those are the own way's), no two with the same key, at most LIST_MAX. */
export function cleanList(v: unknown): Item[] {
  if (!Array.isArray(v)) return [];
  const out: Item[] = [];
  const keys = new Set<string>();
  for (const x of v) {
    const it = cleanItem(x);
    if (!it || it.who === 'topic' || keys.has(itemKey(it))) continue;
    keys.add(itemKey(it));
    out.push(it);
    if (out.length >= LIST_MAX) break;
  }
  return out;
}

/**
 * The circles of a burden for a session's depth (1–3): the one, then the whole world, then — in long sessions —
 * all who carry the same between them.  The whole world as an item is one circle, the world itself.  A topic of the
 * own way: "Oddaję" under 10 minutes (depth 1–2), "Oddaję" and "Przyjmuję" from 10 minutes (depth 3).
 */
export function circlesOf(it: Item, depth: number): readonly Circle[] {
  if (it.who === 'topic') return depth >= 3 ? OWN_CIRCLES : ['give'];
  if (it.who === 'world') return ['world'];
  if (depth <= 1) return ['one'];
  if (depth === 2) return ['one', 'world'];
  return CIRCLES;
}

/** Every circle a burden can be widened to by hand (◎): the whole ladder (the world: itself). */
export const allCirclesOf = (it: Item): readonly Circle[] => (it.who === 'topic' ? OWN_CIRCLES : it.who === 'world' ? ['world'] : CIRCLES);

// ── the verses ───────────────────────────────────────────────────
/** The game's root (the lobby opens with it). */
export const ROOT: PassageId = 'gal6.2';

/** The verse shown with each circle's exchange, by circle (in turn by the burden's number). */
export const CIRCLE_VERSES: Readonly<Record<Circle, readonly PassageId[]>> = {
  one: ['isa53.4', 'mat11.28', '1pe2.24'],
  many: ['rom12.15', 'gal6.2', '2co1.3-4'],
  world: ['jhn1.29', 'jhn3.16', 'psa24.1'],
  give: ['mat11.28', '1pe5.7', 'psa62.8'],
  receive: ['jhn14.27', 'isa54.10', 'zep3.17'],
};

/** The rest after a circle (peace returns), in turn. */
export const REST_VERSES: readonly PassageId[] = ['jhn14.27', 'psa34.5', 'isa61.3'];
/** The rest after a burden's last circle: left at the Cross. */
export const LEAVE_VERSE: PassageId = '1pe5.7';
/** The quiet finale: everything left at the Cross, the yoke easy. */
export const FINALE_VERSE: PassageId = 'mat11.29-30';
/** The summary's closing passage, in turn (the brief: 2 Cor 1:3-4 or Mt 11:28). */
export const CLOSE_VERSES: readonly PassageId[] = ['2co1.3-4', 'mat11.28'];
/**
 * The own way: the rest after a burden's last circle ("Zostawiam to przy Twoim krzyżu, Panie."), a verse in turn by
 * the burden's number; the finale's verse (He carries: Isa 46:4).
 */
export const OWN_LEAVE_VERSES: readonly PassageId[] = ['mat11.28', '1pe5.7', 'psa62.8', 'heb4.16', '2co12.9', 'isa53.4', 'mat11.29-30'];
export const OWN_FINALE_VERSE: PassageId = 'isa46.4';
export const ownLeaveVerse = (n: number): PassageId => OWN_LEAVE_VERSES[Math.max(0, n) % OWN_LEAVE_VERSES.length];

export const verseFor = (c: Circle, n: number): PassageId => CIRCLE_VERSES[c][Math.max(0, n) % CIRCLE_VERSES[c].length];
export const restVerse = (n: number): PassageId => REST_VERSES[Math.max(0, n) % REST_VERSES.length];

// ── the strategies ("W głowie") ───────────────────────────────────
/** A push's strategy: imagery and attention at the Cross, never "concentrate harder"; every third the slow words. */
export const PUSH_TIPS = ['tip.push.face', 'tip.push.smoke', 'tip.push.words', 'tip.push.gold', 'tip.push.cross', 'tip.push.words'] as const;
export const LIGHT_TIPS = ['tip.light.face', 'tip.light.cross', 'tip.push.words'] as const;
export const REST_TIPS = ['tip.rest.breath', 'tip.rest.peace', 'tip.rest.leave'] as const;
export const WARM_TIP = 'tip.warm' as const;
/** The own way's strategies: the topic named once and seen as the bundle, the smoke leaving it; the receiving words. */
export const OWN_PUSH_TIPS = ['tip.own.name', 'tip.own.smoke', 'tip.push.words', 'tip.push.gold', 'tip.push.cross', 'tip.push.words'] as const;
export const OWN_LIGHT_TIPS = ['tip.own.light', 'tip.light.cross', 'tip.own.words'] as const;
export const OWN_REST_TIPS = ['tip.rest.breath', 'tip.own.peace', 'tip.rest.leave'] as const;
export const OWN_WARM_TIP = 'tip.own.warm' as const;

// ── the narrator ─────────────────────────────────────────────────
/** The narrator's moments: each has LINE_COUNT variants in each language (i18n `say.<moment>.<n>`). */
export const MOMENTS = [
  'open', 'call', 'me', 'many', 'world', 'good', 'wait', 'rest', 'leave', 'nosignal', 'valve', 'end', 'light', 'resume',
  // the own way's own lines (round 16): where the intercession's speak of "them"; and the receiving circle
  'ownOpen', 'ownCall', 'ownWait', 'ownRest', 'ownLeave', 'ownValve', 'ownLight', 'receive',
] as const;
export type Moment = (typeof MOMENTS)[number];

/** The own way says its own line where the intercession's speaks of the one prayed for. */
export const OWN_MOMENT: Partial<Record<Moment, Moment>> = {
  open: 'ownOpen', call: 'ownCall', wait: 'ownWait', rest: 'ownRest', leave: 'ownLeave', valve: 'ownValve', light: 'ownLight',
};
export const LINE_COUNT = 3;
