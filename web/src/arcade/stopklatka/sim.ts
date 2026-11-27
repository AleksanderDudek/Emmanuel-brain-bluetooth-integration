/**
 * Stop-klatka's session, without the canvas (DESIGN.md §28): the plan of rules.ts played — the opening (and, the first
 * time, the opening pages and the age group asked), the stories of the chosen group one after another (each told
 * through the eyes beat by beat, then the freeze: the stop, the breath that focus turns into clarity, the feeling
 * named, a second look, the choice; then back through the eyes: the answer — or the step away first — the outcome and
 * the lesson with whole breaths), and the close — what the focus drives, what the band is asked, what the scene shows
 * (`scene()`, `look`), and the session's numbers.
 *
 * Honest neurofeedback (§18.3–18.4): the clarity charges only in a sighted freeze past its lead-in, with a reliable
 * signal, while focused, at `focusRate` (the level averaged over a whole breath).  Taps read on, name and choose —
 * never charge.  A freeze the clarity did not fill is never filled for the player: time moves on, the story still
 * shows the skill, and no moment is counted.  The work fits the player (§24.4b): a freeze asks `RULES.fill` of what
 * their pace gives in its sighted seconds — the pace learned across sessions and within this one.
 *
 * The game has no words of the player's own: result() carries the catalog's words only (the feelings, the lessons).
 */
import { fmtNum, lang } from '../../i18n';
import { BREATH_DEFAULT, breathAt, type BreathState } from '../kit/breath';
import { BlockContrast, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import type { Rhythm } from '../kit/rhythm';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { feelWord, list, t, unit } from './i18n';
import { DEFAULT_AGE, bestOf, migrate, paceAfter, setAge, startIn, type StopProgress } from './meta';
import {
  RULES, beatSec, cleanPace, focusRate, freezeMoments, freezeStartMin, needFor, planFor, readTime, secondAt,
  type BlockKind, type BlockWhat, type Plan, type PlanBlock, type SlotPlan,
} from './rules';
import { storiesFor, storyById, storyText, type StoryText } from './stories';
import { AGES, AGE_SPAN, type Age, type Feeling, type Figure, type Place, type Prop, type Story } from './story';
import { WHY } from './why';

export type { BlockKind, BlockWhat };

/** The passage the game takes root in (the lobby opens with it; the opening shows it). */
export const ROOT: PassageId = 'pro16.32';
/** The closing passages, in turn by session (a story's own passage closes the session when its story came last). */
export const CLOSE_VERSES: readonly PassageId[] = ['pro15.1', 'jas1.19-20', 'pro14.29', 'col3.15', 'pro19.11', 'php4.7', 'mat5.9', 'eph4.26', 'rom12.18'];

export type Way = 'answer' | 'away';
export type AfterPart = 'away' | 'answer' | 'outcome' | 'lesson';
export type Coach = 'tap' | 'focus' | 'name' | 'choose';
export type Phase = 'intro' | 'tell' | 'freeze' | 'after' | 'close' | 'end';

export type SimEvent =
  | { type: 'block'; kind: BlockKind; what: BlockWhat }
  | { type: 'beat'; slot: number; i: number; place: Place; heat: number }
  | { type: 'freeze'; slot: number }
  | { type: 'chips' }
  | { type: 'named'; f: Feeling; by: 'player' | 'auto' }
  | { type: 'line'; i: number }
  | { type: 'charged'; slot: number; n: number }
  | { type: 'choices' }
  | { type: 'chose'; way: Way; by: 'player' | 'auto' }
  | { type: 'flow'; charged: boolean }
  | { type: 'part'; part: AfterPart }
  | { type: 'age'; age: Age }
  | { type: 'tap' }
  | { type: 'coach'; what: Coach };

/** A story's slot as the session plays it. */
export interface SlotRun {
  plan: SlotPlan;
  story: Story;
  text: StoryText;
  /** the tell's beat now (0: the first told — `plan.from` in the story) and since when */
  beat: number;
  beatT0: number;
  /** its freeze began */
  met: boolean;
  /** focus-seconds the clarity asks, the clarity (0..1) and the clarity shown */
  need: number;
  clarity: number;
  shown: number;
  charged: boolean;
  /** s into the freeze when it charged (−1 not yet) */
  chargedAt: number;
  /** s of focus held after the charge */
  held: number;
  /** the freeze's actual start and end (s of play), its inner moments */
  fzT0: number;
  fzT1: number;
  moments: { stopEnd: number; nameAt: number; autoNameAt: number; chooseLate: number };
  chipsOpen: boolean;
  named: Feeling | null;
  namedBy: 'player' | 'auto' | null;
  /** second-look lines shown, since when the last one is (s into the freeze), whether some came late (unlit) */
  lines: number;
  lineAt: number;
  late: boolean;
  choicesOpen: boolean;
  firstWay: Way;
  way: Way | null;
  wayBy: 'player' | 'auto' | null;
  /** the after: its parts, their lengths (s), the part now and since when */
  parts: AfterPart[];
  partDur: number[];
  part: number;
  partT0: number;
  /** the pace measured up to the charge: sighted reliable seconds, focus-seconds given */
  sighted: number;
  produced: number;
}

/** What the scene shows this frame: a beat through the eyes. */
export interface SceneBeat {
  place: Place;
  people: readonly Figure[];
  prop?: Prop;
  text: string;
  say?: string;
  /** who speaks (an index into people), −1 the player (their own words), null none */
  from: number | null;
  screen?: string;
  heat: number;
  /** the story's title rides on its first beat */
  title?: string;
  /** the step away: the scene a few steps further */
  far?: boolean;
  /** a stable key for the beat (story id + part) */
  key: string;
}

export interface SimOpts {
  progress: StopProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  rhythm?: Rhythm | null;
  day: string;
  reduced?: boolean;
}

/** A running mean over a window (the level over one whole breath, §18.4): quarter-second bins. */
class WindowMean {
  private readonly bins: number[] = [];
  private acc = 0;
  private accT = 0;
  private sum = 0;
  constructor(readonly sec: number, readonly bin = 0.25) {}
  push(v: number, dt: number): void {
    if (!(dt > 0) || !Number.isFinite(v)) return;
    this.acc += v * dt;
    this.accT += dt;
    while (this.accT >= this.bin) {
      const part = this.bin / this.accT;
      const val = (this.acc * part) / this.bin;
      this.acc -= this.acc * part;
      this.accT -= this.bin;
      this.bins.push(val);
      this.sum += val;
      if (this.bins.length > Math.round(this.sec / this.bin)) this.sum -= this.bins.shift()!;
    }
  }
  get value(): number | null { return this.bins.length ? this.sum / this.bins.length : null; }
}

const ease = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));
const other = (w: Way): Way => (w === 'answer' ? 'away' : 'answer');
const len = (s?: string): number => (s ? [...s].length : 0);

