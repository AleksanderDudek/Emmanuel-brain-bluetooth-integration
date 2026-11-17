/**
 * Każdy włos's library (DESIGN.md §15): eight short guided meditations about the hair and the scalp, each a few
 * scenes; every scene is one picture in one of the five worlds of geo.ts (the head in profile, the head from above,
 * the skin close up, the scalp in section, one follicle), seen through a view, with the parts it teaches named on
 * it.  The player's focus grows each picture (sim.ts); rest deepens it.
 *
 * The physiology is real (the numbers and their sources are in DESIGN §15): what grows is what grows in the body —
 * the root, never the tip; the cycle of anagen, catagen and telogen with each follicle keeping its own time; the
 * five layers and the five arteries of the scalp.  Nothing here promises that hair will grow: the meditations are
 * attention and imagination, rooted in Luke 12:7 — "even the very hairs of your head are all numbered".
 */
import type { PassageId } from '../kit/scripture';
import {
  ABOVE_PORTAL, ABOVE_VIEW, CROWN, FU, HEAD_VIEW, SEC_FOLLICLES, SKIN_VIEW, folPt, folViews, secPt, secViews, type Pt, type Rect,
} from './geo';
import { t, type Key } from './i18n';
import { RULES } from './rules';

export const MEDS = ['krazenie', 'korzen', 'kolor', 'wzrost', 'wir', 'cykl', 'skora', 'cala'] as const;
export type MedId = (typeof MEDS)[number];

export const SCENES = [
  'czepiec', 'tetnice', 'siec',
  'brodawka', 'petla', 'sygnaly',
  'melanocyty', 'melanina', 'barwa',
  'podzial', 'twardnienie', 'skos',
  'wir', 'strumienie', 'jednostki',
  'anagen', 'katagen', 'nowy', 'mozaika',
  'naskorek', 'sebum', 'bariera',
  'cieplo', 'korzenie', 'wyrastanie', 'glowa',
] as const;
export type SceneId = (typeof SCENES)[number];

export type World = 'head' | 'above' | 'skin' | 'section' | 'follicle';
/** How deep a world lies: the camera zooms in going deeper, out coming back. */
export const DEPTH: Readonly<Record<World, number>> = { head: 0, above: 0, skin: 1, section: 1, follicle: 2 };

/** A part named on a picture: its anchor (world units), the side its name stands on, from which growth it shows. */
export interface LabelSpec { part: Part; at: Pt; side: -1 | 1; dy?: number; from: number }

export interface SceneSpec {
  med: MedId;
  world: World;
  view: Rect;
  /** the growing point (world units): the light of the gauge is drawn here */
  focus: Pt;
  labels: readonly LabelSpec[];
}

export const PARTS = [
  'galea', 'frontal', 'occipitalis', 'supratrochlear', 'supraorbital', 'temporal', 'auricular', 'occipital',
  'skin', 'conn', 'aponeurosis', 'areolar', 'pericranium', 'bone', 'capillaries', 'arteries',
  'papilla', 'loop', 'matrix', 'melanocytes', 'melanin', 'bulb', 'keratin', 'cuticle', 'cortex', 'medulla',
  'irs', 'ors', 'bulge', 'stem', 'gland', 'sebum', 'muscle', 'epidermis', 'basal', 'corneum', 'shaft', 'opening',
  'club', 'germ', 'newhair', 'whorl', 'forward', 'sideways', 'nape', 'unit',
] as const;
export type Part = (typeof PARTS)[number];

const V = folViews();
const S = secViews();
const mid = SEC_FOLLICLES[4];

