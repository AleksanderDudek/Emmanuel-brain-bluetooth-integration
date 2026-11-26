/**
 * Żywa skóra (DESIGN.md §24.3) as a library of the health visualisations' engine (kit/healthlib): six short guided
 * meditations about the skin — the epidermis renewed, the barrier, collagen and elastin, healing, melanin and light,
 * and last warmth and circulation, ending on a whole hand in light — eighteen scenes in seven worlds:
 *
 *   hand      the back of a resting hand in light, in the player's skin tone  (depth 0)
 *   section   the skin in section: epidermis, dermis with its two networks of vessels, fat  (depth 1)
 *   wound     the same skin with a small cut, healing in four phases  (depth 1)
 *   epi       the epidermis close up: the basal layer to the horny layer, melanocytes and their caps  (depth 2)
 *   dermis    a fibroblast in the weave of collagen, elastin and water  (depth 2)
 *   barrier   the horny layer as bricks and mortar, the acid mantle on top  (depth 3)
 *   nucleus   one cell's nucleus under its melanin cap, its DNA repaired  (depth 3)
 *
 * The truth told kindly (every number sourced in the design notes): the skin renews itself (about 39 days from the
 * base to the flake, not 28), holds its water, weaves and keeps its collagen, warms the body and heals a wound in
 * four phases.  "Young look" means only healthy, cared-for skin: nothing promises that wrinkles go or age turns back;
 * the player's skin tone, one of five, colours every picture.
 */
import type { HealthLibrary, LabelSpec, MedSpec, Pt, Rect, SceneSpec } from '../kit/healthlib/spec';
import { WORDS } from './i18n';
import { LOOKS } from './tone';
import { buildTune } from './tune';
import { BARRIER, BARRIER_VIEW, barPt } from './world-barrier';
import { DERMIS, DERMIS_VIEW, dermPt } from './world-dermis';
import { EPI, EPI_BASE_VIEW, EPI_VIEW, SCENE_FOCUS, epiPt } from './world-epi';
import { HAND, HAND_VIEW, handPt } from './world-hand';
import { NUCLEUS, NUCLEUS_VIEW, nucPt } from './world-nucleus';
import { SECTION, SECTION_VIEW, WOUND, WOUND_VIEW, secPt, woundPt } from './world-section';

export const MEDS: readonly MedSpec[] = [
  { id: 'odnowa', scenes: ['podzial', 'wedrowka', 'luszczenie'], verse: 'lam3.22-23' },
  { id: 'bariera', scenes: ['cegly', 'zaprawa', 'plaszcz'], verse: 'psa91.4' },
  { id: 'kolagen', scenes: ['fibroblast', 'elastyna', 'lata'], verse: 'psa139.13-14' },
  { id: 'gojenie', scenes: ['krzepniecie', 'zapalenie', 'odbudowa', 'przebudowa'], verse: 'psa147.3' },
  { id: 'melanina', scenes: ['melanocyty', 'parasole', 'naprawa'], verse: 'psa121.6' },
  // last: from the vessels out to a whole hand in light — the library's closing picture (and the lobby's hero)
  { id: 'krazenie', scenes: ['sploty', 'cieplo'], verse: 'psa36.9' },
];

const L = (part: string, at: Pt, side: -1 | 1, from: number, dy?: number): LabelSpec => ({ part, at, side, from, ...(dy ? { dy } : {}) });
const S = (world: string, view: Rect, focus: Pt, labels: LabelSpec[], variant?: string): SceneSpec => ({ world, view, focus, labels, ...(variant ? { variant } : {}) });

const SHED_VIEW: Rect = { x: -44, y: -15, w: 88, h: 56 };

