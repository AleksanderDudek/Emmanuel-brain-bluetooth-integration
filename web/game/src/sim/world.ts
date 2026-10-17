/**
 * One room of a run: the angel, the shadows (traumas), the Word, light seeds,
 * grace, digestion, gifts and the stronghold.  Pure simulation — no DOM, no
 * audio; it emits GameEvents and is stepped at a fixed 60 Hz by the game loop.
 *
 * Core rule: the Word only WEAKENS a shadow; healing happens when the angel
 * eats it and digests it — twice as fast when standing still (Ps 46,11).
 */
import type { ChapterDef, TraumaDef, TraumaKind } from '../types';
import type { GameEvent } from './events';
import { blockedCells, computeField, fieldDirection, GH, GW } from './flow';
import { clamp, dist2, lineOfSight, pointInRect, pushOut, type Rect } from './geom';
import { DOOR, ROOM_H, ROOM_W, START, type Point, type RoomKind, type RoomLayout } from './room';
import { Rng } from './rng';
import type { Run, RunStats } from './run';

// ─── tuning ──────────────────────────────────────────────────────────
export const PLAYER_R = 0.36;
export const PLAYER_SPEED = 4.2;
const STILL_DELAY = 0.12;
const FIRE_RATE = 2.2;
const WORD_DMG = 10;
const WORD_SPEED = 11;
export const WEAK_TIME = 5;
export const GRACE_TIME = 6;
export const DIGEST_TIME = 2;
export const STOMACH = 3;
const DEVOUR_PAD = 0.15;
const IFRAMES = 1.2;
const SEED_PICK = 0.3;
const RESCUE_TIME = 40;
/** share of light seeds needed to open the door (with the shadows digested) */
export const SEED_GOAL = 0.7;
const AURA_BASE = 1.6;
export const SABBATH_REST = 20;
/** after the stronghold is eaten: the chapter ends once it is digested, at the latest after BOSS_DIGEST_CAP s */
const BOSS_END_DELAY = 1.6;
const BOSS_DIGEST_CAP = 8;

export type TraumaState = 'spawn' | 'normal' | 'weak' | 'fright';

export interface Trauma {
  id: number;
  kind: TraumaKind;
  def: TraumaDef;
  x: number; y: number; vx: number; vy: number; r: number;
  hp: number; maxHp: number; speed: number;
  state: TraumaState;
  t: number;
  stun: number;
  dashT: number; dashCd: number; dashX: number; dashY: number;
  blinkCd: number; shootCd: number;
  child: boolean;
  phase: number;
}

export interface Boss {
  name: string; lie: string;
  x: number; y: number; vx: number; vy: number; r: number;
  hp: number; maxHp: number; phase: number;
  arrowCd: number; summonCd: number; chargeCd: number; chargeT: number; telegraphT: number; chargeX: number; chargeY: number;
  revealT: number; revealCd: number; stun: number;
  cracked: boolean; eaten: boolean;
}

export interface Shot { x: number; y: number; vx: number; vy: number; r: number; dmg: number; pierce: number; life: number; kind: 'word' | 'dove' | 'stone' | 'tree'; hit: number[] }
export interface Arrow { x: number; y: number; vx: number; vy: number; life: number }
export interface Seed extends Point { alive: boolean }
export interface Fragment extends Point { alive: boolean; chained: boolean; progress: number }
export interface Tree extends Point { cd: number; life: number }
export interface Meal { kind: TraumaKind | 'boss'; p: number; light: number }

export interface Player {
  x: number; y: number; vx: number; vy: number; r: number;
  iFrames: number; still: number; moving: boolean;
  fx: number; fy: number; fireCd: number; kx: number; ky: number;
}

/** Signals from outside the room (the band or its stand-in), refreshed every frame. */
export interface External {
  /** 0..1 — peace (balance with the band, stillness without) → aura size */
  peace: number;
  /** Spirit meter points per second */
  spiritRate: number;
  /** hearts per second restored while resting in the Sabbath room */
  restRate: number;
  /** true when a revelation may strike the stronghold (sustained balance / stillness) */
  revelation: boolean;
}

export type WorldState = 'playing' | 'levelup' | 'chapel' | 'fallen' | 'exit' | 'bossDone';

export interface WorldOptions {
  run: Run;
  layout: RoomLayout;
  defs: Record<TraumaKind, TraumaDef>;
  seed: number;
}

let nextId = 1;

export class World {
  readonly run: Run;
  readonly chapter: ChapterDef;
  readonly layout: RoomLayout;
  readonly kind: RoomKind;
  readonly walls: Rect[];
  readonly defs: Record<TraumaKind, TraumaDef>;
  readonly rng: Rng;
  readonly blocked: Uint8Array;
  private readonly fieldPlayer = new Float32Array(GW * GH);
  private readonly fieldAmbush = new Float32Array(GW * GH);
  private fieldT = 0;

  state: WorldState = 'playing';
  time = 0;
  readonly player: Player;
  traumas: Trauma[] = [];
  boss: Boss | null = null;
  shots: Shot[] = [];
  arrows: Arrow[] = [];
  seeds: Seed[];
  graces: Seed[];
  fragments: Fragment[];
  trees: Tree[] = [];
  stomach: Meal[] = [];
  events: GameEvent[] = [];

  graceT = 0;
  combo = 0;
  freezeT = 0;
  pentecostT = 0;
  peace = 0;
  auraR = 0;
  doorOpen = false;
  seedsTotal: number;
  seedsTaken = 0;
  private seedsSinceTree = 0;
  private waves: TraumaKind[][] = [];
  private waveIndex = 0;
  private waveT = 0;
  private rescueT = 0;
  restTime = 0;
  private restHeart = 0;
  sabbathBlessed = false;
  chapelDone = false;
  /** seconds since the stronghold was eaten (-1: not yet) */
  private bossEatenT = -1;
  private fullHintT = 0;
  private readonly cd: Record<string, number> = {};
  private ext: External = { peace: 0, spiritRate: 0, restRate: 0, revelation: false };
  /** the run as it was on entering the room, restored when the room starts over after a fall */
  private readonly entry: { light: number; stats: RunStats };

