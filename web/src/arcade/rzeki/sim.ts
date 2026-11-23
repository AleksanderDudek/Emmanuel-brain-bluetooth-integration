/**
 * Rzeki żywej wody's session, without the DOM (DESIGN.md §13.14): light comes down from an open heaven and rests
 * at the stations of a map, one at a time, from the top down (receiving: the prayer of each station); then it
 * rises back from the bottom (thanksgiving).  The lobby's card chooses the map (all 17 stations by default) and
 * the way (down, up, or both: down, then up).  The way goes on next session where it stopped.
 *
 *   a push block = loading one station     the station's light: its glow passes a faint ring at the threshold and
 *   (a sighted push past its lead-in,      turns gold, and its glass loads — only then, at the founder's rate
 *   a reliable signal, focused)            (rules.ts `focusRate`); the push has no fixed length: it ends when the
 *                                          station is full
 *   a rest after every station             whole breaths of the player's pattern (kit/breath.ts: in, hold, out,
 *   (abiding; the lobby's Rytm: after      hold empty, 0–15 s each; 4 · 6 by default), beginning with its first
 *   1–4 stations, 1–12 breaths)            phase and ending at a breath's end; the lit stations shine, drops of
 *                                          living water gather with calm; nothing loads; then the light flows on.
 *                                          With a rest after 2 or more, the light flows on within the push; a way's
 *                                          last station and a blind push always end in a rest
 *   the safety valve                       a push that cannot finish (60 s without any light gained, or 150 s at
 *                                          one station) gives way to a rest of whole breaths; the station keeps its light
 *   the hands (a tap anywhere, Space)      stay with the station: its prayer returns, a ring of light, a glass
 *                                          tone — never light
 *   a blind push ("w ciemności")           the light loads unseen by the same rule; the push still ends when the
 *                                          station is full, and the hidden light is shown then
 *
 * The founder's word of 2026-11-17: *"chcę żeby faza odpoczynku była po każdej uzupełnionej sferze. Nie co
 * interwał. Faza odpoczynku powinna być wielokrotnością sekcji oddechowej."*  Each push is judged once at its end
 * over its last ≤ 15 s (a push under 10 s — a station resumed nearly full — is not judged), each rest the same; a
 * 4 s telegraph announces the rest when the station is 85 % full and the next push 4 s before the rest ends.  The
 * headline is the drops of living water (kropli): they flow in the warm-up and the finale, in a push only while the
 * light loads, in rest with calm.  An unreliable signal freezes everything — nothing is lost, nothing advances.
 */
import { fmtNum } from '../../i18n';
import { breathAt, breathCycle, breathRestOf, type BreathPattern, type BreathPhase, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp, ease } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  MAP, STATIONS, TIPS, cleanOwn, fromText, legs, lineAt, linesOf, pushTip, route, stationLabel, stationName, stationWhere, tierName, verseOf, windowTier,
  type Dir, type MapId, type Moment, type StationId, type Tier, type Way,
} from './content';
import { breathWords, dropsText, t, unit, type Key } from './i18n';
import { bestOf, breathOf, countStation, lenKey, markSeen, restOf, startOf, tierOf, timesLit, type RzekiPos, type RzekiProgress } from './meta';
import { RULES, focusRate, readTime } from './rules';
import { Talk } from './talk';
import { tileTotal, tilesOpen } from './tiles';

export type BlockKind = 'warmup' | 'push' | 'rest';
/** Why a push ended, or why a rest came: the station full, the safety valve, the session's time. */
export type BlockWhy = 'full' | 'valve' | 'time';
/**
 * A block.  `dur` is its planned length — the warm-up's, a rest's whole breaths (`cycles` × the pattern's cycle) —
 * or Infinity for a push, which lasts until its station is full; `len` how long it lasted (set at its end);
 * `why` how a push ended, or why a rest came.
 */
export interface Block { kind: BlockKind; dur: number; blind: boolean; cycles: number; why: BlockWhy | null; len: number }

/**
 * Where the light is on its way: `enter` (coming down from the open heaven, or up from the pool, to the way's first
 * station), `at` a station (loading), `hold` (full: the rest abides in its light), `flow` (the stream to the next
 * station, as the next push begins), `whole` (the last station done: the whole figure in light and the closing card).
 */
export type Stage = 'enter' | 'at' | 'hold' | 'flow' | 'whole';

export type StoryKind = 'open' | 'news' | 'down' | 'up';
export interface Story { kind: StoryKind; page: number; pages: number; t: number }

/** The first-time explanations (coach marks) and what each points at. */
export type Coach = 'tap' | 'light' | 'petals' | 'breath' | 'drops' | 'blind' | 'strip';
export type CoachAt = 'place' | 'chest' | 'pool' | 'strip';

/** The one short line of what to do now (the round-11 clarity rule): it changes only when the action changes. */
export type NowWhat = 'warm' | 'focus' | 'dark' | 'rest' | 'valve' | 'end';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: BlockKind | null }
  | { type: 'enter'; dir: Dir; station: StationId }
  | { type: 'arrive'; station: StationId; dir: Dir; idx: number }
  | { type: 'tap'; station: StationId; stage: Stage }
  | { type: 'petal'; station: StationId; n: number; of: number }
  | { type: 'full'; station: StationId; dir: Dir; drops: number }
  | { type: 'flow'; from: StationId; to: StationId; dir: Dir }
  | { type: 'whole'; dir: Dir; drops: number }
  | { type: 'tier'; station: StationId; tier: Tier }
  | { type: 'again'; round: number }
  | { type: 'gold'; on: boolean }
  | { type: 'breathTurn'; phase: BreathPhase; len: number }
  | { type: 'drops'; n: number; at: 'rest' | 'block' }
  | { type: 'blindEnd'; share: number; drops: number; gained: number }
  | { type: 'valve'; station: StationId }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** The drops at which the rivers reach the edges: 700 up to 10 minutes, then in proportion to the session's length. */
