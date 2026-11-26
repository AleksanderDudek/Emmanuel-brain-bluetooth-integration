/**
 * Ja jestem…'s session, without the DOM (DESIGN §13.8).  A vision — a picture cut into a mosaic (vision.ts):
 * a declaration's arched window, or an own photo in its own shape — is coloured cell by cell and lit:
 *
 *   warm-up (first session)  a quick flow while focused; taps choose where
 *   push (Barwa)             while focused (past the band's lead-in, a reliable signal) colour pours into the
 *                            chosen cell, wider above the threshold; a full cell LIGHTS; the push ends when its
 *                            3rd, 4th or 5th cell lights (round 11: "rest after 3–5 completed tiles"; round 15:
 *                            the player's mean ± 1, set in the lobby), or at its cap; a whole fragment lit
 *                            becomes one pane; every cell lit → the light pass
 *   blind push (Noc)         what focus pours is kept unseen; the night ends when it holds the push's cells,
 *                            and they light at dawn
 *   rest (Blask)             whole breaths (kit/breath: 4 in, 6 out; 2 → 20 s, or the player's 1–6); calm makes
 *                            the lit glass glow
 *   each block's verdict     a passed push leaves a RAY in the aura, a passed rest a RING
 *   the finale               the light fills what is still unlit (grace), the leading dissolves, the
 *                            declaration is written out with its verse (the view)
 *
 * Progress comes only from real focus (the founder, round 11): without focus nothing flows; what was gained
 * stays; a bad signal never takes anything away.  Touch chooses where (and a drop joins flowing colour).
 * Events go out through `take()`; the view, the sound and the coach marks read them.
 */
import { BREATH_DEFAULT, breathAt, breathCycle, breathRest, breathRestOf, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { ArcadeOutcome } from '../kit/types';
import { fmtNum } from '../../i18n';
import {
  BLIND_TIPS, DECLS, LIGHT_TIPS, LINES, LINES_OWN, OWN_VERSE, PUSH_TIPS, REST_TIPS, contOf, ownSentence, sentence,
  type DeclId, type Form, type Moment,
} from './content';
import { t, piecesText, unit, type Key } from './i18n';
import { keyDecl, nextPace, planCells, receive, received, type JestemProgress, type VisionKey } from './meta';
import { RULES } from './rules';
import { Talk } from './talk';
import { autoNext, cellUnder, pickAt, type VisionGeo } from './vision';
import type { PassageId } from '../kit/scripture';

export type BlockKind = 'warmup' | 'push' | 'rest';
/**
 * A block: its kind and length — a push's `dur` is its cap (it ends when its `cells` light), a rest's is whole
 * breaths — whether it is blind, and (a push) how many cells end it.
 */
export interface Block { kind: BlockKind; dur: number; blind: boolean; cells: number }

/** The vision the session colours: its key, its geometry, and the words it declares (a declaration's word; an own continuation). */
export interface SimVision { key: VisionKey; geo: VisionGeo; decl: DeclId | null; word: string }

export type Coach = 'tap' | 'lit' | 'oculus' | 'push' | 'rest' | 'drag' | 'pane' | 'night' | 'light';
export type CoachAt = { kind: 'cell'; id: number } | { kind: 'oculus' } | null;
export type LitBy = 'player' | 'dawn' | 'grace';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'target'; cell: number; by: 'auto' | 'tap' | 'path' }
  | { type: 'splash'; cell: number }
  | { type: 'lit'; cell: number; by: LitBy; n: number }
  | { type: 'fragment'; frag: number }
  | { type: 'complete' }
  | { type: 'ray'; n: number }
  | { type: 'ring'; n: number }
  | { type: 'night' }
  | { type: 'dawn'; cells: number[]; share: number }
  | { type: 'touchLight'; cell: number }
  | { type: 'mark'; cell: number }
  | { type: 'path'; cells: number[] }
  | { type: 'finale' }
  | { type: 'storyEnd' }
  | { type: 'form'; form: Form }
  | { type: 'coach'; what: Coach; at: CoachAt; k?: number };

export interface SimInit {
  progress: JestemProgress;
  rng: () => number;
  day: string;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the page's language needs the speaker's form (Polish) */
  askForm: boolean;
  /** the window's cells, forced (tests, and `?debug&jestemCells=144` for the frame-time audit); else from the pace */
  cells?: number;
  /** the rest's rhythm the player set (kit/rhythm): the mean cells before a rest, the rest's whole breaths; absent: the rules' */
  rhythm?: { focus: number; rest: number } | null;
}

/** The opening card of the first session (and the form question in Polish). */
export interface Story { t: number; dur: number; ask: boolean }

/** The "what to do now" line (round 11's clarity rule): its words and its icon; it changes only when the action does. */
export type NowIcon = 'tap' | 'focus' | 'night' | 'light' | 'breath' | 'nosignal';
export interface Now { key: Key; icon: NowIcon }

const NO_EVENTS: readonly SimEvent[] = [];
const BREATH = BREATH_DEFAULT;

// ── pure rules ───────────────────────────────────────────────────
/** The finale's length: 20 s in sessions of 3 min and more, 14 s from 2 min, 8 s in shorter ones. */
export const finaleFor = (plannedSec: number): number =>
  (plannedSec >= 180 ? RULES.finale.long : plannedSec >= 120 ? RULES.finale.mid : RULES.finale.short);

/** The first-ever session's warm-up: 30 s in sessions from 5 min, 20 s in shorter ones, 6 s in a ≤ 60 s test. */
export const warmFor = (plannedSec: number): number =>
  (plannedSec <= 60 ? RULES.warm.test : plannedSec >= 300 ? RULES.warm.long : RULES.warm.short);

