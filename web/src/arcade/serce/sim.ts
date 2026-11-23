/**
 * Z głowy do serca's session, without the DOM (DESIGN.md §18).  The way (plan.ts) is a list of steps over the
 * session's length: pushes that need held-focus units and rests of whole breaths.
 *
 *   a push block           the light walks its steps: down the midline from the brow to the heart, the flame kindles,
 *   (past its lead-in,     the heart's field fills the figure and closes round it, widens to each ring and lights its
 *   a reliable signal,     lamps, the sun rises over all of them, the four dimensions, the light gathers back into the
 *   focused)               heart — only then (rules.ts `focusRate`); without focus it waits, never goes back
 *   a rest block           whole breaths of the player's pattern (5 · 5 by default): the ring's blessing one line per
 *                          breath, then its verse; gratitude at the heart; the heart word at the descent's stops
 *   the safety valve       a push that cannot finish (60 s without light, 150 s in all) gives way to a rest of the
 *                          heart word; the step keeps what it gained, the next push goes on with it
 *   the hands              a tap (Space, a click) stays with the words: they glow again, a ring of light, a bell —
 *                          never light; it turns a story card's page
 *
 * Each block is judged once at its end over its last ≤ 15 s (`RoundJudge.from(tuning)`; a push under 10 s is not
 * judged), `BlockContrast` for the summary.  A 4 s telegraph announces the rest when the step before it is 85 % done,
 * and the next push 4 s before the rest's last breath ends.  After the whole way, if time is left, "more" rounds
 * kindle more lights on the Earth.  The headline is the lights kindled (świateł).  An unreliable signal freezes the
 * light — nothing is lost, nothing moves.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathRestOf, type BreathPattern, type BreathPhase, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ARCS, BLESS_LINES, PLACES, arcName, blessLine, fromRing, heartWord, pushTip, restTip, ringName, ringStage, stageRing, verseFor,
  type PlaceId, type RestKind, type Ring, type StageId, type VerseKey, type WordId,
} from './content';
import { lightsText, t, unit, type Key } from './i18n';
import { bestOf, lenKey, markSeen, namesCount, namesOf, skip4Today, startRing, type SerceProgress } from './meta';
import { PLACE_AT, buildPlan, moreNeed, type Plan, type PushStep, type RestStep, type Step } from './plan';
import { RULES, focusRate, readTime } from './rules';
import { Talk, type Moment } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export type BlockWhy = 'step' | 'valve' | 'time';
/** A block: `dur` its planned length (Infinity for a push), `len` how long it lasted, `step` a rest's step. */
export interface Block { kind: BlockKind; dur: number; cycles: number; why: BlockWhy | null; len: number; step: RestStep | null }

export type Coach = 'light' | 'breath' | 'tap' | 'ring4' | 'names';

/** The one short line of what to do now (it changes only when the action changes). */
export type NowWhat =
  | 'warm' | 'descent' | 'heart' | 'field' | 'reach' | 'kindle' | 'sun' | 'pervade' | 'back' | 'more'
  | 'rest' | 'grat' | 'stop' | 'valve' | 'nosig' | 'end';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
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
const STAGE_MOMENTS: readonly Moment[] = ['descend', 'settle', 'heart', 'field', 'whole', 'ring1', 'ring2', 'ring3', 'ring4', 'ring5', 'sun', 'pervade', 'back', 'more'];

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

/** What a rest shows breath by breath: its lines, then (if its breaths allow) its verse. */
export interface RestItem { text?: string; word?: boolean; verse?: PassageId }

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

