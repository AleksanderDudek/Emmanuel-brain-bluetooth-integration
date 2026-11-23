/**
 * Każda myśl's content (DESIGN.md §19): the library of common negative thoughts — eight areas of life, seven
 * thoughts each — with each thought's emotion mix (fear, sadness, anger), its thinking pattern (the plain names of
 * the classic CBT distortions) and the passage its true word rests on; the emotions' colours and how a mix blends;
 * the player's own thoughts (plain text, kept only on the device); the passages of the moments; the narrator's
 * moments.  Words live in i18n.ts (keys only here: `th.<id>` the thought, `tw.<id>` its true word); passages only
 * by id (src/content/scripture.ts).
 *
 * The library is written for this game (no questionnaire's items): everyday first-person words, gender-neutral in
 * Polish (present tense, no "-łem/-łam", no "sam/sama").  It holds no thought of self-harm, suicide, abuse or
 * trauma detail, and none of the phrasings known as risk markers ("I am a burden", "nobody would notice") — the
 * game is attention and imagination training for everyday weights, not therapy (DESIGN §13.3, §18.3).
 */
import type { PassageId } from '../kit/scripture';

// ── the emotions ─────────────────────────────────────────────────

export const EMOS = ['fear', 'sadness', 'anger'] as const;
export type Emo = (typeof EMOS)[number];
/** How much of each emotion a thought carries: [fear, sadness, anger], summing to 1. */
export type Mix = readonly [number, number, number];

/**
 * The emotions' colours: fear a cold violet-blue, sadness a slate grey-blue, anger a red-orange.  `ink` is the
 * colour's deep tone (the paper's stain, the charring), `ember` its bright tone (the burning edge).
 */
export const EMO: Readonly<Record<Emo, { color: string; ember: string; ink: string }>> = {
  fear: { color: '#8b84ff', ember: '#b9b2ff', ink: '#3a3478' },
  sadness: { color: '#7f97b8', ember: '#b8cbe4', ink: '#33435c' },
  anger: { color: '#ff6a3a', ember: '#ffb070', ink: '#7a2a14' },
};

