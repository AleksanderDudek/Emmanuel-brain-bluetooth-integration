/**
 * Jerzy i smok's fight, without the DOM or the canvas (so every rule is unit-tested): the knight in
 * the top-down arena, his strikes and rolls, the shield, the Miecz światła, the dragon's patterns
 * and fire, the heart and the princess's apple, the Postój, the levels and skills of the fight, the
 * blocks, the last clash, the map (meta.ts) and the session's numbers.  All numbers are in rules.ts
 * (re-exported here).
 *
 * The hands move: a tap sets where Jerzy walks (a tap on the dragon: he goes after it and stays in
 * reach), a drag steers, a swipe or Space rolls (a quick dodge, invulnerable for a moment).  He
 * faces the dragon and strikes by himself whenever it is in reach; every strike knocks off a scale.
 * The dragon telegraphs every attack in the arena (red shapes 0.8–1.2 s ahead): fire (the breath's
 * flames, fireballs, drops from the sky) is put out by the shield; blows (the tail, the bite, the
 * dive, the swoop) are dodged.  The band only adds:
 *   Tarcza (push)   after a lead-in the shield's radius is shieldMin + level × shieldExtra: fire that
 *                   meets it is put out, and every flame put out charges the Miecz światła; a held
 *                   focus (5 s Mendi / 3 s HALO) charges it too; at full the next strike is a great
 *                   sword of light.
 *   Postój (rest)   the dragon flies to its cave for a nap; calm restores the heart and fills Linda's
 *                   tip; a passed one (or a full tip) marks the dragon's flaw in the next Tarcza,
 *                   where strikes knock off twice the scales.
 *   Dym (blind)     every 4th Tarcza from the 3rd session: the shield stays a buckler, the trace is
 *                   veiled; at its end the block's last 15 s fill the Miecz at once.
 * Each block is judged once at its end (RoundJudge, the session's tuning).  While the signal is
 * unreliable the shield rests at the buckler; the block clock runs on.
 *
 * Grace: at no heart the knight is knocked down, Linda throws him an apple and he gets up with half
 * a heart while the dragon catches its breath.  Nothing ends the fight early; a dragon not beaten
 * when the session ends flies to its cave and keeps its damage for the next fight.  A dragon beaten
 * flies off over the hills (driven away, never killed), the town celebrates and the next one comes.
 *
 * The headline is the scales knocked off this session, counted live.
 */
import { fmtNum } from '../../i18n';
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { approach, clamp } from '../kit/juice';
import { inTurn, type PassageId } from '../kit/scripture';
import { SignalTrace, type TracePhase } from '../kit/trace';
import type { ArcadeOutcome } from '../kit/types';
import {
  LINES, SKILLS, TIPS, WARM_PATTERNS, dragonName, skillById, townName,
  type DragonKind, type DragonSpec, type Moment, type Pattern, type SkillId,
} from './content';
import { scales as scalesText, t, unit } from './i18n';
import { armouryOf, bestFor, dragonAt, hpOf, lenKey, nextArmoury, phaseAt, phasesOf, type JerzyProgress } from './meta';
import { RULES, span } from './rules';
import { Talk } from './talk';

export { RULES } from './rules';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';
/** How the shield looks: the buckler, live, waiting out the band's delay, grey without signal, smoke in a blind block. */
export type ShieldLook = 'buckler' | 'live' | 'wait' | 'grey' | 'smoke';
export type DState = 'away' | 'arrive' | 'move' | 'tele' | 'act' | 'flaw' | 'roar' | 'breather' | 'toCave' | 'nap' | 'fromCave' | 'leave';
export type Burn = 'blob' | 'ball' | 'sweep' | 'bite' | 'dive' | 'swoop';
export type Via = 'strike' | 'sword' | 'lance' | 'horse' | 'reflect';

export interface Knight {
  x: number; y: number;
  /** where he walks, whether he walks, whether he goes after the dragon */
  tx: number; ty: number; walking: boolean; engage: boolean;
  /** the way he faces (rad): toward the dragon */
  face: number;
  /** till the next strike (s), the roll's time left, its velocity, its cooldown (s) */
  swingT: number; rollT: number; rollVx: number; rollVy: number; rollCool: number;
  /** invulnerable (s), heart (0..1), knocked down (s left), strikes so far, a hit's flash (s) */
  safe: number; heart: number; down: number; strikes: number; hitT: number;
}

export interface Dragon {
  idx: number; spec: DragonSpec; circle: number;
  x: number; y: number; face: number;
  state: DState; st: number; dur: number; pattern: Pattern | null;
  phases: number[]; phase: number; left: number; damage: number;
  /** height in flight (0..1), under the marsh, a hit's flash (s), the roar's flash */
  air: number; under: boolean; hitT: number;
  /** where it goes (move), where a fly began and ends (arrive, cave, leave, swoop, bite) */
  tx: number; ty: number; fx: number; fy: number; ex: number; ey: number;
  /** flames still to come out of a breath, the swoop's blow landed, the dive's spot locked */
  emit: number; struck: boolean; locked: boolean;
  /** while it moves: the distance (u) and the bearing (rad) it keeps from the knight */
  md: number; ma: number;
}

/** A telegraph on the ground: a cone (breath), a ring (tail), a lane (bite, swoop) or a circle (dive). */
export interface Zone { id: number; kind: 'cone' | 'ring' | 'lane' | 'circle'; x: number; y: number; a: number; r0: number; r1: number; len: number; w: number; t: number; dur: number; live: boolean }
export interface Flame { id: number; x: number; y: number; vx: number; vy: number; r: number; life: number }
/** A fireball (from the mouth) or a drop (from the sky), landing at (x1, y1) when t reaches dur. */
export interface Ball { id: number; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; drop: boolean }
export interface Lance { id: number; x0: number; y0: number; t: number; dur: number }
export interface Horse { t: number; y: number; dir: 1 | -1; hit: boolean }

export interface Story { kind: 'open' | 'next' | 'driven'; t: number; dur: number; dragon: DragonKind; next: DragonKind | null; armoury: SkillId | null }

export type SimEvent =
  | { type: 'strike'; x: number; y: number; n: number; sword: boolean; flaw: boolean; spin: boolean }
  | { type: 'scales'; n: number; x: number; y: number; via: Via }
  | { type: 'quench'; x: number; y: number; big: boolean; squire: boolean }
  | { type: 'reflect'; x: number; y: number }
  | { type: 'burn'; what: Burn; x: number; y: number; heart: number }
  | { type: 'land'; x: number; y: number; drop: boolean }
  | { type: 'fizzle'; n: number }
  | { type: 'roll'; x: number; y: number; dx: number; dy: number }
  | { type: 'down' }
  | { type: 'up' }
  | { type: 'tele'; pattern: Pattern }
  | { type: 'attack'; pattern: Pattern; x: number; y: number }
  | { type: 'surface'; x: number; y: number }
  | { type: 'flaw'; tip: boolean; x: number; y: number }
  | { type: 'phase'; phase: number; x: number; y: number }
  | { type: 'arrive'; kind: DragonKind }
  | { type: 'driven'; kind: DragonKind }
  | { type: 'retreat' }
  | { type: 'nap' }
  | { type: 'wake' }
  | { type: 'swordReady' }
  | { type: 'level'; level: number; options: SkillId[] }
  | { type: 'skill'; id: SkillId; auto: boolean }
  | { type: 'lance' }
  | { type: 'horse'; y: number; dir: 1 | -1 }
  | { type: 'squire'; x: number; y: number }
  | { type: 'tip'; kind: DragonKind }
  | { type: 'restPass' }
  | { type: 'smoke'; share: number; charge: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'blockStart'; block: Block; index: number }
  /** the judged window's share on the asked side and the share it needed; the block's span of play time; the tip's fill */
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number; t0: number; t1: number; tip: number }
  | { type: 'finale' }
  | { type: 'done' };

const NO_EVENTS: readonly SimEvent[] = [];
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const TAU = Math.PI * 2;

