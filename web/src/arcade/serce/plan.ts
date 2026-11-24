/**
 * The way of Z głowy do serca in calm stages (DESIGN.md §18.5, round 16), pure and deterministic.
 *
 * The founder (round 16): "From Head to Heart — tu trzeba wydłużyć sesje per okrąg. Po prostu jeśli sesja trwa zbyt
 * krotko, to pewnych zadań/okręgów nie zrobimy. Tutaj trzeba przejść pewne etapy i przejść je spokojnie. Etapami.
 * Każdy etap powinien trwać od 2 do 4 minut."
 *
 *   the way      nine stages (content.ts `WAY`): the descent, the heart, circle 0 (me), circles 1–5, the one sun and
 *                the four dimensions.  A session walks as many as fit; the next session goes on from where it stopped.
 *   a stage      a few push/rest cycles fitted to its least length M (the player's stage length S, or what is left
 *                when that is between 2:00 and S): its closing rest — its blessing one line a whole breath, then its
 *                verse, then the heart word —, n − 1 rests between (the heart word; the descent's stops at the mouth
 *                and the throat; the sun's own rest) and n pushes sharing the rest of M equally, n chosen so a push is
 *                nearest the player's push length.  Each push needs the average player's light for its time
 *                (`avgYield × margin` a second past its lead-in) and lasts at least its share of M: met early, the
 *                player abides in it (no light moves; held focus deepens the glow).  So a stage lasts at least M, and
 *                as long as its light needs (a weak player's runs longer; the later stages shift).
 *   a session    a stage starts only with ≥ 2:00 left before the close (`stageLen`; the session's first always
 *                starts); less left: the close — a quiet abiding with the spare time, the return into the heart (a
 *                short push) and the closing rest ("Panie, zbierz to wszystko w moim sercu"; the Aaronic blessing when
 *                this session finished the way).  A resumed session opens with a short re-entry (Wejście do serca);
 *                after the whole way, "more" stages light the world for one group of people at a time.
 *   forecast     the same rules walked for the average player (each stage lasting its M): which stages a session
 *                holds — the lobby's forecast, and the sim follows the very same `stageLen` with real times.
 *
 * Consecutive push steps form one push block (one lead-in: the re-entry's, the sun's when it has no room); a rest
 * ends it.  Every number lives in rules.ts.
 */
import { breathRestOf, type BreathPattern } from '../kit/breath';
import { PLACE } from '../kit/figure';
import { passage, type PassageId } from '../kit/scripture';
import {
  ARCS, BLESS_LINES, WAY, WAY_LEN, blessLine, indexRing, verseFor,
  type ArcId, type PlaceId, type RestKind, type Ring, type StageId, type StageKind, type VerseKey, type WayId,
} from './content';
import { t, type Key } from './i18n';
import { RULES, cleanStageSec, finaleFor, lampsFor, warmFor } from './rules';

export interface PushStep {
  kind: 'push';
  stage: StageId;
  /** the share of the stage's progress this step walks (0..1 → from..to) */
  from: number;
  to: number;
  /** held units it needs (0 for a push of abiding) */
  need: number;
  /** the push block's least length (s, its lead-in included): it ends when its need is met and this has passed */
  min: number;
  /** a push of abiding: no light moves, held focus deepens the glow until `min` */
  abide?: boolean;
  /** a "more" stage: the people it kindles lights for */
  arc?: ArcId;
}

export interface RestStep {
  kind: 'rest';
  rest: RestKind;
  /** the rings whose blessing it prays */
  rings: (0 | Ring)[];
  /** whole breaths */
  cycles: number;
  /** a stop on the descent: where */
  place?: PlaceId;
  /** a "more" stage's blessing: the people */
  arc?: ArcId;
  /** a stage's closing rest (its blessing, its verse, the heart word) */
  closing?: boolean;
  /** the close of a session that finished the way: the Aaronic blessing */
  whole?: boolean;
}