/** A mix made whole (non-negative, summing to 1; nothing at all: an even mix). */
export function normMix(m: readonly number[]): Mix {
  const v = [0, 1, 2].map(i => Math.max(0, Number.isFinite(m[i]) ? m[i] : 0));
  const s = v[0] + v[1] + v[2];
  if (s <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [v[0] / s, v[1] / s, v[2] / s];
}

/** The emotions of a mix, the strongest first. */
export function ranked(m: Mix): Emo[] {
  return [...EMOS].sort((a, b) => m[EMOS.indexOf(b)] - m[EMOS.indexOf(a)] || EMOS.indexOf(a) - EMOS.indexOf(b));
}

/** The strongest emotion of a mix. */
export const dominant = (m: Mix): Emo => ranked(m)[0];

/** A mixture: the second emotion carries at least this share. */
export const MIXED_AT = 0.35;
export const isMixed = (m: Mix): boolean => m[EMOS.indexOf(ranked(m)[1])] >= MIXED_AT;

/** The emotions a thought is named by on screen: the strongest, and the second when it is a mixture. */
export const namedEmos = (m: Mix): Emo[] => (isMixed(m) ? ranked(m).slice(0, 2) : [dominant(m)]);

const hex = (c: string): [number, number, number] => {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;

/** A mix's colour: the emotions' colours blended by their shares (in linear light, so the blend stays bright). */
export function blend(m: Mix, tone: 'color' | 'ember' | 'ink' = 'color'): string {
  const lin = (c: number) => (c / 255) ** 2.2;
  const out = [0, 0, 0];
  EMOS.forEach((e, i) => {
    const c = hex(EMO[e][tone]);
    for (let k = 0; k < 3; k++) out[k] += m[i] * lin(c[k]);
  });
  return toHex(...(out.map(v => 255 * v ** (1 / 2.2)) as [number, number, number]));
}

/** The two tones of a thought's flame: its two strongest emotions' embers (one emotion: its own, twice). */
export function flameTones(m: Mix): [string, string] {
  const [a, b] = ranked(m);
  return [EMO[a].ember, EMO[isMixed(m) ? b : a].ember];
}

// ── the thinking patterns ────────────────────────────────────────

/**
 * The patterns of an automatic thought (Beck's cognitive distortions, in plain words on screen): the worst case,
 * reading minds, telling the future, a label, "must", all or nothing, always and never, "I feel it so it is true",
 * "it is all on me".
 */
export const PATTERNS = ['catastrophe', 'mindread', 'fortune', 'label', 'should', 'allnone', 'overgen', 'feeling', 'personal'] as const;
export type Pattern = (typeof PATTERNS)[number];

// ── the areas of life ────────────────────────────────────────────

export const AREAS = ['health', 'work', 'close', 'future', 'past', 'self', 'alone', 'world'] as const;
export type AreaId = (typeof AREAS)[number];

// ── the library ──────────────────────────────────────────────────

export interface ThoughtDef {
  /** "<area>.<name>": the i18n keys are `th.<id>` (the thought) and `tw.<id>` (its true word) */
  id: string;
  area: AreaId;
  mix: Mix;
  pattern: Pattern;
  /** the passage the true word rests on (the rest shows it now and then) */
  verse: PassageId;
}

const T = (id: string, mix: [number, number, number], pattern: Pattern, verse: PassageId): ThoughtDef =>
  ({ id, area: id.split('.')[0] as AreaId, mix: normMix(mix), pattern, verse });

/** Fifty-six thoughts: eight areas × seven, each emotion leading in about a third, mixtures among them. */
export const LIBRARY: readonly ThoughtDef[] = [
  // zdrowie
  T('health.serious', [0.9, 0.1, 0], 'catastrophe', '1pe5.7'),
  T('health.never', [0.3, 0.7, 0], 'fortune', 'psa147.3'),
  T('health.pain', [0.4, 0.5, 0.1], 'overgen', 'isa43.2'),
  T('health.whyme', [0, 0.4, 0.6], 'personal', 'mat11.28'),
  T('health.strength', [0.1, 0.8, 0.1], 'allnone', 'isa41.10'),
  T('health.doctors', [0.3, 0, 0.7], 'overgen', 'jas1.19'),
  T('health.body', [0.2, 0.4, 0.4], 'label', 'psa139.12'),
  // praca i pieniądze
  T('work.lose', [0.9, 0.1, 0], 'catastrophe', 'mat6.34'),
  T('work.money', [0.8, 0.2, 0], 'fortune', 'php4.6'),
  T('work.boss', [0.6, 0.4, 0], 'mindread', 'isa41.10'),
  T('work.credit', [0, 0.2, 0.8], 'fortune', 'rom12.21'),
  T('work.better', [0.1, 0.6, 0.3], 'allnone', 'rom12.2'),
  T('work.mistake', [0.6, 0, 0.4], 'should', '2ti1.7'),
  T('work.unfair', [0, 0.3, 0.7], 'overgen', 'mat11.28'),
  // bliscy
  T('close.understand', [0, 0.7, 0.3], 'overgen', 'psa34.18'),
  T('close.fight', [0.5, 0.1, 0.4], 'fortune', 'jas1.19'),
  T('close.listen', [0, 0.3, 0.7], 'overgen', 'pro16.32'),
  T('close.fault', [0.3, 0.6, 0.1], 'personal', 'rom8.1'),
  T('close.distant', [0.4, 0.6, 0], 'fortune', 'psa147.3'),
  T('close.forgive', [0, 0.2, 0.8], 'allnone', 'col3.15'),
  T('close.talk', [0.5, 0.1, 0.4], 'mindread', 'jhn14.27'),
  // przyszłość
  T('future.cant', [0.7, 0.3, 0], 'fortune', 'isa41.10'),
  T('future.wrong', [0.8, 0.2, 0], 'catastrophe', 'jhn16.33'),
  T('future.whatif', [0.9, 0.1, 0], 'catastrophe', 'isa26.3'),
  T('future.late', [0, 0.7, 0.3], 'fortune', 'rom12.2'),
  T('future.uncertain', [0.7, 0, 0.3], 'feeling', 'php4.7'),
  T('future.same', [0, 0.6, 0.4], 'overgen', 'mat6.34'),
  T('future.easier', [0, 0.4, 0.6], 'allnone', 'psa94.19'),
  // przeszłość i żal
  T('past.years', [0, 0.8, 0.2], 'allnone', 'isa61.3'),
  T('past.mistake', [0.3, 0.5, 0.2], 'overgen', 'rom8.1'),
  T('past.deserve', [0.4, 0.6, 0], 'label', 'psa147.3'),
  T('past.should', [0, 0.4, 0.6], 'should', 'isa43.2'),
  T('past.self', [0, 0.4, 0.6], 'allnone', 'rom8.1'),
  T('past.decision', [0.2, 0.3, 0.5], 'overgen', 'rom12.2'),
  T('past.gone', [0.2, 0.8, 0], 'overgen', 'isa61.3'),
  // samoocena
  T('self.useless', [0, 0.7, 0.3], 'label', 'psa139.12'),
  T('self.ruin', [0, 0.4, 0.6], 'overgen', 'rom8.1'),
  T('self.please', [0.6, 0.2, 0.2], 'should', 'mat11.28'),
  T('self.others', [0.2, 0.6, 0.2], 'allnone', 'rom12.2'),
  T('self.known', [0.7, 0.3, 0], 'mindread', 'jhn14.27'),
  T('self.nothing', [0, 0.6, 0.4], 'overgen', 'isa61.3'),
  T('self.temper', [0, 0.3, 0.7], 'label', 'pro16.32'),
  // samotność i strata
  T('alone.nobody', [0.2, 0.8, 0], 'allnone', 'psa34.18'),
  T('alone.last', [0, 0.6, 0.4], 'overgen', 'psa139.12'),
  T('alone.without', [0.2, 0.8, 0], 'feeling', 'psa147.3'),
  T('alone.forgot', [0, 0.6, 0.4], 'mindread', 'isa41.10'),
  T('alone.wave', [0.2, 0.8, 0], 'fortune', 'jhn16.33'),
  T('alone.us', [0, 0.4, 0.6], 'personal', 'psa34.18'),
  T('alone.evening', [0.6, 0.4, 0], 'fortune', 'jhn8.12'),
  // świat i sens
  T('world.disaster', [0.8, 0.2, 0], 'catastrophe', 'jhn16.33'),
  T('world.people', [0, 0.3, 0.7], 'label', 'rom12.21'),
  T('world.god', [0.3, 0.7, 0], 'feeling', 'isa41.10'),
  T('world.prayer', [0.2, 0.5, 0.3], 'allnone', 'php4.6'),
  T('world.helpless', [0.5, 0.3, 0.2], 'allnone', 'mal3.3'),
  T('world.rage', [0, 0.1, 0.9], 'feeling', 'eph4.26'),
  T('world.news', [0.7, 0, 0.3], 'overgen', 'isa26.3'),
];

export const thoughtById = (id: string): ThoughtDef | undefined => LIBRARY.find(d => d.id === id);

// ── what the player chooses ──────────────────────────────────────

/** What weighs today: one family, the mixtures, or "I do not know" (all of them). */
export const CHOICES = ['unknown', 'fear', 'sadness', 'anger', 'mixed'] as const;
export type EmoChoice = (typeof CHOICES)[number];

/** Whether a mix answers a choice: its share of that emotion is at least MIXED_AT (or it is a mixture; or anything). */
export function fits(m: Mix, c: EmoChoice): boolean {
  if (c === 'unknown') return true;
  if (c === 'mixed') return isMixed(m);
  return m[EMOS.indexOf(c)] >= MIXED_AT;
}

// ── the player's own thoughts ────────────────────────────────────

/** An own thought's emotion: one family, or "mixed" (an even blend of all three). */
export const OWN_EMOS = ['fear', 'sadness', 'anger', 'mixed'] as const;
export type OwnEmo = (typeof OWN_EMOS)[number];
export interface OwnThought { text: string; emo: OwnEmo }

/** At most this many own thoughts, each at most this many characters. */
export const OWN_MAX = 8;
export const OWN_CHARS = 80;
/** A library thought is at most this long in every language (the tests hold it). */
export const THOUGHT_CHARS = 60;

export const ownMix = (e: OwnEmo): Mix => (e === 'fear' ? [1, 0, 0] : e === 'sadness' ? [0, 1, 0] : e === 'anger' ? [0, 0, 1] : [1 / 3, 1 / 3, 1 / 3]);

/**
 * An own thought as kept: plain text — no markup, no control characters, single spaces, at most OWN_CHARS characters.
 * (It is drawn on the canvas and set as text in the card, never as markup.)
 */
export function cleanText(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, OWN_CHARS).join('').trim();
}

export function cleanOwn(v: unknown): OwnThought | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const text = cleanText(o.text);
  if (!text) return null;
  const emo = (OWN_EMOS as readonly unknown[]).includes(o.emo) ? (o.emo as OwnEmo) : 'mixed';
  return { text, emo };
}

