/**
 * What is wrong with a health library (DESIGN.md §24) — for each game's test: `expect(checkLibrary(LIBRARY)).toEqual([])`.
 * Pure, no DOM.  It checks:
 *
 *   the shape      4–6 meditations of 2–4 scenes; scene ids unique, each scene in exactly one meditation and every
 *                  scene of the record used; every world a scene names exists; every label's anchor and the growing
 *                  point inside the scene's view; perScene above 0; looks unique
 *   scripture      every meditation's verse, the root and the closers exist in all four editions (scripture.ts)
 *   the words      every key a game must give (spec.ts's header: REQUIRED_KEYS below) in all four languages, no key
 *                  in en/de/sv that pl lacks, the placeholders and plural forms of the kit's catalog check; lengths
 *                  (say.* ≤ 90, part.* ≤ 22, teach.* ≤ 220, tip.* ≤ 120, med.*.care ≤ 140)
 *   the tone       §24.3's forbidden words in each language (word-boundary regexes) and, in Polish, no gendered
 *                  second person ("zrobiłeś", "zrobiłaś", "gotowy/a", "gotowy", "gotowa") — a game may allow a
 *                  phrase with its reason (e.g. "Szkliwo nie odrasta": the myth corrected, not a promise)
 *
 * Each problem is one line: "<where>: <what>".
 */
import { LANGS, catalogProblems, type Catalog, type Lang, type Msg } from '../../../i18n';
import { SCRIPTURE, type PassageId } from '../../../content/scripture';
import type { HealthLibrary } from './spec';

/** The narrator's flavour every game gives (three lines each). */
export const GAME_MOMENTS = ['open', 'grown', 'whole', 'end'] as const;

/** The keys every game must give in all four languages (besides the ones its library implies, see requiredKeys). */
export const REQUIRED_KEYS = [
  'unit',
  'story.open.title', 'story.open.text', 'story.open2.title', 'story.open2.text', 'story.whole.text',
  'howto.goal', 'howto.tip1', 'howto.tip2', 'panel.not',
  ...GAME_MOMENTS.flatMap(m => [1, 2, 3].map(i => `say.${m}.${i}`)),
] as const;

/** Every key a library must give: the fixed ones and those of its meditations, scenes, parts and looks. */
export function requiredKeys(lib: HealthLibrary): string[] {
  const keys = new Set<string>(REQUIRED_KEYS);
  for (const m of lib.meds) for (const k of [`med.${m.id}`, `med.${m.id}.line`, `med.${m.id}.care`]) keys.add(k);
  for (const m of lib.meds) {
    for (const s of m.scenes) {
      for (const k of [`scene.${s}`, `teach.${s}`, `tip.${s}`, `say.at.${s}.1`]) keys.add(k);
      for (const lb of lib.scenes[s]?.labels ?? []) keys.add(`part.${lb.part}`);
    }
  }
  for (const l of lib.looks) keys.add(`look.${l}`);
  return [...keys];
}

/** The longest a text may be, by its key. */
export function maxLen(key: string): number | null {
  if (key.startsWith('say.')) return 90;
  if (key.startsWith('part.')) return 22;
  if (key.startsWith('teach.')) return 220;
  if (/^med\.[^.]+\.care$/.test(key)) return 140;
  if (key.startsWith('tip.')) return 120;
  return null;
}

/** Letters on neither side (JavaScript's \b knows no Polish, German or Swedish letters). */
const W = (body: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'iu');
const L = '\\p{L}*';

