/**
 * One battle of Zastępy on its road, without the DOM, the canvas or the band (so the tests can play
 * whole battles headless): the gate of light at x = 0, the gate of ash at x = road; the light that
 * flows into the bar and pays for the cards; the host sent out of the gate; the demons' waves out
 * of the gate of ash (announced a moment ahead, so the answering card can be readied); the fighters
 * walking toward each other and striking on their own, each angel the bane of one kind of shade
 * (×2); the gate's beam; the trumpet's shockwave; the pillar of cloud (the hero power: it stands
 * where it is raised, the shades cannot pass it and its fire burns them); the boss of a chapter's
 * last battle with its telegraphed special (the Colossus stomps, the Locust calls a swarm, the Dragon
 * breathes fire); the shields and the mending of Cisza.  What the band changes comes in from the
 * session (sim.ts) as plain numbers: the flow's multiplier and the calm.
 *
 * A battle ends when the gate of ash falls (in a boss battle: when the boss falls), or when the gate
 * of light's walls are down — then the host withdraws and the session starts the battle again with
 * stronger walls.  Nothing is lost: the gold of the battle is kept.
 */
import { mulberry32 } from '../../core/random';
import { agePower, ageOf, beamFor, bossOf, chapterOf, flowFor, isBossBattle, lightMaxFor, pillarFor, trumpetDmgFor, wallsFor } from './meta';
import {
  BANE, DEMONS, DEMON_BANE, HOST, HOST_IDS, RULES, WAVE_IDS, isBoss,
  type BossId, type DemonId, type HostId, type Stats, type WaveId,
} from './rules';

export type Side = 1 | -1;
export type Kind = HostId | DemonId;

export interface Fighter extends Stats {
  id: number;
  /** 1: the host (walks right), −1: a demon (walks left) */
  side: Side;
  kind: Kind;
  x: number;
  /** depth on the road 0..1 (the picture's lane) */
  lane: number;
  maxHp: number;
  shield: number;
  /** seconds to its next strike, since its last strike, since it was last hurt */
  cd: number;
  atkT: number;
  hitT: number;
  /** walking, fighting (a foe or a gate in reach, or held by the pillar), gone (dissolving for RULES.fade) */
  state: 'walk' | 'fight' | 'gone';
  goneT: number;
  /** a knock-back in progress (m left) */
  knock: number;
  /** the gold it pays when beaten (demons) */
  gold: number;
}

/** A boss's special, telegraphed: what it is, the stretch of road it lands on, seconds to landing. */
export interface Special { kind: 'stomp' | 'swarm' | 'breath'; x0: number; x1: number; t: number; warn: number }

export type BattleEvent =
  | { type: 'sent'; id: number; kind: HostId }
  | { type: 'spawn'; id: number; kind: WaveId }
  | { type: 'waveSoon'; kinds: WaveId[] }
  | { type: 'strike'; id: number; side: Side; kind: Kind; x: number; tx: number; ty: 'foe' | 'gate'; ranged: boolean; aoe: number; flyTarget: boolean; bane: boolean }
  | { type: 'hurt'; id: number; side: Side; x: number; dmg: number; shield: boolean }
  | { type: 'beaten'; id: number; kind: DemonId; x: number; fly: boolean; gold: number; by: Cause }
  | { type: 'fallen'; id: number; kind: HostId; x: number; fly: boolean }
  | { type: 'beam'; x: number; fly: boolean }
  | { type: 'ember'; x: number; fly: boolean }
  | { type: 'gateHit'; side: Side; dmg: number }
  | { type: 'sealed'; x: number }
  | { type: 'surge' }
  | { type: 'boss'; id: number; kind: BossId }
  | { type: 'warn'; special: Special }
  | { type: 'special'; special: Special; hit: number; blocked: boolean }
  | { type: 'cancel'; special: Special }
  | { type: 'trumpet'; hit: number }
  | { type: 'pillar'; x: number; sec: number }
  | { type: 'pillarEnd' }
  | { type: 'won' }
  | { type: 'lost' };

export type Cause = 'host' | 'demon' | 'beam' | 'trumpet' | 'ember' | 'pillar' | 'special';