/** The opening pages the "why" has in the page's language (`open.1`…). */
export function openPages(l = lang): string[] {
  const why = WHY[l] ?? {}, src = WHY.pl ?? {};
  const out: string[] = [];
  for (let i = 1; i <= RULES.openMax; i++) {
    const v = why[`open.${i}`] ?? src[`open.${i}`];
    if (typeof v !== 'string' || !v.trim()) break;
    out.push(v);
  }
  return out;
}

/** The plan a session of a progress would follow (the lobby's forecast and the sim's own). */
export function planOf(p: StopProgress, o: { plannedSec: number; eeg: boolean; rhythm?: Rhythm | null; age?: Age; ask?: boolean }): Plan {
  const age = o.age ?? p.age;
  const order = storiesFor(age, p.heavy);
  const first = p.sessions === 0;
  return planFor({
    plannedSec: o.plannedSec, eeg: o.eeg, order, start: startIn(p, order, age), sessions: p.sessions,
    focus: o.rhythm?.focus ?? null, rest: o.rhythm?.rest ?? null, custom: !!o.rhythm?.custom,
    open: first ? openPages().length : 0, ask: o.ask ?? !p.ageSet, awayChars: len(t('away.text')) + len(t('away.say')),
  });
}

export class StopSim {
  readonly p: StopProgress;
  plan: Plan;
  runs: SlotRun[];
  readonly eeg: boolean;
  readonly reduced: boolean;
  readonly contrast = new BlockContrast(4);
  readonly first: boolean;
  started = false;
  bi = 0;
  block: PlanBlock;
  blockT = 0;
  t = 0;
  /** what the focus does this frame (focus-seconds a second) and its shown pace, calm, the clarity's glow */
  rate = 0;
  rateShown = 0;
  calm = 0;
  glow = 0;
  reliable = false;
  /** freezes charged this session */
  mastered = 0;
  /** the age group this session tells (the player may pick it on the opening card) */
  age: Age;
  /** the age was picked on the card this session */
  picked = false;
  /** the scene's look: heat shown, colour (1 full, 0 grey), the cool of the still, the camera's step out, the flash */
  heat = 0;
  sat = 1;
  cool = 0;
  out = 0;
  flash = 0;
  /** the runner's coach mark is up until this time */
  hintUntil = 0;
  private readonly mean = new WindowMean(RULES.meanSec);
  private readonly events: SimEvent[] = [];
  private readonly bestBefore: number | null;
  private readonly session: number;
  private readonly firstSessions: boolean;
  private readonly rhythm: Rhythm | null;
  private readonly plannedSec: number;
  /** the pace measured this session so far (sighted seconds up to each charge, focus-seconds given in them) */
  private paceSec = 0;
  private paceFocus = 0;
  /** the way chosen last time for each story told this session */
  private readonly lastWay = new Map<string, Way>();
  private credited = false;

