/**
 * Rozświetl's session, without the canvas (DESIGN §13.7).  A dark picture lies on Voronoi tiles
 * (kit/mosaic.ts) over the same place in the light:
 *
 *   the light     presses on the aimed tile from behind — always a little (grace: the base comes from
 *                 showing up), much more with focus in a sighted push block (×1 … ×3), and with focus
 *                 its halo widens and spills onto the neighbours; a tap knocks (a crack at once)
 *   a burst       a tile at full pressure bursts into shards (the headline) and passes light to its dark
 *                 neighbours; one that fills from it bursts a moment later — a chain
 *   the flare     held focus fills it; released by a tap (or by itself), a wave of light presses every
 *                 tile around the point, and its bursts count double
 *   gazing        in a rest block calm warms the uncovered pieces and lays gold in their seams (it flows
 *                 tile to tile); a dark tile touching gold cracks faster in the next push
 *   by feel       a blind push shows the base light only; its hidden light is released at its end
 *   pictures      the last tiles go in a chain, the bright scene blooms, its card and verse; the next one
 *
 * Blocks as in every arcade game: a first-ever session's warm-up, push and rest blocks of 20–30 s with a
 * 4 s telegraph, each judged once at its end over its last 15 s, every 4th push blind from the 3rd session.
 * Pure: no DOM; the game reads the state and the event queue (`take()`).
 */
import { BlockContrast, RoundJudge, type FocusFrame, type FocusTuning } from '../kit/focus';
import { clamp } from '../kit/juice';
import { cellAt, makeMosaic, type Mosaic, type Pt } from '../kit/mosaic';
import type { PassageId } from '../kit/scripture';
import type { ArcadeOutcome } from '../kit/types';
import {
  GOLD_VERSE, LINE_COUNT, PLAIN_CLOSINGS, ROOT, OWN_VERSES, lineKey, pairTitle, pairVerse, revealKey, taskFor, type Moment,
} from './content';
import { pct, t, unit } from './i18n';
import { albumCount, choosePicture, dayPair, recordPicture, sameSrc, srcKey, tilesFor, type PicSrc, type RozProgress } from './meta';
import { RULES } from './rules';
import { Talk } from './talk';

export type BlockKind = 'warmup' | 'push' | 'rest';
export interface Block { kind: BlockKind; dur: number; blind: boolean }
export type Phase = 'play' | 'finale' | 'done';

export interface Tile {
  /** light pressure, in shares of its need (1 bursts) */
  press: number;
  /** its need: bigger tiles need more */
  need: number;
  open: boolean;
  /** when it burst (seconds of play), −1 while dark */
  openAt: number;
  /** the chain link it burst as (0: by itself) */
  depth: number;
  /** warmth of the uncovered piece, 0..1 */
  warm: number;
  /** where its cracks start (mosaic units), set by the first light or knock on it */
  from: Pt | null;
  /** a knock's glow (1 at the knock, fading) */
  knock: number;
  /** a chain link waiting: the time it bursts (−1: none) and its depth */
  pend: number;
  pendDepth: number;
  pendDouble: boolean;
}

/** An edge of the mosaic and the gold in it (`b` = −1: the frame). */
export interface Seam { a: number; b: number; p: Pt; q: Pt; gold: number }

export type PicState = 'assemble' | 'play' | 'finishing' | 'bloom';

export interface Picture {
  src: PicSrc;
  /** the picture's place in the session (0 = the first) */
  index: number;
  mosaic: Mosaic;
  tiles: Tile[];
  seams: Seam[];
  /** each tile's seams */
  seamsOf: number[][];
  /** the mean tile's radius (mosaic units) and a burst's shard scale */
  meanR: number;
  /** seconds of base light a mean tile takes */
  perTile: number;
  state: PicState;
  stateT: number;
  open: number;
  /** the tiles gold flows from (the first uncovered, and those the player touched in a rest) */
  goldSrc: Set<number>;
  saidCrack: boolean;
  saidBurst: boolean;
  saidNear: boolean;
  day: boolean;
  /** bumped when the mosaic is rebuilt for a new frame (a phone turned): the view starts over */
  ver: number;
}

export type Coach = 'aim' | 'knock' | 'halo' | 'chain' | 'rest' | 'gold' | 'flare' | 'drag' | 'blind';
export type CoachAt = { kind: 'tile'; cell: number } | { kind: 'aim' } | null;

export interface Story {
  kind: 'open' | 'done';
  t: number;
  dur: number;
  src: PicSrc | null;
  verse: PassageId;
  /** the share of the picture's seams in gold (0..100) */
  gold: number;
  /** first time in the album */
  fresh: boolean;
}

export type SimEvent =
  | { type: 'blockStart'; block: Block; index: number }
  | { type: 'blockEnd'; block: Block; verdict: boolean | null; share: number; need: number }
  | { type: 'telegraph'; next: Block | null }
  | { type: 'picture'; src: PicSrc; tiles: number; day: boolean }
  | { type: 'aim'; cell: number; by: 'tap' | 'drag' | 'auto' }
  | { type: 'knock'; cell: number; x: number; y: number; power: number }
  | { type: 'crack'; cell: number }
  | { type: 'burst'; cell: number; shards: number; depth: number; double: boolean }
  | { type: 'chain'; n: number }
  | { type: 'flareReady' }
  | { type: 'flare'; x: number; y: number }
  | { type: 'gold'; seam: number }
  | { type: 'gild'; cell: number }
  | { type: 'reserve'; amount: number }
  | { type: 'finishing' }
  | { type: 'done'; src: PicSrc; gold: number; fresh: boolean }
  | { type: 'reveal'; share: number }
  | { type: 'coach'; what: Coach; at: CoachAt }
  | { type: 'story'; kind: Story['kind'] }
  | { type: 'storyEnd' }
  | { type: 'finale' }
  | { type: 'refit' }
  | { type: 'end' };

const NO_EVENTS: readonly SimEvent[] = [];

/** The last stretch without a block: 12 s in sessions of 2 min and more, 6 s in shorter ones. */
export const finaleFor = (plannedSec: number): number => (plannedSec >= 120 ? RULES.finale.long : RULES.finale.short);

/** Lift blocks under `min` by taking the time from the longest ones (the sum stays). */
function liftShort(durs: number[], min: number): void {
  for (let guard = 0; guard < 20; guard++) {
    const i = durs.findIndex(d => d < min - 1e-9);
    if (i < 0) return;
    const need = min - durs[i];
    const j = durs.reduce((b, d, k) => (d > durs[b] ? k : b), 0);
    if (durs[j] - need < min) return;
    durs[i] += need;
    durs[j] -= need;
  }
}

