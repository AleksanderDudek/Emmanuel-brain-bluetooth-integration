/**
 * Nehemiasz's data: the stretch of wall (six sections and the gate), the markers Nehemiah builds on,
 * what each tier costs and does, the three roads the raiders come by, the raiders' kinds, the ten
 * gates of Nehemiah 3 with their days, the towns of Judah that send volunteers, the decrees, the
 * king's letters (permanent favours), and the words: Tirza's and the villains' lines for every
 * moment and the strategies under a block's name (from i18n.ts).  No state, no randomness.
 */
import { t, type Key } from './i18n';
import { RULES } from './rules';

// ── the wall ─────────────────────────────────────────────────────
export interface SegSpec { x0: number; x1: number; gate: boolean }
/** Six sections and the gate (index 3), left to right across the 18 u of the world. */
export const SEGS: readonly SegSpec[] = [
  { x0: 0, x1: 2.6, gate: false }, { x0: 2.6, x1: 5.2, gate: false }, { x0: 5.2, x1: 7.8, gate: false },
  { x0: 7.8, x1: 10.2, gate: true },
  { x0: 10.2, x1: 12.8, gate: false }, { x0: 12.8, x1: 15.4, gate: false }, { x0: 15.4, x1: 18, gate: false },
];
export const GATE_SEG = 3;
export const segMid = (i: number): number => (SEGS[i].x0 + SEGS[i].x1) / 2;
/** The segment a point of the wall belongs to. */
export function segAt(x: number): number {
  for (let i = 0; i < SEGS.length; i++) if (x < SEGS[i].x1) return i;
  return SEGS.length - 1;
}
/** Cubits in a tier of a segment (1..3; higher tiers take more). */
export const tierCubits = (seg: number, tier: number): number => {
  const k = Math.max(1, Math.min(3, Math.floor(tier)));
  return SEGS[seg].gate ? RULES.gateCubits[k] : RULES.segCubits[k];
};

// ── the markers ──────────────────────────────────────────────────
export type Kind = 'wall' | 'gate' | 'tower' | 'fire' | 'post' | 'house' | 'bakery' | 'granary' | 'well' | 'yard' | 'governor';
/** Buildings of the city (kept from gate to gate) and of the stretch (each gate starts its own). */
export const CITY_KINDS: readonly Kind[] = ['house', 'bakery', 'granary', 'well', 'yard', 'governor'];
export const isCity = (k: Kind): boolean => CITY_KINDS.includes(k);

