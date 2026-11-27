/**
 * Nowe siły (`sily`, DESIGN.md §28): five short guided meditations on the body's own stem cells — where they really
 * work, and what their work gives — around a person who is tired at the start of every session and recovers,
 * parameter by parameter, as the session's focused growth gathers (renew.ts, figure.ts).  Rooted in Isaiah 40:31
 * ("those who wait upon the LORD will renew their strength"): new strength received, never a promise of healing.
 *
 *   1 Źródło w kościach   the marrow in the flat bones (the person) · the niche: a stem cell divides, one daughter stays ·
 *                         an erythroblastic island: red cells ripen and go into the blood          → colour and lips
 *   2 Nowa skóra          the face close (the person) · the epidermis renewed from its base (≈ 39 days) · the follicle's
 *                         bulge and a new hair                                                   → clear skin, hair
 *   3 Siła w mięśniach    the muscles that hold us (the person) · a satellite cell wakes after effort and fuses in
 *                                                                                                → posture
 *   4 Noc odnowy          night: deep sleep, the pituitary's pulse (the person) · the skin's cells dividing in the
 *                         night · morning (the person)                                           → bright eyes
 *   5 Cała postać         all the sources at once (the person) · the gut's lining renewed in 3–5 days, taking in iron
 *                         and B12 for the marrow · the person renewed                            → the quiet smile
 *
 * Every number on screen and its source: the design notes (§28, the "sily" table).  The pictures: figure.ts and the
 * worlds (world-*.ts); the engine (kit/healthlib) does the rest, its WorldState.arc carrying the session's recovery.
 */
import type { PassageId } from '../kit/scripture';
import type { HealthLibrary, MedSpec, Pt, Rect, SceneSpec } from '../kit/healthlib/spec';
import { HEAD_K } from './figure';
import { WORDS } from './i18n';
import { LOOKS } from './figure';
import { JELITO_VIEW, JELITO_WORLD } from './world-jelito';
import { FUSE_AT, MIESIEN_VIEW, MIESIEN_WORLD, SAT_AT } from './world-miesien';
import { FACE, MID, UPPER, WHOLE, makePostac, marrowSites } from './world-postac';
import { BULGE, MIESZEK_VIEW, MIESZEK_WORLD, NASKOREK_VIEW, NASKOREK_WORLD, PAPILLA, memY } from './world-skora';
import { ISLAND, NICHE, NISZA_VIEW, SZPIK_WORLD, WAY, WYSPA_VIEW, sinY, boneY } from './world-szpik';
import { buildTune } from './tune';

export const MEDS: readonly MedSpec[] = [
  { id: 'zrodlo', scenes: ['kosci', 'nisza', 'krwinki'], verse: 'isa40.29' },
  { id: 'skora', scenes: ['twarz', 'warstwa', 'mieszek'], verse: '2co4.16' },
  { id: 'sila', scenes: ['plecy', 'satelity'], verse: 'psa145.14' },
  { id: 'noc', scenes: ['sen', 'naprawa', 'poranek'], verse: 'psa30.5' },
  { id: 'cala', scenes: ['zrodla', 'jelito', 'pelnia'], verse: 'neh8.10' },
];

const MED_OF = new Map<string, string>(MEDS.flatMap(m => m.scenes.map(s => [s, m.id] as const)));
export const medOf = (scene: string): string | undefined => MED_OF.get(scene);

// ── places on the pictures ─────────────────────────────────────────
const g = MID;
/** a point of the head after its portrait scale */
const head = (x: number, y: number): Pt => [x * HEAD_K, g.cy + 13 + (y - (g.cy + 13)) * HEAD_K];
const SITES = marrowSites(g);
const STERNUM = SITES[0].at;
const HIP = SITES[1].at;
const CHEEK = head(-5, g.cy + 4);
const HAIRLINE = head(-5, g.cy - 11);
const SHOULDER: Pt = [-(g.sx - 3), g.sy + 4];
const BELLY: Pt = [0, g.sy + 36];
const HEART: Pt = [3.4, g.sy + 17];
/** the slow waves' trace beside the head */
const SLOW = ((): Pt => { const h = head(0, g.cy); return [h[0] + 24, h[1] - 6]; })();
/** the right eye's outer corner (the label points at the rested eyes) */
const EYE = head(5.6, g.cy + 0.3);
const HAND: Pt = [-(g.sx - 1.2 - 1.4), g.sy + 61];