/** A saved list of own thoughts, cleaned: valid ones, no two alike, at most OWN_MAX. */
export function cleanOwnList(v: unknown): OwnThought[] {
  if (!Array.isArray(v)) return [];
  const out: OwnThought[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const o = cleanOwn(x);
    if (!o || seen.has(o.text.toLocaleLowerCase())) continue;
    seen.add(o.text.toLocaleLowerCase());
    out.push(o);
    if (out.length >= OWN_MAX) break;
  }
  return out;
}

/**
 * Words that ask for a human, not a game (self-harm, suicide), in the four languages: an own thought that holds one
 * brings the help line forward in the lobby's card — it never blocks or judges.
 */
export const CARE_WORDS = /samob[oó]j|zabi[cćj]\w* si|skończyć ze sobą|nie chcę (już )?żyć|zrobi\w* sobie krzywd|okalecz|suicid|kill (my)?self|end (it all|my life)|hurt myself|self[- ]harm|want to die|selbstmord|suizid|umbringen|nicht mehr leben|mir (etwas )?antun|självmord|ta livet av|skada mig själv|vill inte leva|vill dö/i;
export const needsCare = (text: string): boolean => CARE_WORDS.test(text);

// ── the passages ─────────────────────────────────────────────────

/** The root: "we take captive every thought to make it obedient to Christ". */
export const ROOT_VERSE: PassageId = '2co10.5';
/** The picture of the whole game: beauty for ashes. */
export const ASHES_VERSE: PassageId = 'isa61.3';

