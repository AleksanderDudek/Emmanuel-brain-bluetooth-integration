/**
 * Światło w dłoniach — what a prayer is made of (DESIGN.md §18): its steps, whom it is for, where a hand may be laid,
 * the passages each moment reads, and the narrator's moments.  Pure data and small pure helpers; the words live in
 * i18n.ts (keys only here), the numbers in rules.ts.
 *
 * One prayer walks six steps, each a block of the session (the runner's signal: free, rest or focus):
 *
 *   rub      Rozgrzanie — the hands rub their palms (the player really does it); a short timer, not gated
 *   breathe  Oddech dłoni — whole breaths: the hands move apart on the in-breath, closer on the out-breath, threads of
 *            light between the fingertips (rest)
 *   ball     Kula — a spark appears between the palms (the push's lead-in: Iskra), and held focus grows it into a ball
 *            of golden-white light; without focus it waits, never smaller (push)
 *   name     Imię — one whole breath: the ball takes the name of the one prayed for (rest)
 *   offer    Ofiara — held focus lifts the ball up like incense (Ps 141:2) into a soft light at the top, where it
 *            blooms; or, for oneself or a name with a sore place, carries it to that place on a small figure (push)
 *   rest     Spoczynek — whole breaths, the hands open and still, the passage of this prayer (rest)
 *
 * and a `wait`: when a push cannot finish (the valve), a rest of whole breaths before the same step again.
 */
import { PLACE, type P } from '../kit/figure';
import type { PassageId } from '../kit/scripture';

export type StepId = 'rub' | 'breathe' | 'ball' | 'name' | 'offer' | 'rest' | 'wait';
export const STEPS: readonly StepId[] = ['rub', 'breathe', 'ball', 'name', 'offer', 'rest'];

/** What the runner's dock reads in a step. */
export const STEP_SIGNAL: Readonly<Record<StepId, 'free' | 'rest' | 'focus'>> = {
  rub: 'free', breathe: 'rest', ball: 'focus', name: 'rest', offer: 'focus', rest: 'rest', wait: 'rest',
};

/** Whom a prayer is for: someone dear (no names saved), one of the player's names, oneself, the world. */
export type WhoKind = 'dear' | 'name' | 'self' | 'world';
export interface Who { kind: WhoKind; /** the index into the player's names (kind 'name') */ i: number }
/** How the summary counts them: one line per kind. */
export type Tally = 'others' | 'self' | 'world';
export const tallyOf = (k: WhoKind): Tally => (k === 'self' ? 'self' : k === 'world' ? 'world' : 'others');

/** The places a hand may be laid on (the progress card or a tap on the small figure). */
export type HurtPlace = 'head' | 'throat' | 'chest' | 'belly' | 'back' | 'joint';
export const PLACES: readonly HurtPlace[] = ['head', 'throat', 'chest', 'belly', 'back', 'joint'];
/** Where each lies on the shared figure (kit/figure.ts units): the knee of the figure's left leg stands for a joint. */
export const PLACE_AT: Readonly<Record<HurtPlace, P>> = {
  head: [0, (PLACE.brow[1] + PLACE.eyes[1]) / 2],
  throat: PLACE.throat,
  chest: PLACE.heart,
  belly: PLACE.belly,
  back: [0, (PLACE.plexus[1] + PLACE.navel[1]) / 2],
  joint: [0.068, 0.745],
};
export const isPlace = (v: unknown): v is HurtPlace => (PLACES as readonly unknown[]).includes(v);

/** The nearest place to a point on the figure (figure units), within `max`; null when none is near. */
export function nearestPlace(x: number, y: number, max = 0.09): HurtPlace | null {
  let best: HurtPlace | null = null, d = max;
  for (const k of PLACES) {
    const [px, py] = PLACE_AT[k];
    const dd = Math.hypot((x - px) * 1.4, y - py);
    if (dd < d) { d = dd; best = k; }
  }
  return best;
}

// ── passages ───────────────────────────────────────────────────────

/** The root (the lobby opens with it). */
export const ROOT: PassageId = 'psa141.2';
/** The rest after a prayer lifted up, in turn from prayer to prayer. */
export const LIFT_VERSES: readonly PassageId[] = [
  'psa141.2', 'lam3.41', 'psa63.4', '1jn1.5', 'psa36.9', 'jhn1.4', 'psa90.17', 'mat13.31-32',
];
/** The rest after a hand laid where it hurts. */
export const LAY_VERSES: readonly PassageId[] = ['jer17.14', 'jas5.16', 'mrk10.16'];
/** The session's closing passage (the summary), in turn from session to session. */
export const CLOSING: readonly PassageId[] = ['mat5.14-16', 'psa134.2'];
export const ALL_PASSAGES: readonly PassageId[] = [...new Set([ROOT, ...LIFT_VERSES, ...LAY_VERSES, ...CLOSING])];

// ── the narrator ───────────────────────────────────────────────────

/** The moments the narrator speaks at (two lines each, in i18n.ts as `say.<moment>.<n>`). */
export const MOMENTS = [
  'open', 'resume', 'rub', 'breathe', 'spark', 'good', 'still', 'grown', 'named', 'lift', 'bloom', 'lay', 'laid',
  'rest', 'valve', 'blind', 'blindEnd', 'nosignal', 'pick', 'end',
] as const;
export type Moment = typeof MOMENTS[number];
export const SAY_COUNT = 2;

/** The coach marks (first time only). */
export type Coach = 'rub' | 'breathe' | 'ball' | 'who' | 'offer' | 'lay' | 'blind';
