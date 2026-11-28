/**
 * A health visualisation's session, without the DOM (DESIGN.md §24, Każdy włos's §15 generalised): a library of short
 * guided meditations about one part of the body, scene after scene.  Each scene is a picture that grows from 0 to 1 —
 * only with real focus:
 *
 *   focus (a sighted push past its lead-in, a reliable signal, `focused`)   the scene grows at
 *        (growBase + growLevel × level + growHold × hold/holdFull) / sceneSec a second, and units are counted with it
 *   the warm-up (the first session)                                        the same rule at half the rate
 *   rest                                                                   the breath guide (in 4 / out 6); calm
 *        deepens the picture (warmth, colour, sheen) — it never advances it
 *   a blind push                                                           the growth gathers unseen, shown at its end
 *   no signal                                                              nothing moves, nothing is lost
 *
 * The player chooses, walks and repeats: a mode (in order · just this one · repeat), the previous scene, this scene
 * again, the next scene, another meditation from the picker; skipping is theirs, but only scenes grown by focus count
 * as grown.  The place is kept for the next session.  The headline is the library's unit (perScene a scene), counted
 * only from focused growth.  Blocks follow the kit's rules: push and rest with jitter and a 4 s telegraph, each judged
 * once at its end, blind pushes from the third session, a warm-up the first time, a quiet finale.
 *
 * Round 23, "Ciało słucha" (kit/inner.ts, DESIGN §27): every rest carries words for the body on its out-breaths (the
 * first rest in a meditation its verse, the last out-breath the player's word of peace), a word held in calm on its
 * out-breath is received (counted for the summary, never the score); sessions of 3 minutes and more open with a
 * settling-in rest (it waits under an opening card); "Przed snem" brings the night's words, a goodnight and the
 * night's closing passages.
 */
import { fmtNum } from '../../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../focus';
import { BREATH_DEFAULT, breathAt, type BreathState } from '../breath';
import { approach, clamp, ease } from '../juice';
import { scaledBlock } from '../rhythm';
import { inTurn, type PassageId } from '../scripture';
import {
  InnerTrack, InnerWords, NIGHT_CLOSERS, SETTLE, SETTLE_HOLD_MAX, absorbHold, cueText, innerSource, loadInner, type InnerNow, type InnerPrefs, type ReceivedFrom,
} from '../inner';
import type { ArcadeOutcome } from '../types';
import { TIPS, libOf, type Lib, type Mode } from './lib';
import { bestOf, lenKey, markSeen, setMode, type HealthProgress, type Pos } from './meta';
import { BREATH, RULES } from './rules';
import type { HealthLibrary } from './spec';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
/** a narrator's line may begin in a rest with words only this far into an in-breath (s), round 23 */
const QUIET_START = 0.6;
/**
 * The session's arc (round 24, Nowe siły — a world may picture the whole session's work, WorldState.arc): each bit of
 * focused growth adds itself over what the session can hold — the growth so far plus the player's pace times the
 * sighted time left (the pace: scene units a sighted second, this session's own after a prior worth `priorSec`) — so a
 * player who keeps their pace reaches 1 at about `margin` of the session's sighted time, whatever its length; never
 * less than `floor` a sighted second (a session with only a few focused moments stays partial).
 */
export const ARC = { prior: 0.8 / RULES.sceneSec, priorSec: 60, floor: 0.3 / RULES.sceneSec, margin: 0.88 } as const;
export interface Block {
  kind: BlockKind;
  dur: number;
  blind: boolean;
  /** the settling-in rest that opens a session of 3 minutes and more (round 23): SETTLE.breaths of autogenic words */
  settle?: boolean;
}

/**
 * Where the meditation is: `move` (the camera goes to a scene), `at` (the scene grows), `hold` (it has just grown:
 * a moment in its light), `whole` (the meditation's last scene has grown: the whole of it, then its closing card),
 * `after` (a grown scene that stays — the end of "just this one", or a grown scene walked back to).
 */
export type Stage = 'move' | 'at' | 'hold' | 'whole' | 'after';

/** open: the first session's pages (the root, what it is not, why the body listens); whole: a meditation completed; inner: a returning player's one-time card (round 23) */
export type StoryKind = 'open' | 'whole' | 'inner';
export interface Story { kind: StoryKind; page: number; pages: number; t: number; med: string }

/** The first-time explanations (coach marks) and what each points at. */
export type Coach = 'grow' | 'nav' | 'pick' | 'breath' | 'blind';
export type CoachAt = 'focus' | 'controls' | 'list' | 'picture';

/** How the way reached a scene. */
export type Via = 'start' | 'auto' | 'prev' | 'next' | 'again' | 'pick';

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'scene'; med: string; scene: string; i: number; from: string | null; fromG: number; via: Via }
  | { type: 'tick'; scene: string; k: number }
  | { type: 'grown'; scene: string; med: string }
  | { type: 'whole'; med: string }
  | { type: 'gold'; on: boolean }
  | { type: 'growing'; on: boolean }
  | { type: 'breathTurn'; inhale: boolean }
  | { type: 'units'; n: number; at: 'grow' | 'blind' }
  | { type: 'blindEnd'; share: number; units: number; gained: number }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: StoryKind; page: number }
  | { type: 'stay' }
  | { type: 'picker'; open: boolean }
  | { type: 'mode'; mode: Mode }
  | { type: 'received'; from: ReceivedFrom; text: string }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** Lift blocks shorter than `min` by taking from the longest, keeping the sum. */
function liftShort(durs: number[], min: number): void {
  for (let guard = 0; guard < 20; guard++) {
    const i = durs.findIndex(d => d < min - 1e-9);
    if (i < 0) return;
    const need = min - durs[i];
    let j = 0;
    for (let k = 1; k < durs.length; k++) if (durs[k] > durs[j]) j = k;
    if (durs[j] - need < min) return;
    durs[j] -= need;
    durs[i] = min;
  }
}