export const SCENE: Readonly<Record<SceneId, SceneSpec>> = {
  // ── 1. Ciepło i krążenie ─────────────────────────────────────
  czepiec: {
    med: 'krazenie', world: 'head', view: HEAD_VIEW, focus: [4, -60],
    labels: [
      { part: 'galea', at: [6, -62], side: 1, dy: -1.2, from: 0.05 },
      { part: 'frontal', at: [-38, -26], side: -1, from: 0.3 },
      { part: 'occipitalis', at: [44, -16], side: 1, from: 0.55 },
    ],
  },
  tetnice: {
    med: 'krazenie', world: 'head', view: HEAD_VIEW, focus: [6, -40],
    labels: [
      { part: 'supratrochlear', at: [-39, -27], side: -1, dy: -1.1, from: 0.08 },
      { part: 'supraorbital', at: [-31, -34], side: -1, dy: 0.4, from: 0.26 },
      { part: 'temporal', at: [3, 4], side: -1, dy: 0.6, from: 0.44 },
      { part: 'auricular', at: [29, -8], side: 1, dy: -0.4, from: 0.62 },
      { part: 'occipital', at: [43, 8], side: 1, dy: 0.8, from: 0.8 },
    ],
  },
  siec: {
    med: 'krazenie', world: 'section', view: S.full, focus: secPt(mid, 0, mid.len - 2),
    labels: [
      { part: 'skin', at: [57, 18], side: -1, from: 0 },
      { part: 'conn', at: [57, 46], side: -1, from: 0.12 },
      { part: 'aponeurosis', at: [57, 60.5], side: -1, from: 0.24 },
      { part: 'areolar', at: [57, 66.8], side: -1, dy: 0.5, from: 0.36 },
      { part: 'pericranium', at: [57, 71.8], side: -1, dy: 1.2, from: 0.48 },
      { part: 'capillaries', at: [-34, 22], side: 1, dy: -0.6, from: 0.62 },
    ],
  },
  // ── 2. Korzeń ────────────────────────────────────────────────
  brodawka: {
    med: 'korzen', world: 'follicle', view: V.bulb, focus: folPt(0, FU.papMid - 1),
    labels: [
      { part: 'papilla', at: folPt(0, 94), side: 1, from: 0.12 },
      { part: 'bulb', at: folPt(-11.5, 90), side: -1, from: 0.45 },
    ],
  },
  petla: {
    med: 'korzen', world: 'follicle', view: V.bulb, focus: folPt(0, 98),
    labels: [
      { part: 'loop', at: folPt(1.6, 100.5), side: 1, dy: 0.6, from: 0.15 },
      { part: 'papilla', at: folPt(-2.5, 91), side: -1, from: 0.5 },
    ],
  },
  sygnaly: {
    med: 'korzen', world: 'follicle', view: V.bulb, focus: folPt(0, 90),
    labels: [
      { part: 'papilla', at: folPt(0, 95), side: 1, dy: 0.6, from: 0.05 },
      { part: 'matrix', at: folPt(-9.5, 87), side: -1, from: 0.25 },
    ],
  },
  // ── 3. Kolor ─────────────────────────────────────────────────
  melanocyty: {
    med: 'kolor', world: 'follicle', view: V.bulb, focus: folPt(0, 85),
    labels: [
      { part: 'melanocytes', at: folPt(3.5, 85.5), side: 1, dy: -0.5, from: 0.15 },
      { part: 'papilla', at: folPt(0, 95), side: -1, dy: 0.6, from: 0.5 },
    ],
  },
  melanina: {
    med: 'kolor', world: 'follicle', view: V.bulb, focus: folPt(0, 80),
    labels: [
      { part: 'melanin', at: folPt(-2, 80), side: -1, dy: -0.4, from: 0.18 },
      { part: 'melanocytes', at: folPt(3.5, 85.5), side: 1, dy: 0.5, from: 0.05 },
    ],
  },
  barwa: {
    med: 'kolor', world: 'follicle', view: V.whole, focus: folPt(0, 40),
    labels: [
      { part: 'cortex', at: folPt(0, 46), side: 1, from: 0.25 },
      { part: 'bulb', at: folPt(-11, 90), side: -1, from: 0.05 },
      { part: 'shaft', at: folPt(0, -24), side: 1, from: 0.75 },
    ],
  },
  // ── 4. Wzrost ────────────────────────────────────────────────
  podzial: {
    med: 'wzrost', world: 'follicle', view: V.bulb, focus: folPt(-6, 88),
    labels: [
      { part: 'matrix', at: folPt(-9, 88), side: -1, from: 0.1 },
      { part: 'papilla', at: folPt(0, 95), side: 1, dy: 0.6, from: 0.4 },
    ],
  },
  twardnienie: {
    med: 'wzrost', world: 'follicle', view: V.mid, focus: folPt(0, 66),
    labels: [
      { part: 'keratin', at: folPt(2.5, 70), side: 1, dy: 0.8, from: 0.08 },
      { part: 'cuticle', at: folPt(-3, 58), side: -1, dy: -0.8, from: 0.35 },
      { part: 'cortex', at: folPt(1.6, 60), side: 1, dy: -0.8, from: 0.55 },
      { part: 'medulla', at: folPt(0, 62), side: -1, dy: 0.6, from: 0.75 },
    ],
  },
  skos: {
    med: 'wzrost', world: 'follicle', view: V.top, focus: folPt(0, -6),
    labels: [
      { part: 'opening', at: [6, 0], side: -1, dy: 0.9, from: 0.05 },
      { part: 'epidermis', at: [-18, 2.5], side: -1, dy: 1.8, from: 0.25 },
      { part: 'shaft', at: folPt(0, -14), side: 1, from: 0.6 },
    ],
  },
  // ── 5. Wir i kierunek ────────────────────────────────────────
  wir: {
    med: 'wir', world: 'above', view: ABOVE_VIEW, focus: [5, 16],
    labels: [{ part: 'whorl', at: [5, 16], side: 1, dy: 0.8, from: 0.15 }],
  },
  strumienie: {
    med: 'wir', world: 'above', view: ABOVE_VIEW, focus: [5, 16],
    labels: [
      { part: 'forward', at: [-3, -30], side: -1, from: 0.2 },
      { part: 'sideways', at: [-33, 4], side: -1, dy: 1, from: 0.45 },
      { part: 'nape', at: [8, 44], side: 1, from: 0.7 },
    ],
  },
  jednostki: {
    med: 'wir', world: 'skin', view: SKIN_VIEW, focus: [50, 50],
    labels: [{ part: 'unit', at: [50, 50], side: 1, dy: -1.5, from: 0.08 }],
  },
  // ── 6. Cykl odnowy ───────────────────────────────────────────
  anagen: {
    med: 'cykl', world: 'follicle', view: V.whole, focus: folPt(0, 92),
    labels: [
      { part: 'bulb', at: folPt(-11, 90), side: -1, from: 0.1 },
      { part: 'shaft', at: folPt(0, -12), side: 1, dy: 0.6, from: 0.5 },
    ],
  },
  katagen: {
    med: 'cykl', world: 'follicle', view: V.whole, focus: folPt(0, 60),
    labels: [
      { part: 'club', at: folPt(0, 38), side: -1, from: 0.55 },
      { part: 'bulge', at: folPt(9.5, FU.bulge), side: 1, from: 0.2 },
      { part: 'papilla', at: folPt(0, 50), side: 1, dy: 1, from: 0.7 },
    ],
  },
  nowy: {
    med: 'cykl', world: 'follicle', view: V.whole, focus: folPt(0, 52),
    labels: [
      { part: 'stem', at: folPt(9.5, FU.bulge), side: 1, from: 0.05 },
      { part: 'newhair', at: folPt(0, 74), side: -1, from: 0.45 },
      { part: 'club', at: folPt(0, 30), side: -1, dy: -1.2, from: 0.3 },
    ],
  },
  mozaika: {
    med: 'cykl', world: 'section', view: S.full, focus: secPt(mid, 0, 30),
    labels: [],
  },
  // ── 7. Odnowa skóry głowy ────────────────────────────────────
  naskorek: {
    med: 'skora', world: 'section', view: S.epi, focus: [0, 2.5],
    labels: [
      { part: 'basal', at: [-9, 4.4], side: -1, dy: 1, from: 0.1 },
      { part: 'corneum', at: [7, 0.6], side: 1, dy: -1, from: 0.55 },
    ],
  },
  sebum: {
    med: 'skora', world: 'follicle', view: V.top, focus: folPt(13.5, 22),
    labels: [
      { part: 'gland', at: folPt(14, 22), side: 1, from: 0.08 },
      { part: 'sebum', at: folPt(2, 6), side: -1, dy: -0.6, from: 0.5 },
    ],
  },
  bariera: {
    med: 'skora', world: 'follicle', view: V.top, focus: folPt(9.5, FU.bulge),
    labels: [
      { part: 'corneum', at: [-12, 0.8], side: -1, dy: -1.2, from: 0.1 },
      { part: 'stem', at: folPt(9.5, FU.bulge), side: 1, from: 0.4 },
    ],
  },
  // ── 8. Cała głowa ────────────────────────────────────────────
  cieplo: {
    med: 'cala', world: 'head', view: HEAD_VIEW, focus: [4, -50],
    labels: [{ part: 'arteries', at: [1, -10], side: -1, dy: 0.8, from: 0.2 }],
  },
  korzenie: {
    med: 'cala', world: 'section', view: S.full, focus: secPt(mid, 0, mid.len - 2),
    labels: [{ part: 'papilla', at: secPt(mid, 0, mid.len - 2.5), side: 1, dy: 1, from: 0.3 }],
  },
  wyrastanie: {
    med: 'cala', world: 'section', view: S.full, focus: secPt(mid, 0, -6),
    labels: [{ part: 'shaft', at: secPt(SEC_FOLLICLES[6], 0, -10), side: 1, dy: -0.6, from: 0.4 }],
  },
  glowa: {
    med: 'cala', world: 'head', view: HEAD_VIEW, focus: CROWN,
    labels: [],
  },
};

