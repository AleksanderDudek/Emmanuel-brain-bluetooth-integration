/**
 * What Światło ciała shows, as data (DESIGN.md §13.10, round 11): five meditations to choose — the organs head to toe,
 * the largest muscles (down the front, a turn, up the back), the brain (its lateral face, then a cut through the
 * middle), the limbs one segment after another (the left leg, the right leg, the left arm, the right arm), and the
 * nine homeostatic loops of the first version ("Równowaga") — each an ordered list of elements.  An element has its
 * view, its shape (figure.ts, brain.ts), its colours, its Latin name and the source of its fact; its words (the name,
 * one line of guidance — what to notice or imagine there — and one true fact) are in words-*.ts, Równowaga's in
 * i18n.ts with its loops (an everyday push out of the healthy range, what the body does, the value and the range).
 *
 * Honesty (DESIGN §13.3): every fact was checked against StatPearls (NCBI Bookshelf) or PubMed (the sources below);
 * the loops' values are a typical healthy body's, compressed, and the game says so; nothing claims to heal.
 */
import { fmtNum, lang } from '../../i18n';
import { BRAIN_LAT, BRAIN_MED, type BrainLatKey, type BrainMedKey } from './brain';
import { ARM_PARTS, LEG_PARTS, MUSCLE_GEO, ORGAN_GEO, limbGeo, type Geo, type LimbPart, type MuscleKey, type OrganKey } from './figure';
import { CATALOGS, t, type Key } from './i18n';
import { WORDS } from './words';

// ── the meditations ───────────────────────────────────────────────────────────────
export type VariantId = 'narzady' | 'miesnie' | 'mozg' | 'konczyny' | 'rownowaga';
export const VARIANTS: readonly VariantId[] = ['narzady', 'miesnie', 'mozg', 'konczyny', 'rownowaga'];

/** front / back of the figure, the brain's lateral face / its cut through the middle */
export type View = 'front' | 'back' | 'lat' | 'med';
export const isBrainView = (v: View): boolean => v === 'lat' || v === 'med';

export type LoopId = 'brain' | 'lungs' | 'heart' | 'liver' | 'adrenal' | 'kidney' | 'gut' | 'skin' | 'bone';

export interface Element {
  id: string;
  variant: VariantId;
  view: View;
  geo: Geo;
  /** lit (warm, glowing) and resting (deep) */
  hue: string;
  deep: string;
  latin: string;
  /** the fact's source (short; " i in." is Polish for "et al.") */
  src: string;
  /** Równowaga: the loop it runs */
  loop?: LoopId;
  /** Kończyny: the segment and the side (L = the person's left) */
  part?: LimbPart;
  side?: 'L' | 'R';
}

const SP = (authors: string, title: string, year: number): string => `${authors}, StatPearls: ${title} (${year})`;

// ── Narządy po kolei: 19, head to toe (the whole-body systems last) ──
const ORGANS_LIST: readonly [OrganKey, string, string, string, string][] = [
  ['brain', '#ffd9f2', '#6d4f86', 'encephalon', 'Raichle, Gusnard, PNAS 2002;99:10237'],
  ['eyes', '#bfe9ff', '#2f5f86', 'oculi', 'Curcio i in., J Comp Neurol 1990;292:497'],
  ['thyroid', '#ffc4d9', '#86405e', 'glandula thyroidea', SP('Shahid i in.', 'Physiology, Thyroid Hormone', 2023)],
  ['lungs', '#ffd0c2', '#8a4d5c', 'pulmones', SP('Hallett i in.', 'Physiology, Tidal Volume', 2023)],
  ['heart', '#ff9fb0', '#8c2f4a', 'cor', SP('King i in.', 'Physiology, Cardiac Output', 2023)],
  ['liver', '#eaa47c', '#7a3a2a', 'hepar', SP('Kalra i in.', 'Physiology, Liver', 2023)],
  ['gall', '#c9f08a', '#4f6a24', 'vesica biliaris', SP('Jones i in.', 'Anatomy, Gallbladder', 2026)],
  ['stomach', '#ffc7a8', '#8a5038', 'gaster', 'Allen, Flemström, Am J Physiol Cell Physiol 2005;288:C1'],
  ['spleen', '#d79aff', '#5a2a7a', 'lien', SP('Kapila i in.', 'Physiology, Spleen', 2023)],
  ['pancreas', '#ffe39a', '#86662a', 'pancreas', SP('Kamel-ElSayed, Mukherjee', 'Physiology, Pancreas', 2023)],
  ['adrenals', '#ffd27a', '#86602a', 'glandulae suprarenales', SP('Megha i in.', 'Anatomy, Adrenal Glands', 2022)],
  ['kidneys', '#e7b8ff', '#5e3a86', 'renes', SP('Dalal i in.', 'Physiology, Renal Blood Flow and Filtration', 2023)],
  ['small', '#ffcfa0', '#87523a', 'intestinum tenue', SP('Fish i in.', 'Physiology, Small Bowel', 2024)],
  ['large', '#f5b48c', '#7a4630', 'intestinum crassum', SP('Azzouz, Sharma', 'Physiology, Large Intestine', 2023)],
  ['bladder', '#fff0a8', '#7a6a2a', 'vesica urinaria', SP('Shermadou i in.', 'Anatomy, Bladder', 2023)],
  ['bones', '#f4f0ff', '#6b6787', 'ossa', SP('Cowan i in.', 'Anatomy, Bones', 2024)],
  ['marrow', '#ff8f8f', '#7a2a36', 'medulla ossium rubra', 'Caulier, Sankaran, Blood 2022;139:2450'],
  ['nodes', '#9ff0d8', '#2a6a5a', 'nodi lymphoidei', SP('Więcław, Gupta', 'Anatomy, Lymph Nodes', 2026)],
  ['skin', '#ffe2c6', '#7a5a46', 'cutis', SP('Lopez-Ojeda i in.', 'Anatomy, Skin (Integument)', 2022)],
];

