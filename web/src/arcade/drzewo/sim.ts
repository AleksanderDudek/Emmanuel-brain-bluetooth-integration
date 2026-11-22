/**
 * Drzewo nad wodą's session, without the DOM (DESIGN.md §18): the whole arc of the meditation in every session —
 *
 *   Postawa (timed)        three posture cues, seated or standing; nothing is gated
 *   Korzenie (focus)       roots grow from the soles down through the soil's layers to the hidden stream
 *   Woda (rest)            water rises from the stream through the roots into the figure (Ps 1:3)
 *   Pień i gałęzie (focus) a tree of light grows through the figure: the trunk, the branches, the crown
 *   Owoce (focus)          the nine fruits of the Spirit ripen one by one, one a push (two in long sessions:
 *                          the blossom sets, then it ripens), a rest with its reflection after each
 *   Wiatr i upał (rest)    wind and heat (or frost) — the tree stands
 *   the close (finale)     the closing card (Jer 17:7 or Ps 92:12-13) and quiet
 *
 * Light only from real focus: a station grows only in a sighted push past its lead-in, with a reliable signal,
 * while `frame.focused` (rules.ts `focusRate`); a push lasts until its station is full (at least 12 s: a station full
 * sooner flows on into the next in the same push), then a rest of whole breaths of the player's pattern; without
 * focus the tree waits — nothing goes back, nothing is lost.  The safety valve rests a push that cannot finish.  The
 * plan (rules.ts `planFor`) fits the arc to the session's length, and the end is reserved for the wind and the close,
 * so the arc always closes near the end; a stronger focus ripens more fruit.  The next fruit and the light gathered
 * in it go on next session.  Each block is judged once at its end over its last ≤ 15 s; every 4th push from the 3rd
 * session is blind.  The headline is the fruits ripened.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, type BreathPattern, type BreathPhase, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CLOSE_VERSES, FRUITS, FRUIT_VERSE, HARVEST_VERSE, REST_VERSES, TIPS, fruitAt, layersFor, seasonOfDay, treePart,
  type FruitId, type Posture, type RestKind, type Season, type StationKind,
} from './content';
import { breathWords, fruitList, fruitName, linesOf, t, unit, type Key } from './i18n';
import { bestOf, breathOf, lenKey, markSeen, type DrzewoProgress } from './meta';
import { RULES, focusRate, planFor, readTime, type Plan } from './rules';
import { Talk } from './talk';

export type BlockKind = 'posture' | 'push' | 'rest';
export type BlockWhy = 'full' | 'valve' | 'time';
/** A block: its planned length (a push: Infinity — it lasts until its station is full), its rest's kind, how it ended. */
export interface Block { kind: BlockKind; dur: number; blind: boolean; cycles: number; rest: RestKind | null; why: BlockWhy | null; len: number }

export type StoryKind = 'open' | 'close';
export interface Story { kind: StoryKind; page: number; pages: number; t: number }

/** A fruit on the tree: its kind, how ripe (0..1), whether it was ripe before the session, its place among its kind. */
export interface Hanging { fruit: FruitId; ripe: number; before: boolean; slot: number }

/** A fruit's card (a tap on a ripe fruit): which, which reflection, how long it has been up and stays. */
export interface Card { fruit: FruitId; page: 1 | 2; t: number; dur: number }

export type Coach = 'grow' | 'breath' | 'tap' | 'menu' | 'blind';
export type CoachAt = 'roots' | 'chest' | 'crown' | 'menu';

/** The one short line of what to do now: it changes only when the action changes. */
export type NowWhat = 'posture' | 'roots' | 'trunk' | 'fruit' | 'dark' | 'rest' | 'valve' | 'wind' | 'end';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'cue'; i: number }
  | { type: 'arrive'; kind: StationKind; i: number }
  | { type: 'grow'; kind: StationKind; fill: number }
  | { type: 'full'; kind: StationKind; i: number }
  | { type: 'stream' }
  | { type: 'crown' }
  | { type: 'blossom'; fruit: FruitId }
  | { type: 'ripe'; fruit: FruitId; n: number }
  | { type: 'harvest'; n: number }
  | { type: 'gold'; on: boolean }
  | { type: 'breathTurn'; phase: BreathPhase; len: number }
  | { type: 'blindEnd'; share: number; gained: number }
  | { type: 'valve' }
  | { type: 'tap'; fruit: FruitId | null }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'picker'; open: boolean }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