/** §24.3: never a promise of healing, a cure, youth regained, regrowth, and no esoteric vocabulary. */
export const FORBIDDEN: Readonly<Record<Lang, readonly { re: RegExp; what: string }[]>> = {
  pl: [
    { re: W(`ulecz${L}|uzdrowi${L}`), what: 'heal you' },
    { re: W(`wylecz${L}`), what: 'cure' },
    { re: W(`odmł[oa]d[zź]${L}|cofn${L} starzeni${L}`), what: 'reverse ageing' },
    { re: W(`odr(?:oś|os|as)${L}`), what: 'regrow' },
    { re: W(`pol${L} energ${L}`), what: 'energy field' },
    { re: W(`wibracj${L}|wibruj${L}`), what: 'vibration' },
    { re: W(`aktywuj${L}`), what: 'activate' },
    { re: W(`manifest${L}`), what: 'manifest' },
    { re: W(`detoks${L}|detox${L}`), what: 'detox' },
  ],
  en: [
    { re: W(`heal(?:s|ed)?\\s+(?:you|your|yourself)`), what: 'heal you' },
    { re: W(`cures?|cured|curing`), what: 'cure' },
    { re: W(`revers${L}\\s+(?:the\\s+)?(?:ag(?:e|eing|ing)|ageing|aging)|anti-?ag(?:e|eing|ing)|rejuvenat${L}`), what: 'reverse ageing' },
    { re: W(`regrow${L}|grows?\\s+back|grow\\s+back`), what: 'regrow' },
    { re: W(`energy\\s+fields?`), what: 'energy field' },
    { re: W(`vibration${L}|vibrat(?:e|es|ing)`), what: 'vibration' },
    { re: W(`activat(?:e|es|ed|ing)`), what: 'activate' },
    { re: W(`manifest${L}`), what: 'manifest' },
    { re: W(`detox${L}`), what: 'detox' },
  ],
  de: [
    { re: W(`heil(?:t|en|e)\\s+(?:dich|dir|deine?[nmrs]?)`), what: 'heal you' },
    { re: W(`kurier${L}`), what: 'cure' },
    { re: W(`verjüng${L}|anti-?aging`), what: 'reverse ageing' },
    { re: W(`nachwachs${L}|nachgewachsen${L}|w[aä]ch(?:s|st|sen)\\s+nach`), what: 'regrow' },
    { re: W(`energiefeld${L}`), what: 'energy field' },
    { re: W(`schwingung${L}|vibration${L}`), what: 'vibration' },
    { re: W(`aktivier${L}`), what: 'activate' },
    { re: W(`manifestier${L}`), what: 'manifest' },
    { re: W(`entgift${L}|detox${L}`), what: 'detox' },
  ],
  sv: [
    { re: W(`läk(?:er|a|te)\\s+(?:dig|din|ditt|dina)`), what: 'heal you' },
    { re: W(`bot(?:a|ar|ade)`), what: 'cure' },
    { re: W(`föryng${L}|anti-?age${L}`), what: 'reverse ageing' },
    { re: W(`växer\\s+ut\\s+igen|återväx${L}`), what: 'regrow' },
    { re: W(`energifält${L}`), what: 'energy field' },
    { re: W(`vibration${L}`), what: 'vibration' },
    { re: W(`aktiver${L}`), what: 'activate' },
    { re: W(`manifest${L}`), what: 'manifest' },
    { re: W(`avgift${L}|detox${L}`), what: 'detox' },
  ],
};

/** Polish without gendered forms of the second person (§24.3). */
export const GENDERED_PL: readonly RegExp[] = [
  W(`\\p{L}+(?:łeś|łaś)`),
  /\p{L}+\/a(?![\p{L}\p{N}])/iu,
  W('gotowy|gotowa'),
];

/** A phrase a game allows, with its reason ("Szkliwo nie odrasta": the myth corrected, not a promise). */
export interface Allowed { text: string; why: string }