export const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Źródło w kościach ──────────────────────────────────────
  kosci: {
    world: 'postac', view: { ...WHOLE }, focus: STERNUM,
    labels: [
      { part: 'mostek', at: [STERNUM[0] + 2, STERNUM[1]], side: 1, from: 0.04 },
      { part: 'biodro', at: [HIP[0] - 4, HIP[1]], side: -1, from: 0.18 },
      { part: 'krwinki', at: HAND, side: -1, dy: 0.6, from: 0.62 },
    ],
  },
  nisza: {
    world: 'szpik', view: { ...NISZA_VIEW }, focus: NICHE,
    labels: [
      { part: 'beleczka', at: [30, boneY(30) - 6], side: 1, from: 0 },
      { part: 'macierzysta', at: [NICHE[0] + 7, NICHE[1]], side: 1, dy: -0.4, from: 0.04 },
      { part: 'potomne', at: [WAY[3][0] + 5, WAY[3][1]], side: 1, from: 0.6 },
      { part: 'zatoka', at: [62, sinY(62)], side: 1, dy: 0.4, from: 0.8 },
    ],
  },
  krwinki: {
    world: 'szpik', variant: 'wyspa', view: { ...WYSPA_VIEW }, focus: ISLAND,
    labels: [
      { part: 'makrofag', at: [ISLAND[0] + 8, ISLAND[1] - 2], side: 1, dy: -1.6, from: 0.02 },
      { part: 'erytroblast', at: [ISLAND[0] - 20, ISLAND[1] - 4], side: -1, dy: -0.6, from: 0.1 },
      { part: 'krwinka', at: [70, sinY(70) - 4], side: 1, dy: 0.6, from: 0.5 },
    ],
  },
  // ── 2. Nowa skóra ─────────────────────────────────────────────
  twarz: {
    world: 'postac', view: { ...FACE }, focus: CHEEK,
    labels: [
      { part: 'nowekomorki', at: [CHEEK[0] - 3, CHEEK[1]], side: -1, from: 0.1 },
      { part: 'mieszki', at: [HAIRLINE[0] - 3, HAIRLINE[1]], side: -1, from: 0.55 },
    ],
  },
  warstwa: {
    world: 'naskorek', view: { ...NASKOREK_VIEW }, focus: [-6.2, memY(-6.2) - 4.6],
    labels: [
      { part: 'podstawna', at: [34, memY(34) - 4.6], side: 1, from: 0 },
      { part: 'kolczysta', at: [34, -6], side: 1, from: 0.3 },
      { part: 'rogowa', at: [34, -30], side: 1, from: 0.7 },
      { part: 'macierzysta', at: [-9, memY(-6.2) - 4.6], side: -1, from: 0.02 },
    ],
  },
  mieszek: {
    world: 'mieszek', view: { ...MIESZEK_VIEW }, focus: [BULGE[0] - 6, BULGE[1]],
    labels: [
      { part: 'zgrubienie', at: [BULGE[0] - 9, BULGE[1]], side: -1, dy: 0.6, from: 0.02 },
      { part: 'gruczol', at: [-20, -33], side: -1, dy: -0.4, from: 0.1 },
      { part: 'cebulka', at: [PAPILLA[0] + 6, PAPILLA[1] - 2], side: 1, from: 0.5 },
      { part: 'wlos', at: [-6, -60], side: 1, dy: -0.6, from: 0.82 },
    ],
  },
  // ── 3. Siła w mięśniach ───────────────────────────────────────
  plecy: {
    world: 'postac', view: { ...UPPER }, focus: SHOULDER,
    labels: [
      { part: 'czworoboczny', at: [-10, g.sy - 2], side: -1, dy: -0.6, from: 0.05 },
      { part: 'naramienny', at: [g.sx - 1, g.sy + 8], side: 1, from: 0.32 },
      { part: 'prostownik', at: [3.4, g.sy + 30], side: 1, from: 0.58 },
    ],
  },
  satelity: {
    world: 'miesien', view: { ...MIESIEN_VIEW }, focus: SAT_AT,
    labels: [
      { part: 'wlokno', at: [8, 10], side: 1, from: 0 },
      { part: 'satelita', at: [SAT_AT[0] - 3, SAT_AT[1] - 1], side: -1, dy: -0.8, from: 0.05 },
      { part: 'nowejadro', at: [FUSE_AT[0] + 2, FUSE_AT[1]], side: 1, dy: -0.4, from: 0.74 },
    ],
  },
  // ── 4. Noc odnowy ─────────────────────────────────────────────
  sen: {
    world: 'postac', variant: 'noc', view: { ...WHOLE }, focus: [0, g.sy + 2],
    labels: [
      { part: 'fale', at: [SLOW[0], SLOW[1]], side: 1, dy: -1.2, from: 0.12 },
      { part: 'hormon', at: [HEART[0] + 3, HEART[1]], side: 1, from: 0.4 },
    ],
  },
  naprawa: {
    world: 'naskorek', variant: 'noc', view: { ...NASKOREK_VIEW }, focus: [-38, memY(-38) - 5],
    labels: [
      { part: 'podzial', at: [-38, memY(-38) - 8], side: -1, dy: -0.6, from: 0.08 },
      { part: 'naczynie', at: [-3, 30], side: 1, dy: 0.4, from: 0.3 },
    ],
  },
  poranek: {
    world: 'postac', variant: 'rano', view: { ...WHOLE }, focus: [-(g.sx - 4), g.sy + 4],
    labels: [
      { part: 'swiatlo', at: [-40, -90], side: -1, from: 0.15 },
      { part: 'oczy', at: [EYE[0] + 4, EYE[1]], side: 1, from: 0.5 },
    ],
  },
  // ── 5. Cała postać ────────────────────────────────────────────
  zrodla: {
    world: 'postac', view: { ...WHOLE }, focus: STERNUM,
    labels: [
      { part: 'szpik', at: [STERNUM[0] + 2, STERNUM[1]], side: 1, from: 0.05 },
      { part: 'skora', at: [CHEEK[0] - 4, CHEEK[1]], side: -1, from: 0.25 },
      { part: 'miesnie', at: [SHOULDER[0] - 2, SHOULDER[1]], side: -1, dy: 0.6, from: 0.45 },
      { part: 'jelito', at: [BELLY[0] + 6, BELLY[1]], side: 1, from: 0.65 },
    ],
  },
  jelito: {
    world: 'jelito', view: { ...JELITO_VIEW }, focus: [-30, 60],
    labels: [
      { part: 'kosmek', at: [16, -36], side: 1, from: 0 },
      { part: 'krypta', at: [36, 46], side: 1, from: 0.02 },
      { part: 'macierzyste', at: [-34, 58], side: -1, dy: 0.4, from: 0.06 },
      { part: 'szczyt', at: [4, -74], side: 1, dy: -0.4, from: 0.5 },
      { part: 'zelazo', at: [-14, -10], side: -1, from: 0.62 },
    ],
  },
  pelnia: {
    world: 'postac', view: { ...WHOLE }, focus: HEART,
    labels: [],
  },
};

