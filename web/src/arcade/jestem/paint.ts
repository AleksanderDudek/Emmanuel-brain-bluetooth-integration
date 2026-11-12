/**
 * Ja jestem…'s drawing helpers for the play view, the intro and the lobby (DESIGN §13.8): the fonts (never
 * under the arcade's 11 px floor), the arched window's path at any size, light sprites baked once (a soft
 * glow, a burst of rays — never `shadowBlur` or `ctx.filter` per frame), the oculus that is the band's
 * gauge, and Hanna's bubble.
 */
import { clamp } from '../kit/juice';
import { MIN_TEXT } from '../kit/mobile';
import { REF_FONT, VERSE_FONT } from '../kit/scripture';
import type { Rect } from './layout';
import { RULES } from './rules';
import { ARCH_H, ARCH_R } from './vision';

export const TAU = Math.PI * 2;
export const SANS = REF_FONT;
export const SERIF = VERSE_FONT;
export const GOLD = '#f6d488';
export const GOLD_RGB: readonly [number, number, number] = [246, 212, 136];
export const LEAD = '#231c1b';
export const PAPER = '#f7efde';

/** A font size never under the floor (rounded to the half pixel). */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 600, serif = false, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** The size at which `text` fits `maxW` (from `px` down to `min`, never under the floor); sets ctx.font. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = MIN_TEXT, weight = 600, serif = false, italic = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif, italic);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif, italic);
  }
  return size;
}

/** Greedy word wrap with the context's font, at most `max` lines (the last one ends in "…" when cut). */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, max = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const wd of words) {
    const next = line ? `${line} ${wd}` : wd;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = wd;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const cut = lines.slice(0, max);
    let last = cut[max - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    cut[max - 1] = `${last.trimEnd()}…`;
    return cut;
  }
  return lines;
}

/**
 * The arched window's path over a rectangle (the picture's arch scaled to it), optionally grown by `grow` px;
 * `open`: only the sides and the arch, down to the window's sill (an aura's ring, never crossing under it).
 */
export function windowPath(r: Rect, grow = 0, open = false): Path2D {
  const p = new Path2D();
  const kx = r.w / RULES.PW, ky = r.h / RULES.PH;
  const R = ARCH_R * kx + grow, ah = ARCH_H * ky;
  const cx = r.x + r.w / 2, cy = r.y + ARCH_R * kx;
  const x0 = r.x - grow, x1 = r.x + r.w + grow, y1 = open ? r.y + r.h : r.y + r.h + grow;
  // the arch meets the sides where its circle crosses them
  const dx = r.w / 2 + grow;
  const dy = Math.sqrt(Math.max(0, R * R - dx * dx));
  const sideY = Math.min(cy - dy, r.y + ah + grow);
  p.moveTo(x0, y1);
  p.lineTo(x0, sideY);
  p.arc(cx, cy, R, Math.atan2(sideY - cy, x0 - cx), Math.atan2(sideY - cy, x1 - cx));
  p.lineTo(x1, y1);
  if (!open) p.closePath();
  return p;
}

// ── sprites (baked once, drawn with drawImage) ───────────────────
const sprites = new Map<string, HTMLCanvasElement>();

function sprite(key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  let s = sprites.get(key);
  if (!s) {
    s = document.createElement('canvas');
    s.width = s.height = size;
    const c = s.getContext('2d');
    if (c) draw(c, size);
    sprites.set(key, s);
  }
  return s;
}

/** A soft round glow of a colour ("r,g,b"), white at its heart. */
export function glowSprite(rgb: string): HTMLCanvasElement {
  return sprite(`glow:${rgb}`, 128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.25, `rgba(${rgb},0.55)`);
    g.addColorStop(0.6, `rgba(${rgb},0.14)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
}

/** A burst of soft rays (for the aura), `n` of them, in a colour ("r,g,b"). */
export function raySprite(rgb: string, n = 18): HTMLCanvasElement {
  return sprite(`rays:${rgb}:${n}`, 512, (c, s) => {
    const cx = s / 2;
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (i % 3) * 0.05;
      const len = cx * (i % 2 ? 0.78 : 1);
      const wid = i % 2 ? 0.045 : 0.07;
      const g = c.createLinearGradient(cx, cx, cx + Math.cos(a) * len, cx + Math.sin(a) * len);
      g.addColorStop(0, `rgba(${rgb},0.5)`);
      g.addColorStop(0.5, `rgba(${rgb},0.16)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(cx, cx);
      c.lineTo(cx + Math.cos(a - wid) * len, cx + Math.sin(a - wid) * len);
      c.lineTo(cx + Math.cos(a + wid) * len, cx + Math.sin(a + wid) * len);
      c.closePath();
      c.fill();
    }
  });
}

/** Draw a sprite centred at (x, y), `w` × `h` px, at an alpha, additively if `add`. */
export function blit(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, a: number, add = true): void {
  if (a <= 0.003 || w <= 0 || h <= 0) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  if (add) ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clamp(a);
  ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  ctx.globalAlpha = ga;
  ctx.globalCompositeOperation = op;
}