// ── Największe mięśnie: down the front, then (the figure turns) up the back ──
const MUSCLES_LIST: readonly [MuscleKey, 'front' | 'back', string, string, string][] = [
  ['masseter', 'front', '#ffb4a2', 'musculus masseter', SP('Corcoran, Goldman', 'Anatomy, Masseter Muscle', 2023)],
  ['scm', 'front', '#ffa898', 'musculus sternocleidomastoideus', SP('Bordoni i in.', 'Anatomy, Sternocleidomastoid Muscle', 2026)],
  ['pectoral', 'front', '#ff9a8a', 'musculus pectoralis major', SP('Solari, Burns', 'Anatomy, Thorax, Pectoralis Major', 2023)],
  ['deltoid', 'front', '#ffae8a', 'musculus deltoideus', SP('Elzanie, Varacallo', 'Anatomy, Deltoid Muscle', 2024)],
  ['biceps', 'front', '#ff9f9f', 'musculus biceps brachii', SP('Tiwana i in.', 'Anatomy, Biceps Muscle', 2024)],
  ['diaphragm', 'front', '#ffc2b0', 'diaphragma', SP('Bains i in.', 'Anatomy, Thorax: Diaphragm', 2023)],
  ['rectus', 'front', '#ff9a8a', 'musculus rectus abdominis', SP('Flynn, Vickerton', 'Anatomy, Abdominal Wall', 2023)],
  ['obliques', 'front', '#ffa898', 'musculi obliqui abdominis', SP('Flynn, Vickerton', 'Anatomy, Abdominal Wall', 2023)],
  ['quadriceps', 'front', '#ff9480', 'musculus quadriceps femoris', SP('Bordoni, Varacallo', 'Anatomy, Thigh Quadriceps Muscle', 2023)],
  ['sartorius', 'front', '#ffbe9a', 'musculus sartorius', SP('Walters, Varacallo', 'Anatomy, Thigh Sartorius Muscle', 2023)],
  ['adductors', 'front', '#ffa898', 'musculi adductores', SP('Ramage, Varacallo', 'Anatomy, Medial Thigh Muscles', 2023)],
  ['tibialis', 'front', '#ffb4a2', 'musculus tibialis anterior', SP('Juneja, Hubbard', 'Anatomy, Tibialis Anterior Muscles', 2023)],
  ['calf', 'back', '#ff9f8f', 'musculus triceps surae', SP('Wong i in.', 'Anatomy, Achilles Tendon', 2023)],
  ['hamstrings', 'back', '#ff9480', 'musculi ischiocrurales', SP('Hu, Raja', 'Anatomy, Hamstring Muscle', 2026)],
  ['gluteus', 'back', '#ff8f80', 'musculus gluteus maximus', SP('Elzanie, Borger', 'Anatomy, Gluteus Maximus Muscle', 2023)],
  ['erector', 'back', '#ffb08f', 'musculus erector spinae', SP('Henson i in.', 'Anatomy, Back, Muscles', 2023)],
  ['latissimus', 'back', '#ff9a8a', 'musculus latissimus dorsi', SP('Jeno, Varacallo', 'Anatomy, Back, Latissimus Dorsi', 2023)],
  ['triceps', 'back', '#ffa898', 'musculus triceps brachii', SP('Tiwana i in.', 'Anatomy, Triceps Muscle', 2023)],
  ['trapezius', 'back', '#ffb4a2', 'musculus trapezius', SP('Ourieff i in.', 'Anatomy, Back, Trapezius', 2023)],
];

