/**
 * Odnowa's rules without a screen.  Inside one stem cell the player helps the cell renew itself and divide.
 * A division needs three things, the way a real cell does before it divides — and each comes from one source:
 *
 *   Energia       ATP from the mitochondrion's turbine (the ATP synthase: 8 protons a turn, 3 ATP a turn, Watt
 *                 et al. 2010).  It turns only while the player is focused (the band above its threshold), faster
 *                 the higher the level; a held focus turns it gold and faster still.  No focus, no turn.
 *   Naprawa DNA   damage glows on the double helix and waits; a tap sends the real repair crew (base excision,
 *                 nucleotide excision, end joining), which runs every step of its pathway in order.  Each repair
 *                 fills the bar.
 *   Budulec       in a rest block worn parts are tagged, wrapped by the phagophore — only as fast as the calm
 *                 allows — carried to a lysosome and digested back into building material.
 *
 * All three full and no damage open (the checkpoint) → mitosis; one daughter stays a stem cell, the other joins
 * the player's tissue (the meta).  The first session shows the systems one at a time (energy, then DNA, then the
 * clean-up, then the division), later sessions in a quick stagger.  A persistent "what to do now" line (`now`)
 * names the action of the moment.  Nothing is ever lost: without a signal nothing moves.
 * The headline is the ATP made.  No DOM: the view and the sound read the state and the event queue (`take()`).
 */
import { fmtNum } from '../../i18n';
import { BREATH_DEFAULT, breathAt, breathRest, type BreathPattern, type BreathState } from '../kit/breath';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, passage, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  CARD_IDS, LESIONS, NICHE, PART, PART_KINDS, TIPS, cellName, lines,
  type CardId, type LesionKind, type Moment, type NicheId, type PartKind, type StepId,
} from './content';
import { atpText, t } from './i18n';
import { bestFor, enzymeLevel, lenKey, lysoLevel, mitoLevel, sessionNiche, type OdnowaProgress, type Trait } from './meta';
import { RULES, need, readSec } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';

/** The four systems, in the order the first session shows them. */
export type Sys = 'energy' | 'dna' | 'clean' | 'divide';
export const SYSTEMS: readonly Sys[] = ['energy', 'dna', 'clean', 'divide'];

/** What the player should do now (the persistent line under the HUD). */
export type NowKind = 'wait' | 'energy' | 'dna' | 'rest' | 'blind' | 'check' | 'divide' | 'nosignal' | 'end';

export type LesionState = 'open' | 'fixing' | 'done';
export type Crew = 'tap' | 'cell';
export interface Lesion {
  id: number;
  kind: LesionKind;
  /** position on the lane (0 = the left edge, RULES.laneU = the right edge) */
  u: number;
  state: LesionState;
  /** the step of the pathway the crew is at, seconds into that step (negative: the crew is on its way) */
  step: number;
  st: number;
  /** who mends it (set when a crew starts) */
  by: Crew;
  /** seconds open (waiting for a crew), seconds since mended, the cell's own crew's calm-weighted seconds (a rest) */
  t: number;
  done: number;
  cell: number;
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
  seed: number;
}

export interface Mitosis { t: number; phase: number; niche: NicheId }
export type StoryKind = 'open';
export interface Story { kind: StoryKind; t: number; dur: number }
export interface CellCard { niche: NicheId; n: number; t: number; dur: number }

