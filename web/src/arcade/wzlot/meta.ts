/**
 * What Wzlot remembers between sessions and the pure rules of its meta game: the eaglet's plumage
 * (feathers from showing up, a passed block, a mission, the day's gift), the vistas of the land with
 * published odds, down from duplicates and pity, the flight log's three missions, the records per
 * session length and the day's ridge.  No DOM; randomness only from the caller's generator.
 */
import { LIGHTS, MISSIONS, VISTAS, type Light, type MissionId } from './content';
import { RULES } from './rules';

export interface WzlotProgress {
  v: 1;
  /** sessions saved */
  sessions: number;
  /** metres flown, all time */
  metres: number;
  /** plumage: feathers grown, all time (the stage follows from them) */
  feathers: number;
  /** down from duplicate vistas: craftDown of it make the next missing vista */
  down: number;
  /** vistas found (indices into VISTAS) and the session that last brought a new one */
  vistas: number[];
  lastVistaSession: number;
  /** Lekcja blocks begun, all time: every 4th is blind ("W chmurze") from the 3rd session */
  lekcje: number;
  /** the flight log: the three open missions, how many were done, the next page to open */
  missions: MissionId[];
  missionsDone: number;
  missionNext: number;
  /** records: metres per session length (planned seconds), and the length last played */
  best: Record<string, number>;
  lastLen: number;
  bestChain: number;
  /** the longest single glide and the highest point over the ground (m) */
  longestGlide: number;
  highest: number;
  /** "Grań dnia": the day it was flown and its metres in the air; the day's gift ("Pióro dnia") */
  dailyDay: string;
  dailyAir: number;
  giftDay: string;
}

export function freshProgress(): WzlotProgress {
  return {
    v: 1, sessions: 0, metres: 0, feathers: 0, down: 0, vistas: [], lastVistaSession: 0, lekcje: 0,
    missions: MISSIONS.slice(0, 3).map(m => m.id), missionsDone: 0, missionNext: 3,
    best: {}, lastLen: 0, bestChain: 0, longestGlide: 0, highest: 0, dailyDay: '', dailyAir: 0, giftDay: '',
  };
}

// ── plumage ──────────────────────────────────────────────────────
/** The plumage stage for a feather count: 1 down, 2 first feathers, 3 flight feathers. */
export function stageOf(feathers: number): 1 | 2 | 3 {
  return feathers >= RULES.stages[2] ? 3 : feathers >= RULES.stages[1] ? 2 : 1;
}

/** Feathers toward the next stage (null: the last stage of this season). */
export function toNextStage(feathers: number): { have: number; need: number } | null {
  const at: readonly number[] = RULES.stages;
  const s = stageOf(feathers);
  if (s >= at.length) return null;
  return { have: feathers - at[s - 1], need: at[s] - at[s - 1] };
}

// ── vistas ───────────────────────────────────────────────────────
export const owned = (p: WzlotProgress, index: number): boolean => p.vistas.includes(index);

/** The published odds: the chance that a climb in this light opens a vista not yet found. */
export function newChance(p: WzlotProgress, light: Light): number {
  const pool = VISTAS.filter(v => v.light === light);
  return pool.filter(v => !owned(p, v.index)).length / pool.length;
}

/** What down and pity give: the first missing vista, the given light's first. Null: all found. */
export function nextMissing(p: WzlotProgress, light: Light = 'dawn'): number | null {
  for (const l of [light, ...LIGHTS.filter(x => x !== light)]) {
    for (const v of VISTAS) if (v.light === l && !owned(p, v.index)) return v.index;
  }
  return null;
}

/**
 * Pity: two saved sessions passed without a new vista and one is missing — the next climb above
 * the lower pity height opens a new one.
 */
export const pityDue = (p: WzlotProgress, session: number): boolean =>
  session - p.lastVistaSession > 2 && nextMissing(p) !== null;

export interface VistaDraw { index: number; isNew: boolean; crafted: number[] }

const pick = <T>(list: readonly T[], rnd: () => number): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];

/**
 * A vista at the top of a high climb: the light is the sky's (dawn in the session's first half,
 * dusk in its second), the landscape drawn evenly among the four.  A duplicate turns to down;
 * `forceNew` (pity) takes a missing one of that light, or of the other.
 */
export function drawVista(p: WzlotProgress, light: Light, rnd: () => number, forceNew = false): VistaDraw {
  const pool = VISTAS.filter(v => v.light === light);
  let index = pick(pool, rnd).index;
  if (forceNew && owned(p, index)) {
    const missing = pool.filter(v => !owned(p, v.index));
    index = missing.length ? pick(missing, rnd).index : nextMissing(p, light) ?? index;
  }
  const isNew = !owned(p, index);
  if (isNew) p.vistas.push(index);
  else p.down += RULES.dupDown;
  return { index, isNew, crafted: craft(p, light) };
}

function craft(p: WzlotProgress, light: Light): number[] {
  const out: number[] = [];
  while (p.down >= RULES.craftDown) {
    const m = nextMissing(p, light);
    if (m === null) break;
    p.down -= RULES.craftDown;
    p.vistas.push(m);
    out.push(m);
  }
  return out;
}

// ── the flight log ───────────────────────────────────────────────
/** After a session: every done mission gives its place to the next page not yet open. */
export function turnPages(p: WzlotProgress, done: readonly MissionId[]): MissionId[] {
  const opened: MissionId[] = [];
  p.missions = p.missions.map(id => {
    if (!done.includes(id)) return id;
    for (let k = 0; k < MISSIONS.length; k++) {
      const next = MISSIONS[(p.missionNext + k) % MISSIONS.length];
      if (!p.missions.includes(next.id) && !opened.includes(next.id) && !done.includes(next.id)) {
        p.missionNext = (p.missionNext + k + 1) % MISSIONS.length;
        opened.push(next.id);
        return next.id;
      }
    }
    return id;
  });
  return opened;
}

// ── records ──────────────────────────────────────────────────────
export const lenKey = (plannedSec: number): string => String(Math.round(plannedSec));

/** The record for a session length (null: none yet). */
export function bestFor(p: WzlotProgress, plannedSec: number): number | null {
  const v = p.best[lenKey(plannedSec)];
  return typeof v === 'number' && v > 0 ? v : null;
}
