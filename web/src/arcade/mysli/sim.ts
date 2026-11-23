/**
 * Każda myśl's session, without the DOM (DESIGN.md §19): a meditation on one point of light, and the thoughts that
 * drift in given to its fire —
 *
 *   Przygotowanie (timed)  three settling cues: the posture, the eyes on the flame (blink freely; tired, close them and
 *                          see it inside), the breath; nothing is gated
 *   Myśli (focus)          a thought drifts in from the dark on a slip of paper, coloured by its emotions, and waits
 *                          at a safe distance; while focus is held the flame's warm ring reaches it and it burns —
 *                          letters char and crumble, the ash rises as sparks and one golden light joins the point;
 *                          the player's rhythm sets how many burn in one push (3 by default)
 *   Odpoczynek (rest)      whole breaths with the breath guide; the ash settles; the true word answers the last
 *                          thought burned (and on every other rest its verse)
 *   Popiół opada (rest)    the last rest, a breath longer, at the reserved end
 *   Cisza (focus)          sessions of 10 minutes and more: a quiet stretch with no thoughts — the point alone
 *   the close (finale)     the closing card, and "how heavy is it now?" 0–10
 *
 * Light only from real focus: a thought burns only in a sighted push past its lead-in, once it has drifted to the
 * ring, with a reliable signal, while `frame.focused` (rules.ts `focusRate`).  Without focus the thought waits at its
 * distance — it never comes closer, nothing goes back.  The safety valve rests a push that cannot finish.  The plan
 * (rules.ts `planFor`) fits the arc to the session's length and the player's rhythm, the end is reserved for the last
 * rest, the quiet and the close, so the arc always closes near the end; a stronger focus burns more thoughts.  Each
 * block is judged once at its end over its last ≤ 15 s; every 4th push from the 3rd session is blind.  The headline
 * is the thoughts burned.  The player's own thoughts come first, live only in the progress, and never reach result().
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, type BreathPattern, type BreathPhase, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  ASHES_VERSE, CLOSE_VERSES, EMOS, LIBRARY, OWN_VERSES, OWN_WORDS, QUIET_VERSES, ROOT_VERSE, TIPS, VALVE_VERSES, dominant, fits, isMixed, ownMix,
  type AreaId, type Emo, type Mix, type Pattern, type ThoughtDef,
} from './content';
import { breathWords as breathWordsOf, emoList, emoNames, linesOf, t, unit, type Key } from './i18n';
import { bestOf, breathOf, lenKey, markSeen, type MysliProgress } from './meta';
import { RULES, cleanRhythm, focusRate, planFor, readTime, type MysliRhythm, type Plan } from './rules';
import { Talk } from './talk';

export type BlockKind = 'settle' | 'push' | 'rest' | 'quiet';
export type RestKind = 'thought' | 'valve' | 'last';
export type BlockWhy = 'done' | 'valve' | 'time';
/** A block: its planned length (a push: Infinity — it lasts until its thoughts have burned), its rest's kind, how it ended. */
export interface Block { kind: BlockKind; dur: number; blind: boolean; cycles: number; rest: RestKind | null; why: BlockWhy | null; len: number }

/** A thought in this session: from the library (`id`) or the player's own (`own` ≥ 0, its text kept in memory only). */
export interface Thought {
  /** the order it came in this session (0, 1, 2…) */
  seq: number;
  id: string | null;
  own: number;
  text: string;
  mix: Mix;
  pattern: Pattern | null;
  area: AreaId | null;
  /** its true word, and the passage it rests on */
  word: string;
  verse: PassageId;
}

/** Where the thought on the ring is: drifting in, waiting (burning while focus holds), drifting away (set aside). */
export type ThoughtState = 'arrive' | 'wait' | 'leave';

export type StoryKind = 'open';
export interface Story { kind: StoryKind; page: number; pages: number; t: number }

export type Coach = 'burn' | 'skip' | 'breath' | 'blind';
export type CoachAt = 'flame' | 'slip' | 'skip' | 'guide';

/** The one short line of what to do now: it changes only when the action changes. */
export type NowWhat = 'settle' | 'arrive' | 'burn' | 'dark' | 'rest' | 'valve' | 'last' | 'quiet' | 'end';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'cue'; i: number }
  | { type: 'arrive'; thought: Thought }
  | { type: 'ready'; thought: Thought }
  | { type: 'burn'; thought: Thought; k: number }
  | { type: 'burned'; thought: Thought; n: number }
  | { type: 'leave'; thought: Thought }
  | { type: 'gold'; on: boolean }
  | { type: 'breathTurn'; phase: BreathPhase; len: number }
  | { type: 'blindEnd'; share: number; gained: number }
  | { type: 'valve' }
  | { type: 'tap' }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'rated'; n: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

