/**
 * The app's languages (DESIGN.md §10): Polish (the source of every text), English, German and
 * Swedish.  The language is settled once, when this module is first imported — from a page's pinned
 * language, `?lang=`, the saved choice, the browser's preferred languages, else English — so any
 * module may translate while it loads.  Choosing another language saves it and reloads the app.
 *
 * Texts live in catalogs next to the code that shows them.  A catalog gives every key in all four
 * languages (the compiler checks that none is missing), and `translator()` turns it into
 * `t(key, params)`: `{name}` placeholders are filled from `params`, and a text with plural forms
 * is chosen by `params.n` with the language's plural rules (Polish: one / few / many).
 */

export type Lang = 'pl' | 'en' | 'de' | 'sv';
export const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
/** each language's name in itself, for the picker */
export const LANG_NAMES: Readonly<Record<Lang, string>> = { pl: 'Polski', en: 'English', de: 'Deutsch', sv: 'Svenska' };
const LOCALES: Readonly<Record<Lang, string>> = { pl: 'pl-PL', en: 'en-GB', de: 'de-DE', sv: 'sv-SE' };
const STORE_KEY = 'brainlink.lang';

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);

/** `?lang=` (links, demos, tests), the saved choice, the browser's languages in order, else English. */
export function detectLang(search: string, stored: string | null, preferred: readonly string[]): Lang {
  const asked = new URLSearchParams(search).get('lang');
  if (isLang(asked)) return asked;
  if (isLang(stored)) return stored;
  const bases = preferred.map(l => l.toLowerCase().split('-')[0]);
  const direct = bases.find(isLang);
  if (direct) return direct;
  // Norwegian and Danish readers understand Swedish best of the four
  if (bases.some(b => b === 'nb' || b === 'nn' || b === 'no' || b === 'da')) return 'sv';
  return 'en';
}

function stored(): string | null {
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }   // a private window may refuse storage
}

const win = typeof window === 'undefined' ? null : window;
/** A page that exists in one language only pins it: `<meta name="i18n-lang" content="pl">` (the HolyHolyHoly games). */
const pinned = win?.document.querySelector<HTMLMetaElement>('meta[name="i18n-lang"]')?.content;

/** The language of this page load. */
export const lang: Lang = !win ? 'pl'
  : isLang(pinned) ? pinned
  : detectLang(win.location.search, stored(), win.navigator.languages?.length ? win.navigator.languages : [win.navigator.language]);
/** Its locale for numbers and dates. */
export const locale: string = LOCALES[lang];

/** Remember a choice; the caller reloads the app to apply it. */
export function saveLang(l: Lang): void {
  try { localStorage.setItem(STORE_KEY, l); } catch { /* no storage: the browser's language stays the guide */ }
}

// ── messages ──────────────────────────────────────────────────────

/** A text with plural forms; `other` is required, and Polish needs `one`, `few` and `many` as well. */
export interface Plural { one: string; few?: string; many?: string; other: string }
export type Msg = string | Plural;
export type Params = Readonly<Record<string, string | number>>;
export type Catalog<K extends string> = Readonly<Record<K, Msg>>;

const pluralRules = new Intl.PluralRules(locale);

/** The form of `m` for count `n` (the `other` form when there is no count). */
export function pick(m: Msg, n?: number): string {
  if (typeof m === 'string') return m;
  const form = n === undefined ? 'other' : pluralRules.select(n);
  return (m as unknown as Record<string, string | undefined>)[form] ?? m.other;
}

/** Fill `{name}` placeholders; unknown ones stay visible, so a mistake shows instead of hiding. */
export function format(s: string, params?: Params): string {
  return params ? s.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all)) : s;
}

export type Translate<K extends string> = (key: K, params?: Params) => string;

/** `t(key, params)` over a catalog given in all four languages, for this page's language. */
export function translator<K extends string>(cats: Readonly<Record<Lang, Catalog<K>>>): Translate<K> {
  const cur = cats[lang], src = cats.pl;
  return (key, params) => format(pick(cur[key] ?? src[key] ?? key, typeof params?.n === 'number' ? params.n : undefined), params);
}

// ── numbers and dates ─────────────────────────────────────────────

const numberFormats = new Map<number, Intl.NumberFormat>();

/** A number with `digits` decimals in this language's style (1,5 in Polish, German and Swedish; 1.5 in English). */
export function fmtNum(v: number, digits = 0): string {
  let f = numberFormats.get(digits);
  if (!f) {
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    numberFormats.set(digits, f);
  }
  return f.format(v);
}

/** A signed number with a real minus sign: "+1,5", "−0,3". */
export const fmtSigned = (v: number, digits = 1): string => `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v), digits)}`;

/** A date and/or time in this language's style. */
export const fmtDate = (d: Date | number, opts: Intl.DateTimeFormatOptions): string => new Date(d).toLocaleString(locale, opts);

// ── the page ──────────────────────────────────────────────────────

/**
 * Fill static texts under `root`: `data-i18n="key"` sets an element's text, and
 * `data-i18n-attr="aria-label:key title:key"` sets attributes.  Unknown keys are left alone and
 * reported, so a typo shows up in the console instead of as an empty label.
 */
export function applyTexts(root: ParentNode, t: (key: string) => string, has: (key: string) => boolean): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = el.dataset.i18n!;
    if (has(key)) el.textContent = t(key);
    else console.warn(`i18n: no text for "${key}"`);
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr!.split(/\s+/).filter(Boolean)) {
      const [attr, key] = pair.split(':');
      if (attr && key && has(key)) el.setAttribute(attr, t(key));
      else console.warn(`i18n: bad attribute text "${pair}"`);
    }
  }
}

// ── checks (for the catalogs' tests) ──────────────────────────────

const placeholders = (m: Msg): string[] =>
  [...new Set((typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string'))
    .flatMap(s => [...s.matchAll(/\{(\w+)\}/g)].map(x => x[1])))].sort();

/**
 * What is wrong with a catalog: empty texts, placeholders that differ from the Polish ones, and
 * plural texts without the forms their language needs.  An empty list means it is fine.
 */
export function catalogProblems<K extends string>(cats: Readonly<Record<Lang, Catalog<K>>>): string[] {
  const out: string[] = [];
  const need: Record<Lang, string[]> = { pl: ['one', 'few', 'many', 'other'], en: ['one', 'other'], de: ['one', 'other'], sv: ['one', 'other'] };
  for (const key of Object.keys(cats.pl) as K[]) {
    const ref = placeholders(cats.pl[key]).join(',');
    for (const l of LANGS) {
      const m: Msg | undefined = cats[l][key];
      if (m === undefined) { out.push(`${l}.${key}: missing`); continue; }
      const texts = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
      if (texts.some(s => !s.trim())) out.push(`${l}.${key}: empty`);
      if (placeholders(m).join(',') !== ref) out.push(`${l}.${key}: placeholders {${placeholders(m)}} ≠ Polish {${ref}}`);
      if (typeof m !== 'string') for (const form of need[l]) if (!(form in m)) out.push(`${l}.${key}: plural form "${form}" missing`);
      if (typeof m !== 'string' && !ref.split(',').includes('n')) out.push(`${l}.${key}: plural text without {n}`);
    }
  }
  return out;
}
