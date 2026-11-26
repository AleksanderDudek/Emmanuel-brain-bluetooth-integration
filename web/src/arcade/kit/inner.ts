/**
 * "Ciało słucha" — the body listens (DESIGN.md §27, round 23): the inner layer of the health visualisations.
 *
 * The founder asked (2026-11-26) that the health meditations work so that they "activate, increase and strengthen the
 * processes of healing, regeneration and making the body younger, stronger, fitter, more beautiful, rested, happy",
 * using subconscious processes to help the body.  What research says reaches the body from the mind — and what the
 * meditations now do on purpose (the sources: <scratch>/research-23.md, the Wiedza section `#wiedza/body`):
 *
 *   calm            stress slows wound healing and calm supports it; slow breathing (6 a minute) raises vagal tone
 *                   → every rest is a guided relaxation, and the band's calm decides how deep the word goes
 *   the word        repeated, short, present-tense, believable words (believable: unbelievable affirmations backfire)
 *                   said on the out-breath in a relaxed state — the oldest form of suggestion
 *                   → "Słowo na wydech": each rest's out-breaths carry one word for the body, repeated
 *   expectation     what we expect of the body changes it (mindset, open-label placebo: honest and still working)
 *                   → the words say what the body truly does, so expecting it is simply true
 *   imagery         imagined movement strengthens muscle; vivid imagery felt from inside works best
 *                   → the push's picture (unchanged) and a new "feel it" tip: from inside, with warmth and movement
 *   a cue           a word paired with deep calm brings calm back later (cue-controlled relaxation)
 *                   → "Słowo pokoju": the last out-breath of each rest is the player's word (Pokój, Abba, Jezus…)
 *   sleep           most repair runs in deep sleep
 *                   → "Przed snem": darker, warmer, quieter, words about the night, an ending that lets sleep come
 *
 * Never a promise (§24.3 holds): no word claims that focus or imagination heals, cures, rejuvenates or regrows; the
 * words support what the body really does and thank God for it.  Polish second person without gendered forms.
 *
 * This file is the contract (the lead's).  It holds the player's choices (shared by every health visualisation,
 * kept on this device only), the words' keys and the order the rests draw them in.  The engine
 * (kit/healthlib) and Każdy włos (wlosy) draw them; kit/inner-i18n.ts holds the generic words in pl/en/de/sv.
 *
 * Keys a health game's catalog must give (each library, all four languages; checkLibrary enforces them):
 *   word.<med>.1, word.<med>.2, word.<med>.3     three words for the body per meditation (≤ 80 characters each):
 *                                                present tense, second person, kind, true to that meditation's
 *                                                physiology and believable ("Każdej nocy Twoje komórki sprzątają
 *                                                i naprawiają."), never a promise or a command to an organ
 *
 * Keys of the inner catalog (kit/inner-i18n.ts, ENGINE-like, pl/en/de/sv):
 *   inner.*            the lobby section's words (title, lead, notes, the Wiedza link)
 *   intent.<i>         an intention's chip; intent.<i>.1–3 its three words for the body (same rules as word.*)
 *   cue.<c>            the cue words (Pokój / Peace / Friede / Frid; Abba; Jezus; Maranatha)
 *   settle.1–3         the settling-in rest's words (autogenic: heavy and warm, the breath by itself, a calm heart)
 *   settle.night.1–3   the same before sleep
 *   night.1–6          words about the night's work (true and generic: deep sleep's repair, the day let go)
 *   hud.cue, hud.settle, hud.night                 small labels in the words band
 *   story.body.*       the first session's third page (why: calm, the word and sleep reach the body; honestly)
 *   story.inner.*      a returning player's one-time card introducing the layer
 *   say.night.1–3, say.settle.1–3                  the narrator before sleep / settling in
 *   hl.received, hl.night, finale.cue, finale.night   the summary's highlights and the finale's line
 */

/** What the player wishes the body (up to three; their words join the meditation's in the rests). */
export const INTENTS = ['heal', 'renew', 'young', 'strong', 'fit', 'beauty', 'rest', 'joy'] as const;
export type Intent = (typeof INTENTS)[number];
export const MAX_INTENTS = 3;

/** The word of peace said on each rest's last out-breath (cue-controlled relaxation); 'own' is the player's. */
export const CUES = ['peace', 'abba', 'jesus', 'maranatha', 'own'] as const;
export type Cue = (typeof CUES)[number];