/** The rest's whole breaths: the player's (the lobby's dial), kept whole and inside its range, or the design's 3. */
export const restBreathsOf = (n?: number | null): number =>
  Math.round(clamp(typeof n === 'number' && Number.isFinite(n) ? n : RULES.restBreaths, RULES.restBreathsDial.min, RULES.restBreathsDial.max));

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in 3, 6 s in a
 * short test); then push / rest pairs ending with a rest, leaving the quiet last stretch at the end.  A rest is whole
 * breaths of the guide (3 by design, 30 s, or the player's 1–6), the pushes take the rest of the time — 40 ± 5 s by
 * design or the player's mean with the jitter scaled, as many pairs as bring their mean nearest it, jittered when
 * there is room.  Any planned length from 10 s gets at least one push and one rest.  With `settle` (round 23) a
 * session of SETTLE.fromSec and more opens with the settling-in rest — SETTLE.breaths whatever the rest dial says,
 * before the warm-up — taken from the session's time like any block; a short test never gets it.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number, rhythm?: { focus: number; rest: number } | null, settle = false): Block[] {
  const R = { ...RULES, push: scaledBlock(RULES.push, rhythm?.focus ?? RULES.push[0]) };
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * 4, plannedSec - fin);
    if (firstEver) {
      const warm = Math.min(R.warm.test, left / 3), rest = left - warm;
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(4, Math.min(14, left / 2));
    return [b('push', left - rest), b('rest', rest)];
  }
  const plan: Block[] = [];
  let left = plannedSec - fin;
  if (settle && plannedSec >= SETTLE.fromSec) {
    const d = SETTLE.breaths * BREATH;
    plan.push({ kind: 'rest', dur: d, blind: false, settle: true });
    left -= d;
  }
  if (firstEver) {
    const warm = plannedSec >= 300 ? R.warm.long : R.warm.short;
    plan.push(b('warmup', warm));
    left -= warm;
  }
  const restSec = restBreathsOf(rhythm?.rest) * BREATH;
  // as many pairs as bring the pushes' mean nearest the design (never under the shortest block)
  const meanOf = (n: number): number => (left - n * restSec) / n;
  let pairs = Math.max(1, Math.floor(left / (R.push[0] + restSec)));
  if (meanOf(pairs + 1) >= R.minBlock && Math.abs(meanOf(pairs + 1) - R.push[0]) < Math.abs(meanOf(pairs) - R.push[0])) pairs++;
  const rests = new Array<number>(pairs).fill(restSec);
  // a session too short for its pushes: the rests give back their breaths, down to one, from the last
  for (let i = pairs - 1; i >= 0 && left - rests.reduce((s, d) => s + d, 0) < pairs * R.minBlock; i--) rests[i] = Math.min(rests[i], BREATH);
  const pushLeft = Math.max(pairs * R.minBlock, left - rests.reduce((s, d) => s + d, 0));
  const jitter = pairs >= 2 && meanOf(pairs) >= R.push[0] * 0.85 ? 1 : 0;
  const pushes: number[] = [];
  for (let i = 0; i < pairs; i++) pushes.push(R.push[0] + jitter * (rnd() * 2 - 1) * R.push[1]);
  const scale = pushLeft / pushes.reduce((s, d) => s + d, 0);
  for (let i = 0; i < pairs; i++) pushes[i] *= scale;
  liftShort(pushes, R.minBlock);
  for (let i = 0; i < pairs; i++) plan.push(b('push', pushes[i]), b('rest', rests[i]));
  return plan;
}

/** The growth multiplier for a focus frame: faster with the level and with a sustained hold. */
export function growMult(f: Pick<FocusFrame, 'level' | 'hold'>): number {
  return RULES.growBase + RULES.growLevel * clamp(f.level) + RULES.growHold * Math.min(1, Math.max(0, f.hold) / RULES.holdFull);
}

/** Seconds as the summary says them: "42 s", "1:42". */
export function secText(lib: Lib, s: number): string {
  const v = Math.max(0, Math.round(s));
  return v < 60 ? lib.t('secs', { n: v }) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}

/**
 * Where a session that stopped here resumes: a scene still growing keeps its growth; a grown one hands on to the next
 * scene (at the end of a meditation: the next one in order, else this meditation again).
 */
export function resumeFrom(lib: Lib, med: string, i: number, g: number, mode: Mode): Pos {
  if (g < 1 - 1e-9) return { med, scene: i, g: Math.max(0, g) };
  if (i + 1 < lib.sceneCount(med)) return { med, scene: i + 1, g: 0 };
  if (mode === 'order') return { med: lib.meds[(lib.meds.indexOf(med) + 1) % lib.meds.length], scene: 0, g: 0 };
  return { med, scene: 0, g: 0 };
}

export interface SimInit {
  lib: HealthLibrary;
  progress: HealthProgress;
  rng: () => number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
  /** the rest's rhythm the player set (kit/rhythm): the pushes' mean (s), the rests' whole breaths; absent: the rules' */
  rhythm?: { focus: number; rest: number } | null;
  /** the inner layer's choices (kit/inner.ts); absent: the player's, from this device (loadInner) */
  inner?: InnerPrefs;
}

export class HealthSim {
  readonly lib: Lib;
  readonly p: HealthProgress;
  readonly rng: () => number;
  readonly plannedSec: number;
  readonly eeg: boolean;
  /** this session's number (1 = the first ever) */
  readonly session: number;
  readonly firstEver: boolean;
  readonly talk: Talk;
  readonly contrast = new BlockContrast(4);
  /** units a second of focused growth at a multiplier of 1 */
  readonly unitsPerSec: number;
  private readonly judge: RoundJudge;
  private readonly lead: number;
  private readonly finaleSec: number;
  private readonly plan: Block[];
  private readonly pushesBase: number;
  private readonly bestBefore: number | null;
  /** the inner layer (round 23): the player's choices and this session's rests, words and received words */
  readonly inner: InnerPrefs;
  readonly track: InnerTrack;
  /** seconds the settling-in rest waited under an opening card (given back by the following blocks) */
  private held = 0;