/** The first-time explanations (coach marks), in the order the first session meets them. */
export type Coach = 'turbine' | 'energy' | 'lane' | 'repair' | 'rest' | 'divide' | 'ring' | 'check' | 'blind';
export const COACHES: readonly Coach[] = ['turbine', 'energy', 'lane', 'repair', 'rest', 'divide', 'ring', 'check', 'blind'];
export type CoachAt =
  | { kind: 'lesion'; id: number } | { kind: 'lens' } | { kind: 'ring' } | { kind: 'part'; id: number }
  | { kind: 'chip'; i: 0 | 1 | 2 } | { kind: 'goal' } | { kind: 'lane' };

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'atp'; src: number }
  | { type: 'gold' }
  | { type: 'spawn'; id: number; kind: LesionKind }
  | { type: 'repairStart'; id: number; kind: LesionKind; by: Crew }
  | { type: 'repairStep'; id: number; step: StepId }
  | { type: 'repaired'; id: number; kind: LesionKind; by: Crew }
  | { type: 'miss' }
  | { type: 'part'; id: number; kind: PartKind }
  | { type: 'sealed'; id: number }
  | { type: 'fuse'; id: number; lyso: number }
  | { type: 'recycled'; id: number; kind: PartKind; mat: number; lyso: number }
  | { type: 'full'; need: 0 | 1 | 2 }
  | { type: 'checkpoint' }
  | { type: 'divide'; stage: number; niche: NicheId }
  | { type: 'mitosis'; phase: number }
  | { type: 'cell'; niche: NicheId; stage: number }
  | { type: 'card'; id: CardId }
  | { type: 'up'; trait: Trait; level: number }
  | { type: 'story'; kind: StoryKind }
  | { type: 'reveal'; sys: Sys }
  | { type: 'now'; kind: NowKind }
  | { type: 'blindEnd'; share: number; n: number }
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
 * The session's blocks: a first-ever session opens with a warm-up that shows the turbine (30 s in 5 and 10 min,
 * 20 s in 3, 6 s in a 40 s test), then pushes and rests ending with a rest, then the last stretch.  A rest is a
 * whole number of breaths (kit/breath: 4 in, 6 out — two breaths, 20 s, or three, 30 s; the founder's rule for
 * the meditations); the pushes take the rest of the time, 26 ± 4 s jittered, never under 12 s.  Sessions of a
 * minute and less (a test) keep plain halves.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number, breath: BreathPattern = BREATH_DEFAULT): Block[] {
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
  const restMean = breathRest(breath, R.rest[0], R.minBlock).sec;
  const pairs = Math.max(1, Math.round(left / (R.push[0] + restMean)));
  const jitter = pairs >= 2 ? 1 : 0;
  const rests: number[] = [];
  for (let i = 0; i < pairs; i++) rests.push(breathRest(breath, R.rest[0] + jitter * (rnd() * 2 - 1) * R.rest[1], R.minBlock).sec);
  // the pushes fill what the rests leave (a long rest gives back a breath when the pushes would be too short)
  for (let i = rests.length - 1; i >= 0 && left - rests.reduce((s, d) => s + d, 0) < pairs * R.minBlock; i--) {
    const one = breathRest(breath, 0, R.minBlock).sec;
    rests[i] = Math.max(one, rests[i] - (rests[i] - one));
  }
  const pushLeft = Math.max(pairs * R.minBlock, left - rests.reduce((s, d) => s + d, 0));
  const pushes: number[] = [];
  for (let i = 0; i < pairs; i++) pushes.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1]);
  const scale = pushLeft / pushes.reduce((s, d) => s + d, 0);
  for (let i = 0; i < pushes.length; i++) pushes[i] *= scale;
  // the jitter never takes a push past 30 s while their mean allows it (a block of 20–30 s, §2)
  const mean = pushLeft / pairs, top = R.push[0] + R.push[1], over = Math.max(...pushes) - mean;
  if (mean <= top && over > top - mean) for (let i = 0; i < pushes.length; i++) pushes[i] = mean + (pushes[i] - mean) * ((top - mean) / over);
  liftShort(pushes, R.minBlock);
  for (let i = 0; i < pairs; i++) plan.push(b('push', pushes[i]), b('rest', rests[i]));
  return plan;
}

/** A division's three needs at a stage: ATP made, DNA repairs, building material. */
export function needs(stage: number): { atp: number; dna: number; mat: number } {
  return { atp: need(RULES.atpNeed, stage, true), dna: need(RULES.dnaNeed, stage, false), mat: need(RULES.matNeed, stage, false) };
}

/**
 * The turbine's drive (0..1) from the band: nothing without a signal or without focus; while focused,
 * `driveMin` at the threshold growing to 1 at level 0.5 + `driveSpan` — the more focus, the faster.
 */
export function driveOf(f: Pick<FocusFrame, 'reliable' | 'focused' | 'level'>): number {
  if (!f.reliable || !f.focused) return 0;
  return RULES.driveMin + (1 - RULES.driveMin) * clamp((f.level - 0.5) / RULES.driveSpan);
}

/** The turbine's turns a second from its drive and its gold (a held focus). */
export const spinOf = (drive: number, gold = 0): number => RULES.spinMax * clamp(drive) * (1 + RULES.goldK * clamp(gold));

