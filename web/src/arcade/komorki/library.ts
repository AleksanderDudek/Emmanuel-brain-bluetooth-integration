/**
 * Każda komórka (`komorki`, DESIGN.md §24): a library of six short guided meditations about the processes inside the
 * cells that keep a body renewed and supplied with energy — as they truly are.  Rooted in Psalm 103:5 ("who
 * satisfies you with good things, so that your youth is renewed like the eagle's"): renewal as God's gift, offered
 * in thanks, never a promise of growing younger.
 *
 *   1 Energia        the mitochondrion · the respiratory chain · ATP synthase turning · new mitochondria from movement
 *   2 Sprzątanie     autophagy: wrapped · taken apart in a lysosome · reused
 *   3 Naprawa        the book of DNA · one letter mended · a stretch cut out and written anew
 *   4 Odnowa tkanek  the gut's lining in days · the marrow's blood cells · each tissue at its own pace
 *   5 Noc odnowy     the waves of sleep · the night's growth-hormone pulse · fluid in the brain (mouse data, said so)
 *   6 Cała komórka   the whole cell at once · the whole body
 *
 * Every number on screen and its source: the design notes (§24, the "komorki" table).  The pictures are ten worlds
 * drawn in code (world-*.ts); the engine (kit/healthlib) does the rest.
 */
import type { HealthLibrary, MedSpec, SceneSpec } from '../kit/healthlib/spec';
import { CELL_WORLD, MITOS, NUC, OLD } from './world-cell';
import { MITO_WORLD, cristaMid } from './world-mito';
import { MEMBRANE_WORLD, SYN } from './world-membrane';
import { FIRST_NEW, MUSCLE_MITO, MUSCLE_NUCLEI, MUSCLE_WORLD } from './world-muscle';
import { DNA_WORLD, LESION_X, strandAY } from './world-dna';
import { CRYPTS, GUT, GUT_WORLD, VILLI } from './world-gut';
import { MARROW_WORLD, STEMS, SINUSOID_AT } from './world-marrow';
import { BODY_WORLD, BRAIN, GUT_AT, HEART } from './world-body';
import { FIRST_REM, LATE_REM, NIGHT_WORLD, PITUITARY, TROUGH } from './world-night';
import { ART_X, ASTROS, BRAIN_WORLD, NEURONS, VEN_X, vesselX } from './world-brain';
import { WORDS } from './i18n';
import { buildTune } from './tune';

const MEDS: readonly MedSpec[] = [
  { id: 'energia', scenes: ['grzebienie', 'lancuch', 'wirnik', 'nowe'], verse: 'isa40.29' },
  { id: 'sprzatanie', scenes: ['otoczenie', 'lizosom', 'odzysk'], verse: 'rev21.5' },
  { id: 'naprawa', scenes: ['ksiega', 'litera', 'odcinek'], verse: 'psa139.16' },
  { id: 'odnowa', scenes: ['jelito', 'szpik', 'tempo'], verse: 'lam3.22-23' },
  { id: 'noc', scenes: ['fale', 'hormon', 'mozg'], verse: 'psa127.2' },
  { id: 'cala', scenes: ['komorka', 'cialo'], verse: 'psa139.13-14' },
];

/** The autophagy scenes' close view, to the right of the nucleus. */
const TIDY = { x: -6, y: -46, w: 100, h: 80 };

