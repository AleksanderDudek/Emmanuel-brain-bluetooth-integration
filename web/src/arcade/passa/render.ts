/**
 * Złota passa's picture (DESIGN.md §26, builder B): the street through the day (scene.ts), the garland of lights over
 * it — the streak (garland.ts), the moment's card coming down the street and turning from grey to gold (card.ts), the
 * pocket a card that did not turn goes into, the choices in the thumb zone, the narrator's line, the banner and the
 * day-streak's hanging sign by the café — from a `PassaView` on a `Layout`.  The class and its methods are the
 * contract builder A's index.ts calls: `resize(layout, dpr)` on every resize, `draw(ctx, view, dt, time)` every frame
 * (ctx scaled to CSS px).
 */
import { MIN_READ } from '../kit/mobile';
import { CardPainter, type CardLike } from './card';
import { Garland } from './garland';
import { cardFor, choiceRects, type Layout } from './layout';
import { drawFlame } from './motifs';
import {
  FONT, SERIF, TAU, clamp01, easeOut, fitWrap, font, glow, lerp, lightAt, mixHex, rgba, rr, smooth, type Light,
} from './paint';
import { Street, project, type Cam } from './scene';
import type { PassaView, Phase, Rect } from './view';
import { CAM_X, EYE, HALF, SIGN } from './world';

/** The card's width in the street (m): how small it is far down the street. */
const CARD_WORLD_W = 0.62;
/** Where a card starts, far down the street (m). */
const FAR = { x: 0.5, y: 1.35, z: 40 } as const;
/** Seconds: a card's slide into the pocket, a gone card's fade. */
const CARRY_S = 1.6, GHOST_S = 0.7;

interface Placed { card: CardLike; cx: number; cy: number; scale: number; id: string; carried: boolean }

const idOf = (c: CardLike): string => `${c.kind}|${c.motif}|${c.what}`;

export class StreetView {
  private l: Layout | null = null;
  private readonly street: Street;
  private readonly garland = new Garland();
  private readonly cardP = new CardPainter();
  private cardY = NaN;
  private last: Placed | null = null;
  private ghost: Placed | null = null;
  private ghostT = 1;
  private carryT = 0;
  private bump = 0;
  private lastFrom: { x: number; y: number } | null = null;
  private sayText = '';
  private sayA = 0;
  private banText = '';
  private banA = 0;
  private choicesA = 0;
  private veil = 0;
  private phase: Phase | '' = '';

  constructor(readonly opts: { reduced: boolean }) {
    this.street = new Street(!!opts?.reduced);
  }

  /** The layout in use. */
  get layout(): Layout | null { return this.l; }
  /** The traffic light's state on the street now (a green light may be a moment's motif). */
  get trafficLight(): 'red' | 'amber' | 'green' | 'redAmber' { return this.street.light; }

  resize(l: Layout, dpr: number): void {
    this.l = l;
    const cam: Cam = l.street ?? { cx: l.w / 2, hy: l.scene.y + l.scene.h * 0.85, f: Math.max(120, Math.min(l.w * 0.6, l.scene.h * 2)) };
    this.street.resize(l.w, l.h, dpr, cam);
    this.cardY = NaN;
  }