/** What the session feeds a battle each frame. */
export interface Control {
  /** the flow's multiplier (≥ 1: the band only adds) */
  flow: number;
  /** a Cisza block: the demons' waves come slower and walk slower */
  rest: boolean;
  /** calm 0..1 that mends the walls and lays shields (0 outside a sighted Cisza past its lead-in) */
  calm: number;
}

export interface BattleInit {
  /** the battle number (0-based, all chapters) */
  battle: number;
  gate: number;
  units: Readonly<Record<HostId, number>>;
  /** the pillar of cloud's level (1..5) */
  hero?: number;
  /** withdrawals in this battle so far: each makes the walls stronger for the next try */
  retreats: number;
  seed: number;
}

const WEIGHT: Readonly<Record<WaveId, number>> = { chochlik: 3, cien: 3, ogar: 2, skrzydlak: 2, miotacz: 2, bestia: 1 };
/** a wave is announced this long (s) before it steps out */
const SOON = 2.6;

export class Battle {
  readonly battle: number;
  readonly chapter: number;
  readonly local: number;
  readonly age: number;
  readonly bossBattle: boolean;
  readonly bossKind: BossId;
  readonly gate: number;
  readonly road: number = RULES.road;
  private readonly rng: () => number;
  private readonly levels: Readonly<Record<HostId, number>>;
  private readonly events: BattleEvent[] = [];
  readonly fighters: Fighter[] = [];
  private nextId = 1;

  t = 0;
  light: number = RULES.lightStart;
  readonly lightMax: number;
  readonly flowBase: number;
  /** the flow this frame (light/s), for the picture's stream */
  flowNow = 0;
  walls: number;
  readonly wallsMax: number;
  ash: number;
  readonly ashMax: number;
  /** the cards' cooldowns (s left) */
  readonly cool: Record<HostId, number>;
  private beamCd = 0.5;
  private emberCd = 1;
  readonly beam: { dmg: number; rate: number; range: number };
  private waveT: number = RULES.firstWave;
  private waveN = 0;
  /** the next wave, picked when it is announced (the view shows its kinds over the gate of ash) */
  nextWave: WaveId[] | null = null;
  private queue: DemonId[] = [];
  private spawnT = 0;
  private surges = 0;
  boss: Fighter | null = null;
  private bossOut = false;
  /** the boss's special: the next one's countdown, the one being telegraphed */
  private specialT: number = RULES.specialEvery;
  special: Special | null = null;
  /** the pillar of cloud: where it stands and how long it still stands; its cooldown; its numbers */
  pillar: { x: number; t: number; sec: number } | null = null;
  pillarCd: number = RULES.pillarFirst;
  readonly pillarStats: { sec: number; cool: number; burn: number };
  private burnT = 0;
  outcome: 'won' | 'lost' | null = null;
  /** demons beaten, gold earned, bane strikes and pillar kills in this battle */
  beaten = 0;
  gold = 0;
  banes = 0;

  constructor(init: BattleInit) {
    this.battle = init.battle;
    const c = chapterOf(init.battle);
    this.chapter = c.chapter;
    this.local = c.local;
    this.age = ageOf(init.battle);
    this.bossBattle = isBossBattle(init.battle);
    this.bossKind = bossOf(init.battle);
    this.gate = init.gate;
    this.levels = init.units;
    this.rng = mulberry32((init.seed ^ (init.battle * 0x9e3779b1)) >>> 0);
    this.lightMax = lightMaxFor(init.gate);
    this.flowBase = flowFor(init.gate);
    this.wallsMax = this.walls = wallsFor(init.gate, init.retreats);
    this.ashMax = this.ash = Math.round((RULES.ash + RULES.ashPerBattle * this.local) * (1 + RULES.ashChapter * this.chapter));
    this.beam = beamFor(init.gate);
    this.pillarStats = pillarFor(Math.max(1, Math.min(RULES.heroMax, init.hero ?? 1)));
    this.cool = Object.fromEntries(HOST_IDS.map(id => [id, 0])) as Record<HostId, number>;
  }

  /** the demons' strength in this battle (× hp and damage) */
  get demonK(): number {
    return (1 + RULES.demonPerBattle * (this.bossBattle ? RULES.bossWaves : this.local)) * (1 + RULES.demonPerChapter * this.chapter);
  }

