/**
 * Złota passa, round 25 (DESIGN.md §29) — the lead's contract for "the day as a film of life".  The founder,
 * 2026-11-27: a better winning-streak experience, fitted to the everyday life of the age groups 11–19, 20–26, 27–35,
 * 36–50, 50+; a more dynamic picture, "as if it were a film about life"; and into that everyday, mindfulness of the
 * senses (taste, smell, sight, touch, hearing) — showing the things we pass by every day because we got used to them,
 * taking them for granted, with mini sessions of concentration on those everyday things.
 *
 * What changes (the round 22 contract in moments.ts and view.ts stays; this adds to it):
 *
 *   the age group   one of kit/ages.ts (shared with Stop-klatka; the lobby's chips, the device's choice the default):
 *                   the day's moments are drawn from sets written for that group's life (a teen's school bus and a
 *                   group chat, a student's rent, a parent's school run, a pensioner's garden and grandchildren…)
 *   the film        the day is no longer one street: the camera travels through the places of that group's day —
 *                   waking, the kitchen, the way (on foot, a bus, a car, a bike), the day's place (school, campus,
 *                   office, a shop's counter, home with small children, a garden), the afternoon, the evening table,
 *                   the window at night — with moving shots (a slow dolly, a pan, a push-in on the moment's thing, a cut
 *                   on a beat), people passing, the light of the hour; the garland of the streak still grows over it
 *   sense           a new kind of moment: a **mini session of attention on one sense** (the first sip's taste, the
 *                   smell of bread or rain, the light on a wall, warm water on the hands, a bird or a kettle) — the
 *                   camera pushes in to a close-up, 2–4 short guide lines lead the attention ("Poczuj ciepło kubka.",
 *                   "Pierwszy łyk — powoli."), and focus (the push) opens the close-up into colour and detail (savouring:
 *                   Bryant & Veroff); the win is the moment received
 *   given           a new kind of moment: **a thing taken for granted** (water from the tap, light at the switch, legs
 *                   that walk, eyes that see, a roof, a phone that rings with a mother's voice, food in the fridge) — first
 *                   a short rest that greys it as if it were not there ("Wyobraź sobie ten poranek bez…": mental
 *                   subtraction, Koo, Algoe, Wilson & Gilbert 2008), then focus brings it back in gold, and the thanks
 *
 * The sets: `life-sets.ts` (Polish, the source) and `life-sets.<lang>.ts` (en, de, sv) — words for each set moment
 * keyed by id: `<id>.what`, `<id>.win.<n>`, and for `sense` `<id>.guide.<n>`, for `given` `<id>.without`.
 */
import type { Age } from '../kit/ages';
import type { DayPart, Motif } from './moments';

export type { Age };

export const SENSES = ['taste', 'smell', 'sight', 'touch', 'hearing'] as const;
export type Sense = (typeof SENSES)[number];

/** The places of the day the film travels through (the street's art draws each, at every hour of the day). */
export const PLACES = [
  'bedroom',    // waking: a window, a bed's edge, the first light
  'kitchen',    // breakfast, a kettle, a tap, a table by a window
  'bathroom',   // a sink, a mirror, warm water
  'street',     // the round 22 street: pavements, a café, a crossing
  'bus',        // a city bus or tram from inside, the city passing
  'car',        // a windscreen and the road, a dashboard
  'bike',       // a cycle lane, handlebars
  'school',     // a classroom or a school corridor
  'campus',     // a lecture hall, a library, a student's room
  'office',     // a desk with a screen, a window over the city
  'counter',    // work behind a counter: a shop, a pharmacy, a workshop
  'nursery',    // home with small children: toys, a high chair
  'shop',       // shelves, a checkout
  'park',       // paths, trees, a bench, a playground at the side
  'garden',     // allotment or a garden: beds, a watering can, a fence
  'table',      // the evening table: plates, faces, a lamp
  'window',     // night: the window, the city's lights or stars
] as const;
export type Place = (typeof PLACES)[number];

/**
 * Motifs added for the new moments (the street's art adds them to `Motif` in moments.ts and draws each as a close-up
 * worth looking at): water from a tap, a shower, bread, an apple, a cup of tea, a flower, grass, a window's light, the
 * sky, music (headphones or a radio), a kettle, a sweater, feet that walk, eyes, a bed, a light switch, a fridge, a
 * book, a pet, a rainbow.
 */
export const LIFE_MOTIFS = [
  'tap', 'shower', 'bread', 'apple', 'tea', 'flower', 'grass', 'window', 'sky', 'music',
  'kettle', 'sweater', 'feet', 'eyes', 'bed', 'switch', 'fridge', 'book', 'pet', 'rainbow',
] as const;
export type LifeMotif = (typeof LIFE_MOTIFS)[number];

/** The round 25 kinds next to round 22's joy, snag, heavy. */
export type LifeKind = 'joy' | 'snag' | 'heavy' | 'sense' | 'given';

/**
 * A set moment of a group's day.  `ages` lists the groups it fits ([] = every group); `place` is where the film shows
 * it; a `sense` moment names its sense.  The words live in the sets' catalogs (see above).
 */
export interface LifeSet {
  id: string;
  kind: LifeKind;
  motif: Motif | LifeMotif;
  part: DayPart;
  place: Place;
  ages: readonly Age[];
  sense?: Sense;
}

/** A sense moment's mini session (s): the founder's "mini sesje koncentracji" — short, at the session's push length or less. */
export const SENSE_MIN = 15;
export const SENSE_MAX = 40;

/** What the film shows of a sense or given moment (the view's optional `life` field). */
export interface LifeView {
  place: Place;
  /** the close-up: 0 the wide shot … 1 the thing filling the frame (a sense moment pushes in as focus holds) */
  close: number;
  sense: Sense | null;
  /** the guide line now (a sense moment) or the "imagine without" line (a given moment's rest), or null */
  guide: string | null;
  /** a given moment: how much of the thing is taken away in the rest (0 here … 1 gone, grey) */
  without: number;
}