// ── Mózg: the lateral face (9), then a cut through the middle (12) ──
const BRAIN_LIST: readonly ([BrainLatKey, 'lat', string, string, string] | [BrainMedKey, 'med', string, string, string])[] = [
  ['prefrontal', 'lat', '#ffd27a', 'cortex praefrontalis', 'Arain i in., Neuropsychiatr Dis Treat 2013;9:449'],
  ['broca', 'lat', '#ff9fb0', 'area Broca', SP('Stinnett i in.', 'Neuroanatomy, Broca Area', 2023)],
  ['motor', 'lat', '#ffb38a', 'gyrus praecentralis', SP('Munakomi i in.', 'Physiology, Motor Cortex', 2026)],
  ['sensory', 'lat', '#9fe0ff', 'gyrus postcentralis', SP('Raju, Tadi', 'Neuroanatomy, Somatosensory Cortex', 2022)],
  ['parietal', 'lat', '#b9a8ff', 'lobus parietalis', SP('Maldonado, Alsayouri', 'Physiology, Brain', 2023)],
  ['wernicke', 'lat', '#ff9fd8', 'area Wernicke', SP('Javed i in.', 'Neuroanatomy, Wernicke Area', 2023)],
  ['temporal', 'lat', '#8fe8c8', 'lobus temporalis', 'Saenz, Langers, Hear Res 2014;307:42'],
  ['occipital', 'lat', '#a8c8ff', 'lobus occipitalis', SP('Huff i in.', 'Neuroanatomy, Visual Cortex', 2023)],
  ['insula', 'lat', '#ffe39a', 'insula', 'Craig, Nat Rev Neurosci 2009;10:59'],
  ['cingulate', 'med', '#c8b0ff', 'gyrus cinguli', 'Carter i in., Science 1998;280:747'],
  ['callosum', 'med', '#f4f0ff', 'corpus callosum', SP('Goldstein i in.', 'Neuroanatomy, Corpus Callosum', 2023)],
  ['thalamus', 'med', '#9fe0ff', 'thalamus', SP('Torrico, Munakomi', 'Neuroanatomy, Thalamus', 2023)],
  ['basal', 'med', '#ffb38a', 'nuclei basales', 'Lanciego i in., Cold Spring Harb Perspect Med 2012;2:a009621'],
  ['hippocampus', 'med', '#8fe8c8', 'hippocampus', SP('Fogwe i in.', 'Neuroanatomy, Hippocampus', 2023)],
  ['amygdala', 'med', '#ff9fb0', 'corpus amygdaloideum', SP('AbuHasan i in.', 'Neuroanatomy, Amygdala', 2023)],
  ['hypothalamus', 'med', '#ffd9f2', 'hypothalamus', SP('Bear i in.', 'Neuroanatomy, Hypothalamus', 2022)],
  ['pituitary', 'med', '#ffe39a', 'hypophysis', SP('Ganapathy, Tadi', 'Anatomy, Pituitary Gland', 2023)],
  ['midbrain', 'med', '#d79aff', 'mesencephalon', SP('Caminero, Cascella', 'Neuroanatomy, Midbrain', 2024)],
  ['pons', 'med', '#b9a8ff', 'pons', SP('Rahman, Tadi', 'Neuroanatomy, Pons', 2023)],
  ['medulla', 'med', '#a8c8ff', 'medulla oblongata', SP('Iordanova, Reddivari', 'Neuroanatomy, Medulla Oblongata', 2023)],
  ['cerebellum', 'med', '#9ff0d8', 'cerebellum', 'Herculano-Houzel, Front Hum Neurosci 2009;3:31'],
];
const BRAIN_DEEP: Readonly<Record<string, string>> = {
  prefrontal: '#7a5a1e', broca: '#7a2f45', motor: '#7a4026', sensory: '#25587a', parietal: '#43357a', wernicke: '#7a2f62',
  temporal: '#226650', occipital: '#2e4a7a', insula: '#7a6626', cingulate: '#4e3a7a', callosum: '#5e5a78', thalamus: '#25587a',
  basal: '#7a4026', hippocampus: '#226650', amygdala: '#7a2f45', hypothalamus: '#6d4f86', pituitary: '#7a6626',
  midbrain: '#5a2a7a', pons: '#43357a', medulla: '#2e4a7a', cerebellum: '#2a6a5a',
};