export const SCENES: Readonly<Record<string, SceneSpec>> = {
  // ── 1. Odnowa naskórka ───────────────────────────────────────
  podzial: S('epi', EPI_VIEW, SCENE_FOCUS.podzial, [
    L('basal', epiPt.basal(-30), -1, 0.04, 0.4),
    L('membrane', epiPt.membrane(25), 1, 0.25, 0.9),
    L('spinous', epiPt.spinous(30), 1, 0.6, -0.4),
  ]),
  wedrowka: S('epi', EPI_VIEW, epiPt.basal(-15), [
    L('spinous', epiPt.spinous(-34), -1, 0.12),
    L('granular', epiPt.granular(30), 1, 0.38),
    L('corneum', epiPt.corneum(-30), -1, 0.62, -0.5),
  ]),
  luszczenie: S('epi', SHED_VIEW, SCENE_FOCUS.luszczenie, [
    L('corneum', epiPt.corneum(-30), -1, 0.04, 0.4),
    L('flake', [22, epiPt.surface(22)[1] - 4], 1, 0.3, -0.6),
    L('granular', epiPt.granular(28), 1, 0.6, 0.6),
  ]),
  // ── 2. Bariera ───────────────────────────────────────────────
  cegly: S('barrier', BARRIER_VIEW, [0, 9], [
    L('corneocyte', barPt.deepBrick, -1, 0.08),
    L('rivets', barPt.rivet, 1, 0.45, 0.6),
    L('corneum', barPt.brick, 1, 0.82, -0.8),
  ]),
  zaprawa: S('barrier', BARRIER_VIEW, [0, 10], [
    L('lamellar', barPt.lamellar, -1, 0.05, 0.4),
    L('lipids', barPt.joint, 1, 0.3),
    L('ceramides', [-28, barPt.joint[1] - 7], -1, 0.62),
  ], 'built'),
  plaszcz: S('barrier', BARRIER_VIEW, [0, -23], [
    L('nmf', barPt.water, -1, 0.12, 0.5),
    L('mantle', barPt.mantle, 1, 0.45, -1),
    L('flora', barPt.flora, -1, 0.75, -1),
  ], 'full'),
  // ── 3. Kolagen i elastyna ────────────────────────────────────
  fibroblast: S('dermis', DERMIS_VIEW, [25, -0.5], [
    L('fibroblast', dermPt.cell, -1, 0.04, -1.6),
    L('helix', dermPt.helix, 1, 0.2, -1),
    L('collagen', dermPt.bundle, -1, 0.55),
  ], 'spin'),
  elastyna: S('dermis', DERMIS_VIEW, [0, -8], [
    L('elastin', dermPt.fibre, -1, 0.12, -0.5),
    L('hyaluronan', dermPt.water, 1, 0.42),
    L('collagen', dermPt.bundleUp, 1, 0.75, -0.6),
  ], 'woven'),
  lata: S('dermis', DERMIS_VIEW, [0, 0], [
    L('oldcoll', dermPt.bundleUp, 1, 0.08, -0.6),
    L('newcoll', dermPt.bundle, -1, 0.35),
    L('fibroblast', dermPt.cell, -1, 0.7, -1.6),
  ], 'years'),
  // ── 4. Krążenie i ciepło ─────────────────────────────────────
  sploty: S('section', SECTION_VIEW, [0, 49], [
    L('deep', secPt.deep, -1, 0.08, 0.6),
    L('superficial', secPt.superficial, 1, 0.5, 0.6),
    L('loops', secPt.loop, 1, 0.74, -1.2),
    L('epidermis', secPt.epidermis, -1, 0.88, -0.6),
  ]),
  cieplo: S('hand', HAND_VIEW, [-60, 0], [
    L('warmth', handPt.back, -1, 0.3, 2.2),
  ]),
  // ── 5. Gojenie ───────────────────────────────────────────────
  krzepniecie: S('wound', WOUND_VIEW, [0, 12], [
    L('platelets', woundPt.edgeL, -1, 0.15),
    L('fibrin', woundPt.mid, 1, 0.42),
    L('clot', woundPt.top, 1, 0.8, -1.2),
  ]),
  zapalenie: S('wound', WOUND_VIEW, [0, 12], [
    L('neutrophils', [-6, 16], -1, 0.12),
    L('macrophages', [6, 22], 1, 0.5),
  ]),
  odbudowa: S('wound', WOUND_VIEW, [0, 26], [
    L('granulation', woundPt.deep, -1, 0.12),
    L('vessels', [2.6, 18], 1, 0.4),
    L('edge', woundPt.skinEdge, -1, 0.62, -1),
  ]),
  przebudowa: S('wound', WOUND_VIEW, [0, 14], [
    L('scar', [4, 10], 1, 0.08),
    L('collagen', [-5, 22], -1, 0.5),
  ]),
  // ── 6. Melanina i światło ────────────────────────────────────
  melanocyty: S('epi', EPI_BASE_VIEW, SCENE_FOCUS.melanocyty, [
    L('melanocyte', epiPt.melano(0), 1, 0.04, 1),
    L('dendrites', [epiPt.melano(0)[0] + 5, epiPt.melano(0)[1] - 15], 1, 0.35, -0.6),
    L('keratinocytes', epiPt.spinous(-26), -1, 0.62),
  ]),
  parasole: S('epi', EPI_BASE_VIEW, SCENE_FOCUS.parasole, [
    L('cap', [SCENE_FOCUS.parasole[0], SCENE_FOCUS.parasole[1] - 1.5], -1, 0.18, -0.8),
    L('nucleus', epiPt.spinous(23), 1, 0.55),
  ], 'sun'),
  naprawa: S('nucleus', NUCLEUS_VIEW, [-25, 8], [
    L('damage', nucPt.damage, 1, 0, 1.2),
    L('enzymes', nucPt.enzymes, 1, 0.12, -1.4),
    L('newstrand', nucPt.newstrand, -1, 0.3, -1.4),
    L('cap', nucPt.cap, 1, 0.6, -0.6),
  ]),
};

/** Where the camera dives from a shallower picture into a deeper one (world units of the shallower one). */
function portal(shallow: string, deep: string): Pt | null {
  const a = SCENES[shallow], b = SCENES[deep];
  if (!a || !b) return null;
  if (a.world === 'hand') return handPt.back;
  if (a.world === 'section') return b.world === 'dermis' ? secPt.dermis : secPt.surface;
  if (a.world === 'wound') return woundPt.side;
  if (a.world === 'epi') return b.world === 'barrier' ? epiPt.surface(0) : SCENE_FOCUS.parasole;
  if (a.world === 'dermis') return [0, 0];
  return null;
}

export const LIBRARY: HealthLibrary = {
  id: 'skora',
  meds: MEDS,
  scenes: SCENES,
  worlds: { hand: HAND, section: SECTION, wound: WOUND, epi: EPI, dermis: DERMIS, barrier: BARRIER, nucleus: NUCLEUS },
  portal,
  root: 'job10.11',
  closers: ['2co4.16', 'psa139.16', 'psa103.5', 'psa16.9', 'isa40.31'],
  looks: LOOKS,
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#24101f', light: '#ffc2a6' },
};
