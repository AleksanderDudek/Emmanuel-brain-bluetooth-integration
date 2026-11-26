/**
 * Pełnia radości (`radosc`, DESIGN.md §24): a library of six short guided meditations on great joy — how it is
 * received, grows, and multiplies — as Scripture and the science of well-being both describe it.  Rooted in Psalm 16:11
 * ("obfitość wesela jest przed obliczem twojem" — fullness of joy in Your presence): joy as a gift received, tended and
 * shared, never a promise of happiness and never something focus manufactures.
 *
 *   1 Ziarno radości   one good thing noticed and savoured · the brain's reward circuit (dopamine as wanting) ·
 *                      staying with the good (prefrontal cortex and striatum)
 *   2 Wdzięczność      three good things and why · roots (gratitude over weeks, small but real) · a letter of thanks
 *   3 Dobroć           the gift handed on · the light that comes back to the giver
 *   4 Więzi            close ones (Harvard since 1938) · three degrees (Framingham) · laughing together (opioids)
 *   5 Spirala w górę   joy widens attention · the upward spiral builds lasting resources
 *   6 Pełnia           joy felt in the whole body · the garden in bloom · good passed on, multiplied
 *
 * Every number on screen and its source: the design notes (§24, the "radosc" table).  The pictures are six worlds
 * drawn in code (world-*.ts); the engine (kit/healthlib) does the rest.
 */
import type { PassageId } from '../kit/scripture';
import type { HealthLibrary, LabelSpec, MedSpec, Pt, SceneSpec } from '../kit/healthlib/spec';
import { FIG, figPt } from './draw';
import { WORDS } from './i18n';
import { buildTune } from './tune';
import { MOZG_WORLD, BAND, DLPFC, NACC, PFC, VTA } from './world-mozg';
import { BLOOMS, FOUR, GROUND, OGROD_WORLD, WHY } from './world-ogrod';
import { BROW, FIGURE, GOOD, HEART, POSTAC_WORLD } from './world-postac';
import { DWOJE_WORLD, H1, H2 } from './world-dwoje';
import { NODES, SIEC_WORLD } from './world-siec';
import { BEAD_AT, SPIRALA_WORLD, WHO } from './world-spirala';

export const MEDS: readonly MedSpec[] = [
  { id: 'ziarno', scenes: ['dostrzec', 'nagroda', 'trwac'], verse: 'psa118.24' },
  { id: 'wdziecznosc', scenes: ['trzy', 'korzenie', 'list'], verse: 'psa103.2' },
  { id: 'dobroc', scenes: ['dar', 'powrot'], verse: '2co9.7' },
  { id: 'wiezi', scenes: ['bliscy', 'stopnie', 'smiech'], verse: 'ecc4.9-10' },
  { id: 'spirala', scenes: ['szerzej', 'buduje'], verse: 'rom15.13' },
  { id: 'pelnia', scenes: ['cialo', 'ogrod', 'plynie'], verse: 'jhn15.11' },
];

// ── places on the pictures the labels point at ─────────────────────
const near = (ring: number, ang: number): Pt => {
  // the node of a ring nearest an angle (radians, screen: 0 → right, −π/2 → up)
  let best = NODES[0], d = Infinity;
  for (const n of NODES) {
    if (n.ring !== ring) continue;
    const a = Math.atan2(n.at[1], n.at[0]);
    const dd = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
    if (dd < d) { d = dd; best = n; }
  }
  return best.at;
};
const CLOSE: Rect = { x: -56, y: -54, w: 112, h: 104 };
const WIDE: Rect = { x: -114, y: -104, w: 228, h: 206 };
type Rect = { x: number; y: number; w: number; h: number };
const shift = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];
const side = (p: Pt): -1 | 1 => (p[0] >= 0 ? 1 : -1);

