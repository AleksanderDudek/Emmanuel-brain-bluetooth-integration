/**
 * Brzemiona's session, without the DOM (DESIGN.md §18): the player prays for the entries of their list one burden
 * at a time, carrying each to the Cross.
 *
 *   a burden            the call: the one prayed for appears, greyed in a cloud, and the address is said ("Panie
 *                       Jezu, przynoszę Ci to, co niesie Anna") — then its circles, as wide as the session allows:
 *                       the one, all who carry a burden like it, the whole world (rules.ts `depthFor`)
 *   a push = a circle   the exchange: the breath leads (the player's pattern, 5 · 5 by default) — on the in-breath
 *   (the exchange)      grey smoke lifts from them and drifts to the Cross, on the out-breath what turned to light
 *                       returns to them as peace; the turning happens only in a sighted push past its lead-in, with
 *                       a reliable signal, while focused (rules.ts `turnRate`, the level averaged over a whole
 *                       breath).  Without focus the smoke waits at the Cross — one puff, never more, never back,
 *                       never toward the player.  The push lasts until the circle is turned (x = 1)
 *   a rest              whole breaths of the player's pattern: peace returns, the Cross glows; after a burden's last
 *                       circle the rest is "Zostaw przy krzyżu" (1 P 5,7) and the next burden follows
 *   the safety valve    a push that cannot finish (60 s without light gained, 150 s in all) gives way to a rest; the
 *                       circle keeps its light
 *   the hands           ≡ chooses whom (the list), ◎ widens the circle now, ▶ moves to the next burden — at once in a
 *                       push or the warm-up, for the next push in a rest; a tap anywhere stays with them (their name
 *                       and the prayer glow) — never light
 *   the finale          everything left at the Cross (Mt 11,29-30), the closing prayer to the Father through Jesus in
 *                       the Spirit
 *
 * The own way (round 16, "Moje brzemiona"): the entries are the player's own topics, each a closed bundle on the
 * ground beside them; its circles are "Oddaję" (`give`: on the in-breath smoke lifts from the bundle — never from the
 * player — to the Cross, turns gold there while focus is held, and returns to the player as light on the out-breath)
 * and, from 10 minutes, "Przyjmuję" (`receive`: the light-only exchange, the Cross's peace to the player).  The same
 * numbers, rests, blocks and valve; a burden given leaves a small golden light at the foot of the Cross (the view);
 * the list walks in order, goes on where the last session stopped and starts again when it runs out.  Its result
 * never quotes a topic (only counts).
 *
 * The headline is the burdens carried (brzemion).  An unreliable signal freezes everything: nothing is lost, nothing
 * advances.  Deterministic for a given rng.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, breathRestOf, type BreathPattern, type BreathPhase, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CIRCLES, CLOSE_VERSES, FINALE_VERSE, LEAVE_VERSE, LIGHT_TIPS, OWN_CIRCLES, OWN_FINALE_VERSE, OWN_LIGHT_TIPS, OWN_MOMENT, OWN_PUSH_TIPS,
  OWN_REST_TIPS, OWN_WARM_TIP, PUSH_TIPS, REST_TIPS, WARM_TIP, allCirclesOf, circleIndex, circlesOf, itemKey, ownLeaveVerse, restVerse, verseFor,
  type Circle, type Item, type Moment, type Way,
} from './content';
import { breathWords as breathWordsOf, circleName, ownDefaults, t, unit, whoName, type Key } from './i18n';
import { bestOf, breathOf, lenKey, markSeen, ownStartOf, restOf, startOf, tallyOf, wayQueue, type BrzPos, type BrzProgress, type Tally } from './meta';
import { RULES, WindowMean, depthFor, needFor, readTime, turnRate } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
/** Why a push ended (its circle turned, the safety valve, the session's time). */
export type BlockWhy = 'done' | 'valve' | 'time';
/** A block: `dur` its planned length (the warm-up's, a rest's whole breaths) or Infinity for a push; `len` at its end. */
export interface Block { kind: BlockKind; dur: number; cycles: number; why: BlockWhy | null; len: number; leave: boolean }

/**
 * Where the prayer is: `call` (a new burden appears and the address is said), `widen` (the circle widens), `pray` (the
 * exchange), `peace` (a rest after a circle: the light returns), `leave` (a rest after the burden's last circle:
 * left at the Cross), `end` (the finale).
 */
export type Stage = 'call' | 'widen' | 'pray' | 'peace' | 'leave' | 'end';

/** The first-ever session's two pages (both ways, then care), or a returning player's first own session's two. */
export type StoryKind = 'open' | 'own';
export interface Story { kind: StoryKind; page: number; pages: number; t: number }

export type Coach = 'cross' | 'breath' | 'controls' | 'tap' | 'rest';
export type CoachAt = 'cross' | 'person' | 'controls' | 'band';

/** The one short line of what to do now: it changes only when the action changes. */
export type NowWhat = 'warm' | 'call' | 'focus' | 'rest' | 'leave' | 'valve' | 'end';