export type Step = PushStep | RestStep;

/** Where along the descent (brow → heart, by length) each place lies, 0..1. */
export const PLACE_AT: Readonly<Record<PlaceId, number>> = (() => {
  const ys = RULES.descentPlaces.map(p => PLACE[p][1]);
  const y0 = ys[0], y1 = ys[ys.length - 1];
  return Object.fromEntries(RULES.descentPlaces.map((p, i) => [p, (ys[i] - y0) / (y1 - y0)])) as Record<PlaceId, number>;
})();

const cycleOf = (p: BreathPattern): number => breathRestOf(p, 1).sec;
export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
/** Held units a second a stage's push asks for past its lead-in (the average player's, with a margin). */
export const stageYield = (): number => RULES.avgYield * RULES.margin;
const int = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(Number.isFinite(v) ? v : lo)));

// ── what a rest prays, breath by breath ─────────────────────────

/** One thing a rest shows: a line, the heart word or a verse, for so many whole breaths. */
export interface RestItem { text?: string; word?: boolean; verse?: PassageId; breaths: number }

interface Parts { lines: string[]; verse: PassageId | null; word: boolean; keepVerse: boolean }

function partsOf(st: RestStep, session: number): Parts {
  const p: Parts = { lines: [], verse: null, word: !!st.closing, keepVerse: false };
  switch (st.rest) {
    case 'bless': {
      const many = st.rings.length > 1;
      for (const r of st.rings) for (let i = 0; i < (many ? 1 : BLESS_LINES[r]); i++) p.lines.push(blessLine(r, i));
      p.verse = verseFor(`ring${st.rings[st.rings.length - 1] ?? 0}` as VerseKey, session);
      break;
    }
    case 'grat': p.lines.push(t('grat.1'), t('grat.2')); p.verse = verseFor('grat', session); break;
    case 'sun': p.lines.push(t('sun.1'), t('sun.2')); p.verse = verseFor('sun', session); break;
    case 'arrive': p.lines.push(t('arrive.1')); p.verse = verseFor('descent', session); p.word = true; break;
    case 'pervade': p.lines.push(t('pervade.1')); p.verse = verseFor('pervade', session); p.word = true; break;
    case 'enter': p.lines.push(t('arrive.1')); p.word = true; break;
    case 'amen':
      p.lines.push(t('amen.1'));
      if (st.whole) { p.verse = 'num6.24-26'; p.keepVerse = true; p.word = false; } else p.word = true;
      break;
    case 'stop':
      if (st.place !== 'mouth') p.lines.push(t('stop.throat'));
      p.word = true;
      break;
    case 'more':
      if (st.arc) p.lines.push(t(`more.${st.arc}` as Key));
      p.verse = verseFor('ring5', session);
      p.word = true;
      break;
    case 'word': p.word = true; break;
  }
  return p;
}

/** Whole breaths a verse needs to be read in rest: two for a long one. */
const verseBreaths = (id: PassageId): number => (passage(id).text.length > 150 ? 2 : 1);

/** The whole breaths a rest needs for all it prays: a line each, its verse (two for a long one), the heart word. */
export function restNeed(st: RestStep, session: number): number {
  const p = partsOf(st, session);
  return p.lines.length + (p.verse ? verseBreaths(p.verse) : 0) + (p.word ? 1 : 0);
}

/**
 * What a rest shows breath by breath: its lines one a breath, then its verse, then the heart word for the breaths
 * left (the verse, or the last line, when there is no word).  Fewer breaths than it needs: the word goes first, then
 * the verse's second breath, then the verse (the Aaronic blessing stays: the lines go), then the last lines.
 */
