/**
 * The contract between the health visualisations' engine and each game of the section (DESIGN.md §24).
 *
 * Każdy włos (src/arcade/wlosy, DESIGN §15) set the form of the Games tab's section "Wizualizacje zdrowotne": a
 * library of short guided meditations about one part of the body, each a few scenes; every scene one picture that
 * grows only from real focus (a sighted push past its lead-in, a reliable signal, `frame.focused`) and deepens with
 * calm in rest; the player chooses a meditation and a mode (in order · just this one · repeat), walks back and on,
 * repeats a scene, and the next session resumes where this one stopped.  Round 20 made that form an engine
 * (`makeHealthModule(lib)` in ./index.ts), so a game supplies only what is its own:
 *
 *   the library     its meditations (4–6), each 2–4 scenes, each with a verse from scripture.ts
 *   the pictures    its worlds, drawn in code in their own units (paint.ts is the shared palette and light)
 *   the words       its catalogs in pl (the source), en, de, sv — the keys listed below; everything generic (the
 *                   modes, the controls, the picker, the stats, the coach marks, most narrator lines) is the
 *                   engine's own catalog, which a game may override key by key
 *   the music       its quiet tune (kit/song.ts)
 *
 * Words a game must give, in all four languages (tests/arcade-<id>.test.ts checks them):
 *   unit                     plural: the headline's count with its number ("{n} komórek")
 *   med.<m>                  a meditation's name                       med.<m>.line   what it walks through (one line)
 *   med.<m>.care             one everyday step that serves this process, true and sourced (DESIGN §24) — the closing
 *                            card's "Na co dzień"
 *   scene.<s>                a scene's name                            teach.<s>      what the band teaches: plain
 *                            physiology with the real numbers (≤ 220 characters)
 *   tip.<s>                  the picture for the head in a push (≤ 120)   say.at.<s>.1 (.2, .3 optional) the narrator (≤ 90)
 *   part.<p>                 every part named on a picture (short: ≤ 22 characters)
 *   look.<l>                 each look the player may choose (if the game has looks)
 *   story.open.title/.text, story.open2.title/.text   the first session's two pages: the root verse's meaning, then
 *                            plainly what this is (visualisation and attention training) and is not (a treatment)
 *   story.whole.text         a meditation's closing thanks ("Dziękuję za każdą komórkę.")
 *   howto.goal, howto.tip1, howto.tip2, panel.not       the game's own how-to and its "not a treatment" line
 *   say.open.1–3, say.grown.1–3, say.whole.1–3, say.end.1–3   the narrator's flavour at those moments
 *
 * The tone (DESIGN §24.3): a meditation, never a promise.  What the pictures show is what the body really does; no
 * word claims that focus heals, that a disease will go, that a tooth or a disc will regrow; the numbers are real and
 * sourced.  No figure of God is drawn; verses come only from scripture.ts.
 */
import type { PassageId } from '../scripture';
import type { Pt, Rect } from './camera';
import type { Song } from '../song';
import type { Catalog, Lang } from '../../../i18n';

export type { Pt, Rect };

/** A part named on a picture: its anchor (world units), the side its name stands on, from which growth it shows. */
export interface LabelSpec {
  part: string;
  at: Pt;
  side: -1 | 1;
  /** the name's vertical nudge in lines (a crowded side) */
  dy?: number;
  /** the scene's growth (0..1) from which the name shows */
  from: number;
}

export interface SceneSpec {
  /** the world that draws it (a key of HealthLibrary.worlds) */
  world: string;
  /** what the camera frames, in the world's units */
  view: Rect;
  /** the growing point (world units): the gauge's light is drawn here (a world may move it: WorldPainter.focusAt) */
  focus: Pt;
  labels: readonly LabelSpec[];
  /** a variant of the world's still layer for this scene (a world bakes one layer per variant) */
  variant?: string;
}

export interface MedSpec {
  id: string;
  /** its scenes in order (2–4; scene ids are unique across the library) */
  scenes: readonly string[];
  /** shown in rest's words band and on the meditation's closing card */
  verse: PassageId;
}

/** What a world is told each frame; it draws in its own units under the camera's transform. */
export interface WorldState {
  scene: string;
  /** the scene's growth as drawn (0..1) */
  g: number;
  /** rest's deepening (0..1): warmth, colour, sheen */
  deep: number;
  /** the light at the growing point (0..1, 0.5 at the threshold) */
  light: number;
  /** the scene grows right now (a sighted push, focused) */
  growing: boolean;
  /** seconds since the view began (animation) */
  time: number;
  /** seconds a grown scene has stayed ("after": it lives on gently) */
  after: number;
  /** rest's breath (0 out … 1 in), 0.5 outside rest */
  breath: number;
  blind: boolean;
  reduced: boolean;
  /** screen px per world unit (line widths and detail follow it) */
  px: number;
  /** the look the player chose (HealthLibrary.looks), '' when the game has none */
  look: string;
}

export interface WorldPainter {
  /** how deep it lies: the camera dives in going deeper, pulls out coming back (Każdy włos: head 0, section 1, follicle 2) */
  depth: number;
  /** tissue seen through the lens (a rounded plate with a rim of light) — or a free picture on the ground (a body) */
  lens: boolean;
  /**
   * Draw the still parts once per view, size and look (world units; the transform is set).  Scenes of the world
   * share the layer unless their `variant` differs.
   */
  bake(ctx: CanvasRenderingContext2D, variant: string, look: string): void;
  /** Draw what grows and lives, every frame (world units; the transform is set). */
  draw(ctx: CanvasRenderingContext2D, st: WorldState): void;
  /** The growing point as a scene grows (default: the scene's `focus`). */
  focusAt?(scene: string, g: number): Pt;
  /** A short count drawn on the picture's corner as the scene grows ("≈ 170 włosów · 1 cm²"), or null. */
  counter?(scene: string, g: number): string | null;
}

export interface HealthLibrary {
  /** the registry's GameId (its folder under src/arcade) */
  id: string;
  /** 4–6 meditations; the last may walk the whole library in one ("Cała …") */
  meds: readonly MedSpec[];
  scenes: Readonly<Record<string, SceneSpec>>;
  worlds: Readonly<Record<string, WorldPainter>>;
  /**
   * Where a dive between two worlds of different depth opens in the shallower one (world units): the camera zooms
   * into that place while the deeper picture opens from it.  null: a cross-fade.
   */
  portal?(shallowScene: string, deepScene: string): Pt | null;
  /** the registry's root passage: the first session's opening card and closing verse */
  root: PassageId;
  /** the closing verses in turn after the first session (each must exist in all four editions) */
  closers: readonly PassageId[];
  /** looks the player may choose in the lobby's card (a skin tone…); the first is the default; [] for none */
  looks: readonly string[];
  /** headline units a whole scene is worth when grown by focus (Każdy włos: 120 hairs) */
  perScene: number;
  /** the game's words: pl is the source; every key of pl exists in en, de, sv (see the list above) */
  words: Readonly<Record<Lang, Catalog<string>>>;
  /** the quiet tune under the meditations (kit/song.ts), null for a warm pad only */
  tune(): Song | null;
  /** the lobby card's and the hero's tint: the deep ground and the light of this part of the body */
  tint: { ground: string; light: string };
}