// ── the oculus: the gauge set into the window's crown ────────────
export interface OculusState {
  /** 0..1 (0.5 at the threshold) or null: no value shown (blind, no signal, between blocks) */
  value: number | null;
  mode: 'push' | 'rest' | 'night' | 'idle' | 'light';
  /** the colour of the stream's cell ("r,g,b") */
  rgb: string;
  t: number;
  /** a rest's breath, 0..1 (in-breath rising) */
  breath: number;
}

/**
 * A small rose window: a stone ring with six-lobed tracery, filled from below with coloured light up to the
 * value; a gold line across its middle is the threshold (and two notches outside it); above the line the
 * whole rose glows gold.  A rest fills it with the calm in silver, breathing; the night veils it.
 */
export function paintOculus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, s: OculusState): void {
  const v = s.value === null ? null : clamp(s.value);
  const on = v !== null && v >= 0.5 && (s.mode === 'push' || s.mode === 'light');
  ctx.save();
  // the glow behind it
  const glowA = s.mode === 'night' ? 0.1 : on ? 0.55 + 0.25 * Math.sin(s.t * 4) : s.mode === 'rest' ? 0.18 + 0.2 * s.breath : 0.15;
  blit(ctx, glowSprite(on ? '255,220,140' : s.mode === 'rest' ? '200,210,255' : '255,236,200'), x, y, r * 4.6, r * 4.6, glowA);
  // the stone ring
  ctx.beginPath();
  ctx.arc(x, y, r + Math.max(2, r * 0.16), 0, TAU);
  ctx.fillStyle = '#2a211f';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.save();
  ctx.clip();
  // the glass: night blue, or a dim paper light
  ctx.fillStyle = s.mode === 'night' ? '#141d3e' : '#3a3036';
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  if (s.mode === 'night') {
    ctx.fillStyle = 'rgba(255,250,230,0.85)';
    for (let i = 0; i < 6; i++) {
      const a = i * 2.1 + 0.4, d = r * (0.25 + (i % 3) * 0.22);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.8, r * 0.04), 0, TAU);
      ctx.fill();
    }
  } else if (v !== null) {
    // the light, filled from below to the value, its surface a gentle wave
    const top = y + r - 2 * r * v;
    const fill = s.mode === 'rest' ? '206,214,255' : on ? '255,214,120' : s.rgb;
    const g = ctx.createLinearGradient(0, top, 0, y + r);
    g.addColorStop(0, `rgba(${fill},0.95)`);
    g.addColorStop(1, `rgba(${fill},0.55)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - r, y + r);
    for (let i = 0; i <= 12; i++) {
      const px = x - r + (2 * r * i) / 12;
      ctx.lineTo(px, top + Math.sin(s.t * 3 + i * 0.9) * r * 0.05);
    }
    ctx.lineTo(x + r, y + r);
    ctx.closePath();
    ctx.fill();
  } else if (s.mode === 'idle') {
    blit(ctx, glowSprite('255,236,200'), x, y, r * 2.4, r * 2.4, 0.35 + 0.1 * Math.sin(s.t * 1.5), false);
  }
  ctx.restore();
  // the tracery: six lobes around a centre, in lead
  ctx.strokeStyle = 'rgba(28,22,22,0.9)';
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.42, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.2, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.strokeStyle = on ? GOLD : 'rgba(120,104,96,0.9)';
  ctx.stroke();
  // the threshold: a gold line across the middle and two notches outside the ring
  if (s.mode !== 'night' && s.mode !== 'idle') {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.setLineDash([Math.max(2, r * 0.16), Math.max(2, r * 0.12)]);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.96, y);
    ctx.lineTo(x + r * 0.96, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(2, r * 0.1);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * (r + r * 0.16), y);
      ctx.lineTo(x + sx * (r + r * 0.42), y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ── Hanna's bubble ───────────────────────────────────────────────
/** A rounded rectangle path. */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Hanna's emblem: a little round pane of coloured glass in lead. */
export function paintEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const cols = ['#e8a24a', '#c24d5c', '#4d78c2', '#5aa86a', '#f2d27a', '#8c5ac8'];
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, (i / 6) * TAU + 0.3, ((i + 1) / 6) * TAU + 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
}

/**
 * Hanna's bubble: a dark rounded card with her emblem, the line in up to two lines (13 px and more),
 * centred on `cx` with its top at `top`; `a` fades it.  Returns its box.
 */
export function paintBubble(ctx: CanvasRenderingContext2D, text: string, cx: number, top: number, maxW: number, u: number, a: number): Rect {
  const px = 14 * Math.min(u, 1.15);
  ctx.font = font(px, 600);
  const er = 13 * Math.min(u, 1.2);
  const innerW = Math.max(80, maxW - er * 2 - 30);
  const lines = wrap(ctx, text, innerW, 3);
  const lw = Math.max(...lines.map(l => ctx.measureText(l).width));
  const lh = fontPx(px) * 1.3;
  const w = Math.min(maxW, lw + er * 2 + 30), h = Math.max(er * 2 + 12, lines.length * lh + 14);
  const x = cx - w / 2;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  roundRect(ctx, x, top, w, h, 14);
  ctx.fillStyle = 'rgba(22,16,24,0.84)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(246,212,136,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  paintEmblem(ctx, x + 10 + er, top + h / 2, er);
  ctx.fillStyle = '#fbf2de';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(px, 600);
  const ty = top + h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x + er * 2 + 18, ty + i * lh));
  ctx.restore();
  return { x, y: top, w, h };
}
