/**
 * What the fight shows (DESIGN.md §25): the lead's contract between the fight (sim.ts — builder A builds a `FightView`
 * every frame) and the ring (render.ts, rig.ts, layout.ts, audio.ts — builder B draws and sounds it).  The view holds
 * no words of its own catalog: every string the ring draws comes in it, already in the page's language.
 *
 * Shapes change only by agreement (each builder's status file, "To A:" / "To B:").  Adding an optional field is fine.
 */
import type { DefenseId, Style, StrikeId, Target, OpeningTell } from './moves';

/** How a fighter looks: chosen by the player in the lobby (the opponent matches the division: ona → ona, on → on). */
export interface Look {
  /** the division: a woman's or a man's body (never sexualised: athletic, in sport kit) */
  sex: 'ona' | 'on';
  /** skin tone, 0 (lightest) … 4 (deepest) */
  skin: number;
  /** the trunks / shorts, the gloves and the trim ("#rrggbb") */
  kit: string;
  gloves: string;
  /** hair: 0 short, 1 tied back, 2 braids, 3 shaved (any division) */
  hair: number;
}

/** What a fighter's body is doing (rig.ts has a pose sequence for each). */
export type Act =
  | { kind: 'guard' }                                        // the stance, bouncing lightly (loops)
  | { kind: 'tell'; strike: StrikeId }                       // the load before a strike: the eye can read it
  | { kind: 'open'; tell: OpeningTell }                      // an opening shown (the opponent's mistake)
  | { kind: 'strike'; strike: StrikeId; power: number }      // throwing it; power 0..1 as charged (light trails ≥ 0.7)
  | { kind: 'defend'; defense: DefenseId; ok: number }       // the defence; ok 0..1 how well it answered
  | { kind: 'hit'; target: Target; force: number }           // taking a hit (force 0..1)
  | { kind: 'down' }                                         // a knockdown: to one knee, a glove on the canvas
  | { kind: 'rise' }                                         // getting up, the guard back
  | { kind: 'out' }                                          // the fight is over for this fighter: sits down, the referee waves
  | { kind: 'corner' }                                       // on the stool between rounds
  | { kind: 'cheer' }                                        // arms up after the win
  | { kind: 'embrace' }                                      // after the bell: the two embrace (both fighters)
  | { kind: 'touch' };                                       // touching gloves before the fight

export interface FighterView {
  look: Look;
  act: Act;
  /** 0..1 through the act (a loop for guard and corner) */
  t: number;
  /** the act's seconds in real time — the ring may ease by it */
  dur: number;
  /** health of the current life 0..1, the lives left and all (the gloves under the bar) */
  hp: number;
  lives: number;
  maxLives: number;
  /** the name over the bar ("Ty" / "You" for the player, the opponent's ring name) */
  name: string;
}

/** A choice in the slow motion (the quick-time part): up to three, in the thumb zone. */
export interface Option {
  id: string;
  kind: 'defense' | 'counter' | 'attack';
  /** what the button says ("Unik", "Rolka + hak", "1-2") and its small second line ("pod hakiem") */
  label: string;
  sub?: string;
  /** chosen now (the energy goes into it) */
  chosen: boolean;
  /** the coach's pick — glows only while the player is learning (A decides when) */
  hint: boolean;
  /** where a counter or an attack's lead strike lands on the opponent (the first-person view shows the gap) */
  aim?: Target;
}

/** A hit that just landed or was answered, for the ring's effects (a flash, a shake, a small number). */
export interface Impact {
  /** who was hit */
  on: 'player' | 'foe';
  target: Target;
  /** 0..1; 0 = fully answered (a glove's thud) */
  force: number;
  /** what to float over it, already in words ("−12", "Kontra!"), or '' */
  text: string;
  /** seconds since it happened */
  age: number;
}

export type Phase =
  | 'intro'     // walk to the centre, touch gloves, the bell
  | 'read'      // a rest: circling, the guard, breathing — calm restores (the receptive block)
  | 'sequence'  // real time: the combination or the opening unfolds up to its key moment
  | 'slow'      // the slow motion: a push block — focus charges the energy; the options are open
  | 'resolve'   // real time: what the energy and the choice did
  | 'corner'    // between rounds: on the stool, a longer rest
  | 'count'     // a knockdown: the referee counts; focus helps the player rise (a push)
  | 'end';      // the fight is over: the result, the embrace, the verse

export interface FightView {
  style: Style;
  phase: Phase;
  /** how fast the world runs now: 1 real time, ~0.04–0.08 in the slow motion (the ring eases between) */
  timeScale: number;
  /** how deep the slow motion's look is 0..1 (desaturation, trails, the vignette) — eased by the sim */
  slow: number;
  player: FighterView;
  foe: FighterView;
  round: number;
  rounds: number;
  /** the player's charge 0..1 — the energy ring around the player's fists; `ready` when it is full */
  energy: number;
  ready: boolean;
  /** the slow motion's seconds left (null outside it) */
  left: number | null;
  /** the strike coming in during the slow motion, and how far it has travelled 0..1 (the ring draws it creeping) */
  incoming: { strike: StrikeId; travel: number } | null;
  options: Option[];
  impacts: Impact[];
  /** the referee's count during a knockdown (1..10), else null */
  count: number | null;
  /** a big word over the ring ("RUNDA 2", "NOKAUT", "WYGRANA", "KONIEC WALKI") and its age (s), or null */
  banner: { text: string; age: number } | null;
  /** the coach's line in the corner / during the read (A's narrator), or null — the ring draws it in a bubble */
  coach: string | null;
  /** the line under the options in the slow motion: why the right answer works (A's catalog), or null */
  why: string | null;
  /** the crowd's mood 0..1 (the ring's crowd and its sound) */
  crowd: number;
  /** rest's breath (0 out … 1 in) during read and corner, 0.5 otherwise */
  breath: number;
  reduced: boolean;
  /**
   * The quick-time choice's own time (a level that closes it a few seconds into the slow motion, DESIGN §29): the share
   * of it left 0..1 and whether the options still take a tap; absent or null: open the whole slow motion.
   */
  choice?: { left: number; open: boolean } | null;
  /** what comes or what opens, named over the opponent in the slow motion ("Nadchodzi: prawy sierpowy"), or null */
  prompt?: string | null;
  /** the line when the choice has closed with no "why" to show ("Wybór zamknięty — skupienie daje siłę"), or null */
  closed?: string | null;
}

/** A rectangle in canvas CSS px. */
export interface Rect { x: number; y: number; w: number; h: number }
