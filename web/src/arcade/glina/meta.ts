/**
 * What Glina remembers between sessions and the pure rules of its meta game: the street's three
 * households and their stories, the Book of Vessels (a page per form with the best vessel and its
 * marks), the street's everyday items, kiln gifts with published odds and pity, the date-seeded
 * form of the day, the day's gift (the same for everyone who comes), glazes, and the dates behind
 * the welcome back.  No DOM; randomness only from the caller's generator.
 */
import { mulberry32 } from '../../core/random';
import { CLAY, RINGS, U } from './clay';
import {
  DAY_GIFTS, FORM, FORMS, GIFT_GLAZE, GIFT_ODDS, GLAZES, HOUSES, PITY_GIFT, PITY_MOON, START_GLAZES, STORY,
  type FormId, type GiftId, type GlazeId, type HouseId, type KilnGift,
} from './content';

/** A fired vessel, enough to draw it again. */
export interface VesselRec {
  f: FormId;
  /** height, cm (1 decimal) */
  h: number;
  /** the 16 radius ÷ height ratios × 100, integers */
  q: number[];
  stars: 1 | 2 | 3;
  /** similarity × 100 */
  sim: number;
  /** 0 mocna, 1 zgrabna, 2 cienka, 3 skorupka */
  wall: number;
  centre: boolean;
  glaze: GlazeId;
  /** the firing's G × 100 */
  runs: number;
  gift: KilnGift | null;
  second: boolean;
  porcelain: boolean;
}

/** A page of the Book of Vessels: how many were fired, the best one, the tallest height (cm), the marks earned (MARK bits). */
export interface Page { n: number; best: VesselRec; tall: number; marks: number }

export interface StreetItem { f: FormId; glaze: GlazeId }

export interface GlinaProgress {
  v: 1;
  /** saved sessions (this session is sessions + 1; set in result() with Math.max) */
  sessions: number;
  /** vessels fired, all time (counted at each opening), and their heights (cm) */
  vessels: number;
  cmTotal: number;
  /** story steps delivered per household (0..4), the households that have ordered, the day of the last step */
  steps: Record<HouseId, number>;
  introduced: HouseId[];
  storyDay: string;
  /** the last 3 everyday deliveries per house (by its door, in their glazes) */
  street: Record<HouseId, StreetItem[]>;
  book: Partial<Record<FormId, Page>>;
  /** the most recently opened page (the lobby's wheel turns it; the panel shows its verse) */
  newest: FormId | null;
  /** vessels since the last kiln gift and since the last moon white (pity) */
  sinceGift: number;
  sinceMoon: number;
  /** throws and firings begun, all time (every 4th is blind from session 3); set in result() only */
  throwsBegun: number;
  firingsBegun: number;
  glazes: GlazeId[];
  /** the day's gifts received (unique) and the day whose gift was received */
  gifts: GiftId[];
  giftDay: string;
  /** the day of the last form of the day and its best shape (similarity × 100) */
  dailyDay: string;
  dailyBest: number;
  /** the last day played and how many sessions that day */
  lastDay: string;
  todayN: number;
  /** Druga forma vessels, all time */
  seconds: number;
  /** records: the best session (cm), the tallest vessel (cm), most ★★★ in one session */
  bestSession: number;
  tallest: number;
  bestThree: number;
}

export function freshProgress(): GlinaProgress {
  return {
    v: 1, sessions: 0, vessels: 0, cmTotal: 0,
    steps: { karczma: 0, piekarnia: 0, mlodzi: 0 }, introduced: [], storyDay: '',
    street: { karczma: [], piekarnia: [], mlodzi: [] }, book: {}, newest: null,
    sinceGift: 0, sinceMoon: 0, throwsBegun: 0, firingsBegun: 0, glazes: [...START_GLAZES],
    gifts: [], giftDay: '', dailyDay: '', dailyBest: 0, lastDay: '', todayN: 0, seconds: 0,
    bestSession: 0, tallest: 0, bestThree: 0,
  };
}

