/**
 * Odnowa's rules without a screen.  Inside one stem cell, each stage of the session is one division, and a
 * division needs three things, the way a real cell does before it divides:
 *
 *   energy       ATP from the mitochondria: the respiratory chain pumps protons across the inner membrane and
 *                the ATP synthase turns on their way back, 8 protons a turn, 3 ATP a turn (Watt et al. 2010).
 *                In a sighted push the band's level drives the gradient (the panel's gauge, its middle the
 *                threshold), the gradient drives the turbine: × 1.8 at the threshold, × 2.6 at full; a held
 *                focus charges Pełna moc (full power: the turbine at × 2.5 and every open lesion mended)
 *   material     building blocks from autophagy: in a rest block worn parts are tagged, wrapped in a
 *                phagophore (calm wraps faster), carried to a lysosome and digested back into material
 *   a checked    the double helix scrolls past the scanner; damage glows on it, a tap sends the real crew
 *   genome       (base excision, nucleotide excision, end joining); an unrepaired lesion stops the helix at the
 *                gate, where the cell's own crew mends it after a while — the scan goes fast on a clean helix
 *
 * All three met and no lesion open (the checkpoint) → mitosis; one daughter stays a stem cell, the other
 * joins the player's tissue (the meta).  Nothing is ever lost: without a signal everything runs at its
 * neutral pace, an unrepaired lesion waits for the cell's crew, a full power that is not taken goes by itself.
 * The headline is the ATP made.  No DOM: the view and the sound read the state and the event queue (`take()`).
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CARD_IDS, LESIONS, NICHE, PART, PART_KINDS, TIPS, cellName, lines,
  type CardId, type LesionKind, type NicheId, type PartKind, type StepId,
} from './content';
import { atpText, t } from './i18n';
import { bestFor, enzymeLevel, lenKey, lysoLevel, mitoLevel, sessionNiche, type OdnowaProgress, type Trait } from './meta';
import { RULES, need } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';

export type LesionState = 'open' | 'wait' | 'fixing' | 'done';
export type Crew = 'tap' | 'cell' | 'surge';
export interface Lesion {
  id: number;
  kind: LesionKind;
  /** position on the lane (0 = the left edge, RULES.laneU = the right edge) */
  u: number;
  state: LesionState;
  /** the repair's stage (a two-step repair has two) and the step in it, seconds into that step */
  stage: number;
  step: number;
  st: number;
  /** who mends it (set when a crew starts) */
  by: Crew;
  /** seconds on the lane, seconds since mended, seconds held at the gate */
  t: number;
  done: number;
  gate: number;
  /** delay before a surge's crew starts (a cascade) */
  delay: number;
  seed: number;
}

export type PartPhase = 'tag' | 'wrap' | 'sealed' | 'travel' | 'fuse' | 'digest' | 'done';
export interface Part {
  id: number;
  kind: PartKind;
  /** the city spot it appeared at and the lysosome it goes to (the view places both) */
  spot: number;
  lyso: number;
  phase: PartPhase;
  /** progress through the phase (0..1) */
  k: number;
  /** seconds since it appeared, seconds since done */
  t: number;
  done: number;
  /** a finger holds it (the travel waits) */
  held: boolean;
  seed: number;
}

export interface Mitosis { t: number; phase: number; niche: NicheId }
export type StoryKind = 'open';
export interface Story { kind: StoryKind; t: number; dur: number }
export interface CellCard { niche: NicheId; n: number; t: number; dur: number; card: CardId | null }

export type Coach = 'lane' | 'turbine' | 'recipe' | 'gauge' | 'two' | 'rest' | 'drag' | 'surge' | 'check' | 'blind';
export type CoachAt = { kind: 'lesion'; id: number } | { kind: 'lens' } | { kind: 'part'; id: number } | { kind: 'recipe' } | { kind: 'lane' };

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'atp'; src: number }
  | { type: 'atpUse'; n: number; u: number }
  | { type: 'kick' }
  | { type: 'spawn'; id: number; kind: LesionKind }
  | { type: 'repairStart'; id: number; kind: LesionKind; by: Crew; combo: number; stage: number }
  | { type: 'repairStep'; id: number; step: StepId }
  | { type: 'wait'; id: number }
  | { type: 'repaired'; id: number; kind: LesionKind; by: Crew; combo: number }
  | { type: 'gate'; id: number }
  | { type: 'miss' }
  | { type: 'part'; id: number; kind: PartKind }
  | { type: 'sealed'; id: number }
  | { type: 'fuse'; id: number; lyso: number; sent: boolean }
  | { type: 'recycled'; id: number; kind: PartKind; mat: number; lyso: number }
  | { type: 'ready' }
  | { type: 'surge' }
  | { type: 'surgeEnd' }
  | { type: 'checkpoint' }
  | { type: 'divide'; stage: number; niche: NicheId }
  | { type: 'mitosis'; phase: number }
  | { type: 'cell'; niche: NicheId; stage: number }
  | { type: 'card'; id: CardId }
  | { type: 'up'; trait: Trait; level: number }
  | { type: 'story'; kind: StoryKind }
  | { type: 'blindEnd'; share: number }
  | { type: 'coach'; what: Coach; at: CoachAt };

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

