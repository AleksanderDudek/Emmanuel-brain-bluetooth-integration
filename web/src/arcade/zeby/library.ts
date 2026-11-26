/**
 * Mocne zęby (DESIGN.md §24.4) as a library of the health visualisations' engine (kit/healthlib): six short guided
 * meditations about the teeth — saliva, the curve after a meal, the enamel's crystals, living dentine, the root and
 * the gum, the whole smile — seventeen scenes in seven worlds:
 *
 *   face     the face in profile with the salivary glands and the teeth through the cheek  (depth 0)
 *   arch     the upper teeth from below, sixteen in mirror pairs  (depth 0)
 *   tooth    a molar cut through in its socket: enamel, dentine, pulp, cementum, ligament, bone, gum  (depth 1)
 *   surface  the enamel's surface under the saliva: pellicle, plaque, ions, the pH line  (depth 2)
 *   dentine  living dentine at the pulp's edge: tubules, odontoblasts, stem cells  (depth 2)
 *   rods     the enamel rods cut across, ≈ 5 µm each  (depth 3)
 *   lattice  the crystals inside a rod, ≈ 68 × 26 nm  (depth 4)
 *
 * The truth told kindly (sources in the design notes): enamel does not grow back — its cells are gone once the tooth
 * erupts — but it remineralises every day from the saliva, and fluoride helps; dentine is alive and laid down
 * through life; the ligament and the gum's attachment renew themselves fast.  Nothing promises that a cavity closes.
 */
import type { HealthLibrary, LabelSpec, MedSpec, Pt, Rect, SceneSpec } from '../kit/healthlib/spec';
import { GUM_VIEW, ROOT_VIEW, TOOTH_VIEW } from './geo';
import { WORDS } from './i18n';
import { buildTune } from './tune';
import { ARCH, ARCH_VIEW, archPt } from './world-arch';
import { LATTICE, LATTICE_VIEW, RODS_VIEW, RODS_WORLD, crystalPt } from './world-crystal';
import { DENTINE, DENT_VIEW, dentPt } from './world-dentine';
import { FACE, FACE_VIEW, MOUTH_VIEW, facePt } from './world-face';
import { GUARD_AT, SURFACE, SURF_VIEW, surfPt } from './world-surface';
import { TOOTH_WORLD, toothPt } from './world-tooth';

export const MEDS: readonly MedSpec[] = [
  { id: 'slina', scenes: ['zrodla', 'plukanie', 'blonka'], verse: 'isa58.11' },
  { id: 'posilek', scenes: ['kwas', 'powrot', 'dzien'], verse: 'psa30.5' },
  { id: 'szkliwo', scenes: ['pryzmaty', 'wapn', 'fluor'], verse: 'isa54.11-12' },
  { id: 'zebina', scenes: ['kanaliki', 'wtorna', 'naprawcza'], verse: 'isa46.4' },
  { id: 'korzen', scenes: ['miazga', 'wiezadlo', 'dziaslo'], verse: 'eph4.16' },
  { id: 'usmiech', scenes: ['kapiel', 'pary', 'caly'], verse: 'sng4.2' },
];

const L = (part: string, at: Pt, side: -1 | 1, from: number, dy?: number): LabelSpec => ({ part, at, side, from, ...(dy ? { dy } : {}) });
const S = (world: string, view: Rect, focus: Pt, labels: LabelSpec[], variant?: string): SceneSpec => ({ world, view, focus, labels, ...(variant ? { variant } : {}) });