/** What a control asked for during a rest (it happens when the next push begins). */
export type Queued = { kind: 'item'; index: number } | { kind: 'widen' } | null;

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'call'; item: Item; resumed: boolean }
  | { type: 'widen'; circle: Circle }
  | { type: 'gold'; on: boolean }
  | { type: 'tenth'; n: number }
  | { type: 'circle'; circle: Circle; carried: boolean }
  | { type: 'carried'; item: Item; n: number }
  | { type: 'breathTurn'; phase: BreathPhase; len: number; rest: boolean }
  | { type: 'tap' }
  | { type: 'valve' }
  | { type: 'chooser'; open: boolean }
  | { type: 'queued'; what: Queued }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The quiet finale: 16 s in sessions of 2 minutes and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** The first-ever session's warm-up (s). */
export function warmFor(plannedSec: number): number {
  if (plannedSec <= 60) return Math.min(RULES.warm.test, Math.max(8, plannedSec - finaleFor(plannedSec)) / 3);
  return plannedSec >= 300 ? RULES.warm.long : RULES.warm.short;
}

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** A story card's page: its title, its text, its verse. */
export interface Page { title: string; text: string; verse: PassageId }

/**
 * A story page: the first-ever card opens with both ways in a line each, then the care of the way being played; a
 * returning player's first own session gets the own way's two pages ("Nie musisz niczego przeżywać od nowa…").
 */
export function pageOf(kind: StoryKind, page: number, way: Way = 'others'): Page {
  if (kind === 'own') {
    return page === 0
      ? { title: t('story.own.title'), text: t('story.own.text'), verse: 'mat11.28' }
      : { title: t('story.ownCare.title'), text: t('story.ownCare.text'), verse: '1pe5.7' };
  }
  if (page === 0) return { title: t('story.open.title'), text: t('story.ways.text'), verse: 'gal6.2' };
  return way === 'own'
    ? { title: t('story.ownCare.title'), text: t('story.ownCare.text'), verse: 'mat11.28' }
    : { title: t('story.care.title'), text: t('story.care.text'), verse: 'mat11.28' };
}

export function pageTime(kind: StoryKind, page: number, way: Way = 'others'): number {
  const pg = pageOf(kind, page, way);
  return Math.max(RULES.pageSec, readTime(`${pg.title} ${pg.text} ${passage(pg.verse).text}`));
}

export interface SimInit {
  progress: BrzProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /**
   * The rest's rhythm the player set in the lobby (kit/rhythm.ts, `brzRhythm`): a rest after how many circles turned,
   * and its whole breaths — the breaths taken when the player moved a dial (`custom`); absent: one circle, the panel's
   * old count or the session's own.
   */
  rhythm?: { focus: number; rest: number; custom?: boolean } | null;
}

const zeroTally = (): Record<Tally, number> => ({ illness: 0, sadness: 0, loneliness: 0, fear: 0, grief: 0, conflict: 0, person: 0, me: 0, world: 0 });
const cIdx = circleIndex;

export class BrzSim {
  readonly p: BrzProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  /** the way this session plays (the card's choice when it began): the player's own burdens, or the intercession */
  readonly way: Way;
  readonly own: boolean;
  /** the first own session of a player who played before: it opens with the own way's card under a warm-up */
  readonly firstOwn: boolean;
  /** how far each burden widens in this session (1–3), and the focus a circle takes (s at the threshold) */
  readonly depth: 1 | 2 | 3;
  readonly need: number;
  /** the variant without smoke: only light flows from the Cross to them */
  readonly lightOnly: boolean;
  readonly pattern: BreathPattern;
  /** a rest comes after this many circles turned in one push (the lobby's Rytm; 1 by design) */
  readonly restAfter: number;
  /** each rest's whole breaths as the player set them (null: the panel's old count or the session's own) */
  readonly restBreaths: number | null;
  /** the list this session walks (the player's, or the six kinds and the world) */
  readonly queue: readonly Item[];
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  /** the session went on with a burden the last one left in progress */
  readonly resumed: boolean;
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  private readonly plan: Block[] = [];
  private readonly bestBefore: number | null;
  private readonly mean: WindowMean;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  nextKind: BlockKind | null = null;
  tip = '';
  private pushesBegun = 0;
  stallT = 0;
  /** a push: the circles it turned so far, and the seconds since it began or turned one (the safety valve) */
  turnedInPush = 0;
  circleT = 0;

  // the burden
  index = 0;
  item: Item;
  circle: Circle = 'one';
  stage: Stage = 'call';
  stageT = 0;
  /** the circle's light turned (0..1): the truth; `shown` follows it over a breath */
  x = 0;
  shown = 0;
  /** focus during the call or a widening (past the lead-in): the circle starts with it */
  pre = 0;
  /** grey smoke waiting at the Cross, and light at the Cross not yet returned (shares of the burden) */
  waiting = 0;
  gold = 0;
  /** the Cross's glow of turning (0..1), smoothed over a breath */
  glow = 0;
  /** the burden's number this session (1 = the first), for the verses in turn */
  burdenNo = 1;
  queued: Queued = null;
  /** burdens left this session before their end, by key: their circle and light (they continue if chosen again) */
  private readonly mem = new Map<string, { circle: Circle; x: number }>();
  private tenths = 0;

  // the band
  level = 0;
  focused = false;
  hold = 0;
  reliable = false;
  calmShown = 0;
  private goldOn = false;
  private goldRun = 0;
  private goodSaid = false;
  private waitRun = 0;
  private waitSaid = false;
  private unrelT = 0;
  private noSigSaid = false;

  // the breath, the hands, the cards
  breathT = 0;
  reshow = 0;
  story: Story | null = null;
  chooser: { page: number; t: number } | null = null;
  hintUntil = 0;