export function restSeq(st: RestStep, session: number): RestItem[] {
  const p = partsOf(st, session);
  const C = Math.max(1, Math.round(st.cycles));
  let lines = p.lines.slice();
  let V = p.verse ? verseBreaths(p.verse) : 0;
  let W = p.word ? 1 : 0;
  const total = () => lines.length + V + W;
  if (total() > C) W = 0;
  if (total() > C && V === 2) V = 1;
  if (total() > C && V && !p.keepVerse) V = 0;
  if (total() > C) lines = lines.slice(0, Math.max(0, C - V - W));
  const items: RestItem[] = lines.map(text => ({ text, breaths: 1 }));
  if (V && p.verse) items.push({ verse: p.verse, breaths: V });
  if (W || !items.length) items.push({ word: true, breaths: 1 });
  const used = items.reduce((a, i) => a + i.breaths, 0);
  items[items.length - 1].breaths += Math.max(0, C - used);
  return items;
}

/** The item a rest shows in its n-th whole breath (0-based). */
export function restAt(st: RestStep, session: number, n: number): RestItem {
  const items = restSeq(st, session);
  let k = Math.max(0, Math.floor(n));
  for (const it of items) {
    if (k < it.breaths) return it;
    k -= it.breaths;
  }
  return items[items.length - 1];
}

// ── one stage's steps ───────────────────────────────────────────

export interface StageOpts {
  kind: StageKind;
  /** a way stage's index (0–8); the re-entry: the saved stage it leads to (1–8) */
  way?: number | null;
  /** the stage's least length (s) */
  min: number;
  /** the most it may last (s: the time left before the close); absent: as long as its light and blessing need */
  cap?: number;
  /** the player's push length (s, its lead-in included) and each rest's whole breaths */
  push: number;
  breaths: number;
  pattern: BreathPattern;
  eeg: boolean;
  /** the session's number (the verses go in turn) */
  session: number;
  /** a "more" stage's people */
  arc?: ArcId;
  /** the close: this session finished the way (the Aaronic blessing) */
  whole?: boolean;
  /** the close: the stage its quiet abiding stays with (the last one walked) */
  abideOn?: StageId;
}

export interface StagePlan {
  kind: StageKind;
  way: number | null;
  /** the least length it was fitted to (s) */
  min: number;
  /** how long it lasts for an average or a stronger player (s): its pushes' least lengths and its rests, ≥ `min` */
  len: number;
  steps: Step[];
  /** push blocks */
  pushes: number;
}

const push = (stage: StageId, from: number, to: number, need: number, min: number, extra: Partial<PushStep> = {}): PushStep =>
  ({ kind: 'push', stage, from, to, need, min, ...extra });
const rest = (kind: RestKind, cycles: number, extra: Partial<RestStep> = {}): RestStep =>
  ({ kind: 'rest', rest: kind, rings: [], cycles, ...extra });

/** A stage's closing rest: the descent's arrival, gratitude, a circle's blessing, the dimensions', the world's people. */
function closingOf(kind: WayId | 'more', arc?: ArcId): RestStep {
  const r = kind === 'more' ? null : indexRing(WAY.indexOf(kind));
  if (r) return rest('bless', 1, { rings: [r], closing: true });
  switch (kind) {
    case 'descent': return rest('arrive', 1, { closing: true });
    case 'heart': return rest('grat', 1, { closing: true });
    case 'field': return rest('bless', 1, { rings: [0], closing: true });
    case 'sun': return rest('pervade', 1, { closing: true });
    default: return rest('more', 1, { closing: true, ...(arc ? { arc } : {}) });
  }
}

