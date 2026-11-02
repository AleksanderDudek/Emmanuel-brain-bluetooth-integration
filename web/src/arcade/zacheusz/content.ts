/**
 * Zacheusz's data: the hand-made chunks of Jericho's streets (a course is a seeded string of them,
 * ending at a sycamore-fig), the twelve courses, the twelve households of "Czterokrotnie" (Luke
 * 19:8), the missions, and the lines under a block's name.  The rules read it (world.ts, sim.ts,
 * meta.ts); the words come from the catalog (i18n.ts) in this page's language.
 *
 * A chunk's coordinates are in u from its start; the street's top is y = 0 and has ground
 * everywhere except in its pits.  The high way's pieces (bridges, palm fronds, awnings across the
 * roofs) lie over safe street: falling through an outline only lands him in the alley, and every
 * house has a ladder or a step on its near side, so the band only ever adds a better way.
 */
import { mulberry32 } from '../../core/random';
import { t, type Key } from './i18n';
import { RULES } from './rules';

export type BoxKind = 'stall' | 'wall' | 'house' | 'crate' | 'trunk';
/** awning: bounces; plank and branch: plain ledges; bridge, frond, roofawn: the high way */
export type PlatKind = 'awning' | 'plank' | 'branch' | 'bridge' | 'frond' | 'roofawn';
export type VaultKind = 'basket' | 'chicken' | 'dog';
export type PitKind = 'ditch' | 'well';
/** what a stretch of street is: a course's chunk, the warm-up, the sycamore's shade, a finish, the finale, the crowd's reveal */
export type ZoneKind = 'course' | 'warm' | 'shade' | 'finish' | 'finale' | 'reveal';

export const HIGH: readonly PlatKind[] = ['bridge', 'frond', 'roofawn'];
export const isHigh = (k: PlatKind): boolean => HIGH.includes(k);

export type Item =
  | { t: 'box'; a: number; b: number; h: number; k: BoxKind; ladder: boolean }
  | { t: 'plat'; a: number; b: number; y: number; k: PlatKind }
  | { t: 'pit'; a: number; b: number; k: PitKind }
  | { t: 'coins'; a: number; b: number; y: number; n: number; arc: number }
  | { t: 'sp'; x: number; y: number }
  | { t: 'vault'; x: number; k: VaultKind }
  | { t: 'fig'; x: number }
  | { t: 'palm'; x: number; h: number };

export interface ChunkDef { id: string; w: number; diff: number; zone: ZoneKind; items: readonly Item[] }

// ── the builders (short, so a chunk reads like a sketch) ──────────
const box = (a: number, b: number, h: number, k: BoxKind, ladder = false): Item => ({ t: 'box', a, b, h, k, ladder });
const plat = (a: number, b: number, y: number, k: PlatKind): Item => ({ t: 'plat', a, b, y, k });
const pit = (a: number, b: number, k: PitKind = 'ditch'): Item => ({ t: 'pit', a, b, k });
const coins = (a: number, b: number, y: number, n: number, arc = 0): Item => ({ t: 'coins', a, b, y, n, arc });
const sp = (x: number, y: number): Item => ({ t: 'sp', x, y });
const vault = (x: number, k: VaultKind): Item => ({ t: 'vault', x, k });
const fig = (x: number): Item => ({ t: 'fig', x });
const palm = (x: number, h: number): Item => ({ t: 'palm', x, h });
const G = 0.5;   // a coin on the street, at his middle's height

const chunk = (id: string, w: number, diff: number, items: Item[], zone: ZoneKind = 'course'): ChunkDef => ({ id, w, diff, zone, items });