const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Energia ───────────────────────────────────────────────
  grzebienie: {
    world: 'mito', view: { x: -124, y: -64, w: 248, h: 128 }, focus: cristaMid(6),
    labels: [
      { part: 'outer', at: [-70, -47], side: -1, dy: -0.8, from: 0.04 },
      { part: 'cristae', at: cristaMid(4), side: 1, dy: -0.4, from: 0.3 },
      { part: 'inner', at: [50, 44], side: 1, dy: 0.9, from: 0.5 },
      { part: 'matrix', at: [-30, 20], side: -1, dy: 0.6, from: 0.68 },
      { part: 'mtdna', at: [24, 20], side: 1, dy: 0.6, from: 0.84 },
    ],
  },
  lancuch: {
    world: 'membrane', view: { x: -112, y: -58, w: 224, h: 116 }, focus: [-60, 50],
    labels: [
      { part: 'c1', at: [-88, -8], side: -1, dy: -1, from: 0.04 },
      { part: 'protons', at: [-60, -34], side: 1, dy: -0.6, from: 0.25 },
      { part: 'c3', at: [-17, -15], side: -1, dy: -1.2, from: 0.42 },
      { part: 'c4', at: [24, -15], side: 1, dy: -1.2, from: 0.62 },
      { part: 'oxygen', at: [30, 26], side: 1, dy: 0.6, from: 0.84 },
    ],
  },
  wirnik: {
    world: 'membrane', view: { x: 34, y: -36, w: 84, h: 94 }, focus: [SYN.x, SYN.headY],
    labels: [
      { part: 'rotor', at: [SYN.x - 12, 0], side: -1, from: 0.04 },
      { part: 'protons', at: [SYN.x + 8, -26], side: 1, dy: -0.5, from: 0.15 },
      { part: 'head', at: [SYN.x - 16, SYN.headY], side: -1, from: 0.3 },
      { part: 'atp', at: [SYN.x + 18, 50], side: 1, from: 0.55 },
    ],
  },
  nowe: {
    world: 'muscle', view: { x: -84, y: -58, w: 168, h: 116 }, focus: MUSCLE_NUCLEI[0],
    labels: [
      { part: 'fibre', at: [-72, 14], side: 1, dy: 0.4, from: 0.04 },
      { part: 'nucleus', at: MUSCLE_NUCLEI[0], side: 1, dy: -1.4, from: 0.18 },
      { part: 'pgc', at: MUSCLE_NUCLEI[1], side: 1, dy: 1.3, from: 0.3 },
      { part: 'mitochondria', at: FIRST_NEW, side: 1, dy: -1, from: 0.5 },
      { part: 'capillary', at: [56, -50], side: 1, dy: -0.4, from: 0.75 },
    ],
  },
  // ── 2. Sprzątanie ────────────────────────────────────────────
  otoczenie: {
    world: 'cell', view: TIDY, focus: [OLD[0] - 10, OLD[1] - 12],
    labels: [
      { part: 'oldmito', at: [42, -18], side: -1, dy: -1.4, from: 0.04 },
      { part: 'autophagosome', at: [64, -10], side: 1, dy: -0.4, from: 0.8 },
    ],
  },
  lizosom: {
    world: 'cell', view: TIDY, focus: OLD,
    labels: [
      { part: 'lysosome', at: [62, 2], side: 1, dy: 0.8, from: 0.18 },
      { part: 'enzymes', at: [52, -24], side: 1, dy: -0.8, from: 0.55 },
    ],
  },
  odzysk: {
    world: 'cell', view: TIDY, focus: OLD,
    labels: [
      { part: 'aminoacids', at: [28, 6], side: 1, dy: 1.6, from: 0.12 },
      { part: 'ribosomes', at: [8, -22], side: -1, dy: -0.6, from: 0.45 },
    ],
  },
  // ── 3. Naprawa ───────────────────────────────────────────────
  ksiega: {
    world: 'dna', view: { x: -100, y: -40, w: 200, h: 80 }, focus: [LESION_X[0], 0],
    labels: [
      { part: 'helix', at: [-88, -12], side: 1, dy: -1.6, from: 0.04 },
      { part: 'damage', at: [LESION_X[7], strandAY(24) * 0.65], side: -1, dy: 1.6, from: 0.02 },
      { part: 'crew', at: [LESION_X[4], -18], side: 1, dy: -1.2, from: 0.3 },
    ],
  },
  litera: {
    world: 'dna', variant: 'close', view: { x: -38, y: -36, w: 76, h: 72 }, focus: [-30, -9],
    labels: [
      { part: 'damage', at: [0, strandAY(0)], side: -1, dy: 1.2, from: 0.02, to: 0.6 },
      { part: 'crew', at: [-10, strandAY(0) - 9], side: -1, dy: -1.2, from: 0.12 },
      { part: 'newbase', at: [0, -2.3], side: 1, dy: 1.2, from: 0.6 },
    ],
  },
  odcinek: {
    world: 'dna', variant: 'close', view: { x: -62, y: -42, w: 124, h: 84 }, focus: [-3, -17],
    labels: [
      { part: 'dimer', at: [-1.6, strandAY(0) * 0.55 + 2], side: -1, dy: 1.4, from: 0.02 },
      { part: 'crew', at: [-24, -21], side: -1, dy: -1, from: 0.15 },
      { part: 'patch', at: [5, strandAY(1)], side: 1, dy: 1.4, from: 0.62 },
    ],
  },
  // ── 4. Odnowa tkanek ─────────────────────────────────────────
  jelito: {
    world: 'gut', view: { x: -118, y: -96, w: 236, h: 200 }, focus: [CRYPTS[2] + GUT.CW * 0.5, GUT.CRYPT_Y],
    labels: [
      { part: 'crypt', at: [CRYPTS[3], GUT.CRYPT_Y - 8], side: 1, dy: 0.4, from: 0.04 },
      { part: 'stem', at: [CRYPTS[2], GUT.CRYPT_Y + 5], side: -1, dy: 1, from: 0.12 },
      { part: 'villus', at: [VILLI[2] + GUT.VW, -30], side: 1, from: 0.38 },
      { part: 'capillary', at: [VILLI[1] - 6, -20], side: -1, dy: 0.6, from: 0.6 },
      { part: 'shed', at: [VILLI[3], GUT.TIP_Y - GUT.VW - 6], side: -1, dy: -0.6, from: 0.8 },
    ],
  },
  szpik: {
    world: 'marrow', view: { x: -120, y: -82, w: 240, h: 164 }, focus: STEMS[0],
    labels: [
      { part: 'bone', at: [-70, -70], side: 1, dy: -0.8, from: 0.04 },
      { part: 'stem', at: STEMS[0], side: -1, dy: 1, from: 0.15 },
      { part: 'rbc', at: SINUSOID_AT(-6), side: 1, dy: -1.6, from: 0.45 },
      { part: 'sinusoid', at: SINUSOID_AT(84), side: 1, dy: 1.4, from: 0.7 },
    ],
  },
  tempo: {
    world: 'body', view: { x: -78, y: -104, w: 156, h: 208 }, focus: GUT_AT,
    labels: [
      { part: 'gut', at: [GUT_AT[0] + 8, GUT_AT[1]], side: 1, dy: 0.2, from: 0.08 },
      { part: 'blood', at: [11, 32], side: 1, from: 0.28 },
      { part: 'skin', at: [-28, -40], side: -1, from: 0.48 },
      { part: 'heart', at: HEART, side: 1, dy: -0.4, from: 0.68 },
      { part: 'cortex', at: [BRAIN[0], BRAIN[1] - 4], side: 1, dy: -0.6, from: 0.86 },
    ],
  },
  // ── 5. Noc odnowy ────────────────────────────────────────────
  fale: {
    world: 'night', view: { x: -135, y: -116, w: 270, h: 196 }, focus: [-122, -84],
    labels: [
      { part: 'deep', at: TROUGH, side: 1, dy: 1, from: 0.12 },
      { part: 'cycle', at: FIRST_REM, side: 1, dy: -1, from: 0.3 },
      { part: 'rem', at: LATE_REM, side: 1, dy: -1, from: 0.62 },
    ],
  },
  hormon: {
    world: 'night', view: { x: -135, y: -116, w: 270, h: 196 }, focus: PITUITARY,
    labels: [
      { part: 'deep', at: TROUGH, side: 1, dy: 1, from: 0.02 },
      { part: 'pituitary', at: PITUITARY, side: 1, dy: -1.8, from: 0.06 },
      { part: 'gh', at: [-20, 52], side: 1, dy: -1.4, from: 0.4 },
    ],
  },
  mozg: {
    world: 'brain', view: { x: -110, y: -80, w: 220, h: 160 }, focus: [ART_X + 11, -10],
    labels: [
      { part: 'vessel', at: [vesselX(ART_X, -60, 0), -60], side: 1, dy: -0.6, from: 0.04 },
      { part: 'neurons', at: NEURONS[1], side: 1, dy: 0.4, from: 0.2 },
      { part: 'astro', at: ASTROS[0], side: -1, dy: 0.6, from: 0.38 },
      { part: 'fluid', at: [vesselX(ART_X, 40, 0) - 9, 40], side: -1, dy: 1, from: 0.55 },
      { part: 'waste', at: [vesselX(VEN_X, 30, 2) - 10, 30], side: 1, dy: 1, from: 0.75 },
    ],
  },
  // ── 6. Cała komórka ──────────────────────────────────────────
  komorka: {
    world: 'cell', view: { x: -118, y: -84, w: 236, h: 168 }, focus: [-8, 0],
    labels: [
      { part: 'nucleus', at: [NUC.x - 22, NUC.y - 18], side: -1, dy: -0.8, from: 0.04 },
      { part: 'mitochondria', at: [MITOS[0][0], MITOS[0][1]], side: 1, dy: 1, from: 0.2 },
      { part: 'lysosome', at: [64, -42], side: 1, dy: -0.6, from: 0.45 },
      { part: 'membrane', at: [-60, -60], side: -1, dy: -1, from: 0.7 },
    ],
  },
  cialo: {
    world: 'body', view: { x: -78, y: -104, w: 156, h: 208 }, focus: HEART,
    labels: [{ part: 'rbc', at: [-11, 40], side: -1, dy: 0.6, from: 0.5 }],
  },
};