export interface MarkerSpec { id: string; kind: Kind; x: number; y: number; seg?: number }
export const MARKERS: readonly MarkerSpec[] = [
  // the sections, built from the scaffold just inside, and the gate
  ...[0, 1, 2, 4, 5, 6].map(i => ({ id: `w${i}`, kind: 'wall' as Kind, x: segMid(i), y: 5.25, seg: i })),
  { id: 'gate', kind: 'gate', x: 9, y: 5.4, seg: GATE_SEG },
  // watchtowers: by the side roads, and on either side of the gate
  { id: 't0', kind: 'tower', x: 2.6, y: RULES.wallY },
  { id: 't1', kind: 'tower', x: 7.8, y: RULES.wallY },
  { id: 't2', kind: 'tower', x: 10.2, y: RULES.wallY },
  { id: 't3', kind: 'tower', x: 15.4, y: RULES.wallY },
  // watch fires on the wall walk (the gate's own is lit when a stretch begins)
  { id: 'f0', kind: 'fire', x: 1.3, y: RULES.wallY },
  { id: 'f1', kind: 'fire', x: 3.9, y: RULES.wallY },
  { id: 'f2', kind: 'fire', x: 9, y: RULES.wallY },
  { id: 'f3', kind: 'fire', x: 14.1, y: RULES.wallY },
  { id: 'f4', kind: 'fire', x: 16.7, y: RULES.wallY },
  // guard posts behind the lowest points (Neh 4:13), set back from the scaffold so each build badge
  // takes its own finger-sized tap on a phone (layout.ts: badgeOf)
  { id: 'p0', kind: 'post', x: 3.9, y: 7.2 },
  { id: 'p1', kind: 'post', x: 7.1, y: 7.2 },
  { id: 'p2', kind: 'post', x: 14.1, y: 7.2 },
  // the city
  { id: 'yard', kind: 'yard', x: 1.9, y: 7.4 },
  { id: 'well', kind: 'well', x: 5.6, y: 7.6 },
  { id: 'bakery', kind: 'bakery', x: 12.4, y: 7.5 },
  { id: 'granary', kind: 'granary', x: 16.1, y: 7.4 },
  { id: 'gov', kind: 'governor', x: 9, y: 9.0 },
  { id: 'h0', kind: 'house', x: 3.3, y: 9.5 },
  { id: 'h1', kind: 'house', x: 6.4, y: 9.8 },
  { id: 'h2', kind: 'house', x: 11.7, y: 9.8 },
  { id: 'h3', kind: 'house', x: 14.8, y: 9.5 },
];
export const markerSpec = (id: string): MarkerSpec | undefined => MARKERS.find(m => m.id === id);
export const TOWER_IDS = ['t0', 't1', 't2', 't3'] as const;
export const FIRE_IDS = ['f0', 'f1', 'f2', 'f3', 'f4'] as const;
export const POST_IDS = ['p0', 'p1', 'p2'] as const;
export const HOUSE_IDS = ['h0', 'h1', 'h2', 'h3'] as const;
/** the stretch's own buildings (reset when a new gate begins) */
export const STRETCH_IDS: readonly string[] = [...TOWER_IDS, ...FIRE_IDS, ...POST_IDS];
/** the city's buildings and the levels they start at */
export const CITY_START: Readonly<Record<string, number>> = { yard: 1, gov: 1, well: 0, bakery: 0, granary: 0, h0: 0, h1: 0, h2: 0, h3: 0 };

export interface Cost { stone: number; timber: number }
const c = (stone: number, timber: number): Cost => ({ stone, timber });
const Z = c(0, 0);
/** What building the next level costs (index = the new level 1..3). */
export const COSTS: Readonly<Record<Kind, readonly Cost[]>> = {
  wall: [Z, c(4, 0), c(7, 1), c(10, 2)],
  gate: [Z, c(4, 3), c(7, 4), c(10, 5)],
  tower: [Z, c(4, 2), c(6, 3), c(9, 4)],
  fire: [Z, c(1, 1), c(2, 2), c(3, 3)],
  post: [Z, c(5, 1), c(7, 2), c(10, 3)],
  house: [Z, c(6, 2), c(10, 3), c(14, 4)],
  bakery: [Z, c(5, 2), c(8, 3), c(12, 4)],
  granary: [Z, c(5, 2), c(8, 3), c(12, 4)],
  well: [Z, c(4, 1), c(7, 2), c(10, 3)],
  yard: [Z, Z, c(8, 2), c(12, 4)],
  governor: [Z, Z, c(12, 5), c(18, 8)],
};
export const MAX_LEVEL = 3;

/** Job slots a building's level gives (the rest of the people build the wall). */
export const SLOTS = {
  yard: [0, 2, 4, 6],
  bakery: [0, 2, 4, 6],
  well: [0, 1, 2, 3],
} as const;

