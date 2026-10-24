/**
 * Geoda's picture, canvas 2D without assets: the cave and the geode's rim (pre-rendered on
 * resize), the shaft of light from the crack — warm in a Wzrost, cool in a Szlif, turning during
 * the telegraphs and brightening with the drip — the wall's cells as cached sprites, full lines
 * glowing until the Zbiór shatters them (the cleared lines lie as rubble through the rest and
 * regrow in the telegraph, so the next puzzle is not planned while resting), the tray with its
 * stalactites, drops and sprouting seeds, the Szlif's deep mist and polishing bowl, and the
 * calibration's "Kropla"; the HUD (hud.ts) and the finisher (finale.ts) on top.  It reads the sim
 * and the player's hand; the game forwards the sim's events for the juice.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease, Floaters, lerp, Particles, Shake } from '../kit/juice';
import {
  drawGeode, druse, fitFont, fitLines, GEODE_REACH, GEODE_SEED, geodePath, hash, MONO, mix, rgba, ROCK_VARIANTS, rrect, rrectPath, SANS, SERIF, sparkle, TAU, TileCache,
  WALL_BED,
} from './art';
import { CLARITY, GEMS, REST_TIPS, type Pt } from './content';
import { drawFinale, type FinaleView } from './finale';
import { drawHint, drawHud, PHASE_COLOR, POLISH_ON } from './hud';
import { t } from './i18n';
import { trayBand, trayCellFor, type Layout, type Rect } from './layout';
import { clarityOf, complete, crystalCells, prefixOffset, type BowlGem, type GeodaEvent, type GeodaSim } from './sim';
import { GEM, grabCell, N, ROCK } from './wall';

/** What the player's hands are doing (the game owns it). */
export interface Hand {
  /** a crystal in the hand: the finger, the snapped anchor on the wall, whether it fits there */
  drag: { slot: number; x: number; y: number; anchor: Pt | null; valid: boolean } | null;
  /** a press on a tray crystal; at k = 1 it crumbles */
  press: { slot: number; k: number } | null;
  /** the keyboard's cursor (a wall cell) */
  cursor: Pt | null;
  /** a crystal sliding back to the tray after a drop that did not fit (k 0..1) */
  back: { slot: number; x: number; y: number; k: number } | null;
  /** a line of guidance (strategies, the first session's steps) */
  hint: string | null;
  /** wall cells to aim for (the first session's gap) */
  target: number[];
}

interface Drop { x: number; y: number; vy: number; to: number; slot: number; live: boolean }
/** A caption over the wall: a title (may be empty) and a smaller line; `zbior` = the harvest's own. */
interface Caption { text: string; sub: string; t: number; color: string; zbior: boolean }

/** A stable stone for each wall cell. */
const rockVariant = (i: number): number => (i * 7 + (i >> 3) * 3) % ROCK_VARIANTS;
/** How much of a stone the rubble of a cleared line shows (it hides where the new gaps are). */
const RUBBLE = 0.3;
/** The Szlif's mist over the wall and the tray, at its fullest. */
const MIST = 0.88;
/** The block's verdict under the Zbiór's caption (none without enough reliable data). */
const verdictLine = (ok: boolean | null): string => (ok === true ? t('verdict.steady') : ok === false ? t('verdict.uneven') : '');