export interface MedSpec { scenes: readonly SceneId[]; verse: PassageId; bell: number }

export const MED: Readonly<Record<MedId, MedSpec>> = {
  krazenie: { scenes: ['czepiec', 'tetnice', 'siec'], verse: 'psa23.5', bell: 0 },
  korzen: { scenes: ['brodawka', 'petla', 'sygnaly'], verse: 'psa1.3', bell: 1 },
  kolor: { scenes: ['melanocyty', 'melanina', 'barwa'], verse: 'psa139.13-14', bell: 2 },
  wzrost: { scenes: ['podzial', 'twardnienie', 'skos'], verse: 'mrk4.27-28', bell: 3 },
  wir: { scenes: ['wir', 'strumienie', 'jednostki'], verse: 'luk12.7', bell: 4 },
  cykl: { scenes: ['anagen', 'katagen', 'nowy', 'mozaika'], verse: 'ecc3.1', bell: 5 },
  skora: { scenes: ['naskorek', 'sebum', 'bariera'], verse: 'psa103.5', bell: 6 },
  cala: { scenes: ['cieplo', 'korzenie', 'wyrastanie', 'glowa'], verse: 'psa3.3', bell: 7 },
};

/** Where a scene sits: its meditation and its index there. */
export function sceneAt(med: MedId, i: number): SceneId {
  const list = MED[med].scenes;
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(i)))];
}
export const sceneCount = (med: MedId): number => MED[med].scenes.length;
export const medIndex = (med: MedId): number => MEDS.indexOf(med);
export const allScenes = (): number => MEDS.reduce((n, m) => n + MED[m].scenes.length, 0);

