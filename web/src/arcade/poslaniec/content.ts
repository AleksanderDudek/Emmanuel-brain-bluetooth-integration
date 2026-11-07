/**
 * Posłaniec's data: the seven churches of Asia on the messenger's road (Revelation 1:11), the
 * missions in sets of three (each set done raises the permanent score multiplier, as in the
 * original's mission sets), the four upgrades the drachmas buy, the power-ups on the road, and the
 * day's word (a word hunt, in the player's language).  The words live in the catalog (i18n.ts); a
 * city's letter is named by its reference only (Revelation 2–3), never typed.
 */
import { t, type Key } from './i18n';
import { RULES } from './rules';

export type CityId = 'efez' | 'smyrna' | 'pergamon' | 'tiatyra' | 'sardes' | 'filadelfia' | 'laodycea';
export const CITY_IDS: readonly CityId[] = ['efez', 'smyrna', 'pergamon', 'tiatyra', 'sardes', 'filadelfia', 'laodycea'];

/** A city on the road: its name, its name after "to" ("do Smyrny"), its letter's reference. */
export interface City { index: number; id: CityId; name: string; to: string; ref: string }

export const CITIES: readonly City[] = CITY_IDS.map((id, index) => ({
  index, id, name: t(`city.${id}`), to: t(`city.${id}.to`), ref: t(`city.${id}.ref`),
}));

// ── power-ups ────────────────────────────────────────────────────
/** On the road: the satchel (a magnet), sandals (high jumps), the seal (×2 score), the shield (one hit). */
export type PowerKind = 'magnet' | 'sandals' | 'double' | 'shield';
export const POWER_KINDS: readonly PowerKind[] = ['magnet', 'sandals', 'double', 'shield'];

// ── upgrades ─────────────────────────────────────────────────────
/** What the drachmas buy: longer satchel, sandals and seal, and a longer flight. */
export type UpId = 'magnet' | 'sandals' | 'double' | 'wings';
export const UP_IDS: readonly UpId[] = ['magnet', 'sandals', 'double', 'wings'];

/** The price of the next level (null: at the top). */
export const upPrice = (level: number): number | null => (level >= RULES.upMax ? null : RULES.upCost[Math.max(0, level)]);

// ── missions ─────────────────────────────────────────────────────
/** What a mission counts; the `Run` kinds count within one run (they start over with a new run). */
export type MissionKind =
  | 'coinsRun' | 'metresRun' | 'cleanRun' | 'coins' | 'jumps' | 'rolls' | 'dodges' | 'roofs'
  | 'flights' | 'fires' | 'powers' | 'stations' | 'letters' | 'shields';

export const IN_ONE_RUN: ReadonlySet<MissionKind> = new Set<MissionKind>(['coinsRun', 'metresRun', 'cleanRun']);

export interface Mission { kind: MissionKind; target: number }

/** The hand-made sets; after them they come round again with targets ×1.5, ×2 … */
const SETS: readonly (readonly [MissionKind, number][])[] = [
  [['coinsRun', 80], ['jumps', 10], ['rolls', 5]],
  [['metresRun', 700], ['roofs', 2], ['powers', 2]],
  [['flights', 1], ['fires', 3], ['dodges', 40]],
  [['coins', 400], ['stations', 3], ['rolls', 15]],
  [['cleanRun', 500], ['letters', 2], ['jumps', 30]],
  [['coinsRun', 200], ['roofs', 5], ['shields', 1]],
  [['flights', 3], ['metresRun', 1500], ['fires', 8]],
  [['powers', 6], ['cleanRun', 1100], ['coins', 1500]],
];

/** The set after `done` sets were finished (0-based). */
export function missionSet(done: number): Mission[] {
  const n = Math.max(0, Math.floor(done));
  const base = SETS[n % SETS.length];
  const round = Math.floor(n / SETS.length);
  const k = 1 + 0.5 * round;
  return base.map(([kind, target]) => ({ kind, target: Math.round(target * k) }));
}

export const missionText = (m: Mission): string => t(`mission.${m.kind}` as Key, { n: m.target });

// ── the day's word ───────────────────────────────────────────────
export const WORD_COUNT = 10;
/** The day's word (upper case, in this page's language), the same for everyone on a day. */
export function dayWord(daySeed: number): string {
  const i = (Math.abs(Math.floor(daySeed)) % WORD_COUNT) + 1;
  return t(`word.${i}` as Key).toLocaleUpperCase();
}

// ── the strategies for the blocks (the panel's "W głowie") ─────
export const TASKS = { push: 6, rest: 4, blind: 2 } as const;
export const taskFor = (kind: 'push' | 'rest' | 'blind', n: number): string =>
  t(`task.${kind}.${(Math.max(0, n) % TASKS[kind]) + 1}` as Key);