/** The course chunks: the market, ditches and wells, walls, roofs, awnings, the palm grove. */
export const CHUNKS: readonly ChunkDef[] = [
  chunk('targ', 18, 0, [
    coins(1, 5, G, 3), box(6, 8, 1, 'stall'), plat(5.8, 8.2, 1.9, 'awning'), coins(6, 8, 2.6, 3, 0.4),
    vault(11, 'basket'), coins(12.5, 17, G, 3), sp(7, 4.4)]),
  chunk('rowek', 16, 1, [
    coins(1, 5, G, 3), pit(6.8, 8.8), coins(6.1, 9.6, 1.2, 4, 1), vault(11.5, 'chicken'), coins(12.6, 15.5, G, 2)]),
  chunk('studnia', 14, 1, [
    coins(1, 4.5, G, 3), pit(5.9, 7.5, 'well'), coins(5.3, 8.1, 1.2, 3, 0.8), coins(9, 13, G, 3), sp(6.6, 3.3)]),
  chunk('mur', 16, 1, [
    coins(1, 4, G, 3), box(6, 8, 1.4, 'wall'), coins(6.4, 7.6, 1.9, 2), coins(10, 15, G, 3)]),
  chunk('wysokiMur', 16, 2, [
    coins(1, 3.5, G, 2), box(4.4, 5.4, 0.9, 'crate'), coins(4.9, 4.9, 1.4, 1), box(7, 8.6, 2.4, 'wall'),
    coins(7.3, 8.3, 2.9, 2), sp(7.8, 4.7), coins(10.5, 15, G, 3)]),
  chunk('dachy', 24, 1, [
    coins(0.8, 3, G, 2), box(4, 9, 2.6, 'house', true), plat(9, 12, 2.6, 'bridge'), box(12, 17, 2.6, 'house', true),
    plat(17, 20, 2.6, 'roofawn'), box(20, 23, 2.6, 'house', true),
    coins(4.6, 8.4, 3.1, 4), coins(9.4, 11.6, 3.1, 3), coins(9.6, 11.4, G, 2), coins(12.6, 16.4, 3.1, 4),
    coins(17.4, 19.6, 3.1, 3), coins(17.6, 19.4, G, 2), coins(20.4, 22.6, 3.1, 2), sp(18.5, 4.8)]),
  chunk('markizy', 20, 2, [
    coins(0.8, 2.4, G, 2), box(3, 5, 1, 'stall'), plat(2.8, 5.2, 1.9, 'awning'), box(8, 10, 1, 'stall'),
    plat(7.8, 10.2, 2.1, 'awning'), box(13, 15, 1, 'stall'), plat(12.8, 15.2, 1.9, 'awning'),
    coins(5.6, 7.6, G, 2), coins(10.6, 12.6, G, 2), coins(16, 19, G, 2),
    coins(4.6, 8.4, 3.6, 4, 1), coins(9.6, 13.4, 3.6, 4, 1), sp(11, 5.5)]),
  chunk('schody', 18, 1, [
    coins(1, 2.5, G, 2), box(3, 5, 0.8, 'crate'), box(5, 7, 1.6, 'crate'), box(7, 12, 2.4, 'house'),
    coins(3.4, 4.6, 1.3, 2), coins(5.4, 6.6, 2.1, 2), coins(7.5, 11.5, 2.9, 4), coins(13, 17, G, 3), sp(9.5, 5)]),
  chunk('psy', 16, 0, [
    coins(1, 3, G, 2), vault(4, 'dog'), coins(5, 5.6, G, 1), plat(6, 9.4, 1.6, 'plank'), coins(6.4, 9, 2.1, 3),
    vault(8.5, 'chicken'), coins(10, 12, G, 2), vault(12.8, 'basket'), coins(13.8, 15.5, G, 2)]),
  chunk('dwaRowy', 20, 3, [
    coins(1, 3, G, 2), pit(4, 5.8), coins(3.4, 6.4, 1.2, 3, 0.8), box(7.5, 9, 1, 'stall'), coins(7.7, 8.8, 1.5, 2),
    pit(10.6, 12.6), coins(10, 13.2, 1.4, 4, 1.1), coins(14, 19, G, 3), sp(11.6, 3.6)]),
  chunk('palmy', 22, 1, [
    box(0.8, 2, 1.1, 'crate'), coins(1.4, 1.4, 1.6, 1), palm(4.1, 2.4), palm(10, 2.8), palm(16, 2.4),
    plat(2.2, 6, 2.4, 'frond'), plat(8, 12, 2.8, 'frond'), plat(14, 18, 2.4, 'frond'),
    coins(2.6, 5.6, 2.9, 3), coins(8.4, 11.6, 3.3, 3), coins(14.4, 17.6, 2.9, 3), coins(3, 17, G, 5),
    coins(19, 21.5, G, 2), sp(13, 4.7)]),
  chunk('brama', 16, 1, [
    coins(0.8, 2, G, 2), plat(2.4, 4.2, 0.9, 'awning'), box(5.4, 7, 2, 'wall'), coins(3.8, 8, 3, 4, 0.8),
    coins(9, 15, G, 3), sp(6.2, 4.7)]),
  chunk('skrzynie', 18, 2, [
    coins(1, 2.5, G, 2), box(3, 4.5, 0.9, 'crate'), coins(3.75, 3.75, 1.4, 1), box(4.5, 6, 1.8, 'crate'),
    coins(4.8, 5.7, 2.3, 2), pit(6, 8), coins(6.3, 7.7, 2.6, 2, 0.4), box(8, 9.5, 0.9, 'crate'), coins(8.75, 8.75, 1.4, 1),
    coins(11, 17, G, 3), sp(7, 4)]),
  chunk('dachy2', 28, 3, [
    pit(1.4, 3, 'well'), coins(0.9, 3.5, 1, 3, 0.7), coins(3.8, 4.4, G, 1),
    box(5, 9, 2.6, 'house', true), plat(9, 12.5, 2.6, 'bridge'), box(12.5, 15, 2.6, 'house', true),
    plat(15, 18.5, 2.6, 'frond'), box(18.5, 21, 2.6, 'house', true), plat(21, 24.5, 2.6, 'roofawn'), box(24.5, 26.5, 2.6, 'house', true),
    coins(5.5, 8.5, 3.1, 3), coins(9.4, 12, 3.1, 3), coins(12.9, 14.6, 3.1, 2), coins(15.4, 18, 3.1, 3), coins(19, 20.6, 3.1, 2),
    coins(21.4, 24, 3.1, 3), coins(25, 26, 3.1, 1), coins(9.6, 12, G, 2), coins(15.6, 18, G, 2), coins(21.6, 24, G, 2),
    coins(27, 27.8, G, 1), sp(16.7, 4.8), sp(22.7, 4.8)]),
];