// ── pure rules ───────────────────────────────────────────────────
/** No block under `min` s: lift the short ones and take the time from the others, keeping the total. */
function liftShort(durs: number[], min: number): void {
  const short = durs.reduce((s, d) => s + Math.max(0, min - d), 0);
  if (short <= 0) return;
  const spare = durs.reduce((s, d) => s + Math.max(0, d - min), 0);
  const k = spare > 0 ? Math.min(1, short / spare) : 0;
  for (let i = 0; i < durs.length; i++) durs[i] = durs[i] < min ? min : durs[i] - (durs[i] - min) * k;
}

/** The last clash's length: 16 s in sessions of 2 min and more, 8 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/**
 * The fight's blocks.  A first-ever session opens with the warm-up "Pierwsza próba" (30 s in 5 and
 * 10 min, 20 s in 3, 6 s in a 40 s test); then Tarcza / Postój pairs (24 ± 4 s and 22 ± 3 s, scaled
 * to end on time, jittered only when there is room) ending with a Postój, leaving the last clash's
 * seconds at the end.  No block under 12 s.
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

/** The shield's radius for a level (u): the band can only add; `base` is the buckler (with the skill). */
export const shieldFor = (level: number, base: number = RULES.shieldMin): number => base + clamp(level) * RULES.shieldExtra;
/** The radius at the threshold (level 0.5): the dotted ring. */
export const SHIELD_MARK = shieldFor(0.5);

/** Scales to the next level from `level` (0-based). */
export const levelNeed = (level: number): number => RULES.levelBase + RULES.levelStep * level;

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
const angleTo = (ax: number, ay: number, bx: number, by: number): number => Math.atan2(by - ay, bx - ax);
/** the shortest turn from a to b (rad) */
const turn = (a: number, b: number): number => ((((b - a) % TAU) + TAU * 1.5) % TAU) - Math.PI;

// ── the session ──────────────────────────────────────────────────
export interface SimInit {
  progress: JerzyProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  /** the session's focus tuning: the blocks' judges follow it */
  tuning: FocusTuning;
}

export interface Choice { options: SkillId[]; t: number }

export class JerzySim {
  readonly p: JerzyProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  /** the band's last 40 s, drawn as the pennants on the fence */
  readonly trace = new SignalTrace(40, 0.1);
  readonly talk: Talk;
  private readonly events: SimEvent[] = [];
  readonly eeg: boolean;
  private readonly lead: number;
  private readonly holdNeed: number;
  private readonly restLead: number;
  readonly finaleSec: number;

  started = false;
  readonly session: number;
  readonly plan: Block[];
  blockIndex = 0;
  blockT = 0;
  private telegraphed = false;
  phase: Phase = 'play';
  phaseT = 0;
  t = 0;
  tip = '';
  hint = false;
  private lastInput = 0;
  story: Story | null = null;

  // the arena
  readonly knight: Knight;
  dragon: Dragon;
  readonly zones: Zone[] = [];
  readonly flames: Flame[] = [];
  readonly balls: Ball[] = [];
  readonly lances: Lance[] = [];
  horse: Horse | null = null;
  private nextId = 1;
  private rollSide: 1 | -1 = 1;
  /** hit-stop (s left): the world holds its breath */
  stop = 0;
  /** world time this frame / real time (slow while a skill is chosen, 0 in a hit-stop) */
  timeScale = 1;
  private readonly held = new Set<string>();

  // the band
  reliable = false;
  level = 0;
  calm = 0;
  /** the shield's radius now (u) and how it looks; the Miecz światła's charge (0..1) and whether it is ready */
  shieldR: number = RULES.shieldMin;
  shieldLook: ShieldLook = 'buckler';
  charge = 0;
  swordReady = false;
  maxHold = 0;
  private goodT = 0;
  private goodSaid = false;
  private nearSaid = false;
  private quenchBlock = 0;
  private relSec = 0;

  // the Postój and Linda's tip
  tipFill = 0;
  tipActive = false;

  // the fight's levels and skills
  fightLevel = 0;
  xp = 0;
  choice: Choice | null = null;
  private pending = 0;
  readonly taken: Partial<Record<SkillId, number>> = {};
  readonly picked: SkillId[] = [];
  private lanceT = 0;
  private horseT = 0;
  private squireT = 0;

