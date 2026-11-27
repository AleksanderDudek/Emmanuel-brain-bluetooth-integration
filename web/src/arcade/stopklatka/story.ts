/**
 * Stop-klatka (freeze-frame) — the lead's contract between the game's code (the scenes drawn, the freeze, the band) and
 * its stories (DESIGN.md §28).  The founder, 2026-11-27: everyday stressful situations told as stories, and at one moment
 * the time freezes for 20–60 s: charge focus, come into here and now, learn to master the emotion ("nadpisanie
 * zachowania gniewu"); the situations chosen for an age group picked at the start (11–19, 20–26, 27–35, 36–50, 50+),
 * multi-step stories fitted to that group's own troubles, so the prefrontal cortex is trained where it is needed; seen
 * "z perspektywy 3ciej osoby (tak jakby widok z oczu)".
 *
 * The lead's reading of that last line, from the research on anger: the story is seen **through the player's eyes**
 * (the scene in front of them, their hands, the person facing them) — that is how a provocation is lived — and the
 * freeze **steps out of the eyes**: the camera rises and draws back until the player sees themselves in the scene from
 * aside, as an observer would (self-distancing: Kross & Ayduk; Mischkowski, Kross & Bushman 2012 — the "fly on the
 * wall" view in the heat of the moment lowers angry feelings and aggressive behaviour).  So both perspectives, each
 * where it helps.  Narration is the second person, present tense ("Widzisz…", "Czujesz…"): Polish without gendered
 * forms (no -łeś/-łaś, no gotowy/gotowa, no "/a").
 *
 * One story = a few beats that build up (heat rises), the trigger, the freeze (stop · breathe and charge · name what
 * you feel · a second look · choose), then the answer from the calm and how it turns out.  The freeze is the push
 * block (focus charges it); the story's telling and its outcome are the rest around it.
 *
 * This file is the shared vocabulary: the age groups, the places, the people, their moods and the props the code
 * draws, and the shape of a story.  The stories themselves live in `stories-<age>.ts` (Polish, the source) with their
 * en/de/sv texts in `i18n-stories-<lang>.ts`, keyed by `<story id>.<field>`.
 */
import type { PassageId } from '../kit/scripture';

/** The age groups the player picks at the start (the lobby; the first session asks on its opening card). */
export const AGES = ['teen', 'young', 'adult', 'mid', 'senior'] as const;
export type Age = (typeof AGES)[number];
/** What each group spans (shown on its chip). */
export const AGE_SPAN: Readonly<Record<Age, string>> = { teen: '11–19', young: '20–26', adult: '27–35', mid: '36–50', senior: '50+' };

/** Where a beat happens: each is a background the code draws, seen through the eyes (a first-person view). */
export const PLACES = [
  'classroom',   // desks, a board, a teacher's desk ahead
  'corridor',    // a school or office corridor, lockers or doors
  'bedroom',     // a bed's edge, a desk with a lamp, a window at night or day
  'kitchen',     // a counter, a sink, a table with plates, a fridge
  'living',      // a sofa, a TV, a low table
  'bus',         // seats and poles of a city bus or tram, a window with the street
  'street',      // a pavement, a crossing, shop fronts, a bike lane
  'car',         // the steering wheel and dashboard, the road and the car ahead through the windscreen
  'office',      // a desk with a monitor, an open-plan room
  'meeting',     // a table with people round it, a screen
  'shop',        // shelves, a checkout with a belt
  'queue',       // a counter with a clerk behind glass (an office, a post office, a pharmacy), people ahead
  'clinic',      // a waiting room: chairs, a number display, a door to the doctor
  'park',        // paths, trees, a bench, a playground at the side
  'gym',         // a school sports hall or a gym: mats, wall bars
  'screen',      // a phone held in the hands, filling the view (a chat, a feed, an e-mail, a bank app)
] as const;
export type Place = (typeof PLACES)[number];

/** Who may face the player in a beat (drawn as a person seen from the front, at the player's eye level). */
export const PEOPLE = [
  'peer',        // a classmate or a peer of the player's age group (the code draws the age to fit the group)
  'friend',
  'sibling',
  'parent',      // the player's mother or father (teen, young); for older groups use 'elder'
  'teacher',
  'partner',     // a spouse or partner (young and older only)
  'child',       // the player's young child (adult, mid)
  'teenager',    // the player's teenage child (mid, senior: a grandchild)
  'elder',       // the player's elderly parent (mid, senior)
  'boss',
  'colleague',
  'client',
  'driver',      // seen through a windscreen or from a pavement
  'clerk',       // behind a counter or a desk
  'neighbour',
  'doctor',
  'stranger',
  'group',       // a few people together (a clique, colleagues laughing, a queue)
] as const;
export type Person = (typeof PEOPLE)[number];