/** The chunks that carry the high way (a course puts one in every third place). */
export const HIGH_CHUNKS: readonly string[] = ['dachy', 'palmy', 'dachy2'];

/** The first-ever session's warm-up ("Pierwsze kroki"): one thing at a time. */
export const WARM: readonly ChunkDef[] = [
  chunk('w-start', 12, 0, [coins(1.5, 11, G, 5)], 'warm'),
  chunk('w-kosz', 12, 0, [coins(1, 4, G, 2), vault(5.5, 'basket'), coins(7, 11, G, 2)], 'warm'),
  chunk('w-skrzynia', 12, 0, [coins(1, 4, G, 2), box(5, 6.2, 1, 'crate'), coins(5.6, 5.6, 1.5, 1), coins(8, 11, G, 2)], 'warm'),
  chunk('w-rowek', 14, 0, [coins(1, 4.5, G, 2), pit(6, 7.4), coins(5.2, 8.2, 1.1, 3, 0.8), coins(9.5, 13, G, 2)], 'warm'),
  chunk('w-markiza', 14, 0, [coins(1, 3.5, G, 2), box(5, 6.5, 1, 'stall'), plat(4.8, 6.7, 1.9, 'awning'), coins(5, 8, 3.4, 3, 0.6), coins(9, 13, G, 2)], 'warm'),
  chunk('w-dach', 16, 0, [coins(1, 3, G, 2), box(4, 9, 2.6, 'house', true), plat(9, 11, 2.6, 'plank'), box(11, 14, 2.6, 'house', true),
    coins(4.6, 13.4, 3.1, 6), coins(9.4, 10.6, G, 1)], 'warm'),
];

/** The sycamore's shade (rest): no pits, figs on the trees he passes. */
export const SHADE: readonly ChunkDef[] = [
  chunk('cien', 14, 0, [coins(1.5, 3, G, 2), fig(5), coins(7, 9, G, 2), fig(11), coins(12.6, 13.6, G, 1)], 'shade'),
  chunk('cien2', 16, 0, [fig(3.5), coins(5.5, 7.5, G, 2), plat(8, 10.5, 1.2, 'plank'), coins(8.4, 10.1, 1.7, 2), fig(13), coins(14.8, 15.6, G, 1)], 'shade'),
];

/** The sycamore-fig at a course's end: a bouncing awning before it, the trunk is the flagpole. */
export const FINISH: ChunkDef = chunk('sykomora', 18, 0, [
  coins(0.5, 2.5, G, 2), plat(3, 5, 1.2, 'awning'), coins(4, 8.4, 3.6, 4, 0.6), box(9, 10.2, 7, 'trunk'),
  coins(12, 17, G, 3)], 'finish');
/** where the trunk stands in the finish chunk */
export const TRUNK_X = 9;

/** The finale: the street to his own house, where a guest is expected. */
export const FINALE: ChunkDef = chunk('dom', 26, 0, [coins(1, 8, G, 3)], 'finale');
export const DOOR_X = 12;

/** The crowd parts after a blind block: a row of rooftops, the first ones solid by the block's focus. */
export const REVEAL: ChunkDef = chunk('tlum', 20, 0, [
  box(1, 3, 2.6, 'house', true), ...[3, 5, 7, 9, 11, 13].map(a => plat(a, a + 2, 2.6, 'bridge')), box(15, 17, 2.6, 'house', true),
  ...[3, 5, 7, 9, 11, 13].map(a => coins(a + 1, a + 1, 3.1, 1)), coins(4, 14, G, 4), coins(1.5, 2.5, 3.1, 2), coins(15.5, 16.5, 3.1, 2)], 'reveal');