  constructor(o: SimOpts) {
    this.p = migrate(o.progress);
    this.eeg = o.eeg;
    this.reduced = !!o.reduced;
    this.first = this.p.sessions === 0;
    this.firstSessions = this.p.sessions < 2;
    this.session = this.p.sessions + 1;
    this.bestBefore = bestOf(this.p);
    this.rhythm = o.rhythm ?? null;
    this.plannedSec = o.plannedSec;
    this.age = this.p.age ?? DEFAULT_AGE;
    this.plan = planOf(this.p, { plannedSec: o.plannedSec, eeg: o.eeg, rhythm: this.rhythm, age: this.age });
    this.runs = this.buildRuns();
    this.block = this.plan.blocks[0];
    void o.rng;
  }

  private buildRuns(): SlotRun[] {
    return this.plan.slots.map(sl => {
      const story = storyById(sl.id)!;
      return {
        plan: sl, story, text: storyText(story), beat: 0, beatT0: sl.t0, met: false, need: 1, clarity: 0, shown: 0, charged: false, chargedAt: -1, held: 0,
        fzT0: sl.tellEnd, fzT1: sl.freezeEnd, moments: freezeMoments(sl.freezeEnd - sl.tellEnd, this.plan.lead),
        chipsOpen: false, named: null, namedBy: null, lines: 0, lineAt: 0, late: false, choicesOpen: false, firstWay: 'answer', way: null, wayBy: null,
        parts: [], partDur: [], part: 0, partT0: 0, sighted: 0, produced: 0,
      };
    });
  }

  // ── the clock ─────────────────────────────────────────────────

  get T(): number { return this.plan.T; }
  get lead(): number { return this.plan.lead; }
  get cyc(): number { return this.plan.cyc; }
  get pushBlock(): boolean { return this.block.kind === 'push'; }
  get restBlock(): boolean { return this.block.kind === 'rest'; }
  get sighted(): boolean { return this.pushBlock && this.blockT >= this.lead; }
  get dur(): number { return Math.max(0, this.block.t1 - this.block.t0); }
  get left(): number { return Math.max(0, this.block.t1 - this.t); }
  get blockK(): number { return clamp(this.blockT / Math.max(0.01, this.dur)); }
  /** the story slot of this block (null: the opening or the close) */
  get cur(): SlotRun | null { return this.block.slot >= 0 ? this.runs[this.block.slot] ?? null : null; }
  /** the after's part now */
  get afterPart(): AfterPart | null {
    const r = this.cur;
    return this.block.what === 'after' && r && r.parts.length ? r.parts[r.part] : null;
  }
  /** the breath of the freeze and of the lesson's rest (4 · 0 · 6 · 0 from its start), null elsewhere */
  get breath(): BreathState | null {
    const r = this.cur;
    if (this.block.what === 'freeze' && r) return breathAt(BREATH_DEFAULT, this.blockT);
    if (this.afterPart === 'lesson' && r) return breathAt(BREATH_DEFAULT, this.t - r.partT0);
    return null;
  }
  get phase(): Phase {
    if (this.started && this.t >= this.T) return 'end';
    return this.block.what;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.p.lastLen = this.T;
    this.enter(this.plan.blocks[0]);
  }

  take(): SimEvent[] { return this.events.splice(0); }
  private emit(e: SimEvent): void { this.events.push(e); }

  private coach(what: Coach): void {
    if (!this.firstSessions) return;
    const id = `c.${what}`;
    if (this.p.seen.includes(id)) return;
    this.p.seen.push(id);
    this.emit({ type: 'coach', what });
  }

  // ── the blocks ────────────────────────────────────────────────

  private enter(b: PlanBlock): void {
    this.block = b;
    this.blockT = Math.max(0, this.t - b.t0);
    this.emit({ type: 'block', kind: b.kind, what: b.what });
    const r = this.cur;
    switch (b.what) {
      case 'tell':
        if (!r) break;
        r.beat = 0;
        r.beatT0 = b.t0;
        this.emitBeat(r);
        this.coach('tap');
        break;
      case 'freeze':
        if (r) this.enterFreeze(r, b);
        break;
      case 'after':
        if (r) this.enterAfter(r, b);
        break;
      default: break;
    }
  }

  private emitBeat(r: SlotRun): void {
    const i = r.plan.from + r.beat;
    const beat = r.story.beats[i];
    if (beat) this.emit({ type: 'beat', slot: r.plan.slot, i, place: beat.place, heat: beat.heat });
  }

  /** The pace the next freeze is fitted to: the learned one, moved toward this session's as it is measured. */
  get pace(): number {
    const base = cleanPace(this.p.pace) || RULES.pace0;
    if (this.paceSec <= 0) return base;
    const w = this.paceSec / (this.paceSec + RULES.paceBlendSec);
    return cleanPace((1 - w) * base + w * Math.max(RULES.paceMin, this.paceFocus / this.paceSec));
  }