/** One step along the library, scene by scene and meditation by meditation (wrapping round the eight). */
export function step(med: MedId, i: number, dir: 1 | -1): { med: MedId; i: number } {
  const j = i + dir;
  if (j >= 0 && j < sceneCount(med)) return { med, i: j };
  const k = (medIndex(med) + dir + MEDS.length) % MEDS.length;
  const next = MEDS[k];
  return { med: next, i: dir > 0 ? 0 : sceneCount(next) - 1 };
}

// ── the play modes ────────────────────────────────────────────────
/** In order (all eight, then again), just this one (then stay with its picture), or this one again and again. */
export const MODES = ['order', 'one', 'repeat'] as const;
export type Mode = (typeof MODES)[number];

// ── the player's hair colour ──────────────────────────────────────
export const COLOURS = ['black', 'darkbrown', 'brown', 'auburn', 'blond', 'grey'] as const;
export type HairColour = (typeof COLOURS)[number];

/**
 * Each colour: the strand's body and its sheen (so dark hair still reads on the dark ground), the share of
 * eumelanin among the granules (the rest pheomelanin), and how many granules the cells get (grey and white hair
 * has few active pigment cells).
 */
export const COLOUR: Readonly<Record<HairColour, { strand: string; sheen: string; eu: number; dens: number }>> = {
  black: { strand: '#2a1d18', sheen: '#a99ab8', eu: 0.95, dens: 1 },
  darkbrown: { strand: '#43281a', sheen: '#c39a7c', eu: 0.85, dens: 0.95 },
  brown: { strand: '#734a29', sheen: '#e0b080', eu: 0.7, dens: 0.85 },
  auburn: { strand: '#93401f', sheen: '#f39a66', eu: 0.3, dens: 0.8 },
  blond: { strand: '#c9a066', sheen: '#fbe6b8', eu: 0.25, dens: 0.45 },
  grey: { strand: '#b4b0ba', sheen: '#f6f4fa', eu: 0.5, dens: 0.12 },
};
/** Eumelanin's granules (black–brown) and pheomelanin's (yellow–red). */
export const EUMELANIN = '#3a2418';
export const PHEOMELANIN = '#d0702e';

