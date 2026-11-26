/**
 * Sprężysty kręgosłup (DESIGN.md §24.5) as a library of the health visualisations' engine (kit/healthlib): six
 * short guided meditations about the spine — its axis, the disc, the water that returns at night, movement as the
 * disc's pump, the deep muscles, upright — eighteen scenes in five worlds:
 *
 *   spine    the spine whole in profile, inside a body with no features but its outline  (depth 0)
 *   core     the trunk in profile: the deep muscles round the lumbar spine as a living corset  (depth 0)
 *   segment  three lumbar vertebrae and two discs in section, under the lens  (depth 1)
 *   disc     one lumbar disc cut open: the nucleus, the lamellae, the end plates  (depth 2)
 *   matrix   the nucleus under the microscope: few cells, aggrecan, collagen, water  (depth 3)
 *
 * The truth told kindly (the sources in the design notes): the intervertebral disc is the body's largest structure
 * without blood vessels; its few cells renew it slowly; what feeds it every day is diffusion through the end plates
 * and the water that returns at night when we lie down.  Nothing here promises that a disc will regrow.
 */
import type { HealthLibrary, LabelSpec, MedSpec, Pt, Rect, SceneSpec } from '../kit/healthlib/spec';
import { CROWN, FIGURE_VIEW, SPINE_VIEW, besideSeg, segMid, seg } from './geo';
import { WORDS } from './i18n';
import { buildTune } from './tune';
import { CORE, CORE_VIEW, MULTI_VIEW, corePt } from './world-core';
import { DISC, DISC_VIEW, discPt } from './world-disc';
import { MATRIX, MATRIX_VIEW } from './world-matrix';
import { SEGMENT, SEG_DAY_VIEW, SEG_DIFF_VIEW, SEG_PLATE_VIEW, SEG_VIEW, segPt } from './world-segment';
import { SPINE, curveApex } from './world-spine';

export const MEDS: readonly MedSpec[] = [
  { id: 'os', scenes: ['kregi', 'dyski', 'krzywizny'], verse: 'psa139.13-14' },
  { id: 'dysk', scenes: ['jadro', 'pierscien', 'plytki'], verse: 'eph4.16' },
  { id: 'nocna', scenes: ['dzien', 'noc', 'poranek'], verse: 'psa4.8' },
  { id: 'ruch', scenes: ['pompa', 'dyfuzja', 'macierz'], verse: 'isa40.31' },
  { id: 'miesnie', scenes: ['wielodzielny', 'poprzeczny', 'oddech'], verse: 'psa18.32' },
  { id: 'prosto', scenes: ['napojone', 'gorset', 'wyprost'], verse: 'psa145.14' },
];

const L = (part: string, at: Pt, side: -1 | 1, from: number, dy?: number): LabelSpec => ({ part, at, side, from, ...(dy ? { dy } : {}) });
const S = (world: string, view: Rect, focus: Pt, labels: LabelSpec[], variant?: string): SceneSpec => ({ world, view, focus, labels, ...(variant ? { variant } : {}) });
const mid = (id: string): Pt => {
  const m = segMid(seg(id));
  return [m.x, m.y];
};