  started = false;
  phase: 'play' | 'finale' | 'done' = 'play';
  t = 0;
  // the blocks
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  tip = '';
  private pushesBegun = 0;
  private relSec = 0;
  // the way
  mode: Mode;
  med: string;
  idx = 0;
  stage: Stage = 'move';
  stageT = 0;
  /** the scene the camera comes from (null at the start) */
  from: string | null = null;
  via: Via = 'start';
  /** the current scene's growth (0..1, as shown) and what a blind block gathers unseen */
  g = 0;
  hidden = 0;
  /** a blind block's growth being shown (from → to over revealSec; t < 0: none) */
  reveal = { from: 0, to: 0, t: -1 };
  /** growth gathered in the dark past a scene's end, or while the camera moved: the next scene starts with it */
  private carry = 0;
  /** each scene's growth this session (a scene walked back to shows as it was left) */
  private readonly sceneG = new Map<string, number>();
  private tickK = 0;
  /** seconds of focused growth in a grown scene that stays (it lives on gently) */
  afterSec = 0;
  // the light and the signal
  light: number = RULES.baseLight;
  private lightTrue: number = RULES.baseLight;
  calmShown = 0;
  deep = 0;
  reliable = false;
  growing = false;
  private gold = false;
  private goldRun = 0;
  private goodSaid = false;
  private stillRun = 0;
  private stillSaid = false;
  private unrelT = 0;
  private noSigSaid = false;
  // the breath, the hands, the cards
  breathT = 0;
  /** the scene's words glow again after a tap on the picture (s left) */
  reshow = 0;
  story: Story | null = null;
  picker = false;
  private pickerT = 0;
  // the units (the headline)
  units = 0;
  private unitsHidden = 0;
  private unitsAcc = 0;
  private unitsTick = 0;
  // the session's tallies
  growSec = 0;
  abideNow = 0;
  private abideRun = 0;
  private abideGap = 0;
  longestNow = 0;
  private readonly grownNow = new Map<string, number>();
  private readonly wholeNow = new Map<string, number>();
  private lastGrownMed: string | null = null;
  private passedRests = 0;
  private blindShare = -1;
  private navTaught = false;
  /** the session's counters reached the progress (once) */
  private settled = false;
  /** a coach mark of the runner is on screen until this time (s of play): the narrator waits for it */
  hintUntil = 0;
  private readonly events: SimEvent[] = [];
  // the session's arc (round 24): focused growth, a blind push's growth until its end, sighted seconds with a signal
  private arcG = 0;
  private arcHidden = 0;
  private arcSec = 0;
  private arcK = 0;
  private readonly arcScene: Record<string, number> = {};

  constructor(init: SimInit) {
    this.lib = libOf(init.lib);
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.eeg = init.eeg;
    this.session = this.p.sessions + 1;
    this.firstEver = this.p.sessions === 0;
    this.pushesBase = this.p.pushes;
    this.bestBefore = bestOf(this.p);
    this.unitsPerSec = Math.max(0, init.lib.perScene) / RULES.sceneSec;
    this.judge = RoundJudge.from(init.tuning);
    this.lead = this.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.finaleSec = finaleFor(this.plannedSec);
    this.plan = planBlocks(this.plannedSec, this.firstEver, init.rng, init.rhythm, true);
    this.inner = init.inner ?? loadInner();
    this.track = new InnerTrack(new InnerWords(this.inner, innerSource(this.inner, this.lib, this.session)), { in: RULES.inhale, out: RULES.exhale });
    this.talk = new Talk(m => this.lib.linesOf(m), init.rng);
    this.mode = this.p.mode;
    this.med = this.lib.isMed(this.p.pos.med) ? this.p.pos.med : this.lib.meds[0];
    this.idx = Math.min(this.lib.sceneCount(this.med) - 1, Math.max(0, this.p.pos.scene));
    this.g = clamp(this.p.pos.g);
  }