  // the session's tallies
  carriedNow = 0;
  circlesNow = 0;
  /** circles of the whole world turned this session */
  worldsNow = 0;
  /** the widest circle reached this session (0 the one, 1 many, 2 the world; −1 none) */
  widestNow = -1;
  readonly tallyNow: Record<Tally, number> = zeroTally();
  goldSec = 0;
  calmNow = 0;
  longestNow = 0;
  private calmRun = 0;
  private calmGap = 0;
  restsNow = 0;
  valvesNow = 0;
  tapsNow = 0;
  private passedRests = 0;
  private settled = false;
  nextPos: { pos: BrzPos | null; next: number } | null = null;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.way = this.p.way === 'others' ? 'others' : 'own';
    this.own = this.way === 'own';
    this.firstOwn = this.own && !this.firstEver && !(this.p.seen ?? []).includes('s.own');
    this.depth = depthFor(this.plannedSec);
    this.need = needFor(this.plannedSec);
    this.lightOnly = this.p.lightOnly;
    this.pattern = breathOf(this.p);
    const rh = init.rhythm;
    this.restAfter = Math.max(1, Math.min(RULES.restAfterMax, Math.round(rh?.focus ?? RULES.restAfter)));
    this.restBreaths = rh && rh.custom !== false ? Math.max(1, Math.min(RULES.restBreathsMax, Math.round(rh.rest))) : null;
    this.queue = wayQueue(this.p, this.way, ownDefaults()).map(it => ({ ...it }));
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.bestBefore = bestOf(this.p);
    this.mean = new WindowMean(Math.max(RULES.meanSec, breathCycle(this.pattern)));
    this.talk = new Talk(init.rng);
    const st = this.own ? ownStartOf(this.p, ownDefaults()) : startOf(this.p);
    this.index = Math.max(0, Math.min(this.queue.length - 1, st.index));
    this.item = this.queue[this.index];
    this.resumed = st.resumed;
    const ladder = allCirclesOf(this.item);
    const want: Circle = (this.own ? OWN_CIRCLES : CIRCLES)[st.circle] ?? ladder[0];
    this.circle = st.resumed && ladder.includes(want) ? want : ladder[0];
    this.x = st.resumed ? st.x : 0;
    this.shown = this.x;
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block {
    return this.plan[Math.min(this.blockIndex, this.plan.length - 1)] ?? { kind: 'warmup', dur: 0, cycles: 0, why: null, len: 0, leave: false };
  }
  get blocks(): readonly Block[] { return this.plan; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  /** a push past its lead-in: the turning answers the band */
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  /** no smoke now: the light-only version, or the own way's receiving circle (only light, from the Cross to the player) */
  get smokeless(): boolean { return this.lightOnly || this.circle === 'receive'; }
  /** the light turns now: a sighted push, the exchange, a reliable signal, focused */
  get loading(): boolean { return this.sighted && this.stage === 'pray' && this.reliable && this.focused; }
  get leadIn(): number { return this.lead; }
  get score(): number { return this.carriedNow; }
  get curKey(): string { return itemKey(this.item); }
  /** the circles this burden walks in this session, and the next one after the current (null: the last) */
  get circles(): readonly Circle[] { return circlesOf(this.item, this.depth); }
  get nextCircle(): Circle | null { return this.circles.find(c => cIdx(c) > cIdx(this.circle)) ?? null; }
  /** the next circle a hand may widen to (◎), within the whole ladder */
  get widerCircle(): Circle | null { return allCirclesOf(this.item).find(c => cIdx(c) > cIdx(this.circle)) ?? null; }
  /** the level averaged over a whole breath (the rate reads it; null before any signal) */
  get meanLevel(): number | null { return this.mean.value; }
  get talkBlocked(): boolean {
    if (this.story || this.chooser || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /** the breath now: in a push from its start, in a rest from its start (`cycle` of `cycles` in a rest) */
  get breath(): BreathState & { cycle: number; cycles: number } {
    const b = breathAt(this.pattern, this.breathT);
    const cycles = Math.max(1, this.block.cycles || 1);
    return { ...b, cycle: Math.min(cycles, b.n + 1), cycles };
  }
  /** the verse of the step: the circle's (in turn by the burden), the rest's, left at the Cross, the finale's */
  get verse(): PassageId {
    if (this.phase !== 'play' || this.stage === 'end') return this.own ? OWN_FINALE_VERSE : FINALE_VERSE;
    if (this.stage === 'leave') return this.own ? ownLeaveVerse(this.session + this.burdenNo - 2) : LEAVE_VERSE;
    if (this.stage === 'peace' || this.restBlock) return restVerse(this.restsNow - 1);
    return verseFor(this.circle, this.burdenNo - 1);
  }
  /** what the band says next during a rest (the control's choice) */
  get queuedItem(): Item | null {
    const q = this.queued;
    if (q?.kind === 'item') return this.queue[q.index] ?? null;
    return null;
  }

  get now(): NowWhat {
    if (this.phase !== 'play') return 'end';
    const b = this.block;
    if (b.kind === 'warmup') return 'warm';
    if (b.kind === 'rest') return b.why === 'valve' ? 'valve' : b.leave ? 'leave' : 'rest';
    return this.stage === 'call' || this.stage === 'widen' || this.blockT < this.lead ? 'call' : 'focus';
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.open(this.firstEver || this.firstOwn ? 'warmup' : 'push');
    this.callBurden(this.resumed, false);
    if (this.own) markSeen(this.p, 's.own');
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { kind: 'open', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'open', page: 0 });
      this.say('open', 3, 60);
    } else if (this.firstOwn) {
      this.story = { kind: 'own', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'own', page: 0 });
      this.say('open', 3, 60);
    } else this.say(this.resumed ? 'resume' : 'open', 2, 10);
    if (this.lightOnly) this.say('light', 1, 30);
  }

