/**
 * Czujna straż's library (DESIGN.md §24): six short guided meditations on immune surveillance — the watch the body
 * keeps over its own cells (Burnet and Thomas's idea; immunoediting, Schreiber, Old & Smyth): NK cells on patrol,
 * the dendritic cell that carries the news to a lymph node, the T cell that leaves the blood, reads the cells' signs
 * and forms a synapse with the one that has changed, the brake PD-1 and the medicine that lifts it, the memory that
 * stays — and the whole watch in one.  Every scene one picture in one of four worlds (the body, a tissue, a lymph
 * node, the synapse close up), grown only by real focus, deepened by calm.
 *
 * Rooted in Psalm 121:4 — the watch that never sleeps belongs to God; the cells are His gift.  A meditation, never a
 * promise: nothing here says that focus or imagination changes an illness (the opening card and the lobby say so).
 */
import { fmtNum, format, lang, pick, type Msg } from '../../i18n';
import type { HealthLibrary, LabelSpec, Rect, SceneSpec } from '../kit/healthlib/spec';
import { CATALOGS, WORDS, t } from './i18n';
import {
  BODY_NODE, BODY_TISSUE, BODY_VIEW, CHANGED, CLONES, DC_AT, FOLLICLES, JUNCTION_X, MEET, NK_PATH, T_PATH, along, capY,
  nodeOutline, touched, type Pt,
} from './geo';
import { NK_DOCK_AT, T_DOCK_AT, checkedCount, tissueWorld } from './world-tissue';
import { cloneGen, memoryLeft, nodeWorld } from './world-node';
import { SYN_VIEW, synapseWorld } from './world-synapse';
import { bodyWorld } from './world-body';
import { SYN } from './geo';
import { buildTune } from './tune';

// ── the counts on a picture's corner ────────────────────────────
const cellsText = (n: number): string => format(pick(CATALOGS[lang].unit as Msg, n), { n: fmtNum(n) });
const pctText = (v: number): string => (lang === 'de' || lang === 'sv' ? `${fmtNum(v)} %` : `${fmtNum(v)}%`);

function counter(scene: string, g: number): string | null {
  const checked = checkedCount(scene, g);
  if (checked !== null) return checked > 0 ? t('count.checked', { n: checked }) : null;
  if (scene === 'klony') {
    const { k, n } = cloneGen(g);
    return k > 0 ? t('count.gen', { k, cells: cellsText(n) }) : null;
  }
  if (scene === 'dopasowanie') return g > 0.45 ? t('count.fit') : null;
  if (scene === 'pamiec') return g > 0.05 ? t('count.left', { pct: pctText(Math.round(memoryLeft(g) * 100)) }) : null;
  if (scene === 'rezydenci') return g > 0.3 ? t('count.skin') : null;
  return null;
}

// ── the views ────────────────────────────────────────────────────
const V = {
  tissue: { x: -134, y: -64, w: 184, h: 122 },
  sign: { x: -20, y: -16, w: 84, h: 54 },
  clear: { x: -32, y: -26, w: 88, h: 94 },
  sample: { x: -90, y: -6, w: 138, h: 90 },
  cross: { x: -118, y: -74, w: 104, h: 68 },
  scan: { x: -84, y: -60, w: 156, h: 96 },
  node: { x: -130, y: -78, w: 240, h: 156 },
  meet: { x: MEET[0] - 36, y: MEET[1] - 24, w: 72, h: 48 },
  clones: { x: CLONES[0] - 46, y: CLONES[1] - 31, w: 92, h: 62 },
  syn: SYN_VIEW,
  brake: { x: -42, y: -31, w: 84, h: 62 },
  body: BODY_VIEW,
} as const satisfies Record<string, Rect>;

const NK_T = touched(NK_PATH);
const T_T = touched(T_PATH, 18);
const rim = (c: { x: number; y: number; r: number }): Pt => [c.x, c.y - c.r];
const NODE = nodeOutline(96);
const at = (k: number): Pt => NODE[Math.round(k * NODE.length) % NODE.length];
const contact = (dock: Pt, r: number): Pt => {
  const k = CHANGED.r / (CHANGED.r + r);
  return [CHANGED.at[0] + (dock[0] - CHANGED.at[0]) * k, CHANGED.at[1] + (dock[1] - CHANGED.at[1]) * k];
};
const NK_CONTACT = contact(NK_DOCK_AT, 5.5);
const T_CONTACT = contact(T_DOCK_AT, 5);
const L = (part: string, a: Pt, side: -1 | 1, from: number, dy?: number): LabelSpec => ({ part, at: a, side, from, ...(dy ? { dy } : {}) });