export interface SimInit {
  progress: SerceProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** today ("YYYY-MM-DD"): ring 4 may be left out today */
  day: string;
  /**
   * The rest's rhythm the player set in the lobby (kit/rhythm.ts, `serceRhythm`): a blessing after how many circles,
   * and each rest's whole breaths — taken when the player moved a dial (`custom`); absent or as designed: the plan's
   * own budget.
   */
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
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
  /** each rest's whole breaths as the player set them (null: the plan's budget) */
  readonly restBreaths: number | null;
  readonly word: WordId;
  readonly own: string;
  readonly skip4: boolean;
  /** the ring the circles go on from (rings before it shine from earlier sessions) */
  readonly from: Ring;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly bestBefore: number | null;
  /** the way's steps (the plan's, and "more" rounds appended after it) */
  readonly steps: Step[];

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  private readonly blockList: Block[] = [];
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  nextKind: BlockKind | null = null;
  tip = '';
  private pushesBegun = 0;
  stallT = 0;
  // the way
  stepIdx = 0;
  /** held units done in the current push step */
  stepDone = 0;
  readonly prog: Prog = zeroProg();
  /** lamps lit per ring (index 1–5; ring 5 counts the world's lights and then the arcs), places passed */
  readonly lit = [0, 0, 0, 0, 0, 0];
  placesPassed = 0;
  moreLights = 0;
  wayDone = false;
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
    const sr = startRing(this.p);
    this.from = this.skip4 && sr === 4 ? 5 : sr;
    // a first session's warm-up waits for the opening card: the plan leaves room for its reading time
    const card = this.firstEver && !this.p.seen.includes('s.open') ? pageTime(0) + pageTime(1) + RULES.telegraph + 2 : 0;
    const rh = init.rhythm;
    this.restBreaths = rh && rh.custom !== false ? Math.max(1, Math.min(RULES.restBreathsMax, Math.round(rh.rest))) : null;
    this.plan = buildPlan({
      plannedSec: this.plannedSec, eeg: this.eeg, firstEver: this.firstEver, skip4: this.skip4, startRing: this.from, pattern: this.pattern, warmSec: card,
      circles: rh?.focus ?? 1, restBreaths: this.restBreaths,
    });
    this.steps = [...this.plan.steps];
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
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
  get moving(): boolean { return this.sighted && this.reliable && this.focused && !this.story; }
  get leadIn(): number { return this.lead; }
  get score(): number { return this.lights; }
  get step(): Step | null { return this.steps[this.stepIdx] ?? null; }
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
  /** In a blessing's rest, the ring whose line is said now (a shared rest of three rings: one ring a breath). */
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
  remembered(r: Ring): boolean { return r < this.from && !(r === 4 && this.skip4); }
  /** ring 4 is out of this way */
  ringOut(r: Ring): boolean { return r === 4 && this.skip4; }
  /** the narrator must wait */
  get talkBlocked(): boolean {
    if (this.story || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
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
      return k === 'grat' ? 'grat' : k === 'stop' || k === 'word' || k === 'more' ? 'stop' : 'rest';
    }
    if (this.unrelT > 2.5) return 'nosig';
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
    this.open(this.firstEver && this.plan.warmBlock > 0 ? 'warmup' : 'push');
    this.tip = this.tipNow();
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { page: 0, t: 0 };
      this.emit({ type: 'story', page: 0 });
      this.talk.ask('open', 3, 60);
    } else this.talk.ask(this.from > 1 ? 'resume' : 'descend', 2, 12);
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
    this.waitRun = this.sighted && this.reliable && !gold ? this.waitRun + dt : 0;
    if (this.waitRun >= RULES.waitSec && !this.waitSaid) {
      this.waitSaid = true;
      this.talk.ask('wait', 2, 6);
    }
    if (this.sighted && this.blockT >= this.lead + 0.5) this.coach('light');
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
    if (before.n !== now.n) this.emit({ type: 'line', key: this.words().key });
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
    if (!this.pushBlock || this.blockT < this.lead || !this.reliable) return 0;
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
      if (!st || st.kind !== 'push' || !this.pushBlock) return;
      this.stallT = 0;
      const take = Math.min(left, Math.max(0, st.need - this.stepDone));
      this.stepDone += take;
      left -= take;
      this.prog[st.stage] = Math.max(this.prog[st.stage], st.from + (st.to - st.from) * clamp(this.stepDone / st.need));
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

  /** Lamps of a ring this session (ring 5: the world's lights and, in long sessions, the five named arcs). */
  lampTotal(r: Ring): number { return this.plan.lamps[r] + (r === 5 && this.plan.arcs ? 5 : 0); }

