/**
 * The brain of Światło ciała's "Mózg" meditation, as geometry in brain units: x from the frontal pole (0, the
 * forehead, on the viewer's left) to the occipital pole (≈ 1), y from the top (0) down past the brainstem (≈ 0.9).
 *
 *   lateral   the LEFT hemisphere seen from the left (Broca's and Wernicke's areas are on the left in most people):
 *             the lobes and the strips of the motor and the touch cortex as regions clipped to the hemisphere's
 *             outline, the insula as a window deep in the lateral fissure, the cerebellum and the brainstem under it
 *   medial    a cut through the middle (the inner face, the forehead still on the left): the corpus callosum, the
 *             cingulate arching over it, the thalamus, the hypothalamus and the pituitary hanging under it, the
 *             midbrain, the pons, the medulla, the cerebellum with its "tree of life"; the basal ganglia, the
 *             hippocampus and the amygdala lie off the midline and are drawn as deep shapes seen through (ghosts)
 *
 * Placement follows the standard atlas views (Gray's; StatPearls neuroanatomy chapters); the shapes are simplified
 * so that each part reads on a phone.
 */
import type { Geo, P } from './figure';

/** The hemisphere's outline, lateral view (clockwise from the frontal pole). */
export const LAT_OUTLINE: readonly P[] = [
  [0.02, 0.36], [0.035, 0.25], [0.09, 0.14], [0.19, 0.065], [0.32, 0.022], [0.46, 0.01], [0.6, 0.028], [0.73, 0.08],
  [0.84, 0.16], [0.93, 0.26], [0.975, 0.36], [0.98, 0.44], [0.955, 0.51], [0.89, 0.548], [0.79, 0.56], [0.68, 0.595],
  [0.56, 0.636], [0.45, 0.645], [0.35, 0.625], [0.28, 0.585], [0.245, 0.54], [0.25, 0.5], [0.235, 0.488], [0.18, 0.49],
  [0.1, 0.47], [0.045, 0.43],
];

/** The inner face's outline, medial view (the same top, the cut floor under the corpus callosum and the thalamus). */
export const MED_OUTLINE: readonly P[] = [
  [0.02, 0.36], [0.035, 0.25], [0.09, 0.14], [0.19, 0.065], [0.32, 0.022], [0.46, 0.01], [0.6, 0.028], [0.73, 0.08],
  [0.84, 0.16], [0.93, 0.26], [0.975, 0.36], [0.98, 0.44], [0.955, 0.51], [0.9, 0.54], [0.8, 0.528], [0.71, 0.505],
  [0.65, 0.49], [0.6, 0.5], [0.53, 0.53], [0.46, 0.55], [0.4, 0.545], [0.34, 0.52], [0.29, 0.5], [0.2, 0.495],
  [0.1, 0.47], [0.045, 0.43],
];

/** The cerebellum and the brainstem as the lateral view shows them (not elements there: the medial view has them). */
export const LAT_CEREBELLUM: readonly P[] = [[0.66, 0.6], [0.76, 0.566], [0.88, 0.572], [0.95, 0.622], [0.93, 0.7], [0.84, 0.75], [0.72, 0.742], [0.64, 0.69]];
export const LAT_STEM: readonly P[] = [[0.55, 0.6], [0.63, 0.6], [0.65, 0.68], [0.63, 0.8], [0.62, 0.9], [0.57, 0.9], [0.56, 0.8], [0.535, 0.68]];

/** The central sulcus (between the motor strip in front and the touch strip behind). */
const C: readonly P[] = [[0.5, -0.05], [0.49, 0.1], [0.465, 0.2], [0.44, 0.3], [0.415, 0.41]];
const shift = (pts: readonly P[], dx: number): P[] => pts.map(([x, y]) => [x + dx, y] as P);
const PRE = shift(C, -0.065);
const POST = shift(C, 0.06);