/** Where a dive opens in the person (kept inside the shallow scene's view): the bone, the cheek, the hairline… */
function portal(shallow: string, deep: string): Pt | null {
  const sc = SCENES[shallow], dw = SCENES[deep]?.world;
  if (!sc || sc.world !== 'postac') return null;
  const pt: Pt = dw === 'szpik' ? STERNUM : dw === 'naskorek' ? CHEEK : dw === 'mieszek' ? HAIRLINE : dw === 'miesien' ? SHOULDER : dw === 'jelito' ? BELLY : HEART;
  const v: Rect = sc.view;
  const m = 0.08;
  return [Math.max(v.x + v.w * m, Math.min(v.x + v.w * (1 - m), pt[0])), Math.max(v.y + v.h * m, Math.min(v.y + v.h * (1 - m), pt[1]))];
}

const CLOSERS: readonly PassageId[] = ['mat11.28', 'psa23.3', 'pro17.22', 'lam3.22-23', 'psa103.5'];

export const LIBRARY: HealthLibrary = {
  id: 'sily',
  meds: MEDS,
  scenes: SCENES,
  worlds: { postac: makePostac(medOf), szpik: SZPIK_WORLD, naskorek: NASKOREK_WORLD, mieszek: MIESZEK_WORLD, miesien: MIESIEN_WORLD, jelito: JELITO_WORLD },
  portal,
  root: 'isa40.31',
  closers: CLOSERS,
  looks: LOOKS,
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#1c0f24', light: '#ffd2a8' },
};