  constructor(o: WorldOptions) {
    this.run = o.run;
    this.entry = { light: o.run.light, stats: { ...o.run.stats, digested: { ...o.run.stats.digested } } };
    this.chapter = o.run.chapter;
    this.layout = o.layout;
    this.kind = o.layout.kind;
    this.walls = o.layout.walls;
    this.defs = o.defs;
    this.rng = new Rng(o.seed);
    this.blocked = blockedCells(this.walls);
    this.player = { x: START.x, y: START.y, vx: 0, vy: 0, r: PLAYER_R, iFrames: 1, still: 0, moving: false, fx: 0, fy: -1, fireCd: 0.4, kx: 0, ky: 0 };
    this.seeds = o.layout.seeds.map(p => ({ ...p, alive: true }));
    this.graces = o.layout.graces.map(p => ({ ...p, alive: true }));
    this.seedsTotal = this.seeds.length;
    const nFrag = this.kind === 'rescue' ? 3 : this.kind === 'battle' ? 1 : 0;
    this.fragments = o.layout.fragmentSpots.slice(0, nFrag).map(p => ({ ...p, alive: true, chained: this.kind === 'rescue', progress: 0 }));
    // a fragment replaces the seed under it
    for (const f of this.fragments) {
      const s = this.seeds.find(q => q.x === f.x && q.y === f.y);
      if (s) { s.alive = false; this.seedsTotal--; }
    }
    this.run.stats.fragmentsTotal += this.fragments.length;
    this.planWaves();
    if (this.kind === 'boss') this.spawnBoss();
    if (this.kind === 'sabbath' || this.kind === 'chapel') this.doorOpen = true;
  }

