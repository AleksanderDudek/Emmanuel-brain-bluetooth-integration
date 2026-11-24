/**
 * Z głowy do serca's session, without the DOM (DESIGN.md §18.5, round 16).  The way is nine stages walked calmly, each
 * at least the player's stage length (plan.ts); the session walks as many as fit and the next goes on from there.
 *
 *   a stage                push/rest cycles fitted to its least length: its pushes walk its focus-gated goal — the
 *                          light down the midline, the flame, the field round the person, a circle's reach and lamps,
 *                          the sun and the four dimensions — and its rests bless, one line a whole breath, then its
 *                          verse, then the heart word.  It ends when its time has passed, its goal is reached and its
 *                          closing rest is said.
 *   a push block           (past its lead-in, a reliable signal, focused) the light walks its steps — only then
 *                          (rules.ts `focusRate`); without focus it waits, never goes back.  Its need met before its
 *                          least length: the player abides (no light moves; held focus deepens the stage's glow and the
 *                          names by its lamps) — never more lamps, never ahead to the next stage
 *   a rest block           whole breaths of the player's pattern (5 · 5 by default)
 *   the safety valve       a push that cannot finish (60 s without light, or twice its least length, at least 90 s)
 *                          gives way to a rest of the heart word; the step keeps what it gained, the next push goes on
 *   the session            a stage starts only with ≥ 2:00 left before the close (the first always); a resumed session
 *                          opens with a short re-entry (Wejście do serca); after the whole way "more" stages light the
 *                          world; at the end the close — a quiet abiding with what is spare, the return into the heart
 *                          and the closing rest (the Aaronic blessing after a whole way).  A stage still running when the
 *                          close must begin is cut (a rest at its breath's end) and saved for the next session.
 *   the hands              a tap (Space, a click) stays with the words: they glow again, a ring of light, a bell —
 *                          never light; it turns a story card's page
 *
 * Each block is judged once at its end over its last ≤ 15 s (`RoundJudge.from(tuning)`; a push under 10 s is not
 * judged), `BlockContrast` for the summary.  A 4 s telegraph announces the rest (when the push's end is known — its
 * light met, or 85 % of it with its least length nearly passed) and the next push 4 s before the rest ends.  The
 * headline is the lights kindled (świateł).  An unreliable signal freezes the light — nothing is lost, nothing moves.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathRestOf, type BreathPattern, type BreathPhase, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ARCS, PLACES, WAY, WAY_LEN, arcName, heartWord, indexRing, pushTip, restTip, ringName, ringStage, stageLabel, stageOf, stageRing, stageTitle,
  verseFor, type ArcId, type PlaceId, type RestKind, type Ring, type StageId, type StageKind, type VerseKey, type WordId,
} from './content';
import { lightsText, t, unit, type Key } from './i18n';
import { bestOf, lenKey, markSeen, namesCount, namesOf, skip4Today, startStage, type SerceProgress } from './meta';
import {
  PLACE_AT, arcsOf, closeMin, forecast, lampsOf, nextWay, reentrySec, resolveStart, restAt, restSeq, stageCap, stageLen, stagePlan,
  type Forecast, type PushStep, type RestItem, type RestStep, type Step,
} from './plan';
import { RULES, cleanStageSec, focusRate, readTime, warmFor } from './rules';
import { Talk, type Moment } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export type BlockWhy = 'step' | 'valve' | 'time';
/** A block: `dur` its planned length (Infinity for a push), `len` how long it lasted, `step` a rest's step. */
export interface Block { kind: BlockKind; dur: number; cycles: number; why: BlockWhy | null; len: number; step: RestStep | null }

export type Coach = 'light' | 'breath' | 'tap' | 'ring4' | 'names';

/** The one short line of what to do now (it changes only when the action changes). */
export type NowWhat =
  | 'warm' | 'descent' | 'heart' | 'field' | 'reach' | 'kindle' | 'sun' | 'pervade' | 'back' | 'more' | 'abide'
  | 'rest' | 'grat' | 'stop' | 'valve' | 'nosig' | 'end';