export const riverFullFor = (plannedSec: number): number => RULES.riverFull * Math.max(1, plannedSec / RULES.riverSec);

/** The first-ever session's warm-up (s): 30 in 5 and 10 min, 20 in 3, at most 6 in a short test. */
export function warmFor(plannedSec: number): number {
  if (plannedSec <= 60) return Math.min(RULES.warm.test, Math.max(8, plannedSec - finaleFor(plannedSec)) / 3);
  return plannedSec >= 300 ? RULES.warm.long : RULES.warm.short;
}

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/** A story card's page: its title, its sentence or two, its verse. */
export interface Page { title: string; text: string; verse: PassageId }

/** The page of a story card (the opening's two, what is new, the closing card of a way). */
export function pageOf(kind: StoryKind, page: number): Page {
  if (kind === 'open') {
    return page === 0
      ? { title: t('story.open.title'), text: t('story.open.text'), verse: 'isa11.2' }
      : { title: t('story.open2.title'), text: t('story.open2.text'), verse: 'jhn7.38-39' };
  }
  if (kind === 'news') return { title: t('story.news.title'), text: t('story.news.text'), verse: 'psa46.4' };
  if (kind === 'down') return { title: t('story.down.title'), text: t('story.down.text'), verse: 'luk11.13' };
  return { title: t('story.up.title'), text: t('story.up.text'), verse: 'psa141.2' };
}

/** How long a story card's page stays unless tapped: its reading time (title, text and verse), at least RULES.pageSec. */
export function pageTime(kind: StoryKind, page: number): number {
  const pg = pageOf(kind, page);
  return Math.max(RULES.pageSec, readTime(`${pg.title} ${pg.text} ${passage(pg.verse).text}`));
}

export interface SimInit {
  progress: RzekiProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
  /**
   * The rest's rhythm the player set in the lobby (kit/rhythm.ts, `rzekiRhythm`): after how many stations lit a rest
   * comes, and how many whole breaths it lasts; absent: one station, the breaths nearest RULES.restTarget s.
   */
  rhythm?: { focus: number; rest: number } | null;
}

/** The lit bits of a station this round: 1 lit going down, 2 thanked going up. */
export const LIT_DOWN = 1;
export const LIT_UP = 2;

const zeros = (): Record<StationId, number> => Object.fromEntries(STATIONS.map(s => [s, 0])) as Record<StationId, number>;