  // ── what the view and the runner read ───────────────────────────
  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.blockIndex + 1 < this.plan.length ? this.plan[this.blockIndex + 1] : null; }
  get blocks(): readonly Block[] { return this.plan; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get warmBlock(): boolean { return this.phase === 'play' && this.block.kind === 'warmup'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the picture answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get score(): number { return Math.floor(this.units); }
  get goldOn(): boolean { return this.gold; }
  get scene(): string { return this.lib.sceneAt(this.med, this.idx); }
  get count(): number { return this.lib.sceneCount(this.med); }
  /** the camera's way to the current scene (0..1) */
  get moveK(): number { return this.stage === 'move' ? ease.inOutSine(clamp(this.stageT / RULES.moveSec)) : 1; }
  /** the scene's growth as the picture draws it (a grown scene stays whole) */
  get shown(): number { return this.stage === 'hold' || this.stage === 'whole' || this.stage === 'after' ? 1 : this.g; }
  /** the narrator must wait: a telegraph, the runner's banner, a story card, the picker, a coach mark */
  get talkBlocked(): boolean {
    if (this.story || this.picker || this.t < this.hintUntil) return true;
    if (this.phase !== 'play') return false;
    return this.telegraphed || this.blockT < RULES.bannerSec;
  }
  /** the breath guide: 'in' for 4 s, 'out' for 6 s, how far through the current half (0..1), and the chest's fullness k */
  get breath(): { inhale: boolean; p: number; k: number } {
    const x = ((this.breathT % BREATH) + BREATH) % BREATH;
    const inhale = x < RULES.inhale;
    const p = inhale ? x / RULES.inhale : (x - RULES.inhale) / RULES.exhale;
    const k = inhale ? 0.5 - 0.5 * Math.cos(Math.PI * p) : 0.5 + 0.5 * Math.cos(Math.PI * p);
    return { inhale, p, k };
  }
  /** the rest's breath for the kit's guide (4 in, 6 out from the rest's start), null outside a rest */
  get breathNow(): BreathState | null { return this.restBlock ? breathAt(BREATH_DEFAULT, this.breathT) : null; }
  /** the rest's whole breaths (the guide's "oddech n z m") */
  get breaths(): number { return this.restBlock ? Math.max(1, Math.round(this.block.dur / BREATH)) : 0; }
  /** the settling-in rest waits while an opening card is up (its clock and its breath hold) */
  get holding(): boolean { return this.phase === 'play' && !!this.block.settle && !!this.story && this.held < SETTLE_HOLD_MAX; }
  /** a settling-in rest now */
  get settleBlock(): boolean { return this.restBlock && !!this.block.settle; }
  /**
   * The narrator holds a new line (round 23): in a rest whose breath carries a word, a line begins only in the first
   * moment of an in-breath — it speaks on the in-breath, the word has the out-breath.
   */
  get quiet(): boolean {
    const n = this.innerNow;
    if (!n || n.show.kind === 'verse') return false;
    return n.out || n.p * RULES.inhale > QUIET_START;
  }
  /** What the rest shows now in the words band (round 23): the breath's show, its out-breath and how far through. */
  get innerNow(): InnerNow | null { return this.restBlock && !this.holding ? this.track.at(this.breathT) : null; }
  /** The finale's line in the words band: the word of peace for the day (or the night); null with the words off. */
  get finaleLine(): string | null {
    if (this.phase !== 'finale' || !this.inner.words) return null;
    const word = cueText(this.inner, this.lib);
    return word ? this.lib.t(this.inner.night ? 'finale.night' : 'finale.cue', { word }) : null;
  }
  /** How many scenes of a meditation were grown this session. */
  grownIn(med: string): number { return this.lib.med(med).scenes.reduce((n, s) => n + (this.grownNow.get(s) ? 1 : 0), 0); }
  /** Whether a scene was grown this session. */
  grownThis(s: string): boolean { return (this.grownNow.get(s) ?? 0) > 0; }
  /** Meditations completed this session. */
  get wholes(): number {
    let n = 0;
    for (const v of this.wholeNow.values()) n += v;
    return n;
  }
  /** Round 24: how far this session's arc has come (0..1, never falls; see ARC) — WorldState.arc. */
  get arc(): number { return this.arcK; }
  /** Round 24: this session's focused growth per scene (scene units, repeats add up) — WorldState.session. */
  get sessionGrowth(): Readonly<Record<string, number>> { return this.arcScene; }

  /** The sighted seconds the plan still holds from now (a push past its lead-in; the warm-up at its rate). */
  private sightedLeft(): number {
    if (this.phase !== 'play') return 0;
    let s = 0;
    for (let i = this.blockIndex; i < this.plan.length; i++) {
      const b = this.plan[i], t = i === this.blockIndex ? this.blockT : 0;
      if (b.kind === 'push') s += Math.max(0, b.dur - Math.max(t, this.lead));
      else if (b.kind === 'warmup') s += Math.max(0, b.dur - t) * RULES.warmK;
    }
    return s;
  }

  /** Focused growth reaches the session's arc (see ARC). */
  private addArc(scene: string, dg: number): void {
    if (dg <= 0) return;
    const left = this.sightedLeft();
    const pace = (ARC.prior * ARC.priorSec + this.arcG) / (ARC.priorSec + this.arcSec);
    const total = Math.max(this.arcG + pace * left, ARC.floor * (this.arcSec + left), 1e-6);
    this.arcG += dg;
    this.arcK = Math.min(1, this.arcK + dg / (ARC.margin * total));
    this.arcScene[scene] = (this.arcScene[scene] ?? 0) + dg;
  }

  // ── the session ────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.startBlock(0);
    this.enter(this.med, this.idx, 'start', this.g);
    if (this.firstEver && markSeen(this.p, 's.open')) {
      // three pages: the root, what it is not, why the body listens (round 23) — so the one-time card is not needed
      markSeen(this.p, 's.inner');
      this.story = { kind: 'open', page: 0, pages: 3, t: 0, med: this.med };
      this.emit({ type: 'story', kind: 'open', page: 0 });
      this.talk.ask('open', 3, 30);
    } else if (markSeen(this.p, 's.inner')) {
      // a returning player meets the inner layer once
      this.story = { kind: 'inner', page: 0, pages: 1, t: 0, med: this.med };
      this.emit({ type: 'story', kind: 'inner', page: 0 });
      this.talk.ask('open', 1, 16);
    } else this.talk.ask('open', 1, 6);
  }

  /** One frame of play. */
  update(dt: number, f: FocusFrame, now: number): void {
    if (!this.started || this.phase === 'done') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.t = now;
    this.reliable = f.reliable && f.activity !== null;
    // the settling rest's time under the opening card is not the rest's (its verdict needs its own reliable seconds)
    if (this.reliable && !this.holding) this.relSec += dt;
    // the arc's pace counts the sighted time with a signal (round 24)
    if (this.reliable && this.phase === 'play' && ((this.pushBlock && this.blockT >= this.lead) || this.warmBlock)) this.arcSec += dt * (this.warmBlock ? RULES.warmK : 1);
    if (this.phase === 'play') this.schedule(dt, f, now);
    if (this.phase === 'finale' && now >= this.plannedSec) this.end();
    // end() moved the phase on (TypeScript narrowed it before the calls above)
    if ((this.phase as string) === 'done') return;
    this.updateLight(dt, f);
    this.updateBreath(dt);
    this.updateInner(dt);
    this.updateStory(dt);
    if (!this.story) this.updateWay(dt, f);
    else this.setGrowing(false);
    this.updateUnits(dt);
    this.updateAbide(dt);
    this.reshow = Math.max(0, this.reshow - dt);
    if (this.picker) {
      this.pickerT += dt;
      if (this.pickerT >= RULES.pickerIdle) this.closePicker();
    }
    this.talk.update(dt, now, this.talkBlocked, this.quiet);
  }

  private updateLight(dt: number, f: FocusFrame): void {
    // the light the brain gives: in a push past its lead-in with a signal, else the neutral base
    const live = this.pushBlock && this.blockT >= this.lead && this.reliable;
    this.lightTrue = approach(this.lightTrue, live ? clamp(f.level) : RULES.baseLight, dt, RULES.lightTau);
    if (this.sighted) this.light = this.lightTrue;
    else this.light = approach(this.light, this.restBlock ? RULES.restLight : RULES.baseLight, dt, RULES.lightTau);
    this.calmShown = approach(this.calmShown, this.restBlock && this.reliable ? clamp(f.calm) : 0, dt, 0.8);
    // rest deepens the picture with calm (the finale settles it gently); elsewhere the depth fades slowly
    if (this.restBlock) this.deep = approach(this.deep, this.calmShown, dt, RULES.deepTau);
    else if (this.phase === 'finale') this.deep = approach(this.deep, 0.5, dt, RULES.deepTau);
    else this.deep = approach(this.deep, 0, dt, RULES.deepFade);
    const gold = this.sighted && this.reliable && this.light >= RULES.gold;
    if (gold !== this.gold) {
      this.gold = gold;
      this.emit({ type: 'gold', on: gold });
    }
    this.goldRun = gold ? this.goldRun + dt : 0;
    if (this.goldRun >= RULES.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 5);
    }
    // no signal for a while in a push: the sensor, never the player
    this.unrelT = this.pushBlock && !this.reliable ? this.unrelT + dt : 0;
    if (this.unrelT > 3 && !this.noSigSaid) {
      this.noSigSaid = true;
      this.talk.ask('nosignal', 2, 6);
    }
  }

  private updateBreath(dt: number): void {
    if (!this.restBlock || this.holding) return;
    const before = this.breath.inhale;
    this.breathT += dt;
    if (before !== this.breath.inhale) this.emit({ type: 'breathTurn', inhale: this.breath.inhale });
  }

  /** The rest's words (round 23): an out-breath held in calm under a word or the word of peace is received. */
  private updateInner(dt: number): void {
    if (!this.restBlock || this.holding || this.story) return;
    const got = this.track.update(this.breathT, dt, this.calmShown, this.reliable);
    if (got) this.emit({ type: 'received', ...got });
  }

  private updateStory(dt: number): void {
    const s = this.story;
    if (!s) return;
    s.t += dt;
    if (s.t >= (s.kind === 'whole' ? RULES.closeSec : RULES.pageSec)) this.turnStory();
  }

  /** The next page of a story card, or close it (a tap, or its time ran out). */
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
    if (s.kind === 'whole') this.afterWhole(s.med);
  }

  // ── growth (only with focus) ───────────────────────────────────
  /** The picture may grow now: a push past its lead-in or the warm-up, a scene that grows, no card over it. */
  get canGrow(): boolean {
    if (!this.started || this.phase !== 'play' || this.story) return false;
    if (this.stage !== 'at' && this.stage !== 'after') return false;
    const b = this.block;
    return b.kind === 'warmup' || (b.kind === 'push' && this.blockT >= this.lead);
  }

  /** The scene's growth per second for a focus frame now (0 without focus). */
  growRate(f: FocusFrame): number {
    if (!this.canGrow || !this.reliable || !f.focused) return 0;
    return (growMult(f) / RULES.sceneSec) * (this.warmBlock ? RULES.warmK : 1);
  }

  private setGrowing(on: boolean): void {
    if (on === this.growing) return;
    this.growing = on;
    this.emit({ type: 'growing', on });
  }

  private updateWay(dt: number, f: FocusFrame): void {
    this.stageT += dt;
    switch (this.stage) {
      case 'move':
        this.setGrowing(false);
        if (this.stageT >= RULES.moveSec) this.arrive();
        break;
      case 'at':
      case 'after': {
        this.updateReveal(dt);
        const rate = this.growRate(f);
        this.setGrowing(rate > 0);
        this.watchStill(dt, f);
        if (rate <= 0) break;
        const dg = rate * dt;
        const units = this.unitsPerSec * RULES.sceneSec * dg;
        this.growSec += dt;
        if (this.blind) {
          if (this.stage === 'at') this.hidden = Math.min(Math.max(0, 1 - this.g) + RULES.blindCarry, this.hidden + dg);
          this.unitsHidden += units;
          this.arcHidden += dg;
        } else {
          this.addArc(this.scene, dg);
          this.units += units;
          this.unitsAcc += units;
          if (this.stage === 'after') this.afterSec += dt;
          else this.grow(dg);
        }
        break;
      }
      case 'hold':
        this.setGrowing(false);
        if (this.stageT >= RULES.holdSec) {
          if (this.idx >= this.count - 1) this.wholeMed();
          else this.enter(this.med, this.idx + 1, 'auto');
        }
        break;
      case 'whole':
        this.setGrowing(false);
        if (this.stageT >= RULES.wholeSec) {
          this.closePicker();
          this.story = { kind: 'whole', page: 0, pages: 1, t: 0, med: this.med };
          this.emit({ type: 'story', kind: 'whole', page: 0 });
          this.stageT = -Infinity;
        }
        break;
    }
    if (this.stage === 'at' && this.g >= 1 - 1e-9 && this.reveal.t < 0) this.complete();
  }

  /** The scene grows (shown at once; during a reveal the end it goes to moves on instead, so nothing is lost). */
  private grow(n: number): void {
    if (n <= 0 || this.stage !== 'at') return;
    if (this.reveal.t >= 0) {
      this.reveal.to = Math.min(1, this.reveal.to + n);
      return;
    }
    this.g = Math.min(1, this.g + n);
    this.ticks();
  }

  /** A tenth of the scene grown: a small event (a glint, a glass tone) so the sound follows the growth. */
  private ticks(): void {
    const k = Math.floor(this.g * 10 + 1e-9);
    while (this.tickK < k && this.tickK < 10) {
      this.tickK++;
      this.emit({ type: 'tick', scene: this.scene, k: this.tickK });
    }
  }

  /** A blind block's growth shown at its end: the picture grows quickly to where it got. */
  private updateReveal(dt: number): void {
    const r = this.reveal;
    if (r.t < 0) return;
    r.t += dt;
    const k = ease.outCubic(clamp(r.t / RULES.revealSec));
    this.g = r.from + (r.to - r.from) * k;
    this.ticks();
    if (r.t >= RULES.revealSec) {
      this.g = r.to;
      r.t = -1;
    }
  }

  /** A sighted push with a signal but without focus for a while: the narrator says the picture waits (once a block). */
  private watchStill(dt: number, f: FocusFrame): void {
    const waiting = this.sighted && this.reliable && !f.focused && this.stage === 'at';
    this.stillRun = waiting ? this.stillRun + dt : 0;
    if (this.stillRun >= RULES.stillSec && !this.stillSaid) {
      this.stillSaid = true;
      this.talk.ask('still', 1.5, 6);
    }
  }

  // ── the way through the library ─────────────────────────────────
  /** Go to a scene (the camera moves there); it shows as it was left this session, or from `g`. */
  private enter(med: string, i: number, via: Via, g?: number): void {
    const prev = this.scene;
    const fromG = this.shown;
    // keep what the current scene had grown this session (a grown one stays grown)
    if (this.stage === 'at' || this.stage === 'move') this.sceneG.set(this.scene, this.g);
    else if (this.stage === 'hold' || this.stage === 'whole' || this.stage === 'after') this.sceneG.set(this.scene, 1);
    const changedMed = med !== this.med;
    this.med = med;
    this.idx = Math.max(0, Math.min(this.lib.sceneCount(med) - 1, i));
    this.from = via === 'start' ? null : prev;
    this.via = via;
    this.stage = 'move';
    this.stageT = 0;
    this.g = via === 'again' ? 0 : clamp(g ?? this.sceneG.get(this.scene) ?? 0);
    this.hidden = 0;
    this.reveal.t = -1;
    this.afterSec = 0;
    this.tickK = Math.floor(this.g * 10 + 1e-9);
    if (changedMed && (this.mode !== 'order' || via === 'pick')) this.chooseMed(med);
    this.talk.drop(m => m.startsWith('at.'));
    if (via !== 'again') this.talk.ask(`at.${this.scene}`, via === 'auto' || via === 'start' ? 1.5 : 1.2, 9);
    if (this.pushBlock) this.tip = this.tipFor(this.block);
    this.emit({ type: 'scene', med, scene: this.scene, i: this.idx, from: this.from, fromG, via });
  }

  /** The camera has arrived: the scene grows (or, grown already, stays), starting with any growth carried over. */
  private arrive(): void {
    this.stageT = 0;
    if (this.g >= 1 - 1e-9) {
      this.g = 1;
      this.stage = 'after';
      return;
    }
    this.stage = 'at';
    if (this.carry > 0) {
      this.g = Math.min(0.999, this.g + this.carry);
      this.carry = 0;
      this.ticks();
    }
    if (this.sighted) this.coach('grow', 'focus');
  }

  /** The scene has grown by focus: a moment in its light, the tally. */
  private complete(): void {
    const s = this.scene;
    this.g = 1;
    this.stage = 'hold';
    this.stageT = 0;
    this.sceneG.set(s, 1);
    this.grownNow.set(s, (this.grownNow.get(s) ?? 0) + 1);
    this.emit({ type: 'grown', scene: s, med: this.med });
    if (this.idx < this.count - 1 && this.rng() < 0.45) this.talk.ask('grown', 1, 4);
    this.teachNav();
  }

  /** The meditation's last scene has grown: the whole of it, then its closing card. */
  private wholeMed(): void {
    this.stage = 'whole';
    this.stageT = 0;
    this.wholeNow.set(this.med, (this.wholeNow.get(this.med) ?? 0) + 1);
    this.lastGrownMed = this.med;
    this.emit({ type: 'whole', med: this.med });
    this.talk.ask('whole', 3, 8);
  }

  /** After a meditation's closing card: the next one in order, this one again, or stay with its picture. */
  private afterWhole(med: string): void {
    const meds = this.lib.meds;
    if (this.mode === 'order') {
      const next = meds[(meds.indexOf(med) + 1) % meds.length];
      // round again (a long session goes round the library): a scene grown whole earlier this session grows again —
      // else it would arrive grown and the way would stop there, in its "after"
      for (const s of this.lib.med(next).scenes) if ((this.sceneG.get(s) ?? 0) >= 1 - 1e-9) this.sceneG.delete(s);
      this.enter(next, 0, 'auto');
      return;
    }
    if (this.mode === 'repeat') {
      this.enter(med, 0, 'auto', 0);
      // after enter(), which keeps the last scene as grown: all of it grows again (else the second time round would
      // stop at its last scene, arrived grown)
      for (const s of this.lib.med(med).scenes) this.sceneG.delete(s);
      this.talk.ask('again', 2, 8);
      return;
    }
    this.stage = 'after';
    this.stageT = 0;
    this.talk.ask('after', 2, 10);
  }

  /** The chosen meditation follows the player's walk (the next session begins there in "just this one" and "repeat"). */
  private chooseMed(med: string): void {
    this.p.chosen = med;
  }

  /** The previous scene (across meditations, round the library). */
  prevScene(): boolean {
    if (!this.canWalk) return false;
    this.closePicker();
    const s = this.lib.step(this.med, this.idx, -1);
    this.enter(s.med, s.i, 'prev');
    return true;
  }

  /** The next scene (across meditations, round the library). */
  nextScene(): boolean {
    if (!this.canWalk) return false;
    this.closePicker();
    const s = this.lib.step(this.med, this.idx, 1);
    this.enter(s.med, s.i, 'next');
    return true;
  }

  /** This scene again, from its start (what was counted stays counted). */
  again(): boolean {
    if (!this.canWalk) return false;
    this.closePicker();
    this.sceneG.delete(this.scene);
    this.enter(this.med, this.idx, 'again', 0);
    this.talk.ask('again', 1.2, 6);
    return true;
  }

  /** Another meditation from the picker: its first scene (as it was left this session). */
  pick(med: string): boolean {
    if (!this.canWalk || !this.lib.isMed(med)) return false;
    this.closePicker();
    this.enter(med, 0, 'pick');
    return true;
  }

  /** The play mode from the picker (kept for the next session too). */
  setMode(mode: Mode): boolean {
    if (!this.started || this.phase === 'done' || !setMode(this.p, mode)) return false;
    this.mode = mode;
    this.pickerT = 0;
    this.emit({ type: 'mode', mode });
    return true;
  }

  /** The walk's controls answer: a session in play without a card over it. */
  get canWalk(): boolean { return this.started && this.phase !== 'done' && !this.story; }

  togglePicker(): boolean {
    if (!this.canWalk) return false;
    if (this.picker) this.closePicker();
    else {
      this.picker = true;
      this.pickerT = 0;
      this.emit({ type: 'picker', open: true });
    }
    return true;
  }

  closePicker(): void {
    if (!this.picker) return;
    this.picker = false;
    this.emit({ type: 'picker', open: false });
  }

  /** A tap on the picture, a click, Space: turn a story card's page (after a moment); else stay with the picture. */
  stay(): boolean {
    if (!this.started || this.phase === 'done') return false;
    if (this.story) {
      if (this.story.t >= RULES.tapAfter) this.turnStory();
      return true;
    }
    if (this.picker) {
      this.closePicker();
      return true;
    }
    this.reshow = RULES.reshowSec;
    this.emit({ type: 'stay' });
    return true;
  }

  /** Keys during play: ← → the scenes, R this scene again, M the picker (1–9 pick while it is open), Space and Enter stay / turn a card. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const act = (fn: () => unknown): boolean => {
      if (down) fn();
      return true;
    };
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') return act(() => this.stay());
    if (k === 'ArrowLeft') return act(() => this.prevScene());
    if (k === 'ArrowRight') return act(() => this.nextScene());
    if (k === 'r') return act(() => this.again());
    if (k === 'm') return act(() => this.togglePicker());
    if (this.picker && /^[1-9]$/.test(k) && Number(k) <= this.lib.meds.length) return act(() => this.pick(this.lib.meds[Number(k) - 1]));
    return false;
  }

  // ── the units and the calm ──────────────────────────────────────
  private updateUnits(dt: number): void {
    this.unitsTick += dt;
    if (this.unitsTick >= 2) {
      const shown = Math.floor(this.unitsAcc);
      if (shown >= 1) this.emit({ type: 'units', n: shown, at: 'grow' });
      this.unitsAcc -= shown;
      this.unitsTick = 0;
    }
  }

  private updateAbide(dt: number): void {
    // a card over the rest (the settling rest held under the opening card, the one-time card): no breath guide, no calm counted
    if (!this.restBlock || this.holding || this.story) {
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

  // ── the blocks ─────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, now: number): void {
    const b = this.block, R = RULES;
    const hold = this.holding;
    if (hold) this.held += dt;
    else this.blockT += dt;
    if (b.kind !== 'warmup' && !hold) {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    if (b.kind === 'push' && this.blockT >= this.lead && this.blockT - dt < this.lead && this.stage === 'at' && !b.blind) this.coach('grow', 'focus');
    if (b.kind === 'rest' && this.blockT >= R.bannerSec && this.blockT - dt < R.bannerSec) this.coach('breath', 'picture');
    if (now >= 40 && now - dt < 40) this.teachNav();
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || now >= this.plannedSec - this.finaleSec) {
      this.endBlock();
      this.beginFinale();
    } else if (!last && this.blockT >= b.dur) {
      this.endBlock();
      this.startBlock(this.blockIndex + 1);
    }
  }

  /** The controls are taught once: after the first scene grown, or 40 s into a session. */
  private teachNav(): void {
    if (this.navTaught) return;
    this.navTaught = true;
    this.coach('nav', 'controls');
    this.coach('pick', 'list');
  }

  private startBlock(i: number): void {
    // a settling-in rest that waited under an opening card: the following blocks give those seconds back
    if (i > 0 && this.plan[i - 1].settle && this.held > 0) {
      absorbHold(this.plan, i, this.held, x => (x.kind === 'warmup' ? RULES.warm.test : RULES.minBlock));
      this.held = 0;
    }
    this.blockIndex = i;
    this.blockT = 0;
    this.telegraphed = false;
    this.relSec = 0;
    this.judge.reset();
    this.goodSaid = false;
    this.noSigSaid = false;
    this.stillSaid = false;
    this.goldRun = 0;
    this.stillRun = 0;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    // after the settling-in rest the scene's own line comes (it waited under the settling words)
    if (i > 0 && this.plan[i - 1].settle && !this.lib.linesOf(`at.${this.scene}`).some(l => this.talk.said.includes(l))) {
      this.talk.ask(`at.${this.scene}`, 1.5, 12);
    }
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      if (b.blind) {
        this.talk.ask('blind', 3, 12);
        this.coach('blind', 'picture');
      }
    } else if (b.kind === 'rest') {
      this.breathT = 0;
      // the guide's first in-breath begins with the block
      this.emit({ type: 'breathTurn', inhale: true });
      // what each breath shows: the settling-in words, the meditation's verse the first time, words for the body
      this.track.begin(this.med, Math.max(1, Math.round(b.dur / BREATH)), !!b.settle);
      this.talk.ask(b.settle ? 'settle' : 'rest', 2, 12);
    } else this.talk.ask('warm', 1, 14);
    this.tip = this.tipFor(b);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's strategy: the scene's own picture in a push (counting every third), the breath in rest. */
  private tipFor(b: Block): string {
    const t = this.lib.t;
    if (b.kind === 'warmup') return t(TIPS.warmup);
    if (b.kind === 'push') {
      if (b.blind) return t(TIPS.blind[(this.session + this.blockIndex) % TIPS.blind.length]);
      return this.lib.pushTip(this.scene, this.pushesBegun - 1);
    }
    return t(TIPS.rest[(this.session - 1 + this.blockIndex) % TIPS.rest.length]);
  }

  /** The block's end: its verdict and, for a blind one, the growth gathered unseen — after its window, never during it. */
  private endBlock(): void {
    const b = this.block;
    let verdict: boolean | null = null, share = 0;
    if (b.kind !== 'warmup') {
      share = this.judge.share;
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'push' && b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        const gained = this.hidden;
        if (gained > 0) {
          if (this.stage === 'at') {
            this.reveal = { from: this.g, to: Math.min(1, this.g + gained), t: 0 };
            this.carry = Math.min(RULES.blindCarry, Math.max(0, this.g + gained - 1));
          } else this.carry = Math.min(RULES.blindCarry, gained);
          this.hidden = 0;
        }
        const n = Math.floor(this.unitsHidden);
        this.units += this.unitsHidden;
        this.unitsHidden = 0;
        // the arc too sees a blind push's growth at its end (round 24)
        this.addArc(this.scene, this.arcHidden);
        this.arcHidden = 0;
        this.emit({ type: 'blindEnd', share: s, units: n, gained });
        this.talk.ask('blindEnd', 2, 6);
      }
      if (b.kind === 'rest' && verdict) this.passedRests++;
    }
    if (b.kind === 'rest') {
      const got = this.track.end();
      if (got && !this.story) this.emit({ type: 'received', ...got });
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.telegraphed = false;
    this.setGrowing(false);
    this.closePicker();
    this.emit({ type: 'finale' });
    // before sleep the narrator says goodnight and lets sleep come
    this.talk.ask(this.inner.night ? 'night' : 'end', 3, 10);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.settle();
    this.phase = 'done';
    this.emit({ type: 'done' });
  }

  /** The session's counters reach the progress once (at the end, or early with finish()). */
  private settle(): void {
    if (this.settled) return;
    this.settled = true;
    // a blind block cut short still pays what it gathered
    this.units += this.unitsHidden;
    this.unitsHidden = 0;
    const p = this.p;
    p.sessions++;
    p.pushes += this.pushesBegun;
    for (const [s, n] of this.grownNow) p.grown[s] = (p.grown[s] ?? 0) + n;
    for (const [m, n] of this.wholeNow) p.whole[m] = (p.whole[m] ?? 0) + n;
    p.units += this.score;
    p.abideBest = Math.max(p.abideBest, Math.round(this.longestNow * 10) / 10);
    p.abideAll += Math.round(this.abideNow);
    p.lastLen = this.plannedSec;
    p.mode = this.mode;
    p.pos = this.resumePos();
  }

  /** Where the next session begins. */
  resumePos(): Pos {
    const g = this.stage === 'move' || this.stage === 'at' ? Math.min(this.g + this.hidden, 0.999) : 1;
    return resumeFrom(this.lib, this.med, this.idx, g, this.mode);
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

  // ── output ─────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The panel's gauge: the light in a sighted push, calm in rest; null blind, without a signal, elsewhere. */
  meter(): number | null {
    if (!this.started || this.phase !== 'play' || !this.reliable) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.light);
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

  /** The tune's level: the focus in a sighted push, a gentle fixed level in rest and around, nothing in a blind block. */
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

  /** The session's numbers, idempotent: records with Math.max; the counters reached the progress once, in settle(). */
  result(): ArcadeOutcome {
    const p = this.p, t = this.lib.t;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    let grown = 0;
    for (const n of this.grownNow.values()) grown += n;
    // short values: the summary sets each in a tile with a large serif number
    const stats: [string, string][] = [
      [t('stat.scenes'), String(grown)],
      [t('stat.meds'), String(this.wholes)],
      [t('stat.focus'), secText(this.lib, this.growSec)],
      [t('stat.abide'), secText(this.lib, this.abideNow)],
      [t('stat.longest'), secText(this.lib, this.longestNow)],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: this.lib.unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the session fits, in turn from session to session: the library's root the first
   * time, the verse of a meditation completed (else the one walked in), then the library's closers, then the root.
   */
  closingVerse(): PassageId {
    // before sleep: Ps 4:8, Ps 127:2, Prov 3:24 in turn
    if (this.inner.night) return inTurn(NIGHT_CLOSERS, this.session || 1);
    const fit: PassageId[] = [];
    const spec = this.lib.spec;
    if (this.session === 1) fit.push(spec.root);
    fit.push(this.lib.med(this.lastGrownMed ?? this.med).verse);
    fit.push(...spec.closers, spec.root);
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const lib = this.lib, t = lib.t;
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    for (const m of lib.meds) if (this.wholeNow.get(m)) add(0, t('hl.whole', { med: lib.medName(m) }));
    if (!this.wholeNow.size) {
      const n = this.grownIn(this.med);
      if (n > 0) add(0, t('hl.grown', { scenes: t('scenes', { n }), med: lib.medName(this.med) }));
      else if (this.started && this.g > 0.05) add(0, t('hl.part', { scene: lib.sceneName(this.scene) }));
      else if (this.started) add(0, t('hl.calm'));
    }
    if (this.bestBefore !== null && this.score > this.bestBefore) add(1, t('hl.record', { units: lib.unitsText(this.score) }));
    else if (this.bestBefore !== null && this.score > 0 && this.bestBefore - this.score <= Math.max(60, this.bestBefore * 0.25)) {
      add(1, t('hl.toBest', { units: lib.unitsText(this.bestBefore - this.score) }));
    }
    // round 23: the words received in calm (never in the score), and a night's session
    if (this.track.received > 0) add(2, t('hl.received', { n: this.track.received }));
    if (this.inner.night) add(2.5, t('hl.night'));
    if (this.longestNow >= 10) add(3, t('hl.longest', { sec: secText(lib, this.longestNow) }));
    if (this.blindShare >= 0) add(4, t('hl.blind', { pct: t('pct', { n: this.blindShare }) }));
    const total = this.p.units + (this.settled ? 0 : this.score);
    if (total > this.score) add(4.5, t('hl.total', { units: lib.unitsText(total) }));
    const pos = this.settled ? this.p.pos : this.resumePos();
    add(5, t('hl.resume', { med: lib.medName(pos.med), n: pos.scene + 1, of: lib.sceneCount(pos.med) }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