  private enterFreeze(r: SlotRun, b: PlanBlock): void {
    r.met = true;
    r.fzT0 = b.t0;
    r.fzT1 = b.t1;
    r.moments = freezeMoments(b.t1 - b.t0, this.lead);
    const F = this.plan.freeze;
    r.need = needFor(F, this.lead, this.pace) * (this.plan.test ? RULES.testNeed : 1) * (this.first && r.plan.slot === 0 ? RULES.firstNeed : 1);
    // a story told again offers the other way first ("the second time the freeze asks for the other way")
    const last = this.lastWay.get(r.story.id);
    r.firstWay = r.plan.round > 0 || last ? other(last ?? 'answer') : 'answer';
    this.emit({ type: 'freeze', slot: r.plan.slot });
  }

  private enterAfter(r: SlotRun, b: PlanBlock): void {
    const way = r.way ?? r.firstWay;
    r.parts = way === 'away' ? ['away', 'answer', 'outcome', 'lesson'] : ['answer', 'outcome', 'lesson'];
    const natural = r.parts.slice(0, -1).map(p => (p === 'away' ? r.plan.away : p === 'answer' ? r.plan.answer : r.plan.outcome));
    const dur = b.t1 - b.t0;
    const path = natural.reduce((a, x) => a + x, 0);
    // a short after (a test, a compact slot) tells its parts faster, the lesson keeps at least a share
    const room = Math.max(0, dur - Math.min(r.plan.lesson, dur * 0.25));
    const k = path > room ? room / path : 1;
    r.partDur = [...natural.map(x => x * k), Infinity];
    r.part = 0;
    r.partT0 = b.t0;
    this.emit({ type: 'part', part: r.parts[0] });
  }

  /** The block ends: a freeze takes its way (the first offered when none was picked) and time flows again. */
  private leave(b: PlanBlock): void {
    const r = b.slot >= 0 ? this.runs[b.slot] : null;
    if (!r) return;
    if (b.what === 'freeze') {
      if (!r.named) this.name(r, r.story.feel[0], 'auto');
      if (!r.way) {
        r.way = r.firstWay;
        r.wayBy = 'auto';
        this.emit({ type: 'chose', way: r.way, by: 'auto' });
      }
      this.lastWay.set(r.story.id, r.way);
      r.lines = r.story.second.length;
      this.paceSec += r.sighted;
      this.paceFocus += r.produced;
      this.emit({ type: 'flow', charged: r.charged });
    }
  }