export class RzekiSim {
  readonly p: RzekiProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  /** this session's number (1 = the first ever) */
  readonly session: number;
  readonly firstEver: boolean;
  readonly map: MapId;
  readonly way: Way;
  readonly own: string;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  /** the session went on from where the last one stopped (a station after the top, or light already gathered) */
  readonly resumed: boolean;
  /** the rest's breath (the lobby's card; read once a session) */
  readonly pattern: BreathPattern;
  /** a rest comes after this many stations lit in one push (the lobby's Rytm; 1 by design) */
  readonly restAfter: number;
  /** each rest of this session: whole breaths of the pattern (the lobby's Rytm, or the breaths nearest restTarget s) */
  readonly restLen: { cycles: number; sec: number };
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  /** the drops at which the rivers reach the edges (RULES.riverFull, scaled up for a session past riverSec) */
  readonly riverFull: number;
  /** the blocks so far, the current one last */
  private readonly plan: Block[] = [];
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;
  private readonly legList: readonly Dir[];

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  /** what the telegraph announced (null: the quiet end) */
  nextKind: BlockKind | null = null;
  tip = '';
  private pushesBegun = 0;
  /** a push: seconds since its light last grew (the safety valve) */
  stallT = 0;
  /** a push: the stations it lit so far, and the seconds since it began or last lit one (the safety valve) */
  litInPush = 0;
  stationT = 0;
  // the way
  leg = 0;
  dir: Dir = 'down';
  round = 1;
  stage: Stage = 'enter';
  stageT = 0;
  idx = 0;
  /** the current station's light gathered (0..1, as shown), and what a blind block gathers unseen */
  fill = 0;
  hidden = 0;
  /** a blind block's light being shown (from → to over revealSec; t < 0: none) */
  reveal = { from: 0, to: 0, t: -1 };
  /** focus while the light flows on or comes in (a push past its lead-in): the next station starts with it */
  pre = 0;
  /** where the light starts when it arrives (a resumed station's light) */
  private startFill = 0;
  /** stations the light arrived at this session (the first enter of a resumed way says where it goes on) */
  arrivals = 0;
  private petals = 0;
  /** each station this round: LIT_DOWN | LIT_UP bits; and the session's memory of stations lit (for a soft glow) */
  lit: Record<StationId, number>;
  memory: Record<StationId, number>;
  /** each station's window craft now (it grows with the times lit, across sessions and in this one) */
  tiers: Record<StationId, Tier>;
  private tiersNow: { station: StationId; tier: Tier }[] = [];
  // the light and the band
  light: number = RULES.baseLight;
  /** the band's level, its focus and its hold this frame (reliable frames only) */
  level = 0;
  focused = false;
  hold = 0;
  calmShown = 0;
  reliable = false;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private waitRun = 0;
  private waitSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  // the breath, the hands
  breathT = 0;
  /** the prayer glows again after a tap (s left) */
  reshow = 0;
  // the story cards
  story: Story | null = null;
  // the drops
  drops = 0;
  private restAcc = 0;
  private restTick = 0;
  // the session's tallies
  placesNow = 0;
  descentsNow = 0;
  ascentsNow = 0;
  tapsNow = 0;
  /** rests of whole breaths, and the safety valve's (this session) */
  restsNow = 0;
  valvesNow = 0;
  /** seconds the light loaded (in sight) */
  goldSec = 0;
  abideNow = 0;
  private abideRun = 0;
  private abideGap = 0;
  longestNow = 0;
  private litDownNow: Record<StationId, number>;
  private litUpNow: Record<StationId, number>;
  private lastLit: StationId | null = null;
  private passedRests = 0;
  private blindShare = -1;
  /** the session's counters reached the progress (once) */
  private settled = false;
  /** where the next session goes on, as settle() saved it */
  nextPos: RzekiPos | null = null;
  /** a coach mark of the runner is on screen until this time (s of play): the narrator waits for it */
  hintUntil = 0;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.map = this.p.map;
    this.way = this.p.way;
    this.own = cleanOwn(this.p.own);
    this.pattern = breathOf(this.p);
    this.restAfter = Math.max(1, Math.min(RULES.restAfterMax, Math.round(init.rhythm?.focus ?? RULES.restAfter)));
    this.restLen = init.rhythm ? breathRestOf(this.pattern, Math.min(RULES.restBreathsMax, init.rhythm.rest)) : restOf(this.p);
    this.legList = legs(this.way);
    const st = startOf(this.p);
    this.leg = st.leg;
    this.dir = st.dir;
    this.idx = st.idx;
    this.startFill = st.fill;
    this.resumed = st.resumed;
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.riverFull = riverFullFor(this.plannedSec);
    this.talk = new Talk(m => linesOf(m), init.rng);
    this.lit = zeros();
    this.memory = zeros();
    this.litDownNow = zeros();
    this.litUpNow = zeros();
    this.tiers = Object.fromEntries(STATIONS.map(s => [s, tierOf(this.p, s)])) as Record<StationId, Tier>;
    // a way resumed: the stations it already passed (in earlier sessions) shine as lit
    if (st.leg > 0) for (const s of route(this.map, 'down')) this.lit[s] |= LIT_DOWN;
    for (const s of route(this.map, this.dir).slice(0, st.idx)) this.lit[s] |= this.dir === 'down' ? LIT_DOWN : LIT_UP;
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block {
    return this.plan[Math.min(this.blockIndex, this.plan.length - 1)] ?? { kind: 'warmup', dur: 0, blind: false, cycles: 0, why: null, len: 0 };
  }
  /** the blocks so far (the current one last) */
  get blocks(): readonly Block[] { return this.plan; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the light answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** the light loads now: a sighted push past its lead-in, a reliable signal, the focus above the threshold */
  get loading(): boolean { return this.sighted && this.reliable && this.focused; }
  get leadIn(): number { return this.lead; }
  get score(): number { return Math.floor(this.drops); }
  get goldOn(): boolean { return this.gold; }
  /** the stations the way visits, in order */
  get route(): readonly StationId[] { return route(this.map, this.dir); }
  /** the station the light is at (or flows to, or comes down to) */
  get station(): StationId { return this.route[Math.min(this.idx, this.route.length - 1)]; }
  /** where the stream flows to (during `flow`) */
  get nextStation(): StationId | null { return this.idx + 1 < this.route.length ? this.route[this.idx + 1] : null; }
  /** the line at the current station: the player's own words, or its prayer (down) / thanks (up) */
  get line(): string { return lineAt(this.station, this.dir, this.own); }
  /** the stations of the map lit this round */
  get litCount(): number { return MAP[this.map].stations.reduce((n, s) => n + (this.lit[s] ? 1 : 0), 0); }
  /** the map's stations */
  get mapSize(): number { return MAP[this.map].stations.length; }
  /** the river's reach from the pool (0..1): the session's drops */
  get river(): number { return clamp(this.drops / this.riverFull); }
  /** the verse of the current station on this way */
  get verse(): PassageId { return verseOf(this.station, this.dir); }
  /** the narrator must wait: a telegraph, the runner's banner, a story card, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /**
   * The rest's breath guide (kit/breath.ts `breathAt`): the phase now, how far through it, the seconds left in it,
   * the lungs' fullness k, and which breath of the rest this is (`cycle` of `cycles`).
   */
  get breath(): BreathState & { cycle: number; cycles: number } {
    const b = breathAt(this.pattern, this.breathT);
    const cycles = Math.max(1, this.block.cycles || 1);
    return { ...b, cycle: Math.min(cycles, b.n + 1), cycles };
  }
  /** The pattern in words for the texts ("wdech 4 s, wydech 6 s"). */
  get breathText(): string { return breathWords(this.pattern); }

  /** What to do now, in one short line (it changes only when the action changes). */
  get now(): NowWhat {
    if (this.phase !== 'play') return 'end';
    const b = this.block;
    if (b.kind === 'warmup') return 'warm';
    if (b.kind === 'rest') return b.why === 'valve' ? 'valve' : 'rest';
    return b.blind ? 'dark' : 'focus';
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.open(this.firstEver ? 'warmup' : 'push');
    this.beginLeg(false);
    if (this.firstEver && markSeen(this.p, 's.open')) {
      markSeen(this.p, 's.news');
      this.story = { kind: 'open', page: 0, pages: 2, t: 0 };
      this.emit({ type: 'story', kind: 'open', page: 0 });
      this.talk.ask('open', 3, 60);
    } else if (!this.firstEver && markSeen(this.p, 's.news')) {
      // a player of an earlier version: what is new (every centre of both pictures, a rest after each, the breath)
      this.story = { kind: 'news', page: 0, pages: 1, t: 0 };
      this.emit({ type: 'story', kind: 'news', page: 0 });
      this.talk.ask(this.resumed ? 'resume' : this.dir, 2, 40);
    } else this.talk.ask(this.session === 1 ? 'open' : this.resumed ? 'resume' : this.dir, 2, 10);
    if (this.own) this.talk.ask('own', 1, 24);
  }

  /** One frame of play. */
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
    // end() moved the phase on (TypeScript narrowed it before the calls above)
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateStory(dt);
    if (!this.story) this.updateWay(dt);
    this.updateDrops(dt);
    this.updateAbide(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    this.talk.update(dt, now, this.talkBlocked);
  }

  private updateLight(dt: number, f: FocusFrame): void {
    // what is shown: the band's level in a sighted push, a steady glow in rest, the neutral base elsewhere
    const target = this.sighted && this.reliable ? clamp(f.level) : this.restBlock ? RULES.restLight : RULES.baseLight;
    this.light = approach(this.light, target, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    const gold = this.loading && this.stage === 'at';
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
    // a sighted push with a signal and no loading for a while: once a session, how the glass loads (never "harder")
    this.waitRun = this.sighted && this.reliable && !gold && this.stage === 'at' ? this.waitRun + dt : 0;
    if (this.waitRun >= RULES.waitSec && !this.waitSaid) {
      this.waitSaid = true;
      this.talk.ask('wait', 2, 6);
    }
    if (this.sighted && this.blockT >= this.lead + 0.5 && this.stage === 'at') this.coach('light', 'place');
    // no signal for a while in a push: the sensor, never the player
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 2, 6);
    }
  }