export interface Page { title: string; text: string; verse: PassageId }

/** The opening's two pages: the root (2 Cor 10:5), then how it works (Isa 61:3, beauty for ashes). */
export function pageOf(kind: StoryKind, page: number): Page {
  void kind;
  return page === 0
    ? { title: t('story.open.title'), text: t('story.open.text'), verse: ROOT_VERSE }
    : { title: t('story.open2.title'), text: t('story.open2.text'), verse: ASHES_VERSE };
}

export function pageTime(kind: StoryKind, page: number): number {
  const pg = pageOf(kind, page);
  return Math.max(RULES.pageSec, readTime(`${pg.title} ${pg.text} ${passage(pg.verse).text}`));
}

/** The closing card's passage for a session (in turn). */
export const closeVerseFor = (session: number): PassageId => inTurn(CLOSE_VERSES, session);

// ── the queue ────────────────────────────────────────────────────

/** A seeded shuffle (Fisher–Yates) of a copy. */
function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * The library thoughts in the order a session meets them: those that fit today's emotion and areas first, then
 * those that fit the emotion in other areas, then the rest (the queue widens before it repeats); in each group the
 * single-emotion thoughts before the mixtures (a longer session goes deeper), shuffled with the session's seed, the
 * ones burned last time at the group's end; never one set aside as "not mine".
 */
export function libraryOrder(p: Pick<MysliProgress, 'emotion' | 'areas' | 'recent' | 'skipped'>, rng: () => number): ThoughtDef[] {
  const usable = LIBRARY.filter(d => !p.skipped.includes(d.id));
  const inArea = (d: ThoughtDef) => !p.areas.length || p.areas.includes(d.area);
  const groups = [
    usable.filter(d => fits(d.mix, p.emotion) && inArea(d)),
    usable.filter(d => fits(d.mix, p.emotion) && !inArea(d)),
    usable.filter(d => !fits(d.mix, p.emotion)),
  ];
  const out: ThoughtDef[] = [];
  for (const g of groups) {
    for (const mixed of [false, true]) {
      const part = shuffled(g.filter(d => isMixed(d.mix) === mixed), rng);
      out.push(...part.filter(d => !p.recent.includes(d.id)), ...part.filter(d => p.recent.includes(d.id)));
    }
  }
  return out;
}

export interface SimInit {
  progress: MysliProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the player's rhythm (kit/rhythm.ts: thoughts before a rest, breaths in a rest); absent: the defaults */
  rhythm?: { focus?: unknown; rest?: unknown } | null;
  /** today ("YYYY-MM-DD"), for the before → after history */
  day?: string;
}

export class MysliSim {
  readonly p: MysliProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  readonly rhythm: MysliRhythm;
  readonly plan: Plan;
  readonly pattern: BreathPattern;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  readonly day: string;
  /** the 0–10 the player gave in the lobby before this session (null: none) */
  readonly before: number | null;
  private readonly judge: RoundJudge;
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;
  private readonly plannedBlocks: Block[] = [];

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
  /** the time the last rest takes over (s of play) */
  readonly reserveAt: number;
  lastDone = false;
  private finaleFrom = Infinity;

  // ── the thoughts ──
  private queue: Thought[] = [];
  private seq = 0;
  /** the thought at the ring (or drifting in or away), where it is, for how long, how far it has burned */
  cur: Thought | null = null;
  curState: ThoughtState = 'arrive';
  curT = 0;
  burn = 0;
  hidden = 0;
  /** a blind push's unseen burning was just shown (1 → 0 over RULES.revealSec): the view lights it */
  revealFlash = 0;
  /** thoughts burned in this push, and the last one burned (its true word answers it in the rest) */
  burnedInPush = 0;
  lastBurned: Thought | null = null;
  /** the rest's words: the true word of a thought, or the valve's / the last rest's; and its passage */
  restWord = '';
  restVerseId: PassageId | null = null;
  /** this rest shows its passage in its second half */
  restShowsVerse = false;

  // ── the band ──
  light: number = RULES.baseLight;
  /** how far the flame's warm ring reaches toward the waiting thought (0 the flame, 1 the thought) */
  ring = 0;
  level = 0;
  focused = false;
  hold = 0;
  reliable = false;
  calmShown = 0;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private waitRun = 0;
  private waitSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  private mixedSaid = false;

  // ── the hands, the cards ──
  breathT = 0;
  reshow = 0;
  story: Story | null = null;
  /** a coach mark is on screen until this time (s of play): the narrator waits for it */
  hintUntil = 0;
  /** the "how heavy is it now?" after the session (the finale's row); null: not given */
  after: number | null = null;

