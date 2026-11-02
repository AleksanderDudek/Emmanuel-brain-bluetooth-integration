/**
 * What Zastępy remembers between sessions and the pure rules of its meta game: the gold, the gate
 * of light's level (1–10: walls, the flow of light, the beam, the cards it opens), the host's unit
 * levels (1–5 each), the battle the player stands at (circles of ten, the tenth the Smok), the
 * records per session length, the day's gift.  No DOM, no randomness.
 */
import { HOST, HOST_IDS, RULES, type HostId } from './rules';

export interface ZastepyProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** demons beaten, all time; battles won; the Smok beaten; trumpets sounded */
  total: number;
  won: number;
  smoks: number;
  trumpets: number;
  /** the battle the player stands at (0-based, all circles): circle = ⌊battle / 10⌋ */
  battle: number;
  /** gold in hand, and gold earned all time */
  gold: number;
  goldAll: number;
  /** the gate of light's level (1..10) and the host's unit levels (1..5) */
  gate: number;
  units: Record<HostId, number>;
  /** Natarcie blocks begun, all time: every 4th is blind ("Mgła bitewna") from the 3rd session */
  calls: number;
  /** records: demons per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  /** the day's gift */
  giftDay: string;
}

const freshUnits = (): Record<HostId, number> =>
  Object.fromEntries(HOST_IDS.map(id => [id, 1])) as Record<HostId, number>;

export function freshProgress(): ZastepyProgress {
  return {
    v: 1, sessions: 0, total: 0, won: 0, smoks: 0, trumpets: 0, battle: 0, gold: 0, goldAll: 0, gate: 1,
    units: freshUnits(), calls: 0, best: {}, lastLen: 0, giftDay: '',
  };
}

// ── the battles ──────────────────────────────────────────────────
/** The circle (0-based) and the battle within it (0..9) of a battle number. */
export const circleOf = (battle: number): { circle: number; local: number } =>
  ({ circle: Math.floor(Math.max(0, battle) / RULES.circle), local: Math.max(0, battle) % RULES.circle });

/** The tenth battle of a circle: the Smok. */
export const isSmok = (battle: number): boolean => circleOf(battle).local === RULES.circle - 1;

// ── the gate and the units ───────────────────────────────────────
/** The unit levels as saved (an older save may miss a unit: it is level 1). */
export const unitLevel = (p: ZastepyProgress, id: HostId): number =>
  Math.min(RULES.unitMaxLevel, Math.max(1, Math.round(p.units?.[id] ?? 1)));

export const gateLevel = (p: ZastepyProgress): number => Math.min(RULES.gateMax, Math.max(1, Math.round(p.gate || 1)));

/** The gold for the next gate level (null at the top). */
export function gatePrice(level: number): number | null {
  if (level >= RULES.gateMax) return null;
  return Math.round(RULES.gatePrice * level ** RULES.gateExp);
}

/** The gold for a unit's next level (null at the top). */
export function unitPrice(id: HostId, level: number): number | null {
  if (level >= RULES.unitMaxLevel) return null;
  return Math.round(HOST[id].price * level ** RULES.unitExp);
}

/** The cards the gate opens at a level, in order. */
export const cardsAt = (gate: number): HostId[] => HOST_IDS.filter(id => HOST[id].gate <= gate);

/** The gate level that opens the next card (null: all open). */
export function nextCardGate(gate: number): { id: HostId; gate: number } | null {
  const id = HOST_IDS.find(i => HOST[i].gate > gate);
  return id ? { id, gate: HOST[id].gate } : null;
}

/** Raise the gate one level if the gold allows; true when bought. */
export function buyGate(p: ZastepyProgress): boolean {
  const lv = gateLevel(p), price = gatePrice(lv);
  if (price === null || p.gold < price) return false;
  p.gold -= price;
  p.gate = lv + 1;
  return true;
}

/** Raise a unit one level if the gold allows and its card is open; true when bought. */
export function buyUnit(p: ZastepyProgress, id: HostId): boolean {
  const lv = unitLevel(p, id), price = unitPrice(id, lv);
  if (price === null || p.gold < price || HOST[id].gate > gateLevel(p)) return false;
  p.gold -= price;
  p.units = { ...freshUnits(), ...p.units, [id]: lv + 1 };
  return true;
}

/** The cheapest unit upgrade on offer (an open card below the top level), for the card between battles. */
export function cheapestUnit(p: ZastepyProgress): { id: HostId; price: number } | null {
  let best: { id: HostId; price: number } | null = null;
  for (const id of cardsAt(gateLevel(p))) {
    const price = unitPrice(id, unitLevel(p, id));
    if (price !== null && (!best || price < best.price)) best = { id, price };
  }
  return best;
}

// ── the numbers of the gate ──────────────────────────────────────
export const wallsFor = (gate: number, retreats = 0): number => RULES.walls + RULES.wallsPerLevel * (gate - 1) + RULES.wallsPerRetreat * retreats;
export const flowFor = (gate: number): number => RULES.flow + RULES.flowPerLevel * (gate - 1);
export const lightMaxFor = (gate: number): number => RULES.lightMax + RULES.lightMaxPerLevel * (gate - 1);
export const beamFor = (gate: number): { dmg: number; rate: number; range: number } => ({
  dmg: RULES.beamDmg + RULES.beamDmgPerLevel * (gate - 1),
  rate: Math.max(0.5, RULES.beamRate - RULES.beamRatePerLevel * (gate - 1)),
  range: RULES.beamRange + RULES.beamRangePerLevel * (gate - 1),
});
export const trumpetDmgFor = (gate: number): number => RULES.trumpetDmg + RULES.trumpetDmgPerLevel * (gate - 1);

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: ZastepyProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}

/** The best headline for the length last played, else the best of any length (null: never played). */
export function bestOf(p: ZastepyProgress): number | null {
  const last = bestFor(p, p.lastLen);
  if (last !== null) return last;
  const all = Object.values(p.best).filter(v => typeof v === 'number' && v > 0);
  return all.length ? Math.max(...all) : null;
}