  /** The rest's breath: its phases turn (each with its own length; a phase of 0 s never shows). */
  private updateBreath(dt: number): void {
    if (!this.restBlock) return;
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

  /** The next page of a story card, or close it (a tap, or its reading time ran out). */
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
    if (s.kind === 'open' || s.kind === 'news') {
      if (s.kind === 'open') this.talk.ask(this.dir, 2, 8);
      this.coach('tap', 'place');
      // the station the light came to under the card is glossed now
      if (this.stage === 'at') this.gloss(this.station);
    }
    // a closing card (after a way) just closes: the way goes on when the rest's last breath ends
  }

  // ── the way ────────────────────────────────────────────────────
  /** A way begins: the light comes down from the open heaven (down) or up from the pool (up). */
  private beginLeg(say: boolean): void {
    this.stage = 'enter';
    this.stageT = 0;
    this.hidden = 0;
    this.reveal.t = -1;
    this.petals = 0;
    this.emit({ type: 'enter', dir: this.dir, station: this.station });
    if (say) this.talk.ask(this.dir, 2, 8);
  }

  private updateWay(dt: number): void {
    this.stageT += dt;
    const rate = this.rate();
    switch (this.stage) {
      case 'enter':
        this.preGrow(rate * dt);
        if (this.stageT >= RULES.heavenSec) this.arrive(this.idx);
        break;
      case 'at':
        this.updateReveal(dt);
        this.grow(rate * dt);
        if (this.fill >= 1 - 1e-9 && this.reveal.t < 0) this.complete();
        break;
      case 'hold':
        // the last station of a way: a moment in its light, then the whole figure (the rest abides in it); a push
        // that goes on past a station (the player's rhythm: a rest after 2 or more) flows on to the next one
        if (this.stageT >= RULES.holdSec && this.idx >= this.route.length - 1) this.wholeWay();
        else if (this.stageT >= RULES.holdSec && this.pushBlock) this.flowOn();
        break;
      case 'flow':
        this.preGrow(rate * dt);
        if (this.stageT >= RULES.flowSec) this.arrive(this.idx + 1);
        break;
      case 'whole':
        if (this.stageT >= RULES.wholeSec) {
          this.story = { kind: this.dir, page: 0, pages: 1, t: 0 };
          this.emit({ type: 'story', kind: this.dir, page: 0 });
          // stays 'whole' until the rest's last breath ends (then the next way)
          this.stageT = -Infinity;
        }
        break;
    }
  }

  /**
   * How fast the light loads now (per second): the founder's rule in a push past its lead-in with a reliable
   * signal (sighted or blind alike — a blind block gathers unseen), nothing anywhere else.
   */
  rate(): number {
    if (!this.pushBlock || this.blockT < this.lead || !this.reliable) return 0;
    return focusRate(this.level, this.focused, this.hold);
  }

