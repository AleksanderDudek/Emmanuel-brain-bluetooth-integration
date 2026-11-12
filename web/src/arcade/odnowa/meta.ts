/**
 * What Odnowa remembers between sessions (version 1), and the pure rules of the meta loop:
 *
 *   the tissue      every division leaves one daughter cell in the niche's tissue (gut lining, skin, blood);
 *                   a patch is twelve cells, the lobby draws them
 *   the cell grows  milestones of the lifetime earn lasting traits: more mitochondria (biogenesis, by ATP
 *                   made), faster enzymes (by repairs), more lysosomes (by parts recycled)
 *   the niches      the gut crypt from the start, the skin's basal layer and the bone marrow open with
 *                   divisions; a session takes the chosen niche or the next one in turn
 *   Wiedza          the cards met in play (content.ts CARDS)
 *   records         the best ATP for each session length, the longest combo, the most divisions in a session
 *
 * `migrate` repairs anything of a wrong type, so the placeholder's save ({ ver: 1, sessions: n }) and any
 * older or broken save load as a playable progress.
 */
import { CARD_IDS, LESION_KINDS, NICHES, type CardId, type LesionKind, type NicheId } from './content';
import { RULES } from './rules';

export interface OdnowaProgress {
  ver: 1;
  sessions: number;
  /** pushes begun over the lifetime (the blind blocks' turn) */
  pushes: number;
  /** lifetime totals */
  atpTotal: number;
  repairs: number;
  recycled: number;
  divisions: number;
  surges: number;
  /** the daughter cells in each niche's tissue */
  tissue: Record<NicheId, number>;
  /** repairs of each kind of damage */
  log: Record<LesionKind, number>;
  /** the Wiedza cards met */
  cards: CardId[];
  /** first-time explanations already shown */
  seen: string[];
  /** the best ATP for each session length (seconds as the key) */
  best: Record<string, number>;
  bestCombo: number;
  bestDivisions: number;
  /** the niche chosen in the lobby ('auto': the next one in turn) and the last one played */
  niche: NicheId | 'auto';
  lastNiche: NicheId | null;
  /** the song and its sing-along line */
  song: boolean;
  lyrics: boolean;
  lastLen: number;
}

export function freshProgress(): OdnowaProgress {
  return {
    ver: 1, sessions: 0, pushes: 0, atpTotal: 0, repairs: 0, recycled: 0, divisions: 0, surges: 0,
    tissue: { gut: 0, skin: 0, blood: 0 },
    log: { oxo: 0, abasic: 0, dimer: 0, bulky: 0, dsb: 0 },
    cards: [], seen: [], best: {}, bestCombo: 0, bestDivisions: 0,
    niche: 'auto', lastNiche: null, song: true, lyrics: true, lastLen: 0,
  };
}

const num = (v: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isNiche = (v: unknown): v is NicheId => typeof v === 'string' && (NICHES as readonly string[]).includes(v);

/** Repair a loaded progress in place (and return it): every field of the right type, every number sane. */
export function migrate(p: OdnowaProgress): OdnowaProgress {
  const raw = p as unknown as Record<string, unknown>;
  p.ver = 1;
  p.sessions = Math.floor(num(raw.sessions));
  p.pushes = Math.floor(num(raw.pushes));
  p.atpTotal = Math.floor(num(raw.atpTotal));
  p.repairs = Math.floor(num(raw.repairs));
  p.recycled = Math.floor(num(raw.recycled));
  p.divisions = Math.floor(num(raw.divisions));
  p.surges = Math.floor(num(raw.surges));
  const tissue = isObj(raw.tissue) ? raw.tissue : {};
  p.tissue = { gut: Math.floor(num(tissue.gut)), skin: Math.floor(num(tissue.skin)), blood: Math.floor(num(tissue.blood)) };
  const log = isObj(raw.log) ? raw.log : {};
  p.log = { oxo: 0, abasic: 0, dimer: 0, bulky: 0, dsb: 0 };
  for (const k of LESION_KINDS) p.log[k] = Math.floor(num(log[k]));
  p.cards = Array.isArray(raw.cards) ? [...new Set(raw.cards.filter((c): c is CardId => typeof c === 'string' && (CARD_IDS as readonly string[]).includes(c)))] : [];
  p.seen = Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((s): s is string => typeof s === 'string'))] : [];
  const best: Record<string, number> = {};
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) if (/^\d+$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) best[k] = Math.floor(v);
  p.best = best;
  p.bestCombo = Math.floor(num(raw.bestCombo, 0, RULES.comboMax));
  p.bestDivisions = Math.floor(num(raw.bestDivisions));
  p.niche = raw.niche === 'auto' || isNiche(raw.niche) ? raw.niche : 'auto';
  p.lastNiche = isNiche(raw.lastNiche) ? raw.lastNiche : null;
  p.song = typeof raw.song === 'boolean' ? raw.song : true;
  p.lyrics = typeof raw.lyrics === 'boolean' ? raw.lyrics : true;
  p.lastLen = Math.floor(num(raw.lastLen));
  // the lifetime's divisions are at least the cells in the tissue (an older save may lack one or the other)
  p.divisions = Math.max(p.divisions, p.tissue.gut + p.tissue.skin + p.tissue.blood);
  return p;
}