export interface Page { title: string; text: string; verse: PassageId }

/** A story card's page: the opening's two (the root, Ps 1:3; then how it works, Col 2:6-7), the closing card. */
export function pageOf(kind: StoryKind, page: number, session = 1): Page {
  if (kind === 'open') {
    return page === 0
      ? { title: t('story.open.title'), text: t('story.open.text'), verse: 'psa1.3' }
      : { title: t('story.open2.title'), text: t('story.open2.text'), verse: 'col2.6-7' };
  }
  return { title: t('story.close.title'), text: t('story.close.text'), verse: inTurn(CLOSE_VERSES, session) };
}

export function pageTime(kind: StoryKind, page: number, session = 1): number {
  const pg = pageOf(kind, page, session);
  return Math.max(RULES.pageSec, readTime(`${pg.title} ${pg.text} ${passage(pg.verse).text}`));
}

export interface SimInit {
  progress: DrzewoProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** today ("YYYY-MM-DD"): the calendar's season */
  day?: string;
}

export class DrzewoSim {
  readonly p: DrzewoProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  readonly session: number;
  readonly firstEver: boolean;
  readonly plan: Plan;
  readonly pattern: BreathPattern;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  readonly day: string;
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
  /** the time the wind's rest takes over (s of play) */
  readonly reserveAt: number;
  windDone = false;

  // ── the way ──
  /** the station the light is at: its kind, its index within its kind (a fruit: its step), its fill */
  kind: StationKind = 'roots';
  si = 0;
  fill = 0;
  hidden = 0;
  /** a blind push's unseen growth was just shown (1 → 0 over RULES.revealSec): the view lights it */
  revealFlash = 0;
  rootsDone = 0;
  trunkDone = 0;
  /** the fruit being ripened (0..8 in Galatians' order) */
  fruitPos: number;
  private readonly startFruitFill: number;
  /** the fruits ripe in the current round of nine */
  readonly cycleRipe: boolean[];
  /** the fruits on the tree, the one ripening among them */
  readonly hang: Hanging[] = [];
  private current: Hanging | null = null;
  streamReached = false;
  crownWhole = false;
  /** the kind of the last rest a station earned and has not had yet (a station full early flowed on) */
  private owedRest: RestKind | null = null;
  /** the fruit whose rest this is (its reflection) and which reflection */
  restFruit: FruitId | null = null;
  restPage: 1 | 2 = 1;

  // ── the band ──
  light: number = RULES.baseLight;
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

  // ── the hands, the cards ──
  breathT = 0;
  reshow = 0;
  story: Story | null = null;
  card: Card | null = null;
  picker = false;
  pickerT = 0;
  /** a coach mark is on screen until this time (s of play): the narrator waits for it */
  hintUntil = 0;

