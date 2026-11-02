/**
 * One battle of Zastępy on its road, without the DOM, the canvas or the band (so the tests can play
 * whole battles headless): the gate of light at x = 0, the gate of ash at x = road; the light that
 * flows into the bar and pays for the cards; the host sent out of the gate; the demons' waves out
 * of the gate of ash; the fighters walking toward each other and striking on their own; the gate's
 * beam; the trumpet's shockwave; the shields and the mending of Cisza.  What the band changes
 * comes in from the session (sim.ts) as plain numbers: the flow's multiplier and the calm.
 *
 * A battle ends when the gate of ash falls (in the Smok's battle: when the Smok falls), or when the
 * gate of light's walls are down — then the host withdraws and the session starts the battle again
 * with stronger walls.  Nothing is lost: the gold of the battle is kept.
 */
import { mulberry32 } from '../../core/random';
import { beamFor, circleOf, flowFor, isSmok, lightMaxFor, trumpetDmgFor, wallsFor } from './meta';
import { DEMONS, DEMON_IDS, HOST, RULES, type DemonId, type HostId, type Stats } from './rules';

export type Side = 1 | -1;
export type Kind = HostId | DemonId;

export interface Fighter extends Stats {
  id: number;
  /** 1: the host (walks right), −1: a demon (walks left) */
  side: Side;
  kind: Kind;
  x: number;
  /** depth on the road 0..1 (the picture's lane), and how far short of its reach it stops (m) */
  lane: number;
  maxHp: number;
  shield: number;
  /** seconds to its next strike, since its last strike, since it was last hurt */
  cd: number;
  atkT: number;
  hitT: number;
  /** walking, fighting (a foe or a gate in reach), gone (dissolving for RULES.fade) */
  state: 'walk' | 'fight' | 'gone';
  goneT: number;
  /** a knock-back in progress (m left) */
  knock: number;
  /** the gold it pays when beaten (demons) */
  gold: number;
}

export type BattleEvent =
  | { type: 'sent'; id: number; kind: HostId }
  | { type: 'spawn'; id: number; kind: DemonId }
  | { type: 'strike'; id: number; side: Side; kind: Kind; x: number; tx: number; ty: 'foe' | 'gate'; ranged: boolean; aoe: number; flyTarget: boolean }
  | { type: 'hurt'; id: number; side: Side; x: number; dmg: number; shield: boolean }
  | { type: 'beaten'; id: number; kind: DemonId; x: number; fly: boolean; gold: number }
  | { type: 'fallen'; id: number; kind: HostId; x: number; fly: boolean }
  | { type: 'beam'; x: number; fly: boolean }
  | { type: 'ember'; x: number; fly: boolean }
  | { type: 'gateHit'; side: Side; dmg: number }
  | { type: 'sealed'; x: number }
  | { type: 'surge' }
  | { type: 'smok'; id: number }
  | { type: 'trumpet'; hit: number }
  | { type: 'won' }
  | { type: 'lost' };

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
  /** the battle number (0-based, all circles) */
  battle: number;
  gate: number;
  units: Readonly<Record<HostId, number>>;
  /** withdrawals in this battle so far: each makes the walls stronger for the next try */
  retreats: number;
  seed: number;
}

const WEIGHT: Readonly<Record<DemonId, number>> = { chochlik: 3, cien: 3, ogar: 2, skrzydlak: 2, bestia: 1, smok: 0 };

export class Battle {
  readonly battle: number;
  readonly circle: number;
  readonly local: number;
  readonly smokBattle: boolean;
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
  private queue: DemonId[] = [];
  private spawnT = 0;
  private surges = 0;
  smok: Fighter | null = null;
  private smokOut = false;
  outcome: 'won' | 'lost' | null = null;
  /** demons beaten and gold earned in this battle */
  beaten = 0;
  gold = 0;