const texts = (m: Msg): string[] => (typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string'));

/** The tone of a catalog: forbidden words and (Polish) the gendered second person, outside the allowed phrases. */
export function toneProblems(words: Readonly<Partial<Record<Lang, Catalog<string>>>>, allow: readonly Allowed[] = []): string[] {
  const out: string[] = [];
  for (const l of LANGS) {
    const cat = words[l];
    if (!cat) continue;
    for (const [key, m] of Object.entries(cat) as [string, Msg][]) {
      for (let s of texts(m)) {
        for (const a of allow) if (a.text) s = s.split(a.text).join(' ').replace(new RegExp(escapeRe(a.text), 'giu'), ' ');
        for (const f of FORBIDDEN[l]) {
          const hit = s.match(f.re);
          if (hit) out.push(`${l}.${key}: forbidden “${hit[0]}” (${f.what})`);
        }
        if (l === 'pl') for (const re of GENDERED_PL) {
          const hit = s.match(re);
          if (hit) out.push(`${l}.${key}: gendered second person “${hit[0]}”`);
        }
      }
    }
  }
  return out;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const inside = (v: { x: number; y: number; w: number; h: number }, p: readonly [number, number]): boolean =>
  p[0] >= v.x - 1e-9 && p[0] <= v.x + v.w + 1e-9 && p[1] >= v.y - 1e-9 && p[1] <= v.y + v.h + 1e-9;

function passageProblems(where: string, id: PassageId): string[] {
  const p = (SCRIPTURE as Readonly<Record<string, Readonly<Record<Lang, readonly [string, string]>> | undefined>>)[id];
  if (!p) return [`${where}: passage “${id}” is not in scripture.ts`];
  return LANGS.filter(l => !p[l] || !p[l][1]?.trim()).map(l => `${where}: passage “${id}” has no ${l} edition`);
}

/** The problems of a library ([] when it is fine). */
export function checkLibrary(lib: HealthLibrary, opts: { allow?: readonly Allowed[] } = {}): string[] {
  const out: string[] = [];
  // ── the shape ──
  if (!lib.id || !/^[a-z0-9]+$/.test(lib.id)) out.push(`id: “${lib.id}” is not a registry id`);
  if (lib.meds.length < 4 || lib.meds.length > 6) out.push(`meds: ${lib.meds.length} meditations (4–6)`);
  const medIds = new Set<string>();
  const seen = new Map<string, string>();
  for (const m of lib.meds) {
    if (medIds.has(m.id)) out.push(`med.${m.id}: the id is used twice`);
    medIds.add(m.id);
    if (m.scenes.length < 2 || m.scenes.length > 4) out.push(`med.${m.id}: ${m.scenes.length} scenes (2–4)`);
    for (const s of m.scenes) {
      if (seen.has(s)) out.push(`scene.${s}: in ${seen.get(s)} and ${m.id} (each scene in exactly one meditation)`);
      else seen.set(s, m.id);
      if (!lib.scenes[s]) out.push(`scene.${s}: named by ${m.id} but not in scenes`);
    }
    out.push(...passageProblems(`med.${m.id}.verse`, m.verse));
  }
  for (const s of Object.keys(lib.scenes)) if (!seen.has(s)) out.push(`scene.${s}: in no meditation`);
  for (const [s, sc] of Object.entries(lib.scenes)) {
    const w = lib.worlds[sc.world];
    if (!w) {
      out.push(`scene.${s}: world “${sc.world}” does not exist`);
      continue;
    }
    if (!(sc.view.w > 0 && sc.view.h > 0)) out.push(`scene.${s}: an empty view`);
    if (!inside(sc.view, sc.focus)) out.push(`scene.${s}: the growing point [${sc.focus.join(', ')}] is outside the view`);
    for (const g of [0, 0.5, 1]) {
      const f = w.focusAt?.(s, g);
      if (f && !inside(sc.view, f)) out.push(`scene.${s}: focusAt(${g}) [${f.map(v => Math.round(v * 10) / 10).join(', ')}] is outside the view`);
    }
    const parts = new Set<string>();
    for (const lb of sc.labels) {
      if (!inside(sc.view, lb.at)) out.push(`scene.${s}: label “${lb.part}” at [${lb.at.join(', ')}] is outside the view`);
      if (lb.from < 0 || lb.from > 1) out.push(`scene.${s}: label “${lb.part}” shows from ${lb.from} (0..1)`);
      if (parts.has(`${lb.part}|${lb.at.join(',')}`)) out.push(`scene.${s}: label “${lb.part}” twice at one place`);
      parts.add(`${lb.part}|${lb.at.join(',')}`);
    }
  }
  for (const [id, w] of Object.entries(lib.worlds)) {
    if (typeof w.bake !== 'function' || typeof w.draw !== 'function') out.push(`world.${id}: needs bake() and draw()`);
    if (!Number.isFinite(w.depth)) out.push(`world.${id}: depth is not a number`);
  }
  if (!(lib.perScene > 0)) out.push(`perScene: ${lib.perScene} (a scene grown is worth some units)`);
  if (new Set(lib.looks).size !== lib.looks.length) out.push('looks: a look is named twice');
  // ── scripture ──
  out.push(...passageProblems('root', lib.root));
  for (const c of lib.closers) out.push(...passageProblems('closers', c));
  // ── the words ──
  const words = lib.words;
  for (const l of LANGS) if (!words[l]) out.push(`words.${l}: missing`);
  if (LANGS.every(l => words[l])) {
    const pl = words.pl as Readonly<Record<string, Msg>>;
    const required = requiredKeys(lib);
    for (const key of required) {
      for (const l of LANGS) if ((words[l] as Readonly<Record<string, Msg | undefined>>)[key] === undefined) out.push(`${l}.${key}: missing (a game's key)`);
    }
    for (const l of LANGS) {
      if (l === 'pl') continue;
      for (const key of Object.keys(words[l])) if (!(key in pl)) out.push(`${l}.${key}: not in pl`);
    }
    // the kit's catalog check (every pl key in en/de/sv, placeholders, plural forms) — a required key's absence is told once, above
    const told = new Set(required.flatMap(k => LANGS.map(l => `${l}.${k}: missing`)));
    out.push(...catalogProblems(words as Readonly<Record<Lang, Catalog<string>>>).filter(p => !told.has(p)));
    const unit = pl.unit;
    if (unit !== undefined && (typeof unit === 'string' || !texts(unit).every(s => s.includes('{n}')))) out.push('pl.unit: a plural with {n} ({ one, few, many, other })');
    for (const l of LANGS) {
      for (const [key, m] of Object.entries(words[l]) as [string, Msg][]) {
        const max = maxLen(key);
        if (max === null) continue;
        for (const s of texts(m)) if (s.length > max) out.push(`${l}.${key}: ${s.length} characters (≤ ${max})`);
      }
    }
    out.push(...toneProblems(words, opts.allow));
  }
  return out;
}