/** The last stretch without a block. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The session's blocks: a first-ever session opens with a warm-up that teaches the hands (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test), then pushes and rests (26 ± 4 s and 22 ± 3 s, scaled to end on
 * time, jittered when there is room) ending with a rest, then the last stretch.  No block under 12 s.
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

/** A division's recipe at a stage: ATP made, building material, genome scanned (units). */
export function recipe(stage: number): { atp: number; mat: number; scan: number } {
  return { atp: need(RULES.atpNeed, stage, true), mat: need(RULES.matNeed, stage, false), scan: need(RULES.scanNeed, stage, false) };
}

/** The turbine's turns a second from the gradient (0..1). */
export const spinOf = (grad: number): number => RULES.spinBase + RULES.spinK * clamp(grad);

/** The gradient from the gauge (the band's level, 0..1): the neutral floor, never below it — a low reading is never a loss. */
export const gradOf = (gauge: number): number => RULES.gradNeutral + (1 - RULES.gradNeutral) * clamp(gauge);

/** The seconds of one repair step: the enzymes' level and the gradient speed it, the cell's own crew is slower, a surge's fast. */
export function stepSec(enzymes: number, grad: number, by: Crew): number {
  const base = RULES.step * RULES.enzymeK ** Math.max(0, enzymes) / (RULES.stepFocus[0] + RULES.stepFocus[1] * clamp(grad));
  return by === 'cell' ? base * 1.6 : by === 'surge' ? base * 0.45 : base;
}

