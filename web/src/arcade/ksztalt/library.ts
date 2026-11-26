/**
 * Lekkość i siła (`ksztalt`, DESIGN.md §24): a library of six short guided meditations about the body made lighter
 * and stronger — as it truly happens — in a woman's or a man's silhouette (the looks `ona` / `on`).  Rooted in
 * 1 Corinthians 6:19–20 ("your body is a temple… glorify God in your body"): the body's own work, offered in thanks,
 * never a promise, never a diet, never a comparison.
 *
 *   1 Lekki wydech        the fat cell's signal · albumin carries · in the mitochondrion · the exhale (84 % as CO₂)
 *   2 Komórka tłuszczowa  the droplet shrinks (the cells stay) · ~10 % renewed a year · sleep and the signals of fullness
 *   3 Mięsień rośnie      the sign of effort (protein built faster for a day or two) · satellite cells · building in rest
 *   4 Pierś i postawa     the chest muscle under the breast · the shoulder blades drawn back · upright
 *   5 Talia i rdzeń       the deep corset · from the whole body, not one spot · the fat round the organs
 *   6 Całe ciało          light and strong · the temple, upright
 *
 * Every number on screen and its source: the design notes (§24, the "ksztalt" table).  The pictures are five worlds
 * drawn in code (world-*.ts); the engine (kit/healthlib) does the rest.
 */
import type { HealthLibrary, MedSpec, SceneSpec } from '../kit/healthlib/spec';
import { translatorFor } from '../kit/healthlib/lib';
import { lang } from '../../i18n';
import { BODY, BODY_WORLD } from './world-body';
import { FIBRE_WORLD, R0, SAT, curvePt } from './world-fibre';
import { MITO, MITO_WORLD } from './world-mito';
import { PROFILE_WORLD } from './world-profile';
import { TISSUE, TISSUE_PARTS, TISSUE_WORLD, capX } from './world-tissue';
import { WORDS } from './i18n';
import { buildTune } from './tune';

const MEDS: readonly MedSpec[] = [
  { id: 'wydech', scenes: ['sygnal', 'albumina', 'mitochondrium', 'oddech'], verse: 'psa150.6' },
  { id: 'komorka', scenes: ['kropla', 'odnowa', 'sen'], verse: 'psa127.2' },
  { id: 'miesien', scenes: ['bodziec', 'satelity', 'budowa'], verse: 'isa40.29' },
  { id: 'postawa', scenes: ['piersiowy', 'lopatki', 'wyprost'], verse: 'psa145.14' },
  { id: 'talia', scenes: ['gorset', 'wszedzie', 'trzewny'], verse: 'psa18.32' },
  { id: 'cale', scenes: ['lekkosc', 'postac'], verse: 'psa139.13-14' },
];

const sig = TISSUE.signal;
const cells = TISSUE_PARTS.cells;
const fresh = cells[TISSUE_PARTS.newCell].c;
const old = cells[TISSUE_PARTS.oldCell].c;
const lobuleCell = cells[Math.floor(cells.length / 2)].c;
const CHEST_VIEW = { x: -18, y: 3, w: 30, h: 44 };
const POSTURE_VIEW = { x: -19, y: -5, w: 32, h: 62 };