// ── the street ───────────────────────────────────────────────────
/** The next household to meet, in street order (null: everyone has ordered). */
export function nextIntroduction(p: GlinaProgress): HouseId | null {
  return HOUSES.find(h => !p.introduced.includes(h)) ?? null;
}

/** The household whose story goes on today: the fewest steps done (< 4), ties in street order (null: every story is told). */
export function nextStoryHouse(p: GlinaProgress): HouseId | null {
  let best: HouseId | null = null;
  for (const h of HOUSES) if (p.steps[h] < 4 && (best === null || p.steps[h] < p.steps[best])) best = h;
  return best;
}

/** The form a household's step asks for (1..4). */
export const storyForm = (h: HouseId, step: number): FormId => STORY[h][Math.min(3, Math.max(0, step - 1))];

/** A house is alive once its fourth step is delivered. */
export const alive = (p: GlinaProgress, h: HouseId): boolean => p.steps[h] >= 4;

/** An everyday delivery stands by its house's door: the last three are kept. */
export function addToStreet(p: GlinaProgress, h: HouseId, item: StreetItem): void {
  const list = p.street[h];
  list.push(item);
  while (list.length > 3) list.shift();
}

// ── the book ─────────────────────────────────────────────────────
/** Whether `a` is a better page vessel than `b`: by stars, then shape, then height. */
export function better(a: VesselRec, b: VesselRec): boolean {
  if (a.stars !== b.stars) return a.stars > b.stars;
  if (a.sim !== b.sim) return a.sim > b.sim;
  return a.h > b.h;
}

/** Put a fired vessel in the book: a new page (true) or one more on its page, which keeps the best and every mark. */
export function addToBook(p: GlinaProgress, rec: VesselRec, marks: number): boolean {
  const page = p.book[rec.f];
  if (!page) {
    p.book[rec.f] = { n: 1, best: rec, tall: rec.h, marks };
    return true;
  }
  page.n++;
  page.marks |= marks;
  page.tall = Math.max(page.tall ?? 0, rec.h);
  if (better(rec, page.best)) page.best = rec;
  return false;
}

/** The forms with an open page, in the book's order. */
export const openForms = (p: GlinaProgress): FormId[] => FORMS.filter(f => p.book[f.id]).map(f => f.id);

/** The tallest vessel of a form so far (cm; 0: none): the ruler's chalk tick to beat. */
export function tallestOf(p: GlinaProgress, f: FormId): number {
  const page = p.book[f];
  return page ? Math.max(page.tall ?? 0, page.best.h) : 0;
}

// ── glazes ───────────────────────────────────────────────────────
/** The glaze an order asks for: the form's own, or honey, then tin white, while it is locked. */
export function orderGlaze(p: GlinaProgress, want: GlazeId): GlazeId {
  if (p.glazes.includes(want)) return want;
  return p.glazes.includes('miod') ? 'miod' : 'biel';
}

/** The cut's buckets: the order's glaze first, then up to two other unlocked ones, chosen in turn by `turn`. */
export function buckets(p: GlinaProgress, own: GlazeId, turn: number): GlazeId[] {
  const others = GLAZES.filter(g => g !== own && p.glazes.includes(g));
  const out: GlazeId[] = [own];
  for (let i = 0; i < Math.min(2, others.length); i++) out.push(others[(turn + i) % others.length]);
  return out;
}

// ── kiln gifts ───────────────────────────────────────────────────
/** One roll's gift for a uniform `u` (the published odds; a calm fire doubles them). */
export function giftFor(u: number, calm: boolean): KilnGift | null {
  const k = calm ? 2 : 1;
  const moon = GIFT_ODDS.moon * k, speckle = moon + GIFT_ODDS.speckle * k, blush = speckle + GIFT_ODDS.blush * k;
  return u < moon ? 'moon' : u < speckle ? 'speckle' : u < blush ? 'blush' : null;
}

/**
 * The kiln gift of one vessel at its opening, with pity: after 4 vessels without a gift the 5th
 * gets one for sure (drawn by the relative odds), after 29 without moon white the 30th is moon white.
 * `first`: the very first vessel ever, whose flame blush is guaranteed.  Updates the pity counters.
 */