  /** A push step is walked: its stage may be complete; the next step (a push goes on in this block, a rest ends it). */
  private completeStep(): void {
    const st = this.step as PushStep;
    this.prog[st.stage] = Math.max(this.prog[st.stage], st.to);
    this.tally(st.stage);
    if (st.to >= 1 - 1e-9) this.stageDone(st.stage);
    this.stepIdx++;
    this.stepDone = 0;
    const next = this.step;
    if (!next) {
      this.wayEnd();
      return;
    }
    if (next.kind === 'rest') {
      this.endPush('step');
      return;
    }
    if (next.stage !== st.stage) this.enterStage(next.stage);
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

  /** A new stage begins in this push (or the next): the tip and a word. */
  private enterStage(s: StageId): void {
    this.emit({ type: 'stage', stage: s });
    // what the narrator meant to say about the stages behind is stale now
    this.talk.drop(STAGE_MOMENTS.filter(m => m !== s));
    this.tip = this.tipNow();
    const r = stageRing(s);
    if (r) {
      this.talk.ask(ringStage(r) as Moment, 2, 10);
      if (r === 4) this.coach('ring4');
    } else if (s === 'heart' || s === 'field' || s === 'sun' || s === 'pervade' || s === 'back' || s === 'more') {
      this.talk.ask(s === 'heart' ? 'heart' : s as Moment, s === 'field' ? 2 : 1.5, 8);
    }
  }

  /** The plan is walked (its last rest ended, or its last push): the way is whole; more rounds if time is left. */
  private wayEnd(): void {
    if (!this.wayDone) {
      this.wayDone = true;
      this.emit({ type: 'way' });
    }
    this.appendMore();
    const next = this.step;
    if (this.pushBlock && next?.kind === 'push') {
      if (next.stage !== this.stage || this.prog.more === 0) this.enterStage(next.stage);
    } else if (this.pushBlock) this.endPush('step');
  }

  /**
   * A "more" round: a push that kindles more lights on the Earth for one group of people in turn — those who suffer,
   * the lonely, the sick, the dying, children being born — and a rest that blesses them, then the heart word.
   */
  private appendMore(): void {
    this.prog.more = 0;
    this.moreStep = 0;
    const arc = ARCS[this.moreRounds++ % ARCS.length];
    const cyc = breathRestOf(this.pattern, 1).sec;
    this.steps.push(
      { kind: 'push', stage: 'more', from: 0, to: 1, need: moreNeed(this.plan), arc },
      { kind: 'rest', rest: 'more', rings: [], cycles: this.restBreaths ?? Math.max(2, Math.round(16 / cyc)), arc },
    );
  }
  private moreRounds = 0;

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
    if (b.kind === 'push') {
      this.stallT += dt;
      const st = this.step;
      const k = st?.kind === 'push' ? this.stepDone / st.need : 0;
      const lastBefore = this.steps[this.stepIdx + 1]?.kind !== 'push';
      const nearly = lastBefore && k >= R.telegraphAt;
      const valveIn = Math.min(R.valveStall - this.stallT, nearly ? Infinity : R.valveSec - this.blockT);
      this.telegraph(toFinale, nearly ? 0 : valveIn, 'rest');
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
        if (b.why !== 'valve') this.restEnded();
      }
      // the next push walks the step the way is at
      if (this.step?.kind === 'rest') this.openRest(this.step);
      else {
        this.open('push');
        const st = this.step;
        if (st?.kind === 'push' && b.kind === 'rest' && b.why !== 'valve') this.enterStage(st.stage);
      }
    }
  }

  /** A rest step's breaths are done: the way goes on (or is whole). */
  private restEnded(): void {
    this.stepIdx++;
    this.stepDone = 0;
    if (!this.step) this.wayEnd();
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
    const cyc = breathRestOf(this.pattern, 1).sec;
    this.open('rest', 'valve', { kind: 'rest', rest: 'word', rings: [], cycles: Math.max(2, Math.round(20 / cyc)) });
    this.emit({ type: 'valve' });
    this.talk.ask('valve', 3, 10);
  }

  private endPush(why: 'step'): void {
    if (!this.pushBlock) return;
    this.endBlock(why);
    const st = this.step;
    if (st?.kind === 'rest') this.openRest(st);
    else this.open('push');
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
    if (kind === 'push') this.pushesBegun++;
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
    this.phase = 'finale';
    this.telegraphed = false;
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

  /** Where the circles go on next session: the ring the way stopped in (null after ring 5, or a whole way). */
  get nextFrom(): Ring | null {
    if (this.wayDone || this.reachedNow >= 5) return null;
    if (this.reachedNow < 1) return this.p.pos?.ring ?? (this.from > 1 ? this.from : null);
    const after = this.plan.rings.find(r => r > this.reachedNow);
    return after ?? null;
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
    p.reach = Math.max(p.reach, this.reachedNow, this.from > 1 ? this.from - 1 : -1);
    p.lastLen = this.plannedSec;
    if (this.started) {
      const nf = this.nextFrom;
      p.pos = nf && nf > 1 ? { ring: nf } : null;
    }
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
  /** What a rest shows breath by breath: its lines, then its verse when its breaths allow. */
  restItems(st: RestStep): RestItem[] {
    const items: RestItem[] = [];
    let verse: PassageId | null = null;
    switch (st.rest) {
      case 'bless': {
        const many = st.rings.length > 1;
        for (const r of st.rings) {
          const n = many ? 1 : BLESS_LINES[r];
          for (let i = 0; i < n; i++) items.push({ text: blessLine(r, i) });
        }
        const last = st.rings[st.rings.length - 1] ?? 0;
        verse = verseFor(`ring${last}` as VerseKey, this.session);
        break;
      }
      case 'grat': items.push({ text: t('grat.1') }, { text: t('grat.2') }); verse = verseFor('grat', this.session); break;
      case 'sun': items.push({ text: t('sun.1') }, { text: t('sun.2') }); verse = verseFor('sun', this.session); break;
      case 'amen':
        if (st.rings.includes(5)) items.push({ text: blessLine(5, 0) });
        items.push({ text: t('amen.1') });
        verse = 'num6.24-26';
        break;
      case 'stop': items.push(st.place === 'mouth' ? { word: true } : { text: t('stop.throat') }); break;
      case 'more':
        if (st.arc) items.push({ text: t(`more.${st.arc}` as Key) });
        items.push({ word: true });
        break;
      case 'word': items.push({ word: true }); break;
    }
    // the verse when there is a breath for it after the lines (two for a long one); the closing blessing always
    const long = verse ? passage(verse).text.length > 150 : false;
    if (verse && (st.rest === 'amen' || st.cycles >= items.length + (long ? 2 : 1))) items.push({ verse });
    return items;
  }

  /** The item of the rest for its n-th breath (lines one per breath, the verse stays for what is left). */
  restItemAt(st: RestStep, n: number): RestItem {
    const items = this.restItems(st);
    const hasVerse = !!items[items.length - 1]?.verse;
    const lines = hasVerse ? items.length - 1 : items.length;
    if (st.rest === 'amen' && hasVerse) {
      // the closing: its lines share the first breaths, the Aaronic blessing the rest (at least one breath)
      const forLines = Math.max(0, Math.min(lines, st.cycles - 1));
      return n < forLines ? items[n] : items[items.length - 1];
    }
    if (n < lines) return items[n];
    return hasVerse ? items[items.length - 1] : items[Math.max(0, lines - 1)];
  }

  /** The words on the card now. */
  words(): Words {
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
  get furthest(): number { return Math.max(this.reachedNow, this.from > 1 && this.reachedNow >= 0 ? this.from - 1 : -1); }

  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const far = this.reachedNow;
    const stats: [string, string][] = [
      [t('stat.reached'), far >= 1 ? t('sub.ring', { n: far }) : far === 0 ? ringName(0) : this.prog.heart >= 1 ? t('card.heart') : '—'],
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
    else if (this.reachedNow >= 1) out.push(t('hl.part', { ring: ringName(this.reachedNow as Ring) }));
    else if (this.reachedNow === 0) out.push(t('hl.whole'));
    else if (this.prog.heart >= 1) out.push(t('hl.heart'));
    else if (this.started) out.push(t('hl.calm'));
    const nf = this.nextFrom;
    if (this.started && nf && nf > 1) out.push(t('hl.next', { from: fromRing(nf) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) out.push(t('hl.record', { lights: lightsText(this.score) }));
    if (this.moreLights > 0) out.push(t('hl.more', { lights: lightsText(this.moreLights) }));
    const named = ([1, 2, 3, 4] as Ring[]).reduce((n, r) => n + Math.min(namesOf(this.p, r).length, this.lit[r]), 0);
    if (named > 0) out.push(t('hl.names', { n: named }));
    if (this.skip4) out.push(t('hl.skip4'));
    if (this.restsDone > 0) out.push(t('hl.rests', { n: this.restsDone }));
    return out.slice(0, 5);
  }
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

export type { Plan, PushStep, RestStep, Step, RestKind };