export class GeodaRenderer {
  private w = 1;
  private h = 1;
  private dpr = 1;
  private l: Layout | null = null;
  private bg: HTMLCanvasElement | null = null;
  readonly tiles = new TileCache();
  readonly particles = new Particles(520);
  readonly floaters = new Floaters();
  private readonly shake: Shake;
  private t = 0;
  private readonly pops = new Map<number, number>();
  private readonly flashes = new Map<number, number>();
  /** the cleared lines: rubble while `held` (the Zbiór and the rest), then the regrowth (t 0..1) */
  private regrow = { t: 1, age: 0, held: false, cells: new Set<number>(), full: false };
  private readonly trayPop = [0, 0, 0];
  private readonly wiggle = [0, 0, 0];
  /** the last "kiełkuje" floater (s ago): taps on a sprouting tray say it once in a while */
  private waitT = 9;
  /** the empty slots' seed sprites, per size */
  private readonly seeds = new Map<number, HTMLCanvasElement>();
  private readonly drops: Drop[] = Array.from({ length: 12 }, () => ({ x: 0, y: 0, vy: 0, to: 0, slot: 0, live: false }));
  private dripIn = 0;
  /** the tray's cell size (px), fitted to the longest crystal there */
  private cs = 16;
  private warm = 1;
  private light = 0.1;
  private mist = 0;
  private bowlK = 0;
  private bowl: BowlGem[] = [];
  private polishT = -1;
  private shown = 0;
  private caption: Caption | null = null;
  private reveal: { slot: number; text: string; t: number } | null = null;
  private introDrop = { y: 0, vy: 0, splash: -1 };
  /** a drop landed (the game plays it) */
  onSplash: ((pitch: number) => void) | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D, private readonly still: boolean) {
    this.shake = new Shake(still);
  }

  resize(w: number, h: number, dpr: number, l: Layout): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.l = l;
    this.tiles.setDpr(dpr);
    this.seeds.clear();
    this.bg = this.buildBackground();
    for (const d of this.drops) d.live = false;
  }

  // ── events ────────────────────────────────────────────────────
  onEvent(e: GeodaEvent, sim: GeodaSim): void {
    const l = this.l;
    if (!l) return;
    const cellXY = (i: number) => [l.wall.x + (i % N) * l.cell + l.cell / 2, l.wall.y + Math.floor(i / N) * l.cell + l.cell / 2] as const;
    switch (e.type) {
      case 'wzrost':
        this.caption = { text: t('block.wzrost'), sub: e.blind ? t('caption.blind') : '', t: 0, color: PHASE_COLOR.wzrost, zbior: false };
        for (const s of e.refill) this.trayPop[s] = 1;
        break;
      case 'grow':
      case 'sprout':
        if (!e.hidden) this.trayPop[e.slot] = 1;
        break;
      case 'place': {
        let sx = 0, sy = 0;
        for (const i of e.cells) {
          this.pops.set(i, 0);
          const [x, y] = cellXY(i);
          sx += x;
          sy += y;
          if (!this.still) this.particles.burst(x, y, 4, { color: rgba(GEMS[sim.wall.cells[i].gem].light, 0.9), size: 2, speed: 90, g: 0, drag: 4, life: 0.5, shape: 'spark' });
        }
        this.floaters.add(`+${e.carats} ct`, sx / e.cells.length, sy / e.cells.length - l.cell * 0.3, { color: '#fff3d6', size: Math.round(clamp(l.cell * 0.42, 15, 26)), dur: 1 });
        break;
      }
      case 'nofit': {
        this.wiggle[e.slot] = 1;
        if (e.cell >= 0) {
          const [x, y] = cellXY(e.cell);
          this.floaters.add(t('float.nofit'), x, y, { color: 'rgba(239,232,220,0.75)', size: Math.round(clamp(l.cell * 0.3, 12, 17)), dur: 0.9 });
        }
        break;
      }
      case 'wait': {
        // nothing in the tray to set yet: the seed in the fed slot pulses, now and then a word
        this.trayPop[e.slot] = 1;
        if (e.cell >= 0 && this.waitT > 1.6) {
          this.waitT = 0;
          const [x, y] = cellXY(e.cell);
          this.floaters.add(t('float.sprouting'), x, y, { color: 'rgba(214,190,255,0.85)', size: Math.round(clamp(l.cell * 0.3, 12, 17)), dur: 1 });
        }
        break;
      }
      case 'crumble': {
        const r = l.slots[e.slot];
        this.particles.burst(r.x + r.w / 2, r.y + r.h / 2, 18, { color: '#8a7a6a', size: 2.4, speed: 120, g: 500, life: 0.7, shape: 'square' });
        this.trayPop[e.slot] = 1;
        break;
      }
      case 'reveal': {
        this.reveal = { slot: e.slot, text: t('tray.reveal', { grown: e.grown, total: e.total, clarity: CLARITY[e.clarity] }), t: 0 };
        this.trayPop[e.slot] = 1;
        break;
      }
      case 'zbior':
        this.caption = e.lines.length ? { text: e.full ? t('full.title') : t('block.zbior'), sub: '', t: 0, color: PHASE_COLOR.zbior, zbior: true } : null;
        break;
      case 'verdict': {
        // the Wzrost's judgement under the Zbiór's caption, or alone when no line breaks
        const line = e.kind === 'focus' ? verdictLine(e.ok) : '';
        if (!line) break;
        if (this.caption?.zbior) this.caption.sub = line;
        else this.caption = { text: '', sub: line, t: 0, color: PHASE_COLOR.zbior, zbior: true };
        break;
      }
      case 'shatter': {
        this.flashes.set(e.line, 0);
        for (const c of e.cells) {
          const [x, y] = cellXY(c.i);
          if (c.k === GEM) {
            const g = GEMS[c.gem];
            this.particles.burst(x, y, this.still ? 4 : 9, { color: g.light, size: 2.6, speed: 230, g: 640, drag: 1.4, life: 0.85, shape: 'spark' });
            this.particles.burst(x, y, this.still ? 2 : 5, { color: g.base, size: 3.2, speed: 160, g: 760, life: 0.9, shape: 'square' });
          } else {
            this.particles.burst(x, y, this.still ? 2 : 4, { color: hash(c.i) > 0.5 ? '#7a6a5c' : '#5a4d43', size: 2.8, speed: 140, g: 900, life: 0.8, shape: 'square' });
          }
        }
        this.shake.add(0.16);
        break;
      }
      case 'bonus': {
        // under the Zbiór's caption: the number rises 46 px and must not run into the verdict (a short wall on a phone's side)
        const size = Math.round(clamp(l.cell * 0.62, 20, 40)), verdict = l.wall.y + l.wall.h * 0.22 + clamp(l.cell * 0.48, 20, 30);
        const x = l.wall.x + l.wall.w / 2, y = Math.max(l.wall.y + l.wall.h * 0.42, verdict + 52 + size / 2);
        // a single line has no bonus (its crystals paid when set): no "+0 ct", only the burst
        const mult = 1 + e.mult;
        if (e.carats > 0) this.floaters.add(`×${fmtNum(mult, Number.isInteger(mult) ? 0 : 1)}  +${e.carats} ct`, x, y, { color: '#ffd48a', size, dur: 1.6 });
        if (!this.still) {
          for (let i = 0; i < Math.min(4, e.lines); i++) {
            const g = GEMS[i % GEMS.length];
            this.particles.burst(x, y, 16, { color: g.base, size: 3, speed: 330, angle: -Math.PI / 2, spread: Math.PI * 1.2, g: 520, life: 1.3, shape: 'square' });
          }
          this.shake.add(0.25);
        }
        break;
      }
      case 'regrow':
        // the new rock and its gaps stay rubble until the telegraph of the next Wzrost
        this.regrow = { t: 0, age: 0, held: true, cells: new Set(e.full ? sim.wall.cells.map((_, i) => i) : e.cleared), full: e.full };
        break;
      case 'szlif':
        this.bowl = e.gems.map(g => ({ ...g }));
        this.caption = null;
        break;
      case 'polish': {
        this.polishT = 0;
        const b = this.bowl.find(g => g.piece === e.piece);
        if (b) b.polish = e.polish;
        break;
      }
      default:
        break;
    }
  }

  // ── the frame ─────────────────────────────────────────────────
  draw(sim: GeodaSim, hand: Hand, finale: FinaleView | null, dt: number): void {
    const { ctx } = this;
    const l = this.l;
    if (!l || !this.bg) return;
    this.t += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    this.tick(sim, dt);
    const off = this.shake.offset(dt, 9);
    ctx.save();
    ctx.translate(off.x, off.y);
    this.drawShaft();
    this.drawWall(sim);
    this.drawLines(sim);
    this.drawPreview(sim, hand);
    this.drawTray(sim, hand);
    this.drawDrops();
    this.drawSzlif(sim);
    ctx.restore();
    drawHint(ctx, l, hand.hint, drawHud(ctx, l, sim, this.shown));
    this.drawCaption(dt);
    this.drawHand(sim, hand);
    this.particles.update(dt);
    this.particles.draw(ctx);
    this.floaters.update(dt);
    this.floaters.draw(ctx, SERIF);
    if (sim.phase === 'finale' || sim.phase === 'done') drawFinale(ctx, sim, finale, this.w, this.h, this.dpr, this.still);
  }

  private tick(sim: GeodaSim, dt: number): void {
    let extW = 2, extH = 2;
    for (const c of sim.tray) if (c) for (const [x, y] of c.ghost) { extW = Math.max(extW, x + 1); extH = Math.max(extH, y + 1); }
    this.cs = trayCellFor(this.l!, extW, extH);
    for (const [i, t] of this.pops) {
      if (t + dt > 0.5) this.pops.delete(i);
      else this.pops.set(i, t + dt);
    }
    for (const [i, t] of this.flashes) {
      if (t + dt > 0.6) this.flashes.delete(i);
      else this.flashes.set(i, t + dt);
    }
    // the rubble regrows when the next Wzrost is announced, not before: the rest stays a rest
    const rg = this.regrow;
    rg.age += dt;
    if (rg.held && (sim.phase === 'wzrost' || sim.telegraph?.to === 'wzrost')) rg.held = false;
    if (!rg.held) rg.t = Math.min(1, rg.t + dt / 0.9);
    this.waitT += dt;
    for (let s = 0; s < 3; s++) {
      this.trayPop[s] = Math.max(0, this.trayPop[s] - dt / 0.35);
      this.wiggle[s] = Math.max(0, this.wiggle[s] - dt / 0.45);
    }
    if (this.polishT >= 0) this.polishT += dt;
    if (this.reveal) {
      this.reveal.t += dt;
      if (this.reveal.t > 3) this.reveal = null;
    }
    this.shown = sim.carats < this.shown ? sim.carats : approach(this.shown, sim.carats, dt, 0.18);
    // the light: warm for a Wzrost, cool for a Szlif, turning through the telegraph
    const tg = sim.telegraph;
    let warm = sim.phase === 'szlif' ? 0 : 1;
    if (tg) warm = lerp(warm, tg.to === 'wzrost' ? 1 : 0, tg.k);
    if (sim.phase === 'finale' || sim.phase === 'done') warm = 0.5;
    this.warm = approach(this.warm, warm, dt, 0.5);
    const want = sim.phase === 'wzrost' ? (sim.blindSlot >= 0 ? 0.07 : 0.07 + 0.11 * clamp(sim.drip / 3.5)) : sim.phase === 'zbior' ? 0.2 : 0.07;
    this.light = approach(this.light, want, dt, 0.6);
    const mistWant = sim.phase === 'szlif' ? (tg ? 1 - tg.k : 1) : 0;
    this.mist = approach(this.mist, mistWant, dt, 0.5);
    this.bowlK = approach(this.bowlK, sim.phase === 'szlif' && (!tg || tg.k < 0.5) ? 1 : 0, dt, 0.35);
    // drops fall from the stalactite over the crystal the water runs to
    const target = sim.phase === 'wzrost' && sim.blindSlot < 0 ? sim.growTarget() : -1;
    if (target >= 0 && sim.drip > 0.05) {
      this.dripIn -= dt * sim.drip;
      if (this.dripIn <= 0) {
        this.dripIn += 1;
        this.spawnDrop(sim, target);
      }
    }
    const g = this.still ? 520 : 900;
    for (const d of this.drops) {
      if (!d.live) continue;
      d.vy += g * dt;
      d.y += d.vy * dt;
      if (d.y >= d.to) {
        d.live = false;
        if (!this.still) this.particles.burst(d.x, d.to, 3, { color: 'rgba(200,225,255,0.8)', size: 1.4, speed: 60, angle: -Math.PI / 2, spread: 2.2, g: 400, life: 0.35 });
        this.onSplash?.(hash(this.t * 13.7));
      }
    }
  }

  private spawnDrop(sim: GeodaSim, slot: number): void {
    const l = this.l!, r = l.slots[slot];
    const d = this.drops.find(x => !x.live);
    if (!d) return;
    const c = sim.tray[slot], band = trayBand(l, r);
    // onto the crystal's top cell, or the seed sprouting in the middle of an empty slot
    let top = (band.top + band.bottom) / 2 - this.seedRadius(r) * 0.6;
    if (c) {
      const [, oy] = this.crystalOrigin(r, c.ghost);
      top = oy + Math.min(...c.ghost.slice(0, c.grown).map(p => p[1])) * this.cs + 2;
    }
    d.live = true;
    d.slot = slot;
    d.x = r.x + r.w / 2;
    d.y = r.y + 16;
    d.vy = 0;
    d.to = Math.max(d.y + 6, top);
  }

  // ── background ────────────────────────────────────────────────
  private buildBackground(): HTMLCanvasElement {
    const l = this.l!;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(this.w * this.dpr));
    c.height = Math.max(1, Math.round(this.h * this.dpr));
    const x = c.getContext('2d')!;
    x.scale(this.dpr, this.dpr);
    const cx = l.wall.x + l.wall.w / 2, cy = l.wall.y + l.wall.h / 2;
    const g = x.createRadialGradient(cx, cy, l.wall.w * 0.25, cx, cy, Math.max(this.w, this.h) * 0.9);
    g.addColorStop(0, '#251b36');
    g.addColorStop(0.45, '#171124');
    g.addColorStop(1, '#0a0710');
    x.fillStyle = g;
    x.fillRect(0, 0, this.w, this.h);
    // the cave's walls: soft dark and pale blotches
    for (let i = 0; i < 18; i++) {
      const bx = hash(i * 2.3) * this.w, by = hash(i * 5.1) * this.h, br = (0.12 + hash(i * 7.7) * 0.25) * Math.max(this.w, this.h);
      const b = x.createRadialGradient(bx, by, 0, bx, by, br);
      b.addColorStop(0, i % 3 ? 'rgba(0,0,0,0.22)' : 'rgba(160,130,200,0.035)');
      b.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = b;
      x.fillRect(0, 0, this.w, this.h);
    }
    drawGeode(x, l.wall, l.rim);
    // the tray's ledge, in front of the geode
    this.drawLedge(x, l);
    // the crack at the top of the rim, where the light and the water come in
    x.strokeStyle = '#0b0710';
    x.lineWidth = Math.max(2, l.rim * 0.32);
    x.lineJoin = 'round';
    x.beginPath();
    const top = l.wall.y - l.rim * GEODE_REACH, steps = 5;
    for (let i = 0; i <= steps; i++) {
      const yy = lerp(top, l.wall.y - 4, i / steps), xx = cx + (i % 2 ? 1 : -1) * l.rim * 0.28 * (i && i < steps ? 1 : 0);
      if (i) x.lineTo(xx, yy); else x.moveTo(xx, yy);
    }
    x.stroke();
    return c;
  }

  private drawLedge(x: CanvasRenderingContext2D, l: Layout): void {
    const s0 = l.slots[0], s2 = l.slots[2];
    const pad = 9;
    const lx = s0.x - pad, ly = s0.y - pad, lw = s2.x + s2.w - s0.x + 2 * pad, lh = s2.y + s2.h - s0.y + 2 * pad;
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.55)';
    x.shadowBlur = 18;
    x.shadowOffsetY = 6;
    rrect(x, lx, ly, lw, lh, 20);
    const g = x.createLinearGradient(lx, ly, lx, ly + lh);
    g.addColorStop(0, '#3a312b');
    g.addColorStop(1, '#231d19');
    x.fillStyle = g;
    x.fill();
    x.restore();
    x.save();
    rrect(x, lx, ly, lw, lh, 20);
    x.clip();
    for (let i = 0; i < 90; i++) {
      x.fillStyle = hash(i * 3.3) > 0.5 ? 'rgba(255,236,214,0.05)' : 'rgba(0,0,0,0.25)';
      x.beginPath();
      x.arc(lx + hash(i * 1.9) * lw, ly + hash(i * 6.1) * lh, 0.8 + hash(i) * 2.2, 0, TAU);
      x.fill();
    }
    x.restore();
    for (const r of l.slots) {
      x.save();
      rrect(x, r.x, r.y, r.w, r.h, 14);
      x.fillStyle = '#100c15';
      x.fill();
      x.clip();
      const sh = x.createLinearGradient(0, r.y, 0, r.y + r.h * 0.4);
      sh.addColorStop(0, 'rgba(0,0,0,0.65)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = sh;
      x.fillRect(r.x, r.y, r.w, r.h);
      const glow = x.createRadialGradient(r.x + r.w / 2, r.y + r.h, 0, r.x + r.w / 2, r.y + r.h, r.w * 0.7);
      glow.addColorStop(0, 'rgba(155,93,229,0.08)');
      glow.addColorStop(1, 'rgba(155,93,229,0)');
      x.fillStyle = glow;
      x.fillRect(r.x, r.y, r.w, r.h);
      x.restore();
      rrect(x, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 14);
      x.strokeStyle = 'rgba(255,240,222,0.07)';
      x.lineWidth = 1;
      x.stroke();
      // the stalactite over the socket
      const sx = r.x + r.w / 2;
      x.fillStyle = '#4a4038';
      x.beginPath();
      x.moveTo(sx - 6, r.y);
      x.quadraticCurveTo(sx - 2, r.y + 6, sx, r.y + 14);
      x.quadraticCurveTo(sx + 2, r.y + 6, sx + 6, r.y);
      x.closePath();
      x.fill();
    }
  }

  // ── the wall ──────────────────────────────────────────────────
  private cellRect(i: number): Rect {
    const l = this.l!;
    return { x: l.wall.x + (i % N) * l.cell, y: l.wall.y + Math.floor(i / N) * l.cell, w: l.cell, h: l.cell };
  }

  /** The shaft of light from the crack: its colour telegraphs the blocks, its strength follows the drip. */
  private drawShaft(): void {
    const { ctx } = this;
    const l = this.l!;
    const cx = l.wall.x + l.wall.w / 2, top = l.wall.y - l.rim * GEODE_REACH, bot = l.wall.y + l.wall.h * 0.98;
    const a = this.light;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, mix('#9cc8ff', '#ffd48a', this.warm, Math.min(0.6, a * 2.4)));
    g.addColorStop(0.35, mix('#9cc8ff', '#ffd48a', this.warm, a));
    g.addColorStop(1, mix('#9cc8ff', '#ffd48a', this.warm, 0));
    ctx.fillStyle = g;
    const tw = l.wall.w * 0.05, bw = l.wall.w * 0.34, lean = l.wall.w * 0.06;
    ctx.beginPath();
    ctx.moveTo(cx - tw, top);
    ctx.lineTo(cx + tw, top);
    ctx.lineTo(cx + bw + lean, bot);
    ctx.lineTo(cx - bw + lean, bot);
    ctx.closePath();
    ctx.fill();
    // motes drifting in the light
    for (let i = 0; i < 14; i++) {
      const k = (hash(i * 3.1) + this.t * (0.012 + hash(i) * 0.02)) % 1;
      const y = lerp(top, bot, k), half = lerp(tw, bw, k);
      const x = cx + lean * k + (hash(i * 7.3) * 2 - 1) * half * 0.8 + Math.sin(this.t * 0.7 + i) * 3;
      ctx.fillStyle = mix('#9cc8ff', '#ffd48a', this.warm, Math.min(0.5, a * 3) * (1 - k));
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + hash(i * 2.2) * 1.2, 0, TAU);
      ctx.fill();
    }
    const cg = ctx.createRadialGradient(cx, top + l.rim, 0, cx, top + l.rim, l.rim * 4);
    cg.addColorStop(0, mix('#9cc8ff', '#ffd48a', this.warm, Math.min(0.8, a * 4)));
    cg.addColorStop(1, mix('#9cc8ff', '#ffd48a', this.warm, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(cx - l.rim * 4, top - l.rim * 3, l.rim * 8, l.rim * 8);
    ctx.restore();
  }

  private drawWall(sim: GeodaSim): void {
    const { ctx } = this;
    const l = this.l!, s = l.cell;
    const cells = sim.wall.cells;
    const rg = this.regrow, regrowing = rg.held || rg.t < 1;
    for (let i = 0; i < N * N; i++) {
      const c = cells[i], r = this.cellRect(i);
      this.tiles.draw(ctx, 'slate', i % 3, 0, r.x, r.y, s);
      if (regrowing && c.k !== GEM && (rg.full || rg.cells.has(i))) {
        // a cleared line: the same dim rubble on rock and gap alike, then the rock regrows and the gaps clear
        const k = rg.held ? 0 : ease.outCubic(clamp((rg.t - hash(i) * 0.35) / 0.65));
        const rubble = RUBBLE * clamp(rg.age / 0.4);
        ctx.globalAlpha = c.k === ROCK ? rubble + (1 - rubble) * k : rubble * (1 - k);
        this.tiles.drawScaled(ctx, 'rock', rockVariant(i), 0, r.x, r.y, s, c.k === ROCK ? 0.78 + 0.22 * k : 0.78);
        ctx.globalAlpha = 1;
      } else if (c.k === ROCK) {
        this.tiles.draw(ctx, 'rock', rockVariant(i), 0, r.x, r.y, s);
      } else if (c.k === GEM) {
        const p = this.pops.get(i);
        const k = p === undefined ? 1 : ease.outBack(clamp(p / 0.32));
        this.tiles.drawScaled(ctx, 'gem', c.gem, c.clarity, r.x, r.y, s, 0.55 + 0.45 * k);
      }
    }
    // a slow glint across the lśniące, a star on the polished
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N * N; i++) {
      const c = cells[i];
      if (c.k !== GEM) continue;
      const r = this.cellRect(i);
      if (c.clarity === 3) {
        const ph = (this.t * 0.35 + hash(i * 1.3) * 5) % 4;
        if (ph < 0.7) {
          const k = ph / 0.7, x = r.x + s * (k * 1.4 - 0.2);
          const gl = ctx.createLinearGradient(x - s * 0.2, r.y, x + s * 0.2, r.y + s);
          gl.addColorStop(0, 'rgba(255,255,255,0)');
          gl.addColorStop(0.5, 'rgba(255,255,255,0.35)');
          gl.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = gl;
          rrect(ctx, r.x + s * 0.06, r.y + s * 0.06, s * 0.88, s * 0.88, s * 0.15);
          ctx.fill();
        }
      }
      const piece = sim.pieces.get(c.piece);
      if (piece && piece.polish > 0 && piece.cells[0] === i) {
        const tw = 0.6 + 0.4 * Math.sin(this.t * 2.6 + i);
        sparkle(ctx, r.x + s * 0.78, r.y + s * 0.22, s * (0.12 + 0.05 * tw), `rgba(255,248,226,${(0.6 + 0.4 * tw).toFixed(2)})`);
      }
    }
    ctx.restore();
  }

  private lineRect(line: number): Rect {
    const l = this.l!;
    return line < N
      ? { x: l.wall.x, y: l.wall.y + line * l.cell, w: l.wall.w, h: l.cell }
      : { x: l.wall.x + (line - N) * l.cell, y: l.wall.y, w: l.cell, h: l.wall.h };
  }

  private drawLines(sim: GeodaSim): void {
    const { ctx } = this;
    const l = this.l!;
    const harvesting = sim.phase === 'zbior' && sim.harvest ? sim.harvest.lines.slice(sim.harvest.done) : [];
    const full = sim.phase === 'wzrost' || sim.phase === 'zbior' ? sim.wall.fullLines() : [];
    const glowing = new Set([...full, ...harvesting]);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const line of glowing) {
      const r = this.lineRect(line);
      const strong = harvesting.includes(line) ? 1 : 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.4 + line);
      ctx.fillStyle = `rgba(236,206,255,${(0.07 + 0.05 * pulse + 0.12 * strong).toFixed(3)})`;
      rrect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, l.cell * 0.2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,240,255,${(0.28 + 0.2 * pulse + 0.3 * strong).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // a bead of light running along the line
      const along = ((this.t * 0.45 + line * 0.13) % 1);
      const hx = line < N ? r.x + along * r.w : r.x + r.w / 2, hy = line < N ? r.y + r.h / 2 : r.y + along * r.h;
      const bead = ctx.createRadialGradient(hx, hy, 0, hx, hy, l.cell * 0.9);
      bead.addColorStop(0, 'rgba(255,245,255,0.28)');
      bead.addColorStop(1, 'rgba(255,245,255,0)');
      ctx.fillStyle = bead;
      ctx.fillRect(hx - l.cell, hy - l.cell, l.cell * 2, l.cell * 2);
    }
    for (const [line, t] of this.flashes) {
      const r = this.lineRect(line), k = 1 - t / 0.6;
      ctx.fillStyle = `rgba(255,250,255,${(0.75 * k * k).toFixed(3)})`;
      rrect(ctx, r.x, r.y, r.w, r.h, l.cell * 0.2);
      ctx.fill();
    }
    if (sim.phase === 'wzrost' && sim.toFull === 0) {
      // a Pełna geoda in the making: the whole wall glows until the Zbiór breaks it
      const pulse = this.still ? 0.5 : 0.5 + 0.5 * Math.sin(this.t * 2.2);
      ctx.fillStyle = `rgba(236,206,255,${(0.04 + 0.04 * pulse).toFixed(3)})`;
      rrect(ctx, l.wall.x, l.wall.y, l.wall.w, l.wall.h, l.cell * 0.2);
      ctx.fill();
      ctx.strokeStyle = `rgba(231,185,255,${(0.4 + 0.3 * pulse).toFixed(3)})`;
      ctx.lineWidth = 3;
      rrect(ctx, l.wall.x - 3, l.wall.y - 3, l.wall.w + 6, l.wall.h + 6, l.cell * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Where a crystal's ghost sits in a tray slot (top-left of its box). */
  private crystalOrigin(r: Rect, ghost: readonly Pt[]): [number, number] {
    const cs = this.cs, band = trayBand(this.l!, r);
    let gw = 0, gh = 0;
    for (const [x, y] of ghost) { gw = Math.max(gw, x + 1); gh = Math.max(gh, y + 1); }
    return [r.x + (r.w - gw * cs) / 2, band.top + (band.bottom - band.top - gh * cs) / 2];
  }

  /** The snapped ghost of the crystal in the hand (or at the key cursor), and the gap to aim for. */
  private drawPreview(sim: GeodaSim, hand: Hand): void {
    const { ctx } = this;
    const l = this.l!, s = l.cell;
    if (hand.target.length) {
      const a = 0.45 + 0.35 * Math.sin(this.t * 3.2);
      ctx.save();
      ctx.shadowColor = 'rgba(255,212,138,0.8)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = `rgba(255,212,138,${a.toFixed(3)})`;
      ctx.lineWidth = 2;
      for (const i of hand.target) {
        const r = this.cellRect(i);
        rrect(ctx, r.x + 3, r.y + 3, s - 6, s - 6, s * 0.18);
        ctx.stroke();
      }
      ctx.restore();
    }
    let slot = -1, anchor: Pt | null = null, valid = false;
    if (hand.drag && hand.drag.anchor) ({ slot, anchor, valid } = hand.drag);
    else if (hand.cursor && sim.phase === 'wzrost' && sim.placing >= 0) {
      // the crystal Space would set: the selected one, or the next while its slot sprouts
      slot = sim.placing;
      const cells = crystalCells(sim.tray[slot]!), g = grabCell(cells);
      anchor = [hand.cursor[0] - g[0], hand.cursor[1] - g[1]];
      valid = sim.wall.fits(cells, anchor[0], anchor[1]);
      const cr = this.cellRect(hand.cursor[1] * N + hand.cursor[0]);
      ctx.strokeStyle = 'rgba(255,212,138,0.9)';
      ctx.lineWidth = 2;
      rrect(ctx, cr.x + 1, cr.y + 1, s - 2, s - 2, s * 0.18);
      ctx.stroke();
    }
    const c = slot >= 0 ? sim.tray[slot] : null;
    if (!c || !anchor) return;
    const cells = crystalCells(c);
    for (let k = 0; k < cells.length; k++) {
      const x = l.wall.x + (anchor[0] + cells[k][0]) * s, y = l.wall.y + (anchor[1] + cells[k][1]) * s;
      if (valid) {
        ctx.globalAlpha = 0.42 + 0.12 * Math.sin(this.t * 6);
        this.tiles.draw(ctx, 'gem', c.gem, c.clarity[k], x, y, s);
        ctx.globalAlpha = 1;
      } else {
        // an invalid spot reads as a dashed outline, not only a colour
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(255,236,236,0.7)';
        ctx.lineWidth = 1.6;
        rrect(ctx, x + 3, y + 3, s - 6, s - 6, s * 0.16);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // ── Szlif ─────────────────────────────────────────────────────
  private drawSzlif(sim: GeodaSim): void {
    const { ctx } = this;
    const l = this.l!;
    if (this.mist < 0.01 && this.bowlK < 0.01) return;
    const d = l.rim * 1.12, rough = l.rim * 0.22;
    const wx = l.wall.x - d - rough, wy = l.wall.y - d - rough, ww = l.wall.w + 2 * (d + rough), wh = l.wall.h + 2 * (d + rough);
    const mist = `rgba(16,12,26,${(MIST * this.mist).toFixed(3)})`;
    ctx.save();
    // the mist fills the crust's outline and the wall's bed (one path, both outlines: their union),
    // so no corner cell is half in it
    geodePath(ctx, l.wall, d, rough, GEODE_SEED + 1);
    rrectPath(ctx, l.wall.x - WALL_BED, l.wall.y - WALL_BED, l.wall.w + 2 * WALL_BED, l.wall.h + 2 * WALL_BED, 8);
    ctx.clip();
    ctx.fillStyle = mist;
    ctx.fillRect(wx, wy, ww, wh);
    for (let i = 0; i < 5; i++) {
      const fx = wx + ((hash(i * 4.1) + this.t * (0.01 + i * 0.004)) % 1.3 - 0.15) * ww, fy = wy + (0.2 + hash(i * 2.7) * 0.7) * wh, fr = ww * (0.25 + hash(i) * 0.2);
      const f = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      f.addColorStop(0, `rgba(190,205,255,${(0.07 * this.mist).toFixed(3)})`);
      f.addColorStop(1, 'rgba(190,205,255,0)');
      ctx.fillStyle = f;
      ctx.fillRect(wx, wy, ww, wh);
    }
    ctx.restore();
    // and over the tray: its crystals wait unseen, nothing to plan in the rest
    const s0 = l.slots[0], s2 = l.slots[2];
    rrect(ctx, s0.x - 9, s0.y - 9, s2.x + s2.w - s0.x + 18, s2.y + s2.h - s0.y + 18, 20);
    ctx.fillStyle = mist;
    ctx.fill();
    if (this.bowlK < 0.01) return;
    // the polishing bowl: dark stone; the round's gems tumble in it and shine with calm
    const k = ease.outCubic(this.bowlK);
    const s = l.cell, shine = sim.shine;
    const cx = l.wall.x + l.wall.w / 2, rx = l.wall.w * 0.28, ry = rx * 0.34, depth = ry * 2.1;
    const cy = l.wall.y + l.wall.h * 0.6 + (1 - k) * 24;
    ctx.save();
    ctx.globalAlpha = k;
    const pool = ctx.createRadialGradient(cx, cy + depth * 0.5, 0, cx, cy + depth * 0.5, rx * 1.7);
    pool.addColorStop(0, `rgba(169,212,255,${(0.05 + 0.2 * shine).toFixed(3)})`);
    pool.addColorStop(1, 'rgba(169,212,255,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(cx - rx * 1.7, cy - rx, rx * 3.4, rx * 3.4);
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, depth, 0, 0, Math.PI);
    ctx.closePath();
    const body = ctx.createLinearGradient(cx - rx, cy, cx + rx * 0.6, cy + depth);
    body.addColorStop(0, '#4b4252');
    body.addColorStop(0.55, '#2b2530');
    body.addColorStop(1, '#131016');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.88, depth * 0.86, 0, Math.PI * 0.6, Math.PI * 0.88);
    ctx.stroke();
    // the well, lit from inside by the calm
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fillStyle = '#0e0b12';
    ctx.fill();
    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    inner.addColorStop(0, `rgba(190,222,255,${(0.06 + 0.4 * shine).toFixed(3)})`);
    inner.addColorStop(1, 'rgba(190,222,255,0)');
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.strokeStyle = '#6a5f72';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    // the round's gems, the best one in the middle
    const order = this.bowl.map((_, i) => i).filter(i => i !== sim.bowlBest);
    if (sim.bowlBest >= 0 && this.bowl[sim.bowlBest]) order.push(sim.bowlBest);
    for (const i of order) {
      const g = this.bowl[i], best = i === sim.bowlBest;
      const size = s * (best ? 0.9 : 0.44 + 0.08 * Math.sqrt(g.cells));
      const a = this.t * (this.still ? 0.12 : 0.32) * (0.6 + shine) + i * 2.39;
      const px = best ? cx : cx + Math.cos(a) * rx * (0.5 + 0.18 * hash(i + 1));
      const py = best ? cy - ry * 0.35 + Math.sin(this.t * 1.3) * (this.still ? 0 : 2) : cy + Math.sin(a) * ry * 0.4 - size * 0.2;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(best ? Math.sin(this.t * 0.8) * 0.12 : a * 0.5);
      this.tiles.draw(ctx, 'gem', g.gem, g.clarity, -size / 2, -size / 2, size);
      if (shine > 0.12) {
        ctx.globalCompositeOperation = 'lighter';
        const sweep = ((this.t * 0.6 + i * 0.37) % 1.6) - 0.3;
        const gl = ctx.createLinearGradient(-size / 2 + sweep * size, -size / 2, -size / 2 + sweep * size + size * 0.4, size / 2);
        gl.addColorStop(0, 'rgba(255,255,255,0)');
        gl.addColorStop(0.5, `rgba(255,255,255,${(0.5 * shine).toFixed(3)})`);
        gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl;
        rrect(ctx, -size * 0.44, -size * 0.44, size * 0.88, size * 0.88, size * 0.15);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (g.polish > 0) sparkle(ctx, size * 0.3, -size * 0.3, size * 0.22, 'rgba(255,248,226,0.95)');
      ctx.restore();
    }
    // the shine meter: a halo over the bowl that fills with calm, warm once past the polishing mark
    const hx = rx + s * 0.32, hy = ry + s * 0.32, need = sim.polishNeed, on = shine >= need && this.bowl.length > 0;
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(169,212,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, hx, hy, 0, Math.PI, TAU);
    ctx.stroke();
    if (shine > 0.01) {
      ctx.strokeStyle = on ? rgba(POLISH_ON, 0.75 + 0.25 * shine) : `rgba(200,230,255,${(0.6 + 0.4 * shine).toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, hx, hy, 0, Math.PI, Math.PI + Math.PI * clamp(shine));
      ctx.stroke();
    }
    const ma = Math.PI * (1 + need);
    ctx.fillStyle = on ? POLISH_ON : 'rgba(255,240,184,0.7)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ma) * hx, cy + Math.sin(ma) * hy, Math.max(2.5, s * 0.075), 0, TAU);
    ctx.fill();
    if (this.polishT >= 0 && this.polishT < 1.4) {
      const pk = this.polishT / 1.4;
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * TAU + pk * 0.6;
        sparkle(ctx, cx + Math.cos(a) * s * (0.5 + pk), cy - ry * 0.35 + Math.sin(a) * s * (0.5 + pk), s * 0.14 * (1 - pk), 'rgba(255,248,226,0.9)');
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // words over the bowl
    const tip = REST_TIPS[sim.round % REST_TIPS.length];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const ty = l.wall.y + l.wall.h * 0.28;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12;
    const title = t('block.szlif'), line = t('rest.line', { tip });
    fitFont(ctx, title, Math.round(clamp(s * 0.66, 24, 44)), l.wall.w * 0.8, SERIF, 500);
    ctx.fillStyle = '#d7e9ff';
    ctx.fillText(title, cx, ty);
    // one line, or two on a narrow wall (a phone on its side), above the bowl's halo
    const words = fitLines(ctx, line, Math.round(clamp(s * 0.3, 13, 18)), l.wall.w * 0.94, SANS, 500, 12);
    ctx.fillStyle = 'rgba(222,234,255,0.82)';
    words.lines.forEach((ln, i) => ctx.fillText(ln, cx, ty + clamp(s * 0.5, 22, 32) + i * Math.round(words.size * 1.25)));
    if (this.polishT >= 0 && this.polishT < 2.2) {
      ctx.globalAlpha = k * clamp(1 - (this.polishT - 1.6) / 0.6);
      const polished = t('rest.polished');
      fitFont(ctx, polished, Math.round(clamp(s * 0.36, 14, 22)), l.wall.w * 0.8, SANS, 700);
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(polished, cx, cy + depth + clamp(s * 0.55, 20, 34));
    }
    ctx.restore();
  }

  // ── the tray ──────────────────────────────────────────────────
  private drawTray(sim: GeodaSim, hand: Hand): void {
    const { ctx } = this;
    const l = this.l!, cs = this.cs;
    const target = sim.phase === 'wzrost' && sim.blindSlot < 0 ? sim.growTarget() : -1;
    const resting = sim.phase === 'szlif' || sim.phase === 'finale' || sim.phase === 'done';
    const placing = sim.phase === 'wzrost' ? sim.placing : -1;
    for (let s = 0; s < 3; s++) {
      const r = l.slots[s];
      const c = sim.tray[s];
      const sx = r.x + r.w / 2;
      ctx.save();
      if (s >= sim.slots) {
        // the first session opens one slot per round: until then a dormant seed
        this.drawSeed(r, 0, 0, false);
        this.slotLabel(r, t('tray.later', { n: s + 1 }), 'rgba(239,232,220,0.42)', false);
        ctx.restore();
        continue;
      }
      if (!resting && (s === sim.fed || s === placing)) {
        // the fed crystal: a warm rim of light; a fainter one on the crystal a tap sets while the fed slot sprouts
        const fed = s === sim.fed;
        ctx.shadowColor = 'rgba(255,200,120,0.55)';
        ctx.shadowBlur = fed ? 14 : 0;
        rrect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 14);
        ctx.strokeStyle = fed ? 'rgba(255,212,138,0.8)' : 'rgba(255,212,138,0.38)';
        ctx.lineWidth = fed ? 2 : 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (this.still && this.wiggle[s] > 0) {
        // "nie pasuje" without motion: a brief warm glow along the slot's edge instead of a shake
        ctx.shadowColor = `rgba(255,120,80,${(0.9 * this.wiggle[s]).toFixed(3)})`;
        ctx.shadowBlur = 16;
        rrect(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 14);
        ctx.strokeStyle = `rgba(255,150,105,${(0.95 * this.wiggle[s]).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // the stalactite glistens over the crystal the water runs to
      if (s === target) {
        ctx.fillStyle = 'rgba(200,226,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(sx - 1.5, r.y + 6, 1.2, 4, 0, 0, TAU);
        ctx.fill();
        const form = (1 - Math.max(0, this.dripIn)) * clamp(sim.drip);
        ctx.fillStyle = 'rgba(200,226,255,0.85)';
        ctx.beginPath();
        ctx.arc(sx, r.y + 14 + form * 2, 1 + form * 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.font = `500 10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(239,232,220,0.32)';
      ctx.fillText(String(s + 1), r.x + 9, r.y + 8);
      if (!c) {
        // an empty slot: a seed that sprouts from the next grown cell (the water's slot), or waits for it
        const k = sim.sprout[s], growing = s === target;
        this.drawSeed(r, k, this.trayPop[s], growing);
        this.slotLabel(r, growing || k > 0 ? t('tray.sprouting') : t('tray.waiting'), growing ? 'rgba(226,212,255,0.62)' : 'rgba(239,232,220,0.4)', false);
        ctx.restore();
        continue;
      }
      let [ox, oy] = this.crystalOrigin(r, c.ghost);
      if (!this.still) ox += Math.sin(this.t * 52) * 5 * this.wiggle[s];
      const lifted = hand.drag?.slot === s || hand.back?.slot === s;
      const veiled = s === sim.blindSlot;
      if (lifted) ctx.globalAlpha *= 0.22;
      // the ghost of the full shape
      for (let i = c.grown; i < c.ghost.length; i++) {
        const [gx, gy] = c.ghost[i];
        rrect(ctx, ox + gx * cs + 2, oy + gy * cs + 2, cs - 4, cs - 4, cs * 0.2);
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (veiled) {
        // Ciemna komora: the crystal grows unseen
        for (const [gx, gy] of c.ghost) {
          rrect(ctx, ox + gx * cs + 1, oy + gy * cs + 1, cs - 2, cs - 2, cs * 0.2);
          ctx.fillStyle = '#0a0710';
          ctx.fill();
          ctx.strokeStyle = 'rgba(169,150,220,0.25)';
          ctx.stroke();
        }
        this.slotLabel(r, t('tray.dark'), 'rgba(200,190,240,0.7)', true, 600);
        ctx.restore();
        continue;
      }
      const pop = this.trayPop[s];
      for (let i = 0; i < c.grown; i++) {
        const [gx, gy] = c.ghost[i];
        const k = i === c.grown - 1 && pop > 0 ? 1 + 0.25 * Math.sin(pop * Math.PI) : 1;
        this.tiles.drawScaled(ctx, 'gem', c.gem, c.clarity[i], ox + gx * cs, oy + gy * cs, cs, k);
      }
      if (s === target && !complete(c)) {
        // the next cell, growing
        const [gx, gy] = c.ghost[c.grown];
        const f = c.frac;
        ctx.globalAlpha *= 0.35 + 0.45 * f;
        this.tiles.drawScaled(ctx, 'gem', c.gem, clarityOf(sim.brain.cont), ox + gx * cs, oy + gy * cs, cs, 0.25 + 0.6 * ease.outCubic(f));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(255,236,190,${(0.35 + 0.3 * Math.sin(this.t * 5)).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        rrect(ctx, ox + gx * cs + 1.5, oy + gy * cs + 1.5, cs - 3, cs - 3, cs * 0.2);
        ctx.stroke();
      }
      // the size, and "pełny" when grown out (a Ciemna komora's crystal shows what grew in the dark)
      ctx.globalAlpha = lifted ? 0.3 : 1;
      ctx.textBaseline = 'alphabetic';
      if (this.reveal?.slot === s) {
        const k = this.reveal.t;
        ctx.globalAlpha = clamp(k / 0.3) * clamp((3 - k) / 0.5);
        this.slotLabel(r, this.reveal.text, '#e8ddff', true, 700, 13);
      } else {
        ctx.font = `500 11px ${MONO}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = complete(c) ? '#ffd48a' : 'rgba(239,232,220,0.55)';
        ctx.fillText(complete(c) ? t('tray.full') : `${c.grown}/${c.ghost.length}`, r.x + r.w - 9, r.y + r.h - 8);
      }
      if (hand.press?.slot === s && hand.press.k > 0.12) {
        // the hold that crumbles: the slot's edge fills, clockwise from its top left
        const rr = 13, per = 2 * (r.w + r.h - 12 - 4 * rr) + 2 * Math.PI * rr;
        rrect(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, rr);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([per * clamp((hand.press.k - 0.12) / 0.88), per]);
        ctx.strokeStyle = 'rgba(255,252,246,0.96)';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }

  /** The size of an empty slot's seed (px). */
  private seedRadius(r: Rect): number {
    const band = trayBand(this.l!, r);
    return clamp(Math.min(r.w, band.bottom - band.top) * 0.15, 7, 18);
  }

  /** A seed's bud, a tiny amethyst druse `size` px tall, cached per size (its base at 86 % of the sprite's height). */
  private seedSprite(size: number): HTMLCanvasElement {
    const key = Math.round(size * 2);
    let img = this.seeds.get(key);
    if (!img) {
      const box = Math.ceil(size * 1.7);
      img = document.createElement('canvas');
      img.width = img.height = Math.ceil(box * this.dpr);
      const x = img.getContext('2d')!;
      x.scale(this.dpr, this.dpr);
      druse(x, box / 2, box * 0.86, size, 0, 0, 5);
      this.seeds.set(key, img);
    }
    return img;
  }

  /**
   * An empty slot's seed: a tiny druse in a lilac glow, faint while it waits, brighter and larger as
   * it sprouts (`k` 0..1); the water's slot breathes, a tap while it sprouts makes it `pop`.
   */
  private drawSeed(r: Rect, k: number, pop: number, growing: boolean): void {
    const { ctx } = this;
    const band = trayBand(this.l!, r);
    const cx = r.x + r.w / 2, cy = (band.top + band.bottom) / 2, rad = this.seedRadius(r);
    const breath = growing && !this.still ? 0.5 + 0.5 * Math.sin(this.t * 2.6) : 0.5;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * (2.6 + 1.2 * k));
    glow.addColorStop(0, `rgba(214,184,255,${(0.07 + (growing ? 0.07 + 0.05 * breath : 0) + 0.22 * k).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(214,184,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - rad * 4, cy - rad * 4, rad * 8, rad * 8);
    const size = rad * 2, img = this.seedSprite(size), box = img.width / this.dpr;
    const sc = (0.72 + 0.28 * k) * (1 + 0.22 * Math.sin(pop * Math.PI));
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * ((growing ? 0.6 : 0.34) + 0.4 * k);
    ctx.drawImage(img, cx - (box / 2) * sc, cy - (box * 0.86 - size / 2) * sc, box * sc, box * sc);
    ctx.globalAlpha = alpha;
  }

  /**
   * A word in a slot, fitted to it: centred at its foot, or (`side`, for the words about a crystal)
   * in landscape at its top right, beside the stalactite — the short slot's crystal takes its
   * middle and may reach its foot.
   */
  private slotLabel(r: Rect, text: string, color: string, side: boolean, weight = 500, size = 11): void {
    const { ctx } = this;
    const corner = side && this.l!.landscape;
    fitFont(ctx, text, size, corner ? r.w / 2 - 24 : r.w - 18, SANS, weight, 9);
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = corner ? 'right' : 'center';
    ctx.fillText(text, corner ? r.x + r.w - 9 : r.x + r.w / 2, corner ? r.y + 15 : r.y + r.h - 8);
  }

  private drawDrops(): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(205,228,255,0.9)';
    for (const d of this.drops) {
      if (!d.live) continue;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 1.8, 2.8 + Math.min(3, d.vy / 120), 0, 0, TAU);
      ctx.fill();
    }
  }

  // ── the crystal in the hand ───────────────────────────────────
  private drawHand(sim: GeodaSim, hand: Hand): void {
    const { ctx } = this;
    const l = this.l!;
    const d = hand.drag ?? null, b = hand.back;
    const slot = d ? d.slot : b ? b.slot : -1;
    const c = slot >= 0 ? sim.tray[slot] : null;
    if (!c) return;
    const cells = crystalCells(c), g = grabCell(cells);
    let s = l.cell, x0 = 0, y0 = 0;
    if (d) {
      // lifted one cell above the finger, so the finger never hides it
      x0 = d.x - (g[0] + 0.5) * s;
      y0 = d.y - (g[1] + 0.5) * s - s * 1.1;
    } else if (b) {
      const r = l.slots[slot], [ox, oy] = this.crystalOrigin(r, c.ghost), off = prefixOffset(c);
      const k = ease.outCubic(b.k);
      s = lerp(l.cell, this.cs, k);
      x0 = lerp(b.x - (g[0] + 0.5) * l.cell, ox + off[0] * this.cs, k);
      y0 = lerp(b.y - (g[1] + 0.5) * l.cell - l.cell * 1.1, oy + off[1] * this.cs, k);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    for (let k = 0; k < cells.length; k++) {
      const cx = x0 + (cells[k][0] + 0.5) * s, cy = y0 + (cells[k][1] + 0.5) * s;
      this.tiles.drawScaled(ctx, 'gem', c.gem, c.clarity[k], cx - l.cell / 2, cy - l.cell / 2, l.cell, s / l.cell);
    }
    ctx.restore();
  }

  private drawCaption(dt: number): void {
    const c = this.caption;
    if (!c) return;
    c.t += dt;
    if (c.t > 2.2) {
      this.caption = null;
      return;
    }
    const { ctx } = this;
    const l = this.l!;
    const a = clamp(c.t / 0.25) * clamp((2.2 - c.t) / 0.6);
    const cx = l.wall.x + l.wall.w / 2, cy = l.wall.y + l.wall.h * 0.22 - 8 * ease.outCubic(clamp(c.t / 0.5));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 16;
    if (c.text) {
      fitFont(ctx, c.text, Math.round(clamp(l.cell * 0.7, 24, 46)), l.wall.w * 0.9, SERIF, 500);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, cx, cy);
    }
    if (c.sub) {
      // under the title, or on its own (a verdict without a harvest), a little larger; two lines on a narrow wall
      const sub = fitLines(ctx, c.sub, Math.round(clamp(l.cell * (c.text ? 0.3 : 0.36), 13, c.text ? 17 : 20)), l.wall.w * 0.94, SANS, 600, 12);
      ctx.fillStyle = c.text ? 'rgba(239,232,220,0.92)' : c.color;
      const y0 = c.text ? cy + clamp(l.cell * 0.48, 20, 30) : cy;
      sub.lines.forEach((ln, i) => ctx.fillText(ln, cx, y0 + i * Math.round(sub.size * 1.25)));
    }
    ctx.restore();
  }

  // ── the calibration: Kropla ───────────────────────────────────
  /** While the reference fills: one drop forms at the crack (p 0..1) and falls when it is set. */
  intro(p: number, dt: number): void {
    const { ctx } = this;
    const l = this.l;
    if (!l || !this.bg) return;
    this.t += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0, this.w, this.h);
    this.warm = approach(this.warm, 0.25, dt, 1);
    for (let i = 0; i < N * N; i++) {
      const r = this.cellRect(i);
      this.tiles.draw(ctx, 'slate', i % 3, 0, r.x, r.y, l.cell);
    }
    // the wall in shadow: exactly its bed, so the crust and bands around it stay lit
    rrect(ctx, l.wall.x - WALL_BED, l.wall.y - WALL_BED, l.wall.w + 2 * WALL_BED, l.wall.h + 2 * WALL_BED, 8);
    ctx.fillStyle = 'rgba(8,6,12,0.45)';
    ctx.fill();
    this.light = approach(this.light, 0.05 + 0.06 * p, dt, 0.8);
    this.drawShaft();
    const cx = l.wall.x + l.wall.w / 2, tip = l.wall.y - l.rim * GEODE_REACH + l.rim * 1.2;
    const d = this.introDrop, full = 2 + Math.min(12, l.rim * 0.6);
    if (p < 1) {
      d.y = 0;
      d.vy = 0;
      d.splash = -1;
      const r = 2 + (full - 2) * ease.inOutSine(clamp(p));
      const wob = this.still ? 0 : Math.sin(this.t * 3.1) * 0.5;
      const halo = ctx.createRadialGradient(cx, tip + r, 0, cx, tip + r, r * 5);
      halo.addColorStop(0, `rgba(190,220,255,${(0.15 + 0.25 * p).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(190,220,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r * 5, tip - r * 4, r * 10, r * 10);
      ctx.fillStyle = 'rgba(205,228,255,0.92)';
      ctx.beginPath();
      ctx.ellipse(cx, tip + r * 1.1, r + wob, r * 1.25 - wob, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, tip + r * 0.8, r * 0.28, 0, TAU);
      ctx.fill();
    } else {
      const floor = l.wall.y + l.wall.h * 0.5;
      if (d.splash < 0) {
        d.vy += (this.still ? 500 : 1200) * dt;
        d.y += d.vy * dt;
        const y = tip + full * 1.1 + d.y;
        if (y >= floor) {
          d.splash = 0;
          this.particles.burst(cx, floor, this.still ? 4 : 14, { color: 'rgba(205,228,255,0.9)', size: 1.8, speed: 140, angle: -Math.PI / 2, spread: 2.4, g: 500, life: 0.6 });
          this.onSplash?.(0.6);
        } else {
          ctx.fillStyle = 'rgba(205,228,255,0.92)';
          ctx.beginPath();
          ctx.ellipse(cx, y, full * 0.85, full * 1.35, 0, 0, TAU);
          ctx.fill();
        }
      } else {
        d.splash += dt;
        const k = clamp(d.splash / 1.2);
        ctx.strokeStyle = `rgba(205,228,255,${(0.7 * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, floor, 10 + 120 * k, (10 + 120 * k) * 0.3, 0, 0, TAU);
        ctx.stroke();
        // "Źródło znalezione" in the HUD's place, clear of the countdown and the runner's strip
        ctx.globalAlpha = clamp(d.splash / 0.4);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const hud = l.hud;
        const found = t('calib.found');
        fitFont(ctx, found, 22, hud.w, SERIF, 500);
        ctx.fillStyle = '#d7e9ff';
        ctx.fillText(found, hud.x + hud.w / 2, hud.y + (l.landscape ? hud.h * 0.3 : hud.h * 0.55));
        ctx.globalAlpha = 1;
      }
    }
    this.particles.update(dt);
    this.particles.draw(ctx);
  }
}
