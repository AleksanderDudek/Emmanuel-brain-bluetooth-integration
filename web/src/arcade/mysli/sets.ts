/**
 * Każda myśl's themed sets (DESIGN §20): the 24 warownie of the founder's series (kit/warownie.ts — the order, the
 * names, the groups, the opening verses, the care) as ready sets of six lie → truth pairs, and the player's own
 * warownie — up to six sets of up to ten pairs, kept only in the game's progress on this device.  A set is played as a
 * stronghold: one stone a pair; each lie burned loosens its stone, all of them burned and it falls; the next session
 * goes on where the last one stopped (its place: which pairs' lies have burned, which truths were gilded) — after a
 * fall it stands again, whole (strongholds are torn down again and again).  Pure data and rules: no DOM, no randomness.
 */
import { WAROWNIE, warownia, type Warownia, type WarowniaCare, type WarowniaId } from '../kit/warownie';
import type { PassageId } from '../kit/scripture';
import { OWN_EMOS, cleanText, ownMix, type Mix, type OwnEmo } from './content';
import { GT_VERSES, WAR_PAIRS } from './war-data';

export { GT_VERSES, WAR_PAIRS };

// ── the limits ───────────────────────────────────────────────────

/** Pairs in each warownia of the series. */
export const WAR_SIZE = 6;
/** At most this many own sets, each with a name of at most this many characters and at most this many pairs. */
export const SETS_MAX = 6;
export const SET_NAME_CHARS = 32;
export const PAIRS_MAX = 10;
/** An own lie and its truth: at most this many characters (the truth may be left empty: a generic one answers). */
export const PAIR_CHARS = 80;
/** A written truth (library, warownie, generic) is at most this long in every language (the tests hold it). */
export const TRUTH_CHARS = 64;
/** How many generic truths each feeling has (i18n `gt.<feeling>.<1..n>`). */
export const GT_COUNT = 3;

// ── a set's place ────────────────────────────────────────────────

/** Where a set stands: the pairs whose lie has burned (their stones are down), whose truth was gilded, how often it fell. */
export interface Place { burned: number[]; gilded: number[]; falls: number }

export const freshPlace = (): Place => ({ burned: [], gilded: [], falls: 0 });

const idxList = (v: unknown, n: number): number[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 0 && x < n))].sort((a, b) => a - b) : [];

/** A saved place for a set of `n` pairs, repaired (indices in range, no doubles; a gilded truth's lie has burned). */
export function cleanPlace(v: unknown, n: number): Place {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const burned = idxList(o.burned, n);
  // all lies burned means the stronghold fell: it stands again, whole
  const whole = burned.length >= n && n > 0;
  return {
    burned: whole ? [] : burned,
    gilded: whole ? [] : idxList(o.gilded, n).filter(i => burned.includes(i)),
    falls: Math.max(0, Math.floor(typeof o.falls === 'number' && Number.isFinite(o.falls) ? o.falls : 0)),
  };
}

/** How many stones are down (the chip's "3/6"). */
export const placeCount = (pl: Place | undefined): number => pl?.burned.length ?? 0;

// ── the player's own warownie ────────────────────────────────────

export interface OwnPair { lie: string; truth: string; emo: OwnEmo }
export interface OwnSet { name: string; pairs: OwnPair[]; place: Place }

export const cleanName = (v: unknown): string => [...cleanText(v)].slice(0, SET_NAME_CHARS).join('').trim();

export function cleanPair(v: unknown): OwnPair | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const lie = cleanText(o.lie);
  if (!lie) return null;
  const emo = (OWN_EMOS as readonly unknown[]).includes(o.emo) ? (o.emo as OwnEmo) : 'mixed';
  return { lie, truth: cleanText(o.truth), emo };
}

export function cleanSet(v: unknown): OwnSet | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const pairs: OwnPair[] = [];
  const seen = new Set<string>();
  for (const x of Array.isArray(o.pairs) ? o.pairs : []) {
    const p = cleanPair(x);
    if (!p || seen.has(p.lie.toLocaleLowerCase())) continue;
    seen.add(p.lie.toLocaleLowerCase());
    pairs.push(p);
    if (pairs.length >= PAIRS_MAX) break;
  }
  return { name: cleanName(o.name), pairs, place: cleanPlace(o.place, pairs.length) };
}

export function cleanSets(v: unknown): OwnSet[] {
  if (!Array.isArray(v)) return [];
  const out: OwnSet[] = [];
  for (const x of v) {
    const s = cleanSet(x);
    if (s) out.push(s);
    if (out.length >= SETS_MAX) break;
  }
  return out;
}

/** The round-15 own thoughts (≤ 8, plain text with a feeling) as one own set with empty truths ("Moje myśli"). */
export function setFromThoughts(own: readonly { text: string; emo: OwnEmo }[]): OwnSet | null {
  const s = cleanSet({ name: '', pairs: own.map(o => ({ lie: o.text, truth: '', emo: o.emo })) });
  return s && s.pairs.length ? s : null;
}

/**
 * A set's name as shown: its own, or — left empty — "Moje myśli" (the first such set), "Moje myśli 2"…  `unnamed` is
 * the localised "Moje myśli" with an optional {n}.
 */
export function setName(sets: readonly OwnSet[], i: number, unnamed: (n: number) => string): string {
  const s = sets[i];
  if (!s) return '';
  if (s.name) return s.name;
  const before = sets.slice(0, i).filter(x => !x.name).length;
  return unnamed(before + 1);
}

/** The generic truth an own pair gets when its own was left empty: its feeling's k-th, k by the pair's index. */
export const gtIndex = (pair: number): number => ((pair % GT_COUNT) + GT_COUNT) % GT_COUNT;
export const gtVerse = (emo: OwnEmo, pair: number): PassageId => GT_VERSES[emo][gtIndex(pair) % GT_VERSES[emo].length];
export const ownPairMix = (p: OwnPair): Mix => ownMix(p.emo);

// ── the warownie ─────────────────────────────────────────────────

export const warById = (id: unknown): Warownia | undefined => warownia(id);
export const careOf = (id: WarowniaId): readonly WarowniaCare[] => warownia(id)?.care ?? [];
/** The compulsions set: never a ritual — no daily repetition after its fall, nothing that says "again tomorrow". */
export const isOcd = (id: WarowniaId | null | undefined): boolean => !!id && careOf(id).includes('ocd');
export const WAR_IDS: readonly WarowniaId[] = WAROWNIE.map(w => w.id);

/** The order a set's remaining pairs come in: the pairs whose truth still waits first, then the unburned lies in order. */
export function setOrder(n: number, pl: Place): { pending: number[]; fresh: number[] } {
  const pending = pl.burned.filter(i => i < n && !pl.gilded.includes(i));
  const fresh: number[] = [];
  for (let i = 0; i < n; i++) if (!pl.burned.includes(i)) fresh.push(i);
  return { pending, fresh };
}

/** A set's stones: which slot of the wall each pair's stone takes (a fixed shuffle per set, so the gaps look natural). */
export function stoneSlots(n: number, seed: number): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  let s = (seed >>> 0) || 1;
  for (let i = n - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A stable small number for a set (its stones' shuffle). */
export function setSeed(key: string): number {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
