/**
 * Dolina's run, without the DOM or the canvas (so every rule is unit-tested): the pilgrim on the
 * road through the valley of the shadow (Psalm 23:4), the road's pits, beams and shadows, the three
 * eras and their guardians, the lamp, the Świt, the oil and the meadow, the blocks, the meta
 * (meta.ts), Ćma's lines (companion.ts) and the session's numbers.  All numbers are in rules.ts.
 *
 * The pilgrim runs by himself.  A tap on the right two thirds (Space, →, D) slashes ahead with the
 * sword — a short arc that cuts every shadow and thrown brick in it; a swipe up (↑, W) jumps (coyote
 * time, a jump buffer); a swipe down (↓, S) slides under a beam; a tap on the left third (←, A, E)
 * raises the lamp: a burst that stuns the nearest shadow (3 s cooldown).  The band only adds:
 *   Światło (push)     after a lead-in the lamp's reach is lampMin + level × lampExtra: inside its
 *                      light the shadows slow down and burn in proportion to how far the level stands
 *                      above the threshold, a squire's soot shield cracks, the sword's arc grows, and
 *                      a guardian's clock slows; a held focus (5 s Mendi / 3 s HALO) lights the Świt —
 *                      every shadow on screen dissolves, a guardian's weak point opens for 3 s.
 *   Pastwisko (rest)   the run slows to a walk across a meadow by still water, no shadows come; calm
 *                      refills the oil and drops of oil fall (sparks); a passed one fills the flask.
 *   Mgła (blind)       every 4th Światło from the 3rd session: the lamp stays a small flame and the
 *                      trace is veiled; at the block's end its last 15 s become one Świt of that strength.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the lamp rests at its smallest; never a loss.
 *
 * The eras: Babel, the burned fortress, the city of screens; each ends at its guardian (the tower,
 * the knight of soot, the screen) with telegraphed moves and a weak point.  Guardians come in the
 * push blocks planned for them; one not beaten by its block's end withdraws, keeps its damage and
 * comes back in the next push block.  Beyond the third the dawn gate opens and the valley begins
 * again, harder (a lap).
 *
 * Grace: hits drain oil; a pit is climbed out of, a beam is stumbled through; with no oil left the
 * pilgrim falls and rises at a lantern post with half oil (Micah 7:8).  Nothing ends the run early,
 * the metres never go back.  The headline is the metres run this session, counted live.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import { Companion, type Moment } from './companion';
import {
  ERAS, ERA_SHADOWS, GUARDS, LOOKS, MOVE_HINT, SEQ, SHADOWS, TIPS, eraName, guardName,
  type EraId, type GuardId, type HarmKind, type Hint, type MoveKind, type ShadowKind,
} from './content';
import { sparks as sparksText, t } from './i18n';
import { bestFor, lenKey, lookOf, startEraOf, upLevel, type DolinaProgress } from './meta';
import { RULES, span } from './rules';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean; guard: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** How the lamp looks: the steady small flame, live, waiting out the band's delay, grey without signal, the blind fog. */
export type LampLook = 'flame' | 'live' | 'wait' | 'grey' | 'blind';
/** How a shadow left the road. */
export type Via = 'slash' | 'light' | 'dawn' | 'flash' | 'touch' | 'fade';

export interface Shadow {
  id: number;
  kind: ShadowKind;
  /** world x of its middle and its height above the road (u) */
  x: number;
  y: number;
  hp: number;
  r: number;
  h: number;
  /** the squire's soot shield and how far the light has cracked it (0..1) */
  shield: boolean;
  crack: number;
  state: 'walk' | 'hidden' | 'gone';
  age: number;
  /** stunned by the lamp's burst (s left); a hit's flash (s left); in a live light now; light taken */
  stun: number;
  hitT: number;
  inLight: boolean;
  burn: number;
  /** the thrower's next brick (s), the crow's dive (0..1) */
  throwT: number;
  dive: number;
  knock: number;
}

export type ShotKind = 'brick' | 'rain' | 'roll' | 'pling';
export interface Shot {
  id: number;
  kind: ShotKind;
  /** world position (u); a shot of the arena (`rel`) keeps its place against the pilgrim */
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  r: number;
  rel: boolean;
  relX: number;
  /** waiting before it moves (s): a falling brick's telegraph */
  wait: number;
  harm: HarmKind;
  alive: boolean;
  t: number;
}

export interface Feature { kind: 'pit' | 'beam'; x0: number; x1: number; hit: boolean; passed: boolean }
export interface Post { x: number; lit: 'gold' | 'warm' | 'none' }

export interface Guard {
  id: GuardId;
  era: EraId;
  hp: number;
  maxHp: number;
  state: 'enter' | 'fight' | 'leave' | 'beaten';
  /** its front edge against the pilgrim (u) */
  rel: number;
  /** seconds in its state */
  st: number;
  seq: readonly MoveKind[];
  i: number;
  moveT: number;
  acted: boolean;
  /** the weak point opened by a Świt (s left), the burst's delay (s), a hit's flash */
  dawnOpen: number;
  delay: number;
  hitT: number;
  angry: boolean;
  /** the knight's strikes parried in this run of three */
  parried: number;
  /** the screen's beam is sweeping / the knight's heavy blow is sweeping (s left) */
  sweep: number;
  /** the current move has shown its first moment */
  begun: boolean;
}

export type SimEvent =
  | { type: 'spawn'; id: number; kind: ShadowKind }
  | { type: 'pop'; id: number; x: number; y: number }
  | { type: 'slash'; reach: number; rest: boolean }
  | { type: 'hit'; id: number; kind: ShadowKind; x: number; y: number; combo: number }
  | { type: 'clink'; x: number; y: number; guard: boolean }
  | { type: 'shieldBreak'; id: number; x: number; y: number; via: 'slash' | 'light' }
  | { type: 'kill'; id: number; kind: ShadowKind; x: number; y: number; via: Via; sparks: number; combo: number }
  | { type: 'throw'; id: number; x: number }
  | { type: 'shotBreak'; id: number; kind: ShotKind; x: number; y: number; via: 'slash' | 'burst' | 'dawn' | 'ground' }
  | { type: 'harm'; kind: HarmKind; oil: number; x: number; y: number }
  | { type: 'pit'; x: number }
  | { type: 'climb'; x: number }
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'slide' }
  | { type: 'dodge'; what: 'jump' | 'slide'; near: boolean }
  | { type: 'burst'; stunned: number; cleared: number; ready: boolean }
  | { type: 'combo'; n: number; mult: number }
  | { type: 'dawn'; n: number; guard: boolean }
  | { type: 'flash'; share: number; r: number; n: number }
  | { type: 'fall' }
  | { type: 'rise'; x: number }
  | { type: 'drop'; n: number }
  | { type: 'chime'; n: number }
  | { type: 'restPass'; sparks: number }
  | { type: 'pushPass'; sparks: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; drops: number }
  | { type: 'guard'; what: 'come' | 'fight' | 'angry' | 'leave' | 'beaten' | 'open'; id: GuardId; era: EraId }
  | { type: 'guardHit'; id: GuardId; left: number; combo: number; via: 'slash' | 'light' }
  | { type: 'move'; kind: MoveKind; act: boolean; id: GuardId }
  | { type: 'parry'; n: number }
  | { type: 'era'; era: EraId; lap: number }
  | { type: 'gate'; lap: number }
  | { type: 'post'; x: number; lit: 'gold' | 'warm' }
  | { type: 'finale' }
  | { type: 'done' }
  | { type: 'dayGift'; n: number }
  | { type: 'look'; look: number };

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