/**
 * The session's blocks.  A first-ever session opens with the warm-up (30 s in 5 and 10 min, 20 s in
 * 3, 6 s in a 40 s test); then light / gazing pairs (26 ± 4 s and 22 ± 3 s, scaled to end on time,
 * jittered only when there is room) ending with a gazing block, leaving the finale at the end.
 */
export function planBlocks(plannedSec: number, firstEver: boolean, rnd: () => number): Block[] {
  const R = RULES;
  const fin = finaleFor(plannedSec);
  const b = (kind: BlockKind, dur: number): Block => ({ kind, dur, blind: false });
  if (plannedSec <= 60) {
    const left = Math.max(2 * 5, plannedSec - fin);
    if (firstEver) {
      const warm = R.warm.test, rest = Math.max(10, left - warm);
      return [b('warmup', warm), b('push', rest / 2), b('rest', rest / 2)];
    }
    const rest = Math.max(5, Math.min(14, left / 2));
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

export interface SimInit {
  progress: RozProgress;
  rng: () => number;
  day: string;
  daySeed: number;
  plannedSec: number;
  eeg: boolean;
  tuning: FocusTuning;
  /** the frame's aspect (w / h) for the next picture */
  aspect: number;
  /** own pairs whose pictures are ready (loaded) */
  ownReady?: () => readonly string[];
  /** a density for a picture's tiles (denser where it has detail); nothing: even tiles */
  weight?: (src: PicSrc, w: number, h: number) => ((x: number, y: number) => number) | undefined;
}

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

export class RozSim {
  readonly p: RozProgress;
  readonly plannedSec: number;
  private readonly rng: () => number;
  private readonly judge: RoundJudge;
  readonly contrast = new BlockContrast(4);
  private readonly lead: number;
  private readonly restLead: number;
  private readonly init: SimInit;
  readonly talk: Talk;
  /** the session number (1 = the first ever) and the sessions saved before it */
  readonly session: number;
  private readonly sessionsBefore: number;
  private readonly pushesBase: number;
  private readonly bestBefore: number;
  private pushesBegun = 0;

  started = false;
  phase: Phase = 'play';
  t = 0;
  plan: Block[] = [];
  blockIndex = 0;
  blockT = 0;
  telegraphed = false;
  private relSec = 0;
  private settled = false;
  private endSaid = false;

  /** the frame's aspect for the next picture (the game keeps it current) */
  aspect: number;
  pic!: Picture;
  /** pictures begun in this session */
  private picCount = 0;
  private prevSrc: PicSrc | null = null;
  story: Story | null = null;
  /** the runner's coach mark is on screen (the game says so): the firefly waits, one bubble at a time */
  coachUp = false;
  /** a picture's card waiting for the bloom's first moment */
  private card: Story | null = null;

  // the light
  aim = 0;
  aimBy: 'tap' | 'drag' | 'auto' = 'auto';
  private aimT = 0;
  /** the band's light (0..1, 0.5 at the threshold), eased; frozen while the signal is unreliable */
  light = 0;
  /** whether the band's light acts now (a sighted push past its lead-in, a reliable signal) */
  lightOn = false;
  /** the calm the gauge shows in a rest block */
  calmShown = 0;
  reliable = false;
  private lastKnock = -10;
  flare = 0;
  flareReady = false;
  private flareReadyT = 0;
  flareAt: { x: number; y: number; t: number } | null = null;
  private reserve = 0;
  private blindBank = 0;
  private goodT = 0;
  private goodSaid = false;
  private noSignalT = 0;

  // the session's tallies
  score = 0;
  tilesBroken = 0;
  picturesDone = 0;
  chainNow = 0;
  bestChain = 0;
  flares = 0;
  goldSeams = 0;
  passedPush = 0;
  pushes = 0;
  passedRest = 0;
  rests = 0;
  blindShare = -1;
  readonly done: { src: PicSrc; gold: number; fresh: boolean }[] = [];
  private dayDoneNow = false;
  private tip = '';
  private readonly events: SimEvent[] = [];
  private pendCount = 0;

  constructor(init: SimInit) {
    this.init = init;
    this.p = init.progress;
    this.plannedSec = Math.max(10, init.plannedSec);
    this.rng = init.rng;
    this.judge = RoundJudge.from(init.tuning);
    this.lead = init.eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
    this.restLead = init.eeg ? RULES.restLead.eeg : RULES.restLead.fnirs;
    this.sessionsBefore = this.p.sessions;
    this.session = this.p.sessions + 1;
    this.pushesBase = this.p.pushes;
    this.bestBefore = this.p.best;
    this.aspect = clamp(init.aspect, RULES.aspect[0], RULES.aspect[1]);
    this.talk = new Talk(m => Array.from({ length: LINE_COUNT }, (_, i) => t(lineKey(m, i))), this.rng);
  }

  // ── the session ─────────────────────────────────────────────────
  start(): void {
    if (this.started) return;
    this.started = true;
    this.plan = planBlocks(this.plannedSec, this.session === 1, this.rng);
    this.newPicture();
    this.startBlock(0);
    if (this.session === 1 && !this.p.seen.includes('story.open')) {
      this.p.seen.push('story.open');
      this.openStory({ kind: 'open', t: 0, dur: RULES.openSec, src: null, verse: ROOT, gold: 0, fresh: false });
      this.talk.ask('open', 4, 20);
    } else this.talk.ask(this.pic.day ? 'day' : 'back', 3, 10);
  }

  get block(): Block { return this.plan[Math.min(this.blockIndex, this.plan.length - 1)]; }
  get next(): Block | null { return this.blockIndex + 1 < this.plan.length ? this.plan[this.blockIndex + 1] : null; }
  get pushBlock(): boolean { return this.phase === 'play' && this.block.kind === 'push'; }
  get restBlock(): boolean { return this.phase === 'play' && this.block.kind === 'rest'; }
  get blind(): boolean { return this.pushBlock && this.block.blind; }
  /** a sighted push past its lead-in: the band's light acts */
  get sighted(): boolean { return this.pushBlock && !this.block.blind && this.blockT >= this.lead; }
  /** a rest block past its lead-in: calm lays the gold */
  get gazing(): boolean { return this.restBlock && this.blockT >= this.restLead; }
  get leadIn(): number { return this.lead; }
  /** the task the panel shows ("W głowie") */
  get task(): string { return this.tip; }
  /** the runner's block banner is (likely) on screen: the first seconds of a block after the first */
  get bannerUp(): boolean {
    return this.phase === 'play' && this.blockT < RULES.bannerSec && this.blockIndex > 0;
  }

  /** the voice and the cards wait out the runner's banner and the telegraph */
  get quiet(): boolean {
    if (this.story || this.coachUp) return true;
    if (this.phase !== 'play') return false;
    const b = this.block;
    return this.blockT >= b.dur - RULES.telegraph || (this.blockT < RULES.bannerSec && this.blockIndex > 0);
  }

  update(dt: number, f: FocusFrame, t: number): void {
    if (!this.started || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t = t;
    this.reliable = f.reliable && f.activity !== null;
    if (this.story) {
      this.story.t += dt;
      if (this.story.t >= this.story.dur) this.closeStory();
    }
    if (this.phase === 'play') this.schedule(dt, f, t);
    else if (this.phase === 'finale' && t >= this.plannedSec) this.endSession();
    this.brain(dt, f);
    this.picture(dt);
    this.talk.update(dt, t, this.quiet);
  }

  private schedule(dt: number, f: FocusFrame, t: number): void {
    const b = this.block;
    this.blockT += dt;
    if (b.kind !== 'warmup') {
      const want = b.kind === 'push' ? 'focus' : 'rest';
      this.judge.push(want, f, dt);
      this.contrast.push(want, f.activity, f.reliable, this.blockT, dt);
      if (f.reliable) this.relSec += dt;
    }
    if (b.kind === 'rest' && this.blockT >= RULES.bannerSec && this.blockT - dt < RULES.bannerSec) this.coach('rest', null);
    const last = this.blockIndex >= this.plan.length - 1;
    if (!this.telegraphed && this.blockT >= b.dur - RULES.telegraph) {
      this.telegraphed = true;
      this.talk.hush();
      this.emit({ type: 'telegraph', next: last ? null : this.plan[this.blockIndex + 1] });
    }
    if ((last && this.blockT >= b.dur) || t >= this.plannedSec - finaleFor(this.plannedSec)) {
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
    this.talk.hush();
    const b = this.plan[i];
    const first = !this.plan.slice(0, i).some(x => x.kind === b.kind);
    if (b.kind === 'push') {
      this.pushesBegun++;
      b.blind = this.session >= RULES.blindFrom && !first && (this.pushesBase + this.pushesBegun) % RULES.blindEvery === 0;
      this.blindBank = 0;
      this.goodT = 0;
      this.goodSaid = false;
      this.talk.ask(b.blind ? 'blind' : 'push', 2, 12);
      if (b.blind) this.coach('blind', null);
      // a rest with nothing to gild banked light: it lands on every dark tile now
      if (this.reserve > 0.005) {
        const amount = this.reserve;
        for (const tile of this.pic.tiles) if (!tile.open) tile.press = Math.min(0.95, tile.press + amount / tile.need);
        this.reserve = 0;
        this.emit({ type: 'reserve', amount });
      }
    } else if (b.kind === 'rest') {
      this.talk.ask('rest', 2, 12);
      // gold needs somewhere to start: the uncovered tile with the most uncovered neighbours
      this.seedGold();
    } else {
      this.coach('aim', { kind: 'aim' });
    }
    this.tip = this.tipFor(b, i);
    this.emit({ type: 'blockStart', block: b, index: i });
  }

  private tipFor(b: Block, i: number): string {
    const pair = this.pic.src.kind === 'pair' ? this.pic.src.id : null;
    if (b.kind === 'warmup') return taskFor('warm', pair, 0);
    const n = this.plan.slice(0, i).filter(x => x.kind === b.kind).length + this.sessionsBefore;
    if (b.kind === 'push') return taskFor(b.blind ? 'blind' : 'push', pair, n);
    return taskFor('rest', pair, n);
  }

  /** The block's end: its verdict, after its judged window, never during it; a blind push reveals its light. */
  private endBlock(): void {
    const b = this.block;
    if (b.kind === 'warmup') {
      this.emit({ type: 'blockEnd', block: b, verdict: null, share: 0, need: 0 });
      return;
    }
    const want = b.kind === 'push' ? 'focus' : 'rest';
    const share = this.judge.share, need = this.judge.need(want);
    const verdict = this.relSec >= RULES.minReliable ? this.judge.verdict() : null;
    if (b.kind === 'push') {
      this.pushes++;
      if (verdict) this.passedPush++;
      if (b.blind) {
        const s = this.judge.measured > 0 ? share : 0;
        this.blindShare = Math.max(this.blindShare, Math.round(s * 100));
        // the light gathered out of sight lands now, as a wave from the aimed tile
        if (s > 0.05 && this.pic.state === 'play') {
          const c = this.pic.mosaic.cells[this.aim];
          this.wave({ x: c.cx, y: c.cy }, RULES.flarePower * clamp(s / 0.6, 0.25, 1.2), false);
        }
        this.emit({ type: 'reveal', share: s });
        this.talk.ask('reveal', 4, 8);
      }
    } else {
      this.rests++;
      if (verdict) this.passedRest++;
    }
    this.judge.reset();
    this.emit({ type: 'blockEnd', block: b, verdict, share, need });
  }

  private beginFinale(): void {
    if (this.phase !== 'play') return;
    this.phase = 'finale';
    this.tip = '';
    this.emit({ type: 'finale' });
    this.talk.ask('end', 3, 10);
    this.endSaid = true;
  }

  private endSession(): void {
    if (this.phase === 'done') return;
    this.phase = 'done';
    if (!this.endSaid) this.talk.ask('end', 3, 6);
    this.emit({ type: 'end' });
    this.settle();
  }

  /** The session is settled once — at its end, or when it ends early: the counters reach the progress. */
  private settle(): void {
    if (this.settled || !this.started) return;
    this.settled = true;
    const p = this.p;
    p.sessions = Math.max(p.sessions, this.session);
    p.pushes = Math.max(p.pushes, this.pushesBase + this.pushesBegun);
  }

  /** The session ends before its own end: settle as the end would. */
  finish(): void {
    if (!this.started || this.settled) return;
    if (this.phase === 'play') this.endBlock();
    this.story = null;
    this.phase = 'done';
    this.settle();
  }

  canStop(): boolean {
    if (this.phase === 'done') return true;
    return this.t >= this.plannedSec + RULES.settle || (this.t >= this.plannedSec && this.pendCount === 0 && this.pic.state !== 'finishing');
  }

  // ── the band ────────────────────────────────────────────────────
  private brain(dt: number, f: FocusFrame): void {
    const R = RULES;
    const ok = f.reliable && f.activity !== null;
    // the light follows the band in a sighted push; it freezes where it is while the signal is gone
    const k = 1 - Math.exp(-dt / R.lightTau);
    if (ok) this.light += k * (clamp(f.level) - this.light);
    this.lightOn = ok && this.sighted && !this.story;
    const kc = 1 - Math.exp(-dt / R.calmTau);
    if (ok) this.calmShown += kc * (clamp(f.calm) - this.calmShown);
    // without a signal for a while in a block that listens: the firefly says it is the sensor
    if (!ok && (this.pushBlock || this.restBlock)) {
      this.noSignalT += dt;
      if (this.noSignalT > 6 && this.noSignalT - dt <= 6) this.talk.ask('nosignal', 3, 8);
    } else this.noSignalT = 0;
    // the flare fills from a held focus (a picture's bloom and the next one's assembly included: focus is never lost)
    if (ok && this.sighted && this.story?.kind !== 'open' && f.focused && !this.flareReady && this.pic.state !== 'finishing') {
      this.flare = Math.min(1, this.flare + (dt / R.flareSec) * (f.hold >= R.flareHold ? 1 : 0.5));
      if (this.flare >= 1) {
        this.flareReady = true;
        this.flareReadyT = 0;
        this.emit({ type: 'flareReady' });
        this.coach('flare', { kind: 'aim' });
        this.talk.ask('flareReady', 4, 6);
      }
    }
    if (this.flareReady && !this.story && this.pic.state === 'play' && !this.restBlock) {
      this.flareReadyT += dt;
      if (this.flareReadyT >= R.flareAuto) this.releaseFlare(null);
    }
    // light held above the threshold: the firefly notices (once a block)
    if (this.lightOn && this.light > 0.55) {
      this.goodT += dt;
      if (this.goodT >= R.goodSec && !this.goodSaid) {
        this.goodSaid = true;
        this.talk.ask('good', 1, 5);
        this.coach('halo', { kind: 'aim' });
      }
    }
    // a blind push banks what the light would have done
    if (this.blind && ok && this.blockT >= this.lead) this.blindBank += dt * Math.max(0, this.mult(clamp(f.level)) - 1);
  }

  /** The light's multiplier for a band light `l`: ×1 below lightFrom, ×1.57 at the threshold, ×3 at full. */
  mult(l: number): number {
    return 1 + RULES.lightGain * clamp((l - RULES.lightFrom) / (1 - RULES.lightFrom));
  }

  /** The halo's radius now (mosaic units): its threshold ring is `haloAt(0.5)`. */
  haloAt(l: number): number {
    return this.pic.meanR * (RULES.haloMin + RULES.haloSpan * clamp(l));
  }

  get haloR(): number { return this.haloAt(this.lightOn ? this.light : 0); }

  /** What the panel's gauge shows: the light in a sighted push, calm while gazing; null blind, without signal, elsewhere. */
  meter(): number | null {
    if (!this.started || !this.reliable || this.story) return null;
    if (this.blind) return null;
    if (this.pushBlock) return this.blockT < this.lead ? null : clamp(this.light);
    if (this.restBlock) return this.blockT < this.restLead ? null : clamp(this.calmShown);
    return null;
  }

  /** The pad follows the light in a sighted push, glows mid in the warm-up and holds still elsewhere. */
  padLevel(f: FocusFrame): number | null {
    if (!this.started || !f.reliable || this.phase !== 'play') return null;
    if (this.block.kind === 'warmup') return 0.5;
    if (this.sighted) return clamp(f.level);
    return null;
  }

  // ── pictures ────────────────────────────────────────────────────
  private newPicture(): void {
    const R = RULES;
    const src = choosePicture(this.p, {
      day: this.init.day, daySeed: this.init.daySeed, ownReady: this.init.ownReady?.() ?? [], index: this.picCount, prev: this.prevSrc,
    });
    const n = tilesFor(this.sessionsBefore, this.picCount);
    const mh = R.MH, mw = R.MH * clamp(this.aspect, R.aspect[0], R.aspect[1]);
    const weight = this.init.weight?.(src, mw, mh);
    const mosaic = makeMosaic(mw, mh, n, this.rng, { weight, relax: R.relax });
    const N = mosaic.cells.length;
    const mean = (mw * mh) / N;
    const tiles: Tile[] = mosaic.cells.map(c => ({
      press: 0, need: Math.max(0.35, (c.area / mean) ** R.needPow), open: false, openAt: -1, depth: 0, warm: 0, from: null, knock: 0,
      pend: -1, pendDepth: 0, pendDouble: false,
    }));
    const seams: Seam[] = mosaic.edges.map(e => ({ a: e.a, b: e.b, p: e.p, q: e.q, gold: 0 }));
    const seamsOf: number[][] = mosaic.cells.map(() => []);
    seams.forEach((s, i) => {
      seamsOf[s.a].push(i);
      if (s.b >= 0) seamsOf[s.b].push(i);
    });
    const day = src.kind === 'pair' && src.id === dayPair(this.init.daySeed) && this.p.dayDone !== this.init.day;
    this.pic = {
      src, index: this.picCount, mosaic, tiles, seams, seamsOf, meanR: Math.sqrt(mean / Math.PI),
      perTile: (R.picBase + R.picPerTile * N) / N, state: 'assemble', stateT: 0, open: 0, goldSrc: new Set(),
      saidCrack: false, saidBurst: false, saidNear: false, day, ver: 0,
    };
    this.picCount++;
    this.flare = Math.min(this.flare, 0.999);
    this.flareReady = false;
    this.flareAt = null;
    this.aim = cellAt(mosaic, mw / 2, mh / 2);
    this.aimBy = 'auto';
    this.aimT = 0;
    this.emit({ type: 'picture', src, tiles: N, day });
    if (this.picCount > 1) {
      if (src.kind === 'own') this.talk.ask('own', 2, 8);
      else if (day) this.talk.ask('day', 2, 8);
      else this.talk.ask('picture', 2, 8);
    }
    // a new picture in the middle of a block: its strategy follows the new scene
    if (this.plan.length) this.tip = this.tipFor(this.block, this.blockIndex);
  }

  /**
   * The frame changed shape (a phone turned): the picture's mosaic is cut again for it, every new tile
   * taking the state of the old tile under its centre (uncovered, pressed, warm, gold), so nothing is lost.
   */
  refit(aspect: number): boolean {
    const old = this.pic, R = RULES;
    if (!old || (old.state !== 'play' && old.state !== 'assemble') || this.pendCount > 0) return false;
    const a = clamp(aspect, R.aspect[0], R.aspect[1]);
    if (Math.abs(a / (old.mosaic.w / old.mosaic.h) - 1) < 0.18) return false;
    const mh = R.MH, mw = R.MH * a;
    const mosaic = makeMosaic(mw, mh, old.tiles.length, this.rng, { weight: this.init.weight?.(old.src, mw, mh), relax: R.relax });
    const N = mosaic.cells.length, mean = (mw * mh) / N;
    const under = (x: number, y: number) => cellAt(old.mosaic, (x / mw) * old.mosaic.w, (y / mh) * old.mosaic.h);
    const map = mosaic.cells.map(c => under(c.cx, c.cy));
    const tiles: Tile[] = mosaic.cells.map((c, i) => {
      const o = old.tiles[map[i]];
      return {
        press: o.open ? 1 : Math.min(0.95, o.press), need: Math.max(0.35, (c.area / mean) ** R.needPow), open: o.open, openAt: o.openAt, depth: 0,
        warm: o.warm, from: null, knock: 0, pend: -1, pendDepth: 0, pendDouble: false,
      };
    });
    // as many pieces uncovered as before, where they were: each old uncovered tile finds the nearest new one
    const want = old.tiles.filter(x => x.open).length;
    let have = tiles.filter(x => x.open).length;
    if (have !== want) {
      for (const tl of tiles) { tl.open = false; tl.press = Math.min(0.95, tl.press); }
      have = 0;
      old.tiles.forEach((o, j) => {
        if (!o.open) return;
        const oc = old.mosaic.cells[j];
        const x = (oc.cx / old.mosaic.w) * mw, y = (oc.cy / old.mosaic.h) * mh;
        let best = -1, bd = Infinity;
        mosaic.cells.forEach((c, i) => {
          if (tiles[i].open) return;
          const d = (c.cx - x) ** 2 + (c.cy - y) ** 2;
          if (d < bd) { bd = d; best = i; }
        });
        if (best >= 0) {
          tiles[best].open = true;
          tiles[best].press = 1;
          tiles[best].warm = o.warm;
          tiles[best].openAt = o.openAt;
          have++;
        }
      });
    }
    const oldGold = (cell: number) => {
      let g = 0;
      for (const si of old.seamsOf[cell]) g = Math.max(g, old.seams[si].gold);
      return g;
    };
    const seams: Seam[] = mosaic.edges.map(e => {
      const touchOpen = tiles[e.a].open || (e.b >= 0 && tiles[e.b].open);
      const mx = (e.p.x + e.q.x) / 2, my = (e.p.y + e.q.y) / 2;
      return { a: e.a, b: e.b, p: e.p, q: e.q, gold: touchOpen ? oldGold(under(mx, my)) : 0 };
    });
    const seamsOf: number[][] = mosaic.cells.map(() => []);
    seams.forEach((sm, i) => {
      seamsOf[sm.a].push(i);
      if (sm.b >= 0) seamsOf[sm.b].push(i);
    });
    const aimOld = old.mosaic.cells[this.aim];
    const aimNew = cellAt(mosaic, (aimOld.cx / old.mosaic.w) * mw, (aimOld.cy / old.mosaic.h) * mh);
    const src = new Set<number>();
    mosaic.cells.forEach((_, i) => { if (old.goldSrc.has(map[i]) && tiles[i].open) src.add(i); });
    old.mosaic = mosaic;
    old.tiles = tiles;
    old.seams = seams;
    old.seamsOf = seamsOf;
    old.meanR = Math.sqrt(mean / Math.PI);
    old.open = tiles.filter(x => x.open).length;
    old.goldSrc = src;
    old.ver++;
    const near = tiles[aimNew].open ? this.nearestDark({ x: mosaic.cells[aimNew].cx, y: mosaic.cells[aimNew].cy }) : -1;
    this.aim = near >= 0 ? near : aimNew;
    this.emit({ type: 'refit' });
    // everything open already (a mapping can close the gap): the picture is done
    if (old.state === 'play' && old.open === tiles.length) this.complete();
    return true;
  }

  /** A frame of the picture: pressure, bursts, chains, gold, the bloom. */
  private picture(dt: number): void {
    const pic = this.pic;
    pic.stateT += dt;
    for (const tile of pic.tiles) if (tile.knock > 0) tile.knock = Math.max(0, tile.knock - dt * 2.5);
    if (pic.state === 'assemble') {
      if (pic.stateT >= RULES.assembleSec && !this.story) this.setState('play');
      this.gild(dt);
      return;
    }
    if (pic.state === 'bloom') {
      this.gild(dt);
      this.chainStep();
      // the bright scene alone for a moment, then its card (out of a banner's way), then the next picture
      if (this.card && pic.stateT >= RULES.bloomSec * 0.55 && (!this.bannerUp || pic.stateT >= RULES.bloomSec)) {
        this.openStory(this.card);
        this.card = null;
      }
      if (!this.story && !this.card && pic.stateT >= RULES.bloomSec) this.nextPicture();
      return;
    }
    this.chainStep();
    if (pic.state === 'play' && !this.story) this.press(dt);
    this.gild(dt);
    this.wander(dt);
    if ((pic.state === 'play' || pic.state === 'finishing') && pic.open === pic.tiles.length) this.complete();
  }

  private setState(s: PicState): void {
    this.pic.state = s;
    this.pic.stateT = 0;
  }

  /** Light presses: on the aimed tile, and (with focus) on the tiles inside the halo — not while gazing. */
  private press(dt: number): void {
    const pic = this.pic, R = RULES;
    if (this.restBlock) return;
    const base = 1 / pic.perTile;
    const m = this.lightOn ? this.mult(this.light) : this.phase === 'play' && this.block.kind === 'warmup' ? R.warmLight : 1;
    const aimC = pic.mosaic.cells[this.aim];
    const at = { x: aimC.cx, y: aimC.cy };
    const halo = this.haloR;
    for (let i = 0; i < pic.tiles.length; i++) {
      const tile = pic.tiles[i];
      if (tile.open || tile.pend >= 0) continue;
      let share = 0;
      if (i === this.aim) share = 1;
      else if (this.lightOn) {
        const c = pic.mosaic.cells[i];
        const d = dist({ x: c.cx, y: c.cy }, at);
        if (d < halo) share = R.spill * (1 - d / halo);
      }
      if (share <= 0) continue;
      this.add(i, dt * base * m * share * this.goldMult(i), i === this.aim ? at : null);
    }
  }

  /** Light on a tile (need shares before its need), its first crack and its burst. */
  private add(i: number, amount: number, from: Pt | null): void {
    const tile = this.pic.tiles[i];
    if (tile.open || amount <= 0) return;
    if (!tile.from) {
      const c = this.pic.mosaic.cells[i];
      tile.from = from ?? { x: c.cx, y: c.cy };
    }
    const before = tile.press;
    tile.press += amount / tile.need;
    if (before < 0.12 && tile.press >= 0.12) {
      this.emit({ type: 'crack', cell: i });
      if (!this.pic.saidCrack) {
        this.pic.saidCrack = true;
        this.talk.ask('crack', 1, 4);
      }
    }
    if (tile.press >= 1 && tile.pend < 0) this.burst(i, 0, this.doubleNow());
  }

  /** A dark tile touching gold cracks faster: × (1 + goldPull × its share of gilded edges). */
  goldMult(i: number): number {
    const pic = this.pic, list = pic.seamsOf[i];
    if (!list.length) return 1;
    let g = 0;
    for (const s of list) g += pic.seams[s].gold;
    return 1 + RULES.goldPull * (g / list.length);
  }

  private doubleNow(): boolean {
    return !!this.flareAt && this.t - this.flareAt.t <= RULES.flareDouble;
  }

  /** A tile bursts: shards to the headline, light to its dark neighbours (a chain), the aim moves on. */
  private burst(i: number, depth: number, double: boolean): void {
    const pic = this.pic, R = RULES;
    const tile = pic.tiles[i];
    if (tile.open) return;
    tile.open = true;
    tile.openAt = this.t;
    tile.depth = depth;
    tile.press = 1;
    if (tile.pend >= 0) {
      tile.pend = -1;
      this.pendCount = Math.max(0, this.pendCount - 1);
    }
    pic.open++;
    const c = pic.mosaic.cells[i];
    const frame = pic.mosaic.w * pic.mosaic.h;
    const base = clamp(Math.round(R.shardMin + 6 * Math.sqrt(c.area / (frame / 7))), R.shardMin, R.shardMax);
    const shards = (base + depth) * (double ? 2 : 1);
    this.score += shards;
    this.tilesBroken++;
    this.p.shards += shards;
    // every burst until the chain links run out is one cascade (chainStep counts it)
    this.chainNow++;
    this.emit({ type: 'burst', cell: i, shards, depth, double });
    if (!pic.saidBurst) {
      pic.saidBurst = true;
      this.talk.ask('burst', 2, 5);
    }
    if (pic.goldSrc.size === 0) pic.goldSrc.add(i);
    // light into the dark neighbours: one filled by it bursts a moment later
    if (pic.state === 'play') {
      for (const j of c.neighbors) {
        const n = pic.tiles[j];
        if (n.open || n.pend >= 0) continue;
        const amount = (R.pass + (this.lightOn ? R.passLight * this.light : 0)) * R.passDecay ** depth * this.goldMult(j);
        if (!n.from) n.from = { x: (c.cx + pic.mosaic.cells[j].cx) / 2, y: (c.cy + pic.mosaic.cells[j].cy) / 2 };
        n.press += amount / n.need;
        if (n.press >= 0.12 && n.press - amount / n.need < 0.12) this.emit({ type: 'crack', cell: j });
        if (n.press >= 1) this.schedulePend(j, depth + 1, this.t + R.chainGap, double);
      }
      if (depth === 1) this.coach('chain', { kind: 'tile', cell: i });
    }
    // the light moves on to the most cracked neighbour, or the most cracked tile
    if (i === this.aim) this.autoAim(i);
    const left = pic.tiles.length - pic.open;
    if (pic.state === 'play' && !pic.saidNear && left > 0 && left <= Math.max(3, Math.round(pic.tiles.length * 0.2)) && pic.tiles.length >= 10) {
      pic.saidNear = true;
      this.talk.ask('near', 1, 5);
    }
    if (pic.state === 'play' && left > 0 && left <= Math.max(R.finishMin, Math.floor(pic.tiles.length * R.finishShare))) this.finishing(i);
  }

  private schedulePend(j: number, depth: number, at: number, double: boolean): void {
    const n = this.pic.tiles[j];
    if (n.open || n.pend >= 0) return;
    n.pend = at;
    n.pendDepth = depth;
    n.pendDouble = double;
    this.pendCount++;
  }

  /** Chain links whose time has come burst; a chain that has ended is counted. */
  private chainStep(): void {
    const pic = this.pic;
    if (this.pendCount > 0) {
      for (let i = 0; i < pic.tiles.length; i++) {
        const n = pic.tiles[i];
        if (n.pend >= 0 && n.pend <= this.t) this.burst(i, n.pendDepth, n.pendDouble);
      }
    }
    if (this.pendCount === 0 && this.chainNow > 0) {
      const n = this.chainNow;
      this.chainNow = 0;
      if (n >= 2) {
        this.bestChain = Math.max(this.bestChain, n);
        this.emit({ type: 'chain', n });
        if (n >= 3) this.talk.ask('chain', 2, 4);
      }
    }
  }

  /** The last tiles go together, one after another, from the one that just burst outward. */
  private finishing(from: number): void {
    const pic = this.pic, R = RULES;
    this.setState('finishing');
    const c0 = pic.mosaic.cells[from];
    const d0 = (i: number) => Math.hypot(pic.mosaic.cells[i].cx - c0.cx, pic.mosaic.cells[i].cy - c0.cy);
    const dark = pic.tiles.map((tl, i) => ({ tl, i })).filter(x => !x.tl.open && x.tl.pend < 0);
    dark.sort((a, b) => d0(a.i) - d0(b.i));
    dark.forEach((x, k) => this.schedulePend(x.i, this.chainNow + k, this.t + R.finishGap * (k + 1), this.doubleNow()));
    this.emit({ type: 'finishing' });
  }

  /** All tiles open: the album, the bloom, the card and the firefly's line for the place. */
  private complete(): void {
    const pic = this.pic;
    this.setState('bloom');
    const gold = this.goldShare();
    const fresh = !this.p.album[srcKey(pic.src)];
    const e = recordPicture(this.p, pic.src, gold, this.init.day, this.init.daySeed);
    if (pic.day && this.p.dayDone === this.init.day) this.dayDoneNow = true;
    this.picturesDone++;
    this.done.push({ src: pic.src, gold, fresh });
    const verse = gold >= 90 ? GOLD_VERSE
      : pic.src.kind === 'pair' ? pairVerse(pic.src.id, e.n) : OWN_VERSES[(e.n - 1) % OWN_VERSES.length];
    this.flare = Math.min(this.flare, 0.999);
    this.flareReady = false;
    this.emit({ type: 'done', src: pic.src, gold, fresh });
    this.card = { kind: 'done', t: 0, dur: RULES.cardSec, src: pic.src, verse, gold, fresh };
    // what was waiting to be said is past: the picture's own line goes first
    this.talk.clear();
    this.talk.hush();
    if (pic.src.kind === 'pair') this.talk.say(t(revealKey(pic.src.id)), 4, 14);
    else this.talk.ask('done', 4, 14);
  }

  private nextPicture(): void {
    this.prevSrc = this.pic.src;
    this.newPicture();
  }

  /** The share of the picture's seams laid in gold (0..100). */
  goldShare(): number {
    const s = this.pic.seams;
    if (!s.length) return 0;
    return (s.reduce((a, x) => a + x.gold, 0) / s.length) * 100;
  }

  /** Untouched (or after its hold), the light goes to the most cracked tile. */
  private wander(dt: number): void {
    const pic = this.pic;
    if (pic.state !== 'play') return;
    this.aimT += dt;
    const cur = pic.tiles[this.aim];
    if (cur.open || (this.aimBy !== 'auto' && this.aimT > RULES.aimHold && cur.press < 0.05)) this.autoAim(this.aim);
  }

  /** The aim moves to the most cracked dark neighbour of `from`, else the most cracked dark tile (ties: the centre). */
  private autoAim(from: number): void {
    const pic = this.pic;
    const cells = pic.mosaic.cells;
    const pickBest = (ids: number[]): number => {
      let best = -1, score = -Infinity;
      for (const j of ids) {
        const tl = pic.tiles[j];
        if (tl.open || tl.pend >= 0) continue;
        const s = tl.press * 3 + this.goldMult(j) * 0.5 - cells[j].ring;
        if (s > score) { score = s; best = j; }
      }
      return best;
    };
    let j = pickBest(cells[from].neighbors);
    if (j < 0) j = pickBest(cells.map(c => c.id));
    if (j < 0 || j === this.aim) return;
    this.aim = j;
    this.aimBy = 'auto';
    this.aimT = 0;
    this.emit({ type: 'aim', cell: j, by: 'auto' });
  }

  // ── gold ────────────────────────────────────────────────────────
  private seedGold(): void {
    const pic = this.pic;
    if (pic.goldSrc.size) return;
    let best = -1, bestN = -1;
    pic.tiles.forEach((tl, i) => {
      if (!tl.open) return;
      const n = pic.mosaic.cells[i].neighbors.filter(j => pic.tiles[j].open).length;
      if (n > bestN) { bestN = n; best = i; }
    });
    if (best >= 0) pic.goldSrc.add(best);
  }

  /** Gazing: calm warms the uncovered pieces and lays gold along their seams, tile to tile. */
  private gild(dt: number): void {
    const pic = this.pic, R = RULES;
    const gazing = this.gazing && !this.story;
    const calm = this.reliable ? clamp(this.calmShown) : 0;
    for (const tile of pic.tiles) {
      if (!tile.open) continue;
      tile.warm = Math.min(1, tile.warm + dt * (gazing ? R.warmBase + R.calmWarm * calm : R.warmIdle));
    }
    if (!gazing) return;
    if (pic.open === 0) {
      // nothing to gild yet: calm banks light for the next push
      this.reserve = Math.min(R.reserveMax, this.reserve + dt * (R.reserveMax / 15) * (0.3 + 0.7 * calm));
      return;
    }
    if (!pic.goldSrc.size) this.seedGold();
    const rate = dt * (R.goldBase + R.calmGold * calm);
    for (let i = 0; i < pic.tiles.length; i++) {
      if (!pic.tiles[i].open) continue;
      const list = pic.seamsOf[i];
      let flow = pic.goldSrc.has(i);
      if (!flow) for (const s of list) if (pic.seams[s].gold >= 0.5) { flow = true; break; }
      if (!flow) continue;
      for (const s of list) this.goldTo(s, rate);
    }
  }

  private goldTo(s: number, amount: number): void {
    const seam = this.pic.seams[s];
    if (seam.gold >= 1) return;
    seam.gold = Math.min(1, seam.gold + amount);
    if (seam.gold >= 1) {
      this.goldSeams++;
      this.p.goldSeams++;
      this.emit({ type: 'gold', seam: s });
      if (this.goldSeams === 1 || this.goldSeams % 12 === 0) this.talk.ask('gold', 1, 5);
      if (this.goldSeams === 1) this.coach('gold', null);
    }
  }

  // ── the hands ───────────────────────────────────────────────────
  /** Close a card that has been up long enough; true if a card took the tap. */
  tapCard(): boolean {
    if (!this.story) return false;
    if (this.story.t >= RULES.cardMin) this.closeStory();
    return true;
  }

  /**
   * A tap on the mosaic at `at` (mosaic units): a card first; a ready flare goes off there; a dark tile
   * is aimed and knocked; an uncovered one is gilded while gazing (else the light goes to the dark tile
   * nearest the tap).
   */
  tap(at: Pt): void {
    if (!this.started || this.phase === 'done' || this.tapCard()) return;
    const pic = this.pic;
    const i = cellAt(pic.mosaic, at.x, at.y);
    const tile = pic.tiles[i];
    // gazing: an uncovered piece takes gold from the finger in any state (the bloom's picture too)
    if (tile.open && this.restBlock) {
      pic.goldSrc.add(i);
      for (const s of pic.seamsOf[i]) this.goldTo(s, RULES.tapGold);
      tile.warm = Math.min(1, tile.warm + 0.15);
      this.emit({ type: 'gild', cell: i });
      return;
    }
    if (pic.state !== 'play' && pic.state !== 'assemble') return;
    // a ready flare waits out a gazing block: the dark tiles rest
    if (this.flareReady && !this.restBlock) {
      this.releaseFlare(at);
      return;
    }
    if (tile.open) {
      if (this.restBlock) {
        pic.goldSrc.add(i);
        for (const s of pic.seamsOf[i]) this.goldTo(s, RULES.tapGold);
        tile.warm = Math.min(1, tile.warm + 0.15);
        this.emit({ type: 'gild', cell: i });
        return;
      }
      const j = this.nearestDark(at);
      if (j >= 0) this.setAim(j, 'tap');
      return;
    }
    this.setAim(i, 'tap');
    this.knock(i, at);
  }

  /** A drag over the mosaic: the light follows the lens (no knock). */
  drag(at: Pt): void {
    if (!this.started || this.phase === 'done' || this.story || (this.pic.state !== 'play' && this.pic.state !== 'assemble')) return;
    const i = cellAt(this.pic.mosaic, at.x, at.y);
    if (!this.pic.tiles[i].open && i !== this.aim) {
      this.setAim(i, 'drag');
      this.coach('drag', null);
    }
  }

  /** Space: a card, a ready flare at the aim, else a knock on the aimed tile. */
  space(): void {
    if (!this.started || this.phase === 'done' || this.tapCard()) return;
    if (this.pic.state !== 'play' && this.pic.state !== 'assemble') return;
    if (this.flareReady && !this.restBlock) {
      this.releaseFlare(null);
      return;
    }
    const c = this.pic.mosaic.cells[this.aim];
    this.knock(this.aim, { x: c.cx, y: c.cy });
  }

  private setAim(i: number, by: 'tap' | 'drag'): void {
    if (this.aim !== i || this.aimBy !== by) {
      this.aim = i;
      this.emit({ type: 'aim', cell: i, by });
    }
    this.aimBy = by;
    this.aimT = 0;
  }

  /** A knock: a second or so of the base light at once (less when knocks come quickly), a crack where it hit. */
  private knock(i: number, at: Pt): void {
    const pic = this.pic, R = RULES;
    const tile = pic.tiles[i];
    if (tile.open || this.restBlock) {
      this.emit({ type: 'knock', cell: i, x: at.x, y: at.y, power: 0 });
      return;
    }
    const k = clamp((this.t - this.lastKnock) / R.knockGap, 0.15, 1);
    this.lastKnock = this.t;
    const power = (R.knockSec / pic.perTile) * k;
    tile.knock = 1;
    this.emit({ type: 'knock', cell: i, x: at.x, y: at.y, power: k });
    this.add(i, power, at);
    this.coach('knock', { kind: 'aim' });
  }

  private nearestDark(at: Pt): number {
    const pic = this.pic;
    let best = -1, bd = Infinity;
    pic.tiles.forEach((tl, i) => {
      if (tl.open) return;
      const c = pic.mosaic.cells[i];
      const d = (c.cx - at.x) ** 2 + (c.cy - at.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  /** The flare: a wave of light from a point (the aim without one); bursts soon after count double. */
  releaseFlare(at: Pt | null): void {
    if (!this.flareReady || this.pic.state !== 'play') return;
    const c = this.pic.mosaic.cells[this.aim];
    const pt = at ?? { x: c.cx, y: c.cy };
    this.flareReady = false;
    this.flare = 0;
    this.flares++;
    this.p.flares++;
    this.flareAt = { x: pt.x, y: pt.y, t: this.t };
    this.emit({ type: 'flare', x: pt.x, y: pt.y });
    this.talk.ask('flare', 3, 5);
    this.wave(pt, RULES.flarePower, true);
  }

  /** A wave of light from `pt`: every dark tile within reach gets light by its distance; the full ones burst outward in turn. */
  private wave(pt: Pt, power: number, double: boolean): void {
    const pic = this.pic, R = RULES;
    const reach = R.flareReach * pic.meanR;
    for (let i = 0; i < pic.tiles.length; i++) {
      const tile = pic.tiles[i];
      if (tile.open || tile.pend >= 0) continue;
      const c = pic.mosaic.cells[i];
      const d = dist({ x: c.cx, y: c.cy }, pt);
      if (d >= reach) continue;
      const amount = power * (1 - d / reach) ** 0.7 * this.goldMult(i);
      if (!tile.from) tile.from = { x: c.cx + (pt.x - c.cx) * 0.3, y: c.cy + (pt.y - c.cy) * 0.3 };
      tile.press += amount / tile.need;
      if (tile.press >= 1) this.schedulePend(i, 0, this.t + 0.05 + (d / reach) * 0.5, double);
      else if (tile.press >= 0.12) this.emit({ type: 'crack', cell: i });
    }
  }

  // ── cards and coach marks ───────────────────────────────────────
  private openStory(s: Story): void {
    this.story = s;
    this.talk.hush();
    this.emit({ type: 'story', kind: s.kind });
  }

  private closeStory(): void {
    if (!this.story) return;
    this.story = null;
    this.emit({ type: 'storyEnd' });
  }

  private coach(what: Coach, at: CoachAt): void {
    const key = `coach.${what}`;
    if (this.p.seen.includes(key)) return;
    this.p.seen.push(key);
    this.emit({ type: 'coach', what, at });
  }

  /** In a rest block: the breath guide (in for 4, out for 6), `k` 0..1 through the breath. */
  breath(): { inhale: boolean; k: number } | null {
    if (!this.restBlock) return null;
    const c = this.blockT % 10;
    return c < 4 ? { inhale: true, k: c / 4 } : { inhale: false, k: (c - 4) / 6 };
  }

  // ── output ──────────────────────────────────────────────────────
  private emit(e: SimEvent): void { this.events.push(e); }

  take(): readonly SimEvent[] {
    if (!this.events.length) return NO_EVENTS;
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }

  /** The passage the session closes with: the last picture transformed (gold: Isaiah 61:3), else one in turn. */
  closingVerse(): PassageId {
    const last = this.done.at(-1);
    if (!last) return PLAIN_CLOSINGS[(Math.max(1, this.session) - 1) % PLAIN_CLOSINGS.length];
    if (last.gold >= 90) return GOLD_VERSE;
    const n = this.p.album[srcKey(last.src)]?.n ?? 1;
    return last.src.kind === 'pair' ? pairVerse(last.src.id, n) : OWN_VERSES[(n - 1) % OWN_VERSES.length];
  }

  /** The session's numbers, idempotent: records with Math.max; the counters reach the progress when they happen. */
  result(ownLabel: (id: string) => string = () => t('hud.own')): ArcadeOutcome {
    const p = this.p;
    if (this.started) {
      p.best = Math.max(p.best, this.score);
      p.bestChain = Math.max(p.bestChain, this.bestChain);
    }
    const title = (s: PicSrc) => (s.kind === 'pair' ? pairTitle(s.id) : ownLabel(s.id));
    const stats: [string, string][] = [
      [t('st.pictures'), String(this.picturesDone)],
      [t('st.tiles'), String(this.tilesBroken)],
      [t('st.chain'), this.bestChain >= 2 ? `×${this.bestChain}` : '—'],
      [t('st.gold'), String(this.goldSeams)],
      [t('st.flares'), String(this.flares)],
      [t('st.size'), String(this.started ? this.pic.tiles.length : tilesFor(this.sessionsBefore, 0))],
      [t('st.push'), this.pushes ? `${this.passedPush}/${this.pushes}` : '—'],
      [t('st.rest'), this.rests ? `${this.passedRest}/${this.rests}` : '—'],
    ];
    if (this.blindShare >= 0) stats.push([t('st.blind'), pct(this.blindShare)]);
    const hl: string[] = [];
    for (const d of this.done.slice(-3)) {
      hl.push(d.fresh ? t('hl.new', { title: title(d.src) }) : t('hl.picture', { title: title(d.src) }));
      if (d.gold >= 90) hl.push(t('hl.gold', { title: title(d.src), pct: pct(d.gold) }));
    }
    if (this.dayDoneNow) hl.push(t('hl.day'));
    if (this.bestChain >= 4) hl.push(t('hl.chain', { n: this.bestChain }));
    if (this.blindShare >= 0) hl.push(t('hl.blind', { pct: pct(this.blindShare) }));
    if (this.done.some(d => d.fresh && d.src.kind === 'pair')) hl.push(t('hl.album', { n: albumCount(p) }));
    const line = this.done.length ? t(lineKey('done', this.session)) : t(lineKey('end', this.session));
    hl.push(t('hl.close', { line }));
    return {
      score: this.score, unit: unit(this.score), record: this.started && this.score > this.bestBefore && this.sessionsBefore > 0,
      stats, highlights: hl, verse: this.closingVerse(),
    };
  }

  /** For the view: is `src` the picture on screen. */
  showing(src: PicSrc): boolean { return sameSrc(this.pic?.src ?? null, src); }
}

export type { Moment };