// ── Kończyny: two facts per segment (A for the left limb, B for the right) ──
const LIMB_SRC: Readonly<Record<LimbPart, readonly [string, string, string]>> = {
  toes: ['phalanges digitorum pedis', SP('Ficke i in.', 'Anatomy, Foot and Ankle', 2026), SP('Ficke i in.', 'Anatomy, Foot and Ankle', 2026)],
  foot: ['pes · planta pedis', SP('Chauhan, Taqi', 'Anatomy, Arches of the Foot', 2025), SP('Yousef i in.', 'Anatomy, Skin, Epidermis', 2024)],
  ankle: ['articulatio talocruralis', SP('Manganaro, Alsayouri', 'Anatomy, Ankle Joint', 2023), SP('Manganaro, Alsayouri', 'Anatomy, Ankle Joint', 2023)],
  shin: ['crus', SP('Cantrell i in.', 'Anatomy, Leg Bones', 2023), SP('Patel i in.', 'Venous Insufficiency', 2026)],
  knee: ['genu', SP('Gupton i in.', 'Anatomy, Knee', 2023), SP('Farrell i in.', 'Anatomy, Medial Meniscus', 2023)],
  thigh: ['femur', 'Feldesman i in., Am J Phys Anthropol 1990;83:359', SP('Swift, Bordoni', 'Anatomy, Femoral Artery', 2023)],
  hip: ['articulatio coxae', SP('Gold i in.', 'Anatomy, Hip Joint', 2023), SP('Gold i in.', 'Anatomy, Hip Joint', 2023)],
  fingers: ['digiti manus', SP('Arias i in.', 'Anatomy, Hand Bones', 2023), SP('Iheanacho, Vellipuram', 'Physiology, Mechanoreceptors', 2023)],
  hand: ['manus · palma', SP('Arias i in.', 'Anatomy, Hand Bones', 2023), SP('Nguyen, Duong', 'Anatomy, Opponens Pollicis Muscle', 2023)],
  wrist: ['carpus', SP('Tang, Varacallo', 'Anatomy, Hand Carpal Bones', 2022), SP('Rosario i in.', 'Electrodiagnostic Evaluation of Carpal Tunnel Syndrome', 2023)],
  forearm: ['antebrachium', SP('Patel, Varacallo', 'Anatomy, Forearm Bones', 2023), SP('Mitchell, Whited', 'Anatomy, Forearm Muscles', 2023)],
  elbow: ['articulatio cubiti', SP('Card i in.', 'Anatomy, Elbow Joint', 2025), SP('Becker, Manna', 'Anatomy, Ulnar Nerve', 2023)],
  arm: ['brachium', SP('Forro i in.', 'Anatomy, Arm Structure and Function', 2023), SP('Epperson, Varacallo', 'Anatomy, Brachial Artery', 2023)],
  shoulder: ['articulatio humeri', SP('Chang i in.', 'Anatomy, Glenohumeral Joint', 2025), SP('La Rose i in.', 'Anatomy, Rotator Cuff', 2026)],
};
const LIMB_HUE: Readonly<Record<LimbPart, string>> = {
  toes: '#ffe0a8', foot: '#ffd59a', ankle: '#ffcf8a', shin: '#ffc98a', knee: '#ffd27a', thigh: '#ffc47a', hip: '#ffbd7a',
  fingers: '#d8f0ff', hand: '#c8e8ff', wrist: '#b8e0ff', forearm: '#b0dcff', elbow: '#a8d4ff', arm: '#a0ccff', shoulder: '#98c4ff',
};

// ── Równowaga: the nine homeostatic loops of the first version ──
export type ValueKind = 'temp' | 'ph' | 'bpm' | 'glucose' | 'curve' | 'sodium' | 'renew' | 'skinph' | 'calcium';
export interface Kick { id: string; v0: number }
export interface LoopSpec {
  id: LoopId;
  kind: ValueKind;
  /** set point and healthy range (°C, pH, /min, mg/dL, × the day's curve, mmol/L, % renewed, pH, mmol/L) */
  set: number;
  lo: number;
  hi: number;
  kicks: readonly Kick[];
  /** the sources of the loop's numbers (ids of SOURCES) */
  src: readonly string[];
  /** the shape it lights (an organ of the organs' meditation) */
  shape: OrganKey | 'palms' | 'legBones' | 'gut' | 'liverPancreas';
  hue: string;
  deep: string;
  latin: string;
}