/** The run toward the dawn at the session's end: longer in sessions of 2 min and more. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The run's blocks.  A first-ever session opens with the warm-up "Pierwsze kroki" (30 s in 5 and
 * 10 min, 22 s in 3, 8 s in a 40 s test); then Światło / Pastwisko pairs (26 ± 4 s and 20 ± 3 s,
 * scaled to end on time, jittered only when there is room) ending with a meadow, leaving the
 * finale's seconds to the run toward the dawn.  No block under 12 s.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false, guard: false });
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

/**
 * Which push blocks bring a guardian: with P push blocks and `eras` eras to cross, the last push of
 * each of `eras` equal stretches (every push block when there are fewer than eras).
 */
export function assignGuards(plan: Block[], eras: number): void {
  const push = plan.filter(b => b.kind === 'push');
  const P = push.length;
  if (!P || eras <= 0) return;
  if (P <= eras) {
    for (const b of push) b.guard = true;
    return;
  }
  for (let k = 0; k < eras; k++) push[Math.max(0, Math.round(((k + 1) * P) / eras) - 1)].guard = true;
}

/** The lamp's reach for a level (u), with its upgrades: the band can only add. */
export const lampFor = (level: number, ups = 0): number => RULES.lampMin + ups * RULES.lampStep + clamp(level) * RULES.lampExtra;
/** The reach at the threshold (level 0.5): the dotted ring. */
export const LAMP_MARK = lampFor(0.5);
/** How far the level stands above the threshold (0 at or below it, 1 at the top). */
export const above = (level: number): number => clamp((level - 0.5) / 0.5);
/** Light the lamp gives a shadow per second at a level: nothing at or below the threshold. */
export const lightDps = (level: number): number => RULES.lightDps * above(level);
/** The sword's arc ahead (u): its base, its upgrades and, in a live light, the level above the threshold. */
export const swordFor = (level: number, live: boolean, ups = 0): number =>
  RULES.swordReach + ups * RULES.swordStep + (live ? RULES.swordExtra * above(level) : 0);
/** The combo's multiplier of sparks: ×2 from 8 kills, ×3 from 20. */
export const comboMult = (combo: number): number => 1 + RULES.comboAt.filter(n => combo >= n).length;
/** Oil lost to a harm, with the oil upgrades. */
export const harmFor = (kind: HarmKind, oilUps = 0): number => RULES.harm[kind] * (1 - RULES.oilStep * oilUps);
/** A guardian's light (hits) for its era, the session's length and the lap. */
export const guardHpFor = (era: number, plannedSec: number, lap: number): number =>
  Math.max(4, Math.round(RULES.guardHp[era] * (plannedSec < 70 ? RULES.guardShort : 1) * (1 + RULES.guardLap * lap)));

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: DolinaProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

const WARM_SCRIPT: readonly ('shadow' | 'pit' | 'beam' | 'lamp')[] = ['shadow', 'pit', 'shadow', 'beam', 'lamp', 'pit', 'shadow', 'beam'];

export class DolinaSim {
  readonly p: DolinaProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the lantern posts along the ridge and the curve in the sky */
  readonly trace = new SignalTrace(40, 0.1);
  readonly talk: Companion;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly restLead: number;
  private readonly dawnBase: number;
  readonly finaleSec: number;

  started = false;
  readonly session: number;
  readonly startEra: number;
  readonly look: number;
  readonly ups: { sword: number; lamp: number; oil: number; boots: number; dawn: number };
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  /** what the hands should do now (the HUD's hint pill), null when nothing needs saying */
  hint: Hint | null = null;
  /** the opening story card is up (first-ever session) */
  story = 0;

  // the pilgrim
  px = 0;
  py = 0;
  vy = 0;
  speed = 0;
  grounded = true;
  private coyoteT = 0;
  private jumpBuf = 0;
  slideT = 0;
  private slideOnLand = false;
  /** 'run', climbing out of a pit, or fallen with no oil */
  state: 'run' | 'pit' | 'fallen' = 'run';
  stateT = 0;
  private pitTo = 0;
  safe = 0;
  stumble = 0;
  pull = 0;
  /** the sword: seconds since the slash began (Infinity: none), the next one's earliest, what it hit */
  slashT = Infinity;
  private slashCd = 0;
  private slashBuf = false;
  private readonly slashHit = new Set<number>();
  private slashGuard = false;
  slashReach: number = RULES.swordReach;
  burstCd = 0;
  /** hit-stop (s left), the world's clock this frame */
  stop = 0;
  timeScale = 1;
  combo = 0;
  private comboT = 0;
  private chimeN = 0;

  // the road
  readonly shadows: Shadow[] = [];
  readonly shots: Shot[] = [];
  readonly features: Feature[] = [];
  readonly posts: Post[] = [];
  private nextId = 1;
  private roadX = 0;
  private warmI = 0;
  private nextPost: number = RULES.postEvery;
  lastPost = 0;
  /** the era (index into ERAS) and the lap of the valley */
  eraI: number;
  lap = 0;
  guard: Guard | null = null;
  /** a guardian that withdrew unbeaten: it comes back with its damage */
  private pendingGuard: Guard | null = null;
  private blockGuardDone = false;

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  lampR: number = RULES.flame;
  lampLook: LampLook = 'flame';
  dawnCharge = 0;
  private dawnBlock = 0;
  private nextDawn = 0;
  private lastHold = 0;
  private dawnArmed = false;
  maxHold = 0;
  private relSec = 0;
  flashT = 0;
  flashR = 0;

  // the oil and the meadow
  oil = 1;
  drops = 0;
  private dropP = 0;

  // the companion's watchers
  private goodT = 0;
  private smallT = 0;
  private calmT = 0;
  private saidGood = false;
  private saidSmall = false;
  private saidCalm = false;
  private oilWarned = false;
  private lastNear = -99;
  private killTimes: number[] = [];

  // the session's numbers
  score = 0;
  sparks = 0;
  bestCombo = 0;
  kills = 0;
  dawns = 0;
  falls = 0;
  hits = 0;
  passedRests = 0;
  passedPushes = 0;
  guardsBeaten: GuardId[] = [];
  /** the furthest era this run entered (index; the third after a gate) */
  maxEra = 0;
  gates = 0;
  blindShare = -1;
  private dayGiftNow = 0;
  private lookUp = -1;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;