/** A stage of this session as it runs: what, its least length, when it began, its steps, whether its goal was met. */
export interface StageRun {
  kind: StageKind;
  /** a way stage's index; the re-entry's: the stage it leads to */
  way: number | null;
  min: number;
  /** how long it lasts for an average or a stronger player (its plan's length, ≥ min) */
  len: number;
  t0: number;
  /** its steps in `steps`: [i0, i1) */
  i0: number;
  i1: number;
  arc?: ArcId;
  /** its light is all walked (its closing rest follows), and when (s of play) */
  goal: boolean;
  tGoal: number | null;
  /** when it ended (s of play), null while it runs */
  t1: number | null;
}

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'stageOpen'; run: StageRun }
  | { type: 'stageEnd'; run: StageRun }
  | { type: 'stage'; stage: StageId }
  | { type: 'place'; place: PlaceId }
  | { type: 'kindled' }
  | { type: 'whole' }
  | { type: 'reach'; ring: Ring }
  | { type: 'lamp'; ring: Ring; i: number; of: number }
  | { type: 'ringDone'; ring: Ring }
  | { type: 'sunUp' }
  | { type: 'pervaded' }
  | { type: 'home' }
  | { type: 'way' }
  | { type: 'more'; n: number }
  | { type: 'abide' }
  | { type: 'line'; key: string }
  | { type: 'breathTurn'; phase: BreathPhase; len: number }
  | { type: 'gold'; on: boolean }
  | { type: 'tap' }
  | { type: 'valve' }
  | { type: 'coach'; what: Coach }
  | { type: 'story'; page: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The narrator's moments that belong to one stage of the way (dropped once the way moves on). */
const STAGE_MOMENTS: readonly Moment[] = [
  'descend', 'settle', 'heart', 'field', 'whole', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back', 'more', 'abide', 'abideRing',
];

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** A story card's page: its title, its text, its verse. */
export interface Page { title: string; text: string; verse: PassageId }
export const STORY_PAGES = 2;
export function pageOf(page: number): Page {
  return page === 0
    ? { title: t('story.open.title'), text: t('story.open.text'), verse: '1jn4.16' }
    : { title: t('story.how.title'), text: t('story.how.text'), verse: 'rom10.8' };
}
export function pageTime(page: number): number {
  const pg = pageOf(page);
  return Math.max(RULES.pageSec, readTime(`${pg.title} ${pg.text} ${passage(pg.verse).text}`));
}

/** The words on the card now. */
export interface Words {
  /** a small header: the stage or the ring, and where */
  head: string;
  /** the main line (a blessing's line, the gratitude question), or the heart word's two halves */
  main: string;
  /** the heart word's other half (shown dimmer), when the main line is the heart word */
  second: string;
  /** which half of the heart word is said now ('in' = main) */
  word: 'in' | 'out' | null;
  /** a verse instead of the line */
  verse: PassageId | null;
  /** changes whenever the card's content changes (a fade) */
  key: string;
}

/** A stage's title card: "Etap 4 z 9" over "Krąg 1 — Rodzina" (the re-entry: what comes after it). */
export interface TitleCard { kicker: string; title: string; sub: string }

export interface SimInit {
  progress: SerceProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** today ("YYYY-MM-DD"): ring 4 may be left out today */
  day: string;
  /**
   * The rhythm the player set in the lobby (kit/rhythm.ts, `serceRhythm`): a stage's push length (s) and each rest's
   * whole breaths — taken when the player moved a dial (`custom`); absent or as designed: 45 s and 2 breaths.
   */
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
}

/** The session-wide plan: the stage length, the lamps per ring, the warm-up and finale, the forecast it began with. */
export interface Plan {
  stageSec: number;
  push: number;
  breaths: number;
  lamps: number[];
  arcs: boolean;
  warm: number;
  finale: number;
  /** the warm-up block itself (s): it waits longer while the opening card is up */
  warmBlock: number;
  forecast: Forecast;
}

type Prog = Record<StageId, number>;
const zeroProg = (): Prog => ({ descent: 0, heart: 0, field: 0, ring1: 0, ring2: 0, ring3: 0, ring4: 0, ring5: 0, sun: 0, pervade: 0, back: 0, more: 0 });

export class SerceSim {
  readonly p: SerceProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  readonly plan: Plan;
  readonly pattern: BreathPattern;
  /** each rest's whole breaths as the player set them (null: the design's) */
  readonly restBreaths: number | null;
  readonly word: WordId;
  readonly own: string;
  readonly skip4: boolean;
  /** the stage the way goes on from today (0 = from the start; stages before it shine from earlier sessions) */
  readonly from: number;
  /** where the way stood when this session began (ring 4 not yet resolved) */
  private readonly savedNext: number;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly cyc: number;
  private readonly bestBefore: number | null;
  /** the session's steps, stage by stage as each opens */
  readonly steps: Step[] = [];
  /** the stages of this session, in order */
  readonly runs: StageRun[] = [];

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  private readonly blockList: Block[] = [];
  blockIndex = 0;
  blockT = 0;
  /** the push block's least length (s) */
  blockMin = 0;
  telegraphed = false;
  nextKind: BlockKind | null = null;
  tip = '';
  private pushesBegun = 0;
  stallT = 0;
  private afterValve = false;
  // the way
  stepIdx = 0;
  /** held units done in the current push step */
  stepDone = 0;
  /** the push's light is met before its least length: the player abides */
  abiding = false;
  /** how deep held focus has made the abiding glow (0..1, a picture only) */
  deep = 0;
  readonly prog: Prog = zeroProg();
  /** lamps lit per ring (index 1–5; ring 5 counts the world's lights and then the arcs), places passed */
  readonly lit = [0, 0, 0, 0, 0, 0];
  placesPassed = 0;
  moreLights = 0;
  /** the way stage walked next (its goal not yet met) */
  wayIdx: number;
  /** this session finished the way (stage 9's light) */
  wayDone = false;
  /** way stages whose light was all walked this session, in order */
  readonly walkedNow: number[] = [];
  private moreRounds = 0;
  /** the close has begun */
  inClose = false;
  private cutDue = false;
  /** the band */
  level = 0;
  focused = false;
  hold = 0;
  reliable = false;
  calmShown = 0;
  /** the light shown (the focus level smoothed over ≥ 10 s in a push past its lead-in) */
  glow: number = RULES.baseGlow;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private waitRun = 0;
  private waitSaid = false;
  unrelT = 0;
  private noSigSaid = false;
  // the breath
  /** the rest's breath clock (s since the rest began) */
  breathT = 0;
  /** the heart word's breath clock in pushes (runs always) */
  wordT = 0;
  reshow = 0;
  story: { page: number; t: number } | null = null;
  // the tallies
  lights = 0;
  restsDone = 0;
  valvesNow = 0;
  goldSec = 0;
  abideNow = 0;
  private abideRun = 0;
  private abideGap = 0;
  longestNow = 0;
  private passedRests = 0;
  /** the furthest ring completed this session (0: the field round the figure; −1: none) */
  reachedNow = -1;
  private settled = false;
  /** a coach mark is on screen until this time (s of play) */
  hintUntil = 0;
  /** the last rest's words (the finale keeps them) */
  private lastWords: Words | null = null;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.pattern = this.p.breath;
    this.word = this.p.word;
    this.own = this.p.own;
    this.skip4 = skip4Today(this.p, init.day);
    this.savedNext = startStage(this.p);
    this.from = resolveStart(this.savedNext, this.skip4);
    this.wayIdx = this.from;
    // a first session's warm-up waits for the opening card: the plan leaves room for its reading time (not in a
    // test-length session of a minute or less — ?trainingSec — where the card would take all of it; the warm-up
    // still waits while the card is up)
    const card = this.firstEver && !this.p.seen.includes('s.open') && this.plannedSec > 60 ? pageTime(0) + pageTime(1) + RULES.telegraph + 2 : 0;
    const rh = init.rhythm;
    const mine = !!rh && rh.custom !== false;
    const D = RULES.pushDial;
    this.restBreaths = mine ? Math.max(1, Math.min(RULES.restBreathsMax, Math.round(rh!.rest))) : null;
    const push = mine && Number.isFinite(rh!.focus) ? Math.max(D.min, Math.min(D.max, rh!.focus)) : D.def;
    const S = cleanStageSec(this.p.stageSec);
    const fc = forecast({
      plannedSec: this.plannedSec, stageSec: S, next: this.savedNext, firstEver: this.firstEver, skip4: this.skip4, pattern: this.pattern, eeg: this.eeg, warmSec: card,
    });
    this.plan = {
      stageSec: S, push, breaths: this.restBreaths ?? RULES.restBreathsDef, lamps: lampsOf(S), arcs: arcsOf(S),
      warm: fc.warm, finale: fc.finale, warmBlock: this.firstEver ? warmFor(this.plannedSec) : 0, forecast: fc,
    };
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.cyc = breathRestOf(this.pattern, 1).sec;
    this.bestBefore = bestOf(this.p);
    this.talk = new Talk(m => linesOf(m), init.rng);
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block {
    return this.blockList[Math.min(this.blockIndex, this.blockList.length - 1)] ?? { kind: 'warmup', dur: 0, cycles: 0, why: null, len: 0, step: null };
  }
  get blocks(): readonly Block[] { return this.blockList; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  /** a push past its lead-in: the light answers the band */
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  /** the light moves now */
  get moving(): boolean { return this.sighted && this.reliable && this.focused && !this.story && !this.abiding; }
  /** held focus deepens an abiding glow now */
  get deepening(): boolean { return this.sighted && this.reliable && this.focused && !this.story && this.abiding; }
  get leadIn(): number { return this.lead; }
  get score(): number { return this.lights; }
  get step(): Step | null { return this.steps[this.stepIdx] ?? null; }
  /** the stage of this session running now (null before the first, after the warm-up) */
  get run(): StageRun | null { return this.runs[this.runs.length - 1] ?? null; }
  /** the stage a way stage the session is in, or the one the re-entry leads to (null: none — a "more" stage, the close) */
  get wayNow(): number | null {
    const r = this.run;
    if (!r || r.kind === 'more' || r.kind === 'close') return null;
    return r.way;
  }
  /** how far the stage's time has gone (0..1; its least length), for the quiet line on the card */
  get stageK(): number {
    const r = this.run;
    if (!r || this.phase !== 'play') return this.phase === 'play' ? 0 : 1;
    return clamp((this.t - r.t0) / Math.max(1, r.len));
  }
  /** the push step the light is on (in a rest: the one the next push walks) */
  get pushStep(): PushStep | null {
    for (let i = this.stepIdx; i < this.steps.length; i++) { const s = this.steps[i]; if (s.kind === 'push') return s; }
    return null;
  }
  /** the stage the way is at (the current push's, or in a rest the one just walked) */
  get stage(): StageId {
    const s = this.step;
    if (s?.kind === 'push') return s.stage;
    for (let i = Math.min(this.stepIdx, this.steps.length) - 1; i >= 0; i--) { const x = this.steps[i]; if (x.kind === 'push') return x.stage; }
    return 'descent';
  }
  /** the rest this rest block prays (its step, or the valve's) */
  get rest(): RestStep | null { return this.restBlock ? this.block.step : null; }
  /** the ring the way is at (the stage's ring, or the ring a blessing prays) */
  get ring(): Ring | null {
    const r = this.blessRing;
    if (r !== null) return r === 0 ? null : r;
    return stageRing(this.stage);
  }
  /** In a blessing's rest, the ring whose line is said now. */
  get blessRing(): 0 | Ring | null {
    const r = this.rest;
    if (!r || r.rest !== 'bless' || !r.rings.length) return null;
    if (r.rings.length === 1) return r.rings[0];
    return r.rings[Math.min(r.rings.length - 1, this.breath.cycle - 1)];
  }
  /** the next place the descent reaches */
  get nextPlace(): PlaceId {
    for (const pl of PLACES.slice(1)) if (PLACE_AT[pl] > this.prog.descent + 1e-6) return pl;
    return 'heart';
  }
  /** rings shown as lit from earlier sessions (the way resumed past them) */
  remembered(r: Ring): boolean { return 2 + r < this.from && !(r === 4 && this.skip4); }
  /** ring 4 is out of this way */
  ringOut(r: Ring): boolean { return r === 4 && this.skip4; }
  /** a way stage's state for the lists: walked (earlier or now), now, waiting, left out today */
  wayState(i: number): 'done' | 'now' | 'wait' | 'out' {
    if (i === 6 && this.skip4) return 'out';
    if (this.wayDone || this.walkedNow.includes(i) || i < this.from) return 'done';
    const r = this.run;
    const cur = r && r.kind !== 'more' && r.kind !== 'close' ? r.way : null;
    // the stage walked now (the re-entry's: the one it leads to); between stages and in the close the next one
    return (cur ?? this.wayIdx) === i ? 'now' : 'wait';
  }
  /** the narrator must wait */
  get talkBlocked(): boolean {
    if (this.story || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec || this.titleOn;
  }
  /** a stage's title card is up (its first seconds) */
  get titleOn(): boolean {
    const r = this.run;
    return !!r && this.phase === 'play' && !this.story && this.t - r.t0 < this.titleSec(r);
  }
  /** The title card's alpha now: in over half a second, out over the last 0.8 s of its time (0: not shown). */
  get titleK(): number {
    const r = this.run;
    if (!r || !this.titleOn) return 0;
    const age = this.t - r.t0, dur = this.titleSec(r);
    return clamp(Math.min(age / 0.5, (dur - age) / 0.8));
  }
  private titleSec(r: StageRun): number {
    const c = this.titleOf(r);
    return Math.min(6, readTime(`${c.kicker} ${c.title} ${c.sub}`));
  }
  /** The stage's title card. */
  titleOf(r: StageRun | null = this.run): TitleCard {
    if (!r) return { kicker: '', title: '', sub: '' };
    switch (r.kind) {
      case 'reentry': return { kicker: t('stage.first'), title: t('stage.reentry'), sub: t('stage.then', { stage: `${stageOf(r.way ?? 0)} · ${stageTitle(r.way ?? 0)}` }) };
      case 'more': return { kicker: t('stage.after'), title: r.arc ? t('card.moreFor', { who: arcName(r.arc) }) : t('card.more'), sub: '' };
      case 'close': return { kicker: t('stage.last'), title: t('stage.close'), sub: '' };
      default: return { kicker: stageOf(r.way ?? 0), title: stageTitle(r.way ?? 0), sub: '' };
    }
  }
  /** The HUD's sub-line: the stage ("Etap 4 z 9 · Krąg 1"), the re-entry, the world, the return. */
  get subLine(): string {
    const r = this.run;
    if (!r) return t('sub.descent');
    switch (r.kind) {
      case 'reentry': return t('stage.reentry');
      case 'more': return t('sub.more');
      case 'close': return t('sub.back');
      default: return t('sub.stage', { n: (r.way ?? 0) + 1, of: WAY_LEN, name: subName(r.way ?? 0) });
    }
  }
  /** the rest's breath guide: the phase, how far, the lungs, which breath of how many */
  get breath(): BreathState & { cycle: number; cycles: number } {
    const b = breathAt(this.pattern, this.breathT);
    const cycles = Math.max(1, this.block.cycles || 1);
    return { ...b, cycle: Math.min(cycles, b.n + 1), cycles };
  }
  /** the heart word's breath in pushes and around (the same pattern, free-running) */
  get wordBreath(): BreathState { return breathAt(this.pattern, this.wordT); }

  /** What to do now, in one short line's key. */
  get now(): NowWhat {
    if (this.phase !== 'play') return 'end';
    const b = this.block;
    if (b.kind === 'warmup') return 'warm';
    if (b.kind === 'rest') {
      const k = b.step?.rest;
      if (b.why === 'valve') return 'valve';
      return k === 'grat' ? 'grat' : k === 'stop' || k === 'word' || k === 'more' || k === 'enter' ? 'stop' : 'rest';
    }
    if (this.unrelT > 2.5) return 'nosig';
    if (this.abiding) return 'abide';
    const st = this.stage;
    const r = stageRing(st);
    if (r) return this.prog[st] < RULES.reachShare ? 'reach' : 'kindle';
    return st as NowWhat;
  }

  /** The "now" line in words. */
  get nowText(): string {
    const w = this.now;
    const r = this.ring;
    return t(`now.${w}` as Key, { place: t(`place.${this.nextPlace}` as Key), ring: r ? ringName(r) : '' });
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.firstEver && this.plan.warmBlock > 0) {
      this.open('warmup');
      this.tip = this.tipNow();
    } else this.openNext();
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { page: 0, t: 0 };
      this.emit({ type: 'story', page: 0 });
      this.talk.ask('open', 3, 60);
    } else this.talk.ask(this.from > 0 ? 'resume' : 'descend', 2, 12);
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    if (this.reliable) {
      this.level = clamp(f.level);
      this.focused = f.focused;
      this.hold = Math.max(0, f.hold);
    } else {
      this.focused = false;
      this.hold = 0;
    }
    if (this.phase === 'play') this.schedule(dt, f, now);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateStory(dt);
    if (!this.story) this.updateWay(dt);
    this.updateAbide(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    this.talk.update(dt, now, this.talkBlocked);
  }

  private updateLight(dt: number, f: FocusFrame): void {
    const target = this.sighted && this.reliable ? clamp(f.level) : this.restBlock ? RULES.restGlow : RULES.baseGlow;
    this.glow = approach(this.glow, target, dt, RULES.glowTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    this.deep = this.deepening ? Math.min(1, this.deep + dt / RULES.deepSec) : Math.max(0, this.deep - dt / RULES.deepFade);
    const gold = this.moving;
    if (gold !== this.gold) {
      this.gold = gold;
      this.emit({ type: 'gold', on: gold });
    }
    if (gold) this.goldSec += dt;
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
    this.waitRun = this.sighted && this.reliable && !gold && !this.abiding ? this.waitRun + dt : 0;
    if (this.waitRun >= RULES.waitSec && !this.waitSaid) {
      this.waitSaid = true;
      this.talk.ask('wait', 2, 6);
    }
    if (this.sighted && this.blockT >= this.lead + 0.5 && !this.abiding) this.coach('light');
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 2, 6);
    }
  }

  private updateBreath(dt: number): void {
    this.wordT += dt;
    if (!this.restBlock) return;
    const before = breathAt(this.pattern, this.breathT);
    this.breathT += dt;
    const now = breathAt(this.pattern, this.breathT);
    if (before.phase !== now.phase || before.n !== now.n) this.emit({ type: 'breathTurn', phase: now.phase, len: this.pattern[now.phase] });
    if (before.n !== now.n) {
      this.emit({ type: 'line', key: this.words().key });
      // the close is due: a rest is cut at a whole breath
      if (this.cutDue) this.cutToClose();
    }
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= pageTime(s.page)) this.turnStory();
  }

  private turnStory(): void {
    const s = this.story;
    if (!s) return;
    if (s.page + 1 < STORY_PAGES) {
      s.page++;
      s.t = 0;
      this.emit({ type: 'story', page: s.page });
      return;
    }
    this.story = null;
    this.talk.ask('descend', 2, 10);
    this.coach('tap');
  }

  // ── the way ────────────────────────────────────────────────────
  /** Held units a second now: the founder's rule in a push past its lead-in with a reliable signal; nothing elsewhere. */
  rate(): number {
    if (!this.pushBlock || this.blockT < this.lead || !this.reliable || this.abiding) return 0;
    return focusRate(this.level, this.focused, this.hold);
  }

  private updateWay(dt: number): void {
    const n = this.rate() * dt;
    if (n > 0) this.advance(n);
  }

  /** The light walks: units go into the current push step, on into the next push step of the same block. */
  private advance(units: number): void {
    let left = units;
    let guard = 0;
    while (left > 1e-12 && guard++ < 50) {
      const st = this.step;
      if (!st || st.kind !== 'push' || !this.pushBlock || this.abiding || st.abide) return;
      this.stallT = 0;
      const take = Math.min(left, Math.max(0, st.need - this.stepDone));
      this.stepDone += take;
      left -= take;
      this.prog[st.stage] = Math.max(this.prog[st.stage], st.from + (st.to - st.from) * clamp(this.stepDone / Math.max(1e-9, st.need)));
      this.tally(st.stage);
      if (this.stepDone < st.need - 1e-9) return;
      this.completeStep();
    }
  }

  /** The lights a stage's progress has kindled: places, lamps, the heart, the field, the sun — each once. */
  private tally(stage: StageId): void {
    const k = this.prog[stage];
    if (stage === 'descent') {
      const passed = PLACES.slice(1).filter(pl => PLACE_AT[pl] <= k + 1e-9).length;
      while (this.placesPassed < passed) {
        this.placesPassed++;
        this.lights++;
        const pl = PLACES[this.placesPassed];
        this.emit({ type: 'place', place: pl });
        if (this.placesPassed === 2) this.talk.ask('settle', 1, 8);
      }
      return;
    }
    const r = stageRing(stage);
    if (r) {
      const reach = clamp(k / RULES.reachShare);
      if (reach >= 1 && this.lit[r] === 0 && !this.reachedFlag[r]) {
        this.reachedFlag[r] = true;
        this.emit({ type: 'reach', ring: r });
      }
      const total = this.lampTotal(r);
      const want = k <= RULES.reachShare ? 0 : Math.min(total, Math.floor(((k - RULES.reachShare) / (1 - RULES.reachShare)) * total + 1e-6));
      while (this.lit[r] < want) {
        this.lit[r]++;
        this.lights++;
        this.emit({ type: 'lamp', ring: r, i: this.lit[r] - 1, of: total });
      }
      return;
    }
    if (stage === 'more') {
      const want = Math.floor(k * RULES.moreLights + 1e-6);
      while (this.moreStep < want) {
        this.moreStep++;
        this.moreLights++;
        this.lights++;
        this.emit({ type: 'more', n: this.moreLights });
      }
    }
  }
  private readonly reachedFlag: Record<number, boolean> = {};
  private moreStep = 0;

  /** Lamps of a ring this session (ring 5: the world's lights and, from 3-minute stages, the five named arcs). */
  lampTotal(r: Ring): number { return this.plan.lamps[r] + (r === 5 && this.plan.arcs ? 5 : 0); }

  /**
   * A push step is walked: its stage may be complete; the next step (a push goes on in this block); at the block's
   * last push the stage's light may be all walked — then the push ends now if its least length has passed, else the
   * player abides in it until then.
   */
  private completeStep(): void {
    const st = this.step as PushStep;
    this.prog[st.stage] = Math.max(this.prog[st.stage], st.to);
    this.tally(st.stage);
    if (st.to >= 1 - 1e-9) this.stageDone(st.stage);
    const next = this.steps[this.stepIdx + 1];
    if (!next || next.kind === 'rest') {
      const r = this.run;
      if (r && this.stepIdx + 2 >= r.i1) this.goalMet(r);
      if (this.blockT >= this.blockMin) this.pushOver();
      else this.beginAbide();
      return;
    }
    this.stepIdx++;
    this.stepDone = 0;
    if (next.stage !== st.stage) this.enterStage(next.stage);
  }

  /** The push's light is met before its least length: the player abides (no light moves) until it has passed. */
  private beginAbide(): void {
    if (this.abiding) return;
    this.abiding = true;
    this.emit({ type: 'abide' });
    const s = this.stage;
    this.talk.ask(stageRing(s) ? 'abideRing' : 'abide', 1.5, 12);
  }

  /** The push is over: on to the rest after it. */
  private pushOver(): void {
    this.abiding = false;
    this.stepIdx++;
    this.stepDone = 0;
    this.endPush('step');
  }

  /** A stage's light is all walked: a way stage is walked (the next session goes on after it), the way may be whole. */
  private goalMet(r: StageRun): void {
    if (r.goal) return;
    r.goal = true;
    r.tGoal = this.t;
    if (r.kind === 'reentry' || r.kind === 'close' || r.kind === 'more' || r.way === null) return;
    this.walkedNow.push(r.way);
    this.wayIdx = nextWay(r.way, this.skip4);
    if (r.way === WAY_LEN - 1 && !this.wayDone) {
      this.wayDone = true;
      this.emit({ type: 'way' });
    }
  }

  private stageDone(s: StageId): void {
    switch (s) {
      case 'descent': break;
      case 'heart':
        this.lights++;
        this.emit({ type: 'kindled' });
        this.talk.ask('heart', 2, 8);
        break;
      case 'field':
        this.lights++;
        this.reachedNow = Math.max(this.reachedNow, 0);
        this.emit({ type: 'whole' });
        this.talk.ask('whole', 2, 8);
        break;
      case 'sun':
        this.lights++;
        this.emit({ type: 'sunUp' });
        break;
      case 'pervade':
        this.emit({ type: 'pervaded' });
        break;
      case 'back':
        this.emit({ type: 'home' });
        this.talk.ask('home', 2, 8);
        break;
      case 'more': break;
      default: {
        const r = stageRing(s);
        if (r) {
          this.reachedNow = Math.max(this.reachedNow, r);
          this.emit({ type: 'ringDone', ring: r });
        }
      }
    }
  }

  /** A new part of the way begins in this push (or the next): the tip and a word. */
  private enterStage(s: StageId): void {
    this.emit({ type: 'stage', stage: s });
    // what the narrator meant to say about the stages behind is stale now
    this.talk.drop(STAGE_MOMENTS.filter(m => m !== s));
    this.tip = this.tipNow();
    if (this.step?.kind === 'push' && this.step.abide) return;
    const r = stageRing(s);
    if (r) {
      this.talk.ask(ringStage(r) as Moment, 2, 10);
      if (r === 4) this.coach('ring4');
    } else if (s === 'heart' || s === 'field' || s === 'sun' || s === 'pervade' || s === 'back' || s === 'more') {
      this.talk.ask(s === 'heart' ? 'heart' : s as Moment, s === 'field' ? 2 : 1.5, 8);
    }
  }

  // ── stages ─────────────────────────────────────────────────────
  /** The moment the close must begin at the latest (s of play). */
  private get closeAt(): number { return this.plannedSec - this.plan.finale - closeMin(this.pattern, this.eeg, this.plannedSec); }

  /** Open a stage: its steps go onto the way, its title card shows. */
  private openStage(kind: StageKind, min: number, way: number | null, extra: { arc?: ArcId; whole?: boolean; abideOn?: StageId; cap?: number } = {}): void {
    const sp = stagePlan({
      kind, way, min, push: this.plan.push, breaths: this.plan.breaths, pattern: this.pattern, eeg: this.eeg, session: this.session, ...extra,
    });
    const i0 = this.steps.length;
    this.steps.push(...sp.steps);
    const run: StageRun = { kind, way, min, len: sp.len, t0: this.t, i0, i1: this.steps.length, goal: false, tGoal: null, t1: null, ...(extra.arc ? { arc: extra.arc } : {}) };
    this.runs.push(run);
    this.stepIdx = i0;
    this.stepDone = 0;
    this.deep = 0;
    this.emit({ type: 'stageOpen', run });
  }

  /**
   * The next stage of the session (`stageLen`: only with ≥ 2:00 left before the close, the first always): the re-entry
   * of a resumed way first, the way's next stage, a "more" stage after a whole way — or the close.
   */
  private openNextStage(): void {
    if (this.inClose) return;
    const first = !this.runs.some(r => r.kind !== 'reentry');
    if (this.from > 0 && !this.runs.length) {
      const avail = this.closeAt - this.t;
      const R = reentrySec(this.plannedSec, avail, this.plan.stageSec, this.pattern, this.eeg);
      this.openStage('reentry', R, this.from);
      return;
    }
    const left = this.closeAt - this.t;
    const M = stageLen(left, this.plan.stageSec, first);
    if (M === null) {
      this.openClose();
      return;
    }
    // a long blessing may carry a stage past its length — never so far that the next stage no longer fits
    const cap = stageCap(left, M);
    if (this.wayIdx < WAY_LEN) this.openStage(WAY[this.wayIdx], M, this.wayIdx, { cap });
    else {
      const arc = ARCS[this.moreRounds++ % ARCS.length];
      this.prog.more = 0;
      this.moreStep = 0;
      this.openStage('more', M, null, { arc, cap });
    }
  }

  /** The close: a quiet abiding with the spare time, the return into the heart, the closing rest. */
  private openClose(): void {
    if (this.inClose) return;
    this.inClose = true;
    const spare = this.plannedSec - this.plan.finale - this.t;
    const last = [...this.steps].reverse().find((s): s is PushStep => s.kind === 'push' && !s.abide);
    this.openStage('close', spare, null, { whole: this.wayDone, abideOn: last?.stage ?? 'descent' });
    if (!this.wayDone) this.talk.ask('close', 2, 10);
  }

  /** The stage's last step is done: it ends; the next one (or the close, or the finale after the close). */
  private stageEnded(): void {
    const r = this.run;
    if (r && r.t1 === null) {
      r.t1 = this.t;
      this.emit({ type: 'stageEnd', run: r });
    }
  }

  /** Time is up for the stage that runs: it is cut (saved for the next session unless its light was met), the close. */
  private cutToClose(): void {
    this.cutDue = false;
    if (this.inClose || this.phase !== 'play') return;
    if (this.block.len === 0) this.endBlock('time');
    this.abiding = false;
    // the rest of the stage's steps are not walked today
    this.steps.length = Math.min(this.steps.length, this.stepIdx);
    const r = this.run;
    if (r) r.i1 = this.steps.length;
    this.stageEnded();
    this.openClose();
    this.openNext();
  }

  /** Open the block the way is at: a new stage's (or the close's) when the last one is done; the finale after the close. */
  private openNext(): void {
    if (this.phase !== 'play') return;
    if (this.stepIdx >= this.steps.length) {
      if (this.inClose) {
        this.beginFinale();
        return;
      }
      this.openNextStage();
    }
    const st = this.step;
    if (!st) {
      this.beginFinale();
      return;
    }
    if (st.kind === 'rest') this.openRest(st);
    else {
      const resumed = this.afterValve;
      this.open('push');
      if (!resumed) this.enterStage(st.stage);
    }
  }

  // ── the hands ──────────────────────────────────────────────────
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    this.reshow = RULES.reshowSec;
    this.emit({ type: 'tap' });
    return true;
  }

  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Spacebar') {
      if (down) this.stay();
      return true;
    }
    if (key === 'Enter') {
      if (down && this.story) this.stay();
      return !!this.story;
    }
    return false;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath');
    const toFinale = this.plannedSec - this.plan.finale - now;
    if (toFinale <= 0) {
      this.endBlock('time');
      this.beginFinale();
      return;
    }
    // the close must begin: a push is cut now, a rest at its breath's end (at most one breath late)
    if (!this.inClose && b.kind !== 'warmup' && now >= this.closeAt) {
      if (b.kind === 'push' || now >= this.closeAt + this.cyc) {
        this.cutToClose();
        return;
      }
      this.cutDue = true;
    }
    if (b.kind === 'push') {
      const st = this.step;
      // the close's return yields to its closing rest in time
      if (this.inClose && st?.kind === 'push' && !st.abide) {
        const amen = this.steps[this.steps.length - 1];
        const due = this.plannedSec - this.plan.finale - (amen?.kind === 'rest' ? amen.cycles * this.cyc : 0);
        if (now >= due) {
          this.pushOver();
          return;
        }
      }
      if (this.abiding) {
        this.telegraph(toFinale, this.blockMin - this.blockT, 'rest');
        if (this.blockT >= this.blockMin) this.pushOver();
        return;
      }
      this.stallT += dt;
      const k = st?.kind === 'push' ? this.stepDone / Math.max(1e-9, st.need) : 0;
      const lastBefore = this.steps[this.stepIdx + 1]?.kind !== 'push';
      const nearly = lastBefore && k >= R.telegraphAt;
      const cap = Math.max(R.valveMin, R.valveK * this.blockMin);
      const valveIn = Math.min(R.valveStall - this.stallT, nearly ? Infinity : cap - this.blockT);
      this.telegraph(toFinale, nearly ? Math.max(0, this.blockMin - this.blockT) : valveIn, 'rest');
      if (valveIn <= 0) this.valve();
      return;
    }
    // the warm-up waits for the opening card: the first push never begins under it
    if (b.kind === 'warmup' && this.story) b.dur = Math.max(b.dur, this.blockT + R.telegraph + 2);
    this.telegraph(toFinale, b.dur - this.blockT, 'push');
    if (this.blockT >= b.dur) {
      this.endBlock(null);
      if (b.kind === 'rest') {
        this.restsDone++;
        if (b.why === 'valve') this.afterValve = true;
        else this.restEnded();
      }
      this.openNext();
    }
  }

  /** A rest step's breaths are done: the way goes on; at a stage's end, the stage ends. */
  private restEnded(): void {
    this.stepIdx++;
    this.stepDone = 0;
    const r = this.run;
    if (r && this.stepIdx >= r.i1) this.stageEnded();
  }

  private telegraph(toFinale: number, toEnd: number, next: BlockKind): void {
    if (this.telegraphed || Math.min(toFinale, toEnd) > RULES.telegraph) return;
    this.telegraphed = true;
    this.nextKind = toFinale <= toEnd ? null : next;
    this.emit({ type: 'telegraph', next: this.nextKind });
  }

  /** A push that cannot finish: a rest of the heart word; the step keeps what it gained. */
  private valve(): void {
    this.endBlock('valve');
    this.valvesNow++;
    this.open('rest', 'valve', { kind: 'rest', rest: 'word', rings: [], cycles: Math.max(2, Math.round(20 / this.cyc)) });
    this.emit({ type: 'valve' });
    this.talk.ask('valve', 3, 10);
  }

  private endPush(why: 'step'): void {
    if (!this.pushBlock) return;
    this.endBlock(why);
    const st = this.step;
    if (st?.kind === 'rest') this.openRest(st);
    else this.openNext();
  }

  private openRest(st: RestStep): void {
    this.open('rest', 'step', st);
  }

  private open(kind: BlockKind, why: BlockWhy | null = null, step: RestStep | null = null): void {
    const cycles = kind === 'rest' && step ? step.cycles : 0;
    const dur = kind === 'warmup' ? this.plan.warmBlock : kind === 'rest' ? breathRestOf(this.pattern, cycles).sec : Infinity;
    const b: Block = { kind, dur, cycles, why, len: 0, step };
    this.blockList.push(b);
    this.blockIndex = this.blockList.length - 1;
    this.blockT = 0;
    this.telegraphed = false;
    this.nextKind = null;
    this.stallT = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.goldRun = 0;
    this.waitRun = 0;
    this.abiding = false;
    if (kind === 'push') {
      this.pushesBegun++;
      const st = this.step;
      // a push going on after the valve's rest: until its step is walked (its least length was spent)
      this.blockMin = this.afterValve ? this.lead + RULES.pushSighted : st?.kind === 'push' ? st.min : this.lead + RULES.pushSighted;
      this.afterValve = false;
      if (st?.kind === 'push' && (st.abide || this.stepDone >= st.need - 1e-9)) this.abiding = true;
    }
    if (kind === 'rest') this.breathT = 0;
    this.tip = this.tipNow();
    this.emit({ type: 'blockStart', block: b, index: this.blockIndex });
    if (kind === 'rest') {
      const first0 = breathAt(this.pattern, 0).phase;
      this.emit({ type: 'breathTurn', phase: first0, len: this.pattern[first0] });
      this.emit({ type: 'line', key: this.words().key });
      if (step?.rest === 'bless' && step.rings.includes(1) && namesCount(this.p) === 0) this.coach('names');
    }
  }

  /** The block's strategy line (the runner's panel shows it). */
  private tipNow(): string {
    const b = this.block;
    if (b.kind === 'warmup') return t('tip.warm');
    if (b.kind === 'rest') return restTip(b.step?.rest ?? 'word', this.restsDone);
    if (this.abiding) return t('tip.abide');
    const st = this.step;
    return pushTip(this.stage, this.nextPlace, this.pushesBegun, st?.kind === 'push' && st.arc ? arcName(st.arc) : '');
  }

  private endBlock(why: BlockWhy | null): void {
    const b = this.block;
    if (b.len > 0 || !this.blockList.length) return;
    b.len = Math.max(1e-6, this.blockT);
    if (b.kind === 'push') b.why = why;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      const short = b.kind === 'push' && b.len < RULES.minPush;
      share = this.judge.share;
      verdict = !short && this.judge.measured >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest' && verdict) this.passedRests++;
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    // the closing words stay on the card through the finale
    if (this.restBlock) this.lastWords = this.words();
    this.phase = 'finale';
    this.abiding = false;
    this.telegraphed = false;
    this.stageEnded();
    this.emit({ type: 'finale' });
    this.talk.ask('end', 3, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'done' });
  }

  private updateAbide(dt: number): void {
    if (!this.restBlock) {
      this.abideRun = 0;
      this.abideGap = 0;
      return;
    }
    if (this.reliable && this.calmShown >= 0.5) {
      this.abideRun += dt;
      this.abideNow += dt;
      this.abideGap = 0;
    } else {
      this.abideGap += dt;
      if (this.abideGap > 2) this.abideRun = 0;
    }
    this.longestNow = Math.max(this.longestNow, this.abideRun);
  }

  /**
   * Where the next session goes on: after a whole way from the start; else the stage after the last one walked today
   * (ring 4 left out today stays the next stage — it is back tomorrow); nothing walked: where this one began.
   */
  get nextStage(): number {
    if (this.wayDone) return 0;
    if (this.walkedNow.length) return Math.min(WAY_LEN - 1, Math.max(...this.walkedNow) + 1);
    return this.savedNext;
  }

  /** The session's counters reach the progress once (at the end, or early with finish()). */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.lights += this.score;
    if (this.wayDone) p.ways++;
    p.stages += this.walkedNow.length;
    const rem = indexRing(this.from - 1);
    p.reach = Math.max(p.reach, this.reachedNow, rem ?? (this.from - 1 === 2 ? 0 : -1));
    p.lastLen = this.plannedSec;
    if (this.started) p.next = this.nextStage;
  }

  finish(): void { this.end(); }

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach): void {
    if (this.story) return;
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what });
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.tap.keys');
    return t(`coach.${what}` as Key);
  }

  // ── the words on the card ──────────────────────────────────────
  /** What a rest shows breath by breath: its lines, then its verse, then the heart word. */
  restItems(st: RestStep): RestItem[] { return restSeq(st, this.session); }

  /** The item of the rest for its n-th breath. */
  restItemAt(st: RestStep, n: number): RestItem { return restAt(st, this.session, n); }

  /** The words on the card now. */
  words(): Words {
    if (this.phase !== 'play' && this.lastWords) return this.lastWords;
    const hw = heartWord(this.word, this.own);
    const wordHalf = (b: BreathState): 'in' | 'out' => (b.phase === 'in' || b.phase === 'holdIn' ? 'in' : 'out');
    const rest = this.rest;
    if (rest) {
      const b = this.breath;
      const item = this.restItemAt(rest, b.cycle - 1);
      const head = this.restHead(rest);
      if (item.verse) return { head, main: '', second: '', word: null, verse: item.verse, key: `r${this.blockIndex}v` };
      if (item.word) return { head, main: hw.in, second: hw.out, word: wordHalf(b), verse: null, key: `r${this.blockIndex}w` };
      return { head, main: item.text ?? '', second: '', word: null, verse: null, key: `r${this.blockIndex}l${item.text}` };
    }
    const head = this.pushHead();
    return { head, main: hw.in, second: hw.out, word: wordHalf(this.wordBreath), verse: null, key: `p${head}` };
  }

  private restHead(st: RestStep): string {
    if (this.block.why === 'valve') return t('card.valve');
    switch (st.rest) {
      case 'bless': return t('card.bless', { ring: ringName(this.blessRing ?? st.rings[0] ?? 0) });
      case 'grat': return t('card.grat');
      case 'sun': return t('card.sun');
      case 'amen': return t('card.amen');
      case 'arrive': return t('card.arrive');
      case 'pervade': return t('card.pervade');
      case 'enter': return t('card.enter');
      case 'stop': return t('card.stop', { place: t(`place.${st.place ?? 'mouth'}` as Key) });
      case 'more': return st.arc ? t('card.moreFor', { who: arcName(st.arc) }) : t('card.more');
      default: return t('card.word');
    }
  }

  private pushHead(): string {
    if (this.block.kind === 'warmup' || this.phase !== 'play') return t('card.word');
    const st = this.stage;
    const r = stageRing(st);
    if (r) return t('card.ring', { n: r, ring: ringName(r) });
    if (st === 'descent') return t('card.descent', { place: t(`place.${this.nextPlace}` as Key) });
    const arc = this.step?.kind === 'push' ? this.step.arc : undefined;
    if (st === 'more' && arc) return t('card.moreFor', { who: arcName(arc) });
    return t(`card.${st}` as Key);
  }

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.level);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.glow);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The furthest the way went this session, for the summary (−1 nothing; 0 the field; 1–5 a ring). */
  get furthest(): number { return this.reachedNow; }

  /** Way stages walked today and how long they lasted on average (s). */
  get stagesNow(): { n: number; avg: number } {
    // a walked stage still saying its blessing counts up to now
    const done = this.runs.filter(r => r.goal && r.way !== null && r.kind !== 'reentry' && r.kind !== 'more' && r.kind !== 'close');
    const n = this.walkedNow.length;
    return { n, avg: done.length ? done.reduce((a, r) => a + ((r.t1 ?? this.t) - r.t0), 0) / done.length : 0 };
  }

  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const today = this.stagesNow;
    const way = this.wayDone ? WAY_LEN : this.nextStage;
    const stats: [string, string][] = [
      [t('stat.stages'), today.n ? t('stat.stagesV', { n: today.n, len: secText(today.avg) }) : '—'],
      [t('stat.way'), t('stat.wayV', { n: way, of: WAY_LEN })],
      [t('stat.blessings'), String(this.restsDone)],
      [t('stat.moving'), secText(this.goldSec)],
      [t('stat.abide'), secText(this.abideNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The summary's verse by how far the way went (in turn from session to session). */
  closingVerse(): PassageId {
    const n = this.session || 1;
    if (this.wayDone) return inTurn(['eph3.17-19', '1co13.13', 'col3.14', 'num6.24-26'], n);
    const far = this.reachedNow;
    if (far >= 1) return verseFor(`ring${far}` as VerseKey, n);
    if (far === 0) return verseFor('ring0', n);
    if (this.prog.heart >= 1) return verseFor('heart', n);
    if (this.prog.descent > 0) return verseFor('descent', n);
    return '1jn4.16';
  }

  private highlights(): string[] {
    const out: string[] = [];
    if (this.wayDone) out.push(t('hl.way'));
    else if (this.walkedNow.length) out.push(t('hl.today', { list: this.walkedNow.map(stageLabel).join(' · ') }));
    else if (this.started) out.push(t('hl.calm'));
    if (this.started) out.push(t('hl.next', { stage: stageTitle(this.nextStage) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) out.push(t('hl.record', { lights: lightsText(this.score) }));
    if (this.moreLights > 0) out.push(t('hl.more', { lights: lightsText(this.moreLights) }));
    const named = ([1, 2, 3, 4] as Ring[]).reduce((n, r) => n + Math.min(namesOf(this.p, r).length, this.lit[r]), 0);
    if (named > 0) out.push(t('hl.names', { n: named }));
    if (this.skip4) out.push(t('hl.skip4'));
    if (this.restsDone > 0) out.push(t('hl.rests', { n: this.restsDone }));
    return out.slice(0, 5);
  }
}

/** A way stage's short name for the HUD's sub-line: "Zejście", "Serce", "Krąg 0"…"Krąg 5", "Słońce". */
export function subName(i: number): string {
  const r = indexRing(i);
  if (r) return t('sub.ringN', { n: r });
  const w = WAY[Math.max(0, Math.min(WAY_LEN - 1, i))];
  return w === 'field' ? t('sub.ringN', { n: 0 }) : w === 'sun' ? t('sub.sunShort') : t(`sub.${w}` as Key);
}

/** The narrator's lines of a moment, in this page load's language. */
export function linesOf(m: Moment): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const k = `say.${m}.${i}` as Key;
    const s = t(k);
    if (s && s !== k) out.push(s);
  }
  return out;
}

export type { PushStep, RestStep, Step, RestKind, RestItem };
