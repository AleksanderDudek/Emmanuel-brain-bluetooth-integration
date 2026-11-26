/**
 * Dobry bój's moves (DESIGN.md §25): the strikes, the defences, which defence answers which strike, the counters a
 * defence opens, the popular combinations a fighter throws, and the openings an opponent gives.  Real technique, as a
 * coach teaches it — the boxer's numbers (1 jab, 2 cross, 3 lead hook, 4 rear hook, 5 lead uppercut, 6 rear
 * uppercut) and the kickboxing / MMA additions.  Pure data and lookups, no DOM, no randomness: the lead's contract
 * between the fight (rules.ts, sim.ts, content.ts: builder A) and the ring (rig.ts, render.ts: builder B, who draws a
 * pose for every id below).
 *
 * Words for every id live in i18n.ts (builder A): `strike.<id>`, `defense.<id>`, `combo.<id>`, `opening.<id>`,
 * `why.<defense>.<strike>` (one short line on why the answer works, shown in the slow motion when it is the right one).
 */

/** The rules of the fight: gloves only, or the cage's (kicks, knees, takedowns). */
export type Style = 'boks' | 'mma';
export const STYLES: readonly Style[] = ['boks', 'mma'];

export type StrikeId =
  | 'jab' | 'cross' | 'hookL' | 'hookR' | 'upperL' | 'upperR' | 'bodyHook' | 'overhand'
  | 'lowKick' | 'bodyKick' | 'headKick' | 'teep' | 'knee' | 'takedown';

export type DefenseId = 'slip' | 'roll' | 'parry' | 'block' | 'step' | 'check' | 'catch' | 'sprawl';

/** What throws the strike (the rig animates that limb; "lead" is the front side of an orthodox stance). */
export type Limb = 'leadHand' | 'rearHand' | 'leadLeg' | 'rearLeg' | 'body';
/** Where it lands (the hit reaction and the defence's answer follow it). */
export type Target = 'head' | 'body' | 'legs';

export interface Strike {
  id: StrikeId;
  /** the boxer's number (1–6) — the coach calls combinations by them */
  num?: number;
  limb: Limb;
  target: Target;
  styles: readonly Style[];
  /** real time (s) of its three parts: the load (the "tell" an eye can read), the travel, the way back */
  load: number;
  travel: number;
  back: number;
  /** HP (of 100) a clean hit takes */
  dmg: number;
  /** a power shot: the slow motion comes on it, not on a flicking jab */
  power: boolean;
}

const B: readonly Style[] = ['boks', 'mma'];
const M: readonly Style[] = ['mma'];

export const STRIKES: Readonly<Record<StrikeId, Strike>> = {
  jab:      { id: 'jab', num: 1, limb: 'leadHand', target: 'head', styles: B, load: 0.08, travel: 0.12, back: 0.14, dmg: 4, power: false },
  cross:    { id: 'cross', num: 2, limb: 'rearHand', target: 'head', styles: B, load: 0.14, travel: 0.16, back: 0.2, dmg: 9, power: true },
  hookL:    { id: 'hookL', num: 3, limb: 'leadHand', target: 'head', styles: B, load: 0.16, travel: 0.18, back: 0.2, dmg: 10, power: true },
  hookR:    { id: 'hookR', num: 4, limb: 'rearHand', target: 'head', styles: B, load: 0.2, travel: 0.2, back: 0.24, dmg: 12, power: true },
  upperL:   { id: 'upperL', num: 5, limb: 'leadHand', target: 'head', styles: B, load: 0.16, travel: 0.16, back: 0.2, dmg: 10, power: true },
  upperR:   { id: 'upperR', num: 6, limb: 'rearHand', target: 'head', styles: B, load: 0.2, travel: 0.18, back: 0.24, dmg: 13, power: true },
  bodyHook: { id: 'bodyHook', limb: 'leadHand', target: 'body', styles: B, load: 0.18, travel: 0.18, back: 0.22, dmg: 9, power: true },
  overhand: { id: 'overhand', limb: 'rearHand', target: 'head', styles: B, load: 0.24, travel: 0.22, back: 0.26, dmg: 14, power: true },
  lowKick:  { id: 'lowKick', limb: 'rearLeg', target: 'legs', styles: M, load: 0.2, travel: 0.22, back: 0.26, dmg: 8, power: true },
  bodyKick: { id: 'bodyKick', limb: 'rearLeg', target: 'body', styles: M, load: 0.24, travel: 0.24, back: 0.3, dmg: 12, power: true },
  headKick: { id: 'headKick', limb: 'rearLeg', target: 'head', styles: M, load: 0.28, travel: 0.26, back: 0.32, dmg: 18, power: true },
  teep:     { id: 'teep', limb: 'leadLeg', target: 'body', styles: M, load: 0.16, travel: 0.18, back: 0.22, dmg: 6, power: false },
  knee:     { id: 'knee', limb: 'rearLeg', target: 'body', styles: M, load: 0.2, travel: 0.16, back: 0.24, dmg: 11, power: true },
  takedown: { id: 'takedown', limb: 'body', target: 'legs', styles: M, load: 0.26, travel: 0.34, back: 0.4, dmg: 10, power: true },
};