  constructor(private readonly init: SimInit) {
    const p = (this.p = init.progress);
    this.rng = init.rng;
    this.plannedSec = init.plannedSec;
    this.eeg = init.eeg;
    this.judge = RoundJudge.from(init.tuning);
    const band = init.eeg ? 'eeg' : 'fnirs';
    this.lead = RULES.leadIn[band];
    this.restLead = RULES.restLead[band];
    this.finaleSec = finaleFor(init.plannedSec);
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.look = lookOf(p.sparksAll);
    this.ups = { sword: upLevel(p, 'sword'), lamp: upLevel(p, 'lamp'), oil: upLevel(p, 'oil'), boots: upLevel(p, 'boots'), dawn: upLevel(p, 'dawn') };
    this.dawnBase = RULES.dawnHold[band] * RULES.dawnFast ** this.ups.dawn;
    this.startEra = startEraOf(p);
    this.eraI = this.startEra;
    this.maxEra = this.startEra;
    this.pushesBase = p.pushes;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    assignGuards(this.plan, ERAS.length - this.startEra);
    this.talk = new Companion(init.rng);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get era(): EraId { return ERAS[this.eraI]; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted Światło past its lead-in: the lamp answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get live(): boolean { return this.sighted && this.reliable; }
  get leadIn(): number { return this.lead; }
  get restLeadIn(): number { return this.restLead; }
  get dawnNeed(): number { return this.dawnBase; }
  get sliding(): boolean { return this.slideT > 0 && this.grounded; }
  get bodyH(): number { return this.sliding ? RULES.slideHeight : RULES.height; }
  get mult(): number { return comboMult(this.combo); }
  get slashing(): boolean { return this.slashT < RULES.slashSec; }
  /** the guardian's weak point is open now */
  get guardOpen(): boolean {
    const g = this.guard;
    return !!g && g.state === 'fight' && (g.seq[g.i] === 'open' || g.dawnOpen > 0);
  }
  get move(): MoveKind | null {
    const g = this.guard;
    return g && g.state === 'fight' ? g.seq[g.i] : null;
  }
  /** the share of the session gone (the road grows denser) */
  get share(): number { return clamp(this.t / Math.max(1, this.plannedSec - this.finaleSec)); }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.story = this.session === 1 ? RULES.storySec : 0;
    this.roadX = this.session === 1 ? RULES.warmRun * RULES.storySec + 6 : RULES.firstAhead;
    this.startBlock(0);
    this.talk.clear();
    if (this.session === 1) this.talk.say('first', 2, RULES.storySec + 6);
    else {
      this.talk.say('open', 2, 12);
      this.talk.say(`era.${this.era}`, 1, 16);
    }
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A slash ahead; a press during the arc's last moments lands as soon as the sword is back. */
  slash(): void {
    if (!this.started || this.phase === 'done' && this.t > this.plannedSec + RULES.settle) return;
    if (this.state !== 'run') return;
    if (this.slashCd > 0) {
      this.slashBuf = true;
      return;
    }
    this.slashT = 0;
    this.slashCd = RULES.slashGap;
    this.slashHit.clear();
    this.slashGuard = false;
    this.slashReach = swordFor(this.level, this.live, this.ups.sword);
    if (this.restBlock || this.phase !== 'play' && !this.guard) {
      this.chimeN++;
      this.emit({ type: 'chime', n: this.chimeN });
    }
    this.emit({ type: 'slash', reach: this.slashReach, rest: this.restBlock });
    this.slashFrame();
  }

  /** A jump now, or as soon as he lands (the buffer); coyote time after a ledge. */
  jump(): void {
    if (!this.started || this.state !== 'run') return;
    if (this.grounded || this.coyoteT > 0) this.doJump();
    else this.jumpBuf = RULES.buffer;
  }

  private doJump(): void {
    this.vy = RULES.jumpV;
    this.grounded = false;
    this.coyoteT = 0;
    this.jumpBuf = 0;
    this.slideT = 0;
    this.emit({ type: 'jump' });
  }

  /** A slide on the road; in the air he drops at once and slides on landing. */
  slide(): void {
    if (!this.started || this.state !== 'run') return;
    if (this.grounded) {
      this.slideT = RULES.slideSec;
      this.slideFrom = this.px;
      this.emit({ type: 'slide' });
    } else {
      this.vy = Math.min(this.vy, -RULES.dropV);
      this.slideOnLand = true;
    }
  }

  /** The lamp raised: the nearest shadow ahead is stunned, thrown bricks near are cleared; a guardian's next move waits. */
  burst(): void {
    if (!this.started || this.state !== 'run') return;
    if (this.burstCd > 0) {
      this.emit({ type: 'burst', stunned: 0, cleared: 0, ready: false });
      return;
    }
    const R = RULES;
    this.burstCd = R.burstCd;
    let best: Shadow | null = null;
    for (const s of this.shadows) {
      if (s.state !== 'walk' || s.x < this.px - 0.3 || s.x - this.px > R.burstReach) continue;
      if (!best || s.x < best.x) best = s;
    }
    let stunned = 0, cleared = 0;
    if (best) {
      best.stun = R.stunSec;
      stunned = 1;
    }
    for (const s of this.shots) {
      if (!s.alive || Math.abs(s.x - this.px) > R.burstClear) continue;
      this.breakShot(s, 'burst');
      cleared++;
    }
    if (this.guard?.state === 'fight') this.guard.delay = Math.max(this.guard.delay, R.burstDelay);
    this.emit({ type: 'burst', stunned, cleared, ready: true });
  }

  /** Keys: Space, Enter, →, D slash; ↑, W jump; ↓, S slide; ←, A, E the lamp. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    const act: Record<string, () => void> = {
      ' ': () => this.slash(), Enter: () => this.slash(), ArrowRight: () => this.slash(), d: () => this.slash(),
      ArrowUp: () => this.jump(), w: () => this.jump(), ArrowDown: () => this.slide(), s: () => this.slide(),
      ArrowLeft: () => this.burst(), a: () => this.burst(), e: () => this.burst(),
    };
    if (!(k in act)) return false;
    if (down && !this.held.has(k)) act[k]();
    if (down) this.held.add(k);
    else this.held.delete(k);
    return true;
  }

  private readonly held = new Set<string>();

  /** Every held key lets go (the runner's pause). */
  release(): void { this.held.clear(); }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.timeScale = this.stop > 0 ? 0 : 1;
    this.stop = Math.max(0, this.stop - dt);
    const w = dt * this.timeScale;
    this.story = Math.max(0, this.story - dt);
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.end();
    this.hands(dt, w);
    this.runner(w);
    this.road();
    this.walkShadows(w);
    this.moveShots(w);
    this.guardian(w, f);
    this.watch(dt);
    this.hint = this.hintNow();
    this.talk.update(dt, this.quiet);
  }

  /** the view has a card up: Ćma waits for it (set by the game every frame) */
  hold = false;

  /** The companion keeps quiet over a telegraph, while the runner's block banner is up and while a card is shown. */
  get quiet(): boolean {
    if (this.story > 0.5 || this.hold) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    if (b.kind !== 'warmup' && this.blockT < 5.6) return true;
    return b.dur - this.blockT <= RULES.telegraph + 0.3;
  }

  /**
   * The band's slow quantities: the lamp in a sighted Światło past its lead-in, the Świt from the
   * hold, the oil and the drops from calm in a meadow past its lead-in; the trace.
   */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    if (play && f.reliable) this.relSec += dt;
    const live = this.live;
    const want = live ? lampFor(f.level, this.ups.lamp) : this.pushBlock && !b.blind ? R.lampMin + this.ups.lamp * R.lampStep : R.flame;
    this.lampR = approach(this.lampR, want, dt, R.lampTau);
    this.lampLook = !play || b.kind !== 'push' ? 'flame' : b.blind ? 'blind' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    this.flashT = Math.max(0, this.flashT - dt);
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    // the light on the shadows inside it
    for (const s of this.shadows) {
      s.inLight = false;
      if (s.state !== 'walk' || !live) continue;
      const d = s.x - s.r - this.px;
      if (d > this.lampR || s.x + s.r < this.px - 0.5) continue;
      s.inLight = true;
      if (s.shield) {
        if (f.level > 0.5) {
          s.crack += R.crackRate * w;
          if (s.crack >= 1) {
            s.shield = false;
            this.emit({ type: 'shieldBreak', id: s.id, x: s.x, y: s.y + s.h / 2, via: 'light' });
          }
        }
        continue;
      }
      const light = lightDps(f.level) * w;
      s.hp -= light;
      s.burn += light;
      if (s.hp <= 1e-6) this.kill(s, 'light');
    }
    // the Świt: a held focus lights it (only the hold built inside this block counts)
    if (live && !this.dawnArmed) {
      this.dawnArmed = true;
      this.nextDawn = this.dawnNeed + Math.max(0, f.hold - this.blockT);
    }
    if (f.hold < this.lastHold - 0.5) this.nextDawn = this.dawnNeed;
    this.lastHold = f.hold;
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    const need = this.dawnNeed;
    this.dawnCharge = live && this.dawnBlock < R.dawnMax ? clamp((f.hold - (this.nextDawn - need)) / need) : approach(this.dawnCharge, 0, dt, 0.6);
    if (live && f.hold >= this.nextDawn && this.dawnBlock < R.dawnMax) {
      this.dawnBlock++;
      this.nextDawn = f.hold + need;
      this.dawn();
    }
    // the meadow: calm refills the oil, drops of oil fall
    if (play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable) {
      this.oil = Math.min(1, this.oil + R.oilGain * f.calm * dt);
      this.dropP = Math.min(R.dropMax, this.dropP + R.dropGain * f.calm * dt);
      while (Math.floor(this.dropP) > this.drops) {
        this.drops++;
        this.oil = Math.min(1, this.oil + R.dropOil);
        this.gain(R.dropSparks);
        this.emit({ type: 'drop', n: this.drops });
      }
    }
  }

