/**
 * Arka's rules and state, without the DOM or the canvas (so every rule is unit-tested).
 *
 * The open deck of Noah's ark, grounded after the flood: a grid of animals, each facing a way.  A
 * tap sends one straight out that way at 6 cells/s; with the way clear it leaves the deck and trots
 * along the rail to the landing by the door (0.6 s), else it walks up to the animal in its way,
 * bumps and walks back — touch is never punished.  On the landing an animal whose mate (any animal
 * of its kind) already waits makes a pair, and the two go down the ramp onto the new land: the
 * headline.  Otherwise it takes one of three stalls and waits; with every stall taken an animal
 * whose mate is not there walks to the edge, sees the full landing and turns back ("Pełno").  A
 * pair whose second animal was sent while its mate already waited is a chain link; links in a row
 * make a chain, and a new animal taking a stall breaks it.  A jam (every stall taken, nothing on the
 * deck free to pair) lasts 3 s at most: Noah's hand leads the longest-waiting animal back to its
 * cell, free (the hold only loses its ★★★).  An olive leaf does the same when the player wants it.
 * Every hold can be cleared without help (holds.ts proves it), and holds continue across blocks.
 *
 * The band only ever adds room and help.  The session alternates Day (push) and Evening (rest).
 * By Day, steady focus lets Noah's family lay planks, each a stall more for this hold (at most three):
 * after the lead-in (5 s Mendi, 2 s HALO) the plank progress grows at
 * (0.025 + 0.085·u) × (1 + min(hold, 18)/36), u from the level smoothed again (τ 3 s / 1 s); the
 * first plank of every hold is a gift after 15 s of its Day time.  In the Evening the deck sleeps
 * under straw and the dove flies out over the valley, farther while calm holds; its return is
 * judged by the kit's RoundJudge — a passed Evening brings an olive leaf (with an olive after 10 s
 * of deep calm: an olive tree in the valley), and grace brings one on the first Evening ever and
 * on the third after two without.  A passed Day carves a post for the homestead.  Every 4th Day
 * from the 4th session is "Mgła poranna": the planks grow unseen and appear at the Evening's
 * telegraph.  While the signal is unreliable everything brain-driven freezes (no gain, no loss),
 * touch keeps working and the block clock keeps running; a block with fewer than 8 reliable
 * seconds has no verdict, and a Day's planks are floored to the neutral rate's.
 *
 * Verses are never here: the summary's closing passage is chosen in result(), the lobby's root is
 * the registry's.
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import { fmtSigned } from '../../i18n';
import { ANCHOR, KIND, KINDS, RECIPES, SAWTOOTH, STAGES, TIPS, kindsAt, type KindId, type RecipeId } from './content';
import { DX, DY, blockedAt, generateHold, toEdge, type Dir, type Hold } from './holds';
import { t, unit } from './i18n';
import { DAY_GIFT, addHome, doveBringsLeaf, endEvening, kindsOut, mix, settle, type ArkaProgress } from './meta';

export const RULES = {
  /** cells per second on the deck */
  walk: 6,
  /** from the deck's edge along the rail to the landing (s) */
  rail: 0.6,
  /** a pair bows and goes down the ramp together (s), the bow first */
  pair: 0.8,
  bow: 0.25,
  /** a bump walks this far past the gap, onto the blocker's face (cells), and lasts at least `bumpMin` there and back */
  nudge: 0.3,
  bumpMin: 0.36,
  /** an animal looks at a full landing this long before it turns back (s) */
  look: 0.3,
  /** Noah's hand (or a leaf) leads an animal back to its cell (s) */
  back: 0.9,
  /** a jam waits this long for Noah's hand (s) */
  jam: 3,
  stalls: 3,
  maxPlanks: 3,
  /** the Day's lead-in before planks grow: the haemodynamic lag (Mendi), shorter on EEG */
  lead: 5,
  leadEeg: 2,
  /** the level smoothed again for the planks and the hammer, the calm for the dove */
  tau: 3,
  tauEeg: 1,
  u0: 0.35,
  uSpan: 0.5,
  base: 0.025,
  gain: 0.085,
  contMax: 18,
  contDiv: 36,
  /** the first plank of every hold comes by this much Day time of its own (s) */
  giftSec: 15,
  /** a block with fewer reliable seconds has no verdict; a Day's planks are floored to u = 0.4 */
  minReliable: 8,
  neutralU: 0.4,
  /** an olive with the leaf: mean calm ≥ 0.6 over the Evening's last 10 s */
  oliveCalm: 0.6,
  oliveSec: 10,
  /** the dove flies farther while calm ≥ 0.5 (share of its flight per second), and drifts back slowly otherwise */
  doveCalm: 0.5,
  doveOut: 0.07,
  doveIn: 0.03,
  telegraph: 4,
  finale: 5,
  finaleShort: 4,
  minBlock: 12,
  /** a new hold slides in (s); its animals wait for it */
  slide: 0.45,
  /** R held this long gives every waiting animal back to its cell */
  restartHold: 1,
  /** after a dropout this long the kit's level and calm climb back from 0: for `recover` s nothing brain-driven may fall */
  fogGap: 2,
  recover: 6,
  /** the hammer taps 0.5 + 2.5 L times a second */
  hammerMin: 0.5,
  hammerGain: 2.5,
  /** the day's first session: the neighbours' planks for the homestead */
  dayGift: DAY_GIFT,
  /** the session plan: rounds of Day and Evening, ±jitter */
  day: 26,
  dayJitter: 4,
  evening: 22,
  eveningJitter: 3,
  /** blind Days: from this session, every 4th Day counted across sessions, never a session's first */
  blindFrom: 4,
  blindEvery: 4,
  /** the stretch hold "Wielka ładownia" in sessions this long or longer, once, from this share of the session */
  greatFrom: 180,
  greatAt: 0.3,
} as const;

/** u: the level's share of the plank rate (0 at 0.35, 1 at 0.85). */
export const plankU = (L: number): number => clamp((L - RULES.u0) / RULES.uSpan);

/** Plank progress per second for the smoothed level L and the steady stretch `cont` (s). */
export const plankRate = (L: number, cont: number): number =>
  (RULES.base + RULES.gain * plankU(L)) * (1 + Math.min(Math.max(0, cont), RULES.contMax) / RULES.contDiv);