  // the session's numbers
  score = 0;
  swords = 0;
  quenched = 0;
  burns = 0;
  downs = 0;
  flawHits = 0;
  passedRests = 0;
  tipsGiven = 0;
  blindShare = -1;
  readonly drivenNow: DragonKind[] = [];
  retreated = false;
  private settled = false;
  private readonly pushesBase: number;
  private pushesBegun = 0;
  private readonly bestBefore: number | null;
  private readonly drivenBefore: number;

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
    this.bestBefore = bestFor(p, init.plannedSec);
    this.session = p.sessions + 1;
    this.pushesBase = p.pushes;
    this.drivenBefore = p.driven;
    this.plan = planBlocks(init.plannedSec, this.session === 1, init.rng);
    this.talk = new Talk(LINES, init.rng);
    const [kx, ky] = RULES.knightStart;
    this.knight = {
      x: kx, y: ky, tx: kx, ty: ky, walking: false, engage: false, face: -Math.PI / 2, swingT: 0, rollT: 0, rollVx: 0, rollVy: 0,
      rollCool: 0, safe: 0, heart: 1, down: 0, strikes: 0, hitT: 0,
    };
    for (const id of armouryOf(p.driven)) this.taken[id] = 1;
    this.dragon = this.makeDragon(p.dragon, p.damage);
  }

  get block(): Block { return this.plan[this.blockIndex]; }
  get next(): Block | null { return this.plan[this.blockIndex + 1] ?? null; }
  get blind(): boolean { return this.block?.kind === 'push' && this.block.blind && this.phase === 'play'; }
  get pushBlock(): boolean { return this.block?.kind === 'push' && this.phase === 'play'; }
  get restBlock(): boolean { return this.block?.kind === 'rest' && this.phase === 'play'; }
  get warmBlock(): boolean { return this.block?.kind === 'warmup' && this.phase === 'play'; }
  /** a sighted Tarcza past its lead-in: the shield answers the band */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  get leadIn(): number { return this.lead; }
  get restLeadIn(): number { return this.restLead; }
  get holdNeeded(): number { return this.holdNeed; }
  /** the buckler (with the skill), the strike's reach, the time between strikes, the roll's cooldown */
  get buckler(): number { return RULES.shieldMin + RULES.shieldUp * (this.taken.bigShield ?? 0); }
  get reach(): number { return RULES.reach + RULES.reachUp * (this.taken.reach ?? 0); }
  get swing(): number { return RULES.swing * RULES.swiftK ** (this.taken.swift ?? 0); }
  get rollCooldown(): number { return RULES.rollCool * (this.taken.armour ? RULES.armourCool ** this.taken.armour : 1); }
  get walkSpeed(): number { return RULES.walk * (1 + RULES.armourWalk * (this.taken.armour ?? 0)); }
  get levelProgress(): number { return clamp(this.xp / levelNeed(this.fightLevel)); }
  /** the shield's centre (u) */
  get shieldX(): number { return this.knight.x + Math.cos(this.knight.face) * RULES.shieldAhead; }
  get shieldY(): number { return this.knight.y + Math.sin(this.knight.face) * RULES.shieldAhead; }
  /** the dragon stands in the arena (not away, not in its cave, not flying off) */
  get present(): boolean { return !['away', 'arrive', 'toCave', 'nap', 'fromCave', 'leave'].includes(this.dragon.state); }
  /** a strike can land on it now */
  get hittable(): boolean {
    const d = this.dragon;
    return this.present && d.state !== 'roar' && !d.under && d.air < 0.3;
  }
  /** the gap between the knight's body and the dragon's (u) */
  get gap(): number {
    const k = this.knight, d = this.dragon;
    return dist(k.x, k.y, d.x, d.y) - RULES.knightR - d.spec.r;
  }
  /** Linda keeps quiet while the runner's banner or a telegraph is on screen, under the opening card and the choice */
  get talkBlocked(): boolean {
    if (this.story?.kind === 'open' || this.choice) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    if (b.kind !== 'warmup' && this.blockT < RULES.bannerSec) return true;
    return this.blockT >= b.dur - RULES.telegraph;
  }

  private makeDragon(idx: number, damage: number): Dragon {
    const { spec, circle } = dragonAt(idx);
    const phases = phasesOf(spec, circle);
    const dmg = clamp(damage, 0, hpOf(spec, circle) - 1);
    const at = phaseAt(phases, dmg);
    const [lx] = RULES.dragonLand;
    return {
      idx, spec, circle, x: lx, y: -3, face: Math.PI / 2, state: 'away', st: 0, dur: 0, pattern: null,
      phases, phase: at.phase, left: at.left, damage: dmg, air: 1, under: false, hitT: 0,
      tx: lx, ty: 0, fx: lx, fy: -3, ex: 0, ey: 0, emit: 0, struck: false, locked: false, md: 2, ma: 0,
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const d = this.dragon;
    if (this.session === 1) {
      this.story = { kind: 'open', t: 0, dur: RULES.openSec, dragon: d.spec.kind, next: null, armoury: null };
    } else {
      this.story = { kind: 'next', t: 0, dur: RULES.storySec, dragon: d.spec.kind, next: null, armoury: null };
      this.arrive();
      this.talk.ask('open', 2, 6);
    }
    this.startBlock(0);
  }

  // ── the hands ───────────────────────────────────────────────────
  /** A tap at a point of the arena (u): walk there, or go after the dragon when the tap is on it. */
  tap(x: number, y: number): void {
    if (!this.started || this.phase === 'done') return;
    this.lastInput = this.t;
    if (this.story?.kind === 'open') {
      this.closeStory();
      return;
    }
    const k = this.knight, d = this.dragon;
    if (k.down > 0) return;
    const onDragon = this.present && dist(x, y, d.x, d.y) <= d.spec.r + RULES.engageR;
    k.engage = onDragon;
    k.tx = clamp(x, RULES.knightR, RULES.arenaW - RULES.knightR);
    k.ty = clamp(y, RULES.knightR + 0.2, RULES.arenaH - RULES.knightR);
    k.walking = true;
  }

  /** A drag: the knight follows the finger. */
  steer(x: number, y: number): void {
    if (!this.started || this.phase === 'done' || this.story?.kind === 'open') return;
    this.lastInput = this.t;
    const k = this.knight;
    if (k.down > 0) return;
    k.engage = false;
    k.tx = clamp(x, RULES.knightR, RULES.arenaW - RULES.knightR);
    k.ty = clamp(y, RULES.knightR + 0.2, RULES.arenaH - RULES.knightR);
    k.walking = true;
  }

  /** A roll (a swipe or Space): along (dx, dy), or with no direction toward where he walks, else sideways from the dragon. */
  roll(dx = 0, dy = 0): boolean {
    if (!this.started || this.phase === 'done') return false;
    this.lastInput = this.t;
    if (this.story?.kind === 'open') {
      this.closeStory();
      return false;
    }
    const k = this.knight, R = RULES;
    if (k.down > 0 || k.rollT > 0 || k.rollCool > 0) return false;
    let len = Math.hypot(dx, dy);
    if (len < 1e-6 && k.walking && dist(k.x, k.y, k.tx, k.ty) > 0.3) {
      dx = k.tx - k.x;
      dy = k.ty - k.y;
      len = Math.hypot(dx, dy);
    }
    if (len < 1e-6) {
      // sideways from the dragon, the side with room in the arena
      const a = k.face + (this.rollSide * Math.PI) / 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
      const ex = k.x + dx * R.rollDist, ey = k.y + dy * R.rollDist;
      if (ex < R.knightR || ex > R.arenaW - R.knightR || ey < R.knightR || ey > R.arenaH - R.knightR) {
        dx = -dx;
        dy = -dy;
      }
      this.rollSide = -this.rollSide as 1 | -1;
      len = 1;
    }
    const v = R.rollDist / R.rollSec;
    k.rollVx = (dx / len) * v;
    k.rollVy = (dy / len) * v;
    k.rollT = R.rollSec;
    k.safe = Math.max(k.safe, R.rollSafe);
    k.rollCool = this.rollCooldown;
    k.walking = false;
    k.engage = false;
    this.emit({ type: 'roll', x: k.x, y: k.y, dx: dx / len, dy: dy / len });
    return true;
  }

  /** Choose a skill (0..2) while the choice is open. */
  pick(i: number, auto = false): boolean {
    const c = this.choice;
    if (!c || i < 0 || i >= c.options.length) return false;
    const id = c.options[i];
    this.choice = null;
    this.taken[id] = (this.taken[id] ?? 0) + 1;
    this.picked.push(id);
    if (id === 'apple') this.knight.heart = 1;
    this.emit({ type: 'skill', id, auto });
    if (this.pending > 0) {
      this.pending--;
      this.openChoice();
    }
    return true;
  }

  /** Arrows and WASD walk, Space and Shift roll, Enter goes after the dragon, 1–3 choose a skill. */
  key(key: string, down: boolean): boolean {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(k)) {
      if (down) this.held.add(k);
      else this.held.delete(k);
      if (down) this.lastInput = this.t;
      return true;
    }
    if (k === ' ' || k === 'Shift') {
      if (down && !this.held.has(k)) this.roll();
      if (down) this.held.add(k);
      else this.held.delete(k);
      return true;
    }
    if (k === 'Enter') {
      if (down) {
        if (this.story?.kind === 'open') this.closeStory();
        else if (this.present) this.tap(this.dragon.x, this.dragon.y);
      }
      return true;
    }
    if (k === '1' || k === '2' || k === '3') {
      if (down) this.pick(Number(k) - 1);
      return true;
    }
    return false;
  }

  /** Every held key lets go (the runner's pause). */
  release(): void { this.held.clear(); }

  private closeStory(): void {
    const s = this.story;
    if (!s) return;
    this.story = null;
    if (s.kind === 'open') {
      if (this.dragon.state === 'away' && !this.restBlock) this.arrive();
      this.talk.ask('open', 3, 6);
    } else if (s.kind === 'driven' && this.phase !== 'done') {
      this.story = { kind: 'next', t: 0, dur: RULES.storySec, dragon: dragonAt(this.dragon.idx + (this.dragon.state === 'leave' ? 1 : 0)).spec.kind, next: null, armoury: null };
    }
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.phaseT += dt;
    this.timeScale = this.stop > 0 ? 0 : this.choice ? RULES.choiceSlow : 1;
    this.stop = Math.max(0, this.stop - dt);
    const w = dt * this.timeScale;
    if (this.choice) {
      this.choice.t += dt;
      if (this.choice.t >= RULES.choiceSec) this.pick(0, true);
    }
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    }
    this.brain(dt, w, f);
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endFinale();
    this.moveKnight(w);
    this.dragonAI(w);
    this.fire(w);
    this.skills(w);
    this.hint = this.warmBlock && t - this.lastInput >= RULES.idleHint && !this.story;
    this.talk.update(dt, t, this.talkBlocked);
  }

  /**
   * The band's slow quantities: the shield in a sighted Tarcza past its lead-in, the Miecz from the
   * hold, the heart and Linda's tip from calm in a Postój past its lead-in; the trace.
   */
  private brain(dt: number, w: number, f: FocusFrame): void {
    const R = RULES, b = this.block;
    const play = this.phase === 'play';
    this.reliable = f.reliable;
    this.level = f.reliable ? f.level : 0;
    this.calm = f.reliable ? f.calm : 0;
    if (play && f.reliable) this.relSec += dt;
    const live = this.sighted && f.reliable;
    const want = live ? shieldFor(f.level, this.buckler) : this.buckler;
    this.shieldR = approach(this.shieldR, want, dt, R.shieldTau);
    this.shieldLook = !play || b.kind !== 'push' ? 'buckler' : b.blind ? 'smoke' : this.blockT < this.lead ? 'wait' : f.reliable ? 'live' : 'grey';
    const phase: TracePhase = !play ? 'free' : b.kind === 'push' ? 'focus' : b.kind === 'rest' ? 'rest' : 'free';
    this.trace.push(this.t, f, phase, this.blind);
    // the hold charges the Miecz światła
    if (live) this.maxHold = Math.max(this.maxHold, f.hold);
    if (live && f.hold >= this.holdNeed && !this.swordReady) this.addCharge(R.holdRate * w);
    // Linda cheers a shield that stays above the threshold
    if (live && f.level >= 0.5) this.goodT += dt;
    else this.goodT = 0;
    if (this.goodT >= R.goodSec && !this.goodSaid) {
      this.goodSaid = true;
      this.talk.ask('good', 2, 4);
    }
    // the Postój: calm brings the heart back and fills the tip
    if (play && b.kind === 'rest' && this.blockT >= this.restLead && f.reliable) {
      if (this.knight.down <= 0) this.knight.heart = Math.min(1, this.knight.heart + R.heal * f.calm * dt);
      this.tipFill = Math.min(1, this.tipFill + R.tipGain * f.calm * dt);
    }
  }

  private addCharge(v: number): void {
    if (this.swordReady || !(v > 0)) return;
    this.charge = Math.min(1, this.charge + v);
    if (this.charge >= 1 - 1e-9) {
      this.charge = 1;
      this.swordReady = true;
      this.emit({ type: 'swordReady' });
    }
  }

  // ── the blocks ──────────────────────────────────────────────────
  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block, R = RULES;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
    } else {
      // the warm-up teaches in thirds: walk, the red shapes, the roll
      const third = Math.min(2, Math.floor((this.blockT / Math.max(1, b.dur)) * 3));
      if (third > this.warmThird) {
        this.warmThird = third;
        this.talk.ask('warm', 1, 5);
      }
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

  private warmThird = 0;

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
      this.nearSaid = false;
      this.quenchBlock = 0;
      this.wake();
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
    } else if (b.kind === 'rest') {
      this.tipFill = 0;
      this.tipActive = false;
      this.toCave();
      this.talk.ask('rest', 2, 12);
    } else {
      this.warmThird = 0;
      this.talk.ask('warm', 1, 8);
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
    const b = this.block;
    let verdict: boolean | null = null, share = 0, need = 0;
    const tipNow = this.tipFill;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      share = this.judge.share;
      need = this.judge.need(want);
      verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
      if (b.kind === 'rest') {
        if (verdict) {
          this.passedRests++;
          if (this.knight.down <= 0) this.knight.heart = 1;
          this.emit({ type: 'restPass' });
        }
        if (verdict || this.tipFill >= 1) {
          this.tipActive = true;
          this.tipsGiven++;
          const kind = this.dragon.spec.kind;
          this.emit({ type: 'tip', kind });
          this.talk.ask(`tip.${kind}` as Moment, 5, 14);
        }
      }
      if (b.blind) {
        this.trace.unveil(this.t);
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        this.addCharge(s);
        this.emit({ type: 'smoke', share: s, charge: this.charge });
      }
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need, t0: this.t - this.blockT, t1: this.t, tip: tipNow });
  }

  // ── the knight ──────────────────────────────────────────────────
  private moveKnight(w: number): void {
    if (w <= 0) return;
    const k = this.knight, d = this.dragon, R = RULES;
    k.safe = Math.max(0, k.safe - w);
    k.rollCool = Math.max(0, k.rollCool - w);
    k.hitT = Math.max(0, k.hitT - w);
    k.swingT = Math.max(0, k.swingT - w);
    if (k.down > 0) {
      k.down -= w;
      if (k.down <= 0) {
        k.down = 0;
        k.heart = R.heartBack;
        this.emit({ type: 'up' });
      }
      return;
    }
    if (k.rollT > 0) {
      const s = Math.min(w, k.rollT);
      k.x += k.rollVx * s;
      k.y += k.rollVy * s;
      k.rollT -= w;
    } else {
      // the keys walk him a step ahead, every frame they are held
      let kx = 0, ky = 0;
      if (this.held.has('ArrowLeft') || this.held.has('a')) kx--;
      if (this.held.has('ArrowRight') || this.held.has('d')) kx++;
      if (this.held.has('ArrowUp') || this.held.has('w')) ky--;
      if (this.held.has('ArrowDown') || this.held.has('s')) ky++;
      if (kx || ky) {
        const l = Math.hypot(kx, ky);
        k.tx = k.x + (kx / l) * 0.6;
        k.ty = k.y + (ky / l) * 0.6;
        k.walking = true;
        k.engage = false;
      }
      if (k.engage && this.present) {
        // go after the dragon: a spot inside the reach on the line between them
        const a = angleTo(d.x, d.y, k.x, k.y), r = d.spec.r + R.knightR + this.reach * 0.55;
        k.tx = d.x + Math.cos(a) * r;
        k.ty = d.y + Math.sin(a) * r;
        k.walking = true;
      }
      if (k.walking) {
        const dd = dist(k.x, k.y, k.tx, k.ty), step = this.walkSpeed * w;
        if (dd <= step) {
          k.x = k.tx;
          k.y = k.ty;
          if (!k.engage) k.walking = false;
        } else {
          k.x += ((k.tx - k.x) / dd) * step;
          k.y += ((k.ty - k.y) / dd) * step;
        }
      }
    }
    k.x = clamp(k.x, R.knightR, R.arenaW - R.knightR);
    k.y = clamp(k.y, R.knightR + 0.2, R.arenaH - R.knightR);
    // he never walks into the dragon's body
    if (this.present && !d.under && d.air < 0.5) {
      const dd = dist(k.x, k.y, d.x, d.y), min = d.spec.r + R.knightR;
      if (dd < min && dd > 1e-6) {
        k.x = d.x + ((k.x - d.x) / dd) * min;
        k.y = d.y + ((k.y - d.y) / dd) * min;
      }
    }
    // he faces the dragon while it is in the arena, else where he walks
    const want = this.present || d.state === 'arrive' ? angleTo(k.x, k.y, d.x, d.y) : k.walking ? angleTo(k.x, k.y, k.tx, k.ty) : k.face;
    k.face += turn(k.face, want) * Math.min(1, w * 14);
    // and strikes by himself whenever it is in reach
    if (k.swingT <= 0 && k.rollT <= 0 && this.hittable && this.gap <= this.reach) this.strike();
  }

  /** A strike: a scale off, or the Miecz światła's great blow when it is ready. */
  private strike(): void {
    const k = this.knight, d = this.dragon, R = RULES;
    k.swingT = this.swing;
    const flaw = d.state === 'flaw' && this.tipActive;
    let n: number, spin = false;
    const sword = this.swordReady;
    if (sword) {
      n = Math.min(d.left, R.swordScales);
      this.swordReady = false;
      this.charge = 0;
      this.swords++;
      this.stop = Math.max(this.stop, R.stopSword);
      this.talk.ask('sword', 3, 3);
    } else {
      k.strikes++;
      const sp = this.taken.spin ? R.spinEvery[Math.min(R.spinEvery.length, this.taken.spin) - 1] : 0;
      spin = sp > 0 && k.strikes % sp === 0;
      n = (1 + (spin ? 1 : 0)) * (flaw ? 2 : 1);
      if (flaw) this.flawHits++;
      this.stop = Math.max(this.stop, R.stopHit);
    }
    const hx = (k.x + d.x) / 2, hy = (k.y + d.y) / 2;
    this.emit({ type: 'strike', x: hx, y: hy, n, sword, flaw, spin });
    this.knock(n, sword ? 'sword' : 'strike', hx, hy);
  }

  /** Scales off the dragon (no more than its phase has left): the headline, the XP, the phase, the fight. */
  private knock(n: number, via: Via, x: number, y: number): number {
    const d = this.dragon;
    if (!this.hittable || n <= 0) return 0;
    n = Math.min(n, d.left);
    if (n <= 0) return 0;
    d.left -= n;
    d.damage += n;
    d.hitT = 0.16;
    this.score += n;
    this.emit({ type: 'scales', n, x, y, via });
    this.gain(n);
    if (d.left <= 0) {
      if (d.phase < d.phases.length - 1) this.newPhase();
      else this.driveOff();
    }
    return n;
  }

  // ── the dragon ──────────────────────────────────────────────────
  private set(state: DState, dur = 0): void {
    const d = this.dragon;
    d.state = state;
    d.st = 0;
    d.dur = dur;
  }

  /** The dragon flies in from the hills. */
  private arrive(): void {
    const d = this.dragon;
    if (d.state !== 'away') return;
    const [lx, ly] = RULES.dragonLand;
    d.fx = lx;
    d.fy = -3;
    d.tx = lx;
    d.ty = ly;
    d.air = 1;
    this.set('arrive', RULES.arriveSec);
    this.emit({ type: 'arrive', kind: d.spec.kind });
    this.talk.ask('arrive', 1, 5);
  }

  /** The Postój: the dragon flies to its cave; the fire in the air goes out. */
  private toCave(): void {
    const d = this.dragon;
    this.clearFire();
    if (d.state === 'away' || d.state === 'leave' || d.state === 'nap' || d.state === 'toCave') return;
    d.under = false;
    d.fx = d.x;
    d.fy = d.y;
    this.set('toCave', RULES.flySec);
    this.emit({ type: 'nap' });
  }

  /** A Tarcza or the last clash: the dragon comes back from its nap (or arrives, between two dragons). */
  private wake(): void {
    const d = this.dragon;
    if (d.state === 'nap' || d.state === 'toCave') {
      const [lx, ly] = RULES.dragonLand;
      d.fx = d.x;
      d.fy = d.y;
      d.tx = lx;
      d.ty = ly;
      this.set('fromCave', RULES.flySec);
      this.emit({ type: 'wake' });
    } else if (d.state === 'away' && this.story?.kind !== 'open') {
      this.set('away', 0.2);
    }
  }

  /** counts the times the fire was cleared: a loop over the flames stops when a hit inside it cleared them */
  private fireGen = 0;

  private clearFire(): void {
    this.fireGen++;
    const n = this.flames.length + this.balls.length;
    this.flames.length = 0;
    this.balls.length = 0;
    this.zones.length = 0;
    if (n) this.emit({ type: 'fizzle', n });
  }

  /** How quick the dragon is now: its phase, its pace, the warm-up and the last clash. */
  private get quick(): number {
    const d = this.dragon;
    return RULES.teleFast ** d.phase / d.spec.pace * (this.warmBlock ? RULES.teleWarm : 1) * (this.phase === 'finale' ? 0.92 : 1);
  }

  private startMove(): void {
    const d = this.dragon, k = this.knight, R = RULES;
    // a spot near the knight (it follows him while it moves): the dragon comes to fight
    d.md = span(R.keep, this.rng());
    d.ma = angleTo(k.x, k.y, d.x, d.y) + (this.rng() - 0.5) * 1.6;
    this.moveTarget();
    this.set('move', span(R.moveSec, this.rng()) * Math.max(0.6, this.quick));
  }

  private moveTarget(): void {
    // its picture (the tail, the head) stays on the arena: more room at the sides than above and below
    const d = this.dragon, k = this.knight, R = RULES, mx = d.spec.r * 1.5, my = d.spec.r;
    d.tx = clamp(k.x + Math.cos(d.ma) * d.md, mx, R.arenaW - mx);
    d.ty = clamp(k.y + Math.sin(d.ma) * d.md, my, R.arenaH - my * 0.6);
  }

  /** The next attack, by the phase's weights; close blows only when the knight is close. */
  private choosePattern(): Pattern {
    const d = this.dragon, k = this.knight;
    const list = this.warmBlock ? WARM_PATTERNS : d.spec.patterns[Math.min(d.phase, d.spec.patterns.length - 1)];
    const dd = dist(k.x, k.y, d.x, d.y);
    const ok = list.filter(([p]) => (p === 'sweep' ? dd <= RULES.sweepOut + 0.6 : p === 'bite' ? dd <= d.spec.r + RULES.biteLen + 0.8 : p === 'breath' ? dd <= RULES.coneLen : true));
    const pool = ok.length ? ok : list;
    let r = this.rng() * pool.reduce((s, [, w]) => s + w, 0);
    for (const [p, w] of pool) if ((r -= w) <= 0) return p;
    return pool[0][0];
  }

  private zone(z: Omit<Zone, 'id' | 't' | 'live'>): Zone {
    const out: Zone = { ...z, id: this.nextId++, t: 0, live: false };
    this.zones.push(out);
    return out;
  }

  private mouth(): { x: number; y: number } {
    const d = this.dragon;
    return { x: d.x + Math.cos(d.face) * d.spec.r * 0.85, y: d.y + Math.sin(d.face) * d.spec.r * 0.85 };
  }

  /** The telegraph: the attack's shape in red on the ground, 0.8–1.2 s ahead (fireballs: their landing spots). */
  private telegraphAttack(p: Pattern): void {
    const d = this.dragon, k = this.knight, R = RULES;
    const dur = R.tele[p] * this.quick;
    d.pattern = p;
    d.face = angleTo(d.x, d.y, k.x, k.y);
    this.zones.length = 0;
    d.struck = false;
    d.locked = false;
    const m = this.mouth();
    if (p === 'breath') this.zone({ kind: 'cone', x: m.x, y: m.y, a: d.face, r0: 0, r1: R.coneHalf, len: R.coneLen, w: 0, dur });
    else if (p === 'sweep') this.zone({ kind: 'ring', x: d.x, y: d.y, a: 0, r0: R.sweepIn, r1: R.sweepOut, len: 0, w: 0, dur });
    else if (p === 'bite') this.zone({ kind: 'lane', x: d.x, y: d.y, a: d.face, r0: 0, r1: 0, len: d.spec.r + R.biteLen, w: R.biteW, dur });
    else if (p === 'balls' || p === 'rain') {
      const drop = p === 'rain';
      const n = d.spec.balls + d.phase + (drop ? 1 : 0) - (this.warmBlock ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = this.rng() * TAU, rr = i === 0 ? 0.2 * this.rng() : R.scatter * (drop ? 1.4 : 1) * Math.sqrt(this.rng());
        const x1 = clamp(k.x + Math.cos(a) * rr, 0.3, R.arenaW - 0.3), y1 = clamp(k.y + Math.sin(a) * rr, 0.3, R.arenaH - 0.3);
        const fl = R.ballFlight * Math.max(0.75, this.quick) + i * (drop ? 0.16 : 0.09);
        this.balls.push({ id: this.nextId++, x0: drop ? x1 : m.x, y0: drop ? y1 : m.y, x1, y1, t: 0, dur: fl, drop });
      }
    } else if (p === 'dive') {
      d.under = true;
    } else if (p === 'swoop') {
      const a = d.face;
      let len = dist(d.x, d.y, k.x, k.y) + 2.2;
      // the lane stops at the arena's edge
      for (let s = 0.5; s <= len; s += 0.25) {
        const x = d.x + Math.cos(a) * s, y = d.y + Math.sin(a) * s;
        if (x < 0.4 || x > R.arenaW - 0.4 || y < 0.4 || y > R.arenaH - 0.4) {
          len = s;
          break;
        }
      }
      d.ex = d.x + Math.cos(a) * len;
      d.ey = d.y + Math.sin(a) * len;
      this.zone({ kind: 'lane', x: d.x, y: d.y, a, r0: 0, r1: 0, len, w: R.swoopW, dur });
    }
    this.set('tele', dur);
    this.emit({ type: 'tele', pattern: p });
  }

  /** The attack lands (a blow is checked once, here; the breath and the dive go on in 'act'). */
  private attack(): void {
    const d = this.dragon, k = this.knight, R = RULES, p = d.pattern!;
    for (const z of this.zones) z.live = true;
    let dur = 0.3;
    if (p === 'breath') {
      dur = R.breathSec;
      d.emit = 0;
    } else if (p === 'sweep') {
      const dd = dist(k.x, k.y, d.x, d.y);
      if (dd >= R.sweepIn - R.knightR && dd <= R.sweepOut + R.knightR) this.burn('sweep');
      dur = 0.35;
    } else if (p === 'bite') {
      const ux = Math.cos(d.face), uy = Math.sin(d.face);
      const along = (k.x - d.x) * ux + (k.y - d.y) * uy, perp = Math.abs(-(k.x - d.x) * uy + (k.y - d.y) * ux);
      if (along >= 0 && along <= d.spec.r + R.biteLen + R.knightR && perp <= R.biteW / 2 + R.knightR) this.burn('bite');
      d.fx = d.x;
      d.fy = d.y;
      d.ex = d.x + ux * R.biteLen * 0.55;
      d.ey = d.y + uy * R.biteLen * 0.55;
      dur = 0.25;
    } else if (p === 'dive') {
      dur = R.diveSec;
    } else if (p === 'swoop') {
      d.fx = d.x;
      d.fy = d.y;
      dur = Math.max(0.2, dist(d.x, d.y, d.ex, d.ey) / R.swoopSpeed);
    }
    this.set('act', dur);
    const m = this.mouth();
    this.emit({ type: 'attack', pattern: p, x: p === 'breath' ? m.x : d.x, y: p === 'breath' ? m.y : d.y });
  }

  private endAttack(): void {
    const d = this.dragon, p = d.pattern;
    this.zones.length = 0;
    d.pattern = null;
    if (p && p === d.spec.flaw && !this.warmBlock) {
      this.set('flaw', RULES.flawSec);
      this.emit({ type: 'flaw', tip: this.tipActive, x: d.x, y: d.y });
      if (this.tipActive) this.talk.ask('flaw', 3, 1.6);
    } else this.startMove();
  }

  private dragonAI(w: number): void {
    if (w <= 0) return;
    const d = this.dragon, k = this.knight, R = RULES;
    d.st += w;
    d.hitT = Math.max(0, d.hitT - w);
    for (const z of this.zones) z.t += w;
    const done = d.st >= d.dur;
    const ease = (x: number) => x * x * (3 - 2 * x);
    switch (d.state) {
      case 'away':
        if (done && !this.restBlock && this.story?.kind !== 'open' && this.phase !== 'done' && !(this.phase === 'finale' && this.plannedSec - this.t < 3)) this.arrive();
        break;
      case 'arrive': {
        const q = ease(clamp(d.st / d.dur));
        d.x = d.fx + (d.tx - d.fx) * q;
        d.y = d.fy + (d.ty - d.fy) * q;
        d.air = 1 - q;
        d.face = Math.PI / 2;
        if (done) {
          d.air = 0;
          this.startMove();
        }
        break;
      }
      case 'move': {
        this.moveTarget();
        const dd = dist(d.x, d.y, d.tx, d.ty), step = R.moveSpeed * d.spec.pace * w;
        if (dd > step) {
          d.x += ((d.tx - d.x) / dd) * step;
          d.y += ((d.ty - d.y) / dd) * step;
        }
        d.face += turn(d.face, angleTo(d.x, d.y, k.x, k.y)) * Math.min(1, w * 5);
        if (done) {
          if (k.down > 0 || this.restBlock) this.startMove();
          else this.telegraphAttack(this.choosePattern());
        }
        break;
      }
      case 'tele':
        if (d.pattern === 'swoop') d.air = clamp(d.st / d.dur) * 0.6;
        if (done) this.attack();
        break;
      case 'act':
        this.act(w);
        break;
      case 'flaw':
      case 'roar':
        if (done) this.startMove();
        break;
      case 'breather': {
        // it backs off from the knight while he gets up
        const a = angleTo(k.x, k.y, d.x, d.y), m = d.spec.r * 0.8;
        const tx = clamp(k.x + Math.cos(a) * 4.2, m, R.arenaW - m), ty = clamp(k.y + Math.sin(a) * 4.2, m, R.arenaH - m);
        const dd = dist(d.x, d.y, tx, ty), step = R.moveSpeed * w;
        if (dd > step) {
          d.x += ((tx - d.x) / dd) * step;
          d.y += ((ty - d.y) / dd) * step;
        }
        d.face += turn(d.face, angleTo(d.x, d.y, k.x, k.y)) * Math.min(1, w * 4);
        if (done) this.startMove();
        break;
      }
      case 'toCave': {
        const q = ease(clamp(d.st / d.dur)), [cx, cy] = R.cave;
        d.x = d.fx + (cx - d.fx) * q;
        d.y = d.fy + (cy - d.fy) * q;
        d.air = Math.sin(Math.PI * q) * 0.8;
        d.face = angleTo(d.fx, d.fy, cx, cy);
        if (done) {
          d.air = 0;
          this.set('nap');
        }
        break;
      }
      case 'nap':
        break;
      case 'fromCave': {
        const q = ease(clamp(d.st / d.dur));
        d.x = d.fx + (d.tx - d.fx) * q;
        d.y = d.fy + (d.ty - d.fy) * q;
        d.air = Math.sin(Math.PI * q) * 0.8;
        d.face = angleTo(d.x, d.y, k.x, k.y);
        if (done) {
          d.air = 0;
          this.startMove();
        }
        break;
      }
      case 'leave': {
        const q = clamp(d.st / d.dur);
        d.x = d.fx + (R.arenaW + 4 - d.fx) * q * q;
        d.y = d.fy + (-5 - d.fy) * q;
        d.air = Math.min(1, q * 2);
        d.face = angleTo(d.fx, d.fy, R.arenaW + 4, -5);
        if (done) this.afterLeave();
        break;
      }
    }
  }

  private act(w: number): void {
    const d = this.dragon, k = this.knight, R = RULES, p = d.pattern;
    const done = d.st >= d.dur;
    if (p === 'breath') {
      d.emit += R.blobRate * w;
      const m = this.mouth();
      while (d.emit >= 1 && !done) {
        d.emit -= 1;
        const a = d.face + (this.rng() * 2 - 1) * R.coneHalf, v = R.blobSpeed * (0.9 + 0.2 * this.rng());
        this.flames.push({ id: this.nextId++, x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: R.blobR, life: R.coneLen / v });
      }
    } else if (p === 'bite') {
      const q = clamp(d.st / d.dur);
      const s = q < 0.5 ? q * 2 : 2 - q * 2;
      d.x = d.fx + (d.ex - d.fx) * s;
      d.y = d.fy + (d.ey - d.fy) * s;
    } else if (p === 'dive') {
      const lockAt = d.dur - 0.9;
      if (d.st < lockAt) {
        // under the marsh it follows the knight
        const dd = dist(d.x, d.y, k.x, k.y), step = 3.6 * w;
        if (dd > step) {
          d.x += ((k.x - d.x) / dd) * step;
          d.y += ((k.y - d.y) / dd) * step;
        }
      } else if (!d.locked) {
        d.locked = true;
        this.zone({ kind: 'circle', x: d.x, y: d.y, a: 0, r0: 0, r1: R.diveR, len: 0, w: 0, dur: 0.9 });
      }
      if (done) {
        d.under = false;
        if (dist(k.x, k.y, d.x, d.y) <= R.diveR + R.knightR) this.burn('dive');
        this.emit({ type: 'surface', x: d.x, y: d.y });
      }
    } else if (p === 'swoop') {
      const q = clamp(d.st / d.dur);
      d.x = d.fx + (d.ex - d.fx) * q;
      d.y = d.fy + (d.ey - d.fy) * q;
      d.air = 0.6 + 0.4 * Math.sin(Math.PI * q);
      if (!d.struck && dist(k.x, k.y, d.x, d.y) <= R.swoopW / 2 + R.knightR) {
        d.struck = true;
        this.burn('swoop');
      }
      if (done) d.air = 0;
    }
    if (done) this.endAttack();
  }

  /** A new phase: the dragon roars (pushing the knight back) and grows quicker. */
  private newPhase(): void {
    const d = this.dragon, k = this.knight, R = RULES;
    d.phase++;
    d.left = d.phases[d.phase];
    d.under = false;
    d.air = 0;
    d.pattern = null;
    this.zones.length = 0;
    this.set('roar', R.roarSec);
    const a = angleTo(d.x, d.y, k.x, k.y);
    if (k.down <= 0) {
      k.rollVx = Math.cos(a) * (R.roarPush / R.rollSec);
      k.rollVy = Math.sin(a) * (R.roarPush / R.rollSec);
      k.rollT = R.rollSec;
      k.walking = false;
    }
    this.stop = Math.max(this.stop, R.stopPhase);
    this.emit({ type: 'phase', phase: d.phase, x: d.x, y: d.y });
    this.talk.ask('phase', 3, 3);
  }

  /** The last phase broken: the dragon flies off over the hills, the town celebrates, the next one is on the map. */
  private driveOff(): void {
    const d = this.dragon, R = RULES;
    const kind = d.spec.kind;
    this.drivenNow.push(kind);
    this.clearFire();
    d.under = false;
    d.pattern = null;
    d.fx = d.x;
    d.fy = d.y;
    this.set('leave', 2.4);
    this.stop = Math.max(this.stop, R.stopDriven);
    const nextKind = dragonAt(d.idx + 1).spec.kind;
    this.story = { kind: 'driven', t: 0, dur: R.storySec + 0.8, dragon: kind, next: nextKind, armoury: nextArmoury(this.drivenBefore + this.drivenNow.length - 1) };
    this.emit({ type: 'driven', kind });
    this.talk.ask('driven', 4, 6);
  }

  private afterLeave(): void {
    const idx = this.dragon.idx + 1;
    this.dragon = this.makeDragon(idx, 0);
    if (this.phase === 'finale') {
      this.endFinale();
      return;
    }
    // it comes while the town's card gives way to the next one's
    this.dragon.dur = Math.max(0.6, this.story?.kind === 'driven' ? this.story.dur - this.story.t : 0);
  }

  /** A blow or a flame got through: heart lost, a moment of safety; at no heart the knight is knocked down. */
  private burn(what: Burn): void {
    const k = this.knight, d = this.dragon, R = RULES;
    if (k.safe > 0 || k.down > 0) return;
    k.heart = Math.max(0, k.heart - R.hurt[what]);
    k.safe = what === 'blob' ? R.safeBlob : R.safeBlow;
    k.hitT = 0.3;
    this.burns++;
    if (what !== 'blob' && what !== 'ball') {
      // a blow throws him back from the dragon and staggers him: no strike for a moment
      k.swingT = Math.max(k.swingT, 0.5);
      const a = angleTo(d.x, d.y, k.x, k.y);
      k.rollVx = Math.cos(a) * (1.2 / R.rollSec);
      k.rollVy = Math.sin(a) * (1.2 / R.rollSec);
      k.rollT = R.rollSec;
      k.walking = false;
    }
    this.emit({ type: 'burn', what, x: k.x, y: k.y, heart: k.heart });
    if ((what === 'blob' || what === 'ball') && this.pushBlock && this.shieldR < SHIELD_MARK && !this.nearSaid) {
      this.nearSaid = true;
      this.talk.ask('near', 1, 3);
    }
    if (k.heart <= 1e-6) this.knockDown();
  }

  /** No heart: down for a moment, Linda's apple, up with half a heart; the dragon backs off. */
  private knockDown(): void {
    const k = this.knight, d = this.dragon, R = RULES;
    k.down = R.downSec;
    k.safe = R.downSec + 0.6;
    k.heart = 0;
    k.rollT = 0;
    k.walking = false;
    k.engage = false;
    this.downs++;
    this.emit({ type: 'down' });
    this.talk.ask('down', 4, 2.5);
    if (this.present && d.state !== 'roar') {
      d.under = false;
      d.air = 0;
      d.pattern = null;
      this.zones.length = 0;
      this.set('breather', R.downSec + R.breather);
    }
  }

  // ── fire and the shield ─────────────────────────────────────────
  private fire(w: number): void {
    if (w <= 0) return;
    const k = this.knight, R = RULES;
    const shield = k.down <= 0;
    const sx = this.shieldX, sy = this.shieldY, sr = this.shieldR, gen = this.fireGen;
    let n = 0;
    for (const f of this.flames) {
      f.x += f.vx * w;
      f.y += f.vy * w;
      f.life -= w;
      if (shield && dist(f.x, f.y, sx, sy) <= sr + f.r) {
        this.quench(f.x, f.y, false, false);
        if (this.fireGen !== gen) return;
        continue;
      }
      if (dist(f.x, f.y, k.x, k.y) <= R.knightR + f.r && k.safe <= 0 && k.down <= 0) {
        this.burn('blob');
        if (this.fireGen !== gen) return;
        continue;
      }
      if (f.life <= 0 || f.x < -1 || f.x > R.arenaW + 1 || f.y < -1 || f.y > R.arenaH + 1) continue;
      this.flames[n++] = f;
    }
    this.flames.length = n;
    n = 0;
    for (const b of this.balls) {
      b.t += w;
      if (b.t < b.dur) {
        this.balls[n++] = b;
        continue;
      }
      if (shield && dist(b.x1, b.y1, sx, sy) <= sr + 0.2) this.quench(b.x1, b.y1, true, false);
      else {
        this.emit({ type: 'land', x: b.x1, y: b.y1, drop: b.drop });
        if (dist(b.x1, b.y1, k.x, k.y) <= R.splashR + R.knightR) this.burn('ball');
      }
      if (this.fireGen !== gen) return;
    }
    this.balls.length = n;
  }

  /** A flame put out (by the shield, or by the squire's bucket): it charges the Miecz; Odbicie sends a spark back. */
  private quench(x: number, y: number, big: boolean, squire: boolean): void {
    const R = RULES;
    this.quenched++;
    this.quenchBlock++;
    this.addCharge(big ? R.quenchBall : R.quenchBlob);
    this.emit({ type: 'quench', x, y, big, squire });
    if (this.pushBlock && this.quenchBlock % 14 === 0) this.talk.ask('quench', 1, 3);
    const lv = this.taken.reflect ?? 0;
    if (lv > 0 && this.hittable && (big || this.rng() < R.reflectChance * lv)) {
      this.emit({ type: 'reflect', x, y });
      this.knock(1, 'reflect', this.dragon.x, this.dragon.y);
    }
  }

  // ── the skills that act by themselves ───────────────────────────
  private skills(w: number): void {
    if (w <= 0 || this.phase === 'done') return;
    const R = RULES, k = this.knight, d = this.dragon;
    const fighting = this.hittable && k.down <= 0;
    // Kopia: a lance thrown at the dragon every few seconds
    const lv = this.taken.lance ?? 0;
    if (lv > 0) {
      this.lanceT += w;
      if (fighting && this.lanceT >= R.lanceEvery[Math.min(lv, 3) - 1] && dist(k.x, k.y, d.x, d.y) <= R.lanceRange) {
        this.lanceT = 0;
        this.lances.push({ id: this.nextId++, x0: k.x, y0: k.y, t: 0, dur: Math.max(0.15, dist(k.x, k.y, d.x, d.y) / 14) });
        this.emit({ type: 'lance' });
      }
    }
    let n = 0;
    for (const l of this.lances) {
      l.t += w;
      if (l.t < l.dur) {
        this.lances[n++] = l;
        continue;
      }
      this.knock(R.lanceScales, 'lance', d.x, d.y);
    }
    this.lances.length = n;
    // Biały koń: a charge across the arena through the dragon
    const hv = this.taken.horse ?? 0;
    if (hv > 0) {
      if (!this.horse) this.horseT += w;
      if (fighting && !this.horse && this.horseT >= R.horseEvery[Math.min(hv, 2) - 1]) {
        this.horseT = 0;
        const dir: 1 | -1 = d.x < R.arenaW / 2 ? 1 : -1;
        this.horse = { t: 0, y: d.y, dir, hit: false };
        this.emit({ type: 'horse', y: d.y, dir });
      }
    }
    if (this.horse) {
      const h = this.horse;
      h.t += w;
      if (!h.hit && h.t >= R.horseSec * 0.5) {
        h.hit = true;
        this.knock(R.horseScales, 'horse', d.x, d.y);
      }
      if (h.t >= R.horseSec) this.horse = null;
    }
    // Giermek: a bucket of water on the nearest fire
    const sq = this.taken.squire ?? 0;
    if (sq > 0) {
      this.squireT = Math.min(this.squireT + w, 99);
      if (this.squireT >= R.squireEvery[Math.min(sq, 2) - 1]) {
        let best = -1, bd: number = R.squireRange, ball = false;
        this.flames.forEach((f, i) => {
          const dd = dist(f.x, f.y, k.x, k.y);
          if (dd < bd) { bd = dd; best = i; ball = false; }
        });
        this.balls.forEach((b, i) => {
          const dd = dist(b.x1, b.y1, k.x, k.y);
          if (dd < bd && b.t > b.dur * 0.4) { bd = dd; best = i; ball = true; }
        });
        if (best >= 0) {
          this.squireT = 0;
          const x = ball ? this.balls[best].x1 : this.flames[best].x, y = ball ? this.balls[best].y1 : this.flames[best].y;
          if (ball) this.balls.splice(best, 1);
          else this.flames.splice(best, 1);
          // (the quench may drive the dragon off, which clears the rest of the fire: nothing below reads it)
          this.emit({ type: 'squire', x, y });
          this.quench(x, y, ball, true);
        }
      }
    }
  }

  // ── levels and skills ───────────────────────────────────────────
  private gain(n: number): void {
    if (!(n > 0)) return;
    this.xp += n;
    while (this.xp >= levelNeed(this.fightLevel)) {
      this.xp -= levelNeed(this.fightLevel);
      this.fightLevel++;
      if (this.choice) this.pending++;
      else this.openChoice();
    }
  }

  /** Three different skills not yet at their limit; Linda's apple fills in. */
  skillOptions(): SkillId[] {
    const pool = SKILLS.filter(s => s.id !== 'apple' && (this.taken[s.id] ?? 0) < s.max).map(s => s.id);
    const out: SkillId[] = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    while (out.length < 3) out.push('apple');
    return out;
  }

  private openChoice(): void {
    if (this.phase === 'done') return;
    const options = this.skillOptions();
    this.choice = { options, t: 0 };
    this.emit({ type: 'level', level: this.fightLevel, options });
    this.talk.ask('level', 1, 3);
  }

  // ── the last clash ──────────────────────────────────────────────
  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.phaseT = 0;
    this.tipActive = false;
    this.wake();
    this.emit({ type: 'finale' });
  }

  /** Time is up (or the dragon flew off in the last clash): it flies to its cave and keeps its damage. */
  private endFinale(): void {
    if (this.phase === 'done') return;
    const d = this.dragon;
    if (this.present || d.state === 'arrive' || d.state === 'fromCave') {
      this.retreated = true;
      this.clearFire();
      d.under = false;
      d.fx = d.x;
      d.fy = d.y;
      this.set('toCave', RULES.flySec);
      this.emit({ type: 'retreat' });
    }
    this.choice = null;
    this.pending = 0;
    this.phase = 'done';
    this.phaseT = 0;
    this.talk.clear();
    this.talk.ask('end', 5, 8);
    this.emit({ type: 'done' });
    this.settle();
  }

  // ── the meta ────────────────────────────────────────────────────
  /** The fight is settled once — at its end, or when it ends early: the map and the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p, d = this.dragon;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
    p.total += this.score;
    // a dragon still flying off when the session ends is gone all the same: the next one waits on the map
    const gone = d.left <= 0 && d.phase >= d.phases.length - 1;
    p.dragon = gone ? d.idx + 1 : d.idx;
    p.damage = gone ? 0 : d.damage;
    p.driven += this.drivenNow.length;
    p.swords += this.swords;
    p.quenched += this.quenched;
    p.lastLen = this.plannedSec;
  }

  /** The session ends before its own end: settle as the end would. */
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

  /** The pad follows the shield in a sighted Tarcza, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp((this.shieldR - this.buckler) / RULES.shieldExtra);
    return null;
  }

  canStop(): boolean {
    return this.phase === 'done' || this.t >= this.plannedSec + RULES.settle;
  }

  /** The dragon's scales still on it, of all (for the HUD and the summary). */
  get dragonLeft(): { left: number; all: number } {
    const d = this.dragon, all = hpOf(d.spec, d.circle);
    return { left: all - d.damage, all };
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress once, when settled. */
  result(): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      const key = lenKey(this.plannedSec);
      p.best[key] = Math.max(p.best[key] ?? 0, this.score);
      p.bestLevel = Math.max(p.bestLevel, this.fightLevel);
    }
    const c = this.contrast.contrast === null ? null : Math.round(this.contrast.contrast * 10) / 10;
    const dl = this.dragonLeft;
    const stats: [string, string][] = [
      [t('stat.level'), String(this.fightLevel + 1)],
      [t('stat.quenched'), fmtNum(this.quenched)],
      [t('stat.swords'), String(this.swords)],
      [t('stat.driven'), this.drivenNow.length ? this.drivenNow.map(dragonName).join(', ') : '—'],
      [t('stat.dragon', { name: cap(dragonName(this.dragon.spec.kind)) }), t('stat.dragonLeft', { left: fmtNum(dl.left), all: fmtNum(dl.all) })],
      [t('stat.contrast'), c === null ? '—' : t('pct', { n: `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmtNum(Math.abs(c), 1)}` })],
    ];
    return {
      score: this.score, unit: unit(this.score), record: this.bestBefore !== null && this.score > this.bestBefore,
      stats, highlights: this.highlights(), verse: this.closingVerse(),
    };
  }

  /**
   * The summary's closing passage, one the fight fits, in turn from session to session: the first
   * fight, a dragon driven off, a Miecz światła, many flames put out, a long fight, a passed Postój;
   * else Ephesians 6:16.
   */
  closingVerse(): PassageId {
    const fit: PassageId[] = [];
    if (this.session === 1) fit.push('jos1.9');
    if (this.drivenNow.length) fit.push('psa91.13');
    if (this.swords > 0) fit.push('eph6.17');
    if (this.quenched >= RULES.manyQuench) fit.push('eph6.16');
    if (this.plannedSec >= 300 || this.maxHold >= RULES.longHold) fit.push('2ti4.7');
    if (this.passedRests > 0) fit.push('1co16.13');
    fit.push('eph6.16');
    return inTurn(fit, this.session || 1);
  }

  private highlights(): string[] {
    const notes: { rank: number; text: string }[] = [];
    const add = (rank: number, text: string) => notes.push({ rank, text });
    const d = this.dragon;
    // Linda's closing line: the story's end of this session
    if (this.drivenNow.length) add(0, t('hl.close.driven', { town: townName(this.drivenNow[this.drivenNow.length - 1]) }));
    else if (this.started) add(0, t('hl.close.fight', { dragon: cap(dragonName(d.spec.kind)), pct: Math.round((d.damage / Math.max(1, hpOf(d.spec, d.circle))) * 100) }));
    for (const k of this.drivenNow) add(1, t('hl.driven', { name: cap(dragonName(k)) }));
    const arm = this.drivenNow.length ? nextArmoury(this.drivenBefore) : null;
    if (arm) add(2, t('hl.armoury', { name: skillById(arm).name }));
    if (this.bestBefore !== null && this.score > this.bestBefore) add(3, t('hl.record', { scales: scalesText(this.score) }));
    if (this.swords) add(4, t('hl.swords', { n: this.swords }));
    if (this.quenched >= 10) add(5, t('hl.quenched', { n: this.quenched }));
    if (this.picked.length) add(6, t('hl.skills', { list: [...new Set(this.picked)].map(id => skillById(id).name).join(', ') }));
    if (this.tipsGiven) add(7, t('hl.tips', { n: this.tipsGiven }));
    if (this.blindShare >= 0) add(8, t('hl.blind', { n: this.blindShare }));
    return notes.sort((a, b) => a.rank - b.rank).slice(0, 5).map(n => n.text);
  }
}