  /** The narrator: the own way says its own line where the intercession's speaks of the one prayed for. */
  private say(m: Moment, pri: number, ttl: number): void {
    this.talk.ask(this.own ? OWN_MOMENT[m] ?? m : m, pri, ttl);
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
      this.mean.push(this.level, dt);
    } else {
      this.focused = false;
      this.hold = 0;
    }
    if (this.phase === 'play') this.schedule(dt, f, now);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    if ((this.phase as string) === 'done') return;
    this.breathT += dt;
    this.updateBreathTurn(dt);
    this.updateStory(dt);
    this.updateChooser(dt);
    this.updateStage(dt);
    this.updateLight(dt, f);
    this.updateCalm(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    this.talk.update(dt, now, this.talkBlocked);
  }

  private updateBreathTurn(dt: number): void {
    const before = breathAt(this.pattern, this.breathT - dt);
    const now = breathAt(this.pattern, this.breathT);
    if (before.phase !== now.phase || before.n !== now.n) this.emit({ type: 'breathTurn', phase: now.phase, len: this.pattern[now.phase], rest: this.restBlock });
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= pageTime(s.kind, s.page, this.way)) this.turnStory();
  }

  private turnStory(): void {
    const s = this.story;
    if (!s) return;
    if (s.page + 1 < s.pages) {
      s.page++;
      s.t = 0;
      this.emit({ type: 'story', kind: s.kind, page: s.page });
      return;
    }
    this.story = null;
    this.say('call', 2, 10);
    this.coach('tap', 'person');
  }

  private updateChooser(dt: number): void {
    if (!this.chooser) return;
    this.chooser.t += dt;
    if (this.chooser.t >= RULES.chooserIdle || this.phase !== 'play') this.closeChooser();
  }

  /**
   * The step of the burden: the call and the widening run on their clocks (focus past the lead-in pre-turns the
   * circle a little), the exchange turns with focus, the smoke and the light move with the breath.
   */
  private updateStage(dt: number): void {
    if (this.story) return;
    this.stageT += dt;
    const rate = this.rate();
    if (this.stage === 'call' || this.stage === 'widen') {
      if (rate > 0) {
        this.pre = Math.min(RULES.preMax, this.pre + rate * dt);
        this.stallT = 0;
      }
      const len = this.stage === 'call' ? RULES.callSec : RULES.widenSec;
      if (this.stageT >= len && !this.warmBlock && this.pushBlock) this.beginPray();
    } else if (this.stage === 'pray' && this.pushBlock) {
      if (rate > 0) this.turn(rate * dt);
    } else if ((this.stage === 'peace' || this.stage === 'leave') && this.pushBlock && this.stageT >= RULES.onSec) {
      // the player's rhythm: the push goes on past a turned circle — wider, or the next burden called
      this.goOn();
    }
    // the smoke and the light (shares of the burden): in-breath lifts a puff to the Cross while the Cross has room, the
    // turning takes from it, the out-breath returns the light to them — never back to the person as smoke
    const b = breathAt(this.pattern, this.breathT);
    const exchange = (this.stage === 'pray' || this.stage === 'call' || this.stage === 'widen') && this.phase === 'play' && !this.restBlock;
    if (exchange && b.phase === 'in' && !this.smokeless) {
      const room = Math.max(0, Math.min(RULES.puff, 1 - this.x) - this.waiting);
      this.waiting += Math.min(room, (RULES.puff / Math.max(1, this.pattern.in)) * dt);
    }
    if (b.phase === 'out' || this.restBlock || this.stage === 'end') this.gold = Math.max(0, this.gold - this.gold * Math.min(1, dt * (this.restBlock ? 0.5 : 0.9)));
    this.shown = approach(this.shown, this.x, dt, RULES.showTau);
  }

  /** How fast the circle turns now (per second): only in the exchange of a sighted push, reliable and focused. */
  rate(): number {
    if (!this.pushBlock || this.blockT < this.lead || !this.reliable) return 0;
    return turnRate(this.mean.value ?? this.level, this.focused, this.hold, this.need);
  }

  private turn(n: number): void {
    if (n <= 0) return;
    this.stallT = 0;
    this.x = Math.min(1, this.x + n);
    this.waiting = Math.max(0, this.waiting - n);
    this.gold = Math.min(1, this.gold + n);
    const tenth = Math.floor(this.x * 10 + 1e-9);
    while (this.tenths < tenth) {
      this.tenths++;
      this.emit({ type: 'tenth', n: this.tenths });
    }
    if (this.x >= 1 - 1e-9) this.circleDone();
  }

  private updateLight(dt: number, f: FocusFrame): void {
    const gold = this.loading;
    if (gold !== this.goldOn) {
      this.goldOn = gold;
      this.emit({ type: 'gold', on: gold });
    }
    const above = clamp(((this.mean.value ?? this.level) - 0.5) / 0.5);
    this.glow = approach(this.glow, gold ? 0.55 + 0.45 * above : this.restBlock ? 0.35 : 0, dt, RULES.showTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    if (gold) this.goldSec += dt;
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.say('good', 2, 5);
    }
    this.waitRun = this.sighted && this.stage === 'pray' && this.reliable && !gold ? this.waitRun + dt : 0;
    if (this.waitRun >= RULES.waitSec && !this.waitSaid) {
      this.waitSaid = true;
      this.say('wait', 2, 6);
    }
    if (this.sighted && this.stage === 'pray' && this.blockT >= this.lead + 0.5) this.coach('cross', 'cross');
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.say('nosignal', 2, 6);
    }
  }

  private updateCalm(dt: number): void {
    if (!this.restBlock) {
      this.calmRun = 0;
      this.calmGap = 0;
      return;
    }
    if (this.reliable && this.calmShown >= RULES.calmAt) {
      this.calmRun += dt;
      this.calmNow += dt;
      this.calmGap = 0;
    } else {
      this.calmGap += dt;
      if (this.calmGap > 2) this.calmRun = 0;
    }
    this.longestNow = Math.max(this.longestNow, this.calmRun);
  }

  // ── the burden's steps ─────────────────────────────────────────
  /** A burden begins: the one prayed for appears and the address is said. */
  private callBurden(resumed: boolean, say: boolean): void {
    this.stage = 'call';
    this.stageT = 0;
    this.pre = 0;
    this.waiting = 0;
    this.gold = 0;
    this.tenths = Math.floor(this.x * 10 + 1e-9);
    this.emit({ type: 'call', item: this.item, resumed });
    if (say) this.say(this.item.who === 'me' ? 'me' : this.item.who === 'world' ? 'world' : 'call', 2, 8);
    if (this.pushBlock) this.tip = this.tipFor(this.block);
  }

  /** The exchange begins (after the call or a widening): the circle starts with what focus gathered meanwhile. */
  private beginPray(): void {
    this.stage = 'pray';
    this.stageT = 0;
    if (this.pre > 0) {
      this.x = Math.min(0.99, Math.max(this.x, this.x + this.pre));
      this.pre = 0;
    }
    this.tenths = Math.floor(this.x * 10 + 1e-9);
  }

  /** The circle widens (to `c`): more figures, or the whole world; the light already turned stays. */
  private widenTo(c: Circle): void {
    this.circle = c;
    this.stage = 'widen';
    this.stageT = 0;
    this.pre = 0;
    this.waiting = 0;
    this.tenths = Math.floor(this.x * 10 + 1e-9);
    this.emit({ type: 'widen', circle: c });
    this.say(c === 'receive' ? 'receive' : c === 'world' ? 'world' : 'many', 2, 8);
    if (this.pushBlock) this.tip = this.tipFor(this.block);
  }

  /** The circle is turned: counted; the last circle of the burden carries it; the push ends into a rest. */
  private circleDone(): void {
    this.x = 1;
    this.waiting = 0;
    this.circlesNow++;
    if (this.circle === 'world') this.worldsNow++;
    this.widestNow = Math.max(this.widestNow, cIdx(this.circle));
    const carried = this.nextCircle === null || this.circle === 'world';
    this.emit({ type: 'circle', circle: this.circle, carried });
    if (carried) {
      this.carriedNow++;
      if (!this.own) this.tallyNow[tallyOf(this.item)]++;
      this.mem.delete(this.curKey);
      this.emit({ type: 'carried', item: this.item, n: this.carriedNow });
    }
    this.stage = carried ? 'leave' : 'peace';
    this.stageT = 0;
    if (this.pushBlock) {
      this.turnedInPush++;
      this.circleT = 0;
      // a rest after the circles the rhythm asks for (by design every one); else the push goes on (updateStage)
      if (this.restDue(0)) this.endPush('done', carried);
    }
  }

  /** Does the push end in a rest once its circle is turned (`ahead` 1: asked while it still turns)? */
  private restDue(ahead: 0 | 1): boolean {
    return this.turnedInPush + ahead >= this.restAfter;
  }

  /** The next push begins: what a control queued, or the next circle, or the next burden; a valve's rest goes on. */
  private goOn(): void {
    const q = this.queued;
    this.queued = null;
    if (q?.kind === 'item') return this.switchTo(q.index);
    if (q?.kind === 'widen' && this.stage === 'pray') {
      const w = this.widerCircle;
      if (w) return this.widenTo(w);
    }
    if (this.stage === 'leave') return this.switchTo((this.index + 1) % this.queue.length, true);
    if (this.stage === 'peace') {
      const c = q?.kind === 'widen' ? this.widerCircle : this.nextCircle;
      this.x = 0;
      this.shown = 0;
      if (c) return this.widenTo(c);
      return this.switchTo((this.index + 1) % this.queue.length, true);
    }
    if (q?.kind === 'widen') {
      const w = this.widerCircle;
      if (w) this.widenTo(w);
    }
  }

  /**
   * Another burden now: the one in progress keeps its circle and light for this session (chosen again, it goes on);
   * `fresh` after a burden was carried (it starts anew).
   */
  private switchTo(i: number, fresh = false): void {
    const prev = this.curKey;
    if (!fresh && this.stage === 'peace') {
      // its circle was turned whole: chosen again, it goes on with the next circle
      const c = this.nextCircle;
      if (c) this.mem.set(prev, { circle: c, x: 0 });
    } else if (!fresh && this.stage !== 'leave' && (this.x > 0 || this.circle !== allCirclesOf(this.item)[0])) this.mem.set(prev, { circle: this.circle, x: this.x });
    this.index = ((i % this.queue.length) + this.queue.length) % this.queue.length;
    this.item = this.queue[this.index];
    const m = this.mem.get(this.curKey);
    const ladder = allCirclesOf(this.item);
    this.circle = m && ladder.includes(m.circle) ? m.circle : ladder[0];
    this.x = m ? Math.min(0.99, m.x) : 0;
    this.shown = this.x;
    this.burdenNo++;
    this.callBurden(!!m, true);
  }

  // ── the hands ──────────────────────────────────────────────────
  /** A tap anywhere: a story card turns; else stay with them (their name and the prayer glow) — never light. */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    this.reshow = RULES.reshowSec;
    this.tapsNow++;
    this.emit({ type: 'tap' });
    return true;
  }

  /** The controls answer in play (not under a story card, not in the finale). */
  get canAct(): boolean { return this.started && this.phase === 'play' && !this.story; }

  openChooser(): boolean {
    if (!this.canAct) return false;
    this.chooser = { page: this.pageOfIndex(this.index), t: 0 };
    this.emit({ type: 'chooser', open: true });
    return true;
  }

  closeChooser(): void {
    if (!this.chooser) return;
    this.chooser = null;
    this.emit({ type: 'chooser', open: false });
  }

  /** The chooser's pages: this many entries a page (the view lays them out). */
  static readonly PER_PAGE = 6;
  get pages(): number { return Math.max(1, Math.ceil(this.queue.length / BrzSim.PER_PAGE)); }
  pageOfIndex(i: number): number { return Math.floor(Math.max(0, i) / BrzSim.PER_PAGE); }
  turnPage(d: -1 | 1): void {
    if (!this.chooser) return;
    this.chooser.page = (this.chooser.page + d + this.pages) % this.pages;
    this.chooser.t = 0;
  }

  /** Whom to pray for (≡): now in a push or the warm-up, after this rest in a rest. */
  choose(i: number): boolean {
    if (!this.canAct || i < 0 || i >= this.queue.length) return false;
    this.closeChooser();
    if (i === this.index && !this.restBlock) return true;
    if (this.restBlock) {
      this.queued = i === this.index && this.stage !== 'leave' ? null : { kind: 'item', index: i };
      this.emit({ type: 'queued', what: this.queued });
      return true;
    }
    this.switchTo(i);
    return true;
  }

  /** The next burden (▶). */
  next(): boolean {
    if (!this.canAct || this.queue.length < 2 && !this.restBlock) return false;
    return this.choose((this.index + 1) % this.queue.length) || false;
  }

  /** Widen the circle now (◎): the light already turned stays; in a rest, the next push widens. */
  widen(): boolean {
    if (!this.canAct) return false;
    if (this.restBlock) {
      const can = this.stage === 'peace' ? !!this.widerCircle : this.stage === 'pray' && !!this.widerCircle;
      if (!can) return false;
      this.queued = { kind: 'widen' };
      this.emit({ type: 'queued', what: this.queued });
      return true;
    }
    const w = this.widerCircle;
    if (!w || this.warmBlock || this.stage === 'leave' || this.stage === 'peace') return false;
    if (this.stage === 'call') this.beginPray();
    this.widenTo(w);
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
    if (key === 'Escape') {
      const open = !!this.chooser;
      if (down && open) this.closeChooser();
      return open;
    }
    if (!down) return /^(m|M|w|W|n|N|ArrowRight|ArrowUp|[1-9])$/.test(key);
    if (this.chooser && /^[1-9]$/.test(key)) {
      const i = this.chooser.page * BrzSim.PER_PAGE + Number(key) - 1;
      return i < this.queue.length ? this.choose(i) : true;
    }
    if (key === 'm' || key === 'M') {
      if (this.chooser) this.closeChooser(); else this.openChooser();
      return true;
    }
    if (key === 'w' || key === 'W' || key === 'ArrowUp') return this.widen() || true;
    if (key === 'n' || key === 'N' || key === 'ArrowRight') return this.next() || true;
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
    if (b.kind === 'push' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'band');
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('rest', 'band');
    if (b.kind === 'rest' && this.blockT >= R.bannerSec + 8 && this.blockT - dt < R.bannerSec + 8) this.coach('controls', 'controls');
    const toFinale = this.plannedSec - this.finaleSec - now;
    if (toFinale <= 0) {
      this.endBlock('time');
      this.beginFinale();
      return;
    }
    if (b.kind === 'push') {
      this.stallT += dt;
      this.circleT += dt;
      const nearly = this.stage === 'pray' && this.x >= R.telegraphX;
      const valveIn = Math.min(R.valveStall - this.stallT, nearly ? Infinity : R.valveSec - this.circleT);
      // the rest is announced at the circle that ends the push
      this.telegraph(toFinale, nearly && this.restDue(1) ? 0 : valveIn, 'rest');
      if (valveIn <= 0) this.valve();
      return;
    }
    // the warm-up waits for the opening card
    if (b.kind === 'warmup' && this.story) b.dur = Math.max(b.dur, this.blockT + R.telegraph + 2);
    this.telegraph(toFinale, b.dur - this.blockT, 'push');
    if (this.blockT >= b.dur) {
      const wasRest = b.kind === 'rest';
      this.endBlock(null);
      this.open('push');
      if (wasRest) this.goOn();
      else if (this.stage === 'call' && this.stageT >= RULES.callSec) this.beginPray();
    }
  }

  private telegraph(toFinale: number, toEnd: number, next: BlockKind): void {
    if (this.telegraphed || Math.min(toFinale, toEnd) > RULES.telegraph) return;
    this.telegraphed = true;
    this.nextKind = toFinale <= toEnd ? null : next;
    this.emit({ type: 'telegraph', next: this.nextKind });
  }

  private valve(): void {
    this.endPush('valve', false);
    this.valvesNow++;
    this.emit({ type: 'valve' });
  }

  private endPush(why: 'done' | 'valve', leave: boolean): void {
    if (!this.pushBlock) return;
    this.endBlock(why);
    this.open('rest', why, leave);
  }

  private open(kind: BlockKind, why: BlockWhy | null = null, leave = false): void {
    const extra = leave ? RULES.leaveExtra : 0;
    const rest = kind !== 'rest' ? null : this.restBreaths !== null ? breathRestOf(this.pattern, this.restBreaths + extra) : restOf(this.p, this.plannedSec, extra);
    const b: Block = {
      kind, dur: kind === 'warmup' ? warmFor(this.plannedSec) : rest ? rest.sec : Infinity, cycles: rest?.cycles ?? 0, why, len: 0, leave,
    };
    this.plan.push(b);
    this.blockIndex = this.plan.length - 1;
    this.blockT = 0;
    this.breathT = 0;
    this.telegraphed = false;
    this.nextKind = null;
    this.stallT = 0;
    this.turnedInPush = 0;
    this.circleT = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.goldRun = 0;
    this.waitRun = 0;
    if (kind === 'push') this.pushesBegun++;
    else if (kind === 'rest') {
      this.restsNow++;
      this.say(why === 'valve' ? 'valve' : leave ? 'leave' : 'rest', why === 'valve' ? 3 : 2, 12);
    }
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: this.blockIndex });
    const first = breathAt(this.pattern, 0).phase;
    this.emit({ type: 'breathTurn', phase: first, len: this.pattern[first], rest: kind === 'rest' });
  }

  /** The block's strategy: the exchange's picture (the slow words every third), the breath and the peace in rest. */
  private tipFor(b: Block): string {
    if (b.kind === 'warmup') return t(this.own ? OWN_WARM_TIP : WARM_TIP);
    if (b.kind === 'push') {
      const list: readonly Key[] = this.own ? (this.smokeless ? OWN_LIGHT_TIPS : OWN_PUSH_TIPS) : this.lightOnly ? LIGHT_TIPS : PUSH_TIPS;
      return t(list[(this.pushesBegun - 1 + this.session) % list.length]);
    }
    const rest: readonly Key[] = this.own ? OWN_REST_TIPS : REST_TIPS;
    return t(rest[(this.session - 1 + this.restsNow) % rest.length], { breath: breathWordsOf(this.pattern) });
  }

  private endBlock(why: BlockWhy | null): void {
    const b = this.block;
    if (b.len > 0 || !this.plan.length) return;
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
    this.closeChooser();
    // a circle in progress keeps its light (saved for the next session); the scene leaves everything at the Cross
    this.posAtEnd = this.posNow();
    this.stage = 'end';
    this.stageT = 0;
    this.emit({ type: 'finale' });
    this.say('end', 3, 12);
  }

  private posAtEnd: { pos: BrzPos | null; next: number } | null = null;

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'done' });
  }

  /** Where the next session goes on: the burden in progress (its circle and light), or the next entry. */
  private posNow(): { pos: BrzPos | null; next: number } {
    const len = this.queue.length;
    const after = (this.index + 1) % len;
    const ladder = allCirclesOf(this.item);
    switch (this.stage) {
      case 'leave': return { pos: null, next: after };
      case 'peace': {
        const c = this.nextCircle;
        return c ? { pos: { key: this.curKey, circle: cIdx(c), x: 0 }, next: this.index } : { pos: null, next: after };
      }
      case 'end': return this.posAtEnd ?? { pos: null, next: this.index };
      default: {
        const x = Math.min(0.99, this.x + (this.stage === 'pray' ? 0 : this.pre));
        if (x <= 0 && this.circle === ladder[0]) return { pos: null, next: this.index };
        return { pos: { key: this.curKey, circle: cIdx(this.circle), x }, next: this.index };
      }
    }
  }

  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    if (this.own) p.given += this.carriedNow;
    else p.carried += this.carriedNow;
    p.worlds += this.worldsNow;
    for (const k of Object.keys(this.tallyNow) as Tally[]) p.tally[k] = (p.tally[k] ?? 0) + this.tallyNow[k];
    p.calmBest = Math.max(p.calmBest, Math.round(this.longestNow * 10) / 10);
    p.calmAll += Math.round(this.calmNow);
    p.lastLen = this.plannedSec;
    if (this.started) {
      this.nextPos = this.phase === 'finale' ? (this.posAtEnd ?? this.posNow()) : this.posNow();
      // the list the session walked is the progress's own (or the default): an index into it — the own way's into its own
      if (this.own) {
        p.own.pos = this.nextPos.pos;
        p.own.next = this.nextPos.next;
      } else {
        p.pos = this.nextPos.pos;
        p.next = this.nextPos.next;
      }
    }
  }

  finish(): void { this.end(); }

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach, at: CoachAt): void {
    if (this.story) return;
    // the own way's marks say other words (the bundle, the light to the player): each is shown once in its way
    if (!markSeen(this.p, this.own ? `c.own.${what}` : `c.${what}`)) return;
    this.emit({ type: 'coach', what, at });
  }

  coachWords(what: Coach, touch: boolean): string {
    const o = this.own ? 'own.' : '';
    if (what === 'tap') return t(`coach.${o}tap${touch ? '' : '.keys'}` as Key);
    if (what === 'controls') return t(`coach.${o}controls${touch ? '' : '.keys'}` as Key);
    if (what === 'breath') return t(`coach.${o}${this.smokeless ? 'breathLight' : 'breath'}` as Key);
    if (what === 'cross') return t(this.smokeless ? 'coach.crossLight' : 'coach.cross');
    return t(`coach.${o}${what}` as Key);
  }

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the band's level (averaged over a breath) in a sighted exchange, calm in rest; null elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.pushBlock) return this.blockT < this.lead || this.stage !== 'pray' ? null : clamp(this.mean.value ?? this.level);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the turning in a sighted exchange, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted && this.stage === 'pray') return clamp(0.25 + 0.75 * this.glow);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The entry the next session begins with (after settle; before it, where it would go on now). */
  get nextStart(): Item {
    const np = this.nextPos ?? (this.phase === 'finale' ? this.posAtEnd : null) ?? this.posNow();
    if (np.pos) return this.queue.find(it => itemKey(it) === np.pos!.key) ?? this.item;
    return this.queue[np.next % this.queue.length] ?? this.item;
  }

  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const k = lenKey(this.plannedSec);
      p.best[k] = Math.max(p.best[k] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    // the own way: counts only — never a topic (they stay in the progress on this device)
    const stats: [string, string][] = [
      [t(this.own ? 'stat.given' : 'stat.carried'), String(this.carriedNow)],
      [t('stat.circles'), String(this.circlesNow)],
      ...(this.own ? [] : [[t('stat.widest'), this.widestNow >= 0 ? circleName(CIRCLES[this.widestNow]) : '—'] as [string, string]]),
      [t('stat.gold'), secText(this.goldSec)],
      [t('stat.peace'), secText(this.calmNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The summary's closing passage: 2 Cor 1:3-4 or Mt 11:28 in turn (the first session: Mt 11:28). */
  closingVerse(): PassageId {
    if (this.session === 1) return 'mat11.28';
    return inTurn(CLOSE_VERSES, this.session);
  }

  /**
   * The summary in a few lines, one per kind of thing (never a list of every name): the burdens carried and the
   * widest circle; the kinds prayed for; where the next session begins; the longest peace; the light-only variant.
   */
  private highlights(): string[] {
    if (this.own) return this.ownHighlights();
    const out: string[] = [];
    if (this.carriedNow > 0) {
      out.push(t('hl.carried', { n: this.carriedNow, circle: circleName(CIRCLES[Math.max(0, this.widestNow)]) }));
    } else if (this.started) out.push(this.circlesNow > 0 ? t('hl.circles', { n: this.circlesNow }) : t('hl.begun'));
    const kinds = (Object.keys(this.tallyNow) as Tally[]).filter(k => this.tallyNow[k] > 0);
    if (kinds.length > 1) out.push(t('hl.kinds', { list: kinds.slice(0, 4).map(k => t(`tally.${k}` as Key)).join(', ') }));
    if (this.started) out.push(t('hl.next', { who: whoName(this.nextStart) }));
    if (this.longestNow >= 10) out.push(t('hl.peace', { sec: secText(this.longestNow) }));
    if (this.lightOnly) out.push(t('hl.light'));
    return out.slice(0, 5);
  }

  /**
   * The own way's summary: how many burdens were given at the Cross, how far the list has come — counts only, never a
   * topic (DESIGN §18.3 "names stay home"; the brief: "3 brzemiona oddane przy krzyżu").
   */
  private ownHighlights(): string[] {
    const out: string[] = [];
    if (this.carriedNow > 0) out.push(t('hl.given', { n: this.carriedNow }));
    else if (this.started) out.push(this.circlesNow > 0 ? t('hl.ownCircles', { n: this.circlesNow }) : t('hl.ownBegun'));
    if (this.started) {
      const np = this.nextPos ?? (this.phase === 'finale' ? this.posAtEnd : null) ?? this.posNow();
      const i = np.pos ? Math.max(0, this.queue.findIndex(it => itemKey(it) === np.pos!.key)) : np.next % this.queue.length;
      out.push(np.pos ? t('hl.ownGoesOn', { n: i + 1, of: this.queue.length }) : t('hl.ownNext', { n: i + 1, of: this.queue.length }));
    }
    if (this.longestNow >= 10) out.push(t('hl.peace', { sec: secText(this.longestNow) }));
    if (this.lightOnly) out.push(t('hl.light'));
    return out.slice(0, 5);
  }
}

export type { Moment };