  // ── the cards ───────────────────────────────────────────────────
  /** The cards open at this gate level, in order. */
  get cards(): HostId[] { return HOST_IDS.filter(id => HOST[id].gate <= this.gate); }

  /** Can this card be sent now (open, cooled down, enough light)? */
  ready(id: HostId): boolean {
    return !this.outcome && HOST[id].gate <= this.gate && this.cool[id] <= 0 && this.light >= HOST[id].cost;
  }

  /** The cheapest card that can be sent now (Space), or null. */
  cheapestReady(): HostId | null {
    let best: HostId | null = null;
    for (const id of this.cards) if (this.ready(id) && (!best || HOST[id].cost < HOST[best].cost)) best = id;
    return best;
  }

  /** Send a unit out of the gate of light; false when the card is not ready. */
  send(id: HostId): boolean {
    if (!this.ready(id)) return false;
    const st = HOST[id];
    this.light -= st.cost;
    this.cool[id] = st.cool;
    const lv = this.levels[id] ?? 1, k = (1 + RULES.unitPerLevel * (lv - 1)) * agePower(this.age);
    const f = this.make(1, id, st, 0.4, k);
    this.events.push({ type: 'sent', id: f.id, kind: id });
    return true;
  }

  private make(side: Side, kind: Kind, st: Stats, x: number, k: number, gold = 0): Fighter {
    const lane = this.rng();
    const f: Fighter = {
      ...st, id: this.nextId++, side, kind, x, lane, hp: st.hp * k, maxHp: st.hp * k, dmg: st.dmg * k, shield: 0,
      cd: 0.2 + this.rng() * 0.3, atkT: 9, hitT: 9, state: 'walk', goneT: 0, knock: 0, gold,
    };
    this.fighters.push(f);
    return f;
  }

  private spawn(id: DemonId, x = this.road - 0.4): void {
    const f = this.make(-1, id, DEMONS[id], x, this.demonK, DEMONS[id].gold);
    if (isBoss(id)) {
      this.boss = f;
      f.lane = 0.5;
      this.events.push({ type: 'boss', id: f.id, kind: id });
    } else this.events.push({ type: 'spawn', id: f.id, kind: id });
  }

  // ── the trumpet and the pillar ──────────────────────────────────
  /**
   * The trumpet's shockwave rolls down the whole road: every demon is wounded and thrown back (a boss
   * stands, but its special in the making is broken off).
   */
  trumpet(): number {
    if (this.outcome) return 0;
    const dmg = trumpetDmgFor(this.gate);
    let hit = 0;
    for (const f of this.fighters) {
      if (f.side !== -1 || f.state === 'gone') continue;
      hit++;
      if (!isBoss(f.kind)) f.knock = RULES.trumpetPush;
      this.hurt(f, dmg, 'trumpet');
    }
    if (this.special && this.special.t > 0) {
      this.events.push({ type: 'cancel', special: this.special });
      this.special = null;
      this.specialT = RULES.specialEvery;
    }
    this.events.push({ type: 'trumpet', hit });
    return hit;
  }

  /** Is the pillar of cloud ready to be raised? */
  get pillarReady(): boolean { return !this.outcome && this.pillarCd <= 0 && !this.pillar; }

  /** Where a pillar raised without a place goes: a little ahead of the host's front (or before the gate). */
  pillarSpot(): number {
    const dem = this.front(-1), host = this.front(1);
    const x = this.count(-1) ? Math.min(dem - 0.6, Math.max(host + 1.2, 3)) : host + 2;
    return Math.max(2, Math.min(this.road - 2, x));
  }

  /** Raise the pillar of cloud at `x` (m along the road); false when it is not ready. */
  raisePillar(x = this.pillarSpot()): boolean {
    if (!this.pillarReady) return false;
    const px = Math.max(1.5, Math.min(this.road - 1.5, x));
    this.pillar = { x: px, t: this.pillarStats.sec, sec: this.pillarStats.sec };
    this.pillarCd = this.pillarStats.cool;
    this.burnT = 0;
    this.events.push({ type: 'pillar', x: px, sec: this.pillarStats.sec });
    return true;
  }