const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Lekki wydech ─────────────────────────────────────────
  sygnal: {
    world: 'tissue', variant: 'signal', view: { x: -112, y: -72, w: 146, h: 128 }, focus: sig,
    labels: [
      { part: 'adipocyte', at: [sig[0] - 16, sig[1] + 16], side: -1, dy: 0.6, from: 0.04 },
      { part: 'nerve', at: TISSUE_PARTS.nerveAt(0.5), side: -1, dy: -0.4, from: 0.12 },
      { part: 'fattyacids', at: [capX(sig[1]) - 16, sig[1] + 10], side: -1, dy: 1.6, from: 0.5 },
    ],
  },
  albumina: {
    world: 'tissue', view: { x: -36, y: -72, w: 150, h: 144 }, focus: [capX(0), 0],
    labels: [
      { part: 'capillary', at: [capX(-44) - 5, -44], side: -1, from: 0.04 },
      { part: 'albumin', at: [capX(24) - 3, 24], side: -1, dy: 0.4, from: 0.2 },
      { part: 'fibre', at: [TISSUE.fibreX + 6, -52], side: 1, dy: -0.4, from: 0.35 },
      { part: 'mitos', at: TISSUE_PARTS.mitos.reduce((b, m) => (Math.abs(m[1] - 30) < Math.abs(b[1] - 30) && m[0] < 110 ? m : b)), side: 1, dy: 0.8, from: 0.6 },
    ],
  },
  mitochondrium: {
    world: 'mito', view: { x: -150, y: -96, w: 300, h: 184 }, focus: MITO.GATE,
    labels: [
      { part: 'mito', at: [-58, -46], side: -1, dy: -0.8, from: 0.02 },
      { part: 'betaox', at: [MITO.SPIRAL[0], MITO.SPIRAL[1] + 14], side: -1, dy: 1, from: 0.22 },
      { part: 'krebs', at: [MITO.CYCLE[0], MITO.CYCLE[1] + 18], side: 1, dy: 1, from: 0.42 },
      { part: 'co2', at: [74, -66], side: 1, from: 0.55 },
      { part: 'water', at: [62, 30], side: 1, dy: 1.4, from: 0.75 },
    ],
  },
  oddech: {
    world: 'body', view: { x: -30, y: -18, w: 60, h: 62 }, focus: [0, 31],
    labels: [
      { part: 'lungs', at: [-6, 31], side: -1, from: 0.04 },
      { part: 'alveoli', at: [5.5, 34], side: 1, dy: 0.6, from: 0.3 },
      { part: 'exhale', at: [2.5, -4], side: 1, dy: -0.4, from: 0.55 },
    ],
  },
  // ── 2. Komórka tłuszczowa ────────────────────────────────────
  kropla: {
    world: 'tissue', variant: 'open', view: { x: -168, y: -112, w: 204, h: 224 }, focus: [-60, 0],
    labels: [
      { part: 'adipocytes', at: [lobuleCell[0], lobuleCell[1] - 6], side: -1, dy: -0.6, from: 0.05 },
      { part: 'droplet', at: [sig[0], sig[1] + 6], side: 1, dy: 0.6, from: 0.25 },
      { part: 'capillary', at: [capX(70) - 5, 70], side: -1, from: 0.5 },
    ],
  },
  odnowa: {
    world: 'tissue', variant: 'renew', view: { x: -168, y: -112, w: 204, h: 224 }, focus: TISSUE.fresh,
    labels: [
      { part: 'oldcell', at: old, side: -1, dy: 0.4, from: 0.08 },
      { part: 'progenitor', at: TISSUE.fresh, side: -1, dy: -1.4, from: 0.2 },
      { part: 'newcell', at: [fresh[0], fresh[1] + 8], side: -1, dy: 1, from: 0.7 },
    ],
  },
  sen: {
    world: 'body', variant: 'night', view: { x: -62, y: -30, w: 124, h: 60 }, focus: [BODY.hypo[0] + 8, BODY.hypo[1]],
    labels: [
      { part: 'hypothalamus', at: BODY.hypo, side: 1, dy: -1.9, from: 0.06 },
      { part: 'ghrelin', at: [BODY.stomach[0] - 6, BODY.stomach[1] + 5], side: 1, dy: 1.3, from: 0.2 },
      { part: 'leptin', at: [-6, -1], side: 1, dy: -1.5, from: 0.35 },
      { part: 'fat', at: [12, 6], side: 1, dy: 1.2, from: 0.55 },
    ],
  },
  // ── 3. Mięsień rośnie ────────────────────────────────────────
  bodziec: {
    world: 'fibre', variant: 'curve', view: { x: -150, y: -72, w: 300, h: 188 }, focus: curvePt(0, 0),
    labels: [
      { part: 'myofibrils', at: [-96, -13], side: -1, dy: -0.6, from: 0.06 },
      { part: 'nuclei', at: [26, R0 - 3], side: 1, dy: 0.7, from: 0.3 },
      { part: 'synthesis', at: curvePt(24, 65), side: 1, dy: -1, from: 0.55 },
    ],
  },
  satelity: {
    world: 'fibre', view: { x: -100, y: -82, w: 130, h: 84 }, focus: [SAT[0][0], -(R0 + 1.8)],
    labels: [
      { part: 'satellite', at: [SAT[0][0] - 6, -(R0 + 2)], side: -1, dy: -1.3, from: 0.05 },
      { part: 'lamina', at: [-84, -(R0 + 3.6)], side: 1, dy: -1.3, from: 0.25 },
      { part: 'newnucleus', at: [SAT[0][0] + 8, -(R0 - 3)], side: 1, dy: 1.3, from: 0.66 },
    ],
  },
  budowa: {
    world: 'fibre', variant: 'grow', view: { x: -150, y: -86, w: 300, h: 172 }, focus: [-110, 0],
    labels: [
      { part: 'aminoacids', at: [-96, -58], side: 1, dy: -0.5, from: 0.05 },
      { part: 'capillary', at: [70, 68], side: 1, dy: 0.6, from: 0.2 },
      { part: 'newfibrils', at: [-30, 6], side: 1, dy: -0.4, from: 0.4 },
    ],
  },
  // ── 4. Pierś i postawa ───────────────────────────────────────
  piersiowy: {
    world: 'profile', view: CHEST_VIEW, focus: [-4.6, 26],
    labels: [
      { part: 'pectoral', at: [-5, 27], side: -1, dy: 0.8, from: 0.08 },
      { part: 'clavicle', at: [-3, 19.8], side: -1, dy: -1, from: 0.35 },
      { part: 'upperarm', at: [0.4, 30], side: 1, dy: 0.4, from: 0.6 },
    ],
  },
  lopatki: {
    world: 'body', variant: 'back', view: { x: -26, y: 8, w: 52, h: 40 }, focus: [0, 24],
    labels: [
      { part: 'scapula', at: [6.4, 25.5], side: 1, dy: 0.4, from: 0.08 },
      { part: 'rhomboid', at: [-2.4, 24], side: -1, dy: 0.6, from: 0.2 },
      { part: 'trapezius', at: [-6, 19.8], side: -1, dy: -1.1, from: 0.4 },
      { part: 'spine', at: [0, 38], side: 1, from: 0.6 },
    ],
  },
  wyprost: {
    world: 'profile', view: POSTURE_VIEW, focus: [-1, 18],
    labels: [
      { part: 'upperback', at: [4.4, 23], side: 1, dy: 0.6, from: 0.15 },
      { part: 'shoulder', at: [0.1, 21.2], side: 1, dy: -0.8, from: 0.35 },
      { part: 'chestline', at: [-7, 25], side: -1, from: 0.5 },
      { part: 'ear', at: [0.8, 8], side: 1, dy: -0.4, from: 0.7 },
    ],
  },
  // ── 5. Talia i rdzeń ─────────────────────────────────────────
  gorset: {
    world: 'body', view: { x: -22, y: 24, w: 44, h: 34 }, focus: [0, 43],
    labels: [
      { part: 'tra', at: [-6, 48], side: -1, dy: 0.4, from: 0.08 },
      { part: 'obliques', at: [7.5, 36], side: 1, from: 0.4 },
      { part: 'rectus', at: [1.6, 31], side: 1, dy: -1, from: 0.65 },
    ],
  },
  wszedzie: {
    world: 'body', view: { x: -34, y: -4, w: 68, h: 108 }, focus: [0, 46],
    labels: [
      { part: 'abs', at: [-1, 41], side: -1, from: 0.08 },
      { part: 'whole', at: [6, 64], side: 1, from: 0.45 },
    ],
  },
  trzewny: {
    world: 'body', view: { x: -20, y: 27, w: 40, h: 32 }, focus: [0, 45],
    labels: [
      { part: 'stomach', at: [3.6, 33.5], side: 1, dy: -1, from: 0.05 },
      { part: 'intestines', at: [5, 44], side: 1, from: 0.15 },
      { part: 'visceral', at: [-5, 48], side: -1, dy: 0.4, from: 0.3 },
    ],
  },
  // ── 6. Całe ciało ────────────────────────────────────────────
  lekkosc: {
    world: 'body', view: { x: -34, y: -14, w: 68, h: 118 }, focus: [0, 30],
    labels: [
      { part: 'breath', at: [0, 4], side: 1, dy: -1.2, from: 0.3 },
      { part: 'muscles', at: [6, 64], side: 1, from: 0.5 },
    ],
  },
  postac: {
    world: 'body', view: { x: -34, y: -6, w: 68, h: 110 }, focus: [0, 96],
    labels: [],
  },
};