// ── the words ─────────────────────────────────────────────────────
export const medName = (m: MedId): string => t(`med.${m}` as Key);
export const medLine = (m: MedId): string => t(`med.${m}.line` as Key);
export const sceneName = (s: SceneId): string => t(`scene.${s}` as Key);
export const sceneTeach = (s: SceneId): string => t(`teach.${s}` as Key);
export const partName = (p: Part): string => t(`part.${p}` as Key);
export const colourName = (c: HairColour): string => t(`colour.${c}` as Key);
export const modeName = (m: Mode): string => t(`mode.${m}` as Key);

/** The push strategies: the scene's own picture, and every third push a counting one (for those who do not picture easily). */
export const TIPS = {
  scene: Object.fromEntries(SCENES.map(s => [s, `tip.${s}`])) as Readonly<Record<SceneId, Key>>,
  count: 'tip.count' as Key,
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3', 'tip.rest.4'] as readonly Key[],
  blind: ['tip.blind.1', 'tip.blind.2'] as readonly Key[],
  warmup: 'tip.warmup' as Key,
};

/** The strategy of a push block on a scene: its picture, but every RULES.repeatEvery-th push the counting one. */
export function pushTip(s: SceneId, pushIndex: number): Key {
  if ((pushIndex + 1) % RULES.repeatEvery === 0) return TIPS.count;
  return TIPS.scene[s];
}

// ── the narrator's moments ────────────────────────────────────────
export const MOMENTS = [
  'open', 'warm', 'grown', 'whole', 'good', 'rest', 'blind', 'blindEnd', 'nosignal', 'still', 'after', 'again', 'end', 'grey',
  ...SCENES.map(s => `at.${s}` as const),
] as const;
export type Moment = (typeof MOMENTS)[number];

/** How many lines each moment has in the catalogs (`say.<moment>.<n>`): three for the shared moments, one a scene. */
export const LINE_COUNT: Readonly<Record<Moment, number>> = Object.fromEntries(MOMENTS.map(m => [m, m.startsWith('at.') || m === 'grey' ? 1 : 3])) as Record<Moment, number>;

/** The narrator's lines for a moment, in the page's language. */
export function linesOf(m: Moment): string[] {
  const out: string[] = [];
  for (let i = 1; i <= LINE_COUNT[m]; i++) out.push(t(`say.${m}.${i}` as Key));
  return out;
}

/** The portal of a shallower world for a deeper one: where the camera dives in (world units of the shallower world). */
export function portal(from: World, to: World): Pt | null {
  if (DEPTH[to] <= DEPTH[from]) return null;
  if (from === 'head') return CROWN;
  if (from === 'above') return ABOVE_PORTAL;
  if (from === 'section') return secPt(mid, 0, mid.len - 3);
  if (from === 'skin') return [50, 50];
  return null;
}