  /** The front of a side: the host's farthest fighter (or its gate), the demons' nearest (or theirs). */
  front(side: Side): number {
    let x = side === 1 ? 0 : this.road;
    for (const f of this.fighters) {
      if (f.side !== side || f.state === 'gone') continue;
      x = side === 1 ? Math.max(x, f.x) : Math.min(x, f.x);
    }
    return x;
  }

  // ── a frame ─────────────────────────────────────────────────────
  step(dt: number, ctl: Control): void {
    if (!(dt > 0)) return;
    this.t += dt;
    for (const id of HOST_IDS) this.cool[id] = Math.max(0, this.cool[id] - dt);
    for (const f of this.fighters) {
      f.atkT += dt;
      f.hitT += dt;
    }
    if (this.outcome) {
      this.fade(dt);
      return;
    }
    // the light
    this.flowNow = this.flowBase * Math.max(1, ctl.flow);
    if (this.light < this.lightMax) this.light = Math.min(this.lightMax, this.light + this.flowNow * dt);
    // Cisza: calm mends the walls and lays shields of light on the front line
    if (ctl.calm > 0) {
      this.walls = Math.min(this.wallsMax, this.walls + RULES.mend * ctl.calm * this.wallsMax * dt);
      const front = this.fighters.filter(f => f.side === 1 && f.state !== 'gone').sort((a, b) => b.x - a.x).slice(0, RULES.shieldFront);
      for (const f of front) f.shield = Math.min(f.maxHp * RULES.shieldMax, f.shield + RULES.shieldGain * ctl.calm * dt);
    }
    this.pillarTick(dt);
    this.waves(dt, ctl.rest);
    this.specials(dt);
    this.fight(dt, ctl.rest);
    this.beamTick(dt);
    this.emberTick(dt);
    this.fade(dt);
    if (this.outcome === null) {
      if (this.bossBattle ? this.bossOut && this.boss !== null && this.boss.state === 'gone' : this.ash <= 0) this.end('won');
      else if (this.walls <= 0) this.end('lost');
    }
  }

  private end(o: 'won' | 'lost'): void {
    this.outcome = o;
    this.special = null;
    this.pillar = null;
    if (o === 'won') {
      this.ash = 0;
      // the demons left on the road dissolve with their gate (they pay nothing more)
      for (const f of this.fighters) if (f.side === -1 && f.state !== 'gone') { f.state = 'gone'; f.goneT = 0; f.gold = 0; }
    } else this.walls = 0;
    this.events.push({ type: o });
  }

  private pillarTick(dt: number): void {
    this.pillarCd = Math.max(0, this.pillarCd - (this.pillar ? 0 : dt));
    const p = this.pillar;
    if (!p) return;
    p.t -= dt;
    // its fire: a burn on every shade within its width, four times a second
    this.burnT += dt;
    while (this.burnT >= 0.25) {
      this.burnT -= 0.25;
      for (const f of this.fighters) {
        if (f.side !== -1 || f.state === 'gone' || Math.abs(f.x - p.x) > RULES.pillarHalf + 0.6) continue;
        this.hurt(f, this.pillarStats.burn * 0.25, 'pillar');
      }
    }
    if (p.t <= 0) {
      this.pillar = null;
      this.events.push({ type: 'pillarEnd' });
    }
  }

  // ── the waves ───────────────────────────────────────────────────
  private waves(dt: number, rest: boolean): void {
    const R = RULES;
    if (this.bossBattle && !this.bossOut && this.t >= R.bossAt) {
      this.bossOut = true;
      this.spawn(this.bossKind);
    }
    this.waveT -= dt / (rest ? R.restGap : 1) / (this.boss && this.boss.state !== 'gone' ? R.bossGap : 1);
    const local = this.bossBattle ? R.bossWaves : this.local;
    if (!this.nextWave && this.waveT <= SOON) {
      // the darkness answers the host: a larger host on the road meets larger waves
      const k = Math.min(R.waveMax, 1 + Math.floor(this.t / R.growSec) + Math.floor(local / R.growBattles) + Math.floor(this.count(1) / R.answer));
      this.nextWave = this.pick(k, (this.waveN + 1) % 4 === 0);
      this.events.push({ type: 'waveSoon', kinds: this.nextWave.slice() });
    }
    if (this.waveT <= 0) {
      this.waveT += Math.max(R.gapMin, R.gap - R.gapPerBattle * (local + this.chapter * 2));
      this.waveN++;
      this.queue.push(...(this.nextWave ?? this.pick(1, false)));
      this.nextWave = null;
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.queue.length) {
      this.spawn(this.queue.shift()!);
      this.spawnT = R.spawnGap;
    }
  }

