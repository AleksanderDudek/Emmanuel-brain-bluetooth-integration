/**
 * Draws a World on a Canvas 2D: floor, walls, seeds, shadows, the angel, the
 * stronghold, particles and the HUD.  Purely visual — it reads the simulation
 * and turns its events into particles, rings and floating words of truth.
 */
import type { Effects } from '../neuro/effects';
import type { GameEvent } from '../sim/events';
import { DOOR, ROOM_H, ROOM_W } from '../sim/room';
import { GRACE_TIME, SABBATH_REST, type World } from '../sim/world';
import type { ChapterDef, TraumaKind } from '../types';
import { drawAngel, drawCross, drawGlow, drawShard, drawTree, ghostEyes, ghostSprite, mix, rgba, type AngelLook } from './sprites';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface FloatText { text: string; x: number; y: number; vy: number; life: number; max: number; color: string; size: number }
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string; width: number }
interface Bolt { x: number; y: number; life: number; seed: number }

export interface Joystick { active: boolean; ox: number; oy: number; x: number; y: number }

export interface ViewState {
  fx: Effects;
  joystick: Joystick | null;
  hint: string;
  showSpirit: boolean;
  bandConnected: boolean;
}

const HUD_TOP = 70;
const HUD_BOTTOM = 84;
const MAX_PARTICLES = 420;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  scale = 40;
  ox = 0;
  oy = 0;
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private shake = 0;
  private hurtFlash = 0;
  private revealFlash = 0;
  private floor: CanvasPattern | null = null;
  private themeKey = '';
  private palette: ChapterDef['palette'] = { bg1: '#1b1f2e', bg2: '#0c0e16', accent: '#ffd76a', wall: '#3a3f55', seed: '#fff2b3' };
  private realm: ChapterDef['realm'] = 'earth';
  private traumaColors = new Map<TraumaKind, string>();
  private look: AngelLook = { robe: ['#ffffff', '#cfd8ff'], halo: ['#ffd76a', '#fff1a8'], wings: ['#ffffff', '#dfe8ff'], wingCount: 2 };
  reducedMotion = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    const availH = this.h - HUD_TOP - HUD_BOTTOM;
    this.scale = Math.max(8, Math.min((this.w * 0.96) / ROOM_W, availH / ROOM_H));
    this.ox = (this.w - ROOM_W * this.scale) / 2;
    this.oy = HUD_TOP + (availH - ROOM_H * this.scale) / 2;
  }

  setTheme(chapter: ChapterDef, look: AngelLook, traumaColors: Map<TraumaKind, string>): void {
    this.palette = chapter.palette;
    this.realm = chapter.realm;
    this.look = look;
    this.traumaColors = traumaColors;
    const key = `${chapter.id}`;
    if (key !== this.themeKey) {
      this.themeKey = key;
      this.floor = this.makeFloor();
    }
  }

  /** A faint repeating texture for the floor: stone tiles on earth, stars in heaven, embers in Szeol. */
  private makeFloor(): CanvasPattern | null {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const p = this.palette;
    if (this.realm === 'heaven') {
      for (let i = 0; i < 9; i++) {
        g.fillStyle = rgba(p.seed, 0.08 + (i % 3) * 0.04);
        g.beginPath();
        g.arc((i * 37) % 64, (i * 23) % 64, 0.8 + (i % 2), 0, Math.PI * 2);
        g.fill();
      }
    } else if (this.realm === 'hell') {
      g.strokeStyle = rgba(p.accent, 0.08);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(5, 10); g.lineTo(20, 28); g.lineTo(18, 44); g.moveTo(40, 4); g.lineTo(52, 30); g.lineTo(60, 36);
      g.stroke();
    } else {
      g.strokeStyle = rgba('#ffffff', 0.035);
      g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, 31, 31);
      g.strokeRect(32.5, 32.5, 31, 31);
      g.strokeRect(32.5, 0.5, 31, 31);
      g.strokeRect(0.5, 32.5, 31, 31);
    }
    return this.ctx.createPattern(c, 'repeat');
  }

  private sx(x: number): number { return this.ox + x * this.scale; }
  private sy(y: number): number { return this.oy + y * this.scale; }

  // ─── events → visuals ───────────────────────────────────────────
  handle(events: GameEvent[], world: World): void {
    const p = world.player;
    for (const e of events) {
      switch (e.type) {
        case 'hit': this.burst(e.x, e.y, '#ffffff', 3, 1.2, 0.06); break;
        case 'weaken':
          this.ring(e.x, e.y, 0.3, 0.9, 0.4, rgba('#ffffff', 0.7), 0.05);
          this.burst(e.x, e.y, this.traumaColors.get(e.kind) ?? '#ffffff', 6, 1.8, 0.07);
          break;
        case 'eat':
          this.burst(e.x, e.y, e.kind === 'boss' ? '#ffffff' : this.traumaColors.get(e.kind) ?? '#ffffff', e.kind === 'boss' ? 60 : 12, 3, 0.09);
          if (e.mult > 1) this.text(`×${e.mult}`, e.x, e.y - 0.4, '#ffe9a0', 0.5);
          break;
        case 'full': this.text('Stań, by strawić', p.x, p.y - 0.9, '#ffffff', 0.34); break;
        case 'digest': this.ring(p.x, p.y, 0.2, 0.8, 0.5, rgba(this.palette.accent, 0.6), 0.05); break;
        case 'truth': this.text(e.word.toUpperCase(), e.x, e.y, '#ffe9a0', 0.52, 2.4); break;
        case 'seed': this.burst(e.x, e.y, this.palette.seed, 3, 1, 0.05); break;
        case 'grace':
          this.ring(e.x, e.y, 0.3, 6, 0.9, rgba('#ffffff', 0.8), 0.12);
          this.burst(e.x, e.y, '#ffffff', 24, 3.5, 0.08);
          break;
        case 'fragment':
          this.burst(e.x, e.y, '#bfe8ff', 26, 3, 0.08);
          this.text('Fragment duszy', e.x, e.y - 0.5, '#bfe8ff', 0.36);
          break;
        case 'door': this.burst(DOOR.x, 0.6, '#ffffff', 30, 2.5, 0.08); break;
        case 'hurt':
          this.hurtFlash = 0.35;
          if (!this.reducedMotion) this.shake = 0.25;
          this.burst(e.x, e.y, '#ff9aa8', 10, 2.5, 0.07);
          break;
        case 'block': this.ring(e.x, e.y, 0.3, 0.9, 0.35, rgba('#cfe8ff', 0.9), 0.06); break;
        case 'revive': this.ring(p.x, p.y, 0.3, 3, 1, rgba('#ffe9a0', 0.9), 0.1); break;
        case 'heal': this.text('+♥', e.x, e.y - 0.6, '#9cf0b0', 0.42); break;
        case 'fire': this.ring(e.x, e.y, e.r * 0.4, e.r, 0.45, rgba('#ff9a3c', 0.85), 0.25); this.burst(e.x, e.y, '#ffb347', 14, 3, 0.08); break;
        case 'wind': this.ring(e.x, e.y, 0.4, e.r, 0.5, rgba('#e6f3ff', 0.7), 0.08); break;
        case 'trumpet': this.ring(e.x, e.y, 0.4, e.r, 0.6, rgba('#ffd76a', 0.8), 0.07); this.ring(e.x, e.y, 0.2, e.r * 0.7, 0.6, rgba('#ffd76a', 0.5), 0.05); break;
        case 'lightning': this.bolts.push({ x: e.x, y: e.y, life: 0.25, seed: Math.random() * 1000 }); this.burst(e.x, e.y, '#fff3b0', 10, 2.5, 0.07); break;
        case 'punch': this.burst(e.x, e.y, '#ffe0a0', 8, 3, 0.07); this.ring(e.x, e.y, 0.1, 0.6, 0.2, rgba('#ffe0a0', 0.9), 0.06); break;
        case 'tree': this.burst(e.x, e.y, '#7be08a', 10, 2, 0.06); break;
        case 'spawn': this.burst(e.x, e.y, '#2a2633', 10, 1.2, 0.12); break;
        case 'blink': this.burst(e.x, e.y, '#a98bd6', 10, 1.5, 0.09); break;
        case 'crack': case 'reveal':
          this.revealFlash = 0.8;
          if (world.boss) this.ring(world.boss.x, world.boss.y, 0.5, 4, 1, rgba('#ffe9a0', 0.9), 0.12);
          break;
        case 'ultimate':
          this.ring(p.x, p.y, 0.4, 8, 1.2, rgba('#ffb347', 0.9), 0.2);
          this.burst(p.x, p.y, '#ffcf7a', 40, 4, 0.09);
          break;
        case 'bossEaten': this.burst(p.x, p.y, '#ffffff', 80, 5, 0.1); break;
        case 'levelup': this.ring(p.x, p.y, 0.3, 2, 0.6, rgba('#ffe9a0', 0.9), 0.08); break;
        case 'sabbath': this.ring(p.x, p.y, 0.3, 3, 1.2, rgba('#bff2d0', 0.9), 0.1); this.text('Szabat — odpocząłeś', p.x, p.y - 1, '#bff2d0', 0.4, 2.5); break;
        default: break;
      }
    }
  }

  private burst(x: number, y: number, color: string, n: number, speed: number, size: number): void {
    const k = this.reducedMotion ? Math.ceil(n / 3) : n;
    for (let i = 0; i < k && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color, size: size * (0.6 + Math.random() * 0.8) });
    }
  }

  private ring(x: number, y: number, r0: number, r1: number, life: number, color: string, width: number): void {
    this.rings.push({ x, y, r0, r1, life, max: life, color, width });
  }

  private text(text: string, x: number, y: number, color: string, size: number, life = 1.4): void {
    this.texts.push({ text, x, y, vy: -0.6, life, max: life, color, size });
  }

  // ─── frame ──────────────────────────────────────────────────────
  render(world: World, view: ViewState, dt: number): void {
    const ctx = this.ctx, t = world.time;
    this.tick(dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawBackdrop();
    const shx = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * 6 * this.shake : 0;
    ctx.save();
    ctx.translate(shx, shy);
    this.drawFloor(world);
    this.drawDoor(world, t);
    this.drawWalls(world);
    this.drawPickups(world, t);
    this.drawAura(world, view, t);
    this.drawTraumas(world, t);
    this.drawBoss(world, t);
    this.drawShots(world);
    this.drawAngelAndShields(world, view, t);
    this.drawEffects();
    ctx.restore();
    this.drawTints(world);
    if (view.joystick?.active) this.drawJoystick(view.joystick);
    this.drawHud(world, view, t);
  }

  private tick(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.5;
      p.vy *= 1 - dt * 2.5;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const tx of this.texts) { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 1 - dt * 1.2; }
    this.texts = this.texts.filter(tx => tx.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    this.shake = Math.max(0, this.shake - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.revealFlash = Math.max(0, this.revealFlash - dt);
  }

  private drawBackdrop(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, mix(this.palette.bg2, '#000000', 0.35));
    g.addColorStop(1, mix(this.palette.bg2, '#000000', 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawFloor(world: World): void {
    const ctx = this.ctx, x = this.sx(0), y = this.sy(0), w = ROOM_W * this.scale, h = ROOM_H * this.scale;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, this.palette.bg1);
    g.addColorStop(1, this.palette.bg2);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, this.scale * 0.4);
    ctx.fill();
    if (this.floor) {
      ctx.save();
      ctx.clip();
      ctx.translate(x, y);
      ctx.fillStyle = this.floor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    // vignette
    const v = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.25, x + w / 2, y + h / 2, h * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    roundRect(ctx, x, y, w, h, this.scale * 0.4);
    ctx.fill();
    // Sabbath: soft green light
    if (world.kind === 'sabbath') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#7fdca0', x + w / 2, y + h * 0.6, h * 0.5, 0.25);
      ctx.restore();
    }
  }

  private drawDoor(world: World, t: number): void {
    const ctx = this.ctx, cx = this.sx(DOOR.x), top = this.sy(0), s = this.scale;
    const open = world.doorOpen;
    ctx.save();
    if (open) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, top, 0, top + s * 3);
      g.addColorStop(0, rgba('#fff6d6', 0.7));
      g.addColorStop(1, rgba('#fff6d6', 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.9, top);
      ctx.lineTo(cx + s * 0.9, top);
      ctx.lineTo(cx + s * 1.6, top + s * 3);
      ctx.lineTo(cx - s * 1.6, top + s * 3);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, '#fff6d6', cx, top + s * 0.2, s * (1.6 + 0.1 * Math.sin(t * 3)), 0.9);
    }
    ctx.restore();
    ctx.strokeStyle = open ? '#fff6d6' : rgba(this.palette.accent, 0.35);
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.arc(cx, top + s * 0.55, s * 0.85, Math.PI, 0);
    ctx.stroke();
  }

  private drawWalls(world: World): void {
    const ctx = this.ctx, s = this.scale;
    for (const w of world.walls) {
      const x = this.sx(w.x) + 2, y = this.sy(w.y) + 2, ww = w.w * s - 4, hh = w.h * s - 4;
      if (world.kind === 'sabbath') {
        // a fountain of living water (J 4,14)
        const g = ctx.createLinearGradient(0, y, 0, y + hh);
        g.addColorStop(0, '#6fc3ff');
        g.addColorStop(1, '#2a6fb3');
        ctx.fillStyle = g;
        roundRect(ctx, x, y, ww, hh, s * 0.3);
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.4);
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = rgba('#000000', 0.35);
      roundRect(ctx, x + s * 0.06, y + s * 0.12, ww, hh, s * 0.18);
      ctx.fill();
      const g = ctx.createLinearGradient(0, y, 0, y + hh);
      g.addColorStop(0, mix(this.palette.wall, '#ffffff', 0.18));
      g.addColorStop(1, this.palette.wall);
      ctx.fillStyle = g;
      roundRect(ctx, x, y, ww, hh, s * 0.18);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.12);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (world.layout.altar) {
      const a = world.layout.altar, x = this.sx(a.x), y = this.sy(a.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#ffd76a', x, y - s * 0.3, s * 1.4, world.chapelDone ? 0.3 : 0.75);
      ctx.restore();
      ctx.fillStyle = '#e9d6a0';
      roundRect(ctx, x - s * 0.45, y - s * 0.2, s * 0.9, s * 0.45, s * 0.08);
      ctx.fill();
      drawCross(ctx, x, y - s * 0.55, s * 0.5, '#ffe9a0');
    }
  }

  private drawPickups(world: World, t: number): void {
    const ctx = this.ctx, s = this.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of world.seeds) {
      if (!p.alive) continue;
      const bob = Math.sin(t * 3 + p.x * 2 + p.y) * s * 0.04;
      drawGlow(ctx, this.palette.seed, this.sx(p.x), this.sy(p.y) + bob, s * 0.32, 0.8);
    }
    for (const g of world.graces) {
      if (!g.alive) continue;
      const pulse = 1 + 0.15 * Math.sin(t * 5);
      drawGlow(ctx, '#ffffff', this.sx(g.x), this.sy(g.y), s * 0.8 * pulse, 0.9);
    }
    for (const tr of world.trees) drawGlow(ctx, '#7be08a', this.sx(tr.x), this.sy(tr.y), s * 0.6, 0.35);
    ctx.restore();
    for (const p of world.seeds) {
      if (!p.alive) continue;
      const bob = Math.sin(t * 3 + p.x * 2 + p.y) * s * 0.04;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.sx(p.x), this.sy(p.y) + bob, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const g of world.graces) if (g.alive) drawCross(ctx, this.sx(g.x), this.sy(g.y), s * 0.42, '#ffffff');
    for (const tr of world.trees) drawTree(ctx, this.sx(tr.x), this.sy(tr.y), s * 0.7, t);
    for (const f of world.fragments) {
      if (!f.alive) continue;
      const x = this.sx(f.x), y = this.sy(f.y);
      if (f.chained) {
        ctx.strokeStyle = rgba('#8a8f9e', 0.8);
        ctx.lineWidth = s * 0.05;
        ctx.setLineDash([s * 0.12, s * 0.06]);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + dx * s * 0.8, y + dy * s * 0.8);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        if (f.progress > 0) {
          ctx.strokeStyle = '#bfe8ff';
          ctx.lineWidth = s * 0.08;
          ctx.beginPath();
          ctx.arc(x, y, s * 0.6, -Math.PI / 2, -Math.PI / 2 + f.progress * Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#9fdcff', x, y, s * 0.7, 0.8);
      ctx.restore();
      drawShard(ctx, x, y, s * 0.28, '#9fdcff', t);
    }
  }

  private drawAura(world: World, view: ViewState, t: number): void {
    if (world.auraR < 0.1) return;
    const ctx = this.ctx, p = world.player, r = world.auraR * this.scale;
    const x = this.sx(p.x), y = this.sy(p.y);
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    const color = view.fx.bandPeace > 0.3 ? '#9ff0d0' : '#d8f0ff';
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.75, rgba(color, 0.08));
    g.addColorStop(1, rgba(color, 0.22 + 0.06 * Math.sin(t * 2)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTraumas(world: World, t: number): void {
    const ctx = this.ctx, s = this.scale, p = world.player;
    ctx.font = `600 ${Math.max(8, s * 0.24)}px Cinzel, serif`;
    ctx.textAlign = 'center';
    for (const tr of world.traumas) {
      const color = this.traumaColors.get(tr.kind) ?? tr.def.color;
      const size = tr.r * 2.6 * s;
      const x = this.sx(tr.x), y = this.sy(tr.y);
      let alpha = 1;
      if (tr.state === 'spawn') alpha = Math.max(0, 1 - tr.t / 0.8);
      const flicker = tr.state === 'fright' && world.graceT < 1.5 && Math.sin(t * 20) > 0;
      const state = tr.state === 'fright' ? (flicker ? 'weak' : 'fright') : tr.state === 'weak' ? 'weak' : 'normal';
      const frame = Math.floor((t + tr.phase) * 5) % 2;
      ctx.globalAlpha = alpha;
      if (tr.state === 'normal') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, color, x, y, size * 0.75, 0.35);
        ctx.restore();
      }
      const bob = Math.sin(t * 3 + tr.phase) * s * 0.04;
      ctx.drawImage(ghostSprite(color, state, frame), x - size / 2, y - size / 2 + bob, size, size);
      ghostEyes(ctx, x, y + bob, size, p.x - tr.x, p.y - tr.y, color, tr.state === 'fright' && !flicker ? 'fright' : state, t);
      if (tr.state === 'normal' || tr.state === 'weak') {
        ctx.fillStyle = tr.state === 'weak' ? rgba('#ffffff', 0.85) : rgba(color, 0.9);
        ctx.fillText(tr.def.name.toUpperCase(), x, y - size * 0.55 + bob);
      }
      if (tr.state === 'weak') {
        // the time left to eat it
        ctx.strokeStyle = rgba('#ffffff', 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + bob, size * 0.62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, tr.t / 5));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawBoss(world: World, t: number): void {
    const b = world.boss;
    if (!b || b.eaten) return;
    const ctx = this.ctx, s = this.scale;
    const x = this.sx(b.x), y = this.sy(b.y), size = b.r * 2.6 * s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, b.cracked ? '#fff3c4' : this.palette.accent, x, y, size * (b.cracked ? 1.2 : 0.9), b.revealT > 0 ? 0.9 : 0.4);
    ctx.restore();
    if (b.telegraphT > 0) {
      ctx.strokeStyle = rgba('#ff8a8a', 0.6);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + b.chargeX * s * 5, y + b.chargeY * s * 5);
      ctx.stroke();
    }
    ctx.drawImage(ghostSprite(this.palette.accent, b.cracked ? 'weak' : 'normal', Math.floor(t * 3) % 2), x - size / 2, y - size / 2, size, size);
    // crown of the stronghold
    ctx.fillStyle = b.cracked ? rgba('#ffffff', 0.6) : this.palette.accent;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const cx = x - size * 0.3 + (i * size * 0.6) / 4;
      ctx.moveTo(cx - size * 0.06, y - size * 0.36);
      ctx.lineTo(cx, y - size * 0.52);
      ctx.lineTo(cx + size * 0.06, y - size * 0.36);
    }
    ctx.fill();
    ghostEyes(ctx, x, y, size, world.player.x - b.x, world.player.y - b.y, this.palette.accent, b.cracked ? 'weak' : 'normal', t);
    // cracks grow as the lie weakens
    const cracks = Math.floor((1 - b.hp / b.maxHp) * 6);
    ctx.strokeStyle = rgba('#fff3c4', 0.85);
    ctx.lineWidth = 2;
    for (let i = 0; i < cracks; i++) {
      const a = i * 1.1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * size * 0.1, y + Math.sin(a) * size * 0.1);
      ctx.lineTo(x + Math.cos(a + 0.3) * size * 0.3, y + Math.sin(a + 0.3) * size * 0.32);
      ctx.lineTo(x + Math.cos(a - 0.2) * size * 0.42, y + Math.sin(a - 0.2) * size * 0.4);
      ctx.stroke();
    }
    // the lie, on a banner under the stronghold
    ctx.font = `600 ${Math.max(9, s * 0.26)}px "EB Garamond", serif`;
    ctx.textAlign = 'center';
    const lines = wrap(ctx, `„${b.lie}”`, s * 6);
    const by = y + size * 0.62;
    ctx.fillStyle = rgba('#000000', 0.55);
    roundRect(ctx, x - s * 3.2, by - s * 0.25, s * 6.4, lines.length * s * 0.32 + s * 0.2, s * 0.15);
    ctx.fill();
    ctx.fillStyle = b.revealT > 0 || b.cracked ? '#fff3c4' : '#e8e2f0';
    lines.forEach((l, i) => {
      ctx.fillText(l, x, by + s * 0.05 + i * s * 0.32);
      if (b.revealT > 0 || b.cracked) {
        const w = ctx.measureText(l).width;
        ctx.strokeStyle = rgba('#ffd76a', 0.9);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, by + i * s * 0.32 - s * 0.03);
        ctx.lineTo(x + w / 2, by + i * s * 0.32 - s * 0.03);
        ctx.stroke();
      }
    });
  }

  private drawShots(world: World): void {
    const ctx = this.ctx, s = this.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sh of world.shots) {
      const x = this.sx(sh.x), y = this.sy(sh.y);
      const color = sh.kind === 'dove' ? '#ffffff' : sh.kind === 'stone' ? '#d9d2c3' : sh.kind === 'tree' ? '#9ff0a8' : this.palette.accent;
      const sp = Math.hypot(sh.vx, sh.vy) || 1;
      ctx.strokeStyle = rgba(color, 0.65);
      ctx.lineWidth = s * (sh.kind === 'word' ? 0.11 : 0.08);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (sh.vx / sp) * s * 0.55, y - (sh.vy / sp) * s * 0.55);
      ctx.stroke();
      drawGlow(ctx, color, x, y, s * (sh.kind === 'stone' ? 0.35 : 0.28), 0.9);
    }
    for (const a of world.arrows) {
      const x = this.sx(a.x), y = this.sy(a.y), sp = Math.hypot(a.vx, a.vy) || 1;
      ctx.strokeStyle = rgba('#ff7a3c', 0.8);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (a.vx / sp) * s * 0.5, y - (a.vy / sp) * s * 0.5);
      ctx.stroke();
      drawGlow(ctx, '#ff7a3c', x, y, s * 0.3, 0.9);
    }
    ctx.restore();
  }

  private drawAngelAndShields(world: World, view: ViewState, t: number): void {
    const ctx = this.ctx, s = this.scale, p = world.player;
    for (const sh of world.shieldPositions()) {
      const x = this.sx(sh.x), y = this.sy(sh.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#cfe8ff', x, y, s * 0.45, 0.8);
      ctx.restore();
      ctx.fillStyle = '#e8f4ff';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.2);
      ctx.lineTo(x + s * 0.16, y - s * 0.1);
      ctx.lineTo(x + s * 0.12, y + s * 0.12);
      ctx.lineTo(x, y + s * 0.2);
      ctx.lineTo(x - s * 0.12, y + s * 0.12);
      ctx.lineTo(x - s * 0.16, y - s * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    if (world.pentecostT > 0) {
      // tongues of fire above the angel (Dz 2,3)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = t * 2 + (i * Math.PI) / 3;
        drawGlow(ctx, '#ffb347', this.sx(p.x + Math.cos(a) * 0.8), this.sy(p.y + Math.sin(a) * 0.8) - s * 0.2, s * 0.45, 0.8);
      }
      ctx.restore();
    }
    const blink = p.iFrames > 0 && Math.sin(t * 30) > 0.3;
    const pulse = view.fx.heartBpm ? Math.max(0, Math.sin((t * view.fx.heartBpm / 60) * Math.PI * 2)) ** 4 : 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.globalCompositeOperation = 'source-over';
    const x = this.sx(p.x), y = this.sy(p.y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, this.look.halo[1], x, y, s * 1.1, 0.35 + 0.15 * world.peace);
    ctx.restore();
    drawAngel(ctx, x, y + s * 0.05, s * 0.95, this.look, t, p.moving, p.still > 0.3, pulse);
    ctx.restore();
  }

  private drawEffects(): void {
    const ctx = this.ctx, s = this.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.life / r.max;
      ctx.lineWidth = r.width * s;
      ctx.beginPath();
      ctx.arc(this.sx(r.x), this.sy(r.y), (r.r0 + (r.r1 - r.r0) * k) * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const b of this.bolts) {
      ctx.strokeStyle = rgba('#fff3b0', b.life / 0.25);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      let x = this.sx(b.x), y = this.sy(0);
      ctx.moveTo(x, y);
      const ty = this.sy(b.y), steps = 7;
      for (let i = 1; i <= steps; i++) {
        y = this.sy(0) + ((ty - this.sy(0)) * i) / steps;
        x = this.sx(b.x) + (i < steps ? Math.sin(b.seed + i * 12.9) * s * 0.35 : 0);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (const p of this.particles) {
      drawGlow(ctx, p.color, this.sx(p.x), this.sy(p.y), p.size * s * 2.2, p.life / p.max);
    }
    ctx.restore();
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life / tx.max * 1.6);
      ctx.font = `700 ${Math.max(10, tx.size * s)}px Cinzel, serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba('#000000', 0.5);
      ctx.fillText(tx.text, this.sx(tx.x) + 1.5, this.sy(tx.y) + 1.5);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, this.sx(tx.x), this.sy(tx.y));
    }
    ctx.globalAlpha = 1;
  }

  private drawTints(world: World): void {
    const ctx = this.ctx;
    const tint = (color: string, a: number) => {
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.3, this.w / 2, this.h / 2, this.h * 0.8);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(1, rgba(color, a));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    };
    if (world.graceT > 0) tint('#cfe6ff', 0.22 * Math.min(1, world.graceT));
    if (world.pentecostT > 0) tint('#ffb347', 0.2);
    if (this.hurtFlash > 0) tint('#ff6b81', this.hurtFlash * 0.7);
    if (this.revealFlash > 0) tint('#fff3c4', this.revealFlash * 0.5);
  }

  private drawJoystick(j: Joystick): void {
    const ctx = this.ctx;
    ctx.strokeStyle = rgba('#ffffff', 0.25);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.3);
    ctx.beginPath();
    ctx.arc(j.x, j.y, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── HUD ─────────────────────────────────────────────────────────
  private drawHud(world: World, view: ViewState, t: number): void {
    const ctx = this.ctx, run = world.run, W = this.w;
    ctx.textBaseline = 'middle';
    // hearts
    for (let i = 0; i < run.maxHearts; i++) heart(ctx, 18 + i * 22, 22, 9, i < run.hearts ? '#ff7a90' : rgba('#ffffff', 0.18));
    // level and light
    ctx.font = '600 13px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a0';
    ctx.fillText(`Poziom ${run.level}`, W / 2, 16);
    const bw = Math.min(160, W * 0.36), bx = W / 2 - bw / 2;
    ctx.fillStyle = rgba('#ffffff', 0.12);
    roundRect(ctx, bx, 26, bw, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    roundRect(ctx, bx, 26, bw * Math.min(1, run.xp / run.xpNeed), 6, 3);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff6d6';
    ctx.fillText(`✦ ${Math.floor(run.light)}`, W - 14, 18);
    // second row: digestion, fragments, rooms
    for (let i = 0; i < world.stomachCap; i++) {
      const meal = world.stomach[i];
      const x = 18 + i * 20, y = 48;
      ctx.strokeStyle = rgba('#ffffff', 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
      if (meal) {
        const c = meal.kind === 'boss' ? '#ffffff' : this.traumaColors.get(meal.kind) ?? '#ffffff';
        ctx.fillStyle = rgba(c, 0.85);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (i === 0 ? meal.p : 0.02));
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.textAlign = 'center';
    ctx.font = '500 12px "EB Garamond", serif';
    ctx.fillStyle = '#bfe8ff';
    ctx.fillText(`◆ ${run.stats.fragments}`, W / 2, 48);
    for (let i = 0; i < run.rooms.length; i++) {
      const x = W - 14 - (run.rooms.length - 1 - i) * 12;
      ctx.fillStyle = i < run.roomIndex ? '#ffe9a0' : i === run.roomIndex ? '#ffffff' : rgba('#ffffff', 0.2);
      ctx.beginPath();
      ctx.arc(x, 48, run.rooms[i] === 'boss' ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // grace timer
    if (world.graceT > 0) {
      ctx.fillStyle = rgba('#ffffff', 0.85);
      roundRect(ctx, W / 2 - 60, 60, 120 * Math.min(1, world.graceT / GRACE_TIME), 4, 2);
      ctx.fill();
    }
    // stronghold bar
    const b = world.boss;
    if (b && !b.eaten) {
      const y = this.oy - 4;
      ctx.font = '600 12px Cinzel, serif';
      ctx.fillStyle = this.palette.accent;
      ctx.fillText(b.name, W / 2, y - 16);
      ctx.fillStyle = rgba('#ffffff', 0.12);
      roundRect(ctx, W / 2 - 110, y - 8, 220, 6, 3);
      ctx.fill();
      ctx.fillStyle = b.revealT > 0 ? '#fff3c4' : this.palette.accent;
      roundRect(ctx, W / 2 - 110, y - 8, 220 * (b.hp / b.maxHp), 6, 3);
      ctx.fill();
    }
    // bottom: Spirit meter, peace, band
    const by = this.h - HUD_BOTTOM / 2;
    if (view.showSpirit) {
      const sw = Math.min(150, W * 0.38);
      ctx.fillStyle = rgba('#ffffff', 0.12);
      roundRect(ctx, 16, by - 4, sw, 8, 4);
      ctx.fill();
      const g = ctx.createLinearGradient(16, 0, 16 + sw, 0);
      g.addColorStop(0, '#ff9a3c');
      g.addColorStop(1, '#ffe08a');
      ctx.fillStyle = g;
      roundRect(ctx, 16, by - 4, sw * (run.spirit / 100), 8, 4);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.font = '600 11px Cinzel, serif';
      ctx.fillStyle = run.spirit >= 100 ? '#ffe08a' : rgba('#ffffff', 0.7);
      ctx.fillText(view.fx.bandSpirit > 0.2 ? 'Duch · skupienie' : 'Duch', 16, by - 14);
    }
    if (view.bandConnected) {
      ctx.textAlign = 'left';
      ctx.font = '500 11px "EB Garamond", serif';
      ctx.fillStyle = view.fx.bandActive ? '#9ff0d0' : rgba('#ffffff', 0.45);
      const pulse = view.fx.heartBpm ? ` · ♥ ${Math.round(view.fx.heartBpm)}` : '';
      ctx.fillText(`${view.fx.bandActive ? 'Opaska: pokój ' + Math.round(view.fx.bandPeace * 100) + '%' : 'Opaska: czekam na sygnał'}${pulse}`, 16, by + 16);
    }
    // Sabbath progress
    if (world.kind === 'sabbath' && !world.sabbathBlessed) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bff2d0';
      ctx.font = '600 12px Cinzel, serif';
      ctx.fillText(`Odpoczynek ${Math.floor(world.restTime)} / ${SABBATH_REST} s`, W / 2, this.oy + ROOM_H * this.scale + 14);
    }
    if (world.kind === 'rescue' && world.rescueLeft > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bfe8ff';
      ctx.font = '600 12px Cinzel, serif';
      ctx.fillText(`Wytrwaj ${Math.ceil(world.rescueLeft)} s`, W / 2, this.oy + ROOM_H * this.scale + 14);
    }
    if (view.hint) {
      ctx.textAlign = 'center';
      ctx.font = '500 14px "EB Garamond", serif';
      ctx.fillStyle = rgba('#ffffff', 0.75 + 0.2 * Math.sin(t * 2));
      ctx.fillText(view.hint, W / 2, this.h - 12);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.fill();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