export const LIBRARY: HealthLibrary = {
  id: 'komorki',
  meds: MEDS,
  scenes: SCENES,
  worlds: {
    cell: CELL_WORLD,
    mito: MITO_WORLD,
    membrane: MEMBRANE_WORLD,
    muscle: MUSCLE_WORLD,
    dna: DNA_WORLD,
    gut: GUT_WORLD,
    marrow: MARROW_WORLD,
    body: BODY_WORLD,
    night: NIGHT_WORLD,
    brain: BRAIN_WORLD,
  },
  portal(shallow, deep) {
    const a = SCENES[shallow]?.world, b = SCENES[deep]?.world;
    if (a === 'cell' && (b === 'mito' || b === 'membrane')) return [MITOS[0][0], MITOS[0][1]];
    if (a === 'cell' && b === 'dna') return [NUC.x, NUC.y];
    if (a === 'mito' && b === 'membrane') return cristaMid(6);
    if (a === 'muscle' && (b === 'mito' || b === 'membrane')) return MUSCLE_MITO;
    if (a === 'body' && b === 'gut') return GUT_AT;
    if (a === 'body' && b === 'marrow') return [11, 32];
    if (a === 'body' && b === 'brain') return BRAIN;
    if (a === 'body' && (b === 'cell' || b === 'mito' || b === 'membrane' || b === 'muscle' || b === 'dna')) return HEART;
    if (a === 'night' && b === 'brain') return PITUITARY;
    return null;
  },
  root: 'psa103.5',
  closers: ['2co4.16', 'isa40.31', 'psa104.24', 'psa16.9'],
  looks: [],
  perScene: 120,
  words: WORDS,
  tune: () => buildTune(),
  tint: { ground: '#170d22', light: '#ffd27a' },
};