/** The sulci drawn as quiet lines (lateral view); the first three are drawn a little stronger. */
export const LAT_SULCI: readonly (readonly P[])[] = [
  // the lateral fissure, the central sulcus
  [[0.25, 0.49], [0.33, 0.452], [0.45, 0.418], [0.56, 0.388], [0.62, 0.352]],
  C.slice(1),
  [[0.84, 0.16], [0.82, 0.3], [0.8, 0.45]],
  // the rest
  PRE.slice(1, 4), POST.slice(1, 4),
  [[0.1, 0.2], [0.2, 0.145], [0.33, 0.122]],
  [[0.08, 0.33], [0.2, 0.29], [0.33, 0.275]],
  [[0.56, 0.2], [0.68, 0.22], [0.79, 0.28]],
  [[0.3, 0.535], [0.45, 0.505], [0.6, 0.47], [0.74, 0.47]],
  [[0.36, 0.595], [0.5, 0.585], [0.67, 0.553]],
  [[0.87, 0.3], [0.91, 0.4], [0.89, 0.49]],
  [[0.13, 0.4], [0.22, 0.375]],
  [[0.6, 0.12], [0.66, 0.16]],
];

/** The sulci of the inner face (the cingulate sulcus, the parieto-occipital and the calcarine). */
export const MED_SULCI: readonly (readonly P[])[] = [
  [[0.2, 0.42], [0.22, 0.27], [0.34, 0.15], [0.52, 0.125], [0.68, 0.15], [0.72, 0.1]],
  [[0.85, 0.16], [0.8, 0.3], [0.75, 0.44]],
  [[0.965, 0.43], [0.86, 0.44], [0.76, 0.46]],
  [[0.1, 0.25], [0.16, 0.2]],
  [[0.6, 0.06], [0.62, 0.11]],
];

/** The cerebellum's "tree of life" (arbor vitae) on the inner face. */
const ARBOR: readonly (readonly P[])[] = [
  [[0.68, 0.6], [0.76, 0.6], [0.84, 0.58]], [[0.76, 0.6], [0.82, 0.64], [0.88, 0.64]], [[0.74, 0.6], [0.78, 0.67], [0.84, 0.7]],
  [[0.72, 0.6], [0.72, 0.68], [0.76, 0.72]], [[0.76, 0.6], [0.8, 0.54]],
];

/** The parts on the lateral view (clipped to LAT_OUTLINE where they are bands). */
const LAT = {
  prefrontal: { shapes: [{ k: 'poly', p: [[-0.1, -0.1], [0.345, -0.1], [0.34, 0], [0.25, 0.47], [0.22, 0.62], [-0.1, 0.62]] }], clip: 'brainL', c: [0.15, 0.28], r: 0.13 },
  broca: { shapes: [{ k: 'blob', p: [[0.27, 0.44], [0.275, 0.38], [0.31, 0.352], [0.35, 0.37], [0.352, 0.418], [0.31, 0.448]] }], c: [0.31, 0.4], r: 0.05 },
  motor: { shapes: [{ k: 'poly', p: [...PRE, [0.35, 0.432], [0.415, 0.415], ...C.slice().reverse()] }], clip: 'brainL', c: [0.43, 0.2], r: 0.06 },
  sensory: { shapes: [{ k: 'poly', p: [...C, [0.475, 0.398], ...POST.slice().reverse()] }], clip: 'brainL', c: [0.5, 0.2], r: 0.06 },
  parietal: { shapes: [{ k: 'poly', p: [[0.56, -0.05], [0.55, 0.1], [0.525, 0.2], [0.5, 0.3], [0.475, 0.398], [0.56, 0.388], [0.62, 0.352], [0.81, 0.42], [0.83, 0.15], [0.86, -0.05]] }], clip: 'brainL', c: [0.67, 0.22], r: 0.1 },
  wernicke: { shapes: [{ k: 'blob', p: [[0.585, 0.405], [0.64, 0.378], [0.72, 0.402], [0.735, 0.448], [0.66, 0.472], [0.595, 0.452]] }], c: [0.66, 0.425], r: 0.05 },
  temporal: { shapes: [{ k: 'poly', p: [[0.2, 0.5], [0.25, 0.49], [0.33, 0.452], [0.45, 0.418], [0.56, 0.388], [0.62, 0.352], [0.81, 0.42], [0.8, 0.72], [0.2, 0.72]] }], clip: 'brainL', c: [0.47, 0.54], r: 0.1 },
  occipital: { shapes: [{ k: 'poly', p: [[0.86, -0.05], [0.83, 0.15], [0.81, 0.42], [0.8, 0.62], [1.1, 0.62], [1.1, -0.05]] }], clip: 'brainL', c: [0.9, 0.38], r: 0.07 },
  insula: { shapes: [{ k: 'ell', x: 0.43, y: 0.43, rx: 0.1, ry: 0.036, rot: -0.27 }], deep: true, c: [0.43, 0.43], r: 0.06 },
} as const satisfies Record<string, Geo>;