  // ── the session's tallies ──
  fruitsNow = 0;
  harvestsNow = 0;
  readonly ripened: FruitId[] = [];
  goldSec = 0;
  calmNow = 0;
  private calmRun = 0;
  private calmGap = 0;
  longestNow = 0;
  restsNow = 0;
  valvesNow = 0;
  tapsNow = 0;
  private blindShare = -1;
  private passedRests = 0;
  private settled = false;
  /** when the stream was reached and the ninth (or the planned last) fruit ripened (s of play), for the tests */
  streamAt = -1;
  crownAt = -1;
  readonly ripeAt: number[] = [];
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
    this.plan = planFor(this.plannedSec, this.pattern, this.eeg);
    this.reserveAt = this.plannedSec - this.plan.finaleSec - this.plan.windSec;
    this.judge = RoundJudge.from(init.tuning);
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.talk = new Talk(m => linesOf(m), init.rng);
    this.fruitPos = ((this.p.next % 9) + 9) % 9;
    this.startFruitFill = clamp(this.p.nextFill, 0, 0.99);
    this.cycleRipe = FRUITS.map((_, i) => !!this.p.ripe[i]);
    // the fruits already ripe in this round hang on the tree (they show once the crown has grown)
    FRUITS.forEach((f, i) => { if (this.cycleRipe[i]) this.hang.push({ fruit: f, ripe: 1, before: true, slot: 0 }); });
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block {
    return this.plannedBlocks[Math.min(this.blockIndex, this.plannedBlocks.length - 1)]
      ?? { kind: 'posture', dur: 0, blind: false, cycles: 0, rest: null, why: null, len: 0 };
  }
  get blocks(): readonly Block[] { return this.plannedBlocks; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get postureBlock(): boolean { return this.phase === 'play' && this.block.kind === 'posture'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  get lead(): number { return this.plan.lead; }
  /** a sighted push past its lead-in: the tree answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** growing now: sighted, a reliable signal, the focus above the threshold */
  get growing(): boolean { return this.sighted && this.reliable && this.focused; }
  get goldOn(): boolean { return this.gold; }
  get score(): number { return this.fruitsNow; }
  get posture(): Posture { return this.p.posture; }
  get restKind(): RestKind | null { return this.restBlock ? this.block.rest : null; }
  /** the posture cue on screen (0..2) */
  get cue(): number { return this.postureBlock ? Math.min(2, Math.floor(this.blockT / Math.max(0.5, this.plan.cueSec))) : 2; }
  /** the soil's layers on screen */
  get layers() { return layersFor(this.plan.layers); }
  /** the roots' growth 0..1 (to the stream), the tree's 0..1 (trunk, branches, crown) */
  get rootG(): number {
    if (this.pose) return this.pose.root;
    return this.rootsDone >= this.plan.roots ? 1 : clamp((this.rootsDone + (this.kind === 'roots' ? this.fill : 0)) / this.plan.roots);
  }
  get treeG(): number {
    if (this.pose) return this.pose.tree;
    return this.trunkDone >= this.plan.trunk ? 1 : clamp((this.trunkDone + (this.kind === 'trunk' ? this.fill : 0)) / this.plan.trunk);
  }
  /** a still picture's growth (the lobby's preview, the calibration's intro): the view draws it instead of the session's */
  pose: { root: number; tree: number } | null = null;
  /** the fruit being ripened, and how ripe it is (0..1, over its steps) */
  get fruit(): FruitId { return fruitAt(this.fruitPos); }
  get fruitRipe(): number { return this.kind === 'fruit' ? clamp((this.si + this.fill) / this.plan.steps) : 0; }
  /** the station's place for the label: "2/4" (roots, trunk), the fruit's place in the nine */
  get stationNo(): { i: number; of: number } {
    if (this.kind === 'roots') return { i: this.si + 1, of: this.plan.roots };
    if (this.kind === 'trunk') return { i: this.si + 1, of: this.plan.trunk };
    return { i: this.fruitPos + 1, of: 9 };
  }
  /** the narrator waits: a telegraph, the runner's banner, a story card, a fruit's card, the picker, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.card || this.picker || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  get breath(): BreathState & { cycle: number; cycles: number } {
    const b = breathAt(this.pattern, this.breathT);
    const cycles = Math.max(1, this.block.cycles || 1);
    return { ...b, cycle: Math.min(cycles, b.n + 1), cycles };
  }
  get breathText(): string { return breathWords(this.pattern); }
  /** how far the rest has gone (0..1), for the water rising and the wind */
  get restK(): number { return this.restBlock && Number.isFinite(this.block.dur) ? clamp(this.blockT / Math.max(1, this.block.dur)) : 0; }

  /** What to do now, in one short line. */
  get now(): NowWhat {
    if (this.phase !== 'play') return 'end';
    const b = this.block;
    if (b.kind === 'posture') return 'posture';
    if (b.kind === 'rest') return b.rest === 'valve' ? 'valve' : b.rest === 'wind' ? 'wind' : 'rest';
    if (b.blind) return 'dark';
    return this.kind;
  }

  /** The season on the screen now: the chosen one, the calendar's, or (auto, 15 minutes and more) the year turning through the session. */
  get season(): Season {
    const m = this.p.season;
    if (m !== 'auto') return m;
    if (this.plannedSec < 900) return seasonOfDay(this.day);
    if (this.phase !== 'play') return 'winter';
    if (this.kind !== 'fruit' && this.fruitsNow === 0) return 'spring';
    return this.fruitsNow < Math.ceil(this.plan.fruits * 0.6) && this.block.rest !== 'wind' ? 'summer' : 'autumn';
  }

  /** The line in the band: the posture cue, the stage's prayer, a fruit's prayer. */
  get line(): string {
    if (this.started && this.phase !== 'play') return t('story.close.text');
    if (this.postureBlock) return t(`cue.${this.p.posture}.${this.cue + 1}` as Key);
    if (this.kind === 'roots') return t('pray.roots');
    if (this.kind === 'trunk') return t(`pray.${treePart(this.treeG)}` as Key);
    return t('pray.fruit', { fruit: fruitName(this.fruit) });
  }

  /** The verse a rest abides in (a fruit's rest reads its reflection instead: null). */
  get restVerse(): PassageId | null {
    const k = this.restKind;
    if (!k || k === 'fruit') return null;
    const list = REST_VERSES[k];
    return list[(this.session - 1 + this.restsNow) % list.length];
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.open('posture');
    if (this.firstEver && markSeen(this.p, 's.open')) {
      this.story = { kind: 'open', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'open', page: 0 });
    }
    this.talk.ask(this.firstEver ? 'open' : 'posture', 2, 30);
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
    if (this.phase === 'finale' && now >= Math.max(this.plannedSec, this.finaleFrom + 3)) this.end();
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    if (this.restBlock) this.updateBreath(dt);
    this.updateStory(dt);
    this.updateCard(dt);
    if (this.pushBlock) this.updateGrowth(dt);
    this.revealFlash = Math.max(0, this.revealFlash - dt / RULES.revealSec);
    this.updateCalm(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    if (this.picker) {
      this.pickerT += dt;
      if (this.pickerT >= RULES.pickerIdle) this.closePicker();
    }
    this.talk.update(dt, now, this.talkBlocked);
  }

  private finaleFrom = Infinity;

  private updateLight(dt: number, f: FocusFrame): void {
    const target = this.sighted && this.reliable ? clamp(f.level) : this.restBlock ? RULES.restLight : RULES.baseLight;
    this.light = approach(this.light, target, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    const gold = this.growing;
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
    if (this.sighted && this.blockT >= this.lead + 0.5) this.coach('grow', this.kind === 'roots' ? 'roots' : this.kind === 'fruit' ? 'crown' : 'chest');
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
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
    if (s.t >= pageTime(s.kind, s.page, this.session)) this.turnStory();
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

  private updateCard(dt: number): void {
    const c = this.card;
    if (!c) return;
    c.t += dt;
    if (c.t >= c.dur) this.card = null;
  }

  // ── growth ─────────────────────────────────────────────────────
  /** Focus-seconds a second now: the founder's rule in a push past its lead-in with a reliable signal (sighted or blind), else nothing. */
  rate(): number {
    if (!this.pushBlock || this.blockT < this.lead || !this.reliable) return 0;
    return focusRate(this.level, this.focused, this.hold);
  }

  /** What the current station needs (focus-seconds). */
  get need(): number {
    return this.kind === 'roots' ? this.plan.needRoot : this.kind === 'trunk' ? this.plan.needTrunk : this.plan.needFruit;
  }

  private updateGrowth(dt: number): void {
    const n = (this.rate() * dt) / Math.max(0.5, this.need);
    if (n <= 0) return;
    this.stallT = 0;
    if (this.blind) {
      // in the dark the station grows unseen; full, the push ends and shows it
      this.hidden = Math.min(Math.max(0, 1 - this.fill), this.hidden + n);
      if (this.fill + this.hidden >= 1 - 1e-9) this.endPush('full');
      return;
    }
    const before = this.fill;
    this.fill = Math.min(1, this.fill + n);
    this.syncCurrent();
    if (Math.floor(before * 10) !== Math.floor(this.fill * 10)) this.emit({ type: 'grow', kind: this.kind, fill: this.fill });
    if (this.fill < 1 - 1e-9) return;
    if (this.blockT < RULES.minPush) {
      // full before the push's least length: the light flows on into the next station in the same push
      this.complete();
      this.moveOn(true);
    } else this.endPush('full');
  }

  /** On to the next station: its fill (a resumed fruit: the light gathered last time), and it arrives now or with the next push. */
  private moveOn(arriveNow: boolean): void {
    this.advance();
    this.fill = clamp(this.pendingFill, 0, 0.99);
    this.pendingFill = 0;
    if (arriveNow) this.arrive(false);
  }

  /** The current fruit's ripeness on the tree follows its step and fill. */
  private syncCurrent(): void {
    if (this.kind === 'fruit' && this.current) this.current.ripe = this.fruitRipe;
  }

  /** The light arrives at the current station (a new push, or a flow on within one). */
  private arrive(say = true): void {
    this.stallT = 0;
    if (this.kind === 'fruit') this.hangCurrent();
    this.emit({ type: 'arrive', kind: this.kind, i: this.si });
    if (this.pushBlock) this.tip = this.tipFor(this.block);
    if (!say) return;
    if (this.kind === 'roots' && this.si === 0) this.talk.ask('roots', 2, 10);
    else if (this.kind === 'trunk' && this.si === 0) this.talk.ask('trunk', 2, 10);
  }

  /** The fruit being ripened hangs on the tree (a blossom at first). */
  private hangCurrent(): void {
    const f = this.fruit;
    if (this.current && this.current.fruit === f && this.current.ripe < 1) return;
    const slot = this.hang.filter(h => h.fruit === f).length;
    this.current = { fruit: f, ripe: this.fruitRipe, before: false, slot };
    this.hang.push(this.current);
    if (this.si === 0) this.emit({ type: 'blossom', fruit: f });
  }

  /** The station is full: its tally, its moment. */
  private complete(): void {
    const k = this.kind;
    this.fill = 1;
    this.emit({ type: 'full', kind: k, i: this.si });
    if (k === 'roots') {
      this.rootsDone = Math.min(this.plan.roots, this.rootsDone + 1);
      if (this.rootsDone >= this.plan.roots && !this.streamReached) {
        this.streamReached = true;
        this.streamAt = this.t;
        this.emit({ type: 'stream' });
        this.talk.ask('stream', 3, 8);
        this.owedRest = 'water';
      } else this.owedRest = this.owedRest ?? 'soil';
    } else if (k === 'trunk') {
      this.trunkDone = Math.min(this.plan.trunk, this.trunkDone + 1);
      if (this.trunkDone >= this.plan.trunk && !this.crownWhole) {
        this.crownWhole = true;
        this.crownAt = this.t;
        this.emit({ type: 'crown' });
        this.talk.ask('crown', 3, 8);
        this.owedRest = 'crown';
      } else if (this.owedRest !== 'water') this.owedRest = 'tree';
    } else {
      const last = this.si + 1 >= this.plan.steps;
      if (this.owedRest !== 'water' && this.owedRest !== 'crown') this.owedRest = 'fruit';
      this.restFruit = this.fruit;
      this.restPage = this.plan.steps === 2 && !last ? 1 : this.plan.steps === 2 ? 2 : 1;
      if (last) this.ripen();
    }
  }

  /** The fruit is ripe: on the tree, in the round of nine, in the tally. */
  private ripen(): void {
    const f = this.fruit;
    if (this.current) this.current.ripe = 1;
    this.current = null;
    this.fruitsNow++;
    this.ripened.push(f);
    this.ripeAt.push(this.t);
    this.cycleRipe[this.fruitPos] = true;
    this.emit({ type: 'ripe', fruit: f, n: this.fruitsNow });
    this.coach('tap', 'crown');
    if (this.cycleRipe.every(Boolean)) {
      this.harvestsNow++;
      for (let i = 0; i < 9; i++) this.cycleRipe[i] = false;
      this.emit({ type: 'harvest', n: this.harvestsNow });
      this.talk.ask('harvest', 3, 8);
    } else this.talk.ask('fruit', 2, 6);
  }

  /** On to the next station: the next root layer, the trunk, the next step of the fruit, the next fruit. */
  private advance(): void {
    if (this.kind === 'roots') {
      if (this.rootsDone < this.plan.roots) { this.si = this.rootsDone; return; }
      this.kind = 'trunk';
      this.si = this.trunkDone;
      if (this.trunkDone < this.plan.trunk) return;
    }
    if (this.kind === 'trunk') {
      if (this.trunkDone < this.plan.trunk) { this.si = this.trunkDone; return; }
      this.kind = 'fruit';
      // the session's first fruit: the light gathered on it last time
      const steps = this.plan.steps;
      const carried = this.startFruitFill * steps;
      this.si = Math.min(steps - 1, Math.floor(carried));
      this.fill = 0;
      this.pendingFill = carried - this.si;
      return;
    }
    // a fruit: its next step, or the next fruit
    if (this.si + 1 < this.plan.steps && this.current) { this.si++; return; }
    this.fruitPos = (this.fruitPos + 1) % 9;
    this.si = 0;
  }

  /** the light a resumed fruit starts with (its step's share), applied when the light arrives */
  private pendingFill = 0;

  // ── the hands ──────────────────────────────────────────────────
  /**
   * A tap that is not on a fruit, Space: on a story card, turn its page (after a moment); close a fruit's card; else
   * stay with the line (it glows again) — never growth.
   */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    if (this.card) {
      this.card = null;
      return true;
    }
    this.reshow = RULES.reshowSec;
    this.tapsNow++;
    this.emit({ type: 'tap', fruit: null });
    return true;
  }

  /** A tap on a ripe fruit: its card (its name and a reflection; the same fruit again: the other reflection). */
  openFruit(f: FruitId): boolean {
    if (!this.started || this.phase === 'done' || this.story) return false;
    const page: 1 | 2 = this.card && this.card.fruit === f && this.card.page === 1 ? 2 : 1;
    const text = `${fruitName(f)} ${t(`fruit.${f}.r${page}` as Key)}`;
    this.card = { fruit: f, page, t: 0, dur: readTime(text) + 1 };
    this.tapsNow++;
    this.emit({ type: 'tap', fruit: f });
    return true;
  }

  /** The ripe fruits a tap may open. */
  get ripeOnTree(): Hanging[] { return this.crownShownK > 0.5 ? this.hang.filter(h => h.ripe >= 1) : []; }
  /** the crown is there to hang fruit on (the fruits ripe before show with it) */
  get crownShownK(): number { return clamp((this.treeG - 0.74) / 0.26); }

  openPicker(): void {
    if (!this.started || this.phase === 'done' || this.story) return;
    this.picker = true;
    this.pickerT = 0;
    this.card = null;
    this.emit({ type: 'picker', open: true });
  }
  closePicker(): void {
    if (!this.picker) return;
    this.picker = false;
    this.emit({ type: 'picker', open: false });
  }
  /** A choice in the picker keeps it open a while longer. */
  touchPicker(): void { this.pickerT = 0; }

  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Spacebar') {
      if (down) this.stay();
      return true;
    }
    if (key === 'Enter') {
      if (down && this.story) this.stay();
      return !!this.story;
    }
    if (key === 'm' || key === 'M') {
      if (down) { if (this.picker) this.closePicker(); else this.openPicker(); }
      return true;
    }
    if (key === 'Escape' && (this.picker || this.card)) {
      if (down) { this.closePicker(); this.card = null; }
      return true;
    }
    return false;
  }

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'posture') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'chest');
    if (b.kind === 'rest' && this.restsNow >= 2 && this.blockT >= R.bannerSec + 8 && this.blockT - dt < R.bannerSec + 8) this.coach('menu', 'menu');
    const endAt = this.plannedSec - this.plan.finaleSec;
    // the last moment: the finale comes whatever is running (a session too short for its wind, a rest run long)
    if (now >= endAt && !(b.kind === 'rest' && b.rest === 'wind')) {
      this.endBlock(b.kind === 'push' ? 'time' : null);
      this.beginFinale();
      return;
    }
    if (b.kind === 'push') {
      this.stallT += dt;
      const toReserve = this.reserveAt - now;
      const nearly = this.fill + (b.blind ? this.hidden : 0) >= R.telegraphFill;
      const valveIn = Math.min(R.valveStall - this.stallT, nearly ? Infinity : R.valveSec - this.blockT);
      const soon = !b.blind && this.fill >= R.telegraphFill && this.blockT >= R.minPush - R.telegraph;
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
    // the posture waits for the opening card: the first push never begins under it
    if (b.kind === 'posture' && this.story) b.dur = Math.max(b.dur, this.blockT + R.telegraph + 2);
    const wind = b.kind === 'rest' && b.rest === 'wind';
    const nextIsWind = !wind && !this.windDone && now + (b.dur - this.blockT) >= this.reserveAt - R.windLead;
    this.telegraph(b.dur - this.blockT, wind ? null : nextIsWind ? 'rest' : 'push');
    if (this.blockT >= b.dur) {
      this.endBlock(null);
      if (wind) this.beginFinale();
      else if (nextIsWind) this.openWind();
      else {
        this.open('push');
      }
    }
  }

  private telegraph(toEnd: number, next: BlockKind | null): void {
    if (this.telegraphed || toEnd > RULES.telegraph) return;
    this.telegraphed = true;
    this.nextKind = next;
    this.emit({ type: 'telegraph', next });
  }

  /** The push ends (its station full, the valve, the reserved end): judged, and a rest of whole breaths begins. */
  private endPush(why: BlockWhy): void {
    if (!this.pushBlock) return;
    // its verdict; a blind push's unseen growth joins the station now (and the view shows it)
    this.endBlock(why);
    const full = this.fill >= 1 - 1e-9;
    if (full) {
      this.complete();
      this.moveOn(false);
    }
    if (why === 'time') {
      this.owedRest = null;
      this.openWind();
      return;
    }
    if (why === 'valve' && !full) {
      this.open('rest', 'valve');
      return;
    }
    const rest = this.owedRest ?? 'soil';
    this.owedRest = null;
    this.open('rest', rest);
  }

  /** The wind's rest: whole breaths that end about when the finale begins. */
  private openWind(): void {
    this.windDone = true;
    const cyc = breathCycle(this.pattern) || 10;
    const left = this.plannedSec - this.plan.finaleSec - this.t;
    const cycles = Math.max(1, Math.round(left / cyc));
    this.open('rest', 'wind', cycles);
  }

  /** Open the next block. */
  private open(kind: BlockKind, rest: RestKind | null = null, cyclesWant = 0): void {
    let cycles = 0, dur = Infinity;
    if (kind === 'posture') dur = 3 * this.plan.cueSec;
    else if (kind === 'rest') {
      const extra = rest === 'water' || rest === 'wind' ? this.plan.extra : 0;
      cycles = cyclesWant > 0 ? cyclesWant : this.plan.restCycles + extra;
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
    this.noSigSaid = false;
    this.goldRun = 0;
    this.waitRun = 0;
    if (kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.hidden = 0;
      if (b.blind) {
        this.talk.ask('blind', 3, 12);
        this.coach('blind', this.kind === 'roots' ? 'roots' : 'crown');
      }
      this.restFruit = null;
      this.arrive(true);
    } else if (kind === 'rest') {
      this.restsNow++;
      this.breathT = 0;
      if (rest !== 'fruit') this.restFruit = null;
      if (rest === 'water') this.talk.ask('water', 3, 12);
      else if (rest === 'wind') this.talk.ask('wind', 3, 12);
      else if (rest === 'valve') this.talk.ask('valve', 3, 12);
    } else this.talk.ask('posture', 1, 14);
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: this.blockIndex });
    if (kind === 'posture') this.emit({ type: 'cue', i: 0 });
    if (kind === 'rest') {
      const first0 = breathAt(this.pattern, 0).phase;
      this.emit({ type: 'breathTurn', phase: first0, len: this.pattern[first0] });
    }
  }

  /** The block's strategy for the head. */
  private tipFor(b: Block): string {
    if (b.kind === 'posture') return t(TIPS.posture);
    if (b.kind === 'rest') {
      if (b.rest === 'wind') return t(TIPS.wind);
      return t(TIPS.rest[(this.session + this.restsNow) % TIPS.rest.length], { breath: this.breathText });
    }
    if (b.blind) return t(TIPS.blind[(this.session + this.blockIndex) % TIPS.blind.length]);
    if (this.pushesBegun % RULES.repeatEvery === 0) return t(TIPS.repeat, { prayer: this.line });
    if (this.kind === 'roots') return t(TIPS.roots[this.si % TIPS.roots.length]);
    if (this.kind === 'trunk') return t(TIPS.trunk[this.si % TIPS.trunk.length]);
    return t(`fruit.${this.fruit}.task` as Key);
  }

  /** The block's end: its verdict over its last ≤ 15 s; a blind push shows its growth now. */
  private endBlock(why: BlockWhy | null): void {
    const b = this.block;
    if (b.len > 0 || !this.plannedBlocks.length) return;
    b.len = Math.max(1e-6, this.blockT);
    if (b.kind === 'push') b.why = why;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'posture') {
      const short = b.kind === 'push' && b.len < RULES.judgeMin;
      share = this.judge.share;
      verdict = !short && this.judge.measured >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = !short && this.judge.measured > 0 ? share : 0;
        if (!short) this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const gained = this.hidden;
        if (gained > 0) {
          this.fill = Math.min(1, this.fill + gained);
          this.syncCurrent();
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
    this.picker = false;
    this.card = null;
    this.story = { kind: 'close', page: 0, pages: 1, t: 0 };
    this.emit({ type: 'finale' });
    this.emit({ type: 'story', kind: 'close', page: 0 });
    this.talk.ask('end', 3, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.story = null;
    this.emit({ type: 'done' });
  }

  /** The session's counters reach the progress once (at the end, or early with finish()), and the next fruit. */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.fruits += this.fruitsNow;
    p.harvests += this.harvestsNow;
    for (const f of this.ripened) p.count[f] = (p.count[f] ?? 0) + 1;
    if (this.streamReached) p.streams++;
    p.calmBest = Math.max(p.calmBest, Math.round(this.longestNow * 10) / 10);
    p.lastLen = this.plannedSec;
    if (this.started) {
      p.next = this.fruitPos;
      // the light gathered in the fruit being ripened (a blind push cut short: what grew unseen counts); before the
      // fruits, the light the session began with stays
      const gathered = this.kind === 'fruit' ? clamp((this.si + Math.min(1, this.fill + (this.blind ? this.hidden : 0))) / this.plan.steps) : this.startFruitFill;
      p.nextFill = Math.min(0.99, Math.max(0, gathered));
      p.ripe = [...this.cycleRipe];
    }
  }

  finish(): void { this.end(); }

  // ── calm ───────────────────────────────────────────────────────
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

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach, at: CoachAt): void {
    if (this.story) return;
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what, at });
  }

  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.tap.click');
    if (what === 'menu') return t(touch ? 'coach.menu' : 'coach.menu.click');
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

  /** The gauge: the band's real level in a sighted push past its lead-in, calm in rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable || this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.level);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.postureBlock) return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started && this.fruitsNow > 0) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.fruitsNow);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.fruits'), String(this.fruitsNow)],
      [t('stat.stream'), this.streamReached ? t('stat.yes') : t('stat.notYet')],
      [t('stat.grow'), secText(this.goldSec)],
      [t('stat.calm'), secText(this.calmNow)],
      [t('stat.longest'), secText(this.longestNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.fruitsNow, unit: unit(this.fruitsNow), record: this.bestBefore !== null && this.fruitsNow > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /** The summary's passage, one the session fits, in turn: the first session the root (Ps 1:3), a harvest John 15:5, fruit Gal 5:22-23. */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('psa1.3');
    if (this.harvestsNow > 0) fit.push(HARVEST_VERSE);
    if (this.fruitsNow > 0) fit.push(FRUIT_VERSE);
    if (this.passedRests > 0 || this.longestNow >= 15) fit.push('psa16.8');
    fit.push('jer17.7', 'psa92.12-13', 'col2.6-7', 'isa40.31');
    return inTurn(fit, this.session || 1);
  }

  /** The fruit the next session begins with (after settle; before it, the one ripening now). */
  get nextFruit(): FruitId { return fruitAt(this.settled ? this.p.next : this.fruitPos); }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.harvestsNow > 0) add(0, t('hl.harvest'));
    if (this.fruitsNow > 0) add(0.5, t('hl.fruits', { list: fruitList(this.ripened) }));
    else if (this.crownWhole) add(0.5, t('hl.crown'));
    else if (this.streamReached) add(0.5, t('hl.stream'));
    else if (this.started) add(0.5, t('hl.waits'));
    if (this.started) add(0.8, t('hl.next', { fruit: fruitName(this.nextFruit) }));
    if (this.bestBefore !== null && this.fruitsNow > this.bestBefore) add(1, t('hl.record', { n: this.fruitsNow }));
    if (this.longestNow >= 10) add(3, t('hl.longest', { sec: secText(this.longestNow) }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.restsNow > 0) add(4.5, t('hl.rests', { breath: this.breathText }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
