/**
 * Ogród o świcie's preparation (DESIGN.md §23): what the player brings into the garden, chosen in the lobby — the way
 * (which stations), and for each station its words: the feelings, the kind word, what to step back from and the week's
 * boundary, the stones, the lanterns' names, the seeds, how the dawn calls the player, and "how heavy is the heart" before.
 * Everything here stays on the device (the game's progress); own words and names never go into `result()`.
 *
 * CONTRACT (lead): builder B owns this file and fills it (the word sets in words.ts, the lobby in panel.ts); builder A's
 * meta.ts keeps `prep: GardenPrep` in the progress (fresh `freshPrep()`, migrate with `cleanPrep()`), and the session
 * reads `prepView(prep)` once at its start.  Change these shapes only through the status files.
 *
 * LEAD STUB: the shapes are final; the bodies are placeholders until builder B's version lands.
 */
import type { StationId } from './stations';

/** A word the player chose: one of a set's (`k`: its key in words.ts, shown in the page's language) or their own (`o`). */
export type Word = { k: string } | { o: string };

/** A stone: what is let go of, and whether the player is ready to let it fall today ("not yet" holds it, gently). */
export interface Stone { w: Word; ready: boolean }

/** A lantern: who it is lit for.  'me' and 'all' are always there; 'friend' names (own words); 'hurt' is optional. */
export interface Lantern { who: 'me' | 'friend' | 'hurt' | 'all'; name?: string }

export interface GardenPrep {
  v: 1;
  /** the stations chosen, in any order (stations.ts `stationsFor` orders and fits them); null: the recommended way */
  way: StationId[] | null;
  /** lzy: 1–3 feelings */
  feelings: Word[];
  /** dlon: the kind word (and the harsh one it answers, when the player picked a pair) */
  kind: { harsh: Word | null; kind: Word };
  /** furtka: what keeps reopening the wound (1–4), and the week's boundary (a set's key, or null) */
  bounds: Word[];
  intention: string | null;
  /** kamienie: 1–3 stones */
  stones: Stone[];
  /** latarnie: the people who hold the player (≤ 5 names) and whether to light one for the one who hurt them */
  friends: string[];
  hurt: boolean;
  /** nasiona: 1–3 seeds (values, strengths, what the player loves doing) */
  seeds: Word[];
  /** świt: how the dawn calls the player (own word, optional) */
  name: string;
  /** "how heavy is your heart now", 0–10, before the next session (null: not asked / skipped); the session clears it */
  before: number | null;
}

/** What the session shows: the preparation resolved to text in the page's language. */
export interface PrepView {
  feelings: string[];
  harsh: string | null;
  kind: string;
  bounds: string[];
  intention: string | null;
  stones: { text: string; ready: boolean }[];
  /** in the order they are lit: me first, the friends, the one who hurt (when chosen), all with a broken heart last */
  lanterns: { who: Lantern['who']; text: string }[];
  seeds: string[];
  name: string | null;
  before: number | null;
}

export function freshPrep(): GardenPrep {
  return {
    v: 1, way: null, feelings: [{ k: 'smutek' }], kind: { harsh: null, kind: { k: 'k1' } }, bounds: [{ k: 'wiadomosci' }],
    intention: null, stones: [{ w: { k: 'zal-osoba' }, ready: true }], friends: [], hurt: false, seeds: [{ k: 'czulosc' }],
    name: '', before: null,
  };
}

/** A saved preparation repaired in place (any field of the wrong type gets its fresh value). STUB: replace. */
export function cleanPrep(x: unknown): GardenPrep {
  const f = freshPrep();
  if (!x || typeof x !== 'object') return f;
  return { ...f, ...(x as Partial<GardenPrep>), v: 1 };
}

/** The preparation as the session shows it. STUB: placeholder words until words.ts lands. */
export function prepView(p: GardenPrep): PrepView {
  const say = (w: Word): string => ('o' in w ? w.o : w.k);
  return {
    feelings: p.feelings.map(say), harsh: p.kind.harsh ? say(p.kind.harsh) : null, kind: say(p.kind.kind),
    bounds: p.bounds.map(say), intention: p.intention, stones: p.stones.map(s => ({ text: say(s.w), ready: s.ready })),
    lanterns: [{ who: 'me', text: 'me' }, ...p.friends.map(n => ({ who: 'friend' as const, text: n })), ...(p.hurt ? [{ who: 'hurt' as const, text: 'hurt' }] : []), { who: 'all', text: 'all' }],
    seeds: p.seeds.map(say), name: p.name.trim() || null, before: p.before,
  };
}
