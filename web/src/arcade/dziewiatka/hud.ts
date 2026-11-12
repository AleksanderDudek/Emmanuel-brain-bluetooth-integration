/**
 * Dziewiątka's own bits on the canvas (the runner draws the band's panel and the score), phone first (DESIGN.md
 * §11.7 "Mobile first"): the five portraits — big cards in the thumb zone with the face in its rank's ring, the
 * stars, the health and the energy bars; a full bar lifts the card, makes it glow and bounce with "Stuknij!"
 * over the face and the semi-auto's ring around it; a finger squashes a card the moment it lands — the energy
 * dial (the band's multiplier ×1…×3 with the threshold notch at ×2, gold above it), the bell (Harmony filling
 * with gold; full, it swings, glows and asks for a tap), the mission's pill and the boss's bar under the HUD,
 * the boons' bottom sheet, the story cards (the opening with its verse), the wipe's card and Klara's bubble.
 * Every text has a floor (paint.ts `font`: 11 px; what is read to play 13–16 px).  It keeps only animation
 * state; the hit tests use the layout.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease } from '../kit/juice';
import { MIN_TEXT } from '../kit/mobile';
import { passage, REF_FONT, VERSE_FONT, wrapLines } from '../kit/scripture';
import type { Hero } from './battle';
import {
  CHAPTERS, HEROES, MISSIONS_PER_CHAPTER, PIECES, RANK_COLOR,
  boonName, boonText, chapterName, dinName, heroName, heroText, ultName, type BoonId,
} from './content';
import { t, type Key } from './i18n';
import { inRect, type Layout, type Rect } from './layout';
import { growth, fitting } from './meta';
import { C, INK, SANS, SERIF, font, glow, paintBellShape, paintFace, paintStars, roundRect } from './paint';
import { RULES } from './rules';
import type { DziewiatkaSim } from './sim';

const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** `s` cut with "…" to fit `w` at the context's current font. */
function cut(ctx: CanvasRenderingContext2D, s: string, w: number): string {
  if (ctx.measureText(s).width <= w) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${s.slice(0, m).trimEnd()}…`).width <= w) lo = m; else hi = m - 1;
  }
  return lo > 0 ? `${s.slice(0, lo).trimEnd()}…` : '';
}

/**
 * Set the largest font from `px` down to `min` (never under MIN_TEXT) at which `text` fits `w`, and return the
 * text to draw — cut with "…" only if even `min` overflows.  Like kit/mobile `fitText`, but it shrinks until the
 * text really fits (glyph widths do not scale exactly, and one proportional step can miss by a pixel).
 */
export function fitLabel(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, weight: number, family: string, min = MIN_TEXT): string {
  const lo = Math.max(MIN_TEXT, min);
  let size = Math.max(lo, px);
  ctx.font = `${weight} ${size}px ${family}`;
  let tw = ctx.measureText(text).width;
  for (let i = 0; i < 8 && tw > w && size > lo; i++) {
    size = Math.max(lo, Math.floor(size * (w / tw) * 0.97 * 10) / 10);
    ctx.font = `${weight} ${size}px ${family}`;
    tw = ctx.measureText(text).width;
  }
  return tw <= w ? text : cut(ctx, text, w);
}

/**
 * `text` wrapped into at most `max` lines at the largest whole size from `px` down to `min` (never under
 * MIN_TEXT) where it fits `w`; at `min` the last line is cut with "…".  Leaves that font set on `ctx`.
 */
export function fitLines(ctx: CanvasRenderingContext2D, text: string, w: number, max: number, px: number, min: number, weight = 650, family = SANS): { lines: string[]; px: number } {
  const lo = Math.max(MIN_TEXT, Math.round(min));
  for (let size = Math.max(lo, Math.round(px)); size >= lo; size--) {
    ctx.font = font(size, weight, family);
    const lines = wrapLines(ctx, text, w);
    if (lines.length <= max && lines.every(l => ctx.measureText(l).width <= w)) return { lines, px: size };
  }
  ctx.font = font(lo, weight, family);
  const all = wrapLines(ctx, text, w);
  const lines = all.slice(0, max).map(l => cut(ctx, l, w));
  if (all.length > max) lines[max - 1] = cut(ctx, `${lines[max - 1]}…`, w);
  return { lines, px: lo };
}

interface StoryFit { key: string; tp: number; text: string[]; vp: number; verse: string[]; refPx: number; h: number }

export class Hud {
  /** a not-ready tap wobbles its portrait (or the bell); a fired one flashes */
  private readonly wobble = [0, 0, 0, 0, 0];
  private readonly flash = [0, 0, 0, 0, 0];
  private readonly shownE = [0, 0, 0, 0, 0];
  private readonly shownH = [1, 1, 1, 1, 1];
  /** a finger on a control: held → 1, let go → back to 0 (the squash) */
  private readonly held = { slot: -1, bell: false, card: -1 };
  private readonly squash = [0, 0, 0, 0, 0];
  private readonly cardSquash = [0, 0, 0];
  private bellSquash = 0;
  private bellWob = 0;
  private bellRing = 0;
  private dialShown = 1;
  private story: StoryFit | null = null;
  /** each portrait's face painted once per size (five clipped faces a frame otherwise) */
  private readonly faces = new Map<string, HTMLCanvasElement | null>();

  /** `still`: the player asked for reduced motion (the ready cards glow without bouncing) */
  constructor(private readonly still = false) {}

  nope(slot: number): void { if (slot >= 0 && slot < 5) this.wobble[slot] = 1; }
  bellNope(): void { this.bellWob = 1; }
  fired(slot: number): void { if (slot >= 0 && slot < 5) this.flash[slot] = 1; }
  rang(): void { this.bellRing = 1; }

  /** A finger lands on a portrait, the bell or a boon card: it squashes at once (touch-down, not release). */
  pressSlot(i: number): void { this.held.slot = i; if (i >= 0 && i < 5) this.squash[i] = 1; }
  pressBell(): void { this.held.bell = true; this.bellSquash = 1; }
  pressCard(i: number): void { this.held.card = i; if (i >= 0 && i < 3) this.cardSquash[i] = 1; }
  /** The finger lifts: everything springs back. */
  release(): void { this.held.slot = -1; this.held.bell = false; this.held.card = -1; }

  update(dt: number, sim: DziewiatkaSim): void {
    for (let i = 0; i < 5; i++) {
      this.wobble[i] = Math.max(0, this.wobble[i] - dt * 3);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 2.5);
      if (this.held.slot !== i) this.squash[i] = Math.max(0, this.squash[i] - dt * 7);
      const h = sim.battle.heroBySlot(i);
      if (h) {
        this.shownE[i] = approach(this.shownE[i], h.energy / RULES.energyMax, dt, 0.08);
        this.shownH[i] = approach(this.shownH[i], h.hp / h.max, dt, 0.12);
      }
    }
    for (let i = 0; i < 3; i++) if (this.held.card !== i) this.cardSquash[i] = Math.max(0, this.cardSquash[i] - dt * 7);
    if (!this.held.bell) this.bellSquash = Math.max(0, this.bellSquash - dt * 7);
    this.bellWob = Math.max(0, this.bellWob - dt * 3);
    this.bellRing = Math.max(0, this.bellRing - dt * 0.8);
    this.dialShown = approach(this.dialShown, sim.multShown, dt, 0.2);
  }

  // ── hit tests (the portraits: layout.ts `slotAt`) ──────────────
  bellAt(L: Layout, x: number, y: number): boolean { return inRect(L.bell, x, y); }

  cardAt(L: Layout, x: number, y: number): number { return L.cards.findIndex(r => inRect(r, x, y)); }

  // ── the strip ───────────────────────────────────────────────────
  drawStrip(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    this.dial(ctx, L, sim, clock);
    this.bell(ctx, L, sim, clock);
    // a name fits only a wide card (a tablet, a desktop); on a phone the face, its colour and the stars say who
    const named = L.slots[0].w >= 84;
    for (let i = 0; i < 5; i++) {
      const h = sim.battle.heroBySlot(i);
      if (h) this.portrait(ctx, L, L.slots[i], h, sim, clock, i, named);
    }
  }

  private portrait(ctx: CanvasRenderingContext2D, L: Layout, r: Rect, h: Hero, sim: DziewiatkaSim, clock: number, i: number, named: boolean): void {
    const ready = sim.battle.ready(h) && sim.fighting;
    const well = sim.atWell;
    const spec = HEROES[h.kind];
    const g = growth(sim.p, h.kind);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const wob = this.wobble[i] > 0 ? Math.sin(this.wobble[i] * 30) * 4 * this.wobble[i] : 0;
    // a full bar lifts the card and makes it bounce (only glows with reduced motion); a finger squashes it
    const hop = ready ? (this.still ? -3 : -(4 + 4 * Math.abs(Math.sin(clock * 5.2)))) : 0;
    const sq = 1 - 0.08 * this.squash[i];
    ctx.save();
    ctx.translate(cx + wob, cy + hop);
    if (sq !== 1) ctx.scale(sq, sq);
    ctx.translate(-cx, -cy);
    const rad = Math.min(14, r.w * 0.16);
    if (ready) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx, cy, Math.max(r.w, r.h) * 0.9, 'rgba(255,190,60,', 0.5 + 0.35 * pulse);
      ctx.restore();
    }
    ctx.fillStyle = h.down ? '#d8d2c8' : ready ? '#fff3cc' : C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, rad);
    ctx.fill();
    // the hero's colour along the top
    ctx.save();
    ctx.clip();
    ctx.fillStyle = spec.color;
    ctx.fillRect(r.x, r.y, r.w, Math.max(5, r.h * 0.06));
    ctx.restore();
    roundRect(ctx, r.x, r.y, r.w, r.h, rad);
    ctx.lineWidth = ready ? 3.5 : 1.5;
    ctx.strokeStyle = ready ? '#f5a800' : 'rgba(43,34,56,.45)';
    ctx.stroke();
    // the face in its rank's ring, the stars on its rim, the name (a wide card), the bars
    const u = L.u;
    const bh = clamp(r.h * 0.075, 5, 9);
    const barsH = 2 * bh + 3;
    const barsTop = r.y + r.h - Math.max(5, r.h * 0.06) - barsH;
    const starR = clamp(r.w * 0.065, 3.8, 6.5);
    const namePx = named ? clamp(13 * u, 12, 15) : 0;
    const nameH = named ? namePx + 5 : 0;
    const top = r.y + Math.max(5, r.h * 0.06) + 3 + (well ? (r.h < 80 ? 4 : 9) : 0);
    const mr = clamp((barsTop - top - starR * 1.4 - nameH - 3) / 2, 10, r.w * 0.36);
    const mx = cx, my = top + mr;
    this.face(ctx, h.kind, mx, my, mr, clock, h.down);
    ctx.lineWidth = Math.max(2, mr * 0.13);
    ctx.strokeStyle = RANK_COLOR[g.rank] ?? '#fff';
    ctx.beginPath();
    ctx.arc(mx, my, mr + ctx.lineWidth / 2, 0, TAU);
    ctx.stroke();
    if (ready) {
      // the semi-auto's countdown: the ring closes, then the hero fires by itself
      const wait = RULES.autoWait[spec.role] ?? 3;
      const k = clamp(h.readyT / wait);
      ctx.strokeStyle = '#f5a800';
      ctx.lineWidth = Math.max(2.5, mr * 0.16);
      ctx.beginPath();
      ctx.arc(mx, my, mr + ctx.lineWidth * 1.7, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k));
      ctx.stroke();
    }
    if (this.flash[i] > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, mx, my, mr * 2.4, 'rgba(255,240,200,', this.flash[i] * 0.8);
      ctx.restore();
    }
    paintStars(ctx, mx, my + mr + starR * 0.2, g.stars, starR);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (named) {
      ctx.fillStyle = INK;
      ctx.fillText(fitLabel(ctx, heroName(h.kind), r.w - 8, namePx, 800, SANS), mx, my + mr + starR * 1.3 + 3);
    }
    const bx = r.x + Math.max(5, r.w * 0.09), bw = r.w - 2 * Math.max(5, r.w * 0.09);
    const by1 = barsTop, by2 = barsTop + bh + 3;
    ctx.fillStyle = 'rgba(43,34,56,.2)';
    roundRect(ctx, bx, by1, bw, bh, bh / 2);
    ctx.fill();
    roundRect(ctx, bx, by2, bw, bh, bh / 2);
    ctx.fill();
    const hp = clamp(this.shownH[i]);
    ctx.fillStyle = hp < 0.3 ? C.hpLow : C.hp;
    if (hp > 0) { roundRect(ctx, bx, by1, Math.max(bh, bw * hp), bh, bh / 2); ctx.fill(); }
    const e = clamp(this.shownE[i]);
    const gold = sim.sighted && sim.reliable && sim.multShown >= 2;
    ctx.fillStyle = ready ? (Math.sin(clock * 8) > 0 ? '#ffe9a6' : '#ffc23d') : gold ? '#ffab1a' : C.energy;
    if (e > 0) { roundRect(ctx, bx, by2, Math.max(bh, bw * e), bh, bh / 2); ctx.fill(); }
    if (gold && e < 1 && e > 0) {
      // gold sparks run along a bar the band is filling
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bx + bw * e, by2 + bh / 2, bh * 1.8, 'rgba(255,220,120,', 0.6);
      ctx.restore();
    }
    // states over the face
    ctx.textBaseline = 'middle';
    if (h.down) {
      ctx.fillStyle = 'rgba(43,34,56,.55)';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.fill();
      const f = fitLines(ctx, t('hud.down'), Math.max(mr * 1.9, r.w - 8), 2, 12, 11, 800);
      ctx.fillStyle = '#fff6e3';
      const lh = f.px * 1.1;
      f.lines.forEach((l, k) => ctx.fillText(l, mx, my + (k - (f.lines.length - 1) / 2) * lh));
    } else if (h.silence > 0 && !well) {
      ctx.font = font(13, 900);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,246,227,.95)';
      ctx.strokeText(t('hud.silenced'), mx, my - mr * 0.7);
      ctx.fillStyle = 'rgba(43,34,56,.85)';
      ctx.fillText(t('hud.silenced'), mx, my - mr * 0.7);
    } else if (ready) {
      // "Stuknij!" on a gold tag across the chin
      const label = fitLabel(ctx, t('hud.ready'), r.w - 12, clamp(13 * u, 13, 16), 900, SANS);
      const tw = Math.min(r.w - 4, ctx.measureText(label).width + 12);
      const th = clamp(13 * u, 13, 16) + 7;
      const ty = Math.min(my + mr * 0.82, barsTop - th / 2 - 2);
      ctx.fillStyle = '#ffcf3a';
      roundRect(ctx, mx - tw / 2, ty - th / 2, tw, th, th / 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = '#3d2500';
      ctx.fillText(label, mx, ty + 0.5);
    }
    // at the well: the six sockets of the next rank, a green "+" where a piece fits
    if (well) {
      const sr = clamp(r.w * 0.042, 2.6, 5);
      const sy = r.y + Math.max(5, r.h * 0.06) + 3 + sr;
      for (let k = 0; k < PIECES; k++) {
        const sx = cx + (k - (PIECES - 1) / 2) * sr * 2.7;
        ctx.fillStyle = g.slots & (1 << k) ? RANK_COLOR[Math.min(RANK_COLOR.length - 1, g.rank + 1)] : 'rgba(43,34,56,.2)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
      if (fitting(sim.p, h.kind) >= 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, mx, my, mr * 1.7, 'rgba(255,230,160,', 0.3 + 0.2 * Math.sin(clock * 5));
        ctx.restore();
        const pr = clamp(mr * 0.36, 7, 12), px = mx + mr * 0.78, py = my - mr * 0.72;
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(2, pr * 0.32);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px - pr * 0.5, py);
        ctx.lineTo(px + pr * 0.5, py);
        ctx.moveTo(px, py - pr * 0.5);
        ctx.lineTo(px, py + pr * 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** A hero's face from its sprite (painted at twice the size, the runner's highest resolution); without a document, painted. */
  private face(ctx: CanvasRenderingContext2D, kind: Hero['kind'], cx: number, cy: number, r: number, clock: number, grey: boolean): void {
    if (typeof document === 'undefined') {
      paintFace(ctx, kind, cx, cy, r, clock, grey);
      return;
    }
    const rr = Math.round(r * 2) / 2;
    const key = `${kind}|${rr}|${grey ? 1 : 0}`;
    let sprite = this.faces.get(key);
    if (sprite === undefined) {
      sprite = null;
      const size = Math.ceil(rr * 4) + 4;
      const el = document.createElement('canvas');
      el.width = el.height = size;
      const g = el.getContext('2d');
      if (g) {
        g.setTransform(2, 0, 0, 2, 0, 0);
        paintFace(g, kind, size / 4, size / 4, rr, 0, grey);
        sprite = el;
      }
      if (this.faces.size >= 48) this.faces.clear();
      this.faces.set(key, sprite);
    }
    if (sprite) ctx.drawImage(sprite, cx - sprite.width / 4, cy - sprite.height / 4, sprite.width / 2, sprite.height / 2);
    else paintFace(ctx, kind, cx, cy, r, clock, grey);
  }

  /** The band's dial: the energy multiplier ×1…×3, the threshold notch at ×2, gold above it. */
  private dial(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const r = L.dial, u = L.u;
    if (r.w < 30) return;
    const live = sim.sighted && sim.reliable;
    const blind = sim.blind;
    const k = clamp((this.dialShown - 1) / RULES.multK);
    const hot = live && k >= 0.5 && !blind;
    ctx.save();
    if (hot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7, 'rgba(255,200,90,', 0.28 + 0.12 * Math.sin(clock * 5));
      ctx.restore();
    }
    ctx.fillStyle = hot ? 'rgba(255,243,210,.97)' : 'rgba(251,241,220,.95)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.lineWidth = hot ? 2.5 : 1.5;
    ctx.strokeStyle = hot ? '#f5a800' : 'rgba(43,34,56,.45)';
    ctx.stroke();
    // three shapes: a row (an upright phone), a box (on its side, a desktop), a tall card
    const labelPx = clamp(13 * u, 13, 16);
    const foot = labelPx + 10;
    const shape = r.w >= r.h * 2.6 ? 'row' : r.w >= r.h * 1.25 ? 'box' : 'tall';
    let cx: number, cy: number, rad: number;
    if (shape === 'row') {
      rad = Math.min(r.h * 0.33, 24 * u);
      cx = r.x + 12 + rad;
      cy = r.y + r.h * 0.6;
    } else if (shape === 'box') {
      rad = Math.min((r.h - foot) * 0.4, r.w * 0.2);
      cx = r.x + 12 + rad;
      cy = r.y + 4 + (r.h - foot) * 0.56;
    } else {
      rad = Math.min(r.w * 0.34, (r.h - foot) * 0.4);
      cx = r.x + r.w / 2;
      cy = r.y + 4 + (r.h - foot) * 0.52;
    }
    const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    // the track, the part filled (gold above the threshold), the threshold notch, the needle
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, rad * 0.26);
    ctx.strokeStyle = 'rgba(43,34,56,.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, a0, a1);
    ctx.stroke();
    const am = a0 + (a1 - a0) * k;
    if (!blind) {
      ctx.strokeStyle = live ? (k >= 0.5 ? '#ffab1a' : '#f2c46a') : 'rgba(160,150,140,.6)';
      ctx.beginPath();
      ctx.arc(cx, cy, rad, a0, Math.max(a0 + 0.001, am));
      ctx.stroke();
      if (hot) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, cx + Math.cos(am) * rad, cy + Math.sin(am) * rad, rad * 0.7, 'rgba(255,210,100,', 0.6 + 0.2 * Math.sin(clock * 6));
        ctx.restore();
      }
    }
    const amid = (a0 + a1) / 2;
    const n0 = { x: cx + Math.cos(amid) * rad * 0.68, y: cy + Math.sin(amid) * rad * 0.68 };
    const n1 = { x: cx + Math.cos(amid) * rad * 1.32, y: cy + Math.sin(amid) * rad * 1.32 };
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(n0.x, n0.y);
    ctx.lineTo(n1.x, n1.y);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(n0.x, n0.y);
    ctx.lineTo(n1.x, n1.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!blind) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(2, rad * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(am) * rad * 0.8, cy + Math.sin(am) * rad * 0.8);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2.5, rad * 0.11), 0, TAU);
    ctx.fill();
    // "próg" by the notch (a tag), the multiplier big, the gauge's name
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(12, 750);
    const mark = t('hud.mark');
    const markW = ctx.measureText(mark).width;
    // a row: the text column starts after the tag (a long word — "Schwelle" — must not run into the number)
    let rowX0 = cx + rad * 1.35;
    let showMark = true;
    if (shape === 'row') {
      const after = n1.x + 4 + markW + 8;
      if (r.x + r.w - 8 - Math.max(rowX0, after) >= 56) rowX0 = Math.max(rowX0, after);
      else showMark = n1.x + 4 + markW <= rowX0;
    }
    if (showMark) {
      ctx.fillStyle = 'rgba(43,34,56,.62)';
      ctx.fillText(mark, n1.x + 4, n1.y + 2);
    }
    const mult = blind ? '?' : `×${fmtNum(live ? this.dialShown : 1, 1)}`;
    const label = blind ? t('hud.blind') : t('hud.energy');
    const multColor = hot ? '#a35f00' : INK;
    ctx.textAlign = 'center';
    if (shape === 'row') {
      const tx0 = rowX0, tw = r.x + r.w - 8 - tx0, tx = tx0 + tw / 2;
      ctx.fillStyle = multColor;
      ctx.fillText(fitLabel(ctx, mult, tw, Math.min(25 * u, r.h * 0.46), 900, SANS, 15), tx, r.y + r.h * 0.37);
      ctx.fillStyle = 'rgba(43,34,56,.78)';
      ctx.fillText(fitLabel(ctx, label, tw, labelPx, 750, SANS, 12), tx, r.y + r.h * 0.76);
    } else if (shape === 'box') {
      const tx0 = cx + rad * 1.3, tw = r.x + r.w - 6 - tx0;
      ctx.fillStyle = multColor;
      ctx.fillText(fitLabel(ctx, mult, tw, Math.min(27 * u, (r.h - foot) * 0.48), 900, SANS, 15), tx0 + tw / 2, cy);
      ctx.fillStyle = 'rgba(43,34,56,.78)';
      ctx.fillText(fitLabel(ctx, label, r.w - 12, labelPx, 750, SANS, 12), r.x + r.w / 2, r.y + r.h - foot / 2 - 1);
    } else {
      ctx.fillStyle = multColor;
      ctx.fillText(fitLabel(ctx, mult, rad * 1.7, clamp(rad * 0.75, 15, 26 * u), 900, SANS, 15), cx, cy + rad * 0.55);
      ctx.fillStyle = 'rgba(43,34,56,.78)';
      ctx.fillText(fitLabel(ctx, label, r.w - 10, labelPx, 750, SANS, 12), r.x + r.w / 2, r.y + r.h - foot / 2 - 1);
    }
    if (blind) {
      ctx.fillStyle = 'rgba(160,150,180,.5)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The bell of Zacisze: Harmony fills it with gold; full, it swings, glows and asks for a tap. */
  private bell(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const r = L.bell, u = L.u;
    if (r.w < 26) return;
    // full, it calls for a tap only where it can ring: in battle
    const ready = sim.harmonyReady && sim.fighting;
    const k = sim.harmonyReady ? 1 : clamp(sim.harmony);
    const cxr = r.x + r.w / 2, cyr = r.y + r.h / 2;
    const wob = this.bellWob > 0 ? Math.sin(this.bellWob * 30) * 4 * this.bellWob : 0;
    const sq = 1 - 0.08 * this.bellSquash;
    ctx.save();
    ctx.translate(cxr + wob, cyr);
    if (sq !== 1) ctx.scale(sq, sq);
    ctx.translate(-cxr, -cyr);
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cxr, cyr, Math.max(r.w, r.h) * 0.85, 'rgba(255,200,80,', 0.5 + 0.3 * Math.sin(clock * 5));
      ctx.restore();
    }
    ctx.fillStyle = ready ? 'rgba(255,232,150,.98)' : 'rgba(251,241,220,.95)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.lineWidth = ready ? 3.5 : 1.5;
    ctx.strokeStyle = ready ? '#f5a800' : 'rgba(43,34,56,.45)';
    ctx.stroke();
    const labelPx = clamp(13 * u, 13, 16);
    const row = r.w >= r.h * 2;
    // the bell (its crown at bx, by), swinging when ready or just rung
    let br: number, bx: number, by: number;
    if (row) {
      br = Math.min(r.h * 0.36, 24 * u);
      bx = r.x + 12 + br;
      by = cyr - br * 0.78;
    } else {
      const foot = labelPx + 10;
      br = Math.min(r.w * 0.3, (r.h - foot) * 0.5);
      bx = cxr;
      by = r.y + 5 + ((r.h - foot) - br * 1.55) / 2;
    }
    const swing = (ready && !this.still ? Math.sin(clock * 6) * 0.25 : 0) + Math.sin(clock * 20) * 0.35 * this.bellRing;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(swing);
    paintBellShape(ctx, 0, 0, br, '#efe4cf', INK);
    if (k > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-br * 1.1, br * 1.35 - br * 1.35 * k, br * 2.2, br * 1.35 * k + 1);
      ctx.clip();
      paintBellShape(ctx, 0, 0, br, ready ? '#ffcf3a' : '#f6c44f', INK);
      ctx.restore();
    }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = t('hud.bell');
    if (row) {
      // the name, and under it how full Harmony is — or, full, the call to tap
      const tx0 = bx + br + 12, tw = r.x + r.w - 10 - tx0, tx = tx0 + tw / 2;
      ctx.fillStyle = ready ? '#5c3700' : INK;
      ctx.fillText(fitLabel(ctx, name, tw, labelPx + 1, 800, SANS, 12), tx, r.y + r.h * 0.33);
      if (ready) {
        ctx.fillStyle = '#5c3700';
        ctx.fillText(fitLabel(ctx, t('hud.ready'), tw, labelPx, 900, SANS, 12), tx, r.y + r.h * 0.7);
      } else {
        const bw = Math.min(tw, 90 * u), bh = 7, x = tx - bw / 2, y = r.y + r.h * 0.7 - bh / 2;
        ctx.fillStyle = 'rgba(43,34,56,.16)';
        roundRect(ctx, x, y, bw, bh, bh / 2);
        ctx.fill();
        if (k > 0) {
          ctx.fillStyle = '#f2b524';
          roundRect(ctx, x, y, Math.max(bh, bw * k), bh, bh / 2);
          ctx.fill();
        }
      }
    } else {
      ctx.fillStyle = ready ? '#5c3700' : 'rgba(43,34,56,.78)';
      ctx.fillText(fitLabel(ctx, ready ? t('hud.ready') : name, r.w - 8, labelPx, ready ? 900 : 750, SANS, 12), cxr, r.y + r.h - (labelPx + 10) / 2 - 1);
    }
    ctx.restore();
  }

  // ── under the HUD: the mission's pill, the boss's bar ───────────
  drawPill(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim): void {
    // a sheet or a story card open: the battle holds, its pill steps aside for the card's title
    if (sim.choice || sim.story) return;
    const r = L.pill, m = sim.mission, spec = m.spec;
    ctx.save();
    ctx.fillStyle = 'rgba(251,241,220,.9)';
    roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,34,56,.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const label = spec.floor > 0
      ? t('card.floor', { n: spec.floor })
      : `${cap(chapterName(spec.chapter.id))} · ${t('card.mission', { c: Math.floor(spec.index / MISSIONS_PER_CHAPTER) + 1, m: (spec.index % MISSIONS_PER_CHAPTER) + 1 })}`;
    const dots = spec.waves.length;
    const dr = Math.max(3.5, r.h * 0.17);
    const dotsW = dots * dr * 2.8;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fitLabel(ctx, label, r.w - dotsW - r.h, Math.max(13, r.h * 0.52), 750, SANS, 12), r.x + r.h * 0.5, r.y + r.h / 2 + 0.5);
    for (let i = 0; i < dots; i++) {
      const dx = r.x + r.w - r.h * 0.5 - (dots - 1 - i) * dr * 2.8, dy = r.y + r.h / 2;
      const done = m.won > 0 || i < m.wave;
      const now = i === m.wave && m.won <= 0;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, TAU);
      ctx.fillStyle = done ? C.gold : now ? '#e8566a' : 'rgba(43,34,56,.18)';
      ctx.fill();
      if (now) {
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
    // the boss's bar, its name on it
    const boss = sim.battle.boss;
    if (boss && boss.enter <= 0) {
      const b = L.bossBar;
      ctx.fillStyle = 'rgba(43,34,56,.78)';
      roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fill();
      ctx.fillStyle = '#c55a7a';
      roundRect(ctx, b.x + 1.5, b.y + 1.5, Math.max(0, (b.w - 3) * clamp(boss.hp / boss.max)), b.h - 3, (b.h - 3) / 2);
      ctx.fill();
      if (boss.mirror > 0) {
        ctx.fillStyle = 'rgba(220,230,255,.85)';
        roundRect(ctx, b.x + 1.5, b.y + 1.5, Math.max(0, (b.w - 3) * clamp(boss.mirror / Math.max(1, boss.max))), Math.max(3, b.h * 0.32), 2);
        ctx.fill();
      }
      const name = fitLabel(ctx, cap(dinName(boss.kind)), b.w - 16, Math.max(12, b.h * 0.72), 800, SANS, 11);
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(43,34,56,.85)';
      ctx.strokeText(name, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
      if (boss.windT >= 0) {
        // the wind-up: a red band filling under the bar — break it now
        const kk = clamp(boss.windT / boss.windDur);
        ctx.fillStyle = '#ff6b4a';
        roundRect(ctx, b.x, b.y + b.h + 3, Math.max(4, b.w * kk), 4, 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── the boons ───────────────────────────────────────────────────
  drawChoice(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number, touch: boolean): void {
    const c = sim.choice;
    if (!c) return;
    const u = L.u;
    const k = ease.outBack(clamp(c.t / 0.35));
    ctx.save();
    ctx.fillStyle = `rgba(30,24,40,${0.5 * clamp(c.t / 0.3)})`;
    ctx.fillRect(0, 0, L.w, L.h);
    const sheet = L.sheet;
    if (sheet) {
      // an upright phone: a bottom sheet rises under the thumb
      ctx.translate(0, (1 - ease.outCubic(clamp(c.t / 0.3))) * sheet.h * 0.6);
      const rr = 22;
      ctx.fillStyle = 'rgba(36,29,48,.97)';
      ctx.beginPath();
      ctx.moveTo(sheet.x, sheet.y + sheet.h);
      ctx.lineTo(sheet.x, sheet.y + rr);
      ctx.arcTo(sheet.x, sheet.y, sheet.x + rr, sheet.y, rr);
      ctx.lineTo(sheet.x + sheet.w - rr, sheet.y);
      ctx.arcTo(sheet.x + sheet.w, sheet.y, sheet.x + sheet.w, sheet.y + rr, rr);
      ctx.lineTo(sheet.x + sheet.w, sheet.y + sheet.h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.gold ? 'rgba(255,201,74,.8)' : 'rgba(255,246,227,.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,246,227,.3)';
      roundRect(ctx, L.w / 2 - 20, sheet.y + 7, 40, 4, 2);
      ctx.fill();
    }
    // the title (two lines on a phone's sheet), the three cards, the hint and the countdown to the first card
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = c.gold ? C.goldLight : C.cream;
    const title = c.gold ? t('card.boonGold') : t('card.boonTitle');
    const tl = fitLines(ctx, title, L.w - 2 * L.padL, sheet ? 2 : 1, clamp(19 * u, 19, 24), sheet ? 16 : 13, 850, SERIF);
    tl.lines.forEach((l, i) => ctx.fillText(l, L.w / 2, L.cardsTitle - (tl.lines.length - 1 - i) * tl.px * 1.18));
    c.ids.forEach((id, i) => {
      const r = L.cards[i];
      if (!r) return;
      const lift = (1 - k) * 30 + (this.still ? 0 : Math.sin(clock * 2 + i) * 1.2);
      this.boonCard(ctx, r, id, c.gold, lift, this.cardSquash[i], u);
    });
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,246,227,.88)';
    ctx.fillText(fitLabel(ctx, t(touch ? 'card.boonPickTouch' : 'card.boonPick'), L.w - 2 * L.padL, clamp(13 * u, 13, 16), 650, SANS, 12), L.w / 2, L.cardsHint);
    const left = clamp(1 - c.t / RULES.choiceSec);
    const bw = 120 * u;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    roundRect(ctx, L.w / 2 - bw / 2, L.cardsHint + clamp(13 * u, 13, 16) + 8, bw, 4, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    roundRect(ctx, L.w / 2 - bw / 2, L.cardsHint + clamp(13 * u, 13, 16) + 8, Math.max(4, bw * left), 4, 2);
    ctx.fill();
    ctx.restore();
  }

  private boonCard(ctx: CanvasRenderingContext2D, r: Rect, id: BoonId, gold: boolean, lift: number, press: number, u: number): void {
    const row = r.w > r.h * 1.8;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.save();
    ctx.translate(0, lift);
    if (press > 0) {
      const sq = 1 - 0.04 * press;
      ctx.translate(cx, cy);
      ctx.scale(sq, sq);
      ctx.translate(-cx, -cy);
    }
    ctx.fillStyle = gold ? '#fff2c4' : C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    ctx.lineWidth = gold || press > 0.3 ? 3 : 1.5;
    ctx.strokeStyle = gold || press > 0.3 ? '#f5a800' : 'rgba(43,34,56,.5)';
    ctx.stroke();
    ctx.fillStyle = INK;
    if (row) {
      // an upright phone: the picture on the left, the name and what it does on the right
      const icon = Math.min(r.h * 0.66, 64 * u);
      boonIcon(ctx, id, r.x + 14 + icon / 2, cy, icon / 2);
      const tx = r.x + icon + 28, tw = r.x + r.w - 14 - tx;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const namePx = clamp(16 * u, 16, 19);
      const body = fitLines(ctx, boonText(id, gold), tw, 2, clamp(14 * u, 14, 16), 13, 600);
      const lh = body.px * 1.3;
      const total = namePx + 6 + body.lines.length * lh;
      const y0 = cy - total / 2;
      ctx.fillStyle = INK;
      ctx.fillText(fitLabel(ctx, boonName(id), tw, namePx, 850, SANS, 14), tx, y0);
      ctx.font = font(body.px, 600);
      ctx.fillStyle = 'rgba(43,34,56,.85)';
      body.lines.forEach((l, i) => ctx.fillText(l, tx, y0 + namePx + 6 + i * lh));
    } else {
      const icon = Math.min(r.h * 0.36, r.w * 0.32);
      const tw = r.w - 20;
      const namePx = clamp(16 * u, 16, 20);
      const body = fitLines(ctx, boonText(id, gold), tw, 3, clamp(14 * u, 14, 16), 13, 600);
      const total = icon + 8 + namePx + 6 + body.lines.length * body.px * 1.3;
      const iy = r.y + Math.max(12, (r.h - total) / 2) + icon / 2;
      boonIcon(ctx, id, cx, iy, icon / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = INK;
      ctx.fillText(fitLabel(ctx, boonName(id), tw, namePx, 850, SANS, 14), cx, iy + icon / 2 + 8);
      ctx.font = font(body.px, 600);
      ctx.fillStyle = 'rgba(43,34,56,.85)';
      body.lines.forEach((l, i) => ctx.fillText(l, cx, iy + icon / 2 + 8 + namePx + 6 + i * body.px * 1.3));
    }
    ctx.restore();
  }

  /** The story card: the opening (with the root verse), a district quiet, a newcomer, the tower. */
  drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const st = sim.story;
    if (!st) return;
    const a = clamp(st.t / 0.3) * clamp((st.dur - st.t) / 0.3 + 0.2);
    const r = L.story, u = L.u;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, a);
    ctx.fillStyle = 'rgba(30,24,40,.6)';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.fillStyle = C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 20);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    let title = '', text = '';
    if (st.kind === 'open') { title = t('story.open.title'); text = t('story.open'); }
    else if (st.kind === 'chapter') { title = t('story.chapter.title', { n: st.chapter + 1 }); text = t(`story.ch.${CHAPTERS[st.chapter].id}` as Key); }
    else if (st.kind === 'join' && st.hero) { title = t('story.join.title', { name: heroName(st.hero) }); text = `${t(`story.join.${st.hero}` as Key)} ${ultName(st.hero)}: ${heroText(st.hero)}`; }
    else { title = t('story.tower.title'); text = t('story.tower'); }
    const pad = clamp(r.w * 0.06, 16, 30);
    const iw = r.w - 2 * pad;
    const cx = r.x + r.w / 2;
    const tapPx = clamp(13 * u, 13, 15);
    const end = r.y + r.h - tapPx - 16;
    const fr = st.kind === 'join' && st.hero ? clamp(r.h * 0.1, 22, 40) : 0;
    const tl = fitLines(ctx, title, iw, 2, clamp(24 * u, 22, 30), 17, 800, SERIF);
    const head = (fr ? fr * 2 + 10 : 0) + tl.lines.length * tl.px * 1.15 + 10;
    // the text (and, the opening, its verse) at the largest sizes that fit what is left of the card
    const fit = this.storyFit(ctx, `${st.kind}|${st.hero}|${st.chapter}|${Math.round(r.w)}x${Math.round(r.h)}|${head.toFixed(0)}`, text, st.kind === 'open', iw, end - r.y - pad - head, u);
    // a short story sits in the middle of its card
    let y = r.y + Math.max(pad, (end - r.y - head - fit.h) / 2);
    if (fr && st.hero) {
      paintFace(ctx, st.hero, cx, y + fr, fr, clock);
      y += fr * 2 + 10;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    ctx.font = font(tl.px, 800, SERIF);
    tl.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * tl.px * 1.15));
    y += tl.lines.length * tl.px * 1.15 + 10;
    ctx.font = font(fit.tp, 600);
    ctx.fillStyle = 'rgba(43,34,56,.9)';
    fit.text.forEach((l, i) => ctx.fillText(l, cx, y + i * fit.tp * 1.36));
    y += fit.text.length * fit.tp * 1.36 + 12;
    if (fit.verse.length) {
      const p = passage('gal5.22-23');
      ctx.font = `italic 400 ${fit.vp}px ${VERSE_FONT}`;
      ctx.fillStyle = '#5a3d2b';
      fit.verse.forEach((l, i) => ctx.fillText(l, cx, y + i * fit.vp * 1.3));
      y += fit.verse.length * fit.vp * 1.3 + 6;
      ctx.font = `600 ${fit.refPx}px ${REF_FONT}`;
      ctx.fillStyle = 'rgba(43,34,56,.62)';
      ctx.fillText(cut(ctx, `${p.ref} · ${p.bible}`, iw), cx, y);
    }
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(43,34,56,.6)';
    ctx.fillText(fitLabel(ctx, t('card.tap'), iw, tapPx, 700, SANS, 12), cx, r.y + r.h - 10);
    ctx.restore();
  }

  /** The largest text size (16 → 13) and verse size (≤ the text's, 17 → 13) where both fit `room`; else the smallest, cut. */
  private storyFit(ctx: CanvasRenderingContext2D, key: string, text: string, verse: boolean, iw: number, room: number, u: number): StoryFit {
    if (this.story?.key === key) return this.story;
    const p = verse ? passage('gal5.22-23') : null;
    const measure = (tp: number, vp: number) => {
      ctx.font = font(tp, 600);
      const tLines = wrapLines(ctx, text, iw);
      let vLines: string[] = [], refPx = 0, vH = 0;
      if (p) {
        ctx.font = `italic 400 ${vp}px ${VERSE_FONT}`;
        vLines = wrapLines(ctx, p.text, iw);
        refPx = Math.max(13, Math.round(vp * 0.8));
        vH = 12 + vLines.length * vp * 1.3 + 6 + refPx;
      }
      return { tp, tLines, vp, vLines, refPx, h: tLines.length * tp * 1.36 + vH };
    };
    let pick: ReturnType<typeof measure> | null = null;
    for (let tp = Math.round(clamp(16 * u, 16, 19)); tp >= 13 && !pick; tp--) {
      for (let vp = Math.min(tp + 1, 17); vp >= 13; vp--) {
        const m = measure(tp, vp);
        if (m.h <= room) { pick = m; break; }
        if (!p) break;
      }
    }
    if (!pick) {
      // even 13 px overflows (a very short screen): keep the verse whole if it can, cut the text
      const m = measure(13, 13);
      const vH = p ? 12 + m.vLines.length * 13 * 1.3 + 6 + m.refPx : 0;
      const fitsText = Math.max(1, Math.floor((room - vH) / (13 * 1.36)));
      ctx.font = font(13, 600);
      const tLines = m.tLines.slice(0, fitsText);
      if (m.tLines.length > fitsText) tLines[fitsText - 1] = cut(ctx, `${tLines[fitsText - 1]}…`, iw);
      pick = { ...m, tLines };
    }
    this.story = { key, tp: pick.tp, text: pick.tLines, vp: pick.vp, verse: pick.vLines, refPx: pick.refPx, h: Math.min(pick.h, room) };
    return this.story;
  }

  drawWipe(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim): void {
    const tl = sim.tally;
    if (!tl) return;
    const a = clamp(tl.t / 0.25) * clamp((tl.dur - tl.t) / 0.25);
    const r = L.wipe, u = L.u;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,34,56,.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    const titlePx = clamp(19 * u, 19, 23);
    ctx.fillText(fitLabel(ctx, t('wipe.title'), r.w - 24, titlePx, 800, SERIF, 15), r.x + r.w / 2, r.y + 14);
    const body = fitLines(ctx, t('wipe.text'), r.w - 32, 3, clamp(15 * u, 15, 17), 13, 600);
    ctx.fillStyle = 'rgba(43,34,56,.88)';
    body.lines.forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + 14 + titlePx + 10 + i * body.px * 1.32));
    ctx.restore();
  }

  /** Klara's bubble above her head, kept on the canvas, under the pill (and the boss's bar), above the controls. */
  drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, ax: number, ay: number, a: number, minY: number): void {
    if (!text || a <= 0) return;
    const u = L.u;
    ctx.save();
    ctx.globalAlpha = a;
    const px = clamp(14 * u, 14, 16);
    ctx.font = font(px, 650);
    const maxW = Math.min(300 * u, L.w - 20);
    const lines = wrapLines(ctx, text, maxW - 24).slice(0, 4);
    const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24);
    const lh = px * 1.3;
    const h = lines.length * lh + 14;
    const x = Math.max(8, Math.min(L.w - w - 8, ax - 18));
    const y = Math.max(minY, Math.min(ay - h - 12, L.fieldBottom - h - 6));
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = 'rgba(43,34,56,.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    // the tail toward Klara
    const tx = Math.max(x + 12, Math.min(x + w - 12, ax));
    ctx.beginPath();
    ctx.moveTo(tx - 7, y + h - 1);
    ctx.lineTo(tx, Math.min(ay - 2, y + h + 10));
    ctx.lineTo(tx + 7, y + h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 7 + i * lh));
    ctx.restore();
  }
}

/** A small picture for each boon. */
export function boonIcon(ctx: CanvasRenderingContext2D, id: BoonId, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(255,214,120,.25)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  switch (id) {
    case 'piesn':
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, r * 0.35, r * 0.2, r * 0.14, -0.4, 0, TAU);
      ctx.ellipse(r * 0.35, r * 0.2, r * 0.2, r * 0.14, -0.4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, r * 0.32);
      ctx.lineTo(-r * 0.12, -r * 0.45);
      ctx.lineTo(r * 0.53, -r * 0.6);
      ctx.lineTo(r * 0.53, r * 0.18);
      ctx.stroke();
      break;
    case 'zupa':
      ctx.fillStyle = '#e8a05a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.05);
      ctx.quadraticCurveTo(0, r * 0.95, r * 0.7, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(43,34,56,.5)';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * r * 0.25, -r * 0.2);
        ctx.quadraticCurveTo(k * r * 0.25 + r * 0.12, -r * 0.45, k * r * 0.25, -r * 0.7);
        ctx.stroke();
      }
      break;
    case 'szal':
      ctx.strokeStyle = '#c94f3d';
      ctx.lineWidth = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.3);
      ctx.quadraticCurveTo(0, r * 0.1, r * 0.6, -r * 0.3);
      ctx.moveTo(r * 0.3, -r * 0.15);
      ctx.lineTo(r * 0.45, r * 0.65);
      ctx.stroke();
      break;
    case 'werbel':
      ctx.fillStyle = '#e9e4f2';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.2, r * 0.6, r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c94f3d';
      ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.6);
      ctx.strokeRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.6);
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.8);
      ctx.lineTo(-r * 0.1, -r * 0.3);
      ctx.moveTo(r * 0.7, -r * 0.8);
      ctx.lineTo(r * 0.1, -r * 0.3);
      ctx.stroke();
      break;
    case 'pierniki':
      ctx.fillStyle = '#b8742f';
      ctx.beginPath();
      ctx.arc(0, -r * 0.4, r * 0.25, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.18);
      ctx.lineTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.2, r * 0.05);
      ctx.lineTo(-r * 0.35, r * 0.6);
      ctx.lineTo(0, r * 0.35);
      ctx.lineTo(r * 0.35, r * 0.6);
      ctx.lineTo(r * 0.2, r * 0.05);
      ctx.lineTo(r * 0.55, 0);
      ctx.lineTo(r * 0.15, -r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'klucz':
      ctx.strokeStyle = '#b8872a';
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.26, 0, TAU);
      ctx.moveTo(-r * 0.1, -r * 0.1);
      ctx.lineTo(r * 0.65, r * 0.25);
      ctx.moveTo(r * 0.45, r * 0.15);
      ctx.lineTo(r * 0.35, r * 0.4);
      ctx.stroke();
      break;
    case 'apteczka':
      ctx.fillStyle = '#f7f3ea';
      roundRect(ctx, -r * 0.6, -r * 0.45, r * 1.2, r * 0.9, r * 0.15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4caf6a';
      ctx.fillRect(-r * 0.1, -r * 0.32, r * 0.2, r * 0.64);
      ctx.fillRect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2);
      break;
    case 'kieszenie':
      ctx.fillStyle = '#7d93c9';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.45);
      ctx.lineTo(r * 0.55, -r * 0.45);
      ctx.lineTo(r * 0.45, r * 0.45);
      ctx.quadraticCurveTo(0, r * 0.7, -r * 0.45, r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.5, r * 0.14, 0, TAU);
      ctx.arc(r * 0.15, -r * 0.55, r * 0.14, 0, TAU);
      ctx.fill();
      break;
  }
  ctx.restore();
}
