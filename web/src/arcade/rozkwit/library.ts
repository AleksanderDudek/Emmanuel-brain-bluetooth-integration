/**
 * Rozkwit (`rozkwit`, DESIGN.md §24): the capstone of the health visualisations — the whole person, all at once.
 * The founder asked for one beautiful visualisation of the whole body made beautiful together: cells repaired,
 * posture straightened, renewal, better hair, a beautiful figure, a healthy look — and great happiness.  Rozkwit
 * walks it as six short meditations framed in the other games' own pictures (the same body, seen whole), and ends in
 * one picture of its own where everything shines at once.  Rooted in Psalm 139:13–14 ("I am fearfully and wonderfully
 * made"): beauty as health and as the work God made, offered in thanks — never a comparison, never a promise of youth.
 *
 *   1 Komórki          energy (ATP synthase turning) · one letter of DNA mended · the watch on patrol      (komorki, straz)
 *   2 Postawa          the discs drink at night · the living corset · upright, lightly                    (kregoslup)
 *   3 Sylwetka         fat leaves with the breath · muscle builds in rest · the figure, light and strong   (ksztalt)
 *   4 Skóra i włosy    the epidermis renewed · collagen woven · the hair's colour from the root · the head held high
 *                                                                                    (skora; wlosy through the adapter)
 *   5 Radość           one good thing noticed · three good things, a garden · joy passed on               (radosc)
 *   6 Cały człowiek    the whole body lit part by part · in bloom: everything at once, joy from the heart (its own)
 *
 * Every number on screen and its source: the design notes (§24, the "rozkwit" table) — most are the source games'
 * own, re-checked.  The player chooses the figure (`ona` / `on`, Lekkość i siła's silhouettes); the pictures without a
 * figure ignore it.
 */
import type { PassageId } from '../kit/scripture';
import type { HealthLibrary, LabelSpec, MedSpec, Pt, SceneSpec, WorldPainter } from '../kit/healthlib/spec';
import { translatorFor } from '../kit/healthlib/lib';
import { lang } from '../../i18n';
import { SCENE as HAIR_SCENE, type SceneId as HairScene } from '../wlosy/content';
import { CROWN as HAIR_CROWN } from '../wlosy/geo';
import { borrowedScene, borrowedWorld, worldKey } from './borrow';
import { BORROWS, HAIR, LOOK_FOR, hairPart } from './sources';
import { CROWN_LIFTED, follicleWorld, headWorld } from './world-hair';
import { ARM, BLOOM_VIEW, BLOOMS, BODY_VIEW, CHEST, FEET_Y, HAIR_AT, HEART, LUMBAR, LUNG, PEOPLE, SCALP, SKIN_AT, THIGH, WHOLE_WORLD } from './world-whole';
import { WORDS } from './i18n';
import { buildTune } from './tune';

export const MEDS: readonly MedSpec[] = [
  { id: 'komorki', scenes: ['energia', 'naprawa', 'straz'], verse: 'lam3.22-23' },
  { id: 'postawa', scenes: ['dyski', 'gorset', 'wyprost'], verse: 'psa145.14' },
  { id: 'sylwetka', scenes: ['wydech', 'miesien', 'postac'], verse: '1co6.19-20' },
  { id: 'skora', scenes: ['naskorek', 'kolagen', 'wlos', 'glowa'], verse: 'job10.11' },
  { id: 'radosc', scenes: ['ziarno', 'wdziecznosc', 'plynie'], verse: 'psa16.11' },
  { id: 'cale', scenes: ['cialo', 'rozkwit'], verse: 'isa58.11' },
];

const HAIR_WORLD = { follicle: 'wlosy.follicle', head: 'wlosy.head' } as const;
function hairScene(theirs: HairScene, extra: readonly LabelSpec[] = []): SceneSpec {
  const src = HAIR_SCENE[theirs];
  const world = HAIR_WORLD[src.world as keyof typeof HAIR_WORLD];
  if (!world) throw new Error(`rozkwit: Każdy włos's ${src.world} is not adapted`);
  return { world, view: src.view, focus: src.focus, labels: [...src.labels.map(l => ({ ...l, part: hairPart(l.part) })), ...extra] };
}

const L = (part: string, at: Pt, side: -1 | 1, from: number, dy?: number): LabelSpec => ({ part, at, side, from, ...(dy ? { dy } : {}) });