export function rollGift(p: GlinaProgress, calm: boolean, rnd: () => number, first = false): KilnGift | null {
  let gift: KilnGift | null;
  if (first) gift = 'blush';
  else if (p.sinceMoon >= PITY_MOON) gift = 'moon';
  else {
    gift = giftFor(rnd(), calm);
    if (!gift && p.sinceGift >= PITY_GIFT) {
      const sum = GIFT_ODDS.moon + GIFT_ODDS.speckle + GIFT_ODDS.blush;
      const v = rnd() * sum;
      gift = v < GIFT_ODDS.moon ? 'moon' : v < GIFT_ODDS.moon + GIFT_ODDS.speckle ? 'speckle' : 'blush';
    }
  }
  p.sinceGift = gift ? 0 : p.sinceGift + 1;
  p.sinceMoon = gift === 'moon' ? 0 : p.sinceMoon + 1;
  return gift;
}

// ── the day ──────────────────────────────────────────────────────
const dayNum = (d: string): number | null => {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null;
};

/** Whole days from `a` to `b` ("YYYY-MM-DD"); null when either is missing. */
export function daysBetween(a: string, b: string): number | null {
  const x = dayNum(a), y = dayNum(b);
  return x === null || y === null ? null : Math.round(y - x);
}

/** Days since 2026-01-01: every ten days in a row, everyone who comes receives all ten gifts. */
export const dayIndex = (day: string): number => daysBetween('2026-01-01', day) ?? 0;

/** The day's gift at the gate, the same for everyone whatever they made. */
export const dayGift = (day: string): GiftId => DAY_GIFTS[((dayIndex(day) % DAY_GIFTS.length) + DAY_GIFTS.length) % DAY_GIFTS.length];

/** Receive the day's gift (once a day): a pigment unlocks its glaze.  Returns the gift (null: already received today). */
export function receiveDayGift(p: GlinaProgress, day: string): GiftId | null {
  if (p.giftDay === day) return null;
  const g = dayGift(day);
  p.giftDay = day;
  if (!p.gifts.includes(g)) p.gifts.push(g);
  const glaze = GIFT_GLAZE[g];
  if (glaze && !p.glazes.includes(glaze)) p.glazes.push(glaze);
  return g;
}

/** After two days away or more, the first lump of the session is porcelain ("Glina czekała na Ciebie"). */
export function welcomeBack(p: GlinaProgress, day: string): boolean {
  const away = daysBetween(p.lastDay, day);
  return away !== null && away >= 2;
}

/** The form of the day, the same for every potter: the form, a variant of its outline and the glaze, all from the day's seed. */
export interface DailyForm { f: FormId; q: Float64Array; glaze: GlazeId }

export function dailyForm(daySeed: number): DailyForm {
  const rnd = mulberry32(daySeed);
  const form = FORMS[Math.min(FORMS.length - 1, Math.floor(rnd() * FORMS.length))];
  const a = 0.12 * (rnd() - 0.5), c = 0.2 + 0.6 * rnd();
  const q = new Float64Array(RINGS);
  for (let k = 0; k < RINGS; k++) {
    const z = (U[k] - c) / 0.18;
    q[k] = Math.max(0.08, form.q[k] + a * Math.exp(-z * z));
  }
  // the same clamps as the clay's: the foot between 0.3 and 0.9 of the widest ring
  let body = 0;
  for (let k = 1; k < RINGS; k++) body = Math.max(body, q[k]);
  q[0] = Math.min(CLAY.footHi * body, Math.max(CLAY.footLo * body, q[0]));
  const glaze = GLAZES[Math.min(GLAZES.length - 1, Math.floor(rnd() * GLAZES.length))];
  return { f: form.id, q, glaze };
}

/** The three easiest open forms (Złota godzina, the victory lap). */
export function easiest(p: GlinaProgress): FormId[] {
  return openForms(p).sort((a, b) => FORM[a].ease - FORM[b].ease).slice(0, 3);
}