  /** The Świt: every shadow on screen dissolves; on a guardian the weak point opens. */
  private dawn(): void {
    let n = 0;
    for (const s of this.shadows) {
      if (s.state === 'gone' || s.x < this.px - 3 || s.x > this.px + RULES.ahead) continue;
      n += this.kill(s, 'dawn');
    }
    for (const s of this.shots) if (s.alive) this.breakShot(s, 'dawn');
    const g = this.guard;
    const onGuard = !!g && g.state === 'fight';
    if (g && onGuard) {
      g.dawnOpen = RULES.dawnOpen;
      this.emit({ type: 'guard', what: 'open', id: g.id, era: g.era });
    }
    this.dawns++;
    this.stop = Math.max(this.stop, RULES.stopBeaten * 0.6);
    this.emit({ type: 'dawn', n, guard: onGuard });
    this.talk.say('big', 2, 3);
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    }
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - R.telegraph) {
      this.telegraphed = true;
      this.talk.hush();
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
    this.blockGuardDone = false;
    this.goodT = this.smallT = this.calmT = 0;
    this.saidGood = this.saidSmall = this.saidCalm = false;
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.dawnBlock = 0;
      this.dawnArmed = false;
      this.nextDawn = this.dawnNeed;
      this.lastHold = 0;
      this.roadX = Math.max(this.roadX, this.px + RULES.firstAhead);
      this.talk.say(b.blind ? 'blind' : 'push', 1, 10);
    } else if (b.kind === 'rest') {
      this.dropP = 0;
      this.drops = 0;
      // the meadow: the shadows ahead draw back into the dark, the road is clear
      this.clearAhead(1.2);
      this.talk.say('rest', 1, 10);
    }
    this.tip = this.tipFor(b, i, first);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number, first: boolean): string {
    if (b.kind === 'warmup') return TIPS.warmup[0];
    if (b.kind === 'push') {
      if (b.blind) return TIPS.blind[(this.session + i) % TIPS.blind.length];
      if (first && this.pushesBase === 0) return TIPS.firstPush;
      return TIPS.push[(this.session - 1 + i) % TIPS.push.length];
    }
    if (first && this.session === 1) return TIPS.firstRest;
    return TIPS.rest[(this.session - 1 + i) % TIPS.rest.length];
  }

  /** The block's end: its verdict and what it pays — after its judged window, never during it. */
  private endBlock(): void {
    const b = this.block, R = RULES;
    let verdict: boolean | null = null, share = 0, need = 0;
    let pass: SimEvent | null = null;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= R.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest' && verdict) {
        this.passedRests++;
        this.oil = 1;
        this.gain(R.restBonus);
        pass = { type: 'restPass', sparks: R.restBonus };
      }
      if (b.kind === 'push' && verdict) {
        this.passedPushes++;
        this.gain(R.pushBonus);
        pass = { type: 'pushPass', sparks: R.pushBonus };
      }
      if (b.kind === 'push' && verdict === false && share >= need - 0.12) this.talk.say('near', 1, 6);
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.blindFlash(s);
      }
    }
    // a guardian not beaten withdraws, keeping its damage
    if (b.kind === 'push' && this.guard && this.guard.state !== 'beaten') this.withdraw();
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, drops: b.kind === 'rest' ? this.drops : 0 });
    if (pass) this.emit(pass);
  }

  /** The blind block's end: its focus as one Świt of that strength. */
  private blindFlash(share: number): void {
    const r = lampFor(share, this.ups.lamp);
    let n = 0;
    for (const s of this.shadows) {
      if (s.state === 'gone' || s.x - s.r - this.px > r || s.x < this.px - 2) continue;
      if (s.shield && share < 0.5) continue;
      n += this.kill(s, 'flash');
    }
    const g = this.guard;
    if (g && g.state === 'fight' && share >= 0.3) {
      g.dawnOpen = RULES.dawnOpen * share;
      this.emit({ type: 'guard', what: 'open', id: g.id, era: g.era });
    }
    this.flashT = RULES.flashSec;
    this.flashR = r;
    this.emit({ type: 'flash', share, r, n });
  }

  // ── the pilgrim ─────────────────────────────────────────────────
  private hands(dt: number, w: number): void {
    this.slashCd = Math.max(0, this.slashCd - dt);
    this.burstCd = Math.max(0, this.burstCd - dt);
    this.safe = Math.max(0, this.safe - w);
    this.stumble = Math.max(0, this.stumble - w);
    this.pull = Math.max(0, this.pull - w);
    if (this.slashBuf && this.slashCd <= 0) {
      this.slashBuf = false;
      this.slash();
    }
    if (this.slashT < RULES.slashSec) {
      this.slashT += w;
      this.slashFrame();
    }
    if (this.combo > 0) {
      this.comboT += w;
      if (this.comboT >= RULES.comboLapse) this.combo = 0;
    }
  }

  /** The arc while it can hit: every shadow and shot in it, once each; the guardian once. */
  private slashFrame(): void {
    if (this.slashT > RULES.slashActive) return;
    const R = RULES;
    const x0 = this.px - 0.35, x1 = this.px + R.halfW + this.slashReach;
    const y0 = this.py - 0.3, y1 = this.py + R.swordHigh;
    for (const s of this.shadows) {
      if (s.state !== 'walk' || this.slashHit.has(s.id)) continue;
      if (s.x + s.r < x0 || s.x - s.r > x1 || s.y + s.h < y0 || s.y > y1) continue;
      this.slashHit.add(s.id);
      this.hitShadow(s);
    }
    for (const s of this.shots) {
      if (!s.alive || this.slashHit.has(-s.id) || s.wait > 0.15) continue;
      if (s.x + s.r < x0 || s.x - s.r > x1 || s.y + s.r < y0 || s.y - s.r > y1) continue;
      this.slashHit.add(-s.id);
      this.breakShot(s, 'slash');
    }
    const g = this.guard;
    if (g && g.state === 'fight' && !this.slashGuard && this.px + g.rel <= x1) {
      this.slashGuard = true;
      this.hitGuard(g);
    }
  }

  private hitShadow(s: Shadow): void {
    const R = RULES;
    s.hitT = 0.14;
    if (s.shield) {
      s.shield = false;
      s.knock = 2.5;
      this.stop = Math.max(this.stop, R.stopHit);
      this.emit({ type: 'clink', x: s.x, y: s.y + s.h / 2, guard: false });
      this.emit({ type: 'shieldBreak', id: s.id, x: s.x, y: s.y + s.h / 2, via: 'slash' });
      return;
    }
    s.hp -= 1;
    this.emit({ type: 'hit', id: s.id, kind: s.kind, x: s.x, y: s.y + s.h / 2, combo: this.combo + 1 });
    if (s.hp <= 1e-6) this.kill(s, 'slash');
    else {
      s.knock = 2;
      this.stop = Math.max(this.stop, R.stopHit);
    }
  }

  /** A shadow leaves the road as motes of light; 1 when it counted. */
  private kill(s: Shadow, via: Via): number {
    if (s.state === 'gone') return 0;
    s.state = 'gone';
    if (via === 'touch' || via === 'fade') return 0;
    const R = RULES;
    let sparks = SHADOWS[s.kind].sparks;
    if (via === 'slash') {
      this.combo++;
      this.comboT = 0;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      sparks *= this.mult;
      if ((R.comboAt as readonly number[]).includes(this.combo)) {
        this.emit({ type: 'combo', n: this.combo, mult: comboMult(this.combo) });
        this.talk.say('big', 1, 3);
      }
      this.stop = Math.max(this.stop, R.stopKill);
      this.killTimes.push(this.t);
    }
    this.kills++;
    this.gain(sparks);
    this.emit({ type: 'kill', id: s.id, kind: s.kind, x: s.x, y: s.y + s.h / 2, via, sparks, combo: this.combo });
    return 1;
  }

  /** Oil lost (never below none); with none he falls. */
  private harm(kind: HarmKind, x: number, y: number): void {
    if (this.safe > 0 || this.state !== 'run') return;
    const loss = harmFor(kind, this.ups.oil);
    this.oil = Math.max(0, this.oil - loss);
    this.hits++;
    this.combo = 0;
    this.safe = RULES.safeSec;
    this.stumble = RULES.stumbleSec;
    this.emit({ type: 'harm', kind, oil: this.oil, x, y });
    if (this.oil <= 0.001) this.fall();
    else if (this.oil < 0.3 && !this.oilWarned) {
      this.oilWarned = true;
      this.talk.say('oil', 1, 3);
    }
  }

  /** No oil: he falls, and rises at a lantern post with half oil (Micah 7:8). */
  private fall(): void {
    this.state = 'fallen';
    this.stateT = 0;
    this.falls++;
    this.slideT = 0;
    this.emit({ type: 'fall' });
    this.talk.say('fall', 2, 4);
  }

  private rise(): void {
    const R = RULES;
    this.state = 'run';
    this.oil = R.riseOil;
    this.oilWarned = false;
    this.safe = R.safeSec * 1.5;
    this.lastPost = this.px;
    this.posts.push({ x: this.px - 0.6, lit: 'warm' });
    // the shadows near step back into the dark; a guardian catches its breath too
    for (const s of this.shadows) if (s.state !== 'gone' && s.x - this.px < R.clearNear && s.x > this.px - 2) this.kill(s, 'fade');
    for (const s of this.shots) if (s.alive) this.breakShot(s, 'burst');
    const g = this.guard;
    if (g && g.state === 'fight') {
      g.i = 0;
      g.moveT = 0;
      g.acted = false;
      g.begun = false;
      g.delay = Math.max(g.delay, 1);
    }
    this.emit({ type: 'rise', x: this.px });
  }

  /** Run, jump, fall, slide; the pits and the beams. */
  private runner(w: number): void {
    const R = RULES;
    // the speed this moment wants
    let target: number;
    if (this.state !== 'run' || this.pull > 0) target = 0;
    else if (this.guard && (this.guard.state === 'enter' || this.guard.state === 'fight')) target = R.fight;
    else if (this.phase === 'finale') target = R.dawnRun;
    else if (this.phase === 'done') target = R.walk;
    else if (this.block.kind === 'rest') target = R.walk;
    else if (this.block.kind === 'warmup') target = R.warmRun;
    else target = R.run + R.bootsStep * this.ups.boots + R.lapRun * this.lap;
    if (this.stumble > 0 && target > 0) target *= 0.55;
    this.speed = approach(this.speed, target, w, R.speedTau);
    if (this.state === 'pit') {
      this.stateT += w;
      this.py = Math.max(-1.4, this.py - 6 * w);
      if (this.stateT >= R.pitSec) {
        this.state = 'run';
        this.px = this.pitTo;
        this.py = 0;
        this.vy = 0;
        this.grounded = true;
        this.emit({ type: 'climb', x: this.px });
      }
      return;
    }
    if (this.state === 'fallen') {
      this.stateT += w;
      if (this.stateT >= R.fallSec) this.rise();
      return;
    }
    this.px += this.speed * w;
    if (!this.settled) this.score = Math.max(this.score, Math.floor(this.px));
    // the lantern posts along the road: lit gold when passed with the level above the threshold
    while (this.px >= this.nextPost) {
      const lit = this.live && this.level >= 0.5 ? 'gold' : 'warm';
      this.posts.push({ x: this.nextPost, lit });
      if (this.posts.length > 12) this.posts.shift();
      this.lastPost = this.nextPost;
      this.emit({ type: 'post', x: this.nextPost, lit });
      this.nextPost += R.postEvery;
    }
    // the air
    const overPit = this.features.find(ft => ft.kind === 'pit' && this.px > ft.x0 + 0.12 && this.px < ft.x1 - 0.12);
    if (!this.grounded) {
      this.vy -= R.g * w;
      this.py += this.vy * w;
      if (this.py <= 0 && !overPit) {
        this.py = 0;
        this.vy = 0;
        this.grounded = true;
        this.emit({ type: 'land' });
        if (this.jumpBuf > 0) this.doJump();
        else if (this.slideOnLand) {
          this.slideOnLand = false;
          this.slideT = R.slideSec;
          this.slideFrom = this.px;
          this.emit({ type: 'slide' });
        }
      }
    } else if (overPit) {
      this.grounded = false;
      this.coyoteT = R.coyote;
      this.vy = 0;
    }
    if (!this.grounded) {
      this.coyoteT = Math.max(0, this.coyoteT - w);
      this.jumpBuf = Math.max(0, this.jumpBuf - w);
    }
    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - w);
    // into a pit: he climbs out on the far rim
    if (overPit && this.py < -0.25) {
      this.harm('pit', this.px, 0);
      this.state = 'pit';
      this.stateT = 0;
      this.pitTo = overPit.x1 + 0.3;
      overPit.hit = true;
      this.slideT = 0;
      this.emit({ type: 'pit', x: this.px });
      return;
    }
    // the features passed or struck
    for (const ft of this.features) {
      if (ft.passed) continue;
      if (ft.kind === 'beam') {
        const inside = this.px + R.halfW > ft.x0 && this.px - R.halfW < ft.x1;
        const top = this.py + this.bodyH;
        if (inside && !ft.hit && top > R.beamLow && this.py < R.beamTop) {
          ft.hit = true;
          this.harm('beam', ft.x0, R.beamLow);
        }
        if (this.px - R.halfW > ft.x1) {
          ft.passed = true;
          if (!ft.hit) this.dodged('slide', ft.x0 - (this.slideFrom + R.halfW));
        }
      } else if (this.px - R.halfW > ft.x1) {
        ft.passed = true;
        if (!ft.hit) this.dodged('jump', Math.min(ft.x0 - this.jumpFrom, 9));
      }
    }
    if (this.grounded) this.jumpFrom = this.px;
    // forget what is behind
    let n = 0;
    for (const ft of this.features) if (ft.x1 > this.px - R.behind) this.features[n++] = ft;
    this.features.length = n;
  }

  private jumpFrom = 0;
  private slideFrom = -99;

  private dodged(what: 'jump' | 'slide', margin: number): void {
    const near = margin >= 0 && margin < RULES.nearMiss;
    this.emit({ type: 'dodge', what, near });
    if (near && this.t - this.lastNear > 20) {
      this.lastNear = this.t;
      this.talk.say('near', 1, 2.5);
    }
  }

  // ── the road ────────────────────────────────────────────────────
  /** Lay the road ahead: in a Światło and the warm-up, shadows of the era, pits and beams; nothing in a meadow. */
  private road(): void {
    const R = RULES;
    if (this.phase !== 'play' || this.story > 0) return;
    const b = this.block;
    const guardOn = !!this.guard && this.guard.state !== 'beaten' && this.guard.state !== 'leave';
    if (b.kind === 'rest' || guardOn) {
      this.roadX = Math.max(this.roadX, this.px + 6);
      return;
    }
    // stop laying a few seconds before a push block ends: the meadow should start clear
    if (b.kind === 'push' && b.dur - this.blockT < 2) return;
    while (this.roadX < this.px + R.ahead) {
      const x = this.roadX;
      let what: 'shadow' | 'pit' | 'beam' | 'lamp';
      if (b.kind === 'warmup') what = WARM_SCRIPT[this.warmI++ % WARM_SCRIPT.length];
      else {
        const r = this.rng();
        what = r < R.mix.shadow ? 'shadow' : r < R.mix.shadow + R.mix.pit ? 'pit' : 'beam';
      }
      let len = 0;
      if (what === 'pit') {
        const w = span(R.pitW, this.rng());
        this.features.push({ kind: 'pit', x0: x, x1: x + w, hit: false, passed: false });
        len = w + 1.2;
      } else if (what === 'beam') {
        this.features.push({ kind: 'beam', x0: x, x1: x + 0.45, hit: false, passed: false });
        len = 1.4;
      } else {
        const kind: ShadowKind = what === 'lamp' ? (this.era === 'babel' ? 'ceglomiot' : this.eraKind()) : this.eraKind();
        this.spawn(kind, x);
        len = 0.8;
      }
      const gap = b.kind === 'warmup' ? 6.8 : span(R.gap, this.share) * (1 - 0.06 * this.lap) + this.rng() * 1.4;
      this.roadX = x + len + gap;
    }
  }

  private eraKind(): ShadowKind {
    const mix = ERA_SHADOWS[this.era];
    let r = this.rng() * mix.reduce((s, m) => s + m[1], 0);
    for (const [k, wgt] of mix) if ((r -= wgt) <= 0) return k;
    return mix[0][0];
  }

  spawn(kind: ShadowKind, x: number): Shadow {
    const s0 = SHADOWS[kind];
    const s: Shadow = {
      id: this.nextId++, kind, x, y: s0.air, hp: s0.hp, r: s0.r, h: s0.h, shield: kind === 'giermek', crack: 0,
      state: kind === 'pling' ? 'hidden' : 'walk', age: 0, stun: 0, hitT: 0, inLight: false, burn: 0,
      throwT: 0.4 + this.rng() * 0.6, dive: 0, knock: 0,
    };
    if (kind === 'giermek') s.hp = 1;
    this.shadows.push(s);
    this.emit({ type: 'spawn', id: s.id, kind });
    return s;
  }

  /** The shadows ahead (beyond `from` u) draw back into the dark. */
  private clearAhead(from: number): void {
    for (const s of this.shadows) if (s.state !== 'gone' && s.x > this.px + from) this.kill(s, 'fade');
    for (const s of this.shots) if (s.alive && !s.rel) s.alive = false;
    for (let i = this.features.length - 1; i >= 0; i--) if (this.features[i].x0 > this.px + from + 2) this.features.splice(i, 1);
    this.roadX = this.px + 6;
  }

  private walkShadows(w: number): void {
    const R = RULES;
    for (const s of this.shadows) {
      if (s.state === 'gone') continue;
      const d = s.x - this.px;
      if (s.state === 'hidden') {
        if (d < R.popAt) {
          s.state = 'walk';
          this.emit({ type: 'pop', id: s.id, x: s.x, y: s.y });
        }
        continue;
      }
      s.age += w;
      s.hitT = Math.max(0, s.hitT - w);
      if (s.stun > 0) {
        s.stun = Math.max(0, s.stun - w);
        continue;
      }
      if (s.knock > 0.01) {
        s.x += s.knock * w;
        s.knock = approach(s.knock, 0, w, 0.12);
      }
      const slow = s.inLight ? R.lightSlow : 1;
      const sp = SHADOWS[s.kind].speed;
      switch (s.kind) {
        case 'ceglomiot':
          if (d > R.throwFrom[0] && d < R.throwFrom[1]) {
            s.throwT -= w * slow;
            if (s.throwT <= 0) {
              s.throwT = R.throwEvery;
              this.throwBrick(s);
            }
          }
          break;
        case 'kruk':
          s.x -= sp * slow * w;
          if (d < R.diveAt || s.dive > 0) {
            s.dive = Math.min(1.6, s.dive + (w * slow) / R.diveSec);
            const k = s.dive <= 1 ? s.dive : 1 - (s.dive - 1) * 1.5;
            s.y = SHADOWS.kruk.air + (R.diveY - SHADOWS.kruk.air) * Math.sin((Math.PI / 2) * clamp(k));
          }
          break;
        case 'pling':
          s.y = SHADOWS.pling.air + Math.sin(s.age * 5) * 0.06;
          break;
        default:
          s.x -= sp * slow * w;
      }
      // a touch: harm and the shadow dissolves (it passes through while he is safe)
      const top = this.py + this.bodyH;
      if (this.state === 'run' && Math.abs(s.x - this.px) < s.r + R.halfW && s.y < top && s.y + s.h > this.py) {
        if (this.safe <= 0) {
          this.harm(SHADOWS[s.kind].harm, s.x, s.y + s.h / 2);
          if (s.kind === 'przewijacz') this.pull = R.pullSec;
          this.kill(s, 'touch');
        }
      }
      if (s.x < this.px - R.behind) s.state = 'gone';
    }
    let n = 0;
    for (const s of this.shadows) if (s.state !== 'gone') this.shadows[n++] = s;
    this.shadows.length = n;
  }

  /** A clay shadow throws a brick in an arc toward where the pilgrim will be. */
  private throwBrick(s: Shadow): void {
    const R = RULES;
    const T = R.throwSec;
    const tx = this.px + this.speed * T + 0.15;
    const y0 = s.y + s.h * 0.9;
    const g = 16;
    this.shots.push({
      id: this.nextId++, kind: 'brick', x: s.x - s.r, y: y0, vx: (tx - (s.x - s.r)) / T, vy: (0.25 - y0 + 0.5 * g * T * T) / T, g, r: 0.17,
      rel: false, relX: 0, wait: 0, harm: 'brick', alive: true, t: 0,
    });
    this.emit({ type: 'throw', id: s.id, x: s.x });
  }

  private shot(kind: ShotKind, relX: number, y: number, vx: number, vy: number, wait: number, r: number, harm: HarmKind): Shot {
    const s: Shot = { id: this.nextId++, kind, x: this.px + relX, y, vx, vy, g: 0, r, rel: true, relX, wait, harm, alive: true, t: 0 };
    this.shots.push(s);
    return s;
  }

  private moveShots(w: number): void {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.t += w;
      if (s.wait > 0) {
        s.wait = Math.max(0, s.wait - w);
        if (s.rel) s.x = this.px + s.relX;
        continue;
      }
      if (s.rel) {
        s.relX += s.vx * w;
        s.x = this.px + s.relX;
      } else {
        s.x += s.vx * w;
        s.vy -= s.g * w;
      }
      s.y += s.vy * w;
      // the pilgrim
      const top = this.py + this.bodyH;
      if (this.state === 'run' && Math.abs(s.x - this.px) < s.r + RULES.halfW && s.y - s.r < top && s.y + s.r > this.py) {
        if (this.safe <= 0) this.harm(s.harm, s.x, s.y);
        s.alive = false;
        continue;
      }
      if (s.y - s.r <= 0 && s.kind !== 'roll') this.breakShot(s, 'ground');
      else if (s.kind === 'roll' && s.relX < -2.5) {
        s.alive = false;
        this.dodged('jump', 1);
      } else if (s.kind === 'pling' && s.relX < -1.5) s.alive = false;
      else if (s.x < this.px - RULES.behind) s.alive = false;
    }
    let n = 0;
    for (const s of this.shots) if (s.alive) this.shots[n++] = s;
    this.shots.length = n;
  }

  private breakShot(s: Shot, via: 'slash' | 'burst' | 'dawn' | 'ground'): void {
    if (!s.alive) return;
    s.alive = false;
    if (via === 'slash') this.stop = Math.max(this.stop, RULES.stopHit);
    this.emit({ type: 'shotBreak', id: s.id, kind: s.kind, x: s.x, y: s.y, via });
  }

  // ── the guardians ───────────────────────────────────────────────
  private guardian(w: number, f: FocusFrame): void {
    const R = RULES;
    // a guardian comes: in a push block planned for it, or one that withdrew comes back
    if (!this.guard && this.phase === 'play' && this.pushBlock && !this.blockGuardDone && (this.block.guard || this.pendingGuard)) {
      const b = this.block;
      const at = this.pendingGuard ? this.lead + 1 : Math.max(this.lead + 1, Math.min(b.dur * R.guardAt, b.dur - R.guardLate));
      if (this.blockT >= at && b.dur - this.blockT > 4) this.summon();
    }
    const g = this.guard;
    if (!g) return;
    g.st += w;
    g.hitT = Math.max(0, g.hitT - w);
    if (g.state === 'enter') {
      g.rel = approach(g.rel, R.guardGap, w, 0.45);
      if (g.st >= 1.8) {
        g.rel = R.guardGap;
        g.state = 'fight';
        g.st = 0;
        this.emit({ type: 'guard', what: 'fight', id: g.id, era: g.era });
      }
      return;
    }
    if (g.state === 'leave' || g.state === 'beaten') {
      g.rel += (g.state === 'leave' ? 6 : 0) * w;
      if (g.st >= 1.4) this.guard = null;
      return;
    }
    // the fight: the guardian's clock (angrier: faster; in a live light above the threshold: slower)
    const k = this.live ? above(f.level) : 0;
    const clock = (g.angry ? R.angry : 1) * (1 - (1 - R.guardSlow) * k);
    if (this.live && k > 0) {
      g.hp -= R.guardDps * k * w;
      if (Math.floor(g.hp + R.guardDps * k * w) > Math.floor(g.hp)) this.emit({ type: 'guardHit', id: g.id, left: Math.max(0, g.hp), combo: this.combo, via: 'light' });
      if (g.hp <= 1e-6) {
        this.beaten(g);
        return;
      }
    }
    if (!g.angry && g.hp <= g.maxHp * R.angryAt) {
      g.angry = true;
      g.seq = SEQ[g.id].angry;
      g.i = 0;
      g.moveT = 0;
      g.acted = false;
      g.begun = false;
      this.emit({ type: 'guard', what: 'angry', id: g.id, era: g.era });
      this.talk.say('angry', 1, 3);
    }
    g.dawnOpen = Math.max(0, g.dawnOpen - w);
    g.sweep = Math.max(0, g.sweep - w);
    if (g.sweep > 0) this.sweepHurts(g);
    if (g.delay > 0) {
      g.delay = Math.max(0, g.delay - w);
      return;
    }
    if (this.state !== 'run') return;
    const mv = g.seq[g.i];
    const spec = R.moves[mv];
    if (!g.begun) {
      g.begun = true;
      this.moveStart(g, mv);
    }
    g.moveT += w * (mv === 'open' ? 1 : clock);
    if (!g.acted && g.moveT >= spec.tele) {
      g.acted = true;
      this.act(g, mv);
    }
    if (g.moveT >= spec.len) {
      g.i = (g.i + 1) % g.seq.length;
      g.moveT = 0;
      g.acted = false;
      g.begun = false;
      if (g.seq[g.i] === 'strike' && g.i === 0) g.parried = 0;
    }
  }

  /** A guardian comes now (its block brings it; the tests call it directly). */
  summon(): void {
    const R = RULES;
    this.blockGuardDone = true;
    let g = this.pendingGuard;
    this.pendingGuard = null;
    if (!g || g.era !== this.era) {
      const id = GUARDS[this.era];
      const hp = guardHpFor(this.eraI, this.plannedSec, this.lap);
      g = {
        id, era: this.era, hp, maxHp: hp, state: 'enter', rel: R.guardEnter, st: 0, seq: SEQ[id].calm, i: 0, moveT: 0, acted: false,
        dawnOpen: 0, delay: 0, hitT: 0, angry: false, parried: 0, sweep: 0, begun: false,
      };
    }
    g.state = 'enter';
    g.st = 0;
    g.rel = R.guardEnter;
    g.i = 0;
    g.moveT = 0;
    g.acted = false;
    g.begun = false;
    g.delay = 0.6;
    if (g.angry) g.seq = SEQ[g.id].angry;
    this.guard = g;
    this.clearAhead(1.5);
    this.emit({ type: 'guard', what: 'come', id: g.id, era: g.era });
    this.talk.say(`guard.${g.id}`, 2, 4);
  }

  private withdraw(): void {
    const g = this.guard;
    if (!g || g.state === 'beaten' || g.state === 'leave') return;
    g.state = 'leave';
    g.st = 0;
    g.dawnOpen = 0;
    g.sweep = 0;
    for (const s of this.shots) if (s.rel) s.alive = false;
    this.pendingGuard = g;
    this.emit({ type: 'guard', what: 'leave', id: g.id, era: g.era });
  }

  /** A move's first moment: what it shows (a falling brick's shadow, the notifications, a telegraph). */
  private moveStart(g: Guard, mv: MoveKind): void {
    const R = RULES;
    this.emit({ type: 'move', kind: mv, act: false, id: g.id });
    if (mv === 'rain') this.shot('rain', 0.04, R.rainY, 0, -R.rainV, R.moves.rain.tele, 0.2, 'brick');
    else if (mv === 'plings') {
      const n = g.angry ? 3 : 2;
      for (let i = 0; i < n; i++) this.shot('pling', g.rel + 0.4 + i * 0.75, 0.85 + (i % 2) * 0.3, -R.plingV, 0, 0, 0.27, 'pling');
    } else if (mv === 'open') this.emit({ type: 'guard', what: 'open', id: g.id, era: g.era });
    else if (mv === 'strike' && g.i === 0) g.parried = 0;
  }

  /** A move's blow lands. */
  private act(g: Guard, mv: MoveKind): void {
    const R = RULES;
    this.emit({ type: 'move', kind: mv, act: true, id: g.id });
    switch (mv) {
      case 'roll':
        this.shot('roll', g.rel - 0.2, 0.22, -R.rollV, 0, 0, 0.22, 'brick');
        break;
      case 'strike': {
        // slashed as it lands: parried; under it: ducked; else it hurts
        const parried = this.slashT <= R.parry + R.slashActive;
        if (parried) {
          g.parried++;
          this.stop = Math.max(this.stop, R.stopGuard);
          this.emit({ type: 'parry', n: g.parried });
          this.emit({ type: 'clink', x: this.px + 0.6, y: 1, guard: true });
          // three blows parried: the knight staggers and is open at once
          if (g.parried >= 3) {
            const open = g.seq.indexOf('open', g.i);
            if (open > g.i) {
              g.i = open - 1;
              g.moveT = R.moves[g.seq[g.i]].len;
              g.begun = true;
            }
            g.parried = 0;
          }
        } else if (!this.sliding) this.harm('guard', this.px + 0.4, 1);
        else this.dodged('slide', 0.1);
        break;
      }
      case 'heavy':
      case 'sweep':
        g.sweep = R.sweepSec;
        this.sweepHurts(g);
        break;
      default:
        break;
    }
  }

  /** The heavy blow sweeps the road (jump it); the screen's beam sweeps at head height (slide under it). */
  private sweepHurts(g: Guard): void {
    const mv = g.seq[g.i];
    if (this.safe > 0 || this.state !== 'run') return;
    if (mv === 'heavy' && this.py < 0.45) this.harm('guard', this.px, 0.2);
    else if (mv === 'sweep' && this.py + this.bodyH > 0.62) this.harm('guard', this.px, 1);
  }

  private hitGuard(g: Guard): void {
    const R = RULES;
    if (!this.guardOpen) {
      g.hitT = 0.08;
      this.emit({ type: 'clink', x: this.px + g.rel, y: 1.2, guard: true });
      return;
    }
    g.hp -= 1;
    g.hitT = 0.16;
    this.combo++;
    this.comboT = 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.stop = Math.max(this.stop, R.stopGuard);
    this.emit({ type: 'guardHit', id: g.id, left: Math.max(0, g.hp), combo: this.combo, via: 'slash' });
    if (g.hp <= 1e-6) this.beaten(g);
  }

  /** A guardian dissolves into light: its era is crossed (beyond the third, the dawn gate). */
  private beaten(g: Guard): void {
    const R = RULES;
    g.state = 'beaten';
    g.st = 0;
    g.hp = 0;
    for (const s of this.shots) if (s.alive && s.rel) this.breakShot(s, 'dawn');
    this.stop = Math.max(this.stop, R.stopBeaten);
    this.guardsBeaten.push(g.id);
    this.gain(R.guardSparks * (1 + this.lap));
    this.emit({ type: 'guard', what: 'beaten', id: g.id, era: g.era });
    this.eraI++;
    if (this.eraI >= ERAS.length) {
      this.eraI = 0;
      this.lap++;
      this.gates++;
      this.emit({ type: 'gate', lap: this.lap });
      this.talk.say('gate', 3, 5);
    } else this.talk.say('beaten', 2, 4);
    this.maxEra = this.lap > 0 ? ERAS.length - 1 : Math.max(this.maxEra, this.eraI);
    this.emit({ type: 'era', era: this.era, lap: this.lap });
    this.talk.say(`era.${this.era}`, 1, 9);
    this.roadX = this.px + 7;
  }

  // ── the companion's eyes ────────────────────────────────────────
  /** Watch for the moments she comments on: a good push, a dim lamp, a calm meadow, a flurry of kills. */
  private watch(dt: number): void {
    if (this.phase !== 'play') return;
    if (this.live) {
      this.goodT = this.level >= 0.6 ? this.goodT + dt : 0;
      this.smallT = this.level < 0.35 ? this.smallT + dt : 0;
      if (this.goodT >= 4 && !this.saidGood) {
        this.saidGood = true;
        this.talk.say('good', 1, 4);
      }
      if (this.smallT >= 9 && !this.saidSmall) {
        this.saidSmall = true;
        this.talk.say('small', 0, 4);
      }
    }
    if (this.restBlock && this.blockT >= this.restLead && this.reliable) {
      this.calmT = this.calm >= 0.6 ? this.calmT + dt : 0;
      if (this.calmT >= 4 && !this.saidCalm) {
        this.saidCalm = true;
        this.talk.say('calm', 1, 4);
      }
    }
    if (this.oil > 0.6) this.oilWarned = false;
    this.killTimes = this.killTimes.filter(k => this.t - k < 1.2);
    if (this.killTimes.length >= 3) {
      this.killTimes.length = 0;
      this.talk.say('big', 1, 2.5);
    }
  }

  /** What the hands should do now: a guardian's telegraph, or in the first sessions the next thing on the road. */
  private hintNow(): Hint | null {
    if (this.state !== 'run' || this.story > 0) return null;
    const g = this.guard;
    if (g && g.state === 'fight') {
      if (this.guardOpen) return 'open';
      if (g.delay > 0) return null;
      const mv = g.seq[g.i];
      return mv === 'open' ? 'open' : MOVE_HINT[mv];
    }
    if (this.session > 2 && !this.warmBlock) return null;
    let near: { d: number; h: Hint } | null = null;
    for (const s of this.shadows) {
      if (s.state !== 'walk') continue;
      const d = s.x - s.r - this.px;
      if (d < -0.2 || d > 4.2) continue;
      const h: Hint = s.kind === 'ceglomiot' && this.warmBlock ? 'lamp' : 'slash';
      if (!near || d < near.d) near = { d, h };
    }
    for (const ft of this.features) {
      const d = ft.x0 - this.px;
      if (ft.passed || d < -0.3 || d > 4.2) continue;
      if (!near || d < near.d) near = { d, h: ft.kind === 'pit' ? 'jump' : 'slide' };
    }
    return near?.h ?? null;
  }

  // ── the end ─────────────────────────────────────────────────────
  /** The last block ended: the run toward the dawn. */
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    if (this.guard && this.guard.state !== 'beaten') this.withdraw();
    this.phase = 'finale';
    this.phaseT = 0;
    this.dawnCharge = 0;
    this.clearAhead(1);
    this.emit({ type: 'finale' });
    this.talk.say('end', 3, 4);
  }

  private end(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.phaseT = 0;
    this.emit({ type: 'done' });
    this.settle();
  }

  private gain(sparks: number): void {
    if (sparks > 0 && !this.settled) this.sparks += sparks;
  }

  /**
   * The run is settled once — at the dawn, or when it ends early: the day's gift comes, the sparks
   * reach the purse and the looks, the eras reached open as starts, the counters reach the progress.
   */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, R = RULES;
    if (p.giftDay !== this.init.day) {
      p.giftDay = this.init.day;
      this.dayGiftNow = R.dayGift;
      this.emit({ type: 'dayGift', n: R.dayGift });
    }
    const before = lookOf(p.sparksAll);
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.total += this.score;
    p.sparks += this.sparks + this.dayGiftNow;
    p.sparksAll += this.sparks + this.dayGiftNow;
    p.guards += this.guardsBeaten.length;
    p.gates += this.gates;
    p.dawns += this.dawns;
    p.reached = Math.max(p.reached, this.maxEra);
    p.lastLen = this.plannedSec;
    const after = lookOf(p.sparksAll);
    if (after > before) {
      this.lookUp = after;
      this.emit({ type: 'look', look: after });
    }
  }

  /** The session ends before its own dawn: settle as the dawn would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
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

  /** The pad follows the lamp in a sighted Światło, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.lampR - RULES.lampMin - this.ups.lamp * RULES.lampStep) / RULES.lampExtra);
    return null;
  }

  /** Time is up: stop once the run reached its dawn, or a moment later (a fall or a pit settles). */
  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestCombo = Math.max(p.bestCombo, this.bestCombo);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const stats: [string, string][] = [
      [t('stat.era'), this.gates > 0 ? t('stat.gate', { n: this.gates }) : eraName(this.era)],
      [t('stat.guards'), this.guardsBeaten.length ? this.guardsBeaten.map(guardName).join(', ') : '—'],
      [t('stat.sparks'), fmtNum(this.sparks)],
      [t('stat.dawns'), String(this.dawns)],
      [t('stat.combo'), String(this.bestCombo)],
      [t('stat.oil'), this.falls === 0 ? t('stat.oilKept') : t('stat.oilFalls', { n: this.falls })],
      [t('stat.look'), LOOKS[lookOf(p.sparksAll)]],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: t('unit'), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the run fits, in turn from session to session: the first run,
   * a guardian beaten or a fall risen from, a Świt, the dawn gate, a long push with a wide lamp, a
   * passed meadow; else Psalm 139:12.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('psa23.4');
    if (this.guardsBeaten.length || this.falls > 0) fit.push('mic7.8');
    if (this.dawns > 0) fit.push('jhn8.12');
    if (this.gates > 0) fit.push('1pe2.9');
    if (this.maxHold >= RULES.longHold) fit.push('psa119.105');
    if (this.passedRests > 0) fit.push('psa23.1-3');
    fit.push('psa139.12');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    if (this.gates > 0) add(0, t('hl.gate'));
    if (this.lookUp >= 0) add(1, t('hl.look', { name: LOOKS[this.lookUp] }));
    if (this.guardsBeaten.length) add(2, t('hl.guards', { list: this.guardsBeaten.map(guardName).join(', ') }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { n: fmtNum(this.score) }));
    if (this.dawns) add(4, t('hl.dawns', { n: this.dawns }));
    if (this.blindShare >= 0) add(5, t('hl.blind', { n: this.blindShare }));
    if (this.bestCombo >= RULES.comboAt[0]) add(6, t('hl.combo', { n: this.bestCombo }));
    if (this.dayGiftNow) add(7, t('hl.dayGift', { sparks: sparksText(this.dayGiftNow) }));
    const out = notes.sort((a, b) => a.rank - b.rank).slice(0, 4).map(n => n.text);
    // the story's closing line, in Ćma's words
    out.push(t(this.gates > 0 ? 'close.gate' : this.guardsBeaten.length ? 'close.guard' : this.started && this.t > 20 ? 'close.walk' : 'close.short'));
    return out;
  }
}

/** A moment of the companion (re-exported for the tests). */
export type { Moment };