export const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Ślina ─────────────────────────────────────────────────
  zrodla: S('face', FACE_VIEW, [5, 14], [
    L('parotid', facePt.parotid, 1, 0.06, -0.6),
    L('submandibular', facePt.submandibular, 1, 0.34, 0.6),
    L('sublingual', facePt.sublingual, -1, 0.6, 0.8),
    L('minor', facePt.minor, -1, 0.82, -1),
  ]),
  plukanie: S('surface', SURF_VIEW, [-50, 8], [
    L('saliva', surfPt.saliva, 1, 0.05),
    L('bicarbonate', surfPt.bicarb, 1, 0.35),
    L('enamel', surfPt.enamel, 1, 0.7),
  ], 'wash'),
  blonka: S('surface', SURF_VIEW, [-60, 17], [
    L('pellicle', surfPt.pellicle, 1, 0.2, 1.2),
    L('iga', GUARD_AT[0], 1, 0.4),
    L('lysozyme', GUARD_AT[1], 1, 0.6),
    L('lactoferrin', GUARD_AT[2], 1, 0.8),
  ], 'pellicle'),
  // ── 2. Po posiłku ────────────────────────────────────────────
  kwas: S('surface', SURF_VIEW, [-54, -32], [
    L('critical', surfPt.critical, -1, 0.2, -0.8),
    L('plaque', surfPt.plaque, 1, 0.45, 0.6),
  ], 'curve'),
  powrot: S('surface', SURF_VIEW, [-18, -9], [
    L('critical', surfPt.critical, -1, 0, -0.8),
    L('calcium', surfPt.calcium, 1, 0.45),
  ], 'curve'),
  dzien: S('surface', SURF_VIEW, [-56, -32], [
    L('meal', surfPt.meal, 1, 0.08, 0.8),
    L('repair', surfPt.repair, 1, 0.55, -0.8),
  ], 'day'),
  // ── 3. Kryształy szkliwa ─────────────────────────────────────
  pryzmaty: S('rods', RODS_VIEW, [0, 0], [
    L('rod', crystalPt.rod, 1, 0.08, -1.2),
    L('interrod', crystalPt.interrod, 1, 0.5, 1),
  ]),
  wapn: S('lattice', LATTICE_VIEW, [-150, 0], [
    L('crystal', crystalPt.crystal, 1, 0.05, -1),
    L('calcium', crystalPt.nick, -1, 0.35, 1),
  ], 'nicked'),
  fluor: S('lattice', LATTICE_VIEW, [-150, 0], [
    L('fluoride', crystalPt.free, -1, 0.15, -0.6),
    L('fapatite', crystalPt.crystal, 1, 0.5, 1),
  ], 'fluor'),
  // ── 4. Żywa zębina ───────────────────────────────────────────
  kanaliki: S('dentine', DENT_VIEW, [0, 9], [
    L('odontoblasts', dentPt.odontoblasts, -1, 0.05),
    L('tubules', dentPt.tubules, 1, 0.3, -0.6),
    L('pulp', dentPt.pulp, -1, 0.55),
  ]),
  wtorna: S('dentine', DENT_VIEW, [0, 4], [
    L('secondary', dentPt.secondary, -1, 0.2, -0.8),
    L('odontoblasts', dentPt.odontoblasts, -1, 0.5, 0.8),
  ], 'move'),
  naprawcza: S('dentine', DENT_VIEW, [2, 4], [
    L('stimulus', dentPt.stimulus, 1, 0.05),
    L('tertiary', dentPt.tertiary, 1, 0.45, 0.8),
    L('stem', dentPt.stem, -1, 0.65, 0.6),
  ], 'stim'),
  // ── 5. Korzeń i dziąsła ──────────────────────────────────────
  miazga: S('tooth', TOOTH_VIEW, toothPt.apex, [
    L('foramen', toothPt.apex, 1, 0.04, 0.6),
    L('vessels', toothPt.canal, 1, 0.35),
    L('pulp', toothPt.pulp, 1, 0.7, -1.2),
  ]),
  wiezadlo: S('tooth', ROOT_VIEW, toothPt.pdl, [
    L('pdl', toothPt.pdl, -1, 0.06, -1),
    L('cementum', toothPt.cementum, 1, 0.35, -0.8),
    L('bone', toothPt.bone, 1, 0.65, 1.2),
  ]),
  dziaslo: S('tooth', GUM_VIEW, toothPt.je, [
    L('je', toothPt.je, -1, 0.06, 0.8),
    L('sulcus', toothPt.sulcus, -1, 0.35, -1),
    L('gum', toothPt.gum, -1, 0.65, 1),
  ]),
  // ── 6. Cały uśmiech ──────────────────────────────────────────
  kapiel: S('face', MOUTH_VIEW, [-44, 21.6], [
    L('saliva', facePt.saliva, -1, 0.1, 1.6),
  ]),
  pary: S('arch', ARCH_VIEW, [0, -10], [
    L('incisors', archPt.incisors, -1, 0.06, -0.8),
    L('canines', archPt.canines, 1, 0.3),
    L('premolars', archPt.premolars, -1, 0.42),
    L('molars', archPt.molars, 1, 0.68),
  ]),
  caly: S('tooth', TOOTH_VIEW, [-2.6, -8.6], [
    L('enamel', toothPt.enamel, -1, 0.05, -0.6),
    L('dentine', toothPt.dentine, 1, 0.22),
    L('pulp', toothPt.pulp, 1, 0.4, 1),
    L('pdl', [-4.98, 6], -1, 0.62),
    L('gum', toothPt.gum, -1, 0.82, 0.8),
  ]),
};

/** Where the camera dives from a shallower picture into a deeper one (world units of the shallower one). */
function portal(shallow: string, deep: string): Pt | null {
  const a = SCENES[shallow], b = SCENES[deep];
  if (!a || !b) return null;
  if (a.world === 'face') return b.world === 'tooth' ? facePt.molar : facePt.teeth;
  if (a.world === 'arch') return archPt.molar1;
  if (a.world === 'tooth') return b.world === 'dentine' ? [-2.6, -5.4] : toothPt.enamel;
  if (a.world === 'surface') return [0, 30];
  if (a.world === 'dentine') return [0, -20];
  if (a.world === 'rods') return [0, 0];
  return null;
}

export const LIBRARY: HealthLibrary = {
  id: 'zeby',
  meds: MEDS,
  scenes: SCENES,
  worlds: { face: FACE, arch: ARCH, tooth: TOOTH_WORLD, surface: SURFACE, dentine: DENTINE, rods: RODS_WORLD, lattice: LATTICE },
  portal,
  root: 'sng4.2',
  closers: ['psa103.5', 'psa139.13-14', 'neh8.10', 'lam3.22-23', 'isa58.11'],
  looks: [],
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#0d1622', light: '#d8f4ff' },
};