/** How many milestones of `at` a lifetime total has passed (a trait's level, 0..at.length). */
export const levelOf = (at: readonly number[], total: number): number => at.filter(x => total >= x).length;

/** Extra mitochondria (biogenesis): one at each ATP milestone of the lifetime. */
export const mitoLevel = (p: Pick<OdnowaProgress, 'atpTotal'>): number => levelOf(RULES.mitoAt, p.atpTotal);
/** Faster enzymes: a level at each repair milestone. */
export const enzymeLevel = (p: Pick<OdnowaProgress, 'repairs'>): number => levelOf(RULES.enzymeAt, p.repairs);
/** More lysosomes: a level at each milestone of parts recycled. */
export const lysoLevel = (p: Pick<OdnowaProgress, 'recycled'>): number => levelOf(RULES.lysoAt, p.recycled);

export type Trait = 'mito' | 'enzyme' | 'lyso';
export const TRAITS: readonly Trait[] = ['mito', 'enzyme', 'lyso'];

/** A trait's level, its milestones, the lifetime total that moves it, and the next milestone (null at the top). */
export function traitState(p: OdnowaProgress, tr: Trait): { level: number; max: number; total: number; next: number | null } {
  const at = tr === 'mito' ? RULES.mitoAt : tr === 'enzyme' ? RULES.enzymeAt : RULES.lysoAt;
  const total = tr === 'mito' ? p.atpTotal : tr === 'enzyme' ? p.repairs : p.recycled;
  const level = levelOf(at, total);
  return { level, max: at.length, total, next: level < at.length ? at[level] : null };
}

/** Whether a niche is open (the gut from the start; the skin and the marrow after divisions). */
export const nicheOpen = (p: Pick<OdnowaProgress, 'divisions'>, n: NicheId): boolean => p.divisions >= RULES.nicheAt[n];

/** The niche a session plays: the chosen one while it is open, else the next open one after the last played. */
export function sessionNiche(p: OdnowaProgress): NicheId {
  if (p.niche !== 'auto' && nicheOpen(p, p.niche)) return p.niche;
  const open = NICHES.filter(n => nicheOpen(p, n));
  if (!p.lastNiche) return open[0];
  const i = NICHES.indexOf(p.lastNiche);
  for (let k = 1; k <= NICHES.length; k++) {
    const n = NICHES[(i + k) % NICHES.length];
    if (open.includes(n)) return n;
  }
  return open[0];
}

/** A niche's tissue: full patches and the cells of the patch growing now. */
export function patchOf(p: OdnowaProgress, n: NicheId): { patches: number; cells: number; of: number } {
  const c = p.tissue[n];
  return { patches: Math.floor(c / RULES.patch), cells: c % RULES.patch, of: RULES.patch };
}

/** The key of a session length for the records. */
export const lenKey = (plannedSec: number): string => String(Math.max(0, Math.round(plannedSec)));

/** The best ATP of any session length (null before the first). */
export function bestOf(p: OdnowaProgress): number | null {
  const v = Object.values(p.best);
  return v.length ? Math.max(...v) : null;
}

/** The best ATP for this session length (null before the first such session). */
export const bestFor = (p: OdnowaProgress, plannedSec: number): number | null => p.best[lenKey(plannedSec)] ?? null;

/** The share of the Wiedza cards met (0..1). */
export const cardShare = (p: OdnowaProgress): number => p.cards.length / CARD_IDS.length;