export const LOOP: Readonly<Record<LoopId, LoopSpec>> = {
  // the hypothalamus' preoptic area holds the core at 37 ± 0.5 °C (S1); sweat and wide skin vessels cool (S3, S4), narrow vessels and shivering warm (S5, S6)
  brain: { id: 'brain', kind: 'temp', set: 37, lo: 36.5, hi: 37.5, kicks: [{ id: 'bath', v0: 37.8 }, { id: 'cold', v0: 36.2 }], src: ['S1', 'S3', 'S5'], shape: 'brain', hue: '#ffd9f2', deep: '#6d4f86', latin: 'hypothalamus' },
  // blood pH 7.35–7.45 (S7); chemoreceptors read CO₂ and set the breath (S9)
  lungs: { id: 'lungs', kind: 'ph', set: 7.4, lo: 7.35, hi: 7.45, kicks: [{ id: 'hold', v0: 7.31 }, { id: 'fast', v0: 7.49 }], src: ['S7', 'S9'], shape: 'lungs', hue: '#ffd0c2', deep: '#8a4d5c', latin: 'pulmones' },
  // a resting adult heart beats 60–100 a minute (S11); the vagus brakes the SA node (S12)
  heart: { id: 'heart', kind: 'bpm', set: 72, lo: 60, hi: 100, kicks: [{ id: 'stairs', v0: 118 }, { id: 'noise', v0: 110 }], src: ['S11', 'S12'], shape: 'heart', hue: '#ff9fb0', deep: '#8c2f4a', latin: 'cor' },
  // healthy fasting glucose 70–99 mg/dL (S17); insulin from β cells, glucagon from α cells (S19); glycogen in the liver (S18)
  liver: { id: 'liver', kind: 'glucose', set: 88, lo: 70, hi: 99, kicks: [{ id: 'meal', v0: 138 }, { id: 'walk', v0: 64 }], src: ['S17', 'S18', 'S19'], shape: 'liverPancreas', hue: '#ffcf8a', deep: '#86512c', latin: 'hepar · pancreas' },
  // cortisol follows the day (highest ~8 am, lowest after midnight, S20); its own feedback ends a rise (S22)
  adrenal: { id: 'adrenal', kind: 'curve', set: 1, lo: 0.8, hi: 1.2, kicks: [{ id: 'stress', v0: 1.62 }], src: ['S20', 'S22'], shape: 'adrenals', hue: '#ffe39a', deep: '#86662a', latin: 'glandulae suprarenales' },
  // sodium 135–145 mmol/L (S26), ADH and thirst defend it (S26, S27)
  kidney: { id: 'kidney', kind: 'sodium', set: 140, lo: 135, hi: 145, kicks: [{ id: 'salty', v0: 148 }, { id: 'water', v0: 132 }], src: ['S26', 'S27'], shape: 'kidneys', hue: '#e7b8ff', deep: '#5e3a86', latin: 'renes' },
  // the gut's lining is renewed every ~3.5 days (S29): the share of renewed villus tips (a picture, no number shown)
  gut: { id: 'gut', kind: 'renew', set: 100, lo: 90, hi: 110, kicks: [{ id: 'busy', v0: 72 }], src: ['S29'], shape: 'gut', hue: '#ffc6a0', deep: '#87523a', latin: 'intestina' },
  // the skin's natural surface pH is ~4.7; tap water raises it for up to ~6 h (S36)
  skin: { id: 'skin', kind: 'skinph', set: 4.7, lo: 4.4, hi: 5, kicks: [{ id: 'wash', v0: 5.8 }], src: ['S36'], shape: 'palms', hue: '#c6f5ff', deep: '#3c6d84', latin: 'cutis palmae' },
  // serum calcium 2.2–2.6 mmol/L (8.8–10.4 mg/dL), PTH from four parathyroids defends it (S33, S34)
  bone: { id: 'bone', kind: 'calcium', set: 2.4, lo: 2.2, hi: 2.6, kicks: [{ id: 'low', v0: 2.15 }], src: ['S33', 'S34'], shape: 'legBones', hue: '#f4f0ff', deep: '#6b6787', latin: 'ossa' },
};
export const LOOPS: readonly LoopId[] = ['brain', 'lungs', 'heart', 'liver', 'adrenal', 'kidney', 'gut', 'skin', 'bone'];

/** Równowaga's extra shapes (the palms, the leg bones, the gut, the liver with the pancreas). */
const LOOP_GEO: Readonly<Record<'palms' | 'legBones' | 'gut' | 'liverPancreas', Geo>> = {
  palms: { shapes: [{ k: 'ell', x: 0.174, y: 0.535, rx: 0.016, ry: 0.03, rot: -0.2 }], mirror: true, c: [0, 0.535], r: 0.19, box: [-0.23, 0.45, 0.23, 0.62] },
  legBones: { shapes: [{ k: 'line', p: [[0.068, 0.49], [0.06, 0.6], [0.05, 0.715]], w: 0.014 }, { k: 'line', p: [[0.048, 0.75], [0.046, 0.84], [0.044, 0.925]], w: 0.012 }, { k: 'ell', x: 0.049, y: 0.732, rx: 0.009, ry: 0.009 }], mirror: true, c: [0, 0.7], r: 0.09, box: [-0.12, 0.45, 0.12, 0.96] },
  gut: { shapes: [...ORGAN_GEO.large.shapes, ...ORGAN_GEO.small.shapes], c: [0, 0.442], r: 0.06 },
  liverPancreas: { shapes: [...ORGAN_GEO.liver.shapes, ...ORGAN_GEO.pancreas.shapes], c: [-0.02, 0.335], r: 0.06 },
};