  draw(ctx: CanvasRenderingContext2D, v: PassaView, dt: number, time: number): void {
    const l = this.l;
    if (!l || !v) return;
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    const t = Number.isFinite(time) ? time : 0;
    const reduced = !!(this.opts.reduced || v.reduced);
    const cam = this.street.camera;
    const day = clamp01(v.day);
    const Lt = lightAt(day);
    const k = l.k ?? 1;
    if (v.phase !== this.phase) {
      if (v.phase === 'carry') this.carryT = 0;
      this.phase = v.phase;
    }
    // the street: the sky, the baked street, its life
    this.street.sky(ctx, day, t);
    this.street.street(ctx, day);
    this.street.life(ctx, day, t, step);
    this.sign(ctx, v, cam, Lt, k);
    // a heavy moment: the street grows quieter round it
    const heavyNow = v.card?.kind === 'heavy' && (v.phase === 'arrive' || v.phase === 'name' || v.phase === 'turn');
    this.veil += ((heavyNow ? 1 : 0) - this.veil) * Math.min(1, step * 1.2);
    if (this.veil > 0.01) {
      ctx.fillStyle = rgba('#141a30', 0.3 * this.veil);
      ctx.fillRect(0, 0, l.w, l.h);
    }
    // where the card stands (between its place over the choices and its free place), and where it is now
    const n = v.choices?.length ?? 0;
    const target = cardFor(l, n);
    if (!Number.isFinite(this.cardY)) this.cardY = target.y;
    this.cardY += (target.y - this.cardY) * Math.min(1, step * 7);
    const rect: Rect = { ...target, y: this.cardY };
    const card: CardLike | null = v.card ? { ...v.card, glow: v.glow } : null;
    const carrying = v.phase === 'carry';
    let now: Placed | null = null;
    if (card) {
      // a carried card's `near` (1 → 0) is its slide into the pocket, not a trip back down the street
      const p = this.place(rect, carrying ? 1 : card.near, cam, reduced);
      now = { card, cx: p.cx, cy: p.cy, scale: p.scale, id: idOf(card), carried: carrying };
      if (this.last && this.last.id !== now.id && !this.last.carried) { this.ghost = this.last; this.ghostT = 0; }
      this.last = now;
    } else if (this.last) {
      if (!this.last.carried) { this.ghost = this.last; this.ghostT = 0; }
      this.last = null;
    }
    // the garland over the street
    const from = now ? CardPainter.lightFrom(this.scaled(rect, now)) : this.lastFrom;
    if (from) this.lastFrom = from;
    const calm = v.phase === 'savor' || v.phase === 'evening' || v.phase === 'name' ? clamp01(v.glow) : 0;
    const gopts = { lights: v.lights, flying: v.flying, time: t, reduced, calm, dusk: Lt.dusk, breath: v.breath, from, k };
    this.garland.draw(ctx, cam, gopts);
    // the evening: the street's edges darken, the garland is the light
    if (Lt.dusk > 0.3) {
      const vg = ctx.createRadialGradient(l.w / 2, cam.hy - cam.f * 0.2, Math.min(l.w, l.h) * 0.25, l.w / 2, cam.hy, Math.hypot(l.w, l.h) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, rgba('#05060f', 0.45 * (Lt.dusk - 0.3)));
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, l.w, l.h);
    }
    // a soft floor under the card and the choices on an upright screen (the words read on any street)
    if (l.mode !== 'side') {
      const y0 = (l.cardFree ?? l.card).y - 30 * k;
      const g = ctx.createLinearGradient(0, y0, 0, l.h);
      g.addColorStop(0, 'rgba(10,8,14,0)');
      g.addColorStop(1, rgba('#0a080e', 0.42));
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, l.w, l.h - y0);
    }
    this.banner(ctx, v, l, step, t, reduced);
    // the pocket, then the card (arriving, turning, carried, or a gone one fading)
    this.pocket(ctx, v, l, step, t, reduced);
    if (this.ghost) {
      this.ghostT += step / GHOST_S;
      if (this.ghostT >= 1) this.ghost = null;
      else {
        const gt = this.ghostT;
        const gc = { ...this.ghost.card, glow: (this.ghost.card.glow ?? 0) * (1 - gt) };
        this.cardP.draw(ctx, gc, this.ghost.cx, this.ghost.cy - (reduced ? 0 : gt * 14 * k), l.card.w, l.card.h, this.ghost.scale * (1 - 0.04 * gt), { time: t, reduced, font: l.font, k, alpha: 1 - smooth(gt), breath: v.breath });
      }
    }
    if (carrying && now) {
      // the slide follows the card's `near` (1 → 0); my own clock when it stays put
      this.carryT = Math.max(Math.min(1, this.carryT + step / CARRY_S) * (now.card.near >= 0.999 ? 1 : 0), 1 - clamp01(now.card.near));
      const before = this.carryT;
      this.carried(ctx, now, l, t, reduced, v.breath);
      if (before >= 0.92 && this.bump === 0) this.bump = 1;
    } else if (now) {
      this.cardP.draw(ctx, now.card, now.cx, now.cy, l.card.w, l.card.h, now.scale, {
        time: t, reduced, font: l.font, k, alpha: this.arriveAlpha(now.card.near, reduced), breath: v.phase === 'savor' || v.phase === 'name' ? v.breath : 0.5,
      });
    }
    // the light flying up into the garland, over the card
    this.garland.flight(ctx, cam, gopts);
    this.choices(ctx, v, l, step, t);
    this.say(ctx, v, l, step, rect);
  }

  // ── the card's place ────────────────────────────────────────────

  /** A card at `near` (0 far down the street … 1 held up close in `r`): its centre and scale (perspective). */
  private place(r: Rect, near: number, cam: Cam, reduced: boolean): { cx: number; cy: number; scale: number } {
    const ccx = r.x + r.w / 2, ccy = r.y + r.h / 2;
    const n = clamp01(near);
    if (reduced || n >= 0.999) return { cx: ccx, cy: ccy, scale: 1 };
    const Zc = (CARD_WORLD_W * cam.f) / Math.max(1, r.w);
    if (Zc >= FAR.z) return { cx: ccx, cy: ccy, scale: 1 };
    const xc = CAM_X + ((ccx - cam.cx) * Zc) / cam.f, yc = EYE - ((ccy - cam.hy) * Zc) / cam.f;
    const u = easeOut(n);
    const z = lerp(FAR.z, Zc, u), x = lerp(FAR.x, xc, u), y = lerp(FAR.y, yc, u);
    const [px, py] = project(cam, x, y, z);
    return { cx: px, cy: py, scale: Zc / z };
  }

  private arriveAlpha(near: number, reduced: boolean): number {
    const n = clamp01(near);
    return reduced ? smooth(n / 0.5) : smooth(n / 0.1);
  }

  private scaled(r: Rect, p: Placed): Rect {
    const w = r.w * p.scale, h = r.h * p.scale;
    return { x: p.cx - w / 2, y: p.cy - h / 2, w, h };
  }

  /** A card that did not turn sliding gently into the pocket (reduced motion: fading where it is). */
  private carried(ctx: CanvasRenderingContext2D, p: Placed, l: Layout, t: number, reduced: boolean, breath: number): void {
    const u = smooth(this.carryT);
    const pk = l.pocket ?? { x: l.card.x + 24, y: l.card.y, r: 24 };
    const k = l.k ?? 1;
    if (u >= 0.999) return;
    if (reduced) {
      this.cardP.draw(ctx, p.card, p.cx, p.cy, l.card.w, l.card.h, p.scale, { time: t, reduced, font: l.font, k, alpha: 1 - u, breath });
      return;
    }
    const cx = lerp(p.cx, pk.x, u), cy = lerp(p.cy, pk.y, u) - Math.sin(u * Math.PI) * 30 * k;
    const sc = p.scale * lerp(1, 0.1, u);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35 * u);
    this.cardP.draw(ctx, { ...p.card, glow: 0 }, 0, 0, l.card.w, l.card.h, sc, { time: t, reduced, font: l.font, k, alpha: 1 - smooth((u - 0.7) / 0.3), breath });
    ctx.restore();
  }

  // ── the pocket ─────────────────────────────────────────────────

  private pocket(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, t: number, reduced: boolean): void {
    const count = Math.max(0, Math.floor(v.carried || 0));
    if (count <= 0 && v.phase !== 'carry') { this.bump = 0; return; }
    const pk = l.pocket ?? { x: l.card.x + 24, y: l.card.y, r: 24 };
    if (this.bump > 0) this.bump = Math.max(0, this.bump - step * 1.6);
    const b = reduced ? 0 : Math.sin(this.bump * Math.PI) * 0.12;
    const r = pk.r * (1 + b);
    const x = pk.x, y = pk.y;
    ctx.save();
    // the bag: a linen pouch, its strap, its fold
    ctx.fillStyle = rgba('#0a0806', 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a6a48';
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.42, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    const g = ctx.createLinearGradient(x - r, y - r * 0.4, x + r, y + r);
    g.addColorStop(0, '#efe2c6');
    g.addColorStop(1, '#cdb48a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.78, y - r * 0.38);
    ctx.lineTo(x + r * 0.78, y - r * 0.38);
    ctx.quadraticCurveTo(x + r * 0.92, y + r * 0.9, x, y + r * 0.92);
    ctx.quadraticCurveTo(x - r * 0.92, y + r * 0.9, x - r * 0.78, y - r * 0.38);
    ctx.fill();
    ctx.fillStyle = '#b8986c';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.78, y - r * 0.38);
    ctx.lineTo(x + r * 0.78, y - r * 0.38);
    ctx.quadraticCurveTo(x, y + r * 0.2, x - r * 0.78, y - r * 0.38);
    ctx.fill();
    // a soft warmth in it: these cards are kept, not lost
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#ffd8a0', x, y + r * 0.2, r * 1.2, 0.12 + 0.1 * Math.sin(t * 0.8));
    ctx.globalCompositeOperation = 'source-over';
    // the count
    if (count > 0) {
      const br = Math.max(11, r * 0.48);
      const bx = x + r * 0.72, by = y - r * 0.45;
      ctx.fillStyle = '#3a2c20';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f0d8a8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fbf0dc';
      ctx.font = font(700, Math.max(MIN_READ, br * 1.05));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), bx, by + 0.5);
    }
    ctx.restore();
  }

  // ── the day-streak's sign by the café ────────────────────────────

  private sign(ctx: CanvasRenderingContext2D, v: PassaView, cam: Cam, Lt: Light, k: number): void {
    const days = Math.max(0, Math.floor(v.days || 0));
    const text = (v.sign ?? '').trim() || (days > 0 ? String(days) : '');
    // the evening's banner (the identity) takes the sign's place
    const a = 1 - smooth(this.banText ? this.banA : 0);
    if (!text || a <= 0.01) return;
    const l = this.l!;
    const z = SIGN.z;
    const [wx, wy] = project(cam, HALF, SIGN.y + 0.3, z);
    const [hx, hy] = project(cam, SIGN.x - 0.15, SIGN.y + 0.3, z);
    const px = Math.max(MIN_READ, Math.min(17 * k, (cam.f * 0.2) / z));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(700, px, FONT);
    const sun = !v.sign;
    const tw = ctx.measureText(text).width + (sun ? px * 1.3 : 0);
    const pad = px * 0.7;
    const bw = tw + pad * 2, bh = px * 2.1;
    // the board hangs under the bracket's end; kept inside the canvas
    let bx = hx - bw / 2;
    bx = Math.max(6, Math.min(l.w - 6 - bw, bx));
    const by = hy + px * 0.7;
    if (by > l.h || by + bh < 0) { ctx.restore(); return; }
    // the bracket from the wall (it reaches further when the board had to move in)
    ctx.strokeStyle = mixHex('#2c3430', '#000000', 0.2);
    ctx.lineWidth = Math.max(1.5, px * 0.14);
    ctx.beginPath();
    ctx.moveTo(Math.min(wx, l.w + 20), wy);
    ctx.lineTo(bx + bw / 2, hy);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.2, hy);
    ctx.lineTo(bx + bw * 0.2, by);
    ctx.moveTo(bx + bw * 0.8, hy);
    ctx.lineTo(bx + bw * 0.8, by);
    ctx.stroke();
    // the enamel board: the café's green, a gold rim, gold letters — lit by the lamps at night
    const night = Lt.dusk;
    const board = mixHex('#2f5a4a', '#1a3028', night * 0.5);
    ctx.fillStyle = board;
    rr(ctx, bx, by, bw, bh, px * 0.35);
    ctx.fill();
    ctx.strokeStyle = mixHex('#d9b25a', '#ffe6a0', night * 0.4);
    ctx.lineWidth = Math.max(1.2, px * 0.1);
    rr(ctx, bx + 2, by + 2, bw - 4, bh - 4, px * 0.28);
    ctx.stroke();
    ctx.fillStyle = mixHex('#f5d58a', '#fff2c8', night * 0.5);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let x = bx + pad;
    if (sun) {
      const r = px * 0.38, sx = x + r, sy = by + bh / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r * 0.85, sy + Math.sin(a) * r * 0.85);
        ctx.lineTo(sx + Math.cos(a) * r * 1.25, sy + Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
      x += px * 1.3;
    }
    ctx.fillText(text, x, by + bh / 2 + 0.5);
    if (night > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffd890', bx + bw / 2, by + bh / 2, bw * 0.7, 0.12 * night);
    }
    ctx.restore();
  }

  // ── the banner over the street ──────────────────────────────────

  private banner(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, t: number, reduced: boolean): void {
    const want = (v.banner ?? '').trim();
    if (want !== this.banText) {
      this.banA = Math.max(0, this.banA - step * 3);
      if (this.banA <= 0.01) this.banText = want;
    } else this.banA = Math.min(1, this.banA + step * (reduced ? 2 : 1));
    if (!this.banText || this.banA <= 0.01) return;
    const r = l.banner, k = l.k ?? 1;
    const top = Math.min(34 * k, Math.max(20, r.h * 0.5));
    // the identity: its first part large, after " — " a second, smaller line ("wszystko współdziała ku dobremu")
    const cut = this.banText.indexOf(' — ');
    let head = this.banText, tail = '';
    if (cut > 0) {
      ctx.font = font(600, top, SERIF);
      if (ctx.measureText(this.banText).width > r.w * 0.94) { head = this.banText.slice(0, cut); tail = this.banText.slice(cut + 3); }
    }
    const f = fitWrap(ctx, head, r.w * 0.94, tail ? 1 : 2, top, 18, 600, SERIF);
    const g2 = tail ? fitWrap(ctx, tail, r.w * 0.94, 2, Math.max(MIN_READ + 3, f.px * 0.66), MIN_READ + 2, 500, SERIF, true) : null;
    const lh = f.px * 1.18, lh2 = g2 ? g2.px * 1.25 : 0;
    const blockH = f.lines.length * lh + (g2 ? g2.lines.length * lh2 + f.px * 0.15 : 0);
    const cy = r.y + r.h / 2;
    const y0 = cy - blockH / 2 + lh / 2;
    ctx.save();
    ctx.globalAlpha = smooth(this.banA);
    // a soft dark ground for the words on any sky, then a warm glow behind them
    const tw = Math.max(...f.lines.map(s => { ctx.font = font(600, f.px, SERIF); return ctx.measureText(s).width; }));
    glow(ctx, '#0a0814', r.x + r.w / 2, cy, tw * 0.62 + f.px, 0.3, Math.min(1.2, (blockH + f.px) / (tw * 0.62 + f.px)));
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#ffcf80', r.x + r.w / 2, cy, Math.max(r.w * 0.36, f.px * 3), 0.22 + (reduced ? 0 : 0.05 * Math.sin(t * 0.9)), 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = font(600, f.px, SERIF);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff6dc';
    f.lines.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, y0 + i * lh));
    if (g2) {
      ctx.font = font(500, g2.px, SERIF, true);
      ctx.fillStyle = '#ffe6b0';
      const y2 = y0 + f.lines.length * lh - lh / 2 + f.px * 0.15 + lh2 / 2;
      g2.lines.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, y2 + i * lh2));
    }
    ctx.restore();
  }

  // ── the choices ────────────────────────────────────────────────

  private choices(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, t: number): void {
    const list = v.choices ?? [];
    this.choicesA = list.length ? Math.min(1, this.choicesA + step * 4) : 0;
    if (!list.length) return;
    const rects = choiceRects(l, list.length);
    const k = l.k ?? 1;
    const a = smooth(this.choicesA);
    ctx.save();
    for (let i = 0; i < list.length && i < rects.length; i++) {
      const c = list[i], r = rects[i];
      const rad = Math.min(14 * k, r.h * 0.3);
      ctx.globalAlpha = a;
      // the ground: dark warm glass, lit gold when chosen; trust's a deep night blue with a small flame
      if (c.chosen) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, c.trust ? '#ffc880' : '#ffcf70', r.x + r.w / 2, r.y + r.h / 2, r.w * 0.55, 0.28, (r.h * 2) / r.w);
        ctx.globalCompositeOperation = 'source-over';
      }
      let bg: CanvasGradient | string;
      if (c.trust) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, c.chosen ? '#3c4a7c' : 'rgba(30,36,66,0.9)');
        g.addColorStop(1, c.chosen ? '#2c3460' : 'rgba(22,26,50,0.9)');
        bg = g;
      } else if (c.chosen) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, '#fbe2a0');
        g.addColorStop(1, '#eebc5c');
        bg = g;
      } else bg = 'rgba(24,18,14,0.78)';
      ctx.fillStyle = bg;
      rr(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fill();
      ctx.strokeStyle = c.chosen ? (c.trust ? '#ffd890' : '#fff2c4') : c.trust ? 'rgba(232,184,112,0.7)' : 'rgba(251,236,210,0.32)';
      ctx.lineWidth = c.chosen ? 2 : 1.2;
      rr(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, rad);
      ctx.stroke();
      // a key's number on a desk; trust's flame
      let x = r.x + 14 * Math.min(k, 1.4);
      const cy = r.y + r.h / 2;
      if (!l.touch) {
        const br = Math.max(10, 11 * Math.min(k, 1.4));
        ctx.fillStyle = c.chosen && !c.trust ? 'rgba(90,58,20,0.18)' : 'rgba(251,236,210,0.14)';
        ctx.beginPath();
        ctx.arc(x + br, cy, br, 0, TAU);
        ctx.fill();
        ctx.fillStyle = c.chosen && !c.trust ? '#6b4410' : '#f2e4cc';
        ctx.font = font(700, Math.max(MIN_READ, br * 1.15));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x + br, cy + 0.5);
        x += br * 2 + 10;
      }
      if (c.trust) {
        const s = Math.min(r.h * 0.78, 34 * k);
        drawFlame(ctx, x - s * 0.18, cy - s * 0.52, s, t, c.chosen ? 1 : 0.6);
        x += s * 0.68;
      }
      // the label: 16 px down to 13, two lines (three only if it must), never cut
      const tw = r.x + r.w - 14 * Math.min(k, 1.4) - x;
      let f = fitWrap(ctx, c.label, tw, 2, Math.max(l.font, 15), MIN_READ, 600, FONT);
      if (f.lines.length > 2) f = fitWrap(ctx, c.label, tw, 3, MIN_READ, MIN_READ, 600, FONT);
      const lh = f.px * 1.22;
      ctx.font = font(600, f.px, FONT);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.chosen && !c.trust ? '#3a2410' : '#fbf1de';
      const y0 = cy - ((f.lines.length - 1) * lh) / 2;
      f.lines.forEach((ln, j) => ctx.fillText(ln, x, y0 + j * lh));
    }
    ctx.restore();
  }

  // ── the narrator's line ────────────────────────────────────────

  private say(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, card: Rect): void {
    const want = (v.say ?? '').trim();
    if (want !== this.sayText) {
      this.sayA = Math.max(0, this.sayA - step * 5);
      if (this.sayA <= 0.01) this.sayText = want;
    } else this.sayA = Math.min(1, this.sayA + step * 3.5);
    if (!this.sayText || this.sayA <= 0.01) return;
    const k = l.k ?? 1;
    const open = (v.choices?.length ?? 0) > 0;
    // where: its place while no choices are open; with choices, over the card when the street's strip has room
    let r: Rect = l.say;
    const band = l.band ?? { x: 0, y: 0, w: l.w, h: l.h };
    const px0 = Math.max(l.font, 15);
    if (open && !v.card) {
      // the evening's pick (the day's wins as choices, no card): the question right over them
      const rs = choiceRects(l, v.choices.length);
      const need = px0 * 1.3 * 2 + 22;
      const top = l.mode === 'side' ? l.card.y : rs[0].y - 8 - need;
      r = l.mode === 'side' ? { x: l.card.x, y: l.card.y, w: l.card.w, h: l.card.h } : { x: rs[0].x, y: Math.max(band.y, top), w: rs[0].w, h: need };
    } else if (open || (l.mode === 'side' && v.phase === 'turn')) {
      const need = px0 * 1.3 * 2 + 22;
      const room = card.y - band.y - 8;
      if (room < need) return;
      const w = Math.min(band.w, Math.max(card.w, 420 * k));
      r = { x: Math.max(band.x, Math.min(band.x + band.w - w, card.x + card.w / 2 - w / 2)), y: card.y - 8 - need, w, h: need };
    }
    const padX = 14 * Math.min(k, 1.4), padY = 9 * Math.min(k, 1.4);
    const f = fitWrap(ctx, this.sayText, r.w - 2 * padX, 3, px0, MIN_READ, 500, FONT);
    const lh = f.px * 1.3;
    ctx.font = font(500, f.px, FONT);
    const tw = Math.max(...f.lines.map(s => ctx.measureText(s).width));
    const bw = Math.min(r.w, tw + 2 * padX), bh = f.lines.length * lh + 2 * padY;
    const bx = r.x + (r.w - bw) / 2, by = r.y + Math.max(0, (r.h - bh) / 2);
    ctx.save();
    ctx.globalAlpha = smooth(this.sayA);
    ctx.fillStyle = rgba('#0a0806', 0.25);
    rr(ctx, bx + 1, by + 3, bw, bh, 14 * Math.min(k, 1.4));
    ctx.fill();
    ctx.fillStyle = rgba('#fbf3e4', 0.95);
    rr(ctx, bx, by, bw, bh, 14 * Math.min(k, 1.4));
    ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    f.lines.forEach((ln, i) => ctx.fillText(ln, bx + bw / 2, by + padY + lh * (i + 0.5)));
    ctx.restore();
  }
}