/** The neutral rate: a player without control (u = 0.4, no steady stretch). */
export const NEUTRAL_RATE = RULES.base + RULES.gain * RULES.neutralU;

// ── the session plan ─────────────────────────────────────────────
export type BlockKind = 'day' | 'evening';
export interface Block { kind: BlockKind; start: number; dur: number; blind: boolean }
export interface Plan { blocks: Block[]; finale: number }

/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/**
 * The session's blocks: Days and Evenings alternate and the last is always an Evening, then the
 * finisher.  A 40 s session (the tests) plays Day 24 s, Evening 12 s, finisher 4 s; from 60 s on,
 * max(1, round((planned − 5)/48)) rounds of Day 26 ± 4 s and Evening 22 ± 3 s (jitter only when the
 * room allows), scaled to end on time, no block under 12 s, finisher 5 s.
 */
export function planBlocks(plannedSec: number, rnd: () => number): Plan {
  const durs: number[] = [];
  let finale: number;
  if (plannedSec < 60) {
    finale = RULES.finaleShort;
    const room = Math.max(0, plannedSec - finale);
    const eve = Math.min(12, room / 3);
    durs.push(room - eve, eve);
  } else {
    finale = RULES.finale;
    const room = plannedSec - finale;
    const rounds = Math.max(1, Math.round(room / (RULES.day + RULES.evening)));
    const jitter = room / (rounds * (RULES.day + RULES.evening)) >= 0.75 ? 1 : 0;
    for (let i = 0; i < rounds; i++) {
      durs.push(RULES.day + jitter * (rnd() * 2 - 1) * RULES.dayJitter, RULES.evening + jitter * (rnd() * 2 - 1) * RULES.eveningJitter);
    }
    const scale = room / durs.reduce((s, d) => s + d, 0);
    for (let i = 0; i < durs.length; i++) durs[i] *= scale;
    liftShort(durs, RULES.minBlock);
  }
  const blocks: Block[] = [];
  let at = 0;
  durs.forEach((dur, i) => {
    blocks.push({ kind: i % 2 ? 'evening' : 'day', start: at, dur, blind: false });
    at += dur;
  });
  return { blocks, finale };
}

// ── the animals ──────────────────────────────────────────────────
/**
 * deck: in its cell · bump: walking to the animal in its way and back · full: to the edge, a look at
 * the full landing, back · out: walking off the deck · rail: trotting to the landing · stall: waiting ·
 * pair: bowing and going down the ramp · back: led back to its cell · gone: on the new land
 */
export type BeastState = 'deck' | 'bump' | 'full' | 'out' | 'rail' | 'stall' | 'pair' | 'back' | 'gone';

export interface Beast {
  readonly id: number;
  readonly kind: KindId;
  /** its own cell and facing */
  readonly x: number;
  readonly y: number;
  readonly dir: Dir;
  state: BeastState;
  /** seconds in this state, and the state's length */
  t: number;
  dur: number;
  /** cells walked out (bump: to the blocker's face; full: to the edge; out: to the edge) */
  dist: number;
  /** its stall on the landing (−1: none): its own, or the one of the mate it pairs with */
  stall: number;
  /** the first of its pair on the landing: it holds the stall */
  owner: boolean;
  /** the animal it pairs with (set when the second is sent) */
  mate: Beast | null;
  /** sent while its mate already waited (a chain link), and the chain's length with it */
  link: boolean;
  chain: number;
  /** when it began to wait (play time) */
  since: number;
  /** the stall it was led back from (the view draws the walk back) */
  was: number;
}

const MOVING: ReadonlySet<BeastState> = new Set(['bump', 'full', 'out', 'rail', 'back']);
export const moving = (b: Beast): boolean => MOVING.has(b.state);

export interface HoldRun {
  /** the session's hold number (1 = the warm-up) */
  readonly n: number;
  readonly recipe: RecipeId;
  readonly daily: boolean;
  readonly cols: number;
  readonly rows: number;
  readonly beasts: Beast[];
  /** beasts' indices by cell (−1: empty) */
  readonly grid: Int16Array;
  /** planks laid (they show and count as stalls), and earned unseen in a blind Day */
  planks: number;
  pending: number;
  /** the hold's Day time (the first plank's gift), Noah's hands, seconds since it slid in, pairs */
  dayT: number;
  hands: number;
  t: number;
  pairs: number;
  /** seconds left of its slide-in */
  slide: number;
  gift: boolean;
}