// ── the lists ─────────────────────────────────────────────────────────────────────
function build(): Record<VariantId, Element[]> {
  const narzady: Element[] = ORGANS_LIST.map(([k, hue, deep, latin, src]) => ({ id: `o.${k}`, variant: 'narzady', view: 'front', geo: ORGAN_GEO[k], hue, deep, latin, src }));
  const miesnie: Element[] = MUSCLES_LIST.map(([k, view, hue, latin, src]) => ({ id: `m.${k}`, variant: 'miesnie', view, geo: MUSCLE_GEO[k], hue, deep: '#6e2a32', latin, src }));
  const mozg: Element[] = BRAIN_LIST.map(([k, view, hue, latin, src]) => ({
    id: `b.${k}`, variant: 'mozg', view, geo: view === 'lat' ? BRAIN_LAT[k as BrainLatKey] : BRAIN_MED[k as BrainMedKey], hue, deep: BRAIN_DEEP[k], latin, src,
  }));
  const konczyny: Element[] = [];
  for (const [side, parts] of [['L', LEG_PARTS], ['R', LEG_PARTS], ['L', ARM_PARTS], ['R', ARM_PARTS]] as const) {
    for (const part of parts) {
      const [latin, srcA, srcB] = LIMB_SRC[part];
      konczyny.push({ id: `l.${side}.${part}`, variant: 'konczyny', view: 'front', geo: limbGeo(part, side), hue: LIMB_HUE[part], deep: '#9a8460', latin, src: side === 'L' ? srcA : srcB, part, side });
    }
  }
  const rownowaga: Element[] = LOOPS.map(id => {
    const L = LOOP[id];
    const geo = L.shape in LOOP_GEO ? LOOP_GEO[L.shape as keyof typeof LOOP_GEO] : ORGAN_GEO[L.shape as OrganKey];
    return { id: `r.${id}`, variant: 'rownowaga', view: 'front', geo, hue: L.hue, deep: L.deep, latin: L.latin, src: L.src.map(sourceShort).join('; '), loop: id };
  });
  return { narzady, miesnie, mozg, konczyny, rownowaga };
}


// ── words ───────────────────────────────────────────────────────────────────────────
type Lang = keyof typeof WORDS;
const words = () => WORDS[lang as Lang] ?? WORDS.pl;

export function elName(e: Element): string {
  if (e.loop) return t(`organ.${e.loop}` as Key);
  return words().name[e.id] ?? e.id;
}
/** The guidance line: what to notice or imagine at the element (the push's strategy too). */
export function elGuide(e: Element): string {
  if (e.loop) return t(`guide.${e.loop}` as Key);
  if (e.part) return words().guide[`l.${e.part}`] ?? '';
  return words().guide[e.id] ?? '';
}
/** The fact card (Równowaga: one depth deeper each time the loop was lit before, organs → cells → systems). */
export function elFact(e: Element, depth = 1): string {
  if (e.loop) return t(`fact.${e.loop}.${Math.min(3, Math.max(1, depth))}` as Key);
  return words().fact[e.id] ?? '';
}
export function elSource(e: Element, depth = 1): string {
  if (e.loop) return sourceText(FACT_SRC[e.loop][Math.min(3, Math.max(1, depth)) - 1]);
  return localSource(e.src);
}
export const variantName = (v: VariantId): string => t(`v.${v}` as Key);
export const variantLine = (v: VariantId): string => t(`v.${v}.line` as Key);

// ── Równowaga's loops ──────────────────────────────────────────────────────────────
/** The loop's deviation in half-ranges (|d| ≤ 1 inside the range), on the side the value is on. */
export function devOf(o: LoopSpec, v: number): number {
  return v >= o.set ? (v - o.set) / (o.hi - o.set) : -(o.set - v) / (o.set - o.lo);
}
/** The value at a deviation (the inverse of devOf). */
export function valOf(o: LoopSpec, d: number): number {
  return d >= 0 ? o.set + d * (o.hi - o.set) : o.set + d * (o.set - o.lo);
}
/** inside this many half-ranges the value counts as home */
export const BALANCE = 0.8;
/**
 * The loop's value at a fill (0 → 1): the first-order way home of the first version, d = d₀ · (B/d₀)^fill, so the
 * value enters the healthy band exactly when the light is full.
 */
export function loopValueAt(id: LoopId, kick: Kick, fill: number): number {
  const o = LOOP[id];
  const d0 = devOf(o, kick.v0);
  const sign = d0 >= 0 ? 1 : -1, mag = Math.max(BALANCE, Math.abs(d0));
  const f = Math.max(0, Math.min(1, fill));
  return valOf(o, sign * BALANCE * (mag / BALANCE) ** (1 - f));
}
/** The everyday push a loop starts from this time (turns with the session and the round). */
export const kickOf = (id: LoopId, n: number): Kick => LOOP[id].kicks[Math.abs(Math.floor(n)) % LOOP[id].kicks.length];