/** The seconds of push and rest a session holds (its length less the warm-up and the finale). */
export const playSecOf = (plannedSec: number, firstEver: boolean): number =>
  Math.max(0, plannedSec - finaleFor(plannedSec) - (firstEver ? warmFor(plannedSec) : 0));

/** A rest of `breaths` whole breaths of 4 in, 6 out (kit/breath): 2 by design → 20 s. */
export const restSec = (breaths: number = RULES.restBreaths): number => breathRestOf(BREATH, breaths).sec;

/** The player's mean cells before a rest (the lobby's dial, kit/rhythm), kept whole and inside the dial's range. */
export const pieceMean = (m?: number | null): number =>
  Math.round(clamp(typeof m === 'number' && Number.isFinite(m) ? m : RULES.pushCells, RULES.pushCellsDial.min, RULES.pushCellsDial.max));

/** The cells a push may ask around the mean `m`: m ± 1, never under the dial's least (2 → 2…3, 4 → 3…5, 8 → 7…9). */
export function pushBand(m: number = RULES.pushCells): [number, number] {
  const mm = pieceMean(m);
  return [Math.max(RULES.pushCellsDial.min, mm - RULES.pushCellsVar), mm + RULES.pushCellsVar];
}

/** A push's seconds `x` designed at the mean of 4, for the mean `m`: the part past the band's lead-in grows with the cells. */
export const pushSecAt = (x: number, m: number = RULES.pushCells): number =>
  RULES.pushLead + ((x - RULES.pushLead) * pieceMean(m)) / RULES.pushCells;

/**
 * The cells the next push asks after one that took `sec` (cut at its cap: `capped`): quicker → one more, slow → one
 * fewer, inside the band around the player's mean `m` (the quick and slow marks scale with it).
 */
export function nextPushCells(k: number, sec: number, capped: boolean, m: number = RULES.pushCells): number {
  let n = k;
  if (capped || sec > pushSecAt(RULES.pushSlow, m)) n = k - 1;
  else if (sec < pushSecAt(RULES.pushQuick, m)) n = k + 1;
  const [lo, hi] = pushBand(m);
  return Math.round(clamp(n, lo, hi));
}

/** The flow while focused in a sighted push past its lead-in (units per second): wider above the threshold. */
export function pourRate(level: number): number {
  const R = RULES;
  const x = clamp((level - R.levelLo) / R.levelSpan);
  return R.baseRate + R.spanRate * x ** R.shapePow;
}

// ── the session ──────────────────────────────────────────────────
export class JestemSim {
  readonly p: JestemProgress;
  /** the blocks so far (each appended when it begins; a push's `dur` is set to its real length when it ends) */
  readonly plan: Block[] = [];
  readonly session: number;
  readonly plannedSec: number;
  /** the finale's length: nominal until it begins, then what the session has left */
  finaleSec: number;
  /** the cells the window is cut into (the player's pace × the session's minutes of push and rest, 48…144) */
  readonly cellsWanted: number;
  readonly lead: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;
  private readonly askForm: boolean;
  private readonly day: string;
  /** when the finale is planned to begin (s of the session) */
  private readonly finaleAt: number;
  /** the shortest push worth starting before the finale (s) */
  private readonly pushRoom: number;
  /** the sighted pushes before the current one (the strategies' turn) */
  private tipK = 0;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  private teleAt = -1;
  tip = '';
  story: Story | null = null;
  /** what comes after the current block (decided when it begins; null: the finale) */
  nextBlock: Block | null = null;

  vision: SimVision | null = null;
  ink: number[] = [];
  lit: boolean[] = [];
  litAt: number[] = [];
  litBy: (LitBy | null)[] = [];
  glow: number[] = [];
  fragDone: boolean[] = [];
  /** the cell being coloured (-1: none yet) and the path the player laid */
  target = -1;
  targetBy: 'auto' | 'tap' | 'path' = 'auto';
  path: number[] = [];
  /** a cell chosen during a rest, for the next push */
  marked = -1;
  curFrag = -1;
  complete = false;
  completeAt = -1;
  /** cells lit by the player (the headline) and by the finale's grace */
  litPlayer = 0;
  graced = 0;
  /** cells the current push has lit (it ends at its `cells`) */
  pushLit = 0;
  /** the player's mean cells before a rest and the rest's whole breaths (the lobby's rhythm, or the rules') */
  readonly pieces: number;
  readonly restBreaths: number;
  /** the cells the next push will ask (the first: the band's lowest) */
  private nextCells: number;
  /** the finale's clock, and when each still-unlit cell turns to light */
  finaleT = 0;
  graceAt: number[] = [];

  /** the stream's width (the gauge): the smoothed level in a sighted push; the shown calm in a rest */
  flow = 0;
  calmShown = 0;
  reliable = false;
  focused = false;
  /** seconds without a reliable signal (the "what to do now" line says so after a few) */
  private unrelT = 0;
  /** the flow this frame (units/s; 0 without focus) and what a blind push keeps for dawn */
  rate = 0;
  hidden = 0;
  rays = 0;
  rings = 0;
  passedPush = 0;
  passedRest = 0;
  pushesBegun = 0;
  private pushesSighted = 0;
  private restsBegun = 0;
  private relSec = 0;
  private splashCool = 0;
  private touchCool = 0;
  private goodT = 0;
  private goodSaid = false;
  private waitT = 0;
  private waitSaid = false;
  private litTalkAt = -99;
  private halfSaid = false;
  private lastSaid = false;
  private paneSeen = false;
  /** seconds of push and rest this session */
  playT = 0;
  /** the seconds of push and rest when the player lit the window's last cell (−1: not yet) — the pace's yardstick */
  playDone = -1;
  /** the first-ever session's warm-up seconds played (its cells count for the pace, so its time does too) */
  warmT = 0;
  /** the best share of a night's window in focus (%), −1 without a night */
  nightShare = -1;
  private settled = false;
  private newDecl = false;
  private times = 0;
  private readonly events: SimEvent[] = [];