export const OWN_MAX = 80;
export const CUE_OWN_MAX = 20;

export interface InnerPrefs {
  v: 1;
  /** "Słowo na wydech": rests carry words for the body (else the meditation's verse, as before) */
  words: boolean;
  /** up to MAX_INTENTS, in the order chosen */
  intents: Intent[];
  /** the player's own sentence ('' none) — on this device only, never in a result */
  own: string;
  cue: Cue;
  /** the player's own cue word when cue === 'own' */
  cueOwn: string;
  /** "Przed snem": darker and warmer, quieter, the night's words, an ending that lets sleep come */
  night: boolean;
}

export const freshInner = (): InnerPrefs => ({ v: 1, words: true, intents: [], own: '', cue: 'peace', cueOwn: '', night: false });

const oneLine = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Repair anything (a save from another version, garbage) into valid prefs. */
export function cleanInner(raw: unknown): InnerPrefs {
  const p = freshInner();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Record<string, unknown>;
  if (typeof r.words === 'boolean') p.words = r.words;
  if (Array.isArray(r.intents)) {
    p.intents = [...new Set(r.intents.filter((i): i is Intent => (INTENTS as readonly unknown[]).includes(i)))].slice(0, MAX_INTENTS);
  }
  p.own = oneLine(r.own, OWN_MAX);
  if ((CUES as readonly unknown[]).includes(r.cue)) p.cue = r.cue as Cue;
  p.cueOwn = oneLine(r.cueOwn, CUE_OWN_MAX);
  if (p.cue === 'own' && !p.cueOwn) p.cue = 'peace';
  if (typeof r.night === 'boolean') p.night = r.night;
  return p;
}

/** Toggle an intention (a chip): on → appended (the oldest drops past MAX_INTENTS), off → removed. */
export function toggleIntent(p: InnerPrefs, i: Intent): void {
  const at = p.intents.indexOf(i);
  if (at >= 0) p.intents.splice(at, 1);
  else {
    p.intents.push(i);
    while (p.intents.length > MAX_INTENTS) p.intents.shift();
  }
}

// ── the store: one record for every health visualisation, on this device ────────────────────────────────────────
const KEY = 'emmanuel.inner.v1';
let memo: InnerPrefs | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** The player's inner prefs (shared by all health visualisations). */
export function loadInner(): InnerPrefs {
  if (memo) return { ...memo, intents: [...memo.intents] };
  let raw: unknown = null;
  try {
    const s = storage()?.getItem(KEY);
    raw = s ? JSON.parse(s) : null;
  } catch {
    raw = null;
  }
  memo = cleanInner(raw);
  return { ...memo, intents: [...memo.intents] };
}

export function saveInner(p: InnerPrefs): void {
  memo = cleanInner(p);
  try {
    storage()?.setItem(KEY, JSON.stringify(memo));
  } catch {
    /* private mode or full: kept for this page load */
  }
}

/** Tests: forget the page's copy (the next load reads the storage again). */
export function resetInnerMemo(): void {
  memo = null;
}

// ── what a rest shows, out-breath by out-breath ───────────────────────────────────────────────────────────────────

/** Where a word comes from (the tests and the summary read it). */
export type WordFrom = 'med' | 'intent' | 'own' | 'night';

/**
 * What one breath of a rest shows in the words band (the out-breath carries it; the in-breath keeps it dim):
 *   verse    the meditation's verse (as before round 23; also when "Słowo na wydech" is off)
 *   word     a word for the body
 *   cue      the word of peace (the rest's last breath)
 *   settle   the settling-in rest's words
 */
export type InnerShow =
  | { kind: 'verse' }
  | { kind: 'word'; text: string; from: WordFrom }
  | { kind: 'cue'; text: string }
  | { kind: 'settle'; text: string };

/** The words a session draws from (resolved in the page's language by the engine). */
export interface InnerSource {
  /** a meditation's three words (word.<med>.1–3), [] when the game has none */
  med(med: string): readonly string[];
  /** an intention's three words (intent.<i>.1–3) */
  intent(i: Intent): readonly string[];
  /** night.1–6 */
  night(): readonly string[];
  /** settle.1–3 or settle.night.1–3 */
  settle(night: boolean): readonly string[];
  /** the cue word's text (the player's own when cue === 'own') */
  cue(): string;
}