  constructor(init: BattleInit) {
    this.battle = init.battle;
    const c = circleOf(init.battle);
    this.circle = c.circle;
    this.local = c.local;
    this.smokBattle = isSmok(init.battle);
    this.gate = init.gate;
    this.levels = init.units;
    this.rng = mulberry32((init.seed ^ (init.battle * 0x9e3779b1)) >>> 0);
    this.lightMax = lightMaxFor(init.gate);
    this.flowBase = flowFor(init.gate);
    this.wallsMax = this.walls = wallsFor(init.gate, init.retreats);
    this.ashMax = this.ash = Math.round((RULES.ash + RULES.ashPerBattle * this.local) * (1 + RULES.ashCircle * this.circle));
    this.beam = beamFor(init.gate);
    this.cool = { straznik: 0, lucznik: 0, tarczownik: 0, jezdziec: 0, serafin: 0, archaniol: 0 };
  }

  // ── the cards ───────────────────────────────────────────────────
  /** The cards open at this gate level, in order. */
  get cards(): HostId[] { return (Object.keys(HOST) as HostId[]).filter(id => HOST[id].gate <= this.gate); }

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
    const lv = this.levels[id] ?? 1, k = 1 + RULES.unitPerLevel * (lv - 1);
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

  private spawn(id: DemonId): void {
    const st = DEMONS[id];
    const k = (1 + RULES.demonPerBattle * (this.smokBattle ? RULES.smokWaves : this.local)) * (1 + RULES.demonPerCircle * this.circle);
    const f = this.make(-1, id, st, this.road - 0.4, k, st.gold);
    if (id === 'smok') {
      this.smok = f;
      f.lane = 0.5;
      this.events.push({ type: 'smok', id: f.id });
    } else this.events.push({ type: 'spawn', id: f.id, kind: id });
  }

  // ── the trumpet ─────────────────────────────────────────────────
  /** The trumpet's shockwave rolls down the whole road: every demon is wounded and thrown back (the Smok stands). */
  trumpet(): number {
    if (this.outcome) return 0;
    const dmg = trumpetDmgFor(this.gate);
    let hit = 0;
    for (const f of this.fighters) {
      if (f.side !== -1 || f.state === 'gone') continue;
      hit++;
      if (f.kind !== 'smok') f.knock = RULES.trumpetPush;
      this.hurt(f, dmg, 'trumpet');
    }
    this.events.push({ type: 'trumpet', hit });
    return hit;
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
    for (const id of Object.keys(this.cool) as HostId[]) this.cool[id] = Math.max(0, this.cool[id] - dt);
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
    this.waves(dt, ctl.rest);
    this.fight(dt, ctl.rest);
    this.beamTick(dt);
    this.emberTick(dt);
    this.fade(dt);
    if (this.outcome === null) {
      if (this.smokBattle ? this.smokOut && this.smok !== null && this.smok.state === 'gone' : this.ash <= 0) this.end('won');
      else if (this.walls <= 0) this.end('lost');
    }
  }

  private end(o: 'won' | 'lost'): void {
    this.outcome = o;
    if (o === 'won') {
      this.ash = 0;
      // the demons left on the road dissolve with their gate (they pay nothing more)
      for (const f of this.fighters) if (f.side === -1 && f.state !== 'gone') { f.state = 'gone'; f.goneT = 0; f.gold = 0; }
    } else this.walls = 0;
    this.events.push({ type: o });
  }

  // ── the waves ───────────────────────────────────────────────────
  private waves(dt: number, rest: boolean): void {
    const R = RULES;
    if (this.smokBattle && !this.smokOut && this.t >= R.smokAt) {
      this.smokOut = true;
      this.spawn('smok');
    }
    this.waveT -= dt / (rest ? R.restGap : 1);
    if (this.waveT <= 0) {
      const local = this.smokBattle ? R.smokWaves : this.local;
      this.waveT += Math.max(R.gapMin, R.gap - R.gapPerBattle * local);
      this.waveN++;
      // the darkness answers the host: a larger host on the road meets larger waves
      const k = Math.min(R.waveMax, 1 + Math.floor(this.t / R.growSec) + Math.floor(local / R.growBattles) + Math.floor(this.count(1) / R.answer));
      this.queue.push(...this.pick(k, local, this.waveN % 4 === 0));
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.queue.length) {
      this.spawn(this.queue.shift()!);
      this.spawnT = R.spawnGap;
    }
  }