const NB = ' ';
/** Glucose in the page's language's habit: mg/dl in Polish and German labs, mmol/l in British and Swedish ones. */
export const glucoseMmol = (): boolean => lang === 'en' || lang === 'sv';

/** A loop's value as the card shows it ("37,8 °C", "pH 7,31", "118/min", "138 mg/dl"); null where the picture speaks instead. */
export function valueText(o: LoopSpec, v: number): string | null {
  switch (o.kind) {
    case 'temp': return `${fmtNum(v, 1)}${NB}°C`;
    case 'ph': return `pH${NB}${fmtNum(v, 2)}`;
    case 'bpm': return `${Math.round(v)}/min`;
    case 'glucose': return glucoseMmol() ? `${fmtNum(v / 18.016, 1)}${NB}${t('u.mmol')}` : `${Math.round(v)}${NB}mg/dl`;
    case 'sodium': return `${Math.round(v)}${NB}${t('u.mmol')}`;
    case 'skinph': return `pH${NB}${fmtNum(v, 1)}`;
    case 'calcium': return `${fmtNum(v, 2)}${NB}${t('u.mmol')}`;
    default: return null;
  }
}

/** The healthy range as the card shows it ("36,5–37,5 °C"), or a word where no number is shown. */
export function rangeText(o: LoopSpec): string {
  const r = (a: number, b: number, digits: number, unit: string) => `${fmtNum(a, digits)}–${fmtNum(b, digits)}${unit ? `${NB}${unit}` : ''}`;
  switch (o.kind) {
    case 'temp': return r(o.lo, o.hi, 1, '°C');
    case 'ph': return `pH${NB}${r(o.lo, o.hi, 2, '')}`;
    case 'bpm': return `${o.lo}–${o.hi}/min`;
    case 'glucose': return glucoseMmol() ? r(3.9, 5.5, 1, t('u.mmol')) : `${o.lo}–${o.hi}${NB}mg/dl`;
    case 'sodium': return `${o.lo}–${o.hi}${NB}${t('u.mmol')}`;
    case 'skinph': return t('range.skin');
    case 'calcium': return r(o.lo, o.hi, 1, t('u.mmol'));
    case 'curve': return t('range.curve');
    case 'renew': return t('range.renew');
  }
}

export const kickText = (o: LoopId, kick: string): string => t(`kick.${o}.${kick}` as Key);
export const fixText = (o: LoopId, kick: string): string => t(`fix.${o}.${kick}` as Key);

// ── the sources of Równowaga (DESIGN.md §13.10 gives them in full) ──
export const SOURCES: Readonly<Record<string, string>> = {
  S1: 'Osilla i in., StatPearls: Temperature Regulation (2023)',
  S2: 'Mackowiak i in., JAMA 1992;268:1578',
  S3: 'Charkoudian, Mayo Clin Proc 2003;78:603',
  S4: 'Baker, Temperature 2019;6:211',
  S5: 'Haman, Blondin, Temperature 2017;4:217',
  S6: 'Morrison, Nakamura, Annu Rev Physiol 2019;81:285',
  S7: 'Hopkins i in., StatPearls: Acid Base Balance (2022)',
  S8: 'Ochs i in., Am J Respir Crit Care Med 2004;169:120',
  S9: 'Brinkman i in., StatPearls: Respiratory Drive (2023)',
  S10: 'Russo i in., Breathe 2017;13:298',
  S11: 'Henning, Krawiec, StatPearls: Sinus Tachycardia (2023)',
  S12: 'Hafeez i in., StatPearls: Sinus Bradycardia (2026)',
  S13: 'Lehrer, Gevirtz, Front Psychol 2014;5:756',
  S14: 'Shaffer, Ginsberg, Front Public Health 2017;5:258',
  S15: 'Schandry, Psychophysiology 1981;18:483',
  S16: 'Berthoud, Neuhuber, Auton Neurosci 2000;85:1',
  S17: 'ADA, Standards of Care in Diabetes 2025, §2 i §6',
  S18: 'Jensen i in., Front Physiol 2011;2:112',
  S19: 'Kamel-ElSayed, Mukherjee, StatPearls: Pancreas (2023)',
  S20: 'Chourpiliadis, Aeddula, StatPearls: Glucocorticoids (2023)',
  S21: 'Stalder i in., Psychoneuroendocrinology 2016;63:414',
  S22: 'Smith, Vale, Dialogues Clin Neurosci 2006;8:383',
  S23: 'Berson i in., Science 2002;295:1070',
  S24: 'Kaufman i in., StatPearls: Glomerular Filtration Rate (2023)',
  S25: 'Bertram i in., Pediatr Nephrol 2011;26:1529',
  S26: 'Rout, Afzal; Sonani, Al-Dhahir, StatPearls (2023–2026)',
  S27: 'Cuzzo i in., StatPearls: Vasopressin (2023)',
  S28: 'Helander, Fändriks, Scand J Gastroenterol 2014;49:681',
  S29: 'Darwich i in., Drug Metab Dispos 2014;42:2016',
  S30: 'Sender i in., PLoS Biol 2016;14:e1002533',
  S31: 'Bergstresser, Taylor, Br J Dermatol 1977; Iizuka, J Dermatol Sci 1994',
  S32: 'Yousef i in., StatPearls: Epidermis (2024)',
  S33: 'Sahota i in., StatPearls: Calcium (2026)',
  S34: 'Lofrese i in., StatPearls: Parathyroid (2023)',
  S35: 'Surgeon General, Bone Health and Osteoporosis (2004)',
  S36: 'Lambers i in., Int J Cosmet Sci 2006;28:359',
};
const sourceShort = (id: string): string => (SOURCES[id] ?? id).split(',')[0];