/** The spans of a stage's n pushes: each push one or more steps of [stage, from, to]. */
function spansOf(kind: WayId | 'more', n: number): [StageId, number, number][][] {
  const even = (s: StageId, k: number, off = 0): [StageId, number, number][][] =>
    Array.from({ length: k }, (_, i) => [[s, i / k, (i + 1) / k] as [StageId, number, number]]).slice(off);
  if (kind === 'descent') {
    const m = PLACE_AT.mouth, th = PLACE_AT.throat;
    if (n <= 1) return [[['descent', 0, 1]]];
    if (n === 2) return [[['descent', 0, th]], [['descent', th, 1]]];
    return [[['descent', 0, m]], [['descent', m, th]], [['descent', th, 1]]];
  }
  if (kind === 'sun') {
    if (n <= 1) return [[['sun', 0, 1], ['pervade', 0, 1]]];
    return [[['sun', 0, 1]], ...even('pervade', n - 1)];
  }
  return even(kind, n);
}

/** The rests between a stage's n pushes (n − 1 of them). */
function betweenOf(kind: WayId | 'more', n: number, b: number, session: number): RestStep[] {
  if (n <= 1) return [];
  if (kind === 'descent') {
    const stops: PlaceId[] = n === 2 ? ['throat'] : ['mouth', 'throat'];
    return stops.map(place => rest('stop', b, { place }));
  }
  const out: RestStep[] = [];
  if (kind === 'sun') {
    const sun = rest('sun', 1);
    sun.cycles = Math.max(b, restNeed(sun, session));
    out.push(sun);
  }
  while (out.length < n - 1) out.push(rest('word', b));
  return out;
}

const restSecOf = (rs: readonly RestStep[], cyc: number): number => rs.reduce((a, r) => a + r.cycles, 0) * cyc;

/** A way stage or a "more" stage: n push/rest cycles fitted to its least length (see the module's comment). */
function cyclesPlan(o: StageOpts): StagePlan {
  const R = RULES, cyc = cycleOf(o.pattern), lead = leadOf(o.eeg), Y = stageYield();
  const kind = o.kind as WayId | 'more';
  const b = int(o.breaths, 1, R.restBreathsMax);
  const M = Math.max(1, o.min);
  const closing = closingOf(kind, o.arc);
  closing.cycles = Math.min(Math.max(b, restNeed(closing, o.session)), Math.max(1, Math.floor((M * R.closingShare) / cyc)));
  const nMax = kind === 'descent' ? R.pushesMax.descent : kind === 'sun' ? R.pushesMax.sun : R.pushesMax.other;
  const floor = lead + R.pushSighted;
  // the light's time: what the closing rest leaves of M, at least `lightShare` of M, never past the cap
  const C = closing.cycles * cyc;
  const L = Math.max(floor, Math.min(Math.max(M - C, R.lightShare * M), (o.cap ?? Infinity) - C));
  let n = 1, best = Infinity;
  for (let k = 1; k <= nMax; k++) {
    const per = (L - restSecOf(betweenOf(kind, k, b, o.session), cyc)) / k;
    if (per < floor) continue;
    // the descent keeps its stops (the mouth, the throat) while its pushes are long enough; the others: nearest the dial
    const score = kind === 'descent' ? (per >= R.descentPush ? -k : Math.abs(per - o.push)) : Math.abs(per - o.push);
    if (score < best - 1e-9) { best = score; n = k; }
  }
  const between = betweenOf(kind, n, b, o.session);
  const per = Math.max(floor, (L - restSecOf(between, cyc)) / n);
  const need = Y * (per - lead);
  const steps: Step[] = [];
  spansOf(kind, n).forEach((spans, i) => {
    for (const [stage, from, to] of spans) steps.push(push(stage, from, to, need / spans.length, per, o.arc ? { arc: o.arc } : {}));
    steps.push(i < n - 1 ? between[i] : closing);
  });
  return { kind: o.kind, way: kind === 'more' ? null : WAY.indexOf(kind), min: M, len: per * n + restSecOf(between, cyc) + C, steps, pushes: n };
}

/**
 * A resumed session's re-entry (Wejście do serca): one push walking quickly what comes before the saved stage among the
 * first three — the descent (and the heart, and the field round the person) — then a short rest ("Panie, oto jestem —
 * w sercu, przed Tobą.", and the heart word from a minute).  Focus-gated like every push, with a small need.
 */