const SELF_CELL = NK_T.reduce((b, c) => (Math.abs(c.k - 0.38) < Math.abs(b.k - 0.38) ? c : b), NK_T[0]);
const TCELL_L = L('tcell', [SYN.t.at[0] - 12, SYN.t.at[1] + 22], -1, 0.02, 0.8);
const TARGET_L = L('target', [SYN.k.at[0] - 2, SYN.k.at[1] - SYN.k.r + 1], -1, 0.02, -0.8);
const S = (world: string, view: Rect, focus: Pt, labels: LabelSpec[], variant?: string): SceneSpec => ({ world, view, focus, labels, ...(variant ? { variant } : {}) });

const SCENES: Record<string, SceneSpec> = {
  // ── 1. Patrol ──────────────────────────────────────────────────
  patrol: S('tissue', V.tissue, along(NK_PATH, 0.5), [
    L('capillary', [-118, capY(-118) - 9], 1, 0.02, -0.9),
    L('self', rim(SELF_CELL.cell), 1, SELF_CELL.k + 0.04, -1),
    L('nk', NK_PATH[NK_PATH.length - 1], -1, 0.86, 1.3),
  ]),
  znak: S('tissue', V.sign, NK_CONTACT, [
    L('changed', [CHANGED.at[0] + 7, CHANGED.at[1] - CHANGED.r + 1], 1, 0.04, -0.8),
    L('stress', [CHANGED.at[0] + CHANGED.r + 2.4, CHANGED.at[1] + 6], 1, 0.35, 1),
    L('nk', [NK_DOCK_AT[0] - 4, NK_DOCK_AT[1] - 5], -1, 0.14, -0.6),
    L('perforin', NK_CONTACT, -1, 0.78, 1.8),
  ]),
  porzadek: S('tissue', V.clear, CHANGED.at, [
    L('apoptosis', [CHANGED.at[0] + CHANGED.r, CHANGED.at[1] - 5], 1, 0.12),
    L('eatme', [CHANGED.at[0] - 9, CHANGED.at[1] - 7], -1, 0.46, -0.6),
    L('macrophage', [CHANGED.at[0] - 14, CHANGED.at[1] + 20], -1, 0.66, 0.8),
  ]),
  // ── 2. Rozpoznanie ─────────────────────────────────────────────
  probka: S('tissue', V.sample, [(DC_AT[0] + CHANGED.at[0]) / 2, (DC_AT[1] + CHANGED.at[1]) / 2], [
    L('dc', [DC_AT[0] - 4, DC_AT[1] + 4], -1, 0.04, 1),
    L('changed', [CHANGED.at[0] - 2, CHANGED.at[1] - CHANGED.r], -1, 0.02, -0.8),
    L('pieces', [(DC_AT[0] + CHANGED.at[0]) / 2, (DC_AT[1] + CHANGED.at[1]) / 2 + 1], 1, 0.3, 1.4),
    L('lymphvessel', [-84, 63], -1, 0.74, -1),
  ]),
  droga: S('node', V.node, MEET, [
    L('afferent', [-118, 2.6], 1, 0.03, -1.3),
    L('sinus', at(0.36), 1, 0.3, -1.2),
    L('follicle', FOLLICLES[3].at, 1, 0.5, -1.2),
    L('tzone', MEET, 1, 0.86, 1.2),
  ]),
  dopasowanie: S('node', V.meet, [MEET[0] + 3.6, MEET[1] + 1.7], [
    L('dc', [MEET[0] - 2, MEET[1] - 4], -1, 0.03, -1.4),
    L('signal1', [MEET[0] + 4.6, MEET[1] + 1.2], 1, 0.44, -1.3),
    L('signal2', [MEET[0] + 3.4, MEET[1] + 3.4], 1, 0.64, 1.4),
  ]),
  klony: S('node', V.clones, CLONES, [L('clones', [CLONES[0] + 10, CLONES[1] - 10], 1, 0.28, -1)]),
  // ── 3. Precyzja ────────────────────────────────────────────────
  wyjscie: S('tissue', V.cross, [JUNCTION_X, capY(JUNCTION_X) + 9], [
    L('wall', [-110, capY(-110) - 9], 1, 0.02, -1.2),
    L('selectins', [-90, capY(-90) + 9], 1, 0.12, 2),
    L('integrins', [JUNCTION_X, capY(JUNCTION_X) + 9], 1, 0.44, -1.6),
    L('tcell', [JUNCTION_X, capY(JUNCTION_X) + 17.5], 1, 0.9, 1.2),
  ]),
  skan: S('tissue', V.scan, along(T_PATH, 0.5), [
    L('tcell', T_PATH[0], -1, 0.03, -0.8),
    L('mhc', rim(T_T[Math.min(2, T_T.length - 1)].cell), 1, T_T[Math.min(2, T_T.length - 1)].k + 0.04, -1),
    L('neoantigen', [CHANGED.at[0] + 8, CHANGED.at[1] - CHANGED.r - 2], 1, 0.86, -1),
  ]),
  synapsa: S('synapse', V.syn, [(SYN.t.face + SYN.k.face) / 2 - 1, 0], [
    TCELL_L,
    TARGET_L,
    L('ring', [(SYN.t.face + SYN.k.face) / 2, -(SYN.half - 2.6)], 1, 0.2, -1.6),
    L('perforin', [SYN.k.face + 0.4, 4.8], 1, 0.62, 1.2),
    L('apoptosis', [SYN.k.at[0] + 20, SYN.k.at[1] + 20], 1, 0.82),
  ]),
  // ── 4. Hamulec i lek ───────────────────────────────────────────
  hamulec: S('synapse', V.brake, [(SYN.t.face + SYN.k.face) / 2 - 1, 0], [
    TCELL_L,
    TARGET_L,
    L('pd1', [SYN.t.face - 0.2, -9.4], -1, 0.16, -1.4),
    L('pdl1', [SYN.k.face + 0.6, 9.4], 1, 0.3, 1.4),
  ]),
  lek: S('synapse', V.brake, [(SYN.t.face + SYN.k.face) / 2 - 1, 0], [
    L('antibody', [SYN.t.face - 4, -12], -1, 0.3, -1.6),
    L('pd1', [SYN.t.face - 0.2, 9.4], -1, 0.5, 1.4),
    L('granules', [SYN.t.face - 5, 2], -1, 0.82),
  ]),
  // ── 5. Pamięć ──────────────────────────────────────────────────
  pamiec: S('node', V.clones, CLONES, [L('memory', [CLONES[0] - 8, CLONES[1] - 12], -1, 0.6, -1)]),
  rezydenci: S('body', V.body, [0, -20], [L('skin', [-37, -20], -1, 0.22)]),
  // ── 6. Cała straż ──────────────────────────────────────────────
  cala_patrol: S('tissue', V.tissue, along(NK_PATH, 0.5), [
    L('nk', NK_PATH[NK_PATH.length - 1], -1, 0.34, 1.3),
    L('macrophage', [CHANGED.at[0] - 14, CHANGED.at[1] + 20], -1, 0.92, 0.8),
  ]),
  cala_wezel: S('node', V.node, MEET, [
    L('tzone', MEET, 1, 0.42, 1.2),
    L('clones', [CLONES[0] + 6, CLONES[1] - 8], 1, 0.7, -1.2),
  ]),
  cala_trafienie: S('synapse', V.syn, [(SYN.t.face + SYN.k.face) / 2 - 1, 0], [
    L('tcr', [(SYN.t.face + SYN.k.face) / 2, 0], -1, 0.1, -1.2),
    L('granules', [SYN.t.face - 4, 4], -1, 0.42, 1.4),
    L('apoptosis', [SYN.k.at[0] + 20, SYN.k.at[1] + 20], 1, 0.84),
  ]),
  cala_cialo: S('body', V.body, [0, -20], [
    L('vessels', [-13, 46], -1, 0.12),
    L('nodes', [-22, -55], -1, 0.7, -0.8),
    L('thymus', [0, -57], 1, 0.55, -1.4),
    L('spleen', [15, -27], 1, 0.62, 0.6),
  ]),
};