/** An own thought's true word rests on these, by its emotion (in turn). */
export const OWN_VERSES: Readonly<Record<OwnEmo, readonly PassageId[]>> = {
  fear: ['isa41.10', 'jhn14.27', '2ti1.7'],
  sadness: ['psa34.18', 'psa147.3', 'mat11.28'],
  anger: ['eph4.26', 'jas1.19', 'rom12.21'],
  mixed: ['1pe5.7', 'php4.7', 'psa94.19'],
};
/** How many generic true words each own emotion has (i18n `own.<emo>.<1..n>`). */
export const OWN_WORDS = 3;

/** The rest after a push that could not finish (the valve), and the quiet stretch: their passages, in turn. */
export const VALVE_VERSES: readonly PassageId[] = ['mat11.28', 'psa56.3', 'isa26.3'];
export const QUIET_VERSES: readonly PassageId[] = ['jhn8.12', 'col3.15', 'php4.7'];
/** The closing card's passage, in turn session by session (short ones: the card shares a phone with the 0–10 row). */
export const CLOSE_VERSES: readonly PassageId[] = ['php4.7', 'isa26.3', 'jhn14.27'];

// ── the voice ────────────────────────────────────────────────────

/** The narrator's moments (three lines each in every language, i18n `say.<moment>.<1..3>`). */
export const MOMENTS = [
  'open', 'settle', 'first', 'own', 'mixed', 'burned', 'rest', 'quiet', 'end', 'blind', 'blindEnd', 'nosignal', 'valve', 'good', 'wait', 'skip',
] as const;
export type Moment = (typeof MOMENTS)[number];
export const LINE_COUNT = 3;

/** The strategies for the head in a push (`signal().task`): imagery and slow words, never "concentrate harder". */
export const TIPS = {
  settle: 'tip.settle',
  burn: ['tip.burn.1', 'tip.burn.2', 'tip.burn.3', 'tip.burn.4'],
  quiet: ['tip.quiet.1', 'tip.quiet.2'],
  blind: ['tip.blind.1', 'tip.blind.2'],
  rest: ['tip.rest.1', 'tip.rest.2'],
} as const;