function reentryPlan(o: StageOpts): StagePlan {
  const R = RULES, cyc = cycleOf(o.pattern), lead = leadOf(o.eeg), Y = stageYield();
  const saved = int(o.way ?? 3, 1, WAY_LEN - 1);
  const parts = (['descent', 'heart', 'field'] as const).slice(0, Math.min(3, saved));
  const restC = o.min >= 60 ? 2 : 1;
  const per = Math.max(lead + R.reentrySighted, o.min - restC * cyc);
  const total = Y * (per - lead);
  const W = R.reentryWeight;
  const sum = parts.reduce((a, p) => a + W[p], 0);
  const steps: Step[] = parts.map(p => push(p, 0, 1, (total * W[p]) / sum, per));
  steps.push(rest('enter', restC, { closing: true }));
  return { kind: 'reentry', way: saved, min: o.min, len: per + restC * cyc, steps, pushes: 1 };
}

/**
 * The close: with time to spare a quiet abiding (an abiding push with the last stage, then the heart word), the
 * return into the heart (a short push; the spare it does not need makes it calmer, up to `closePushMax`), and the
 * closing rest — "Panie, zbierz to wszystko w moim sercu" and the heart word, or after a whole way the Aaronic
 * blessing —, more breaths of it with more time.  Too little time: the closing rest alone.
 */
function closePlan(o: StageOpts): StagePlan {
  const R = RULES, cyc = cycleOf(o.pattern), lead = leadOf(o.eeg);
  const b = int(o.breaths, 1, R.restBreathsMax);
  const M = Math.max(0, o.min);
  const whole = !!o.whole;
  const backMin = lead + R.closeSighted;
  // too little time even for a short return (a session cut late): the closing rest alone
  if (M < lead + 3 + cyc) {
    const c = Math.max(1, Math.floor(M / cyc));
    return { kind: 'close', way: null, min: M, len: c * cyc, steps: [rest('amen', c, { closing: true, whole })], pushes: 0 };
  }
  let amenC = Math.min(whole ? 3 : 1, Math.max(1, Math.floor((M - backMin) / cyc)));
  let extra = M - backMin - amenC * cyc;
  const steps: Step[] = [];
  let pushes = 1;
  if (extra >= R.quietFrom) {
    const wC = Math.min(2, b);
    const q = Math.max(lead + R.pushSighted, Math.min(90, Math.round((extra - wC * cyc) * 0.55)));
    steps.push(push(o.abideOn ?? 'field', 0, 0, 0, q, { abide: true }), rest('word', wC));
    extra -= q + wC * cyc;
    pushes++;
  }
  const more = Math.max(0, Math.min(3, Math.floor((extra * 0.5) / cyc)));
  amenC += more;
  extra -= more * cyc;
  let back = Math.max(lead + 3, backMin + extra);
  if (back > R.closePushMax) {
    const k = Math.floor((back - R.closePushMax) / cyc);
    amenC += k;
    back -= k * cyc;
  }
  steps.push(push('back', 0, 1, R.backNeed, back), rest('amen', amenC, { closing: true, whole }));
  return { kind: 'close', way: null, min: M, len: M, steps, pushes };
}

/** One stage's steps (the way's, a "more" stage, the re-entry, the close). */
export function stagePlan(o: StageOpts): StagePlan {
  if (o.kind === 'reentry') return reentryPlan(o);
  if (o.kind === 'close') return closePlan(o);
  return cyclesPlan(o);
}

// ── the session ─────────────────────────────────────────────────

/**
 * The close's least length (s): the return's lead-in and push, and one breath of its closing rest.  A test-length
 * session of a minute or less (?trainingSec) keeps only the breath, so its first stage has time to move at all.
 */
export const closeMin = (pattern: BreathPattern, eeg: boolean, plannedSec = Infinity): number =>
  (plannedSec <= 60 ? 0 : leadOf(eeg) + RULES.closeSighted) + cycleOf(pattern);