  /** The kinds that march by this battle. */
  get pool(): WaveId[] { return WAVE_IDS.filter(id => DEMONS[id].from <= this.battle); }

  /** `k` demons for a wave: the kinds that march by this battle, weighted; a heavy wave brings a brute. */
  private pick(k: number, heavy: boolean): WaveId[] {
    const pool = this.pool;
    const out: WaveId[] = [];
    if (heavy && pool.includes('bestia')) out.push('bestia');
    const sum = pool.reduce((s, id) => s + WEIGHT[id], 0);
    // a wave leans on one kind, so its answer is readable: half of it (at least) is the lead kind
    let lead: WaveId = pool[0];
    let r0 = this.rng() * sum;
    for (const p of pool) {
      r0 -= WEIGHT[p];
      if (r0 <= 0) { lead = p; break; }
    }
    if (lead === 'bestia') lead = 'cien';
    while (out.length < k) {
      let id: WaveId = lead;
      if (out.length % 2 === 1) {
        let r = this.rng() * sum;
        for (const p of pool) {
          r -= WEIGHT[p];
          if (r <= 0) { id = p; break; }
        }
      }
      // brutes stay rare: never more than one in a wave
      if (id === 'bestia' && out.includes('bestia')) id = 'cien';
      out.push(id);
    }
    return out;
  }

  // ── the boss's special ──────────────────────────────────────────
  private specials(dt: number): void {
    const b = this.boss;
    if (!b || b.state === 'gone') {
      this.special = null;
      return;
    }
    const R = RULES, sp = this.special;
    if (!sp) {
      this.specialT -= dt;
      if (this.specialT > 0) return;
      const kind = b.kind === 'kolos' ? 'stomp' : b.kind === 'szarancza' ? 'swarm' : 'breath';
      const reach = kind === 'stomp' ? R.stompReach : kind === 'breath' ? R.breathReach : 0;
      const s: Special = { kind, x0: b.x - reach, x1: b.x, t: R.specialWarn, warn: R.specialWarn };
      this.special = s;
      this.events.push({ type: 'warn', special: s });
      return;
    }
    sp.t -= dt;
    if (sp.t > 0) return;
    this.special = null;
    this.specialT = R.specialEvery;
    // the pillar between the boss and the host takes the blow: nothing behind it is touched
    const p = this.pillar;
    const blocked = !!p && p.x <= b.x && p.x >= sp.x0 - 0.5;
    const x0 = blocked ? p!.x : sp.x0;
    let hit = 0;
    if (sp.kind === 'swarm') {
      for (let i = 0; i < R.swarmN; i++) this.spawn('skrzydlak', b.x - 0.3 - i * 0.4);
      hit = R.swarmN;
    } else {
      const dmg = (sp.kind === 'stomp' ? R.stompDmg : R.breathDmg) * this.demonK;
      for (const f of this.fighters) {
        if (f.side !== 1 || f.state === 'gone' || f.x < x0 || f.x > sp.x1 + 0.5) continue;
        if (sp.kind === 'stomp' && f.fly) continue;
        hit++;
        if (sp.kind === 'stomp') f.knock = R.stompPush;
        this.hurt(f, dmg, 'special');
      }
    }
    this.events.push({ type: 'special', special: { ...sp, x0 }, hit, blocked });
  }

  // ── the fighting ────────────────────────────────────────────────
  /** May `a` strike `b`?  A ground blade cannot reach a flier; bows, fire and fliers reach all. */
  private canHit(a: Fighter, b: Fighter): boolean {
    return b.state !== 'gone' && b.side !== a.side && (!b.fly || a.fly || a.ranged);
  }