export const chunkById = (id: string): ChunkDef | undefined => [...CHUNKS, ...WARM, ...SHADE, FINISH, FINALE, REVEAL].find(c => c.id === id);

// ── the courses ──────────────────────────────────────────────────
/** A course: its chunks in order (the sycamore follows them) and its name. */
export interface Course { index: number; chunks: string[]; name: string }

const COURSE_SALT = 0x7a3c_e911;

/** The chunks a course draws from: the gentle ones first, the hardest from the sixth course on. */
export const maxDiff = (index: number): number => (index < 2 ? 1 : index < 5 ? 2 : 3);

/**
 * A course's chunks, the same for everyone from its seed: 11 to 15 of them (40–60 s of running),
 * a high-way chunk in every third place, no chunk twice in a row, and at least five chunks with a
 * special denarius in them.
 */
export function courseChunks(seed: number, n: number, diff: number): string[] {
  const rnd = mulberry32(seed >>> 0);
  const pool = CHUNKS.filter(c => c.diff <= diff && !HIGH_CHUNKS.includes(c.id));
  const high = CHUNKS.filter(c => c.diff <= diff && HIGH_CHUNKS.includes(c.id));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const from = i % 3 === 1 && high.length ? high : pool;
    let pick = from[Math.floor(rnd() * from.length)];
    for (let k = 0; k < 4 && pick.id === out[out.length - 1]; k++) pick = from[Math.floor(rnd() * from.length)];
    out.push(pick.id);
  }
  // enough special places: swap chunks without one for ones with one, from the end
  const hasSp = (id: string) => chunkById(id)!.items.some(it => it.t === 'sp');
  const withSp = pool.filter(c => c.items.some(it => it.t === 'sp'));
  for (let i = out.length - 1; i >= 0 && out.filter(hasSp).length < RULES.specials; i--) {
    if (!hasSp(out[i]) && withSp.length) out[i] = withSp[i % withSp.length].id;
  }
  return out;
}

/** The i-th course of the world (0..11). */
export function course(index: number): Course {
  const i = Math.max(0, Math.min(RULES.courses - 1, Math.floor(index)));
  const n = Math.round(RULES.courseChunks[0] + ((RULES.courseChunks[1] - RULES.courseChunks[0]) * i) / (RULES.courses - 1));
  return { index: i, chunks: courseChunks((COURSE_SALT ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0, n, maxDiff(i)), name: t(`course.${i}` as Key) };
}

/** The day's course ("Trasa dnia"): from the date, the same for everyone; index −1. */
export function dailyCourse(daySeed: number): Course {
  return { index: -1, chunks: courseChunks(daySeed >>> 0, 12, 2), name: t('daily.title') };
}

// ── the households of Jericho (Fourfold, Luke 19:8) ───────────────
export interface Home { index: number; name: string; fix: string; at: number }
export const HOMES: readonly Home[] = RULES.homes.map((at, i) => ({ index: i, name: t(`home.${i}` as Key), fix: t(`home.${i}.fix` as Key), at }));

// ── the missions ─────────────────────────────────────────────────
export type MissionKind = 'coins' | 'wall' | 'bounce' | 'roofSec' | 'figs' | 'branch' | 'specialSet' | 'vault' | 'clean';
export type MissionId = 'coins60' | 'wall3' | 'bounce5' | 'roof15' | 'figs10' | 'branch4' | 'special5' | 'vault10' | 'clean' | 'coins150';
export interface Mission { id: MissionId; kind: MissionKind; target: number; name: string }
const mission = (id: MissionId, kind: MissionKind, target: number): Mission => ({ id, kind, target, name: t(`mission.${id}`) });

/** Three at a time, a done one replaced after the session by the next not yet open. */
export const MISSIONS: readonly Mission[] = [
  mission('coins60', 'coins', 60),
  mission('bounce5', 'bounce', 5),
  mission('wall3', 'wall', 3),
  mission('figs10', 'figs', 10),
  mission('branch4', 'branch', 4),
  mission('vault10', 'vault', 10),
  mission('roof15', 'roofSec', 15),
  mission('special5', 'specialSet', 1),
  mission('clean', 'clean', 1),
  mission('coins150', 'coins', 150),
];
export const missionById = (id: string): Mission | undefined => MISSIONS.find(m => m.id === id);

/** The special denarii's three sets on replays of a course (Mario's pink, purple, black). */
export const TIERS = ['silver', 'gold', 'purple'] as const;
export type Tier = (typeof TIERS)[number];

/** The line under the block's name: strategies to try, never "concentrate harder". */
export const TIPS = {
  warmup: [t('tip.warmup.1'), t('tip.warmup.2')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;
