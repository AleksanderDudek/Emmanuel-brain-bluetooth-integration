/**
 * Ja jestem…'s session, without the DOM (DESIGN §13.8).  A vision — a picture cut into a stained-glass
 * mosaic (vision.ts) — is coloured cell by cell and lit:
 *
 *   warm-up (first session)  the colour flows quickly by itself; taps choose where
 *   push (Barwa)             colour pours into the chosen cell: a base flow, and above the threshold a
 *                            wider stream (after the band's lead-in); a full cell LIGHTS; a whole fragment
 *                            lit becomes one pane; every cell lit → the light pass: focus pours light
 *   blind push (Noc)         the base flow shows; what focus adds is kept and poured at dawn, at the end
 *   rest (Blask)             no colour: calm makes the lit glass glow; the aura gathers
 *   each block's verdict     a passed push leaves a RAY in the aura, a passed rest a RING
 *   the finale               the light fills what is still unlit (grace), the leading dissolves, the
 *                            declaration is written out with its verse (the view)
 *
 * The brain drives only the slow flow and the glow; touch chooses where (and adds a drop now and then);
 * a bad signal holds the flow at its base, never below.  Nothing is ever lost.  Events go out through
 * `take()`; the view, the sound and the coach marks read them.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { ArcadeOutcome } from '../kit/types';
import { fmtNum } from '../../i18n';
import {
  BLIND_TIPS, DECLS, LIGHT_TIPS, LINES, OWN_VERSE, PUSH_TIPS, REST_TIPS, sentence, type DeclId, type Form, type Moment,
} from './content';
import { t, piecesText, unit, type Key } from './i18n';
import { keyDecl, nextPace, planCells, receive, received, type JestemProgress, type VisionKey } from './meta';
import { RULES } from './rules';
import { Talk } from './talk';
import { autoNext, cellUnder, pickAt, type VisionGeo } from './vision';
import type { PassageId } from '../kit/scripture';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }

/** The vision the session colours: its key, its geometry, and the word it declares (resolved for the page). */
export interface SimVision { key: VisionKey; geo: VisionGeo; decl: DeclId | null; word: string }

export type Coach = 'tap' | 'lit' | 'oculus' | 'rest' | 'drag' | 'pane' | 'night' | 'light';
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
  | { type: 'coach'; what: Coach; at: CoachAt };

export interface SimInit {
  progress: JestemProgress;
  rng: () => number;
  day: string;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the page's language needs the speaker's form (Polish) */
  askForm: boolean;
}

/** The opening card of the first session (and the form question in Polish). */
export interface Story { t: number; dur: number; ask: boolean }

const NO_EVENTS: readonly SimEvent[] = [];

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The finale's length: 20 s in sessions of 3 min and more, 14 s from 2 min, 8 s in shorter ones. */
export const finaleFor = (plannedSec: number): number =>
  (plannedSec >= 180 ? RULES.finale.long : plannedSec >= 120 ? RULES.finale.mid : RULES.finale.short);

/**
 * The session's blocks: the first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in 3,
 * 6 s in a ≤ 60 s test); then push / rest pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time, jittered
 * only when there is room), ending with a rest; the finale takes the last stretch.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * R.minBlock, plannedSec - fin);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(2 * R.minBlock, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(R.minBlock, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - fin;
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const pair = R.push[0] + R.rest[0];
  const pairs = Math.max(1, Math.round(left / pair));
  const jitter = pairs >= 2 && left / (pairs * pair) >= 0.85 ? 1 : 0;
  const durs: number[] = [];
  for (let i = 0; i < pairs; i++) durs.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1], R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1]);
  const scale = left / durs.reduce((s, d) => s + d, 0);
  for (let i = 0; i < durs.length; i++) durs[i] *= scale;
  liftShort(durs, R.minBlock);
  durs.forEach((dur, i) => plan.push(b(i % 2 ? 'rest' : 'push', dur)));
  return plan;
}

/** The seconds of pouring a plan holds (the warm-up's quick flow counts a little more). */
export const pourSecOf = (plan: readonly Block[]): number =>
  plan.reduce((s, b) => s + (b.kind === 'push' ? b.dur : b.kind === 'warmup' ? b.dur * 1.2 : 0), 0);

/** The flow in a sighted push past its lead-in (units per second): base, and a wider stream above the threshold. */
export function pourRate(level: number): number {
  const R = RULES;
  const x = clamp((level - R.levelLo) / R.levelSpan);
  return R.baseRate + R.spanRate * x ** R.shapePow;
}

// ── the session ──────────────────────────────────────────────────
export class JestemSim {
  readonly p: JestemProgress;
  readonly plan: Block[];
  readonly session: number;
  readonly plannedSec: number;
  readonly finaleSec: number;
  /** the cells the window is cut into (the plan's pace × its pouring time) */
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
  /** the sighted pushes before the current one (the strategies' turn) */
  private tipK = 0;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  story: Story | null = null;

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
  /** the finale's clock, and when each still-unlit cell turns to light */
  finaleT = 0;
  graceAt: number[] = [];