  private fight(dt: number, rest: boolean): void {
    const road = this.road, p = this.pillar;
    for (const a of this.fighters) {
      if (a.state === 'gone') continue;
      a.cd = Math.max(0, a.cd - dt);
      if (a.knock > 0) {
        // thrown back toward its own gate
        const d = Math.min(a.knock, 9 * dt);
        a.knock -= d;
        a.x = Math.max(0.3, Math.min(road - 0.3, a.x - a.side * d));
        continue;
      }
      const reach = a.range - a.lane * Math.min(0.35, a.range * 0.3);
      // the nearest foe ahead within reach
      let target: Fighter | null = null, best = Infinity;
      for (const b of this.fighters) {
        if (!this.canHit(a, b)) continue;
        const d = (b.x - a.x) * a.side;
        if (d < -0.25 || d > reach + 0.05) continue;
        if (d < best) { best = d; target = b; }
      }
      const gateX = a.side === 1 ? road : 0;
      const toGate = (gateX - a.x) * a.side;
      if (target) {
        a.state = 'fight';
        if (a.cd <= 0) this.strike(a, target);
      } else if (toGate <= reach) {
        a.state = 'fight';
        if (a.cd <= 0) this.strikeGate(a);
      } else {
        const slow = a.side === -1 && rest ? RULES.restWalk : 1;
        let nx = a.x + a.side * a.speed * slow * dt;
        // the pillar of cloud: no shade passes it
        const wall = p ? p.x + RULES.pillarHalf : -1;
        if (a.side === -1 && p && a.x >= wall - 0.05 && nx < wall) {
          nx = wall;
          a.state = 'fight';
        } else a.state = 'walk';
        a.x = Math.max(0.3, Math.min(road - 0.3, nx));
      }
    }
  }

  /** The multiplier of a strike from `a` on `b`: a bane doubles it, a shield-bearer turns darts aside. */
  private mult(a: Fighter, b: Fighter): number {
    let k = 1;
    if (a.side === 1) {
      const bane = BANE[a.kind as HostId];
      if (bane && bane === b.kind) k *= RULES.bane;
      else if (a.kind === 'archaniol' && isBoss(b.kind)) k *= RULES.baneBoss;
    } else {
      const banes = DEMON_BANE[a.kind as WaveId];
      if (banes && banes.includes(b.kind as HostId)) k *= RULES.demonBane;
      if (a.ranged && b.kind === 'tarczownik') k *= RULES.shieldRanged;
    }
    return k;
  }

  private strike(a: Fighter, b: Fighter): void {
    a.cd = a.rate;
    a.atkT = 0;
    const k = this.mult(a, b);
    const bane = a.side === 1 && k > 1;
    if (bane) this.banes++;
    this.events.push({ type: 'strike', id: a.id, side: a.side, kind: a.kind, x: a.x, tx: b.x, ty: 'foe', ranged: a.ranged, aoe: a.aoe, flyTarget: b.fly, bane });
    const by: Cause = a.side === 1 ? 'host' : 'demon';
    if (a.aoe > 0) {
      for (const c of this.fighters) {
        if (c.state === 'gone' || c.side === a.side || Math.abs(c.x - b.x) > a.aoe) continue;
        if (c.fly && !a.fly && !a.ranged) continue;
        this.hurt(c, a.dmg * this.mult(a, c), by);
      }
    } else this.hurt(b, a.dmg * k, by);
  }

  private strikeGate(a: Fighter): void {
    a.cd = a.rate;
    a.atkT = 0;
    const gx = a.side === 1 ? this.road : 0;
    this.events.push({ type: 'strike', id: a.id, side: a.side, kind: a.kind, x: a.x, tx: gx, ty: 'gate', ranged: a.ranged, aoe: 0, flyTarget: false, bane: false });
    if (a.side === 1) {
      if (this.bossBattle) {
        this.events.push({ type: 'sealed', x: gx });
        return;
      }
      const before = this.ash;
      this.ash = Math.max(0, this.ash - a.dmg);
      this.events.push({ type: 'gateHit', side: -1, dmg: a.dmg });
      // the cracking gate pours out a defence
      const step = RULES.ashSurge * this.ashMax;
      if (this.ash > 0 && Math.floor((this.ashMax - this.ash) / step) > Math.floor((this.ashMax - before) / step)) {
        this.surges++;
        this.queue.push(...this.pick(3 + Math.floor(this.local / RULES.growBattles) + this.chapter, this.surges % 2 === 0));
        this.events.push({ type: 'surge' });
      }
    } else {
      this.walls = Math.max(0, this.walls - a.dmg);
      this.events.push({ type: 'gateHit', side: 1, dmg: a.dmg });
    }
  }