// ── the roads and the raiders ────────────────────────────────────
export type RouteId = 'west' | 'centre' | 'east';
export const ROUTE_IDS: readonly RouteId[] = ['west', 'centre', 'east'];
export type Band = 'samaria' | 'arabia' | 'ammon';
export interface RouteSpec { pts: readonly (readonly [number, number])[]; band: Band; seg: number }
/** The roads down the hills to the wall (polylines in u, from beyond the top edge to the wall's foot). */
export const ROUTES: Readonly<Record<RouteId, RouteSpec>> = {
  west: { pts: [[1.0, -0.8], [1.6, 0.8], [3.0, 2.2], [3.9, 3.4], [3.9, 4.05]], band: 'samaria', seg: 1 },
  centre: { pts: [[9.6, -0.8], [8.4, 0.9], [9.6, 2.4], [9.0, 3.5], [9.0, 4.05]], band: 'arabia', seg: GATE_SEG },
  east: { pts: [[17.0, -0.8], [16.2, 0.9], [14.8, 2.3], [14.1, 3.4], [14.1, 4.05]], band: 'ammon', seg: 5 },
};
/** A road's length (u) and the point at a distance along it. */
export function routeLen(id: RouteId): number {
  const p = ROUTES[id].pts;
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return s;
}
export function routeAt(id: RouteId, d: number): { x: number; y: number; dx: number; dy: number } {
  const p = ROUTES[id].pts;
  let left = Math.max(0, d);
  for (let i = 1; i < p.length; i++) {
    const ax = p[i - 1][0], ay = p[i - 1][1], bx = p[i][0], by = p[i][1];
    const l = Math.hypot(bx - ax, by - ay);
    if (left <= l || i === p.length - 1) {
      const k = l > 0 ? Math.min(1, left / l) : 1;
      return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k, dx: l > 0 ? (bx - ax) / l : 0, dy: l > 0 ? (by - ay) / l : 1 };
    }
    left -= l;
  }
  const q = p[p.length - 1];
  return { x: q[0], y: q[1], dx: 0, dy: 1 };
}

export type RaiderKind = 'rabus' | 'procarz' | 'drabina' | 'taran' | 'kapitan';
export const RAIDER_KINDS: readonly RaiderKind[] = ['rabus', 'procarz', 'drabina', 'taran', 'kapitan'];
/** from which gate (index) each kind comes */
export const RAIDER_FROM: Readonly<Record<RaiderKind, number>> = { rabus: 0, procarz: 1, drabina: 2, taran: 3, kapitan: 0 };

// ── the ten gates and the towns ──────────────────────────────────
export const GATES = ['owcza', 'rybna', 'stara', 'doliny', 'gnojna', 'zrodla', 'wodna', 'konska', 'wschodnia', 'przegladu'] as const;
export type GateId = typeof GATES[number];
export const gateDays = (g: number): number => RULES.gateDays[((g % GATES.length) + GATES.length) % GATES.length];
/** the first campaign day of a gate (1-based) */
export function gateFirstDay(g: number): number {
  let d = 1;
  for (let i = 0; i < g; i++) d += gateDays(i);
  return d;
}
export const TOWNS = ['jerycho', 'tekoa', 'gibeon', 'mispa', 'zanoach', 'betkerem', 'betsur', 'keila'] as const;
export type TownId = typeof TOWNS[number];
/** the chronicle: every town that sent people and every gate's builders */
export const CHRONICLE_SIZE = TOWNS.length + GATES.length;

// ── the decrees ──────────────────────────────────────────────────
export const DECREES = ['dlugi', 'upal', 'polowa', 'nocleg', 'stol', 'szabat', 'asaf', 'gruz'] as const;
export type DecreeId = typeof DECREES[number];
export interface DecreeSpec { days: number; nums: Readonly<Record<string, number>> }
/** Each decree's length (days; 0 = at once) and its numbers (the card shows them). */
export const DECREE: Readonly<Record<DecreeId, DecreeSpec>> = {
  dlugi: { days: 0, nums: { bread: 6, pct: 25, n: 2 } },
  upal: { days: 3, nums: { pct: 40, timber: 1 } },
  polowa: { days: 3, nums: { work: 30, guard: 80 } },
  nocleg: { days: 2, nums: { guards: 1, pct: 6 } },
  stol: { days: 3, nums: { bread: 3, pct: 8, n: 1 } },
  szabat: { days: 1, nums: { horn: 50 } },
  asaf: { days: 0, nums: { timber: 6, bread: 5 } },
  gruz: { days: 2, nums: { stone: 100, work: 25 } },
};
export const decreeName = (id: DecreeId): string => t(`decree.${id}` as Key);
export const decreeRef = (id: DecreeId): string => t(`decree.${id}.ref` as Key);
export const decreeFx = (id: DecreeId): string => t(`decree.${id}.fx` as Key, { ...DECREE[id].nums, days: DECREE[id].days });