  /** `k` demons for a wave: the kinds that march by this battle, weighted; a heavy wave brings a brute. */
  private pick(k: number, local: number, heavy: boolean): DemonId[] {
    const pool = DEMON_IDS.filter(id => id !== 'smok' && DEMONS[id].from <= local);
    const out: DemonId[] = [];
    if (heavy && pool.includes('bestia')) out.push('bestia');
    const sum = pool.reduce((s, id) => s + WEIGHT[id], 0);
    while (out.length < k) {
      let r = this.rng() * sum;
      let id: DemonId = pool[0];
      for (const p of pool) {
        r -= WEIGHT[p];
        if (r <= 0) { id = p; break; }
      }
      // brutes stay rare: never more than one in a wave
      if (id === 'bestia' && out.includes('bestia')) id = 'cien';
      out.push(id);
    }
    return out;
  }

  // ── the fighting ────────────────────────────────────────────────
  /** May `a` strike `b`?  A ground blade cannot reach a flier; bows, fire and fliers reach all. */
  private canHit(a: Fighter, b: Fighter): boolean {
    return b.state !== 'gone' && b.side !== a.side && (!b.fly || a.fly || a.ranged);
  }

  private fight(dt: number, rest: boolean): void {
    const road = this.road;
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
        a.state = 'walk';
        // ground blades do not walk into a foe they cannot reach (a flier overhead does not block)
        const slow = a.side === -1 && rest ? RULES.restWalk : 1;
        a.x += a.side * a.speed * slow * dt;
        a.x = Math.max(0.3, Math.min(road - 0.3, a.x));
      }
    }
  }

  private strike(a: Fighter, b: Fighter): void {
    a.cd = a.rate;
    a.atkT = 0;
    this.events.push({ type: 'strike', id: a.id, side: a.side, kind: a.kind, x: a.x, tx: b.x, ty: 'foe', ranged: a.ranged, aoe: a.aoe, flyTarget: b.fly });
    if (a.aoe > 0) {
      for (const c of this.fighters) {
        if (c.state === 'gone' || c.side === a.side || Math.abs(c.x - b.x) > a.aoe) continue;
        this.hurt(c, a.dmg, a.side === 1 ? 'host' : 'demon');
      }
    } else this.hurt(b, a.dmg, a.side === 1 ? 'host' : 'demon');
  }

  private strikeGate(a: Fighter): void {
    a.cd = a.rate;
    a.atkT = 0;
    const gx = a.side === 1 ? this.road : 0;
    this.events.push({ type: 'strike', id: a.id, side: a.side, kind: a.kind, x: a.x, tx: gx, ty: 'gate', ranged: a.ranged, aoe: 0, flyTarget: false });
    if (a.side === 1) {
      if (this.smokBattle) {
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
        this.queue.push(...this.pick(3 + Math.floor(this.local / RULES.growBattles), this.local, this.surges % 2 === 0));
        this.events.push({ type: 'surge' });
      }
    } else {
      this.walls = Math.max(0, this.walls - a.dmg);
      this.events.push({ type: 'gateHit', side: 1, dmg: a.dmg });
    }
  }

  /** Damage through armour and the shield of light; a fighter at 0 hp is beaten (a demon) or falls back into light (an angel). */
  private hurt(f: Fighter, raw: number, _by: 'host' | 'demon' | 'beam' | 'trumpet' | 'ember'): void {
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
        this.events.push({ type: 'beaten', id: f.id, kind: f.kind as DemonId, x: f.x, fly: f.fly, gold: f.gold });
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

  /** The gate of ash's embers: the nearest angel within its reach (sealed in the Smok's battle: the Smok fights for it). */
  private emberTick(dt: number): void {
    this.emberCd -= dt;
    if (this.emberCd > 0 || this.smokBattle) return;
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
    this.hurt(target, (RULES.ember + RULES.emberPerBattle * this.local) * (1 + RULES.demonPerCircle * this.circle), 'ember');
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