  constructor(init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.finaleSec = finaleFor(init.plannedSec);
    this.finaleAt = init.plannedSec - this.finaleSec;
    this.pushRoom = init.plannedSec <= 60 ? RULES.pushRoomTest : RULES.pushRoom;
    this.session = this.p.sessions + 1;
    this.pushesBase = this.p.pushes;
    this.bestBefore = this.p.sessions > 0 ? this.p.best : null;
    this.askForm = init.askForm;
    this.day = init.day;
    this.lead = init.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.judge = RoundJudge.from(init.tuning);
    this.cellsWanted = init.cells && init.cells >= RULES.cellsMin && init.cells <= RULES.cellsLongMax
      ? Math.round(init.cells) : planCells(this.p.pace, playSecOf(init.plannedSec, this.session === 1));
    this.talk = new Talk(LINES, init.rng);
    this.pieces = pieceMean(init.rhythm?.focus);
    const rb = init.rhythm?.rest;
    this.restBreaths = Math.round(clamp(typeof rb === 'number' && Number.isFinite(rb) ? rb : RULES.restBreaths, RULES.restBreathsDial.min, RULES.restBreathsDial.max));
    this.nextCells = pushBand(this.pieces)[0];
  }

  // ── state ───────────────────────────────────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)] ?? { kind: 'push', dur: 0, blind: false, cells: 0 }; }
  get next(): Block | null { return this.nextBlock; }
  get playing(): boolean { return this.started && this.phase === 'play'; }
  get pushBlock(): boolean { return this.playing && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.playing && this.block.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the stream answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** colour may flow now (the warm-up or a push, the card closed, the vision ready, not yet whole) */
  get pouring(): boolean {
    return this.playing && !this.story && !!this.vision && !this.complete && (this.block.kind === 'push' || this.block.kind === 'warmup');
  }
  /** colour flows this very frame (focus, a signal, past the lead-in): the stream, the trickle, a tap's drop */
  get flowing(): boolean { return this.pouring && this.rate > 0 && !this.blind; }
  /** the light pass: every cell lit, a push pours light */
  get lighting(): boolean { return this.playing && !this.story && this.complete && this.block.kind === 'push'; }
  get cells(): number { return this.vision?.geo.cells.length ?? 0; }
  /**
   * The seconds the pace is measured over (round 20): the warm-up's (its cells count too) and push and rest up to the
   * last cell the player lit — not the light pass after it — else all of them.
   */
  get paceSec(): number { return this.warmT + (this.playDone > 0 ? this.playDone : this.playT); }
  get score(): number { return this.litPlayer; }
  get word(): string { return this.vision?.word ?? ''; }
  /** the vision is the player's own photo (its words a continuation after "ja") */
  get own(): boolean { return !!this.vision && !this.vision.decl; }
  get verse(): PassageId { return this.vision?.decl ? DECLS[this.vision.decl].verse : OWN_VERSE; }
  /** the whole affirmation: "Przez potężne imię Jezusa ja jestem silny." / "…ja mam pokój." */
  get affirmation(): string {
    const v = this.vision;
    if (!v) return '';
    return v.decl ? sentence(v.word) : ownSentence(v.word);
  }
  /** the mean glow of the lit glass (0..1) */
  get glowMean(): number {
    let s = 0, n = 0;
    for (let i = 0; i < this.glow.length; i++) if (this.lit[i]) { s += this.glow[i]; n++; }
    return n ? s / n : 0;
  }
  get fragsDone(): number { return this.fragDone.filter(Boolean).length; }
  get talkBlocked(): boolean {
    const b = this.block;
    const banner = this.playing && this.blockT < RULES.bannerSec && b.kind !== 'warmup';
    return !!((this.playing && this.telegraphed) || banner || this.story || (this.phase === 'finale' && this.finaleT > 2.2) || this.phase === 'done');
  }
  /** the rest's breath (kit/breath, from the rest's start), or the session's gentle one elsewhere */
  get breath(): BreathState { return breathAt(BREATH, this.restBlock ? this.blockT : this.t); }
  /** a rest's whole breaths */
  get breaths(): number { return this.restBlock ? Math.max(1, Math.round(this.block.dur / breathCycle(BREATH))) : 0; }

  /** What to do now, in a few words (null: a card, the finale). */
  get now(): Now | null {
    if (!this.playing || this.story || !this.vision) return null;
    const b = this.block;
    if (b.kind === 'warmup') return { key: 'now.warm', icon: 'tap' };
    if (b.kind === 'rest') {
      const ph = this.breath.phase;
      return { key: ph === 'in' ? 'now.in' : ph === 'out' ? 'now.out' : 'now.hold', icon: 'breath' };
    }
    if (b.blind) return { key: 'now.night', icon: 'night' };
    if (this.complete) return { key: 'now.light', icon: 'light' };
    if (this.unrelT > 3) return { key: 'now.nosignal', icon: 'nosignal' };
    if (b.cells > 1 && this.pushLit === b.cells - 1) return { key: 'now.last', icon: 'focus' };
    return { key: 'now.push', icon: 'focus' };
  }

  // ── the session's course ────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(this.session === 1 ? 'warmup' : 'push');
    if (this.session === 1) {
      const ask = this.askForm && this.p.form === null;
      this.story = { t: 0, dur: ask ? RULES.storyAsk : RULES.storySec, ask };
    }
  }