  /** Move the schedule to the block at time `t` (late frames shorten the next, never the session). */
  private advance(): void {
    const B = this.plan.blocks;
    while (this.bi < B.length - 1 && this.t >= this.block.t1) {
      this.leave(this.block);
      this.bi++;
      this.enter(B[this.bi]);
    }
    this.blockT = Math.max(0, this.t - this.block.t0);
  }

  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started) return;
    const step = Math.max(0, Math.min(0.25, dt));
    this.t = now;
    this.advance();
    this.reliable = f.reliable;
    if (f.reliable) this.mean.push(f.level, step);
    this.rate = this.sighted && f.reliable ? focusRate(this.mean.value ?? f.level, f.focused, f.hold) : 0;
    this.rateShown = approach(this.rateShown, this.rate, step, RULES.showTau);
    this.calm = approach(this.calm, f.reliable ? f.calm : 0, step, 1.5);
    if (this.block.kind !== 'free') this.contrast.push(this.block.kind === 'push' ? 'focus' : 'rest', f.activity, f.reliable, this.blockT, step);
    const r = this.cur;
    switch (this.block.what) {
      case 'tell': if (r) this.updateTell(r); break;
      case 'freeze': if (r) this.updateFreeze(r, step, f.reliable); break;
      case 'after': if (r) this.updateAfter(r); break;
      default: break;
    }
    if (r) r.shown = approach(r.shown, r.clarity, step, this.reduced ? 0.05 : 0.35);
    this.updateLook(step);
  }

  // ── the tell ──────────────────────────────────────────────────

  private updateTell(r: SlotRun): void {
    const n = r.plan.beats.length;
    while (r.beat < n - 1 && this.t >= r.beatT0 + r.plan.beats[r.beat]) {
      r.beatT0 += r.plan.beats[r.beat];
      r.beat++;
      this.emitBeat(r);
    }
  }

  // ── the freeze: only focus charges the clarity ────────────────

  private updateFreeze(r: SlotRun, dt: number, reliable: boolean): void {
    const k = this.blockT, m = r.moments;
    const n = r.story.second.length;
    if (!r.charged) {
      if (this.sighted && reliable) {
        r.sighted += dt;
        r.produced += this.rate * dt;
      }
      if (this.rate > 0) {
        r.clarity = Math.min(1, r.clarity + (this.rate * dt) / Math.max(0.01, r.need));
        if (r.clarity >= 1) this.charge(r);
      }
    } else if (this.rate > 0) r.held += dt;
    if (k >= m.stopEnd) this.coach('focus');
    // name it: the feelings come after the stop and the first breath; the likeliest is named for the player later
    if (!r.chipsOpen && k >= m.nameAt) {
      r.chipsOpen = true;
      this.emit({ type: 'chips' });
      this.coach('name');
    }
    if (r.chipsOpen && !r.named && k >= m.autoNameAt) this.name(r, r.story.feel[0], 'auto');
    // a second look: once named, each line as the clarity passes its mark (and the line before had time to be read)
    if (r.named && r.lines < n) {
      const at = secondAt(n);
      const prev = r.lines > 0 ? readSecOf(r.text.second[r.lines - 1]) : 0;
      if (r.clarity >= at[r.lines] - 1e-9 && k - r.lineAt >= prev) this.line(r, k);
    }
    // the lines still dark come anyway before the choice (dim: the story still shows the way)
    if (r.lines < n && k >= m.chooseLate - RULES.lateLines) {
      if (!r.named) this.name(r, r.story.feel[0], 'auto');
      r.late = true;
      while (r.lines < n) this.line(r, k);
    }
    // the choice: once the clarity is full and every line has been read — or at the latest near the end
    if (!r.choicesOpen) {
      const lastRead = r.lines > 0 ? readSecOf(r.text.second[r.lines - 1]) * 0.6 : 0;
      const ready = r.charged && r.named && r.lines >= n && k - r.lineAt >= Math.max(RULES.chooseAfter, lastRead) && k - r.chargedAt >= RULES.chooseAfter;
      if (ready || k >= m.chooseLate) {
        r.choicesOpen = true;
        this.emit({ type: 'choices' });
        this.coach('choose');
      }
    }
  }

  private line(r: SlotRun, k: number): void {
    r.lineAt = k;
    this.emit({ type: 'line', i: r.lines });
    r.lines++;
  }

  private charge(r: SlotRun): void {
    r.clarity = 1;
    r.charged = true;
    r.chargedAt = this.blockT;
    this.mastered++;
    this.emit({ type: 'charged', slot: r.plan.slot, n: this.mastered });
  }

  private name(r: SlotRun, f: Feeling | undefined, by: 'player' | 'auto'): void {
    if (!f) return;
    r.named = f;
    r.namedBy = by;
    this.emit({ type: 'named', f, by });
  }

  // ── the after ─────────────────────────────────────────────────

  private updateAfter(r: SlotRun): void {
    while (r.part < r.parts.length - 1 && this.t >= r.partT0 + r.partDur[r.part]) {
      r.partT0 += r.partDur[r.part];
      r.part++;
      this.emit({ type: 'part', part: r.parts[r.part] });
    }
  }

  // ── the look of the scene ─────────────────────────────────────

  private updateLook(dt: number): void {
    const r = this.cur, w = this.block.what, R = RULES;
    let heat = 0, sat = 1, cool = 0, out = 0, flash = 0;
    if (w === 'tell' && r) heat = this.scene().heat;
    else if (w === 'freeze' && r) {
      const k = this.blockT;
      const drain = clamp(k / R.drainSec);
      const lit = 0.12 + 0.88 * clamp(r.shown);
      sat = 1 - drain * (1 - lit);
      cool = drain * (1 - 0.85 * clamp(r.shown));
      out = this.reduced ? (k > 0.5 ? 1 : 0) : ease(k / R.stepOutSec);
      flash = this.reduced ? 0 : clamp(1 - k / R.flashSec);
      heat = 0;
    } else if (w === 'after' && r) {
      heat = this.scene().heat;
      const k = this.t - r.fzT1;
      out = this.reduced ? 0 : 1 - ease(k / 1.6);
      sat = 0.12 + 0.88 * Math.max(clamp(r.shown), ease(k / 1.4));
      cool = (1 - ease(k / 1.4)) * (1 - 0.85 * clamp(r.shown));
    }
    this.heat = approach(this.heat, heat, dt, this.reduced ? 0.05 : 1.1);
    // the freeze's look is the freeze's clock itself; elsewhere it eases
    if (w === 'freeze') {
      this.sat = sat;
      this.cool = cool;
      this.out = out;
    } else {
      this.sat = w === 'after' ? sat : approach(this.sat, sat, dt, 0.4);
      this.cool = w === 'after' ? cool : approach(this.cool, cool, dt, 0.4);
      this.out = w === 'after' ? out : approach(this.out, out, dt, 0.3);
    }
    this.flash = flash;
    // the glow the runner's gauge shows: the clarity's pace in a sighted freeze
    let glow = 0;
    if (w === 'freeze' && r) {
      if (r.charged) glow = 0.82 + (this.rate > 0 ? 0.18 : 0);
      else if (this.sighted) {
        const pace = r.need / Math.max(1, this.plan.freeze - this.lead);
        glow = clamp((0.5 * this.rateShown) / Math.max(0.05, pace));
      } else glow = 0.15;
    }
    this.glow = approach(this.glow, glow, dt, this.reduced ? 0.05 : 0.4);
  }

  // ── input ─────────────────────────────────────────────────────

  /** The age card is open (the first session's opening, when the lobby was not touched). */
  get askOpen(): boolean {
    const P = this.plan;
    return this.started && this.block.what === 'intro' && P.askEnd > 0 && this.t >= P.openEnd && this.t < P.askEnd;
  }

  /** The opening page shown now (−1: none). */
  get openPage(): number {
    const P = this.plan;
    if (!this.started || this.block.what !== 'intro' || !(P.openEnd > 0) || this.t >= P.openEnd) return -1;
    return Math.min(openPages().length - 1, Math.floor(this.t / RULES.openSec));
  }

  /** Pick the age group on the opening card: the stories after the opening are planned for it. */
  pickAge(i: number): boolean {
    if (!this.askOpen || !Number.isInteger(i) || i < 0 || i >= AGES.length) return false;
    const a = AGES[i];
    setAge(this.p, a);
    this.picked = true;
    if (a !== this.age) {
      this.age = a;
      const intro = this.block;
      this.plan = planOf(this.p, { plannedSec: this.plannedSec, eeg: this.eeg, rhythm: this.rhythm, age: a, ask: true });
      // the opening keeps its times (the age card was planned): only the stories after it change
      this.plan.blocks[0] = intro;
      this.runs = this.buildRuns();
    }
    this.emit({ type: 'age', age: a });
    return true;
  }

  /** The feelings offered now (the story's, the likeliest first), or none. */
  get chips(): Feeling[] {
    const r = this.cur;
    if (this.block.what !== 'freeze' || !r || !r.chipsOpen || r.named) return [];
    return [...r.story.feel].slice(0, 4);
  }

  /** The ways offered now (the first is taken when none is picked). */
  get ways(): Way[] {
    const r = this.cur;
    if (this.block.what !== 'freeze' || !r || !r.choicesOpen) return [];
    return [r.firstWay, other(r.firstWay)];
  }

  /** A way's words on its button: the story's own words when it has them, else the calm answer's. */
  wayLabel(w: Way): string {
    const r = this.cur;
    if (w === 'away') return t('fz.away');
    const say = r?.text.answerSay;
    if (!say) return t('fz.calm');
    const q = { pl: ['„', '”'], en: ['“', '”'], de: ['„', '“'], sv: ['”', '”'] }[lang];
    return `${q[0]}${say}${q[1]}`;
  }

  /** Name the i-th feeling offered. */
  nameAt(i: number): boolean {
    const r = this.cur, c = this.chips;
    if (!r || !Number.isInteger(i) || i < 0 || i >= c.length) return false;
    this.name(r, c[i], 'player');
    this.p.named[c[i]] = (this.p.named[c[i]] ?? 0) + 1;
    return true;
  }

  /** Choose the i-th way offered (it can be changed while the freeze lasts). */
  choose(i: number): boolean {
    const r = this.cur, w = this.ways;
    if (!r || !Number.isInteger(i) || i < 0 || i >= w.length) return false;
    if (r.way === w[i] && r.wayBy === 'player') return true;
    r.way = w[i];
    r.wayBy = 'player';
    this.emit({ type: 'chose', way: w[i], by: 'player' });
    return true;
  }

  /**
   * Read on: the next beat of the tell (on its last beat the freeze begins now — never past FREEZE_MAX), the next part
   * of the after.  False when there is nothing to move on to.
   */
  next(): boolean {
    if (!this.started) return false;
    const r = this.cur, b = this.block;
    if (b.what === 'tell' && r) {
      if (r.beat < r.plan.beats.length - 1) {
        r.beat++;
        r.beatT0 = this.t;
        this.emitBeat(r);
        this.emit({ type: 'tap' });
        return true;
      }
      // the last beat: the freeze may start early (it then lasts longer, at most FREEZE_MAX)
      if (this.t >= freezeStartMin(r.plan) && this.t < b.t1 - 0.05) {
        const nb = this.plan.blocks[this.bi + 1];
        if (!nb || nb.what !== 'freeze') return false;
        b.t1 = this.t;
        nb.t0 = this.t;
        r.plan.tellEnd = this.t;
        this.emit({ type: 'tap' });
        this.advance();
        return true;
      }
      return false;
    }
    if (b.what === 'after' && r && r.part < r.parts.length - 1) {
      r.part++;
      r.partT0 = this.t;
      this.emit({ type: 'part', part: r.parts[r.part] });
      this.emit({ type: 'tap' });
      return true;
    }
    return false;
  }

  key(key: string, down: boolean): boolean {
    if (!down) return false;
    const digit = /^[1-9]$/.test(key) ? Number(key) - 1 : -1;
    if (this.askOpen) return digit >= 0 ? this.pickAge(digit) : false;
    if (this.chips.length && digit >= 0) return this.nameAt(digit);
    if (this.ways.length && digit >= 0) return this.choose(digit);
    if (key === ' ' || key === 'Enter') {
      if (this.chips.length) return this.nameAt(0);
      if (this.ways.length && !this.cur?.way) return this.choose(0);
      return this.next();
    }
    return false;
  }

  // ── what the runner reads ─────────────────────────────────────

  canStop(): boolean { return this.t >= this.T; }

  /** The runner's gauge: the clarity's glow in a freeze (null in the lead-in or without a signal), calm in a rest. */
  meter(): number | null {
    if (this.pushBlock) return this.reliable && (this.sighted || this.cur?.charged) ? clamp(this.glow) : null;
    if (this.restBlock) return this.reliable ? clamp(this.calm) : null;
    return null;
  }

  /** The next block is near: the tell's last beat before a freeze, or the last seconds of any block. */
  get telegraphed(): boolean {
    const next = this.plan.blocks[this.bi + 1];
    if (!next) return false;
    if (this.block.what === 'tell' && next.what === 'freeze') {
      const r = this.cur;
      return !!r && r.beat >= r.plan.beats.length - 1 && this.left <= Math.max(RULES.telegraph, 4);
    }
    return this.left <= RULES.telegraph && this.dur > RULES.telegraph + 1 && next.kind !== 'free';
  }

  get nextKind(): BlockKind | null {
    const n = this.plan.blocks[this.bi + 1];
    return n ? n.kind : null;
  }

  /** What the band asks now, in the panel's words. */
  get tip(): string {
    const r = this.cur;
    switch (this.block.what) {
      case 'intro': return t(this.askOpen ? 'task.ask' : 'task.intro');
      case 'tell': return t('task.tell');
      case 'freeze':
        if (r?.charged) return t('task.charged');
        return t(this.blockT < this.lead ? 'task.lead' : 'task.freeze');
      case 'after': return t(this.afterPart === 'lesson' ? 'task.lesson' : 'task.after');
      default: return t('task.close');
    }
  }

  /** The headline's second line. */
  get subLine(): string {
    const r = this.cur;
    if (this.phase === 'end' || this.block.what === 'close') return t('sub.end');
    if (this.block.what === 'freeze') return t('sub.freeze');
    if (r) return t('sub.story', { n: r.plan.slot + 1 });
    return AGE_SPAN[this.age];
  }

  coachWords(what: Coach, touch: boolean): string {
    switch (what) {
      case 'tap': return t(touch ? 'coach.tap' : 'coach.click');
      case 'name': return t(touch ? 'coach.name' : 'coach.nameClick');
      case 'choose': return t(touch ? 'coach.choose' : 'coach.chooseClick');
      default: return t('coach.focus');
    }
  }

  // ── what the scene shows ──────────────────────────────────────

  /** The beat on screen now (the opening and the close borrow a calm one). */
  scene(): SceneBeat {
    const r = this.cur, w = this.block.what;
    if (r && w === 'tell') return this.tellBeat(r, r.plan.from + r.beat);
    if (r && w === 'freeze') return this.tellBeat(r, r.story.beats.length - 1);
    if (r && w === 'after') {
      const part = r.parts[r.part] ?? 'answer';
      const last = r.story.beats[r.story.beats.length - 1];
      if (part === 'away') {
        return { place: last.place, people: last.people ?? [], prop: undefined, text: t('away.text'), say: t('away.say'), from: -1, heat: Math.min(0.3, last.heat * 0.4), far: true, key: `${r.story.id}:away` };
      }
      if (part === 'answer') {
        return {
          place: last.place, people: last.people ?? [], prop: last.prop, text: r.text.answer, say: r.text.answerSay, from: r.text.answerSay ? -1 : null,
          heat: Math.min(0.45, last.heat * 0.5), key: `${r.story.id}:answer`,
        };
      }
      const o = r.story.outcome;
      return {
        place: o.place, people: o.people ?? [], prop: o.prop, text: r.text.outcome.text, say: r.text.outcome.say, from: r.text.outcome.say ? o.from ?? 0 : null,
        screen: r.text.outcome.screen, heat: Math.min(0.3, o.heat), key: `${r.story.id}:outcome`,
      };
    }
    // the opening: the first story's first place, quiet; the close: the last outcome's place
    const pick = w === 'close' ? [...this.runs].reverse().find(x => x.met) ?? this.runs[0] : this.runs[0];
    if (pick) {
      const b = w === 'close' ? pick.story.outcome : pick.story.beats[0];
      return { place: b.place, people: w === 'close' ? b.people ?? [] : [], prop: undefined, text: '', from: null, heat: 0, key: `${pick.story.id}:${w}` };
    }
    return { place: 'street', people: [], text: '', from: null, heat: 0, key: w };
  }

  private tellBeat(r: SlotRun, i: number): SceneBeat {
    const b = r.story.beats[i], tx = r.text.beats[i];
    return {
      place: b.place, people: b.people ?? [], prop: b.prop, text: tx.text, say: tx.say, from: tx.say ? b.from ?? 0 : null, screen: tx.screen,
      heat: clamp(b.heat), title: i === r.plan.from && this.block.what === 'tell' && this.t - r.plan.t0 < RULES.titleSec + 2.5 ? r.text.title : undefined,
      key: `${r.story.id}:b${i}`,
    };
  }

  /** The passage on screen now: the root in the opening (after its pages and the age card), the close's after a while. */
  get verse(): PassageId | null {
    const w = this.block.what, P = this.plan;
    if (w === 'intro') return this.t >= Math.max(P.openEnd, P.askEnd) + 1.2 && this.left > 3 && !P.test ? ROOT : null;
    if (w === 'close') return this.blockK >= 0.35 ? this.closingVerse : null;
    return null;
  }

  // ── the session's numbers ─────────────────────────────────────

  get score(): number { return this.mastered; }
  /** stories met (their freeze began) */
  get met(): number { return this.runs.filter(r => r.met).length; }
  /** clarity held after the charges (s) */
  get held(): number { return this.runs.reduce((a, r) => a + r.held, 0); }
  /** the feelings named this session, in order, each once */
  get namedNow(): Feeling[] {
    return [...new Set(this.runs.filter(r => r.met && r.named).map(r => r.named!))];
  }
  /** the lessons of the stories met, each once, the latest last (at most `n`) */
  lessons(n = 3): string[] {
    return [...new Set(this.runs.filter(r => r.met).map(r => r.text.lesson))].slice(-n);
  }

  /** The closing passage: the last met story's own when it has one, else the session's turn of the closing passages. */
  get closingVerse(): PassageId {
    const last = [...this.runs].reverse().find(r => r.met);
    return last?.story.verse ?? inTurn(CLOSE_VERSES, this.session);
  }

  /** Settle the session once (the runner's finish()): the records, the pace, where the group's next session begins. */
  finish(): void {
    if (this.credited || !this.started) return;
    this.credited = true;
    const p = this.p;
    p.sessions = this.session;
    p.best = Math.max(p.best, this.mastered);
    p.mastered += this.mastered;
    p.told += this.met;
    p.held += this.held;
    p.pace = paceAfter(p.pace, this.paceFocus, this.paceSec);
    // the next session of this group begins after the last story met (or where this one would have begun)
    const met = this.runs.filter(r => r.met);
    const order = storiesFor(this.age, p.heavy);
    if (met.length && order.length) {
      const i = order.findIndex(s => s.id === met[met.length - 1].story.id);
      p.next[this.age] = order[(i + 1) % order.length].id;
    }
  }

  result(): ArcadeOutcome {
    const stats: [string, string][] = [];
    stats.push([t('stat.mastered'), t('stat.of', { n: this.mastered, of: this.met })]);
    stats.push([t('stat.held'), fmtClock(this.held)]);
    stats.push([t('stat.group'), AGE_SPAN[this.age]]);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    stats.push([t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })]);
    const highlights: string[] = [];
    const named = this.namedNow.map(f => feelWord(f));
    if (named.length) highlights.push(t('hl.named', { list: list(named) }));
    if (this.met >= 2 && this.mastered === this.met) highlights.push(t('hl.all'));
    if (this.held >= 10) highlights.push(t('hl.held', { t: fmtClock(this.held) }));
    for (const l of this.lessons(2)) highlights.push(t('hl.lesson', { lesson: l }));
    if (this.mastered === 0 && this.met > 0) highlights.push(t('hl.quiet'));
    const record = this.mastered > 0 && (this.bestBefore === null || this.mastered > this.bestBefore);
    if (record && this.bestBefore !== null) highlights.push(t('hl.record'));
    return { score: this.mastered, unit: unit(this.mastered), record, stats, highlights, verse: this.closingVerse };
  }

  /** For tests and the debug view. */
  get debug(): Record<string, unknown> {
    const r = this.cur;
    return {
      block: `${this.block.kind}:${this.block.what}`, t: Math.round(this.t), blockT: Math.round(this.blockT * 10) / 10,
      story: r ? `${r.story.id}:${Math.round(r.clarity * 100)}:${r.charged ? 'charged' : '-'}` : '-', mastered: this.mastered, age: this.age,
    };
  }
}

/** A second look's line is read in this long (s) before the next may come. */
const readSecOf = (s: string | undefined): number => beatSec(len(s)) * 0.6;

/** Seconds as m:ss (or "12 s"). */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return t('sec', { n: s });
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A passage's text (for the view's reading time). */
export const verseText = (id: PassageId): string => passage(id).text;
export { readTime };
