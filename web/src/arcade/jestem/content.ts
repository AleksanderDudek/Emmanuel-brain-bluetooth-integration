/**
 * Ja jestem…'s content (DESIGN §13.8): the eighteen declarations — each a word (Polish in the speaker's
 * form), a picture (scenes.ts, pictures.ts), the verse it stands on, and the colours of its aura — the
 * strategies the block asks for, and Hanna's moments.  The words themselves live in i18n.ts.
 *
 * A declaration is a statement of identity in Christ, shown with the verse that says it (§13.3); the
 * game never promises that saying it makes anything happen, and the album keeps declarations, not results.
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';
import { DECL_ORDER, SCENES, isDecl, type DeclId } from './scenes';

export { DECL_ORDER, isDecl, type DeclId };

/** The speaker's form in Polish (the other languages have one form). */
export type Form = 'm' | 'f';

export interface Decl {
  id: DeclId;
  /** the passage the declaration stands on */
  verse: PassageId;
  /** the aura's light (r, g, b) and the gold of its rays */
  aura: readonly [number, number, number];
  ray: readonly [number, number, number];
}

const d = (id: DeclId, verse: PassageId, aura: [number, number, number], ray: [number, number, number] = [255, 226, 150]): Decl => ({ id, verse, aura, ray });

export const DECLS: Readonly<Record<DeclId, Decl>> = {
  kochany: d('kochany', 'jer31.3', [255, 196, 168], [255, 214, 170]),
  zdrowy: d('zdrowy', 'jer33.6', [255, 214, 146]),
  silny: d('silny', 'php4.13', [236, 240, 255], [255, 236, 190]),
  szczesliwy: d('szczesliwy', 'jhn15.11', [255, 206, 128]),
  spokojny: d('spokojny', 'jhn14.27', [236, 220, 255], [255, 228, 196]),
  wolny: d('wolny', 'jhn8.36', [204, 232, 255], [255, 240, 200]),
  dziecko: d('dziecko', 'jhn1.12', [255, 232, 160]),
  bogaty: d('bogaty', '2co8.9', [255, 200, 116], [255, 214, 130]),
  odwazny: d('odwazny', '2ti1.7', [190, 240, 232], [255, 230, 170]),
  bezpieczny: d('bezpieczny', 'pro18.10', [255, 210, 146]),
  swiatlo: d('swiatlo', 'eph5.8', [255, 224, 140], [255, 232, 160]),
  blogoslawiony: d('blogoslawiony', 'eph1.3', [240, 244, 210], [255, 240, 190]),
  wybrany: d('wybrany', 'col3.12', [255, 196, 136]),
  uzdrowiony: d('uzdrowiony', 'isa53.5', [214, 255, 190], [255, 240, 180]),
  nowy: d('nowy', 'eph4.24', [206, 255, 176], [255, 240, 170]),
  oczyszczony: d('oczyszczony', '1jn1.9', [214, 246, 255], [255, 248, 220]),
  madry: d('madry', 'pro2.6', [255, 214, 150]),
  zwyciezca: d('zwyciezca', 'rom8.37', [255, 206, 160], [255, 222, 160]),
};

/** The root passage of the game, and an own vision's verse (Philippians 4:13: "I can do all things…"). */
export const ROOT: PassageId = 'php2.9-10';
export const OWN_VERSE: PassageId = 'php4.13';
export const OWN_AURA: readonly [number, number, number] = [255, 222, 160];

/** The declaration's word in the page's language (Polish: the speaker's form; masculine until the player says). */
export const declWord = (id: DeclId, form: Form | null): string => t(`word.${id}.${form ?? 'm'}` as Key);

/** A declaration that shows the Polish form (a noun — "dzieckiem Bożym" — reads the same in both: then "silny"). */
export const formSample = (id: DeclId | null): DeclId => (id && declWord(id, 'm') !== declWord(id, 'f') ? id : 'silny');

/** "Przez potężne imię Jezusa ja jestem silny." */
export const sentence = (word: string): string => t('sentence', { word });

/** "jestem silny" — the album's and the picker's label. */
export const label = (word: string): string => t('label', { word });

/** A fragment's name ("Słońce"); an own picture's fragments are numbered ("Część 2 z 5"). */
export function fragName(key: string, n = 0, all = 0): string {
  if (key.startsWith('part')) return t('frag.part', { n, all });
  return t(`frag.${key}` as Key);
}

export const sceneText = (id: DeclId): string => t(`scene.${id}` as Key);

/** Every fragment key a picture may name (the tests check each has a name). */
export const FRAG_KEYS: readonly string[] = [...new Set(Object.values(SCENES).flatMap(s => s.regions.map(r => r.key)))];

// ── the strategies (DESIGN §13.1: the picture is the strategy) ────────────────────────────
/**
 * A push block's strategy: the declaration's own picture first, then imagery, recall and one counting
 * strategy in turn (about a third of people picture weakly; §13.1).
 */
export const PUSH_TIPS: readonly Key[] = ['tip.push.1', 'tip.push.2', 'tip.push.4', 'tip.push.3', 'tip.push.5'];
export const BLIND_TIPS: readonly Key[] = ['tip.blind.1', 'tip.blind.2', 'tip.blind.3'];
export const REST_TIPS: readonly Key[] = ['tip.rest.1', 'tip.rest.2', 'tip.rest.3'];
export const LIGHT_TIPS: readonly Key[] = ['tip.light.1', 'tip.light.2'];

// ── Hanna's moments ──────────────────────────────────────────────
export type Moment =
  | 'warm' | 'push' | 'rest' | 'blind' | 'dawn' | 'first' | 'lit' | 'fragment' | 'half' | 'last' | 'complete'
  | 'good' | 'pick' | 'finale' | 'grace' | 'light' | 'glow' | 'ring' | 'ray';

export const MOMENTS: readonly Moment[] = [
  'warm', 'push', 'rest', 'blind', 'dawn', 'first', 'lit', 'fragment', 'half', 'last', 'complete',
  'good', 'pick', 'finale', 'grace', 'light', 'glow', 'ring', 'ray',
];

/** Every line of every moment, in the page's language. */
export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(MOMENTS.map(m => {
  const out: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const k = `say.${m}.${i}` as Key;
    const s = t(k);
    if (s === k) break;
    out.push(s);
  }
  return [m, out];
})) as Record<Moment, string[]>;

export const LINE_COUNT = MOMENTS.reduce((s, m) => s + LINES[m].length, 0);

/** An own word's length limit (characters). */
export const WORD_MAX = 24;

/** The own word, as plain text: controls stripped, spaces folded, at most 24 characters. */
export function cleanWord(s: unknown): string {
  if (typeof s !== 'string') return '';
  return [...s.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, WORD_MAX).join('').trim();
}