export type SimEvent =
  | { type: 'send'; beast: Beast; link: boolean }
  | { type: 'bump'; beast: Beast; by: Beast | null }
  | { type: 'full'; beast: Beast }
  | { type: 'wait'; beast: Beast }
  | { type: 'pair'; a: Beast; b: Beast; link: boolean; chain: number }
  | { type: 'jam' }
  | { type: 'hand'; beast: Beast; leaf: boolean }
  | { type: 'home'; beast: Beast }
  | { type: 'clear'; hold: HoldRun; stars: number; planks: number }
  | { type: 'hold'; hold: HoldRun }
  | { type: 'plank'; planks: number; blind: boolean; gift: boolean }
  | { type: 'blindReveal'; planks: number }
  | { type: 'telegraph'; next: BlockKind }
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null }
  | { type: 'post' }
  | { type: 'almost'; have: number; need: number }
  | { type: 'dove'; leaf: boolean; olive: boolean; grace: boolean; stored: boolean }
  | { type: 'kind'; kinds: KindId[] }
  | { type: 'young'; kind: KindId }
  | { type: 'built'; stage: number }
  | { type: 'carried'; planks: number }
  | { type: 'gift'; points: number }
  | { type: 'ftue'; line: 'tap' | 'plank' | null }
  | { type: 'finale' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The dove: on the rail by Day, out over the valley in an Evening, home with or without a leaf, gone at the finisher. */
export interface Dove {
  state: 'rail' | 'out' | 'home' | 'away';
  /** seconds in this state */
  t: number;
  /** how far out over the valley (0..1): farther while calm holds */
  far: number;
  /** how high (0..1): the calm, smoothed */
  high: number;
  /** what it brought home last */
  leaf: boolean;
  olive: boolean;
}

export interface SimInit {
  progress: ArkaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning (the kit's defaults, the game's entry, a beginner's bias): the judges follow it */
  tuning: FocusTuning;
}

export type Phase = 'play' | 'finale' | 'done';

export class ArkaSim {
  readonly p: ArkaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly tau: number;
  private readonly lead: number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly events: SimEvent[] = [];

  started = false;
  /** this session's number in the game (1 = the first ever) */
  session = 0;
  plan: Block[] = [];
  finaleSec: number = RULES.finale;
  blockIndex = 0;
  /** seconds into the block, and the play time */
  blockT = 0;
  now = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  tip = '';
  /** the first-ever session's lines: "Stuknij zwierzę…" until the first send, "Dłuższy pomost…" after the first plank */
  ftue: 'tap' | 'plank' | null = null;
  private ftueT = 0;

  // the brain
  /** the level smoothed again (planks, the hammer) and the calm smoothed (the dove) */
  L = 0.3;
  calm = 0;
  reliable = false;
  /** mist over the landing while the signal is unreliable (0..1, eased) */
  fog = 0;
  /** plank progress toward the next plank (0..1) */
  progress = 0;
  private holdCarry = 0;
  private rawHold = 0;
  private fogT = 0;
  private recover = 0;
  /** this block's reliable seconds, and the plank progress it brought */
  private blockReliable = 0;
  private blockGain = 0;
  /** the Evening's calm in 0.1 s bins over its last 10 s (the olive) */
  private readonly calmBins = new Float32Array(100);
  private calmBinN = 0;
  private calmAcc = 0;
  private calmAccT = 0;
  readonly dove: Dove = { state: 'rail', t: 0, far: 0, high: 0, leaf: false, olive: false };

  // the deck
  hold!: HoldRun;
  private holdsBegun = 0;
  private sawIndex = 0;
  private greatDone = false;
  /** the day's hold is still to be cleared today (it comes second) */
  dailyDue = false;
  private ids = 0;
  /** the landing's stalls: the animal holding each (the first of its pair), null when free */
  readonly slots: (Beast | null)[] = [null, null, null, null, null, null];
  /** links in a row (an animal taking a stall breaks it) */
  chain = 0;
  /** seconds the landing has been jammed */
  jamT = 0;
  leafArmed = false;
  cursor = { x: 0, y: 0, shown: false };
  private restartT = -1;

  // the session's tallies
  score = 0;
  maxChain = 0;
  planksSession = 0;
  private planksDay = 0;
  bestDayPlanks = 0;
  cleared = 0;
  threeStars = 0;
  leavesBrought = 0;
  posts = 0;
  daysJudged = 0;
  private blindPlanks = 0;
  readonly newKinds: KindId[] = [];
  private readonly youngNow: KindId[] = [];
  private readonly builtNow: number[] = [];
  private olivesNow = 0;
  private giftNow = 0;
  private dailyNow: { stars: number; sec: number } | null = null;
  private carriedOpen = false;
  /** the records before this session (the summary says what is new) and the best for this length */
  private readonly before: { chain: number; stars: number; planks: number; session: number };
  private readonly bestBefore: number | null;
  /** Day blocks before this session and in it (every 4th is blind); they reach the progress in result() */
  private daysBase = 0;
  private daysBegun = 0;

  constructor(private readonly init: SimInit) {
    this.p = init.progress;
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.tau = init.eeg ? RULES.tauEeg : RULES.tau;
    this.lead = init.eeg ? RULES.leadEeg : RULES.lead;
    this.judge = RoundJudge.from(init.tuning);
    const p = this.p;
    this.before = { chain: p.bestChain, stars: p.bestStars, planks: p.bestPlanks, session: p.bestSession };
    const len = p.bestByLen[String(init.plannedSec)];
    this.bestBefore = p.sessions > 0 && len !== undefined ? len : null;
  }

  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  /** seconds until the next block begins (null: the last block) */
  get toNext(): number | null { return this.next ? Math.max(0, this.next.start - this.now) : null; }
  /** a blind Day whose planks are still under the mist (it lifts at the Evening's telegraph) */
  get blindNow(): boolean { return this.phase === 'play' && this.block.kind === 'day' && this.block.blind && !this.telegraphed; }
  /** the deck answers touch: play, a Day, the hold in place */
  get active(): boolean { return this.started && this.phase === 'play' && this.block.kind === 'day' && this.hold.slide <= 0; }
  /** stalls on the landing now: three, and one per plank laid this hold */
  get capacity(): number { return RULES.stalls + Math.min(RULES.maxPlanks, this.hold.planks); }
  /** the hammer's taps per second (a sighted Day) */
  get hammer(): number { return RULES.hammerMin + RULES.hammerGain * clamp(this.L); }

  start(): void {
    if (this.started) return;
    this.started = true;
    const p = this.p, day = this.init.day;
    // the session (and its Day blocks) reach the progress in result(), which a saved session calls
    this.session = p.sessions + 1;
    this.daysBase = p.days;
    this.dailyDue = p.dailyDay !== day;
    const out = kindsAt(this.session), had = this.session > 1 ? kindsAt(this.session - 1) : 0;
    for (let i = had; i < out; i++) this.newKinds.push(KINDS[i]);
    const pl = planBlocks(this.plannedSec, this.rng);
    this.plan = pl.blocks;
    this.finaleSec = pl.finale;
    if (this.session === 1) this.ftue = 'tap';
    this.startBlock(0);
    this.nextHold(true);
    if (this.newKinds.length) this.emit({ type: 'kind', kinds: this.newKinds.slice() });
    if (p.giftDay !== day) {
      p.giftDay = day;
      this.giftNow = RULES.dayGift;
      this.emit({ type: 'gift', points: RULES.dayGift });
      this.home(RULES.dayGift);
    }
    if (this.ftue) this.emit({ type: 'ftue', line: this.ftue });
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    this.now = Math.max(this.now, t);
    this.reliable = f.reliable;
    this.fog = approach(this.fog, f.reliable ? 0 : 1, dt, 0.7);
    this.phaseT += dt;
    this.hold.t += dt;
    if (this.hold.slide > 0) this.hold.slide = Math.max(0, this.hold.slide - dt);
    this.move(dt);
    if (this.phase === 'play') {
      this.schedule(dt, f);
      if (this.phase === 'play') {
        this.brain(dt, f);
        this.landing(dt);
      }
    } else if (this.phase === 'finale' && this.phaseT >= this.finaleSec) this.phase = 'done';
    this.doveFly(dt);
    if (this.restartT >= 0 && (this.restartT += dt) >= RULES.restartHold) {
      this.restartT = -1;
      this.restart();
    }
    if (this.ftue === 'plank' && (this.ftueT += dt) > 5) this.setFtue(null);
  }

  /** The blocks follow the play time; the telegraph 4 s before each; the finisher after the last. */
  private schedule(dt: number, f: FocusFrame): void {
    const b = this.block;
    this.blockT = this.now - b.start;
    const want = b.kind === 'day' ? 'focus' : 'rest';
    this.judge.push(want, f, dt);
    this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    if (f.reliable) this.blockReliable += dt;
    const next = this.next;
    if (next && !this.telegraphed && this.now >= next.start - RULES.telegraph) {
      this.telegraphed = true;
      if (b.kind === 'day' && b.blind) this.revealBlind();
      this.emit({ type: 'telegraph', next: next.kind });
    }
    if (this.now >= b.start + b.dur) {
      this.endBlock();
      if (next) this.startBlock(this.blockIndex + 1);
      else this.startFinale();
    }
  }

  private startBlock(i: number): void {
    this.blockIndex = i;
    const b = this.plan[i];
    this.blockT = Math.max(0, this.now - b.start);
    this.telegraphed = false;
    this.blockReliable = 0;
    this.blockGain = 0;
    this.judge.reset();
    const firstOfKind = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'day') {
      this.daysBegun++;
      b.blind = this.session >= RULES.blindFrom && i > 0 && (this.daysBase + this.daysBegun) % RULES.blindEvery === 0;
      this.planksDay = 0;
      this.holdCarry = 0;
      if (this.dove.state !== 'rail') this.setDove('rail');
    } else {
      this.leafArmed = false;
      this.jamT = 0;
      this.restartT = -1;
      this.calmBinN = 0;
      this.calmAcc = 0;
      this.calmAccT = 0;
      this.dove.far = 0;
      this.dove.high = 0;
      this.setDove('out');
    }
    const list = b.kind === 'day' ? (b.blind ? TIPS.blind : TIPS.day) : TIPS.evening;
    // the very first session explains each block once; later the lines rotate from session to session
    this.tip = firstOfKind && this.session === 1 ? (b.kind === 'day' ? TIPS.firstDay : TIPS.firstEvening)
      : list[(this.session - 1 + i) % list.length];
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  /** The block's verdict from its last 15 s (none with fewer than 8 reliable seconds), and its payout. */
  private endBlock(): void {
    const b = this.block;
    const m = this.judge.measured;
    const verdict = m >= RULES.minReliable && this.blockReliable >= RULES.minReliable ? this.judge.verdict() : null;
    if (b.kind === 'day') {
      if (verdict !== null) this.daysJudged++;
      if (verdict) {
        this.posts++;
        this.emit({ type: 'post' });
        this.home(1);
      } else if (verdict === false) {
        const have = Math.floor(this.judge.share * m), need = Math.ceil(this.judge.need('focus') * m);
        this.emit({ type: 'almost', have, need });
      }
      if (this.blockReliable < RULES.minReliable) {
        // too little signal to judge: the planks still come at the neutral rate's pace
        const floor = NEUTRAL_RATE * Math.max(0, b.dur - this.lead);
        if (floor > this.blockGain) this.addProgress(floor - this.blockGain, false);
      }
      if (b.blind && !this.telegraphed) this.revealBlind();
      this.bestDayPlanks = Math.max(this.bestDayPlanks, this.planksDay);
    } else this.eveningEnd(verdict);
    this.emit({ type: 'blockEnd', block: b, verdict });
  }

  private eveningEnd(verdict: boolean | null): void {
    const p = this.p;
    const { leaf, grace } = doveBringsLeaf(p, verdict);
    let mean = 0;
    const n = Math.min(this.calmBinN, this.calmBins.length);
    for (let i = 0; i < n; i++) mean += this.calmBins[i];
    mean = n ? mean / n : 0;
    // an olive needs most of the 10 s measured, and deep calm through them
    const olive = leaf && n >= 0.7 * this.calmBins.length && mean >= RULES.oliveCalm;
    const { stored } = endEvening(p, leaf);
    if (leaf) this.leavesBrought++;
    if (olive) {
      p.olives++;
      this.olivesNow++;
    }
    this.dove.leaf = leaf;
    this.dove.olive = olive;
    this.setDove('home');
    this.emit({ type: 'dove', leaf, olive, grace, stored });
  }

  private revealBlind(): void {
    const h = this.hold;
    h.planks = Math.min(RULES.maxPlanks, h.planks + h.pending);
    h.pending = 0;
    this.emit({ type: 'blindReveal', planks: this.blindPlanks });
    this.blindPlanks = 0;
  }

  private startFinale(): void {
    this.phase = 'finale';
    this.phaseT = 0;
    this.leafArmed = false;
    this.restartT = -1;
    this.jamT = 0;
    this.carryOpen();
    this.setDove('away');
    this.emit({ type: 'finale' });
  }

  /** The open hold's planks go down to the homestead with the session (nothing is lost). */
  private carryOpen(): void {
    if (this.carriedOpen) return;
    this.carriedOpen = true;
    const n = this.hold.planks + this.hold.pending;
    if (n > 0) {
      this.emit({ type: 'carried', planks: n });
      this.home(n);
    }
  }

  /**
   * The session ends before its own finisher ("Zakończ i zapisz", the runner's overtime limit):
   * settle now — the walking animals arrive, the open block is judged, the planks go down to the
   * homestead.  Nothing more once the finisher has come.  The view is gone: no animation follows.
   */
  finish(): void {
    if (!this.started || this.phase !== 'play') return;
    for (let i = 0; i < 4; i++) for (const b of this.hold.beasts) if (b.state !== 'deck' && b.state !== 'stall' && b.state !== 'gone') this.finishMove(b);
    this.endBlock();
    this.startFinale();
    this.phase = 'done';
  }

  // ── the band ────────────────────────────────────────────────────
  /**
   * The slow quantities.  L always follows the level while the signal is good (silently outside a
   * Day), so each Day starts honestly; the planks grow only in a Day after its lead-in, the dove
   * only in an Evening.  Unreliable: everything holds.  After a long dropout the kit's level and calm
   * climb back from zero, so for a while they may only rise.
   */
  private brain(dt: number, f: FocusFrame): void {
    if (!f.reliable) {
      this.fogT += dt;
      return;
    }
    if (this.fogT > 0) {
      if (this.fogT >= RULES.fogGap) this.recover = RULES.recover;
      if (f.hold < this.rawHold) this.holdCarry += this.rawHold;   // the kit restarted a stretch the gap broke
      this.fogT = 0;
    } else this.recover = Math.max(0, this.recover - dt);
    if (!f.focused && this.recover <= 0) this.holdCarry = 0;
    this.rawHold = f.hold;
    const L = approach(this.L, clamp(f.level), dt, this.tau);
    const C = approach(this.calm, clamp(f.calm), dt, this.tau);
    this.L = this.recover > 0 ? Math.max(this.L, L) : L;
    this.calm = this.recover > 0 ? Math.max(this.calm, C) : C;
    const b = this.block;
    if (b.kind === 'day') {
      if (this.blockT >= this.lead) {
        const cont = Math.min(this.holdCarry + f.hold, this.blockT);
        const gain = plankRate(this.L, cont) * dt;
        this.blockGain += gain;
        this.addProgress(gain, false);
      }
    } else {
      // the Evening: the dove flies farther while calm holds; the olive's bins
      const d = this.dove;
      if (d.state === 'out') {
        // while the band climbs back after a dropout the dove neither loses ground nor gains it unearned
        const grow = this.calm >= RULES.doveCalm && (this.recover <= 0 || f.calm >= RULES.doveCalm);
        if (grow) d.far = clamp(d.far + RULES.doveOut * dt);
        else if (this.recover <= 0) d.far = clamp(d.far - RULES.doveIn * dt);
        d.high = this.calm;
      }
      this.calmAcc += f.calm * dt;
      this.calmAccT += dt;
      if (this.calmAccT >= 0.1) {
        this.calmBins[this.calmBinN++ % this.calmBins.length] = this.calmAcc / this.calmAccT;
        this.calmAcc = 0;
        this.calmAccT = 0;
      }
    }
  }

  /** Plank progress; whole planks are laid (or kept unseen in a blind Day), at most three per hold. */
  private addProgress(x: number, gift: boolean): void {
    const h = this.hold;
    if (h.planks + h.pending >= RULES.maxPlanks) {
      this.progress = Math.min(1, this.progress + x);   // a plank ready for the next hold
      return;
    }
    this.progress += x;
    while (this.progress >= 1 && h.planks + h.pending < RULES.maxPlanks) {
      this.progress -= 1;
      this.layPlank(gift);
    }
  }

  private layPlank(gift: boolean): void {
    const h = this.hold;
    const blind = this.blindNow;
    if (blind) {
      h.pending++;
      this.blindPlanks++;
    } else h.planks++;
    this.planksSession++;
    this.planksDay++;
    this.bestDayPlanks = Math.max(this.bestDayPlanks, this.planksDay);
    this.emit({ type: 'plank', planks: h.planks, blind, gift });
    if (this.session === 1 && this.planksSession === 1 && !blind) this.setFtue('plank');
  }

  /** The first plank of every hold is a gift once the hold has had 15 s of Day time. */
  private giftPlank(dt: number): void {
    const h = this.hold;
    if (this.block.kind !== 'day') return;
    h.dayT += dt;
    if (!h.gift && h.dayT >= RULES.giftSec && h.planks + h.pending === 0) {
      h.gift = true;
      this.layPlank(true);
    }
  }

  // ── the deck ────────────────────────────────────────────────────
  /** The session's next hold: the warm-up, the day's hold, the sawtooth, the great hold, an easy last one. */
  private nextHold(first = false): void {
    this.holdsBegun++;
    const n = this.holdsBegun;
    let recipe: RecipeId;
    if (n === 1) recipe = 'warm';
    else if (n === 2 && this.dailyDue) recipe = 'daily';
    else if (this.lastDay()) recipe = 'easy';
    else if (!this.greatDone && this.plannedSec >= RULES.greatFrom && this.now >= this.plannedSec * RULES.greatAt) {
      recipe = 'great';
      this.greatDone = true;
    } else recipe = SAWTOOTH[this.sawIndex++ % SAWTOOTH.length];
    const hold = this.build(recipe, n);
    this.hold = hold;
    this.slots.fill(null);
    this.chain = 0;
    this.jamT = 0;
    this.leafArmed = false;
    this.cursor.x = recipe === 'warm' ? ANCHOR.x : Math.floor(hold.cols / 2);
    this.cursor.y = recipe === 'warm' ? ANCHOR.y : Math.floor(hold.rows / 2);
    if (this.progress >= 1 && this.block.kind === 'day') this.addProgress(0, false);   // a plank ready from the last hold
    if (!first) this.emit({ type: 'hold', hold });
  }

  /** Whether the block now is the session's last Day. */
  private lastDay(): boolean {
    for (let i = this.blockIndex + 1; i < this.plan.length; i++) if (this.plan[i].kind === 'day') return false;
    return this.block.kind === 'day';
  }

  private build(recipe: RecipeId, n: number): HoldRun {
    const r = RECIPES[recipe];
    const avail = kindsOut(this.session);
    let h: Hold;
    if (recipe === 'daily') {
      // the same structure for everyone: six kind slots, then each slot one of the player's kinds
      const slots = KINDS.slice(0, r.pairs);
      h = generateHold({ cols: r.cols, rows: r.rows, pairs: slots, blocked: r.blocked, open: r.open }, mix(this.init.daySeed, 1));
      const map = new Map<KindId, KindId>(slots.map((k, i) => [k, avail[i % avail.length]]));
      h = { ...h, animals: h.animals.map(a => ({ ...a, kind: map.get(a.kind)! })) };
    } else {
      const pairs = this.pairsFor(recipe, avail);
      const seed = Math.floor(this.rng() * 4294967296) >>> 0;
      h = generateHold({ cols: r.cols, rows: r.rows, pairs, blocked: r.blocked, open: r.open, anchor: recipe === 'warm' ? { ...ANCHOR, kind: 'sheep' } : undefined }, seed);
    }
    const grid = new Int16Array(h.cols * h.rows).fill(-1);
    const beasts: Beast[] = h.animals.map((a, i) => {
      grid[a.y * h.cols + a.x] = i;
      return { id: ++this.ids, kind: a.kind, x: a.x, y: a.y, dir: a.dir, state: 'deck', t: 0, dur: 0, dist: 0, stall: -1, owner: false, mate: null, link: false, chain: 0, since: 0, was: -1 };
    });
    return {
      n, recipe, daily: recipe === 'daily', cols: h.cols, rows: h.rows, beasts, grid,
      planks: 0, pending: 0, dayT: 0, hands: 0, t: 0, pairs: 0, slide: n === 1 ? 0 : RULES.slide, gift: false,
    };
  }

  /**
   * The kinds of a hold's pairs: the warm-up's sheep and this session's new kind first, then others
   * the player has, every kind at least one pair and the rest spread among them.
   */
  private pairsFor(recipe: RecipeId, avail: readonly KindId[]): KindId[] {
    const r = RECIPES[recipe];
    const pool = avail.slice();
    const chosen: KindId[] = [];
    const take = (k: KindId) => {
      const i = pool.indexOf(k);
      if (i >= 0) chosen.push(...pool.splice(i, 1));
    };
    const want = Math.min(r.kinds, avail.length, r.pairs);
    if (recipe === 'warm') take('sheep');
    for (const k of this.newKinds) if (chosen.length < want && this.rng() < 0.85) take(k);
    while (chosen.length < want && pool.length) chosen.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    const pairs = chosen.slice();
    while (pairs.length < r.pairs) pairs.push(chosen[Math.floor(this.rng() * chosen.length)]);
    return pairs;
  }

  /** The animal in a cell of the deck (null: none, or one away from it). */
  beastAt(x: number, y: number): Beast | null {
    const h = this.hold;
    if (x < 0 || y < 0 || x >= h.cols || y >= h.rows) return null;
    const i = h.grid[y * h.cols + x];
    return i >= 0 ? h.beasts[i] : null;
  }

  /** How far the way out is blocked (0: clear). */
  blockedOf(b: Beast): number {
    const h = this.hold;
    return blockedAt(h.grid, h.cols, h.rows, b.x, b.y, b.dir);
  }

  /** Where a sent animal would go: to pair with a waiting (or arriving) mate, or to a free stall; null: the landing is full for it. */
  private destination(b: Beast): { mate: Beast; link: boolean } | { stall: number } | null {
    let mate: Beast | null = null;
    for (const s of this.hold.beasts) {
      if (s.kind !== b.kind || !s.owner || s.mate) continue;
      if (s.state !== 'stall' && s.state !== 'out' && s.state !== 'rail') continue;
      if (!mate || (s.state === 'stall' && (mate.state !== 'stall' || s.since < mate.since))) mate = s;
    }
    if (mate) return { mate, link: mate.state === 'stall' };
    for (let i = 0; i < this.capacity; i++) if (!this.slots[i]) return { stall: i };
    return null;
  }

  /** It would leave the deck now (its way is clear and the landing has room for it). */
  canLeave(b: Beast): boolean {
    return b.state === 'deck' && this.blockedOf(b) === 0 && this.destination(b) !== null;
  }

  /** It would make a pair: its way is clear and a mate of its kind waits or is on its way. */
  wouldPair(b: Beast): boolean {
    if (b.state !== 'deck' || this.blockedOf(b) !== 0) return false;
    const d = this.destination(b);
    return d !== null && 'mate' in d;
  }

  /** A tap's release on an animal: it walks the way it faces. */
  send(id: number): void {
    if (!this.active) return;
    const b = this.hold.beasts.find(x => x.id === id);
    if (!b || b.state !== 'deck') return;
    this.leafArmed = false;
    if (this.ftue === 'tap') this.setFtue(null);
    const h = this.hold;
    const k = this.blockedOf(b);
    if (k > 0) {
      // up to the animal in the way, a soft bump, and back: nothing lost
      const by = h.beasts[h.grid[(b.y + DY[b.dir] * k) * h.cols + b.x + DX[b.dir] * k]] ?? null;
      this.go(b, 'bump', k - 1 + RULES.nudge, Math.max(RULES.bumpMin, (2 * (k - 1 + RULES.nudge)) / RULES.walk));
      this.emit({ type: 'bump', beast: b, by });
      return;
    }
    const edge = toEdge(h.cols, h.rows, b.x, b.y, b.dir) + 0.5;
    const dest = this.destination(b);
    if (!dest) {
      // "Pełno": to the edge, a look at the full landing, back
      this.go(b, 'full', edge, (2 * edge) / RULES.walk + RULES.look);
      this.emit({ type: 'full', beast: b });
      return;
    }
    h.grid[b.y * h.cols + b.x] = -1;
    this.go(b, 'out', edge, edge / RULES.walk);
    if ('mate' in dest) {
      b.mate = dest.mate;
      dest.mate.mate = b;
      b.stall = dest.mate.stall;
      b.owner = false;
      b.link = dest.link;
      if (dest.link) {
        this.chain++;
        b.chain = this.chain;
        this.maxChain = Math.max(this.maxChain, this.chain);
      }
    } else {
      this.slots[dest.stall] = b;
      b.stall = dest.stall;
      b.owner = true;
      this.chain = 0;   // an animal taking a stall breaks the chain
    }
    this.emit({ type: 'send', beast: b, link: b.link });
  }

  private go(b: Beast, state: BeastState, dist: number, dur: number): void {
    b.state = state;
    b.t = 0;
    b.dist = dist;
    b.dur = dur;
  }

  /** Space or Enter: the animal under the cursor, or the nearest that can leave (a pair first). */
  keySend(): void {
    if (!this.active) return;
    const c = this.cursor;
    const b = this.beastAt(c.x, c.y);
    if (b && this.canLeave(b)) {
      this.send(b.id);
      return;
    }
    let best: Beast | null = null, bestScore = Infinity;
    for (const x of this.hold.beasts) {
      if (!this.canLeave(x)) continue;
      const score = Math.abs(x.x - c.x) + Math.abs(x.y - c.y) + (this.wouldPair(x) ? 0 : 1000);
      if (score < bestScore) {
        best = x;
        bestScore = score;
      }
    }
    if (best) this.send(best.id);
    else if (b) this.send(b.id);   // nobody can leave: the one under the cursor shows why
  }

  /** Arrows: the cursor over the deck, wrapping; it shows from the first key on. */
  moveCursor(dx: number, dy: number): void {
    if (!this.started) return;
    const h = this.hold, c = this.cursor;
    c.shown = true;
    c.x = (((c.x + dx) % h.cols) + h.cols) % h.cols;
    c.y = (((c.y + dy) % h.rows) + h.rows) % h.rows;
  }

  /** The leaf chip: arm it (a waiting animal is the next tap), or put it away. */
  armLeaf(on = !this.leafArmed): void {
    this.leafArmed = on && this.active && this.p.leaves > 0 && this.longestWaiting() !== null;
  }

  /** An olive leaf: Noah leads a waiting animal (the longest-waiting without `id`) back to its cell, the stars kept. */
  useLeaf(id?: number): boolean {
    this.leafArmed = false;
    if (!this.active || this.p.leaves <= 0) return false;
    const b = id === undefined ? this.longestWaiting() : this.hold.beasts.find(x => x.id === id && x.state === 'stall' && x.owner && !x.mate) ?? null;
    if (!b) return false;
    this.p.leaves--;
    this.leadBack(b, false);
    return true;
  }

  /** R pressed (down) and released (up): held for 1 s it gives every waiting animal back to its cell. */
  restartKey(down: boolean): void {
    this.restartT = down && this.active ? Math.max(0, this.restartT) : -1;
  }

  get restartProgress(): number { return this.restartT < 0 ? 0 : clamp(this.restartT / RULES.restartHold); }

  /** Every waiting animal back to its cell (counts as Noah's hand once for the stars). */
  restart(): void {
    if (!this.active || this.hold.beasts.some(moving)) return;
    const waiting = this.hold.beasts.filter(b => b.state === 'stall' && b.owner && !b.mate);
    if (!waiting.length) return;
    this.hold.hands++;
    for (const b of waiting) this.leadBack(b, true, false);
  }

  /** The waiting animal that came first (no one on its way to it). */
  longestWaiting(): Beast | null {
    let best: Beast | null = null;
    for (const b of this.hold.beasts) if (b.state === 'stall' && b.owner && !b.mate && (!best || b.since < best.since)) best = b;
    return best;
  }

  private leadBack(b: Beast, hand: boolean, count = true): void {
    const h = this.hold;
    if (b.stall >= 0 && this.slots[b.stall] === b) this.slots[b.stall] = null;
    b.was = b.stall;
    b.stall = -1;
    b.owner = false;
    b.link = false;
    this.go(b, 'back', 0, RULES.back);
    h.grid[b.y * h.cols + b.x] = h.beasts.indexOf(b);   // its cell is its own again at once
    if (hand && count) h.hands++;
    this.jamT = 0;
    this.emit({ type: 'hand', beast: b, leaf: !hand });
  }

  /** Every animal moves on: walks, trots, waits, pairs. */
  private move(dt: number): void {
    for (const b of this.hold.beasts) {
      if (b.state === 'deck' || b.state === 'stall' || b.state === 'gone') continue;
      b.t += dt;
      if (b.t >= b.dur) this.finishMove(b);
    }
  }

  /** The end of a move (also all at once when the session settles early). */
  private finishMove(b: Beast): void {
    switch (b.state) {
      case 'bump':
      case 'full':
        b.state = 'deck';
        b.t = 0;
        break;
      case 'out':
        this.go(b, 'rail', 0, RULES.rail);
        break;
      case 'rail':
        this.arrive(b);
        break;
      case 'back':
        b.state = 'deck';
        b.t = 0;
        this.emit({ type: 'home', beast: b });
        break;
      case 'pair':
        b.state = 'gone';
        break;
      default:
        break;
    }
  }

  /** On the landing: with its mate already there it is a pair, else it waits (in its own stall or its mate's). */
  private arrive(b: Beast): void {
    if (b.mate && b.mate.state === 'stall') {
      this.pair(b.mate, b);
      return;
    }
    b.state = 'stall';
    b.t = 0;
    b.since = this.now;
    if (!b.mate) this.emit({ type: 'wait', beast: b });
  }

  private pair(first: Beast, second: Beast): void {
    const h = this.hold;
    const owner = first.owner ? first : second;
    if (owner.stall >= 0 && this.slots[owner.stall] === owner) this.slots[owner.stall] = null;
    const claimer = owner === first ? second : first;
    for (const b of [first, second]) this.go(b, 'pair', 0, RULES.pair);
    this.score++;
    h.pairs++;
    if (settle(this.p, first.kind)) {
      this.youngNow.push(first.kind);
      this.emit({ type: 'young', kind: first.kind });
    }
    this.emit({ type: 'pair', a: first, b: second, link: claimer.link, chain: claimer.link ? claimer.chain : 0 });
    if (h.beasts.every(x => x.state === 'pair' || x.state === 'gone')) this.clearHold();
  }

  /** The deck is empty: the door floods with light, the planks go down to the homestead, the next hold slides in. */
  private clearHold(): void {
    const h = this.hold;
    const stars = h.hands === 0 ? 3 : h.hands === 1 ? 2 : 1;
    this.cleared++;
    if (stars === 3) this.threeStars++;
    const planks = h.planks + h.pending;
    if (h.daily) {
      this.dailyDue = false;
      const sec = Math.max(1, Math.round(h.t));
      const p = this.p;
      p.dailyDay = this.init.day;
      p.dailyStars = stars;
      p.dailySec = sec;
      this.dailyNow = { stars, sec };
    }
    this.emit({ type: 'clear', hold: h, stars, planks });
    if (planks > 0) this.home(planks);
    if (this.phase === 'play') this.nextHold();
    else this.carriedOpen = true;
  }

  /** The landing's slow rules: the jam and Noah's hand, the first plank's gift. */
  private landing(dt: number): void {
    if (this.block.kind !== 'day') return;
    this.giftPlank(dt);
    if (this.hold.slide > 0) return;
    if (this.jammed()) {
      if (this.jamT === 0) this.emit({ type: 'jam' });
      this.jamT += dt;
      if (this.jamT >= RULES.jam) {
        const b = this.longestWaiting();
        if (b) this.leadBack(b, true);
        this.jamT = 0;
      }
    } else this.jamT = 0;
  }

  /** Every stall taken, nothing on its way, and no free animal on the deck can make a pair. */
  jammed(): boolean {
    const h = this.hold;
    let used = 0;
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i]) used++;
    if (used < this.capacity) return false;
    for (const b of h.beasts) if (moving(b)) return false;
    for (const b of h.beasts) if (b.state === 'deck' && this.wouldPair(b)) return false;
    return h.beasts.some(b => b.state === 'deck');
  }

  // ── the dove ─────────────────────────────────────────────────────
  private setDove(state: Dove['state']): void {
    this.dove.state = state;
    this.dove.t = 0;
  }

  private doveFly(dt: number): void {
    const d = this.dove;
    d.t += dt;
    if (d.state === 'home' && d.t > 2.4) this.setDove('rail');
  }

  // ── small helpers ───────────────────────────────────────────────
  private home(points: number): void {
    for (const s of addHome(this.p, points)) {
      this.builtNow.push(s);
      this.emit({ type: 'built', stage: s });
    }
  }

  private setFtue(line: 'tap' | 'plank' | null): void {
    if (this.ftue === line) return;
    this.ftue = line;
    this.ftueT = 0;
    this.emit({ type: 'ftue', line });
  }

  private emit(e: SimEvent): void { this.events.push(e); }

  /** The events since the last call, oldest first (most frames have none: then nothing is allocated). */
  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /**
   * What the ambient pad's brightness follows (kit/types.ts): L in a sighted Day.  Held still in a
   * blind Day, in an Evening, at the finisher and while the signal is unreliable, so no live feedback
   * reaches the sound where the screen has none.
   */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || this.phase !== 'play' || !f.reliable) return null;
    return this.block.kind === 'day' && !this.blindNow ? clamp(this.L) : null;
  }

  /** Time is up: the session may stop once the finisher has played (an animal still walking gets 3 s more at most). */
  canStop(): boolean {
    if (this.phase !== 'done') return false;
    return !this.hold.beasts.some(b => moving(b) || b.state === 'pair') || this.phaseT >= this.finaleSec + 3;
  }

  // ── output ──────────────────────────────────────────────────────
  /**
   * The session's numbers, idempotent.  Only a saved session calls it for good, so the session and
   * its Day blocks are counted here; records go into the progress with Math.max.
   */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      p.sessions = Math.max(p.sessions, this.session);
      p.days = Math.max(p.days, this.daysBase + this.daysBegun);
      p.lastDay = this.init.day;
    }
    const len = String(this.plannedSec);
    p.bestSession = Math.max(p.bestSession, this.score);
    p.bestByLen[len] = Math.max(p.bestByLen[len] ?? 0, this.score);
    p.bestChain = Math.max(p.bestChain, this.maxChain);
    p.bestStars = Math.max(p.bestStars, this.threeStars);
    p.bestPlanks = Math.max(p.bestPlanks, this.bestDayPlanks);
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;   // no "−0.0%"
    const stats: [string, string][] = [
      [t('stat.chain'), String(this.maxChain)],
      [t('stat.planks'), String(this.planksSession)],
      [t('stat.holds'), String(this.cleared)],
      [t('stat.stars'), String(this.threeStars)],
      [t('stat.leaves'), String(this.leavesBrought)],
      [t('stat.posts'), this.daysJudged ? `${this.posts}/${this.daysJudged}` : '—'],
      [t('stat.rhythm'), c === null ? '—' : t('pct', { n: fmtSigned(c, 1) })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage (kit/scripture.ts), one of those the session fits, in turn from
   * session to session, the best fit first: the dove's leaf (Gen 8:11), the animals spreading over
   * the earth (Gen 8:17) when a kind came out or six pairs and more, and always the rainbow's
   * covenant, the Lord who preserves man and beast, mercies new every morning.  Never the root
   * (Gen 8:1), which the lobby shows.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.leavesBrought > 0) fit.push('gen8.11');
    if (this.newKinds.length > 0 || this.score >= 6) fit.push('gen8.17');
    fit.push('gen9.13', 'psa36.6', 'lam3.22-23');
    return inTurn(fit, this.session);
  }

  /** At most five lines, the session's best moments first: new kinds, young, the homestead, olive trees, records, the day's hold, the gift. */
  private highlights(): string[] {
    const notes: string[] = [];
    if (this.newKinds.length) notes.push(t('hl.kinds', { names: this.newKinds.map(k => KIND[k].name).join(', ') }));
    if (this.youngNow.length) notes.push(t('hl.young', { names: this.youngNow.map(k => KIND[k].young).join(', ') }));
    if (this.builtNow.length) notes.push(t('hl.built', { names: this.builtNow.map(s => STAGES[s].name).join(', ') }));
    if (this.olivesNow) notes.push(t('hl.olive', { n: this.olivesNow }));
    if (this.session > 1) {
      const rec: string[] = [];
      if (this.score > this.before.session && this.score > 0) rec.push(t('hl.rec.session', { pairs: t('pairs', { n: this.score }) }));
      if (this.maxChain > this.before.chain && this.maxChain >= 2) rec.push(t('hl.rec.chain', { n: this.maxChain }));
      if (this.threeStars > this.before.stars) rec.push(t('hl.rec.stars', { n: this.threeStars }));
      if (this.bestDayPlanks > this.before.planks) rec.push(t('hl.rec.planks', { planks: t('planks', { n: this.bestDayPlanks }) }));
      if (rec.length) notes.push(t('hl.records', { list: rec.join(', ') }));
    }
    if (this.dailyNow) notes.push(t('hl.daily', { stars: '★'.repeat(this.dailyNow.stars), sec: this.dailyNow.sec }));
    if (this.giftNow) notes.push(t('fx.gift', { n: this.giftNow }));
    return notes.slice(0, 5);
  }
}