  /** Focus while the light comes in or flows on (a push past its lead-in): the next station starts with it. */
  private preGrow(n: number): void {
    if (n <= 0) return;
    this.pre = Math.min(RULES.preMax, this.pre + n);
    this.stallT = 0;
  }

  /**
   * Light gathers at the station: shown at once, or unseen in a blind block.  Full, the push ends: a sighted one
   * at once (complete), a blind one with its hidden light shown (then complete).
   */
  private grow(n: number): void {
    if (n <= 0 || this.stage !== 'at' || !this.pushBlock) return;
    this.stallT = 0;
    if (this.blind) {
      this.hidden = Math.min(Math.max(0, 1 - this.fill), this.hidden + n);
      if (this.fill + this.hidden >= 1 - 1e-9) this.endPush('full');
      return;
    }
    this.fill = Math.min(1, this.fill + n);
    this.ticks();
    if (this.fill >= 0.3) this.coach('petals', 'place');
  }

  /** A piece of glass opened: the glass's tick (one event per piece, so the sound and the sparkle follow the light). */
  private ticks(): void {
    const n = tilesOpen(this.station, this.fill);
    while (this.petals < n) {
      this.petals++;
      this.emit({ type: 'petal', station: this.station, n: this.petals, of: tileTotal(this.station) });
    }
  }

  /** A blind block's light shown at its end: the glass opens quickly to where it got. */
  private updateReveal(dt: number): void {
    const r = this.reveal;
    if (r.t < 0) return;
    r.t += dt;
    const k = ease.outCubic(clamp(r.t / RULES.revealSec));
    this.fill = r.from + (r.to - r.from) * k;
    this.ticks();
    if (r.t >= RULES.revealSec) {
      this.fill = r.to;
      r.t = -1;
    }
  }

  /** The light arrives at the i-th station of the way. */
  private arrive(i: number): void {
    this.idx = Math.max(0, Math.min(this.route.length - 1, i));
    this.stage = 'at';
    this.stageT = 0;
    this.fill = Math.min(0.99, Math.max(this.startFill, this.pre));
    this.startFill = 0;
    this.pre = 0;
    this.hidden = 0;
    this.reveal.t = -1;
    this.petals = tilesOpen(this.station, this.fill);
    this.arrivals++;
    const s = this.station;
    this.emit({ type: 'arrive', station: s, dir: this.dir, idx: this.idx });
    // the first time ever at a station: its name from the maps glossed in plain words; then the narrator's own lines
    if (!this.gloss(s)) {
      if (this.dir === 'down') {
        if (this.round === 1 || this.rng() < 0.4) this.talk.ask(`at.${s}` as Moment, 1.5, 7);
      } else if (this.rng() < 0.3) this.talk.ask('rise', 1, 6);
    }
    if (this.pushBlock) this.tip = this.tipFor(this.block);
    this.coach('tap', 'place');
    // the second station of the first session: the whole map is there, in the column beside the figure
    if (this.arrivals >= 2) this.coach('strip', 'strip');
  }

  /**
   * The first time ever at a station (and no card over it): the narrator glosses its name from the maps in plain
   * words ("Pustka, ocean · Bhavsagar — krąg wokół środka ciała").  True when it asked for the line.
   */
  private gloss(s: StationId): boolean {
    if (this.story || this.p.seen.includes(`g.${s}`)) return false;
    markSeen(this.p, `g.${s}`);
    this.talk.ask(`at.${s}` as Moment, 1.6, 20, t('gloss', { label: stationLabel(s), where: stationWhere(s) }));
    return true;
  }

  /** The station is full: a moment in its light, the drops it brings, the tally — and the push ends: a rest of whole breaths. */
  private complete(): void {
    const s = this.station;
    this.fill = 1;
    this.stage = 'hold';
    this.stageT = 0;
    this.lit[s] |= this.dir === 'down' ? LIT_DOWN : LIT_UP;
    this.memory[s] = 1;
    if (this.dir === 'down') this.litDownNow[s]++;
    else this.litUpNow[s]++;
    this.placesNow++;
    this.lastLit = s;
    this.drops += RULES.dropPlace;
    this.emit({ type: 'full', station: s, dir: this.dir, drops: RULES.dropPlace });
    // its window's glass grows richer with the times it was lit (across sessions and in this one)
    const tier = windowTier(timesLit(this.p, s) + this.litDownNow[s] + this.litUpNow[s]);
    if (tier > this.tiers[s]) {
      this.tiers[s] = tier;
      this.tiersNow.push({ station: s, tier });
      this.emit({ type: 'tier', station: s, tier });
      this.talk.ask('tier', 2, 6);
    } else if (this.idx < this.route.length - 1 && this.rng() < 0.35) this.talk.ask('full', 1, 4);
    if (this.pushBlock) {
      this.litInPush++;
      this.stationT = 0;
      // the rest comes after the stations the rhythm asks for, at a way's end, after a blind push (its light shown)
      if (this.restDue(0)) this.endPush('full');
    }
  }

  /**
   * Does the push end in a rest once its current station is full (`ahead` 1: asked while it still loads)?  After
   * `restAfter` stations lit in it, at the last station of a way (the whole figure abides in the rest), and always
   * after a blind push (its hidden light is shown at its end).
   */
  private restDue(ahead: 0 | 1): boolean {
    return this.block.blind || this.litInPush + ahead >= this.restAfter || this.idx >= this.route.length - 1;
  }