/** A weighted pick from `w` (keys with weight > 0). */
function weighted<K extends string>(w: Readonly<Partial<Record<K, number>>>, rnd: () => number): K {
  const keys = (Object.keys(w) as K[]).filter(k => (w[k] ?? 0) > 0);
  const sum = keys.reduce((s, k) => s + (w[k] ?? 0), 0);
  let r = rnd() * sum;
  for (const k of keys) {
    r -= w[k] ?? 0;
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: OdnowaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** play a given niche (the screenshot scripts; otherwise the progress chooses) */
  niche?: NicheId;
}

export class OdnowaSim {
  readonly p: OdnowaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  readonly talk: Talk;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly holdNeed: number;
  private readonly restLead: number;
  readonly finaleSec: number;
  readonly session: number;
  readonly niche: NicheId;
  readonly plan: Block[];

  started = false;
  phase: Phase = 'play';
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  t = 0;
  tip = '';
  story: Story | null = null;
  cellCard: CellCard | null = null;
  /** hit-stop (s left): the world holds for a beat on a big moment */
  stop = 0;
  /** the view shows a card of its own (a Wiedza toast): Mito waits with his next line */
  holdTalk = false;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the gauge: the band's eased level in a sighted push (0..1, 0.5 at the threshold) */
  gauge = 0;
  /** the proton gradient (0..1) that turns the turbine */
  grad: number = RULES.gradNeutral;
  maxHold = 0;
  private goodT = 0;
  private goodSaid = false;
  private relSec = 0;
  private pushTips = 0;

  // the engine
  /** the turbine's angle (turns) and its spin (turns per second) */
  angle = 0;
  spin: number = spinOf(RULES.gradNeutral);
  private kickLeft = 0;
  private kickCool = 0;
  kicks = 0;
  private extraAcc = 0;
  /** the full power: charge 0..1, ready, seconds left */
  charge = 0;
  ready = false;
  surge = 0;
  private readyT = 0;

  // the lane
  readonly lesions: Lesion[] = [];
  /** the scan's total travel (units) and its speed now (units/s) */
  scanned = 0;
  scanV = 0;
  private nextAt = 0;
  private nextId = 1;
  combo = 0;
  maxCombo = 0;
  private lastTap = -99;
  private dsbStage = 0;
  private warmLesions = 0;

  // the clean-up
  readonly parts: Part[] = [];
  private partT = 0;
  private nextSide = 0;

  // the division
  stage = 1;
  stageAtp = 0;
  material = 0;
  scan = 0;
  checkpoint = false;
  mitosis: Mitosis | null = null;
  private checkSaid = 0;
  /** seconds without a line from Mito (a quiet stretch earns a fact) */
  private quiet = 0;

  // the session's numbers
  atp = 0;
  repairsNow = 0;
  tapRepairs = 0;
  partsNow = 0;
  divisionsNow = 0;
  surgesNow = 0;
  readonly logNow: Record<LesionKind, number> = { oxo: 0, abasic: 0, dimer: 0, bulky: 0, dsb: 0 };
  readonly cellsNow: Record<NicheId, number> = { gut: 0, skin: 0, blood: 0 };
  readonly cardsNow: CardId[] = [];
  readonly upsNow: Trait[] = [];
  passedRests = 0;
  passedPushes = 0;
  blindShare = -1;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  /** the traits' levels as the session began (a level-up mid-session is announced once) */
  private readonly lv: Record<Trait, number>;

  constructor(init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.holdNeed = RULES.holdNeed[band];
    this.restLead = RULES.restLead[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.bestBefore = bestFor(p, init.plannedSec);
    this.niche = init.niche ?? sessionNiche(p);
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(lines(), init.rng);
    this.lv = { mito: mitoLevel(p), enzyme: enzymeLevel(p), lyso: lysoLevel(p) };
    this.nextAt = 0.6;
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get playing(): boolean { return this.phase === 'play'; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.playing; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.playing; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.playing; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.playing; }
  /** a sighted push past its lead-in: the gradient answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  /** a card holds the world */
  get frozen(): boolean { return !!this.story; }
  get recipe(): { atp: number; mat: number; scan: number } { return recipe(this.stage); }
  /** how far the division is (0..1): the mean of the three parts of its recipe */
  get progress(): number {
    const r = this.recipe;
    return (clamp(this.stageAtp / r.atp) + clamp(this.material / r.mat) + clamp(this.scan / r.scan)) / 3;
  }
  get readyToDivide(): boolean {
    const r = this.recipe;
    return this.stageAtp >= r.atp && this.material >= r.mat && this.scan >= r.scan;
  }
  /** lifetime totals with this session's (until it is settled) */
  life(k: 'atp' | 'repairs' | 'recycled'): number {
    const add = this.settled ? 0 : k === 'atp' ? this.atp : k === 'repairs' ? this.repairsNow : this.partsNow;
    return (k === 'atp' ? this.p.atpTotal : k === 'repairs' ? this.p.repairs : this.p.recycled) + add;
  }
  get mitoCount(): number { return mitoLevel({ atpTotal: this.life('atp') }); }
  get enzymes(): number { return enzymeLevel({ repairs: this.life('repairs') }); }
  get lysoCount(): number { return lysoLevel({ recycled: this.life('recycled') }); }
  /** lesions that still need a crew (open, or a two-step one waiting for its second tap) */
  get openLesions(): Lesion[] { return this.lesions.filter(l => (l.state === 'open' || l.state === 'wait') && l.u < RULES.laneU); }
  /** the lesion held at the gate (the helix waits for it), if any */
  get atGate(): Lesion | null { return this.lesions.find(l => (l.state === 'open' || l.state === 'wait') && l.u <= RULES.gateU) ?? null; }

  // ── start and input ─────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.session === 1) {
      this.story = { kind: 'open', t: 0, dur: RULES.openSec };
      this.emit({ type: 'story', kind: 'open' });
    }
    // a lesion is in sight at once, so the hands have something to do (and the coach something to show)
    this.spawnLesion(7.2);
    this.startBlock(0);
    this.talk.ask(this.session === 1 ? 'first' : 'open', 2, 14);
  }

  /** A tap closes the story card (after a moment); true when it was used. */
  tap(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= 0.6) this.closeStory();
      return true;
    }
    return false;
  }

  private closeStory(): void {
    this.story = null;
    this.talk.clear();
  }

  /** A tap on the lane at `u`: the lesion that needs a crew nearest it (within reach), else the most urgent. */
  tapLane(u: number): boolean {
    if (!this.canTouch()) return false;
    const open = this.openLesions;
    if (!open.length) {
      this.emit({ type: 'miss' });
      return false;
    }
    let best: Lesion | null = null, d = Infinity;
    for (const l of open) {
      const dd = Math.abs(l.u - u);
      if (dd < d) {
        d = dd;
        best = l;
      }
    }
    if (!best || d > RULES.tapReach) best = this.urgent();
    return best ? this.crew(best, 'tap') : false;
  }

  /** Space, or a tap on the free city: the most urgent lesion (the one nearest the gate). */
  repairNext(): boolean {
    if (!this.canTouch()) return false;
    const l = this.urgent();
    if (!l) {
      this.emit({ type: 'miss' });
      return false;
    }
    return this.crew(l, 'tap');
  }

  private urgent(): Lesion | null {
    let best: Lesion | null = null;
    for (const l of this.openLesions) if (!best || l.u < best.u) best = l;
    return best;
  }

  private canTouch(): boolean { return this.started && this.phase !== 'done' && !this.frozen; }

  /** A tap on the turbine: the full power when it is ready, else a kick (one proton's step, 1/8 of a turn). */
  tapTurbine(): 'surge' | 'kick' | null {
    if (!this.canTouch()) return null;
    if (this.ready && this.releaseSurge()) return 'surge';
    if (this.kickCool > 0) return null;
    this.kickCool = RULES.kickCool;
    this.kickLeft += 1 / RULES.protonsPerTurn;
    this.kicks++;
    this.emit({ type: 'kick' });
    if (this.kicks === 6 || this.kicks % 25 === 0) this.talk.ask('kick', 1, 4);
    return 'kick';
  }

  /** Space and Enter: close a card, take a ready full power, mend the most urgent lesion, or kick the turbine. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const space = k === ' ' || k === 'Enter' || k === 'Spacebar';
    if (!space) return false;
    if (!down) return true;
    if (this.tap()) return true;
    if (this.ready && this.releaseSurge()) return true;
    if (this.urgent()) this.repairNext();
    else this.tapTurbine();
    return true;
  }

  /** Send an autophagosome to its lysosome at once (a tap on it); true when it went. */
  sendPart(id: number): boolean {
    const pt = this.parts.find(x => x.id === id);
    if (!pt || !this.canTouch() || (pt.phase !== 'sealed' && pt.phase !== 'travel')) return false;
    pt.held = false;
    this.fuse(pt, pt.lyso, true);
    return true;
  }

  /** A finger picks an autophagosome up (its travel waits), or lets it go. */
  holdPart(id: number, held: boolean): void {
    const pt = this.parts.find(x => x.id === id);
    if (pt && (pt.phase === 'sealed' || pt.phase === 'travel')) pt.held = held;
  }

  /** An autophagosome dropped on a lysosome fuses with it at once. */
  dropPart(id: number, lyso: number): boolean {
    const pt = this.parts.find(x => x.id === id);
    if (!pt || !this.canTouch() || (pt.phase !== 'sealed' && pt.phase !== 'travel')) return false;
    pt.held = false;
    this.fuse(pt, clamp(Math.round(lyso), 0, this.lysoSlots - 1), true);
    return true;
  }

  /** How many lysosomes the city has now (two, one more at the top lysosome level). */
  get lysoSlots(): number { return RULES.lysos + (this.lysoCount >= 3 ? 1 : 0); }

  // ── the frame ───────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.stop = Math.max(0, this.stop - dt);
    const w = this.frozen || this.stop > 0 ? 0 : dt;
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    }
    if (this.cellCard) {
      this.cellCard.t += dt;
      if (this.cellCard.t >= this.cellCard.dur) this.cellCard = null;
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec && !this.mitosis) this.endFinale();
    if (w > 0 && this.phase !== 'done') {
      this.engine(w);
      this.lane(w);
      this.cleanup(w, f);
      this.division(w);
    }
    this.tutor();
    this.talk.update(dt, t, this.talkBlocked);
    // a quiet stretch: Mito shares a fact (lowest priority, a short shelf life)
    if (this.talk.line) this.quiet = 0;
    else this.quiet += dt;
    if (this.quiet > 16 && this.phase === 'play' && !this.frozen) {
      this.quiet = 0;
      this.talk.ask('fact', 0, 8);
    }
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && !!b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return tele || banner || !!this.story || !!this.cellCard || this.holdTalk;
  }

  /** The band's slow quantities: the gauge and the gradient, the full power's charge, the calm shown. */
  private brain(dt: number, w: number, f: FocusFrame): void {
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    if (this.playing && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    this.gauge = approach(this.gauge, live ? clamp(f.level) : 0, dt, RULES.gradTau);
    const target = live ? gradOf(this.gauge) : this.restBlock ? RULES.gradRest : RULES.gradNeutral;
    this.grad = approach(this.grad, this.surge > 0 ? 1 : target, dt, RULES.gradTau);
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed && w > 0) this.addCharge(RULES.holdRate * dt);
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= 6 && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
      this.card('pmf');
    }
    if (live && this.blockT >= this.lead + 1) this.coach('gauge', { kind: 'lens' });
    // a ready full power waits for a tap, then goes by itself — never in a rest (the cell rests), nor so late in a
    // push that the rest would cut it short
    const room = this.pushBlock ? this.block.dur - this.blockT >= RULES.surgeSec : !this.restBlock;
    if (this.ready && w > 0 && room) {
      this.readyT += w;
      if (this.readyT >= RULES.surgeAuto) this.releaseSurge();
    }
  }

  private addCharge(v: number): void {
    if (this.ready || this.surge > 0 || !(v > 0)) return;
    // a rest never fills it: full power waits for the engine to run again
    this.charge = Math.min(this.restBlock ? 0.99 : 1, this.charge + v);
    if (this.charge >= 1 - 1e-9) {
      this.charge = 1;
      this.ready = true;
      this.readyT = 0;
      this.emit({ type: 'ready' });
      this.talk.ask('ready', 3, 5);
      this.coach('surge', { kind: 'lens' });
    }
  }

  /** Pełna moc: the turbine at full gradient and × 2.5 for a few seconds, every open lesion mended in a cascade. */
  releaseSurge(): boolean {
    if (!this.ready || this.restBlock || this.frozen || this.phase === 'done') return false;
    this.ready = false;
    this.charge = 0;
    this.readyT = 0;
    this.surge = RULES.surgeSec;
    this.surgesNow++;
    this.stop = Math.max(this.stop, 0.1);
    let k = 0;
    for (const l of this.openLesions.sort((a, b) => a.u - b.u)) {
      l.delay = 0.12 * k++;
      this.crew(l, 'surge');
    }
    this.emit({ type: 'surge' });
    this.talk.ask('surge', 3, 4);
    this.card('speed');
    return true;
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= RULES.bannerSec && this.blockT - dt < RULES.bannerSec) this.coach('rest', { kind: 'lens' });
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
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
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('blind', { kind: 'lens' });
      this.card('pumps');
    } else if (b.kind === 'rest') {
      this.partT = RULES.partEvery * 0.5;
      // the rest calms the engine: a full power still running ends here
      if (this.surge > 0) {
        this.surge = 0;
        this.emit({ type: 'surgeEnd' });
      }
      this.talk.ask('rest', 2, 12);
    } else this.talk.ask('warm', 1, 10);
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup();
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind()[(this.session + i) % TIPS.blind().length];
      if (first && this.pushesBase === 0) return TIPS.firstPush();
      const all = TIPS.push();
      return all[(this.session - 1 + this.pushTips++) % all.length];
    }
    if (first && this.session === 1) return TIPS.firstRest();
    const all = TIPS.rest();
    return all[(this.session - 1 + i) % all.length];
  }

  /** The block's end: its verdict and its small gift — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0, needShare = 0;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      needShare = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        // the reveal: the share of the block above the threshold charges the full power
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.addCharge(s * RULES.blindCharge);
        this.emit({ type: 'blindEnd', share: s });
      } else if (b.kind === 'push' && verdict) {
        this.passedPushes++;
        this.addCharge(0.15);
      }
      if (b.kind === 'rest' && verdict) {
        // a deep clean-up: a little extra building material
        this.passedRests++;
        this.material += 2;
        this.talk.ask('calm', 2, 6);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need: needShare });
  }

  // ── the engine ──────────────────────────────────────────────────
  private engine(w: number): void {
    if (this.surge > 0) {
      this.surge -= w;
      if (this.surge <= 0) {
        this.surge = 0;
        this.emit({ type: 'surgeEnd' });
      }
    }
    this.kickCool = Math.max(0, this.kickCool - w);
    const target = spinOf(this.grad) * (this.surge > 0 ? RULES.surgeK : 1) * (this.mitosis ? 0.7 : 1);
    this.spin = approach(this.spin, target, w, RULES.spinTau);
    let turn = this.spin * w;
    if (this.kickLeft > 0) {
      const k = Math.min(this.kickLeft, w * 1.6);
      this.kickLeft -= k;
      turn += k;
    }
    const before = Math.floor(this.angle * RULES.atpPerTurn);
    this.angle += turn;
    const made = Math.floor(this.angle * RULES.atpPerTurn) - before;
    for (let i = 0; i < made; i++) this.makeAtp(0);
    // the extra mitochondria (biogenesis): each a quarter of the big turbine's output
    const extra = this.mitoCount;
    if (extra > 0) {
      this.extraAcc += turn * RULES.atpPerTurn * RULES.mitoShare * extra;
      while (this.extraAcc >= 1) {
        this.extraAcc -= 1;
        this.makeAtp(1 + Math.floor(this.rng() * extra));
      }
    }
  }

  private makeAtp(src: number): void {
    const lvBefore = this.mitoCount;
    this.atp++;
    this.stageAtp++;
    this.emit({ type: 'atp', src });
    if (this.atp === 3) this.card('turbine');
    if (this.atp === 500) this.card('daily');
    if (this.life('atp') >= 1000) this.card('glucose');
    if (this.atp === 60) this.card('powerhouse');
    const lv = this.mitoCount;
    if (lv > lvBefore) this.levelUp('mito', lv);
  }

  private levelUp(trait: Trait, level: number): void {
    if (level <= this.lv[trait]) return;
    this.lv[trait] = level;
    this.upsNow.push(trait);
    this.emit({ type: 'up', trait, level });
    this.talk.ask(trait === 'mito' ? 'upMito' : trait === 'enzyme' ? 'upEnzyme' : 'upLyso', 3, 8);
    if (trait === 'mito') this.card('biogenesis');
  }

  // ── the DNA lane ────────────────────────────────────────────────
  private lane(w: number): void {
    const R = RULES;
    const gate = this.atGate;
    const open = this.openLesions.length > 0;
    const v = this.mitosis ? 0 : gate ? 0 : open ? R.scanSlow : R.scanFast;
    this.scanV = approach(this.scanV, v, w, 0.25);
    const du = this.scanV * w;
    this.scanned += du;
    if (!this.mitosis) this.scan += du;
    for (const l of this.lesions) {
      l.u -= du;
      l.t += w;
    }
    // the gate: the helix waits, and the cell's own crew comes
    if (gate) {
      if (gate.gate === 0) this.emit({ type: 'gate', id: gate.id });
      gate.gate += w;
      if (gate.gate >= R.gateFix) {
        this.crew(gate, 'cell');
        this.talk.ask('gate', 1, 4);
      }
    }
    // new damage comes in from the right as the scan moves on, now and then two from one oxidative burst
    if (this.scanned >= this.nextAt && !this.mitosis) {
      const k = this.restBlock ? R.restGapK : this.warmBlock ? R.warmGapK : 1;
      const room = R.laneCap - this.openLesions.length;
      if (room > 0) this.spawnLesion(R.laneU + 0.35);
      if (room > 1 && !this.restBlock && !this.warmBlock && this.rng() < R.cluster) {
        this.spawnLesion(R.laneU + 0.35 + R.clusterGap[0] + this.rng() * (R.clusterGap[1] - R.clusterGap[0]));
      }
      this.nextAt = this.scanned + (R.gap[0] + this.rng() * (R.gap[1] - R.gap[0])) * k;
    }
    // the crews at work
    for (const l of this.lesions) {
      if (l.state === 'fixing') this.work(l, w);
      else if (l.state === 'done') l.done += w;
    }
    for (let i = this.lesions.length - 1; i >= 0; i--) {
      const l = this.lesions[i];
      if ((l.state === 'done' && l.done > 1.2 && l.u < -0.5) || l.u < -2) this.lesions.splice(i, 1);
    }
    if (this.combo > 0 && this.t - this.lastTap > R.comboSec) this.combo = 0;
  }

  /** The damage the session's niche brings (a double-strand break now and then from the second stage). */
  private pickKind(): LesionKind {
    if (this.session === 1 && this.warmBlock) return this.warmLesions++ < 3 ? 'oxo' : 'abasic';
    if (this.stage >= RULES.dsbFrom && this.dsbStage !== this.stage && this.rng() < RULES.dsbChance) {
      this.dsbStage = this.stage;
      return 'dsb';
    }
    return weighted(NICHE[this.niche].mix, this.rng);
  }

  private spawnLesion(u: number): void {
    const kind = this.pickKind();
    const l: Lesion = { id: this.nextId++, kind, u, state: 'open', stage: 0, step: 0, st: 0, by: 'tap', t: 0, done: 0, gate: 0, delay: 0, seed: this.rng() };
    this.lesions.push(l);
    this.emit({ type: 'spawn', id: l.id, kind });
    if (LESIONS[kind].stages.length > 1) this.coach('two', { kind: 'lesion', id: l.id });
    if (kind === 'dsb') this.talk.ask('dsb', 3, 6);
  }

  /** A crew starts (or a two-step repair takes its second step). */
  private crew(l: Lesion, by: Crew): boolean {
    if (l.state !== 'open' && l.state !== 'wait') return false;
    l.state = 'fixing';
    l.by = by;
    l.step = 0;
    l.st = -RULES.crewIn - (by === 'surge' ? l.delay : 0);
    l.gate = 0;
    if (by === 'tap') {
      this.combo = this.t - this.lastTap <= RULES.comboSec ? Math.min(RULES.comboMax, this.combo + 1) : 1;
      this.lastTap = this.t;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (this.combo >= 3) this.addCharge(RULES.comboCharge);
      if (this.combo === 4 || this.combo === 8) this.talk.ask('combo', 2, 3);
    }
    this.emit({ type: 'repairStart', id: l.id, kind: l.kind, by, combo: by === 'tap' ? this.combo : 0, stage: l.stage });
    return true;
  }

  private work(l: Lesion, w: number): void {
    const spec = LESIONS[l.kind];
    const steps = spec.stages[l.stage];
    const sec = stepSec(this.enzymes, this.grad, l.by);
    l.st += w;
    while (l.st >= sec && l.state === 'fixing') {
      l.st -= sec;
      this.emit({ type: 'repairStep', id: l.id, step: steps[l.step] });
      l.step++;
      if (l.step >= steps.length) {
        l.stage++;
        l.step = 0;
        if (l.stage >= spec.stages.length) this.mended(l);
        else if (l.by === 'tap') {
          l.state = 'wait';
          this.emit({ type: 'wait', id: l.id });
          if (!this.talk.has('two') && this.rng() < 0.5) this.talk.ask('two', 1, 3);
        }
        // the cell's own crew and a surge's take the next step at once
        else l.st = 0;
      }
    }
  }

  private mended(l: Lesion): void {
    const spec = LESIONS[l.kind];
    const lv = this.enzymes;
    l.state = 'done';
    l.done = 0;
    this.repairsNow++;
    this.logNow[l.kind]++;
    if (l.by === 'tap') this.tapRepairs++;
    this.emit({ type: 'repaired', id: l.id, kind: l.kind, by: l.by, combo: l.by === 'tap' ? this.combo : 0 });
    this.emit({ type: 'atpUse', n: spec.atp, u: l.u });
    this.card('lesions');
    this.card(spec.path === 'ber' ? 'ber' : spec.path === 'ner' ? 'ner' : 'dsb');
    if (l.kind === 'dimer') this.card('uv');
    if (this.life('repairs') >= 50) this.card('fidelity');
    if (this.repairsNow === 1 || (this.rng() < 0.18 && l.by === 'tap')) this.talk.ask('repair', 1, 3);
    if (this.enzymes > lv) this.levelUp('enzyme', this.enzymes);
  }

  // ── the clean-up (autophagy) ────────────────────────────────────
  private cleanup(w: number, f: FocusFrame): void {
    const R = RULES;
    const lyK = R.lysoK ** this.lysoCount;
    // new worn parts appear in a rest block, one spot at a time
    if (this.restBlock && !this.mitosis) {
      this.partT += w;
      const busy = this.parts.filter(p => p.phase !== 'done').length;
      if (busy < R.partCap && this.partT >= R.partEvery) {
        const used = new Set(this.parts.filter(p => p.phase !== 'done').map(p => p.spot));
        const free = [0, 1, 2, 3].filter(s => !used.has(s));
        // alternate the sides (spots 0/1 left, 2/3 right) so both lysosomes work
        const side = free.filter(s => (s >> 1) === this.nextSide);
        const spot = (side.length ? side : free)[Math.floor(this.rng() * (side.length || free.length))];
        if (spot !== undefined) {
          this.nextSide = 1 - (spot >> 1);
          this.partT = 0;
          const kind = this.session === 1 && this.partsNow === 0 && !this.parts.length ? 'mito' : weighted(Object.fromEntries(PART_KINDS.map(k => [k, PART[k].weight])) as Record<PartKind, number>, this.rng);
          const pt: Part = { id: this.nextId++, kind, spot, lyso: (spot >> 1) % this.lysoSlots, phase: 'tag', k: 0, t: 0, done: 0, held: false, seed: this.rng() };
          this.parts.push(pt);
          this.emit({ type: 'part', id: pt.id, kind });
        }
      }
    }
    // calm wraps; without a signal at the neutral pace, never slower
    const rest = this.restBlock && this.blockT >= this.restLead;
    const calmK = rest && f.reliable ? clamp(f.calm) : 0;
    const wrapping = this.restBlock || this.phase === 'finale';
    const wrapRate = R.wrapRate * lyK * (R.wrapNeutral + (1 - R.wrapNeutral) * calmK);
    for (const pt of this.parts) {
      pt.t += w;
      switch (pt.phase) {
        case 'tag':
          pt.k += w / R.tagSec;
          if (pt.k >= 1) this.phaseOf(pt, 'wrap');
          break;
        case 'wrap':
          if (wrapping) pt.k += wrapRate * w;
          if (pt.k >= 1) {
            this.phaseOf(pt, 'sealed');
            this.emit({ type: 'sealed', id: pt.id });
            this.coach('drag', { kind: 'part', id: pt.id });
          }
          break;
        case 'sealed':
          if (!pt.held) pt.k += w / 0.7;
          if (pt.k >= 1) this.phaseOf(pt, 'travel');
          break;
        case 'travel':
          if (!pt.held) pt.k += w / R.travelSec;
          if (pt.k >= 1) this.fuse(pt, pt.lyso, false);
          break;
        case 'fuse':
          pt.k += w / R.fuseSec;
          if (pt.k >= 1) this.phaseOf(pt, 'digest');
          break;
        case 'digest':
          pt.k += (w / R.digestSec) * lyK;
          if (pt.k >= 1) this.recycle(pt);
          break;
        case 'done':
          pt.done += w;
          break;
      }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) if (this.parts[i].phase === 'done' && this.parts[i].done > 1.5) this.parts.splice(i, 1);
  }

  private phaseOf(pt: Part, phase: PartPhase): void {
    pt.phase = phase;
    pt.k = 0;
  }

  private fuse(pt: Part, lyso: number, sent: boolean): void {
    pt.lyso = lyso;
    this.phaseOf(pt, 'fuse');
    this.emit({ type: 'fuse', id: pt.id, lyso, sent });
  }

  private recycle(pt: Part): void {
    const lv = this.lysoCount;
    const mat = PART[pt.kind].mat;
    this.phaseOf(pt, 'done');
    pt.done = 0;
    this.material += mat;
    this.partsNow++;
    this.emit({ type: 'recycled', id: pt.id, kind: pt.kind, mat, lyso: pt.lyso });
    this.card('autophagy');
    if (pt.kind === 'mito') this.card('mitophagy');
    if (this.life('recycled') >= 3) this.card('lysosome');
    if (this.partsNow === 1 || this.rng() < 0.35) this.talk.ask('recycle', 1, 4);
    if (this.lysoCount > lv) this.levelUp('lyso', this.lysoCount);
  }

  // ── the division ────────────────────────────────────────────────
  private division(w: number): void {
    const m = this.mitosis;
    if (m) {
      m.t += w;
      const R = RULES.mitosis;
      let acc = 0, ph = 0;
      for (let i = 0; i < R.length; i++) {
        acc += R[i];
        if (m.t >= acc) ph = i + 1;
      }
      if (ph !== m.phase && ph < R.length) {
        m.phase = ph;
        this.emit({ type: 'mitosis', phase: ph });
      }
      if (m.t >= acc) this.divided(m);
      return;
    }
    if (!this.readyToDivide || this.phase === 'done') return;
    // the checkpoint: no division while damage is open on the helix
    if (this.lesions.some(l => l.state !== 'done' && l.u < RULES.laneU)) {
      if (!this.checkpoint) {
        this.checkpoint = true;
        this.emit({ type: 'checkpoint' });
        this.coach('check', { kind: 'lane' });
        if (this.t - this.checkSaid > 20) {
          this.checkSaid = this.t;
          this.talk.ask('check', 2, 5);
        }
      }
      return;
    }
    this.checkpoint = false;
    this.mitosis = { t: 0, phase: 0, niche: this.niche };
    this.stop = Math.max(this.stop, 0.08);
    this.emit({ type: 'divide', stage: this.stage, niche: this.niche });
    this.emit({ type: 'mitosis', phase: 0 });
    this.talk.ask('divide', 3, 5);
  }

  private divided(m: Mitosis): void {
    const r = this.recipe;
    this.mitosis = null;
    this.divisionsNow++;
    this.cellsNow[m.niche]++;
    const n = this.p.tissue[m.niche] + (this.settled ? 0 : this.cellsNow[m.niche]);
    const before = this.cardsNow.length;
    this.card('turnover');
    this.card(m.niche);
    const fresh = this.cardsNow.length > before ? this.cardsNow[this.cardsNow.length - 1] : null;
    this.cellCard = { niche: m.niche, n, t: 0, dur: RULES.cellCard, card: fresh };
    this.emit({ type: 'cell', niche: m.niche, stage: this.stage });
    this.talk.ask('cell', 3, 6);
    // the next division: its recipe grows; spare material carries over
    this.material = Math.max(0, this.material - r.mat);
    this.stageAtp = 0;
    this.scan = 0;
    this.stage++;
  }

  // ── teaching ────────────────────────────────────────────────────
  /** The first session teaches one thing at a time, when it first matters; later sessions only new things. */
  private tutor(): void {
    if (this.frozen || this.phase !== 'play') return;
    if (this.session === 1) {
      const first = this.lesions.find(l => l.state === 'open' && l.u < RULES.laneU - 0.5);
      if (this.t >= 1.5 && first) this.coach('lane', { kind: 'lesion', id: first.id });
      if (this.t >= 9 && this.p.seen.includes('lane')) this.coach('turbine', { kind: 'lens' });
      if (this.t >= 17 && this.p.seen.includes('turbine')) this.coach('recipe', { kind: 'recipe' });
    }
  }

  /** A first-time explanation (once ever): the index turns it into the runner's coach mark. */
  private coach(what: Coach, at: CoachAt): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at });
  }

  /** A Wiedza card met (once ever; the summary lists the new ones). */
  private card(id: CardId): void {
    if (this.p.cards.includes(id)) return;
    this.p.cards.push(id);
    this.cardsNow.push(id);
    this.emit({ type: 'card', id });
  }

  // ── the end ─────────────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.emit({ type: 'finale' });
  }

  private endFinale(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.talk.clear();
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
    this.settle();
  }

  /** The session is settled once — at its end, or when it ends early: the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.atpTotal += this.atp;
    p.repairs += this.repairsNow;
    p.recycled += this.partsNow;
    p.divisions += this.divisionsNow;
    p.surges += this.surgesNow;
    for (const n of Object.keys(this.cellsNow) as NicheId[]) p.tissue[n] += this.cellsNow[n];
    for (const k of Object.keys(this.logNow) as LesionKind[]) p.log[k] += this.logNow[k];
    p.bestCombo = Math.max(p.bestCombo, this.maxCombo);
    p.bestDivisions = Math.max(p.bestDivisions, this.divisionsNow);
    p.lastNiche = this.niche;
    p.lastLen = this.plannedSec;
    this.settled = true;
  }

  /** The session ends before its own end: settle as the end would (a division under way completes). */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    if (this.mitosis) this.divided(this.mitosis);
    this.story = null;
    this.settle();
    this.phase = 'done';
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the gradient's drive in a sighted push past its lead-in, calm in a rest; null blind, without signal, elsewhere. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.gauge);
    if (this.restBlock) return clamp(this.calmShown);
    return null;
  }

  /** The pad follows the gauge in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(this.gauge);
    return null;
  }

  /**
   * The song's fullness: the gauge in a sighted push (the song is feedback too), a gentle fixed level in a
   * rest, the warm-up and the finale, null (hold) in a blind push or without a signal — never a leak.
   */
  songLevel(f: FocusFrame): number | null {
    if (!this.started) return null;
    if (this.phase !== 'play') return 0.42;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? 0.42 : f.reliable ? clamp(0.2 + 0.8 * this.gauge) : null;
    if (this.restBlock) return 0.3;
    return 0.42;
  }

  /** Time is up: a division under way may finish (a few seconds). */
  canStop(): boolean {
    if (this.phase === 'done') return true;
    return this.t >= this.plannedSec + RULES.settle || (this.t >= this.plannedSec && !this.mitosis);
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.atp);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const cells = this.divisionsNow;
    const stats: [string, string][] = [
      [t('stat.atp'), fmtNum(this.atp)],
      [t('stat.cells'), fmtNum(cells)],
      [t('stat.repairs'), this.maxCombo > 1 ? t('stat.repairsCombo', { n: this.repairsNow, combo: this.maxCombo }) : fmtNum(this.repairsNow)],
      [t('stat.recycled'), fmtNum(this.partsNow)],
      [t('stat.surges'), fmtNum(this.surgesNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.atp, unit: 'ATP', record: this.bestBefore !== null && this.atp > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the first session
   * (Psalm 139:16, the body formed), a skin cell grown (Ezekiel 37:5-6, "cover you with skin"), any division
   * (Job 33:25, "refreshed like a child's"), a calm clean-up (Psalm 51:10, "renew a right spirit"), worn parts
   * let go of so new ones grow (John 12:24, gently: renewal through letting go of the old); else the root,
   * 2 Corinthians 4:16.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('psa139.16');
    if (this.cellsNow.skin > 0) fit.push('ezk37.5-6');
    if (this.divisionsNow > 0) fit.push('job33.25');
    if (this.passedRests > 0) fit.push('psa51.10');
    if (this.partsNow >= 2) fit.push('jhn12.24');
    fit.push('2co4.16');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.divisionsNow > 0) add(0, t('hl.close.cells', { n: this.divisionsNow, cell: cellName(this.niche) }));
    else if (this.started) add(0, t('hl.close.calm'));
    if (this.bestBefore !== null && this.atp > this.bestBefore) add(1, t('hl.record', { atp: atpText(this.atp) }));
    else if (this.bestBefore !== null && this.atp > 0 && this.bestBefore - this.atp <= Math.max(30, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { atp: atpText(this.bestBefore - this.atp) }));
    }
    for (const tr of this.upsNow) add(2, t(`hl.up.${tr}` as 'hl.up.mito'));
    if (this.cardsNow.length) add(3, t('hl.cards', { n: this.cardsNow.length }));
    if (this.maxCombo >= 4) add(4, t('hl.combo', { n: this.maxCombo }));
    if (this.partsNow > 0) add(5, t('hl.recycled', { n: this.partsNow }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    if (this.surgesNow > 0) add(7, t('hl.surges', { n: this.surgesNow }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

/** Every card id (the tests check the catalog covers them). */
export const ALL_CARDS: readonly CardId[] = CARD_IDS;