/**
 * The least length of the next stage with `left` s before the close must begin, or null (the close comes now): a
 * stage starts only with at least `stageFloor` left and then lasts S or what is left; the session's first always
 * starts.  The session's last stage (no further one fits after it) takes up to `stageStretch` s more of what only
 * the close would get — never past 4:00, the close keeping `closeCalm` s beyond its least.
 */
export function stageLen(left: number, S: number, first: boolean): number | null {
  const R = RULES, floor = R.stageFloor - R.stageSlack;
  if (left >= floor) {
    const M = Math.min(S, left);
    if (left - M >= floor) return M;
    const most = R.stageLens[R.stageLens.length - 1];
    return Math.max(M, Math.min(left - R.closeCalm, S + R.stageStretch, most));
  }
  return first ? Math.max(R.firstMin, left) : null;
}

/**
 * The most a stage of least length M may last with `left` s before the close: a long blessing may carry it past M,
 * but never so far that a following stage no longer fits, and never past the close.
 */
export function stageCap(left: number, M: number): number {
  const floor = RULES.stageFloor - RULES.stageSlack;
  return left - M >= floor - 0.5 ? Math.max(M, left - floor) : Math.max(M, left);
}

/** How many stages of S fit `x` seconds (the first always). */
function fits(x: number, S: number): number {
  let n = 0, left = x;
  for (let first = true; n < 60; first = false) {
    const M = stageLen(left, S, first);
    if (M === null) break;
    n++;
    left -= M;
  }
  return n;
}

/**
 * The re-entry's length (s, its rest included) for a session of T with `avail` s for it and the stages: by the session's
 * length (rules.ts `reentry`), shortened down to its least when that lets one more stage fit.
 */
export function reentrySec(T: number, avail: number, S: number, pattern: BreathPattern, eeg: boolean): number {
  const pref = (RULES.reentry.find(([below]) => T < below) ?? RULES.reentry[RULES.reentry.length - 1])[1];
  const short = leadOf(eeg) + RULES.reentrySighted + cycleOf(pattern);
  const least = T >= RULES.reentryLong.from ? Math.max(short, RULES.reentryLong.min) : short;
  let R = Math.max(least, pref);
  // (a second to spare: a session's blocks end on whole frames)
  const most = fits(avail - least - 2, S);
  while (R > least && fits(avail - R - 2, S) < most) R--;
  return R;
}

/** The stage the way goes on from today: ring 4 left out today goes on from ring 5. */
export function resolveStart(next: number, skip4: boolean): number {
  const i = int(next, 0, WAY_LEN - 1);
  return skip4 && i === 6 ? 7 : i;
}

/** The way stage after `i` (ring 4 left out today is skipped); WAY_LEN once the way is walked. */
export function nextWay(i: number, skip4: boolean): number {
  let j = i + 1;
  if (skip4 && j === 6) j++;
  return j;
}

/** A first session's warm-up (it waits for the opening card's reading time). */
export function warmOf(T: number, firstEver: boolean, warmSec = 0): number {
  return firstEver ? Math.min(T * 0.3, Math.max(warmFor(T), warmSec)) : 0;
}

export interface ForecastOpts {
  plannedSec: number;
  /** the player's stage length (s) */
  stageSec: number;
  /** the player's push length and rest breaths (the Rytm row; the design's when absent) */
  push?: number;
  breaths?: number;
  /** the stage the way goes on from (0 = from the start) */
  next: number;
  firstEver: boolean;
  /** ring 4 left out today */
  skip4: boolean;
  pattern: BreathPattern;
  eeg: boolean;
  /** the least warm-up a first session needs (its opening card's reading time), seconds */
  warmSec?: number;
}