  /** The stream flows on to the next station (the next push has begun: its lead-in covers the flow). */
  private flowOn(): void {
    const from = this.station, to = this.nextStation!;
    this.stage = 'flow';
    this.stageT = 0;
    this.emit({ type: 'flow', from, to, dir: this.dir });
  }

  /** The last station of the way: the whole figure in light, the drops of a whole way, then the closing card. */
  private wholeWay(): void {
    this.stage = 'whole';
    this.stageT = 0;
    this.drops += RULES.dropWay;
    if (this.dir === 'down') this.descentsNow++;
    else this.ascentsNow++;
    this.emit({ type: 'whole', dir: this.dir, drops: RULES.dropWay });
    this.talk.ask(this.dir === 'down' ? 'wayDown' : 'wayUp', 3, 8);
  }

  /** The rest's last breath ended and the next push begins: the light flows on (or the next way begins). */
  private goOn(): void {
    // a closing card still up closes with the rest
    if (this.story && (this.story.kind === 'down' || this.story.kind === 'up')) this.story = null;
    if (this.stage === 'hold') {
      if (this.idx >= this.route.length - 1) this.nextLeg();
      else this.flowOn();
    } else if (this.stage === 'whole') this.nextLeg();
    // still 'at' (the safety valve's rest): the push loads the same station on
  }

  /** After a way: the next way of the round (up after down), or a new round. */
  private nextLeg(): void {
    this.idx = 0;
    if (this.leg + 1 < this.legList.length) {
      this.leg++;
      this.dir = this.legList[this.leg];
      this.beginLeg(true);
      return;
    }
    this.leg = 0;
    this.round++;
    this.dir = this.legList[0];
    for (const s of STATIONS) this.lit[s] = 0;
    this.emit({ type: 'again', round: this.round });
    this.beginLeg(false);
    this.talk.ask('again', 2, 8);
  }

  /** Where the way goes on from now (for the next session): the station the light is at or flowing to, and its light. */
  private posNow(): RzekiPos {
    const len = this.route.length;
    const after = (): RzekiPos => {
      // the way just ended: the next way of the round, or a new round from the top
      const leg = this.leg + 1 < this.legList.length ? this.leg + 1 : 0;
      return { map: this.map, dir: this.legList[leg], idx: 0, fill: 0 };
    };
    switch (this.stage) {
      case 'enter': return { map: this.map, dir: this.dir, idx: this.idx, fill: Math.min(0.99, Math.max(this.startFill, this.pre)) };
      case 'at': {
        // a blind block cut short: what gathered unseen counts (what is gained is never lost)
        const fill = this.reveal.t >= 0 ? this.reveal.to : Math.min(1, this.fill + (this.blind ? this.hidden : 0));
        if (fill >= 0.99) return this.idx + 1 < len ? { map: this.map, dir: this.dir, idx: this.idx + 1, fill: 0 } : after();
        return { map: this.map, dir: this.dir, idx: this.idx, fill: Math.min(0.99, fill) };
      }
      case 'hold':
        return this.idx + 1 < len ? { map: this.map, dir: this.dir, idx: this.idx + 1, fill: 0 } : after();
      case 'flow':
        return this.idx + 1 < len ? { map: this.map, dir: this.dir, idx: this.idx + 1, fill: Math.min(0.99, this.pre) } : after();
      case 'whole': return after();
    }
  }

  // ── the drops and the abiding ──────────────────────────────────
  private updateDrops(dt: number): void {
    if (this.phase !== 'play') {
      this.drops += RULES.dropFree * dt;
      return;
    }
    const b = this.block;
    if (b.kind === 'rest') {
      if (!this.reliable) return;
      const n = RULES.dropRest * (RULES.restDropLo + this.calmShown) * (1 + (RULES.litK * this.litCount) / this.mapSize) * dt;
      this.drops += n;
      this.restAcc += n;
      this.restTick += dt;
      if (this.restTick >= RULES.restTick) {
        const shown = Math.round(this.restAcc);
        if (shown >= 1) this.emit({ type: 'drops', n: shown, at: 'rest' });
        this.restAcc -= shown;
        this.restTick = 0;
      }
    } else if (b.kind === 'push') {
      // a push's drops follow the light: they flow only while it loads (a blind block's are paid at its end)
      if (this.loading && this.stage === 'at') this.drops += RULES.dropPush * (0.5 + this.level) * dt;
    } else this.drops += RULES.dropFree * dt;
  }

  private updateAbide(dt: number): void {
    if (!this.restBlock) {
      this.abideRun = 0;
      this.abideGap = 0;
      return;
    }
    if (this.reliable && this.calmShown >= RULES.abideCalm) {
      this.abideRun += dt;
      this.abideNow += dt;
      this.abideGap = 0;
    } else {
      // a short dip is forgiven (the pulse of the blood pressure, a swallow)
      this.abideGap += dt;
      if (this.abideGap > 2) this.abideRun = 0;
    }
    this.longestNow = Math.max(this.longestNow, this.abideRun);
  }