/** Where a dive from a shallower picture into a deeper one opens (world units of the shallower, inside its view). */
function portal(shallow: string, deep: string): readonly [number, number] | null {
  const a = SCENES[shallow], b = SCENES[deep];
  if (!a || !b) return null;
  let p: readonly [number, number];
  if (a.world === 'body') p = shallow === 'sen' ? [12, 5.5] : b.world === 'tissue' ? BODY.hip : BODY.thigh;
  else if (a.world === 'profile') p = [-4.5, 25];
  else if (a.world === 'tissue') p = [TISSUE.fibreX + 30, 0];
  else if (a.world === 'fibre') p = [0, 0];
  else return null;
  // kept inside the shallower picture's view, so the camera dives into what is on the screen
  const v = a.view, mx = v.w * 0.08, my = v.h * 0.08;
  return [Math.min(v.x + v.w - mx, Math.max(v.x + mx, p[0])), Math.min(v.y + v.h - my, Math.max(v.y + my, p[1]))];
}

/** The short counts on a picture's corner, in the page's language. */
const T = translatorFor(WORDS, lang).t;
function counter(scene: string, g: number): string | null {
  if (scene === 'oddech' && g > 0.6) return T('count.oddech');
  if (scene === 'bodziec') {
    if (g >= 0.92) return T('count.bodziec.3');
    if (g >= 0.55) return T('count.bodziec.2');
    if (g >= 0.15) return T('count.bodziec.1');
  }
  if (scene === 'odnowa' && g > 0.5) return T('count.odnowa');
  return null;
}
const withCounter = <W extends { counter?: (s: string, g: number) => string | null }>(w: W): W => ({ ...w, counter });

export const LIBRARY: HealthLibrary = {
  id: 'ksztalt',
  meds: MEDS,
  scenes: SCENES,
  worlds: {
    body: withCounter(BODY_WORLD),
    profile: PROFILE_WORLD,
    tissue: withCounter(TISSUE_WORLD),
    fibre: withCounter(FIBRE_WORLD),
    mito: MITO_WORLD,
  },
  portal,
  root: '1co6.19-20',
  closers: ['psa16.9', 'rom12.1', 'isa40.31', 'eph2.10'],
  looks: ['ona', 'on'],
  perScene: 12,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#170c1e', light: '#ffc7a8' },
};