/** A stage of a session as the forecast walks it: what, its least length, how long it lasts, when it begins (s of play). */
export interface Slot { kind: StageKind; way: number | null; min: number; len: number; at: number; arc?: ArcId }

export interface Forecast {
  warm: number;
  finale: number;
  /** the stage the way goes on from today */
  start: number;
  /** the re-entry's length (0: a fresh way) */
  reentry: number;
  /** the re-entry (if any), the way's stages and "more" stages, in order */
  slots: Slot[];
  /** the close: when it begins and how long it has */
  close: { at: number; min: number };
  /** this session finishes the way */
  whole: boolean;
  /** where the next session goes on (0: from the start, after a whole way) */
  nextAfter: number;
}

/** The session's stages for the average player (each lasting its least length): the lobby's forecast. */
export function forecast(o: ForecastOpts): Forecast {
  const T = Math.max(10, o.plannedSec), S = cleanStageSec(o.stageSec);
  const finale = finaleFor(T), warm = warmOf(T, o.firstEver, o.warmSec);
  const cm = closeMin(o.pattern, o.eeg, T), end = T - finale;
  const start = resolveStart(o.next, o.skip4);
  const slots: Slot[] = [];
  let t = warm, reentry = 0;
  if (start > 0) {
    reentry = reentrySec(T, end - cm - t, S, o.pattern, o.eeg);
    slots.push({ kind: 'reentry', way: start, min: reentry, len: reentry, at: t });
    t += reentry;
  }
  const dials = { push: o.push ?? RULES.pushDial.def, breaths: o.breaths ?? RULES.restBreathsDef, pattern: o.pattern, eeg: o.eeg, session: 1 };
  let idx = start, whole = false, more = 0;
  for (let first = true; slots.length < 60; first = false) {
    const left = end - cm - t;
    const M = stageLen(left, S, first);
    if (M === null) break;
    const kind: StageKind = idx < WAY_LEN ? WAY[idx] : 'more';
    const arc = kind === 'more' ? ARCS[more++ % ARCS.length] : undefined;
    const len = stagePlan({ kind, way: kind === 'more' ? null : idx, min: M, cap: stageCap(left, M), ...dials, ...(arc ? { arc } : {}) }).len;
    slots.push({ kind, way: kind === 'more' ? null : idx, min: M, len, at: t, ...(arc ? { arc } : {}) });
    if (kind !== 'more') {
      if (idx === WAY_LEN - 1) whole = true;
      idx = nextWay(idx, o.skip4);
    }
    t += len;
  }
  return { warm, finale, start, reentry, slots, close: { at: t, min: Math.max(0, end - t) }, whole, nextAfter: whole ? 0 : Math.min(idx, WAY_LEN - 1) };
}

/** Lamps per ring for stages of S (index 1–5; ring 5's are the world's lights, its named arcs counted apart). */
export const lampsOf = (S: number): number[] => [0, 1, 2, 3, 4, 5].map(r => (r === 0 ? 0 : lampsFor(r, S)));
/** Ring 5's five named arcs round the Earth, from 3-minute stages. */
export const arcsOf = (S: number): boolean => S >= RULES.stageDef;

/**
 * Seconds a stage's steps take for a player whose pushes yield `yieldPerSec` held units a second past the lead-in
 * (each push block at least its least length; the valve aside).
 */
export function stageSeconds(steps: readonly Step[], pattern: BreathPattern, eeg: boolean, yieldPerSec: number): number {
  const lead = leadOf(eeg), cyc = cycleOf(pattern);
  let s = 0, block: PushStep[] = [];
  const flush = () => {
    if (!block.length) return;
    const need = block.reduce((a, p) => a + p.need, 0);
    s += Math.max(block[0].min, lead + need / Math.max(1e-6, yieldPerSec));
    block = [];
  };
  for (const st of steps) {
    if (st.kind === 'push') block.push(st);
    else {
      flush();
      s += st.cycles * cyc;
    }
  }
  flush();
  return s;
}