  // ── the hands ──────────────────────────────────────────────────
  /**
   * A tap anywhere, a click, Space: on a story card, turn its page (after a moment); else stay with the station —
   * its prayer glows again, a ring of light, a glass tone (never light: the glass loads only from real focus).
   * Returns true when it did something.
   */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    this.reshow = RULES.reshowSec;
    this.tapsNow++;
    this.emit({ type: 'tap', station: this.stage === 'flow' ? (this.nextStation ?? this.station) : this.station, stage: this.stage });
    return true;
  }

  /** Keys during play: Space stays with the station (like a tap), Enter turns a story card. */
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
  /**
   * The blocks go by the light, not by a clock: the warm-up and a rest have their length (a rest: whole breaths),
   * a push lasts until its station is full (or the safety valve opens).  Each is announced 4 s ahead.
   */
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'chest');
    if (b.kind === 'rest' && this.blockT >= R.bannerSec + 9 && this.blockT - dt < R.bannerSec + 9) this.coach('drops', 'pool');
    const toFinale = this.plannedSec - this.finaleSec - now;
    if (toFinale <= 0) {
      this.endBlock('time');
      this.beginFinale();
      return;
    }
    if (b.kind === 'push') {
      this.stallT += dt;
      this.stationT += dt;
      // the safety valve: no light gained for a long while, or a long time at a station that is not nearly full
      const nearly = this.stage === 'at' && this.fill + (b.blind ? this.hidden : 0) >= R.telegraphFill;
      const valveIn = Math.min(R.valveStall - this.stallT, nearly ? Infinity : R.valveSec - this.stationT);
      // the rest comes soon: the station that ends the push nearly full (a sighted push: a blind one would tell its
      // hidden light)
      const soon = !b.blind && this.stage === 'at' && this.reveal.t < 0 && this.restDue(1)
        && (this.fill >= R.telegraphFill || tilesOpen(this.station, this.fill) >= tileTotal(this.station) - 1);
      this.telegraph(toFinale, soon ? 0 : valveIn, 'rest');
      if (valveIn <= 0) this.valve();
      return;
    }
    // the warm-up waits for the opening card: the first push never begins under it (it is read, or tapped away)
    if (b.kind === 'warmup' && this.story) b.dur = Math.max(b.dur, this.blockT + RULES.telegraph + 2);
    this.telegraph(toFinale, b.dur - this.blockT, 'push');
    if (this.blockT >= b.dur) {
      this.endBlock(null);
      this.open('push');
      if (b.kind === 'rest') this.goOn();
    }
  }

  /** Announce what comes next, once a block, 4 s ahead: the next block, or the session's quiet end. */
  private telegraph(toFinale: number, toEnd: number, next: BlockKind): void {
    if (this.telegraphed || Math.min(toFinale, toEnd) > RULES.telegraph) return;
    this.telegraphed = true;
    this.nextKind = toFinale <= toEnd ? null : next;
    this.emit({ type: 'telegraph', next: this.nextKind });
  }

  /** A push that cannot finish: a rest of whole breaths; the station keeps its light, the next push loads it on. */
  private valve(): void {
    const s = this.station;
    this.endPush('valve');
    this.valvesNow++;
    this.emit({ type: 'valve', station: s });
  }

  /** The push ends (its station full, or the valve): it is judged, and a rest of whole breaths begins. */
  private endPush(why: 'full' | 'valve'): void {
    if (!this.pushBlock) return;
    this.endBlock(why);
    this.open('rest', why);
  }

  /** Open the next block. */
  private open(kind: BlockKind, why: BlockWhy | null = null): void {
    const rest = kind === 'rest' ? this.restLen : null;
    const b: Block = {
      kind, dur: kind === 'warmup' ? warmFor(this.plannedSec) : rest ? rest.sec : Infinity, blind: false, cycles: rest?.cycles ?? 0, why, len: 0,
    };
    const first = !this.plan.some(x => x.kind === kind);
    this.plan.push(b);
    this.blockIndex = this.plan.length - 1;
    this.blockT = 0;
    this.telegraphed = false;
    this.nextKind = null;
    this.stallT = 0;
    this.litInPush = 0;
    this.stationT = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.goldRun = 0;
    this.waitRun = 0;
    if (kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      if (b.blind) {
        this.talk.ask('blind', 3, 12);
        this.coach('blind', 'place');
      }
    } else if (kind === 'rest') {
      this.restsNow++;
      this.breathT = 0;
      this.talk.ask(why === 'valve' ? 'valve' : 'rest', why === 'valve' ? 3 : 2, 12);
    } else this.talk.ask('warm', 1, 14);
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: this.blockIndex });
    if (kind === 'rest') {
      // the guide's first phase begins with the block
      const first0 = breathAt(this.pattern, 0).phase;
      this.emit({ type: 'breathTurn', phase: first0, len: this.pattern[first0] });
    }
  }

  /** The block's strategy: the station's own picture in a push (the repetition every third), the breath in rest. */
  private tipFor(b: Block): string {
    if (b.kind === 'warmup') return t(TIPS.warmup);
    if (b.kind === 'push') {
      if (b.blind) return t(TIPS.blind[(this.session + this.blockIndex) % TIPS.blind.length]);
      return t(pushTip(this.station, this.dir, this.pushesBegun - 1));
    }
    return t(TIPS.rest[(this.session - 1 + this.restsNow) % TIPS.rest.length], { breath: this.breathText });
  }

  /**
   * The block's end: its verdict over its last ≤ 15 s and what it pays — after its judged window, never during it.
   * A push under RULES.minPush s (a station resumed nearly full) is not judged; a blind one shows its light now.
   */
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
      if (b.kind === 'push' && b.blind) {
        const s = !short && this.judge.measured > 0 ? share : 0;
        const n = Math.round(RULES.dropBlind * s);
        this.drops += n;
        if (!short) this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        // the light gathered in the dark is shown now
        const gained = this.hidden;
        if (gained > 0 && this.stage === 'at') this.reveal = { from: this.fill, to: Math.min(1, this.fill + gained), t: 0 };
        this.hidden = 0;
        this.emit({ type: 'blindEnd', share: s, drops: n, gained });
        this.talk.ask('blindEnd', 2, 6);
      } else if (verdict === true) {
        this.drops += RULES.dropBlock;
        this.emit({ type: 'drops', n: RULES.dropBlock, at: 'block' });
      }
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

  /** The session's counters reach the progress once (at the end, or early with finish()), and where the way goes on. */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    p.descents += this.descentsNow;
    p.ascents += this.ascentsNow;
    for (const s of STATIONS) {
      countStation(p, s, 'down', this.litDownNow[s]);
      countStation(p, s, 'up', this.litUpNow[s]);
    }
    p.drops += this.score;
    p.abideBest = Math.max(p.abideBest, Math.round(this.longestNow * 10) / 10);
    p.abideAll += Math.round(this.abideNow);
    p.lastLen = this.plannedSec;
    if (this.started) {
      this.nextPos = this.posNow();
      p.pos = this.nextPos;
    }
  }

  /** Ended early ("Zakończ i zapisz", the overtime limit): settle at once. */
  finish(): void {
    this.end();
  }

  // ── coach marks ────────────────────────────────────────────────
  private coach(what: Coach, at: CoachAt): void {
    if (this.story) return;
    if (!markSeen(this.p, `c.${what}`)) return;
    this.emit({ type: 'coach', what, at });
  }

  /** A coach mark's words (some name the player's breath and the map). */
  coachWords(what: Coach, touch: boolean): string {
    if (what === 'tap') return t(touch ? 'coach.tap' : 'coach.tap.keys');
    if (what === 'breath') return t('coach.breath', { breaths: t('breaths', { n: this.restLen.cycles }), breath: this.breathText });
    if (what === 'strip') return t('coach.strip', { n: this.mapSize });
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

  /** The panel's gauge: the band's real level in a sighted push, calm in rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.level);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the light in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.light);
    return null;
  }

  /** The chorale's level: the focus in a sighted push, a gentle fixed level in rest and around, nothing in a blind block. */
  songLevel(f: FocusFrame): number | null {
    if (!this.started) return null;
    if (this.phase !== 'play') return 0.4;
    if (this.blind) return null;
    if (this.restBlock) return 0.34;
    if (this.sighted) return f.reliable ? clamp(f.level) : null;
    return 0.4;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The station where the next session goes on (after settle; before it, where it would go on now). */
  get nextStart(): StationId {
    const pos = this.nextPos ?? this.posNow();
    return route(pos.map, pos.dir)[pos.idx] ?? this.station;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress once, in settle(). */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    // short values: the summary sets each in a tile with a large serif number
    const stats: [string, string][] = [
      [t('stat.places'), String(this.placesNow)],
      [t('stat.down'), String(this.descentsNow)],
      [t('stat.up'), String(this.ascentsNow)],
      [t('stat.abide'), secText(this.abideNow)],
      [t('stat.longest'), secText(this.longestNow)],
      [t('stat.gold'), secText(this.goldSec)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session (DESIGN §13.14): an
   * ascent (Psalm 141:2, prayer rising like incense), a descent (Luke 11:13, the Father gives the Holy Spirit to
   * those who ask), the first session (the root, John 7:38-39), calm abiding (Philippians 4:7, the peace that
   * guards); else Acts 2:17, Isaiah 11:2 and the root.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.ascentsNow > 0) fit.push('psa141.2');
    if (this.descentsNow > 0) fit.push('luk11.13');
    if (this.session === 1) fit.push('jhn7.38-39');
    if (this.passedRests > 0 || this.longestNow >= 15) fit.push('php4.7');
    fit.push('act2.17', 'isa11.2', 'jhn7.38-39');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.descentsNow > 0) add(0, t('hl.down', { n: this.mapSize }));
    if (this.ascentsNow > 0) add(0.5, t('hl.up'));
    if (!this.descentsNow && !this.ascentsNow) {
      if (this.lastLit) add(0, t('hl.part', { place: stationName(this.lastLit) }));
      else if (this.started) add(0, t('hl.calm'));
    }
    if (this.started) add(0.8, t('hl.next', { from: fromText(this.nextStart) }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { drops: dropsText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(60, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { drops: dropsText(this.bestBefore - this.score) }));
    }
    const ways = this.descentsNow + this.ascentsNow;
    if (ways > 2) add(2, t('hl.again', { n: ways }));
    const tn = this.tiersNow.at(-1);
    if (tn) add(2.5, t('hl.tier', { place: stationName(tn.station), tier: tierName(tn.tier) }));
    if (this.longestNow >= 10) add(3, t('hl.longest', { sec: secText(this.longestNow) }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    if (this.restsNow > 0) add(4.5, t('hl.rests', { n: this.restsNow, breath: this.breathText }));
    if (this.own) add(5, t('hl.own'));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

/** The breath's cycle (s) of a pattern (re-exported for the view and the tests). */
export { breathCycle };