/** How a person looks at the player. */
export const MOODS = ['calm', 'busy', 'smirk', 'angry', 'shout', 'cold', 'sad', 'tired', 'sorry', 'smile'] as const;
export type Mood = (typeof MOODS)[number];

/** What may lie in the player's view or hands. */
export const PROPS = [
  'phone',       // a phone in the hands (a message, a notification): `screen` text shows on it
  'paper',       // a test, a letter, a bill, a form, a notice
  'laptop',
  'cup',         // a coffee or tea cup, maybe spilled
  'bag',         // a backpack or a shopping bag
  'plate',       // food, dishes
  'toy',         // a child's toy on the floor
  'keys',
  'ticket',      // a number from a queue machine, a bus ticket
  'card',        // a payment card at a terminal
  'clock',       // a wall clock or a watch: late
  'remote',
] as const;
export type Prop = (typeof PROPS)[number];

/** The words the player may give to what rises (affect labeling: naming a feeling lowers its grip). */
export const FEELINGS = ['anger', 'hurt', 'fear', 'shame', 'helpless', 'envy', 'tired', 'disgust'] as const;
export type Feeling = (typeof FEELINGS)[number];

/**
 * Someone in a beat: who, how they look, and where they stand in the view.  `sex` (added by B1 for the stories' words):
 * draw this person as a woman or a man so the words and the picture agree ("mama", "pani w okienku"); absent, the code
 * picks.
 */
export interface Figure { who: Person; mood: Mood; at?: 'left' | 'centre' | 'right'; sex?: 'f' | 'm' }

/**
 * One beat of a story: a picture through the eyes and a line of narration (≤ 140 characters), perhaps someone's words
 * in a bubble (≤ 90) and a prop in view; `heat` 0..1 is how tense it has become (the code tints the picture, quickens
 * the heartbeat in the sound, narrows the view a little).  In Polish the texts live in the story; in en/de/sv they are
 * looked up as `<story>.b<n>.text` / `<story>.b<n>.say` / `<story>.b<n>.screen`.
 */
export interface Beat {
  place: Place;
  people?: readonly Figure[];
  prop?: Prop;
  /** the narration: second person, present tense */
  text: string;
  /** what someone says (the speaker is the first figure unless `from` names another) */
  say?: string;
  from?: number;
  /** a few words on a phone or a paper (when `prop` is 'phone' or 'paper', or the place is 'screen'), ≤ 60 */
  screen?: string;
  heat: number;
}

/**
 * A story: 3–5 beats that build up to the trigger, the freeze's words, the answer and the outcome.
 *
 *   trigger     the moment it flares, felt in the body (≤ 110): "Gorąco uderza ci do twarzy. Palce same zaciskają się na telefonie."
 *   urge        what the anger wants to do right now (≤ 90): "Odpisać coś, co zaboli."
 *   feel        the feelings that fit (the first is the likeliest; the player may pick any of FEELINGS)
 *   second      2–3 lines of a second look (≤ 110 each): what else may be true, what really matters, what will matter in a week
 *   answer      the response from the calm, what the player does or says (≤ 140), and its words if spoken (`answerSay` ≤ 90)
 *   outcome     the beat after the answer — not a fairy tale: the situation eases, or it does not, but the player
 *               kept their own course (heat ≤ 0.3)
 *   lesson      one line to take into the day (≤ 90): a skill, not a moral
 *   verse       optional: a passage that fits (kit/scripture.ts ids only; never quote Scripture in the texts)
 */
export interface Story {
  /** unique across the game: `<age>.<slug>` (e.g. 'teen.groupchat') */
  id: string;
  age: Age;
  /** a short title (≤ 40): "Czat klasowy" */
  title: string;
  beats: readonly Beat[];
  trigger: string;
  urge: string;
  feel: readonly Feeling[];
  second: readonly string[];
  answer: string;
  answerSay?: string;
  outcome: Beat;
  lesson: string;
  verse?: PassageId;
  /**
   * A story that touches something heavy for this age (bullying, a parent's illness, a loss): the lobby's "Także
   * trudniejsze sytuacje" switch must be on for it to come, and its outcome may point to where help is (the panel
   * carries the helplines).
   */
  heavy?: boolean;
}

/** The freeze's length bounds (s): the founder's 20–60 s; the code fits it to the session and the player's pace. */
export const FREEZE_MIN = 20;
export const FREEZE_MAX = 60;