  // ── the session's tallies ──
  burnedNow = 0;
  ownBurnedNow = 0;
  readonly byEmoNow: Record<Emo, number> = { fear: 0, sadness: 0, anger: 0 };
  readonly burnedIds: string[] = [];
  private readonly burnedOwn: string[] = [];
  skippedNow = 0;
  goldSec = 0;
  calmNow = 0;
  private calmRun = 0;
  private calmGap = 0;
  longestNow = 0;
  quietNow = 0;
  private quietRun = 0;
  quietLongest = 0;
  restsNow = 0;
  valvesNow = 0;
  tapsNow = 0;
  private blindShare = -1;
  private passedRests = 0;
  private settled = false;
  /** when each thought burned (s of play), for the tests */
  readonly burnAt: number[] = [];
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.day = init.day ?? '2026-06-01';
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.pattern = breathOf(this.p);
    this.rhythm = cleanRhythm(init.rhythm);
    this.plan = planFor(this.plannedSec, this.pattern, this.rhythm, this.eeg);
    this.reserveAt = this.plannedSec - this.plan.finaleSec - this.plan.quietSec - this.plan.lastSec;
    this.judge = RoundJudge.from(init.tuning);
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.before = this.p.before;
    this.talk = new Talk(m => linesOf(m), init.rng);
    this.queue = this.buildQueue(true);
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block {
    return this.plannedBlocks[Math.min(this.blockIndex, this.plannedBlocks.length - 1)]
      ?? { kind: 'settle', dur: 0, blind: false, cycles: 0, rest: null, why: null, len: 0 };
  }
  get blocks(): readonly Block[] { return this.plannedBlocks; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get settleBlock(): boolean { return this.phase === 'play' && this.block.kind === 'settle'; }
  get quietBlock(): boolean { return this.phase === 'play' && this.block.kind === 'quiet'; }
  /** a block that asks for focus: a push or the quiet */
  get focusBlock(): boolean { return this.pushBlock || this.quietBlock; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  get lead(): number { return this.plan.lead; }
  /** a sighted focus block past its lead-in: the flame answers the band */
  get sighted(): boolean { return this.focusBlock && !this.block.blind && this.blockT >= this.lead; }
  /** the thought waits at the ring, ready to burn */
  get ready(): boolean { return !!this.cur && this.curState === 'wait'; }
  /** burning now: sighted, a reliable signal, the focus above the threshold, a thought at the ring (or the quiet held) */
  get growing(): boolean { return this.sighted && this.reliable && this.focused && (this.quietBlock || this.ready); }
  get goldOn(): boolean { return this.gold; }
  get score(): number { return this.burnedNow; }
  get restKind(): RestKind | null { return this.restBlock ? this.block.rest : null; }
  /** the settling cue on screen (0..2) */
  get cue(): number { return this.settleBlock ? Math.min(2, Math.floor(this.blockT / Math.max(0.5, this.plan.cueSec))) : 2; }
  /** the golden lights round the point: one for each thought burned */
  get lights(): number { return this.burnedNow; }
  /** the thoughts still waiting at the edges (the view draws a few blank slips) */
  get waiting(): number { return this.queue.length; }
  /** the thought burning now is the push's last before a rest */
  get lastOfPush(): boolean { return this.burnedInPush + 1 >= this.plan.perPush; }
  /** the narrator waits: a telegraph, the runner's banner, a story card, a coach mark, the finale's row */
  get talkBlocked(): boolean {
    if (this.story || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return this.phase === 'finale' && this.after === null && this.t - this.finaleFrom > 4;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  get breath(): BreathState & { cycle: number; cycles: number } {
    const b = breathAt(this.pattern, this.breathT);
    const cycles = Math.max(1, this.block.cycles || 1);
    return { ...b, cycle: Math.min(cycles, b.n + 1), cycles };
  }
  get breathText(): string { return breathWordsOf(this.pattern); }
  /** how far the rest has gone (0..1) */
  get restK(): number { return this.restBlock && Number.isFinite(this.block.dur) ? clamp(this.blockT / Math.max(1, this.block.dur)) : 0; }
  /** the rest's words now: its true word, or (the second half of a rest that shows it) its passage */
  get restPage(): 'word' | 'verse' { return this.restShowsVerse && this.restVerseId && this.restK >= 0.5 ? 'verse' : 'word'; }

  /** What to do now, in one short line. */
  get now(): NowWhat {
    if (this.phase !== 'play') return 'end';
    const b = this.block;
    if (b.kind === 'settle') return 'settle';
    if (b.kind === 'quiet') return 'quiet';
    if (b.kind === 'rest') return b.rest === 'valve' ? 'valve' : b.rest === 'last' ? 'last' : 'rest';
    if (b.blind) return 'dark';
    return this.ready ? 'burn' : 'arrive';
  }

  /** The prayer in the band: the settling cue, the prayer that gives the thought to God, the quiet's. */
  get line(): string {
    if (this.started && this.phase !== 'play') return t('close.text');
    if (this.settleBlock) return t(`cue.${this.cue + 1}` as Key);
    if (this.quietBlock) return t('pray.quiet');
    const c = this.cur;
    if (!c) return t('pray.mixed');
    return t(`pray.${isMixed(c.mix) ? 'mixed' : dominant(c.mix)}` as Key);
  }

  /** The band's label for the thought at the ring: its emotions and its pattern ("Lęk · czarny scenariusz"), or "Twoja myśl · lęk". */
  get thoughtLabel(): string {
    const c = this.cur;
    if (!c) return '';
    const emo = emoNames(c.mix);
    if (c.own >= 0) return t('lab.own', { emo });
    return t('lab.thought', { emo: emo[0].toLocaleUpperCase() + emo.slice(1), pattern: t(`pat.${c.pattern}` as Key) });
  }

  // ── the queue ──────────────────────────────────────────────────
  /** The session's thoughts in order: the player's own first (the first time only), then the library's. */
  private buildQueue(withOwn: boolean): Thought[] {
    const out: Thought[] = [];
    if (withOwn) {
      this.p.own.forEach((o, i) => {
        const k = (this.session + i) % OWN_WORDS;
        out.push({
          seq: 0, id: null, own: i, text: o.text, mix: ownMix(o.emo), pattern: null, area: null,
          word: t(`own.${o.emo}.${k + 1}` as Key), verse: OWN_VERSES[o.emo][(this.session + i) % OWN_VERSES[o.emo].length],
        });
      });
    }
    for (const d of libraryOrder(this.p, this.rng)) {
      out.push({ seq: 0, id: d.id, own: -1, text: t(`th.${d.id}` as Key), mix: d.mix, pattern: d.pattern, area: d.area, word: t(`tw.${d.id}` as Key), verse: d.verse });
    }
    return out;
  }

  /** The next thought begins to drift in (a new queue when this one has run out: the library again). */
  private bringNext(): void {
    if (!this.queue.length) this.queue = this.buildQueue(false);
    const next = this.queue.shift();
    if (!next) {
      this.cur = null;
      return;
    }
    next.seq = this.seq++;
    this.cur = next;
    this.curState = 'arrive';
    this.curT = 0;
    this.burn = 0;
    this.hidden = 0;
    this.emit({ type: 'arrive', thought: next });
    if (next.seq === 0) this.talk.ask('first', 1, 8);
    else if (next.own >= 0) this.talk.ask('own', 2, 8);
    else if (isMixed(next.mix) && !this.mixedSaid) {
      this.mixedSaid = true;
      this.talk.ask('mixed', 1, 8);
    }
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.open('settle');
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { kind: 'open', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'open', page: 0 });
    }
    this.talk.ask(this.firstEver ? 'open' : 'settle', 2, 30);
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
    if (this.phase === 'finale' && this.finaleOver(now)) this.end();
    if ((this.phase as string) === 'done') return;
    if (this.pushBlock) this.updateThought(dt);
    this.updateLight(dt, f);
    if (this.restBlock) this.updateBreath(dt);
    this.updateStory(dt);
    if (this.pushBlock) this.updateBurn(dt);
    this.revealFlash = Math.max(0, this.revealFlash - dt / RULES.revealSec);
    this.updateCalm(dt);
    this.updateQuiet(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    this.talk.update(dt, now, this.talkBlocked);
  }

  /** The finale ends at the planned end — waiting a little longer for the "how heavy now" answer (at most RULES.settle). */
  private finaleOver(now: number): boolean {
    if (now < Math.max(this.plannedSec, this.finaleFrom + 3)) return false;
    return this.after !== null || now >= this.plannedSec + RULES.settle - 0.25;
  }

  private updateLight(dt: number, f: FocusFrame): void {
    const target = this.sighted && this.reliable ? clamp(f.level) : this.restBlock ? RULES.restLight : RULES.baseLight;
    this.light = approach(this.light, target, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    const gold = this.growing;
    // the ring reaches the thought only while it burns; otherwise it rests near the flame, a little wider with the level
    const ringTo = gold ? 1 : this.sighted && this.reliable ? 0.15 + 0.35 * clamp(f.level) : 0.12;
    this.ring = approach(this.ring, ringTo, dt, RULES.ringTau);
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
    this.waitRun = this.sighted && this.reliable && this.ready && !gold ? this.waitRun + dt : 0;
    if (this.waitRun >= RULES.waitSec && !this.waitSaid) {
      this.waitSaid = true;
      this.talk.ask('wait', 2, 6);
    }
    if (this.sighted && this.ready && this.blockT >= this.lead + 0.5) this.coach('burn', 'slip');
    if (this.sighted && this.ready && this.pushesBegun >= 2 && this.blockT >= this.lead + 6) this.coach('skip', 'skip');
    this.unrelT = this.focusBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 2, 6);
    }
  }

  private updateBreath(dt: number): void {
    const before = breathAt(this.pattern, this.breathT);
    this.breathT += dt;
    const now = breathAt(this.pattern, this.breathT);
    if (before.phase !== now.phase || before.n !== now.n) this.emit({ type: 'breathTurn', phase: now.phase, len: this.pattern[now.phase] });
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= pageTime(s.kind, s.page)) this.turnStory();
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
  }

  // ── a thought: drifting in, burning, drifting away ─────────────
  private updateThought(dt: number): void {
    if (!this.cur) {
      this.bringNext();
      return;
    }
    this.curT += dt;
    if (this.curState === 'arrive' && this.curT >= RULES.arriveSec) {
      this.curState = 'wait';
      this.curT = 0;
      this.emit({ type: 'ready', thought: this.cur });
    } else if (this.curState === 'leave' && this.curT >= RULES.leaveSec) {
      this.cur = null;
      this.bringNext();
    }
  }

  /** Focus-seconds a second now: the founder's rule in a push past its lead-in, a thought at the ring, a reliable signal; else nothing. */
  rate(): number {
    if (!this.pushBlock || this.blockT < this.lead || !this.reliable || !this.ready) return 0;
    return focusRate(this.level, this.focused, this.hold);
  }

  private updateBurn(dt: number): void {
    const n = (this.rate() * dt) / Math.max(0.5, this.plan.need);
    if (n <= 0 || !this.cur) return;
    this.stallT = 0;
    if (this.blind) {
      // in the dark the thought burns unseen; burned through, the push ends and shows it
      this.hidden = Math.min(Math.max(0, 1 - this.burn), this.hidden + n);
      if (this.burn + this.hidden >= 1 - 1e-9) this.endPush('done');
      return;
    }
    const before = this.burn;
    this.burn = Math.min(1, this.burn + n);
    if (Math.floor(before * 10) !== Math.floor(this.burn * 10)) this.emit({ type: 'burn', thought: this.cur, k: this.burn });
    if (this.burn < 1 - 1e-9) return;
    this.burned();
    if (this.burnedInPush >= this.plan.perPush && this.blockT >= RULES.minPush) this.endPush('done');
    else this.bringNext();
  }

  /** The thought has burned: its golden light, the tallies, its true word for the rest. */
  private burned(): void {
    const c = this.cur;
    if (!c) return;
    this.burn = 1;
    this.burnedNow++;
    this.burnedInPush++;
    this.byEmoNow[dominant(c.mix)]++;
    if (c.own >= 0) {
      this.ownBurnedNow++;
      this.burnedOwn.push(c.text);
    } else if (c.id) this.burnedIds.push(c.id);
    this.burnAt.push(this.t);
    this.lastBurned = c;
    this.cur = null;
    this.emit({ type: 'burned', thought: c, n: this.burnedNow });
    this.talk.ask('burned', 2, 6);
  }

  // ── the hands ──────────────────────────────────────────────────
  /**
   * A tap anywhere, Space: on a story card, turn its page (after a moment); else stay with the words (they glow
   * again) — never burning.
   */
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

  /** May the thought at the ring be set aside now ("nie moja")? */
  get canSkip(): boolean {
    return this.pushBlock && !this.story && !!this.cur && this.curState !== 'leave';
  }

  /**
   * "Nie moja": the thought at the ring is not the player's — it drifts back out, unburned and uncounted, and the
   * next one comes; a library thought is set aside for good (the lobby's card can bring them back), an own thought
   * stays on the player's list.
   */
  skip(): boolean {
    if (!this.canSkip || !this.cur) return false;
    const c = this.cur;
    this.curState = 'leave';
    this.curT = 0;
    this.hidden = 0;
    this.skippedNow++;
    if (c.id && !this.p.skipped.includes(c.id)) {
      this.p.skipped.push(c.id);
      if (this.p.skipped.length > RULES.skipMax) this.p.skipped.splice(0, this.p.skipped.length - RULES.skipMax);
    }
    this.emit({ type: 'leave', thought: c });
    this.talk.ask('skip', 1, 5);
    return true;
  }

  /** The finale's row: how heavy it is now, 0–10. */
  rate10(n: number): boolean {
    if (this.phase !== 'finale' || !Number.isFinite(n)) return false;
    this.after = Math.max(0, Math.min(10, Math.round(n)));
    this.emit({ type: 'rated', n: this.after });
    return true;
  }

  /** The finale shows its row of 0–10. */
  get asking(): boolean { return this.phase === 'finale' && this.plannedSec >= 60; }

  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Spacebar') {
      if (down) this.stay();
      return true;
    }
    if (key === 'Enter') {
      if (down && this.story) this.stay();
      return !!this.story;
    }
    if (key === 'n' || key === 'N') {
      if (down) this.skip();
      return this.pushBlock;
    }
    if (this.asking && /^[0-9]$/.test(key)) {
      if (down) this.rate10(Number(key));
      return true;
    }
    return false;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'settle') {
      const want = b.kind === 'rest' ? 'rest' : 'focus';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'guide');
    const endAt = this.plannedSec - this.plan.finaleSec;
    // the last moment: the finale comes whatever is running (a session too short for its quiet, a rest run long)
    if (now >= endAt && !(b.kind === 'rest' && b.rest === 'last' && this.plan.quietSec === 0)) {
      this.endBlock(b.kind === 'push' ? 'time' : null);
      this.beginFinale();
      return;
    }
    if (b.kind === 'push') {
      this.stallT += dt;
      const toReserve = this.reserveAt - now;
      const nearly = this.lastOfPush && this.burn + (b.blind ? this.hidden : 0) >= R.telegraphFill;
      const valveIn = Math.min(R.valveStall - this.stallT, nearly ? Infinity : R.valveSec - this.blockT);
      const soon = !b.blind && this.lastOfPush && this.burn >= R.telegraphFill && this.blockT >= R.minPush - R.telegraph;
      this.telegraph(Math.min(toReserve, soon ? 0 : valveIn), 'rest');
      if (toReserve <= 0) {
        this.endPush('time');
        return;
      }
      if (valveIn <= 0) {
        this.endPush('valve');
        this.valvesNow++;
        this.emit({ type: 'valve' });
      }
      return;
    }
    if (b.kind === 'quiet') return;
    // the settling waits for the opening card: the first push never begins under it
    if (b.kind === 'settle' && this.story) b.dur = Math.max(b.dur, this.blockT + R.telegraph + 2);
    const last = b.kind === 'rest' && b.rest === 'last';
    const nextIsLast = !last && !this.lastDone && now + (b.dur - this.blockT) >= this.reserveAt - R.lastLead;
    const quietNext = last && this.plan.quietSec > 0;
    this.telegraph(b.dur - this.blockT, last ? (quietNext ? 'quiet' : null) : nextIsLast ? 'rest' : 'push');
    if (this.blockT >= b.dur) {
      this.endBlock(null);
      if (last) {
        if (quietNext && endAt - now >= 5) this.open('quiet');
        else this.beginFinale();
      } else if (nextIsLast) this.openLast();
      else this.open('push');
    }
  }

  private telegraph(toEnd: number, next: BlockKind | null): void {
    if (this.telegraphed || toEnd > RULES.telegraph) return;
    this.telegraphed = true;
    this.nextKind = next;
    this.emit({ type: 'telegraph', next });
  }

  /** The push ends (its thoughts burned, the valve, the reserved end): judged, and a rest of whole breaths begins. */
  private endPush(why: BlockWhy): void {
    if (!this.pushBlock) return;
    // its verdict; a blind push's unseen burning joins the thought now (and the view shows it)
    this.endBlock(why);
    if (this.cur && this.burn >= 1 - 1e-9) this.burned();
    // a thought drifting away goes; one still drifting in waits for the next push at the ring's edge
    if (this.cur && this.curState === 'leave') this.cur = null;
    if (why === 'time') {
      this.openLast();
      return;
    }
    if (why === 'valve' && this.burnedInPush === 0) {
      this.open('rest', 'valve');
      return;
    }
    this.open('rest', 'thought');
  }

  /** The last rest: whole breaths that end about when the quiet (or the finale) begins. */
  private openLast(): void {
    this.lastDone = true;
    const cyc = breathCycle(this.pattern) || 10;
    const left = this.plannedSec - this.plan.finaleSec - this.plan.quietSec - this.t;
    const cycles = Math.max(1, Math.round(left / cyc));
    this.open('rest', 'last', cycles);
  }

  /** Open the next block. */
  private open(kind: BlockKind, rest: RestKind | null = null, cyclesWant = 0): void {
    let cycles = 0, dur = Infinity;
    if (kind === 'settle') dur = 3 * this.plan.cueSec;
    else if (kind === 'quiet') dur = Math.max(1, this.plannedSec - this.plan.finaleSec - this.t);
    else if (kind === 'rest') {
      cycles = cyclesWant > 0 ? cyclesWant : this.plan.restCycles;
      dur = cycles * (breathCycle(this.pattern) || 10);
    }
    const b: Block = { kind, dur, blind: false, cycles, rest, why: null, len: 0 };
    const first = !this.plannedBlocks.some(x => x.kind === kind);
    this.plannedBlocks.push(b);
    this.blockIndex = this.plannedBlocks.length - 1;
    this.blockT = 0;
    this.telegraphed = false;
    this.nextKind = null;
    this.stallT = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.waitSaid = false;
    this.noSigSaid = false;
    this.goldRun = 0;
    this.waitRun = 0;
    if (kind === 'push') {
      this.pushesBegun++;
      this.burnedInPush = 0;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.hidden = 0;
      if (b.blind) {
        this.talk.ask('blind', 3, 12);
        this.coach('blind', 'flame');
      }
      if (!this.cur) this.bringNext();
    } else if (kind === 'rest') {
      this.restsNow++;
      this.breathT = 0;
      this.setRestWords(rest ?? 'thought', cycles);
      if (rest === 'valve') this.talk.ask('valve', 3, 12);
      else this.talk.ask('rest', 1, 10);
    } else if (kind === 'quiet') this.talk.ask('quiet', 3, 12);
    else this.talk.ask('settle', 1, 14);
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: this.blockIndex });
    if (kind === 'settle') this.emit({ type: 'cue', i: 0 });
    if (kind === 'rest') {
      const first0 = breathAt(this.pattern, 0).phase;
      this.emit({ type: 'breathTurn', phase: first0, len: this.pattern[first0] });
    }
  }

  /** The rest's words: the last thought's true word (and on every other rest of 2+ breaths, its passage), the valve's, the last rest's. */
  private setRestWords(kind: RestKind, cycles: number): void {
    const lb = this.lastBurned;
    if (kind === 'valve' || !lb) {
      this.restWord = t(kind === 'last' ? 'word.last' : 'word.valve');
      this.restVerseId = kind === 'last' ? ASHES_VERSE : VALVE_VERSES[(this.session + this.restsNow) % VALVE_VERSES.length];
      this.restShowsVerse = cycles >= 2;
      return;
    }
    if (kind === 'last') {
      this.restWord = t('word.last');
      this.restVerseId = ASHES_VERSE;
      this.restShowsVerse = cycles >= 2;
      return;
    }
    this.restWord = lb.word;
    this.restVerseId = lb.verse;
    this.restShowsVerse = cycles >= 2 && this.restsNow % 2 === 0;
  }

  /** The block's strategy for the head. */
  private tipFor(b: Block): string {
    if (b.kind === 'settle') return t(TIPS.settle);
    if (b.kind === 'quiet') return t(TIPS.quiet[this.session % TIPS.quiet.length]);
    if (b.kind === 'rest') return t(TIPS.rest[(this.session + this.restsNow) % TIPS.rest.length], { breath: this.breathText });
    if (b.blind) return t(TIPS.blind[(this.session + this.blockIndex) % TIPS.blind.length]);
    return t(TIPS.burn[(this.session + this.pushesBegun) % TIPS.burn.length]);
  }

  /** The block's end: its verdict over its last ≤ 15 s; a blind push shows its burning now. */
  private endBlock(why: BlockWhy | null): void {
    const b = this.block;
    if (b.len > 0 || !this.plannedBlocks.length) return;
    b.len = Math.max(1e-6, this.blockT);
    if (b.kind === 'push') b.why = why;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'settle') {
      const short = b.kind === 'push' && b.len < RULES.judgeMin;
      share = this.judge.share;
      verdict = !short && this.judge.measured >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = !short && this.judge.measured > 0 ? share : 0;
        if (!short) this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const gained = this.hidden;
        if (gained > 0 && this.cur) {
          this.burn = Math.min(1, this.burn + gained);
          this.revealFlash = 1;
        }
        this.hidden = 0;
        this.emit({ type: 'blindEnd', share: s, gained });
        this.talk.ask('blindEnd', 2, 6);
      }
      if (b.kind === 'rest' && verdict) this.passedRests++;
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.finaleFrom = this.t;
    this.telegraphed = false;
    this.story = null;
    this.emit({ type: 'finale' });
    this.talk.ask('end', 3, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.story = null;
    this.emit({ type: 'done' });
  }

  /** The session's counters reach the progress once (at the end, or early with finish()). */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.burned += this.burnedNow;
    p.ownBurned += this.ownBurnedNow;
    for (const e of EMOS) p.byEmo[e] = (p.byEmo[e] ?? 0) + this.byEmoNow[e];
    p.calmBest = Math.max(p.calmBest, Math.round(this.longestNow * 10) / 10);
    p.quietBest = Math.max(p.quietBest, Math.round(this.quietLongest * 10) / 10);
    p.lastLen = this.plannedSec;
    if (!this.started) return;
    // the library thoughts burned now go to the back next time
    p.recent = [...p.recent.filter(id => !this.burnedIds.includes(id)), ...this.burnedIds].slice(-RULES.recentMax);
    if (p.forgetBurned && this.burnedOwn.length) p.own = p.own.filter(o => !this.burnedOwn.includes(o.text));
    if (this.after !== null) {
      p.history.push({ day: this.day, before: this.before, after: this.after });
      if (p.history.length > RULES.historyMax) p.history.splice(0, p.history.length - RULES.historyMax);
    }
    // the lobby's "before" belongs to this session: the next one asks again
    p.before = null;
  }

  finish(): void { this.end(); }

  // ── calm, quiet ────────────────────────────────────────────────
  private updateCalm(dt: number): void {
    if (!this.restBlock) {
      this.calmRun = 0;
      this.calmGap = 0;
      return;
    }
    if (this.reliable && this.calmShown >= 0.5) {
      this.calmRun += dt;
      this.calmNow += dt;
      this.calmGap = 0;
    } else {
      this.calmGap += dt;
      if (this.calmGap > 2) this.calmRun = 0;
    }
    this.longestNow = Math.max(this.longestNow, this.calmRun);
  }

  private updateQuiet(dt: number): void {
    if (!this.quietBlock || !this.growing) {
      this.quietRun = 0;
      return;
    }
    this.quietNow += dt;
    this.quietRun += dt;
    this.quietLongest = Math.max(this.quietLongest, this.quietRun);
  }

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach, at: CoachAt): void {
    if (this.story) return;
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what, at });
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'skip') return t(touch ? 'coach.skip' : 'coach.skip.click');
    if (what === 'breath') return t('coach.breath', { breath: this.breathText });
    return t(`coach.${what}` as Key);
  }

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The gauge: the band's real level in a sighted focus block past its lead-in, calm in rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable || this.blind) return null;
    if (this.focusBlock) return this.blockT < this.lead ? null : clamp(this.level);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.settleBlock) return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** "7 → 4", "→ 4" (no before), or null (no after). */
  get weightText(): string | null {
    if (this.after === null) return null;
    return this.before === null ? t('weight.one', { after: this.after }) : t('weight.two', { before: this.before, after: this.after });
  }

  /** The session's numbers, idempotent.  The player's own thoughts never appear here — only how many burned. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started && this.burnedNow > 0) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.burnedNow);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [[t('stat.burned'), String(this.burnedNow)]];
    if (this.weightText) stats.push([t('stat.weight'), this.weightText]);
    if (this.ownBurnedNow > 0) stats.push([t('stat.own'), String(this.ownBurnedNow)]);
    stats.push([t('stat.flame'), secText(this.goldSec)], [t('stat.calm'), secText(this.calmNow)]);
    stats.push([t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })]);
    return {
      score: this.burnedNow, unit: unit(this.burnedNow), record: this.bestBefore !== null && this.burnedNow > this.bestBefore,
      stats: stats.slice(0, 6), highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The summary's passage, one the session fits, in turn: the first session the root (2 Cor 10:5), then beauty for ashes, peace. */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push(ROOT_VERSE);
    if (this.burnedNow > 0) fit.push(ASHES_VERSE);
    if (this.byEmoNow.fear > 0) fit.push('isa41.10');
    if (this.byEmoNow.anger > 0) fit.push('eph4.26');
    if (this.byEmoNow.sadness > 0) fit.push('psa147.3');
    if (this.quietNow > 10) fit.push('jhn8.12');
    fit.push('php4.7', '1pe5.7', ROOT_VERSE, QUIET_VERSES[this.session % QUIET_VERSES.length]);
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.weightText) add(0, t(this.before === null ? 'hl.weightOne' : 'hl.weight', { w: this.weightText }));
    if (this.burnedNow > 0) add(0.5, t('hl.burned', { list: emoList(this.byEmoNow) }));
    else if (this.started) add(0.5, t('hl.waits'));
    if (this.ownBurnedNow > 0) add(0.8, t('hl.own', { n: this.ownBurnedNow }));
    if (this.bestBefore !== null && this.burnedNow > this.bestBefore) add(1, t('hl.record', { n: this.burnedNow }));
    if (this.quietLongest >= 10) add(2, t('hl.quiet', { sec: secText(this.quietLongest) }));
    if (this.longestNow >= 10) add(3, t('hl.longest', { sec: secText(this.longestNow) }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.skippedNow > 0) add(4.2, t('hl.skipped', { n: this.skippedNow }));
    if (this.restsNow > 0) add(4.5, t('hl.rests', { breath: this.breathText }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