  /** the stream's width (the gauge): the smoothed level in a sighted push; the shown calm in a rest */
  flow = 0;
  calmShown = 0;
  reliable = false;
  /** the flow this frame (units/s) and what a blind push keeps for dawn */
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
  private litTalkAt = -99;
  private halfSaid = false;
  private lastSaid = false;
  private paneSeen = false;
  /** seconds of pouring until the picture was whole (for the pace) */
  pourT = 0;
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
    this.session = this.p.sessions + 1;
    this.pushesBase = this.p.pushes;
    this.bestBefore = this.p.sessions > 0 ? this.p.best : null;
    this.askForm = init.askForm;
    this.day = init.day;
    this.lead = init.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.judge = RoundJudge.from(init.tuning);
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.cellsWanted = planCells(this.p.pace, pourSecOf(this.plan));
    this.talk = new Talk(LINES, init.rng);
  }

  // ── state ───────────────────────────────────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get playing(): boolean { return this.started && this.phase === 'play'; }
  get pushBlock(): boolean { return this.playing && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.playing && this.block.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the stream answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** colour flows now (the warm-up or a push, the card closed, the vision ready, not yet whole) */
  get pouring(): boolean {
    return this.playing && !this.story && !!this.vision && !this.complete && (this.block.kind === 'push' || this.block.kind === 'warmup');
  }
  /** the light pass: every cell lit, a push pours light */
  get lighting(): boolean { return this.playing && !this.story && this.complete && this.block.kind === 'push'; }
  get cells(): number { return this.vision?.geo.cells.length ?? 0; }
  get score(): number { return this.litPlayer; }
  get word(): string { return this.vision?.word ?? ''; }
  get verse(): PassageId { return this.vision?.decl ? DECLS[this.vision.decl].verse : OWN_VERSE; }
  /** the mean glow of the lit glass (0..1) */
  get glowMean(): number {
    let s = 0, n = 0;
    for (let i = 0; i < this.glow.length; i++) if (this.lit[i]) { s += this.glow[i]; n++; }
    return n ? s / n : 0;
  }
  get fragsDone(): number { return this.fragDone.filter(Boolean).length; }
  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.playing && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.playing && this.blockT < RULES.bannerSec && b.kind !== 'warmup';
    return !!(tele || banner || this.story || (this.phase === 'finale' && this.finaleT > 2.2) || this.phase === 'done');
  }

  // ── the session's course ────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    if (this.session === 1) {
      const ask = this.askForm && this.p.form === null;
      this.story = { t: 0, dur: ask ? RULES.storyAsk : RULES.storySec, ask };
    }
  }

  /** The prepared vision arrives (before play, or a moment into it). */
  setVision(v: SimVision): void {
    if (this.vision) return;
    this.vision = v;
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

  /** The band's slow quantities: the stream's width in a sighted push, the calm in a rest. */
  private brain(dt: number, f: FocusFrame): void {
    this.reliable = f.reliable;
    const live = this.sighted && f.reliable;
    this.flow = approach(this.flow, live ? clamp(f.level) : 0, dt, RULES.meterTau);
    this.calmShown = approach(this.calmShown, this.restBlock && f.reliable ? clamp(f.calm) : 0, dt, RULES.meterTau);
    if (this.playing && f.reliable) this.relSec += dt;
    // the rate: the warm-up's quick flow; in a push the base, and the stream above it once the band can answer
    const b = this.block;
    let rate = 0, extra = 0;
    if (this.pouring) {
      if (b.kind === 'warmup') rate = RULES.warmRate;
      else {
        rate = RULES.baseRate;
        if (this.blockT >= this.lead && f.reliable) {
          const full = pourRate(clamp(f.level));
          if (b.blind) extra = full - rate;
          else rate = full;
        }
      }
    }
    this.rate = rate;
    if (extra > 0) this.hidden += extra * dt;
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.say(this.complete ? 'light' : 'good', 2, 4);
    }
    if (live && this.blockT >= this.lead + 0.5) this.coachOnce('oculus', { kind: 'oculus' });
  }

  /** The colour flows into the target cell; a full cell lights. */
  private pour(dt: number): void {
    if (!this.pouring) return;
    this.pourT += dt * (this.block.kind === 'warmup' ? 1.2 : 1);
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
    this.emit({ type: 'lit', cell: c, by, n: this.litPlayer });
    if (by === 'grace') return;
    const n = this.cells, done = this.litPlayer;
    if (done === 1) {
      this.say('first', 3, 5);
      this.coachOnce('lit', { kind: 'cell', id: c });
    } else if (!this.halfSaid && done >= n / 2) {
      this.halfSaid = true;
      this.say('half', 2, 5);
    } else if (!this.lastSaid && n - done <= Math.max(2, Math.round(n * 0.12)) && n - done > 0) {
      this.lastSaid = true;
      this.say('last', 2, 5);
    } else if (this.t - this.litTalkAt >= RULES.litTalkEvery && by === 'player') {
      this.litTalkAt = this.t;
      this.say('lit', 1, 2.5);
    }
    if (!this.paneSeen && v.geo.cells[c].nb.some(x => this.lit[x])) {
      this.paneSeen = true;
      this.coachOnce('pane', { kind: 'cell', id: c });
    }
    const fi = v.geo.cells[c].frag;
    if (!this.fragDone[fi] && v.geo.frags[fi].cells.every(id => this.lit[id])) {
      this.fragDone[fi] = true;
      this.emit({ type: 'fragment', frag: fi });
      if (done > 1 && done < n) this.say('fragment', 2, 5);
    }
    if (done >= n && !this.complete) {
      this.complete = true;
      this.completeAt = this.t;
      this.path = [];
      this.emit({ type: 'complete' });
      if (this.phase === 'play') {
        this.say('complete', 3, 6);
        this.coachOnce('light', null);
      }
    }
  }

  /** A rest: calm makes the lit glass glow (a little even without a signal); the light pass does it in a push. */
  private restGlow(dt: number, f: FocusFrame): void {
    if (!this.vision || this.story) return;
    let k = 0;
    if (this.restBlock) {
      k = (RULES.glowBase + RULES.glowCalm * (f.reliable ? clamp(f.calm) : 0)) / RULES.glowSec;
    } else if (this.lighting) {
      const lv = this.sighted && f.reliable ? clamp(f.level) : 0;
      k = (RULES.lightBase + (1 - RULES.lightBase) * lv) / RULES.lightSec;
    }
    if (k <= 0) return;
    for (let i = 0; i < this.glow.length; i++) if (this.lit[i]) this.glow[i] = Math.min(1, this.glow[i] + k * dt);
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    if (this.story) return;   // the opening card holds the first block's clock (it is the warm-up's)
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec && this.vision) {
      const best = this.lit.findIndex(Boolean);
      this.coachOnce('rest', best >= 0 ? { kind: 'cell', id: best } : null);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - this.finaleSec) {
      this.endBlock();
      this.beginFinale();
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    this.goodT = 0;
    this.goodSaid = false;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      if (b.blind) {
        this.hidden = 0;
        this.emit({ type: 'night' });
        this.say('blind', 3, 10);
        this.coachOnce('night', null);
      } else {
        this.say(this.complete ? 'light' : 'push', 2, 12);
      }
    } else if (b.kind === 'rest') {
      this.restsBegun++;
      // a cell chosen in the rest waits for the next push
      this.say('rest', 2, 12);
    } else {
      this.say('warm', 1, 14);
    }
    this.tipK = this.pushesSighted;
    if (b.kind === 'push' && !b.blind) this.pushesSighted++;
    this.tip = this.tipFor(b, i, this.tipK);
    this.emit({ type: 'blockStart', block: b, index: i });
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
    if (r % 2 === 0 && v) return t('tip.rest.decl', { word: v.word });
    return t(REST_TIPS[(this.session + r) % REST_TIPS.length]);
  }

  /** The block's end: its verdict and what it leaves — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push') {
        if (b.blind) {
          // dawn: what focus added in the dark is poured now
          const s = this.judge.measured > 0 ? share : 0;
          this.nightShare = Math.max(this.nightShare, Math.round(s * 100));
          const cells = this.vision ? this.fill(this.hidden, 'dawn') : [];
          this.hidden = 0;
          this.emit({ type: 'dawn', cells, share: s });
          this.say('dawn', 3, 6);
        }
        if (verdict) {
          this.passedPush++;
          if (this.rays < RULES.raysMax) {
            this.rays++;
            this.emit({ type: 'ray', n: this.rays });
            if (!b.blind) this.say('ray', 1, 4);
          }
        }
      } else if (verdict) {
        this.passedRest++;
        if (this.rings < RULES.ringsMax) {
          this.rings++;
          this.emit({ type: 'ring', n: this.rings });
          this.say('ring', 1, 4);
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
    this.path = [];
    this.target = -1;
    this.story = null;
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
      if (v.geo.cells.some(c => !this.lit[c.id])) this.say('grace', 3, 4);
      else this.say('finale', 3, 4);
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
      p.pace = nextPace(p.pace, this.litPlayer, this.pourT);
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
        if (this.rng() < 0.3) this.say('glow', 1, 2);
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
      if (this.rng() < 0.18) this.say('pick', 1, 2);
      this.splash();
    }
    return true;
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

  /** A drop of colour into the cell being coloured (a tap on it, Space), at most every splashCool seconds. */
  splash(): boolean {
    if (!this.pouring || this.splashCool > 0) return false;
    const c = this.ensureTarget();
    if (c < 0) return false;
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
    this.say('warm', 1, 8);
  }

  // ── output ──────────────────────────────────────────────────────
  private say(m: Moment, pri: number, ttl: number): void { this.talk.ask(m, pri, ttl); }

  private coachOnce(what: Coach, at: CoachAt): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at });
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

  /** The session's numbers, idempotent: the record with Math.max; the album and the counters move once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) p.best = Math.max(p.best, this.litPlayer);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const v = this.vision;
    const n = this.cells;
    const pct = (x: number) => t('pct', { n: fmtNum(Math.round(x)) });
    const stats: [string, string][] = [
      // an own word never goes into the stats (they are saved with the session); the declaration does
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
    const out: string[] = [sentence(v.word)];
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
