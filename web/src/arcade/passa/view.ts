/**
 * What Złota passa shows (DESIGN.md §26): the lead's contract between the game (sim.ts builds a `PassaView` every
 * frame — builder A) and the street (render.ts, scene.ts, layout.ts, audio.ts — builder B).  Every string the street
 * draws comes in the view, already in the page's language.  Shapes change only by agreement; optional fields are fine.
 */
import type { DayPart, Motif, MomentKind } from './moments';

export type Phase =
  | 'intro'    // dawn on the street, the root verse
  | 'arrive'   // a moment arrives: its card comes down the street (real time, a breath)
  | 'name'     // a heavy moment's rest before the push: the hurt is named (a rest block)
  | 'turn'     // the push: focus turns the card (the gold side writes itself as focus holds)
  | 'savor'    // the rest after a win: the light flies up into the garland, gratitude — calm makes it glow
  | 'carry'    // a card focus did not turn: it goes gently into the pocket ("idzie ze mną")
  | 'evening'  // the day's end: the garland lit over the darkening street, the identity line, the verse
  | 'end';

/** The card of the moment now. */
export interface CardView {
  kind: MomentKind;
  motif: Motif;
  /** the grey side's words and the gold side's (the chosen reframe; '' until chosen) */
  what: string;
  win: string;
  /** 0 grey … 1 gold: how far the card has turned (focus turns it) */
  turn: number;
  /** how much of the gold words are written (0..1) — they write themselves as focus holds */
  write: number;
  /** where it is: 0 far down the street (arriving) … 1 held up close; 'gone' after it flew into the garland / pocket */
  near: number;
  own: boolean;
  /** (optional, B) the chosen reframe is a heavy card's "not yet — I trust": its gold side is a small flame */
  trust?: boolean;
}

/** A choice of reframe (the thumb zone; up to four: the wins and, for a heavy moment, "not yet — I trust"). */
export interface ChoiceView {
  id: string;
  label: string;
  chosen: boolean;
  trust: boolean;
}

export interface PassaView {
  phase: Phase;
  /** the day's light 0 (dawn) … 1 (night) — the street, the sky, the shop windows follow it */
  day: number;
  part: DayPart;
  card: CardView | null;
  choices: ChoiceView[];
  /** the garland: lights lit so far (the session's wins), and the one flying up now (0..1 of its flight) or null */
  lights: number;
  flying: number | null;
  /** the day-streak (days in a row with a session, the habit) — the sign over the street shows it */
  days: number;
  /** focus's light on the card now 0..1 (the warm glow; 0.5 at the threshold's pace) */
  glow: number;
  /** the narrator's line (a calm voice), or null */
  say: string | null;
  /** a big line over the street ("Jestem na złotej passie"), or null */
  banner: string | null;
  /** rest's breath (0 out … 1 in) in name/savor, 0.5 otherwise */
  breath: number;
  /** cards carried in the pocket so far (not turned) */
  carried: number;
  reduced: boolean;
  /** (optional, B) the hanging sign by the café in the page's language ("Dzień passy: 5"); absent: a sun and the number */
  sign?: string;
}

export interface Rect { x: number; y: number; w: number; h: number }