/** The parts on the medial view (a cut through the middle). */
const MED = {
  cingulate: { shapes: [{ k: 'line', p: [[0.32, 0.47], [0.255, 0.38], [0.28, 0.26], [0.4, 0.2], [0.55, 0.19], [0.7, 0.222], [0.78, 0.3], [0.765, 0.4]], w: 0.05 }], c: [0.5, 0.2], r: 0.08 },
  callosum: { shapes: [{ k: 'line', p: [[0.335, 0.43], [0.302, 0.37], [0.36, 0.3], [0.5, 0.272], [0.64, 0.292], [0.718, 0.34], [0.7, 0.386]], w: 0.042 }], c: [0.5, 0.29], r: 0.07 },
  thalamus: { shapes: [{ k: 'ell', x: 0.53, y: 0.378, rx: 0.075, ry: 0.044 }], c: [0.53, 0.378], r: 0.06 },
  basal: { shapes: [{ k: 'line', p: [[0.385, 0.415], [0.395, 0.368], [0.47, 0.334], [0.58, 0.33], [0.64, 0.352]], w: 0.03 }, { k: 'ell', x: 0.45, y: 0.425, rx: 0.045, ry: 0.03, rot: 0.2 }], deep: true, c: [0.46, 0.38], r: 0.07 },
  hippocampus: { shapes: [{ k: 'line', p: [[0.5, 0.548], [0.56, 0.532], [0.62, 0.502], [0.66, 0.462]], w: 0.032 }], deep: true, c: [0.58, 0.51], r: 0.06 },
  amygdala: { shapes: [{ k: 'ell', x: 0.466, y: 0.558, rx: 0.024, ry: 0.019 }], deep: true, c: [0.466, 0.558], r: 0.035 },
  hypothalamus: { shapes: [{ k: 'blob', p: [[0.418, 0.424], [0.47, 0.424], [0.482, 0.46], [0.452, 0.49], [0.41, 0.472]] }], c: [0.445, 0.455], r: 0.04 },
  pituitary: { shapes: [{ k: 'line', p: [[0.43, 0.487], [0.408, 0.516]], w: 0.01 }, { k: 'ell', x: 0.404, y: 0.532, rx: 0.021, ry: 0.016 }], c: [0.405, 0.525], r: 0.03 },
  midbrain: { shapes: [{ k: 'blob', p: [[0.54, 0.43], [0.61, 0.42], [0.632, 0.48], [0.612, 0.522], [0.552, 0.522], [0.53, 0.48]] }], c: [0.58, 0.47], r: 0.045 },
  pons: { shapes: [{ k: 'ell', x: 0.585, y: 0.585, rx: 0.056, ry: 0.06 }], c: [0.585, 0.585], r: 0.06 },
  medulla: { shapes: [{ k: 'blob', p: [[0.558, 0.642], [0.622, 0.642], [0.618, 0.72], [0.603, 0.82], [0.574, 0.82], [0.564, 0.72]] }], c: [0.59, 0.72], r: 0.05 },
  cerebellum: { shapes: [{ k: 'blob', p: [[0.66, 0.53], [0.76, 0.5], [0.88, 0.53], [0.945, 0.6], [0.92, 0.69], [0.83, 0.742], [0.72, 0.732], [0.66, 0.672], [0.645, 0.6]] }], marks: ARBOR, c: [0.79, 0.62], r: 0.11 },
} as const satisfies Record<string, Geo>;

export type BrainLatKey = keyof typeof LAT;
export type BrainMedKey = keyof typeof MED;
export const BRAIN_LAT: Readonly<Record<BrainLatKey, Geo>> = LAT;
export const BRAIN_MED: Readonly<Record<BrainMedKey, Geo>> = MED;

/** The brain views' box in brain units (with a margin for the glow). */
export const BRAIN_BOX = { x0: -0.02, y0: -0.03, x1: 1.0, y1: 0.92 } as const;