  // ─── setup ──────────────────────────────────────────────────────
  private planWaves(): void {
    if (this.kind !== 'battle' && this.kind !== 'rescue') return;
    const d = this.run.difficulty;
    const total = Math.min(16, Math.round(4 + d * 0.9 + this.run.roomIndex * 0.6));
    const kinds = this.chapter.traumas;
    const weights = kinds.map((_, i) => Math.max(1, 4 - i));
    const pick = (): TraumaKind => {
      let x = this.rng.next() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < kinds.length; i++) if ((x -= weights[i]) < 0) return kinds[i];
      return kinds[0];
    };
    const all = Array.from({ length: total }, pick);
    const n = this.kind === 'rescue' ? 6 : 3;
    for (let i = 0; i < n; i++) this.waves.push(all.filter((_, j) => j % n === i));
    this.waveT = 0.6;
  }

  private spawnBoss(): void {
    const b = this.chapter.boss;
    this.boss = {
      name: b.name, lie: b.lie, x: ROOM_W / 2, y: 3.6, vx: 0, vy: 0, r: 1.0,
      hp: b.hp, maxHp: b.hp, phase: 1, arrowCd: 2.5, summonCd: 6, chargeCd: 8, chargeT: 0, telegraphT: 0,
      chargeX: 0, chargeY: 0, revealT: 0, revealCd: 4, stun: 0, cracked: false, eaten: false,
    };
  }

  spawnTrauma(kind: TraumaKind, x: number, y: number, child = false): Trauma {
    const def = this.defs[kind];
    const d = this.run.difficulty;
    const love = 1 - 0.12 * this.run.giftLevel('milosc');
    const maxHp = def.hp * (1 + 0.12 * d) * love * (child ? 0.4 : 1);
    const r = child ? 0.27 : def.behavior === 'tank' ? 0.46 : 0.36;
    const t: Trauma = {
      id: nextId++, kind, def, x, y, vx: 0, vy: 0, r, hp: maxHp, maxHp, speed: def.speed * (1 + 0.03 * d) * (child ? 1.15 : 1),
      state: child ? 'weak' : 'spawn', t: child ? WEAK_TIME * 0.8 : 0.8, stun: 0,
      dashT: 0, dashCd: this.rng.range(1.5, 3.5), dashX: 0, dashY: 0,
      blinkCd: this.rng.range(3, 5), shootCd: this.rng.range(1.5, 3), child, phase: this.rng.range(0, 6.28),
    };
    this.traumas.push(t);
    if (!child) this.emit({ type: 'spawn', x, y });
    return t;
  }

  // ─── step ───────────────────────────────────────────────────────
  step(dt: number, mx: number, my: number, ext: External): void {
    if (this.state !== 'playing') return;
    this.ext = ext;
    this.time += dt;
    this.updatePlayer(dt, mx, my);
    this.peace = ext.peace;
    this.auraR = clamp(ext.peace, 0, 1) * (AURA_BASE + this.run.mods.auraBonus + this.run.auraBlessing);
    this.updateGrace(dt);
    this.updateSpawns(dt);
    this.fieldT -= dt;
    if (this.fieldT <= 0) this.updateFields();
    if (this.freezeT > 0) this.freezeT -= dt;
    this.updateTraumas(dt);
    if (this.boss) this.updateBoss(dt);
    this.updateAttacks(dt);
    this.updateShots(dt);
    this.updateArrows(dt);
    this.updatePickups(dt);
    this.updateDevour();
    this.updateDigestion(dt);
    this.updateRoomGoal(dt);
    this.run.spirit = Math.min(100, this.run.spirit + ext.spiritRate * this.run.mods.spiritMult * dt);
    if (this.run.pendingLevelUps > 0 && this.state === 'playing') this.state = 'levelup';
  }

  private emit(e: GameEvent): void { this.events.push(e); }

  // ─── player ─────────────────────────────────────────────────────
  get stomachCap(): number { return STOMACH + this.run.giftLevel('serce'); }

  private updatePlayer(dt: number, mx: number, my: number): void {
    const p = this.player;
    const mag = Math.hypot(mx, my);
    p.moving = mag > 0.12;
    if (p.moving) {
      p.still = 0;
      p.fx = mx / mag; p.fy = my / mag;
    } else {
      p.still += dt;
    }
    const speed = PLAYER_SPEED * (1 + 0.1 * this.run.giftLevel('sandaly'));
    const k = 1 - Math.exp(-dt * 14);
    p.vx += ((p.moving ? mx * speed : 0) - p.vx) * k;
    p.vy += ((p.moving ? my * speed : 0) - p.vy) * k;
    // knockback decays on its own
    p.kx *= Math.exp(-dt * 8);
    p.ky *= Math.exp(-dt * 8);
    this.moveCircle(p, (p.vx + p.kx) * dt, (p.vy + p.ky) * dt);
    if (p.iFrames > 0) p.iFrames -= dt;
  }

  private moveCircle(e: { x: number; y: number; r: number }, dx: number, dy: number): void {
    e.x += dx;
    e.y += dy;
    for (let it = 0; it < 2; it++) {
      for (const w of this.walls) {
        const q = pushOut(e.x, e.y, e.r, w);
        if (q) { e.x = q[0]; e.y = q[1]; }
      }
    }
    e.x = clamp(e.x, e.r, ROOM_W - e.r);
    e.y = clamp(e.y, e.r, ROOM_H - e.r);
  }

  private hurt(sx: number, sy: number): void {
    const p = this.player;
    if (p.iFrames > 0 || this.state !== 'playing' || this.boss?.eaten) return;   // nothing hurts once the stronghold has fallen
    const dx = p.x - sx, dy = p.y - sy, l = Math.hypot(dx, dy) || 1;
    if (this.rng.chance(0.15 * this.run.giftLevel('pancerz'))) {
      p.iFrames = 0.6;
      this.emit({ type: 'block', x: p.x, y: p.y });
      return;
    }
    this.run.hearts--;
    p.iFrames = IFRAMES;
    p.kx = (dx / l) * 6;
    p.ky = (dy / l) * 6;
    this.emit({ type: 'hurt', x: p.x, y: p.y });
    const calm = this.run.giftLevel('ucisz');
    if (calm) {
      this.freezeT = 1.5 + 0.5 * (calm - 1);
      this.emit({ type: 'freeze' });
    }
    if (this.run.hearts <= 0) {
      if (this.run.giftLevel('helm') && !this.run.helmUsed) {
        this.run.helmUsed = true;
        this.run.hearts = 2;
        p.iFrames = 2;
        this.emit({ type: 'revive' });
      } else {
        this.run.hearts = 0;
        this.run.stats.falls++;
        this.state = 'fallen';
        this.emit({ type: 'fall' });
      }
    }
  }

  // ─── grace (Pac-Man's power pellet) ─────────────────────────────
  private updateGrace(dt: number): void {
    if (this.graceT <= 0) return;
    this.graceT -= dt;
    if (this.graceT <= 0) {
      this.graceT = 0;
      for (const t of this.traumas) {
        if (t.state !== 'fright') continue;
        if (t.hp <= 0) { t.state = 'weak'; t.t = 2; } else t.state = 'normal';
      }
      this.emit({ type: 'graceEnd' });
    }
  }

  startGrace(seconds: number): void {
    this.graceT = Math.max(this.graceT, seconds);
    this.combo = 0;
    for (const t of this.traumas) if (t.state === 'normal' || t.state === 'weak') t.state = 'fright';
  }

  // ─── spawning ───────────────────────────────────────────────────
  private updateSpawns(dt: number): void {
    if (this.kind === 'rescue') this.rescueT += dt;
    if (this.waveIndex >= this.waves.length) return;
    this.waveT -= dt;
    const active = this.traumas.filter(t => t.state === 'normal' || t.state === 'spawn').length;
    const ready = this.kind === 'rescue' ? this.waveT <= 0 && active < 6 + this.run.difficulty / 2
      : this.waveT <= 0 || (this.waveIndex > 0 && active <= 1 && this.waveT < 11);
    if (!ready || (this.kind === 'rescue' && this.rescueT > RESCUE_TIME)) return;
    const wave = this.waves[this.waveIndex++];
    const spawns = this.layout.spawns;
    wave.forEach((k, i) => {
      const s = spawns[(i + this.waveIndex) % spawns.length];
      this.spawnTrauma(k, s.x + this.rng.range(-0.3, 0.3), s.y + this.rng.range(-0.3, 0.3));
    });
    this.emit({ type: 'wave', n: this.waveIndex });
    this.waveT = this.kind === 'rescue' ? 6 : 14;
  }

  get wavesDone(): boolean {
    return this.waveIndex >= this.waves.length || (this.kind === 'rescue' && this.rescueT > RESCUE_TIME);
  }

  // ─── shadows ────────────────────────────────────────────────────
  private updateFields(): void {
    const p = this.player;
    computeField(this.blocked, p.x, p.y, this.fieldPlayer);
    const ax = clamp(p.x + p.fx * 2.5, 0.5, ROOM_W - 0.5), ay = clamp(p.y + p.fy * 2.5, 0.5, ROOM_H - 0.5);
    computeField(this.blocked, ax, ay, this.fieldAmbush);
    this.fieldT = 0.2;
  }

  private inAura(x: number, y: number): boolean {
    return this.auraR > 0.05 && dist2(x, y, this.player.x, this.player.y) < this.auraR * this.auraR;
  }

  private dirTo(t: { x: number; y: number; r: number }, tx: number, ty: number, field: Float32Array): [number, number] {
    if (lineOfSight(t.x, t.y, tx, ty, this.walls, t.r * 0.9)) {
      const dx = tx - t.x, dy = ty - t.y, l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    return fieldDirection(field, this.blocked, t.x, t.y);
  }

  private updateTraumas(dt: number): void {
    const p = this.player;
    for (const t of this.traumas) {
      t.phase += dt;
      if (t.stun > 0) t.stun -= dt;
      if (t.state === 'spawn') {
        t.t -= dt;
        if (t.t <= 0) t.state = this.graceT > 0 ? 'fright' : 'normal';
        continue;
      }
      if (t.state === 'weak') {
        t.t -= dt;
        if (t.t <= 0) {
          t.state = this.graceT > 0 ? 'fright' : 'normal';
          t.hp = t.maxHp * 0.5;
          this.emit({ type: 'recover', x: t.x, y: t.y });
        }
      }
      let speed = t.speed * (this.inAura(t.x, t.y) ? 1 - 0.4 * this.peace : 1);
      let dir: [number, number] = [0, 0];
      const frozen = this.freezeT > 0 || t.stun > 0;
      const dx = p.x - t.x, dy = p.y - t.y, dist = Math.hypot(dx, dy);
      if (!frozen) {
        if (t.state === 'fright') {
          dir = fieldDirection(this.fieldPlayer, this.blocked, t.x, t.y, true);
          speed *= 0.8;
        } else if (t.state === 'weak') {
          dir = [Math.cos(t.phase * 1.7) * 0.25, Math.sin(t.phase * 2.3) * 0.25];
        } else {
          dir = this.behave(t, dt, dist);
          if (t.dashT > 0) speed *= 3.2;
        }
      }
      const k = 1 - Math.exp(-dt * 8);
      t.vx += (dir[0] * speed - t.vx) * k;
      t.vy += (dir[1] * speed - t.vy) * k;
      if (frozen) { t.vx *= 0.5; t.vy *= 0.5; }
      this.moveCircle(t, t.vx * dt, t.vy * dt);
      // touching a strong shadow hurts
      if (t.state === 'normal' && dist < t.r + p.r - 0.05) this.hurt(t.x, t.y);
    }
    // keep shadows from stacking
    const ts = this.traumas;
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const a = ts[i], b = ts[j];
        const min = a.r + b.r, d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 >= min * min || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), push = (min - d) / 2, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }

  /** Movement per personality (Pac-Man's ghosts, adapted to open rooms). */
  private behave(t: Trauma, dt: number, dist: number): [number, number] {
    const p = this.player;
    const chase = () => this.dirTo(t, p.x, p.y, this.fieldPlayer);
    const flee = () => fieldDirection(this.fieldPlayer, this.blocked, t.x, t.y, true);
    switch (t.def.behavior) {
      case 'ambush': {
        const ax = p.x + p.fx * 2.5, ay = p.y + p.fy * 2.5;
        return dist < 1.6 ? chase() : this.dirTo(t, ax, ay, this.fieldAmbush);
      }
      case 'erratic': {
        if (t.dashT > 0) { t.dashT -= dt; return [t.dashX, t.dashY]; }
        t.dashCd -= dt;
        if (t.dashCd <= 0 && dist < 6 && lineOfSight(t.x, t.y, p.x, p.y, this.walls, t.r)) {
          const l = dist || 1;
          t.dashX = (p.x - t.x) / l; t.dashY = (p.y - t.y) / l;
          t.dashT = 0.45;
          t.dashCd = this.rng.range(2.5, 4);
          return [t.dashX, t.dashY];
        }
        const [cx, cy] = chase();
        return [cx * 0.6 + Math.cos(t.phase) * 0.4, cy * 0.6 + Math.sin(t.phase * 1.3) * 0.4];
      }
      case 'shy':
        return dist > 3.2 ? chase() : flee();
      case 'blink': {
        t.blinkCd -= dt;
        if (t.blinkCd <= 0) {
          const spots = this.layout.seeds.filter(s => dist2(s.x, s.y, p.x, p.y) > 9);
          if (spots.length) {
            const s = this.rng.pick(spots);
            this.emit({ type: 'blink', x: t.x, y: t.y });
            t.x = s.x; t.y = s.y;
          }
          t.blinkCd = this.rng.range(4, 6);
        }
        return dist > 3.2 ? chase() : flee();
      }
      case 'ranged': {
        t.shootCd -= dt;
        if (t.shootCd <= 0 && lineOfSight(t.x, t.y, p.x, p.y, this.walls, 0.1)) {
          this.fireArrow(t.x, t.y, p.x, p.y);
          t.shootCd = this.rng.range(2.2, 3.2);
        }
        if (dist < 3.5) return flee();
        if (dist > 5.5) return chase();
        const l = dist || 1;
        return [-(p.y - t.y) / l * 0.7, (p.x - t.x) / l * 0.7];   // circle around
      }
      default:   // chase, tank, splitter
        return chase();
    }
  }

  private fireArrow(x: number, y: number, tx: number, ty: number, spread = 0): void {
    const a = Math.atan2(ty - y, tx - x) + spread;
    this.arrows.push({ x, y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, life: 4 });
    this.emit({ type: 'arrow', x, y });
  }

  /** Damage a shadow; at 0 it becomes weak (and edible) instead of dying. */
  damage(t: Trauma, dmg: number): void {
    if (t.state !== 'normal') return;
    t.hp -= dmg;
    this.emit({ type: 'hit', x: t.x, y: t.y });
    if (t.hp > 0) return;
    if (t.def.behavior === 'splitter' && !t.child) {
      // an addiction splits in two when it weakens: both halves must be eaten
      this.traumas = this.traumas.filter(o => o !== t);
      for (const s of [-1, 1]) {
        const c = this.spawnTrauma(t.kind, t.x + s * 0.4, t.y, true);
        c.vx = s * 2;
      }
      this.emit({ type: 'split', x: t.x, y: t.y });
      return;
    }
    t.hp = 0;
    t.state = 'weak';
    t.t = WEAK_TIME * (this.inAura(t.x, t.y) ? 1 + 0.5 * this.peace : 1);
    this.emit({ type: 'weaken', x: t.x, y: t.y, kind: t.kind });
  }

  private damageBoss(dmg: number): void {
    const b = this.boss;
    if (!b || b.cracked) return;
    b.hp -= dmg * (b.revealT > 0 ? 1.5 : 1);
    this.emit({ type: 'hit', x: b.x, y: b.y });
    const phase = b.hp < b.maxHp / 3 ? 3 : b.hp < (2 * b.maxHp) / 3 ? 2 : 1;
    if (phase !== b.phase) {
      b.phase = phase;
      this.emit({ type: 'bossPhase', phase });
    }
    if (b.hp <= 0) {
      b.hp = 0;
      b.cracked = true;
      // when the lie falls, its servants weaken too
      for (const t of this.traumas) if (t.state === 'normal' || t.state === 'spawn') { t.state = 'weak'; t.hp = 0; t.t = WEAK_TIME * 2; }
      this.emit({ type: 'crack' });
    }
  }

  // ─── stronghold ─────────────────────────────────────────────────
  private updateBoss(dt: number): void {
    const b = this.boss!;
    const p = this.player;
    if (b.eaten) return;
    if (b.revealT > 0) b.revealT -= dt;
    if (b.revealCd > 0) b.revealCd -= dt;
    if (this.ext.revelation && !b.cracked && b.revealCd <= 0) {
      b.revealT = 6;
      b.revealCd = 20;
      this.run.stats.revelations++;
      this.emit({ type: 'reveal' });
    }
    if (b.cracked) {
      b.vx *= 0.9; b.vy *= 0.9;
      return;
    }
    if (b.stun > 0) b.stun -= dt;
    const frozen = this.freezeT > 0 || b.stun > 0;
    const dx = p.x - b.x, dy = p.y - b.y, dist = Math.hypot(dx, dy) || 1;
    let speed = 0.75 + 0.15 * b.phase;
    let dir: [number, number] = [dx / dist, dy / dist];
    if (b.telegraphT > 0) {
      b.telegraphT -= dt;
      dir = [0, 0];
      if (b.telegraphT <= 0) b.chargeT = 0.6;
    } else if (b.chargeT > 0) {
      b.chargeT -= dt;
      dir = [b.chargeX, b.chargeY];
      speed = 7;
    } else if (!frozen) {
      b.arrowCd -= dt;
      b.summonCd -= dt;
      b.chargeCd -= dt;
      if (b.arrowCd <= 0) {
        const n = 1 + 2 * b.phase;
        for (let i = 0; i < n; i++) this.fireArrow(b.x, b.y, p.x, p.y, (i - (n - 1) / 2) * 0.26);
        b.arrowCd = [2.8, 2.2, 1.7][b.phase - 1];
      }
      if (b.summonCd <= 0 && this.traumas.filter(t => t.state !== 'weak').length < 5) {
        for (let i = 0; i < 2; i++) {
          const s = this.layout.spawns[i % this.layout.spawns.length];
          this.spawnTrauma(this.rng.pick(this.chapter.traumas), s.x, s.y);
        }
        b.summonCd = 9;
      }
      if (b.phase >= 2 && b.chargeCd <= 0) {
        b.chargeX = dx / dist; b.chargeY = dy / dist;
        b.telegraphT = 0.8;
        b.chargeCd = 7;
        this.emit({ type: 'charge', x: b.x, y: b.y });
      }
    }
    if (frozen && b.chargeT <= 0) dir = [0, 0];
    const k = 1 - Math.exp(-dt * 6);
    b.vx += (dir[0] * speed - b.vx) * k;
    b.vy += (dir[1] * speed - b.vy) * k;
    this.moveCircle(b, b.vx * dt, b.vy * dt);
    if (dist < b.r + p.r - 0.1) this.hurt(b.x, b.y);
  }

  // ─── the angel's gifts ──────────────────────────────────────────
  private nearestTarget(maxDist = 99): Trauma | Boss | null {
    const p = this.player;
    let best: Trauma | Boss | null = null, bd = maxDist * maxDist;
    for (const t of this.traumas) {
      if (t.state !== 'normal') continue;
      const d = dist2(t.x, t.y, p.x, p.y);
      if (d < bd) { bd = d; best = t; }
    }
    if (this.boss && !this.boss.cracked) {
      const d = dist2(this.boss.x, this.boss.y, p.x, p.y) - 0.8;
      if (d < bd) best = this.boss;
    }
    return best;
  }

  private hitAt(x: number, y: number, r: number, dmg: number): void {
    for (const t of this.traumas) if (dist2(t.x, t.y, x, y) < (r + t.r) ** 2) this.damage(t, dmg);
    const b = this.boss;
    if (b && dist2(b.x, b.y, x, y) < (r + b.r) ** 2) this.damageBoss(dmg);
  }

  private timer(key: string, dt: number, period: number): boolean {
    this.cd[key] = (this.cd[key] ?? period * 0.5) - dt;
    if (this.cd[key] > 0) return false;
    this.cd[key] = period;
    return true;
  }

  private updateAttacks(dt: number): void {
    const p = this.player, run = this.run, m = run.mods;
    const L = (id: Parameters<Run['giftLevel']>[0]) => run.giftLevel(id);
    const dmgMult = m.dmgMult;
    // the Word: fires only while standing still (Archero) — stillness is prayer
    const word = L('slowo');
    if (p.still >= STILL_DELAY) {
      p.fireCd -= dt;
      const target = this.nearestTarget(9);
      if (p.fireCd <= 0 && target) {
        const rate = FIRE_RATE * (word >= 3 ? 1.2 : 1) * m.stillFireMult;
        p.fireCd = 1 / rate;
        const dmg = WORD_DMG * (word >= 2 ? 1.25 : 1) * (word >= 5 ? 1.25 : 1) * dmgMult;
        const speed = WORD_SPEED * (word >= 5 ? 1.2 : 1);
        const n = 1 + L('chleby');
        const base = Math.atan2(target.y - p.y, target.x - p.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.21;
          this.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 0.14, dmg, pierce: word >= 4 ? 1 : 0, life: 1.4, kind: 'word', hit: [] });
        }
        this.emit({ type: 'shoot', x: p.x, y: p.y });
      }
    } else {
      p.fireCd = Math.max(p.fireCd, 0.12);
    }
    // Tarcza wiary — orbiting shields (arrows are handled in updateArrows)
    const shield = L('tarcza');
    if (shield && this.timer('tarcza', dt, 0.25)) {
      for (const s of this.shieldPositions()) this.hitAt(s.x, s.y, 0.28, 6 * (shield >= 4 ? 1.6 : 1) * dmgMult);
    }
    // Języki ognia
    const fire = L('ogien');
    if (fire && this.timer('ogien', dt, 3.5 - 0.4 * (fire - 1))) {
      const r = 1.8 + 0.2 * (fire - 1);
      this.hitAt(p.x, p.y, r, (14 + 4 * (fire - 1)) * dmgMult);
      this.emit({ type: 'fire', x: p.x, y: p.y, r });
    }
    // Gwałtowny wicher
    const wind = L('wicher');
    if (wind && this.timer('wicher', dt, 6 - 0.8 * (wind - 1))) {
      for (const t of this.traumas) {
        const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
        if (d < 3 && d > 0.01) { t.vx += (dx / d) * 9; t.vy += (dy / d) * 9; t.stun = Math.max(t.stun, 0.8); }
      }
      this.emit({ type: 'wind', x: p.x, y: p.y, r: 3 });
    }
    // Gołębica
    const dove = L('golebica');
    if (dove && this.timer('golebica', dt, 1.5 - 0.2 * (dove - 1))) {
      const target = this.nearestTarget(10);
      if (target) {
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        this.shots.push({ x: p.x, y: p.y - 0.5, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, r: 0.16, dmg: (8 + 3 * (dove - 1)) * dmgMult, pierce: 0, life: 2.5, kind: 'dove', hit: [] });
      }
    }
    // Ogień Eliasza
    const elijah = L('eliasz');
    if (elijah && this.timer('eliasz', dt, 4)) {
      const targets: (Trauma | Boss)[] = this.rng.shuffle(this.traumas.filter(t => t.state === 'normal'));
      if (this.boss && !this.boss.cracked) targets.unshift(this.boss);
      for (const t of targets.slice(0, elijah)) {
        if ('kind' in t) this.damage(t, 25 * dmgMult); else this.damageBoss(25 * dmgMult);
        this.emit({ type: 'lightning', x: t.x, y: t.y });
      }
    }
    // Trąby Jerycha
    const jericho = L('jerycho');
    if (jericho && this.timer('jerycho', dt, 7)) {
      this.arrows = this.arrows.filter(a => dist2(a.x, a.y, p.x, p.y) > 16);
      if (jericho >= 2) for (const t of this.traumas) if (dist2(t.x, t.y, p.x, p.y) < 16) t.stun = Math.max(t.stun, 1.2);
      if (jericho >= 3) this.hitAt(p.x, p.y, 4, 10 * dmgMult);
      this.emit({ type: 'trumpet', x: p.x, y: p.y, r: 4 });
    }
    // Proca Dawida — at the strongest
    const david = L('dawid');
    if (david && this.timer('dawid', dt, 5 - 0.7 * (david - 1))) {
      let target: Trauma | Boss | null = this.boss && !this.boss.cracked ? this.boss : null;
      if (!target) for (const t of this.traumas) if (t.state === 'normal' && (!target || t.hp > (target as Trauma).hp)) target = t;
      if (target) {
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        this.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * 14, vy: Math.sin(a) * 14, r: 0.18, dmg: (40 + 20 * (david - 1)) * dmgMult, pierce: 0, life: 1.2, kind: 'stone', hit: [] });
        this.emit({ type: 'stone', x: p.x, y: p.y });
      }
    }
    // Siła Samsona — a punch when they come close
    const samson = L('samson');
    if (samson) {
      this.cd.samson = (this.cd.samson ?? 0) - dt;
      if (this.cd.samson <= 0) {
        const near = this.traumas.find(t => t.state === 'normal' && dist2(t.x, t.y, p.x, p.y) < (1 + t.r) ** 2);
        if (near) {
          const dx = near.x - p.x, dy = near.y - p.y, d = Math.hypot(dx, dy) || 1;
          this.damage(near, (12 + 6 * (samson - 1)) * dmgMult);
          near.vx += (dx / d) * 8; near.vy += (dy / d) * 8;
          near.stun = Math.max(near.stun, 0.3);
          this.cd.samson = 0.8 - 0.1 * (samson - 1);
          this.emit({ type: 'punch', x: near.x, y: near.y });
        }
      }
    }
    // Manna
    const manna = L('manna');
    if (manna && this.timer('manna', dt, 25 - 5 * (manna - 1)) && run.hearts < run.maxHearts) {
      run.hearts++;
      this.emit({ type: 'heal', x: p.x, y: p.y });
    }
    // trees grown from mustard seeds
    for (const tr of this.trees) {
      tr.cd -= dt;
      if (tr.cd > 0) continue;
      tr.cd = 1.2;
      let best: Trauma | null = null, bd = 16;
      for (const t of this.traumas) {
        if (t.state !== 'normal') continue;
        const d = dist2(t.x, t.y, tr.x, tr.y);
        if (d < bd) { bd = d; best = t; }
      }
      if (best) {
        const a = Math.atan2(best.y - tr.y, best.x - tr.x);
        this.shots.push({ x: tr.x, y: tr.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, r: 0.1, dmg: 6 * dmgMult, pierce: 0, life: 1, kind: 'tree', hit: [] });
      }
    }
    // Pentecost (the Spirit's ultimate)
    if (this.pentecostT > 0) {
      this.pentecostT -= dt;
      if (this.timer('pentecost', dt, 0.5)) {
        this.hitAt(p.x, p.y, 2.2, 12 * dmgMult);
        this.emit({ type: 'fire', x: p.x, y: p.y, r: 2.2 });
      }
    }
  }

  shieldPositions(): Point[] {
    const n = Math.min(3, this.run.giftLevel('tarcza'));
    const out: Point[] = [];
    for (let i = 0; i < n; i++) {
      const a = this.time * 2.4 + (i * Math.PI * 2) / n;
      out.push({ x: this.player.x + Math.cos(a) * 1.1, y: this.player.y + Math.sin(a) * 1.1 });
    }
    return out;
  }

  private updateShots(dt: number): void {
    const keep: Shot[] = [];
    for (const s of this.shots) {
      s.life -= dt;
      if (s.kind === 'dove') {
        const target = this.nearestTarget(8);
        if (target) {
          const a = Math.atan2(target.y - s.y, target.x - s.x), sp = Math.hypot(s.vx, s.vy);
          const cur = Math.atan2(s.vy, s.vx);
          let d = a - cur;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const na = cur + clamp(d, -5 * dt, 5 * dt);
          s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let alive = s.life > 0 && s.x > -0.5 && s.x < ROOM_W + 0.5 && s.y > -0.5 && s.y < ROOM_H + 0.5;
      if (alive && this.walls.some(w => pointInRect(s.x, s.y, w))) alive = false;
      if (alive) {
        for (const t of this.traumas) {
          if (t.state !== 'normal' || s.hit.includes(t.id)) continue;
          if (dist2(t.x, t.y, s.x, s.y) < (t.r + s.r) ** 2) {
            this.damage(t, s.dmg);
            s.hit.push(t.id);
            if (s.pierce-- <= 0) { alive = false; break; }
          }
        }
      }
      const b = this.boss;
      if (alive && b && !b.cracked && dist2(b.x, b.y, s.x, s.y) < (b.r + s.r) ** 2) {
        this.damageBoss(s.kind === 'stone' ? s.dmg * 2 : s.dmg);
        alive = false;
      }
      if (alive) keep.push(s);
    }
    this.shots = keep;
  }

  private updateArrows(dt: number): void {
    const p = this.player;
    const shields = this.shieldPositions();
    const keep: Arrow[] = [];
    for (const a of this.arrows) {
      a.life -= dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      let alive = a.life > 0 && a.x > 0 && a.x < ROOM_W && a.y > 0 && a.y < ROOM_H && !this.walls.some(w => pointInRect(a.x, a.y, w));
      if (alive && shields.some(s => dist2(s.x, s.y, a.x, a.y) < 0.2)) alive = false;   // the shield of faith quenches them
      if (alive && dist2(p.x, p.y, a.x, a.y) < (p.r + 0.12) ** 2) {
        this.hurt(a.x, a.y);
        alive = false;
      }
      if (alive) keep.push(a);
    }
    this.arrows = keep;
  }

  // ─── pickups, devouring, digestion ──────────────────────────────
  private updatePickups(dt: number): void {
    const p = this.player, run = this.run;
    // once the room is cleansed, the remaining light drifts toward the angel — no tedious hunt
    const cleansed = this.wavesDone && this.traumas.length === 0 && this.kind !== 'rescue';
    const reach = (p.r + SEED_PICK + run.mods.magnet + (cleansed ? 1.2 : 0)) ** 2;
    for (const s of this.seeds) {
      if (!s.alive || dist2(s.x, s.y, p.x, p.y) > reach) continue;
      s.alive = false;
      this.seedsTaken++;
      run.stats.seeds++;
      run.addLight(1);
      this.emit({ type: 'seed', x: s.x, y: s.y });
      const mustard = run.giftLevel('gorczyca');
      if (mustard && ++this.seedsSinceTree >= [10, 7, 5][mustard - 1] && this.trees.length < 6) {
        this.seedsSinceTree = 0;
        this.trees.push({ x: s.x, y: s.y, cd: 0.5, life: 999 });
        this.emit({ type: 'tree', x: s.x, y: s.y });
      }
    }
    for (const g of this.graces) {
      if (!g.alive || dist2(g.x, g.y, p.x, p.y) > (p.r + 0.4) ** 2) continue;
      g.alive = false;
      this.startGrace(GRACE_TIME + 1.5 * run.giftLevel('przebaczenie') + run.mods.graceBonus);
      this.emit({ type: 'grace', x: g.x, y: g.y });
    }
    for (const f of this.fragments) {
      if (!f.alive) continue;
      const d2 = dist2(f.x, f.y, p.x, p.y);
      if (!f.chained) {
        if (d2 < (p.r + 0.4) ** 2) this.collectFragment(f);
      } else if (d2 < 1.3 * 1.3 && p.still > 0.2) {
        f.progress += dt / 2.5;   // stand still beside it to break the chains
        if (f.progress >= 1) this.collectFragment(f);
      } else {
        f.progress = Math.max(0, f.progress - dt * 0.3);
      }
    }
    if (this.kind === 'chapel' && !this.chapelDone && this.layout.altar && dist2(this.layout.altar.x, this.layout.altar.y, p.x, p.y) < 0.7) {
      this.chapelDone = true;
      this.state = 'chapel';
      this.emit({ type: 'altar' });
    }
  }

  private collectFragment(f: Fragment): void {
    f.alive = false;
    this.run.stats.fragments++;
    this.run.addLight(5);
    this.emit({ type: 'fragment', x: f.x, y: f.y });
  }

  private updateDevour(): void {
    const p = this.player;
    const reach = DEVOUR_PAD + 0.35 * this.run.giftLevel('ryba');
    const cap = this.run.giftLevel('przebaczenie') ? 16 : 8;
    for (const t of [...this.traumas]) {
      if (t.state !== 'weak' && t.state !== 'fright') continue;
      if (dist2(t.x, t.y, p.x, p.y) > (p.r + t.r + reach) ** 2) continue;
      if (this.stomach.length >= this.stomachCap) {
        if (this.time > this.fullHintT) {
          this.fullHintT = this.time + 2.5;
          this.emit({ type: 'full', x: p.x, y: p.y });
        }
        continue;
      }
      this.traumas = this.traumas.filter(o => o !== t);
      let mult = 1;
      if (this.graceT > 0) {
        this.combo++;
        mult = Math.min(cap, 2 ** (this.combo - 1));
      }
      this.stomach.push({ kind: t.kind, p: 0, light: (4 + Math.round(t.maxHp / 10)) * mult });
      this.emit({ type: 'eat', x: t.x, y: t.y, kind: t.kind, mult });
    }
    const b = this.boss;
    if (b && b.cracked && !b.eaten && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r + reach) ** 2) {
      b.eaten = true;
      this.bossEatenT = 0;
      this.arrows = [];
      this.startGrace(GRACE_TIME);   // its shadows flee
      this.stomach.push({ kind: 'boss', p: 0, light: Math.round(b.maxHp / 10) });
      this.emit({ type: 'eat', x: b.x, y: b.y, kind: 'boss', mult: 1 });
      this.emit({ type: 'bossEaten' });
    }
  }

  get digestRate(): number {
    const still = this.player.still > STILL_DELAY;
    return (1 / DIGEST_TIME) * (still ? 2 : 1) * this.run.mods.digestMult * (1 + 0.2 * this.run.giftLevel('serce')) * (1 + 0.5 * this.peace);
  }

  private updateDigestion(dt: number): void {
    const meal = this.stomach[0];
    if (!meal) return;
    meal.p += dt * this.digestRate * (meal.kind === 'boss' ? 0.5 : 1);
    if (meal.p < 1) return;
    this.stomach.shift();
    this.completeMeal(meal);
  }

  /** A digested meal turns into Light, Spirit and, for a shadow, its truth. */
  private completeMeal(meal: Meal): void {
    this.run.addLight(meal.light);
    this.run.spirit = Math.min(100, this.run.spirit + 4);
    if (meal.kind === 'boss') return;
    const kind = meal.kind;
    const stats = this.run.stats.digested;
    stats[kind] = (stats[kind] ?? 0) + 1;
    this.emit({ type: 'digest', kind, light: meal.light });
    this.emit({ type: 'truth', word: this.defs[kind].truth.word, x: this.player.x, y: this.player.y - 0.6, kind });
    if (!this.run.truthsSeen.has(kind)) {
      this.run.truthsSeen.add(kind);
      this.emit({ type: 'verse', kind });
    }
  }

  /** Leaving the room: whatever is still in the stomach is digested at once, never lost. */
  private flushStomach(): void {
    for (const meal of this.stomach.splice(0)) this.completeMeal(meal);
  }

  // ─── room goal ──────────────────────────────────────────────────
  get seedsRatio(): number { return this.seedsTotal ? this.seedsTaken / this.seedsTotal : 1; }

  private updateRoomGoal(dt: number): void {
    if (this.state !== 'playing') return;   // a fall in this very step wins over the door
    const p = this.player;
    if (this.kind === 'sabbath') {
      if (p.still > 0.5) {
        this.restTime += dt;
        this.restHeart += this.ext.restRate * dt;
        if (this.restHeart >= 1) {
          this.restHeart -= 1;
          if (this.run.hearts < this.run.maxHearts) {
            this.run.hearts++;
            this.emit({ type: 'heal', x: p.x, y: p.y });
          }
        }
        if (this.restTime >= SABBATH_REST && !this.sabbathBlessed) {
          this.sabbathBlessed = true;
          this.run.hearts = this.run.maxHearts;
          this.run.spirit = 100;
          this.emit({ type: 'sabbath' });
        }
      }
    }
    if (this.kind === 'boss') {
      if (this.bossEatenT >= 0) {
        this.bossEatenT += dt;
        if (this.bossEatenT >= BOSS_END_DELAY && (this.stomach.length === 0 || this.bossEatenT >= BOSS_DIGEST_CAP)) {
          this.flushStomach();
          this.state = 'bossDone';
        }
      }
      return;
    }
    if (!this.doorOpen) {
      // every shadow eaten AND digested
      const clear = this.wavesDone && this.traumas.length === 0 && this.stomach.length === 0;
      const goal = this.kind === 'rescue'
        ? clear && this.fragments.every(f => !f.alive)
        : clear && this.seedsRatio >= SEED_GOAL;
      if (goal) {
        this.doorOpen = true;
        this.emit({ type: 'door' });
      }
    }
    if (this.doorOpen && p.y < 0.75 && Math.abs(p.x - DOOR.x) < DOOR.halfWidth) {
      this.flushStomach();
      this.run.stats.rooms++;
      this.state = 'exit';
    }
  }

  get rescueLeft(): number { return Math.max(0, RESCUE_TIME - this.rescueT); }

  // ─── commands from the UI ───────────────────────────────────────
  /** "Przyjdź, Duchu!" — Pentecost when the Spirit meter is full. */
  triggerUltimate(): boolean {
    const run = this.run;
    if (!run.ultimateUnlocked || run.spirit < 100 || this.state !== 'playing') return false;
    run.spirit = 0;
    this.startGrace(7);
    this.pentecostT = 7;
    run.hearts = Math.min(run.maxHearts, run.hearts + 1);
    this.emit({ type: 'ultimate' });
    return true;
  }

  /** After a level-up card has been chosen. */
  resume(): void {
    if (this.state === 'levelup' || this.state === 'chapel') this.state = this.run.pendingLevelUps > 0 ? 'levelup' : 'playing';
  }

  /** Chapel blessing: a completed focus task strengthens peace for the rest of the run. */
  blessChapel(success: boolean): void {
    if (this.state !== 'chapel') return;   // once per altar
    if (success) {
      this.run.auraBlessing += 0.3;
      this.run.spirit = Math.min(100, this.run.spirit + 50);
      this.run.hearts = Math.min(this.run.maxHearts, this.run.hearts + 1);
    }
    this.resume();
  }

  /** Start the room over after a fall (hearts restored, gifts kept). */
  static retry(prev: World, seed: number): World {
    const run = prev.run;
    run.hearts = run.maxHearts;
    // the room starts over, so what the failed attempt earned is earned again (gifts stay; the fall stays counted)
    const { light, stats } = prev.entry;
    run.light = light;
    Object.assign(run.stats, { ...stats, digested: { ...stats.digested }, falls: run.stats.falls });
    return new World({ run, layout: prev.layout, defs: prev.defs, seed });
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