export const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Oś ────────────────────────────────────────────────────
  kregi: S('spine', SPINE_VIEW, mid('C1'), [
    L('cervical', besideSeg('C4', -4), -1, 0.08),
    L('thoracic', besideSeg('T6', 12), 1, 0.3),
    L('lumbar', besideSeg('L3', -6), -1, 0.62),
    L('sacrum', besideSeg('S3', 6), 1, 0.82),
    L('coccyx', besideSeg('Co2', -3), -1, 0.96),
  ]),
  dyski: S('spine', SPINE_VIEW, mid('C2–C3'), [
    L('discTop', besideSeg('C2–C3', -4), -1, 0.03),
    L('discs', besideSeg('T8–T9', -5), -1, 0.4),
    L('discLow', besideSeg('L5–S1', -6), -1, 0.97),
  ]),
  krzywizny: S('spine', SPINE_VIEW, curveApex(0), [
    L('lordC', curveApex(0), -1, 0.12),
    L('kyphT', curveApex(1), 1, 0.38),
    L('lordL', curveApex(2), -1, 0.62),
    L('kyphS', curveApex(3), 1, 0.86),
  ]),
  // ── 2. Dysk ──────────────────────────────────────────────────
  jadro: S('disc', DISC_VIEW, discPt('nucleus'), [
    L('nucleus', discPt('nucleus'), 1, 0.08, -1.4),
    L('aggrecan', discPt('aggrecan'), -1, 0.45),
  ]),
  pierscien: S('disc', DISC_VIEW, discPt('cut'), [
    L('annulus', discPt('annulus'), 1, 0.1),
    L('lamella', discPt('cut'), -1, 0.4, 0.8),
  ]),
  plytki: S('segment', SEG_PLATE_VIEW, segPt('plateLow'), [
    L('endplate', segPt('plateUp'), 1, 0.06),
    L('capillaries', segPt('capLow'), -1, 0.4, 0.8),
    L('body', segPt('bodyL5'), -1, 0.7),
    L('disc', segPt('discMid'), -1, 0.2),
  ]),
  // ── 3. Woda nocą ─────────────────────────────────────────────
  dzien: S('segment', SEG_DAY_VIEW, segPt('nucleus'), [
    L('load', segPt('load'), 1, 0.05),
    L('nucleus', segPt('nucleus'), 1, 0.3, 0.8),
    L('annulus', segPt('annulusFront'), 1, 0.55, 1.6),
  ], 'day'),
  noc: S('segment', SEG_DAY_VIEW, segPt('nucleus'), [
    L('water', segPt('waterIn'), -1, 0.1),
    L('nucleus', segPt('nucleus'), 1, 0.4, 0.8),
  ], 'night'),
  poranek: S('spine', FIGURE_VIEW, CROWN, [
    L('evening', [27, CROWN[1] + 4.8], 1, 0.05, 0.7),
    L('morning', [27, CROWN[1]], 1, 0.9, -0.8),
  ], 'free'),
  // ── 4. Pompa ruchu ───────────────────────────────────────────
  pompa: S('segment', SEG_VIEW, segPt('nucleus'), [
    L('flow', segPt('flow'), -1, 0.15),
    L('nucleus', segPt('nucleus'), 1, 0.45, 0.8),
  ], 'walk'),
  dyfuzja: S('segment', SEG_DIFF_VIEW, segPt('cellsDeep'), [
    L('capillaries', segPt('capLow'), -1, 0.05, 0.6),
    L('glucose', segPt('glucose'), 1, 0.2),
    L('oxygen', segPt('oxygen'), 1, 0.35),
    L('cells', segPt('cellsDeep'), -1, 0.55, -0.8),
    L('lactate', segPt('lactate'), 1, 0.75),
  ]),
  macierz: S('matrix', MATRIX_VIEW, [0, 0], [
    L('cell', [0, 0], 1, 0.06, -1.2),
    L('aggrecan', [-62, 30], -1, 0.35),
    L('collagen', [70, -44], 1, 0.6),
    L('water', [-80, -50], -1, 0.8),
  ]),
  // ── 5. Mięśnie głębokie ──────────────────────────────────────
  wielodzielny: S('core', MULTI_VIEW, corePt('multiTop'), [
    L('multifidus', corePt('multi'), 1, 0.1),
    L('spinous', corePt('spinous'), 1, 0.45, -1.2),
    L('sacrum', corePt('sacrum'), -1, 0.75),
  ]),
  poprzeczny: S('core', CORE_VIEW, corePt('tra'), [
    L('tra', corePt('tra'), -1, 0.1),
  ]),
  oddech: S('core', CORE_VIEW, corePt('pressure'), [
    L('diaphragm', corePt('diaphragm'), -1, 0.08),
    L('pelvicfloor', corePt('pelvicfloor'), -1, 0.3),
    L('pressure', corePt('pressure'), 1, 0.6),
  ]),
  // ── 6. Prosto ────────────────────────────────────────────────
  napojone: S('spine', SPINE_VIEW, mid('L4–L5'), [
    L('discs', besideSeg('T10–T11', -6), -1, 0.3),
  ]),
  gorset: S('core', CORE_VIEW, corePt('pressure'), [
    L('diaphragm', corePt('diaphragm'), -1, 0.1),
    L('tra', corePt('tra'), -1, 0.3),
    L('pelvicfloor', corePt('pelvicfloor'), -1, 0.5),
    L('multifidus', corePt('multi'), 1, 0.7),
  ]),
  wyprost: S('spine', FIGURE_VIEW, CROWN, [
    L('crown', CROWN, 1, 0.15, -0.6),
    L('shoulders', [12, -68], 1, 0.5),
  ], 'free'),
};

/** Where the camera dives from a shallower picture into a deeper one (world units of the shallower one). */
function portal(shallow: string, deep: string): Pt | null {
  const a = SCENES[shallow], b = SCENES[deep];
  if (!a || !b) return null;
  if (a.world === 'spine') return mid('L4–L5');
  if (a.world === 'core') return corePt('l45');
  if (a.world === 'segment') return b.world === 'matrix' ? segPt('nucleus') : segPt('discMid');
  if (a.world === 'disc') return discPt('nucleus');
  return null;
}

export const LIBRARY: HealthLibrary = {
  id: 'kregoslup',
  meds: MEDS,
  scenes: SCENES,
  worlds: { spine: SPINE, core: CORE, segment: SEGMENT, disc: DISC, matrix: MATRIX },
  portal,
  root: 'psa145.14',
  closers: ['psa34.20', 'isa46.4', 'psa16.9', 'psa3.3', 'isa40.29'],
  looks: [],
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#0b1a22', light: '#a8e8e0' },
};