export const STRIKE_IDS = Object.keys(STRIKES) as StrikeId[];

export interface Defense {
  id: DefenseId;
  styles: readonly Style[];
  /** real time (s) the move takes */
  dur: number;
  /**
   * How well it answers each strike: 1 the coach's answer, 0.5–0.8 it helps (the hit lands softened), absent: it does
   * not answer that strike (`MISS`).  The fight multiplies it by the charge (rules.ts).
   */
  vs: Partial<Readonly<Record<StrikeId, number>>>;
  /** the strikes this defence leaves you set to throw back at once (the counter) */
  counters: readonly StrikeId[];
}

/** How much a defence that does not answer the strike still saves. */
export const MISS = 0.15;

export const DEFENSES: Readonly<Record<DefenseId, Defense>> = {
  // a small turn of the head off the line of a straight punch — the classic answer to 1 and 2
  slip:   { id: 'slip', styles: B, dur: 0.28, vs: { jab: 1, cross: 1, upperL: 0.4, upperR: 0.4, teep: 0.5 }, counters: ['cross', 'hookL'] },
  // bend the knees and roll under the arc of a hook or an overhand
  roll:   { id: 'roll', styles: B, dur: 0.4, vs: { hookL: 1, hookR: 1, overhand: 1, headKick: 0.6, cross: 0.4 }, counters: ['hookL', 'hookR'] },
  // a small slap of the rear hand that turns a straight punch aside
  parry:  { id: 'parry', styles: B, dur: 0.22, vs: { jab: 1, cross: 0.7, teep: 0.8 }, counters: ['jab', 'cross'] },
  // the high guard, elbows in — it softens almost anything, answers the body shots and the high kick
  block:  { id: 'block', styles: B, dur: 0.3, vs: { jab: 0.7, cross: 0.7, hookL: 0.8, hookR: 0.8, upperL: 0.7, upperR: 0.7, bodyHook: 1, overhand: 0.6, bodyKick: 0.8, headKick: 1, knee: 0.8 }, counters: ['hookL', 'cross'] },
  // a step back out of range — the answer to the uppercut and the kicks
  step:   { id: 'step', styles: B, dur: 0.36, vs: { jab: 0.8, cross: 0.8, hookL: 0.6, hookR: 0.6, upperL: 1, upperR: 1, bodyHook: 0.8, overhand: 0.8, lowKick: 0.7, bodyKick: 0.8, headKick: 1, teep: 0.7, knee: 1, takedown: 0.5 }, counters: ['cross'] },
  // lift the lead leg and take the low kick on the shin
  check:  { id: 'check', styles: M, dur: 0.3, vs: { lowKick: 1, teep: 0.5 }, counters: ['cross', 'hookL'] },
  // trap a kick to the body under the arm
  catch:  { id: 'catch', styles: M, dur: 0.34, vs: { bodyKick: 1, teep: 1 }, counters: ['cross', 'lowKick'] },
  // throw the legs back and the hips down on a shot for the legs
  sprawl: { id: 'sprawl', styles: M, dur: 0.46, vs: { takedown: 1, knee: 0.5 }, counters: ['upperR', 'knee'] },
};

export const DEFENSE_IDS = Object.keys(DEFENSES) as DefenseId[];

/** How well `d` answers `s` (MISS when it does not). */
export const answer = (d: DefenseId, s: StrikeId): number => DEFENSES[d].vs[s] ?? MISS;

/** The coach's answers to `s` in `style`: the defences that answer it fully (at least one exists for every strike). */
export function bestAnswers(s: StrikeId, style: Style): DefenseId[] {
  return DEFENSE_IDS.filter(d => DEFENSES[d].styles.includes(style) && answer(d, s) >= 1);
}