// ── the king's letters (permanent favours, bought with stars) ────
export const PERKS = ['drewno', 'kielnie', 'trebacz', 'piece', 'straz', 'eskorta'] as const;
export type PerkId = typeof PERKS[number];
/** stars for each next level */
export const PERK_COSTS: Readonly<Record<PerkId, readonly number[]>> = {
  drewno: [1, 2, 3], kielnie: [1, 2, 3], trebacz: [1, 2, 3], piece: [1, 2], straz: [2, 3], eskorta: [2, 3],
};
export const perkCost = (id: PerkId, level: number): number | null => PERK_COSTS[id][level] ?? null;

// ── names ────────────────────────────────────────────────────────
export const kindName = (k: Kind): string => t(`kind.${k}` as Key);
export const gateName = (g: number): string => t(`gate.${GATES[((g % GATES.length) + GATES.length) % GATES.length]}` as Key);
export const townName = (id: TownId): string => t(`town.${id}` as Key);
export const raiderName = (k: RaiderKind): string => t(`raider.${k}` as Key);
export const perkName = (id: PerkId): string => t(`perk.${id}` as Key);
export const perkText = (id: PerkId): string => t(`perk.${id}.text` as Key);
/** the name a tier shows on its marker: the wall's and the gate's own words, "Wieża strażnicza · poz. 2" for the rest */
export function tierName(kind: Kind, level: number): string {
  if (kind === 'wall' || kind === 'gate') return t(`tier.${kind}.${Math.max(1, Math.min(3, level))}` as Key);
  return `${kindName(kind)} · ${t('hud.lvl', { n: level })}`;
}

// ── the words: Tirza's and the villains' lines, the strategies ────
export const MOMENTS = [
  'open', 'warm', 'day', 'night', 'blind', 'good', 'hornReady', 'horn', 'build', 'tier', 'breach', 'held', 'plunder',
  'newcomers', 'hunger', 'decree', 'ono', 'fox', 'gate', 'dung', 'captain', 'end', 'sneer', 'mock', 'invite', 'lost',
] as const;
export type Moment = typeof MOMENTS[number];
export type Speaker = 'tirza' | 'sanballat' | 'tobiah' | 'messenger';
export const SPEAKER: Readonly<Record<Moment, Speaker>> = {
  open: 'tirza', warm: 'tirza', day: 'tirza', night: 'tirza', blind: 'tirza', good: 'tirza', hornReady: 'tirza', horn: 'tirza',
  build: 'tirza', tier: 'tirza', breach: 'tirza', held: 'tirza', plunder: 'tirza', newcomers: 'tirza', hunger: 'tirza',
  decree: 'tirza', ono: 'tirza', fox: 'tirza', gate: 'tirza', dung: 'tirza', captain: 'tirza', end: 'tirza',
  sneer: 'sanballat', mock: 'tobiah', invite: 'messenger', lost: 'sanballat',
};
export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  open: 4, warm: 3, day: 4, night: 4, blind: 3, good: 3, hornReady: 3, horn: 3, build: 4, tier: 4, breach: 3, held: 3, plunder: 3,
  newcomers: 3, hunger: 3, decree: 3, ono: 3, fox: 3, gate: 3, dung: 3, captain: 3, end: 3, sneer: 4, mock: 3, invite: 4, lost: 3,
};
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, Array.from({ length: LINE_COUNT[m] }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as Record<Moment, string[]>;

export const TIPS = {
  warmup: [t('tip.warmup.1')],
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
};