  /** Damage through armour and the shield of light; a fighter at 0 hp is beaten (a demon) or falls back into light (an angel). */
  private hurt(f: Fighter, raw: number, by: Cause): void {
    if (f.state === 'gone') return;
    let dmg = raw * (1 - f.armor);
    let shielded = false;
    if (f.shield > 0) {
      const take = Math.min(f.shield, dmg);
      f.shield -= take;
      dmg -= take;
      shielded = true;
    }
    f.hp -= dmg;
    f.hitT = 0;
    this.events.push({ type: 'hurt', id: f.id, side: f.side, x: f.x, dmg: raw, shield: shielded });
    if (f.hp <= 0) {
      f.hp = 0;
      f.state = 'gone';
      f.goneT = 0;
      if (f.side === -1) {
        this.beaten++;
        this.gold += f.gold;
        this.events.push({ type: 'beaten', id: f.id, kind: f.kind as DemonId, x: f.x, fly: f.fly, gold: f.gold, by });
      } else this.events.push({ type: 'fallen', id: f.id, kind: f.kind as HostId, x: f.x, fly: f.fly });
    }
  }

  /** The gate's beam: the nearest demon within its reach (fliers too). */
  private beamTick(dt: number): void {
    this.beamCd -= dt;
    if (this.beamCd > 0) return;
    let target: Fighter | null = null;
    for (const f of this.fighters) {
      if (f.side !== -1 || f.state === 'gone' || f.x > this.beam.range) continue;
      if (!target || f.x < target.x) target = f;
    }
    if (!target) {
      this.beamCd = 0.1;
      return;
    }
    this.beamCd = this.beam.rate;
    this.events.push({ type: 'beam', x: target.x, fly: target.fly });
    this.hurt(target, this.beam.dmg, 'beam');
  }

  /** The gate of ash's embers: the nearest angel within its reach (sealed in a boss battle: the boss fights for it). */
  private emberTick(dt: number): void {
    this.emberCd -= dt;
    if (this.emberCd > 0 || this.bossBattle) return;
    let target: Fighter | null = null;
    for (const f of this.fighters) {
      if (f.side !== 1 || f.state === 'gone' || f.x < this.road - RULES.emberRange) continue;
      if (!target || f.x > target.x) target = f;
    }
    if (!target) {
      this.emberCd = 0.1;
      return;
    }
    this.emberCd = RULES.emberRate;
    this.events.push({ type: 'ember', x: target.x, fly: target.fly });
    const k = target.kind === 'tarczownik' ? RULES.shieldRanged : 1;
    this.hurt(target, (RULES.ember + RULES.emberPerBattle * this.local) * (1 + RULES.demonPerChapter * this.chapter) * k, 'ember');
  }

  private fade(dt: number): void {
    let n = 0;
    for (const f of this.fighters) {
      if (f.state === 'gone') f.goneT += dt;
      if (f.state !== 'gone' || f.goneT < RULES.fade) this.fighters[n++] = f;
    }
    this.fighters.length = n;
  }

  /** Light from outside the flow (a blind block's payment, a passed rest): may overfill the bar a little. */
  addLight(n: number): void {
    if (n > 0) this.light = Math.min(this.lightMax * RULES.overfill, this.light + n);
  }

  /** A passed Cisza: the walls mend at once by a share. */
  mendWalls(share: number): void {
    if (!this.outcome) this.walls = Math.min(this.wallsMax, this.walls + share * this.wallsMax);
  }

  /** Living fighters of a side. */
  count(side: Side): number {
    let n = 0;
    for (const f of this.fighters) if (f.side === side && f.state !== 'gone') n++;
    return n;
  }

  take(): BattleEvent[] {
    if (!this.events.length) return [];
    const out = this.events.slice();
    this.events.length = 0;
    return out;
  }
}