/** A source line in the page's language ("i in." is Polish for "et al."). */
export function localSource(s: string): string {
  return lang === 'pl' ? s : s.replace(/ i in\./g, lang === 'de' ? ' u. a.' : lang === 'sv' ? ' m.fl.' : ' et al.').replace(/ i §/g, lang === 'de' ? ' und §' : lang === 'sv' ? ' och §' : ' and §');
}
export const sourceText = (id: string): string => localSource(SOURCES[id] ?? id);

/** Równowaga's Wiedza cards: one per loop and depth, each with its source. */
export const FACT_SRC: Readonly<Record<LoopId, readonly [string, string, string]>> = {
  brain: ['S1', 'S2', 'S3'],
  lungs: ['S8', 'S7', 'S10'],
  heart: ['S11', 'S12', 'S13'],
  liver: ['S17', 'S18', 'S19'],
  adrenal: ['S20', 'S21', 'S22'],
  kidney: ['S24', 'S25', 'S26'],
  gut: ['S28', 'S29', 'S30'],
  skin: ['S36', 'S31', 'S4'],
  bone: ['S33', 'S35', 'S34'],
};

// ── the strategies under a block's name ("W głowie"): the element's own guidance, every third push a counting one ──
export const TIPS = {
  warmup: 'tip.warmup' as Key,
  count: ['tip.count.1', 'tip.count.2', 'tip.count.3'] as Key[],
  blind: ['tip.blind.1', 'tip.blind.2'] as Key[],
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3', 'tip.rest.4'] as Key[],
};

// ── the guide's moments (Zofia: calm, kind, a soft humour) ──
export type Moment =
  | 'open' | 'warm' | 'push' | 'rest' | 'blind' | 'blindEnd' | 'good' | 'nosignal' | 'still' | 'valve' | 'lit' | 'whole'
  | 'turn' | 'dive' | 'inner' | 'resume' | 'pick' | 'end' | 'pulse';

export const MOMENTS: readonly Moment[] = [
  'open', 'warm', 'push', 'rest', 'blind', 'blindEnd', 'good', 'nosignal', 'still', 'valve', 'lit', 'whole', 'turn', 'dive', 'inner',
  'resume', 'pick', 'end', 'pulse',
];

/** A moment's lines in the page's language (three each; a mouse's variant says "click" where there is one). */
export function linesOf(m: Moment, mouse = false): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const key = `say.${m}.${i}`;
    out.push(t((mouse && `${key}.mouse` in CATALOGS.pl ? `${key}.mouse` : key) as Key));
  }
  return out;
}

/**
 * Cortisol's typical day (S20, S21): relative to its daily mean, highest about 8 am, lowest between midnight and 4 am,
 * with the rise after waking — a smooth picture of the shape, no units.
 */
export function cortisolCurve(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const morning = Math.exp(-((h - 8) ** 2) / (2 * 1.6 ** 2));
  const day = h >= 8 ? Math.max(0, 1 - (h - 8) / 16) : Math.max(0, (h - 3) / 5);
  return 0.15 + 0.55 * morning + 0.35 * day;
}

// ── the lists (built last: Równowaga's sources are above) ──
export const LISTS: Readonly<Record<VariantId, readonly Element[]>> = build();
export const ELEMENT: Readonly<Record<string, Element>> = Object.fromEntries(VARIANTS.flatMap(v => LISTS[v].map(e => [e.id, e])));
export const ALL_IDS: readonly string[] = VARIANTS.flatMap(v => LISTS[v].map(e => e.id));
export const count = (v: VariantId): number => LISTS[v].length;
export const elementAt = (v: VariantId, i: number): Element => LISTS[v][Math.max(0, Math.min(LISTS[v].length - 1, Math.floor(i)))];