/** A popular combination: the strikes in order, and the one the slow motion comes on when it is thrown at you. */
export interface Combo {
  id: string;
  styles: readonly Style[];
  strikes: readonly StrikeId[];
  /** the index in `strikes` of the shot the defender must answer (the power shot it builds to) */
  key: number;
}

export const COMBOS: readonly Combo[] = [
  // boxing — the coach's numbers
  { id: '1-2', styles: B, strikes: ['jab', 'cross'], key: 1 },
  { id: '1-1-2', styles: B, strikes: ['jab', 'jab', 'cross'], key: 2 },
  { id: '1-2-3', styles: B, strikes: ['jab', 'cross', 'hookL'], key: 2 },
  { id: '1-2-3-2', styles: B, strikes: ['jab', 'cross', 'hookL', 'cross'], key: 2 },
  { id: '2-3-2', styles: B, strikes: ['cross', 'hookL', 'cross'], key: 1 },
  { id: '1-6-3-2', styles: B, strikes: ['jab', 'upperR', 'hookL', 'cross'], key: 1 },
  { id: '1-2-5-2', styles: B, strikes: ['jab', 'cross', 'upperL', 'cross'], key: 2 },
  { id: '3b-3', styles: B, strikes: ['bodyHook', 'hookL'], key: 1 },
  { id: '1-4', styles: B, strikes: ['jab', 'hookR'], key: 1 },
  { id: '1-ov', styles: B, strikes: ['jab', 'overhand'], key: 1 },
  // the cage — strikes mixed with kicks, knees and the shot
  { id: '1-2-lk', styles: M, strikes: ['jab', 'cross', 'lowKick'], key: 2 },
  { id: '1-2-bk', styles: M, strikes: ['jab', 'cross', 'bodyKick'], key: 2 },
  { id: '2-3-hk', styles: M, strikes: ['cross', 'hookL', 'headKick'], key: 2 },
  { id: 'teep-2', styles: M, strikes: ['teep', 'cross'], key: 1 },
  { id: '1-2-td', styles: M, strikes: ['jab', 'cross', 'takedown'], key: 2 },
  { id: '1-knee', styles: M, strikes: ['jab', 'knee'], key: 1 },
];

export const combosFor = (style: Style): Combo[] => COMBOS.filter(c => c.styles.includes(style));

/**
 * An opening the opponent gives (your chance to attack): what the body shows, and the combinations that use it — 1
 * the coach's choice, less for one that fits it only in part (absent: it does not; the fight gives it `MISS`).
 */
export interface Opening {
  id: string;
  styles: readonly Style[];
  /** the opponent's act the ring shows as the tell (rig.ts draws it): see `OpeningTell` */
  tell: OpeningTell;
  fits: Readonly<Record<string, number>>;
}

/** What an opening looks like on the opponent (the rig's pose): */
export type OpeningTell =
  | 'dropHand'   // the lead hand drops after a jab — the cross over it
  | 'leanIn'     // the head comes in low and forward — the uppercut
  | 'wide'       // wide, looping punches — straight down the middle
  | 'square'     // the stance squares up, the elbows high — the body
  | 'heavyLeg'   // the weight sits on the lead leg (the cage) — the low kick
  | 'tired';     // hands low, breathing hard — the long combination

export const OPENINGS: readonly Opening[] = [
  { id: 'dropHand', styles: B, tell: 'dropHand', fits: { '1-2': 1, '2-3-2': 0.8, '1-ov': 1, '1-4': 0.6 } },
  { id: 'leanIn', styles: B, tell: 'leanIn', fits: { '1-6-3-2': 1, '1-2-5-2': 1, '1-2-3': 0.5 } },
  { id: 'wide', styles: B, tell: 'wide', fits: { '1-2': 1, '1-1-2': 1, '1-2-3-2': 0.6 } },
  { id: 'square', styles: B, tell: 'square', fits: { '3b-3': 1, '1-2-3': 0.6, '1-knee': 1 } },
  { id: 'heavyLeg', styles: M, tell: 'heavyLeg', fits: { '1-2-lk': 1, 'teep-2': 0.6, '1-2-bk': 0.6 } },
  { id: 'tired', styles: B, tell: 'tired', fits: { '1-2-3-2': 1, '1-2-5-2': 0.8, '2-3-hk': 1, '1-2-td': 0.8 } },
];

export const openingsFor = (style: Style): Opening[] => OPENINGS.filter(o => o.styles.includes(style));

/** How well `combo` uses `opening` (MISS when it does not fit). */
export const fit = (opening: Opening, combo: string): number => opening.fits[combo] ?? MISS;