const tissue = tissueWorld(counter);
const node = nodeWorld(counter);
const synapse = synapseWorld();
const body = bodyWorld(counter);

export const LIBRARY: HealthLibrary = {
  id: 'straz',
  meds: [
    { id: 'patrol', scenes: ['patrol', 'znak', 'porzadek'], verse: 'psa121.4' },
    { id: 'rozpoznanie', scenes: ['probka', 'droga', 'dopasowanie', 'klony'], verse: 'pro2.6' },
    { id: 'precyzja', scenes: ['wyjscie', 'skan', 'synapsa'], verse: 'psa121.7-8' },
    { id: 'hamulce', scenes: ['hamulec', 'lek'], verse: 'isa41.10' },
    { id: 'pamiec', scenes: ['pamiec', 'rezydenci'], verse: 'psa103.2' },
    { id: 'cala', scenes: ['cala_patrol', 'cala_wezel', 'cala_trafienie', 'cala_cialo'], verse: 'psa127.1' },
  ],
  scenes: SCENES,
  worlds: { tissue, node, synapse, body },
  portal(shallow, deep) {
    const from = SCENES[shallow]?.world, to = SCENES[deep]?.world;
    if (!from || !to) return null;
    const depth = (w: string) => ({ body: 0, tissue: 1, node: 1, synapse: 2 } as Record<string, number>)[w] ?? 0;
    if (depth(to) <= depth(from)) return null;
    if (from === 'body') return to === 'node' ? BODY_NODE : BODY_TISSUE;
    if (from === 'tissue') return T_CONTACT;
    if (from === 'node') return MEET;
    return null;
  },
  root: 'psa121.4',
  closers: ['psa127.1', 'psa91.4', 'isa41.10', 'psa139.14', 'lam3.22-23', 'psa121.7-8'],
  looks: [],
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#0c1026', light: '#8fd3ff' },
};

export { NK_CONTACT };
