/**
 * Złote serce's content (DESIGN.md §21): the stages of the way, the gentle sets of words for "Co boli?", the player's
 * own words (kept only on this device), and the passages each moment rests on — all by passage id from the generated
 * src/content/scripture.ts, never typed.
 *
 * What the screens say (§18.3): God gathers, washes, binds up and gilds (Ps 147:3, Isa 61:1-3); the player brings the
 * broken heart and keeps attention on Him.  The light pictures attention, never grace; no promise of healing.
 */
import type { PassageId } from '../kit/scripture';

/** The way of one session, in order (MusicStage uses the same ids). */
export const STAGES = ['arrive', 'gather', 'gold', 'beat', 'radiance', 'close'] as const;
export type StageId = (typeof STAGES)[number];

/** "Co boli?" — the themed sets, own words, or the picture alone. */
export const WORD_SETS = ['heart', 'loss', 'betrayal', 'rejection', 'self'] as const;
export type WordSet = (typeof WORD_SETS)[number];
export const WORD_CHOICES = [...WORD_SETS, 'own', 'none'] as const;
export type WordChoice = (typeof WORD_CHOICES)[number];
export const isWordChoice = (v: unknown): v is WordChoice => typeof v === 'string' && (WORD_CHOICES as readonly string[]).includes(v);

/** Words in a themed set. */
export const SET_LEN = 12;
/** Own words: at most this many, each at most this long (characters). */
export const OWN_MAX = 14;
export const OWN_LEN = 24;

/** One own word, trimmed, its inner spaces collapsed, cut to OWN_LEN characters (no markup is ever made of it). */
export function cleanWord(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, OWN_LEN).join('').trim();
}

/** Own words from a saved list or a typed line (commas, semicolons or new lines between them): clean, distinct, ≤ OWN_MAX. */
export function cleanWords(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;\n]/) : [];
  const out: string[] = [];
  for (const x of raw) {
    const w = cleanWord(x);
    if (w && !out.some(o => o.toLocaleLowerCase() === w.toLocaleLowerCase())) out.push(w);
    if (out.length >= OWN_MAX) break;
  }
  return out;
}

// ── Scripture ────────────────────────────────────────────────────

/** The root (the registry's): "He heals the brokenhearted and binds up their wounds". */
export const ROOT: PassageId = 'psa147.3';

/** The passages of each moment, said in turn session by session (verseFor). */
export const VERSES = {
  /** the dark, the broken heart on the cloth: near to the brokenhearted */
  arrive: ['psa34.18', 'psa147.3'],
  /** the first piece lifted: a bruised reed He will not break */
  lift: ['isa42.3'],
  /** washing: whiter than snow, clean water, beauty instead of ashes */
  wash: ['psa51.7', 'ezk36.25', 'isa61.3'],
  /** as it comes together: the potter makes it again, treasure in jars of clay */
  join: ['jer18.4', '2co4.7'],
  /** the gold: God's love poured into our hearts; refined by fire */
  gold: ['rom5.5', '1pe1.7'],
  /** the beat: a new heart */
  beat: ['ezk36.26'],
  /** the radiance's three qualities */
  purity: ['mat5.8'],
  joy: ['jhn15.11', 'rom15.13'],
  love: ['1jn4.16', 'col3.14'],
  /** the closing card and result().verse, in turn */
  close: ['rev21.5', 'isa61.1', '2co4.7', '1pe1.7'],
} as const satisfies Record<string, readonly PassageId[]>;
export type VerseKey = keyof typeof VERSES;

/** Every passage the meditation can show (the tests check each exists in all four languages). */
export const ALL_VERSES: readonly PassageId[] = [...new Set<PassageId>([ROOT, ...Object.values(VERSES).flat()])];

/** The passage of a moment for the n-th session (1-based), and `k` more along for a second showing in it. */
export function verseFor(key: VerseKey, session: number, k = 0): PassageId {
  const list: readonly PassageId[] = VERSES[key];
  const n = Math.max(1, Math.floor(Number.isFinite(session) ? session : 1)) - 1 + Math.max(0, Math.floor(k));
  return list[n % list.length];
}

/** The radiance's three qualities, in the order they open. */
export const QUALITIES = ['purity', 'joy', 'love'] as const;
export type Quality = (typeof QUALITIES)[number];

/** What the narrator speaks about (talk.ts; the lines are in i18n.ts as `say.<moment>.<n>`). */
export const MOMENTS = [
  'arrive', 'lift', 'liftFirst', 'wash', 'lay', 'wait', 'grace', 'gold', 'goldWait', 'goldDone', 'beat', 'radiance', 'close',
] as const;
export type Moment = (typeof MOMENTS)[number];