/** The seconds of one repair step: the enzymes' level speeds it, a double-strand break is slower, the cell's own crew too. */
export function stepSec(enzymes: number, kind: LesionKind, by: Crew): number {
  const base = RULES.step * RULES.enzymeK ** Math.max(0, enzymes) * (kind === 'dsb' ? RULES.dsbK : 1);
  return by === 'cell' ? base * 1.4 : base;
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

/** The help Mito gives when tapped, by the action of the moment. */
const HELP: Readonly<Record<NowKind, Moment>> = {
  wait: 'help.energy', energy: 'help.energy', dna: 'help.dna', rest: 'help.rest', blind: 'help.blind', check: 'help.check',
  divide: 'help.divide', nosignal: 'nosignal', end: 'help.end',
};

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: OdnowaProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** play a given niche (the screenshot scripts; otherwise the progress chooses) */
  niche?: NicheId;
  /** the player has a mouse, not a finger: Mito says "click" where he speaks of the hands */
  mouse?: boolean;
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
  private readonly holdNeed: number;
  readonly finaleSec: number;
  readonly session: number;
  readonly niche: NicheId;
  readonly plan: Block[];
  readonly breath: BreathPattern = BREATH_DEFAULT;
  /** the first session's slow reveal (one system at a time, each with its coach mark) */
  readonly slow: boolean;

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
  /** the view shows a card of its own (a Wiedza card): Mito waits with his next line */
  holdTalk = false;
  /** a coach mark is on screen (the index says so): Mito's line waits; and one is queued: Mito starts no new line */
  hintUp = false;
  hintQueued = false;

  // the reveal and the line
  private readonly shownAt: Record<Sys, number | null> = { energy: null, dna: null, clean: null, divide: null };
  now: NowKind = 'wait';
  nowT = 0;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  calmShown = 0;
  /** the gauge: the band's eased level (0..1, 0.5 at the threshold) */
  gauge = 0;
  maxHold = 0;
  private unreliableT = 0;
  private relSec = 0;
  private pushTips = 0;
  private nosignalSaid = -99;

  // energy
  /** the turbine's drive (0..1, eased) — protons crowd with it */
  drive = 0;
  /** a held focus: 0..1 (the turbine's gold) */
  gold = 0;
  private goldSaid = false;
  /** the turbine's angle (turns) and its spin (turns per second) */
  angle = 0;
  spin = 0;
  private extraAcc = 0;
  /** a blind push's ATP, shown when it ends */
  bank = 0;

  // DNA
  readonly lesions: Lesion[] = [];
  /** the helix's scroll (units) and its speed now */
  scanned = 0;
  scanV = 0;
  private spawnT = 0;
  private nextId = 1;
  private dsbStage = 0;
  private warmLesions = 0;
  tapsNow = 0;

  // the clean-up
  readonly parts: Part[] = [];
  private partT = 0;
  private nextSide = 0;

  // the division
  stage = 1;
  stageAtp = 0;
  dna = 0;
  material = 0;
  checkpoint = false;
  mitosis: Mitosis | null = null;
  private checkSaid = -99;
  private fullSaid: [boolean, boolean, boolean] = [false, false, false];
  /** seconds without a line from Mito (a quiet rest earns a fact) */
  private quiet = 0;

  // the session's numbers
  atp = 0;
  repairsNow = 0;
  tapRepairs = 0;
  partsNow = 0;
  divisionsNow = 0;
  readonly logNow: Record<LesionKind, number> = { oxo: 0, abasic: 0, dimer: 0, bulky: 0, dsb: 0 };
  readonly cellsNow: Record<NicheId, number> = { gut: 0, skin: 0, blood: 0 };
  readonly cardsNow: CardId[] = [];
  readonly upsNow: Trait[] = [];
  passedRests = 0;
  passedPushes = 0;
  goldSec = 0;
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
    this.holdNeed = RULES.holdNeed[init.eeg ? 'eeg' : 'fnirs'];
    this.finaleSec = finaleFor(init.plannedSec);
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.bestBefore = bestFor(p, init.plannedSec);
    this.niche = init.niche ?? sessionNiche(p);
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng, this.breath);
    this.talk = new Talk(lines(init.mouse === true), init.rng);
    this.lv = { mito: mitoLevel(p), enzyme: enzymeLevel(p), lyso: lysoLevel(p) };
    this.slow = !p.seen.includes('reveal');
  }

  // ── views of the state ──────────────────────────────────────────
  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get playing(): boolean { return this.phase === 'play'; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.playing; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.playing; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.playing; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.playing; }
  /** a push the player sees (not blind) */
  get sighted(): boolean { return this.pushBlock && !this.block.blind; }
  /** a card holds the world */
  get frozen(): boolean { return !!this.story; }
  get needs(): { atp: number; dna: number; mat: number } { return needs(this.stage); }
  /** each need's share (0..1): energy, DNA, material — the goal's three bars */
  get shares(): [number, number, number] {
    const n = this.needs;
    return [clamp(this.stageAtp / n.atp), clamp(this.dna / n.dna), clamp(this.material / n.mat)];
  }
  /** how far the division is (0..1): the mean of the three needs */
  get progress(): number {
    const s = this.shares;
    return (s[0] + s[1] + s[2]) / 3;
  }
  get readyToDivide(): boolean {
    const n = this.needs;
    return this.stageAtp >= n.atp && this.dna >= n.dna && this.material >= n.mat;
  }
  /** whether a system is in play yet, and for how long (s; -1 before) */
  shown(s: Sys): boolean { return this.shownAt[s] !== null; }
  shownFor(s: Sys): number { const a = this.shownAt[s]; return a === null ? -1 : this.t - a; }
  /** the breath in a rest (the guide), null outside one */
  get breathNow(): BreathState | null { return this.restBlock ? breathAt(this.breath, this.blockT) : null; }
  /** the turbine may make energy now: shown, and the block asks for focus (a push, the warm-up) or the finale */
  get energyOn(): boolean {
    return this.shown('energy') && !this.frozen && this.phase !== 'done' && (this.pushBlock || this.warmBlock || this.phase === 'finale');
  }
  /** lifetime totals with this session's (until it is settled) */
  life(k: 'atp' | 'repairs' | 'recycled'): number {
    const add = this.settled ? 0 : k === 'atp' ? this.atp : k === 'repairs' ? this.repairsNow : this.partsNow;
    return (k === 'atp' ? this.p.atpTotal : k === 'repairs' ? this.p.repairs : this.p.recycled) + add;
  }
  get mitoCount(): number { return mitoLevel({ atpTotal: this.life('atp') }); }
  get enzymes(): number { return enzymeLevel({ repairs: this.life('repairs') }); }
  get lysoCount(): number { return lysoLevel({ recycled: this.life('recycled') }); }
  /** lesions that wait for a crew */
  get openLesions(): Lesion[] { return this.lesions.filter(l => l.state === 'open'); }
  /** lesions not yet mended (waiting, or a crew at work) */
  get liveLesions(): Lesion[] { return this.lesions.filter(l => l.state !== 'done'); }
  /** How many lysosomes the city has now (two, one more at the top lysosome level). */
  get lysoSlots(): number { return RULES.lysos + (this.lysoCount >= 3 ? 1 : 0); }

  // ── start and input ─────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    if (this.session === 1) {
      const text = `${t('story.title')} ${t('story.text')} ${passage('2co4.16').text}`;
      this.story = { kind: 'open', t: 0, dur: Math.min(RULES.openMax, readSec(text)) };
      this.emit({ type: 'story', kind: 'open' });
    } else this.talk.ask('open', 2, 10);
    this.startBlock(0);
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
    this.talk.ask('first', 2, 20);
  }

  /**
   * A tap in the cell: on the lane (`u` its position) the open lesion nearest it within reach, anywhere else (or
   * too far) the one that has waited longest.  True when a crew went.
   */
  tapAt(u: number | null): boolean {
    if (!this.canTouch()) return false;
    const l = this.aim(u);
    if (!l) {
      this.emit({ type: 'miss' });
      return false;
    }
    return this.crew(l, 'tap');
  }

  /** A tap on the lane at `u`. */
  tapLane(u: number): boolean { return this.tapAt(u); }

  /** Space, or a tap on the free cell: the lesion that has waited longest. */
  repairNext(): boolean { return this.tapAt(null); }

  /** The lesion a tap at `u` (null: off the lane) would send the crew to, without sending it (a desktop's hover). */
  aim(u: number | null): Lesion | null {
    if (!this.canTouch()) return null;
    const open = this.openLesions;
    if (!open.length) return null;
    if (u !== null) {
      let best: Lesion | null = null, d = Infinity;
      for (const l of open) {
        const dd = Math.abs(l.u - u);
        if (dd < d) { d = dd; best = l; }
      }
      if (best && d <= RULES.tapReach) return best;
    }
    return open.reduce((a, b) => (b.t > a.t ? b : a));
  }

  laneAim(u: number): Lesion | null { return this.aim(u); }
  nextAim(): Lesion | null { return this.aim(null); }

  private canTouch(): boolean { return this.started && this.phase !== 'done' && !this.frozen; }

  /** Mito tapped: he says what to do now, in his words (at once: a line on screen gives way). */
  askHelp(): void {
    if (!this.started || this.frozen) return;
    this.talk.hush(0);
    this.talk.ask(HELP[this.now], 4, 4);
  }

  /** Space and Enter: close the card, or mend the lesion that has waited longest. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const space = k === ' ' || k === 'Enter' || k === 'Spacebar';
    if (!space) return false;
    if (!down) return true;
    if (this.tap()) return true;
    this.repairNext();
    return true;
  }

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
    this.brain(dt, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec && !this.mitosis) this.endFinale();
    this.reveal();
    if (w > 0 && this.phase !== 'done') {
      this.engine(w, f);
      this.lane(w, f);
      this.cleanup(w, f);
      this.division(w);
    }
    this.tutor();
    this.updateNow(dt);
    const cut = !!this.story || !!this.cellCard;
    this.talk.update(dt, t, this.talkBlocked || this.hintQueued, cut, this.talkBlocked);
    // a quiet rest: Mito shares a fact (lowest priority; never while the first session is still showing things)
    if (this.talk.line) this.quiet = 0;
    else this.quiet += dt;
    if (this.quiet > 14 && this.restBlock && !this.frozen && this.shown('divide')) {
      this.quiet = 0;
      this.talk.ask('fact', 0, 6);
    }
  }

  get talkBlocked(): boolean {
    const b = this.block;
    const tele = this.phase === 'play' && !!b && this.blockT >= b.dur - RULES.telegraph;
    const banner = this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
    return tele || banner || !!this.story || !!this.cellCard || this.holdTalk || this.hintUp;
  }

  /** The band's slow quantities: the gauge, the calm shown, the held focus. */
  private brain(dt: number, f: FocusFrame): void {
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    this.calmShown = approach(this.calmShown, this.calm, dt, 0.6);
    this.unreliableT = f.reliable ? 0 : this.unreliableT + dt;
    if (this.playing && f.reliable) this.relSec += dt;
    this.gauge = approach(this.gauge, f.reliable ? clamp(f.level) : 0, dt, 0.5);
    const on = this.energyOn && f.reliable && f.focused;
    if (on) this.maxHold = Math.max(this.maxHold, f.hold);
    const goldWant = on && f.hold >= this.holdNeed ? 1 : 0;
    this.gold = approach(this.gold, goldWant, dt, RULES.goldTau);
    if (this.gold > 0.6 && !this.blind) this.goldSec += dt;
    if (this.gold > 0.9 && !this.goldSaid && !this.blind) {
      this.goldSaid = true;
      this.emit({ type: 'gold' });
      this.talk.ask('gold', 2, 6);
      this.card('pmf');
      this.card('speed');
    }
  }

  // ── the reveal: one system at a time ─────────────────────────────
  private reveal(): void {
    if (this.frozen || this.phase === 'done') return;
    const at = (s: Sys) => this.shownAt[s];
    if (!this.slow) {
      // a returning player: the four in a quick stagger, each with a short highlight
      SYSTEMS.forEach((s, i) => { if (at(s) === null && this.t >= RULES.stagger0 + i * RULES.stagger) this.show(s); });
      return;
    }
    if (at('energy') === null) {
      this.show('energy');
      this.coach('turbine', { kind: 'lens' });
      return;
    }
    if (at('dna') === null) {
      const e = this.shownFor('energy');
      if ((e >= RULES.dnaAfter && this.atp + this.bank >= RULES.dnaAtp) || e >= RULES.dnaMax || this.restBlock) this.show('dna');
      return;
    }
    if (at('clean') === null) {
      if (this.restBlock) this.show('clean');
      return;
    }
    if (at('divide') === null) {
      const full = this.shares.filter(x => x >= 1).length;
      // after the rest's own explanation: one thing at a time
      const restSaid = !this.restBlock || this.p.seen.includes('rest');
      if (((this.shownFor('clean') >= RULES.divideAfter && !this.restBlock) || full >= 2 || this.readyToDivide) && restSaid) {
        this.show('divide');
        this.coach('divide', { kind: 'goal' });
        if (!this.p.seen.includes('reveal')) this.p.seen.push('reveal');
      }
    }
  }

  private show(s: Sys): void {
    if (this.shownAt[s] !== null) return;
    this.shownAt[s] = this.t;
    if (s === 'dna') this.spawnT = RULES.firstLesion;
    if (s === 'clean') this.partT = RULES.partEvery - RULES.partFirst;
    this.emit({ type: 'reveal', sys: s });
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    // the warm-up waits while the opening card is read (the session's clock runs on: the last block gives way)
    if (!(b.kind === 'warmup' && this.story)) this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'rest' && this.blockT >= RULES.bannerSec && this.blockT - dt < RULES.bannerSec && this.shown('clean')) {
      const first = this.parts.find(p => p.phase !== 'done');
      this.coach('rest', first ? { kind: 'part', id: first.id } : { kind: 'chip', i: 2 });
    }
    if (b.kind === 'push' && this.slow === false && this.blockT >= 6 && this.blockT - dt < 6) this.coach('ring', { kind: 'ring' });
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
      this.goldSaid = false;
      this.bank = 0;
      if (b.blind) {
        this.talk.ask('blind', 3, 10);
        this.coach('blind', { kind: 'lens' });
      } else if (first) this.talk.ask('push', 2, 10);
      this.card('pumps');
    } else if (b.kind === 'rest') {
      this.partT = Math.max(this.partT, RULES.partEvery - RULES.partFirst);
      if (first) this.talk.ask('rest', 2, 10);
    }
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
        // the reveal: the energy made under the veil arrives, with the block's share above the threshold
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const n = this.bank;
        this.bank = 0;
        this.atp += n;
        this.stageAtp += n;
        this.emit({ type: 'blindEnd', share: s, n });
        this.talk.ask('blindEnd', 3, 8);
      } else if (b.kind === 'push' && verdict) this.passedPushes++;
      if (b.kind === 'rest' && verdict) {
        // a deep clean-up: a little extra building material
        this.passedRests++;
        this.material += RULES.calmBonus;
        this.talk.ask('calm', 2, 6);
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need: needShare });
  }

  // ── energy ─────────────────────────────────────────────────────
  private engine(w: number, f: FocusFrame): void {
    const on = this.energyOn && f.reliable && f.focused;
    const want = on ? driveOf(f) : 0;
    this.drive = approach(this.drive, want, w, RULES.driveTau);
    this.spin = approach(this.spin, on ? spinOf(want, this.gold) : 0, w, RULES.spinTau);
    // a rotor that coasts to a stop keeps no momentum to make ATP without focus: it settles in a tenth of a turn
    if (!on && this.spin < 0.04) this.spin = 0;
    const turn = this.spin * w;
    const before = Math.floor(this.angle * RULES.atpPerTurn);
    this.angle += turn;
    const made = Math.floor(this.angle * RULES.atpPerTurn) - before;
    for (let i = 0; i < made; i++) this.makeAtp(0);
    // the extra mitochondria (biogenesis): each a quarter of the big turbine's output
    const extra = this.mitoCount;
    if (extra > 0 && turn > 0) {
      this.extraAcc += turn * RULES.atpPerTurn * RULES.mitoShare * extra;
      while (this.extraAcc >= 1) {
        this.extraAcc -= 1;
        this.makeAtp(1 + Math.floor(this.rng() * extra));
      }
    }
  }

  private makeAtp(src: number): void {
    const lvBefore = this.mitoCount;
    if (this.blind) this.bank++;
    else {
      this.atp++;
      this.stageAtp++;
      this.emit({ type: 'atp', src });
    }
    const made = this.atp + this.bank;
    if (made === 3) this.card('turbine');
    if (made === 60) this.card('powerhouse');
    if (made === 500) this.card('daily');
    if (this.life('atp') >= 1000) this.card('glucose');
    if (!this.blind && this.stageAtp >= RULES.dnaAtp) this.coach('energy', { kind: 'chip', i: 0 });
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

  // ── DNA ────────────────────────────────────────────────────────
  private lane(w: number, f: FocusFrame): void {
    const R = RULES;
    // the helix scrolls on along a clean strand; damage holds it still (a mended rung drifts away)
    const clean = !this.liveLesions.length;
    this.scanV = approach(this.scanV, clean && !this.mitosis ? R.scanV : 0, w, 0.3);
    const du = this.scanV * w;
    this.scanned += du;
    for (const l of this.lesions) {
      if (l.state === 'done') { l.u -= du; l.done += w; }
      else if (l.state === 'open') l.t += w;
    }
    // new damage while the hands are asked (a push, the warm-up), until the stage's repairs are done
    const asked = this.pushBlock || this.warmBlock;
    if (this.shown('dna') && asked && !this.mitosis && this.dna < this.needs.dna) {
      this.spawnT -= w;
      if (this.spawnT <= 0 && this.liveLesions.length < R.laneCap) {
        this.spawn();
        const gap = this.warmBlock ? R.lesionEveryWarm : R.lesionEvery;
        this.spawnT = gap[0] + this.rng() * (gap[1] - gap[0]);
      }
    }
    // in a rest the cell's own crew comes to waiting damage, as fast as the calm lets it (and in the last stretch)
    for (const l of this.openLesions) {
      if (this.restBlock) l.cell += w * (f.reliable ? clamp(f.calm) : 0);
      else if (this.phase === 'finale') l.cell += w;
      if (l.cell >= R.cellFix) this.crew(l, 'cell');
    }
    for (const l of this.lesions) if (l.state === 'fixing') this.work(l, w);
    for (let i = this.lesions.length - 1; i >= 0; i--) {
      const l = this.lesions[i];
      if (l.state === 'done' && (l.done > 3 || l.u < -1)) this.lesions.splice(i, 1);
    }
  }

  /** The damage the session's niche brings (a double-strand break now and then from the second stage). */
  private pickKind(): LesionKind {
    if (this.session === 1 && this.warmBlock) return this.warmLesions++ < 2 ? 'oxo' : 'abasic';
    if (this.stage >= RULES.dsbFrom && this.dsbStage !== this.stage && this.rng() < RULES.dsbChance) {
      this.dsbStage = this.stage;
      return 'dsb';
    }
    return weighted(NICHE[this.niche].mix, this.rng);
  }

  /** A lesion on the visible helix, clear of the others. */
  private spawn(): void {
    const R = RULES;
    const others = this.liveLesions.map(l => l.u);
    let u = R.spawnU[0] + this.rng() * (R.spawnU[1] - R.spawnU[0]);
    for (let k = 0; k < 8 && others.some(o => Math.abs(o - u) < R.spawnGap); k++) u = R.spawnU[0] + this.rng() * (R.spawnU[1] - R.spawnU[0]);
    const kind = this.pickKind();
    const l: Lesion = { id: this.nextId++, kind, u, state: 'open', step: 0, st: 0, by: 'tap', t: 0, done: 0, cell: 0, seed: this.rng() };
    this.lesions.push(l);
    this.emit({ type: 'spawn', id: l.id, kind });
    this.coach('lane', { kind: 'lesion', id: l.id });
    if (kind === 'dsb') this.talk.ask('dsb', 3, 6);
  }

  /** A crew starts. */
  private crew(l: Lesion, by: Crew): boolean {
    if (l.state !== 'open') return false;
    l.state = 'fixing';
    l.by = by;
    l.step = 0;
    l.st = -RULES.crewIn;
    if (by === 'tap') this.tapsNow++;
    this.emit({ type: 'repairStart', id: l.id, kind: l.kind, by });
    return true;
  }

  private work(l: Lesion, w: number): void {
    const steps = LESIONS[l.kind].steps;
    const sec = stepSec(this.enzymes, l.kind, l.by);
    l.st += w;
    while (l.st >= sec && l.state === 'fixing') {
      l.st -= sec;
      this.emit({ type: 'repairStep', id: l.id, step: steps[l.step] });
      l.step++;
      if (l.step >= steps.length) this.mended(l);
    }
  }

  private mended(l: Lesion): void {
    const spec = LESIONS[l.kind];
    const lv = this.enzymes;
    const was = this.dna;
    l.state = 'done';
    l.done = 0;
    this.dna++;
    this.repairsNow++;
    this.logNow[l.kind]++;
    if (l.by === 'tap') this.tapRepairs++;
    this.emit({ type: 'repaired', id: l.id, kind: l.kind, by: l.by });
    if (was < this.needs.dna && this.dna >= this.needs.dna) this.full(1);
    this.card('lesions');
    this.card(spec.path === 'ber' ? 'ber' : spec.path === 'ner' ? 'ner' : 'dsb');
    if (l.kind === 'dimer') this.card('uv');
    if (this.life('repairs') >= 50) this.card('fidelity');
    if (this.repairsNow === 1) {
      this.talk.ask('repair', 1, 5);
      this.coach('repair', { kind: 'chip', i: 1 });
    }
    if (this.enzymes > lv) this.levelUp('enzyme', this.enzymes);
  }

  // ── the clean-up (autophagy) ────────────────────────────────────
  private cleanup(w: number, f: FocusFrame): void {
    const R = RULES;
    const lyK = R.lysoK ** this.lysoCount;
    // new worn parts appear in a rest block, one spot at a time
    if (this.restBlock && this.shown('clean') && !this.mitosis) {
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
          const kind = this.session === 1 && this.partsNow === 0 && !this.parts.length
            ? 'mito'
            : weighted(Object.fromEntries(PART_KINDS.map(k => [k, PART[k].weight])) as Record<PartKind, number>, this.rng);
          const pt: Part = { id: this.nextId++, kind, spot, lyso: (spot >> 1) % this.lysoSlots, phase: 'tag', k: 0, t: 0, done: 0, seed: this.rng() };
          this.parts.push(pt);
          this.emit({ type: 'part', id: pt.id, kind });
        }
      }
    }
    // only calm wraps (a rest, and the last stretch): no calm, no wrapping — and nothing is lost
    const calmK = (this.restBlock || this.phase === 'finale') && f.reliable ? clamp(f.calm) : 0;
    const wrapRate = R.wrapRate * lyK * calmK;
    for (const pt of this.parts) {
      pt.t += w;
      switch (pt.phase) {
        case 'tag':
          pt.k += w / R.tagSec;
          if (pt.k >= 1) this.phaseOf(pt, 'wrap');
          break;
        case 'wrap':
          pt.k += wrapRate * w;
          if (pt.k >= 1) {
            this.phaseOf(pt, 'sealed');
            this.emit({ type: 'sealed', id: pt.id });
          }
          break;
        case 'sealed':
          pt.k += w / R.sealSec;
          if (pt.k >= 1) this.phaseOf(pt, 'travel');
          break;
        case 'travel':
          pt.k += w / R.travelSec;
          if (pt.k >= 1) {
            this.phaseOf(pt, 'fuse');
            this.emit({ type: 'fuse', id: pt.id, lyso: pt.lyso });
          }
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

  private recycle(pt: Part): void {
    const lv = this.lysoCount;
    const mat = PART[pt.kind].mat;
    const was = this.material;
    this.phaseOf(pt, 'done');
    pt.done = 0;
    this.material += mat;
    this.partsNow++;
    this.emit({ type: 'recycled', id: pt.id, kind: pt.kind, mat, lyso: pt.lyso });
    if (was < this.needs.mat && this.material >= this.needs.mat) this.full(2);
    this.card('autophagy');
    if (pt.kind === 'mito') this.card('mitophagy');
    if (this.life('recycled') >= 3) this.card('lysosome');
    if (this.partsNow === 1) this.talk.ask('recycle', 1, 5);
    if (this.lysoCount > lv) this.levelUp('lyso', this.lysoCount);
  }

  /** A need filled for this stage (once a stage each). */
  private full(i: 0 | 1 | 2): void {
    if (this.fullSaid[i]) return;
    this.fullSaid[i] = true;
    this.emit({ type: 'full', need: i });
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
    if (this.stageAtp >= this.needs.atp) this.full(0);
    if (!this.readyToDivide || this.phase === 'done') {
      this.checkpoint = false;
      return;
    }
    // the checkpoint: no division while damage is open on the helix
    const live = this.liveLesions;
    if (live.length) {
      if (!this.checkpoint) {
        this.checkpoint = true;
        this.emit({ type: 'checkpoint' });
        const l = live.find(x => x.state === 'open');
        if (l) this.coach('check', { kind: 'lesion', id: l.id });
        if (this.t - this.checkSaid > 20) {
          this.checkSaid = this.t;
          this.talk.ask('check', 2, 6);
        }
      }
      return;
    }
    this.checkpoint = false;
    if (!this.shown('divide')) this.show('divide');
    this.mitosis = { t: 0, phase: 0, niche: this.niche };
    this.stop = Math.max(this.stop, 0.08);
    this.emit({ type: 'divide', stage: this.stage, niche: this.niche });
    this.emit({ type: 'mitosis', phase: 0 });
    this.talk.ask('divide', 3, 6);
  }

  private divided(m: Mitosis): void {
    const n = this.needs;
    this.mitosis = null;
    this.divisionsNow++;
    this.cellsNow[m.niche]++;
    const count = this.p.tissue[m.niche] + (this.settled ? 0 : this.cellsNow[m.niche]);
    this.card('turnover');
    this.card(m.niche);
    const text = `${t('cellcard.title')} ${t('cellcard.what', { cell: cellName(m.niche), n: count })}`;
    this.cellCard = { niche: m.niche, n: count, t: 0, dur: readSec(text) };
    this.emit({ type: 'cell', niche: m.niche, stage: this.stage });
    this.talk.ask('cell', 3, 12);
    // the next division: its needs grow; spare energy and material carry over (what was gained stays)
    this.stageAtp = Math.max(0, this.stageAtp - n.atp);
    this.material = Math.max(0, this.material - n.mat);
    this.dna = 0;
    this.fullSaid = [false, false, false];
    this.stage++;
    this.spawnT = Math.min(this.spawnT, RULES.firstLesion);
  }

  // ── the line: what to do now ─────────────────────────────────────
  /** What the moment asks of the player (before the hold that keeps the line steady). */
  nowWant(): NowKind {
    if (this.phase === 'done' || (this.phase === 'finale' && !this.mitosis)) return 'end';
    if (this.story || !this.shown('energy')) return 'wait';
    if (this.mitosis) return 'divide';
    if (this.unreliableT >= RULES.noSignal) return 'nosignal';
    if (this.restBlock) return 'rest';
    if (this.checkpoint && this.openLesions.length) return 'check';
    if (this.openLesions.some(l => l.t >= RULES.nowDna)) return 'dna';
    return this.blind ? 'blind' : 'energy';
  }

  private updateNow(dt: number): void {
    this.nowT += dt;
    const want = this.nowWant();
    if (want === this.now) return;
    // a new block, a card, a division or the end change the line at once; the hands' prompts hold a little
    const hard = (k: NowKind) => k === 'rest' || k === 'divide' || k === 'end' || k === 'wait';
    if (hard(want) || hard(this.now) || this.blockT < 0.05 || this.nowT >= RULES.nowHold) {
      this.now = want;
      this.nowT = 0;
      this.emit({ type: 'now', kind: want });
      if (want === 'nosignal' && this.t - this.nosignalSaid > 30) {
        this.nosignalSaid = this.t;
        this.talk.ask('nosignal', 2, 6);
      }
    }
  }

  // ── teaching ────────────────────────────────────────────────────
  /** The first session teaches one thing at a time, when it first matters. */
  private tutor(): void {
    if (this.frozen || this.phase !== 'play') return;
    // the gauge ring, once the turbine has turned in a push (the first session, after its first explanations)
    if (this.slow && this.pushBlock && !this.blind && this.shown('dna') && this.blockT >= 6 && this.p.seen.includes('lane')) this.coach('ring', { kind: 'ring' });
  }

  /** A first-time explanation (once ever): the index turns it into the runner's coach mark. */
  private coach(what: Coach, at: CoachAt): void {
    if (this.p.seen.includes(what)) return;
    this.p.seen.push(what);
    this.emit({ type: 'coach', what, at });
  }

  /** Whether a coach mark's thing has been done (the index keeps a key mark up until then). */
  coachDone(what: Coach): boolean {
    switch (what) {
      case 'turbine': return this.atp + this.bank >= RULES.dnaAtp;
      case 'lane': return this.tapsNow > 0 || this.restBlock;
      case 'rest': return this.partsNow > 0 || !this.restBlock;
      case 'check': return !this.checkpoint;
      default: return true;
    }
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
    for (const n of Object.keys(this.cellsNow) as NicheId[]) p.tissue[n] += this.cellsNow[n];
    for (const k of Object.keys(this.logNow) as LesionKind[]) p.log[k] += this.logNow[k];
    p.bestDivisions = Math.max(p.bestDivisions, this.divisionsNow);
    p.lastNiche = this.niche;
    p.lastLen = this.plannedSec;
    this.settled = true;
  }

  /** The session ends before its own end: settle as the end would (a division under way completes, a blind bank pays). */
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

  /** The panel's gauge: the band's level where it turns the turbine (a sighted push, the warm-up), calm in a rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.blind) return null;
    if (this.sighted || (this.warmBlock && this.shown('energy'))) return clamp(this.gauge);
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
    if (this.pushBlock) return f.reliable ? clamp(0.2 + 0.8 * this.gauge) : null;
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
    const stats: [string, string][] = [
      [t('stat.atp'), fmtNum(this.atp)],
      [t('stat.cells'), fmtNum(this.divisionsNow)],
      [t('stat.repairs'), fmtNum(this.repairsNow)],
      [t('stat.recycled'), fmtNum(this.partsNow)],
      [t('stat.gold'), t('sec', { n: fmtNum(Math.round(this.goldSec)) })],
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
    else if (this.started) add(0, t('hl.close.calm', { p: Math.round(this.progress * 100) }));
    if (this.bestBefore !== null && this.atp > this.bestBefore) add(1, t('hl.record', { atp: atpText(this.atp) }));
    else if (this.bestBefore !== null && this.atp > 0 && this.bestBefore - this.atp <= Math.max(30, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { atp: atpText(this.bestBefore - this.atp) }));
    }
    for (const tr of this.upsNow) add(2, t(`hl.up.${tr}` as 'hl.up.mito'));
    if (this.cardsNow.length) add(3, t('hl.cards', { n: this.cardsNow.length }));
    if (this.goldSec >= 5) add(4, t('hl.gold', { n: Math.round(this.goldSec) }));
    if (this.partsNow > 0) add(5, t('hl.recycled', { n: this.partsNow }));
    if (this.blindShare >= 0) add(6, t('hl.blind', { n: this.blindShare }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}

/** Every card id (the tests check the catalog covers them). */
export const ALL_CARDS: readonly CardId[] = CARD_IDS;