  /** The prepared vision arrives (before play, or a moment into it). */
  setVision(v: SimVision): void {
    if (this.vision) return;
    this.vision = v;
    if (!v.decl) this.talk.setLines(LINES_OWN);
    const n = v.geo.cells.length;
    this.ink = new Array<number>(n).fill(0);
    this.lit = new Array<boolean>(n).fill(false);
    this.litAt = new Array<number>(n).fill(-1);
    this.litBy = new Array<LitBy | null>(n).fill(null);
    this.glow = new Array<number>(n).fill(0);
    this.fragDone = new Array<boolean>(v.geo.frags.length).fill(false);
    this.graceAt = new Array<number>(n).fill(-1);
    // the first-ever session: point at the heart's cell when the card is gone
    this.coachOnce('tap', { kind: 'cell', id: autoNext(v.geo, this.lit, this.ink, -1) });
    // the block's words may name the picture: a block that began before the vision was ready gets them now
    this.tip = this.tipFor(this.block, this.blockIndex, this.tipK);
  }

  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0) || this.phase === 'done') return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.splashCool = Math.max(0, this.splashCool - dt);
    this.touchCool = Math.max(0, this.touchCool - dt);
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    }
    this.brain(dt, f);
    if (this.phase === 'play') {
      this.pour(dt);
      this.restGlow(dt, f);
      this.schedule(dt, f, t);
    } else if (this.phase === 'finale') {
      this.finale(dt);
    }
    this.talk.update(dt, t, this.talkBlocked);
  }

  /** The band's slow quantities: the stream's width in a sighted push, the calm in a rest; the flow itself. */
  private brain(dt: number, f: FocusFrame): void {
    this.reliable = f.reliable && f.activity !== null;
    this.focused = this.reliable && f.focused;
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    const live = this.sighted && this.reliable;
    this.flow = approach(this.flow, live ? clamp(f.level) : 0, dt, RULES.meterTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, RULES.meterTau);
    if (this.playing && this.reliable) this.relSec += dt;
    // the flow: only while focused (the round's rule) — the warm-up's quick one, or past a push's lead-in the
    // stream that widens above the threshold; a night keeps it unseen for dawn
    const b = this.block;
    let rate = 0;
    if (this.pouring && this.focused) {
      if (b.kind === 'warmup') rate = RULES.warmRate;
      else if (this.blockT >= this.lead) rate = pourRate(clamp(f.level));
    }
    this.rate = rate;
    if (rate > 0 && b.kind === 'push' && b.blind) this.hidden += rate * dt;
    if (live && this.focused && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.say(this.complete ? 'light' : 'good', 2, 6);
    }
    // a signal but no focus for a while in a sighted push: once a push, how the colour flows (never "harder")
    this.waitT = live && !this.focused && !this.complete ? this.waitT + dt : 0;
    if (this.waitT >= 10 && !this.waitSaid) {
      this.waitSaid = true;
      this.say('wait', 2, 8);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coachOnce('oculus', { kind: 'oculus' });
  }

  /** The colour flows into the target cell (a night keeps it); a full cell lights. */
  private pour(dt: number): void {
    if (!this.pouring || this.rate <= 0 || this.block.blind) return;
    this.fill(this.rate * dt, 'player');
  }

  /** Pour `units` of colour along the way (the target, the path, the colour's own way); returns the cells lit. */
  private fill(units: number, by: LitBy): number[] {
    const out: number[] = [];
    let guard = 0;
    while (units > 1e-9 && !this.complete && guard++ < 200) {
      const c = this.ensureTarget();
      if (c < 0) break;
      const cap = this.vision!.geo.cells[c].cap;
      const take = Math.min(units, cap - this.ink[c]);
      this.ink[c] += take;
      units -= take;
      if (this.ink[c] >= cap - 1e-9) {
        this.light(c, by);
        out.push(c);
      }
    }
    return out;
  }

  /**
   * The cell the colour goes to: one the player chose during a rest first, then the current one, the next
   * of the path, else the colour's own way.
   */
  private ensureTarget(): number {
    const v = this.vision;
    if (!v) return -1;
    if (this.marked >= 0) {
      const c = this.marked;
      this.marked = -1;
      if (!this.lit[c]) {
        this.path = [];
        return this.setTarget(c, 'tap');
      }
    }
    if (this.target >= 0 && !this.lit[this.target]) return this.target;
    while (this.path.length) {
      const c = this.path.shift()!;
      if (!this.lit[c]) return this.setTarget(c, 'path');
    }
    const c = autoNext(v.geo, this.lit, this.ink, this.curFrag);
    return c < 0 ? -1 : this.setTarget(c, 'auto');
  }

  private setTarget(c: number, by: 'auto' | 'tap' | 'path'): number {
    if (c === this.target && by === this.targetBy) return c;
    this.target = c;
    this.targetBy = by;
    if (this.vision) this.curFrag = this.vision.geo.cells[c].frag;
    this.emit({ type: 'target', cell: c, by });
    return c;
  }

  /**
   * The units the night must hold for its cells, along the way the colour would go (the target, the path, then its
   * own way), and the units of its last cell — no side effects.
   */
  nightNeed(k: number): { all: number; last: number } {
    const v = this.vision;
    if (!v || k <= 0) return { all: 0, last: 0 };
    const lit = this.lit.slice();
    const ink = this.ink;
    const queue = [...(this.marked >= 0 ? [this.marked] : []), ...(this.target >= 0 ? [this.target] : []), ...this.path];
    let cur = this.curFrag, all = 0, last = 0;
    for (let i = 0; i < k; i++) {
      let c = -1;
      while (queue.length && c < 0) { const q = queue.shift()!; if (!lit[q]) c = q; }
      if (c < 0) c = autoNext(v.geo, lit, ink, cur);
      if (c < 0) break;
      last = v.geo.cells[c].cap - ink[c];
      all += last;
      lit[c] = true;
      cur = v.geo.cells[c].frag;
    }
    return { all, last };
  }

  /** A cell lights: its glass glows, its leading turns gold; a whole fragment, half the picture, the whole. */
  private light(c: number, by: LitBy): void {
    const v = this.vision!;
    this.lit[c] = true;
    this.litAt[c] = this.t;
    this.litBy[c] = by;
    this.ink[c] = v.geo.cells[c].cap;
    this.glow[c] = Math.max(this.glow[c], RULES.glowFresh);
    if (this.target === c) this.target = -1;
    if (by !== 'grace') this.litPlayer++;
    else this.graced++;
    if (by !== 'grace' && this.phase === 'play' && this.block.kind === 'push') this.pushLit++;
    this.emit({ type: 'lit', cell: c, by, n: this.litPlayer });
    if (by === 'grace') return;
    const n = this.cells, done = this.litPlayer;
    if (done === 1) {
      this.say('first', 3, 6);
      this.coachOnce('lit', { kind: 'cell', id: c });
    } else if (!this.halfSaid && done >= n / 2) {
      this.halfSaid = true;
      this.say('half', 2, 6);
    } else if (!this.lastSaid && n - done <= Math.max(2, Math.round(n * 0.12)) && n - done > 0) {
      this.lastSaid = true;
      this.say('last', 2, 6);
    } else if (this.t - this.litTalkAt >= RULES.litTalkEvery && by === 'player') {
      this.litTalkAt = this.t;
      this.say('lit', 1, 3);
    }
    if (!this.paneSeen && v.geo.cells[c].nb.some(x => this.lit[x])) {
      this.paneSeen = true;
      this.coachOnce('pane', { kind: 'cell', id: c });
    }
    const fi = v.geo.cells[c].frag;
    if (!this.fragDone[fi] && v.geo.frags[fi].cells.every(id => this.lit[id])) {
      this.fragDone[fi] = true;
      this.emit({ type: 'fragment', frag: fi });
      if (done > 1 && done < n) this.say('fragment', 2, 6);
    }
    if (done >= n && !this.complete) {
      this.complete = true;
      this.completeAt = this.t;
      if (this.phase === 'play') this.playDone = this.playT;
      this.path = [];
      this.emit({ type: 'complete' });
      if (this.phase === 'play') {
        this.say('complete', 3, 8);
        this.coachOnce('light', null);
      }
    }
  }

  /** A rest: calm makes the lit glass glow (a little even without a signal); the light pass does it in a push. */
  private restGlow(dt: number, f: FocusFrame): void {
    if (!this.vision || this.story) return;
    let k = 0;
    if (this.restBlock) {
      k = (RULES.glowBase + RULES.glowCalm * (this.reliable ? clamp(f.calm) : 0)) / RULES.glowSec;
    } else if (this.lighting) {
      const lv = this.sighted && this.focused ? clamp(f.level) : 0;
      k = (RULES.lightBase * (this.focused ? 1 : 0) + (1 - RULES.lightBase) * lv) / RULES.lightSec;
    }
    if (k <= 0) return;
    for (let i = 0; i < this.glow.length; i++) if (this.lit[i]) this.glow[i] = Math.min(1, this.glow[i] + k * dt);
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    if (this.story) return;   // the opening card holds the first block's clock (it is the warm-up's)
    this.blockT += dt;
    if (b.kind === 'warmup') this.warmT += dt;
    else {
      this.playT += dt;
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec && this.vision) {
      const best = this.lit.findIndex(Boolean);
      this.coachOnce('rest', best >= 0 ? { kind: 'cell', id: best } : null);
    }
    if (b.kind === 'push' && !b.blind && !this.complete && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec && this.vision) {
      this.coachOnce('push', this.target >= 0 ? { kind: 'cell', id: this.target } : null, b.cells);
    }
    // a push ends with its cells: the sighted one when its last cell lights, the night when it holds them
    let done = false, tele = false;
    if (b.kind === 'push' && this.vision) {
      if (this.complete) {
        // the whole vision lit in this push: the rest comes now (a light pass — a push begun whole — is timed)
        done = this.pushLit > 0;
      } else if (b.blind) {
        const need = this.nightNeed(b.cells);
        done = need.all > 0 && this.hidden >= need.all - 1e-9;
        tele = need.all > 0 && this.hidden >= need.all - need.last * (1 - R.teleShare);
      } else {
        done = this.pushLit >= b.cells;
        const c = this.target;
        tele = this.pushLit >= b.cells - 1 && c >= 0 && this.ink[c] >= this.vision.geo.cells[c].cap * R.teleShare;
      }
    }
    if (!this.telegraphed && (tele || this.blockT >= b.dur - R.telegraph)) {
      this.telegraphed = true;
      this.teleAt = this.blockT;
      this.emit({ type: 'telegraph', next: this.nextBlock });
    }
    // once telegraphed a push keeps its word: it ends within teleMax s
    const capped = this.blockT >= b.dur || (b.kind === 'push' && this.telegraphed && this.blockT >= this.teleAt + R.teleMax);
    if (done || capped || t >= this.plannedSec - Math.min(this.finaleSec, RULES.finale.short)) {
      const late = t >= this.plannedSec - Math.min(this.finaleSec, RULES.finale.short);
      this.endBlock(!done);
      if (late || !this.nextBlock) this.beginFinale();
      else this.startBlock(this.nextBlock.kind);
    }
  }

  /** A new block of `kind` now: its length, what comes after it, its words. */
  private startBlock(kind: BlockKind): void {
    const R = RULES;
    const t = this.t, oneBreath = breathCycle(BREATH);
    let dur: number, cells = 0, after: Block | null;
    const room = this.finaleAt - t;
    if (kind === 'warmup') {
      dur = warmFor(this.plannedSec);
      after = this.blk('push');
    } else if (kind === 'push') {
      cells = this.nextCells;
      // a light pass has no cells to light: a timed push (both caps grow with the player's mean cells)
      dur = pushSecAt(this.complete ? R.pushLight : R.pushMax, this.pieces);
      dur = Math.max(this.pushRoom, Math.min(dur, room - oneBreath));
      after = this.blk('rest');
    } else {
      const nominal = restSec(this.restBreaths);
      // another push only if it has its room and still leaves a breath of rest before the finale
      if (room - nominal - oneBreath >= this.pushRoom) {
        dur = nominal;
        after = this.blk('push');
      } else {
        // the last rest: the whole breaths that bring the session nearest its finale (at most three, or the
        // player's longer rest: the finale takes what is left)
        dur = room > 0 ? Math.min(Math.max(3, this.restBreaths) * oneBreath, breathRest(BREATH, room, Math.min(R.restMin, room)).sec) : oneBreath;
        after = null;
      }
    }
    const b: Block = { kind, dur, blind: false, cells };
    this.plan.push(b);
    this.blockIndex = this.plan.length - 1;
    this.nextBlock = after;
    this.blockT = 0;
    this.telegraphed = false;
    this.teleAt = -1;
    this.relSec = 0;
    this.judge.reset();
    this.goodT = 0;
    this.goodSaid = false;
    this.waitT = 0;
    this.waitSaid = false;
    this.pushLit = 0;
    const first = !this.plan.slice(0, -1).some(x => x.kind === kind);
    if (kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= R.blindFrom && !first && !this.complete && (this.pushesBase + this.pushesBegun) % R.blindEvery === 0;
      if (b.blind) {
        this.hidden = 0;
        this.emit({ type: 'night' });
        this.say('blind', 3, 12);
        this.coachOnce('night', null);
      } else {
        this.say(this.complete ? 'light' : 'push', 2, 14);
      }
    } else if (kind === 'rest') {
      this.restsBegun++;
      // a cell chosen in the rest waits for the next push
      this.say('rest', 2, 14);
    } else {
      this.say('warm', 1, 16);
    }
    this.tipK = this.pushesSighted;
    if (kind === 'push' && !b.blind) this.pushesSighted++;
    this.tip = this.tipFor(b, this.blockIndex, this.tipK);
    this.emit({ type: 'blockStart', block: b, index: this.blockIndex });
  }

  /** A block to come (its length is decided when it begins). */
  private blk(kind: BlockKind): Block {
    return { kind, dur: kind === 'rest' ? restSec(this.restBreaths) : pushSecAt(RULES.pushMax, this.pieces), blind: false, cells: kind === 'push' ? this.nextCells : 0 };
  }

  /**
   * What to do in the head: the picture's own scene first (and every third sighted push), imagery, recall
   * and counting in between, never the same twice in a row; `k` = the sighted pushes before this block.
   */
  private tipFor(b: Block, i: number, k: number): string {
    const v = this.vision;
    const declTask = v ? (v.decl ? t(`task.${v.decl}` as Key) : t('task.own')) : t('tip.push.1');
    if (b.kind === 'warmup') return t('tip.warm');
    if (b.kind === 'push') {
      if (b.blind) return t(BLIND_TIPS[(this.session + i) % BLIND_TIPS.length]);
      if (this.complete) return t(LIGHT_TIPS[this.pushesBegun % LIGHT_TIPS.length]);
      if (k % 3 === 0) return declTask;
      return t(PUSH_TIPS[(this.session + k) % PUSH_TIPS.length]);
    }
    const r = this.restsBegun - 1;
    if (r % 2 === 0 && v) {
      if (v.decl) return t('tip.rest.decl', { word: v.word });
      // the runner's panel shows two lines: a long own affirmation is repeated without being quoted
      const own = `${t('tip.rest.own', { cont: contOf(v.word) })}.`.replace(/([.!?…])\.$/, '$1');
      return own.length <= 64 ? own : t('tip.rest.ownLong');
    }
    return t(REST_TIPS[(this.session + r) % REST_TIPS.length]);
  }

  /** The block's end (`capped`: by its cap, not its cells): its verdict and what it leaves — after its judged window. */
  private endBlock(capped = false): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        if (b.blind) {
          // dawn: what focus poured in the dark lights now
          const s = this.judge.measured > 0 ? share : 0;
          this.nightShare = Math.max(this.nightShare, Math.round(s * 100));
          const cells = this.vision ? this.fill(this.hidden, 'dawn') : [];
          this.hidden = 0;
          this.emit({ type: 'dawn', cells, share: s });
          this.say('dawn', 3, 8);
        }
        if (verdict) {
          this.passedPush++;
          if (this.rays < RULES.raysMax) {
            this.rays++;
            this.emit({ type: 'ray', n: this.rays });
            if (!b.blind) this.say('ray', 1, 5);
          }
        }
        // the next push asks for as many cells as this one's pace allows (the player's mean ± 1: 3…5 by design)
        if (b.cells > 0 && !this.complete) this.nextCells = nextPushCells(b.cells, this.blockT, capped, this.pieces);
        b.dur = this.blockT;
      } else if (verdict) {
        this.passedRest++;
        if (this.rings < RULES.ringsMax) {
          this.rings++;
          this.emit({ type: 'ring', n: this.rings });
          this.say('ring', 1, 5);
        }
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  // ── the finale ──────────────────────────────────────────────────
  private beginFinale(): void {
    this.phase = 'finale';
    this.finaleT = 0;
    // the finale takes what the session has left (the last rest ended on a whole breath)
    this.finaleSec = Math.max(RULES.finale.short * 0.5, this.plannedSec - this.t);
    this.path = [];
    this.target = -1;
    this.story = null;
    this.nextBlock = null;
    const v = this.vision;
    if (v) {
      // the light reaches the unlit cells from the lit ones, ring by ring (all at once if none is lit)
      const depth = new Array<number>(v.geo.cells.length).fill(-1);
      const queue: number[] = [];
      v.geo.cells.forEach(c => { if (this.lit[c.id]) { depth[c.id] = 0; queue.push(c.id); } });
      if (!queue.length) {
        const h = autoNext(v.geo, this.lit, this.ink, -1);
        if (h >= 0) { depth[h] = 1; queue.push(h); }
      }
      for (let q = 0; q < queue.length; q++) {
        for (const nb of v.geo.cells[queue[q]].nb) if (depth[nb] < 0) { depth[nb] = depth[queue[q]] + 1; queue.push(nb); }
      }
      const max = Math.max(1, ...depth);
      v.geo.cells.forEach(c => {
        if (this.lit[c.id]) return;
        const d = depth[c.id] < 0 ? max : depth[c.id];
        const span = Math.min(RULES.graceSec, this.finaleSec * 0.3);
        this.graceAt[c.id] = 0.25 + (span - 0.25) * ((d - 1) / Math.max(1, max - 1));
      });
      if (v.geo.cells.some(c => !this.lit[c.id])) this.say('grace', 3, 5);
      else this.say('finale', 3, 5);
    }
    this.emit({ type: 'finale' });
  }

  private finale(dt: number): void {
    this.finaleT += dt;
    const v = this.vision;
    if (v) for (const c of v.geo.cells) if (!this.lit[c.id] && this.graceAt[c.id] >= 0 && this.finaleT >= this.graceAt[c.id]) this.light(c.id, 'grace');
    // the lit glass warms to its full glow through the finale
    for (let i = 0; i < this.glow.length; i++) if (this.lit[i]) this.glow[i] = Math.min(1, this.glow[i] + dt / 6);
    if (this.t >= this.plannedSec || this.finaleT >= this.finaleSec + RULES.settle) this.endFinale();
  }

  private endFinale(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.story = null;
    this.settle();
    this.phase = 'done';
  }

  /** Once: the album receives the declaration, the pace and the counters move, the choice for this session is used. */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = this.pushesBase + this.pushesBegun;
    p.total += this.litPlayer;
    p.best = Math.max(p.best, this.litPlayer);
    const v = this.vision;
    if (v) {
      const decl = keyDecl(v.key);
      this.newDecl = !!decl && !(p.album[decl]?.n);
      this.times = receive(p, { key: v.key, lit: this.litPlayer, rays: this.rays, rings: this.rings, day: this.dayOf() });
      p.pace = nextPace(p.pace, this.litPlayer, this.paceSec);
      p.cells = this.cells;
      p.last = v.key;
      if (p.next === v.key) p.next = null;
    }
  }

  private dayOf(): string { return this.day || new Date().toISOString().slice(0, 10); }

  // ── the hands ───────────────────────────────────────────────────
  /** A tap at (x, y) in picture units (null: off the window). Returns true when it did something. */
  tapAt(x: number | null, y: number | null): boolean {
    if (!this.started || this.phase !== 'play') return false;
    if (this.story) return this.closeStoryByTap();
    const v = this.vision;
    if (!v || x === null || y === null) return false;
    if (this.block.kind === 'rest') {
      const c = cellUnder(v.geo, x, y);
      if (c >= 0 && this.lit[c]) {
        if (this.touchCool > 0) return true;
        this.touchCool = 0.8;
        this.glow[c] = Math.min(1, this.glow[c] + 0.04);
        this.emit({ type: 'touchLight', cell: c });
        if (this.rng() < 0.3) this.say('glow', 1, 3);
        return true;
      }
      const u = pickAt(v.geo, this.lit, x, y);
      if (u < 0) return false;
      this.marked = u;
      this.emit({ type: 'mark', cell: u });
      return true;
    }
    if (this.complete) {
      const c = cellUnder(v.geo, x, y);
      if (c >= 0) this.emit({ type: 'touchLight', cell: c });
      return c >= 0;
    }
    const c = pickAt(v.geo, this.lit, x, y);
    if (c < 0) return false;
    this.path = [];
    if (c === this.target) this.splash();
    else {
      this.setTarget(c, 'tap');
      if (this.rng() < 0.18) this.say('pick', 1, 3);
      this.splash();
    }
    return true;
  }

  /**
   * The cell a tap at (x, y) (picture units) would act on now, as `tapAt` chooses it — the part the colour
   * would go to, the glass that would glow, the part a rest would mark — or -1.  No side effects: a desktop's
   * hover shows it (DESIGN §14).
   */
  hoverAt(x: number, y: number): number {
    const v = this.vision;
    if (!v || !this.started || this.phase !== 'play' || this.story) return -1;
    if (this.block.kind === 'rest' || this.complete) {
      const c = cellUnder(v.geo, x, y);
      if (c >= 0 && this.lit[c]) return c;
      if (this.complete) return c;
    }
    return pickAt(v.geo, this.lit, x, y);
  }

  /** A drag laid a path over these cells (in order): the colour follows it after the current cell. */
  setPath(cells: readonly number[]): void {
    if (!this.vision || this.phase !== 'play' || this.story) return;
    const seen = new Set<number>();
    const out: number[] = [];
    for (const c of cells) {
      if (c < 0 || this.lit[c] || seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      if (out.length >= RULES.pathMax) break;
    }
    if (!out.length) return;
    if (this.block.kind === 'rest' || this.complete) {
      this.marked = out[0];
      this.emit({ type: 'mark', cell: out[0] });
      return;
    }
    this.path = out.slice(1);
    this.setTarget(out[0], 'path');
    this.emit({ type: 'path', cells: out });
    this.coachOnce('drag', null);
  }

  /**
   * A drop of colour into the cell being coloured (a tap on it, Space), at most every splashCool seconds — it
   * joins colour that flows (focus); without focus a tap only chooses the cell.
   */
  splash(): boolean {
    if (!this.pouring || this.splashCool > 0 || this.block.blind) return false;
    const c = this.ensureTarget();
    if (c < 0 || this.rate <= 0) return false;
    this.splashCool = RULES.splashCool;
    this.emit({ type: 'splash', cell: c });
    this.fill(RULES.splash, 'player');
    return true;
  }

  /** Space and Enter: close the card, else a drop of colour. */
  key(key: string, down: boolean): boolean {
    if (!down) return key === ' ' || key === 'Spacebar' || key === 'Enter';
    if (key !== ' ' && key !== 'Spacebar' && key !== 'Enter') return false;
    if (this.story) return this.closeStoryByTap();
    this.splash();
    return true;
  }

  /** The card's answer: how Polish speaks to the player. */
  chooseForm(form: Form): void {
    this.p.form = form;
    this.emit({ type: 'form', form });
    this.closeStory();
  }

  private closeStoryByTap(): boolean {
    if (!this.story || this.story.t < RULES.storyMinTap) return !!this.story;
    this.closeStory();
    return true;
  }

  private closeStory(): void {
    if (!this.story) return;
    this.story = null;
    this.emit({ type: 'storyEnd' });
    this.talk.clear();
    this.say('warm', 1, 10);
  }

  // ── output ──────────────────────────────────────────────────────
  private say(m: Moment, pri: number, ttl: number): void { this.talk.ask(m, pri, ttl); }

  private coachOnce(what: Coach, at: CoachAt, k?: number): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at, k });
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the stream in a sighted push past its lead-in, the calm in a rest; null blind, without signal, elsewhere. */
  meter(): number | null {
    if (!this.playing || !this.reliable || this.story) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.flow);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the stream in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.playing || !f.reliable) return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.flow);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The headline's line under the number: the push's cells to the rest, a rest's breaths, the night, the whole. */
  headSub(): string | undefined {
    if (!this.started) return undefined;
    if (this.complete) return t('hud.whole');
    if (this.playing && !this.story) {
      const b = this.block;
      if (b.kind === 'warmup') return t('hud.warm');
      if (b.kind === 'push') return b.blind ? t('hud.night') : t('hud.toRest', { n: Math.min(this.pushLit, b.cells), k: b.cells });
      if (b.kind === 'rest') return t('hud.breath', { n: Math.min(this.breaths, this.breath.n + 1), k: this.breaths });
    }
    return this.cells ? t('hud.of', { n: this.cells }) : undefined;
  }

  /** The session's numbers, idempotent: the record with Math.max; the album and the counters move once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) p.best = Math.max(p.best, this.litPlayer);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const v = this.vision;
    const n = this.cells;
    const pct = (x: number) => t('pct', { n: fmtNum(Math.round(x)) });
    const stats: [string, string][] = [
      // an own affirmation never goes into the stats (they are saved with the session); the declaration does
      [t('stat.vision'), v ? (v.decl ? v.word : t('own')) : '—'],
      [t('stat.pieces'), `${this.litPlayer}/${n}`],
      [t('stat.frags'), `${this.fragsDone}/${v?.geo.frags.length ?? 0}`],
      [t('stat.rays'), String(this.rays)],
      [t('stat.rings'), String(this.rings)],
      [t('stat.glow'), pct(this.glowMean * 100)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
      // a night's share takes the album's place (the summary shows eight)
      this.nightShare >= 0 ? [t('stat.night'), pct(this.nightShare)] : [t('stat.album'), `${received(p)}/18`],
    ];
    return {
      score: this.litPlayer, unit: unit(this.litPlayer), record: this.bestBefore !== null && this.litPlayer > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.verse,
    };
  }

  private highlights(): string[] {
    const v = this.vision;
    if (!v) return [];
    const out: string[] = [this.affirmation];
    if (this.settled && v.decl && this.newDecl) out.push(t('hl.new', { n: received(this.p), all: 18 }));
    else if (this.settled && this.times > 1) out.push(t('hl.again', { n: this.times }));
    const best = this.bestBefore;
    if (best !== null && this.litPlayer > best) out.push(t('hl.record', { pieces: piecesText(this.litPlayer) }));
    else if (best !== null && this.litPlayer > 0 && best - this.litPlayer > 0 && best - this.litPlayer <= Math.max(4, best * 0.25)) {
      out.push(t('hl.toBest', { pieces: piecesText(best - this.litPlayer) }));
    }
    if (this.complete && this.litPlayer >= this.cells) out.push(t('hl.whole'));
    else if (this.graced > 0) out.push(t('hl.grace', { pieces: piecesText(this.graced) }));
    if (this.rays + this.rings > 0) out.push(t('hl.aura', { rays: this.rays, rings: this.rings }));
    if (this.nightShare >= 0) out.push(t('hl.night', { n: this.nightShare }));
    out.push(t(v.decl ? 'hl.close' : 'hl.closeOwn'));
    return out.slice(0, 6);
  }
}