export const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Ziarno radości ─────────────────────────────────────────
  dostrzec: {
    world: 'postac', view: { x: -66, y: -114, w: 200, h: 134 }, focus: HEART,
    labels: [
      { part: 'dobro', at: shift(GOOD, 0, 14), side: 1, dy: 0.6, from: 0.04 },
      { part: 'uwaga', at: shift(BROW, 8, -2), side: 1, dy: -1.1, from: 0.14 },
      { part: 'ziarno', at: shift(HEART, -6, 0), side: -1, from: 0.42 },
    ],
  },
  nagroda: {
    world: 'mozg', view: { x: -104, y: -88, w: 208, h: 170 }, focus: VTA,
    labels: [
      { part: 'vta', at: VTA, side: 1, dy: 0.7, from: 0.05 },
      { part: 'dopamina', at: [-52, 1], side: 1, dy: 0.2, from: 0.55 },
      { part: 'prazkowie', at: NACC, side: -1, dy: 1.2, from: 0.48 },
      { part: 'pfc', at: [-60, -44], side: 1, dy: -0.6, from: 0.76 },
      { part: 'punkty', at: [-24, 19], side: -1, dy: 2.4, from: 0.88 },
    ],
  },
  trwac: {
    world: 'mozg', variant: 'loop', view: { x: -106, y: -80, w: 164, h: 160 }, focus: [(DLPFC[0] + NACC[0]) / 2 + 2, (DLPFC[1] + NACC[1]) / 2],
    labels: [
      { part: 'opaska', at: shift(BAND, 3, -16), side: 1, dy: -0.9, from: 0.04 },
      { part: 'pfc', at: shift(DLPFC, 6, 2), side: 1, from: 0.26 },
      { part: 'prazkowie', at: NACC, side: 1, dy: 0.9, from: 0.46 },
      { part: 'slad', at: [-84, 44], side: 1, dy: -0.6, from: 0.14 },
    ],
  },
  // ── 2. Wdzięczność ────────────────────────────────────────────
  trzy: {
    world: 'ogrod', view: { x: -92, y: -92, w: 184, h: 152 }, focus: [0, -30],
    labels: [
      { part: 'kwiat', at: shift(BLOOMS[0].at, -12, 0), side: -1, from: 0.44 },
      { part: 'zrodlo', at: shift(WHY[0], -6, 0), side: -1, dy: 0.4, from: 0.55 },
    ],
  },
  korzenie: {
    world: 'ogrod', view: { x: -100, y: -84, w: 200, h: 196 }, focus: [0, GROUND + 30],
    labels: [
      { part: 'korzenie', at: [-34, GROUND + 44], side: -1, dy: 0.4, from: 0.2 },
      { part: 'liscie', at: [-18, -40], side: -1, from: 0.62 },
    ],
  },
  list: {
    world: 'dwoje', view: { x: -102, y: -84, w: 204, h: 168 }, focus: [0, -28],
    labels: [
      { part: 'pisze', at: [-40, -66], side: -1, dy: -0.6, from: 0.03 },
      { part: 'list', at: [0, -30], side: 1, dy: -1.2, from: 0.24 },
      { part: 'oczekiwane', at: [H2[0] + 11, H2[1] - 4], side: 1, dy: -0.8, from: 0.5 },
      { part: 'czyta', at: [68, 0], side: 1, dy: 0.6, from: 0.74 },
    ],
  },
  // ── 3. Dobroć ─────────────────────────────────────────────────
  dar: {
    world: 'dwoje', view: { x: -102, y: -84, w: 204, h: 168 }, focus: [0, -12],
    labels: [
      { part: 'daje', at: [-40, -66], side: -1, dy: -0.6, from: 0.03 },
      { part: 'dar', at: [0, -16], side: 1, dy: -1.2, from: 0.5 },
      { part: 'przyjmuje', at: [40, -66], side: 1, dy: -0.6, from: 0.8 },
    ],
  },
  powrot: {
    world: 'dwoje', view: { x: -102, y: -84, w: 204, h: 168 }, focus: H1,
    labels: [
      { part: 'wraca', at: [0, -58], side: 1, dy: -1, from: 0.32 },
      { part: 'wiez', at: [0, -24], side: 1, dy: 0.9, from: 0.74 },
    ],
  },
  // ── 4. Więzi ──────────────────────────────────────────────────
  bliscy: {
    world: 'siec', view: CLOSE, focus: [0, 0],
    labels: [
      { part: 'ty', at: [6, 2], side: 1, dy: 0.5, from: 0.02 },
      { part: 'bliscy', at: shift(near(1, -0.6), 5, 0), side: 1, from: 0.36 },
      { part: 'wiezi', at: [near(1, 2.6)[0] / 2, near(1, 2.6)[1] / 2], side: -1, dy: -0.6, from: 0.62 },
    ],
  },
  stopnie: {
    world: 'siec', view: WIDE, focus: near(2, -0.5),
    labels: [
      { part: 'st1', at: shift(near(1, 2.75), -5, 0), side: -1, from: 0 },
      { part: 'st2', at: shift(near(2, 0.15), 4, 0), side: 1, from: 0.3 },
      { part: 'st3', at: shift(near(3, -0.62), 4, 0), side: 1, from: 0.7 },
    ],
  },
  smiech: {
    world: 'siec', variant: '', view: CLOSE, focus: [0, -6],
    labels: [
      { part: 'fala', at: shift(near(1, -0.9), 5, -4), side: 1, dy: -0.4, from: 0.14 },
      { part: 'endorfiny', at: shift(near(1, 2.4), -5, -9), side: -1, dy: -0.4, from: 0.55 },
    ],
  },
  // ── 5. Spirala w górę ─────────────────────────────────────────
  szerzej: {
    world: 'spirala', view: { x: -114, y: -98, w: 228, h: 180 }, focus: [0, 0],
    labels: [
      { part: 'uwaga', at: [4, WHO[1] - 30], side: 1, dy: -0.2, from: 0.04 },
      { part: 'mozliwosci', at: [-66, -50], side: 1, dy: -0.4, from: 0.62 },
    ],
  },
  buduje: {
    world: 'spirala', variant: 'spiral', view: { x: -92, y: -96, w: 184, h: 184 }, focus: [0, 0],
    labels: BEAD_AT.map((p, i): LabelSpec => ({
      part: ['wiezi', 'umiejetnosci', 'odpornosc'][i], at: shift(p, side(p) * 7, 0), side: side(p), from: [0.32, 0.58, 0.82][i],
    })),
  },
  // ── 6. Pełnia ─────────────────────────────────────────────────
  cialo: {
    world: 'postac', variant: 'full', view: { x: -96, y: -110, w: 192, h: 218 }, focus: HEART,
    labels: [
      { part: 'piers', at: [24, -44], side: 1, from: 0.08 },
      { part: 'dlonie', at: shift(figPt(FIGURE, FIG.palmL), -6, 0), side: -1, from: 0.45 },
      { part: 'stopy', at: shift(figPt(FIGURE, FIG.footL), -8, -4), side: -1, from: 0.76 },
    ],
  },
  ogrod: {
    world: 'ogrod', variant: 'full', view: { x: -114, y: -102, w: 228, h: 166 }, focus: [0, -20],
    labels: FOUR.map((p, i): LabelSpec => ({
      part: ['uwaga', 'wdziecznosc', 'dobroc', 'bliskosc'][i], at: [p.x - 22, GROUND + 8], side: 1,
      dy: i % 2 ? 1.15 : 0, from: [0.12, 0.36, 0.6, 0.84][i],
    })),
  },
  plynie: {
    world: 'siec', view: WIDE, focus: [0, 0],
    labels: [
      { part: 'ty', at: [6, 2], side: 1, dy: 0.5, from: 0.02 },
      { part: 'dalej', at: shift(near(2, -0.3), 4, 0), side: 1, from: 0.34 },
      { part: 'pomnozone', at: shift(near(3, -2.3), 4, 0), side: 1, dy: -0.4, from: 0.86 },
    ],
  },
};

/** Where a dive opens: into the brow (where the band sits) for the brain, into the heart for the garden. */
function portal(shallow: string, deep: string): Pt | null {
  const sw = SCENES[shallow]?.world, dw = SCENES[deep]?.world;
  if (sw === 'postac') return dw === 'mozg' ? BROW : HEART;
  if (sw === 'dwoje') return H1;
  if (sw === 'siec') return [0, -6];
  if (sw === 'spirala') return dw === 'mozg' ? [WHO[0], WHO[1] - 12] : [0, 0];
  return null;
}

const CLOSERS: readonly PassageId[] = ['neh8.10', 'php4.4', 'zep3.17', 'gal5.22-23', 'psa126.2-3'];

export const LIBRARY: HealthLibrary = {
  id: 'radosc',
  meds: MEDS,
  scenes: SCENES,
  worlds: { postac: POSTAC_WORLD, mozg: MOZG_WORLD, ogrod: OGROD_WORLD, dwoje: DWOJE_WORLD, siec: SIEC_WORLD, spirala: SPIRALA_WORLD },
  portal,
  root: 'psa16.11',
  closers: CLOSERS,
  looks: [],
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#1c0e26', light: '#ffc9a0' },
};

void PFC;