/**
 * The session's order of words: a meditation's own word, then one of the player's (an intention's, their own
 * sentence, the night's), then the meditation's next, … — each source in turn, each list in turn, so a word comes
 * back only after its companions.  One InnerWords per session.
 */
export class InnerWords {
  private readonly medAt = new Map<string, number>();
  private readonly listAt = new Map<string, number>();
  private extraTurn = 0;
  private medTurn = true;
  /** the meditations whose verse was shown this session (each opens once with it) */
  private readonly versed = new Set<string>();

  constructor(readonly prefs: InnerPrefs, private readonly src: InnerSource) {}

  /** The player's sources besides the meditation, in their turn order. */
  private extras(): { key: string; from: WordFrom; list: readonly string[] }[] {
    const out: { key: string; from: WordFrom; list: readonly string[] }[] = [];
    if (this.prefs.night) out.push({ key: 'night', from: 'night', list: this.src.night() });
    for (const i of this.prefs.intents) out.push({ key: `intent.${i}`, from: 'intent', list: this.src.intent(i) });
    if (this.prefs.own) out.push({ key: 'own', from: 'own', list: [this.prefs.own] });
    return out.filter(e => e.list.length > 0);
  }

  private nextOf(key: string, list: readonly string[]): string {
    const i = this.listAt.get(key) ?? 0;
    this.listAt.set(key, i + 1);
    return list[i % list.length];
  }

  /** The next word for a rest in meditation `med`. */
  next(med: string): { text: string; from: WordFrom } | null {
    const own = this.src.med(med);
    const extras = this.extras();
    const useMed = own.length > 0 && (this.medTurn || !extras.length);
    this.medTurn = !this.medTurn;
    if (useMed) {
      const i = this.medAt.get(med) ?? 0;
      this.medAt.set(med, i + 1);
      return { text: own[i % own.length], from: 'med' };
    }
    if (!extras.length) return null;
    // the player's sources in turn (the night first when it is on: it is what the evening is for)
    const e = extras[this.extraTurn++ % extras.length];
    return { text: this.nextOf(e.key, e.list), from: e.from };
  }

  /**
   * What each of a rest's `breaths` shows.  A settling-in rest: its words in order.  Words off: the verse.  The first
   * rest in a meditation this session: its verse (the meditation's root in Scripture), then the cue.  Any other rest:
   * one word repeated on every out-breath but the last, then the cue.  A one-breath rest has no cue.
   */
  rest(med: string, breaths: number, settle = false): InnerShow[] {
    const n = Math.max(1, Math.round(breaths));
    if (settle) {
      const s = this.src.settle(this.prefs.night);
      return Array.from({ length: n }, (_, i) => (s.length ? { kind: 'settle' as const, text: s[i % s.length] } : { kind: 'verse' as const }));
    }
    if (!this.prefs.words) return Array.from({ length: n }, () => ({ kind: 'verse' as const }));
    const cue = this.src.cue();
    const tail: InnerShow[] = n >= 2 && cue ? [{ kind: 'cue', text: cue }] : [];
    const body = n - tail.length;
    if (!this.versed.has(med)) {
      this.versed.add(med);
      return [...Array.from({ length: body }, () => ({ kind: 'verse' as const })), ...tail];
    }
    const w = this.next(med);
    if (!w) return [...Array.from({ length: body }, () => ({ kind: 'verse' as const })), ...tail];
    return [...Array.from({ length: body }, () => ({ kind: 'word' as const, text: w.text, from: w.from })), ...tail];
  }
}

/** A breath "received" a word: its out-breath held calm at least this much (the band's calm, 0..1). */
export const RECEIVED_CALM = 0.5;

/** The settling-in rest: its breaths, and the shortest session that opens with it (s). */
export const SETTLE = { breaths: 2, fromSec: 180 } as const;

/** "Przed snem": how the picture dims and warms, how the sound goes quiet (the engines read these). */
export const NIGHT = {
  /** a dark veil over the picture (alpha) and a warm amber wash (alpha, multiply) — less blue light at bedtime */
  veil: 0.28,
  warm: 0.16,
  /** the sound's level ×, and how long before the end it fades to silence (s) */
  level: 0.7,
  fadeSec: 25,
} as const;