export const SCENES: Readonly<Record<string, SceneSpec>> = {
  ...Object.fromEntries(Object.entries(BORROWS).map(([id, b]) => [id, borrowedScene(b)])),
  wlos: hairScene('barwa'),
  glowa: hairScene('glowa', [L('hair', CROWN_LIFTED, 1, 0.3, -0.6)]),
  // ── 6. Cały człowiek: its own picture ──
  cialo: {
    world: 'whole', view: BODY_VIEW, focus: CHEST,
    labels: [
      L('cells', [9.6, 32], 1, 0.04, 0.4),
      L('spine', [0, LUMBAR[1] + 2], -1, 0.22, 0.6),
      L('hair', HAIR_AT, -1, 0.44, -0.6),
      L('skin', SKIN_AT, -1, 0.6),
      L('strength', [7.2, THIGH[1]], 1, 0.8),
    ],
  },
  rozkwit: {
    world: 'whole', variant: 'bloom', view: BLOOM_VIEW, focus: HEART,
    labels: [
      L('heart', HEART, 1, 0.14, -1.2),
      L('blossom', [BLOOMS[4].x, BLOOMS[4].y], -1, 0.5, 0.4),
      L('people', [PEOPLE[0].x, FEET_Y - 60 * PEOPLE[0].s], -1, 0.66, -0.6),
    ],
  },
};

// ── the worlds ───────────────────────────────────────────────────
/** The look a source game is told (sources.ts LOOK_FOR; '' for a game without looks). */
const lookFor = (lib: HealthLibrary) => LOOK_FOR[lib.id] ?? ((): string => lib.looks[0] ?? '');

function borrowedWorlds(): Record<string, WorldPainter> {
  const byWorld = new Map<string, { lib: HealthLibrary; world: string; theirs: Map<string, string> }>();
  for (const [mine, b] of Object.entries(BORROWS)) {
    const w = b.lib.scenes[b.scene].world;
    const key = worldKey(b.lib, w);
    const e = byWorld.get(key) ?? { lib: b.lib, world: w, theirs: new Map<string, string>() };
    e.theirs.set(mine, b.scene);
    byWorld.set(key, e);
  }
  const out: Record<string, WorldPainter> = {};
  for (const [key, e] of byWorld) out[key] = borrowedWorld(e.lib.worlds[e.world], e.theirs, lookFor(e.lib));
  return out;
}

const HAIR_MAP = new Map(Object.entries(HAIR));

export const WORLDS: Readonly<Record<string, WorldPainter>> = {
  ...borrowedWorlds(),
  [HAIR_WORLD.follicle]: follicleWorld(HAIR_MAP),
  [HAIR_WORLD.head]: headWorld(HAIR_MAP),
  whole: { ...WHOLE_WORLD, counter },
};

// ── where a dive opens ───────────────────────────────────────────
/** On the whole figure, where each game's picture lies. */
const ON_FIGURE: Readonly<Record<string, Pt>> = {
  komorki: CHEST, straz: ARM, kregoslup: LUMBAR, ksztalt: LUNG, skora: ARM, radosc: HEART, wlosy: SCALP,
};
const sourceOf = (scene: string): string => BORROWS[scene]?.lib.id ?? (HAIR[scene] ? 'wlosy' : 'rozkwit');

export function portal(shallow: string, deep: string): Pt | null {
  const a = BORROWS[shallow], b = BORROWS[deep];
  // both in one game's pictures: that game's own place
  if (a && b && a.lib === b.lib) return a.lib.portal?.(a.scene, b.scene) ?? null;
  const sa = SCENES[shallow], sb = SCENES[deep];
  if (!sa || !sb) return null;
  // the whole figure — and Lekkość i siła's, drawn in the same units — opens where each picture lies in the body
  if (sa.world === 'whole' || sa.world === 'ksztalt.body') {
    if (deep === 'miesien') return THIGH;
    return ON_FIGURE[sourceOf(deep)] ?? CHEST;
  }
  if (sa.world === HAIR_WORLD.head) return HAIR[deep] ? HAIR_CROWN : null;
  return null;
}

// ── the counts on a picture's corner ─────────────────────────────
const T = translatorFor(WORDS, lang).t;
function counter(scene: string, g: number): string | null {
  if (scene === 'cialo' && g > 0.04) return T('count.cialo');
  if (scene === 'rozkwit' && g > 0.6) return T('count.rozkwit');
  return null;
}

const CLOSERS: readonly PassageId[] = ['psa16.9', '2co4.16', 'psa139.16', 'jhn15.11', 'psa1.3'];

export const LIBRARY: HealthLibrary = {
  id: 'rozkwit',
  meds: MEDS,
  scenes: SCENES,
  worlds: WORLDS,
  portal,
  root: 'psa139.13-14',
  closers: CLOSERS,
  looks: ['ona', 'on'],
  perScene: 120,
  words: WORDS,
  tune: buildTune,
  tint: { ground: '#170c22', light: '#ffd2b0' },
};

